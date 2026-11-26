import { test, expect } from '@playwright/test';

test.describe('redirect from / (FR-6.3)', () => {
  test.describe('Urdu browser', () => {
    test.use({ locale: 'ur-PK' });
    test('goes to /ur, right-to-left', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/ur$/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    });
  });

  test.describe('unsupported browser language', () => {
    test.use({ locale: 'fr-FR' });
    test('goes to /en', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/en$/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });
  });

  test('keeps the query string', async ({ page }) => {
    await page.goto('/?step=2');
    await expect(page).toHaveURL(/\/en\?step=2$/);
  });

  test('a saved vm-locale cookie beats the browser language', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'vm-locale', value: 'ur', url: baseURL! }]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/ur$/);
  });

  test('an invalid cookie value is ignored', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'vm-locale', value: 'zz', url: baseURL! }]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
  });

  test('the redirect is not cacheable and varies by language and cookie', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['vary']).toMatch(/Accept-Language/i);
    expect(res.headers()['cache-control']).toMatch(/no-store/);
  });
});

test.describe('pages', () => {
  test('a link keeps its language even when a different one is saved', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'vm-locale', value: 'ur', url: baseURL! }]);
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('an unknown locale is a 404 in both languages, with the theme applied', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const res = await page.goto('/fr');
    expect(res?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('section[lang="en"] h1')).toBeVisible();
    await expect(page.locator('section[lang="ur"]')).toHaveAttribute('dir', 'rtl');
  });

  test('Urdu pages preload the font; English pages do not', async ({ page }) => {
    await page.goto('/ur');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(1);
    await page.goto('/en');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0);
  });

  test('chrome mirrors in Urdu: the first control sits on the right', async ({ page }) => {
    await page.goto('/ur');
    const [english, urdu] = [await page.getByRole('link', { name: 'English' }).boundingBox(), await page.getByRole('link', { name: 'اردو' }).boundingBox()];
    expect(english!.x).toBeGreaterThan(urdu!.x);
    await page.goto('/en');
    const [e2, u2] = [await page.getByRole('link', { name: 'English' }).boundingBox(), await page.getByRole('link', { name: 'اردو' }).boundingBox()];
    expect(e2!.x).toBeLessThan(u2!.x);
  });

  test('all interface text on /ur is Urdu except the language names', async ({ page }) => {
    await page.goto('/ur');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ویژول میتھ');
    await expect(page.getByRole('group', { name: 'تھیم' })).toBeVisible();
    await expect(page.getByRole('button', { name: /روشن/ })).toBeVisible();
  });
});

test.describe('language switcher (FR-6.1, 6.6)', () => {
  test('keeps path, query and hash, the theme, and saves the choice', async ({ page }) => {
    await page.goto('/en?step=2#a');
    await page.getByRole('button', { name: /Dark/ }).click();
    await page.getByRole('link', { name: 'اردو' }).click();
    await expect(page).toHaveURL(/\/ur\?step=2#a$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const cookies = await page.context().cookies();
    const cookie = cookies.find((c) => c.name === 'vm-locale');
    expect(cookie).toMatchObject({ value: 'ur', path: '/', sameSite: 'Lax' });
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 3600); // about a year

    // Next visit to the bare domain honors the choice, although the browser asks for English.
    await page.goto('/');
    await expect(page).toHaveURL(/\/ur$/);
  });

  test('a modified click is left to the browser (new tab) and saves nothing', async ({ page, context }) => {
    await page.goto('/en');
    const popup = context.waitForEvent('page');
    await page.getByRole('link', { name: 'اردو' }).click({ modifiers: ['Control'] });
    await (await popup).waitForLoadState();
    expect(page.url()).toMatch(/\/en$/);
    expect((await context.cookies()).find((c) => c.name === 'vm-locale')).toBeUndefined();
  });

  test('clicking the current language does nothing', async ({ page }) => {
    await page.goto('/en?x=1');
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\?x=1$/);
    expect((await page.context().cookies()).find((c) => c.name === 'vm-locale')).toBeUndefined();
  });

  test('pages have a title in their language', async ({ page }) => {
    await page.goto('/en');
    await expect(page).toHaveTitle('Visual Math');
    await page.goto('/ur');
    await expect(page).toHaveTitle('ویژول میتھ');
  });

  test('marks the current language', async ({ page }) => {
    await page.goto('/ur');
    await expect(page.getByRole('link', { name: 'اردو' })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('link', { name: 'English' })).not.toHaveAttribute('aria-current', 'true');
  });

  test('every link has a 44 px target', async ({ page }) => {
    await page.goto('/en');
    for (const name of ['English', 'اردو']) {
      expect((await page.getByRole('link', { name }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('the links still switch language (to the bare path)', async ({ page }) => {
      await page.goto('/en');
      await page.getByRole('link', { name: 'اردو' }).click();
      await expect(page).toHaveURL(/\/ur$/);
    });
  });
});
