/**
 * Billing ▸ Invoice — the patient's own bill.
 *
 * The claims tests next door follow a claim as it TRAVELS, because that is
 * what a claim does. An invoice barely moves: it is raised, some or all of it
 * arrives, and it is settled. What can go wrong is therefore not the journey
 * but the ARITHMETIC — three money columns on the row, three more at the foot
 * of the document, and a receipt printed from the same numbers. If any of
 * them ever stops agreeing with the others, the screen is asking to be
 * reconciled by hand, which is the one thing a billing screen must never do.
 *
 * So most of what is asserted here is an equality:
 *
 *   Due = Total − Payment              on every row of the worklist
 *   Balance Due = Subtotal − Insurance on the document
 *   Amount Paid = the row's Payment    on the receipt
 *
 * and the two actions the money moves through — Collect Payment and View
 * Receipt — are checked against the row they were opened from rather than
 * against a fixture, so a change to the fixtures cannot make them pass while
 * showing a patient somebody else's balance.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const BILLING = '/screens/billing.html';

/** Open Billing on the Invoice tab. It is not the landing tab — Billing opens
 *  where a claim's life starts — so every test says so. */
async function openInvoices(page, chip) {
  await page.goto(BILLING);
  await page.getByRole('tab', { name: 'Invoice', exact: true }).click();
  if (chip) await page.getByTestId(`bil--chip-${chip}`).click();
  await expect(page.getByTestId('bil--table').locator('tbody tr').first()).toBeVisible();
}

const COLUMN = {
  id: 0, invoiceDate: 1, patient: 2, appointmentType: 3, dos: 4,
  provider: 5, type: 6, total: 7, payment: 8, due: 9, status: 10,
};

const rows = (page) => page.getByTestId('bil--table').locator('tbody tr');

/** One cell of one row, as a trimmed string. */
async function cell(page, rowIndex, column) {
  return (await rows(page).nth(rowIndex).locator('td').nth(COLUMN[column]).textContent()).trim();
}

/** A money cell as a number. "1,234.50" is a string until it is asked to add
 *  up, which is the whole point of these tests. */
async function amount(page, rowIndex, column) {
  return Number((await cell(page, rowIndex, column)).replace(/[^0-9.-]/g, ''));
}

/** Open the ⋮ menu on a row and pick an item. */
async function rowMenu(page, name, rowIndex = 0) {
  await rows(page).nth(rowIndex).locator('[data-menu="invoice"]').click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

/** Type into a <ui-input> and commit it — the component publishes on change,
 *  which is blur, so filling alone would never reach the screen's state. */
async function fillInput(page, selector, value) {
  const field = page.locator(`${selector} input`);
  await field.fill(value);
  await field.blur();
}

test.describe('billing — invoice worklist', () => {
  test('opens on All, with every column the reference asks for', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    await expect(page.getByRole('tab', { name: 'Invoice', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('bil--chip-all')).toHaveAttribute('aria-selected', 'true');

    const head = page.getByTestId('bil--table').locator('thead');
    for (const label of [
      'Invoice ID', 'Invoice Date', 'Patient Name', 'Appointment Type', 'Date of Service',
      'Rendering Provider', 'Invoice Type', 'Total Amount ($)', 'Payment ($)', 'Due ($)', 'Status',
    ]) {
      await expect(head).toContainText(label);
    }

    // The number is hashed, because that is what an invoice number is to
    // whoever is holding the paper.
    await expect(await cell(page, 0, 'id')).toMatch(/^#[0-9A-F]{4}$/);

    assertClean();
  });

  test('Due is what is left of Total on every row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    const count = await rows(page).count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const status = await cell(page, index, 'status');
      const total = await amount(page, index, 'total');
      const payment = await amount(page, index, 'payment');
      const due = await amount(page, index, 'due');

      if (status === 'Cancelled') {
        // Nothing is owed on a cancelled invoice however much was billed.
        expect(due, `#${await cell(page, index, 'id')} is cancelled`).toBe(0);
      } else {
        expect(
          Number((total - payment).toFixed(2)),
          `row ${index} (${await cell(page, index, 'id')}) does not add up`
        ).toBe(due);
      }
    }

    assertClean();
  });

  /* The segments used to carry a count and this checked the badge against the
     pager under it. They do not any more — the strip is the switch and nothing
     else — so what is left to check is the half that was always the point: a
     segment shows the rows it names, all of them and only them. */
  test('each status segment shows only the rows it names', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    for (const status of ['Pending', 'Partially Paid', 'Paid', 'Written Off']) {
      await page.getByTestId(`bil--chip-${status}`).click();

      // The range line counts the whole filtered set rather than the page, so
      // a segment that shows nothing is caught here rather than passing the
      // loop below by having no rows to disagree with.
      const range = await page.getByTestId('bil--range').textContent();
      expect(Number(range.match(/of (\d+)/)[1]), `${status} segment`).toBeGreaterThan(0);

      const shown = await rows(page).count();
      for (let index = 0; index < shown; index += 1) {
        expect(await cell(page, index, 'status')).toBe(status);
      }
    }

    assertClean();
  });

  test('a sortable header reorders the whole list, not the page', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    await page.getByTestId('bil--table').getByRole('button', { name: 'Due ($)' }).click();

    const first = await amount(page, 0, 'due');
    const last = await amount(page, (await rows(page).count()) - 1, 'due');
    expect(first).toBeLessThanOrEqual(last);

    // Clicking the same header again turns it around.
    await page.getByTestId('bil--table').getByRole('button', { name: 'Due ($)' }).click();
    expect(await amount(page, 0, 'due')).toBeGreaterThanOrEqual(await amount(page, 1, 'due'));

    assertClean();
  });
});

