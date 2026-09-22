/**
 * Reports — the parameter sheet.
 *
 * A report is not opened, it is RUN: the period and the business in the
 * header, and behind the Filters button the sheet the practice's own report
 * asks for — providers, sites, codes, a bill type, a grouping, and the tick
 * boxes it ends with. No two of the twelve ask the same thing.
 *
 * So most of what is tested here is the SHEET FOLLOWING THE REPORT, and the
 * four kinds of answer doing four different things: narrowing, regrouping,
 * reshaping the columns, and — in one case — nothing at all to the table.
 * That is the part that would rot silently as reports are added.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';
import {
  openFilter,
  pickFilter,
  typeFilter,
  switchFilter,
  filterGroups,
  filterCount,
  clearFilter,
  doneFilter,
} from '../helpers/filter.js';

const at = (id) => `/screens/reports.html?report=${id}`;
const rows = (page) => page.locator('.ui-table tbody tr');
const headings = (page) => page.locator('#repHead th');
const totals = (page) => page.locator('[data-testid="report--totals"]');

/* SHOUTY on purpose: the panel uppercases its question headings in CSS, and
   the helper reads rendered text. Comparing against title case would pass
   only until somebody looked at it. */

test.describe('the sheet is the report’s own', () => {
  test('the year-end report asks what the year-end report asks', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(at('eoy-ar'));
    await openFilter(page, 'report--filter');

    expect(await filterGroups(page)).toEqual([
      'PERFORMING PROVIDERS',
      'BILLING PROVIDERS',
      'LOCATION',
      'CPT CODE(S)',
      'REPORT BY',
      'BILL TYPE',
      'GROUP BY',
    ]);

    assertClean();
  });

  /**
   * Two questions and three switches: the reference sheet's own pair —
   * "primary insurance only" and "show patient details" — plus the favourite
   * every sheet ends with. The favourite is not this report's; it is on all
   * twelve, which is asserted where that claim belongs, further down.
   */
  test('a different report asks a different sheet', async ({ page }) => {
    await page.goto(at('patient-by-carrier'));
    await openFilter(page, 'report--filter');

    expect(await filterGroups(page)).toEqual(['CARRIER', 'PAYER GROUP']);
    await expect(page.locator('#ui-filter-panel ui-checkbox')).toHaveCount(3);
  });

  /**
   * The one thing that must never be asked: a question with a row per record.
   * MRN, the patient's name and the two timestamps are on the cancellation
   * report's columns and deliberately not on its sheet — a list of four
   * hundred MRNs is the table again, whichever control it is drawn in.
   */
  test('per-record fields are not parameters', async ({ page }) => {
    await page.goto(at('cancellations'));
    await openFilter(page, 'report--filter');

    const groups = await filterGroups(page);
    for (const never of ['MRN', 'PATIENT / PHONE', 'APPT DATE/TIME', 'CANCEL DATE/TIME']) {
      expect(groups).not.toContain(never);
    }
  });

  test('switching report replaces the sheet and drops the old answers', async ({ page }) => {
    await page.goto(at('eoy-ar'));
    await openFilter(page, 'report--filter');
    await pickFilter(page, 'location', 'GastroEMR Gastroenterology ASC');
    await doneFilter(page);
    await expect(rows(page)).toHaveCount(1);

    await page.getByTestId('report--rail-patient-by-carrier').click();
    await openFilter(page, 'report--filter');

    expect(await filterGroups(page)).toEqual(['CARRIER', 'PAYER GROUP']);
    // A Location answer is not one this report asked for.
    expect(await filterCount(page, 'report--filter')).toBe(0);
  });

  /**
   * THE ANSWERS ARE THE VOCABULARY, NOT WHAT TURNED UP. The sheet is declared
   * with the report, so stepping the period cannot take an answer away — the
   * old filter, which read its options off the records on screen, would drop
   * a provider who happened not to work that month and quietly widen the run.
   */
  test('an answer survives a change of period', async ({ page }) => {
    await page.goto(at('cancellations'));
    await openFilter(page, 'report--filter');
    await pickFilter(page, 'provider', 'Chidi Okafor, MD');
    await doneFilter(page);
    expect(await filterCount(page, 'report--filter')).toBe(1);

    await page.getByTestId('report--period').locator('select').selectOption('Week');
    await expect(page.getByTestId('report--nav-week')).toBeVisible();

    expect(await filterCount(page, 'report--filter')).toBe(1);
  });
});

