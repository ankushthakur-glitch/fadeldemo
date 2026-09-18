/**
 * Task Management — five worklists behind one tab strip.
 *
 * The tests concentrate on the things a screenshot cannot show: that each
 * worklist filters and sorts independently, that a refill cannot be denied
 * without a reason, and that acting on a row in one tab is visible in
 * another.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';
import { openFilter, tickFilter, doneFilter } from '../helpers/filter.js';

/** One tick in the worklist's filter panel. The panel serves every tab. */
async function tick(page, group, value) {
  await openFilter(page, 'tsk--filter');
  await tickFilter(page, group, value);
}

const TASKS = '/screens/tasks.html';

const rows = (page, testid) => page.getByTestId(testid).locator('tbody tr');

/* data/tasks.js seeds.

   These are the footer's numbers: every list here holds more than a page and
   more than one status, and the footer counts the whole list rather than the
   outstanding part of it. The tab strip used to carry a second count per
   worklist — outstanding work only — which is why several of these once came
   in pairs; the strip is plain labels now, so one number per list is enough.
   The exceptions are the counts a filter has narrowed, which are named for
   what the filter leaves behind. */
const ALL_TASKS = 46; //     the whole list, as the footer counts it
const MY_TASKS = 22; //      mine, future-dated hidden by default
const MY_TASKS_ALL = 23; //  mine with future-dated shown
const RECALLS = 22;
const AWAITING_REFILLS = 9; // still awaiting a decision, and all on page one
const LAB_ORDERS = 22;
const PRESCRIPTIONS = 22;

/* Each worklist carries the shared pager (lib/pagination.js), so a table holds
   a PAGE of its list rather than all of it. Lists longer than a page are
   asserted through the footer's range; only a list a filter has narrowed below
   one is counted by its rows. */
const PAGE_SIZE = 15;

/** The footer's range line for a tab — 'tsk-all--range', 'tsk-mine--range'. */
const range = (page, tab) => page.getByTestId(`tsk-${tab}--range`);

