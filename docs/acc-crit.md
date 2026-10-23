# Acceptance Criteria

Behaviour of the JupyterLab zip extension: Create Archive and Extract Archive in the file browser, backed by two server endpoints.

## Authors

- `@kj` Konrad Jelen

## Create Archive `ARCH`

Create Archive command on a file-browser selection

- [x] `ACC-ARCH-1-ONEFILE` **Archive one file** - CRITICAL; Create Archive on one file writes <name>.zip holding that file at the archive root
  - evidence: Galata test 'Create Archive › archives one file at the archive root' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › archives one file at the archive root
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "select one file, accept default name, assert the zip lists the file" -> "ui-tests/tests/archive.spec.ts: select one file, accept default name, assert the zip lists the file"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: select one file, accept default name, assert the zip lists the file" -> "ui-tests/tests/archive.spec.ts: Create Archive › archives one file at the archive root"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-2-ONEDIR` **Archive one folder** - CRITICAL; Create Archive on one folder writes <folder>.zip with the folder name as top entry and the folder structure kept inside
  - evidence: Galata test 'Create Archive › archives one folder with its structure' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › archives one folder with its structure
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "select a folder with a nested file, assert the zip lists folder/sub/file" -> "ui-tests/tests/archive.spec.ts: select a folder with a nested file, assert the zip lists folder/sub/file"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: select a folder with a nested file, assert the zip lists folder/sub/file" -> "ui-tests/tests/archive.spec.ts: Create Archive › archives one folder with its structure"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-3-MULTI` **Archive a multi-selection** - HIGH; Create Archive on several items writes one zip holding every selected item
  - evidence: Galata test 'Create Archive › archives a multi-selection into one zip' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › archives a multi-selection into one zip
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "select a file and a folder, assert both are in the zip" -> "ui-tests/tests/archive.spec.ts: select a file and a folder, assert both are in the zip"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: select a file and a folder, assert both are in the zip" -> "ui-tests/tests/archive.spec.ts: Create Archive › archives a multi-selection into one zip"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-4-DEFNAME` **Default archive name** - MEDIUM; the name dialog is prefilled with <item>.zip for one item and archive.zip for several
  - evidence: Galata test 'Create Archive › prefills the archive name' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › prefills the archive name
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "open the dialog for one item then for two, assert the prefilled text" -> "ui-tests/tests/archive.spec.ts: open the dialog for one item then for two, assert the prefilled text"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: open the dialog for one item then for two, assert the prefilled text" -> "ui-tests/tests/archive.spec.ts: Create Archive › prefills the archive name"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-5-PARENT` **Archive placed in parent of first item** - HIGH; the archive is written to the directory that holds the first selected item
  - evidence: Galata test 'Create Archive › places the archive beside the first selected item' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › places the archive beside the first selected item
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "archive a file in a subfolder, assert the zip appears beside it" -> "ui-tests/tests/archive.spec.ts: archive a file in a subfolder, assert the zip appears beside it"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: archive a file in a subfolder, assert the zip appears beside it" -> "ui-tests/tests/archive.spec.ts: Create Archive › places the archive beside the first selected item"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-6-SUFFIX` **Zip suffix appended** - MEDIUM; a name typed without .zip gets .zip appended
  - evidence: Galata test 'Create Archive › appends .zip to a name typed without it' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › appends .zip to a name typed without it
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "enter name 'bundle', assert bundle.zip is created" -> "ui-tests/tests/archive.spec.ts: enter name 'bundle', assert bundle.zip is created"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: enter name 'bundle', assert bundle.zip is created" -> "ui-tests/tests/archive.spec.ts: Create Archive › appends .zip to a name typed without it"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-7-CANCEL` **Edge: cancel name dialog** - HIGH; cancelling the archive-name dialog, or accepting an empty name, creates no file and sends no request
  - evidence: Galata test 'Create Archive › cancelled or empty name creates nothing and sends no request' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › cancelled or empty name creates nothing and sends no request
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "cancel the dialog, assert the listing is unchanged" -> "ui-tests/tests/archive.spec.ts: cancel the dialog, assert the listing is unchanged"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: cancel the dialog, assert the listing is unchanged" -> "ui-tests/tests/archive.spec.ts: Create Archive › cancelled or empty name creates nothing and sends no request"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-8-REFRESH` **Listing refreshes after archive** - MEDIUM; the new archive shows in the file browser without a manual refresh
  - evidence: Galata test 'Create Archive › lists the new archive without a manual refresh' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › lists the new archive without a manual refresh
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "create an archive, assert the zip item is listed" -> "ui-tests/tests/archive.spec.ts: create an archive, assert the zip item is listed"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: create an archive, assert the zip item is listed" -> "ui-tests/tests/archive.spec.ts: Create Archive › lists the new archive without a manual refresh"
  - log: 2026-10-23T08:44:25Z @kj closed
