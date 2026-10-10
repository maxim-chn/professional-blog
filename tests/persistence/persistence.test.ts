import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  loadPersistenceConfig,
  type PersistenceConfig,
} from '../../src/lib/persistence/config.ts';
import { PersistenceError } from '../../src/lib/persistence/errors.ts';
import {
  FileSystemAdapter,
  type StorageIO,
} from '../../src/lib/persistence/filesystem.ts';
import { PersistenceService } from '../../src/lib/persistence/service.ts';
import type { PostBundle } from '../../src/lib/persistence/contract.ts';

const configFile = new URL('../config/persistence.json', import.meta.url);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
  'base64',
);
const times = [
  '2026-10-01T10:00:00.000Z',
  '2026-10-04T10:00:00.000Z',
  '2026-10-07T10:00:00.000Z',
];

function hooked(
  hook: (operation: string, args: unknown[]) => void | Promise<void>,
): StorageIO {
  return new Proxy(
    { ...fs },
    {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== 'function') return value;
        return async (...args: unknown[]) => {
          await hook(String(property), args);
          return Reflect.apply(value, target, args);
        };
      },
    },
  );
}

async function setup(t: TestContext, io?: StorageIO) {
  const root = await fs.mkdtemp(join(tmpdir(), 'blog-persistence-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = await loadPersistenceConfig(configFile, root);
  const adapter = new FileSystemAdapter(config, io);
  let instant = times[0];
  const service = new PersistenceService(
    adapter,
    config,
    () => new Date(instant),
  );
  return {
    root,
    config,
    adapter,
    service,
    clock: (value: string) => {
      instant = value;
    },
  };
}

function bundle(config: PersistenceConfig, withMedia = true): PostBundle {
  const id = randomUUID();
  const body = withMedia
    ? '<p>😀  hi\n</p><img src="{{graphic:cover}}">'
    : '<p>😀  hi\n</p>';
  const points = [...body];
  const contents = [];
  for (
    let start = 0;
    start < points.length;
    start += config.contentMaxCodePoints
  )
    contents.push({
      id: randomUUID(),
      post_id: id,
      data: points.slice(start, start + config.contentMaxCodePoints).join(''),
    });
  const media = withMedia
    ? [
        {
          id: randomUUID(),
          post_id: id,
          mime_type: 'image/png',
          data: new Uint8Array(png),
          checksum: createHash('sha256').update(png).digest('hex'),
        },
      ]
    : [];
  return {
    post: {
      id,
      content_ids: contents.map((record) => record.id),
      media_ids: withMedia ? { 'image/png': { cover: media[0].id } } : {},
    },
    metadata: {
      id: randomUUID(),
      title: 'A post',
      summary: 'A summary',
      created_at: '2020-01-01T00:00:00Z',
    },
    contents,
    media,
  };
}

const publish = (service: PersistenceService, value: PostBundle) =>
  service.createPost(value.post, value.metadata, value.contents, value.media);
function errorCode(code: string) {
  return (error: unknown) =>
    error instanceof PersistenceError && error.code === code;
}
async function files(
  root: string,
  relative = '',
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await fs.readdir(join(root, relative), {
    withFileTypes: true,
  })) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await files(root, path));
    else
      result[path] = (await fs.readFile(join(root, path))).toString('base64');
  }
  return result;
}

