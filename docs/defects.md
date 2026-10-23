# Defects

Known defects of the JupyterLab zip extension, found by reading src/index.ts, src/handler.ts and handlers.py.

## Authors

- `@kj` Konrad Jelen

## Security `SECU`

Request paths, cross-site requests and access limits

- [x] `DEF-SECU-1-TRAVERSAL` **Paths escape the server root** - CRITICAL; zip and unzip accept absolute paths and '..'; any file the server user can read is zipped, and archives or extracted files are written outside the root; also archive_name with '/' or '..'; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts DEF-SECU-1-TRAVERSAL: 8 tests (absolute path, archive_name, unzip path, root as '', '.', 'f.txt/..' and unzip '' and '.') passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: POST /jupyterlab-zip/zip with paths ["/etc/hostname"] and archive_name "../out.zip", see the zip written outside the root
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T08:35:44Z @kj _under_root accepted a path equal to the root; _zip took the archive dir from the parent of that item, one level above the root
  - root-cause: 2026-10-23T06:20:57Z @kj os.path.join(root_dir, p) returns p when p is absolute; '..' is never rejected; ZipHandler also skips the join explicitly for absolute paths; archive_name is joined unchecked
  - log: 2026-10-23T06:20:57Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-SECU-1-TRAVERSAL › zip refuses an absolute path outside the server root fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-SECU-1-TRAVERSAL › zip refuses an archive_name that leaves the item directory fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-SECU-1-TRAVERSAL › unzip refuses an archive path outside the server root fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj fixed in source, verified on 1.2.10: handlers.py resolves every path under the server root (403 outside) and refuses an archive_name holding a path; 3 defect tests pass
  - log: 2026-10-23T08:35:44Z @kj root-cause overridden; reason: round 3 found a second escape path
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `DEF-SECU-2-XSRF` **XSRF check disabled** - CRITICAL; both handlers override check_xsrf_cookie with pass, so a cross-site POST carrying the user's session cookie runs zip or unzip; `jupyterlab_zip_extension/handlers.py`
  - evidence: 1.2.13 installed with XSRF checking on: auth-probe.py probe B (login cookie, no _xsrf) answers 403 and writes no archive; logs/auth-probe-verify-1.log
  - repro: POST /jupyterlab-zip/unzip with the session cookie and no X-XSRFToken header, see 200 instead of 403
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:57Z @kj check_xsrf_cookie overridden with pass in UnzipHandler and ZipHandler; the body is parsed without a content-type check, so a plain form post works
  - log: 2026-10-23T06:20:57Z @kj added
  - log: 2026-10-23T06:38:28Z @kj no galata test: configure_jupyter_server sets disable_check_xsrf, so the server never checks the token
  - log: 2026-10-23T06:52:26Z @kj fixed in source, verified on 1.2.10: check_xsrf_cookie overrides removed from both handlers; frontend callZipAPI sends the token; no galata test (test server disables the check)
  - log: 2026-10-23T08:44:28Z @kj left open: no test and no verifier proof; fix (check_xsrf_cookie overrides removed in handlers.py) was only diff-checked in 05-verify-1/2; needs a run with XSRF checking enabled
  - log: 2026-10-23T08:49:09Z @kj XSRF proof, installed 1.2.12 with XSRF checking on: POST with a login cookie and no _xsrf or X-XSRFToken answers 403 and writes no archive (auth-probe.py probe B, logs/auth-probe-before.log); defect left open
  - log: 2026-10-23T09:21:08Z @kj closed
