import { readFile } from 'node:fs/promises';
import {
  verifyPostNavigation,
  type ExpectedPost,
} from '../support/browser-post.ts';
import { loadE2eRuntime } from '../support/e2e-runtime.ts';
import { readStorageTree } from '../support/storage-snapshot.ts';
import { expect, settings, test } from './shared-fixtures.ts';

const EXPECTED_FILES = [
  'design-patterns.expected.json',
  'financial-research.expected.json',
];

for (const file of EXPECTED_FILES) {
  const expected: ExpectedPost = JSON.parse(
    await readFile(
      new URL('../fixtures/baseline/' + file, import.meta.url),
      'utf8',
    ),
  );

  test(
    'opens the complete existing post: ' + expected.title,
    async ({ page, session }) => {
      const runtime = await loadE2eRuntime(settings.runtimeConfig);
      const before = await readStorageTree(runtime.persistence.root);
      const response = await page.goto(session.origin);
      expect(response?.status()).toBe(200);
      const visited = new Set<string>();

      while (true) {
        expect(visited.has(page.url())).toBe(false);
        visited.add(page.url());
        const postLink = page
          .getByRole('region', { name: 'Published blog posts' })
          .getByRole('link', { name: expected.title, exact: true });
        if ((await postLink.count()) > 0) {
          await expect(postLink).toHaveAttribute(
            'href',
            new URL(expected.postPath, session.origin).href,
          );
          await verifyPostNavigation({
            page,
            origin: session.origin,
            expected,
            fixtureDirectory: runtime.persistence.root,
            timeoutMs: settings.testTimeoutMs,
            navigate: () => postLink.click(),
          });
          break;
        }

        const older = page.getByRole('link', {
          name: 'Older posts',
          exact: true,
        });
        await expect(older).toHaveCount(1);
        await older.click();
      }

      expect(await readStorageTree(runtime.persistence.root)).toEqual(before);
    },
  );
}
