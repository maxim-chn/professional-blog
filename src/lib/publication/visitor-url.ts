import {
  hasNoWhitespaces,
  isEmpty,
  isNonEmpty,
} from '../utilities/string_kit.ts';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { uuid } from '../persistence/models/fields.ts';

const VISITOR_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const POST_VISITOR_PATH_PATTERN = '/blog-post/{postId}/';

export function resolveVisitorOrigin(value: unknown): string {
  requireInput(isNonEmpty(value), 'visitor origin must be a nonblank string');
  requireInput(hasNoWhitespaces(value), 'visitor origin contains whitespace');

  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new PersistenceError('INVALID_INPUT', 'invalid visitor origin', {
      cause,
    });
  }

  requireInput(
    VISITOR_PROTOCOLS.includes(url.protocol) &&
      isNonEmpty(url.hostname) &&
      isEmpty(url.username) &&
      isEmpty(url.password) &&
      url.pathname === '/' &&
      isEmpty(url.search) &&
      isEmpty(url.hash),
    'visitor origin must contain only an HTTP(S) scheme, host, and optional port',
  );

  return url.origin;
}

export function buildVisitorUrl(origin: string, postId: string): string {
  uuid(postId, 'visitor Post id');
  const resolvedOrigin = resolveVisitorOrigin(origin);
  const path = POST_VISITOR_PATH_PATTERN.replace('{postId}', postId);

  return new URL(path, resolvedOrigin).href;
}
