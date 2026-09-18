/**
 * Patient directory — one filtered list (status is a filter and a column, not
 * a tab pair), insurance state, search and pagination.
 * Figma reference for the MediNova styling: tests/figma-refs/patient-screen.png
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
  heightOf,
} from '../helpers/page-helpers.js';
import {
  openFilter,
  tickFilter,
  clearFilter,
  filterPanel,
  filterOptions,
  filterCount,
} from '../helpers/filter.js';

const SCREEN = '/screens/patient-directory.html';

test.describe('patient directory', () => {
  /**
   * No tabs: the list opens unfiltered. A directory that silently hides ten
   * patients is how someone concludes a record does not exist.
   */
  test('loads every patient, with no tabs and no filter applied', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCREEN);

    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(
      page.getByTestId('directory--table').locator('tbody tr')
    ).toHaveCount(15);
    await expect(page.getByTestId('directory--range')).toContainText('1-15 of 36 rows');
    expect(await filterCount(page, 'directory--filter')).toBe(0);

    assertClean();
  });

  /* --- Filters ------------------------------------------------------------- */

  test('the filter button opens a panel and closes on Escape', async ({ page }) => {
    await page.goto(SCREEN);

    await expect(filterPanel(page)).toHaveCount(0);
    await openFilter(page, 'directory--filter');
    await expect(filterPanel(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(filterPanel(page)).toHaveCount(0);
  });

  test('filtering by name narrows the list', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await openFilter(page, 'directory--filter');
    await page.getByTestId('filter--name').locator('input').fill('Solberg');

    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody tr')).toContainText('Ingrid Solberg');
  });

  test('filtering by date of birth finds the exact match', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await openFilter(page, 'directory--filter');
    // Two patients share 26-03-1974 — Maya Johnson and Naomi Samuelson.
    await page.getByTestId('filter--dob').locator('input').fill('1974-03-26');

    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table).toContainText('Maya Johnson');
    await expect(table).toContainText('Naomi Samuelson');
  });

  /** Status is a filter now, not a tab. */
  test('the status filter replaces the Active / Inactive tabs', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await openFilter(page, 'directory--filter');
    await tickFilter(page, 'status', 'Inactive');

    await expect(page.getByTestId('directory--range')).toContainText('1-10 of 10 rows');
    await expect(table.locator('tbody tr')).toHaveCount(10);

    /* Every question holds a SET, so Active is added to Inactive rather than
       replacing it — ticking both is the whole list back. */
    await tickFilter(page, 'status', 'Inactive');
    await tickFilter(page, 'status', 'Active');
    await expect(page.getByTestId('directory--range')).toContainText('1-15 of 26 rows');
  });

  test('filters combine, and the badge counts how many are on', async ({ page }) => {
    await page.goto(SCREEN);

    await openFilter(page, 'directory--filter');
    await tickFilter(page, 'status', 'Active');
    expect(await filterCount(page, 'directory--filter')).toBe(1);

    await tickFilter(page, 'coverage', 'Not contracted');
    expect(await filterCount(page, 'directory--filter')).toBe(2);

    // Four patients are on an uncontracted plan; only two of them are active.
    const table = page.getByTestId('directory--table');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table).toContainText('Natali Craig');
    await expect(table).toContainText('Maya Johnson');
  });

  /* Clear empties the typed fields as well as the ticks — the badge counts
     both, so a Clear that left the name box full would leave it reading 1. */
  test('Clear resets every filter, typed ones included', async ({ page }) => {
    await page.goto(SCREEN);
    await openFilter(page, 'directory--filter');
    await page.getByTestId('filter--name').locator('input').fill('Solberg');
    await tickFilter(page, 'status', 'Inactive');
    expect(await filterCount(page, 'directory--filter')).toBe(2);

    await clearFilter(page);

    expect(await filterCount(page, 'directory--filter')).toBe(0);
    await expect(page.getByTestId('directory--range')).toContainText('1-15 of 36 rows');
    await expect(page.getByTestId('filter--name').locator('input')).toHaveValue('');
  });

  /** The carrier list is built from the data, never hand-maintained. */
  test('the carrier filter offers only carriers that exist', async ({ page }) => {
    await page.goto(SCREEN);
    await openFilter(page, 'directory--filter');

    const options = await filterOptions(page, 'carrier');
    expect(options).toContain('Prairie Mutual');
    expect(options).not.toContain('Aetna');
  });

  test('a status column shows what the tabs used to', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await expect(table.locator('thead')).toContainText('Status');

    // Status is the last column — MRN, Name, DOB, Contact, Last Appt,
    // Insurance, Status.
    const row = table.locator('tbody tr').filter({ hasText: 'Henna West' });
    await expect(row.locator('td')).toHaveCount(7);
    await expect(row.locator('td').nth(6)).toContainText('Active');
  });

  /**
   * Patient Portal is a filter, not a column: "who still needs a portal
   * invite" is a worklist question, not something to read on every row.
   */
  test('patient portal is filterable but not a column', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await expect(table.locator('thead')).not.toContainText('Patient Portal');

    await openFilter(page, 'directory--filter');
    await tickFilter(page, 'portal', 'Pending');

    expect(await filterCount(page, 'directory--filter')).toBe(1);
    // Nine patients are mid-invite.
    await expect(page.getByTestId('directory--range')).toContainText('1-9 of 9 rows');
  });

  test('the table scrolls inside itself, keeping headers and footer in place', async ({
    page,
  }) => {
    await page.goto(SCREEN);

    // The page itself must not scroll — only the table region does.
    const pageScrolls = await page.evaluate(
      () => document.body.scrollHeight > window.innerHeight + 1
    );
    expect(pageScrolls, 'the window should not scroll').toBe(false);

    const wrap = page.locator('.ui-table-wrap');
    const overflows = await wrap.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflows, 'the table region should overflow and scroll').toBe(true);

    // Column headers are sticky, so they survive a scroll.
    await wrap.evaluate((el) => el.scrollTo(0, 300));
    await expect(page.getByTestId('directory--table').locator('thead th').first()).toBeInViewport();
    await expect(page.getByTestId('directory--range')).toBeInViewport();
  });

  /**
   * The list carries insurance, not clinical tags: a directory answers "who
   * is this and can we bill them", and both facts come off the Add Patient
   * Insurance tab.
   */
  test('the insurance column names the carrier and its coverage state', async ({
    page,
  }) => {
    await page.goto(SCREEN);
    // Unfiltered, the list runs to three pages — search rather than assume
    // which page a given patient lands on.
    await page.getByTestId('directory--search').locator('input').fill('Marcus Adeyemi');

    const row = page
      .getByTestId('directory--table')
      .locator('tbody tr')
      .filter({ hasText: 'Marcus Adeyemi' });

    await expect(row.locator('.pt__carrier')).toHaveText('Northern Plains Health Plan');
    await expect(row.locator('ui-badge').first()).toHaveText('Active');
  });

  /** An uncontracted plan is the one that stops a booking, so it reads red. */
  test('an uncontracted plan is called out', async ({ page }) => {
    await page.goto(SCREEN);
    const row = page
      .getByTestId('directory--table')
      .locator('tbody tr')
      .filter({ hasText: 'Natali Craig' });

    await expect(row.locator('.pt__carrier')).toHaveText('Summit Bridge PPO');
    await expect(row.getByText('Not contracted')).toBeVisible();
  });

  /** Self-pay has no carrier, so the state carries the whole cell. */
  test('a self-pay patient shows no carrier', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('directory--search').locator('input').fill('Liam Rodriguez');

    const row = page
      .getByTestId('directory--table')
      .locator('tbody tr')
      .filter({ hasText: 'Liam Rodriguez' });

    await expect(row.locator('.pt__carrier')).toHaveCount(0);
    await expect(row.getByText('Self-pay')).toBeVisible();
  });

  test('search narrows the list', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    await page.getByTestId('directory--search').locator('input').fill('Henna');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody tr')).toContainText('Henna West');

    // MRN works too.
    await page.getByTestId('directory--search').locator('input').fill('326474');
    await expect(table.locator('tbody tr')).toContainText('Andi Lane');
  });

  test('pagination moves between pages', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');

    // 36 patients at 15 per page = three pages.
    await expect(page.locator('.ui-pager__page--current')).toHaveText('1');
    await expect(table.locator('tbody tr')).toHaveCount(15);
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.ui-pager__page--current')).toHaveText('2');
    await expect(page.getByTestId('directory--range')).toContainText('16-30 of 36 rows');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.ui-pager__page--current')).toHaveText('3');
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.locator('.ui-pager__page--current')).toHaveText('2');
  });

  test('rows per page repaints and resets to page one', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('directory--rows-per-page').selectOption('50');
    await expect(
      page.getByTestId('directory--table').locator('tbody tr')
    ).toHaveCount(36);
    await expect(page.getByTestId('directory--range')).toContainText('1-36 of 36 rows');
  });

  test('sorting by MRN reorders the list', async ({ page }) => {
    await page.goto(SCREEN);
    const table = page.getByTestId('directory--table');
    await table.locator('[data-sort-key="mrn"]').click();
    // 245638 is the lowest MRN in the directory.
    await expect(table.locator('tbody tr').first()).toContainText('245638');
  });

  test('matches MediNova geometry — 34px controls, 44px rows', async ({ page }) => {
    await page.goto(SCREEN);

    const addButton = page.getByTestId('directory--add').locator('button');
    expect(Math.round(await heightOf(addButton)), 'New Patient button').toBe(34);

    const row = page.getByTestId('directory--table').locator('tbody tr').first();
    expect(Math.round(await heightOf(row)), 'table body row').toBe(44);
  });

  // The product primary is EHR green, an explicit override of MediNova's
  // oxblood BrandPrimary/07-Main. See the [OVERRIDE] note in tokens.css.
  test('primary action uses the EHR green brand', async ({ page }) => {
    await page.goto(SCREEN);
    const bg = await page
      .getByTestId('directory--add')
      .locator('button')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(9, 112, 0)'); // #097000
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(SCREEN);
    await expectNoA11yViolations(page);
  });

  const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet', width: 1024, height: 900 },
  ];

  for (const vp of VIEWPORTS) {
    test(`visual — directory @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(SCREEN);
      await expect(page.getByTestId('directory--table')).toBeVisible();
      await expect(page).toHaveScreenshot(`directory-${vp.name}.png`);
    });
  }
});
