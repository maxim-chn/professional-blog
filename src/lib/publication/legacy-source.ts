import { parseFrontmatter } from '@astrojs/markdown-remark';
import { PersistenceError, requireInput } from '../persistence/errors.ts';
import { objectFields, utcTimestamp } from '../persistence/models/fields.ts';
import type { PostMetadata } from '../persistence/models/post-metadata.ts';
import { isNonEmpty, isString } from '../utilities/string_kit.ts';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ARTIFACT_FIELDS = ['src', 'title', 'height'] as const;

export interface LegacyArtifact {
  src: string;
  title: string;
  height: number;
}

export interface LegacySource {
  metadata: Omit<PostMetadata, 'id'>;
  body: string;
  artifact: LegacyArtifact | undefined;
}

function readPublicationDate(value: unknown): string {
  let timestamp: unknown = value;
  if (value instanceof Date) {
    requireInput(Number.isFinite(value.valueOf()), 'legacy publishDate');
    timestamp = value.toISOString();
  } else if (isString(value) && DATE_ONLY_PATTERN.test(value)) {
    // Date-only legacy publication dates represent midnight UTC.
    timestamp = value + 'T00:00:00.000Z';
  }
  utcTimestamp(timestamp, 'legacy publishDate', false);
  return timestamp;
}

function readArtifact(value: unknown): LegacyArtifact | undefined {
  if (value === undefined) return undefined;
  objectFields(value, ARTIFACT_FIELDS, 'legacy artifact fields');
  requireInput(isNonEmpty(value.src), 'legacy artifact source');
  requireInput(isNonEmpty(value.title), 'legacy artifact title');
  requireInput(
    typeof value.height === 'number' &&
      Number.isSafeInteger(value.height) &&
      value.height > 0,
    'legacy artifact height',
  );
  return { src: value.src, title: value.title, height: value.height };
}

export function parseLegacySource(source: string): LegacySource | null {
  requireInput(isNonEmpty(source), 'legacy source');
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(source, { frontmatter: 'remove' });
  } catch (cause) {
    throw new PersistenceError('INVALID_INPUT', 'legacy frontmatter', {
      cause,
    });
  }

  const fields: Record<string, unknown> = parsed.frontmatter;
  requireInput(
    fields.draft === undefined || typeof fields.draft === 'boolean',
    'legacy draft flag',
  );
  if (fields.draft === true) return null;

  requireInput(isNonEmpty(fields.title), 'legacy title');
  requireInput(isNonEmpty(fields.description), 'legacy description');
  requireInput(isNonEmpty(parsed.content), 'legacy body');

  return {
    metadata: {
      title: fields.title,
      summary: fields.description,
      created_at: readPublicationDate(fields.publishDate),
    },
    body: parsed.content,
    artifact: readArtifact(fields.artifact),
  };
}
