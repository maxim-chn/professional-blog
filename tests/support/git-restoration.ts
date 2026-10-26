import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { isNonEmptyArray } from '../../src/lib/utilities/array_kit.ts';
import { isNonEmptyString } from '../../src/lib/utilities/string_kit.ts';
import type { GitStorageBaseline } from './git-baseline.ts';
import { readStorageTree } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const COMMIT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export async function restoreGitBaseline(
  baseline: GitStorageBaseline,
): Promise<void> {
  assert.equal(await realpath(baseline.repository), baseline.repository);
  assert.equal(await realpath(baseline.root), baseline.root);
  assert.ok(
    COMMIT_ID_PATTERN.test(baseline.revision),
    'Invalid baseline revision',
  );
  assert.ok(
    isNonEmptyArray(baseline.files),
    'Baseline files must not be empty',
  );

  const rootRelative = relative(baseline.repository, baseline.root);
  assert.ok(
    isNonEmptyString(rootRelative) &&
      rootRelative !== '..' &&
      !rootRelative.startsWith(`..${sep}`) &&
      !isAbsolute(rootRelative),
    'Storage must be a directory inside the repository',
  );

  const paths = baseline.files.map((file) => file.relativePath);
  assert.equal(new Set(paths).size, paths.length, 'Duplicate baseline paths');
  for (const path of paths) {
    assert.ok(
      isNonEmptyString(path) &&
        !isAbsolute(path) &&
        path !== '.' &&
        path !== '..' &&
        !path.startsWith(`..${sep}`) &&
        normalize(path) === path,
      `Invalid baseline path: ${path}`,
    );
  }

  await readStorageTree(baseline.root);

  for (const path of paths) {
    const repositoryPath = relative(
      baseline.repository,
      join(baseline.root, path),
    );
    await executeFile('git', [
      '-C',
      baseline.repository,
      '--literal-pathspecs',
      'restore',
      '--source',
      baseline.revision,
      '--worktree',
      '--',
      repositoryPath,
    ]);
  }

  for (const file of baseline.files) {
    const bytes = await readFile(join(baseline.root, file.relativePath));
    assert.deepEqual(
      bytes,
      Buffer.from(file.base64, 'base64'),
      `Restored baseline bytes differ: ${file.relativePath}`,
    );
  }
}
