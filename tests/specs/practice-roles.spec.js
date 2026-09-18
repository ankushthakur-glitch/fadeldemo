/**
 * Practice Settings → Roles & Responsibility.
 *
 * The permission matrix is the highest-consequence screen in the product: it
 * decides who can delete a claim and who can see a chart. So the tests are
 * weighted towards the things that would be dangerous if wrong — that the
 * grid cannot be changed without entering edit mode, that nothing is written
 * until Save, and that the pending count matches what was actually toggled.
 *
 * The roles listed here are the roles Add User assigns — one vocabulary, not
 * two — so there is nothing to create or delete on this screen.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const ROLES = '/screens/practice-settings.html?tab=roles';

/** data/practice-roles.js: 28 features across 5 groups, 8 actions. */
const FEATURE_COUNT = 28;
const GROUP_COUNT = 5;

const matrixRows = (page) => page.locator('.rol__table tbody tr[data-row]');

/** The role is chosen from the Role Type dropdown, not a row of chips. */
const pickRole = async (page, id) => {
  const select = page.getByTestId('rol--role-select').locator('select');
  await select.selectOption(id);
  await select.dispatchEvent('change');
};

test.describe('roles & responsibility — reading', () => {
  test('opens on the first assignable role with the full matrix', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(ROLES);

    await expect(page.getByRole('tab', { name: 'Roles & Responsibility' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('rol--role-select').locator('select')).toHaveValue('physician');
    await expect(matrixRows(page)).toHaveCount(FEATURE_COUNT);

    assertClean();
  });

  test('the roles listed are the roles Add User assigns', async ({ page }) => {
    await page.goto(ROLES);
    // The empty first option is <ui-select>'s placeholder, shared by every
    // select in the app.
    const select = page.getByTestId('rol--role-select').locator('select');
    const names = select.locator('option:not([value=""])');

    // PROVIDER_ROLES (26) + STAFF_ROLES (36) from data/practice.js.
    await expect(names).toHaveCount(62);

    /* Sampled rather than listed in full. The vocabulary is the practice's own
       and grows whenever it hires a job it did not have before; a spec that
       repeats all sixty-two of them in order fails on the next hire without
       anything being wrong. What has to hold is that both halves of the list
       reach this dropdown — a clinical role, a front-office one, a billing one
       and a systems one — and that the count still matches the source. */
    for (const role of [
      'Physician',
      'Nurse Practitioner',
      'Procedure Nurse',
      'Medical Assistant',
      'Behavioral Health Provider',
      'Practice Administrator',
      'Front Desk',
      'Scheduler',
      'Billing Staff',
      'Denials Analyst',
      'Medical Records',
      'IT Administrator',
    ]) {
      await expect(select).toContainText(role);
    }
  });

  test('the tab offers no role or role-type creation', async ({ page }) => {
    await page.goto(ROLES);
    await expect(page.getByTestId('prc--new-role')).toHaveCount(0);
    await expect(page.getByTestId('prc--new-role-type')).toHaveCount(0);
    await expect(page.getByTestId('rol--feature-search')).toHaveCount(0);
  });

  /* The picker is one dropdown, not a row of chips: fifteen chips wrapped onto
     two rows and pushed the matrix below the fold. */
  test('the role is chosen from a labelled dropdown', async ({ page }) => {
    await page.goto(ROLES);
    await expect(page.getByTestId('rol--role-select')).toBeVisible();
    await expect(page.locator('#rolRoleSelect .ui-field__label')).toHaveText('Role Type');
    await expect(page.locator('.rol__list-item')).toHaveCount(0);
  });

  test('every action from the brief is a column', async ({ page }) => {
    await page.goto(ROLES);
    const head = page.locator('.rol__table thead');

    for (const column of [
      'Features', 'All', 'View', 'Create', 'Edit',
      'Delete', 'Archive', 'Export', 'Print', 'Approve',
    ]) {
      await expect(head).toContainText(column);
    }
  });

  /** 27 flat rows is a wall; the groups are what make it scannable. */
  test('features are grouped', async ({ page }) => {
    await page.goto(ROLES);
    await expect(page.locator('.rol__group-row')).toHaveCount(GROUP_COUNT);
    await expect(page.locator('.rol__group-row').first()).toContainText('Clinical');
  });

  /**
   * The single most important guard on this screen: a grid of live checkboxes
   * invites an accidental click that silently changes who can delete a claim.
   */
  test('the matrix is read-only until Edit Permissions is pressed', async ({ page }) => {
    await page.goto(ROLES);

    await expect(page.locator('.rol__check')).toHaveCount(0);
    await expect(page.locator('.rol__glyph').first()).toBeVisible();

    await page.getByTestId('rol--edit').click();
    await expect(page.locator('.rol__check').first()).toBeVisible();
    await expect(page.locator('.rol__glyph')).toHaveCount(0);
  });

  test('a clinical role grants what a front-office one does not', async ({ page }) => {
    await page.goto(ROLES);

    // Physician: full control of the clinical documents.
    await expect(
      page.locator('.rol__table tbody tr[data-row="soap-notes"] .rol__glyph--no')
    ).toHaveCount(0);

    await pickRole(page, 'front-desk');
    await expect(
      page.locator('.rol__table tbody tr[data-row="soap-notes"] .rol__glyph--yes')
    ).toHaveCount(0);
  });

  test('choosing a role from the dropdown loads its matrix', async ({ page }) => {
    await page.goto(ROLES);

    await pickRole(page, 'billing-staff');
    await expect(page.getByTestId('rol--role-select').locator('select')).toHaveValue(
      'billing-staff'
    );
    await expect(page.getByTestId('rol--stats')).toContainText('Billing Staff');
  });

  test('role statistics and history describe the selected role', async ({ page }) => {
    await page.goto(ROLES);
    const stats = page.getByTestId('rol--stats');

    await expect(stats).toContainText('Physician');
    await expect(stats).toContainText('Users assigned');
    await expect(stats).toContainText('Last updated');
    await expect(stats).toContainText('Updated by');
  });

  /* Switching roles must not leave the picker showing the one you left. */
  test('the picker keeps the role it loaded', async ({ page }) => {
    await page.goto(ROLES);
    await pickRole(page, 'front-desk');

    await expect(page.getByTestId('rol--role-select').locator('select')).toHaveValue('front-desk');
    await expect(page.getByTestId('rol--stats')).toContainText('Front Desk');
  });
});

test.describe('roles & responsibility — editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROLES);
    // Front Desk has a mix of granted and withheld, so toggles are visible.
    await pickRole(page, 'front-desk');
    await page.getByTestId('rol--edit').click();
  });

  const box = (page, feature, action) =>
    page.locator(`.rol__check[data-feature="${feature}"][data-action="${action}"]`);

  test('ticking All grants every action on that row', async ({ page }) => {
    await box(page, 'legal', 'all').check();

    for (const action of ['view', 'create', 'edit', 'delete', 'archive', 'export', 'print', 'approve']) {
      await expect(box(page, 'legal', action)).toBeChecked();
    }
  });

  test('unticking one action unticks All', async ({ page }) => {
    await box(page, 'legal', 'all').check();
    await expect(box(page, 'legal', 'all')).toBeChecked();

    await box(page, 'legal', 'delete').uncheck();
    await expect(box(page, 'legal', 'all')).not.toBeChecked();
  });

  test('ticking every action individually ticks All', async ({ page }) => {
    // Front Desk manages Scheduling — everything except approve.
    await expect(box(page, 'scheduling', 'all')).not.toBeChecked();
    await box(page, 'scheduling', 'approve').check();
    await expect(box(page, 'scheduling', 'all')).toBeChecked();
  });

  test('a partly-granted row shows All as indeterminate, not unchecked', async ({ page }) => {
    // Neither on nor off is the truth for a partial row, and a plain unchecked
    // box reads as "nothing granted here".
    const isIndeterminate = await box(page, 'dashboard', 'all').evaluate((el) => el.indeterminate);
    expect(isIndeterminate).toBe(true);
  });

  test('the pending banner counts exactly what changed', async ({ page }) => {
    await expect(page.getByTestId('rol--banner')).toBeHidden();

    await box(page, 'legal', 'create').check();
    await expect(page.getByTestId('rol--banner')).toContainText('1 Permission Change Pending');

    await box(page, 'legal', 'delete').check();
    await expect(page.getByTestId('rol--banner')).toContainText('2 Permission Changes Pending');

    // Undoing a change removes it from the count rather than adding another.
    await box(page, 'legal', 'delete').uncheck();
    await expect(page.getByTestId('rol--banner')).toContainText('1 Permission Change Pending');
  });

  test('View All Changes itemises them by feature', async ({ page }) => {
    await box(page, 'legal', 'create').check();
    await box(page, 'reports', 'view').uncheck();
    await page.getByTestId('rol--view-changes').click();

    const summary = page.getByTestId('rol--change-summary');
    await expect(summary).toContainText('Access Removed');
    await expect(summary).toContainText('Access Granted');
    await expect(summary).toContainText('Legal');
    await expect(summary).toContainText('Reports');
    await expect(summary).toContainText('Front Desk');
  });

  test('Discard Changes returns the draft to the saved state', async ({ page }) => {
    await box(page, 'legal', 'create').check();
    await expect(page.getByTestId('rol--banner')).toBeVisible();

    await page.getByTestId('rol--discard').click();
    await expect(page.getByTestId('rol--banner')).toBeHidden();
    await expect(box(page, 'legal', 'create')).not.toBeChecked();
  });

  /** Nothing is written until Save — Cancel must leave the role untouched. */
  test('Cancel abandons the edit', async ({ page }) => {
    await box(page, 'legal', 'create').check();
    await page.getByTestId('rol--cancel').click();

    await expect(page.locator('.rol__check')).toHaveCount(0);
    await page.getByTestId('rol--edit').click();
    await expect(box(page, 'legal', 'create')).not.toBeChecked();
  });

  test('Save commits the change and records it in the history', async ({ page }) => {
    await box(page, 'legal', 'create').check();
    await page.getByTestId('rol--save').click();

    await expect(page.locator('#rolesFlash')).toContainText('Permissions Updated Successfully');
    await expect(page.locator('.rol__check')).toHaveCount(0);

    // It survives leaving edit mode…
    await page.getByTestId('rol--edit').click();
    await expect(box(page, 'legal', 'create')).toBeChecked();

    // …and it is written into the audit trail.
    await page.getByTestId('rol--cancel').click();
    await expect(page.getByTestId('rol--history')).toContainText('Legal');
  });

  test('Select all and Clear all move the whole matrix', async ({ page }) => {
    await page.getByTestId('rol--clear-all').click();
    await expect(page.locator('.rol__check:checked')).toHaveCount(0);

    await page.getByTestId('rol--select-all').click();
    await expect(page.locator('.rol__check:not(:checked)')).toHaveCount(0);
  });

  test('copying from another role replaces the matrix but does not save it', async ({ page }) => {
    await page.getByTestId('rol--copy').click();
    await page.getByTestId('rol--copy-source').selectOption('physician');
    await page.getByTestId('rol--copy-apply').click();

    // Physician has full control of SOAP notes; Front Desk had none.
    await expect(box(page, 'soap-notes', 'view')).toBeChecked();
    await expect(page.getByTestId('rol--banner')).toBeVisible();
  });
});

test.describe('roles & responsibility — quality', () => {
  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(ROLES);
    await expect(matrixRows(page).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in edit mode @a11y', async ({ page }) => {
    await page.goto(ROLES);
    await page.getByTestId('rol--edit').click();
    // Physician has no Roles access, so ticking it is a real change and the
    // banner appears; toggling an already-set box would be a no-op.
    await page.locator('.rol__check[data-feature="roles"][data-action="view"]').check();
    await page.getByTestId('rol--view-changes').click();
    await expect(page.getByTestId('rol--change-summary')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — permission matrix', async ({ page }) => {
    await page.goto(ROLES);
    await expect(matrixRows(page).first()).toBeVisible();
    await expect(page.locator('.rol__matrix')).toHaveScreenshot('roles-matrix.png');
  });
});
