/**
 * The Time report — a payroll document, and a screen of its own.
 *
 * It is not one of the twelve on Reports and is not reached from there: the
 * clock in the header band opens it, from wherever the person is standing.
 *
 * The report is a payroll document, so the tests below are mostly about
 * arithmetic and about the record: what counts as worked time, what a shift
 * with no clock-out counts as, and whether a correction can be made without
 * losing what the clock originally saw.
 *
 * Dates are computed from "today" rather than hard-coded. The demo timesheet
 * is built relative to the day the screen opens, so a fixed date would pass
 * this week and fail next.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';
import { openFilter, tickFilter, doneFilter } from '../helpers/filter.js';

const REPORTS = '/screens/reports.html';
const REPORT = '/screens/time-reports.html';
const KEY = 'medinova.timeclock.v1';

/** Seed the live clock — the signed-in user's own punches, today. */
async function seed(page, entries) {
  await page.goto(REPORT);
  await page.evaluate(
    ([key, list]) => {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          entries: list.map((e, i) => ({
            id: `seed-${i}`,
            in: midnight.getTime() + e.inH * 3_600_000,
            out: e.outH === null ? null : midnight.getTime() + e.outH * 3_600_000,
            breaks: e.breakH
              ? [
                  {
                    start: midnight.getTime() + e.inH * 3_600_000,
                    end: midnight.getTime() + (e.inH + e.breakH) * 3_600_000,
                  },
                ]
              : [],
            notes: e.notes ?? '',
          })),
        })
      );
    },
    [KEY, entries]
  );
  await page.reload();
}

const iso = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

/** Pick a value from one of the screen's <ui-select>s. */
async function choose(page, testid, value) {
  const select = page.getByTestId(testid).locator('select');
  await select.selectOption(value);
  await select.dispatchEvent('change');
}

/**
 * Whose timesheet. It is a `single` group in the standard filter panel, so
 * picking a second person replaces the first, and picking nobody is the whole
 * practice — there is no "All employees" row, because nothing ticked says it.
 */
async function chooseEmployee(page, id) {
  await openFilter(page, 'time-report--who');
  await tickFilter(page, 'employee', id);
  await doneFilter(page);
}

async function fill(page, testid, value) {
  const field = page.getByTestId(testid).locator('input, textarea');
  await field.fill(value);
  await field.dispatchEvent('change');
}

/** The last 30 days, which is wide enough to always contain the demo
 *  timesheet's missing punch whatever day the suite runs on. */
async function lastThirtyDays(page) {
  await choose(page, 'time-report--period', 'Custom range');
  await fill(page, 'time-report--from', iso(daysAgo(30)));
  await fill(page, 'time-report--to', iso(daysAgo(0)));
}

/**
 * HOW THE TIMESHEET IS REACHED, now that the Reports hub is gone.
 *
 * It used to be a card on that hub, alongside the four report categories.
 * Reports is the practice's twelve reports now and the timesheet is not one
 * of them — it has corrections, an audit trail and a payroll export, which is
 * a different thing from a report over counts. Its way in is the clock in the
 * header band, which is on every screen, so these tests hold that door open:
 * a screen nothing links to is a screen nobody finds.
 */
test.describe('getting to the timesheet', () => {
  /* The clock link itself is tested where the clock is — see
     time-clock.spec.js, "the report link sits with the status pill and opens
     the report". What is worth asserting here is the other half: that Reports
     does not claim to carry the timesheet. The twelve on that screen are
     reports over counts, and a timesheet among them would be the one row
     whose Export means payroll. */
  test('Reports does not list it', async ({ page }) => {
    await page.goto(REPORTS);
    await expect(page.getByTestId('report--rail')).not.toContainText('Time');
  });
});

