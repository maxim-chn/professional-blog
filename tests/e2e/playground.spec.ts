import { loadE2eRuntime } from '../support/e2e-runtime.ts';
import { readStorageTree } from '../support/storage-snapshot.ts';
import { expect, settings, test } from './shared-fixtures.ts';

const PLAYGROUND_PATH = '/playground/counter-demo/';
const MISSING_PLAYGROUND_PATH = '/playground/missing-e2e-demo/';
const ARTIFACT_PATH = '/artifacts/counter-demo/index.html';
const FRAME_SELECTOR = 'iframe[title="Independent Counter Demo"]';
const PLAYGROUND_TITLE = 'Counter Demo';

test('keeps Playground separate from posts and runs its sandboxed counter', async ({
  page,
  session,
}) => {
  const runtime = await loadE2eRuntime(settings.runtimeConfig);
  const before = await readStorageTree(runtime.persistence.root);
  await page.goto(session.origin);
  const visited = new Set<string>();

  while (true) {
    expect(visited.has(page.url())).toBe(false);
    visited.add(page.url());
    const catalogue = page.getByRole('region', {
      name: 'Published blog posts',
    });
    await expect(
      catalogue.getByRole('link', { name: PLAYGROUND_TITLE, exact: true }),
    ).toHaveCount(0);
    for (const href of await catalogue
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
      expect(href).not.toBeNull();
      expect(
        new URL(href!, session.origin).pathname.startsWith('/blog-post/'),
      ).toBe(true);
    }
    const older = page.getByRole('link', { name: 'Older posts', exact: true });
    if ((await older.count()) === 0) break;
    await older.click();
  }

  await page.goto(session.origin);
  await page
    .getByRole('region', { name: 'Playground', exact: true })
    .getByRole('link', { name: PLAYGROUND_TITLE, exact: true })
    .click();
  await expect(page).toHaveURL(new URL(PLAYGROUND_PATH, session.origin).href);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    PLAYGROUND_TITLE,
  );
  await expect(page.locator('.playground__header > p').last()).toHaveText(
    'Explore an interactive counter in a sandboxed Playground.',
  );
  await expect(page.locator('.playground__body p')).toHaveText([
    'Try the interactive counter below.',
    'The demo runs in a sandbox, independently of the surrounding page.',
  ]);
  const iframe = page.locator(FRAME_SELECTOR);
  await expect(iframe).toHaveAttribute('src', ARTIFACT_PATH);
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(iframe).toHaveCSS('height', '360px');
  await iframe.scrollIntoViewIfNeeded();

  const frame = page.frameLocator(FRAME_SELECTOR);
  await expect(frame.getByRole('heading', { level: 1 })).toHaveText(
    'Standalone HTML + JavaScript',
  );
  await expect(frame.locator('output')).toHaveText('0');
  await frame.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(frame.locator('output')).toHaveText('1');
  await frame.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(frame.locator('output')).toHaveText('2');

  const missing = await page.goto(
    new URL(MISSING_PLAYGROUND_PATH, session.origin).href,
  );
  expect(missing?.status()).toBe(404);
  expect(await readStorageTree(runtime.persistence.root)).toEqual(before);
});
