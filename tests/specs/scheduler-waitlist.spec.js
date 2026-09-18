import { test, expect } from '@playwright/test';
const S = '/screens/scheduler.html';
const errs = (page) => { const o=[]; page.on('console',m=>m.type()==='error'&&o.push(m.text())); page.on('pageerror',e=>o.push(String(e))); return o; };
const tab = (page, v) => page.locator(`#schTabs [role="tab"][data-value="${v}"]`);

test('third tab shows the wait list', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await expect(tab(page, 'waitlist')).toContainText('Wait List');
  await tab(page, 'waitlist').click();
  await expect(page.getByTestId('sch--panel-waitlist')).toBeVisible();
  await expect(page.getByTestId('sch--rail')).toBeHidden();
  const rows = page.locator('#wlTable tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const l of ['Patient/MRN','Activity','Provider','Available','Selected slot','Priority'])
    await expect(page.locator('#wlTable thead')).toContainText(l);
  // Weekday preferences are not asked for any more, so no column reports them.
  await expect(page.locator('#wlTable thead')).not.toContainText('Days');
  await expect(page.getByTestId('sch--count')).toContainText('waiting');
  
  expect(e).toEqual([]);
});

/* ===================== Joining the queue =====================
   The wait list screen has no Add button. A standing request is discovered in
   the BOOKING form — at the moment none of the offered times will do — so
   that is where it is raised: tick "Add to wait list", say between which
   dates they could come, and saving the booking puts them on the queue. */

test('the wait list screen has no add button of its own', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();
  await expect(page.getByTestId('sch--wl-add')).toHaveCount(0);
});

test('ticking Add to wait list on a booking puts the patient on the queue', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();
  const before = await page.locator('#wlTable tbody tr').count();

  await tab(page, 'appointments').click();
  await page.getByTestId('sch--new').click();
  await page.getByTestId('sch--menu-new').click();
  await expect(page.locator('#apptModal')).toBeVisible();

  await page.getByTestId('sch--m-patient').locator('select').selectOption('326491');
  await page.getByTestId('sch--m-type').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--m-provider').locator('select').selectOption({ index: 1 });

  // The window is asked for only once the box says it is wanted.
  await expect(page.getByTestId('sch--m-wait-range')).toBeHidden();
  await page.getByTestId('sch--m-waitlist').locator('label').click();
  await expect(page.getByTestId('sch--m-wait-range')).toBeVisible();
  await expect(page.getByTestId('sch--m-wait-from').locator('input')).not.toHaveValue('');
  await expect(page.getByTestId('sch--m-wait-to').locator('input')).not.toHaveValue('');

  await page.locator('.appt__slot').first().click();
  await page.getByTestId('sch--m-save').locator('button').click();
  await expect(page.locator('#apptModal')).toBeHidden();
  await expect(page.locator('.ui-toast-region')).toContainText('added to the wait list');

  await tab(page, 'waitlist').click();
  expect(await page.locator('#wlTable tbody tr').count()).toBe(before + 1);
  expect(e).toEqual([]);
});

/* ===================== Editing an entry =====================
   A wait list request is a standing arrangement, not a record of something
   that happened: windows slip, priorities are raised, a patient calls back to
   say mornings only. Editing is the ordinary case, which is why it sits on
   the row rather than behind a delete-and-re-add. */

test('every waiting row offers Edit as well as Remove', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await expect(page.getByTestId('sch--wl-edit-WL-1041')).toBeVisible();
  await expect(page.getByTestId('sch--wl-remove-WL-1041')).toBeVisible();
  expect(e).toEqual([]);
});

