/**
 * Inventory — the daily count sheet, and the register behind it.
 *
 * The behaviour worth protecting is the arithmetic, not the layout. An
 * inventory screen has exactly one way to be dangerous — telling the desk they
 * have stock they may not actually give a patient — so most of what follows is
 * about expiry, totals and the difference between an empty shelf and a shelf
 * full of expired boxes.
 *
 * The count sheet adds a second kind of arithmetic to protect, and it is the
 * kind a controlled-drug inspection turns on: expected against counted, the
 * difference between them, and the two names that have to be against a dose
 * given and an ampoule destroyed. The tests that matter most there are the
 * ones proving an uncounted line cannot pass for a reconciled one, and that
 * what one day counts out is what the next day is handed.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';
import {
  openFilter,
  tickFilter,
  clearFilter,
  doneFilter,
  filterPanel,
  filterOptions,
  filterCount,
} from '../helpers/filter.js';

const LIST = '/screens/medication-inventory.html';

/** The fixture's today, from data/medication-inventory.js. The report opens
 *  on it, so a test about "today" has to mean the same day the data does. */
const TODAY = '2026-08-04';

const errs = (page) => {
  const out = [];
  page.on('console', (m) => m.type() === 'error' && out.push(m.text()));
  page.on('pageerror', (e) => out.push(String(e)));
  return out;
};

const listRows = (page) => page.getByTestId('med--table').locator('tbody tr');
const lotRows = (page) => page.getByTestId('med--lot-table').locator('tbody tr');
const countRows = (page) => page.locator('#countTable tbody tr');

const rowFor = (page, name) => listRows(page).filter({ hasText: name });

/**
 * Open the register.
 *
 * There is no button for it. The tab strip that used to offer it is gone —
 * Inventory is the count sheet — and the lot register is reached by the deep
 * links that always worked: ?status= from a reorder task, ?med= from a
 * bookmark. The helper walks the way somebody actually arrives.
 */
async function openList(page) {
  await page.goto(`${LIST}?view=stock`);
  await expect(page.getByTestId('med--table')).toBeVisible();
}

async function openDetail(page, name) {
  await openList(page);
  await page.getByTestId('med--search').locator('input').fill(name);
  await page.locator('.med__name').first().click();
  await expect(page.getByTestId('med--detail-title')).toBeVisible();
}

/* ===================== The count sheet, worked ===================== */

/**
 * One box on one line of the sheet.
 *
 * By row index and column key rather than by testid alone: every row carries
 * the same nine testids, and a helper that reached for the first match would
 * quietly test Diazepam eight times over.
 */
const countBox = (page, row, key) =>
  countRows(page).nth(row).locator(`[data-count-field="${key}"] input`);

/** What one line's two computed cells read right now. */
const countSum = (page, row, which) =>
  countRows(page).nth(row).locator(`[data-count-cell="${which}"]`);

/** The two fields that are names rather than numbers. They are dropdowns off
 *  the practice's roster, so a test picks from them rather than typing. */
const countPerson = (page, row, key) =>
  countRows(page).nth(row).locator(`[data-count-field="${key}"] select`);

/** Who the roster offers, for a test that needs a real name without hard-coding
 *  one — the list is the practice's and may grow. */
const SOMEONE = 'K. Brandt, RN';
const SOMEONE_ELSE = 'Robert Fox';

/**
 * Fill a line and press its Save.
 *
 * The keys are the sheet's own, so a test reads as the count it is making
 * rather than as a list of selectors — and the two name keys route to the
 * dropdown rather than to `fill`, because a <select> cannot be typed into.
 */
async function fileLine(page, row, values) {
  for (const [key, value] of Object.entries(values)) {
    if (key === 'givenBy' || key === 'witness') {
      await countPerson(page, row, key).selectOption(String(value));
    } else {
      await countBox(page, row, key).fill(String(value));
    }
  }
  await countRows(page).nth(row).locator('ui-button[data-save-row]').click();
}

/** The last thing the screen said. */
const lastToast = (page) => page.locator('.ui-toast').last();

/** What a line opens holding. Read rather than written into the test: the
 *  fixture's carried-forward figures are demo data and will be edited, and a
 *  test that hard-codes one is a test that breaks when the seed is tuned. */
const openingCount = async (page, row) => Number(await countBox(page, row, 'start').inputValue());

/** Put a different sheet on the desk. */
async function openSheet(page, date) {
  await page.getByTestId('cnt--date').locator('input').fill(date);
  await expect(page.getByTestId('cnt--heading')).not.toBeEmpty();
}

/* ===================== Getting there ===================== */

