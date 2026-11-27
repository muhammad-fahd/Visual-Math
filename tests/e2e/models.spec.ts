import { test, expect, type Page } from '@playwright/test';

// The number and fraction models in a real browser (Story 3.3), through the harness page (VM_HARNESS=1):
// the equivalent-fractions topic, its drag and drop by keyboard and by pointer, its steps, Urdu and a phone.

const open = async (page: Page, lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=fractions`);
  await expect(page.locator('[data-number-model]')).toBeVisible();
};
const shows = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });

test('the first step shows two bars and no alignment line yet', async ({ page }) => {
  await open(page);
  await expect(shows(page)).toContainText('Bar 1: 2 of 4 equal parts are filled, which is 1/2.');
  await expect(shows(page)).toContainText('Bar 2: 1 of 2 equal parts are filled, which is 1/2.');
  await expect(shows(page)).not.toContainText('reach the same length');
});

test('Next lines the bars up: 2/4 and 1/2 reach the same length; 3/6 too; 1/3 does not', async ({ page }) => {
  await open(page);
  await next(page).click();
  await expect(shows(page)).toContainText('Bars 1 and 2 reach the same length: 1/2.');
  await next(page).click();
  await expect(shows(page)).toContainText('Bar 1: 3 of 6 equal parts are filled');
  await expect(shows(page)).toContainText('Bars 1 and 2 reach the same length: 1/2.');
  await next(page).click();
  await expect(shows(page)).toContainText('Bar 1: 1 of 3 equal parts are filled');
  await expect(shows(page)).not.toContainText('reach the same length');
});

test('the end of a bar moves with the arrow keys, Home and End, and the parameter follows', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="bar-1"]');
  await expect(handle).toHaveAttribute('aria-valuenow', '2');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(shows(page)).toContainText('Bar 1: 3 of 4');
  await expect(page.locator('#param-n1')).toHaveValue('3');
  await page.keyboard.press('End');
  await expect(shows(page)).toContainText('Bar 1: 4 of 4');
  await page.keyboard.press('Home');
  await expect(shows(page)).toContainText('Bar 1: 0 of 4');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#param-n1')).toHaveValue('0');
});

test('dragging the end of a bar with the pointer picks the nearest cell edge', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="bar-1"]');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 200, y, { steps: 6 });
  await page.mouse.up();
  expect(Number(await page.locator('#param-n1').inputValue())).toBeGreaterThan(2);
});

test('changing the parts of a bar with its slider moves the handle track; Reset all brings the bars back', async ({ page }) => {
  await open(page);
  await page.locator('#param-d1').evaluate((el) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '8');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(shows(page)).toContainText('Bar 1: 2 of 8');
  await expect(page.locator('[data-handle="bar-1"]')).toHaveAttribute('aria-valuemax', '8');
  await page.getByRole('button', { name: 'Reset all' }).first().click();
  await expect(shows(page)).toContainText('Bar 1: 2 of 4');
});

test('Urdu: the sentences are in Urdu and the picture stays left to right', async ({ page }) => {
  await open(page, 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(shows(page)).toContainText('پٹی 1');
  await expect(page.locator('[data-number-model]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
});

test('a phone has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
