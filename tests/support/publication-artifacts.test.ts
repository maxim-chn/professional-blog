import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { findPublicationArtifacts } from './publication-artifacts.ts';
import type { StorageFile, StorageTree } from './storage-snapshot.ts';

const GENERATED_RECORD = join('records', randomUUID() + '.json');
const GENERATED_MEDIA = join('media', randomUUID() + '.bin');
const STAGE = '.stage-' + randomUUID();
const OLD_STAGE = '.stage-' + randomUUID();
const TEMP_CATALOGUE = '.catalogue-' + randomUUID() + '.json';
const GENERATED_PATHS = [GENERATED_RECORD, GENERATED_MEDIA];

function file(relativePath: string): StorageFile {
  return {
    relativePath,
    base64: Buffer.from('Fixture bytes').toString('base64'),
  };
}

test('selects publication artifacts while excluding existing and generated post data', () => {
  const before: StorageTree = {
    directories: ['records', OLD_STAGE],
    files: [
      file('catalogue.json'),
      file('author-notes.txt'),
      file(join(OLD_STAGE, 'author.txt')),
    ],
  };
  const artifacts = [
    'media',
    STAGE,
    join(STAGE, basename(GENERATED_RECORD)),
    join(STAGE, basename(GENERATED_MEDIA)),
    join(STAGE, 'catalogue.json'),
    TEMP_CATALOGUE,
  ];
  const after: StorageTree = {
    directories: [...before.directories, 'media', STAGE],
    files: [
      ...before.files,
      ...GENERATED_PATHS.map(file),
      ...artifacts.slice(2).map(file),
    ],
  };
  const originals = structuredClone({ before, after });
  assert.deepEqual(
    findPublicationArtifacts(before, after, GENERATED_PATHS),
    artifacts,
  );
  assert.deepEqual({ before, after }, originals);
});

test('includes a newly created catalogue and storage directories', () => {
  assert.deepEqual(
    findPublicationArtifacts(
      { directories: [], files: [] },
      { directories: ['records', 'media'], files: [file('catalogue.json')] },
      [],
    ),
    ['records', 'media', 'catalogue.json'],
  );
});

test('rejects unexpected additions and additions inside pre-existing staging directories', () => {
  const before: StorageTree = { directories: [OLD_STAGE], files: [] };
  for (const path of [
    'author-notes.txt',
    join('records', randomUUID() + '.json'),
    join(STAGE, 'unknown.txt'),
    join(OLD_STAGE, basename(GENERATED_RECORD)),
  ]) {
    assert.throws(
      () =>
        findPublicationArtifacts(
          before,
          { directories: [OLD_STAGE, STAGE], files: [file(path)] },
          GENERATED_PATHS,
        ),
      { message: 'Unexpected publication file: ' + path },
    );
  }
  assert.throws(
    () =>
      findPublicationArtifacts(
        before,
        { directories: [OLD_STAGE, 'author-directory'], files: [] },
        GENERATED_PATHS,
      ),
    { message: 'Unexpected publication directory: author-directory' },
  );
});

test('rejects staging and temporary catalogue names without valid UUIDs', () => {
  const before: StorageTree = { directories: [], files: [] };
  const invalidTrees: StorageTree[] = [
    { directories: ['.stage-invalid'], files: [] },
    { directories: [], files: [file('.catalogue-invalid.json')] },
  ];
  for (const after of invalidTrees) {
    assert.throws(
      () => findPublicationArtifacts(before, after, GENERATED_PATHS),
      { code: 'INVALID_INPUT' },
    );
  }
});
