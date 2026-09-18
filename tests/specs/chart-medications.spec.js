/**
 * Chart — Medication module.
 *
 * The page carries three records on three tabs and the tests are mostly about
 * keeping them apart. Active answers "what is this person on right now" —
 * prescriptions written for them and medications reported from elsewhere,
 * composed into one A–Z. Past is what has stopped, and why. During Procedure
 * is what they were GIVEN under sedation, read back from the anaesthesia
 * record; a drug pushed once during a case is not something the patient is
 * on, and the tests below check it never joins either list.
 *
 * Nothing is entered here. Prescribing is the e-prescribing integration under
 * Prescriptions, tested in chart-prescriptions.spec.js.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_MEDS = '/screens/patient-chart.html?mrn=326486#medications';
/** On nothing at all, but has had an EGD — so the two records can be told
 *  apart on this chart without a populated list masking the difference. */
const LIAM_MEDS = '/screens/patient-chart.html?mrn=326481#medications';

/** The second record lives on its own tab; every assertion about it starts
 *  by pressing that tab, the way a reader would. */
async function openTab(page, name) {
  await page.getByTestId('chart--med-tabs').getByRole('tab', { name }).click();
}

const openGivenTab = (page) => openTab(page, 'During Procedure');

test.describe('chart medication module', () => {
  test('merges prescribed and reported medications into one A–Z list', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_MEDS);

    await expect(page.getByTestId('chart--module-title')).toHaveText('Medication');

    // 3 active prescriptions + 3 reported from the reconciled clinical list.
    const rows = page.getByTestId('chart--med-list-table').locator('tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText('Amlodipine 5mg');
    await expect(rows.last()).toContainText('Sertraline 50mg tablet');

    assertClean();
  });

  test('the list describes how a drug is taken, not when it was given', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    const head = page.getByTestId('chart--med-list-table').locator('thead');

    for (const column of [
      'Medication', 'Quantity', 'Dosage Unit', 'Frequency', 'Lot',
      'Start Date', 'End Date', 'Prescriber',
    ]) {
      await expect(head).toContainText(column);
    }

    // Provenance is carried by the blanks now, not by a badge of its own.
    await expect(head).not.toContainText('Source');
  });

  /**
   * With the Source column gone, what a row is filled in with is what says
   * where it came from: a drug this practice dispensed has a quantity, a
   * prescriber and an end date, and one the patient reports has none of them.
   */
  test('a dispensed row is filled in; a reported one is honestly blank', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    const rows = page.getByTestId('chart--med-list-table').locator('tbody tr');

    // Ours: quantity and unit off the dispense, the sig as the frequency,
    // both dates, and the prescriber who wrote it.
    const sertraline = rows.filter({ hasText: 'Sertraline' });
    await expect(sertraline).toContainText('30');
    await expect(sertraline).toContainText('Tablet');
    await expect(sertraline).toContainText('1 tablet orally twice daily');
    await expect(sertraline).toContainText('07 Oct 2025');
    await expect(sertraline).toContainText('Dr. A. Mensah');

    // Somebody else's: a frequency and a start date were all anyone collected,
    // so the rest is em dashes rather than numbers nobody counted.
    const metformin = rows.filter({ hasText: 'Metformin' });
    await expect(metformin).toContainText('Twice daily');
    await expect(metformin).toContainText('23 Aug 2020');
    await expect(metformin.locator('td', { hasText: /^—$/ }).first()).toBeVisible();
  });

  /* The reconciliation line has been taken off the page: the panel is the
     record and nothing but the record now, so the only thing left to assert
     about it is that no stray line is drawn above the table. */
  test('no reconciliation line sits above the list', async ({ page }) => {
    await openChart(page, HENNA_MEDS);

    await expect(page.getByTestId('chart--med-list-reconciled')).toHaveCount(0);
  });

  test('search filters across name, sig, diagnosis and prescriber', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    const rows = page.getByTestId('chart--med-list-table').locator('tbody tr');
    const search = page.getByTestId('chart--med-list-search').locator('input');

    await search.fill('Metformin');
    await expect(rows).toHaveCount(1);

    // A prescriber matches too — "everything Dr. Bianchi started" is a real
    // question, and only prescriptions carry one.
    await search.fill('Bianchi');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Hydroxyzine');

    await search.fill('');
    await expect(rows).toHaveCount(6);
  });

  /**
   * The page is a read, and nothing is entered on it. A script is written in
   * Prescriptions and the reconciled list is confirmed on Profile · Clinical;
   * both already had a door, and a third one onto the same two records is how
   * a med list ends up disagreeing with itself.
   */
  test('nothing is added from here — no button and no dialog', async ({ page }) => {
    await openChart(page, HENNA_MEDS);

    await expect(page.getByTestId('chart--med-list-add')).toHaveCount(0);
    await expect(page.locator('#medAddModal')).toHaveCount(0);
    // The toolbar keeps a search and the view strip, and nothing that writes.
    await expect(page.getByTestId('chart--med-list-search')).toBeVisible();
    await expect(page.getByTestId('chart--med-tabs')).toBeVisible();
  });

  test('a patient on nothing gets an empty list', async ({ page }) => {
    await openChart(page, LIAM_MEDS);

    await expect(page.getByTestId('chart--med-list-table')).toContainText(
      'No active medications recorded.'
    );
  });
});

