/**
 * Settings → Appointment: Availability, Appointment Types, Appointment Status,
 * plus the per-provider Day Slots / Block Days drill-down.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';
import { openFilter, tickFilter, doneFilter } from '../helpers/filter.js';


/* The shared default from js/lib/pagination.js — one page of statuses. */
const STATUS_PAGE = 15;
const HUB = '/screens/settings.html';
const APT = '/screens/appointment-settings.html';
const PROVIDER = '/screens/provider-availability.html?provider=Olivia%20Rhye';

test.describe('settings navigation', () => {
  test('Settings is reachable from the patient screens', async ({ page }) => {
    await page.goto('/screens/patient-directory.html');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForURL('**/settings.html');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('the hub opens Appointment settings', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(HUB);

    await page.getByTestId('settings--appointment').click();
    await page.waitForURL('**/appointment-settings.html');
    await expect(
      page.getByRole('heading', { name: 'Appointment Settings' })
    ).toBeAttached();

    assertClean();
  });
});

test.describe('appointment settings', () => {
  test('opens on Availability with the provider list', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(APT);

    await expect(page.getByRole('tab', { name: 'Availability' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(
      page.getByTestId('apt--availability-table').locator('tbody tr')
    ).toHaveCount(15); // one page of them
    await expect(page.getByTestId('apt-availability--range')).toContainText('of 56');

    assertClean();
  });

  test('slot and block-day counts are zero padded', async ({ page }) => {
    await page.goto(APT);
    const row = page
      .getByTestId('apt--availability-table')
      .locator('tbody tr')
      .filter({ hasText: 'Andi Lane' });
    // Andi Lane has 1 slot and 0 block days → "01" and "00".
    await expect(row.locator('td').nth(1)).toHaveText('01');
    await expect(row.locator('td').nth(2)).toHaveText('00');
  });

  test('search and provider filter narrow the list', async ({ page }) => {
    await page.goto(APT);
    const table = page.getByTestId('apt--availability-table');

    await page.getByTestId('apt--availability-search').locator('input').fill('Lana');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Lana Steiner');

    await page.getByTestId('apt--availability-search').locator('input').fill('');
    await openFilter(page, 'apt--provider-filter');
    await tickFilter(page, 'provider', 'Drew Cano');
    await doneFilter(page);
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Drew Cano');
  });

  test('a provider name opens their availability preferences', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('link', { name: 'Olivia Rhye' }).click();
    await page.waitForURL('**/provider-availability.html*');
    await expect(page.getByTestId('pa--title')).toHaveText(
      'Olivia Rhye Availability Preferences'
    );
  });

  /* --- Appointment types ------------------------------------------------- */

  /*
   * 42, not the 58 types that exist: the rail lists what the ACTIVE practice
   * profile offers, and the procedure list — screening colonoscopy, ERCP, the
   * rest of it — belongs to the ASC. A fresh browser context has no stored
   * profile, so this always starts on the clinic — see data/practice.js.
   */
  test('appointment types list and detail stay in step', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    const rail = page.locator('#typeRail');
    await expect(rail.locator('button')).toHaveCount(42);
    await expect(rail.locator('[aria-current="true"]')).toHaveText('In-person New Patient');

    // The first type ships with three attached forms.
    await expect(
      page.getByTestId('apt--attached-forms').locator('.set__form-item')
    ).toHaveCount(3);

    await rail.getByRole('button', { name: 'Infusion Therapy' }).click();
    await expect(page.getByTestId('apt--type-detail')).toContainText('Infusion Therapy');
    await expect(page.getByTestId('apt--type-duration').locator('input')).toHaveValue('120');
  });

  /* --- Colour: the whole palette, open on the card ------------------------- */

  test('the palette and the mixer stand open on the card', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    const palette = page.getByTestId('apt--type-palette');
    await expect(palette).toBeVisible();
    await expect(palette.locator('[data-pick-colour]')).toHaveCount(56);

    // Both halves of the picker, together: the grid answers "one of ours", the
    // mixer answers "ours, but a shade lighter".
    await expect(page.getByTestId('apt--type-mixer-field')).toBeVisible();
    await expect(page.getByTestId('apt--type-mixer-hex')).toBeVisible();

    // No opacity ramp here — a type's colour is painted as a solid calendar
    // block. The Appointment Status dialog keeps its own.
    await expect(page.getByTestId('apt--type-mixer-alpha')).toHaveCount(0);

    assertClean();
  });

  test('picking a colour repaints the rail swatch and seeds the mixer', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await page.getByTestId('apt--type-palette').locator('[data-pick-colour="#1e88e5"]').click();

    // The rail carries the same colour, so the two cannot drift apart.
    await expect(
      page.locator('#typeRail [aria-current="true"] .ui-swatch')
    ).toHaveCSS('background-color', 'rgb(30, 136, 229)');

    // Exactly one tile reads as chosen, and the mixer starts from it rather
    // than sitting on whatever it held before.
    await expect(
      page.getByTestId('apt--type-palette').locator('[data-pick-colour][aria-pressed="true"]')
    ).toHaveCount(1);
    await expect(page.getByTestId('apt--type-mixer-hex')).toHaveValue('#1e88e5');
  });

  test('a colour mixed by hand reaches the rail without repainting the pane', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await page.getByTestId('apt--type-mixer-hex').fill('#8b5cf6');

    await expect(
      page.locator('#typeRail [aria-current="true"] .ui-swatch')
    ).toHaveCSS('background-color', 'rgb(139, 92, 246)');
    // Still the caret's box: a repaint mid-edit would take the field away.
    await expect(page.getByTestId('apt--type-mixer-hex')).toBeFocused();
  });

  /* --- Provider-specific duration ------------------------------------------ */

  test('the exception list adds, edits and removes a provider', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    const rows = page.getByTestId('apt--type-overrides').locator('.set__override');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('.set__override-name')).toHaveText('Aisha Patel');
    await expect(rows.first().locator('input')).toHaveValue('45');

    // An edit in one row survives the repaint that adding another causes.
    await rows.first().locator('input').fill('50');
    await page.getByTestId('apt--override-picker').locator('select').selectOption('Andi Lane');
    await page.getByTestId('apt--add-override').click();

    await expect(rows).toHaveCount(3);
    await expect(rows.first().locator('input')).toHaveValue('50');
    // A new row opens at the type's default, not blank.
    await expect(rows.nth(2).locator('input')).toHaveValue('30');

    // Nobody can be listed twice, so a provider already named drops out of the
    // picker.
    await expect(
      page.getByTestId('apt--override-picker').locator('option', { hasText: 'Andi Lane' })
    ).toHaveCount(0);

    await rows.nth(1).locator('[data-remove-override]').click();
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('apt--type-overrides')).not.toContainText('David Smith');

    assertClean();
  });

  test('switching the unit rewords every override row', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await expect(
      page.getByTestId('apt--type-overrides').locator('.set__override-unit').first()
    ).toHaveText('minutes');

    await page.getByTestId('apt--type-unit').locator('select').selectOption('Hour');

    // Otherwise the rows read "45 minutes" under a default measured in hours.
    for (const unit of await page
      .getByTestId('apt--type-overrides')
      .locator('.set__override-unit')
      .all()) {
      await expect(unit).toHaveText('hours');
    }
  });

  test('Save refuses a type whose duration has been cleared', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await page.getByTestId('apt--type-duration').locator('input').fill('');
    await page.getByTestId('apt--type-save').click();

    // collect() keeps the old value when the box is empty, so without the
    // check the Save would report success on a figure nobody set.
    await expect(page.locator('.ui-toast-region')).toContainText('duration of at least one');
  });

  /* --- Types are scoped to the active practice profile --------------------- */

  test('the rail names the profile whose types it is listing', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await expect(page.getByTestId('apt--type-scope')).toContainText(
      'MediNova Gastroenterology Clinic'
    );
    await expect(page.getByTestId('apt--type-scope')).toContainText('13 appointment types');
  });

  test('switching to the ASC leaves only the types it performs', async ({ page }) => {
    // The switch lives in Practice Settings and is app-wide, so it is made
    // there and read here — that is the whole behaviour under test.
    await page.goto('/screens/practice-settings.html');
    await page.getByTestId('prc--profile-asc').click();

    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    const rail = page.locator('#typeRail');
    await expect(rail.locator('button')).toHaveCount(20);
    await expect(rail).toContainText('Procedure Visit');
    await expect(rail).toContainText('Minor Surgical Procedure');
    // A consulting-room visit is not offered in an endoscopy suite.
    await expect(rail).not.toContainText('Annual Wellness Visit');
    await expect(page.getByTestId('apt--type-scope')).toContainText('MediNova Gastroenterology ASC');
  });

  test('a form can be attached and removed', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    const forms = page.getByTestId('apt--attached-forms').locator('.set__form-item');
    await expect(forms).toHaveCount(3);

    await page.locator('#formPicker').locator('select').selectOption('Consent to Treat');
    await page.getByTestId('apt--attach-form').locator('button').click();
    await expect(forms).toHaveCount(4);

    await forms.first().locator('button').click();
    await expect(forms).toHaveCount(3);
  });

  test('New adds a type to the top of the rail', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Types' }).click();

    await page.getByTestId('apt--new-type').locator('button').click();
    const rail = page.locator('#typeRail');
    await expect(rail.locator('button')).toHaveCount(43);
    await expect(rail.locator('button').first()).toHaveText('Untitled appointment type');
    await expect(rail.locator('[aria-current="true"]')).toHaveText('Untitled appointment type');
  });

  /* --- Appointment status (and its colour) -------------------------------- */

  test('colour rows render swatches from generated classes, not inline styles', async ({
    page,
  }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Status' }).click();

    // The status list is paged like every other settings table: sixty colours
    // was more than a screenful, and scanning stopped being possible long
    // before the list stopped growing.
    const table = page.getByTestId('apt--color-table');
    await expect(table.locator('tbody tr')).toHaveCount(STATUS_PAGE);
    await expect(page.getByTestId('apt-colors--range')).toHaveText(
      `1-${STATUS_PAGE} of 60 statuses`
    );
    await expect(table.locator('thead')).toContainText('Appointment Status');

    const swatch = table.locator('.ui-swatch').first();
    // Triage is #009999.
    await expect(swatch).toHaveCSS('background-color', 'rgb(0, 153, 153)');
    // The rule comes from a stylesheet; the element carries no style attribute.
    await expect(swatch).not.toHaveAttribute('style', /./);
  });

  test('editing a colour updates the row', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Status' }).click();

    const table = page.getByTestId('apt--color-table');
    await table.locator('[data-edit]').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('apt--color-name').locator('input')).toHaveValue('Triage');

    // The palette is collapsed until asked for.
    await expect(page.getByTestId('apt--palette')).toBeHidden();
    await page.getByTestId('apt--color-trigger').click();
    await expect(page.getByTestId('apt--palette')).toBeVisible();

    await page.locator('[data-colour="#f6685e"]').click();
    await page.getByTestId('apt--color-save').locator('button').click();

    await expect(dialog).toBeHidden();
    await expect(table.locator('.ui-swatch').first()).toHaveCSS(
      'background-color',
      'rgb(246, 104, 94)'
    );
  });

  test('a new appointment status can be added', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Status' }).click();
    const table = page.getByTestId('apt--color-table');
    const range = page.getByTestId('apt-colors--range');
    await expect(range).toHaveText(`1-${STATUS_PAGE} of 60 statuses`);

    await page.getByTestId('apt--new-status').locator('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('New Appointment Status');
    // The palette is open straight away, and the name is editable.
    await expect(page.getByTestId('apt--palette')).toBeVisible();
    await expect(page.getByTestId('apt--color-name').locator('input')).not.toHaveAttribute(
      'readonly',
      ''
    );

    // Refused without a name.
    await page.getByTestId('apt--color-save').locator('button').click();
    await expect(page.getByTestId('apt--color-name')).toContainText('name');
    await expect(range).toHaveText(`1-${STATUS_PAGE} of 60 statuses`);

    await page.getByTestId('apt--color-name').locator('input').fill('Awaiting Referral');
    await page.locator('[data-colour="#1e88e5"]').click();
    await page.getByTestId('apt--color-save').locator('button').click();

    await expect(dialog).toBeHidden();
    await expect(range).toHaveText(`1-${STATUS_PAGE} of 61 statuses`);
    await expect(table).toContainText('Awaiting Referral');
    await expect(table.locator('tbody tr').first()).toContainText('Awaiting Referral');
    await expect(table.locator('.ui-swatch').first()).toHaveCSS(
      'background-color',
      'rgb(30, 136, 229)'
    );
  });

  /* THE MIXER IS THE OTHER HALF OF THE PICKER.
     The grid answers "one of ours" and is covered above; this covers the case
     the grid cannot — a colour that is not on it. What matters is that the
     square, the hue ramp and the hex box are one value seen three ways, and
     that whatever comes out of them survives Save. */
  test('a colour can be mixed rather than picked, and it saves', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Appointment Status' }).click();

    await page.getByTestId('apt--new-status').locator('button').click();
    const mixer = page.getByTestId('apt--mixer');
    await expect(mixer).toBeVisible();

    // Typing a hex moves the square and the ramps under it.
    const hex = page.getByTestId('apt--mixer-hex');
    await hex.fill('#3366cc');
    await expect(page.getByTestId('apt--mixer-hue')).toHaveValue('220');
    await expect(page.getByTestId('apt--mixer-field')).toHaveAttribute(
      'aria-valuetext',
      'Saturation 75%, brightness 80%'
    );
    // And the preview beside "Color" follows, from a generated class as ever.
    await expect(page.locator('#colorPreview')).toHaveCSS(
      'background-color',
      'rgb(51, 102, 204)'
    );
    await expect(page.locator('#colorPreview')).not.toHaveAttribute('style', /./);

    // Dragging the square is the same value said another way: the same hue,
    // a different corner of it. The drag runs past the top-right corner on
    // purpose — the clamp is what makes the result a number this test can name
    // rather than one that depends on how wide the drawer happened to be.
    const field = page.getByTestId('apt--mixer-field');
    const box = await field.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 40, box.y - 40, { steps: 6 });
    await page.mouse.up();
    await expect(hex).toHaveValue('#0055ff');

    // Arrow keys reach the same places the pointer does, a percent at a time.
    await field.press('ArrowLeft');
    await expect(hex).toHaveValue('#0357ff');

    await page.getByTestId('apt--color-name').locator('input').fill('Bowel Prep Sent');
    await page.getByTestId('apt--color-save').locator('button').click();

    const table = page.getByTestId('apt--color-table');
    await expect(table).toContainText('Bowel Prep Sent');
    await expect(table.locator('.ui-swatch').first()).toHaveCSS(
      'background-color',
      'rgb(3, 87, 255)'
    );
  });

  /* The policy is one sentence with the numbers set into it, not four labelled
     fields — so what is asserted is that the sentence reads whole and that the
     blanks are real controls a screen reader can name. */
  test('the cancellation policy reads as one sentence', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Cancellation Policy' }).click();

    const panel = page.getByTestId('apt--cancellation-panel');
    await expect(panel).toContainText('If a Patient cancels within');
    await expect(panel).toContainText('of the appointment, charge a');
    await expect(panel).toContainText('cancellation fee.');

    await expect(page.getByTestId('apt--cancel-window').locator('input')).toHaveValue('24');
    await expect(page.getByTestId('apt--cancel-window-unit').locator('select')).toHaveValue('Hours');
    await expect(page.getByTestId('apt--cancel-fee').locator('input')).toHaveValue('100');
    await expect(page.getByTestId('apt--cancel-fee-unit').locator('select')).toHaveValue('%');

    assertClean();
  });

  test('saving the policy says what it saved, and refuses a blank one', async ({ page }) => {
    await page.goto(APT);
    await page.getByRole('tab', { name: 'Cancellation Policy' }).click();

    await page.getByTestId('apt--cancel-save').locator('button').click();
    await expect(page.locator('#aptFlash')).toContainText('within 24 hours, charge 100%');

    // A fee with no window is not a policy.
    await page.getByTestId('apt--cancel-window').locator('input').fill('');
    await page.getByTestId('apt--cancel-save').locator('button').click();
    await expect(page.locator('#aptFlash')).toContainText('Enter a cancellation window');
  });

  /* ?tab= deep links from the Settings hub have to reach it like the rest. */
  test('the policy tab opens straight from a deep link', async ({ page }) => {
    await page.goto(`${APT}?tab=cancellation`);
    await expect(page.getByTestId('apt--cancellation-panel')).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(APT);
    await expectNoA11yViolations(page);
  });

  /* The types panel carries a fifty-six button colour grid, a slider the mouse
     drives in two dimensions and a list of number fields whose labels are off
     screen — every part of it a thing a screen reader has to be able to name.
     It went uncovered while the palette was folded away behind a swatch, which
     is exactly the arrangement that hid it from the audit as well. */
  test('no WCAG 2.1 A/AA violations on the appointment types panel @a11y', async ({ page }) => {
    await page.goto(`${APT}?tab=types`);
    await expect(page.getByTestId('apt--type-palette')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations on the cancellation policy @a11y', async ({ page }) => {
    await page.goto(`${APT}?tab=cancellation`);
    await expect(page.getByTestId('apt--cancellation-panel')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — appointment settings', async ({ page }) => {
    await page.goto(APT);
    await expect(page.getByTestId('apt--availability-table')).toBeVisible();
    await expect(page).toHaveScreenshot('appointment-settings.png');
  });
});