- [x] `DEF-SECU-13-NOAUTH` **Zip and unzip answer a client with no token** - CRITICAL; POST /jupyterlab-zip/zip with no token and an _xsrf cookie from GET /login answers 200 and writes the archive, because the post methods are not authenticated and the server allows unauthenticated access by default; `jupyterlab_zip_extension/handlers.py`
  - evidence: 1.2.13 installed: auth-probe.py probe A (no token) answers 403 and writes no archive; logs/auth-probe-verify-1.log, tmp/workflows/template-upgrade/04-verify-1.json
  - repro: python tmp/workflows/zip-campaign/auth-probe.py BASE_URL TOKEN ROOT against a running server, probe A answers 200 and probe-a.zip appears instead of 403
  - test-tags: MANUAL
  - root-cause: 2026-10-23T08:49:02Z @kj ZipHandler.post and UnzipHandler.post carry no @tornado.web.authenticated; jupyter_server 2.21.1 skips its own check in JupyterHandler.prepare when ServerApp.allow_unauthenticated_access is True, the default
  - log: 2026-10-23T08:49:02Z @kj added
  - log: 2026-10-23T08:49:08Z @kj fix is in source (@tornado.web.authenticated on both post methods); proven only after the next make install and a rerun of auth-probe.py
  - log: 2026-10-23T09:21:08Z @kj closed

## Data loss `DATA`

Existing files replaced without a prompt

- [x] `DEF-DATA-3-ZIPOVER` **Zip overwrites existing archive** - MAJOR; an archive of the same name is replaced with no question and no warning; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts 'DEF-DATA-3-ZIPOVER a second zip of the same name keeps the first archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: create a.zip from file x twice, second time from file y, see x gone from a.zip
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:58Z @kj zipfile.ZipFile(archive_path, 'w') truncates; no os.path.exists check, no UI confirmation
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-DATA-3-ZIPOVER and DEF-DATA-4-UNZOVER › a second zip of the same name keeps the first archive fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj needs decision: when the archive name exists, overwrite after a confirmation, refuse with an error, or pick a new name such as a (1).zip?
  - log: 2026-10-23T07:59:59Z @kj decision @kj 2026-10-23: ZipHandler answers 409 when the archive exists unless the body carries overwrite true; the frontend on 409 asks to overwrite in a dialog naming the archive; Ok resends with overwrite true, Cancel writes nothing
  - log: 2026-10-23T08:09:46Z @kj fixed in source, verified on 1.2.11: galata 42 of 42 green (logs/galata-after-fix2-rerun2.log); 409 without overwrite, confirm dialog in src/index.ts
  - log: 2026-10-23T08:44:27Z @kj closed
- [x] `DEF-DATA-4-UNZOVER` **Unzip overwrites existing files** - MAJOR; extraction replaces files that already exist at the target with no question; worst with extractToNamedFolder false; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts DEF-DATA-4-UNZOVER 'extract keeps an existing file byte for byte' (2 tests) passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: set extractToNamedFolder false, edit a file that also sits in the zip, extract, see the edit lost
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:58Z @kj ZipFile.extractall overwrites; no existence check, no UI confirmation
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-DATA-3-ZIPOVER and DEF-DATA-4-UNZOVER › unzip keeps a file that already exists at the target fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj needs decision: when an extracted file already exists, overwrite after a confirmation, skip it, refuse the whole extract, or extract into a new folder?
  - log: 2026-10-23T08:00:04Z @kj decision @kj 2026-10-23: no overwrite, no dialog; if the planned target is a file or a member would overwrite a file in it, extract into the first absent of stem/ (in-place only), stem (1)/, stem (2)/, ...; extract_path names the folder used
  - log: 2026-10-23T08:09:46Z @kj fixed in source, verified on 1.2.11: galata 42 of 42 green (logs/galata-after-fix2-rerun2.log); _unzip picks a free folder
  - log: 2026-10-23T08:44:27Z @kj closed

## Feedback `FEED`

What the user sees after a failed operation

