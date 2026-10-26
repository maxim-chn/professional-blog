import type { Page } from '@playwright/test';
import {
  publishCataloguePost,
  type CataloguePost,
} from '../support/catalogue-publication.ts';
import { expect, settings, test } from './isolated-fixtures.ts';

const CATALOGUE_PATH = '/blog-post-catalogue/';
const PUBLICATION_TIMES = [
  '2026-10-01T10:00:00.000Z',
  '2026-10-03T10:00:00.000Z',
  '2026-10-05T10:00:00.000Z',
  '2026-10-07T10:00:00.000Z',
  '2026-10-09T10:00:00.000Z',
];
const NEW_PUBLICATION_TIME = '2026-10-11T10:00:00.000Z';

async function verifyItems(page: Page, posts: CataloguePost[]): Promise<void> {
  const links = page
    .getByRole('region', { name: 'Published blog posts' })
    .getByRole('link');
  await expect(links).toHaveText(posts.map((post) => post.title));
  for (const [index, post] of posts.entries()) {
    await expect(links.nth(index)).toHaveAttribute('href', post.url);
  }
}

test('preserves catalogue pages across navigation and new publications', async ({
  page,
  context,
  session,
}) => {
  const count = settings.paginationFixtureCount;
  const pageSize = session.runtime.runtime.cataloguePageSize;
  expect(count).toBeLessThanOrEqual(PUBLICATION_TIMES.length);
  expect(count).toBeGreaterThan(pageSize * 2);
  const posts: CataloguePost[] = [];
  for (const [index, timestamp] of PUBLICATION_TIMES.slice(
    0,
    count,
  ).entries()) {
    posts.push(
      await publishCataloguePost(
        session.runtime,
        'Catalogue post ' + (index + 1),
        timestamp,
      ),
    );
  }
  const ordered = [...posts].reverse();
  const pages = Array.from(
    { length: Math.ceil(count / pageSize) },
    (_, index) => ordered.slice(index * pageSize, (index + 1) * pageSize),
  );
  const pageUrls = pages.map((_, index) => {
    const url = new URL(CATALOGUE_PATH, session.origin);
    if (index > 0) {
      url.searchParams.set(
        'next_page',
        ordered[index * pageSize - 1].registryTimestamp,
      );
      for (let previous = 1; previous < index; previous++) {
        url.searchParams.append(
          'prev_page',
          ordered[previous * pageSize - 1].registryTimestamp,
        );
      }
    }
    return url.href;
  });

  async function verifyPage(target: Page, index: number): Promise<void> {
    await expect(target).toHaveURL(pageUrls[index]);
    await verifyItems(target, pages[index]);
    await expect(
      target.getByRole('link', { name: 'Latest posts', exact: true }),
    ).toHaveAttribute('href', pageUrls[0]);
    const older = target.getByRole('link', {
      name: 'Older posts',
      exact: true,
    });
    const newer = target.getByRole('link', {
      name: 'Newer posts',
      exact: true,
    });
    if (index === 0) {
      await expect(newer).toHaveCount(0);
    } else {
      await expect(newer).toHaveAttribute('href', pageUrls[index - 1]);
    }
    if (index === pages.length - 1) {
      await expect(older).toHaveCount(0);
    } else {
      await expect(older).toHaveAttribute('href', pageUrls[index + 1]);
    }
  }

  await page.goto(pageUrls[0]);
  await verifyPage(page, 0);
  for (let index = 1; index < pages.length; index++) {
    await page.getByRole('link', { name: 'Older posts', exact: true }).click();
    await verifyPage(page, index);
  }
  const last = pages.length - 1;
  await page.reload();
  await verifyPage(page, last);

  const copiedPage = await context.newPage();
  try {
    await copiedPage.goto(page.url());
    await verifyPage(copiedPage, last);
  } finally {
    await copiedPage.close();
  }

  await page.goBack();
  await verifyPage(page, last - 1);
  await page.goForward();
  await verifyPage(page, last);
  for (let index = last - 1; index >= 0; index--) {
    await page.getByRole('link', { name: 'Newer posts', exact: true }).click();
    await verifyPage(page, index);
  }

  const homepage = new URL('/', session.origin);
  homepage.searchParams.set('next_page', 'invalid');
  homepage.searchParams.set('prev_page', 'invalid');
  const response = await page.goto(homepage.href);
  expect(response?.status()).toBe(200);
  await verifyItems(page, pages[0]);
  await expect(
    page.getByRole('link', { name: 'Newer posts', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Older posts', exact: true }),
  ).toHaveAttribute('href', pageUrls[1]);

  const newest = await publishCataloguePost(
    session.runtime,
    'Newly published catalogue post',
    NEW_PUBLICATION_TIME,
  );
  await page.reload();
  const refreshedFirst = [newest, ...ordered].slice(0, pageSize);
  await verifyItems(page, refreshedFirst);
  await page.goto(pageUrls[1]);
  await verifyPage(page, 1);
  await page.getByRole('link', { name: 'Latest posts', exact: true }).click();
  await expect(page).toHaveURL(pageUrls[0]);
  await verifyItems(page, refreshedFirst);
});
