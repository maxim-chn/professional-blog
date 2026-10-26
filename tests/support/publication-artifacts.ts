import assert from 'node:assert/strict';
import { basename, sep } from 'node:path';
import { uuid } from '../../src/lib/persistence/models/fields.ts';
import type { StorageTree } from './storage-snapshot.ts';

const STAGING_DIRECTORY_PATTERN = /^\.stage-(.+)$/;
const CATALOGUE_TEMP_PATTERN = /^\.catalogue-(.+)\.json$/;
const PUBLICATION_DIRECTORIES = ['records', 'media'];
const CATALOGUE_FILE = 'catalogue.json';

function isStagingDirectory(name: string): boolean {
  const match = STAGING_DIRECTORY_PATTERN.exec(name);
  if (!match) return false;
  uuid(match[1], 'publication staging directory identity');
  return true;
}

function isCatalogueTemporaryFile(name: string): boolean {
  const match = CATALOGUE_TEMP_PATTERN.exec(name);
  if (!match) return false;
  uuid(match[1], 'publication temporary catalogue identity');
  return true;
}

export function findPublicationArtifacts(
  before: StorageTree,
  after: StorageTree,
  generatedPostPaths: readonly string[],
): string[] {
  const existing = new Set([
    ...before.directories,
    ...before.files.map((file) => file.relativePath),
  ]);
  const generated = new Set(generatedPostPaths);
  const stagedNames = new Set([
    CATALOGUE_FILE,
    ...generatedPostPaths.map((path) => basename(path)),
  ]);
  const created: string[] = [];

  for (const path of after.directories) {
    if (existing.has(path)) continue;
    assert.ok(
      PUBLICATION_DIRECTORIES.includes(path) || isStagingDirectory(path),
      'Unexpected publication directory: ' + path,
    );
    created.push(path);
  }

  for (const file of after.files) {
    const path = file.relativePath;
    if (existing.has(path) || generated.has(path)) continue;
    const parts = path.split(sep);
    const isStagedFile =
      parts.length === 2 &&
      !existing.has(parts[0]) &&
      isStagingDirectory(parts[0]) &&
      stagedNames.has(parts[1]);
    assert.ok(
      path === CATALOGUE_FILE ||
        (parts.length === 1 && isCatalogueTemporaryFile(path)) ||
        isStagedFile,
      'Unexpected publication file: ' + path,
    );
    created.push(path);
  }

  return created;
}
