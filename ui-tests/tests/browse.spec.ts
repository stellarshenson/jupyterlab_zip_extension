import { expect, test } from '@jupyterlab/galata';
import { readFileSync } from 'fs';
import {
  SERVER_TIMEOUT,
  browserPath,
  item,
  listDir,
  mainWidgets,
  putBytes,
  putDir,
  putFile,
  readBytes,
  sha256,
  stopBrowserPoll,
  watchDocuments,
  zipBytes
} from './helpers';

const NOTEBOOK = JSON.stringify({
  cells: [{ cell_type: 'markdown', metadata: {}, source: 'archived notebook' }],
  metadata: {
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3',
      language: 'python'
    }
  },
  nbformat: 4,
  nbformat_minor: 5
});

/** a.zip: nested, prefix-only and empty folders, a notebook and a highly compressible file. */
const ENTRIES: [string, string][] = [
  ['top.txt', 'top text'],
  ['big.txt', 'a'.repeat(5000)],
  ['dir/', ''],
  ['dir/x.txt', 'x text'],
  ['dir/sub/y.txt', 'y text'],
  ['implied/deep/z.txt', 'z text'],
  ['empty/', ''],
  ['nb.ipynb', NOTEBOOK]
];
const TOP = ['big.txt', 'dir', 'empty', 'implied', 'nb.ipynb', 'top.txt'];

/** Put a.zip (and any extra files) into dir; returns the archive bytes. */
async function fixture(
  request: any,
  dir: string,
  entries: [string, string | Buffer][] = ENTRIES,
  name = 'a.zip'
): Promise<Buffer> {
  const bytes = zipBytes(entries);
  await putBytes(request, `${dir}/${name}`, bytes);
  return bytes;
}

async function waitPath(page: any, path: string): Promise<void> {
  await expect
    .poll(() => browserPath(page), { timeout: SERVER_TIMEOUT })
    .toBe(path);
}

/** Double-click a row and wait until the browser shows the expected path. */
async function open(page: any, name: string, path: string): Promise<void> {
  const row = item(page, name);
  await row.waitFor({ state: 'visible', timeout: SERVER_TIMEOUT });
  await row.dblclick();
  await waitPath(page, path);
}

/** Visible row names of the file browser. */
async function rows(page: any): Promise<string[]> {
  return (
    await page
      .locator('.jp-DirListing-item .jp-DirListing-itemText')
      .allInnerTexts()
  )
    .map((t: string) => t.trim())
    .sort();
}

async function expectRows(page: any, names: string[]): Promise<void> {
  await expect
    .poll(() => rows(page), { timeout: SERVER_TIMEOUT })
    .toEqual([...names].sort());
}

/** Wait for an error dialog with this title, then dismiss it. */
async function dismissError(page: any, title: string): Promise<void> {
  const dialog = page.locator('.jp-Dialog');
  await expect(dialog.locator('.jp-Dialog-header')).toHaveText(title, {
    timeout: SERVER_TIMEOUT
  });
  // showErrorMessage has one button, Close
  await dialog.locator('.jp-Dialog-footer .jp-Dialog-button').click();
  await expect(dialog).toHaveCount(0);
}

/** Select rows (click, then Ctrl-click) and press a key chord on the last one. */
async function selectAndPress(
  page: any,
  names: string[],
  keys: string
): Promise<void> {
  for (let i = 0; i < names.length; i++) {
    const row = item(page, names[i]);
    await row.waitFor({ state: 'visible', timeout: SERVER_TIMEOUT });
    await row.click(i === 0 ? {} : { modifiers: ['Control'] });
  }
  await page.keyboard.press(keys);
}

/** Copy rows inside the archive with Ctrl+C, go to target, paste with Ctrl+V on the row named focus. */
async function copyTo(
  page: any,
  names: string[],
  target: string,
  focus: string,
  copyKey = 'Control+c'
): Promise<void> {
  await selectAndPress(page, names, copyKey);
  await page.filebrowser.openDirectory(target);
  await waitPath(page, target);
  await selectAndPress(page, [focus], 'Control+v');
}

async function browse(request: any, path: string, query = '') {
  return request.get(
    `./jupyterlab-zip/browse?path=${encodeURIComponent(path)}${query}`
  );
}

/** Names under dir, recursively, relative to dir, or null where dir is missing; hidden entries are lab's own. */
async function tree(request: any, dir: string): Promise<string[] | null> {
  const r = await request.get(`./api/contents/${dir}?content=1`);
  if (!r.ok()) {
    return null;
  }
  const out: string[] = [];
  for (const child of (await r.json()).content) {
    if (child.name.startsWith('.')) {
      continue;
    }
    out.push(child.name);
    if (child.type === 'directory') {
      for (const sub of (await tree(request, child.path)) ?? []) {
        out.push(`${child.name}/${sub}`);
      }
    }
  }
  return out.sort();
}

