/**
 * Scheduler — the New Appointment form, after it was cut back.
 *
 * The form had grown fields the desk does not fill in at booking time: a
 * status that is actually set from the row menu when the patient arrives, a
 * notes box nothing read, and a billing rail that was clipped off screen at
 * ordinary widths. What is left is what booking a visit actually needs.
 *
 * The provider moved above the slots because the slots ARE that provider's —
 * asking for them after showing them was asking the question in the wrong
 * order — and it is one provider now rather than a list, because a booking has
 * one clinician.
 *
 * Clinical, Procedure and Infusion all get the same treatment; Infusion books
 * through the clinical field set, so it is checked here too rather than
 * assumed.
 */
import { test, expect } from '@playwright/test';

const errs = (page) => {
  const out = [];
  page.on('console', (m) => m.type() === 'error' && out.push(m.text()));
  page.on('pageerror', (e) => out.push(String(e)));
  return out;
};

/* Schedule Appointment is a menu now — book a slot for later, or take the
   patient at the desk straight into an encounter. This is the first branch,
   and it opens the same form it always did. */
async function newAppt(page) {
  await page.goto('/screens/scheduler.html');
  await page.getByTestId('sch--new').click();
  await page.getByTestId('sch--menu-new').click();
  await expect(page.locator('#apptModal')).toBeVisible();
}

const kind = (page, label) =>
  page.getByTestId('sch--m-kind').getByLabel(label).check();

