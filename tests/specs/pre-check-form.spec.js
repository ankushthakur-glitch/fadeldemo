/**
 * The pre-procedure sheet, driven the way a nurse drives it.
 *
 * Its rules are proved without a DOM in pre-check-rules.spec.js. This file is
 * about the sheet as a thing on screen: that every section is there, that a
 * binary answers ONE way, that what a Yes reveals actually appears — and,
 * specifically, that it appears in the right place.
 *
 * The sheet lives inside the encounter's step 1, the pre-procedure checklist,
 * which is its only host. So every test opens it the way the room does.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

const PROCEDURE = '/screens/encounter.html?appt=ap28';

async function openSheet(page) {
  await page.goto(PROCEDURE);
  /* Step 1 is where the encounter opens anyway, but the click is left in: it
     is the reader's own route to the sheet, and a test that relies on the
     landing step would go quiet the day the run opens somewhere else. */
  await page.getByTestId('encv--step-checklist').click();
  await expect(page.getByTestId('pck--verify')).toBeVisible();
}

/** The label is the click target; the input under it carries the testid. */
const radio = (page, id) => page.getByTestId(id);
const select = (page, id) => page.getByTestId(id).locator('select');

/* ============================================================================
   THE SECTIONS
   ========================================================================= */

const SECTIONS = [
  ['arrival', 'Patient Arrival'],
  ['verification', 'Patient Verification'],
  ['sedation', 'History of problems with sedation'],
  ['conditions', 'Medical Conditions'],
  ['weight-loss', 'Weight Loss Medication'],
  ['anticoagulant', 'Anticoagulant'],
  ['allergies', 'Allergies'],
  ['procedure', 'Procedure Information'],
  ['notes', 'Additional Notes'],
  ['signoff', 'Staff Initials'],
];

test.describe('pre-procedure sheet — the shape of it', () => {
  test('every section is present, in the order the room works them', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openSheet(page);

    for (const [id, title] of SECTIONS) {
      await expect(page.getByTestId(`pck--section-${id}`)).toBeVisible();
      await expect(page.getByTestId(`pck--section-title-${id}`)).toContainText(title);
    }

    assertClean();
  });

  /* The sheet is one continuous document now — no rail, no folding. Every
     section is on screen from the moment it opens, which is what makes it
     readable back over as a single record. */
  test('every section is open from the start, and nothing folds it away', async ({ page }) => {
    await openSheet(page);

    await expect(page.getByTestId('pck--rail')).toHaveCount(0);
    await expect(page.locator('.pck__legend-toggle')).toHaveCount(0);

    // A field from the middle of the sheet and one from the end, both on
    // screen without touching anything.
    await expect(page.getByTestId('pck--dentures')).toBeVisible();
    await expect(page.getByTestId('pck--staff-initials')).toBeVisible();
  });
});

/* ============================================================================
   BINARIES

   Every yes/no on the sheet was a PAIR OF CHECKBOXES, which is a shape that
   can say both and can say neither. They are radios now. Each row below is
   toggled to both values, and the exact set of fields the answer reveals is
   asserted present on one side and absent on the other.
   ========================================================================= */

const BINARIES = [
  ['pck--diabetes', 'yes', 'no', ['pck--blood-sugar']],
  ['pck--weight-loss', 'yes', 'no', ['pck--weight-loss-type']],
  ['pck--anticoagulant', 'taking-anticoagulant', 'no-anticoagulant',
    ['pck--anticoagulant-type', 'pck--anticoagulant-date']],
];