test.describe('medication inventory — reaching it', () => {
  /**
   * Inventory is a top-level section, not a Settings module. Stock is work —
   * checked before a clinic list, reordered from — and burying it two clicks
   * inside Settings made a daily job feel administrative.
   */
  test('the main nav offers Inventory and it opens', async ({ page }) => {
    const errors = errs(page);
    await page.goto('/screens/dashboard.html');

    await page.getByRole('link', { name: 'Inventory' }).click();
    await page.waitForURL('**/medication-inventory.html');

    /* It lands on the count sheet, and there is nothing to land on instead.
       The tab strip is gone: Inventory IS the count, and the lead slot carries
       the screen's name with the sheet's date under it rather than a choice of
       two documents. */
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
    await expect(page.getByTestId('cnt--heading')).toHaveText('Tuesday, August 4, 2026');
    await expect(page.getByTestId('cnt--table')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Inventory is the marked section, and Settings no longer carries it', async ({ page }) => {
    await openList(page);
    await expect(page.locator('.pt__nav-item--active')).toHaveText('Inventory');

    await page.goto('/screens/settings.html');
    await expect(page.locator('.ui-hub__grid')).not.toContainText('Medication Inventory');
  });

  /**
   * The Settings hub no longer carries a second "Low and out of stock" row —
   * it opened the same screen the row above it did, only pre-filtered, and the
   * status filter is right there on the screen. The deep link itself still
   * works, and is still worth keeping: it is what a bookmark or a link from a
   * reorder task points at.
   */
  test('a ?status= deep link arrives pre-filtered', async ({ page }) => {
    await page.goto('/screens/medication-inventory.html?status=low-stock');

    await openFilter(page, 'med--filter');
    await expect(filterPanel(page).locator(
      '[data-filter-name="status"][data-filter-value="low-stock"] input'
    )).toBeChecked();
    await doneFilter(page);
    for (const text of await listRows(page).allInnerTexts()) {
      expect(text).toContain('Low Stock');
    }
  });
});

/* ===================== The list ===================== */

test.describe('medication inventory — the list', () => {
  /**
   * Manufacturer, Lot Number and Expiry Date were columns here and are gone:
   * all three belong to a LOT, and a medication has several, so each column
   * had to pick one lot to speak for the shelf. Threshold replaces them —
   * it belongs to the medication, and it is what Available is measured
   * against.
   */
  test('carries the medication-level columns, and none that belong to a lot', async ({ page }) => {
    await openList(page);
    await expect(page.getByTestId('med--table').locator('thead th')).toHaveText([
      'Medication Name',
      'Medication Type',
      'Available Quantity',
      'Threshold',
      'Status',
      'Action',
    ]);
  });

  /** Low Stock is a claim; the two numbers beside it are what make it checkable. */
  test('Threshold sits next to the count it is compared against', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Amoxicillin');

    const row = listRows(page).first();
    await expect(row.locator('.med__qty').first()).toHaveText('45');
    await expect(row.locator('.med__qty--muted')).toHaveText('60');
    await expect(row).toContainText('Low Stock');
  });

  /**
   * One row per MEDICATION, not per lot. Paracetamol has three lots and must
   * appear once — otherwise the drill-down is a copy of the list.
   */
  test('a medication with several lots appears once', async ({ page }) => {
    await openList(page);
    await expect(rowFor(page, 'Paracetamol 500 mg Tablet')).toHaveCount(1);
  });

  /** The lots are on the medication's own page, where all of them fit. */
  test('the list names no lot at all', async ({ page }) => {
    await openList(page);
    await expect(rowFor(page, 'Paracetamol 500 mg Tablet')).not.toContainText('LOT-');
  });

  /**
   * The rule the whole screen exists for. Levothyroxine has 15 units on the
   * shelf in a lot that expired in May — so it has nothing available, and it
   * reads Expired rather than Out of Stock, because the two mean different
   * things to the person holding the box.
   */
  test('expired stock is not counted as available', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Levothyroxine');

    const row = listRows(page).first();
    await expect(row).toContainText('Expired');
    await expect(row.locator('.med__qty').first()).toHaveText('0');
  });

  /** An empty shelf and a shelf of expired boxes are not the same state. */
  test('a genuinely empty shelf reads Out of Stock, not Expired', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Salbutamol');

    const row = listRows(page).first();
    await expect(row).toContainText('Out of Stock');
    await expect(row).not.toContainText('Expired');
  });

  test('a total that excludes expired lots says so', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Paracetamol');
    // 102 + 84 usable; the expired 40 is left out and the row explains why.
    await expect(listRows(page).first().locator('.med__qty').first()).toHaveText('186');
    await expect(listRows(page).first()).toContainText('1 expired lot excluded');
  });

  /* A date alone makes the reader do the arithmetic, in the one place where
     getting it wrong means handing over an expired drug. Now on the lot table,
     which is where expiry lives since the list stopped naming one lot for the
     whole shelf. */
  test('expiry says how close it is, not just when', async ({ page }) => {
    await openDetail(page, 'Atorvastatin');
    await expect(lotRows(page).first()).toContainText(/in \d+ days/);
  });

  test('search finds a medication by a lot number on the box', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('LOT-VED-12');
    await expect(listRows(page)).toHaveCount(1);
    await expect(listRows(page).first()).toContainText('Vedolizumab');
  });

  test('the type filter narrows to that type only', async ({ page }) => {
    await openList(page);
    await openFilter(page, 'med--filter');
    await tickFilter(page, 'type', 'Biologic');
    await doneFilter(page);

    const rows = await listRows(page).allInnerTexts();
    expect(rows.length).toBeGreaterThan(0);
    for (const text of rows) expect(text).toContain('Biologic');
  });

  test('an impossible filter combination says so rather than showing nothing', async ({
    page,
  }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('zzzznothing');
    await expect(page.getByTestId('med--table')).toContainText('No medication matches');
  });
});

/* ===================== The detail ===================== */

test.describe('medication inventory — one medication', () => {
  test('the name opens its lots, and the URL can be shared', async ({ page }) => {
    await openDetail(page, 'Paracetamol');

    expect(page.url()).toContain('?med=med-pcm');
    await expect(page.getByTestId('med--fact-name')).toHaveText('Paracetamol 500 mg Tablet');
    await expect(page.getByTestId('med--fact-type')).toHaveText('Analgesic');
    await expect(page.getByTestId('med--lot-table').locator('thead th')).toHaveText([
      'Lot Number',
      'Manufacturer',
      'Added On',
      'Added by',
      'Available Quantity',
      'Wasted',
      'Expiry Date',
      'Status',
      'Action',
    ]);
  });

  test('?med= opens the medication directly', async ({ page }) => {
    await page.goto(`${LIST}?med=med-inf`);
    await expect(page.getByTestId('med--fact-name')).toHaveText('Infliximab 100 mg Vial');
  });

  /**
   * "Total Quantity: 12" means nothing until you know whether twelve is
   * plenty, so the reorder point is on the header beside it.
   */
  test('the header states the total and what it is judged against', async ({ page }) => {
    await openDetail(page, 'Paracetamol');
    await expect(page.getByTestId('med--fact-total')).toHaveText('186');
    await expect(page.getByTestId('med--fact-threshold')).toHaveText('100');
  });

  /** Otherwise the screen looks like it cannot add up. */
  test('a total smaller than the rows below it explains itself', async ({ page }) => {
    await openDetail(page, 'Paracetamol');
    await expect(page.getByTestId('med--detail-note')).toContainText(
      'counts usable stock only'
    );
  });

  test('lots are listed soonest-expiring first', async ({ page }) => {
    await openDetail(page, 'Paracetamol');
    const first = lotRows(page).first();
    // The expired one is the soonest date of all, and stays visible — it has
    // to be pulled off the shelf by someone.
    await expect(first).toContainText('LOT-PCM-19');
    await expect(first).toContainText('Expired');
  });

  /**
   * A lot is judged against what arrived in THAT box, never against the
   * medication's reorder point. Measured the other way a full 84-unit carton
   * of a drug reordered at 100 reads "Low Stock" while the medication above it
   * reads "In Stock", and the screen contradicts itself.
   */
  test('a full box is not called low just because the shelf is', async ({ page }) => {
    await openDetail(page, 'Paracetamol');
    const row = lotRows(page).filter({ hasText: 'LOT-PCM-31' });

    await expect(row).toContainText('84');
    await expect(row).toContainText('of 100 received');
    await expect(row).toContainText('In Stock');
  });

  test('back returns to the whole list', async ({ page }) => {
    await openDetail(page, 'Paracetamol');
    await page.getByTestId('med--detail-back').click();
    await expect(page.getByTestId('med--table')).toBeVisible();
    expect(page.url()).not.toContain('?med=');
  });
});

/* ===================== Add stock ===================== */

