/**
 * Alerts and Due Recommendations — the read-only digest opened from
 * js/screens/patient-chart.js (openAlertsSummary) on every chart entry.
 * Distinct from #alertModal, which composes a new alert note.
 *
 * These tests navigate with page.goto rather than the openChart() helper the
 * other chart specs use: the helper's job is to close this digest, and this
 * is the file that has to watch it open.
 *
 * The behaviour under test is that it is UNCONDITIONAL. There is no "seen it
 * already" flag — not per day, not per session, not per patient — so the
 * cases below are mostly about the ways it could accidentally acquire one.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';

const SCREEN = '/screens/patient-chart.html';
const HENNA = `${SCREEN}?mrn=326486`;
const NATALI = `${SCREEN}?mrn=326477`;

const modal = (page) => page.locator('#alertsSummaryModal .ui-modal__dialog');
const shell = (page) => page.locator('#alertsSummaryModal .ui-modal');
const close = (page) => page.getByTestId('chart--alerts-summary-close').locator('button');
const lede = (page) => page.getByTestId('chart--alerts-summary-lede');
const review = (page) => page.getByTestId('chart--alerts-summary-clinical').locator('button');

test.describe('alerts and due recommendations digest', () => {
  test('opens automatically on chart entry, listing alerts and due recommendations', async ({
    page,
  }) => {
    await page.goto(HENNA);

    await expect(modal(page)).toBeVisible();
    await expect(modal(page)).toContainText('Anaphylaxis to penicillin');
    await expect(modal(page)).toContainText('Colorectal cancer screening');
    // The Influenza vaccine's due date (01-10-2025) has already passed —
    // called out rather than listed the same as the others.
    await expect(modal(page).locator('.ch__due-overdue')).toContainText('01 Oct 2025');
  });

  test('opens again on every reload of the same chart', async ({ page }) => {
    await page.goto(HENNA);
    await close(page).click();
    await expect(shell(page)).toBeHidden();

    await page.reload();
    await expect(shell(page)).toBeVisible();
  });

  test('opens again on re-entering a chart already closed once this session', async ({ page }) => {
    await page.goto(HENNA);
    await close(page).click();
    await expect(shell(page)).toBeHidden();

    // Leave the chart entirely and come back — the close must not have
    // persisted anything.
    await page.goto('/screens/patient-directory.html');
    await page.goto(HENNA);
    await expect(shell(page)).toBeVisible();
  });

  test('opens for the next patient after being closed for the previous one', async ({ page }) => {
    await page.goto(HENNA);
    await close(page).click();

    await page.goto(NATALI);
    await expect(shell(page)).toBeVisible();
  });

  test('does not retrigger when moving between sections of an open chart', async ({ page }) => {
    await page.goto(HENNA);
    await close(page).click();
    await expect(shell(page)).toBeHidden();

    // A section change is a hash change on the same page — the digest is a
    // boot-time event, so it must stay closed.
    await page.getByTestId('chart--nav-orders').click();
    await expect(page.getByTestId('chart--module-title')).toHaveText('Orders');
    await expect(shell(page)).toBeHidden();
  });

  test('the line under the heading names what is pressing', async ({ page }) => {
    await page.goto(HENNA);

    // Henna has one high-priority alert and one recommendation whose due date
    // has passed, and the sentence names both.
    await expect(lede(page)).toContainText('1 high-priority alert');
    await expect(lede(page)).toContainText('1 recommendation overdue');
  });

  test('a due date carries how far away it is, not just when it is', async ({ page }) => {
    await page.goto(HENNA);

    // The exact span moves with the calendar — what has to hold is that the
    // overdue one is called overdue and the distant one is not.
    const rows = modal(page).locator('tbody tr');
    await expect(rows.first()).toContainText('Influenza vaccine');
    await expect(rows.first().locator('.ch__due-note--overdue')).toContainText('overdue');
    await expect(rows.nth(1)).toContainText('Colorectal cancer screening');
    await expect(rows.nth(1).locator('.ch__due-note')).toContainText('due in');
  });

  test('Review in chart closes onto the clinical profile', async ({ page }) => {
    await page.goto(HENNA);
    await review(page).click();

    await expect(shell(page)).toBeHidden();
    await expect(page).toHaveURL(/#profile-clinical$/);
    await expect(page.getByTestId('chart--pc-alerts')).toBeVisible();
  });

  test('a patient with no alerts still gets the digest, honestly empty', async ({ page }) => {
    await page.goto(`${SCREEN}?mrn=326481`);

    await expect(modal(page)).toBeVisible();
    await expect(modal(page)).toContainText('No active alerts.');
    await expect(lede(page)).toHaveText('Nothing on file for this patient.');

    // Nothing to review means nothing to send anyone to review.
    await expect(review(page)).toBeHidden();
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(HENNA);
    await expect(modal(page)).toBeVisible();
    await expectNoA11yViolations(page, '#alertsSummaryModal');
  });
});
