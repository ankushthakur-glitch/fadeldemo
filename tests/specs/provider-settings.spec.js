/**
 * Settings → Provider: Profile, Practice, Notification, Patient Flag.
 *
 * The claim worth testing on this screen is that it does not own its own copy
 * of anything. The Profile renders the provider-onboarding definition; the
 * Practice tab renders a LOCATION record the practice administrator created.
 * Both are asserted against the shared data below rather than against literals
 * typed twice — a test that hardcodes what the profile should say would keep
 * passing on the day the two definitions drift apart.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';
import { LOCATIONS, PROVIDER_FIELDS, PROVIDER_GROUPS } from '../../data/practice.js';
import { PROVIDER, NOTIFICATION_GROUPS, PATIENT_FLAGS } from '../../data/provider-settings.js';

const HUB = '/screens/settings.html';
const PVS = '/screens/provider-settings.html';

test.describe('settings navigation', () => {
  test('the hub opens Provider Settings', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(HUB);

    await page.getByTestId('settings--provider').click();
    await page.waitForURL('**/provider-settings.html');
    await expect(page.getByRole('heading', { name: 'Provider Settings' })).toBeAttached();

    assertClean();
  });

  const SECTIONS = [
    ['settings--pvs-profile', 'profile', 'Profile'],
    ['settings--pvs-practice', 'practice', 'Practice'],
    ['settings--pvs-notification', 'notification', 'Notification'],
    ['settings--pvs-flags', 'flags', 'Patient Flag'],
  ];

  for (const [testid, tab, label] of SECTIONS) {
    test(`Provider → ${label} opens on that tab`, async ({ page }) => {
      await page.goto(HUB);
      await page.getByTestId(testid).click();
      await page.waitForURL(`**/provider-settings.html?tab=${tab}`);

      await expect(page.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    });
  }
});

test.describe('provider settings — profile', () => {
  test('opens on Profile with the provider named and badged', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PVS);

    await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('pvs--name')).toHaveText(
      `${PROVIDER.prefix} ${PROVIDER.firstName} ${PROVIDER.middleName} ${PROVIDER.lastName}, ${PROVIDER.suffix}`
    );

    const profile = page.getByTestId('pvs--profile');
    await expect(profile).toContainText(PROVIDER.title);
    await expect(profile).toContainText('Certified healthcare professional');

    assertClean();
  });

  /**
   * The point of the whole screen: every field Add Provider collects is shown
   * here, because both are generated from PROVIDER_FIELDS. A field added to
   * onboarding and forgotten here is exactly what this catches.
   */
  test('shows every field the onboarding form collects', async ({ page }) => {
    await page.goto(PVS);
    const profile = page.getByTestId('pvs--profile');

    for (const field of PROVIDER_FIELDS) {
      await expect(profile).toContainText(field.label);
      if (PROVIDER[field.key] && field.type !== 'date') {
        await expect(profile).toContainText(String(PROVIDER[field.key]));
      }
    }

    // The date is reformatted for reading, not shown as the stored ISO value.
    await expect(profile).toContainText('17/04/1982');
    await expect(profile).not.toContainText(PROVIDER.dob);
  });

  test('every repeatable group is listed, with its rows typed', async ({ page }) => {
    await page.goto(PVS);
    const profile = page.getByTestId('pvs--profile');

    // Each group's saved rows appear under a heading of their own.
    for (const group of PROVIDER_GROUPS) {
      for (const row of PROVIDER.groups[group.id]) {
        await expect(profile).toContainText(row.value);
      }
    }

    // The type leads the value — a bare number does not say which one it is.
    await expect(profile).toContainText('Mobile');
    await expect(profile).toContainText('Pager');

    // NPI and DEA are single fields, so they are NOT repeated in the list.
    await expect(profile).toContainText('Other identifiers');
    expect(PROVIDER.groups.identifications.map((r) => r.type)).not.toContain('NPI');
  });

  test('editing the profile writes back to the page', async ({ page }) => {
    await page.goto(PVS);
    await page.getByTestId('pvs--edit-profile').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The dialog is built from the same definition, so it is prefilled.
    await expect(dialog.locator('[data-pv-field="firstName"] input')).toHaveValue(
      PROVIDER.firstName
    );

    await dialog.locator('[data-pv-field="title"] input').fill('Clinical Lead, Endoscopy');
    await page.getByTestId('pvs--profile-save').click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('pvs--profile')).toContainText('Clinical Lead, Endoscopy');
  });

  test('Cancel leaves the profile untouched', async ({ page }) => {
    await page.goto(PVS);
    await page.getByTestId('pvs--edit-profile').click();

    await page.getByRole('dialog').locator('[data-pv-field="firstName"] input').fill('Nobody');
    await page.getByTestId('pvs--profile-cancel').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('pvs--name')).toContainText(PROVIDER.firstName);
    await expect(page.getByTestId('pvs--profile')).not.toContainText('Nobody');
  });

  /** The same rule onboarding applies: only the name is required. */
  test('Save is refused without a first or last name', async ({ page }) => {
    await page.goto(PVS);
    await page.getByTestId('pvs--edit-profile').click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('[data-pv-field="firstName"] input').fill('');
    await dialog.locator('[data-pv-field="lastName"] input').fill('');
    await page.getByTestId('pvs--profile-save').click();

    await expect(dialog.locator('[data-pv-field="firstName"]')).toContainText('required');
    await expect(dialog.locator('[data-pv-field="lastName"]')).toContainText('required');
    await expect(dialog).toBeVisible();
  });

  test('a repeatable group grows and shrinks', async ({ page }) => {
    await page.goto(PVS);
    await page.getByTestId('pvs--edit-profile').click();

    const emails = page.getByTestId('pvs--group-emails');
    const rows = emails.locator('.prv__row');
    const before = await rows.count();

    await emails.locator('[data-add-row]').click();
    await expect(rows).toHaveCount(before + 1);

    await rows.last().locator('[data-drop-row]').click();
    await expect(rows).toHaveCount(before);
  });
});

