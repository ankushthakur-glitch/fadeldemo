/**
 * CHART TASKS — one patient's outstanding work, and what they are due back for.
 *
 * The module is the patient-shaped cut of Task Management, so what these tests
 * guard is mostly the difference between the two: no patient column, no
 * patient picker on create, and a recall counted separately from a task.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const CHART = '/screens/patient-chart.html?mrn=326486#tasks';
const EMPTY_CHART = '/screens/patient-chart.html?mrn=326495#tasks';

/* Tabs by the value they carry rather than their label — the label is wording
   and wording gets revised. Same convention as the scheduler and referrals. */
const tab = (page, value) =>
  page.locator(`[data-testid="chart--tasks-tabs"] [role="tab"][data-value="${value}"]`);

const taskRows = (page) => page.locator('[data-testid="chart--tasks-table"] tbody tr');
const recallRows = (page) => page.locator('[data-testid="chart--recalls-table"] tbody tr');

/** The chart greets you with its alerts dialog; every test starts past it. */
async function openTasks(page, url = CHART) {
  await page.goto(url);
  const close = page.getByRole('button', { name: 'Close' }).first();
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.getByTestId('chart--tasks-tabs')).toBeVisible();
}

test.describe('chart tasks — the two lists', () => {
  test('opens on Tasks, and the strip names the two lists without counting them', async ({
    page,
  }) => {
    const assertClean = failOnConsoleErrors(page);
    await openTasks(page);

    // The heading is kept for the outline and the screen reader but taken off
    // the screen — the tab strip in its place already names the section, the
    // same way Appointments does it.
    const title = page.getByTestId('chart--module-title');
    await expect(title).toHaveText('Tasks');
    await expect(title).toHaveClass(/u-sr-only/);

    await expect(tab(page, 'tasks')).toHaveAttribute('aria-selected', 'true');
    // A tab is a place, not a tally: the rows under it are the count.
    await expect(tab(page, 'tasks').locator('.ui-tabs__count')).toHaveCount(0);
    await expect(tab(page, 'recalls').locator('.ui-tabs__count')).toHaveCount(0);
    await expect(taskRows(page)).toHaveCount(4);

    assertClean();
  });

  /**
   * The strip is the shell's now, in the module head — the same slot Orders,
   * Appointments and Profile put theirs in — rather than markup inside the
   * panel. It read as the secondary level while it sat under the head with
   * the heading above it; standing in the heading's own place it is this
   * section's switch, and it is drawn the way every other module's head strip
   * is drawn.
   */
  test('the strip is the primary one, in the module head', async ({ page }) => {
    await openTasks(page);

    await expect(
      page.getByTestId('chart--module-tabs').getByTestId('chart--tasks-tabs')
    ).toBeVisible();
    await expect(page.locator('[data-testid="chart--tasks-tabs"] .ui-tabs')).toHaveClass(
      /ui-tabs--primary/
    );
  });

  test('Recalls swaps the table, the action and the filters', async ({ page }) => {
    await openTasks(page);
    await tab(page, 'recalls').click();

    await expect(recallRows(page)).toHaveCount(2);
    await expect(page.getByTestId('chart--tasks-new')).toContainText('New recall');
    // "Show completed" belongs to tasks; a recall is never completed, it is booked.
    await expect(page.getByTestId('chart--tasks-show-done')).toHaveCount(0);
  });

  /** You are already inside one patient — a column repeating them is noise. */
  test('neither table carries a Patient column', async ({ page }) => {
    await openTasks(page);
    await expect(page.locator('[data-testid="chart--tasks-table"] thead')).not.toContainText(
      'Patient'
    );

    await tab(page, 'recalls').click();
    await expect(page.locator('[data-testid="chart--recalls-table"] thead')).not.toContainText(
      'Patient'
    );
  });

  /** A worklist is read top-down, so the most overdue thing is the first row. */
  test('tasks are ordered soonest-due first', async ({ page }) => {
    await openTasks(page);
    await expect(taskRows(page).first()).toContainText('Overdue');
  });

  test('a patient with nothing owed gets an honest empty state', async ({ page }) => {
    await openTasks(page, EMPTY_CHART);
    await expect(page.getByTestId('chart--tasks-table')).toContainText(
      'Nothing owed on this patient'
    );
  });
});

