import { expect, test } from '@jupyterlab/galata';
import {
  SERVER_TIMEOUT,
  callApi,
  createArchive,
  item,
  listDir,
  menuEntry,
  putDir,
  putFile,
  readBytes,
  readText,
  removeTree,
  selectAndOpenMenu,
  stopBrowserPoll,
  zipEntries
} from './helpers';

test.describe('Create Archive', () => {
  test('archives one file at the archive root', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/one.txt`, 'one content');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['one.txt']);

    await expect
      .poll(() => zipEntries(request, `${tmpPath}/one.txt.zip`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(['one.txt']);
    // Entry content survives: remove the original (it would collide with the
    // named extract folder, see DEF-EXTR-10-NAMECLASH), extract, read it back
    await removeTree(request, `${tmpPath}/one.txt`);
    const out = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/one.txt.zip`,
      extract_to_named_folder: true
    });
    expect(out.status).toBe(200);
    expect(await readText(request, `${tmpPath}/one.txt/one.txt`)).toBe(
      'one content'
    );
  });

  test('archives one folder with its structure', async ({
    page,
    tmpPath,
    request
  }) => {
    await putDir(request, `${tmpPath}/folder`);
    await putDir(request, `${tmpPath}/folder/sub`);
    await putFile(request, `${tmpPath}/folder/sub/file.txt`, 'nested');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['folder']);

    // The row appears after the request ends, so the zip is complete when read
    await expect(item(page, 'folder.zip')).toBeVisible({
      timeout: SERVER_TIMEOUT
    });
    expect(await zipEntries(request, `${tmpPath}/folder.zip`)).toContain(
      'folder/sub/file.txt'
    );
    // Every entry sits under the folder name
    const entries = (await zipEntries(request, `${tmpPath}/folder.zip`))!;
    expect(entries.every(e => e.startsWith('folder/'))).toBeTruthy();
  });

  test('archives a multi-selection into one zip', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/a.txt`, 'a');
    await putDir(request, `${tmpPath}/dir`);
    await putFile(request, `${tmpPath}/dir/b.txt`, 'b');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['a.txt', 'dir']);

    await expect
      .poll(() => zipEntries(request, `${tmpPath}/archive.zip`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(['a.txt', 'dir/', 'dir/b.txt']);
  });

  test('prefills the archive name', async ({ page, tmpPath, request }) => {
    await putFile(request, `${tmpPath}/p.txt`, 'p');
    await putFile(request, `${tmpPath}/q.txt`, 'q');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const input = page.locator('.jp-Dialog input');

    // One item: <item>.zip
    await selectAndOpenMenu(page, ['p.txt']);
    await menuEntry(page, 'Create Archive').click();
    await expect(input).toHaveValue('p.txt.zip');
    await page.locator('.jp-Dialog .jp-mod-reject').click();
    await expect(input).toBeHidden();

    // Several items: archive.zip
    await selectAndOpenMenu(page, ['p.txt', 'q.txt']);
    await menuEntry(page, 'Create Archive').click();
    await expect(input).toHaveValue('archive.zip');
    await page.locator('.jp-Dialog .jp-mod-reject').click();
  });

  test('places the archive beside the first selected item', async ({
    page,
    tmpPath,
    request
  }) => {
    await putDir(request, `${tmpPath}/inner`);
    await putFile(request, `${tmpPath}/inner/deep.txt`, 'deep');
    await page.goto();
    await page.filebrowser.openDirectory(`${tmpPath}/inner`);

    await createArchive(page, ['deep.txt']);

    await expect
      .poll(() => listDir(request, `${tmpPath}/inner`), {
        timeout: SERVER_TIMEOUT
      })
      .toContain('deep.txt.zip');
    expect(await listDir(request, tmpPath)).toEqual(['inner']);
  });

  test('appends .zip to a name typed without it', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/s.txt`, 's');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['s.txt'], 'bundle');

    await expect
      .poll(() => zipEntries(request, `${tmpPath}/bundle.zip`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(['s.txt']);
    expect(await readBytes(request, `${tmpPath}/bundle`)).toBeNull();
  });

  test('cancelled or empty name creates nothing and sends no request', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/c.txt`, 'c');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const calls: string[] = [];
    page.on('request', r => {
      if (r.url().includes('/jupyterlab-zip/')) {
        calls.push(r.url());
      }
    });

    // Cancel
    await selectAndOpenMenu(page, ['c.txt']);
    await menuEntry(page, 'Create Archive').click();
    await page.locator('.jp-Dialog .jp-mod-reject').click();
    await expect(page.locator('.jp-Dialog')).toBeHidden();

    // Empty name, accepted
    await selectAndOpenMenu(page, ['c.txt']);
    await menuEntry(page, 'Create Archive').click();
    await page.locator('.jp-Dialog input').fill('');
    await page.locator('.jp-Dialog .jp-mod-accept').click();
    await expect(page.locator('.jp-Dialog')).toBeHidden();

    // A request, if sent, is already on the wire by now; give the page a moment to send it
    await page.waitForTimeout(1000);
    expect(calls).toEqual([]);
    expect(await listDir(request, tmpPath)).toEqual(['c.txt']);
  });

  test('lists the new archive without a manual refresh', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/r.txt`, 'r');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await expect(item(page, 'r.txt.zip')).toBeHidden();
    await stopBrowserPoll(page);

    const done = page.waitForResponse(/jupyterlab-zip\/zip/);
    await createArchive(page, ['r.txt']);
    await done;

    // No refresh call from the test and the browser poll is stopped: only the extension's refresh shows the row
    await expect(item(page, 'r.txt.zip')).toBeVisible({ timeout: 5000 });
    expect(await zipEntries(request, `${tmpPath}/r.txt.zip`)).toEqual([
      'r.txt'
    ]);
  });

  test('enables Create Archive only with a selection', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/e.txt`, 'e');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await item(page, 'e.txt').waitFor();
    const enabled = () =>
      page.evaluate(() =>
        (window as any).jupyterapp.commands.isEnabled('filebrowser:zip-files')
      );

    await item(page, 'e.txt').click();
    expect(await enabled()).toBe(true);

    // Ctrl-click on the selected row clears the selection
    await item(page, 'e.txt').click({ modifiers: ['Control'] });
    await expect(item(page, 'e.txt')).not.toHaveClass(/jp-mod-selected/);
    expect(await enabled()).toBe(false);
  });
});

test.describe('Create Archive, existing archive', () => {
  /** a.zip holds x.txt; y.txt waits to be archived under the same name. */
  async function setup(request: any, dir: string): Promise<Buffer> {
    await putFile(request, `${dir}/x.txt`, 'x');
    await putFile(request, `${dir}/y.txt`, 'y');
    const r = await callApi(request, 'zip', {
      archive_name: 'a.zip',
      paths: [`${dir}/x.txt`]
    });
    expect(r.status).toBe(200);
    return (await readBytes(request, `${dir}/a.zip`))!;
  }
  const confirm = (page: any) =>
    page.locator('.jp-Dialog', { hasText: 'Overwrite archive?' });

  test('asks before replacing an archive and Ok replaces it', async ({
    page,
    tmpPath,
    request
  }) => {
    await setup(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['y.txt'], 'a.zip');

    await expect(confirm(page)).toBeVisible({ timeout: SERVER_TIMEOUT });
    await expect(confirm(page)).toContainText('a.zip already exists');
    await confirm(page).locator('.jp-mod-accept').click();
    await expect
      .poll(() => zipEntries(request, `${tmpPath}/a.zip`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(['y.txt']);
  });

  test('Cancel in the overwrite dialog keeps the old archive byte for byte', async ({
    page,
    tmpPath,
    request
  }) => {
    const before = await setup(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await createArchive(page, ['y.txt'], 'a.zip');

    await expect(confirm(page)).toBeVisible({ timeout: SERVER_TIMEOUT });
    await confirm(page).locator('.jp-mod-reject').click();
    await expect(page.locator('.jp-Dialog')).toBeHidden();
    const after = (await readBytes(request, `${tmpPath}/a.zip`))!;
    expect(after.equals(before)).toBe(true);
  });
});
