/**
 * <ui-menu> and <ui-dropdown-menu> — the two list surfaces.
 *
 * They look alike and they are not the same thing:
 *
 *   ui-menu           a list of ACTIONS.  role="menu",    items are buttons,
 *                     picking one DOES something.
 *   ui-dropdown-menu  a list of CHOICES.  role="listbox", items are options,
 *                     picking one CHANGES A VALUE.
 *
 * Conflating them is the most common ARIA mistake in a component library, so
 * they are separate elements rather than one element with a mode flag.
 *
 * Both render the surface only. Opening and positioning belong to whatever
 * owns the trigger — see js/lib/row-menu.js for the pattern used in tables.
 *
 * An item may carry a `testid`, which lands on the button as `data-testid`.
 * The screens that opened hand-built menus had those, and the specs click
 * them; a component that swallowed them would have quietly broken the suite.
 *
 * <ui-menu items='[{"id":"sign","label":"Sign note","icon":"check"},
 *                  {"divider":true},
 *                  {"id":"del","label":"Delete","status":"critical"}]'></ui-menu>
 *
 * Events
 *   ui-select  { id, item }   an item was chosen
 *   ui-close                  Escape was pressed
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

/** Shared by both elements: parse a JSON attribute, or take a real array. */
function listFrom(element, attribute) {
  if (element._items) return element._items;
  try {
    return JSON.parse(element.attr(attribute, '[]'));
  } catch {
    return [];
  }
}

class UiMenu extends UiElement {
  static observedAttributes = ['items'];

  set items(value) {
    this._items = value;
    if (this._upgraded) this.render();
  }

  get items() {
    return listFrom(this, 'items');
  }

  render() {
    const items = this.items;

    this.innerHTML = `<div class="ui-menu" role="menu">
      ${items
        .map((item, index) => {
          if (item.divider) {
            return '<div class="ui-menu__divider" role="separator"></div>';
          }
          const classes = [
            'ui-menu__item',
            item.selected && 'ui-menu__item--selected',
            item.status && `ui-menu__item--${item.status}`,
          ]
            .filter(Boolean)
            .join(' ');

          return `<button type="button" role="menuitem" class="${classes}"
            data-index="${index}" ${item.testid ? `data-testid="${item.testid}"` : ''}
            ${item.disabled ? 'disabled' : ''}>
            ${item.icon ? `<span class="ui-menu__icon" aria-hidden="true">${iconMarkup(item.icon)}</span>` : ''}
            <span class="ui-menu__body">
              <span class="ui-menu__label">${item.label ?? ''}</span>
              ${item.description ? `<span class="ui-menu__desc">${item.description}</span>` : ''}
            </span>
            ${item.selected ? `<span class="ui-menu__check" aria-hidden="true">${iconMarkup('check')}</span>` : ''}
            ${item.trailing ? `<span class="ui-menu__trailing">${item.trailing}</span>` : ''}
          </button>`;
        })
        .join('')}
    </div>`;

    const buttons = [...this.querySelectorAll('.ui-menu__item:not(:disabled)')];

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const item = items[Number(button.dataset.index)];
        this.emit('ui-select', { id: item.id, item });
      });

      // Roving focus per role="menu": the arrows walk the enabled items and
      // wrap, Home/End go to the ends, Escape hands closing back to the owner.
      button.addEventListener('keydown', (event) => {
        const here = buttons.indexOf(button);
        const move = (delta) => {
          event.preventDefault();
          buttons[(here + delta + buttons.length) % buttons.length].focus();
        };
        if (event.key === 'ArrowDown') move(1);
        else if (event.key === 'ArrowUp') move(-1);
        else if (event.key === 'Home') {
          event.preventDefault();
          buttons[0].focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          buttons[buttons.length - 1].focus();
        } else if (event.key === 'Escape') this.emit('ui-close', {});
      });
    });
  }
}

