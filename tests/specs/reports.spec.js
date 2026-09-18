/**
 * REPORTS — the twelve the practice asks for by name.
 *
 * One screen renders all twelve (js/lib/report-screen.js) from one catalogue
 * (data/reports.js), so these tests are deliberately about the things a shared
 * renderer can get wrong for every report at once: does the period actually
 * change what is counted, is a rate worked out from the totals rather than
 * averaged, is a balance read as of a date instead of added up, and does a
 * range with nothing in it say so.
 *
 * Reports is a destination, not a hub. There is no landing page and no back
 * arrow — clicking Reports in the top nav opens the first report of the pack,
 * and the rail down the left is how the other eleven are reached.
 *
 * The Time report has its own spec — it is a timesheet, not a report over
 * counts, and it is opened from the clock in the header. See
 * time-reports.spec.js.
 *
 * Dates are computed from "today" rather than hard-coded: the catalogue
 * generates facts relative to the day the screen opens, so a fixed date would
 * pass this month and fail next.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const URL = '/screens/reports.html';

/** Every cell of the totals line, as text. */
const totals = (page) =>
  page.getByTestId('report--totals').locator('th, td').allInnerTexts();

/** The printout's own header — the one place the range is written in words. */
const printed = (page) => page.locator('[data-print-meta]');

const number = (text) => Number(text.replace(/[^0-9.]/g, ''));

/** The <select> inside <ui-select> is what the component listens to. */
async function setPeriod(page, value) {
  await page.getByTestId('report--period').locator('select').selectOption(value);
}

/** A custom range, given as two ISO dates. */
async function setCustomRange(page, from, to) {
  await setPeriod(page, 'Custom range');
  await page.getByTestId('report--from').locator('input').fill(from);
  await page.getByTestId('report--to').locator('input').fill(to);
  await page.getByTestId('report--to').locator('input').blur();
}

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

