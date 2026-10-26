import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.ts';
import { loadE2eConfig } from './tests/support/e2e-config.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('./tests/config/e2e.json', import.meta.url),
);
const settings = await loadE2eConfig(CONFIG_FILE);

export default defineConfig(baseConfig, {
  testMatch: '**/failure-scenario.ts',
  outputDir: settings.outputDirectory + '-failure',
  reporter: [['json']],
});
