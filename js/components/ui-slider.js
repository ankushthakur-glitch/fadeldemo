/**
 * <ui-slider> — pick a value in a range.
 *
 * Attributes
 *   value, min, max, step
 *   size        sm | md    (default md)
 *   icon        icon name before the track
 *   icon-end    icon name after the track
 *   show-value  print the current value at the end
 *   suffix      what follows that value    (default "%")
 *   disabled
 *   aria-label  what is being set; pass one
 *
 * Events
 *   ui-input   on every move,  { value }
 *   ui-change  on release,     { value }
 *
 * <ui-slider min="0" max="10" value="4" suffix=" / 10" show-value
 *   aria-label="Pain score"></ui-slider>
 *
 * A real <input type="range"> underneath, so arrow keys, Home/End and the
 * screen-reader announcement all come free. The only thing this adds is the
 * filled part of the track, painted from a custom property recomputed on move.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiSlider extends UiElement {
  static observedAttributes = [
    'value',
    'min',
    'max',
    'step',
    'size',
    'icon',
    'icon-end',
    'show-value',
    'suffix',
    'disabled',
  ];

  render() {
    const min = Number(this.attr('min', '0'));
    const max = Number(this.attr('max', '100'));
    const step = this.attr('step', '1');
    const value = Number(this.attr('value', String(min)));
    const size = this.attr('size', 'md');
    const icon = this.attr('icon');
    const iconEnd = this.attr('icon-end');
    const suffix = this.getAttribute('suffix') ?? '%';
    const disabled = this.boolAttr('disabled');
    const name = this.getAttribute('aria-label');

    const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;

    this.innerHTML = `<div class="ui-slider ui-slider--${size}${
      disabled ? ' ui-slider--disabled' : ''
    }">
      ${icon ? `<span class="ui-slider__adornment" aria-hidden="true">${iconMarkup(icon)}</span>` : ''}
      <input type="range" class="ui-slider__input" style="--slider-fill: ${fill}%"
        value="${value}" min="${min}" max="${max}" step="${step}"
        ${disabled ? 'disabled' : ''} ${name ? `aria-label="${name}"` : ''}>
      ${iconEnd ? `<span class="ui-slider__adornment" aria-hidden="true">${iconMarkup(iconEnd)}</span>` : ''}
      ${
        this.boolAttr('show-value')
          ? `<span class="ui-slider__value">${value}${suffix}</span>`
          : ''
      }
    </div>`;

    const input = this.querySelector('input');
    const readout = this.querySelector('.ui-slider__value');

    // Repaint in place rather than re-rendering: a full render would replace
    // the input mid-drag and the pointer would lose its grip on the thumb.
    input.addEventListener('input', () => {
      const next = Number(input.value);
      const pct = max === min ? 0 : ((next - min) / (max - min)) * 100;
      input.style.setProperty('--slider-fill', `${pct}%`);
      if (readout) readout.textContent = `${next}${suffix}`;
      this.emit('ui-input', { value: next });
    });

    input.addEventListener('change', () => {
      this.setAttribute('value', input.value);
      this.emit('ui-change', { value: Number(input.value) });
    });
  }
}

reflectProps(UiSlider, {
  value: 'string',
  min: 'string',
  max: 'string',
  step: 'string',
  size: 'string',
  icon: 'string',
  'icon-end': 'string',
  'show-value': 'boolean',
  suffix: 'string',
  disabled: 'boolean',
});

define('ui-slider', UiSlider);
export { UiSlider };
