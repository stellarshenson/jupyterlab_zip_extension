import { Contents, ContentsManager, Drive } from '@jupyterlab/services';

jest.mock('../handler', () => ({ callZipAPI: jest.fn() }));
jest.mock('@jupyterlab/apputils', () => ({ showErrorMessage: jest.fn() }));

import { showErrorMessage } from '@jupyterlab/apputils';
import {
  copyOut,
  crossDrives,
  enterArchives,
  insideArchive,
  noKernelInArchives,
  treeUrlOutsideArchives,
  writeOut
} from '../browse';
import { ZipDrive, splitArchive } from '../drive';
import { callZipAPI } from '../handler';

const MODEL = { name: 'x.txt', path: 'out/x.txt', type: 'file' } as any;

function setup() {
  const defaultDrive = new Drive();
  const contents = new ContentsManager({ defaultDrive });
  const drive = new ZipDrive();
  contents.addDrive(drive);
  crossDrives(contents, drive);
  return { contents, drive, defaultDrive };
}

describe('splitArchive', () => {
  it('splits at the first segment ending in .zip', () => {
    expect(splitArchive('data/a.zip/sub/x.txt')).toEqual({
      archive: 'data/a.zip',
      inner: 'sub/x.txt'
    });
    expect(splitArchive('a.zip')).toEqual({ archive: 'a.zip', inner: '' });
    expect(splitArchive('a.zip/inner.zip/x')).toEqual({
      archive: 'a.zip',
      inner: 'inner.zip/x'
    });
  });

  it('ignores case and empty segments', () => {
    expect(splitArchive('/data//A.ZIP/x/')).toEqual({
      archive: 'data/A.ZIP',
      inner: 'x'
    });
  });

  it('returns null for a path that names no archive', () => {
    expect(splitArchive('data/sub')).toBeNull();
    expect(splitArchive('')).toBeNull();
    expect(splitArchive('data/zip')).toBeNull();
  });
});

describe('crossDrives (enter and leave rule)', () => {
  it('treats an explicit zip path as absolute', () => {
    const { contents } = setup();
    expect(contents.resolvePath('data', 'zip:data/a.zip')).toBe(
      'zip:data/a.zip'
    );
  });

  it('stays on the zip drive inside an archive', () => {
    const { contents } = setup();
    expect(contents.resolvePath('zip:data/a.zip', '/data/a.zip/dir')).toBe(
      'zip:data/a.zip/dir'
    );
    expect(contents.resolvePath('zip:data/a.zip/dir', '..')).toBe(
      'zip:data/a.zip'
    );
  });

  it('leaves to the same folder on the normal drive', () => {
    const { contents } = setup();
    expect(contents.resolvePath('zip:data/a.zip', '..')).toBe('data');
    expect(contents.resolvePath('zip:data/a.zip/dir', '/data')).toBe('data');
    expect(contents.resolvePath('zip:data/a.zip/dir', '/')).toBe('');
  });

  it('leaves normal-drive paths alone, including folders named *.zip', () => {
    const { contents } = setup();
    expect(contents.resolvePath('data', 'sub')).toBe('data/sub');
    expect(contents.resolvePath('', '/x.zip/sub')).toBe('x.zip/sub');
  });

  it('sends a restored normal-drive path inside a listed archive back to the zip drive', () => {
    const { contents, drive } = setup();
    expect(contents.resolvePath('', 'data/a.zip/dir')).toBe('data/a.zip/dir');
    drive.archives.add('data/a.zip');
    expect(contents.resolvePath('', 'data/a.zip/dir')).toBe(
      'zip:data/a.zip/dir'
    );
    expect(contents.resolvePath('', 'data/a.zip')).toBe('zip:data/a.zip');
  });

  it('sends a new file or folder inside a listed archive to the zip drive, which refuses it', async () => {
    const { contents, drive, defaultDrive } = setup();
    const normal = jest
      .spyOn(defaultDrive, 'newUntitled')
      .mockResolvedValue(MODEL);
    drive.archives.add('data/a.zip');
    await expect(
      contents.newUntitled({ path: 'data/a.zip/dir', type: 'file' })
    ).rejects.toThrow('The archive is read-only');
    await contents.newUntitled({ path: 'data/sub', type: 'directory' });
    expect(normal).toHaveBeenCalledTimes(1);
    expect(normal).toHaveBeenCalledWith({
      path: 'data/sub',
      type: 'directory'
    });
  });
});

