import { objectFields, uuid, utcTimestamp } from './fields.ts';

export const REGISTRY_FIELDS = [
  'post_id',
  'post_metadata_id',
  'created_at',
] as const;

export interface PostRegistry {
  post_id: string;
  post_metadata_id: string;
  created_at: string;
}
export function checkRegistry(value: unknown): asserts value is PostRegistry {
  objectFields(value, REGISTRY_FIELDS, 'Registry fields');
  uuid(value.post_id, 'Registry post id');
  uuid(value.post_metadata_id, 'Registry metadata id');
  utcTimestamp(value.created_at, `Registry ${value.post_id} created_at`, true);
}
