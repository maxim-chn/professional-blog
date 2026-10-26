import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { savePreparedInputs } from '../../src/lib/publication/prepared-inputs.ts';
import { buildVisitorUrl } from '../../src/lib/publication/visitor-url.ts';
import { createBaselineSetupFixture } from './baseline-setup-fixture.ts';
import { loadE2eConfig } from './e2e-config.ts';
import { withSharedE2e } from './e2e-lifecycle.ts';
import { acquireE2eLock } from './e2e-lock.ts';
import { loadE2eRuntime } from './e2e-runtime.ts';
import { startE2eServer } from './e2e-server.ts';
import { readStorageTree, type StorageSnapshot } from './storage-snapshot.ts';

const CONFIG_FILE = fileURLToPath(
  new URL('../config/e2e.json', import.meta.url),
);
const BODY = '<p>Live lifecycle publication</p>';
const METADATA_TIME = '2026-09-01T00:00:00.000Z';

async function createFixture(t: TestContext) {
  const fixture = await createBaselineSetupFixture(t);
  const directory = dirname(fixture.root);
  const configured = await loadE2eConfig(CONFIG_FILE);
  const bundle = preparePublication(
    BODY,
    {
      title: 'Live lifecycle',
      summary: 'Live lifecycle fixture.',
      created_at: METADATA_TIME,
    },
    [],
    fixture.config,
  );
  const publicationManifest = await savePreparedInputs(
    join(directory, 'prepared'),
    bundle,
    fixture.config,
  );
  const settings = {
    ...configured,
    publicationManifest,
    snapshotDirectory: join(directory, 'snapshots'),
    logDirectory: join(directory, 'logs'),
  };
  await mkdir(settings.snapshotDirectory);
  await mkdir(settings.logDirectory);
  const runtime = await loadE2eRuntime(
    settings.isolatedRuntimeConfig,
    fixture.root,
  );
  return { ...fixture, settings, runtime, bundle };
}

for (const shouldFail of [false, true]) {
  test(
    'runs live publication and restores storage after ' +
      (shouldFail ? 'failure' : 'success'),
    async (t) => {
      const fixture = await createFixture(t);
      const failure = new assert.AssertionError({
        message: 'Intentional live scenario failure',
      });
      let recoveryDirectory = '';
      const expectedIdentity = {
        post_id: fixture.bundle.post.id,
        post_metadata_id: fixture.bundle.metadata.id,
        visitor_url: buildVisitorUrl(
          fixture.runtime.publication.visitorOrigin,
          fixture.bundle.post.id,
        ),
      };
      const request = (url: string) =>
        fetch(url, {
          signal: AbortSignal.timeout(fixture.settings.testTimeoutMs),
        });
      const result = withSharedE2e(
        fixture.runtime,
        fixture.settings,
        fixture.posts,
        async (session) => {
          recoveryDirectory = session.recoveryDirectory;
          const baselineUrl = buildVisitorUrl(
            session.origin,
            fixture.baselinePost.post.id,
          );
          const baseline = await request(baselineUrl);
          assert.equal(baseline.status, 200);
          await baseline.text();
          const missing = await request(expectedIdentity.visitor_url);
          assert.equal(missing.status, 404);
          await missing.text();

          const created = await session.publish();
          assert.deepEqual(created.result, {
            ...expectedIdentity,
            created: true,
            duplicate: false,
          });
          const post = await request(expectedIdentity.visitor_url);
          assert.equal(post.status, 200);
          assert.ok((await post.text()).includes(BODY));
          const published = await readStorageTree(fixture.root);
          const duplicate = await session.publish();
          assert.deepEqual(duplicate.result, {
            ...expectedIdentity,
            created: false,
            duplicate: true,
          });
          assert.deepEqual(await readStorageTree(fixture.root), published);
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
      await readFile(
        join(
          fixture.settings.logDirectory,
          basename(recoveryDirectory) + '.log',
        ),
        'utf8',
      );
      const release = await acquireE2eLock(
        fixture.root,
        fixture.settings.snapshotDirectory,
      );
      await release();
      const restarted = await startE2eServer(fixture.runtime, fixture.settings);
      await restarted.stop();
    },
  );
}
