/**
 * <ui-select> and <ui-textarea> — the same field shell as <ui-input>, so a
 * dense form column lines up regardless of which control is in it.
 *
 * <ui-select label="Marital Status" options="Single,Married,Widowed"></ui-select>
 * <ui-select label="State" placeholder="Select">
 *   <option value="ND">North Dakota</option>
 * </ui-select>
 *
 * Options come from either the `options` attribute (comma separated, for
 * quick prototyping) or real <option> children (when you need values that
 * differ from labels).
 *
 * THE PLACEHOLDER IS NOT ONE OF THE OPTIONS.
 * `placeholder` is the question the field is asking — "Select Provider" — so
 * it shows in the closed field and is kept out of the list that opens. A
 * filter that needs a row meaning "do not narrow by this" is asking for an
 * ANSWER, not a question, and names it with `empty-option` instead:
 *
 *   <ui-select label="Type" placeholder="Select type">      question, hidden
 *   <ui-select label="Type" empty-option="All Types">        answer, pickable
 *
 * Both render the same empty value; only one of them is a row you can land on.
 *
 * "OTHER" IS ANSWERED IN THE FIELD THAT ASKED.
 * `free-text` names the option whose whole meaning is "the list does not cover
 * this" — normally Other. Pick it and the same control becomes a text box, so
 * the answer is typed where the question was asked rather than in a second box
 * that opens somewhere underneath it. The caret stays, as a button back to the
 * list. Two attributes carry it:
 *
 *   free-text="Other"                  the option that switches to typing
 *   free-text-value="Compounded semaglutide"   what has been typed so far
 *   free-text-placeholder="Enter medication name"
 *
 * The typed text is reported alongside the selection rather than in place of
 * it — ui-change carries { value: 'Other', freeText: '…' } — because the two
 * are different facts and a sheet that stored only the typed string would have
 * lost the answer to "was this on the list at all".
 *
 * THE CARET IS DECORATION, NOT A CONTROL.
 * It used to be a flex sibling of the <select>, which put a 16px column at
 * the right-hand end of every dropdown in the app where the arrow was drawn
 * and nothing happened — the one place a user aims for to open a menu was the
 * one place that did not open it. It is now positioned over the control and
 * taken out of the hit test (see .ui-input__caret in components/forms.css),
 * so the native <select> spans the full shell and the whole field is one
 * click target. The native element also brings the keyboard behaviour with
 * it: Enter/Space/Down open, Escape closes, arrows and type-ahead navigate.
 *
 * Events: ui-change with detail { value }
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

class UiSelect extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'value', 'options', 'placeholder',
    'empty-option', 'multiple', 'size', 'hint', 'error', 'required',
    'disabled', 'readonly',
    'free-text', 'free-text-value', 'free-text-placeholder',
  ];

  /**
   * Keep an attribute in step with the control without redrawing the control.
   *
   * `free-text-value` is observed so a host can push a value in, which also
   * means writing it back on each keystroke re-rendered the box being typed
   * into — the caret jumped to the end after every character. The echo is the
   * one write that must not redraw, because the DOM already says it.
   */
  reflectQuietly(name, value) {
    this._echoing = true;
    this.setAttribute(name, value);
    this._echoing = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this._echoing) return;
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  connectedCallback() {
    // Capture author-supplied <option> children before we rebuild the DOM.
    if (this._options === undefined) {
      const children = [...this.querySelectorAll('option')];
      this._options = children.map((o) => ({
        value: o.value,
        label: o.textContent.trim(),
      }));
    }
    super.connectedCallback();
  }

  /**
   * Set the choices from JavaScript.
   *
   * The `options` attribute splits on commas, so it cannot carry a value that
   * contains one — "K. Brandt, RN" silently became two options. Author-supplied
   * <option> children are only read once at upgrade time, so a list that
   * arrives later needs this. Accepts plain strings, or {value, label} when the
   * two differ.
   */
  setOptions(list) {
    this._options = (list ?? []).map((option) =>
      typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label ?? option.value, group: option.group }
    );
    this.render();
  }

  render() {
    const id = this._id || (this._id = `ui-select-${++uid}`);
    const hintId = `${id}-hint`;
    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const disabled = this.boolAttr('disabled') || this.boolAttr('readonly');
    const label = this.attr('label');
    const value = this.attr('value');

    const fromAttr = this.attr('options')
      ? this.attr('options').split(',').map((s) => ({ value: s.trim(), label: s.trim() }))
      : [];
    const options = this._options.length ? this._options : fromAttr;

    /* MORE THAN ONE ANSWER.
       `multiple` puts a real <select multiple> in the shell; js/lib/select-menu.js
       hides it behind a face showing what has been chosen and gives the panel
       checkbox rows. The chosen set travels through `value` as one
       comma-joined string, because an attribute can only be a string and a
       screen still has to be able to write the answer in its markup. */
    const multiple = this.boolAttr('multiple');
    const chosen = new Set(
      multiple ? value.split(',').map((v) => v.trim()).filter(Boolean) : []
    );

    const shellClasses = [
      'ui-input',
      'ui-input--select',
      `ui-input--${this.attr('size', 'md')}`,
      error && 'ui-input--error',
      disabled && 'ui-input--disabled',
    ].filter(Boolean).join(' ');

    /* THE EMPTY ROW: ONE OF IT, AND ONLY WHEN IT IS AN ANSWER.
       Two different things get written into the row whose value is "", and the
       difference decides whether a person can land on it.

       `placeholder` is the QUESTION. "Select", "Select Provider" — an
       instruction to pick, which had been sitting at the top of every dropdown
       in both portals as the first pickable row, and the row the list opened
       highlighted. Picking it answers nothing. It is now `disabled hidden`: a
       hidden option that is selected is still what the closed control
       displays, so the field goes on reading "Select" while the list it opens
       holds only answers.

       `empty-option` is an ANSWER — "All Types", "Any status" — the row a
       filter needs so it can be put back to not filtering. Same empty value,
       opposite intent, so it stays in the list. A list that already carries an
       empty-valued entry of its own, like the audit log's "All categories",
       is the same case written a different way and is left alone.

       Whichever one applies, exactly one empty row is drawn. Both a
       placeholder and an empty option used to be emitted together — a dead
       blank line under "Select Provider" on the billing filters — and because
       BOTH matched value="" the later one took the `selected` flag, so a field
       with nothing chosen read blank rather than reading its own placeholder.
       An empty-valued option carrying no label says nothing either of these
       does, so it is dropped rather than drawn as that blank line. */
    const listed = options.filter((o) => o.value !== '' || o.label !== '');
    const answer = this.attr('empty-option');
    const emptyRow = listed.some((o) => o.value === '')
      ? ''
      : `<option value=""${answer ? '' : ' disabled hidden'}${value ? '' : ' selected'}>${
          answer || this.attr('placeholder', '')
        }</option>`;

    const optionRow = (o) =>
      `<option value="${o.value}"${
        (multiple ? chosen.has(o.value) : o.value === value) ? ' selected' : ''
      }>${o.label}</option>`;

    /* HEADINGS INSIDE THE LIST.

       An option may carry a `group`, and a run of options sharing one is drawn
       inside an <optgroup> under that name. The triage medication picker is
       what this is for: it offers what THIS patient is already on and then
       everything the practice stocks, and a nurse scrolling thirty rows with
       no heading between the two halves cannot tell which half they are in —
       which turns "confirm the list" back into "search a catalogue".

       Grouping is by consecutive run rather than by collecting every option
       with the same name, because the caller decides the order rows are read
       in and a group that silently reorders the list is a group that moves an
       answer out from under the finger going to press it. An option with no
       `group` is drawn where it stands, so a list that never sets one — every
       other select in both builds — renders exactly as before. */
    const runs = [];
    listed.forEach((o) => {
      const last = runs[runs.length - 1];
      if (o.group && last && last.group === o.group) last.rows.push(o);
      else runs.push({ group: o.group || '', rows: [o] });
    });

    const optionMarkup = [
      emptyRow,
      ...runs.map((run) =>
        run.group
          ? `<optgroup label="${run.group}">${run.rows.map(optionRow).join('')}</optgroup>`
          : run.rows.map(optionRow).join('')
      ),
    ].join('');

    // label-hidden keeps the accessible name but takes the label off screen —
    // for filters where the control's own value already reads as the label.
    const labelClass = this.boolAttr('label-hidden')
      ? 'u-sr-only'
      : 'ui-field__label';

    // The list has been stepped out of: the option meaning "not on this list"
    // is the current answer, so this field is now the one being typed into.
    const freeOption = this.attr('free-text');
    const typing = Boolean(freeOption) && value === freeOption && !disabled;

    const controlMarkup = typing
      ? `<input id="${id}" class="ui-input__control" type="text"
          placeholder="${this.attr('free-text-placeholder')}"
          ${this.boolAttr('required') ? 'required' : ''}
          ${error ? 'aria-invalid="true"' : ''}
          ${hint ? `aria-describedby="${hintId}"` : ''}>
        <button type="button" class="ui-input__caret ui-input__caret--button"
          data-ui-select="toList" aria-label="Choose from the list instead"
          title="Choose from the list instead">${iconMarkup('caret-down', 'ui-icon')}</button>`
      : `<select id="${id}" class="ui-input__control ui-input__control--select"
          ${multiple ? 'multiple' : ''}
          ${disabled ? 'disabled' : ''}
          ${this.boolAttr('required') ? 'required' : ''}
          ${error ? 'aria-invalid="true"' : ''}
          ${hint ? `aria-describedby="${hintId}"` : ''}>${optionMarkup}</select>
        ${iconMarkup('caret-down', 'ui-icon ui-input__caret')}`;

    this.innerHTML = `<div class="ui-field">
      ${label ? `<label class="${labelClass}" for="${id}">${label}${
        this.boolAttr('required')
          ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
          : ''
      }</label>` : ''}
      <div class="${shellClasses}">
        ${controlMarkup}
      </div>
      ${hint ? `<p id="${hintId}" class="ui-field__hint${
        error ? ' ui-field__hint--error' : ''
      }"${error ? ' role="alert"' : ''}>${
        error ? iconMarkup('critical') : ''
      }<span>${hint}</span></p>` : ''}
    </div>`;

    if (typing) {
      this.wireFreeText(freeOption);
      return;
    }

    const control = this.querySelector('select');
    control.addEventListener('change', () => {
      if (multiple) {
        const values = this.values;
        /* QUIETLY. The panel driving this select is still open, and writing
           the attribute the ordinary way would re-render — replacing the
           <select> and the face out from under the list that is toggling
           them. The DOM already says what the attribute is being told. */
        this.reflectQuietly('value', values.join(','));
        this.emit('ui-change', { value: values.join(','), values });
        return;
      }
      this.setAttribute('value', control.value);
      this.emit('ui-change', { value: control.value });
    });
  }

  /**
   * Bind the typed half of a free-text field.
   *
   * The value goes on as a PROPERTY rather than into the markup: it is the one
   * string on this control the user wrote, and an attribute would need
   * escaping to survive a quote in a drug name.
   *
   * ui-input on every keystroke, ui-change on commit — the same pair <ui-input>
   * emits, so a host can treat the two the same way. Hosts that re-render on
   * ui-change would otherwise pull the box out from under the typing.
   */
  wireFreeText(freeOption) {
    const control = this.querySelector('input');
    control.value = this.attr('free-text-value');

    const detail = () => ({ value: freeOption, freeText: control.value });

    control.addEventListener('input', () => {
      /* Written back so the attribute and the box agree — a re-render driven
         by any other attribute would otherwise restore the value the field
         had when it was last painted. */
      this.reflectQuietly('free-text-value', control.value);
      this.emit('ui-input', detail());
    });
    control.addEventListener('change', () => this.emit('ui-change', detail()));

    /* Back to the list. The selection AND the text go together: the typed name
       belonged to the option that has just been given up, and leaving it
       behind is how a sheet ends up reading "Plavix" with "compounded
       semaglutide" still stored beside it. */
    this.querySelector('[data-ui-select="toList"]').addEventListener('click', () => {
      this.setAttribute('free-text-value', '');
      this.setAttribute('value', '');
      this.emit('ui-change', { value: '', freeText: '' });
      this.querySelector('select')?.focus();
    });
  }

  /** Focus the typed box if this field is in free-text mode, else the list. */
  focusFreeText() {
    const box = this.querySelector('input');
    if (!box) return false;
    box.focus();
    return true;
  }

  get value() {
    const control = this.querySelector('select');
    if (!control) return this.attr('value');
    return control.multiple ? this.values.join(',') : control.value;
  }

  set value(next) { this.setAttribute('value', next); }

  /**
   * The answers, as a list — the shape a multiple select actually has.
   *
   * `value` still answers for both kinds, joining the list with commas, so a
   * screen that only ever reads `.value` keeps working. Anything that means to
   * handle more than one answer should read this instead of splitting that
   * string back apart.
   */
  get values() {
    const control = this.querySelector('select');
    if (control) {
      return [...control.selectedOptions].map((o) => o.value).filter(Boolean);
    }
    return this.attr('value').split(',').map((v) => v.trim()).filter(Boolean);
  }

  set values(list) { this.setAttribute('value', (list ?? []).join(',')); }

  /* The face is what is on screen when this is a multiple select; focusing the
     element behind it would put the ring somewhere nothing can see. */
  focus(options) {
    const face = this.querySelector('.ui-select-facade');
    (face ?? this.querySelector('select'))?.focus(options);
  }

  /**
   * Options as data, for lists that come from a data file AND need a value
   * that differs from the label:
   *
   *   select.optionList = [{ value: 'fax-4411', label: 'Red River — Referral' }];
   *
   * The `options` attribute still covers the common value === label case, and
   * cannot express this one because it is a comma-joined string of labels.
   *
   * Assigning before the element connects is safe: connectedCallback only
   * reads <option> children when _options has not been set yet.
   */
  set optionList(list) {
    this._options = list.map((option) => ({
      value: String(option.value),
      label: option.label,
      group: option.group,
    }));
    if (this._upgraded) this.render();
  }

  get optionList() { return this._options ?? []; }
}

