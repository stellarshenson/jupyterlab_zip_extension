import json
import os
import zipfile
from pathlib import Path

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado.web


class ZipHandler(APIHandler):

    def check_xsrf_cookie(self):
        """Disable CSRF for API endpoint"""
        self.log.info("Skipping XSRF check for ZipHandler")
        pass

    @tornado.web.authenticated
    def get(self):
        self.log.info("error - called GET")
        self.set_status(500)
        self.finish(json.dumps({"success": False, "error": str(e)}))
    
    @tornado.web.authenticated
    def post(self):
        self.log.info("success - called POST")
        try:
            input_data = self.get_json_body()
            archive_path = input_data.get('archive_path')
            
            if not archive_path:
                self.set_status(400)
                self.finish(json.dumps({"success": False, "error": "No archive path provided"}))
                return
                
            # Get absolute path from Jupyter root
            root_dir = self.settings['server_root_dir']

            # Handle absolute vs relative paths
            full_archive_path = os.path.join(root_dir, archive_path)
            
            # Expand any tilde in the final path
            full_archive_path = os.path.expanduser(full_archive_path)
            
            if not os.path.exists(full_archive_path):
                self.set_status(404)
                self.finish(json.dumps({"success": False, "error": "Archive not found"}))
                self.log.error(f'archive not found: {full_archive_path}')
                return
                
            # Create extraction directory
            archive_name = Path(archive_path).stem
            extract_dir = os.path.join(os.path.dirname(full_archive_path), f"{archive_name}_extracted")
            
            with zipfile.ZipFile(full_archive_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
            relative_extract_path = os.path.relpath(extract_dir, root_dir)
            
            self.finish(json.dumps({
                "success": True, 
                "extract_path": relative_extract_path,
                "message": f"Extracted {len(zip_ref.namelist())} files"
            }))
            
        except Exception as e:
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
        (url_path_join(base_url, "jupyterlab-zip", "unzip") + '/?', ZipHandler),
    ]
    
    web_app.add_handlers(
        host_pattern,
        handlers_routes,
    )

    nb_server_app.log.info(f"Installing jupyterlab_zip handler: {handlers_routes}")