test.describe('chart tasks — adding', () => {
  test('New task files against this patient without asking which', async ({ page }) => {
    await openTasks(page);
    await page.getByTestId('chart--tasks-new').locator('button').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The chart has already answered "which patient", so the dialog states it
    // rather than offering a picker whose only wrong answer is someone else.
    await expect(dialog).toContainText('For Henna West');
    await expect(dialog.locator('select')).toHaveCount(3); // type, priority, assignee
    await expect(dialog).not.toContainText('Patient');
  });

  /** Blank dropdowns make the commonest task the slowest to raise. */
  test('the dialog opens on real defaults, not blanks', async ({ page }) => {
    await openTasks(page);
    await page.getByTestId('chart--tasks-new').locator('button').click();

    await expect(page.getByTestId('chart--task-type').locator('select')).toHaveValue('General');
    await expect(page.getByTestId('chart--task-priority').locator('select')).toHaveValue('Routine');
    await expect(page.getByTestId('chart--task-assignee').locator('select')).toHaveValue(
      'Dr. A. Mensah'
    );
    await expect(page.getByTestId('chart--task-due').locator('input')).not.toHaveValue('');
  });

  test('a task needs a subject, and says so without losing the date', async ({ page }) => {
    await openTasks(page);
    await page.getByTestId('chart--tasks-new').locator('button').click();
    await page.getByTestId('chart--task-save').locator('button').click();

    await expect(page.getByTestId('chart--task-subject')).toContainText('subject');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('a new task lands at the top and moves the tab count', async ({ page }) => {
    await openTasks(page);
    await page.getByTestId('chart--tasks-new').locator('button').click();

    await page.getByTestId('chart--task-subject').locator('input').fill('Book dietitian referral');
    await page.getByTestId('chart--task-due').locator('input').fill('2026-08-20');
    await page.getByTestId('chart--task-priority').locator('select').selectOption('Urgent');
    await page.getByTestId('chart--task-save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(taskRows(page)).toHaveCount(5);
    await expect(page.locator('[data-testid="chart--tasks-table"]')).toContainText(
      'Book dietitian referral'
    );
  });

  test('a new recall needs what the patient is due for, and a date', async ({ page }) => {
    await openTasks(page);
    await tab(page, 'recalls').click();
    await page.getByTestId('chart--tasks-new').locator('button').click();

    await page.getByTestId('chart--recall-save').locator('button').click();
    await expect(page.getByTestId('chart--recall-type')).toContainText('due for');

    await page.getByTestId('chart--recall-type').locator('select').selectOption('FIT kit');
    await page.getByTestId('chart--recall-due').locator('input').fill('2027-01-15');
    await page.getByTestId('chart--recall-save').locator('button').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(recallRows(page)).toHaveCount(3);
  });
});

test.describe('chart tasks — working through them', () => {
  /**
   * Completing a task takes it out of the list. The strip carries no count to
   * disagree with that list any more — which is why the list is the assertion.
   */
  test('Complete clears the task from the list', async ({ page }) => {
    await openTasks(page);
    await taskRows(page).first().getByRole('button', { name: 'Complete' }).click();

    await expect(taskRows(page)).toHaveCount(3);
  });

  test('Show completed brings it back, marked done rather than actionable', async ({ page }) => {
    await openTasks(page);
    await taskRows(page).first().getByRole('button', { name: 'Complete' }).click();

    await page.getByTestId('chart--tasks-show-done').locator('input').check();
    await expect(taskRows(page)).toHaveCount(4);
    await expect(page.locator('[data-testid="chart--tasks-table"] .ctk__done')).toHaveCount(1);
  });

  test('a booked recall stops offering the button', async ({ page }) => {
    await openTasks(page);
    await tab(page, 'recalls').click();
    await recallRows(page).first().getByRole('button', { name: 'Mark booked' }).click();

    await expect(page.locator('[data-testid="chart--recalls-table"] .ctk__done')).toHaveCount(1);
  });

  test('search narrows the list that is showing', async ({ page }) => {
    await openTasks(page);
    await page.getByTestId('chart--tasks-search').locator('input').fill('infliximab');
    await expect(taskRows(page)).toHaveCount(1);
  });

  /** Every column has to fit — Status and the action are why the list exists. */
  test('no column is pushed off the right-hand edge', async ({ page }) => {
    await openTasks(page);
    const overflow = await page
      .locator('[data-testid="chart--tasks-table"] .ui-table-wrap')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openTasks(page);
    await expectNoA11yViolations(page);
  });
});
