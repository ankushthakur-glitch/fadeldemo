/**
 * THE PROFILE TAB BAR
 *
 * Profile, Insurance and Cards — the things a patient keeps about themselves
 * rather than about a visit.
 *
 * ONE ROW. The tab strip at the left, the screen's buttons hard right; this
 * used to be two rows — a strip, then a right-aligned .pp-actions bar under
 * it — which cost a band of height on every tab for no information. So this
 * function draws the whole bar, and a screen hands it the buttons that belong
 * to it. A screen with no buttons (there are none yet) simply omits them and
 * the bar is the same height.
 *
 * The reference puts the section name at the left of that row as well. It is
 * in the markup but not on screen — see SECTION below.
 *
 * THE STRIP IS THE PORTAL'S ONE STRIP. It used to be a .pp-tabs--seg variant
 * drawn only here, with the rest of the portal underlined; there is one shape
 * now — a boxed group with the open tab filled — and every strip in the
 * portal draws it. The modifier is gone with the divergence it named. See the
 * TABS block in css/components.css.
 *
 * PASSWORD IS NOT A TAB. It was one, over a panel that held a single row of
 * asterisks; the only thing you could do there was press the button in the
 * corner, which is the button that changes the password. A tab whose whole
 * content is the button that leaves it is a detour, so the button now sits in
 * this bar beside Edit Profile and the tab is gone. See screens/profile.js.
 *
 * INSURANCE MOVED HERE FROM BILLING. It sat as a fourth billing tab beside
 * Statements, Payment History and Cards, which reads as an accident of who
 * pays: a card on file is a way to pay a bill, but a policy is a fact about
 * the patient — the practice needs it to bill anyone at all, it is asked for
 * at registration alongside the address and the emergency contact, and it is
 * checked when it expires, not when a statement arrives. The billing tabs are
 * now all about money that has moved; every profile tab is about the record.
 *
 * CARD DETAILS IS THE THIRD TAB, as the reference draws it. It was a Billing
 * tab until now, and it moved here for the reason Insurance did one step
 * earlier: a saved card is something the patient keeps on file about
 * themselves, beside the policy that pays with it — the front desk asks for
 * both in the same breath at registration, and neither is an event. What is
 * left under Billing is money that actually moved: what is owed, and what was
 * paid.
 *
 * ⚠ It is defined in ONE strip. The line in PROFILE_TABS below is the whole
 * definition and BILLING_TABS no longer names it. A page reachable from two
 * strips that disagree about where it lives is worse than either arrangement.
 *
 * The tabs are LINKS, like every other strip in the portal (see
 * lib/billing-tabs.js for the fuller argument): each is an address, Back works
 * between them, and a bookmark lands on the tab it was made on.
 */

import { esc } from './format.js';

/**
 * The screen's heading — and it is NOT DRAWN.
 *
 * The reference prints the section name to the left of the strip. It was drawn
 * there and it has been taken out again: the sidebar already has Profile lit,
 * the tab beside it already says Profile Details, and a third copy of the word
 * on the same line is the row's widest element saying the least. Losing it
 * gives the tabs the left edge, which is where the eye goes first.
 *
 * It stays in the markup as the page's <h1>, visually hidden. A page still
 * needs one heading naming what it is, and the tabs cannot be it — they name
 * the views, not the section holding them.
 */
const SECTION = 'Profile';

/** The three, in the order they are drawn. */
export const PROFILE_TABS = [
  { id: 'profile', label: 'Profile Details', href: 'profile.html' },
  { id: 'insurance', label: 'Insurance Details', href: 'profile-insurance.html' },
  { id: 'cards', label: 'Card Details', href: 'profile-cards.html' },
];

/**
 * Draw the bar into a host element.
 *
 * @param {HTMLElement} host      the <div id="tabs"> in the page
 * @param {string}      active    id of the current tab — see PROFILE_TABS
 * @param {object}      [options]
 * @param {string}      [options.actions]  button markup for the right end
 */
export function profileTabs(host, active, { actions = '' } = {}) {
  if (!host) return;

  // A plain <div> of links, not role="tablist": the ARIA tab pattern
  // describes panels swapped by script and promises arrow-key movement
  // between them. These are ordinary links to ordinary pages, and
  // aria-current="page" already says which one you are on.
  host.className = 'pp-tabbar';
  host.innerHTML = `
    <h1 class="pp-sr-only">${esc(SECTION)}</h1>

    <div class="pp-tabs">
      ${PROFILE_TABS.map(
        (tab) => `
        <a class="pp-tab" href="${esc(tab.href)}"
          ${tab.id === active ? 'aria-current="page"' : ''}
          data-testid="profile--tab-${esc(tab.id)}">${esc(tab.label)}</a>`
      ).join('')}
    </div>

    ${actions ? `<div class="pp-tabbar__actions">${actions}</div>` : ''}
  `;
}
