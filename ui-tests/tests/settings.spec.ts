import { expect, test } from '@jupyterlab/galata';
import {
  SERVER_TIMEOUT,
  callApi,
  extractArchive,
  listDir,
  putDir,
  putFile,
  readText,
  removeTree
} from './helpers';

// Real settings round-trip: the test server writes to its private settings folder
test.use({ mockSettings: false });

test('applies a changed extractToNamedFolder to the next extract without reload', async ({
  page,
  tmpPath,
  request
}) => {
  await putDir(request, `${tmpPath}/src`);
  await putFile(request, `${tmpPath}/src/a.txt`, 'alpha');
  expect(
    (
      await callApi(request, 'zip', {
        archive_name: 'a.zip',
        paths: [`${tmpPath}/src/a.txt`]
      })
    ).status
  ).toBe(200);
  // Remove the source so only an extract can bring a.txt back
  await removeTree(request, `${tmpPath}/src/a.txt`);
  await page.goto();
  await page.filebrowser.openDirectory(`${tmpPath}/src`);

  // Open the settings editor on the extension's page and untick the box
  await page.evaluate(async () => {
    await (window as any).jupyterapp.commands.execute('settingeditor:open', {
      query: 'Zip Extension'
    });
  });
  const box = page.getByRole('checkbox', { name: /Extract to Named Folder/i });
  await expect(box).toBeChecked({ timeout: SERVER_TIMEOUT });
  await box.uncheck();
  await expect(box).not.toBeChecked();

  // Back to the file browser, same page, no reload
  await page.sidebar.openTab('filebrowser');
  await page.filebrowser.openDirectory(`${tmpPath}/src`);
  await extractArchive(page, 'a.zip');

  // In place: a.txt beside a.zip, no folder named a
  await expect
    .poll(() => listDir(request, `${tmpPath}/src`), { timeout: SERVER_TIMEOUT })
    .toContain('a.txt');
  expect(await listDir(request, `${tmpPath}/src`)).not.toContain('a');
  expect(await readText(request, `${tmpPath}/src/a.txt`)).toBe('alpha');
});
