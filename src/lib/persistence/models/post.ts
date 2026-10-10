import { isNonEmptyArray } from '../../utilities/array_kit.ts';
import { isMap } from '../../utilities/map_kit.ts';
import { requireInput } from '../errors.ts';
import { objectFields, uuid } from './fields.ts';

export const POST_FIELDS = ['id', 'content_ids', 'media_ids'] as const;

export interface Post {
  id: string;
  content_ids: string[];
  media_ids: Record<string, Record<string, string>>;
}
export const GRAPHIC_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function checkPost(value: unknown): asserts value is Post {
  objectFields(value, POST_FIELDS, 'Post fields');
  uuid(value.id, 'Post id');
  const context = `Post ${value.id}`;
  requireInput(isNonEmptyArray(value.content_ids), `${context} content_ids`);
  value.content_ids.forEach((id) => uuid(id, `${context} content id`));
  requireInput(
    new Set(value.content_ids).size === value.content_ids.length,
    `${context} duplicate content id`,
  );
  requireInput(
    isMap(value.media_ids) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value.media_ids)),
    `${context} media_ids`,
  );
  const symbols = new Set<string>();
  const ids = new Set<string>();
  for (const [mime, mapping] of Object.entries(value.media_ids)) {
    requireInput(
      mime.length > 0 &&
        isMap(mapping) &&
        [Object.prototype, null].includes(Object.getPrototypeOf(mapping)),
      `${context} media mapping`,
    );
    for (const [symbol, id] of Object.entries(mapping)) {
      requireInput(
        GRAPHIC_IDENTIFIER_PATTERN.test(symbol) && !symbols.has(symbol),
        `${context} graphic identifier`,
      );
      uuid(id, `${context} media id`);
      requireInput(!ids.has(id), `${context} duplicate media id`);
      symbols.add(symbol);
      ids.add(id);
    }
  }
}

// Reserved explicit tokens, e.g. <img src="{{graphic:cover}}">. Never search prose for UUIDs.
export function graphicReferences(text: string): string[] {
  const references: string[] = [];
  let offset = 0;
  while ((offset = text.indexOf('{{graphic:', offset)) !== -1) {
    const end = text.indexOf('}}', offset);
    requireInput(end !== -1, 'unterminated graphic reference');
    const symbol = text.slice(offset + '{{graphic:'.length, end);
    requireInput(
      GRAPHIC_IDENTIFIER_PATTERN.test(symbol),
      'invalid graphic reference',
    );
    references.push(symbol);
    offset = end + 2;
  }
  return references;
}
