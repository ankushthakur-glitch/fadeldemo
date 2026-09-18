/**
 * THE DROPDOWN LIST, DRAWN BY THE PORTAL.
 *
 * Every dropdown here is a real <select>, and the list it opened used to be
 * drawn by the operating system: Chrome's grey slab on Windows, the
 * blue-highlighted panel on macOS, something else on a phone. The closed field
 * wore the portal's shell — 40px tall, 6px radius, our border, our green focus
 * ring — and then opened into a control that shares none of it. It was the one
 * surface in the portal the design did not own.
 *
 * This draws it instead: one panel, parented to <body>, the same white card
 * and rounded rows as everything else the portal opens over a page.
 *
 * A NOTE ON THE DUPLICATION
 * The EHR has its own copy at js/lib/select-menu.js. That is the deal this
 * directory is built on — see patient/README.md: the portal shares nothing
 * with the clinician product, so that portal work cannot regress the EHR and
 * an EHR token change cannot reach the portal. The two files are the same idea
 * written against two design systems; this one speaks --pp-*.
 *
 * WHAT THIS DOES NOT CHANGE
 * The <select> stays where it was and keeps its value, its name, its options
 * and its events. `select.value` still answers, a `change` listener still
 * fires, and a screen that rebuilds its markup gets the new list for free —
 * nothing is registered per field, the two openers below are delegated from
 * the document. A field that must keep the native list opts out with
 * `data-native-menu`.
 *
 * HOW IT OPENS
 * The press is caught in the CAPTURE phase and cancelled, which is what stops
 * the platform popup: the browser opens it on the default action of mousedown,
 * so the menu has to be refused before the control sees the event. Cancelling
 * mousedown also cancels the focus that comes with it, so focus is moved here.
 *
 * WHERE FOCUS GOES
 * Into the panel, which is a real listbox with a real active option — that is
 * what makes the replacement honest for a screen reader, which announces
 * "Male, 2 of 4" instead of watching a highlight it cannot see. Type-ahead,
 * Home/End, PageUp/PageDown and the arrows are re-implemented below because
 * the panel now owns the keyboard. Closing puts focus back on the field.
 */

const PANEL_ID = 'ppSelectMenu';
const SHEET_ID = 'ppSelectMenuPosition';

const GAP = 4; /* field to panel */
const EDGE = 8; /* panel to the edge of the window */
const MAX_HEIGHT = 300; /* ~7 rows before it scrolls inside itself */
const MIN_HEIGHT = 128; /* never squeezed below this — flip instead */
const TYPE_AHEAD_MS = 700;

/** The one open menu, or null. Two dropdowns can never be open at once. */
let live = null;

/* ===================== WHICH FIELDS GET ONE ===================== */

function eligible(node) {
  return (
    node instanceof HTMLSelectElement &&
    !node.disabled &&
    (node.multiple || node.size <= 1) &&
    node.options.length > 0 &&
    !('nativeMenu' in node.dataset)
  );
}

/* ===================== PICKING MORE THAN ONE ===================== */

/**
 * MULTIPLE, WITHOUT THE LIST BOX.
 *
 * The browser draws `<select multiple>` as a four-row scrolling box with no
 * caret, nothing like a .pp-select, and a selection made by ctrl-clicking —
 * which is knowledge a patient portal cannot assume anybody has. So the
 * element stays for what it is good at (it holds the options and the answers,
 * it posts with a form, `selectedOptions` still answers) and stops being what
 * is on screen.
 *
 * On screen is a button wearing the field's own shell, showing what has been
 * chosen, opening the same panel with a checkbox on every row.
 *
 * Done here rather than in the markup, so a screen that rebuilds its DOM — and
 * this portal's forms rebuild theirs constantly — gets it back without having
 * to say anything.
 */
const FACADE = 'pp-select-facade';

