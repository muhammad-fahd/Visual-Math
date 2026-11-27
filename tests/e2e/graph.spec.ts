import { test, expect, type Page } from '@playwright/test';

// The graph topic in a real browser (Story 3.1), through the harness page (VM_HARNESS=1): the curve and
// what it shows as text, the sliders that move it, the draggable point by pointer and by keyboard, the trace,
// steps that show a hidden curve, Urdu, and no horizontal scroll on a phone.

const open = async (page: Page, lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=graph`);
  await expect(page.locator('[data-canvas2d]')).toBeVisible();
};
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
const features = (page: Page) => page.getByTestId('features');

test('the graph, its legend and what it shows as text', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-element="parabola"]')).toBeVisible();
  await expect(features(page)).toContainText('crosses the x-axis at x = −1, 3');
  await expect(features(page)).toContainText('lowest point at (1, −4)');
  await expect(page.locator('[data-legend="parabola"]')).toContainText('solid line');
  await expect(page.locator('[data-legend="line"]')).toHaveCount(0);
});

test('a slider moves the curve and the text follows', async ({ page }) => {
  await open(page);
  await slide(page, 'c', -8);
  await expect(features(page)).toContainText('crosses the y-axis at y = −8');
  await slide(page, 'a', -1);
  await expect(features(page)).toContainText('highest point at');
});

test('the draggable point moves with the arrow keys, and Reset all brings it back', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="p"]');
  await expect(handle).toHaveAttribute('aria-valuetext', 'x = 2.00, y = −3.00');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(handle).toHaveAttribute('aria-valuetext', 'x = 2.50, y = −2.50');
  await expect(page.locator('#param-px')).toHaveValue('2.5');
  await page.getByRole('button', { name: 'Reset all' }).first().click();
  await expect(handle).toHaveAttribute('aria-valuetext', 'x = 2.00, y = −3.00');
});

test('the draggable point follows a pointer drag', async ({ page }) => {
  await open(page);
  const handle = page.locator('[data-handle="p"]');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y - 40, { steps: 5 });
  await page.mouse.up();
  const px = Number(await page.locator('#param-px').inputValue());
  const py = Number(await page.locator('#param-py').inputValue());
  expect(px).toBeGreaterThan(2);
  expect(py).toBeGreaterThan(-3);
});

test('the trace reads every curve at the cursor', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('trace-values')).toHaveCount(0);
  const trace = page.getByTestId('trace-slider');
  await trace.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('trace-values')).toContainText('At x =');
  await expect(page.getByTestId('trace-values')).toContainText('y = ax');
});

test('Next shows the hidden line in the picture and the legend', async ({ page }) => {
  await open(page);
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await next.click();
  await expect(page.locator('[data-legend="line"]')).toBeVisible();
  await expect(page.locator('[data-element="line"]')).toBeVisible();
});

test('Urdu: the words are Urdu and the picture stays left to right', async ({ page }) => {
  await open(page, 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('legend')).toContainText('منحنیات');
  await expect(page.locator('[data-canvas2d]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
});

test('a phone has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the first-time hint matches what a graph can do: zoom, not turning', async ({ page }) => {
  await open(page);
  await expect(page.getByText('Pinch to zoom.', { exact: true })).toBeVisible();
  await expect(page.getByText('Drag to turn the picture')).toHaveCount(0);
});

test('an address opens the graph at its values, and moving a slider writes the address', async ({ page }) => {
  await page.goto('/en/dev/topic?topic=graph&p.a=2&p.c=-6');
  await expect(page.locator('[data-canvas2d]')).toBeVisible();
  await expect(page.locator('#param-a')).toHaveValue('2');
  await expect(page.locator('#param-c')).toHaveValue('-6');
  await expect(features(page)).toContainText('crosses the y-axis at y = −6');
  await slide(page, 'c', 4);
  await expect.poll(() => page.evaluate(() => window.location.search)).toContain('p.c=4');
});

test('Reset all clears the trace as well as the values', async ({ page }) => {
  await open(page);
  await page.getByTestId('trace-slider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('trace-values')).toBeVisible();
  await page.getByRole('button', { name: 'Reset all' }).first().click();
  await expect(page.getByTestId('trace-values')).toHaveCount(0);
  await expect(page.getByText('Move the trace to read the value of each curve.')).toBeVisible();
});
