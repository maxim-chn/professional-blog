import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PersistenceConfig } from '../persistence/config.ts';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { objectFields, uuid } from '../persistence/models/fields.ts';
import { checkPost, type Post } from '../persistence/models/post.ts';
import {
  checkMetadata,
  type PostMetadata,
} from '../persistence/models/post-metadata.ts';
import { isNonEmptyArray } from '../utilities/array_kit.ts';
import { isNonEmpty } from '../utilities/string_kit.ts';

const MANIFEST_FIELDS = ['post', 'metadata', 'contents', 'media'] as const;
const CONTENT_INPUT_FIELDS = ['id', 'file'] as const;
const MEDIA_INPUT_FIELDS = ['id', 'mime_type', 'file'] as const;

export interface ContentInput {
  id: string;
  file: string;
}

export interface MediaInput {
  id: string;
  mime_type: string;
  file: string;
}

export interface PublicationManifest {
  post: Post;
  metadata: PostMetadata;
  contents: ContentInput[];
  media: MediaInput[];
}

export function checkManifest(
  value: unknown,
  config: PersistenceConfig,
): asserts value is PublicationManifest {
  objectFields(value, MANIFEST_FIELDS, 'publication manifest fields');
  checkPost(value.post);
  checkMetadata(value.metadata, config);

  requireInput(
    isNonEmptyArray(value.contents),
    'publication manifest content inputs',
  );
  for (const input of value.contents) {
    objectFields(input, CONTENT_INPUT_FIELDS, 'content input fields');
    uuid(input.id, 'content input id');
    requireInput(isNonEmpty(input.file), 'content input file');
  }

  requireInput(Array.isArray(value.media), 'publication manifest media inputs');
  for (const input of value.media) {
    objectFields(input, MEDIA_INPUT_FIELDS, 'media input fields');
    uuid(input.id, 'media input id');
    requireInput(isNonEmpty(input.mime_type), 'media input MIME type');
    requireInput(isNonEmpty(input.file), 'media input file');
  }
}

export async function loadManifest(
  file: URL | string,
  config: PersistenceConfig,
): Promise<PublicationManifest> {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  requireInput(
    isAbsolute(path),
    'manifest file must be an absolute path or file URL',
  );

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new PersistenceError(
      cause instanceof SyntaxError ? 'INVALID_INPUT' : 'IO_FAILURE',
      `read publication manifest ${path}`,
      { cause },
    );
  }

  checkManifest(raw, config);
  const directory = dirname(path);

  return {
    post: raw.post,
    metadata: raw.metadata,
    contents: raw.contents.map((input) => ({
      ...input,
      file: resolve(directory, input.file),
    })),
    media: raw.media.map((input) => ({
      ...input,
      file: resolve(directory, input.file),
    })),
  };
}
