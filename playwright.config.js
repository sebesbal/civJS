const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: true
  }
});
