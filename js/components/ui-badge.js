/**
 * <ui-badge> — status pill.
 *
 * Attributes
 *   status   critical | warning | success | info | neutral | brand | white
 *            (default neutral)
 *   variant  soft | solid | outline   (default soft)
 *   solid    shorthand for variant="solid"; reserve for the most severe flags
 *   size     sm | md | lg             (default md)
 *   icon     optional icon name shown before the label
 *   dot      a leading dot in the badge's own ink, for a status that needs a
 *            mark but not a glyph
 *
 * <ui-badge status="critical" solid icon="critical">Critical</ui-badge>
 * <ui-badge status="success" variant="outline" dot>Eligible</ui-badge>
 *
 * Outline drops the tint and keeps the ring. It is for a badge sitting on a
 * surface that is already tinted — a highlighted row, an alert body — where
 * the badge's own fill would stack into a third colour nobody chose.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiBadge extends UiElement {
  static observedAttributes = [
    'status',
    'variant',
    'solid',
    'size',
    'icon',
    'dot',
  ];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    // `solid` predates `variant` and is used across the screens; it stays as a
    // shorthand rather than becoming a second way to say the same thing badly.
    const variant = this.boolAttr('solid') ? 'solid' : this.attr('variant', 'soft');
    const size = this.attr('size', 'md');

    const classes = [
      'ui-badge',
      `ui-badge--${this.attr('status', 'neutral')}`,
      size !== 'md' && `ui-badge--${size}`,
      variant === 'solid' && 'ui-badge--solid',
      variant === 'outline' && 'ui-badge--outline',
    ]
      .filter(Boolean)
      .join(' ');

    const icon = this.attr('icon');

    this.innerHTML = `<span class="${classes}">${
      this.boolAttr('dot') ? '<span class="ui-badge__dot" aria-hidden="true"></span>' : ''
    }${icon ? iconMarkup(icon) : ''}<span>${this._label}</span></span>`;
  }
}

reflectProps(UiBadge, {
  status: 'string',
  variant: 'string',
  solid: 'boolean',
  size: 'string',
  icon: 'string',
  dot: 'boolean',
});

define('ui-badge', UiBadge);
export { UiBadge };
