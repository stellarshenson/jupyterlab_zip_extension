import base64
import errno
import json
import os
import posixpath
import re
import shutil
import zipfile
import zlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from jupyter_client.jsonutil import json_default
from jupyter_core.paths import is_hidden
from jupyter_server.base.handlers import APIHandler
from jupyter_server.services.contents.manager import copy_pat
from jupyter_server.utils import ensure_async, url_path_join
import tornado.web
from tornado.ioloop import IOLoop


def _under_root(root_dir, path):
    """Resolve path against root_dir; refuse anything outside it, and the root itself."""
    root = os.path.abspath(root_dir)
    full = os.path.abspath(os.path.join(root, path))
    if full == root or os.path.commonpath([root, full]) != root:
        raise tornado.web.HTTPError(403, "Path is outside the server root")
    return full


async def _run_off_loop(handler, work):
    """Run blocking zip IO in a thread so other requests are served."""
    input_data = handler.get_json_body()
    if not isinstance(input_data, dict):
        raise tornado.web.HTTPError(400, "Request body must be a JSON object")
    try:
        status, body = await IOLoop.current().run_in_executor(None, work, handler, input_data)
    except tornado.web.HTTPError:
        raise
    except Exception as e:
        handler.log.error(f"[ZIP] Failed: {e}", exc_info=True)
        status, body = 500, {"success": False, "error": str(e)}
    handler.set_status(status)
    handler.finish(json.dumps(body))


def _free_folder(parent, stem, first_is_stem):
    """First folder name that does not exist: <stem>, then <stem> (1), <stem> (2), ..."""
    n = 0 if first_is_stem else 1
    while True:
        candidate = os.path.join(parent, stem if n == 0 else f"{stem} ({n})")
        if not os.path.exists(candidate):
            return candidate
        n += 1


def _unzip(handler, input_data):
    archive_path = input_data.get('archive_path')
    extract_to_named_folder = input_data.get('extract_to_named_folder', True)
    handler.log.info(f"[UNZIP] Called with params: {input_data}")

    if not archive_path:
        return 400, {"success": False, "error": "No archive path provided"}

    root_dir = os.path.expanduser(handler.settings['server_root_dir'])
    full_archive_path = _under_root(root_dir, archive_path)

    if not os.path.exists(full_archive_path):
        handler.log.error(f"[UNZIP] Archive not found: {full_archive_path}")
        return 404, {"success": False, "error": "Archive not found"}

    archive_dir = os.path.dirname(full_archive_path)
    stem = Path(archive_path).stem
    extract_dir = os.path.join(archive_dir, stem) if extract_to_named_folder else archive_dir

    with zipfile.ZipFile(full_archive_path, 'r') as zip_ref:
        names = zip_ref.namelist()
        # Never overwrite: a planned target that is a file, or that already holds a member, is replaced by a new folder
        if os.path.exists(extract_dir) and (
            not os.path.isdir(extract_dir)
            or any(not n.endswith('/') and os.path.exists(os.path.join(extract_dir, n)) for n in names)
        ):
            extract_dir = _free_folder(archive_dir, stem, not extract_to_named_folder)
        zip_ref.extractall(extract_dir)
        count = sum(1 for n in names if not n.endswith('/'))

    return 200, {
        "success": True,
        "extract_path": os.path.relpath(extract_dir, os.path.abspath(root_dir)),
        "message": f"Extracted {count} files"
    }


def _zip(handler, input_data):
    archive_name = input_data.get('archive_name')
    paths = input_data.get('paths', [])
    handler.log.info(f"[ZIP] Called with params: {input_data}")

    if not archive_name or not paths:
        handler.log.error("[ZIP] Missing parameters")
        return 400, {"success": False, "error": "Missing archive name or paths"}
    if os.path.basename(archive_name) != archive_name or archive_name in ('.', '..'):
        raise tornado.web.HTTPError(400, "Archive name must not contain a path")

    root_dir = os.path.expanduser(handler.settings['server_root_dir'])
    root = os.path.abspath(root_dir)

    # Archive goes into the first selected item's parent directory
    archive_path = os.path.join(os.path.dirname(_under_root(root_dir, paths[0])), archive_name)
    if os.path.exists(archive_path) and input_data.get('overwrite') is not True:
        return 409, {"success": False, "error": f"Archive {archive_name} already exists"}
    full_paths = [_under_root(root_dir, p) for p in paths]

    file_count = 0
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for full_path in full_paths:
            if os.path.isfile(full_path):
                zipf.write(full_path, os.path.basename(full_path))
                file_count += 1
            elif os.path.isdir(full_path):
                dir_name = os.path.basename(full_path)
                for walk_root, dirs, files in os.walk(full_path):
                    # a directory entry keeps empty folders
                    zipf.write(walk_root, os.path.normpath(os.path.join(dir_name, os.path.relpath(walk_root, full_path))))
                    for file in files:
                        file_path = os.path.join(walk_root, file)
                        zipf.write(file_path, os.path.join(dir_name, os.path.relpath(file_path, full_path)))
                        file_count += 1

    return 200, {
        "success": True,
        "archive_path": os.path.relpath(archive_path, root),
        "message": f"Created archive with {file_count} files"
    }


