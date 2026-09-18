/**
 * Chart — Billing module.
 *
 * The sidebar's own top-level Billing section (last item in the list) —
 * distinct from Profile > Insurance's card grid. A tab strip over the
 * billing lifecycle: Invoice, Claims, Ledger, Prior Auth, Patient Payment,
 * Cards, gEstimator.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_BILLING = '/screens/patient-chart.html?mrn=326486#billing';

test.describe('chart billing module', () => {
  test('opens on Invoice, with the seeded rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_BILLING);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Billing');
    await expect(page.getByRole('tab', { name: 'Invoice' })).toHaveAttribute('aria-selected', 'true');

    const rows = page.getByTestId('chart--invoice-table').locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('INV-2026-0142');
    await expect(rows.first()).toContainText('$125.00');
    await expect(rows.first().locator('ui-badge')).toContainText('Sent');

    assertClean();
  });

  /**
   * Regression guard: the row menu is appended to document.body (so it can
   * float above the table), not inside the module's own host element — a
   * click on a menu item has to be wired on the menu itself, or host's
   * delegated click listener never sees it and the action silently no-ops.
   */
  test('a row menu action is an honest stub, not a silent no-op', async ({ page }) => {
    await openChart(page, HENNA_BILLING);
    await page.locator('[data-inv-menu]').first().click();
    await page.getByRole('menuitem', { name: 'View detail' }).click();

    await expect(page.getByTestId('chart--flash')).toContainText(
      "This record's full detail isn't viewable in this prototype yet."
    );
  });

  test('every tab is reachable and switches the visible panel', async ({ page }) => {
    await openChart(page, HENNA_BILLING);

    for (const label of [
      'Claims',
      'Ledger',
      'Prior Auth',
      'Patient Payment',
      'Cards',
      'gEstimator',
    ]) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('Claims lists the seeded claims with their status', async ({ page }) => {
    await openChart(page, HENNA_BILLING);
    await page.getByRole('tab', { name: 'Claims', exact: true }).click();

    const rows = page.getByTestId('chart--claims-table').locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('CLM-2026-0892');
    await expect(rows.first()).toContainText('Medicare Part B');
  });

  test('Ledger lists the seeded encounters', async ({ page }) => {
    await openChart(page, HENNA_BILLING);
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click();

    const rows = page.getByTestId('chart--ledger-table').locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('99214');
  });

  /* --- Prior Auth ------------------------------------------------------- */

  test.describe('Prior Auth', () => {
    test('shows Medication PA, matching the seeded rows — no category tabs left to choose between', async ({
      page,
    }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'Prior Auth', exact: true }).click();

      await expect(page.getByText('Medication PA', { exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Medication PA' })).toHaveCount(0);
      const rows = page.getByTestId('chart--auth-table').locator('tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText('MPA-241');
    });

    test('New Authorization refuses an empty drug, then submits and lists it', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'Prior Auth', exact: true }).click();
      await page.getByTestId('chart--add-authorization').locator('button').click();

      await page.getByTestId('chart--auth-submit').locator('button').click();
      await expect(page.getByTestId('chart--auth-drug')).toContainText('Enter a drug.');

      await page.getByTestId('chart--auth-drug').locator('input').fill('Vedolizumab 300mg');
      await page.getByTestId('chart--auth-submit').locator('button').click();

      await expect(page.getByTestId('chart--flash')).toContainText(
        'Authorization submitted and awaiting payer response.'
      );
      const rows = page.getByTestId('chart--auth-table').locator('tbody tr');
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText('Vedolizumab 300mg');
      await expect(rows.first()).toContainText('Pending');
    });

    test('the New Authorization context rail reads the real clinical record', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'Prior Auth', exact: true }).click();
      await page.getByTestId('chart--add-authorization').locator('button').click();

      const modal = page.locator('#blAuthModal .ui-modal__dialog');
      await expect(modal).toContainText('Anaphylaxis');
      await expect(modal).toContainText('GORD');
    });

    test('Save as Draft closes the modal without adding a row', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'Prior Auth', exact: true }).click();
      await page.getByTestId('chart--add-authorization').locator('button').click();
      await page.getByTestId('chart--auth-save-draft').locator('button').click();

      await expect(page.getByTestId('chart--flash')).toContainText('Authorization saved as a draft.');
      await expect(page.getByTestId('chart--auth-table').locator('tbody tr')).toHaveCount(2);
    });
  });

  /* --- gEstimator ---------------------------------------------------------- */

  test.describe('gEstimator', () => {
    test('requires a procedure and payer before estimating', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'gEstimator', exact: true }).click();
      await page.getByTestId('chart--gest-estimate').locator('button').click();

      await expect(page.getByTestId('chart--flash')).toContainText('Choose a procedure and a payer to estimate.');
    });

    test('estimates a lower patient share for insured than self-pay', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'gEstimator', exact: true }).click();

      await page.getByTestId('chart--gest-procedure').locator('select').selectOption('Colonoscopy');
      await page.getByTestId('chart--gest-payer').locator('select').selectOption('Medicare Part B');
      await page.getByTestId('chart--gest-estimate').locator('button').click();

      const result = page.locator('#blGestResult');
      await expect(result).toContainText('Estimated charge: $1,850.00');
      await expect(result).toContainText('Estimated patient responsibility: $463.00');
    });

    test('self-pay is billed the full charge', async ({ page }) => {
      await openChart(page, HENNA_BILLING);
      await page.getByRole('tab', { name: 'gEstimator', exact: true }).click();

      await page.getByTestId('chart--gest-procedure').locator('select').selectOption('Lab Panel');
      await page.getByTestId('chart--gest-payer').locator('select').selectOption('Self-pay');
      await page.getByTestId('chart--gest-estimate').locator('button').click();

      await expect(page.locator('#blGestResult')).toContainText('Estimated self-pay total: $95.00');
    });
  });

  /* --- Empty patient -------------------------------------------------------- */

  test('a patient with no billing history gets honest empty states throughout', async ({ page }) => {
    await openChart(page, '/screens/patient-chart.html?mrn=326481#billing');

    await expect(page.getByText('No invoices on file.')).toBeVisible();
    await page.getByRole('tab', { name: 'Claims', exact: true }).click();
    await expect(page.getByText('No claims on file.')).toBeVisible();
  });

  /* --- Accessibility -------------------------------------------------------- */

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_BILLING);
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations on the New Authorization modal @a11y', async ({ page }) => {
    await openChart(page, HENNA_BILLING);
    await page.getByRole('tab', { name: 'Prior Auth', exact: true }).click();
    await page.getByTestId('chart--add-authorization').locator('button').click();
    await expectNoA11yViolations(page);
  });
});

