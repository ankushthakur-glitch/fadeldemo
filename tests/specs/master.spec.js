/**
 * Settings → Master: the practice's own reference lists — ICD-10, Procedure,
 * Payer, Instrument, Clinician Directory, Pharmacy, Recall Type.
 *
 * One engine drives all seven lists (see js/screens/master.js), so most
 * behaviour is proven once on ICD-10 and re-checked lightly on the others —
 * a differently-keyed duplicate check, a composed-name or composed-timeframe
 * save, the tab switch itself.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';

const HUB = '/screens/settings.html';

/*
 * The screen now opens on Data Import — an import is the one action here that
 * changes hundreds of rows at once, so it leads. Everything below is about the
 * reference lists themselves, so it deep-links past it rather than clicking
 * through on every test.
 */
const MASTER = '/screens/master.html?tab=icd';
const MASTER_DEFAULT = '/screens/master.html';

test.describe('settings navigation', () => {
  test('the hub opens Master', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(HUB);

    await page.getByTestId('settings--master').click();
    await page.waitForURL('**/master.html');
    await expect(page.getByRole('heading', { name: 'Master' })).toBeAttached();

    assertClean();
  });

  test('a hub section link opens Master on that tab', async ({ page }) => {
    await page.goto(HUB);
    await page.getByTestId('settings--mst-payer').click();
    await page.waitForURL('**/master.html?tab=payer');
    await expect(page.getByRole('tab', { name: 'Payer' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

test.describe('master — ICD-10 Codes', () => {
  test('opens on ICD-10 Codes with the seed rows', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(MASTER);

    await expect(page.getByRole('tab', { name: 'ICD-10 Codes' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const table = page.getByTestId('mst--icd-table');
    await expect(table.locator('tbody tr')).toHaveCount(15); // one page of them
    await expect(table.locator('thead')).toContainText('ICD-10 Code');
    // Loaded, not typed — see importOnly in js/screens/master.js.
    await expect(page.getByTestId('mst--add')).toHaveCount(0);
    await expect(page.getByTestId('mst--upload-data')).toHaveText('Upload Data');

    assertClean();
  });

  test('search narrows by code or description', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');
    const search = page.getByTestId('mst--search').locator('input');

    await search.fill('K21.9');
    await expect(table.locator('tbody tr')).toHaveCount(1);

    // Both reflux codes — with and without esophagitis.
    await search.fill('reflux');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table).toContainText('K21.9');

    await search.fill('not a real code');
    await expect(table.locator('tbody tr')).toHaveCount(0);
    await expect(table).toContainText('No ICD-10 codes match.');
  });

  test('switching tabs clears the previous list search', async ({ page }) => {
    await page.goto(MASTER);
    const search = page.getByTestId('mst--search').locator('input');

    await search.fill('K21.9');
    await page.getByRole('tab', { name: 'Procedure' }).click();
    await expect(search).toHaveValue('');

    await page.getByRole('tab', { name: 'ICD-10 Codes' }).click();
    await expect(search).toHaveValue('K21.9');
  });

  /**
   * The ★ column is gone from every list. The row still opens, still has its
   * ⋮ menu, and the seed order is now simply the seed order — nothing floats.
   */
  test('there is no pin column, and the seed order is the file order', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');

    await expect(table.locator('[data-favourite]')).toHaveCount(0);
    await expect(table.locator('thead')).not.toContainText('Pinned');
    await expect(page.getByTestId('mst-icd--range')).not.toContainText('pinned');

    await expect(table.locator('tbody tr').first()).toContainText('K21.9');
    await expect(table.locator('tbody tr').last()).toContainText('Z12.11');
  });

  test('the row menu no longer offers pinning', async ({ page }) => {
    await page.goto(MASTER);
    await page
      .getByTestId('mst--icd-table')
      .locator('tbody tr')
      .first()
      .locator('[data-menu]')
      .click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(3); // Edit, status, Delete
    await expect(menu).not.toContainText('Pin');
  });

  /* There is no Add on this list any more — a code set is loaded, not typed —
     so the validation is proved through the door that is left. Editing a code
     is the annual revision, and emptying a field it needs still refuses. */
  test('an edit is refused without the required fields', async ({ page }) => {
    await page.goto(MASTER);
    await page
      .getByTestId('mst--icd-table')
      .getByRole('button', { name: 'K21.9', exact: true })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Edit ICD-10 Code');

    await page.locator('[data-field="code"]').locator('input').fill('');
    await page.locator('[data-field="description"]').locator('textarea').fill('');
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="code"]')).toContainText('required');
    await expect(page.locator('[data-field="description"]')).toContainText('required');
    await expect(dialog).toBeVisible();
  });

  test('an edit refuses a code already on the list', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');

    // Whatever the first two rows happen to be — the seed is built from four
    // sources and deduped, so hard-coding a code here would break the day one
    // of them gains an entry.
    const first = (await table.locator('tbody tr').nth(0).innerText()).split('\t')[0].trim();
    await table.locator('tbody tr').nth(1).locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Renaming one code onto another is the same collision Add used to catch.
    await page.locator('[data-field="code"]').locator('input').fill(first);
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="code"]')).toContainText('already on this list');
  });

  /**
   * CODES ARRIVE AS A FILE, NOT ONE AT A TIME.
   *
   * The practice already holds them in the system it is coming off, and once a
   * year a revision replaces the ones that changed. So the primary action on
   * both code tabs is Upload Data, and the dialog opens with the entity
   * already chosen — the tab you are standing on is the answer to its first
   * question.
   */
  test('ICD-10 loads a file instead of offering Add', async ({ page }) => {
    await page.goto('/screens/master.html?tab=icd');
    await expect(page.getByTestId('mst--add')).toHaveCount(0);

    await page.getByTestId('mst--upload-data').click();
    await expect(page.getByTestId('mst--upload-entity').locator('select')).toHaveValue('icd');
    await page.getByTestId('mst--upload-cancel').click();
  });

  /**
   * CPT IS BOTH: LOADED AND AUTHORED.
   *
   * Its codes arrive in the same annual file ICD-10's do, but what the
   * practice bills WITH them — the price, the room, the vial — is local and is
   * written a code at a time. So this is the one tab carrying both doors: Add
   * primary, Upload Data beside it, and the upload still opening with CPT
   * already chosen because the tab is still the answer to that question.
   */
  test('CPT offers Add and Upload Data together', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await expect(page.getByTestId('mst--add')).toHaveText('Add Procedure');

    await page.getByTestId('mst--upload-data').click();
    await expect(page.getByTestId('mst--upload-entity').locator('select')).toHaveValue('cpt');
    await page.getByTestId('mst--upload-cancel').click();

    await page.getByTestId('mst--add').click();
    await expect(page.getByRole('dialog')).toContainText('Add Procedure');
  });

  /** Every other list still authors its own rows by hand. */
  test('the lists a practice does author keep their Add', async ({ page }) => {
    await page.goto('/screens/master.html?tab=payer');
    await expect(page.getByTestId('mst--add')).toHaveText('Add Payer');
  });

  test('the code opens the row for editing, prefilled', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');

    // exact: true — "K21.9" would otherwise also match the ⋮ menu's
    // "Actions for K21.9" accessible name.
    await table.getByRole('button', { name: 'K21.9', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Edit ICD-10 Code');
    await expect(page.locator('[data-field="code"]').locator('input')).toHaveValue('K21.9');

    await page.locator('[data-field="code"]').locator('input').fill('K21.9x');
    await page.getByTestId('mst--save').click();

    await expect(table).toContainText('K21.9x');
  });

  test('row menu: mark inactive and delete', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');
    const row = table.locator('tbody tr').filter({ hasText: 'K59.00' });

    await row.locator('[data-menu]').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    await menu.getByRole('menuitem', { name: 'Mark Inactive' }).click();
    await expect(row.getByText('Inactive')).toBeVisible();

    await row.locator('[data-menu]').click();
    await page.getByTestId('mst--menu-delete').click();

    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete ICD-10 Code' });
    await expect(confirm).toContainText('K59.00');
    await page.getByTestId('mst--delete-confirm').click();

    await expect(confirm).toBeHidden();
    await expect(table).not.toContainText('K59.00');
  });

  test('Cancel on the delete dialog leaves the row in place', async ({ page }) => {
    await page.goto(MASTER);
    const table = page.getByTestId('mst--icd-table');
    const row = table.locator('tbody tr').filter({ hasText: 'K92.2' });

    await row.locator('[data-menu]').click();
    await page.getByTestId('mst--menu-delete').click();
    await page.getByTestId('mst--delete-cancel').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(table).toContainText('K92.2');
  });
});

test.describe('master — other lists', () => {
  /*
   * A CPT code is its number and what it buys, and nothing else. The category
   * that used to sit beside them was a second vocabulary the practice had to
   * keep true — a coarser one than the code itself already is, since 45378 and
   * 45380 say "colonoscopy" far more exactly than "Endoscopy" ever did — and
   * every import was one more chance to disagree with it.
   */
  test('Procedure: a code is its number and its description, with no category beside them', async ({
    page,
  }) => {
    await page.goto(`/screens/master.html?tab=cpt`);
    await expect(page.getByRole('tab', { name: 'Procedure' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    const table = page.getByTestId('mst--cpt-table');
    await expect(table.locator('thead')).toContainText('Description');
    await expect(table.locator('thead')).not.toContainText('Category');

    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.locator('[data-field="category"]')).toHaveCount(0);
  });

  /**
   * A CODE IS ADDED WITH ITS PRICE ON IT, NOT PRICED AFTERWARDS.
   *
   * Everything the form asks for is one code's whole billing identity: what it
   * is, whether the practice bills it, which vial it dispenses and how much
   * that is, and what it charges from when. A code saved without a price is a
   * code somebody has to remember to come back to, and a charge master's whole
   * job is that nobody has to remember.
   */
  /**
   * FOUR SLOTS, AND CLEARING ONE CLOSES THE GAP.
   *
   * A claim line carries up to four modifiers and their order is meaningful,
   * so they are four positional boxes rather than one field with commas in it.
   * Clearing the first of two means the second is now the only modifier on the
   * line — not that the line leads with an empty slot, which is what a stored
   * ['', '59'] would put on a claim.
   */
  test('Procedure: the modifier boxes sit under the code and close their gaps', async ({
    page,
  }) => {
    await page.goto('/screens/master.html?tab=cpt');
    // Anesthesia here is a CRNA's job with nobody directing it, which is what
    // QZ says — see CPT_MODIFIERS in data/master.js.
    await page.getByTestId('mst--search').locator('input').fill('00812');

    const table = page.getByTestId('mst--cpt-table');
    await expect(table.locator('thead')).toContainText('Modifier');
    await expect(table.locator('tbody tr').first()).toContainText('-QZ');

    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog');
    const boxes = dialog.locator('[data-modifier]');
    await expect(boxes).toHaveCount(4);
    await expect(boxes.nth(0)).toHaveValue('QZ');
    await expect(boxes.nth(1)).toHaveValue('');

    // Clear the first, type the second in lower case: one modifier survives,
    // upper-cased, in first position.
    await boxes.nth(0).fill('');
    await boxes.nth(1).fill('p3');
    await page.getByTestId('mst--save').click();

    await expect(table.locator('tbody tr').first()).toContainText('-P3');
    await expect(table.locator('tbody tr').first()).not.toContainText('QZ');

    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog').locator('[data-modifier]').nth(0)).toHaveValue('P3');
  });

  test('Procedure: a code is added with its NDC, its base units and a dated fee', async ({
    page,
  }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--add').click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('[data-field="code"]').locator('input').fill('J3357');
    await dialog
      .locator('[data-field="description"]')
      .locator('textarea')
      .fill('Ustekinumab sub cu inj, 1 mg');
    await dialog.locator('[data-field="ndc"]').locator('input').fill('57894-060-02');
    await dialog.locator('[data-field="ndcQty"]').locator('input').fill('90');
    // Stored as the code the claim carries, read as the words a person picks.
    await dialog.locator('[data-field="ndcUnit"]').locator('select').selectOption('ME');
    await dialog.locator('[data-field="units"]').locator('input').fill('90');

    const fees = dialog.locator('[data-fee-row]');
    await fees.nth(0).locator('[data-fee="effective"]').fill('2025-08-01');
    await fees.nth(0).locator('[data-fee="professional"]').fill('300');

    await page.getByTestId('mst--save').click();
    await expect(dialog).toBeHidden();

    // New rows land at the top of page one.
    const row = page.getByTestId('mst--cpt-table').locator('tbody tr').first();
    await expect(row).toContainText('J3357');
    await expect(row).toContainText('57894-060-02');
    await expect(row).toContainText('90 ME');
    await expect(row).toContainText('$300.00');
    await expect(row).toContainText('× 90 = $27,000.00');
    await expect(row).toContainText('Active');
  });

  /**
   * A PRICE HAS A DATE, AND THE OLD ONE STAYS.
   *
   * The + adds a dated row rather than the form having one Fee box that gets
   * retyped, because a claim is priced by the date of service: overwriting
   * last year's number would make every appeal and corrected claim quietly
   * wrong. What the table shows is the newest row that has actually taken
   * effect — a rise dated for next quarter sits on the list without being
   * charged early.
   */
  test('Procedure: a second fee is added beside the first, not over it', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--search').locator('input').fill('99213');

    const table = page.getByTestId('mst--cpt-table');
    await expect(table.locator('tbody tr').first()).toContainText('$155.00');

    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog');
    // The three prices this code has carried, newest first.
    await expect(dialog.locator('[data-fee-row]')).toHaveCount(3);
    await expect(dialog.locator('[data-fee-row]').first().locator('[data-fee="effective"]')).toHaveValue(
      '2025-01-01'
    );

    // Dated a year out and computed rather than written down, so the test is
    // still asking about a FUTURE rise the year after next.
    const nextYear = `${new Date().getFullYear() + 1}-01-01`;
    await page.getByTestId('mst--fee-add').click();
    const added = dialog.locator('[data-fee-row]').last();
    await added.locator('[data-fee="effective"]').fill(nextYear);
    await added.locator('[data-fee="professional"]').fill('170');

    await page.getByTestId('mst--save').click();

    // Four rows now, and the code still charges $155 — next year's rise is
    // agreed, not in effect.
    await expect(table.locator('tbody tr').first()).toContainText('$155.00');
    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog').locator('[data-fee-row]')).toHaveCount(4);
  });

  /** The form asks the same question the pill answers, so a code can be added
   *  already retired — a superseded code the practice still needs to look up
   *  and must not be able to pick. */
  test('Procedure: Status is set on the form, not only from the row menu', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--add').click();

    const dialog = page.getByRole('dialog');
    const status = dialog.locator('[data-field="status"]').locator('select');
    await expect(status).toHaveValue('Active'); // what an added code is for

    await dialog.locator('[data-field="code"]').locator('input').fill('45999');
    await dialog
      .locator('[data-field="description"]')
      .locator('textarea')
      .fill('Unlisted procedure, colon');
    await status.selectOption('Inactive');
    await page.getByTestId('mst--save').click();

    const row = page.getByTestId('mst--cpt-table').locator('tbody tr').first();
    await expect(row).toContainText('45999');
    await expect(row).toContainText('Inactive');
    // No schedule was typed, so it is unpriced rather than free.
    await expect(row).toContainText('Not priced');
  });

  /*
   * A MEDICATION CODE IS PRICED PER UNIT.
   *
   * A J-code is defined as a quantity of drug — "propofol, 10 mg" — so what
   * the practice charges is a rate per unit, and what reaches a claim is that
   * rate times the units given. The table shows the multiplication rather
   * than only its two inputs, because the product is the number a coder is
   * actually checking.
   */
  test('Procedure: a medication code carries its NDC, its units and a per-unit fee', async ({
    page,
  }) => {
    await page.goto('/screens/master.html?tab=cpt');

    const table = page.getByTestId('mst--cpt-table');
    for (const column of ['NDC', 'Base Units', 'Fee']) {
      await expect(table.locator('thead')).toContainText(column);
    }

    // The NDC is searchable: a pharmacy query arrives as the number on the
    // vial, not as the code somebody billed it under.
    await page.getByTestId('mst--search').locator('input').fill('63323-269-20');
    const row = table.locator('tbody tr').first();
    await expect(row).toContainText('J2704');
    await expect(row).toContainText('Injection, propofol, 10 mg');
    await expect(row).toContainText('63323-269-20');
    // The quantity and unit ride under the number — a payer rejects a drug
    // line carrying one without the other.
    await expect(row).toContainText('20 ML');
    // $0.50 a unit × 50 units = $25.00 — the arithmetic, shown.
    await expect(row).toContainText('$0.50');
    await expect(row).toContainText('× 50 = $25.00');
  });

  /**
   * MOST CODES ARE NOT DRUGS, AND ALL OF THEM HAVE A PRICE.
   *
   * The medication columns say "not a drug" with a dash rather than a zero —
   * "0.00" in a units column is a different claim from "this code is not
   * dispensed". The Fee column is never a dash: a charge master with a blank
   * price is not one. What changes is the second line, which carries the ASC's
   * facility fee where a drug code would carry its multiplication.
   */
  test('Procedure: a procedure code has no NDC and both halves of its fee', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--search').locator('input').fill('45378');

    const row = page.getByTestId('mst--cpt-table').locator('tbody tr').first();
    await expect(row).toContainText('45378');
    await expect(row).toContainText('$495.00');
    await expect(row).toContainText('Facility $1,310.00');
    await expect(row).not.toContainText('×'); // no per-unit arithmetic on a procedure
  });

  /** The fields are editable, and the total follows the numbers rather than
   *  being stored beside them. */
  test('Procedure: changing the base units changes what the code comes to', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--search').locator('input').fill('J2704');

    const table = page.getByTestId('mst--cpt-table');
    await table.locator('tbody tr').first().locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-field="ndc"]').locator('input')).toHaveValue('63323-269-20');
    await expect(dialog.locator('[data-field="ndcUnit"]').locator('select')).toHaveValue('ML');
    // The per-unit price is on the schedule, not in a field of its own.
    await expect(
      dialog.locator('[data-fee-row]').first().locator('[data-fee="professional"]')
    ).toHaveValue('0.5');

    await dialog.locator('[data-field="units"]').locator('input').fill('80');
    await page.getByTestId('mst--save').click();

    await expect(table.locator('tbody tr').first()).toContainText('× 80 = $40.00');
  });

  test('Payer: a duplicate Payer ID is refused, not a duplicate name', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=payer`);
    await page.getByTestId('mst--add').click();

    await page.locator('[data-field="name"]').locator('input').fill('A New Payer');
    await page.locator('[data-field="payerId"]').locator('input').fill('BCBSND'); // already used
    await page.locator('[data-field="payerType"]').locator('select').selectOption('Commercial');
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="payerId"]')).toContainText('already on this list');
  });

  /**
   * Claims Address left the list: it is a mailing detail nobody scans a table
   * for, and it was the widest column on screen. "Plan Type" is now "Payer
   * Type" — the same fact, under the name the practice actually uses.
   */
  test('Payer: Payer Type replaces Plan Type, and Claims Address is gone', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=payer`);
    const table = page.getByTestId('mst--payer-table');
    const head = table.locator('thead');

    await expect(head).toContainText('Payer Type');
    await expect(head).not.toContainText('Plan Type');
    await expect(head).not.toContainText('Claims Address');
    await expect(table).not.toContainText('PO Box 4160');

    // Named rather than counted: the list is still gaining columns, and a
    // bare total would fail on the next one that has nothing to do with
    // either of the two changes this test is about.
    for (const column of ['Payer Name', 'Payer ID', 'Payer Type', 'Status']) {
      await expect(head).toContainText(column);
    }
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Sanford Health Plan' })
    ).toContainText('Commercial');

    // The dialog follows the list: no Claims Address field to fill in either.
    await page.getByTestId('mst--add').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Payer Type');
    await expect(dialog).not.toContainText('Claims Address');
    await expect(page.locator('[data-field="claims"]')).toHaveCount(0);
  });

  test('Instrument: Serial Number is the unique key', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=instrument`);
    await page.getByTestId('mst--add').click();

    await page.locator('[data-field="name"]').locator('input').fill('Spare Colonoscope');
    await page.locator('[data-field="serial"]').locator('input').fill('2510717'); // already used
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="serial"]')).toContainText('already on this list');

    /* NO TYPE FIELD. A required dropdown of nine kinds — Colonoscope, Video
       Processor, Insufflator — stood between the name and the serial, and
       every one of its answers was already written in the asset tag two fields
       above it: "UCR CO₂ Insufflator #0111" has said what it is, and
       "CF-HQ190L" is a colonoscope and cannot be anything else. */
    await expect(page.locator('[data-field="type"]')).toHaveCount(0);
  });

  test('Clinician Directory: seed rows and their composed names', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=clinician`);
    const table = page.getByTestId('mst--clinician-table');

    await expect(table.locator('tbody tr')).toHaveCount(15); // one page of the directory
    await expect(table.locator('thead')).toContainText('Name');
    await expect(table.locator('thead')).toContainText('Clinic');
    await expect(table.locator('thead')).toContainText('Address');
    // Credential folds into the composed name; no middle name.
    await expect(table).toContainText('Abbasi, Sadeea, MD');
    // Middle name, no credential.
    await expect(table).toContainText('Adamson, Joseph ROLAND');
    // No clinic on file reads as the directory's own "N/A", not a blank cell.
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Abler, Kristi' })
    ).toContainText('N/A');
  });

  test('Clinician Directory: Add is refused without Last or First Name', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=clinician`);
    await page.getByTestId('mst--add').click();

    await expect(page.getByRole('dialog')).toContainText('Name Information');
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="lastName"]')).toContainText('required');
    await expect(page.locator('[data-field="firstName"]')).toContainText('required');
  });

  test('Clinician Directory: a new clinician is composed from its parts', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=clinician`);
    await page.getByTestId('mst--add').click();

    await page.locator('[data-field="lastName"]').locator('input').fill('Okafor');
    await page.locator('[data-field="firstName"]').locator('input').fill('Daniel');
    await page.locator('[data-field="credential"]').locator('select').selectOption('DO');
    await page.locator('[data-field="clinicName"]').locator('input').fill('Red River ASC');
    await page.locator('[data-field="phone"]').locator('input').fill('(701) 555-0142');
    await page.getByTestId('mst--save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    const table = page.getByTestId('mst--clinician-table');
    await expect(table).toContainText('Okafor, Daniel, DO');
    await expect(table).toContainText('Red River ASC');
    await expect(table).toContainText('Phone: (701) 555-0142');
  });

  test('Pharmacy: seed rows, and a duplicate name is allowed', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=pharmacy`);
    const table = page.getByTestId('mst--pharmacy-table');

    await expect(table.locator('tbody tr')).toHaveCount(15); // one page of them
    await expect(table.locator('thead')).toContainText('Pharmacy Name');
    await expect(table.locator('thead')).toContainText('Type');
    await expect(table).toContainText('Long Term Care');
    await expect(table).toContainText('Phone: (737) 447-4248');
    await expect(table).toContainText('Fax: (727) 479-3047');

    // A chain can have the same name at another address — no unique key here.
    await page.getByTestId('mst--add').click();
    await page.locator('[data-field="name"]').locator('input').fill('3 RIVERS PHARMACY');
    await page.locator('[data-field="addressLine1"]').locator('input').fill('9 Second Ave');
    await page.getByTestId('mst--save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(table.locator('tbody tr').filter({ hasText: '3 RIVERS PHARMACY' })).toHaveCount(2);
  });

  test('Recall Type: seed rows, and the timeframe is composed on save', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=recall`);
    const table = page.getByTestId('mst--recall-table');

    await expect(table.locator('thead')).toContainText('Recall Type');
    await expect(table.locator('thead')).toContainText('Timeframe');
    // Singular for 1, plural otherwise — matching the source list's own wording.
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Colonoscopy 1 Year' })
    ).toContainText('1 year');
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Colonoscopy 3 Years' })
    ).toContainText('3 years');

    await page.getByTestId('mst--add').click();
    await page.locator('[data-field="name"]').locator('input').fill('EGD 8 Weeks Repeat');
    await page.locator('[data-field="activity"]').locator('select').selectOption('EGD');
    await page.locator('[data-field="timeframeValue"]').locator('input').fill('8');
    await page.locator('[data-field="timeframeUnit"]').locator('select').selectOption('Weeks');
    await page.getByTestId('mst--save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      table.locator('tbody tr').filter({ hasText: 'EGD 8 Weeks Repeat' })
    ).toContainText('8 weeks');
  });

  test('Recall Type: a duplicate name is refused', async ({ page }) => {
    await page.goto(`/screens/master.html?tab=recall`);
    await page.getByTestId('mst--add').click();

    await page.locator('[data-field="name"]').locator('input').fill('Colonoscopy 1 Year');
    await page.locator('[data-field="activity"]').locator('select').selectOption('Colonoscopy');
    await page.locator('[data-field="timeframeValue"]').locator('input').fill('1');
    await page.locator('[data-field="timeframeUnit"]').locator('select').selectOption('Years');
    await page.getByTestId('mst--save').click();

    await expect(page.locator('[data-field="name"]')).toContainText('already on this list');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(MASTER);
    await expectNoA11yViolations(page);
  });

  /** The CPT form is the one that leaves the <ui-input> vocabulary — its fee
   *  schedule is a grid of bare inputs under a header row it is not nested
   *  inside, so each cell has to name itself. */
  test('no WCAG 2.1 A/AA violations in the CPT form @a11y', async ({ page }) => {
    await page.goto('/screens/master.html?tab=cpt');
    await page.getByTestId('mst--add').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — master (ICD-10 Codes)', async ({ page }) => {
    await page.goto(MASTER);
    await expect(page.getByTestId('mst--icd-table')).toBeVisible();
    await expect(page).toHaveScreenshot('master-icd.png');
  });
});