test.describe('provider settings — practice', () => {
  /** The provider's own working locations, as full records. */
  const sites = PROVIDER.groups.locations.map((row) =>
    LOCATIONS.find((l) => l.name === row.value)
  );

  test('shows the location this provider belongs to, from the location record', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(`${PVS}?tab=practice`);

    const site = sites[0];
    await expect(page.getByTestId('pvs--site-name')).toHaveText(site.name);

    // Everything below comes from the Add New Location form, not from a
    // second copy of the practice's details kept on this screen.
    const practice = page.getByTestId('pvs--practice');
    await expect(practice).toContainText(site.id);
    await expect(practice).toContainText(site.businessUnit);
    await expect(practice).toContainText(site.placeOfService);
    await expect(practice).toContainText(site.ids.locationNpi);
    await expect(practice).toContainText(site.address.line1);
    await expect(practice).toContainText(site.contactNumbers[0].number);
    await expect(practice).toContainText(site.billingTypes[0].type);

    assertClean();
  });

  test('a provider with two locations gets a picker, and it switches the record', async ({
    page,
  }) => {
    test.skip(sites.length < 2, 'this provider only has one working location');
    await page.goto(`${PVS}?tab=practice`);

    const picker = page.getByTestId('pvs--location-picker');
    await expect(picker).toBeVisible();

    await picker.locator('select').selectOption(sites[1].name);
    await expect(page.getByTestId('pvs--site-name')).toHaveText(sites[1].name);
    await expect(page.getByTestId('pvs--practice')).toContainText(sites[1].id);
  });

  /** Only identifiers that are set — an empty CAHPS ID row is noise. */
  test('unset location identifiers are left out', async ({ page }) => {
    await page.goto(`${PVS}?tab=practice`);
    await expect(page.getByTestId('pvs--practice')).not.toContainText('CAHPS ID');
  });

  /** A location is the practice administrator's to change, not the provider's. */
  test('Edit Details points at Practice Settings rather than editing here', async ({ page }) => {
    await page.goto(`${PVS}?tab=practice`);
    await page.getByTestId('pvs--edit-practice').click();

    await expect(page.locator('#providerFlash')).toContainText('Practice Settings');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('provider settings — notification', () => {
  test('every group and row is listed against the three channels', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(`${PVS}?tab=notification`);

    const notify = page.getByTestId('pvs--notify');
    for (const group of NOTIFICATION_GROUPS) {
      await expect(page.getByTestId(`pvs--notify-${group.id}`)).toBeVisible();
      for (const row of group.rows) await expect(notify).toContainText(row.title);
    }

    for (const channel of ['Push', 'Text', 'Email']) {
      await expect(notify.locator('thead').first()).toContainText(channel);
    }

    // The seed decides which boxes start ticked.
    const seed = NOTIFICATION_GROUPS[0].rows[0];
    const first = notify.locator(`[data-notify="${seed.id}"][data-channel="push"]`);
    await expect(first).toBeChecked({ checked: seed.push });
  });

  test('a channel can be switched on and Save reports the total', async ({ page }) => {
    await page.goto(`${PVS}?tab=notification`);

    const box = page.locator('[data-notify="invoice-nocard"][data-channel="email"]');
    await expect(box).not.toBeChecked();
    await box.check();

    await page.getByTestId('pvs--notify-save').click();
    await expect(page.locator('#providerFlash')).toContainText('preferences saved');
  });

  test('Default restores the practice defaults', async ({ page }) => {
    await page.goto(`${PVS}?tab=notification`);

    // Turn one off and another on, so the reset has both directions to undo.
    await page.locator('[data-notify="note-assigned"][data-channel="push"]').uncheck();
    await page.locator('[data-notify="note-missing"][data-channel="email"]').check();

    await page.getByTestId('pvs--notify-default').click();

    await expect(page.locator('[data-notify="note-assigned"][data-channel="push"]')).toBeChecked();
    await expect(
      page.locator('[data-notify="note-missing"][data-channel="email"]')
    ).not.toBeChecked();
    await expect(page.locator('#providerFlash')).toContainText('restored');
  });
});

/* The shared default from js/lib/pagination.js — one page of the flag list. */
const FLAG_PAGE = 15;

test.describe('provider settings — patient flag', () => {
  test('lists the flags without a count column', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(`${PVS}?tab=flags`);

    const table = page.getByTestId('pvs--flag-table');
    const head = table.locator('thead');

    // Flag Name, Color, Updated Date, Created Date, Action.
    await expect(head.locator('th')).toHaveCount(5);
    for (const column of ['Flag Name', 'Color', 'Updated Date', 'Created Date', 'Action']) {
      await expect(head).toContainText(column);
    }
    // The count of charts carrying a flag is a reporting question, not a
    // column — and a number nobody can click through to is not trusted.
    await expect(head).not.toContainText('Flags');

    // The list is paged, so the table holds one page and the footer is what
    // states the size of the whole set.
    await expect(table.locator('tbody tr')).toHaveCount(FLAG_PAGE);
    await expect(page.getByTestId('pvs-flags--range')).toHaveText(
      `1-${FLAG_PAGE} of ${PATIENT_FLAGS.length} flags`
    );
    await expect(table).toContainText('Diabetic');
    await expect(table.locator('tbody .ui-swatch')).toHaveCount(FLAG_PAGE);

    assertClean();
  });

  test('a new flag lands at the top of the list', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    const table = page.getByTestId('pvs--flag-table');

    await page.getByTestId('pvs--add-flag').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Add New Patient Flag');

    // Refused without a name.
    await page.getByTestId('pvs--flag-save').click();
    await expect(page.getByTestId('pvs--flag-name')).toContainText('required');

    await page.getByTestId('pvs--flag-name').locator('input').fill('Interpreter Needed');
    await page.getByTestId('pvs--flag-palette').locator('[data-colour]').nth(4).click();
    await page.getByTestId('pvs--flag-save').click();

    await expect(dialog).toBeHidden();
    // Page one, where the new flag is — the count is in the footer.
    await expect(page.getByTestId('pvs-flags--range')).toHaveText(
      `1-${FLAG_PAGE} of ${PATIENT_FLAGS.length + 1} flags`
    );
    await expect(table.locator('tbody tr').first()).toContainText('Interpreter Needed');
  });

  test('a duplicate flag name is refused', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    await page.getByTestId('pvs--add-flag').click();

    await page.getByTestId('pvs--flag-name').locator('input').fill('Diabetic');
    await page.getByTestId('pvs--flag-save').click();

    await expect(page.getByTestId('pvs--flag-name')).toContainText('already a flag');
  });

  test('the row menu edits a flag', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    const table = page.getByTestId('pvs--flag-table');
    const row = table.locator('tbody tr').filter({ hasText: 'Chronically late' });

    await row.locator('[data-flag-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Edit Patient Flag');
    await page.getByTestId('pvs--flag-name').locator('input').fill('Frequently late');
    await page.getByTestId('pvs--flag-save').click();

    await expect(table).toContainText('Frequently late');
    await expect(table).not.toContainText('Chronically late');
  });

  test('deleting a flag is confirmed, and Cancel keeps it', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    const table = page.getByTestId('pvs--flag-table');
    const row = table.locator('tbody tr').filter({ hasText: 'Allergic to Latex' });

    await row.locator('[data-flag-menu]').click();
    await page.getByTestId('pvs--flag-menu-delete').click();

    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete patient flag' });
    await expect(confirm).toContainText('Allergic to Latex');
    await page.getByTestId('pvs--flag-delete-cancel').click();
    await expect(page.getByTestId('pvs-flags--range')).toHaveText(
      `1-${FLAG_PAGE} of ${PATIENT_FLAGS.length} flags`
    );

    await row.locator('[data-flag-menu]').click();
    await page.getByTestId('pvs--flag-menu-delete').click();
    await page.getByTestId('pvs--flag-delete-confirm').click();

    await expect(confirm).toBeHidden();
    await expect(table).not.toContainText('Allergic to Latex');
    await expect(page.getByTestId('pvs-flags--range')).toHaveText(
      `1-${FLAG_PAGE} of ${PATIENT_FLAGS.length - 1} flags`
    );
  });
});

