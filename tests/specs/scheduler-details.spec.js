/**
 * Scheduler — the Appointment Details drawer.
 *
 * What the desk reads about a booking without editing it: who, where, when,
 * which clinician, and why. The rows are not the same on every booking — a
 * procedure and an office visit are asked different questions — so this is
 * about which rows appear against which kind, and what they say.
 */
import { test, expect } from '@playwright/test';

const SCHEDULER = '/screens/scheduler.html';

const body = (page) => page.locator('#startBody');

/**
 * Open the drawer for one booking by id.
 *
 * TODAY is a fixed seed date, so these ids are the same rows on every run:
 * ap29 is Priya Raman's colonoscopy at the ASC, ap1 her office visit two days
 * earlier. Using the same patient for both keeps the comparison to the one
 * thing under test — the care type.
 */
async function openDetails(page, id) {
  await page.goto(SCHEDULER);
  /* The schedule is paged (js/lib/pagination.js), so a booking is reached the
     way the desk reaches one — by searching for the patient — rather than by
     trusting it to be among the first fifteen rows of the week. Both ids
     above are Priya Raman's, so one search serves them both. */
  await page.getByTestId('sch--search').locator('input').fill('Priya Raman');
  await page.locator(`[data-start="${id}"]`).locator('button').click();
  await expect(page.locator('#startModal .ui-modal__dialog')).toBeVisible();
}

const rowValue = (page, label) =>
  body(page)
    .locator('.sch__detail-row')
    .filter({ has: page.locator('.sch__detail-label', { hasText: label }) });

test.describe('appointment details — Mode against Location', () => {
  /**
   * A scope cannot be passed down a video call.
   *
   * "In person" on a procedure is a row that has never once told anybody
   * anything, so it does not appear. The facility underneath it does matter —
   * which ASC the case is at — so the row is replaced rather than dropped.
   */
  test('a procedure reads Location, not Mode', async ({ page }) => {
    await openDetails(page, 'ap29');

    await expect(body(page)).not.toContainText('Mode');
    await expect(rowValue(page, 'Location')).toContainText('Red River ASC');
  });

  /** A clinic visit genuinely can be either, so it keeps the question. */
  test('a clinical visit keeps Mode', async ({ page }) => {
    await openDetails(page, 'ap1');

    await expect(rowValue(page, 'Mode')).toContainText('In person');
    await expect(rowValue(page, 'Mode')).toContainText('MediNova Gastroenterology');
  });
});

/**
 * The provider is printed by licence, not by rota.
 *
 * The credential is part of the name a clinician is known and billed under;
 * the specialty answers "who covers motility on a Thursday", which is not the
 * question this cell is answering. The list column still carries the specialty.
 *
 * It is printed, not picked. Swapping the clinician is a change to the booking
 * and belongs on the booking form behind Edit — the drawer is what the desk
 * READS against the patient in front of them.
 */
test('the provider is shown with their credential, and is not editable here', async ({ page }) => {
  await openDetails(page, 'ap29');

  await expect(rowValue(page, 'Provider')).toContainText('David Smith — MD');
  await expect(rowValue(page, 'Provider')).not.toContainText('Endoscopy');
  await expect(page.getByTestId('sch--d-provider')).toHaveCount(0);

  // The rota fact is not lost — it is on the row the drawer was opened from.
  await page.locator('#startModal .ui-modal__close, #startModal [aria-label*="lose"]').first().click();
  await expect(page.locator('tr', { hasText: 'Priya Raman' }).first()).toContainText(
    'Gastroenterology'
  );
});

/**
 * The reason IS the indication, and the row says so.
 *
 * The clinical booking form asks for ICD-10 diagnoses and writes them into the
 * booking's reason, because billing shows that string as the visit reason. The
 * drawer reads it back through the same catalogue, so what is shown is the code
 * and its current description rather than whatever text was typed.
 *
 * The PROCEDURE form no longer asks for codes (RM-028) — it asks for a chief
 * complaint in prose. That does not change this test: the reason is one string
 * either way, and a booking that already carries codes still reads back through
 * the catalogue exactly as it did. Which is the point of leaving the shape
 * alone.
 */
test('a procedure shows its ICD-10 indication, code and description', async ({ page }) => {
  await openDetails(page, 'ap29');

  const indication = rowValue(page, 'Indication (Diagnosis)');
  await expect(indication).toContainText('K21.9');
  await expect(indication).toContainText('Gastro-oesophageal reflux');
});

/** A typed sentence is still a perfectly good reason on a clinic visit —
 *  only the booking form asks for codes, so nothing is forced into one. */
test('a clinical visit shows its written reason unchanged', async ({ page }) => {
  await openDetails(page, 'ap1');

  await expect(rowValue(page, 'Indication (Diagnosis)')).toContainText(
    'Coeliac — first assessment'
  );
});

/**
 * The indication is read here and changed elsewhere.
 *
 * The drawer used to carry the booking form's own <ui-icd10> so a case that
 * needed another diagnosis could take one without a trip back to the form.
 * What that produced was three live controls sitting among printed facts,
 * indistinguishable from them until you happened to click one — and a panel
 * with an Edit button on it whose relationship to those controls was never
 * stated. The drawer prints; Edit changes.
 */
test('the drawer prints the indication rather than offering a picker', async ({ page }) => {
  await openDetails(page, 'ap29');

  await expect(page.getByTestId('sch--d-indication')).toHaveCount(0);
  await expect(body(page).locator('.ui-icd10__chip')).toHaveCount(0);

  // Still the whole diagnosis, code and description, read back through the
  // catalogue — printing it loses nothing.
  await expect(rowValue(page, 'Indication (Diagnosis)')).toContainText('K21.9');
});
