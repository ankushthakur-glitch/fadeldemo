/**
 * Billing — one worklist, four tabs, and a claim that moves between them.
 *
 * What is worth pinning down here is not that a table renders, but that the
 * claim actually TRAVELS: an Unbilled Encounter becomes a claim, a
 * New claim that is scrubbed leaves the New chip for Ready to Submit or Scrub
 * Error, one that is submitted moves on to Submitted, and a refused one loops
 * back through Resubmitted. Those moves are the screen's whole reason to
 * exist, and they are the thing a refactor would quietly break.
 *
 * Unbilled and Submitted used to be two tabs over two arrays, and the tests
 * that mattered most were the ones proving a claim survived the copy between
 * them. There is now ONE list and one status, so what has to be proved instead
 * is that the row NEVER moves: the same id, still carrying every column, at
 * each stage of the journey. Several tests below follow one claim by id for
 * exactly that reason.
 *
 * The counts are the other half. A chip that says 20 while its table shows 14
 * rows is the bug this suite exists to catch, so several tests assert the
 * count and the row total together rather than either alone.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';
import {
  openFilter,
  tickFilter,
  clearFilter,
  doneFilter,
  filterPanel,
  filterGroups,
  filterOptions,
  filterCount,
} from '../helpers/filter.js';

const BILLING = '/screens/billing.html';

/**
 * Open Billing on a given tab.
 *
 * The screen opens on Unbilled Encounters — the first thing a claim is — so a
 * test about a later leg has to say so rather than assuming the landing tab
 * will not change again.
 */
async function openBilling(page, tab) {
  await page.goto(BILLING);
  if (tab) await page.getByRole('tab', { name: tab, exact: true }).click();
}

/**
 * How many rows sit behind a second-level segment.
 *
 * The segments used to carry the number as a badge and this read it off them.
 * They do not any more — the strip is the switch and nothing else — so the
 * count comes from where it was always really true: the pager's range line,
 * which counts the whole filtered set rather than the page on screen.
 *
 * Which means SELECTING the segment to ask. Whichever one was open is put back
 * afterwards, so a test can ask what a queue holds without moving the screen
 * out from under itself; the price is that these reads take turns rather than
 * running together, because they share one table.
 */
async function chipCount(page, key) {
  const open = await page
    .locator('#statusChips [aria-selected="true"]')
    .getAttribute('data-chip');

  await page.getByTestId(`bil--chip-${key}`).click();
  const range = await page.getByTestId('bil--range').textContent();
  if (open && open !== key) await page.getByTestId(`bil--chip-${open}`).click();

  // "No claims" when the queue is empty; "1-10 of 205 claims" when it is not.
  const total = range.match(/of (\d+)/);
  return total ? Number(total[1]) : 0;
}

/** Tick every row on the current page via the header's select-all. */
async function selectAll(page) {
  await page.getByTestId('bil--table').locator('.ui-table__select-all').check();
}

/** Walk a confirm → progress → result flow to its end. */
async function runFlow(page, commitName) {
  await page.getByRole('button', { name: commitName }).click();
  await expect(page.locator('#modalProgress .ui-modal')).toBeVisible();
  // The progress dialog closes itself when the work finishes.
  await expect(page.locator('#modalProgress .ui-modal')).toBeHidden({ timeout: 15000 });
}

