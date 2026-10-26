import { publishCataloguePost } from '../support/catalogue-publication.ts';
import { expect, test } from './isolated-fixtures.ts';

const CATALOGUE_PATH = '/blog-post-catalogue/';
const EARLIER_TIMESTAMP = '2026-10-01T10:00:00.000Z';
const LATER_TIMESTAMP = '2026-10-03T10:00:00.000Z';

test('shows correct navigation for empty and single-page catalogues', async ({
  page,
  session,
}) => {
  const firstUrl = new URL(CATALOGUE_PATH, session.origin).href;
  const catalogue = page.getByRole('region', { name: 'Published blog posts' });
  const older = page.getByRole('link', { name: 'Older posts', exact: true });
  const newer = page.getByRole('link', { name: 'Newer posts', exact: true });
  const latest = page.getByRole('link', { name: 'Latest posts', exact: true });

  const empty = await page.goto(firstUrl);
  expect(empty?.status()).toBe(200);
  await expect(catalogue).toHaveText('No blog posts on this page.');
  await expect(older).toHaveCount(0);
  await expect(newer).toHaveCount(0);
  await expect(latest).toHaveAttribute('href', firstUrl);

  const post = await publishCataloguePost(
    session.runtime,
    'Only catalogue post',
    EARLIER_TIMESTAMP,
  );
  await page.reload();
  await expect(catalogue.getByRole('link')).toHaveCount(1);
  await expect(catalogue.getByRole('link')).toHaveText(post.title);
  await expect(catalogue.getByRole('link')).toHaveAttribute('href', post.url);
  await expect(older).toHaveCount(0);
  await expect(newer).toHaveCount(0);

  const emptyLaterUrl = new URL(firstUrl);
  emptyLaterUrl.searchParams.set('next_page', post.registryTimestamp);
  const emptyLater = await page.goto(emptyLaterUrl.href);
  expect(emptyLater?.status()).toBe(200);
  await expect(catalogue).toHaveText('No blog posts on this page.');
  await expect(older).toHaveCount(0);
  await expect(newer).toHaveAttribute('href', firstUrl);
  await expect(latest).toHaveAttribute('href', firstUrl);
  await newer.click();
  await expect(page).toHaveURL(firstUrl);
  await expect(catalogue.getByRole('link')).toHaveText(post.title);
});

test('rejects malformed, duplicate, and inconsistent catalogue cursors', async ({
  page,
  session,
}) => {
  const queries = [
    [['next_page', 'invalid']],
    [['next_page', '']],
    [['next_page', '2026-10-01']],
    [
      ['next_page', EARLIER_TIMESTAMP],
      ['next_page', LATER_TIMESTAMP],
    ],
    [['prev_page', LATER_TIMESTAMP]],
    [
      ['next_page', EARLIER_TIMESTAMP],
      ['prev_page', 'invalid'],
    ],
    [
      ['next_page', LATER_TIMESTAMP],
      ['prev_page', EARLIER_TIMESTAMP],
    ],
    [
      ['next_page', EARLIER_TIMESTAMP],
      ['prev_page', EARLIER_TIMESTAMP],
    ],
    [
      ['next_page', EARLIER_TIMESTAMP],
      ['prev_page', LATER_TIMESTAMP],
      ['prev_page', LATER_TIMESTAMP],
    ],
  ];

  for (const parameters of queries) {
    const url = new URL(CATALOGUE_PATH, session.origin);
    url.search = new URLSearchParams(parameters).toString();
    await test.step(url.search, async () => {
      const response = await page.goto(url.href);
      expect(response?.status()).toBe(400);
      expect(await response!.text()).toBe('Invalid request.');
      await expect(page.locator('body')).toHaveText('Invalid request.');
    });
  }
});
