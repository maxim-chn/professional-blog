import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';
import { loadE2eConfig } from '../support/e2e-config.ts';
import { loadE2eRuntime, type E2eRuntime } from '../support/e2e-runtime.ts';
import { startE2eServer } from '../support/e2e-server.ts';
import { runWithCleanup } from '../support/run-with-cleanup.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);

export const settings = await loadE2eConfig(CONFIG_FILE);

interface IsolatedSession {
  origin: string;
  runtime: E2eRuntime;
}

export const test = base.extend<{ session: IsolatedSession }>({
  session: [
    async ({ browserName }, use) => {
      expect(browserName).toBe(settings.browser);
      await mkdir(settings.logDirectory, { recursive: true });
      const root = await mkdtemp(join(tmpdir(), 'blog-browser-e2e-'));

      await runWithCleanup(
        async () => {
          const runtime = await loadE2eRuntime(
            settings.isolatedRuntimeConfig,
            root,
          );
          const server = await startE2eServer(runtime, settings);
          const logFile = join(settings.logDirectory, basename(root) + '.log');

          await runWithCleanup(
            () => use({ origin: server.origin, runtime }),
            () =>
              runWithCleanup(
                () => server.stop(),
                () =>
                  writeFile(logFile, server.getOutput(), {
                    flag: 'wx',
                    mode: 0o600,
                  }),
              ),
          );
        },
        () => rm(root, { recursive: true, force: true }),
      );
    },
    { auto: true },
  ],
});

export { expect };
