/**
 * Time clock — the shift clock in the top bar.
 *
 * The feature deliberately has no page of its own, so these run against an
 * ordinary screen and treat the header widget as the whole UI. The log is
 * read-only: entries come from clocking in and out, and nothing edits them.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';

const DIRECTORY = '/screens/patient-directory.html';
const SCHEDULER = '/screens/scheduler.html';
const KEY = 'medinova.timeclock.v1';

/**
 * Start from an empty log, or a shift left running by the previous test leaks
 * into this one. Cleared once after the first load rather than in an init
 * script, which would re-run on every navigation and wipe the very state the
 * "survives navigation" test is checking.
 */
async function freshClock(page, url = DIRECTORY) {
  await page.goto(url);
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload();
  await expect(page.getByTestId('timeclock--trigger')).toBeVisible();
}

async function openPanel(page) {
  await page.getByTestId('timeclock--trigger').click();
  await expect(page.getByTestId('timeclock--panel')).toBeVisible();
}

test.describe('time clock — trigger', () => {
  test('sits in the top bar of every screen', async ({ page }) => {
    for (const url of [DIRECTORY, SCHEDULER, '/screens/settings.html', '/screens/reports.html']) {
      await freshClock(page, url);
      await expect(page.locator('.pt__bar').getByTestId('timeclock--trigger')).toBeVisible();
    }
  });

  test('reads "Clock in" until a shift starts, then counts', async ({ page }) => {
    await freshClock(page);
    const trigger = page.getByTestId('timeclock--trigger');
    await expect(trigger).toHaveText(/Clock in/);
    await expect(trigger).toHaveAttribute('data-state', 'out');

    await openPanel(page);
    await page.getByTestId('timeclock--clock-in').click();

    await expect(trigger).toHaveAttribute('data-state', 'in');
    await expect(trigger).toHaveText(/0h 0m/);
  });

  /* The dot is a colour; the label and aria-label are what a screen reader and
     a colour-blind user actually get. */
  test('states are announced in words, not only in colour', async ({ page }) => {
    await freshClock(page);
    const trigger = page.getByTestId('timeclock--trigger');
    await expect(trigger).toHaveAttribute('aria-label', /Clocked Out/);

    await openPanel(page);
    await page.getByTestId('timeclock--clock-in').click();
    await expect(trigger).toHaveAttribute('aria-label', /Clocked In/);

    await page.getByTestId('timeclock--start-break').click();
    await expect(trigger).toHaveAttribute('aria-label', /On Break/);
  });
});

test.describe('time clock — shift actions', () => {
  test('clock in, break, and clock out move through the three states', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    const status = page.getByTestId('timeclock--status');

    await expect(status).toHaveText('Clocked Out');

    await page.getByTestId('timeclock--clock-in').click();
    await expect(status).toHaveText('Clocked In');
    await expect(page.getByTestId('timeclock--shift')).toHaveText('0h 0m');

    await page.getByTestId('timeclock--start-break').click();
    await expect(status).toHaveText('On Break');

    await page.getByTestId('timeclock--end-break').click();
    await expect(status).toHaveText('Clocked In');

    await page.getByTestId('timeclock--clock-out').click();
    await expect(status).toHaveText('Clocked Out');
  });

  /* Clocking out mid-break would bank the break against a finished shift. */
  test('clocking out is blocked while a break is running', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    await page.getByTestId('timeclock--clock-in').click();
    await page.getByTestId('timeclock--start-break').click();

    await expect(page.getByTestId('timeclock--clock-out')).toBeDisabled();
    await expect(page.getByText('End your break before clocking out.')).toBeVisible();

    await page.getByTestId('timeclock--end-break').click();
    await expect(page.getByTestId('timeclock--clock-out')).toBeEnabled();
  });

  test('a note typed before clocking in is kept on the shift', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    await page.getByTestId('timeclock--notes').fill('Covering the endo list');
    await page.getByTestId('timeclock--clock-in').click();

    await expect(page.getByTestId('timeclock--entry')).toContainText('Covering the endo list');
  });

  test('a second shift adds a second entry and both total', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);

    for (let i = 0; i < 2; i += 1) {
      await page.getByTestId('timeclock--clock-in').click();
      await page.getByTestId('timeclock--clock-out').click();
    }

    await expect(page.getByTestId('timeclock--entry')).toHaveCount(2);
    await expect(page.getByTestId('timeclock--panel')).toContainText('2 shifts');
  });
});

test.describe('time clock — the log is read-only', () => {
  test('an entry offers no edit or delete control', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    await expect(page.getByTestId('timeclock--empty')).toBeVisible();

    await page.getByTestId('timeclock--clock-in').click();
    const entry = page.getByTestId('timeclock--entry');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Active');

    // No buttons at all inside a row — the entry is a record, not a form.
    await expect(entry.locator('button')).toHaveCount(0);
    await expect(page.getByTestId('timeclock--add')).toHaveCount(0);
  });
});

test.describe('time clock — survives navigation', () => {
  test('a running shift is still running on the next screen', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    await page.getByTestId('timeclock--clock-in').click();
    await expect(page.getByTestId('timeclock--trigger')).toHaveAttribute('data-state', 'in');

    await page.goto(SCHEDULER);
    await expect(page.getByTestId('timeclock--trigger')).toHaveAttribute('data-state', 'in');

    await openPanel(page);
    await expect(page.getByTestId('timeclock--status')).toHaveText('Clocked In');
    await expect(page.getByTestId('timeclock--entry')).toHaveCount(1);
  });
});

test.describe('time clock — popover behaviour', () => {
  test('Escape and click-away close it', async ({ page }) => {
    await freshClock(page);
    const panel = page.getByTestId('timeclock--panel');

    await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    await openPanel(page);
    await page.locator('.ui-page-head__title').click();
    await expect(panel).toBeHidden();
  });

  /* The popover is the whole feature, so it carries its own a11y check — a
     page-level sweep with the panel closed would never look inside it. */
  test('no WCAG 2.1 A/AA violations with the panel open @a11y', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);
    await page.getByTestId('timeclock--clock-in').click();
    await expectNoA11yViolations(page, 'ui-time-clock');
  });

  test('the trigger reports its expanded state', async ({ page }) => {
    await freshClock(page);
    const trigger = page.getByTestId('timeclock--trigger');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await openPanel(page);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('the report link sits with the status pill and opens the report', async ({ page }) => {
    await freshClock(page);
    await openPanel(page);

    const link = page.getByTestId('timeclock--report-link');
    const pill = page.getByTestId('timeclock--status');
    await expect(link).toBeVisible();

    // "In alignment with" the pill: same row, same vertical centre.
    const [linkBox, pillBox] = [await link.boundingBox(), await pill.boundingBox()];
    const centre = (b) => b.y + b.height / 2;
    expect(Math.abs(centre(linkBox) - centre(pillBox))).toBeLessThan(2);
    expect(linkBox.x).toBeGreaterThan(pillBox.x);

    await link.click();
    await expect(page).toHaveURL(/time-reports\.html/);
    await expect(page.getByRole('heading', { name: 'Time Report' })).toBeVisible();
  });
});
