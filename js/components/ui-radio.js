/**
 * <ui-radio> — one radio button, with its label.
 *
 * Attributes
 *   name      groups radios; the browser's arrow-key behaviour needs it
 *   value     what the form submits
 *   checked
 *   disabled
 *   error     invalid visual state
 *
 * Events
 *   ui-change  { value, checked }
 *
 * <ui-radio name="sedation" value="mac" checked>MAC</ui-radio>
 *
 * <ui-radio-group> already exists and stays the right choice when the options
 * are a list you have in hand — it renders a real fieldset/legend, which is
 * what makes a screen reader say "1 of 2". This is for the other case: radios
 * placed inside a table row, a card, or a form grid, where the grouping is the
 * layout rather than a container element.
 *
 * It renders the same .ui-choice markup the group does, so the two are one
 * control drawn one way, however they are placed.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

let uid = 0;

class UiRadio extends UiElement {
  static observedAttributes = ['name', 'value', 'checked', 'disabled', 'error'];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const id = (this._id ||= `ui-radio-${++uid}`);
    const name = this.attr('name');
    const value = this.attr('value', this._label);
    const disabled = this.boolAttr('disabled');
    const error = this.boolAttr('error');

    this.innerHTML = `<label class="ui-choice${
      disabled ? ' ui-choice--disabled' : ''
    }${error ? ' ui-choice--error' : ''}" for="${id}">
      <input id="${id}" class="ui-choice__input" type="radio"
        ${name ? `name="${name}"` : ''} value="${value}"
        ${this.boolAttr('checked') ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
        ${error ? 'aria-invalid="true"' : ''}>
      <span class="ui-choice__box ui-choice__box--radio">
        <span class="ui-choice__dot"></span>
      </span>
      <span>${this._label}</span>
    </label>`;

    const input = this.querySelector('input');

    input.addEventListener('change', () => {
      this.setBoolAttr('checked', input.checked);
      // Peers have to drop their own checked attribute. The browser unchecks
      // the other INPUTS for us, but the attribute on our own tag is what a
      // re-render reads, so without this two radios would repaint as checked.
      if (name) {
        this.getRootNode()
          .querySelectorAll(`ui-radio[name="${name}"]`)
          .forEach((radio) => {
            if (radio !== this) radio.removeAttribute('checked');
          });
      }
      this.emit('ui-change', { value, checked: input.checked });
    });
  }

  get checked() {
    return this.querySelector('input')?.checked ?? this.boolAttr('checked');
  }
  set checked(value) {
    this.setBoolAttr('checked', value);
  }
  focus(options) {
    this.querySelector('input')?.focus(options);
  }
}

reflectProps(UiRadio, {
  name: 'string',
  value: 'string',
  disabled: 'boolean',
  error: 'boolean',
});

define('ui-radio', UiRadio);
export { UiRadio };
