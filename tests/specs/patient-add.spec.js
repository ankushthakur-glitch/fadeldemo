/**
 * Add Patient — the flow reached from "New Patient" on the directory.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';

const LIST = '/screens/patient-directory.html';
const ADD = '/screens/patient-add.html';

test.describe('add patient', () => {
  test('New Patient navigates from the directory to the form', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(LIST);

    await page.getByTestId('directory--add').locator('button').click();
    await page.waitForURL('**/patient-add.html');
    await expect(page.getByRole('heading', { name: 'Add patient' })).toBeVisible();

    assertClean();
  });

  /**
   * The head is the title and nothing else — it does not follow the form. It
   * used to splice the half-typed name into the title and carry a meta line
   * beside it, all of which restated fields the form itself shows; typing a
   * name must now leave the head exactly where it was.
   */
  test('the head stays the title alone as the form is typed', async ({ page }) => {
    await page.goto(ADD);

    await expect(page.getByTestId('add--title')).toHaveText('Add patient');

    await page.getByTestId('add--first-name').locator('input').fill('Henna');
    await page.getByTestId('add--last-name').locator('input').fill('West');

    await expect(page.getByTestId('add--title')).toHaveText('Add patient');
  });

  test('back link returns to the directory', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--back').click();
    await page.waitForURL('**/patient-directory.html');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  });

  test('required fields are marked with an asterisk, not a fill', async ({ page }) => {
    await page.goto(ADD);
    const field = page.getByTestId('add--first-name');

    await expect(field.locator('.ui-field__required')).toHaveText('*');
    await expect(field.locator('input')).toHaveAttribute('required', '');

    // The field uses the plain component surface — no tinted "outstanding" fill.
    const background = await field
      .locator('.ui-input')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).toBe('rgb(255, 255, 255)');
  });

  test('patient names use GastroEMR Primary/500, not brand red', async ({ page }) => {
    await page.goto(LIST);
    const colour = await page
      .locator('.pt__name-link')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(colour).toBe('rgb(103, 130, 234)'); // #6782EA — Primary/500
  });

  test('file upload uses the GastroEMR dropzone, not a plain button', async ({ page }) => {
    await page.goto(ADD);
    const upload = page.getByTestId('add--card-front');

    await expect(upload).toContainText('Drop your document here');
    await expect(upload).toContainText('click to browse');
    await expect(upload).toContainText('.png, .jpg, up to 5MB.');
    await expect(upload.locator('input[type="file"]')).toHaveAttribute(
      'accept',
      '.png,.jpg'
    );
  });

  test('the social security number is one field, formatted as it is typed', async ({
    page,
  }) => {
    await page.goto(ADD);
    const ssn = page.getByTestId('add--ssn').locator('input');

    // Three boxes with a focus-shuffling script became one box: paste works,
    // a screen reader announces one field, and a middle digit can be corrected
    // without clicking into the right box first.
    await expect(page.locator('.ap__ssn-part')).toHaveCount(0);

    await ssn.fill('123456789');
    await expect(ssn).toHaveValue('123-45-6789');
  });

  /**
   * gGastro splits the SSN into three boxes. Typing should not cost extra
   * tabs, so a full box hands focus on and Backspace on an empty one goes back.
   */
  test('the SSN field takes digits only and stops at nine', async ({ page }) => {
    await page.goto(ADD);
    const ssn = page.getByTestId('add--ssn').locator('input');

    await ssn.fill('12ab34cd5678901');
    await expect(ssn).toHaveValue('123-45-6789');
  });

  /** The MRN is issued when the record is saved, so there is nothing to show
   *  and nothing to type while the form is still being filled in. */
  test('the form carries no MRN field', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--mrn')).toHaveCount(0);
  });

  /** Questions that came off the form, none of them missed. Portal reminders
   *  and Text to Pay are messaging preferences the patient owns themselves. */
  test('Portal reminders and Text to Pay are gone', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--optout-reminders')).toHaveCount(0);
    await expect(page.getByTestId('add--optout-text-to-pay')).toHaveCount(0);
    await expect(page.getByText('Opt-out options')).toHaveCount(0);
  });

  /** Information Sharing uses gGastro's own strings — what the staff read off
   *  the legacy screen and what an auditor asks for by name. */
  test('Information Sharing keeps the legacy field names', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--privacy-policy')).toHaveText(/Privacy Policy/);
    await expect(page.getByTestId('add--exclude-clinical-reports')).toHaveText(
      /Exclude from clinical reports \(Hide name on financial reports\)/
    );
    await expect(page.getByTestId('add--decline-reminders')).toHaveText(
      /preventive and follow up care reminders/
    );
  });

  /** The medication history consent is back on the form, where the legacy
   *  screen keeps it, and it comes pre-answered the way that screen does. */
  test('Medication History Import defaults to consent', async ({ page }) => {
    await page.goto(ADD);
    const field = page.getByTestId('add--medication-history-import');
    await expect(field.locator('select')).toHaveValue('Patient consents');
    await expect(field.locator('option')).toHaveText([
      'Patient consents',
      'Patient declines',
    ]);
  });

  /* --- gGastro field set --------------------------------------------------- */

  /**
 * Registration is one form now. It was three tabs, which meant Save could
 * report required fields on a tab nobody was looking at, and there was no way
 * to see how much of the record was left.
 */
  test('registration is one form — no tabs to work through', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByRole('tab')).toHaveCount(0);

    // Insurance and the guarantor rule are on the page, not behind anything.
    await expect(page.getByTestId('add--has-insurance')).toBeVisible();
    await expect(page.getByTestId('add--insurance-name')).toBeVisible();
  });

  /**
   * Fields removed from the registration form. Each was asked for and never
   * read: the referral route is recorded on the referral itself, Maiden Name
   * and Aliases duplicate Previous Name, and the practice does not capture ID
   * documents at the desk.
   */
  test('the dropped fields are gone from the form', async ({ page }) => {
    await page.goto(ADD);
    for (const label of [
      'Referral Source',
      'Maiden Name',
      'Aliases',
      'Identification Type',
      'ID Number',
      'Details Info',
    ]) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  /**
   * Status lived inside the Details Info card. The card went; Status did not,
   * because the directory's Active / Inactive tabs filter on it and a record
   * saved without one would not appear under either.
   */
  test('record Status survives the Details Info card and defaults to Active', async ({
    page,
  }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--status').locator('select')).toHaveValue('Active');
  });

  test('Preferred Name is asked for, ahead of Previous Name', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--preferred-name').locator('input')).toBeVisible();

    // Preferred first: what to call this patient is asked with the rest of
    // their name, while what the record used to say is a detail further down.
    const preferredFirst = await page.evaluate(() => {
      const preferred = document.querySelector('[data-testid="add--preferred-name"]');
      const previous = document.querySelector('[data-testid="add--previous-name"]');
      return Boolean(
        preferred.compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(preferredFirst).toBe(true);
  });

  /**
   * Race Details is greyed until a Race is chosen, and only offers the
   * sub-categories that belong to it — the legacy form's behaviour.
   */
  test('Race Details unlocks and scopes itself to the chosen Race', async ({ page }) => {
    await page.goto(ADD);
    const details = page.getByTestId('add--race-details').locator('select');
    await expect(details).toBeDisabled();

    await page.getByTestId('add--race').locator('select').selectOption('Asian');
    await expect(details).toBeEnabled();
    await expect(details.locator('option')).toContainText(['Chinese']);

    // A race with no sub-categories locks it again rather than leaving stale
    // options behind.
    await page.getByTestId('add--race').locator('select').selectOption('Other race');
    await expect(details).toBeDisabled();
  });

  test('Ethnicity Details unlocks only for Hispanic or Latino', async ({ page }) => {
    await page.goto(ADD);
    const details = page.getByTestId('add--ethnicity-details').locator('select');
    await expect(details).toBeDisabled();

    await page.getByTestId('add--ethnicity').locator('select').selectOption('Hispanic or Latino');
    await expect(details).toBeEnabled();
  });

  /**
   * RM-003 took the two Previous Name date fields off the form. The name
   * itself stays — it is what an incoming record is matched against — so this
   * asserts both halves of that change at once: the name is still askable and
   * the dates that used to be gated behind it are gone entirely.
   */
  test('Previous Name is asked without dates attached', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--previous-name').locator('input')).toBeEnabled();

    await expect(page.getByTestId('add--previous-from')).toHaveCount(0);
    await expect(page.getByTestId('add--previous-to')).toHaveCount(0);
  });

  /**
   * Yes or No, because that is the question the label asks.
   *
   * The two options were sentences — "Patient consents to share" / "Patient
   * declines to share" — which answered the OPPOSITE question from the one
   * above them: "Protect Data: Patient consents to share" is a double negative
   * to unpick every time it is read back, and the legacy screen this is fitted
   * to asks it as a plain Yes/No. Yes means the data IS protected.
   *
   * Answering it used to unfold a regulatory footnote under the field, and
   * CAHPS unfolded a second one beside it. Both are gone: they restated the
   * question in longer words, and a card that grows two paragraphs mid-answer
   * pushes everything below it down the page while the desk is still typing.
   */
  test('protect data is asked as a plain Yes or No', async ({ page }) => {
    await page.goto(ADD);

    await expect(page.getByTestId('add--protect-data').locator('option')).toHaveText([
      'Select',
      'Yes',
      'No',
    ]);

    await page.getByTestId('add--protect-data').locator('select').selectOption('Yes');
    await expect(page.locator('#protectDataNote')).toHaveCount(0);
  });

  test('a CAHPS restriction mirrors into Patient Data Restrictions', async ({ page }) => {
    await page.goto(ADD);
    const restrictions = page.getByTestId('add--data-restrictions').locator('input');
    await expect(restrictions).toHaveValue('No');

    await page.getByTestId('add--cahps').locator('select').selectOption('Yes');
    await expect(restrictions).toHaveValue('Yes');
    await expect(page.locator('#cahpsNote')).toHaveCount(0);
  });

  /**
 * Contact Numbers, Addresses and Emails were three collapsible panels with
 * their own add buttons, asking for the mobile number, address and e-mail the
 * form above already takes as required fields. Two places to put one fact is
 * one too many — whichever was filled, the other looked empty.
 */
  test('a number, an address and an e-mail are each asked for once', async ({ page }) => {
    await page.goto(ADD);

    await expect(page.locator('.ap__panel')).toHaveCount(0);
    for (const testid of ['add--mobile', 'add--address1', 'add--email']) {
      await expect(page.getByTestId(testid)).toHaveCount(1);
    }
  });

  /* The four identity fields are asked of everyone now, rather than appearing
     only if a "Birth Sex Declined" box was ticked. */
  test('the identity fields are on the form, not behind a tick-box', async ({ page }) => {
    await page.goto(ADD);

    for (const id of [
      'add--sexual-orientation',
      'add--gender-identity',
      'add--pronouns',
      'add--sex-clinical',
    ]) {
      await expect(page.getByTestId(id).locator('select')).toBeVisible();
    }
  });

  /**
   * Several of these labels contain commas. ui-select's `options` attribute
   * is a comma-joined string, so they must arrive as data or they split
   * mid-label into nonsense entries.
   */
  test('comma-bearing option labels survive intact', async ({ page }) => {
    await page.goto(ADD);

    await expect(
      page.getByTestId('add--sexual-orientation').locator('option')
    ).toContainText(['Lesbian, gay or homosexual']);

    await expect(
      page.getByTestId('add--gender-identity').locator('option')
    ).toContainText(['Genderqueer, neither exclusively male nor female']);
  });

  /** An asterisk the Save button does not enforce is a lie. */
  test('every asterisked field is actually enforced', async ({ page }) => {
    await page.goto(ADD);

    const starred = await page.locator('#patientBasics .ui-field__required').count();
    expect(starred, 'the form should carry visible required markers').toBeGreaterThan(5);

    await page.getByTestId('add--save').locator('button').click();
    await expect(page.locator('#formStatus')).toContainText('required field');

    // Filling only the name fields is not enough — address is required too.
    await page.getByTestId('add--first-name').locator('input').fill('Priya');
    await page.getByTestId('add--last-name').locator('input').fill('Raman');
    await page.getByTestId('add--dob').locator('input').fill('1980-05-04');
    await page.getByTestId('add--save').locator('button').click();

    await expect(page.locator('#formStatus')).toContainText('required field');
    expect(page.url()).toContain('patient-add.html');
  });

  /** There is no address lookup behind the form, so nothing claims to verify one. */
  test('no Verify Address control survives on either address', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(0);
  });

  test('date of birth computes an age', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.getByTestId('add--age')).toHaveText('—');
    await page.getByTestId('add--dob').locator('input').fill('1961-02-20');
    await expect(page.getByTestId('add--age')).toHaveText('65 yr');
  });

  /* --- Guarantor -----------------------------------------------------------
     The guarantor is decided at the workflow's "Patient 18 or over?" diamond,
     so it follows date of birth — there is no Yes/No for staff to get wrong,
     and for an adult there is nothing to ask at all. */

  /**
   * An adult IS their own guarantor, so the section that used to mirror the
   * patient record into itself and lock every field is simply not shown.
   */
  test('an adult patient is never asked for a guarantor', async ({ page }) => {
    await page.goto(ADD);
    const section = page.getByTestId('add--guarantor');

    // Nothing decided yet: no date of birth, no guarantor question.
    await expect(section).toBeHidden();

    await page.getByTestId('add--dob').locator('input').fill('1990-01-01');
    await expect(section).toBeHidden();
  });

  test('a minor reveals the guarantor section, and correcting the date hides it', async ({
    page,
  }) => {
    await page.goto(ADD);
    const section = page.getByTestId('add--guarantor');
    const dob = page.getByTestId('add--dob').locator('input');

    await dob.fill('2015-01-01');
    await expect(section).toBeVisible();
    await expect(page.locator('#guarantorLane')).toContainText('under 18');

    // A mistyped year is corrected, and the section goes with it.
    await dob.fill('1985-01-01');
    await expect(section).toBeHidden();
  });

  /** A minor cannot be their own guarantor, so "Self" is not on the menu. */
  test('"Self" is not offered as a guarantor relationship', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--dob').locator('input').fill('2015-01-01');

    const rel = page.getByTestId('add--guarantor-relationship').locator('select');
    await expect(rel).toHaveValue('Parent');
    await expect(rel.locator('option')).not.toContainText(['Self']);
  });

  test('the guarantor address can be copied from the patient', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--dob').locator('input').fill('2015-01-01');
    await page.getByTestId('add--address1').locator('input').fill('4218 Prairie Rose Ln');
    await page.getByTestId('add--city').locator('input').fill('Fargo');

    const line1 = page.getByTestId('add--guarantor-address1').locator('input');
    await expect(line1).toHaveValue('');

    // A labelled ui-button now, not a bare icon — the click lands on its button.
    await page.getByTestId('add--guarantor-copy-address').locator('button').click();
    await expect(line1).toHaveValue('4218 Prairie Rose Ln');
    await expect(page.getByTestId('add--guarantor-city').locator('input')).toHaveValue('Fargo');
  });

  /**
   * The guarantor's fields are required only while the section is on screen.
   * Requiring them for an adult would block Save on a form nobody can see.
   */
  test("a minor's guarantor must be named before Save", async ({ page }) => {
    await page.goto(ADD);
    await fillPatientRequired(page);

    // fillPatientRequired enters an adult; making the patient a minor is what
    // puts the guarantor's own required fields on the form.
    await page.getByTestId('add--dob').locator('input').fill('2015-06-01');
    await page.getByTestId('add--save').locator('button').click();
    await expect(page.locator('#formStatus')).toContainText('required field');
    await expect(page.getByTestId('add--guarantor-first').locator('input')).toBeFocused();

    await page.getByTestId('add--guarantor-first').locator('input').fill('Marion');
    await page.getByTestId('add--guarantor-last').locator('input').fill('Delacroix');
    await page.getByTestId('add--guarantor-address1').locator('input').fill('4218 Prairie Rose Ln');
    await page.getByTestId('add--guarantor-city').locator('input').fill('Fargo');
    await page.getByTestId('add--guarantor-zip').locator('input').fill('58104');

    await page.getByTestId('add--save').locator('button').click();
    await page.waitForURL('**/patient-directory.html');
  });

  test('answering "No" to insurance hides the insurance block', async ({ page }) => {
    await page.goto(ADD);
    const block = page.locator('#insuranceFields');
    await expect(block).toBeVisible();

    await page.getByTestId('add--has-insurance').getByRole('radio', { name: 'No' }).check();
    await expect(block).toBeHidden();
  });

  /* --- Address --------------------------------------------------------------
     One sequence everywhere the system takes an address:
     Address Line 1 · Address Line 2 · City · State · ZIP. */

  const ADDRESS_ORDER = ['Address Line 1', 'Address Line 2', 'City', 'State', 'ZIP'];

  /** Reads the address labels out of a block in the order they are rendered. */
  async function addressLabelsIn(page, selector) {
    return page.locator(selector).evaluate((root, wanted) => {
      const labels = [...root.querySelectorAll('.ui-field__label, label')]
        .map((el) => el.textContent.replace('*', '').trim())
        .filter((text) => wanted.includes(text));
      // Two blocks can share a wrapper; de-duplicate while keeping order.
      return labels.filter((text, i) => labels.indexOf(text) === i);
    }, ADDRESS_ORDER);
  }

  test('the patient address asks in the system order', async ({ page }) => {
    await page.goto(ADD);
    expect(await addressLabelsIn(page, '#patientBasics')).toEqual(ADDRESS_ORDER);
  });

  test('the guarantor address asks in the same order', async ({ page }) => {
    await page.goto(ADD);
    // The guarantor form exists only for a minor.
    await page.getByTestId('add--dob').locator('input').fill('2015-01-01');
    expect(await addressLabelsIn(page, '#guarantorForm')).toEqual(ADDRESS_ORDER);
  });

  /**
   * Unticking "same as patient" is a claim that the two differ, and a claim
   * with nowhere to record the difference is a tick-box that changes nothing.
   */
  test('a subscriber at a different address gets somewhere to put it', async ({ page }) => {
    await page.goto(ADD);

    const block = page.getByTestId('add--subscriber-address');
    await expect(block).toBeHidden();

    await page.getByTestId('add--same-address').locator('input').uncheck();
    await expect(block).toBeVisible();
    expect(await addressLabelsIn(page, '[data-testid="add--subscriber-address"]')).toEqual(
      ADDRESS_ORDER
    );
  });

  /** A hidden address still holding last week's typing is a claim the form
   *  cannot see and the payer would receive. */
  test('re-ticking clears the subscriber address rather than hiding it', async ({ page }) => {
    await page.goto(ADD);

    const box = page.getByTestId('add--same-address').locator('input');
    await box.uncheck();
    await page.getByTestId('add--sub-address1').locator('input').fill('88 Prairie Rose Ln');
    await page.getByTestId('add--sub-city').locator('input').fill('Bismarck');

    await box.check();
    await expect(page.getByTestId('add--subscriber-address')).toBeHidden();

    await box.uncheck();
    await expect(page.getByTestId('add--sub-address1').locator('input')).toHaveValue('');
    await expect(page.getByTestId('add--sub-city').locator('input')).toHaveValue('');
  });

  test('the subscriber State list is filled, not an empty dropdown', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--same-address').locator('input').uncheck();

    await expect(
      page.getByTestId('add--sub-state').locator('option')
    ).toContainText(['ND']);
  });

  test('Save blocks on missing required fields and focuses the first one', async ({
    page,
  }) => {
    await page.goto(ADD);
    await page.getByTestId('add--save').locator('button').click();

    await expect(page.locator('#formStatus')).toContainText('required field');
    await expect(page.getByTestId('add--first-name').locator('input')).toBeFocused();
    // Still on the form — nothing was submitted.
    expect(page.url()).toContain('patient-add.html');
  });

  /**
   * Every mandatory field, for an adult patient.
   *
   * They all live on Patient Info now. The billing group was the one exception
   * and it left with the Billing tab — a fee schedule belongs to the practice,
   * not to each new patient, so registration no longer blocks on it.
   */
  async function fillPatientRequired(page) {
    await page.getByTestId('add--first-name').locator('input').fill('Priya');
    await page.getByTestId('add--last-name').locator('input').fill('Raman');
    await page.getByTestId('add--dob').locator('input').fill('1980-05-04');
    await page.getByTestId('add--birth-sex').locator('select').selectOption('Female');
    await page.getByTestId('add--mobile').locator('input').fill('(701) 555-0184');
    await page.getByTestId('add--address1').locator('input').fill('4218 Prairie Rose Ln');
    await page.getByTestId('add--city').locator('input').fill('Fargo');
    await page.getByTestId('add--state').locator('select').selectOption('ND');
    await page.getByTestId('add--zip').locator('input').fill('58104');
  }


  test('Save returns to the directory once required fields are filled', async ({
    page,
  }) => {
    await page.goto(ADD);
    await fillPatientRequired(page);

    await page.getByTestId('add--save').locator('button').click();
    await page.waitForURL('**/patient-directory.html');
  });

  test('Save draft does not enforce required fields', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--save-draft').locator('button').click();
    await page.waitForURL('**/patient-directory.html');
  });

  /* --- Eligibility --------------------------------------------------------- */

  /* Nothing to ask a payer until a policy exists, so the check is gated — and
     the gating is the button's own state now. The readout beside it says
     nothing until there is an answer to give: "waiting on a policy" and "ready
     to check" were the form telling the registrar they had not finished
     typing yet. */
  test('eligibility cannot be checked before a policy is entered', async ({ page }) => {
    await page.goto(ADD);

    const check = page.getByTestId('add--check-eligibility').locator('button');
    const answer = page.locator('#eligibilityBody');

    await expect(check).toBeDisabled();
    await expect(answer).toBeEmpty();

    await page.getByTestId('add--insurance-name').locator('input').fill('Prairie Mutual');
    await expect(check).toBeDisabled(); // name alone is not a policy

    await page.getByTestId('add--member-id').locator('input').fill('PMS7741002');
    await expect(check).toBeEnabled();
    await expect(answer).toBeEmpty();
  });

  test('a contracted plan comes back as active coverage', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--insurance-name').locator('input').fill('Prairie Mutual');
    await page.getByTestId('add--member-id').locator('input').fill('PMS7741002');
    await page.getByTestId('add--check-eligibility').locator('button').click();

    await expect(page.locator('#eligibilityBody .ap__gate-a')).toHaveText(
      'Active coverage — Prairie Mutual'
    );
  });

  /** An uncontracted plan is the branch that stops a booking being taken. */
  test('an uncontracted plan is reported as not contracted', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--insurance-name').locator('input').fill('Summit Bridge PPO');
    await page.getByTestId('add--member-id').locator('input').fill('SBP4471290');
    await page.getByTestId('add--check-eligibility').locator('button').click();

    await expect(page.locator('#eligibilityBody .ap__gate-a')).toHaveText(
      'Not contracted — Summit Bridge PPO'
    );
  });

  /** A carrier nobody recognises must not read as accepted. */
  test('an unrecognised carrier defaults to not contracted', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--insurance-name').locator('input').fill('Totally Made Up Health');
    await page.getByTestId('add--member-id').locator('input').fill('XYZ123');
    await page.getByTestId('add--check-eligibility').locator('button').click();

    await expect(page.locator('#eligibilityBody .ap__gate-a')).toContainText('Not contracted');
  });

  /** A stale "Active coverage" beside a retyped carrier would be a lie. */
  test('editing the policy discards the previous eligibility answer', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--insurance-name').locator('input').fill('Prairie Mutual');
    await page.getByTestId('add--member-id').locator('input').fill('PMS7741002');
    await page.getByTestId('add--check-eligibility').locator('button').click();

    const gate = page.locator('#eligibilityBody .ap__gate-a');
    await expect(gate).toHaveText('Active coverage — Prairie Mutual');

    // Retyping the carrier drops the answer rather than leaving a stale one.
    await page.getByTestId('add--insurance-name').locator('input').fill('Cascade Value HMO');
    await expect(page.locator('#eligibilityBody')).toBeEmpty();
  });

  test('self-pay skips eligibility entirely', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--has-insurance').getByRole('radio', { name: 'No' }).check();

    await expect(page.locator('#eligibilityBody .ap__gate-a')).toHaveText(
      'Not applicable — self-pay'
    );
    await expect(page.getByTestId('add--check-eligibility').locator('button')).toBeDisabled();
  });

  /* --- Care network ------------------------------------------------------ */

  test('a pharmacy can be picked from the directory and removed again', async ({
    page,
  }) => {
    await page.goto(ADD);
    const selected = page.getByTestId('add--pharmacies');

    // Nothing on file to begin with.
    await expect(selected.locator('tbody tr')).toHaveCount(0);

    await page.getByTestId('add--new-pharmacy').locator('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('pharmacy--count')).toContainText('8 of 8');

    // Filter, then take the first result.
    await page.getByTestId('pharmacy--filter-name').locator('input').fill('Prairie');
    await expect(page.getByTestId('pharmacy--count')).toContainText('1 of 8');
    await page.getByTestId('pharmacy--results').locator('[data-select]').first().click();

    await expect(selected.locator('tbody tr')).toHaveCount(1);
    await expect(selected).toContainText('Prairie Specialty Pharmacy');

    // A picked pharmacy drops out of the result list.
    await expect(page.getByTestId('pharmacy--count')).toContainText('0 of 8');

    await page.getByTestId('pharmacy--close').locator('button').click();
    await expect(dialog).toBeHidden();

    await selected.locator('[data-remove]').first().click();
    await expect(selected.locator('tbody tr')).toHaveCount(0);
  });

  /**
   * Referring physicians and the Providers panel were two lists holding the
   * same kind of person, so a PCP who had also sent the referral was entered
   * twice and the two copies could disagree. One list now — and the role is
   * what tells a referrer from a PCP.
   */
  test('the PCP and the referrer share one Providers list', async ({ page }) => {
    await page.goto(ADD);
    const table = page.getByTestId('add--providers');

    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tbody tr td:first-child')).toHaveText([
      'Primary care',
      'Referring',
    ]);

    // The old separate section and its collapsible panel are both gone.
    await expect(page.getByTestId('add--physicians')).toHaveCount(0);
    await expect(page.getByTestId('add--panel-providers')).toHaveCount(0);
  });

  /**
   * PICKED, NOT TYPED. First name and last name meant the same referring
   * clinician sat on three patients as "Dr Helena Ward", "Helena Ward MD" and
   * "H. Ward" — three strings that join to nothing. Choosing one fills the
   * specialty, the practice and the contact details from that one record.
   */
  test('a provider is picked from the directory and fills its own details', async ({ page }) => {
    await page.goto(ADD);
    const table = page.getByTestId('add--providers');

    await page.getByTestId('add--new-provider').locator('button').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // A provider is required — saving with nothing chosen is refused.
    await page.getByTestId('provider--save').locator('button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('provider--name')).toContainText('Choose a provider');

    await page.getByTestId('provider--name').locator('select').selectOption('pd5');
    await expect(page.getByTestId('provider--specialty').locator('select')).toHaveValue(
      'General Surgery'
    );
    await expect(page.getByTestId('provider--institution').locator('input')).toHaveValue(
      'Fargo Surgical Associates'
    );

    await page.getByTestId('provider--role').locator('select').selectOption('Consulting');
    await page.getByTestId('provider--save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.locator('tbody tr').last()).toContainText('Dr. Neil Ashworth');
    await expect(table.locator('tbody tr').last()).toContainText('Consulting');
  });

  /* --- Support persons ---------------------------------------------------- */

  /**
   * TWO PERMISSIONS, TWO TICKS. Emergency Contact and HIPAA Approved are
   * different things — one person may be RUNG, the other may be TOLD — and
   * they are independent: either, both, or neither is a real answer. They were
   * a single required three-way radio where "Both" existed only because a
   * radio group cannot say yes twice, and "neither" could not be said at all.
   */
  test('a support person carries two independent permissions, neither required', async ({
    page,
  }) => {
    await page.goto(ADD);
    await page.getByTestId('add--new-support').locator('button').click();

    await expect(page.getByTestId('support--designation')).toHaveCount(0);
    await expect(page.getByTestId('support--emergency')).toBeVisible();
    await expect(page.getByTestId('support--hipaa')).toBeVisible();
    await expect(page.getByTestId('support--emergency').locator('input')).not.toBeChecked();
    await expect(page.getByTestId('support--hipaa').locator('input')).not.toBeChecked();

    // What IS required is still required, and says which field it means.
    await page.getByTestId('support--save').locator('button').click();
    await expect(page.getByTestId('support--phone')).toContainText('who gets rung');
  });

  /** No Notes box: a sentence qualifying an access decision looks like a
   *  restriction and binds nobody. */
  test('the support person drawer has no notes field', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--new-support').locator('button').click();

    await expect(page.locator('#supportModal ui-textarea')).toHaveCount(0);
  });

  test('a support person is added and shows their permissions in the table', async ({ page }) => {
    await page.goto(ADD);
    const table = page.getByTestId('add--support-persons');
    await expect(table).toContainText('No support person on file');

    await page.getByTestId('add--new-support').locator('button').click();
    await page.getByTestId('support--first-name').locator('input').fill('Renata');
    await page.getByTestId('support--last-name').locator('input').fill('Okonkwo');
    await page.getByTestId('support--relationship').locator('select').selectOption('Sibling');
    await page.getByTestId('support--phone').locator('input').fill('(701) 555-0134');
    // Both, which used to need a third radio option of its own.
    await page.getByTestId('support--emergency').locator('input').check({ force: true });
    await page.getByTestId('support--hipaa').locator('input').check({ force: true });
    await page.getByTestId('support--save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    const row = table.locator('tbody tr').first();
    await expect(row).toContainText('Renata Okonkwo');
    await expect(row).toContainText('Sibling');
    await expect(row).toContainText('(701) 555-0134');
    await expect(row).toContainText('Emergency');
    await expect(row).toContainText('HIPAA');

    // Removable again — a support person can be withdrawn.
    await table.locator('[data-remove]').first().click();
    await expect(table.locator('tbody tr')).toHaveCount(0);
  });

  /** Neither ticked is the relative who is on the record and told nothing —
   *  a real entry, and one the old required designation could not record. */
  test('a support person with no permissions is allowed, and says so', async ({ page }) => {
    await page.goto(ADD);
    const table = page.getByTestId('add--support-persons');

    await page.getByTestId('add--new-support').locator('button').click();
    await page.getByTestId('support--first-name').locator('input').fill('Ade');
    await page.getByTestId('support--last-name').locator('input').fill('Okonkwo');
    await page.getByTestId('support--relationship').locator('select').selectOption('Child');
    await page.getByTestId('support--phone').locator('input').fill('(701) 555-0199');
    await page.getByTestId('support--save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(table.locator('tbody tr').first()).toContainText('None recorded');
  });

  /** A second support person must not inherit the first one's answers —
   *  least of all their access. */
  test('the form is empty again for the next support person', async ({ page }) => {
    await page.goto(ADD);
    await page.getByTestId('add--new-support').locator('button').click();
    await page.getByTestId('support--first-name').locator('input').fill('Renata');
    await page.getByTestId('support--last-name').locator('input').fill('Okonkwo');
    await page.getByTestId('support--relationship').locator('select').selectOption('Sibling');
    await page.getByTestId('support--phone').locator('input').fill('(701) 555-0134');
    await page.getByTestId('support--hipaa').locator('input').check({ force: true });
    await page.getByTestId('support--save').locator('button').click();

    await page.getByTestId('add--new-support').locator('button').click();
    await expect(page.getByTestId('support--first-name').locator('input')).toHaveValue('');
    await expect(page.getByTestId('support--relationship').locator('select')).toHaveValue('');
    await expect(page.getByTestId('support--emergency').locator('input')).not.toBeChecked();
    await expect(page.getByTestId('support--hipaa').locator('input')).not.toBeChecked();
  });

  /* --- Insurance field set ------------------------------------------------- */

  /** Neither reached a claim; both were unvalidated free text nothing read. */
  test('Insurance Plan and Insured Group Name are gone, Group Number stays', async ({
    page,
  }) => {
    await page.goto(ADD);

    await expect(page.getByText('Insurance Plan', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Insured Group Name', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('add--group-number').locator('input')).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(ADD);
    await expectNoA11yViolations(page);
  });

  /**
   * Two captures, because one is not enough on this screen.
   *
   * `fullPage` sounds like it covers everything and here it does not: the page
   * body is exactly viewport-height and it is <main> that scrolls, so the
   * document has no scroll height to extend into. A "full page" shot of this
   * form is therefore the first 720px of a much taller form — the header and
   * the top of the first card. Everything below the fold, which is most of the
   * form, was never being compared against anything.
   *
   * So the page shot keeps its job (chrome and the fold) and the form is
   * captured at a tall viewport, which does extend to its full height.
   */
  test('visual — add patient chrome and the fold', async ({ page }) => {
    await page.goto(ADD);
    await expect(page.locator('#addPatientForm')).toBeVisible();
    await expect(page).toHaveScreenshot('add-patient.png', {
      fullPage: true,
    });
  });

  test('visual — the whole patient form, below the fold included', async ({ page }) => {
    /* A tall viewport rather than an element screenshot. Capturing
       #addPatientForm on its own gives a correctly-sized image whose lower
       two-thirds are blank white: the form is inside a scrolling <main>, and
       whatever has not been scrolled into that container is not painted. Made
       tall enough to hold the form, everything renders and the shot is real. */
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.goto(ADD);

    // The care-network tables paint from JS; wait for one before capturing.
    await expect(page.getByTestId('add--providers').locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('#addPatientForm')).toBeVisible();

    await expect(page).toHaveScreenshot('add-patient-form.png', { fullPage: true });
  });
});
