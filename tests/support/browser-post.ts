import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

export interface ExpectedPost {
  postPath: string;
  title: string;
  summary: string;
  metadataTimestamp: string;
  bodyBlocks: string[];
  media: {
    path: string;
    file: string;
    mimeType: string;
    alt: string;
    caption: string;
    naturalWidth: number;
    naturalHeight: number;
    sha256: string;
  }[];
}

export async function verifyPostNavigation(options: {
  page: Page;
  origin: string;
  expected: ExpectedPost;
  fixtureDirectory: string;
  timeoutMs: number;
  navigate: () => Promise<unknown>;
}): Promise<void> {
  const { page, origin, expected, fixtureDirectory, timeoutMs, navigate } =
    options;
  const body = page.locator('.post__body');
  const responses = Promise.all(
    expected.media.map((media) =>
      page.waitForResponse(
        (response) => response.url() === new URL(media.path, origin).href,
        { timeout: timeoutMs },
      ),
    ),
  );
  const [mediaResponses] = await Promise.all([
    responses,
    (async () => {
      await navigate();
      for (const media of expected.media) {
        await body
          .getByRole('img', { name: media.alt, exact: true })
          .scrollIntoViewIfNeeded();
      }
    })(),
  ]);

  await expect(page).toHaveURL(new URL(expected.postPath, origin).href);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    expected.title,
  );
  await expect(page.locator('.post__header > p').last()).toHaveText(
    expected.summary,
  );
  await expect(page.locator('.post__header time')).toHaveAttribute(
    'datetime',
    expected.metadataTimestamp,
  );
  await expect(body).toHaveText(expected.bodyBlocks.join(' '), {
    useInnerText: true,
  });
  await expect(body.locator('img')).toHaveCount(expected.media.length);
  await expect(body.locator('figcaption')).toHaveText(
    expected.media.map((media) => media.caption),
  );

  for (const [index, media] of expected.media.entries()) {
    const image = body.getByRole('img', { name: media.alt, exact: true });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute(
      'src',
      new URL(media.path, origin).href,
    );
    await expect(image).toHaveJSProperty('complete', true);
    await expect(image).toHaveJSProperty('naturalWidth', media.naturalWidth);
    await expect(image).toHaveJSProperty('naturalHeight', media.naturalHeight);

    const response = mediaResponses[index];
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(media.mimeType);
    const bytes = await response.body();
    expect(bytes).toEqual(
      await readFile(resolve(fixtureDirectory, media.file)),
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(media.sha256);
  }
}
