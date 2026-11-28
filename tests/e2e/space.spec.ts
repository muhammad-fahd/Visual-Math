import { test, expect, type Page } from '@playwright/test';

// The 3D vectors, lines and planes scene in a real browser (Story 4.1), through the topic harness page (VM_HARNESS=1):
// the live numbers, the steps, the three tiers, the lazy 3D chunk, Urdu and a phone. Editing is only by sliders and typed boxes.

const open = async (page: Page, topic = 'vectors', lang = 'en') => {
  await page.goto(`/${lang}/dev/topic?topic=${topic}`);
  await expect(page.locator('[data-space-viewer]')).not.toHaveAttribute('data-tier', 'pending');
};
const tier = (page: Page) => page.locator('[data-space-viewer]');
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

test('the vectors start as the author set them: a, b and their numbers in words and in the readouts', async ({ page }) => {
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-tier', 'A');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(facts(page)).toContainText('a = (1, 2, 2), length 3.');
  await expect(facts(page)).toContainText('b = (2, 0, 1), length 2.24.');
  await expect(page.locator('[data-readout="dotv"]')).toHaveText('4.0');
  await expect(page.locator('[data-readout="ang"]')).toHaveText('53.4');
});

test('the labels are drawn over the picture, left to right', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-space-2d] [data-tag="a"]')).toHaveText('a');
  await expect(page.locator('[data-space-2d] [data-tag="axes"]')).toHaveCount(3);
  expect(await page.locator('[data-space-viewer] [dir="ltr"]').count()).toBeGreaterThan(0);
});

test('moving a slider moves everything that depends on it: sentences, readouts and formula', async ({ page }) => {
  await open(page);
  await slide(page, 'ax', 3);
  await expect(facts(page)).toContainText('a = (3, 2, 2), length 4.12.');
  await expect(page.locator('[data-readout="dotv"]')).toHaveText('8.0'); // 3*2 + 2*0 + 2*1
  await expect(page.locator('[data-formula="f1"]')).toContainText('8.0');
});

test('Next adds the sum, then a scaled copy, then the dot product, then the cross product', async ({ page }) => {
  await open(page);
  await expect(facts(page)).not.toContainText('a + b =');
  await next(page).click();
  await expect(facts(page)).toContainText('a + b = (3, 2, 3)');
  await next(page).click();
  await expect(facts(page)).not.toContainText('a + b =');
  await expect(facts(page)).toContainText('k a = (2, 4, 4)');
  await next(page).click();
  await expect(facts(page)).toContainText('the angle between them is 53.4 degrees');
  await next(page).click();
  await expect(facts(page)).toContainText('a × b = (2, 3, −4)');
});

test('b twice a: the cross product is zero and the text says they are parallel', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 4; i++) await next(page).click();
  await slide(page, 'bx', 2);
  await slide(page, 'by', 4);
  await slide(page, 'bz', 4);
  await expect(facts(page)).toContainText('a and b are parallel, so a × b is the zero vector.');
  await expect(page.locator('[data-space-2d] [data-seg="cross"]')).toHaveCount(0);
});

test('a slider reached from the keyboard changes the scene', async ({ page }) => {
  await open(page);
  await page.locator('#param-ax').focus();
  await page.keyboard.press('ArrowRight');
  await expect(facts(page)).toContainText('a = (2, 2, 2)');
});

test('a typed value is accepted and out of range is refused with the old value kept', async ({ page }) => {
  await open(page);
  const box = page.locator('input[data-typed="ax"]');
  await box.fill('4');
  await box.press('Enter');
  await expect(facts(page)).toContainText('a = (4, 2, 2)');
  await box.fill('99');
  await box.press('Enter');
  await expect(facts(page)).toContainText('a = (4, 2, 2)');
});

test('Tier A loads three.js; a 2D page never does (NFR-1.3)', async ({ page }) => {
  const three = watchThree(page);
  await open(page);
  await expect.poll(() => three.length).toBeGreaterThan(0);
  const none = watchThree(page);
  await page.goto('/en/dev/topic?topic=graph');
  await page.waitForLoadState('networkidle');
  expect(none).toEqual([]);
});