/**
 * PAST MEDICATION.
 *
 * Moved here from the Prescriptions module when that section became the
 * e-prescribing integration. It is the other half of the Active list and is
 * built from the same two sources, so the tests below are largely about the
 * one fact only a stopped drug has — why it stopped — and about the two lists
 * never leaking into each other.
 */
test.describe('chart medication — past', () => {
  const past = (page) => page.getByTestId('chart--med-past-table').locator('tbody tr');

  test('past medication carries a Status column Active does not', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_MEDS);

    await expect(page.getByTestId('chart--med-list-table').locator('thead')).not.toContainText(
      'Status'
    );

    await openTab(page, 'Past');
    const table = page.getByTestId('chart--med-past-table');
    await expect(table.locator('thead')).toContainText('Status');
    await expect(past(page)).toHaveCount(2);
    await expect(table.getByText('Completed')).toBeVisible();
    await expect(table.getByText('Discontinued')).toBeVisible();

    assertClean();
  });

  /* Discontinued is somebody stopping a drug early and is the row a reader
     scans a past list for; Completed is a course that ran its length and is
     not news. Only one of the two gets colour. */
  test('only a discontinuation is marked', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    await openTab(page, 'Past');

    await expect(
      past(page).filter({ hasText: 'Metronidazole' }).locator('ui-badge[status="critical"]')
    ).toBeVisible();
    await expect(
      past(page).filter({ hasText: 'Omeprazole' }).locator('ui-badge[status="neutral"]')
    ).toBeVisible();
  });

  /* The one thing the split must never get wrong: a drug that has stopped is
     not a drug the patient is on. */
  test('a stopped drug never appears in the active list', async ({ page }) => {
    await openChart(page, HENNA_MEDS);

    await expect(page.getByTestId('chart--med-list-table')).not.toContainText('Metronidazole');
  });

  /* Both halves are always on the strip, even when one is empty: a Past tab
     that came and went with the data would leave a reader unable to tell
     "nothing has stopped" from "this chart does not keep that". */
  test('the tab is there, and empty, for a patient with nothing stopped', async ({ page }) => {
    await openChart(page, LIAM_MEDS);
    await openTab(page, 'Past');

    await expect(page.getByTestId('chart--med-past-table')).toContainText(
      'No past medications recorded.'
    );
  });

  test('the search reaches it from the active tab', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    const list = page.getByTestId('chart--med-list-table');

    await page.getByTestId('chart--med-list-search').locator('input').fill('Metronidazole');
    await expect(list.locator('tbody tr')).toHaveCount(0);
    await expect(list).toContainText('1 match under Past');

    await openTab(page, 'Past');
    await expect(past(page)).toHaveCount(1);
  });
});

/**
 * WHAT WAS GIVEN DURING A PROCEDURE
 *
 * Read back from the anaesthesia record rather than retyped, so the chart and
 * the encounter cannot end up as two accounts of one sedation.
 */
