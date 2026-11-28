import { test, expect } from '@playwright/test';

// Search and filters in a real browser (Story 5.3). The built `/en/search` is prerendered without a database, so the
// checks run on the harness page `/{locale}/dev/search` (VM_HARNESS=1): the same `SearchScreen` with the fixture
// catalog, where 11 topics are published (`stats-dice` is unpublished, `trig-right-triangle` deleted).

const count = (page: import('@playwright/test').Page) => page.locator('[role="status"][data-count]');

test('the real search page is static HTML with a heading and the search field after load', async ({ page }) => {
  await page.goto('/en/search');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search');
  await expect(page.getByRole('searchbox', { name: 'Search' })).toBeVisible();
});

test('a query from the address is restored: field, results with category path, and a live count', async ({ page }) => {
  await page.goto('/en/dev/search?q=cone');
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('cone');
  await expect(count(page)).toHaveText('2 topics found');
  const card = page.locator('[data-result="geo-cone-volume"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-path]')).toContainText('Geometry');
  await expect(card.locator('[data-path]')).toContainText('Solids and volume');
  await expect(card.locator('[data-path]')).toContainText('Cones');
  await expect(card).toHaveAttribute('href', '/en/topic/geo-cone-volume');
  await expect(card.locator('[data-level]')).toHaveText(/Foundation|Intermediate|Advanced/);
});

test('typing searches after a pause, writes the address, and makes no request', async ({ page }) => {
  await page.goto('/en/dev/search');
  await expect(count(page)).toHaveText('11 topics found');
  const requests: string[] = [];
  page.on('request', (r) => {
    if (['fetch', 'xhr'].includes(r.resourceType())) requests.push(r.url());
  });
  const field = page.getByRole('searchbox', { name: 'Search' });
  await field.pressSequentially('cone volume', { delay: 40 });
  await expect(count(page)).toHaveText('1 topic found', { timeout: 3000 });
  await expect(page).toHaveURL(/q=cone%20volume$/);
  expect(requests).toEqual([]);
  // it did not search on every key: the answer arrived only after the typing stopped
  await expect(page.locator('[data-result]')).toHaveCount(1);
});

test('Enter searches at once', async ({ page }) => {
  await page.goto('/en/dev/search');
  const field = page.getByRole('searchbox', { name: 'Search' });
  await field.fill('graph');
  await field.press('Enter');
  await expect(page).toHaveURL(/q=graph$/);
  await expect(count(page)).not.toHaveText('11 topics found');
});

test('Clear empties the text and shows every topic again', async ({ page }) => {
  await page.goto('/en/dev/search?q=cone');
  await page.locator('[data-clear-text]').click();
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  await expect(count(page)).toHaveText('11 topics found');
  await expect(page.locator('[data-clear-text]')).toHaveCount(0);
});

test('a blank query shows every published topic; the unpublished and the deleted are in no result', async ({ page }) => {
  await page.goto('/en/dev/search?q=%20%20');
  await expect(count(page)).toHaveText('11 topics found');
  await expect(page.locator('[data-result="stats-dice"], [data-result="trig-right-triangle"]')).toHaveCount(0);
  await page.goto('/en/dev/search?q=dice');
  await expect(count(page)).toHaveText('No topics found');
});

test('a category chip narrows the list and marks itself on; the level chip narrows further; Clear filters resets and keeps the text', async ({ page }) => {
  await page.goto('/en/dev/search?q=cone');
  const geometry = page.locator('[data-chip="geometry"]');
  await geometry.click();
  await expect(geometry).toHaveAttribute('aria-pressed', 'true');
  await expect(geometry).toContainText('✓');
  await expect(page).toHaveURL(/q=cone&cat=geometry$/);
  const total = Number(await count(page).getAttribute('data-count'));
  await page.locator('[data-chip="advanced"]').click();
  await expect(page).toHaveURL(/level=advanced/);
  await expect(count(page)).toHaveText('No topics found');
  await page.locator('[data-clear-filters]').click();
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('cone');
  await expect(geometry).toHaveAttribute('aria-pressed', 'false');
  await expect(count(page)).toHaveAttribute('data-count', '2');
  expect(total).toBeGreaterThan(0);
  await expect(page).toHaveURL(/q=cone$/);
  await expect(page.locator('[data-clear-filters]')).toHaveCount(0);
});

