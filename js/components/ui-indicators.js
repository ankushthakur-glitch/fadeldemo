/**
 * Three small indicators that share one file because each is only a few lines.
 *
 * <ui-status-dot status="critical">Critical</ui-status-dot>
 * <ui-chip removable>Diabetes Type 2</ui-chip>      → fires ui-close
 * <ui-avatar name="Priya Raman" size="sm"></ui-avatar>
 *
 * All three now carry the full variant set from the MediNova component library:
 * the dot has sizes, an outline ring and a pulse; the chip has a colour axis,
 * an outline form and a selectable mode; the avatar has a tint palette, the
 * larger sizes, and a status dot it can wear.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

/* --- ui-status-dot -------------------------------------------------------- */

/**
 * <ui-status-dot> — a coloured mark, with or without a word beside it.
 *
 * Attributes
 *   status   critical | warning | success | info | neutral | brand
 *   size     sm | md | lg | xl   (default md)
 *   outline  a ring in the surface colour, for a dot drawn on an avatar
 *   pulse    an expanding ring, for "happening right now"
 *   label    accessible name when there is no visible text beside the dot
 *
 * Colour alone is not perceivable, so a bare dot MUST carry a label — either
 * as text content or through the label attribute.
 */
class UiStatusDot extends UiElement {
  static observedAttributes = ['status', 'size', 'outline', 'pulse', 'label'];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const status = this.attr('status', 'neutral');
    const size = this.attr('size', 'md');
    const name = this.attr('label');

    const markClasses = [
      'ui-status-dot__mark',
      size !== 'md' && `ui-status-dot__mark--${size}`,
      this.boolAttr('outline') && 'ui-status-dot__mark--outline',
      this.boolAttr('pulse') && 'ui-status-dot__mark--pulse',
    ]
      .filter(Boolean)
      .join(' ');

    // A bare dot is an image with a name; a dot plus text is just decoration
    // in front of that text, and naming it twice would read it out twice.
    this.innerHTML = `<span class="ui-status-dot ui-status-dot--${status}"
      ${this._label ? '' : `role="img" aria-label="${name || status}"`}>
      <span class="${markClasses}"></span>
      ${this._label ? `<span>${this._label}</span>` : ''}
    </span>`;
  }
}
reflectProps(UiStatusDot, {
  status: 'string',
  size: 'string',
  outline: 'boolean',
  pulse: 'boolean',
  label: 'string',
});
define('ui-status-dot', UiStatusDot);

/* --- ui-chip -------------------------------------------------------------- */

/**
 * <ui-chip> — a compact tag.
 *
 * Attributes
 *   status      brand | success | warning | critical | neutral | white
 *   variant     filled | outline   (default filled)
 *   size        sm | md | lg       (default md)
 *   icon        icon name shown before the label
 *   selectable  makes the chip a toggle button
 *   selected    the toggle's pressed state
 *   removable   shows an ✕
 *   disabled
 *
 * Events
 *   ui-close   removed;  cancellable
 *   ui-change  toggled;  { selected }
 *
 * A selectable chip is a real toggle button carrying aria-pressed. When it is
 * also removable the ✕ sits BESIDE the toggle rather than inside it — two
 * buttons cannot nest, and a remove control swallowed by a toggle would fire
 * the wrong action about half the time.
 */
class UiChip extends UiElement {
  static observedAttributes = [
    'status',
    'variant',
    'size',
    'icon',
    'selectable',
    'selected',
    'removable',
    'disabled',
  ];

  connectedCallback() {
    if (this._label === undefined) this._label = this.textContent.trim();
    super.connectedCallback();
  }

