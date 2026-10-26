import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadPersistenceConfig } from '../../src/lib/persistence/config.ts';
import type { CatalogueEntry } from '../../src/lib/persistence/service.ts';
import { reconcileBaselineCatalogue } from './baseline-catalogue.ts';

const CONFIG_FILE = new URL('../config/persistence.json', import.meta.url);
const FIRST_TIMESTAMP = '2026-10-01T10:00:00.000Z';
const SECOND_TIMESTAMP = '2026-10-02T10:00:00.000Z';
const AUTHOR_TIMESTAMP = '2026-10-03T10:00:00.000Z';

function entry(title: string, timestamp: string): CatalogueEntry {
  const metadataId = randomUUID();
  return {
    registry: {
      post_id: randomUUID(),
      post_metadata_id: metadataId,
      created_at: timestamp,
    },
    metadata: {
      id: metadataId,
      title,
      summary: 'Catalogue reconciliation fixture.',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  };
}

function selection(value: CatalogueEntry) {
  return {
    postId: value.registry.post_id,
    paths: [join('records', `${value.registry.post_id}.json`)],
  };
}

test('reconciles only selected baseline entries while preserving author values and input data', async () => {
  const config = await loadPersistenceConfig(CONFIG_FILE);
  const first = entry('First baseline', FIRST_TIMESTAMP);
  const second = entry('Second baseline', SECOND_TIMESTAMP);
  const author = entry('Committed author title', AUTHOR_TIMESTAMP);
  const authorEdit = {
    ...author,
    metadata: { ...author.metadata, title: 'Uncommitted author title' },
  };
  const baselineEdit = {
    ...first,
    registry: { ...first.registry, created_at: AUTHOR_TIMESTAMP },
    metadata: { ...first.metadata, title: 'Edited baseline title' },
  };
  const unrelated = entry('Unselected committed post', FIRST_TIMESTAMP);
  const current = [authorEdit, baselineEdit];
  const committed = [first, second, author, unrelated];
  const before = structuredClone({ current, committed });
  const posts = [selection(first), selection(second)];

  const result = reconcileBaselineCatalogue(current, committed, posts, config);

  assert.equal(result.changed, true);
  assert.deepEqual(result.entries, [authorEdit, first, second]);
  assert.equal(result.entries[0], authorEdit);
  assert.deepEqual({ current, committed }, before);
  assert.deepEqual(
    reconcileBaselineCatalogue(result.entries, committed, posts, config),
    { entries: result.entries, changed: false },
  );
});

test('rejects missing or duplicate baseline selections without modifying inputs', async () => {
  const config = await loadPersistenceConfig(CONFIG_FILE);
  const baseline = entry('Baseline', FIRST_TIMESTAMP);
  const absent = entry('Absent baseline', SECOND_TIMESTAMP);
  const current = [baseline];
  const before = structuredClone(current);

  for (const posts of [
    [selection(absent)],
    [selection(baseline), selection(baseline)],
  ]) {
    assert.throws(
      () => reconcileBaselineCatalogue(current, [baseline], posts, config),
      { code: 'INVALID_INPUT' },
    );
    assert.deepEqual(current, before);
  }
});

test('rejects identity conflicts instead of replacing author entries', async () => {
  const config = await loadPersistenceConfig(CONFIG_FILE);
  const baseline = entry('Baseline', FIRST_TIMESTAMP);
  const author = entry('Author', AUTHOR_TIMESTAMP);
  author.registry.post_metadata_id = baseline.metadata.id;
  author.metadata.id = baseline.metadata.id;
  const current = [author];
  const before = structuredClone(current);

  assert.throws(
    () =>
      reconcileBaselineCatalogue(
        current,
        [baseline],
        [selection(baseline)],
        config,
      ),
    { code: 'INVALID_INPUT' },
  );
  assert.deepEqual(current, before);
});
