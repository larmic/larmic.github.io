// Prüflogik für das Bundle-Gate (npm run verify:bundles) – rein, ohne Dateisystem, damit testbar.
// Ermittelt, welches JavaScript eine fertige Seite beim Laden holt: die Skripte im HTML und alles, was diese
// statisch importieren. Dynamische Importe (`import("…")`) zählen nicht, sie laden erst später und nur bei Bedarf.

export type Rule = {
  name: string;
  pages: RegExp; // für welche Seiten (Pfad relativ zu dist, z. B. "spiele/mitwachsen/index.html")
  budget: number; // höchstens so viele Bytes JavaScript beim Laden
  forbidden: RegExp; // darf im geladenen Code nicht vorkommen
};

/** Skripte, die eine Seite lädt: <script src> und <link rel="modulepreload"> */
export function scriptsOf(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) out.add(m[1]!);
  for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"/g)) out.add(m[1]!);
  return [...out];
}

/** Statische, relative Importe eines (auch minifizierten) Moduls; `import("…")` wird ausgelassen */
export function staticImports(code: string): string[] {
  const out = new Set<string>();
  for (const m of code.matchAll(/\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g))
    out.add(m[1]!);
  for (const m of code.matchAll(/\bexport\s*(?:\*|\{[^}]*\})\s*from\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) out.add(m[1]!);
  return [...out];
}

const resolve = (from: string, spec: string) => {
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
};

/** Alle Module, die beim Laden einer Seite geholt werden (Pfade wie "/_astro/x.js") */
export function loaded(html: string, read: (path: string) => string | null): string[] {
  const seen = new Set<string>();
  const queue = scriptsOf(html).filter((s) => s.startsWith('/'));
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = read(file);
    if (code !== null) for (const spec of staticImports(code)) queue.push(resolve(file, spec));
  }
  return [...seen];
}

/** Verstöße einer Seite gegen die Regeln (leer = alles gut) */
export function check(page: string, html: string, read: (path: string) => string | null, rules: Rule[]): string[] {
  const files = loaded(html, read);
  const problems: string[] = [];
  for (const rule of rules) {
    if (!rule.pages.test(page)) continue;
    let bytes = 0;
    for (const f of files) {
      const code = read(f);
      if (code === null) {
        problems.push(`${page}: ${f} fehlt in dist`);
        continue;
      }
      bytes += new TextEncoder().encode(code).length;
      if (rule.forbidden.test(code) || rule.forbidden.test(f))
        problems.push(`${page}: ${f} enthält Verbotenes für „${rule.name}“ (${rule.forbidden})`);
    }
    if (bytes > rule.budget)
      problems.push(`${page}: ${bytes} Bytes JavaScript beim Laden, erlaubt sind ${rule.budget} („${rule.name}“)`);
  }
  return problems;
}
