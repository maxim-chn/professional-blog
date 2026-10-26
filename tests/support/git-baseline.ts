import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { isNonEmptyArray } from '../../src/lib/utilities/array_kit.ts';
import { isNonEmptyString } from '../../src/lib/utilities/string_kit.ts';
import type { StorageFile } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const REGULAR_FILE_MODES = ['100644', '100755'];

export interface GitStorageBaseline {
  repository: string;
  root: string;
  revision: string;
  files: StorageFile[];
}

export async function captureGitBaseline(
  root: string,
  paths: readonly string[],
): Promise<GitStorageBaseline> {
  assert.ok(isAbsolute(root), 'Storage root must be absolute');
  assert.ok(isNonEmptyArray(paths), 'Baseline paths must not be empty');
  assert.equal(new Set(paths).size, paths.length, 'Duplicate baseline paths');

  const resolvedRoot = await realpath(root);
  const repositoryResult = await executeFile('git', [
    '-C',
    resolvedRoot,
    'rev-parse',
    '--show-toplevel',
  ]);
  const repository = await realpath(repositoryResult.stdout.trim());
  const rootRelative = relative(repository, resolvedRoot);
  assert.ok(
    isNonEmptyString(rootRelative) &&
      rootRelative !== '..' &&
      !rootRelative.startsWith(`..${sep}`) &&
      !isAbsolute(rootRelative),
    'Storage must be a directory inside the repository',
  );

  const revisionResult = await executeFile('git', [
    '-C',
    repository,
    'rev-parse',
    '--verify',
    'HEAD^{commit}',
  ]);
  const revision = revisionResult.stdout.trim();
  const files: StorageFile[] = [];

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
    const repositoryPath = relative(repository, join(resolvedRoot, path));
    const treeResult = await executeFile('git', [
      '-C',
      repository,
      '--literal-pathspecs',
      'ls-tree',
      '-z',
      revision,
      '--',
      repositoryPath,
    ]);
    const entry = treeResult.stdout;
    const separator = entry.indexOf('\t');
    const [mode, kind, objectId] = entry.slice(0, separator).split(' ');
    assert.ok(
      separator > 0 &&
        REGULAR_FILE_MODES.includes(mode) &&
        kind === 'blob' &&
        entry.slice(separator + 1) === `${repositoryPath}\0`,
      `Baseline path must identify one regular Git file: ${path}`,
    );

    const sizeResult = await executeFile('git', [
      '-C',
      repository,
      'cat-file',
      '-s',
      objectId,
    ]);
    const size = Number(sizeResult.stdout.trim());
    assert.ok(
      Number.isSafeInteger(size) && size >= 0,
      'Invalid Git baseline object size: ' + path,
    );
    const contents = await executeFile(
      'git',
      ['-C', repository, 'cat-file', 'blob', objectId],
      { encoding: 'buffer', maxBuffer: size },
    );
    files.push({
      relativePath: path,
      base64: contents.stdout.toString('base64'),
    });
  }

  return { repository, root: resolvedRoot, revision, files };
}
