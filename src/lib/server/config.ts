import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { isMap } from '../utilities/map_kit.ts';
import { isNonEmpty } from '../utilities/string_kit.ts';

const CONFIGURATION_FIELDS: readonly string[] = [
  'publicationConfig',
  'cataloguePageSize',
  'description',
  'settings',
];

export interface AstroRuntimeConfig {
  publicationConfig: string;
  cataloguePageSize: number;
}

export async function loadAstroRuntimeConfig(
  file: URL | string,
): Promise<AstroRuntimeConfig> {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  requireInput(
    isAbsolute(path),
    'runtime configuration file must be an absolute path or file URL',
  );

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new PersistenceError(
      cause instanceof SyntaxError ? 'INVALID_INPUT' : 'IO_FAILURE',
      'read runtime configuration',
      { cause },
    );
  }

  requireInput(isMap(raw), 'runtime configuration object');
  requireInput(
    Object.keys(raw).every((key) => CONFIGURATION_FIELDS.includes(key)),
    'unknown runtime configuration setting',
  );
  requireInput(
    isNonEmpty(raw.publicationConfig),
    'runtime configuration publicationConfig',
  );
  requireInput(
    typeof raw.cataloguePageSize === 'number' &&
      Number.isSafeInteger(raw.cataloguePageSize) &&
      raw.cataloguePageSize > 0,
    'runtime configuration cataloguePageSize',
  );

  return {
    publicationConfig: resolve(dirname(path), raw.publicationConfig),
    cataloguePageSize: raw.cataloguePageSize,
  };
}
