/**
 * The visit note's Plan — what it commits to, and when.
 *
 * The Plan of a clinic visit is the section somebody acts on afterwards, and
 * for a long time acting on it meant reading the paragraph and going somewhere
 * else to do the thing: the chart's Orders tab for a lab, the Recalls worklist
 * for the follow-up. Both are a different screen, so both happened later or
 * not at all — and TK-4394 in data/tasks.js is the demo data admitting it, a
 * task chasing a surveillance interval because "the check-out sheet guessed
 * five years and nobody has confirmed it".
 *
 * The Plan now raises them itself. Four things about that are worth a file,
 * because each is a decision a later change could plausibly undo:
 *
 *   NOTHING IS FILED UNTIL THE NOTE IS SIGNED. A draft is a clinician
 *   thinking. If raising an order ever starts happening on the button press,
 *   the ASC hears about decisions nobody made — so this asserts the staged
 *   state produces no records, and then that the signature does.
 *
 *   THE INTERVAL IS READ OFF THE NOTE, NOT RE-ASKED. The whole point is that
 *   the desk stops guessing, so the recall's interval has to follow the Plan's
 *   own follow-up field — including across the two vocabularies, where the
 *   note's "12 months" is the practice's "1 year".
 *
 *   "NO ROUTINE FOLLOW-UP" IS AN ANSWER. It has to retract the proposed
 *   recall rather than leave one behind, or the note says one thing and the
 *   worklist another.
 *
 *   SIGNING TWICE MUST NOT FILE TWICE. A note unlocked to fix a typo and
 *   re-signed would otherwise book a second colonoscopy.
 *
 * THIS WAS A V2-ONLY SPEC. While the note was being rebuilt at a second
 * address it ran against that address with `?v=2` pinned to every URL, so the
 * remembered-version redirect could not carry the run back to the version
 * being replaced. The rebuild won and took screens/clinic-visit.html, the
 * switch went with it, and the URL below is simply the visit note.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, openChart } from '../helpers/page-helpers.js';

/*
 * A clinic booking, not a procedure one: a procedure never renders the visit
 * note at all (see the isProcedure gate at the head of the screen module).
 *
 * ap8 specifically, because its patient — MRN 326486 — is the one the chart
 * has a record for in data/patient-chart.js. A booking whose MRN the chart
 * does not know falls back to the default patient on arrival, so an order
 * filed against the booking would be looked for under somebody else, and the
 * last test here would fail for a reason that has nothing to do with orders.
 */
const APPT = 'ap8';
const MRN = '326486';
const NOTE = `/screens/clinic-visit.html?appt=${APPT}`;

/** Every store in this prototype is sessionStorage-backed, so a spec that
 *  inherits another spec's session is a spec testing somebody else's state. */
async function openNote(page) {
  await page.goto(NOTE);
  await page.evaluate(() => {
    try { sessionStorage.clear(); } catch { /* blocked storage is still a valid run */ }
  });
  await page.goto(NOTE);
  await expect(page.getByTestId('enc--plan-commit')).toBeVisible();
}

/** The note's own fields are <ui-select>; the inner control is what Playwright
 *  drives, and the component emits ui-change off it. */
async function choose(page, testid, value) {
  await page.getByTestId(testid).locator('select').selectOption(value);
}

/** Raise one order through the dialog, the way the screen asks for it. */
async function raise(page, kind, fieldTestId, value) {
  await page.getByTestId(`enc--plan-raise-${kind}`).click();
  await expect(page.getByTestId(fieldTestId)).toBeVisible();
  await page.getByTestId(fieldTestId).locator('select').selectOption(value);
  await page.getByTestId('enc--plan-order-save').click();
}

/** What has actually been written, read out of the stores themselves rather
 *  than off a screen — the stores are the thing under test. */
function filedFor(page) {
  return page.evaluate(async (m) => {
    const orders = await import('/data/order-store.js');
    const recalls = await import('/data/recall-store.js');
    const record = orders.ordersFor(m);
    return {
      scopes: record.procedures.filter((p) => p.raisedFrom),
      labs: record.labs.filter((l) => String(l.id).includes('note')),
      recalls: recalls.loadRecalls().filter((r) => r.source === 'note-plan'),
    };
  }, MRN);
}

