/**
 * Colour swatches for runtime-configurable colours.
 *
 * Appointment-type and status colours are chosen by the clinic, not by the
 * design system, so they cannot be tokens. They also must not become inline
 * style attributes — the house rule forbids those.
 *
 * So: collect the colours, write ONE <style> element, and reference the
 * generated classes from markup. Call registerSwatches() again whenever a
 * colour changes and the rules are rewritten in place.
 */

const STYLE_ID = 'ui-swatch-styles';

/** Turn "#a99cf5" into a class-safe suffix. */
export function swatchClass(hex) {
  return `ui-swatch--${String(hex).replace('#', '').toLowerCase()}`;
}

/**
 * Ensure a rule exists for every colour passed in.
 * @param {string[]} colours - hex strings
 */
export function registerSwatches(colours) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  const unique = [...new Set(colours.filter(Boolean))];
  style.textContent = unique
    .map((hex) => `.${swatchClass(hex)}{background-color:${hex}}`)
    .join('');
}

/** Markup for a single swatch chip. */
export function swatchMarkup(hex, extraClass = '') {
  return `<span class="ui-swatch ${swatchClass(hex)} ${extraClass}" title="${hex}"></span>`;
}
