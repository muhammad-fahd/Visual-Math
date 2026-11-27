import { test, expect, type Page, type Route } from '@playwright/test';

// "Report a problem" in a real browser (Story 2.7), on the topic page harness. The server of the tests has
// no database, so the real route answers 503; the other answers are given by intercepting the request.

const open = async (page: Page, lang = 'en') => {
  await page.addInitScript(() => localStorage.setItem('vm.tier', 'light'));
  await page.goto(`/${lang}/dev/topic?topic=cone`);
  await expect(page.locator('[data-solid-viewer]')).not.toHaveAttribute('data-tier', 'pending');
};
const button = (page: Page, name = 'Report a problem') => page.getByTestId('report-open').or(page.getByRole('button', { name, exact: true })).first();
const sheet = (page: Page) => page.getByTestId('report-sheet');
const note = (page: Page) => page.getByTestId('report-note');
const send = (page: Page) => page.getByTestId('report-send');
const error = (page: Page) => page.getByTestId('report-error');

interface Seen {
  bodies: unknown[];
  headers: Record<string, string>[];
}
/** Answers /api/report with `answer` and records what was sent. */
const answer = async (page: Page, answers: ((n: number) => { status: number; headers?: Record<string, string> }) | { status: number; headers?: Record<string, string> }): Promise<Seen> => {
  const seen: Seen = { bodies: [], headers: [] };
  await page.route('**/api/report', async (route: Route) => {
    seen.bodies.push(route.request().postDataJSON());
    seen.headers.push(route.request().headers());
    const a = typeof answers === 'function' ? answers(seen.bodies.length) : answers;
    await route.fulfill({ status: a.status, headers: a.headers ?? {}, body: a.status === 204 ? '' : JSON.stringify({ error: { code: 'x', message: 'x' } }) });
  });
  return seen;
};

test.describe('the sheet', () => {
  test('opens with a reason and a note of at most 500 characters; focus goes in; Esc closes it and focus returns to the button', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('radio')).toHaveCount(5);
    await expect(sheet(page).getByRole('radio', { name: 'A number or the math is wrong' })).toBeChecked();
    await expect(note(page)).not.toHaveAttribute('maxlength', /.+/); // the limit is in characters, kept by the box's own script
    expect(await page.evaluate(() => document.querySelector('dialog')!.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(button(page)).toBeFocused();
  });

  test('the box stops at 500 and the counter says how many are used', async ({ page }) => {
    await open(page);
    await button(page).click();
    await note(page).fill('The volume is off');
    await expect(page.getByTestId('report-count')).toHaveText('17 of 500 characters');
    await note(page).fill('x'.repeat(600));
    await expect(note(page)).toHaveValue('x'.repeat(500));
    await expect(page.getByTestId('report-count')).toHaveText('500 of 500 characters');
  });

  test('the limit is in characters, not UTF-16 units: 500 emoji fit, the 501st does not', async ({ page }) => {
    await open(page);
    await button(page).click();
    await note(page).fill('😀'.repeat(600));
    await expect(page.getByTestId('report-count')).toHaveText('500 of 500 characters');
    expect(await note(page).evaluate((el) => Array.from((el as HTMLTextAreaElement).value).length)).toBe(500);
  });

  test('the note box takes either direction: it follows the text it holds', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(note(page)).toHaveAttribute('dir', 'auto');
  });

  test('a press that starts in the note and ends on the backdrop does not close the sheet', async ({ page }) => {
    await open(page);
    await button(page).click();
    await note(page).fill('select me');
    const box = (await note(page).boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(3, 3, { steps: 5 });
    await page.mouse.up();
    await expect(sheet(page)).toBeVisible();
  });

  test('Tab never lands on the page behind the sheet (it may pass to the browser, never to the topic page)', async ({ page }) => {
    await open(page);
    await button(page).click();
    const stops = new Set<string>();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return 'browser';
        return document.querySelector('dialog')!.contains(a) ? (a.getAttribute('data-testid') ?? a.tagName.toLowerCase()) : 'PAGE';
      });
      expect(where, `tab ${i + 1}`).not.toBe('PAGE');
      stops.add(where);
    }
    expect([...stops]).toEqual(expect.arrayContaining(['input', 'report-note', 'button', 'report-send']));
  });

  test('a press on the backdrop closes it; Cancel closes it and keeps nothing sent', async ({ page }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    await button(page).click();
    await page.mouse.click(5, 5);
    await expect(sheet(page)).toBeHidden();
    await button(page).click();
    await sheet(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet(page)).toBeHidden();
    expect(seen.bodies).toEqual([]);
  });
});

