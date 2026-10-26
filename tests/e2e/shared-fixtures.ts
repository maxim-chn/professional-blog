import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';
import { loadBaselineConfig } from '../support/baseline-config.ts';
import { loadE2eConfig } from '../support/e2e-config.ts';
import { withSharedE2e, type E2eSession } from '../support/e2e-lifecycle.ts';
import { loadE2eRuntime } from '../support/e2e-runtime.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);

export const settings = await loadE2eConfig(CONFIG_FILE);

export const test = base.extend<{ session: E2eSession }>({
  session: [
    async ({ browserName }, use) => {
      expect(browserName).toBe(settings.browser);
      await mkdir(settings.snapshotDirectory, { recursive: true });
      await mkdir(settings.logDirectory, { recursive: true });
      const runtime = await loadE2eRuntime(settings.runtimeConfig);
      const posts = await loadBaselineConfig(settings.baselineConfig);
      await withSharedE2e(runtime, settings, posts, use);
    },
    { auto: true },
  ],
});

export { expect };
