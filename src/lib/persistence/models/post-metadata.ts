import { isNonEmptyString, isNonEmpty } from '../../utilities/string_kit.ts';
import type { PersistenceConfig } from '../config.ts';
import { requireInput } from '../errors.ts';
import { objectFields, uuid, utcTimestamp } from './fields.ts';

export const METADATA_FIELDS = [
  'id',
  'title',
  'created_at',
  'summary',
] as const;

export interface PostMetadata {
  id: string;
  title: string;
  created_at: string;
  summary: string;
}
export function checkMetadata(
  value: unknown,
  config: PersistenceConfig,
): asserts value is PostMetadata {
  objectFields(value, METADATA_FIELDS, 'Metadata fields');
  uuid(value.id, 'Metadata id');
  requireInput(
    isNonEmpty(value.title) &&
      [...value.title].length <= config.titleMaxCodePoints,
    `Metadata ${value.id} title`,
  );
  requireInput(
    isNonEmptyString(value.summary) &&
      isNonEmpty(value.summary) &&
      [...value.summary].length <= config.summaryMaxCodePoints,
    `Metadata ${value.id} summary`,
  );
  utcTimestamp(value.created_at, `Metadata ${value.id} created_at`, false);
}
