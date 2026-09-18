/**
 * Scheduler — the filter rail and the Appointment / Visit Note tabs.
 *
 * Two things the screen has to get right, and neither is something a
 * screenshot would catch:
 *
 *  - the filters are a rail down the left that collapses. Collapsed, it must
 *    still say how many filters are on — a filtered list that looks like a
 *    short list is how someone concludes a patient is not booked.
 *  - the Visit Note tab is derived from the live appointment list, not a
 *    second store. A note is owed the moment the clinic has the patient, and
 *    the row's action is whatever that note is actually waiting for.
 *
 * The Triage drawer has its own spec (scheduler-triage.spec.js).
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const SCHEDULER = '/screens/scheduler.html';

const rail = (page) => page.getByTestId('sch--rail');
/* The rail's filters are real <select>s under the product's own panel, so a
   spec drives them the way it drives any select — see select-menu.spec.js. */
const providerFilter = (page) => page.getByTestId('sch--f-provider').locator('select');
const railToggle = (page) => page.getByTestId('sch--rail-toggle');
const unsignedRows = (page) => page.locator('#vnUnsignedTable tbody tr');
const signedRows = (page) => page.locator('#vnSignedTable tbody tr');

/* Tabs are addressed by the value they carry rather than by their label:
   the label is wording and wording gets revised, but `visit-notes` is the
   thing the screen actually switches to. */
const tab = (page, value) => page.locator(`#schTabs [role="tab"][data-value="${value}"]`);
const noteTab = (page, value) => page.locator(`#vnTabs [role="tab"][data-value="${value}"]`);

async function openVisitNotes(page) {
  await tab(page, 'visit-notes').click();
  await expect(page.getByTestId('sch--panel-visit-notes')).toBeVisible();
}

test.describe('scheduler filter rail', () => {
  test('the filters are a rail on the left of the table, not a bar above it', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);

    await expect(rail(page)).toBeVisible();
    await expect(railToggle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('sch--f-location')).toBeVisible();

    const railBox = await rail(page).boundingBox();
    const tableBox = await page.locator('#apptTable').boundingBox();
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(tableBox.x + 1);

    assertClean();
  });

  test('collapsing hides the fields and keeps the count of what is still filtering', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);

    // Nothing is filtering yet, so there is no count to show.
    await expect(page.getByTestId('sch--rail-count')).toBeHidden();

    await providerFilter(page).selectOption(['pr1']);
    await expect(page.getByTestId('sch--rail-count')).toHaveText('1');

    await railToggle(page).click();
    await expect(rail(page)).toHaveClass(/sch__rail--collapsed/);
    await expect(railToggle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('sch--f-location')).toBeHidden();
    // The one thing a shut rail must still say.
    await expect(page.getByTestId('sch--rail-count')).toBeVisible();

    await railToggle(page).click();
    await expect(page.getByTestId('sch--f-location')).toBeVisible();
  });

  test('a rail filter can hold more than one answer, and says both while shut', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);

    // A partner covering two colleagues wants both lists at once, not one and
    // then the other. The field is <ui-select multiple>, so the set goes in
    // the way every other multiple select in the product takes one.
    await providerFilter(page).selectOption(['pr1', 'pr3']);

    // And the CLOSED field has to say what is on. A filter that only admits
    // to itself when opened is how someone reads a narrowed list as a short
    // one (js/lib/select-menu.js, summarise).
    const face = page.getByTestId('sch--f-provider').locator('.ui-select-facade');
    await expect(face).toContainText('Olivia Rhye');
    await expect(face).toContainText('Emily Chen');

    // One filter is on, whichever number of answers it is holding.
    await expect(page.getByTestId('sch--rail-count')).toHaveText('1');
  });

  test('a filter set on the rail actually narrows the list', async ({ page }) => {
    await page.goto(SCHEDULER);
    const before = Number((await page.getByTestId('sch--count').innerText()).split(' ')[0]);

    await providerFilter(page).selectOption(['pr1']);

    const after = Number((await page.getByTestId('sch--count').innerText()).split(' ')[0]);
    expect(after).toBeLessThan(before);
    for (const text of await page.locator('#apptTable tbody tr').allInnerTexts()) {
      expect(text).toContain('Olivia Rhye');
    }
  });
});

test.describe('scheduler tabs', () => {
  test('Appointment is the tab the screen opens on', async ({ page }) => {
    await page.goto(SCHEDULER);
    await expect(tab(page, 'appointments')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('sch--panel-appointments')).toBeVisible();
    await expect(page.getByTestId('sch--panel-visit-notes')).toBeHidden();
    await expect(page.getByTestId('sch--count')).toContainText('appointments');
  });

  test('Visit Note swaps the panel and the count, and stands the rail down', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);
    await openVisitNotes(page);

    await expect(page.getByTestId('sch--panel-appointments')).toBeHidden();
    // The count names what is actually listed: "N appointments" on the schedule,
    // "N encounters" here (js/screens/scheduler.js, paint).
    await expect(page.getByTestId('sch--count')).toContainText('encounters');
    // Every rail field narrows a booking inside a period, and this list has
    // no period — so the rail steps aside rather than lying about what it does.
    await expect(rail(page)).toBeHidden();

    assertClean();
  });

  test('switching back to Appointment restores the schedule untouched', async ({ page }) => {
    await page.goto(SCHEDULER);
    const range = await page.getByTestId('sch--range').innerText();

    await openVisitNotes(page);
    await tab(page, 'appointments').click();

    await expect(page.getByTestId('sch--panel-appointments')).toBeVisible();
    await expect(rail(page)).toBeVisible();
    await expect(page.getByTestId('sch--range')).toHaveText(range);
  });
});

