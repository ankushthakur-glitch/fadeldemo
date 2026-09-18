/**
 * THE DROPDOWN LIST, DRAWN BY THE PAGE.
 *
 * Every dropdown in this product is a real <select>, and until now the list it
 * opened was drawn by the operating system: Chrome's grey slab on Windows, the
 * blue-highlighted panel on macOS, something else again on Linux. The closed
 * field wore MediNova's shell — 32px tall, 4px radius, our border and our focus
 * ring — and then opened into a control from 2009 that shares none of it. It
 * is the one part of the design system the design system did not own.
 *
 * This draws it instead. One panel, parented to <body>, the same white surface
 * and rounded rows as every other menu the product opens.
 *
 * WHAT THIS DOES NOT CHANGE
 * The <select> stays exactly where it was and keeps its value, its name, its
 * options, its events and its accessible role. Nothing that reads a dropdown
 * had to change: `select.value` still answers, a `change` listener still
 * fires, Playwright's selectOption still works, and a screen that rebuilds its
 * markup gets the new list for free because nothing is registered per field —
 * the two openers below are delegated from the document.
 *
 * A field whose list must stay native — a date-like control on a phone, say —
 * opts out with `data-native-menu` and is left alone.
 *
 * HOW IT OPENS
 * A press on the field is caught in the CAPTURE phase and cancelled, which is
 * what stops the platform popup: the browser opens it on the default action of
 * mousedown, so the menu has to be refused before the event reaches the
 * control. Cancelling mousedown also cancels the focus that comes with it, so
 * focus is moved by hand.
 *
 * WHERE FOCUS GOES
 * Into the panel, which is a real listbox with a real active option. That is
 * what makes the replacement honest for a screen reader: arrowing announces
 * "Male, 2 of 4" rather than moving a highlight nothing can see. It also keeps
 * a dropdown inside a modal working: <ui-modal>'s focus trap listens on the
 * dialog and the panel is parented outside it, so Escape reaches this file and
 * closes the list without taking the window down with it.
 *
 * Type-ahead, Home/End, PageUp/PageDown and the arrow keys are re-implemented
 * here because the panel now owns the keyboard. Closing puts focus back on the
 * field it came from.
 */

import { registerOverlay } from './overlay.js';

const PANEL_ID = 'uiSelectMenu';
const SHEET_ID = 'uiSelectMenuPosition';

const GAP = 4; /* field to panel */
const EDGE = 8; /* panel to the edge of the window */
const MAX_HEIGHT = 288; /* ~8 rows before it scrolls inside itself */
const MIN_HEIGHT = 120; /* never squeezed below this — flip instead */
const TYPE_AHEAD_MS = 700;

/** The one open menu, or null. Two dropdowns can never be open at once. */
let live = null;
/** Removes this panel from the overlay register — see js/lib/overlay.js. */
let release = null;

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
 * `<select multiple>` is the only control HTML has for "more than one of
 * these", and the browser draws it as a four-row scrolling box that is nothing
 * like the rest of this product's fields — a different height, a different
 * border, no caret, and a selection made by ctrl-clicking, which is knowledge
 * a patient portal cannot assume. So the element stays for everything it is
 * good at — it holds the options, it holds the selection, it posts with a
 * form, `select.selectedOptions` still answers, Playwright's selectOption
 * still drives it — and it stops being the thing on screen.
 *
 * What is on screen is a button wearing the same field shell as every other
 * dropdown, showing what has been chosen. It opens the same panel, whose rows
 * grow a checkbox and stop closing the list when they are clicked.
 *
 * The pairing is made HERE rather than by whatever built the markup, for the
 * same reason the openers are delegated from the document: a screen that
 * rebuilds its DOM gets the behaviour back without registering anything, and
 * <ui-select> only has to emit an ordinary <select multiple>.
 */
const FACADE = 'ui-select-facade';

