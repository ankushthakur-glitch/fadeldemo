/**
 * Patient chart — the shell.
 *
 * What is under test here is the FRAME, not any module: the sidebar and the
 * patient header have to survive every navigation, the URL has to describe
 * what is on screen, and every section has to be reachable — including the
 * ones whose modules do not exist yet.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const SCREEN = '/screens/patient-chart.html';
const HENNA = `${SCREEN}?mrn=326486`;

/*
 * Navigation goes through openChart(), not page.goto(), because the Alerts
 * and Due Recommendations digest opens on every chart load and would sit on
 * top of whatever these tests meant to click. The helper closes it the way a
 * user would — see tests/helpers/page-helpers.js.
 */

test.describe('patient chart shell', () => {
  test('opens on Clinical with the patient identified', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA);

    // The legal name, then the number: the eye sees "Henna West (326486)".
    // The preferred name is deliberately NOT here — the client asked for the
    // nickname off the header, so the heading carries the name a claim and a
    // wristband have to match and nothing else. It is still on the record and
    // still on Profile; the assertion below is what keeps it from creeping
    // back into the heading. "MRN" is in the markup for anyone listening, who
    // cannot hear a bracket.
    await expect(page.getByTestId('chart--name')).toContainText('Henna West');
    await expect(page.getByTestId('chart--name')).not.toContainText('Hennie');
    await expect(page.getByTestId('chart--preferred-name')).toHaveCount(0);
    await expect(page.getByTestId('chart--mrn')).toHaveText('MRN (326486)');
    await expect(page.getByTestId('chart--module-title')).toHaveText('Clinical');

    assertClean();
  });

  /**
   * The header carries a computed age, never a stored one. 20-02-1961 is a
   * birthday that has passed this year or not depending on the day the suite
   * runs, so the assertion allows both rather than pinning a number that
   * would fail every February.
   */
  test('age is derived from the date of birth', async ({ page }) => {
    await openChart(page, HENNA);

    const facts = page.getByTestId('chart--header');
    await expect(facts).toContainText('20 Feb 1961');
    await expect(facts).toContainText(/\(6[45] yrs\)/);
  });

  /* --- The frame stays put -------------------------------------------------- */

  test('switching section replaces only the workspace', async ({ page }) => {
    await openChart(page, HENNA);

    const header = page.getByTestId('chart--header');
    const sidebar = page.getByTestId('chart--sidebar');
    const headerBefore = await header.boundingBox();

    await page.getByTestId('chart--nav-orders').click();

    await expect(page.getByTestId('chart--module-title')).toHaveText('Orders');
    await expect(page.getByTestId('chart--name')).toContainText('Henna West');
    await expect(sidebar).toBeVisible();
    // Same box, so the header did not reflow, reload or jump under the module.
    expect(await header.boundingBox()).toEqual(headerBefore);
  });

  /**
   * This used to iterate the sections that had no module yet and assert each
   * still routed and said so. Tasks was the last of them, so the list is empty
   * and the guarantee is now the opposite one — and a stronger one: every
   * section in the sidebar resolves to a real module.
   *
   * The shell's placeholder has not gone; it is what a section falls back to
   * if its file is missing. This is what fails loudly when a nav entry is
   * added without one, rather than shipping a dead sidebar row.
   */
  test('every section in the sidebar resolves to a real module', async ({ page }) => {
    await openChart(page, HENNA);

    const ids = await page
      .locator('[data-testid^="chart--nav-"]')
      .evaluateAll((els) => els.map((el) => el.dataset.testid.replace('chart--nav-', '')));

    expect(ids.length, 'sidebar should have sections to check').toBeGreaterThan(5);

    for (const id of ids) {
      const item = page.getByTestId(`chart--nav-${id}`);
      if (!(await item.isVisible())) continue; // a collapsed sub-item
      await item.click();
      await expect(page.getByTestId('chart--module-title')).not.toBeEmpty();
      await expect(
        page.getByTestId('chart--placeholder'),
        `"${id}" has no module — it falls back to the shell placeholder`
      ).toHaveCount(0);
    }
  });

  /* --- Routing -------------------------------------------------------------- */

  test('the section lives in the URL and survives Back', async ({ page }) => {
    await openChart(page, HENNA);

    await page.getByTestId('chart--nav-tasks').click();
    await expect(page).toHaveURL(/#tasks$/);

    await page.goBack();
    await expect(page.getByTestId('chart--module-title')).toHaveText('Clinical');
  });

  test('a Clinical deep link opens it directly, no parent to expand', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Clinical');
    await expect(page.getByTestId('chart--nav-profile-clinical')).toBeVisible();
    // Profile, Clinical and Insurance are three equal, top-level sections —
    // none of them carries aria-expanded any more, because none of them
    // groups the others.
    await expect(page.getByTestId('chart--nav-profile-clinical')).not.toHaveAttribute('aria-expanded');
  });

  /**
   * Profile used to be pure grouping — nothing was registered against the
   * bare id, only its Clinical/Insurance children were real pages, and
   * landing on it redirected to Clinical. It is a real module now, so it is
   * a real destination: the registration record collected when the patient
   * was added, not a redirect and not the "not built yet" placeholder.
   */
  test('Profile is a real destination, not a redirect to Clinical', async ({ page }) => {
    await openChart(page, `${HENNA}#profile`);

    await expect(page).toHaveURL(/#profile$/);
    await expect(page.getByTestId('chart--module-title')).toHaveText('Profile');
    await expect(page.getByTestId('chart--placeholder')).toHaveCount(0);
    await expect(page.getByTestId('chart--pr-grid')).toBeVisible();

    // Same from a click on the Profile row itself, starting from a
    // different section so the click is a real navigation.
    await page.getByTestId('chart--nav-orders').click();
    await page.getByTestId('chart--nav-profile').click();

    await expect(page).toHaveURL(/#profile$/);
    await expect(page.getByTestId('chart--module-title')).toHaveText('Profile');
  });

  /**
   * An MRN nobody recognises must not leave the address bar pointing at a
   * patient who is not on screen.
   */
  test('an unknown MRN falls back and corrects the URL', async ({ page }) => {
    await openChart(page, `${SCREEN}?mrn=999999`);

    await expect(page.getByTestId('chart--name')).toContainText('Henna West');
    await expect(page).toHaveURL(/mrn=326486/);
  });

  /* --- Sidebar -------------------------------------------------------------- */

  /* The rail carries no numbers at all now: a section is a place, and the list
     it opens is the tally. What used to be checked here — that a badge moved
     with the patient — is checked by the panels themselves, which is where the
     number a reader came for actually lives. */
  test('the rail names its sections and counts none of them', async ({ page }) => {
    await openChart(page, HENNA);

    await expect(page.getByTestId('chart--nav-tasks')).toHaveText(/Tasks/);
    await expect(page.getByTestId('chart--sidebar').locator('.ch__nav-count')).toHaveCount(0);
  });

  /* The rail has one width now — there is no collapse, so Alt+S is gone with
     it and Alt+C is the only chart shortcut left. */
  test('Alt+C returns focus to the rail, which keeps its one width', async ({ page }) => {
    await openChart(page, HENNA);

    await expect(page.getByTestId('chart--sidebar')).toHaveCSS('width', '208px');
    await expect(page.getByTestId('chart--collapse')).toHaveCount(0);

    await page.keyboard.press('Alt+c');
    await expect(page.locator('.ch__nav-link:focus')).toHaveCount(1);
  });

  /** One Tab stop for every section; the arrows move inside it. Starts on
   *  Clinical (the active row), so reaching Orders takes one step per row in
   *  between: Appointments, Visit Notes, History, Diagnoses, Prescriptions,
   *  Medication, Allergies, Orders. Add or remove a CHART_NAV entry above
   *  Orders and this count moves with it — that is the point of the test. */
  test('arrow keys walk the sections without leaving the strip', async ({ page }) => {
    await openChart(page, HENNA);

    await page.keyboard.press('Alt+c');
    for (let step = 0; step < 8; step += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#orders$/);
    await expect(page.getByTestId('chart--module-title')).toHaveText('Orders');
  });

  /* --- Special Triggers -------------------------------------------------------
     Special Triggers is a PREVIEW of the highest-priority alert, not a second
     place to type one — clicking it opens the same categorised composer every
     alert is created through. */

  test('Special Triggers previews the top-priority alert and opens the composer', async ({
    page,
  }) => {
    await openChart(page, HENNA);
    const box = page.getByTestId('chart--alert-note');

    // Henna's highest-priority alert (of three) is the penicillin anaphylaxis.
    await expect(box).toContainText('Anaphylaxis to penicillin');
    await expect(box).toContainText('+2');

    await page.getByTestId('chart--alert-note-open').click();
    // Scoped to #alertModal specifically — the chart also has the boot-time
    // Alerts Summary dialog, so a bare .ui-modal__dialog matches two.
    await expect(page.locator('#alertModal .ui-modal__dialog')).toBeVisible();
  });

  test('a new high-priority alert becomes the header preview', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA);

    await page.getByTestId('chart--alert-note-open').click();
    await page.getByTestId('chart--alert-priority').locator('select').selectOption('High');
    await page
      .getByTestId('chart--alert-title')
      .locator('input')
      .fill('Bowel prep needs a carer present');
    await page.getByTestId('chart--alert-save').click();

    // Same rank as the existing high-priority alert, but newer — sortedAlerts
    // breaks ties by date, so the new one surfaces first.
    await expect(page.getByTestId('chart--alert-note')).toContainText(
      'Bowel prep needs a carer present'
    );
    await expect(page.getByTestId('chart--alert-note')).toContainText('+3');

    assertClean();
  });

  test('an alert note without a subject is refused and the preview is unchanged', async ({
    page,
  }) => {
    await openChart(page, HENNA);
    const box = page.getByTestId('chart--alert-note');

    await page.getByTestId('chart--alert-note-open').click();
    await page.getByTestId('chart--alert-save').click();

    await expect(page.getByTestId('chart--alert-title')).toContainText(
      'An alert note needs a subject'
    );
    await page.getByTestId('chart--alert-cancel').click();

    // Still the same top alert, still three notes behind it — nothing was
    // added by the rejected submission.
    await expect(box).toContainText('Anaphylaxis to penicillin');
    await expect(box).toContainText('+2');
  });

  /* --- Identity row ----------------------------------------------------------
     The name, the number in brackets after it, and the status pills. */

  /* The name line carries the name, the number and the status pills, and
     nothing else. It used to carry a copy-MRN button, an edit-demographics
     pencil and a copy-chart-link button as well — three grey icons in the
     middle of the one line on the screen that has to be read at a glance.
     Editing demographics is what the Profile section is; the two copies were
     conveniences bought at the cost of the header's first line. */

  test('the name line carries no icon buttons', async ({ page }) => {
    await openChart(page, HENNA);
    const line = page.locator('.ch__name-line');

    await expect(line).toContainText('Henna West');
    await expect(line.locator('button:not(.ui-chip__remove):not(.ch__flags-add)')).toHaveCount(0);
  });

  /* --- Flags ------------------------------------------------------------------
     Removable chips on the patient's name line rather than a box of their own,
     and called what the data has always called them: a flag is a standing fact
     you act on, and it is read in the same breath as the name. */

  test('the flags read out the patient record', async ({ page }) => {
    await openChart(page, HENNA);
    const box = page.getByTestId('chart--flags');
    await expect(box).toContainText('Flags');
    await expect(box).not.toContainText('Tags');
    await expect(box).toContainText('Diabetic');
  });

  test('flags render as removable chips and removing one updates the record', async ({
    page,
  }) => {
    await openChart(page, HENNA);
    await expect(page.getByTestId('chart--flag')).toHaveCount(5);

    await page.locator('ui-chip[data-flag="diabetic"] .ui-chip__remove').click();
    await expect(page.getByTestId('chart--flag')).toHaveCount(4);
    await expect(page.getByTestId('chart--flags')).not.toContainText('Diabetic');
  });

  /**
   * The "+" beside the chips opens the flag manager: a table of what THIS
   * chart carries, one row per flag with its own Remove, and a dropdown above
   * it for adding one that is not there yet.
   *
   * It used to be a tick list of the whole vocabulary, which asked a question
   * about flags in general and made removing a standing clinical fact an act
   * of un-ticking a box.
   */
  test('the flag manager adds and removes flags on the banner', async ({ page }) => {
    await openChart(page, HENNA);
    await page.getByTestId('chart--flag-add').click();

    // The table opens on what the record actually holds — five of the seven.
    const table = page.getByTestId('chart--flag-table');
    await expect(table).toBeVisible();
    await expect(table.locator('[data-flag-remove]')).toHaveCount(5);
    await expect(table.locator('[data-flag-remove="diabetic"]')).toBeVisible();
    await expect(table.locator('[data-flag-remove="dnr"]')).toHaveCount(0);

    // …and the dropdown offers only the two it does NOT hold, so Add always
    // adds rather than sometimes doing nothing.
    const choice = page.getByTestId('chart--flag-choice').locator('select');
    await expect(choice.locator('option:not([disabled])')).toHaveCount(2);

    await choice.selectOption('dnr');
    await page.getByTestId('chart--flag-add-new').click();
    await expect(table.locator('[data-flag-remove="dnr"]')).toBeVisible();

    await table.locator('[data-flag-remove="diabetic"]').click();
    await expect(table.locator('[data-flag-remove="diabetic"]')).toHaveCount(0);

    await page.getByTestId('chart--flag-save').click();

    await expect(page.getByTestId('chart--flags')).toContainText('DNR');
    await expect(page.getByTestId('chart--flags')).not.toContainText('Diabetic');
    await expect(page.getByTestId('chart--flash')).toContainText('Flags updated');
  });

  /**
   * NOTHING IS WRITTEN UNTIL SAVE.
   *
   * The table edits a copy taken when the dialog opens, which is the whole
   * reason removal can be a one-click button: a mis-aimed Remove is undone by
   * Cancel. The tick list it replaced had no such copy — un-ticking a box was
   * reversible only by remembering what had been ticked.
   */
  test('cancelling the flag manager leaves the record alone', async ({ page }) => {
    await openChart(page, HENNA);
    const banner = page.getByTestId('chart--flags');
    const before = await banner.innerText();

    await page.getByTestId('chart--flag-add').click();
    const table = page.getByTestId('chart--flag-table');
    await table.locator('[data-flag-remove="allergy"]').click();
    await expect(table.locator('[data-flag-remove="allergy"]')).toHaveCount(0);

    await page.getByTestId('chart--flag-cancel').click();
    await expect(banner).toHaveText(before);
  });

  /**
   * With the whole vocabulary on the chart there is nothing left to add, so
   * both controls disable rather than disappear — a row that vanishes at full
   * and returns at six is a row that moves the table up and down under the
   * pointer that is removing things.
   */
  test('the add controls disable once every flag is on the chart', async ({ page }) => {
    await openChart(page, HENNA);
    await page.getByTestId('chart--flag-add').click();

    const choice = page.getByTestId('chart--flag-choice').locator('select');
    for (const key of ['highPriority', 'dnr']) {
      await choice.selectOption(key);
      await page.getByTestId('chart--flag-add-new').click();
    }

    await expect(page.getByTestId('chart--flag-table').locator('[data-flag-remove]')).toHaveCount(7);
    await expect(choice).toBeDisabled();
    await expect(page.getByTestId('chart--flag-add-new').locator('button')).toBeDisabled();
    await expect(page.getByTestId('chart--flag-choice')).toContainText(
      'Every flag is already on this chart'
    );
  });

  /* --- The quick note ----------------------------------------------------------
     A real, working field inside Special Triggers — saved on blur, not a
     decorative preview. */

  test('the quick note saves on blur', async ({ page }) => {
    await openChart(page, HENNA);
    const noteInput = page.getByTestId('chart--notes-input');

    await noteInput.fill('Call before the next visit.');
    await page.getByTestId('chart--name').click(); // blur the textarea
    await expect(noteInput).toHaveValue('Call before the next visit.');
  });

  /* --- Primary Provider box ----------------------------------------------------
     Provider, last visit and portal status/invite share the first of the three
     read-out boxes to the right of identity. */

  test('the Primary Provider box shows provider and last visit', async ({ page }) => {
    await openChart(page, HENNA);
    const box = page.getByTestId('chart--provider-portal');
    await expect(box).toContainText('Dr. Amara Mensah');
    await expect(box).toContainText('23 Oct 2025');
  });

  /* An invitation is an offer to somebody standing outside. Henna is already
     signed in, so there is nothing to offer her; Natali has an invitation out
     that nothing came of, so hers reads Resend. */

  test('an active portal offers no invitation', async ({ page }) => {
    await openChart(page, HENNA);
    await expect(page.getByTestId('chart--provider-portal')).toContainText('Active');
    await expect(page.getByTestId('chart--portal-invite')).toHaveCount(0);
  });

  test('a portal that is not active offers one, and sending it says so', async ({ page }) => {
    await openChart(page, `${SCREEN}?mrn=326477`);
    const invite = page.getByTestId('chart--portal-invite');

    await expect(invite).toHaveText('Resend invite');
    await invite.click();
    await expect(page.getByTestId('chart--flash')).toContainText('Portal invitation sent to');
  });

  /* --- Header density --------------------------------------------------------
     The identity block sits beside a single row of three read-out boxes
     (Primary Provider, Patient Balance, Special Triggers), not stacked
     beneath it. */

  test('the header fits its density budget', async ({ page }) => {
    await openChart(page, HENNA);
    const header = await page.getByTestId('chart--header').boundingBox();

    /* This test exists to catch a regression back to the old sprawling card
       grid, which ran past 500px of name, facts and boxes. Now that the alert
       notes no longer print under the identity row, the whole banner is the
       identity block and the three read-outs beside it, and the budget can be
       measured on the header itself.

       Generous, and not a pixel-exact snapshot: the point is the shape, not a
       number that breaks on font hinting. */
    expect(header.height).toBeLessThan(400);
  });

  /* --- Accessibility -------------------------------------------------------- */

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA);
    await expectNoA11yViolations(page);
  });
});

