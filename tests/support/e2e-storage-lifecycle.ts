import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersistenceConfig } from '../../src/lib/persistence/config.ts';
import type { PostBundle } from '../../src/lib/persistence/contract.ts';
import type { BaselinePost } from './baseline-config.ts';
import { prepareBaselineStorage } from './baseline-setup.ts';
import { acquireE2eLock } from './e2e-lock.ts';
import { captureGitBaseline, type GitStorageBaseline } from './git-baseline.ts';
import { findPublicationArtifacts } from './publication-artifacts.ts';
import { planPublicationCleanup } from './publication-scope.ts';
import { runWithCleanup } from './run-with-cleanup.ts';
import {
  captureStorageSnapshot,
  readStorageTree,
  type StorageSnapshot,
} from './storage-snapshot.ts';
import { restoreStorage } from './storage-teardown.ts';

export interface E2eStorageSession {
  recoveryDirectory: string;
  registerPublication(bundle: PostBundle): Promise<void>;
}

export async function withBaselineStorage<T>(
  config: PersistenceConfig,
  posts: readonly BaselinePost[],
  snapshotDirectory: string,
  operation: (session: E2eStorageSession) => Promise<T>,
): Promise<T> {
  const release = await acquireE2eLock(config.root, snapshotDirectory);
  let recoveryDirectory: string | undefined;
  let baseline: GitStorageBaseline | undefined;
  let initial: StorageSnapshot | undefined;
  let prepared: StorageSnapshot | undefined;
  let mutationStarted = false;
  let restored = false;
  let acceptingPublications = false;
  const generated = new Set<string>();

  async function registerPublication(bundle: PostBundle): Promise<void> {
    assert.ok(
      acceptingPublications,
      'Storage session is not accepting publications',
    );
    assert.ok(recoveryDirectory);
    const paths = await planPublicationCleanup(bundle, config);
    for (const path of paths) {
      assert.ok(
        !generated.has(path),
        'Fixture path already registered: ' + path,
      );
    }
    for (const path of paths) generated.add(path);
    await writeFile(
      join(recoveryDirectory, 'publication-' + randomUUID() + '.json'),
      JSON.stringify({
        root: config.root,
        postId: bundle.post.id,
        generatedPostPaths: paths,
      }),
      { flag: 'wx', mode: 0o600 },
    );
  }

  async function cleanup(): Promise<void> {
    acceptingPublications = false;
    await runWithCleanup(
      async () => {
        if (!mutationStarted) return;
        assert.ok(baseline && initial && recoveryDirectory);
        const recordedBaseline = baseline;
        const cleanupFile = join(recoveryDirectory, 'cleanup.json');
        const snapshot = prepared ?? initial;
        const generatedPostPaths = [...generated];
        let otherCreatedPaths: string[] = [];
        await runWithCleanup(
          async () => {
            otherCreatedPaths = findPublicationArtifacts(
              snapshot,
              await readStorageTree(snapshot.root),
              [
                ...recordedBaseline.files.map((file) => file.relativePath),
                ...generatedPostPaths,
              ],
            );
            await writeFile(
              cleanupFile,
              JSON.stringify({
                root: snapshot.root,
                baselineFile: 'baseline.json',
                snapshotFile: prepared
                  ? 'prepared-snapshot.json'
                  : 'initial-snapshot.json',
                generatedPostPaths,
                otherCreatedPaths,
              }),
              { flag: 'wx', mode: 0o600 },
            );
          },
          async () => {
            await restoreStorage(
              recordedBaseline,
              snapshot,
              generatedPostPaths,
              otherCreatedPaths,
            );
            restored = true;
          },
        );
      },
      async () => {
        if (!mutationStarted || restored) await release();
      },
    );
  }

  return runWithCleanup(async () => {
    recoveryDirectory = await mkdtemp(join(snapshotDirectory, 'run-'));
    baseline = await captureGitBaseline(
      config.root,
      posts.flatMap((post) => post.paths),
    );
    await writeFile(
      join(recoveryDirectory, 'baseline.json'),
      JSON.stringify(baseline),
      { flag: 'wx', mode: 0o600 },
    );
    initial = await captureStorageSnapshot(
      config.root,
      join(recoveryDirectory, 'initial-snapshot.json'),
    );
    mutationStarted = true;
    prepared = await prepareBaselineStorage(
      baseline,
      initial,
      posts,
      config,
      join(recoveryDirectory, 'prepared-snapshot.json'),
    );
    acceptingPublications = true;
    return await operation({ recoveryDirectory, registerPublication });
  }, cleanup);
}
