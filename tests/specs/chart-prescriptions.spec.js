/**
 * Chart — Prescriptions, which is now a frame around the e-prescribing vendor
 * with nothing loaded into it.
 *
 * The section stopped being our own worklist: prescribing moved to ScriptSure,
 * and the chart's own Active / Past medication lists moved next door to the
 * Medication module (tested in chart-medications.spec.js). What is left is the
 * chrome the host application owns — the patient the session is scoped to —
 * around a space held open for the vendor's UI. These
 * tests are about that space staying empty: no local composer, no mock-up of
 * somebody else's screen, and the same one sentence wherever a reader arrives
 * at it.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_RX = '/screens/patient-chart.html?mrn=326486#prescriptions';
/** A patient with nothing prescribed — the screen is identical, which is the point. */
const LIAM_RX = '/screens/patient-chart.html?mrn=326481#prescriptions';

const INTEGRATION_LINE = 'The ScriptSure window renders here.';

test.describe('chart prescriptions — the vendor frame', () => {
  test('the section is named, once', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_RX);

    /* The heading is on screen. It was hidden while a tab strip beside it
       named the section; there is no strip now, and a framed window belonging
       to somebody else is the last place a reader should have to guess which
       part of the chart they are in. */
    const title = page.getByTestId('chart--module-title');
    await expect(title).toHaveText('Prescriptions');
    await expect(title).not.toHaveClass(/u-sr-only/);

    /* And only there. The frame used to carry its own title bar — product,
       tenant, environment, connection state — which was a second heading over
       a window with nothing in it to title. */
    const frame = page.getByTestId('chart--rx-scriptsure');
    await expect(frame).not.toContainText('ScriptSure Cloud ePrescribing');
    await expect(frame).not.toContainText('GastroEMR Gastroenterology');
    await expect(page.getByTestId('chart--rx-connection')).toHaveCount(0);

    assertClean();
  });

  /* The whole point. A screen that drew a convincing prescription window would
     be worse than an empty one: it invites review of a UI this product does
     not own, and it reads as progress on a connection that is not there. */
  test('the interior is held open, not drawn', async ({ page }) => {
    await openChart(page, HENNA_RX);

    const inside = page.getByTestId('chart--rx-empty');
    await expect(inside).toContainText(INTEGRATION_LINE);
    // And it points at where the medication list actually is.
    await expect(inside).toContainText('Medication');

    // No demo tables, no vendor toolbar or view strip standing in for one.
    await expect(page.locator('.ch__module table')).toHaveCount(0);
    await expect(page.getByTestId('chart--rx-view-current')).toHaveCount(0);
    // Nothing of the old local composer survived either.
    await expect(page.getByTestId('chart--add-medication')).toHaveCount(0);
  });

  /* An e-prescribing window with the wrong chart open is the failure the
     patient strip exists to make visible — so it is inside the frame, where it
     stands for what the vendor session thinks it is scoped to. */
  test('the frame carries the patient the session is scoped to', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const frame = page.getByTestId('chart--rx-scriptsure');

    await expect(frame).toContainText('Henna West');
    await expect(frame).toContainText('MRN 326486');
  });

  test('Add Prescription opens a dialog that says the same thing', async ({ page }) => {
    await openChart(page, HENNA_RX);

    await page.getByTestId('chart--rx-add').locator('button').click();

    const modal = page.getByTestId('chart--rx-add-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(INTEGRATION_LINE);
    // A dialog with no form in it: nothing typed here could reach a pharmacy.
    await expect(modal.locator('input, select, textarea')).toHaveCount(0);

    await modal.getByTestId('chart--rx-add-close').locator('button').click();
    await expect(modal).toBeHidden();
  });

  test('a patient with no prescriptions gets exactly the same screen', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, LIAM_RX);

    await expect(page.getByTestId('chart--rx-empty')).toContainText(INTEGRATION_LINE);
    await expect(page.getByTestId('chart--count-prescriptions')).toHaveCount(0);

    assertClean();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_RX);
    await expectNoA11yViolations(page);

    await page.getByTestId('chart--rx-add').locator('button').click();
    await expectNoA11yViolations(page);
  });
});
