// Reine Logik des Blogs: Entwürfe filtern, sortieren, Serienteile ordnen und die übergreifenden Guards.
// Die Guards werfen mit einer Meldung, die sagt, was zu tun ist; der Lader (src/data/blog.ts) ruft sie beim Build.

export type PostMeta = {
  id: string;
  date: Date;
  draft: boolean;
  series?: string;
  part?: number;
  counterpart?: string; // Gegenstück in der anderen Spur
  hasPattern: boolean;
};

/** Nur veröffentlichte Posts: Entwürfe erscheinen nirgends */
export function published<T extends { draft: boolean }>(posts: readonly T[]): T[] {
  return posts.filter((p) => !p.draft);
}

/** Neueste zuerst; am selben Tag der höhere Teil zuerst, dann nach Slug */
export function byNewest<T extends { id: string; date: Date; part?: number }>(posts: readonly T[]): T[] {
  return [...posts].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || (b.part ?? 0) - (a.part ?? 0) || a.id.localeCompare(b.id),
  );
}

/** Teile einer Serie, aufsteigend */
export function partsOf<T extends { series?: string; part?: number }>(posts: readonly T[], series: string): T[] {
  return posts.filter((p) => p.series === series).sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
}

/** Vorgänger und Nachfolger in einer geordneten Liste */
export function neighbours<T>(parts: readonly T[], index: number): { prev?: T; next?: T } {
  return { prev: index > 0 ? parts[index - 1] : undefined, next: parts[index + 1] };
}

/** „Teil 2 bis 8 erscheinen noch.“ – ohne Titel, damit die änderbar bleiben; nichts, wenn die Serie vollständig ist */
export function upcoming(publishedParts: number, parts: number): string | undefined {
  if (publishedParts >= parts) return undefined;
  const next = publishedParts + 1;
  return next === parts ? `Teil ${parts} erscheint noch.` : `Teil ${next} bis ${parts} erscheinen noch.`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** „22.11.2026“, in UTC, damit der Build überall dasselbe Datum zeigt */
export function formatDate(d: Date): string {
  return `${two(d.getUTCDate())}.${two(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** „2026-11-22“ für `<time datetime>`, in UTC */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Slugs gelten für immer: nur Kleinbuchstaben, Ziffern und Bindestriche, keine Namen, die Adressen unter /blog/ belegen */
export function assertSlugs(ids: readonly string[], reserved: readonly string[]): void {
  for (const id of ids) {
    if (!SLUG.test(id))
      throw new Error(
        `Blog: Der Dateiname „${id}“ taugt nicht als Adresse. Nur Kleinbuchstaben, Ziffern und Bindestriche verwenden.`,
      );
    if (reserved.includes(id))
      throw new Error(`Blog: Der Dateiname „${id}“ ist für eine Adresse unter /blog/ reserviert. Anders benennen.`);
  }
}

type SeriesIndex = Readonly<Record<string, { parts: number }>>;

function assertPart(p: PostMeta, series: SeriesIndex): void {
  if (p.series === undefined && p.part === undefined) return;
  if (p.series === undefined || p.part === undefined)
    throw new Error(
      `Blog: ${p.id} braucht „series“ und „part“ zusammen. Das fehlende Feld ergänzen oder beide streichen.`,
    );
  const s = series[p.series];
  if (!s)
    throw new Error(`Blog: ${p.id} nennt die Serie „${p.series}“, die es nicht gibt. In src/content/series/ anlegen.`);
  if (p.part > s.parts)
    throw new Error(`Blog: ${p.id} ist Teil ${p.part}, die Serie „${p.series}“ hat aber nur ${s.parts} Teile.`);
  if (!p.hasPattern)
    throw new Error(`Blog: ${p.id} gehört zu einer Serie und braucht „pattern“ (das Muster in einem Satz).`);
}

/** Jeder Teil einmal (Entwürfe eingeschlossen), die veröffentlichten lückenlos ab 1 */
function assertSequence(name: string, parts: readonly PostMeta[]): void {
  const seen = new Map<number, string>();
  for (const p of parts) {
    const other = seen.get(p.part!);
    if (other)
      throw new Error(
        `Blog: Teil ${p.part} der Serie „${name}“ gibt es doppelt (${other} und ${p.id}). Einen umnummerieren.`,
      );
    seen.set(p.part!, p.id);
  }
  published(parts).forEach((p, i) => {
    if (p.part !== i + 1)
      throw new Error(
        `Blog: In der Serie „${name}“ fehlt Teil ${i + 1} (veröffentlicht ist ${p.id} als Teil ${p.part}). ` +
          'Teile erscheinen lückenlos der Reihe nach.',
      );
  });
}

function assertCounterpart(p: PostMeta, byId: ReadonlyMap<string, PostMeta>): void {
  if (p.counterpart === undefined) return;
  const other = byId.get(p.counterpart);
  if (p.counterpart === p.id || !other || other.draft)
    throw new Error(
      `Blog: ${p.id} nennt als Gegenstück „${p.counterpart}“. Das muss ein anderer, veröffentlichter Post sein.`,
    );
}

/** Übergreifende Guards über alle Posts (auch Entwürfe) und die bekannten Serien */
export function assertPosts(posts: readonly PostMeta[], series: SeriesIndex): void {
  const byId = new Map(posts.map((p) => [p.id, p]));
  for (const p of posts) {
    assertPart(p, series);
    if (!p.draft) assertCounterpart(p, byId);
  }
  for (const name of Object.keys(series)) assertSequence(name, partsOf(posts, name));
}