test.describe('pre-procedure sheet — binaries reveal what they claim to', () => {
  for (const [group, on, off, revealed] of BINARIES) {
    test(`${group} → ${on} reveals ${revealed.length} field(s)`, async ({ page }) => {
      await openSheet(page);

      await radio(page, `${group}-${off}`).check();
      for (const id of revealed) {
        await expect(page.getByTestId(id), `${id} must be absent while ${off}`).toHaveCount(0);
      }

      await radio(page, `${group}-${on}`).check();
      for (const id of revealed) {
        await expect(page.getByTestId(id), `${id} must appear when ${on}`).toBeVisible();
      }
    });
  }

  /* "if known" is the whole point of the blood sugar: it is offered, never
     demanded. A sheet that held the room open waiting for a number nobody
     took would be a worse sheet than one that records it was not known. */
  test('the blood sugar is offered, not demanded', async ({ page }) => {
    await openSheet(page);

    await radio(page, 'pck--diabetes-yes').check();
    const box = page.getByTestId('pck--blood-sugar').locator('input');
    await box.fill('');
    await box.blur();

    await expect(page.getByTestId('pck--blood-sugar')).toBeVisible();
    /* The foot names what is still to answer. A blood sugar nobody took must
       not be on that list — asserting on the hint's TEXT rather than on a count
       is what makes this test fail loudly if the field ever becomes required
       under a different name. */
    await expect(page.getByTestId('encv--doc-hint')).not.toContainText('Blood Sugar');
  });

  /* It renders inside the Diabetes cell — a bare number in the column beside
     AICD is a reading with no visible subject. */
  test('the blood sugar sits in the cell that asked for it', async ({ page }) => {
    await openSheet(page);
    await radio(page, 'pck--diabetes-yes').check();

    const placement = await page.evaluate(() => {
      const trigger = document.querySelector('[data-testid="pck--diabetes"]');
      const revealed = document.querySelector('[data-testid="pck--blood-sugar"]');
      return Boolean(revealed) && trigger.closest('.pck__cell').contains(revealed);
    });
    expect(placement).toBe(true);
  });
});

test.describe('pre-procedure sheet — a binary answers once', () => {
  /**
   * The defect this replaced: checkbox-diabetes-no and checkbox-diabetes-yes
   * could both be ticked. A radio group cannot hold that state, and this is
   * the assertion that it is genuinely a group rather than two radios that
   * happen to look alike.
   */
  test('Diabetes and AICD cannot say both No and Yes', async ({ page }) => {
    await openSheet(page);

    for (const group of ['pck--diabetes', 'pck--aicd']) {
      await radio(page, `${group}-yes`).check();
      await expect(radio(page, `${group}-yes`)).toBeChecked();
      await expect(radio(page, `${group}-no`)).not.toBeChecked();

      await radio(page, `${group}-no`).check();
      await expect(radio(page, `${group}-no`)).toBeChecked();
      await expect(radio(page, `${group}-yes`)).not.toBeChecked();
    }
  });

  /* One tab stop and arrow keys, from real radios sharing a name rather than
     from anything we wrote. */
  test('a group is one tab stop, and arrows move within it', async ({ page }) => {
    await openSheet(page);

    await radio(page, 'pck--diabetes-no').check();
    await radio(page, 'pck--diabetes-no').focus();
    await page.keyboard.press('ArrowDown');

    await expect(radio(page, 'pck--diabetes-yes')).toBeChecked();
    await expect(radio(page, 'pck--diabetes-no')).not.toBeChecked();
  });

  /* NPO was two boxes and both could be ticked — a fasting status that says
     two things at once. */
  test('NPO standard and Other are one answer', async ({ page }) => {
    await openSheet(page);

    await radio(page, 'pck--npo-other').check();
    await expect(radio(page, 'pck--npo-standard')).not.toBeChecked();
    await expect(page.getByTestId('pck--npo-other-text')).toBeVisible();

    await radio(page, 'pck--npo-standard').check();
    await expect(radio(page, 'pck--npo-other')).not.toBeChecked();
    await expect(page.getByTestId('pck--npo-other-text')).toHaveCount(0);
  });
});

/* ============================================================================
   WHERE A REVEALED FIELD LANDS

   The defect worth its own test: "Specify other anticoagulant" used to render
   in the left column while the select that asked for it sat in the right — a
   question with no visible subject, and an answer typed into it that means
   nothing.
   ========================================================================= */

/**
 * Every list with an Other is typed into IN PLACE.
 *
 * Picking Other used to open a second field underneath — "Specify other
 * anticoagulant" below the type, "Other Result" below the result — so a
 * question the list could not answer was answered somewhere else on the form.
 * The select becomes the text box instead, and no companion field exists at
 * all: the answer is typed where the question was asked.
 *
 * `pck--<name>-other` is the id the companion field used to carry. It is
 * asserted ABSENT here, which is the whole point — if one of these ever comes
 * back as a separate control, these tests say so.
 *
 * Sedation history is deliberately NOT in this list. It asks for a sentence
 * about an event rather than the name of a thing, so losing "Other" off the
 * screen while the sentence is typed costs the answer its subject. It keeps
 * its list and opens a box underneath — covered by its own test below.
 */
