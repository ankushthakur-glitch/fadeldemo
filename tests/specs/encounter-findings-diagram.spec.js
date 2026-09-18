/**
 * Findings, recorded on the bowel rather than typed into a box.
 *
 * The Procedure report's Findings section used to be a textarea asking for
 * "one finding per line, as it should read in the report". A sentence came out
 * of it; a RECORD did not. No two endoscopists described a 6 mm sessile polyp
 * the same way, nothing downstream could count polyps or find the segment they
 * were in, and the site was a word somebody had to remember to include.
 *
 * It is a diagram now: press the segment, fill in a form shaped for the KIND of
 * thing found there, and the report's sentences are generated from the
 * structure. This file asserts the three things that bargain depends on.
 *
 * THE PLACE IS PRESSED, NOT NAMED. Eight hotspots over the illustration, each
 * opening a drawer headed with the segment it belongs to — so a finding cannot
 * be filed without a site, which is the failure the textarea invited.
 *
 * THE FORM FOLLOWS THE TYPE. Eleven types, and the fields under the picker are
 * replaced when the type changes rather than added to. A stricture is asked
 * about its etiology and a polyp is not; carrying half-filled answers across
 * that switch would put "Large" from an ulcer's Size onto a hemorrhoid.
 *
 * THE PROSE IS READ OFF THE STRUCTURE. `values.findings` still holds the
 * string it always held — it is what the required check reads and what the
 * report prints — but nothing types it any more. The last two tests are the
 * ones that matter: recording a finding must satisfy the field, and leaving
 * the substep and coming back must not lose it.
 */
import { test, expect } from '@playwright/test';

/* A real procedure booking, the same one the sibling spec uses. */
const PROCEDURE = '/screens/encounter.html?appt=ap29';

async function openReport(page) {
  await page.goto(PROCEDURE);
  await page.getByTestId('encv--step-procedure').click();
  await page.getByTestId('encv--substep-procedure-report').click();
  await expect(page.locator('[data-diagram-host="findings"]')).toBeVisible();
}

/* A recorded finding puts an Edit button in the list carrying the same
   `data-open-segment` the hotspot does — both open the same drawer, which is
   the point — so the routes below say which of the two they mean. */
const hotspot = (page, segment) => page.locator(`.segf__hotspot[data-open-segment="${segment}"]`);

/** Record one finding in one segment, choosing `type` and nothing else. */
async function recordFinding(page, segment, type) {
  await hotspot(page, segment).click();
  await page.locator('#segfType select').selectOption(type);
  await page.locator('#segfAdd button').click();
  await page.locator('#findingsDrawer .ui-modal__close').click();
}

test.describe('the diagram', () => {
  test('offers every segment of the bowel as its own target', async ({ page }) => {
    await openReport(page);
    await expect(page.locator('.segf__hotspot')).toHaveCount(8);
    /* Named for assistive tech, because the names are painted into the
       illustration and a screen reader cannot see them there. */
    await expect(hotspot(page, 'cecum')).toHaveAccessibleName('Cecum');
  });

  test('opens a drawer headed with the segment that was pressed', async ({ page }) => {
    await openReport(page);
    await hotspot(page, 'ascending').click();
    await expect(page.locator('#findingsDrawer .ui-modal__title')).toHaveText(
      'Ascending colon — Findings'
    );
    /* An empty segment opens straight onto the add form: no placeholder line,
       and no rule above it either. */
    await expect(page.locator('#findingsDrawer .segf__drawer-list')).toHaveCount(0);
    await expect(page.locator('#findingsDrawer .segf__rule')).toHaveCount(0);
  });

  test('will not file a finding until a type has been chosen', async ({ page }) => {
    await openReport(page);
    await hotspot(page, 'ascending').click();
    await expect(page.locator('#segfAdd')).toHaveAttribute('disabled', '');

    await page.locator('#segfType select').selectOption('polyp');
    await expect(page.locator('#segfAdd')).not.toHaveAttribute('disabled', '');
  });

  test('marks a segment that carries findings, and counts them', async ({ page }) => {
    await openReport(page);
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(0);

    await recordFinding(page, 'sigmoid', 'diverticulum');
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(1);
    await expect(hotspot(page, 'sigmoid').locator('.segf__pin')).toHaveText('1');

    /* The drawer clears rather than closes after each one — three polyps in the
       sigmoid is a Tuesday — so a second finding in the same segment is one
       press, not two. */
    await recordFinding(page, 'sigmoid', 'polyp');
    await expect(hotspot(page, 'sigmoid').locator('.segf__pin')).toHaveText('2');
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(1);
  });
});

