/**
 * <ui-icd10> — the one diagnosis picker.
 *
 * The acceptance criterion from the design review is specific: ONE component,
 * used in every ICD-10 field, searching code AND description, with
 * multi-select. So these tests cover the behaviours a clinician would notice
 * if any of them regressed, and the last one holds the "exactly one" line by
 * failing if a screen goes back to rolling its own.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

const GALLERY = '/gallery.html';

const box = (page, testid) => page.getByTestId(testid).locator('input');
const panel = (page, testid) => page.getByTestId(testid).locator('.ui-icd10__panel');
const options = (page, testid) => page.getByTestId(testid).locator('.ui-icd10__opt');

test.describe('ui-icd10', () => {
  test('searches on the code', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(GALLERY);

    await box(page, 'icd10--single').fill('K21');
    await expect(options(page, 'icd10--single').first()).toContainText('K21.9');

    assertClean();
  });

  test('searches on the description too', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--single').fill('reflux');
    await expect(options(page, 'icd10--single').first()).toContainText('K21.9');
  });

  /**
   * The dot is punctuation somebody reading codes all day has to reach for.
   * Typing the code the way it is spoken has to find it.
   */
  test('finds a code typed without its dot', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--single').fill('K219');
    await expect(options(page, 'icd10--single').first()).toContainText('K21.9');
  });

  test('one character is not a search', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--single').fill('K');
    await expect(options(page, 'icd10--single')).toHaveCount(0);
    await expect(panel(page, 'icd10--single')).toContainText('Keep typing');
  });

  test('says so when nothing matches, rather than showing an empty box', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--single').fill('zzzznotacode');
    await expect(page.getByTestId('icd10--empty')).toContainText('No ICD-10 code matches');
  });

  test('selecting stores the code and shows code — description', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--single');
    await box(page, 'icd10--single').fill('reflux');
    await page.getByTestId('icd10--option-K21.9').click();

    await expect(field).toHaveAttribute('value', 'K21.9');
    await expect(box(page, 'icd10--single')).toHaveValue(/^K21\.9 — /);
  });

  /* --- Multi-select ------------------------------------------------------- */

  test('multi-select keeps every chosen code as a chip', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--multi');
    await box(page, 'icd10--multi').fill('Z12');
    await page.getByTestId('icd10--option-Z12.11').click();

    // Seeded with K21.9 in the gallery, so this is the second.
    await expect(field.locator('.ui-icd10__chip')).toHaveCount(2);
    await expect(field).toHaveAttribute('value', 'K21.9,Z12.11');
  });

  test('the same code cannot be attached twice', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--multi');
    await box(page, 'icd10--multi').fill('K21');
    await page.getByTestId('icd10--option-K21.9').click();

    await expect(field.locator('.ui-icd10__chip')).toHaveCount(1);
    await expect(field).toHaveAttribute('value', 'K21.9');
  });

  test('a chip can be dropped', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--multi');
    await field.locator('[data-drop="K21.9"]').click();

    await expect(field.locator('.ui-icd10__chip')).toHaveCount(0);
    await expect(field).toHaveAttribute('value', '');
  });

  /* --- The dropdown ------------------------------------------------------- */

  /**
   * The complaint this answers: an empty box that says nothing until two
   * characters are in it makes somebody guess the word their code is filed
   * under. Typing "aa" for anaemia gets "No ICD-10 code matches" — true, and
   * no help at all. With `suggest` set the usual answers are one press away.
   */
  test('opens on the short list before anything is typed', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--suggest').focus();
    await expect(page.getByTestId('icd10--suggest-head')).toContainText('Common indications');
    await expect(options(page, 'icd10--suggest').first()).toBeVisible();
  });

  test('the caret opens the list too, and closes it again', async ({ page }) => {
    await page.goto(GALLERY);

    const caret = page.getByTestId('icd10--suggest').getByTestId('icd10--toggle');
    await caret.click();
    await expect(panel(page, 'icd10--suggest')).toBeVisible();

    await caret.click();
    await expect(panel(page, 'icd10--suggest')).toBeHidden();
  });

  test('a code taken from the list is attached like any other', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--suggest');
    await box(page, 'icd10--suggest').focus();
    await field.getByTestId('icd10--option-Z12.11').click();

    await expect(field).toHaveAttribute('value', 'Z12.11');
    // And it leaves the short list, because attaching it twice does nothing.
    // Reopened with the caret rather than by focusing: the box already has
    // focus after a selection, so focus() would fire nothing and the assertion
    // would pass against the panel's last painted contents.
    await field.getByTestId('icd10--toggle').click();
    await expect(field.getByTestId('icd10--option-Z12.11')).toHaveCount(0);
  });

  test('typing turns the dropdown back into the search', async ({ page }) => {
    await page.goto(GALLERY);

    const input = box(page, 'icd10--suggest');
    await input.fill('reflux');
    await expect(page.getByTestId('icd10--suggest-head')).toHaveCount(0);
    await expect(options(page, 'icd10--suggest').first()).toContainText('K21.9');

    // And clearing the query goes back to the short list rather than to a
    // closed panel — deleting a search is how somebody abandons it.
    await input.fill('');
    await expect(page.getByTestId('icd10--suggest-head')).toBeVisible();
  });

  test('a field without `suggest` still opens on nothing', async ({ page }) => {
    await page.goto(GALLERY);

    await box(page, 'icd10--single').focus();
    await expect(panel(page, 'icd10--single')).toBeHidden();
    await expect(page.getByTestId('icd10--single').getByTestId('icd10--toggle')).toHaveCount(0);
  });

  /* --- Keyboard ----------------------------------------------------------- */

  test('arrow keys move the highlight and Enter takes it', async ({ page }) => {
    await page.goto(GALLERY);

    // "K5" rather than "K2": only one K2 code is active, and a highlight
    // cannot be moved down a list of one.
    const input = box(page, 'icd10--single');
    await input.fill('K5');
    await expect(options(page, 'icd10--single').nth(1)).toBeVisible();

    const second = options(page, 'icd10--single').nth(1);
    const code = (await second.locator('code').textContent()).trim();

    await input.press('ArrowDown');
    await expect(second).toHaveClass(/is-active/);
    await input.press('Enter');

    await expect(page.getByTestId('icd10--single')).toHaveAttribute('value', code);
  });

  test('Escape closes the list without choosing', async ({ page }) => {
    await page.goto(GALLERY);

    const input = box(page, 'icd10--single');
    await input.fill('K21');
    await expect(options(page, 'icd10--single').first()).toBeVisible();

    await input.press('Escape');
    await expect(panel(page, 'icd10--single')).toBeHidden();

    // Read the property, not the attribute: a field that has never held a code
    // has no value attribute at all, which is a different thing from an empty
    // one and would make toHaveAttribute('value', '') fail for the right
    // reason at the wrong time.
    expect(await page.getByTestId('icd10--single').evaluate((el) => el.value)).toBe('');
  });

  test('Backspace on an empty multi-select box lifts the last chip', async ({ page }) => {
    await page.goto(GALLERY);

    const field = page.getByTestId('icd10--multi');
    await expect(field.locator('.ui-icd10__chip')).toHaveCount(1);

    await box(page, 'icd10--multi').press('Backspace');
    await expect(field.locator('.ui-icd10__chip')).toHaveCount(0);
  });

  test('the list is a real listbox, with the highlight announced', async ({ page }) => {
    await page.goto(GALLERY);

    const input = box(page, 'icd10--single');
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.fill('K21');
    await expect(options(page, 'icd10--single').first()).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');

    const active = await input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    await expect(page.locator(`#${active}`)).toHaveClass(/is-active/);
  });

  /* --- The "exactly one component" rule ----------------------------------- */

  /**
   * The review asked for ONE ICD-10 control, not one per screen. This guards
   * the outcome rather than the intention: any screen module that builds its
   * own diagnosis picker out of a plain select or text box has to show up
   * here, because the whole point was that it stopped being possible to have
   * two of them that behave differently.
   */
  test('no screen builds its own ICD-10 picker', async () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const screens = join(root, 'js', 'screens');

    const offenders = [];
    for (const name of readdirSync(screens)) {
      if (!name.endsWith('.js')) continue;
      const source = readFileSync(join(screens, name), 'utf8');

      // A screen may still IMPORT the catalogue (to describe a stored code, or
      // to maintain the code list itself). What it may not do is put an
      // ICD-coded list into a <ui-select> or a datalist and call that a picker.
      const rolledOwn = [
        /optionList\s*=\s*ICD/,
        /options="\$\{ICD_CODES\.join/,
        /INDICATIONS\.map\([\s\S]{0,80}<option/,
      ].filter((pattern) => pattern.test(source));

      if (rolledOwn.length) offenders.push(name);
    }

    expect(
      offenders,
      `These screens still build their own ICD-10 control instead of using <ui-icd10>:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