- [x] `ACC-ARCH-9-SPIN` **Spinner while archiving** - MEDIUM; a dialog titled Zip Extension with 'Creating archive...' shows during the request and closes after it
  - evidence: Galata test 'should show spinner dialog when creating archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/jupyterlab_zip_extension.spec.ts: should show spinner dialog when creating archive
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "delay the zip route, assert the dialog text, then assert it is gone" -> "ui-tests/tests/archive.spec.ts: delay the zip route, assert the dialog text, then assert it is gone"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: delay the zip route, assert the dialog text, then assert it is gone" -> "ui-tests/tests/jupyterlab_zip_extension.spec.ts: should show spinner dialog when creating archive"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-ARCH-10-ENABLE` **Create Archive needs a selection** - MEDIUM; Create Archive is enabled only when at least one item is selected
  - evidence: Galata test 'Create Archive › enables Create Archive only with a selection' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive › enables Create Archive only with a selection
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "assert the command is disabled with no selection, enabled with one" -> "ui-tests/tests/archive.spec.ts: assert the command is disabled with no selection, enabled with one"
  - log: 2026-10-23T06:38:21Z @kj edited test "ui-tests/tests/archive.spec.ts: assert the command is disabled with no selection, enabled with one" -> "ui-tests/tests/archive.spec.ts: Create Archive › enables Create Archive only with a selection"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-ARCH-30-OVERASK` **Confirm before replacing an archive** - HIGH; Create Archive with an existing archive name shows a dialog naming the archive and asking to overwrite it; Ok replaces the archive
  - evidence: Galata test 'Create Archive, existing archive › asks before replacing an archive and Ok replaces it' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive, existing archive › asks before replacing an archive and Ok replaces it
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T07:59:59Z @kj added
  - log: 2026-10-23T08:09:46Z @kj edited test "ui-tests/tests/archive.spec.ts: Create Archive › asks before replacing an archive and Ok replaces it" -> "ui-tests/tests/archive.spec.ts: Create Archive, existing archive › asks before replacing an archive and Ok replaces it"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-ARCH-31-OVERCANCEL` **Edge: cancel the overwrite dialog** - HIGH; Cancel in the overwrite dialog writes nothing; the existing archive keeps its bytes
  - evidence: Galata test 'Create Archive, existing archive › Cancel in the overwrite dialog keeps the old archive byte for byte' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/archive.spec.ts: Create Archive, existing archive › Cancel in the overwrite dialog keeps the old archive byte for byte
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T07:59:59Z @kj added
  - log: 2026-10-23T08:09:46Z @kj edited test "ui-tests/tests/archive.spec.ts: Create Archive › Cancel in the overwrite dialog keeps the old archive byte for byte" -> "ui-tests/tests/archive.spec.ts: Create Archive, existing archive › Cancel in the overwrite dialog keeps the old archive byte for byte"
  - log: 2026-10-23T08:44:26Z @kj closed

