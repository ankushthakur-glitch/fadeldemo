/**
 * One header band, one order, on every Settings module.
 *
 * A settings module wears the same band as a worklist outside Settings —
 * .ui-page-head, the two slots, the fixed left-to-right reading of it — with
 * the tab strip added in the middle (see .ui-page-head--tabs in base.css):
 *
 *     ‹  its sections  · · · · · · · · · ·  what acts on the open one
 *
 * The module's NAME used to sit between the caret and the strip, on the
 * argument that a place you navigated into has to keep saying which place it
 * is. It no longer draws: you arrived by clicking that module's own card on
 * the hub, and the strip beside the caret lists that module's sections and
 * nothing else, so "Practice Settings" over Profile / Locations / Users was a
 * fifth thing to read before the first thing you came for. It survives as a
 * visually hidden <h1> in the lead slot and in the caret's aria-label — hence
 * `title: 'hidden'` below, which is asserted rather than assumed: hidden is
 * not the same as deleted, and a screen reader still has to hear it.
 *
 * Three modules had drifted out of that order by putting the action slot in
 * the markup ahead of the strip. The slot is pushed hard right by its own
 * `margin-left: auto`, so anything after it in the DOM lands to the RIGHT of
 * the buttons — Templates drew its two tabs past "Create New Template", at
 * the far edge of the window, where the eye reads them as belonging to the
 * button rather than naming the list below.
 *
 * Proven by POSITION rather than by DOM order on purpose: the order in the
 * file is only the mechanism, and a later flex or `order` rule could keep the
 * markup and still put the strip in the wrong place. What this pins is what a
 * user sees — every strip left of every action, and all of it inside one band.
 */
import { test, expect } from '@playwright/test';

/*
 * Every module that has a tab strip in its head band. Provider Availability
 * is reached from Appointment Settings rather than from the hub, and carries
 * no actions beside its strip — hence the empty `action`. It is also the one
 * module whose title still draws, because "Olivia Rhye Availability
 * Preferences" says the thing its two tabs cannot: whose week is open.
 */
const MODULES = [
  { name: 'Appointment Settings', url: '/screens/appointment-settings.html', action: 'apt--provider-filter', title: 'hidden' },
  { name: 'Master', url: '/screens/master.html', action: 'mst--search', title: 'hidden' },
  { name: 'Practice Settings', url: '/screens/practice-settings.html', action: 'prc--edit-profile', title: 'hidden' },
  { name: 'Provider Settings', url: '/screens/provider-settings.html', action: 'pvs--edit-profile', title: 'hidden' },
  { name: 'Templates', url: '/screens/templates.html', action: 'tpl--create', title: 'hidden' },
  { name: 'Provider Availability', url: '/screens/provider-availability.html', action: null, title: 'shown' },
];

test.describe('settings modules share one header band', () => {
  for (const mod of MODULES) {
    test(`${mod.name}: the way back, then sections, then actions`, async ({ page }) => {
      await page.goto(mod.url);

      const head = page.locator('.ui-page-head--tabs');
      const heading = head.locator('.ui-page-head__title').first();
      const band = await head.boundingBox();
      const back = await head.locator('.ui-page-head__back').boundingBox();
      const tabs = await page.locator('.ui-page-head--tabs ui-tabs').boundingBox();

      // Still named for assistive tech, whether or not it is drawn: the <h1>
      // is in the band either way, and only the class decides if it shows.
      if (mod.title === 'hidden') {
        await expect(heading).toHaveText(mod.name);
        await expect(heading).toHaveClass(/u-sr-only/);
        // Hidden means it takes no room — the strip starts where the caret
        // ends, with nothing between them.
        const title = await heading.boundingBox();
        expect(title.width).toBeLessThanOrEqual(1);
      } else {
        const title = await heading.boundingBox();
        expect(title.x).toBeGreaterThan(back.x);
        expect(tabs.x).toBeGreaterThan(title.x);
      }

      // The strip sits after the way back and inside the band with it — not
      // on a second row of its own, which is the shape this replaced.
      expect(tabs.x).toBeGreaterThan(back.x);
      expect(tabs.y).toBeGreaterThanOrEqual(band.y);
      expect(tabs.y + tabs.height).toBeLessThanOrEqual(band.y + band.height + 1);

      if (!mod.action) return;

      // …and whatever acts on the open section sits after the strip, on the
      // same line. One pixel of tolerance for sub-pixel layout, as elsewhere.
      const action = await page.getByTestId(mod.action).boundingBox();
      expect(action.x).toBeGreaterThan(tabs.x + tabs.width - 1);
      expect(action.y + action.height).toBeLessThanOrEqual(band.y + band.height + 1);
    });
  }

  /**
   * Billing Settings is the module with no strip, and it is in this file
   * because the band still has to hold the same shape without one.
   *
   * It has exactly one list — the fee schedule — so instead of a strip of one
   * tab it names the list in the title. The reading order is what survives
   * from the loop above with the middle term removed: the caret and the name
   * on the left, whatever acts on the list hard right, all of it on one band.
   */
  test('Billing Settings: name, then actions, with no strip', async ({ page }) => {
    await page.goto('/screens/billing-settings.html');

    const head = page.locator('.set__head');
    await expect(head).toHaveClass(/ui-page-head/);
    expect(await head.locator('ui-tabs').count()).toBe(0);

    const band = await head.boundingBox();
    const title = await head.locator('.ui-page-head__title').boundingBox();
    const action = await page.getByTestId('bst--fee-add').boundingBox();

    await expect(head.locator('.ui-page-head__title')).toHaveText('Fee Schedule');
    expect(action.x).toBeGreaterThan(title.x + title.width);
    expect(action.y + action.height).toBeLessThanOrEqual(band.y + band.height + 1);
  });

  /**
   * The action slot is the shared one, not a private copy. Master drew its
   * own (.mst__bar-actions) and forgot the auto margin, which left its search
   * box and Add button packed against the last tab while every other module's
   * sat at the right-hand edge of the window.
   */
  test('Master uses the shared action slot', async ({ page }) => {
    await page.goto('/screens/master.html');

    const band = await page.locator('.ui-page-head--tabs').boundingBox();
    const actions = await page.locator('.ui-page-head--tabs .ui-page-head__actions').boundingBox();

    expect(await page.locator('.mst__bar-actions').count()).toBe(0);
    // Hard right: the slot's trailing edge meets the band's, less its gutter.
    expect(actions.x + actions.width).toBeGreaterThan(band.x + band.width - 60);
  });
});
