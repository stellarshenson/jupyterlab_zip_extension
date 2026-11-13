// The UI packages do not load under Jest; isArchiveFile uses none of them
jest.mock('@jupyterlab/application', () => ({}));
jest.mock('@jupyterlab/apputils', () => ({}));
jest.mock('@jupyterlab/filebrowser', () => ({}));
jest.mock('@jupyterlab/ui-components', () => ({ LabIcon: jest.fn() }));
jest.mock('../browse', () => ({}));

import { isArchiveFile } from '../index';

describe('isArchiveFile', () => {
  it('is true for a name ending .zip in any letter case, false otherwise', () => {
    expect(isArchiveFile('a.zip')).toBe(true);
    expect(isArchiveFile('A.ZIP')).toBe(true);
    expect(isArchiveFile('a.txt')).toBe(false);
    expect(isArchiveFile('zip')).toBe(false);
  });
});
