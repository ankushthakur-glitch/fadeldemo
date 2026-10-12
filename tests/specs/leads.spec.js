/**
 * LEADS — the website inbox, and the one door from it into the patient system.
 *
 * The module exists to put a person between a web form and a patient record,
 * so the tests that matter are the ones that prove nothing slips past that
 * person: Convert to Patient must create NOTHING, the lead must only become
 * Converted once a patient actually exists, and the duplicate check must run
 * before creation rather than after.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';
import { openFilter, tickFilter, filterOptions } from '../helpers/filter.js';

const LEADS = '/screens/leads.html';

const rows = (page) => page.locator('#leadTable tbody tr');

/** The filters live in the standard panel. Open it, tick one, and leave it
 *  open — it does not close on a tick, which is the behaviour under test
 *  elsewhere. */
async function setFilter(page, group, value) {
  await openFilter(page, 'lead--filter');
  await tickFilter(page, group, value);
}

test.describe('leads — the list', () => {
  test('opens with the website inbox, and the nav carries no count', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(LEADS);

    /* One list, titled like every other list screen — the Active / Rejected
       tab strip went with the Rejected state. */
    await expect(page.getByTestId('lead--title')).toHaveText('Leads');
    await expect(page.getByTestId('lead--tabs')).toHaveCount(0);
    // Title only — the subtitle came off, here and everywhere else.
    await expect(page.locator('.lead__sub')).toHaveCount(0);
    await expect(page.getByTestId('lead--refresh')).toHaveCount(0);
    expect(await rows(page).count()).toBeGreaterThan(0);

    // The navigation carries no count — Leads is a section, not an alert.
    await expect(page.getByTestId('nav--leads-badge')).toHaveCount(0);

    assertClean();
  });

  test('carries every column the brief asks for', async ({ page }) => {
    await page.goto(LEADS);
    const head = page.locator('#leadTable thead');
    for (const label of ['Lead', 'DOB', 'Phone', 'Email', 'Submitted On', 'Status', 'Actions']) {
      await expect(head).toContainText(label);
    }
    // Lead IDs are not shown anywhere.
    await expect(page.locator('#leadTable')).not.toContainText('LD-102');
  });

  /**
   * Two columns that earned nothing are gone: a select checkbox whose only
   * destination was a bulk Export the header already does, and Source, which
   * printed "Website" on every row because every lead in this module is a
   * website submission. Source still rides in the CSV, and the drawer still
   * names it per lead.
   */
  test('no select column and no Source column', async ({ page }) => {
    await page.goto(LEADS);

    await expect(page.locator('#leadTable thead')).not.toContainText('Source');
    await expect(page.locator('#leadTable ui-checkbox')).toHaveCount(0);
    await expect(rows(page).first()).not.toContainText('Website');
  });

  test('search narrows by name, phone and email', async ({ page }) => {
    await page.goto(LEADS);
    const before = await rows(page).count();

    await page.getByTestId('lead--search').locator('input').fill('john.doe@email.com');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('John Doe');

    await page.getByTestId('lead--search').locator('input').fill('(701) 555-1234');
    await expect(rows(page)).toHaveCount(1);

    await page.getByTestId('lead--search').locator('input').fill('');
    await expect(rows(page)).toHaveCount(before);
  });

  test('the status filter narrows to one state', async ({ page }) => {
    await page.goto(LEADS);
    await setFilter(page, 'status', 'converted');

    const texts = await rows(page).allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((t) => expect(t).toContain('Converted'));
  });

  /* A filtered-to-nothing list is not an empty module, and must not say it is. */
  test('an empty result reads as no match, not as no leads', async ({ page }) => {
    await page.goto(LEADS);
    await page.getByTestId('lead--search').locator('input').fill('zzzzz-no-such-person');

    await expect(page.getByTestId('lead--no-match')).toBeVisible();
    await expect(page.getByTestId('lead--empty')).toBeHidden();
  });
});

