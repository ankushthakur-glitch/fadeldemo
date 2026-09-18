/**
 * ui-input states, against the MediNova input component sheet:
 * empty, filled, hover, focus, error, disabled.
 *
 * The brand colour stays green — only the shape of the states changed.
 */
import { test, expect } from '@playwright/test';

const GALLERY = '/gallery.html';

const shellOf = (page, testid) => page.getByTestId(testid).locator('.ui-input');

test.describe('input states', () => {
  test('empty and filled sit on the plain surface', async ({ page }) => {
    await page.goto(GALLERY);
    const shell = shellOf(page, 'input--md--default');

    await expect(shell).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(shell).toHaveCSS('border-color', 'rgb(209, 209, 214)'); // Stroke/04
  });

  test('hover darkens the border without moving anything', async ({ page }) => {
    await page.goto(GALLERY);
    const shell = shellOf(page, 'input--md--default');
    const before = await shell.boundingBox();

    await shell.hover();
    await expect(shell).toHaveCSS('border-color', 'rgb(190, 190, 194)'); // Stroke/06

    // A hover that resizes the field makes a form jitter under the cursor.
    const after = await shell.boundingBox();
    expect(Math.round(after.height)).toBe(Math.round(before.height));
  });

  /**
   * Focus is a thin border plus a soft halo. The old two-tone 4px ring
   * doubled the field's visual weight and read as an error state.
   */
  test('focus is a thin green border with a soft halo', async ({ page }) => {
    await page.goto(GALLERY);
    const field = page.getByTestId('input--md--default');
    const shell = field.locator('.ui-input');

    await field.locator('input').focus();

    await expect(shell).toHaveCSS('border-color', 'rgb(9, 112, 0)'); // #097000

    const shadow = await shell.evaluate((el) => getComputedStyle(el).boxShadow);
    // The halo is the brand tint, not the two-tone ring used elsewhere.
    expect(shadow, 'the halo is the brand tint').toContain('233, 245, 231'); // #e9f5e7
    // Spread is ~3px; Chromium reports it as 2.99999, so match the number
    // rather than the literal string.
    const spread = Number(shadow.match(/([\d.]+)px\s*$/)?.[1]);
    expect(spread).toBeGreaterThan(2.5);
    expect(spread, 'a thin halo, not the old 4px double ring').toBeLessThan(3.5);
  });

  test('error tints the field and leads the message with an icon', async ({ page }) => {
    await page.goto(GALLERY);
    const field = page.getByTestId('input--md--error');
    const shell = field.locator('.ui-input');

    await expect(shell).toHaveCSS('border-color', 'rgb(179, 38, 30)');
    await expect(shell).toHaveCSS('background-color', 'rgb(253, 236, 234)');

    // Colour is never the only signal.
    const message = field.locator('.ui-field__hint--error');
    await expect(message).toBeVisible();
    await expect(message.locator('.ui-icon')).toHaveCount(1);
    await expect(message).toHaveAttribute('role', 'alert');
  });

  test('an errored field keeps its red border on hover and focus', async ({ page }) => {
    await page.goto(GALLERY);
    const field = page.getByTestId('input--md--error');
    const shell = field.locator('.ui-input');

    await shell.hover();
    await expect(shell).toHaveCSS('border-color', 'rgb(179, 38, 30)');

    await field.locator('input').focus();
    await expect(shell).toHaveCSS('border-color', 'rgb(179, 38, 30)');
  });

  test('disabled is filled and not focusable', async ({ page }) => {
    await page.goto(GALLERY);
    const field = page.getByTestId('input--md--disabled');

    await expect(field.locator('.ui-input')).toHaveCSS(
      'background-color',
      'rgb(243, 242, 241)' // Grey/01
    );
    await expect(field.locator('input')).toBeDisabled();
  });

  test('the three sizes are distinct and ordered', async ({ page }) => {
    await page.goto(GALLERY);
    const small = await shellOf(page, 'input--sm--default').boundingBox();
    const medium = await shellOf(page, 'input--md--default').boundingBox();

    expect(small.height).toBeLessThan(medium.height);
  });

  test('visual — input states', async ({ page }) => {
    await page.goto(GALLERY);
    await expect(page.locator('#forms')).toBeVisible();
    await expect(page.locator('#forms')).toHaveScreenshot('input-states.png');
  });

  test('visual — input focus', async ({ page }) => {
    await page.goto(GALLERY);
    const field = page.getByTestId('input--md--default');
    await field.locator('input').focus();
    await expect(field).toHaveScreenshot('input-focus.png');
  });
});
