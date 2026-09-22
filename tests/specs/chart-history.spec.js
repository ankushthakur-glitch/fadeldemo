/**
 * History — past medical, surgical and social.
 *
 * The section maintains all three lists; Profile · Clinical summarises them
 * from the same file and links back here. What is under test is the record
 * behaviour: every list can be read, added to, corrected and taken from, and
 * social history behaves as the fixed questionnaire it is rather than as an
 * open list wearing the same table.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const SCREEN = '/screens/patient-chart.html';
const HENNA = `${SCREEN}?mrn=326486#history`;
/* A chart nobody has asked yet — the empty states have to be honest rather
   than a blank panel. */
const UNASKED = `${SCREEN}?mrn=326481#history`;

const rows = (page) => page.getByTestId('chart--history-table').locator('tbody tr');
const dialog = (page) => page.locator('#hstModal .ui-modal__dialog');

async function tab(page, name) {
  await page.getByRole('tab', { name }).click();
}

test.describe('history module', () => {
  test('opens on Past Medical History with the recorded background', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA);

    await expect(page.getByTestId('chart--history-tabs')).toBeVisible();
    await expect(rows(page)).toHaveCount(4);

    const first = rows(page).first();
    await expect(first).toContainText('001');
    await expect(first).toContainText('Hypothyroidism');
    await expect(first).toContainText('Chronic');
    await expect(first).toContainText('20-06-2011');
    await expect(first).toContainText('Levothyroxine 75mcg');

    // A condition with no note is a dash, not an empty cell.
    await expect(rows(page).nth(3)).toContainText('Childhood asthma');
    await expect(rows(page).nth(3)).toContainText('—');

    assertClean();
  });

  test('the three tabs are three different lists', async ({ page }) => {
    await openChart(page, HENNA);

    await tab(page, 'Surgical History');
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).first()).toContainText('Cholecystectomy, laparoscopic');
    await expect(rows(page).first()).toContainText('Mr A Whitfield');

    await tab(page, 'Social History');
    await expect(rows(page)).toHaveCount(9);
    await expect(page.getByTestId('chart--history-table')).toContainText('Problem Type');
    await expect(rows(page).first()).toContainText('Education Level');

    await tab(page, 'Past Medical History');
    await expect(rows(page)).toHaveCount(4);
  });

  /* The button in the head names what it adds, so it changes with the tab —
     "Add Condition" and "Record Answer" are not the same action. */
  test('the Add button names the thing the open tab adds', async ({ page }) => {
    await openChart(page, HENNA);
    const add = page.getByTestId('chart--history-open');

    await expect(add).toContainText('Add Condition');
    await tab(page, 'Surgical History');
    await expect(add).toContainText('Add Procedure');
    await tab(page, 'Social History');
    await expect(add).toContainText('Record Answer');
  });

  test('a condition can be added, and the form refuses an empty one', async ({ page }) => {
    await openChart(page, HENNA);

    await page.getByTestId('chart--history-open').locator('button').click();
    await expect(dialog(page)).toContainText('Add Past Medical History');

    await page.getByTestId('chart--history-save').locator('button').click();
    await expect(page.getByTestId('chart--history-field-condition')).toContainText('Enter condition');
    await expect(rows(page)).toHaveCount(4);

    await page
      .getByTestId('chart--history-field-condition')
      .locator('input')
      .fill('Diverticular disease');
    await page.getByTestId('chart--history-field-status').locator('select').selectOption('Chronic');
    await page.getByTestId('chart--history-save').locator('button').click();

    await expect(page.getByTestId('chart--flash')).toContainText(
      "Diverticular disease added to this patient's history."
    );
    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).last()).toContainText('Diverticular disease');
    await expect(rows(page).last()).toContainText('Chronic');
  });

  /* WHAT AND WHERE ARE LISTS, NOT BOXES. A surgical history typed by hand
     arrives spelled six ways, and four spellings of one operation is a row
     nobody can count. Other is the escape: the same field becomes a text box,
     because a list that refuses to record an operation loses it. */
  test('Procedure and Facility are dropdowns, with Other as a way out', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Surgical History');
    await page.getByTestId('chart--history-open').locator('button').click();

    const procedure = page.getByTestId('chart--history-field-procedure');
    const facility = page.getByTestId('chart--history-field-facility');

    // Both are lists, and the catalogue is behind them. Asserted by choosing
    // rather than by reading the options: an <option> list is positional and
    // the placeholder is the first one, which makes a text assertion over it
    // a test of where the placeholder sits.
    await expect(procedure.locator('select')).toBeVisible();
    await procedure.locator('select').selectOption('Cholecystectomy, laparoscopic');
    await expect(procedure.locator('select')).toHaveValue('Cholecystectomy, laparoscopic');

    await expect(facility.locator('select')).toBeVisible();
    await facility.locator('select').selectOption('Sanford Medical Center Fargo');
    await expect(facility.locator('select')).toHaveValue('Sanford Medical Center Fargo');

    // Other swaps the list for a box, in place.
    await procedure.locator('select').selectOption('Other');
    await expect(procedure.locator('input')).toBeVisible();
    await expect(procedure.locator('select')).toHaveCount(0);

    await procedure.locator('input').fill('Pilonidal sinus excision');
    await page.getByTestId('chart--history-save').locator('button').click();

    await expect(rows(page)).toHaveCount(4);
    await expect(rows(page).last()).toContainText('Pilonidal sinus excision');
    await expect(rows(page).last()).toContainText('Sanford Medical Center Fargo');
  });

  /* An operation recorded before the list offered it has to come BACK in the
     box with its words still in it — otherwise correcting the date on an old
     row silently blanks the operation it belongs to. */
  test('an off-list procedure reopens in the text box, not empty', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Surgical History');

    await page.getByTestId('chart--history-menu-sx2').click();
    await page.getByTestId('chart--history-edit-surgical').click();

    await expect(page.getByTestId('chart--history-field-procedure').locator('input')).toHaveValue(
      'Total knee replacement, right'
    );
    // A facility that IS on the list comes back as the list, selected.
    await expect(page.getByTestId('chart--history-field-facility').locator('select')).toHaveValue(
      'GastroEMR Orthopaedic Centre'
    );
  });

  test('a row can be corrected from its menu, in place', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Surgical History');
    await expect(rows(page).nth(1)).toContainText('Total knee replacement, right');

    await page.getByTestId('chart--history-menu-sx2').click();
    await page.getByTestId('chart--history-edit-surgical').click();

    await expect(dialog(page)).toContainText('Edit Surgical History');
    // The form opens on what is recorded, not empty.
    await expect(page.getByTestId('chart--history-field-procedure').locator('input')).toHaveValue(
      'Total knee replacement, right'
    );

    await page
      .getByTestId('chart--history-field-procedure')
      .locator('input')
      .fill('Total knee replacement, left');
    await page.getByTestId('chart--history-save').locator('button').click();

    await expect(page.getByTestId('chart--flash')).toContainText('saved');
    await expect(rows(page).nth(1)).toContainText('Total knee replacement, left');
    // Corrected in place — three rows before, three after.
    await expect(rows(page)).toHaveCount(3);
  });

  test('a row can be deleted from its menu', async ({ page }) => {
    await openChart(page, HENNA);
    await expect(rows(page)).toHaveCount(4);

    await page.getByTestId('chart--history-menu-pmh1').click();
    await page.getByTestId('chart--history-delete-past-medical').click();

    await expect(page.getByTestId('chart--flash')).toContainText(
      "Hypothyroidism removed from this patient's history."
    );
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByTestId('chart--history-table')).not.toContainText('Hypothyroidism');
  });

  /* --- Social history, which is a questionnaire and not a list ------------- */

  test('an unanswered question is on the table, and its menu offers Record', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Social History');

    const unanswered = rows(page).filter({ hasText: 'Sexual Orientation' });
    await expect(unanswered).toContainText('Not recorded');
    await expect(unanswered).toHaveClass(/hst__row--unanswered/);

    await page.getByTestId('chart--history-menu-orientation').click();
    // Nothing to correct and nothing to clear — one item, not three.
    await expect(page.getByTestId('chart--history-record-social')).toBeVisible();
    await expect(page.getByTestId('chart--history-delete-social')).toHaveCount(0);

    await page.getByTestId('chart--history-record-social').click();
    // The question is settled by the row the menu was opened on.
    await expect(page.getByTestId('chart--history-field-category').locator('select')).toHaveValue(
      'Sexual Orientation'
    );

    await page
      .getByTestId('chart--history-field-response')
      .locator('select')
      .selectOption('Prefer not to say');
    await page.getByTestId('chart--history-save').locator('button').click();

    await expect(unanswered).toContainText('Prefer not to say');
    await expect(unanswered).not.toHaveClass(/hst__row--unanswered/);
    // Still nine: the answer filled a question in, it did not add one.
    await expect(rows(page)).toHaveCount(9);
  });

  /* The answers offered have to follow the question — being offered
     "Gluten-free" under Tobacco Use is how a wrong answer gets filed against
     the right question. */
  test('the answers offered follow the question chosen', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Social History');

    await page.getByTestId('chart--history-open').locator('button').click();
    const category = page.getByTestId('chart--history-field-category').locator('select');
    const response = page.getByTestId('chart--history-field-response').locator('select');

    await category.selectOption('Tobacco Use');
    await expect(response.locator('option')).toContainText(['Never smoker']);
    await expect(response.locator('option')).not.toContainText(['Gluten-free']);

    await category.selectOption('Nutrition History');
    await expect(response.locator('option')).toContainText(['Gluten-free']);
    await expect(response.locator('option')).not.toContainText(['Never smoker']);
  });

  test('clearing an answer leaves its question on the table', async ({ page }) => {
    await openChart(page, HENNA);
    await tab(page, 'Social History');

    const tobacco = rows(page).filter({ hasText: 'Tobacco Use' });
    await expect(tobacco).toContainText('Former smoker');

    await page.getByTestId('chart--history-menu-tobacco').click();
    await page.getByTestId('chart--history-delete-social').click();

    await expect(page.getByTestId('chart--flash')).toContainText('Tobacco Use cleared');
    await expect(tobacco).toContainText('Not recorded');
    await expect(rows(page)).toHaveCount(9);
  });

  /* --- Honest empty states ------------------------------------------------- */

  test('a chart nobody has asked says so, and still shows the nine questions', async ({ page }) => {
    await openChart(page, UNASKED);

    await expect(page.getByTestId('chart--history-table')).toContainText(
      'No past medical history recorded for this patient.'
    );
    await tab(page, 'Surgical History');
    await expect(page.getByTestId('chart--history-table')).toContainText(
      'No past surgical history recorded for this patient.'
    );

    // Social history is never empty: the unasked questions ARE the content.
    await tab(page, 'Social History');
    await expect(rows(page)).toHaveCount(9);
    await expect(rows(page).first()).toHaveClass(/hst__row--unanswered/);
  });

  test('no WCAG 2.1 A/AA violations on History @a11y', async ({ page }) => {
    await openChart(page, HENNA);
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations on the add dialog @a11y', async ({ page }) => {
    await openChart(page, HENNA);
    await page.getByTestId('chart--history-open').locator('button').click();
    await expect(dialog(page)).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