// All writes are confined to temporary roots. No test mutates local_database.
test('round trip, shuffled chunks, exact binary bytes, reopen, media-free posts', async (t) => {
  const { service, config, clock } = await setup(t);
  const value = bundle(config);
  assert.deepEqual(
    await publish(service, {
      ...value,
      contents: [...value.contents].reverse(),
    }),
    {
      post_id: value.post.id,
      post_metadata_id: value.metadata.id,
      created: true,
      duplicate: false,
    },
  );
  const read = await service.getPost(value.post.id);
  assert.deepEqual(read.contents, value.contents);
  assert.deepEqual(read.post, value.post);
  assert.deepEqual(read.metadata, value.metadata);
  assert.equal(
    read.contents.map((record) => record.data).join(''),
    value.contents.map((record) => record.data).join(''),
  );
  assert.deepEqual(Buffer.from(read.media[0].data), png);
  assert.equal(read.media[0].checksum, value.media[0].checksum);
  assert.equal(read.media[0].mime_type, 'image/png');
  assert.deepEqual(
    await new FileSystemAdapter(config).getPost(value.post.id),
    read,
  );
  clock(times[1]);
  const plain = bundle(config, false);
  await publish(service, plain);
  assert.deepEqual((await service.getPost(plain.post.id)).media, []);
});

test('independent required configuration, relative paths and explicit overrides', async (t) => {
  const { root } = await setup(t);
  const application = await loadPersistenceConfig(
    new URL('../../config/persistence.json', import.meta.url),
  );
  const testing = await loadPersistenceConfig(configFile, root);
  assert.equal(
    application.root,
    new URL('../../local_database', import.meta.url).pathname,
  );
  assert.equal(testing.root, root);
  assert.notEqual(
    application.contentMaxCodePoints,
    testing.contentMaxCodePoints,
  );
  assert.notEqual(application.titleMaxCodePoints, testing.titleMaxCodePoints);
  const raw = JSON.parse(await fs.readFile(configFile, 'utf8'));
  const path = join(root, 'config.json');
  for (const field of [
    'root',
    'contentMaxCodePoints',
    'titleMaxCodePoints',
    'summaryMaxCodePoints',
    'supportedMediaTypes',
  ]) {
    const missing = { ...raw };
    delete missing[field];
    await fs.writeFile(path, JSON.stringify(missing));
    await assert.rejects(
      loadPersistenceConfig(path),
      errorCode('INVALID_INPUT'),
    );
  }
  for (const patch of [
    { contentMaxCodePoints: 0 },
    { titleMaxCodePoints: 1.5 },
    { supportedMediaTypes: ['text/html'] },
    { typo: true },
  ]) {
    await fs.writeFile(path, JSON.stringify({ ...raw, ...patch }));
    await assert.rejects(
      loadPersistenceConfig(path),
      errorCode('INVALID_INPUT'),
    );
  }
  await fs.writeFile(path, '{');
  await assert.rejects(loadPersistenceConfig(path), errorCode('INVALID_INPUT'));
  await assert.rejects(
    loadPersistenceConfig(join(root, 'missing')),
    errorCode('IO_FAILURE'),
  );
  await assert.rejects(
    loadPersistenceConfig(configFile, 'relative'),
    errorCode('INVALID_INPUT'),
  );
});

test('configured code-point boundary changes with configuration; no normalization', async (t) => {
  const { config, service } = await setup(t);
  const exact = bundle(config, false);
  exact.contents = [{ ...exact.contents[0], data: '😀'.repeat(10) }];
  exact.post.content_ids = [exact.contents[0].id];
  await publish(service, exact);
  assert.equal(
    (await service.getPost(exact.post.id)).contents[0].data,
    '😀'.repeat(10),
  );
  const above = bundle(config, false);
  above.contents = [{ ...above.contents[0], data: '😀'.repeat(11) }];
  above.post.content_ids = [above.contents[0].id];
  await assert.rejects(publish(service, above), errorCode('INVALID_INPUT'));
  const larger = { ...config, contentMaxCodePoints: 11 };
  await publish(
    new PersistenceService(
      new FileSystemAdapter(larger),
      larger,
      () => new Date(times[1]),
    ),
    above,
  );
});