test.describe('task management — the shell', () => {
  test('opens on All tasks with every worklist reachable', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(TASKS);

    for (const label of ['All tasks', 'My tasks', 'Recalls', 'Refill requests', 'Orders']) {
      await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /All tasks/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(rows(page, 'tsk--all-table')).toHaveCount(PAGE_SIZE);
    await expect(page.getByTestId('tsk-all--range')).toContainText(
      `1-${PAGE_SIZE} of ${ALL_TASKS} tasks`
    );

    assertClean();
  });

  /**
   * Completing a task is a status change on the row, not a row removal: the
   * list still holds it, so the only place the change can show is the cell.
   *
   * It goes through the comment dialog, from the row menu as from the detail
   * panel — a move made from a row is no less worth a sentence than the same
   * move made from the panel, and leaving the shortcut silent would mean the
   * trail recorded a comment or not depending on which control was nearer the
   * mouse. The comment itself is optional, which is what this asserts by
   * pressing Complete without typing one.
   */
  test('completing a task marks the row complete', async ({ page }) => {
    await page.goto(TASKS);

    await rows(page, 'tsk--all-table').first().locator('[data-menu]').click();
    await page.locator('.tsk__dropdown-item', { hasText: 'Mark complete' }).click();

    await expect(page.locator('#taskStepModal')).toBeVisible();
    await expect(page.getByTestId('tsk--step-subject')).toContainText('TK-');
    await page.getByTestId('tsk--step-confirm').click();

    await expect(rows(page, 'tsk--all-table').first()).toContainText('Completed');
  });

  /**
   * Start and Complete are the two moments when the person holding a task
   * knows something the task does not. Both used to write one fixed line into
   * the trail, so the next person to open a closed task read "A. Mensah
   * completed this task" and had to ring somebody to find out what happened.
   */
  test('starting a task records the comment against the step', async ({ page }) => {
    await page.goto(TASKS);

    // The detail panel, which is where the primary verb lives.
    await rows(page, 'tsk--all-table').first().locator('[data-open]').click();
    const pane = page.getByTestId('tsk--pane');
    await expect(pane).toBeVisible();

    await page.getByTestId('tsk--pane-step').click();
    await expect(page.locator('#taskStepModal')).toHaveAttribute('heading', 'Start task');

    await page
      .getByTestId('tsk--step-comment')
      .locator('textarea')
      .fill('Left a voicemail, will retry tomorrow.');
    await page.getByTestId('tsk--step-confirm').click();

    await expect(pane.locator('.tsk__tl-comment')).toContainText('Left a voicemail');
    await expect(pane.getByTestId('tsk--pane-step')).toContainText('Complete');
  });

  /**
   * THE PANEL'S SECOND LIST — the place a question about a task can go.
   *
   * Until it existed the only way to say anything about a task was to move it:
   * both step dialogs take a comment, and both are a comment you can only
   * leave at the moment the task changes state. "Did anyone reach her?" had
   * nowhere to sit, so it was asked in the corridor and never came back to the
   * record.
   *
   * Newest first, which is the assertion that matters here: the panel is a
   * narrow column below six facts and two buttons, and the line the next
   * person needs is the last one said.
   */
  test('the thread takes a comment and puts it at the top', async ({ page }) => {
    await page.goto(`${TASKS}?task=TK-4412`);

    const pane = page.getByTestId('tsk--pane');
    await expect(pane).toBeVisible();

    // The panel opens on the trail, and the thread is a tab away.
    await expect(page.getByTestId('tsk--pane-timeline')).toBeVisible();
    await page.getByRole('tab', { name: 'Comments' }).click();

    const thread = page.getByTestId('tsk--pane-comments');
    await expect(thread).toBeVisible();
    await expect(page.getByTestId('tsk--pane-timeline')).toBeHidden();
    await expect(thread.locator('.tsk__cmt').first()).toContainText('K. Brandt, RN');

    /* The box is one line until it is used, so the thread starts near the top
       of the panel rather than below an empty rectangle the depth of two
       comments. Its buttons arrive with the room to write in. */
    await expect(page.getByTestId('tsk--comment-post')).toBeHidden();

    const box = page.getByTestId('tsk--comment-box').locator('textarea');
    await box.click();
    await expect(page.getByTestId('tsk--comment-post')).toBeVisible();

    await box.fill('Rang her — happy to wait for the letter.');
    await page.getByTestId('tsk--comment-post').click();

    await expect(thread.locator('.tsk__cmt').first()).toContainText('Rang her');
    await expect(thread.locator('.tsk__cmt').first()).toContainText('Dr. A. Mensah');
    // The box is cleared, so the next comment is not written on top of the
    // last one.
    await expect(box).toHaveValue('');
  });

  /**
   * TWO LISTS, NOT ONE SPLIT IN HALF.
   *
   * The timeline is what was done to the task and every line in it is a fixed
   * phrase; the thread is people talking. A comment therefore leaves no trail
   * entry — "Dr. A. Mensah commented on this task" tells the reader nothing
   * the tab beside it does not, while making the trail noisier the more the
   * task is discussed.
   *
   * And the tab that is open is a way of reading, not a fact about the task,
   * so it survives the next row being opened — otherwise somebody working
   * through a morning's comments presses Comments again on every task.
   */
  test('a comment stays out of the timeline, and the open list follows you', async ({ page }) => {
    await page.goto(`${TASKS}?task=TK-4412`);

    await page.getByRole('tab', { name: 'Comments' }).click();
    await page
      .getByTestId('tsk--comment-box')
      .locator('textarea')
      .fill('Chased the duplicate fax.');
    await page.getByTestId('tsk--comment-post').click();
    await expect(page.getByTestId('tsk--pane-comments')).toContainText('Chased the duplicate fax');

    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByTestId('tsk--pane-timeline')).not.toContainText('commented');
    await expect(page.getByTestId('tsk--pane-timeline')).not.toContainText('duplicate fax');

    // Back to the thread, then on to another task — which opens on the thread.
    await page.getByRole('tab', { name: 'Comments' }).click();
    await page.getByTestId('tsk--pane-close').click();
    await rows(page, 'tsk--all-table').first().locator('[data-open]').click();

    await expect(page.getByTestId('tsk--pane-comments')).toBeVisible();
    await expect(page.getByTestId('tsk--pane-timeline')).toBeHidden();
  });

  test('the open tab is carried in the URL', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByRole('tab', { name: /Recalls/ }).click();

    await expect(page).toHaveURL(/tab=recalls/);

    // …and a link straight to a tab opens on it.
    await page.goto(`${TASKS}?tab=refills`);
    await expect(page.getByRole('tab', { name: /Refill requests/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('the main nav reaches this screen', async ({ page }) => {
    await page.goto('/screens/patient-directory.html');
    await page.locator('.pt__nav').getByRole('link', { name: 'Tasks', exact: true }).click();
    await expect(page).toHaveURL(/tasks\.html/);
  });
});

test.describe('task management — All tasks', () => {
  test('carries the reference columns', async ({ page }) => {
    await page.goto(TASKS);
    const head = page.getByTestId('tsk--all-table').locator('thead');

    for (const column of [
      'Task', 'Patient', 'Subject', 'Priority',
      'Source', 'Assigned to', 'From', 'Due', 'Status',
    ]) {
      await expect(head).toContainText(column);
    }
  });

  /** A task past its due date reads as overdue whatever its stored status. */
  test('an overdue task says so, and says by how long', async ({ page }) => {
    await page.goto(TASKS);
    const row = rows(page, 'tsk--all-table').filter({ hasText: 'Marion Delacroix' });

    await expect(row).toContainText('Overdue');
    await expect(row).toContainText(/Overdue \d+ d/);
  });

  test('search covers patient, subject and task ID', async ({ page }) => {
    await page.goto(TASKS);
    const table = rows(page, 'tsk--all-table');
    const search = page.getByTestId('allSearch').locator('input');

    await search.fill('Reilly');
    await expect(table).toHaveCount(1);

    await search.fill('unsigned');
    await expect(table).toHaveCount(1);
    await expect(table.first()).toContainText('Daniel Okonkwo');

    await search.fill('TK-4412');
    await expect(table).toHaveCount(1);

    await search.fill('');
    await expect(table).toHaveCount(PAGE_SIZE);
    await expect(page.getByTestId('tsk-all--range')).toContainText(`of ${ALL_TASKS} tasks`);
  });

  test('typing in search does not steal focus', async ({ page }) => {
    await page.goto(TASKS);
    const search = page.getByTestId('allSearch').locator('input');

    await search.click();
    await page.keyboard.type('pathology');

    await expect(search).toBeFocused();
    await expect(search).toHaveValue('pathology');
  });

  /**
   * Asserted as "every remaining row matches", not as a row count: the seeded
   * task list grows as the prototype does, and a hard-coded number tests when
   * the demo data was last edited rather than whether the filter works.
   */
  test('the filters narrow the list and combine', async ({ page }) => {
    await page.goto(TASKS);
    const table = rows(page, 'tsk--all-table');

    const before = await table.count();
    /* High / Medium / Low, not STAT / Urgent / Routine — see TASK_PRIORITIES.
       The old words are a lab requisition's, and most of what this screen
       carries is not an order. */
    await tick(page, 'priority', 'High');

    const high = await table.count();
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(before);
    for (const text of await table.allInnerTexts()) expect(text).toContain('High');

    // Filters combine rather than replace one another.
    await tick(page, 'status', 'Overdue');
    const both = await table.count();
    expect(both).toBeLessThanOrEqual(high);
    for (const text of await table.allInnerTexts()) {
      expect(text).toContain('High');
      expect(text).toContain('Overdue');
    }
  });

  test('a header sorts the column', async ({ page }) => {
    await page.goto(TASKS);
    const ids = page.getByTestId('tsk--all-table').locator('tbody tr td:nth-child(1)');

    await page.getByRole('button', { name: 'Task', exact: true }).click();
    const ascending = (await ids.allInnerTexts()).map((v) => v.trim());
    expect(ascending).toEqual([...ascending].sort());

    /* Asserted as "this page is in order", not as the reverse of the other
       page: the list is paged, so page one ascending and page one descending
       are two different slices of it rather than one slice read both ways. */
    await page.getByRole('button', { name: 'Task', exact: true }).click();
    const descending = (await ids.allInnerTexts()).map((v) => v.trim());
    expect(descending).toEqual([...descending].sort().reverse());
    expect(descending[0]).not.toEqual(ascending[0]);
  });
});

test.describe('task management — My tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TASKS}?tab=mine`);
  });

  test('shows only my work, and drops the columns that would repeat', async ({ page }) => {
    await expect(rows(page, 'tsk--my-table')).toHaveCount(PAGE_SIZE);
    await expect(range(page, 'mine')).toContainText(`of ${MY_TASKS} tasks`);

    const head = page.getByTestId('tsk--my-table').locator('thead');
    await expect(head).toContainText('From');
    // "Assigned to" would be my own name on every row.
    await expect(head).not.toContainText('Assigned to');
  });

  /**
   * A list that opens with next February's work at the bottom trains people to
   * stop reading the bottom, so future-dated rows are hidden until asked for.
   */
  test('future-dated work is hidden until asked for', async ({ page }) => {
    await expect(page.getByTestId('tsk--my-table')).not.toContainText('Eleanor Sandoval');

    /* Future-dated is a filter — it hides rows — so it is a box in the panel
       with the rest of them rather than a pressed-state button below them. */
    await tick(page, 'future', 'on');
    await doneFilter(page);
    await expect(page.getByTestId('tsk--my-table')).toContainText('Eleanor Sandoval');
    await expect(range(page, 'mine')).toContainText(`of ${MY_TASKS_ALL} tasks`);
  });

  test('reassigning a task from All tasks makes it appear here', async ({ page }) => {
    await page.goto(TASKS);
    await rows(page, 'tsk--all-table')
      .filter({ hasText: 'Rebecca Mahoney' })
      .locator('[data-menu]')
      .click();
    await page.locator('.tsk__dropdown-item', { hasText: 'Reassign to me' }).click();

    await page.getByRole('tab', { name: /My tasks/ }).click();
    await expect(page.getByTestId('tsk--my-table')).toContainText('Rebecca Mahoney');
  });
});

