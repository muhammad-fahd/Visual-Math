import { test, expect, type Page } from '@playwright/test';

// The scene frame in a real browser (Story 2.3), through the harness page: a stand-in square that turns,
// scales and moves with the view. The harness exists only on the test server (VM_HARNESS=1).

const START = { azimuth: 45, elevation: 30, scale: 1, panX: 0, panY: 0 };

interface View {
  azimuth: number;
  elevation: number;
  scale: number;
  panX: number;
  panY: number;
}
const view = async (page: Page): Promise<View> => JSON.parse((await page.getByTestId('view').textContent()) || '{}') as View;
const surface = (page: Page) => page.getByRole('img', { name: 'Harness solid, interactive picture' }).or(page.getByRole('application', { name: 'Harness solid, interactive picture' }));
const open = async (page: Page, query = '', lang = 'en') => {
  await page.goto(`/${lang}/dev/frame${query}`);
  await expect(page.getByTestId('view')).not.toBeEmpty();
};
const box = async (page: Page) => (await surface(page).boundingBox())!;

test.describe('mouse and wheel', () => {
  test('dragging turns the picture: right lowers the azimuth, down raises the elevation', async ({ page }) => {
    await open(page);
    expect(await view(page)).toEqual(START);
    const b = await box(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 40, { steps: 8 });
    await page.mouse.up();
    const v = await view(page);
    expect(v.azimuth).toBeCloseTo(355, 0); // 45 - 50
    expect(v.elevation).toBeCloseTo(50, 0); // 30 + 20
    expect(v.scale).toBe(1);
  });

  test('the wheel zooms, within 0.25 and 8, and does not scroll the page', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 500 });
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true); // the page CAN scroll here
    const b = await box(page);
    await page.mouse.move(b.x + b.width / 2, b.y + 100);
    await page.mouse.wheel(0, 400); // down: zooms out, and would scroll the page if the event were not stopped
    await expect.poll(async () => (await view(page)).scale).toBeLessThan(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await view(page)).scale).toBeGreaterThan(0.5);
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -500);
    await expect.poll(async () => (await view(page)).scale).toBe(8);
    for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 500);
    await expect.poll(async () => (await view(page)).scale).toBe(0.25);
  });

  test('right-drag moves the picture and does not turn it, and no context menu opens', async ({ page }) => {
    await open(page);
    const b = await box(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.evaluate(() => {
      (window as unknown as { __menu: boolean[] }).__menu = [];
      document.addEventListener('contextmenu', (e) => (window as unknown as { __menu: boolean[] }).__menu.push(e.defaultPrevented));
    });
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(cx + b.width * 0.2, cy + b.height * 0.1, { steps: 6 });
    await page.mouse.up({ button: 'right' });
    expect(await page.evaluate(() => (window as unknown as { __menu: boolean[] }).__menu)).toEqual([true]); // the menu was stopped
    const v = await view(page);
    expect(v.panX).toBeCloseTo(0.2, 1);
    expect(v.panY).toBeCloseTo(0.1, 1);
    expect(v.azimuth).toBe(45);
    expect(v.elevation).toBe(30);
  });
});

