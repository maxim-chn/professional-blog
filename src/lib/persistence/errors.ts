export type ErrorCode =
  | 'INVALID_INPUT'
  | 'ID_CONFLICT'
  | 'NOT_FOUND'
  | 'STORAGE_INTEGRITY'
  | 'IO_FAILURE';

export class PersistenceError extends Error {
  readonly code: ErrorCode;
  readonly context: string;
  readonly cleanupFailures: string[];

  constructor(
    code: ErrorCode,
    context: string,
    options?: { cause?: unknown; cleanupFailures?: string[] },
  ) {
    super(`${code}: ${context}`, { cause: options?.cause });
    this.name = 'PersistenceError';
    this.code = code;
    this.context = context;
    this.cleanupFailures = options?.cleanupFailures ?? [];
  }
}

export function requireInput(
  condition: unknown,
  context: string,
): asserts condition {
  if (!condition) throw new PersistenceError('INVALID_INPUT', context);
}

export function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
