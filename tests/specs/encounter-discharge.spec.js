/**
 * Leaving the building: the sheet, and the desk.
 *
 * These two documents have moved around more than anything else in the run.
 * Step 4 once ended at a nurse's discharge record — criteria, destination,
 * instruction set, signature — with check-out as an empty seventh step at the
 * bottom of the rail and the handout as a required dropdown naming a page that
 * existed nowhere. Then all three were rows on step 4. Then the handout was
 * folded into check-out as a page above the desk's questions.
 *
 * Where it has landed: the two are one question each. STEP 4'S DISCHARGE IS THE
 * HANDOUT, and nothing else — the page gone through in recovery with the
 * patient still in the chair, with the set chosen at the top of it. CHECK-OUT
 * IS STEP 6, a step of its own: the two cards the desk works at the counter —
 * whether the patient may go, and where they went — under the name of whoever
 * released them. The record that used to ask those questions a second time is
 * gone, and with it the `seedFrom` that existed to stop the two copies
 * disagreeing.
 *
 * So this file is about the JOINS more than the pages — the set chosen at the
 * head of the sheet is the sheet that renders, the impression written on the
 * report is the impression on the handout, the additional instructions are one
 * box rather than two, and completing check-out is what closes the visit while
 * leaving the encounter open.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

/* A real procedure booking, so the check-out commit has an appointment to move
   on. `ap29` is a colonoscopy; the encounter falls back to a generic procedure
   for an unknown id, which would quietly skip the one assertion below that is
   about the appointment store. */
const PROCEDURE = '/screens/encounter.html?appt=ap29';

async function openProcedure(page) {
  await page.goto(PROCEDURE);
  await page.getByTestId('encv--step-procedure').click();
}

/** Everything on this screen is reached from the rail, so that is the route. */
const openStep = (page, id) => page.getByTestId(`encv--step-${id}`).click();
const openSubstep = (page, id) => page.getByTestId(`encv--substep-${id}`).click();

/** Check-out is a step with no substeps: one press from anywhere in the rail. */
const openCheckout = (page) => openStep(page, 'checkout');

/** The sheet, which is step 4's last substep and the whole of it. */
async function openSheet(page) {
  await openProcedure(page);
  await openSubstep(page, 'discharge');
}

/* The same page, reached from the rail rather than from the address bar. Every
   document's answers live in memory on this screen, so a test about something
   surviving a move between steps has to MOVE — a second page.goto would reload
   the run and assert that a fresh form is fresh. */
async function reopenSheet(page) {
  await openStep(page, 'procedure');
  await openSubstep(page, 'discharge');
}

/*
 * The blocks of whichever document is open, in the order they are drawn.
 *
 * Scoped to #docBody rather than the page, because the clinical picture beside
 * the working column carries `encv--section-` testids of its own and would put
 * a dozen chart cards in the middle of any assertion about a document's shape.
 */
/*
 * The desk's own mark, typed.
 *
 * The pad opens holding whoever is signed in — the front desk, on this step —
 * so releasing the patient is one press. Typing a stand-in's name into the
 * field first is a route these tests are not about.
 */
async function signAsDischargingStaff(page) {
  await page
    .getByTestId('encv--sig-discharging-sign')
    .locator('button', { hasText: /^Sign$/ })
    .click();
}

const docSections = (page) =>
  page.locator('#docBody [data-testid^="encv--section-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.testid.replace('encv--section-', ''))
  );

/* ============================================================================
   THE SHAPE OF THE RUN
   ========================================================================= */

