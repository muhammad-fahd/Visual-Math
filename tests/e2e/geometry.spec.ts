import { test, expect, type Page } from '@playwright/test';

// The triangle topic in a real browser (Story 3.2), through the harness page (VM_HARNESS=1): the measures
// follow a drag by keyboard and by pointer, the steps show a reflection, a rotation and a scaling, Urdu, and a phone.

const open = async (page: Page, lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=triangle`);
  await expect(page.locator('[data-canvas2d]')).toBeVisible();
};
const features = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('the triangle, its angle mark and its measures as text', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-element="tri"]')).toBeVisible();
  await expect(page.locator('[data-kind="angle"]')).toBeVisible();
  await expect(features(page)).toContainText('ABC: area 4.5');
  await expect(features(page)).toContainText('ABC: perimeter 10.24');
  await expect(features(page)).toContainText('Angle B: angle 90 degrees');
});

test('moving a corner with the arrow keys updates the measures live', async ({ page }) => {
  await open(page);
  const c = page.locator('[data-handle="c"]');
  await c.focus();
  await page.keyboard.press('ArrowUp');
  await expect(features(page)).toContainText('ABC: area 5.25');
  await expect(features(page)).toContainText('Angle B: angle 90 degrees');
  await expect(page.locator('#param-cy')).toHaveValue('2.5');
  await page.keyboard.press('ArrowRight');
  await expect(features(page)).not.toContainText('Angle B: angle 90 degrees');
});

test('dragging a corner with the pointer moves its parameters', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="a"]');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y + 30, { steps: 5 });
  await page.mouse.up();
  expect(Number(await page.locator('#param-ax').inputValue())).toBeLessThan(-4);
  expect(Number(await page.locator('#param-ay').inputValue())).toBeLessThan(-1);
});

test('Next shows the reflection, then the rotation, then the scaling', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-kind="image"]')).toHaveCount(0);
  await next(page).click();
  await expect(page.locator('[data-element="reflect"]')).toBeVisible();
  await expect(features(page)).toContainText('Reflected: the image has corners (4, −1) (1, −1) (1, 2)');
  await next(page).click();
  await expect(page.locator('[data-element="reflect"]')).toHaveCount(0);
  await expect(page.locator('[data-element="turn"]')).toBeVisible();
  await slide(page, 'rot', 180);
  await expect(features(page)).toContainText('Turned: the image has corners (4, 1) (1, 1) (1, −2)');
  await next(page).click();
  await expect(page.locator('[data-element="grow"]')).toBeVisible();
  await expect(features(page)).toContainText('Scaled: the image has corners (−8, −2) (−2, −2) (−2, 4)');
});

test('Urdu: the measures are in Urdu and the picture stays left to right', async ({ page }) => {
  await open(page, 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(features(page)).toContainText('زاویہ 90 درجے');
  await expect(page.locator('[data-canvas2d]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
});

test('a phone has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
