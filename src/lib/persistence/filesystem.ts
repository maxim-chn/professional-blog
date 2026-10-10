import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { checkConfig, type PersistenceConfig } from './config.ts';
import type {
  CreateResult,
  ListResult,
  PersistenceAdapter,
  PostBundle,
} from './contract.ts';
import { hasCode, PersistenceError, requireInput } from './errors.ts';
import { uuid, utcTimestamp } from './models/fields.ts';
import { checkPost } from './models/post.ts';
import type { PostMetadata } from './models/post-metadata.ts';
import type { PostRegistry } from './models/post-registry.ts';
import type { PostContent } from './models/post-content.ts';
import type { PostMedia } from './models/post-media.ts';
import {
  checkBundle,
  samePublication,
  checkCatalogue,
  checkStoredRecord,
  checkStoredMedia,
  checkRegistryAssociation,
  type CatalogueEntry,
  type StoredRecordKind,
} from './service.ts';

export type StorageIO = Pick<
  typeof fs,
  'readFile' | 'writeFile' | 'mkdir' | 'link' | 'rename' | 'rm' | 'lstat'
>;

export class FileSystemAdapter implements PersistenceAdapter {
  private readonly config: PersistenceConfig;
  private readonly io: StorageIO;

  constructor(config: PersistenceConfig, io: StorageIO = fs) {
    checkConfig(config);
    this.config = structuredClone(config);
    this.io = io;
  }

  private path(...parts: string[]): string {
    return join(this.config.root, ...parts);
  }
  private recordPath(id: string): string {
    uuid(id, 'record path id');
    return this.path('records', `${id}.json`);
  }
  private mediaPath(id: string): string {
    uuid(id, 'media path id');
    return this.path('media', `${id}.bin`);
  }

  private stored<T>(context: string, action: () => T): T {
    try {
      return action();
    } catch (cause) {
      throw new PersistenceError('STORAGE_INTEGRITY', context, { cause });
    }
  }

  private async readJson(path: string): Promise<unknown> {
    const text = await this.io.readFile(path, 'utf8');
    return this.stored(`invalid JSON at ${path}`, () => JSON.parse(text));
  }

  private async catalogue(): Promise<CatalogueEntry[]> {
    let raw: unknown;
    try {
      raw = await this.readJson(this.path('catalogue.json'));
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return [];
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError('IO_FAILURE', 'read catalogue', {
        cause: error,
      });
    }
    return this.stored('invalid catalogue', () => {
      checkCatalogue(raw, this.config);
      return raw;
    });
  }

  async listPosts(limit: number, cursor?: string | null): Promise<ListResult> {
    requireInput(
      Number.isSafeInteger(limit) && limit > 0,
      'list limit must be a positive integer',
    );
    if (cursor !== undefined && cursor !== null)
      utcTimestamp(cursor, 'list cursor', true);
    const entries = (await this.catalogue())
      .filter(
        (entry) =>
          cursor == null ||
          Date.parse(entry.registry.created_at) < Date.parse(cursor),
      )
      .sort(
        (a, b) =>
          Date.parse(b.registry.created_at) - Date.parse(a.registry.created_at),
      )
      .slice(0, limit);
    return {
      items: entries.map((entry) => ({
        post_id: entry.registry.post_id,
        metadata: entry.metadata,
      })),
      next_cursor: entries.at(-1)?.registry.created_at ?? cursor ?? null,
    };
  }

  private async readRecord(
    id: string,
    kind: StoredRecordKind,
  ): Promise<unknown> {
    const raw = await this.readJson(this.recordPath(id));
    return this.stored(`record ${id}`, () => checkStoredRecord(raw, kind, id));
  }

  private async load(entry: CatalogueEntry): Promise<PostBundle> {
    const id = entry.registry.post_id;
    try {
      const post = await this.readRecord(id, 'post');
      this.stored(`Post ${id}`, () => checkPost(post));
      // checkPost establishes this type; wrapper preserves integrity error classification.
      const checkedPost = post as PostBundle['post'];
      const metadata = (await this.readRecord(
        entry.metadata.id,
        'metadata',
      )) as PostMetadata;
      const contents: PostContent[] = [];
      for (const contentId of checkedPost.content_ids)
        contents.push(
          (await this.readRecord(contentId, 'content')) as PostContent,
        );
      const media: PostMedia[] = [];
      for (const mapping of Object.values(checkedPost.media_ids)) {
        for (const mediaId of Object.values(mapping)) {
          const record = await this.readRecord(mediaId, 'media');
          this.stored(`Media ${mediaId}`, () => checkStoredMedia(record));
          media.push({
            ...(record as Omit<PostMedia, 'data'>),
            data: await this.io.readFile(this.mediaPath(mediaId)),
          });
        }
      }
      const bundle = { post: checkedPost, metadata, contents, media };
      this.stored(`Post ${id} bundle`, () => {
        checkBundle(bundle, this.config);
        requireInput(
          isDeepStrictEqual(metadata, entry.metadata),
          'catalogue metadata differs from record',
        );
      });
      return bundle;
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError(
        hasCode(error, 'ENOENT') ? 'STORAGE_INTEGRITY' : 'IO_FAILURE',
        `read registered Post ${id}`,
        { cause: error },
      );
    }
  }

