import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { createHash } from 'crypto';
import { crc32, deflateRawSync } from 'zlib';

/** Timeout for waits that follow a server round-trip (zip, unzip, contents listing). */
export const SERVER_TIMEOUT = 30000;

export const SPINNER_TITLE = 'Zip Extension';
export const CREATING = 'Creating archive...';
export const EXTRACTING = 'Extracting archive...';

/** Write a text file through the contents API. */
export async function putFile(
  request: APIRequestContext,
  path: string,
  content: string
): Promise<void> {
  const r = await request.put(`./api/contents/${path}`, {
    data: { type: 'file', format: 'text', content }
  });
  expect(r.ok(), `PUT ${path}`).toBeTruthy();
}

/** Create a directory through the contents API. */
export async function putDir(
  request: APIRequestContext,
  path: string
): Promise<void> {
  const r = await request.put(`./api/contents/${path}`, {
    data: { type: 'directory' }
  });
  expect(r.ok(), `PUT ${path}`).toBeTruthy();
}

/** Visible names in a directory, or null where the directory is missing. */
export async function listDir(
  request: APIRequestContext,
  path: string
): Promise<string[] | null> {
  const r = await request.get(`./api/contents/${path}?content=1`);
  if (!r.ok()) {
    return null;
  }
  // Hidden entries (.ipynb_checkpoints) are lab's own, not the extension's
  return (await r.json()).content
    .map((c: { name: string }) => c.name)
    .filter((n: string) => !n.startsWith('.'));
}

/** Delete a file or a directory with everything in it (the contents API refuses non-empty directories). */
export async function removeTree(
  request: APIRequestContext,
  path: string
): Promise<void> {
  const r = await request.get(`./api/contents/${path}?content=1`);
  if (!r.ok()) {
    return;
  }
  const meta = await r.json();
  if (meta.type === 'directory') {
    for (const child of meta.content) {
      await removeTree(request, child.path);
    }
  }
  const del = await request.delete(`./api/contents/${path}`);
  expect(del.ok(), `DELETE ${path}`).toBeTruthy();
}

export async function readText(
  request: APIRequestContext,
  path: string
): Promise<string | null> {
  const r = await request.get(`./api/contents/${path}?content=1&format=text`);
  return r.ok() ? (await r.json()).content : null;
}

export async function exists(
  request: APIRequestContext,
  path: string
): Promise<boolean> {
  const r = await request.get(`./api/contents/${path}?content=0`);
  return r.ok();
}

/** Raw bytes of a file, through the contents API. */
export async function readBytes(
  request: APIRequestContext,
  path: string
): Promise<Buffer | null> {
  const r = await request.get(`./api/contents/${path}?content=1&format=base64`);
  return r.ok() ? Buffer.from((await r.json()).content, 'base64') : null;
}

/**
 * Entry names of a zip file on the server, read from the central directory.
 * Null where the zip is missing or still being written (no end record yet), so polling callers retry.
 */
export async function zipEntries(
  request: APIRequestContext,
  path: string
): Promise<string[] | null> {
  const buf = await readBytes(request, path);
  if (!buf || buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) < 0) {
    return null;
  }
  return entriesOf(buf);
}

/** Entry names from the central directory of zip bytes. */
export function entriesOf(buf: Buffer): string[] {
  // End-of-central-directory record: signature 0x06054b50, no comment in these archives
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd, 'zip end record').toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    names.push(buf.toString('utf8', pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return names.sort();
}

/** POST to a zip extension endpoint; returns status and parsed body (null if not JSON). */
export async function callApi(
  request: APIRequestContext,
  endpoint: 'zip' | 'unzip',
  data?: unknown
): Promise<{ status: number; body: any }> {
  const r = await request.post(`./jupyterlab-zip/${endpoint}`, { data });
  let body: any = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status(), body };
}

/** A file-browser row by exact name. */
export function item(page: Page, name: string): Locator {
  return page.locator('.jp-DirListing-item').filter({
    has: page.locator('.jp-DirListing-itemText', {
      hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
    })
  });
}

/** Select rows by name (Ctrl-click adds), then right-click the last one. */
export async function selectAndOpenMenu(
  page: Page,
  names: string[]
): Promise<void> {
  for (let i = 0; i < names.length; i++) {
    const row = item(page, names[i]);
    await row.waitFor({ state: 'visible', timeout: SERVER_TIMEOUT });
    await row.click(i === 0 ? {} : { modifiers: ['Control'] });
  }
  await item(page, names[names.length - 1]).click({ button: 'right' });
}

export function menuEntry(page: Page, label: string): Locator {
  return page.locator('.lm-Menu-itemLabel', { hasText: label });
}

