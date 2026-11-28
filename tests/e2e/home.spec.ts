import { test, expect } from '@playwright/test';

// Home and the nothing-found page in a real browser (Story 5.2). The real `/en` is prerendered at build without a
// database, so most checks use the harness page `/{locale}/dev/home` (VM_HARNESS=1), which renders the same
// `HomePage` with the fixture catalog: 13 topics, `stats-dice` unpublished and `trig-right-triangle` deleted.

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toContainText('Visual Math');
});

test('the real home page is static HTML with the explanation, the search box and no login', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Visual Math');
  await expect(page.getByText('See math instead of memorizing it.')).toBeVisible();
  await expect(page.getByRole('search')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/log ?in|sign ?in|password|account/i);
});

test('the harness home explains, searches, starts, lists 12 categories with counts, and features topics', async ({ page }) => {
  await page.goto('/en/dev/home');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Visual Math');
  await expect(page.getByText('Open a topic, move the sliders')).toBeVisible();
  await expect(page.locator('[data-tree-link]')).toHaveCount(12);
  await expect(page.locator('[data-tree-link="geometry"]')).toContainText('(5 topics)');
  await expect(page.locator('[data-tree-link="calculus"]')).toContainText('(0 topics)');
  const featured = page.locator('[data-featured] [data-topic-card]');
  await expect(featured).toHaveCount(5); // one per category that has a published topic
  await expect(page.locator('[data-start-link]')).toHaveAttribute('href', /^\/en\/topic\/[a-z0-9-]+$/);
  await expect(page.locator('[data-start-link]')).toHaveText('Start');
  // the unpublished and the deleted topic are nowhere on the page
  await expect(page.locator('[data-topic-card="stats-dice"], [data-topic-card="trig-right-triangle"]')).toHaveCount(0);
});

test('a category on Home opens its page', async ({ page }) => {
  await page.goto('/en/dev/home');
  await page.locator('[data-tree-link="geometry"]').click();
  await expect(page).toHaveURL(/\/en\/geometry$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geometry');
});

test('the search box sends the text to /en/search?q= (the results page is Story 5.3)', async ({ page }) => {
  await page.goto('/en/dev/home');
  const box = page.getByRole('searchbox', { name: 'Search topics' });
  await box.fill('cone');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/en\/search\?q=cone$/);
});

test('an empty or blank search is not sent', async ({ page }) => {
  await page.goto('/en/dev/home');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/en\/dev\/home$/);
  await page.getByRole('searchbox').fill('   ');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/en\/dev\/home$/);
});

test('the search works without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/en/dev/home');
  await page.getByRole('searchbox').fill('graph');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/en\/search\?q=graph$/);
  await context.close();
});

test('with no published topic: the categories at zero and "coming soon" instead of Start', async ({ page }) => {
  await page.goto('/en/dev/home?empty=1');
  await expect(page.getByText('Topics are coming soon.')).toBeVisible();
  await expect(page.locator('[data-start-link]')).toHaveCount(0);
  await expect(page.locator('[data-featured]')).toHaveCount(0);
});

test('Urdu: right to left, Urdu words and names, links in /ur', async ({ page }) => {
  await page.goto('/ur/dev/home');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ویژول میتھ');
  await expect(page.locator('[data-tree-link="geometry"]')).toContainText('جیومیٹری');
  await expect(page.locator('[data-tree-link="geometry"]')).toHaveAttribute('href', '/ur/geometry');
  await expect(page.locator('[data-start-link]')).toHaveText('شروع کریں');
  await expect(page.locator('[data-search-box]')).toHaveAttribute('action', '/ur/search');
});

test('a link that finds nothing: 404, a friendly page with search, the categories and a way home', async ({ page }) => {
  const res = await page.goto('/en/nothing-here');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that page');
  await expect(page.getByRole('searchbox', { name: 'Search topics' })).toBeVisible();
  await expect(page.locator('[data-tree-link]')).toHaveCount(12);
  await expect(page.locator('[data-home-link]')).toHaveAttribute('href', '/en');
  await page.locator('[data-home-link]').click();
  await expect(page).toHaveURL(/\/en$/);
});

test('the same page in Urdu, and an unsupported language still gets the global 404', async ({ page }) => {
  const res = await page.goto('/ur/nothing-here');
  expect(res?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-home-link]')).toHaveAttribute('href', '/ur');
  await expect(page.locator('[data-search-box]')).toHaveAttribute('action', '/ur/search');
  const fr = await page.goto('/fr/nothing-here');
  expect(fr?.status()).toBe(404);
  await expect(page.locator('section[lang="ur"]')).toHaveAttribute('dir', 'rtl');
});

test('on a phone nothing overflows and every control is at least 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/en/dev/home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  for (const sel of ['[data-start-link]', '[data-search-box] input', '[data-search-box] button', '[data-tree-link="geometry"]']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }
});

test('the keyboard reaches the search box, then Start, then the first category, in that order', async ({ page }) => {
  await page.goto('/en/dev/home');
  const order: string[] = [];
  for (let i = 0; i < 40 && !order.includes('category'); i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const el = document.activeElement;
      if (el?.matches('[data-search-box] input')) return 'search';
      if (el?.hasAttribute('data-start-link')) return 'start';
      if (el?.getAttribute('data-tree-link') === 'arithmetic-and-numbers') return 'category';
      return '';
    });
    if (at && !order.includes(at)) order.push(at);
  }
  expect(order).toEqual(['search', 'start', 'category']);
});

test('Urdu headings and card titles keep the tall Nastaliq line height, so they do not overlap the line below', async ({ page }) => {
  await page.goto('/ur/dev/home');
  const lineHeight = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(await lineHeight('h1')).toBeGreaterThanOrEqual(48);
  expect(await lineHeight('[data-topic-card] h3')).toBeGreaterThanOrEqual(48);
  expect(await lineHeight('[data-tree-link] span')).toBeGreaterThanOrEqual(48);
  await page.goto('/en/dev/home');
  expect(await lineHeight('h1')).toBeLessThan(48); // English keeps its own
});
