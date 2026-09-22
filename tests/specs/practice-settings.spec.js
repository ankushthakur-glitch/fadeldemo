/**
 * Settings → Practice: Profile, Locations, Users.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';


/* The shared default from js/lib/pagination.js — one page of the paged
   settings lists. */
const LOCATION_PAGE = 15;
const HUB = '/screens/settings.html';
const PRC = '/screens/practice-settings.html';
const LOC = '/screens/location-add.html';

test.describe('practice settings', () => {
  test('reachable from the settings hub', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(HUB);

    await page.getByTestId('settings--practice').click();
    await page.waitForURL('**/practice-settings.html');
    await expect(page.getByRole('heading', { name: 'Practice Settings' })).toBeAttached();

    assertClean();
  });

  /* --- Profile ------------------------------------------------------------ */

  test('profile shows the identity card and basic information', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PRC);

    await expect(page.locator('#panel-profile .prc__name')).toHaveText(
      'GastroEMR Gastroenterology Clinic'
    );
    const info = page.getByTestId('prc--basic-info');
    await expect(info).toContainText('Practice Fax Number');
    await expect(info).toContainText('Billing Address');
    await expect(info).toContainText('Practice Office Hours');

    // Seven days listed, Sunday closed.
    await expect(info.locator('.prc__hours-row')).toHaveCount(7);
    await expect(info.locator('.prc__hours-row').last()).toContainText('Closed');

    assertClean();
  });

  /* --- Two practice profiles: Clinic and ASC -------------------------------
     MediNova bills as two entities. The switcher decides which one you are
     working as, and the choice reaches past this screen — see
     data/practice.js. A fresh browser context has nothing stored, so every
     test below starts on the clinic. */

  test('the profile switcher offers both entities, clinic held down first', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PRC);

    await expect(page.getByTestId('prc--profile-clinic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('prc--profile-asc')).toHaveAttribute('aria-pressed', 'false');

    assertClean();
  });

  test('switching to the ASC swaps NPI, office hours and billing together', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--profile-npi')).toHaveText('2365987458');

    await page.getByTestId('prc--profile-asc').click();

    await expect(page.getByTestId('prc--profile-name')).toHaveText('GastroEMR Gastroenterology ASC');
    // A group NPI belongs to the billing entity, and the ASC's is not the
    // clinic's — this is the fact the whole split exists for.
    await expect(page.getByTestId('prc--profile-npi')).toHaveText('1215455217');

    // Procedure lists start before the clinic opens and the suites are dark
    // at the weekend.
    const hours = page.getByTestId('prc--profile-hours');
    await expect(hours.locator('.prc__hours-row').first()).toContainText('06.30 AM - 03.00 PM');
    await expect(hours.locator('.prc__hours-row').nth(5)).toContainText('Closed');

    const billing = page.getByTestId('prc--billing-info');
    await expect(billing).toContainText('Facility');
    await expect(billing).toContainText('UB-04 (837I)');
    await expect(billing).toContainText('Ambulatory Surgical Center (24)');
    await expect(billing).toContainText('351302');
  });

  test('the clinic bills professionally, the ASC as a facility', async ({ page }) => {
    await page.goto(PRC);

    const billing = page.getByTestId('prc--billing-info');
    await expect(billing).toContainText('Professional');
    await expect(billing).toContainText('CMS-1500 (837P)');
    await expect(billing).toContainText('Office (11)');
    // A CCN is a facility number, so the clinic has none. The row stays and
    // shows an em dash: a field quietly dropped reads as one nobody has
    // filled in yet.
    await expect(billing).toContainText('CMS Certification Number');
    await expect(billing.locator('.prc__muted')).toHaveCount(1);
    // …and the CLIA the clinic's lab does hold is printed, not dashed.
    await expect(billing).toContainText('34D2109887');
  });

  test('each profile counts only the appointment types it offers', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--profile-type-count')).toHaveText('13 offered here');

    await page.getByTestId('prc--profile-asc').click();
    await expect(page.getByTestId('prc--profile-type-count')).toHaveText('4 offered here');
  });

  test('the chosen profile survives a page load', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--profile-asc').click();

    await page.goto(PRC);
    await expect(page.getByTestId('prc--profile-asc')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('prc--profile-npi')).toHaveText('1215455217');
  });

  test('Edit Details rebuilds against the profile you switched to', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--profile-asc').click();
    await page.getByTestId('prc--edit-profile').locator('button').click();

    await expect(page.getByTestId('prc--practice-name').locator('input')).toHaveValue(
      'GastroEMR Gastroenterology ASC'
    );
  });

  test('the header action swaps with the tab', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--edit-profile')).toBeVisible();
    await expect(page.getByTestId('prc--add-location')).toBeHidden();

    await page.getByRole('tab', { name: 'Locations' }).click();
    await expect(page.getByTestId('prc--add-location')).toBeVisible();
    await expect(page.getByTestId('prc--edit-profile')).toBeHidden();

    await page.getByRole('tab', { name: 'Users' }).click();
    await expect(page.getByTestId('prc--add-user')).toBeVisible();
    await expect(page.getByTestId('prc--add-location')).toBeHidden();
  });

  test('Edit Details opens the profile form prefilled', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--edit-profile').locator('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Edit Practice Profile');
    await expect(page.getByTestId('prc--practice-name').locator('input')).toHaveValue(
      'GastroEMR Gastroenterology Clinic'
    );
    // The whole shape is there: addresses and office hours.
    await expect(dialog).toContainText('Physical Address');
    await expect(dialog).toContainText('Billing Address');
    await expect(dialog.getByTestId('prc--hours-edit').locator('.prc__hours-edit-row')).toHaveCount(7);
  });

  test('"Same as Physical Address" copies the address across', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--edit-profile').locator('button').click();

    const sections = page.getByRole('dialog').locator('.prc__section');
    const billingCity = sections.nth(1).locator('ui-input').nth(2).locator('input');
    await expect(billingCity).toHaveValue('Oglesby');

    await page.getByRole('dialog').getByTestId('prc--same-as-physical').locator('input').check();
    await expect(billingCity).toHaveValue('Fargo');
  });

  test('closing a day disables its office-hour fields', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--edit-profile').locator('button').click();

    const monday = page.getByRole('dialog').getByTestId('prc--hours-monday');
    const row = monday.locator('xpath=ancestor::div[contains(@class,"prc__hours-edit-row")]');
    await expect(row.locator('input[type="time"]').first()).toBeEnabled();

    await monday.locator('input').uncheck();
    await expect(row.locator('input[type="time"]').first()).toBeDisabled();
  });

  test('the ID qualifier repeater adds and removes rows', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--edit-profile').locator('button').click();

    const rows = page.getByRole('dialog').locator('.prc__repeater-row');
    await expect(rows).toHaveCount(1);

    await page.getByRole('dialog').getByTestId('prc--add-qualifier').locator('button').click();
    await expect(rows).toHaveCount(2);

    await rows.last().locator('[data-remove-qualifier]').click();
    await expect(rows).toHaveCount(1);

    // The last row is never removed — the field set must stay usable.
    await rows.first().locator('[data-remove-qualifier]').click();
    await expect(rows).toHaveCount(1);
  });

  /* --- Locations ---------------------------------------------------------- */

  test('locations list every site, with its status and its actions', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();

    const table = page.getByTestId('prc--location-table');

    // Colour, name, address, status, actions.
    const head = table.locator('thead');
    await expect(head.locator('th')).toHaveCount(5);
    for (const column of ['Color', 'Name', 'Located at', 'Status', 'Action']) {
      await expect(head).toContainText(column);
    }
    for (const dropped of ['Business Unit', 'Teaching Status', 'Location NPI', 'Tax Rate']) {
      await expect(head).not.toContainText(dropped);
    }

    // No status filter any more, so every site is listed — inactive included.
    // The list is paged, so "every site" is counted by the strip and the
    // footer rather than by the rows on screen.
    await expect(page.getByTestId('prc--location-filter')).toHaveCount(0);
    await expect(table.locator('tbody tr')).toHaveCount(LOCATION_PAGE);
    await expect(table).toContainText('Moorhead Annexe');
    await expect(page.getByTestId('prc--location-count')).toHaveText('52 of 52 locations');
    await expect(page.getByTestId('prc-locations--range')).toHaveText(
      `1-${LOCATION_PAGE} of 52 locations`
    );
    await expect(table.locator('tbody .ui-swatch')).toHaveCount(LOCATION_PAGE);

    // The switch reads the state it changes.
    const moorhead = table.locator('tbody tr').filter({ hasText: 'Moorhead Annexe' });
    await expect(moorhead).toContainText('Inactive');
    await expect(moorhead.locator('[data-location-status] input')).not.toBeChecked();
  });

  test('the search box narrows the list by name or address', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    const table = page.getByTestId('prc--location-table');
    const search = page.getByTestId('prc--location-search').locator('input');

    await search.fill('Moorhead Annexe');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('prc--location-count')).toHaveText('1 of 52 locations');

    // Not just the name — where the site is counts too.
    await search.fill('Fargo');
    await expect(table.locator('tbody tr').first()).toBeVisible();
    await expect(table).not.toContainText('Moorhead Annexe');

    await search.fill('nowhere at all');
    await expect(table.locator('tbody tr')).toHaveCount(0);
  });

  /** The switch in the row is the status change — no dialog in between. */
  test('a location is activated from its row', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    const table = page.getByTestId('prc--location-table');
    const moorhead = table.locator('tbody tr').filter({ hasText: 'Moorhead Annexe' });

    await moorhead.locator('[data-location-status] input').check();
    await expect(moorhead).toContainText('Active');
    await expect(moorhead.locator('[data-location-status] input')).toBeChecked();

    // And back again.
    await moorhead.locator('[data-location-status] input').uncheck();
    await expect(moorhead).toContainText('Inactive');
  });

  /** The detail dialog's own toggle still works, and the row follows it. */
  test('a location is activated from its detail dialog', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    const table = page.getByTestId('prc--location-table');

    await page.locator('[data-open-location="MN35355"]').click();
    const status = page.getByTestId('prc--detail-status');
    await expect(status).toContainText('Inactive');
    await status.locator('input').check();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Moorhead Annexe' })
    ).toContainText('Active');
  });

  test('the Action column edits a location', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();

    await page.locator('[data-edit-location="ND65258"]').click();
    await page.waitForURL('**/location-add.html?id=ND65258');
    await expect(page.getByTestId('loc--title')).toContainText('Edit');
  });

  /** A site every appointment and claim points at is not deleted on one click. */
  test('the Action column deletes a location, once confirmed', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    const table = page.getByTestId('prc--location-table');

    await page.locator('[data-delete-location="MN35355"]').click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete location' });
    await expect(confirm).toContainText('Moorhead Annexe');

    await page.getByTestId('prc--location-delete-cancel').click();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId('prc-locations--range')).toHaveText(
      `1-${LOCATION_PAGE} of 52 locations`
    );

    await page.locator('[data-delete-location="MN35355"]').click();
    await page.getByTestId('prc--location-delete-confirm').click();

    await expect(confirm).toBeHidden();
    await expect(table).not.toContainText('Moorhead Annexe');
    await expect(page.getByTestId('prc--location-count')).toHaveText('51 of 51 locations');
  });

  /**
   * Adding a location is a PAGE, not a dialog. The form has eleven panels,
   * which in a dialog meant a scrollbar inside a scrollbar.
   */
  test('Add New Location opens its own page', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    await page.getByTestId('prc--add-location').locator('button').click();

    await page.waitForURL('**/location-add.html');
    await expect(page.getByTestId('loc--title')).toHaveText('Add New Location');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('clicking a location opens its full record in a dialog', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();

    await page.locator('[data-open-location="ND34792"]').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('GastroEMR Gastroenterology ASC');

    // Everything the table no longer shows is here.
    const detail = page.getByTestId('prc--location-detail');
    await expect(detail).toContainText('Business Unit');
    await expect(detail).toContainText('Non Teaching');
    await expect(detail).toContainText('1215455217');   // Location NPI
    await expect(detail).toContainText('34D2109887');    // CLIA
    await expect(detail).toContainText('58104-7080');    // ZIP
    await expect(detail).toContainText('0.00 %');        // Tax rate
    await expect(detail).toContainText('(701) 639-4550'); // Contact numbers
    await expect(detail).toContainText('Facility');       // Billing type

    // Only identifiers that are set are listed.
    await expect(detail).not.toContainText('CAHPS ID');
  });

  test('the detail dialog links through to editing', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Locations' }).click();
    await page.locator('[data-open-location="ND65258"]').first().click();

    await page.getByTestId('prc--detail-edit').locator('button').click();
    await page.waitForURL('**/location-add.html?id=ND65258');
  });

  test('editing a location loads it into the same page', async ({ page }) => {
    // Reached from the detail dialog's Edit button — see the test above.
    await page.goto(`${LOC}?id=ND34792`);

    await expect(page.getByTestId('loc--title')).toContainText('Edit');
    await expect(page.getByTestId('loc--name').locator('input')).toHaveValue(
      'GastroEMR Gastroenterology ASC'
    );
    // Identifiers come through too.
    await expect(page.locator('[data-id-field="locationNpi"]').locator('input')).toHaveValue(
      '1215455217'
    );
  });

  test('the back link returns to the Locations tab', async ({ page }) => {
    await page.goto(LOC);
    await page.getByTestId('loc--back').click();
    await page.waitForURL('**/practice-settings.html?tab=locations');
    await expect(page.getByRole('tab', { name: 'Locations' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('prc--location-table')).toBeVisible();
  });
});

