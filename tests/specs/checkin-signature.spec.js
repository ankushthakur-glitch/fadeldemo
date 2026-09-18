/**
 * Check-in — taking the patient's electronic signature.
 *
 * A mark made by the patient, not a button pressed on their behalf. "Proceed
 * to patient signature" used to BE the signature: one press filed the consent,
 * so the desk signed for the patient without either of them seeing it happen.
 *
 * The pad is the patient portal's block, used here rather than rebuilt — the
 * desk and the patient meet the same control for the same act. It is on screen
 * from the moment a step opens; what the confirmation beneath it governs is
 * whether a mark is FILED, which is the part that carries the legal weight. A
 * drawn line nobody recorded is not a signature.
 *
 * Check-in is a rail of steps with one pane open at a time, so every document
 * below is reached from the rail rather than scrolled to.
 *
 * The Advance Directives reveal rules on this screen are covered next door in
 * check-in-directives.spec.js.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

const CHECKIN = '/screens/check-in.html?appt=ap28';

/* A 1×1 PNG. Small enough to inline, real enough for the type and size checks
   the pad applies before it will take a file. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const open = async (page) => {
  await page.goto(CHECKIN);
  await expect(page.getByTestId('cin--rail-procedure')).toBeVisible();
};

/**
 * Get to the pad for a document.
 *
 * There is nothing to tick first — the pad is on screen as soon as the step
 * is. This only walks the rail to the step and hands back the block.
 */
async function openPad(page, doc) {
  await page.getByTestId(`cin--rail-${doc}`).click();
  const pad = page.getByTestId(`cin--signature-${doc}`);
  await expect(pad).toBeVisible();
  return pad;
}

/** Scribble across the pad. Returns nothing; the point is the side effect. */
async function drawOn(page, pad) {
  const canvas = pad.locator('[data-sign-canvas]');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();

  /* Drawn near the TOP of the pad on purpose. The pane scrolls under the
     step's own foot bar, and a point low in the canvas can be behind it — the
     press lands on the bar and nothing is drawn. */
  const y = box.y + 40;
  await page.mouse.move(box.x + box.width / 2 - 120, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, y + 40, { steps: 6 });
  await page.mouse.move(box.x + box.width / 2 + 60, y - 10, { steps: 6 });
  await page.mouse.up();
}

/** Tick the confirmation under the pad — the act that files the mark. */
const confirmOn = (pad) => pad.locator('[data-sign-confirm]').check();

