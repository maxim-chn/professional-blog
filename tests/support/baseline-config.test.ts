import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadBaselineConfig } from './baseline-config.ts';

const FIRST_POST_ID = randomUUID();
const SECOND_POST_ID = randomUUID();
const MEDIA_ID = randomUUID();
const FIRST_POST_PATH = join('records', `${FIRST_POST_ID}.json`);
const SECOND_POST_PATH = join('records', `${SECOND_POST_ID}.json`);
const MEDIA_PATH = join('media', `${MEDIA_ID}.bin`);
const FIRST_POST = {
  postId: FIRST_POST_ID,
  paths: [FIRST_POST_PATH, MEDIA_PATH],
};
const SECOND_POST = {
  postId: SECOND_POST_ID,
  paths: [SECOND_POST_PATH],
};
const VALID_CONFIG = {
  description: 'Explicit test baseline selection',
  posts: [FIRST_POST, SECOND_POST],
};

test('loads exactly the configured post and media selections', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'baseline-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'baseline.json');
  await writeFile(file, JSON.stringify(VALID_CONFIG));

  assert.deepEqual(await loadBaselineConfig(file), VALID_CONFIG.posts);
});

test('rejects ambiguous and out-of-scope restoration selections', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'baseline-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'baseline.json');
  const invalid: Array<{ name: string; value: unknown }> = [
    { name: 'empty post selection', value: { ...VALID_CONFIG, posts: [] } },
    {
      name: 'duplicate post identity',
      value: { ...VALID_CONFIG, posts: [FIRST_POST, FIRST_POST] },
    },
    {
      name: 'path shared between posts',
      value: {
        ...VALID_CONFIG,
        posts: [
          FIRST_POST,
          { ...SECOND_POST, paths: [SECOND_POST_PATH, MEDIA_PATH] },
        ],
      },
    },
    {
      name: 'missing owning Post record',
      value: {
        ...VALID_CONFIG,
        posts: [{ ...FIRST_POST, paths: [MEDIA_PATH] }],
      },
    },
    {
      name: 'unknown configuration option',
      value: { ...VALID_CONFIG, cleanupEverything: true },
    },
    ...[
      'catalogue.json',
      '../author.json',
      join(directory, 'outside.json'),
      'records',
      'records/test.ts',
      'records/not-a-uuid.json',
      `records/../records/${FIRST_POST_ID}.json`,
    ].map((path) => ({
      name: `invalid path: ${path}`,
      value: {
        ...VALID_CONFIG,
        posts: [{ ...FIRST_POST, paths: [FIRST_POST_PATH, path] }],
      },
    })),
  ];

  for (const scenario of invalid) {
    await t.test(scenario.name, async () => {
      await writeFile(file, JSON.stringify(scenario.value));
      await assert.rejects(loadBaselineConfig(file), { code: 'INVALID_INPUT' });
    });
  }

  await assert.rejects(loadBaselineConfig('relative-config.json'), {
    code: 'INVALID_INPUT',
  });
});
