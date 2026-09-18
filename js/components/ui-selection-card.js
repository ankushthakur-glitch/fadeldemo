/**
 * <ui-selection-card> — a radio or checkbox wearing a card.
 *
 * Attributes
 *   card-title   the bold first line
 *   description  the quieter second line
 *   icon         icon name shown at the leading edge
 *   type         radio | checkbox   (default radio)
 *   name         groups radio cards, exactly as a bare radio would
 *   value        what the form submits when this card is picked
 *   selected     checked state
 *   disabled
 *   invalid
 *   size         sm | md            (default md)
 *
 * Events
 *   ui-change  { value, selected }
 *
 * <ui-selection-card name="visit" value="video" icon="chat"
 *   card-title="Video visit" description="30 minutes, from anywhere">
 * </ui-selection-card>
 *
 * The native input is still there — one pixel wide and invisible — and it is
 * what carries the checked state, the name grouping, the keyboard behaviour
 * and the form value. The card is paint on top of a real control, not a
 * replacement for one.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiSelectionCard extends UiElement {
  static observedAttributes = [
    'card-title',
    'description',
    'icon',
    'type',
    'name',
    'value',
    'selected',
    'disabled',
    'invalid',
    'size',
  ];

  render() {
    const title = this.attr('card-title');
    const description = this.attr('description');
    const icon = this.attr('icon');
    const type = this.attr('type', 'radio');
    const name = this.attr('name');
    const value = this.attr('value');
    const size = this.attr('size', 'md');
    const selected = this.boolAttr('selected');
    const disabled = this.boolAttr('disabled');
    const invalid = this.boolAttr('invalid');

    const classes = [
      'ui-selection-card',
      `ui-selection-card--${size}`,
      selected && 'ui-selection-card--selected',
      disabled && 'ui-selection-card--disabled',
      invalid && 'ui-selection-card--invalid',
    ]
      .filter(Boolean)
      .join(' ');

    this.innerHTML = `<label class="${classes}">
      <input type="${type}" class="ui-selection-card__input"
        ${name ? `name="${name}"` : ''} ${value ? `value="${value}"` : ''}
        ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}
        ${invalid ? 'aria-invalid="true"' : ''}>
      ${icon ? `<span class="ui-selection-card__icon" aria-hidden="true">${iconMarkup(icon)}</span>` : ''}
      <span class="ui-selection-card__body">
        <span class="ui-selection-card__title">${title}</span>
        ${description ? `<span class="ui-selection-card__desc">${description}</span>` : ''}
      </span>
    </label>`;

    this.querySelector('input').addEventListener('change', (event) => {
      this.setBoolAttr('selected', event.target.checked);
      // Radio cards in the same group must drop their own selected flag, or
      // two cards would stay painted while only one input is really checked.
      if (type === 'radio' && name) {
        this.getRootNode()
          .querySelectorAll(`ui-selection-card[name="${name}"]`)
          .forEach((card) => {
            if (card !== this) card.removeAttribute('selected');
          });
      }
      this.emit('ui-change', { value, selected: event.target.checked });
    });
  }
}

reflectProps(UiSelectionCard, {
  'card-title': 'string',
  description: 'string',
  icon: 'string',
  type: 'string',
  name: 'string',
  value: 'string',
  selected: 'boolean',
  disabled: 'boolean',
  invalid: 'boolean',
  size: 'string',
});

define('ui-selection-card', UiSelectionCard);
export { UiSelectionCard };
