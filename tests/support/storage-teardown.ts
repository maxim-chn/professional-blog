import assert from 'node:assert/strict';
import { isNonEmptyArray } from '../../src/lib/utilities/array_kit.ts';
import type { GitStorageBaseline } from './git-baseline.ts';
import { cleanGeneratedPostData } from './git-cleanup.ts';
import { restoreGitBaseline } from './git-restoration.ts';
import { restoreProtectedStorage } from './storage-restoration.ts';
import type { StorageSnapshot } from './storage-snapshot.ts';

export async function restoreStorage(
  baseline: GitStorageBaseline,
  snapshot: StorageSnapshot,
  generatedPostPaths: readonly string[],
  otherCreatedPaths: readonly string[],
): Promise<void> {
  assert.equal(baseline.root, snapshot.root, 'Restoration roots must match');
  const generated = new Set(generatedPostPaths);
  for (const path of otherCreatedPaths) {
    assert.ok(
      !generated.has(path),
      `Generated post data must use Git cleanup exclusively: ${path}`,
    );
  }

  const steps = [
    {
      name: 'Git baseline restoration',
      run: () => restoreGitBaseline(baseline),
    },
    {
      name: 'Generated post-data cleanup',
      run: () => cleanGeneratedPostData(baseline, snapshot, generatedPostPaths),
    },
    {
      name: 'Protected storage restoration',
      run: () =>
        restoreProtectedStorage(
          snapshot,
          baseline.files.map((file) => file.relativePath),
          otherCreatedPaths,
        ),
    },
  ];
  const failures: Error[] = [];

  for (const step of steps) {
    try {
      await step.run();
    } catch (cause) {
      failures.push(new Error(`${step.name} failed`, { cause }));
    }
  }

  if (isNonEmptyArray(failures)) {
    throw new AggregateError(
      failures,
      'Storage restoration failed; retain the snapshot and recorded Git baseline',
    );
  }
}
