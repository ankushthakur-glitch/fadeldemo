/**
 * Chart — Allergies module.
 *
 * The maintained allergy record: a table of what the patient reacts to, and a
 * side drawer that adds to it. Reference: the two screenshots supplied for
 * this module.
 *
 * The two date columns are the point of the screen — onset is when the patient
 * first reacted, recorded is when the practice learned of it — so the tests
 * below check they are kept apart rather than filled from each other.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_ALLERGIES = '/screens/patient-chart.html?mrn=326486#allergies';

const table = (page) => page.getByTestId('chart--allergies-table');
const openDrawer = async (page) => {
  await page.getByTestId('chart--allergy-open').locator('button').click();
  await expect(page.getByTestId('chart--allergy-drawer')).toBeVisible();
};

test.describe('chart allergies module', () => {
  test('is reachable from the sidebar and opens with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, '/screens/patient-chart.html?mrn=326486#profile');

    await page.getByTestId('chart--nav-allergies').click();
    await expect(page.getByTestId('chart--module-title')).toHaveText('Allergies');

    await expect(table(page).locator('tbody tr')).toHaveCount(3);
    await expect(table(page)).toContainText('Sertraline');
    await expect(table(page)).toContainText('Lithium');
    await expect(table(page)).toContainText('Caffeine');

    assertClean();
  });

  test('carries the columns the record is kept in', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);

    const headers = table(page).locator('thead th');
    await expect(headers.nth(0)).toHaveText('No.');
    await expect(headers.nth(1)).toHaveText('Allergy Type');
    await expect(headers.nth(2)).toHaveText('Allergies');
    await expect(headers.nth(3)).toHaveText('Reaction');
    await expect(headers.nth(4)).toHaveText('Severity');
    await expect(headers.nth(5)).toHaveText('Onset Date');
    await expect(headers.nth(6)).toHaveText('Recorded date');
    await expect(headers.nth(7)).toHaveText('Recorded By');

    // Numbered 001, 002, 003 — the reference's zero-padded series.
    const first = table(page).locator('tbody tr').first();
    await expect(first).toContainText('001');
    await expect(first).toContainText('Phyllis Nguyen');
  });

  /* --- The drawer --------------------------------------------------------- */

  test('the drawer asks for every field the record keeps', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_ALLERGIES);
    await openDrawer(page);

    for (const id of [
      'chart--allergy-type',
      'chart--allergy-name',
      'chart--allergy-reaction',
      'chart--allergy-severity',
      'chart--allergy-onset',
      'chart--allergy-recorded-by',
      'chart--allergy-note',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    assertClean();
  });

  /**
   * Picking Food and then being offered Penicillin is how a wrong allergen
   * gets filed against the right patient.
   */
  test('the allergen list follows the type, and a stale pick is dropped', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);
    await openDrawer(page);

    const name = page.getByTestId('chart--allergy-name');
    await expect(name.locator('option')).toContainText(['Amoxicillin']);
    await name.locator('select').selectOption('Amoxicillin');

    await page.getByTestId('chart--allergy-type').getByLabel('Food').check();

    await expect(name.locator('option')).toContainText(['Caffeine']);
    await expect(name.locator('option')).not.toContainText(['Amoxicillin']);
    // The drug chosen under the old type does not survive the switch.
    await expect(name.locator('select')).toHaveValue('');
  });

  test('an allergy with no allergen is refused', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);
    await openDrawer(page);

    await page.getByTestId('chart--allergy-add').locator('button').click();

    await expect(page.getByTestId('chart--allergy-drawer')).toBeVisible();
    await expect(page.getByTestId('chart--allergy-name')).toContainText('Choose an allergy');
    await expect(table(page).locator('tbody tr')).toHaveCount(3);
  });

  test('adding one lands on the table and closes the drawer', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);
    await openDrawer(page);

    await page.getByTestId('chart--allergy-type').getByLabel('Environment').check();
    await page.getByTestId('chart--allergy-name').locator('select').selectOption('Latex');
    await page.getByTestId('chart--allergy-reaction').locator('select').selectOption('Hives');
    await page.getByTestId('chart--allergy-severity').locator('select').selectOption('Moderate');
    await page.getByTestId('chart--allergy-onset').locator('input').fill('2025-03-04');
    await page
      .getByTestId('chart--allergy-recorded-by')
      .locator('select')
      .selectOption('Richard Walker');

    await page.getByTestId('chart--allergy-add').locator('button').click();

    await expect(page.getByTestId('chart--allergy-drawer')).toBeHidden();
    await expect(page.getByTestId('chart--flash')).toContainText('Latex added');

    const rows = table(page).locator('tbody tr');
    await expect(rows).toHaveCount(4);
    const added = rows.nth(3);
    await expect(added).toContainText('004');
    await expect(added).toContainText('Environment');
    await expect(added).toContainText('Latex');
    await expect(added).toContainText('Hives');
    // Onset is the date given; recorded is today. They are not the same field.
    await expect(added).toContainText('04-03-2025');
    await expect(added).not.toContainText('04-03-2025 04-03-2025');
  });

  /* Rows added on one patient must not follow the chart to the next. */
  test('a row added here does not follow the chart to another patient', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);
    await openDrawer(page);
    await page.getByTestId('chart--allergy-name').locator('select').selectOption('Codeine');
    await page.getByTestId('chart--allergy-add').locator('button').click();
    await expect(table(page).locator('tbody tr')).toHaveCount(4);

    await page.getByTestId('chart--nav-medications').click();
    await page.getByTestId('chart--nav-allergies').click();

    await expect(table(page).locator('tbody tr')).toHaveCount(3);
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_ALLERGIES);
    await expectNoA11yViolations(page);
  });
});
