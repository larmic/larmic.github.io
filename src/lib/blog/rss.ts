// RSS 2.0 als Zeichenkette: rein und ohne Abhängigkeit, damit der Feed getestet werden kann.

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  date: Date;
  categories?: readonly string[];
};
export type Feed = {
  title: string;
  description: string;
  link: string;
  self: string; // Adresse des Feeds selbst
  items: readonly FeedItem[];
};

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as const;

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c as keyof typeof ENTITIES]);
}

const tag = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;

function item(i: FeedItem): string {
  return [
    '    <item>',
    `      ${tag('title', i.title)}`,
    `      ${tag('link', i.link)}`,
    `      <guid isPermaLink="true">${escapeXml(i.link)}</guid>`,
    `      ${tag('pubDate', i.date.toUTCString())}`,
    `      ${tag('description', i.description)}`,
    ...(i.categories ?? []).map((c) => `      ${tag('category', c)}`),
    '    </item>',
  ].join('\n');
}

/** Der ganze Feed; die Einträge in der übergebenen Reihenfolge */
export function rss(feed: Feed): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    ${tag('title', feed.title)}`,
    `    ${tag('link', feed.link)}`,
    `    ${tag('description', feed.description)}`,
    '    <language>de</language>',
    `    <atom:link href="${escapeXml(feed.self)}" rel="self" type="application/rss+xml"/>`,
    ...feed.items.map(item),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
