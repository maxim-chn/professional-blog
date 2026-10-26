import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  verifyPostNavigation,
  type ExpectedPost,
} from '../support/browser-post.ts';
import { expect, settings, test } from './shared-fixtures.ts';

test('intentional failure after live publication', async ({
  page,
  session,
}, testInfo) => {
  await testInfo.attach('recovery-directory', {
    body: session.recoveryDirectory,
    contentType: 'text/plain',
  });
  const fixtureDirectory = dirname(settings.publicationManifest);
  const expected: ExpectedPost = JSON.parse(
    await readFile(join(fixtureDirectory, 'expected.json'), 'utf8'),
  );
  const publication = await session.publish();
  expect(publication.result).toMatchObject({
    created: true,
    duplicate: false,
    visitor_url: new URL(expected.postPath, session.origin).href,
  });
  await verifyPostNavigation({
    page,
    origin: session.origin,
    expected,
    fixtureDirectory,
    timeoutMs: settings.testTimeoutMs,
    navigate: () => page.goto(new URL(expected.postPath, session.origin).href),
  });

  expect(false, 'Intentional browser failure after publication').toBe(true);
});
