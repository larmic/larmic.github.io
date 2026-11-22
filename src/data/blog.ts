// Der Blog aus den Inhalten: einziger Zugang zu Posts und Serien. Seiten, Feed und Insel fragen nur hier,
// damit Entwürfe nirgends erscheinen und die Guards (Slugs, Serien, Lesezeit) bei jedem Build laufen.
import { getCollection, type CollectionEntry } from 'astro:content';
import { assertPosts, assertSlugs, byNewest, partsOf, published } from '../lib/blog/posts';
import { assertReadable, countWords, readingMinutes } from '../lib/blog/reading-time';
import { RESERVED_SLUGS } from './blog-taxonomy';
import type { RestId } from './island-layout';

export type Post = CollectionEntry<'posts'> & { words: number; minutes: number };
export type SeriesView = {
  entry: CollectionEntry<'series'>;
  posts: Post[]; // veröffentlichte Teile, aufsteigend
  status: 'läuft' | 'abgeschlossen';
};
export type Blog = {
  posts: Post[]; // veröffentlicht, neueste zuerst
  series: SeriesView[]; // nur Serien mit mindestens einem veröffentlichten Teil
};

/** Flache Sicht eines Posts für die reine Logik in lib/blog */
const meta = (post: Post) => ({
  id: post.id,
  date: post.data.date,
  draft: post.data.draft,
  series: post.data.series,
  part: post.data.part,
  counterpart: post.data.counterpart,
  hasPattern: post.data.pattern !== undefined,
  post,
});

async function load(): Promise<Blog> {
  const entries = await getCollection('posts');
  const seriesEntries = await getCollection('series');
  const all = entries.map((entry) => {
    const words = countWords(entry.body ?? '');
    return meta({ ...entry, words, minutes: readingMinutes(words) });
  });

  assertSlugs([...all.map((p) => p.id), ...seriesEntries.map((s) => s.id)], RESERVED_SLUGS);
  assertPosts(all, Object.fromEntries(seriesEntries.map((s) => [s.id, { parts: s.data.parts }])));
  for (const p of all) assertReadable(p.id, p.post.words);

  const live = published(all);
  const series = seriesEntries
    .map((entry) => {
      const posts = partsOf(live, entry.id).map((p) => p.post);
      return {
        entry,
        posts,
        status: posts.length < entry.data.parts ? ('läuft' as const) : ('abgeschlossen' as const),
      };
    })
    .filter((s) => s.posts.length > 0);
  return { posts: byNewest(live).map((p) => p.post), series };
}

let cached: Promise<Blog> | undefined;

/** Veröffentlichte Posts und Serien; die Guards prüfen dabei alle Posts, auch Entwürfe */
export function loadBlog(): Promise<Blog> {
  cached ??= load();
  return cached;
}

/** Ruheblock einer Blog-Seite: die Kiste der Serie, wenn sie eine hat (`featured`), sonst das Regal */
export const restFor = (series?: { id: string; featured: boolean }): RestId =>
  series?.featured ? `blog/${series.id}` : 'blog';
