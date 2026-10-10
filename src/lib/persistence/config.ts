import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersistenceError, requireInput } from './errors.ts';
import { isString, isNonEmpty } from '../utilities/string_kit.ts';
import { isMap } from '../utilities/map_kit.ts';
import { isNonEmptyArray } from '../utilities/array_kit.ts';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../utilities/mime_kit.ts';

const CONFIGURATION_FIELDS: readonly string[] = [
  'root',
  'contentMaxCodePoints',
  'titleMaxCodePoints',
  'summaryMaxCodePoints',
  'supportedMediaTypes',
  'description',
  'settings',
];
const LIMIT_CONFIGURATION_FIELDS = [
  'contentMaxCodePoints',
  'titleMaxCodePoints',
  'summaryMaxCodePoints',
] as const;

export interface PersistenceConfig {
  root: string;
  contentMaxCodePoints: number;
  titleMaxCodePoints: number;
  summaryMaxCodePoints: number;
  supportedMediaTypes: string[];
}

export function checkConfig(config: PersistenceConfig): void {
  requireInput(
    isString(config.root) && isAbsolute(config.root),
    'configuration root must be absolute',
  );
  for (const field of LIMIT_CONFIGURATION_FIELDS) {
    requireInput(
      Number.isSafeInteger(config[field]) && config[field] > 0,
      `configuration ${field}`,
    );
  }
  requireInput(
    isNonEmptyArray(config.supportedMediaTypes) &&
      new Set(config.supportedMediaTypes).size ===
        config.supportedMediaTypes.length &&
      config.supportedMediaTypes.every((type) =>
        SUPPORTED_IMAGE_MIME_TYPES.includes(type),
      ),
    'configuration supportedMediaTypes',
  );
}

export async function loadPersistenceConfig(
  file: URL | string,
  rootOverride?: string,
): Promise<PersistenceConfig> {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  requireInput(
    isAbsolute(path),
    'configuration file must be an absolute path or file URL',
  );
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    throw new PersistenceError(
      cause instanceof SyntaxError ? 'INVALID_INPUT' : 'IO_FAILURE',
      'read persistence configuration',
      { cause },
    );
  }
  requireInput(isMap(raw), 'configuration object');
  const data = raw;
  requireInput(
    Object.keys(data).every((key) => CONFIGURATION_FIELDS.includes(key)),
    'unknown configuration setting',
  );
  requireInput(isNonEmpty(data.root), 'configuration root');
  if (rootOverride !== undefined)
    requireInput(isAbsolute(rootOverride), 'root override must be absolute');
  const config = {
    root: rootOverride ?? resolve(dirname(path), data.root),
    contentMaxCodePoints: data.contentMaxCodePoints,
    titleMaxCodePoints: data.titleMaxCodePoints,
    summaryMaxCodePoints: data.summaryMaxCodePoints,
    supportedMediaTypes: data.supportedMediaTypes,
  } as PersistenceConfig;
  checkConfig(config);
  return config;
}