test.describe('the report screen', () => {
  test('Reports in the top nav opens a report, not a menu', async ({ page }) => {
    await page.goto('/screens/patient-directory.html');
    await page.getByRole('link', { name: 'Reports', exact: true }).click();

    await expect(page).toHaveURL(/reports\.html/);
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
    // Straight onto the first of the pack — no hub, and nothing to click through.
    await expect(page.getByTestId('report--title')).toHaveText('End of year AR');
    await expect(page.getByTestId('report--table')).toBeVisible();
  });

  test('there is no way back, because there is nowhere to go back to', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('.ui-page-head__back')).toHaveCount(0);
  });

  test('the rail carries every report in the pack', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(URL);

    // Twelve, not "as many as fit" — the reason the rail exists.
    await expect(page.getByTestId('report--rail').locator('button')).toHaveCount(12);
    await expect(page.getByTestId('report--rail-dpgi-tb')).toContainText('DPGI TB');
    await expect(page.getByTestId('report--rail-asc-09')).toContainText('ASC-09');

    expect(await page.locator('.rep__stat').count()).toBeGreaterThan(2);
    expect((await totals(page))[0]).toBe('Total');
    assertClean();
  });

  test('the rail is a fifth of the width, and the table scrolls inside it', async ({ page }) => {
    await page.goto(`${URL}?report=productivity`);

    const railWidth = await page.locator('.rep__rail').evaluate((el) => el.clientWidth);
    const bodyWidth = await page.locator('.rep__body--rail').evaluate((el) => el.clientWidth);
    expect(railWidth / bodyWidth).toBeGreaterThan(0.17);
    expect(railWidth / bodyWidth).toBeLessThan(0.23);

    // A ten-column report is the case the layout has to survive: the table
    // scrolls inside its own wrap rather than pushing the page sideways.
    const pageScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(pageScroll).toBeLessThanOrEqual(1);
  });

  /**
   * BOTH COLUMNS REACH THE BOTTOM OF THE WINDOW. On a six-row report they used
   * to be as tall as they needed to be, which left a short card at the top
   * left and a short table beside it with the rest of the page empty — a
   * layout that reads as a page which failed to finish loading.
   */
  test('the rail and the table both run the full height', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${URL}?report=eoy-ar`); // six rows: the short case

    const bottom = (selector) =>
      page.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().bottom));

    /* Measured against the body's CONTENT box: its border box runs a gutter
       lower, and a column that reached that would be sitting on the window's
       edge with the page's own margin underneath it. */
    const bodyBottom = await page
      .locator('.rep__body--rail')
      .evaluate(
        (el) =>
          Math.round(el.getBoundingClientRect().bottom) -
          parseFloat(getComputedStyle(el).paddingBottom)
      );

    expect(Math.abs((await bottom('.rep__rail')) - bodyBottom)).toBeLessThanOrEqual(1);
    expect(Math.abs((await bottom('.rep__detail')) - bodyBottom)).toBeLessThanOrEqual(1);

    // And the page itself does not scroll — the table scrolls inside its card.
    const bodyScroll = await page
      .locator('.rep__body--rail')
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(bodyScroll).toBe(0);
  });

  /**
   * FOUR RANKS OF INK, worked out from what each column declares itself to be
   * rather than listed anywhere — so a column added to the catalogue is
   * coloured right by saying what it is. Posted Procedures carries all four:
   * a CPT code, a wRVU the row simply holds, counts and amounts, and a share
   * derived from them.
   */
  test('the table is ranked: label, reference, working, answer', async ({ page }) => {
    await page.goto(`${URL}?report=patient-by-carrier`);

    /* Columns are found by their HEADING, not by their position. This test
       has been broken twice by a column being inserted to the left of the one
       it was really about, which taught it nothing about ranking and cost a
       run each time. */
    const headings = (await page.locator('#repHead th').allInnerTexts()).map((h) => h.trim());
    const row = page.locator('#repRows tr').first();
    const classOf = (heading) => {
      const index = headings.indexOf(heading);
      expect(index, `column "${heading}" is on this report`).toBeGreaterThanOrEqual(0);
      return row.locator('td').nth(index).getAttribute('class');
    };

    expect(await classOf('Carrier')).toContain('rep__cell--label'); // what the row IS
    expect(await classOf('Address')).toContain('rep__cell--attr'); // carried, not measured
    expect(await classOf('Patients')).toContain('rep__cell--metric'); // counted
    expect(await classOf('%')).toContain('rep__cell--derived'); // worked out

    // Every figure is a figure; none of the word columns is.
    expect(await classOf('Patients')).toContain('ui-table__cell--numeric');
    expect(await classOf('Carrier')).not.toContain('ui-table__cell--numeric');
    expect(await classOf('Address')).not.toContain('ui-table__cell--numeric');

    // The address is the one cell in this product allowed a second line.
    expect(await classOf('Address')).toContain('rep__cell--stack');

    /* A zero steps back wherever it lands. Most cells on most of these reports
       are zero, and a zero set as loudly as a figure turns four numbers into a
       column of nine. */
    await page.goto(`${URL}?report=eoy-ar`);
    const zero = page.locator('#repRows td.rep__cell--nil').first();
    await expect(zero).toHaveText(/^(0|—|\$0)$/);
  });

  /**
   * A DETAIL REPORT'S ROW IS A RECORD, not a bucket. Three of the twelve are
   * that shape — a payment, a charge line, a cancelled appointment — and what
   * ranks them is different: the money on the line is the figure and
   * everything else on it, name and MRN and code and site, identifies it.
   */
  test('a detail report puts one row per record on the page', async ({ page }) => {
    await page.goto(`${URL}?report=payment-analysis`);

    // Far more rows than any dimension has members, so the pager does real work.
    await expect(page.getByTestId('report-rows--range')).toContainText('payments');
    const rows = page.locator('#repRows tr');
    expect(await rows.count()).toBe(25);

    const classOf = (n) => rows.first().locator('td').nth(n).getAttribute('class');
    expect(await classOf(1)).toContain('rep__cell--attr'); // the patient
    expect(await classOf(12)).toContain('rep__cell--metric'); // the amount

    /* Only the money is totalled. A column of MRNs has no sum and a column of
       dates has no average, so those cells on the totals line stay empty. */
    const totals = await page.getByTestId('report--totals').locator('th, td').allInnerTexts();
    expect(totals[0]).toBe('Total');
    expect(totals[2]).toBe(''); // MRN
    expect(totals[12]).toMatch(/^\$[\d,]+$/); // Amount
  });

  /**
   * ONE COLUMN SET, THREE SAVED REPORTS.
   *
   * DPGI TB, RRM and RRM Procedures are the same template in the practice
   * management system, saved three times with different parameters. They offer
   * the same seventeen columns in the same order, and the whole reason a
   * reader recognises them is that "Chgs %" means the same thing on all three
   * — so the set is declared once and shared, and this is what says so.
   */
  test('the three code reports carry one column set, in one order', async ({ page }) => {
    const EXPECTED = [
      'Code', 'Modifiers', 'WRVU', 'Description', 'Serv', 'Units', 'Total WRVU',
      'Service of Date', 'Charges', 'Chgs %', 'Payments', 'Pmnt %', 'Adjustments',
      'Refunds', 'NET A/R', 'Billing Provider', 'Location',
    ];

    for (const id of ['dpgi-tb', 'rrm', 'rrm-procedures']) {
      await page.goto(`${URL}?report=${id}`);
      const headings = await page.locator('#repHead th').allInnerTexts();
      expect(headings.map((h) => h.trim()), id).toEqual(EXPECTED);
    }
  });

  /**
   * What separates them is the codes under the columns, not the columns.
   * RRM Procedures is saved with an explicit list of endoscopy and pathology
   * codes; the other two carry the clinic as well.
   */
  test('RRM Procedures is the procedure codes alone', async ({ page }) => {
    const codesOn = async (id) => {
      await page.goto(`${URL}?report=${id}`);
      await page.getByTestId('report-rows--rows-per-page').selectOption('50');
      const rows = await page.locator('#repRows tr').all();
      return new Set(await Promise.all(rows.map((r) => r.locator('td').first().innerText())));
    };

    const procedures = await codesOn('rrm-procedures');
    const everything = await codesOn('dpgi-tb');

    // An office visit is a code the practice bills and not a procedure.
    expect([...everything].some((code) => code.startsWith('99'))).toBe(true);
    expect([...procedures].some((code) => code.startsWith('99'))).toBe(false);
  });

  /**
   * A patient's MRN belongs to the patient. Generating it per row gave the
   * same person a different number every time they appeared, which made
   * "Patients" on a report of four hundred payments count four hundred.
   */
  test('the same patient carries the same MRN on every row', async ({ page }) => {
    await page.goto(`${URL}?report=payment-analysis`);

    const seen = new Map();
    for (const row of await page.locator('#repRows tr').all()) {
      const cells = await row.locator('td').allInnerTexts();
      const [patient, mrn] = [cells[1], cells[2]];
      if (seen.has(patient)) expect(seen.get(patient)).toBe(mrn);
      seen.set(patient, mrn);
    }
    // The page has to actually repeat somebody for the check to mean anything.
    expect(seen.size).toBeLessThan(25);
  });

  /**
   * A SECOND HEADER ROW, for the reports whose columns come in families. The
   * year-end view prints four money columns for the month and the same four
   * for the year; without a span above them the reader has eight identical
   * headings and no way to tell which half is which.
   */
  test('columns that come in families are spanned and labelled', async ({ page }) => {
    await page.goto(`${URL}?report=eoy-ar`);

    const groups = page.getByTestId('report--groups');
    await expect(groups).toBeVisible();
    await expect(groups).toContainText('Month To Date');
    await expect(groups).toContainText('Year To Date');

    // The spans have to add up to the columns, or every heading after the
    // first family sits over the wrong column.
    const spans = await groups.locator('th').evaluateAll((cells) =>
      cells.reduce((total, cell) => total + cell.colSpan, 0)
    );
    expect(spans).toBe(await page.locator('#repHead th').count());

    // And the ten reports with no families do not draw the row at all.
    await page.getByTestId('report--rail-rrm').click();
    await expect(groups).toBeHidden();
  });

  /* The title alone. The sentence under it was written for a reader arriving
     from a hub of sixteen titles; the rail names the report, the heading names
     it again, and the column headings say what every figure is. */
  test('the report is named once, with no sentence under it', async ({ page }) => {
    await page.goto(URL);

    await expect(page.getByTestId('report--title')).toHaveText('End of year AR');
    await expect(page.locator('#repBlurb')).toHaveCount(0);
    await expect(page.locator('.rep__detail-head')).toHaveText('End of year AR');
  });

  /* One word between the two actions: Export is what was asked for and what
     leaves the building, Print is the utility beside it. Two equally weighted
     buttons gave the row two focal points and no answer to which was the
     point of it. */
  test('the header keeps one labelled action and one icon beside it', async ({ page }) => {
    await page.goto(URL);

    await expect(page.getByTestId('report--export')).toContainText('Export CSV');

    const print = page.getByTestId('report--print').locator('button');
    await expect(print).toHaveClass(/ui-btn--icon-only/);
    // Icon-only, but never nameless.
    await expect(print).toHaveAccessibleName('Print');

    // A rule sorts the two that set the report from the two that act on it.
    await expect(page.locator('.rep__actions-rule')).toBeVisible();
  });

  test('a report opened by URL is the one the rail marks', async ({ page }) => {
    await page.goto(`${URL}?report=cancellations`);

    await expect(page.getByTestId('report--title')).toHaveText('Appointment Cancellation Report');
    await expect(page.getByTestId('report--rail-cancellations')).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  /* A link to a report that has since been renamed, or an address with no
     report on it at all, opens the pack rather than an error. */
  test('an unknown report in the address falls back to the first', async ({ page }) => {
    await page.goto(`${URL}?report=no-such-report`);
    await expect(page.getByTestId('report--title')).toHaveText('End of year AR');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(URL);
    await expectNoA11yViolations(page);
  });
});

test.describe('switching report', () => {
  test('the rail changes the table, the address bar and its own mark', async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByTestId('report--title')).toHaveText('End of year AR');

    await page.getByTestId('report--rail-rrm-procedures').click();

    await expect(page.getByTestId('report--title')).toHaveText('RRM Procedures');
    await expect(page).toHaveURL(/report=rrm-procedures/);
    await expect(page.locator('#repHead th').first()).toHaveText('Code');
    await expect(page.getByTestId('report--rail-rrm-procedures')).toHaveAttribute(
      'aria-current',
      'true'
    );
    await expect(page.getByTestId('report--rail-eoy-ar')).not.toHaveAttribute('aria-current', /.*/);

    // Reloading that address opens the same report — the link is the report.
    await page.reload();
    await expect(page.getByTestId('report--title')).toHaveText('RRM Procedures');
  });

  /**
   * A report whose feed is still being configured has to say so where the
   * reading starts, not in a footnote under the table. CAHPS is the case
   * today; the marker is declared on the report, not written into the screen.
   */
  test('a report that is not wired up yet says so above its own table', async ({ page }) => {
    await page.goto(`${URL}?report=cahps`);

    await expect(page.getByTestId('report--pending')).toBeVisible();
    await expect(page.getByTestId('report--pending')).toContainText('Under configuration');
    // And on the rail, so the reader knows before they click rather than after.
    await expect(page.getByTestId('report--rail-cahps')).toContainText('Setup');

    // Every other report in the pack is silent.
    await page.getByTestId('report--rail-rrm').click();
    await expect(page.getByTestId('report--pending')).toBeHidden();
  });
});

test.describe('the period navigator', () => {
  test('the printed range names the dates, and says when it stops at today', async ({ page }) => {
    await page.goto(`${URL}?report=productivity`);
    await setPeriod(page, 'Month');

    // A month in progress is not a whole month, and the label admits it.
    await expect(printed(page)).toContainText('(to date)');
  });

  test('moving to an earlier week changes the range and the figures with it', async ({ page }) => {
    await page.goto(`${URL}?report=productivity`);
    await setPeriod(page, 'Week');

    const before = await totals(page);
    const label = await printed(page).textContent();

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const field = page.getByTestId('report--nav-week').locator('input');
    await field.fill(lastWeek.toISOString().slice(0, 10));
    await field.dispatchEvent('change');

    await expect(printed(page)).not.toHaveText(label);
    // A whole week past is a whole week, so the label drops the qualifier.
    await expect(printed(page)).not.toContainText('(to date)');
    expect(await totals(page)).not.toEqual(before);
  });

  test('a custom range that runs backwards is corrected, not left empty', async ({ page }) => {
    await page.goto(`${URL}?report=productivity`);
    await setCustomRange(page, '2026-07-01', '2026-06-01');

    // The end is pulled up to the start rather than reporting a negative span.
    await expect(printed(page)).toContainText('1 Jul 2026 — 1 Jul 2026');
    // And the field the reader is looking at follows the correction.
    await expect(page.getByTestId('report--to').locator('input')).toHaveValue('2026-07-01');
  });

  /**
   * A range with no clinic days in it. The table goes away entirely rather
   * than showing a grid of zeros, which reads as "nobody worked" instead of
   * "nothing has happened yet".
   */
  test('a range in the future says there is nothing to report', async ({ page }) => {
    await page.goto(`${URL}?report=productivity`);

    const nextYear = new Date().getFullYear() + 1;
    await setCustomRange(page, `${nextYear}-01-04`, `${nextYear}-01-08`);

    await expect(page.getByTestId('report--empty')).toBeVisible();
    await expect(page.getByTestId('report--table')).toBeHidden();
    await expect(page.locator('.rep__stat-value').first()).toHaveText('—');
  });
});

test.describe('the arithmetic', () => {
  /**
   * THE RULE THE WHOLE CATALOGUE RESTS ON: metrics add up, rates are worked
   * out once from what added up. A percentage averaged across days weights a
   * Friday half-clinic the same as a full Tuesday, and the totals line would
   * then disagree with the tile above it.
   */
  test('a rate on the totals line is computed from the totals', async ({ page }) => {
    await page.goto(`${URL}?report=adr`);

    const cells = await totals(page);
    // Provider, Male den, Male num, Male ADR, Female den, Female num, Female
    // ADR, All genders ADR.
    const maleDenominator = number(cells[1]);
    const maleNumerator = number(cells[2]);
    const maleAdr = number(cells[3]);

    // The cell is rounded to one decimal, so agree to within half a point.
    expect(maleAdr).toBeCloseTo((maleNumerator / maleDenominator) * 100, 0);

    /* And the tile says the same thing as the line. Matched on the exact
       label, not a substring: "Female ADR" contains "male ADR". */
    await expect(
      page.locator('.rep__stat', { has: page.getByText('Male ADR', { exact: true }) })
    ).toContainText(cells[3]);
  });

  /**
   * THE ALL-GENDERS RATE IS NOT THE AVERAGE OF THE TWO RATES. It is the two
   * numerators over the two denominators, worked out once — and the two are
   * only the same number when the practice screened exactly as many men as
   * women, which it never does. Averaging the percentages would let a provider
   * with nine male exams and one female exam report the female rate at half
   * the weight of the whole.
   */
  test('the blended rate comes from the counts, not from the two rates', async ({ page }) => {
    await page.goto(`${URL}?report=adr`);

    for (const row of await page.locator('#repRows tr').all()) {
      const cells = (await row.locator('td').allInnerTexts()).map(number);
      const [, maleDen, maleNum, , femaleDen, femaleNum, , all] = cells;

      expect(all).toBeCloseTo(((maleNum + femaleNum) / (maleDen + femaleDen)) * 100, 0);
    }
  });

  /**
   * A subset can never exceed the set it came out of. The catalogue expresses
   * that with `of`, so a charge captured is a share of the encounters that
   * day rather than an independent figure that can overtake them.
   */
  test('a subset never exceeds the set it came from', async ({ page }) => {
    await page.goto(`${URL}?report=asc-09`);

    // By heading, so inserting a column cannot silently re-point the test.
    const headings = (await page.locator('#repHead th').allInnerTexts()).map((h) => h.trim());
    const at = (cells, heading) => number(cells[headings.indexOf(heading)]);

    for (const row of await page.locator('#repRows tr').all()) {
      const cells = await row.locator('td').allInnerTexts();

      const denominator = at(cells, 'Denominator');
      const numerator = at(cells, 'Numerator');
      const exclusions = at(cells, 'Number of exclusions');
      const percentage = at(cells, 'Percentage');

      // Both are counts of cases drawn from the denominator's own population.
      expect(numerator).toBeLessThanOrEqual(denominator);
      expect(exclusions).toBeLessThanOrEqual(denominator);

      /* And the percentage is the two of them divided, not a third figure
         generated beside them — which is the whole reason a measure is
         reported as numerator, denominator and rate rather than as a rate. */
      const expected = denominator ? (numerator / denominator) * 100 : 0;
      expect(percentage).toBeCloseTo(expected, 1);
    }
  });

  /**
   * End of year AR is a BALANCE. Weekly snapshots across a quarter are
   * photographs of the same debt, not a quarter's worth of separate debts —
   * so widening the period moves the as-of date rather than multiplying the
   * money.
   */
  test('a balance is read as of a date, not added up', async ({ page }) => {
    await page.goto(`${URL}?report=eoy-ar`);

    // Both ranges are long enough to contain several weekly snapshots, so
    // neither depends on which weekday the suite happens to run on.
    await setCustomRange(page, isoDaysAgo(60), isoDaysAgo(0));
    const twoMonths = number((await totals(page))[6]);

    await setCustomRange(page, isoDaysAgo(180), isoDaysAgo(0));
    const sixMonths = number((await totals(page))[6]);

    // Tripling the window would triple the debt if the snapshots were summed.
    expect(sixMonths).toBeLessThan(twoMonths * 2);
  });

  /**
   * CADENCE IS NOT THE SAME QUESTION AS SNAPSHOT. Both of these are recorded
   * once a week. The year-end AR is a balance and is stated AS OF a date;
   * CAHPS is a flow — a fortnight of surveys really is two weeks of surveys
   * added together — and stamping it "as of" the last Friday would be the
   * header contradicting the total under it.
   *
   * The distinction is invisible on screen and deliberately so: the caveat was
   * a line beside the period picker that appeared for two reports out of
   * twelve, making the control row change shape as the reader moved down the
   * rail. It survives on the printout, where there is no picker to look at,
   * and that is what these read.
   */
  test('a weekly balance names its date on paper and a weekly flow names its range', async ({
    page,
  }) => {
    await page.goto(`${URL}?report=patient-by-carrier`);
    await setCustomRange(page, isoDaysAgo(60), isoDaysAgo(0));
    await expect(printed(page)).toContainText('As of');

    await page.getByTestId('report--rail-cahps').click();
    await expect(printed(page)).not.toContainText('As of');
    // A range, not a day: two dates with a dash between them.
    await expect(printed(page)).toContainText('—');
  });

  /**
   * YEAR TO DATE IS A SECOND AGGREGATION, not the month scaled up.
   *
   * The year-end report puts a month beside the year it sits in. There is no
   * arithmetic that gets from one to the other — a January of a hundred cases
   * says nothing about February — so the facts are built again from the first
   * of the year. Which means the year column can never be smaller than the
   * month inside it, and on any range short of a whole year it is larger.
   */
  test('the year-to-date columns are a wider window, not a multiplied one', async ({ page }) => {
    await page.goto(`${URL}?report=eoy-ar`);
    await setPeriod(page, 'Month');

    const cells = await totals(page);
    // Location, Serv, MTD ×4, YTD ×4, A/R open, A/R close.
    const monthCharges = number(cells[2]);
    const yearCharges = number(cells[6]);

    expect(yearCharges).toBeGreaterThan(monthCharges);
    // A month is one of twelve, so a year of them is not two of them.
    expect(yearCharges).toBeGreaterThan(monthCharges * 2);
  });

  /**
   * THE TWO A/R COLUMNS ARE THE SAME METRIC READ TWO WAYS — the balance on the
   * first day in range and the balance on the last. Aggregation as a property
   * of the metric alone could not express that: whichever column was declared
   * first would win and the other would silently repeat it.
   */
  test('the opening and closing A/R are different balances', async ({ page }) => {
    await page.goto(`${URL}?report=eoy-ar`);
    await setPeriod(page, 'Month');

    const cells = await totals(page);
    expect(number(cells[10])).not.toBe(number(cells[11]));

    // And each heading says which day it was read on.
    const headings = await page.locator('#repHead th').allInnerTexts();
    expect(headings[10]).toMatch(/^A\/R as of \d/);
    expect(headings[11]).toMatch(/^A\/R as of \d/);
    expect(headings[10]).not.toBe(headings[11]);
  });

  /**
   * Quality measures are read against their own benchmark, and each measure
   * runs at the level that measure runs at. A single generated range across
   * every endoscopist would put adenoma detection somewhere it has no business
   * being — a finding on a real report, not a fixture. The society sets it at
   * 30% for men and 20% for women, so the blended figure belongs between.
   */
  test('adenoma detection lands near its benchmark', async ({ page }) => {
    await page.goto(`${URL}?report=adr`);

    const cells = await totals(page);
    const adr = number(cells[7]); // All Genders ADR Percentage
    expect(adr).toBeGreaterThan(20);
    expect(adr).toBeLessThan(50);
  });
});

test.describe('taking it away', () => {
  test('Export CSV writes the report on screen, named for it', async ({ page }) => {
    await page.goto(`${URL}?report=posted-procedures`);

    const download = page.waitForEvent('download');
    await page.getByTestId('report--export').click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(
      /^report-posted-procedures-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