test.describe('sending (FR-2.4)', () => {
  test('stores the topic id, the reason and the note, closes the sheet and says thank you', async ({ page }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'The Urdu is wrong or unclear' }).check();
    await note(page).fill('The word for volume is wrong');
    await send(page).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByTestId('report-toast')).toHaveText('Thank you. We will check it.');
    expect(seen.bodies).toEqual([{ topicId: 'geo-cone-volume', reason: 'urdu', note: 'The word for volume is wrong' }]);
    // The next report starts clean.
    await button(page).click();
    await expect(note(page)).toHaveValue('');
    await expect(sheet(page).getByRole('radio', { name: 'A number or the math is wrong' })).toBeChecked();
  });

  test('no cookie, no identifier and no address leave with it', async ({ page, context }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    const before = (await context.cookies()).map((c) => c.name).sort();
    await button(page).click();
    await note(page).fill('x');
    await send(page).click();
    await expect(page.getByTestId('report-toast')).toHaveText('Thank you. We will check it.');
    expect(Object.keys(seen.bodies[0] as object).sort()).toEqual(['note', 'reason', 'topicId']);
    expect(seen.headers[0]!['cookie']).toBeUndefined();
    expect((await context.cookies()).map((c) => c.name).sort()).toEqual(before);
  });

  test('a note is optional for most reasons', async ({ page }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'The picture does not work' }).check();
    await send(page).click();
    await expect(page.getByTestId('report-toast')).toBeVisible();
    expect(seen.bodies).toEqual([{ topicId: 'geo-cone-volume', reason: 'scene', note: '' }]);
  });

  test('"Something else" needs a note: it says so and sends nothing', async ({ page }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'Something else' }).check();
    await expect(sheet(page)).toContainText('(required)');
    await send(page).click();
    await expect(error(page)).toHaveText('Please write a short note.');
    await expect(sheet(page)).toBeVisible();
    expect(seen.bodies).toEqual([]);
    await note(page).fill('details');
    await send(page).click();
    await expect(sheet(page)).toBeHidden();
    expect(seen.bodies).toHaveLength(1);
  });

  test('a note that is only spaces and joiners is not a note for "Something else"', async ({ page }) => {
    const seen = await answer(page, { status: 204 });
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'Something else' }).check();
    await note(page).fill('  ‌  ');
    await send(page).click();
    await expect(error(page)).toHaveText('Please write a short note.');
    expect(seen.bodies).toEqual([]);
  });

  test('after a mistake the error clears when the note is edited, and focus went to the note to fix it', async ({ page }) => {
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'Something else' }).check();
    await send(page).click();
    await expect(error(page)).toBeVisible();
    await expect(note(page)).toBeFocused();
    await note(page).fill('now there is a note');
    await expect(error(page)).toHaveCount(0);
    await expect(note(page)).toHaveAttribute('aria-invalid', 'false');
  });

  test('pressing Send twice quickly sends once', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/report', async (route) => {
      calls++;
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 204, body: '' });
    });
    await open(page);
    await button(page).click();
    await note(page).fill('once');
    await send(page).dblclick();
    await expect(page.getByTestId('report-toast')).toHaveText('Thank you. We will check it.');
    expect(calls).toBe(1);
  });
});