test.describe('an answer that narrows', () => {
  test('one site leaves one row, and the tiles follow it', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(at('eoy-ar'));
    expect(await rows(page).count()).toBeGreaterThan(1);
    const whole = await totals(page).textContent();

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'location', 'GastroEMR Gastroenterology ASC');
    await doneFilter(page);

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('GastroEMR Gastroenterology ASC');

    /* THE TOTALS LINE IS THE ANSWER TO THE SHEET. It is not the whole
       practice's figure any more, because the report was not run for the whole
       practice — which is the difference between a parameter and a filter. */
    expect(await totals(page).textContent()).not.toBe(whole);

    assertClean();
  });

  test('a summary report narrows by something that is not its dimension', async ({ page }) => {
    await page.goto(at('eoy-ar'));
    const whole = await totals(page).textContent();

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'performing', 'Amara Mensah, MD');
    await doneFilter(page);

    // Still a table of locations; less money in it.
    await expect(headings(page).first()).toHaveText('Location');
    expect(await totals(page).textContent()).not.toBe(whole);
  });

  test('a detail report narrows on a record field', async ({ page }) => {
    await page.goto(at('cancellations'));
    const before = await rows(page).count();
    expect(before).toBeGreaterThan(1);

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'cancelledBy', 'Front desk');
    await doneFilter(page);

    await expect(rows(page).first()).toContainText('Front desk');
    expect(await rows(page).count()).toBeLessThanOrEqual(before);
  });

  test('a date parameter is a range of its own, not the period', async ({ page }) => {
    await page.goto(at('payment-analysis'));
    const before = await page.locator('#repFoot').textContent();

    await openFilter(page, 'report--filter');
    await typeFilter(page, 'dosFrom', '2099-01-01');
    await doneFilter(page);

    // Nothing was ever performed in 2099, and the report says so rather than
    // showing the payments it could not narrow.
    await expect(page.getByTestId('report--empty')).toBeVisible();
    expect(before).not.toBe(await page.locator('#repFoot').textContent());
  });

  test('clearing puts the whole report back', async ({ page }) => {
    await page.goto(at('eoy-ar'));
    const before = await rows(page).count();

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'location', 'GastroEMR Gastroenterology ASC');
    await doneFilter(page);
    await expect(rows(page)).toHaveCount(1);

    await openFilter(page, 'report--filter');
    await clearFilter(page);
    await doneFilter(page);

    await expect(rows(page)).toHaveCount(before);
  });
});

test.describe('an answer that regroups', () => {
  /**
   * The same facts, added up a different way. Every summary fact carries a
   * draw of each facet the report offers, so Group By is a different key into
   * the same figures rather than a different report.
   */
  test('Group By changes what a row is', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(at('eoy-ar'));
    await expect(headings(page).first()).toHaveText('Location');
    const whole = await totals(page).textContent();

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'groupBy', 'Provider');
    await doneFilter(page);

    await expect(headings(page).first()).toHaveText('Provider');
    await expect(rows(page).first()).toContainText(', MD');
    /* Regrouping is not narrowing: the money is the same money. */
    expect(await totals(page).textContent()).toBe(whole);

    assertClean();
  });

  test('a grouped detail report is a table of groups', async ({ page }) => {
    await page.goto(at('dpgi-tb'));
    await expect(headings(page).first()).toHaveText('Code');
    const lines = await page.locator('#repFoot').textContent();

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'groupBy', 'Location');
    await doneFilter(page);

    await expect(headings(page).first()).toHaveText('Location');
    await expect(headings(page).nth(1)).toHaveText('Lines');
    await expect(page.locator('#repFoot')).toContainText('groups');
    expect(lines).not.toBe(await page.locator('#repFoot').textContent());
  });

  /** And "Show grouping details" is the way back to the lines under them. */
  test('grouping details opens a grouped table back up', async ({ page }) => {
    await page.goto(at('dpgi-tb'));
    await openFilter(page, 'report--filter');
    await pickFilter(page, 'groupBy', 'Location');
    await expect(page.locator('#repFoot')).toContainText('groups');

    await switchFilter(page, 'Show Grouping Details');
    await doneFilter(page);

    await expect(page.locator('#repFoot')).toContainText('lines');
    await expect(headings(page).first()).toHaveText('Code');
  });
});

test.describe('an answer that reshapes', () => {
  test('show patient details brings two columns with it', async ({ page }) => {
    await page.goto(at('dpgi-tb'));
    await expect(headings(page).filter({ hasText: 'MRN' })).toHaveCount(0);

    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Show Patient Details');
    await doneFilter(page);

    await expect(headings(page).filter({ hasText: 'Patient' })).toHaveCount(1);
    await expect(headings(page).filter({ hasText: 'MRN' })).toHaveCount(1);
  });

  /**
   * A single-gender run puts away the columns that are not about it — both of
   * the other gender's, and the one comparing the two, which under one gender
   * is the column beside it again under a heading that says otherwise.
   */
  test('a gender narrows the adenoma report to its own columns', async ({ page }) => {
    await page.goto(at('adr'));
    await expect(headings(page)).toHaveCount(8);

    await openFilter(page, 'report--filter');
    await pickFilter(page, 'gender', 'Male');
    await doneFilter(page);

    expect(await headings(page).allTextContents()).toEqual([
      'Provider',
      'Male Denominator',
      'Male Numerator',
      'Male ADR Percentage',
    ]);
  });

  test('primary insurance only counts fewer people', async ({ page }) => {
    await page.goto(at('patient-by-carrier'));
    const everyone = await totals(page).textContent();

    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Primary Insurance Only');
    await doneFilter(page);

    expect(await totals(page).textContent()).not.toBe(everyone);
  });

  /**
   * A slot given back and taken again is not a slot the practice lost, so a
   * rescheduled appointment is out of the report until the box asks for it.
   * The only parameter here whose default state changes the total.
   */
  test('show rescheduled lets a class of record back in', async ({ page }) => {
    await page.goto(at('cancellations'));
    const without = await rows(page).count();

    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Show Rescheduled');
    await doneFilter(page);

    await expect(page.locator('#repFoot')).toContainText('cancellations');
    expect(await page.locator('.rep__stat-value').first().textContent()).not.toBe('—');
    expect(await rows(page).count()).toBeGreaterThanOrEqual(without);
  });
});