test.describe('billing — the invoice document', () => {
  test('the invoice number opens the document, read-only', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    const id = (await cell(page, 0, 'id')).replace('#', '');
    const total = await amount(page, 0, 'total');
    await rows(page).first().locator('[data-open-invoice]').click();

    await expect(page.locator('#modalInvoice .ui-modal__title')).toHaveText(`Invoice #${id}`);
    // Balance Due is the row's Total Amount — the same number arrived at the
    // same way, which is the whole reason the document subtotals its items.
    await expect(page.getByTestId('bil--inv-balance')).toHaveText(total.toFixed(2));
    await expect(page.getByTestId('bil--inv-responsibility')).toContainText(
      `Total Patient Responsibility: $${total.toFixed(2)}`
    );

    // Nothing on a document being read can be changed, and there is no Save
    // to suggest otherwise.
    await expect(page.locator('#invPatient select')).toBeDisabled();
    await expect(page.getByTestId('bil--inv-save')).toHaveCount(0);
    await expect(page.getByTestId('bil--inv-add-item')).toHaveCount(0);

    assertClean();
  });

  test('Add Invoice raises one, and its items decide the balance', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);
    const before = Number((await page.getByTestId('bil--range').textContent()).match(/of (\d+)/)[1]);

    await page.getByTestId('bil--invoiceAdd').click();
    await expect(page.locator('#modalInvoice .ui-modal__title')).toHaveText('Add Invoice (Self Pay)');

    await page.locator('#invPatient select').selectOption('Priya Raman');
    // The address follows the patient rather than staying on whoever was
    // first in the list.
    await expect(page.locator('#invEmail input')).toHaveValue('priya.raman@example.com');

    await page.locator('#invItem-0 select').selectOption('99214');
    await fillInput(page, '#invQty-0', '2');
    await expect(page.getByTestId('bil--inv-subtotal')).toHaveText('400.00');

    await page.getByTestId('bil--inv-add-item').click();
    await page.locator('#invItem-1 select').selectOption('99213');
    await expect(page.getByTestId('bil--inv-subtotal')).toHaveText('550.00');

    // Insurance comes off the charge before the patient is asked for it.
    await fillInput(page, '#invInsurance', '150');
    await expect(page.getByTestId('bil--inv-balance')).toHaveText('400.00');

    await page.getByTestId('bil--inv-save').click();
    await expect(page.locator('#billFlash')).toContainText('raised for Priya Raman — $400.00');

    // It lands at the top of the list that was open, unpaid — the chip is only
    // moved when the one being looked at would have hidden it.
    expect(await cell(page, 0, 'patient')).toContain('Priya Raman');
    expect(await amount(page, 0, 'total')).toBe(400);
    expect(await amount(page, 0, 'payment')).toBe(0);
    expect(await amount(page, 0, 'due')).toBe(400);
    expect(await cell(page, 0, 'status')).toBe('Pending');

    const after = Number((await page.getByTestId('bil--range').textContent()).match(/of (\d+)/)[1]);
    expect(after).toBe(before + 1);

    // And it is filed under Pending, where an unpaid invoice belongs.
    await page.getByTestId('bil--chip-Pending').click();
    expect(await cell(page, 0, 'patient')).toContain('Priya Raman');

    assertClean();
  });

  test('the header carries one Add Invoice, at the end of the row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page);

    // No caret beside it: the kind is settled inside the document now.
    await expect(page.getByTestId('bil--invoiceKind')).toHaveCount(0);

    /* Narrow first, act last — search and the funnel are about the list, and
       the button that adds to it ends the row, as on every other worklist.
       The funnel is outside #toolbarActions because that half of the header is
       rebuilt per view and the filter holds state across it; both are direct
       children of the header's action row. */
    const order = await page
      .locator('.bil__head .ui-page-head__actions')
      .evaluateAll((hosts) =>
        [...hosts[0].querySelectorAll(':scope > *, :scope > #toolbarActions > *')]
          .map((node) => node.dataset.testid)
          .filter(Boolean)
      );
    expect(order).toEqual(['bil--search', 'bil--invoiceAdd', 'bil--filter']);

    assertClean();
  });

  test('Send Invoice addresses it to the patient on the row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    await rowMenu(page, 'Send Invoice');
    await expect(page.locator('#billFlash')).toContainText(`Invoice #${id} sent to`);
    await expect(page.locator('#billFlash')).toContainText('@example.com');

    assertClean();
  });

  test('an invoice already paid against can be read but not edited', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Paid');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    await rowMenu(page, 'Edit Invoice');

    await expect(page.locator('#billFlash')).toContainText('already been paid against');
    await expect(page.locator('#modalInvoice .ui-modal__title')).toHaveText(`Invoice #${id}`);
    await expect(page.getByTestId('bil--inv-save')).toHaveCount(0);

    assertClean();
  });
});