const invalidCases: [
  string,
  (value: PostBundle, config: PersistenceConfig) => void,
][] = [
  [
    'empty content',
    (value) => {
      value.contents[0].data = '';
    },
  ],
  [
    'missing content',
    (value) => {
      value.contents.pop();
    },
  ],
  [
    'extra content',
    (value) => {
      value.contents.push({ ...value.contents[0], id: randomUUID() });
    },
  ],
  [
    'repeated content relationship',
    (value) => {
      value.post.content_ids.push(value.post.content_ids[0]);
    },
  ],
  [
    'duplicate content record',
    (value) => {
      value.contents.push(value.contents[0]);
    },
  ],
  [
    'content ownership',
    (value) => {
      value.contents[0].post_id = randomUUID();
    },
  ],
  [
    'missing media',
    (value) => {
      value.media = [];
    },
  ],
  [
    'extra media',
    (value) => {
      value.media.push({ ...value.media[0], id: randomUUID() });
    },
  ],
  [
    'duplicate media record',
    (value) => {
      value.media.push(value.media[0]);
    },
  ],
  [
    'media ownership',
    (value) => {
      value.media[0].post_id = randomUUID();
    },
  ],
  [
    'MIME map mismatch',
    (value) => {
      value.post.media_ids = { 'image/jpeg': { cover: value.media[0].id } };
    },
  ],
  [
    'false binary format',
    (value) => {
      value.media[0].data = new Uint8Array([1, 2, 3]);
      value.media[0].checksum = createHash('sha256')
        .update(value.media[0].data)
        .digest('hex');
    },
  ],
  [
    'checksum',
    (value) => {
      value.media[0].checksum = '0'.repeat(64);
    },
  ],
  [
    'unmapped graphic',
    (value) => {
      value.post.media_ids = { 'image/png': { other: value.media[0].id } };
    },
  ],
  [
    'duplicate symbolic mapping',
    (value) => {
      value.post.media_ids['image/jpeg'] = { cover: randomUUID() };
    },
  ],
  [
    'duplicate mapped media',
    (value) => {
      value.post.media_ids['image/png'].other = value.media[0].id;
    },
  ],
  [
    'malformed reserved reference',
    (value) => {
      value.contents[0].data = '{{graphic:';
    },
  ],
  [
    'blank title',
    (value) => {
      value.metadata.title = ' \n';
    },
  ],
  [
    'long title',
    (value, config) => {
      value.metadata.title = '😀'.repeat(config.titleMaxCodePoints + 1);
    },
  ],
  [
    'long summary',
    (value, config) => {
      value.metadata.summary = '😀'.repeat(config.summaryMaxCodePoints + 1);
    },
  ],
  [
    'invalid date',
    (value) => {
      value.metadata.created_at = '2026-02-30T00:00:00Z';
    },
  ],
  [
    'date without timezone',
    (value) => {
      value.metadata.created_at = '2026-01-01T00:00:00';
    },
  ],
  [
    'cross-model ID collision',
    (value) => {
      value.metadata.id = value.post.id;
    },
  ],
  [
    'path traversal ID',
    (value) => {
      value.post.id = '../outside';
    },
  ],
];
for (const [name, mutate] of invalidCases)
  test(`reject ${name} before publishing`, async (t) => {
    const { service, config, root } = await setup(t);
    const value = bundle(config);
    mutate(value, config);
    await assert.rejects(publish(service, value), errorCode('INVALID_INPUT'));
    assert.deepEqual(await service.listPosts(10), {
      items: [],
      next_cursor: null,
    });
    assert.deepEqual(await files(root), {});
  });

test('metadata boundaries and UUID-like prose without graphics', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config, false);
  value.metadata.title = '😀'.repeat(config.titleMaxCodePoints);
  value.metadata.summary = '😀'.repeat(config.summaryMaxCodePoints);
  const text = randomUUID();
  value.contents = [...text.matchAll(/.{1,10}/g)].map((match) => ({
    id: randomUUID(),
    post_id: value.post.id,
    data: match[0],
  }));
  value.post.content_ids = value.contents.map((record) => record.id);
  await publish(service, value);
});

