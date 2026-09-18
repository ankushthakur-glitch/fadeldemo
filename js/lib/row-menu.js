/**
 * openRowMenu() — the "⋮" panel at the end of a table row.
 *
 * Nine screens had grown their own copy of this: create a div, set
 * .ui-row-menu on it, build the items, measure the trigger, flip the panel
 * above when the row is near the bottom, write the geometry into a generated
 * stylesheet, focus the first item, then wire Escape, an outside pointerdown
 * and a resize to tear it all down again. Fifty lines each, roughly four
 * hundred and fifty in total, and they had already drifted — some closed on
 * resize, some did not; some restored focus to the trigger, some left it on
 * <body>.
 *
 * It is one function now, and the panel it opens is <ui-menu>, which already
 * owns the part that is genuinely hard: role="menu", the roving focus, the
 * arrow keys wrapping past the ends, Home/End, and the disabled items the
 * keyboard has to skip rather than land on.
 *
 *   import { openRowMenu } from '../lib/row-menu.js';
 *
 *   openRowMenu(trigger, [
 *     { label: 'View details', icon: 'eye', run: () => open(row) },
 *     { divider: true },
 *     { label: 'Delete', icon: 'trash', danger: true, run: () => remove(row) },
 *   ]);
 *
 * Only one row menu is ever open. Opening a second closes the first, which is
 * what every one of the nine copies did and is the only sane behaviour for a
 * control anchored to a row that might scroll away.
 */

import { registerOverlay } from './overlay.js';

const PANEL_ID = 'ui-row-menu-panel';
const SHEET_ID = 'ui-row-menu-geometry';
const GAP = 4;
const EDGE = 8;

/** @type {{ trigger: HTMLElement, panel: HTMLElement, dismiss: () => void } | null} */
let live = null;
/** Removes this panel from the overlay register — see js/lib/overlay.js. */
let release = null;
/** Cancels the pending arm of the scroll/resize teardown — see armReflow(). */
let disarmReflow = null;

function sheet() {
  let style = document.getElementById(SHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = SHEET_ID;
    document.head.append(style);
  }
  return style;
}

/** Anchored under the trigger and right-aligned to it; flipped above when the
    row sits too near the bottom of the window to show the panel below. */
function place(trigger, panel) {
  const box = trigger.getBoundingClientRect();
  const height = panel.offsetHeight;
  const width = panel.offsetWidth;

  const below = window.innerHeight - box.bottom;
  const top =
    below < height + GAP + EDGE
      ? Math.max(EDGE, box.top - height - GAP)
      : box.bottom + GAP;
  const left = Math.max(
    EDGE,
    Math.min(box.right - width, window.innerWidth - EDGE - width)
  );

  sheet().textContent =
    `#${PANEL_ID}{` +
    `--row-menu-left:${Math.round(left)}px;` +
    `--row-menu-top:${Math.round(top)}px;` +
    `}`;
}

export function closeRowMenu({ refocus = false } = {}) {
  if (!live) return;
  const { trigger, panel } = live;
  live = null;
  release?.();
  release = null;

  panel.remove();
  sheet().textContent = '';
  trigger.setAttribute('aria-expanded', 'false');

  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('pointerdown', onOutside, true);
  disarmReflow?.();
  disarmReflow = null;
  window.removeEventListener('resize', onReflow, true);
  window.removeEventListener('scroll', onReflow, true);

  if (refocus && trigger.isConnected) trigger.focus();
}

function onKey(event) {
  if (event.key === 'Escape') closeRowMenu({ refocus: true });
}

function onOutside(event) {
  if (!live) return;
  if (live.panel.contains(event.target) || live.trigger.contains(event.target)) return;
  closeRowMenu();
}

/* A row menu is anchored to a row. Once the page moves under it the anchor is
   a lie, so it closes rather than chasing — which is what a menu attached to a
   scrolling table should do. */
function onReflow() {
  closeRowMenu();
}

/*
 * ARMED ON THE NEXT FRAME, NOT THIS ONE.
 *
 * A scroll event is not dispatched when scrollTop changes; it is dispatched in
 * the browser's next rendering update. So the scroll that brought the row into
 * view in the first place — a keyboard tab down a long list, a click on a row
 * the page had to scroll to reach — lands AFTER the click handler that opened
 * this menu has finished, and onReflow closes a menu that nothing has actually
 * moved under. The list in Print Configuration is fifty-three cards inside its
 * own scroller, and it did this every time: menu open, one frame, menu gone.
 *
 * requestAnimationFrame is exactly the right seam. The rendering update runs
 * the scroll steps BEFORE the animation frame callbacks, so a scroll already
 * in flight is delivered while nothing is listening, and the listener attaches
 * immediately after it. A scroll the person makes next still closes the menu,
 * which is the behaviour that was wanted.
 */
function armReflow() {
  const armed = requestAnimationFrame(() => {
    // Nothing to arm if the menu closed inside that frame.
    if (!live) return;
    window.addEventListener('resize', onReflow, true);
    window.addEventListener('scroll', onReflow, true);
  });
  return () => cancelAnimationFrame(armed);
}

/**
 * @param {HTMLElement} trigger  the "⋮" button
 * @param {Array<{label?: string, icon?: string, danger?: boolean,
 *                disabled?: boolean, divider?: boolean,
 *                run?: (trigger: HTMLElement) => void,
 *                onSelect?: (trigger: HTMLElement) => void,
 *                testid?: string}>} items
 * @param {{testid?: string}} [options]  a data-testid for the panel itself,
 *   for the handful of callers whose tests reach for the panel rather than
 *   for an item inside it.
 */
export function openRowMenu(trigger, items, options = {}) {
  closeRowMenu();
  if (!items || !items.length) return;

  const panel = document.createElement('ui-menu');
  panel.id = PANEL_ID;
  panel.className = 'ui-row-menu-panel';
  if (options.testid) panel.dataset.testid = options.testid;
  /* Set as a property, not an attribute: the items carry functions, and a
     JSON attribute would drop them. ui-menu reads either. */
  panel.items = items.map((item, index) => ({
    id: String(index),
    label: item.label,
    description: item.description,
    icon: item.icon,
    trailing: item.trailing,
    disabled: item.disabled,
    divider: item.divider,
    testid: item.testid,
    status: item.danger ? 'critical' : item.status,
  }));

  document.body.append(panel);
  live = { trigger, panel };

  panel.addEventListener('ui-select', (event) => {
    const chosen = items[Number(event.detail.id)];
    closeRowMenu({ refocus: true });
    /* The nine copies had settled on two names for the same callback. Both are
       honoured rather than renaming fifty call sites for the sake of tidiness. */
    (chosen?.run ?? chosen?.onSelect)?.(trigger);
  });
  panel.addEventListener('ui-close', () => closeRowMenu({ refocus: true }));

  trigger.setAttribute('aria-expanded', 'true');
  place(trigger, panel);
  panel.querySelector('.ui-menu__item:not(:disabled)')?.focus();

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
  disarmReflow = armReflow();
  release = registerOverlay(() => closeRowMenu());
}
