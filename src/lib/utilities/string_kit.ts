export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNonEmpty(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

// Unlike isNonEmpty, preserves whitespace-only content chunks.
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}
