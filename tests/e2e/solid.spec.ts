import { test, expect, type Page } from '@playwright/test';

// The solid viewer in a real browser (Story 2.4), through the cone harness page (VM_HARNESS=1): sliders,
// typed values, live formulas, view toggles, the three tiers and the lazy 3D chunk. 30 fps on a
// mid-range phone is not measured here: that is spike 1, on real devices.

const open = async (page: Page, lang = 'en') => {
  await page.goto(`/${lang}/dev/solid`);
  await expect(page.locator('[data-solid-viewer]')).not.toHaveAttribute('data-tier', 'pending');
};
const slider = (page: Page, id: string) => page.locator(`#param-${id}`);
const typed = (page: Page, id: string) => page.locator(`input[data-typed="${id}"]`);
const volume = (page: Page) => page.locator('[data-readout="volume"]');
const dimension = (page: Page, id: string) => page.locator(`[data-dimension="${id}"]`);
const tier = (page: Page) => page.locator('[data-solid-viewer]');

/** Sets a range input the way a drag does: through its own input event, so React sees it. */
const slide = (page: Page, id: string, value: number) =>
  slider(page, id).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

/** Which scripts the page downloaded that contain three.js (its renderer's name). */
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

const cspProblems = (page: Page) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (/content security policy|refused to (load|execute|apply)/i.test(m.text())) problems.push(m.text());
  });
  return problems;
};

test.describe('the picture, sliders and live numbers', () => {
  test('the cone starts at r 3, h 10 with its labels, volume and formula (FR-3.5, 3.8)', async ({ page }) => {
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'A');
    await expect(dimension(page, 'r')).toHaveText('r = 3');
    await expect(dimension(page, 'h')).toHaveText('h = 10');
    await expect(dimension(page, 'l')).toContainText('l = 10.4');
    await expect(volume(page)).toHaveText('94.2');
    await expect(page.locator('[data-formula="f1"]')).toContainText('94.2');
    await expect(page.locator('[data-formula="f1"] .katex-mathml')).toContainText('cm');
  });

  test('moving the height slider changes the labels, the volume and the formula together', async ({ page }) => {
    await open(page);
    await slide(page, 'h', 6);
    await expect(dimension(page, 'h')).toHaveText('h = 6');
    await expect(volume(page)).toHaveText('56.5'); // pi * 9 * 6 / 3
    await expect(page.locator('[data-formula="f1"]')).toContainText('56.5');
    await expect(page.locator('[data-formula="f1"]')).toContainText('6.0');
  });

  test('the slider snaps to its step and stays in range from the keyboard', async ({ page }) => {
    await open(page);
    const s = slider(page, 'r');
    await s.focus();
    await page.keyboard.press('End');
    await expect(volume(page)).toHaveText('670.2'); // r 8, h 10
    await page.keyboard.press('Home');
    await expect(dimension(page, 'r')).toHaveText('r = 1');
    await page.keyboard.press('ArrowRight');
    await expect(dimension(page, 'r')).toHaveText('r = 1.5');
  });

  test('a slider redraw is quick: the numbers, labels and picture settle within 100 ms (NFR-1.2, FR-3.6)', async ({ page }) => {
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    const times = await slider(page, 'h').evaluate(async (el) => {
      const input = el as HTMLInputElement;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const out: number[] = [];
      // The first change warms up the shaders; it is not the redraw a visitor feels.
      for (const v of [4, 5, 8, 12, 3, 9, 6, 11]) {
        const t0 = performance.now();
        set.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        out.push(performance.now() - t0);
      }
      return out.slice(1);
    });
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)]!).toBeLessThan(100); // the median
  });

  test('it is the sliders that change the solid, not the toggles: labels, wireframe and axes leave the camera alone (FR-3.9)', async ({ page }) => {
    await open(page);
    const ends = () => page.locator('[data-solid-2d] line.stroke-accent').evaluateAll((els) => els.map((e) => [e.getAttribute('x1'), e.getAttribute('y1'), e.getAttribute('x2'), e.getAttribute('y2')].join(',')));
    // Turn the picture with the keyboard, then flip every toggle.
    const surface = page.getByRole('img', { name: /interactive picture/ });
    await surface.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    const before = await ends();
    expect(before.length).toBeGreaterThan(0);
    for (const name of ['Wireframe', 'Transparent', 'Solid', 'Axes', 'Labels', 'Labels']) await page.getByRole('button', { name, exact: true }).click();
    expect(await ends()).toEqual(before);
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Labels', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Labels hides and shows the dimensions; Axes draws three lines', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Labels', exact: true }).click();
    await expect(dimension(page, 'h')).toHaveCount(0);
    await page.getByRole('button', { name: 'Labels', exact: true }).click();
    await expect(dimension(page, 'h')).toHaveCount(1);
    await expect(page.locator('[data-solid-2d] text.fill-text').filter({ hasText: /^[xyz]$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Axes', exact: true }).click();
    await expect(page.locator('[data-solid-2d] text.fill-text').filter({ hasText: /^[xyz]$/ })).toHaveCount(3);
  });

  test('Esc from the toolbar goes to the first slider', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Reset view' }).focus();
    await page.keyboard.press('Escape');
    await expect(slider(page, 'r')).toBeFocused();
  });

  test('the readout is announced once, after the slider stops (500 ms)', async ({ page }) => {
    await open(page);
    const live = page.getByTestId('readout-live');
    await expect(live).toHaveText('');
    await slide(page, 'h', 4);
    await slide(page, 'h', 5);
    await expect(live).toHaveText('Volume (cm³): 47.1');
  });
});

