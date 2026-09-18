/**
 * Settings → Billing: the Fee Schedule — what a procedure is charged at, per
 * provider, over a date range.
 *
 * The behaviour worth pinning down is the part that is NOT stored: a row's
 * status is read off its dates and its switch every time the table paints, so
 * a contract year that has not started reads Pending and one that has run out
 * reads Inactive without anyone having to remember to change a field.
 *
 * The other thing worth pinning down is what makes a row unique. A case at
 * the surgical centre raises two charges — the facility fee and the
 * clinician's own — so the same code for the same provider is TWO rows, one
 * ASC and one Professional, at amounts with nothing to do with each other. It
 * is not three rows: a second charge of the same type for the same pair is
 * two prices for one claim line, and the form refuses it.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';
import { openFilter, tickFilter, doneFilter } from '../helpers/filter.js';

const BILLING = '/screens/billing-settings.html';

/** Fill the Add/Edit dialog. Every field, so a test says what it is testing. */
async function fillForm(page, values) {
  const set = async (key, value) => {
    const host = page.locator(`[data-field="${key}"]`);
    const select = host.locator('select');
    if (await select.count()) await select.selectOption(value);
    else await host.locator('input').fill(value);
  };
  for (const [key, value] of Object.entries(values)) await set(key, value);
}