const OTHER_FIELDS = [
  ['pck--anticoagulant-type', 'Other', 'pck--anticoagulant-other', 'Enter the anticoagulant name'],
  ['pck--preparation', 'Other', 'pck--colon-prep-other', 'Enter preparation type'],
  ['pck--colon-prep-results', 'other', 'pck--colon-prep-results-other', 'Describe the effluent'],
  ['pck--weight-loss-type', 'Other', 'pck--weight-loss-other', 'Enter medication name'],
];

test.describe('pre-procedure sheet — Other is typed into the field that asked', () => {
  for (const [id, otherValue, companion, placeholder] of OTHER_FIELDS) {
    test(`${id} swaps its list for a text box`, async ({ page }) => {
      await openSheet(page);
      const control = page.getByTestId(id);
      await control.scrollIntoViewIfNeeded();

      // A list to begin with, and no companion field anywhere on the sheet.
      await expect(control.locator('select')).toHaveCount(1);
      await expect(control.locator('input')).toHaveCount(0);
      await expect(page.getByTestId(companion)).toHaveCount(0);

      await control.locator('select').selectOption(otherValue);

      // The SAME element is now the text box. Still no second field.
      await expect(control.locator('input')).toHaveCount(1);
      await expect(control.locator('select')).toHaveCount(0);
      await expect(control.locator('input')).toHaveAttribute('placeholder', placeholder);
      await expect(page.getByTestId(companion)).toHaveCount(0);

      // What is typed survives the commit.
      await control.locator('input').fill('Something not on the list');
      await control.locator('input').blur();
      await expect(page.getByTestId(id).locator('input')).toHaveValue(
        'Something not on the list'
      );
    });
  }

  /**
   * Sedation history is the one Other that DOES open a box of its own.
   *
   * The rest of the sheet names a thing — a drug, a prep — so the typed name
   * reads as the answer on its own. This one asks for a sentence about an
   * event, and swapping the list out for a text box took "Other" off screen
   * with it: a half-filled sheet showed an empty box under the heading with
   * nothing saying which option it belonged to. The list stays, and the box
   * opens underneath it, INSIDE the same cell.
   */
  test('pck--sedation-history keeps its list and opens a box underneath', async ({ page }) => {
    await openSheet(page);
    const control = page.getByTestId('pck--sedation-history');
    await control.scrollIntoViewIfNeeded();

    await expect(control.locator('select')).toHaveCount(1);
    await expect(page.getByTestId('pck--sedation-other')).toHaveCount(0);

    await control.locator('select').selectOption('other');

    // The list is still a list, and still reads as the answer that was given.
    await expect(page.getByTestId('pck--sedation-history').locator('select'))
      .toHaveValue('other');

    // The companion sits in the same grid cell as the question that opened it.
    const other = page.getByTestId('pck--sedation-other');
    await expect(other).toHaveCount(1);
    await expect(other.locator('input')).toHaveAttribute(
      'placeholder', 'What happened last time?'
    );
    await expect(
      page.getByTestId('pck--sedation-history').locator('..')
    ).toContainText('Specify other sedation history');

    await other.locator('input').fill('Woke mid-procedure and was hard to settle');
    await other.locator('input').blur();
    await expect(page.getByTestId('pck--sedation-other').locator('input'))
      .toHaveValue('Woke mid-procedure and was hard to settle');

    // Stepping back onto a listed answer takes the box away again.
    await page.getByTestId('pck--sedation-history').locator('select').selectOption('none');
    await expect(page.getByTestId('pck--sedation-other')).toHaveCount(0);
  });

  /**
   * The way back, and why it clears the text.
   *
   * The typed name belonged to the option that has just been given up. Leaving
   * it behind is how a sheet ends up reading "Eliquis" with "warfarin sodium"
   * still stored beside it.
   */
  test('the caret goes back to the list and takes the typed answer with it', async ({ page }) => {
    await openSheet(page);
    const control = page.getByTestId('pck--anticoagulant-type');
    await control.scrollIntoViewIfNeeded();

    await control.locator('select').selectOption('Other');
    await control.locator('input').fill('Warfarin sodium');
    await control.locator('input').blur();

    await page.getByTestId('pck--anticoagulant-type')
      .locator('[data-ui-select="toList"]').click();

    const back = page.getByTestId('pck--anticoagulant-type');
    await expect(back.locator('select')).toHaveCount(1);
    await expect(back.locator('select')).toHaveValue('');

    // And picking Other again starts empty rather than remembering it.
    await back.locator('select').selectOption('Other');
    await expect(page.getByTestId('pck--anticoagulant-type').locator('input')).toHaveValue('');
  });

  /* Stepping off Other and straight onto a listed drug drops the typed name
     too — the same contradiction by a different route. */
  test('choosing a listed option clears what was typed for Other', async ({ page }) => {
    await openSheet(page);
    const control = page.getByTestId('pck--anticoagulant-type');
    await control.scrollIntoViewIfNeeded();

    await control.locator('select').selectOption('Other');
    await control.locator('input').fill('Warfarin sodium');
    await control.locator('input').blur();

    await page.getByTestId('pck--anticoagulant-type')
      .locator('[data-ui-select="toList"]').click();
    await page.getByTestId('pck--anticoagulant-type')
      .locator('select').selectOption('Eliquis (Apixaban)');

    await page.getByTestId('pck--anticoagulant-type')
      .locator('select').selectOption('Other');
    await expect(page.getByTestId('pck--anticoagulant-type').locator('input')).toHaveValue('');
  });
});

