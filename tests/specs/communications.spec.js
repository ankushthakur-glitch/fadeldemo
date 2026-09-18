/**
 * Communications — the four rules the screen is built around.
 *
 * Not a tour of the markup: each block below covers a decision that would be
 * silently wrong if it broke. The tab strip is tested the same way the referral
 * desk's is, because it is the same failure — repainting the list but not the
 * strip that reads its state from the same variable.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

const SCREEN = '/screens/communications.html';

/** The New Chat panel, opened the way a user opens it. */
async function openNewChat(page) {
  await page.locator('#newBtn').locator('button').click();
  const panel = page.getByTestId('comm--new-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/** Choose a conversation type in the panel. */
async function chooseType(page, value) {
  await page.getByTestId('comm--n-type').locator('select').selectOption(value);
}

test.describe('communications — main navigation', () => {
  test('every screen with the nav links to it', async ({ page }) => {
    await page.goto('/screens/dashboard.html');

    const link = page.locator('.pt__nav-item', { hasText: 'Communications' });
    await expect(link).toHaveAttribute('href', 'communications.html');

    await link.click();
    await expect(page).toHaveURL(/communications\.html$/);
    /* The name is in the head as a visually hidden <h1> — the tab strip
       carries the visible label — so the check is on the heading, not on the
       drawn title class that no longer exists here. */
    await expect(page.locator('h1')).toHaveText('Chats');
  });

  test('and marks itself as the current section', async ({ page }) => {
    await page.goto(SCREEN);
    const active = page.locator('.pt__nav-item--active');
    await expect(active).toHaveText('Communications');
    await expect(active).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('communications — the four filters', () => {
  test('load clean, on All, with a conversation already open', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(SCREEN);

    await expect(page.getByTestId('comm--kind-all')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('comm--blank')).toBeHidden();
    await expect(page.getByTestId('comm--stream')).toBeVisible();
    assertClean();
  });

  /*
   * A tab change is a change of section, and the conversation on the right
   * belongs to the section you just left. Leaving it open showed a patient's
   * messages beside a list of group chats — two claims about where you are,
   * the loud one wrong.
   */
  test('switching tab closes whatever was open', async ({ page }) => {
    await page.goto(SCREEN);
    await expect(page.getByTestId('comm--stream')).toBeVisible();

    await page.getByTestId('comm--kind-groups').click();

    await expect(page.getByTestId('comm--blank')).toBeVisible();
    await expect(page.getByTestId('comm--stream')).toBeHidden();
    await expect(page.locator('.comm__row--on')).toHaveCount(0);
  });

  test('Patients keeps only patient conversations', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--kind-patients').click();

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    // A patient row carries the Patient chip; a group row carries a member count.
    await expect(rows.locator('.comm__row-members')).toHaveCount(0);
    for (const row of await rows.all()) {
      await expect(row.locator('ui-badge')).toHaveText('Patient');
    }
  });

  test('Groups keeps only groups, each with its member count', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--kind-groups').click();

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    await expect(rows.locator('.comm__row-members')).toHaveCount(await rows.count());
  });

  test('Clinicians keeps only colleagues', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--kind-clinicians').click();

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    for (const row of await rows.all()) {
      await expect(row.locator('ui-badge')).not.toHaveText('Patient');
    }
  });

  /*
   * The referral desk's reported bug, guarded here before it can happen again:
   * the list changed underneath but the strip went on showing the tab you left.
   */
  test('the selected tab follows the list', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--kind-groups').click();

    await expect(page.getByTestId('comm--kind-groups')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('comm--kind-all')).toHaveAttribute('aria-selected', 'false');
    // The clicked button is replaced by the repaint; focus must not fall to body.
    await expect(page.getByTestId('comm--kind-groups')).toBeFocused();
  });
});

test.describe('communications — search and quick filters', () => {
  test('search matches a name', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--search').locator('input').fill('Henna');

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    for (const row of await rows.all()) {
      await expect(row).toContainText(/Henna|Care Coordination/);
    }
  });

  test('a search that matches nothing says so', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--search').locator('input').fill('zzzzz');

    await expect(page.locator('.comm__row')).toHaveCount(0);
    await expect(page.getByTestId('comm--list-empty')).toBeVisible();
  });

  test('Unread keeps only conversations with unread mail', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--quick-unread').click();
    await expect(page.getByTestId('comm--quick-unread')).toHaveAttribute('aria-pressed', 'true');

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    await expect(rows.locator('.comm__row-unread')).toHaveCount(await rows.count());
  });

  test('Urgent keeps only urgent conversations', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--quick-urgent').click();
    await expect(page.getByTestId('comm--quick-urgent')).toHaveAttribute('aria-pressed', 'true');

    const rows = page.locator('.comm__row');
    await expect(rows).not.toHaveCount(0);
    await expect(rows.locator('.comm__urgent')).toHaveCount(await rows.count());
  });
});

