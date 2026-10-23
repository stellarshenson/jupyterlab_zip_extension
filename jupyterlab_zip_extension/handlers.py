import json
import os
import zipfile
from pathlib import Path

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
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
    ]
    
    web_app.add_handlers(host_pattern, handlers_routes)
    nb_server_app.log.info(f"Installing jupyterlab_zip handlers: {[route[0] for route in handlers_routes]}")

