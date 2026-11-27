import { test, expect, type Page } from '@playwright/test';

// The topic page in a real browser (Story 2.6), through the harness page (VM_HARNESS=1): the layout of
// SRS 7.2 on a laptop and a phone, the steps, the worked example, Urdu, narrow screens and the keyboard.

type Fixture = 'cone' | 'section' | 'net' | 'fill';

const open = async (page: Page, topic: Fixture = 'section', options: { lang?: string; bare?: boolean; light?: boolean } = {}) => {
  if (options.light !== false) await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
  await page.goto(`/${options.lang ?? 'en'}/dev/topic?topic=${topic}${options.bare ? '&bare=1' : ''}`);
  await expect(page.locator('[data-solid-viewer]')).not.toHaveAttribute('data-tier', 'pending');
};
const slider = (page: Page, id: string) => page.locator(`#param-${id}`);
const slide = (page: Page, id: string, value: number) =>
  slider(page, id).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true });
const back = (page: Page) => page.getByRole('button', { name: 'Back', exact: true });
const radius = (page: Page) => page.locator('[data-measure="radius"]');
const sceneBlock = (page: Page) => page.getByTestId('scene-block');

test.describe('what the page shows (FR-2.1, 2.3, 4.5, 4.7)', () => {
  test('path, title, scene, sliders, steps, formulas, worked example, Try this and Watch out', async ({ page }) => {
    await open(page, 'section');
    const path = page.getByRole('navigation', { name: 'You are here' });
    await expect(path.getByRole('link')).toHaveCount(3);
    await expect(path.getByRole('link').nth(0)).toHaveAttribute('href', '/en/geometry');
    await expect(path.getByRole('link').nth(2)).toHaveAttribute('href', '/en/geometry/solids-volume/cone-sections');
    await expect(path.locator('[aria-current="page"]')).toHaveText('Cutting a Cone');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cutting a Cone');
    await expect(page.locator('[data-solid-viewer]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Measurements' })).toBeVisible();
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
    await expect(page.getByRole('heading', { name: 'Formulas' })).toBeVisible();
    await expect(page.getByTestId('example')).toBeVisible();
    await expect(page.getByTestId('try-this').getByRole('listitem')).toHaveCount(2);
    await expect(page.getByTestId('watch-out')).toContainText('Watch out');
    await expect(page.getByTestId('watch-out')).toContainText('A cut through the tip is a triangle');
  });

  test('Previous and Next topic are links to the neighbours, and absent when there are none', async ({ page }) => {
    await open(page, 'net');
    const nav = page.getByTestId('neighbours');
    await expect(nav.getByRole('link', { name: /Previous topic/ })).toHaveAttribute('href', '/en/dev/topic?topic=section');
    await expect(nav.getByRole('link', { name: /Next topic/ })).toHaveAttribute('href', '/en/dev/topic?topic=fill');
    await expect(nav.getByRole('link', { name: /Cutting a Cone/ })).toBeVisible();
    await open(page, 'net', { bare: true });
    await expect(page.getByTestId('neighbours').getByRole('link')).toHaveCount(0);
  });
});