- [x] `DEF-FEED-5-SILENT` **Failed operation shows nothing** - MAJOR; a failed zip or unzip only writes console.error; the spinner closes and the user sees no message; the same holds for the console.warn on a wrong selection; `src/index.ts`
  - evidence: Galata defects.spec.ts 'DEF-FEED-5-SILENT a failed extract tells the user' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: stop the server or unzip a non-zip file named x.zip, watch the dialog close with no message
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:52:40Z @kj execute handlers only call console.error; a dialog added there waits on the launch queue taken while the spinner is live, and disposing the spinner rejects that promise, so the error dialog never shows unless the spinner is disposed first
  - root-cause: 2026-10-23T06:20:58Z @kj execute handlers catch the error and call console.error; no showErrorMessage or Notification call
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-FEED-5-SILENT › a failed extract tells the user fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj needs rebuild: showErrorMessage added in 1.2.10 but the dialog never shows, because Dialog.dispose rejects the spinner's launch promise and the queued error dialog waits on it; src/index.ts now disposes the spinner before showErrorMessage, not built; defect test still fails on 1.2.10
  - log: 2026-10-23T08:09:46Z @kj fixed in source, verified on 1.2.11: galata 42 of 42 green (logs/galata-after-fix2-rerun2.log); spinner disposed before the error dialog
  - log: 2026-10-23T08:44:28Z @kj closed

## Archive content `ARCH`

What goes into a created archive

- [x] `DEF-ARCH-6-EMPTYDIR` **Empty folders dropped from archive** - MEDIUM; an empty folder, or an empty subfolder, is missing from the zip, so the folder structure is not kept; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts 'DEF-ARCH-6-EMPTYDIR an empty subfolder is kept in the archive' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: make folder d with an empty subfolder e and one file, archive d, unzip, see no d/e
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:58Z @kj the os.walk loop writes files only; directories get no zip entry
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-ARCH-6-EMPTYDIR › an empty subfolder is kept in the archive fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj fixed in source, verified on 1.2.10: every walked directory gets a zip entry; defect test passes. Side effect: the unzip message counts directory entries (Extracted 3 files for 2 files and a folder)
  - log: 2026-10-23T08:44:28Z @kj closed
- [ ] `DEF-ARCH-7-BLOCKING` **Large archive freezes the server** - MEDIUM; zip and unzip run synchronously inside the request handler; all other requests wait until a large archive is finished; `jupyterlab_zip_extension/handlers.py`
  - repro: zip a folder of several GB, open another notebook meanwhile, see it wait
  - test-tags: MANUAL
  - root-cause: 2026-10-23T06:20:58Z @kj post is a plain def doing zipfile IO on the Tornado event loop, no executor
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:29Z @kj no galata test: a several-GB archive is needed; stays MANUAL
  - log: 2026-10-23T06:52:26Z @kj fixed in source on 1.2.10: zip and unzip IO run through run_in_executor; stays MANUAL, no multi-GB check made; 33 other tests pass
  - log: 2026-10-23T08:44:28Z @kj left open: no test and no verifier proof; fix (zip and unzip in run_in_executor) was only diff-checked; needs a several-GB archive run with a second request served meanwhile
- [x] `DEF-ARCH-8-EMPTYBODY` **Bad body answers 500, not 400** - MINOR; a request with no body or malformed JSON answers 500 instead of 400; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts 'DEF-ARCH-8-EMPTYBODY a request with no body or malformed JSON answers 400' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: POST /jupyterlab-zip/zip with an empty body, see 500 'NoneType' object has no attribute 'get'
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:58Z @kj get_json_body returns None for an empty body and raises HTTPError 400 for bad JSON; the blanket except Exception turns both into 500
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-ARCH-8-EMPTYBODY › a request with no body or malformed JSON answers 400 fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:40Z @kj fixed in source, verified on 1.2.10: empty body answers 400 and HTTPError is no longer turned into 500; defect test passes with its bad JSON sent as raw bytes. A valid JSON non-object body still answers 500, not fixed
  - log: 2026-10-23T08:44:28Z @kj closed
- [x] `DEF-ARCH-9-BLANKNAME` **Blank archive name accepted** - MINOR; a name of only spaces passes the dialog check and creates a file named '  .zip'; `src/index.ts`
  - evidence: Galata defects.spec.ts 'DEF-ARCH-9-BLANKNAME an archive name of spaces creates no file' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: Create Archive, replace the name with three spaces, accept
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:20:58Z @kj the check is 'result.value' truthiness; the value is not trimmed
  - log: 2026-10-23T06:20:58Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-ARCH-9-BLANKNAME › an archive name of spaces creates no file fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj fixed in source, verified on 1.2.10: name is trimmed, a blank name sends no request; defect test passes
  - log: 2026-10-23T08:44:28Z @kj closed
