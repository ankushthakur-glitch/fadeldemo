/**
 * Referral desk — the parts that were reported wrong.
 *
 * The screen is large and mostly untested; this covers the channel strip and
 * the two menus, which is where the reported faults were.
 */
import { test, expect } from '@playwright/test';

const SCREEN = '/screens/referrals.html';

/* Tabs are addressed by the value they carry rather than by their label: the
   label is wording and wording gets revised, but `email` is the thing the
   screen actually switches to. Same convention as the scheduler spec. */
const chan = (page, value) => page.locator(`#chanTabs [role="tab"][data-value="${value}"]`);
const dir = (page, value) => page.locator(`#dirTabs [role="tab"][data-value="${value}"]`);

test.describe('referrals — channel tabs', () => {
  /*
   * The reported bug: switching to Email changed the list underneath but left
   * Fax looking selected, because only the panes were repainted and not the
   * strip that reads its state from the same variable.
   */
  test('selecting Email marks Email as the selected tab', async ({ page }) => {
    await page.goto(SCREEN);

    const fax = chan(page, 'fax');
    const email = chan(page, 'email');

    await expect(fax).toHaveAttribute('aria-selected', 'true');
    await expect(email).toHaveAttribute('aria-selected', 'false');

    await email.click();

    await expect(email).toHaveAttribute('aria-selected', 'true');
    await expect(fax).toHaveAttribute('aria-selected', 'false');
  });

  test('and back again', async ({ page }) => {
    await page.goto(SCREEN);
    await chan(page, 'email').click();
    await chan(page, 'fax').click();

    await expect(chan(page, 'fax')).toHaveAttribute('aria-selected', 'true');
    await expect(chan(page, 'email')).toHaveAttribute('aria-selected', 'false');
  });

  test('the keyboard stays on the strip after switching', async ({ page }) => {
    await page.goto(SCREEN);
    await chan(page, 'email').click();
    // Selecting patches the strip in place, so the button that was clicked is
    // still the one under the keyboard — focus must not fall to body.
    await expect(chan(page, 'email')).toBeFocused();
  });
});

test.describe('referrals — direction tabs', () => {
  /* The two strips are different levels and must not look alike: Document
     In/Out is the screen's own sections, Fax/Email is a view of one of them. */
  test('direction is the primary strip and the channel one is not', async ({ page }) => {
    await page.goto(SCREEN);

    await expect(page.locator('#dirTabs .ui-tabs')).toHaveClass(/ui-tabs--primary/);
    await expect(page.locator('#chanTabs .ui-tabs')).not.toHaveClass(/ui-tabs--primary/);
  });

  test('switching direction resets the channel and relabels Create', async ({ page }) => {
    await page.goto(SCREEN);
    await chan(page, 'email').click();

    await dir(page, 'out').click();

    await expect(dir(page, 'out')).toHaveAttribute('aria-selected', 'true');
    // A channel count belongs to one direction, so the choice does not carry.
    await expect(chan(page, 'fax')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ref--create')).toContainText('Create Document Out');
  });

  /*
   * Either strip is a change of queue, and a record read out of one queue while
   * the list beside it shows another is the screen contradicting itself — with
   * the record, the loud half, the wrong one.
   */
  for (const [label, strip, value] of [
    ['direction', dir, 'out'],
    ['channel', chan, 'email'],
  ]) {
    test(`switching ${label} empties the reading pane`, async ({ page }) => {
      await page.goto(SCREEN);
      await page.locator('.ref__card').first().click();
      await expect(page.getByTestId('ref--empty')).toBeHidden();

      await strip(page, value).click();

      await expect(page.getByTestId('ref--empty')).toBeVisible();
      await expect(page.locator('.ref__card--on')).toHaveCount(0);
    });
  }

  test('a direction tab is a label and nothing else — no count, no icon', async ({ page }) => {
    await page.goto(SCREEN);
    for (const value of ['in', 'out']) {
      await expect(dir(page, value).locator('.ui-tabs__count')).toHaveCount(0);
      await expect(dir(page, value).locator('.ui-icon')).toHaveCount(0);
    }
    await expect(dir(page, 'in')).toHaveText('Document In');
    await expect(dir(page, 'out')).toHaveText('Document Out');
  });
});

test.describe('referrals — add-on menu', () => {
  const REMOVED = ['Assign & create triage', 'Mark complete', 'Archive'];
  const KEPT = ['Process document', 'Forward referral', 'Download original', 'Print'];

  async function openMenu(page) {
    await page.goto(SCREEN);
    // The menu is built for whichever referral is open, so one has to be.
    await page.locator('.ref__card').first().click();
    await page.locator('#addonBtn').locator('button').click();
    const menu = page.locator('#addonMenu');
    await expect(menu).toBeVisible();
    return menu;
  }

  test('no longer offers triage, mark complete or archive', async ({ page }) => {
    const menu = await openMenu(page);
    for (const label of REMOVED) {
      await expect(menu).not.toContainText(label);
    }
  });

  test('still offers the actions that remain', async ({ page }) => {
    const menu = await openMenu(page);
    for (const label of KEPT) {
      await expect(menu).toContainText(label);
    }
    await expect(menu).toContainText('Reject referral');
  });
});

test.describe('referrals — create', () => {
  test('offers no Mark as STAT control', async ({ page }) => {
    await page.goto(SCREEN);
    await page.locator('#createBtn').locator('button').click();

    const modal = page.locator('#createModal');
    await expect(modal).toBeVisible();
    await expect(modal).not.toContainText('Mark as STAT');
    await expect(page.getByTestId('ref--c-stat')).toHaveCount(0);
  });

  test('the channel radio reflects the choice', async ({ page }) => {
    await page.goto(SCREEN);
    await page.locator('#createBtn').locator('button').click();

    const group = page.getByTestId('ref--c-channel');
    await expect(group.locator('input[value="Fax"]')).toBeChecked();

    await group.locator('input[value="Email"]').check();
    await expect(group.locator('input[value="Email"]')).toBeChecked();
    await expect(group.locator('input[value="Fax"]')).not.toBeChecked();
  });
});
