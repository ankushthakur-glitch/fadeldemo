/**
 * Intra-procedure ▸ Medication administered — the form, what it stopped asking
 * for, and the two things it started asking for again.
 *
 * The running sheet a nurse charts a push onto has been narrowed several times,
 * and every removal was the same shape: a box that could only ever collect what
 * something else already knew. The category and the strength came off because
 * they belong to the drug, the lot because it belongs to the box the drug came
 * out of.
 *
 * The time is the last of those and the most easily defended in the wrong
 * direction, so it gets a file. It was required and defaulted to the clock,
 * which meant the only answers it could collect were the right one — left
 * alone — or a wrong one, typed over it from memory minutes later. The push is
 * charted AT the push. So the row is still stamped and the column still leads
 * the table; what is gone is being asked. Both halves of that are asserted
 * here, because either one alone is a different and worse change.
 *
 * WHAT CAME BACK, AND WHY IT IS NOT A REVERSAL.
 * The waste and its witness came off this form once, on the argument that the
 * ledger does the subtraction itself and a hand-typed second opinion only gives
 * two figures a way to disagree. They are back, and the argument that removed
 * them is the reason the shape is different: what is asked now is the amount,
 * the reason and a NAMED witness off the practice roster — an observation
 * somebody is accountable for — rather than a number retyped beside one the
 * ledger already had. Behind a tick, because most pushes waste nothing.
 *
 * The two facts this file exists to protect:
 *
 *   - a hidden required field must not block the save. Ticking nothing and
 *     filing a plain dose has to stay a two-answer form, or the wastage
 *     question has made every push slower to chart.
 *   - one ampoule must leave the shelf ONCE. The obvious build of "capture
 *     given and wasted together" posts an administration and a wastage, and
 *     each of those draws stock; the count would then sit below the room by a
 *     unit for every discard anybody bothered to record.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

const ENCOUNTER = '/screens/encounter.html?appt=ap29';

/** Everything on this screen is reached from the rail, so that is the route. */
async function openMar(page) {
  await page.goto(ENCOUNTER);
  await page.getByTestId('encv--step-intra').click();
  await page.getByTestId('encv--substep-meds-given').click();
  await expect(page.getByTestId('encv--log-table')).toBeVisible();
}

const rows = (page) => page.getByTestId('encv--log-table').locator('tbody tr');

