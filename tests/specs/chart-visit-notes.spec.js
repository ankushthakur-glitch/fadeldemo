/**
 * Chart — Visit Notes module.
 *
 * A single read-only worklist, "Past Appointments" — reference: the
 * attached screenshot. Appointment Status and Bill Status render as
 * <ui-badge> pills rather than the reference's plain coloured text, to
 * match every other status column in this chart.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_VISIT_NOTES = '/screens/patient-chart.html?mrn=326486#visit-notes';

test.describe('chart visit notes module', () => {
  test('opens with the seeded appointments, newest first', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_VISIT_NOTES);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Visit Notes');
    const rows = page.getByTestId('chart--visit-notes-table').locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('001');
    await expect(rows.first()).toContainText('23-10-2025');
    await expect(rows.first()).toContainText('Surveillance colonoscopy');

    assertClean();
  });

  test('Appointment Status and Bill Status render as badges', async ({ page }) => {
    await openChart(page, HENNA_VISIT_NOTES);
    const firstRow = page.getByTestId('chart--visit-notes-table').locator('tbody tr').first();

    await expect(firstRow.locator('ui-badge', { hasText: 'Completed' })).toBeVisible();
    await expect(firstRow.locator('ui-badge', { hasText: 'Paid' })).toBeVisible();
  });

  test('a visit with no bill status shows a dash, not a fabricated badge', async ({ page }) => {
    await openChart(page, '/screens/patient-chart.html?mrn=326495#visit-notes');
    const row = page.getByTestId('chart--visit-notes-table').locator('tbody tr').first();
    await expect(row).toContainText('—');
  });

  test('the row menu opens an honest stub, not a dead link', async ({ page }) => {
    await openChart(page, HENNA_VISIT_NOTES);
    await page.locator('[data-vn-menu]').first().click();
    await page.getByRole('menuitem', { name: 'View Encounter' }).click();

    await expect(page.getByTestId('chart--flash')).toContainText(
      "This encounter's detail isn't viewable from Visit Notes in this prototype yet."
    );
  });

  test('a patient with no visits shows the empty state, not a blank table', async ({ page }) => {
    await openChart(page, '/screens/patient-chart.html?mrn=326481#visit-notes');
    await expect(page.getByText('No appointments on file.')).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_VISIT_NOTES);
    await expectNoA11yViolations(page);
  });
});