function facadeFor(select) {
  const existing = select.previousElementSibling;
  if (existing?.classList.contains(FACADE)) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${FACADE} pp-select`;
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'listbox');
  /* The <label> is `for` the select, which is now the half nothing can reach,
     so the name is copied onto the half that is on screen. */
  button.setAttribute('aria-label', accessibleName(select));
  select.classList.add('pp-select--faceted');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.parentNode.insertBefore(button, select);
  return button;
}

/** What the closed field reads: the answers, or the empty row's own label. */
function summarise(select) {
  const chosen = [...select.selectedOptions].filter((o) => o.value !== '');
  if (chosen.length) return chosen.map((o) => o.textContent.trim()).join(', ');
  const empty = [...select.options].find((o) => o.value === '');
  return empty ? empty.textContent.trim() : '';
}

function paintFacade(select) {
  const button = facadeFor(select);
  button.textContent = summarise(select);
  const answered = [...select.selectedOptions].some((o) => o.value !== '');
  /* Nothing chosen greys the way [data-empty] greys a .pp-select. */
  button.classList.toggle('is-empty', !answered);
  return button;
}

function upgradeAll(root = document) {
  root.querySelectorAll?.('select[multiple]:not([data-native-menu])').forEach((select) => {
    if (eligible(select)) paintFacade(select);
  });
}

new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('select[multiple]')) upgradeAll(node.parentNode ?? document);
      else upgradeAll(node);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => upgradeAll());
} else {
  upgradeAll();
}

/** The <option>s a person can actually see. `hidden` ones are not in the list. */
function visibleOptions(select) {
  return [...select.options].filter((option) => !option.hidden);
}

/** What to call the list, for anything that reads the screen aloud. */
function accessibleName(select) {
  return (
    select.getAttribute('aria-label') ||
    select.labels?.[0]?.textContent.trim() ||
    'Options'
  );
}

/* ===================== OPENING ===================== */

function openMenu(select, anchor = select) {
  close();

  const options = visibleOptions(select);
  if (!options.length) return;

  const multi = select.multiple;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = `pp-select-menu${multi ? ' pp-select-menu--multi' : ''}`;
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', accessibleName(select));
  if (multi) panel.setAttribute('aria-multiselectable', 'true');
  panel.tabIndex = -1;

  options.forEach((option, row) => {
    const item = document.createElement('div');
    item.id = `${PANEL_ID}-option-${row}`;
    item.className = 'pp-select-menu__option';
    item.setAttribute('role', 'option');
    item.dataset.index = String(option.index);
    /* The label goes in as TEXT. Option labels are data — an insurer with an
       ampersand in its name, a document type with a slash — and building the
       row with innerHTML would put that data back through the HTML parser. */
    if (multi && option.value !== '') {
      /* A real checkbox input, disabled so it cannot take the press or the
         focus the row already owns — the portal paints every
         input[type=checkbox] itself, so this is the same box the forms use
         rather than a second drawing of one. */
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'pp-select-menu__check';
      /* Not on the empty row — "None reported" is not a fourth condition that
         happens to be ticked, it is the row that clears the other three. */
      box.tabIndex = -1;
      box.setAttribute('aria-hidden', 'true');
      box.checked = option.selected;
      const text = document.createElement('span');
      text.className = 'pp-select-menu__label';
      text.textContent = option.textContent.trim() || ' ';
      item.append(box, text);
    } else {
      item.textContent = option.textContent.trim() || ' ';
    }

    const chosen = multi ? option.selected : option.index === select.selectedIndex;
    item.classList.toggle('is-placeholder', option.value === '');
    item.classList.toggle('is-selected', chosen);
    item.setAttribute('aria-selected', String(chosen));
    if (option.disabled) {
      item.classList.add('is-disabled');
      item.setAttribute('aria-disabled', 'true');
    }
    panel.appendChild(item);
  });

  /* INSIDE THE DIALOG, WHEN THERE IS ONE.
     Every modal in the portal is a native <dialog> opened with showModal(),
     which puts itself in the browser's TOP LAYER and makes the rest of the
     document inert. No z-index can reach over that, and focus cannot move into
     it — a panel parented to <body> is drawn behind the Upload Document box
     and refuses the keyboard. Parenting it to the dialog puts it inside the
     same top-layer subtree, where both work.

     It is still `position: fixed` and still measured against the viewport: the
     dialog only becomes a containing block for fixed children while its
     open animation is running, which is over long before anyone opens a
     dropdown inside it. And it lands on .pp-modal itself rather than on
     .pp-modal__body, which scrolls and would clip it. */
  const host = select.closest('dialog[open]') || document.body;
  host.appendChild(panel);

  const items = [...panel.children];
  const dialog = host instanceof HTMLDialogElement ? host : null;
  live = { select, anchor, multi, panel, items, dialog, active: -1, typed: '', typedAt: 0 };
  if (anchor !== select) anchor.setAttribute('aria-expanded', 'true');

  place();
  panel.focus({ preventScroll: true });

  /* Open on what is already chosen, so the first arrow key steps off the
     current answer rather than off the top of the list. */
  const start = items.findIndex((item) =>
    multi
      ? item.classList.contains('is-selected')
      : Number(item.dataset.index) === select.selectedIndex
  );
  setActive(start >= 0 ? start : firstEnabled(1, -1), { instant: true });

  panel.addEventListener('keydown', onPanelKey);
  panel.addEventListener('focusout', onPanelBlur);
  panel.addEventListener('pointermove', onPanelPointerMove);
  panel.addEventListener('click', onPanelClick);
  document.addEventListener('pointerdown', onOutsidePointer, true);
  window.addEventListener('resize', place);
  /* ESCAPE CLOSES ONE THING, AND IT IS THE LIST.
     A native <dialog> closes on Escape by itself — the browser's own close
     request, which no keydown listener can call off. Refusing its `cancel`
     event is the only way to hold the dialog open while a dropdown inside it
     takes the key. The listener comes off a tick after the menu closes, so
     the Escape that closed the list is still covered and the next one gets
     through to the dialog. */
  dialog?.addEventListener('cancel', refuseCancel);
  /* Capture, because the field may sit inside the content column or a sheet
     that scrolls on its own, and those scroll events never reach the window. */
  window.addEventListener('scroll', place, { capture: true, passive: true });
}

/**
 * Put the panel under the field — or over it, when the field is near the
 * bottom of the window.
 *
 * Coordinates arrive through a generated stylesheet keyed to the panel's id
 * rather than a style attribute, so nothing in the portal grows inline styles.
 */
function place() {
  if (!live) return;
  const { select, anchor, panel } = live;

  /* The field can go out from under an open menu: a screen that re-renders on
     some other event replaces its markup wholesale. */
  if (!select.isConnected || !anchor.isConnected) return close();

  /* Measured against the ANCHOR — the field itself for an ordinary dropdown,
     the face rather than the hidden element for a multiple one. This is also
     what makes the panel exactly as wide as the field it came out of. */
  const box = anchor.getBoundingClientRect();
  if (!box.width && !box.height) return close();

  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  /* Scrolled clean out of the window — there is nothing left to anchor to. */
  if (box.bottom < 0 || box.top > viewportH) return close();

  const below = viewportH - box.bottom - GAP - EDGE;
  const above = box.top - GAP - EDGE;

  // Pass one: commit the width and a height cap, then measure what that gives.
  write({
    width: box.width,
    maxHeight: Math.min(MAX_HEIGHT, Math.max(below, above, MIN_HEIGHT)),
  });

  const height = panel.offsetHeight;
  const width = panel.offsetWidth;

  const dropsBelow = height <= below || below >= above;
  const top = dropsBelow
    ? Math.min(box.bottom + GAP, viewportH - EDGE - height)
    : Math.max(EDGE, box.top - GAP - height);

  // Left-aligned to the field, pulled back in when a wide list runs off screen.
  const left = Math.max(EDGE, Math.min(box.left, viewportW - EDGE - width));

  write({
    width: box.width,
    maxHeight: Math.min(MAX_HEIGHT, Math.max(dropsBelow ? below : above, MIN_HEIGHT)),
    top,
    left,
    origin: dropsBelow ? 'top' : 'bottom',
  });
}

function write({ width, maxHeight, top = 0, left = 0, origin = 'top' }) {
  sheet().textContent =
    `#${PANEL_ID}{` +
    `--pp-select-menu-left:${Math.round(left)}px;` +
    `--pp-select-menu-top:${Math.round(top)}px;` +
    `--pp-select-menu-width:${Math.round(width)}px;` +
    `--pp-select-menu-max-height:${Math.round(maxHeight)}px;` +
    `--pp-select-menu-origin:${origin};` +
    `}`;
}

