import { mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { PersistenceConfig } from '../persistence/config.ts';
import type { PostBundle } from '../persistence/contract.ts';
import {
  hasCode,
  PersistenceError,
  requireInput,
} from '../persistence/errors.ts';
import { checkBundle } from '../persistence/service.ts';
import type { PublicationManifest } from './manifest.ts';

export const PUBLICATION_MANIFEST_FILENAME = 'manifest.json';

export async function savePreparedInputs(
  directory: string,
  bundle: PostBundle,
  config: PersistenceConfig,
): Promise<string> {
  requireInput(isAbsolute(directory), 'prepared directory must be absolute');
  const prepared = structuredClone(bundle);
  checkBundle(prepared, config);
  for (const content of prepared.contents) {
    requireInput(
      Buffer.from(content.data, 'utf8').toString('utf8') === content.data,
      'prepared content must round-trip through UTF-8',
    );
  }

  const manifest: PublicationManifest = {
    post: prepared.post,
    metadata: prepared.metadata,
    contents: prepared.contents.map((content) => ({
      id: content.id,
      file: content.id + '.txt',
    })),
    media: prepared.media.map((media) => ({
      id: media.id,
      mime_type: media.mime_type,
      file: media.id + '.bin',
    })),
  };

  // The parent must already exist. Never reuse or remove an existing directory.
  try {
    await mkdir(directory);
  } catch (cause) {
    throw new PersistenceError(
      hasCode(cause, 'EEXIST') ? 'ID_CONFLICT' : 'IO_FAILURE',
      'create prepared directory ' + directory,
      { cause },
    );
  }

  const manifestPath = join(directory, PUBLICATION_MANIFEST_FILENAME);
  try {
    for (const content of prepared.contents) {
      await writeFile(join(directory, content.id + '.txt'), content.data, {
        encoding: 'utf8',
        flag: 'wx',
      });
    }
    for (const media of prepared.media) {
      await writeFile(join(directory, media.id + '.bin'), media.data, {
        flag: 'wx',
      });
    }
    // Publish the manifest only after all of its input files are complete.
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (cause) {
    const cleanupFailures: string[] = [];
    try {
      await rm(directory, { recursive: true });
    } catch {
      cleanupFailures.push(directory);
    }
    throw new PersistenceError(
      'IO_FAILURE',
      'save prepared inputs ' + directory,
      { cause, cleanupFailures },
    );
  }

  return manifestPath;
}
