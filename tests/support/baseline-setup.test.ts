import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { CatalogueEntry } from '../../src/lib/persistence/service.ts';
import { prepareBaselineStorage } from './baseline-setup.ts';
import { createBaselineSetupFixture } from './baseline-setup-fixture.ts';
import { readStorageTree } from './storage-snapshot.ts';

type Fixture = Awaited<ReturnType<typeof createBaselineSetupFixture>>;
const CATALOGUE_FILE = 'catalogue.json';

async function verifyRecoveryFiles(fixture: Fixture): Promise<void> {
  assert.deepEqual(
    JSON.parse(await readFile(fixture.baselineFile, 'utf8')),
    fixture.baseline,
  );
  assert.deepEqual(
    JSON.parse(await readFile(fixture.initialSnapshotFile, 'utf8')),
    fixture.initialSnapshot,
  );
}

test('prepares complete baseline posts while preserving author data', async (t) => {
  const fixture = await createBaselineSetupFixture(t);
  const originalCatalogue = fixture.initialSnapshot.files.find(
    (file) => file.relativePath === CATALOGUE_FILE,
  );
  assert.ok(originalCatalogue);
  const originalEntries: CatalogueEntry[] = JSON.parse(
    Buffer.from(originalCatalogue.base64, 'base64').toString('utf8'),
  );

  const prepared = await prepareBaselineStorage(
    fixture.baseline,
    fixture.initialSnapshot,
    fixture.posts,
    fixture.config,
    fixture.preparedSnapshotFile,
  );

  assert.deepEqual(
    await fixture.adapter.getPost(fixture.baselinePost.post.id),
    {
      ...fixture.baselinePost,
      post: JSON.parse(JSON.stringify(fixture.baselinePost.post)),
    },
  );
  assert.deepEqual(await fixture.adapter.getPost(fixture.authorPost.post.id), {
    ...fixture.authorPost,
    post: JSON.parse(JSON.stringify(fixture.authorPost.post)),
  });

  const catalogue: CatalogueEntry[] = JSON.parse(
    await readFile(join(fixture.root, CATALOGUE_FILE), 'utf8'),
  );
  assert.equal(catalogue.length, 2);
  assert.deepEqual(
    catalogue.find(
      (entry) => entry.registry.post_id === fixture.authorPost.post.id,
    ),
    originalEntries.find(
      (entry) => entry.registry.post_id === fixture.authorPost.post.id,
    ),
  );
  assert.deepEqual(
    catalogue.find(
      (entry) => entry.registry.post_id === fixture.baselinePost.post.id,
    )?.metadata,
    fixture.baselinePost.metadata,
  );

  const baselinePaths = new Set(
    fixture.baseline.files.map((file) => file.relativePath),
  );
  const protectedFiles = (files: typeof prepared.files) =>
    files.filter(
      (file) =>
        !baselinePaths.has(file.relativePath) &&
        file.relativePath !== CATALOGUE_FILE,
    );
  assert.deepEqual(
    protectedFiles(prepared.files),
    protectedFiles(fixture.initialSnapshot.files),
  );
  assert.deepEqual(prepared, {
    root: fixture.root,
    ...(await readStorageTree(fixture.root)),
  });
  assert.deepEqual(
    JSON.parse(await readFile(fixture.preparedSnapshotFile, 'utf8')),
    prepared,
  );
  await verifyRecoveryFiles(fixture);
});

test('rolls back setup when the prepared snapshot cannot be saved', async (t) => {
  const fixture = await createBaselineSetupFixture(t);

  await assert.rejects(
    prepareBaselineStorage(
      fixture.baseline,
      fixture.initialSnapshot,
      fixture.posts,
      fixture.config,
      fixture.initialSnapshotFile,
    ),
    { code: 'EEXIST' },
  );

  const expectedFiles = new Map(
    fixture.initialSnapshot.files.map((file) => [
      file.relativePath,
      file.base64,
    ]),
  );
  for (const file of fixture.baseline.files) {
    expectedFiles.set(file.relativePath, file.base64);
  }
  const restored = await readStorageTree(fixture.root);
  assert.deepEqual(
    new Map(restored.files.map((file) => [file.relativePath, file.base64])),
    expectedFiles,
  );
  assert.deepEqual(restored.directories, fixture.initialSnapshot.directories);
  await verifyRecoveryFiles(fixture);
});
