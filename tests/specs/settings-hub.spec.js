/**
 * The Settings hub — cards that link straight to a section, not just to the
 * module's front door.
 */
import { test, expect } from '@playwright/test';
import {
  failOnConsoleErrors,
  expectNoA11yViolations,
} from '../helpers/page-helpers.js';

const HUB = '/screens/settings.html';

test.describe('settings hub', () => {
  test('renders cleanly', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(HUB);
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    assertClean();
  });

  /**
   * A card that contains links must NOT itself be a link — nesting anchors is
   * invalid and hides the inner ones from assistive tech.
   */
  test('cards are containers, not anchors', async ({ page }) => {
    await page.goto(HUB);
    const card = page.getByTestId('settings--appointment-card');
    expect(await card.evaluate((el) => el.tagName)).toBe('SECTION');
    await expect(card.locator('a')).toHaveCount(5); // title + four sections
  });

  /**
   * A section row lines up under the icon above it — the title sits further
   * right, past the icon, so it is not the reference point here. A plain
   * <ul> keeps the browser's 40px indent unless it is zeroed, which left
   * rows visibly pushed right of the icon instead of under it.
   */
  test('link rows are left aligned with the card icon', async ({ page }) => {
    await page.goto(HUB);
    const card = page.getByTestId('settings--appointment-card');

    const edges = await card.evaluate((el) => {
      const textLeft = (sel) => {
        const node = el.querySelector(sel);
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().left;
      };
      return {
        icon: el.querySelector('.ui-hub__icon').getBoundingClientRect().left,
        link: textLeft('.ui-hub__links a'),
      };
    });

    expect(Math.round(edges.link)).toBe(Math.round(edges.icon));
  });

  test('the card heading opens the module', async ({ page }) => {
    await page.goto(HUB);
    await page.getByTestId('settings--appointment').click();
    await page.waitForURL('**/appointment-settings.html');
    await expect(
      page.getByRole('heading', { name: 'Appointment Settings' })
    ).toBeAttached();
  });

  const APPOINTMENT_SECTIONS = [
    ['settings--apt-availability', 'availability', 'Availability'],
    ['settings--apt-types', 'types', 'Appointment Types'],
    ['settings--apt-colors', 'colors', 'Appointment Status'],
    ['settings--apt-cancellation', 'cancellation', 'Cancellation Policy'],
  ];

  for (const [testid, tab, label] of APPOINTMENT_SECTIONS) {
    test(`Appointment → ${label} opens on that tab`, async ({ page }) => {
      await page.goto(HUB);
      await page.getByTestId(testid).click();
      await page.waitForURL(`**/appointment-settings.html?tab=${tab}`);

      await expect(page.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    });
  }

  const PRACTICE_SECTIONS = [
    ['settings--prc-profile', 'profile', 'Profile'],
    ['settings--prc-locations', 'locations', 'Locations'],
    ['settings--prc-users', 'users', 'Users'],
  ];

  for (const [testid, tab, label] of PRACTICE_SECTIONS) {
    test(`Practice → ${label} opens on that tab`, async ({ page }) => {
      await page.goto(HUB);
      await page.getByTestId(testid).click();
      await page.waitForURL(`**/practice-settings.html?tab=${tab}`);

      await expect(page.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    });
  }

  /*
   * BILLING ▸ FEE SCHEDULE HAS LEFT THE HUB.
   *
   * A code's price is part of the code now: the Procedure list carries a dated
   * schedule per code, professional and facility side by side. A separate
   * screen for the same numbers was a second place to look and a second place
   * for them to disagree, and whoever is pricing a procedure is already
   * standing on it.
   *
   * Asserted rather than simply deleted, because the failure this guards
   * against is the card coming back by accident — a hub entry is cheap to add
   * and the second home for a price is exactly what was removed.
   */
  test('the hub offers no separate Fee Schedule', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByTestId('settings--bst-fee')).toHaveCount(0);
    await expect(page.getByTestId('settings--billing-card')).toHaveCount(0);
    await expect(page.locator('.ui-hub__grid')).not.toContainText('Fee Schedule');
  });

  /** Where a price is set instead. */
  test('Master → Procedure is the tab that carries the fee schedule', async ({ page }) => {
    await page.goto(HUB);
    await page.getByTestId('settings--mst-cpt').click();
    await page.waitForURL('**/master.html?tab=cpt');

    await expect(page.getByRole('tab', { name: 'Procedure' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByTestId('mst--add').click();
    await expect(page.getByRole('dialog')).toContainText('Fee Schedule');
  });

  /**
   * This used to assert that Templates said "Not in this prototype
   * yet" instead of offering a link that goes nowhere. It was the last unbuilt
   * card, so the guarantee is now the stronger one: every card on the hub
   * leads somewhere real.
   *
   * The rule it enforces has not changed — a card either works or says it does
   * not. This is the half that is still true, and it fails loudly if a card is
   * ever added with a dead link rather than the honest marker.
   */
  test('every card leads somewhere, and none offers a dead link', async ({ page }) => {
    await page.goto(HUB);

    const cards = page.locator('.ui-hub__card');
    const total = await cards.count();
    expect(total).toBeGreaterThan(4);

    for (let i = 0; i < total; i += 1) {
      const card = cards.nth(i);
      const title = (await card.locator('.ui-hub__title').innerText()).trim();
      // Either it links, or it is explicitly marked as not built. Never both,
      // and never neither.
      const links = await card.locator('a').count();
      const marked = await card.locator('.ui-hub__soon').count();
      expect(links > 0 || marked > 0, `"${title}" neither links nor says it is unbuilt`).toBe(true);
    }

    await expect(page.locator('.ui-hub__grid a[href="#"]')).toHaveCount(0);
  });

  test('Templates opens the templates screen', async ({ page }) => {
    await page.goto(HUB);
    await page.getByTestId('settings--templates').click();

    await page.waitForURL('**/templates.html');
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeAttached();
  });

  /**
   * Master has eight tabs — more than any other card. It used to cap its list
   * at 13rem and scroll the rest out of sight, because a card that grew to fit
   * them dragged the two cards sharing its flex row down with it. Nothing
   * shares a row now, so the cap is gone: every section is on the card, and the
   * card is simply taller than its neighbours.
   */
  test('the Master card shows every tab without an internal scrollbar', async ({
    page,
  }) => {
    await page.goto(HUB);
    const master = page.getByTestId('settings--master-card');
    const list = master.locator('.ui-hub__links');

    await expect(list.locator('a')).toHaveCount(8);
    await expect(page.getByTestId('settings--mst-recall')).toBeInViewport();

    const clipped = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(clipped, 'no row should be hidden behind a scrollbar').toBe(false);
  });

  /**
   * ONE MODULE HEIGHT, THE WAY THE REFERENCE DRAWS IT.
   *
   * A hub is read by scanning across it, and a ragged lower edge makes the eye
   * do the work of a rule. Every card is the height of the tallest — Master's
   * eight sections — whether it lists eight or one, and the room left over
   * sits under the list. `grid-auto-rows: 1fr` is what does it; an
   * `align-items: start` anywhere in this block opts every card back out.
   */
  test('every card is the same height, whatever it holds', async ({ page }) => {
    await page.goto(HUB);

    const heights = await page
      .locator('.ui-hub__card')
      .evaluateAll((cards) => cards.map((el) => Math.round(el.getBoundingClientRect().height)));

    expect(heights.length).toBeGreaterThan(4);
    expect(new Set(heights).size, `cards differ in height: ${heights.join(', ')}`).toBe(1);
  });

  /**
   * And that height is the tallest card's CONTENT, not an arbitrary figure:
   * Master's last section is on the card, not clipped by it.
   */
  test('the shared height is set by the fullest card', async ({ page }) => {
    await page.goto(HUB);
    const master = page.getByTestId('settings--master-card');

    const [height, content] = await master.evaluate((el) => [
      Math.round(el.getBoundingClientRect().height),
      Math.round(el.scrollHeight),
    ]);

    expect(height).toBeGreaterThanOrEqual(content);
  });

  /**
   * Five tracks at the width the design is drawn at — the reference's own
   * count. The old fixed-width flex cards capped the field at four and left a
   * column of empty page down the right-hand edge.
   */
  test('the field fills the page width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(HUB);

    const tracks = await page
      .locator('.ui-hub__grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

    expect(tracks).toBe(5);
  });

  test('the last of Master\'s eight sections navigates', async ({ page }) => {
    await page.goto(HUB);
    await page.getByTestId('settings--mst-recall').click();
    await page.waitForURL('**/master.html?tab=recall');
    await expect(page.getByRole('tab', { name: 'Recall Type' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(HUB);
    await expectNoA11yViolations(page);
  });

  /**
   * The clock in the app bar is masked. It counts real elapsed time from a
   * persisted timesheet, so its digits roll over partway through a long run —
   * which made this test pass alone and fail in a full-suite run, for a reason
   * that has nothing to do with the hub.
   */
  test('visual — settings hub', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.locator('.ui-hub__grid')).toBeVisible();
    await expect(page).toHaveScreenshot('settings-hub.png', {
      mask: [page.locator('ui-time-clock')],
    });
  });
});
