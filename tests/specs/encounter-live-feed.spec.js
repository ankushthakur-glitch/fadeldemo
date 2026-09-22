/**
 * The live feed on the Procedure report, and what a capture is for.
 *
 * The endoscopist works two screens: the processor's monitor, where the case
 * actually happens, and the EHR, where it is written down. Until now those two
 * were in different parts of the room, and the pictures that prove a case —
 * the caecum, the polyp before it was taken — reached the report as a folder
 * of files somebody uploaded afterwards, named whatever the stack named them.
 *
 * The feed puts the monitor on the screen as a window the endoscopist drags
 * wherever they want it, and gives it a pedal. What this file asserts is the
 * five claims that arrangement is worth anything for:
 *
 *   THE PRESS OPENS IT. Always, and immediately. The panel is a mirror of a
 *   monitor that is already on — switched on while the stack is set up, which
 *   happens before anybody is anaesthetised — so where the run has got to is
 *   REPORTED on its face rather than used to refuse. It was a lock once, and
 *   the lock protected nothing: the feed writes to the record only through a
 *   capture, onto a report whose own signature gates everything that matters.
 *
 *   IT IS A WINDOW, AND IT GOES WHERE IT IS PUT. Floating over the report,
 *   dragged by its header, resized from its corner, and remembered at both
 *   across repaints and across a trip to another step. It was a card in the
 *   document once; a card can be scrolled away from and only exists on the
 *   step that declares it.
 *
 *   A CAPTURE LANDS ON THE REPORT, ATTACHED. It goes to the same photo card an
 *   upload goes to, carrying the two facts an upload cannot: the time, and the
 *   finding it is about. With no finding selected it is a landmark, and says so.
 *
 *   THE PEDAL IS A PEDAL. Both hands are on the scope. Space freezes and Enter
 *   captures from anywhere on the page — and from nowhere at all while a dialog
 *   is up or anything is being typed into, which is what keeps a global key
 *   handler acceptable.
 *
 *   THE FEED IS NOT THE RECORD. Closing it changes nothing about the document:
 *   the captures stay, and nothing the report is waiting for was ever the
 *   panel's to answer.
 */
import { test, expect } from '@playwright/test';

/* The same procedure booking every encounter spec uses. */
const PROCEDURE = '/screens/encounter.html?appt=ap29';

/** The report, opened cold, with no feed running. */
async function openReport(page) {
  await page.goto(PROCEDURE);
  await page.getByTestId('encv--step-procedure').click();
  await page.getByTestId('encv--substep-procedure-report').click();
  await expect(page.locator('[data-diagram-host="findings"]')).toBeVisible();
}

/**
 * Sign step 3, which is what the feed is waiting for.
 *
 * Both documents, because the gate asks for both: the anaesthesia consent is
 * two pads — the patient's and the provider's — and the pre-op assessment is
 * one more.
 *
 * The two clinician pads are typed only, so they open on the one method they
 * have and Sign is one press. The PATIENT's offers all three and opens on
 * draw, which is right for a patient at a desk and wrong for a test: an empty
 * canvas files nothing. So this picks the typed method first, which is the
 * route the pad already supports rather than a back door — see
 * js/components/ui-signature.js.
 */
async function signPreAnaesthesia(page) {
  const sign = async (testId) =>
    page.getByTestId(testId).locator('button', { hasText: /^Sign$/ }).click();

  await page.getByTestId('encv--step-pre-anaesthesia').click();
  await page.getByTestId('encv--substep-anaes-consent').click();
  await page
    .getByTestId('encv--sig-patient-patient-sign')
    .locator('input[type="radio"][value="type"]')
    .check();
  await sign('encv--sig-patient-patient-sign');
  await sign('encv--sig-provider-provider-sign');

  await page.getByTestId('encv--substep-anaes-preop').click();
  await sign('encv--sig-provider-sign');
}

/** The floating panel itself. On <body>, not in the document. */
const feedWindow = (page) => page.locator('#feedWindow');

/**
 * Open the report with the feed running.
 *
 * Nothing is signed first, deliberately: one press is all the feature asks
 * for, and a helper that quietly signed three pads on the way would be a
 * helper hiding the thing most of these tests are about.
 */
