import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { callUnzipAPI } from './handler';

const PLUGIN_ID = 'jupyterlab-zip-extension:plugin';
const UNZIP_COMMAND = 'filebrowser:zip-file';

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'A JupyterLab extension to zip/unzip files in the file browser.',
  autoStart: true,
  requires: [IFileBrowserFactory],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    palette: ICommandPalette | null
  ): void => {
    console.log('JupyterLab Unzip Extension is activated!');

    const { commands } = app;
    const { tracker } = factory;

    commands.addCommand(UNZIP_COMMAND, {
      label: 'Extract Archive',
      caption: 'Extract the selected archive file',
      iconClass: 'jp-MaterialIcon jp-FolderIcon',
      execute: async () => {
        const current = tracker.currentWidget;
        if (!current) {
          console.warn('No file browser widget active');
          return;
        }

        const selectedItems = Array.from(current.selectedItems());
        if (selectedItems.length !== 1) {
          console.warn('Please select exactly one archive file');
          return;
        }

        const item = selectedItems[0];
        if (!isArchiveFile(item.name)) {
          console.warn('Selected file is not a supported archive format (.zip)');
          return;
        }

        try {
          console.log(`Extracting ${item.name}...`);
          
          const result = await callUnzipAPI<any>('unzip', {
            method: 'POST',
            body: JSON.stringify({
              archive_path: item.path
            })
          });

          if (result.success) {
            console.log(`Successfully extracted to: ${result.extract_path}`);
            await current.model.refresh();
          } else {
            console.error(`Extraction failed: ${result.error}`);
          }
        } catch (error) {
          console.error('Error extracting archive:', error);
        }
      },
      isEnabled: () => {
        const current = tracker.currentWidget;
        if (!current) return false;
        const selectedItems = Array.from(current.selectedItems());
        return selectedItems.length === 1 && isArchiveFile(selectedItems[0].name);
      }
    });

    // THIS IS THE CONTEXT MENU REGISTRATION
    app.contextMenu.addItem({
      command: UNZIP_COMMAND,
      selector: '.jp-DirListing-item[data-isdir="false"]',
      rank: 3
    });

    if (palette) {
      palette.addItem({
        command: UNZIP_COMMAND,
        category: 'File Operations'
      });
    }
  }
};

function isArchiveFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'zip';
}

export default plugin;
