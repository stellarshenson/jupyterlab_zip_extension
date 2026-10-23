import { expect, test } from '@jupyterlab/galata';
import {
  CREATING,
  EXTRACTING,
  SERVER_TIMEOUT,
  createArchive,
  delayEndpoint,
  extractArchive,
  item,
  putFile,
  removeTree,
  spinnerCycle,
  zipEntries
} from './helpers';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test('should emit an activation console message', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', message => {
    logs.push(message.text());
  });

  await page.goto();

  expect(
    logs.filter(s => s === 'JupyterLab Zip/Unzip Extension is activated!')
  ).toHaveLength(1);
});

test('should show spinner dialog when creating archive', async ({
  page,
  tmpPath,
  request
}) => {
  await putFile(request, `${tmpPath}/test_file.txt`, 'hello world');
  await page.goto();
  await page.filebrowser.openDirectory(tmpPath);
  // The request must outlast the spinner check
  await delayEndpoint(page, 'zip');

  await createArchive(page, ['test_file.txt']);

  await spinnerCycle(page, CREATING);

  // The archive exists on the server and holds the file
  await expect
    .poll(() => zipEntries(request, `${tmpPath}/test_file.txt.zip`), {
      timeout: SERVER_TIMEOUT
    })
    .toEqual(['test_file.txt']);
  await expect(item(page, 'test_file.txt.zip')).toBeVisible({
    timeout: SERVER_TIMEOUT
  });
});

test('should show spinner dialog when extracting archive', async ({
  page,
  tmpPath,
  request
}) => {
  await putFile(request, `${tmpPath}/extract_test.txt`, 'extract test content');
  await page.goto();
  await page.filebrowser.openDirectory(tmpPath);

  // First create a zip archive from the test file
  await createArchive(page, ['extract_test.txt']);
  await expect(item(page, 'extract_test.txt.zip')).toBeVisible({
    timeout: SERVER_TIMEOUT
  });

  // Remove the original: extracting next to it would fail (DEF-EXTR-10-NAMECLASH)
  await removeTree(request, `${tmpPath}/extract_test.txt`);
  await page.filebrowser.refresh();
  await expect(item(page, 'extract_test.txt')).toBeHidden({
    timeout: SERVER_TIMEOUT
  });

  // Now extract it; the request must outlast the spinner check
  await delayEndpoint(page, 'unzip');
  await extractArchive(page, 'extract_test.txt.zip');
  await spinnerCycle(page, EXTRACTING);

  // The content is on the server under the named folder
  const r = await request.get(
    `./api/contents/${tmpPath}/extract_test.txt/extract_test.txt?content=1&format=text`
  );
  expect(r.ok()).toBeTruthy();
  expect((await r.json()).content).toBe('extract test content');
});
