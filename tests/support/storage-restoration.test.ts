import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { restoreProtectedStorage } from './storage-restoration.ts';
import { captureStorageSnapshot, readStorageTree } from './storage-snapshot.ts';

const BASELINE_PATH = join('records', 'baseline.json');
const AUTHOR_PATH = join('records', 'author.bin');

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'storage-restoration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'storage');
  await mkdir(join(root, 'records'), { recursive: true });
  await mkdir(join(root, 'empty'));
  await writeFile(join(root, BASELINE_PATH), 'Pre-run baseline edit');
  await writeFile(join(root, AUTHOR_PATH), Buffer.from([0, 255, 13, 10]));
  await writeFile(join(root, 'catalogue.json'), '{"author":"preserve"}\n');

  const snapshotFile = join(directory, 'snapshot.json');
  const snapshot = await captureStorageSnapshot(root, snapshotFile);
  return { directory, root, snapshotFile, snapshot };
}

test('restores protected bytes and directories while preserving separately restored baseline data', async (t) => {
  const { root, snapshotFile, snapshot } = await createFixture(t);
  const baselineBytes = Buffer.from('Separately restored baseline');
  await writeFile(join(root, BASELINE_PATH), baselineBytes);
  await unlink(join(root, AUTHOR_PATH));
  await writeFile(join(root, 'catalogue.json'), '{"changed":true}');
  await rm(join(root, 'empty'), { recursive: true });
  await mkdir(join(root, 'staging', 'nested'), { recursive: true });
  const generated = join('staging', 'nested', 'generated.bin');
  await writeFile(join(root, generated), 'Generated data');

  await restoreProtectedStorage(
    snapshot,
    [BASELINE_PATH],
    ['staging', join('staging', 'nested'), generated],
  );

  const expected = {
    directories: snapshot.directories,
    files: snapshot.files.map((file) =>
      file.relativePath === BASELINE_PATH
        ? { ...file, base64: baselineBytes.toString('base64') }
        : file,
    ),
  };
  assert.deepEqual(await readStorageTree(root), expected);
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, 'utf8')), snapshot);

  await restoreProtectedStorage(
    snapshot,
    [BASELINE_PATH],
    ['staging', join('staging', 'nested'), generated],
  );
  assert.deepEqual(await readStorageTree(root), expected);
});

test('rejects unsafe cleanup scopes and unrecorded additions before changing storage', async (t) => {
  const { root, snapshotFile, snapshot } = await createFixture(t);
  await writeFile(join(root, 'catalogue.json'), 'Changed catalogue');
  const before = await readStorageTree(root);

  for (const path of [AUTHOR_PATH, BASELINE_PATH, 'empty']) {
    await assert.rejects(
      restoreProtectedStorage(snapshot, [BASELINE_PATH], [path]),
      {
        message: `Cleanup path overlaps pre-existing or baseline data: ${path}`,
      },
    );
    assert.deepEqual(await readStorageTree(root), before);
  }

  for (const path of ['../outside', root, '.', 'records/../outside']) {
    await assert.rejects(
      restoreProtectedStorage(snapshot, [BASELINE_PATH], [path]),
      { message: `Invalid storage-relative path: ${path}` },
    );
    assert.deepEqual(await readStorageTree(root), before);
  }

  await writeFile(join(root, 'unrecorded.txt'), 'Do not delete');
  const withAddition = await readStorageTree(root);
  await assert.rejects(restoreProtectedStorage(snapshot, [BASELINE_PATH], []), {
    message: 'Unrecorded storage addition: unrecorded.txt',
  });
  assert.deepEqual(await readStorageTree(root), withAddition);
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, 'utf8')), snapshot);
});

test('rejects symbolic links without modifying their targets or discarding the snapshot', async (t) => {
  const { directory, root, snapshotFile, snapshot } = await createFixture(t);
  const externalFile = join(directory, 'external.bin');
  const externalBytes = Buffer.from([128, 0, 255]);
  await writeFile(externalFile, externalBytes);
  await unlink(join(root, AUTHOR_PATH));
  await symlink(externalFile, join(root, AUTHOR_PATH));

  await assert.rejects(restoreProtectedStorage(snapshot, [BASELINE_PATH], []), {
    message: `Unsupported storage entry: ${AUTHOR_PATH}`,
  });
  assert.deepEqual(await readFile(externalFile), externalBytes);
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, 'utf8')), snapshot);
});
