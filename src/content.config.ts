import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const artifactSchema = z.object({
  src: z.string().refine((src) => src.startsWith('/artifacts/'), {
    message: 'Artifact paths must be served from /artifacts/.',
  }),
  title: z.string(),
  height: z.number().int().positive().default(420),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.(md|mdx)', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
    artifact: artifactSchema.optional(),
  }),
});

export const collections = { blog };
