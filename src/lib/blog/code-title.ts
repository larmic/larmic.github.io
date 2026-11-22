// Dateileiste über Code-Blöcken: Aus ```js title="scripts/bundles.ts" macht dieser Shiki-Transformer
// <figure class="code"><figcaption class="code-file">…</figcaption><pre>…</pre></figure>. Ohne title bleibt alles, wie es ist.
// Ohne Import aus shiki (keine eigene Abhängigkeit des Projekts), darum die kleinen hast-Typen.

type HastText = { type: 'text'; value: string };
type HastElement = {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: HastNode[];
};
type HastNode = HastElement | HastText | { type: string };
export type HastRoot = { type: 'root'; children: HastNode[] };

type Context = { options: { meta?: { __raw?: string } } };

/** Der Wert von title="…" in der Meta-Angabe eines Code-Zauns */
export function parseTitle(meta: string | undefined): string | undefined {
  return meta?.match(/(?:^|\s)title="([^"]+)"/)?.[1];
}

const element = (tagName: string, className: string, children: HastNode[]): HastElement => ({
  type: 'element',
  tagName,
  properties: { class: className },
  children,
});

export function codeTitle() {
  return {
    name: 'code-title',
    root(this: Context, root: HastRoot): void {
      const title = parseTitle(this.options.meta?.__raw);
      if (!title) return;
      const caption = element('figcaption', 'code-file', [{ type: 'text', value: title }]);
      root.children = [element('figure', 'code', [caption, ...root.children])];
    },
  };
}
