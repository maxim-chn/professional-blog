import { isDeepStrictEqual } from 'node:util';
import type { PersistenceConfig } from '../../src/lib/persistence/config.ts';
import { requireInput } from '../../src/lib/persistence/errors.ts';
import {
  checkCatalogue,
  type CatalogueEntry,
} from '../../src/lib/persistence/service.ts';
import type { BaselinePost } from './baseline-config.ts';

export interface ReconciledCatalogue {
  entries: CatalogueEntry[];
  changed: boolean;
}

export function reconcileBaselineCatalogue(
  current: unknown,
  committed: unknown,
  posts: readonly BaselinePost[],
  config: PersistenceConfig,
): ReconciledCatalogue {
  checkCatalogue(current, config);
  checkCatalogue(committed, config);

  const selected = new Map<string, CatalogueEntry>();
  for (const post of posts) {
    requireInput(
      !selected.has(post.postId),
      `Duplicate baseline catalogue selection: ${post.postId}`,
    );
    const entry = committed.find(
      (candidate) => candidate.registry.post_id === post.postId,
    );
    requireInput(
      entry !== undefined,
      `Baseline post is absent from the recorded Git catalogue: ${post.postId}`,
    );
    selected.set(post.postId, entry);
  }

  const present = new Set(current.map((entry) => entry.registry.post_id));
  const entries = current.map(
    (entry) => selected.get(entry.registry.post_id) ?? entry,
  );
  for (const [postId, entry] of selected) {
    if (!present.has(postId)) {
      entries.push(entry);
    }
  }

  checkCatalogue(entries, config);
  return { entries, changed: !isDeepStrictEqual(current, entries) };
}
