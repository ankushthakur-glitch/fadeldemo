/**
 * Settings → Practice → Users: the enterprise data table (Providers and
 * Users together, filterable, sortable, bulk-actionable) and the legacy
 * single-page user form.
 */
import { USER_GROUPS } from '../../data/practice.js';
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';
import {
  openFilter,
  tickFilter,
  clearFilter,
  doneFilter,
  filterCount,
} from '../helpers/filter.js';

/** One tick in the user list's filter panel, opening it if it is shut. */
async function tick(page, group, value) {
  await openFilter(page, 'prc--filters');
  await tickFilter(page, group, value);
}

const PRC = '/screens/practice-settings.html?tab=users';
const USR = '/screens/user-add.html';

test.describe('users table', () => {
  test('lists the seed rows in a table, not cards', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PRC);

    const table = page.getByTestId('prc--user-table');
    await expect(table.locator('tbody tr')).toHaveCount(50); // page one at 50/page
    await expect(table.locator('thead')).toContainText('Name');
    await expect(table.locator('thead')).toContainText('Role');
    await expect(table.locator('thead')).toContainText('Status');
    await expect(table.locator('thead')).toContainText('Last Login');
    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 150 users');

    const first = table.locator('tbody tr').first();
    await expect(first).toContainText('Andres Hurley');
    await expect(first).toContainText('a.hurley@example.com');
    await expect(first).toContainText('Never Logged In');

    assertClean();
  });

  test('Type badges distinguish Provider from User', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');

    await expect(
      table.locator('tbody tr').filter({ hasText: 'Andres Hurley' })
    ).toContainText('User');
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Esther Howard' })
    ).toContainText('Provider');
  });

  test('the header offers Add Provider and Add User as separate actions', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--add-provider')).toBeVisible();
    await expect(page.getByTestId('prc--add-user')).toBeVisible();
  });

  test('the filter panel narrows to Providers, Users, and each status', async ({ page }) => {
    await page.goto(PRC);
    const range = page.getByTestId('usr--range');
    await tick(page, 'type', 'Provider');
    await expect(range).toHaveText('1-50 of 53 users');
    await expect(page.getByTestId('prc--user-table')).not.toContainText('Andres Hurley'); // a User
    await tick(page, 'type', 'Provider'); // untick
    await tick(page, 'type', 'User');
    await expect(range).toHaveText('1-50 of 97 users');
    await tick(page, 'type', 'User'); // untick
    await tick(page, 'status', 'Pending Invitation');
    const pendingRows = page.getByTestId('prc--user-table').locator('tbody tr');
    const pendingCount = await pendingRows.count();
    expect(pendingCount).toBeGreaterThan(0);
    for (let i = 0; i < pendingCount; i += 1) {
      await expect(pendingRows.nth(i).locator('td').nth(9)).toContainText('Pending Invitation');
    }
    await clearFilter(page);
    await expect(range).toHaveText('1-50 of 150 users');
  });

  /* Shut, the badge is the only thing left saying rows are missing. */
  test('the Filters button counts what the panel has on', async ({ page }) => {
    await page.goto(PRC);
    expect(await filterCount(page, 'prc--filters')).toBe(0);

    await tick(page, 'type', 'Provider');
    expect(await filterCount(page, 'prc--filters')).toBe(1);
    await tick(page, 'status', 'Active');
    expect(await filterCount(page, 'prc--filters')).toBe(2);

    await doneFilter(page);
    expect(await filterCount(page, 'prc--filters')).toBe(2);
    await expect(page.getByTestId('usr--range')).toHaveText('1-39 of 39 users');
  });

  test('search matches name, email, phone, or username', async ({ page }) => {
    await page.goto(PRC);
    const search = page.getByTestId('usr--search').locator('input');
    const table = page.getByTestId('prc--user-table');

    await search.fill('esther');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Esther Howard');

    await search.fill('a.mccoy@example.com');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Arlene McCoy');

    await search.fill('zzzznomatch');
    await expect(table.locator('tbody tr')).toHaveCount(0);
  });

  test('the Role filter narrows to a single role, across both Providers and Users', async ({
    page,
  }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    await tick(page, 'role', 'Physician');
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText('Physician');
    }
    await tick(page, 'role', 'Physician'); // untick
    await tick(page, 'role', 'Front Desk');
    await expect(table.locator('tbody tr').first()).toContainText('Front Desk');
    await expect(table).not.toContainText('Physician');
  });

  test('the Last Login filter narrows the list', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    await tick(page, 'lastLogin', 'Never logged in');
    await expect(table).toContainText('Never Logged In');
    await expect(table).not.toContainText(/\d{2} \w{3} \d{4} at/);
  });

  test('column sort on Last Login puts rows that never logged in first', async ({ page }) => {
    await page.goto(PRC);
    const header = page
      .getByTestId('prc--user-table')
      .locator('thead')
      .getByRole('button', { name: 'Last Login' });
    const firstRow = page.getByTestId('prc--user-table').locator('tbody tr').first();

    await header.click(); // first click — ascending
    await expect(firstRow).toContainText('Never Logged In');

    await header.click(); // second click — descending
    await expect(firstRow).not.toContainText('Never Logged In');
    await expect(firstRow).toContainText(/\d{2} \w{3} \d{4} at/);
  });

  test('a single click on the row opens the read-only profile drawer', async ({ page }) => {
    await page.goto(PRC);
    const row = page
      .getByTestId('prc--user-table')
      .locator('tbody tr')
      .filter({ hasText: 'Arlene McCoy' });

    await row.locator('td').nth(4).click(); // the phone cell — plain row background
    const dialog = page.getByRole('dialog').filter({ hasText: 'User Profile' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Arlene McCoy');
    await expect(dialog).toContainText('a.mccoy@example.com');
    await expect(dialog).toContainText('amccoy');
  });

  test('a double click on the row opens the edit drawer directly', async ({ page }) => {
    await page.goto(PRC);
    const row = page
      .getByTestId('prc--user-table')
      .locator('tbody tr')
      .filter({ hasText: 'Arlene McCoy' });

    await row.locator('td').nth(4).dblclick();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Arlene McCoy' });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('usr--onb-first').locator('input')).toHaveValue('Arlene');
    await expect(page.getByTestId('usr--onb-role').locator('select')).toHaveValue('Physician');
  });

  test('the row menu adapts to status: pending gets Resend, locked gets Unlock', async ({
    page,
  }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');

    const pendingRow = table.locator('tbody tr').filter({ hasText: 'Andres Hurley' });
    await pendingRow.locator('[data-menu]').click();
    let menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Resend Invitation' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Activate' })).toBeVisible();
    await page.keyboard.press('Escape');

    const activeRow = table.locator('tbody tr').filter({ hasText: 'Arlene McCoy' });
    await activeRow.locator('[data-menu]').click();
    menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Resend Invitation' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Deactivate' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The deterministic name generator cycles a short pool, so "Mia Walker"
    // appears twice on this page — disambiguate with the status too.
    const lockedRow = table
      .locator('tbody tr')
      .filter({ hasText: 'Mia Walker' })
      .filter({ hasText: 'Locked' });
    await expect(lockedRow).toHaveCount(1);
    await lockedRow.locator('[data-menu]').click();
    menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Unlock Account' })).toBeVisible();
  });

  test('row menu: View Profile and Edit open the same drawers as the row clicks', async ({
    page,
  }) => {
    await page.goto(PRC);
    const row = page
      .getByTestId('prc--user-table')
      .locator('tbody tr')
      .filter({ hasText: 'Esther Howard' });

    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'View Profile' }).click();
    await expect(page.getByRole('dialog').filter({ hasText: 'User Profile' })).toContainText(
      'Esther Howard'
    );
    await page.keyboard.press('Escape');

    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(
      page.getByRole('dialog').filter({ hasText: 'Edit Esther Howard' })
    ).toBeVisible();
  });

  test('Assign Role updates the row and Cancel leaves it untouched', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    const row = table.locator('tbody tr').filter({ hasText: 'Andres Hurley' });

    // Cancel — regression check: the dismiss button must actually close the dialog.
    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Assign Role' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Assign Role' });
    await expect(dialog).toBeVisible();
    await page.getByTestId('usr--assign-role-cancel').click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText('Billing Staff');

    // Save — actually reassigns.
    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Assign Role' }).click();
    await page.getByTestId('usr--assign-role-select').locator('select').selectOption('Scheduler');
    await page.getByTestId('usr--assign-role-save').click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText('Scheduler');
  });

  test('Manage Permissions pre-checks the current permissions and Cancel discards changes', async ({
    page,
  }) => {
    await page.goto(PRC);
    const row = page
      .getByTestId('prc--user-table')
      .locator('tbody tr')
      .filter({ hasText: 'Andres Hurley' });

    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Manage Permissions' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Manage Permissions' });
    const checks = page.getByTestId('usr--permissions-checks');
    // The label text lives in its own <span>, a sibling of the box — scope to
    // the <ui-checkbox> host itself so the input is reachable as a descendant.
    const viewBilling = checks.locator('ui-checkbox').filter({ hasText: 'View Billing' }).locator('input');
    const manageUsers = checks.locator('ui-checkbox').filter({ hasText: 'Manage Users' }).locator('input');
    await expect(viewBilling).toBeChecked();
    await expect(manageUsers).not.toBeChecked();

    await manageUsers.check();
    await page.getByTestId('usr--permissions-cancel').click();
    await expect(dialog).toBeHidden();

    // Discarded — reopening shows the original set, not the toggled one.
    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Manage Permissions' }).click();
    await expect(manageUsers).not.toBeChecked();

    await manageUsers.check();
    await page.getByTestId('usr--permissions-save').click();
    await expect(dialog).toBeHidden();
  });

  test('Delete removes the row after confirmation, and Cancel keeps it', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    const row = table.locator('tbody tr').filter({ hasText: 'Adrienne Warner' });

    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete user' });
    await expect(confirm).toContainText('Adrienne Warner');

    await page.getByTestId('usr--delete-cancel').click();
    await expect(confirm).toBeHidden();
    await expect(table).toContainText('Adrienne Warner');

    await row.locator('[data-menu]').click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByTestId('usr--delete-confirm').click();
    await expect(confirm).toBeHidden();
    await expect(table).not.toContainText('Adrienne Warner');
    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 149 users');
  });

  test('bulk selection reveals the bulk bar and activate/deactivate applies to every selected row', async ({
    page,
  }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    const bulkBar = page.getByTestId('usr--bulk-bar');
    await expect(bulkBar).toBeHidden();

    const rows = table.locator('tbody tr');
    await rows.nth(1).locator('.ui-table__select').check(); // Esther Howard — active
    await rows.nth(2).locator('.ui-table__select').check(); // Arlene McCoy — active

    await expect(bulkBar).toBeVisible();
    await expect(bulkBar).toContainText('2 selected');

    await bulkBar.locator('[data-bulk="deactivate"]').click();
    await expect(bulkBar).toBeHidden(); // selection clears after the action
    await expect(rows.nth(1)).toContainText('Inactive');
    await expect(rows.nth(2)).toContainText('Inactive');
  });

  test('bulk delete removes every selected row after confirmation', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    const rows = table.locator('tbody tr');

    await rows.nth(5).locator('.ui-table__select').check();
    await rows.nth(6).locator('.ui-table__select').check();

    const bulkBar = page.getByTestId('usr--bulk-bar');
    await bulkBar.locator('[data-bulk="delete"]').click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete user' });
    await expect(confirm).toContainText('2 selected users');
    await page.getByTestId('usr--delete-confirm').click();

    await expect(confirm).toBeHidden();
    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 148 users');
  });

  test('bulk export downloads a CSV of just the selected rows', async ({ page }) => {
    await page.goto(PRC);
    const table = page.getByTestId('prc--user-table');
    await table.locator('tbody tr').nth(0).locator('.ui-table__select').check();
    await table.locator('tbody tr').nth(1).locator('.ui-table__select').check();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('usr--bulk-bar').locator('[data-bulk="export"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('selected-users.csv');
  });

  test('Clear unticks every answer in the panel', async ({ page }) => {
    await page.goto(PRC);
    await tick(page, 'type', 'Provider');
    await tick(page, 'status', 'Active');
    expect(await filterCount(page, 'prc--filters')).toBe(2);

    await clearFilter(page);

    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 150 users');
    expect(await filterCount(page, 'prc--filters')).toBe(0);
  });

  test('Add Provider opens the onboarding form and blocks on a missing name', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-provider').locator('button').click();

    const form = page.getByTestId('usr--provider-form');
    await expect(form).toBeVisible();

    // The four repeatable contact groups, each seeded with one row.
    for (const group of ['addresses', 'phones', 'emails', 'identifications']) {
      await expect(page.getByTestId(`usr--pv-group-${group}`).locator('.prv__row')).toHaveCount(1);
    }

    /* Locations is NOT one of them any more. Which sites somebody works at is
       one question with a set of answers, so it is one multi-select rather
       than a stack of single pickers that could each be blank or duplicate the
       one above. */
    await expect(page.getByTestId('usr--pv-group-locations').locator('.prv__row')).toHaveCount(0);
    await expect(page.getByTestId('usr--pv-locations')).toBeVisible();

    // A group grows and shrinks.
    await page.getByTestId('usr--pv-add-phones').click();
    await expect(page.getByTestId('usr--pv-group-phones').locator('.prv__row')).toHaveCount(2);
    await page.getByTestId('usr--pv-group-phones').locator('.prv__drop').last().click();
    await expect(page.getByTestId('usr--pv-group-phones').locator('.prv__row')).toHaveCount(1);

    /* One save, and it invites — the silent "Save provider" button has gone.
       Nobody adds a clinician in order for them to be unable to sign in. */
    await expect(page.getByTestId('usr--pv-save')).toHaveCount(0);

    // Only the name is required, and it is enforced.
    await page.getByTestId('usr--pv-invite').locator('button').click();
    await expect(form).toBeVisible();
    await expect(page.getByTestId('usr--pv-first')).toHaveAttribute(
      'error',
      'A first name is required'
    );
  });

  test('a saved provider lands at the top of the directory', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-provider').locator('button').click();

    await page.getByTestId('usr--pv-first').locator('input').fill('Rosa');
    await page.getByTestId('usr--pv-last').locator('input').fill('Delgado');
    await page.getByTestId('usr--pv-group-emails').locator('.prv__value').fill('r.delgado@example.com');
    await page.getByTestId('usr--pv-invite').locator('button').click();

    await expect(page.getByTestId('usr--provider-form')).toBeHidden();
    await expect(page.getByTestId('prc--user-table').locator('tbody tr').first()).toContainText(
      'Rosa Delgado'
    );
    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 151 users');
  });

  test('Add User opens the onboarding drawer and blocks on missing required fields', async ({
    page,
  }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-user').click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add User' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Basic Information');
    await expect(dialog).toContainText('Contact Information');
    // No provider-specific fields on the user form.
    await expect(dialog).not.toContainText('NPI');
    await expect(dialog).not.toContainText('DEA');

    await page.getByTestId('usr--onboard-save').click();
    await expect(page.getByTestId('usr--onb-first')).toContainText('required');
    await expect(page.getByTestId('usr--onb-email')).toContainText('required');
    await expect(page.getByTestId('usr--onb-role')).toContainText('Pick a role');
    await expect(dialog).toBeVisible();
  });

  /**
   * Permissions are not asked for on the way in.
   *
   * They come from the role, by way of the department that role sits in,
   * which is what makes "who can touch billing" answerable without opening
   * every profile. Asking again here
   * offered a second, emptier answer: whoever added the user ticked boxes
   * from memory and silently overwrote the grant they were meant to inherit.
   * Changing them is Manage Permissions' job, against a user who exists.
   */
  test('Add User does not ask for permissions', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-user').click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add User' });
    await expect(dialog).not.toContainText('Permissions');
    await expect(page.getByTestId('usr--onb-permissions')).toHaveCount(0);
    // The sections that remain, in order.
    /* Login Credentials has gone: an invited user picks their own sign-in
       when they accept, so a username typed here by somebody else was either
       overwritten or left stale. Invitation & Status is now just Status, with
       the two answers a person actually decides between — Pending Invitation,
       Locked and Suspended are states the system reaches, not choices a form
       makes. Role gained Location, because the practice runs two sites with
       different rosters. */
    await expect(dialog.locator('.prc__mini-head')).toHaveText([
      'Basic Information',
      'Contact Information',
      'Role & Location',
      'Status',
    ]);
    await expect(page.getByTestId('usr--onb-username')).toHaveCount(0);
    await expect(page.getByTestId('usr--onb-location')).toBeVisible();
    await expect(page.getByTestId('usr--onb-status').locator('option')).toHaveText([
      '',
      'Active',
      'Inactive',
    ]);
  });

  /** Editing an existing user still shows the grant being edited. */
  test('the Edit form keeps the permissions it is editing', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--user-table').locator('[data-menu]').first().click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();

    await expect(page.getByTestId('usr--onb-permissions')).toBeVisible();
  });

  /**
   * A user created with no grant could open nothing, and the reason would be
   * invisible — no box was unticked, the question was never asked. So the ROLE
   * decides — it names a home department, and the department names the grant
   * (RM-047 took the Department field off this form) — and Manage Permissions
   * shows what was inherited. Billing Staff is a Billing role, so this asserts
   * exactly the grant the Department picker used to produce.
   */
  test('a new user inherits the permissions their role earns', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-user').click();

    await page.getByTestId('usr--onb-first').locator('input').fill('Nadia');
    await page.getByTestId('usr--onb-last').locator('input').fill('Farouk');
    await page.getByTestId('usr--onb-email').locator('input').fill('n.farouk@example.com');
    await page.getByTestId('usr--onb-role').locator('select').selectOption('Billing Staff');
    await page.getByTestId('usr--onboard-save').click();

    await page.getByTestId('usr--search').locator('input').fill('Nadia');
    await page.getByTestId('prc--user-table').locator('[data-menu]').first().click();
    await page.getByRole('menuitem', { name: 'Manage Permissions' }).click();

    const checks = page.getByTestId('usr--permissions-checks');
    await expect(checks.locator('input:checked')).toHaveCount(2); // Billing's grant
    await expect(checks.locator('ui-checkbox:has(input:checked)')).toHaveText([
      'View Billing',
      'Edit Billing',
    ]);
  });

  test('a new user lands at the top of the list once required fields are filled', async ({
    page,
  }) => {
    await page.goto(PRC);
    await page.getByTestId('prc--add-user').click();

    await page.getByTestId('usr--onb-first').locator('input').fill('Priya');
    await page.getByTestId('usr--onb-last').locator('input').fill('Raman');
    await page.getByTestId('usr--onb-email').locator('input').fill('p.raman@example.com');
    await page.getByTestId('usr--onb-role').locator('select').selectOption('Scheduler');

    await page.getByTestId('usr--onboard-save').click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Add User' })).toBeHidden();

    const table = page.getByTestId('prc--user-table');
    await expect(table.locator('tbody tr').first()).toContainText('Priya Raman');
    await expect(page.getByTestId('usr--range')).toHaveText('1-50 of 151 users');
  });

  test('an empty result shows the illustrated empty state with both CTAs', async ({ page }) => {
    await page.goto(PRC);
    await page.getByTestId('usr--search').locator('input').fill('zzzznomatch');

    await expect(page.getByTestId('prc--user-table')).toBeHidden();
    const empty = page.getByTestId('usr--empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No users found.');
    await expect(page.getByTestId('usr--empty-add-user')).toBeVisible();
    await expect(page.getByTestId('usr--empty-add-provider')).toBeVisible();

    await page.getByTestId('usr--empty-add-user').click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Add User' })).toBeVisible();
  });

  test('pagination offers 50/100/250 — the enterprise sizes, not the site-wide 10/15/25/50', async ({
    page,
  }) => {
    await page.goto(PRC);
    const options = page.getByTestId('usr--rows-per-page').locator('option');
    await expect(options).toHaveText(['50', '100', '250']);

    await page.getByTestId('usr--rows-per-page').selectOption('100');
    await expect(page.getByTestId('prc--user-table').locator('tbody tr')).toHaveCount(100);
    await expect(page.getByTestId('usr--range')).toHaveText('1-100 of 150 users');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(PRC);
    await expectNoA11yViolations(page);
  });

  test('visual — users table', async ({ page }) => {
    await page.goto(PRC);
    await expect(page.getByTestId('prc--user-table')).toBeVisible();
    await expect(page).toHaveScreenshot('users-table.png');
  });
});

