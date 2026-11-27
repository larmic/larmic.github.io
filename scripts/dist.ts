// Prüfungen der fertigen Seite (rein, ohne Dateisystem, damit testbar; das Einlesen macht verify-dist.ts).
// 1. Keine externen Ressourcen ohne Klick (Regel aus CLAUDE.md): Was der Browser beim Laden von selbst holt –
//    Skripte, Bilder, Stylesheets, Schriften, Vorschauen, iframes, url() in CSS –, kommt von der eigenen Seite.
//    Links (<a href>) und Hinweise wie canonical sind erlaubt, sie lädt erst ein Klick bzw. niemand.
// 2. Alte Adressen leiten weiter (Astro schreibt dafür kleine Seiten mit <meta http-equiv="refresh">): auf eine
//    Seite, die es gibt, oder auf eine freigegebene fremde Domain (deren Seiten liegen nicht in dist).

const OWN_HOSTS = new Set(['larmic.de', 'www.larmic.de']);
/** Fremde Hosts, auf die alte Adressen weiterleiten dürfen: das Kinderspiel Mitwachsen mit eigener Seite */
export const REDIRECT_HOSTS = new Set(['www.mitwachsen-spiele.de', 'weltenbummler.mitwachsen-spiele.de']);
/** <link rel="…">, die nichts laden */
const NON_LOADING_REL = new Set([
  'canonical',
  'alternate',
  'me',
  'author',
  'license',
  'sitemap',
  'help',
  'next',
  'prev',
]);

const attr = (attrs: string, name: string): string | null => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};

/** Ist die Adresse fremd (http, https oder protokollrelativ auf einen anderen Host)? */
export function isForeign(url: string): boolean {
  const u = url.trim();
  if (!/^(https?:)?\/\//i.test(u)) return false;
  try {
    return !OWN_HOSTS.has(new URL(u, 'https://larmic.de').hostname);
  } catch {
    return true;
  }
}

/** Fremde Adressen in den Attributen eines Tags, das beim Laden etwas holt */
function foreignInTag(name: string, attrs: string): string[] {
  if (name === 'link') {
    const rels = (attr(attrs, 'rel') ?? '').toLowerCase().split(/\s+/);
    const href = attr(attrs, 'href');
    const loads = !rels.every((r) => NON_LOADING_REL.has(r));
    return href && loads && isForeign(href) ? [`<link rel="${rels.join(' ')}"> ${href}`] : [];
  }
  const found: string[] = [];
  for (const a of ['src', 'poster', 'data']) {
    const v = attr(attrs, a);
    if (v && isForeign(v)) found.push(`<${name} ${a}> ${v}`);
  }
  for (const a of ['srcset', 'imagesrcset'])
    for (const candidate of (attr(attrs, a) ?? '').split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url && isForeign(url)) found.push(`<${name} ${a}> ${url}`);
    }
  for (const url of cssUrls(attr(attrs, 'style') ?? '')) if (isForeign(url)) found.push(`style url() ${url}`);
  return found;
}

/** Adressen in CSS: url(…) und @import */
const cssUrls = (css: string) => [...css.matchAll(/(?:url\(\s*['"]?|@import\s+['"])([^'")]+)/gi)].map((m) => m[1]!);

/** Externe Ressourcen, die eine Seite beim Laden von selbst holen würde */
export function externalResources(html: string): string[] {
  const found: string[] = [];
  for (const [, tag = '', attrs = ''] of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi))
    if (tag.toLowerCase() !== 'a') found.push(...foreignInTag(tag.toLowerCase(), attrs));
  for (const [, css = ''] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    for (const url of cssUrls(css)) if (isForeign(url)) found.push(`<style> ${url}`);
  return found;
}

/** Ziel einer Weiterleitungsseite (<meta http-equiv="refresh" content="0;url=…">), sonst null */
export function redirectTarget(html: string): string | null {
  for (const [, attrs = ''] of html.matchAll(/<meta\b([^>]*)>/gi)) {
    if ((attr(attrs, 'http-equiv') ?? '').toLowerCase() !== 'refresh') continue;
    const m = (attr(attrs, 'content') ?? '').match(/url\s*=\s*(.+)$/i);
    return m?.[1]?.trim() ?? null;
  }
  return null;
}

/**
 * Was an der Weiterleitung einer alten Adresse nicht stimmt (null = alles gut). `actual` ist das gelesene Ziel der
 * Weiterleitungsseite, `exists` sagt, ob es eine eigene Seite unter diesem Pfad gibt.
 */
export function redirectProblem(to: string, actual: string | null, exists: (path: string) => boolean): string | null {
  if (actual !== to) return `führt zu ${actual ?? 'nichts'} statt zu ${to}`;
  if (!isForeign(to)) return exists(to) ? null : `Ziel ${to} fehlt`;
  const host = new URL(to, 'https://larmic.de').hostname;
  return REDIRECT_HOSTS.has(host) ? null : `Ziel ${to} liegt auf ${host}, das ist nicht freigegeben (REDIRECT_HOSTS)`;
}