test.describe('when it cannot be sent, the note is kept', () => {
  test('too many sends: it says to wait, in minutes, and Send works again later', async ({ page }) => {
    const seen = await answer(page, (n) => (n === 1 ? { status: 429, headers: { 'retry-after': '120' } } : { status: 204 }));
    await open(page);
    await button(page).click();
    await note(page).fill('please keep this');
    await send(page).click();
    await expect(error(page)).toHaveText('You have sent several reports. Please wait 2 minutes and try again.');
    await expect(note(page)).toHaveValue('please keep this');
    await expect(sheet(page)).toBeVisible();
    await send(page).click();
    await expect(sheet(page)).toBeHidden();
    expect(seen.bodies).toHaveLength(2);
  });

  test('a Retry-After that is not a number still gives a message, never "NaN"', async ({ page }) => {
    await answer(page, { status: 429, headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' } });
    await open(page);
    await button(page).click();
    await note(page).fill('x');
    await send(page).click();
    await expect(error(page)).toContainText('Please wait');
    await expect(error(page)).not.toContainText('NaN');
  });

  test('Esc and Cancel do not drop a report that is on its way', async ({ page }) => {
    await page.route('**/api/report', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 204, body: '' });
    });
    await open(page);
    await button(page).click();
    await note(page).fill('in flight');
    await send(page).click();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByTestId('report-toast')).toHaveText('Thank you. We will check it.');
    await expect(sheet(page)).toBeHidden();
  });

  test('two thanks in a row each get their full time', async ({ page }) => {
    await answer(page, { status: 204 });
    await open(page);
    for (const text of ['one', 'two']) {
      await button(page).click();
      await note(page).fill(text);
      await send(page).click();
      await expect(page.getByTestId('report-toast')).toHaveText('Thank you. We will check it.');
    }
  });

  test('the server without a database answers 503 and the sheet says it could not send', async ({ page }) => {
    await open(page); // no interception: the real route of a server with no database
    await button(page).click();
    await note(page).fill('still here');
    await send(page).click();
    await expect(error(page)).toHaveText('We could not send this. Your note is kept. Please try again.');
    await expect(note(page)).toHaveValue('still here');
    await expect(send(page)).toBeEnabled();
  });

  test('a network failure is the same message', async ({ page }) => {
    await page.route('**/api/report', (route) => route.abort('failed'));
    await open(page);
    await button(page).click();
    await note(page).fill('offline');
    await send(page).click();
    await expect(error(page)).toContainText('Your note is kept');
    await expect(note(page)).toHaveValue('offline');
  });

  test('a note the server finds too long (it counts after cleaning) is refused with the short message', async ({ page }) => {
    await page.route('**/api/report', (route) => route.fulfill({ status: 400, body: JSON.stringify({ error: { code: 'note_too_long', message: 'x' } }) }));
    await open(page);
    await button(page).click();
    await note(page).fill('x');
    await send(page).click();
    await expect(error(page)).toHaveText('The note is too long.');
  });

  test('the error is announced and the note box points at it', async ({ page }) => {
    await open(page);
    await button(page).click();
    await sheet(page).getByRole('radio', { name: 'Something else' }).check();
    await send(page).click();
    await expect(error(page)).toHaveText('Please write a short note.');
    await expect(error(page)).toHaveAttribute('role', 'alert');
    await expect(note(page)).toHaveAttribute('aria-invalid', 'true');
    expect(await note(page).getAttribute('aria-describedby')).toContain((await error(page).getAttribute('id'))!);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the sheet comes up from the bottom, full width, with 44 px buttons and radios', async ({ page }) => {
    await open(page);
    await button(page).click();
    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(388);
    expect(box.y + box.height).toBeGreaterThan(844 - 4);
    for (const r of await sheet(page).getByRole('radio').all()) {
      const label = (await r.locator('xpath=ancestor::label').boundingBox())!;
      expect(label.height).toBeGreaterThanOrEqual(43.5);
    }
    for (const b of await sheet(page).getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe('Urdu', () => {
  test('the sheet and the thanks are in Urdu and the sheet mirrors', async ({ page }) => {
    await answer(page, { status: 204 });
    await open(page, 'ur');
    await button(page, 'مسئلے کی اطلاع دیں').click();
    await expect(sheet(page).getByRole('heading')).toHaveText('مسئلے کی اطلاع دیں');
    expect(await sheet(page).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
    await expect(page.getByTestId('report-count')).toHaveText('500 میں سے 0 حروف');
    await note(page).fill('حجم غلط ہے');
    await send(page).click();
    await expect(page.getByTestId('report-toast')).toHaveText('شکریہ۔ ہم اسے دیکھیں گے۔');
  });
});