/** Hold the dialog open — see where this is bound, in openMenu(). */
function refuseCancel(event) {
  event.preventDefault();
}

/** One <style> element, created on first use. */
function sheet() {
  let el = document.getElementById(SHEET_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = SHEET_ID;
    document.head.appendChild(el);
  }
  return el;
}

/* ===================== CLOSING AND CHOOSING ===================== */

function close({ refocus = false } = {}) {
  if (!live) return;
  const { select, anchor, panel, dialog } = live;

  /* Cleared BEFORE the panel goes, so the focus move below cannot re-enter
     through the focusout handler. */
  live = null;

  panel.removeEventListener('keydown', onPanelKey);
  panel.removeEventListener('focusout', onPanelBlur);
  panel.removeEventListener('pointermove', onPanelPointerMove);
  panel.removeEventListener('click', onPanelClick);
  document.removeEventListener('pointerdown', onOutsidePointer, true);
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', place, { capture: true });
  if (dialog) setTimeout(() => dialog.removeEventListener('cancel', refuseCancel), 0);

  panel.remove();
  sheet().textContent = '';

  if (anchor !== select) anchor.setAttribute('aria-expanded', 'false');
  if (refocus && anchor.isConnected) anchor.focus({ preventScroll: true });
}

/**
 * Take an option, then tell the page in the words it already listens for.
 *
 * `input` then `change`, both bubbling, which is the pair a native <select>
 * fires and therefore the pair every screen in this portal is already wired
 * to — including the forms engine, which validates on change.
 */
