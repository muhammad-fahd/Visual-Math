import { test, expect, type Page } from '@playwright/test';

// The statistics scenes in a real browser (Story 3.6), through the harness page (VM_HARNESS=1): the normal
// distribution's shaded probability follows the mean and standard deviation, the die's results are the same every
// time and grow with the trials, Urdu and a phone.

const open = async (page: Page, topic: 'normal' | 'dice', lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator('[data-number-model]')).toBeVisible();
};
const shows = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('the normal distribution starts with 0.6827 shaded: one standard deviation either side', async ({ page }) => {
  await open(page, 'normal');
  await expect(shows(page)).toContainText('A normal distribution with mean 0 and standard deviation 1.');
  await expect(shows(page)).toContainText('The probability of a value from −1 to 1 is 0.6827.');
});

test('the standard deviation and mean sliders reshape it and move the probability', async ({ page }) => {
  await open(page, 'normal');
  await slide(page, 'sg', 2);
  await expect(shows(page)).toContainText('standard deviation 2');
  await expect(shows(page)).toContainText('is 0.3829.');
  await slide(page, 'sg', 1);
  await slide(page, 'mu', 1);
  await expect(shows(page)).toContainText('mean 1 and');
  await expect(shows(page)).toContainText('is 0.4772.');
});

test('Next widens the range to two standard deviations: 0.9545', async ({ page }) => {
  await open(page, 'normal');
  await next(page).click();
  await expect(shows(page)).toContainText('The probability of a value from −2 to 2 is 0.9545.');
});

test('the die starts with 6 rolls and six counts, the same on every load', async ({ page }) => {
  await open(page, 'dice');
  await expect(shows(page)).toContainText('6 rolls of a die.');
  const first = await shows(page).innerText();
  expect((first.match(/\(\d+(\.\d)?%\)/g) ?? []).length).toBe(6);
  await page.reload();
  await expect(page.locator('[data-number-model]')).toBeVisible();
  expect(await shows(page).innerText()).toBe(first);
});

test('more trials extend the same experiment: 600 rolls, and back to 6 gives the same counts', async ({ page }) => {
  await open(page, 'dice');
  const at6 = await shows(page).innerText();
  await slide(page, 'tr', 600);
  await expect(shows(page)).toContainText('600 rolls of a die.');
  await expect(shows(page)).toContainText('Each result is expected 16.7% of the time.');
  await slide(page, 'tr', 6);
  await expect(shows(page)).toContainText('6 rolls of a die.');
  expect(await shows(page).innerText()).toBe(at6);
});

test('Urdu: the words are Urdu and the charts stay left to right', async ({ page }) => {
  await open(page, 'dice', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(shows(page)).toContainText('پانسے کی 6 چالیں۔');
  await expect(page.locator('[data-number-model]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
});

test('a phone has no horizontal scroll, for both scenes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const topic of ['normal', 'dice'] as const) {
    await open(page, topic);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
