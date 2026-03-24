import { expect, test } from '@jupyterlab/galata';

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

test('should show spinner dialog when creating archive', async ({ page, tmpPath, request }) => {
  await page.goto();

  // Create a test file using Jupyter contents API
  const response = await request.put(`./api/contents/${tmpPath}/test_file.txt`, {
    data: JSON.stringify({
      type: 'file',
      format: 'text',
      content: 'hello world'
    })
  });
  expect(response.ok()).toBeTruthy();

  // Navigate to the test directory
  await page.filebrowser.openDirectory(tmpPath);

  // Right-click on the test file to open context menu
  const fileItem = page.locator(`.jp-DirListing-itemText span:text("test_file.txt")`);
  await fileItem.waitFor({ state: 'visible', timeout: 10000 });
  await fileItem.click({ button: 'right' });

  // Click "Create Archive" in context menu
  const menuItem = page.locator('.lm-Menu-itemLabel:text("Create Archive")');
  await menuItem.waitFor({ state: 'visible', timeout: 5000 });
  await menuItem.click();

  // Accept the default archive name in the input dialog
  const inputDialog = page.locator('.jp-Dialog');
  await inputDialog.waitFor({ state: 'visible', timeout: 5000 });
  const acceptButton = page.locator('.jp-Dialog .jp-mod-accept');
  await acceptButton.click();

  // Verify spinner dialog appears with "Creating archive..." message
  const spinnerDialog = page.locator('.jp-Dialog:has-text("Creating archive...")');
  await spinnerDialog.waitFor({ state: 'visible', timeout: 5000 });

  // Verify it disappears after the operation completes
  await spinnerDialog.waitFor({ state: 'hidden', timeout: 30000 });

  // Verify the archive was created
  const archiveItem = page.locator(`.jp-DirListing-itemText span:text("test_file.txt.zip")`);
  await archiveItem.waitFor({ state: 'visible', timeout: 10000 });
});

test('should show spinner dialog when extracting archive', async ({ page, tmpPath, request }) => {
  await page.goto();

  // Create a test file first
  const response = await request.put(`./api/contents/${tmpPath}/extract_test.txt`, {
    data: JSON.stringify({
      type: 'file',
      format: 'text',
      content: 'extract test content'
    })
  });
  expect(response.ok()).toBeTruthy();

  await page.filebrowser.openDirectory(tmpPath);

  // First create a zip archive from the test file
  const fileItem = page.locator(`.jp-DirListing-itemText span:text("extract_test.txt")`);
  await fileItem.waitFor({ state: 'visible', timeout: 10000 });
  await fileItem.click({ button: 'right' });

  const createMenuItem = page.locator('.lm-Menu-itemLabel:text("Create Archive")');
  await createMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await createMenuItem.click();

  // Accept default name
  const inputDialog = page.locator('.jp-Dialog');
  await inputDialog.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.jp-Dialog .jp-mod-accept').click();

  // Wait for spinner to appear and disappear (zip creation)
  const createSpinner = page.locator('.jp-Dialog:has-text("Creating archive...")');
  await createSpinner.waitFor({ state: 'visible', timeout: 5000 });
  await createSpinner.waitFor({ state: 'hidden', timeout: 30000 });

  // Wait for the zip file to appear
  const zipItem = page.locator(`.jp-DirListing-itemText span:text("extract_test.txt.zip")`);
  await zipItem.waitFor({ state: 'visible', timeout: 10000 });

  // Now right-click the zip file and extract it
  await zipItem.click({ button: 'right' });

  const extractMenuItem = page.locator('.lm-Menu-itemLabel:text("Extract Archive")');
  await extractMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await extractMenuItem.click();

  // Verify spinner dialog appears with "Extracting archive..." message
  const extractSpinner = page.locator('.jp-Dialog:has-text("Extracting archive...")');
  await extractSpinner.waitFor({ state: 'visible', timeout: 5000 });

  // Verify it disappears after the operation completes
  await extractSpinner.waitFor({ state: 'hidden', timeout: 30000 });
});
