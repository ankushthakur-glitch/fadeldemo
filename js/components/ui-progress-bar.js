/**
 * <ui-progress-bar> — a linear measure.
 *
 * Attributes
 *   value          current progress            (default 0)
 *   max            total                       (default 100)
 *   label          none | left | right         (default none)
 *   variant        brand | success | warning | critical  (default brand)
 *   size           sm | md | lg                (default md)
 *   indeterminate  unknown progress; animates instead of filling
 *   aria-label     what is progressing; pass one, the bar cannot guess
 *
 * <ui-progress-bar value="60" label="right"></ui-progress-bar>
 *
 * An indeterminate bar deliberately carries no aria-valuenow. A number the
 * component cannot honestly supply is worse than no number at all.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

class UiProgressBar extends UiElement {
  static observedAttributes = [
    'value',
    'max',
    'label',
    'variant',
    'size',
    'indeterminate',
  ];

  render() {
    const max = Number(this.attr('max', '100')) || 100;
    const value = Number(this.attr('value', '0')) || 0;
    const variant = this.attr('variant', 'brand');
    const size = this.attr('size', 'md');
    const labelPos = this.attr('label', 'none');
    const indeterminate = this.boolAttr('indeterminate');

    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const rounded = Math.round(pct);
    const showLabel = labelPos !== 'none' && !indeterminate;
    const labelMarkup = `<span class="ui-progress__label">${rounded}%</span>`;

    // The accessible name belongs on the progressbar node, not the wrapper.
    const name = this.getAttribute('aria-label');

    this.innerHTML = `<div class="ui-progress ui-progress--${variant} ui-progress--${size}">
      ${showLabel && labelPos === 'left' ? labelMarkup : ''}
      <div class="ui-progress__track${
        indeterminate ? ' ui-progress__track--indeterminate' : ''
      }" role="progressbar"${name ? ` aria-label="${name}"` : ''}
        ${
          indeterminate
            ? ''
            : `aria-valuenow="${rounded}" aria-valuemin="0" aria-valuemax="100"`
        }>
        <div class="ui-progress__fill"${
          indeterminate ? '' : ` style="width: ${pct}%"`
        }></div>
      </div>
      ${showLabel && labelPos === 'right' ? labelMarkup : ''}
    </div>`;
  }
}

reflectProps(UiProgressBar, {
  value: 'string',
  max: 'string',
  label: 'string',
  variant: 'string',
  size: 'string',
  indeterminate: 'boolean',
});

define('ui-progress-bar', UiProgressBar);
export { UiProgressBar };
