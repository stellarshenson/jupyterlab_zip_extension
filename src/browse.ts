import { IRouter } from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { PathExt, URLExt } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { FileBrowser } from '@jupyterlab/filebrowser';
import { Contents } from '@jupyterlab/services';
import { DRIVE_NAME, ZipDrive, splitArchive } from './drive';
import { callZipAPI } from './handler';

/**
 * Let a file browser path cross between the normal drive and the zip drive.
 *
 * The file browser resolves every change of folder against its current drive, so it can neither enter nor leave the zip drive on its own:
 * - an explicit `zip:` path is absolute (entering an archive)
 * - a zip path that names no folder inside an archive becomes the same folder on the normal drive (a crumb above the archive, the home crumb, going up from its top level)
 * - a normal-drive path inside an archive the drive has listed goes back to the zip drive: JupyterLab restores a saved browser path without its drive name,
 *   and New File and New Folder in the file browser send the browser path without its drive name, so the zip drive refuses them
 */
export function crossDrives(
  contents: Contents.IManager,
  drive: ZipDrive
): void {
  const resolve = contents.resolvePath.bind(contents);
  contents.resolvePath = (root: string, path: string): string => {
    if (contents.driveName(path) === DRIVE_NAME) {
      return contents.normalize(path);
    }
    const resolved = resolve(root, path);
    const local = contents.localPath(resolved);
    const split = splitArchive(local);
    if (contents.driveName(resolved) === DRIVE_NAME) {
      return split ? resolved : local;
    }
    if (
      !contents.driveName(resolved) &&
      split &&
      drive.archives.has(split.archive)
    ) {
      return `${DRIVE_NAME}:${local}`;
    }
    return resolved;
  };
  // the restore rule above, for the path of a new file or folder
  const newUntitled = contents.newUntitled.bind(contents);
  contents.newUntitled = (options?: Contents.ICreateOptions) =>
    newUntitled(
      options?.path
        ? { ...options, path: contents.resolvePath('', options.path) }
        : options
    );
}

/**
 * Route a copy from the zip drive to the normal drive through the copy-out endpoint; every other copy goes to the original method.
 * A move between drives stays refused by the contents manager's own rename.
 */
export function copyOut(
  contents: Contents.IManager,
  write: (path: string, toDir: string) => Promise<Contents.IModel>
): void {
  const copy = contents.copy.bind(contents);
  contents.copy = (fromFile: string, toDir: string) =>
    contents.driveName(fromFile) === DRIVE_NAME && !contents.driveName(toDir)
      ? write(contents.localPath(fromFile), contents.localPath(toDir))
      : copy(fromFile, toDir);
}

/** Copy a member or folder out of an archive into a folder on the normal drive. */
export async function writeOut(
  contents: Contents.IManager,
  path: string,
  toDir: string
): Promise<Contents.IModel> {
  const model = await callZipAPI<Contents.IModel>('copy', {
    method: 'POST',
    body: JSON.stringify({ path, to_dir: toDir })
  });
  // A file browser showing the target folder refreshes on this signal, as after any copy
  (
    contents.fileChanged as unknown as {
      emit(args: Contents.IChangedArgs): void;
    }
  ).emit({ type: 'new', oldValue: null, newValue: model });
  return model;
}

/** Make double-click and Enter on a zip in the browser enter the archive; no document opens. A zip inside an archive is not entered. */
export function enterArchives(
  browser: FileBrowser,
  contents: Contents.IManager
): void {
  // Both the double-click and the Enter handler of the listing call handleOpen
  const listing = (
    browser as unknown as {
      listing: { handleOpen(item: Contents.IModel): void };
    }
  ).listing;
  const open = listing.handleOpen.bind(listing);
  listing.handleOpen = (item: Contents.IModel) => {
    const drive = contents.driveName(item.path);
    if (
      item.type === 'directory' ||
      (drive && drive !== DRIVE_NAME) ||
      !item.name.toLowerCase().endsWith('.zip')
    ) {
      open(item);
      return;
    }
    if (drive === DRIVE_NAME) {
      // The server reads one archive level only; opening the inner zip as a document fails
      void showErrorMessage('Open Archive', 'Copy it out to browse it');
      return;
    }
    const path = `${DRIVE_NAME}:${item.path}`;
    // Checked first: on a failed change of folder the browser shows no error, or on a 404 moves to the root
    contents
      .get(path, { content: false })
      .then(() => browser.model.cd(path))
      .catch(error => showErrorMessage('Open Archive', error));
  };
}

/** Whether the file browser shows the inside of an archive, where Create Archive and Extract Archive cannot work. */
export function insideArchive(
  contents: Contents.IManager,
  browser: FileBrowser | null
): boolean {
  return !!browser && contents.driveName(browser.model.path) === DRIVE_NAME;
}

/** A notebook or other document opened from an archive starts no kernel. */
export function noKernelInArchives(
  registry: DocumentRegistry,
  contents: Contents.IManager
): void {
  const get = registry.getKernelPreference.bind(registry);
  registry.getKernelPreference = (path, widgetName, kernel) => {
    const preference = get(path, widgetName, kernel);
    return preference && contents.driveName(path) === DRIVE_NAME
      ? { ...preference, shouldStart: false, canStart: false }
      : preference;
  };
}

/**
 * Keep zip paths out of the page URL. JupyterLab writes the browser or document path into /lab/tree/<path>,
 * and on reload filebrowser:open-path finds no file browser for the zip drive and shows an error;
 * the URL names the folder that holds the archive instead.
 */
export function treeUrlOutsideArchives(router: IRouter): void {
  const navigate = router.navigate.bind(router);
  router.navigate = (path: string, options?: IRouter.INavOptions) => {
    const match = /^(.*\/tree\/)zip%3A([^?#]*)(.*)$/.exec(path);
    const split = match && splitArchive(decodeURIComponent(match[2]));
    navigate(
      split
        ? match![1] +
            URLExt.encodeParts(PathExt.dirname(split.archive)) +
            match![3]
        : path,
      options
    );
  };
}

/** Register the zip drive and wire archive browsing into the default file browser. */
export function setupBrowse(
  contents: Contents.IManager,
  browser: FileBrowser,
  router: IRouter | null,
  registry: DocumentRegistry
): void {
  const drive = new ZipDrive();
  contents.addDrive(drive);
  crossDrives(contents, drive);
  copyOut(contents, (path, toDir) => writeOut(contents, path, toDir));
  enterArchives(browser, contents);
  noKernelInArchives(registry, contents);
  if (router) {
    treeUrlOutsideArchives(router);
  }
}
