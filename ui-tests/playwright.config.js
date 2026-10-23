/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

// Default 8889 keeps the suite off a developer's own lab on 8888.
// `||`, not a default value: an exported-but-empty variable must read as absent,
// the same as `or` in jupyter_server_test_config.py.
const PORT = process.env.JUPYTER_TEST_PORT || '8889';
const BASE_URL = `http://localhost:${PORT}`;

module.exports = {
  ...baseConfig,
  // The HTML report would otherwise open a viewer server on failure and block a detached run
  reporter: [['list'], ['html', { open: 'never' }]],
  // Specs share one server (settings folder, root directory)
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: 'jlpm start',
    url: `${BASE_URL}/lab`,
    timeout: 120 * 1000,
    // Never adopt a server this run did not start
    reuseExistingServer: false
  },
  use: {
    ...baseConfig.use,
    baseURL: BASE_URL
  }
};