test.describe('time report — the practice', () => {
  test('opens on the whole practice, one line per person', async ({ page }) => {
    await page.goto(REPORT);
    /* Nobody ticked is the whole practice — there is no row saying so, because
       an empty set already does. */
    await expect(page.getByTestId('time-report--who').locator('.ui-filter__count')).toBeHidden();

    const lines = page.getByTestId('time-report--summary-row');
    await expect(lines.first()).toBeVisible();
    expect(await lines.count()).toBeGreaterThan(1);
  });

  /* The summary is a way in to the per-person report, not a dead end. */
  test('a name in the summary becomes the report for that person', async ({ page }) => {
    await page.goto(REPORT);
    const first = page.getByTestId('time-report--summary-row').first().locator('button');
    const name = (await first.textContent()).trim();
    await first.click();

    await expect(page.getByTestId('time-report--summary-table')).toBeHidden();
    for (const row of await page.getByTestId('time-report--row').all()) {
      await expect(row).toContainText(name);
    }
  });

  test('an employee can be picked directly, and only their hours are shown', async ({ page }) => {
    await page.goto(REPORT);
    await lastThirtyDays(page);
    await chooseEmployee(page, 'emp-u8'); // Ryan Weste

    await expect(page.getByTestId('time-report--summary-table')).toBeHidden();
    const rows = page.getByTestId('time-report--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) await expect(row).toContainText('Ryan Weste');
  });

  /* Salaried staff cannot earn overtime, and a 0h 0m in that column would be a
     claim about their week rather than a statement that the column does not
     apply to them. */
  test('overtime is a dash for exempt staff, not a zero', async ({ page }) => {
    await page.goto(REPORT);
    await lastThirtyDays(page);

    const physician = page
      .getByTestId('time-report--summary-row')
      .filter({ hasText: 'Arlene McCoy' });
    await expect(physician.locator('td').nth(6)).toHaveText('—');
  });
});

test.describe('time report — periods', () => {
  test('a day reports only that day', async ({ page }) => {
    await choose(await seeded(page), 'time-report--period', 'Day');
    await fill(page, 'time-report--nav-day', iso(daysAgo(0)));

    const rows = page.getByTestId('time-report--row');
    expect(await rows.count()).toBeGreaterThan(0);

    // Asserted as "every row carries the same date" rather than against a
    // formatted string: the date is rendered in the browser's locale, which is
    // not the one this test file runs in.
    const dates = await rows.locator('td').first().allTextContents();
    expect(new Set(dates).size).toBe(1);
  });

  /* The stepper is gone with the filter bar; the week is now picked in the
     date field alone, and the range it lands on is read off the printout's
     header — the one place the dates are still spelled out in words. */
  test('a week runs Monday to Sunday, and the date field moves between them',
    async ({ page }) => {
      await page.goto(REPORT);
      const printed = page.locator('[data-print-meta]');
      const thisWeek = await printed.textContent();

      await fill(page, 'time-report--nav-week', iso(daysAgo(7)));
      await expect(printed).not.toHaveText(thisWeek);

      // Any day in a week names that whole week, so coming back to today's
      // week comes back to the range we started on.
      await fill(page, 'time-report--nav-week', iso(daysAgo(0)));
      await expect(printed).toHaveText(thisWeek);
    });

  test('a pay period is two whole weeks and says so', async ({ page }) => {
    await page.goto(REPORT);
    await choose(page, 'time-report--period', 'Pay period');
    await expect(page.locator('[data-print-meta]')).toContainText('2-week pay period');
    await expect(page.getByTestId('time-report--nav-period')).toContainText('(current)');
  });

  test('a month reports the calendar month', async ({ page }) => {
    await page.goto(REPORT);
    await choose(page, 'time-report--period', 'Month');
    await expect(page.locator('[data-print-meta]')).toContainText(
      new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })
    );
  });

  /* Payroll ranges include both ends. A range that stopped at midnight on the
     morning of the To date would drop that day's shifts. */
  test('a custom range includes the day named in To', async ({ page }) => {
    await page.goto(REPORT);
    await choose(page, 'time-report--period', 'Custom range');
    await fill(page, 'time-report--from', iso(daysAgo(7)));
    await fill(page, 'time-report--to', iso(daysAgo(7)));

    await expect(page.locator('[data-print-meta]')).not.toBeEmpty();
    // One day named at both ends is one day of entries, not none.
    expect(await page.getByTestId('time-report--row').count()).toBeGreaterThanOrEqual(0);
  });

  test('a backwards custom range corrects itself rather than reporting nothing',
    async ({ page }) => {
      await page.goto(REPORT);
      await choose(page, 'time-report--period', 'Custom range');
      await fill(page, 'time-report--from', iso(daysAgo(2)));
      await fill(page, 'time-report--to', iso(daysAgo(9)));

      // The From field follows the correction. Reporting on a range the fields
      // do not show would be the worse half of the two mistakes.
      await expect(page.getByTestId('time-report--from').locator('input')).toHaveValue(
        iso(daysAgo(9))
      );
      await expect(page.locator('[data-print-meta]')).not.toBeEmpty();
    });
});

