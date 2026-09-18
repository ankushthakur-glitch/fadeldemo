/**
 * THE BILLING TAB STRIP
 *
 * Statements, Payment History, Cards and Insurance used to be four children
 * of a Billing dropdown in the sidebar. They are tabs on one screen now —
 * same addresses, but reachable from each other in one click rather than
 * three (open the chevron, find the row, click it).
 *
 * INSURANCE AND CARDS ARE NO LONGER AMONG THEM. Both are tabs of Profile now,
 * and lib/profile-tabs.js says why: a policy and a saved card are things the
 * patient keeps on file about themselves. What is left here is the two views
 * of money that has actually moved — what is owed, and what was paid.
 *
 * The tabs are LINKS, not buttons that swap a panel. That is the same choice
 * profile-tabs.js makes, and for the same reasons: each tab keeps its own
 * address, so Back works, a bookmark lands on the tab you bookmarked, and the
 * four screens stay four small files instead of one that knows all of them.
 *
 * The list below is the single place the set is defined. Adding a third
 * billing screen means adding a line here and a page — not editing two files
 * that each hard-code their siblings.
 *
 * NO ACTIONS SLOT, unlike the Profile bar. This strip briefly took button
 * markup, for the one billing screen that had a button of its own: Add Card.
 * That screen is a Profile tab now and lib/profile-tabs.js carries the slot;
 * neither table left here has anything to press above it, and a parameter
 * with no caller is a promise about a shape nobody is holding to.
 */

import { esc } from './format.js';

/** The two screens, in the order the design lists them. */
export const BILLING_TABS = [
  { id: 'statements', label: 'Statements', href: 'billing-statements.html' },
  { id: 'payments', label: 'Payment History', href: 'billing-payment-history.html' },
];

/**
 * Draw the strip into a host element.
 *
 * @param {HTMLElement} host    the <div id="tabs"> in the page
 * @param {string}      active  id of the current tab — see BILLING_TABS
 */
export function billingTabs(host, active) {
  if (!host) return;

  /*
   * A plain <div> of links, not role="tablist".
   *
   * The ARIA tab pattern describes panels swapped in place by script, and
   * comes with keyboard behaviour (arrow keys move between tabs) that these
   * do not have — they are ordinary links to ordinary pages. Claiming the
   * role without the behaviour is worse for a screen reader than not
   * claiming it: aria-current="page" already says which one you are on.
   */
  host.className = 'pp-tabs';
  host.innerHTML = BILLING_TABS.map(
    (tab) => `
    <a class="pp-tab" href="${esc(tab.href)}"
      ${tab.id === active ? 'aria-current="page"' : ''}
      data-testid="billing--tab-${esc(tab.id)}">${esc(tab.label)}</a>`
  ).join('');
}
