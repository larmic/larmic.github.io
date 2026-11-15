// Prüfungen der fertigen Seite (rein, ohne Dateisystem, damit testbar; das Einlesen macht verify-dist.ts).
// 1. Keine externen Ressourcen ohne Klick (Regel aus CLAUDE.md): Was der Browser beim Laden von selbst holt –
//    Skripte, Bilder, Stylesheets, Schriften, Vorschauen, iframes, url() in CSS –, kommt von der eigenen Seite.
//    Links (<a href>) und Hinweise wie canonical sind erlaubt, sie lädt erst ein Klick bzw. niemand.
// 2. Alte Adressen leiten weiter (Astro schreibt dafür kleine Seiten mit <meta http-equiv="refresh">).

const OWN_HOSTS = new Set(['larmic.de', 'www.larmic.de']);
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

/** Externe Ressourcen, die eine Seite beim Laden von selbst holen würde */
export function externalResources(html: string): string[] {
  const found: string[] = [];
  for (const [, tag, attrs] of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const name = tag.toLowerCase();
    if (name === 'a') continue;
    if (name === 'link') {
      const rels = (attr(attrs, 'rel') ?? '').toLowerCase().split(/\s+/);
      const href = attr(attrs, 'href');
      if (href && !rels.every((r) => NON_LOADING_REL.has(r)) && isForeign(href))
        found.push(`<link rel="${rels.join(' ')}"> ${href}`);
      continue;
    }
    for (const a of ['src', 'poster', 'data']) {
      const v = attr(attrs, a);
      if (v && isForeign(v)) found.push(`<${name} ${a}> ${v}`);
    }
    for (const a of ['srcset', 'imagesrcset']) {
      const v = attr(attrs, a);
      for (const candidate of v ? v.split(',') : []) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url && isForeign(url)) found.push(`<${name} ${a}> ${url}`);
      }
    }
    const style = attr(attrs, 'style');
    for (const [, url] of (style ?? '').matchAll(/url\(\s*['"]?([^'")]+)/gi))
      if (isForeign(url)) found.push(`style url() ${url}`);
  }
  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    for (const [, url] of css.matchAll(/(?:url\(\s*['"]?|@import\s+['"])([^'")]+)/gi))
      if (isForeign(url)) found.push(`<style> ${url}`);
  return found;
}

/** Ziel einer Weiterleitungsseite (<meta http-equiv="refresh" content="0;url=…">), sonst null */
export function redirectTarget(html: string): string | null {
  for (const [, attrs] of html.matchAll(/<meta\b([^>]*)>/gi)) {
    if ((attr(attrs, 'http-equiv') ?? '').toLowerCase() !== 'refresh') continue;
    const m = (attr(attrs, 'content') ?? '').match(/url\s*=\s*(.+)$/i);
    return m ? m[1].trim() : null;
  }
  return null;
}
