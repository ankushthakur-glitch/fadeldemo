/**
 * <ui-flag> — a circular country marker.
 *
 * Attributes
 *   country  ISO 3166-1 alpha-2 code, e.g. "us", "in", "gb"
 *   src      a real flag image; takes over from the two-letter fallback
 *   label    accessible name; defaults to the upper-cased code
 *   size     sm | md | lg | xl   (16 / 20 / 24 / 32)
 *
 * <ui-flag country="in" label="India"></ui-flag>
 *
 * The React original wrapped an npm package of 250 flag SVGs. There is no
 * build step here and no bundled artwork, so the default rendering is the
 * country code in a token-coloured disc: same footprint, same alignment, and
 * it still answers "which country" without shipping a sprite sheet.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

class UiFlag extends UiElement {
  static observedAttributes = ['country', 'src', 'label', 'size'];

  render() {
    const country = this.attr('country');
    if (!country && !this.attr('src')) {
      this.innerHTML = '';
      return;
    }

    const src = this.attr('src');
    const size = this.attr('size', 'md');
    const label = this.attr('label') || country.toUpperCase();

    this.innerHTML = `<span class="ui-flag ui-flag--${size}" role="img" aria-label="${label}">
      ${
        src
          ? `<img src="${src}" alt="">`
          : `<span aria-hidden="true">${country.toUpperCase()}</span>`
      }
    </span>`;
  }
}

reflectProps(UiFlag, {
  country: 'string',
  src: 'string',
  label: 'string',
  size: 'string',
});

define('ui-flag', UiFlag);
export { UiFlag };