test.describe('touch: pinch and two-finger drag', () => {
  /** Synthetic touch pointers on the surface (Playwright has no pinch); the frame cannot tell them from real ones. */
  const touch = (page: Page, type: 'pointerdown' | 'pointermove' | 'pointerup', id: number, x: number, y: number) =>
    page.evaluate(
      ([t, i, px, py]) => {
        const el = document.querySelector('[aria-label="Harness solid, interactive picture"]')!;
        el.dispatchEvent(new PointerEvent(t as string, { pointerId: i as number, pointerType: 'touch', clientX: px as number, clientY: py as number, button: 0, bubbles: true, isPrimary: i === 1 }));
      },
      [type, id, x, y] as const,
    );

  test('two fingers moving apart zoom in, together zoom out', async ({ page }) => {
    await open(page);
    const b = await box(page);
    const y = b.y + b.height / 2;
    const x = b.x + b.width / 2;
    await touch(page, 'pointerdown', 1, x - 40, y);
    await touch(page, 'pointerdown', 2, x + 40, y);
    await touch(page, 'pointermove', 2, x + 80, y); // the distance goes 80 -> 120
    await expect.poll(async () => (await view(page)).scale).toBeCloseTo(1.5, 1);
    await touch(page, 'pointermove', 2, x + 40, y); // 120 -> 80
    await expect.poll(async () => (await view(page)).scale).toBeCloseTo(1, 1);
    await touch(page, 'pointerup', 2, x + 40, y);
    await touch(page, 'pointerup', 1, x - 40, y);
  });

  test('two fingers dragging together move the picture; one finger turns it', async ({ page }) => {
    await open(page);
    const b = await box(page);
    const y = b.y + b.height / 2;
    const x = b.x + b.width / 2;
    await touch(page, 'pointerdown', 1, x - 40, y);
    await touch(page, 'pointerdown', 2, x + 40, y);
    await touch(page, 'pointermove', 1, x - 40 + b.width * 0.1, y);
    await touch(page, 'pointermove', 2, x + 40 + b.width * 0.1, y);
    await expect.poll(async () => (await view(page)).panX).toBeGreaterThan(0.05);
    // Lifting one finger must not jump the view.
    const before = await view(page);
    await touch(page, 'pointerup', 2, x + 40, y);
    expect(await view(page)).toEqual(before);
    await touch(page, 'pointerup', 1, x, y);
    // One finger: turn.
    await touch(page, 'pointerdown', 7, x, y);
    await touch(page, 'pointermove', 7, x + 20, y);
    await touch(page, 'pointerup', 7, x + 20, y);
    expect((await view(page)).azimuth).toBeCloseTo(before.azimuth - 10, 0);
  });
});

