import { isString } from '../../utilities/string_kit.ts';
import { isNonEmpy } from '../../utilities/bin_data_kit.ts';
import { resolveFormat } from '../../utilities/mime_kit.ts';
import { createHash } from 'node:crypto';
import type { PersistenceConfig } from '../config.ts';
import { requireInput } from '../errors.ts';
import { objectFields, uuid } from './fields.ts';

export const MEDIA_FIELDS = [
  'id',
  'post_id',
  'mime_type',
  'data',
  'checksum',
] as const;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface PostMedia {
  id: string;
  post_id: string;
  mime_type: string;
  data: Uint8Array;
  checksum: string;
}

export function checkMedia(
  value: unknown,
  config: PersistenceConfig,
): asserts value is PostMedia {
  objectFields(value, MEDIA_FIELDS, 'Media fields');
  uuid(value.id, 'Media id');
  uuid(value.post_id, `Media ${value.id} owner`);
  requireInput(isNonEmpy(value.data), `Media ${value.id} binary data`);
  const bytes = Buffer.from(value.data);
  const format = resolveFormat(value.data);
  requireInput(
    isString(value.mime_type) &&
      config.supportedMediaTypes.includes(value.mime_type) &&
      value.mime_type === format,
    `Media ${value.id} binary format`,
  );
  requireInput(
    isString(value.checksum) &&
      SHA256_HEX_PATTERN.test(value.checksum) &&
      value.checksum === createHash('sha256').update(bytes).digest('hex'),
    `Media ${value.id} checksum`,
  );
}
