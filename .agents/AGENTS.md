<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml/etc. when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`uv install`/`npm install`
- **No automatic git commits or pushes** - only when user explicitly requests

## Project Context

JupyterLab 4 extension that adds Create Archive and Extract Archive actions to the file browser. A TypeScript frontend calls a Python server extension that builds and unpacks zip files.

- Frontend: `src/index.ts` (commands, file-browser context menu, zip file type, spinner dialog), `src/handler.ts` (`callZipAPI`)
- Server: `jupyterlab_zip_extension/handlers.py`, endpoints `POST /jupyterlab-zip/zip` and `POST /jupyterlab-zip/unzip`
- Setting `extractToNamedFolder` in `schema/plugin.json`
- npm package `jupyterlab_zip_extension`, PyPI package `jupyterlab-zip-extension`
- Build: hatch with `hatch-nodejs-version`, version read from `package.json`
- Tests: Jest in `src/__tests__`, Galata (Playwright) in `ui-tests/`
- Trackers: `docs/acc-crit.md` and `docs/defects.md`, written only through pm-tools with author handle `@kj`

## Journal Rules (Project-Specific)

- **APPEND ONLY**: New journal entries MUST be appended at the end of the file, never inserted between existing entries
- Entries maintain strict chronological order by position - the last entry in the file is always the most recent work
- Never reorder, move, or insert entries out of sequence
- The Stellars **journal plugin** is the canonical tool for this file: create via `/journal:create`, append via `/journal:update`, archive via `/journal:archive`. The `journal:journal` skill auto-triggers on any mention of "journal" and runs `journal-tools check` after every write
- Direct edits to `JOURNAL.md` are a last resort - prefer the plugin so modus secundis format, continuous numbering and append-only order are enforced automatically

## Strengthened Rules

- next time do not publish automatically, it is forbidden without explicit acknowledgement
- `make build` and `make install` run `increment_version`, so each run raises the patch version in `package.json`
- `pyproject.toml` reads the version from `package.json` through `hatch-nodejs-version`
- Every `make install` is a version change and needs the Star Colonel's approval
- `make publish` also commits and pushes
- Galata tests run against the extension installed in the environment, so a source change is untested until a rebuild