test('Edit opens the same form, filled in from the entry', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1050').locator('button').click();
  await expect(page.locator('#wlModal')).toBeVisible();
  await expect(page.locator('#wlModal .ui-modal__title')).toHaveText('Edit Wait List Entry');

  // WL-1050: Andi Lane, urgent, 09:00–12:00, 10 Aug – 10 Sep.
  await expect(page.getByTestId('sch--wl-patient').locator('select')).toHaveValue('326474');
  await expect(page.getByTestId('sch--wl-priority').locator('select')).toHaveValue('urgent');
  await expect(page.getByTestId('sch--wl-from').locator('input')).toHaveValue('2026-08-10');
  await expect(page.getByTestId('sch--wl-to').locator('input')).toHaveValue('2026-09-10');
  await expect(page.getByTestId('sch--wl-start').locator('input')).toHaveValue('09:00');
  // The patient's own details come with them, not from retyping.
  await expect(page.getByTestId('sch--wl-facts')).toContainText('326474');

  // The commit button says what it will do, and only one is offered.
  await expect(page.getByTestId('sch--wl-update')).toBeVisible();
  await expect(page.getByTestId('sch--wl-save')).toBeHidden();

  expect(e).toEqual([]);
});

/* The patient is the one answer the edit form does not re-ask. Repointing a
   standing request at somebody else would hand them a place in a queue that
   was earned by another person's wait, so the picker is not there to be
   pressed and the drawer says why. */
test('editing cannot change who is waiting', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1050').locator('button').click();
  await expect(page.locator('#wlPatientRow')).toBeHidden();
  await expect(page.getByTestId('sch--wl-lock')).toContainText(/cannot be changed/i);
  await expect(page.getByTestId('sch--wl-facts')).toContainText('Andi Lane');
  await expect(page.getByTestId('sch--wl-facts')).toContainText('Waiting since');

  await page.getByTestId('sch--wl-cancel').locator('button').click();
  expect(e).toEqual([]);
});

/* Six controls describe one instruction to the desk. The recap is that
   instruction, and it is the line a reader checks instead of the six. */
test('the availability recap says the request back in words', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();

  // WL-1048 runs 30 Jul – 27 Aug with no time preference. Weekday preferences
  // are not asked for any more, so the sentence no longer reports them.
  await page.getByTestId('sch--wl-edit-WL-1048').locator('button').click();
  await expect(page.getByTestId('sch--wl-recap')).toContainText('any day');
  await expect(page.getByTestId('sch--wl-recap')).toContainText('any time of day');

  // A window the wrong way round is caught while it is typed, not on save.
  await page.getByTestId('sch--wl-to').locator('input').fill('2026-01-01');
  await expect(page.getByTestId('sch--wl-recap')).toContainText(/wrong way round/i);
});

/* A day that ends before it begins is the same mistake as a window that does,
   and it is caught the same way. */
test('a backwards time range is refused', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  await page.getByTestId('sch--wl-start').locator('input').fill('14:00');
  await page.getByTestId('sch--wl-end').locator('input').fill('08:00');
  await page.getByTestId('sch--wl-update').locator('button').click();

  await expect(page.getByTestId('sch--wl-end')).toHaveAttribute('error', /before the earliest/i);
  await expect(page.locator('#wlModal')).toBeVisible();
});

/* ===================== Select Slot =====================
   Seven weekday checkboxes asked which days suited and then narrowed a queue
   by the answer. The panel that replaced them answers the question the desk
   actually has: which of the times inside that window is free. */

test('the day-of-the-week picker is gone', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();
  await page.getByTestId('sch--wl-edit-WL-1048').locator('button').click();
  await expect(page.getByTestId('sch--wl-days')).toHaveCount(0);
});

test('Select Slot offers real openings inside the window, and one can be taken', async ({
  page,
}) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  const slots = page.getByTestId('sch--wl-slots');
  await expect(slots).toContainText('free');

  // Each offer carries its DATE as well as its time — a slot two weeks out is
  // nothing without the day attached to it.
  const first = slots.locator('.wl__slot').first();
  const taken = await first.textContent();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(slots.locator('.wl__slots-chosen')).toContainText(taken.trim());

  // And the recap stops describing a search once there is an answer to it.
  await expect(page.getByTestId('sch--wl-recap')).toContainText('Holding');

  await page.getByTestId('sch--wl-update').locator('button').click();
  await expect(page.locator('#wlModal')).toBeHidden();

  // The table reports it, and reopening the entry brings it back chosen.
  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  await expect(page.getByTestId('sch--wl-slots').locator('.wl__slot--selected')).toHaveCount(1);
  expect(e).toEqual([]);
});

