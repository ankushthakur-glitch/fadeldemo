/**
 * <ui-data-table> — dense clinical table.
 *
 * Configure it in JavaScript, because a table's data is data, not markup:
 *   const table = document.querySelector('ui-data-table');
 *   table.columns = [
 *     { key: 'name',  label: 'Patient', truncate: true },
 *     { key: 'mrn',   label: 'MRN',     numeric: true },
 *     { key: 'status', label: 'Status', render: (row) => `<ui-badge …>` },
 *     { key: 'address', label: 'Address', wrap: true, render: (row) => `…<br>…` },
 *   ];
 * `wrap` is the escape hatch from the single-line default — a genuinely
 * multi-part value (a full postal address, a name plus a fax number under
 * it) that would otherwise dump onto one unreadable clipped line. The row
 * grows to fit; every other column keeps its rhythm.
 *   table.rows = [ { name: 'Priya Raman', mrn: '884120', … } ];
 *
 * Attributes
 *   state         ready | loading | empty | error   (default ready)
 *   selectable    adds a checkbox column, plus a select-all box in the header
 *                 that ticks the rows currently rendered (i.e. this page)
 *   sticky-first  freezes the first column when scrolling sideways
 *   density       compact (default) | comfortable
 *   empty-text    what the empty state says; the default names patients, which
 *                 is wrong on a table of codes or payers
 *
 * Events
 *   ui-sort    { key, direction }        header clicked
 *   ui-select  { selected: [rowIds] }    selection changed
 *
 * Properties (set in JS, like columns and rows)
 *   rowClass      (row, index) => string — a class on the <tr>, for a row that
 *                 means something its cells do not say: a flagged observation,
 *                 the latest entry in a trend, stock below its par level
 *
 * Methods
 *   clearSelection()                     unticks everything
 *
 * Keyboard: Tab reaches the header buttons; Up/Down move between rows;
 * Space toggles selection on the focused row.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

/**
 * The select column's box, drawn as the SAME control as every other checkbox
 * in the app rather than as a bare native input.
 *
 * It used to be a raw <input type="checkbox">, which meant the densest and
 * most-clicked checkbox in the product was the one place the design system did
 * not reach: the operating system drew it, at whatever size and in whatever
 * blue that OS prefers. Reusing .ui-choice__box gets the 20px target, the
 * brand fill, the focus ring and — the reason this matters most here — the
 * mixed-state dash, which is the header box's normal condition whenever some
 * but not all of the page is selected.
 *
 * The functional classes stay ON THE INPUT, so every selector in #wireEvents
 * and #syncSelectAll still finds what it expects.
 */
function selectBox(className, label, checked, extraAttrs = '') {
  /* A <label>, not a <span>. The input is 1px and invisible, so the label is
     the only thing making the 20px box clickable — everywhere else that job is
     done by the label the author already wrote around their own text. Without
     it the select column looked like a checkbox and did nothing when clicked. */
  return `<label class="ui-choice ui-table__check">
    <input type="checkbox" class="ui-choice__input ${className}"${extraAttrs}
      aria-label="${label}"${checked ? ' checked' : ''}>
    <span class="ui-choice__box">
      ${iconMarkup('check-bold', 'ui-icon ui-choice__mark')}
      ${iconMarkup('minus-bold', 'ui-icon ui-choice__mark ui-choice__mark--mixed')}
    </span>
  </label>`;
}

class UiDataTable extends UiElement {
  static observedAttributes = [
    'state', 'selectable', 'sticky-first', 'density', 'empty-text',
  ];

  #columns = [];
  #rows = [];
  /* Optional (row, index) → class string, for tables where a row means
     something the cells do not say on their own: a flagged observation, the
     latest entry in a trend, an item below its par level. Set alongside rows;
     absent, every row is drawn the same as before. */
  #rowClass = null;
  #sortKey = null;
  #sortDir = 'none';
  #selected = new Set();

