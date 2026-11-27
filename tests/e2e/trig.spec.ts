import { test, expect, type Page } from '@playwright/test';

// The trigonometry scenes in a real browser (Story 3.5), through the harness page (VM_HARNESS=1): the unit
// circle's angle by slider, keyboard and pointer (with snapping to special angles), the right triangle's ratios as
// its sides change, Urdu and a phone.

const open = async (page: Page, topic: 'circle' | 'triangle3', lang = 'en') => {
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

/** The screen position of a point of the picture (a 400 by 300 box). */
const screenOf = (page: Page, x: number, y: number) =>
  page.locator('[data-number-model]').evaluate(
    (svg, [px, py]) => {
      const el = svg as unknown as SVGSVGElement;
      const p = el.createSVGPoint();
      p.x = px as number;
      p.y = py as number;
      const s = p.matrixTransform(el.getScreenCTM()!);
      return { x: s.x, y: s.y };
    },
    [x, y],
  );

test('the unit circle starts at 30 degrees with its values in words', async ({ page }) => {
  await open(page, 'circle');
  await expect(shows(page)).toContainText('The angle is 30 degrees, which is π/6 radians.');
  await expect(shows(page)).toContainText('Sine is 0.5 (1/2).');
  await expect(shows(page)).toContainText('Cosine is 0.866 (√3/2).');
  await expect(shows(page)).toContainText('The point is in quadrant 1.');
});

test('the angle slider moves the point: 150 degrees is in quadrant 2 with a negative cosine', async ({ page }) => {
  await open(page, 'circle');
  await slide(page, 'angle', 150);
  await expect(shows(page)).toContainText('Cosine is −0.866 (−√3/2).');
  await expect(shows(page)).toContainText('The point is in quadrant 2.');
  await slide(page, 'angle', 90);
  await expect(shows(page)).toContainText('Tangent is undefined at this angle.');
});

test('the point moves with the arrow keys, Page Up and Page Down, Home and End', async ({ page }) => {
  await open(page, 'circle');
  const handle = page.locator('[data-handle="angle"]');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(shows(page)).toContainText('The angle is 31 degrees');
  await page.keyboard.press('PageUp');
  await expect(shows(page)).toContainText('The angle is 45 degrees');
  await page.keyboard.press('PageDown');
  await expect(shows(page)).toContainText('The angle is 30 degrees');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(shows(page)).toContainText('The angle is 40 degrees');
  await page.keyboard.press('End');
  await expect(shows(page)).toContainText('The angle is 360 degrees');
  await page.keyboard.press('Home');
  await expect(shows(page)).toContainText('The angle is 0 degrees');
  await expect(handle).toHaveAttribute('aria-valuetext', /^0 degrees, sine 0, cosine 1$/);
});

test('dragging the point with the pointer sets the angle from its direction, and snaps to a special angle', async ({ page }) => {
  await open(page, 'circle');
  const handle = page.locator('[data-handle="angle"]');
  const box = (await handle.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // the circle is centred at (105, 150) with radius 85 while the wave is shown
  const at = (deg: number) => screenOf(page, 105 + 85 * Math.cos((deg * Math.PI) / 180), 150 - 85 * Math.sin((deg * Math.PI) / 180));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const to = await at(47);
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(shows(page)).toContainText('The angle is 45 degrees'); // 47 is within 3 of 45
  await page.locator('[data-handle="angle"]').focus();
  const h2 = (await page.locator('[data-handle="angle"]').boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
  await page.mouse.down();
  const to2 = await at(200);
  await page.mouse.move(to2.x, to2.y, { steps: 8 });
  await page.mouse.up();
  await expect(shows(page)).toContainText('The angle is 200 degrees'); // not near a special angle: no snap
});

test('Reset all brings the angle back to 30 degrees', async ({ page }) => {
  await open(page, 'circle');
  await slide(page, 'angle', 200);
  await page.getByRole('button', { name: 'Reset all' }).first().click();
  await expect(shows(page)).toContainText('The angle is 30 degrees');
});

test('the right triangle: sides 4 and 3, then the ratios appear with Next, and a longer opposite side changes them', async ({ page }) => {
  await open(page, 'triangle3');
  await expect(shows(page)).toContainText('The adjacent side is 4, the opposite side is 3 and the hypotenuse is 5. The angle is 36.87 degrees.');
  await expect(shows(page)).not.toContainText('sine = opposite');
  await next(page).click();
  await expect(shows(page)).toContainText('sine = opposite / hypotenuse = 3 / 5 = 0.6.');
  await expect(shows(page)).toContainText('cosine = adjacent / hypotenuse = 4 / 5 = 0.8.');
  await slide(page, 'opp', 4);
  await expect(shows(page)).toContainText('tangent = opposite / adjacent = 4 / 4 = 1.');
  await expect(shows(page)).toContainText('The angle is 45 degrees.');
});

test('Urdu: the words are Urdu and the pictures stay left to right', async ({ page }) => {
  await open(page, 'circle', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(shows(page)).toContainText('سائن');
  await expect(page.locator('[data-number-model]').locator('xpath=..')).toHaveAttribute('dir', 'ltr');
  await open(page, 'triangle3', 'ur');
  await expect(shows(page)).toContainText('ملحق ضلع 4');
});

test('a phone has no horizontal scroll, for both scenes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const topic of ['circle', 'triangle3'] as const) {
    await open(page, topic);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
