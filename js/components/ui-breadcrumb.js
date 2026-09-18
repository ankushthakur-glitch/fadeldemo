/**
 * <ui-breadcrumb> — where the current screen sits in the hierarchy.
 *
 * Attributes
 *   items      JSON array of { label, href?, icon? }
 *   separator  chevron | slash   (default chevron)
 *   size       sm | md           (default md)
 *   max-items  collapse the middle when the trail is longer than this
 *
 * <ui-breadcrumb items='[{"label":"Patients","href":"patient-directory.html"},
 *                        {"label":"Priya Raman"}]'></ui-breadcrumb>
 *
 * The last crumb is the page you are on, so it is text with aria-current, not
 * a link to here. A middle crumb with no href is also text rather than an
 * empty anchor: a link that goes nowhere still costs a keyboard user a press.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiBreadcrumb extends UiElement {
  static observedAttributes = ['items', 'separator', 'size', 'max-items'];

  set items(value) {
    this._items = value;
    if (this._upgraded) this.render();
  }

  get items() {
    if (this._items) return this._items;
    try {
      return JSON.parse(this.attr('items', '[]'));
    } catch {
      return [];
    }
  }

  render() {
    const items = this.items;
    const size = this.attr('size', 'md');
    const separator = this.attr('separator', 'chevron');
    const maxItems = Number(this.attr('max-items', '0'));

    const collapse =
      maxItems >= 2 && !this._expanded && items.length > maxItems;

    const sep = `<span class="ui-breadcrumb__sep" aria-hidden="true">${
      separator === 'slash' ? '/' : iconMarkup('caret-right')
    }</span>`;

    const content = (item) =>
      `${
        item.icon
          ? `<span class="ui-breadcrumb__icon" aria-hidden="true">${iconMarkup(item.icon)}</span>`
          : ''
      }${item.label}`;

    const crumb = (item, isLast) => {
      if (isLast) {
        return `<span class="ui-breadcrumb__current" aria-current="page">${content(item)}</span>`;
      }
      if (item.href) {
        return `<a class="ui-breadcrumb__link" href="${item.href}">${content(item)}</a>`;
      }
      return `<span class="ui-breadcrumb__text">${content(item)}</span>`;
    };

    const last = items.length - 1;
    const body = collapse
      ? `<li class="ui-breadcrumb__item">${crumb(items[0], false)}${sep}</li>
         <li class="ui-breadcrumb__item">
           <button type="button" class="ui-breadcrumb__ellipsis"
             aria-label="Show hidden breadcrumbs" aria-expanded="false">
             ${iconMarkup('more-horizontal')}
           </button>${sep}
         </li>
         <li class="ui-breadcrumb__item">${crumb(items[last], true)}</li>`
      : items
          .map(
            (item, index) =>
              `<li class="ui-breadcrumb__item">${crumb(item, index === last)}${
                index === last ? '' : sep
              }</li>`
          )
          .join('');

    this.innerHTML = `<nav class="ui-breadcrumb ui-breadcrumb--${size}" aria-label="Breadcrumb">
      <ol class="ui-breadcrumb__list">${body}</ol>
    </nav>`;

    this.querySelector('.ui-breadcrumb__ellipsis')?.addEventListener('click', () => {
      this._expanded = true;
      this.render();
    });
  }
}

/* `items` stays unreflected: the accessor below parses the JSON attribute,
   and a reflected property would shadow it. */
reflectProps(UiBreadcrumb, {
  separator: 'string',
  size: 'string',
  'max-items': 'string',
});

define('ui-breadcrumb', UiBreadcrumb);
export { UiBreadcrumb };
