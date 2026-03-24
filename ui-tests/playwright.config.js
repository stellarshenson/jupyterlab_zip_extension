/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  webServer: {
    command: 'jlpm start --port 8889',
    url: 'http://localhost:8889/lab',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  use: {
    ...baseConfig.use,
    baseURL: 'http://localhost:8889'
  }
};