test.describe('the two questions that are not on any sheet', () => {
  test('the business narrows every report from the header', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(at('eoy-ar'));
    expect(await rows(page).count()).toBeGreaterThan(1);

    await page.getByTestId('report--business').locator('select')
      .selectOption('GastroEMR Gastroenterology ASC');

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('GastroEMR Gastroenterology ASC');

    assertClean();
  });

  /** It is the same question on all twelve, so it survives the rail. */
  test('the business stays answered as the reader moves down the rail', async ({ page }) => {
    await page.goto(at('eoy-ar'));
    await page.getByTestId('report--business').locator('select')
      .selectOption('GastroEMR Gastroenterology ASC');

    await page.getByTestId('report--rail-dpgi-tb').click();

    await expect(page.getByTestId('report--business').locator('select'))
      .toHaveValue('GastroEMR Gastroenterology ASC');
  });
});

test.describe('the parameter that is not a parameter', () => {
  /**
   * "Add to my favourites" narrows nothing. It stars the report on the rail,
   * and it is deliberately kept out of the count on the button — a badge
   * reading 1 over a panel that is showing everything is precisely what the
   * badge exists to prevent.
   */
  test('the favourite switch stars the rail and does not count', async ({ page }) => {
    await page.goto(at('eoy-ar'));
    const star = page.locator('[data-testid="report--rail-eoy-ar"] [data-star]');
    await expect(star).toBeHidden();

    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Add To My Favorite');
    await doneFilter(page);

    await expect(star).toBeVisible();
    expect(await filterCount(page, 'report--filter')).toBe(0);

    /* And it belongs to the report rather than to the run: it is still starred
       after a visit to another one. */
    await page.getByTestId('report--rail-rrm').click();
    await expect(star).toBeVisible();
  });

  /**
   * EVERY sheet ends with it, and that is the whole claim — so it is asserted
   * over the whole catalogue rather than on the one report somebody happened
   * to build it for first. It went in as a loop in data/reports.js for the
   * same reason: written out twelve times it is twelve chances to forget, and
   * that is exactly how it went the first time round.
   *
   * Last, always. It is the one control on the sheet that acts on the report
   * rather than on what the report contains, and the reference panels put it
   * under a rule at the bottom for that reason.
   */
  const EVERY_REPORT = [
    'eoy-ar', 'dpgi-tb', 'patient-by-carrier', 'payment-analysis', 'posted-procedures',
    'productivity', 'rrm', 'rrm-procedures', 'cancellations', 'adr', 'asc-09', 'cahps',
  ];

  /* Read as whole GROUPS rather than as question headings: a tick box has no
     uppercase heading over it, so filterGroups() — which reads the headings —
     cannot see this one at all. */
  const groupTexts = (page) =>
    page.locator('#ui-filter-panel .ui-filter-group').allInnerTexts();

  for (const id of EVERY_REPORT) {
    test(`${id} ends its sheet with the favourite`, async ({ page }) => {
      await page.goto(at(id));
      await openFilter(page, 'report--filter');

      const groups = await groupTexts(page);
      expect(groups.filter((g) => /Add To My Favorite/i.test(g))).toHaveLength(1);
      expect(groups[groups.length - 1]).toMatch(/Add To My Favorite/i);
    });
  }

  /* Ticking it stars whichever report is open — not the one it was built on. */
  test('the switch stars the report it was ticked on', async ({ page }) => {
    await page.goto(at('cahps'));
    const star = page.locator('[data-testid="report--rail-cahps"] [data-star]');
    await expect(star).toBeHidden();

    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Add To My Favorite');
    await doneFilter(page);

    await expect(star).toBeVisible();
    expect(await filterCount(page, 'report--filter')).toBe(0);

    // And it comes back off.
    await openFilter(page, 'report--filter');
    await switchFilter(page, 'Add To My Favorite');
    await doneFilter(page);
    await expect(star).toBeHidden();
  });
});
