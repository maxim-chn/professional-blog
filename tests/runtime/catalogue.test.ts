import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { loadCataloguePage } from '../../src/lib/server/catalogue.ts';
import { createRuntimeFixture } from './fixtures.ts';

const VISITOR_ORIGIN = 'https://example.test';
const PUBLICATION_TIMES = [
  '2026-10-01T10:00:00.000Z',
  '2026-10-03T10:00:00.000Z',
  '2026-10-05T10:00:00.000Z',
  '2026-10-07T10:00:00.000Z',
  '2026-10-09T10:00:00.000Z',
];
const METADATA = {
  title: 'Catalogue example',
  summary: 'A small catalogue fixture.',
  created_at: '2026-09-01T00:00:00Z',
};

test('catalogue URLs preserve forward, backward, reload, and empty-page navigation', async (t) => {
  let instant = PUBLICATION_TIMES[0];
  const fixture = await createRuntimeFixture(
    t,
    () => new Date(instant),
    VISITOR_ORIGIN,
  );
  const postIds: string[] = [];

  for (const timestamp of PUBLICATION_TIMES) {
    instant = timestamp;
    const bundle = preparePublication(
      '<p>Example</p>',
      METADATA,
      [],
      fixture.config,
    );
    await fixture.publish(bundle);
    postIds.push(bundle.post.id);
  }

  const load = (parameters: URLSearchParams) =>
    loadCataloguePage(
      fixture.service,
      fixture.cataloguePageSize,
      VISITOR_ORIGIN,
      parameters,
    );

  const first = await load(new URLSearchParams());
  assert.deepEqual(
    first.items.map((item) => item.post_id),
    [postIds[4], postIds[3]],
  );
  assert.equal(first.newerPostsUrl, null);
  assert.equal(first.firstPageUrl, `${VISITOR_ORIGIN}/blog-post-catalogue/`);
  assert.equal(
    first.items[0].visitor_url,
    `${VISITOR_ORIGIN}/blog-post/${postIds[4]}/`,
  );

  assert.ok(first.olderPostsUrl);
  const secondUrl = new URL(first.olderPostsUrl);
  assert.equal(secondUrl.searchParams.get('next_page'), PUBLICATION_TIMES[3]);
  assert.deepEqual(secondUrl.searchParams.getAll('prev_page'), []);

  const second = await load(secondUrl.searchParams);
  assert.deepEqual(
    second.items.map((item) => item.post_id),
    [postIds[2], postIds[1]],
  );
  assert.equal(second.newerPostsUrl, first.firstPageUrl);
  assert.deepEqual(await load(secondUrl.searchParams), second);

  assert.ok(second.olderPostsUrl);
  const thirdUrl = new URL(second.olderPostsUrl);
  assert.equal(thirdUrl.searchParams.get('next_page'), PUBLICATION_TIMES[1]);
  assert.deepEqual(thirdUrl.searchParams.getAll('prev_page'), [
    PUBLICATION_TIMES[3],
  ]);

  const third = await load(thirdUrl.searchParams);
  assert.deepEqual(
    third.items.map((item) => item.post_id),
    [postIds[0]],
  );
  assert.equal(third.olderPostsUrl, null);
  assert.equal(third.newerPostsUrl, secondUrl.href);

  assert.ok(third.newerPostsUrl);
  const backToSecond = await load(new URL(third.newerPostsUrl).searchParams);
  assert.deepEqual(backToSecond, second);
  assert.ok(backToSecond.newerPostsUrl);
  assert.deepEqual(
    await load(new URL(backToSecond.newerPostsUrl).searchParams),
    first,
  );

  const emptyUrl = new URL(thirdUrl);
  emptyUrl.searchParams.append('prev_page', PUBLICATION_TIMES[1]);
  emptyUrl.searchParams.set('next_page', PUBLICATION_TIMES[0]);
  const empty = await load(emptyUrl.searchParams);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.olderPostsUrl, null);
  assert.equal(empty.newerPostsUrl, thirdUrl.href);
});

test('invalid navigation fails before accessing persistence', async () => {
  const service = {
    listPosts: async () => {
      assert.fail('Invalid navigation must not access persistence');
    },
  };
  const invalidParameters = [
    'next_page=invalid',
    'next_page=2026-02-30T10:00:00.000Z',
    'next_page=2026-10-01T10:00:00Z',
    `next_page=${PUBLICATION_TIMES[0]}&next_page=${PUBLICATION_TIMES[1]}`,
    `prev_page=${PUBLICATION_TIMES[1]}`,
    `next_page=${PUBLICATION_TIMES[1]}&prev_page=${PUBLICATION_TIMES[0]}`,
    `next_page=${PUBLICATION_TIMES[1]}&prev_page=${PUBLICATION_TIMES[1]}`,
  ];

  for (const parameters of invalidParameters) {
    await assert.rejects(
      loadCataloguePage(
        service,
        2,
        VISITOR_ORIGIN,
        new URLSearchParams(parameters),
      ),
      { code: 'INVALID_INPUT' },
    );
  }
});