test.describe('billing settings — fee schedule', () => {
  test('opens on Fee Schedule with the seed rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(BILLING);

    await expect(page.getByRole('heading', { name: 'Fee Schedule', level: 1 })).toBeVisible();

    const table = page.getByTestId('bst--fee-table');
    await expect(table.locator('tbody tr')).toHaveCount(15); // one page of them
    await expect(page.getByTestId('bst-fee--range')).toContainText('144 rows');

    for (const column of [
      'Procedure Code',
      'Provider',
      'Charge Type',
      'Rate ($)',
      'Allowed Amount ($)',
      'From Date',
      'End Date',
      'Status',
    ]) {
      await expect(table.locator('thead')).toContainText(column);
    }

    // A rate is the practice's own price for a code, not a contract line, so
    // there is no payer on the table and none in the form either.
    await expect(table.locator('thead')).not.toContainText('Payer');

    assertClean();
  });

  /**
   * Narrowing lives where it lives on every other list in the product: one
   * button in the header bar, ahead of the button that adds to the list.
   * Proven by position rather than by class name.
   */
  test('the filter sits in the bar, ahead of Add', async ({ page }) => {
    await page.goto(BILLING);

    const bar = await page.locator('.set__head').boundingBox();
    const filter = await page.getByTestId('bst--fee-filter').boundingBox();
    const add = await page.getByTestId('bst--fee-add').boundingBox();

    expect(filter.y).toBeGreaterThanOrEqual(bar.y);
    expect(filter.y + filter.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
    expect(filter.x).toBeLessThan(add.x);
  });

  test('status is read off the dates, not stored', async ({ page }) => {
    await page.goto(BILLING);
    const table = page.getByTestId('bst--fee-table');

    // Starts next quarter — not in force yet.
    await expect(table.locator('tbody tr').filter({ hasText: '91110' })).toContainText('Pending');
    // In its contract year.
    await expect(
      table.locator('tbody tr').filter({ hasText: '45378' }).first()
    ).toContainText('Active');
  });

  test('the status filter finds the expired row and the switched-off one', async ({ page }) => {
    await page.goto(BILLING);
    await openFilter(page, 'bst--fee-filter');
    await tickFilter(page, 'status', 'Inactive');
    await doneFilter(page);

    const rows = page.getByTestId('bst--fee-table').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    // 45331's dates ran out at the end of 2025; 43450 is switched off by hand.
    await expect(rows.filter({ hasText: '45331' })).toBeVisible();
    await expect(rows.filter({ hasText: '43450' })).toBeVisible();
  });

  test('the procedure filter narrows to one code', async ({ page }) => {
    await page.goto(BILLING);
    await openFilter(page, 'bst--fee-filter');
    await tickFilter(page, 'procedure', '45378 - Colonoscopy, flexible; diagnostic');

    const rows = page.getByTestId('bst--fee-table').locator('tbody tr');
    // Two rows for the one provider, and that is the point: the facility
    // charge and the professional charge for the same colonoscopy.
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Professional' })).toContainText('985.00');
    await expect(rows.filter({ hasText: 'ASC' })).toContainText('1330.00');

    // Unticking it is what clears the filter — there is no "All" row to pick.
    await tickFilter(page, 'procedure', '45378 - Colonoscopy, flexible; diagnostic');
    await doneFilter(page);
    await expect(rows).toHaveCount(15);
  });

  test('a new rate lands at the top of the list', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    await fillForm(page, {
      procedure: '99214 - Office visit, established patient, 30–39 minutes',
      provider: 'Dr. Luca Bianchi',
      chargeType: 'Professional',
      rate: '235',
      allowedAmount: '181.90',
      fromDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    await page.getByTestId('bst--fee-save').click();

    const first = page.getByTestId('bst--fee-table').locator('tbody tr').first();
    await expect(first).toContainText('99214');
    await expect(first).toContainText('Dr. Luca Bianchi');
    await expect(first).toContainText('Professional');
    await expect(first).toContainText('181.90');
    // ISO in the data, MM/DD/YYYY on screen.
    await expect(first).toContainText('01/01/2026');
    await expect(page.getByTestId('bst-fee--range')).toContainText('145 rows');
  });

  /**
   * The whole reason charge type is on the row: the same work, priced twice,
   * because the centre and the clinician bill separately for it.
   */
  test('a facility charge and a professional charge can sit on the same code', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    // 45380 for Dr Amara Mensah is already on the list as Professional.
    await fillForm(page, {
      procedure: '45380 - Colonoscopy, flexible; with biopsy, single or multiple',
      provider: 'Dr. Amara Mensah',
      chargeType: 'ASC',
      rate: '1545',
      allowedAmount: '1158.75',
      fromDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    await page.getByTestId('bst--fee-save').click();

    await expect(page.getByTestId('bst-fee--range')).toContainText('145 rows');

    await openFilter(page, 'bst--fee-filter');
    await tickFilter(
      page,
      'procedure',
      '45380 - Colonoscopy, flexible; with biopsy, single or multiple'
    );
    await doneFilter(page);

    const rows = page.getByTestId('bst--fee-table').locator('tbody tr');
    const mensah = rows.filter({ hasText: 'Dr. Amara Mensah' });
    await expect(mensah).toHaveCount(2);
    await expect(mensah.filter({ hasText: 'Professional' })).toContainText('1145.00');
    await expect(mensah.filter({ hasText: 'ASC' })).toContainText('1545.00');
  });

  /** Charge type is required — a rate filed under neither charge would price
   *  whichever half of the claim happened to ask for it. */
  test('a rate with no charge type is refused', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    await fillForm(page, {
      procedure: '45331 - Sigmoidoscopy, flexible; with biopsy',
      provider: 'Dr. Amara Mensah',
      rate: '200',
      allowedAmount: '150',
      fromDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    await page.getByTestId('bst--fee-save').click();

    await expect(page.locator('[data-field="chargeType"]')).toContainText(
      'Charge Type is required'
    );
    await expect(page.getByTestId('bst-fee--range')).toContainText('144 rows');
  });

  test('what the schedule allows cannot exceed what is charged', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    await fillForm(page, {
      procedure: '45331 - Sigmoidoscopy, flexible; with biopsy',
      provider: 'Dr. Amara Mensah',
      chargeType: 'Professional',
      rate: '200',
      allowedAmount: '260',
      fromDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    await page.getByTestId('bst--fee-save').click();

    await expect(page.locator('[data-field="allowedAmount"]')).toContainText(
      'cannot exceed Amount'
    );
    // Nothing was written, and the fields the user got right are still filled.
    await expect(page.getByTestId('bst-fee--range')).toContainText('144 rows');
    await expect(page.locator('[data-field="rate"]').locator('input')).toHaveValue('200');
  });

  test('a range that ends before it starts is refused', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    await fillForm(page, {
      procedure: '45331 - Sigmoidoscopy, flexible; with biopsy',
      provider: 'Dr. Amara Mensah',
      chargeType: 'Professional',
      rate: '200',
      allowedAmount: '150',
      fromDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    await page.getByTestId('bst--fee-save').click();

    await expect(page.locator('[data-field="endDate"]')).toContainText(
      'must fall after From Date'
    );
  });

  /** One rate per procedure, per provider, per charge type — a second one of
   *  the same three would leave a claim line with two prices and nothing to
   *  choose between them. */
  test('the same procedure, provider and charge type cannot be priced twice', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-add').click();

    await fillForm(page, {
      procedure: '45378 - Colonoscopy, flexible; diagnostic', // already on the
      provider: 'Dr. Amara Mensah', // list for this provider,
      chargeType: 'Professional', // as a professional charge
      rate: '900',
      allowedAmount: '700',
      fromDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    await page.getByTestId('bst--fee-save').click();

    await expect(page.locator('[data-field="chargeType"]')).toContainText(
      'already has a Professional rate'
    );
  });

  test('the procedure opens the row for editing', async ({ page }) => {
    await page.goto(BILLING);
    await page.getByTestId('bst--fee-table').locator('tbody tr').first().locator('button').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Edit Fee Schedule');
    await expect(page.locator('[data-field="rate"]').locator('input')).toHaveValue('985');

    await page.locator('[data-field="rate"]').locator('input').fill('1005');
    await page.getByTestId('bst--fee-save').click();

    await expect(page.getByTestId('bst--fee-table').locator('tbody tr').first()).toContainText(
      '1005.00'
    );
  });

  test('a switched-off rate reads Inactive whatever its dates say', async ({ page }) => {
    await page.goto(BILLING);
    const rows = page.getByTestId('bst--fee-table').locator('tbody tr');

    await expect(rows.first()).toContainText('Active');
    await rows.first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Mark Inactive' }).click();

    await expect(rows.first()).toContainText('Inactive');
  });

  test('deleting asks first, then removes the row', async ({ page }) => {
    await page.goto(BILLING);
    const rows = page.getByTestId('bst--fee-table').locator('tbody tr');

    await rows.first().locator('[data-menu]').click();
    await page.getByTestId('bst--menu-delete').click();

    await expect(page.getByRole('dialog')).toContainText('Dr. Amara Mensah');
    // The dialog names which of the two charges is going, because the other
    // one for the same case stays.
    await expect(page.getByRole('dialog')).toContainText('Professional');
    await page.getByTestId('bst--delete-confirm').click();

    await expect(page.getByTestId('bst-fee--range')).toContainText('143 rows');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(BILLING);
    await expectNoA11yViolations(page);
  });
});