/* ============================================================================
   ALLERGIES
   ========================================================================= */

test.describe('pre-procedure sheet — NKDA means none', () => {
  /**
   * The defect: NKDA could be ticked alongside Soy, Egg and a typed allergen,
   * so one sheet could say both "no known drug allergies" and "anaphylaxis to
   * amoxicillin".
   */
  test('ticking NKDA clears and locks the allergens', async ({ page }) => {
    await openSheet(page);

    /* The seed opens with NKDA ticked, so the allergens start locked — which
       is the state this test exists to protect. Untick it to get at them. */
    await expect(page.getByTestId('pck--allergy-soy')).toHaveAttribute('disabled', /.*/);
    await page.getByTestId('pck--allergy-nkda').locator('label').click();

    await page.getByTestId('pck--allergy-soy').locator('label').click();
    await expect(page.getByTestId('pck--allergy-nkda')).not.toHaveAttribute('checked', /.*/);

    // Ticking NKDA again clears the allergen and locks the boxes behind it.
    await page.getByTestId('pck--allergy-nkda').locator('label').click();
    await expect(page.getByTestId('pck--allergy-soy')).not.toHaveAttribute('checked', /.*/);
    await expect(page.getByTestId('pck--allergy-soy')).toHaveAttribute('disabled', /.*/);
    await expect(page.getByTestId('pck--allergy-egg')).toHaveAttribute('disabled', /.*/);
  });

});

/* ============================================================================
   TIME IN ROOM
   ========================================================================= */

test.describe('pre-procedure sheet — the arrival stamp', () => {
  test('a correction is recorded with who made it', async ({ page }) => {
    await openSheet(page);

    // The pencil only exists once a time does.
    await expect(page.getByTestId('pck--edit-time-in-room')).toBeVisible();
    await page.getByTestId('pck--edit-time-in-room').click();

    await page.getByTestId('pck--time-in-room-input').locator('input').fill('08:15');
    await page.getByTestId('pck--time-in-room-save').locator('button').click();

    await expect(page.getByTestId('pck--time-in-room-value')).toContainText('8:15');
    await expect(page.getByTestId('pck--time-in-room-audit')).toContainText('Corrected from');
    await expect(page.getByTestId('pck--time-in-room-audit')).toContainText('Kayla Brandt, RN');
  });
});

/* ============================================================================
   THE BAY'S COPY

   The sheet has two modes. The room gets it without the template and PDF
   actions (the encounter has its own commit bar); the bay gets the lot. Only
   the first is wired into a screen today, so this mounts the second directly —
   otherwise Set Default, Use Default and the commit bar ship untested.
   ========================================================================= */

async function mountStandalone(page) {
  await page.goto('/gallery.html');
  await page.evaluate(async () => {
    const { preCheckSheetMarkup, mountPreCheckSheet } = await import(
      '/js/lib/pre-check-form.js'
    );
    const host = document.createElement('div');
    host.id = 'standalone-sheet';
    document.body.append(host);
    host.innerHTML = preCheckSheetMarkup({ actions: true });
    window.__sheet = mountPreCheckSheet({ root: host, appointment: null });
  });
  await expect(page.getByTestId('pck--verify')).toBeVisible();
}