test.describe('medication inventory — adding stock', () => {
  /* "Add Medication" on the list adds one to the CATALOGUE now; booking in a
     box is "Add stock", from the row menu or the medication's own page. */
  /**
   * Every route into this dialog now names the medication first — the row menu
   * or the medication's own page — because "Add Medication" on the list adds
   * one to the catalogue instead. So the medication field is always shown
   * filled and locked, and there is no longer a way to open it blank.
   */
  async function openAddFor(page, name) {
    await openList(page);
    // Searched first: the catalogue runs to two pages, so a row further down
    // would not exist to click.
    await page.getByTestId('med--search').locator('input').fill(name);
    await listRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-add').click();
    await expect(page.locator('#stockModal')).toBeVisible();
  }

  const openAddFromList = (page) => openAddFor(page, 'Infliximab');

  test('the dialog asks the reference fields', async ({ page }) => {
    await openAddFromList(page);
    for (const id of ['med--f-medication', 'med--f-type', 'med--f-manufacturer',
      'med--f-vendor', 'med--f-lot', 'med--f-expiry', 'med--f-quantity']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  /**
   * Threshold was a field here and is gone. It is the reorder point for the
   * MEDICATION, not for the box being booked in, so every delivery was a
   * chance to reset it by accident — it lives on Edit medication now.
   */
  test('the dialog does not ask for the reorder point', async ({ page }) => {
    await openAddFromList(page);
    await expect(page.getByTestId('med--f-threshold')).toHaveCount(0);
  });

  /**
   * Typed, not picked. A delivery arrives from whoever packed it, and a closed
   * dropdown means the first manufacturer not on it cannot be booked in at all.
   */
  test('manufacturer is typed, with the usual names as suggestions', async ({ page }) => {
    await openAddFromList(page);
    const control = page.getByTestId('med--f-manufacturer').locator('input');

    await expect(control).toBeVisible();
    await expect(page.getByTestId('med--f-manufacturer').locator('select')).toHaveCount(0);
    // The common answers stay one keystroke away without being the only ones.
    await expect(control).toHaveAttribute('list', 'manufacturerList');

    await control.fill('A Manufacturer Not On Any List');
    await expect(control).toHaveValue('A Manufacturer Not On Any List');
  });

  /** Who it was bought FROM, which is often not who made it. */
  test('vendor is asked for and is optional', async ({ page }) => {
    await openAddFromList(page);
    await expect(page.getByTestId('med--f-vendor').locator('input')).toBeVisible();
    await expect(page.getByTestId('med--f-vendor')).not.toContainText('*');
  });

  /** The type is a property of the medication, so it follows and never differs. */
  test('choosing a medication fills the type', async ({ page }) => {
    await openAddFromList(page);

    await expect(page.getByTestId('med--f-type').locator('input')).toHaveValue('Biologic');
    await expect(page.getByTestId('med--f-type').locator('input')).toHaveAttribute('readonly', '');
  });

  /* Opened from a medication the choice is already made — shown, and locked,
     so the person typing a lot number can see what it is going against. */
  test('opened from a medication, the medication is filled and locked', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    await page.getByTestId('med--detail-add').click();

    const select = page.getByTestId('med--f-medication').locator('select');
    await expect(select).toHaveValue('med-pcm');
    await expect(select).toBeDisabled();
    await expect(page.getByTestId('med--f-type').locator('input')).toHaveValue('Analgesic');
  });

  test('every required field names itself', async ({ page }) => {
    await openAddFromList(page);
    await page.getByTestId('med--f-save').click();

    // Not the medication: it arrived filled and locked from the row menu.
    await expect(page.getByTestId('med--f-manufacturer')).toContainText('Enter who made it');
    await expect(page.getByTestId('med--f-lot')).toContainText('lot number');
    await expect(page.getByTestId('med--f-expiry')).toContainText('expiry');
    await expect(page.getByTestId('med--f-quantity')).toContainText('how many arrived');
  });

  /** Two rows sharing a lot number is two counts of one box. */
  test('a lot number already on file is refused', async ({ page }) => {
    await openAddFor(page, 'Paracetamol');
    await page.getByTestId('med--f-manufacturer').locator('input').fill('Cipla Ltd.');
    await page.getByTestId('med--f-lot').locator('input').fill('LOT-PCM-24');
    await page.getByTestId('med--f-expiry').locator('input').fill('2027-12-31');
    await page.getByTestId('med--f-quantity').locator('input').fill('50');
    await page.getByTestId('med--f-save').click();

    await expect(page.getByTestId('med--f-lot')).toContainText('already booked in');
  });

  /** Refused, not warned — this is how a shelf ends up holding dead stock. */
  test('stock that has already expired cannot be booked in', async ({ page }) => {
    await openAddFor(page, 'Paracetamol');
    await page.getByTestId('med--f-manufacturer').locator('input').fill('Cipla Ltd.');
    await page.getByTestId('med--f-lot').locator('input').fill('LOT-NEW-01');
    await page.getByTestId('med--f-expiry').locator('input').fill('2025-01-01');
    await page.getByTestId('med--f-quantity').locator('input').fill('50');
    await page.getByTestId('med--f-save').click();

    await expect(page.getByTestId('med--f-expiry')).toContainText('already passed');
  });

  test('a good delivery lands on the list and in the total', async ({ page }) => {
    const errors = errs(page);
    await page.goto(`${LIST}?med=med-ved`);
    await expect(page.getByTestId('med--fact-total')).toHaveText('5');

    await page.getByTestId('med--detail-add').click();
    await page.getByTestId('med--f-manufacturer').locator('input').fill('Takeda');
    await page.getByTestId('med--f-lot').locator('input').fill('LOT-VED-20');
    await page.getByTestId('med--f-expiry').locator('input').fill('2027-12-31');
    await page.getByTestId('med--f-quantity').locator('input').fill('18');
    await page.getByTestId('med--f-save').click();

    await expect(page.locator('#stockModal')).toBeHidden();
    await expect(lotRows(page).filter({ hasText: 'LOT-VED-20' })).toHaveCount(1);
    await expect(page.getByTestId('med--fact-total')).toHaveText('23');
    expect(errors).toEqual([]);
  });

  /**
   * Vedolizumab has 5 on the shelf and a reorder point of 6 — Low Stock. A
   * delivery has to clear it, or the badge is decoration.
   */
  test('a delivery clears the Low Stock badge', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Vedolizumab');
    await expect(listRows(page).first()).toContainText('Low Stock');

    await page.locator('.med__name').first().click();
    await page.getByTestId('med--detail-add').click();
    await page.getByTestId('med--f-manufacturer').locator('input').fill('Takeda');
    await page.getByTestId('med--f-lot').locator('input').fill('LOT-VED-21');
    await page.getByTestId('med--f-expiry').locator('input').fill('2027-12-31');
    await page.getByTestId('med--f-quantity').locator('input').fill('30');
    await page.getByTestId('med--f-save').click();

    await page.getByTestId('med--detail-back').click();
    await page.getByTestId('med--search').locator('input').fill('Vedolizumab');
    await expect(listRows(page).first()).toContainText('In Stock');
  });
});

/* ===================== Stock leaving ===================== */

test.describe('medication inventory — stock leaving the shelf', () => {
  /* Without this the only number that can ever change is the one going up,
     which is a delivery log rather than an inventory. */
  test('a lot can be adjusted down, and must say why', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    await page.getByTestId('med--fact-total').waitFor();

    await lotRows(page)
      .filter({ hasText: 'LOT-PCM-24' })
      .getByTestId('med--row-menu')
      .click();
    await page.getByTestId('med--menu-adjust').click();

    await page.getByTestId('med--adjust-quantity').locator('input').fill('60');
    await page.getByTestId('med--adjust-save').click();
    // Refused: no reason given.
    await expect(page.getByTestId('med--adjust-reason')).toContainText('why the count changed');

    await page
      .getByTestId('med--adjust-reason')
      .locator('select')
      .selectOption('Administered in clinic');
    await page.getByTestId('med--adjust-save').click();

    await expect(page.locator('#adjustModal')).toBeHidden();
    // 186 − 42 dispensed.
    await expect(page.getByTestId('med--fact-total')).toHaveText('144');
  });

  /**
   * "Remove lot" was on this menu and is gone. Deleting a booked-in lot erases
   * the count AND its waste log — the one record an audit reads — and a lot
   * that should not be used is Expired or adjusted to zero, both of which
   * leave the history intact.
   */
  test('a lot cannot be deleted out from under its own waste log', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    const before = await lotRows(page).count();

    await lotRows(page).first().getByTestId('med--row-menu').click();
    await expect(page.getByTestId('med--menu-remove')).toHaveCount(0);
    await expect(page.locator('#medRowMenu')).not.toContainText('Remove');

    await expect(lotRows(page)).toHaveCount(before);
  });
});