test.describe('billing — worklist', () => {
  test('opens on Unbilled Encounters — the first thing a claim is', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(BILLING);

    await expect(page.getByRole('tab', { name: 'Unbilled Encounters' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Its two halves are a tab strip, not status chips: they are different
    // lists heading for different documents, not two states of one queue.
    await expect(page.getByTestId('bil--chip-insurance')).toHaveClass(/bil__subtab/);
    await expect(page.getByTestId('bil--chip-insurance')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('bil--chip-self')).toBeVisible();

    assertClean();
  });

  test('Claims carries the columns the merge kept, and none it dropped', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    for (const column of [
      'Original Claim Date', 'Patient Name', 'App. Type', 'Claim ID', 'DOS',
      'Location', 'Payer', 'Total Charge ($)', 'Expected Collection ($)',
      'Updated Date', 'Claim Ageing', 'Notes', 'Status', 'Actions',
    ]) {
      await expect(page.getByTestId('bil--table').locator('thead')).toContainText(column);
    }

    // Dropped: Billing Provider and Assign To said what the row's own provider
    // and coder already say, Next Action Date was a diary entry masquerading
    // as a claim field, and Recent Submit Date and Record ID were cut after.
    for (const gone of [
      'Billing Provider', 'Assign To', 'Next Action Date', 'Recent Submit Date', 'Record ID',
    ]) {
      await expect(page.getByTestId('bil--table').locator('thead')).not.toContainText(gone);
    }

    assertClean();
  });

  /**
   * The chips cover the submission pipeline and stop at the clearing house's
   * answer. They do NOT add up to All — the rest of the book of business is
   * past the pipeline and worked from other tabs — so the test that matters is
   * that All is strictly the larger, and that no chip exists for a status the
   * chips deliberately leave out.
   */
  test('the chips are the pipeline, and All is wider than their sum', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const PIPELINE = [
      'New', 'Scrub Error', 'Ready to Submit', 'Submitted', 'CH Accepted', 'CH Rejected',
    ];

    const chips = page.getByTestId('bil--table').page().locator('#statusChips [data-chip]');
    await expect(chips).toHaveCount(PIPELINE.length + 1);

    // One at a time: chipCount() opens the segment to read the pager under it,
    // and six of those racing over one table would each read whichever queue
    // happened to be open when their turn came.
    const all = await chipCount(page, 'all');
    let pipeline = 0;
    for (const key of PIPELINE) pipeline += await chipCount(page, key);

    expect(pipeline).toBeGreaterThan(0);
    expect(all).toBeGreaterThan(pipeline);
    await expect(page.getByTestId('bil--range')).toContainText(`of ${all} claims`);

    // Denied and the appeal levels are still statuses a claim holds — they are
    // simply not filtered from here.
    for (const gone of ['Denied', 'Appeal', 'INS. Underpayment']) {
      await expect(page.getByTestId(`bil--chip-${gone}`)).toHaveCount(0);
    }

    assertClean();
  });

  /* App. Type is the scheduler's own type list, not a billing-only shorthand.
     That is what lets a claim be matched back to the visit that produced it. */
  test('App. Type shows the appointment type the visit was booked as', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const cellsUnder = async (label) => {
      const index = await page
        .getByTestId('bil--table')
        .locator('thead th')
        .evaluateAll((cells, name) => cells.findIndex((c) => c.textContent.trim() === name), label);
      expect(index).toBeGreaterThan(-1);
      return page
        .getByTestId('bil--table')
        .locator('tbody tr')
        .evaluateAll((rows, i) => rows.map((row) => row.cells[i].textContent.trim()), index);
    };

    const types = await cellsUnder('App. Type');
    expect(types.length).toBeGreaterThan(0);

    // The Service Type filter offers the same strings the column prints, so a
    // reader can see why a row matched.
    await openFilter(page, 'bil--filter');
    const options = (await filterOptions(page, 'appType')).map((o) => o.trim());
    await doneFilter(page);
    expect(options).toContain('Procedure Visit');
    expect(options).toContain('In-person New Patient');
    for (const type of types) expect(options).toContain(type);

    assertClean();
  });

  test('Location reads Clinic or ASC, and follows the appointment type', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const columnIndex = async (label) =>
      page
        .getByTestId('bil--table')
        .locator('thead th')
        .evaluateAll((cells, name) => cells.findIndex((c) => c.textContent.trim() === name), label);

    const locationAt = await columnIndex('Location');
    const typeAt = await columnIndex('App. Type');
    expect(locationAt).toBeGreaterThan(-1);

    const pairs = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .evaluateAll(
        (rows, i) => rows.map((row) => [row.cells[i.type].textContent.trim(), row.cells[i.loc].textContent.trim()]),
        { type: typeAt, loc: locationAt }
      );

    expect(pairs.length).toBeGreaterThan(0);
    // Two values and nothing else — the column exists to split facility work
    // from office work, so a third value would defeat the point of it.
    expect([...new Set(pairs.map(([, loc]) => loc))].every((v) => ['Clinic', 'ASC'].includes(v))).toBe(true);

    // And it agrees with the appointment: only the types the ASC alone offers
    // bill as ASC work. A telehealth visit billed from a surgical centre is
    // the row that makes a reviewer distrust the other two hundred.
    const ASC_ONLY = ['Procedure Visit', 'Minor Surgical Procedure'];
    for (const [type, location] of pairs) {
      expect(location, `${type} billed as ${location}`).toBe(ASC_ONLY.includes(type) ? 'ASC' : 'Clinic');
    }

    assertClean();
  });

  test('the header offers only the actions that view can perform', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    // All — every stage mixed together. Nothing can be done to that as a
    // batch, so there is no bulk action and no checkbox column, and no search
    // box. The funnel is the shared one every tab on this screen now uses.
    await expect(page.getByTestId('bil--bulk')).toHaveCount(0);
    await expect(page.getByTestId('bil--table').locator('.ui-table__select-all')).toHaveCount(0);
    await expect(page.getByTestId('bil--search')).toHaveCount(0);
    await expect(page.getByTestId('bil--filter')).toBeVisible();

    await page.getByTestId('bil--chip-New').click();
    await expect(page.getByTestId('bil--bulk')).toContainText('Submit to Scrub');
    // Nothing ticked yet, so the batch action refuses to open a dialog.
    await expect(page.getByTestId('bil--bulk').locator('button')).toBeDisabled();

    await page.getByTestId('bil--chip-Scrub Error').click();
    await expect(page.getByTestId('bil--bulk')).toHaveCount(0);
    await expect(page.getByTestId('bil--table').locator('.ui-table__select-all')).toHaveCount(0);

    await page.getByTestId('bil--chip-Ready to Submit').click();
    await expect(page.getByTestId('bil--bulk')).toContainText('Submit to Clearing House');
    await expect(page.getByTestId('bil--paperClaim')).toBeVisible();

    // Submitted is waiting on somebody else's queue — there is nothing a batch
    // can do about the clearing house not having answered yet.
    await page.getByTestId('bil--chip-Submitted').click();
    await expect(page.getByTestId('bil--bulk')).toHaveCount(0);

    // CH Accepted is the third and last batch: on to the payer.
    await page.getByTestId('bil--chip-CH Accepted').click();
    await expect(page.getByTestId('bil--bulk')).toContainText('Submit to Payer');

    // A rejection is corrected one at a time, so there is no batch of them.
    await page.getByTestId('bil--chip-CH Rejected').click();
    await expect(page.getByTestId('bil--bulk')).toHaveCount(0);

    assertClean();
  });

  test('the filter bar narrows the list, and Reset puts it back', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const total = await chipCount(page, 'all');
    await expect(page.getByTestId('bil--range')).toContainText(`of ${total} claims`);

    // Service Type offers the scheduler's types, and the column prints them —
    // so picking one has to leave exactly the rows showing that type.
    await openFilter(page, 'bil--filter');
    await tickFilter(page, 'appType', 'Procedure Visit');
    await doneFilter(page);
    const range = await page.getByTestId('bil--range').textContent();
    expect(range).not.toContain(`of ${total} claims`);

    const header = page.getByTestId('bil--table').locator('thead th');
    const index = await header.evaluateAll((cells) =>
      cells.findIndex((cell) => cell.textContent.trim() === 'App. Type')
    );
    const types = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .evaluateAll((rows, i) => rows.map((row) => row.cells[i].textContent.trim()), index);
    expect([...new Set(types)]).toEqual(['Procedure Visit']);

    await openFilter(page, 'bil--filter');
    await clearFilter(page);
    await doneFilter(page);
    await expect(page.getByTestId('bil--range')).toContainText(`of ${total} claims`);

    assertClean();
  });

  test('every column reads left, header and value alike', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    // MRN and CPT are identifiers, not magnitudes — they were right-aligned by
    // the numeric column default and sat out of line with their own headers.
    // `start` is the untouched default and means left here; only an explicit
    // `right` or `center` is a column that got away.
    const READS_LEFT = ['start', 'left'];
    const alignmentsOf = async (locator) =>
      new Set(
        await locator.evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).textAlign))
      );

    for (const align of await alignmentsOf(page.getByTestId('bil--table').locator('tbody td'))) {
      expect(READS_LEFT, `a body cell is aligned "${align}"`).toContain(align);
    }
    for (const align of await alignmentsOf(page.getByTestId('bil--table').locator('thead th'))) {
      expect(READS_LEFT, `a header cell is aligned "${align}"`).toContain(align);
    }

    assertClean();
  });

  test('select-all enables the bulk action and counts what is ticked', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-New').click();

    await selectAll(page);
    // Ten rows a page, so select-all ticks ten — not the whole chip.
    await expect(page.getByTestId('bil--bulk')).toContainText('(10)');
    await expect(page.getByTestId('bil--bulk').locator('button')).toBeEnabled();

    // Unticking one row drops the count and leaves the header box partial.
    await page.getByTestId('bil--table').locator('.ui-table__select').first().uncheck();
    await expect(page.getByTestId('bil--bulk')).toContainText('(9)');

    assertClean();
  });
});

