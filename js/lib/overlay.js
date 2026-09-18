/**
 * A register of the panels that float above the page.
 *
 * Three things in this product parent a panel to <body> rather than to the
 * thing that opened it — the dropdown list, the date calendar and the row menu
 * — and they do it for the same good reason: a panel inside a table cell gets
 * clipped by that table's own overflow, and a panel inside a dialog gets
 * clipped by the dialog.
 *
 * The cost of that is an orphan. The panel is no longer a descendant of what
 * it belongs to, so when the dialog closes, the calendar it opened is still
 * sitting there over an empty page with nothing to return to.
 *
 * So each of them registers how to close itself, and anything that tears down
 * a surface — a modal closing, a drawer closing — calls closeOverlays() first.
 * It is deliberately not an event on document: an event can be missed by a
 * listener that has not been added yet, and this has to work on the first open
 * of the first dialog on a cold page.
 *
 *   const release = registerOverlay(() => close());
 *   … later, when the panel closes for its own reasons …
 *   release();
 */

/** @type {Set<() => void>} */
const open = new Set();

/**
 * Note that a panel is open, and how to shut it.
 * @param {() => void} close
 * @returns {() => void} call when the panel closes by any other route
 */
export function registerOverlay(close) {
  open.add(close);
  return () => open.delete(close);
}

/**
 * Shut every floating panel.
 *
 * Each close function removes itself from the set as it runs, so the set is
 * copied first — iterating a Set while its members delete themselves from it
 * is how you skip one.
 */
export function closeOverlays() {
  for (const close of [...open]) {
    open.delete(close);
    close();
  }
}

/** Whether anything is currently floating. Used to decide who owns Escape. */
export function hasOpenOverlay() {
  return open.size > 0;
}
