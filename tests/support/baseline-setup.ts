import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { realpath, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import type { PersistenceConfig } from '../../src/lib/persistence/config.ts';
import { FileSystemAdapter } from '../../src/lib/persistence/filesystem.ts';
import { reconcileBaselineCatalogue } from './baseline-catalogue.ts';
import type { BaselinePost } from './baseline-config.ts';
import type { GitStorageBaseline } from './git-baseline.ts';
import { restoreGitBaseline } from './git-restoration.ts';
import { runWithCleanup } from './run-with-cleanup.ts';
import {
  captureStorageSnapshot,
  type StorageSnapshot,
} from './storage-snapshot.ts';
import { restoreStorage } from './storage-teardown.ts';

const executeFile = promisify(execFile);
const CATALOGUE_FILE = 'catalogue.json';

export async function prepareBaselineStorage(
  baseline: GitStorageBaseline,
  initialSnapshot: StorageSnapshot,
  posts: readonly BaselinePost[],
  config: PersistenceConfig,
  preparedSnapshotFile: string,
): Promise<StorageSnapshot> {
  assert.equal(baseline.root, initialSnapshot.root);
  assert.equal(await realpath(config.root), baseline.root);
  assert.deepEqual(
    new Set(baseline.files.map((file) => file.relativePath)),
    new Set(posts.flatMap((post) => post.paths)),
    'Captured baseline paths must match the configured selections',
  );

  const cataloguePath = join(baseline.root, CATALOGUE_FILE);
  const repositoryPath = relative(baseline.repository, cataloguePath);
  const committed = await executeFile('git', [
    '-C',
    baseline.repository,
    'show',
    `${baseline.revision}:${repositoryPath}`,
  ]);
  const originalCatalogue = initialSnapshot.files.find(
    (file) => file.relativePath === CATALOGUE_FILE,
  );
  const current: unknown = originalCatalogue
    ? JSON.parse(
        Buffer.from(originalCatalogue.base64, 'base64').toString('utf8'),
      )
    : [];
  const reconciled = reconcileBaselineCatalogue(
    current,
    JSON.parse(committed.stdout),
    posts,
    config,
  );
  const createdPaths = originalCatalogue ? [] : [CATALOGUE_FILE];
  let prepared = false;

  return runWithCleanup(
    async () => {
      await restoreGitBaseline(baseline);
      if (reconciled.changed) {
        await writeFile(cataloguePath, JSON.stringify(reconciled.entries));
      }

      const adapter = new FileSystemAdapter(config);
      for (const post of posts) {
        const bundle = await adapter.getPost(post.postId);
        const recordIds = [
          bundle.post.id,
          bundle.metadata.id,
          ...bundle.contents.map((content) => content.id),
          ...bundle.media.map((media) => media.id),
        ];
        const expectedPaths = [
          ...recordIds.map((id) => join('records', `${id}.json`)),
          ...bundle.media.map((media) => join('media', `${media.id}.bin`)),
        ];
        assert.deepEqual(
          new Set(post.paths),
          new Set(expectedPaths),
          `Baseline selection must match the complete post: ${post.postId}`,
        );
      }

      const snapshot = await captureStorageSnapshot(
        baseline.root,
        preparedSnapshotFile,
      );
      prepared = true;
      return snapshot;
    },
    async () => {
      if (!prepared) {
        await restoreStorage(baseline, initialSnapshot, [], createdPaths);
      }
    },
  );
}