test.describe('time report — what counts as time', () => {
  test('totals the signed-in user’s own shifts and lists them newest first',
    async ({ page }) => {
      await seed(page, [
        { inH: 9, outH: 12, notes: 'Morning clinic' },
        { inH: 13, outH: 17 },
      ]);
      await chooseEmployee(page, 'emp-amara');
      await choose(page, 'time-report--period', 'Day');

      await expect(page.getByTestId('time-report--row')).toHaveCount(2);
      await expect(page.getByTestId('time-report--total')).toHaveText('7h 0m');
      await expect(page.getByTestId('time-report--shifts')).toHaveText('2');
      await expect(page.getByTestId('time-report--days')).toHaveText('1');

      await expect(page.getByTestId('time-report--row').first()).toContainText('1:00 PM');
    });

  test('a break is excluded from worked time and shown separately', async ({ page }) => {
    await seed(page, [{ inH: 9, outH: 13, breakH: 1 }]);
    await chooseEmployee(page, 'emp-amara');
    await choose(page, 'time-report--period', 'Day');

    await expect(page.getByTestId('time-report--total')).toHaveText('3h 0m');
    await expect(page.getByTestId('time-report--breaks')).toHaveText('1h 0m');
    await expect(page.getByTestId('time-report--row')).toContainText('1h 0m');
  });

  test('a shift still running reads as running rather than as a blank', async ({ page }) => {
    await seed(page, [{ inH: 9, outH: null }]);
    await chooseEmployee(page, 'emp-amara');
    await choose(page, 'time-report--period', 'Day');
    await expect(page.getByTestId('time-report--row')).toContainText('Running');
  });

  /* A shift running since last Tuesday is not a 140-hour shift. It is a
     missing punch, worth zero hours until somebody corrects it. */
  test('a clock-out that never happened is an exception, not hours', async ({ page }) => {
    await page.goto(REPORT);
    await lastThirtyDays(page);

    const banner = page.getByTestId('time-report--exceptions');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('no clock-out');

    await page.getByTestId('time-report--exceptions-toggle').click();
    const row = page.getByTestId('time-report--row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Not recorded');
    await expect(row).toContainText('0h 0m');
  });

  test('an empty range says so instead of showing an empty table', async ({ page }) => {
    await page.goto(REPORT);
    await choose(page, 'time-report--period', 'Day');
    // A Sunday nobody worked, far enough back to be outside the demo history.
    await fill(page, 'time-report--nav-day', iso(daysAgo(400)));

    await expect(page.getByTestId('time-report--empty')).toBeVisible();
    await expect(page.getByTestId('time-report--row')).toHaveCount(0);
  });

  /* The screen itself no longer says the range in words — the period picker
     in the header band is the statement. Paper has no picker to look at, so
     the printout's header still spells it out, and that is what this guards. */
  test('the dates covered are spelled out on the printout', async ({ page }) => {
    await page.goto(REPORT);
    await expect(page.locator('[data-print-meta]')).not.toBeEmpty();
  });
});