test.describe('task management — Recalls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TASKS}?tab=recalls`);
  });

  test('states plainly that recalls are worked by hand today', async ({ page }) => {
    await expect(page.getByTestId('tsk--recall-note')).toContainText('no reminders');
    await expect(page.getByTestId('tsk--recall-note')).toContainText('by hand');
  });

  test('carries the recall columns, not the task ones', async ({ page }) => {
    const head = page.getByTestId('tsk--recall-table').locator('thead');

    for (const column of ['Recall', 'Due for', 'Interval', 'Provider', 'Location', 'Last contacted']) {
      await expect(head).toContainText(column);
    }
    // A recall has no assignee.
    await expect(head).not.toContainText('Assigned to');
    await expect(range(page, 'recalls')).toContainText(`of ${RECALLS} recalls`);
  });

  test('the filters narrow the list', async ({ page }) => {
    await tick(page, 'location', 'Clinic');
    await expect(rows(page, 'tsk--recall-table')).toHaveCount(9);

    await tick(page, 'provider', 'Dr. F. Nammour');
    await expect(rows(page, 'tsk--recall-table')).toHaveCount(1);
  });

  /** Generating letters only touches what is due or overdue. */
  test('Generate letters acts on the due and overdue rows only', async ({ page }) => {
    /* The dialog counts the whole filtered list; the table in front of it holds
       one page. Widen the page to the largest the shared pager offers so the
       two are counting the same rows — the recall list is well inside 50. */
    await page.getByTestId('tsk-recalls--rows-per-page').selectOption('50');

    /* Counted from the list rather than hard-coded, so adding a recall to the
       demo data does not turn this into a failing test about nothing — and
       counted from the STATUS badge rather than from the row's whole text,
       because "Overdue 47 d" also appears in the Due column of rows whose
       letter has already gone out. */
    const table = rows(page, 'tsk--recall-table');
    const targets = await table
      .filter({ has: page.locator('ui-badge', { hasText: /^(Due|Overdue)$/ }) })
      .count();
    expect(targets).toBeGreaterThan(0);

    await page.getByTestId('tsk--generate-letters').click();
    await expect(page.locator('#lettersBody')).toContainText(`${targets} recall`);
    await page.getByTestId('tsk--letters-confirm').click();

    await expect(page.locator('#tskFlash')).toContainText(`${targets} letter`);

    // The status moves to "Letter sent"; the Due column still reads overdue,
    // and correctly so — posting a letter does not make the patient less late.
    await expect(rows(page, 'tsk--recall-table').filter({ hasText: 'Margaret Iwuoha' }))
      .toContainText('Letter sent');
    // "Overdue" without the day count: the count is computed against today,
    // so pinning it would make this test fail every morning.
    await expect(rows(page, 'tsk--recall-table').filter({ hasText: 'Margaret Iwuoha' }))
      .toContainText(/Overdue \d+ d/);
    // "Upcoming" was not due yet, so it is untouched.
    await expect(rows(page, 'tsk--recall-table').filter({ hasText: 'Linda Charbonneau' }))
      .toContainText('Upcoming');
  });

  /** The header's own contextual action replaced a duplicate that used to
   *  live in this toolbar too — see paintHeaderAction in tasks.js. */
  test('New Recall lives in the header, not duplicated in the toolbar', async ({ page }) => {
    await expect(page.locator('#headerAction').getByTestId('tsk--new-recall')).toBeVisible();
    await expect(page.getByTestId('tsk--generate-letters')).toBeVisible();
    // Only one "add" control on this tab.
    await expect(page.getByRole('button', { name: /new recall/i })).toHaveCount(1);
  });

  /** Provider, Location, Type, Interval, Due date and Description all
   *  depend on who the recall is for, so they wait for a patient. */
  test('the rest of the Recall Form stays disabled until a patient is chosen', async ({
    page,
  }) => {
    await page.getByTestId('tsk--new-recall').click();

    for (const id of ['#recallProvider', '#recallLocation', '#recallType', '#recallInterval', '#recallDate']) {
      await expect(page.locator(id)).toHaveAttribute('disabled', '');
    }

    await page.getByTestId('tsk--recall-patient').locator('select').selectOption('Kate Morrison');

    for (const id of ['#recallProvider', '#recallLocation', '#recallType', '#recallInterval', '#recallDate']) {
      await expect(page.locator(id)).not.toHaveAttribute('disabled', '');
    }
  });

  test('a new recall needs a patient, provider, type and date', async ({ page }) => {
    await page.getByTestId('tsk--new-recall').click();
    await page.getByTestId('tsk--recall-save').click();

    // Every problem at once, not one per press of Save.
    await expect(page.getByTestId('tsk--recall-patient')).toContainText('Choose a patient');
    await expect(page.getByTestId('tsk--recall-provider')).toContainText('Choose a provider');
    await expect(page.getByTestId('tsk--recall-type')).toContainText('Choose a recall type');
    await expect(page.getByTestId('tsk--recall-date')).toContainText('Set a due date');
  });

  test('a completed recall form lands at the top of the list', async ({ page }) => {
    await page.getByTestId('tsk--new-recall').click();
    await page.getByTestId('tsk--recall-patient').locator('select').selectOption('Kate Morrison');
    await page.getByTestId('tsk--recall-provider').locator('select').selectOption('Dr. F. Nammour');
    await page
      .getByTestId('tsk--recall-type')
      .locator('select')
      .selectOption('Colonoscopy — surveillance');
    await page.getByTestId('tsk--recall-date').locator('input').fill('2027-03-01');
    await page.getByTestId('tsk--recall-save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(range(page, 'recalls')).toContainText(`of ${RECALLS + 1} recalls`);
    await expect(rows(page, 'tsk--recall-table').first()).toContainText('Kate Morrison');
  });

  test('a recall can raise a task, which appears in My tasks', async ({ page }) => {
    await rows(page, 'tsk--recall-table').first().locator('[data-menu]').click();
    await page.locator('.tsk__dropdown-item', { hasText: 'Create task' }).click();

    await page.getByRole('tab', { name: /My tasks/ }).click();
    await expect(page.getByTestId('tsk--my-table')).toContainText('Margaret Iwuoha');
  });
});

