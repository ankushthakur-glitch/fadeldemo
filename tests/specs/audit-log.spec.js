/**
 * AUDIT LOG — who did what, to whose record, and whether the system allowed it.
 *
 * The tests below are mostly about the two things that make a log worth
 * keeping: it answers a narrow question quickly, and nothing on the screen can
 * change what it says. The absence of an edit action is asserted, not assumed —
 * it is the whole point of the screen.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';
import {
  openFilter,
  tickFilter,
  clearFilter,
  filterRow,
  filterOptions,
} from '../helpers/filter.js';

const AUDIT = '/screens/audit-log.html';

/** Tick one answer in the log's filter panel, opening it if it is shut. */
async function choose(page, group, value) {
  await openFilter(page, 'aud--filter');
  await tickFilter(page, group, value);
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

test.describe('audit log — reaching it', () => {
  /*
   * It is a Settings module, not a top-level section. The log is opened when
   * something is being investigated rather than as part of the day's work, so
   * it is reached through the hub and the main nav stays for the sections
   * people actually live in.
   */
  test('it is not offered in the main navigation', async ({ page }) => {
    await page.goto('/screens/dashboard.html');
    await expect(page.locator('.pt__nav').getByRole('link', { name: 'Audit Log' })).toHaveCount(0);
    await expect(page.getByTestId('nav--audit')).toHaveCount(0);
  });

  test('the Settings hub leads to it', async ({ page }) => {
    await page.goto('/screens/settings.html');
    await page.getByTestId('settings--audit').click();
    await expect(page).toHaveURL(/audit-log\.html/);
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('the nav marks Settings, and the page offers the way back', async ({ page }) => {
    await page.goto(AUDIT);
    await expect(page.getByTestId('nav--settings')).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('aud--back').click();
    await expect(page).toHaveURL(/settings\.html/);
  });
});

test.describe('audit log — the record', () => {
  test('opens on the most recent entries, newest first', async ({ page }) => {
    await page.goto(AUDIT);
    const rows = page.getByTestId('aud--row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);

    const stamps = await rows.locator('td').first().allTextContents();
    const times = stamps.map((s) => new Date(s).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  /* A sign-in is not an access to anybody's chart. Filing one against a
     patient would put a name in front of a reader that the event never
     touched. */
  test('only patient-record events carry a patient', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'category', 'auth');

    for (const row of await page.getByTestId('aud--row').all()) {
      await expect(row.locator('td').nth(5)).toHaveText('—');
    }
  });

  test('a PHI event names the patient and the MRN', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'category', 'phiRead');

    const first = page.getByTestId('aud--row').first();
    await expect(first.locator('td').nth(5)).toContainText('MRN');
  });
});

test.describe('audit log — filters', () => {
  test('category narrows the log', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'category', 'security');

    const rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.locator('td').nth(4)).toHaveText('Security');
    }
  });

  /* Offering "Claim Submitted" under Auth would be offering a filter that can
     only ever return nothing. */
  test('event type is narrowed to the ticked category', async ({ page }) => {
    await page.goto(AUDIT);
    await openFilter(page, 'aud--filter');
    const all = (await filterOptions(page, 'event')).length;

    await choose(page, 'category', 'auth');
    const narrowed = await filterOptions(page, 'event');
    expect(narrowed.length).toBeLessThan(all);
    expect(narrowed).toContain('Login Success');
    expect(narrowed).not.toContain('Claim Submitted');
  });

  test('changing category drops an event type that cannot survive it', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'category', 'auth');
    await choose(page, 'event', 'login-failed');
    await expect(page.getByTestId('aud--row')).not.toHaveCount(0);

    /* Untick Auth and tick PHI Read: the event type from the category just
       unticked is no longer on offer, and goes with it. */
    await tickFilter(page, 'category', 'auth');
    await choose(page, 'category', 'phiRead');
    // The stale pair would have filtered to nothing and read as "no activity".
    await expect(filterRow(page, 'event', 'login-failed')).toHaveCount(0);
    await expect(page.getByTestId('aud--row')).not.toHaveCount(0);
  });

  test('user narrows the log to one person', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'user', 'u0'); // Amara Mensah

    const rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.locator('td').nth(1)).toContainText('Amara Mensah');
    }
  });

  /* "Who has been in this patient's chart?" is the question this screen exists
     to answer, and it is asked by MRN as often as by name. */
  test('patient search matches on name or MRN', async ({ page }) => {
    await page.goto(AUDIT);
    const patient = page.getByTestId('aud--patient').locator('input');

    await patient.fill('Henna');
    await patient.dispatchEvent('input');
    let rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) await expect(row).toContainText('Henna West');

    await patient.fill('326486');
    await patient.dispatchEvent('input');
    rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) await expect(row).toContainText('326486');
  });

  test('outcome finds what the system refused', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'outcome', 'denied');

    const rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.locator('td').nth(7)).toHaveText('Denied');
    }
  });

  /* To means up to and including that day — the commonest thing anyone looks
     for is today, and a range that stopped at midnight would drop it. */
  test('the date range includes both days named', async ({ page }) => {
    await page.goto(AUDIT);
    const today = iso(daysAgo(0));

    const from = page.getByTestId('aud--from').locator('input');
    const to = page.getByTestId('aud--to').locator('input');
    await from.fill(today);
    await from.dispatchEvent('change');
    await to.fill(today);
    await to.dispatchEvent('change');

    const rows = page.getByTestId('aud--row');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      await expect(row.locator('td').first()).toContainText(
        new Date().toLocaleDateString([], { year: 'numeric' })
      );
    }
  });

  test('a backwards range corrects itself rather than reporting nothing', async ({ page }) => {
    await page.goto(AUDIT);
    const from = page.getByTestId('aud--from').locator('input');
    const to = page.getByTestId('aud--to').locator('input');

    await from.fill(iso(daysAgo(2)));
    await from.dispatchEvent('change');
    await to.fill(iso(daysAgo(9)));
    await to.dispatchEvent('change');

    await expect(from).toHaveValue(iso(daysAgo(9)));
  });

  test('an impossible combination says so instead of showing an empty table', async ({ page }) => {
    await page.goto(AUDIT);
    const patient = page.getByTestId('aud--patient').locator('input');
    await patient.fill('nobody by that name');
    await patient.dispatchEvent('input');

    await expect(page.getByTestId('aud--empty')).toBeVisible();
    await expect(page.getByTestId('aud--row')).toHaveCount(0);
  });

  test('Clear filters puts every control back', async ({ page }) => {
    await page.goto(AUDIT);
    const all = await page.getByTestId('aud--range').textContent();

    await choose(page, 'category', 'security');
    await choose(page, 'outcome', 'denied');
    await page.getByTestId('aud--patient').locator('input').fill('Henna');
    await page.getByTestId('aud--patient').locator('input').dispatchEvent('input');
    expect(await page.getByTestId('aud--range').textContent()).not.toBe(all);

    await clearFilter(page);
    await expect(page.getByTestId('aud--range')).toHaveText(all);
    await expect(page.getByTestId('aud--patient').locator('input')).toHaveValue('');
  });
});

