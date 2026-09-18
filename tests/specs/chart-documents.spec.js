/**
 * Chart — Documents module.
 *
 * A search + Upload row above a table of Document Name / Document Type /
 * Uploaded By / Uploaded Date, and an upload dialog. Reference: the two
 * screenshots supplied for this module.
 *
 * The interesting cases here are the ones a screenshot cannot show: that
 * search and sort agree about which rows exist, and that the sidebar and the
 * number of rows never disagree.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_DOCS = '/screens/patient-chart.html?mrn=326486#documents';
const ZOE_DOCS = '/screens/patient-chart.html?mrn=326495#documents';

/** Every seeded row for Henna West, per data/chart-documents.js. */
const HENNA_COUNT = 11;

test.describe('chart documents module', () => {
  test('renders the reference columns and the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_DOCS);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Documents');

    const table = page.getByTestId('chart--doc-table');
    for (const column of ['Document Name', 'Document Type', 'Uploaded By', 'Uploaded Date']) {
      await expect(table.locator('thead')).toContainText(column);
    }
    await expect(table.locator('tbody tr')).toHaveCount(HENNA_COUNT);

    assertClean();
  });

  /**
   * The rail carries no badge any more — a section names a place and the list
   * under it is the tally — so what is checked here is that nothing in the
   * sidebar claims a number the table would have to agree with.
   */
  test('the sidebar names the section and counts nothing', async ({ page }) => {
    await openChart(page, HENNA_DOCS);

    await expect(page.getByTestId('chart--nav-documents')).toHaveText(/Documents/);
    await expect(page.getByTestId('chart--count-documents')).toHaveCount(0);
    await expect(
      page.getByTestId('chart--doc-table').locator('tbody tr')
    ).toHaveCount(HENNA_COUNT);
  });

  test('opens newest first', async ({ page }) => {
    await openChart(page, HENNA_DOCS);

    const dates = await page
      .getByTestId('chart--doc-table')
      .locator('tbody tr td:nth-child(4)')
      .allInnerTexts();

    // dd-mm-yyyy → yyyy-mm-dd before comparing, or "18-01-2026" sorts below
    // "23-10-2025" as text.
    const iso = dates.map((value) => value.trim().split('-').reverse().join('-'));
    expect(iso).toEqual([...iso].sort().reverse());
  });

  test('search filters on name, type and uploader', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    const rows = page.getByTestId('chart--doc-table').locator('tbody tr');

    await page.getByTestId('chart--doc-search').locator('input').fill('pathology');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Polyp Histology');

    // "LabCorp" is an uploader, not a name or a type.
    await page.getByTestId('chart--doc-search').locator('input').fill('LabCorp');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('chart--doc-search').locator('input').fill('');
    await expect(rows).toHaveCount(HENNA_COUNT);
  });

  /**
   * The search box is outside the element that gets rebuilt when the row set
   * changes. If that ever stops being true, typing a second character loses
   * the caret — and the field appears to swallow every other keystroke.
   */
  test('typing in search does not steal focus', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    const input = page.getByTestId('chart--doc-search').locator('input');

    await input.click();
    await page.keyboard.type('consent');

    await expect(input).toBeFocused();
    await expect(input).toHaveValue('consent');
  });

  test('a header sorts the column', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    const names = page.getByTestId('chart--doc-table').locator('tbody tr td:nth-child(1)');

    await page.getByRole('button', { name: 'Document Name' }).click();
    const ascending = (await names.allInnerTexts()).map((v) => v.trim());
    expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b)));

    await page.getByRole('button', { name: 'Document Name' }).click();
    const descending = (await names.allInnerTexts()).map((v) => v.trim());
    expect(descending).toEqual([...ascending].reverse());
  });

  /* ------------------------------------------------------------------------
     UPLOAD
     ---------------------------------------------------------------------- */

  test('the dialog refuses an empty form and names every problem at once', async ({
    page,
  }) => {
    await openChart(page, HENNA_DOCS);
    await page.getByTestId('chart--doc-upload').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('chart--doc-add').click();

    // Still open, and all three problems are stated together rather than one
    // press of Add at a time.
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('chart--doc-name')).toContainText('Enter a document name');
    await expect(page.getByTestId('chart--doc-type')).toContainText('Choose a document type');
    await expect(page.locator('#docUploadError')).toContainText('Choose a file to upload');
  });

  test('a complete upload lands at the top of the table', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    await page.getByTestId('chart--doc-upload').click();

    await page.getByTestId('chart--doc-name').locator('input').fill('Pathology Addendum');
    await page.getByTestId('chart--doc-type').locator('select').selectOption('Pathology Report');
    await page
      .getByTestId('chart--doc-file')
      .locator('input[type=file]')
      .setInputFiles({
        name: 'addendum.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 test fixture'),
      });

    await page.getByTestId('chart--doc-add').click();

    await expect(page.getByRole('dialog')).toBeHidden();

    const rows = page.getByTestId('chart--doc-table').locator('tbody tr');
    await expect(rows).toHaveCount(HENNA_COUNT + 1);
    await expect(rows.first()).toContainText('Pathology Addendum');
    await expect(rows.first()).toContainText('Pathology Report');
  });

  /* ------------------------------------------------------------------------
     ROW ACTIONS
     ---------------------------------------------------------------------- */

  test('the name opens a preview naming the file', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    await page.locator('.doc__name', { hasText: 'Patient Intake Form' }).click();

    const preview = page.getByTestId('chart--doc-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Intake Form');
    await expect(preview).toContainText('Ruth Adeyemi');
    await expect(preview).toContainText('PDF');
  });

  test('the row menu deletes a single document', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    const rows = page.getByTestId('chart--doc-table').locator('tbody tr');

    await rows.first().locator('.doc__row-action').click();
    await page.locator('.doc__dropdown-item', { hasText: 'Delete' }).click();

    await expect(rows).toHaveCount(HENNA_COUNT - 1);
  });

  /* ------------------------------------------------------------------------
     EMPTY / SMALL RECORDS
     ---------------------------------------------------------------------- */

  test('a patient with one document still renders a table', async ({ page }) => {
    await openChart(page, ZOE_DOCS);

    await expect(
      page.getByTestId('chart--doc-table').locator('tbody tr')
    ).toHaveCount(1);
  });

  test('a search with no matches says so', async ({ page }) => {
    await openChart(page, ZOE_DOCS);
    await page.getByTestId('chart--doc-search').locator('input').fill('zzzz');

    await expect(page.getByTestId('chart--doc-table')).toContainText(
      'No documents match your search.'
    );
  });

  /* ------------------------------------------------------------------------
     ACCESSIBILITY + VISUAL
     ---------------------------------------------------------------------- */

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    await expect(page.getByTestId('chart--doc-table').locator('tbody tr').first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in the upload dialog @a11y', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    await page.getByTestId('chart--doc-upload').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — documents list', async ({ page }) => {
    // The workspace is the scrolling element, so at the default viewport an
    // element screenshot captures the rows on screen and blank space where
    // the rest are clipped. Give it room for all eleven instead — a baseline
    // that silently stops at row seven would not notice a change at row nine.
    await page.setViewportSize({ width: 1440, height: 1400 });
    await openChart(page, HENNA_DOCS);
    await expect(page.getByTestId('chart--doc-table').locator('tbody tr')).toHaveCount(
      HENNA_COUNT
    );
    await expect(page.locator('.ch__module-body')).toHaveScreenshot('chart-documents.png');
  });

  test('visual — upload dialog', async ({ page }) => {
    await openChart(page, HENNA_DOCS);
    await page.getByTestId('chart--doc-upload').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveScreenshot('chart-documents-upload.png');
  });
});