/**
 * Profile — everything Add Patient collects on its Patient Info tab
 * (screens/patient-add.html#panel-patient) that is not already on the chart
 * header: identity, contact, demographics, registration detail, information
 * sharing, chart access, providers and pharmacies. Insurance,
 * Guarantor and Billing are NOT here — they have their own home already
 * (Insurance, and the sidebar's own top-level Billing section).
 */
test.describe('profile module', () => {
  test('renders the registration record', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, `${HENNA}#profile`);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Profile');
    await expect(page.getByTestId('chart--pr-identity')).toContainText('Henna Ruth West');
    await expect(page.getByTestId('chart--pr-identity')).toContainText('•••-••-4471');
    await expect(page.getByTestId('chart--pr-contact')).toContainText('hennawest@example.com');
    await expect(page.getByTestId('chart--pr-demographics')).toContainText('Married');
    await expect(page.getByTestId('chart--pr-registration')).toContainText('326486');
    await expect(page.getByTestId('chart--pr-sharing')).toContainText('Yes');
    await expect(page.getByTestId('chart--pr-providers')).toContainText('Dr. Alan Whitcombe');
    await expect(page.getByTestId('chart--pr-providers')).toContainText('Referring');
    await expect(page.getByTestId('chart--pr-pharmacies')).toContainText('Thrifty White');

    assertClean();
  });

  /**
   * Facts the header already shows are read from the patient record, not
   * duplicated in data/profile.js — this is the one place that would drift
   * if they were copied twice.
   */
  test('shares facts with the header rather than duplicating them', async ({ page }) => {
    await openChart(page, `${HENNA}#profile`);
    await expect(page.getByTestId('chart--pr-contact')).toContainText('8642 Yule Street, Arvada CO 80007');
    await expect(page.getByTestId('chart--pr-contact')).toContainText('English');
  });

  test('a patient with a thinner registration record gets an honest empty state, not a crash', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, `${SCREEN}?mrn=326481#profile`);

    await expect(page.getByTestId('chart--pr-providers')).toContainText('No providers on file.');
    await expect(page.getByTestId('chart--pr-pharmacies')).toContainText('No pharmacies on file.');
    await expect(page.getByTestId('chart--pr-access')).toContainText('Everyone');

    assertClean();
  });

  test('Edit is an honest stub', async ({ page }) => {
    await openChart(page, `${HENNA}#profile`);
    await page.getByTestId('chart--pr-edit').locator('button').click();
    await expect(page.getByTestId('chart--flash')).toContainText('not wired up in this prototype yet');
  });

  test('no WCAG 2.1 A/AA violations on Profile @a11y', async ({ page }) => {
    await openChart(page, `${HENNA}#profile`);
    await expectNoA11yViolations(page);
  });
});

