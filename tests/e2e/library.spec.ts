import { test, expect } from '@playwright/test';

// The tree pages in a real browser (Story 5.1): category, subcategory and chapter, with counts, topic cards and
// the viewed mark, in English and Urdu. The server runs with VM_HARNESS=1, so the catalog is the fixture one:
// 13 fixture topics, of which `stats-dice` is unpublished and `trig-right-triangle` is deleted.

test('a category shows its name, its count and its subcategories, each with a count', async ({ page }) => {
  await page.goto('/en/geometry');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geometry');
  await expect(page.locator('[data-total]')).toHaveText('5 topics');
  const solids = page.locator('[data-tree-link="solids-volume"]');
  await expect(solids).toContainText('Solids and volume');
  await expect(solids).toContainText('(4 topics)');
  await expect(page.locator('[data-tree-link="plane-geometry"]')).toContainText('(1 topic)');
});

test('down to a chapter: names, counts and a path back up at every level', async ({ page }) => {
  await page.goto('/en/geometry');
  await page.locator('[data-tree-link="solids-volume"]').click();
  await expect(page).toHaveURL(/\/en\/geometry\/solids-volume$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solids and volume');
  await expect(page.locator('[data-tree-link="cylinders"]')).toContainText('(2 topics)');
  await page.locator('[data-tree-link="cylinders"]').click();
  await expect(page).toHaveURL(/\/en\/geometry\/solids-volume\/cylinders$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cylinders');
  const path = page.getByRole('navigation', { name: 'You are here' });
  await expect(path.getByRole('link', { name: 'Geometry' })).toHaveAttribute('href', '/en/geometry');
  await expect(path.getByRole('link', { name: 'Solids and volume' })).toHaveAttribute('href', '/en/geometry/solids-volume');
  await path.getByRole('link', { name: 'Solids and volume' }).click();
  await expect(page).toHaveURL(/\/en\/geometry\/solids-volume$/);
});

test('a chapter lists topic cards with title, summary, level, minutes and a link to the topic', async ({ page }) => {
  await page.goto('/en/geometry/solids-volume/cylinders');
  const cards = page.locator('[data-topic-card]');
  await expect(cards).toHaveCount(2);
  const card = page.locator('[data-topic-card="geo-cylinder-net"]');
  await expect(card).toHaveAttribute('href', '/en/topic/geo-cylinder-net');
  await expect(card.getByRole('heading', { level: 3 })).not.toBeEmpty();
  await expect(card.locator('[data-level]')).toHaveText(/Foundation|Intermediate|Advanced/);
  await expect(card).toContainText(/\d+ min/);
  await expect(card.locator('p').first()).not.toBeEmpty();
});

test('an unpublished or deleted topic is in no list and no count', async ({ page }) => {
  await page.goto('/en/statistics-and-probability/experiments/rolling-a-die'); // its only topic is unpublished
  await expect(page.locator('[data-total]')).toHaveText('0 topics');
  await expect(page.locator('[data-topic-card]')).toHaveCount(0);
  await expect(page.getByText('No topics here yet.')).toBeVisible();
  await page.goto('/en/trigonometry/right-triangles/ratios'); // its only topic is deleted
  await expect(page.locator('[data-topic-card]')).toHaveCount(0);
  await page.goto('/en/statistics-and-probability');
  await expect(page.locator('[data-total]')).toHaveText('1 topic'); // the normal distribution only
});

test('a branch with no topic is listed with a count of zero, and says so', async ({ page }) => {
  await page.goto('/en/calculus');
  await expect(page.locator('[data-total]')).toHaveText('0 topics');
  await expect(page.getByText('No topics here yet.')).toBeVisible();
});

test('the viewed mark shows for a topic viewed on this device, and for no other', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('vm.progress.v1', JSON.stringify({ v: 1, topics: { 'geo-cylinder-net': { viewedAt: '2026-11-28T00:00:00Z', lastStep: 1 } }, last: 'geo-cylinder-net' }));
  });
  await page.goto('/en/geometry/solids-volume/cylinders');
  await expect(page.locator('[data-topic-card="geo-cylinder-net"] [data-viewed]')).toHaveText(/Viewed/);
  await expect(page.locator('[data-topic-card="geo-cylinder-fill"] [data-viewed]')).toHaveCount(0);
});

test('a damaged progress value shows no marks and no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem('vm.progress.v1', '{"v":1,"topics":'));
  await page.goto('/en/geometry/solids-volume/cylinders');
  await expect(page.locator('[data-topic-card]')).toHaveCount(2);
  await expect(page.locator('[data-viewed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Urdu: right to left, Urdu names, Urdu count words, links stay in /ur', async ({ page }) => {
  await page.goto('/ur/geometry/solids-volume/cylinders');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('بیلن');
  await expect(page.locator('[data-total]')).toContainText('2 موضوعات');
  await expect(page.locator('[data-topic-card="geo-cylinder-net"]')).toHaveAttribute('href', '/ur/topic/geo-cylinder-net');
  await page.goto('/ur/geometry');
  await expect(page.locator('[data-tree-link="solids-volume"]')).toContainText('ٹھوس اشکال اور حجم');
});

test('an address that is not in the tree answers 404 with a way back one level up', async ({ page }) => {
  const res = await page.goto('/en/geometry/no-such-place');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that page');
  await expect(page.locator('[data-back-link]')).toHaveAttribute('href', '/en/geometry');
  const top = await page.goto('/en/no-such-category');
  expect(top?.status()).toBe(404);
  await expect(page.locator('[data-back-link]')).toHaveAttribute('href', '/en');
});

test('the pages need no scene code: no 3D chunk is requested, and the page works on a phone', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/en/geometry/solids-volume/cylinders');
  await expect(page.locator('[data-topic-card]')).toHaveCount(2);
  expect(urls.filter((u) => u.includes('/_next/') && /three|solid/i.test(u))).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const box = await page.locator('[data-topic-card]').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
