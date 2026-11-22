// Smoke-Test der fertigen Seite: Startseite, Insel, Detailseiten und die alten Adressen.
// Die fremde Domain www.mitwachsen-spiele.de wird nie geladen: Die Tests prüfen nur Links und Weiterleitungsseiten.
// Jede Seite muss ohne Fehler in der Konsole laden (pageerror und console.error).
import { expect, test, type Page } from '@playwright/test';

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test('Startseite: Insel ist da und navigiert zu allen Bereichen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('h1, .name-tiles').first()).toBeVisible();
  expect(await page.evaluate(() => !!customElements.get('larmic-island'))).toBe(true);
  for (const href of ['/workshops/', '/videos/'])
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  // Seitenwechsel über die Insel (View Transition): Inhalt wechselt, die Insel bleibt
  await page.locator('.blk[data-id="videos"]').click();
  await expect(page).toHaveURL(/\/videos\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Videos' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const path of [
  '/workshops/',
  '/workshops/event_storming/',
  '/videos/',
  '/videos/testcontainers/',
  '/blog/',
  '/blog/erst-die-zaeune/',
  '/blog/serie/mitwachsen/',
  '/impressum/',
  '/datenschutz/',
])
  test(`Seite ${path} lädt ohne Fehler`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

// Der Pilz-Ausgang ist ein normaler Link im selben Tab (kein target, kein rel); geklickt wird er nicht
for (const path of ['/', '/workshops/event_storming/', '/videos/'])
  test(`Insel auf ${path}: der Pilz führt im selben Tab auf www.mitwachsen-spiele.de`, async ({ page }) => {
    await page.goto(path);
    const link = page.getByRole('link', { name: 'Mitwachsen – eigene Seite: mitwachsen-spiele.de', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://www.mitwachsen-spiele.de/');
    await expect(link).toHaveAttribute('data-external');
    await expect(link).not.toHaveAttribute('target');
    await expect(link).not.toHaveAttribute('rel');
    await expect(link).toContainText('Mitwachsen ↗');
    await expect(link).not.toHaveAttribute('aria-current');
  });

test('Insel: Zurück aus dem Cache schickt die Figur vom gezeigten Block zum Ruheblock', async ({ page }) => {
  await page.goto('/');
  const island = page.locator('larmic-island');
  const state = () =>
    island.evaluate((el) => {
      const s = (el as unknown as { state: { hover: string | null; route: string; pos: number } }).state;
      return `${s.hover ?? '-'} ${s.route} ${s.pos}`;
    });
  const about = await state();
  await page.locator('.blk[data-id="videos"]').hover();
  await expect.poll(state).toMatch(/^videos videos [1-9]/);
  // So kommt die Seite nach einem Link nach außen und Zurück aus dem Cache wieder (die Maus bleibt, wo sie war)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect.poll(state).toBe(about);
});

test('Blog: Der Feed listet den Post und ist im Kopf der Seite verlinkt', async ({ page, request }) => {
  const res = await request.get('/blog/rss.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain('<item>');
  expect(xml).toContain('<link>https://larmic.de/blog/erst-die-zaeune/</link>');
  await page.goto('/blog/');
  await expect(page.locator('head link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    '/blog/rss.xml',
  );
});

const OLD: [string, RegExp][] = [
  ['/about/', /\/$/],
  ['/#workshops', /\/workshops\/$/],
  ['/#videos', /\/videos\/$/],
  ['/workshops/#workshop-event_storming', /\/workshops\/event_storming\/$/],
  ['/videos/#video-testcontainers', /\/videos\/testcontainers\/$/],
];
for (const [from, to] of OLD)
  test(`alte Adresse ${from} führt weiter`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  });

// Alte Adressen des Kinderspiels zeigen auf die eigene Seite des Spiels: Geprüft wird die Weiterleitungsseite
// (Meta-Refresh und canonical), ohne ihr auf die fremde Domain zu folgen
const GAME: [string, string][] = [
  ['/spiele/', 'https://www.mitwachsen-spiele.de/'],
  ['/spiele/mitwachsen/', 'https://www.mitwachsen-spiele.de/'],
  ['/spiele/mitwachsen/spielen/', 'https://www.mitwachsen-spiele.de/spielen/'],
  ['/spiele/threeyear/', 'https://www.mitwachsen-spiele.de/spielen/'],
];
for (const [from, to] of GAME)
  test(`alte Adresse ${from} leitet direkt auf ${to} weiter`, async ({ request }) => {
    const res = await request.get(from);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<meta http-equiv="refresh" content="0;url=${to}">`);
    expect(html).toContain(`<link rel="canonical" href="${to}">`);
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Inhalte bleiben lesbar, die Insel besteht aus normalen Links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Über mich' })).toBeVisible();
    await expect(page.locator('.blk[data-id="mitwachsen"]')).toHaveAttribute(
      'href',
      'https://www.mitwachsen-spiele.de/',
    );
  });

  test('Blogpost: Text, Dateileiste, Zettel und Inhaltsverzeichnis stehen im HTML', async ({ page }) => {
    await page.goto('/blog/erst-die-zaeune/');
    await expect(page.getByRole('heading', { level: 1, name: 'Erst die Zäune, dann der Spielplatz' })).toBeVisible();
    await expect(page.locator('figure.code figcaption')).toHaveText('.dependency-cruiser.cjs');
    await expect(page.getByRole('note')).toContainText('Das Muster in einem Satz');
    const toc = page.getByRole('navigation', { name: 'Inhalt' }).getByRole('link');
    await expect(toc).toHaveCount(7);
    for (const link of await toc.all()) {
      await expect(link).toBeVisible();
      await expect(page.locator(`[id="${(await link.getAttribute('href'))!.slice(1)}"]`)).toBeVisible();
    }
  });
});