async function startFeed(page) {
  await page.getByTestId('encv--step-procedure').click();
  await page.getByTestId('encv--substep-procedure-report').click();
  await page.getByTestId('encv--feed-start').locator('button').click();
  await expect(page.locator('.feed__scene')).toBeVisible();
}

/** One finding, so a capture has something to attach to. */
async function recordFinding(page, segment, type) {
  await page.locator(`.segf__hotspot[data-open-segment="${segment}"]`).click();
  await page.locator('#segfType select').selectOption(type);
  await page.locator('#segfAdd button').click();
  await page.locator('#findingsDrawer .ui-modal__close').click();
}

/* ============================================================================
   OPENING IT
   ========================================================================= */

test.describe('the press opens the feed', () => {
  test('opens on one press, with nothing signed', async ({ page }) => {
    await openReport(page);
    await page.getByTestId('encv--feed-start').locator('button').click();

    await expect(feedWindow(page)).toBeVisible();
    await expect(page.locator('.feed__scene')).toBeVisible();
    await expect(page.getByTestId('encv--feed-pill')).toContainText('Live');

    /* Over the report rather than in it. The document's own sections are
       untouched by the feed opening — there is no card for it, which is what
       lets it be dragged anywhere and stay put while the column scrolls. */
    await expect(page.locator('#docBody [data-section="feed"]')).toHaveCount(0);
    await expect(feedWindow(page)).toHaveCSS('position', 'fixed');
  });

  test('says once what the case is still waiting for', async ({ page }) => {
    await openReport(page);
    await page.getByTestId('encv--feed-start').locator('button').click();

    const toast = page.locator('ui-toast');
    await expect(toast).toContainText('Pre-anaesthesia assessment is not signed yet');
    await expect(toast).toContainText('Anesthesia consent');
    /* And what it is NOT saying: that anything is blocked. */
    await expect(toast).toContainText('open for set-up');
  });

  test('says nothing about it once the anaesthetist has signed', async ({ page }) => {
    await page.goto(PROCEDURE);
    await signPreAnaesthesia(page);
    await startFeed(page);

    await expect(page.locator('ui-toast')).not.toContainText('not signed yet');
  });

  test('carries no prose under the picture', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    /* The panel is the picture and its controls. It carried two lines of
       explanation under the frame — what a read-only mirror is, and what the
       run was waiting for — and both were permanent furniture under something
       somebody is watching, on a window now sized and placed to taste. */
    await expect(page.locator('#feedWindow p.feed__read-only')).toHaveCount(0);
    await expect(page.locator('#feedWindow [data-feed-waiting]')).toHaveCount(0);
  });
});

/* ============================================================================
   THE WINDOW
   ========================================================================= */