test.describe('billing — the claim travels', () => {
  test('scrubbing a batch moves it out of New and reports the split', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-New').click();

    const before = await chipCount(page, 'New');
    const readyBefore = await chipCount(page, 'Ready to Submit');

    await selectAll(page);
    await page.getByTestId('bil--bulk').click();

    await expect(page.getByRole('heading', { name: 'Confirm Batch Scrub' })).toBeVisible();
    await expect(page.locator('#confirmBody')).toContainText('10 Claims');
    await runFlow(page, 'Start Scrub');

    await expect(page.getByRole('heading', { name: 'Batch Scrub Complete' })).toBeVisible();
    // 10 scrubbed → 1 held back for review, 9 through. The split is fixed so
    // the Scrub Error queue is always reachable.
    await expect(page.locator('#doneBody')).toContainText('10 Claims');
    await expect(page.locator('#doneBody')).toContainText('9 Claims');

    await page.getByTestId('bil--done-ready').click();
    await expect(page.getByTestId('bil--chip-Ready to Submit')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(await chipCount(page, 'New')).toBe(before - 10);
    expect(await chipCount(page, 'Ready to Submit')).toBe(readyBefore + 9);

    assertClean();
  });

  /**
   * The merge's central claim, tested directly: submitting does not COPY the
   * row into a second list, it moves the same row along.
   *
   * The old pair of tabs made this the risky step — a claim was deleted from
   * `unbilled` and rebuilt in `submitted`, and a field left out of the rebuild
   * vanished silently. So the test follows one claim by id across the
   * submission and checks it is still the same row, still carrying every
   * identifying column, with only the ageing clock and the status moved.
   */
  test('submitting keeps the same row and only stamps what the send changes', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Ready to Submit').click();

    const readyBefore = await chipCount(page, 'Ready to Submit');
    const submittedBefore = await chipCount(page, 'Submitted');

    /** Read one row as a header→value map, so a column moving cannot fool it. */
    const readRow = async (claimId) =>
      page.getByTestId('bil--table').evaluate((host, id) => {
        const heads = [...host.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        const row = [...host.querySelectorAll('tbody tr')].find((tr) =>
          [...tr.cells].some((cell) => cell.textContent.trim() === id)
        );
        if (!row) return null;
        const offset = row.cells.length - heads.length;
        return Object.fromEntries(
          heads.map((head, i) => [head, row.cells[i + offset].textContent.trim()])
        );
      }, claimId);

    const firstId = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .first()
      .evaluate((row) => [...row.cells].map((c) => c.textContent.trim()).find((t) => /^CLM-/.test(t)));

    const before = await readRow(firstId);
    expect(before).not.toBeNull();

    await selectAll(page);
    await page.getByTestId('bil--bulk').click();

    await expect(page.getByRole('heading', { name: 'Confirm Batch Submission' })).toBeVisible();
    await expect(page.locator('#confirmBody')).toContainText('10 Claims');
    await runFlow(page, 'Continue');

    await expect(page.getByRole('heading', { name: 'Claims Submitted' })).toBeVisible();
    await page.getByTestId('bil--done-okay').click();

    // The chip followed the claims rather than leaving the user to find them —
    // and it is a chip now, not a second tab.
    await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('bil--chip-Submitted')).toHaveAttribute('aria-selected', 'true');

    // Same id, same claim. Everything that identifies the row is untouched;
    // only the ageing clock and the status have moved.
    const after = await readRow(firstId);
    expect(after).not.toBeNull();
    for (const column of [
      'Original Claim Date', 'Patient Name', 'App. Type', 'Claim ID',
      'DOS', 'Location', 'Payer', 'Total Charge ($)', 'Expected Collection ($)',
    ]) {
      expect(after[column], `${column} changed across the submission`).toBe(before[column]);
    }
    expect(after['Claim Ageing']).toBe('0d');
    expect(after.Status).toContain('Submitted');

    expect(await chipCount(page, 'Submitted')).toBe(submittedBefore + 10);
    expect(await chipCount(page, 'Ready to Submit')).toBe(readyBefore - 10);

    assertClean();
  });

  test('a forced submit warns that the errors are going out with the claim', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Scrub Error').click();

    const before = await chipCount(page, 'Scrub Error');

    // Force Submit moved off the worklist row and onto the scrub stage, where
    // the objections being overridden are actually on screen.
    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    await expect(page.getByTestId('bil--scrub-errors')).toBeVisible();
    await page.getByTestId('bil--claim-force').click();

    await expect(page.getByRole('heading', { name: 'Force Submit?' })).toBeVisible();
    await expect(page.locator('#confirmBody')).toContainText('unresolved');
    await page.getByRole('button', { name: 'Force Submit' }).last().click();

    expect(await chipCount(page, 'Scrub Error')).toBe(before - 1);
    await expect(page.locator('#billFlash')).toContainText('forced past the scrubber');

    assertClean();
  });

  /**
   * The status REPORTS, it is not set.
   *
   * It was briefly a dropdown, which meant a badge could read Accepted on a
   * claim with no submission ever stamped — the status, the submit date and
   * the ageing clock able to disagree with one another on the same row. Every
   * status is now reached by the act that causes it, so the cell is a badge
   * and nothing else.
   */
  test('the status is reported, not editable from the row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const table = page.getByTestId('bil--table');
    await expect(table.locator('[data-status-menu]')).toHaveCount(0);

    // The whole cell, not just the trigger: no button, no caret, nothing that
    // invites a click that would go nowhere.
    const statusIndex = await table
      .locator('thead th')
      .evaluateAll((cells) => cells.findIndex((c) => c.textContent.trim().startsWith('Status')));
    const controls = await table
      .locator('tbody tr')
      .evaluateAll(
        (rows, i) => rows.reduce((n, row) => n + row.cells[i].querySelectorAll('button, select, a').length, 0),
        statusIndex
      );
    expect(controls).toBe(0);

    // The badge is still there and still coloured by status.
    await expect(table.locator('tbody tr').first().locator('ui-badge')).toHaveCount(1);

    assertClean();
  });

  /**
   * All is the view that is supposed to show a book of business at every stage
   * at once. Building the fixture status-by-status made its first page twenty
   * identical New badges, which read as a column of one value rather than a
   * worklist.
   */
  test('All shows claims at many stages, not a run of one status', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const statusIndex = await page
      .getByTestId('bil--table')
      .locator('thead th')
      .evaluateAll((cells) => cells.findIndex((c) => c.textContent.trim().startsWith('Status')));

    const shown = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .evaluateAll((rows, i) => rows.map((row) => row.cells[i].textContent.trim()), statusIndex);

    expect(shown.length).toBe(10);
    // Ten rows, ten different stages — the point of All.
    expect(new Set(shown).size).toBe(shown.length);

    // Including statuses that have no chip of their own: All is the only place
    // they are listed, so it has to actually list them.
    expect(shown.some((status) => ['Denied', 'Accepted', 'Processed', 'Resubmitted'].includes(status)))
      .toBe(true);

    assertClean();
  });
});

