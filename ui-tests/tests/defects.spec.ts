// Each test asserts the CORRECT behaviour of a filed defect (docs/defects.md).
// It fails on a build that still has the defect, by design.
import { expect, test } from '@jupyterlab/galata';
import {
  mkdtempSync,
  existsSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  SERVER_TIMEOUT,
  callApi,
  createArchive,
  exists,
  extractArchive,
  listDir,
  putDir,
  putFile,
  readBytes,
  readText,
  zipEntries
} from './helpers';

test.describe('DEF-SECU-1-TRAVERSAL', () => {
  let outside: string;
  test.beforeEach(() => {
    outside = mkdtempSync(join(tmpdir(), 'zip-outside-'));
  });
  test.afterEach(() => {
    rmSync(outside, { recursive: true, force: true });
  });

  test('zip refuses an absolute path outside the server root', async ({
    request
  }) => {
    writeFileSync(join(outside, 'secret.txt'), 'secret');

    const r = await callApi(request, 'zip', {
      archive_name: 'leak.zip',
      paths: [join(outside, 'secret.txt')]
    });

    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    // Nothing was written next to the outside file
    expect(readdirSync(outside)).toEqual(['secret.txt']);
  });

  test('zip refuses an archive_name that leaves the item directory', async ({
    request,
    tmpPath
  }) => {
    await putFile(request, `${tmpPath}/x.txt`, 'x');
    const name = `escape-${Date.now()}.zip`;

    const r = await callApi(request, 'zip', {
      archive_name: `../${name}`,
      paths: [`${tmpPath}/x.txt`]
    });

    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    // The escape would land the zip in the parent of tmpPath
    const parent = tmpPath.includes('/')
      ? tmpPath.slice(0, tmpPath.lastIndexOf('/'))
      : '';
    const leaked = `${parent ? parent + '/' : ''}${name}`;
    const leakedExists = await exists(request, leaked);
    if (leakedExists) {
      await request.delete(`./api/contents/${leaked}`);
    }
    expect(leakedExists).toBe(false);
  });

  test('unzip refuses an archive path outside the server root', async ({
    request,
    tmpPath
  }) => {
    // Build a real zip inside the root, copy its bytes to the outside folder
    await putFile(request, `${tmpPath}/in.txt`, 'payload');
    await callApi(request, 'zip', {
      archive_name: 'in.zip',
      paths: [`${tmpPath}/in.txt`]
    });
    writeFileSync(
      join(outside, 'planted.zip'),
      (await readBytes(request, `${tmpPath}/in.zip`))!
    );

    const r = await callApi(request, 'unzip', {
      archive_path: join(outside, 'planted.zip'),
      extract_to_named_folder: true
    });

    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect(existsSync(join(outside, 'planted'))).toBe(false);
  });

  for (const item of ['', '.', 'f.txt/..']) {
    test(`zip refuses the server root itself as item "${item}"`, async ({
      request
    }) => {
      const r = await callApi(request, 'zip', {
        archive_name: `root-escape-${Date.now()}.zip`,
        paths: [item]
      });

      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      expect(r.body?.archive_path).toBeUndefined();
    });
  }

  for (const archivePath of ['', '.']) {
    test(`unzip refuses archive_path "${archivePath}"`, async ({ request }) => {
      const r = await callApi(request, 'unzip', {
        archive_path: archivePath,
        extract_to_named_folder: true
      });

      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
    });
  }
});

test.describe('DEF-DATA-3-ZIPOVER', () => {
  test('a second zip of the same name keeps the first archive', async ({
    request,
    tmpPath
  }) => {
    await putFile(request, `${tmpPath}/x.txt`, 'x');
    await putFile(request, `${tmpPath}/y.txt`, 'y');
    const first = await callApi(request, 'zip', {
      archive_name: 'a.zip',
      paths: [`${tmpPath}/x.txt`]
    });
    expect(first.status).toBe(200);
    const before = (await readBytes(request, `${tmpPath}/a.zip`))!;

    const second = await callApi(request, 'zip', {
      archive_name: 'a.zip',
      paths: [`${tmpPath}/y.txt`]
    });

    expect(second.status).toBe(409);
    const after = (await readBytes(request, `${tmpPath}/a.zip`))!;
    expect(after.equals(before)).toBe(true);
  });
});