# A member larger than this (uncompressed, from the central directory) is not opened in the browser; copy and download stream it
MAX_OPEN_SIZE = 100 * 1024 * 1024


def _split_archive(root_dir, path, allow_hidden=True):
    """Split a browse path at its first segment ending in .zip: (archive file on disk, its API path, inner path).
    Without allow_hidden, a hidden archive or one in a hidden folder is missing, as in the contents API."""
    parts = [p for p in path.strip('/').split('/') if p]
    i = next((i for i, p in enumerate(parts) if p.lower().endswith('.zip')), None)
    if i is None:
        raise tornado.web.HTTPError(404, "The path names no archive")
    archive = _under_root(root_dir, '/'.join(parts[:i + 1]))
    if not os.path.isfile(archive) or (not allow_hidden and is_hidden(archive, os.path.abspath(root_dir))):
        raise tornado.web.HTTPError(404, "Archive not found")
    api_path = os.path.relpath(archive, os.path.abspath(root_dir)).replace(os.sep, '/')
    return archive, api_path, '/'.join(parts[i + 1:])


def _members(zf, allow_hidden=True):
    """Members by normalized name; absolute names and names with a .. segment are skipped,
    and without allow_hidden names with a segment starting with '.', the contents API's rule for hidden names."""
    members = {}
    for info in zf.infolist():
        name = info.filename
        if name.startswith(('/', '\\')) or re.match(r'[A-Za-z]:', name):
            continue
        parts = [p for p in name.split('/') if p not in ('', '.')]
        if parts and '..' not in parts and (allow_hidden or not any(p.startswith('.') for p in parts)):
            members['/'.join(parts)] = info
    return members


def _open(zf, info):
    """Open a member for reading; an encrypted member answers 400, since no password is ever asked for."""
    if info.flag_bits & 0x1:
        raise tornado.web.HTTPError(400, "The member is encrypted")
    return zf.open(info)


def _kind(members, inner):
    """'directory', 'file' or None for an inner path; a folder that exists only as a name prefix is a directory."""
    if not inner or any(n.startswith(inner + '/') for n in members):
        return 'directory'
    info = members.get(inner)
    if info is None:
        return None
    return 'directory' if info.is_dir() else 'file'


def _model(api_path, kind, info, archive_time):
    name = posixpath.basename(api_path)
    try:
        # A zip stores local wall-clock time without a zone, so the time carries no offset
        when = datetime(*info.date_time).isoformat() if info else archive_time
    except ValueError:
        # DOS date 0 (month 0, day 0) or a time out of range: the archive file's own time
        when = archive_time
    return {
        "name": name,
        "path": api_path,
        "type": 'notebook' if kind == 'file' and name.endswith('.ipynb') else kind,
        "writable": False,
        "created": when,
        "last_modified": when,
        "size": info.file_size if kind == 'file' else None,
        "mimetype": None,
        "format": None,
        "content": None,
    }