test.describe('Archive browsing', () => {
  test('double-click on a zip lists its top-level entries without opening a tab', async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const before = await mainWidgets(page);
    const docsAdded = await watchDocuments(page);

    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await expectRows(page, TOP);
    expect(await mainWidgets(page)).toBe(before);
    expect(await docsAdded()).toBe(0);
    expect(sha256(await readBytes(request, `${tmpPath}/a.zip`))).toBe(
      sha256(bytes)
    );
  });

  test('Enter on a selected zip enters it', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const before = await mainWidgets(page);
    const docsAdded = await watchDocuments(page);

    await selectAndPress(page, ['a.zip'], 'Enter');

    await waitPath(page, `zip:${tmpPath}/a.zip`);
    await expectRows(page, TOP);
    expect(await mainWidgets(page)).toBe(before);
    expect(await docsAdded()).toBe(0);
  });

  test('breadcrumbs show the archive name and the folder path inside it', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    await open(page, 'dir', `zip:${tmpPath}/a.zip/dir`);

    const crumbs = page.locator('.jp-FileBrowser .jp-BreadCrumbs-item');
    await expect(crumbs.last()).toHaveText('dir');
    await expect(crumbs.last()).toHaveAttribute(
      'data-path',
      `${tmpPath}/a.zip/dir`
    );
    await expect(
      page.locator(
        `.jp-FileBrowser .jp-BreadCrumbs-item[data-path="${tmpPath}/a.zip"]`
      )
    ).toHaveText('a.zip');
  });

  test('enters folders at any depth, including folders that exist only as a path prefix', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await open(page, 'dir', `zip:${tmpPath}/a.zip/dir`);
    await expectRows(page, ['sub', 'x.txt']);
    await open(page, 'sub', `zip:${tmpPath}/a.zip/dir/sub`);
    await expectRows(page, ['y.txt']);

    // implied/ and implied/deep/ have no entry of their own
    await page
      .locator(
        `.jp-FileBrowser .jp-BreadCrumbs-item[data-path="${tmpPath}/a.zip"]`
      )
      .click();
    await waitPath(page, `zip:${tmpPath}/a.zip`);
    await expect(item(page, 'implied')).toHaveAttribute('data-isdir', 'true');
    await open(page, 'implied', `zip:${tmpPath}/a.zip/implied`);
    await expectRows(page, ['deep']);
    await expect(item(page, 'deep')).toHaveAttribute('data-isdir', 'true');
    await open(page, 'deep', `zip:${tmpPath}/a.zip/implied/deep`);
    await expectRows(page, ['z.txt']);
  });

  test('going up or a crumb click above the archive leaves it', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const archive = `zip:${tmpPath}/a.zip`;

    // Going up, from inside a folder and then from the top level
    await open(page, 'a.zip', archive);
    await open(page, 'dir', `${archive}/dir`);
    await selectAndPress(page, ['x.txt'], 'Backspace');
    await waitPath(page, archive);
    await selectAndPress(page, ['top.txt'], 'Backspace');
    await waitPath(page, tmpPath);
    await expect(item(page, 'a.zip')).toBeVisible();

    // A crumb above the archive
    await open(page, 'a.zip', archive);
    await page
      .locator(`.jp-FileBrowser .jp-BreadCrumbs-item[data-path="${tmpPath}"]`)
      .click();
    await waitPath(page, tmpPath);

    // The home crumb
    await open(page, 'a.zip', archive);
    await open(page, 'dir', `${archive}/dir`);
    await page.locator('.jp-FileBrowser .jp-BreadCrumbs-home').click();
    await waitPath(page, '');
    await expect(item(page, tmpPath)).toBeVisible();
    await expect(page.locator('.jp-Dialog')).toHaveCount(0);
  });

  test('entries show name, uncompressed size and modified time from the archive', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    await expectRows(page, TOP);

    const big = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const fb = Array.from(app.shell.widgets('left') as any[]).find(
        w => w.id === 'filebrowser'
      );
      const model = Array.from(fb.model.items() as any[]).find(
        m => m.name === 'big.txt'
      );
      return {
        size: model.size,
        last_modified: model.last_modified,
        // Time.format of the member date_time, which is local wall-clock time
        shown: new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(new Date(2020, 0, 2, 3, 4, 6))
      };
    });
    expect(big.size).toBe(5000);
    expect(big.last_modified).toBe('2020-01-02T03:04:06');
    // 5000 bytes is 4.9 KB; the deflated member is about 20 B
    await expect(item(page, 'big.txt')).toHaveAttribute(
      'title',
      /Size: 4\.9 KB/
    );
    const title = await item(page, 'big.txt').getAttribute('title');
    expect(title).toContain(`Modified: ${big.shown}`);
    expect(title).toContain('Writable: false');
  });

  test('opens a text file and a notebook read-only in their usual viewers', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    const current = () =>
      page.evaluate(() => {
        const w = (window as any).jupyterapp.shell.currentWidget;
        const ctx = w?.context;
        if (!ctx?.isReady) {
          return null;
        }
        const notebook = w.node.classList.contains('jp-NotebookPanel');
        return {
          path: ctx.path,
          editor: !!w.node.querySelector('.jp-FileEditor'),
          notebook,
          writable: ctx.contentsModel.writable,
          text: ctx.model.toString(),
          cells: notebook
            ? ctx.model
                .toJSON()
                .cells.map((c: any) => [].concat(c.source).join(''))
            : null
        };
      });

    await item(page, 'top.txt').dblclick();
    await expect
      .poll(async () => (await current())?.path, { timeout: SERVER_TIMEOUT })
      .toBe(`zip:${tmpPath}/a.zip/top.txt`);
    const text = (await current())!;
    expect(text.editor).toBe(true);
    expect(text.writable).toBe(false);
    expect(text.text).toBe('top text');

    await item(page, 'nb.ipynb').dblclick();
    await expect
      .poll(async () => (await current())?.path, { timeout: SERVER_TIMEOUT })
      .toBe(`zip:${tmpPath}/a.zip/nb.ipynb`);
    const nb = (await current())!;
    expect(nb.notebook).toBe(true);
    expect(nb.writable).toBe(false);
    expect(nb.cells).toEqual(['archived notebook']);
  });

  test('Save on a file opened from the archive shows an error and writes nothing', async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = await fixture(request, tmpPath);
    const before = await tree(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    await item(page, 'top.txt').dblclick();
    const editor = page.locator('.jp-FileEditor .cm-content');
    await editor.waitFor({ timeout: SERVER_TIMEOUT });
    await editor.click();
    await page.keyboard.type('changed ');

    // Not awaited: the command resolves only when its dialog closes
    await page.evaluate(() => {
      void (window as any).jupyterapp.commands.execute('docmanager:save');
    });
    const dialog = page.locator('.jp-Dialog');
    await expect(dialog).toContainText('Document is read-only', {
      timeout: SERVER_TIMEOUT
    });
    await expect(dialog.locator('.jp-Dialog-header')).toHaveText('Cannot Save');
    await dialog.locator('.jp-Dialog-button.jp-mod-accept').click();

    // A save that reaches the drive is refused as well
    const refused = await page.evaluate(
      async path =>
        (window as any).jupyterapp.serviceManager.contents
          .save(path, { type: 'file', format: 'text', content: 'x' })
          .then(
            () => 'saved',
            (e: Error) => e.message
          ),
      `zip:${tmpPath}/a.zip/top.txt`
    );
    expect(refused).toBe('The archive is read-only');
    expect(sha256(await readBytes(request, `${tmpPath}/a.zip`))).toBe(
      sha256(bytes)
    );
    expect(await tree(request, tmpPath)).toEqual(before);
  });

  test('rename, delete, new file, new folder, upload, paste and duplicate are refused', async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = await fixture(request, tmpPath);
    await putFile(request, `${tmpPath}/outside.txt`, 'outside');
    const before = await tree(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const archive = `zip:${tmpPath}/a.zip`;
    const run = (command: string) =>
      page.evaluate(
        (c: string) =>
          (window as any).jupyterapp.commands.execute(c).then(
            () => 'done',
            (e: Error) => `refused: ${e.message}`
          ),
        command
      );

    // Paste into the archive: JupyterLab's own copy between drives throws
    await selectAndPress(page, ['outside.txt'], 'Control+c');
    await open(page, 'a.zip', archive);
    await selectAndPress(page, ['top.txt'], 'Control+v');

    // Paste inside the archive and duplicate reach the drive's copy
    await selectAndPress(page, ['top.txt'], 'Control+c');
    await page.keyboard.press('Control+v');
    await dismissError(page, 'Paste Error');
    await selectAndPress(page, ['top.txt'], 'Control+d');
    await dismissError(page, 'Duplicate file');

    // Rename
    await selectAndPress(page, ['top.txt'], 'F2');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('renamed.txt');
    await page.keyboard.press('Enter');
    await dismissError(page, 'Rename Error');

    // Delete, after the confirmation
    await selectAndPress(page, ['top.txt'], 'Delete');
    await page.locator('.jp-Dialog .jp-mod-accept').click();
    await dismissError(page, 'Delete Failed');

    // New file and new folder reach the drive, not the archive file on the normal drive
    for (const command of [
      'filebrowser:create-new-file',
      'filebrowser:create-new-directory'
    ]) {
      expect(await run(command)).toBe('refused: The archive is read-only');
      await dismissError(page, 'Error');
    }

    // Upload, through the model the upload button uses
    const upload = await page.evaluate(async () => {
      const app = (window as any).jupyterapp;
      const fb = Array.from(app.shell.widgets('left') as any[]).find(
        w => w.id === 'filebrowser'
      );
      return fb.model.upload(new File(['up'], 'up.txt')).then(
        () => 'uploaded',
        (e: Error) => e.message
      );
    });
    expect(upload).toBe('The archive is read-only');

    await expectRows(page, TOP);
    const listing = await (await browse(request, `${tmpPath}/a.zip`)).json();
    expect(listing.content.map((c: any) => c.name).sort()).toEqual(TOP);
    expect(sha256(await readBytes(request, `${tmpPath}/a.zip`))).toBe(
      sha256(bytes)
    );
    expect(await tree(request, tmpPath)).toEqual(before);
  });

  test('Download on a file inside the archive saves the member bytes', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    await open(page, 'dir', `zip:${tmpPath}/a.zip/dir`);

    const download = page.waitForEvent('download');
    await item(page, 'x.txt').click({ button: 'right' });
    await page.locator('.lm-Menu-itemLabel', { hasText: /^Download$/ }).click();
    const saved = await download;

    expect(saved.suggestedFilename()).toBe('x.txt');
    expect(readFileSync(await saved.path())).toEqual(Buffer.from('x text'));
  });

  test('reload inside an archive shows no error dialog', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const inside = `zip:${tmpPath}/a.zip/dir`;
    // The browser path reaches the workspace (galata keeps it across the reload)
    const saved = page.waitForRequest(
      r =>
        r.method() === 'PUT' &&
        r.url().includes('/api/workspaces') &&
        (r.postData() ?? '').includes(inside),
      { timeout: SERVER_TIMEOUT }
    );
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    await open(page, 'dir', inside);
    await saved;

    await page.reload();
    await page.evaluate(async () => {
      const app = (window as any).jupyterapp;
      const fb = Array.from(app.shell.widgets('left') as any[]).find(
        w => w.id === 'filebrowser'
      );
      await fb.model.restored;
    });

    // The page URL names the folder holding the archive (a zip path there cannot be reopened);
    // a restore from the saved browser path alone stays inside
    await expect
      .poll(async () => [tmpPath, inside].includes(await browserPath(page)), {
        timeout: SERVER_TIMEOUT
      })
      .toBe(true);
    const path = await browserPath(page);
    await expectRows(page, path === inside ? ['sub', 'x.txt'] : ['a.zip']);
    await expect(page.locator('.jp-Dialog')).toHaveCount(0);
    expect(page.url()).not.toContain('zip%3A');
  });

  test('an invalid zip shows an error dialog and the browser stays in its folder', async ({
    page,
    tmpPath,
    request
  }) => {
    await putFile(request, `${tmpPath}/bad.zip`, 'this is not a zip archive');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const before = await mainWidgets(page);
    const docsAdded = await watchDocuments(page);

    await item(page, 'bad.zip').dblclick();

    await expect(page.locator('.jp-Dialog')).toContainText(
      'Not a valid zip archive',
      { timeout: SERVER_TIMEOUT }
    );
    await dismissError(page, 'Open Archive');
    expect(await browserPath(page)).toBe(tmpPath);
    expect(await mainWidgets(page)).toBe(before);
    expect(await docsAdded()).toBe(0);
  });

  test('spaces and non-ASCII letters work for enter, open and copy', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(
      request,
      tmpPath,
      [['dír ü/fïle ä.txt', 'unicode text']],
      'my ärchive.zip'
    );
    await putFile(request, `${tmpPath}/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const archive = `zip:${tmpPath}/my ärchive.zip`;

    await open(page, 'my ärchive.zip', archive);
    await open(page, 'dír ü', `${archive}/dír ü`);
    await item(page, 'fïle ä.txt').dblclick();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as any
              ).jupyterapp.shell.currentWidget?.context?.model?.toString() ??
              null
          ),
        { timeout: SERVER_TIMEOUT }
      )
      .toBe('unicode text');

    await copyTo(page, ['fïle ä.txt'], tmpPath, 'keep.txt');
    await expect
      .poll(() => readBytes(request, `${tmpPath}/fïle ä.txt`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(Buffer.from('unicode text'));
  });

  test('a zip inside an archive is listed as a file and copies out', async ({
    page,
    tmpPath,
    request
  }) => {
    const inner = zipBytes([['in.txt', 'inner']]);
    await fixture(request, tmpPath, [
      ['inner.zip', inner],
      ['top.txt', 'top']
    ]);
    await putFile(request, `${tmpPath}/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await expect(item(page, 'inner.zip')).toHaveAttribute(
      'data-isdir',
      'false'
    );

    await copyTo(page, ['inner.zip'], tmpPath, 'keep.txt');
    await expect
      .poll(() => readBytes(request, `${tmpPath}/inner.zip`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(inner);
  });

  test('Create Archive and Extract Archive are not in the context menu inside an archive', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath, [
      ['inner.zip', zipBytes([['in.txt', 'inner']])],
      ['top.txt', 'top text']
    ]);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    /** Labels shown in the context menu on a row, then close it. */
    const menu = async (name: string): Promise<string[]> => {
      await item(page, name).click({ button: 'right' });
      // A menu keeps an item whose command is not visible in the page, hidden
      const labels = page.locator('.lm-Menu .lm-Menu-itemLabel:visible');
      await expect(labels.filter({ hasText: /^Copy$/ }).first()).toBeVisible();
      const texts = (await labels.allInnerTexts()).map(t => t.trim());
      await page.keyboard.press('Escape');
      await expect(page.locator('.lm-Menu')).toHaveCount(0);
      return texts;
    };

    // In a normal folder both commands are offered for a zip
    expect(await menu('a.zip')).toEqual(
      expect.arrayContaining(['Create Archive', 'Extract Archive'])
    );

    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);
    for (const name of ['inner.zip', 'top.txt']) {
      const labels = await menu(name);
      expect(labels, name).not.toContain('Create Archive');
      expect(labels, name).not.toContain('Extract Archive');
    }
  });

  test("double-click or Enter on a zip inside an archive shows 'Copy it out to browse it' and opens no tab", async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath, [
      ['inner.zip', zipBytes([['in.txt', 'inner']])],
      ['top.txt', 'top text']
    ]);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    const archive = `zip:${tmpPath}/a.zip`;
    await open(page, 'a.zip', archive);
    const before = await mainWidgets(page);
    const docsAdded = await watchDocuments(page);

    await item(page, 'inner.zip').dblclick();
    await expect(page.locator('.jp-Dialog')).toContainText(
      'Copy it out to browse it',
      { timeout: SERVER_TIMEOUT }
    );
    await dismissError(page, 'Open Archive');
    await selectAndPress(page, ['inner.zip'], 'Enter');
    await expect(page.locator('.jp-Dialog')).toContainText(
      'Copy it out to browse it',
      { timeout: SERVER_TIMEOUT }
    );
    await dismissError(page, 'Open Archive');

    expect(await browserPath(page)).toBe(archive);
    expect(await mainWidgets(page)).toBe(before);
    expect(await docsAdded()).toBe(0);
  });

  test('a notebook opened from an archive starts no kernel', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await item(page, 'nb.ipynb').dblclick();
    // The kernel preference is applied when the session context initializes, after the notebook loads
    const session = await page.evaluate(async () => {
      const shell = (window as any).jupyterapp.shell;
      for (let i = 0; i < 300; i++) {
        const w = shell.currentWidget;
        if (
          w?.node.classList.contains('jp-NotebookPanel') &&
          w.context.isReady
        ) {
          await w.sessionContext.ready;
          return {
            path: w.context.path,
            session: w.sessionContext.session?.id ?? null
          };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return null;
    });
    expect(session).toEqual({
      path: `zip:${tmpPath}/a.zip/nb.ipynb`,
      session: null
    });
    // Give a kernel start time to land before asserting that none did
    await page.waitForTimeout(2000);
    const sessions = await (await request.get('./api/sessions')).json();
    expect(
      sessions.filter((s: any) => `${s.path} ${s.name}`.includes('nb.ipynb'))
    ).toEqual([]);
  });

  test('a member over 100 MB shows an error to copy it out, and Copy and Download still work', async ({
    page,
    tmpPath,
    request
  }) => {
    // 100 MB + 1 byte of zeros deflates to about 100 KB
    const size = 100 * 1024 * 1024 + 1;
    const zeros = Buffer.alloc(size);
    // a member whose central directory claims the same size for its 4 bytes: a server that read it would answer 200
    const liar = zipBytes([['liar.txt', 'tiny']]);
    liar.writeUInt32LE(size, 22);
    liar.writeUInt32LE(size, liar.indexOf(Buffer.from('PK\x01\x02')) + 24);
    await fixture(request, tmpPath, [
      ['huge.txt', zeros],
      ['top.txt', 'top text']
    ]);
    await putBytes(request, `${tmpPath}/liar.zip`, liar);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    const message =
      'The member is over 100 MB; copy it out of the archive to open it';
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await item(page, 'huge.txt').dblclick();
    await expect(page.locator('.jp-Dialog')).toContainText(message, {
      timeout: SERVER_TIMEOUT
    });
    await dismissError(page, 'File Load Error for huge.txt');
    const r = await browse(request, `${tmpPath}/liar.zip/liar.txt`);
    expect([r.status(), (await r.json()).message]).toEqual([400, message]);

    // Copy and Paste
    await copyTo(page, ['huge.txt'], `${tmpPath}/out`, 'keep.txt');
    await expect
      .poll(
        async () => {
          const m = await request.get(
            `./api/contents/${tmpPath}/out/huge.txt?content=0`
          );
          return m.ok() ? (await m.json()).size : null;
        },
        { timeout: SERVER_TIMEOUT }
      )
      .toBe(size);

    // Download, through the URL the drive gives for it
    const url = await page.evaluate(
      path =>
        (window as any).jupyterapp.serviceManager.contents.getDownloadUrl(path),
      `zip:${tmpPath}/a.zip/huge.txt`
    );
    const download = await request.get(url);
    expect(download.status()).toBe(200);
    const bytes = await download.body();
    expect(bytes.length).toBe(size);
    expect(sha256(bytes)).toBe(sha256(zeros));
  });

  test("a zip whose members have an invalid DOS date enters and shows the archive's own time", async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = zipBytes([
      ['t.txt', 'hello'],
      ['d/u.txt', 'u'],
      ['w.txt', 'w'],
      ['ok.txt', 'ok']
    ]);
    // [date, time] per member: DOS date 0 (month 0, day 0); a time of 31:63:62; ok.txt keeps 2020-01-02 03:04:06
    const stamps = [
      [0, 0],
      [0, 0],
      [((2020 - 1980) << 9) | (1 << 5) | 2, (31 << 11) | (63 << 5) | 31]
    ];
    const at = (signature: string) => {
      const out: number[] = [];
      for (
        let i = bytes.indexOf(signature);
        i >= 0;
        i = bytes.indexOf(signature, i + 1)
      ) {
        out.push(i);
      }
      return out;
    };
    const local = at('PK\x03\x04');
    const central = at('PK\x01\x02');
    stamps.forEach(([date, time], i) => {
      bytes.writeUInt16LE(time, local[i] + 10);
      bytes.writeUInt16LE(date, local[i] + 12);
      bytes.writeUInt16LE(time, central[i] + 12);
      bytes.writeUInt16LE(date, central[i] + 14);
    });
    await putBytes(request, `${tmpPath}/date.zip`, bytes);
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);

    await open(page, 'date.zip', `zip:${tmpPath}/date.zip`);
    await expectRows(page, ['d', 'ok.txt', 't.txt', 'w.txt']);
    const archive = await (
      await request.get(`./api/contents/${tmpPath}/date.zip?content=0`)
    ).json();
    const times = await page.evaluate(() => {
      const app = (window as any).jupyterapp;
      const fb = Array.from(app.shell.widgets('left') as any[]).find(
        w => w.id === 'filebrowser'
      );
      return Object.fromEntries(
        Array.from(fb.model.items() as any[]).map(m => [
          m.name,
          m.last_modified
        ])
      );
    });
    const ms = (t: string) => new Date(t).getTime();
    for (const name of ['t.txt', 'w.txt', 'd']) {
      expect(ms(times[name]), name).toBe(ms(archive.last_modified));
    }
    expect(times['ok.txt']).toBe('2020-01-02T03:04:06');

    // the listing and the member answer 200, and the member opens
    expect((await browse(request, `${tmpPath}/date.zip`)).status()).toBe(200);
    expect((await browse(request, `${tmpPath}/date.zip/t.txt`)).status()).toBe(
      200
    );
    await item(page, 't.txt').dblclick();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as any
              ).jupyterapp.shell.currentWidget?.context?.model?.toString() ??
              null
          ),
        { timeout: SERVER_TIMEOUT }
      )
      .toBe('hello');
  });
});