- [x] `DEF-ARCH-11-NONOBJECT` **JSON body that is not an object answers 500** - MEDIUM; POST zip or unzip with a body such as "abc" or [1] answers 500 instead of 400; cause input_data.get on a str or list; fix: body must be a JSON object, else 400; `jupyterlab_zip_extension/handlers.py`
  - evidence: Galata defects.spec.ts 'DEF-ARCH-11-NONOBJECT a JSON body that is not an object answers 400' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: POST /jupyterlab-zip/zip with the body "abc" and Content-Type application/json, see 500
  - test-tags: FUNCTIONAL
  - log: 2026-10-23T07:59:30Z @kj added
  - log: 2026-10-23T07:59:59Z @kj reported during the fix stage: a JSON string body answered 500 after the empty-body fix
  - log: 2026-10-23T08:09:46Z @kj fixed in source, verified on 1.2.11: galata 42 of 42 green (logs/galata-after-fix2-rerun2.log); non-object body answers 400
  - log: 2026-10-23T08:44:28Z @kj closed

## Extraction `EXTR`

What happens when an archive is extracted

- [x] `DEF-EXTR-10-NAMECLASH` **Extract fails beside the archived file** - MAJOR; Extract Archive on <file>.zip answers 500 while <file> still exists, because the named folder <file> is that file; the default Create Archive then Extract Archive flow fails; with DEF-FEED-5-SILENT the user sees nothing; jupyterlab_zip_extension/handlers.py
  - evidence: Galata defects.spec.ts 'DEF-EXTR-10-NAMECLASH x.txt.zip beside x.txt extracts into x.txt (1)' passed in logs/galata-verify-4.log (47 passed, 0 failed) against 1.2.12
  - repro: create x.txt, Create Archive (x.txt.zip), Extract Archive with extractToNamedFolder true, see POST unzip 500 and no extraction
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T06:31:41Z @kj extract_dir is dir/Path(archive).stem, which equals the existing file x.txt; ZipFile.extractall cannot create a directory over a file
  - log: 2026-10-23T06:31:41Z @kj added
  - log: 2026-10-23T06:38:23Z @kj test ui-tests/tests/defects.spec.ts: DEF-EXTR-10-NAMECLASH › extract succeeds while the archived file still exists fails on 1.2.9 (galata baseline 2026-10-23)
  - log: 2026-10-23T06:52:26Z @kj needs decision: when the named folder equals an existing file (x.txt beside x.txt.zip), extract into a renamed folder such as x.txt (1), extract beside the archive, or refuse with an error?
  - log: 2026-10-23T07:59:59Z @kj decision @kj 2026-10-23: same rule as DEF-DATA-4-UNZOVER; x.txt.zip beside x.txt extracts into x.txt (1)/
  - log: 2026-10-23T08:09:46Z @kj fixed in source, verified on 1.2.11: galata 42 of 42 green (logs/galata-after-fix2-rerun2.log); x.txt.zip extracts into x.txt (1)
  - log: 2026-10-23T08:44:28Z @kj closed
- [ ] `DEF-EXTR-12-FILEFOLDER` **Extract fails when an archive folder name equals an existing file** - MEDIUM; Extract Archive in place answers 500 NotADirectoryError when a member such as a/b.txt needs a folder a and a is an existing file in the target folder; members listed before it are already written, so the extraction is partial; `jupyterlab_zip_extension/handlers.py`
  - repro: python3 tmp/workflows/zip-campaign/08-scratch/repro.py: folder holds file a, archive members c.txt then a/b.txt, _unzip with extract_to_named_folder false raises NotADirectoryError, c.txt is written, a/b.txt is not
  - test-tags: FUNCTIONAL
  - root-cause: 2026-10-23T08:46:43Z @kj the clash test in _unzip checks only exact member paths with os.path.exists, so a member whose parent folder path is an existing file passes it and ZipFile.extractall fails mid-way
  - log: 2026-10-23T08:46:43Z @kj added