def _browse(root_dir, path, content, want_type, want_format, allow_hidden=True):
    """Contents model of a folder (one level) or a member inside an archive."""
    archive, archive_api, inner = _split_archive(root_dir, path, allow_hidden)
    archive_time = datetime.fromtimestamp(os.path.getmtime(archive), timezone.utc).isoformat()
    api_path = posixpath.join(archive_api, inner) if inner else archive_api
    with zipfile.ZipFile(archive) as zf:
        members = _members(zf, allow_hidden)
        kind = _kind(members, inner)
        if kind is None:
            raise tornado.web.HTTPError(404, "No such member in the archive")
        model = _model(api_path, kind, members.get(inner), archive_time)
        if not content:
            return model
        if kind == 'directory':
            prefix = inner + '/' if inner else ''
            children = {}
            for name, info in members.items():
                if name.startswith(prefix):
                    head, sep, _ = name[len(prefix):].partition('/')
                    if sep or info.is_dir():
                        children[head] = 'directory'
                    else:
                        children.setdefault(head, 'file')
            model["content"] = [
                _model(posixpath.join(api_path, head), child, members.get(prefix + head), archive_time)
                for head, child in sorted(children.items())
            ]
            model["format"] = 'json'
            return model
        if members[inner].file_size > MAX_OPEN_SIZE:
            raise tornado.web.HTTPError(
                400, f"The member is over {MAX_OPEN_SIZE >> 20} MB; copy it out of the archive to open it")
        with _open(zf, members[inner]) as src:
            data = src.read()
    if want_type == 'notebook' or (want_type is None and model["type"] == 'notebook'):
        try:
            model.update(type='notebook', format='json', content=json.loads(data))
        except ValueError:
            raise tornado.web.HTTPError(400, "The member is not a valid notebook")
        return model
    if want_format != 'base64':
        try:
            model.update(type='file', format='text', mimetype='text/plain', content=data.decode('utf-8'))
            return model
        except UnicodeDecodeError:
            if want_format == 'text':
                raise tornado.web.HTTPError(400, "The member is not UTF-8 encoded")
    model.update(type='file', format='base64', mimetype='application/octet-stream',
                 content=base64.b64encode(data).decode('ascii'))
    return model


def _copy_out(archive, inner, dest, allow_hidden=True):
    """Write one member, or a folder with every member under it, to dest; never overwrites.
    A failure removes dest, which this call created, so the target folder never keeps a partial copy."""
    with zipfile.ZipFile(archive) as zf:
        members = _members(zf, allow_hidden)
        kind = _kind(members, inner)
        if kind is None:
            raise tornado.web.HTTPError(404, "No such member in the archive")
        if kind == 'file':
            with _open(zf, members[inner]) as src:
                out = open(dest, 'xb')
                try:
                    with out:
                        shutil.copyfileobj(src, out)
                except BaseException:
                    os.remove(dest)
                    raise
            return
        os.mkdir(dest)
        try:
            for name, info in members.items():
                if not name.startswith(inner + '/'):
                    continue
                target = _under_root(dest, name[len(inner) + 1:])
                if info.is_dir():
                    os.makedirs(target, exist_ok=True)
                    continue
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with _open(zf, info) as src, open(target, 'xb') as out:
                    shutil.copyfileobj(src, out)
        except BaseException as e:
            shutil.rmtree(dest)
            # inside the new folder a name clash can only come from the archive itself
            if isinstance(e, (FileExistsError, NotADirectoryError)):
                raise tornado.web.HTTPError(400, "The archive holds a file and a folder with the same name")
            raise


async def _off_loop(work, *args):
    """Run blocking zip IO in a thread; a damaged archive or member answers 400.
    Error messages carry no user text: APIHandler sends log_message unformatted, and tornado's log formats it."""
    try:
        return await IOLoop.current().run_in_executor(None, work, *args)
    except zipfile.BadZipFile as e:
        raise tornado.web.HTTPError(400, "Not a valid zip archive")
    except UnicodeDecodeError:
        # zipfile decodes a member name flagged UTF-8 when it opens the archive or the member
        raise tornado.web.HTTPError(400, "The archive holds a member name that is not valid UTF-8")
    except (zlib.error, EOFError):
        raise tornado.web.HTTPError(400, "The member data is damaged")
    except NotImplementedError:
        # zipfile's answer for a compression method or another zip feature it cannot read
        raise tornado.web.HTTPError(400, "The member uses a zip feature that is not supported")
    except PermissionError:
        raise tornado.web.HTTPError(403, "Permission denied")
    except OSError as e:
        # The file system refused a name from the archive (too long, an invalid letter): 400; anything else
        # (no space left, a read-only disk) is the server's: 500. Both with a reason, never a traceback
        status = 400 if e.errno in (errno.ENAMETOOLONG, errno.EINVAL, errno.EILSEQ) else 500
        raise tornado.web.HTTPError(status, f"The file system refused the operation: {e.strerror or type(e).__name__}")