test.describe('communications — opening a conversation reads it', () => {
  test('the unread badge clears and the tab count follows', async ({ page }) => {
    await page.goto(SCREEN);

    // th-howard arrives with two unread messages.
    const row = page.getByTestId('comm--row-th-howard');
    await expect(row.locator('.comm__row-unread')).toHaveText(/2/);

    const before = await page.getByTestId('comm--kind-clinicians').textContent();
    await row.click();

    await expect(row.locator('.comm__row-unread')).toHaveCount(0);
    await expect(page.getByTestId('comm--kind-clinicians')).not.toHaveText(before);
  });

  test('a patient conversation offers the chart; a colleague has none', async ({ page }) => {
    await page.goto(SCREEN);

    await page.getByTestId('comm--row-th-henna').click();
    await expect(page.getByTestId('comm--profile')).toHaveAttribute(
      'href',
      'patient-chart.html?mrn=326486'
    );

    await page.getByTestId('comm--row-th-mccoy').click();
    await expect(page.getByTestId('comm--profile')).toHaveCount(0);
  });

  test('a group shows its members rather than a chart', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--row-th-care-coordination').click();

    await expect(page.locator('.comm__faces')).toBeVisible();
    await expect(page.getByTestId('comm--profile')).toHaveCount(0);
  });
});

test.describe('communications — sending', () => {
  test('a sent message joins the thread and the list preview', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--row-th-mccoy').click();

    const before = await page.locator('#stream .comm__msg').count();
    await page.getByTestId('comm--draft').fill('Pathology read — adding a line now.');
    await page.getByTestId('comm--send').click();

    await expect(page.locator('#stream .comm__msg')).toHaveCount(before + 1);
    await expect(page.locator('#stream .comm__msg').last()).toContainText('adding a line now');
    await expect(page.locator('#stream .comm__msg').last()).toHaveClass(/comm__msg--out/);
    await expect(page.getByTestId('comm--row-th-mccoy')).toContainText('adding a line now');
    await expect(page.getByTestId('comm--draft')).toHaveValue('');
  });

  test('an empty message is not sent', async ({ page }) => {
    await page.goto(SCREEN);
    await page.getByTestId('comm--row-th-mccoy').click();

    const before = await page.locator('#stream .comm__msg').count();
    await page.getByTestId('comm--draft').fill('   ');
    await page.getByTestId('comm--send').click();

    await expect(page.locator('#stream .comm__msg')).toHaveCount(before);
  });
});

