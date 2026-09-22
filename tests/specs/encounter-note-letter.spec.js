/**
 * Post-procedure ▸ Note — the Letter module, folded in.
 *
 * Staging kept correspondence in a Letters screen of its own: a table of Date,
 * Patient, Type, Recipient and Subject, with View, Print, Send, Fax and Delete
 * down every row, and behind View a letter composed on the practice
 * letterhead. It was a second place where a case's letters lived, reachable
 * from outside the encounter that produced them.
 *
 * The module is gone and the work it did is on the Note step. Three things
 * about that are worth a file, because each of them is a decision somebody
 * could reasonably undo by accident:
 *
 *   THE FOUR FIELDS. A note is a letter — recipient, type, subject, content —
 *   and not a type and a free line. Losing any of them puts the register back
 *   to a list of things reportedly sent.
 *
 *   THE DRAFT. Picking the type composes the letter from the case: the
 *   letterhead, the patient, the MRN, the procedure. The whole argument for
 *   folding the module in rather than deleting it is that nobody should be
 *   typing a letterhead, so this asserts the letter arrives written.
 *
 *   RECORDING SENDS IT, AND THE ROW CANNOT BE EDITED AFTERWARDS. Send and Fax
 *   stopped being buttons because filing the note posts it; the pencil went
 *   because a sent letter's row is the evidence of what the recipient holds.
 *   Both are the sort of thing a later change puts back "for consistency" with
 *   the other eleven logs, so both are asserted rather than described.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const ENCOUNTER = '/screens/encounter.html?appt=ap29';

/** The register is reached from the rail, the way everything on this screen is. */
async function openNotes(page) {
  await page.goto(ENCOUNTER);
  await page.getByTestId('encv--step-post-procedure').click();
  await page.getByTestId('encv--substep-letters').click();
  await expect(page.getByTestId('encv--log-table')).toBeVisible();
}

/** Answering Type is what drafts the letter, so it is its own step. */
async function chooseType(page, kind) {
  const select = page.getByTestId('encv--f-kind').locator('select');
  await select.selectOption(kind);
  await select.dispatchEvent('change');
}

/* And the press that says who is sending it. Every modal on the run asks now,
   this one included — a note is the one entry that leaves the building, so
   filing it without a name behind it was the oddest of the gaps. */
async function signOff(page) {
  await page.getByTestId('encv--f-initials').click();
}

const rows = (page) => page.getByTestId('encv--log-table').locator('tbody tr');

test.describe('the note that goes out is a letter', () => {
  test('the form asks the four things a letter is', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();

    await expect(page.getByTestId('encv--f-kind')).toBeVisible();
    await expect(page.getByTestId('encv--f-recipient')).toBeVisible();
    await expect(page.getByTestId('encv--f-subject')).toBeVisible();
    await expect(page.getByTestId('encv--f-body')).toBeVisible();
  });

  test('choosing the type drafts the letter from the case', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();
    await chooseType(page, 'Clinician');

    /* The recipient and the subject follow from the type — a clinician's
       letter goes to the referrer — and neither was typed. */
    await expect(page.getByTestId('encv--f-recipient').locator('input')).not.toHaveValue('');
    await expect(page.getByTestId('encv--f-subject').locator('input')).not.toHaveValue('');

    /* And the body arrives on the letterhead, naming the patient this
       encounter is about. The MRN is the load-bearing one: it is the field a
       letter assembled by hand eventually gets wrong. */
    const body = await page.getByTestId('encv--f-body').locator('textarea').inputValue();
    expect(body).toContain('GastroEMR Gastroenterology Clinic');
    expect(body).toContain('MRN');
    expect(body).toContain('Sincerely,');
  });

  test('the recipient box offers the two a procedure writes to', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();

    /* The referring clinician and the patient. Neither is knowable from the
       spec — they come off the case — so an empty list here means the field is
       reading a static `options` that was never going to have anything in it,
       which is exactly how it shipped empty the first time. */
    await page.getByTestId('encv--f-recipient').locator('input').click();
    const offered = page.getByTestId('encv--f-recipient').getByRole('option');
    await expect(offered).toHaveCount(2);
  });

  test('the form says where it will go before the press, not only after', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();

    /* Nothing to promise until a type has been chosen. */
    await expect(page.getByTestId('encv--log-commit-note')).toBeHidden();

    await chooseType(page, 'Clinician');
    await expect(page.getByTestId('encv--log-commit-note')).toContainText('fax');

    /* And it follows the answer: a patient's note goes to the portal, not the
       fax line. A line that did not change with the type would be decoration. */
    await chooseType(page, 'Patient');
    await expect(page.getByTestId('encv--log-commit-note')).toContainText('patient portal');
    await expect(page.getByTestId('encv--log-commit-note')).not.toContainText('fax');
  });

  test('recording it sends it, and says where', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();
    await chooseType(page, 'Patient');
    await signOff(page);
    await page.getByTestId('encv--log-save').click();

    await expect(rows(page)).toHaveCount(1);
    /* A patient's note goes to the portal and the email on file — not the fax,
       which is the distinction the routes exist to draw. */
    await expect(page.locator('.ui-toast-region')).toContainText('the patient portal');
  });

  test('a sent note is read and printed, never edited', async ({ page }) => {
    failOnConsoleErrors(page);
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();
    await chooseType(page, 'Clinician');
    await signOff(page);
    await page.getByTestId('encv--log-save').click();
    await expect(rows(page)).toHaveCount(1);

    await expect(page.getByTestId('encv--view-letters-0')).toBeVisible();
    await expect(page.getByTestId('encv--print-letters-0')).toBeVisible();
    /* The pencil every other log carries. Its absence is the point. */
    await expect(page.getByTestId('encv--edit-letters-0')).toHaveCount(0);

    await page.getByTestId('encv--view-letters-0').click();
    await expect(page.getByTestId('encv--letter-body')).toContainText('Dear');
    /* What the system did with it, under the letter rather than in it. */
    await expect(page.getByTestId('encv--letter-routes')).toContainText('fax');
  });

  /*
   * SCOPED TO THE DIALOGS, NOT THE PAGE, for the reason the count sheet's own
   * a11y tests give: the encounter's substep strip writes aria-controls at
   * panels this screen does not have, and axe reports it on every tab of the
   * run. It is the screen's fault and not this step's, so these assert the two
   * surfaces the change actually added.
   */
  test('the drafting form has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();
    await chooseType(page, 'Clinician');
    await expectNoA11yViolations(page, '#logDrawer');
  });

  test('the letter dialog has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openNotes(page);
    await page.getByTestId('encv--log-add').click();
    await chooseType(page, 'Clinician');
    await signOff(page);
    await page.getByTestId('encv--log-save').click();
    await page.getByTestId('encv--view-letters-0').click();
    await expectNoA11yViolations(page, '#rowView');
  });
});
