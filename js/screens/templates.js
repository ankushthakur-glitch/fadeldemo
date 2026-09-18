/**
 * Settings ▸ Templates — the list.
 *
 * Seven tabs. Six of them list TEMPLATES, which are ordered lists of sections
 * and are therefore built in the builder (template-builder.html). The seventh
 * lists MACROS, which are a title and a paragraph and are created here in a
 * two-field dialog.
 *
 * That split is the only real branching on this screen, so it is named once —
 * `isMacros` — and everything downstream reads it: which columns the table
 * gets, what the create button says, and where it goes.
 *
 * Edits are session-only, like every other list in this prototype: the arrays
 * are copied at load so a delete here does not follow you to the next screen.
 */
import {
  TEMPLATE_KINDS,
  kindById,
  TEMPLATES,
  MACROS,
  sectionById,
} from '../../data/templates.js';
import { createPager } from '../lib/pagination.js';
import { openRowMenu as openRowMenu_, closeRowMenu } from '../lib/row-menu.js';

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const icon = (name) => `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

/* Copied, not referenced: a delete on this screen must not reach into the
   module the builder and every other screen also import. */
const templates = TEMPLATES.map((row) => ({ ...row }));
const macros = MACROS.map((row) => ({ ...row }));

const state = {
  kind: new URLSearchParams(window.location.search).get('tab') || 'visit-notes',
  query: '',
  pending: null, // the row a delete confirmation is about
};

const isMacros = () => kindById(state.kind).macros === true;

/* ===================== Formatting ===================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-03-14' → '14 Mar 2026'. Parsed by hand — see the note in
 *  encounter-summary.js: new Date('2026-03-14') is UTC midnight, which is the
 *  previous day in any western timezone. */
function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso ?? '—';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* ===================== Columns ===================== */

/**
 * The ⋮ is one button per row and the menu behind it carries View, Edit and
 * Delete. Three inline buttons in an Action column would be three tab stops
 * per row and, on a hundred rows, three hundred controls in the tab order.
 */
function menuCell(row) {
  return `<button type="button" class="tpl__row-menu" aria-haspopup="menu" aria-expanded="false"
    aria-label="Actions for ${esc(row.name ?? row.title)}"
    data-menu="${esc(row.id)}" data-testid="tpl--row-menu">${icon('more-vertical')}</button>`;
}

function nameCell(row) {
  return `<a class="tpl__name" href="template-builder.html?id=${encodeURIComponent(row.id)}"
    data-testid="tpl--open">${esc(row.name)}</a>`;
}

const TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Name', sortable: true, wrap: true, render: nameCell },
  { key: 'type', label: 'Type', sortable: true },
  {
    key: 'createdAt',
    label: 'Created at',
    sortable: true,
    render: (row) => `<span class="tpl__date">${esc(longDate(row.createdAt))}</span>`,
  },
  { key: 'createdBy', label: 'Created by', sortable: true },
  { key: 'actions', label: 'Action', align: 'right', render: menuCell },
];

/* The reference screen shows Title and Created By only. A macro has no type
   and no sections, so the two columns a template needs would both be blank. */
const MACRO_COLUMNS = [
  {
    key: 'title',
    label: 'Title',
    sortable: true,
    wrap: true,
    render: (row) => `<button type="button" class="tpl__name tpl__name--button"
      data-macro="${esc(row.id)}" data-testid="tpl--open-macro">${esc(row.title)}</button>`,
  },
  { key: 'createdBy', label: 'Created By', sortable: true },
  { key: 'actions', label: 'Action', align: 'right', render: menuCell },
];

/* ===================== Data ===================== */

function rows() {
  const list = isMacros()
    ? macros
    : templates.filter((row) => row.kind === state.kind);

  if (!state.query) return list;
  const q = state.query.toLowerCase();
  return list.filter((row) =>
    [row.name, row.title, row.type, row.createdBy].some((value) =>
      String(value ?? '').toLowerCase().includes(q)
    )
  );
}

/* ===================== Paint ===================== */

/* One table and one pager per tab, because there is one PANEL per tab — see
   the note in templates.html. Built lazily: a pager for a tab nobody opens is
   a footer nobody sees. */
const pagers = new Map();

const tableFor = (kind) => document.querySelector(`[data-table="${kind}"]`);

function pagerFor(kind) {
  if (!pagers.has(kind)) {
    pagers.set(
      kind,
      createPager(document.querySelector(`[data-foot="${kind}"]`), {
        rowsPerPage: 10,
        noun: 'entries',
        testidPrefix: 'tpl',
        onChange: () => paintTable(),
      })
    );
  }
  return pagers.get(kind);
}

function paintTable() {
  const all = rows();
  const { start, end } = pagerFor(state.kind).render(all.length);

  const table = tableFor(state.kind);
  table.columns = isMacros() ? MACRO_COLUMNS : TEMPLATE_COLUMNS;
  table.rows = all.slice(start, end);
  table.setAttribute(
    'empty-text',
    state.query
      ? `No ${kindById(state.kind).noun} matches “${state.query}”.`
      : `No ${kindById(state.kind).noun} yet.`
  );
  table.setAttribute('state', table.rows.length ? 'ready' : 'empty');
}

/**
 * The button names what it makes. "Create New Template" on the Macros tab
 * would be a button whose label and behaviour disagree.
 *
 * ui-button captures its label at upgrade time and rebuilds its own innards,
 * so the visible span is what gets written — assigning textContent to the host
 * would wipe the rendered button.
 */
function paintCreateButton() {
  const label = isMacros() ? 'Create New Macro' : 'Create New Template';
  const span = el('tplCreate').querySelector('.ui-btn__label') ?? el('tplCreate').querySelector('span:not([class])');
  if (span) span.textContent = label;
  el('tplCreate').setAttribute('aria-label', label);
}

function paint() {
  pagerFor(state.kind).reset();
  paintCreateButton();
  paintTable();
}

/* ===================== The row menu =====================
   Parented to <body> and positioned through a generated stylesheet, because
   the table scrolls inside itself and a panel inside a row would be clipped
   by that overflow. Same shape as Master's. */

let closeMenu = null;

function sheet() {
  let node = el('tplMenuSheet');
  if (!node) {
    node = document.createElement('style');
    node.id = 'tplMenuSheet';
    document.head.appendChild(node);
  }
  return node;
}

function openRowMenu(row, trigger) {
  /* View and Edit are the same screen; view opens it read-only. Macros have a
     dialog of their own rather than the builder. */
  const go = (mode) => {
    if (isMacros()) return openMacroDialog(row, mode === 'view');
    window.location.href = `template-builder.html?id=${encodeURIComponent(row.id)}${
      mode === 'view' ? '&mode=view' : ''
    }`;
  };

  openRowMenu_(trigger, [
    { label: 'View', icon: 'eye', testid: 'tpl--menu-view', run: () => go('view') },
    { label: 'Edit', icon: 'pencil', testid: 'tpl--menu-edit', run: () => go('edit') },
    { divider: true },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      testid: 'tpl--menu-delete',
      run: () => askDelete(row),
    },
  ]);
}

/* ===================== Delete ===================== */

function askDelete(row) {
  state.pending = row;
  el('deleteLead').textContent = `Delete “${row.name ?? row.title}”?`;
  el('deleteModal').open();
}

function confirmDelete() {
  const row = state.pending;
  if (!row) return;

  const list = isMacros() ? macros : templates;
  const at = list.findIndex((entry) => entry.id === row.id);
  if (at > -1) list.splice(at, 1);

  state.pending = null;
  el('deleteModal').close();
  pagerFor(state.kind).reset();
  paintTable();
}

/* ===================== New / edit macro ===================== */

let editingMacro = null;

function openMacroDialog(row = null, readOnly = false) {
  editingMacro = row;

  const name = document.querySelector('[data-testid="tpl--macro-name"]');
  const description = document.querySelector('[data-testid="tpl--macro-description"]');

  name.removeAttribute('error');
  name.setAttribute('value', row?.title ?? '');
  const area = description.querySelector('textarea');
  if (area) area.value = row?.description ?? '';

  // A read-only open is the same dialog with its controls locked — a separate
  // "view" screen would be the same fields again, and the two would drift.
  for (const field of [name, description]) {
    const control = field.querySelector('input, textarea');
    if (control) control.disabled = readOnly;
  }
  document.querySelector('[data-testid="tpl--macro-save"]').hidden = readOnly;

  el('macroModal').setAttribute(
    'heading',
    readOnly ? 'Macro' : row ? 'Edit macro' : 'New macro'
  );
  el('macroModal').open(el('tplCreate'));
}

function saveMacro() {
  const nameField = document.querySelector('[data-testid="tpl--macro-name"]');
  const title = (nameField.value || '').trim();

  if (!title) {
    nameField.setAttribute('error', 'Give the macro a name.');
    nameField.querySelector('input')?.focus();
    return;
  }
  nameField.removeAttribute('error');

  const description = (
    document.querySelector('[data-testid="tpl--macro-description"] textarea')?.value || ''
  ).trim();

  if (editingMacro) {
    editingMacro.title = title;
    editingMacro.description = description;
  } else {
    macros.unshift({
      id: `MAC-${String(macros.length + 16).padStart(2, '0')}`,
      title,
      description,
      createdBy: 'Dr. A. Mensah',
    });
  }

  editingMacro = null;
  el('macroModal').close();
  pagerFor(state.kind).reset();
  paintTable();
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  el('tplTabs').addEventListener('ui-change', (event) => {
    state.kind = event.detail.value;
    state.query = '';
    el('tplSearch').setAttribute('value', '');
    paint();
  });

  // Deep link, and a URL that keeps up so a tab can be shared or bookmarked.
  if (TEMPLATE_KINDS.some((kind) => kind.id === state.kind)) {
    el('tplTabs').setAttribute('selected', state.kind);
  }

  el('tplSearch').addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    pagerFor(state.kind).reset();
    paintTable();
  });

  el('tplCreate').addEventListener('ui-click', () => {
    if (isMacros()) return openMacroDialog();
    window.location.href = `template-builder.html?kind=${encodeURIComponent(state.kind)}`;
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-menu]');
    if (trigger) {
      const list = isMacros() ? macros : templates;
      const row = list.find((entry) => entry.id === trigger.dataset.menu);
      if (row) openRowMenu(row, trigger);
      return;
    }

    const macroLink = event.target.closest('[data-macro]');
    if (macroLink) {
      const row = macros.find((entry) => entry.id === macroLink.dataset.macro);
      if (row) openMacroDialog(row, true);
    }
  });

  document.querySelector('[data-testid="tpl--macro-save"]').addEventListener('ui-click', saveMacro);
  document.querySelector('[data-testid="tpl--delete-confirm"]').addEventListener('ui-click', confirmDelete);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-modal-dismiss]')) return;
    el('macroModal').close();
    el('deleteModal').close();
  });

  paint();
});

/* Exported for the builder's "how many sections" summary — one definition of
   what a section is called, rather than the builder restating the palette. */
export { sectionById };