/* ===================== THE REPAIR REGISTER =====================
   An instrument's repair history is what an infection-control audit asks for,
   and what it asks for is the paperwork: the vendor's RMA sheet, the leak-test
   certificate. So the document is attached with the repair it belongs to, and
   the record opens it rather than merely naming it.
   ============================================================== */

test.describe('master — the repair register', () => {
  /* A real PDF, small enough to write out here. The point is the type, not the
     contents: everything downstream keys off the browser agreeing this is a
     PDF. */
  const PDF = Buffer.from('%PDF-1.4 1 0 obj<</Type/Catalog>>endobj trailer<</Root 1 0 R>> %%EOF');

  const attachDoc = (page, name = 'olympus-rma-99001.pdf', mimeType = 'application/pdf') =>
    page
      .getByTestId('mst--repair-file')
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType, buffer: PDF });

  /** Open one instrument's repair history. */
  async function openRegister(page, instrument = 'CF-HQ190L #0123') {
    await page.goto('/screens/master.html?tab=instrument');
    await page.getByRole('button', { name: new RegExp(`Repair history for ${instrument}`) }).click();
    await expect(page.getByTestId('mst--repair-form')).toBeVisible();
  }

  /* The form's commit button used to be marked .ui-modal__actions, which is
     the dialog's own footer row — ui-modal hoists that out on open, found the
     Close row below it the second time round, and replaced the footer with it.
     Add repair vanished, and with it any way to file a repair at all. */
  test('the form can be committed', async ({ page }) => {
    await openRegister(page);
    await expect(page.getByTestId('mst--repair-add')).toBeVisible();
  });

  test('a repair is filed with the document that came with it', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRegister(page);

    await page.locator('#repairDate').locator('input').fill('2026-08-14');
    await page
      .locator('#repairDetail')
      .locator('textarea')
      .fill('Light guide bundle replaced; leak test passed on return.');
    await attachDoc(page);
    await page.getByTestId('mst--repair-add').click();

    const card = page.locator('.mst__repair-card');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'View olympus-rma-99001.pdf' })).toBeVisible();

    // And the dropzone is empty again, so the next repair does not inherit it.
    await expect(page.getByTestId('mst--repair-file')).toContainText('click to browse');

    assertClean();
  });

  test('the attached document opens in the browser viewer', async ({ page }) => {
    await openRegister(page);

    await page.locator('#repairDate').locator('input').fill('2026-08-14');
    await page.locator('#repairDetail').locator('textarea').fill('Channel replaced.');
    await attachDoc(page);
    await page.getByTestId('mst--repair-add').click();

    await page.getByRole('button', { name: 'View olympus-rma-99001.pdf' }).click();
    await expect(page.getByRole('heading', { name: 'olympus-rma-99001.pdf' })).toBeVisible();
    // The bytes are the page's own, so the frame points at a blob it holds.
    await expect(page.locator('.mst__doc-frame')).toHaveAttribute('src', /^blob:/);
    await expect(page.getByTestId('mst--repair-doc-open')).toBeVisible();
  });

  /* A seeded repair names its paperwork and has none of it. Saying so beats
     drawing a convincing picture of a certificate that does not exist. */
  test('a document with no file behind it says so', async ({ page }) => {
    await openRegister(page, 'GIF-HQ190 #0119');

    await page.getByRole('button', { name: 'View olympus-rma-88213.pdf' }).click();
    await expect(page.getByTestId('mst--repair-doc-empty')).toBeVisible();
    await expect(page.getByTestId('mst--repair-doc-open')).toBeHidden();
  });

  /* accept=".pdf" filters the picker; it does not filter a drag-and-drop, and
     it does not stop a picker set back to "All files". */
  test('anything that is not a PDF is refused', async ({ page }) => {
    await openRegister(page);

    await attachDoc(page, 'scan.png', 'image/png');
    await expect(page.locator('#repairFileError')).toContainText('is not a PDF');
    await expect(page.getByTestId('mst--repair-file')).toContainText('click to browse');
  });

  test('no WCAG 2.1 A/AA violations in the repair register @a11y', async ({ page }) => {
    await openRegister(page, 'GIF-HQ190 #0119');
    await expectNoA11yViolations(page);
  });
});