test.describe('the run', () => {
  test('step 4 ends at the discharge sheet', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await openProcedure(page);

    const substeps = page.locator('[data-testid^="encv--substep-"]');
    await expect(substeps).toHaveText([
      'Patient consent',
      'Pre-op',
      'Orders',
      'Procedure',
      'Discharge',
    ]);
    clean();
  });

  test('check-out is a step of its own, not a document under Procedure', async ({ page }) => {
    await page.goto(PROCEDURE);

    /* Seven rows, and one of them is the desk's. Asserted as a count as well as
       a presence, so a step quietly added or dropped elsewhere in the run still
       fails here rather than passing unnoticed. */
    await expect(page.locator('[data-testid^="encv--step-"]')).toHaveCount(7);
    await expect(page.getByTestId('encv--step-checkout')).toHaveCount(1);
    await expect(page.getByTestId('encv--substep-checkout')).toHaveCount(0);
  });

  test('the desk owns its own step, and the endoscopist owns theirs', async ({ page }) => {
    await openSheet(page);
    await expect(page.locator('#docRole')).toHaveText('MD');

    await openCheckout(page);
    await expect(page.locator('#docRole')).toHaveText('Front desk');
  });

  test('the handout IS the discharge document, and the desk has no copy of it', async ({ page }) => {
    await openSheet(page);
    await expect(page.getByTestId('encv--substep-discharge-instructions')).toHaveCount(0);

    /* The whole of step 4's last document, in the order it is read: what you
       may not do today beside what you may eat, then the block that sends
       somebody back to hospital, then the two facts nobody can fill in from a
       template, then the number to ring. No criteria card, no destination
       card, no pad — those questions are the desk's, once. */
    expect(await docSections(page)).toEqual([
      'activity',
      'diet',
      'warnings',
      'additional',
      'results',
    ]);

    /* And it is not ALSO at the counter. A sheet read back in two rooms is a
       sheet that can be marked as given by whoever opened it second. What the
       desk opens with instead is who the patient is: it is the one step in the
       run worked by somebody who was never in the room. */
    await openCheckout(page);
    expect(await docSections(page)).toEqual([
      'overview',
      'criteria',
      'discharge-details',
      'sign',
    ]);
  });
});

/* ============================================================================
   THE SHEET
   ========================================================================= */

test.describe('discharge instructions', () => {
  test('the set is chosen at the head of the sheet it selects', async ({ page }) => {
    await openSheet(page);
    await page
      .getByTestId('encv--sheet-set-select')
      .locator('select')
      .selectOption('Post-EGD — standard');

    /* An upper endoscopy watches for coffee-ground vomit, not for blood per
       rectum. A sheet carrying the colonoscopy warnings under an EGD heading
       would be the exact failure the pairing exists to prevent — and the set
       and the page are now one document, so there is nothing between them to
       fall out of step. */
    const warnings = page.getByTestId('encv--section-warnings');
    await expect(warnings).toContainText('coffee grounds');
    await expect(warnings).not.toContainText('per rectum');

    /* The answer survives the repaint it causes: changing the set redraws the
       whole step, including the control that was just answered. */
    await expect(page.getByTestId('encv--sheet-set-select').locator('select')).toHaveValue(
      'Post-EGD — standard'
    );
  });

  test('the anticoagulant is not on the sheet, and neither is a restart date', async ({ page }) => {
    await openSheet(page);

    /* The block quoted what the bay had recorded and asked for the day the
       drug restarts — which is a prescribing decision made against the
       bleeding risk of what was actually done, not a line typed into a handout
       at the counter. Off the sheet entirely: a date printed here was also the
       one instruction on the page no order, no medication list and no letter
       ever knew had been given. What the patient still leaves with is the
       endoscopist's own words for them, in Additional instructions. */
    await expect(page.getByTestId('encv--section-anticoagulant')).toHaveCount(0);
    await expect(page.getByTestId('encv--sheet-resume')).toHaveCount(0);

    /* And with it, the one thing this document was ever outstanding for. The
       handout is read rather than answered, so it is complete once it has been
       opened — which is an honest account of going through a printed sheet. */
    await expect(page.locator('#docHint')).toHaveAttribute('data-tone', 'ready');
  });

  test('the impression is pulled from the report rather than retyped', async ({ page }) => {
    await openProcedure(page);
    await openSubstep(page, 'procedure-report');
    const impression = 'Two sigmoid polyps removed. Surveillance colonoscopy in 3 years.';
    const box = page.getByTestId('encv--df-impression').locator('textarea');
    await box.fill(impression);
    /* Settled before leaving the step. The report's answers reach its store
       through a listener delegated to #docBody, so a substep pressed in the same
       tick as the last keystroke can arrive at the sheet before the impression
       does — and the button there reads the store, not the box. */
    await expect(box).toHaveValue(impression);

    await openSubstep(page, 'discharge');
    await page.getByTestId('encv--sheet-impression').click();
    await expect(page.getByTestId('encv--sheet-notes').locator('textarea')).toHaveValue(
      /Two sigmoid polyps/
    );
  });

  test('additional instructions are one box, and it is the one beside the impression', async ({
    page,
  }) => {
    const clean = failOnConsoleErrors(page);
    await openSheet(page);

    await page.getByTestId('encv--sheet-notes').locator('textarea').fill('No aspirin for 7 days.');
    await page.getByTestId('encv--sheet-save').click();

    /* It used to be two controls writing to one key — this one, and a field of
       the same name on the record's Discharge Instructions card — inches apart
       on one run, and the one further from the sheet had no way to pull the
       impression in. The record is the sheet now, so there is one box, and it
       survives leaving the step and coming back. */
    await openCheckout(page);
    await expect(page.getByTestId('encv--sheet-notes')).toHaveCount(0);

    await reopenSheet(page);
    await expect(page.getByTestId('encv--sheet-notes').locator('textarea')).toHaveValue(
      'No aspirin for 7 days.'
    );
    clean();
  });
});

