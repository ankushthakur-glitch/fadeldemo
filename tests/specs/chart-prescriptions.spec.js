/**
 * Chart — Prescriptions: the table of every script written for the patient,
 * and the Add Prescription dialog that writes one.
 *
 * The section used to be an empty frame held open for the e-prescribing
 * vendor. It is now the practice's own record of what it prescribed — one row
 * per medication, newest first, active and past together — and Add
 * Prescription writes a prescription of one or more medications under a
 * single Rx number: one medication at a time in the form, each added to a side
 * panel listing what the prescription holds. Sent scripts land in the same session record Medication
 * reads, so they show on both screens, and are gone on reload.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_RX = '/screens/patient-chart.html?mrn=326486#prescriptions';
/** A patient with nothing prescribed. */
const LIAM_RX = '/screens/patient-chart.html?mrn=326481#prescriptions';

async function openCompose(page) {
  await page.getByTestId('chart--rx-add').locator('button').click();
  const modal = page.getByTestId('chart--rx-add-modal');
  await expect(modal).toBeVisible();
  return modal;
}

/** Fill the medication form and add it to the side panel. */
async function addMedication(modal, drug, sig) {
  await modal.getByTestId('chart--rx-drug').locator('input').fill(drug);
  await modal.getByTestId('chart--rx-sig').locator('input').fill(sig);
  await modal.getByTestId('chart--rx-add-med').locator('button').click();
}

test.describe('chart prescriptions', () => {
  test('lists every prescription, newest first, with its status', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openChart(page, HENNA_RX);

    const table = page.getByTestId('chart--rx-table');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    // Newest first: Sertraline (07 Oct 2025) heads, Metronidazole (Nov 2024) ends.
    await expect(rows.first()).toContainText('Sertraline 50mg tablet');
    await expect(rows.last()).toContainText('Metronidazole 400mg tablet');
    await expect(rows.last()).toContainText('Discontinued');
    await expect(table).toContainText('RX-10421');

    assertClean();
  });

  test('a patient with no prescriptions gets the empty state', async ({ page }) => {
    await openChart(page, LIAM_RX);
    await expect(page.getByTestId('chart--rx-table')).toContainText(
      'No prescriptions written for this patient.'
    );
  });

  test('the dialog has no demo banner and names the patient', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const modal = await openCompose(page);

    await expect(modal).not.toContainText('Demo screen');
    await expect(modal).toContainText('Henna West');
    await expect(modal).toContainText('MRN 326486');

    await modal.getByTestId('chart--rx-add-cancel').locator('button').click();
    await expect(modal).toBeHidden();
  });

  test('Add to Prescription moves the form into the side panel and clears it', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const modal = await openCompose(page);

    await expect(modal.getByTestId('chart--rx-list-empty')).toBeVisible();

    // Nothing is added from an empty form.
    await modal.getByTestId('chart--rx-add-med').locator('button').click();
    await expect(modal.getByTestId('chart--rx-drug')).toHaveAttribute('error', /medication/);
    await expect(modal.locator('[data-rx-item]')).toHaveCount(0);

    await addMedication(modal, 'Pantoprazole 40mg tablet', '1 tablet orally once daily');
    await addMedication(modal, 'Ondansetron 4mg tablet', '1 tablet orally every 8 hours as needed for nausea');

    const items = modal.locator('[data-rx-item]');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Pantoprazole 40mg tablet');
    await expect(items.nth(1)).toContainText('30 Tablet · 30 days · 0 refills');
    await expect(modal.getByTestId('chart--rx-drug').locator('input')).toHaveValue('');
  });

  test('an added medication can be edited in place and removed', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const modal = await openCompose(page);
    await addMedication(modal, 'Pantoprazole 40mg tablet', '1 tablet orally once daily');
    await addMedication(modal, 'Ondansetron 4mg tablet', '1 tablet orally every 8 hours as needed for nausea');

    const items = modal.locator('[data-rx-item]');
    await items.nth(0).locator('[data-rx-edit]').click();
    await expect(modal.getByTestId('chart--rx-drug').locator('input')).toHaveValue('Pantoprazole 40mg tablet');
    await expect(modal).toContainText('Editing Medication 1');

    await modal.getByTestId('chart--rx-sig').locator('input').fill('1 tablet orally twice daily');
    await modal.getByTestId('chart--rx-add-med').locator('button').click();
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('1 tablet orally twice daily');

    await items.nth(1).locator('[data-rx-remove]').click();
    await expect(items).toHaveCount(1);
  });

  test('sending refuses a prescription with anything required missing', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const modal = await openCompose(page);

    await modal.getByTestId('chart--rx-send').locator('button').click();

    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('chart--rx-provider')).toHaveAttribute('error', /prescriber/);
    await expect(modal.getByTestId('chart--rx-pharmacy')).toHaveAttribute('error', /pharmacy/);
    await expect(modal.getByTestId('chart--rx-panel')).toContainText(
      'Add at least one medication to the prescription.'
    );
  });

  test('two medications sent together share one Rx number and reach Medication', async ({ page }) => {
    await openChart(page, HENNA_RX);
    const modal = await openCompose(page);

    await modal.getByTestId('chart--rx-provider').locator('select').selectOption('Dr. A. Mensah');
    await modal
      .getByTestId('chart--rx-pharmacy')
      .locator('select')
      .selectOption('CVS Pharmacy #4471 — Fargo, ND');
    await addMedication(modal, 'Pantoprazole 40mg tablet', '1 tablet orally once daily');
    await addMedication(modal, 'Ondansetron 4mg tablet', '1 tablet orally every 8 hours as needed for nausea');

    await modal.getByTestId('chart--rx-send').locator('button').click();
    await expect(modal).toBeHidden();

    const rows = page.getByTestId('chart--rx-table').locator('tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(0)).toContainText('Pantoprazole 40mg tablet');
    await expect(rows.nth(1)).toContainText('Ondansetron 4mg tablet');
    const rxNumber = await rows.nth(0).locator('td').first().innerText();
    await expect(rows.nth(1).locator('td').first()).toHaveText(rxNumber);

    await page.getByTestId('chart--nav-medications').click();
    await expect(page.getByTestId('chart--med-list-table')).toContainText('Ondansetron 4mg tablet');
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openChart(page, HENNA_RX);
    await expectNoA11yViolations(page);

    await openCompose(page);
    await expectNoA11yViolations(page);
  });
});
