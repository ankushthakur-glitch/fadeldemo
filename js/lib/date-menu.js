/**
 * THE DATE PICKER, DRAWN BY THE PAGE.
 *
 * Every date field in this product is a real <input type="date">, and the
 * calendar it opened was drawn by the operating system: Chrome's panel on
 * Windows, a different one on macOS, a full-screen wheel on iOS. The closed
 * field wore MediNova's shell — our height, our radius, our border and our focus
 * ring — and then opened into a control that shares none of it. The same
 * complaint select-menu.js was written to answer, for the same reason, and
 * <ui-date-picker> already existed to answer it: it was just never wired to
 * anything outside the gallery.
 *
 * This opens it instead. One panel, parented to <body>, anchored under the
 * field.
 *
 * WHAT THIS DOES NOT CHANGE
 * The <input> stays where it was and keeps its value, its name, its min and
 * max, its events and its role. `input.value` still answers in yyyy-mm-dd, a
 * `change` listener still fires, and a screen that rebuilds its markup gets
 * the picker for free because nothing is registered per field — the opener is
 * delegated from the document.
 *
 * Typing is untouched. The native field's own day/month/year segments still
 * take the keyboard, so a fast typist never has to see a calendar; the panel
 * is for the people who want to look at a month.
 *
 * A field that must keep the platform picker — a date of birth on a phone,
 * where the native wheel is genuinely better — opts out with
 * `data-native-picker`.
 *
 * HOW IT OPENS
 * A press is caught in the CAPTURE phase and cancelled, so the panel opens on
 * the way down and the field never takes the press. Cancelling mousedown also
 * cancels the focus that comes with it, so focus is moved by hand.
 *
 * BOTH HALVES OF THE PRESS HAVE TO BE REFUSED, AND THE SECOND ONE IS THE ONE
 * THAT MATTERED. Cancelling mousedown alone left every date field opening TWO
 * calendars, one over the other: ours on the way down, and then Chrome's on
 * top of it a moment later. The platform panel is not the default action of
 * mousedown at all — Blink opens it from the default handler for CLICK, on the
 * calendar indicator inside the field's shadow DOM — and a cancelled mousedown
 * does nothing to stop a click from following it. So the click is cancelled
 * too. Blink skips a node's default handler once the event has been
 * defaultPrevented, which is the whole mechanism; propagation is left alone so
 * a screen listening for clicks on its own filter bar still hears them.
 *
 * The keyboard has its own way in — Alt+Down and F4 both ask Blink for the
 * platform panel — and those open ours instead.
 */

import { registerOverlay } from './overlay.js';

const PANEL_ID = 'ui-date-menu';
const SHEET_ID = 'ui-date-menu-geometry';
const GAP = 4;
const EDGE = 8;

/** @type {{ input: HTMLInputElement, panel: HTMLElement } | null} */
let live = null;
/** Removes this panel from the overlay register — see js/lib/overlay.js. */
let release = null;

function eligible(node) {
  return (
    node instanceof HTMLInputElement &&
    node.type === 'date' &&
    !node.disabled &&
    !node.readOnly &&
    !('nativePicker' in node.dataset)
  );
}

function sheet() {
  let style = document.getElementById(SHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = SHEET_ID;
    document.head.append(style);
  }
  return style;
}

function write({ top = 0, left = 0 }) {
  sheet().textContent =
    `#${PANEL_ID}{` +
    `--date-menu-left:${Math.round(left)}px;` +
    `--date-menu-top:${Math.round(top)}px;` +
    `}`;
}

function place() {
  if (!live) return;
  const { input, panel } = live;

  /* The field can go out from under an open panel: a screen that re-renders on
     some other event replaces its markup wholesale. */
  if (!input.isConnected) return close();

  const box = input.getBoundingClientRect();
  if (!box.width && !box.height) return close();

  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  if (box.bottom < 0 || box.top > viewportH) return close();

  const height = panel.offsetHeight;
  const width = panel.offsetWidth;

  const below = viewportH - box.bottom - GAP - EDGE;
  const dropsBelow = height <= below || below >= box.top - GAP - EDGE;

  const top = dropsBelow
    ? Math.min(box.bottom + GAP, viewportH - EDGE - height)
    : Math.max(EDGE, box.top - GAP - height);

  const left = Math.max(EDGE, Math.min(box.left, viewportW - EDGE - width));

  write({ top, left });
}

