/**
 * <ui-suggest> — a box you type into, over a list you can also just pick from.
 *
 *   <ui-suggest label="Medication" placeholder="Type a name, or pick one"></ui-suggest>
 *   node.setOptions(['Midazolam', 'Fentanyl', 'Propofol']);
 *
 * Attributes
 *   label, label-hidden, placeholder, value, hint, error, size
 *   required, disabled, readonly
 *   empty-note   what the panel says when nothing matches what has been typed
 *
 * Events
 *   ui-input     on every keystroke and on every pick, detail { value }
 *   ui-change    on commit — blur, Enter, or a pick — detail { value }
 *
 * The same pair <ui-input> emits, carrying the same detail, so a host that
 * already knows how to listen to a text field needs to learn nothing new.
 *
 * WHY THIS EXISTS BESIDE <ui-select> AND <ui-icd10>
 * Three different questions, and this is the third of them.
 *
 *   <ui-select>  the answer is one of these and can be nothing else.
 *   <ui-icd10>   the answer is one of seventy thousand, so it has to be
 *                searched — with a debounce, stale replies dropped, and a
 *                "searching…" state, because the answer arrives late.
 *   <ui-suggest> the answer is USUALLY one of a handful, occasionally is not
 *                one of them at all, and the handful is already in memory.
 *
 * The middle case is the medication on an administration record: the cart
 * carries six drugs and a case can need a seventh. A closed list cannot say the
 * seventh; a bare text box makes somebody spell out the six.
 *
 * WHY NOT A NATIVE <datalist>
 * That was the first answer, and it is still the right one for a field whose
 * list is a convenience — the stock form's vendor and waste-reason boxes, where
 * the common answers save a keystroke and nothing depends on seeing them. It is
 * the wrong one where the list IS the point, because what a datalist does is up
 * to the browser: when it opens, whether it opens at all, how the rows are
 * drawn, whether the matched run is marked. Several things suppress it outright
 * — autocomplete="off" among them — and a picker that silently becomes a plain
 * text box on somebody's machine is a formulary they will never find out was
 * there. A list that has to be discovered is not being offered.
 *
 * So the panel here is ours: it opens on the first press or the first
 * keystroke, it narrows as the characters land, it marks the run that matched,
 * and it says so plainly when nothing does — the same on every machine, in the
 * product's own type and colour.
 *
 * TYPING PAST THE LIST IS AN ANSWER, NOT A MISTAKE.
 * Nothing matching closes nothing and blocks nothing — the panel says the list
 * has no such entry and that what is typed will be recorded as typed, and the
 * value is whatever is in the box. That is the whole difference between this
 * and a <select>, and a control that quietly cleared itself on blur would be a
 * <select> with extra steps.
 *
 * The listbox is real ARIA — role=combobox on the input, aria-expanded,
 * aria-activedescendant onto the highlighted row. Arrows move, Enter takes,
 * Escape closes and leaves what was typed, Tab commits and moves on.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Wrap the run of characters the query matched, so the eye lands on it. */
function highlight(text, query) {
  const needle = query.trim();
  if (!needle) return esc(text);
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return esc(text);
  return `${esc(text.slice(0, at))}<mark>${esc(text.slice(at, at + needle.length))}</mark>${esc(
    text.slice(at + needle.length)
  )}`;
}

