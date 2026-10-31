# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## [1.2.23] - 2026-10-31

### Changed

- Require Python 3.12

## [1.2.22] - 2026-10-31

### Changed

- Apply the template files and packages the upgrade left out

## [1.2.20] - 2026-10-30

### Changed

- The npm package and the labextension are now named `@stellarshenson/jupyterlab-zip-extension`, because npm refuses the unscoped dashed name and the URI parser of JupyterLab 4.6.5 refuses an underscore in a plugin id; the PyPI distribution and the Python module keep their names, so `pip install jupyterlab_zip_extension` is unchanged
- The settings id is now `@stellarshenson/jupyterlab-zip-extension:plugin`
- Built against JupyterLab 4.6.5, `@jupyter/builder` 1.2.4, prettier 3.9.10 and Galata 5.6.5; Python test extras floored at coverage 7.17 and pytest 9.2

### Fixed

- The Python package now declares `_jupyter_labextension_paths()`, which it lacked

## [1.2.18] - 2026-10-23

### Added

- Double-click or Enter on a `.zip` in the file browser enters the archive without opening a tab; folders open at any depth, and going up or clicking a crumb above the archive leaves it
- Files inside an archive open read-only in their usual viewer; notebooks open without starting a kernel; a member over 100 MB uncompressed is refused for the viewer and can still be copied or downloaded
- Copy and Paste copy files and folders out of an archive into a normal folder with the same bytes; a name clash gets JupyterLab's copy name (`name-Copy1.ext`)
- Inside an archive, rename, delete, new file, new folder, upload, paste, Save and Cut are refused; Create Archive and Extract Archive are hidden; a nested zip shows "Copy it out to browse it"
- Create Archive asks before it overwrites an existing archive
- Galata test suite (77 tests) and tracked acceptance criteria and defects in `docs/`

### Changed

- Extract Archive never overwrites: it extracts into the first free folder name (`name (1)`, `name (2)`, ...)
- A failed Create Archive or Extract Archive shows an error dialog instead of a console message only
- Built on extension template v4.6.5 and Makefile 1.46; requires JupyterLab 4.6 or later and Python 3.10 or later

### Fixed

- Both endpoints now require authentication; before, a client without a token could zip and unzip server files
- Paths outside the server root, and the root itself, are refused with 403
- The XSRF check is no longer disabled
- Empty folders are kept in archives; zip and unzip no longer block the server; a bad request body answers 400 instead of 500
- Extract Archive on `x.txt.zip` next to an existing `x.txt` no longer fails

<!-- <END NEW CHANGELOG ENTRY> -->
