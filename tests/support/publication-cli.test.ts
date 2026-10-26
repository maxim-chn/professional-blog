import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FileSystemAdapter } from '../../src/lib/persistence/filesystem.ts';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { savePreparedInputs } from '../../src/lib/publication/prepared-inputs.ts';
import { buildVisitorUrl } from '../../src/lib/publication/visitor-url.ts';
import { IMAGE_PNG } from '../../src/lib/utilities/mime_kit.ts';
import { isString } from '../../src/lib/utilities/string_kit.ts';
import { TEST_PNG } from '../runtime/fixtures.ts';
import { loadE2eConfig } from './e2e-config.ts';
import { loadE2eRuntime } from './e2e-runtime.ts';
import { runPublicationCli } from './publication-cli.ts';
import { readStorageTree } from './storage-snapshot.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);
const METADATA_TIME = '2026-09-01T00:00:00.000Z';

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'publication-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'storage');
  await mkdir(root);
  const settings = await loadE2eConfig(CONFIG_FILE);
  const runtime = await loadE2eRuntime(settings.isolatedRuntimeConfig, root);
  const bundle = preparePublication(
    '<p>CLI publication 🌍</p><img src="{{graphic:cover}}">',
    {
      title: 'CLI fixture',
      summary: 'CLI publication fixture.',
      created_at: METADATA_TIME,
    },
    [{ identifier: 'cover', mime_type: IMAGE_PNG, data: TEST_PNG }],
    runtime.persistence,
  );
  const manifest = await savePreparedInputs(
    join(directory, 'prepared'),
    bundle,
    runtime.persistence,
  );
  return { directory, root, settings, runtime, bundle, manifest };
}

test('publishes through the CLI and preserves all stored bytes on retry', async (t) => {
  const { root, settings, runtime, bundle, manifest } = await createFixture(t);
  const expectedIdentity = {
    post_id: bundle.post.id,
    post_metadata_id: bundle.metadata.id,
    visitor_url: buildVisitorUrl(
      runtime.publication.visitorOrigin,
      bundle.post.id,
    ),
  };
  assert.deepEqual(await readStorageTree(root), { directories: [], files: [] });

  const created = await runPublicationCli(
    runtime,
    manifest,
    settings.publicationTimeoutMs,
  );
  assert.deepEqual(created.result, {
    ...expectedIdentity,
    created: true,
    duplicate: false,
  });
  const adapter = new FileSystemAdapter(runtime.persistence);
  assert.deepEqual(await adapter.getPost(bundle.post.id), {
    ...bundle,
    post: JSON.parse(JSON.stringify(bundle.post)),
  });
  const published = await readStorageTree(root);

  const duplicate = await runPublicationCli(
    runtime,
    manifest,
    settings.publicationTimeoutMs,
  );
  assert.deepEqual(duplicate.result, {
    ...expectedIdentity,
    created: false,
    duplicate: true,
  });
  assert.deepEqual(await readStorageTree(root), published);
});

test('propagates CLI failure and preserves storage for a missing manifest', async (t) => {
  const { directory, root, settings, runtime } = await createFixture(t);
  const before = await readStorageTree(root);

  await assert.rejects(
    runPublicationCli(
      runtime,
      join(directory, 'missing.json'),
      settings.publicationTimeoutMs,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok('code' in error);
      assert.equal(error.code, 1);
      assert.ok('stderr' in error && isString(error.stderr));
      assert.equal(JSON.parse(error.stderr).code, 'IO_FAILURE');
      return true;
    },
  );
  assert.deepEqual(await readStorageTree(root), before);
});