class UiSuggest extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'placeholder', 'value', 'size', 'hint', 'error',
    'empty-note', 'required', 'disabled', 'readonly',
  ];

  /**
   * A value pushed in from outside patches the box, and does not redraw it.
   *
   * Same rule <ui-input> keeps, for the same reason: a re-render replaces the
   * <input>, and with it the caret and whatever was half-typed. It matters more
   * here, because the host writing this value is often doing so WHILE the field
   * is being typed into — the log drawer fills a dose from the drug being
   * named.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;
    if (name === 'value') {
      if (this._input && this._input.value !== newValue) this._input.value = newValue ?? '';
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  /**
   * Set the choices from JavaScript.
   *
   * Strings, or {value, label} where the row should read as more than its
   * answer. There is no `options` attribute on purpose: a comma-joined string
   * cannot carry "K. Brandt, RN", and this control's lists come from data
   * files rather than from markup.
   */
  setOptions(list) {
    this._options = (list ?? []).map((option) =>
      typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label ?? option.value }
    );
    if (this._open) this.#paint();
  }

  get optionList() { return this._options ?? []; }
  set optionList(list) { this.setOptions(list); }

  render() {
    const id = this._id || (this._id = `ui-suggest-${++uid}`);
    this._listId = `${id}-list`;
    this._hintId = `${id}-hint`;
    this._options = this._options ?? [];
    this._matches = [];
    this._active = -1;
    this._open = false;

    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const label = this.attr('label');
    const disabled = this.boolAttr('disabled') || this.boolAttr('readonly');

    const shellClasses = [
      'ui-input',
      'ui-input--suggest',
      `ui-input--${this.attr('size', 'md')}`,
      error && 'ui-input--error',
      disabled && 'ui-input--disabled',
    ].filter(Boolean).join(' ');

    const labelClass = this.boolAttr('label-hidden') ? 'u-sr-only' : 'ui-field__label';

    this.innerHTML = `<div class="ui-field">
      ${label ? `<label class="${labelClass}" for="${id}">${esc(label)}${
        this.boolAttr('required')
          ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
          : ''
      }</label>` : ''}
      <div class="ui-suggest">
        <div class="${shellClasses}">
          <input
            id="${id}"
            class="ui-input__control ui-suggest__input"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="${this._listId}"
            value="${esc(this.attr('value'))}"
            placeholder="${esc(this.attr('placeholder'))}"
            ${disabled ? 'disabled' : ''}
            ${this.boolAttr('required') ? 'required' : ''}
            ${error ? 'aria-invalid="true"' : ''}
            ${hint ? `aria-describedby="${this._hintId}"` : ''}
          >
          <!-- The caret is a BUTTON, unlike the decorative one on <ui-select>.
               There the whole native control opens the list and the arrow is
               drawn over it; here the control is a text box that must stay
               clickable for what it is — putting the caret at the end of a word
               to correct it — so the way to "just show me the list" needs a
               target of its own. -->
          <button type="button" class="ui-suggest__caret" data-suggest="toggle"
            tabindex="-1" aria-label="Show the list"
            ${disabled ? 'disabled' : ''}>${iconMarkup('caret-down', 'ui-icon')}</button>
        </div>
        <div class="ui-suggest__panel" id="${this._listId}" role="listbox"
          aria-label="${esc(label || 'Suggestions')}" hidden></div>
      </div>
      ${hint ? `<p id="${this._hintId}" class="ui-field__hint${
        error ? ' ui-field__hint--error' : ''
      }"${error ? ' role="alert"' : ''}>${
        error ? iconMarkup('critical') : ''
      }<span>${esc(hint)}</span></p>` : ''}
    </div>`;

    this._input = this.querySelector('.ui-suggest__input');
    this._panel = this.querySelector('.ui-suggest__panel');
    this.#wire();
  }

  /* ===================== The list ===================== */

  /**
   * What the panel is narrowing against — which is the TYPING, not the value.
   *
   * The two are the same thing on a field that starts empty, and they are not
   * on one that arrives already answered. The encounter's pre-op indication is
   * the second kind: it is carried off the booking, so the box holds a full
   * sentence before anybody touches it, and a filter read off the box would
   * open the panel on exactly one row — the answer that is already in the
   * field. A list that can only show you what you already have is not a list.
   *
   * So: opening offers everything, and a keystroke starts narrowing. Nothing
   * changes for the drawer fields this control was written for, which open
   * empty and therefore open on the whole list either way.
   */
  #query() {
    return this._typed ? this._input.value.trim() : '';
  }

  #matching() {
    const query = this.#query().toLowerCase();
    if (!query) return this._options;
    return this._options.filter((option) => option.label.toLowerCase().includes(query));
  }

  #paint() {
    const query = this.#query();
    this._matches = this.#matching();

    if (!this._matches.length) {
      this._active = -1;
      this._input.removeAttribute('aria-activedescendant');
      /* Not an error, and not silence either. The person has typed a drug the
         cart does not carry, which is allowed — so the panel says which of the
         two things has happened rather than vanishing and leaving them to
         wonder whether the field is broken or their answer is. */
      this._panel.innerHTML = `<p class="ui-suggest__msg" role="status"
        data-testid="suggest--empty">${esc(
          this.attr('empty-note', 'Not on the list — it will be recorded as typed.')
        )}</p>`;
      return;
    }

    /* The first row is highlighted, never selected. Enter on an untouched
       field takes the best match, which is what somebody who typed four
       characters and reached for Enter meant; arrowing away from it and back
       costs nothing. Selection only happens on a press. */
    if (this._active >= this._matches.length) this._active = this._matches.length - 1;
    if (this._active < 0 && query) this._active = 0;

    this._panel.innerHTML = `<ul class="ui-suggest__list" role="presentation">
      ${this._matches
        .map(
          (option, index) => `<li id="${this._listId}-${index}" role="option"
            class="ui-suggest__opt${index === this._active ? ' is-active' : ''}"
            aria-selected="${index === this._active}" data-index="${index}"
            data-testid="suggest--opt-${index}">
            <span class="ui-suggest__opt-text">${highlight(option.label, query)}</span>
          </li>`
        )
        .join('')}
    </ul>`;

    if (this._active >= 0) {
      this._input.setAttribute('aria-activedescendant', `${this._listId}-${this._active}`);
      this._panel
        .querySelector('.is-active')
        ?.scrollIntoView({ block: 'nearest' });
    } else {
      this._input.removeAttribute('aria-activedescendant');
    }
  }

  /**
   * The nearest thing that would cut the panel off.
   *
   * Almost always a modal body — `.ui-modal__body` scrolls, so a panel taller
   * than the room under the field is sliced at the dialog's edge and the last
   * row is half a row. The viewport stands in when nothing above this element
   * scrolls.
   */
  #clipper() {
    let node = this.parentElement;
    while (node && node !== document.body) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return node;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * Fit the panel to the room there is, and drop it upwards when there is not.
   *
   * A fixed max-height cannot work for a control that is used both as the first
   * field of a short dialog and as the last field of a long page. Measured, the
   * list is as tall as it can be without being cut, which is what makes the
   * difference between a list that ends and a list that looks broken.
   *
   * The floor is deliberate: below about four rows the panel stops being worth
   * dropping downwards at all, so it flips above the field instead — and if
   * there is no room either way it takes the floor and scrolls, because a
   * cramped list still beats no list.
   */
  #place() {
    const shell = this.querySelector('.ui-input');
    if (!shell) return;

    const GAP = 8;
    const FLOOR = 96;
    const CEILING = 240;

    const box = shell.getBoundingClientRect();
    const clip = this.#clipper()?.getBoundingClientRect();
    const bottom = Math.min(clip ? clip.bottom : Infinity, window.innerHeight);
    const top = Math.max(clip ? clip.top : 0, 0);

    const below = bottom - box.bottom - GAP;
    const above = box.top - top - GAP;
    const up = below < FLOOR && above > below;

    this._panel.classList.toggle('ui-suggest__panel--up', up);
    this._panel.style.maxHeight = `${Math.max(FLOOR, Math.min(CEILING, up ? above : below))}px`;
  }

  #open() {
    if (this._open || this.boolAttr('disabled') || this.boolAttr('readonly')) return;
    this._open = true;
    /* Opening is not typing — see #query. A panel opened over an answer that
       is already in the box shows the whole list until a key is pressed. */
    this._typed = false;
    this._panel.hidden = false;
    this._input.setAttribute('aria-expanded', 'true');
    this.#paint();
    this.#place();
  }

  #close() {
    if (!this._open) return;
    this._open = false;
    this._panel.hidden = true;
    this._input.setAttribute('aria-expanded', 'false');
    this._input.removeAttribute('aria-activedescendant');
    this._active = -1;
  }

  #move(step) {
    if (!this._open) {
      this.#open();
      return;
    }
    if (!this._matches.length) return;
    const count = this._matches.length;
    this._active = (this._active + step + count) % count;
    this.#paint();
  }

  /** Take one row: it becomes what is in the box, and the field is answered. */
  #take(index) {
    const option = this._matches[index];
    if (!option) return;
    this._input.value = option.value;
    /* The row that was taken is an ANSWER now, not a half-typed query — so a
       panel reopened over it starts from the whole list again. */
    this._typed = false;
    this.#commit();
    this.#close();
    this._input.focus();
  }

  /**
   * Say what the box holds, however it got there.
   *
   * Both events, because a pick is a keystroke and a commit at once: hosts
   * that react as you type and hosts that react when you are done both have to
   * hear about a row that was clicked.
   */
  #commit() {
    const value = this._input.value;
    if (this.attr('value') !== value) {
      this._echoing = true;
      this.setAttribute('value', value);
      this._echoing = false;
    }
    this.emit('ui-input', { value });
    this.emit('ui-change', { value });
  }

  /* ===================== Wiring ===================== */

  #wire() {
    const input = this._input;

    input.addEventListener('input', () => {
      /* Typing re-aims the highlight at the top of whatever now matches. The
         old index pointed into the old list, and keeping it meant Enter after
         one more character took a row nobody had looked at. */
      this._active = -1;
      this.#open();
      /* After #open, which clears the flag: the press that opened the panel is
         not typing, and this keystroke is. */
      this._typed = true;
      this.#paint();
      this._echoing = true;
      this.setAttribute('value', input.value);
      this._echoing = false;
      this.emit('ui-input', { value: input.value });
    });

    /*
     * A press opens it; arriving by keyboard does not.
     *
     * The panel covers whatever is under this field, and the form this control
     * was written for focuses its first field the moment it opens — so opening
     * on focus alone meant every drawer appeared with its second and third
     * questions already hidden behind a list nobody had asked for. A click is
     * an ask. So is a keystroke, so is Down, so is the caret. Tabbing through
     * on the way somewhere else is not.
     */
    input.addEventListener('click', () => this.#open());

    input.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.#move(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.#move(-1);
          break;
        case 'Enter':
          /* Only when a row is highlighted. Enter on a field whose answer is
             typed belongs to the form, not to this control — swallowing it
             would break submitting from the keyboard. */
          if (this._open && this._active >= 0) {
            event.preventDefault();
            this.#take(this._active);
          }
          break;
        case 'Escape':
          if (this._open) {
            /* The panel closes and the typing stays. Escape means "stop
               offering", not "forget what I wrote" — a control that emptied
               the box here would lose an answer that is already correct. */
            event.stopPropagation();
            this.#close();
          }
          break;
        case 'Tab':
          this.#close();
          break;
        default:
          break;
      }
    });

    /* mousedown, not click: the press moves focus out of the input, and a
       panel that closed on blur would take the row away before the click
       landed on it. */
    this._panel.addEventListener('mousedown', (event) => {
      const row = event.target.closest('[data-index]');
      if (!row) return;
      event.preventDefault();
      this.#take(Number(row.dataset.index));
    });

    this.querySelector('[data-suggest="toggle"]').addEventListener('mousedown', (event) => {
      event.preventDefault();
      if (this._open) {
        this.#close();
        return;
      }
      /* Opened from the caret, the panel shows everything rather than what
         matches what is in the box: the press means "what else is there", and
         answering it with the one row already chosen is not an answer. */
      this._input.focus();
      this._input.select();
      this.#open();
    });

    input.addEventListener('change', () => this.#commit());

    /* Leaving the field closes it — including leaving for another window,
       which `blur` catches and `focusout` on the wrapper alone would not. */
    input.addEventListener('blur', () => this.#close());
  }

  get value() { return this._input?.value ?? this.attr('value'); }
  set value(next) { this.setAttribute('value', next ?? ''); }

  focus(options) { this._input?.focus(options); }

  /**
   * Shut the panel from outside, without taking the focus with it.
   *
   * For a host that treats a commit as the END of one answer rather than as
   * the field's final state — the procedure report's code pickers, which empty
   * the box and write the answer into a list underneath, then leave the cursor
   * where it is for the next one. Left open, the list would sit over the very
   * line it had just added. Escape and a blur already do this; a host that has
   * just consumed an answer should not have to fake a keystroke to say so.
   */
  close() { this.#close(); }
}

reflectProps(UiSuggest, {
  label: 'string', 'label-hidden': 'boolean', placeholder: 'string',
  size: 'string', hint: 'string', error: 'string', 'empty-note': 'string',
  required: 'boolean', disabled: 'boolean', readonly: 'boolean',
});

define('ui-suggest', UiSuggest);
export { UiSuggest };