/** Set Default asks before it writes; every caller has to answer the dialog. */
async function saveDefault(page) {
  await page.getByTestId('pck--set-default').locator('button').click();
  await page.getByTestId('pck--set-default-confirm').locator('button').click();
}

test.describe('pre-procedure sheet — Set Default and Use Default', () => {
  test('the commit bar reflects the gate', async ({ page }) => {
    await mountStandalone(page);

    // The seed answers everything, so the sheet opens signable.
    await expect(page.getByTestId('pck--sticky')).toContainText('Every line');
    await expect(page.getByTestId('pck--submit')).not.toHaveAttribute('disabled', /.*/);

    /* Clearing a required answer shuts it again. NPO is the one to use: it is
       required, and "Other" with nothing typed is exactly the half-answer the
       gate exists to catch. */
    await radio(page, 'pck--npo-other').check();
    await expect(page.getByTestId('pck--submit')).toHaveAttribute('disabled', /.*/);
    await expect(page.getByTestId('pck--sticky')).toContainText('outstanding');
  });

  /**
   * The semantics worth protecting: Use Default fills blanks, and asks before
   * it touches an answer someone has already given. A template that silently
   * replaced a typed blood sugar would be worse than no template at all.
   */
  test('Use Default asks before overwriting an answer already given', async ({ page }) => {
    await mountStandalone(page);

    await saveDefault(page);

    // Change something the template now disagrees with.
    const before = await select(page, 'pck--dentures').inputValue();
    const changed = before === 'Full' ? 'Upper' : 'Full';
    await select(page, 'pck--dentures').selectOption(changed);
    await page.getByTestId('pck--use-default').locator('button').click();

    await expect(page.getByTestId('pck--overwrite-modal')).toContainText('already have an answer');

    // Keeping what is there leaves the edit alone.
    await page.getByTestId('pck--overwrite-cancel').locator('button').click();
    await expect(select(page, 'pck--dentures')).toHaveValue(changed);

    // Asking again and confirming puts the template's answer back.
    await page.getByTestId('pck--use-default').locator('button').click();
    await page.getByTestId('pck--overwrite-confirm').locator('button').click();
    await expect(select(page, 'pck--dentures')).toHaveValue(before);
  });

  test('Set Default never stores the arrival time', async ({ page }) => {
    await mountStandalone(page);
    await saveDefault(page);

    const stored = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('medinova.precheck.default'))
    );

    expect(stored.timeInRoom, 'a pre-filled arrival time is a lie').toBe('');
    expect(stored.notes).toBe('');
    expect(stored.completedAt).toBe('');
  });

  /**
   * Set Default rewrites the template every sheet after this one starts from,
   * for everybody in the practice. It sits next to Use Default and looks
   * identical, so it has to ask — and cancelling has to leave the stored
   * template alone rather than saving it anyway.
   */
  test('Set Default asks first, and cancelling saves nothing', async ({ page }) => {
    await mountStandalone(page);

    await page.getByTestId('pck--set-default').locator('button').click();
    await expect(page.getByTestId('pck--set-default-modal')).toContainText(
      'template every pre-procedure checklist opens from'
    );

    await page.getByTestId('pck--set-default-cancel').locator('button').click();
    expect(
      await page.evaluate(() => sessionStorage.getItem('medinova.precheck.default')),
      'cancelling must not write the template'
    ).toBeNull();

    // And confirming does.
    await saveDefault(page);
    expect(
      await page.evaluate(() => sessionStorage.getItem('medinova.precheck.default'))
    ).not.toBeNull();
  });

  /**
   * The dialogs belong to the default PAIR, not to the sheet's own footer.
   * Mounted with `actions: false` — which is how the encounter mounts it, with
   * the buttons in its own toolbar — Use Default used to reach for a modal
   * that had never been rendered and throw, which looked exactly like a button
   * that does nothing.
   */
  test('the default dialogs are rendered even when the sheet has no footer', async ({ page }) => {
    await page.goto('/gallery.html');
    await page.evaluate(async () => {
      const { preCheckSheetMarkup } = await import('/js/lib/pre-check-form.js');
      const host = document.createElement('div');
      host.innerHTML = preCheckSheetMarkup({ actions: false });
      document.body.append(host);
    });

    await expect(page.getByTestId('pck--overwrite-modal')).toHaveCount(1);
    await expect(page.getByTestId('pck--set-default-modal')).toHaveCount(1);
    await expect(page.getByTestId('pck--preview-modal')).toHaveCount(1);
    await expect(page.getByTestId('pck--sticky')).toHaveCount(0);
  });
});