test.describe('billing — claim stage', () => {
  test('a scrub error opens the encounter with its errors and rescrubs clean', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Scrub Error').click();

    const before = await chipCount(page, 'Scrub Error');
    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();

    const stage = page.getByTestId('bil--claim-stage');
    await expect(stage).toBeVisible();
    await expect(page.locator('#claimStageTitle')).toContainText('View Encounter');
    await expect(page.getByTestId('bil--scrub-errors')).toContainText('NPI validation');

    // The two fields the scrubber rejected are marked, not just listed.
    await expect(stage.locator('.bil__field--error')).toHaveCount(2);
    await expect(stage.locator('.bil__code-row--error')).toHaveCount(1);

    // The claim itself is here, not a summary of it.
    await expect(page.getByTestId('bil--icd-table').locator('tbody tr')).toHaveCount(4);
    await expect(page.getByTestId('bil--cpt-table').locator('tbody tr')).toHaveCount(4);

    await page.getByTestId('bil--claim-rescrub').click();
    await expect(page.locator('#modalProgress .ui-modal')).toBeHidden({ timeout: 15000 });

    await expect(stage).toBeHidden();
    await expect(page.locator('#billFlash')).toContainText('ready to submit');
    expect(await chipCount(page, 'Scrub Error')).toBe(before - 1);

    assertClean();
  });

  test('any claim opens, and a clean one opens without errors', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-New').click();

    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    const stage = page.getByTestId('bil--claim-stage');
    await expect(stage).toBeVisible();
    await expect(page.locator('#claimStageTitle')).toContainText('Edit Claim');

    // Nothing failed, so nothing is marked: no banner, no red fields, no
    // rejection summary to read.
    await expect(page.getByTestId('bil--scrub-errors')).toHaveCount(0);
    await expect(stage.locator('.bil__field--error')).toHaveCount(0);
    await expect(stage.locator('.bil__code-row--error')).toHaveCount(0);
    await expect(page.getByTestId('bil--view-errors')).toHaveCount(0);

    // The claim is all there and editable-looking, same as the error modes.
    // Five service lines: four procedures and the drug given under them.
    await expect(page.getByTestId('bil--icd-table').locator('tbody tr')).toHaveCount(4);
    await expect(page.getByTestId('bil--cpt-table').locator('tbody tr')).toHaveCount(5);

    assertClean();
  });

  /**
   * A DRUG LINE IS PRICED PER UNIT, AND SHOWS ITS WORKING.
   *
   * A medication code is defined as a quantity of drug, so what it bills is
   * the per-unit fee times the units given — fifty units of propofol at fifty
   * cents is $25.00, not $0.50 and not fifty. The NDC of the product sits
   * under the description, where a CMS-1500 puts it, and it belongs to the
   * code rather than to any modifier the line happens to carry.
   */
  test('a medication line bills its unit fee times its units', async ({ page }) => {
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-New').click();
    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();

    const drug = page
      .getByTestId('bil--cpt-table')
      .locator('tbody tr')
      .filter({ hasText: 'J2704' });

    await expect(drug).toHaveCount(1);
    await expect(drug).toContainText('Injection, propofol, 10 mg');
    await expect(drug).toContainText('NDC 63323-269-20');
    await expect(drug).toContainText('50.00'); // units
    await expect(drug).toContainText('0.50 / unit'); // what one costs
    await expect(drug).toContainText('25.00'); // what the line bills

    // The modifier boxes on this line are empty, and the NDC is there anyway:
    // one product, one NDC, whatever the line is modified with.
    await expect(drug.locator('.bil__mod')).toHaveCount(4);
    await expect(drug.locator('.bil__mod').first()).toHaveText('');
  });

  test('a claim can be submitted from the stage it was opened in', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-New').click();

    const before = await chipCount(page, 'New');
    const readyBefore = await chipCount(page, 'Ready to Submit');

    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    // The button names the step this claim is actually waiting for.
    await expect(page.getByTestId('bil--claim-submit')).toContainText('Submit to Scrub');
    await page.getByTestId('bil--claim-submit').click();

    // Same confirm → progress → result the worklist uses, worded for one.
    await expect(page.locator('#confirmBody')).toContainText('1 Claim');
    await expect(page.locator('#confirmBody')).not.toContainText('1 Claims');
    await runFlow(page, 'Start Scrub');

    // A claim sent on its own passes rather than always bouncing.
    await expect(page.locator('#doneBody')).toContainText('Require Review');
    await page.getByTestId('bil--done-ready').click();

    expect(await chipCount(page, 'New')).toBe(before - 1);
    expect(await chipCount(page, 'Ready to Submit')).toBe(readyBefore + 1);

    assertClean();
  });

  test('a ready claim offers the clearing house instead of the scrubber', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Ready to Submit').click();

    const readyBefore = await chipCount(page, 'Ready to Submit');
    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    await expect(page.getByTestId('bil--claim-submit')).toContainText('Submit to Clearing House');

    await page.getByTestId('bil--claim-submit').click();
    await expect(page.locator('#confirmBody')).toContainText('1 Claim');
    await runFlow(page, 'Continue');
    await page.getByTestId('bil--done-okay').click();

    expect(await chipCount(page, 'Ready to Submit')).toBe(readyBefore - 1);

    assertClean();
  });

  test('a clearing-house rejection opens Correct Claim with the 837 errors', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-CH Rejected').click();

    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    await expect(page.locator('#claimStageTitle')).toContainText('Correct Claim');
    await expect(page.getByTestId('bil--reject-errors')).toContainText('NOT forwarded to the payer');

    await page.getByTestId('bil--view-errors').click();
    const dialog = page.locator('#modalRejection');
    await expect(dialog).toContainText('2000B SBR');
    await expect(dialog).toContainText('Invalid Rendering Provider NPI');

    assertClean();
  });

  /**
   * View and Edit are the same document, and the difference between them is
   * only what can be done to it. Worth pinning down because the read-only mode
   * resolves its body through the claim's own status — the easy bug is View
   * showing an empty, different-looking claim rather than a locked one.
   */
  test('View shows the same claim as Edit, with nothing to change', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Scrub Error').click();

    const openMenuItem = async (name) => {
      await page.getByTestId('bil--table').locator('[data-menu]').first().click();
      await page.getByRole('menuitem', { name, exact: true }).click();
    };

    await openMenuItem('View');
    const stage = page.getByTestId('bil--claim-stage');
    await expect(page.locator('#claimStageTitle')).toContainText('View Claim');

    // The errors are still shown — a scrub error read-only is still a scrub
    // error — but there is nothing to tick and nothing to save.
    await expect(page.getByTestId('bil--scrub-errors')).toContainText('NPI validation');
    await expect(stage.locator('.bil__field--error')).toHaveCount(2);
    await expect(page.getByTestId('bil--error-0')).toHaveCount(0);
    await expect(page.getByTestId('bil--claim-save')).toHaveCount(0);
    await expect(page.getByTestId('bil--claim-rescrub')).toHaveCount(0);
    await expect(page.getByTestId('bil--claim-close')).toBeVisible();

    await page.getByTestId('bil--claim-close').click();
    await expect(stage).toBeHidden();

    // Edit is the same claim with the controls back.
    await openMenuItem('Edit');
    await expect(page.locator('#claimStageTitle')).toContainText('View Encounter');
    await expect(page.getByTestId('bil--claim-rescrub')).toBeVisible();
    await expect(page.getByTestId('bil--claim-force')).toBeVisible();

    assertClean();
  });

  test('every claim offers the same six actions, whatever its status', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    // Four points across the journey, including All — where the rows are at
    // every stage at once. The menu used to change with the claim's stage, so
    // the item a biller wanted moved as the claim aged.
    for (const chip of ['New', 'Ready to Submit', 'CH Rejected', 'all']) {
      await page.getByTestId(`bil--chip-${chip}`).click();
      await page.getByTestId('bil--table').locator('[data-menu]').first().click();

      const items = page.locator('#bilRowMenu [role="menuitem"]');
      await expect(items).toHaveText(['View', 'Edit', 'Submit', 'CMS 1500', 'UB 04', 'Appeal']);
      await page.keyboard.press('Escape');
    }

    assertClean();
  });

  test('CMS 1500 and UB 04 are two different forms', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const openMenuItem = async (name) => {
      await page.getByTestId('bil--table').locator('[data-menu]').first().click();
      await page.getByRole('menuitem', { name, exact: true }).click();
    };

    await openMenuItem('CMS 1500');
    await expect(page.locator('#modalPaperClaim')).toContainText('HEALTH INSURANCE CLAIM FORM');
    await expect(page.locator('#cmsFormBody')).toContainText("INSURED'S I.D. NUMBER");
    await page.getByTestId('bil--cms-cancel').click();

    // The institutional form: revenue codes and a type of bill, not box 24.
    await openMenuItem('UB 04');
    await expect(page.locator('#modalUb04')).toContainText('UNIFORM BILL');
    await expect(page.locator('#ubFormBody')).toContainText('TYPE OF BILL');
    await expect(page.locator('#ubFormBody')).toContainText('REVENUE CODE');
    await expect(page.locator('#ubFormBody')).toContainText('ATTENDING PROVIDER');
    await page.getByTestId('bil--ub-cancel').click();

    assertClean();
  });

  /* The same form, reached the other way: the header button a batch of
     ready-to-submit claims offers. Both routes have to end in the same
     document or one of them is printing something else. */
  test('Ready to Submit offers the paper claim from the header too', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Ready to Submit').click();

    await page.getByTestId('bil--paperClaim').click();
    await expect(page.locator('#modalPaperClaim')).toContainText('HEALTH INSURANCE CLAIM FORM');
    await expect(page.locator('#cmsFormBody')).toContainText('FEDERAL TAX I.D. NUMBER');
    await page.getByTestId('bil--cms-cancel').click();

    assertClean();
  });

  /* The appeal is raised from the claim it argues with — which is the only
     place it is raised from now that the appeals worklist has gone with
     Payments & Denials. It opens knowing whose claim it is. */
  test('an appeal opens prefilled from the claim it was raised on', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    const patient = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .first()
      .locator('.bil__link-btn')
      .first()
      .textContent();

    await page.getByTestId('bil--table').locator('[data-menu]').first().click();
    await page.getByRole('menuitem', { name: 'Appeal', exact: true }).click();

    await expect(page.locator('#appealFacts')).toContainText(patient.trim());
    await expect(page.locator('#appealFacts')).toContainText('Place of Service');

    assertClean();
  });

  /**
   * A denial is a claim, and since Payments & Denials went it is reached where
   * every other claim is: from Claims. There is no Denied chip — the chip row
   * is the submission pipeline — so the route is the one a biller has, which
   * is to sort All by Status and read down to them. That the route is this
   * long is itself worth knowing.
   */
  test('a payer denial opens Claim Details with denial context and history', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page, 'Claims');

    await page.getByTestId('bil--table').getByRole('button', { name: 'Status' }).click();
    await page.getByTestId('bil--rows-per-page').selectOption('50');
    await page.getByTestId('bil--pages').getByRole('button', { name: '2' }).click();

    const denied = page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .filter({ has: page.locator('ui-badge', { hasText: 'Denied' }) })
      .first();
    await expect(denied).toBeVisible();
    await denied.locator('.bil__link-btn').first().click();
    await expect(page.locator('#claimStageTitle')).toContainText('Claim Details');

    const rail = page.locator('#claimRail');
    await expect(rail).toContainText('Claim Denials');
    await expect(rail).toContainText('Claim History');
    await expect(rail.locator('.bil__timeline-item')).toHaveCount(4);

    // A note written here lands at the top of the rail's own list.
    await page.locator('#newNote textarea').fill('Called payer — appeal packet requested.');
    await page.getByTestId('bil--add-note').click();
    await expect(page.locator('#claimNotes')).toContainText('appeal packet requested');

    assertClean();
  });
});