test.describe('billing — receipt and payment', () => {
  test('View Receipt reports the money that actually arrived', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Partially Paid');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    const patient = await cell(page, 0, 'patient');
    const payment = await amount(page, 0, 'payment');
    const due = await amount(page, 0, 'due');

    await rowMenu(page, 'View Receipt');
    const receipt = page.locator('#receiptBody');

    await expect(receipt).toContainText(`#${id}`);
    await expect(receipt).toContainText(patient);
    // The two lines that make it a receipt rather than a copy of the invoice:
    // a part-payment must not print as though the whole bill was settled.
    await expect(receipt.locator('.bil__receipt-row--total')).toContainText(payment.toFixed(2));
    await expect(receipt).toContainText(`Balance Due`);
    await expect(receipt).toContainText(due.toFixed(2));

    assertClean();
  });

  test('an invoice nobody has paid has no receipt, and says so', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    await rowMenu(page, 'View Receipt');
    await expect(page.locator('#billFlash')).toContainText('there is no receipt');
    await expect(page.locator('#modalReceipt .ui-modal')).toBeHidden();

    assertClean();
  });

  test('Collect Payment settles the invoice and stamps a receipt', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    const due = await amount(page, 0, 'due');

    await rowMenu(page, 'Collect Payment');
    await expect(page.locator('#modalCollect .ui-modal__title')).toContainText(`#${id}`);
    // Prefilled with what is owed: the common case is settling the bill, not
    // working out how much of it to settle.
    await expect(page.locator('#collectAmount input')).toHaveValue(due.toFixed(2));
    await expect(page.getByTestId('bil--collect-card')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('bil--collect-go').click();
    await expect(page.locator('#billFlash')).toContainText(`#${id} is paid in full`);

    // The worklist behind the dialog is already showing the new balance.
    await page.getByTestId('bil--chip-Paid').click();
    const row = rows(page).filter({ hasText: `#${id}` }).first();
    await expect(row).toContainText('Paid');
    await expect(row.locator('td').nth(COLUMN.due)).toHaveText('0.00');

    // And the receipt the payment stamped is now there to open.
    await row.locator('[data-menu="invoice"]').click();
    await page.getByRole('menuitem', { name: 'View Receipt', exact: true }).click();
    await expect(page.locator('#receiptBody')).toContainText(`REC-`);
    await expect(page.locator('#receiptBody .bil__receipt-row--total')).toContainText(
      due.toFixed(2)
    );

    assertClean();
  });

  test('a part payment leaves the rest owing', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    const due = await amount(page, 0, 'due');

    await rowMenu(page, 'Collect Payment');
    await fillInput(page, '#collectAmount', '25');
    await page.getByTestId('bil--collect-go').click();

    await expect(page.locator('#billFlash')).toContainText('$25.00 collected');

    await page.getByTestId('bil--chip-Partially Paid').click();
    const row = rows(page).filter({ hasText: `#${id}` }).first();
    await expect(row.locator('td').nth(COLUMN.payment)).toHaveText('25.00');
    await expect(row.locator('td').nth(COLUMN.due)).toHaveText((due - 25).toFixed(2));

    assertClean();
  });

  test('more than the balance is refused rather than absorbed', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const due = await amount(page, 0, 'due');

    await rowMenu(page, 'Collect Payment');
    await fillInput(page, '#collectAmount', String(due + 500));
    await page.getByTestId('bil--collect-go').click();

    // Nothing was taken and the dialog is still open to correct the amount:
    // money beyond the balance is a credit, which is a different document.
    await expect(page.locator('#billFlash')).toContainText(
      `Only $${due.toFixed(2)} is outstanding`
    );
    await expect(page.locator('#modalCollect .ui-modal')).toBeVisible();

    assertClean();
  });

  /* Two instruments, not the three the reference shows. Bank transfer was
     dropped on the grounds recorded beside COLLECT_METHODS: it is the only
     one that does not settle at the desk, so posting it here would put money
     on the invoice that has only been promised. */
  test('the instruments are one form with a panel each', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');
    await rowMenu(page, 'Collect Payment');

    await expect(page.locator('#collectBody')).toContainText('Add New Card');
    await expect(page.getByTestId('bil--collect-bank')).toHaveCount(0);

    await page.getByTestId('bil--collect-cash').click();
    await expect(page.getByTestId('bil--collect-cash')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#collectBody')).toContainText('Cash is recorded against the invoice');

    // The amount survives the swap — it is the subject of the dialog, not a
    // property of the instrument.
    await expect(page.locator('#collectAmount input')).not.toHaveValue('');

    await page.getByTestId('bil--collect-card').click();
    await expect(page.locator('#collectBody')).toContainText('Add New Card');

    assertClean();
  });

  test('Send Request asks the patient instead of taking the money', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    const due = await amount(page, 0, 'due');

    await rowMenu(page, 'Collect Payment');
    await page.getByTestId('bil--collect-request').click();
    await expect(page.locator('#billFlash')).toContainText('Payment request for');
    await expect(page.locator('#billFlash')).toContainText('@example.com');

    // Nothing moved: a balance changes when money arrives, not when it is asked for.
    const row = rows(page).filter({ hasText: `#${id}` }).first();
    await expect(row.locator('td').nth(COLUMN.due)).toHaveText(due.toFixed(2));

    assertClean();
  });
});