/** Select rows, run Create Archive from the context menu, name the archive, accept. */
export async function createArchive(
  page: Page,
  names: string[],
  archiveName?: string
): Promise<void> {
  await selectAndOpenMenu(page, names);
  await menuEntry(page, 'Create Archive').click();
  const input = page.locator('.jp-Dialog input');
  await input.waitFor({ state: 'visible' });
  if (archiveName !== undefined) {
    await input.fill(archiveName);
  }
  await page.locator('.jp-Dialog .jp-mod-accept').click();
}

/** Select one zip, run Extract Archive from the context menu. */
export async function extractArchive(page: Page, name: string): Promise<void> {
  await selectAndOpenMenu(page, [name]);
  await menuEntry(page, 'Extract Archive').click();
}

/** Wait until the spinner dialog with this message has opened and closed. */
export async function spinnerCycle(page: Page, message: string): Promise<void> {
  const spinner = page.locator('.jp-Dialog', { hasText: message });
  await expect(spinner).toBeVisible({ timeout: SERVER_TIMEOUT });
  await expect(spinner.locator('.jp-Dialog-header')).toHaveText(SPINNER_TITLE);
  await expect(spinner).toBeHidden({ timeout: SERVER_TIMEOUT });
}

/** Delay a zip extension endpoint so the spinner is observable. */
export async function delayEndpoint(
  page: Page,
  endpoint: 'zip' | 'unzip',
  ms = 1500
): Promise<void> {
  await page.route(`**/jupyterlab-zip/${endpoint}`, async route => {
    await new Promise(resolve => setTimeout(resolve, ms));
    await route.continue();
  });
}

/**
 * Stop the file browser's own 10 s directory poll, so that only the
 * extension's model.refresh() can make a new row appear.
 */
export async function stopBrowserPoll(page: Page): Promise<void> {
  const stopped = await page.evaluate(async () => {
    const app = (window as any).jupyterapp;
    for (const w of app.shell.widgets('left')) {
      if (w.model?._poll) {
        await w.model._poll.stop();
        return true;
      }
    }
    return false;
  });
  expect(stopped, 'file browser poll stopped').toBe(true);
}

/**
 * Zip bytes with exactly these entries, in order; a name ending in / is a folder entry.
 * Members are deflated and dated 2020-01-02 03:04:06; names are flagged UTF-8.
 * Unlike the zip endpoint, any name can be written, including ../ and absolute names.
 */
export function zipBytes(entries: [string, string | Buffer][]): Buffer {
  const time = (3 << 11) | (4 << 5) | (6 >> 1);
  const date = ((2020 - 1980) << 9) | (1 << 5) | 2;
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content);
    const packed = deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc32(data), 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    head.copy(dir, 6, 4, 30); // version needed .. extra length
    dir.writeUInt32LE(offset, 42);
    local.push(head, nameBuf, packed);
    central.push(dir, nameBuf);
    offset += head.length + nameBuf.length + packed.length;
  }
  const dirBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dirBytes, end]);
}

/** Write raw bytes as a file through the contents API. */
export async function putBytes(
  request: APIRequestContext,
  path: string,
  bytes: Buffer
): Promise<void> {
  const r = await request.put(`./api/contents/${path}`, {
    data: { type: 'file', format: 'base64', content: bytes.toString('base64') }
  });
  expect(r.ok(), `PUT ${path}`).toBeTruthy();
}

export function sha256(bytes: Buffer | null): string {
  expect(bytes, 'file bytes').not.toBeNull();
  return createHash('sha256').update(bytes!).digest('hex');
}

/** Path of the default file browser, with its drive name (zip:...) when it has one. */
export async function browserPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const app = (window as any).jupyterapp;
    for (const w of app.shell.widgets('left')) {
      if (w.id === 'filebrowser') {
        return w.model.path;
      }
    }
    throw new Error('no default file browser');
  });
}

/** Number of widgets in the main area. */
export async function mainWidgets(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from((window as any).jupyterapp.shell.widgets('main') as any[])
        .length
  );
}

/**
 * Count every document widget node added to the main area from now on, also one removed again at once.
 * Returns a function that reads the count.
 */
export async function watchDocuments(
  page: Page
): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const w = window as any;
    w.__zipDocsAdded = 0;
    w.__zipDocObserver?.disconnect();
    w.__zipDocObserver = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (
            node instanceof HTMLElement &&
            (node.classList.contains('jp-Document') ||
              node.querySelector('.jp-Document'))
          ) {
            w.__zipDocsAdded++;
          }
        });
      }
    });
    w.__zipDocObserver.observe(document.querySelector('#jp-main-dock-panel'), {
      childList: true,
      subtree: true
    });
  });
  return () => page.evaluate(() => (window as any).__zipDocsAdded);
}
