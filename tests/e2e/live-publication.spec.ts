import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadManifest } from '../../src/lib/publication/manifest.ts';
import {
  verifyPostNavigation,
  type ExpectedPost,
} from '../support/browser-post.ts';
import { loadE2eRuntime } from '../support/e2e-runtime.ts';
import { readStorageTree } from '../support/storage-snapshot.ts';
import { expect, settings, test } from './shared-fixtures.ts';

test('publishes a new post while the server runs and opens it after homepage refresh', async ({
  page,
  session,
}) => {
  const runtime = await loadE2eRuntime(settings.runtimeConfig);
  const fixtureDirectory = dirname(settings.publicationManifest);
  const expected: ExpectedPost = JSON.parse(
    await readFile(join(fixtureDirectory, 'expected.json'), 'utf8'),
  );
  const manifest = await loadManifest(
    settings.publicationManifest,
    runtime.persistence,
  );
  const visitorUrl = new URL(expected.postPath, session.origin).href;
  const identity = {
    post_id: manifest.post.id,
    post_metadata_id: manifest.metadata.id,
    visitor_url: visitorUrl,
  };

  const initial = await page.goto(session.origin);
  expect(initial?.status()).toBe(200);
  const catalogue = page.getByRole('region', { name: 'Published blog posts' });
  const postLink = catalogue.getByRole('link', {
    name: expected.title,
    exact: true,
  });
  await expect(postLink).toHaveCount(0);

  const created = await session.publish();
  expect(created.result).toEqual({
    ...identity,
    created: true,
    duplicate: false,
  });

  const refreshed = await page.reload();
  expect(refreshed?.status()).toBe(200);
  await expect(postLink).toHaveAttribute('href', visitorUrl);
  await expect(catalogue.getByRole('link').first()).toHaveAttribute(
    'href',
    visitorUrl,
  );
  await verifyPostNavigation({
    page,
    origin: session.origin,
    expected,
    fixtureDirectory,
    timeoutMs: settings.testTimeoutMs,
    navigate: () => postLink.click(),
  });

  const published = await readStorageTree(runtime.persistence.root);
  const duplicate = await session.publish();
  expect(duplicate.result).toEqual({
    ...identity,
    created: false,
    duplicate: true,
  });
  expect(await readStorageTree(runtime.persistence.root)).toEqual(published);
});
