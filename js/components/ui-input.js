/**
 * <ui-input> — labelled text field with hint, error and icon slots.
 *
 * Attributes
 *   label, placeholder, value, type            standard field things
 *   size        sm | md | lg     (default md = 32px)
 *   icon        icon name shown at the start
 *   icon-end    icon name shown at the end
 *   hint        helper text under the field
 *   error       error message; also switches the field to the error state
 *   reveal      show/hide toggle; password fields only
 *   required, disabled, readonly
 *
 * Events
 *   ui-change   on blur/commit, detail { value }
 *   ui-input    on every keystroke, detail { value }
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

class UiInput extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'placeholder', 'value', 'type', 'size', 'icon', 'icon-end',
    'hint', 'hint-position', 'action', 'error', 'success', 'reveal', 'required', 'disabled', 'readonly',
  ];

  /**
   * A committed value is patched in, never re-rendered.
   *
   * The control writes its own value back on `change`, which fires on blur —
   * including the blur caused by clicking the reveal button inside this very
   * field. Re-rendering there replaced the <input> and the button mid-click,
   * so the toggle appeared to do nothing. Nothing visual depends on `value`
   * beyond the control itself, so there is nothing else to redraw.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;

    if (name === 'value') {
      const control = this.querySelector('input');
      if (control && control.value !== newValue) control.value = newValue ?? '';
      return;
    }

    super.attributeChangedCallback(name, oldValue, newValue);
  }

  render() {
    const id = this._id || (this._id = `ui-input-${++uid}`);
    const hintId = `${id}-hint`;
    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const disabled = this.boolAttr('disabled');
    const readonly = this.boolAttr('readonly');
    const label = this.attr('label');

    const shellClasses = [
      'ui-input',
      `ui-input--${this.attr('size', 'md')}`,
      error && 'ui-input--error',
      // Success is only drawn when there is no error to draw. A field cannot
      // be both, and error is always the more urgent of the two.
      !error && this.boolAttr('success') && 'ui-input--success',
      disabled && 'ui-input--disabled',
      readonly && 'ui-input--readonly',
    ].filter(Boolean).join(' ');

    const iconStart = this.attr('icon');
    const iconEnd = this.attr('icon-end');

    // An error line leads with an icon, so colour is not the only signal.
    const succeeded = !error && this.boolAttr('success');
    const hintMarkup = hint
      ? `<p id="${hintId}" class="ui-field__hint${
          error ? ' ui-field__hint--error' : ''
        }${succeeded ? ' ui-field__hint--success' : ''}"${error ? ' role="alert"' : ''}>${
          error ? iconMarkup('critical') : succeeded ? iconMarkup('check') : ''
        }<span>${hint}</span></p>`
      : '';
    // MediNova supports the description above OR below the field.
    const hintOnTop = this.attr('hint-position') === 'top' && !error;
    const action = this.attr('action');
    // Only meaningful on a password field — a reveal on a text input reveals
    // nothing.
    const reveal = this.boolAttr('reveal') && this.attr('type') === 'password';

    // label-hidden keeps the accessible name but takes the label off screen —
    // for search boxes and filters where a visible label would be noise.
    const labelClass = this.boolAttr('label-hidden')
      ? 'u-sr-only'
      : 'ui-field__label';

    this.innerHTML = `<div class="ui-field">
      ${label ? `<div class="ui-field__label-row">
        <label class="${labelClass}" for="${id}">${label}${
          this.boolAttr('required')
            ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
            : ''
        }</label>
        ${action ? `<button type="button" class="ui-field__action">${action}</button>` : ''}
      </div>` : ''}
      ${hintOnTop ? hintMarkup : ''}
      <div class="${shellClasses}">
        ${iconStart ? iconMarkup(iconStart) : ''}
        <input
          id="${id}"
          class="ui-input__control"
          type="${this.attr('type', 'text')}"
          value="${this.attr('value')}"
          placeholder="${this.attr('placeholder')}"
          ${disabled ? 'disabled' : ''}
          ${readonly ? 'readonly' : ''}
          ${this.boolAttr('required') ? 'required' : ''}
          ${error ? 'aria-invalid="true"' : ''}
          ${hint ? `aria-describedby="${hintId}"` : ''}
        >
        ${iconEnd ? iconMarkup(iconEnd) : ''}
        ${
          reveal
            ? `<button type="button" class="ui-input__reveal" data-reveal
                 aria-pressed="false" aria-label="Show password"
                 aria-controls="${id}">${iconMarkup('eye')}</button>`
            : ''
        }
      </div>
      ${hintOnTop ? '' : hintMarkup}
    </div>`;

    const control = this.querySelector('input');

    /*
     * Reveal toggles the input's type in place rather than re-rendering.
     * A re-render would replace the <input>, dropping both the caret position
     * and what had been typed — mid-password, which is exactly when someone
     * reaches for this button.
     */
    this.querySelector('[data-reveal]')?.addEventListener('click', (event) => {
      const button = event.currentTarget;
      const shown = control.type === 'text';
      control.type = shown ? 'password' : 'text';
      button.setAttribute('aria-pressed', String(!shown));
      button.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
      button.innerHTML = iconMarkup(shown ? 'eye' : 'eye-off');
      // Reading the password back is a glance, not a context switch — keep the
      // caret where it was so typing simply continues.
      control.focus();
      control.setSelectionRange(control.value.length, control.value.length);
    });
    control.addEventListener('input', () => {
      this.emit('ui-input', { value: control.value });
    });

    this.querySelector('.ui-field__action')?.addEventListener('click', () => {
      this.emit('ui-action', { label: action });
    });
    control.addEventListener('change', () => {
      this.setAttribute('value', control.value);
      this.emit('ui-change', { value: control.value });
    });
  }

  get value() {
    return this.querySelector('input')?.value ?? this.attr('value');
  }
  set value(next) {
    this.setAttribute('value', next);
  }

  focus(options) {
    this.querySelector('input')?.focus(options);
  }
}

reflectProps(UiInput, {
  label: 'string', 'label-hidden': 'boolean',
  placeholder: 'string', type: 'string', size: 'string',
  icon: 'string', 'icon-end': 'string', hint: 'string',
  'hint-position': 'string', action: 'string', error: 'string', reveal: 'boolean',
  required: 'boolean', disabled: 'boolean', readonly: 'boolean',
});

define('ui-input', UiInput);
export { UiInput };
