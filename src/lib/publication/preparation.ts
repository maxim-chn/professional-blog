import { createHash, randomUUID } from 'node:crypto';
import { checkConfig, type PersistenceConfig } from '../persistence/config.ts';
import type { PostBundle } from '../persistence/contract.ts';
import { requireInput } from '../persistence/errors.ts';
import {
  GRAPHIC_IDENTIFIER_PATTERN,
  type Post,
} from '../persistence/models/post.ts';
import type { PostContent } from '../persistence/models/post-content.ts';
import type { PostMedia } from '../persistence/models/post-media.ts';
import type { PostMetadata } from '../persistence/models/post-metadata.ts';
import { checkBundle } from '../persistence/service.ts';
import { isBinary } from '../utilities/bin_data_kit.ts';
import { isNonEmpty, isNonEmptyString } from '../utilities/string_kit.ts';

export interface PreparationMedia {
  identifier: string;
  mime_type: string;
  data: Uint8Array;
}

function preparePostContents(
  body: string,
  postId: string,
  config: PersistenceConfig,
): PostContent[] {
  const codePoints = [...body];
  const contents: PostContent[] = [];

  for (
    let offset = 0;
    offset < codePoints.length;
    offset += config.contentMaxCodePoints
  ) {
    contents.push({
      id: randomUUID(),
      post_id: postId,
      data: codePoints
        .slice(offset, offset + config.contentMaxCodePoints)
        .join(''),
    });
  }

  requireInput(
    contents.map((content) => content.data).join('') === body,
    'prepared content reconstruction',
  );
  return contents;
}

function preparePostMedia(
  mediaInputs: PreparationMedia[],
  postId: string,
): { media: PostMedia[]; mediaIds: Post['media_ids'] } {
  const mediaIds = Object.create(null) as Post['media_ids'];
  const identifiers = new Set<string>();

  const media = mediaInputs.map((input) => {
    requireInput(
      isNonEmpty(input.identifier) &&
        GRAPHIC_IDENTIFIER_PATTERN.test(input.identifier) &&
        !identifiers.has(input.identifier),
      'publication graphic identifier',
    );
    requireInput(isNonEmpty(input.mime_type), 'publication media MIME type');
    requireInput(isBinary(input.data), 'publication media binary data');
    identifiers.add(input.identifier);

    const id = randomUUID();
    const data = Buffer.from(input.data);
    if (!Object.hasOwn(mediaIds, input.mime_type)) {
      mediaIds[input.mime_type] = Object.create(null) as Record<string, string>;
    }
    mediaIds[input.mime_type][input.identifier] = id;

    return {
      id,
      post_id: postId,
      mime_type: input.mime_type,
      data,
      checksum: createHash('sha256').update(data).digest('hex'),
    };
  });

  return { media, mediaIds };
}

// Call only for new inputs; retries load their saved manifest and chunks.
export function preparePublication(
  body: string,
  metadata: Omit<PostMetadata, 'id'>,
  mediaInputs: PreparationMedia[],
  config: PersistenceConfig,
): PostBundle {
  checkConfig(config);
  requireInput(isNonEmptyString(body), 'publication body');
  requireInput(Array.isArray(mediaInputs), 'publication media inputs');

  const postId = randomUUID();
  const contents = preparePostContents(body, postId, config);
  const { media, mediaIds } = preparePostMedia(mediaInputs, postId);

  const bundle = {
    post: {
      id: postId,
      content_ids: contents.map((content) => content.id),
      media_ids: mediaIds,
    },
    metadata: { ...metadata, id: randomUUID() },
    contents,
    media,
  };
  checkBundle(bundle, config);
  return bundle;
}