test.describe('visit note worklist', () => {
  test('Unsigned and Signed are separate lists, and every row offers the right action', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCHEDULER);
    await openVisitNotes(page);

    // Unsigned: nothing filed, and each row is either the author's to finish
    // or a supervising provider's to countersign.
    const unsigned = unsignedRows(page);
    expect(await unsigned.count()).toBeGreaterThan(0);
    for (const text of await unsigned.allInnerTexts()) {
      expect(text).toMatch(/Unsigned|Co-Sign/);
      expect(text).toMatch(/Open Encounter|Review & Sign/);
    }

    await noteTab(page, 'signed').click();
    const signed = signedRows(page);
    expect(await signed.count()).toBeGreaterThan(0);
    for (const text of await signed.allInnerTexts()) {
      expect(text).toContain('Signed');
      expect(text).toContain('View Note');
    }

    assertClean();
  });

  test('a co-sign row names who drafted the note the provider is being asked to sign', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);
    await openVisitNotes(page);

    const coSign = unsignedRows(page).filter({ hasText: 'Co-Sign' }).first();
    await expect(coSign).toContainText(/Drafted by .+, (NP|PA|MA)/);
    await expect(coSign.locator('ui-button')).toContainText('Review & Sign');
  });

  test('the worklist holds only visits the clinic has actually had', async ({ page }) => {
    await page.goto(SCHEDULER);
    await openVisitNotes(page);

    // A cancelled or unconfirmed booking never became a visit, so it never
    // owes a note.
    for (const text of await unsignedRows(page).allInnerTexts()) {
      expect(text).not.toContain('Cancelled');
    }
    await expect(page.getByTestId('sch--vn-range')).toContainText('awaiting signature');
  });

  test('an unfinished note opens the charting screen; one only wanting a name opens the summary', async ({
    page,
  }) => {
    await page.goto(SCHEDULER);
    await openVisitNotes(page);

    // Still being written — the clinician needs the working surface.
    await unsignedRows(page).filter({ hasText: 'Unsigned' }).first().locator('ui-button').click();
    await expect(page).toHaveURL(/encounter\.html\?appt=ap\d+/);

    await page.goBack();
    await openVisitNotes(page);

    // Written and waiting on a countersignature — a co-signer reviews a
    // document, not a screen full of input fields.
    await unsignedRows(page).filter({ hasText: 'Co-Sign' }).first().locator('ui-button').click();
    await expect(page).toHaveURL(/encounter-summary\.html\?appt=ap\d+/);
  });

  test('searching narrows the worklist the same way it narrows the schedule', async ({ page }) => {
    await page.goto(SCHEDULER);
    await openVisitNotes(page);
    const before = await unsignedRows(page).count();

    await page.getByTestId('sch--search').locator('input').fill('Kofi');
    const after = await unsignedRows(page).count();
    expect(after).toBeLessThan(before);
    for (const text of await unsignedRows(page).allInnerTexts()) {
      expect(text).toContain('Kofi Mensah');
    }
  });

  test('@a11y the visit note tab has no structural violations', async ({ page }) => {
    await page.goto(SCHEDULER);
    await openVisitNotes(page);
    await expectNoA11yViolations(page);
  });
});

/**
 * MediNova books as two entities — the clinic and the ASC — and they do not
 * offer the same visits. The switch is made once in Practice Settings and
 * every booking picker in the app follows it; a wellness visit bookable into
 * an endoscopy suite is the failure this prevents.
 */
test.describe('scheduler follows the active practice profile', () => {
  const typeOptions = (page) => page.locator('#mType select option').allTextContents();

  test('the clinic offers office visits and not the procedure list', async ({ page }) => {
    await page.goto(SCHEDULER);

    const options = (await typeOptions(page)).join('|');
    expect(options).toContain('Annual Wellness Visit');
    expect(options).not.toContain('Procedure Visit');
  });

  test('switching to the ASC swaps the bookable types', async ({ page }) => {
    await page.goto('/screens/practice-settings.html');
    await page.getByTestId('prc--profile-asc').click();

    await page.goto(SCHEDULER);
    const options = (await typeOptions(page)).join('|');
    expect(options).toContain('Procedure Visit');
    expect(options).toContain('Minor Surgical Procedure');
    // Offered by both entities, so it survives the switch.
    expect(options).toContain('Infusion Therapy');
    expect(options).not.toContain('Annual Wellness Visit');
  });
});