test.describe('typed values (FR-3.7)', () => {
  test('a number in range is accepted and the slider follows', async ({ page }) => {
    await open(page);
    await typed(page, 'h').fill('7.5');
    await expect(slider(page, 'h')).toHaveValue('7.5');
    await expect(dimension(page, 'h')).toHaveText('h = 7.5');
  });

  test('a decimal can be typed key by key: "7." stays "7." until the visitor finishes', async ({ page }) => {
    await open(page);
    const box = typed(page, 'h');
    await box.fill('');
    await box.pressSequentially('7.');
    await expect(box).toHaveValue('7.');
    await box.pressSequentially('5');
    await expect(box).toHaveValue('7.5');
    await expect(slider(page, 'h')).toHaveValue('7.5');
    await box.press('Enter');
    await expect(box).toHaveValue('7.5');
  });

  test('a half-typed number that is out of range waits for Enter before it complains', async ({ page }) => {
    await open(page);
    const box = typed(page, 'h');
    await box.fill('');
    await box.pressSequentially('12');
    await expect(page.getByTestId('error-h')).toHaveCount(0);
    await expect(slider(page, 'h')).toHaveValue('12');
    await box.pressSequentially('0');
    await expect(page.getByTestId('error-h')).toHaveCount(0); // 120 is out of range, but nothing is said mid-typing
    await expect(slider(page, 'h')).toHaveValue('12'); // and the last good value is kept
    await box.press('Enter');
    await expect(page.getByTestId('error-h')).toBeVisible();
    await expect(box).toHaveValue('12');
  });

  test('Urdu digits are accepted', async ({ page }) => {
    await open(page, 'ur');
    await typed(page, 'h').fill('٧٫٥');
    await expect(slider(page, 'h')).toHaveValue('7.5');
  });

  test('out of range is rejected with a short message and the old value is kept', async ({ page }) => {
    await open(page);
    await typed(page, 'h').fill('99');
    await typed(page, 'h').press('Enter');
    await expect(page.getByTestId('error-h')).toHaveText('Enter a number from 1 to 15.');
    await expect(slider(page, 'h')).toHaveValue('10');
    await expect(typed(page, 'h')).toHaveValue('10');
    await expect(typed(page, 'h')).toHaveAttribute('aria-invalid', 'true');
    await expect(volume(page)).toHaveText('94.2');
    // Typing something good clears it.
    await typed(page, 'h').fill('9');
    await expect(page.getByTestId('error-h')).toHaveCount(0);
  });

  for (const junk of ['abc', '1e999', '', '3+4']) {
    test(`${JSON.stringify(junk)} is rejected and the old value is kept`, async ({ page }) => {
      await open(page);
      await typed(page, 'r').fill(junk);
      await typed(page, 'r').press('Enter');
      await expect(page.getByTestId('error-r')).toBeVisible();
      await expect(slider(page, 'r')).toHaveValue('3');
    });
  }
});

