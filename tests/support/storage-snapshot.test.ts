import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { captureStorageSnapshot, readStorageTree } from './storage-snapshot.ts';

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'storage-snapshot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const root = join(directory, 'storage');
  const snapshots = join(directory, 'snapshots');
  await mkdir(root);
  await mkdir(snapshots);

  return { root, snapshots };
}

test('captures exact bytes and empty directories without changing storage', async (t) => {
  const { root, snapshots } = await createFixture(t);
  const bytes = Buffer.from([0, 255, 13, 10, 128]);
  await mkdir(join(root, 'empty'));
  await mkdir(join(root, 'records'));
  await writeFile(join(root, 'records', 'binary'), bytes);
  await writeFile(join(root, 'author.txt'), '  Author text 😀\r\n');

  const expected = {
    directories: ['empty', 'records'],
    files: [
      {
        relativePath: 'author.txt',
        base64: Buffer.from('  Author text 😀\r\n').toString('base64'),
      },
      {
        relativePath: join('records', 'binary'),
        base64: bytes.toString('base64'),
      },
    ],
  };
  const snapshotFile = join(snapshots, 'snapshot.json');
  const snapshot = await captureStorageSnapshot(root, snapshotFile);

  assert.deepEqual(snapshot, {
    root: await realpath(root),
    ...expected,
  });
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, 'utf8')), snapshot);
  assert.deepEqual(await readStorageTree(root), expected);

  const savedBytes = await readFile(snapshotFile);
  await assert.rejects(captureStorageSnapshot(root, snapshotFile), {
    code: 'EEXIST',
  });
  assert.deepEqual(await readFile(snapshotFile), savedBytes);
});

test('rejects snapshots inside storage and symbolic-link entries', async (t) => {
  const { root, snapshots } = await createFixture(t);

  await assert.rejects(
    captureStorageSnapshot(root, join(root, 'snapshot.json')),
    /Snapshot must be outside the storage root/,
  );
  assert.deepEqual(await readStorageTree(root), {
    directories: [],
    files: [],
  });

  const externalFile = join(snapshots, 'author.txt');
  await writeFile(externalFile, 'Protected external text');
  await symlink(externalFile, join(root, 'linked-file'));

  const snapshotFile = join(snapshots, 'snapshot.json');
  await assert.rejects(
    captureStorageSnapshot(root, snapshotFile),
    /Unsupported storage entry: linked-file/,
  );
  await assert.rejects(readFile(snapshotFile), { code: 'ENOENT' });
  assert.equal(await readFile(externalFile, 'utf8'), 'Protected external text');
});
