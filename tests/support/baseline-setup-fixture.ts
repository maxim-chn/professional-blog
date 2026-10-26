import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';
import { loadPersistenceConfig } from '../../src/lib/persistence/config.ts';
import { FileSystemAdapter } from '../../src/lib/persistence/filesystem.ts';
import {
  PersistenceService,
  type CatalogueEntry,
} from '../../src/lib/persistence/service.ts';
import { preparePublication } from '../../src/lib/publication/preparation.ts';
import { IMAGE_PNG } from '../../src/lib/utilities/mime_kit.ts';
import { TEST_PNG } from '../runtime/fixtures.ts';
import { captureGitBaseline } from './git-baseline.ts';
import { captureStorageSnapshot } from './storage-snapshot.ts';

const executeFile = promisify(execFile);
const CONFIG_FILE = new URL('../config/persistence.json', import.meta.url);
const BASELINE_TIME = '2026-10-01T10:00:00.000Z';
const AUTHOR_TIME = '2026-10-02T10:00:00.000Z';
const METADATA_TIME = '2026-09-01T00:00:00.000Z';

export async function createBaselineSetupFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'baseline-setup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = await realpath(directory);
  const root = join(repository, 'storage');
  const hooks = join(repository, 'empty-hooks');
  await mkdir(root);
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
  const config = await loadPersistenceConfig(CONFIG_FILE, root);
  const adapter = new FileSystemAdapter(config);
  const baselinePost = preparePublication(
    '<p>Baseline</p><img src="{{graphic:cover}}">',
    {
      title: 'Baseline',
      summary: 'Baseline fixture.',
      created_at: METADATA_TIME,
    },
    [{ identifier: 'cover', mime_type: IMAGE_PNG, data: TEST_PNG }],
    config,
  );
  const baselineService = new PersistenceService(
    adapter,
    config,
    () => new Date(BASELINE_TIME),
  );
  await baselineService.createPost(
    baselinePost.post,
    baselinePost.metadata,
    baselinePost.contents,
    baselinePost.media,
  );
  await git('add', '--', 'storage');
  await git('commit', '--quiet', '-m', 'Temporary complete baseline');

  const authorPost = preparePublication(
    '<p>Author</p>',
    { title: 'Author', summary: 'Author fixture.', created_at: METADATA_TIME },
    [],
    config,
  );
  const authorService = new PersistenceService(
    adapter,
    config,
    () => new Date(AUTHOR_TIME),
  );
  await authorService.createPost(
    authorPost.post,
    authorPost.metadata,
    authorPost.contents,
    authorPost.media,
  );
  await writeFile(join(root, 'author-notes.txt'), 'Untracked author notes');

  const paths = [
    ...[
      baselinePost.post.id,
      baselinePost.metadata.id,
      ...baselinePost.contents.map((content) => content.id),
      ...baselinePost.media.map((media) => media.id),
    ].map((id) => join('records', `${id}.json`)),
    ...baselinePost.media.map((media) => join('media', `${media.id}.bin`)),
  ];
  const posts = [{ postId: baselinePost.post.id, paths }];
  const baseline = await captureGitBaseline(root, paths);
  const baselineFile = join(repository, 'baseline.json');
  await writeFile(baselineFile, JSON.stringify(baseline), { flag: 'wx' });

  await writeFile(join(root, paths[0]), 'Pre-existing baseline edit');
  const catalogueFile = join(root, 'catalogue.json');
  const catalogue: CatalogueEntry[] = JSON.parse(
    await readFile(catalogueFile, 'utf8'),
  );
  const entry = catalogue.find(
    (item) => item.registry.post_id === baselinePost.post.id,
  );
  assert.ok(entry);
  entry.metadata.title = 'Edited baseline title';
  await writeFile(catalogueFile, JSON.stringify(catalogue));

  const initialSnapshotFile = join(repository, 'initial-snapshot.json');
  const initialSnapshot = await captureStorageSnapshot(
    root,
    initialSnapshotFile,
  );
  return {
    root,
    config,
    adapter,
    baselinePost,
    authorPost,
    posts,
    baseline,
    baselineFile,
    initialSnapshot,
    initialSnapshotFile,
    preparedSnapshotFile: join(repository, 'prepared-snapshot.json'),
  };
}