test.describe('steps (FR-4.2, 4.3)', () => {
  test('Next and Back change the parameter, the cut and the formula together; focus stays on the button', async ({ page }) => {
    await open(page, 'section');
    await expect(slider(page, 'cut')).toHaveValue('0');
    await expect(radius(page)).toHaveText('1.5');
    await next(page).click();
    await expect(page.getByTestId('step-of')).toHaveText('Step 2 of 3');
    await expect(slider(page, 'cut')).toHaveValue('4');
    await expect(radius(page)).toHaveText('0.3');
    await expect(next(page)).toBeFocused();
    await next(page).click();
    await expect(slider(page, 'cut')).toHaveValue('-4');
    await expect(radius(page)).toHaveText('2.7');
    await back(page).click();
    await expect(slider(page, 'cut')).toHaveValue('4');
    await expect(back(page)).toBeFocused();
    await back(page).click();
    await expect(slider(page, 'cut')).toHaveValue('0');
  });

  test('the new step title is announced once, politely', async ({ page }) => {
    await open(page, 'section');
    const live = page.getByTestId('step-live');
    await expect(live).toHaveText('');
    await next(page).click();
    await expect(live).toHaveText('Step 2 of 3: Move the plane up');
    await back(page).click();
    await expect(live).toHaveText('Step 1 of 3: Look at the cone');
  });

  test('the ends are aria-disabled, not disabled, so a press there neither moves nor drops focus', async ({ page }) => {
    await open(page, 'section');
    await expect(back(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('step-edge')).toHaveText('This is the first step.');
    await back(page).click({ force: true }); // Playwright treats aria-disabled as disabled; a visitor can still press it
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
    await next(page).click();
    await next(page).click();
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('step-edge')).toHaveText('This is the last step.');
    await next(page).click({ force: true });
    await expect(page.getByTestId('step-of')).toHaveText('Step 3 of 3');
    await expect(next(page)).toBeFocused();
  });

  test('a value the visitor moved is kept across steps; the others follow', async ({ page }) => {
    await open(page, 'section');
    await slide(page, 'cut', -2);
    await slide(page, 'r', 5);
    await next(page).click(); // step 2 names cut: 4
    await expect(slider(page, 'cut')).toHaveValue('-2');
    await expect(slider(page, 'r')).toHaveValue('5');
    await next(page).click();
    await expect(slider(page, 'cut')).toHaveValue('-2');
  });

  test('tabbing through a box without changing it is not moving it: the next step still moves the value', async ({ page }) => {
    await open(page, 'section');
    const box = page.locator('input[data-typed="cut"]');
    await box.focus();
    await box.press('Tab'); // leaves it as it was
    await box.focus();
    await box.fill('abc'); // refused on leaving: nothing changed
    await box.press('Enter');
    await next(page).click();
    await expect(slider(page, 'cut')).toHaveValue('4');
  });

  test('typing a value counts as moving it', async ({ page }) => {
    await open(page, 'section');
    await page.locator('input[data-typed="cut"]').fill('1');
    await next(page).click();
    await expect(slider(page, 'cut')).toHaveValue('1');
  });

  test('the visitor can explore at any step: sliders and the picture keep working', async ({ page }) => {
    await open(page, 'section');
    await next(page).click();
    await slide(page, 'h', 12);
    await expect(slider(page, 'h')).toHaveValue('12');
    await page.getByRole('img', { name: /interactive picture/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('step-of')).toHaveText('Step 2 of 3'); // exploring does not move the step
  });

  test('a step marks the formulas it uses', async ({ page }) => {
    await open(page, 'section');
    await expect(page.locator('[data-formula="f1"]')).not.toHaveAttribute('data-used', 'true');
    await next(page).click();
    await expect(page.locator('[data-formula="f1"]')).toHaveAttribute('data-used', 'true');
    await expect(page.locator('[data-formula="f1"]')).toContainText('Used in this step');
    await back(page).click();
    await expect(page.locator('[data-formula="f1"]')).not.toHaveAttribute('data-used', 'true');
  });

  test('a step that moves a net, a fill: the parameter the scene plays follows the step', async ({ page }) => {
    await open(page, 'net');
    await next(page).click();
    await expect(slider(page, 'u')).toHaveValue('0.5');
    await next(page).click();
    await expect(slider(page, 'u')).toHaveValue('1');
    await expect(page.locator('[data-part="total"]')).toHaveText('150.8');
    await open(page, 'fill');
    await next(page).click();
    await expect(page.locator('[data-fill-share]')).toHaveText('Filled: 33% of the volume.');
    await next(page).click();
    await expect(page.locator('[data-fill-share]')).toHaveText('Filled: 100% of the volume.');
  });

  test('works with the keyboard alone: Tab to Next, Enter', async ({ page }) => {
    await open(page, 'section');
    await next(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('step-of')).toHaveText('Step 2 of 3');
    await page.keyboard.press('Shift+Tab');
    await expect(back(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
  });
});

test.describe('the worked example (FR-4.4)', () => {
  test('changing an input recomputes every line and the answer', async ({ page }) => {
    await open(page, 'section');
    const example = page.getByTestId('example');
    await expect(example).toContainText('radius 3.0 cm');
    await expect(example.locator('[data-line="1"]')).toContainText('1.5');
    await expect(page.getByTestId('answer')).toContainText('1.5');
    await example.locator('input[data-typed="a"]').fill('5');
    await expect(example.locator('[data-line="1"]')).toContainText('2.5');
    await expect(page.getByTestId('answer')).toContainText('2.5 cm');
    await expect(example).toContainText('radius 5.0 cm');
  });

  test('its inputs refuse what is out of range, take Urdu digits and keep the old value', async ({ page }) => {
    await open(page, 'section');
    const example = page.getByTestId('example');
    const box = example.locator('input[data-typed="a"]');
    await box.fill('99');
    await box.press('Enter');
    await expect(example.getByTestId('error-a')).toBeVisible();
    await expect(box).toHaveValue('3');
    await expect(page.getByTestId('answer')).toContainText('1.5');
    await box.fill('٦');
    await expect(example.locator('#example-a')).toHaveValue('6');
    await expect(page.getByTestId('answer')).toContainText('3.0 cm');
  });

  test('its sliders are separate from the scene: moving one does not move the picture', async ({ page }) => {
    await open(page, 'net');
    const total = page.locator('[data-part="total"]');
    await expect(total).toHaveText('150.8');
    await page.getByTestId('example').locator('#example-a').evaluate((el) => {
      const input = el as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '6');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.getByTestId('example')).toContainText('radius 6.0 cm');
    await expect(total).toHaveText('150.8');
    await expect(slider(page, 'r')).toHaveValue('3');
  });
});

test.describe('layout on a laptop (SRS 7.2)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('the picture fills the left two thirds, the step, sliders and formulas the right third', async ({ page }) => {
    await open(page, 'section');
    const scene = (await sceneBlock(page).boundingBox())!;
    const step = (await page.getByTestId('steps').boundingBox())!;
    const sliders = (await slider(page, 'cut').boundingBox())!;
    const formula = (await page.locator('[data-formula="f1"]').boundingBox())!;
    const main = (await page.getByTestId('layout').boundingBox())!;
    expect(scene.width / main.width).toBeGreaterThan(0.6);
    expect(scene.width / main.width).toBeLessThan(0.7);
    for (const right of [step, sliders, formula]) expect(right.x).toBeGreaterThanOrEqual(scene.x + scene.width - 1);
    expect(step.width / main.width).toBeGreaterThan(0.28);
  });

  test('the wheel over the picture scrolls the page; the picture is not a scroll trap', async ({ page }) => {
    await open(page, 'section');
    const box = (await sceneBlock(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  });

  test('the picture is sticky on a laptop and is still in view when the end of the right column is read', async ({ page }) => {
    await open(page, 'section');
    const css = await sceneBlock(page).evaluate((el) => ({ position: getComputedStyle(el).position, top: getComputedStyle(el).top }));
    expect(css).toEqual({ position: 'sticky', top: '16px' });
    await page.locator('[data-formula="f1"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 400));
    const box = (await sceneBlock(page).boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(100); // not scrolled out of sight
  });
});

test.describe('layout on a phone (SRS 7.2)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the picture sticks to the top, takes at most half the screen, and the sliders sit directly under it', async ({ page }) => {
    await open(page, 'section');
    const position = await sceneBlock(page).evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
    const scene = (await sceneBlock(page).boundingBox())!;
    expect(scene.height).toBeLessThanOrEqual(844 * 0.5 + 1);
    const firstSlider = (await slider(page, 'r').boundingBox())!;
    expect(firstSlider.y).toBeGreaterThanOrEqual(scene.y + scene.height - 1);
    expect(firstSlider.y - (scene.y + scene.height)).toBeLessThan(120); // directly under: only the heading between
    // Scrolled down, the picture is still at the top.
    await page.evaluate(() => window.scrollTo(0, 700));
    const after = (await sceneBlock(page).boundingBox())!;
    expect(after.y).toBeGreaterThanOrEqual(-1);
    expect(after.y).toBeLessThan(5);
  });

  test('every button is at least 44 px', async ({ page }) => {
    await open(page, 'section');
    // A defined word inside a sentence is an inline target (like a link in text), so it is not measured here.
    const heights = await page.locator('main button:not([data-term]), main a').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => ({ text: (e.textContent || '').trim().slice(0, 20), h: e.getBoundingClientRect().height })),
    );
    for (const b of heights) expect(b.h, b.text).toBeGreaterThanOrEqual(43.5);
  });

  test('the order is picture, sliders, then the step', async ({ page }) => {
    await open(page, 'section');
    const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
    const picture = await y('[data-testid="scene-block"]');
    const sliders = await y('#param-r');
    const step = await y('[data-testid="steps"]');
    const formulas = await y('[data-formula="f1"]');
    expect(picture).toBeLessThan(sliders);
    expect(sliders).toBeLessThan(step);
    expect(step).toBeLessThan(formulas);
  });
});

