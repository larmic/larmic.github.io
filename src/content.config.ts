// Inhalts-Sammlungen mit Schema: Fehlt ein Pflichtfeld, bricht der Build ab (Guard-Gate für Inhalte).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MATERIAL_IDS } from './data/materials';

const material = z.enum(MATERIAL_IDS);

const workshops = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/workshops' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    teaser: z.string(),
    claim: z.string().optional(), // Leitsatz: hervorgehoben unter den Eckdaten der Workshop-Seite
    material,
    order: z.number().int(),
    link: z.url().optional(),
    linkLabel: z.string().optional(),
    // Eckdaten: stehen auf jeder Workshop-Seite gleich aufgebaut, Dauer und Schwierigkeitsgrad auch auf der Karte
    audience: z.string(),
    duration: z.string(),
    level: z.enum(['Einfach', 'Mittel', 'Anspruchsvoll']),
    format: z.enum(['Präsenz', 'Präsenz oder remote', 'Remote']).default('Präsenz'),
    groupSize: z.number().int().positive().default(12),
    location: z.string().default('Bei uns oder bei euch vor Ort'),
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
    recording: z.enum(['freitagsfruehstueck']).optional(), // Wo das Video aufgenommen wurde: Hinweis unter dem Video
  }),
});

export const collections = { workshops, videos };
