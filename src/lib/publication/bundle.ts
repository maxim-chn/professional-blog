import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { PersistenceConfig } from '../persistence/config.ts';
import type { PostBundle } from '../persistence/contract.ts';
import { PersistenceError } from '../persistence/errors.ts';
import { checkBundle } from '../persistence/service.ts';
import { loadManifest } from './manifest.ts';

async function readInput(file: string): Promise<Buffer> {
  try {
    return await readFile(file);
  } catch (cause) {
    throw new PersistenceError('IO_FAILURE', 'read publication input ' + file, {
      cause,
    });
  }
}

async function readContent(file: string): Promise<string> {
  const bytes = await readInput(file);
  try {
    return new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch (cause) {
    throw new PersistenceError(
      'INVALID_INPUT',
      'publication content must be valid UTF-8: ' + file,
      { cause },
    );
  }
}

export async function loadPublicationBundle(
  file: URL | string,
  config: PersistenceConfig,
): Promise<PostBundle> {
  const manifest = await loadManifest(file, config);
  const contents = await Promise.all(
    manifest.contents.map(async (input) => ({
      id: input.id,
      post_id: manifest.post.id,
      data: await readContent(input.file),
    })),
  );
  const media = await Promise.all(
    manifest.media.map(async (input) => {
      const data = await readInput(input.file);
      return {
        id: input.id,
        post_id: manifest.post.id,
        mime_type: input.mime_type,
        data,
        checksum: createHash('sha256').update(data).digest('hex'),
      };
    }),
  );
  const bundle = {
    post: manifest.post,
    metadata: manifest.metadata,
    contents,
    media,
  };
  checkBundle(bundle, config);
  return bundle;
}
