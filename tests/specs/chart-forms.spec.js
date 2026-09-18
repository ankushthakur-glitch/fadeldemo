/**
 * Chart — Forms module: Print and Download as PDF, alongside the existing
 * View / Fill out.
 *
 * window.print() is stubbed before every test in this file — headless
 * Chromium has no real print dialog to drive, and the point of these tests
 * is the PAGE'S behaviour around the call (what gets built, what class goes
 * on, what comes off on afterprint), not the browser's own print UI. Each
 * test fires a synthetic `afterprint` itself to stand in for the dialog
 * closing, since headless Chromium does not reliably fire it on its own
 * after a stubbed print().
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_FORMS = '/screens/patient-chart.html?mrn=326486#forms';

async function stubPrint(page) {
  await page.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });
}

test.describe('chart forms module', () => {
  test('opens with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_FORMS);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Forms');
    await expect(page.getByTestId('chart--forms-table').locator('tbody tr')).toHaveCount(7);

    assertClean();
  });

  test('the row menu offers View, Print and Download as PDF together', async ({ page }) => {
    await openChart(page, HENNA_FORMS);
    const row = page.getByTestId('chart--forms-table').locator('tbody tr').filter({ hasText: 'PHQ-9 Form' });

    await row.locator('[data-form-menu]').click();
    await expect(page.getByRole('menuitem', { name: 'View' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Print' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Download as PDF' })).toBeVisible();
  });

  test('Print builds the print sheet and calls window.print()', async ({ page }) => {
    await openChart(page, HENNA_FORMS);
    await stubPrint(page);

    const row = page
      .getByTestId('chart--forms-table')
      .locator('tbody tr')
      .filter({ hasText: 'Patient Interview Form' });
    await row.locator('[data-form-menu]').click();
    await page.getByRole('menuitem', { name: 'Print' }).click();

    await expect(page.getByTestId('chart--forms-print-sheet')).toContainText('Patient Interview Form');
    await expect(page.getByTestId('chart--forms-print-sheet')).toContainText('Henna West');
    await expect(page.locator('body')).toHaveClass(/frm--printing/);
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);

    // Simulate the dialog closing — headless Chromium does not fire this
    // reliably on its own after a stubbed print().
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('body')).not.toHaveClass(/frm--printing/);
  });

  test('a schema-less form prints the honest record, not fabricated content', async ({ page }) => {
    await openChart(page, HENNA_FORMS);
    await stubPrint(page);

    const row = page.getByTestId('chart--forms-table').locator('tbody tr').filter({ hasText: 'PHQ-9 Form' });
    await row.locator('[data-form-menu]').click();
    await page.getByRole('menuitem', { name: 'Print', exact: true }).click();

    const sheet = page.getByTestId('chart--forms-print-sheet');
    await expect(sheet).toContainText('PHQ-9 Form');
    await expect(sheet).toContainText('does not know what is');
  });

  test('Download as PDF sets a descriptive document title while printing, restored after', async ({
    page,
  }) => {
    await openChart(page, HENNA_FORMS);
    await stubPrint(page);
    const titleBefore = await page.title();

    const row = page
      .getByTestId('chart--forms-table')
      .locator('tbody tr')
      .filter({ hasText: 'Patient Interview Form' });
    await row.locator('[data-form-menu]').click();
    await page.getByRole('menuitem', { name: 'Download as PDF' }).click();

    await expect(page).toHaveTitle('Patient Interview Form — Henna West');

    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page).toHaveTitle(titleBefore);
  });

  test('Print does not change the document title', async ({ page }) => {
    await openChart(page, HENNA_FORMS);
    await stubPrint(page);
    const titleBefore = await page.title();

    const row = page.getByTestId('chart--forms-table').locator('tbody tr').filter({ hasText: 'PHQ-9 Form' });
    await row.locator('[data-form-menu]').click();
    await page.getByRole('menuitem', { name: 'Print', exact: true }).click();

    await expect(page).toHaveTitle(titleBefore);
  });

  test('View still opens the fill-out dialog for an uncompleted, schema-backed form', async ({
    page,
  }) => {
    await openChart(page, HENNA_FORMS);
    const row = page.getByTestId('chart--forms-table').locator('tbody tr').filter({ hasText: 'Release Of Information' });

    await row.locator('[data-form-menu]').click();
    await page.getByRole('menuitem', { name: 'Fill out' }).click();
    await expect(page.getByTestId('chart--forms-fill-modal')).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_FORMS);
    await expectNoA11yViolations(page);
  });
});
