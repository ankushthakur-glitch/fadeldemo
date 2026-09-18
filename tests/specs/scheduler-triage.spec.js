/**
 * Scheduler — Triage.
 *
 * A nurse's pass over a checked-in Clinical visit, before the provider's own
 * encounter: vitals, current medications, a note for the provider — taken
 * against the reason the booking already carries, which the drawer PRINTS
 * rather than asks for. Deliberately no Assessments/Screening section — that
 * stays out of this panel by design.
 *
 * The row action is "Start Triage" (or "View Triage" once completed) on a
 * Clinical appointment whose status is Checked In or Triage — never on a
 * Procedure or Infusion visit, and never before check-in.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

/**
 * Type a medication that is not on the patient's chart.
 *
 * Medication Name is a list of what the chart already holds for this patient —
 * the pass is the nurse confirming that list, not retyping it — with "Other"
 * as the last row for anything genuinely new. Picking Other turns the same
 * control into a text box, which is where these names go.
 */
async function typeMedication(page, name) {
  const field = page.getByTestId('sch--triage-med-name');
  await field.locator('select').selectOption('__other');
  await field.locator('input[type="text"]').fill(name);
}

/**
 * Dose and Frequency are lists too, fitted to the drug named above them:
 * the dose ladder is counted in the unit the catalogue holds for it, and the
 * frequency list is the usual sigs with whatever the chart already says about
 * this drug offered above them. Both carry the same "Other" row as the name.
 */
async function pickDose(page, value) {
  await page.getByTestId('sch--triage-med-dose').locator('select').selectOption(value);
}

async function pickFrequency(page, value) {
  await page.getByTestId('sch--triage-med-frequency').locator('select').selectOption(value);
}

/** Vitals and Current Medication are captured in centred windows the drawer
 *  opens over itself, so a test that touches either has to open the window
 *  first and shut it again before going back to the drawer underneath. */
async function openVitals(page) {
  await page.getByTestId('sch--triage-check-vitals').click();
  await expect(page.locator('#triageVitalsModal .ui-modal__dialog')).toBeVisible();
}

async function saveVitals(page) {
  await page.getByTestId('sch--triage-vitals-save').locator('button').click();
  await expect(page.locator('#triageVitalsModal .ui-modal__dialog')).toBeHidden();
}

async function openMedications(page) {
  await page.getByTestId('sch--triage-add-medication').click();
  await expect(page.locator('#triageMedModal .ui-modal__dialog')).toBeVisible();
}

async function closeMedications(page) {
  await page.getByTestId('sch--triage-med-done').locator('button').click();
  await expect(page.locator('#triageMedModal .ui-modal__dialog')).toBeHidden();
}

const SCHEDULER = '/screens/scheduler.html';

/** The Care Type column's badge text ("Clinical" / "Procedure" / "Infusion")
 *  — scoped to the one ui-badge each row renders, rather than the row's
 *  whole text, so an appointment TYPE that happens to contain one of those
 *  words (e.g. "Infusion Therapy") can never be mistaken for the kind.
 *  Returns null for the date-heading rows the table inserts between days,
 *  which render no badge at all — .count() first so those never hang
 *  waiting on an element that will never appear. */
async function kindOfRow(row) {
  const badge = row.locator('ui-badge');
  if ((await badge.count()) === 0) return null;
  return badge.innerText();
}

/** The first row in the default (Week) view that is a Clinical visit and is
 *  not already checked in — TODAY is a fixed seed date, so this is the same
 *  row on every run. */
async function firstCheckableClinicalRow(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    if ((await kindOfRow(row)) !== 'Clinical') continue;
    const status = (await row.locator('.sch__status').innerText()).trim();
    if (['Checked In', 'Triage', 'Check Out'].includes(status)) continue;
    return row;
  }
  throw new Error('No checkable Clinical row found in the default scheduler view.');
}

/* Change Status opens a SECOND menu on the same trigger — a list of actions
   cannot hold a list of values, so the statuses are their own <ui-menu>
   (js/screens/scheduler.js, statusMenu). */
async function checkIn(page, row) {
  await row.locator('[data-menu]').click();
  await page.getByText('Change Status', { exact: true }).click();
  await page.getByTestId('sch--status-checked-in').click();
}

