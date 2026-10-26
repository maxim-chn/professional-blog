import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadE2eConfig, type E2eConfig } from './e2e-config.ts';
import { loadE2eRuntime, type E2eRuntime } from './e2e-runtime.ts';
import { startE2eServer } from './e2e-server.ts';
import { runWithCleanup } from './run-with-cleanup.ts';
import { readStorageTree } from './storage-snapshot.ts';

const E2E_CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);
const MISMATCHED_ORIGIN = 'http://127.0.0.1:1';

async function withIsolatedRuntime(
  operation: (runtime: E2eRuntime, settings: E2eConfig) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'e2e-server-'));
  await runWithCleanup(
    async () => {
      const settings = await loadE2eConfig(E2E_CONFIG_FILE);
      const runtime = await loadE2eRuntime(
        settings.isolatedRuntimeConfig,
        root,
      );
      await operation(runtime, settings);
    },
    () => rm(root, { recursive: true, force: true }),
  );
}

test('starts the configured server, refuses port reuse, and supports repeated shutdown', async () => {
  await withIsolatedRuntime(async (runtime, settings) => {
    const before = await readStorageTree(runtime.persistence.root);
    const server = await startE2eServer(runtime, settings);
    await runWithCleanup(
      async () => {
        assert.equal(server.origin, runtime.publication.visitorOrigin);
        const response = await fetch(server.origin, {
          signal: AbortSignal.timeout(settings.testTimeoutMs),
        });
        assert.equal(response.status, 200);
        await response.text();

        await assert.rejects(async () => {
          const duplicate = await startE2eServer(runtime, settings);
          await duplicate.stop();
        });

        const stillRunning = await fetch(server.origin, {
          signal: AbortSignal.timeout(settings.testTimeoutMs),
        });
        assert.equal(stillRunning.status, 200);
        await stillRunning.text();
      },
      () => server.stop(),
    );
    await server.stop();
    assert.deepEqual(await readStorageTree(runtime.persistence.root), before);

    const restarted = await startE2eServer(runtime, settings);
    await restarted.stop();
  });
});

test('shuts down its child after an origin mismatch so a subsequent start succeeds', async () => {
  await withIsolatedRuntime(async (runtime, settings) => {
    const mismatched = {
      ...runtime,
      publication: {
        ...runtime.publication,
        visitorOrigin: MISMATCHED_ORIGIN,
      },
    };
    await assert.rejects(
      async () => {
        const unexpected = await startE2eServer(mismatched, settings);
        await unexpected.stop();
      },
      (error: unknown) =>
        error instanceof Error && error.cause instanceof assert.AssertionError,
    );

    const server = await startE2eServer(runtime, settings);
    await server.stop();
  });
});
