/**
 * ENCOUNTER SUMMARY — the note read rather than written, and signed.
 *
 * One screen in two states. Unsigned it is the last look before committing —
 * Cancel, Sign & Lock. Signed it is the filed record — Download, Share, and
 * the signature beside it.
 *
 * Signing goes through a dialog on purpose: a name stamped on a legal document
 * by one click is a click nobody meant to make. These tests drive the whole
 * commit, because "the button exists" would not catch a dialog that signs
 * without the attestation or a signature that never reaches the rail.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors } from '../helpers/page-helpers.js';

/** ap3 — Henryk Duszynski, seeded as a note still waiting on a signature. */
const UNSIGNED = '/screens/encounter-summary.html?appt=ap3';
/** ap1 — Priya Raman, seeded as filed and signed. */
const SIGNED = '/screens/encounter-summary.html?appt=ap1';

test.describe('encounter summary — unsigned', () => {
  test('opens as an unsigned note with nothing in the signature rail', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(UNSIGNED);

    await expect(page.getByTestId('es--state-badge')).toContainText('Unsigned');
    await expect(page.getByTestId('es--signature-none')).toBeVisible();
    await expect(page.getByTestId('es--sign-lock')).toBeVisible();
    await expect(page.getByTestId('es--save')).toHaveCount(0);

    assertClean();
  });

  test('carries the appointment details and the note body', async ({ page }) => {
    await page.goto(UNSIGNED);
    const body = page.getByTestId('es--body');

    await expect(body).toContainText('Appointment Details');
    await expect(body).toContainText('Reason For Visit');
    await expect(body).toContainText('Service Date & Time');
    await expect(body).toContainText('Subjective');
    await expect(body).toContainText('Assessment');
  });

  /** The signature is rendered from what is typed, before it is committed. */
  test('the dialog previews the signature as the name is typed', async ({ page }) => {
    await page.goto(UNSIGNED);
    await page.getByTestId('es--sign-lock').locator('button').click();

    await expect(page.locator('#signModal')).toBeVisible();
    await page.getByTestId('es--sign-name').locator('input').fill('Dana Whitfield, MD');

    await expect(page.getByTestId('es--sign-preview')).toContainText('Dana Whitfield');
  });

  test('signing is refused until the attestation is ticked', async ({ page }) => {
    await page.goto(UNSIGNED);
    await page.getByTestId('es--sign-lock').locator('button').click();
    await page.getByTestId('es--sign-confirm').locator('button').click();

    await expect(page.locator('.ui-toast-region')).toContainText('Tick the confirmation');
    await expect(page.getByTestId('es--state-badge')).toContainText('Unsigned');
  });

  test('signing is refused on an empty name', async ({ page }) => {
    await page.goto(UNSIGNED);
    await page.getByTestId('es--sign-lock').locator('button').click();
    await page.getByTestId('es--sign-name').locator('input').fill('');
    await page.getByTestId('es--sign-attest').locator('label').click();
    await page.getByTestId('es--sign-confirm').locator('button').click();

    await expect(page.getByTestId('es--sign-name')).toHaveAttribute('error', /name/i);
    await expect(page.getByTestId('es--state-badge')).toContainText('Unsigned');
  });

  test('Sign & Lock files the note and puts the signature in the rail', async ({ page }) => {
    await page.goto(UNSIGNED);
    await page.getByTestId('es--sign-lock').locator('button').click();
    await page.getByTestId('es--sign-name').locator('input').fill('Dana Whitfield, MD');
    await page.getByTestId('es--sign-attest').locator('label').click();
    await page.getByTestId('es--sign-confirm').locator('button').click();

    await expect(page.getByTestId('es--state-badge')).toContainText('Signed');
    await expect(page.getByTestId('es--signature')).toContainText('Dana Whitfield, MD');
    await expect(page.locator('.ui-toast-region')).toContainText('signed');

    // The footer swaps to what a filed note offers.
    await expect(page.getByTestId('es--save')).toBeVisible();
    await expect(page.getByTestId('es--sign-lock')).toHaveCount(0);
  });
});

test.describe('encounter summary — signed', () => {
  test('a seeded signed note opens read-only, with its signature', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SIGNED);

    await expect(page.getByTestId('es--state-badge')).toContainText('Signed');
    await expect(page.getByTestId('es--signature')).toContainText('Signed by');
    await expect(page.getByTestId('es--save')).toBeVisible();
    await expect(page.getByTestId('es--cancel')).toBeVisible();
    await expect(page.getByTestId('es--sign-lock')).toHaveCount(0);

    assertClean();
  });

  /** Signing is final on this screen — there is no route back into the note. */
  test('a signed note offers no way to reopen it', async ({ page }) => {
    await page.goto(SIGNED);

    await expect(page.getByTestId('es--amend')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Amend' })).toHaveCount(0);
    await expect(page.getByTestId('es--foot-hint')).toContainText('filed and locked');
  });
});
