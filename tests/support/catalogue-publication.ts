import assert from 'node:assert/strict';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { buildVisitorUrl } from '../../src/lib/publication/visitor-url.ts';
import { createRuntimePersistence } from '../../src/lib/server/persistence.ts';
import type { E2eRuntime } from './e2e-runtime.ts';

const METADATA_TIMESTAMP = '2026-09-01T00:00:00.000Z';
const POST_BODY = '<p>Catalogue browser fixture.</p>';
const POST_SUMMARY = 'A catalogue browser fixture.';

export interface CataloguePost {
  title: string;
  url: string;
  registryTimestamp: string;
}

export async function publishCataloguePost(
  runtime: E2eRuntime,
  title: string,
  registryTimestamp: string,
): Promise<CataloguePost> {
  const persistence = await createRuntimePersistence(
    runtime.runtimeConfigFile,
    () => new Date(registryTimestamp),
    { root: runtime.persistence.root },
  );
  const bundle = preparePublication(
    POST_BODY,
    { title, summary: POST_SUMMARY, created_at: METADATA_TIMESTAMP },
    [],
    runtime.persistence,
  );
  const result = await persistence.service.createPost(
    bundle.post,
    bundle.metadata,
    bundle.contents,
    bundle.media,
  );
  assert.equal(result.created, true);
  assert.equal(result.duplicate, false);

  return {
    title,
    url: buildVisitorUrl(runtime.publication.visitorOrigin, bundle.post.id),
    registryTimestamp,
  };
}
