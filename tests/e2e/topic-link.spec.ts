import { test, expect } from '@playwright/test';

// The topic by its direct link in a real browser (Story 5.4). The server runs with VM_HARNESS=1, so the topics are the
// fixtures: 11 published; `stats-dice` unpublished and `trig-right-triangle` deleted. `geo-cone-section` lists three
// prerequisites (one published, one unpublished, one unknown) and two `next` (one published, one deleted).

test('a direct link opens the published topic with no login, in English, with the real path names', async ({ page }) => {
  const res = await page.goto('/en/topic/geo-cone-volume');
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId('topic-page')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Volume of a Cone');
  const path = page.getByRole('navigation', { name: 'You are here' });
  await expect(path.getByRole('link', { name: 'Geometry' })).toHaveAttribute('href', '/en/geometry');
  await expect(path.getByRole('link', { name: 'Solids and volume' })).toBeVisible();
  await expect(path.getByRole('link', { name: 'Cones' })).toHaveAttribute('href', '/en/geometry/solids-volume/cones');
  await expect(page.getByRole('main')).not.toContainText(/log ?in|sign ?in|password/i);
  await expect(page).toHaveTitle(/The Volume of a Cone/);
});

test('the same address in /ur opens the Urdu topic, right to left', async ({ page }) => {
  await page.goto('/ur/topic/geo-cone-volume');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مخروط کا حجم');
  await expect(page.getByRole('navigation', { name: /./ }).first()).toBeVisible();
});

test('a shared link keeps its step', async ({ page }) => {
  await page.goto('/en/topic/geo-cone-section?step=2');
  await expect(page.getByText(/Step 2 of/).first()).toBeVisible();
});

test('an unpublished, a deleted, an unknown and a malformed id are the friendly 404, with no topic text', async ({ page }) => {
  for (const id of ['stats-dice', 'trig-right-triangle', 'no-such-topic', 'A%20B', 'x']) {
    const res = await page.goto(`/en/topic/${id}`);
    expect(res?.status(), id).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We could not find that page');
    await expect(page.getByTestId('topic-page')).toHaveCount(0);
  }
  const ur = await page.goto('/ur/topic/stats-dice');
  expect(ur?.status()).toBe(404);
});

test('"What you need first" lists the published prerequisite with a link, leaves out the unpublished and the unknown, and locks nothing', async ({ page }) => {
  await page.goto('/en/topic/geo-cone-section');
  const box = page.getByTestId('prerequisites');
  await expect(box).toContainText('What you need first');
  await expect(box.getByRole('link')).toHaveCount(1);
  await expect(box.getByRole('link', { name: 'The Volume of a Cone' })).toHaveAttribute('href', '/en/topic/geo-cone-volume');
  await expect(box).not.toContainText(/dice|no-such/i);
  // never a gate: the sliders work at once
  await expect(page.locator('#param-cut')).toBeEnabled();
  await box.getByRole('link').click();
  await expect(page).toHaveURL(/\/en\/topic\/geo-cone-volume$/);
});

test('"What to learn next" lists the published topic only', async ({ page }) => {
  await page.goto('/en/topic/geo-cone-section');
  const next = page.getByTestId('learn-next');
  await expect(next).toContainText('What to learn next');
  await expect(next.getByRole('link')).toHaveCount(1);
  await expect(next.getByRole('link').first()).toHaveAttribute('href', '/en/topic/geo-cylinder-fill');
});

test('a topic with neither shows neither box', async ({ page }) => {
  await page.goto('/en/topic/alg-balance-scale');
  await expect(page.getByTestId('prerequisites')).toHaveCount(0);
  await expect(page.getByTestId('learn-next')).toHaveCount(0);
});

test('Urdu prerequisites use Urdu words and Urdu titles, with links in /ur', async ({ page }) => {
  await page.goto('/ur/topic/geo-cone-section');
  const box = page.getByTestId('prerequisites');
  await expect(box).toContainText('پہلے کیا آنا چاہیے');
  await expect(box.getByRole('link').first()).toHaveAttribute('href', '/ur/topic/geo-cone-volume');
});

test('Previous and Next topic are the neighbours in the chapter', async ({ page }) => {
  await page.goto('/en/topic/geo-cylinder-fill');
  const nav = page.getByTestId('neighbours');
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', '/en/topic/geo-cylinder-net');
  await page.goto('/en/topic/geo-cylinder-net');
  await expect(page.getByTestId('neighbours').getByRole('link').first()).toHaveAttribute('href', '/en/topic/geo-cylinder-fill');
});

test('Share copies the clean topic link and a toast says so', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permission is a Chromium grant');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/topic/geo-cone-section?step=2&p.cut=1');
  await page.getByTestId('share').click();
  await expect(page.getByTestId('share-status')).toHaveText('Link copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${new URL(page.url()).origin}/en/topic/geo-cone-section`);
});

test('Share in Urdu says so in Urdu and copies the /ur link', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permission is a Chromium grant');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/ur/topic/geo-cone-volume');
  await page.getByTestId('share').click();
  await expect(page.getByTestId('share-status')).toHaveText('لنک کاپی ہو گیا۔');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/ur\/topic\/geo-cone-volume$/);
});

test('if copying is refused the link is shown to copy by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await page.goto('/en/topic/geo-cone-volume');
  await page.getByTestId('share').click();
  await expect(page.getByTestId('share-link')).toHaveValue(/\/en\/topic\/geo-cone-volume$/);
  await expect(page.getByTestId('share-status')).toHaveText('');
});

test('the cards, results and Start now lead to a real topic', async ({ page }) => {
  await page.goto('/en/geometry/solids-volume/cones');
  await page.locator('[data-topic-card="geo-cone-volume"]').click();
  await expect(page).toHaveURL(/\/en\/topic\/geo-cone-volume$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Volume of a Cone');
  await page.goto('/en/dev/search?q=cone');
  await page.locator('[data-result="geo-cone-volume"]').click();
  await expect(page.getByTestId('topic-page')).toBeVisible();
  await page.goto('/en/dev/home');
  await page.locator('[data-start-link]').click();
  await expect(page.getByTestId('topic-page')).toBeVisible();
});

test('on a phone the new boxes and Share fit and are at least 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/en/topic/geo-cone-section');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  for (const sel of ['[data-testid="share"]', '[data-testid="prerequisites"] a', '[data-testid="learn-next"] a']) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(44);
  }
});