test.describe('audit log — an entry cannot be changed', () => {
  test('the row menu reads and copies, and offers nothing that edits', async ({ page }) => {
    await page.goto(AUDIT);
    await page.getByTestId('aud--row-menu').first().click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'View details' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Copy entry ID' })).toBeVisible();

    // The absence is the feature: a log somebody can tidy is not evidence.
    for (const forbidden of ['Edit', 'Delete', 'Remove', 'Archive']) {
      await expect(menu.getByRole('menuitem', { name: forbidden })).toHaveCount(0);
    }
  });

  test('the detail view carries what the row could not fit', async ({ page }) => {
    await page.goto(AUDIT);
    await page.getByTestId('aud--row-menu').first().click();
    await page.getByRole('menuitem', { name: 'View details' }).click();

    const detail = page.getByTestId('aud--detail');
    await expect(detail).toContainText('Entry ID');
    await expect(detail).toContainText('IP address');
    await expect(detail).toContainText('Session');
    await expect(detail).toContainText('Role at the time');
    await expect(detail).toContainText('cannot be edited or removed');

    await expect(detail.locator('input, textarea, select')).toHaveCount(0);
  });
});

test.describe('audit log — export', () => {
  test('Export downloads the entries on screen', async ({ page }) => {
    await page.goto(AUDIT);
    const download = page.waitForEvent('download');
    await page.getByTestId('aud--export').click();

    expect((await download).suggestedFilename()).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.locator('#audFlash')).toContainText('Exported');
  });

  /* Taking a copy of the log out of the system is exactly the kind of act the
     log exists to record. */
  test('exporting the log is itself recorded in the log', async ({ page }) => {
    await page.goto(AUDIT);
    const before = await page.getByTestId('aud--row').count();

    const download = page.waitForEvent('download');
    await page.getByTestId('aud--export').click();
    await download;

    const first = page.getByTestId('aud--row').first();
    await expect(first).toContainText('Audit Log Exported');
    await expect(first).toContainText('Amara Mensah');
    expect(await page.getByTestId('aud--row').count()).toBe(before);
  });

  test('an export taken through a filter exports what was filtered', async ({ page }) => {
    await page.goto(AUDIT);
    await choose(page, 'category', 'security');
    const filtered = await page.getByTestId('aud--range').textContent();

    const download = page.waitForEvent('download');
    await page.getByTestId('aud--export').click();
    const file = await download;

    const stream = await file.createReadStream();
    const csv = await new Promise((resolve) => {
      let text = '';
      stream.on('data', (chunk) => (text += chunk));
      stream.on('end', () => resolve(text));
    });

    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('Entry ID');
    // Every exported row is one the filter allowed through.
    for (const line of lines.slice(1)) expect(line).toContain('Security');
    expect(filtered).toContain(String(lines.length - 1));
  });
});

test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
  await page.goto(AUDIT);
  await expectNoA11yViolations(page);
});
