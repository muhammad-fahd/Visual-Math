import { test, expect, type Page } from '@playwright/test';

// The surfaces z = f(x, y) in a real browser (Story 4.5), through the topic harness page (VM_HARNESS=1): the surface and its
// probe in words and in the picture, the sliders, the steps, the three tiers, rotation from the keyboard, Urdu and a phone.

const open = async (page: Page, topic = 'bowlTopic', lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator('[data-surface-viewer]')).not.toHaveAttribute('data-tier', 'pending');
};
const tier = (page: Page) => page.locator('[data-surface-viewer]');
const facts = (page: Page) => page.getByTestId('features');
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const slide = (page: Page, id: string, value: number) =>
  page.locator(`#param-${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
const noWebgl = (page: Page) =>
  page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });
function watchThree(page: Page) {
  const found: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() !== 'script') return;
    void r.text().then((body) => {
      if (body.includes('WebGLRenderer')) found.push(r.url());
    }, () => undefined);
  });
  return found;
}

test('the bowl: the window, the heights, the probe and both slopes, in words and in the readout', async ({ page }) => {
  await open(page);
  await expect(facts(page)).toContainText('The surface is drawn for x from −2 to 2 and y from −2 to 2.');
  await expect(facts(page)).toContainText('The height z goes from 0 to 8.');
  // The first step puts the probe at the origin.
  await expect(facts(page)).toContainText('At (x, y) = (0, 0) the height is z = 0.');
  await next(page).click();
  await expect(facts(page)).toContainText('At (x, y) = (2, 2) the height is z = 8.');
  await expect(facts(page)).toContainText('The slope along x is 4 and the slope along y is 4.');
  await expect(page.locator('[data-readout="z"]')).toHaveText('8.00');
});

test('a slider moves the probe, the readout and the words together', async ({ page }) => {
  await open(page);
  await slide(page, 'px', 1);
  await slide(page, 'py', 0);
  await expect(facts(page)).toContainText('At (x, y) = (1, 0) the height is z = 1.');
  await expect(facts(page)).toContainText('The slope along x is 2 and the slope along y is 0.');
  await expect(page.locator('[data-readout="z"]')).toHaveText('1.00');
});

test('the steps: the origin, then (2, 2), then a negative slope', async ({ page }) => {
  await open(page);
  await expect(facts(page)).toContainText('At (x, y) = (0, 0) the height is z = 0.');
  await next(page).click();
  await expect(facts(page)).toContainText('At (x, y) = (2, 2) the height is z = 8.');
  await next(page).click();
  await expect(facts(page)).toContainText('The slope along x is −4 and the slope along y is 2.');
});

test('the saddle: the slopes are the other coordinate', async ({ page }) => {
  await open(page, 'saddleTopic');
  await next(page).click();
  await expect(facts(page)).toContainText('At (x, y) = (2, 1) the height is z = 2.');
  await expect(page.locator('[data-readout="sx"]')).toHaveText('1.00');
  await expect(page.locator('[data-readout="sy"]')).toHaveText('2.00');
});

test('the slider in the formula bends the whole surface', async ({ page }) => {
  await open(page, 'bendTopic');
  await expect(facts(page)).toContainText('The height z goes from 0 to 8.');
  await slide(page, 'a', -1);
  await expect(facts(page)).toContainText('The height z goes from −4 to 4.');
  await expect(page.locator('[data-readout="z"]')).toHaveText('0.00');
});

test('the light picture is the same surface as SVG and never downloads three.js', async ({ page }) => {
  const three = watchThree(page);
  await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-tier', 'B');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-space-2d] [data-patch="surface"]').first()).toBeAttached();
  await expect(page.locator('[data-space-2d] [data-seg="wire"]').first()).toBeAttached();
  await expect(page.locator('[data-space-2d] [data-mark="probe"]')).toHaveCount(1);
  expect(three).toEqual([]);
});

test('no WebGL: a plain message and the same picture, and the sliders still work', async ({ page }) => {
  await noWebgl(page);
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-tier', 'C');
  await expect(page.getByTestId('tier-message')).toContainText('cannot show the 3D picture');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-space-2d] [data-patch="surface"]').first()).toBeAttached();
  await slide(page, 'px', 1);
  await expect(facts(page)).toContainText('At (x, y) = (1, 0) the height is z = 1.');
});

test('Tier A loads three.js and draws one canvas without a script error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const three = watchThree(page);
  await open(page);
  await expect.poll(() => three.length).toBeGreaterThan(0);
  await expect(tier(page)).toHaveAttribute('data-tier', 'A');
  await expect(tier(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('turning the view with the keyboard moves the surface and never the numbers', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vm.tier', 'light')); // the flat picture, so the quads can be read
  await open(page);
  const corner = () => page.locator('[data-space-2d] [data-patch="surface"]').first().evaluate((el) => el.getAttribute('points'));
  const before = await corner();
  await page.getByRole('img', { name: /interactive picture/ }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(corner).not.toBe(before);
  await expect(facts(page)).toContainText('At (x, y) = (0, 0) the height is z = 0.');
  await expect(page.locator('[data-readout="z"]')).toHaveText('0.00');
});

test('Urdu: Urdu sentences, the page mirrors, the picture stays left to right', async ({ page }) => {
  await open(page, 'bowlTopic', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(facts(page)).toContainText('اونچائی');
  await expect(page.locator('[data-surface-viewer] [dir="ltr"]').first()).toBeAttached();
});

test('on a phone nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});
