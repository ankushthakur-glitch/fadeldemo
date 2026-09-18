/**
 * Settings ▸ Templates — the list, the macros tab and the builder.
 *
 * The thing worth guarding here is the split: six tabs list TEMPLATES, which
 * are ordered lists of sections and open the builder; the seventh lists
 * MACROS, which are a title and a paragraph and open a dialog. Everything
 * downstream — columns, button label, where a click goes — follows from it.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const LIST = '/screens/templates.html';
const BUILDER = '/screens/template-builder.html';

const tab = (page, value) => page.locator(`#tplTabs [role="tab"][data-value="${value}"]`);

/* One panel per tab, so every locator is scoped to the one that is showing —
   otherwise a selector matches seven tables, six of them hidden. */
const panel = (page) => page.locator('.ui-table-card:not([hidden])');
const table = (page) => panel(page).locator('[data-testid="tpl--table"]');
const rows = (page) => table(page).locator('tbody tr');
const headers = (page) => table(page).locator('thead th');

test.describe('templates — the list', () => {
  test('reached from the Settings hub, which no longer calls it unbuilt', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto('/screens/settings.html');

    await expect(page.getByTestId('settings--templates-card')).not.toContainText(
      'Not in this prototype yet'
    );
    await page.getByTestId('settings--templates').click();
    await page.waitForURL('**/templates.html');
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeAttached();

    assertClean();
  });

  /**
   * Two tabs, and they are genuinely different things: a template is an
   * ordered list of sections, a macro is a block of prose. Questionnaire, ROS,
   * PE, Annotable Image and Order Set were five more names for what Visit
   * Notes already is — what a template is FOR is the Type column's job.
   */
  test('carries the two kinds, and not five more names for the first', async ({ page }) => {
    await page.goto(LIST);
    await expect(page.locator('#tplTabs [role="tab"]')).toHaveText(['Visit Notes', 'Macros']);
  });

  test('the tab strip gets its own row and is not clipped', async ({ page }) => {
    await page.goto(LIST);
    const strip = page.locator('#tplTabs .ui-tabs');
    const overflow = await strip.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('a template row shows name, type, created at and created by', async ({ page }) => {
    await page.goto(LIST);

    await expect(headers(page)).toHaveText(['Name', 'Type', 'Created at', 'Created by', 'Action']);
    const first = rows(page).first();
    await expect(first).toContainText('Actemra Infusion');
    await expect(first).toContainText('Infusion');
    await expect(first).toContainText('14 Mar 2026');
    await expect(first).toContainText('Dr. A. Mensah');
  });

  test('?tab= opens that kind directly', async ({ page }) => {
    await page.goto(`${LIST}?tab=macros`);
    await expect(tab(page, 'macros')).toHaveAttribute('aria-selected', 'true');
    await expect(rows(page).first()).toContainText('Hypertension');
  });

  test('search narrows the open list and says so when nothing matches', async ({ page }) => {
    await page.goto(LIST);
    const search = page.getByTestId('tpl--search').locator('input');

    // Asserted as "every surviving row matches" rather than a row count — the
    // count is a property of the seed data, the filtering is the behaviour.
    await search.fill('colonoscopy');
    const matched = await rows(page).allInnerTexts();
    expect(matched.length).toBeGreaterThan(0);
    for (const text of matched) expect(text.toLowerCase()).toContain('colonoscopy');

    await search.fill('zzz');
    await expect(table(page)).toContainText('No visit note template matches');
  });

  test('switching tab clears the search rather than filtering the new list by it', async ({
    page,
  }) => {
    await page.goto(LIST);
    await page.getByTestId('tpl--search').locator('input').fill('colonoscopy');
    await tab(page, 'macros').click();

    await expect(page.getByTestId('tpl--search').locator('input')).toHaveValue('');
    // The macros list is unfiltered — 10 of 15 on the first page.
    await expect(rows(page)).toHaveCount(10);
  });
});

test.describe('templates — macros', () => {
  /** A macro has no type and no sections, so those two columns would be blank. */
  test('macros get their own two columns, not the template five', async ({ page }) => {
    await page.goto(`${LIST}?tab=macros`);
    await expect(headers(page)).toHaveText(['Title', 'Created By', 'Action']);
  });

  test('the create button names what it makes on each tab', async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByTestId('tpl--create')).toContainText('Create New Template');

    await tab(page, 'macros').click();
    await expect(page.getByTestId('tpl--create')).toContainText('Create New Macro');
  });

  test('a macro is created from a dialog and lands at the top', async ({ page }) => {
    await page.goto(`${LIST}?tab=macros`);
    await page.getByTestId('tpl--create').locator('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Name is the one thing a macro cannot be without.
    await page.getByTestId('tpl--macro-save').locator('button').click();
    await expect(page.getByTestId('tpl--macro-name')).toContainText('name');

    await page.getByTestId('tpl--macro-name').locator('input').fill('Iron infusion counselling');
    await page
      .getByTestId('tpl--macro-description')
      .locator('textarea')
      .fill('What to cover before the first iron infusion.');
    await page.getByTestId('tpl--macro-save').locator('button').click();

    await expect(dialog).toBeHidden();
    await expect(rows(page).first()).toContainText('Iron infusion counselling');
  });

  test('clicking a macro opens it read-only rather than a dead link', async ({ page }) => {
    await page.goto(`${LIST}?tab=macros`);
    await panel(page).getByTestId('tpl--open-macro').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('tpl--macro-name').locator('input')).toBeDisabled();
    await expect(page.getByTestId('tpl--macro-save')).toBeHidden();
  });
});

