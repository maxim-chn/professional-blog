import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ExpectedPost } from '../support/browser-post.ts';
import { loadE2eRuntime } from '../support/e2e-runtime.ts';
import { readStorageTree } from '../support/storage-snapshot.ts';
import { expect, settings, test } from './shared-fixtures.ts';

const EXPECTED_FILE = new URL(
  '../fixtures/baseline/design-patterns.expected.json',
  import.meta.url,
);
const OTHER_EXPECTED_FILE = new URL(
  '../fixtures/baseline/financial-research.expected.json',
  import.meta.url,
);

test('rejects invalid and missing post/media requests without changing storage', async ({
  page,
  session,
}) => {
  const runtime = await loadE2eRuntime(settings.runtimeConfig);
  const before = await readStorageTree(runtime.persistence.root);
  const expected: ExpectedPost = JSON.parse(
    await readFile(EXPECTED_FILE, 'utf8'),
  );
  const other: ExpectedPost = JSON.parse(
    await readFile(OTHER_EXPECTED_FILE, 'utf8'),
  );
  const postId = expected.postPath.split('/')[2];
  const mediaId = expected.media[0].path.split('/')[3];
  const otherPostId = other.postPath.split('/')[2];
  const missingId = randomUUID();
  const cases = [
    { path: '/blog-post/invalid/', status: 400, message: 'Invalid request.' },
    {
      path: '/media/invalid/' + mediaId,
      status: 400,
      message: 'Invalid request.',
    },
    {
      path: '/media/' + postId + '/invalid',
      status: 400,
      message: 'Invalid request.',
    },
    {
      path: '/blog-post/' + missingId + '/',
      status: 404,
      message: 'Not found.',
    },
    {
      path: '/media/' + missingId + '/' + mediaId,
      status: 404,
      message: 'Not found.',
    },
    {
      path: '/media/' + postId + '/' + missingId,
      status: 404,
      message: 'Not found.',
    },
    {
      path: '/media/' + otherPostId + '/' + mediaId,
      status: 404,
      message: 'Not found.',
    },
  ];

  for (const request of cases) {
    await test.step(request.path, async () => {
      const response = await page.goto(
        new URL(request.path, session.origin).href,
      );
      expect(response?.status()).toBe(request.status);
      expect(await response!.text()).toBe(request.message);
      await expect(page.locator('body')).toHaveText(request.message);
    });
  }

  expect(await readStorageTree(runtime.persistence.root)).toEqual(before);
});
