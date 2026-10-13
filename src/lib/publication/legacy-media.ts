import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { resolveFormat } from '../utilities/mime_kit.ts';
import type { PreparationMedia } from './preparation.ts';

const IMAGE_SOURCE_PATTERN = /(<img\b[^>]*?\s+src\s*=\s*)(["'])(.*?)\2/gis;

function resolveImagePath(publicRoot: string, source: string): string {
  requireInput(
    source.startsWith('/') && !source.startsWith('//'),
    'legacy image must use a local public path',
  );
  const file = resolve(publicRoot, source.slice(1));
  const location = relative(publicRoot, file);
  requireInput(
    !isAbsolute(location) &&
      location !== '..' &&
      !location.startsWith('..' + sep),
    'legacy image must remain within the public root',
  );
  return file;
}

async function readImage(file: string): Promise<Buffer> {
  try {
    return await readFile(file);
  } catch (cause) {
    throw new PersistenceError('IO_FAILURE', 'read legacy image ' + file, {
      cause,
    });
  }
}

export async function prepareLegacyMedia(
  body: string,
  publicRoot: string,
): Promise<{ body: string; media: PreparationMedia[] }> {
  requireInput(isAbsolute(publicRoot), 'legacy public root must be absolute');
  const references = new Map<string, string>();
  const media: PreparationMedia[] = [];

  for (const match of body.matchAll(IMAGE_SOURCE_PATTERN)) {
    const source = match[3];
    if (references.has(source)) continue;

    const file = resolveImagePath(publicRoot, source);
    const data = await readImage(file);
    const mimeType = resolveFormat(data);
    requireInput(mimeType !== undefined, 'unsupported legacy image ' + source);
    const identifier = 'graphic-' + (media.length + 1);
    references.set(source, identifier);
    media.push({ identifier, mime_type: mimeType, data });
  }

  const preparedBody = body.replace(
    IMAGE_SOURCE_PATTERN,
    (_match: string, prefix: string, quote: string, source: string) => {
      const identifier = references.get(source);
      requireInput(identifier !== undefined, 'legacy image mapping');
      return prefix + quote + '{{graphic:' + identifier + '}}' + quote;
    },
  );

  return { body: preparedBody, media };
}