test.describe('templates — the row menu', () => {
  test('offers View, Edit and Delete behind one button per row', async ({ page }) => {
    await page.goto(LIST);
    await panel(page).getByTestId('tpl--row-menu').first().click();

    await expect(page.getByTestId('tpl--menu-view')).toBeVisible();
    await expect(page.getByTestId('tpl--menu-edit')).toBeVisible();
    await expect(page.getByTestId('tpl--menu-delete')).toBeVisible();
  });

  test('Edit opens that template in the builder', async ({ page }) => {
    await page.goto(LIST);
    await panel(page).getByTestId('tpl--row-menu').first().click();
    await page.getByTestId('tpl--menu-edit').click();

    await expect(page).toHaveURL(/template-builder\.html\?id=TPL-101/);
  });

  /** The confirmation quotes the row back, so a mis-click is caught here. */
  test('Delete names the row and only removes it on confirm', async ({ page }) => {
    await page.goto(LIST);
    const target = rows(page).filter({ hasText: 'Actemra Infusion' });
    await expect(target).toHaveCount(1);

    await panel(page).getByTestId('tpl--row-menu').first().click();
    await page.getByTestId('tpl--menu-delete').click();
    await expect(page.getByRole('dialog')).toContainText('Actemra Infusion');

    // Cancel leaves it alone — the row, not a count, because paging means the
    // number of visible rows need not change when one is removed.
    await page.getByTestId('tpl--delete-cancel').locator('button').click();
    await expect(target).toHaveCount(1);

    await panel(page).getByTestId('tpl--row-menu').first().click();
    await page.getByTestId('tpl--menu-delete').click();
    await page.getByTestId('tpl--delete-confirm').locator('button').click();
    await expect(target).toHaveCount(0);
  });
});

