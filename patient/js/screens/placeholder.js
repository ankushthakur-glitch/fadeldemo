/**
 * The catch-all for sections the design names but does not draw.
 *
 * Reads ?section= from the address, highlights the matching nav entry, and
 * says what is missing. See the long note in placeholder.html for why this
 * exists rather than a dead link or a disabled menu item.
 */

import { mountShell } from '../lib/shell.js';

/**
 * Section name → the nav id to highlight.
 *
 * EMPTY, and that is the current truth rather than an oversight.
 *
 * Both sections that ever landed here — Education Material and Notification
 * Setting — were named in the design and never drawn, so each row only ever
 * led to this page. Both rows are gone. The addresses still answer, because
 * an old link should explain itself rather than 404, but neither highlights
 * anything: the nav must not claim you are somewhere it no longer offers.
 *
 * The map stays because it is how a re-added section would light its row —
 * one line, keyed by the label so the links in shell.js read as English
 * (?section=Notification%20Setting) rather than as internal ids.
 */
const NAV_IDS = {};

document.addEventListener('DOMContentLoaded', () => {
  const section = new URLSearchParams(location.search).get('section') || '';

  const mounted = mountShell({ active: NAV_IDS[section] ?? '' });
  if (!mounted) return;

  const title = document.getElementById('placeholderTitle');
  const body = document.getElementById('placeholderBody');

  if (section) {
    title.textContent = section;
    body.textContent =
      `${section} is named in the navigation but no screen for it was supplied ` +
      'in the design reference this portal was built from. Everything else in ' +
      'the menu is built and working.';
    document.title = `${section} — MediNova Clinic Patient Portal`;
  } else {
    body.textContent =
      'This address does not name a section. Use the navigation on the left.';
  }
});