test('retry ignores map key/input child order but preserves records and registry time', async (t) => {
  const { service, config, root, clock } = await setup(t);
  const value = bundle(config);
  value.media.push({ ...value.media[0], id: randomUUID() });
  value.post.media_ids['image/png'].second = value.media[1].id;
  await publish(service, value);
  const before = await files(root);
  clock(times[2]);
  const retry = structuredClone(value);
  retry.post.media_ids['image/png'] = {
    second: value.media[1].id,
    cover: value.media[0].id,
  };
  retry.media.reverse();
  retry.contents.reverse();
  assert.deepEqual(await publish(service, retry), {
    post_id: value.post.id,
    post_metadata_id: value.metadata.id,
    created: false,
    duplicate: true,
  });
  assert.deepEqual(await files(root), before);
  assert.equal((await service.listPosts(1)).next_cursor, times[0]);
  for (const mutate of [
    (copy: PostBundle) => {
      copy.metadata.title = 'changed';
    },
    (copy: PostBundle) => {
      copy.post.content_ids.reverse();
    },
    (copy: PostBundle) => {
      copy.contents[0].data = 'changed';
    },
  ]) {
    const conflict = structuredClone(value);
    mutate(conflict);
    await assert.rejects(publish(service, conflict), errorCode('ID_CONFLICT'));
    assert.deepEqual(await files(root), before);
  }
});

test('global conflicts and inaccessible leftover files are never overwritten', async (t) => {
  const { service, config, root } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const another = bundle(config, false);
  another.metadata.id = value.contents[0].id;
  await assert.rejects(publish(service, another), errorCode('ID_CONFLICT'));
  const orphan = bundle(config, false);
  const target = join(root, 'records', `${orphan.post.id}.json`);
  await fs.writeFile(target, 'inaccessible orphan');
  await assert.rejects(publish(service, orphan), errorCode('ID_CONFLICT'));
  await assert.rejects(service.getPost(orphan.post.id), errorCode('NOT_FOUND'));
  assert.equal(await fs.readFile(target, 'utf8'), 'inaccessible orphan');
});

test('descending pagination, strict bounds, later insertions and fresh instances', async (t) => {
  const { service, config, clock } = await setup(t);
  const reader = new FileSystemAdapter(config);
  const older = bundle(config, false);
  await publish(service, older);
  clock(times[1]);
  const newer = bundle(config, false);
  await publish(service, newer);
  const first = await reader.listPosts(1);
  assert.deepEqual(first.items, [
    { post_id: newer.post.id, metadata: newer.metadata },
  ]);
  assert.equal(first.next_cursor, times[1]);
  const second = await reader.listPosts(1, first.next_cursor);
  assert.equal(second.items[0].post_id, older.post.id);
  assert.equal(second.next_cursor, times[0]);
  assert.deepEqual(await reader.listPosts(1, second.next_cursor), {
    items: [],
    next_cursor: times[0],
  });
  assert.equal(
    (await reader.listPosts(1, '2026-10-03T00:00:00.000Z')).items[0].post_id,
    older.post.id,
  );
  clock(times[2]);
  const latest = bundle(config, false);
  latest.metadata.created_at = '1999-01-01T00:00:00Z';
  await publish(service, latest);
  assert.equal((await reader.listPosts(1)).items[0].post_id, latest.post.id);
  assert.equal(
    (await reader.listPosts(1, first.next_cursor)).items[0].post_id,
    older.post.id,
  );
  for (const limit of [0, -1, 1.5, NaN, Infinity])
    await assert.rejects(reader.listPosts(limit), errorCode('INVALID_INPUT'));
  for (const cursor of [
    '',
    '2026-10-01',
    '2026-10-01T00:00:00Z',
    '2026-02-30T00:00:00.000Z',
    '2026-10-01T00:00:00.000+00:00',
  ])
    await assert.rejects(
      reader.listPosts(1, cursor),
      errorCode('INVALID_INPUT'),
    );
});

test('listing reads catalogue only, never payloads or discovery scans', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const reads: string[] = [];
  const reader = new FileSystemAdapter(
    config,
    hooked((operation, args) => {
      assert.equal(operation, 'readFile');
      assert.equal(String(args[0]), join(config.root, 'catalogue.json'));
      reads.push(String(args[0]));
    }),
  );
  await reader.listPosts(2);
  assert.equal(reads.length, 1);
});

