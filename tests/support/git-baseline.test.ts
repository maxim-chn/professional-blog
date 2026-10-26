import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
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
import { readStorageTree } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const BASELINE_PATH = join('records', 'post[1].bin');
const COMMITTED_BYTES = Buffer.from([0, 255, 13, 10, 128]);
const DUPLICATE_PATHS_MESSAGE = /^Duplicate baseline paths(?:\n|$)/;

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'git-baseline-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = await realpath(directory);
  const root = join(repository, 'storage');
  const hooks = join(repository, 'empty-hooks');
  await mkdir(join(root, 'records'), { recursive: true });
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
  await writeFile(join(root, BASELINE_PATH), COMMITTED_BYTES);
  await git('add', '--', 'storage');
  await git('commit', '--quiet', '-m', 'Temporary baseline fixture');
  const revision = (await git('rev-parse', 'HEAD')).trim();
  return { repository, root, revision, git };
}

test('captures committed binary bytes using literal paths without changing working or staged data', async (t) => {
  const { repository, root, revision, git } = await createFixture(t);
  await writeFile(join(root, BASELINE_PATH), 'Staged author edit');
  await git('add', '--', join('storage', BASELINE_PATH));
  await writeFile(join(root, BASELINE_PATH), 'Unstaged author edit');
  await writeFile(join(root, 'author.txt'), 'Untracked author data');
  const before = await readStorageTree(root);
  const stagedBefore = await git('diff', '--cached', '--binary');

  const baseline = await captureGitBaseline(root, [BASELINE_PATH]);

  assert.deepEqual(baseline, {
    repository,
    root,
    revision,
    files: [
      {
        relativePath: BASELINE_PATH,
        base64: COMMITTED_BYTES.toString('base64'),
      },
    ],
  });
  assert.deepEqual(await readStorageTree(root), before);
  assert.equal(await git('diff', '--cached', '--binary'), stagedBefore);
});

test('rejects empty, duplicate, escaping, directory, missing, and symbolic-link selections', async (t) => {
  const { repository, root, git } = await createFixture(t);
  await symlink('post[1].bin', join(root, 'records', 'linked.bin'));
  await git('add', '--', 'storage');
  await git('commit', '--quiet', '-m', 'Temporary symbolic-link fixture');
  await assert.rejects(captureGitBaseline(root, []), {
    message: 'Baseline paths must not be empty',
  });
  await assert.rejects(
    captureGitBaseline(root, [BASELINE_PATH, BASELINE_PATH]),
    {
      code: 'ERR_ASSERTION',
      message: DUPLICATE_PATHS_MESSAGE,
    },
  );
  await assert.rejects(captureGitBaseline(repository, [BASELINE_PATH]), {
    message: 'Storage must be a directory inside the repository',
  });

  for (const path of ['../outside', root, '.', 'records/../outside']) {
    await assert.rejects(captureGitBaseline(root, [path]), {
      message: `Invalid baseline path: ${path}`,
    });
  }
  for (const path of [
    'records',
    'missing.bin',
    join('records', 'linked.bin'),
  ]) {
    await assert.rejects(captureGitBaseline(root, [path]), {
      message: `Baseline path must identify one regular Git file: ${path}`,
    });
  }
});
