import { isNonEmptyString } from '../../utilities/string_kit.ts';
import type { PersistenceConfig } from '../config.ts';
import { requireInput } from '../errors.ts';
import { objectFields, uuid } from './fields.ts';

export const CONTENT_FIELDS = ['id', 'post_id', 'data'] as const;

export interface PostContent {
  id: string;
  post_id: string;
  data: string;
}
export function checkContent(
  value: unknown,
  config: PersistenceConfig,
): asserts value is PostContent {
  objectFields(value, CONTENT_FIELDS, 'Content fields');
  uuid(value.id, 'Content id');
  uuid(value.post_id, `Content ${value.id} owner`);
  requireInput(
    isNonEmptyString(value.data) &&
      [...value.data].length <= config.contentMaxCodePoints,
    `Content ${value.id} payload length`,
  );
}
