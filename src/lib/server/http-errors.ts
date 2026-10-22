import { PersistenceError } from '../persistence/errors.ts';

const HTTP_ERROR_MESSAGES = {
  400: 'Invalid request.',
  404: 'Not found.',
  500: 'Unable to complete the request.',
} as const;

export function createErrorResponse(
  error: unknown,
  source: 'configuration' | 'request',
): Response {
  let status: keyof typeof HTTP_ERROR_MESSAGES = 500;

  if (source === 'request' && error instanceof PersistenceError) {
    if (error.code === 'INVALID_INPUT') {
      status = 400;
    } else if (error.code === 'NOT_FOUND') {
      status = 404;
    }
  }

  return new Response(HTTP_ERROR_MESSAGES[status], { status });
}
