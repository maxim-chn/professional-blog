import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { promisify } from 'node:util';
import { captureGitBaseline } from './git-baseline.ts';
import { cleanGeneratedPostData } from './git-cleanup.ts';
import { captureStorageSnapshot, readStorageTree } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const BASELINE_PATH = join('records', `${randomUUID()}.json`);
const AUTHOR_PATH = join('media', `${randomUUID()}.bin`);
const GENERATED_RECORD = join('records', `${randomUUID()}.json`);
const GENERATED_MEDIA = join('media', `${randomUUID()}.bin`);
const STAGED_RECORD = join('records', `${randomUUID()}.json`);
const DIRECTORY_PATH = join('records', `${randomUUID()}.json`);

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'git-cleanup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = await realpath(directory);
  const root = join(repository, 'storage');
  const hooks = join(repository, 'empty-hooks');
  await mkdir(join(root, 'records'), { recursive: true });
  await mkdir(join(root, 'media'));
  await mkdir(hooks);

  async function git(...args: string[]) {
    const result = await executeFile('git', [
      '-C',
      repository,
      '-c',
      'user.name=E2E Test',
      '-c',
      'user.email=e2e@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      `core.hooksPath=${hooks}`,
      ...args,
    ]);
    return result.stdout;
  }

  await git('init', '--quiet');
  await writeFile(join(repository, '.gitignore'), 'storage/media/\n');
  await writeFile(join(root, BASELINE_PATH), 'Baseline data');
  await git('add', '--', '.gitignore', join('storage', BASELINE_PATH));
  await git('commit', '--quiet', '-m', 'Temporary cleanup fixture');
  await writeFile(join(root, AUTHOR_PATH), Buffer.from([0, 255, 128]));
  await writeFile(join(root, 'catalogue.json'), '{"author":"preserve"}\n');
  await writeFile(join(repository, 'new-test.ts'), 'Keep test artifact');

  const baseline = await captureGitBaseline(root, [BASELINE_PATH]);
  const snapshotFile = join(repository, 'snapshot.json');
  const snapshot = await captureStorageSnapshot(root, snapshotFile);
  return { repository, root, baseline, snapshot, snapshotFile, git };
}

test('cleans only designated generated files, including ignored media, and preserves pre-existing data', async (t) => {
  const { repository, root, baseline, snapshot, snapshotFile } =
    await createFixture(t);
  await writeFile(join(root, GENERATED_RECORD), 'Generated record');
  await writeFile(join(root, GENERATED_MEDIA), Buffer.from([1, 2, 3]));

  await cleanGeneratedPostData(baseline, snapshot, [
    GENERATED_RECORD,
    GENERATED_MEDIA,
  ]);

  assert.deepEqual(await readStorageTree(root), {
    directories: snapshot.directories,
    files: snapshot.files,
  });
  assert.equal(
    await readFile(join(repository, 'new-test.ts'), 'utf8'),
    'Keep test artifact',
  );
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, 'utf8')), snapshot);

  await cleanGeneratedPostData(baseline, snapshot, [
    GENERATED_RECORD,
    GENERATED_MEDIA,
  ]);
  assert.deepEqual(await readStorageTree(root), {
    directories: snapshot.directories,
    files: snapshot.files,
  });
});

test('validates the whole cleanup selection before deleting any generated file', async (t) => {
  const { root, baseline, snapshot, git } = await createFixture(t);
  await writeFile(join(root, GENERATED_RECORD), 'Generated record');
  await writeFile(join(root, STAGED_RECORD), 'Newly staged data');
  await git('add', '--', join('storage', STAGED_RECORD));
  await mkdir(join(root, DIRECTORY_PATH));
  const before = await readStorageTree(root);
  const stagedBefore = await git('diff', '--cached', '--binary');

  const rejected = [
    {
      path: BASELINE_PATH,
      message: `Cleanup path is protected: ${BASELINE_PATH}`,
    },
    { path: AUTHOR_PATH, message: `Cleanup path is protected: ${AUTHOR_PATH}` },
    {
      path: STAGED_RECORD,
      message: `Cleanup path is Git-tracked: ${STAGED_RECORD}`,
    },
    {
      path: DIRECTORY_PATH,
      message: `Cleanup path is a directory: ${DIRECTORY_PATH}`,
    },
    ...['catalogue.json', '../outside', 'records/test.ts', 'records'].map(
      (path) => ({
        path,
        message: `Cleanup requires an explicit post-data file path: ${path}`,
      }),
    ),
  ];
  for (const { path, message } of rejected) {
    await assert.rejects(
      cleanGeneratedPostData(baseline, snapshot, [GENERATED_RECORD, path]),
      { message },
    );
    assert.deepEqual(await readStorageTree(root), before);
  }
  assert.equal(await git('diff', '--cached', '--binary'), stagedBefore);
});

test('rejects symbolic links and preserves external targets', async (t) => {
  const { repository, root, baseline, snapshot } = await createFixture(t);
  const externalFile = join(repository, 'external.bin');
  await writeFile(externalFile, 'Protected external data');
  await writeFile(join(root, GENERATED_RECORD), 'Generated record');
  await symlink(externalFile, join(root, GENERATED_MEDIA));

  await assert.rejects(
    cleanGeneratedPostData(baseline, snapshot, [
      GENERATED_RECORD,
      GENERATED_MEDIA,
    ]),
    { message: `Unsupported storage entry: ${GENERATED_MEDIA}` },
  );
  assert.equal(await readFile(externalFile, 'utf8'), 'Protected external data');
  assert.equal(
    await readFile(join(root, GENERATED_RECORD), 'utf8'),
    'Generated record',
  );
});