function commit(index) {
  if (!live) return;
  const { select } = live;
  const option = select.options[index];
  if (!option || option.disabled) return;

  /* MORE THAN ONE ANSWER MEANS THE LIST STAYS OPEN.
     A row in a multiple select is a toggle, and closing on the first tick
     would make the second cost another trip to the field. The empty row is the
     exception: it is the answer that cancels the others, so taking it clears
     the rest and finishes. */
  if (live.multi) {
    const clearing = option.value === '';
    if (clearing) {
      [...select.options].forEach((o) => (o.selected = false));
    } else {
      option.selected = !option.selected;
      /* Any real answer cancels the empty one: the set is either empty or it
         is not, and both being true is not a state this can be left in. */
      [...select.options].forEach((o) => {
        if (o.value === '') o.selected = false;
      });
    }

    live.items.forEach((item) => {
      const chosen = select.options[Number(item.dataset.index)].selected;
      item.classList.toggle('is-selected', chosen);
      item.setAttribute('aria-selected', String(chosen));
      const box = item.querySelector('.pp-select-menu__check');
      if (box) box.checked = chosen;
    });
    paintFacade(select);

    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (clearing) close({ refocus: true });
    return;
  }

  const changed = select.selectedIndex !== index;
  select.selectedIndex = index;
  close({ refocus: true });
  if (!changed) return;

  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));

  /* A screen that repaints on change replaces the field we just handed focus
     back to. Follow it to its replacement rather than dropping a keyboard user
     on <body> halfway through a form. The id survives the repaint; the element
     does not. */
  if (select.isConnected || !select.id) return;
  const heir = document.getElementById(select.id);
  if (heir instanceof HTMLSelectElement) heir.focus({ preventScroll: true });
}

/* ===================== THE ACTIVE ROW ===================== */

function setActive(row, { instant = false } = {}) {
  if (!live || row < 0 || row >= live.items.length) return;
  live.items[live.active]?.classList.remove('is-active');
  live.active = row;
  const item = live.items[row];
  item.classList.add('is-active');
  live.panel.setAttribute('aria-activedescendant', item.id);
  item.scrollIntoView({ block: 'nearest', behavior: instant ? 'instant' : 'auto' });
}

/** The next row in `step` direction that can actually be chosen. */
function firstEnabled(step, from) {
  if (!live) return -1;
  for (let row = from + step; row >= 0 && row < live.items.length; row += step) {
    if (!live.items[row].classList.contains('is-disabled')) return row;
  }
  return -1;
}

function move(step) {
  const next = firstEnabled(step, live.active);
  if (next >= 0) setActive(next);
}

function moveTo(edge) {
  const next = edge === 'first' ? firstEnabled(1, -1) : firstEnabled(-1, live.items.length);
  if (next >= 0) setActive(next);
}

/**
 * Type-ahead, as the native list does it: letters typed within a beat of each
 * other are one prefix, and one letter typed over and over cycles through the
 * options starting with it.
 */
function typeAhead(char) {
  const now = performance.now();
  const fresh = now - live.typedAt > TYPE_AHEAD_MS;
  live.typedAt = now;
  live.typed = fresh ? char : live.typed + char;

  const cycling = live.typed.length > 1 && [...live.typed].every((c) => c === live.typed[0]);
  const prefix = (cycling ? live.typed[0] : live.typed).toLowerCase();
  const from = fresh || cycling ? live.active : live.active - 1;

  for (let step = 1; step <= live.items.length; step += 1) {
    const row = (from + step + live.items.length) % live.items.length;
    const item = live.items[row];
    if (item.classList.contains('is-disabled')) continue;
    if (item.textContent.trim().toLowerCase().startsWith(prefix)) return setActive(row);
  }
}

