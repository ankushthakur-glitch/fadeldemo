/**
 * Step 4, and the two questions it kept asking twice.
 *
 * The Procedure step carries three documents the physician signs — the consent
 * they take, the history and physical they write, the report they dictate — and
 * two things about them had drifted from the rest of the run.
 *
 * WHO SIGNS, AND HOW. All three offered the full three-route pad: draw it,
 * upload a scan of the sheet, or type the name. That is the control the PATIENT
 * needs, and it is not the one the endoscopist does — they are authenticated,
 * the screen already knows their name, and a mark drawn with a mouse three
 * times a case is a picture of a signature rather than one. So the physician's
 * blocks are narrowed to the typed name, filed with the moment it was typed and
 * no image, exactly as the anaesthesia professional's three already are.
 *
 * And the consent's patient block is no longer a pad at all. The patient signed
 * that document at the front desk, before pre-medication, and step 4 shows the
 * filed mark rather than taking a second one from a patient on a trolley — so
 * the only signature this screen collects is the clinician's. The first test
 * asserts both halves: what is quoted, and what is still asked for.
 *
 * WHAT THE DOCUMENT ALREADY KNOWS. The H&P asked for the indication, which was
 * settled when the procedure was booked and read back at check-in — and
 * answered it with one authored sentence on every patient the prototype opened.
 * It is carried off the booking now, and it is still typed over freely, because
 * the reason a patient is on the table today is not always the reason they were
 * put on the list in June.
 *
 * And the pair of default buttons the pre-anaesthesia assessment has: on the
 * exam card over everything, on the assessment card over ASA and sedation and
 * nothing else. The last test is the one that matters — a default that swept up
 * the indication would take one patient's reason for being here and press it
 * onto the next twelve.
 */
import { test, expect } from '@playwright/test';

/* A real procedure booking, so the indication has somewhere to come from —
   ap29 is a colonoscopy whose reason for visit is authored in data/schedule.js.
   An encounter opened with no `appt` falls back to the spec's own value, which
   is the case this file deliberately does not test: it is the demo fallback,
   not the behaviour. */
const PROCEDURE = '/screens/encounter.html?appt=ap29';
const BOOKED_INDICATION = 'K21.9 - Gastro-oesophageal reflux disease without oesophagitis';

/** Everything on this screen is reached from the rail, so that is the route. */
async function openDoc(page, substep) {
  await page.goto(PROCEDURE);
  await page.getByTestId('encv--step-procedure').click();
  await page.getByTestId(`encv--substep-${substep}`).click();
}

/**
 * Pick one row out of a section's box, by the words on it.
 *
 * The panel is drawn by the control itself (js/components/ui-suggest.js), so
 * the rows are ordinary elements inside it: press the box, press the row. The
 * panel closes on the press and the box empties itself, because one answer is
 * one procedure and a case that was four is four passes at the same control.
 */
async function pick(page, sectionId, row) {
  await page.getByTestId(`encv--pick-input-${sectionId}`).locator('input').click();
  await page.locator('.ui-suggest__opt', { hasText: row }).first().click();
}

/**
 * Say what was done by typing it, which is the same act as picking it.
 *
 * No Add: there is nothing to submit to. Enter over a box that matched
 * something takes the match, and Enter over one that matched nothing records
 * what was typed — see the note over mountPicker in js/screens/encounter.js.
 */
async function typePick(page, sectionId, text) {
  const input = page.getByTestId(`encv--pick-input-${sectionId}`).locator('input');
  await input.click();
  await input.pressSequentially(text);
  await input.press('Enter');
}

