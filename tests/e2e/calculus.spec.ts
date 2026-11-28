import { test, expect, type Page } from '@playwright/test';

// The calculus elements in a real browser (Story 4.3), through the topic harness page (VM_HARNESS=1): the tangent that
// moves with its derivative graph, the limit probe, and the Riemann sums, in words as well as in the picture.

const open = async (page: Page, topic: string, lang = 'en') => {
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

test('the tangent: its slope in words, and the keyboard moves the point and the slope together', async ({ page }) => {
  await open(page, 'tangentTopic');
  await expect(facts(page)).toContainText('the slope of the tangent is 2.');
  const handle = page.locator('[data-handle="tan"]');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#param-a')).toHaveValue('1.5');
  await expect(facts(page)).toContainText('the slope of the tangent is 3.');
  await expect(page.locator('[data-readout="slope"]')).toHaveText('3.0');
});

test('the derivative graph: its height at x is the slope of the tangent, in the same words', async ({ page }) => {
  await open(page, 'tangentTopic');
  await next(page).click();
  await expect(facts(page)).toContainText('the derivative graph is 4 high, which is the slope of the tangent there.');
  await expect(facts(page)).toContainText('the slope of the tangent is 4.');
  await expect(page.locator('[data-element="deriv-link"]')).toHaveCount(1);
});

test('the secant slope falls to the tangent slope as the gap shrinks', async ({ page }) => {
  await open(page, 'tangentTopic');
  await next(page).click();
  await next(page).click();
  await expect(facts(page)).toContainText('so the slope of the secant is 6.');
  await next(page).click();
  await expect(facts(page)).toContainText('so the slope of the secant is 4.1.');
});

test('the limit: both sides, the limit and the hole, in words and as an open circle', async ({ page }) => {
  await open(page, 'limitTopic');
  await next(page).click();
  await expect(facts(page)).toContainText('it is heading for 1. The function is not defined there');
  await expect(page.locator('[data-element="probe-limit"]')).toHaveCount(1);
  await next(page).click();
  await next(page).click();
  await expect(facts(page)).toContainText('a distance 0.04 either side');
  await expect(page.locator('[data-canvas2d]')).not.toContainText('NaN');
});

test('Riemann sums: each sum beside the exact area, and the slices follow n', async ({ page }) => {
  await open(page, 'riemannTopic');
  await expect(facts(page)).toContainText('with 3 left rectangles the sum is 5; the exact area is 9');
  await expect(page.locator('[data-element="left"]')).toHaveCount(3);
  await slide(page, 'n', 10);
  await expect(page.locator('[data-element="left"]')).toHaveCount(10);
  await expect(facts(page)).toContainText('with 10 left rectangles');
  await next(page).click();
  await expect(facts(page)).toContainText('with 10 right rectangles');
});

test('the four sums at n = 3 are 5, 14, 8.75 and 9.5', async ({ page }) => {
  await open(page, 'riemannTopic');
  await expect(page.locator('[data-readout="rl"]')).toHaveText('5.000');
  await expect(page.locator('[data-readout="rr"]')).toHaveText('14.000');
  await expect(page.locator('[data-readout="rm"]')).toHaveText('8.750');
  await expect(page.locator('[data-readout="rt"]')).toHaveText('9.500');
});

test('Urdu: Urdu sentences, the diagram stays left to right', async ({ page }) => {
  await open(page, 'riemannTopic', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(facts(page)).toContainText('اصل رقبہ');
});

test('on a phone nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, 'tangentTopic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