test.describe('task management — Refill requests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TASKS}?tab=refills`);
  });

  /** This queue is worked one row at a time; its two actions stay in the row. */
  test('awaiting rows offer Approve and Deny in the row itself', async ({ page }) => {
    const awaiting = rows(page, 'tsk--refill-table').filter({ hasText: 'Awaiting' });
    await expect(awaiting).toHaveCount(AWAITING_REFILLS);
    await expect(awaiting.first().getByRole('button', { name: 'Approve' })).toBeVisible();

    // A decided row has nothing left to decide.
    const decided = rows(page, 'tsk--refill-table').filter({ hasText: 'Approved' });
    await expect(decided.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('approving updates the row', async ({ page }) => {
    await rows(page, 'tsk--refill-table')
      .filter({ hasText: 'Thomas Reilly' })
      .getByRole('button', { name: 'Approve' })
      .click();

    await expect(
      rows(page, 'tsk--refill-table').filter({ hasText: 'Thomas Reilly' })
    ).toContainText('Approved');
  });

  /** A denial with no reason becomes a phone call later. */
  test('denying requires a reason and records it on the row', async ({ page }) => {
    await rows(page, 'tsk--refill-table')
      .filter({ hasText: 'Priya Raghunathan' })
      .getByRole('button', { name: 'Deny' })
      .click();

    await page.getByTestId('tsk--deny-confirm').click();
    await expect(page.getByTestId('tsk--deny-reason')).toContainText('Choose a reason');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page
      .getByTestId('tsk--deny-reason')
      .locator('select')
      .selectOption('Requires lab monitoring first');
    await page.getByTestId('tsk--deny-confirm').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    const row = rows(page, 'tsk--refill-table').filter({ hasText: 'Priya Raghunathan' });
    await expect(row).toContainText('Denied');
    await expect(row).toContainText('Requires lab monitoring first');
  });

  /** New Refill Request is the header's own contextual action on this tab —
   *  there was no way to add one from here before. */
  test('New Refill lives in the header and opens the New refill request dialog', async ({
    page,
  }) => {
    await expect(page.locator('#headerAction').getByTestId('tsk--new-refill')).toBeVisible();
    await page.getByTestId('tsk--new-refill').click();
    await expect(page.getByRole('dialog', { name: 'New refill request' })).toBeVisible();
  });

  /** Medication, Pharmacy, Prescriber and Detail all depend on who the
   *  refill is for, so they wait for a patient — same rule as Recall Form
   *  and New Lab Order. */
  test('the rest of New Refill Request stays disabled until a patient is chosen', async ({
    page,
  }) => {
    await page.getByTestId('tsk--new-refill').click();

    for (const id of ['#refillMedication', '#refillPharmacy', '#refillProvider', '#refillDetail']) {
      await expect(page.locator(id)).toHaveAttribute('disabled', '');
    }

    await page.getByTestId('tsk--refill-patient').locator('select').selectOption('Kate Morrison');

    for (const id of ['#refillMedication', '#refillPharmacy', '#refillProvider', '#refillDetail']) {
      await expect(page.locator(id)).not.toHaveAttribute('disabled', '');
    }
  });

  test('a new refill request needs a patient, medication, pharmacy and prescriber', async ({
    page,
  }) => {
    await page.getByTestId('tsk--new-refill').click();
    await page.getByTestId('tsk--refill-save').click();

    await expect(page.getByTestId('tsk--refill-patient')).toContainText('Choose a patient');
    await expect(page.getByTestId('tsk--refill-medication')).toContainText('Enter the medication');
    await expect(page.getByTestId('tsk--refill-pharmacy')).toContainText('Choose a pharmacy');
    await expect(page.getByTestId('tsk--refill-provider')).toContainText('Choose a prescriber');
  });

  test('a complete refill request lands at the top, awaiting a decision', async ({ page }) => {
    await page.getByTestId('tsk--new-refill').click();
    await page.getByTestId('tsk--refill-patient').locator('select').selectOption('Kate Morrison');
    await page.getByTestId('tsk--refill-medication').locator('input').fill('Metoprolol 50 mg');
    await page.getByTestId('tsk--refill-pharmacy').locator('select').selectOption('CVS — 13th Ave');
    await page.getByTestId('tsk--refill-provider').locator('select').selectOption('Dr. A. Mensah');
    await page.getByTestId('tsk--refill-save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('#tskFlash')).toContainText('Refill request added for Kate Morrison.');

    const table = rows(page, 'tsk--refill-table');
    await expect(table.first()).toContainText('Kate Morrison');
    await expect(table.first()).toContainText('Metoprolol 50 mg');
    await expect(table.first()).toContainText('Awaiting');
  });
});

test.describe('task management — Orders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${TASKS}?tab=orders`);
  });

  test('opens on Lab orders with its own columns', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Lab orders' })).toHaveAttribute('aria-selected', 'true');
    const head = page.getByTestId('tsk--order-table').locator('thead');

    for (const column of ['Order', 'Priority', 'Tests', 'Route', 'Ordering provider']) {
      await expect(head).toContainText(column);
    }
    await expect(rows(page, 'tsk--order-table')).toHaveCount(PAGE_SIZE);
    await expect(range(page, 'orders')).toContainText(`of ${LAB_ORDERS} lab orders`);
  });

  /** Two different objects behind one tab — the columns must change with it. */
  test('E-prescriptions swaps the columns, not just the rows', async ({ page }) => {
    await page.getByRole('tab', { name: 'E-prescriptions' }).click();

    const head = page.getByTestId('tsk--order-table').locator('thead');
    await expect(head).toContainText('Pharmacy');
    await expect(head).toContainText('Prescriber');
    // A prescription has no test count and no priority.
    await expect(head).not.toContainText('Tests');
    await expect(head).not.toContainText('Priority');
    await expect(rows(page, 'tsk--order-table')).toHaveCount(PAGE_SIZE);
    await expect(range(page, 'orders')).toContainText(`of ${PRESCRIPTIONS} prescriptions`);
  });

  test('a failed transmission says why', async ({ page }) => {
    await page.getByRole('tab', { name: 'E-prescriptions' }).click();
    const row = rows(page, 'tsk--order-table').filter({ hasText: 'Priya Raghunathan' });

    await expect(row).toContainText('Transmission error');
    await expect(row).toContainText('NCPDP mismatch');
  });

  /** New Lab Order is the header's own contextual action on this sub-tab —
   *  it used to be duplicated in the toolbar too. */
  test('New Lab Order lives in the header on Lab orders, and nothing lives there on E-prescriptions', async ({
    page,
  }) => {
    await expect(page.locator('#headerAction').getByTestId('tsk--new-lab-order')).toBeVisible();
    await expect(page.getByRole('button', { name: /new lab order/i })).toHaveCount(1);

    await page.getByRole('tab', { name: 'E-prescriptions' }).click();
    await expect(page.locator('#headerAction ui-button')).toHaveCount(0);
    // Refresh status is still its own, unrelated action.
    await expect(page.getByTestId('tsk--rx-refresh')).toBeVisible();
  });

  /** Ordering provider, Route, Priority and Tests all depend on who the
   *  order is for, so they wait for a patient. */
  test('the rest of New Lab Order stays disabled until a patient is chosen', async ({ page }) => {
    await page.getByTestId('tsk--new-lab-order').click();

    for (const id of ['#labProvider', '#labRoute', '#labPriority']) {
      await expect(page.locator(id)).toHaveAttribute('disabled', '');
    }
    await expect(page.locator('#labTests input').first()).toBeDisabled();

    await page.getByTestId('tsk--lab-patient').locator('select').selectOption('Emily Tran');

    for (const id of ['#labProvider', '#labRoute', '#labPriority']) {
      await expect(page.locator(id)).not.toHaveAttribute('disabled', '');
    }
    await expect(page.locator('#labTests input').first()).toBeEnabled();
  });

  test('a new lab order needs a patient, a provider and at least one test', async ({ page }) => {
    await page.getByTestId('tsk--new-lab-order').click();
    await page.getByTestId('tsk--lab-save').click();

    await expect(page.getByTestId('tsk--lab-patient')).toContainText('Choose a patient');
    await expect(page.getByTestId('tsk--lab-provider')).toContainText('Choose an ordering provider');
    await expect(page.locator('#labError')).toContainText('at least one test');
  });

  test('a complete lab order lands at the top with its test count', async ({ page }) => {
    await page.getByTestId('tsk--new-lab-order').click();
    await page.getByTestId('tsk--lab-patient').locator('select').selectOption('Emily Tran');
    await page.getByTestId('tsk--lab-provider').locator('select').selectOption('Dr. A. Mensah');

    const boxes = page.getByTestId('tsk--lab-tests').locator('input[type=checkbox]');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await boxes.nth(2).check();

    await page.getByTestId('tsk--lab-save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(rows(page, 'tsk--order-table').first()).toContainText('Emily Tran');
    await expect(rows(page, 'tsk--order-table').first()).toContainText('3 tests');
  });
});

