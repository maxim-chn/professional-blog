import type { TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPersistenceConfig } from '../../src/lib/persistence/config.ts';
import type { PostBundle } from '../../src/lib/persistence/contract.ts';
import { createRuntimePersistence } from '../../src/lib/server/persistence.ts';

export const TEST_RUNTIME_CONFIG = new URL(
  '../config/astro-runtime.json',
  import.meta.url,
);

const TEST_PERSISTENCE_CONFIG = new URL(
  '../config/persistence.json',
  import.meta.url,
);

export const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
  'base64',
);

export async function createRuntimeFixture(
  t: TestContext,
  clock: () => Date,
  visitorOrigin: string,
) {
  const root = await mkdtemp(join(tmpdir(), 'blog-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const config = await loadPersistenceConfig(TEST_PERSISTENCE_CONFIG, root);
  const runtime = await createRuntimePersistence(TEST_RUNTIME_CONFIG, clock, {
    root,
    visitorOrigin,
  });

  return {
    ...runtime,
    root,
    config,
    publish: (bundle: PostBundle) =>
      runtime.service.createPost(
        bundle.post,
        bundle.metadata,
        bundle.contents,
        bundle.media,
      ),
  };
}