/* ===================== EVENTS ===================== */

/**
 * The press that opens the list — and the press that closes it again, because
 * a second click on a field with its menu already down must toggle rather than
 * reopen.
 */
document.addEventListener(
  'mousedown',
  (event) => {
    if (event.button !== 0) return;
    const { select, anchor } = fieldAt(event.target);
    if (!select) return;

    event.preventDefault();

    if (live?.select === select) return close({ refocus: true });
    anchor.focus({ preventScroll: true });
    openMenu(select, anchor);
  },
  true
);

/**
 * The dropdown a press landed on, as the pair (element that holds the answer,
 * element that is on screen). The same thing for an ordinary dropdown; a
 * multiple select's face is what was pressed and the hidden element behind it
 * is what will be changed.
 */
function fieldAt(target) {
  if (!(target instanceof Element)) return {};

  const face = target.closest(`.${FACADE}`);
  if (face) {
    const select = face.nextElementSibling;
    return select instanceof HTMLSelectElement && eligible(select)
      ? { select, anchor: face }
      : {};
  }

  const select = target.closest('select');
  return select && eligible(select) ? { select, anchor: select } : {};
}

/**
 * The keys that open the list from a focused field.
 *
 * Deliberately NOT the printable ones: typing at a closed <select> is native
 * type-ahead that picks a value outright, and that is better than anything
 * replacing it would be.
 */
document.addEventListener(
  'keydown',
  (event) => {
    if (live) return;
    const { select, anchor } = fieldAt(document.activeElement);
    if (!select || event.target !== anchor) return;
    if (event.ctrlKey || event.metaKey) return;

    const opens =
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' ';
    if (!opens) return;

    /* The face is a <button>: Enter and Space are its own activation keys and
       would fire a click straight back into the opener above, closing the
       panel in the same breath it opened. */
    event.stopPropagation();

    event.preventDefault();
    openMenu(select, anchor);
  },
  true
);

function onPanelKey(event) {
  if (!live) return;
  const { key } = event;

  if (key === 'Escape') {
    /* Stopped here. A dropdown opened inside a sheet is a list on top of a
       panel, and one Escape must close one of them — the list. */
    event.preventDefault();
    event.stopPropagation();
    return close({ refocus: true });
  }

  if (key === 'Tab') {
    /* Commit and get out of the way: the default action still runs, so focus
       moves on to the next field the way it would from a closed dropdown. */
    const index = Number(live.items[live.active]?.dataset.index);
    if (!live.multi && Number.isInteger(index)) commit(index);
    else close({ refocus: true });
    return;
  }

  if (key === 'Enter' || (key === ' ' && !live.typed)) {
    event.preventDefault();
    const index = Number(live.items[live.active]?.dataset.index);
    if (Number.isInteger(index)) commit(index);
    return;
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    if (event.altKey) return close({ refocus: true });
    return move(key === 'ArrowDown' ? 1 : -1);
  }

  if (key === 'Home' || key === 'End') {
    event.preventDefault();
    return moveTo(key === 'Home' ? 'first' : 'last');
  }

  if (key === 'PageDown' || key === 'PageUp') {
    event.preventDefault();
    const step = key === 'PageDown' ? 1 : -1;
    for (let n = 0; n < 10; n += 1) move(step);
    return;
  }

  if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    typeAhead(key);
  }
}

/** Focus left the panel for something that is not in it — the list is done. */
function onPanelBlur(event) {
  if (!live) return;
  if (event.relatedTarget && live.panel.contains(event.relatedTarget)) return;
  close();
}

/**
 * The row under the pointer becomes the active row.
 *
 * pointermove rather than mouseover: opening the menu under a stationary
 * cursor would otherwise fire mouseover and drag the highlight off the current
 * answer before the mouse had moved a pixel.
 */
function onPanelPointerMove(event) {
  const item = event.target.closest('.pp-select-menu__option');
  if (!item || item.classList.contains('is-disabled')) return;
  const row = live.items.indexOf(item);
  if (row >= 0 && row !== live.active) setActive(row);
}

function onPanelClick(event) {
  const item = event.target.closest('.pp-select-menu__option');
  if (!item || item.classList.contains('is-disabled')) return;
  commit(Number(item.dataset.index));
}

function onOutsidePointer(event) {
  if (!live) return;
  if (live.panel.contains(event.target)) return;
  /* A press on the field itself is the toggle above; let it have the event. */
  if (fieldAt(event.target).select === live.select) return;
  close();
}