test('unknown, invalid, missing and corrupt records have distinct errors', async (t) => {
  const { service, config, root } = await setup(t);
  await assert.rejects(service.getPost(randomUUID()), errorCode('NOT_FOUND'));
  await assert.rejects(
    service.getPost('../outside'),
    errorCode('INVALID_INPUT'),
  );
  const value = bundle(config);
  await publish(service, value);
  const path = join(root, 'records', `${value.contents[0].id}.json`);
  const original = await fs.readFile(path);
  for (const corrupt of [
    '{',
    JSON.stringify({
      kind: 'content',
      value: { ...value.contents[0], id: randomUUID() },
    }),
    JSON.stringify({
      kind: 'content',
      value: { ...value.contents[0], data: '' },
    }),
  ]) {
    await fs.writeFile(path, corrupt);
    await assert.rejects(
      service.getPost(value.post.id),
      errorCode('STORAGE_INTEGRITY'),
    );
  }
  await fs.rm(path);
  await assert.rejects(
    service.getPost(value.post.id),
    errorCode('STORAGE_INTEGRITY'),
  );
  await fs.writeFile(path, original);
  await fs.writeFile(join(root, 'media', `${value.media[0].id}.bin`), 'broken');
  await assert.rejects(
    service.getPost(value.post.id),
    errorCode('STORAGE_INTEGRITY'),
  );
  await fs.writeFile(join(root, 'catalogue.json'), '{}');
  await assert.rejects(service.listPosts(1), errorCode('STORAGE_INTEGRITY'));
});

test('read I/O failures remain distinct from missing records', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  for (const target of ['catalogue.json', `${value.post.id}.json`]) {
    const reader = new FileSystemAdapter(
      config,
      hooked((operation, args) => {
        if (operation === 'readFile' && String(args[0]).endsWith(target))
          throw Object.assign(new Error('injected'), { code: 'EACCES' });
      }),
    );
    await assert.rejects(
      reader.getPost(value.post.id),
      errorCode('IO_FAILURE'),
    );
  }
});

for (const operation of ['writeFile', 'link', 'rename', 'rm'])
  test(`failure before catalogue commit (${operation}) preserves old state and cleans files`, async (t) => {
    const { service, config, root } = await setup(t);
    const old = bundle(config);
    await publish(service, old);
    const before = await files(root);
    const value = bundle(config);
    let failed = false;
    let writes = 0;
    const adapter = new FileSystemAdapter(
      config,
      hooked(async (op, args) => {
        if (
          op === operation &&
          !failed &&
          (op !== 'writeFile' || ++writes === 3)
        ) {
          failed = true;
          if (op === 'writeFile')
            await fs.writeFile(String(args[0]), 'partial');
          throw new Error('injected failure');
        }
      }),
    );
    await assert.rejects(
      publish(
        new PersistenceService(adapter, config, () => new Date(times[1])),
        value,
      ),
      errorCode('IO_FAILURE'),
    );
    assert.equal(failed, true);
    assert.deepEqual(await files(root), before);
    assert.equal((await service.listPosts(10)).items.length, 1);
    await assert.rejects(
      service.getPost(value.post.id),
      errorCode('NOT_FOUND'),
    );
    assert.equal((await service.getPost(old.post.id)).post.id, old.post.id);
  });

test('reader sees only old complete catalogue before atomic replacement', async (t) => {
  const { service, config } = await setup(t);
  const old = bundle(config);
  await publish(service, old);
  const next = bundle(config);
  let observed = false;
  const adapter = new FileSystemAdapter(
    config,
    hooked(async (operation) => {
      if (operation === 'rename') {
        observed = true;
        assert.equal((await service.listPosts(10)).items.length, 1);
        await assert.rejects(
          service.getPost(next.post.id),
          errorCode('NOT_FOUND'),
        );
        assert.equal((await service.getPost(old.post.id)).post.id, old.post.id);
      }
    }),
  );
  await publish(
    new PersistenceService(adapter, config, () => new Date(times[1])),
    next,
  );
  assert.equal(observed, true);
  assert.equal((await service.listPosts(10)).items.length, 2);
  assert.equal((await service.getPost(next.post.id)).post.id, next.post.id);
});