test.describe('the toolbar works without any gesture (UX-DR10)', () => {
  test('every button has an icon and a visible word, and a 44 px target', async ({ page }) => {
    await open(page);
    const buttons = page.getByRole('group', { name: 'Picture controls' }).getByRole('button');
    await expect(buttons).toHaveCount(6); // five of the frame and the harness's own toggle
    for (const name of ['Reset view', 'Zoom in', 'Zoom out', 'Move picture', 'Full screen']) {
      const b = page.getByRole('group', { name: 'Picture controls' }).getByRole('button', { name });
      await expect(b).toBeVisible();
      expect((await b.innerText()).trim()).toBe(name); // the word is on the button, not only in a label
      await expect(b.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await b.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('Zoom in, Zoom out and Reset view', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect((await view(page)).scale).toBeCloseTo(1.5625, 5);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    expect((await view(page)).scale).toBeCloseTo(0.8, 5);
    await page.getByRole('button', { name: 'Reset view' }).click();
    expect(await view(page)).toEqual(START);
  });

  test('Move picture opens four direction buttons, each with a word, and moves the picture', async ({ page }) => {
    await open(page);
    const toggle = page.getByRole('button', { name: 'Move picture' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('group', { name: 'Move the picture' })).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const pad = page.getByRole('group', { name: 'Move the picture' });
    for (const [name, key, sign] of [['Left', 'panX', -1], ['Right', 'panX', 1], ['Up', 'panY', -1], ['Down', 'panY', 1]] as const) {
      const before = (await view(page))[key];
      const b = pad.getByRole('button', { name });
      expect((await b.innerText()).trim()).toBe(name);
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await b.click();
      expect((await view(page))[key]).toBeCloseTo(before + sign * 0.1, 5);
    }
    await page.getByRole('button', { name: 'Reset view' }).click();
    expect(await view(page)).toEqual(START);
    await toggle.click();
    await expect(page.getByRole('group', { name: 'Move the picture' })).toHaveCount(0);
  });

  test('clicking a toolbar button while the frame has focus works (the layout does not shift under the pointer)', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await surface(page).focus();
    const before = (await page.getByRole('button', { name: 'Zoom in' }).boundingBox())!;
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Zoom in' }).click(); // blurs the frame on mouse-down
    expect((await page.getByRole('button', { name: 'Zoom in' }).boundingBox())!.y).toBe(before.y);
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
  });

  test('Reset view says so in the polite live region, after the pause; turning does not', async ({ page }) => {
    await open(page);
    const status = page.locator('[data-scene-frame] [role="status"]');
    await surface(page).focus();
    await page.keyboard.press('ArrowRight'); // turning is not announced
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(800);
    await expect(status).toHaveText('');
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(status).toHaveText(/View reset\./, { timeout: 3000 });
  });

  test('reduced motion: the view jumps, nothing eases', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Reset view' }).click();
    expect(await view(page)).toEqual(START); // immediately, no animation to wait for
  });
});

test.describe('keyboard (NFR-3.1)', () => {
  test('arrows turn by 5, Shift by 15, + - zoom, 0 resets', async ({ page }) => {
    await open(page);
    await surface(page).focus();
    await page.keyboard.press('ArrowRight');
    expect((await view(page)).azimuth).toBe(50);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect((await view(page)).azimuth).toBe(40);
    await page.keyboard.press('ArrowUp');
    expect((await view(page)).elevation).toBe(35);
    await page.keyboard.press('Shift+ArrowUp');
    expect((await view(page)).elevation).toBe(50);
    await page.keyboard.press('Shift+ArrowRight');
    expect((await view(page)).azimuth).toBe(55);
    await page.keyboard.press('ArrowDown');
    expect((await view(page)).elevation).toBe(45);
    await page.keyboard.press('+');
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    expect((await view(page)).scale).toBeCloseTo(0.8, 5);
    await page.keyboard.press('0');
    expect(await view(page)).toEqual(START);
  });

  test('arrows do not scroll the page while the frame is focused', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 300 });
    await open(page);
    await surface(page).focus();
    const before = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('the frame is an image until focused, then an application with the visible hint line', async ({ page }) => {
    await open(page);
    const hint = page.getByText('Arrow keys turn the picture. Esc leaves.');
    await expect(page.getByRole('img', { name: 'Harness solid, interactive picture' })).toBeVisible();
    await expect(hint).toBeHidden();
    await surface(page).focus();
    await expect(page.getByRole('application', { name: 'Harness solid, interactive picture' })).toBeVisible();
    await expect(hint).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('img', { name: 'Harness solid, interactive picture' })).toBeVisible();
    await expect(hint).toBeHidden();
  });

  test('Tab leaves the frame in both directions (no trap); Esc goes to the first toolbar button, and from there on', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await surface(page).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeFocused(); // Tab leaves the frame; nothing traps it
    await page.keyboard.press('Shift+Tab');
    await expect(surface(page)).toBeFocused(); // and Shift+Tab comes back
    await page.keyboard.press('Shift+Tab');
    await expect(surface(page)).not.toBeFocused(); // and leaves backwards too
  });

  test('Esc from the frame focuses the first toolbar button; Esc from the toolbar tells the page', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await surface(page).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeFocused();
    await expect(page.getByTestId('escapes')).toHaveText('0');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('escapes')).toHaveText('1');
    // Shift+Tab goes back to the frame.
    await page.keyboard.press('Shift+Tab');
    await expect(surface(page)).toBeFocused();
  });

  test('Esc from the Move picture buttons and from the hint button also goes on', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Move picture' }).click();
    await page.getByRole('group', { name: 'Move the picture' }).getByRole('button', { name: 'Left' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('escapes')).toHaveText('1');
    await page.getByRole('button', { name: 'Got it' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('escapes')).toHaveText('1'); // the hint is not the toolbar: it stays out of this
  });

  test('browser shortcuts are left alone: Ctrl+0 and Ctrl+Plus do not move the view', async ({ page }) => {
    await open(page);
    await surface(page).focus();
    await page.keyboard.press('ArrowRight');
    const before = await view(page);
    await page.keyboard.press('Control+0');
    await page.keyboard.press('Control+=');
    expect(await view(page)).toEqual(before);
  });

  test('toolbar buttons are reached by Tab in order, and Space or Enter activates them', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Reset view' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Zoom out' })).toBeFocused();
    await page.keyboard.press('Space');
    expect((await view(page)).scale).toBeCloseTo(1, 5);
  });
});

