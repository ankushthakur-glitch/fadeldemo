/**
 * Chart — Billing ▸ gEstimator: the estimates ON FILE.
 *
 * gEstimator itself ran from Profile ▸ Insurance — a section that left the
 * sidebar on 21 Aug 2026, taking the launch flow with it. What lands in the
 * Billing tab is that flow's output, the document, and the estimates already
 * on file are still here to read. So what is proved below is that the record
 * STAYS a record: frozen figures, no controls, nothing to re-decide. The
 * round-trip tests (run the estimator, find what it filed) are gone with the
 * flow they drove, and come back with it.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations, openChart } from '../helpers/page-helpers.js';

const HENNA_BILLING = '/screens/patient-chart.html?mrn=326486#billing';
/** Liam Rodriguez — the chart the billing tests use for "nothing on file". */
const EMPTY_BILLING = '/screens/patient-chart.html?mrn=326481#billing';

async function openGestimator(page, url = HENNA_BILLING) {
  await openChart(page, url);
  await page.getByRole('tab', { name: 'gEstimator' }).click();
}

test.describe('estimates on file', () => {
  test('the tab lists every estimate this patient has been given', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openGestimator(page);

    const cards = page.getByTestId('chart--est-card');
    await expect(cards).toHaveCount(2);

    // Enough on the row to tell two estimates apart without opening either:
    // the payer, the date of service, the codes and the two money figures.
    await expect(cards.first()).toContainText('Estimate #14648632');
    await expect(cards.first()).toContainText('MEDICARE PART B');
    await expect(cards.first()).toContainText('45378');
    await expect(cards.first()).toContainText('$412.60 allowed');

    assertClean();
  });

  /* Nothing applied is not the same as the patient owing nothing, and the list
     has to keep those apart as clearly as the document does. */
  test('an estimate run with no coverage applied says so rather than showing $0.00',
    async ({ page }) => {
      await openGestimator(page);
      const cards = page.getByTestId('chart--est-card');

      await expect(cards.first()).toContainText('Not calculated');
      await expect(cards.first()).not.toContainText('$0.00 due');
      await expect(cards.nth(1)).toContainText('$367.60 due');
    });

  test('an estimate sent to the patient is marked as sent', async ({ page }) => {
    await openGestimator(page);
    await expect(page.getByTestId('chart--est-card').nth(1)).toContainText('Sent to portal');
  });

  test('a patient with no estimates is told where they come from', async ({ page }) => {
    await openGestimator(page, EMPTY_BILLING);

    const empty = page.getByTestId('chart--est-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('Quick estimate');
    await expect(page.getByTestId('chart--est-card')).toHaveCount(0);
  });
});

test.describe('the document', () => {
  test('opens as the Step 2 calculation it was saved from', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await openGestimator(page);
    await page.getByTestId('chart--est-open').first().click();

    const doc = page.getByTestId('est--document');
    await expect(doc).toContainText('Estimate #14648632 from Elig ID 832648632');
    await expect(doc).toContainText('Active Coverage');

    // The three parties, as the reference screen carries them.
    await expect(doc).toContainText('HENNA WEST');
    await expect(doc).toContainText('MB48120556A');
    await expect(doc).toContainText('GastroEMR Gastroenterology ASC');
    await expect(doc).toContainText('MEDICAREB');

    // The priced line, whole.
    const row = page.getByTestId('est--rate-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('45378');
    await expect(row).toContainText('$1,850.00');
    await expect(row).toContainText('$412.60');
    await expect(row).toContainText('Fee Schedule Match');
    await expect(page.getByTestId('est--total-allowed')).toHaveText('$412.60');

    assertClean();
  });

  /* The whole point of the document: there is nothing on it left to decide, so
     there is no control on it to decide with. Step 2 has selects for the basis,
     the line percentage and each coverage option; a record has none. */
  test('carries no control of any kind', async ({ page }) => {
    await openGestimator(page);
    await page.getByTestId('chart--est-open').first().click();

    const doc = page.getByTestId('est--document');
    await expect(doc.locator('input, select, textarea, button')).toHaveCount(0);
  });

  /* Which way the estimate was run is the most consequential thing on it: the
     same rates without the deductible produce a different number. */
  test('states whether each coverage option was applied', async ({ page }) => {
    await openGestimator(page);

    await page.getByTestId('chart--est-open').first().click();
    await expect(page.getByTestId('est--copay')).toContainText('Not applied');
    await expect(page.getByTestId('est--deductible')).toContainText('Not applied');
    await expect(page.getByTestId('est--due')).toContainText('Not calculated');

    await page.getByTestId('chart--est-back').click();
    await page.getByTestId('chart--est-open').nth(1).click();
    await expect(page.getByTestId('est--copay')).toContainText('Applied');
    await expect(page.getByTestId('est--deductible')).toContainText('Applied');
    await expect(page.getByTestId('est--coinsurance')).toContainText('Not applied');
    await expect(page.getByTestId('est--due-amount')).toHaveText('$367.60');
  });

  test('shows the working behind the figure, not just the figure', async ({ page }) => {
    await openGestimator(page);
    await page.getByTestId('chart--est-open').nth(1).click();

    const due = page.getByTestId('est--due');
    await expect(due).toContainText('Total expected allowed');
    await expect(due).toContainText('Towards deductible');
    await expect(due).toContainText('Plan is expected to pay');
  });

  test('the note written for the patient travels with the document', async ({ page }) => {
    await openGestimator(page);
    await page.getByTestId('chart--est-open').nth(1).click();
    await expect(page.getByTestId('est--note')).toContainText('deductible has $640 remaining');
  });

  test('back returns to the list', async ({ page }) => {
    await openGestimator(page);
    await page.getByTestId('chart--est-open').first().click();
    await expect(page.getByTestId('est--document')).toBeVisible();

    await page.getByTestId('chart--est-back').click();
    await expect(page.getByTestId('chart--est-list')).toBeVisible();
    await expect(page.getByTestId('est--document')).toHaveCount(0);
  });

  test('the document can be taken away as a file', async ({ page }) => {
    await openGestimator(page);
    const download = page.waitForEvent('download');
    await page.getByTestId('chart--est-download').first().click();
    expect((await download).suggestedFilename()).toBe('estimate-14648632-326486.txt');
  });

  test('no WCAG 2.1 A/AA violations on the document @a11y', async ({ page }) => {
    await openGestimator(page);
    await page.getByTestId('chart--est-open').first().click();
    await expectNoA11yViolations(page);
  });
});

test.describe('the quick estimate underneath', () => {
  /* Still there, and still honest about what it is not: it prices a procedure
     with no eligibility response behind it. */
  test('prices a procedure without pretending to be a benefits check', async ({ page }) => {
    await openGestimator(page);

    await page.getByTestId('chart--gest-procedure').locator('select').selectOption('Colonoscopy');
    await page.getByTestId('chart--gest-payer').locator('select').selectOption('Self-pay');
    await page.getByTestId('chart--gest-estimate').locator('button').click();

    const result = page.locator('#blGestResult');
    await expect(result).toContainText('$1,850.00');
    await expect(page.locator('.bl__gestimator-note')).toContainText('not a claim');
  });
});
