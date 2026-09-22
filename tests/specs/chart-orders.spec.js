/**
 * Chart — Orders module (Lab Orders, Imaging/X-Ray, Non-Visit
 * Orders). Prescriptions moved to its own module — see
 * chart-prescriptions.spec.js.
 *
 * All four sections are worklists — <ui-data-table>. Lab is the one whose
 * rows open a page rather than a modal: the test name links through to the
 * report/requisition viewer, which has its own prev/next, zoom and print.
 * Imaging and Non-Visit Orders each have their own Add / Edit /
 * status action / Delete.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_ORDERS = '/screens/patient-chart.html?mrn=326486#orders';

test.describe('chart orders module', () => {
  test('opens on the Lab Orders table, with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_ORDERS);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Orders');
    await expect(page.getByRole('tab', { name: 'Lab Orders' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('chart--lab-table').locator('tbody tr')).toHaveCount(4);

    assertClean();
  });

  /* The section strip is the shell's, in the module head — the same slot
     Profile and Appointments put theirs in — not markup inside the panel. */
  test('the section strip is the primary one, in the module head', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    const strip = page.getByTestId('chart--orders-tabs');
    await expect(page.getByTestId('chart--module-tabs').getByTestId('chart--orders-tabs')).toBeVisible();
    await expect(strip.locator('.ui-tabs')).toHaveClass(/ui-tabs--primary/);
  });

  /* Add follows the strip into the head, and changes with the section. */
  test('the head action changes with the open section', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    const actions = page.getByTestId('chart--module-actions');

    await expect(actions.getByTestId('chart--add-lab-test')).toBeVisible();

    await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();
    await expect(actions.getByTestId('chart--add-lab-test')).toHaveCount(0);
    await expect(actions.getByTestId('chart--add-imaging')).toBeVisible();
  });

  /* THE CHART HAS NO REFERRALS SECTION. A referral is raised, packeted, faxed,
     chased and answered on the Referrals screen, which owns the cover sheet,
     the attachments and the reply; the tab that used to stand here wrote a
     second, thinner record that reached none of that. */
  test('there is no Referrals tab', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    await expect(page.getByRole('tab', { name: 'Referrals' })).toHaveCount(0);
    await expect(page.getByTestId('chart--referrals-table')).toHaveCount(0);
    await expect(page.getByTestId('chart--add-referral')).toHaveCount(0);
  });

  /* --- Lab: navigation --------------------------------------------------------- */

  test('a test name opens its detail, with prev/next stepping through the list', async ({
    page,
  }) => {
    await openChart(page, HENNA_ORDERS);

    // The list is the landing view now — nothing is open until a row is.
    await expect(page.locator('.ord__lab-detail-nav')).toHaveCount(0);

    await page.locator('[data-lab-open="lab-1"]').click();
    await expect(page.locator('.ord__lab-detail-nav strong')).toHaveText('Full Body Blood Test');
    await expect(page.locator('[data-lab-prev]')).toBeDisabled();

    await page.locator('[data-lab-next]').click();
    await expect(page.locator('.ord__lab-detail-nav strong')).toHaveText('Online NCT');
    await expect(page.locator('[data-lab-prev]')).toBeEnabled();

    // …and back to the table it was opened from.
    await page.getByTestId('chart--lab-back').click();
    await expect(page.getByTestId('chart--lab-table').locator('tbody tr')).toHaveCount(4);
  });

  test('the row menu opens either view of the same lab', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    await page.locator('[data-lab-menu="lab-1"]').click();
    await page.getByRole('menuitem', { name: 'View Requisition' }).click();

    await expect(page.locator('.ord__report-title')).toHaveText('Patient Instructions');
    await expect(page.locator('.ord__lab-detail-nav strong')).toHaveText('Full Body Blood Test');
  });

  test('an ordered-but-not-received lab shows the honest empty state, not a fabricated report', async ({
    page,
  }) => {
    await openChart(page, HENNA_ORDERS);
    await page.locator('[data-lab-open="lab-2"]').click(); // Online NCT — ordered, no report

    await expect(page.locator('.ord__report-empty')).toContainText('has not been received');
    await expect(page.getByTestId('chart--lab-results-table')).toHaveCount(0);
  });

  test('Report and Requisition show different content for the same lab', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    await page.locator('[data-lab-open="lab-1"]').click();

    await expect(page.getByTestId('chart--lab-results-table')).toBeVisible();
    await expect(page.locator('.ord__report-title')).toHaveText('Laboratory Results');

    await page.getByRole('tab', { name: 'Requisition' }).click();
    await expect(page.getByTestId('chart--lab-results-table')).toHaveCount(0);
    await expect(page.locator('.ord__report-title')).toHaveText('Patient Instructions');
  });

  test('an out-of-range result is called out', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    await page.locator('[data-lab-open="lab-1"]').click();

    const table = page.getByTestId('chart--lab-results-table');
    await expect(table.locator('tbody tr').filter({ hasText: 'Creatinine' }).locator('.ord__out-of-range'))
      .toHaveText('1.4 mg/dL');
  });

  test('zoom adjusts the report card in 10% steps between 50% and 200%', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    await page.locator('[data-lab-open="lab-1"]').click();

    const zoomLabel = page.getByTestId('chart--lab-zoom');
    await expect(zoomLabel).toHaveText('100%');
    await page.locator('[data-zoom-in]').click();
    await expect(zoomLabel).toHaveText('110%');
    await page.locator('[data-zoom-out]').click();
    await page.locator('[data-zoom-out]').click();
    await expect(zoomLabel).toHaveText('90%');
  });

  /* --- Add Lab Test ------------------------------------------------------------ */

  /**
   * Regression guard: adding row 2 must not blank whatever was already
   * picked in row 1. The first version rebuilt the whole row group from
   * structural metadata alone on every add/remove, which silently discarded
   * every select's value — ordering 2 tests only ever created 1.
   */
  test('two filled Test rows create two separate lab orders', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    const table = page.getByTestId('chart--lab-table');
    const rowsBefore = await table.locator('tbody tr').count();

    await page.getByTestId('chart--add-lab-test').locator('button').click();
    await page.getByTestId('chart--lab-vendor').locator('select').selectOption('LabCorp — Fargo');
    await page.getByTestId('chart--lab-provider').locator('select').selectOption('Dr. L. Bianchi');
    await page.getByTestId('chart--lab-test-1').locator('select').selectOption('Lipid Panel');

    await page.locator('[data-test-add-row]').click();
    // Row 1's value has to survive row 2 being added.
    await expect(page.getByTestId('chart--lab-test-1').locator('select')).toHaveValue('Lipid Panel');

    await page.getByTestId('chart--lab-test-2').locator('select').selectOption('Complete Blood Count');
    await page.getByTestId('chart--lab-instruction').locator('input').fill('Fast 12 hours.');
    await page.getByTestId('chart--lab-order').locator('button').click();

    await expect(table.locator('tbody tr')).toHaveCount(rowsBefore + 2);
    const names = await table.locator('.ord__lab-name').allTextContents();
    expect(names).toContain('Lipid Panel');
    expect(names).toContain('Complete Blood Count');
  });

  test('the first Test row cannot be removed while it is the only one', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    await page.getByTestId('chart--add-lab-test').locator('button').click();

    await expect(page.locator('[data-test-remove]').first()).toBeDisabled();
    await page.locator('[data-test-add-row]').click();
    await expect(page.locator('[data-test-remove]').first()).toBeEnabled();
  });

  test('ordering with no test selected is refused', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);
    const table = page.getByTestId('chart--lab-table');
    const rowsBefore = await table.locator('tbody tr').count();

    await page.getByTestId('chart--add-lab-test').locator('button').click();
    await page.getByTestId('chart--lab-vendor').locator('select').selectOption('LabCorp — Fargo');
    await page.getByTestId('chart--lab-order').locator('button').click();

    await expect(table.locator('tbody tr')).toHaveCount(rowsBefore);
  });

  /* --- Upload Lab Results ------------------------------------------------------ */

  test('associating a result with an ordered lab flips it to Received', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    const onlineNctRow = page
      .getByTestId('chart--lab-table')
      .locator('tbody tr')
      .filter({ hasText: 'Online NCT' });
    await expect(onlineNctRow.locator('ui-badge')).toHaveText('Ordered');

    await page.getByTestId('chart--upload-results').locator('button').click();
    await expect(page.getByTestId('chart--upload-existing')).toBeVisible();
    await expect(page.getByTestId('chart--upload-test-name')).toBeHidden();

    await page.getByTestId('chart--upload-reviewer').locator('select').selectOption('Dr. A. Mensah');
    await page.getByTestId('chart--upload-date').locator('input').fill('2026-08-06');
    await page.getByTestId('chart--upload-lab-name').locator('select').selectOption('LabCorp — Fargo');
    await page.getByTestId('chart--upload-existing').locator('select').selectOption('Online NCT');
    await page.getByTestId('chart--upload-save').locator('button').click();

    await expect(onlineNctRow.locator('ui-badge')).toHaveText('Received');
  });

  test('uploading without a lab order creates a new, already-received lab entry', async ({
    page,
  }) => {
    await openChart(page, HENNA_ORDERS);
    const table = page.getByTestId('chart--lab-table');
    const rowsBefore = await table.locator('tbody tr').count();

    await page.getByTestId('chart--upload-results').locator('button').click();
    await page.getByTestId('chart--upload-option').getByText('Upload result without lab order').click();
    await expect(page.getByTestId('chart--upload-existing')).toBeHidden();
    await expect(page.getByTestId('chart--upload-test-name')).toBeVisible();

    await page.getByTestId('chart--upload-test-name').locator('input').fill('H. pylori Antibody Test');
    await page.getByTestId('chart--upload-save').locator('button').click();

    await expect(table.locator('tbody tr')).toHaveCount(rowsBefore + 1);
    const newRow = table.locator('tbody tr').filter({ hasText: 'H. pylori' });
    await expect(newRow.locator('ui-badge')).toHaveText('Received');
  });

  test('the status filter narrows the lab table', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    await page.getByTestId('chart--lab-status-filter').locator('select').selectOption('Ordered');
    const rows = page.getByTestId('chart--lab-table').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    for (const badge of await rows.locator('ui-badge').all()) {
      await expect(badge).toHaveText('Ordered');
    }
  });

  test('searching filters the table without taking the caret out of the box', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    const search = page.getByTestId('chart--lab-search').locator('input');
    await search.click();
    await search.pressSequentially('NCT');

    await expect(page.getByTestId('chart--lab-table').locator('tbody tr')).toHaveCount(2);
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('NCT');
  });

  /* --- Imaging / X-Ray ---------------------------------------------------------- */

  test.describe('Imaging/X-Ray', () => {
    test('lists the seeded orders', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();

      const table = page.getByTestId('chart--imaging-table');
      await expect(table.locator('tbody tr')).toHaveCount(2);
      await expect(table).toContainText('CT Scan');
      await expect(table).toContainText('X-Ray');
    });

    test('Add Imaging Order appends a new ordered study', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();
      const table = page.getByTestId('chart--imaging-table');

      await page.getByTestId('chart--add-imaging').locator('button').click();
      await expect(page.getByRole('heading', { name: 'Add Imaging Order' })).toBeVisible();

      await page.getByTestId('chart--img-modality').locator('select').selectOption('MRI');
      await page.getByTestId('chart--img-bodypart').locator('input').fill('Lumbar Spine');
      await page.getByTestId('chart--img-facility').locator('select').selectOption('GastroEMR Imaging Center');
      await page.getByTestId('chart--img-provider').locator('select').selectOption('Dr. A. Mensah');
      await page.getByTestId('chart--img-save').locator('button').click();

      await expect(table.locator('tbody tr')).toHaveCount(3);
      const row = table.locator('tbody tr').filter({ hasText: 'Lumbar Spine' });
      await expect(row).toContainText('MRI');
      await expect(row).toContainText('Ordered');
    });

    test('a missing body part is refused', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();

      await page.getByTestId('chart--add-imaging').locator('button').click();
      await page.getByTestId('chart--img-modality').locator('select').selectOption('X-Ray');
      await page.getByTestId('chart--img-save').locator('button').click();

      await expect(page.getByTestId('chart--img-bodypart')).toContainText('Enter the body part or region.');
    });

    test('the row menu moves a study through Scheduled to Completed', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();
      const row = page.getByTestId('chart--imaging-table').locator('tbody tr').filter({ hasText: 'CT Scan' });

      // Seeded as 'scheduled' — Mark Completed is offered, Mark Scheduled is not.
      await expect(row).toContainText('Scheduled');
      await row.locator('[data-img-menu]').click();
      await expect(page.getByRole('menuitem', { name: 'Mark Scheduled' })).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Mark Completed' }).click();

      await expect(row).toContainText('Completed');
    });

    test('Edit opens the same modal pre-filled and updates the row in place', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();
      const table = page.getByTestId('chart--imaging-table');
      const row = table.locator('tbody tr').filter({ hasText: 'X-Ray' });

      await row.locator('[data-img-menu]').click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();

      await expect(page.getByRole('heading', { name: 'Edit Imaging Order' })).toBeVisible();
      await expect(page.getByTestId('chart--img-bodypart').locator('input')).toHaveValue('Chest, 2 views');

      await page.getByTestId('chart--img-bodypart').locator('input').fill('Chest, 3 views');
      await page.getByTestId('chart--img-save').locator('button').click();

      await expect(table.locator('tbody tr')).toHaveCount(2); // no new row
      await expect(table.locator('tbody tr').filter({ hasText: 'Chest, 3 views' })).toBeVisible();
    });

    test('Delete removes the order outright', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Imaging/X-Ray' }).click();
      const table = page.getByTestId('chart--imaging-table');

      // The first row is 'scheduled', which offers BOTH Cancel Order and
      // Delete as danger items — Delete has to be picked by name, not just
      // by the danger class, or this is a Playwright strict-mode violation.
      await table.locator('[data-img-menu]').first().click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      await expect(table.locator('tbody tr')).toHaveCount(1);
    });
  });

  /* --- Non-Visit Orders -------------------------------------------------------------- */

  test.describe('Non-Visit Orders', () => {
    test('lists the seeded orders', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Non-Visit Orders' }).click();

      const table = page.getByTestId('chart--nonvisit-table');
      await expect(table.locator('tbody tr')).toHaveCount(2);
      await expect(table).toContainText('Telephone Order');
    });

    test('Add Non-Visit Order appends an Open order', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Non-Visit Orders' }).click();
      const table = page.getByTestId('chart--nonvisit-table');

      await page.getByTestId('chart--add-nonvisit').locator('button').click();
      await page.getByTestId('chart--nv-type').locator('select').selectOption('Verbal Order');
      await page
        .getByTestId('chart--nv-description')
        .locator('textarea')
        .fill('Verbal order at check-out: continue current medications.');
      await page.getByTestId('chart--nv-provider').locator('select').selectOption('Dr. L. Bianchi');
      await page.getByTestId('chart--nv-save').locator('button').click();

      await expect(table.locator('tbody tr')).toHaveCount(3);
      const row = table.locator('tbody tr').filter({ hasText: 'Verbal Order' });
      await expect(row).toContainText('Open');
    });

    test('a missing description is refused', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Non-Visit Orders' }).click();

      await page.getByTestId('chart--add-nonvisit').locator('button').click();
      await page.getByTestId('chart--nv-type').locator('select').selectOption('Verbal Order');
      await page.getByTestId('chart--nv-save').locator('button').click();

      await expect(page.getByTestId('chart--nv-description')).toContainText('Describe what was ordered.');
    });

    test('Mark Completed and Delete both work from the row menu', async ({ page }) => {
      await openChart(page, HENNA_ORDERS);
      await page.getByRole('tab', { name: 'Non-Visit Orders' }).click();
      const table = page.getByTestId('chart--nonvisit-table');
      const openRow = table.locator('tbody tr').filter({ hasText: 'Open' });

      await openRow.locator('[data-nv-menu]').click();
      await page.getByRole('menuitem', { name: 'Mark Completed' }).click();
      await expect(table.locator('tbody tr').filter({ hasText: 'Open' })).toHaveCount(0);

      /* By role, like its Imaging sibling above. `.ord__dropdown-item--danger`
         was this module's own menu markup, from before the row menus moved to
         the shared js/lib/row-menu.js — the class has not existed for a while
         and the selector had simply stopped matching anything. */
      await table.locator('[data-nv-menu]').first().click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await expect(table.locator('tbody tr')).toHaveCount(1);
    });
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_ORDERS);

    /*
     * Wait for the module to finish drawing before scanning it.
     *
     * Orders is a tab set whose panel is built after the tabs are, so a scan
     * that arrives mid-render sees tabs pointing at a panel that does not
     * exist yet and reports a structural violation that is real for a few
     * milliseconds and never visible to anyone. It only ever surfaced on a
     * full-suite run, where everything is slower — which is exactly the
     * signature of a race, and why chart-documents.spec.js waits the same way.
     */
    await expect(page.getByTestId('chart--module-title')).toHaveText('Orders');
    await expect(page.getByTestId('chart--lab-table').locator('tbody tr').first()).toBeVisible();

    await expectNoA11yViolations(page);
  });
});
