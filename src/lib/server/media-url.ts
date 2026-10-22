import { uuid } from '../persistence/models/fields.ts';
import { resolveVisitorOrigin } from '../publication/visitor-url.ts';

const POST_MEDIA_PATH_PATTERN = '/media/{postId}/{mediaId}';

export function buildMediaUrl(
  origin: string,
  postId: string,
  mediaId: string,
): string {
  uuid(postId, 'media URL Post id');
  uuid(mediaId, 'media URL Media id');
  const path = POST_MEDIA_PATH_PATTERN.replace('{postId}', postId).replace(
    '{mediaId}',
    mediaId,
  );

  return new URL(path, resolveVisitorOrigin(origin)).href;
}