test.describe('the physician signs by name', () => {
  test('the consent holds one pad, and the patient block is not it', async ({ page }) => {
    await openDoc(page, 'patient-consent');

    /* The patient signed at the desk on the way in. Their block QUOTES that
       mark: no pad to sign on, no Sign again to press, and the line under the
       name saying where it was taken. A second pad here would be a second
       signature on one consent, collected from a pre-medicated patient. */
    const patientBlock = page.getByTestId('encv--sig-patient-patient-sign');
    await expect(patientBlock.locator('ui-signature')).toHaveCount(0);
    await expect(patientBlock.locator('[data-testid^="sig--resign-"]')).toHaveCount(0);
    await expect(patientBlock.locator('[data-testid^="sig--source-"]')).toContainText('check-in');

    /* The one mark the bay takes, from someone already logged in. */
    await expect(
      page.getByTestId('encv--sig-provider-clinician-sign').locator('ui-signature')
    ).toHaveAttribute('methods', 'type');
  });

  test('the consent is the one the desk showed the patient, not a second text', async ({
    page,
  }) => {
    await openDoc(page, 'patient-consent');

    /* The paragraphs are read off data/checkin.js — the document with the
       patient's mark on it — so the physician countersigns the words that were
       actually agreed to. The version is named for the same reason. */
    await expect(page.getByTestId('encv--section-form')).toContainText(
      'I acknowledge that I have been informed of the nature of the endoscopic procedure'
    );
    await expect(page.getByTestId('encv--section-form')).toContainText('v2.0');
  });

  test('so does the physician on the H&P and the endoscopist on the report', async ({ page }) => {
    await openDoc(page, 'pre-op');
    await expect(page.getByTestId('encv--sig-provider-sign').locator('ui-signature')).toHaveAttribute(
      'methods',
      'type'
    );

    await openDoc(page, 'procedure-report');
    await expect(page.getByTestId('encv--sig-provider-sign').locator('ui-signature')).toHaveAttribute(
      'methods',
      'type'
    );
  });

  test('the act has a button on it, and the button is what files the mark', async ({ page }) => {
    await openDoc(page, 'pre-op');
    const block = page.getByTestId('encv--sig-provider-sign');
    const sign = block.locator('[data-typed-file]');

    /* Nothing to file, nothing to press — a button that looks pressable and
       then refuses is the pad saying no without saying why. */
    await block.locator('[data-typed-input]').fill('');
    await expect(sign).toBeDisabled();

    await block.locator('[data-typed-input]').fill('Dr Priya Raman, MD');
    await expect(sign).toBeEnabled();
    await sign.click();
    await expect(block).toContainText('Signed electronically by Dr Priya Raman, MD.');
  });

  test('and clicking away no longer signs on the person’s behalf', async ({ page }) => {
    await openDoc(page, 'pre-op');
    const block = page.getByTestId('encv--sig-provider-sign');

    /* The name is already in the field — the host puts it there — so focus
       leaving used to file it, which turned going to check a spelling into a
       signature. */
    await block.locator('[data-typed-input]').click();
    await page.getByTestId('encv--df-hpi').locator('textarea').click();

    await expect(block).not.toContainText('Signed electronically');
    await expect(block.locator('[data-typed-file]')).toBeVisible();
  });

  test('and what gets filed is a name and a time, with no image under it', async ({ page }) => {
    await openDoc(page, 'pre-op');
    const block = page.getByTestId('encv--sig-provider-sign');

    /* Type Name opens holding whoever is signed in; typing over it is how
       somebody standing in signs as themselves. Enter still finishes it — one
       hand, no reach for the mouse — beside the button that says so. */
    await block.locator('[data-typed-input]').fill('Dr Priya Raman, MD');
    await block.locator('[data-typed-input]').press('Enter');

    await expect(block).toContainText('Signed electronically by Dr Priya Raman, MD.');
    await expect(block.locator('.ui-sign-mark__ink')).toHaveText('Dr Priya Raman');
    await expect(block.locator('.ui-sign-mark__by')).toContainText(
      /\d{4} at \d{1,2}:\d{2} (am|pm)/
    );
    /* A typed attestation dressed up as a drawn mark would be the press wearing
       the pad's clothes — see paintSignatureBlock. */
    await expect(block.locator('img')).toHaveCount(0);
  });
});

