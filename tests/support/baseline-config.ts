import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { requireInput } from '../../src/lib/persistence/errors.ts';
import { objectFields, uuid } from '../../src/lib/persistence/models/fields.ts';
import { isNonEmptyArray } from '../../src/lib/utilities/array_kit.ts';
import { isNonEmpty } from '../../src/lib/utilities/string_kit.ts';

const BASELINE_CONFIG_FIELDS = ['description', 'posts'];
const BASELINE_POST_FIELDS = ['postId', 'paths'];
const POST_DATA_EXTENSIONS = new Map([
  ['records', '.json'],
  ['media', '.bin'],
]);

export interface BaselinePost {
  postId: string;
  paths: string[];
}

export async function loadBaselineConfig(
  file: string,
): Promise<BaselinePost[]> {
  requireInput(
    isAbsolute(file),
    'Baseline configuration path must be absolute',
  );
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  objectFields(raw, BASELINE_CONFIG_FIELDS, 'Baseline configuration fields');
  requireInput(
    isNonEmpty(raw.description),
    'Baseline configuration description',
  );
  requireInput(isNonEmptyArray(raw.posts), 'Baseline configuration posts');

  const postIds = new Set<string>();
  const selectedPaths = new Set<string>();

  return raw.posts.map((entry) => {
    objectFields(entry, BASELINE_POST_FIELDS, 'Baseline post fields');
    uuid(entry.postId, 'Baseline post identity');
    requireInput(
      !postIds.has(entry.postId),
      'Duplicate baseline post identity',
    );
    postIds.add(entry.postId);
    requireInput(isNonEmptyArray(entry.paths), 'Baseline post paths');

    const paths = entry.paths.map((path) => {
      requireInput(isNonEmpty(path), 'Baseline post-data path');
      const directory = dirname(path);
      const extension = extname(path);
      const identifier = basename(path, extension);
      requireInput(
        POST_DATA_EXTENSIONS.get(directory) === extension &&
          path === join(directory, `${identifier}${extension}`),
        `Baseline selection must identify a post-data file: ${path}`,
      );
      uuid(identifier, `Baseline post-data identity: ${path}`);
      requireInput(
        !selectedPaths.has(path),
        `Duplicate baseline post-data path: ${path}`,
      );
      selectedPaths.add(path);
      return path;
    });

    requireInput(
      paths.includes(join('records', `${entry.postId}.json`)),
      `Baseline selection must include its Post record: ${entry.postId}`,
    );
    return { postId: entry.postId, paths };
  });
}
