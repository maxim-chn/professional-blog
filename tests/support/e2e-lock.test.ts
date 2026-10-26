import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { acquireE2eLock } from './e2e-lock.ts';

async function createFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-lock-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'storage');
  const locks = join(directory, 'locks');
  await mkdir(root);
  await mkdir(locks);
  return { directory, root, locks };
}

test('rejects overlapping runs and releases each acquired lock once', async (t) => {
  const { root, locks } = await createFixture(t);
  const release = await acquireE2eLock(root, locks);
  await assert.rejects(acquireE2eLock(root, locks), { code: 'EEXIST' });
  assert.equal((await readdir(locks)).length, 1);

  const released = release();
  assert.equal(release(), released);
  await released;
  assert.deepEqual(await readdir(locks), []);

  const releaseNext = await acquireE2eLock(root, locks);
  await release();
  await assert.rejects(acquireE2eLock(root, locks), { code: 'EEXIST' });
  await releaseNext();
  assert.deepEqual(await readdir(locks), []);
  assert.deepEqual(await readdir(root), []);
});

test('canonicalizes root aliases while allowing independent storage roots', async (t) => {
  const { directory, root, locks } = await createFixture(t);
  const alias = join(directory, 'storage-alias');
  const otherRoot = join(directory, 'other-storage');
  await symlink(root, alias);
  await mkdir(otherRoot);

  const release = await acquireE2eLock(root, locks);
  await assert.rejects(acquireE2eLock(alias, locks), { code: 'EEXIST' });
  const releaseOther = await acquireE2eLock(otherRoot, locks);
  assert.equal((await readdir(locks)).length, 2);
  await release();
  await releaseOther();
  assert.deepEqual(await readdir(locks), []);
});

test('rejects locks inside storage, including symlink aliases, before creating them', async (t) => {
  const { directory, root } = await createFixture(t);
  const nested = join(root, 'locks');
  const alias = join(directory, 'locks-alias');
  await mkdir(nested);
  await symlink(nested, alias);

  for (const locks of [root, nested, alias]) {
    await assert.rejects(acquireE2eLock(root, locks), {
      message: 'E2E lock must be outside the storage root',
    });
  }
  assert.deepEqual(await readdir(root), ['locks']);
  assert.deepEqual(await readdir(nested), []);
});