test.describe('the pre-op H&P', () => {
  test('opens with the indication the booking already holds', async ({ page }) => {
    await openDoc(page, 'pre-op');
    await expect(page.getByTestId('encv--df-indication').locator('input')).toHaveValue(
      BOOKED_INDICATION
    );
  });

  test('and lets it be typed over, because the reason can change by the bay', async ({ page }) => {
    await openDoc(page, 'pre-op');
    const indication = page.getByTestId('encv--df-indication').locator('input');
    await indication.fill('Rectal bleeding — diagnostic');
    await expect(indication).toHaveValue('Rectal bleeding — diagnostic');
  });

  test('carries the same indication onto the anaesthesia note', async ({ page }) => {
    await page.goto(PROCEDURE);
    await page.getByTestId('encv--step-pre-anaesthesia').click();
    await page.getByTestId('encv--substep-anaes-preop').click();
    await expect(page.getByTestId('encv--df-indication').locator('input')).toHaveValue(
      BOOKED_INDICATION
    );
  });

  test('offers a default on both cards', async ({ page }) => {
    await openDoc(page, 'pre-op');
    await expect(page.getByTestId('encv--set-default-exam')).toBeVisible();
    await expect(page.getByTestId('encv--set-default-indication')).toBeVisible();
  });

  test('but the plan card saves ASA and sedation, never this patient’s indication', async ({
    page,
  }) => {
    await openDoc(page, 'pre-op');
    const asa = page.getByTestId('encv--df-asa').locator('select');
    const indication = page.getByTestId('encv--df-indication').locator('input');

    /* One patient, worked and saved as the session's default. */
    await asa.selectOption({ index: 4 });
    const savedAsa = await asa.inputValue();
    await indication.fill('THIS PATIENT’S REASON');
    await page.getByTestId('encv--set-default-indication').click();

    /* The next patient on the list, with a reason of their own. */
    await asa.selectOption({ index: 1 });
    await indication.fill('THE NEXT PATIENT’S REASON');
    await page.getByTestId('encv--use-default-indication').click();

    await expect(asa).toHaveValue(savedAsa);
    await expect(indication).toHaveValue('THE NEXT PATIENT’S REASON');
  });
});

/* ============================================================================
   THE REPORT

   What the endoscopist dictates is also what the practice claims against, and
   for a while the document could only do the first of those. Five things were
   missing, and each of them was the same omission in a different card: an
   answer recorded in words where the thing downstream of it needs a value.
   ========================================================================= */

