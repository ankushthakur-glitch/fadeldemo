/**
 * <ui-icd10> — THE diagnosis picker. There is one, and this is it.
 *
 *   <ui-icd10 label="Indication" placeholder="Search code or description"></ui-icd10>
 *   <ui-icd10 label="Diagnoses" multiple value="K21.9,Z12.11"></ui-icd10>
 *
 * Attributes
 *   label, label-hidden, placeholder, hint, error   the usual field things
 *   value        comma-separated codes; the same attribute in both modes
 *   multiple     chips instead of a single filled box
 *   suggest      `common`, or a comma-separated set of codes, to offer with
 *                nothing typed — this is what turns the box into a dropdown
 *   suggest-label   the heading over that short list (default "Common codes")
 *   min-chars    characters before a search fires (default 2)
 *   debounce     milliseconds of quiet before a search fires (default 300)
 *   size, required, disabled, readonly
 *
 * Events
 *   ui-change    detail { value, codes, entries } on every add or remove
 *
 * WHY A TEXT BOX AND A LIST RATHER THAN A <select>
 * The dropdown this replaces held ten options because ten is what fits. The
 * real code set is about seventy thousand, which cannot be a <select> at any
 * size — so the control has to be "type, wait, choose", and everything below
 * follows from that being a SEARCH rather than a pick:
 *
 *   - it searches code AND description, because half the people using it think
 *     in codes and half think in words, and neither should have to learn the
 *     other's way in;
 *   - it debounces, because a search that fires per keystroke fires six times
 *     for "reflux" and shows the answer to "refl" last;
 *   - it numbers its requests and drops stale replies, because with real
 *     latency the answer to "K2" can land after the answer to "K21.9" and
 *     overwrite it;
 *   - it says "Searching…", "No codes match" and "Search unavailable" out
 *     loud, because an empty list means three completely different things and
 *     a clinician who cannot tell them apart retypes a code that was never
 *     going to be found.
 *
 * WHY IT ALSO HAS A DROPDOWN
 * Search is the right shape for seventy thousand codes and the wrong one for
 * the eight a desk books against all day. An empty box that answers nothing
 * until two characters are in it asks the person to already know the word the
 * code is filed under — type "aa" hunting for anaemia and the field says no
 * such code, which is true and useless. So with `suggest` set, the box opens
 * on focus (and on its caret, and on Down) onto that short list under a
 * heading, and typing turns it straight back into the search it was. The
 * caret is the affordance: a text box with nothing beside it does not look
 * like something that can be opened.
 *
 * The listbox is real ARIA: role=combobox on the input, aria-expanded,
 * aria-activedescendant onto the highlighted option. Arrows move, Enter takes,
 * Escape closes, and in multi-select Backspace on an empty box lifts the last
 * chip — the behaviour anybody who has used a tag field already expects.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';
import {
  searchIcd10,
  icd10ByCode,
  icd10Suggestions,
  formatIcd10,
  ICD10_MIN_QUERY,
} from '../../data/icd10.js';

let uid = 0;

/** What the box asks for with nothing chosen yet, and once something is. */
const SEARCH_PLACEHOLDER = 'Search ICD-10 code or description';
const NEXT_PLACEHOLDER = 'Add another diagnosis…';

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