test.describe('narrow screens and large text (UX-DR12)', () => {
  test('at 320 px wide nothing is clipped, the picture is not sticky and Back to picture works', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, 'section');
    expect(await sceneBlock(page).evaluate((el) => getComputedStyle(el).position)).toBe('static');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const sel of ['[data-solid-viewer]', '[data-testid="steps"]', '[data-testid="example"]', '[data-formula="f1"]']) {
      const box = (await page.locator(sel).first().boundingBox())!;
      expect(box.x, sel).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, sel).toBeLessThanOrEqual(321);
    }
    await page.evaluate(() => window.scrollTo(0, 1500));
    const link = page.getByTestId('back-to-picture').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect.poll(async () => (await sceneBlock(page).boundingBox())!.y).toBeLessThan(40);
  });

  test('at 200% zoom (a 640 by 400 viewport) the picture is not sticky, so it cannot cover the page', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await open(page, 'section');
    expect(await sceneBlock(page).evaluate((el) => getComputedStyle(el).position)).toBe('static');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByTestId('back-to-picture').first()).toBeVisible();
  });
});

test.describe('Urdu', () => {
  test('the layout mirrors, the picture, formulas and numbers keep left to right', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'section', { lang: 'ur' });
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const scene = (await sceneBlock(page).boundingBox())!;
    const step = (await page.getByTestId('steps').boundingBox())!;
    expect(step.x + step.width).toBeLessThanOrEqual(scene.x + 1); // the right third is now on the left
    expect(await page.locator('[data-solid-2d]').evaluate((el) => getComputedStyle(el.parentElement!).direction)).toBe('ltr');
    expect(await page.locator('[data-formula="f1"] span').first().evaluate((el) => el.getAttribute('dir'))).toBe('ltr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('مخروط کو کاٹنا');
    await expect(page.getByTestId('step-of')).toHaveText('مرحلہ 1 از 3');
    await next(page).or(page.getByRole('button', { name: 'آگے', exact: true })).first().click();
    await expect(page.getByTestId('step-of')).toHaveText('مرحلہ 2 از 3');
    await expect(slider(page, 'cut')).toHaveValue('4');
  });

  test('the arrows of Previous and Next point the other way', async ({ page }) => {
    await open(page, 'net', { lang: 'ur' });
    const arrow = page.getByTestId('neighbours').locator('span[aria-hidden="true"]').first();
    expect(await arrow.evaluate((el) => getComputedStyle(el).rotate)).toBe('180deg');
  });
});