/**
 * The header's funnel and search box, which live on the tabs that do NOT have
 * a filter bar of their own — Unbilled Encounters and Invoice. Claims and Remits
 * filter from their own bars and are covered separately, above.
 *
 * They used to be checked on Payments & Denials. That tab is gone; the
 * controls are not, and they are the same two controls wherever they appear.
 */
test.describe('billing — the shared filter and search', () => {
  test('the filter narrows the list and says so on the button', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page);

    const total = await chipCount(page, 'insurance');
    await openFilter(page, 'bil--filter');

    const payer = (await filterOptions(page, 'insurance'))[1].trim();
    await tickFilter(page, 'insurance', payer);
    await doneFilter(page);

    expect(await filterCount(page, 'bil--filter')).toBe(1);
    const range = await page.getByTestId('bil--range').textContent();
    expect(range).not.toContain(`of ${total} encounters`);

    await openFilter(page, 'bil--filter');
    await clearFilter(page);
    await doneFilter(page);
    await expect(page.getByTestId('bil--range')).toContainText(`of ${total} encounters`);

    assertClean();
  });

  test('search matches a patient across the worklist', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openBilling(page);

    // nth(2), not nth(1): this worklist is selectable, so the checkbox takes
    // the first cell and the patient sits one further along than the column
    // list reads.
    const first = await page
      .getByTestId('bil--table')
      .locator('tbody tr')
      .first()
      .locator('td')
      .nth(2)
      .textContent();

    await page.locator('#wlSearch input').fill(first.trim());
    const rows = page.getByTestId('bil--table').locator('tbody tr');
    await expect(rows.first()).toContainText(first.trim());

    assertClean();
  });
});


/* ============================================================================
   AR MANAGEMENT

   The thing worth pinning down here is not that a chart draws, but that the
   three views AGREE. Summary, Patient and Insurance are three renderings of
   one set of documents, and the moment any of them starts computing its own
   ageing they will drift — quietly, and in the direction of a number somebody
   chases money with.

   So the assertions are mostly equalities: the Total band equals the chart's
   Total Dues, a row's aged columns sum to its own Total, and the documents
   behind a row sum to the row. Those three hold or the report is wrong.
   ========================================================================= */

/** Every money figure in a row, as numbers. */
async function moneyIn(locator) {
  const text = await locator.innerText();
  return [...text.matchAll(/\$([\d,]+\.\d{2})/g)].map((m) => Number(m[1].replace(/,/g, '')));
}

/** The AR Total band: [...aged columns, total]. */
async function arTotals(page) {
  return moneyIn(page.locator('#arBody [data-testid="bil--ar-total"]'));
}

async function openAr(page, view) {
  await page.goto(BILLING);
  await page.getByRole('tab', { name: 'AR Management' }).click();
  if (view) await page.getByTestId(`bil--ar-tab-${view}`).click();
}

test.describe('billing — AR management', () => {
  test('opens on Summary, and the chart is the two tables added up', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page);

    await expect(page.getByTestId('bil--ar-tab-summary')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#arBody .bil__chart-svg')).toBeVisible();

    /* Six groups — five ageing columns and the pair of totals — two bars each.
       The bars carry no text, so the figures are read from the table the chart
       publishes for screen readers, which is drawn from the same numbers. */
    await expect(page.locator('#arBody .bil__chart-bar')).toHaveCount(12);
    const chart = page.locator('#arBody .bil__chart table');
    await expect(chart).toContainText('0-30 Days');
    await expect(chart).toContainText('120+ Days');

    const [patientDues, insuranceDues] = await moneyIn(chart.locator('tr').last());

    // The same money, reached the other way: each table's own Total band.
    await page.getByTestId('bil--ar-tab-patient').click();
    const patientTotal = (await arTotals(page)).at(-1);
    await page.getByTestId('bil--ar-tab-insurance').click();
    const insuranceTotal = (await arTotals(page)).at(-1);

    expect(patientTotal).toBe(patientDues);
    expect(insuranceTotal).toBe(insuranceDues);

    assertClean();
  });

  test('the aged columns add up to the Total beside them', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    const totals = await arTotals(page);
    const buckets = totals.slice(0, -1);
    expect(buckets.length).toBe(5);
    expect(Number(buckets.reduce((a, b) => a + b, 0).toFixed(2))).toBe(totals.at(-1));

    // And the same on a row, which is where a stored bucket would betray itself.
    const row = page.locator('#arBody .bil__ar-grid tbody tr:not(.bil__ar-total)').first();
    const figures = await moneyIn(row);
    expect(Number(figures.slice(0, -1).reduce((a, b) => a + b, 0).toFixed(2))).toBe(figures.at(-1));

    assertClean();
  });

  /* The Total is of the whole filtered set, not of the page being looked at.
     A total that changed as you turned the page would be a different number
     every time anyone read it. */
  test('the Total band does not change when the page does', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    await expect(page.getByTestId('bil-ar--range')).toContainText('of 16 patients');
    const firstPage = await arTotals(page);

    await page.getByTestId('bil-ar--pages').getByRole('button', { name: '2' }).click();
    await expect(page.getByTestId('bil-ar--range')).toContainText('11-16');
    expect(await arTotals(page)).toEqual(firstPage);

    assertClean();
  });

  test('a patient opens the superbills their balance is made of', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    const row = page.locator('#arBody .bil__ar-grid tbody tr:not(.bil__ar-total)').first();
    const name = (await row.locator('.bil__link-btn').innerText()).trim();
    const rowTotal = (await moneyIn(row)).at(-1);

    await row.locator('.bil__link-btn').click();
    await expect(page.getByTestId('bil--ar-stage')).toBeVisible();
    await expect(page.locator('#arStageTitle')).toHaveText('Patient Listing');
    await expect(page.locator('#arStageAccount')).toContainText(name);
    await expect(page.locator('#arStageDocs thead')).toContainText('Superbill Id');
    await expect(page.locator('#arStageDocs thead')).toContainText('Co-Pay Paid');

    // Every superbill's Balance, summed, is the balance the row was showing.
    const balances = [];
    for (const doc of await page.locator('#arStageDocs tbody tr').all()) {
      balances.push((await moneyIn(doc)).at(-1));
    }
    expect(balances.length).toBeGreaterThan(0);
    expect(Number(balances.reduce((a, b) => a + b, 0).toFixed(2))).toBe(rowTotal);

    await page.getByTestId('bil--ar-back').click();
    await expect(page.getByTestId('bil--ar-stage')).toBeHidden();
    await expect(page.locator('#arBody .bil__ar-grid')).toBeVisible();

    assertClean();
  });

  test('Insurance lists payers and opens their claims', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'insurance');

    /* Payer ID, not Patient ID. These rows are insurance companies, and a
       column headed for the patient would be reconciled against the wrong
       thing. */
    const head = page.locator('#arBody .bil__ar-grid thead');
    await expect(head).toContainText('Payer ID');
    await expect(head).toContainText('Payer Name');
    await expect(head).not.toContainText('Patient ID');

    await page.locator('#arBody .bil__ar-grid tbody tr:not(.bil__ar-total) .bil__link-btn')
      .first().click();
    await expect(page.locator('#arStageTitle')).toHaveText('Insurance Listing');
    await expect(page.locator('#arStageDocs thead')).toContainText('Date of Claim Submission');
    await expect(page.locator('#arStageDocs thead')).toContainText('Paid Amount');

    assertClean();
  });

  /* The bucket width re-cuts every column and every bar rather than hiding
     rows — which is the whole reason it is a width and not a date range. */
  test('the bucket width re-cuts the columns, and the total survives it', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    const before = (await arTotals(page)).at(-1);
    await expect(page.locator('#arBody .bil__ar-grid thead')).toContainText('31-60 Days');

    await page.getByTestId('bil--ar-width').locator('select').selectOption('60');
    const head = page.locator('#arBody .bil__ar-grid thead');
    await expect(head).toContainText('0-60 Days');
    await expect(head).toContainText('240+ Days');
    await expect(head).not.toContainText('31-60 Days');

    // Same money, cut differently — nothing was filtered out.
    expect((await arTotals(page)).at(-1)).toBe(before);

    assertClean();
  });

  /* Winding the as-of date back makes everything younger, and drops whatever
     had not been billed yet — so the total can only shrink. */
  test('the as-of date re-ages the report', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    const before = (await arTotals(page)).at(-1);
    await page.getByTestId('bil--ar-asof').locator('input').fill('2026-04-13');
    const after = (await arTotals(page)).at(-1);

    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);

    assertClean();
  });

  test('search narrows to one payer and the total narrows with it', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'insurance');

    const all = (await arTotals(page)).at(-1);
    await page.getByTestId('bil--ar-search').locator('input').fill('Medicare');

    const rows = page.locator('#arBody .bil__ar-grid tbody tr:not(.bil__ar-total)');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Medicare');
    expect((await arTotals(page)).at(-1)).toBeLessThan(all);

    assertClean();
  });

  /* AR keeps its own panel and does not borrow the worklist, so the worklist
     has to be exactly where it was left when the user comes back. */
  test('leaving AR and returning leaves the worklist intact', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openAr(page, 'patient');

    await page.getByRole('tab', { name: 'Claims' }).click();
    await expect(page.getByTestId('bil--table')).toBeVisible();
    await expect(page.getByTestId('bil--table').locator('thead')).toContainText('Claim ID');

    await page.getByRole('tab', { name: 'AR Management' }).click();
    // Back at the sub-view AR opens on, with the worklist put away.
    await expect(page.getByTestId('bil--ar-tab-summary')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('bil--table')).toBeHidden();

    assertClean();
  });
});
/**
 * REMITS — the payer's payment advice, and the one act it exists for.
 *
 * What is worth pinning down is not that a table of remits renders, but that
 * posting actually MOVES money onto claims, that a remit's Status is the
 * claims underneath it rather than a second copy of the truth, and that the
 * two things asked for — no action column, tick boxes that post a batch — are
 * still true.
 */
