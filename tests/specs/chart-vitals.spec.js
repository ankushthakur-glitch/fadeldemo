/**
 * Chart — Vitals module.
 *
 * A table of recorded vitals, newest first, where any row can expand into a
 * per-metric note section directly beneath it. Reference: the three
 * screenshots supplied for this module.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_VITALS = '/screens/patient-chart.html?mrn=326486#vitals';

test.describe('chart vitals module', () => {
  test('opens with the seeded rows, newest first', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_VITALS);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Vitals');
    const rows = page.locator('.vt__row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('20-07-2025');
    await expect(rows.nth(1)).toContainText('15-04-2025');

    assertClean();
  });

  test('the module title is not repeated inside the panel', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    // chart-workspace.js already renders "Vitals" once, in the module head;
    // this module must not render it again inside its own toolbar.
    await expect(page.locator('.ch__workspace').getByText('Vitals', { exact: true })).toHaveCount(1);
  });

  /* --- Note expansion ----------------------------------------------------- */

  test('View Note expands a per-metric grid directly under its own row', async ({
    page,
  }) => {
    await openChart(page, HENNA_VITALS);
    const firstRow = page.locator('.vt__row').first();
    const noteRow = page.locator('.vt__note-row').first();

    await expect(noteRow).toHaveCount(0);
    await firstRow.locator('[data-vt-toggle]').click();

    await expect(noteRow).toBeVisible();
    await expect(noteRow).toContainText('Height');
    await expect(noteRow).toContainText('68 in (173 cm)');
    await expect(noteRow).toContainText('Blood Pressure');
    await expect(noteRow).toContainText('118/76 mmHg');

    // Toggling again collapses it, and the button relabels both times.
    await expect(firstRow.getByText('Hide Note')).toBeVisible();
    await firstRow.locator('[data-vt-toggle]').click();
    await expect(noteRow).toHaveCount(0);
    await expect(firstRow.getByText('View Note')).toBeVisible();
  });

  /**
   * Regression guard: a long note paragraph must WRAP inside its own column,
   * not overflow into the next one. The first version lost this fight to
   * .ui-table's own `white-space: nowrap` on specificity — the override
   * class alone wasn't specific enough to beat it, so the text just ran on
   * and visually collided with the neighbouring column.
   */
  test('a long note paragraph wraps within its own column', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    await page.locator('.vt__row').first().locator('[data-vt-toggle]').click();

    const bmiParagraph = page.locator('.vt__note-item', { hasText: 'BMI' }).locator('p');
    await expect(bmiParagraph).toHaveCSS('white-space', 'normal');

    // A wrapped paragraph is taller than one line; an overflowing one is not.
    const box = await bmiParagraph.boundingBox();
    const lineHeight = await bmiParagraph.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(box.height).toBeGreaterThan(lineHeight * 1.5);
  });

  /* --- Add Vitals ----------------------------------------------------------- */

  test('a missing date is refused', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    await page.getByTestId('chart--add-vitals').locator('button').click();
    await page.getByTestId('chart--vitals-save').locator('button').click();

    await expect(page.getByTestId('chart--vitals-add-date')).toContainText('Enter a date.');
    await expect(page.locator('.vt__row')).toHaveCount(2);
  });

  test('Add Vitals inserts at the top and keeps only the notes actually typed', async ({
    page,
  }) => {
    await openChart(page, HENNA_VITALS);
    await page.getByTestId('chart--add-vitals').locator('button').click();

    await page.getByTestId('chart--vitals-add-date').locator('input').fill('2026-08-06');
    await page.getByTestId('chart--vitals-add-height').locator('input').fill('70');
    await page.getByTestId('chart--vitals-add-height-note').locator('input').fill('Measured standing.');
    await page.getByTestId('chart--vitals-add-weight').locator('input').fill('180');
    // Weight's own Note field is left blank on purpose.
    await page.getByTestId('chart--vitals-save').locator('button').click();

    const rows = page.locator('.vt__row');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('06-08-2026'); // newest, so first
    await expect(rows.first()).toContainText('70" in');
    await expect(rows.first()).toContainText('180 lb');
    await expect(page.getByTestId('chart--flash')).toContainText('Vitals recorded.');

    await rows.first().locator('[data-vt-toggle]').click();
    const noteRow = page.locator('.vt__note-row').first();
    await expect(noteRow).toContainText('Measured standing.');
    // Honest about what was not filled in, rather than fabricating text.
    await expect(noteRow.locator('.vt__note-item', { hasText: 'Weight' })).toContainText(
      'No note added.'
    );
  });

  test('Cancel discards whatever was typed', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    await page.getByTestId('chart--add-vitals').locator('button').click();
    await page.getByTestId('chart--vitals-add-date').locator('input').fill('2026-08-06');
    await page.getByTestId('chart--vitals-cancel').locator('button').click();

    await expect(page.locator('#vtAddModal .ui-modal')).toBeHidden();
    await expect(page.locator('.vt__row')).toHaveCount(2);
  });

  /* --- Edit Vitals -----------------------------------------------------------
     A reading typed a digit out is a number the chart keeps asserting — and,
     through BMI, keeps reasoning from. Until Edit existed the only way back
     was to add a second, contradictory row, so these tests are as much about
     the row COUNT not moving as about the value changing.
     -------------------------------------------------------------------- */

  test('Edit opens the dialog on the row it was pressed from', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_VITALS);

    await page.locator('.vt__row').first().getByTestId('chart--vitals-edit').click();

    await expect(page.getByRole('heading', { name: 'Edit Vitals' })).toBeVisible();
    // Prefilled from the row, not blank: this is a correction, not a new entry.
    await expect(page.getByTestId('chart--vitals-add-weight').locator('input')).toHaveValue('175');
    await expect(page.getByTestId('chart--vitals-save')).toContainText('Save Changes');

    assertClean();
  });

  test('an edit is written back into the same row, not added as a new one', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    const rows = page.locator('.vt__row');

    await rows.first().getByTestId('chart--vitals-edit').click();
    await page.getByTestId('chart--vitals-add-weight').locator('input').fill('172');
    await page.getByTestId('chart--vitals-save').locator('button').click();

    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('172 lb');
    await expect(page.getByTestId('chart--flash')).toContainText('Vitals updated.');
  });

  /* The dialog is one dialog doing two jobs, so the job it did last must not
     leak into the next one: pressing Add straight after abandoning an Edit
     used to reopen the fields still holding that row. */
  test('Add after a cancelled edit opens a blank dialog', async ({ page }) => {
    await openChart(page, HENNA_VITALS);

    await page.locator('.vt__row').first().getByTestId('chart--vitals-edit').click();
    await page.getByTestId('chart--vitals-cancel').locator('button').click();

    await page.getByTestId('chart--add-vitals').locator('button').click();
    await expect(page.getByRole('heading', { name: 'Add Vitals' })).toBeVisible();
    await expect(page.getByTestId('chart--vitals-add-weight').locator('input')).toHaveValue('');
  });

  test('an edit reaches the notes as well as the readings', async ({ page }) => {
    await openChart(page, HENNA_VITALS);

    await page.locator('.vt__row').first().getByTestId('chart--vitals-edit').click();
    await page
      .getByTestId('chart--vitals-add-weight-note')
      .locator('input')
      .fill('Re-weighed on the clinic scale.');
    await page.getByTestId('chart--vitals-save').locator('button').click();

    await page.locator('.vt__row').first().locator('[data-vt-toggle]').click();
    await expect(page.locator('.vt__note-row').first()).toContainText(
      'Re-weighed on the clinic scale.'
    );
  });

  /* --- Date filter ----------------------------------------------------------- */

  test('the date filter narrows to an exact match, and clearing it restores the list', async ({
    page,
  }) => {
    await openChart(page, HENNA_VITALS);
    const rows = page.locator('.vt__row');

    await page.getByTestId('chart--vitals-date-filter').locator('input').fill('2025-07-20');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('20-07-2025');

    await page.getByTestId('chart--vitals-date-filter').locator('input').fill('');
    await expect(rows).toHaveCount(2);
  });

  test('a date with no vitals shows the empty state, not a blank table', async ({
    page,
  }) => {
    await openChart(page, HENNA_VITALS);
    await page.getByTestId('chart--vitals-date-filter').locator('input').fill('2020-01-01');

    await expect(page.locator('.vt__empty')).toContainText('No vitals recorded for that date.');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_VITALS);
    await expectNoA11yViolations(page);
  });
});
