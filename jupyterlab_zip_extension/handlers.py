import json
import os
import zipfile
from pathlib import Path

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado.web


class UnzipHandler(APIHandler):
    def check_xsrf_cookie(self):
        """Disable CSRF for API endpoint"""
        pass

    def post(self):
        try:
            input_data = self.get_json_body()
            archive_path = input_data.get('archive_path')
            self.log.info(f"[UNZIP] Called with params: {input_data}")
            
            if not archive_path:
                self.set_status(400)
                self.finish(json.dumps({"success": False, "error": "No archive path provided"}))
                return
                
            root_dir = os.path.expanduser(self.settings['server_root_dir'])
            self.log.debug(f"[UNZIP] Root dir: {root_dir}")
            
            full_archive_path = os.path.join(root_dir, archive_path)
            full_archive_path = os.path.expanduser(full_archive_path)
            self.log.debug(f"[UNZIP] Full archive path: {full_archive_path}")
            
            if not os.path.exists(full_archive_path):
                self.log.error(f"[UNZIP] Archive not found: {full_archive_path}")
                self.set_status(404)
                self.finish(json.dumps({"success": False, "error": "Archive not found"}))
                return
                
            archive_name = Path(archive_path).stem
            extract_dir = os.path.join(os.path.dirname(full_archive_path), f"{archive_name}_extracted")
            self.log.debug(f"[UNZIP] Extracting to: {extract_dir}")
            
            with zipfile.ZipFile(full_archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
            relative_extract_path = os.path.relpath(extract_dir, root_dir)
            self.log.debug(f"[UNZIP] Extracted to: {relative_extract_path}")
            
            self.finish(json.dumps({
                "success": True, 
                "extract_path": relative_extract_path,
                "message": f"Extracted {len(zip_ref.namelist())} files"
            }))
            
        except Exception as e:
            self.log.error(f"[UNZIP] Failed: {e}", exc_info=True)
            self.set_status(500)
            self.finish(json.dumps({"success": False, "error": str(e)}))


class ZipHandler(APIHandler):
    def check_xsrf_cookie(self):
        pass

    def post(self):
        try:
            input_data = self.get_json_body()
            archive_name = input_data.get('archive_name')
            paths = input_data.get('paths', [])

            self.log.info(f"[ZIP] Called with params: {input_data}")
            
            if not archive_name or not paths:
                self.log.error(f"[ZIP] Missing parameters")
                self.set_status(400)
                self.finish(json.dumps({"success": False, "error": "Missing archive name or paths"}))
                return
            
            root_dir = os.path.expanduser(self.settings['server_root_dir'])
            self.log.debug(f"[ZIP] Root dir: {root_dir}")
            
            # Use first selected item's PARENT directory for archive location
            first_path = paths[0]
            full_first_path = os.path.join(root_dir, first_path) if not os.path.isabs(first_path) else first_path
            full_first_path = os.path.expanduser(full_first_path)
            
            # Always use parent directory - whether file or folder
            archive_dir = os.path.dirname(full_first_path)
            archive_path = os.path.join(archive_dir, archive_name)
            
            self.log.debug(f"[ZIP] Archive will be created at: {archive_path}")
            
            file_count = 0
            with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for path in paths:
                    full_path = os.path.join(root_dir, path) if not os.path.isabs(path) else path
                    full_path = os.path.expanduser(full_path)
                    
                    if os.path.isfile(full_path):
                        arcname = os.path.basename(full_path)
                        self.log.debug(f"[ZIP] Adding file: {arcname}")
                        zipf.write(full_path, arcname)
                        file_count += 1
                    elif os.path.isdir(full_path):
                        dir_name = os.path.basename(full_path)
                        for root, dirs, files in os.walk(full_path):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join(dir_name, os.path.relpath(file_path, full_path))
                                self.log.debug(f"[ZIP] Adding: {arcname}")
                                zipf.write(file_path, arcname)
                                file_count += 1
            
            self.log.debug(f"[ZIP] Archive created with {file_count} files at {archive_path}")
            
            relative_archive = os.path.relpath(archive_path, root_dir)
            
            self.finish(json.dumps({
                "success": True,
                "archive_path": relative_archive,
                "message": f"Created archive with {file_count} files"
            }))
            
        except Exception as e:
            self.log.error(f"[ZIP] Failed: {e}", exc_info=True)
            self.set_status(500)
            self.finish(json.dumps({"success": False, "error": str(e)}))
    


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

