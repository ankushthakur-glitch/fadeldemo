/**
 * <ui-section-label> — a tinted band that titles a run of fields or rows.
 *
 * Attributes
 *   variant  brand | neutral | success | warning | critical  (default brand)
 *
 * <ui-section-label variant="warning">Allergies and intolerances</ui-section-label>
 *
 * Give it an id and point the section's aria-labelledby at it and the band
 * becomes the accessible name for that region as well as its heading.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

class UiSectionLabel extends UiElement {
  static observedAttributes = ['variant'];

  connectedCallback() {
    if (this._label === undefined) this._label = this.innerHTML.trim();
    super.connectedCallback();
  }

  render() {
    const variant = this.attr('variant', 'brand');
    this.innerHTML = `<div class="ui-section-label ui-section-label--${variant}">${this._label}</div>`;
  }
}

reflectProps(UiSectionLabel, { variant: 'string' });

define('ui-section-label', UiSectionLabel);
export { UiSectionLabel };