  set columns(value) { this.#columns = value; this.render(); }
  get columns() { return this.#columns; }

  set rows(value) { this.#rows = value; this.render(); }
  get rows() { return this.#rows; }

  set rowClass(value) { this.#rowClass = value; this.render(); }
  get rowClass() { return this.#rowClass; }

  get selected() { return [...this.#selected]; }

  /**
   * Drop the current selection.
   *
   * Selection survives a change of `rows` on purpose — re-sorting a table
   * should not lose your ticks. But a screen that FILTERS rows has to be able
   * to reset it, or a "Delete (3)" button ends up acting on rows that are no
   * longer on screen. Without this the only way out was to throw the whole
   * element away, which also resets the sort direction.
   */
  clearSelection() {
    if (!this.#selected.size) return;
    this.#selected.clear();
    this.render();
    this.emit('ui-select', { selected: [] });
  }

  render() {
    if (!this._upgraded) return;
    const state = this.attr('state', 'ready');

    if (state !== 'ready') {
      this.innerHTML = `<div class="ui-table-wrap">${this.#stateMarkup(state)}</div>`;
      return;
    }

    const selectable = this.boolAttr('selectable');
    const tableClass = [
      'ui-table',
      this.boolAttr('sticky-first') && 'ui-table--sticky-first',
    ].filter(Boolean).join(' ');

    this.innerHTML = `<div class="ui-table-wrap">
      <table class="${tableClass}">
        <thead><tr>
          ${selectable ? `<th scope="col">${selectBox(
            'ui-table__select-all',
            'Select all rows',
            this.#allSelected()
          )}</th>` : ''}
          ${this.#columns.map((col) => this.#headerCell(col)).join('')}
        </tr></thead>
        <tbody>${this.#rows.map((row, i) => this.#bodyRow(row, i, selectable)).join('')}</tbody>
      </table>
    </div>`;

    this.#wireEvents(selectable);
  }

  /** True when every row currently rendered is ticked — what the header box
   *  reports. Deliberately about the RENDERED rows, not the whole data set: a
   *  paged table only ever offers you the page you can see. */
  #allSelected() {
    return this.#rows.length > 0 && this.#rows.every((row, i) => this.#selected.has(row.id ?? String(i)));
  }

  /** Bring the header box in line with the row boxes without a re-render. */
  #syncSelectAll() {
    const all = this.querySelector('.ui-table__select-all');
    if (!all) return;
    const some = this.#rows.some((row, i) => this.#selected.has(row.id ?? String(i)));
    all.checked = this.#allSelected();
    all.indeterminate = some && !all.checked;
  }

  #headerCell(col) {
    // `narrow` has to be on the <th> as well as the <td>: a column is laid out
    // from every cell in it, and a header word wider than the swatch under it
    // would set the width on its own.
    const narrow = col.narrow ? ' class="ui-table__cell--narrow"' : '';
    if (!col.sortable) {
      return `<th scope="col"${narrow}>${col.label}</th>`;
    }
    const active = this.#sortKey === col.key;
    const dir = active ? this.#sortDir : 'none';
    const icon = !active ? 'sort' : dir === 'ascending' ? 'sort-asc' : 'sort-desc';
    // aria-sort lives on the columnheader (the <th>) only. Putting it on the
    // button too is invalid ARIA — a button has no sortable role.
    return `<th scope="col" aria-sort="${dir}"${narrow}>
      <button type="button" class="ui-table__sort"
        data-sort-key="${col.key}">${col.label}${iconMarkup(icon)}</button>
    </th>`;
  }

  #bodyRow(row, index, selectable) {
    const id = row.id ?? String(index);
    const isSelected = this.#selected.has(id);
    const cells = this.#columns.map((col) => {
      const classes = [
        col.truncate && 'ui-table__cell--truncate',
        col.numeric && 'ui-table__cell--numeric',
        col.actions && 'ui-table__cell--actions',
        col.wrap && 'ui-table__cell--wrap',
        col.narrow && 'ui-table__cell--narrow',
      ].filter(Boolean).join(' ');
      // A column without its own render() shows a plain value, so it is text
      // and gets escaped. Screens that want markup say so with render().
      const content = col.render ? col.render(row) : escapeHtml(row[col.key]);
      const title = col.truncate ? ` title="${escapeHtml(row[col.key])}"` : '';
      return `<td${classes ? ` class="${classes}"` : ''}${title}>${content}</td>`;
    }).join('');

    const rowClasses = this.#rowClass ? this.#rowClass(row, index) : '';

    return `<tr tabindex="-1" data-row-id="${id}" aria-selected="${isSelected}"${
      rowClasses ? ` class="${escapeHtml(rowClasses)}"` : ''
    }>
      ${selectable ? `<td>${selectBox(
        'ui-table__select',
        `Select row ${index + 1}`,
        isSelected,
        ` data-row-id="${id}"`
      )}</td>` : ''}
      ${cells}
    </tr>`;
  }

  #stateMarkup(state) {
    if (state === 'loading') {
      const bar = '<div class="ui-table__skeleton"></div>';
      return `<div class="ui-table__state" role="status" aria-live="polite">
        <span class="u-sr-only">Loading</span>
        <div class="ui-table__skeleton-stack">${bar.repeat(5)}</div>
      </div>`;
    }
    if (state === 'error') {
      return `<div class="ui-table__state ui-table__state--error" role="alert">
        ${iconMarkup('critical')}<span>Could not load results. Try again.</span>
      </div>`;
    }
    return `<div class="ui-table__state">
      ${iconMarkup('search')}<span>${this.attr('empty-text', 'No matching patients.')}</span>
    </div>`;
  }

  #wireEvents(selectable) {
    this.querySelectorAll('[data-sort-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey;
        // Cycle ascending → descending each time the same header is clicked.
        this.#sortDir =
          this.#sortKey === key && this.#sortDir === 'ascending'
            ? 'descending'
            : 'ascending';
        this.#sortKey = key;
        this.emit('ui-sort', { key, direction: this.#sortDir });
        this.render();
      });
    });

    if (selectable) {
      /* Select-all ticks the rows on screen and nothing else. Partial
         selection shows as indeterminate rather than unchecked, so a page
         with three of ten ticked does not read as "nothing selected". */
      const all = this.querySelector('.ui-table__select-all');
      if (all) {
        this.#syncSelectAll();
        all.addEventListener('change', () => {
          this.#rows.forEach((row, i) => {
            const id = row.id ?? String(i);
            if (all.checked) this.#selected.add(id);
            else this.#selected.delete(id);
          });
          this.render();
          this.emit('ui-select', { selected: this.selected });
        });
      }