test.describe('task management — New Task', () => {
  /* Both complaints are made by the field that has to change, and they are
     made in the order the form asks its questions: recipient, then subject. */
  test('refuses a task with no recipient and no subject', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    await page.getByTestId('tsk--send').click();
    await expect(page.getByTestId('tsk--recipient-picker')).toContainText(
      'Choose at least one recipient'
    );

    await page.getByTestId('tsk--recipient-self').click();
    await page.getByTestId('tsk--send').click();
    await expect(page.getByTestId('tsk--subject')).toContainText('Give the task a subject');
  });

  /**
   * "ME" ADDS, IT DOES NOT REPLACE.
   *
   * The commonest pairing in this dialog is somebody else and the person
   * typing — assign the chase, keep the copy — so a quick-pick that threw away
   * the name already chosen would make that the one thing it could not do.
   * The closed field is where the chosen set is read: select-menu.js draws a
   * face over the multiple <select>, so there is no chip row underneath
   * repeating what the field already says.
   */
  test('Self adds the signed-in user to whoever is already chosen', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    const picker = page.getByTestId('tsk--recipient-picker');
    await picker.locator('select').selectOption(['K. Brandt, RN']);
    await page.getByTestId('tsk--recipient-self').click();

    await expect(picker.locator('.ui-select-facade__text')).toHaveText(
      'Dr. A. Mensah, K. Brandt, RN'
    );
    await expect(page.getByTestId('tsk--recipients')).toHaveCount(0);
  });

  test('one task, for the one recipient, and it appears in the list', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    await page
      .getByTestId('tsk--recipient-picker')
      .locator('select')
      .selectOption(['K. Brandt, RN']);
    await page.getByTestId('tsk--patient').locator('select').selectOption('Kate Morrison');
    await page.getByTestId('tsk--subject').locator('input').fill('Chase outstanding histology');

    // One recipient is one task, which is what a person already assumes — so
    // the dialog says nothing about fan-out until there is fan-out to say.
    await expect(page.getByTestId('tsk--recipient-fanout')).toBeHidden();
    await page.getByTestId('tsk--send').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('ui-toast').first()).toContainText('Task sent to K. Brandt, RN.');
    await expect(page.getByTestId('tsk-all--range')).toContainText(
      `of ${ALL_TASKS + 1} tasks`
    );
  });

  /**
   * THREE NAMES ARE THREE TASKS, AND THE DIALOG SAYS SO FIRST.
   *
   * The field takes a set because the same work genuinely goes to two or three
   * people at once. What it must not do is what the old chip row did silently:
   * a task has an assignee, a status and a history, all of which are answers
   * about one person, so a set of names cannot be one task. It is a task each
   * — and the line under the picker says that before Send is pressed, rather
   * than a week later when somebody closes one of the three and the other two
   * stay open.
   */
  test('several recipients send a task each, and the dialog counts them first', async ({
    page,
  }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    await page
      .getByTestId('tsk--recipient-picker')
      .locator('select')
      .selectOption(['K. Brandt, RN', 'S. Okoro', 'Front desk']);

    await expect(page.getByTestId('tsk--recipient-fanout')).toHaveText(
      'Sends 3 separate tasks — one each, so each has its own status and history.'
    );

    await page.getByTestId('tsk--subject').locator('input').fill('Chase outstanding histology');
    await page.getByTestId('tsk--send').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    /* Semicolons, because half the names in this practice have a comma inside
       them and a comma-separated list of those reads as twice as many people
       as were written to. */
    await expect(page.locator('ui-toast').first()).toContainText(
      '3 tasks sent — one each to K. Brandt, RN; S. Okoro; and Front desk.'
    );
    await expect(page.getByTestId('tsk-all--range')).toContainText(
      `of ${ALL_TASKS + 3} tasks`
    );

    // Three rows, each owned by one person — not one row with three names on it.
    const top = rows(page, 'tsk--all-table');
    await expect(top.nth(0)).toContainText('Front desk');
    await expect(top.nth(1)).toContainText('S. Okoro');
    await expect(top.nth(2)).toContainText('K. Brandt, RN');
  });

  /** No Location field: it was asked of every task, defaulted to the first
   *  site, and read by nothing on this screen. */
  test('the New Task dialog does not ask for a location', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    await expect(page.getByTestId('tsk--location')).toHaveCount(0);
  });

  test('priority is three buttons — High, Medium, Low — and opens on Low', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    const priority = page.getByTestId('tsk--priority');
    await expect(priority.locator('input[type="radio"]')).toHaveCount(3);
    await expect(priority.locator('input:checked')).toHaveValue('low');
    await expect(priority.locator('.tsk__seg-item span')).toHaveText(['Low', 'Medium', 'High']);

    await priority.getByText('High').click();
    await page.getByTestId('tsk--recipient-self').click();
    await page.getByTestId('tsk--subject').locator('input').fill('Bleeding post-polypectomy');
    await page.getByTestId('tsk--send').click();

    await expect(rows(page, 'tsk--all-table').first()).toContainText('High');
  });

  test('Send & New keeps the dialog open and clears it', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();

    await page.getByTestId('tsk--recipient-self').click();
    await page.getByTestId('tsk--subject').locator('input').fill('First task');
    await page.getByTestId('tsk--send-new').click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('tsk--subject').locator('input')).toHaveValue('');
    // The recipients go with it: the next task is a new task, not a reply-all
    // to whoever the last one went to.
    await expect(
      page.getByTestId('tsk--recipient-picker').locator('.ui-select-facade__text')
    ).toHaveText('Search staff…');
    await expect(page.getByTestId('tsk--recipient-fanout')).toBeHidden();
  });
});

