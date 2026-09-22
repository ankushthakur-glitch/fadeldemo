/**
 * Gallery specs — proves the components render, behave, and are accessible.
 * Screenshots are written to /tests/screenshots/ as visual-regression baselines.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
  heightOf,
} from '../helpers/page-helpers.js';

test.describe('component gallery', () => {
  test('renders with a clean console', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto('/gallery.html');
    await expect(page.getByRole('heading', { name: 'ui-button' })).toBeVisible();
    assertClean();
  });

  /* --- Sizing + density ------------------------------------------------- */

  // md is 34px, not the 32px approved at Phase 0 — MediNova draws its Input and
  // Button at 34 on node 40003459:32485, and "match Figma exactly" wins.
  test('control heights match GastroEMR — 24/28/34/40', async ({ page }) => {
    await page.goto('/gallery.html');
    const expected = { xs: 24, sm: 28, md: 34, lg: 40 };

    for (const [size, px] of Object.entries(expected)) {
      const button = page
        .getByTestId(`button--primary--${size}`)
        .locator('button');
      const actual = await heightOf(button);
      expect(
        Math.round(actual),
        `ui-button size="${size}" should be ${px}px tall`
      ).toBe(px);
    }
  });

  // MediNova draws 44px rows, so that is the default. The 36px Phase 0 rhythm
  // is still reachable with density="compact".
  test('table rows are 44px by default and 36px when compact', async ({ page }) => {
    await page.goto('/gallery.html');
    const table = page.getByTestId('data-table--ready--compact');
    const row = table.locator('tbody tr').first();
    await expect(row).toBeVisible();
    expect(Math.round(await heightOf(row)), 'default row height').toBe(44);

    await table.evaluate((el) => el.setAttribute('density', 'compact'));
    expect(Math.round(await heightOf(row)), 'compact row height').toBe(36);
  });

  /* --- Keyboard --------------------------------------------------------- */

  test('button is reachable by Tab and shows a focus ring', async ({ page }) => {
    await page.goto('/gallery.html');
    const button = page.getByTestId('button--primary--default').locator('button');
    await button.focus();
    await expect(button).toBeFocused();

    const shadow = await button.evaluate(
      (el) => getComputedStyle(el).boxShadow
    );
    expect(shadow, 'focused button must paint a visible ring').not.toBe('none');
  });

  test('disabled button cannot be focused or activated', async ({ page }) => {
    await page.goto('/gallery.html');
    const button = page.getByTestId('button--primary--disabled').locator('button');
    await expect(button).toBeDisabled();
  });

  test('table rows navigate with arrow keys', async ({ page }) => {
    await page.goto('/gallery.html');
    const rows = page.getByTestId('data-table--ready--compact').locator('tbody tr');
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toBeFocused();
  });

  /* --- Events ----------------------------------------------------------- */

  test('ui-button emits ui-click', async ({ page }) => {
    await page.goto('/gallery.html');
    const fired = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener('ui-click', () => resolve(true), { once: true });
        })
    );
    await page.getByTestId('button--primary--default').locator('button').click();
    expect(await fired).toBe(true);
  });

  // Regression guard: the tick element is always present in the DOM, so an
  // unchecked box must hide it. A wrong selector once left every checkbox
  // looking permanently ticked.
  test('an unchecked checkbox shows no tick', async ({ page }) => {
    await page.goto('/gallery.html');

    const unchecked = page.getByTestId('checkbox--default--unchecked');
    await expect(unchecked.locator('.ui-choice__mark')).toHaveCSS('opacity', '0');

    const checked = page.getByTestId('checkbox--default--checked');
    await expect(checked.locator('.ui-choice__mark')).toHaveCSS('opacity', '1');
  });

  test('ui-checkbox emits ui-change with the new state', async ({ page }) => {
    await page.goto('/gallery.html');
    const detail = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener(
            'ui-change',
            (e) => resolve(e.detail),
            { once: true }
          );
        })
    );
    await page.getByTestId('checkbox--default--unchecked').locator('input').check();
    expect(await detail).toEqual({ checked: true });
  });

  test('ui-data-table emits ui-sort when a header is clicked', async ({ page }) => {
    await page.goto('/gallery.html');
    const detail = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener('ui-sort', (e) => resolve(e.detail), { once: true });
        })
    );
    await page
      .getByTestId('data-table--ready--compact')
      .locator('[data-sort-key="name"]')
      .click();
    expect(await detail).toEqual({ key: 'name', direction: 'ascending' });
  });

  test('ui-chip emits ui-close and removes itself', async ({ page }) => {
    await page.goto('/gallery.html');
    const chip = page.getByTestId('chip--default--removable');
    await chip.locator('.ui-chip__remove').click();
    await expect(chip).toHaveCount(0);
  });

  /* --- Accessibility ---------------------------------------------------- */

  test('gallery has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto('/gallery.html');
    await expectNoA11yViolations(page, 'main.gallery');
  });

  /* --- Visual regression ------------------------------------------------ */

  const SECTIONS = ['button', 'badge', 'forms', 'alert', 'data-table'];

  for (const section of SECTIONS) {
    test(`visual — ${section}`, async ({ page }) => {
      await page.goto('/gallery.html');
      const region = page.locator(`#${section}`);
      await expect(region).toBeVisible();
      await expect(region).toHaveScreenshot(`${section}.png`);
    });
  }

  test('visual — button hover state', async ({ page }) => {
    await page.goto('/gallery.html');
    const button = page.getByTestId('button--primary--hover');
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
  });

  test('visual — button focus state', async ({ page }) => {
    await page.goto('/gallery.html');
    const button = page.getByTestId('button--primary--focus');
    await button.locator('button').focus();
    await expect(button).toHaveScreenshot('button-focus.png');
  });
});