/**
 * Clinical (module id "profile-clinical") is the canonical clinical record —
 * everything the Face Sheet used to show, plus alerts, orders,
 * recommendations, recalls and history that never had a home in this
 * prototype before.
 */
test.describe('profile clinical module', () => {
  test('renders the full clinical record with real patient data', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, `${HENNA}#profile-clinical`);

    await expect(page.getByTestId('chart--pc-grid')).toBeVisible();

    const allergies = page.getByTestId('chart--pc-allergies');
    await expect(allergies).toContainText('Penicillin');
    await expect(allergies).toContainText('Severe');
    // Every detail line on these cards is "Label - value" now, the one shape
    // the reference EMR uses for all of them.
    await expect(allergies).toContainText('Onset Date - 12 Jun 2019');

    await expect(page.getByTestId('chart--pc-problems')).toContainText('K21.9');
    await expect(page.getByTestId('chart--pc-medications')).toContainText('Metformin 500mg');
    await expect(page.getByTestId('chart--pc-medications')).toContainText(
      'Reconciled 23 Oct 2025 by Ruth Adeyemi'
    );
    await expect(page.getByTestId('chart--pc-immunizations')).toContainText('Influenza, seasonal');
    await expect(page.getByTestId('chart--pc-social-history')).toContainText('Tobacco Use');
    await expect(page.getByTestId('chart--pc-surgical-history')).toContainText('Cholecystectomy');
    await expect(page.getByTestId('chart--pc-past-medical-history')).toContainText('Hypothyroidism');
    await expect(page.getByTestId('chart--pc-vitals')).toContainText('Blood pressure');
    await expect(page.getByTestId('chart--pc-orders')).toContainText('CBC with differential');
    await expect(page.getByTestId('chart--pc-recommendations')).toContainText(
      'Colorectal cancer screening'
    );
    await expect(page.getByTestId('chart--pc-recalls')).toContainText('Surveillance colonoscopy');
    await expect(page.getByTestId('chart--pc-dx-studies')).toContainText('Colonoscopy');
    await expect(page.getByTestId('chart--pc-family-history')).toContainText('Colorectal cancer');
    await expect(page.getByTestId('chart--pc-summary')).toContainText('Long-standing GI patient');

    // The upcoming appointment and the alert list are read from the shell's
    // patient data, not duplicated in the profile-clinical data file.
    await expect(page.getByTestId('chart--pc-appointments')).toContainText(
      'Post-polypectomy review'
    );
    await expect(page.getByTestId('chart--pc-alerts')).toContainText('Anaphylaxis to penicillin');

    assertClean();
  });

  test('a patient with no clinical data gets honest empty states, not a crash', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, `${SCREEN}?mrn=326481#profile-clinical`);

    await expect(page.getByTestId('chart--pc-allergies')).toContainText(
      'No known allergies documented.'
    );
    await expect(page.getByTestId('chart--pc-problems')).toContainText('No problems recorded.');
    await expect(page.getByTestId('chart--pc-devices')).toContainText(
      'No implantable devices on file.'
    );

    assertClean();
  });

  test('a Problems row expands to show onset and note', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    const row = page.getByTestId('chart--pc-problems').locator('[data-pc-problem]').filter({
      hasText: 'Type 2 diabetes',
    });

    await expect(page.getByTestId('chart--pc-problems')).not.toContainText('Diet- and metformin');
    await row.click();
    await expect(page.getByTestId('chart--pc-problems')).toContainText('Diet- and metformin');
  });

  test('the full Alerts list expands in place, independent of the header preview', async ({
    page,
  }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    const alerts = page.getByTestId('chart--pc-alerts');

    await expect(alerts).not.toContainText('Airway involvement in 2019');
    await alerts.locator('[data-pc-alert]').first().click();
    await expect(alerts).toContainText('Airway involvement in 2019');

    // The header's own preview is untouched by expanding the list here.
    await expect(page.getByTestId('chart--alert-note')).toContainText('Anaphylaxis to penicillin');
  });

  /**
   * Every card's "+" opens a real, schema-driven popup and appends to that
   * card's list — Allergies stands in for the seven cards built the same
   * way (Problems, Medications, Allergies, Immunizations, Family History,
   * Vitals). The three History cards deliberately have no "+" — see the
   * assertion further down.
   */
  test('"+" on a card opens a popup, validates, and appends the new item', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);

    await page.getByTestId('chart--pc-add-allergies').click();
    // display: contents on <ui-modal> means the custom element itself never
    // has a box to be "visible" — the same reason every other modal test in
    // this file checks .ui-modal__dialog instead.
    const dialog = page.locator('#pcAddModal .ui-modal__dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Add Allergy');

    await page.getByTestId('chart--pc-add-save').locator('button').click();
    await expect(page.getByTestId('chart--pc-field-substance')).toContainText('Enter substance.');

    await page.getByTestId('chart--pc-field-substance').locator('input').fill('Shellfish');
    await page.getByTestId('chart--pc-field-severity').locator('select').selectOption('Moderate');
    await page.getByTestId('chart--pc-add-save').locator('button').click();

    await expect(page.getByTestId('chart--flash')).toContainText('Allergy added to the chart.');
    await expect(dialog).toBeHidden();
    // New items go to the top of the list.
    await expect(page.getByTestId('chart--pc-allergies').locator('.fs__item').first()).toContainText(
      'Shellfish'
    );
  });

  /**
   * Vitals had no "+" at all before — it gets the same popup every other
   * card does, unlike Future Appointments (below), which stays read-only.
   */
  test('Vitals gets the same add popup as every other card', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);

    await page.getByTestId('chart--pc-add-vitals').click();
    await expect(page.getByTestId('chart--pc-add-modal')).toContainText('Add Vital');

    await page.getByTestId('chart--pc-field-label').locator('select').selectOption('Temperature');
    await page.getByTestId('chart--pc-field-value').locator('input').fill('98.6°F');
    await page.getByTestId('chart--pc-add-save').locator('button').click();

    await expect(page.getByTestId('chart--flash')).toContainText('Vital added to the chart.');
    // A vital is a NAME against a READING, drawn as aligned columns — the
    // name in the label grey, the reading primary — rather than the one bold
    // "Temperature: 98.6°F" run this used to assert. The whole set is ONE
    // bulleted entry, so the new reading is the first PAIR in the card, not
    // the first item. Both halves are checked so the assertion still fails if
    // either goes missing.
    const added = page.getByTestId('chart--pc-vitals').locator('.fs__pair').first();
    await expect(added.locator('.fs__pair-label')).toHaveText('Temperature');
    await expect(added.locator('.fs__pair-value')).toHaveText('98.6°F');
  });

  /**
   * Social History is a fixed questionnaire, not an open list. All nine
   * questions are drawn for every patient whether or not they have been
   * answered — the unanswered ones are what the panel is read for — and the
   * title counts them.
   */
  test('Social History draws all nine questions, answered or not', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    const card = page.getByTestId('chart--pc-social-history');

    await expect(card.locator('.fs__pair')).toHaveCount(9);
    await expect(card).toContainText('8 of 9 answered');
    // Eight answers, and the ninth question still on the page.
    await expect(card).toContainText('Former smoker');
    await expect(card).toContainText('Sexual Orientation');
    await expect(card).toContainText('Not recorded');
  });

  /**
   * THE THREE HISTORY CARDS ARE A GLANCE, NOT THE RECORD.
   *
   * They have no "+": past medical, surgical and social history are added to,
   * corrected and cleared in the History section, which reads the same file
   * these cards do. Two forms writing one record from two screens is how the
   * two screens end up disagreeing. What the cards carry instead is View All.
   */
  test('the History cards link to the History section rather than writing', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);

    for (const card of ['past-medical-history', 'surgical-history', 'social-history']) {
      await expect(page.getByTestId(`chart--pc-add-${card}`)).toHaveCount(0);
      await expect(page.getByTestId(`chart--pc-view-${card}`)).toBeVisible();
    }

    await page.getByTestId('chart--pc-view-surgical-history').click();
    await expect(page).toHaveURL(/#history$/);
    await expect(page.getByTestId('chart--history-tabs')).toBeVisible();
  });

  /**
   * Scheduling is a real workflow (provider, slot, encounter type) this
   * card's popup is deliberately too thin for — Future Appointments keeps
   * no "+", unlike every other card on this page.
   */
  test('Future Appointments has no add popup — scheduling stays out of this card', async ({
    page,
  }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    await expect(page.getByTestId('chart--pc-add-appointments')).toHaveCount(0);
  });

  test('no WCAG 2.1 A/AA violations on the add-to-card popup @a11y', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    await page.getByTestId('chart--pc-add-problems').click();
    await expectNoA11yViolations(page);
  });

  test('"View All" on Vitals navigates to the real Vitals section', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);

    await page.getByTestId('chart--pc-view-vitals').click();
    await expect(page).toHaveURL(/#vitals$/);
    await expect(page.getByTestId('chart--module-title')).toHaveText('Vitals');
  });

  test('no WCAG 2.1 A/AA violations on Clinical @a11y', async ({ page }) => {
    await openChart(page, `${HENNA}#profile-clinical`);
    await expectNoA11yViolations(page);
  });
});