test.describe('scheduler triage', () => {
  test('a Clinical row not yet checked in has no Triage action', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await row.locator('[data-menu]').click();

    await expect(page.getByText('Start Triage', { exact: true })).toHaveCount(0);
    await expect(page.getByText('View Triage', { exact: true })).toHaveCount(0);
  });

  test('a non-Clinical row never offers Triage, checked in or not', async ({ page }) => {
    await page.goto(SCHEDULER);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      if (!['Procedure', 'Infusion'].includes(await kindOfRow(row))) continue;
      found = true;
      await row.locator('[data-menu]').click();
      await expect(page.getByText('Start Triage', { exact: true })).toHaveCount(0);
      await expect(page.getByText('View Triage', { exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
      break;
    }
    expect(found, 'expected at least one Procedure/Infusion row in the default view').toBe(true);
  });

  /* --- Complete Check In → Triage ------------------------------------------
     Checking a Clinical visit in from the Appointment Details drawer goes
     straight into Triage now, instead of jumping to the encounter — the
     nurse's pass happens before the provider ever opens that screen. This
     is specific to Clinical: Infusion has no triage step and still opens
     the encounter directly, same as before. */

  test('Complete Check In opens Triage directly for a Clinical visit, not the encounter', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);

    await row.locator('[data-start]').click();
    await expect(page.locator('#startModal .ui-modal__dialog')).toBeVisible();
    await page.getByTestId('sch--d-checkin').locator('button').click();

    // Still on the scheduler — no navigation to encounter.html.
    await expect(page).toHaveURL(/scheduler\.html$/);
    await expect(page.locator('#startModal .ui-modal__dialog')).toBeHidden();
    await expect(page.locator('#triageModal .ui-modal__dialog')).toBeVisible();
    await expect(page.locator('#triageModal .ui-modal__dialog')).toContainText('Reason For Visit');

    assertClean();
  });

  test('Complete Check In still opens the encounter directly for Infusion — no triage step', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    let row = null;
    for (let i = 0; i < count; i++) {
      const candidate = rows.nth(i);
      if ((await kindOfRow(candidate)) !== 'Infusion') continue;
      const status = (await candidate.locator('.sch__status').innerText()).trim();
      if (['Checked In', 'Check Out'].includes(status)) continue;
      row = candidate;
      break;
    }
    expect(row, 'expected at least one checkable Infusion row in the default view').not.toBeNull();

    await row.locator('[data-start]').click();
    await expect(page.locator('#startModal .ui-modal__dialog')).toBeVisible();
    await page.getByTestId('sch--d-checkin').locator('button').click();

    await expect(page).toHaveURL(/encounter\.html\?appt=/);
  });

  test('Start Triage opens the drawer on the booking line and no Assessments/Screening', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);

    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    const drawer = page.locator('#triageModal .ui-modal__dialog');
    await expect(drawer).toBeVisible();
    /* The booking is one recognisable line — no "Appointment Details"
       disclosure, and no facts grid folded behind it. */
    await expect(page.getByTestId('sch--triage-booking')).toBeVisible();
    await expect(drawer).not.toContainText('Appointment Details');
    for (const label of ['Age of Encounter', 'Note Type', 'Service Type']) {
      await expect(drawer).not.toContainText(label);
    }
    for (const section of ['Reason For Visit', 'Vitals', 'Current Medication', 'Note']) {
      await expect(drawer).toContainText(section);
    }
    await expect(drawer).not.toContainText('Assessment');
    await expect(drawer).not.toContainText('Screening');

    /* The reason is PRINTED with the booking rather than asked for — so it is
       on the drawer as text, and there is no box anywhere on the drawer to
       type it into. The Note is answered here; Vitals and Current Medication
       are answered in windows of their own, which are shut — so what those
       two sections show is a button and nothing else: a section with no
       answer in it yet prints no table, and no sentence saying it has no
       table either. */
    const reason = page.getByTestId('sch--triage-reason');
    await expect(reason).toBeVisible();
    await expect(reason.locator('textarea, input')).toHaveCount(0);
    await expect(reason).not.toHaveText(/^\s*Reason For Visit\s*$/);
    await expect(page.getByTestId('sch--triage-note')).toBeVisible();
    await expect(page.locator('#triageVitalsModal .ui-modal__dialog')).toBeHidden();
    await expect(page.locator('#triageMedModal .ui-modal__dialog')).toBeHidden();
    await expect(page.locator('[data-triage-summary="vitals"]')).toBeEmpty();
    await expect(page.locator('[data-triage-summary="meds"]')).toBeEmpty();
    await expect(page.getByTestId('sch--triage-vitals-table')).toHaveCount(0);
    await expect(page.getByTestId('sch--triage-meds-table')).toHaveCount(0);
    await expect(page.getByTestId('sch--triage-check-vitals')).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    );

    // It says who it is for, and the three marks say none of it is answered.
    // Scoped to [data-triage-mark] — Pain Level wears the same mark under a
    // heading of the same rank, but it is not one of the three numbered
    // steps, and neither is the printed reason.
    await expect(page.getByTestId('sch--triage-patient')).toContainText('MRN');
    await expect(drawer.locator('.sch__triage-mark--pending[data-triage-mark]')).toHaveCount(3);
    await expect(drawer.locator('[data-triage-pain-mark]')).toHaveClass(/sch__triage-mark--pending/);

    assertClean();
  });

  /* --- The checklist is live ----------------------------------------------
     The marks used to change only after a save and a reopen, which made them
     decoration rather than a checklist. They are recomputed from the fields
     as they are typed into. */

  test('the marks keep up with the fields', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    const drawer = page.locator('#triageModal .ui-modal__dialog');

    await expect(drawer.locator('.sch__triage-mark--done[data-triage-mark]')).toHaveCount(0);
    await expect(drawer.locator('.sch__triage-mark--pending[data-triage-mark]')).toHaveCount(3);

    await page.getByTestId('sch--triage-note').locator('textarea').fill('Came in with her daughter.');
    await expect(drawer.locator('.sch__triage-mark--done[data-triage-mark]')).toHaveCount(1);
    await expect(drawer.locator('.sch__triage-mark--pending[data-triage-mark]')).toHaveCount(2);

    /* Pain keeps up the same way, off its own reading rather than off the
       step list — and a pressed 0 counts, which is the case a truthiness
       test on the score gets wrong. Vitals stays pending through both: a
       pain score is not an observation taken in the Check Vitals window. */
    const painMark = drawer.locator('[data-triage-pain-mark]');
    await page.getByTestId('sch--triage-pain-0').click();
    await expect(painMark).toHaveClass(/sch__triage-mark--done/);
    await expect(drawer.locator('[data-triage-mark="vitals"]')).toHaveClass(
      /sch__triage-mark--pending/
    );

    await page.getByTestId('sch--triage-pain-clear').click();
    await expect(painMark).toHaveClass(/sch__triage-mark--pending/);
  });

  /* The observations are taken in a window over the drawer, and what the
     drawer keeps of them is one line. The button says which of the two
     things it is about to do: add a set, or edit the set that is there. */
  test('Check Vitals opens a window, and the drawer keeps the line it comes back with', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    const button = page.getByTestId('sch--triage-check-vitals');
    await expect(button).toHaveText('Check Vitals');

    await openVitals(page);
    await page.getByTestId('sch--triage-vital-bp').fill('128/82');
    await page.getByTestId('sch--triage-vital-heartRate').fill('74');
    await saveVitals(page);

    /* What came back is a flowsheet — a column per reading taken, and no
       column for the five that were not. */
    const table = page.getByTestId('sch--triage-vitals-table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveCount(2);
    await expect(page.getByTestId('sch--triage-vitals-cell-bp')).toHaveText('128/82');
    await expect(page.getByTestId('sch--triage-vitals-cell-heartRate')).toHaveText('74');
    await expect(button).toHaveText('Edit Vitals');
  });

  /* Cancel has to be able to honour itself. The boxes behind the window ARE
     the live answer — there is no pending copy of them — so without the
     snapshot openTriageVitals takes, Cancel would keep every number typed
     before it was pressed and mean nothing at all. */
  test('Cancel puts the vitals window back as it found it', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    await page.getByTestId('sch--triage-vital-bp').fill('118/76');
    await saveVitals(page);

    await openVitals(page);
    await page.getByTestId('sch--triage-vital-bp').fill('999/999');
    await page.getByTestId('sch--triage-vitals-cancel').locator('button').click();
    await expect(page.locator('#triageVitalsModal .ui-modal__dialog')).toBeHidden();

    await expect(page.getByTestId('sch--triage-vitals-cell-bp')).toHaveText('118/76');
    await openVitals(page);
    await expect(page.getByTestId('sch--triage-vital-bp')).toHaveValue('118/76');
  });

  /* Escape belongs to the window on top. Closing it must not take the drawer
     underneath with it — nor unlock the page behind that drawer, which is
     what a scroll lock set and cleared rather than counted would do. */
  test('Escape closes the vitals window and leaves the drawer standing', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    await page.keyboard.press('Escape');

    await expect(page.locator('#triageVitalsModal .ui-modal__dialog')).toBeHidden();
    await expect(page.locator('#triageModal .ui-modal__dialog')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/ui-scroll-locked/);
  });

  /* The boxes are read whether or not their window is on screen — which is
     why they are filled in when the drawer renders rather than when the
     window opens. A read that only reached what was visible would save a
     blank set for the nurse who took the observations and shut the window. */
  test('vitals entered in the window are saved with the window shut', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    await page.getByTestId('sch--triage-vital-bp').fill('118/76');
    await saveVitals(page);
    await page.getByTestId('sch--triage-draft').locator('button').click();

    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();
    await expect(page.getByTestId('sch--triage-vital-bp')).toHaveValue('118/76');
    // The table is on the drawer before the window is opened again.
    await expect(page.getByTestId('sch--triage-vitals-cell-bp')).toHaveText('118/76');
    await expect(page.getByTestId('sch--triage-check-vitals')).toHaveText('Edit Vitals');
  });

  test('body mass index is calculated from height and weight', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    const bmi = page.getByTestId('sch--triage-vital-bmi');
    await expect(bmi).toHaveAttribute('readonly', '');

    await page.getByTestId('sch--triage-vital-weight').fill('70');
    await page.getByTestId('sch--triage-vital-height').fill('170');
    await expect(bmi).toHaveValue('24.2');
  });

  /* Enter means two different things in this mini-form, and both are the
     keyboard's own meaning: in a box being TYPED in it commits the row, and on
     a closed dropdown it opens the list. So a medication typed under "Other"
     is added without leaving the keyboard, and one picked off the lists is
     added from the Add button that follows them. */
  test('Enter adds a medication from a box being typed in', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openMedications(page);
    await typeMedication(page, 'Omeprazole');
    await pickDose(page, '1 tablet');
    await page.getByTestId('sch--triage-med-name').locator('input[type="text"]').press('Enter');

    await expect(page.getByTestId('sch--triage-med-row')).toHaveCount(1);
    await expect(page.getByTestId('sch--triage-med-row')).toContainText('Omeprazole');
    await expect(page.getByTestId('sch--triage-med-row').locator('td').first()).toHaveText('1 tablet');
    // Back to the list, ready for the next one.
    await expect(page.getByTestId('sch--triage-med-name').locator('select')).toBeFocused();
  });

  test('Enter on the Frequency list opens the list rather than adding the row', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openMedications(page);
    await typeMedication(page, 'Omeprazole');
    await page.getByTestId('sch--triage-med-frequency').locator('select').press('Enter');

    await expect(page.locator('#uiSelectMenu')).toBeVisible();
    await expect(page.getByTestId('sch--triage-med-row')).toHaveCount(0);
  });

  /* Nothing blocks Complete Triage. The one field that used to — Reason For
     Visit — is printed off the booking now rather than typed here, so there
     is no answer the nurse can reach the footer without having given. Every
     remaining section is a reading that may legitimately not have been taken:
     a patient who declines a blood pressure, a patient on nothing, a pass
     with nothing worth telling the provider. */
  test('Complete Triage goes through on an untouched pass, and carries the booking reason', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    // What the drawer prints for the reason is what the booking holds, and it
    // is not blank — the pass is taken against something.
    const printed = (await page.getByTestId('sch--triage-reason').innerText()).trim();
    expect(printed.replace('Reason For Visit', '').trim().length).toBeGreaterThan(0);

    await page.getByTestId('sch--triage-complete').locator('button').click();
    await page.waitForURL(/encounter\.html\?appt=/);

    // Reopened, the completed pass still prints the same reason.
    await page.goBack();
    await row.locator('[data-menu]').click();
    await page.getByText('View Triage', { exact: true }).click();
    await expect(page.getByTestId('sch--triage-reason')).toHaveText(printed);
  });

  test('the vitals window holds the seven fields, each with its unit', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    const grid = page.getByTestId('sch--triage-vitals-grid');
    await expect(grid).toBeVisible();

    for (const [key, unit] of [
      ['bp', 'mmHg'],
      ['heartRate', 'bpm'],
      ['temperature', '°F'],
      ['respRate', 'bpm'],
      ['weight', 'Kg'],
      ['height', 'Cm'],
      ['bmi', '%'],
    ]) {
      const input = page.getByTestId(`sch--triage-vital-${key}`);
      await expect(input).toBeVisible();
      const wrapper = grid.locator('.sch__vital-field', { has: input });
      await expect(wrapper).toContainText(unit);
    }
  });

  test('Add Medication requires a name, then builds a running list', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openMedications(page);
    await page.getByTestId('sch--triage-med-add').locator('button').click();
    await expect(page.getByTestId('sch--triage-med-name')).toContainText('Choose a medication.');

    await typeMedication(page, 'Metformin');
    await pickDose(page, '1 tablet');
    await pickFrequency(page, 'Twice daily');
    await page.getByTestId('sch--triage-med-add').locator('button').click();

    const rows = page.getByTestId('sch--triage-med-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Metformin');
    // Dose and frequency are their own columns now, not one joined string.
    const cells = rows.first().locator('td');
    await expect(cells.nth(0)).toHaveText('1 tablet');
    await expect(cells.nth(1)).toHaveText('Twice daily');

    // The mini-form clears for the next entry — all three fields back to being
    // lists, with nothing typed or picked left behind in them.
    await expect(page.getByTestId('sch--triage-med-name').locator('select')).toHaveValue('');
    await expect(page.getByTestId('sch--triage-med-dose').locator('select')).toHaveValue('');
    await expect(page.getByTestId('sch--triage-med-frequency').locator('select')).toHaveValue('');

    await typeMedication(page, 'Lisinopril');
    await page.getByTestId('sch--triage-med-add').locator('button').click();
    await expect(rows).toHaveCount(2);

    // Removing one leaves the other.
    await rows.first().getByTestId('sch--triage-med-remove').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Lisinopril');
  });

  /*
   * Completing triage is the hand-off to the provider, so it does not return
   * to the list — it opens the encounter for that appointment. Everything the
   * nurse entered is still on the booking, which is what coming back to the
   * drawer proves.
   */
  test('Complete Triage saves every section and opens the encounter', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await openVitals(page);
    await page.getByTestId('sch--triage-vital-bp').fill('120/80');
    await saveVitals(page);
    await openMedications(page);
    await typeMedication(page, 'Metformin');
    await page.getByTestId('sch--triage-med-add').locator('button').click();
    await closeMedications(page);
    await page.getByTestId('sch--triage-note').locator('textarea').fill('Patient reassured.');

    await page.getByTestId('sch--triage-complete').locator('button').click();

    await page.waitForURL(/encounter\.html\?appt=/);

    // Back on the scheduler, the row action has moved on to View Triage and
    // every answer is still there.
    await page.goBack();
    await row.locator('[data-menu]').click();
    await expect(page.getByText('View Triage', { exact: true })).toBeVisible();
    await expect(page.getByText('Start Triage', { exact: true })).toHaveCount(0);
    await page.getByText('View Triage', { exact: true }).click();

    const drawer = page.locator('#triageModal .ui-modal__dialog');
    await expect(drawer).toContainText('Patient reassured.');
    await expect(page.getByTestId('sch--triage-vital-bp')).toHaveValue('120/80');
    await expect(page.getByTestId('sch--triage-med-row')).toContainText('Metformin');

    // Every step is marked done. Pain was never asked in this pass, so its
    // own mark is still an empty circle — hence the [data-triage-mark] scope.
    await expect(page.locator('.sch__triage-mark--pending[data-triage-mark]')).toHaveCount(0);
    await expect(page.locator('.sch__triage-mark--done[data-triage-mark]')).toHaveCount(3);

    assertClean();
  });

  test('Save as Draft persists the entry without marking triage complete', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();

    await page.getByTestId('sch--triage-note').locator('textarea').fill('Follow-up on labs.');
    await page.getByTestId('sch--triage-draft').locator('button').click();

    await expect(page.locator('#triageModal .ui-modal__dialog')).toBeHidden();

    // Still resumable as "Start Triage", not "View Triage" — and the row's
    // own status column now reads Triage, not Checked In.
    await expect(row).toContainText('Triage');
    await row.locator('[data-menu]').click();
    await expect(page.getByText('Start Triage', { exact: true })).toBeVisible();
    await page.getByText('Start Triage', { exact: true }).click();
    await expect(page.getByTestId('sch--triage-note')).toContainText('Follow-up on labs.');
  });

  test('no WCAG 2.1 A/AA violations on the open Triage drawer @a11y', async ({ page }) => {
    await page.goto(SCHEDULER);
    const row = await firstCheckableClinicalRow(page);
    await checkIn(page, row);
    await row.locator('[data-menu]').click();
    await page.getByText('Start Triage', { exact: true }).click();
    /* Both windows, one after the other — the drawer is a11y-clean on its
       own, and so is each window opened over it. They are checked one at a
       time because only the top one is reachable at any moment. */
    await openVitals(page);
    await expectNoA11yViolations(page);
    await saveVitals(page);

    await openMedications(page);
    await expectNoA11yViolations(page);
  });
});
