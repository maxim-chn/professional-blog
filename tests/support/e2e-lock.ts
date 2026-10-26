import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, realpath, rmdir } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

export async function acquireE2eLock(
  root: string,
  lockDirectory: string,
): Promise<() => Promise<void>> {
  assert.ok(isAbsolute(root), 'Storage root must be absolute');
  assert.ok(isAbsolute(lockDirectory), 'Lock directory must be absolute');
  const resolvedRoot = await realpath(root);
  const resolvedDirectory = await realpath(lockDirectory);
  const relativeDirectory = relative(resolvedRoot, resolvedDirectory);
  assert.ok(
    relativeDirectory === '..' ||
      relativeDirectory.startsWith('..' + sep) ||
      isAbsolute(relativeDirectory),
    'E2E lock must be outside the storage root',
  );
  const identity = createHash('sha256').update(resolvedRoot).digest('hex');
  const lock = join(resolvedDirectory, identity + '.lock');
  await mkdir(lock);

  let release: Promise<void> | undefined;
  return () => {
    release ??= rmdir(lock);
    return release;
  };
}
