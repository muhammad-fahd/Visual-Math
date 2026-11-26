import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { PREPAINT_SCRIPT_SHA256 } from '../../src/server/csp-hashes';

const html = (page: import('@playwright/test').Page) => page.locator('html');

test.describe('theme', () => {
  test.use({ colorScheme: 'dark' });

  test('applies the OS theme before React hydrates (no flash)', async ({ page }) => {
    // Block external scripts (the React bundles) so hydration can never run: the attribute can only come from
    // the inline script. Stylesheets still load.
    await page.route('**/_next/static/**', (route) => (route.request().resourceType() === 'script' ? route.abort() : route.continue()));
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(18, 22, 28)'); // --vm-color-bg-dark #12161C
  });

  test('toggle switches without navigation and the choice persists', async ({ page }) => {
    let navigations = 0;
    page.on('request', (r) => {
      if (r.resourceType() === 'document') navigations++;
    });
    await page.goto('/');
    navigations = 0; // count only what happens after load
    await page.getByRole('button', { name: /Light/ }).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    expect(navigations).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('vm.theme'))).toBe('light');
    await page.reload();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: /Light/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a saved choice shows as pressed, not System, once the page is interactive', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.theme', 'dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Dark/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /System/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('System follows the OS without a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /System/ }).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
  });

  test('a corrupt saved value falls back to the OS', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.theme', 'banana'));
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  });

  test('the toggle buttons are at least 44 px tall', async ({ page }) => {
    await page.goto('/');
    for (const name of [/Light/, /Dark/, /System/]) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('the inline script in the served page hashes to the exported CSP value', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('head script:not([src])').first().evaluate((el) => el.textContent ?? '');
    expect(`'sha256-${createHash('sha256').update(text).digest('base64')}'`).toBe(PREPAINT_SCRIPT_SHA256);
  });
});

test.describe('theme without JavaScript', () => {
  test.use({ colorScheme: 'dark', javaScriptEnabled: false });

  test('CSS alone follows the operating system', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => null);
    // evaluate is unavailable with JS off in some engines; fall back to reading the response styles
    if (bg !== null) expect(bg).toBe('rgb(18, 22, 28)');
    else await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 22, 28)');
  });
});

test.describe('Urdu font', () => {
  test('English pages never request the Nastaliq file; Urdu text loads it', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('NotoNastaliqUrdu')) fontRequests.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(fontRequests).toHaveLength(0);

    const response = page.waitForResponse((r) => r.url().includes('NotoNastaliqUrdu'));
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.lang = 'ur';
      p.dir = 'rtl';
      p.textContent = 'اردو';
      document.body.appendChild(p);
    });
    const res = await response;
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/font|woff2|octet-stream/);
    // The face is really usable, not just requested.
    await expect.poll(() => page.evaluate(() => document.fonts.check('18px "Noto Nastaliq Urdu"', 'اردو'))).toBe(true);
    await expect(page.locator('p[lang="ur"]')).toBeVisible();
  });
});