test('Care Type, and the removed fields are gone (clinical)', async ({ page }) => {
  const errors = errs(page);
  await newAppt(page);

  await expect(page.getByTestId('sch--m-kind')).toContainText('Care Type');
  for (const id of [
    'sch--m-status',
    'sch--m-notes',
    'sch--m-area',
    'sch--m-billing',
    'sch--m-recalls',
    'sch--m-waitlist-panel',
    // A clinic visit reserves no instruments (RM-026), and Location is not
    // asked either — it follows from the care type (RM-024).
    'sch--m-equipment',
    'sch--m-location',
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  await expect(page.getByTestId('sch--m-provider')).toBeVisible();

  /* Room IS asked now, and typed rather than picked — the floor calls a room
     by whatever it is called on the board that morning. Mode is asked with
     it: which of In person and Telehealth this booking is was being guessed
     from the activity's name until the field existed. */
  await expect(page.getByTestId('sch--m-room').locator('input')).toBeVisible();
  await expect(page.getByTestId('sch--m-mode').locator('select')).toHaveValue('In person');
  expect(errors).toEqual([]);
});

test('one provider, above the day and its times', async ({ page }) => {
  await newAppt(page);
  // The Providers resource block and its add button are gone.
  await expect(page.getByTestId('sch--m-add-provider')).toHaveCount(0);
  await expect(page.locator('#rowsProviders')).toHaveCount(0);

  /* Measured against the When panel rather than the slot box: the box is empty
     until a provider and an activity exist to compute times from, and an empty
     one is collapsed rather than standing there as a bordered box saying so. */
  const provider = page.getByTestId('sch--m-provider');
  const when = page.getByTestId('sch--m-when');
  const pBox = await provider.boundingBox();
  const wBox = await when.boundingBox();
  expect(pBox.y).toBeLessThan(wBox.y);
});

test('the times appear only once there is something to offer', async ({ page }) => {
  await newAppt(page);
  const slots = page.getByTestId('sch--m-slots');
  await expect(slots).toBeHidden();

  await page.getByTestId('sch--m-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--m-type').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--m-provider').locator('select').selectOption({ index: 1 });
  await expect(slots).toBeVisible();
  await expect(slots).toContainText('Time');
});

test('the resources are multi-selects, not rows to add', async ({ page }) => {
  await newAppt(page);
  await expect(page.getByTestId('sch--m-staff').locator('select')).toHaveAttribute('multiple', '');
  // No + buttons and no rows to delete.
  await expect(page.locator('#kindClinical [data-add]')).toHaveCount(0);
  // And no referrer picker: the clinical form dropped it for the reason the
  // procedure form dropped its Referring Clinician — who sent the patient is
  // a directory record, not a booking answer.
  await expect(page.getByTestId('sch--m-referrers')).toHaveCount(0);
});

test('check eligibility answers on the clinical form', async ({ page }) => {
  const errors = errs(page);
  await newAppt(page);

  await page.getByTestId('sch--m-check-eligibility').locator('button').click();
  await expect(page.getByTestId('sch--m-elig-result')).toContainText('Choose a patient');

  await page.getByTestId('sch--m-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--m-check-eligibility').locator('button').click();
  await expect(page.getByTestId('sch--m-elig-result')).toContainText('Active coverage');
  await expect(page.getByTestId('sch--m-elig-result')).toContainText('Member ID');
  expect(errors).toEqual([]);
});

test('a clinical booking still saves end to end', async ({ page }) => {
  const errors = errs(page);
  await newAppt(page);
  await page.getByTestId('sch--m-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--m-type').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--m-provider').locator('select').selectOption({ index: 1 });
  await page.locator('.appt__slot').first().click();

  await page.getByTestId('sch--m-save').locator('button').click();
  await expect(page.locator('#apptModal')).toBeHidden();
  await expect(page.locator('.ui-toast-region')).toContainText('Scheduled');
  expect(errors).toEqual([]);
});

test('the procedure form carries its own field set', async ({ page }) => {
  const errors = errs(page);
  await newAppt(page);
  await kind(page, 'Procedure');

  // Procedure asks three things clinical does not: what state the booking is
  // in, when exactly it starts, and anything the list needs told.
  for (const id of ['sch--q-status', 'sch--q-notes', 'sch--q-time']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // The room is typed on the booking, like the general form's.
  await expect(page.getByTestId('sch--q-room').locator('input')).toBeVisible();
  // And two fields it no longer asks: a second case on the same list is a
  // second tick in Procedure Type, and a referrer is a directory record.
  await expect(page.getByTestId('sch--q-combo')).toHaveCount(0);
  await expect(page.getByTestId('sch--q-referring')).toHaveCount(0);
  await expect(page.getByTestId('sch--q-check-eligibility')).toBeVisible();

  // The three cards it is grouped into.
  for (const id of ['sch--q-panel-info', 'sch--q-panel-when', 'sch--q-panel-notes']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  await page.getByTestId('sch--q-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--q-procedure').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--q-doctor').locator('select').selectOption({ index: 1 });
  await expect(page.getByTestId('sch--q-slots')).toContainText('Open slots');

  await page.getByTestId('sch--q-check-eligibility').locator('button').click();
  await expect(page.getByTestId('sch--q-elig-result')).toContainText('Active coverage');

  expect(errors).toEqual([]);
});

/**
 * The booked length is the sum of what is on the list, and it is not typed.
 *
 * Duration used to be an editable number that defaulted from the procedure, so
 * a desk could book a colonoscopy for ninety minutes from a dropdown. It is
 * disabled now and written from the Procedure Type selection — which takes
 * more than one procedure, because an upper and a lower under one sedation is
 * one booking. Colonoscopy is 45 and EGD is 30, so the pair is 75.
 */
test('the procedure length is added up from the procedures booked, and is read-only', async ({
  page,
}) => {
  await newAppt(page);
  await kind(page, 'Procedure');
  await page.getByTestId('sch--q-doctor').locator('select').selectOption({ index: 1 });

  const procedures = page.getByTestId('sch--q-procedure').locator('select');
  await expect(procedures).toHaveAttribute('multiple', '');

  await procedures.selectOption(['pt1']);
  const duration = page.getByTestId('sch--q-duration').locator('input');
  await expect(duration).toHaveValue('45');
  await expect(duration).toBeDisabled();
  await expect(page.getByTestId('sch--q-slots')).toContainText('45 min');

  // A second procedure on the same list lengthens the block it is booked in.
  await procedures.selectOption(['pt1', 'pt2']);
  await expect(duration).toHaveValue('75');
  await expect(page.getByTestId('sch--q-slots')).toContainText('75 min');
});

/**
 * Resources on the procedure form is Staff, and Staff alone.
 *
 * Referring Clinician has gone to the directory, where a referrer's address
 * and fax number are maintained — who is owed the report is not a decision to
 * improvise from inside a booking dialog. What is left is the pair the theatre
 * list needs at the point of booking: the provider, asked in the grid above,
 * and the people on the case, asked here. Several of them, because a case
 * usually has more than one.
 */
test('procedure resources offer staff, and take more than one', async ({ page }) => {
  await newAppt(page);
  await kind(page, 'Procedure');

  const staff = page.getByTestId('sch--q-staff').locator('select');
  await expect(staff).toHaveAttribute('multiple', '');
  await expect(page.getByTestId('sch--q-referring')).toHaveCount(0);
});

test('a procedure booking saves from a slot, and the slot fills Time', async ({ page }) => {
  await newAppt(page);
  await kind(page, 'Procedure');
  await page.getByTestId('sch--q-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--q-procedure').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--q-doctor').locator('select').selectOption({ index: 1 });

  // No time yet, so the error lands on the Time field rather than in a notice.
  await page.getByTestId('sch--m-save').locator('button').click();
  await expect(page.getByTestId('sch--q-time')).toContainText('Pick a time');

  await page.locator('[data-qslot]').first().click();
  await expect(page.getByTestId('sch--q-time').locator('select')).not.toHaveValue('');

  await page.getByTestId('sch--m-save').locator('button').click();
  await expect(page.locator('#apptModal')).toBeHidden();
});

test('infusion uses the same clinical field set, minus the provider', async ({ page }) => {
  await newAppt(page);
  await kind(page, 'Infusion');
  await expect(page.getByTestId('sch--m-clinical')).toBeVisible();
  await expect(page.getByTestId('sch--m-check-eligibility')).toBeVisible();
  await expect(page.getByTestId('sch--m-status')).toHaveCount(0);
});

/**
 * AN INFUSION NAMES NOBODY AT BOOKING.
 *
 * The unit assigns whoever is on the floor when the patient arrives, so the
 * Provider control is off the form entirely rather than hidden on it. The
 * count assertion is the point: a hidden field would still be found, still
 * hold a value, and still save an answer the desk was never shown.
 */
test('an infusion has no Provider field, and gets it back when the care type changes', async ({
  page,
}) => {
  const errors = errs(page);
  await newAppt(page);
  await expect(page.getByTestId('sch--m-provider')).toBeVisible();

  await kind(page, 'Infusion');
  await expect(page.getByTestId('sch--m-provider')).toHaveCount(0);

  // Back, and still the same control: it keeps the options it was given at
  // start-up rather than returning as an empty dropdown.
  await kind(page, 'Clinical');
  await expect(page.getByTestId('sch--m-provider')).toBeVisible();
  const options = await page.getByTestId('sch--m-provider').locator('select option').count();
  expect(options).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

/**
 * The times have to come from somewhere once nobody is named. They come from
 * the practice's own opening hours, because what is being reserved is chair
 * time in a unit that is open when the practice is.
 */
test('an infusion still offers times, from the unit hours rather than a rota', async ({
  page,
}) => {
  const errors = errs(page);
  await newAppt(page);
  await kind(page, 'Infusion');

  // The day is already the one the calendar is anchored on, so choosing an
  // activity is the last answer the times were waiting for.
  await page.getByTestId('sch--m-type').locator('select').selectOption({ index: 1 });

  await expect(page.locator('.appt__slot').first()).toBeVisible();
  expect(errors).toEqual([]);
});

/** Save must not demand the one field the form no longer shows. */
test('an infusion saves without a provider', async ({ page }) => {
  const errors = errs(page);
  await newAppt(page);
  await kind(page, 'Infusion');

  await page.getByTestId('sch--m-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--m-type').locator('select').selectOption({ index: 1 });
  await page.locator('.appt__slot').first().click();
  await page.getByTestId('sch--m-save').locator('button').click();

  await expect(page.locator('#apptModal')).toBeHidden();
  expect(errors).toEqual([]);
});

/**
 * BOOKING IS NOT WHERE A RECORD IS CREATED — ANY RECORD.
 *
 * Four pickers on this form used to carry an inline "Add New" beneath them.
 * The patient's went first, on the argument that an appointment is for a
 * person who is already registered. The other three have followed it, and the
 * argument is the same one: a procedure type carries a CPT code and a standard
 * length, a doctor carries a schedule and a colour on the calendar, and a
 * referrer carries an address to send the report to. None of the three is a
 * record to improvise from inside a half-filled booking, and all three are
 * maintained on the screens that own them.
 */
test('no picker on the procedure form offers an inline add', async ({ page }) => {
  await newAppt(page);
  await kind(page, 'Procedure');

  await expect(page.getByTestId('sch--q-patient')).toBeVisible();
  await expect(page.getByTestId('sch--q-procedure')).toBeVisible();
  await expect(page.getByTestId('sch--q-doctor')).toBeVisible();
  await expect(page.getByTestId('sch--q-staff')).toBeVisible();

  await expect(page.locator('#kindProcedure [data-add-new]')).toHaveCount(0);
  await expect(page.getByTestId('sch--m-procedure')).not.toContainText('Add New');
  await expect(page.getByTestId('sch--m-procedure')).not.toContainText('Add Custom');
});

/**
 * The wait list is a booking decision, not part of the date question.
 *
 * It used to be pinned inside the times column of the When panel, where it
 * disappeared with the column whenever no provider had been picked — so the
 * one control that does not depend on a date was the one a blank date took off
 * the screen. Clinical and Infusion offer it; a scope list is deferred by its
 * Status instead, so the procedure field set has no equivalent.
 */
test('Add to wait list sits outside the When panel', async ({ page }) => {
  await newAppt(page);

  const waitList = page.getByTestId('sch--m-waitlist');
  await expect(waitList).toBeVisible();
  await expect(page.locator('#mWhen [data-testid="sch--m-waitlist"]')).toHaveCount(0);

  await kind(page, 'Infusion');
  await expect(waitList).toBeVisible();

  await kind(page, 'Procedure');
  await expect(waitList).toBeHidden();
});

/**
 * A provider is offered by name and licence, not by rota.
 *
 * "Olivia Rhye — Gastroenterology" answers a question the picker is not being
 * asked: choosing who performs a case needs the credential, which is part of
 * the name a clinician is billed under. The specialty is still on the calendar
 * and the list, where "who covers motility" is the question being asked.
 */
test('provider pickers show the credential', async ({ page }) => {
  await newAppt(page);
  await kind(page, 'Procedure');

  const doctor = page.getByTestId('sch--q-doctor').locator('select');
  await expect(doctor).toContainText('Olivia Rhye — MD');
  await expect(doctor).toContainText('Aisha Patel — NP');
  await expect(doctor).not.toContainText('Gastroenterology');
});
