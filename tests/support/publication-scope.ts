import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { PersistenceConfig } from '../../src/lib/persistence/config.ts';
import type { PostBundle } from '../../src/lib/persistence/contract.ts';
import {
  checkBundle,
  checkCatalogue,
} from '../../src/lib/persistence/service.ts';
import { readStorageTree } from './storage-snapshot.ts';

const CATALOGUE_FILE = 'catalogue.json';

export async function planPublicationCleanup(
  bundle: PostBundle,
  config: PersistenceConfig,
): Promise<string[]> {
  checkBundle(bundle, config);
  const identities = [
    bundle.post.id,
    bundle.metadata.id,
    ...bundle.contents.map((content) => content.id),
    ...bundle.media.map((media) => media.id),
  ];
  const tree = await readStorageTree(config.root);
  const existingPaths = new Set([
    ...tree.directories,
    ...tree.files.map((file) => file.relativePath),
  ]);
  const catalogueFile = tree.files.find(
    (file) => file.relativePath === CATALOGUE_FILE,
  );
  const catalogue: unknown = catalogueFile
    ? JSON.parse(Buffer.from(catalogueFile.base64, 'base64').toString('utf8'))
    : [];
  checkCatalogue(catalogue, config);
  const catalogueIdentities = new Set(
    catalogue.flatMap((entry) => [entry.registry.post_id, entry.metadata.id]),
  );

  for (const id of identities) {
    assert.ok(
      !catalogueIdentities.has(id),
      'Fixture identity already exists in catalogue: ' + id,
    );
    for (const path of [
      join('records', id + '.json'),
      join('media', id + '.bin'),
    ]) {
      assert.ok(
        !existingPaths.has(path),
        'Fixture identity already exists in storage: ' + path,
      );
    }
  }

  return [
    ...identities.map((id) => join('records', id + '.json')),
    ...bundle.media.map((media) => join('media', media.id + '.bin')),
  ];
}