test.describe('provider availability', () => {
  test('Day Slots and Block Days render as a real tab strip', async ({ page }) => {
    await page.goto(PROVIDER);
    const tabs = page.getByTestId('pa--tabs').getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toHaveText('Day Slots');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    // Regression guard: without overlay.css the strip rendered as plain text.
    const height = await tabs.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(height, 'a styled tab has a real control height').toBeGreaterThan(24);
  });

  test('a date range expands to a Monday-to-Sunday pattern', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PROVIDER);

    // Every date range renders its own week, so assertions are scoped to one.
    const firstSlot = page.locator('.set__slot').first();
    const week = firstSlot.locator('.set__week');
    await expect(week).toBeVisible();

    // All seven days are present and named.
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      await expect(week).toContainText(day);
    }

    // Weekdays start enabled with two time blocks; the weekend is off.
    await expect(firstSlot.getByTestId('pa--day-monday').locator('input')).toBeChecked();
    await expect(firstSlot.getByTestId('pa--day-sunday').locator('input')).not.toBeChecked();

    assertClean();
  });

  test('there is no Virtual Appointments column', async ({ page }) => {
    await page.goto(PROVIDER);
    await expect(page.locator('.set__week').first()).not.toContainText('Virtual');
  });

  test('a date range collapses and expands', async ({ page }) => {
    await page.goto(PROVIDER);
    const slot = page.locator('.set__slot').first();
    const body = slot.locator('.set__slot-body');
    const toggle = slot.locator('[data-toggle]');

    await expect(body).toBeVisible();
    await toggle.click();
    await expect(body).toBeHidden();
    await expect(slot.locator('[data-toggle]')).toHaveAttribute('aria-expanded', 'false');
  });

  test('time blocks can be added to and removed from a day', async ({ page }) => {
    await page.goto(PROVIDER);
    const week = page.locator('.set__slot').first().locator('.set__week');
    const mondayRows = week.locator('tr[data-day="0"]');

    await expect(mondayRows).toHaveCount(2);
    await week.locator('[data-add-block="0"]').click();
    await expect(mondayRows).toHaveCount(3);

    await mondayRows.first().locator('[data-remove-block]').click();
    await expect(mondayRows).toHaveCount(2);
  });

  test('copying a day applies its pattern to the rest of the week', async ({ page }) => {
    await page.goto(PROVIDER);
    const slot = page.locator('.set__slot').first();
    const week = slot.locator('.set__week');

    // Sunday starts off with a single empty block.
    await expect(week.locator('tr[data-day="6"]')).toHaveCount(1);
    await expect(slot.getByTestId('pa--day-sunday').locator('input')).not.toBeChecked();

    await week.locator('[data-copy="0"]').click();

    // Monday's two blocks are now on Sunday, and Sunday is switched on.
    await expect(week.locator('tr[data-day="6"]')).toHaveCount(2);
    await expect(slot.getByTestId('pa--day-sunday').locator('input')).toBeChecked();
  });

  test('turning a day off disables its inputs but keeps the row', async ({ page }) => {
    await page.goto(PROVIDER);
    const slot = page.locator('.set__slot').first();
    const week = slot.locator('.set__week');

    await slot.getByTestId('pa--day-monday').locator('input').uncheck();
    await expect(week.locator('tr[data-day="0"]')).toHaveCount(2);
    await expect(
      week.locator('tr[data-day="0"]').first().locator('ui-input input').first()
    ).toBeDisabled();
  });

  /*
   * EVERY OTHER WEEK.
   *
   * A clinician who has every other Monday off keeps their weekly days in one
   * slot and puts the Monday in a slot of its own set to "Every other week".
   * The date range says how long the arrangement lasts; the repeat says how
   * often it comes round inside it. Nothing else about a slot changes, which
   * is the point — this is one more answer on an existing control, not a
   * recurrence engine.
   */
  test('a date range says how often its week pattern comes round', async ({ page }) => {
    await page.goto(PROVIDER);
    const slots = page.locator('.set__slot');

    const first = slots.nth(0).getByTestId('pa--slot-repeat');
    const second = slots.nth(1).getByTestId('pa--slot-repeat');
    await expect(first).toHaveAttribute('value', 'Every week');
    await expect(second).toHaveAttribute('value', 'Every other week');

    // Both answers, and only those two. (The empty row above them is the
    // control's own placeholder — disabled and hidden, so it is not an
    // answer anybody can land on.)
    await expect(first.locator('option:not([disabled])')).toHaveText([
      'Every week',
      'Every other week',
    ]);

    // A new slot opens weekly — almost every pattern is, and the alternating
    // one is the exception somebody chooses.
    await page.getByTestId('pa--add-slot').locator('button').click();
    await expect(slots.last().getByTestId('pa--slot-repeat')).toHaveAttribute(
      'value',
      'Every week'
    );
  });

  test('date ranges can be added and removed', async ({ page }) => {
    await page.goto(PROVIDER);
    // Two years and a quarter of half-month periods, newest first — a
    // provider's availability is a series, not a single setting.
    const slots = page.locator('.set__slot');
    await expect(slots).toHaveCount(56);

    await page.getByTestId('pa--add-slot').locator('button').click();
    await expect(slots).toHaveCount(57);

    await slots.first().locator('[data-remove-slot]').click();
    await expect(slots).toHaveCount(56);
  });

  test('block days are grouped by month', async ({ page }) => {
    await page.goto(PROVIDER);
    await page.getByRole('tab', { name: 'Block Days' }).click();

    const table = page.getByTestId('pa--block-table');
    // 52 blocks + one heading per month they fall in, oldest first.
    await expect(table.locator('tbody tr')).toHaveCount(71);
    await expect(table.locator('.set__group-row')).toHaveCount(19);
    await expect(table.locator('.set__group-row').first()).toContainText('September 2025');
  });

  test('a block day can be added inline and is refused without a title', async ({
    page,
  }) => {
    await page.goto(PROVIDER);
    await page.getByRole('tab', { name: 'Block Days' }).click();
    const table = page.getByTestId('pa--block-table');

    // Refused with nothing filled in.
    await page.getByTestId('pa--block-add').locator('button').click();
    await expect(page.getByTestId('pa--block-title')).toContainText('title');
    await expect(table.locator('tbody tr')).toHaveCount(71);

    // A month the diary has nothing blocked in yet, so the new heading is
    // the thing being tested rather than an existing group gaining a row.
    await page.getByTestId('pa--block-title').locator('input').fill('Study Leave');
    await page.getByTestId('pa--block-start').locator('input').fill('2027-04-06');
    await page.getByTestId('pa--block-add').locator('button').click();

    // New block plus a new April heading.
    await expect(table.locator('tbody tr')).toHaveCount(73);
    await expect(table.locator('.set__group-row').last()).toContainText('April 2027');
    await expect(table).toContainText('Study Leave');
  });

  test('times render in 12-hour form', async ({ page }) => {
    await page.goto(PROVIDER);
    await page.getByRole('tab', { name: 'Block Days' }).click();
    const table = page.getByTestId('pa--block-table');
    await expect(table).toContainText('12:00 AM');
    await expect(table).toContainText('08:00 PM');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(PROVIDER);
    await expectNoA11yViolations(page);
  });
});