      this.querySelectorAll('.ui-table__select').forEach((box) => {
        box.addEventListener('change', () => {
          const id = box.dataset.rowId;
          if (box.checked) this.#selected.add(id);
          else this.#selected.delete(id);
          box.closest('tr').setAttribute('aria-selected', String(box.checked));
          // Patched in place rather than re-rendered: a re-render here would
          // replace the very checkbox the pointer is still on. See below.
          this.#syncSelectAll();
          this.emit('ui-select', { selected: this.selected });
        });
      });
    }

    // Arrow-key navigation between rows, Space to toggle selection.
    const bodyRows = [...this.querySelectorAll('tbody tr')];
    bodyRows.forEach((tr, index) => {
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const next = bodyRows[index + (event.key === 'ArrowDown' ? 1 : -1)];
          next?.focus();
        } else if (event.key === ' ' && selectable) {
          event.preventDefault();
          tr.querySelector('.ui-table__select')?.click();
        }
      });
    });
    if (bodyRows[0]) bodyRows[0].tabIndex = 0;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

reflectProps(UiDataTable, {
  state: 'string',
  selectable: 'boolean',
  'sticky-first': 'boolean',
  density: 'string',
  'empty-text': 'string',
});

define('ui-data-table', UiDataTable);
export { UiDataTable };
