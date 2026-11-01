// Inhalts-Sammlungen mit Schema: Fehlt ein Pflichtfeld, bricht der Build ab (Guard-Gate für Inhalte).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const material = z.enum(['hw', 'ops', 'ki', 'gr']);

const workshops = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/workshops' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    teaser: z.string(),
    material,
    order: z.number().int(),
    link: z.url().optional(),
    linkLabel: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const videos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/videos' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    teaser: z.string(),
    material,
    order: z.number().int(),
    youtube: z.string().min(5),
    date: z.coerce.date(),
  }),
});

export const collections = { workshops, videos };