test('cleanup failures retain primary cause and identify paths without exposing partial posts', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config);
  let commitFailed = false;
  const adapter = new FileSystemAdapter(
    config,
    hooked((operation) => {
      if (operation === 'rename') {
        commitFailed = true;
        throw new Error('primary commit failure');
      }
      if (operation === 'rm' && commitFailed)
        throw new Error('cleanup failure');
    }),
  );
  await assert.rejects(
    publish(
      new PersistenceService(adapter, config, () => new Date(times[0])),
      value,
    ),
    (error: unknown) => {
      assert.ok(error instanceof PersistenceError);
      assert.equal(error.code, 'IO_FAILURE');
      assert.ok(error.cleanupFailures.length > 0);
      assert.ok(error.cause instanceof Error);
      assert.equal(error.cause.message, 'primary commit failure');
      return true;
    },
  );
  assert.deepEqual(await service.listPosts(1), {
    items: [],
    next_cursor: null,
  });
  await assert.rejects(service.getPost(value.post.id), errorCode('NOT_FOUND'));
});

test('roots are independent and absent stores start empty', async (t) => {
  const first = await setup(t);
  const second = await setup(t);
  const value = bundle(first.config);
  await publish(first.service, value);
  assert.deepEqual(await second.service.listPosts(1), {
    items: [],
    next_cursor: null,
  });
  await assert.rejects(
    second.service.getPost(value.post.id),
    errorCode('NOT_FOUND'),
  );
  const config = { ...second.config, root: join(second.root, 'new-store') };
  const service = new PersistenceService(
    new FileSystemAdapter(config),
    config,
    () => new Date(times[0]),
  );
  assert.deepEqual(await service.listPosts(1), {
    items: [],
    next_cursor: null,
  });
  await publish(service, value);
  assert.equal((await service.getPost(value.post.id)).post.id, value.post.id);
});

test('byte changes with a valid new checksum still conflict', async (t) => {
  const { service, config, root } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const before = await files(root);
  const changed = structuredClone(value);
  changed.media[0].data[changed.media[0].data.length - 1] ^= 1;
  changed.media[0].checksum = createHash('sha256')
    .update(changed.media[0].data)
    .digest('hex');
  await assert.rejects(publish(service, changed), errorCode('ID_CONFLICT'));
  assert.deepEqual(await files(root), before);
});

test('partial catalogue staging writes are cleaned without losing previous publications', async (t) => {
  const { service, config, root } = await setup(t);
  const old = bundle(config);
  await publish(service, old);
  const before = await files(root);
  const adapter = new FileSystemAdapter(
    config,
    hooked(async (operation, args) => {
      if (
        operation === 'writeFile' &&
        String(args[0]).endsWith('/catalogue.json')
      ) {
        await fs.writeFile(String(args[0]), '[');
        throw new Error('partial catalogue write');
      }
    }),
  );
  await assert.rejects(
    publish(
      new PersistenceService(adapter, config, () => new Date(times[1])),
      bundle(config),
    ),
    errorCode('IO_FAILURE'),
  );
  assert.deepEqual(await files(root), before);
  assert.equal((await service.getPost(old.post.id)).post.id, old.post.id);
});

