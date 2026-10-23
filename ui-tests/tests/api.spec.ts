import { expect, test } from '@jupyterlab/galata';
import { callApi, listDir, putDir, putFile, zipEntries } from './helpers';

test.describe('zip endpoint', () => {
  test('answers 400 when archive_name or paths is missing', async ({
    request
  }) => {
    const noPaths = await callApi(request, 'zip', {
      archive_name: 'x.zip',
      paths: []
    });
    expect(noPaths.status).toBe(400);
    expect(noPaths.body.success).toBe(false);

    const noName = await callApi(request, 'zip', { paths: ['whatever.txt'] });
    expect(noName.status).toBe(400);
    expect(noName.body.success).toBe(false);
  });

  test('answers success, a root-relative archive_path and the file count', async ({
    request,
    tmpPath
  }) => {
    await putFile(request, `${tmpPath}/f1.txt`, '1');
    await putFile(request, `${tmpPath}/f2.txt`, '2');

    const r = await callApi(request, 'zip', {
      archive_name: 'two.zip',
      paths: [`${tmpPath}/f1.txt`, `${tmpPath}/f2.txt`]
    });

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.archive_path).toBe(`${tmpPath}/two.zip`);
    expect(r.body.message).toContain('2 files');
    expect(await zipEntries(request, r.body.archive_path)).toEqual([
      'f1.txt',
      'f2.txt'
    ]);
  });
});

test.describe('zip endpoint, existing archive', () => {
  test('answers 409 for an existing archive and 200 with overwrite true', async ({
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

    const refused = await callApi(request, 'zip', {
      archive_name: 'a.zip',
      paths: [`${tmpPath}/y.txt`]
    });
    expect(refused.status).toBe(409);
    expect(refused.body.success).toBe(false);
    expect(await zipEntries(request, `${tmpPath}/a.zip`)).toEqual(['x.txt']);

    const replaced = await callApi(request, 'zip', {
      archive_name: 'a.zip',
      paths: [`${tmpPath}/y.txt`],
      overwrite: true
    });
    expect(replaced.status).toBe(200);
    expect(await zipEntries(request, `${tmpPath}/a.zip`)).toEqual(['y.txt']);
  });
});

test.describe('unzip endpoint', () => {
  test('answers 400 when archive_path is missing', async ({ request }) => {
    const r = await callApi(request, 'unzip', {});
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
  });

  test('answers 404 Archive not found for a missing archive', async ({
    request,
    tmpPath
  }) => {
    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/missing.zip`
    });
    expect(r.status).toBe(404);
    expect(r.body.success).toBe(false);
    expect(r.body.error).toBe('Archive not found');
  });

  test('answers success, a root-relative extract_path and the file count', async ({
    request,
    tmpPath
  }) => {
    await putDir(request, `${tmpPath}/d`);
    await putFile(request, `${tmpPath}/d/f1.txt`, '1');
    await putFile(request, `${tmpPath}/d/f2.txt`, '2');
    await callApi(request, 'zip', {
      archive_name: 'd.zip',
      paths: [`${tmpPath}/d`]
    });

    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/d.zip`,
      extract_to_named_folder: true
    });

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.extract_path).toBe(`${tmpPath}/d`);
    expect(r.body.message).toContain('Extracted 2 files'); // file entries only, not the folder d/
    expect((await listDir(request, `${tmpPath}/d/d`))!.sort()).toEqual([
      'f1.txt',
      'f2.txt'
    ]);
  });

  test('answers 500 with the error text for a file that is not a zip', async ({
    request,
    tmpPath
  }) => {
    await putFile(request, `${tmpPath}/fake.zip`, 'not a zip');

    const r = await callApi(request, 'unzip', {
      archive_path: `${tmpPath}/fake.zip`
    });

    expect(r.status).toBe(500);
    expect(r.body.success).toBe(false);
    expect(r.body.error).toMatch(/\S/);
  });
});