test('moving the window drops a slot chosen under the old one', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  await page.getByTestId('sch--wl-slots').locator('.wl__slot').first().click();
  await expect(page.getByTestId('sch--wl-slots').locator('.wl__slot--selected')).toHaveCount(1);

  // A slot outside the request's own availability is not a slot it can hold.
  await page.getByTestId('sch--wl-to').locator('input').fill('2026-09-30');
  await expect(page.getByTestId('sch--wl-slots').locator('.wl__slot--selected')).toHaveCount(0);
});

test('saving an edit changes the row without adding one', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();
  const before = await page.locator('#wlTable tbody tr').count();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  await page.getByTestId('sch--wl-priority').locator('select').selectOption('urgent');
  await page.getByTestId('sch--wl-to').locator('input').fill('2026-09-30');
  await page.getByTestId('sch--wl-update').locator('button').click();

  await expect(page.locator('#wlModal')).toBeHidden();
  await expect(page.locator('.ui-toast-region')).toContainText('updated on the wait list');

  // Edited in place: the same number of people are waiting.
  expect(await page.locator('#wlTable tbody tr').count()).toBe(before);
  const row = page.locator('#wlTable tbody tr').filter({ hasText: 'Priya Raman' });
  await expect(row).toContainText('Urgent');
  await expect(row).toContainText('9/30/2026');

  expect(e).toEqual([]);
});

test('an edit is validated the same way an addition is', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  // A window that ends before it starts is not a window — the same rule the
  // add path enforces, because it is the same form.
  await page.getByTestId('sch--wl-to').locator('input').fill('2026-01-01');
  await page.getByTestId('sch--wl-update').locator('button').click();

  await expect(page.getByTestId('sch--wl-to')).toHaveAttribute('error', /before/i);
  await expect(page.locator('#wlModal')).toBeVisible();
});

test('cancelling an edit changes nothing', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();
  const before = await page.locator('#wlTable tbody tr').count();

  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  await page.getByTestId('sch--wl-priority').locator('select').selectOption('urgent');
  await page.getByTestId('sch--wl-cancel').locator('button').click();

  await expect(page.locator('#wlTable tbody tr').filter({ hasText: 'Priya Raman' })).toContainText(
    'Routine'
  );

  // And the next entry opened is that entry, not the one abandoned.
  await page.getByTestId('sch--wl-edit-WL-1050').locator('button').click();
  await expect(page.locator('#wlModal .ui-modal__title')).toHaveText('Edit Wait List Entry');
  await expect(page.getByTestId('sch--wl-update')).toBeVisible();
  await expect(page.getByTestId('sch--wl-save')).toBeHidden();
  await expect(page.getByTestId('sch--wl-facts')).toContainText('Andi Lane');

  await page.getByTestId('sch--wl-cancel').locator('button').click();
  expect(await page.locator('#wlTable tbody tr').count()).toBe(before);
});

test('calendar day offers new appointment or the wait list', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await page.getByTestId('sch--view-calendar').click();
  await page.getByTestId('sch--range-month').click();
  await page.locator('#calBody [data-date]').first().click();

  await expect(page.locator('#bookChoiceModal')).toBeVisible();
  await expect(page.getByTestId('sch--choice-new')).toBeVisible();
  await expect(page.getByTestId('sch--choice-wait')).toBeVisible();
  await expect(page.getByTestId('sch--choice-open')).toBeVisible();
  

  // New appointment → the regular form.
  await page.getByTestId('sch--choice-new').click();
  await expect(page.locator('#apptModal')).toBeVisible();
  await expect(page.getByTestId('sch--m-patient')).toBeVisible();
  expect(e).toEqual([]);
});

