// Inhalts-Sammlungen mit Schema: Fehlt ein Pflichtfeld, bricht der Build ab (Guard-Gate für Inhalte).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MATERIAL_IDS } from './data/materials';
import { TAG_IDS, TRACK_IDS } from './data/blog-taxonomy';

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

// Blog: Was ein einzelner Post erfüllen muss, steht hier. Was mehrere Posts betrifft (Teile lückenlos, Lesezeit,
// Slugs), prüft der Lader src/data/blog.ts beim Build.
const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().max(51), // „<Titel> – Blog – larmic.de“ bleibt unter 70 Zeichen (html-validate)
    teaser: z.string().max(160),
    date: z.coerce.date(),
    series: z.string().optional(), // Dateiname der Serie; nur zusammen mit part
    part: z.number().int().positive().optional(),
    track: z.enum(TRACK_IDS),
    tags: z.array(z.enum(TAG_IDS)).min(1).max(4), // der erste ist der Aspekt
    pattern: z.object({ title: z.string(), sentence: z.string() }).optional(), // Pflicht bei Serienteilen
    confession: z.string().optional(), // „Kleines Geständnis“: was an der Erzählung verdichtet ist
    evidence: z
      .object({
        asOf: z.coerce.date(),
        items: z.array(z.object({ hash: z.string().regex(/^[0-9a-f]{7,40}$/), text: z.string() })).min(1),
      })
      .optional(),
    counterpart: z.string().optional(), // Gegenstück in der anderen Spur
    draft: z.boolean().default(false),
  }),
});

const series = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/series' }),
  schema: z.object({
    title: z.string(),
    short: z.string().max(40),
    teaser: z.string().max(160),
    material,
    parts: z.number().int().positive(), // geplante Länge; der Status „läuft“ oder „abgeschlossen“ ergibt sich daraus
    featured: z.boolean().default(true), // eigene Kiste auf der Insel
  }),
});

export const collections = { workshops, videos, posts, series };