test.describe('the procedure report', () => {
  test('every code says what it is claimed as', async ({ page }) => {
    await openDoc(page, 'procedure-report');

    /* "Polypectomy" is three CPT codes depending on how the polyp came off,
       and the coder reading the signed report days later cannot ask. So the
       code the practice bills each act under is on the row that offers it. */
    await page.getByTestId('encv--pick-input-performed').locator('input').click();
    const offered = page.locator('.ui-suggest__opt');
    await expect(offered.filter({ hasText: '45385 Polypectomy' })).toHaveCount(1);

    /* Screening and surveillance are separate rows precisely because they are
       separate codes — an average-risk scope is not claimed as a high-risk one. */
    await expect(offered.filter({ hasText: 'G0121' })).toHaveCount(1);
    await expect(offered.filter({ hasText: 'G0105' })).toHaveCount(1);
    await page.keyboard.press('Escape');

    /* And a modifier without its digits is not a modifier: "Incomplete exam"
       is the endoscopist's phrase for appending -53. */
    await page.getByTestId('encv--pick-input-modifiers').locator('input').click();
    await expect(offered.filter({ hasText: '53 Incomplete exam' })).toHaveCount(1);
  });

  test('what was done is picked, and what is picked is written out', async ({ page }) => {
    await openDoc(page, 'procedure-report');

    /* The card starts as the box and nothing else — a report nobody has begun
       is not a card carrying a sentence about how it has not been begun. */
    await expect(page.getByTestId('encv--pick-performed').locator('li')).toHaveCount(0);

    await pick(page, 'performed', '45385 Polypectomy');
    await pick(page, 'performed', '45380 Biopsy');

    /* Both, in the order the practice's list carries them rather than the
       order they were pressed — this is read as a statement of the case. */
    await expect(page.getByTestId('encv--pick-chosen-performed-45380')).toContainText('Biopsy');
    await expect(page.getByTestId('encv--pick-chosen-performed-45385')).toContainText(
      'Polypectomy'
    );
    /* And taken off again from the line itself, which is where somebody
       rereading the report notices it should not be there. */
    await page.getByTestId('encv--pick-drop-performed-45385').click();
    await expect(page.getByTestId('encv--pick-chosen-performed-45385')).toHaveCount(0);
    await expect(page.getByTestId('encv--pick-chosen-performed-45380')).toBeVisible();
  });

  test('a code the practice’s list does not carry is still what was done', async ({ page }) => {
    await openDoc(page, 'procedure-report');

    /* The whole reason the closed list of boxes had to go. An endoscopist who
       cannot record the twelfth procedure here records it in the indication
       paragraph, where no claim can reach it. */
    await typePick(page, 'performed', '45391 Endoscopic ultrasound');

    const added = page.getByTestId('encv--pick-chosen-performed-typed-45391');
    await expect(added).toContainText('45391');
    await expect(added).toContainText('Endoscopic ultrasound');
    /* Marked as typed, because only one of the two kinds of line on this card
       has already been agreed with a payer. */
    await expect(added).toContainText('Added');

    /* It joins the list rather than sitting beside it, so it can be taken off
       and put back the same way everything else on the card is: the × returns
       it to the box, which offers what is not already on the report. */
    await page.getByTestId('encv--pick-drop-performed-typed-45391').click();
    await page.getByTestId('encv--pick-input-performed').locator('input').click();
    await expect(
      page.locator('.ui-suggest__opt').filter({ hasText: '45391 Endoscopic ultrasound' })
    ).toHaveCount(1);
    await page.keyboard.press('Escape');

    /* A code that IS on the list is not a second procedure. Typing one that is
       there picks the one that is there — one line, one spelling. */
    await typePick(page, 'performed', '45380');
    await expect(page.getByTestId('encv--pick-chosen-performed-45380')).toBeVisible();
    await expect(page.getByTestId('encv--pick-chosen-performed-typed-45380')).toHaveCount(0);
  });

  test('the indication can be coded as well as described', async ({ page }) => {
    await openDoc(page, 'procedure-report');

    /* Searched on the words by the clinician… */
    const search = page.getByTestId('encv--icd-search').locator('input');
    await search.fill('reflux');
    await page.getByTestId('encv--icd-result-K21.9').click();
    await expect(page.getByTestId('encv--icd-attached-K21.9')).toBeVisible();

    /* …and on the code by whoever knows it. Two diagnoses, because an
       indication routinely is two. */
    await search.fill('D50');
    await page.getByTestId('encv--icd-result-D50.9').click();
    await expect(page.getByTestId('encv--icd-attached-D50.9')).toBeVisible();

    /* A code already on the report is not offered a second time — the same ICD
       twice is a coding error rather than two diagnoses. */
    await search.fill('K21');
    await expect(page.getByTestId('encv--icd-result-K21.9')).toHaveCount(0);

    await page.getByTestId('encv--icd-drop-K21.9').click();
    await expect(page.getByTestId('encv--icd-attached-K21.9')).toHaveCount(0);
    await expect(page.getByTestId('encv--icd-attached-D50.9')).toBeVisible();
  });

  test('the repeat interval is chosen in years, not typed in prose', async ({ page }) => {
    await openDoc(page, 'procedure-report');

    /* It was a text box, which collected "3", "3 years", "3/12" and "3 yrs
       (sooner if symptomatic)" — none of which a recall list can act on. */
    const repeat = page.getByTestId('encv--df-recallInterval').locator('select');
    await repeat.selectOption('3');
    await expect(repeat).toHaveValue('3');
  });

  test('and the pictures are attached to the report they belong to', async ({ page }) => {
    await openDoc(page, 'procedure-report');
    await expect(page.getByTestId('encv--photo-count')).toContainText('0 of 50');

    /* A one-pixel PNG is a real image as far as the FileReader is concerned,
       which is all this card does with it — there is no server behind the
       prototype, so what is attached lives as long as the encounter. */
    await page.getByTestId('encv--photo-input').setInputFiles({
      name: 'caecum.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    await expect(page.getByTestId('encv--photo-count')).toContainText('1 of 50');
    await expect(page.getByTestId('encv--df-photos')).toContainText('caecum.png');

    await page.getByTestId('encv--photo-drop-1').click();
    await expect(page.getByTestId('encv--photo-count')).toContainText('0 of 50');
  });
});