reflectProps(UiSelect, {
  label: 'string', 'label-hidden': 'boolean',
  options: 'string', placeholder: 'string', 'empty-option': 'string',
  multiple: 'boolean', size: 'string',
  hint: 'string', error: 'string',
  required: 'boolean', disabled: 'boolean', readonly: 'boolean',
  'free-text': 'string', 'free-text-value': 'string',
  'free-text-placeholder': 'string',
});
define('ui-select', UiSelect);

class UiTextarea extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'value', 'placeholder', 'rows', 'hint', 'error',
    'required', 'disabled',
  ];

  render() {
    const id = this._id || (this._id = `ui-textarea-${++uid}`);
    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const label = this.attr('label');

    /* label-hidden, the same contract <ui-input> and <ui-select> keep: the
       accessible name stays, the visible one goes. A textarea that sits alone
       under a section heading of its own name — "PLAN" above a field labelled
       "Plan" — is the case this exists for. Until this was here the attribute
       was accepted in the markup and quietly ignored, so every such field
       printed its heading twice. */
    const labelClass = this.boolAttr('label-hidden')
      ? 'u-sr-only'
      : 'ui-field__label';

    this.innerHTML = `<div class="ui-field">
      ${label ? `<label class="${labelClass}" for="${id}">${label}${
        this.boolAttr('required')
          ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
          : ''
      }</label>` : ''}
      <div class="ui-input ui-input--textarea${error ? ' ui-input--error' : ''}${
        this.boolAttr('disabled') ? ' ui-input--disabled' : ''
      }">
        <textarea id="${id}" class="ui-input__control" rows="${this.attr('rows', '3')}"
          placeholder="${this.attr('placeholder')}"
          ${this.boolAttr('required') ? 'required' : ''}
          ${error ? 'aria-invalid="true"' : ''}
          ${this.boolAttr('disabled') ? 'disabled' : ''}>${this.attr('value')}</textarea>
      </div>
      ${hint ? `<p class="ui-field__hint${error ? ' ui-field__hint--error' : ''}">${hint}</p>` : ''}
    </div>`;

    const control = this.querySelector('textarea');
    control.addEventListener('change', () => {
      this.emit('ui-change', { value: control.value });
    });
  }

  get value() { return this.querySelector('textarea')?.value ?? this.attr('value'); }
  /* Symmetrical with <ui-input>: the attribute is the store, and `value` is in
     observedAttributes, so writing the property re-renders the control with the
     text in it. Without this the getter alone makes `node.value = ...` throw in
     module (strict) code, which is exactly what a form re-opened for editing
     does to every field it is putting a saved answer back into. */
  set value(next) { this.setAttribute('value', next); }
  focus(options) { this.querySelector('textarea')?.focus(options); }
}

reflectProps(UiTextarea, {
  label: 'string', 'label-hidden': 'boolean', placeholder: 'string', rows: 'string',
  hint: 'string', error: 'string', required: 'boolean', disabled: 'boolean',
});
define('ui-textarea', UiTextarea);

export { UiSelect, UiTextarea };