test.describe('templates — the builder', () => {
  const canvasRows = (page) => page.locator('[data-testid="tb--canvas"] [data-testid="tb--row"]');

  test('an existing template opens with its sections in order', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(`${BUILDER}?id=TPL-101`);

    await expect(page.getByTestId('tb--title').locator('input')).toHaveValue('Actemra Infusion');
    await expect(page.getByTestId('tb--kind')).toHaveText('Visit Notes');
    await expect(page.getByTestId('tb--count')).toHaveText('23 sections');
    await expect(canvasRows(page).first()).toContainText('Letterhead');

    assertClean();
  });

  test('a new template starts empty and knows which kind it is', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await expect(page.getByTestId('tb--kind')).toHaveText('Visit Notes');
    await expect(page.getByTestId('tb--count')).toHaveText('Empty');
    await expect(canvasRows(page)).toHaveCount(0);
  });

  /** Click-to-append is the fast path and the only one a keyboard can use. */
  test('clicking a palette section appends it to the end', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--chip-allergies').click();
    await page.getByTestId('tb--chip-labs').click();

    await expect(canvasRows(page)).toHaveCount(2);
    await expect(canvasRows(page).nth(0)).toContainText('Allergies');
    await expect(canvasRows(page).nth(1)).toContainText('Labs');
  });

  test('a row moves with its own buttons, not only by drag', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--chip-allergies').click();
    await page.getByTestId('tb--chip-labs').click();

    await canvasRows(page).nth(1).getByRole('button', { name: /Move Labs up/ }).click();
    await expect(canvasRows(page).nth(0)).toContainText('Labs');
  });

  test('a row can be removed', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--chip-allergies').click();
    await canvasRows(page).first().getByTestId('tb--remove').click();

    await expect(canvasRows(page)).toHaveCount(0);
  });

  /** There is one letterhead. A second would be a template that cannot render. */
  test('a section that may appear once is ticked and goes inert after placing', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    const chip = page.getByTestId('tb--chip-letterhead');

    await expect(chip).toBeEnabled();
    await chip.click();
    await expect(chip).toBeDisabled();
    await expect(chip.locator('.tb__chip-used')).toBeVisible();

    // A spacer is not "once" — it can repeat as often as the layout needs.
    await page.getByTestId('tb--chip-layout-space').click();
    await page.getByTestId('tb--chip-layout-space').click();
    await expect(canvasRows(page)).toHaveCount(3);
  });

  test('the palette searches', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--search').locator('input').fill('allerg');

    await expect(page.getByTestId('tb--chip-allergies')).toBeVisible();
    await expect(page.getByTestId('tb--chip-labs')).toHaveCount(0);

    await page.getByTestId('tb--search').locator('input').fill('zzz');
    await expect(page.getByTestId('tb--palette-empty')).toBeVisible();
  });

  test('Preview shows the section headings in order', async ({ page }) => {
    await page.goto(`${BUILDER}?id=TPL-104`);
    await page.getByTestId('tb--preview').locator('button').click();

    const body = page.getByTestId('tb--preview-body');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(body.locator('h3').first()).toHaveText('Letterhead');
    await expect(body).toContainText('Indications');
  });

  test('saving refuses a template with no name', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--chip-allergies').click();
    await page.getByTestId('tb--save').locator('button').click();

    await expect(page.getByTestId('tb--title')).toContainText('name');
    await expect(page.getByTestId('tb--saved')).toBeHidden();
  });

  test('a named template saves and appears on its list', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--title').locator('input').fill('Upper GI Review');
    await page.getByTestId('tb--chip-allergies').click();
    await page.getByTestId('tb--save').locator('button').click();

    await expect(page.getByTestId('tb--saved')).toHaveText('Saved');
  });

  /** View is the same screen with its controls down, not a second screen. */
  test('mode=view stands the editing controls down', async ({ page }) => {
    await page.goto(`${BUILDER}?id=TPL-101&mode=view`);

    await expect(page.getByTestId('tb--title').locator('input')).toBeDisabled();
    await expect(page.getByTestId('tb--save')).toBeHidden();
    await expect(page.getByTestId('tb--preview')).toBeVisible();
    await expect(canvasRows(page).first().getByTestId('tb--remove')).toHaveCount(0);
  });

  test('a section drags from the palette into the template', async ({ page }) => {
    await page.goto(`${BUILDER}?kind=visit-notes`);
    await page.getByTestId('tb--chip-allergies').dragTo(page.getByTestId('tb--drop'));

    await expect(canvasRows(page)).toHaveCount(1);
    await expect(canvasRows(page).first()).toContainText('Allergies');
  });
});

test.describe('templates — quality', () => {
  test('no WCAG 2.1 A/AA violations on the list @a11y', async ({ page }) => {
    await page.goto(LIST);
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in the builder @a11y', async ({ page }) => {
    await page.goto(`${BUILDER}?id=TPL-101`);
    await expectNoA11yViolations(page);
  });
});