/* `items` is NOT reflected: this element defines its own accessor, which
   parses the JSON attribute (or takes a real array set from JS). A reflected
   property would shadow it and hand the render a string. */
reflectProps(UiMenu, {});
define('ui-menu', UiMenu);

/* --- ui-dropdown-menu ----------------------------------------------------- */

let listboxSeq = 0;

class UiDropdownMenu extends UiElement {
  static observedAttributes = ['items', 'value'];

  set items(value) {
    this._items = value;
    if (this._upgraded) this.render();
  }

  get items() {
    return listFrom(this, 'items');
  }

  render() {
    const options = this.items;
    const value = this.attr('value');
    const base = (this._id ||= `ui-dropdown-${++listboxSeq}`);
    let active = options.findIndex((option) => option.value === value);

    this.innerHTML = `<ul id="${base}" class="ui-dropdown-menu" role="listbox" tabindex="0"
      ${active >= 0 ? `aria-activedescendant="${base}-opt-${active}"` : ''}>
      ${options
        .map((option, index) => {
          const selected = option.value === value;
          const classes = [
            'ui-dropdown-menu__option',
            selected && 'ui-dropdown-menu__option--selected',
            index === active && 'ui-dropdown-menu__option--active',
            option.disabled && 'ui-dropdown-menu__option--disabled',
          ]
            .filter(Boolean)
            .join(' ');

          return `<li id="${base}-opt-${index}" role="option" class="${classes}"
            data-index="${index}" aria-selected="${selected}"
            ${option.disabled ? 'aria-disabled="true"' : ''}>
            ${option.icon ? `<span class="ui-dropdown-menu__icon" aria-hidden="true">${iconMarkup(option.icon)}</span>` : ''}
            <span class="ui-dropdown-menu__body">
              <span class="ui-dropdown-menu__label">${option.label}</span>
              ${option.description ? `<span class="ui-dropdown-menu__desc">${option.description}</span>` : ''}
            </span>
            ${selected ? `<span class="ui-dropdown-menu__check" aria-hidden="true">${iconMarkup('check')}</span>` : ''}
          </li>`;
        })
        .join('')}
    </ul>`;

    const list = this.querySelector('ul');
    const rows = [...this.querySelectorAll('.ui-dropdown-menu__option')];

    const choose = (index) => {
      const option = options[index];
      if (!option || option.disabled) return;
      this.setAttribute('value', option.value);
      this.emit('ui-select', { value: option.value, option });
    };

    // Highlight without moving DOM focus: the listbox itself keeps focus and
    // aria-activedescendant tells the screen reader which row is current.
    const highlight = (index) => {
      active = index;
      rows.forEach((row, i) =>
        row.classList.toggle('ui-dropdown-menu__option--active', i === index)
      );
      list.setAttribute('aria-activedescendant', `${base}-opt-${index}`);
    };

    const nextEnabled = (from, direction) => {
      for (let i = from + direction; i >= 0 && i < options.length; i += direction) {
        if (!options[i].disabled) return i;
      }
      return -1;
    };

    rows.forEach((row, index) => {
      row.addEventListener('click', () => choose(index));
      row.addEventListener('mouseenter', () => {
        if (!options[index].disabled) highlight(index);
      });
    });

    list.addEventListener('keydown', (event) => {
      let target = -1;
      if (event.key === 'ArrowDown') target = nextEnabled(active < 0 ? -1 : active, 1);
      else if (event.key === 'ArrowUp')
        target = nextEnabled(active < 0 ? options.length : active, -1);
      else if (event.key === 'Home') target = nextEnabled(-1, 1);
      else if (event.key === 'End') target = nextEnabled(options.length, -1);
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(active);
        return;
      } else return;

      event.preventDefault();
      if (target !== -1) highlight(target);
    });
  }
}

/* `items` stays unreflected — see the note on UiMenu above. */
reflectProps(UiDropdownMenu, { value: 'string' });
define('ui-dropdown-menu', UiDropdownMenu);

export { UiMenu, UiDropdownMenu };
