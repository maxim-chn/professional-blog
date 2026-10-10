import { isString } from '../../utilities/string_kit.ts';
import { isMap } from '../../utilities/map_kit.ts';
import { requireInput } from '../errors.ts';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UTC_MILLISECONDS_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

// Shared model field constraints, not a separate validation pipeline.
export function objectFields(
  value: unknown,
  keys: readonly string[],
  context: string,
): asserts value is Record<string, unknown> {
  requireInput(isMap(value), context);
  requireInput(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
    context,
  );
}

export function uuid(value: unknown, context: string): asserts value is string {
  requireInput(isString(value) && UUID_V4_PATTERN.test(value), context);
}

export function utcTimestamp(
  value: unknown,
  context: string,
  milliseconds: boolean,
): asserts value is string {
  requireInput(isString(value), context);
  const pattern = milliseconds
    ? UTC_MILLISECONDS_PATTERN
    : UTC_TIMESTAMP_PATTERN;
  requireInput(
    pattern.test(value) && Number.isFinite(Date.parse(value)),
    context,
  );
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  requireInput(new Date(value).toISOString() === canonical, context);
}
