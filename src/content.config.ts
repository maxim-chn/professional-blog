import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const ARTIFACT_PATH_PREFIX = '/artifacts/';

const artifactSchema = z.object({
  src: z.string().refine((src) => src.startsWith(ARTIFACT_PATH_PREFIX), {
    message: 'Artifact paths must be served from /artifacts/.',
  }),
  title: z.string(),
  height: z.number().int().positive(),
});

const playground = defineCollection({
  loader: glob({ pattern: '**/*.(md|mdx)', base: './src/content/playground' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean(),
    artifact: artifactSchema,
  }),
});

export const collections = { playground };