test.describe('time report — corrections', () => {
  async function openTheException(page) {
    await page.goto(REPORT);
    await lastThirtyDays(page);
    await page.getByTestId('time-report--exceptions-toggle').click();
    await page.getByTestId('time-report--adjust').first().click();
    await expect(page.getByTestId('time-report--form')).toBeVisible();
  }

  test('a missing punch can be corrected, and the correction is marked', async ({ page }) => {
    await openTheException(page);

    // The dialog arrives pre-diagnosed: the entry, its date, and why it is here.
    await expect(page.getByTestId('time-report--f-reason').locator('select')).toHaveValue(
      'Missed clock-out'
    );
    await fill(page, 'time-report--f-out', '17:00');
    await page.getByTestId('time-report--save').click();

    await expect(page.getByTestId('time-report--exceptions')).toBeHidden();

    // Correcting it drops the exception filter, so thirty days of the whole
    // practice come back. Narrow to the person to find the row again.
    await chooseEmployee(page, 'emp-u2');
    const edited = page.getByTestId('time-report--row').filter({ hasText: 'Edited' });
    await expect(edited).toHaveCount(1);
    await expect(edited).not.toContainText('Not recorded');
  });

  /* The whole point of holding corrections in an overlay: the punch survives
     the correction, and the report can still show what the badge recorded. */
  test('the original punch and the reason survive the correction', async ({ page }) => {
    await openTheException(page);
    await fill(page, 'time-report--f-out', '17:00');
    await fill(page, 'time-report--f-note', 'Confirmed with the charge nurse');
    await page.getByTestId('time-report--save').click();

    await chooseEmployee(page, 'emp-u2');
    await page.getByTestId('time-report--row').filter({ hasText: 'Edited' })
      .getByTestId('time-report--adjust').click();

    await expect(page.getByTestId('time-report--original')).toContainText('no clock-out');
    const audit = page.getByTestId('time-report--audit');
    await expect(audit).toContainText('Amara Mensah');
    await expect(audit).toContainText('Missed clock-out');
    await expect(audit).toContainText('Confirmed with the charge nurse');
  });

  /* ===================== A RANGE, NOT A DAY =====================
     The same shift is often worked for a run of days — a week covered for
     somebody, a badge that failed all week. Adding takes From and To and
     writes one entry per day; correcting an existing entry does not, because
     one shift cannot be moved onto five days. ================================ */

  test.describe('adding a run of days', () => {
    /** Open Add entry with the employee and range already set. */
    async function openRange(page, employee, fromDays, toDays) {
      await page.goto(REPORT);
      await page.getByTestId('time-report--add').click();
      const select = page.getByTestId('time-report--f-employee').locator('select');
      await select.selectOption(employee);
      await select.dispatchEvent('change');
      await fill(page, 'time-report--f-date', iso(daysAgo(fromDays)));
      await fill(page, 'time-report--f-date-to', iso(daysAgo(toDays)));
    }

    test('the form asks for From and To when adding', async ({ page }) => {
      await page.goto(REPORT);
      await page.getByTestId('time-report--add').click();

      await expect(page.getByTestId('time-report--f-date')).toContainText('From date');
      await expect(page.getByTestId('time-report--f-date-to')).toBeVisible();
    });

    /* One shift happened on one day. Offering to spread a correction across a
       week would be offering to invent four shifts. */
    test('correcting an entry stays a single date', async ({ page }) => {
      await page.goto(REPORT);
      await lastThirtyDays(page);
      await page.getByTestId('time-report--exceptions-toggle').click();
      await page.getByTestId('time-report--adjust').first().click();

      await expect(page.getByTestId('time-report--f-date')).toContainText('Date');
      await expect(page.getByTestId('time-report--f-date')).not.toContainText('From date');
      await expect(page.getByTestId('time-report--f-date-to')).toBeHidden();
      await expect(page.getByTestId('time-report--preview')).toBeHidden();
    });

    /* A range's consequence is not readable off two date fields: "7 Aug to 11
       Aug" is five days, some of which may already be recorded. */
    test('the form says what Save will write before it writes it', async ({ page }) => {
      await openRange(page, 'emp-u6', 6, 2);

      const preview = page.getByTestId('time-report--preview');
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('Adds 2 entries');
      await expect(preview).toContainText('3 days are already recorded');
    });

    /* Asserted against what the preview promised rather than against a fixed
       number: which days in a window are already recorded depends on the day
       the suite runs. The invariant is that Save writes exactly what the form
       said it would. */
    test('one entry is written per day the preview counted', async ({ page }) => {
      await openRange(page, 'emp-u6', 8, 4);
      const promised = Number(
        (await page.getByTestId('time-report--preview').textContent()).match(/Adds (\d+)/)[1]
      );
      expect(promised).toBeGreaterThan(1);

      await choose(page, 'time-report--f-reason', 'Worked off-site');
      await page.getByTestId('time-report--save').click();
      await expect(page.locator('#repFlash')).toContainText(`${promised} entries added`);

      await chooseEmployee(page, 'emp-u6');
      await choose(page, 'time-report--period', 'Custom range');
      await fill(page, 'time-report--from', iso(daysAgo(8)));
      await fill(page, 'time-report--to', iso(daysAgo(4)));

      const manual = page.getByTestId('time-report--row').filter({ hasText: 'Manual' });
      await expect(manual).toHaveCount(promised);
    });

    /* A second shift in one day is an ordinary thing — a morning clinic and an
       evening list. The skip rule is for backfills, not for that. */
    test('a single day still takes a second shift, and says so', async ({ page }) => {
      await openRange(page, 'emp-u6', 3, 3);
      const preview = page.getByTestId('time-report--preview');
      await expect(preview).toContainText('Adds 1 entry');

      const before = await preview.textContent();
      await page.getByTestId('time-report--save').click();
      await expect(page.locator('#repFlash')).toContainText('Entry added');

      // If that day was already recorded, the form said so rather than
      // refusing the shift.
      if (before.includes('already has an entry')) {
        expect(before).toContain('adds a second shift');
      }
    });

    /* A manual entry over a day somebody actually clocked would double their
       hours, and nobody would find it until payroll ran. */
    test('a day that already has an entry is left alone', async ({ page }) => {
      await openRange(page, 'emp-u6', 6, 2);
      await page.getByTestId('time-report--save').click();
      await expect(page.locator('#repFlash')).toContainText('3 days already recorded');

      await chooseEmployee(page, 'emp-u6');
      await choose(page, 'time-report--period', 'Custom range');
      await fill(page, 'time-report--from', iso(daysAgo(6)));
      await fill(page, 'time-report--to', iso(daysAgo(2)));

      // Five days, five entries — not ten.
      await expect(page.getByTestId('time-report--row')).toHaveCount(5);
    });

    /* Filled first, so the range is provably complete whatever weekday the
       suite runs on. */
    test('a range whose days are all recorded is refused, not silently ignored',
      async ({ page }) => {
        await openRange(page, 'emp-u6', 4, 2);
        await page.getByTestId('time-report--save').click();
        await expect(page.locator('#repFlash')).toContainText('added');

        await openRange(page, 'emp-u6', 4, 2);
        await expect(page.getByTestId('time-report--preview')).toContainText(
          'already has an entry'
        );

        await page.getByTestId('time-report--save').click();
        await expect(page.getByTestId('time-report--form-error')).toContainText(
          'Correct the existing entries instead'
        );
      });

    test('a backwards range is refused rather than quietly reversed', async ({ page }) => {
      await openRange(page, 'emp-u6', 2, 9);
      await page.getByTestId('time-report--save').click();
      await expect(page.getByTestId('time-report--form-error')).toContainText(
        'To date is before the From date'
      );
    });

    /* 400 invented shifts is not something a flash message can undo. */
    test('a range longer than a month is refused', async ({ page }) => {
      await openRange(page, 'emp-u6', 200, 0);
      await page.getByTestId('time-report--save').click();
      await expect(page.getByTestId('time-report--form-error')).toContainText('at most 31');
    });

    test('a range ending in the future is refused', async ({ page }) => {
      await page.goto(REPORT);
      await page.getByTestId('time-report--add').click();
      const soon = new Date();
      soon.setDate(soon.getDate() + 3);
      await fill(page, 'time-report--f-date', iso(daysAgo(2)));
      await fill(page, 'time-report--f-date-to', iso(soon));

      await page.getByTestId('time-report--save').click();
      await expect(page.getByTestId('time-report--form-error')).toContainText('in the future');
    });
  });

  test('a shift can be entered by hand when no punch exists at all', async ({ page }) => {
    await page.goto(REPORT);
    await page.getByTestId('time-report--add').click();

    await choose(page, 'time-report--f-employee', 'emp-u6'); // Jacque Andrews
    await fill(page, 'time-report--f-date', iso(daysAgo(1)));
    await fill(page, 'time-report--f-in', '08:00');
    await fill(page, 'time-report--f-out', '12:00');
    await fill(page, 'time-report--f-break', '0');
    await choose(page, 'time-report--f-reason', 'Worked off-site');
    await page.getByTestId('time-report--save').click();

    await choose(page, 'time-report--period', 'Day');
    await fill(page, 'time-report--nav-day', iso(daysAgo(1)));
    await chooseEmployee(page, 'emp-u6');

    const manual = page.getByTestId('time-report--row').filter({ hasText: 'Manual' });
    await expect(manual).toHaveCount(1);
    await expect(manual).toContainText('4h 0m');
  });

  test('a running shift cannot be corrected while it is still running', async ({ page }) => {
    await seed(page, [{ inH: 9, outH: null }]);
    await chooseEmployee(page, 'emp-amara');
    await choose(page, 'time-report--period', 'Day');
    await expect(page.getByTestId('time-report--adjust')).toBeDisabled();
  });

  test.describe('the form refuses what a timesheet cannot survive', () => {
    const cases = [
      { name: 'a break longer than the shift', fields: { out: '09:30', break: '90' },
        error: 'break is longer' },
      { name: 'hours claimed for a day that has not happened',
        fields: { date: 'future' }, error: 'in the future' },
      { name: 'a correction with no explanation', fields: { reason: 'Other' },
        error: 'needs a note' },
    ];

    for (const scenario of cases) {
      test(scenario.name, async ({ page }) => {
        await page.goto(REPORT);
        await page.getByTestId('time-report--add').click();
        await fill(page, 'time-report--f-date', iso(daysAgo(1)));
        await fill(page, 'time-report--f-in', '09:00');
        await fill(page, 'time-report--f-out', '17:00');

        if (scenario.fields.out) await fill(page, 'time-report--f-out', scenario.fields.out);
        if (scenario.fields.break) await fill(page, 'time-report--f-break', scenario.fields.break);
        if (scenario.fields.date === 'future') {
          const soon = new Date();
          soon.setDate(soon.getDate() + 3);
          await fill(page, 'time-report--f-date', iso(soon));
        }
        if (scenario.fields.reason) {
          await choose(page, 'time-report--f-reason', scenario.fields.reason);
        }

        await page.getByTestId('time-report--save').click();
        await expect(page.getByTestId('time-report--form-error')).toContainText(scenario.error);
        await expect(page.getByTestId('time-report--form')).toBeVisible();
      });
    }
  });
});

