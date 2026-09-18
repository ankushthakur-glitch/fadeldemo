/**
 * Chart — Appointments module.
 *
 * Reads the shared booking store filtered to this patient's MRN. The Add
 * Appointment dialog IS the scheduler's booking form, minus the patient picker
 * — same care-type switch, same field sets, same When panel of a month beside
 * that day's genuinely open starts. So the tests below drive it the way the
 * scheduler's own are driven: pick the fields the slot search depends on, then
 * pick one of the times it offers. There is no typed time to fill in, which is
 * the point — the old dialog would take any answer and book over anybody.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_APPTS = '/screens/patient-chart.html?mrn=326486#appointments';

test.describe('chart appointments module', () => {
  test('opens on Upcoming Appointments', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_APPTS);

    // The heading is kept for the outline and the screen reader but taken off
    // the screen — the tab strip in its place already names the section.
    const title = page.getByTestId('chart--module-title');
    await expect(title).toHaveText('Appointments');
    await expect(title).toHaveClass(/u-sr-only/);
    await expect(page.getByRole('tab', { name: /Upcoming Appointments/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    assertClean();
  });

  test('the Add Appointment modal opens on Clinical, with Procedure fields hidden', async ({
    page,
  }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    await expect(page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible();
    await expect(page.locator('#aptKindClinical')).toBeVisible();
    await expect(page.locator('#aptKindProcedure')).toBeHidden();
  });

  test('switching Care Type to Procedure swaps the field-grid', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    await page.getByTestId('chart--appt-kind').getByText('Procedure', { exact: true }).click();

    await expect(page.locator('#aptKindClinical')).toBeHidden();
    await expect(page.locator('#aptKindProcedure')).toBeVisible();
    await expect(page.getByTestId('chart--appt-procedure')).toBeVisible();
    // Typed, not picked from a catalogue of room names that goes stale the
    // first time a unit renumbers.
    await expect(page.getByTestId('chart--appt-proc-room')).toBeVisible();
  });

  /* THE THIRD CARE TYPE. An infusion names no provider at booking — the unit
     assigns whoever is on the floor when the patient arrives — so the control
     comes off the shared grid rather than standing there required with nobody
     able to answer it. */
  test('Infusion shares the clinical grid and drops the Provider control', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    await expect(page.getByTestId('chart--appt-kind').getByText('Infusion', { exact: true }))
      .toBeVisible();
    await page.getByTestId('chart--appt-kind').getByText('Infusion', { exact: true }).click();

    await expect(page.locator('#aptKindClinical')).toBeVisible();
    await expect(page.locator('#aptKindProcedure')).toBeHidden();
    await expect(page.getByTestId('chart--appt-provider')).toBeHidden();
    await expect(page.getByTestId('chart--appt-mode')).toBeVisible();
    await expect(page.getByTestId('chart--appt-room')).toBeVisible();
  });

  /* THE TIMES ARE THE ONES THAT EXIST. Until there is an activity and a
     provider there is nothing to compute, so the box collapses rather than
     standing there telling the reader to fill in the fields they are filling
     in — the same rule the scheduler's panel follows. */
  test('the open slots appear only once there is something to offer', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    const slots = page.getByTestId('chart--appt-time');
    await expect(slots).toBeHidden();

    await page.getByTestId('chart--appt-type').locator('select').selectOption({ index: 1 });
    await page.getByTestId('chart--appt-provider').locator('select').selectOption({ index: 1 });

    await expect(slots).toBeVisible();
    await expect(slots).toContainText('free');
    await expect(slots.locator('[data-slot]').first()).toBeVisible();
  });

  /* NEITHER HALF OF "WHEN" IS A FIELD THAT CAN CARRY AN ERROR — the day is a
     month grid and the time is a row of buttons — so a save with no time picked
     rings the panel that holds them both and says so once, in the dialog's own
     notice bar. */
  test('a booking with no time picked rings the When panel', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();
    await page.getByTestId('chart--appt-type').locator('select').selectOption({ index: 1 });
    await page.getByTestId('chart--appt-provider').locator('select').selectOption({ index: 1 });

    await page.getByTestId('chart--appt-save').locator('button').click();

    await expect(page.locator('#aptWhen')).toHaveClass(/appt__when--error/);
    await expect(page.locator('#aptNotice')).toContainText('Pick a time');
  });

  test('booking a Clinical appointment adds it to Upcoming with a Reason column', async ({
    page,
  }) => {
    await openChart(page, HENNA_APPTS);
    const table = page.getByTestId('chart--appt-table');
    const before = await table.locator('tbody tr').count();

    await page.getByTestId('chart--add-appointment').locator('button').click();
    await page.getByTestId('chart--appt-type').locator('select').selectOption({ index: 1 });
    await page.getByTestId('chart--appt-provider').locator('select').selectOption({ index: 1 });
    // The slot buttons are the only way to set a time, so the booked start is
    // one the provider is genuinely free for.
    await page.getByTestId('chart--appt-time').locator('[data-slot]').first().click();
    await page.getByTestId('chart--appt-reason').locator('textarea').fill('Follow-up on labs');
    await page.getByTestId('chart--appt-save').locator('button').click();

    await expect(page.getByTestId('chart--flash')).toContainText('booked for');
    await expect(table.locator('tbody tr')).toHaveCount(before + 1);
    await expect(table).toContainText('Follow-up on labs');
  });

  /* The payer's answer, on the patient whose chart this is. The scheduler has
     to have a patient chosen before it can ask; here there is only ever one, so
     the button works on the first press. */
  test('Check eligibility answers without a patient having to be chosen', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    await expect(page.getByTestId('chart--appt-elig-result')).toBeHidden();
    await page.getByTestId('chart--appt-check-eligibility').locator('button').click();

    await expect(page.getByTestId('chart--appt-elig-result')).toContainText('Member ID');
  });

  /* The date window is a fact about a STANDING REQUEST, not about a booking, so
     it arrives with the tick and leaves with it. */
  test('Add to wait list brings its date window with it', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();

    const range = page.getByTestId('chart--appt-wait-range');
    await expect(range).toBeHidden();

    // Clicked on the label, as the scheduler's own wait-list spec does: the
    // component draws its own box over the native input.
    const box = page.getByTestId('chart--appt-waitlist').locator('label');
    await box.click();
    await expect(range).toBeVisible();
    await expect(page.getByTestId('chart--appt-wait-from').locator('input')).not.toHaveValue('');

    await box.click();
    await expect(range).toBeHidden();
  });

  test('booking a Procedure produces a booking the rest of the app reads as a procedure', async ({
    page,
  }) => {
    await openChart(page, HENNA_APPTS);
    const table = page.getByTestId('chart--appt-table');
    const before = await table.locator('tbody tr').count();

    await page.getByTestId('chart--add-appointment').locator('button').click();
    await page.getByTestId('chart--appt-kind').getByText('Procedure', { exact: true }).click();

    /* A multiple select now: a patient on the table for an upper and a lower
       is one booking, and the Combo Procedure dropdown that used to carry the
       second has gone with the question it half-answered. */
    await page.getByTestId('chart--appt-procedure').locator('select').selectOption(['pt1']);
    await page.getByTestId('chart--appt-doctor').locator('select').selectOption({ index: 1 });
    /* The booked length is the sum of what is ticked, and the slot search runs
       on it — so the box states it rather than asking. */
    await expect(page.getByTestId('chart--appt-duration').locator('input')).not.toHaveValue('');
    await page.getByTestId('chart--appt-proc-room').locator('input').fill('Endoscopy Suite A');
    await page.getByTestId('chart--appt-proc-time').locator('[data-proc-slot]').first().click();
    await page.getByTestId('chart--appt-save').locator('button').click();

    await expect(table.locator('tbody tr')).toHaveCount(before + 1);
    // Room shown in place of Location for a procedure, and Type carries the
    // procedure's own title rather than a plain appointment type. Type is set
    // as text behind a kind dot rather than in a badge — see typeCell() — so
    // this reads the cell, which is what the assertion was always after.
    const row = table.locator('tbody tr').last();
    await expect(row.locator('.apt__type')).not.toHaveText('');
    await expect(row.locator('.apt__type')).toHaveClass(/apt__type--brand/);
  });

  test('a Procedure booking missing its provider is refused', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();
    await page.getByTestId('chart--appt-kind').getByText('Procedure', { exact: true }).click();

    await page.getByTestId('chart--appt-procedure').locator('select').selectOption(['pt1']);
    await page.getByTestId('chart--appt-save').locator('button').click();

    await expect(page.getByTestId('chart--appt-doctor')).toContainText('Choose a provider');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await expectNoA11yViolations(page);
  });

  /* The dialog is checked with something in it, not empty: the month grid, the
     slot buttons and the eligibility answer are all painted by script, and an
     unopened form is a form axe never sees. */
  test('no WCAG 2.1 A/AA violations on the open booking dialog @a11y', async ({ page }) => {
    await openChart(page, HENNA_APPTS);
    await page.getByTestId('chart--add-appointment').locator('button').click();
    await page.getByTestId('chart--appt-type').locator('select').selectOption({ index: 1 });
    await page.getByTestId('chart--appt-provider').locator('select').selectOption({ index: 1 });
    await expect(page.getByTestId('chart--appt-time').locator('[data-slot]').first()).toBeVisible();
    await page.getByTestId('chart--appt-check-eligibility').locator('button').click();
    await expect(page.getByTestId('chart--appt-elig-result')).toContainText('Member ID');

    await expectNoA11yViolations(page);
  });
});