test.describe('task management — quality', () => {
  const TAB_CASES = [
    ['all', 'tsk--all-table'],
    ['mine', 'tsk--my-table'],
    ['recalls', 'tsk--recall-table'],
    ['refills', 'tsk--refill-table'],
    ['orders', 'tsk--order-table'],
  ];

  for (const [tab, testid] of TAB_CASES) {
    test(`no WCAG 2.1 A/AA violations — ${tab} @a11y`, async ({ page }) => {
      await page.goto(`${TASKS}?tab=${tab}`);
      await expect(rows(page, testid).first()).toBeVisible();
      await expectNoA11yViolations(page);
    });
  }

  test('no WCAG 2.1 A/AA violations in New Task @a11y', async ({ page }) => {
    await page.goto(TASKS);
    await page.getByTestId('tsk--new-task').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in New Refill Request @a11y', async ({ page }) => {
    await page.goto(`${TASKS}?tab=refills`);
    await page.getByTestId('tsk--new-refill').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — all tasks', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto(TASKS);
    await expect(rows(page, 'tsk--all-table')).toHaveCount(PAGE_SIZE);
    await expect(page.locator('.tsk__body')).toHaveScreenshot('tasks-all.png');
  });

  test('visual — recalls', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${TASKS}?tab=recalls`);
    await expect(rows(page, 'tsk--recall-table')).toHaveCount(PAGE_SIZE);
    await expect(page.locator('.tsk__body')).toHaveScreenshot('tasks-recalls.png');
  });
});