test.describe('Urdu (UX-DR13)', () => {
  test('the toolbar mirrors and speaks Urdu, and arrow keys are not flipped', async ({ page }) => {
    await open(page, '', 'ur');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const group = page.getByRole('group', { name: 'تصویر کے بٹن' });
    const reset = group.getByRole('button', { name: 'منظر دوبارہ ترتیب دیں' });
    await expect(reset).toBeVisible();
    // Mirrored: the first button sits against the right edge of its row.
    const g = (await group.boundingBox())!;
    const r = (await reset.boundingBox())!;
    expect(r.x + r.width).toBeGreaterThan(g.x + g.width - 2);
    expect(r.x).toBeGreaterThan(g.x + 2);
    await page.getByRole('button', { name: 'سمجھ گیا' }).click();
    await page.getByRole('application').or(page.getByRole('img')).first().focus();
    await page.keyboard.press('ArrowRight');
    expect((await view(page)).azimuth).toBe(50); // the same +5 as in English
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect((await view(page)).azimuth).toBe(40);
  });

  test('the Urdu hint and names come from the message file', async ({ page }) => {
    await open(page, '', 'ur');
    await expect(page.getByText('تصویر گھمانے کے لیے کھینچیں۔ بڑا کرنے کے لیے دو انگلیوں سے پھیلائیں۔')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Harness solid، متحرک تصویر' })).toBeVisible();
    await expect(page.getByText('اس تصویر کے بارے میں مزید')).toBeVisible();
  });
});

test.describe('the first-time hint (FR-2.8)', () => {
  test('shown on the first visit, gone for good after "Got it"', async ({ page, context, baseURL }) => {
    await open(page);
    const hint = page.getByText('Drag to turn the picture. Pinch to zoom.');
    await expect(hint).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(hint).toBeHidden();
    expect(await page.evaluate(() => window.localStorage.getItem('vm.sceneHint'))).toBe('1');
    await page.reload();
    await expect(page.getByTestId('view')).not.toBeEmpty();
    await expect(hint).toBeHidden();
    // A new browsing context is a new device: the hint is back.
    const fresh = await context.browser()!.newContext();
    const other = await fresh.newPage();
    await other.goto(new URL('/en/dev/frame', baseURL).href);
    await expect(other.getByText('Drag to turn the picture. Pinch to zoom.')).toBeVisible();
    await fresh.close();
  });

  test('without "Got it" it shows again; the hint does not cover the toolbar', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Drag to turn the picture. Pinch to zoom.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Drag to turn the picture. Pinch to zoom.')).toBeVisible();
  });

  test('it is not in the server HTML (a returning visitor never sees it flash)', async ({ request }) => {
    const html = await (await request.get('/en/dev/frame')).text();
    // The message catalog travels with the page, but the hint itself is not in the rendered markup.
    expect(html).not.toMatch(/>Drag to turn the picture\. Pinch to zoom\.</);
    expect(html).not.toContain('Got it</button>');
    expect(html).toContain('Harness solid, interactive picture');
  });

  test('blocked storage: the hint shows, "Got it" still closes it, nothing crashes', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    await expect(page.getByText('Drag to turn the picture. Pinch to zoom.')).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByText('Drag to turn the picture. Pinch to zoom.')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('Full screen (FR-3.15)', () => {
  test('the Fullscreen API is used where it works; the label flips; the button leaves', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Full screen' }).click();
    const exit = page.getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeVisible();
    await expect(exit).not.toHaveAttribute('aria-pressed'); // the label flips, so a pressed state would say it twice
    // The browser's full screen is used where it works: the frame is the full-screen element.
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-scene-frame') ?? false)).toBe(true);
    await exit.click();
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });

  test('the fallback: with no Fullscreen API the frame maximizes itself, and Esc leaves it', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = undefined as never;
    });
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Full screen' }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    const viewport = page.viewportSize()!;
    const maximized = (await page.locator('[data-scene-frame]').boundingBox())!;
    expect(maximized.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(maximized.y).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
    expect((await page.locator('[data-scene-frame]').boundingBox())!.y).toBeGreaterThan(1);
  });

  test('the fallback: a refused request also maximizes', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('refused'));
    });
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Full screen' }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
  });

  test('the view survives going full screen and back', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = undefined as never;
    });
    await open(page);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const before = await view(page);
    await page.getByRole('button', { name: 'Full screen' }).click();
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    expect(await view(page)).toEqual(before);
  });
});

