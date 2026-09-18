/**
 * <ui-command-bar> — the command palette.
 *
 * Attributes
 *   groups       JSON array of { heading?, commands: [{ id, label, icon?, shortcut? }] }
 *   placeholder  search field placeholder
 *   empty-text   what to say when nothing matches
 *
 * Events
 *   ui-search  { query }          typed in the field
 *   ui-select  { id, command }    a command was chosen
 *
 * <ui-command-bar groups='[{"heading":"Patients","commands":[
 *   {"id":"new","label":"New patient","icon":"user-plus","shortcut":["⌘","N"]}]}]'>
 * </ui-command-bar>
 *
 * The field is an ARIA combobox pointed at the results list, which is what
 * lets the highlighted command be announced while the caret stays where the
 * user is still typing. Moving real focus into the list on every arrow key
 * would take the caret out of the field mid-word.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let paletteSeq = 0;

class UiCommandBar extends UiElement {
  static observedAttributes = ['groups', 'placeholder', 'empty-text'];

  set groups(value) {
    this._groups = value;
    if (this._upgraded) this.render();
  }

  get groups() {
    if (this._groups) return this._groups;
    try {
      return JSON.parse(this.attr('groups', '[]'));
    } catch {
      return [];
    }
  }

  render() {
    const groups = this.groups;
    const placeholder = this.attr('placeholder', 'Search for anything…');
    const emptyText = this.attr('empty-text', 'No results found');
    const base = (this._id ||= `ui-command-bar-${++paletteSeq}`);

    // One flat ordered list behind the grouped display, so there is a single
    // active index to move rather than a group index plus an item index.
    const flat = groups.flatMap((group) => group.commands || []);
    let active = flat.length ? 0 : -1;

    let running = -1;
    const groupMarkup = groups
      .map((group) => {
        const rows = (group.commands || [])
          .map((command) => {
            running += 1;
            const index = running;
            return `<button type="button" role="option" id="${base}-opt-${index}"
              data-index="${index}" aria-selected="${index === active}"
              class="ui-command-bar__item${index === active ? ' ui-command-bar__item--active' : ''}">
              ${command.icon ? `<span class="ui-command-bar__icon" aria-hidden="true">${iconMarkup(command.icon)}</span>` : ''}
              <span class="ui-command-bar__label">${command.label}</span>
              ${
                command.shortcut
                  ? `<span class="ui-command-bar__shortcut">${command.shortcut
                      .map((key) => `<kbd class="ui-command-bar__kbd">${key}</kbd>`)
                      .join('')}</span>`
                  : ''
              }
            </button>`;
          })
          .join('');

        return `<div class="ui-command-bar__group">
          ${group.heading ? `<div class="ui-command-bar__heading">${group.heading}</div>` : ''}
          ${rows}
        </div>`;
      })
      .join('');

    this.innerHTML = `<div class="ui-command-bar">
      <div class="ui-command-bar__search">
        ${iconMarkup('search', 'ui-icon ui-command-bar__search-icon')}
        <input type="text" class="ui-command-bar__input" placeholder="${placeholder}"
          role="combobox" aria-label="Search commands" aria-autocomplete="list"
          aria-expanded="${flat.length > 0}" aria-controls="${base}-list"
          ${active >= 0 ? `aria-activedescendant="${base}-opt-${active}"` : ''}>
      </div>
      <div id="${base}-list" class="ui-command-bar__list" role="listbox">
        ${flat.length ? groupMarkup : `<div class="ui-command-bar__empty">${emptyText}</div>`}
      </div>
    </div>`;

    const input = this.querySelector('input');
    const rows = [...this.querySelectorAll('.ui-command-bar__item')];

    const highlight = (index) => {
      active = index;
      rows.forEach((row, i) => {
        row.classList.toggle('ui-command-bar__item--active', i === index);
        row.setAttribute('aria-selected', String(i === index));
      });
      input.setAttribute('aria-activedescendant', `${base}-opt-${index}`);
    };

    const choose = (index) => {
      const command = flat[index];
      if (command) this.emit('ui-select', { id: command.id, command });
    };

    rows.forEach((row, index) => {
      row.addEventListener('click', () => choose(index));
      row.addEventListener('mouseenter', () => highlight(index));
    });

    input.addEventListener('input', () => this.emit('ui-search', { query: input.value }));

    input.addEventListener('keydown', (event) => {
      if (!rows.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlight((active + 1) % rows.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight((active - 1 + rows.length) % rows.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(active);
      }
    });
  }
}

/* `groups` stays unreflected: the accessor above parses the JSON attribute,
   and a reflected property would shadow it. */
reflectProps(UiCommandBar, {
  placeholder: 'string',
  'empty-text': 'string',
});

define('ui-command-bar', UiCommandBar);
export { UiCommandBar };