test.describe('tiers and the 3D chunk (AD-13)', () => {
  test('Tier A loads three.js; the picture has a canvas', async ({ page }) => {
    const three = watchThree(page);
    const csp = cspProblems(page);
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'A');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(() => three.length).toBeGreaterThan(0);
    expect(csp).toEqual([]);
  });

  test('a page with no 3D picture never downloads three.js (NFR-1.3)', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/en/dev/frame');
    await expect(page.getByTestId('view')).not.toBeEmpty();
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    expect(three).toEqual([]);
  });

  test('no WebGL: a plain message and a flat picture, and the sliders and formulas still work (FR-3.14, NFR-4.3)', async ({ page }) => {
    const three = watchThree(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
        if (/webgl/i.test(kind)) return null;
        return (original as (...a: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof original;
    });
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'C');
    await expect(page.getByTestId('tier-message')).toContainText('cannot show the 3D picture');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('[data-solid-2d] polygon').first()).toBeVisible();
    await slide(page, 'h', 6);
    await expect(volume(page)).toHaveText('56.5');
    await expect(page.locator('[data-formula="f1"]')).toContainText('56.5');
    expect(three).toEqual([]);
  });

  test('a light picture chosen on this device is remembered, and three.js is never downloaded for it', async ({ page }) => {
    const three = watchThree(page);
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'B');
    await expect(page.getByTestId('tier-light')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(three).toEqual([]);
    await page.getByRole('button', { name: 'Use the 3D picture' }).click();
    await expect(tier(page)).toHaveAttribute('data-tier', 'A');
    expect(await page.evaluate(() => localStorage.getItem('vm.tier'))).toBeNull();
  });

  test('a lost graphics context falls back to the flat picture with the message', async ({ page }) => {
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'A');
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    await page.locator('canvas').evaluate((c) => {
      const gl = (c as HTMLCanvasElement).getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(tier(page)).toHaveAttribute('data-tier', 'C');
    await expect(page.getByTestId('tier-message')).toContainText('The 3D picture stopped');
    await slide(page, 'h', 6);
    await expect(volume(page)).toHaveText('56.5');
  });

  test('when the 3D picture is slow, the light picture is offered after 8 seconds and can be chosen', async ({ page }) => {
    test.setTimeout(60_000);
    // Hold back the chunk that carries three.js, so the first frame cannot arrive in time.
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('WebGLRenderer')) await new Promise((r) => setTimeout(r, 12_000));
      await route.fulfill({ response, body });
    });
    await open(page);
    await expect(page.getByTestId('tier-offer')).toHaveCount(0);
    await expect(page.getByTestId('tier-offer')).toBeVisible({ timeout: 12_000 });
    await page.getByRole('button', { name: 'Use light picture' }).click();
    await expect(tier(page)).toHaveAttribute('data-tier', 'B');
    expect(await page.evaluate(() => localStorage.getItem('vm.tier'))).toBe('light');
    await slide(page, 'h', 6);
    await expect(volume(page)).toHaveText('56.5');
  });

  test('keep waiting dismisses the offer and the 3D picture still arrives', async ({ page }) => {
    test.setTimeout(60_000);
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('WebGLRenderer')) await new Promise((r) => setTimeout(r, 11_000));
      await route.fulfill({ response, body });
    });
    await open(page);
    await expect(page.getByTestId('tier-offer')).toBeVisible({ timeout: 12_000 });
    await page.getByRole('button', { name: 'Keep waiting' }).click();
    await expect(page.getByTestId('tier-offer')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId('tier-offer')).toHaveCount(0);
  });
});

test.describe('Tier A under real input and failure', () => {
  test('dragging the 3D picture turns it: the dimension lines move; the wheel zooms them', async ({ page }) => {
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    const lines = () => page.locator('[data-solid-2d] line.stroke-accent').evaluateAll((els) => els.map((e) => e.getAttribute('x2')).join(','));
    const before = await lines();
    const box = (await page.getByRole('img', { name: /interactive picture/ }).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy, { steps: 6 });
    await page.mouse.up();
    await expect.poll(lines).not.toBe(before);
    const turned = await lines();
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await expect.poll(lines).not.toBe(turned);
  });

  test('if the 3D chunk cannot be downloaded, the page shows the plain message and the flat picture, not an error', async ({ page }) => {
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('WebGLRenderer')) await route.abort('failed');
      else await route.fulfill({ response, body });
    });
    await open(page);
    await expect(tier(page)).toHaveAttribute('data-tier', 'C');
    await expect(page.getByTestId('tier-message')).toBeVisible();
    await expect(page.locator('[data-solid-2d] polygon').first()).toBeVisible();
    await slide(page, 'h', 6);
    await expect(volume(page)).toHaveText('56.5');
  });

  test('with storage blocked the light picture can still be chosen for the visit', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      const refuse = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      Storage.prototype.getItem = refuse;
      Storage.prototype.setItem = refuse;
      Storage.prototype.removeItem = refuse;
    });
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('WebGLRenderer')) await new Promise((r) => setTimeout(r, 12_000));
      await route.fulfill({ response, body });
    });
    await open(page);
    await expect(page.getByTestId('tier-offer')).toBeVisible({ timeout: 12_000 });
    await page.getByRole('button', { name: 'Use light picture' }).click();
    await expect(tier(page)).toHaveAttribute('data-tier', 'B');
    await slide(page, 'h', 6);
    await expect(volume(page)).toHaveText('56.5');
  });
});

