export function isBinary(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

export function isNonEmpy(value: unknown): value is Uint8Array {
  return isBinary(value) && value.length > 0;
}
