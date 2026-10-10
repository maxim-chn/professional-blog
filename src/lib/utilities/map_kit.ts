// A record-like object, not necessarily a native JavaScript Map or a plain object.
export function isMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