def _root(handler):
    return os.path.expanduser(handler.settings['server_root_dir'])


class BrowseHandler(APIHandler):
    """GET ?path=<archive path>/<inner path>: a contents model from inside an archive."""

    @tornado.web.authenticated
    async def get(self):
        model = await _off_loop(
            _browse,
            _root(self),
            self.get_query_argument('path', ''),
            self.get_query_argument('content', '1') != '0',
            self.get_query_argument('type', None),
            self.get_query_argument('format', None),
            self.contents_manager.allow_hidden,
        )
        self.finish(json.dumps(model, default=json_default))


class MemberHandler(APIHandler):
    """GET ?path=<archive path>/<member path>: the member bytes as a download."""

    @tornado.web.authenticated
    async def get(self):
        allow_hidden = self.contents_manager.allow_hidden
        archive, _, inner = _split_archive(_root(self), self.get_query_argument('path', ''), allow_hidden)

        def open_member():
            zf = zipfile.ZipFile(archive)
            try:
                members = _members(zf, allow_hidden)
                if _kind(members, inner) != 'file':
                    raise tornado.web.HTTPError(404, "No such file in the archive")
                return zf, _open(zf, members[inner])
            except BaseException:
                zf.close()
                raise

        zf, src = await _off_loop(open_member)
        try:
            self.set_header('Content-Type', 'application/octet-stream')
            self.set_header('Content-Disposition', f"attachment; filename*=UTF-8''{quote(posixpath.basename(inner))}")
            while chunk := await _off_loop(src.read, 1 << 20):
                self.write(chunk)
                await self.flush()
        finally:
            src.close()
            zf.close()
        self.finish(set_content_type='application/octet-stream')


class CopyHandler(APIHandler):
    """POST {path, to_dir}: copy a member or folder out of an archive, named the way the contents copy names a clash."""

    @tornado.web.authenticated
    async def post(self):
        body = self.get_json_body()
        if not isinstance(body, dict) or not isinstance(body.get('path'), str) or not isinstance(body.get('to_dir', ''), str):
            raise tornado.web.HTTPError(400, "Request body must be a JSON object with path and to_dir")
        root_dir = _root(self)
        cm = self.contents_manager
        archive, _, inner = _split_archive(root_dir, body['path'], cm.allow_hidden)
        if not inner:
            raise tornado.web.HTTPError(400, "Name a member or folder inside the archive")
        to_dir = body.get('to_dir', '').strip('/')
        dest_dir = _under_root(root_dir, to_dir) if to_dir else os.path.abspath(root_dir)
        if not os.path.isdir(dest_dir):
            raise tornado.web.HTTPError(404, "No such target folder")
        # the contents API refuses to create anything in a hidden folder
        if not cm.allow_hidden and is_hidden(dest_dir, os.path.abspath(root_dir)):
            raise tornado.web.HTTPError(400, "Cannot copy into a hidden folder")
        name = await ensure_async(cm.increment_filename(copy_pat.sub('.', posixpath.basename(inner)), to_dir, insert='-Copy'))
        await _off_loop(_copy_out, archive, inner, os.path.join(dest_dir, name), cm.allow_hidden)
        model = await ensure_async(cm.get(posixpath.join(to_dir, name), content=False))
        self.set_status(201)
        self.finish(json.dumps(model, default=json_default))


class UnzipHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self):
        await _run_off_loop(self, _unzip)


class ZipHandler(APIHandler):
    @tornado.web.authenticated
    async def post(self):
        await _run_off_loop(self, _zip)


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.
    """
    web_app = nb_server_app.web_app
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    
    handlers_routes = [
        (url_path_join(base_url, "jupyterlab-zip", "unzip") + '/?', UnzipHandler),
        (url_path_join(base_url, "jupyterlab-zip", "zip") + '/?', ZipHandler),
        (url_path_join(base_url, "jupyterlab-zip", "browse") + '/?', BrowseHandler),
        (url_path_join(base_url, "jupyterlab-zip", "member") + '/?', MemberHandler),
        (url_path_join(base_url, "jupyterlab-zip", "copy") + '/?', CopyHandler),
    ]
    
    web_app.add_handlers(host_pattern, handlers_routes)
    nb_server_app.log.info(f"Installing jupyterlab_zip handlers: {[route[0] for route in handlers_routes]}")

