/**
 * <ui-checkbox> and <ui-toggle> — both wrap a real native input, so keyboard
 * and form behaviour come for free and assistive tech sees the right thing.
 *
 * <ui-checkbox checked>Include inactive patients</ui-checkbox>
 * <ui-toggle checked>Show only abnormal results</ui-toggle>
 *
 * `label-hidden` keeps the words for screen readers and drops them visually —
 * for a box in a table column or at the end of a list row, where the heading
 * or the row already says what ticking it means. It is NOT a way to ship a
 * box with nothing to say: the label is still required, because a checkbox
 * with no accessible name is unusable by anyone not looking at it.
 *
 *   <ui-checkbox label-hidden>Mark corrected</ui-checkbox>
 *
 * Events: ui-change with detail { checked }
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

class UiCheckbox extends UiElement {
  static observedAttributes = ['checked', 'disabled', 'indeterminate', 'error', 'label-hidden'];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const id = this._id || (this._id = `ui-check-${++uid}`);
    const disabled = this.boolAttr('disabled');

    // A required-but-unticked consent box is the commonest reason a clinical
    // form refuses to submit, so it gets the same critical ink a field error
    // does rather than leaving the reader to hunt for the offending row.
    const error = this.boolAttr('error');

    this.innerHTML = `<label class="ui-choice${
      disabled ? ' ui-choice--disabled' : ''
    }${error ? ' ui-choice--error' : ''}" for="${id}">
      <input id="${id}" class="ui-choice__input" type="checkbox"
        ${this.boolAttr('checked') ? 'checked' : ''}
        ${error ? 'aria-invalid="true"' : ''}
        ${disabled ? 'disabled' : ''}>
      <span class="ui-choice__box">
        ${iconMarkup('check-bold', 'ui-icon ui-choice__mark')}
        ${iconMarkup('minus-bold', 'ui-icon ui-choice__mark ui-choice__mark--mixed')}
      </span>
      <span${this.boolAttr('label-hidden') ? ' class="u-sr-only"' : ''}>${this._label}</span>
    </label>`;

    const input = this.querySelector('input');
    input.indeterminate = this.boolAttr('indeterminate');

    input.addEventListener('change', () => {
      this.setBoolAttr('checked', input.checked);
      this.emit('ui-change', { checked: input.checked });
    });
  }

  get checked() { return this.querySelector('input')?.checked ?? this.boolAttr('checked'); }
  set checked(value) { this.setBoolAttr('checked', value); }
  focus(options) { this.querySelector('input')?.focus(options); }
}

reflectProps(UiCheckbox, { disabled: 'boolean', indeterminate: 'boolean', error: 'boolean' });
define('ui-checkbox', UiCheckbox);

class UiToggle extends UiElement {
  static observedAttributes = ['checked', 'disabled', 'size'];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const id = this._id || (this._id = `ui-toggle-${++uid}`);
    // sm is for a toggle living inside a table row or a dense filter bar,
    // where the full-size switch would set the row height on its own.
    const size = this.attr('size', 'md');

    this.innerHTML = `<label class="ui-toggle${
      size === 'sm' ? ' ui-toggle--sm' : ''
    }" for="${id}">
      <input id="${id}" class="ui-toggle__input" type="checkbox" role="switch"
        ${this.boolAttr('checked') ? 'checked' : ''}
        ${this.boolAttr('disabled') ? 'disabled' : ''}>
      <span class="ui-toggle__track"><span class="ui-toggle__thumb"></span></span>
      <span>${this._label}</span>
    </label>`;

    const input = this.querySelector('input');
    input.addEventListener('change', () => {
      this.setBoolAttr('checked', input.checked);
      this.emit('ui-change', { checked: input.checked });
    });
  }

  get checked() { return this.querySelector('input')?.checked ?? this.boolAttr('checked'); }
  set checked(value) { this.setBoolAttr('checked', value); }
  focus(options) { this.querySelector('input')?.focus(options); }
}

reflectProps(UiToggle, { disabled: 'boolean', size: 'string' });
define('ui-toggle', UiToggle);

export { UiCheckbox, UiToggle };