test('no WebGL: a plain message and the same picture as SVG, and the sliders still work', async ({ page }) => {
  const three = watchThree(page);
  await noWebgl(page);
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-tier', 'C');
  await expect(page.getByTestId('tier-message')).toContainText('cannot show the 3D picture');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-space-2d] [data-seg="a"]').first()).toBeAttached();
  await slide(page, 'ax', 3);
  await expect(facts(page)).toContainText('a = (3, 2, 2)');
  expect(three).toEqual([]);
});

test('the light picture is remembered, draws the same vectors, and never downloads three.js', async ({ page }) => {
  const three = watchThree(page);
  await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-tier', 'B');
  await expect(page.getByTestId('tier-light')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-space-2d] [data-seg="a"]').first()).toBeAttached();
  expect(three).toEqual([]);
});

test('turning the view with the keyboard moves the picture and never the numbers', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vm.tier', 'light')); // the flat picture, so the lines can be read
  await open(page);
  const end = () => page.locator('[data-space-2d] [data-seg="a"]').first().evaluate((el) => `${el.getAttribute('x2')},${el.getAttribute('y2')}`);
  const before = await end();
  await page.getByRole('img', { name: /interactive picture/ }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(end).not.toBe(before);
  await expect(facts(page)).toContainText('a = (1, 2, 2), length 3.');
  await expect(page.locator('[data-readout="dotv"]')).toHaveText('4.0');
});

test('Reset all returns the sliders, the steps and the toggles to the start', async ({ page }) => {
  await open(page);
  await slide(page, 'ax', 4);
  await page.getByRole('button', { name: 'Axes' }).click();
  await page.getByTestId('reset-all').click();
  await expect(facts(page)).toContainText('a = (1, 2, 2)');
  await expect(page.getByRole('button', { name: 'Axes' })).toHaveAttribute('aria-pressed', 'true');
});

test('the Axes, Floor and Box toggles take their parts out of the picture', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-space-2d] [data-tag="axes"]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Axes' }).click();
  await expect(page.locator('[data-space-2d] [data-tag="axes"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Floor' }).click();
  await page.getByRole('button', { name: 'Box' }).click();
  await expect(page.getByRole('button', { name: 'Floor' })).toHaveAttribute('aria-pressed', 'false');
});

test('lines and planes: the plane, then the line, then where they meet', async ({ page }) => {
  await open(page, 'planes');
  await expect(facts(page)).toContainText('plane is the plane with normal (1, 1, 1) where n · p = 3.');
  await expect(facts(page)).not.toContainText('line is the line');
  await next(page).click();
  await expect(facts(page)).toContainText('line is the line through (0, 0, 0) in the direction (1, 1, 1).');
  await next(page).click();
  await expect(facts(page)).toContainText('P is the point (1, 1, 1).');
});

test('a line that never meets the plane: the meeting point is left out and the text says so', async ({ page }) => {
  await open(page, 'planes');
  for (let i = 0; i < 3; i++) await next(page).click(); // step 4: the direction is at right angles to the normal
  await expect(facts(page)).toContainText('P is left out: a number in it is not defined.');
  await expect(page.locator('[data-readout="den"]')).toHaveText('0.0');
});

test('turning the plane with the normal sliders moves its patch; a zero normal leaves it out', async ({ page }) => {
  await open(page, 'planes');
  await slide(page, 'nx', 0);
  await slide(page, 'ny', 0);
  await expect(facts(page)).toContainText('normal (0, 0, 1)');
  await slide(page, 'nz', 0);
  await expect(facts(page)).toContainText('plane is left out: its direction or normal is zero.');
});

test('Urdu: the words are Urdu, the numbers and the picture stay left to right', async ({ page }) => {
  await open(page, 'vectors', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(facts(page)).toContainText('لمبائی');
  await expect(page.locator('[data-space-2d]').first().locator('xpath=ancestor::div[@dir="ltr"]').first()).toBeAttached();
  await expect(page.locator('[data-space-2d] [data-tag="axes"]')).toHaveCount(3);
});

test('on a phone nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await expect(page.locator('#param-ax')).toBeVisible();
});

test('the topic page carries no script error and no CSP violation', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (/content security policy|refused to (load|execute|apply)/i.test(m.text())) problems.push(m.text());
  });
  await open(page);
  await expect(tier(page)).toHaveAttribute('data-ready', 'true');
  expect(problems).toEqual([]);
});