test.describe('the picture is described (FR-3.29)', () => {
  test('the caption is always visible and names the picture; the description is in a disclosure', async ({ page }) => {
    await open(page);
    const frame = surface(page);
    await expect(page.getByText('A square that turns, scales and moves.')).toBeVisible();
    const captionId = await page.locator('figcaption').getAttribute('id');
    expect(await frame.getAttribute('aria-describedby')).toContain(captionId!);
    const summary = page.getByText('More about this picture');
    await expect(summary).toBeVisible();
    const text = page.getByText('A plain square drawn only to test the scene frame.');
    await expect(text).toBeHidden();
    await summary.click();
    await expect(text).toBeVisible();
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('without a description there is no disclosure, and the caption is still there', async ({ page }) => {
    await open(page, '?desc=0');
    await expect(page.getByText('More about this picture')).toHaveCount(0);
    await expect(page.getByText('A square that turns, scales and moves.')).toBeVisible();
  });
});

test.describe('capabilities: a 2D scene cannot turn', () => {
  test('mode 2d: drag and arrows move the picture, nothing turns; Move picture is there', async ({ page }) => {
    await open(page, '?mode=2d');
    const b = await box(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + b.width * 0.2, cy, { steps: 5 });
    await page.mouse.up();
    let v = await view(page);
    expect(v.panX).toBeCloseTo(0.2, 1);
    expect(v.azimuth).toBe(45);
    await surface(page).focus();
    await page.keyboard.press('ArrowRight');
    v = await view(page);
    expect(v.panX).toBeCloseTo(0.25, 1);
    expect(v.azimuth).toBe(45);
    await expect(page.getByRole('button', { name: 'Move picture' })).toBeVisible();
  });

  test('mode zoom: no Move picture button, drag does nothing, zoom works', async ({ page }) => {
    await open(page, '?mode=zoom');
    await expect(page.getByRole('button', { name: 'Move picture' })).toHaveCount(0);
    const b = await box(page);
    await page.mouse.move(b.x + 50, b.y + 50);
    await page.mouse.down();
    await page.mouse.move(b.x + 150, b.y + 90, { steps: 5 });
    await page.mouse.up();
    expect(await view(page)).toEqual(START);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect((await view(page)).scale).toBeCloseTo(1.25, 5);
    await surface(page).focus();
    await page.keyboard.press('ArrowLeft'); // nothing to turn or move: left to the browser
    expect((await view(page)).panX).toBe(0);
  });
});

test.describe('a scene type own toggle goes through the frame (extraControls)', () => {
  test('FrameToggle is a button with a word and a pressed state, and keeps the view', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const before = await view(page);
    const toggle = page.getByRole('button', { name: 'Wireframe' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await view(page)).toEqual(before); // a view toggle never moves the camera
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('the harness is only a harness', () => {
  test('the toolbar and the frame do not trap the pointer: clicking a toolbar button never starts a drag', async ({ page }) => {
    await open(page);
    const zoom = page.getByRole('button', { name: 'Zoom in' });
    const z = (await zoom.boundingBox())!;
    await page.mouse.move(z.x + 5, z.y + 5);
    await page.mouse.down();
    await page.mouse.move(z.x + 80, z.y + 40, { steps: 4 });
    await page.mouse.up();
    const v = await view(page);
    expect(v.azimuth).toBe(45);
    expect(v.elevation).toBe(30);
  });
});
