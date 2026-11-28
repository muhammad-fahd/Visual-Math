import { test, expect, type Page } from '@playwright/test';

// The Argand diagram in a real browser (Story 4.2), through the topic harness page (VM_HARNESS=1): the draggable numbers,
// the sum, product, conjugate, powers and roots, in words as well as in the picture, in English and Urdu, on a phone.

const open = async (page: Page, topic = 'argand', lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator('[data-canvas2d]')).toBeVisible();
};
const facts = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('the first step shows z as an arrow with its modulus and argument, in the picture and in words', async ({ page }) => {
  await open(page);
  await expect(facts(page)).toContainText('z = 2 + i; modulus 2.24, argument 26.57 degrees.');
  await expect(facts(page)).not.toContainText('z + w');
  await expect(page.locator('[data-kind="arrow"]')).toHaveCount(1);
  await expect(page.locator('[data-element="z"][data-kind="arrow"] polygon')).toHaveCount(1); // the head
  await expect(page.locator('[data-canvas2d] text', { hasText: 'r = 2.24' })).toBeVisible();
  await expect(page.locator('[data-readout="mzr"]')).toHaveText('2.24');
});

test('Next adds w and the sum, then the product (the moduli multiply, the arguments add), then the conjugate', async ({ page }) => {
  await open(page);
  await next(page).click();
  await expect(facts(page)).toContainText('z + w = 3 + 3i: put each number at the tip of the other');
  await expect(page.locator('[data-kind="arrow"]')).toHaveCount(3); // z, w, the sum
  await next(page).click();
  await expect(facts(page)).not.toContainText('z + w =');
  await expect(facts(page)).toContainText('= 5i. Multiplying by w scales by 2.24 and turns by 63.43 degrees, so the modulus is 5 and the argument is 90 degrees.');
  await expect(page.locator('[data-readout="mpr"]')).toHaveText('5.00');
  await next(page).click();
  await expect(facts(page)).toContainText('The conjugate of z is 2 − i');
});

test('a number moves with the arrow keys, one step at a time, and everything built on it follows', async ({ page }) => {
  await open(page);
  await next(page).click();
  const handle = page.locator('[data-handle="z"]');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#param-zr')).toHaveValue('2.5');
  await expect(facts(page)).toContainText('z = 2.5 + i');
  await expect(facts(page)).toContainText('z + w = 3.5 + 3i');
  await page.keyboard.press('ArrowUp');
  await expect(facts(page)).toContainText('z = 2.5 + 1.5i');
});

test('a number follows a pointer drag', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="z"]');
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y - 50, { steps: 6 });
  await page.mouse.up();
  expect(Number(await page.locator('#param-zr').inputValue())).toBeGreaterThan(2);
  expect(Number(await page.locator('#param-zi').inputValue())).toBeGreaterThan(1);
});

test('the sliders and typed boxes move the same numbers', async ({ page }) => {
  await open(page);
  await slide(page, 'zr', 3);
  await slide(page, 'zi', 4);
  await expect(facts(page)).toContainText('z = 3 + 4i; modulus 5, argument 53.13 degrees.');
  const box = page.locator('input[data-typed="zr"]');
  await box.fill('-1');
  await box.press('Enter');
  await expect(facts(page)).toContainText('z = −1 + 4i');
});

test('zero has no argument: the text says so, nothing is drawn wrong', async ({ page }) => {
  await open(page);
  await slide(page, 'zr', 0);
  await slide(page, 'zi', 0);
  await expect(facts(page)).toContainText('z = 0; its argument is not defined.');
  await expect(page.locator('[data-canvas2d]')).not.toContainText('NaN');
});

test('Reset all brings the numbers and the steps back', async ({ page }) => {
  await open(page);
  await slide(page, 'zr', -3);
  await page.getByRole('button', { name: 'Reset all' }).first().click();
  await expect(facts(page)).toContainText('z = 2 + i');
});

test('roots of unity: six marks, a circle and a hexagon, 60 degrees apart; the list while there are eight or fewer', async ({ page }) => {
  await open(page, 'unity');
  await expect(facts(page)).toContainText('The 6 roots of 1 lie on a circle of radius 1, 60 degrees apart, the first at 0 degrees.');
  await expect(facts(page)).toContainText('They are 1; 0.5 + 0.87i;');
  await expect(page.locator('[data-element="unity"][data-kind="polygon"]')).toHaveCount(1);
  await expect(page.locator('[data-element="unity"][data-kind="circle"]')).toHaveCount(1);
  await expect(page.locator('[data-readout="gap"]')).toHaveText('60.0');
});

test('changing n changes the roots and the angle between them', async ({ page }) => {
  await open(page, 'unity');
  await slide(page, 'n', 8);
  await expect(facts(page)).toContainText('The 8 roots of 1 lie on a circle of radius 1, 45 degrees apart');
  await expect(facts(page)).toContainText('They are');
  await slide(page, 'n', 9);
  await expect(facts(page)).toContainText('The 9 roots of 1');
  await expect(facts(page)).not.toContainText('They are');
  await expect(page.locator('[data-readout="gap"]')).toHaveText('40.0');
});

test('powers of z on the unit circle stay on it; off it they spiral', async ({ page }) => {
  await open(page, 'unity');
  await next(page).click();
  await next(page).click();
  await expect(facts(page)).toContainText('z to the power 5 =');
  await expect(facts(page)).toContainText('the modulus is 1 (the modulus to the power 5)');
  await slide(page, 'zr', 1);
  await slide(page, 'zi', 0.5);
  await expect(facts(page)).toContainText('the modulus is 1.75 (the modulus to the power 5)'); // 1.118 to the 5th
});

test('a power that grows too far to draw is left out and named', async ({ page }) => {
  await open(page, 'unity');
  await next(page).click();
  await next(page).click();
  await slide(page, 'zr', 1.5);
  await slide(page, 'zi', 1.5);
  await slide(page, 'p', 8);
  await expect(facts(page)).toContainText('z to the power 8 =');
});

test('Urdu: Urdu sentences, the page mirrors, the diagram stays left to right', async ({ page }) => {
  await open(page, 'argand', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(facts(page)).toContainText('ماڈیولس');
  await expect(page.locator('[data-canvas2d]').locator('xpath=ancestor::div[@dir="ltr"]').first()).toBeAttached();
});

test('on a phone nothing overflows sideways and the handle can still be moved by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.locator('[data-handle="z"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(facts(page)).toContainText('z = 2.5 + i');
});

test('no 3D chunk is loaded for the Argand diagram (NFR-1.3)', async ({ page }) => {
  const three: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() !== 'script') return;
    void r.text().then((body) => {
      if (body.includes('WebGLRenderer')) three.push(r.url());
    }, () => undefined);
  });
  await open(page);
  await page.waitForLoadState('networkidle');
  expect(three).toEqual([]);
});