## Extract Archive `EXTR`

Extract Archive command on a selected zip

- [x] `ACC-EXTR-11-VISIBLE` **Extract visible for one zip** - CRITICAL; Extract Archive is visible and enabled only when exactly one .zip item is selected
  - evidence: Galata test 'Extract Archive, extractToNamedFolder true › shows Extract Archive only for exactly one zip' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › shows Extract Archive only for exactly one zip
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "assert shown for one zip; hidden for a text file, for two items, for a zip plus a file" -> "ui-tests/tests/extract.spec.ts: assert shown for one zip; hidden for a text file, for two items, for a zip plus a file"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/extract.spec.ts: assert shown for one zip; hidden for a text file, for two items, for a zip plus a file" -> "ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › shows Extract Archive only for exactly one zip"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-12-NAMED` **Extract to named folder** - CRITICAL; with extractToNamedFolder true the content goes to a folder named after the archive, beside it
  - evidence: Galata test 'Extract Archive, extractToNamedFolder true › extracts into a folder named after the archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › extracts into a folder named after the archive
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "extract a.zip with the setting true, assert a/ holds the content" -> "ui-tests/tests/extract.spec.ts: extract a.zip with the setting true, assert a/ holds the content"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/extract.spec.ts: extract a.zip with the setting true, assert a/ holds the content" -> "ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › extracts into a folder named after the archive"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-13-INPLACE` **Extract to archive directory** - CRITICAL; with extractToNamedFolder false the content goes to the directory that holds the archive
  - evidence: Galata test 'Extract Archive, extractToNamedFolder false › extracts into the directory that holds the archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder false › extracts into the directory that holds the archive
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "extract a.zip with the setting false, assert the content sits beside a.zip" -> "ui-tests/tests/extract.spec.ts: extract a.zip with the setting false, assert the content sits beside a.zip"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/extract.spec.ts: extract a.zip with the setting false, assert the content sits beside a.zip" -> "ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder false › extracts into the directory that holds the archive"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-14-SPIN` **Spinner while extracting** - MEDIUM; a dialog titled Zip Extension with 'Extracting archive...' shows during the request and closes after it
  - evidence: Galata test 'should show spinner dialog when extracting archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/jupyterlab_zip_extension.spec.ts: should show spinner dialog when extracting archive
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:08Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "delay the unzip route, assert the dialog text, then assert it is gone" -> "ui-tests/tests/extract.spec.ts: delay the unzip route, assert the dialog text, then assert it is gone"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/extract.spec.ts: delay the unzip route, assert the dialog text, then assert it is gone" -> "ui-tests/tests/jupyterlab_zip_extension.spec.ts: should show spinner dialog when extracting archive"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-15-REFRESH` **Listing refreshes after extract** - MEDIUM; the extracted items show in the file browser without a manual refresh
  - evidence: Galata test 'Extract Archive, extractToNamedFolder true › refreshes the listing after extract' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › refreshes the listing after extract
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "extract, assert the folder is listed" -> "ui-tests/tests/extract.spec.ts: extract, assert the folder is listed"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/extract.spec.ts: extract, assert the folder is listed" -> "ui-tests/tests/extract.spec.ts: Extract Archive, extractToNamedFolder true › refreshes the listing after extract"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-32-NOCLASH` **Extract never overwrites a file** - CRITICAL; with extractToNamedFolder true, if the named folder is a file or already holds a member, the content goes to the first absent folder named stem (1), stem (2), ...; extract_path names it; existing files keep their bytes
  - evidence: Galata test 'DEF-DATA-4-UNZOVER › extract keeps an existing file byte for byte and lands in the stem (1) folder' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/defects.spec.ts: DEF-DATA-4-UNZOVER › extract keeps an existing file byte for byte and lands in the stem (1) folder
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T07:59:59Z @kj added
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-33-NOCLASHIN` **Edge: in-place extract meets an existing file** - CRITICAL; with extractToNamedFolder false, if a member would overwrite a file in the archive directory, the content goes to the first absent folder stem, stem (1), ...; extract_path names it; existing files keep their bytes
  - evidence: Galata test 'DEF-DATA-4-UNZOVER › in-place extract keeps an existing file byte for byte and lands in the stem folder' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/defects.spec.ts: DEF-DATA-4-UNZOVER › in-place extract keeps an existing file byte for byte and lands in the stem folder
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T08:00:00Z @kj added
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-EXTR-34-NAMEFILE` **Edge: archive named after a file beside it** - HIGH; x.txt.zip next to the file x.txt extracts into the folder x.txt (1) holding x.txt, and x.txt is unchanged
  - evidence: Galata test 'DEF-EXTR-10-NAMECLASH › x.txt.zip beside x.txt extracts into x.txt (1)' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/defects.spec.ts: DEF-EXTR-10-NAMECLASH › x.txt.zip beside x.txt extracts into x.txt (1)
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T08:00:00Z @kj added
  - log: 2026-10-23T08:44:26Z @kj closed

