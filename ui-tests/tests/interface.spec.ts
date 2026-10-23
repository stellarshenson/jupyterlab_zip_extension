import { expect, test } from '@jupyterlab/galata';
import {
  SERVER_TIMEOUT,
  item,
  menuEntry,
  putFile,
  selectAndOpenMenu
} from './helpers';

test('offers the entries in the file-browser context menu', async ({
  page,
  tmpPath,
  request
}) => {
  await putFile(request, `${tmpPath}/plain.txt`, 'x');
  await putFile(request, `${tmpPath}/pack.zip`, 'x');
  await page.goto();
  await page.filebrowser.openDirectory(tmpPath);

  await selectAndOpenMenu(page, ['plain.txt']);
  await expect(menuEntry(page, 'Create Archive')).toBeVisible();
  await expect(menuEntry(page, 'Extract Archive')).toBeHidden();
  await page.keyboard.press('Escape');

  await selectAndOpenMenu(page, ['pack.zip']);
  await expect(menuEntry(page, 'Create Archive')).toBeVisible();
  await expect(menuEntry(page, 'Extract Archive')).toBeVisible();
});

test('lists both commands in the palette under File Operations', async ({
  page,
  tmpPath,
  request
}) => {
  await putFile(request, `${tmpPath}/pack.zip`, 'x');
  await page.goto();
  await page.filebrowser.openDirectory(tmpPath);
  // Extract Archive is listed while one zip is selected (the palette hides invisible commands)
  await item(page, 'pack.zip').click();
  await page.evaluate(async () => {
    await (window as any).jupyterapp.commands.execute(
      'apputils:activate-command-palette'
    );
  });
  // pressSequentially: fill() does not trigger the palette's search
  await page.locator('.lm-CommandPalette-input').pressSequentially('archive');

  await expect(
    page.locator(
      '.lm-CommandPalette-item[data-command="filebrowser:zip-files"]'
    )
  ).toBeVisible({ timeout: SERVER_TIMEOUT });
  // The category is the nearest header above the item
  const categories = await page.evaluate(() =>
    ['filebrowser:zip-files', 'filebrowser:unzip-file'].map(cmd => {
      let el = document.querySelector(
        `.lm-CommandPalette-item[data-command="${cmd}"]`
      ) as HTMLElement | null;
      while (el && !el.classList.contains('lm-CommandPalette-header')) {
        el = el.previousElementSibling as HTMLElement | null;
      }
      return el ? el.innerText : null;
    })
  );
  expect(categories).toEqual(['File Operations', 'File Operations']);
});

test('shows the zip icon and ZIP Archive type on zip files', async ({
  page,
  tmpPath,
  request
}) => {
  await putFile(request, `${tmpPath}/pack.zip`, 'x');
  await putFile(request, `${tmpPath}/plain.txt`, 'x');
  await page.goto();
  await page.filebrowser.openDirectory(tmpPath);

  const icon = item(page, 'pack.zip').locator('.jp-DirListing-itemIcon svg');
  await expect(icon).toHaveAttribute(
    'data-icon',
    'jupyterlab_zip_extension:zip'
  );
  await expect(
    item(page, 'plain.txt').locator('.jp-DirListing-itemIcon svg')
  ).not.toHaveAttribute('data-icon', 'jupyterlab_zip_extension:zip');
  const type = await page.evaluate(() => {
    const t = (window as any).jupyterapp.docRegistry.getFileType('zip');
    return [t.displayName, t.extensions];
  });
  expect(type).toEqual(['ZIP Archive', ['.zip']]);
});
