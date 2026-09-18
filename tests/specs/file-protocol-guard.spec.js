/**
 * The prototype must explain itself when opened straight off disk.
 *
 * Module scripts are blocked on file://, so the components never start and
 * the page looks broken with no clue why. A classic (non-module) script puts
 * an explanation on screen. This spec proves it fires there and — just as
 * importantly — stays out of the way over http://.
 */
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const fileUrl = (rel) => pathToFileURL(join(ROOT, rel)).href;

const PAGES = [
  'index.html',
  'gallery.html',
  'screens/patient-directory.html',
  'screens/patient-add.html',
  // The patient portal ships its own copy of the guard — it is a standalone
  // app and loads nothing from /js — so it needs its own coverage here.
  'patient/index.html',
  'patient/login.html',
];

test.describe('file:// guard', () => {
  for (const page_ of PAGES) {
    test(`explains itself when ${page_} is opened from disk`, async ({ page }) => {
      await page.goto(fileUrl(page_));

      const warning = page.locator('.file-warning');
      await expect(warning).toBeVisible();
      await expect(warning).toContainText('needs the local server');
      await expect(warning).toContainText('Open Prototype.cmd');

      // The components really are dead here — that is the whole point.
      const upgraded = await page.evaluate(
        () => document.querySelector('ui-button')?.querySelector('button') != null
      );
      expect(upgraded, 'components cannot start on file://').toBe(false);
    });
  }

  /*
   * index.html redirects to the sign-in page over http. That redirect must
   * NOT fire on file://, where the login screen's modules cannot start — the
   * reviewer would land on a dead page instead of the explanation above.
   */
  test('the front door does not redirect away from the warning on file://', async ({ page }) => {
    await page.goto(fileUrl('index.html'));

    await expect(page).toHaveURL(/index\.html$/);
    await expect(page.locator('.file-warning')).toBeVisible();
  });

  test('stays silent when served over http', async ({ page }) => {
    await page.goto('/screens/patient-directory.html');
    await expect(page.locator('.file-warning')).toHaveCount(0);

    // …and the components do start.
    await expect(
      page.getByTestId('directory--table').locator('tbody tr')
    ).toHaveCount(15);
  });
});
