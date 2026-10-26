import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { savePreparedInputs } from '../../src/lib/publication/prepared-inputs.ts';
import { createBaselineSetupFixture } from './baseline-setup-fixture.ts';
import { loadE2eConfig } from './e2e-config.ts';
import { acquireE2eLock } from './e2e-lock.ts';
import { loadE2eRuntime } from './e2e-runtime.ts';
import { withBaselineStorage } from './e2e-storage-lifecycle.ts';
import { runPublicationCli } from './publication-cli.ts';
import { readStorageTree, type StorageSnapshot } from './storage-snapshot.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);
const METADATA_TIME = '2026-09-01T00:00:00.000Z';

async function createFixture(t: TestContext) {
  const fixture = await createBaselineSetupFixture(t);
  const directory = dirname(fixture.root);
  const snapshots = join(directory, 'snapshots');
  await mkdir(snapshots);
  const settings = await loadE2eConfig(CONFIG_FILE);
  const runtime = await loadE2eRuntime(
    settings.isolatedRuntimeConfig,
    fixture.root,
  );
  const bundle = preparePublication(
    '<p>Lifecycle fixture</p>',
    {
      title: 'Lifecycle',
      summary: 'Lifecycle fixture.',
      created_at: METADATA_TIME,
    },
    [],
    fixture.config,
  );
  const manifest = await savePreparedInputs(
    join(directory, 'prepared'),
    bundle,
    fixture.config,
  );
  return { ...fixture, snapshots, settings, runtime, bundle, manifest };
}

for (const shouldFail of [false, true]) {
  test(
    'restores storage after CLI publication and ' +
      (shouldFail ? 'an assertion failure' : 'success'),
    async (t) => {
      const fixture = await createFixture(t);
      const failure = new assert.AssertionError({
        message: 'Intentional lifecycle failure',
      });
      let recoveryDirectory = '';
      const result = withBaselineStorage(
        fixture.config,
        fixture.posts,
        fixture.snapshots,
        async (session) => {
          recoveryDirectory = session.recoveryDirectory;
          await session.registerPublication(fixture.bundle);
          const journalFiles = (await readdir(recoveryDirectory)).filter(
            (name) => name.startsWith('publication-'),
          );
          assert.equal(journalFiles.length, 1);
          const journal = JSON.parse(
            await readFile(join(recoveryDirectory, journalFiles[0]), 'utf8'),
          );
          assert.equal(journal.postId, fixture.bundle.post.id);
          const publication = await runPublicationCli(
            fixture.runtime,
            fixture.manifest,
            fixture.settings.publicationTimeoutMs,
          );
          assert.equal(
            (publication.result as { created: boolean }).created,
            true,
          );
          await writeFile(
            join(fixture.root, 'author-notes.txt'),
            'Temporary edit',
          );
          await writeFile(
            join(fixture.root, fixture.posts[0].paths[0]),
            'Temporary baseline edit',
          );
          if (shouldFail) throw failure;
          return 'Completed';
        },
      );
      if (shouldFail) {
        await assert.rejects(result, (error: unknown) => error === failure);
      } else {
        assert.equal(await result, 'Completed');
      }
      const prepared: StorageSnapshot = JSON.parse(
        await readFile(
          join(recoveryDirectory, 'prepared-snapshot.json'),
          'utf8',
        ),
      );
      assert.deepEqual(await readStorageTree(fixture.root), {
        directories: prepared.directories,
        files: prepared.files,
      });
      assert.deepEqual(
        JSON.parse(
          await readFile(join(recoveryDirectory, 'baseline.json'), 'utf8'),
        ),
        fixture.baseline,
      );
      assert.deepEqual(
        JSON.parse(
          await readFile(
            join(recoveryDirectory, 'initial-snapshot.json'),
            'utf8',
          ),
        ),
        fixture.initialSnapshot,
      );
      const cleanup = JSON.parse(
        await readFile(join(recoveryDirectory, 'cleanup.json'), 'utf8'),
      );
      assert.equal(cleanup.snapshotFile, 'prepared-snapshot.json');
      assert.ok(
        cleanup.generatedPostPaths.includes(
          join('records', fixture.bundle.post.id + '.json'),
        ),
      );
      const release = await acquireE2eLock(fixture.root, fixture.snapshots);
      await release();
    },
  );
}

test('retains the lock and recovery data when restoration fails, preserving the original error', async (t) => {
  const fixture = await createFixture(t);
  const failure = new Error('Original test failure');
  let recoveryDirectory = '';
  await assert.rejects(
    withBaselineStorage(
      fixture.config,
      fixture.posts,
      fixture.snapshots,
      async (session) => {
        recoveryDirectory = session.recoveryDirectory;
        await writeFile(join(fixture.root, 'unexpected.txt'), 'Do not delete');
        throw failure;
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0], failure);
      assert.ok(error.errors[1] instanceof AggregateError);
      return true;
    },
  );
  assert.equal(
    await readFile(join(fixture.root, 'unexpected.txt'), 'utf8'),
    'Do not delete',
  );
  for (const name of [
    'baseline.json',
    'initial-snapshot.json',
    'prepared-snapshot.json',
  ]) {
    JSON.parse(await readFile(join(recoveryDirectory, name), 'utf8'));
  }
  await assert.rejects(acquireE2eLock(fixture.root, fixture.snapshots), {
    code: 'EEXIST',
  });
});