/*
 * Insurance ("profile-billing") left the sidebar on 21 Aug 2026 and its
 * module is no longer imported by either shell, so the block that covered it
 * — the payer cards, Check Eligibility and its history, Add Insurance, the
 * Billing Group card — is gone with it rather than left skipped. Restore it
 * from git alongside the CHART_NAV row if the tab comes back.
 */

test.describe('forms module', () => {
  const FORMS = `${HENNA}#forms`;

  test('renders the sent forms with category, dates and status', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, FORMS);

    const table = page.getByTestId('chart--forms-table');
    await expect(table).toContainText('PHQ-9 Form');
    await expect(table).toContainText('Assessment');
    await expect(table).toContainText('Completed');
    await expect(table).toContainText('Patient Interview Form');
    await expect(table).toContainText('Consent for Treatment');

    // A pending form has no completion date.
    const intakeRow = page.locator('tr', { hasText: 'Intake Form' });
    await expect(intakeRow).toContainText('Pending');
    await expect(intakeRow).toContainText('—');

    assertClean();
  });

  test('a patient with no forms sees an honest empty state, not a crash', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, `${SCREEN}?mrn=326481#forms`);

    await expect(page.getByTestId('chart--forms-table')).toContainText(
      'No forms sent to this patient yet.'
    );

    assertClean();
  });

  test('search narrows the list to matching forms', async ({ page }) => {
    await openChart(page, FORMS);
    const table = page.getByTestId('chart--forms-table');

    await expect(table.locator('tbody tr')).toHaveCount(7);
    await page.getByTestId('chart--forms-search').locator('input').fill('consent');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table).toContainText('Consent for Treatment');
    await expect(table).not.toContainText('PHQ-9');
  });

  /* --- Assign Form ------------------------------------------------------- */

  test('the Form dropdown is disabled until a category is chosen, then cascades', async ({
    page,
  }) => {
    await openChart(page, FORMS);
    await page.getByTestId('chart--forms-assign').click();

    await expect(page.locator('#frmForm select')).toBeDisabled();
    await page.locator('#frmCategory select').selectOption('Consent');
    await expect(page.locator('#frmForm select')).toBeEnabled();

    const options = await page.locator('#frmForm select option').allTextContents();
    expect(options.join(' ')).toContain('HIPAA Acknowledgment');
    expect(options.join(' ')).not.toContain('PHQ-9');
  });

  test('assigning a form adds a pending row and flashes success', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, FORMS);
    const table = page.getByTestId('chart--forms-table');
    const before = await table.locator('tbody tr').count();

    await page.getByTestId('chart--forms-assign').click();
    await page.locator('#frmCategory select').selectOption('Consent');
    await page.locator('#frmForm select').selectOption('HIPAA Acknowledgment');
    await page.getByTestId('chart--forms-save').click();

    await expect(page.getByTestId('chart--flash')).toContainText(
      'HIPAA Acknowledgment assigned to the patient.'
    );
    await expect(table.locator('tbody tr')).toHaveCount(before + 1);

    const newRow = table.locator('tbody tr').first();
    await expect(newRow).toContainText('HIPAA Acknowledgment');
    await expect(newRow).toContainText('Pending');

    assertClean();
  });

  test('assigning without a category or form is refused', async ({ page }) => {
    await openChart(page, FORMS);
    await page.getByTestId('chart--forms-assign').click();
    await page.getByTestId('chart--forms-save').click();

    await expect(page.locator('#frmCategory')).toContainText('Choose a category');

    await page.locator('#frmCategory select').selectOption('Consent');
    await page.getByTestId('chart--forms-save').click();
    await expect(page.locator('#frmForm')).toContainText('Choose a form');
  });

  /* --- Row menu ------------------------------------------------------------ */

  test('the row menu marks a pending form complete', async ({ page }) => {
    await openChart(page, FORMS);
    const intakeRow = page.locator('tr', { hasText: 'Intake Form' });

    await intakeRow.locator('[data-form-menu]').click();
    await expect(page.locator('.frm__dropdown')).toBeVisible();
    await page.locator('.frm__dropdown-item', { hasText: 'Mark complete' }).click();

    await expect(intakeRow).toContainText('Completed');
    await expect(page.getByTestId('chart--flash')).toContainText('Intake Form marked complete.');
  });

  test('the row menu removes a form from the list', async ({ page }) => {
    await openChart(page, FORMS);
    const table = page.getByTestId('chart--forms-table');
    const before = await table.locator('tbody tr').count();

    await page
      .locator('tr', { hasText: 'Release Of Information' })
      .locator('[data-form-menu]')
      .click();
    await page.locator('.frm__dropdown-item', { hasText: 'Remove' }).click();

    await expect(table.locator('tbody tr')).toHaveCount(before - 1);
    await expect(table).not.toContainText('Release Of Information');
  });

  test('View on a completed form is an honest stub, not a dead link', async ({ page }) => {
    await openChart(page, FORMS);
    await page.getByTestId('chart--form-name').first().click();
    await expect(page.getByTestId('chart--flash')).toContainText(
      "A form's captured answers aren't viewable in this prototype yet."
    );
  });


  /**
   * Patient Interview Form and Release Of Information carry a real schema
   * (transcribed from MediNova Gastroenterology's actual forms) — clicking
   * one opens an interactive fill-out dialog instead of the generic stub,
   * and a completed one opens read-only showing what was captured.
   */
  test.describe('schema-backed forms', () => {
    test('a completed schema form opens read-only with the captured answers', async ({
      page,
    }) => {
      await openChart(page, FORMS);
      await page
        .getByTestId('chart--form-name')
        .filter({ hasText: 'Patient Interview Form' })
        .click();

      const modal = page.locator('#frmFillModal .ui-modal__dialog');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Henna West');
      await expect(modal).toContainText('20 Feb 1961'); // dob, formatted from the raw chart value
      await expect(modal).toContainText('Penicillin');
      await expect(modal).toContainText('Gastroesophageal Reflux Disease (GERD)');
      // View mode has no Save — there is nothing to submit for an already-
      // completed form.
      await expect(page.getByTestId('chart--forms-fill-save')).toHaveCount(0);
    });

    test('filling out a pending schema form captures every field type and completes it', async ({
      page,
    }) => {
      const assertClean = failOnConsoleErrors(page);
      await openChart(page, FORMS);
      const roiRow = page.locator('tr', { hasText: 'Release Of Information' });

      await roiRow.locator('[data-testid="chart--form-name"]').click();
      const modal = page.locator('#frmFillModal .ui-modal__dialog');
      await expect(modal).toBeVisible();

      // Readonly fields are prefilled from the chart, not asked for.
      await expect(page.locator('[data-field="patientName"] input')).toHaveValue('Henna West');
      await expect(page.locator('[data-field="patientName"] input')).toHaveAttribute('readonly', '');

      await page
        .locator('[data-field="releaseTo"] textarea')
        .fill('North Valley Insurance, 100 Main St, Fargo ND');
      await page
        .locator('ui-checkbox[data-field="purpose"][data-option="Insurance application"]')
        .click();
      await page
        .locator('ui-checkbox[data-field="infoTypes"][data-option="Labs report"]')
        .click();
      await page.locator('[data-field="signedBy"] input[value="Patient"]').click({ force: true });
      await page.locator('[data-field="signature"] input').fill('Henna West');
      await page.getByTestId('chart--forms-fill-save').click();

      await expect(page.getByTestId('chart--flash')).toContainText(
        'Release Of Information saved and marked complete.'
      );
      await expect(roiRow).toContainText('Completed');

      // Reopening shows exactly what was just captured, in view mode.
      await roiRow.locator('[data-testid="chart--form-name"]').click();
      const reopened = page.locator('#frmFillModal .ui-modal__dialog');
      await expect(reopened).toContainText('North Valley Insurance');
      await expect(reopened).toContainText('Insurance application');
      await expect(reopened).toContainText('Labs report');
      await expect(page.getByTestId('chart--forms-fill-save')).toHaveCount(0);

      assertClean();
    });

    test('a pending schema form offers "Fill out" instead of "Mark complete"', async ({
      page,
    }) => {
      await openChart(page, FORMS);
      const roiRow = page.locator('tr', { hasText: 'Release Of Information' });

      await roiRow.locator('[data-form-menu]').click();
      const menu = page.locator('.frm__dropdown');
      await expect(menu).toContainText('Fill out');
      await expect(menu).not.toContainText('Mark complete');
    });

    test('no WCAG 2.1 A/AA violations on the fill-out dialog @a11y', async ({ page }) => {
      await openChart(page, FORMS);
      await page
        .getByTestId('chart--form-name')
        .filter({ hasText: 'Release Of Information' })
        .click();
      await expect(page.locator('#frmFillModal .ui-modal__dialog')).toBeVisible();
      await expectNoA11yViolations(page);
    });
  });

  test('no WCAG 2.1 A/AA violations on Forms @a11y', async ({ page }) => {
    await openChart(page, FORMS);
    await expectNoA11yViolations(page);
  });
});
