/**
 * Driving <ui-filter> from a test.
 *
 * Every list in the product filters from the same control now
 * (js/components/ui-filter.js), so every spec that filters a list does it
 * through these four functions rather than through thirteen screens' worth of
 * hand-written locators.
 *
 * The panel is parented to <body> and there is only ever one open, so it is
 * found by its id rather than through the button that opened it — which is
 * also what makes `openFilter` safe to call twice: it opens if shut and leaves
 * it alone if already open, instead of toggling it closed under the next line
 * of the test.
 *
 *   import { openFilter, tickFilter, clearFilter, doneFilter } from '../helpers/filter.js';
 *
 *   await openFilter(page, 'directory--filter');
 *   await tickFilter(page, 'status', 'Inactive');
 *   await expect(page.getByTestId('directory--table').locator('tbody tr')).toHaveCount(10);
 */

const PANEL = '#ui-filter-panel';

/** The open panel, whichever control opened it. */
export function filterPanel(page) {
  return page.locator(PANEL);
}

/** Open the filter named by its control's data-testid. A no-op if already open. */
export async function openFilter(page, testid) {
  const trigger = page.getByTestId(testid).locator('.ui-filter__trigger');
  if ((await trigger.getAttribute('aria-expanded')) === 'true') return;
  await trigger.click();
  await page.locator(PANEL).waitFor();
}

/**
 * Tick (or untick) one answer.
 *
 * Addressed by group name and value — the two things the screen's own code
 * names them by — rather than by a per-answer test id, because the answers
 * come out of data/ and inventing an id per payer is a fixture the product
 * would then have to keep in step with.
 */
export async function tickFilter(page, group, value) {
  /*
   * THE LABEL, NOT THE INPUT.
   *
   * <ui-checkbox> renders a real native input and then hides it — 1px square,
   * opacity 0, absolutely positioned — with the drawn box, `.ui-choice__box`,
   * painted over the top of it inside the same <label>. That is the right way
   * to build the control: the label is the hit area, so a click anywhere on
   * the row toggles it, and a screen reader still gets a real checkbox.
   *
   * It also means Playwright cannot click the input. Its actionability check
   * finds `.ui-choice__box` at the input's own coordinates, calls that a
   * pointer-event interception, and retries until the test times out — which
   * is exactly what every spec using this helper had started doing.
   *
   * So the click goes to the <label>, which is what a person clicks. The
   * input is still what gets read back — see filterRow() below, which is
   * asserting state rather than driving it.
   */
  await page
    .locator(`${PANEL} [data-filter-name="${group}"][data-filter-value="${value}"] label`)
    .click();
}

/**
 * Answer a question that is asked as a DROPDOWN rather than as a tick list —
 * the shape the report parameter sheets use. See the chapter on it in
 * js/components/ui-filter.js.
 *
 * Driven through the native <select> the control is built on, the way every
 * other spec in this suite drives a <ui-select>: the drawn menu is the same
 * element's list, and clicking through it would be testing js/lib/select-menu.js
 * rather than the panel. Pass an array to answer a multiple field with a set.
 *
 *   await pickFilter(page, 'performing', 'Amara Mensah, MD');
 *   await pickFilter(page, 'groupBy', 'Provider');
 */
export async function pickFilter(page, group, label) {
  const select = page.locator(`${PANEL} [data-filter-name="${group}"] select`);
  await select.selectOption(
    Array.isArray(label) ? label.map((l) => ({ label: l })) : { label }
  );
}

/** Type into a question that is asked as a date — "Charge DOS From". */
export async function typeFilter(page, group, value) {
  const field = page.locator(`${PANEL} [data-filter-name="${group}"] input`);
  await field.fill(value);
  await field.dispatchEvent('change');
}

/** What one dropdown question is currently showing, as the reader sees it. */
export function filterField(page, group) {
  return page.locator(
    `${PANEL} [data-filter-name="${group}"] .ui-select-facade__text, ` +
      `${PANEL} [data-filter-name="${group}"] select`
  );
}

/** Tick one of the switches a parameter sheet ends with, by its wording. */
export async function switchFilter(page, label) {
  await page.locator(`${PANEL} ui-checkbox`, { hasText: label }).locator('label').click();
}

/** Whether one answer is ticked. */
export function filterRow(page, group, value) {
  return page.locator(
    `${PANEL} [data-filter-name="${group}"][data-filter-value="${value}"] input`
  );
}

/** Every answer offered under one question, in order, as text. */
export async function filterOptions(page, group) {
  return page.locator(`${PANEL} [data-filter-name="${group}"]`).allInnerTexts();
}

/** The question headings the open panel is asking, in order. */
export async function filterGroups(page) {
  return page.locator(`${PANEL} .ui-filter-group__label`).allInnerTexts();
}

/** Untick everything. The panel stays open, as it does for a real reader. */
export async function clearFilter(page) {
  await page.locator(`${PANEL} .ui-filter-panel__clear`).click();
}

/** Press Done, which applies and shuts. */
export async function doneFilter(page) {
  await page.locator(`${PANEL} .ui-filter-panel__done button`).click();
  await page.locator(PANEL).waitFor({ state: 'detached' });
}

/** How many answers the button is reporting, as a number. 0 when the badge is off. */
export async function filterCount(page, testid) {
  const badge = page.getByTestId(testid).locator('.ui-filter__count');
  if (!(await badge.isVisible())) return 0;
  return Number(await badge.innerText());
}
