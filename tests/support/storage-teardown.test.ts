import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { promisify } from 'node:util';
import { captureGitBaseline } from './git-baseline.ts';
import { runWithCleanup } from './run-with-cleanup.ts';
import { captureStorageSnapshot, readStorageTree } from './storage-snapshot.ts';
import { restoreStorage } from './storage-teardown.ts';

const executeFile = promisify(execFile);
const BASELINE_PATH = join('records', `${randomUUID()}.json`);
const GENERATED_PATH = join('records', `${randomUUID()}.json`);
const STAGING_PATH = join('staging', 'partial');
const CATALOGUE = '[{"post":"baseline"},{"post":"author"}]\n';

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'storage-teardown-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = await realpath(directory);
  const root = join(repository, 'storage');
  const hooks = join(repository, 'empty-hooks');
  await mkdir(join(root, 'records'), { recursive: true });
  await mkdir(hooks);

  async function git(...args: string[]) {
    await executeFile('git', [
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
  }

  await git('init', '--quiet');
  await writeFile(join(root, BASELINE_PATH), 'Committed baseline');
  await writeFile(join(root, 'author.txt'), 'Committed author text');
  await writeFile(join(root, 'catalogue.json'), CATALOGUE);
  await git('add', '--', 'storage');
  await git('commit', '--quiet', '-m', 'Temporary teardown fixture');

  await writeFile(join(root, BASELINE_PATH), 'Pre-existing baseline edit');
  await writeFile(join(root, 'author.txt'), 'Pre-existing author edit');
  await writeFile(join(root, 'untracked.bin'), Buffer.from([0, 255, 128]));
  await writeFile(join(repository, 'new-test.ts'), 'Keep test artifact');
  const baseline = await captureGitBaseline(root, [BASELINE_PATH]);
  const baselineFile = join(repository, 'baseline.json');
  await writeFile(baselineFile, JSON.stringify(baseline), { flag: 'wx' });
  const snapshotFile = join(repository, 'snapshot.json');
  const snapshot = await captureStorageSnapshot(root, snapshotFile);
  return { repository, root, baseline, baselineFile, snapshot, snapshotFile };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function mutateStorage(fixture: Fixture): Promise<void> {
  await writeFile(join(fixture.root, BASELINE_PATH), 'Test baseline edit');
  await writeFile(join(fixture.root, 'author.txt'), 'Test author edit');
  await writeFile(join(fixture.root, 'catalogue.json'), 'Test catalogue');
  await writeFile(join(fixture.root, GENERATED_PATH), 'Generated post');
  await mkdir(join(fixture.root, 'staging'));
  await writeFile(join(fixture.root, STAGING_PATH), 'Partial publication');
}

async function verifyRecoveryFiles(fixture: Fixture): Promise<void> {
  assert.deepEqual(
    JSON.parse(await readFile(fixture.snapshotFile, 'utf8')),
    fixture.snapshot,
  );
  assert.deepEqual(
    JSON.parse(await readFile(fixture.baselineFile, 'utf8')),
    fixture.baseline,
  );
  assert.equal(
    await readFile(join(fixture.repository, 'new-test.ts'), 'utf8'),
    'Keep test artifact',
  );
}

for (const shouldFail of [false, true]) {
  test(`restores both storage scopes after ${shouldFail ? 'an assertion failure' : 'success'}`, async (t) => {
    const fixture = await createFixture(t);
    const failure = new assert.AssertionError({
      message: 'Intentional assertion failure',
    });
    const result = runWithCleanup(
      async () => {
        await mutateStorage(fixture);
        if (shouldFail) throw failure;
        return 'Completed';
      },
      () =>
        restoreStorage(
          fixture.baseline,
          fixture.snapshot,
          [GENERATED_PATH],
          ['staging', STAGING_PATH],
        ),
    );

    if (shouldFail) {
      await assert.rejects(result, (error: unknown) => error === failure);
    } else {
      assert.equal(await result, 'Completed');
    }

    const expected = new Map(
      fixture.snapshot.files.map((file) => [file.relativePath, file.base64]),
    );
    for (const file of fixture.baseline.files) {
      expected.set(file.relativePath, file.base64);
    }
    const restored = await readStorageTree(fixture.root);
    assert.deepEqual(
      new Map(restored.files.map((file) => [file.relativePath, file.base64])),
      expected,
    );
    assert.deepEqual(restored.directories, fixture.snapshot.directories);
    await verifyRecoveryFiles(fixture);
  });
}

test('preserves operation and teardown failures while attempting later restoration steps', async (t) => {
  const fixture = await createFixture(t);
  const originalFailure = new Error('Original operation failure');
  const unavailableBaseline = {
    ...fixture.baseline,
    revision: '0'.repeat(40),
  };

  await assert.rejects(
    runWithCleanup(
      async () => {
        await mutateStorage(fixture);
        throw originalFailure;
      },
      () =>
        restoreStorage(
          unavailableBaseline,
          fixture.snapshot,
          [GENERATED_PATH],
          ['staging', STAGING_PATH],
        ),
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 2);
      assert.equal(error.errors[0], originalFailure);
      const teardownFailure = error.errors[1];
      assert.ok(teardownFailure instanceof AggregateError);
      assert.equal(teardownFailure.errors.length, 1);
      assert.equal(
        teardownFailure.errors[0].message,
        'Git baseline restoration failed',
      );
      assert.ok(teardownFailure.errors[0].cause instanceof Error);
      return true;
    },
  );

  const restored = await readStorageTree(fixture.root);
  assert.deepEqual(
    restored.files.filter((file) => file.relativePath !== BASELINE_PATH),
    fixture.snapshot.files.filter(
      (file) => file.relativePath !== BASELINE_PATH,
    ),
  );
  assert.deepEqual(restored.directories, fixture.snapshot.directories);
  assert.equal(
    await readFile(join(fixture.root, BASELINE_PATH), 'utf8'),
    'Test baseline edit',
  );
  await verifyRecoveryFiles(fixture);
});

test('restores storage after setup fails before any generated post exists', async (t) => {
  const fixture = await createFixture(t);
  const setupFailure = new Error('Setup failed after snapshot capture');

  await assert.rejects(
    runWithCleanup(
      async () => {
        await writeFile(join(fixture.root, 'catalogue.json'), 'Partial setup');
        throw setupFailure;
      },
      () => restoreStorage(fixture.baseline, fixture.snapshot, [], []),
    ),
    (error: unknown) => error === setupFailure,
  );

  assert.deepEqual(await readStorageTree(fixture.root), {
    directories: fixture.snapshot.directories,
    files: fixture.snapshot.files.map((file) =>
      file.relativePath === BASELINE_PATH ? fixture.baseline.files[0] : file,
    ),
  });
  await verifyRecoveryFiles(fixture);
});

test('rejects overlapping cleanup scopes before changing storage', async (t) => {
  const fixture = await createFixture(t);
  await writeFile(join(fixture.root, GENERATED_PATH), 'Generated post');
  const before = await readStorageTree(fixture.root);

  await assert.rejects(
    restoreStorage(
      fixture.baseline,
      fixture.snapshot,
      [GENERATED_PATH],
      [GENERATED_PATH],
    ),
    {
      message: `Generated post data must use Git cleanup exclusively: ${GENERATED_PATH}`,
    },
  );

  assert.deepEqual(await readStorageTree(fixture.root), before);
  await verifyRecoveryFiles(fixture);
});
