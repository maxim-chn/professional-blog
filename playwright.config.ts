import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { loadE2eConfig } from './tests/support/e2e-config.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('./tests/config/e2e.json', import.meta.url),
);
const TEST_DIRECTORY = fileURLToPath(new URL('./tests/e2e/', import.meta.url));
const TEST_FILE_PATTERN = '**/*.spec.ts';

assert.equal(
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  '0',
  'Run browser tests with PLAYWRIGHT_BROWSERS_PATH=0 to use project-local browsers',
);

const settings = await loadE2eConfig(CONFIG_FILE);

export default defineConfig({
  testDir: TEST_DIRECTORY,
  testMatch: TEST_FILE_PATTERN,
  fullyParallel: false,
  forbidOnly: true,
  workers: settings.workers,
  retries: settings.retries,
  timeout: settings.testTimeoutMs,
  expect: { timeout: settings.expectTimeoutMs },
  outputDir: settings.outputDirectory,
  reporter: [
    ['list'],
    ['html', { outputFolder: settings.reportDirectory, open: 'never' }],
  ],
  use: {
    browserName: settings.browser,
    headless: settings.headless,
    actionTimeout: settings.expectTimeoutMs,
    navigationTimeout: settings.testTimeoutMs,
    trace: settings.trace,
    screenshot: settings.screenshot,
  },
});
