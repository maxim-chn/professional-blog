import assert from 'node:assert/strict';
import { realpath, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { loadPublicationBundle } from '../../src/lib/publication/bundle.ts';
import type { BaselinePost } from './baseline-config.ts';
import type { E2eConfig } from './e2e-config.ts';
import type { E2eRuntime } from './e2e-runtime.ts';
import { startE2eServer } from './e2e-server.ts';
import { withBaselineStorage } from './e2e-storage-lifecycle.ts';
import { runPublicationCli } from './publication-cli.ts';
import { runWithCleanup } from './run-with-cleanup.ts';

type CliOutput = Awaited<ReturnType<typeof runPublicationCli>>;

export interface E2eSession {
  origin: string;
  recoveryDirectory: string;
  publish(): Promise<CliOutput>;
}

export async function withSharedE2e<T>(
  runtime: E2eRuntime,
  settings: E2eConfig,
  posts: readonly BaselinePost[],
  operation: (session: E2eSession) => Promise<T>,
): Promise<T> {
  const root = await realpath(runtime.persistence.root);
  const logDirectory = await realpath(settings.logDirectory);
  const relativeLogs = relative(root, logDirectory);
  assert.ok(
    relativeLogs === '..' ||
      relativeLogs.startsWith('..' + sep) ||
      isAbsolute(relativeLogs),
    'E2E logs must be outside the storage root',
  );
  const fixture = await loadPublicationBundle(
    settings.publicationManifest,
    runtime.persistence,
  );

  return withBaselineStorage(
    runtime.persistence,
    posts,
    settings.snapshotDirectory,
    async (storage) => {
      await storage.registerPublication(fixture);
      const server = await startE2eServer(runtime, settings);
      const logFile = join(
        logDirectory,
        basename(storage.recoveryDirectory) + '.log',
      );
      let closed = false;
      let publishing = false;
      let publication: Promise<CliOutput> | undefined;

      function publish(): Promise<CliOutput> {
        assert.ok(!closed, 'E2E session is closed');
        assert.ok(!publishing, 'E2E publications must run serially');
        publishing = true;
        publication = (async () => {
          const current = await loadPublicationBundle(
            settings.publicationManifest,
            runtime.persistence,
          );
          assert.deepEqual(
            current,
            fixture,
            'Publication inputs changed during E2E',
          );
          return await runPublicationCli(
            runtime,
            settings.publicationManifest,
            settings.publicationTimeoutMs,
          );
        })().finally(() => {
          publishing = false;
        });
        return publication;
      }

      async function shutdown(): Promise<void> {
        closed = true;
        await runWithCleanup(
          () =>
            runWithCleanup(
              async () => {
                await publication;
              },
              () => server.stop(),
            ),
          () =>
            writeFile(logFile, server.getOutput(), { flag: 'wx', mode: 0o600 }),
        );
      }

      return runWithCleanup(
        () =>
          operation({
            origin: server.origin,
            recoveryDirectory: storage.recoveryDirectory,
            publish,
          }),
        shutdown,
      );
    },
  );
}
