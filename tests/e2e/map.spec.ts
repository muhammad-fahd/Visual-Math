import { test, expect } from '@playwright/test';

// The learning map in a real browser (Story 5.5). The built `/en/map` is prerendered without a database, so the checks
// run on the harness page `/{locale}/dev/map` (VM_HARNESS=1): the same `MapScreen` with the fixture catalog. In it
// algebra is a chain (balance scale, solving, graphs of quadratics) and the graphs topic also needs a topic of
// Arithmetic and Numbers; `geo-cone-section` needs `geo-cone-volume` and two prerequisites that are not published.

test('the real map page is static HTML with its heading', async ({ page }) => {
  await page.goto('/en/map');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learning map');
});

test('the first category with topics is shown by default, with chips for the categories that have topics', async ({ page }) => {
  await page.goto('/en/dev/map');
  await expect(page.locator('[data-chip]')).toHaveCount(5);
  await expect(page.locator('[data-chip="calculus"]')).toHaveCount(0);
  await expect(page.locator('[data-chip="arithmetic-and-numbers"]')).toHaveAttribute('aria-pressed', 'true');
  // its one topic, and the algebra topic that needs it as an outside node
  await expect(page.locator('[data-map-node]')).toHaveCount(2);
  await expect(page.locator('[data-map-node="alg-quadratic-graph"]')).toContainText('Algebra');
});

test('Algebra: chapters are rows, topics are nodes left to right by what they need, with arrows and an outside node', async ({ page }) => {
  await page.goto('/en/dev/map');
  await page.locator('[data-chip="algebra"]').click();
  await expect(page).toHaveURL(/\/en\/map\?cat=algebra$|\/en\/dev\/map\?cat=algebra$/);
  const x = async (id: string) => (await page.locator(`[data-map-node="${id}"] rect`).boundingBox())!.x;
  const balance = await x('alg-balance-scale');
  const solving = await x('alg-solve-steps');
  const graphs = await x('alg-quadratic-graph');
  expect(balance).toBeLessThan(solving);
  expect(solving).toBeLessThan(graphs);
  await expect(page.locator('[data-map-edge="alg-balance-scale>alg-solve-steps"]')).toHaveCount(1);
  await expect(page.locator('[data-map-edge="alg-solve-steps>alg-quadratic-graph"]')).toHaveCount(1);
  await expect(page.locator('[data-map-edge="num-equivalent-fractions>alg-quadratic-graph"]')).toHaveCount(1);
  await expect(page.locator('[data-map-node="num-equivalent-fractions"]')).toContainText('Arithmetic and Numbers');
  await expect(page.locator('[data-map-lane]')).toHaveCount(4); // three chapters and the other-categories row
});

test('an unpublished or unknown prerequisite is nowhere on the geometry map', async ({ page }) => {
  await page.goto('/en/dev/map?cat=geometry');
  await expect(page.locator('[data-chip="geometry"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-map-edge="geo-cone-volume>geo-cone-section"]')).toHaveCount(1);
  await expect(page.locator('[data-map-node="stats-dice"], [data-map-item="stats-dice"]')).toHaveCount(0);
  await expect(page.locator('[data-map-edge]')).toHaveCount(2); // cone volume to section, cylinder net to fill
});

test('an unknown category in the address is ignored', async ({ page }) => {
  await page.goto('/en/dev/map?cat=no-such-category');
  await expect(page.locator('[data-chip="arithmetic-and-numbers"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the list is complete and has Needs and Leads to, with the outside topic named with its category', async ({ page }) => {
  await page.goto('/en/dev/map?cat=algebra');
  const list = page.locator('[data-map-list]');
  await expect(list.locator('[data-map-item]')).toHaveCount(3);
  const graphs = list.locator('[data-map-item="alg-quadratic-graph"]');
  await expect(graphs).toContainText('Needs');
  await expect(graphs.locator('[data-refs="Needs"] a')).toHaveCount(2);
  await expect(graphs).toContainText('(Arithmetic and Numbers)');
  await expect(list.locator('[data-map-item="alg-balance-scale"] [data-refs="Leads to"] a')).toHaveCount(1);
  await expect(list.locator('[data-map-item="alg-balance-scale"] [data-refs="Needs"]')).toHaveCount(0);
});

test('the picture does not trap the keyboard: Tab goes through the chips and the list, never the picture', async ({ page }) => {
  await page.goto('/en/dev/map?cat=algebra');
  const inGraph: boolean[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    inGraph.push(await page.evaluate(() => !!document.activeElement?.closest('[data-map-graph]')));
  }
  expect(inGraph.some(Boolean)).toBe(false);
  expect(await page.locator('[data-map-graph]').getAttribute('aria-hidden')).toBe('true');
});

test('a viewed topic is marked on the picture and in the list; others are not', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('vm.progress.v1', JSON.stringify({ v: 1, topics: { 'alg-solve-steps': { viewedAt: '2026-11-28T00:00:00Z' } }, last: 'alg-solve-steps' })));
  await page.goto('/en/dev/map?cat=algebra');
  await expect(page.locator('[data-map-node="alg-solve-steps"][data-viewed]')).toHaveCount(1);
  await expect(page.locator('[data-map-node="alg-balance-scale"][data-viewed]')).toHaveCount(0);
  await expect(page.locator('[data-map-item="alg-solve-steps"] [data-viewed]')).toHaveText(/Viewed/);
  await expect(page.locator('[data-map-item="alg-balance-scale"] [data-viewed]')).toHaveCount(0);
});

test('a damaged progress value shows no marks and no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem('vm.progress.v1', '{"v":1,"topics":'));
  await page.goto('/en/dev/map?cat=algebra');
  await expect(page.locator('[data-map-item]')).toHaveCount(3);
  await expect(page.locator('[data-viewed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a list link opens the topic', async ({ page }) => {
  await page.goto('/en/dev/map?cat=geometry');
  await page.locator('[data-map-item="geo-cone-section"] [data-refs="Needs"] a').first().click();
  await expect(page).toHaveURL(/\/en\/topic\/geo-cone-volume$/);
});

test('Urdu: Urdu words and names, the page mirrors, the picture box stays left to right', async ({ page }) => {
  await page.goto('/ur/dev/map?cat=algebra');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('سیکھنے کا نقشہ');
  await expect(page.locator('[data-map-scroll]')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('[data-chip="algebra"]')).toContainText('الجبرا');
  await expect(page.locator('[data-map-node="alg-solve-steps"]')).toBeVisible();
});

test('on a phone the page does not scroll sideways, the picture box does, and list targets are 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/en/dev/map?cat=algebra');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  expect(await page.locator('[data-map-scroll]').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  for (const sel of ['[data-chip="algebra"]', '[data-map-item="alg-solve-steps"] a']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }
});

test('Home links to the map', async ({ page }) => {
  await page.goto('/en/dev/home');
  await page.locator('[data-map-link]').click();
  await expect(page).toHaveURL(/\/en\/map$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learning map');
});
