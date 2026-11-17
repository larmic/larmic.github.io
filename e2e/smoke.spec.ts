// Smoke-Test der fertigen Seite: Startseite, Insel, Detailseiten, das Kinderspiel und die alten Adressen.
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
  for (const href of ['/workshops/', '/videos/', '/spiele/'])
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  // Seitenwechsel über die Insel (View Transition): Inhalt wechselt, die Insel bleibt
  await page.locator('a[href="/spiele/"]').first().click();
  await expect(page).toHaveURL(/\/spiele\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Spiele' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const path of [
  '/workshops/',
  '/workshops/event_storming/',
  '/videos/',
  '/videos/testcontainers/',
  '/spiele/mitwachsen/',
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

test('Kinderspiel: Hinweis für Eltern beim ersten Mal, eine Pfeiltaste weckt die Figur', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/spiele/mitwachsen/spielen/');
  const info = page.locator('dialog.mw-info');
  await expect(info).toHaveJSProperty('open', true);
  await page.getByRole('button', { name: /Verstanden/ }).click();
  await expect(info).toHaveJSProperty('open', false);
  const game = page.locator('larmic-mitwachsen');
  await expect(game).toHaveClass(/ready/);
  const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
  expect(await sleeping()).toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  expect(errors).toEqual([]);
});

test('Spielseite für Eltern: „Spiel starten“ führt im selben Tab auf die eigene Seite des Spiels', async ({ page }) => {
  await page.goto('/spiele/mitwachsen/');
  const links = page.locator('a', { hasText: 'Spiel starten' });
  await expect(links).toHaveCount(2); // im Kopf und im Text
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('href', 'https://www.mitwachsen-spiele.de/spielen/');
    await expect(link).not.toHaveAttribute('target');
  }
});

// Die fremde Domain wird nie geladen: Der Test bleibt offline und prüft nur den Link
test('Insel: die Pilz-Kiste führt im selben Tab auf www.mitwachsen-spiele.de', async ({ page }) => {
  await page.goto('/spiele/');
  const link = page.getByRole('link', { name: 'Mitwachsen – eigene Seite: mitwachsen-spiele.de', exact: true });
  await expect(link).toHaveAttribute('href', 'https://www.mitwachsen-spiele.de/');
  await expect(link).toHaveAttribute('data-external');
  await expect(link).not.toHaveAttribute('target');
  await expect(link).not.toHaveAttribute('rel');
  await expect(link).toContainText('Mitwachsen ↗');
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

const OLD: [string, RegExp][] = [
  ['/about/', /\/$/],
  ['/#workshops', /\/workshops\/$/],
  ['/#videos', /\/videos\/$/],
  ['/workshops/#workshop-event_storming', /\/workshops\/event_storming\/$/],
  ['/videos/#video-testcontainers', /\/videos\/testcontainers\/$/],
  ['/spiele/threeyear/', /\/spiele\/mitwachsen\/spielen\/$/],
];
for (const [from, to] of OLD)
  test(`alte Adresse ${from} führt weiter`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  });

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Inhalte bleiben lesbar, das Spiel erklärt sich Eltern', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Über mich' })).toBeVisible();
    // Der Text für Eltern steht im <noscript>-Block des Spiels (die Prüfung über textContent, weil Playwright
    // <noscript> nicht wie ein Browser ohne JavaScript als sichtbaren Text behandelt)
    await page.goto('/spiele/mitwachsen/spielen/');
    const text = await page.locator('larmic-mitwachsen noscript').textContent();
    expect(text).toContain('Dieses Spiel für Dreijährige braucht JavaScript');
    expect(text).toContain('Wie viel Bildschirm?');
  });
});
