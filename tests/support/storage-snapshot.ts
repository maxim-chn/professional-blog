import assert from 'node:assert/strict';
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';

export interface StorageFile {
  relativePath: string;
  base64: string;
}

export interface StorageTree {
  directories: string[];
  files: StorageFile[];
}

export interface StorageSnapshot extends StorageTree {
  root: string;
}

export async function readStorageTree(root: string): Promise<StorageTree> {
  assert.ok(isAbsolute(root), 'Storage root must be absolute');
  const directories: string[] = [];
  const files: StorageFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = relative(root, path);

      if (entry.isDirectory()) {
        directories.push(relativePath);
        await visit(path);
      } else if (entry.isFile()) {
        files.push({
          relativePath,
          base64: (await readFile(path)).toString('base64'),
        });
      } else {
        throw new Error(`Unsupported storage entry: ${relativePath}`);
      }
    }
  }

  await visit(root);
  return { directories, files };
}

export async function captureStorageSnapshot(
  root: string,
  snapshotFile: string,
): Promise<StorageSnapshot> {
  assert.ok(isAbsolute(root), 'Storage root must be absolute');
  assert.ok(isAbsolute(snapshotFile), 'Snapshot filename must be absolute');

  const resolvedRoot = await realpath(root);
  const snapshotParent = await realpath(dirname(snapshotFile));
  const parentRelativeToRoot = relative(resolvedRoot, snapshotParent);
  assert.ok(
    parentRelativeToRoot === '..' ||
      parentRelativeToRoot.startsWith(`..${sep}`) ||
      isAbsolute(parentRelativeToRoot),
    'Snapshot must be outside the storage root',
  );

  const snapshot: StorageSnapshot = {
    root: resolvedRoot,
    ...(await readStorageTree(resolvedRoot)),
  };

  await writeFile(
    join(snapshotParent, basename(snapshotFile)),
    JSON.stringify(snapshot),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );

  return snapshot;
}