test.describe('check-in — the signature is the patient\'s, not the desk\'s', () => {
  test('the pad is the portal\'s, and it is there from the start', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await open(page);

    const pad = page.getByTestId('cin--signature-procedure');
    await expect(pad).toBeVisible();

    // The portal's own block, not a second one built for this side.
    await expect(pad.locator('.pp-sign__mode')).toHaveCount(2);
    await expect(pad.locator('[data-sign-canvas]')).toBeVisible();
    await expect(pad.locator('[data-sign-confirm]')).toBeVisible();
    await expect(pad.locator('[data-sign-state]')).toHaveText('Not signed yet.');

    assertClean();
  });

  /* Six pads share the page, hidden rather than removed. If they shared the
     radio group with them, choosing Upload on one document would take another
     document's Draw off with it. */
  test('each pad owns its own Draw/Upload group', async ({ page }) => {
    await open(page);
    const names = await page
      .locator('.pp-sign__mode input')
      .evaluateAll((inputs) => [...new Set(inputs.map((i) => i.name))]);

    expect(names.length).toBe(5); // one per signing step
  });

  test('a mark alone is not signed until the confirmation is ticked', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await drawOn(page, pad);
    await expect(pad.locator('[data-sign-state]')).toHaveText(
      'Tick the confirmation below to finish signing.'
    );
    await expect(page.locator('[data-sign="procedure"] .cin__doc-signed')).toHaveCount(0);
  });

  test('a confirmation with no mark behind it files nothing', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await confirmOn(pad);
    await expect(pad.locator('[data-sign-state]')).toHaveText('Not signed yet.');
    await expect(page.locator('[data-sign="procedure"] .cin__doc-signed')).toHaveCount(0);
  });

  test('Clear wipes the mark', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await drawOn(page, pad);
    await pad.locator('[data-sign-clear]').click();
    await expect(pad.locator('[data-sign-state]')).toHaveText('Not signed yet.');
  });

  test('a mark and the confirmation file the signature and the step', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await drawOn(page, pad);
    await confirmOn(pad);

    // The mark itself is kept, not just the claim that one was made.
    const image = page.getByTestId('cin--signature-image-procedure');
    await expect(image).toBeVisible();
    expect(await image.getAttribute('src')).toMatch(/^data:image\/png;base64,/);

    // Whose it was comes from the booking, since nothing on screen asks.
    await expect(page.locator('[data-sign="procedure"] .cin__doc-signed')).not.toBeEmpty();
    await expect(page.getByTestId('cin--rail-procedure')).toHaveClass(/--done/);
  });

  /* --- Upload, the other way to sign ---------------------------------------
     A mouse-drawn signature looks like nobody's handwriting. The scan or
     photograph the patient already has is the better mark on a desk PC, and
     it is offered as an equal rather than as a fallback. */

  test('an uploaded image signs the document', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await pad.locator('input[value="upload"]').check();
    await expect(pad.locator('[data-sign-pane="draw"]')).toBeHidden();
    await expect(pad.locator('[data-sign-drop]')).toBeVisible();

    await pad.locator('[data-sign-file]').setInputFiles({
      name: 'signature.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    });

    // What was attached is shown before it is filed, and named in the zone.
    await expect(pad.locator('[data-sign-preview]')).toBeVisible();
    await expect(pad.locator('[data-sign-file-name]')).toHaveText('signature.png');

    await confirmOn(pad);
    await expect(page.getByTestId('cin--signature-image-procedure')).toBeVisible();
    await expect(page.getByTestId('cin--rail-procedure')).toHaveClass(/--done/);
  });

  test('a file that is not a PNG or a JPG is refused, and says why', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');

    await pad.locator('input[value="upload"]').check();
    await pad.locator('[data-sign-file]').setInputFiles({
      name: 'consent.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4', 'utf8'),
    });

    await expect(pad.locator('[data-sign-error]')).toContainText('not a PNG or a JPG');
    await expect(pad.locator('[data-sign-preview]')).toBeHidden();
  });

  /* --- The rail ------------------------------------------------------------- */

  test('each document is signed on its own', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');
    await drawOn(page, pad);
    await confirmOn(pad);

    await page.getByTestId('cin--rail-insurance').click();
    await expect(page.getByTestId('cin--signature-image-insurance')).toHaveCount(0);
    await expect(page.getByTestId('cin--rail-insurance')).not.toHaveClass(/--done/);
  });

  /* Signing again is there because the commonest mistake at a busy desk is the
     wrong person signing, and a mark that cannot be taken back would have to
     be undone by starting check-in over. */
  test('Sign again takes the mark back off the document', async ({ page }) => {
    await open(page);
    const pad = await openPad(page, 'procedure');
    await drawOn(page, pad);
    await confirmOn(pad);
    await expect(page.getByTestId('cin--rail-procedure')).toHaveClass(/--done/);

    await page.getByTestId('cin--resign-procedure').locator('button').click();

    await expect(page.getByTestId('cin--signature-image-procedure')).toHaveCount(0);
    await expect(page.getByTestId('cin--rail-procedure')).not.toHaveClass(/--done/);
  });

  /* Saving only exists on the last step, and it is live there whatever the
     rail says. The marks record what has been worked; they do not withhold the
     save, because a patient who cannot answer a question still has to be
     checked in. */
  test('check-in can be saved with steps still outstanding', async ({ page }) => {
    await open(page);
    await page.getByTestId('cin--rail-notes').click();

    const save = page.getByTestId('cin--confirm');
    await expect(save).toBeVisible();
    await expect(save).toContainText('Save and open note');
    await expect(save).not.toHaveAttribute('disabled', /.*/);

    // Nothing has been signed, and the rail says so — without holding the save.
    await expect(page.getByTestId('cin--rail-procedure')).not.toHaveClass(/--done/);

    // Next has given the slot up — there is nothing after this step.
    await expect(page.getByTestId('cin--next')).toBeHidden();
  });

  /* The patient band has gone from this screen — the booking it is opened
     from already settled who is being checked in, and the band restated that
     above every step. What the test still has to hold is the half that
     mattered: there is no picker here, so the identity cannot be got wrong
     from this screen at all. */
  test('there is no patient picker to get the identity wrong with', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-testid="cin--patient-strip"]')).toHaveCount(0);
    // Every control on the screen belongs to a step. Nothing above the work
    // area asks who this is.
    await expect(page.locator('.cin__head select, .cin__head input')).toHaveCount(0);
  });
});