test.describe('leads — no rejection', () => {
  /* The Rejected state, its tab, the reason dialog and Reopen are all gone:
     an enquiry the practice will not take is simply never converted. */
  test('nothing on the screen offers to reject a lead', async ({ page }) => {
    await page.goto(LEADS);
    await expect(rows(page)).not.toContainText('Rejected');
    await expect(page.locator('#rejectModal')).toHaveCount(0);

    await page.getByTestId('lead--menu-LD-10245').click();
    await expect(page.getByTestId('lead--menu-reject')).toHaveCount(0);
  });

  /* Three answers, and no fourth one meaning "all of them" — nothing ticked
     already says that. */
  test('the status filter offers New and Converted', async ({ page }) => {
    await page.goto(LEADS);
    await openFilter(page, 'lead--filter');
    const options = await filterOptions(page, 'status');
    expect(options.map((o) => o.trim()).filter(Boolean)).toEqual(['New', 'Converted']);
  });

  /** The bulk bar went with the checkboxes that were its only way in. Export
   *  is the header's, and exports exactly the list on screen. */
  test('Export is the header action, and there is no bulk bar', async ({ page }) => {
    await page.goto(LEADS);

    await expect(page.getByTestId('lead--export')).toBeVisible();
    await expect(page.getByTestId('lead--bulk')).toHaveCount(0);
    await expect(page.getByTestId('lead--bulk-export')).toHaveCount(0);
  });
});

test.describe('leads — the drawer', () => {
  test('a row opens the submission and its source', async ({ page }) => {
    await page.goto(LEADS);
    await rows(page).first().click();

    const drawer = page.getByTestId('lead--drawer');
    await expect(drawer).toContainText('Lead Information');
    await expect(drawer).toContainText('John Doe');
    await expect(drawer).toContainText('05/12/1985');
    await expect(drawer).not.toContainText('LD-10245');
    await expect(page.getByTestId('lead--d-convert')).toBeVisible();
    await expect(page.getByTestId('lead--d-reject')).toHaveCount(0);
    await expect(page.getByTestId('lead--d-archive')).toHaveCount(0);
    await expect(page.getByTestId('lead--d-review')).toHaveCount(0);
  });

  test('a lead the website left a gap in is flagged before conversion', async ({ page }) => {
    await page.goto(LEADS);
    await page.getByTestId('lead--search').locator('input').fill('Grace Mbeki');
    await rows(page).first().click();

    await expect(page.getByTestId('lead--d-incomplete')).toContainText('Incomplete Lead Information');
  });

  test('a converted lead shows its patient and offers the chart', async ({ page }) => {
    await page.goto(LEADS);
    await page.getByTestId('lead--search').locator('input').fill('Henna West');
    await rows(page).first().click();

    await expect(page.getByTestId('lead--d-converted')).toContainText('MRN 326486');
    await expect(page.getByTestId('lead--drawer')).toContainText('Converted by');
    await expect(page.getByTestId('lead--d-chart')).toBeVisible();
    // The lead survives conversion — it is not deleted.
    await expect(page.getByTestId('lead--d-status')).toContainText('Converted');
  });

  test('the audit trail records that the lead was viewed', async ({ page }) => {
    await page.goto(LEADS);
    await rows(page).first().click();
    await expect(page.getByTestId('lead--drawer')).toContainText('Audit trail');
    await expect(page.getByTestId('lead--drawer')).toContainText('Lead Viewed');
  });
});