/* ============================================================================
   PREVIEW DEFAULT

   Use Default lands a template nobody in the room has seen. These are the two
   things that make the preview worth having rather than decorative: it says
   what the template holds in the sheet's own words, and it says what the press
   would do to THIS sheet — and the number it gives has to be the number the
   overwrite dialog then gives, or the preview is a second opinion rather than
   a preview.
   ========================================================================= */

test.describe('pre-procedure sheet — Preview Default', () => {
  test('the preview reads the template out and changes nothing', async ({ page }) => {
    await mountStandalone(page);
    await saveDefault(page);

    /* Save the sheet as the template, then disagree with it in one place. The
       preview must show that one line as a clash and every other line as
       already answered — and must not put the template's answer back. */
    const before = await select(page, 'pck--dentures').inputValue();
    const changed = before === 'Full' ? 'Upper' : 'Full';
    await select(page, 'pck--dentures').selectOption(changed);

    await page.getByTestId('pck--preview-default').locator('button').click();

    const row = page.getByTestId('pck--preview-row-dentures');
    await expect(row).toContainText(before);
    await expect(row).toHaveAttribute('data-status', 'differs');
    await expect(page.getByTestId('pck--preview-summary')).toContainText('1 differs');

    await page.getByTestId('pck--preview-close').locator('button').click();
    await expect(select(page, 'pck--dentures')).toHaveValue(changed);
  });

  /**
   * A blanked answer is the case the preview exists for — it is the one where
   * Use Default is worth pressing, and the row has to say so rather than
   * leaving the reader to work out which lines are the empty ones.
   */
  test('a blank on the sheet is marked as one the template would fill', async ({ page }) => {
    await mountStandalone(page);
    await saveDefault(page);

    /* Blanked through the mounted sheet rather than through the control: a
       select's empty row is its placeholder, drawn disabled and hidden, so
       there is no click that empties one. The sheet is the same object the
       preview reads, which is the part being tested. */
    await page.evaluate(() => {
      window.__sheet.state.dentures = '';
      window.__sheet.refresh();
    });

    await page.getByTestId('pck--preview-default').locator('button').click();

    await expect(page.getByTestId('pck--preview-row-dentures')).toHaveAttribute(
      'data-status',
      'fills'
    );
    await expect(page.getByTestId('pck--preview-summary')).toContainText('1 would fill a blank');
  });

  /**
   * Reading the template and taking it is one gesture. The press from inside
   * the dialog has to be the SAME press — the clash dialog still asks, and
   * confirming it still writes.
   */
  test('Use these answers applies the template, asking first', async ({ page }) => {
    await mountStandalone(page);
    await saveDefault(page);

    const before = await select(page, 'pck--dentures').inputValue();
    const changed = before === 'Full' ? 'Upper' : 'Full';
    await select(page, 'pck--dentures').selectOption(changed);

    await page.getByTestId('pck--preview-default').locator('button').click();
    await page.getByTestId('pck--preview-apply').locator('button').click();

    /* The same clash the preview counted, counted the same way — over the
       questions the sheet asks rather than every key the stored default
       carries, which is what used to make these two numbers disagree. */
    await expect(page.getByTestId('pck--overwrite-modal')).toContainText('1 field on this sheet');

    await page.getByTestId('pck--overwrite-confirm').locator('button').click();
    await expect(select(page, 'pck--dentures')).toHaveValue(before);
  });
});

/* ============================================================================
   THE TWO QUESTIONS THAT CHANGED SHAPE

   Diabetes gained the follow-up that decides what to do about a blood sugar,
   and the IV quick-selects stopped being one answer each.
   ========================================================================= */

