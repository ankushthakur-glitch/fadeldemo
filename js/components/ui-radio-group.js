/**
 * <ui-radio-group> — a set of mutually exclusive choices.
 *
 * <ui-radio-group label="Patient is guarantor?" options="Yes,No" value="Yes">
 * </ui-radio-group>
 *
 * Renders a real <fieldset>/<legend> with native radios, so screen readers
 * announce "1 of 2" correctly and arrow keys work without any JS from us.
 *
 * Events: ui-change with detail { value }
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

let uid = 0;

class UiRadioGroup extends UiElement {
  static observedAttributes = ['label', 'options', 'value', 'inline', 'disabled'];

  render() {
    const name = this._name || (this._name = `ui-radio-${++uid}`);
    const value = this.attr('value');
    const options = this.attr('options')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.innerHTML = `<fieldset class="ui-radio-group${
      this.boolAttr('inline') ? ' ui-radio-group--inline' : ''
    }">
      ${this.attr('label') ? `<legend class="ui-field__label">${this.attr('label')}</legend>` : ''}
      <div class="ui-radio-group__options">
        ${options
          .map(
            (option, index) => `<label class="ui-choice" for="${name}-${index}">
              <input id="${name}-${index}" class="ui-choice__input" type="radio"
                name="${name}" value="${option}"
                ${option === value ? 'checked' : ''}
                ${this.boolAttr('disabled') ? 'disabled' : ''}>
              <span class="ui-choice__box ui-choice__box--radio">
                <span class="ui-choice__dot"></span>
              </span>
              <span>${option}</span>
            </label>`
          )
          .join('')}
      </div>
    </fieldset>`;

    this.querySelectorAll('input').forEach((input) =>
      input.addEventListener('change', () => {
        this.setAttribute('value', input.value);
        this.emit('ui-change', { value: input.value });
      })
    );
  }

  get value() {
    return this.querySelector('input:checked')?.value ?? this.attr('value');
  }
  set value(next) { this.setAttribute('value', next); }
}

reflectProps(UiRadioGroup, {
  label: 'string', options: 'string', inline: 'boolean', disabled: 'boolean',
});

define('ui-radio-group', UiRadioGroup);
export { UiRadioGroup };