test.describe('The Plan raises its own orders and recall', () => {
  test.beforeEach(({ page }) => failOnConsoleErrors(page));

  test('the follow-up interval on the note proposes the recall', async ({ page }) => {
    await openNote(page);

    await choose(page, 'enc--vn-followUp', '6 months');
    await expect(page.getByTestId('enc--plan-recall-for').locator('select')).toHaveValue(
      'Clinic follow-up — general'
    );
    await expect(page.getByTestId('enc--plan-recall-interval').locator('select')).toHaveValue(
      '6 months'
    );
    await expect(page.getByTestId('enc--plan-recall-summary')).toContainText(
      'written to Recalls when this note is signed'
    );
  });

  test('the note\'s vocabulary is translated into the practice\'s', async ({ page }) => {
    await openNote(page);
    /* The note offers "12 months"; RECALL_INTERVALS in data/tasks.js calls the
       same span "1 year". A recall that recorded the note's wording would not
       match the Recalls screen's own filters. */
    await choose(page, 'enc--vn-followUp', '12 months');
    await expect(page.getByTestId('enc--plan-recall-interval').locator('select')).toHaveValue(
      '1 year'
    );
  });

  test('"no routine follow-up" retracts the recall rather than leaving one', async ({ page }) => {
    await openNote(page);
    await choose(page, 'enc--vn-followUp', '6 months');
    await expect(page.getByTestId('enc--plan-recall-summary')).toContainText('Due');

    await choose(page, 'enc--vn-followUp', 'No routine follow-up — as needed');
    await expect(page.getByTestId('enc--plan-recall-summary')).toContainText(
      'no routine follow-up, so no recall will be written'
    );
  });

  test('a scope is raised without leaving the note, and can be taken back off', async ({ page }) => {
    await openNote(page);

    await page.getByTestId('enc--plan-raise-colonoscopy').click();
    /* The button chooses the decision; the picker inside offers only the
       indication-bearing forms of it. An EGD in this list would mean the two
       buttons had stopped meaning anything. */
    const offered = await page
      .getByTestId('enc--plan-ord-procedure')
      .locator('select option')
      .allTextContents();
    expect(offered.filter(Boolean).every((o) => /Colonoscopy|sigmoidoscopy|Select/i.test(o))).toBe(true);

    await page.getByTestId('enc--plan-ord-procedure').locator('select')
      .selectOption('Colonoscopy — surveillance');
    await page.getByTestId('enc--plan-order-save').click();

    await expect(page.getByTestId('enc--plan-order-0')).toContainText('Colonoscopy — surveillance');

    await page.getByTestId('enc--plan-order-drop-0').click();
    await expect(page.getByTestId('enc--plan-commit')).toContainText(
      'No orders raised from this plan.'
    );
  });

  test('staging files nothing; signing files everything, once', async ({ page }) => {
    await openNote(page);

    await choose(page, 'enc--vn-followUp', '6 months');
    await raise(page, 'colonoscopy', 'enc--plan-ord-procedure', 'Colonoscopy — surveillance');
    await raise(page, 'lab', 'enc--plan-ord-test', 'Liver Function Panel');

    /* The staged state is the whole argument for staging: two orders and a
       recall on screen, nothing anywhere else. */
    const before = await filedFor(page);
    expect(before.scopes).toHaveLength(0);
    expect(before.labs).toHaveLength(0);
    expect(before.recalls).toHaveLength(0);

    await page.getByTestId('enc--save-and-sign').click();
    await page.getByTestId('enc--sign-confirm').click();
    /* Signing files the note and returns to the schedule — the encounter is
       over, and what comes next is the next patient. The stores are read after
       the landing so the assertions below cannot race the filing. */
    await page.waitForURL(/scheduler\.html/);

    const after = await filedFor(page);
    expect(after.scopes).toHaveLength(1);
    expect(after.scopes[0].procedure).toBe('Colonoscopy — surveillance');
    expect(after.scopes[0].status).toBe('ordered');
    /* The one field a chart-raised order leaves blank, and what lets the
       worklist say a signed note is standing behind the row. */
    expect(after.scopes[0].raisedFrom).toMatch(/·\s\d{2}-\d{2}-\d{4}/);

    expect(after.labs).toHaveLength(1);
    expect(after.labs[0].name).toBe('Liver Function Panel');

    expect(after.recalls).toHaveLength(1);
    expect(after.recalls[0].interval).toBe('6 months');
    expect(after.recalls[0].location).toBe('Clinic');
    expect(after.recalls[0].source).toBe('note-plan');

    /* Re-opening the signed note must offer nothing to raise, and re-signing
       must not double-file. `planFiled` rides on the booking for exactly this
       — see state.plan.filed in the screen module. A signed clinic note can no
       longer be unlocked, and signing leaves the screen altogether, but the
       guard stays: the booking outlives the page, and a note reopened from
       the worklist must not re-file what the signature already filed. */
    await page.goto(NOTE);
    await expect(page.getByTestId('enc--plan-commit')).toContainText('with this signature');
    expect(await page.getByTestId('enc--plan-raise-lab').count()).toBe(0);

    const again = await filedFor(page);
    expect(again.scopes).toHaveLength(1);
    expect(again.recalls).toHaveLength(1);
  });

  test('a scope raised from the note reaches the chart\'s Procedures tab', async ({ page }) => {
    await openNote(page);

    await raise(page, 'egd', 'enc--plan-ord-procedure', 'EGD — diagnostic');
    await page.getByTestId('enc--save-and-sign').click();
    await page.getByTestId('enc--sign-confirm').click();
    await page.waitForURL(/scheduler\.html/);

    /* The chart opens on its alerts digest, whose scrim swallows the first
       click on anything behind it — openChart closes it the way a user would. */
    await openChart(page, `/screens/patient-chart.html?mrn=${MRN}`);
    await page.getByTestId('chart--nav-orders').click();

    /* Procedures is a section of its own rather than a row filed under
       Imaging — the argument is over PROCEDURE_TYPES in data/chart-orders.js. */
    const tab = page.locator('[role="tab"][data-value="procedures"]');
    await expect(tab).toBeVisible();
    await tab.click();

    await expect(page.getByTestId('chart--procedures-table')).toContainText('EGD — diagnostic');
  });
});