/* ===================== Waste ===================== */

/**
 * Waste is tracked apart from an ordinary adjustment because it is a different
 * kind of fact. A dispensed unit reached a patient; a wasted one did not, and
 * somebody has to account for it — so the count and the name are kept, not
 * just the subtraction.
 */
test.describe('medication inventory — waste', () => {
  const wasteRow = (page, lot) => lotRows(page).filter({ hasText: lot });

  async function openWaste(page, med, lot) {
    await page.goto(`${LIST}?med=${med}`);
    await wasteRow(page, lot).getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-waste').click();
    await expect(page.locator('#wasteModal')).toBeVisible();
  }

  test('the lot menu offers it alongside details and adjust', async ({ page }) => {
    await page.goto(`${LIST}?med=med-ins`);
    await lotRows(page).first().getByTestId('med--row-menu').click();

    await expect(page.locator('#medRowMenu [role="menuitem"]')).toHaveText([
      'Lot details',
      'Adjust quantity',
      'Record waste',
    ]);
  });

  /** The count, and whose name is against it. */
  test('the column shows how much was wasted and by whom', async ({ page }) => {
    await page.goto(`${LIST}?med=med-bud`);
    const row = lotRows(page).first();

    await expect(row.locator('.med__wasted')).toContainText('4');
    await expect(row.locator('.med__wasted')).toContainText('by Albert Flores');
  });

  /** More than one person on a lot is named as a count, not a list. */
  test('several people on one lot are counted rather than listed', async ({ page }) => {
    await page.goto(`${LIST}?med=med-ins`);
    await expect(lotRows(page).first().locator('.med__wasted')).toContainText('by 2 people');
  });

  test('a lot with nothing wasted shows a dash, not a zero', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    const row = wasteRow(page, 'LOT-PCM-31');
    await expect(row.locator('.med__wasted')).toHaveCount(0);
  });

  test('every field is required, and named', async ({ page }) => {
    await openWaste(page, 'med-pcm', 'LOT-PCM-24');

    // "Wasted by" opens pre-filled with whoever is at the machine, so it is
    // cleared here — the point is that a blank one is refused, not that the
    // dialog opens blank.
    await page.getByTestId('med--waste-by').locator('input').fill('');
    await page.getByTestId('med--waste-save').click();

    await expect(page.getByTestId('med--waste-quantity')).toContainText('how many units');
    await expect(page.getByTestId('med--waste-reason')).toContainText('what happened');
    await expect(page.getByTestId('med--waste-by')).toContainText('who wasted it');
  });

  /**
   * Both typed, not picked. The person who wasted a vial is often not a system
   * user — an agency nurse, a locum — and the useful reason is always the one
   * nobody thought to add to the list.
   */
  test('who and why are free text, with the usual answers as suggestions', async ({ page }) => {
    await openWaste(page, 'med-pcm', 'LOT-PCM-24');

    for (const [id, list] of [
      ['med--waste-by', 'wasteByList'],
      ['med--waste-reason', 'wasteReasonList'],
    ]) {
      await expect(page.getByTestId(id).locator('select')).toHaveCount(0);
      await expect(page.getByTestId(id).locator('input')).toHaveAttribute('list', list);
    }

    const reason = page.getByTestId('med--waste-reason').locator('input');
    await reason.fill('Dropped while drawing up — witnessed by two staff');
    await expect(reason).toHaveValue('Dropped while drawing up — witnessed by two staff');
  });

  /**
   * Refused. More wasted than the shelf holds is a typo or a count that was
   * already wrong, and writing it off would leave the lot negative — a number
   * that can never be reconciled.
   */
  test('more waste than there is stock is refused', async ({ page }) => {
    await openWaste(page, 'med-ins', 'LOT-INS-09');
    await page.getByTestId('med--waste-quantity').locator('input').fill('99');
    await page.getByTestId('med--waste-save').click();

    await expect(page.getByTestId('med--waste-quantity')).toContainText('Only 12 in stock');
    await expect(page.locator('#wasteModal')).toBeVisible();
  });

  /** So the same broken vial is not written off twice by two people. */
  test('the dialog shows what has already been written off this lot', async ({ page }) => {
    await openWaste(page, 'med-ins', 'LOT-INS-09');
    const history = page.getByTestId('med--waste-history');

    await expect(history).toBeVisible();
    await expect(history).toContainText('Cold-chain excursion');
    await expect(history).toContainText('Robert Fox');
    // Dated the way the tables date things, not as raw ISO.
    await expect(history).toContainText('2 Jun 2026');
  });

  test('recording waste takes it off the shelf and adds it to the log', async ({ page }) => {
    const errors = errs(page);
    await page.goto(`${LIST}?med=med-ins`);
    await expect(page.getByTestId('med--fact-total')).toHaveText('12');
    await expect(page.getByTestId('med--fact-wasted')).toHaveText('5');

    await lotRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-waste').click();
    await page.getByTestId('med--waste-quantity').locator('input').fill('2');
    await page.getByTestId('med--waste-reason').locator('input').fill('Spillage');
    await page.getByTestId('med--waste-by').locator('input').fill('Robert Fox');
    await page.getByTestId('med--waste-save').click();

    await expect(page.locator('#wasteModal')).toBeHidden();
    await expect(page.getByTestId('med--fact-total')).toHaveText('10');
    await expect(page.getByTestId('med--fact-wasted')).toHaveText('7');
    await expect(lotRows(page).first().locator('.med__wasted')).toContainText('7');
    expect(errors).toEqual([]);
  });

  /* A permanent "Wasted: 0" trains the eye to skip the chip, which is the one
     place it must not be skipped once the number stops being zero. */
  test('the wasted chip is absent when there is none', async ({ page }) => {
    await page.goto(`${LIST}?med=med-ctz`);
    await expect(page.getByTestId('med--fact-wasted')).toBeHidden();
  });

  /**
   * Damaged and Expired stock is waste, and used to be reachable from the
   * Adjust reason list as well. Two routes to one outcome is how half the
   * wastage ends up in a figure nobody is looking at.
   */
  test('Adjust no longer offers the reasons that are waste', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    await lotRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-adjust').click();

    const reasons = await page
      .getByTestId('med--adjust-reason')
      .locator('option')
      .allTextContents();
    expect(reasons).not.toContain('Damaged');
    expect(reasons).not.toContain('Expired — withdrawn');
    expect(reasons).toContain('Dispensed to patient');
  });
});