## Settings `SETT`

Zip Extension settings

- [ ] `ACC-SETT-16-SCHEMA` **extractToNamedFolder setting** - HIGH; setting extractToNamedFolder is a boolean, default true, no other keys allowed
  - test: src/__tests__/settings.spec.ts: assert schema/plugin.json type, default and additionalProperties false
  - test-tags: UNIT
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "assert schema/plugin.json type, default and additionalProperties false" -> "src/__tests__/settings.spec.ts: assert schema/plugin.json type, default and additionalProperties false"
- [x] `ACC-SETT-17-LIVE` **Setting applies without reload** - HIGH; changing extractToNamedFolder takes effect on the next extract with no page reload
  - evidence: Galata test 'applies a changed extractToNamedFolder to the next extract without reload' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/settings.spec.ts: applies a changed extractToNamedFolder to the next extract without reload
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "change the setting in the settings editor, extract, assert the target folder" -> "ui-tests/tests/settings.spec.ts: change the setting in the settings editor, extract, assert the target folder"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/settings.spec.ts: change the setting in the settings editor, extract, assert the target folder" -> "ui-tests/tests/settings.spec.ts: applies a changed extractToNamedFolder to the next extract without reload"
  - log: 2026-10-23T08:44:26Z @kj closed

## Interface `FACE`

File-browser menu, palette, icon and console output

- [x] `ACC-FACE-18-MENU` **Context menu entries** - HIGH; right-clicking a file-browser item offers Create Archive, and Extract Archive when exactly one zip is selected
  - evidence: Galata test 'offers the entries in the file-browser context menu' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/interface.spec.ts: offers the entries in the file-browser context menu
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "right-click a file then a zip, assert the menu entries" -> "ui-tests/tests/interface.spec.ts: right-click a file then a zip, assert the menu entries"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/interface.spec.ts: right-click a file then a zip, assert the menu entries" -> "ui-tests/tests/interface.spec.ts: offers the entries in the file-browser context menu"
  - log: 2026-10-23T08:44:26Z @kj closed
