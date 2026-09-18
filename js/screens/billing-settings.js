/**
 * Settings ▸ Billing — Fee Schedule.
 *
 * What a procedure is charged at, per provider, for a date range. One list,
 * one table, one dialog — and because it is the only list
 * Billing Settings has, the band names it outright instead of putting a strip
 * of one tab under "Billing Settings". When the rest of Billing Settings
 * (Invoice, Claim, Membership…) lands, the strip comes back in the markup and
 * a tab plus a panel is all another list needs; this module stays about the
 * fee schedule either way, so nothing here selects a tab.
 *
 * The bar carries the title, the filters and Add. The filters sit up there
 * rather than in a row of their own over the table, the same as every other
 * list in the EHR.
 */
import {
  FEE_SCHEDULES,
  PROCEDURE_OPTIONS,
  FEE_PROVIDER_OPTIONS,
  FEE_STATUSES,
  CHARGE_TYPES,
} from '../../data/billing-settings.js';
import { TODAY } from '../../data/schedule.js';
import { createPager } from '../lib/pagination.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { admits } from '../lib/filter-set.js';

/*
 * Rows per page.
 *
 * Fifteen, which is the shared default in js/lib/pagination.js rather than a
 * number this screen picked. Ten was set when a settings list was a dozen rows
 * long and paging was mostly hypothetical; now that every one of these lists
 * runs past fifty, ten meant a full-height table card showing ten rows and
 * four hundred pixels of nothing under them, and six pages of a list nobody
 * wanted to page through. Fifteen fills the card on a laptop and the rows-per-
 * page control is right there for anyone who wants more.
 */
const PAGE_SIZE = 15;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Two decimals, no symbol — the column header carries the ($), the way every
 *  money column in the Billing module already reads. */
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