test.describe('billing — invoice lifecycle', () => {
  test('Cancel Invoice keeps the row and clears the balance', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openInvoices(page, 'Pending');

    const id = (await cell(page, 0, 'id')).replace('#', '');
    await rowMenu(page, 'Cancel Invoice');

    await expect(page.locator('#modalConfirm')).toContainText(`#${id}`);
    await page.getByTestId('bil--confirm-go').click();
    await expect(page.locator('#billFlash')).toContainText(`Invoice #${id} cancelled`);

    await page.getByTestId('bil--chip-Cancelled').click();
    const row = rows(page).filter({ hasText: `#${id}` }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('td').nth(COLUMN.due)).toHaveText('0.00');

    // Cancelled means nothing left to take.
    await row.locator('[data-menu="invoice"]').click();
    await page.getByRole('menuitem', { name: 'Collect Payment', exact: true }).click();
    await expect(page.locator('#billFlash')).toContainText('nothing to collect');

    assertClean();
  });

  test('a self-pay encounter becomes a real invoice on the Invoice tab', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(BILLING);
    await page.getByTestId('bil--chip-self').click();

    const patient = (await page
      .getByTestId('bil--table').locator('tbody tr').first()
      .locator('td').nth(2).textContent()).trim();

    await page.getByTestId('bil--table').locator('tbody tr').first()
      .locator('[data-menu="ready-self"]').click();
    await page.getByRole('menuitem', { name: 'Generate Invoice', exact: true }).click();
    await page.getByTestId('bil--confirm-go').click();

    await expect(page.locator('#modalDone')).toContainText('raised');
    await page.getByTestId('bil--done-okay').click();

    // The result dialog lands on the Invoice tab, and the invoice is really
    // there — the encounter has stopped being unbilled.
    await expect(page.getByRole('tab', { name: 'Invoice', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await cell(page, 0, 'patient')).toContain(patient);
    expect(await cell(page, 0, 'type')).toContain('Self Pay');

    assertClean();
  });
});

test.describe('billing — invoice accessibility', () => {
  test('the invoice worklist has no axe violations', async ({ page }) => {
    await openInvoices(page);
    await expectNoA11yViolations(page);
  });

  test('the invoice document has no axe violations', async ({ page }) => {
    await openInvoices(page);
    await page.getByTestId('bil--invoiceAdd').click();
    await expect(page.locator('#modalInvoice .ui-modal')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('the receipt and the payment dialog have no axe violations', async ({ page }) => {
    await openInvoices(page, 'Paid');
    await rowMenu(page, 'View Receipt');
    await expect(page.locator('#modalReceipt .ui-modal')).toBeVisible();
    await expectNoA11yViolations(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('#modalReceipt .ui-modal')).toBeHidden();

    await rowMenu(page, 'Collect Payment');
    await expect(page.locator('#billFlash')).toContainText('nothing left to collect');

    await page.getByTestId('bil--chip-Pending').click();
    await rowMenu(page, 'Collect Payment');
    await expect(page.locator('#modalCollect .ui-modal')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
