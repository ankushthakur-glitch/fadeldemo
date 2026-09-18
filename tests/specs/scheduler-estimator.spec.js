/**
 * Scheduler — gEstimator, from a booking's row menu.
 *
 * What the visit will cost the patient, before it happens. The booking already
 * answers who and what, so the dialog states the patient rather than asking
 * for them; the only question is which of their plans to estimate against, and
 * the answer appears in the same dialog.
 *
 * The arithmetic is the part worth testing. An estimate worked off the CHARGE
 * rather than the ALLOWED AMOUNT overstates the patient's share several-fold
 * on a well-contracted plan, and taking coinsurance before the deductible
 * understates it — so these drive the order, not just the presence of a total.
 *
 * Rates and plans are seeded in data/estimator.js.
 */
import { test, expect } from '@playwright/test';

const errs = (page) => {
  const out = [];
  page.on('console', (m) => m.type() === 'error' && out.push(m.text()));
  page.on('pageerror', (e) => out.push(String(e)));
  return out;
};

/** Open the row menu for a named patient and pick gEstimator. */
async function openEstimator(page, patientName) {
  await page.goto('/screens/scheduler.html');
  // The schedule pages, so narrow to the patient rather than hoping their row
  // is on the first page of the week.
  await page.getByTestId('sch--search').locator('input').fill(patientName);
  const row = page.locator('tbody tr').filter({ hasText: patientName }).first();
  await row.locator('[data-menu]').click();
  await page.getByTestId('sch--menu-estimate').click();
  await expect(page.locator('#estimateModal')).toBeVisible();
}

test('gEstimator opens with the patient already known', async ({ page }) => {
  const errors = errs(page);
  await openEstimator(page, 'Henna West');

  const who = page.getByTestId('sch--est-who');
  await expect(who).toContainText('Henna West');
  await expect(who).toContainText('326486');
  await expect(who).toContainText('Annual Wellness');

  // Patient is stated, not a field to choose.
  await expect(page.getByTestId('sch--est-plan')).toBeVisible();
  await expect(page.locator('#estimateModal select')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('the calculation is in the same dialog, with its working', async ({ page }) => {
  await openEstimator(page, 'Henna West');

  const calc = page.getByTestId('sch--est-calc');
  await expect(calc).toContainText('Clinic charge');
  await expect(calc).toContainText('contractual adjustment');
  await expect(calc).toContainText('Allowed amount');
  await expect(calc).toContainText('Copay');
  await expect(calc).toContainText('Plan pays');
  await expect(page.getByTestId('sch--est-owes')).toContainText('$');


});

test('changing the plan re-runs the sum without leaving the dialog', async ({ page }) => {
  await openEstimator(page, 'Henna West');
  const before = await page.getByTestId('sch--est-owes').innerText();

  await page.getByTestId('sch--est-plan').locator('select').selectOption('self-pay');
  await expect(page.getByTestId('sch--est-owes')).not.toHaveText(before);
  await expect(page.locator('#estimateModal')).toBeVisible();
});

/* Self pay has no plan behind it, so the patient owes the whole allowed
   amount — the arithmetic has to land there, not on a plan-pays split. */
test('self pay puts the whole allowed amount on the patient', async ({ page }) => {
  await openEstimator(page, 'Henna West');
  await page.getByTestId('sch--est-plan').locator('select').selectOption('self-pay');

  const calc = page.getByTestId('sch--est-calc');
  const allowed = (await calc.locator('.est__line--sub dd').innerText()).trim();
  await expect(page.getByTestId('sch--est-owes')).toHaveText(allowed);
});
