/**
 * Pagination consistency.
 *
 * Every paged table in the system uses lib/pagination.js. Before it existed
 * there were three half-copies: the directory had the full control set, master
 * and the availability table had a pager but no rows-per-page, and the range
 * label was written three different ways ("1-15 of 36 rows", "1–15 of 36",
 * "1-15 of 36"). These tests are what stops that happening again — they assert
 * the SHAPE of the footer, not any one screen's data.
 */
import { test, expect } from '@playwright/test';

/**
 * Every paged table, and the testid stem its footer was built with.
 *
 * `tab` is the tab that has to be opened first, for the lists that live behind
 * one; `noun` is what that table calls a row, for the tables that renamed it.
 */
const PAGED_TABLES = [
  { name: 'patient directory', url: '/screens/patient-directory.html', id: 'directory' },
  // Master opens on Data Import now, so ICD-10 is reached by name like the
  // rest of the lists rather than by being the default.
  { name: 'master · ICD-10', url: '/screens/master.html?tab=icd', id: 'mst-icd' },
  { name: 'master · CPT', url: '/screens/master.html?tab=cpt', id: 'mst-cpt' },
  { name: 'master · payers', url: '/screens/master.html?tab=payer', id: 'mst-payer' },
  { name: 'master · instruments', url: '/screens/master.html?tab=instrument', id: 'mst-instrument' },
  { name: 'master · clinicians', url: '/screens/master.html?tab=clinician', id: 'mst-clinician' },
  {
    name: 'appointment availability',
    url: '/screens/appointment-settings.html',
    id: 'apt-availability',
  },
  {
    name: 'appointment status',
    url: '/screens/appointment-settings.html',
    tab: 'Appointment Status',
    id: 'apt-colors',
    noun: 'statuses',
  },
  {
    name: 'practice locations',
    url: '/screens/practice-settings.html',
    tab: 'Locations',
    id: 'prc-locations',
    noun: 'locations',
  },
  {
    name: 'provider patient flags',
    url: '/screens/provider-settings.html',
    tab: 'Patient Flag',
    id: 'pvs-flags',
    noun: 'flags',
  },
];

/** Open the screen, and the tab the table lives behind if it lives behind one. */
async function open(page, table) {
  await page.goto(table.url);
  if (table.tab) await page.getByRole('tab', { name: table.tab }).click();
}

for (const table of PAGED_TABLES) {
  test.describe(`pagination — ${table.name}`, () => {
    test('offers the same three controls', async ({ page }) => {
      await open(page, table);

      await expect(page.getByTestId(`${table.id}--range`)).toBeVisible();
      await expect(page.getByTestId(`${table.id}--rows-per-page`)).toBeVisible();
      await expect(page.getByTestId(`${table.id}--pages`)).toBeVisible();
    });

    test('offers the same four page sizes', async ({ page }) => {
      await open(page, table);
      const options = page.getByTestId(`${table.id}--rows-per-page`).locator('option');
      await expect(options).toHaveText(['10', '15', '25', '50']);
    });

    /* "1-15 of 36 rows" — one wording, so two tables never describe the same
       thing differently. */
    test('words the range the same way', async ({ page }) => {
      await open(page, table);
      await expect(page.getByTestId(`${table.id}--range`)).toHaveText(
        new RegExp(`^\\d+-\\d+ of \\d+ ${table.noun ?? 'rows'}( · .+)?$`)
      );
    });

    test('carries prev and next, with prev disabled on page one', async ({ page }) => {
      await open(page, table);
      const pages = page.getByTestId(`${table.id}--pages`);

      await expect(pages.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      await expect(pages.getByRole('button', { name: 'Next page' })).toBeVisible();
      await expect(pages.locator('.ui-pager__page--current')).toHaveText('1');
    });
  });
}

test.describe('pagination — behaviour', () => {
  const DIRECTORY = '/screens/patient-directory.html';

  test('changing the page size returns to page one', async ({ page }) => {
    await page.goto(DIRECTORY);
    const pages = page.getByTestId('directory--pages');

    await pages.getByRole('button', { name: 'Next page' }).click();
    await expect(pages.locator('.ui-pager__page--current')).toHaveText('2');

    // Page 2 of 15-per-page does not exist at 50 per page; landing there would
    // render an empty table.
    await page.getByTestId('directory--rows-per-page').selectOption('50');
    await expect(pages.locator('.ui-pager__page--current')).toHaveText('1');
    await expect(page.getByTestId('directory--range')).toHaveText('1-36 of 36 rows');
  });

  test('the page size actually changes how many rows are drawn', async ({ page }) => {
    await page.goto(DIRECTORY);
    const rows = page.getByTestId('directory--table').locator('tbody tr');

    await expect(rows).toHaveCount(15);
    await page.getByTestId('directory--rows-per-page').selectOption('10');
    await expect(rows).toHaveCount(10);
    await expect(page.getByTestId('directory--range')).toHaveText('1-10 of 36 rows');
  });

  /* A filter that shrinks the list below the current page would otherwise
     strand the table on a page past the end, showing nothing. */
  test('a filter that shrinks the list clamps the page', async ({ page }) => {
    await page.goto(DIRECTORY);
    const pages = page.getByTestId('directory--pages');

    await pages.getByRole('button', { name: 'Next page' }).click();
    await pages.getByRole('button', { name: 'Next page' }).click();
    await expect(pages.locator('.ui-pager__page--current')).toHaveText('3');

    await page.getByTestId('directory--search').locator('input').fill('Baker');

    await expect(pages.locator('.ui-pager__page--current')).toHaveText('1');
    await expect(page.getByTestId('directory--table').locator('tbody tr')).not.toHaveCount(0);
  });

  test('an empty result says so rather than showing "0-0 of 0"', async ({ page }) => {
    await page.goto(DIRECTORY);
    await page.getByTestId('directory--search').locator('input').fill('zzzznobody');
    await expect(page.getByTestId('directory--range')).toHaveText('No rows');
  });
});
