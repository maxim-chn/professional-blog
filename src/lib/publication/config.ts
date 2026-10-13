import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { isMap } from '../utilities/map_kit.ts';
import { isNonEmpty } from '../utilities/string_kit.ts';
import { resolveVisitorOrigin } from './visitor-url.ts';

const PATH_FIELDS = [
  'persistenceConfig',
  'legacySourceRoot',
  'legacyPublicRoot',
  'preparedRoot',
] as const;

const CONFIGURATION_FIELDS: readonly string[] = [
  ...PATH_FIELDS,
  'visitorOrigin',
  'description',
  'settings',
];

type PathField = (typeof PATH_FIELDS)[number];

export interface PublicationConfig {
  persistenceConfig: string;
  visitorOrigin: string;
  legacySourceRoot: string;
  legacyPublicRoot: string;
  preparedRoot: string;
}

function resolveConfiguredPath(
  data: Record<string, unknown>,
  field: PathField,
  directory: string,
): string {
  const value = data[field];
  requireInput(isNonEmpty(value), `publication configuration ${field}`);

  return resolve(directory, value);
}

export async function loadPublicationConfig(
  file: URL | string,
): Promise<PublicationConfig> {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  requireInput(
    isAbsolute(path),
    'publication configuration file must be an absolute path or file URL',
  );

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new PersistenceError(
      cause instanceof SyntaxError ? 'INVALID_INPUT' : 'IO_FAILURE',
      'read publication configuration',
      { cause },
    );
  }

  requireInput(isMap(raw), 'publication configuration object');
  requireInput(
    Object.keys(raw).every((key) => CONFIGURATION_FIELDS.includes(key)),
    'unknown publication configuration setting',
  );

  const directory = dirname(path);

  return {
    persistenceConfig: resolveConfiguredPath(
      raw,
      'persistenceConfig',
      directory,
    ),
    visitorOrigin: resolveVisitorOrigin(raw.visitorOrigin),
    legacySourceRoot: resolveConfiguredPath(raw, 'legacySourceRoot', directory),
    legacyPublicRoot: resolveConfiguredPath(raw, 'legacyPublicRoot', directory),
    preparedRoot: resolveConfiguredPath(raw, 'preparedRoot', directory),
  };
}
