import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { callZipAPI } from './handler';

// Create a custom zip icon using SVG - inspired by standard ZIP file icons
const zipIconSvgStr = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
  <!-- Folder/document shape in darker yellow with visible outline -->
  <path fill="#D4A017" stroke="#8B7500" stroke-width="1" d="M14,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V8L14,2z"/>
  <path fill="#D4A017" stroke="#8B7500" stroke-width="1" d="M14,2v6h6"/>
  <!-- Large bold lowercase z letter -->
  <text x="12" y="18" font-family="Arial Black, Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#3D2F0F">z</text>
</svg>
`;

const zipIcon = new LabIcon({
  name: 'jupyterlab_zip_extension:zip',
  svgstr: zipIconSvgStr
});

const PLUGIN_ID = 'jupyterlab_zip_extension:plugin';
const UNZIP_COMMAND = 'filebrowser:unzip-file';
const ZIP_COMMAND = 'filebrowser:zip-files';

const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description: 'A JupyterLab extension to zip/unzip files in the file browser.',
  autoStart: true,
  requires: [IFileBrowserFactory],
  optional: [ICommandPalette, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    factory: IFileBrowserFactory,
    palette: ICommandPalette | null,
    settingRegistry: ISettingRegistry | null
  ): void => {
    console.log('JupyterLab Zip/Unzip Extension is activated!');

    const { commands, docRegistry } = app;
    const { tracker } = factory;

    // Register zip file icon
    docRegistry.addFileType({
      name: 'zip',
      displayName: 'ZIP Archive',
      extensions: ['.zip'],
      fileFormat: 'base64',
      contentType: 'file',
      icon: zipIcon
    });

    let extractToNamedFolder = true; // default value

    // Load settings
    if (settingRegistry) {
      settingRegistry
        .load(PLUGIN_ID)
        .then(settings => {
          extractToNamedFolder = settings.get('extractToNamedFolder').composite as boolean;
          console.log(`Zip extension settings loaded: extractToNamedFolder=${extractToNamedFolder}`);

          settings.changed.connect(() => {
            extractToNamedFolder = settings.get('extractToNamedFolder').composite as boolean;
            console.log(`Zip extension settings changed: extractToNamedFolder=${extractToNamedFolder}`);
          });
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterlab-zip-extension.', reason);
        });
    }

    // UNZIP COMMAND
    commands.addCommand(UNZIP_COMMAND, {
      label: 'Extract Archive',
      caption: 'Extract the selected archive file',
      icon: zipIcon,
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

          const result = await callZipAPI<any>('unzip', {
            method: 'POST',
            body: JSON.stringify({
              archive_path: item.path,
              extract_to_named_folder: extractToNamedFolder
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
      },
      isVisible: () => {
        const current = tracker.currentWidget;
        if (!current) return false;
        const selectedItems = Array.from(current.selectedItems());
        return selectedItems.length === 1 && isArchiveFile(selectedItems[0].name);
      }
    });

    // ZIP COMMAND
    commands.addCommand(ZIP_COMMAND, {
      label: 'Create Archive',
      caption: 'Create a zip archive from selected files/folders',
      icon: zipIcon,
      execute: async () => {
        const current = tracker.currentWidget;
        if (!current) return;

        const selectedItems = Array.from(current.selectedItems());
        if (selectedItems.length === 0) return;

        const defaultName = selectedItems.length === 1 
          ? `${selectedItems[0].name}.zip`
          : 'archive.zip';

        const result = await InputDialog.getText({
          title: 'Create Archive',
          text: defaultName,
          label: 'Archive name:'
        });

        if (result.button.accept && result.value) {
          let archiveName = result.value;
          
          // Ensure .zip extension
          if (!archiveName.endsWith('.zip')) {
            archiveName += '.zip';
          }

          try {
            console.log(`Creating archive ${archiveName}...`);
            
            const paths = selectedItems.map(item => item.path);
            
            const zipResult = await callZipAPI<any>('zip', {
              method: 'POST',
              body: JSON.stringify({
                archive_name: archiveName,
                paths: paths
              })
            });

            if (zipResult.success) {
              console.log(`Successfully created archive: ${zipResult.archive_path}`);
              await current.model.refresh();
            } else {
              console.error(`Archive creation failed: ${zipResult.error}`);
            }
          } catch (error) {
            console.error('Error creating archive:', error);
          }
        }
      },
      isEnabled: () => {
        const current = tracker.currentWidget;
        if (!current) return false;
        return Array.from(current.selectedItems()).length > 0;
      }
    });
      

    // Context menu
    app.contextMenu.addItem({
      command: UNZIP_COMMAND,
      selector: '.jp-DirListing-item',
      rank: 11
    });

    app.contextMenu.addItem({
      command: ZIP_COMMAND,
      selector: '.jp-DirListing-item',
      rank: 11
    });

    if (palette) {
      palette.addItem({
        command: UNZIP_COMMAND,
        category: 'File Operations'
      });
      palette.addItem({
        command: ZIP_COMMAND,
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




