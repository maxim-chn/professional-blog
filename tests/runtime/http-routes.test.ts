import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { buildVisitorUrl } from '../../src/lib/publication/visitor-url.ts';
import { buildMediaUrl } from '../../src/lib/server/media-url.ts';
import { IMAGE_PNG } from '../../src/lib/utilities/mime_kit.ts';
import { createRuntimeFixture, TEST_PNG } from './fixtures.ts';
import { startHttpServer } from './http-server.ts';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const PLAYGROUND_PATH = '/playground/counter-demo/';
const MISSING_PLAYGROUND_PATH = '/playground/missing-demo/';
const ARTIFACT_PATH = '/artifacts/counter-demo/index.html';
const REMOVED_BLOG_PATH = '/blog/artifact-boundary/';
const IFRAME_PATTERN = /<iframe\b[^>]*>/;
const GRAPHIC_TOKEN = '{{graphic:cover}}';
const METADATA = {
  title: 'HTTP example',
  summary: 'A stored post served over HTTP.',
  created_at: '2026-09-01T00:00:00Z',
};

test('serves stored posts and media, separates Playground, and reports failures safely', async (t) => {
  let instant = '2026-10-01T10:00:00.000Z';
  const fixture = await createRuntimeFixture(
    t,
    () => new Date(instant),
    'http://127.0.0.1',
  );
  const body =
    '<p>😀 Exact spacing &amp; text</p>\n' +
    `<img alt="Cover" src="${GRAPHIC_TOKEN}">`;
  const bundle = preparePublication(
    body,
    METADATA,
    [{ identifier: 'cover', mime_type: IMAGE_PNG, data: TEST_PNG }],
    fixture.config,
  );
  await fixture.publish(bundle);

  instant = '2026-10-03T10:00:00.000Z';
  const other = preparePublication(
    '<p>Another post</p>',
    { ...METADATA, title: 'Another post' },
    [],
    fixture.config,
  );
  await fixture.publish(other);

  const origin = await startHttpServer(t, fixture.root);
  const postUrl = buildVisitorUrl(origin, bundle.post.id);
  const mediaUrl = buildMediaUrl(origin, bundle.post.id, bundle.media[0].id);

  const postResponse = await fetch(postUrl);
  assert.equal(postResponse.status, 200);
  const html = await postResponse.text();
  assert.ok(html.includes(METADATA.title));
  assert.ok(html.includes(METADATA.summary));
  assert.ok(html.includes(body.replaceAll(GRAPHIC_TOKEN, mediaUrl)));
  assert.ok(!IFRAME_PATTERN.test(html));

  const mediaResponse = await fetch(mediaUrl);
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.headers.get('content-type'), IMAGE_PNG);
  assert.deepEqual(
    Buffer.from(await mediaResponse.arrayBuffer()),
    Buffer.from(TEST_PNG),
  );

  const invalidPostUrl = postUrl.replace(bundle.post.id, 'invalid');
  const invalidMediaUrl = mediaUrl.replace(bundle.media[0].id, 'invalid');
  for (const url of [invalidPostUrl, invalidMediaUrl]) {
    const response = await fetch(url);
    assert.equal(response.status, 400);
    assert.equal(await response.text(), 'Invalid request.');
  }

  const missingUrls = [
    buildVisitorUrl(origin, UNKNOWN_ID),
    buildMediaUrl(origin, bundle.post.id, UNKNOWN_ID),
    buildMediaUrl(origin, other.post.id, bundle.media[0].id),
    new URL(REMOVED_BLOG_PATH, origin).href,
    new URL(MISSING_PLAYGROUND_PATH, origin).href,
  ];
  for (const url of missingUrls) {
    assert.equal((await fetch(url)).status, 404);
  }

  const playgroundResponse = await fetch(new URL(PLAYGROUND_PATH, origin));
  assert.equal(playgroundResponse.status, 200);
  const playgroundHtml = await playgroundResponse.text();
  const frame = playgroundHtml.match(IFRAME_PATTERN)?.[0];
  assert.ok(frame);
  assert.ok(frame.includes(`src="${ARTIFACT_PATH}"`));
  assert.ok(frame.includes('sandbox="allow-scripts"'));
  assert.ok(frame.includes('height: 360px'));
  assert.equal((await fetch(new URL(ARTIFACT_PATH, origin))).status, 200);

  const catalogue = await fixture.service.listPosts(10);
  assert.equal(catalogue.items.length, 2);

  await rm(join(fixture.root, 'records', `${bundle.post.content_ids[0]}.json`));
  for (const url of [postUrl, mediaUrl]) {
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), 'Unable to complete the request.');
  }
});