test('chips are multi-select within a group and work from the keyboard', async ({ page }) => {
  await page.goto('/en/dev/search');
  const algebra = page.locator('[data-chip="algebra"]');
  await algebra.focus();
  await page.keyboard.press('Space');
  await page.locator('[data-chip="geometry"]').focus();
  await page.keyboard.press('Enter');
  await expect(algebra).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-chip="geometry"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/cat=algebra,geometry$/);
  await expect(count(page)).toHaveText('8 topics found'); // 3 algebra and 5 geometry
});

test('only categories with published topics have a chip', async ({ page }) => {
  await page.goto('/en/dev/search');
  await expect(page.locator('[data-chip="geometry"]')).toBeVisible();
  await expect(page.locator('[data-chip="calculus"]')).toHaveCount(0);
});

test('nothing found: the friendly block with the categories and a way home, in place with no 404', async ({ page }) => {
  const res = await page.goto('/en/dev/search?q=zzzz');
  expect(res?.status()).toBe(200);
  await expect(count(page)).toHaveText('No topics found');
  const none = page.locator('[data-no-results]');
  await expect(none).toContainText('Nothing matches');
  await expect(none.locator('[data-tree-link]')).toHaveCount(12);
  await expect(none.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
});

test('an address with unknown or repeated parts is read safely', async ({ page }) => {
  await page.goto('/en/dev/search?q=cone&q=graph&cat=Not%20A%20Slug,geometry&level=expert,foundation&level=advanced');
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('cone');
  await expect(page.locator('[data-chip="geometry"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-chip="foundation"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-chip="advanced"]')).toHaveAttribute('aria-pressed', 'false');
});

test('a reload restores the search', async ({ page }) => {
  await page.goto('/en/dev/search');
  await page.getByRole('searchbox', { name: 'Search' }).fill('cone');
  await page.locator('[data-chip="geometry"]').click();
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('cone');
  await expect(page.locator('[data-chip="geometry"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Urdu: right to left, Urdu names, and the same topic however the word is typed', async ({ page }) => {
  await page.goto('/ur/dev/search?q=' + encodeURIComponent('مخروط'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-result="geo-cone-volume"]')).toBeVisible();
  await expect(page.locator('[data-result="geo-cone-volume"] [data-path]')).toContainText('جیومیٹری');
  const baseline = await count(page).getAttribute('data-count');
  for (const typed of ['مُخروط', 'مخ‌روط', 'مـخـروط']) {
    await page.goto('/ur/dev/search?q=' + encodeURIComponent(typed));
    await expect(count(page)).toHaveAttribute('data-count', baseline!);
  }
  await expect(page.locator('[data-chip="geometry"]')).toContainText('جیومیٹری');
});

test('a result opens the topic address, and the viewed mark shows for a viewed topic', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('vm.progress.v1', JSON.stringify({ v: 1, topics: { 'geo-cone-volume': { viewedAt: '2026-11-28T00:00:00Z' } }, last: 'geo-cone-volume' })));
  await page.goto('/en/dev/search?q=cone');
  await expect(page.locator('[data-result="geo-cone-volume"] [data-viewed]')).toHaveText(/Viewed/);
  await expect(page.locator('[data-result="geo-cone-section"] [data-viewed]')).toHaveCount(0);
});

test('on a phone nothing overflows and the controls are at least 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/en/dev/search?q=cone');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  for (const sel of ['[data-search-field]', '[data-chip="geometry"]', '[data-chip="foundation"]', '[data-clear-text]']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }
});

test('the search box on Home lands on the search page with the text', async ({ page }) => {
  await page.goto('/en/dev/home');
  await page.getByRole('searchbox').fill('cone');
  await page.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/\/en\/search\?q=cone$/);
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('cone');
});
