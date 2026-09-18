/**
 * <ui-text-link> — an action that looks like a link.
 *
 * Attributes
 *   variant   default | critical | muted   (default default)
 *   size      xs | sm | md | lg            (default md)
 *   icon      icon name shown before the label
 *   icon-end  icon name shown after the label
 *   href      renders a real <a> instead of a <button>
 *   disabled
 *
 * Events
 *   ui-click  fires on activation with { originalEvent }
 *
 * <ui-text-link icon-end="caret-right" href="reports.html">View report</ui-text-link>
 *
 * The button/anchor split is not cosmetic: "Undo" is a button and "View the
 * full report" is a link, and assistive tech announces them differently. A
 * disabled link keeps its <a> and loses its href — anchors ignore the disabled
 * attribute, and swapping the element out mid-interaction would change what a
 * screen reader has already announced.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiTextLink extends UiElement {
  static observedAttributes = [
    'variant',
    'size',
    'icon',
    'icon-end',
    'href',
    'disabled',
  ];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const variant = this.attr('variant', 'default');
    const size = this.attr('size', 'md');
    const icon = this.attr('icon');
    const iconEnd = this.attr('icon-end');
    const href = this.attr('href');
    const disabled = this.boolAttr('disabled');

    const classes = `ui-text-link ui-text-link--${variant} ui-text-link--${size}`;
    const inner = `
      ${icon ? `<span class="ui-text-link__icon" aria-hidden="true">${iconMarkup(icon)}</span>` : ''}
      <span class="ui-text-link__label">${this._label}</span>
      ${iconEnd ? `<span class="ui-text-link__icon" aria-hidden="true">${iconMarkup(iconEnd)}</span>` : ''}
    `;

    this.innerHTML = href
      ? `<a class="${classes}" ${disabled ? 'aria-disabled="true"' : `href="${href}"`}>${inner}</a>`
      : `<button type="button" class="${classes}" ${disabled ? 'disabled' : ''}>${inner}</button>`;

    this.firstElementChild.addEventListener('click', (originalEvent) => {
      if (disabled) {
        originalEvent.preventDefault();
        return;
      }
      this.emit('ui-click', { originalEvent });
    });
  }
}

reflectProps(UiTextLink, {
  variant: 'string',
  size: 'string',
  icon: 'string',
  'icon-end': 'string',
  href: 'string',
  disabled: 'boolean',
});

define('ui-text-link', UiTextLink);
export { UiTextLink };
