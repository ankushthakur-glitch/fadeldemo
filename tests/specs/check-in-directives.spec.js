/**
 * Patient Check-in — the Advance Directives section.
 *
 * Four separate facts, and the reason they are four is that the record has to
 * be able to answer each independently:
 *
 *   HAS      a directive exists somewhere
 *   ON FILE  a copy is in the chart here — the two come apart constantly, and
 *            only the second means anyone can actually read it
 *   OFFERED  written information was put in front of the patient
 *   OUTCOME  they took it, or they turned it down
 *
 * Only HAS is asked outright. The rest follow from it:
 *
 *   HAS = Yes      -> ON FILE   (where the copy is only matters if there is one)
 *   HAS = No       -> OFFERED   (nothing to record, so offer them information)
 *   OFFERED = Yes  -> OUTCOME   (they took it, or they turned it down)
 *
 * This replaced showing all four at once with the outcome greyed out. Two
 * behaviours are worth pinning, and the second is the one that matters:
 * a question appears when it becomes relevant, and its answer is WITHDRAWN
 * when it stops being. "Received" sitting behind an answer of "not offered" is
 * exactly the impossible record the dependency exists to prevent.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';

const CHECK_IN = '/screens/check-in.html';

const ASKS = {
  has: 'cin--has-directives',
  onFile: 'cin--directives-on-file',
  offered: 'cin--offered-directives',
  outcome: 'cin--directive-outcome',
};

/** Answer a row. The input carries the value; the label is only its text. */
const answer = (page, id, value) => page.locator(`#${id} input[value="${value}"]`).check();

/**
 * Open the Advance Directives step.
 *
 * Check-in is a rail and one open pane now, so every question below has to be
 * navigated to before it is on screen at all — which is the point of the rail,
 * and the reason this helper exists rather than a bare goto().
 */
async function open(page) {
  await page.goto(CHECK_IN);
  await page.getByTestId('cin--rail-directives').click();
  await expect(page.getByTestId(ASKS.has)).toBeVisible();
}

const valuesOf = (page) =>
  page.evaluate(() => ({
    has: document.getElementById('hasDirectives').value,
    onFile: document.getElementById('directivesOnFile').value,
    offered: document.getElementById('offeredDirectives').value,
    outcome: document.getElementById('directiveOutcome').value,
  }));

test.describe('check-in — advance directives', () => {
  test('asks the first question outright and the rest only when they apply', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await open(page);

    // One question, and nothing preselected inside it. The pane used to open
    // on "No", which put the offer question on screen beside a fact nobody at
    // the desk had established yet.
    await expect(page.getByTestId(ASKS.has)).toBeVisible();
    await expect(page.getByTestId(ASKS.onFile)).toBeHidden();
    await expect(page.getByTestId(ASKS.offered)).toBeHidden();
    await expect(page.getByTestId(ASKS.outcome)).toBeHidden();
    expect(await valuesOf(page)).toEqual({ has: '', onFile: '', offered: '', outcome: '' });

    // Answering the first is what brings the second out; the hints that used
    // to tell the two "has" questions apart are gone, so the questions
    // themselves have to carry that difference.
    await answer(page, 'hasDirectives', 'Yes');
    await expect(page.getByTestId(ASKS.onFile)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('the outcome offers Received and Declined, not Yes and No', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');
    await answer(page, 'offeredDirectives', 'Yes');

    const options = await page
      .getByTestId(ASKS.outcome)
      .locator('input[type="radio"]')
      .evaluateAll((els) => els.map((el) => el.value));

    expect(options).toEqual(['Received', 'Declined']);
  });

  /** The layout requirement: questions sit across, not as a stack of rows. */
  test('the questions on screen sit side by side, two to a row', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');
    await answer(page, 'offeredDirectives', 'Yes');

    const boxes = await page.locator('.cin__q:not([hidden])').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left) };
      })
    );

    expect(boxes).toHaveLength(3);
    // 1 and 2 share a row; the third wraps to the next.
    expect(boxes[0].top).toBe(boxes[1].top);
    expect(boxes[1].left).toBeGreaterThan(boxes[0].left);
    expect(boxes[2].top).toBeGreaterThan(boxes[0].top);
  });

  /* --- The dependencies ---------------------------------------------------- */

  test('a directive on file is asked about only when there is a directive', async ({ page }) => {
    await open(page);

    await answer(page, 'hasDirectives', 'Yes');
    await expect(page.getByTestId(ASKS.onFile)).toBeVisible();
    // With one on file there is nothing to offer, so that branch is not asked.
    await expect(page.getByTestId(ASKS.offered)).toBeHidden();

    await answer(page, 'hasDirectives', 'No');
    await expect(page.getByTestId(ASKS.onFile)).toBeHidden();
    await expect(page.getByTestId(ASKS.offered)).toBeVisible();
  });

  test('the outcome is not on screen until information has been offered', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');

    await expect(page.getByTestId(ASKS.outcome)).toBeHidden();

    await answer(page, 'offeredDirectives', 'Yes');
    await expect(page.getByTestId(ASKS.outcome)).toBeVisible();
    await expect(page.getByTestId(ASKS.outcome).locator('input:checked')).toHaveCount(0);

    await answer(page, 'directiveOutcome', 'Received');
    await expect(page.locator('#directiveOutcome input:checked')).toHaveValue('Received');
  });

  /**
   * Taking the offer back must take the outcome with it. Leaving "Received"
   * behind an answer of "not offered" is exactly the impossible record this
   * dependency exists to prevent — and hiding the question without clearing it
   * would file that record while showing nothing on screen.
   */
  test('taking the offer back clears the outcome', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');
    await answer(page, 'offeredDirectives', 'Yes');
    await answer(page, 'directiveOutcome', 'Declined');

    await answer(page, 'offeredDirectives', 'No');

    await expect(page.getByTestId(ASKS.outcome)).toBeHidden();
    expect((await valuesOf(page)).outcome).toBe('');
  });

  test('answering Yes withdraws the offer branch entirely', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');
    await answer(page, 'offeredDirectives', 'Yes');
    await answer(page, 'directiveOutcome', 'Received');

    await answer(page, 'hasDirectives', 'Yes');

    const values = await valuesOf(page);
    expect(values.offered).toBe('');
    expect(values.outcome).toBe('');
  });

  /* --- What gets filed ----------------------------------------------------- */

  /**
   * The two shapes the record can take. A question the desk was never asked
   * files as nothing rather than as a "No" nobody said — which is why these
   * are two cases and not one row of four answers.
   */
  test('a patient with a directive files the has/on-file pair', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'Yes');
    await answer(page, 'directivesOnFile', 'No');

    expect(await valuesOf(page)).toEqual({
      has: 'Yes', onFile: 'No', offered: '', outcome: '',
    });
  });

  test('a patient without one files the offer and what came of it', async ({ page }) => {
    await open(page);
    await answer(page, 'hasDirectives', 'No');
    await answer(page, 'offeredDirectives', 'Yes');
    await answer(page, 'directiveOutcome', 'Received');

    expect(await valuesOf(page)).toEqual({
      has: 'No', onFile: '', offered: 'Yes', outcome: 'Received',
    });
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await open(page);
    await expectNoA11yViolations(page);
  });
});
