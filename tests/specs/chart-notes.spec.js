/**
 * Chart — Notes module.
 *
 * Two tabs, two different kinds of thing: free-text Notes (text, author,
 * date — nothing else to say once one exists) and Alert Notes (where it
 * surfaces, and an Active/Inactive status with a reason when stood down).
 * Reference: the four screenshots supplied for this module.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_NOTES = '/screens/patient-chart.html?mrn=326486#notes';

test.describe('chart notes module', () => {
  test('opens on the Notes tab with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_NOTES);

    // The heading is kept for the outline and the screen reader but taken off
    // the screen — the first tab of the strip in its place is the same word.
    const title = page.getByTestId('chart--module-title');
    await expect(title).toHaveText('Notes');
    await expect(title).toHaveClass(/u-sr-only/);
    await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('chart--notes-table').locator('tbody tr')).toHaveCount(4);

    assertClean();
  });

  test('Alert Notes carries different columns — Visible At and Status', async ({
    page,
  }) => {
    await openChart(page, HENNA_NOTES);
    await page.getByRole('tab', { name: 'Alert Notes' }).click();

    const table = page.getByTestId('chart--alert-notes-table');
    await expect(table.locator('thead')).toContainText('Visible At');
    await expect(table.locator('thead')).toContainText('Status');
    await expect(table.locator('tbody tr')).toHaveCount(4);

    // Plain Notes has no such columns.
    await page.getByRole('tab', { name: 'Notes', exact: true }).click();
    await expect(page.getByTestId('chart--notes-table').locator('thead')).not.toContainText(
      'Status'
    );
  });

  /**
   * Standing an alert down does not erase why — it explains a decision
   * someone already made, and losing the reason is how the same concern
   * gets re-raised from scratch. The ⓘ only appears on inactive rows that
   * have one.
   */
  test('an inactive alert note explains itself via the info icon', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    await page.getByRole('tab', { name: 'Alert Notes' }).click();

    const inactiveRow = page
      .getByTestId('chart--alert-notes-table')
      .locator('tbody tr')
      .filter({ hasText: 'suicidal ideation' });
    await expect(inactiveRow.getByText('Inactive')).toBeVisible();

    const activeRow = page
      .getByTestId('chart--alert-notes-table')
      .locator('tbody tr')
      .filter({ hasText: 'missed 3 consecutive' });
    await expect(activeRow.locator('[data-alert-reason]')).toHaveCount(0);

    await inactiveRow.locator('[data-alert-reason]').click();
    await expect(page.getByTestId('chart--flash')).toContainText('safety plan completed');
  });

  /* --- Add Notes ------------------------------------------------------------ */

  test('Add Notes appends a row with the signed-in author and today', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    const table = page.getByTestId('chart--notes-table');

    await page.getByTestId('chart--add-note').locator('button').click();
    await expect(page.getByRole('heading', { name: 'Add Notes' })).toBeVisible();

    await page.getByTestId('chart--note-text').locator('textarea').fill('Added by the suite.');
    await page.getByTestId('chart--note-save').locator('button').click();

    await expect(table.locator('tbody tr')).toHaveCount(5);
    const newRow = table.locator('tbody tr').filter({ hasText: 'Added by the suite.' });
    await expect(newRow).toContainText('Amara Mensah');
  });

  test('an empty note is refused, and Cancel discards it', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    const table = page.getByTestId('chart--notes-table');

    await page.getByTestId('chart--add-note').locator('button').click();
    await page.getByTestId('chart--note-save').locator('button').click();
    await expect(page.getByTestId('chart--note-text')).toContainText('Enter a note.');
    await expect(table.locator('tbody tr')).toHaveCount(4); // unchanged — refused, not silently dropped

    await page.getByTestId('chart--note-cancel').locator('button').click();
    await expect(page.locator('#cnAddModal .ui-modal')).toBeHidden();
    await expect(table.locator('tbody tr')).toHaveCount(4);
  });

  /** The two extra fields only make sense for an alert, so only it asks them. */
  test('Add Alert Notes asks Visible At and Status; Add Notes does not', async ({
    page,
  }) => {
    await openChart(page, HENNA_NOTES);

    await page.getByTestId('chart--add-note').locator('button').click();
    await expect(page.getByTestId('chart--note-visible-at')).toHaveCount(0);
    await page.getByTestId('chart--note-cancel').locator('button').click();

    await page.getByRole('tab', { name: 'Alert Notes' }).click();
    await page.getByTestId('chart--add-note').locator('button').click();
    await expect(page.getByRole('heading', { name: 'Add Alert Notes' })).toBeVisible();

    const table = page.getByTestId('chart--alert-notes-table');
    await page.getByTestId('chart--note-text').locator('textarea').fill('New alert from the suite.');
    await page.getByTestId('chart--note-visible-at').locator('select').selectOption('Billing');
    await page.getByTestId('chart--note-status').locator('select').selectOption('Inactive');
    await page.getByTestId('chart--note-save').locator('button').click();

    const newRow = table.locator('tbody tr').filter({ hasText: 'New alert from the suite.' });
    await expect(newRow).toContainText('Billing');
    await expect(newRow.getByText('Inactive')).toBeVisible();
  });

  /* --- Row actions ------------------------------------------------------------ */

  test('the row menu deletes a note', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    const table = page.getByTestId('chart--notes-table');

    await table.locator('[data-note-menu]').first().click();
    await page.locator('.cn__dropdown-item--danger').click();

    await expect(table.locator('tbody tr')).toHaveCount(3);
  });

  test('the row menu toggles an alert note between Active and Inactive', async ({
    page,
  }) => {
    await openChart(page, HENNA_NOTES);
    await page.getByRole('tab', { name: 'Alert Notes' }).click();

    const row = page
      .getByTestId('chart--alert-notes-table')
      .locator('tbody tr')
      .filter({ hasText: 'missed 3 consecutive' });
    await expect(row.getByText('Active', { exact: true })).toBeVisible();

    await row.locator('[data-alert-menu]').click();
    await page.getByRole('menuitem', { name: 'Mark inactive' }).click();

    await expect(row.getByText('Inactive')).toBeVisible();
  });

  /**
   * Regression guard for the actual bug hit while building this: a save
   * click shifts focus off the note textarea a beat before the click lands,
   * which fires the textarea's OWN ui-change (it emits the same event type
   * <ui-tabs> uses). If the tab-switch handler is not scoped to <ui-tabs>
   * specifically, that blur reads as "switch to the tab named after
   * whatever was just typed" and wipes the panel out from under the click —
   * so saving would silently do nothing under a real (non-synthetic) click.
   */
  test('saving does not depend on which tab last emitted ui-change', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    await page.getByRole('tab', { name: 'Alert Notes' }).click();
    await page.getByTestId('chart--add-note').locator('button').click();

    await page.getByTestId('chart--note-text').locator('textarea').fill('Focus-shift regression.');
    // Changing the select fires its own ui-change before Save is clicked —
    // exactly the sequence that exposed the bug.
    await page.getByTestId('chart--note-visible-at').locator('select').selectOption('Check-In');
    await page.getByTestId('chart--note-save').locator('button').click();

    const table = page.getByTestId('chart--alert-notes-table');
    await expect(table.locator('tbody tr').filter({ hasText: 'Focus-shift regression.' })).toHaveCount(1);
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_NOTES);
    await expectNoA11yViolations(page);
  });
});