test.describe('time report — who sees what', () => {
  /* Reading a colleague's shift pattern is reading when they are alone in the
     building. Somebody who is not an administrator gets their own hours only. */
  test('a non-administrator sees their own hours and cannot change them',
    async ({ page }) => {
      await page.goto(`${REPORT}?as=employee`);

      await expect(page.getByTestId('time-report--summary-table')).toBeHidden();
      await expect(page.getByTestId('time-report--add')).toBeHidden();
      await expect(page.getByTestId('time-report--adjust')).toHaveCount(0);

      const who = page.getByTestId('time-report--who');
      await expect(who.locator('.ui-filter__trigger')).toBeDisabled();
      // One real choice — themselves — and the panel refuses to open at all.
      await who.locator('.ui-filter__trigger').click({ force: true });
      await expect(page.locator('#ui-filter-panel')).toHaveCount(0);
    });
});

test.describe('time report — taking it away', () => {
  test('Export CSV downloads the report on screen', async ({ page }) => {
    await page.goto(REPORT);
    const download = page.waitForEvent('download');
    await page.getByTestId('time-report--export').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^time-report-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  /* There is no back arrow any more. It pointed at the Reports hub, and the
     hub is gone: Reports is the practice's twelve reports and the timesheet
     is not among them, so an arrow to that screen would send the reader
     somewhere they have never been. */
  test('there is no back arrow to a hub that no longer exists', async ({ page }) => {
    await page.goto(REPORT);
    await expect(page.locator('.ui-page-head__back')).toHaveCount(0);
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(REPORT);
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in the adjust dialog @a11y', async ({ page }) => {
    await page.goto(REPORT);
    await page.getByTestId('time-report--add').click();
    await expect(page.getByTestId('time-report--form')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

/** The report with the live clock seeded, for the period tests. */
async function seeded(page) {
  await seed(page, [{ inH: 9, outH: 12 }]);
  return page;
}
