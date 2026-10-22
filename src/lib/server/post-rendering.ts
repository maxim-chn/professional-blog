import type { PostBundle } from '../persistence/contract.ts';
import { PersistenceError } from '../persistence/errors.ts';
import { graphicReferences } from '../persistence/models/post.ts';
import { buildMediaUrl } from './media-url.ts';

export function renderPostBody(bundle: PostBundle, origin: string): string {
  const contents = new Map(
    bundle.contents.map((content) => [content.id, content.data]),
  );
  let body = bundle.post.content_ids
    .map((id) => {
      const data = contents.get(id);
      if (data === undefined) {
        throw new PersistenceError(
          'STORAGE_INTEGRITY',
          'rendered post missing content',
        );
      }
      return data;
    })
    .join('');

  const mediaIds = new Map(
    Object.values(bundle.post.media_ids).flatMap((mapping) =>
      Object.entries(mapping),
    ),
  );

  for (const identifier of new Set(graphicReferences(body))) {
    const mediaId = mediaIds.get(identifier);
    if (mediaId === undefined) {
      throw new PersistenceError(
        'STORAGE_INTEGRITY',
        'rendered post missing graphic mapping',
      );
    }

    const mediaUrl = buildMediaUrl(origin, bundle.post.id, mediaId);
    body = body.replaceAll(`{{graphic:${identifier}}}`, () => mediaUrl);
  }

  return body;
}
