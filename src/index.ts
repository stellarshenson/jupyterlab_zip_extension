import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';
import { callZipAPI } from './handler';

// Create a custom zip icon using SVG - archive box design with original strokes
const zipIconSvgStr = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 0 143 116.15" width="16" height="16">
  <!-- Top lid fill (light gray) -->
  <path fill="#E0E0E0" d="M 6.0937682,18.416722 V 6.2291853 H 64.458526 122.82328 V 18.416722 30.604258 H 64.458526 6.0937682 Z"/>
  <!-- Body fill (light gray) -->
  <path fill="#E0E0E0" d="M 12.322953,73.396053 V 36.833443 H 64.458526 116.5941 v 36.56261 36.562607 H 64.458526 12.322953 Z"/>
  <!-- Lid and body outline strokes (black) -->
  <path fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="2.6131" d="M4.213,3.005c-0.328,0-0.614,0.103-0.84,0.348c-0.246,0.246-0.368,0.532-0.368,0.84v28.446c0,0.308,0.122,0.573,0.368,0.778 c0.226,0.205,0.512,0.308,0.84,0.308h120.463c0.328,0,0.614-0.103,0.84-0.308c0.246-0.205,0.368-0.471,0.368-0.778V4.192 c0-0.308-0.122-0.594-0.368-0.84c-0.226-0.245-0.512-0.348-0.84-0.348H4.213L4.213,3.005z M10.213,33.798 c-0.235,0-0.471,0.103-0.675,0.307c-0.185,0.205-0.287,0.44-0.287,0.656v77.442c0,0.216,0.103,0.451,0.287,0.655 c0.204,0.206,0.43,0.287,0.675,0.287h108.462c0.246,0,0.472-0.081,0.676-0.287c0.185-0.204,0.287-0.43,0.287-0.655V34.761 c0-0.226-0.103-0.451-0.287-0.656c-0.204-0.204-0.439-0.307-0.676-0.307H10.213L10.213,33.798z"/>
  <!-- Slot (transparent fill, black stroke) -->
  <path fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M47.999,52.228H80.89 c1.762,0,3.257,0.614,4.485,1.844c1.249,1.249,1.863,2.744,1.863,4.505l0,0c0,1.761-0.614,3.277-1.863,4.567 c-1.229,1.27-2.725,1.925-4.485,1.925H47.999c-1.761,0-3.257-0.655-4.485-1.925c-1.249-1.29-1.863-2.807-1.863-4.567l0,0 c0-1.761,0.614-3.256,1.863-4.505C44.742,52.842,46.237,52.228,47.999,52.228L47.999,52.228z"/>
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




