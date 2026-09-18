/**
 * Patient directory.
 *
 * One list, filtered. Status used to be an Active / Inactive tab pair; it is
 * now a filter alongside the rest, and a column, so the answer stays visible
 * without opening anything.
 *
 * Status defaults to ALL rather than Active. A directory that silently hides
 * ten patients is how someone concludes a record does not exist and creates a
 * second one — and the filter-count badge makes any narrowing visible.
 */
import { DIRECTORY, PORTAL_TONE, COVERAGE } from '../../data/directory.js';
import { createPager } from '../lib/pagination.js';
import { admits, chosen } from '../lib/filter-set.js';

/** Every filter at rest. Anything differing from this counts as "on". */
const NO_FILTERS = {
  name: '',
  mrn: '',
  dob: '',
  /* Four sets, all empty. These were the string 'All' when each of them could
     hold one answer; an empty set says the same thing and is what a multiple
     select writes when nothing is ticked, so "at rest" and "nothing chosen"
     are one value rather than two that have to agree. */
  status: '',
  portal: '',
  carrier: '',
  coverage: '',
  apptFrom: '',
  apptTo: '',
};

/**
 * The data stores dates as dd-mm-yyyy ("23-10-2025"); date inputs speak
 * yyyy-mm-dd. Converting to ISO also makes them safe to compare as strings.
 */
function toIso(ddmmyyyy) {
  if (!ddmmyyyy) return '';
  const parts = ddmmyyyy.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
}

/** "Sun, 23-10-2025" → "2025-10-23". */
function apptIso(lastAppt) {
  return toIso(String(lastAppt).split(', ').pop());
}

/** Coverage filter labels → the keys used on the row. */
const COVERAGE_BY_LABEL = Object.fromEntries(
  Object.entries(COVERAGE).map(([key, { label }]) => [label, key])
);

/**
 * Carrier over its coverage state — the two facts a front desk needs about
 * money before it can book anyone, and both entered on the Add Patient
 * Insurance tab. Self-pay has no carrier to name, so the state carries the
 * whole cell rather than leaving a dash above a badge.
 */
function insuranceCell(row) {
  const { label, tone } = COVERAGE[row.coverage];

  if (!row.carrier) {
    return `<span class="pt__coverage"><ui-badge status="${tone}">${label}</ui-badge></span>`;
  }

  return `<span class="pt__coverage">
      <span class="pt__carrier" title="${row.carrier}">${row.carrier}</span>
      <ui-badge status="${tone}">${label}</ui-badge>
    </span>`;
}

const COLUMNS = [
  { key: 'mrn', label: 'MRN', sortable: true },
  {
    key: 'name',
    label: 'Patient Name',
    sortable: true,
    truncate: true,
    render: (row) =>
      `<span class="pt__name">
         <span class="pt__avatar" aria-hidden="true">
           <svg class="ui-icon"><use href="#i-user"></use></svg>
         </span>
         <a class="pt__name-link" href="patient-chart.html?mrn=${row.mrn}"
            >${row.name} (${row.sex})</a
         >
       </span>`,
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    sortable: true,
    render: (row) => `${row.dob} <span class="pt__muted">(${row.age})</span>`,
  },
  { key: 'phone', label: 'Contact Details' },
  { key: 'lastAppt', label: 'Last Appointment', sortable: true },
  { key: 'carrier', label: 'Insurance', sortable: true, render: insuranceCell },
  {
    key: 'active',
    label: 'Status',
    sortable: true,
    render: (row) =>
      `<ui-badge status="${row.active ? 'success' : 'neutral'}">${
        row.active ? 'Active' : 'Inactive'
      }</ui-badge>`,
  },
  // Patient Portal was a column here and is gone. It survives as a FILTER,
  // which is the job it actually did — "who still needs a portal invite"
  // is a worklist question, not something to read on every row.
];