test.describe('user form', () => {
  test('carries the gGastro User Form sections', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(USR);

    const form = page.locator('#userForm');
    for (const section of [
      'User Form', 'Authentication for signing',
      'Login Restrictions', 'Last Login / Logout', 'Groups',
    ]) {
      await expect(form).toContainText(section);
    }

    /* Login Information has gone. Whoever fills this form in is not the person
       who will sign in with it, and setting somebody else's password means
       telling them what it is — which is how a shared credential starts. The
       two things in that block that were NOT credentials, the sign-in alert
       and the break-the-glass grant, are answered with permissions. */
    await expect(form).not.toContainText('Login Information');
    await expect(page.getByTestId('usr--password')).toHaveCount(0);
    await expect(page.getByTestId('usr--username')).toHaveCount(0);

    assertClean();
  });

  test('offers exactly the six practice roles', async ({ page }) => {
    await page.goto(USR);
    const options = page.getByTestId('usr--role').locator('select option');
    // Six roles plus the placeholder.
    await expect(options).toHaveCount(7);
    await expect(options).toContainText([
      '',
      'Administrator-Superuser',
      'Billing',
      'Clinical',
      'Front Desk',
      'Physician-Superuser',
      'Provider',
    ]);
  });

  test('authentication defaults to the organisation preference', async ({ page }) => {
    await page.goto(USR);
    const group = page.getByTestId('usr--auth-mode');
    await expect(group.getByRole('radio', { name: 'Use Organization Preference' })).toBeChecked();
    await expect(group.getByRole('radio', { name: 'Require a Sign PIN' })).not.toBeChecked();
  });

  /* No password-strength test any more: the meter measured a field this form
     no longer takes. See the section assertion above. */

  test('login restrictions can be added and removed', async ({ page }) => {
    await page.goto(USR);
    const body = page.locator('#restrictionTable tbody');
    await expect(body.locator('.prc__mini-empty')).toBeVisible();

    await page.locator('[data-mini-add="restrictions"]').click();
    await expect(body.locator('tr')).toHaveCount(1);
    await expect(body.locator('input[type="date"]')).toHaveCount(2);
    await expect(body.locator('input[type="time"]')).toHaveCount(2);

    await body.locator('[data-remove-restriction]').click();
    await expect(body.locator('.prc__mini-empty')).toBeVisible();
  });

  /**
   * Groups is the picker down the right of this form. The old multi-row
   * Locations panel that used to head that column is still gone (RM-048) — a
   * single Location dropdown now sits with the rest of the user's own details
   * on the left, because the practice runs a clinic and a surgery centre with
   * different rosters and the record has to be able to tell them apart.
   */
  test('groups are pickable, and the site is asked once, on the left', async ({ page }) => {
    await page.goto(USR);
    await expect(page.getByTestId('usr--location')).toBeVisible();
    /* Every group, not a sample: the picker is built straight from
       USER_GROUPS, and the old assertion here said 4 — a number that had not
       been true since the group list grew past it. Asserting the real length
       keeps the test honest as that list changes. */
    await expect(page.getByTestId('usr--groups').locator('.prc__pick')).toHaveCount(
      USER_GROUPS.length
    );

    const first = page.getByTestId('usr--groups').locator('ui-checkbox').first();
    await first.locator('input').check();
    await expect(first.locator('input')).toBeChecked();
  });

  test('Save blocks on missing required fields', async ({ page }) => {
    await page.goto(USR);
    await page.getByTestId('usr--save').locator('button').click();

    await expect(page.locator('#formStatus')).toContainText('required field');
    await expect(page.getByTestId('usr--first-name')).toContainText('required');
    await expect(page.getByTestId('usr--role')).toContainText('Pick a role');
    expect(page.url()).toContain('user-add.html');
  });

  test('Save returns to the Users tab once complete', async ({ page }) => {
    await page.goto(USR);
    await page.getByTestId('usr--first-name').locator('input').fill('Priya');
    await page.getByTestId('usr--last-name').locator('input').fill('Raman');
    await page.getByTestId('usr--email').locator('input').fill('p.raman@example.com');
    await page.getByTestId('usr--role').locator('select').selectOption('Clinical');

    await page.getByTestId('usr--save').locator('button').click();
    await page.waitForURL('**/practice-settings.html?tab=users');
    await expect(page.getByRole('tab', { name: 'Users' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('back link returns to the Users tab', async ({ page }) => {
    await page.goto(USR);
    await page.getByTestId('usr--back').click();
    await page.waitForURL('**/practice-settings.html?tab=users');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(USR);
    await expectNoA11yViolations(page);
  });

  test('visual — user form', async ({ page }) => {
    await page.goto(USR);
    await expect(page.locator('#userForm')).toBeVisible();
    await expect(page).toHaveScreenshot('user-form.png');
  });
});