function close({ refocus = false } = {}) {
  if (!live) return;
  const { input, panel } = live;
  live = null;
  release?.();
  release = null;

  panel.remove();
  sheet().textContent = '';

  document.removeEventListener('pointerdown', onOutsidePointer, true);
  window.removeEventListener('resize', place, true);
  window.removeEventListener('scroll', place, true);

  if (refocus && input.isConnected) input.focus();
}

function onOutsidePointer(event) {
  if (!live) return;
  if (live.panel.contains(event.target) || event.target === live.input) return;
  close();
}

function open(input) {
  close();

  const panel = document.createElement('ui-date-picker');
  panel.id = PANEL_ID;
  panel.className = 'ui-date-menu';
  if (input.value) panel.setAttribute('value', input.value);
  if (input.min) panel.setAttribute('min', input.min);
  if (input.max) panel.setAttribute('max', input.max);

  document.body.append(panel);
  live = { input, panel };

  panel.addEventListener('ui-change', (event) => {
    input.value = event.detail.value;
    /* Both events, in the order a person typing would produce them. A screen
       listening on either one cannot tell the difference between this and a
       date entered by hand, which is the whole point. */
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close({ refocus: true });
  });

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close({ refocus: true });
    }
  });

  document.addEventListener('pointerdown', onOutsidePointer, true);
  window.addEventListener('resize', place, true);
  window.addEventListener('scroll', place, true);
  /* A dialog that closes takes its calendar with it. Without this the panel
     outlives the modal it was opened from and hangs over an empty page. */
  release = registerOverlay(() => close());

  place();
  /* Focus the day the calendar opened on, so the arrows work immediately
     rather than after a Tab nobody knows to press. */
  panel.querySelector('.ui-datepicker__day[tabindex="0"]')?.focus();
}

/** The date field a press or a keystroke landed on, if it is one of ours. */
function fieldAt(target) {
  const input = target instanceof Element
    ? target.closest('input[type="date"]')
    : null;
  return eligible(input) ? input : null;
}

document.addEventListener(
  'mousedown',
  (event) => {
    const input = fieldAt(event.target);
    if (!input) return;

    /* Refuse the platform panel, then do the focus the browser was going to
       do. Without this the field never takes focus at all. */
    event.preventDefault();
    input.focus();

    if (live && live.input === input) close({ refocus: true });
    else open(input);
  },
  true
);

/**
 * The click that follows, cancelled before it reaches the field.
 *
 * This is the one that was drawing the second calendar. See the chapter above:
 * the platform panel comes out of Blink's default handler for click on the
 * indicator, so mousedown having been cancelled is no protection at all.
 *
 * Only the default action is refused. The event still bubbles, because a click
 * on a date field is an ordinary click as far as the rest of the page is
 * concerned and screens hang their own listeners off the toolbars these fields
 * sit in.
 */
document.addEventListener(
  'click',
  (event) => {
    if (fieldAt(event.target)) event.preventDefault();
  },
  true
);

document.addEventListener(
  'keydown',
  (event) => {
    /* Escape closes the open panel, whatever has focus. */
    if (live && event.key === 'Escape') return close({ refocus: true });

    /* Alt+Down and F4 are how the platform panel is asked for from the
       keyboard. They now ask for this one — refused first, so the two cannot
       both answer, which is the same stacking the click above produced. */
    const wantsPicker =
      (event.altKey && event.key === 'ArrowDown') || event.key === 'F4';
    if (!wantsPicker || event.ctrlKey || event.metaKey) return;

    const input = fieldAt(event.target);
    if (!input) return;

    event.preventDefault();
    if (live && live.input === input) close({ refocus: true });
    else open(input);
  },
  true
);
