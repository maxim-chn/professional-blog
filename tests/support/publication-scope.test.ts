import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadPersistenceConfig } from '../../src/lib/persistence/config.ts';
import { FileSystemAdapter } from '../../src/lib/persistence/filesystem.ts';
import { PersistenceService } from '../../src/lib/persistence/service.ts';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { IMAGE_PNG } from '../../src/lib/utilities/mime_kit.ts';
import { TEST_PNG } from '../runtime/fixtures.ts';
import { planPublicationCleanup } from './publication-scope.ts';
import { readStorageTree } from './storage-snapshot.ts';

const CONFIG_FILE = new URL('../config/persistence.json', import.meta.url);
const PUBLICATION_TIME = '2026-10-01T10:00:00.000Z';
const METADATA_TIME = '2026-09-01T00:00:00.000Z';

async function createFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'publication-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = await loadPersistenceConfig(CONFIG_FILE, root);
  const bundle = preparePublication(
    '<p>Scope fixture</p><img src="{{graphic:cover}}">',
    {
      title: 'Scope fixture',
      summary: 'Cleanup scope fixture.',
      created_at: METADATA_TIME,
    },
    [{ identifier: 'cover', mime_type: IMAGE_PNG, data: TEST_PNG }],
    config,
  );
  return { root, config, bundle };
}

test('selects exactly the post-data files produced by publication without changing storage', async (t) => {
  const { root, config, bundle } = await createFixture(t);
  await writeFile(join(root, 'author-notes.txt'), 'Preserve author notes');
  const before = await readStorageTree(root);
  const paths = await planPublicationCleanup(bundle, config);
  assert.deepEqual(await readStorageTree(root), before);
  assert.equal(new Set(paths).size, paths.length);

  const service = new PersistenceService(
    new FileSystemAdapter(config),
    config,
    () => new Date(PUBLICATION_TIME),
  );
  await service.createPost(
    bundle.post,
    bundle.metadata,
    bundle.contents,
    bundle.media,
  );
  const published = await readStorageTree(root);
  const previousPaths = new Set(before.files.map((file) => file.relativePath));
  const generated = published.files
    .map((file) => file.relativePath)
    .filter((path) => !previousPaths.has(path) && path !== 'catalogue.json');
  assert.deepEqual(new Set(paths), new Set(generated));
});

for (const collision of [
  'content record',
  'cross-kind media',
  'directory',
  'catalogue',
]) {
  test(
    'rejects ' + collision + ' collisions without modifying existing data',
    async (t) => {
      const { root, config, bundle } = await createFixture(t);
      await mkdir(join(root, 'records'));
      await mkdir(join(root, 'media'));
      if (collision === 'content record') {
        await writeFile(
          join(root, 'records', bundle.contents[0].id + '.json'),
          'Existing record',
        );
      } else if (collision === 'cross-kind media') {
        await writeFile(
          join(root, 'media', bundle.post.id + '.bin'),
          'Existing media',
        );
      } else if (collision === 'directory') {
        await mkdir(join(root, 'records', bundle.media[0].id + '.json'));
      } else {
        await writeFile(
          join(root, 'catalogue.json'),
          JSON.stringify([
            {
              registry: {
                post_id: bundle.contents[0].id,
                post_metadata_id: bundle.metadata.id,
                created_at: PUBLICATION_TIME,
              },
              metadata: bundle.metadata,
            },
          ]),
        );
      }
      const before = await readStorageTree(root);
      await assert.rejects(planPublicationCleanup(bundle, config), {
        code: 'ERR_ASSERTION',
      });
      assert.deepEqual(await readStorageTree(root), before);
    },
  );
}
