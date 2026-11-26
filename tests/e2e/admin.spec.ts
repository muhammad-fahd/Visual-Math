import { test, expect, type Page } from '@playwright/test';

// Runs without a Supabase project: the server then fails closed, which is what a visitor must see anyway.
// The sign-in screens are driven against mocked handler responses; the handlers' logic is in unit tests.

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

test.describe('a visitor never reaches the admin area (AD-8)', () => {
  test('the panel is the not-available page, status 404, with nothing about admins', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page is not available.');
    await expect(page.locator('body')).not.toContainText(/panel|sign out|signed in/i);
  });

  test('every auth handler refuses a visitor with 401 in the error envelope', async ({ request, baseURL }) => {
    const headers = { origin: baseURL!, 'content-type': 'application/json' };
    for (const [path, data] of [
      ['/api/admin/auth/sign-out', {}],
      ['/api/admin/auth/mfa/enroll', {}],
      ['/api/admin/auth/mfa/verify', { code: '123456' }],
      ['/api/admin/auth/recover', { code: 'ABCDE-FGHJK' }],
    ] as const) {
      const res = await request.post(path, { headers, data });
      expect(res.status(), path).toBe(401);
      expect(res.headers()['cache-control']).toBe('no-store');
      expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
    }
  });

  test('a cross-site or originless post is refused before anything runs', async ({ request }) => {
    const res = await request.post('/api/admin/auth/sign-out', { headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, data: {} });
    expect(res.status()).toBe(403);
    expect((await request.post('/api/admin/auth/sign-out', { data: {} })).status()).toBe(403);
  });

  test('sign-in with no Supabase configured is unavailable, not a crash', async ({ request, baseURL }) => {
    const res = await request.post('/api/admin/auth/sign-in', { headers: { origin: baseURL!, 'content-type': 'application/json' }, data: { email: 'a@b.co', password: 'x' } });
    expect(res.status()).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/supabase|postgres|stack/i);
  });

  test('GET on a handler is not allowed', async ({ request }) => {
    expect((await request.get('/api/admin/auth/sign-in')).status()).toBe(405);
  });
});

async function fill(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label).fill(value);
}

test.describe('sign-in screens (mocked handlers)', () => {
  test('a wrong answer shows one generic line that names no factor', async ({ page }) => {
    await page.route('**/api/admin/auth/sign-in', (r) => r.fulfill(json(401, { error: { code: 'invalid_credentials', message: 'x' } })));
    await page.goto('/admin/sign-in');
    await fill(page, 'Email', 'owner@example.com');
    await fill(page, 'Password', 'wrong');
    await page.getByRole('button', { name: 'Continue' }).click();
    const alert = page.locator('form [role="alert"]');
    await expect(alert).toHaveText('Those details did not work. Check them and try again.');
    await expect(alert).not.toContainText(/password|code|email/i);
  });

  test('a lock is text with the wait', async ({ page }) => {
    await page.route('**/api/admin/auth/sign-in', (r) =>
      r.fulfill(json(429, { error: { code: 'locked', message: 'x', details: { retryAfterSeconds: 900 } } }, { 'retry-after': '900' })),
    );
    await page.goto('/admin/sign-in');
    await fill(page, 'Email', 'owner@example.com');
    await fill(page, 'Password', 'wrong');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('form [role="alert"]')).toHaveText('Too many attempts. Try again in 15 min.');
  });

  test('first sign-in: QR and key, then the recovery codes once', async ({ page }) => {
    await page.route('**/api/admin/auth/sign-in', (r) => r.fulfill(json(200, { next: 'enroll' })));
    await page.route('**/api/admin/auth/mfa/enroll', (r) =>
      r.fulfill(json(200, { factorId: 'f2', qrCode: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' })),
    );
    let sent: unknown;
    await page.route('**/api/admin/auth/mfa/verify', async (r) => {
      sent = r.request().postDataJSON();
      await r.fulfill(json(200, { recoveryCodes: ['ABCDE-FGHJK', 'MNPQR-STUVW'] }));
    });
    await page.goto('/admin/sign-in');
    await fill(page, 'Email', 'owner@example.com');
    await fill(page, 'Password', 'correct horse');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Set up your authenticator' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code for the authenticator app' })).toBeVisible();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await fill(page, 'Code', '123456');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Your recovery codes' })).toBeVisible();
    await expect(page.getByText('ABCDE-FGHJK')).toBeVisible();
    expect(sent).toEqual({ factorId: 'f2', code: '123456' });
  });

  test('returning admin: the code step, with a way to use a recovery code', async ({ page }) => {
    await page.route('**/api/admin/auth/sign-in', (r) => r.fulfill(json(200, { next: 'verify' })));
    await page.goto('/admin/sign-in');
    await fill(page, 'Email', 'owner@example.com');
    await fill(page, 'Password', 'correct horse');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Authenticator code' })).toBeVisible();
    await page.getByRole('button', { name: 'Use a recovery code instead' }).click();
    await expect(page.getByRole('heading', { name: 'Recovery code' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the authenticator code' }).click();
    await expect(page.getByRole('heading', { name: 'Authenticator code' })).toBeVisible();
  });

  test('the sign-in page has no third-party requests and targets of 44 px', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost:3000') && !r.url().startsWith('data:')) external.push(r.url());
    });
    await page.goto('/admin/sign-in');
    expect(external).toEqual([]);
    expect((await page.getByRole('button', { name: 'Continue' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