/* ===================== DATA IMPORT: THE TRANSFER DESK =====================
   Moving a list in or out is one job with two directions, and it happens in
   one place. It used to be a pair of buttons on each list that happened to
   declare a CSV shape, which meant two transfers took two tabs — and the lists
   without the buttons looked untransferable.

   The import is checked before it writes anything, so these tests are mostly
   about what it REFUSES: a file that silently dropped a third of its codes
   would only surface months later, in a denied claim.
   ======================================================================= */

test.describe('master — data import and export', () => {
  /** Hand a CSV to the dropzone's real <input type="file">. */
  const attach = (page, name, csv) =>
    page
      .getByTestId('mst--upload-file')
      .locator('input[type="file"]')
      .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) });

  /** Open Upload Data and say which list the file is for. */
  async function openUpload(page, entityId) {
    await page.goto(MASTER_DEFAULT);
    await page.getByTestId('mst--upload-data').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const entity = page.getByTestId('mst--upload-entity').locator('select');
    await entity.selectOption(entityId);
    await entity.dispatchEvent('change');
  }

  /**
   * THE INSTRUMENT REGISTER IS THE ONE EXCEPTION, and it earns it.
   *
   * Everything else moves data from Data Import, which is the right home for a
   * job that names its own entity. The scope register is the one list a unit
   * already keeps as a spreadsheet: the biomed engineer's copy IS the source,
   * it comes back from the vendor with new serials on it, and it goes out to
   * the infection-control audit. Sending that person to another tab to name a
   * list they are standing on is a step for the product's benefit.
   */
  test('the instrument register carries Download and Import on its own tab', async ({ page }) => {
    await page.goto('/screens/master.html?tab=instrument');

    const download = page.getByTestId('mst--export');
    const importer = page.getByTestId('mst--import');
    await expect(download).toBeVisible();
    await expect(download).toContainText('Download');
    await expect(importer).toBeVisible();

    // Download opens the export dialog already on Instrument — the tab has
    // answered "which list" by being the tab you are standing on.
    await download.locator('button').click();
    await expect(page.getByTestId('mst--export-entity').locator('select')).toHaveValue('instrument');
  });

  test('both directions live on Data Import, and nowhere else', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    await expect(page.getByTestId('mst--export')).toBeVisible();
    await expect(page.getByTestId('mst--upload-data')).toBeVisible();

    // Instrument is deliberately not in this list — see the test above it.
    for (const tab of ['ICD-10 Codes', 'Procedure', 'Payer', 'Pharmacy']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByTestId('mst--export')).toHaveCount(0);
      await expect(page.getByTestId('mst--bulk')).toHaveCount(0);

      /* Each list keeps its own primary action — transferring moved, creating
         did not. On the lists a practice authors that is still Add. On the two
         code tabs it is Upload Data, because a code set is loaded rather than
         typed, and that button is a shortcut into the same dialog Data Import
         opens rather than a second way to transfer. */
      const codeTab = tab.endsWith('Codes');
      await expect(page.getByTestId(codeTab ? 'mst--upload-data' : 'mst--add')).toBeVisible();
    }
  });

  /* Every list can be transferred, including the ones no list-level button
     ever offered. A directory typed by hand still has to be able to leave. */
  test('every list is offered in both directions', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    const entities = ['icd', 'cpt', 'payer', 'clinician', 'instrument', 'pharmacy', 'recall'];

    await page.getByTestId('mst--export').click();
    for (const id of entities) {
      await expect(
        page.getByTestId('mst--export-entity').locator(`option[value="${id}"]`)
      ).toHaveCount(1);
    }
    await page.getByTestId('mst--export-cancel').click();

    await page.getByTestId('mst--upload-data').click();
    for (const id of entities) {
      await expect(
        page.getByTestId('mst--upload-entity').locator(`option[value="${id}"]`)
      ).toHaveCount(1);
    }
  });

  test('nothing can be uploaded until the screen knows which list it is for', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    await page.getByTestId('mst--upload-data').click();

    // A file with no entity is a file nobody can check.
    await expect(page.getByTestId('mst--upload-confirm').locator('button')).toBeDisabled();
    await attach(page, 'icd.csv', 'K80.20,Calculus of gallbladder\n');
    await expect(page.getByTestId('mst--upload-confirm').locator('button')).toBeDisabled();
    await expect(page.getByTestId('mst--upload-summary')).toHaveCount(0);

    // Naming the list checks the file already attached, rather than asking for
    // it a second time.
    const entity = page.getByTestId('mst--upload-entity').locator('select');
    await entity.selectOption('icd');
    await entity.dispatchEvent('change');

    await expect(page.getByTestId('mst--upload-summary')).toHaveText('1 of 1 ready to import');
    await expect(page.getByTestId('mst--upload-confirm').locator('button')).toBeEnabled();
  });

  test('a clean file imports every line, header and quoted commas included', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openUpload(page, 'icd');

    await attach(
      page,
      'icd.csv',
      'ICD-10 Code,Description\n' +
        'K80.20,"Calculus of gallbladder, without cholecystitis"\n' +
        'K35.80,Unspecified acute appendicitis\n' +
        'K76.0,"Fatty (change of) liver, not elsewhere classified"\n'
    );

    // The header line is recognised, not imported as a code.
    await expect(page.getByTestId('mst--upload-summary')).toHaveText('3 of 3 ready to import');
    await expect(page.getByTestId('mst--upload-preview')).not.toContainText('ICD-10 Code,');

    await page.getByTestId('mst--upload-confirm').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('tab', { name: 'ICD-10 Codes' }).click();
    const table = page.getByTestId('mst--icd-table');
    await expect(page.getByTestId('mst-icd--range')).toContainText('of 74');
    // File order survives: line one of the file is row one of the list.
    await expect(table.locator('tbody tr').first()).toContainText('K80.20');
    // The comma inside the quoted cell stayed in the description.
    await expect(table.locator('tbody tr').first()).toContainText(
      'Calculus of gallbladder, without cholecystitis'
    );

    assertClean();
  });

  /**
   * A code already on the list is an UPDATE, not a duplicate.
   *
   * This is what the yearly ICD-10 and CPT revisions actually are: a file of
   * mostly-existing codes with changed wording on some of them. Refusing those
   * would mean the annual update could only be applied by hand.
   *
   * Two lines of the SAME file claiming one code is still an error — that is
   * the file contradicting itself, and there is no way to know which wins.
   */
  test('an existing code is updated; bad lines are still named and skipped', async ({ page }) => {
    await openUpload(page, 'icd');
    await attach(
      page,
      'icd.csv',
      'K21.9,GERD without esophagitis — 2026 revision\n' +
        ',Missing its code\n' +
        'K80.20,Calculus of gallbladder\n' +
        'K80.20,The same code a second time\n'
    );

    await expect(page.getByTestId('mst--upload-summary')).toHaveText(
      '2 of 4 ready to import · 2 skipped'
    );

    const preview = page.getByTestId('mst--upload-preview');
    await expect(preview.locator('tbody tr').nth(0)).toContainText('Updates existing');
    await expect(preview.locator('tbody tr').nth(1)).toContainText('required');
    await expect(preview.locator('tbody tr').nth(2)).toContainText('Ready');
    await expect(preview.locator('tbody tr').nth(3)).toContainText('Same as line 3 above');

    await page.getByTestId('mst--upload-confirm').click();
    await expect(page.locator('#masterFlash')).toContainText('1 added');
    await expect(page.locator('#masterFlash')).toContainText('1 updated');

    await page.getByRole('tab', { name: 'ICD-10 Codes' }).click();
    // One added and one rewritten in place — 72 rows, not 73.
    await expect(page.getByTestId('mst-icd--range')).toContainText('of 72');
    await expect(page.getByTestId('mst--icd-table')).toContainText('2026 revision');
  });

  /* The log records what a load DID, not that somebody clicked: how many rows
     went in, and how many lines it would not take. */
  test('the load is recorded in the import log with its real outcome', async ({ page }) => {
    await openUpload(page, 'icd');
    await attach(page, 'annual-update.csv', 'K80.20,Calculus of gallbladder\n,Missing its code\n');
    await page.getByTestId('mst--upload-confirm').click();

    const logged = page.getByTestId('mst--import-table').locator('tbody tr').first();
    await expect(logged).toContainText('annual-update.csv');
    await expect(logged).toContainText('ICD-10 Codes');
    await expect(logged).toContainText('Amara Mensah');
    await expect(logged).toContainText('Pass');
    await expect(logged).toContainText('1 line skipped');
  });

  test('a file with nothing importable cannot be imported', async ({ page }) => {
    await openUpload(page, 'icd');
    await attach(page, 'icd.csv', ',No code at all\n');

    await expect(page.getByTestId('mst--upload-summary')).toContainText('0 of 1');
    await expect(page.getByTestId('mst--upload-confirm').locator('button')).toBeDisabled();
  });

  /**
   * A payer type is a fixed list, so an import cannot invent one. Case is
   * forgiven — "commercial" is the practice's own Commercial, not a second
   * type that would then split every report by payer type in two.
   */
  test('Payer: a payer type must be one the practice already has', async ({ page }) => {
    await openUpload(page, 'payer');
    await attach(
      page,
      'payer.csv',
      'Payer Name,Payer ID,Payer Type\n' +
        'Prairie Health Plan,PRHP01,commercial\n' +
        'MediNova Mutual,DKMU01,Barter\n'
    );

    await expect(page.getByTestId('mst--upload-summary')).toHaveText(
      '1 of 2 ready to import · 1 skipped'
    );
    await expect(page.getByTestId('mst--upload-preview')).toContainText('must be one of');

    await page.getByTestId('mst--upload-confirm').click();
    await page.getByRole('tab', { name: 'Payer' }).click();

    const table = page.getByTestId('mst--payer-table');
    await expect(table.locator('tbody tr').filter({ hasText: 'PRHP01' })).toContainText(
      'Commercial'
    );
    await expect(table).not.toContainText('DKMU01');
  });

  test('a blank template can be taken for any list', async ({ page }) => {
    await openUpload(page, 'payer');
    const download = page.waitForEvent('download');
    await page.getByTestId('mst--upload-template').click();
    expect((await download).suggestedFilename()).toBe('payer-template.csv');
  });

  test('the template asks for an entity before it can name the columns', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    await page.getByTestId('mst--upload-data').click();
    await page.getByTestId('mst--upload-template').click();
    await expect(page.getByTestId('mst--upload-entity')).toContainText('Choose an entity first');
  });

  test('Export downloads the chosen list, whole', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    await page.getByTestId('mst--export').click();

    // The count travels with the name: which list, and how big, is one question.
    await expect(page.getByTestId('mst--export-entity')).toContainText('ICD-10 Codes (10)');

    const entity = page.getByTestId('mst--export-entity').locator('select');
    await entity.selectOption('icd');
    await entity.dispatchEvent('change');

    const download = page.waitForEvent('download');
    await page.getByTestId('mst--export-confirm').click();
    expect((await download).suggestedFilename()).toMatch(/^icd-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.locator('#masterFlash')).toContainText('Exported 10 rows from ICD-10 Codes');
  });

  test('Export asks which list rather than guessing', async ({ page }) => {
    await page.goto(MASTER_DEFAULT);
    await page.getByTestId('mst--export').click();
    await page.getByTestId('mst--export-confirm').click();
    await expect(page.getByTestId('mst--export-entity')).toContainText('Choose a list to export');
  });

  test('no WCAG 2.1 A/AA violations in the upload dialog @a11y', async ({ page }) => {
    await openUpload(page, 'icd');
    await attach(page, 'icd.csv', 'K80.20,Calculus of gallbladder\n');
    await expect(page.getByTestId('mst--upload-summary')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