test.describe('Copy out', () => {
  test('Copy and Paste write a file from the archive with the same bytes', async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = await fixture(request, tmpPath);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await copyTo(page, ['big.txt'], `${tmpPath}/out`, 'keep.txt');

    await expect
      .poll(() => readBytes(request, `${tmpPath}/out/big.txt`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(Buffer.from('a'.repeat(5000)));
    await expect(page.locator('.jp-Dialog')).toHaveCount(0);
    expect(sha256(await readBytes(request, `${tmpPath}/a.zip`))).toBe(
      sha256(bytes)
    );
  });

  test('a folder is written with all its members, including empty folders', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath, [
      ['proj/a.txt', 'a'],
      ['proj/sub/b.txt', 'b'],
      ['proj/empty/', ''],
      ['proj/deep/x/c.txt', 'c'],
      ['other.txt', 'other']
    ]);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await copyTo(page, ['proj'], `${tmpPath}/out`, 'keep.txt');

    await expect
      .poll(() => tree(request, `${tmpPath}/out/proj`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual([
        'a.txt',
        'deep',
        'deep/x',
        'deep/x/c.txt',
        'empty',
        'sub',
        'sub/b.txt'
      ]);
    expect(
      await readBytes(request, `${tmpPath}/out/proj/deep/x/c.txt`)
    ).toEqual(Buffer.from('c'));
  });

  test('one Paste writes every selected item', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    // Copy from the context menu, paste from the context menu
    await item(page, 'top.txt').click();
    await item(page, 'dir').click({ modifiers: ['Control'] });
    await item(page, 'nb.ipynb').click({ modifiers: ['Control'] });
    await item(page, 'nb.ipynb').click({ button: 'right' });
    await page.locator('.lm-Menu-itemLabel', { hasText: /^Copy$/ }).click();
    await page.filebrowser.openDirectory(`${tmpPath}/out`);
    await item(page, 'keep.txt').click({ button: 'right' });
    await page.locator('.lm-Menu-itemLabel', { hasText: /^Paste$/ }).click();

    await expect
      .poll(() => tree(request, `${tmpPath}/out`), { timeout: SERVER_TIMEOUT })
      .toEqual([
        'dir',
        'dir/sub',
        'dir/sub/y.txt',
        'dir/x.txt',
        'keep.txt',
        'nb.ipynb',
        'top.txt'
      ]);
    // type=file reads a notebook's bytes; without it the contents API parses the notebook
    const copied = ['top.txt', 'dir/x.txt', 'dir/sub/y.txt', 'nb.ipynb'];
    for (const [name, text] of ENTRIES.filter(([n]) => copied.includes(n))) {
      const r = await request.get(
        `./api/contents/${tmpPath}/out/${name}?content=1&type=file&format=base64`
      );
      expect(
        Buffer.from((await r.json()).content, 'base64').toString(),
        name
      ).toBe(text);
    }
  });

  test('a name clash writes name-Copy1.ext and keeps the existing file', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/top.txt`, 'existing');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await copyTo(page, ['top.txt'], `${tmpPath}/out`, 'top.txt');

    await expect
      .poll(() => readBytes(request, `${tmpPath}/out/top-Copy1.txt`), {
        timeout: SERVER_TIMEOUT
      })
      .toEqual(Buffer.from('top text'));
    expect(await readBytes(request, `${tmpPath}/out/top.txt`)).toEqual(
      Buffer.from('existing')
    );
    expect((await listDir(request, `${tmpPath}/out`))!.sort()).toEqual([
      'top-Copy1.txt',
      'top.txt'
    ]);
  });

  test('Cut and Paste change neither the archive nor the folder', async ({
    page,
    tmpPath,
    request
  }) => {
    const bytes = await fixture(request, tmpPath);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await copyTo(page, ['top.txt'], `${tmpPath}/out`, 'keep.txt', 'Control+x');
    // Give a paste time to land before asserting that none did
    await page.waitForTimeout(2000);

    expect(await listDir(request, `${tmpPath}/out`)).toEqual(['keep.txt']);
    expect(sha256(await readBytes(request, `${tmpPath}/a.zip`))).toBe(
      sha256(bytes)
    );
    const listing = await (await browse(request, `${tmpPath}/a.zip`)).json();
    expect(listing.content.map((c: any) => c.name).sort()).toEqual(TOP);
  });

  test('the target folder lists pasted items without waiting for the poll', async ({
    page,
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    await putDir(request, `${tmpPath}/out`);
    await putFile(request, `${tmpPath}/out/keep.txt`, 'keep');
    await page.goto();
    await page.filebrowser.openDirectory(tmpPath);
    await open(page, 'a.zip', `zip:${tmpPath}/a.zip`);

    await selectAndPress(page, ['top.txt'], 'Control+c');
    await page.filebrowser.openDirectory(`${tmpPath}/out`);
    await waitPath(page, `${tmpPath}/out`);
    await stopBrowserPoll(page);
    await selectAndPress(page, ['keep.txt'], 'Control+v');

    // The poll is stopped and the test triggers no refresh: only the copy's change signal shows the row
    await expect(item(page, 'top.txt')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Archive listing endpoint', () => {
  test('returns one folder level as a contents model and writes nothing to disk', async ({
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    const before = await tree(request, '');

    const r = await browse(request, `${tmpPath}/a.zip`);
    expect(r.status()).toBe(200);
    const model = await r.json();
    expect(model).toMatchObject({
      type: 'directory',
      name: 'a.zip',
      path: `${tmpPath}/a.zip`,
      writable: false
    });
    expect(model.content.map((c: any) => c.name).sort()).toEqual(TOP);
    for (const child of model.content) {
      for (const key of ['type', 'name', 'path', 'size', 'last_modified']) {
        expect(child, `${child.name} ${key}`).toHaveProperty(key);
      }
      expect(child.path).toBe(`${tmpPath}/a.zip/${child.name}`);
      expect(child.content).toBeNull();
    }
    const byName = Object.fromEntries(
      model.content.map((c: any) => [c.name, c])
    );
    expect(byName['dir'].type).toBe('directory');
    expect(byName['implied'].type).toBe('directory');
    expect(byName['nb.ipynb'].type).toBe('notebook');
    expect(byName['top.txt']).toMatchObject({ type: 'file', size: 8 });

    const dir = await (await browse(request, `${tmpPath}/a.zip/dir`)).json();
    expect(dir.content.map((c: any) => c.name).sort()).toEqual([
      'sub',
      'x.txt'
    ]);
    const file = await (
      await browse(request, `${tmpPath}/a.zip/dir/x.txt`, '&format=text')
    ).json();
    expect(file).toMatchObject({
      type: 'file',
      content: 'x text',
      writable: false
    });

    expect(await tree(request, '')).toEqual(before);
  });

  test('absolute and .. members are never listed, opened or written', async ({
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath, [
      ['ok.txt', 'ok'],
      ['../evil.txt', 'evil'],
      ['/abs.txt', 'abs'],
      ['d/ok2.txt', 'ok2'],
      ['d/../../evil2.txt', 'evil2']
    ]);
    await putDir(request, `${tmpPath}/out`);
    const names = async (path: string) =>
      (await (await browse(request, path)).json()).content
        .map((c: any) => c.name)
        .sort();

    expect(await names(`${tmpPath}/a.zip`)).toEqual(['d', 'ok.txt']);
    expect(await names(`${tmpPath}/a.zip/d`)).toEqual(['ok2.txt']);
    for (const path of [
      `${tmpPath}/a.zip/../evil.txt`,
      `${tmpPath}/a.zip/evil.txt`,
      `${tmpPath}/a.zip/abs.txt`,
      `${tmpPath}/a.zip/evil2.txt`
    ]) {
      expect((await browse(request, path)).status(), path).toBe(404);
      const member = await request.get(
        `./jupyterlab-zip/member?path=${encodeURIComponent(path)}`
      );
      expect(member.status(), path).toBe(404);
    }

    const copied = await request.post('./jupyterlab-zip/copy', {
      data: { path: `${tmpPath}/a.zip/d`, to_dir: `${tmpPath}/out` }
    });
    expect(copied.status()).toBe(201);
    expect(await tree(request, `${tmpPath}/out`)).toEqual(['d', 'd/ok2.txt']);
    expect(await tree(request, tmpPath)).toEqual([
      'a.zip',
      'out',
      'out/d',
      'out/d/ok2.txt'
    ]);
    const root = (await listDir(request, ''))!;
    for (const name of ['evil.txt', 'evil2.txt', 'abs.txt']) {
      expect(root).not.toContain(name);
    }
  });

  test('answers 403 outside the server root and 404 for a missing archive or member', async ({
    tmpPath,
    request
  }) => {
    await fixture(request, tmpPath);
    const member = (path: string) =>
      request.get(`./jupyterlab-zip/member?path=${encodeURIComponent(path)}`);
    const copy = (path: string, to_dir: string) =>
      request.post('./jupyterlab-zip/copy', { data: { path, to_dir } });

    for (const path of [
      '../outside.zip',
      `${tmpPath}/../../outside.zip/a.txt`
    ]) {
      expect((await browse(request, path)).status(), path).toBe(403);
      expect((await member(path)).status(), path).toBe(403);
      expect((await copy(path, tmpPath)).status(), path).toBe(403);
    }
    expect((await copy(`${tmpPath}/a.zip/top.txt`, '..')).status()).toBe(403);

    for (const path of [
      `${tmpPath}/missing.zip`,
      `${tmpPath}/a.zip/missing.txt`
    ]) {
      expect((await browse(request, path)).status(), path).toBe(404);
      expect((await member(path)).status(), path).toBe(404);
      expect((await copy(path, tmpPath)).status(), path).toBe(404);
    }
    expect((await member(`${tmpPath}/a.zip/top.txt`)).status()).toBe(200);
  });

  test('damaged, encrypted and unsupported members answer 400 and a failed copy leaves nothing in the target', async ({
    tmpPath,
    request
  }) => {
    const good = zipBytes([['t.txt', 'hello world '.repeat(200)]]);
    const central = good.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    const variant = (edit: (b: Buffer) => void): Buffer => {
      const b = Buffer.from(good);
      edit(b);
      return b;
    };
    // each edit hits one zipfile error: zlib.error, bad CRC, encrypted flag, compression method 99
    const archives: Record<string, Buffer> = {
      'deflate.zip': variant(b => {
        // the deflate stream starts after the 30-byte local header and the 5-byte name
        for (let i = 35; i < 45; i++) {
          b[i] ^= 0xff;
        }
      }),
      'crc.zip': variant(b => {
        b[14] ^= 1;
        b[central + 16] ^= 1;
      }),
      'encrypted.zip': variant(b => {
        b[6] |= 1;
        b[central + 8] |= 1;
      }),
      'method.zip': variant(b => {
        b.writeUInt16LE(99, 8);
        b.writeUInt16LE(99, central + 10);
      })
    };
    await putDir(request, `${tmpPath}/out`);
    const copy = (path: string) =>
      request.post('./jupyterlab-zip/copy', {
        data: { path, to_dir: `${tmpPath}/out` }
      });
    const got: Record<string, unknown> = {};
    const want: Record<string, unknown> = {};
    for (const [name, bytes] of Object.entries(archives)) {
      await putBytes(request, `${tmpPath}/${name}`, bytes);
      const path = `${tmpPath}/${name}/t.txt`;
      got[name] = [
        (await browse(request, path)).status(),
        (
          await request.get(
            `./jupyterlab-zip/member?path=${encodeURIComponent(path)}`
          )
        ).status(),
        (await copy(path)).status(),
        await tree(request, `${tmpPath}/out`)
      ];
      want[name] = [400, 400, 400, []];
    }
    // a file p/a beside p/a/b cannot be written as a folder tree
    await fixture(
      request,
      tmpPath,
      [
        ['p/a', 'file a'],
        ['p/a/b', 'file b']
      ],
      'clash.zip'
    );
    got['clash.zip'] = [
      (await copy(`${tmpPath}/clash.zip/p`)).status(),
      await tree(request, `${tmpPath}/out`)
    ];
    want['clash.zip'] = [400, []];

    expect(got).toEqual(want);
  });

  test('a member name the file system refuses answers 400 and a failed copy leaves nothing in the target', async ({
    tmpPath,
    request
  }) => {
    // 300 bytes, over the 255-byte name limit of the server's file system
    const long = `${'n'.repeat(300)}.txt`;
    await fixture(
      request,
      tmpPath,
      [
        [long, 'long'],
        [`d/${long}`, 'long2']
      ],
      'long.zip'
    );
    await putDir(request, `${tmpPath}/out`);
    const copy = async (path: string) =>
      (
        await request.post('./jupyterlab-zip/copy', {
          data: { path, to_dir: `${tmpPath}/out` }
        })
      ).status();
    expect([
      await copy(`${tmpPath}/long.zip/${long}`),
      await copy(`${tmpPath}/long.zip/d`),
      await tree(request, `${tmpPath}/out`)
    ]).toEqual([400, 400, []]);
  });
});
