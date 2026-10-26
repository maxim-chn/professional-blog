import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { promisify } from 'node:util';
import { captureGitBaseline } from './git-baseline.ts';
import { restoreGitBaseline } from './git-restoration.ts';
import { readStorageTree } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const BASELINE_PATH = join('records', 'post[1].bin');
const SECOND_BASELINE_PATH = join('records', 'second.bin');
const AUTHOR_PATH = join('records', 'post1.bin');
const BASELINE_BYTES = Buffer.from([0, 255, 13, 10, 128]);

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'git-restoration-'));
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
  await writeFile(join(root, BASELINE_PATH), BASELINE_BYTES);
  await writeFile(join(root, SECOND_BASELINE_PATH), 'Second baseline');
  await writeFile(join(root, AUTHOR_PATH), 'Committed author data');
  await git('add', '--', 'storage');
  await git('commit', '--quiet', '-m', 'Temporary restoration fixture');
  const baseline = await captureGitBaseline(root, [
    BASELINE_PATH,
    SECOND_BASELINE_PATH,
  ]);
  return { repository, root, baseline, git };
}

test('restores changed and deleted files from the captured revision without touching author data or the index', async (t) => {
  const { repository, root, baseline, git } = await createFixture(t);
  await writeFile(join(root, BASELINE_PATH), 'Later committed value');
  await git('add', '--', join('storage', BASELINE_PATH));
  await git('commit', '--quiet', '-m', 'Advance temporary HEAD');
  const laterRevision = (await git('rev-parse', 'HEAD')).trim();
  assert.notEqual(laterRevision, baseline.revision);
  await unlink(join(root, SECOND_BASELINE_PATH));
  await writeFile(join(root, AUTHOR_PATH), 'Staged author value');
  await git('add', '--', join('storage', AUTHOR_PATH));
  await writeFile(join(root, AUTHOR_PATH), 'Unstaged author value');
  await writeFile(join(root, 'author-untracked.txt'), 'Keep author file');
  await writeFile(join(repository, 'new-test.ts'), 'Keep test artifact');
  const before = await readStorageTree(root);
  const stagedBefore = await git('diff', '--cached', '--binary');

  await restoreGitBaseline(baseline);

  const expectedFiles = new Map(
    before.files.map((file) => [file.relativePath, file.base64]),
  );
  for (const file of baseline.files) {
    expectedFiles.set(file.relativePath, file.base64);
  }
  const restored = await readStorageTree(root);
  assert.deepEqual(
    new Map(restored.files.map((file) => [file.relativePath, file.base64])),
    expectedFiles,
  );
  assert.deepEqual(restored.directories, before.directories);
  assert.equal(await git('diff', '--cached', '--binary'), stagedBefore);
  assert.equal((await git('rev-parse', 'HEAD')).trim(), laterRevision);
  assert.equal(
    await readFile(join(repository, 'new-test.ts'), 'utf8'),
    'Keep test artifact',
  );

  await restoreGitBaseline(baseline);
  assert.deepEqual(await readStorageTree(root), restored);
});

test('rejects invalid selections and symbolic links before restoring any file', async (t) => {
  const { repository, root, baseline } = await createFixture(t);
  await writeFile(join(root, BASELINE_PATH), 'Pending edit');
  const before = await readStorageTree(root);
  await assert.rejects(restoreGitBaseline({ ...baseline, revision: 'HEAD' }), {
    message: 'Invalid baseline revision',
  });
  await assert.rejects(restoreGitBaseline({ ...baseline, files: [] }), {
    message: 'Baseline files must not be empty',
  });
  for (const path of ['../outside', root, '.', 'records/../outside']) {
    await assert.rejects(
      restoreGitBaseline({
        ...baseline,
        files: [...baseline.files, { relativePath: path, base64: '' }],
      }),
      { message: `Invalid baseline path: ${path}` },
    );
  }
  assert.deepEqual(await readStorageTree(root), before);

  const externalFile = join(repository, 'external.bin');
  await writeFile(externalFile, 'Protected target');
  await symlink(externalFile, join(root, 'linked.bin'));
  await assert.rejects(restoreGitBaseline(baseline), {
    message: 'Unsupported storage entry: linked.bin',
  });
  assert.equal(await readFile(externalFile, 'utf8'), 'Protected target');
  assert.equal(
    await readFile(join(root, BASELINE_PATH), 'utf8'),
    'Pending edit',
  );
});
