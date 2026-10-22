import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { buildVisitorUrl } from '../../src/lib/publication/visitor-url.ts';
import { createRuntimeFixture } from './fixtures.ts';
import { startHttpServer } from './http-server.ts';

const CATALOGUE_PATH = '/blog-post-catalogue/';
const POST_LINK_PATTERN = /href="([^"]*\/blog-post\/[^"]+)"/g;
const OLDER_LINK_PATTERN = /<a\b[^>]*href="([^"]+)"[^>]*rel="next"/;
const NEWER_LINK_PATTERN = /<a\b[^>]*href="([^"]+)"[^>]*rel="prev"/;
const PUBLICATION_TIMES = [
  '2026-10-01T10:00:00.000Z',
  '2026-10-03T10:00:00.000Z',
  '2026-10-05T10:00:00.000Z',
  '2026-10-07T10:00:00.000Z',
];

function postLinks(html: string): string[] {
  return [...html.matchAll(POST_LINK_PATTERN)].map((match) => match[1]);
}

function navigationLink(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  assert.ok(match, 'Expected catalogue navigation link');
  return match[1].replaceAll('&amp;', '&');
}

async function readPage(url: string | URL): Promise<string> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.text();
}

test('homepage ignores cursors and catalogue navigation observes fresh publications', async (t) => {
  let instant = PUBLICATION_TIMES[0];
  const fixture = await createRuntimeFixture(
    t,
    () => new Date(instant),
    'http://127.0.0.1',
  );
  const origin = await startHttpServer(t, fixture.root);
  const catalogueUrl = new URL(CATALOGUE_PATH, origin);
  const empty = await readPage(catalogueUrl);
  assert.ok(empty.includes('No blog posts on this page.'));
  assert.ok(!OLDER_LINK_PATTERN.test(empty));
  assert.ok(!NEWER_LINK_PATTERN.test(empty));

  const postIds: string[] = [];
  const publish = async (timestamp: string) => {
    instant = timestamp;
    const bundle = preparePublication(
      '<p>Catalogue HTTP fixture</p>',
      {
        title: `Post ${postIds.length + 1}`,
        summary: 'A catalogue HTTP fixture.',
        created_at: '2026-09-01T00:00:00Z',
      },
      [],
      fixture.config,
    );
    await fixture.publish(bundle);
    postIds.push(bundle.post.id);
  };

  for (const timestamp of PUBLICATION_TIMES.slice(0, 3)) {
    await publish(timestamp);
  }

  const expectedFirst = [postIds[2], postIds[1]].map((id) =>
    buildVisitorUrl(origin, id),
  );
  const first = await readPage(catalogueUrl);
  assert.deepEqual(postLinks(first), expectedFirst);
  assert.ok(!NEWER_LINK_PATTERN.test(first));

  const homepage = new URL('/', origin);
  homepage.searchParams.set('next_page', 'invalid');
  homepage.searchParams.set('prev_page', 'invalid');
  assert.deepEqual(postLinks(await readPage(homepage)), expectedFirst);

  const secondUrl = navigationLink(first, OLDER_LINK_PATTERN);
  const second = await readPage(secondUrl);
  assert.deepEqual(postLinks(second), [buildVisitorUrl(origin, postIds[0])]);
  assert.ok(!OLDER_LINK_PATTERN.test(second));
  assert.equal(navigationLink(second, NEWER_LINK_PATTERN), catalogueUrl.href);
  assert.deepEqual(postLinks(await readPage(secondUrl)), postLinks(second));
  assert.deepEqual(
    postLinks(await readPage(navigationLink(second, NEWER_LINK_PATTERN))),
    expectedFirst,
  );

  const emptyUrl = new URL(secondUrl);
  emptyUrl.searchParams.append('prev_page', PUBLICATION_TIMES[1]);
  emptyUrl.searchParams.set('next_page', PUBLICATION_TIMES[0]);
  const emptyLaterPage = await readPage(emptyUrl);
  assert.deepEqual(postLinks(emptyLaterPage), []);
  assert.ok(!OLDER_LINK_PATTERN.test(emptyLaterPage));
  assert.equal(navigationLink(emptyLaterPage, NEWER_LINK_PATTERN), secondUrl);

  const invalidUrl = new URL(catalogueUrl);
  invalidUrl.searchParams.set('next_page', 'invalid');
  assert.equal((await fetch(invalidUrl)).status, 400);

  await publish(PUBLICATION_TIMES[3]);
  assert.deepEqual(
    postLinks(await readPage(catalogueUrl)),
    [postIds[3], postIds[2]].map((id) => buildVisitorUrl(origin, id)),
  );
  assert.deepEqual(postLinks(await readPage(secondUrl)), postLinks(second));
});