/* ============================================================================
   THE DESK
   ========================================================================= */

test.describe('check-out', () => {
  test('it opens by saying who this is', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* The desk is the one step in the run worked by somebody who was never in
       the room — they meet the patient at the counter, minutes after sedation,
       and every other document on the run is opened by somebody who already
       knows who is in front of them. The name was in the left rail, which is
       the shell around the document rather than the document. */
    const overview = page.getByTestId('encv--patient-overview');
    await expect(overview).toContainText('MRN');
    await expect(overview).toContainText('Colonoscopy');
    /* Quoted from the booking and the chart, never asked: a counter that could
       type over any of these could file a check-out against a different
       patient from the one the encounter is about. */
    await expect(overview.locator('input, select, textarea')).toHaveCount(0);
    clean();
  });

  test('the readiness assessment is the act, not the practice’s list of criteria', async ({
    page,
  }) => {
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* "Discharge Criteria" named the LIST. This card is the desk working down
       it against the patient in front of them and un-ticking what is no longer
       true, which is a different thing and now says so. */
    await expect(page.getByTestId('encv--section-criteria')).toContainText(
      'Discharge Readiness Assessment'
    );
  });

  test('and it records when the sheet was gone through and when they left', async ({ page }) => {
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* A DATE as well as a clock reading, because it is not always today: the
       instructions for a patient kept for observation are gone through the
       following morning, and a bare time filed under yesterday's encounter
       says the wrong day without ever looking wrong. */
    await expect(
      page.getByTestId('encv--df-instructionsGivenAt').locator('input')
    ).toHaveAttribute('type', 'datetime-local');

    /* The discharge time is a clock reading on a day the encounter already
       names — and it is the one answer on the card that is different for every
       patient, which is why it has a Now beside it. */
    await page.getByTestId('encv--dfnow-dischargeTime').click();
    await expect(page.getByTestId('encv--df-dischargeTime').locator('input')).toHaveValue(
      /^\d{2}:\d{2}$/
    );
  });

  test('neither of the two new answers is swept into the card’s default', async ({ page }) => {
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* A list of twelve colonoscopies goes home, by car, with a responsible
       adult, under the same UB-04 code, all day — which is what the pair on
       this card is for. A time and a moment are this patient's alone, and a
       Set that swept them up would press one patient's discharge time onto the
       next twelve. */
    await page.getByTestId('encv--df-dischargeTime').locator('input').fill('14:05');
    await page.getByTestId('encv--set-default-discharge-details').click();

    await page.getByTestId('encv--df-dischargeTime').locator('input').fill('16:40');
    await page.getByTestId('encv--use-default-discharge-details').click();

    await expect(page.getByTestId('encv--df-dischargeTime').locator('input')).toHaveValue('16:40');
    await expect(page.getByTestId('encv--df-destination').locator('select')).toHaveValue('Home');
  });

  test('it is three cards and a pad: who they are, whether they may go, where they went', async ({
    page,
  }) => {
    const clean = failOnConsoleErrors(page);
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* The criteria open as the state of the patient as recovery last recorded
       it, so the counter's job is to un-tick what is no longer true rather than
       to re-assess a discharge somebody else made. */
    await expect(page.getByTestId('encv--dc-vitals')).toBeChecked();
    await expect(page.getByTestId('encv--dc-transport')).toBeChecked();

    /* The Aldrete line is answered from step 2's score against the threshold.
       A desk that could tick it by hand could release a patient scoring 6. */
    await expect(page.getByTestId('encv--dc-aldrete')).toBeDisabled();

    /* Discharge Details used to be seeded from the nurse's record, which asked
       the same questions first. Nothing asks them first any more, so the card
       opens on its own spec defaults — and the escort's name, the one fact no
       default can hold, opens blank. */
    await expect(page.getByTestId('encv--df-destination').locator('select')).toHaveValue('Home');
    await expect(page.getByTestId('encv--df-status').locator('select')).toHaveValue(
      '01 — Discharged home / self-care'
    );
    await expect(page.getByTestId('encv--df-accompaniedBy').locator('input')).toHaveValue('');
    clean();
  });

  test('nothing is released until somebody signs for it', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* Every required answer on the two cards above arrives pre-filled from the
       practice's own defaults, so the pad is the only thing standing between
       opening the step and closing the visit. Without it the appointment moved
       the instant the desk clicked the rail, with nobody having looked at it. */
    await expect(page.locator('#docHint')).toContainText('1 still to answer');
    await expect(page.locator('#docHint')).toContainText('Discharging staff signature');

    const status = await page.evaluate(async () => {
      const store = await import('/data/appointment-store.js');
      return store.findAppointment('ap29')?.status;
    });
    expect(status).not.toBe('Check Out');
    clean();
  });

  test('signing it closes the visit and says the encounter stays open', async ({ page }) => {
    await page.goto(PROCEDURE);
    await openCheckout(page);

    /* No commit button: the mark IS the filing, and the foot says what that did
       at the moment nothing is left outstanding. See paintDocFoot. */
    await signAsDischargingStaff(page);

    await expect(page.locator('#docHint')).toContainText('appointment set to Check Out');
    /* The half a front desk that reads "complete" and stops chasing pathology
       would miss. Step 7 is where the encounter actually closes. */
    await expect(page.locator('#docHint')).toContainText('encounter stays open');

    const status = await page.evaluate(async () => {
      const store = await import('/data/appointment-store.js');
      return store.findAppointment('ap29')?.status;
    });
    expect(status).toBe('Check Out');
  });
});

/* ============================================================================
   ACCESSIBILITY
   ========================================================================= */

test.describe('@a11y', () => {
  /* Both at once rather than two tests: they are the same column with different
     markup in it, and axe's cost is in the page load, not the run. */
  test('the discharge sheet and the desk are clean', async ({ page }) => {
    await openProcedure(page);
    for (const id of ['orders', 'discharge']) {
      await openSubstep(page, id);
      /* Scoped to the working column. The rail and the clinical picture beside
         it are somebody else's tests, and including them here would make this
         one fail for a reason it is not about. */
      await expectNoA11yViolations(page, '.encv__main');
    }

    await openCheckout(page);
    await expectNoA11yViolations(page, '.encv__main');
  });
});