test.describe('billing — remits', () => {
  const openRemits = (page) => openBilling(page, 'Remits');

  /** Every Status badge currently in the worklist, in row order. */
  const statuses = (page) =>
    page.getByTestId('bil--table').locator('tbody tr td:last-child').allTextContents();

  test('the worklist has the remit columns, tick boxes and no action column', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    for (const column of [
      'ERA Control Number', 'ERA Date', 'Check/EFT No', 'Payment Method',
      'Payment Date', 'Payer Name', 'Amount', 'Source', 'Status',
    ]) {
      await expect(page.getByTestId('bil--table').locator('thead')).toContainText(column);
    }

    /* The two changes asked for against the design: the ⋮ column is gone, and
       the rows can be ticked instead. Everything a remit offers is either its
       control number or posting, and posting is a batch. */
    await expect(page.getByTestId('bil--table').locator('thead')).not.toContainText('Action');
    await expect(page.getByTestId('bil--table').locator('[data-menu]')).toHaveCount(0);
    await expect(page.getByTestId('bil--table').locator('.ui-table__select-all')).toBeVisible();

    // No chip row and no header search: Remits narrows from the shared funnel.
    await expect(page.locator('#statusBar')).toBeHidden();
    await expect(page.getByTestId('bil--search')).toHaveCount(0);
    await expect(page.getByTestId('bil--filter')).toBeVisible();

    assertClean();
  });

  test('bulk post applies the batch and leaves posted remits alone', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    const before = await statuses(page);
    const alreadyPosted = before.filter((text) => text.trim() === 'Posted').length;
    expect(alreadyPosted, 'the fixture needs one posted remit to skip').toBeGreaterThan(0);

    // Nothing ticked, so the batch action refuses to open a dialog.
    await expect(page.getByTestId('bil--bulk').locator('button')).toBeDisabled();

    await page.getByTestId('bil--table').locator('.ui-table__select-all').check();
    await expect(page.getByTestId('bil--bulk')).toContainText(`Post Remits (${before.length})`);
    await page.getByTestId('bil--bulk').click();

    /* The confirm counts only what it is actually about to do, and says so
       about the rest rather than silently reposting it. */
    await expect(page.getByRole('heading', { name: 'Post Remits' })).toBeVisible();
    await expect(page.locator('#confirmBody')).toContainText(
      `${before.length - alreadyPosted} Remits`
    );
    await expect(page.locator('#confirmBody')).toContainText('already posted and will be left alone');

    await runFlow(page, 'Post Payments');
    await expect(page.getByRole('heading', { name: 'Payments Posted' })).toBeVisible();
    await page.getByTestId('bil--done-okay').click();

    // Every remit on the page now reads Posted — including the one skipped.
    const after = await statuses(page);
    expect(after.map((text) => text.trim())).toEqual(after.map(() => 'Posted'));

    assertClean();
  });

  test('a remit opens the payment, its claims, and what makes up each one', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    const control = await page.getByTestId('bil--table')
      .locator('[data-open-remit]').first().textContent();
    await page.getByTestId('bil--table').locator('[data-open-remit]').first().click();

    const stage = page.getByTestId('bil--remit-stage');
    await expect(stage).toBeVisible();
    // The control number heads the document rather than hiding among its facts.
    await expect(page.locator('#remitBand')).toHaveText(control.trim());

    for (const label of [
      'Billing Provider', 'Post Date', 'ERA Control Number', 'Receiver Bank Routing Number',
      'Payer', 'Check/EFT number', 'Payment Method', 'Payer Account Number', 'ERA Date',
      'Payment Date', 'Amount', 'Receiver Account Number', 'Payer Bank Routing Number',
    ]) {
      await expect(page.locator('#remitFacts')).toContainText(label);
    }

    for (const column of [
      'Claim ID', 'Payers Claim ID', 'Charge Amount ($)', 'Ins Paid ($)',
      'Patient Responsibility ($)', 'Claim Received Date', 'Status',
    ]) {
      await expect(page.locator('#remitClaimsTable thead')).toContainText(column);
    }

    /* A claim expands into BOTH sub-tables: what the payer priced, and the
       adjustments accounting for the gap between billed and paid. */
    await stage.locator('[data-remit-toggle]').first().click();
    const panel = stage.locator('.bil__subtables').first();
    await expect(panel).toContainText('Service Lines');
    await expect(panel).toContainText('Line Control Number');
    await expect(panel).toContainText('ERA Adjustment');
    await expect(panel).toContainText('Group Code');

    assertClean();
  });

  test("a remit's status is the claims on it, not a second copy of them", async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);
    await page.getByTestId('bil--table').locator('[data-open-remit]').first().click();

    const stage = page.getByTestId('bil--remit-stage');
    const claims = stage.locator('[data-remit-status]');
    const total = await claims.count();

    // Post every claim by hand; the remit's own badge has to follow them.
    for (let i = 0; i < total; i += 1) {
      await claims.nth(i).click();
      const posted = page.getByRole('menuitem', { name: 'Posted', exact: true });
      // Already Posted claims are not offered the status they are in.
      if (await posted.count()) await posted.click();
      else await page.keyboard.press('Escape');
    }

    await expect(page.locator('#remitStageTags')).toContainText('Posted');
    await expect(page.locator('#remitStageTags')).not.toContainText('Partially');

    // And the worklist behind the stage agrees, because it reads the same claims.
    await page.getByTestId('bil--remit-back').click();
    await expect(page.getByTestId('bil--table').locator('tbody tr').first()).toContainText('Posted');

    assertClean();
  });

  test('the filter bar narrows by the claims inside a remit, and resets', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    const all = await page.getByTestId('bil--range').textContent();

    /* Patient is asked of the CLAIMS on the remit — a payment advice has no one
       patient — so picking one has to leave a shorter list, not an empty one. */
    await openFilter(page, 'bil--filter');
    const patient = (await filterOptions(page, 'patient'))[1].trim();
    await tickFilter(page, 'patient', patient);
    await doneFilter(page);
    await expect(page.getByTestId('bil--range')).not.toHaveText(all);
    await expect(page.getByTestId('bil--table').locator('tbody tr').first()).toBeVisible();

    await openFilter(page, 'bil--filter');
    await clearFilter(page);
    await doneFilter(page);
    await expect(page.getByTestId('bil--range')).toHaveText(all);

    assertClean();
  });

  test('a remit keyed in by hand lands as Manual Entry with nothing posted', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    await page.getByTestId('bil--remitAdd').click();
    // The two fields that make a remit a remit are refused when missing.
    await page.getByTestId('bil--ra-save').click();
    await expect(page.locator('#billFlash')).toContainText('ERA control number');

    await page.locator('#raControl input').fill('55501234');
    await page.locator('#raAmount input').fill('1250.75');
    await page.getByTestId('bil--ra-save').click();

    const first = page.getByTestId('bil--table').locator('tbody tr').first();
    await expect(first).toContainText('55501234');
    await expect(first).toContainText('$1,250.75');
    // Keyed in by hand, and the Source column says so rather than the operator.
    await expect(first).toContainText('Manual Entry');
    // No claims matched yet, so there is genuinely nothing posted.
    await expect(first).toContainText('Not Posted');

    assertClean();
  });

  test('Upload EDI reuses the 835 dialog under its own name', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openRemits(page);

    await page.getByTestId('bil--remitUploadEdi').click();
    await expect(page.locator('#modalEraUpload')).toContainText('Upload EDI');
    await expect(page.locator('#modalEraUpload')).toContainText('ANSI 835');
    await page.getByTestId('bil--era-upload-cancel').click();

    /* A PDF is a picture of a remittance, not a remittance, and the dialog
       says so instead of implying the file will be read. */
    await page.getByTestId('bil--remitUploadPdf').click();
    await expect(page.locator('#modalRemitPdf')).toContainText('Add Remit');
    await page.getByTestId('bil--remit-pdf-cancel').click();

    assertClean();
  });
});