test('booking from the wait list prefills and removes on save', async ({ page }) => {
  await page.goto(S);
  await tab(page, 'waitlist').click();
  const before = await page.locator('#wlTable tbody tr').count();

  await tab(page, 'appointments').click();
  await page.getByTestId('sch--view-calendar').click();
  await page.getByTestId('sch--range-month').click();

  // A date inside the seeded windows.
  await page.locator('#calBody [data-date="2026-08-05"]').click();
  await page.getByTestId('sch--choice-wait').click();
  await expect(page.locator('#wlPickModal')).toBeVisible();
  

  await page.locator('[data-wl-pick]').first().click();
  await expect(page.locator('#apptModal')).toBeVisible();
  await expect(page.getByTestId('sch--m-patient').locator('select')).not.toHaveValue('');
  await expect(page.locator('#mFormNotice')).toContainText('from the wait list');

  await page.locator('.appt__slot').first().click();

  await page.getByTestId('sch--m-save').locator('button').click();
  await expect(page.locator('#apptModal')).toBeHidden();

  await tab(page, 'waitlist').click();
  expect(await page.locator('#wlTable tbody tr').count()).toBe(before - 1);
});

test('the primary action belongs to the open tab', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/screens/scheduler.html');

  // Appointments — books.
  await expect(page.getByTestId('sch--new')).toBeVisible();

  // Encounters — nothing to create.
  await tab(page, 'visit-notes').click();
  await expect(page.getByTestId('sch--new')).toBeHidden();

  /* Wait list — nothing to create either. A standing request is raised in the
     booking form, by ticking "Add to wait list" when none of the offered
     times will do, so the queue screen is the queue: read and worked, not a
     second place to fill one in. */
  await tab(page, 'waitlist').click();
  await expect(page.getByTestId('sch--new')).toBeHidden();
  await expect(page.getByTestId('sch--wl-add')).toHaveCount(0);

  // Back to Appointments restores the booking button.
  await tab(page, 'appointments').click();
  await expect(page.getByTestId('sch--new')).toBeVisible();

  expect(errors).toEqual([]);
});

/* ===================== No procedures on the wait list =====================
   A scope list is deferred and brought forward on the list itself, by Status
   and with prep, anaesthesia and a suite behind the date — never by joining a
   queue. The procedure field set has no wait list for that reason, and these
   two check that the rule holds where it could otherwise be worked around. */

test('the wait list offers clinic activities only', async ({ page }) => {
  const e = errs(page);
  await page.goto(S);
  await tab(page, 'waitlist').click();

  // Read off an existing entry's own Activity picker — the drawer is reached
  // by editing now that the screen has no Add button.
  await page.getByTestId('sch--wl-edit-WL-1041').locator('button').click();
  const options = await page.getByTestId('sch--wl-activity').locator('select option').allTextContents();

  // Nothing that is done in a suite.
  expect(options.filter((o) => /colonoscop|EGD|ERCP|EUS|sigmoidoscop|PEG tube|procedure visit|minor surgical/i.test(o))).toEqual([]);
  // But infusion stays: a chair is exactly the sort of thing patients wait for.
  expect(options.some((o) => /infusion/i.test(o))).toBe(true);

  // And no seeded row names an activity the drawer will not offer.
  await page.getByTestId('sch--wl-cancel').locator('button').click();
  await expect(page.locator('#wlTable tbody')).not.toContainText(/colonoscopy|EGD|ERCP/i);

  expect(e).toEqual([]);
});

test('booking a procedure has no wait list checkbox, whatever the care type says', async ({ page }) => {
  const e = errs(page);
  // Working as the ASC, the Clinical field set is filled from the ASC's own
  // activity list — which is where a colonoscopy could reach a checkbox the
  // Procedure field set does not have.
  await page.addInitScript(() => localStorage.setItem('medinova.practiceProfile', 'asc'));
  await page.goto(S);

  await page.getByTestId('sch--new').click();
  await page.getByTestId('sch--menu-new').click();
  await expect(page.locator('#apptModal')).toBeVisible();

  await page.getByTestId('sch--m-type').locator('select').selectOption('at16');
  await expect(page.getByTestId('sch--m-waitlist')).toBeHidden();

  // Infusion books through the same field set and keeps its wait list.
  await page.getByTestId('sch--m-type').locator('select').selectOption('at12');
  await expect(page.getByTestId('sch--m-waitlist')).toBeVisible();

  expect(e).toEqual([]);
});