test.describe('location form', () => {
  test('carries the whole Location Form field set', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(LOC);

    const form = page.locator('#locationForm');
    for (const section of [
      'Location Form', 'Contact Person', 'Located at',
      'Contact Numbers', 'Billing type per business unit', 'Cost Centers',
      "Location ID's", 'Users', 'Connection Mappings', 'DFT Billing Type',
    ]) {
      await expect(form).toContainText(section);
    }

    /* NO PATIENT PORTAL SECTION. Show on Portal, portal default and a second
       display name to show patients: the portal reads none of the three and
       never has — it has its own site list and its own copy. What they bought
       was a second name for a place that already has one. */
    await expect(form).not.toContainText('Patient Portal');
    await expect(page.getByTestId('loc--show-on-portal')).toHaveCount(0);
    await expect(page.getByTestId('loc--show-as')).toHaveCount(0);

    // All twelve identifiers from the legacy form are present.
    await expect(form.locator('[data-id-field]')).toHaveCount(12);
    await expect(form).toContainText('Syndromic Surveillance ID');
    await expect(form).toContainText('340B Location ID');

    assertClean();
  });

  test('refuses to save without a name, then returns to the list', async ({ page }) => {
    await page.goto(LOC);

    await page.getByTestId('loc--save').locator('button').click();
    expect(page.url()).toContain('location-add.html');
    await expect(page.getByTestId('loc--name')).toContainText('required');
    await expect(page.locator('#formStatus')).toContainText('required');

    await page.getByTestId('loc--name').locator('input').fill('Bismarck Clinic');
    await page.getByTestId('loc--save').locator('button').click();
    await page.waitForURL('**/practice-settings.html?tab=locations');
  });

  test('choosing a colour updates the swatch beside it', async ({ page }) => {
    await page.goto(LOC);
    await page.getByTestId('loc--colour').locator('select').selectOption('#339900');
    await expect(page.getByTestId('loc--colour-preview')).toHaveCSS(
      'background-color',
      'rgb(51, 153, 0)'
    );
  });

  test('a mini table adds and removes its own rows', async ({ page }) => {
    await page.goto(LOC);

    const contacts = page.locator('[data-mini="contactNumbers"]');
    await expect(contacts.locator('.prc__mini-empty')).toBeVisible();

    await contacts.locator('[data-mini-add]').click();
    await expect(contacts.locator('tbody tr')).toHaveCount(1);
    await expect(contacts.locator('.prc__mini-empty')).toHaveCount(0);

    await contacts.locator('[data-mini-add]').click();
    await expect(contacts.locator('tbody tr')).toHaveCount(2);

    await contacts.locator('[data-mini-remove]').first().click();
    await expect(contacts.locator('tbody tr')).toHaveCount(1);

    // Emptying it puts the placeholder back.
    await contacts.locator('[data-mini-remove]').first().click();
    await expect(contacts.locator('.prc__mini-empty')).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(LOC);
    await expectNoA11yViolations(page);
  });

  test('visual — location form', async ({ page }) => {
    await page.goto(LOC);
    await expect(page.locator('#locationForm')).toBeVisible();
    await expect(page).toHaveScreenshot('location-form.png');
  });
});

test.describe('practice users', () => {
  // Table content, filters, drawers and row actions are covered in detail by
  // user-form.spec.js; this only checks the tab renders the directory.
  test('the users tab lists the seed rows', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Users' }).click();

    const table = page.getByTestId('prc--user-table');
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(table).toContainText('Andres Hurley');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(PRC);
    await expectNoA11yViolations(page);
  });

  test('visual — practice profile', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--basic-info')).toBeVisible();
    await expect(page).toHaveScreenshot('practice-profile.png');
  });

  test('visual — practice users', async ({ page }) => {
    await page.goto(PRC);
    await page.getByRole('tab', { name: 'Users' }).click();
    await expect(page.getByTestId('prc--user-table')).toBeVisible();
    await expect(page).toHaveScreenshot('practice-users.png');
  });
});