  render() {
    const removable = this.boolAttr('removable');
    const selectable = this.boolAttr('selectable');
    const selected = this.boolAttr('selected');
    const disabled = this.boolAttr('disabled');
    const icon = this.attr('icon');
    const size = this.attr('size', 'md');

    const classes = [
      'ui-chip',
      `ui-chip--${this.attr('status', 'neutral')}`,
      this.attr('variant') === 'outline' && 'ui-chip--outline',
      size !== 'md' && `ui-chip--${size}`,
      !removable && 'ui-chip--no-remove',
      selectable && selected && 'ui-chip--selected',
      disabled && 'ui-chip--disabled',
    ]
      .filter(Boolean)
      .join(' ');

    const inner = `
      ${icon ? `<span class="ui-chip__icon" aria-hidden="true">${iconMarkup(icon)}</span>` : ''}
      <span>${this._label}</span>`;

    const remove = removable
      ? `<button type="button" class="ui-chip__remove" ${disabled ? 'disabled' : ''}
           aria-label="Remove ${this._label}">${iconMarkup('close')}</button>`
      : '';

    this.innerHTML = `<span class="${classes}">
      ${
        selectable
          ? `<button type="button" class="ui-chip__toggle" aria-pressed="${selected}"
               ${disabled ? 'disabled' : ''}>${inner}</button>`
          : inner
      }
      ${remove}
    </span>`;

    this.querySelector('.ui-chip__toggle')?.addEventListener('click', () => {
      const next = !this.boolAttr('selected');
      this.setBoolAttr('selected', next);
      this.emit('ui-change', { selected: next, value: this._label });
    });

    this.querySelector('.ui-chip__remove')?.addEventListener('click', () => {
      // Cancellable: call preventDefault() in your listener to keep the chip.
      const event = this.emit('ui-close', { value: this._label });
      if (!event.defaultPrevented) this.remove();
    });
  }
}
reflectProps(UiChip, {
  status: 'string',
  variant: 'string',
  size: 'string',
  icon: 'string',
  selectable: 'boolean',
  selected: 'boolean',
  removable: 'boolean',
  disabled: 'boolean',
});
define('ui-chip', UiChip);

/* --- ui-avatar ------------------------------------------------------------ */

/**
 * <ui-avatar> — a person, as a circle.
 *
 * Attributes
 *   name    used for the initials and the accessible name
 *   src     a photograph; takes over from the initials
 *   size    xs | sm | md | lg | xl | 2xl | 3xl   (default md)
 *   color   grey | violet | yellow | green | brand   (default brand)
 *   status  critical | warning | success | info | neutral | brand — draws a dot
 *
 * <ui-avatar name="Priya Raman" color="violet" status="success"></ui-avatar>
 *
 * The colour is decoration and never carries meaning: it exists so a care-team
 * list does not read as one grey block. State is the status dot's job, which
 * is why the two are separate attributes rather than one.
 */
class UiAvatar extends UiElement {
  static observedAttributes = ['name', 'src', 'size', 'color', 'status'];

  render() {
    const name = this.attr('name');
    const src = this.attr('src');
    const size = this.attr('size', 'md');
    const color = this.attr('color', 'brand');
    const status = this.attr('status');

    // Initials: first letter of the first two words. "Priya Raman" → "PR"
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] || '')
      .join('')
      .toUpperCase();

    const label = name || 'User avatar';

    // Dot sizes track the avatar so it stays a mark rather than a second face.
    const dotSize = { xs: 'sm', sm: 'sm', md: 'md', lg: 'md' }[size] || 'lg';

    this.innerHTML = `<span class="ui-avatar ui-avatar--${size}${
      src ? '' : ` ui-avatar--${color}`
    }" title="${label}">
      ${
        src
          ? `<img src="${src}" alt="">`
          : initials
            ? `<span aria-hidden="true">${initials}</span>`
            : iconMarkup('user')
      }
      <span class="u-sr-only">${label}</span>
      ${
        status
          ? `<span class="ui-avatar__status">
               <ui-status-dot status="${status}" size="${dotSize}" outline
                 label="${status}"></ui-status-dot>
             </span>`
          : ''
      }
    </span>`;
  }
}
reflectProps(UiAvatar, {
  name: 'string',
  src: 'string',
  size: 'string',
  color: 'string',
  status: 'string',
});
define('ui-avatar', UiAvatar);

export { UiStatusDot, UiChip, UiAvatar };