customElements.whenDefined('ui-data-table').then(() => {
  const table = document.getElementById('directory');
  const search = document.querySelector('[data-testid="directory--search"]');
  const addButton = document.querySelector('[data-testid="directory--add"]');
  if (!table) return;

  const filters = { ...NO_FILTERS };
  let query = '';
  let sort = null;

  const pager = createPager(document.getElementById('foot'), {
    testidPrefix: 'directory',
    onChange: () => paint(),
  });

  /** Rows surviving the search box and every filter, before paging. */
  function filtered() {
    let rows = DIRECTORY;

    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.mrn.includes(q) ||
          row.phone.includes(q)
      );
    }

    if (filters.name) {
      const q = filters.name.toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(q));
    }
    if (filters.mrn) {
      rows = rows.filter((row) => row.mrn.includes(filters.mrn.trim()));
    }
    if (filters.dob) {
      rows = rows.filter((row) => toIso(row.dob) === filters.dob);
    }
    /* Sets. A directory is searched for the two carriers a practice is
       credentialled with, or for the patients whose portal invitation is
       Pending OR has lapsed to Inactive — questions that took two passes when
       each field held one answer. Coverage is stored as a code and shown as a
       label, so the ticked labels are turned back into codes before the row is
       asked. See js/lib/filter-set.js. */
    rows = rows.filter(
      (row) =>
        admits(filters.status, row.active ? 'Active' : 'Inactive') &&
        admits(filters.portal, PORTAL_TONE[row.portal].label) &&
        admits(filters.carrier, row.carrier) &&
        admits(chosen(filters.coverage).map((label) => COVERAGE_BY_LABEL[label]), row.coverage)
    );
    if (filters.apptFrom) {
      rows = rows.filter((row) => apptIso(row.lastAppt) >= filters.apptFrom);
    }
    if (filters.apptTo) {
      rows = rows.filter((row) => apptIso(row.lastAppt) <= filters.apptTo);
    }

    if (sort) {
      const factor = sort.direction === 'ascending' ? 1 : -1;
      rows = [...rows].sort(
        (a, b) =>
          String(a[sort.key]).localeCompare(String(b[sort.key]), undefined, {
            numeric: true,
          }) * factor
      );
    }
    return rows;
  }


  function paint() {
    const rows = filtered();
    const { start, end } = pager.render(rows.length);
    const slice = rows.slice(start, end);

    table.columns = COLUMNS;
    table.rows = slice;
    table.setAttribute('state', slice.length ? 'ready' : 'empty');
  }

  /* ===================== FILTER PANEL =====================

     Everything about opening, closing, counting and clearing belongs to
     <ui-filter> now (js/components/ui-filter.js). What is left here is the
     wiring: which group answers which key, and which field answers which key.
     Filtering stays live — the panel can never show one set of criteria while
     the table below shows the result of another. */

  const filterEl = document.getElementById('dirFilter');

  /** Which field control feeds which filter key. The groups feed themselves. */
  const FILTER_FIELDS = [
    ['name', 'filter--name'],
    ['mrn', 'filter--mrn'],
    ['dob', 'filter--dob'],
    ['apptFrom', 'filter--appt-from'],
    ['apptTo', 'filter--appt-to'],
  ];

  const control = (testid) => document.querySelector(`[data-testid="${testid}"]`);

  // Carrier and coverage lists come from the data, so a carrier can never be
  // offered here that no patient actually has.
  const carriers = [...new Set(DIRECTORY.map((r) => r.carrier).filter(Boolean))].sort();
  filterEl.setGroupOptions('carrier', carriers);
  filterEl.setGroupOptions('coverage', Object.values(COVERAGE).map((c) => c.label));

  filterEl.addEventListener('ui-filter-change', (event) => {
    Object.assign(filters, event.detail.values);
    pager.reset();
    paint();
  });

  for (const [key, testid] of FILTER_FIELDS) {
    const el = control(testid);
    for (const type of ['ui-input', 'ui-change']) {
      el?.addEventListener(type, (event) => {
        filters[key] = event.detail.value ?? '';
        pager.reset();
        paint();
      });
    }
  }

  /* Clear empties the typed fields as well. The panel's own Clear unticks what
     it drew; the boxes a screen contributed are the screen's to empty. */
  filterEl.addEventListener('ui-filter-clear', () => {
    Object.assign(filters, NO_FILTERS);
    for (const [key, testid] of FILTER_FIELDS) {
      const el = control(testid);
      if (!el) continue;
      el.setAttribute('value', NO_FILTERS[key]);
      const input = el.querySelector('input');
      if (input) input.value = '';
    }
    pager.reset();
    paint();
  });

  table.addEventListener('ui-sort', (event) => {
    sort = event.detail;
    paint();
  });

  search?.addEventListener('ui-input', (event) => {
    query = event.detail.value;
    pager.reset();
    paint();
  });

  addButton?.addEventListener('ui-click', () => {
    window.location.href = 'patient-add.html';
  });

  paint();
});
