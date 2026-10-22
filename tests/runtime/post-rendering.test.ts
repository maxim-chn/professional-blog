import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { renderPostBody } from '../../src/lib/server/post-rendering.ts';
import { IMAGE_PNG } from '../../src/lib/utilities/mime_kit.ts';
import { createRuntimeFixture, TEST_PNG } from './fixtures.ts';

const VISITOR_ORIGIN = 'https://example.test';
const PUBLICATION_TIME = '2026-10-01T10:00:00.000Z';
const METADATA = {
  title: 'Rendering example',
  summary: 'A small rendering fixture.',
  created_at: '2026-09-01T00:00:00Z',
};
const GRAPHIC_TOKEN = '{{graphic:cover}}';

test('reconstructs ordered content and resolves split, repeated graphics without mutation', async (t) => {
  const fixture = await createRuntimeFixture(
    t,
    () => new Date(PUBLICATION_TIME),
    VISITOR_ORIGIN,
  );
  const body =
    '  <style>p { color: red; }</style>\n' +
    '<p>😀 Caption &amp; spacing</p>\n' +
    `<img alt="Cover" src="${GRAPHIC_TOKEN}">\n` +
    `<img alt="Cover again" src="${GRAPHIC_TOKEN}">  `;
  const bundle = preparePublication(
    body,
    METADATA,
    [{ identifier: 'cover', mime_type: IMAGE_PNG, data: TEST_PNG }],
    fixture.config,
  );

  assert.ok(
    bundle.contents.every((content) => !content.data.includes(GRAPHIC_TOKEN)),
  );
  await fixture.publish(bundle);
  const stored = await fixture.service.getPost(bundle.post.id);
  const shuffled = {
    ...stored,
    contents: [...stored.contents].reverse(),
  };
  const before = structuredClone(shuffled);
  const mediaUrl =
    `${VISITOR_ORIGIN}/media/${bundle.post.id}/` + bundle.media[0].id;

  assert.equal(
    renderPostBody(shuffled, VISITOR_ORIGIN),
    body.replaceAll(GRAPHIC_TOKEN, mediaUrl),
  );
  assert.deepEqual(structuredClone(shuffled), before);
  assert.deepEqual(await fixture.service.getPost(bundle.post.id), stored);

  const unmapped = {
    ...stored,
    post: { ...stored.post, media_ids: {} },
  };
  assert.throws(() => renderPostBody(unmapped, VISITOR_ORIGIN), {
    code: 'STORAGE_INTEGRITY',
  });
});

test('preserves media-free text exactly and rejects missing content', async (t) => {
  const fixture = await createRuntimeFixture(
    t,
    () => new Date(PUBLICATION_TIME),
    VISITOR_ORIGIN,
  );
  const body = ' \n<p>😀 e\u0301 &amp; unchanged text</p>\n  ';
  const bundle = preparePublication(body, METADATA, [], fixture.config);

  await fixture.publish(bundle);
  const stored = await fixture.service.getPost(bundle.post.id);
  assert.equal(renderPostBody(stored, VISITOR_ORIGIN), body);
  assert.throws(
    () => renderPostBody({ ...stored, contents: [] }, VISITOR_ORIGIN),
    { code: 'STORAGE_INTEGRITY' },
  );
});