test.describe('the panel is a window', () => {
  test('opens inside the viewport', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const box = await feedWindow(page).boundingBox();
    const view = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  });

  test('is dragged by its header', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const before = await feedWindow(page).boundingBox();
    const grip = await page.locator('#feedWindow [data-feed-drag]').boundingBox();

    /* Grabbed somewhere along the header rather than at its corner, because
       that is how a window is grabbed — and because the offset between the
       grab point and the window's corner is the thing a drag gets wrong. */
    const from = { x: grip.x + 60, y: grip.y + grip.height / 2 };
    const by = { x: -300, y: -160 };

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 });
    await page.mouse.up();

    const after = await feedWindow(page).boundingBox();
    expect(Math.round(after.x)).toBe(Math.round(before.x + by.x));
    expect(Math.round(after.y)).toBe(Math.round(before.y + by.y));
  });

  test('is moved from the keyboard too', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const before = await feedWindow(page).boundingBox();
    await page.locator('#feedWindow [data-feed-drag]').focus();
    await page.keyboard.press('ArrowRight');

    const after = await feedWindow(page).boundingBox();
    expect(Math.round(after.x)).toBe(Math.round(before.x + 32));
  });

  test('is resized from its corner, keeping the picture\'s shape', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const before = await feedWindow(page).boundingBox();
    const corner = await page.getByTestId('encv--feed-resize').boundingBox();

    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x + 160, corner.y + 90, { steps: 6 });
    await page.mouse.up();

    const after = await feedWindow(page).boundingBox();
    expect(after.width).toBeGreaterThan(before.width);

    /* The corner drives the WIDTH and the picture supplies the height, so a
       resized monitor is still the shape a processor produces. A lumen dragged
       into an oval is a lumen nobody can judge a polyp's size off. */
    const scene = await page.locator('.feed__scene').boundingBox();
    expect(scene.width / scene.height).toBeCloseTo(640 / 400, 2);
  });

  test('will not be dragged smaller than its own controls', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const corner = await page.getByTestId('encv--feed-resize').boundingBox();
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x - 900, corner.y, { steps: 10 });
    await page.mouse.up();

    /* Below the floor the four controls wrap into a keypad over the lumen,
       which is the one thing the bottom of this panel may not do. */
    const tops = await page
      .locator('#feedWindow .feed__btn')
      .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test('is resized from the keyboard too', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    const before = await feedWindow(page).boundingBox();
    await page.getByTestId('encv--feed-resize').focus();
    await page.keyboard.press('ArrowRight');

    const after = await feedWindow(page).boundingBox();
    expect(Math.round(after.width)).toBe(Math.round(before.width + 32));
  });

  test('is still where it was put after the document repaints', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.locator('#feedWindow [data-feed-drag]').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    const moved = await feedWindow(page).boundingBox();

    /* Recording a finding repaints the findings card and the photo strip, and
       for a while it repainted the panel out from under the drag. Somewhere to
       put the picture is a decision made once. */
    await recordFinding(page, 'ascending', 'polyp');

    const after = await feedWindow(page).boundingBox();
    expect(Math.round(after.x)).toBe(Math.round(moved.x));
    expect(Math.round(after.y)).toBe(Math.round(moved.y));
  });
});

/* ============================================================================
   WHAT A PRESS DOES
   ========================================================================= */

test.describe('capturing', () => {
  test('files a still against the selected finding', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);
    await recordFinding(page, 'ascending', 'polyp');

    /* The aim follows the newest finding rather than waiting to be set: the
       endoscopist describes what they are looking at while they look at it. */
    await expect(page.getByTestId('encv--feed-aimed')).toHaveText('capturing here');

    await page.getByTestId('encv--feed-capture').click();

    const caption = page.locator('.encv__photo:not(.encv__photo--next) figcaption').first();
    await expect(caption).toContainText('Ascending colon');
    await expect(caption).toContainText('Polyp');
    /* And a clock, because a run of stills is read as a sequence. */
    await expect(caption.locator('.encv__photo-at')).toHaveText(/^\d{2}:\d{2}$/);
  });

  test('files a landmark when nothing is selected, and says so', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.getByTestId('encv--feed-capture').click();
    await expect(page.locator('ui-toast')).toContainText('no finding selected');
    await expect(
      page.locator('.encv__photo:not(.encv__photo--next) figcaption').first()
    ).toContainText('Landmark');
  });

  test('says where the next press will land, on the card it will land on', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);
    await expect(page.getByTestId('encv--photo-next')).toContainText('landmark');

    await recordFinding(page, 'sigmoid', 'polyp');
    await expect(page.getByTestId('encv--photo-next')).toContainText('Sigmoid colon');
  });

  test('freezes the panel without touching the record', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.getByTestId('encv--feed-freeze').click();
    await expect(page.locator('[data-feed-stage]')).toHaveAttribute('data-state', 'frozen');
    await expect(page.getByTestId('encv--feed-freeze')).toHaveText('Unfreeze');
    /* A freeze is a look, not an entry. */
    await expect(page.getByTestId('encv--photo-count')).toHaveText('0 of 50');
  });

  test('opens the jar dialog on the finding being captured against', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);
    await recordFinding(page, 'ascending', 'polyp');

    await page.getByTestId('encv--feed-biopsy').click();
    /* The same dialog the Specimens card opens, already linked — a jar with no
       finding on it is the one state the specimen record may not be in. */
    await expect(page.locator('#specimenModal')).toContainText('Ascending colon');
  });

  test('opens the jar form even with no finding chosen yet', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.getByTestId('encv--feed-biopsy').click();

    /* The button used to refuse — "select a finding first" — which is a rule
       the DIALOG owns: it asks that question first and will not save without
       an answer. A button that pre-refused was a second guard on one rule, and
       it displaced the only one that can offer the findings to pick from. */
    await expect(page.locator('#specimenModal')).toContainText('Which finding did this come off?');
  });
});

