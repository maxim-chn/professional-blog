import { isMap } from '../utilities/map_kit.ts';
import { objectFields } from './models/fields.ts';
import { isDeepStrictEqual } from 'node:util';
import { checkConfig, type PersistenceConfig } from './config.ts';
import type { PersistenceAdapter, PostBundle } from './contract.ts';
import { requireInput } from './errors.ts';
import {
  POST_FIELDS,
  checkPost,
  graphicReferences,
  type Post,
} from './models/post.ts';
import {
  CONTENT_FIELDS,
  checkContent,
  type PostContent,
} from './models/post-content.ts';
import {
  MEDIA_FIELDS,
  checkMedia,
  type PostMedia,
} from './models/post-media.ts';
import {
  METADATA_FIELDS,
  checkMetadata,
  type PostMetadata,
} from './models/post-metadata.ts';
import {
  REGISTRY_FIELDS,
  checkRegistry,
  type PostRegistry,
} from './models/post-registry.ts';

const CATALOGUE_ENTRY_FIELDS = ['registry', 'metadata'] as const;
const RECORD_ENVELOPE_FIELDS = ['kind', 'value'] as const;
const STORED_MEDIA_FIELDS = MEDIA_FIELDS.filter((field) => field !== 'data');
const STORED_RECORD_FIELDS = {
  post: POST_FIELDS,
  metadata: METADATA_FIELDS,
  content: CONTENT_FIELDS,
  media: STORED_MEDIA_FIELDS,
} as const;
export type StoredRecordKind = keyof typeof STORED_RECORD_FIELDS;
export interface CatalogueEntry {
  registry: PostRegistry;
  metadata: PostMetadata;
}

export function checkCatalogue(
  raw: unknown,
  config: PersistenceConfig,
): asserts raw is CatalogueEntry[] {
  requireInput(Array.isArray(raw), 'catalogue array');
  const identities = new Set<string>();
  for (const entry of raw) {
    objectFields(entry, CATALOGUE_ENTRY_FIELDS, 'catalogue entry');
    checkRegistry(entry.registry);
    checkMetadata(entry.metadata, config);
    requireInput(
      entry.registry.post_metadata_id === entry.metadata.id,
      'catalogue metadata association',
    );
    for (const id of [entry.registry.post_id, entry.metadata.id]) {
      requireInput(!identities.has(id), 'catalogue identity conflict');
      identities.add(id);
    }
  }
}

export function checkStoredRecord(
  raw: unknown,
  kind: StoredRecordKind,
  id: string,
): Record<string, unknown> {
  objectFields(raw, RECORD_ENVELOPE_FIELDS, 'stored record envelope');
  requireInput(raw.kind === kind, 'stored record kind');
  requireInput(
    isMap(raw.value) && raw.value.id === id,
    'stored record identity',
  );
  objectFields(raw.value, STORED_RECORD_FIELDS[kind], 'stored record fields');
  return raw.value;
}

export function checkStoredMedia(record: unknown): void {
  objectFields(record, STORED_MEDIA_FIELDS, 'stored media fields');
}

export function checkRegistryAssociation(
  registry: unknown,
  bundle: PostBundle,
): asserts registry is PostRegistry {
  objectFields(registry, REGISTRY_FIELDS, 'Registry fields');
  checkRegistry(registry);
  requireInput(
    registry.post_id === bundle.post.id &&
      registry.post_metadata_id === bundle.metadata.id,
    'Registry association',
  );
}

// Cross-record checks live in the application responsibility, also used when loading stored bundles.
export function checkBundle(
  bundle: PostBundle,
  config: PersistenceConfig,
): void {
  checkPost(bundle.post);
  checkMetadata(bundle.metadata, config);
  const context = `Post ${bundle.post.id}`;
  requireInput(
    Array.isArray(bundle.contents) && Array.isArray(bundle.media),
    `${context} children`,
  );
  bundle.contents.forEach((record) => checkContent(record, config));
  bundle.media.forEach((record) => checkMedia(record, config));
  const identities = [
    bundle.post.id,
    bundle.metadata.id,
    ...bundle.contents.map((record) => record.id),
    ...bundle.media.map((record) => record.id),
  ];
  requireInput(
    new Set(identities).size === identities.length,
    `${context} duplicate record identity`,
  );
  const contents = new Map(
    bundle.contents.map((record) => [record.id, record]),
  );
  requireInput(
    contents.size === bundle.post.content_ids.length &&
      bundle.post.content_ids.every((id) => contents.has(id)),
    `${context} content membership`,
  );
  requireInput(
    [...bundle.contents, ...bundle.media].every(
      (record) => record.post_id === bundle.post.id,
    ),
    `${context} child ownership`,
  );
  const media = new Map(bundle.media.map((record) => [record.id, record]));
  const graphics = new Set<string>();
  const mappedIds: string[] = [];
  for (const [mime, mapping] of Object.entries(bundle.post.media_ids)) {
    for (const [symbol, id] of Object.entries(mapping)) {
      requireInput(
        media.get(id)?.mime_type === mime,
        `${context} media membership/MIME`,
      );
      mappedIds.push(id);
      graphics.add(symbol);
    }
  }
  requireInput(mappedIds.length === media.size, `${context} extra media`);
  const text = bundle.post.content_ids
    .map((id) => contents.get(id)!.data)
    .join('');
  requireInput(
    graphicReferences(text).every((symbol) => graphics.has(symbol)),
    `${context} unmapped graphic reference`,
  );
}

export function samePublication(left: PostBundle, right: PostBundle): boolean {
  const ordered = (bundle: PostBundle) => ({
    post: bundle.post,
    metadata: bundle.metadata,
    contents: [...bundle.contents].sort((a, b) => a.id.localeCompare(b.id)),
    media: [...bundle.media]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({ ...record, data: Buffer.from(record.data) })),
  });
  return isDeepStrictEqual(ordered(left), ordered(right));
}

export class PersistenceService {
  private readonly adapter: PersistenceAdapter;
  private readonly config: PersistenceConfig;
  private readonly clock: () => Date;

  constructor(
    adapter: PersistenceAdapter,
    config: PersistenceConfig,
    clock: () => Date,
  ) {
    checkConfig(config);
    this.adapter = adapter;
    this.config = structuredClone(config);
    this.clock = clock;
  }

  async createPost(
    post: Post,
    metadata: PostMetadata,
    contents: PostContent[],
    media: PostMedia[],
  ) {
    checkBundle({ post, metadata, contents, media }, this.config);
    const bundle = structuredClone({ post, metadata, contents, media });
    const now = this.clock();
    requireInput(
      now instanceof Date && Number.isFinite(now.valueOf()),
      'application clock',
    );
    const registry = {
      post_id: post.id,
      post_metadata_id: metadata.id,
      created_at: now.toISOString(),
    };
    checkRegistry(registry);
    return this.adapter.create(bundle, registry);
  }

  listPosts(limit: number, cursor?: string | null) {
    return this.adapter.listPosts(limit, cursor);
  }
  getPost(postId: string) {
    return this.adapter.getPost(postId);
  }
}