test.describe('Urdu', () => {
  test('the page mirrors, the picture and its numbers do not', async ({ page }) => {
    await open(page, 'ur');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    expect(await page.locator('[data-solid-2d]').evaluate((el) => getComputedStyle(el.parentElement!).direction)).toBe('ltr');
    await expect(dimension(page, 'h')).toHaveText('h = 10');
    await expect(volume(page)).toHaveText('94.2');
    expect(await volume(page).evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    expect(await page.locator('[data-formula="f1"] span').first().evaluate((el) => el.getAttribute('dir'))).toBe('ltr');
  });
});

// ---- Story 2.5: cross-section, unfold and fill ----

const openTopic = async (page: Page, topic: 'section' | 'net' | 'fill', options: { light?: boolean; lang?: string } = {}) => {
  if (options.light) await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
  await page.goto(`/${options.lang ?? 'en'}/dev/solid?topic=${topic}`);
  await expect(tier(page)).not.toHaveAttribute('data-tier', 'pending');
};
const layer = (page: Page, id: string) => page.locator(`[data-solid-2d] polygon[data-layer="${id}"]`);
const measureOf = (page: Page, id: string) => page.locator(`[data-measure="${id}"]`);
const part = (page: Page, id: string) => page.locator(`[data-part="${id}"]`);
const share = (page: Page) => page.locator('[data-fill-share]');
const noWebgl = (page: Page) =>
  page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });

test.describe('cross-section (FR-3.10)', () => {
  test('a cut across the middle is a circle of half the radius, drawn in the picture and in the side panel', async ({ page }) => {
    await openTopic(page, 'section', { light: true });
    await expect(page.locator('[data-section-shape="circle"]')).toHaveText('Circle');
    await expect(measureOf(page, 'radius')).toHaveText('1.5');
    await expect(measureOf(page, 'area')).toHaveText('7.1');
    await expect(page.locator('[data-section-panel] polygon')).toHaveCount(1);
    await expect(layer(page, 'cut')).toHaveCount(1);
    await expect(layer(page, 'plane').first()).toBeVisible();
    await expect(page.locator('[data-formula="f1"]')).toContainText('1.5');
  });

  test('moving the plane changes the cut, the shape panel and the formula together', async ({ page }) => {
    await openTopic(page, 'section', { light: true });
    await slide(page, 'cut', 4);
    await expect(measureOf(page, 'radius')).toHaveText('0.3');
    await slide(page, 'cut', -4);
    await expect(measureOf(page, 'radius')).toHaveText('2.7');
    await expect(page.locator('[data-formula="f1"]')).toContainText('2.7');
  });

  test('a plane at the tip no longer cuts a shape and says so', async ({ page }) => {
    await openTopic(page, 'section', { light: true });
    await slide(page, 'cut', 5);
    await expect(page.getByTestId('section-miss')).toHaveText('The cutting plane does not touch the solid.');
    await expect(page.locator('[data-section-panel]')).toHaveCount(0);
    await expect(layer(page, 'cut')).toHaveCount(0);
    await expect(layer(page, 'plane').first()).toBeVisible();
  });

  test('the solid is drawn see-through so the cut can be seen, and Solid does not hide it', async ({ page }) => {
    await openTopic(page, 'section', { light: true });
    const opacity = () => page.locator('[data-solid-2d] polygon[data-layer="solid"]').first().evaluate((el) => Number(getComputedStyle(el).fillOpacity));
    expect(await opacity()).toBeLessThan(0.3);
    await page.getByRole('button', { name: 'Transparent', exact: true }).click();
    expect(await opacity()).toBeLessThan(0.3);
  });

  test('Tier A draws it too, with no error, and the plane reads on the picture of every tier', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openTopic(page, 'section');
    await expect(tier(page)).toHaveAttribute('data-tier', 'A');
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    await slide(page, 'cut', 2);
    await expect(measureOf(page, 'radius')).toHaveText('0.9');
    expect(errors).toEqual([]);
  });

  test('without WebGL the panel and the numbers are still there', async ({ page }) => {
    await noWebgl(page);
    await openTopic(page, 'section');
    await expect(tier(page)).toHaveAttribute('data-tier', 'C');
    await expect(page.locator('[data-section-shape="circle"]')).toBeVisible();
    await expect(layer(page, 'cut')).toHaveCount(1);
  });

  test('the readout names the shape for assistive technology after the plane stops', async ({ page }) => {
    await openTopic(page, 'section', { light: true });
    const live = page.getByTestId('readout-live');
    await slide(page, 'cut', 3);
    await expect(live).toContainText('Circle');
    await expect(live).toContainText('Radius 0.6');
  });
});