test.describe('Tier A and the whole page', () => {
  test('with the 3D picture the page works, steps move the cut and no error is raised', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, 'section', { light: false });
    await expect(page.locator('[data-solid-viewer]')).toHaveAttribute('data-tier', 'A');
    await expect(page.locator('[data-solid-viewer]')).toHaveAttribute('data-ready', 'true');
    await next(page).click();
    await expect(radius(page)).toHaveText('0.3');
    expect(errors).toEqual([]);
  });

  test('a solid topic has a picture, so the message for scene types with no viewer yet is absent (that path is in the unit tests)', async ({ page }) => {
    await open(page, 'cone');
    await expect(page.getByTestId('no-scene')).toHaveCount(0);
  });
});

// ---- Story 2.8: Reset all, marked terms and the language switch ----

const resetAll = (page: Page) => page.getByTestId('reset-all');
// Where the first solid edges are drawn: the camera, whatever the display mode (a wireframe has no faces).
const firstSolidPoints = (page: Page) =>
  page.locator('[data-solid-2d] line[data-layer="solid"]').evaluateAll((els) => els.slice(0, 6).map((e) => ['x1', 'y1', 'x2', 'y2'].map((a) => e.getAttribute(a)).join(',')).join(';'));
const exampleInput = (page: Page, id: string) => page.getByTestId('example').locator(`input[data-typed="${id}"]`);
const search = (page: Page) => page.evaluate(() => window.location.search);