test.describe('leads — convert to patient', () => {
  /* THE POINT OF THE MODULE: the button creates nothing. It opens the
     existing onboarding form, and the lead is still not a patient. */
  test('Convert opens the existing onboarding form and creates nothing', async ({ page }) => {
    await page.goto(LEADS);
    await page.getByTestId('lead--convert-LD-10245').locator('button').click();

    await expect(page).toHaveURL(/patient-add\.html\?lead=LD-10245/);
    // The real onboarding form, not a lead-specific one.
    await expect(page.getByTestId('add--first-name')).toBeVisible();

    // Still a lead, still not converted.
    await page.goto(LEADS);
    await page.getByTestId('lead--search').locator('input').fill('John Doe');
    await expect(rows(page).first()).toContainText('New');
  });

  test('the onboarding form shows the conversion banner', async ({ page }) => {
    await page.goto('/screens/patient-add.html?lead=LD-10245');

    const banner = page.getByTestId('add--lead-banner');
    await expect(banner).toContainText('Converting Lead to Patient');
    await expect(banner).toContainText('submitted through the website');
    await expect(banner).toContainText('Website Lead');
    await expect(banner).toContainText('LD-10245');
  });

  test('the five website fields are pre-filled and still editable', async ({ page }) => {
    await page.goto('/screens/patient-add.html?lead=LD-10245');

    await expect(page.getByTestId('add--first-name').locator('input')).toHaveValue('John');
    await expect(page.getByTestId('add--last-name').locator('input')).toHaveValue('Doe');
    await expect(page.getByTestId('add--dob').locator('input')).toHaveValue('1985-05-12');
    await expect(page.getByTestId('add--mobile').locator('input')).toHaveValue('(701) 555-1234');
    await expect(page.getByTestId('add--email').locator('input')).toHaveValue('john.doe@email.com');

    // Editable — the website form was filled in by the patient, not the clinic.
    await page.getByTestId('add--first-name').locator('input').fill('Jonathan');
    await expect(page.getByTestId('add--first-name').locator('input')).toHaveValue('Jonathan');
  });

  test('an ordinary new patient is untouched by any of this', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto('/screens/patient-add.html');

    await expect(page.getByTestId('add--lead-banner')).toHaveCount(0);
    await expect(page.getByTestId('add--first-name').locator('input')).toHaveValue('');
    assertClean();
  });

  test('creating the patient links the lead and marks it Converted', async ({ page }) => {
    await page.goto('/screens/patient-add.html?lead=LD-10243'); // Devon Achebe — no duplicate
    await page.getByTestId('add--save').locator('button').click();

    const done = page.getByTestId('add--created');
    await expect(done).toContainText('Patient Created Successfully');
    await expect(done).toContainText('Devon Achebe has been added');
    await expect(page.getByTestId('add--created-mrn')).toContainText('MRN:');

    await page.getByTestId('add--created-leads').locator('button').click();
    await expect(page).toHaveURL(/leads\.html/);
    await expect(page.locator('.ui-toast-region')).toContainText('Patient Created Successfully');

    await page.getByTestId('lead--search').locator('input').fill('Devon Achebe');
    await expect(rows(page).first()).toContainText('Converted');
    await expect(page.getByTestId('lead--view-patient-LD-10243')).toBeVisible();
  });

  /* Before creation, not after: a duplicate found afterwards is a merge. */
  test('a possible existing patient is raised before the patient is created', async ({ page }) => {
    // Priya Raman is already in the directory with this name and DOB.
    await page.goto('/screens/patient-add.html?lead=LD-10242');
    await page.getByTestId('add--save').locator('button').click();

    const dupe = page.getByTestId('add--dupe');
    await expect(dupe).toContainText('Possible Existing Patient');
    await expect(dupe).toContainText('similar information');
    await expect(page.getByTestId('add--dupe-view').first()).toBeVisible();

    // Nothing created yet.
    await expect(page.getByTestId('add--created')).toHaveCount(0);

    await page.getByTestId('add--dupe-continue').locator('button').click();
    await expect(page.getByTestId('add--created')).toContainText('Patient Created Successfully');
  });

  test('a lead converted elsewhere says so instead of creating a second patient', async ({ page }) => {
    await page.goto('/screens/patient-add.html?lead=LD-10230'); // already converted

    await expect(page.getByTestId('add--already')).toContainText('Lead Already Converted');
    await expect(page.getByTestId('add--already-chart')).toBeVisible();
  });
});