/* ============================================================================
   PATIENT COLLECTION

   A worklist, so the moves are what matter: a balance that is sent a notice
   has to LEAVE the rung it was on and arrive on the next one, and the total
   across all rungs has to be unchanged by the journey — chasing money does
   not create or destroy any.

   The other half is the arithmetic the row promises. Clinic + ASC = Total
   Outstanding is printed three columns apart on every row, and the charges
   behind the account have to come to the same figure. Those are the numbers
   somebody rings a patient about.
   ========================================================================= */

async function openCollection(page) {
  await page.goto(BILLING);
  await page.getByRole('tab', { name: 'Patient Collection' }).click();
}

/**
 * Narrow the collection list from the funnel.
 *
 * Everything lives in one panel now — the Quick view chips and the inline bar
 * both collapsed into it — so a test that narrows the list opens it, fills it
 * and commits, which is also the flow a user walks.
 */
async function filterCollection(page, fields) {
  await openFilter(page, 'bil--filter');
  for (const [group, value] of Object.entries(fields)) {
    await tickFilter(page, group, value);
  }
  await doneFilter(page);
}

/**
 * Walk the notice flow to its end.
 *
 * Not the shared runFlow(): the bulk button reads "Send notice (10)" and the
 * commit button in the dialog reads "Send Notice", and a by-name lookup for
 * the second matches the first too. The dialog's own test id is unambiguous —
 * and is what a test should be reaching for once two controls on one screen
 * legitimately share a verb.
 */
async function runNoticeFlow(page) {
  await page.getByTestId('bil--confirm-go').click();
  await expect(page.locator('#modalProgress .ui-modal')).toBeVisible();
  await expect(page.locator('#modalProgress .ui-modal')).toBeHidden({ timeout: 15000 });
}

/** How many accounts the range line is reporting. An empty list says
 *  "No accounts" rather than "0 of 0", so that shape is read too. */
async function collectionCount(page) {
  const text = (await page.getByTestId('bil--range').textContent()).trim();
  if (/^No accounts/.test(text)) return 0;
  const match = text.match(/of ([\d,]+) accounts/);
  expect(match, `unreadable range line: "${text}"`).not.toBeNull();
  return Number(match[1].replace(/,/g, ''));
}

/**
 * How many accounts sit on a rung.
 *
 * By filtering to it and reading the range line — the Quick view chips that
 * used to print the number are gone, and this asks the list the same question
 * they were answering. It LEAVES the list filtered to that rung, which is
 * usually what the caller wanted next anyway.
 */
async function statusCount(page, status) {
  await filterCollection(page, { status });
  return collectionCount(page);
}

/** Every visible row's [clinic, asc, total], as numbers. */
async function collectionRowMoney(page) {
  const rows = [];
  for (const row of await page.locator('#worklist tbody tr').all()) {
    rows.push(await moneyIn(row));
  }
  return rows;
}

