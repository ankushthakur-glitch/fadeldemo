/**
 * Completing the procedure record: the instrument, the clock and the note.
 *
 * Three gaps that all had the same shape — a fact the room knows, that the
 * report could not state.
 *
 * THE INSTRUMENT. The booking said "Olympus colonoscope" and the feed header
 * said "CF-HQ190L". Both are types. The question an endoscopy unit is actually
 * asked is always about one object — which scope was in this patient, and was
 * it reprocessed first — and that is answered with a serial number or it is
 * not answered. See data/procedure-scopes.js.
 *
 * THE CLOCK. "Scope in 08:06, scope out 08:26" has the withdrawal time in it
 * and does not state it. Twenty minutes in the room could be a four-minute
 * withdrawal after a hard insertion or a fourteen-minute one; those are
 * different pieces of work and one of them misses the six-minute standard that
 * every unit audits. See data/procedure-timings.js.
 *
 * THE NOTE. The structure is right for collecting and wrong for reading, and
 * the report's answer to that was a textarea somebody retyped the same case
 * into. The note is generated from the structure instead — two accounts of one
 * case being the thing it exists to prevent. See js/lib/procedure-narrative.js.
 */
import { test, expect } from '@playwright/test';

const PROCEDURE = '/screens/encounter.html?appt=ap29';

async function openReport(page) {
  await page.goto(PROCEDURE);
  await page.getByTestId('encv--step-procedure').click();
  await page.getByTestId('encv--substep-procedure-report').click();
  await expect(page.locator('[data-diagram-host="findings"]')).toBeVisible();
}

/** The scope that came off this morning's cycle. */
const FRESH = 'CF-HQ190L · RR-SCOPE-04';
/** The one reprocessed the previous evening, outside the hang-time window. */
const STALE = 'PCF-H190DL · RR-SCOPE-07';

const chooseScope = (page, label) =>
  page.locator('#docf-scopeId select').selectOption({ label });

const block = (page, title) =>
  page
    .locator('[data-testid="encv--narrative"] .narrative__block')
    .filter({ has: page.locator('.narrative__title', { hasText: title }) })
    .locator('.narrative__text');

/* ============================================================================
   THE INSTRUMENT
   ========================================================================= */

test.describe('which scope, not which kind of scope', () => {
  test('says nothing rather than reporting the booking’s model', async ({ page }) => {
    await openReport(page);
    /* The booking names a type. A card that showed it would look like an
       answer to a question nobody has asked yet. */
    await expect(page.getByTestId('encv--scope-none')).toBeVisible();
  });

  test('reads serial, asset tag and reprocessing cycle off the register', async ({ page }) => {
    await openReport(page);
    await chooseScope(page, FRESH);

    const facts = page.getByTestId('encv--scope-facts');
    /* Not typed. A serial retyped off a sticker is a digit wrong in the one
       record that is only ever read when a digit being wrong matters. */
    await expect(facts).toContainText('2417732');
    await expect(facts).toContainText('RR-SCOPE-04');
    await expect(facts).toContainText('C-20418');
  });

  test('flags a scope outside its hang-time window without refusing it', async ({ page }) => {
    await openReport(page);
    await chooseScope(page, STALE);

    await expect(page.getByTestId('encv--scope-stale')).toBeVisible();
    /* Recorded anyway. The scope is in the patient by the time anybody reads
       this card, and a screen that declined to record the truth would leave
       the unit with no record of the thing it most needs to investigate. */
    await expect(page.getByTestId('encv--scope-facts')).toContainText('2298104');
  });

  test('does not flag the scope that came off this morning’s cycle', async ({ page }) => {
    await openReport(page);
    await chooseScope(page, FRESH);
    /* Measured to the case's own scope-in time rather than to the wall clock,
       so the same case does not become non-compliant by being reopened in the
       evening. */
    await expect(page.getByTestId('encv--scope-stale')).toHaveCount(0);
  });
});

/* ============================================================================
   THE CLOCK
   ========================================================================= */

test.describe('withdrawal time, alongside insertion and caecum', () => {
  test('derives all three intervals from the times log', async ({ page }) => {
    await openReport(page);

    const marks = page.getByTestId('encv--timings');
    await expect(marks).toContainText('08:06');
    await expect(marks).toContainText('08:14');
    await expect(marks).toContainText('08:26');

    /* 08:06 → 08:14 → 08:26. The report does the subtraction nobody does by
       hand, and does it from the times the nurse recorded live on step 2 —
       not from a second set typed here from memory. */
    const derived = page.getByTestId('encv--timings-derived');
    await expect(derived).toContainText('8 min');
    await expect(derived).toContainText('12 min');
    await expect(derived).toContainText('20 min');
  });

  test('draws the withdrawal as the number the card exists for', async ({ page }) => {
    await openReport(page);
    await expect(page.locator('.timing--lead .timing__value')).toHaveText('12 min');
  });

  test('states the withdrawal in the note, with the standard it is read against', async ({ page }) => {
    await openReport(page);
    await expect(block(page, 'Timings')).toContainText('Withdrawal time was 12 min');
  });
});

/* ============================================================================
   THE NOTE
   ========================================================================= */

test.describe('the narrative is written from the structure', () => {
  test('names the instrument by serial in its first paragraph', async ({ page }) => {
    await openReport(page);
    await chooseScope(page, FRESH);

    await expect(block(page, 'Procedure')).toContainText('serial 2417732');
    /* And the cycle, which is what joins this report to the washer's own log —
       the one junction where the two can be joined at all. */
    await expect(block(page, 'Procedure')).toContainText('C-20418');
  });

  test('says the instrument is unrecorded rather than writing round it', async ({ page }) => {
    await openReport(page);
    await expect(block(page, 'Procedure')).toContainText(
      'The instrument used has not been recorded'
    );
  });

  test('rewrites itself when a finding is recorded', async ({ page }) => {
    await openReport(page);
    await expect(block(page, 'Findings')).toContainText('No findings have been recorded');

    await page.locator('.segf__hotspot[data-open-segment="ascending"]').click();
    await page.locator('#segfType select').selectOption('polyp');
    await page.locator('#segfAdd button').click();
    await page.locator('#findingsDrawer .ui-modal__close').click();

    await expect(block(page, 'Findings')).toContainText('Polyp');
    await expect(block(page, 'Findings')).toContainText('ascending colon');
  });

  test('offers no way to edit it, and one way to take it away', async ({ page }) => {
    await openReport(page);

    /* Read-only, and the argument is the diagram's: record the anatomy and the
       prose writes itself. An editable copy of a generated note is two
       accounts of one case with nothing to say which is right. */
    await expect(page.locator('[data-testid="encv--narrative"] textarea')).toHaveCount(0);
    await expect(page.locator('[data-testid="encv--narrative"] input')).toHaveCount(0);
    await expect(page.getByTestId('encv--narrative-copy')).toBeVisible();
  });

  test('sits under everything it reads and above the impression', async ({ page }) => {
    await openReport(page);

    const order = await page
      .locator('#docBody [data-section]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.section));

    expect(order.indexOf('narrative')).toBeGreaterThan(order.indexOf('photos'));
    expect(order.indexOf('narrative')).toBeLessThan(order.indexOf('impression'));
    /* The instrument and the clock are true of the whole examination, so they
       are above the findings rather than among them. */
    expect(order.indexOf('scope')).toBeLessThan(order.indexOf('findings'));
    expect(order.indexOf('timings')).toBeLessThan(order.indexOf('findings'));
  });
});
