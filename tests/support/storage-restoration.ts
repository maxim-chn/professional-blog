import assert from 'node:assert/strict';
import { mkdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { isNonEmptyString } from '../../src/lib/utilities/string_kit.ts';
import { readStorageTree, type StorageSnapshot } from './storage-snapshot.ts';

function checkRelativePath(path: string): void {
  assert.ok(
    isNonEmptyString(path) &&
      !isAbsolute(path) &&
      path !== '.' &&
      path !== '..' &&
      !path.startsWith(`..${sep}`) &&
      normalize(path) === path,
    `Invalid storage-relative path: ${path}`,
  );
}

export async function restoreProtectedStorage(
  snapshot: StorageSnapshot,
  baselinePaths: readonly string[],
  createdPaths: readonly string[],
): Promise<void> {
  assert.equal(await realpath(snapshot.root), snapshot.root);

  const baseline = new Set(baselinePaths);
  const created = new Set(createdPaths);
  const originalFiles = new Map(
    snapshot.files.map((file) => [file.relativePath, file.base64]),
  );
  const originalDirectories = new Set(snapshot.directories);

  for (const path of [
    ...baseline,
    ...created,
    ...originalFiles.keys(),
    ...originalDirectories,
  ]) {
    checkRelativePath(path);
  }

  for (const path of created) {
    assert.ok(
      !baseline.has(path) &&
        !originalFiles.has(path) &&
        !originalDirectories.has(path),
      `Cleanup path overlaps pre-existing or baseline data: ${path}`,
    );
  }

  const expectedDirectories = new Set(originalDirectories);
  for (const path of baseline) {
    let parent = dirname(path);
    while (parent !== '.') {
      expectedDirectories.add(parent);
      parent = dirname(parent);
    }
  }

  const current = await readStorageTree(snapshot.root);
  const extraFiles = current.files.filter(
    (file) =>
      !originalFiles.has(file.relativePath) && !baseline.has(file.relativePath),
  );
  const extraDirectories = current.directories.filter(
    (path) => !expectedDirectories.has(path),
  );

  for (const path of [
    ...extraFiles.map((file) => file.relativePath),
    ...extraDirectories,
  ]) {
    assert.ok(created.has(path), `Unrecorded storage addition: ${path}`);
  }

  for (const file of extraFiles) {
    await unlink(join(snapshot.root, file.relativePath));
  }
  for (const path of [...extraDirectories].reverse()) {
    await rmdir(join(snapshot.root, path));
  }
  for (const path of expectedDirectories) {
    await mkdir(join(snapshot.root, path), { recursive: true });
  }

  const currentFiles = new Map(
    current.files.map((file) => [file.relativePath, file.base64]),
  );
  for (const [path, base64] of originalFiles) {
    if (!baseline.has(path) && currentFiles.get(path) !== base64) {
      await writeFile(join(snapshot.root, path), Buffer.from(base64, 'base64'));
    }
  }

  const restored = await readStorageTree(snapshot.root);
  const protectedFiles = restored.files.filter(
    (file) => !baseline.has(file.relativePath),
  );
  assert.deepEqual(
    new Map(protectedFiles.map((file) => [file.relativePath, file.base64])),
    new Map(
      snapshot.files
        .filter((file) => !baseline.has(file.relativePath))
        .map((file) => [file.relativePath, file.base64]),
    ),
    'Protected storage files must match the snapshot exactly',
  );
  assert.deepEqual(
    new Set(restored.directories),
    expectedDirectories,
    'Storage directories must match the snapshot and baseline requirements',
  );
}