test.describe('billing — patient collection', () => {
  /**
   * Nothing over the table but the table.
   *
   * This tab used to carry a row of Quick view chips AND an inline bar of five
   * selects — the only tab on the screen with two levels of narrowing over one
   * list, and two places to look when it came back shorter than expected. Both
   * are behind the funnel now.
   */
  test('opens on the whole list, with no chips and no filter bar', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    await expect(page.locator('#statusBar')).toBeHidden();
    await expect(page.locator('#statusChips button')).toHaveCount(0);
    await expect(page.getByTestId('bil--filter')).toBeVisible();

    await expect(page.getByTestId('bil--range')).toContainText('of 212 accounts');

    for (const column of [
      'Account #', 'Patient Name', 'Clinic', 'ASC', 'Total Outstanding',
      'Ageing Bucket', 'Attempts', 'Status', 'Last Notice', 'Payment Plan', 'Last Payment',
    ]) {
      await expect(page.locator('#worklist thead')).toContainText(column);
    }

    assertClean();
  });

  /** All six, and Status among them — it was the chips' job and is a field now. */
  test('the panel holds every filter, status included', async ({ page }) => {
    await openCollection(page);
    await openFilter(page, 'bil--filter');

    const panel = filterPanel(page);
    for (const field of [
      'Status', 'Ageing bucket', 'Attempts', 'Entity', 'Patient', 'Balance',
    ]) {
      await expect(panel).toContainText(field);
    }
  });

  /* Status and the Status column are one vocabulary. Picking one must leave a
     table whose every Status says the same word back — if the two ever drift
     apart, the filter selects rows that say something else and neither the
     count nor the column can be trusted. */
  test('the status filter selects exactly the rows whose Status says the same word', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    for (const rung of ['Statement due', 'Notice sent', 'Payment plan']) {
      await filterCollection(page, { status: rung });

      const statuses = await page.locator('#worklist tbody tr td:nth-child(9)').allInnerTexts();
      expect(statuses.length).toBeGreaterThan(0);
      expect([...new Set(statuses.map((text) => text.trim()))]).toEqual([rung]);
    }

    assertClean();
  });

  /** The funnel lights up while it is holding something back, and goes out
   *  again on Reset — otherwise a filtered list looks like a short one. */
  test('the funnel shows when a filter is on', async ({ page }) => {
    await openCollection(page);
    expect(await filterCount(page, 'bil--filter')).toBe(0);

    await filterCollection(page, { status: 'Notice sent' });
    expect(await filterCount(page, 'bil--filter')).toBe(1);

    await openFilter(page, 'bil--filter');
    await clearFilter(page);
    await doneFilter(page);
    expect(await filterCount(page, 'bil--filter')).toBe(0);
    await expect(page.getByTestId('bil--range')).toContainText('of 212 accounts');
  });

  /* Deliberately NOT what the design draws. The mock offers a Status select
     beside the quick-view chips; two controls over one field can be set to
     disagree, and then the highlighted chip and the narrowed table say
     different things about what is on screen. */
  test('Entity means owing money here, not having been seen here', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    // Entity means "owes money HERE", so every row left has an ASC balance.
    await filterCollection(page, { entity: 'ASC' });
    const rows = await collectionRowMoney(page);
    expect(rows.length).toBeGreaterThan(0);
    for (const [, asc] of rows) expect(asc).toBeGreaterThan(0);

    assertClean();
  });

  test('the ageing filter agrees with the badge the row prints', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    await filterCollection(page, { bucket: '90+' });
    const badges = await page.locator('#worklist tbody tr td:nth-child(7)').allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    expect([...new Set(badges.map((text) => text.trim()))]).toEqual(['90+']);

    assertClean();
  });

  /* Clinic + ASC = Total Outstanding, printed three columns apart. A stored
     total is exactly how those three come to disagree. */
  test('Clinic and ASC add up to Total Outstanding on every row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    const rows = await collectionRowMoney(page);
    expect(rows.length).toBe(10);
    for (const figures of rows) {
      // An entity with nothing owing prints a dash, so a row reads as either
      // [clinic, asc, total] or [one entity, total].
      const total = figures.at(-1);
      const parts = figures.slice(0, -1);
      expect(Number(parts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(total);
    }

    assertClean();
  });

  test('the account number opens the charges the balance is made of', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    const row = page.locator('#worklist tbody tr').first();
    const rowTotal = (await moneyIn(row)).at(-1);
    const account = (await row.locator('.bil__link-btn').innerText()).trim();

    await row.locator('.bil__link-btn').click();
    await expect(page.locator('#modalCollection .ui-modal')).toBeVisible();
    await expect(page.locator('#modalCollection')).toContainText(account.replace('#', ''));
    await expect(page.locator('#collectionFacts')).toContainText('Total Outstanding');

    // Every charge, summed, is the Total Outstanding the row was showing.
    const charges = page.locator('#collectionCharges tbody tr:not(.bil__coll-total)');
    expect(await charges.count()).toBeGreaterThan(0);
    let sum = 0;
    for (const charge of await charges.all()) sum += (await moneyIn(charge)).at(-1);
    expect(Number(sum.toFixed(2))).toBe(rowTotal);

    assertClean();
  });

  /* The move the screen exists to make. Ten accounts leave the rung they were
     on and arrive on Notice sent; All is unchanged, because chasing money
     neither creates nor destroys any. */
  test('sending notices moves accounts up the ladder and leaves the total alone', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    const all = await collectionCount(page);
    const noticedBefore = await statusCount(page, 'Notice sent');
    // Last, so the list is left on the rung this test works from.
    const freshBefore = await statusCount(page, 'New balance');

    await selectAll(page);
    await expect(page.getByTestId('bil--bulk')).toContainText('Send notice (10)');

    await page.getByTestId('bil--bulk').click();
    await expect(page.locator('#confirmBody')).toContainText('10 patients');
    await runNoticeFlow(page);
    await expect(page.locator('#doneBody')).toContainText('10 Notices sent');
    await page.getByTestId('bil--done-okay').click();

    expect(await statusCount(page, 'New balance')).toBe(freshBefore - 10);
    // Filtering to the rung they arrived at also proves they carry the status
    // the notice stamped on.
    expect(await statusCount(page, 'Notice sent')).toBe(noticedBefore + 10);
    await expect(page.locator('#worklist tbody tr').first()).toContainText('Notice sent');

    // Chasing money neither creates nor destroys an account.
    await filterCollection(page, { status: '' });
    expect(await collectionCount(page)).toBe(all);

    assertClean();
  });

  test('one account can be noticed from its own row', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    const before = await statusCount(page, 'Notice sent');
    await filterCollection(page, { status: 'New balance' });

    await page.locator('#worklist tbody [data-menu]').first().click();
    await page.getByRole('menuitem', { name: 'Send Notice' }).click();
    await expect(page.locator('#confirmBody')).toContainText('1 patient');
    await runNoticeFlow(page);
    await page.getByTestId('bil--done-okay').click();

    expect(await statusCount(page, 'Notice sent')).toBe(before + 1);

    assertClean();
  });

  /* The menu is the rung's own list of what is left to try. An account
     already with an agency cannot be sent to one again. */
  test('the row menu offers only what that rung has left', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);
    await filterCollection(page, { status: 'New balance' });

    await page.locator('#worklist tbody [data-menu]').first().click();
    await expect(page.locator('#bilRowMenu')).toContainText('Start Payment Plan');
    await expect(page.locator('#bilRowMenu')).toContainText('Send to Agency');
    await page.keyboard.press('Escape');

    await filterCollection(page, { status: 'With agency' });
    await page.locator('#worklist tbody [data-menu]').first().click();
    await expect(page.locator('#bilRowMenu')).toContainText('View Account');
    await expect(page.locator('#bilRowMenu')).not.toContainText('Send to Agency');

    assertClean();
  });

  test('a payment plan takes the account off the chasing rungs', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    const before = await statusCount(page, 'Payment plan');
    await filterCollection(page, { status: 'Ready to escalate' });

    await page.locator('#worklist tbody [data-menu]').first().click();
    await page.getByRole('menuitem', { name: 'Start Payment Plan' }).click();

    expect(await statusCount(page, 'Payment plan')).toBe(before + 1);
    await expect(page.locator('#worklist tbody')).toContainText('Active');

    assertClean();
  });

  test('Export reports the view rather than the whole worklist', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openCollection(page);

    await page.getByTestId('bil--collectionExport').click();
    await expect(page.locator('#billFlash')).toContainText('212 accounts exported');

    await filterCollection(page, { status: 'With agency' });
    await page.getByTestId('bil--collectionExport').click();
    await expect(page.locator('#billFlash')).toContainText('the current view');

    assertClean();
  });
});
test.describe('billing — accessibility', () => {
  test('the worklist has no axe violations', async ({ page }) => {
    await page.goto(BILLING);
    await expectNoA11yViolations(page);
  });

  /* Claims carries a status cell that is a menu button rather than a static
     badge, so it is checked on its own rather than through the landing tab. */
  test('the Claims worklist has no axe violations', async ({ page }) => {
    await openBilling(page, 'Claims');
    await expect(page.getByTestId('bil--filter')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('the claim stage has no axe violations', async ({ page }) => {
    await openBilling(page, 'Claims');
    await page.getByTestId('bil--chip-Scrub Error').click();
    await page.getByTestId('bil--table').locator('.bil__link-btn').first().click();
    await expect(page.getByTestId('bil--claim-stage')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  /* The remit stage is checked expanded, because that is where its two
     hand-authored sub-tables live — nested inside a cell of another table,
     each named by a <caption> rather than a heading floating above it. */
  test('the remit stage has no axe violations, expanded', async ({ page }) => {
    await openBilling(page, 'Remits');
    await page.getByTestId('bil--table').locator('[data-open-remit]').first().click();
    await page.getByTestId('bil--remit-stage').locator('[data-remit-toggle]').first().click();
    await expect(page.getByTestId('bil--remit-stage').locator('.bil__subtables').first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  /* The chart is the reason to check this one. Its SVG is hidden from
     assistive technology and the figures are published as a table instead, so
     what axe is being asked is whether that swap left anything unreachable. */
  test('AR Summary has no axe violations', async ({ page }) => {
    await openBilling(page, 'AR Management');
    await expect(page.locator('#arBody .bil__chart-svg')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  /* The tab's narrowing all lives in one dialog now — chips and inline bar
     both gone — so the panel is checked open as well as shut. The account
     dialog goes with it. */
  test('Patient Collection and its account dialog have no axe violations', async ({ page }) => {
    await openBilling(page, 'Patient Collection');
    await expectNoA11yViolations(page);

    await openFilter(page, 'bil--filter');
    await expect(filterPanel(page)).toBeVisible();
    await expectNoA11yViolations(page);
    await doneFilter(page);

    await page.locator('#worklist tbody .bil__link-btn').first().click();
    await expect(page.locator('#modalCollection .ui-modal')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('the AR ageing table and its stage have no axe violations', async ({ page }) => {
    await openBilling(page, 'AR Management');
    await page.getByTestId('bil--ar-tab-patient').click();
    await expect(page.locator('#arBody .bil__ar-grid')).toBeVisible();
    await expectNoA11yViolations(page);

    await page.locator('#arBody .bil__ar-grid tbody tr:not(.bil__ar-total) .bil__link-btn')
      .first().click();
    await expect(page.getByTestId('bil--ar-stage')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