/* ===================== Cards =====================
   Renamed from "Payment Methods": every row on it is a card, and the tab
   beside it is already Patient Payment — two tabs whose names both said
   "payment" put the reader one word from the wrong one. */

test.describe('chart billing — cards', () => {
  const cardRows = (page) =>
    page.getByTestId('chart--payment-methods-table').locator('tbody tr');

  async function openCards(page) {
    await openChart(page, HENNA_BILLING);
    await page.getByRole('tab', { name: 'Cards', exact: true }).click();
    await expect(page.getByTestId('chart--payment-methods-table')).toBeVisible();
  }

  async function openDialog(page) {
    await openCards(page);
    await page.getByTestId('chart--add-card').locator('button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }

  /** Fills a valid card. 4242… is the industry's own test number. */
  async function fillCard(page, { number = '4242424242424242', name = 'Henna West' } = {}) {
    await page.getByTestId('chart--card-name').locator('input').fill(name);
    await page.getByTestId('chart--card-number').locator('input').fill(number);
    await page.getByTestId('chart--card-month').locator('select').selectOption('09');
    await page.getByTestId('chart--card-year').locator('select').selectOption('2030');
    await page.getByTestId('chart--card-cvc').locator('input').fill('123');
  }

  test('the tab is named for what is on it', async ({ page }) => {
    await openCards(page);
    await expect(page.getByRole('tab', { name: 'Payment Methods' })).toHaveCount(0);
    await expect(
      page.getByTestId('chart--payment-methods-table').locator('thead th').first()
    ).toHaveText('Card');
  });

  test('the seeded card is listed and marked default', async ({ page }) => {
    await openCards(page);
    await expect(cardRows(page)).toHaveCount(1);
    await expect(cardRows(page).first()).toContainText('Visa •••• 4242');
    await expect(cardRows(page).first()).toContainText('Default');
  });

  test('a card is added and appears on the list', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openDialog(page);

    // A Mastercard, so the brand is read off the number rather than assumed.
    await fillCard(page, { number: '5555555555554444' });
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(cardRows(page)).toHaveCount(2);
    await expect(cardRows(page).nth(1)).toContainText('Mastercard •••• 4444');
    await expect(cardRows(page).nth(1)).toContainText('09-2030');

    assertClean();
  });

  /** The number is reduced on entry; the record never holds the rest of it. */
  test('only the last four digits reach the record', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '4111111111111111' });
    await page.getByTestId('chart--card-save').locator('button').click();

    const table = page.getByTestId('chart--payment-methods-table');
    await expect(table).toContainText('•••• 1111');
    await expect(table).not.toContainText('4111111111111111');
  });

  test('every required field names itself', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(page.getByTestId('chart--card-name')).toContainText('name printed');
    await expect(page.getByTestId('chart--card-number')).toContainText('card number');
    await expect(page.getByTestId('chart--card-month')).toContainText('expiry');
    await expect(page.getByTestId('chart--card-cvc')).toContainText('code from the back');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  /**
   * The check digit every card carries. It catches the transposed pair that is
   * the commonest way a sixteen-digit number gets mistyped — and catching it at
   * the desk beats catching it at the processor a week later.
   */
  test('a number that fails its check digit is refused', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '4242424242424243' });
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(page.getByTestId('chart--card-number')).toContainText('a digit looks wrong');
    await expect(cardRows(page)).toHaveCount(1);
  });

  /** Unfinished typing and a real mistake are told apart. */
  test('a short number is called short, not wrong', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '4242' });
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(page.getByTestId('chart--card-number')).toContainText('too short');
  });

  test('a card that has already expired is refused', async ({ page }) => {
    await openDialog(page);
    await fillCard(page);
    await page.getByTestId('chart--card-year').locator('select').selectOption('2026');
    await page.getByTestId('chart--card-month').locator('select').selectOption('01');
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(page.getByTestId('chart--card-month')).toContainText('expired');
  });

  /** One default, always — "charge the card on file" needs one answer. */
  test('a new default takes it off the old one', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '5555555555554444' });
    // Click the label, not the input: .ui-choice__input is a 1px
    // visually-hidden box sitting underneath .ui-choice__box, so a
    // direct click on it is intercepted. The label is what a person
    // actually hits anyway.
    await page.getByTestId('chart--card-default').locator('label').click();
    await page.getByTestId('chart--card-save').locator('button').click();

    await expect(cardRows(page).filter({ hasText: 'Default' })).toHaveCount(1);
    await expect(cardRows(page).filter({ hasText: 'Mastercard' })).toContainText('Default');
  });

  test('the row menu offers what can be done to a card, not a dead detail view', async ({
    page,
  }) => {
    await openCards(page);
    await cardRows(page).first().locator('[data-pm-menu]').click();

    // The seeded card is already the default, so only Remove is on offer.
    await expect(page.getByRole('menuitem')).toHaveText(['Remove card']);
    await expect(page.getByRole('menuitem', { name: 'View detail' })).toHaveCount(0);
  });

  test('a non-default card can be promoted', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '5555555555554444' });
    await page.getByTestId('chart--card-save').locator('button').click();

    await cardRows(page).nth(1).locator('[data-pm-menu]').click();
    await page.getByRole('menuitem', { name: 'Make default' }).click();

    await expect(cardRows(page).nth(1)).toContainText('Default');
    await expect(cardRows(page).filter({ hasText: 'Default' })).toHaveCount(1);
  });

  /** A record with cards and no default has no answer to "charge the card". */
  test('removing the default hands it to what is left', async ({ page }) => {
    await openDialog(page);
    await fillCard(page, { number: '5555555555554444' });
    await page.getByTestId('chart--card-save').locator('button').click();
    await expect(cardRows(page)).toHaveCount(2);

    await cardRows(page).first().locator('[data-pm-menu]').click();
    await page.getByRole('menuitem', { name: 'Remove card' }).click();

    await expect(cardRows(page)).toHaveCount(1);
    await expect(cardRows(page).first()).toContainText('Default');
  });
});