test.describe('medication inventory — accessibility', () => {
  test('the list has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openList(page);
    await expectNoA11yViolations(page);
  });

  test('the lot list has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(`${LIST}?med=med-pcm`);
    await expectNoA11yViolations(page);
  });

  test('the Add Stock dialog has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--add').click();
    await expectNoA11yViolations(page);
  });

  test('the waste dialog has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(`${LIST}?med=med-ins`);
    await lotRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-waste').click();
    await expectNoA11yViolations(page);
  });
});

/* ===================== Lot details =====================
   Everything recorded against one box, and the whole waste log rather than a
   total. Six wasted in one go is a dropped tray; six across four occasions is
   a process problem, and the single figure in the lot table cannot tell them
   apart. */

test.describe('medication inventory — lot details', () => {
  async function openLot(page, med, lot) {
    await page.goto(`${LIST}?med=${med}`);
    await lotRows(page).filter({ hasText: lot }).getByTestId('med--lot-link').click();
    await expect(page.locator('#lotModal')).toBeVisible();
  }

  test('the lot number opens it', async ({ page }) => {
    await openLot(page, 'med-ins', 'LOT-INS-09');
    await expect(page.getByTestId('med--lot-facts')).toContainText('LOT-INS-09');
  });

  test('the row menu offers it too', async ({ page }) => {
    await page.goto(`${LIST}?med=med-ins`);
    await lotRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-details').click();
    await expect(page.locator('#lotModal')).toBeVisible();
  });

  test('it carries what no column has room for', async ({ page }) => {
    await openLot(page, 'med-ins', 'LOT-INS-09');
    const facts = page.getByTestId('med--lot-facts');

    await expect(facts).toContainText('Novo Nordisk');
    await expect(facts).toContainText('Robert Fox');
    await expect(facts).toContainText('Vendor');
    // Received against available: 12 left of the 60 that arrived.
    await expect(facts).toContainText('60');
    await expect(facts).toContainText('12');
  });

  /** The point of the screen: each write-off separately, each with its date. */
  test('every waste entry is listed with its own date and author', async ({ page }) => {
    await openLot(page, 'med-ins', 'LOT-INS-09');
    const log = page.getByTestId('med--lot-waste');

    await expect(log).toContainText('5 units written off across 2 entries');

    await expect(log).toContainText('Cold-chain excursion');
    await expect(log).toContainText('Robert Fox');
    await expect(log).toContainText('2 Jun 2026');

    await expect(log).toContainText('Broken vial or container');
    await expect(log).toContainText('K. Brandt, RN');
    await expect(log).toContainText('14 Jul 2026');

    // Newest first — the last thing that happened is the thing being chased.
    await expect(log.locator('.med__history-row').first()).toContainText('14 Jul 2026');
  });

  test('a lot with a clean record says so rather than showing an empty list', async ({ page }) => {
    await openLot(page, 'med-pcm', 'LOT-PCM-31');
    await expect(page.getByTestId('med--lot-waste')).toContainText('Nothing has been written off');
  });

  /** Someone opening the log is usually about to add to it. */
  test('it leads straight into recording another', async ({ page }) => {
    await openLot(page, 'med-ins', 'LOT-INS-09');
    await page.getByTestId('med--lot-waste-add').click();

    await expect(page.locator('#lotModal')).toBeHidden();
    await expect(page.locator('#wasteModal')).toBeVisible();
    await expect(page.getByTestId('med--waste-lead')).toContainText('LOT-INS-09');
  });

  /** A new write-off has to reach the log, not just the count. */
  test('a recorded waste appears in the log with today against it', async ({ page }) => {
    await openLot(page, 'med-ins', 'LOT-INS-09');
    await page.getByTestId('med--lot-waste-add').click();

    await page.getByTestId('med--waste-quantity').locator('input').fill('1');
    await page.getByTestId('med--waste-reason').locator('input').fill('Dropped at the bench');
    await page.getByTestId('med--waste-by').locator('input').fill('A Locum Nurse');
    await page.getByTestId('med--waste-save').click();

    await lotRows(page).filter({ hasText: 'LOT-INS-09' }).getByTestId('med--lot-link').click();
    const log = page.getByTestId('med--lot-waste');

    await expect(log).toContainText('6 units written off across 3 entries');
    await expect(log).toContainText('Dropped at the bench');
    await expect(log).toContainText('A Locum Nurse');
  });
});

/* ===================== The medication itself ===================== */

