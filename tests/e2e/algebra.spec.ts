import { test, expect, type Page } from '@playwright/test';

// The algebra tools in a real browser (Story 3.4), through the harness page (VM_HARNESS=1): the balance scale
// tips and balances as the weight changes, the step solver shows one move at a time, Urdu and a phone.

const open = async (page: Page, topic: 'balance' | 'solver', lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator(topic === 'balance' ? '[data-number-model]' : '[data-algebra-solver]')).toBeVisible();
};
const shows = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('the scale starts tipped to the right, balances at x = 4 and tips left at x = 5', async ({ page }) => {
  await open(page, 'balance');
  await expect(shows(page)).toContainText('The scale tips to the right.');
  await slide(page, 'w', 4);
  await expect(shows(page)).toContainText('The scale is balanced.');
  await expect(shows(page)).toContainText('(that is 11)');
  await slide(page, 'w', 5);
  await expect(shows(page)).toContainText('The scale tips to the left.');
});

test('the steps move the weight: Next, Next reaches the balanced scale', async ({ page }) => {
  await open(page, 'balance');
  await next(page).click();
  await expect(shows(page)).toContainText('when x is 3');
  await next(page).click();
  await expect(shows(page)).toContainText('The scale is balanced.');
  await next(page).click();
  await expect(shows(page)).toContainText('The scale tips to the left.');
});

test('changing the pans changes the equation: 3 x-blocks and 2 ones against 11', async ({ page }) => {
  await open(page, 'balance');
  await slide(page, 'a', 3);
  await slide(page, 'b', 2);
  await expect(shows(page)).toContainText('The left pan holds 3x + 2');
});

test('the solver shows one move, then the move you reveal with the slider, the newest marked', async ({ page }) => {
  await open(page, 'solver');
  await expect(page.locator('[data-algebra-solver] [data-line]')).toHaveCount(1);
  await expect(page.locator('[data-algebra-solver] [data-line="1"]')).toContainText('Start with the equation.');
  await slide(page, 'm', 3);
  await expect(page.locator('[data-algebra-solver] [data-line]')).toHaveCount(3);
  await expect(page.locator('[data-algebra-solver] [data-line="3"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-algebra-solver] [data-line="1"]')).not.toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-algebra-solver] [data-line="3"] .katex')).toBeVisible();
});

test('the steps of the solver reveal moves: Next shows three, Next again shows all five', async ({ page }) => {
  await open(page, 'solver');
  await next(page).click();
  await expect(page.locator('[data-algebra-solver] [data-line]')).toHaveCount(3);
  await next(page).click();
  await expect(page.locator('[data-algebra-solver] [data-line]')).toHaveCount(5);
  await expect(page.locator('[data-algebra-solver] [data-line="5"]')).toContainText('x is alone');
});

test('Urdu: the scale and the solver notes are in Urdu and the picture stays left to right', async ({ page }) => {
  await open(page, 'balance', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(shows(page)).toContainText('ترازو');
  await expect(page.locator('[data-number-model]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
  await open(page, 'solver', 'ur');
  await expect(page.locator('[data-algebra-solver] [data-line="1"]')).toContainText('مساوات سے شروع کریں۔');
});

test('a phone has no horizontal scroll, for the scale and for the solver', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const topic of ['balance', 'solver'] as const) {
    await open(page, topic);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