test.describe('chart medication — given during a procedure', () => {
  const given = (page) => page.getByTestId('chart--med-given-table').locator('tbody tr');

  test('the sedation record is read back onto the chart', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_MEDS);

    // Two tabs, and the list is the one the page opens on.
    const tabs = page.getByTestId('chart--med-tabs');
    await expect(tabs.getByRole('tab', { name: 'Active' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByTestId('chart--med-given')).toBeHidden();

    await openGivenTab(page);
    await expect(page.getByTestId('chart--med-given')).toBeVisible();
    await expect(page.getByTestId('chart--med-list-table')).toBeHidden();

    // The three drugs from her 23 Oct 2025 surveillance colonoscopy.
    await expect(given(page)).toHaveCount(3);
    const midazolam = given(page).filter({ hasText: 'Midazolam' });
    await expect(midazolam).toContainText('2 mg');
    await expect(midazolam).toContainText('IV');
    await expect(midazolam).toContainText('sedation');
    // The case it belongs to, and when — 09:12 alone is unreadable a year on.
    await expect(midazolam).toContainText('Colonoscopy — surveillance');
    await expect(midazolam).toContainText('23 Oct 2025');
    await expect(midazolam).toContainText('09:12');
    await expect(midazolam).toContainText('M. Osei, CRNA');

    assertClean();
  });

  /**
   * THE POINT OF THE WHOLE SEPARATION. A drug given once under sedation
   * finished when the case did. If it were sorted into the A–Z above, the
   * chart would be saying the patient takes propofol — which is the one thing
   * a medication list must never say by accident.
   */
  test('an administered drug never joins the active list', async ({ page }) => {
    await openChart(page, HENNA_MEDS);

    const active = page.getByTestId('chart--med-list-table').locator('tbody tr');
    await expect(active).toHaveCount(6);
    await expect(page.getByTestId('chart--med-list-table')).not.toContainText('Midazolam');
    await expect(page.getByTestId('chart--med-list-table')).not.toContainText('Fentanyl');
  });

  /** A patient on nothing can still have been given something. */
  test('it shows on a chart whose active list is empty', async ({ page }) => {
    await openChart(page, LIAM_MEDS);
    await openGivenTab(page);

    await expect(given(page)).toHaveCount(2);
    await expect(given(page).first()).toContainText('EGD — diagnostic');
  });

  /* A reversal is the row a reader scans this table for — flumazenil in a
     sedation record means something went wrong enough to reverse it — so it
     is the one thing marked rather than left to be read out of the text. */
  test('a reversal agent is marked, and ordinary sedation is not', async ({ page }) => {
    await openChart(page, LIAM_MEDS);
    await openGivenTab(page);

    await expect(
      given(page).filter({ hasText: 'Flumazenil' }).locator('ui-badge[status="warning"]')
    ).toBeVisible();
    await expect(
      given(page).filter({ hasText: 'Midazolam' }).locator('ui-badge[status="neutral"]')
    ).toBeVisible();
  });

  /**
   * One search box over one page. Someone typing a drug name is asking the
   * chart, not the tab they happen to be standing on — and because the other
   * tab is out of sight, an empty table on its own would quietly read as "not
   * on this chart". So the empty state names the tab holding the matches.
   */
  test('the search runs over both records and says where the matches are', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    const list = page.getByTestId('chart--med-list-table');
    const active = list.locator('tbody tr');
    const search = page.getByTestId('chart--med-list-search').locator('input');

    // A sedation drug, searched from the Medication tab.
    await search.fill('Fentanyl');
    await expect(active).toHaveCount(0);
    await expect(list).toContainText('1 match under During Procedure');

    await openGivenTab(page);
    await expect(given(page)).toHaveCount(1);

    // And the same in reverse, from the tab it landed on.
    await search.fill('Metformin');
    await expect(given(page)).toHaveCount(0);
    await expect(page.getByTestId('chart--med-given-table')).toContainText(
      '1 match under Active'
    );

    await openTab(page, 'Active');
    await expect(active).toHaveCount(1);
  });

  /** During Procedure is a SECOND RECORD rather than the other half of this
   *  one: a patient who has never had a procedure does not have it at all, so
   *  the tab is not drawn. Active and Past stay either way — see the tabs
   *  hook in chart-medications.js for why an empty half is still shown. */
  test('the tab is absent for a patient who has never had a procedure', async ({ page }) => {
    /* 326477 has a chart of her own. An MRN with no chart record silently
       falls back to the default patient, which would have made this pass by
       landing back on Henna — so the patient here has to be a real one. */
    await openChart(page, '/screens/patient-chart.html?mrn=326477#medications');

    const tabs = page.getByTestId('chart--med-tabs');
    await expect(page.getByTestId('chart--med-list-table')).toBeVisible();
    await expect(page.getByTestId('chart--med-given')).toHaveCount(0);
    await expect(tabs.getByRole('tab', { name: 'During Procedure' })).toHaveCount(0);
    await expect(tabs.getByRole('tab', { name: 'Active' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Past' })).toBeVisible();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_MEDS);
    await expectNoA11yViolations(page);

    await openGivenTab(page);
    await expectNoA11yViolations(page);
  });
});