test.describe('the net (FR-3.11)', () => {
  test('folded it is the solid; its parts already add up to the surface area', async ({ page }) => {
    await openTopic(page, 'net', { light: true });
    await expect(slider(page, 'u')).toHaveValue('0');
    await expect(layer(page, 'solid').first()).toBeVisible();
    await expect(layer(page, 'net')).toHaveCount(0);
    await expect(part(page, 'base')).toHaveText('28.3');
    await expect(part(page, 'top')).toHaveText('28.3');
    await expect(part(page, 'lateral')).toHaveText('94.2');
    await expect(part(page, 'total')).toHaveText('150.8');
    await expect(page.locator('[data-formula="f1"]')).toContainText('150.8');
  });

  test('Unfold plays forward to the flat net, Fold plays it back', async ({ page }) => {
    await openTopic(page, 'net', { light: true });
    await page.getByRole('button', { name: 'Unfold', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect.poll(async () => Number(await slider(page, 'u').inputValue()), { timeout: 5000 }).toBe(1);
    await expect(layer(page, 'net')).toHaveCount(34); // the strip of 32 quads is 32 panels with two discs hanging from the first
    await expect(layer(page, 'solid')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await expect(dimension(page, 'r')).toHaveCount(0); // the dimension lines belong to the folded solid
    await page.getByRole('button', { name: 'Fold', exact: true }).click();
    await expect.poll(async () => Number(await slider(page, 'u').inputValue()), { timeout: 5000 }).toBe(0);
    await expect(layer(page, 'net')).toHaveCount(0);
    await expect(layer(page, 'solid').first()).toBeVisible();
  });

  test('Pause stops it where it is, and the slider scrubs by hand', async ({ page }) => {
    await openTopic(page, 'net', { light: true });
    await page.getByRole('button', { name: 'Unfold', exact: true }).click();
    await expect.poll(async () => Number(await slider(page, 'u').inputValue())).toBeGreaterThan(0.1);
    await page.getByRole('button', { name: 'Pause' }).click();
    const stopped = Number(await slider(page, 'u').inputValue());
    expect(stopped).toBeGreaterThan(0);
    expect(stopped).toBeLessThan(1);
    await page.waitForTimeout(400);
    expect(Number(await slider(page, 'u').inputValue())).toBe(stopped);
    await slide(page, 'u', 0.5);
    await expect(layer(page, 'net').first()).toBeVisible();
    await expect(part(page, 'total')).toHaveText('150.8');
  });

  test('touching the slider while it plays takes over from the animation', async ({ page }) => {
    await openTopic(page, 'net', { light: true });
    await page.getByRole('button', { name: 'Unfold', exact: true }).click();
    await slide(page, 'u', 0.2);
    await page.waitForTimeout(700);
    expect(Number(await slider(page, 'u').inputValue())).toBe(0.2);
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  });

  test('the parts follow the measurements', async ({ page }) => {
    await openTopic(page, 'net', { light: true });
    await slide(page, 'r', 6);
    await expect(part(page, 'base')).toHaveText('113.1');
    await expect(part(page, 'lateral')).toHaveText('188.5');
    await expect(part(page, 'total')).toHaveText('414.7');
  });

  test('Tier A draws the unfolding without an error and the 3D picture stays', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openTopic(page, 'net');
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    await slide(page, 'u', 0.6);
    await slide(page, 'u', 1);
    await expect(part(page, 'total')).toHaveText('150.8');
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('without WebGL the net still unfolds in the flat picture', async ({ page }) => {
    await noWebgl(page);
    await openTopic(page, 'net');
    await expect(tier(page)).toHaveAttribute('data-tier', 'C');
    await slide(page, 'u', 1);
    await expect(layer(page, 'net')).toHaveCount(34);
  });

  test('a topic without a net or a fill has no Play buttons', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('play')).toHaveCount(0);
    await openTopic(page, 'section', { light: true });
    await expect(page.getByTestId('play')).toHaveCount(0);
  });
});

test.describe('fill (FR-3.12)', () => {
  test('a third of a cylinder is a third of its volume, in words and in the picture', async ({ page }) => {
    await openTopic(page, 'fill', { light: true });
    await expect(share(page)).toHaveText('Filled: 33% of the volume.');
    await expect(layer(page, 'liquid').first()).toBeVisible();
    await expect(volume(page).or(page.locator('[data-readout="liquid"]'))).toHaveText('46.7'); // 33% of 141.4 cm³
  });

  test('Pour in fills it, Pour out empties it', async ({ page }) => {
    await openTopic(page, 'fill', { light: true });
    await page.getByRole('button', { name: 'Pour in' }).click();
    await expect.poll(async () => Number(await slider(page, 'lvl').inputValue()), { timeout: 5000 }).toBe(1);
    await expect(share(page)).toHaveText('Filled: 100% of the volume.');
    await page.getByRole('button', { name: 'Pour out' }).click();
    await expect.poll(async () => Number(await slider(page, 'lvl').inputValue()), { timeout: 5000 }).toBe(0);
    await expect(share(page)).toHaveText('Filled: 0% of the volume.');
    await expect(layer(page, 'liquid')).toHaveCount(0);
  });

  test('the cone formula shows a third of the cylinder', async ({ page }) => {
    await openTopic(page, 'fill', { light: true });
    await expect(page.locator('[data-formula="f1"]')).toContainText('47.1');
  });

  test('Tier A draws it with no error; without WebGL the liquid is still there', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openTopic(page, 'fill');
    await expect(tier(page)).toHaveAttribute('data-ready', 'true');
    await slide(page, 'lvl', 0.66);
    await expect(share(page)).toHaveText('Filled: 66% of the volume.');
    expect(errors).toEqual([]);
  });
});

test.describe('reduced motion (NFR-3.3)', () => {
  test('the animations start finished, and Play jumps between the ends with no frames in between', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTopic(page, 'net', { light: true });
    await expect(slider(page, 'u')).toHaveValue('1');
    await expect(layer(page, 'net')).toHaveCount(34);
    await page.getByRole('button', { name: 'Fold', exact: true }).click();
    await expect(slider(page, 'u')).toHaveValue('0'); // at once: no playing, no Pause button
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    const seen = await slider(page, 'u').evaluate(async (el) => {
      const input = el as HTMLInputElement;
      const values = new Set<string>();
      const stop = performance.now() + 300;
      while (performance.now() < stop) {
        values.add(input.value);
        await new Promise((r) => requestAnimationFrame(r));
      }
      return [...values];
    });
    expect(seen).toEqual(['0']);
    await page.getByRole('button', { name: 'Unfold', exact: true }).click();
    await expect(slider(page, 'u')).toHaveValue('1');
  });

  test('the fill starts full and Pour out jumps to empty', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTopic(page, 'fill', { light: true });
    await expect(share(page)).toHaveText('Filled: 100% of the volume.');
    await page.getByRole('button', { name: 'Pour out' }).click();
    await expect(share(page)).toHaveText('Filled: 0% of the volume.');
  });

  test('with normal motion the topic starts as the author set it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openTopic(page, 'net', { light: true });
    await expect(slider(page, 'u')).toHaveValue('0');
  });
});

test.describe('Urdu', () => {
  test('the parts, the buttons and the shape are in Urdu, the numbers stay left to right', async ({ page }) => {
    await openTopic(page, 'net', { light: true, lang: 'ur' });
    await expect(page.getByRole('button', { name: 'کھولیں' })).toBeVisible();
    expect(await part(page, 'total').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    await openTopic(page, 'section', { light: true, lang: 'ur' });
    await expect(page.locator('[data-section-shape="circle"]')).toHaveText('دائرہ');
  });
});
