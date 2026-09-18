/**
 * <ui-button> — the reference component. Every other ui-* follows this shape.
 *
 * Attributes
 *   variant   primary | secondary | tertiary | outline | danger | success | warning
 *   size      xs | sm | md | lg           (default md = 32px)
 *   icon      icon name shown before the label
 *   icon-end  icon name shown after the label
 *   icon-only square button; you must also set label="…" for screen readers
 *   dropdown  appends a caret
 *   loading   shows a spinner and marks the button busy
 *   loading-label  visible text while loading, e.g. "Signing you in…"
 *   text      replaces the visible label, for a button whose wording changes
 *             with the mode it is in — "Record Complication" / "Save Changes"
 *             on one drawer that both records and edits. Setting .textContent
 *             on the tag CANNOT do this: it wipes the rendered <button>.
 *   disabled
 *   full      stretch to the container width
 *   type      button | submit | reset
 *
 * Events
 *   ui-click  fires on activation with { originalEvent }
 *
 * The label comes from the element's own text, so the tag reads naturally:
 *   <ui-button variant="primary">Sign note</ui-button>
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiButton extends UiElement {
  static observedAttributes = [
    'variant',
    'size',
    'icon',
    'icon-end',
    'icon-only',
    'dropdown',
    'loading',
    'loading-label',
    'disabled',
    'full',
    'type',
    'label',
    'text',
  ];

  connectedCallback() {
    // Capture the author's text once, before we replace the innards with
    // our own markup. Re-renders then reuse it.
    if (this._label === undefined) {
      this._label = this.textContent.trim();
    }
    super.connectedCallback();
  }

  render() {
    const variant = this.attr('variant', 'primary');
    const size = this.attr('size', 'md');
    const iconOnly = this.boolAttr('icon-only');
    const loading = this.boolAttr('loading');
    const disabled = this.boolAttr('disabled') || loading;

    const classes = [
      'ui-btn',
      `ui-btn--${variant}`,
      `ui-btn--${size}`,
      iconOnly && 'ui-btn--icon-only',
      loading && 'ui-btn--loading',
    ]
      .filter(Boolean)
      .join(' ');

    const leadingIcon = this.attr('icon');
    const trailingIcon = this.attr('icon-end');
    const accessibleName = this.attr('label', this._label);

    const parts = [];
    if (loading) {
      parts.push(iconMarkup('spinner', 'ui-icon ui-btn__spinner'));
    } else if (leadingIcon) {
      parts.push(iconMarkup(leadingIcon));
    }

    // While busy the button says what it is doing, and a two-mode button says
    // which mode it is in. Setting .textContent on the host would wipe the
    // rendered <button> entirely, so both swaps are attributes the component
    // owns. Busy wins: what it is doing right now outranks what it is for.
    const visible =
      (loading && this.attr('loading-label')) || this.attr('text') || this._label;
    if (!iconOnly && visible) {
      parts.push(`<span class="ui-btn__label">${visible}</span>`);
    }

    if (!iconOnly && trailingIcon) parts.push(iconMarkup(trailingIcon));
    if (!iconOnly && this.boolAttr('dropdown')) {
      parts.push(iconMarkup('caret-down'));
    }

    this.innerHTML = `<button
      type="${this.attr('type', 'button')}"
      class="${classes}"
      ${disabled ? 'disabled' : ''}
      ${loading ? 'aria-busy="true"' : ''}
      ${iconOnly ? `aria-label="${accessibleName}"` : ''}
    >${parts.join('')}</button>`;

    this.querySelector('button').addEventListener('click', (event) => {
      this.emit('ui-click', { originalEvent: event });
    });
  }

  /** Focus the real <button> when someone calls .focus() on the tag. */
  focus(options) {
    this.querySelector('button')?.focus(options);
  }
}

reflectProps(UiButton, {
  variant: 'string',
  size: 'string',
  icon: 'string',
  'icon-end': 'string',
  'icon-only': 'boolean',
  dropdown: 'boolean',
  loading: 'boolean', 'loading-label': 'string',
  text: 'string',
  disabled: 'boolean',
  full: 'boolean',
  type: 'string',
});

define('ui-button', UiButton);
export { UiButton };
