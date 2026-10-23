"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
import os
from tempfile import mkdtemp

from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

# The test server must not read or write the developer's own user settings
c.LabApp.user_settings_dir = mkdtemp(prefix="galata-settings-")

# Scratch deletes must not go to the platform trash (send2trash fails on a /tmp root)
# The developer's ~/.jupyter/jupyter_lab_config.py sets it on the more specific manager classes,
# which outrank FileContentsManager, so all three are set
for manager in ("FileContentsManager", "AsyncFileContentsManager", "AsyncLargeFileManager"):
    getattr(c, manager).delete_to_trash = False

# An open Message-of-the-day tab keeps the Launcher inactive and hangs every test;
# traitlets ignores the line where that extension is not installed
c.GalaxaHubMotd.open_on_start = False

# `or`, not a get() default: an exported-but-empty value must fall back, as `||` does in
# playwright.config.js. The default keeps the suite off a developer's lab on 8888.
c.ServerApp.port = int(os.environ.get("JUPYTER_TEST_PORT") or "8889")

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