test.describe('the form follows the type', () => {
  test('asks a stricture what a polyp is never asked', async ({ page }) => {
    await openReport(page);
    await hotspot(page, 'descending').click();

    await page.locator('#segfType select').selectOption('polyp');
    await expect(page.locator('#segf-paris')).toBeVisible();
    await expect(page.locator('#segf-etiology')).toHaveCount(0);

    await page.locator('#segfType select').selectOption('stricture');
    await expect(page.locator('#segf-etiology')).toBeVisible();
    await expect(page.locator('#segf-paris')).toHaveCount(0);
  });

  test('totals the tattoo volume rather than asking for it', async ({ page }) => {
    await openReport(page);
    await hotspot(page, 'ascending').click();
    await page.locator('#segfType select').selectOption('polyp');

    await page.locator('#segf-tattooInjections input').fill('3');
    await page.locator('#segf-tattooVolEach input').fill('0.5');
    await expect(page.locator('#segf-tattooVolTotal input')).toHaveValue('1.5');
  });

  test('summarises a recorded finding by what identifies it', async ({ page }) => {
    await openReport(page);
    await hotspot(page, 'ascending').click();
    await page.locator('#segfType select').selectOption('polyp');
    await page.locator('#segf-count input').fill('3');
    await page.locator('#segf-size-from input').fill('6');
    await page.locator('#segf-size-to input').fill('8');
    await page.locator('#segf-morphology select').selectOption({ label: 'Sessile' });
    await page.locator('#segfAdd button').click();
    await page.locator('#findingsDrawer .ui-modal__close').click();

    /* Scoped to the recorded list: the drawer keeps its last-painted body in
       the DOM behind `hidden`, and its saved rows carry the same class.

       A bare number would say nothing on this line — "3" could be polyps,
       millimetres or millilitres — so the summary carries the unit with it. */
    await expect(page.locator('.segf__item .segf__item-summary')).toHaveText(
      '3 polyps · 6–8 mm · Sessile'
    );
    await expect(page.locator('.segf__item .segf__item-tag')).toHaveText('Ascending colon');
  });
});

test.describe('the report reads off the record', () => {
  test('a recorded finding answers the required Findings field', async ({ page }) => {
    await openReport(page);
    const foot = page.locator('#docHint');
    await expect(foot).toContainText('Findings');

    await recordFinding(page, 'transverse', 'polyp');
    await expect(foot).not.toContainText('Findings');
  });

  test('and survives leaving the document and coming back', async ({ page }) => {
    await openReport(page);
    await recordFinding(page, 'rectum', 'hemorrhoid');
    await expect(page.locator('.segf__item')).toHaveCount(1);

    await page.getByTestId('encv--substep-orders').click();
    await page.getByTestId('encv--substep-procedure-report').click();

    await expect(page.locator('.segf__item')).toHaveCount(1);
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(1);
  });

  test('and is removed from the list and the diagram together', async ({ page }) => {
    await openReport(page);
    await recordFinding(page, 'cecum', 'ulceration');
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(1);

    await page.locator('[data-drop-finding]').first().click();
    await expect(page.locator('.segf__item')).toHaveCount(0);
    await expect(page.locator('.segf__hotspot--on')).toHaveCount(0);
  });
});

test('a half-typed finding survives deleting a saved one beside it', async ({ page }) => {
  await openReport(page);
  await recordFinding(page, 'transverse', 'diverticulum');

  /* Open the same segment again and start a second finding without filing it.
     Deleting the row above has nothing to do with what is being typed below
     it, and losing the one to the other is the kind of thing that stops a
     drawer being trusted with a long form. */
  await hotspot(page, 'transverse').click();
  await page.locator('#segfType select').selectOption('polyp');
  await page.locator('#segf-count input').fill('4');

  await page.locator('#findingsDrawer [data-drop-finding]').first().click();

  await expect(page.locator('.segf__saved')).toHaveCount(0);
  await expect(page.locator('#segf-count input')).toHaveValue('4');
});