  async getPost(postId: string): Promise<PostBundle> {
    uuid(postId, 'requested Post id');
    const entry = (await this.catalogue()).find(
      (item) => item.registry.post_id === postId,
    );
    if (!entry) throw new PersistenceError('NOT_FOUND', `Post ${postId}`);
    return this.load(entry);
  }

  async create(
    input: PostBundle,
    association: PostRegistry,
  ): Promise<CreateResult> {
    checkBundle(input, this.config);
    checkRegistryAssociation(association, input);
    const bundle = structuredClone(input);
    const registry = structuredClone(association);
    const entries = await this.catalogue();
    const existing = entries.find(
      (entry) => entry.registry.post_id === bundle.post.id,
    );
    const result = {
      post_id: bundle.post.id,
      post_metadata_id: bundle.metadata.id,
    };
    if (existing) {
      if (!samePublication(await this.load(existing), bundle))
        throw new PersistenceError('ID_CONFLICT', `Post ${bundle.post.id}`);
      return { ...result, created: false, duplicate: true };
    }
    const records = [
      { kind: 'post', value: bundle.post },
      { kind: 'metadata', value: bundle.metadata },
      ...bundle.contents.map((value) => ({ kind: 'content', value })),
      ...bundle.media.map((record) => ({
        kind: 'media',
        value: {
          id: record.id,
          post_id: record.post_id,
          mime_type: record.mime_type,
          checksum: record.checksum,
        },
      })),
    ];
    const registeredIds = new Set<string>();
    // Committed relationships reserve child identities even if a record is missing.
    // Never repair another post accidentally by reusing its missing child UUID.
    for (const entry of entries) {
      const committed = await this.load(entry);
      for (const id of [
        committed.post.id,
        committed.metadata.id,
        ...committed.contents.map((record) => record.id),
        ...committed.media.map((record) => record.id),
      ])
        registeredIds.add(id);
    }
    for (const record of records) {
      if (registeredIds.has(record.value.id))
        throw new PersistenceError('ID_CONFLICT', `record ${record.value.id}`);
    }
    const stage = this.path(`.stage-${randomUUID()}`);
    const catalogueTemp = this.path(`.catalogue-${randomUUID()}.json`);
    const installed: string[] = [];
    let stageCreated = false;
    let catalogueCreated = false;
    try {
      await this.io.mkdir(this.path('records'), { recursive: true });
      await this.io.mkdir(this.path('media'), { recursive: true });
      const targets = [
        ...records.map((record) => this.recordPath(record.value.id)),
        ...bundle.media.map((record) => this.mediaPath(record.id)),
      ];
      for (const target of targets) {
        try {
          await this.io.lstat(target);
        } catch (error) {
          if (hasCode(error, 'ENOENT')) continue;
          throw error;
        }
        throw new PersistenceError(
          'ID_CONFLICT',
          `existing record path ${target}`,
        );
      }
      await this.io.mkdir(stage);
      stageCreated = true;
      for (const record of records) {
        const source = join(stage, `${record.value.id}.json`);
        await this.io.writeFile(source, JSON.stringify(record), { flag: 'wx' });
      }
      for (const record of bundle.media)
        await this.io.writeFile(join(stage, `${record.id}.bin`), record.data, {
          flag: 'wx',
        });
      // Exclusive links prevent overwriting even inaccessible leftovers. The catalogue is still unchanged.
      for (const record of records) {
        const target = this.recordPath(record.value.id);
        await this.io.link(join(stage, `${record.value.id}.json`), target);
        installed.push(target);
      }
      for (const record of bundle.media) {
        const target = this.mediaPath(record.id);
        await this.io.link(join(stage, `${record.id}.bin`), target);
        installed.push(target);
      }
      await this.io.writeFile(
        join(stage, 'catalogue.json'),
        JSON.stringify([...entries, { registry, metadata: bundle.metadata }]),
        { flag: 'wx' },
      );
      await this.io.link(join(stage, 'catalogue.json'), catalogueTemp);
      catalogueCreated = true;
      await this.io.rm(stage, { recursive: true });
      stageCreated = false;
      // Last fallible operation: no cleanup after commit can turn a successful commit into a failure.
      await this.io.rename(catalogueTemp, this.path('catalogue.json'));
      return { ...result, created: true, duplicate: false };
    } catch (cause) {
      const cleanupFailures: string[] = [];
      const cleanup = async (path: string, recursive: boolean) => {
        try {
          await this.io.rm(path, { force: true, recursive });
        } catch {
          cleanupFailures.push(path);
        }
      };
      for (const path of installed) await cleanup(path, false);
      if (stageCreated) await cleanup(stage, true);
      if (catalogueCreated) await cleanup(catalogueTemp, false);
      const code =
        cause instanceof PersistenceError
          ? cause.code
          : hasCode(cause, 'EEXIST')
            ? 'ID_CONFLICT'
            : 'IO_FAILURE';
      throw new PersistenceError(
        code,
        `publish Post ${bundle.post.id}${cleanupFailures.length ? '; cleanup failed' : ''}`,
        { cause, cleanupFailures },
      );
    }
  }
}
