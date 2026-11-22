// Die Insel mit allen Kisten: Workshops, Videos und Blog-Serien aus den Inhalten, jede Kiste in ihrer Themenfarbe.
import { getCollection } from 'astro:content';
import type { Scene } from '../lib/voxel/world';
import { AVATAR } from './avatar';
import { loadBlog } from './blog';
import { buildWorld, type ChildItem } from './island-layout';
import { MATERIALS, type Material } from './materials';

type Entry = { id: string; data: { short: string; material: Material; order: number } };

const crate = (e: { id: string; data: { short: string; material: Material } }, href: string): ChildItem => ({
  id: e.id,
  label: e.data.short,
  block: MATERIALS[e.data.material].block,
  color: MATERIALS[e.data.material].icon,
  href,
});

const items = (section: 'workshops' | 'videos', entries: Entry[]) =>
  entries.sort((a, b) => a.data.order - b.data.order).map((e) => crate(e, `/${section}/${e.id}/`));

/** Eine Kiste pro Serie mit eigener Kiste (`featured`) und mindestens einem veröffentlichten Teil */
const seriesCrates = async () =>
  (await loadBlog()).series
    .filter((s) => s.entry.data.featured)
    .map((s) => crate(s.entry, `/blog/serie/${s.entry.id}/`));

let cached: Scene | undefined;

export async function islandScene(): Promise<Scene> {
  cached ??= buildWorld(
    {
      workshops: items('workshops', await getCollection('workshops', ({ data }) => !data.draft)),
      videos: items('videos', await getCollection('videos')),
      blog: await seriesCrates(),
    },
    AVATAR,
  );
  return cached;
}
