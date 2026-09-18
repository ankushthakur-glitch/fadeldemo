/**
 * The Dashboard — landing screen.
 *
 * Covers what came out of the 2026-08-04 design review (the clinic/ASC
 * location switch, today's schedule leading the screen), what the 2026-08-19
 * revamp added on top of it (the schedule as a time axis with real day
 * navigation, my inbox beside it) and the section put back on 2026-08-20:
 * Quick Actions, in the rail under the inbox rather than in a column of its
 * own. Running through all of it, that every panel is scoped to the
 * signed-in provider.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';
import { PROVIDER } from '../../data/provider-settings.js';
import { APPOINTMENTS, TODAY, PROVIDER_SCHEDULES } from '../../data/schedule.js';
import { TASKS, CURRENT_USER } from '../../data/tasks.js';
import { DIRECTORY } from '../../data/directory.js';

const DASHBOARD = '/screens/dashboard.html';

test.describe('dashboard', () => {
  test('renders cleanly', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(DASHBOARD);
    /* The screen's name is the nav item and the tab strip; the <h1> stays for
       anything reading the page structurally, which is why this asks whether
       it is there rather than whether it can be seen. */
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeAttached();
    await expect(page.getByRole('tab', { name: 'Outpatient Clinic' })).toBeVisible();
    assertClean();
  });

  test('the top nav Dashboard link opens this screen', async ({ page }) => {
    await page.goto('/screens/scheduler.html');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/dashboard.html');
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeAttached();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  test('four stat tiles render with a value each', async ({ page }) => {
    await page.goto(DASHBOARD);
    const tiles = page.locator('.dash__stat');
    await expect(tiles).toHaveCount(4);
    for (const tile of await tiles.all()) {
      await expect(tile.locator('.dash__stat-value')).not.toHaveText('');
    }
  });

  /** The day, and the rail of two cards beside it. */
  test('the body is my schedule, my inbox and the ways out', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.locator('.dash__grid .dash__card-title')).toHaveText([
      'My Schedule',
      'Messages',
      'Quick Actions',
    ]);
    // Pending Items listed the practice's refills, recalls and lab orders —
    // Task Management's job, not a personal landing screen's. Needs Attention
    // was the card before it, and Practice Snapshot the card before that.
    await expect(page.getByTestId('dash--pending-card')).toHaveCount(0);
    await expect(page.getByTestId('dash--worklist-card')).toHaveCount(0);
    await expect(page.getByTestId('dash--practice-card')).toHaveCount(0);
  });

  /**
   * The whole premise of the screen. data/schedule.js keeps its own provider
   * list, so "mine" is the stored join in PROVIDER.scheduleId — assert against
   * the data rather than against a number typed into the test, so rebooking a
   * demo appointment cannot quietly make this pass for the wrong reason.
   */
  test('the schedule shows my bookings and nobody else', async ({ page }) => {
    await page.goto(DASHBOARD);

    const mine = APPOINTMENTS.filter(
      (a) => a.date === TODAY && a.providerId === PROVIDER.scheduleId && !/ASC/i.test(a.location)
    );
    expect(mine.length).toBeGreaterThan(0);
    await expect(page.getByTestId('dash--sched-row')).toHaveCount(mine.length);
    await expect(page.getByTestId('dash--sched-count')).toHaveText(`${mine.length} booked`);

    // Somebody else's patient that day is not on my grid, by name.
    const mineMrns = new Set(mine.map((a) => a.mrn));
    const theirs = APPOINTMENTS.find(
      (a) => a.date === TODAY && a.providerId !== PROVIDER.scheduleId && !mineMrns.has(a.mrn)
    );
    const theirPatient = DIRECTORY.find((p) => p.mrn === theirs.mrn);
    const drawn = (await page.getByTestId('dash--sched-row').allInnerTexts()).join(' ');
    expect(drawn).not.toContain(theirPatient.name);
  });

  test('the tasks tile counts what is assigned to me', async ({ page }) => {
    await page.goto(DASHBOARD);
    const mine = TASKS.filter(
      (t) => t.assignedTo === CURRENT_USER && ['open', 'in-progress', 'overdue'].includes(t.status)
    ).length;

    await expect(page.getByTestId('dash--stat-my-open-tasks')).toContainText(String(mine));
  });

  /**
   * The tile is the only way through to the worklist now that Quick Actions is
   * gone — a count with nothing to press would be a dead end.
   */
  test('the tasks tile opens my worklist', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.getByTestId('dash--stat-my-open-tasks').click();
    await page.waitForURL('**/tasks.html?tab=mine');
  });

  /**
   * Two scopes, not three. "All Locations" was a third tab and is gone: the
   * clinic and the ASC have separate staff, rooms and lists, so a merged day
   * was a count nobody could act on.
   */
  test('the location switch offers the clinic and the ASC, and nothing else', async ({ page }) => {
    await page.goto(DASHBOARD);

    await expect(page.locator('#locTabs [role="tab"]')).toHaveText([
      'Outpatient Clinic',
      'ASC',
    ]);
    await expect(page.getByTestId('dash--loc-all')).toHaveCount(0);
    // The clinic opens by default — the page never starts on an empty scope.
    await expect(page.getByTestId('dash--loc-clinic')).toHaveAttribute('aria-selected', 'true');
  });

  /* The tile no longer prints the site under its figure — the switch two rows
     above says which site is showing — so what is checked here is the thing
     that actually has to move: the figure itself. */
  test('switching to the ASC changes the schedule and the tiles with it', async ({ page }) => {
    await page.goto(DASHBOARD);

    const tile = page.getByTestId('dash--stat-today-s-appointments').locator('.dash__stat-value');
    const clinicCount = await page.getByTestId('dash--sched-count').textContent();
    const clinicTile = await tile.textContent();

    await page.getByTestId('dash--loc-asc').click();
    await expect(page.getByTestId('dash--loc-asc')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('dash--loc-clinic')).toHaveAttribute('aria-selected', 'false');

    const ascCount = await page.getByTestId('dash--sched-count').textContent();
    expect(ascCount).not.toBe(clinicCount);
    await expect(tile).not.toHaveText(clinicTile);
  });

  /* ------------------------------------------------------------------------
     The schedule, as a time axis
     --------------------------------------------------------------------- */

  /**
   * A list would pass "there are rows". What makes this a day and not a list
   * is that the rows are POSITIONED: every block carries the minute offset and
   * the length the stylesheet turns into pixels, and the hour gutter it is
   * measured against is there to be measured against.
   */
  test('the schedule draws hours and positioned blocks', async ({ page }) => {
    await page.goto(DASHBOARD);

    // Midnight to midnight, on every day and at every location — so an hour is
    // the same height wherever you look, and nothing can be booked off the end.
    await expect(page.locator('.dash__hour')).toHaveCount(24);

    const blocks = page.locator('[data-testid="dash--sched-row"]');
    await expect(blocks.first()).toBeVisible();

    for (const block of (await blocks.all()).slice(0, 5)) {
      const geometry = await block.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          top: style.getPropertyValue('--dsh-top').trim(),
          len: style.getPropertyValue('--dsh-len').trim(),
          lanes: style.getPropertyValue('--dsh-lanes').trim(),
        };
      });
      expect(geometry.top).toMatch(/^\d+$/);
      // A zero-length block would be invisible however it were positioned.
      expect(Number(geometry.len)).toBeGreaterThan(0);
      expect(Number(geometry.lanes)).toBeGreaterThanOrEqual(1);
    }
  });

  /* ------------------------------------------------------------------------
     What the day is made of — availability, not just bookings
     --------------------------------------------------------------------- */

  /**
   * An empty stretch of grid used to be ambiguous: free, or not working? The
   * bands are the answer, and they are the complement of PROVIDER_SCHEDULES
   * rather than anything stored — so the assertion is that the hatching starts
   * exactly where my clinic does.
   */
  test('the grid draws my working hours and hatches the rest', async ({ page }) => {
    await page.goto(DASHBOARD);

    const off = page.locator('[data-testid="dash--band-off"]');
    // A 08:30-12:30 clinic inside a full day leaves a band on each side of it.
    await expect(off).toHaveCount(2);

    const geometry = await off.first().evaluate((el) => ({
      top: getComputedStyle(el).getPropertyValue('--dsh-top').trim(),
      len: getComputedStyle(el).getPropertyValue('--dsh-len').trim(),
    }));
    // Midnight to the start of clinic: offset zero, eight and a half hours.
    expect(geometry.top).toBe('0');
    expect(geometry.len).toBe('510');
  });

  /**
   * A 24-hour column opens on midnight, which is nobody's morning — so the card
   * scrolls itself to where the day starts. It must NOT follow the wall clock:
   * doing that scrolled past the morning's appointments for anyone reading
   * this between about half nine and half one, and the card looked empty. The
   * assertion that matters is the last one, and it holds at every hour.
   */
  test('the day column scrolls, and opens on the working hours', async ({ page }) => {
    await page.goto(DASHBOARD);

    const scroller = page.getByTestId('dash--sched-list');
    const { top, scrollable } = await scroller.evaluate((el) => ({
      top: el.scrollTop,
      scrollable: el.scrollHeight > el.clientHeight + 100,
    }));

    expect(scrollable).toBe(true);
    expect(top).toBeGreaterThan(0);
    // The first booking of the day is on screen without the reader scrolling.
    await expect(page.getByTestId('dash--sched-row').first()).toBeInViewport();
  });

  test('the sub-bar says what the day is', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByTestId('dash--day-summary')).toHaveText('8:30 AM – 12:30 PM · Fargo');
  });

  /**
   * A window carries the site it is worked at, so the clinic/ASC switch scopes
   * availability exactly as it scopes bookings. I am at Fargo on a Tuesday,
   * which makes the Tuesday ASC view a whole day of hatching — the true answer,
   * where an empty grid was no answer at all.
   */
  test('a day I do not work at this site is hatched end to end', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.getByTestId('dash--loc-asc').click();

    await expect(page.getByTestId('dash--day-summary')).toHaveText('Not working at the ASC');
    await expect(page.locator('[data-testid="dash--band-off"]')).toHaveCount(1);
    await expect(page.getByTestId('dash--sched-row')).toHaveCount(0);
  });

  /**
   * Leave, CME, an audit — the named reasons a day is gone. Driven off the
   * fixture so the test moves with the data rather than pinning a date.
   */
  test('a block day is drawn and named', async ({ page }) => {
    const [blockDay] = PROVIDER_SCHEDULES[PROVIDER.scheduleId].blockDays;
    expect(blockDay).toBeTruthy();

    await page.goto(DASHBOARD);
    // Walk forward to it; the fixture's block day is within the demo fortnight.
    for (let day = 0; day < 14; day += 1) {
      const summary = await page.getByTestId('dash--day-summary').textContent();
      if (summary === blockDay.title) break;
      await page.getByTestId('dash--day-next').click();
    }

    await expect(page.getByTestId('dash--day-summary')).toHaveText(blockDay.title);
    const band = page.locator('[data-testid="dash--band-blocked"]');
    await expect(band).toHaveCount(1);
    await expect(band).toContainText(blockDay.title);
  });

  /**
   * The block truncates hard — three overlapping bookings leave about a dozen
   * characters — so everything that does not fit has to still be reachable.
   */
  test('a block carries its full detail on the title', async ({ page }) => {
    await page.goto(DASHBOARD);
    const title = await page
      .locator('[data-testid="dash--sched-row"]')
      .first()
      .getAttribute('title');
    // Start–end and the length, then the patient, the status and the site.
    expect(title).toMatch(/^\d{1,2}:\d{2} (AM|PM)–\d{1,2}:\d{2} (AM|PM) \(\d+ min\) · /);
    expect(title.split(' · ').length).toBeGreaterThanOrEqual(4);
  });

  /**
   * The arrows walk the same appointment store the scheduler writes to, so
   * this is a one-day window onto the calendar rather than a frozen "today".
   */
  test('the day arrows move the schedule, and Today comes back', async ({ page }) => {
    await page.goto(DASHBOARD);

    const first = await page.getByTestId('dash--day-label').textContent();
    // Nothing to go back to yet, so nothing offers to.
    await expect(page.getByTestId('dash--day-today')).toBeHidden();

    await page.getByTestId('dash--day-next').click();
    await expect(page.getByTestId('dash--day-label')).not.toHaveText(first);
    await expect(page.getByTestId('dash--day-today')).toBeVisible();

    await page.getByTestId('dash--day-today').click();
    await expect(page.getByTestId('dash--day-label')).toHaveText(first);
    await expect(page.getByTestId('dash--day-today')).toBeHidden();
  });

  /* ------------------------------------------------------------------------
     Messages
     --------------------------------------------------------------------- */

  /** Unread first, so the column opens on the part of the inbox that is work. */
  test('messages lead with the unread threads', async ({ page }) => {
    await page.goto(DASHBOARD);

    const rows = page.getByTestId('dash--msg-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().locator('.dash__msg-count')).toHaveText(/^\d+$/);

    const counted = await page.locator('.dash__msg-count').count();
    // Everything with a count sits above everything without one.
    for (let index = 0; index < counted; index += 1) {
      await expect(rows.nth(index).locator('.dash__msg-count')).toHaveCount(1);
    }
    await expect(page.getByTestId('dash--msg-count')).toHaveText(/unread|All read/);
  });

  /* ------------------------------------------------------------------------
     Quick actions
     --------------------------------------------------------------------- */

  /**
   * Static markup — five hrefs with nothing derived — so what is worth
   * asserting is that all five are there, that every one is a link rather
   * than a tile that goes nowhere, and that they sit in the RAIL. The column
   * they cost was the reason they were cut once; the rail is the track
   * Messages already had, which is what pays for them.
   */
  test('quick actions offer five ways out, in the rail', async ({ page }) => {
    await page.goto(DASHBOARD);

    const actions = page.getByTestId('dash--actions').locator('.dash__action');
    await expect(actions).toHaveCount(5);
    await expect(page.locator('.dash__rail [data-testid="dash--actions"]')).toHaveCount(1);

    for (const action of await actions.all()) {
      await expect(action).toHaveAttribute('href', /\.html/);
      /* The label alone repeats the nav item. What each one actually starts
         used to be a line under it and is on the title now — the tiles are
         two rows where the rows were five, and the height went to the inbox
         beside them. Losing the explanation entirely was not part of that. */
      await expect(action).toHaveAttribute('title', /\S/);
    }
  });

  /**
   * A fixed set of five should not scroll. The rail gives the actions the
   * height they need and the inbox everything else — a ratio split was the
   * first go and it hid the fifth of them behind a scrollbar.
   */
  test('all five actions are on screen without scrolling the card', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByTestId('dash--action-reports')).toBeInViewport();
  });

  test('a quick action opens the screen it names', async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.getByTestId('dash--action-patient').click();
    await page.waitForURL('**/patient-add.html');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expectNoA11yViolations(page);
  });

  /**
   * Two live things are masked, not one. The clock counts real elapsed time,
   * so its digits roll over partway through a long suite run; the now-line
   * reads the wall clock, so it sits at a different height every run — and
   * disappears entirely outside clinic hours.
   */
  test('visual — dashboard', async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.locator('.dash__grid')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', {
      mask: [page.locator('ui-time-clock'), page.locator('.dash__now')],
    });
  });
});