test.describe('medication inventory — editing a medication', () => {
  async function openEdit(page, name) {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill(name);
    await listRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-edit').click();
    await expect(page.locator('#medicationModal')).toBeVisible();
  }

  test('the row menu offers it', async ({ page }) => {
    await openList(page);
    await listRows(page).first().getByTestId('med--row-menu').click();

    await expect(page.locator('#medRowMenu [role="menuitem"]')).toHaveText([
      'View lots',
      'Edit medication',
      'Add stock',
    ]);
  });

  test('it opens on what the medication already is', async ({ page }) => {
    await openEdit(page, 'Amoxicillin');

    await expect(page.getByTestId('med--m-name').locator('input')).toHaveValue(
      'Amoxicillin 250 mg Capsule'
    );
    await expect(page.getByTestId('med--m-type').locator('select')).toHaveValue('Antibiotic');
    await expect(page.getByTestId('med--m-threshold').locator('input')).toHaveValue('60');
  });

  /** The reorder point lives here now, and changing it moves the badge. */
  test('lowering the threshold clears Low Stock', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--search').locator('input').fill('Amoxicillin');
    await expect(listRows(page).first()).toContainText('Low Stock');

    await listRows(page).first().getByTestId('med--row-menu').click();
    await page.getByTestId('med--menu-edit').click();
    await page.getByTestId('med--m-threshold').locator('input').fill('20');
    await page.getByTestId('med--m-save').click();

    await expect(page.locator('#medicationModal')).toBeHidden();
    await expect(listRows(page).first()).toContainText('In Stock');
    await expect(listRows(page).first().locator('.med__qty--muted')).toHaveText('20');
  });

  test('a rename reaches the list', async ({ page }) => {
    await openEdit(page, 'Cetirizine');
    await page.getByTestId('med--m-name').locator('input').fill('Cetirizine 10 mg Tablet (generic)');
    await page.getByTestId('med--m-save').click();

    await expect(listRows(page).first()).toContainText('Cetirizine 10 mg Tablet (generic)');
  });

  /** Two names for one drug is two shelves for one drug. */
  test('a name already in the catalogue is refused', async ({ page }) => {
    await openEdit(page, 'Cetirizine');
    await page.getByTestId('med--m-name').locator('input').fill('Metformin 500 mg Tablet');
    await page.getByTestId('med--m-save').click();

    await expect(page.getByTestId('med--m-name')).toContainText('already in the catalogue');
    await expect(page.locator('#medicationModal')).toBeVisible();
  });

  /**
   * "Add Medication" adds one to the CATALOGUE — booking in a box is "Add
   * stock". A new medication has no lots yet, so it reads Out of Stock, which
   * is true.
   */
  test('Add Medication creates one, and it starts with no stock', async ({ page }) => {
    const errors = errs(page);
    await openList(page);
    await page.getByTestId('med--add').click();
    await expect(page.locator('#medicationModal')).toBeVisible();

    await page.getByTestId('med--m-name').locator('input').fill('Rifaximin 550 mg Tablet');
    await page.getByTestId('med--m-type').locator('select').selectOption('Analgesic');
    await page.getByTestId('med--m-threshold').locator('input').fill('30');
    await page.getByTestId('med--m-save').click();

    await expect(page.locator('#medicationModal')).toBeHidden();
    await page.getByTestId('med--search').locator('input').fill('Rifaximin');

    const row = listRows(page).first();
    await expect(row).toContainText('Rifaximin 550 mg Tablet');
    await expect(row).toContainText('Out of Stock');
    await expect(row.locator('.med__qty--muted')).toHaveText('30');
    expect(errors).toEqual([]);
  });

  test('a medication needs a name', async ({ page }) => {
    await openList(page);
    await page.getByTestId('med--add').click();
    await page.getByTestId('med--m-save').click();

    await expect(page.getByTestId('med--m-name')).toContainText('name');
    await expect(page.locator('#medicationModal')).toBeVisible();
  });
});

/* ===================== The daily count sheet ===================== */

/**
 * The report the client asked for: what came off the trolley, for whom, and
 * what was left.
 *
 * The tests that matter here are the reconciliation ones. Before this tab the
 * chart knew a dose had been given and the shelf had never heard of it — two
 * systems that happened to be about the same drugs. Now one is computed from
 * the other, so what has to be protected is that they cannot drift apart: the
 * last balance a medication reports must be the number Medication Management
 * shows for it, or the report is decorative.
 */