test.describe('DEF-DATA-4-UNZOVER', () => {
  /** tmpPath/doc.zip holds doc.txt = "original". */
  async function makeDocZip(request: any, dir: string): Promise<void> {
    await putFile(request, `${dir}/doc.txt`, 'original');
    const r = await callApi(request, 'zip', {
      archive_name: 'doc.zip',
      paths: [`${dir}/doc.txt`]
    });
    expect(r.status).toBe(200);
  }

  test('extract keeps an existing file byte for byte and lands in the stem (1) folder', async ({
    request,
    tmpPath
  }) => {
    await makeDocZip(request, tmpPath);
    await putDir(request, `${tmpPath}/doc`);
    await putFile(request, `${tmpPath}/doc/doc.txt`, 'my edit');
    const before = (await readBytes(request, `${tmpPath}/doc/doc.txt`))!;

    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/doc.zip`,
      extract_to_named_folder: true
    });

    expect(r.status).toBe(200);
    expect(r.body.extract_path).toBe(`${tmpPath}/doc (1)`);
    expect(await readText(request, `${tmpPath}/doc (1)/doc.txt`)).toBe(
      'original'
    );
    const after = (await readBytes(request, `${tmpPath}/doc/doc.txt`))!;
    expect(after.equals(before)).toBe(true);
  });

  test('in-place extract keeps an existing file byte for byte and lands in the stem folder', async ({
    request,
    tmpPath
  }) => {
    await makeDocZip(request, tmpPath);
    await putFile(request, `${tmpPath}/doc.txt`, 'my edit');
    const before = (await readBytes(request, `${tmpPath}/doc.txt`))!;

    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/doc.zip`,
      extract_to_named_folder: false
    });

    expect(r.status).toBe(200);
    expect(r.body.extract_path).toBe(`${tmpPath}/doc`);
    expect(await readText(request, `${tmpPath}/doc/doc.txt`)).toBe('original');
    const after = (await readBytes(request, `${tmpPath}/doc.txt`))!;
    expect(after.equals(before)).toBe(true);
  });
});

test.describe('DEF-FEED-5-SILENT', () => {
  test('a failed extract tells the user', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/fake.zip`, 'not a zip');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await extractArchive(page, 'fake.zip');

    // The extension's error dialog names the failure
    await expect(
      page.locator('.jp-Dialog', { hasText: 'Extract Archive failed' })
    ).toBeVisible({ timeout: SERVER_TIMEOUT });
  });
});

test.describe('DEF-ARCH-6-EMPTYDIR', () => {
  test('an empty subfolder is kept in the archive', async ({
    request,
    tmpPath
  }) => {
    await putDir(request, `${tmpPath}/d`);
    await putDir(request, `${tmpPath}/d/e`);
    await putFile(request, `${tmpPath}/d/f.txt`, 'f');

    const r = await callApi(request, 'zip', {
      archive_name: 'd.zip',
      paths: [`${tmpPath}/d`]
    });
    expect(r.status).toBe(200);

    // The folder survives a round trip
    await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/d.zip`,
      extract_to_named_folder: true
    });
    expect(await listDir(request, `${tmpPath}/d/d`)).toContain('e');
    expect((await zipEntries(request, `${tmpPath}/d.zip`))!.join()).toContain(
      'd/e/'
    );
  });
});

test.describe('DEF-ARCH-8-EMPTYBODY', () => {
  test('a request with no body or malformed JSON answers 400', async ({
    request
  }) => {
    for (const endpoint of ['zip', 'unzip']) {
      const empty = await request.post(`./jupyterlab-zip/${endpoint}`);
      expect(empty.status(), `${endpoint} with no body`).toBe(400);
      const bad = await request.post(`./jupyterlab-zip/${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from('{not json')
      });
      expect(bad.status(), `${endpoint} with bad JSON`).toBe(400);
    }
  });
});

test.describe('DEF-ARCH-11-NONOBJECT', () => {
  test('a JSON body that is not an object answers 400', async ({ request }) => {
    for (const endpoint of ['zip', 'unzip']) {
      for (const body of ['"abc"', '[1]', '5']) {
        const r = await request.post(`./jupyterlab-zip/${endpoint}`, {
          headers: { 'Content-Type': 'application/json' },
          data: Buffer.from(body)
        });
        expect(r.status(), `${endpoint} with ${body}`).toBe(400);
      }
    }
  });
});

test.describe('DEF-ARCH-9-BLANKNAME', () => {
  test('an archive name of spaces creates no file', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/b.txt`, 'b');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const calls: string[] = [];
    page.on('request', r => {
      if (r.url().includes('/jupyterlab-zip/')) {
        calls.push(r.url());
      }
    });

    await createArchive(page, ['b.txt'], '   ');
    // A fix may keep the dialog open with a message; either way no request goes out
    await page.waitForTimeout(2000);

    expect(await listDir(request, tmpPath)).toEqual(['b.txt']);
    expect(calls).toEqual([]);
  });
});

test.describe('DEF-EXTR-10-NAMECLASH', () => {
  test('x.txt.zip beside x.txt extracts into x.txt (1)', async ({
    request,
    tmpPath
  }) => {
    await putFile(request, `${tmpPath}/x.txt`, 'x content');
    const made = await callApi(request, 'zip', {
      archive_name: 'x.txt.zip',
      paths: [`${tmpPath}/x.txt`]
    });
    expect(made.status).toBe(200);

    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/x.txt.zip`,
      extract_to_named_folder: true
    });

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.extract_path).toBe(`${tmpPath}/x.txt (1)`);
    expect(await readText(request, `${tmpPath}/x.txt (1)/x.txt`)).toBe(
      'x content'
    );
    expect(await readText(request, `${tmpPath}/x.txt`)).toBe('x content');
  });
});