/** ISO in the data, MM/DD/YYYY on screen — Billing's format everywhere else. */
function formatDate(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${m}/${d}/${y}` : '—';
}

/*
 * Status is derived, never stored.
 *
 * Switched off by hand beats everything — that is someone deciding this rate
 * must not price a claim. Otherwise the dates say it: a contract year that
 * has not started yet is Pending, one that has run out has stopped applying.
 * Storing a status beside the dates is how the two end up disagreeing.
 *
 * TODAY is the prototype's fixed clock (data/schedule.js), so this screen
 * reads the same tomorrow as it does today. ISO dates compare as strings.
 */
function statusOf(row) {
  if (!row.active) return 'Inactive';
  if (row.fromDate > TODAY) return 'Pending';
  if (row.endDate && row.endDate < TODAY) return 'Inactive';
  return 'Active';
}

const STATUS_TONE = { Active: 'success', Pending: 'warning', Inactive: 'critical' };

/**
 * "45378 - Colonoscopy, flexible; diagnostic" → ['45378', 'Colonoscopy, …'].
 *
 * One field holds both because that is how a coder picks one — the select
 * offers the code and its wording together, and splitting the stored value
 * into two fields would only mean rejoining them at every point of use.
 * Splits on the FIRST separator: descriptions contain hyphens of their own.
 */
function procedureParts(value) {
  const at = String(value ?? '').indexOf(' - ');
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at + 3)];
}

/* ===================== THE FORM ===================== */

const SECTIONS = [
  /*
   * The procedure takes the row to itself, because its label is the longest
   * string in the dialog — "45385 - Colonoscopy, flexible; with removal of
   * lesion by snare technique" — and in half a dialog it showed its first
   * four words. Provider and Charge Type pair under it: those two together
   * are what turn a price into THIS price, and they read as one question.
   */
  {
    fields: [
      {
        key: 'procedure',
        label: 'Procedure Code',
        type: 'select',
        options: PROCEDURE_OPTIONS,
        placeholder: 'Select Procedure Code',
        required: true,
      },
    ],
  },
  {
    fields: [
      {
        key: 'provider',
        label: 'Select Provider',
        type: 'select',
        options: FEE_PROVIDER_OPTIONS,
        placeholder: 'Select Provider',
        required: true,
      },
      /*
       * Which of the two charges this amount is.
       *
       * A case at the surgical centre raises a facility charge and a
       * professional charge, at amounts that have nothing to do with each
       * other, so the price list has to be able to hold both — see
       * CHARGE_TYPES in data/billing-settings.js. Required, and with no
       * default: guessing one for the user would silently file the amount
       * they just typed under the wrong charge, and the row would price the
       * wrong half of a claim without ever looking wrong.
       */
      {
        key: 'chargeType',
        label: 'Charge Type',
        type: 'select',
        options: CHARGE_TYPES,
        placeholder: 'Select Charge Type',
        required: true,
      },
    ],
  },
  /*
   * The two amounts share a row, and the two dates share the one under it.
   *
   * With the payer gone the form is six fields rather than seven, and the
   * obvious edit — lift Amount up beside what used to sit with the payer —
   * would have left Allowed Amount alone on a row with two dates, stretched
   * to a third of the dialog for no reason. Pairing what belongs together
   * instead reads down the dialog the way the row reads across the table:
   * what it is, then what it costs, then how long it holds.
   */
  {
    fields: [
      {
        key: 'rate',
        label: 'Amount',
        type: 'number',
        placeholder: 'Enter Amount',
        required: true,
      },
      {
        key: 'allowedAmount',
        label: 'Allowed Amount',
        type: 'number',
        placeholder: 'Enter Allowed Amount',
        required: true,
      },
    ],
  },
  {
    fields: [
      { key: 'fromDate', label: 'From Date', type: 'date', required: true },
      { key: 'endDate', label: 'End Date', type: 'date', required: true },
    ],
  },
];

const FIELDS = SECTIONS.flatMap((section) => section.fields);

/* ===================== STATE ===================== */

// Work on a copy: the data module is the seed, not the store. An empty filter
// is "all of them" — the selects say so in their placeholder, so there is no
// second "All …" option meaning the same thing as the blank one.
const state = {
  data: FEE_SCHEDULES.map((row) => ({ ...row })),
  status: '',
  procedure: '',
  sort: null,
  created: 0,
  table: null,
  pager: null,
};

/* ===================== BOOT ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  state.table = document.getElementById('feeTable');
  if (!state.table) return;

  state.pager = createPager(document.querySelector('[data-foot="fee"]'), {
    rowsPerPage: PAGE_SIZE,
    noun: 'rows',
    testidPrefix: 'bst-fee',
    onChange: paint,
  });

  /* setGroupOptions rather than the `options` attribute: a procedure label
     carries a comma of its own ("Colonoscopy, flexible; diagnostic"), which
     the comma-separated attribute would shear into two answers. */
  const filter = document.getElementById('feeFilter');
  filter?.setGroupOptions('status', FEE_STATUSES);
  filter?.setGroupOptions('procedure', PROCEDURE_OPTIONS);

  filter?.addEventListener('ui-filter-change', (event) => {
    state.status = event.detail.values.status;
    state.procedure = event.detail.values.procedure;
    state.pager.reset();
    paint();
  });

  document
    .getElementById('feeAdd')
    ?.addEventListener('ui-click', (event) => openForm(null, event.currentTarget));

  state.table.addEventListener('ui-sort', (event) => {
    state.sort = event.detail;
    state.pager.reset();
    paint();
  });

  initDeleteDialog();
  paint();
});

/* ===================== TABLE ===================== */

const COLUMNS = [
  {
    key: 'procedure',
    label: 'Procedure Code',
    sortable: true,
    // The code is what the column is scanned by and what opens the editor;
    // the description sits under it rather than beside it, because a GI
    // procedure's full wording ("Colonoscopy, flexible; with removal of lesion
    // by snare technique") on one line only ever shows its first four words.
    wrap: true,
    render: (row) => {
      const [code, description] = procedureParts(row.procedure);
      const link = `<button type="button" class="bst__code" data-edit="${row.id}">${esc(
        code
      )}</button>`;
      return description ? `${link}<br><span class="bst__muted">${esc(description)}</span>` : link;
    },
  },
  { key: 'provider', label: 'Provider', sortable: true },
  /* Sortable, because the two charges are read as two lists as often as they
     are read together: "what do we charge as a facility" is a question about
     one of them and not the other. */
  {
    key: 'chargeType',
    label: 'Charge Type',
    sortable: true,
    narrow: true,
    render: (row) => esc(row.chargeType ?? '—'),
  },
  { key: 'rate', label: 'Rate ($)', numeric: true, narrow: true, render: (row) => money(row.rate) },
  {
    key: 'allowedAmount',
    label: 'Allowed Amount ($)',
    numeric: true,
    narrow: true,
    render: (row) => money(row.allowedAmount),
  },
  { key: 'fromDate', label: 'From Date', sortable: true, narrow: true, render: (row) => formatDate(row.fromDate) },
  { key: 'endDate', label: 'End Date', narrow: true, render: (row) => formatDate(row.endDate) },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    narrow: true,
    render: (row) => {
      const status = statusOf(row);
      return `<ui-badge status="${STATUS_TONE[status]}">${status}</ui-badge>`;
    },
  },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Action</span>',
    actions: true,
    render: (row) => `<button type="button" class="ui-row-menu-btn" data-menu="${row.id}"
        aria-haspopup="menu" aria-expanded="false"
        aria-label="Actions for ${esc(row.procedure)}">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
      </button>`,
  },
];

/** Status is computed, so sorting and filtering ask for it the same way the
 *  column does rather than reading a field that isn't there. */
const valueOf = (row, key) => (key === 'status' ? statusOf(row) : row[key]);

function filtered() {
  /* Both take a set: a fee schedule is reviewed as "everything Expired and
     everything Expiring", or across the two or three codes a procedure is
     billed under. See js/lib/filter-set.js. */
  const rows = state.data.filter(
    (row) => admits(state.status, statusOf(row)) && admits(state.procedure, row.procedure)
  );

  if (!state.sort) return rows;

  const { key, direction } = state.sort;
  const factor = direction === 'ascending' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      String(valueOf(a, key)).localeCompare(String(valueOf(b, key)), undefined, { numeric: true }) *
      factor
  );
}

function paint() {
  const all = filtered();
  const { start, end } = state.pager.render(all.length);
  const slice = all.slice(start, end);

  state.table.columns = COLUMNS;
  state.table.rows = slice;
  state.table.setAttribute('state', slice.length ? 'ready' : 'empty');

  state.table
    .querySelectorAll('[data-edit]')
    .forEach((button) =>
      button.addEventListener('click', () => openForm(find(button.dataset.edit), button))
    );

  state.table
    .querySelectorAll('[data-menu]')
    .forEach((button) =>
      button.addEventListener('click', () => rowMenu(find(button.dataset.menu), button))
    );
}

const find = (id) => state.data.find((row) => row.id === id);

/* ===================== ADD / EDIT ===================== */

let editing = null;

function openForm(row, trigger) {
  const modal = document.getElementById('feeModal');
  const body = document.getElementById('feeModalBody');
  if (!modal || !body) return;

  closeRowMenu();
  editing = row;

  modal.setAttribute('heading', `${row ? 'Edit' : 'Add'} Fee Schedule`);
  body.innerHTML = `
    ${SECTIONS.map(
      (section) => `<div class="bst__form-row">
        ${section.fields.map((field) => fieldMarkup(field, row?.[field.key] ?? '')).join('')}
      </div>`
    ).join('')}
    <div class="bst__form-row">
      <div class="bst__toggle">
        <span class="ui-field__label">Status</span>
        <ui-toggle data-field="active" ${!row || row.active ? 'checked' : ''}
          data-testid="bst--fee-active">Active</ui-toggle>
      </div>
    </div>
    <div class="ui-modal__actions">
      <ui-button variant="outline" data-form-cancel data-testid="bst--fee-cancel">Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-form-save data-testid="bst--fee-save"
        >Save Fee Schedule</ui-button>
    </div>`;

  // The choices go in after the markup rather than through the `options`
  // attribute: a procedure label carries a comma of its own ("Colonoscopy,
  // flexible; diagnostic"), which the comma-separated attribute would shear
  // into two choices. The value attribute is already set, so the right option
  // comes back selected.
  FIELDS.filter((field) => field.type === 'select').forEach((field) => {
    body.querySelector(`ui-select[data-field="${field.key}"]`)?.setOptions(field.options);
  });

  body.querySelector('[data-form-cancel]').addEventListener('ui-click', () => modal.close());
  body.querySelector('[data-form-save]').addEventListener('ui-click', submitForm);
  modal.open(trigger);
}

function fieldMarkup(field, value) {
  const shared = `data-field="${field.key}" label="${esc(field.label)}"${
    field.required ? ' required' : ''
  }`;

  if (field.type === 'select') {
    return `<ui-select ${shared} placeholder="${esc(
      field.placeholder ?? 'Select'
    )}" value="${esc(value)}"></ui-select>`;
  }

  return `<ui-input ${shared} type="${field.type ?? 'text'}"
    placeholder="${esc(field.placeholder ?? '')}" value="${esc(value)}"></ui-input>`;
}