function facadeFor(select) {
  const existing = select.previousElementSibling;
  if (existing?.classList.contains(FACADE)) return existing;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${FACADE} ui-input__control ui-input__control--select`;
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'listbox');
  /* The <label> is still `for` the select, which is now the hidden half — so
     the name is copied onto the visible half rather than left pointing at
     something nothing can reach. */
  button.setAttribute('aria-label', accessibleName(select));
  select.classList.add('ui-select--faceted');
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
  /* The label lives in a span rather than straight on the button. The face is
     stretched to the full height of the field shell so the whole field opens
     the list, and a stretched button centring one line of anonymous text is
     exactly the case where text-overflow: ellipsis stops working — the
     truncation a face with four answers in it depends on. A real element to
     hang the overflow on costs one span. */
  let text = button.firstElementChild;
  if (!text) {
    text = document.createElement('span');
    text.className = 'ui-select-facade__text';
    button.append(text);
  }
  text.textContent = summarise(select);
  /* Nothing chosen reads as a prompt, the same grey the closed single-select
     gives its placeholder. */
  button.classList.toggle('is-empty', ![...select.selectedOptions].some((o) => o.value !== ''));
  return button;
}

/**
 * Give every multiple select on the page its face, now and as the page
 * changes. A screen that re-renders a panel replaces its <select>s wholesale,
 * and the observer is what means no screen has to say so.
 */
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

/**
 * The face follows the element, however the element was changed.
 *
 * commit() repaints the one it just toggled, but the <select> is still a real
 * form control and other things write to it: a screen restoring a saved
 * filter, a form reset, Playwright's selectOption. Those all fire `change`,
 * and without this the hidden element would hold three answers while the
 * button on top of it still read "All types" — the exact failure the face
 * exists to avoid. Capture, because a screen may stop the event on its way up.
 */
document.addEventListener(
  'change',
  (event) => {
    const select = event.target;
    if (
      select instanceof HTMLSelectElement &&
      select.multiple &&
      select.classList.contains('ui-select--faceted')
    ) {
      paintFacade(select);
    }
  },
  true
);

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
  panel.className = `ui-select-menu${multi ? ' ui-select-menu--multi' : ''}`;
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', accessibleName(select));
  if (multi) panel.setAttribute('aria-multiselectable', 'true');
  panel.tabIndex = -1;

  /* THE HEADINGS AN <optgroup> ASKS FOR.

     The panel is drawn from the flat option list, and a flat list is what an
     optgroup's two halves become the moment their heading is dropped: the
     triage medication picker offers what this patient is already on and then
     everything the practice stocks, and with no line between them a nurse
     reads thirty rows without knowing which half they are in.

     A heading is a row like any other, carrying `is-disabled` — which is the
     class every movement through this panel already skips: the arrow keys
     (firstEnabled), the type-ahead, and the click handler all refuse a
     disabled row, so a heading cannot be landed on, typed to or pressed. It
     carries no `data-index`, because it answers to no option. */
  let openGroup = null;

  options.forEach((option, row) => {
    const group = option.parentElement instanceof HTMLOptGroupElement
      ? option.parentElement
      : null;
    if (group !== openGroup) {
      openGroup = group;
      if (group?.label) {
        const heading = document.createElement('div');
        heading.className = 'ui-select-menu__group is-disabled';
        heading.setAttribute('role', 'presentation');
        heading.textContent = group.label;
        panel.appendChild(heading);
      }
    }

    const item = document.createElement('div');
    item.id = `${PANEL_ID}-option-${row}`;
    item.className = 'ui-select-menu__option';
    item.setAttribute('role', 'option');
    item.dataset.index = String(option.index);
    /* The label goes in as TEXT. Option labels are data — a practice name with
       an ampersand in it, a dose with a quote mark — and building the row with
       innerHTML would put that data back through the HTML parser. */
    if (multi && option.value !== '') {
      /* The same checkbox the rest of the product draws — .ui-choice__box and
         its tick, with the row's own state deciding whether the tick shows.
         Two drawings of a checkbox would be one too many.

         Not on the empty row. "No one assigned" is not a fourth member of the
         set that happens to be ticked, it is the row that empties the set —
         an action, and a checkbox beside it would invite someone to tick it
         ALONGSIDE the three answers it exists to cancel. */
      const box = document.createElement('span');
      box.className = 'ui-choice__box';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML =
        '<svg class="ui-icon ui-choice__mark" aria-hidden="true" focusable="false">' +
        '<use href="#i-check-bold"></use></svg>';
      const text = document.createElement('span');
      text.className = 'ui-select-menu__label';
      text.textContent = option.textContent.trim() || ' ';
      item.append(box, text);
    } else {
      item.textContent = option.textContent.trim() || ' ';
    }

    /* One row is the answer in a single select; in a multiple one, every row
       that has been ticked is. */
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
     A native <dialog> opened with showModal() puts itself in the browser's TOP
     LAYER and makes the rest of the document inert. No z-index can reach over
     that, and focus cannot move into it — a panel parented to <body> would be
     drawn behind the dialog and would refuse the keyboard. Parenting it to the
     dialog puts it inside the same top-layer subtree, where both work.

     It is still `position: fixed` and still measured against the viewport: the
     dialog only becomes a containing block for fixed children while a
     transform is animating on it, which is over long before anyone opens a
     dropdown inside it. */
  const host = select.closest('dialog[open]') || document.body;
  host.appendChild(panel);

  const items = [...panel.children];
  /* Option rows only — reanchor() compares this against a replacement list's
     option count, and the group headings are not options. */
  const optionRows = items.filter((item) => 'index' in item.dataset).length;
  const dialog = host instanceof HTMLDialogElement ? host : null;
  live = {
    select, anchor, frame: frameFor(anchor), multi, panel, items, optionRows, dialog,
    active: -1, typed: '', typedAt: 0,
  };
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
  /* A dialog that closes takes its dropdown with it, or the list outlives the
     form it belongs to. See js/lib/overlay.js. */
  release = registerOverlay(() => close());
  window.addEventListener('resize', place);
  /* ESCAPE CLOSES ONE THING, AND IT IS THE LIST.
     A native <dialog> closes on Escape by itself — the browser's own close
     request, which no keydown listener can call off. Refusing its `cancel`
     event is the only way to hold the dialog open while a dropdown inside it
     takes the key. The listener comes off a tick after the menu closes, so
     the Escape that closed the list is still covered and the next one gets
     through to the dialog. */
  dialog?.addEventListener('cancel', refuseCancel);
  /* Capture, because the field may sit in a table or a drawer that scrolls
     inside itself and those scroll events never reach the window. */
  window.addEventListener('scroll', place, { capture: true, passive: true });
}

/**
 * THE BOX THE PANEL IS MEASURED AGAINST: the FIELD, not the control inside it.
 *
 * A <ui-select> is a <select> sitting inside .ui-input — the shell that draws
 * the border, the radius and the 8px inset. The control is therefore 18px
 * narrower than the field and 7px shorter, and measuring the panel against it
 * opened every dropdown in the product narrower than the thing it dropped out
 * of, indented from its left edge, and tucked up under its bottom border. Read
 * beside the field it belongs to, it did not look like the same object.
 *
 * So the panel is measured against the shell where there is one — .ui-input,
 * or the .ui-select-shell wrapper the bare <select>s in the pager and the
 * print toolbar wear — and against the control itself where there is not. Same
 * width, same left edge, and the 4px gap now falls below the field's border
 * rather than inside it.
 */
function frameFor(anchor) {
  return anchor.closest('.ui-input, .ui-select-shell') || anchor;
}

/**
 * Put the panel under the field — or over it, when the field is near the
 * bottom of the window.
 *
 * Coordinates arrive through a generated stylesheet keyed to the panel's id
 * rather than a style attribute, the same way the row ⋮ menu and the scheduler
 * place their panels.
 */
/**
 * THE FIELD WENT AWAY. FIND THE ONE THAT REPLACED IT.
 *
 * A screen that re-renders its panel on every change replaces its <select>s
 * wholesale, and with a multiple select that happens on EVERY TICK: the row is
 * a toggle, the toggle fires `change`, the screen repaints, and the element
 * this menu is driving is detached mid-list. Closing at that point made
 * multiple selects unusable exactly where they are most useful — one tick per
 * trip to the field, which is the behaviour they exist to replace.
 *
 * The id survives the rebuild even though the element does not, which is the
 * same thread commit() already follows to hand focus back after a single
 * selection. Followed here it keeps the panel open over the new field.
 *
 * Only when the list is demonstrably the same list. The rows carry option
 * INDEXES, so a replacement offering a different number of options would have
 * this menu ticking the wrong ones; that case closes, which is what used to
 * happen to every case.
 */
function reanchor() {
  const { select, anchor } = live;
  if (select.isConnected && anchor.isConnected) return true;

  const heir = select.id ? document.getElementById(select.id) : null;
  if (!(heir instanceof HTMLSelectElement) || heir === select) return false;
  if (!eligible(heir) || heir.multiple !== select.multiple) return false;
  if (heir.options.length !== select.options.length) return false;
  if (visibleOptions(heir).length !== live.optionRows) return false;

  const face = heir.multiple ? paintFacade(heir) : heir;
  face.setAttribute?.('aria-expanded', 'true');
  live.select = heir;
  live.anchor = face;
  live.frame = frameFor(face);
  return true;
}

function place() {
  if (!live) return;

  /* The field can go out from under an open menu — see reanchor(). If nothing
     took its place there is nothing left to hang the panel on. */
  if (!reanchor()) return close();

  const { anchor, panel } = live;

  /* Re-asked when the shell it was measured against has gone: a screen that
     re-renders around an open panel puts a new shell under the same anchor. */
  const frame = live.frame?.isConnected ? live.frame : frameFor(anchor);
  const box = frame.getBoundingClientRect();
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
    `--select-menu-left:${Math.round(left)}px;` +
    `--select-menu-top:${Math.round(top)}px;` +
    `--select-menu-width:${Math.round(width)}px;` +
    `--select-menu-max-height:${Math.round(maxHeight)}px;` +
    `--select-menu-origin:${origin};` +
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

  release?.();
  release = null;

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
 * fires and therefore the pair every screen in this product is already wired
 * to. Nothing had to be taught a new event.
 */
function commit(index) {
  if (!live) return;
  const { select } = live;
  const option = select.options[index];
  if (!option || option.disabled) return;

  /* MORE THAN ONE ANSWER MEANS THE LIST STAYS OPEN.
     A row in a multiple select is a toggle, and closing the panel on the first
     tick would make the second one cost another trip to the field. The empty
     row is the exception: "All types" or "None" is the answer that cancels the
     others, so taking it clears the rest and is the one press that finishes. */
  if (live.multi) {
    const clearing = option.value === '';
    if (clearing) {
      [...select.options].forEach((o) => (o.selected = false));
    } else {
      option.selected = !option.selected;
      /* Any real answer cancels the empty one. They cannot both be true — the
         set is either empty or it is not — and leaving the empty option
         selected underneath is what would put a tick on "No one assigned"
         next to three people who are. */
      [...select.options].forEach((o) => {
        if (o.value === '') o.selected = false;
      });
    }

    live.items.forEach((item) => {
      const chosen = select.options[Number(item.dataset.index)].selected;
      item.classList.toggle('is-selected', chosen);
      item.setAttribute('aria-selected', String(chosen));
    });
    paintFacade(select);

    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (clearing) return close({ refocus: true });

    /* The screen has just been told, and screens repaint when they are told.
       Ask place() straight away rather than waiting for a scroll: it is what
       finds the field that replaced this one and re-points the panel at it,
       and until it runs the next tick would be toggling an option on an
       element no longer in the document. */
    place();
    return;
  }

  const changed = select.selectedIndex !== index;
  select.selectedIndex = index;
  close({ refocus: true });
  if (!changed) return;

  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));

  /* A host that re-renders on change replaces the field we just handed focus
     back to. Follow it to its replacement — <ui-select> rebuilds itself on
     every selection, and the alternative is dropping a keyboard user on
     <body> halfway through a form. The id survives the rebuild; the element
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
 * Type-ahead, as the native list does it: the letters typed within a beat of
 * each other are one prefix, and one letter typed over and over cycles through
 * the options starting with it.
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
 *
 * Capture phase and preventDefault: the platform popup is the DEFAULT ACTION of
 * mousedown on a <select>, so it has to be refused before the control sees the
 * event. That also cancels the focus mousedown would have given the field,
 * which is why focus is placed by hand.
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
 * element that is on screen). They are the same thing for an ordinary
 * dropdown; a multiple select's face is what was pressed and the hidden
 * element behind it is what will be changed.
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
 * type-ahead that picks a value outright, and that behaviour is better than
 * anything replacing it would be.
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
       would fire a click straight back into the opener below, closing the
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
    /* Stopped here. A dropdown inside a dialog is a list on top of a window,
       and one Escape must close one of them — the list. */
    event.preventDefault();
    event.stopPropagation();
    return close({ refocus: true });
  }

  if (key === 'Tab') {
    /* Commit and get out of the way: the default action still runs, so focus
       moves on to the next field the way it would from a closed dropdown.
       Nothing is committed on the way out of a multiple select — its rows are
       toggles, and tabbing past one is not a decision to tick it. */
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
  const item = event.target.closest('.ui-select-menu__option');
  if (!item || item.classList.contains('is-disabled')) return;
  const row = live.items.indexOf(item);
  if (row >= 0 && row !== live.active) setActive(row);
}

function onPanelClick(event) {
  const item = event.target.closest('.ui-select-menu__option');
  if (!item || item.classList.contains('is-disabled')) return;
  commit(Number(item.dataset.index));
}

function onOutsidePointer(event) {
  if (!live) return;
  if (live.panel.contains(event.target)) return;
  /* A press on the field itself is the toggle above; let it have the event.
     pointerdown runs before mousedown, so closing here would hand the opener a
     dead menu and it would open a new one — a press that should have shut the
     list would reopen it instead. Asked through fieldAt so a multiple select's
     face counts as its field. */
  if (fieldAt(event.target).select === live.select) return;
  close();
}
