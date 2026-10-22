import type { APIRoute } from 'astro';
import { PersistenceError } from '../../../lib/persistence/errors.ts';
import { uuid } from '../../../lib/persistence/models/fields.ts';
import { createErrorResponse } from '../../../lib/server/http-errors.ts';
import type { RuntimePersistence } from '../../../lib/server/persistence.ts';
import { loadRuntime } from '../../../lib/server/runtime.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { postId, mediaId } = params;

  try {
    uuid(postId, 'requested Post id');
    uuid(mediaId, 'requested Media id');
  } catch (error) {
    return createErrorResponse(error, 'request');
  }

  let runtime: RuntimePersistence;
  try {
    runtime = await loadRuntime();
  } catch (error) {
    return createErrorResponse(error, 'configuration');
  }

  try {
    const bundle = await runtime.service.getPost(postId);
    const media = bundle.media.find(
      (item) => item.id === mediaId && item.post_id === postId,
    );

    if (media === undefined) {
      throw new PersistenceError('NOT_FOUND', 'requested post media');
    }

    return new Response(Uint8Array.from(media.data), {
      status: 200,
      headers: {
        'Content-Type': media.mime_type,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'request');
  }
};