describe('copyOut (copy wrapper routing)', () => {
  it('sends zip → normal drive to the copy-out writer', async () => {
    const { contents, defaultDrive } = setup();
    const write = jest.fn().mockResolvedValue(MODEL);
    const original = jest.spyOn(defaultDrive, 'copy');
    copyOut(contents, write);
    await expect(contents.copy('zip:data/a.zip/x.txt', 'out')).resolves.toBe(
      MODEL
    );
    expect(write).toHaveBeenCalledWith('data/a.zip/x.txt', 'out');
    expect(original).not.toHaveBeenCalled();
  });

  it('sends every other copy to the original method unchanged', async () => {
    const { contents, defaultDrive } = setup();
    const write = jest.fn();
    const original = jest
      .spyOn(defaultDrive, 'copy')
      .mockResolvedValue(MODEL as Contents.IModel);
    copyOut(contents, write);

    await contents.copy('data/x.txt', 'out');
    expect(original).toHaveBeenCalledWith('data/x.txt', 'out');
    await expect(
      contents.copy('zip:data/a.zip/x.txt', 'zip:data/a.zip')
    ).rejects.toThrow('The archive is read-only');
    expect(() => contents.copy('data/x.txt', 'zip:data/a.zip')).toThrow(
      'Copying files between drives is not currently implemented'
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('leaves a move between drives refused', () => {
    const { contents } = setup();
    copyOut(contents, jest.fn());
    expect(() => contents.rename('zip:data/a.zip/x.txt', 'out/x.txt')).toThrow(
      'renaming files must occur within a Drive'
    );
  });
});

describe('writeOut', () => {
  it('posts the copy and announces the new file so the target listing refreshes', async () => {
    const { contents } = setup();
    (callZipAPI as jest.Mock).mockResolvedValue(MODEL);
    const seen: Contents.IChangedArgs[] = [];
    contents.fileChanged.connect((_, args) => seen.push(args));
    await expect(writeOut(contents, 'data/a.zip/x.txt', 'out')).resolves.toBe(
      MODEL
    );
    expect(callZipAPI).toHaveBeenCalledWith('copy', {
      method: 'POST',
      body: JSON.stringify({ path: 'data/a.zip/x.txt', to_dir: 'out' })
    });
    expect(seen).toEqual([{ type: 'new', oldValue: null, newValue: MODEL }]);
  });
});

describe('ZipDrive', () => {
  it('refuses every write', async () => {
    const drive = new ZipDrive();
    for (const write of [
      () => drive.newUntitled(),
      () => drive.delete(),
      () => drive.rename(),
      () => drive.save(),
      () => drive.copy(),
      () => drive.createCheckpoint(),
      () => drive.restoreCheckpoint(),
      () => drive.deleteCheckpoint()
    ]) {
      await expect(write()).rejects.toThrow('The archive is read-only');
    }
    await expect(drive.listCheckpoints()).resolves.toEqual([]);
  });

  it('points downloads at the member endpoint', async () => {
    const url = await new ZipDrive().getDownloadUrl('data/a b.zip/ü.txt');
    expect(url).toMatch(
      /\/jupyterlab-zip\/member\?path=data%2Fa\+b\.zip%2F%C3%BC\.txt$/
    );
  });
});

describe('enterArchives', () => {
  function browser() {
    const handleOpen = jest.fn();
    const cd = jest.fn().mockResolvedValue(undefined);
    return {
      handleOpen,
      cd,
      widget: { listing: { handleOpen }, model: { cd } } as any
    };
  }

  it('enters a zip on the normal drive instead of opening it', async () => {
    const { contents } = setup();
    const get = jest.spyOn(contents, 'get').mockResolvedValue({} as any);
    const b = browser();
    enterArchives(b.widget, contents);
    b.widget.listing.handleOpen({
      type: 'file',
      name: 'a.ZIP',
      path: 'data/a.ZIP'
    });
    await new Promise(resolve => setTimeout(resolve));
    expect(get).toHaveBeenCalledWith('zip:data/a.ZIP', { content: false });
    expect(b.cd).toHaveBeenCalledWith('zip:data/a.ZIP');
    expect(b.handleOpen).not.toHaveBeenCalled();
  });

  it('opens folders and other files as before, also inside an archive', () => {
    const { contents } = setup();
    const b = browser();
    enterArchives(b.widget, contents);
    for (const item of [
      { type: 'directory', name: 'd.zip', path: 'data/d.zip' },
      { type: 'file', name: 'x.txt', path: 'data/x.txt' },
      { type: 'directory', name: 'dir', path: 'zip:data/a.zip/dir' },
      { type: 'file', name: 'x.txt', path: 'zip:data/a.zip/x.txt' }
    ]) {
      b.widget.listing.handleOpen(item);
      expect(b.handleOpen).toHaveBeenLastCalledWith(item);
    }
    expect(b.cd).not.toHaveBeenCalled();
  });

  it('asks to copy out a zip inside an archive and opens nothing', async () => {
    const { contents } = setup();
    const get = jest.spyOn(contents, 'get');
    (showErrorMessage as jest.Mock).mockClear();
    const b = browser();
    enterArchives(b.widget, contents);
    b.widget.listing.handleOpen({
      type: 'file',
      name: 'in.ZIP',
      path: 'zip:data/a.zip/in.ZIP'
    });
    await new Promise(resolve => setTimeout(resolve));
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Open Archive',
      'Copy it out to browse it'
    );
    expect(b.handleOpen).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(b.cd).not.toHaveBeenCalled();
  });

  it('shows an error and stays when the archive cannot be read', async () => {
    const { contents } = setup();
    jest.spyOn(contents, 'get').mockRejectedValue(new Error('Not a zip'));
    const b = browser();
    enterArchives(b.widget, contents);
    b.widget.listing.handleOpen({
      type: 'file',
      name: 'bad.zip',
      path: 'bad.zip'
    });
    await new Promise(resolve => setTimeout(resolve));
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Open Archive',
      expect.any(Error)
    );
    expect(b.cd).not.toHaveBeenCalled();
  });
});

describe('insideArchive', () => {
  it('is true only while the browser path is on the zip drive', () => {
    const { contents } = setup();
    const at = (path: string) => ({ model: { path } }) as any;
    expect(insideArchive(contents, at('zip:data/a.zip'))).toBe(true);
    expect(insideArchive(contents, at('zip:data/a.zip/dir'))).toBe(true);
    expect(insideArchive(contents, at('data'))).toBe(false);
    expect(insideArchive(contents, at('data/a.zip'))).toBe(false);
    expect(insideArchive(contents, null)).toBe(false);
  });
});

describe('noKernelInArchives', () => {
  it('stops a kernel start for a document on the zip drive only', () => {
    const { contents } = setup();
    const preference = { name: 'python3', shouldStart: true, canStart: true };
    const get = jest.fn().mockReturnValue(preference);
    const registry = { getKernelPreference: get } as any;
    noKernelInArchives(registry, contents);

    expect(
      registry.getKernelPreference('zip:data/a.zip/nb.ipynb', 'Notebook')
    ).toEqual({ name: 'python3', shouldStart: false, canStart: false });
    expect(registry.getKernelPreference('data/nb.ipynb', 'Notebook')).toBe(
      preference
    );
    expect(get).toHaveBeenLastCalledWith(
      'data/nb.ipynb',
      'Notebook',
      undefined
    );
    get.mockReturnValue(undefined);
    expect(
      registry.getKernelPreference('zip:data/a.zip/x.txt', 'Editor')
    ).toBeUndefined();
  });
});

describe('treeUrlOutsideArchives', () => {
  function router() {
    const navigate = jest.fn();
    const r = { navigate } as any;
    treeUrlOutsideArchives(r);
    return { r, navigate };
  }

  it('names the folder holding the archive instead of a zip path', () => {
    const { r, navigate } = router();
    r.navigate('/lab/tree/zip%3Adata/my%20a.zip/dir', { skipRouting: true });
    expect(navigate).toHaveBeenLastCalledWith('/lab/tree/data', {
      skipRouting: true
    });
    r.navigate('/lab/workspaces/w/tree/zip%3Aa.zip/x.txt?reset');
    expect(navigate).toHaveBeenLastCalledWith(
      '/lab/workspaces/w/tree/?reset',
      undefined
    );
  });

  it('passes every other URL through unchanged', () => {
    const { r, navigate } = router();
    for (const url of [
      '/lab/tree/data/a.zip',
      '/lab',
      '/lab/tree/zip%3Adata'
    ]) {
      r.navigate(url);
      expect(navigate).toHaveBeenLastCalledWith(url, undefined);
    }
  });
});