class UiIcd10 extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'placeholder', 'value', 'multiple', 'size',
    'hint', 'error', 'min-chars', 'debounce', 'required', 'disabled', 'readonly',
    'suggest', 'suggest-label',
  ];

  /**
   * Selection lives in JS, not in the attribute.
   *
   * `value` is the way in and the way out, but re-rendering the whole control
   * every time a chip is added would take the text box — and the caret, and
   * whatever was half-typed — with it. So a value change patches the chips and
   * nothing else, exactly as <ui-input> does for the same reason.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;
    if (name === 'value') {
      this._codes = this.#parse(newValue);
      this.#paintSelection();
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  #parse(value) {
    return String(value ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
  }

  get #multiple() { return this.boolAttr('multiple'); }
  get #minChars() { return Number(this.attr('min-chars', String(ICD10_MIN_QUERY))); }
  get #debounceMs() { return Number(this.attr('debounce', '300')); }

  /**
   * The short list this box opens onto, minus anything already attached.
   *
   * Resolved on every open rather than once at render, because in multi-select
   * the list shrinks as diagnoses are taken from it — offering a code that is
   * already sitting in a row above the box is an option that cannot do
   * anything when it is pressed.
   */
  #suggestions() {
    const spec = this.attr('suggest');
    if (!spec) return [];
    return icd10Suggestions(spec).filter((entry) => !this._codes.includes(entry.code));
  }

  render() {
    const id = this._id || (this._id = `ui-icd10-${++uid}`);
    this._listId = `${id}-list`;
    this._hintId = `${id}-hint`;
    this._codes = this.#parse(this.attr('value'));
    this._results = [];
    this._active = -1;
    this._open = false;
    this._seq = 0;

    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const label = this.attr('label');
    const disabled = this.boolAttr('disabled') || this.boolAttr('readonly');

    const shellClasses = [
      'ui-input',
      'ui-input--icd10',
      `ui-input--${this.attr('size', 'md')}`,
      this.#multiple && 'ui-input--icd10-multi',
      error && 'ui-input--error',
      disabled && 'ui-input--disabled',
    ].filter(Boolean).join(' ');

    const labelClass = this.boolAttr('label-hidden') ? 'u-sr-only' : 'ui-field__label';

    this.innerHTML = `<div class="ui-field ui-field--icd10">
      ${label ? `<label class="${labelClass}" for="${id}">${esc(label)}${
        this.boolAttr('required')
          ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
          : ''
      }</label>` : ''}
      <div class="ui-icd10">
        <!-- Multi-select keeps its diagnoses ABOVE the box, one per row, code
             and description together. They were chips inside the box, which
             fits a tag field but not this: an ICD-10 description is a line of
             prose, and a row of code-only pills made the desk hover each one
             to find out what it had attached. -->
        <div class="ui-icd10__selected" data-chips></div>
        <div class="${shellClasses}">
          ${iconMarkup('search')}
          <input
            id="${id}"
            class="ui-input__control ui-icd10__input"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="${this._listId}"
            placeholder="${esc(this.attr('placeholder', SEARCH_PLACEHOLDER))}"
            ${disabled ? 'disabled' : ''}
            ${this.boolAttr('required') ? 'required' : ''}
            ${error ? 'aria-invalid="true"' : ''}
            ${hint ? `aria-describedby="${this._hintId}"` : ''}
          >
          <button type="button" class="ui-icd10__clear" data-clear hidden
            aria-label="Clear diagnosis">${iconMarkup('close')}</button>
          <!-- The caret is a BUTTON, not decoration: this is a text box first,
               so the click that opens the list cannot be the click that puts
               the cursor between two characters. It only exists where there is
               a short list to open onto — a caret over an empty panel is a
               promise the field cannot keep. -->
          ${this.attr('suggest') ? `<button type="button" class="ui-icd10__caret"
            data-toggle tabindex="-1" aria-label="Show common codes"
            data-testid="icd10--toggle"
            ${disabled ? 'disabled' : ''}>${iconMarkup('caret-down', 'ui-icon')}</button>` : ''}
        </div>
        <div class="ui-icd10__panel" id="${this._listId}" role="listbox"
          aria-label="${esc(label || 'ICD-10 codes')}" hidden></div>
      </div>
      ${hint ? `<p id="${this._hintId}" class="ui-field__hint${
        error ? ' ui-field__hint--error' : ''
      }"${error ? ' role="alert"' : ''}>${
        error ? iconMarkup('critical') : ''
      }<span>${esc(hint)}</span></p>` : ''}
    </div>`;

    this._input = this.querySelector('.ui-icd10__input');
    this._panel = this.querySelector('.ui-icd10__panel');
    this._chips = this.querySelector('[data-chips]');
    this._clear = this.querySelector('[data-clear]');
    this._toggle = this.querySelector('[data-toggle]');

    this.#wire();
    this.#paintSelection();
  }

  /* ===================== Selection ===================== */

  #entries() {
    return this._codes.map(
      (code) => icd10ByCode(code) ?? { code, description: '', active: true }
    );
  }

  #paintSelection() {
    if (!this._chips) return;

    if (this.#multiple) {
      this._chips.innerHTML = this.#entries()
        .map(
          (entry) => `<span class="ui-icd10__chip" data-chip="${esc(entry.code)}">
            <span class="ui-icd10__chip-text">
              <code>${esc(entry.code)}</code>${
                entry.description ? ` — ${esc(entry.description)}` : ''
              }
            </span>
            <button type="button" class="ui-icd10__chip-drop" data-drop="${esc(entry.code)}"
              aria-label="Remove ${esc(entry.code)}${
                entry.description ? ` — ${esc(entry.description)}` : ''
              }">${iconMarkup('close')}</button>
          </span>`
        )
        .join('');
      // The box is always ready for the next code, and once one is attached it
      // asks for the next one by name rather than repeating the search prompt
      // above a list of what it has already found.
      this._input.placeholder = this._codes.length
        ? NEXT_PLACEHOLDER
        : this.attr('placeholder', SEARCH_PLACEHOLDER);
      /* No clear-all here. Every row carries its own ×, so a second × beside
         the box would be one press that drops six diagnoses sitting next to
         six presses that drop one — and they look identical. */
      this._clear.hidden = true;
      return;
    }

    // Single-select shows the chosen code IN the box — it is the value, not a
    // filter on the way to one.
    const [entry] = this.#entries();
    this._chips.innerHTML = '';
    if (entry && document.activeElement !== this._input) {
      this._input.value = formatIcd10(entry);
    }
    this._clear.hidden = !entry;
  }

  #commit(codes) {
    this._codes = codes;
    // Keep the attribute in step for anyone reading it back, without letting
    // attributeChangedCallback bounce the paint we are already doing.
    const next = codes.join(',');
    if (this.attr('value') !== next) {
      this._suppress = true;
      this.setAttribute('value', next);
      this._suppress = false;
    }
    this.#paintSelection();
    this.emit('ui-change', {
      value: next,
      codes: [...codes],
      entries: this.#entries(),
    });
  }

  #select(entry) {
    if (this.#multiple) {
      if (!this._codes.includes(entry.code)) this.#commit([...this._codes, entry.code]);
      this._input.value = '';
    } else {
      this.#commit([entry.code]);
      this._input.value = formatIcd10(entry);
    }
    this.#close();
    this._input.focus();
  }

  #remove(code) {
    this.#commit(this._codes.filter((c) => c !== code));
  }

  /* ===================== The list ===================== */

  #open() {
    if (this._open) return;
    this._open = true;
    this._panel.hidden = false;
    this._input.setAttribute('aria-expanded', 'true');
  }

  #close() {
    if (!this._open) return;
    this._open = false;
    this._panel.hidden = true;
    this._input.setAttribute('aria-expanded', 'false');
    this._input.removeAttribute('aria-activedescendant');
    this._active = -1;
  }

  /** A state that is not a list of results: searching, empty, or broken. */
  #paintMessage(kind, text) {
    this._results = [];
    this._active = -1;
    this._panel.innerHTML = `<p class="ui-icd10__msg ui-icd10__msg--${kind}"
      data-testid="icd10--${kind}" role="status">${esc(text)}</p>`;
    this.#open();
  }

  /**
   * Open onto the short list instead of onto nothing.
   *
   * Returns false when there is no short list to show, so every caller can
   * fall through to whatever it would have done — closing, or saying how many
   * more characters a search needs.
   */
  #paintSuggestions() {
    const entries = this.#suggestions();
    if (!entries.length) return false;
    // Nothing is in flight any more as far as this panel is concerned: a
    // search that lands after the list is open must not paint over it.
    this._seq++;
    this.#paintResults(entries, '', this.attr('suggest-label', 'Common codes'));
    return true;
  }

  #paintResults(results, query, heading = '') {
    this._results = results;
    this._active = results.length ? 0 : -1;

    if (!results.length) {
      this.#paintMessage('empty', `No ICD-10 code matches “${query}”.`);
      return;
    }

    this._panel.innerHTML = `${
      heading
        ? `<p class="ui-icd10__head" data-testid="icd10--suggest-head">${esc(heading)}</p>`
        : ''
    }<ul class="ui-icd10__list" role="none">
      ${results
        .map(
          (entry, i) => `<li id="${this._listId}-opt-${i}" role="option"
            class="ui-icd10__opt${i === 0 ? ' is-active' : ''}"
            aria-selected="${i === 0}" data-index="${i}"
            data-testid="icd10--option-${esc(entry.code)}">
            <code class="ui-icd10__opt-code">${highlight(entry.code, query)}</code>
            <span class="ui-icd10__opt-text">${highlight(entry.description, query)}</span>
          </li>`
        )
        .join('')}
    </ul>`;
    this.#open();
    this.#syncActive();
  }

  #syncActive() {
    const options = [...this._panel.querySelectorAll('.ui-icd10__opt')];
    options.forEach((option, i) => {
      const on = i === this._active;
      option.classList.toggle('is-active', on);
      option.setAttribute('aria-selected', String(on));
      if (on) {
        this._input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
    if (this._active < 0) this._input.removeAttribute('aria-activedescendant');
  }

  #move(step) {
    if (!this._results.length) return;
    const count = this._results.length;
    this._active = (this._active + step + count) % count;
    this.#syncActive();
  }

  /**
   * Run a search, and ignore it if a newer one has already answered.
   *
   * Every request carries a sequence number. Over a real connection the reply
   * to a two-character query can arrive after the reply to the five-character
   * one that followed it, and painting whichever landed last shows results for
   * a query the box no longer contains.
   */
  async #search(query) {
    const seq = ++this._seq;
    this.#paintMessage('loading', 'Searching…');

    try {
      const results = await searchIcd10(query);
      if (seq !== this._seq) return;
      this.#paintResults(results, query);
    } catch {
      if (seq !== this._seq) return;
      this.#paintMessage('error', 'Search unavailable. Try again, or type the code in full.');
    }
  }

  /* ===================== Wiring ===================== */

  #wire() {
    let timer = null;

    const schedule = (query) => {
      clearTimeout(timer);
      timer = setTimeout(() => this.#search(query), this.#debounceMs);
    };

    this._input.addEventListener('input', () => {
      const query = this._input.value.trim();

      // Clearing the box in single-select clears the value. Anything else and
      // an emptied field still reads as the code it used to hold.
      if (!query && !this.#multiple && this._codes.length) this.#commit([]);

      if (query.length < this.#minChars) {
        clearTimeout(timer);
        this._seq++; // orphan any search already in flight
        // An emptied box goes back to being the dropdown it opened as, rather
        // than shutting — deleting a query is how somebody abandons a search,
        // and the short list is what they wanted in the first place.
        if (query.length === 0) {
          if (!this.#paintSuggestions()) this.#close();
        } else {
          this.#paintMessage('hint', `Keep typing — ${this.#minChars} characters to search.`);
        }
        return;
      }
      schedule(query);
    });

    /* Focus opens the list, because a field whose answers are eight rows long
       should show them before it is asked to. It only does so on an empty box:
       coming back to a query — or, in single-select, to the code already in
       there — means going on with what is written, not starting again. */
    const openList = () => {
      if (this._open || this._input.disabled) return;
      if (this._input.value.trim()) return;
      this.#paintSuggestions();
    };
    this._input.addEventListener('focus', openList);
    // A click into an already-focused box that was closed with Escape has to
    // be able to open it again; focus alone fires once and never returns.
    this._input.addEventListener('click', openList);

    this._input.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (this._open) this.#move(1);
          else if (this._input.value.trim().length >= this.#minChars) {
            this.#search(this._input.value.trim());
          } else this.#paintSuggestions();
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.#move(-1);
          break;
        case 'Enter':
          if (this._open && this._active >= 0 && this._results[this._active]) {
            // Only swallow Enter when it is actually taking an option —
            // otherwise a form's submit key stops working inside this field.
            event.preventDefault();
            this.#select(this._results[this._active]);
          }
          break;
        case 'Escape':
          if (this._open) {
            event.stopPropagation();
            this.#close();
          }
          break;
        case 'Backspace':
          // Only when there is nothing to delete in the box itself.
          if (this.#multiple && !this._input.value && this._codes.length) {
            this.#remove(this._codes[this._codes.length - 1]);
          }
          break;
        default:
          break;
      }
    });

    // Mousedown here too, and for the same reason as the options below: by
    // click time the box has blurred, the panel has closed, and a toggle would
    // read the closed state and open the list it was pressed to shut.
    this._toggle?.addEventListener('mousedown', (event) => {
      event.preventDefault();
      if (this._open) {
        this.#close();
        this._input.focus();
        return;
      }
      const query = this._input.value.trim();
      // Pressing the caret mid-query means "show me what I typed", not "throw
      // it away and show me the eight" — only an empty box gets the list.
      if (query.length >= this.#minChars) this.#search(query);
      else this.#paintSuggestions();
      this._input.focus();
    });

    // Mousedown, not click: click fires after blur, by which time the panel
    // has closed and the option is gone.
    this._panel.addEventListener('mousedown', (event) => {
      const option = event.target.closest('.ui-icd10__opt');
      if (!option) return;
      event.preventDefault();
      this.#select(this._results[Number(option.dataset.index)]);
    });

    this.addEventListener('click', (event) => {
      const drop = event.target.closest('[data-drop]');
      if (drop) {
        this.#remove(drop.dataset.drop);
        this._input.focus();
        return;
      }
      if (event.target.closest('[data-clear]')) {
        this.#commit([]);
        this._input.value = '';
        this._input.focus();
      }
    });

    this._input.addEventListener('blur', () => {
      // A single-select box that was typed in but never chosen from would
      // otherwise sit there showing a half-typed query that is not the value.
      if (!this.#multiple) {
        const [entry] = this.#entries();
        this._input.value = entry ? formatIcd10(entry) : '';
      }
      this.#close();
    });

    this._onDocumentDown = (event) => {
      if (!this.contains(event.target)) this.#close();
    };
    document.addEventListener('mousedown', this._onDocumentDown);
  }

  disconnectedCallback() {
    document.removeEventListener('mousedown', this._onDocumentDown);
  }

  /* ===================== Public surface ===================== */

  get value() { return this._codes ? this._codes.join(',') : this.attr('value'); }
  set value(next) { this.setAttribute('value', next ?? ''); }

  /** The chosen codes as data, which is what a caller almost always wants. */
  get codes() { return [...(this._codes ?? [])]; }
  get entries() { return this.#entries(); }

  focus(options) { this._input?.focus(options); }
}

reflectProps(UiIcd10, {
  label: 'string', 'label-hidden': 'boolean', placeholder: 'string',
  size: 'string', hint: 'string', error: 'string',
  'min-chars': 'string', debounce: 'string',
  suggest: 'string', 'suggest-label': 'string',
  multiple: 'boolean', required: 'boolean', disabled: 'boolean', readonly: 'boolean',
});

define('ui-icd10', UiIcd10);
export { UiIcd10 };