function submitForm() {
  const modal = document.getElementById('feeModal');
  const body = document.getElementById('feeModalBody');
  const values = {};
  let firstBad = null;

  for (const field of FIELDS) {
    const control = body.querySelector(`[data-field="${field.key}"]`);
    const value = String(control.value ?? '').trim();
    values[field.key] = value;

    const message = fieldError(field, value, values);
    setError(control, value, message);
    if (message && !firstBad) firstBad = control;
  }

  if (firstBad) {
    firstBad.focus();
    return;
  }

  const row = {
    ...values,
    rate: Number(values.rate),
    allowedAmount: Number(values.allowedAmount),
    active: body.querySelector('[data-field="active"]')?.checked ?? true,
  };

  if (editing) {
    Object.assign(editing, row);
  } else {
    // New rows land at the top of page one — otherwise the one just added is
    // on page two and reads as "nothing happened".
    state.data.unshift({ id: `fee-new-${++state.created}`, ...row });
    state.pager.reset();
  }

  paint();
  modal.close();
  editing = null;
}

function fieldError(field, value, values) {
  if (field.required && !value) return `${field.label} is required`;

  if ((field.key === 'rate' || field.key === 'allowedAmount') && value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return `${field.label} must be a number`;
  }

  // What a schedule allows can match the charge; it cannot exceed it, and a
  // row that says otherwise would over-collect on every claim priced from it.
  if (field.key === 'allowedAmount' && value && values.rate) {
    if (Number(value) > Number(values.rate)) return 'Allowed Amount cannot exceed Amount';
  }

  if (field.key === 'endDate' && value && values.fromDate && value < values.fromDate) {
    return 'End Date must fall after From Date';
  }

  // One rate per procedure, per provider, PER CHARGE TYPE. The facility fee
  // and the professional fee for the same case are two rows and must be — but
  // a second facility fee for that same case is two prices for one claim line
  // with nothing to choose between them, and those three fields together are
  // the whole of a row's identity.
  //
  // Checked on Charge Type rather than on Procedure or Provider because it is
  // the last of the three to be filled: the error has to land on the field the
  // user just answered, not on one they answered two questions ago.
  if (field.key === 'chargeType' && value && values.procedure && values.provider) {
    const clash = state.data.some(
      (other) =>
        other !== editing &&
        other.procedure === values.procedure &&
        other.provider === values.provider &&
        other.chargeType === value
    );
    if (clash) return `This procedure already has a ${value} rate for that provider`;
  }

  return '';
}