test.describe('inventory — the daily count sheet', () => {
  test('is the landing tab, and opens on today', async ({ page }) => {
    const errors = errs(page);
    await page.goto(LIST);

    /* ONE date, not a range. A count belongs to one drawer on one day: a sheet
       spanning two would report the sum of two reconciliations that were each
       meant to be answered on their own day. */
    await expect(page.getByTestId('cnt--date').locator('input')).toHaveValue(TODAY);
    await expect(page.getByTestId('use--from')).toHaveCount(0);
    await expect(page.getByTestId('use--to')).toHaveCount(0);

    /* The date is beside the screen's name, where the tab strip used to be,
       and the table below it carries no title band of its own — the day is
       stated once. */
    await expect(page.getByTestId('cnt--heading')).toHaveText('Tuesday, August 4, 2026');
    await expect(page.locator('#countTable')).not.toContainText('August');

    await expect(countRows(page).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  /**
   * Left to right IS the arithmetic: what was there, what went in, what went
   * out twice over, what that comes to, what is actually there, and the gap.
   * Reading the row is checking the sum, which is why nothing is reordered to
   * suit the widths.
   */
  test('the columns are the count, in the order it is made in', async ({ page }) => {
    await page.goto(LIST);

    await expect(page.locator('#countTable thead th')).toHaveText([
      'Medication',
      'Start count',
      'Added',
      'Given',
      'Wasted',
      'Expected end',
      'End count',
      'Discrepancy',
      'Actions',
    ]);
  });

  /**
   * THE ONE BUTTON THAT IS DELIBERATELY ABSENT.
   *
   * A control that drops a fixed list of drugs onto the sheet answers for a
   * drawer it has never seen — and a line nobody put there is a line nobody
   * counts, which is exactly the row a missing ampoule hides behind. What the
   * drawer holds goes on one drug at a time, by somebody looking at it.
   */
  test('there is no way to bulk-add a standard set of medications', async ({ page }) => {
    await page.goto(LIST);

    await expect(page.getByRole('button', { name: /standard meds/i })).toHaveCount(0);
    await expect(page.getByTestId('cnt--add')).toBeVisible();
  });

  /**
   * Added, Given and Wasted open at zero because zero is the truth about a
   * drug nobody has taken out of the drawer. Start and End open EMPTY, because
   * they are the two figures somebody has to physically count — a zero
   * pre-filled into either is a count nobody made, and the sheet cannot tell
   * it apart from one they did.
   */
  test('what moved opens at zero; what has to be counted opens empty', async ({ page }) => {
    await page.goto(LIST);

    /* Every seeded line carries a closing figure from the last count, so the
       one with genuinely nothing to carry is one just put on the sheet. */
    await page.getByTestId('cnt--add').click();
    await page.getByTestId('cnt--m-name').locator('input').fill('Naloxone');
    await page.getByTestId('cnt--m-unit').locator('select').selectOption('mg');
    await page.getByTestId('cnt--m-save').click();

    const line = countRows(page).filter({ hasText: 'Naloxone' });
    await expect(line.locator('[data-count-field="start"] input')).toHaveValue('');
    await expect(line.locator('[data-count-field="end"] input')).toHaveValue('');
    for (const key of ['added', 'given', 'wasted']) {
      await expect(line.locator(`[data-count-field="${key}"] input`)).toHaveValue('0');
    }
  });

  /** A stocked drawer that has been counted before is the ordinary case, so
   *  the sheet opens holding what the last count left rather than mostly
   *  blank — the blank line is the exception and should look like one. */
  test('the sheet opens on a drawer that has already been counted', async ({ page }) => {
    await page.goto(LIST);

    const starts = await countRows(page)
      .locator('[data-count-field="start"] input')
      .evaluateAll((els) => els.map((e) => e.value));

    expect(starts.length).toBeGreaterThan(0);
    for (const value of starts) expect(value).not.toBe('');
  });

  /**
   * Nothing on the sheet is pre-filled from the day's sedation records, and
   * that is the point of it. A count that opens holding the answer is a count
   * nobody makes, and a drawer that always agrees with itself is a drawer
   * nobody is really counting.
   */
  test('the day’s administrations do not fill the sheet in', async ({ page }) => {
    await page.goto(LIST);

    /* 4 August is a full list in the fixture — Propofol, Fentanyl and
       Midazolam all went out that day. Not one of those doses appears here. */
    for (const line of [0, 1, 6, 7]) {
      await expect(countBox(page, line, 'given')).toHaveValue('0');
    }
  });

  /**
   * THE SUM, AS IT READS RIGHT NOW.
   *
   * Redrawn per keystroke and in place — repainting the table would replace
   * the box being typed into and take the caret with it.
   */
  test('expected end is the arithmetic, live', async ({ page }) => {
    await page.goto(LIST);

    // The line opens on what the last count left, so that is what it expects.
    const start = await openingCount(page, 0);
    await expect(countSum(page, 0, 'expected')).toHaveText(String(start));

    await countBox(page, 0, 'added').fill('4');
    await expect(countSum(page, 0, 'expected')).toHaveText(String(start + 4));
    await countBox(page, 0, 'given').fill('2');
    await expect(countSum(page, 0, 'expected')).toHaveText(String(start + 2));
    await countBox(page, 0, 'wasted').fill('1');
    await expect(countSum(page, 0, 'expected')).toHaveText(String(start + 1));
  });

  /**
   * THE ONE LIE A CONTROLLED-DRUG SHEET MUST NOT TELL.
   *
   * A discrepancy of zero against a drawer nobody has counted would report
   * every untouched line as reconciled. Until an end count exists the column
   * says nothing at all.
   */
  test('an uncounted drawer reports no discrepancy, not a zero', async ({ page }) => {
    await page.goto(LIST);

    await expect(countSum(page, 0, 'difference')).toHaveText('—');

    await countBox(page, 0, 'end').fill(String(await openingCount(page, 0)));
    await expect(countSum(page, 0, 'difference')).toHaveText('0');
  });

  /** +1 in the drawer and −1 out of it are different problems, and only one of
   *  them is a drug that has gone missing. */
  test('a difference is signed', async ({ page }) => {
    await page.goto(LIST);

    const start = await openingCount(page, 0);

    await countBox(page, 0, 'end').fill(String(start + 2));
    await expect(countSum(page, 0, 'difference')).toHaveText('+2');

    await countBox(page, 0, 'end').fill(String(start - 1));
    await expect(countSum(page, 0, 'difference')).toHaveText('-1');
  });

  /**
   * A controlled drug given with nobody named against it, or destroyed with
   * nobody watching, is precisely the entry an ampoule that never reached a
   * patient hides behind. Both are refused, and the field that owes an answer
   * is the one that takes focus.
   */
  test('a dose given needs a name and wastage needs a witness', async ({ page }) => {
    await page.goto(LIST);

    await fileLine(page, 0, { given: 2, wasted: 1, end: 1 });
    await expect(lastToast(page)).toContainText('Name who gave');
    // The field that owes an answer takes focus, and here it is a dropdown.
    await expect(countPerson(page, 0, 'givenBy')).toBeFocused();

    await countPerson(page, 0, 'givenBy').selectOption(SOMEONE);
    await countRows(page).nth(0).locator('ui-button[data-save-row]').click();
    await expect(lastToast(page)).toContainText('needs a witness');
    await expect(countPerson(page, 0, 'witness')).toBeFocused();
  });

  /**
   * NAMED OFF A LIST, NOT TYPED.
   *
   * "K. Brandt", "K Brandt RN" and "Brandt" typed on three lines are three
   * people as far as any later reading of the sheet is concerned, and a
   * controlled-drug record whose names do not join up cannot be followed up.
   */
  test('the two names are picked from the practice’s roster', async ({ page }) => {
    await page.goto(LIST);

    for (const key of ['givenBy', 'witness']) {
      const field = countPerson(page, 0, key);
      await expect(field).toBeVisible();
      // No typed box hiding behind the dropdown.
      await expect(countBox(page, 0, key)).toHaveCount(0);
      expect((await field.locator('option').allTextContents()).length).toBeGreaterThan(1);
    }
  });

  /**
   * A NAME PICKED HAS TO SURVIVE THE REPAINT THAT FILING CAUSES.
   *
   * <ui-select> draws its own list and marks selected whichever option matches
   * its `value` — so a `selected` flag written onto an option by hand loses,
   * and the field came back reading "witness" while the row underneath still
   * held the name. The sheet said nobody watched and the record said somebody
   * did, which on this document is the disagreement that matters most.
   */
  test('a name picked is still shown after the line is filed', async ({ page }) => {
    await page.goto(LIST);

    await fileLine(page, 0, {
      given: 2, givenBy: SOMEONE, wasted: 1, witness: SOMEONE_ELSE, end: 1,
    });
    await expect(lastToast(page)).not.toContainText('needs a witness');

    await expect(countPerson(page, 0, 'givenBy')).toHaveValue(SOMEONE);
    await expect(countPerson(page, 0, 'witness')).toHaveValue(SOMEONE_ELSE);
  });

  /** A line cannot be filed against a start count nobody made, nor closed
   *  without the figure that closes it. */
  test('a line cannot be filed without both physical counts', async ({ page }) => {
    await page.goto(LIST);

    /* Emptied first: every seeded line now opens holding what the last count
       left, and the refusal being tested is about a start nobody has made. */
    await countBox(page, 1, 'start').fill('');
    await fileLine(page, 1, { end: 4 });
    await expect(lastToast(page)).toContainText('Count what was in the drawer');
    await expect(countBox(page, 1, 'start')).toBeFocused();

    await countBox(page, 1, 'start').fill('4');
    await countBox(page, 1, 'end').fill('');
    await countRows(page).nth(1).locator('ui-button[data-save-row]').click();
    await expect(lastToast(page)).toContainText('Count what is in the drawer now');
    await expect(countBox(page, 1, 'end')).toBeFocused();
  });

  /**
   * A filed line that does not reconcile is the one row on the sheet worth
   * stopping the eye on, and it stays flagged until it does.
   */
  test('a line that does not reconcile is filed, said and flagged', async ({ page }) => {
    await page.goto(LIST);

    await fileLine(page, 1, { start: 10, given: 0, end: 8 });

    await expect(lastToast(page)).toContainText('2 under the expected count');
    await expect(countRows(page).nth(1)).toHaveClass(/med__count-row--off/);
    await expect(page.getByTestId('cnt--status')).toContainText('does not reconcile');
  });

  /**
   * A sheet is worked by exception, so the figure that matters is said in
   * words rather than left to be counted down a column of small numbers — and
   * a day with nothing filed says that too. An empty sheet and a reconciled
   * one look identical from a distance, and only one of them is finished.
   */
  test('the sheet says how the day stands', async ({ page }) => {
    await page.goto(LIST);

    await expect(page.getByTestId('cnt--status')).toContainText('Nothing counted yet');

    await fileLine(page, 0, { end: await openingCount(page, 0) });
    await expect(lastToast(page)).toContainText('counted and reconciled');
    await expect(page.getByTestId('cnt--status')).toContainText('every one agrees');
  });

  /**
   * WHAT ONE DAY COUNTS OUT IS WHAT THE NEXT DAY IS HANDED.
   *
   * The date is not a filter over rows that exist regardless — it is which
   * sheet is on the desk, and every figure on it is fetched for that day,
   * carry-forwards and all. A sheet that opened blank would invite somebody to
   * write down what they see instead of what they were given.
   */
  test('the closing count is what the next sheet opens on', async ({ page }) => {
    await page.goto(LIST);

    const closing = (await openingCount(page, 0)) + 6;
    await fileLine(page, 0, { added: 6, end: closing });
    await expect(lastToast(page)).toContainText('counted and reconciled');

    await openSheet(page, '2026-08-05');
    await expect(page.getByTestId('cnt--heading')).toHaveText('Wednesday, August 5, 2026');
    await expect(countBox(page, 0, 'start')).toHaveValue(String(closing));

    /* Nothing says "Prior end: 7" while the box beside it says 7 — that would
       be the same number twice, three inches apart. It appears the moment the
       drawer is counted and found to hold something else, which is when the
       figure being disagreed with has to be legible. */
    await expect(countRows(page).nth(0)).not.toContainText('Prior end');
    await countBox(page, 0, 'start').fill(String(closing - 2));
    await expect(countRows(page).nth(0)).toContainText(`Prior end: ${closing}`);
  });

  /**
   * A drawer counted on Friday and not touched over the weekend is still
   * holding Friday's figure on Monday. The carry-forward is the last sheet
   * FILED, not the day before literally.
   */
  test('a day nobody counted does not break the carry-forward', async ({ page }) => {
    await page.goto(LIST);

    const closing = (await openingCount(page, 0)) + 2;
    await fileLine(page, 0, { added: 2, end: closing });
    await openSheet(page, '2026-08-10');

    await expect(countBox(page, 0, 'start')).toHaveValue(String(closing));
  });

  /** Flipping to another day to check a figure must not throw away half a
   *  typed sheet. Only Save commits a line; nothing else discards one. */
  test('an unfiled sheet survives a look at another day', async ({ page }) => {
    await page.goto(LIST);

    await countBox(page, 2, 'start').fill('12');
    await countBox(page, 2, 'given').fill('3');

    await openSheet(page, '2026-08-03');
    await openSheet(page, TODAY);

    await expect(countBox(page, 2, 'start')).toHaveValue('12');
    await expect(countBox(page, 2, 'given')).toHaveValue('3');
  });

  /**
   * Two vials of Versed are two lines by design, so the clash that matters is
   * the same drug at the same STRENGTH — one drawer counted twice, with a
   * discrepancy split across two rows that each look fine.
   */
  test('a medication is added by name and strength, and cannot be added twice', async ({ page }) => {
    await page.goto(LIST);
    const before = await countRows(page).count();

    await page.getByTestId('cnt--add').click();
    await page.getByTestId('cnt--m-name').locator('input').fill('Midazolam (Versed)');
    await page.getByTestId('cnt--m-strength').locator('input').fill('2 mg/2 mL');
    await page.getByTestId('cnt--m-unit').locator('select').selectOption('mg');
    await page.getByTestId('cnt--m-save').click();
    await expect(page.getByTestId('cnt--m-name')).toHaveAttribute('error', /already counted/);

    // The same drug at a strength the drawer does not hold yet is a new line.
    await page.getByTestId('cnt--m-strength').locator('input').fill('5 mg/5 mL');
    await page.getByTestId('cnt--m-save').click();

    await expect(countRows(page)).toHaveCount(before + 1);
    await expect(countRows(page)).toContainText(['5 mg/5 mL · mg']);
  });

  /** A new line was never counted OUT of this drawer, so it has nothing to
   *  carry in — the opening figure is one somebody has to go and read. */
  test('a medication just added starts with no count, not a zero', async ({ page }) => {
    await page.goto(LIST);

    await page.getByTestId('cnt--add').click();
    await page.getByTestId('cnt--m-name').locator('input').fill('Naloxone');
    await page.getByTestId('cnt--m-unit').locator('select').selectOption('mg');
    await page.getByTestId('cnt--m-save').click();

    const line = countRows(page).filter({ hasText: 'Naloxone' });
    await expect(line.locator('[data-count-field="start"] input')).toHaveValue('');
    await expect(line).not.toContainText('Prior end');
  });

  /** Adding a line must not cost the reader the figures already on the sheet. */
  test('adding a medication keeps what has been typed', async ({ page }) => {
    await page.goto(LIST);
    await countBox(page, 0, 'end').fill('9');

    await page.getByTestId('cnt--add').click();
    await page.getByTestId('cnt--m-name').locator('input').fill('Naloxone');
    await page.getByTestId('cnt--m-unit').locator('select').selectOption('mg');
    await page.getByTestId('cnt--m-save').click();

    await expect(countBox(page, 0, 'end')).toHaveValue('9');
  });

  /**
   * The same rule the lot list keeps for a box with a waste log. A filed count
   * is a signed reconciliation of a controlled drawer, and removing the line it
   * was filed against would delete the record with nothing left saying it
   * existed. A drug that is no longer stocked is counted to zero instead.
   */
  test('a counted line cannot be taken off the sheet', async ({ page }) => {
    await page.goto(LIST);
    const before = await countRows(page).count();

    // Untouched: it comes off, with a confirm in the way.
    await countRows(page).nth(2).locator('[data-remove-row]').click();
    await page.getByTestId('cnt--remove-confirm').click();
    await expect(countRows(page)).toHaveCount(before - 1);

    // Counted: refused outright rather than confirmed.
    await fileLine(page, 0, { end: await openingCount(page, 0) });
    await countRows(page).nth(0).locator('[data-remove-row]').click();
    await expect(lastToast(page)).toContainText('cannot be taken off the sheet');
    await expect(page.getByTestId('cnt--remove-lead')).toBeHidden();
    await expect(countRows(page)).toHaveCount(before - 1);
  });

  /** The register is a different document about the same drugs. It has no
   *  button on this screen any more, and the deep links that always reached it
   *  still do — a reorder task's link must not have been broken by the strip
   *  coming off. */
  test('the register is still reachable by deep link, and intact', async ({ page }) => {
    await openList(page);

    await expect(page.getByTestId('med--table').locator('thead th')).toContainText([
      'Medication Name',
    ]);
    await expect(listRows(page).first()).toBeVisible();
  });

  test('no axe violations', async ({ page }) => {
    await page.goto(LIST);
    await expect(countRows(page).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('the add dialog has no axe violations', async ({ page }) => {
    await page.goto(LIST);
    await page.getByTestId('cnt--add').click();
    await expect(page.getByTestId('cnt--m-name')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
