/**
 * <ui-avatar-group> — overlapping avatars with a +N overflow.
 *
 * Attributes
 *   people  JSON array of { name, src } — the avatars to draw
 *   max     how many to show before collapsing to +N   (default 4)
 *   size    xs | sm | md | lg                          (default md)
 *
 * <ui-avatar-group max="3" people='[{"name":"Priya Raman"},{"name":"Sam Okafor"}]'>
 * </ui-avatar-group>
 *
 * Composes <ui-avatar> rather than redrawing a circle, so a change to the
 * avatar's initials logic or its colour palette lands here for free. The ring
 * in the surface colour is what makes the stack read as separate faces.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

class UiAvatarGroup extends UiElement {
  static observedAttributes = ['people', 'max', 'size'];

  /** Accepts a real array set from JS, or a JSON string from the attribute. */
  set people(value) {
    this._people = value;
    if (this._upgraded) this.render();
  }

  get people() {
    if (this._people) return this._people;
    try {
      return JSON.parse(this.attr('people', '[]'));
    } catch {
      return [];
    }
  }

  render() {
    const people = this.people;
    const max = Number(this.attr('max', '4'));
    const size = this.attr('size', 'md');

    const visible = people.slice(0, max);
    const overflow = people.length - visible.length;

    this.innerHTML = `<div class="ui-avatar-group ui-avatar-group--${size}">
      ${visible
        .map(
          (person) => `<span class="ui-avatar-group__item">
            <ui-avatar size="${size}" name="${person.name || ''}"${
              person.src ? ` src="${person.src}"` : ''
            }></ui-avatar>
          </span>`
        )
        .join('')}
      ${
        overflow > 0
          ? `<span class="ui-avatar-group__item ui-avatar-group__more"
               role="img" aria-label="${overflow} more">+${overflow}</span>`
          : ''
      }
    </div>`;
  }
}

reflectProps(UiAvatarGroup, { max: 'string', size: 'string' });

define('ui-avatar-group', UiAvatarGroup);
export { UiAvatarGroup };
