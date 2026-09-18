/**
 * THE DROPDOWN LIST IS THE PRODUCT'S, NOT THE OPERATING SYSTEM'S.
 *
 * Every dropdown here is still a real <select> — that has not changed and must
 * not, because it is what gives the control its value, its events, its
 * keyboard and its accessible role. What changed is the list it drops: the
 * platform popup is refused and js/lib/select-menu.js draws .ui-select-menu in
 * its place.
 *
 * WHAT THESE TESTS ARE FOR
 * The old caret spec (select-caret.spec.js) could only hit-test, because a
 * native popup is drawn by the OS and has no DOM to assert against. This one
 * can assert the whole thing, and the assertions that matter are the ones
 * about EQUIVALENCE — a replaced control has to keep every promise the one it
 * replaced made:
 *
 *   - the same options, in the same order
 *   - a selection reports itself through `change`, the event every screen in
 *     this product is already listening for
 *   - the keyboard still opens, moves, commits and cancels
 *   - Playwright's selectOption still drives it, which is the same statement
 *     as "it is still a <select>" and is what keeps every other spec in this
 *     directory green
 *
 * The last one is the load-bearing test. If a future rewrite replaces the
 * <select> with a div-and-ARIA listbox, that is the assertion that fails.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

/** Title on Add Patient: a short list, nothing chosen to start with. */
const FIELD = '#title';

test.describe('the dropdown menu', () => {
  test('a press on the field opens the product\'s own list', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto('/screens/patient-add.html');

    await expect(page.locator('.ui-select-menu')).toHaveCount(0);
    await page.locator(`${FIELD} select`).click();

    const menu = page.locator('.ui-select-menu');
    await expect(menu).toBeVisible();

    // The same options the <select> holds, in the same order — bar the
    // placeholder, which is hidden because it is the question rather than one
    // of the answers, and is therefore not a row anything can land on.
    const optionText = await page
      .locator(`${FIELD} select option:not([hidden])`)
      .allTextContents();
    await expect(menu.locator('.ui-select-menu__option')).toHaveText(
      optionText.map((text) => text.trim())
    );

    assertClean();
  });

  test('choosing a row sets the value and fires change', async ({ page }) => {
    await page.goto('/screens/patient-add.html');

    /* Counted on the document, not on the element: <ui-select> rebuilds its
       markup when the value changes, so the <select> the event came from is
       already detached by the time a listener bound to it would be re-queried. */
    const changes = await page.evaluateHandle(() => {
      const log = { count: 0 };
      document.addEventListener('change', (event) => {
        if (event.target.tagName === 'SELECT') log.count += 1;
      });
      return log;
    });

    await page.locator(`${FIELD} select`).click();
    await page.locator('.ui-select-menu__option', { hasText: 'Employee' }).click();

    await expect(page.locator('.ui-select-menu')).toHaveCount(0);
    await expect(page.locator(`${FIELD} select`)).toHaveValue('Employee');
    expect(await changes.evaluate((log) => log.count)).toBe(1);
  });

  /**
   * The panel takes focus, so the keyboard is answered by the list rather than
   * by the field underneath it. Opening lands on whatever is already chosen —
   * the first arrow key steps OFF the current answer, not off the top.
   */
  test('the keyboard opens, moves, commits and cancels', async ({ page }) => {
    await page.goto('/screens/patient-add.html');

    const control = page.locator(`${FIELD} select`);
    await control.focus();
    await page.keyboard.press('ArrowDown');

    const menu = page.locator('.ui-select-menu');
    await expect(menu).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(page.locator(`${FIELD} select`)).toHaveValue('Patient');

    // Escape closes the list and leaves the answer alone.
    await page.locator(`${FIELD} select`).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.ui-select-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ui-select-menu')).toHaveCount(0);
    await expect(page.locator(`${FIELD} select`)).toHaveValue('Patient');
  });

  test('a press outside puts the list away without choosing anything', async ({ page }) => {
    await page.goto('/screens/patient-add.html');

    await page.locator(`${FIELD} select`).click();
    await expect(page.locator('.ui-select-menu')).toBeVisible();

    await page.locator('h1').click();
    await expect(page.locator('.ui-select-menu')).toHaveCount(0);
    await expect(page.locator(`${FIELD} select`)).toHaveValue('');
  });

  /**
   * IT IS STILL A <select>.
   *
   * Every other spec in this directory drives a dropdown with selectOption,
   * which only works on a real <select>. This asserts the contract those
   * specs are quietly relying on.
   */
  test('selectOption still drives it', async ({ page }) => {
    await page.goto('/screens/patient-add.html');

    await page.locator(`${FIELD} select`).selectOption('Provider');
    await expect(page.locator(`${FIELD} select`)).toHaveValue('Provider');
  });

  /**
   * A dropdown inside a dialog is a list ON that dialog. The panel is parented
   * to <body> and sits at --z-select-menu, one step above --z-modal, so it is
   * not drawn behind the window it belongs to.
   */
  test('a dropdown inside a modal draws over it', async ({ page }) => {
    await page.goto('/screens/practice-settings.html');
    await page.evaluate(() => document.getElementById('rolRoleModal').open());

    const status = page.locator('#rolRoleStatus select');
    await status.click();

    const menu = page.locator('.ui-select-menu');
    await expect(menu).toBeVisible();

    // Over the dialog, not under it: the row is what the pointer would hit.
    const row = menu.locator('.ui-select-menu__option', { hasText: 'Inactive' });
    const box = await row.boundingBox();
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.className,
      [box.x + box.width / 2, box.y + box.height / 2]
    );
    expect(hit).toContain('ui-select-menu__option');
  });
});