test.describe('provider settings — the rest', () => {
  test('each tab carries its own header action', async ({ page }) => {
    await page.goto(PVS);
    await expect(page.getByTestId('pvs--edit-profile')).toBeVisible();
    await expect(page.getByTestId('pvs--add-flag')).toBeHidden();

    await page.getByRole('tab', { name: 'Notification' }).click();
    await expect(page.getByTestId('pvs--edit-profile')).toBeHidden();
    await expect(page.getByTestId('pvs--notify-default')).toBeVisible();
    await expect(page.getByTestId('pvs--notify-save')).toBeVisible();

    await page.getByRole('tab', { name: 'Patient Flag' }).click();
    await expect(page.getByTestId('pvs--notify-save')).toBeHidden();
    await expect(page.getByTestId('pvs--add-flag')).toBeVisible();
  });

  test('the back link returns to the settings hub', async ({ page }) => {
    await page.goto(PVS);
    await page.getByTestId('pvs--back').click();
    await page.waitForURL('**/settings.html');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(PVS);
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations on Patient Flag @a11y', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    await expectNoA11yViolations(page);
  });

  test('visual — provider profile', async ({ page }) => {
    await page.goto(PVS);
    await expect(page.getByTestId('pvs--profile')).toBeVisible();
    await expect(page).toHaveScreenshot('provider-profile.png');
  });

  test('visual — provider practice', async ({ page }) => {
    await page.goto(`${PVS}?tab=practice`);
    await expect(page.getByTestId('pvs--practice')).toBeVisible();
    await expect(page).toHaveScreenshot('provider-practice.png');
  });

  test('visual — provider notification', async ({ page }) => {
    await page.goto(`${PVS}?tab=notification`);
    await expect(page.getByTestId('pvs--notify')).toBeVisible();
    await expect(page).toHaveScreenshot('provider-notification.png');
  });

  test('visual — provider patient flag', async ({ page }) => {
    await page.goto(`${PVS}?tab=flags`);
    await expect(page.getByTestId('pvs--flag-table')).toBeVisible();
    await expect(page).toHaveScreenshot('provider-flags.png');
  });
});