/** Writing the live value back before setting `error` is what stops a failed
 *  save from wiping the fields the user got right — the control renders from
 *  its `value` attribute, which only updates when it commits. */
function setError(control, value, message) {
  control.setAttribute('value', value);
  if (message) control.setAttribute('error', message);
  else control.removeAttribute('error');
}

/* ===================== ROW ⋮ MENU ===================== */


function rowMenu(row, trigger) {
  const after = () => {
    paint();
    /* The table repaints wholesale, so the ⋮ the press started on is gone —
       put focus back on the one belonging to the same row. */
    state.table.querySelector(`[data-menu="${row.id}"]`)?.focus();
  };

  openRowMenu(trigger, [
    { label: 'Edit', icon: 'pencil', run: () => openForm(row, trigger) },
    {
      label: `Mark ${row.active ? 'Inactive' : 'Active'}`,
      icon: row.active ? 'eye-off' : 'check',
      run: () => {
        row.active = !row.active;
        after();
      },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      testid: 'bst--menu-delete',
      run: () => confirmDelete(row, trigger),
    },
  ]);
}

/** One <style> element per id, created on first use. */
function sheet(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/* ===================== DELETE ===================== */

let pendingDelete = null;

function initDeleteDialog() {
  const modal = document.getElementById('feeConfirm');
  if (!modal) return;

  modal.querySelector('[data-confirm-cancel]')?.addEventListener('ui-click', () => modal.close());

  modal.querySelector('[data-confirm-delete]')?.addEventListener('ui-click', () => {
    if (!pendingDelete) return;
    state.data = state.data.filter((row) => row.id !== pendingDelete.id);
    paint();
    modal.close();
    // The row that opened this dialog is gone, so focus cannot return to it.
    document.getElementById('feeAdd')?.focus();
    pendingDelete = null;
  });
}

function confirmDelete(row, trigger) {
  const modal = document.getElementById('feeConfirm');
  const text = document.getElementById('feeConfirmText');
  if (!modal || !text) return;

  pendingDelete = row;
  // The charge type is named because it is the difference between removing
  // half a price and removing all of it: the facility fee can go while the
  // professional fee for the same case stays.
  text.innerHTML = `Remove <strong>${esc(row.provider)}</strong>'s
    <strong>${esc(row.chargeType)}</strong> rate for
    <strong>${esc(row.procedure)}</strong>? Claims already priced from it keep
    what they billed — it just stops pricing new ones.`;
  modal.open(trigger);
}
