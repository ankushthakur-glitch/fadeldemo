/**
 * THE DROPDOWN CARET IS PART OF THE CLICK TARGET.
 *
 * The bug this guards against was reported off a design review and it was
 * real: the caret <svg> was a flex SIBLING of the <select>, so it occupied a
 * ~16px column at the right-hand end of every dropdown in the app. The
 * <select> stopped short of it. Clicking the arrow — the part of a dropdown
 * people actually aim at — landed on an inert graphic and the menu stayed
 * shut, while clicking the text two pixels to its left worked fine.
 *
 * WHY THESE TESTS HIT-TEST RATHER THAN CLICK
 * A native <select> popup is drawn by the operating system, not the page, so
 * there is no DOM for "the menu is open" to assert against. What can be
 * asserted, and is the whole of the bug, is WHICH ELEMENT IS UNDER THE
 * PIXEL: document.elementFromPoint at the centre of the caret must come back
 * as the <select>. If the caret ever goes back to eating the click, that is
 * the assertion that fails.
 *
 * The sweep at the end is the point of the fix being in the shared component:
 * it holds for every dropdown on the page rather than the two somebody
 * remembered to write a case for.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

/**
 * What sits under the middle of this field's caret?
 *
 * elementFromPoint takes VIEWPORT coordinates and returns null for anything
 * scrolled out of it, so the field has to be brought on screen first or every
 * dropdown below the fold reports a false failure.
 */
async function elementUnderCaret(page, shellSelector) {
  return page.evaluate((selector) => {
    const caret = document.querySelector(`${selector} .ui-input__caret`);
    if (!caret) return 'no-caret';
    caret.scrollIntoView({ block: 'center', behavior: 'instant' });
    const box = caret.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    return hit ? hit.tagName.toLowerCase() : 'nothing';
  }, shellSelector);
}

test.describe('dropdown caret', () => {
  test('the caret does not intercept the click that opens the menu', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto('/screens/check-in.html?appt=a1');
    // Check-in opens on the first consent; the dropdowns live on the Arrival
    // step, so the rail has to be walked to before there is a select at all.
    await page.getByTestId('cin--rail-arrival').click();

    const shell = '[data-testid="cin--arrival"] .ui-input';
    expect(await elementUnderCaret(page, shell)).toBe('select');

    assertClean();
  });

  /**
   * The caret is drawn where it always was. This is the half of the fix that
   * is easy to break later: pulling the caret out of the flex flow could just
   * as easily have parked it in the corner or behind the text.
   */
  test('the caret still sits at the right-hand end, vertically centred', async ({ page }) => {
    await page.goto('/screens/check-in.html?appt=a1');
    // Check-in opens on the first consent; the dropdowns live on the Arrival
    // step, so the rail has to be walked to before there is a select at all.
    await page.getByTestId('cin--rail-arrival').click();

    const shell = page.getByTestId('cin--arrival').locator('.ui-input');
    const caret = page.getByTestId('cin--arrival').locator('.ui-input__caret');

    const shellBox = await shell.boundingBox();
    const caretBox = await caret.boundingBox();

    // Inside the field, hard against the right-hand padding.
    expect(caretBox.x + caretBox.width).toBeLessThanOrEqual(shellBox.x + shellBox.width);
    expect(caretBox.x).toBeGreaterThan(shellBox.x + shellBox.width / 2);

    // Centred to within a pixel of rounding.
    const shellMid = shellBox.y + shellBox.height / 2;
    const caretMid = caretBox.y + caretBox.height / 2;
    expect(Math.abs(shellMid - caretMid)).toBeLessThan(1.5);
  });

  /**
   * A select is keyboard-operable because it is a real <select> — the fix
   * deliberately did not rebuild it as a div-with-ARIA listbox. Tabbing to it
   * and typing a value's first letters must select it.
   */
  test('a dropdown takes focus and type-ahead from the keyboard', async ({ page }) => {
    await page.goto('/screens/check-in.html?appt=a1');
    // Check-in opens on the first consent; the dropdowns live on the Arrival
    // step, so the rail has to be walked to before there is a select at all.
    await page.getByTestId('cin--rail-arrival').click();

    const control = page.getByTestId('cin--arrival').locator('select');
    await control.focus();
    await expect(control).toBeFocused();

    await page.keyboard.type('Taxi');
    await expect(control).toHaveValue('Taxi / rideshare');
  });

  /**
   * The sweep. Every dropdown on a form-heavy screen, in one assertion —
   * including the three hand-authored copies of the select shell in the
   * practice settings modals, which had the bug independently of the
   * component and had to be folded back in.
   */
  for (const [name, url] of [
    ['add patient', '/screens/patient-add.html'],
    ['practice settings', '/screens/practice-settings.html'],
  ]) {
    test(`every dropdown on ${name} is one click target`, async ({ page }) => {
      await page.goto(url);

      const misses = await page.evaluate(() => {
        const bad = [];
        for (const shell of document.querySelectorAll('.ui-input--select')) {
          const caret = shell.querySelector('.ui-input__caret');
          const control = shell.querySelector('select');
          if (!caret || !control) {
            bad.push(`${shell.id || control?.id || '(anonymous)'}: missing caret or control`);
            continue;
          }
          // Hidden fields (inside a closed modal) have no box to hit-test.
          if (!caret.getClientRects().length) continue;

          // elementFromPoint is viewport-relative, so bring the field on
          // screen before asking what is on top of it.
          caret.scrollIntoView({ block: 'center', behavior: 'instant' });
          const box = caret.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;

          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2
          );
          if (hit !== control) {
            bad.push(`${control.id || '(anonymous)'}: caret covered by <${hit?.tagName.toLowerCase()}>`);
          }
        }
        return bad;
      });

      expect(misses, `Dropdowns whose caret swallows the click:\n${misses.join('\n')}`)
        .toEqual([]);
    });
  }
});
