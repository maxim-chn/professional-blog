import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  sep,
} from 'node:path';
import { promisify } from 'node:util';
import { uuid } from '../../src/lib/persistence/models/fields.ts';
import {
  isEmpty,
  isNonEmptyString,
} from '../../src/lib/utilities/string_kit.ts';
import type { GitStorageBaseline } from './git-baseline.ts';
import { readStorageTree, type StorageSnapshot } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const POST_DATA_EXTENSIONS = new Map([
  ['records', '.json'],
  ['media', '.bin'],
]);

export async function cleanGeneratedPostData(
  baseline: GitStorageBaseline,
  snapshot: StorageSnapshot,
  generatedPaths: readonly string[],
): Promise<void> {
  assert.equal(snapshot.root, baseline.root);
  assert.equal(await realpath(snapshot.root), snapshot.root);
  assert.equal(await realpath(baseline.repository), baseline.repository);
  const rootRelative = relative(baseline.repository, snapshot.root);
  assert.ok(
    isNonEmptyString(rootRelative) &&
      rootRelative !== '..' &&
      !rootRelative.startsWith(`..${sep}`) &&
      !isAbsolute(rootRelative),
    'Storage must be a directory inside the repository',
  );

  const protectedPaths = new Set([
    ...snapshot.files.map((file) => file.relativePath),
    ...snapshot.directories,
    ...baseline.files.map((file) => file.relativePath),
  ]);
  const current = await readStorageTree(snapshot.root);

  for (const path of generatedPaths) {
    const directory = dirname(path);
    const extension = extname(path);
    const identifier = basename(path, extension);
    assert.ok(
      POST_DATA_EXTENSIONS.get(directory) === extension &&
        path === join(directory, `${identifier}${extension}`),
      `Cleanup requires an explicit post-data file path: ${path}`,
    );
    uuid(identifier, `Generated post-data identity: ${path}`);
    assert.ok(!protectedPaths.has(path), `Cleanup path is protected: ${path}`);
    assert.ok(
      !current.directories.includes(path),
      `Cleanup path is a directory: ${path}`,
    );

    const repositoryPath = relative(
      baseline.repository,
      join(snapshot.root, path),
    );
    const tracked = await executeFile('git', [
      '-C',
      baseline.repository,
      '--literal-pathspecs',
      'ls-files',
      '--cached',
      '-z',
      '--',
      repositoryPath,
    ]);
    assert.ok(isEmpty(tracked.stdout), `Cleanup path is Git-tracked: ${path}`);
  }

  for (const path of new Set(generatedPaths)) {
    const repositoryPath = relative(
      baseline.repository,
      join(snapshot.root, path),
    );
    await executeFile('git', [
      '-C',
      baseline.repository,
      '--literal-pathspecs',
      'clean',
      '-f',
      '-x',
      '--',
      repositoryPath,
    ]);
    await assert.rejects(lstat(join(snapshot.root, path)), { code: 'ENOENT' });
  }
}
