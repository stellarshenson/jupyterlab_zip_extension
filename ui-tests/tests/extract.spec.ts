import { expect, galata, test } from '@jupyterlab/galata';
import {
  EXTRACTING,
  SERVER_TIMEOUT,
  callApi,
  delayEndpoint,
  extractArchive,
  item,
  listDir,
  menuEntry,
  putDir,
  putFile,
  readText,
  removeTree,
  selectAndOpenMenu,
  spinnerCycle,
  stopBrowserPoll
} from './helpers';

const PLUGIN = 'jupyterlab_zip_extension:plugin';

/** Make <dir>/a.zip holding a.txt = "alpha" and sub/b.txt = "beta", through the zip endpoint. */
async function makeZip(request: any, dir: string): Promise<void> {
  await putDir(request, `${dir}/src`);
  await putDir(request, `${dir}/src/sub`);
  await putFile(request, `${dir}/src/a.txt`, 'alpha');
  await putFile(request, `${dir}/src/sub/b.txt`, 'beta');
  const r = await callApi(request, 'zip', {
    archive_name: 'a.zip',
    paths: [`${dir}/src`]
  });
  expect(r.status).toBe(200);
  // Remove the source so the extract result is the only copy
  await removeTree(request, `${dir}/src`);
}

test.describe('Extract Archive, extractToNamedFolder true', () => {
  test('shows Extract Archive only for exactly one zip', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/one.zip`, 'x');
    await putFile(request, `${tmpPath}/two.zip`, 'x');
    await putFile(request, `${tmpPath}/note.txt`, 'x');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const entry = menuEntry(page, 'Extract Archive');
    const verdict = () =>
      page.evaluate(() => {
        const c = (window as any).jupyterapp.commands;
        return [
          c.isVisible('filebrowser:unzip-file'),
          c.isEnabled('filebrowser:unzip-file')
        ];
      });

    // One zip: shown and enabled
    await selectAndOpenMenu(page, ['one.zip']);
    await expect(entry).toBeVisible();
    expect(await verdict()).toEqual([true, true]);
    await page.keyboard.press('Escape');

    // The hidden item stays in the DOM, so the negative case is toBeHidden, plus the command verdict
    for (const names of [
      ['note.txt'],
      ['one.zip', 'two.zip'],
      ['one.zip', 'note.txt']
    ]) {
      await selectAndOpenMenu(page, names);
      await expect(menuEntry(page, 'Create Archive')).toBeVisible();
      await expect(entry).toBeHidden();
      expect((await verdict())[0]).toBe(false);
      await page.keyboard.press('Escape');
    }
  });

  test('extracts into a folder named after the archive', async ({
    page,
    tmpPath,
    request
  }) => {
    await makeZip(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await extractArchive(page, 'a.zip');

    await expect
      .poll(() => readText(request, `${tmpPath}/a/src/a.txt`), {
        timeout: SERVER_TIMEOUT
      })
      .toBe('alpha');
    expect(await readText(request, `${tmpPath}/a/src/sub/b.txt`)).toBe('beta');
    // Nothing beside the archive except the new folder
    expect((await listDir(request, tmpPath))!.sort()).toEqual(['a', 'a.zip']);
  });

  test('refreshes the listing after extract', async ({
    page,
    tmpPath,
    request
  }) => {
    await makeZip(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await expect(item(page, 'a')).toBeHidden();
    await stopBrowserPoll(page);

    const done = page.waitForResponse(/jupyterlab-zip\/unzip/);
    await extractArchive(page, 'a.zip');
    await done;

    // No refresh call from the test and the browser poll is stopped: only the extension's refresh shows the row
    await expect(item(page, 'a')).toBeVisible({ timeout: 5000 });
  });

  test('shows the spinner dialog while the unzip request runs', async ({
    page,
    tmpPath,
    request
  }) => {
    await makeZip(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await delayEndpoint(page, 'unzip');

    await extractArchive(page, 'a.zip');

    await spinnerCycle(page, EXTRACTING);
    expect(await readText(request, `${tmpPath}/a/src/a.txt`)).toBe('alpha');
  });
});

test.describe('Extract Archive, extractToNamedFolder false', () => {
  test.use({
    mockSettings: {
      ...galata.DEFAULT_SETTINGS,
      [PLUGIN]: { extractToNamedFolder: false }
    }
  });

  test('extracts into the directory that holds the archive', async ({
    page,
    tmpPath,
    request
  }) => {
    await makeZip(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await extractArchive(page, 'a.zip');

    await expect
      .poll(() => readText(request, `${tmpPath}/src/a.txt`), {
        timeout: SERVER_TIMEOUT
      })
      .toBe('alpha');
    expect(await readText(request, `${tmpPath}/src/sub/b.txt`)).toBe('beta');
    // No folder named after the archive
    expect((await listDir(request, tmpPath))!.sort()).toEqual(['a.zip', 'src']);
  });
});
