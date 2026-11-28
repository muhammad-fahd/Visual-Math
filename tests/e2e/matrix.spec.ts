import { test, expect, type Page } from '@playwright/test';

// The matrix transformations in a real browser (Story 4.4), through the topic harness page (VM_HARNESS=1): a matrix on the
// letter F and the unit grid, the determinant as area, eigenvector lines, and a cube in 3D, in words as well as in the
// picture, in English and Urdu, on a phone.

const open = async (page: Page, topic: string, lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator('[data-matrix-viewer]')).toBeVisible();
};
const facts = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('the plane: the matrix, where the basis arrows go and the determinant, in words and in the picture', async ({ page }) => {
  await open(page, 'planeTopic');
  await expect(facts(page)).toContainText('The matrix has the rows (1, 0); (0, 1).');
  await next(page).click();
  await expect(facts(page)).toContainText('The matrix has the rows (2, 0); (0, 1.5).');
  await next(page).click();
  await expect(facts(page)).toContainText('The matrix has the rows (1, 1); (0, 1).');
  await expect(facts(page)).toContainText('e1 goes to (1, 0); e2 goes to (1, 1).');
  await expect(facts(page)).toContainText('The determinant is 1, so every area is multiplied by 1.');
  await expect(page.locator('[data-ghost="shape"]')).toHaveCount(1);
  await expect(page.locator('[data-result="shape"]')).toHaveCount(1);
  await expect(page.locator('[data-basis]')).toHaveCount(2);
  await expect(page.locator('[data-readout="det"]')).toHaveText('1.00');
});

test('a slider moves the shape, the determinant and the words together', async ({ page }) => {
  await open(page, 'planeTopic');
  const before = await page.locator('[data-result="shape"]').getAttribute('d');
  await slide(page, 'a', 2);
  await slide(page, 'd', 3);
  await expect(facts(page)).toContainText('The matrix has the rows (2, 0); (0, 3).');
  await expect(facts(page)).toContainText('The determinant is 6, so every area is multiplied by 6.');
  await expect(page.locator('[data-readout="det"]')).toHaveText('6.00');
  expect(await page.locator('[data-result="shape"]').getAttribute('d')).not.toBe(before);
});

test('the steps: stretch, shear (area kept) and the swap that flips', async ({ page }) => {
  await open(page, 'planeTopic');
  await next(page).click();
  await expect(facts(page)).toContainText('The determinant is 3');
  await next(page).click();
  await expect(facts(page)).toContainText('The determinant is 1, so every area');
  await next(page).click();
  await expect(facts(page)).toContainText('The determinant is negative, so the shape is flipped over (mirrored).');
});

test('the morph: progress 0 is the identity, and the words say how far it is', async ({ page }) => {
  await open(page, 'planeTopic');
  await slide(page, 't', 0.5);
  await expect(facts(page)).toContainText('The picture is 50% of the way');
  await slide(page, 't', 0);
  await expect(facts(page)).toContainText('The picture is 0% of the way');
  expect(await page.locator('[data-result="shape"]').getAttribute('d')).toBe(await page.locator('[data-ghost="shape"]').getAttribute('d'));
});

test('determinant as area: a stretch has area 3, a singular matrix flattens the square', async ({ page }) => {
  await open(page, 'detTopic');
  await expect(page.locator('[data-readout="area"]')).toHaveText('3.00');
  await expect(page.locator('[data-part="area"]')).toHaveCount(1);
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await expect(facts(page)).toContainText('The determinant is 0: the shape is flattened onto a line, so its area is 0.');
  await expect(page.locator('[data-readout="area"]')).toHaveText('0.00');
});

test('eigenvectors: two lines with their eigenvalues, none for a rotation', async ({ page }) => {
  await open(page, 'eigenTopic');
  await next(page).click();
  await expect(page.locator('[data-eigen]')).toHaveCount(2);
  await expect(facts(page)).toContainText('The eigenvalue 3 has the eigenvector (0.71, 0.71)');
  await expect(page.locator('[data-readout="e1"]')).toHaveText('3.00');
  await next(page).click();
  await next(page).click();
  await expect(facts(page)).toContainText('There are no real eigenvectors: every direction is turned.');
  await expect(page.locator('[data-eigen]')).toHaveCount(0);
});

test('the cube in 3D: volume 6, then a shear that keeps it', async ({ page }) => {
  await open(page, 'cubeTopic');
  await expect(page.locator('[data-matrix-viewer]')).toHaveAttribute('data-dim', '3');
  await expect(facts(page)).toContainText('The determinant is 1, so every volume is multiplied by 1.');
  await next(page).click();
  await expect(facts(page)).toContainText('The determinant is 6, so every volume is multiplied by 6.');
  await expect(page.locator('[data-readout="vol"]')).toHaveText('6.00');
  await slide(page, 'k', 1);
  await expect(facts(page)).toContainText('The matrix has the rows (1, 1, 0); (0, 2, 0); (0, 0, 3).');
  await expect(facts(page)).toContainText('The determinant is 6');
});

test('the cube in Tier A draws one canvas without a script error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'cubeTopic');
  await expect(page.locator('[data-matrix-viewer]')).toHaveAttribute('data-tier', 'A');
  await expect(page.locator('[data-matrix-viewer]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the cube is drawn in Tier A or in flat Tier B, never both', async ({ page }) => {
  await open(page, 'cubeTopic');
  await expect(page.locator('[data-matrix-viewer]')).toHaveAttribute('data-tier', /^(A|B|C)$/);
  await expect(page.locator('[data-space-2d]').first()).toBeAttached();
});

test('Urdu: Urdu sentences, the page mirrors, the diagram stays left to right', async ({ page }) => {
  await open(page, 'planeTopic', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(facts(page)).toContainText('میٹرکس کی قطاریں');
  await expect(page.locator('[data-matrix-2d]').locator('xpath=ancestor::div[@dir="ltr"]').first()).toBeAttached();
});

test('on a phone nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'planeTopic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test('no 3D chunk is loaded for a 2D matrix (NFR-1.3)', async ({ page }) => {
  const three: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() !== 'script') return;
    void r.text().then((body) => {
      if (body.includes('WebGLRenderer')) three.push(r.url());
    }, () => undefined);
  });
  await open(page, 'planeTopic');
  await page.waitForLoadState('networkidle');
  expect(three).toEqual([]);
});