- [x] `ACC-FACE-19-PALETTE` **Palette entries** - MEDIUM; the command palette lists Create Archive under File Operations, and Extract Archive there too while exactly one zip is selected
  - evidence: Galata test 'lists both commands in the palette under File Operations' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/interface.spec.ts: lists both commands in the palette under File Operations
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "open the palette, search 'archive', assert both under File Operations" -> "ui-tests/tests/interface.spec.ts: open the palette, search 'archive', assert both under File Operations"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/interface.spec.ts: open the palette, search 'archive', assert both under File Operations" -> "ui-tests/tests/interface.spec.ts: lists both commands in the palette under File Operations"
  - log: 2026-10-23T06:38:28Z @kj amended text "the command palette lists Create Archive and Extract Archive under File Operations" -> "the command palette lists Create Archive under File Operations, and Extract Archive there too while exactly one zip is selected"; reason: palette hides a command whose isVisible is false; observed in galata baseline
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-FACE-20-ICON` **Zip file type icon** - LOW; .zip files show the archive-box icon, with display name ZIP Archive
  - evidence: Galata test 'shows the zip icon and ZIP Archive type on zip files' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/interface.spec.ts: shows the zip icon and ZIP Archive type on zip files
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "assert the listing icon of a .zip item carries the zip LabIcon" -> "ui-tests/tests/interface.spec.ts: assert the listing icon of a .zip item carries the zip LabIcon"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/interface.spec.ts: assert the listing icon of a .zip item carries the zip LabIcon" -> "ui-tests/tests/interface.spec.ts: shows the zip icon and ZIP Archive type on zip files"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-FACE-21-ACTLOG` **Activation console message** - LOW; console prints 'JupyterLab Zip/Unzip Extension is activated!' on load
  - evidence: Galata test 'should emit an activation console message' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/jupyterlab_zip_extension.spec.ts: should emit an activation console message
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:26Z @kj edited test "capture console during page load, assert the message" -> "ui-tests/tests/interface.spec.ts: capture console during page load, assert the message"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/interface.spec.ts: capture console during page load, assert the message" -> "ui-tests/tests/jupyterlab_zip_extension.spec.ts: should emit an activation console message"
  - log: 2026-10-23T08:44:27Z @kj closed
- [ ] `ACC-FACE-22-ISARCH` **Zip name check** - MEDIUM; isArchiveFile is true for names ending .zip in any letter case, false otherwise
  - test: src/__tests__/index.spec.ts: a.zip, A.ZIP true; a.txt, zip false
  - test-tags: UNIT
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "Jest: a.zip, A.ZIP true; a.txt, zip false" -> "src/__tests__/index.spec.ts: a.zip, A.ZIP true; a.txt, zip false"

## Server API `SERV`

POST /jupyterlab-zip/zip and /jupyterlab-zip/unzip