test.describe('administering a medication', () => {
  test('the form asks what changes push to push, and the clock is not one of them', async ({
    page,
  }) => {
    await openMar(page);
    await page.getByTestId('encv--log-add').click();

    await expect(page.getByTestId('encv--f-name')).toBeVisible();
    await expect(page.getByTestId('encv--f-dose')).toBeVisible();
    await expect(page.getByTestId('encv--f-route')).toBeVisible();

    /* The one that is gone. A nurse with a syringe in one hand was being asked
       to confirm what the clock already said. */
    await expect(page.getByTestId('encv--f-time')).toHaveCount(0);

    /* And the attestation, which is the same press it is everywhere else on
       the run — but named, because this form carries two of them. */
    await expect(page.getByTestId('encv--f-initials')).toHaveCount(0);
    await expect(page.getByTestId('encv--f-givenBy')).toBeVisible();
  });

  test('but the row is still stamped, and the table still leads with it', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await openMar(page);

    /* A MAR read down the time column is how anybody answers "how long since
       the last dose", which is why removing the FIELD had to leave the column
       exactly where it was. */
    await expect(page.getByTestId('encv--log-table').locator('thead th').first()).toHaveText(
      'Time'
    );

    const before = await rows(page).count();
    await page.getByTestId('encv--log-add').click();
    await page.getByTestId('encv--f-name').locator('input').fill('Midazolam');
    /* The drug's usual dose and route fill themselves in from the formulary —
       see `prefill` — so the name and the press are all this push needs. The
       wastage half is asked of nobody until it is ticked, which is the whole
       point of the tick: three required fields sitting unanswered under it
       would refuse this save. */
    await page.getByTestId('encv--f-givenBy').click();
    await page.getByTestId('encv--log-save').click();

    await expect(rows(page)).toHaveCount(before + 1);
    /* Stamped by the screen, in the format every other log on the run stamps
       its rows in. */
    await expect(rows(page).last().locator('td').first()).toHaveText(/^\d{2}:\d{2}$/);
    /* And under the initials the press confirmed. */
    await expect(rows(page).last().locator('td').nth(5)).toHaveText('MO');
    clean();
  });

  test('the wastage half is asked only when it is ticked, and then it is required', async ({
    page,
  }) => {
    const clean = failOnConsoleErrors(page);
    await openMar(page);
    await page.getByTestId('encv--log-add').click();
    await page.getByTestId('encv--f-name').locator('input').fill('Propofol');

    const amount = page.getByTestId('encv--f-wasteAmount');
    const witness = page.getByTestId('encv--f-wasteWitness');
    await expect(amount).toBeHidden();
    await expect(witness).toBeHidden();

    /* The label, not the host: <ui-checkbox> stretches to its column and the
       hit area is the inline-flex label inside it. */
    await page.getByTestId('encv--f-wasted').locator('label').click();
    await expect(amount).toBeVisible();
    await expect(witness).toBeVisible();

    /* A wastage of an unstated amount, watched by nobody, is a line an auditor
       can do nothing with — so both are required the moment the question is
       being asked at all. */
    await page.getByTestId('encv--log-save').click();
    await expect(page.getByTestId('encv--log-drawer')).toBeVisible();
    await expect(page.locator('#logError')).toHaveText(
      'Still needed: Given by, Amount wasted, Wastage witnessed by.'
    );
    clean();
  });

  test('given and wasted land on one line, under two different names', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await openMar(page);

    const before = await rows(page).count();
    await page.getByTestId('encv--log-add').click();
    await page.getByTestId('encv--f-name').locator('input').fill('Propofol');
    await page.getByTestId('encv--f-givenBy').click();
    await page.getByTestId('encv--f-wasted').locator('label').click();
    await page.getByTestId('encv--f-wasteAmount').locator('input').fill('40 mg');
    await page.getByTestId('encv--f-wasteWitness').click();
    await page.getByTestId('encv--log-save').click();

    await expect(rows(page)).toHaveCount(before + 1);
    const row = rows(page).last();
    /* The two figures a controlled drug is reconciled on, side by side, which
       is the whole of that check — and split across two documents it is a join
       somebody has to do by hand. */
    await expect(row.locator('td').nth(2)).toHaveText('20 mg');
    await expect(row.locator('td').nth(4)).toHaveText('40 mg · Part-dose discarded');
    /* Two attestations in two columns. One button covering both would file a
       wastage witnessed by the person who wasted it. */
    await expect(row.locator('td').nth(5)).toHaveText('MO');
    await expect(row.locator('td').nth(6)).toHaveText('MO');
    clean();
  });

  test('the ampoule leaves the shelf once, carrying the witness with it', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await openMar(page);

    await page.getByTestId('encv--log-add').click();
    await page.getByTestId('encv--f-name').locator('input').fill('Propofol');
    await page.getByTestId('encv--f-givenBy').click();
    await page.getByTestId('encv--f-wasted').locator('label').click();
    await page.getByTestId('encv--f-wasteAmount').locator('input').fill('40 mg');
    await page
      .getByTestId('encv--f-wasteReason')
      .locator('select')
      .selectOption('Broken vial or container');
    await page.getByTestId('encv--f-wasteWitness').click();
    await page.getByTestId('encv--log-save').click();
    await expect(page.getByTestId('encv--log-drawer')).toBeHidden();

    const movements = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('medinova.medication-ledger') || '[]')
    );

    /* ONE movement, not two. An administration and a wastage each draw units
       off the first-expiring lot; posting both for one part dose would take the
       same ampoule off the shelf twice. */
    expect(movements).toHaveLength(1);
    expect(movements[0].kind).toBe('given');
    expect(movements[0].units).toBe(1);
    /* The typed figure overrides the ledger's own subtraction rather than
       adding to it, and it goes onto the register with the reason and the
       person who watched — which is the half a computed discard can never
       have. */
    expect(movements[0].wasted).toBe(40);
    expect(movements[0].reason).toBe('Broken vial or container');
    expect(movements[0].witness).toBe('MO');
    expect(movements[0].administeredBy).toBe('MO');
    clean();
  });
});