test.describe('Reset all (FR-2.5)', () => {
  test('sliders, the example, the camera, the toggles and the step all go back to the start', async ({ page }) => {
    await open(page, 'section');
    const start = await firstSolidPoints(page);
    await slide(page, 'cut', -2);
    await slide(page, 'r', 5);
    await exampleInput(page, 'a').fill('6');
    await next(page).click();
    await page.getByRole('img', { name: /interactive picture/ }).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
    expect(await firstSolidPoints(page)).not.toBe(start);

    await resetAll(page).click();
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
    await expect(slider(page, 'r')).toHaveValue('3');
    await expect(slider(page, 'cut')).toHaveValue('0');
    await expect(exampleInput(page, 'a')).toHaveValue('3');
    await expect(page.getByTestId('answer')).toContainText('1.5');
    await expect(page.getByRole('button', { name: 'Solid', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Wireframe', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => firstSolidPoints(page)).toBe(start); // the camera is back
    await expect(page.getByTestId('reset-live')).toHaveText('Everything is back to the start.');
    await expect(resetAll(page)).toBeFocused();
  });

  test('after a reset a step moves the sliders again (nothing is held as the visitor\'s)', async ({ page }) => {
    await open(page, 'section');
    await slide(page, 'cut', -2);
    await resetAll(page).click();
    await next(page).click();
    await expect(slider(page, 'cut')).toHaveValue('4');
  });

  test('a reset stops an animation that is playing', async ({ page }) => {
    await open(page, 'net');
    await page.getByRole('button', { name: 'Unfold', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await resetAll(page).click();
    await expect(slider(page, 'u')).toHaveValue('0');
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(slider(page, 'u')).toHaveValue('0');
  });

  test('a reset clears the address of the place', async ({ page }) => {
    await open(page, 'section');
    await slide(page, 'r', 6);
    await next(page).click();
    await expect.poll(() => search(page)).toContain('p.r=6');
    await resetAll(page).click();
    await expect.poll(() => search(page)).toBe('?topic=section');
  });

  test('twice in a row says it twice', async ({ page }) => {
    await open(page, 'section');
    await resetAll(page).click();
    const first = await page.getByTestId('reset-live').textContent();
    await resetAll(page).click();
    expect(await page.getByTestId('reset-live').textContent()).not.toBe(first);
  });

  test('in Urdu the button and the message are in Urdu', async ({ page }) => {
    await open(page, 'section', { lang: 'ur' });
    await expect(resetAll(page)).toHaveText('سب کچھ دوبارہ شروع کریں');
    await resetAll(page).click();
    await expect(page.getByTestId('reset-live')).toContainText('شروع کی حالت');
  });
});

test.describe('marked terms (FR-2.6)', () => {
  const term = (page: Page, id = 'cross-section') => page.locator(`button[data-term="${id}"]`).first();

  test('a defined word is a button; tapping it opens its explanation; Close returns focus to the word', async ({ page }) => {
    await open(page, 'section');
    await expect(term(page)).toHaveText('cross-section');
    await term(page).click();
    await expect(page.getByTestId('term-sheet')).toBeVisible();
    await expect(page.getByTestId('term-title')).toHaveText('cross-section');
    await expect(page.getByTestId('term-definition')).toHaveText('The flat shape you see when you cut straight through a solid.');
    await page.getByTestId('term-close').click();
    await expect(page.getByTestId('term-sheet')).toBeHidden();
    await expect(term(page)).toBeFocused();
  });

  test('Esc closes the sheet and returns focus; a press on the backdrop closes it too', async ({ page }) => {
    await open(page, 'section');
    await term(page).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('term-sheet')).toBeHidden();
    await expect(term(page)).toBeFocused();
    await term(page).click();
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('term-sheet')).toBeHidden();
  });

  test('works from the keyboard: Enter on the word opens it', async ({ page }) => {
    await open(page, 'section');
    await term(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('term-sheet')).toBeVisible();
    await expect(page.getByTestId('term-close')).toBeFocused();
  });

  test('another step has another term, and each opens its own definition', async ({ page }) => {
    await open(page, 'section');
    await next(page).click();
    await term(page, 'radius').click();
    await expect(page.getByTestId('term-title')).toHaveText('radius');
    await expect(page.getByTestId('term-definition')).toContainText('middle of a circle');
  });

  test('the sheet is in the language of the visitor', async ({ page }) => {
    await open(page, 'section', { lang: 'ur' });
    await term(page).click();
    await expect(page.getByTestId('term-title')).toHaveText('کٹاؤ');
    await expect(page.getByTestId('term-definition')).toContainText('چپٹی شکل');
    await expect(page.getByTestId('term-close')).toHaveText('بند کریں');
  });

  test('a term the topic does not define is not a button, and a topic with no terms has none', async ({ page }) => {
    await open(page, 'net');
    await expect(page.locator('button[data-term]')).toHaveCount(0);
  });
});

test.describe('the place is kept (FR-2.7, AD-6)', () => {
  test('an address with a step and a slider opens there, and a step does not override the slider', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    await page.goto('/en/dev/topic?topic=section&step=2&p.r=5');
    await expect(page.getByTestId('step-of')).toHaveText('Step 2 of 3');
    await expect(slider(page, 'r')).toHaveValue('5');
    await expect(slider(page, 'cut')).toHaveValue('4'); // step 2's preset
    await next(page).click();
    await expect(slider(page, 'r')).toHaveValue('5');
    await expect(slider(page, 'cut')).toHaveValue('-4');
  });

  test('a hostile address is clamped, its unknown keys dropped, and the page works', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/en/dev/topic?topic=section&step=99&p.r=9999&p.h=abc&p.__proto__=1&p.constructor=2&evil=1&p.r=2');
    await expect(page.getByTestId('step-of')).toHaveText('Step 3 of 3');
    await expect(slider(page, 'r')).toHaveValue('8');
    await expect(slider(page, 'h')).toHaveValue('10');
    await expect.poll(() => search(page)).toBe('?topic=section&evil=1&step=3&p.r=8');
    expect(errors).toEqual([]);
  });

  test('moving things writes the place into the address, once, without a history entry; the other keys and the hash stay', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    await page.goto('/en/dev/topic?topic=section#scene');
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
    const entries = await page.evaluate(() => window.history.length);
    await slide(page, 'r', 6);
    await slide(page, 'r', 7);
    await next(page).click();
    await expect.poll(() => search(page)).toBe('?topic=section&step=2&p.r=7');
    expect(await page.evaluate(() => window.location.hash)).toBe('#scene');
    expect(await page.evaluate(() => window.history.length)).toBe(entries);
  });

  test('nothing is written for what the visitor did not change', async ({ page }) => {
    await open(page, 'section');
    await page.waitForTimeout(600);
    expect(await search(page)).toBe('?topic=section');
    await next(page).click();
    await expect.poll(() => search(page)).toBe('?topic=section&step=2'); // the step is written, the preset parameters are not
  });

  test('the language switch keeps the step and the sliders, and the layout mirrors', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'section');
    await slide(page, 'r', 5);
    await next(page).click();
    await expect.poll(() => search(page)).toContain('p.r=5');
    await page.getByRole('link', { name: 'اردو' }).click();
    await page.waitForURL(/\/ur\/dev\/topic/);
    await expect(page.getByTestId('step-of')).toHaveText('مرحلہ 2 از 3');
    await expect(slider(page, 'r')).toHaveValue('5');
    await expect(slider(page, 'cut')).toHaveValue('4');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const scene = (await sceneBlock(page).boundingBox())!;
    const step = (await page.getByTestId('steps').boundingBox())!;
    expect(step.x + step.width).toBeLessThanOrEqual(scene.x + 1);
    // and back
    await page.getByRole('link', { name: 'English' }).click();
    await page.waitForURL(/\/en\/dev\/topic/);
    await expect(page.getByTestId('step-of')).toHaveText('Step 2 of 3');
    await expect(slider(page, 'r')).toHaveValue('5');
  });

  test('the address works on its own: the same link in the other language opens at the same place', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    await page.goto('/ur/dev/topic?topic=section&step=3&p.cut=-1.5');
    await expect(page.getByTestId('step-of')).toHaveText('مرحلہ 3 از 3');
    await expect(slider(page, 'cut')).toHaveValue('-1.5');
  });

  test('Urdu digits in the address are read', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
    await page.goto('/en/dev/topic?topic=section&p.r=%D9%A5');
    await expect(slider(page, 'r')).toHaveValue('5');
  });

  test('an address with no state leaves the address clean and the page at the start', async ({ page }) => {
    await open(page, 'section');
    await expect(page.getByTestId('step-of')).toHaveText('Step 1 of 3');
    await page.waitForTimeout(500);
    expect(await search(page)).toBe('?topic=section');
  });
});