test.describe('communications — new chat', () => {
  test('Start Chat waits until somebody is chosen', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    const start = page.getByTestId('comm--n-start').locator('button');
    await expect(start).toBeDisabled();

    await page.getByTestId('comm--n-pick-pt-326476').click();
    await expect(start).toBeEnabled();
  });

  test('a one-to-one chat takes one person, and the second replaces the first', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    await page.getByTestId('comm--n-pick-pt-326476').click();
    await page.getByTestId('comm--n-pick-pt-326474').click();

    await expect(page.locator('#nPicked ui-chip')).toHaveCount(1);
    await expect(page.locator('#nPicked')).toContainText('Andi Lane');
  });

  test('starting a chat creates the thread and opens it', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    await page.getByTestId('comm--n-pick-pt-326476').click();
    await page.getByTestId('comm--n-start').locator('button').click();

    await expect(page.getByTestId('comm--new-panel')).toBeHidden();
    // It lands on the Patients tab, because that is where it now lives.
    await expect(page.getByTestId('comm--kind-patients')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.comm__conv-name')).toContainText('Ethan Kim');
    await expect(page.locator('.comm__row--on')).toContainText('Ethan Kim');
  });

  /* Two threads with the same nurse is how half a conversation gets lost. */
  test('a chat that already exists is opened, not duplicated', async ({ page }) => {
    await page.goto(SCREEN);
    const before = await page.locator('.comm__row').count();

    await openNewChat(page);
    await chooseType(page, 'clinician');
    await page.getByTestId('comm--n-pick-u3').click();
    await page.getByTestId('comm--n-start').locator('button').click();

    await expect(page.locator('.comm__row')).toHaveCount(before);
    await expect(page.locator('.comm__row--on')).toContainText('Arlene McCoy');
  });

  test('the type decides who can be chosen', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    // Patient is the default: a colleague cannot be picked.
    await expect(page.getByTestId('comm--n-pick-u3')).toHaveCount(0);
    await expect(page.getByTestId('comm--n-pick-pt-326476')).toBeVisible();

    await chooseType(page, 'clinician');
    await expect(page.getByTestId('comm--n-pick-u3')).toBeVisible();
    await expect(page.getByTestId('comm--n-pick-pt-326476')).toHaveCount(0);
  });

  test('choosing a different type clears what was already picked', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    await page.getByTestId('comm--n-pick-pt-326476').click();
    await expect(page.locator('#nPicked ui-chip')).toHaveCount(1);

    await chooseType(page, 'clinician');
    await expect(page.locator('#nPicked ui-chip')).toHaveCount(0);
  });

  test('Escape closes the panel and returns the keyboard to its button', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('comm--new-panel')).toBeHidden();
    await expect(page.locator('#newBtn button')).toBeFocused();
  });
});

test.describe('communications — new group', () => {
  test('a group needs two people before it can be started', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);
    await chooseType(page, 'group');

    const start = page.getByTestId('comm--n-start').locator('button');
    await expect(page.getByTestId('comm--n-name')).toBeVisible();
    await expect(start).toBeDisabled();

    await page.getByTestId('comm--n-pick-pt-326476').click();
    await expect(start).toBeDisabled();

    await page.getByTestId('comm--n-pick-u3').click();
    await expect(start).toBeEnabled();
  });

  test('a named group is created, opened, and counts its members', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);
    await chooseType(page, 'group');

    await page.getByTestId('comm--n-pick-u3').click();
    await page.getByTestId('comm--n-pick-u2').click();
    await page.getByTestId('comm--n-pick-pt-326476').click();
    await page.getByTestId('comm--n-name').locator('input').fill('Friday Prep Calls');
    await page.getByTestId('comm--n-start').locator('button').click();

    await expect(page.getByTestId('comm--kind-groups')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.comm__conv-name')).toHaveText('Friday Prep Calls');
    await expect(page.locator('.comm__row--on .comm__row-members')).toContainText('3');
  });

  test('a group left unnamed is named from its members', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);
    await chooseType(page, 'group');

    await page.getByTestId('comm--n-pick-u3').click();
    await page.getByTestId('comm--n-pick-u2').click();
    await page.getByTestId('comm--n-start').locator('button').click();

    await expect(page.locator('.comm__conv-name')).toHaveText('Arlene, Esther');
  });

  test('a group may mix patients and colleagues', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);
    await chooseType(page, 'group');

    await expect(page.getByTestId('comm--n-pick-u3')).toBeVisible();
    await expect(page.getByTestId('comm--n-pick-pt-326476')).toBeVisible();
  });
});

test.describe('communications — accessibility', () => {
  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(SCREEN);
    await expectNoA11yViolations(page);
  });

  test('no violations with the New Chat panel open @a11y', async ({ page }) => {
    await page.goto(SCREEN);
    await openNewChat(page);
    await expectNoA11yViolations(page);
  });
});
