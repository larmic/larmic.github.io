// Barrierefreiheit der fertigen Seite: axe-core prüft jede Seite nach WCAG 2.2 A/AA.
// Das Gate fällt bei jedem Verstoß; die Liste nennt Regel, Wirkung und betroffene Elemente.
// Geprüft wird die ruhende Seite (reduzierte Bewegung): Mitten im Einblenden misst axe Mischfarben als Kontrast.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.map(
    (v) => `${v.impact}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

for (const path of [
  '/',
  '/workshops/',
  '/workshops/event_storming/',
  '/videos/',
  '/videos/testcontainers/',
  '/impressum/',
  '/datenschutz/',
  '/gibt-es-nicht/',
])
  test(`Barrierefrei: ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await violations(page)).toEqual([]);
  });
