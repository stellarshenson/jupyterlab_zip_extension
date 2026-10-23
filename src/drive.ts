import { URLExt } from '@jupyterlab/coreutils';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { callZipAPI } from './handler';

/** Name of the drive that shows the inside of zip archives: `zip:<archive path>/<inner path>`. */
export const DRIVE_NAME = 'zip';

const READ_ONLY = 'The archive is read-only';

/**
 * Split a drive-local path at its first segment ending in .zip.
 *
 * shortcut: an archive inside a folder whose name ends in .zip cannot be entered; split on the server by walking the path if that is ever needed
 */
export function splitArchive(
  path: string
): { archive: string; inner: string } | null {
  const parts = path.split('/').filter(part => part);
  const i = parts.findIndex(part => part.toLowerCase().endsWith('.zip'));
  if (i < 0) {
    return null;
  }
  return {
    archive: parts.slice(0, i + 1).join('/'),
    inner: parts.slice(i + 1).join('/')
  };
}

/** A read-only drive over the members of zip archives on the server. */
export class ZipDrive implements Contents.IDrive {
  readonly name = DRIVE_NAME;
  readonly serverSettings = ServerConnection.makeSettings();
  // Nothing on this drive ever changes, so the signal never fires
  readonly fileChanged: Contents.IDrive['fileChanged'] = {
    connect: () => true,
    disconnect: () => true
  };
  /** Archives this drive has listed, by path on the normal drive. */
  readonly archives = new Set<string>();
  isDisposed = false;

  dispose(): void {
    this.isDisposed = true;
  }

  async get(
    localPath: string,
    options: Contents.IFetchOptions = {}
  ): Promise<Contents.IModel> {
    const query = new URLSearchParams({
      path: localPath,
      content: options.content === false ? '0' : '1'
    });
    if (options.type) {
      query.set('type', options.type);
    }
    if (options.format) {
      query.set('format', options.format);
    }
    const model = await callZipAPI<Contents.IModel>(`browse?${query}`);
    const split = splitArchive(localPath);
    if (split) {
      this.archives.add(split.archive);
    }
    return model;
  }

  async getDownloadUrl(localPath: string): Promise<string> {
    const url = URLExt.join(this.serverSettings.baseUrl, 'jupyterlab-zip');
    return `${url}/member?${new URLSearchParams({ path: localPath })}`;
  }

  async listCheckpoints(): Promise<Contents.ICheckpointModel[]> {
    return [];
  }

  async newUntitled(): Promise<Contents.IModel> {
    throw new Error(READ_ONLY);
  }

  async delete(): Promise<void> {
    throw new Error(READ_ONLY);
  }

  async rename(): Promise<Contents.IModel> {
    throw new Error(READ_ONLY);
  }

  async save(): Promise<Contents.IModel> {
    throw new Error(READ_ONLY);
  }

  async copy(): Promise<Contents.IModel> {
    throw new Error(READ_ONLY);
  }

  async createCheckpoint(): Promise<Contents.ICheckpointModel> {
    throw new Error(READ_ONLY);
  }

  async restoreCheckpoint(): Promise<void> {
    throw new Error(READ_ONLY);
  }

  async deleteCheckpoint(): Promise<void> {
    throw new Error(READ_ONLY);
  }
}
