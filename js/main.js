/**
 * Single entry point. Import this once per page and every ui-* tag on that
 * page upgrades itself.
 *
 *   <script type="module" src="js/main.js"></script>
 *
 * Relative paths throughout, so a page opened straight from the file system
 * resolves its imports — no server, no build step.
 */
import { installIconSprite } from './lib/icons.js';
/* The practice letterhead every printed page carries at the top of it. Imported
   here because every screen loads this file and none of them should have to
   remember: see js/lib/print-letterhead.js for why one element beats thirty
   edits. */
import { installPrintLetterhead } from './lib/print-letterhead.js';
/* Imported for its effect, not for anything it exports: it delegates from the
   document, so every <select> on the page — including the ones a screen has
   not rendered yet — opens the product's own list instead of the operating
   system's. See js/lib/select-menu.js. */
import './lib/select-menu.js';
/* Same trick, for the other control the platform used to draw: every
   <input type="date"> opens the product's own calendar. See js/lib/date-menu.js. */
import './lib/date-menu.js';

import './components/ui-button.js';
import './components/ui-badge.js';
import './components/ui-indicators.js';
import './components/ui-input.js';
import './components/ui-select.js';
/* The prose field with a formatting bar, for the one or two sections of a
   document that are long enough to want marking up. Registered here with the
   rest of the library rather than by the screen that uses it: a tag that
   exists on one page and silently does nothing on another is the hardest kind
   of component to debug. The styles are NOT global — a page links
   css/components/richtext.css when it has a field of this kind, the same way
   it links the sheet for every other component it uses. */
import './components/ui-richtext.js';
import './components/ui-icd10.js';
/* The short-list sibling of <ui-icd10>: type it or pick it, where the list is
   a handful already in memory rather than a catalogue that has to be searched.
   See the header of js/components/ui-suggest.js for which is which. */
import './components/ui-suggest.js';
import './components/ui-file-upload.js';
import './components/ui-choice.js';
import './components/ui-radio-group.js';
import './components/ui-alert.js';
import './components/ui-signature.js';
import './components/ui-tabs.js';
import './components/ui-modal.js';
import './components/ui-data-table.js';
import './components/ui-time-clock.js';
/* The app bar's section tabs. A tag rather than a call a screen's module has
   to make, so every screen that carries the bar carries the same nav. */
import './components/ui-main-nav.js';

/* The rest of the MediNova component library, ported from the Figma-derived
   React package. Grouped by what they are rather than alphabetically, because
   that is how you go looking for one. */
import './components/ui-radio.js';
import './components/ui-selection-card.js';
import './components/ui-slider.js';
import './components/ui-message.js';
import './components/ui-date-picker.js';
import './components/ui-menu.js';
import './components/ui-breadcrumb.js';
import './components/ui-command-bar.js';
import './components/ui-toast.js';
import './components/ui-tooltip.js';
import './components/ui-progress-bar.js';
import './components/ui-spinner.js';
import './components/ui-file-progress.js';
import './components/ui-avatar-group.js';
import './components/ui-text-link.js';
import './components/ui-divider.js';
import './components/ui-section-label.js';
import './components/ui-flag.js';
import './components/ui-filter.js';

installIconSprite();
installPrintLetterhead();

/**
 * Light/dark switch placeholder. Only the light theme is built so far; this
 * flips the attribute the semantic token layer will hang off when dark lands.
 */
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-theme-toggle]');
  if (!toggle) return;
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});