- [x] `ACC-SERV-23-ZIP400` **Zip answers 400 on missing parameters** - HIGH; POST zip without archive_name or paths answers 400 with success false
  - evidence: Galata test 'zip endpoint › answers 400 when archive_name or paths is missing' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: zip endpoint › answers 400 when archive_name or paths is missing
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:24Z @kj edited test "POST empty paths and POST missing archive_name, assert 400" -> "ui-tests/tests/api.spec.ts: POST empty paths and POST missing archive_name, assert 400"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/api.spec.ts: POST empty paths and POST missing archive_name, assert 400" -> "ui-tests/tests/api.spec.ts: zip endpoint › answers 400 when archive_name or paths is missing"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-24-UNZ400` **Unzip answers 400 on missing parameter** - HIGH; POST unzip without archive_path answers 400 with success false
  - evidence: Galata test 'unzip endpoint › answers 400 when archive_path is missing' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: unzip endpoint › answers 400 when archive_path is missing
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "POST an empty body object, assert 400" -> "ui-tests/tests/api.spec.ts: POST an empty body object, assert 400"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/api.spec.ts: POST an empty body object, assert 400" -> "ui-tests/tests/api.spec.ts: unzip endpoint › answers 400 when archive_path is missing"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-25-UNZ404` **Unzip answers 404 on missing archive** - HIGH; POST unzip for a path that does not exist answers 404 with error 'Archive not found'
  - evidence: Galata test 'unzip endpoint › answers 404 Archive not found for a missing archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: unzip endpoint › answers 404 Archive not found for a missing archive
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "POST archive_path missing.zip, assert 404" -> "ui-tests/tests/api.spec.ts: POST archive_path missing.zip, assert 404"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/api.spec.ts: POST archive_path missing.zip, assert 404" -> "ui-tests/tests/api.spec.ts: unzip endpoint › answers 404 Archive not found for a missing archive"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-26-ZIPOK` **Zip response** - HIGH; a successful zip answers success true, archive_path relative to the server root, and the file count
  - evidence: Galata test 'zip endpoint › answers success, a root-relative archive_path and the file count' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: zip endpoint › answers success, a root-relative archive_path and the file count
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "POST a valid zip request, assert the fields" -> "ui-tests/tests/api.spec.ts: POST a valid zip request, assert the fields"
  - log: 2026-10-23T06:38:22Z @kj edited test "ui-tests/tests/api.spec.ts: POST a valid zip request, assert the fields" -> "ui-tests/tests/api.spec.ts: zip endpoint › answers success, a root-relative archive_path and the file count"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-27-UNZOK` **Unzip response** - HIGH; a successful unzip answers success true, extract_path relative to the server root naming the folder used, and the count of file entries (folders not counted)
  - evidence: Galata test 'unzip endpoint › answers success, a root-relative extract_path and the file count' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: unzip endpoint › answers success, a root-relative extract_path and the file count
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "POST a valid unzip request, assert the fields" -> "ui-tests/tests/api.spec.ts: POST a valid unzip request, assert the fields"
  - log: 2026-10-23T06:38:23Z @kj edited test "ui-tests/tests/api.spec.ts: POST a valid unzip request, assert the fields" -> "ui-tests/tests/api.spec.ts: unzip endpoint › answers success, a root-relative extract_path and the file count"
  - log: 2026-10-23T08:00:00Z @kj amended text "a successful unzip answers success true, extract_path relative to the server root, and the file count" -> "a successful unzip answers success true, extract_path relative to the server root naming the folder used, and the count of file entries (folders not counted)"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-28-ERR500` **Server errors answer 500** - MEDIUM; an unexpected failure answers 500 with success false and the error text
  - evidence: Galata test 'unzip endpoint › answers 500 with the error text for a file that is not a zip' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: unzip endpoint › answers 500 with the error text for a file that is not a zip
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T06:20:09Z @kj added
  - log: 2026-10-23T06:20:25Z @kj edited test "POST unzip for a file that is not a zip, assert 500" -> "ui-tests/tests/api.spec.ts: POST unzip for a file that is not a zip, assert 500"
  - log: 2026-10-23T06:38:23Z @kj edited test "ui-tests/tests/api.spec.ts: POST unzip for a file that is not a zip, assert 500" -> "ui-tests/tests/api.spec.ts: unzip endpoint › answers 500 with the error text for a file that is not a zip"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-29-ZIP409` **Zip answers 409 on an existing archive** - HIGH; POST zip for an archive name that exists answers 409 with success false; with overwrite true it replaces the archive and answers 200
  - evidence: Galata test 'zip endpoint, existing archive › answers 409 for an existing archive and 200 with overwrite true' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/api.spec.ts: zip endpoint, existing archive › answers 409 for an existing archive and 200 with overwrite true
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T07:59:59Z @kj added
  - log: 2026-10-23T08:09:46Z @kj edited test "ui-tests/tests/api.spec.ts: zip endpoint › answers 409 for an existing archive and 200 with overwrite true" -> "ui-tests/tests/api.spec.ts: zip endpoint, existing archive › answers 409 for an existing archive and 200 with overwrite true"
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `ACC-SERV-35-BODYOBJ` **Non-object JSON body answers 400** - MEDIUM; POST zip or unzip with valid JSON that is not an object answers 400
  - evidence: Galata test 'DEF-ARCH-11-NONOBJECT › a JSON body that is not an object answers 400' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - test: ui-tests/tests/defects.spec.ts: DEF-ARCH-11-NONOBJECT › a JSON body that is not an object answers 400
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T08:00:00Z @kj added
  - log: 2026-10-23T08:44:27Z @kj closed

