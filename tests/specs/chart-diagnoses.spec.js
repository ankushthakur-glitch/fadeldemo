/**
 * Chart — Diagnoses module.
 *
 * The maintained problem list: a table of what the patient is carrying, and
 * one window that both adds to it and corrects it. Reference: the two
 * screenshots supplied for this module.
 *
 * The three dates are the point of the screen — onset is when the condition
 * began, recorded is when this practice wrote it down, resolve is when it
 * stopped being true — so the tests below check they are kept apart rather
 * than filled from each other, and that the last of them only exists on a row
 * that has actually been closed.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_DIAGNOSES = '/screens/patient-chart.html?mrn=326486#diagnoses';

const table = (page) => page.getByTestId('chart--diagnoses-table');
const modal = (page) => page.getByTestId('chart--diagnosis-modal');

const openAdd = async (page) => {
  await page.getByTestId('chart--diagnosis-open').locator('button').click();
  await expect(modal(page)).toBeVisible();
};

/** Type a query into the ICD-10 box and take the first code it offers. */
const pickCode = async (page, query) => {
  const box = page.getByTestId('chart--diagnosis-code').locator('input');
  await box.click();
  await box.fill(query);
  await page.locator('.ui-icd10__opt').first().click();
};

test.describe('chart diagnoses module', () => {
  test('is reachable from the sidebar and opens with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, '/screens/patient-chart.html?mrn=326486#profile');

    await page.getByTestId('chart--nav-diagnoses').click();
    await expect(page.getByTestId('chart--module-title')).toHaveText('Diagnoses');

    await expect(table(page).locator('tbody tr')).toHaveCount(4);
    await expect(table(page)).toContainText('K21.9');
    await expect(table(page)).toContainText('K29.00');
    await expect(table(page)).toContainText('K57.30');

    assertClean();
  });

  test('carries the columns the record is kept in', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);

    const headers = table(page).locator('thead th');
    await expect(headers.nth(0)).toHaveText('No.');
    await expect(headers.nth(1)).toHaveText('Diagnoses');
    await expect(headers.nth(2)).toHaveText('Type');
    await expect(headers.nth(3)).toHaveText('Onset Date');
    await expect(headers.nth(4)).toHaveText('Recorded Date');
    await expect(headers.nth(5)).toHaveText('Resolve Date');
    await expect(headers.nth(6)).toHaveText('Status');
    await expect(headers.nth(7)).toHaveText('Note');

    // Numbered 001, 002, … — the reference's zero-padded series.
    const first = table(page).locator('tbody tr').first();
    await expect(first).toContainText('001');
    await expect(first).toContainText('Chronic');
    await expect(first).toContainText('Active');
  });

  /**
   * The wording of a code lives in data/icd10.js and nowhere else, so a row
   * storing K21.9 has to read as the catalogue reads it.
   */
  test('a row shows the code and the catalogue’s wording for it', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);

    await expect(table(page).locator('tbody tr').first()).toContainText(
      'K21.9 — Gastro-oesophageal reflux disease without oesophagitis'
    );
  });

  /* --- The window --------------------------------------------------------- */

  test('the window asks for every field the record keeps', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_DIAGNOSES);
    await openAdd(page);

    for (const id of [
      'chart--diagnosis-code',
      'chart--diagnosis-status',
      'chart--diagnosis-type',
      'chart--diagnosis-onset',
      'chart--diagnosis-note',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    assertClean();
  });

  /**
   * A date field asking when an Active condition ended is a question with no
   * true answer, and one that gets filled in anyway.
   */
  test('the resolve date appears only once the diagnosis is Historical', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);
    await openAdd(page);

    await expect(page.getByTestId('chart--diagnosis-resolve')).toBeHidden();

    await page.getByTestId('chart--diagnosis-status').getByLabel('Historical').check();
    await expect(page.getByTestId('chart--diagnosis-resolve')).toBeVisible();

    // And going back to Active takes the field away again, along with a date
    // that would otherwise be inherited invisibly on the next save.
    await page.getByTestId('chart--diagnosis-resolve').locator('input').fill('2026-01-05');
    await page.getByTestId('chart--diagnosis-status').getByLabel('Active').check();
    await expect(page.getByTestId('chart--diagnosis-resolve')).toBeHidden();
    await page.getByTestId('chart--diagnosis-status').getByLabel('Historical').check();
    await expect(page.getByTestId('chart--diagnosis-resolve').locator('input')).toHaveValue('');
  });

  test('a diagnosis with no code is refused', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);
    await openAdd(page);

    await page.getByTestId('chart--diagnosis-save').locator('button').click();

    await expect(modal(page)).toBeVisible();
    await expect(page.getByTestId('chart--diagnosis-code')).toContainText('Choose a diagnosis');
    await expect(table(page).locator('tbody tr')).toHaveCount(4);
  });

  test('adding one lands on the table and closes the window', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);
    await openAdd(page);

    await pickCode(page, 'celiac');
    await page.getByTestId('chart--diagnosis-type').getByLabel('Acute').check();
    await page.getByTestId('chart--diagnosis-onset').locator('input').fill('2024-05-06');
    await page.getByTestId('chart--diagnosis-note').locator('textarea').fill('Biopsy confirmed.');

    await page.getByTestId('chart--diagnosis-save').locator('button').click();

    await expect(modal(page)).toBeHidden();
    await expect(page.getByTestId('chart--flash')).toContainText('K90.0');

    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(5);
    const added = rows.nth(4);
    await expect(added).toContainText('005');
    await expect(added).toContainText('K90.0 — Celiac disease');
    await expect(added).toContainText('Acute');
    await expect(added).toContainText('Active');
    // Onset is the date given; recorded is today. They are not the same field.
    await expect(added).toContainText('06-05-2024');
    // Nothing has been resolved, so there is no resolve date to show.
    await expect(added).toContainText('—');
  });

  /* --- Editing ------------------------------------------------------------ */

  test('the pencil opens the row it belongs to, filled in', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_DIAGNOSES);

    await page.locator('[data-dx-edit="dx2"]').click();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page)).toContainText('Edit Diagnoses');
    await expect(page.getByTestId('chart--diagnosis-code').locator('input')).toHaveValue(
      'K29.00 — Acute gastritis without bleeding'
    );
    await expect(page.getByTestId('chart--diagnosis-type').getByLabel('Acute')).toBeChecked();
    await expect(
      page.getByTestId('chart--diagnosis-status').getByLabel('Historical')
    ).toBeChecked();
    await expect(page.getByTestId('chart--diagnosis-resolve').locator('input')).toHaveValue(
      '2025-12-23'
    );

    assertClean();
  });

  test('saving an edit writes over the row rather than adding one', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);

    await page.locator('[data-dx-edit="dx1"]').click();
    await page.getByTestId('chart--diagnosis-status').getByLabel('Historical').check();
    await page.getByTestId('chart--diagnosis-resolve').locator('input').fill('2026-02-11');
    await page.getByTestId('chart--diagnosis-save').locator('button').click();

    await expect(modal(page)).toBeHidden();
    await expect(page.getByTestId('chart--flash')).toContainText('saved');

    await expect(table(page).locator('tbody tr')).toHaveCount(4);
    const first = table(page).locator('tbody tr').first();
    await expect(first).toContainText('Historical');
    await expect(first).toContainText('11-02-2026');
    // Recorded is when the practice first wrote it down; a correction does not
    // move it.
    await expect(first).toContainText('04-10-2024');
  });

  /* --- Narrowing ---------------------------------------------------------- */

  test('the status filter narrows the list and can be put back', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);

    const filter = page.getByTestId('chart--diagnosis-filter').locator('select');
    await filter.selectOption('Historical');

    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('K29.00');
    // The number is the row's place in the RECORD, not in what is on screen.
    await expect(rows.first()).toContainText('002');

    await filter.selectOption('');
    await expect(table(page).locator('tbody tr')).toHaveCount(4);
  });

  /* Rows added on one patient must not follow the chart to the next. */
  test('a row added here does not follow the chart to another section', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);
    await openAdd(page);
    await pickCode(page, 'celiac');
    await page.getByTestId('chart--diagnosis-save').locator('button').click();
    await expect(table(page).locator('tbody tr')).toHaveCount(5);

    await page.getByTestId('chart--nav-allergies').click();
    await page.getByTestId('chart--nav-diagnoses').click();

    await expect(table(page).locator('tbody tr')).toHaveCount(4);
  });

  test('a patient with no diagnoses says so', async ({ page }) => {
    await openChart(page, '/screens/patient-chart.html?mrn=326481#diagnoses');

    await expect(table(page)).toContainText('No diagnoses recorded for this patient.');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_DIAGNOSES);
    await expectNoA11yViolations(page);
  });
});