/* ============================================================================
   WHERE THE PICTURES LAND
   ========================================================================= */

test.describe('the report is ordered the way the case is worked', () => {
  test('puts the photo card directly under the jars', async ({ page }) => {
    await openReport(page);

    const order = await page
      .locator('#docBody [data-section]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.section));

    /* What was found, what went in a pot, what was photographed — the three
       cards worked while the scope is in, consecutive. Everything below them
       is written afterwards. The photo card shipped at the foot of the report,
       which was right while the only way onto it was choosing files off a disk
       at the end of the case. */
    expect(order.slice(order.indexOf('findings'), order.indexOf('findings') + 3)).toEqual([
      'findings',
      'specimens',
      'photos',
    ]);
  });
});

/* ============================================================================
   THE PEDAL
   ========================================================================= */

test.describe('the foot pedal', () => {
  test('captures on Enter and freezes on Space, from anywhere on the page', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.locator('body').press('Enter');
    await expect(page.getByTestId('encv--photo-count')).toHaveText('1 of 50');

    await page.locator('body').press(' ');
    await expect(page.locator('[data-feed-stage]')).toHaveAttribute('data-state', 'frozen');
  });

  test('declines while something is being typed into', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    /* The impression box, which is a paragraph somebody writes with spaces in
       it. A pedal that froze the monitor on every word would be unusable. */
    await page.locator('#docf-impression textarea').press(' ');
    await expect(page.locator('[data-feed-stage]')).toHaveAttribute('data-state', 'live');
  });

  test('declines while a dialog is over the page', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);

    await page.locator('.segf__hotspot').first().click();
    /* Off the fields first, so what declines the press is the dialog being up
       rather than the caret being in a box — the drawer opens with focus in
       its type picker, which the typing guard would have caught anyway. */
    await page.locator('#findingsDrawer .ui-modal__title').click();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('encv--photo-count')).toHaveText('0 of 50');
  });
});

/* ============================================================================
   WHAT THE FEED IS NOT
   ========================================================================= */

test.describe('the feed is not the record', () => {
  test('keeps running while another step is worked', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);
    await page.getByTestId('encv--feed-capture').click();

    await page.getByTestId('encv--step-post-anaesthesia').click();
    /* The window goes down with the step. It floats over the whole screen, so
       nothing else would have taken it away — and a monitor left running over
       somebody's Aldrete score belongs to nothing on the page. */
    await expect(feedWindow(page)).toBeHidden();

    await page.getByTestId('encv--step-procedure').click();
    await page.getByTestId('encv--substep-procedure-report').click();
    /* One panel, not two — the case did not stop, and neither did it start
       twice. */
    await expect(feedWindow(page)).toBeVisible();
    await expect(page.locator('.feed__scene')).toHaveCount(1);
    await expect(page.getByTestId('encv--photo-count')).toHaveText('1 of 50');
  });

  test('leaves the captures behind when it closes', async ({ page }) => {
    await page.goto(PROCEDURE);
    await startFeed(page);
    await page.getByTestId('encv--feed-capture').click();
    await page.getByTestId('encv--feed-capture').click();

    await page.getByTestId('encv--feed-end').locator('button').click();

    await expect(feedWindow(page)).toBeHidden();
    await expect(page.getByTestId('encv--feed-start')).toBeVisible();
    await expect(page.getByTestId('encv--photo-count')).toHaveText('2 of 50');
    await expect(page.locator('ui-toast')).toContainText('2 captures');
  });

  test('never becomes something the report is waiting on', async ({ page }) => {
    await openReport(page);
    const outstanding = await page.locator('#docHint').textContent();

    await startFeed(page);
    /* The same sentence with the feed open as without it: the panel answers
       nothing, so it can be absent on a day the stack is down without making
       the report unsignable. */
    await expect(page.locator('#docHint')).toHaveText(outstanding);
  });
});