test.describe('pre-procedure sheet — insulin and IV access', () => {
  test('a diabetic on insulin is asked what to do with the pump', async ({ page }) => {
    await openSheet(page);

    /* The seeded sheet is a Type 2 diabetic already, so the box is on screen.
       Which insulin and when the last dose was are off the form; what is left
       under the box is the pump decision. Untick it and that goes with it —
       it is the second half of the question above it, not a question of its
       own. */
    const box = page.getByTestId('pck--taking-insulin').locator('input');
    await expect(box).toBeChecked();
    await expect(page.getByTestId('pck--pump-action')).toBeVisible();

    await page.getByTestId('pck--taking-insulin').click();
    await expect(page.getByTestId('pck--pump-action')).toHaveCount(0);

    await page.getByTestId('pck--taking-insulin').click();
    await expect(page.getByTestId('pck--pump-action')).toBeVisible();
  });

  test('the IV quick-selects take more than one answer each', async ({ page }) => {
    await openSheet(page);

    await page.getByTestId('pck--iv-clear').click();
    await page.getByTestId('pck--gauge-20g').click();
    await page.getByTestId('pck--gauge-22g').click();
    await page.getByTestId('pck--site-left-hand').click();
    await page.getByTestId('pck--site-right-ac').click();
    await page.getByTestId('pck--trials-2-trials').click();

    /* Both gauges and both sites survive — a patient stuck twice has two of
       each, and the attempt that failed is the one anaesthesia wants. */
    await expect(page.getByTestId('pck--gauge-20g')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pck--gauge-22g')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pck--iv-details').locator('input')).toHaveValue(
      '20G / 22G Left Hand, Right AC - 2 trials'
    );

    // A second press on a chip takes that answer back off.
    await page.getByTestId('pck--gauge-20g').click();
    await expect(page.getByTestId('pck--iv-details').locator('input')).toHaveValue(
      '22G Left Hand, Right AC - 2 trials'
    );
  });
});


/* ============================================================================
   FILING IT

   "Update checklist" is the encounter's own commit over the sheet. What it has
   to do is stamp the sheet with WHO closed it and WHEN, and then put the nurse
   on the step they work next — which is Intra-procedure Management, not the
   CRNA's pre-anaesthesia assessment.
   ========================================================================= */

/** Sign in as the demo account, so the stamp has a session to name. */
async function signIn(page) {
  await page.goto('/screens/login.html');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await expect(page).not.toHaveURL(/login\.html/);
}

test.describe('pre-procedure sheet — filing it', () => {
  test('the stamp names whoever is signed in, before it is filed', async ({ page }) => {
    await signIn(page);
    await openSheet(page);

    const stamp = page.getByTestId('pck--staff-initials');
    await expect(stamp).toContainText('Amara Mensah');
    // Their initials, not the fixture nurse's.
    await expect(stamp.locator('strong')).toHaveText('AM');
    // Nothing filed yet, so no completion time.
    await expect(page.getByTestId('pck--completed-at')).toHaveCount(0);
  });

  test('Update checklist stamps the sheet and opens Intra-procedure Management', async ({
    page,
  }) => {
    await signIn(page);
    await openSheet(page);

    await page.getByTestId('encv--checklist-update').locator('button').click();

    // The step the checklist hands the patient to — the same nurse's next
    // document, not the anaesthetist's.
    await expect(page.getByTestId('encv--step-intra')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('encv--step-pre-anaesthesia')).not.toHaveAttribute(
      'aria-current',
      'step'
    );

    // Back on the sheet, it now carries who closed it and when.
    await page.getByTestId('encv--step-checklist').click();
    const stamp = page.getByTestId('pck--staff-initials');
    await expect(stamp).toContainText('Signed by Amara Mensah');
    await expect(page.getByTestId('pck--completed-at')).toContainText(
      /Completed at \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)/
    );
  });

  test('the filed name is the one recorded, not whoever is signed in later', async ({ page }) => {
    await signIn(page);
    await openSheet(page);
    await page.getByTestId('encv--checklist-update').locator('button').click();

    // The next person takes the workstation.
    await page.evaluate(() => {
      const key = 'medinova.auth.v1';
      const state = JSON.parse(localStorage.getItem(key));
      state.session.name = 'Priya Raman';
      state.session.role = 'Nurse';
      localStorage.setItem(key, JSON.stringify(state));
    });

    await page.getByTestId('encv--step-checklist').click();
    await expect(page.getByTestId('pck--staff-initials')).toContainText('Amara Mensah');
  });
});