test('stored metadata mismatch and duplicate registry association are integrity failures', async (t) => {
  const { service, config, root } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const metadataPath = join(root, 'records', `${value.metadata.id}.json`);
  const metadataRecord = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  metadataRecord.value.title = 'Different title';
  await fs.writeFile(metadataPath, JSON.stringify(metadataRecord));
  await assert.rejects(
    service.getPost(value.post.id),
    errorCode('STORAGE_INTEGRITY'),
  );
  const cataloguePath = join(root, 'catalogue.json');
  const entries = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
  entries.push(entries[0]);
  await fs.writeFile(cataloguePath, JSON.stringify(entries));
  await assert.rejects(service.listPosts(1), errorCode('STORAGE_INTEGRITY'));
});

test('caller mutation during publication cannot alter validated records', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config);
  const original = structuredClone(value);
  const saving = publish(service, value);
  value.metadata.title = 'mutated';
  value.contents[0].data = '';
  value.media[0].data.fill(0);
  await saving;
  const stored = await service.getPost(original.post.id);
  assert.deepEqual(stored.metadata, original.metadata);
  assert.deepEqual(stored.contents, original.contents);
  assert.deepEqual(Buffer.from(stored.media[0].data), png);
});

test('missing committed child cannot be replaced by a new post reusing its ID', async (t) => {
  const { service, config, root } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const missing = join(root, 'records', `${value.contents[0].id}.json`);
  await fs.rm(missing);
  const another = bundle(config, false);
  another.metadata.id = value.contents[0].id;
  await assert.rejects(
    publish(service, another),
    errorCode('STORAGE_INTEGRITY'),
  );
  await assert.rejects(
    fs.stat(missing),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT',
  );
});

test('empty and blank summaries are rejected before publication', async (t) => {
  const { service, config, root } = await setup(t);
  for (const summary of ['', ' ', '\n\t']) {
    const value = bundle(config);
    value.metadata.summary = summary;
    await assert.rejects(publish(service, value), errorCode('INVALID_INPUT'));
  }
  assert.deepEqual(await files(root), {});
});

test('whitespace-only content chunks remain intact', async (t) => {
  const { service, config } = await setup(t);
  const value = bundle(config, false);
  value.contents = [{ ...value.contents[0], data: ' \n\t ' }];
  value.post.content_ids = [value.contents[0].id];
  await publish(service, value);
  assert.equal(
    (await service.getPost(value.post.id)).contents[0].data,
    ' \n\t ',
  );
});

test('service catalogue and envelope checks retain storage-integrity classification', async (t) => {
  const { service, config, root } = await setup(t);
  const value = bundle(config);
  await publish(service, value);
  const cataloguePath = join(root, 'catalogue.json');
  const originalCatalogue = await fs.readFile(cataloguePath, 'utf8');
  const catalogue = JSON.parse(originalCatalogue);
  catalogue[0].metadata.summary = '';
  await fs.writeFile(cataloguePath, JSON.stringify(catalogue));
  await assert.rejects(service.listPosts(1), errorCode('STORAGE_INTEGRITY'));
  await fs.writeFile(cataloguePath, originalCatalogue);
  const mediaPath = join(root, 'records', `${value.media[0].id}.json`);
  const original = JSON.parse(await fs.readFile(mediaPath, 'utf8'));
  for (const record of [
    { ...original, kind: 'content' },
    { ...original, extra: true },
    { ...original, value: { ...original.value, data: [] } },
  ]) {
    await fs.writeFile(mediaPath, JSON.stringify(record));
    await assert.rejects(
      service.getPost(value.post.id),
      errorCode('STORAGE_INTEGRITY'),
    );
  }
});

test('adapter invokes the service Registry association check before writing', async (t) => {
  const { adapter, config, root } = await setup(t);
  const value = bundle(config);
  await assert.rejects(
    adapter.create(value, {
      post_id: value.post.id,
      post_metadata_id: randomUUID(),
      created_at: times[0],
    }),
    errorCode('INVALID_INPUT'),
  );
  await assert.rejects(
    adapter.create(value, {
      post_id: randomUUID(),
      post_metadata_id: value.metadata.id,
      created_at: times[0],
    }),
    errorCode('INVALID_INPUT'),
  );
  assert.deepEqual(await files(root), {});
});
