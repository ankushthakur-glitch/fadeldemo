/**
 * TASK MANAGEMENT — five worklists behind one tab strip.
 *
 *   All Tasks        everything owed by anyone
 *   My Tasks         what the signed-in user owes
 *   Recalls          patients due back for a procedure
 *   Refill Requests  inbound requests awaiting a yes or no
 *   Orders           lab orders and e-prescriptions already sent
 *
 * WHY ONE SCREEN AND NOT FIVE
 * They are the same job — "what is outstanding, and what do I do about it" —
 * approached from five directions. Splitting them across the nav would make a
 * coordinator check five places every morning to find out whether they are
 * behind.
 *
 * WHY EACH TAB KEEPS ITS OWN COLUMNS
 * A recall has no assignee and a refill has no due date. Forcing all five into
 * one "task" shape would mean five columns of em-dashes on every row. Each
 * worklist gets the columns its object actually has.
 *
 * PAINTING
 * Every tab builds its toolbar once and afterwards replaces only its table.
 * A full repaint would rebuild the <ui-input> the user is typing into and drop
 * the caret after the first letter — the same rule the chart's Documents
 * module follows.
 *
 * PAGING is the shared footer every other worklist in the EHR carries — see
 * paged() below and lib/pagination.js. One pager per tab, because the five
 * already keep their own filters and their own sort.
 */
import {
  CURRENT_USER,
  TASKS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_SOURCES,
  TASK_TYPES,
  STAFF,
  PATIENTS,
  RECALL_STATUSES,
  RECALL_SOURCES,
  RECALL_TYPES,
  RECALL_INTERVALS,
  RECALL_PROVIDERS,
  RECALL_LOCATIONS,
  REFILLS,
  REFILL_STATUSES,
  PHARMACIES,
  DENIAL_REASONS,
  LAB_ORDERS,
  LAB_TESTS,
  ORDER_STATUSES,
  ORDER_ROUTES,
  EPRESCRIPTIONS,
  EPRESCRIPTION_STATUSES,
} from '../../data/tasks.js';
/* Recalls come through the store rather than straight off the seed, because
   they are no longer only written here: signing a clinic visit note turns the
   follow-up interval on its Plan into a recall, and that happens on a
   different page load. See data/recall-store.js. */
import { loadRecalls } from '../../data/recall-store.js';
import { admits, chosen } from '../lib/filter-set.js';
import { createPager } from '../lib/pagination.js';
import { notify } from '../lib/toast.js';

/* ============================================================================
   SMALL HELPERS
   ========================================================================= */

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const icon = (name, className = 'ui-icon') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const $ = (selector) => document.querySelector(selector);

function todayIso() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-08-09" → "09 Aug", "Today", or "Overdue 2 d".
 *
 * Relative wording for the near dates and an absolute one beyond: "Today" and
 * "Overdue 2 d" are read at a glance, while "09 Aug" is unambiguous once it is
 * far enough away that counting days stops helping.
 */
function dueLabelFor(iso) {
  if (!iso) return '—';
  const due = new Date(`${iso}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  const days = Math.round((due - today) / 86400000);

  if (days < 0) return `Overdue ${Math.abs(days)} d`;
  if (days === 0) return 'Today';
  const label = `${String(due.getDate()).padStart(2, '0')} ${MONTHS[due.getMonth()]}`;
  return due.getFullYear() === today.getFullYear()
    ? label
    : `${label} ${String(due.getFullYear()).slice(2)}`;
}

/** A task past its due date is overdue whatever its stored status said. */
function statusFor(task) {
  if (task.status === 'completed' || task.status === 'scheduled') return task.status;
  return task.due < todayIso() ? 'overdue' : task.status;
}

function badge(map, key, extra = '') {
  const entry = map[key];
  if (!entry) return '—';
  return `<ui-badge status="${entry.tone}" size="sm" ${extra}>${esc(entry.label)}</ui-badge>`;
}

/**
 * THE PATIENT CELL, THE WAY EVERY WORKLIST IN THIS EHR WRITES ONE.
 *
 * Initials, then the name as a link into the chart, then date of birth, age
 * and sex on the line beneath. It is the encounters queue's identity cell
 * (see notePatientCell in screens/scheduler.js), and it is here for the same
 * reason it is there: those three facts under the name are what tell two
 * patients with the same name apart, which is the only thing worth printing
 * under a name at all. This screen used to print the MRN instead — a number
 * nobody recognises, in the place where the recognisable facts go — so the
 * five worklists here and the two over on the schedule disagreed about what a
 * patient looks like. They do not now.
 *
 * The lookup is by MRN rather than by name, because the MRN is what the row
 * stores and two people can share a name. A row whose patient is not on the
 * roster still renders — name, then the MRN it carries — rather than
 * collapsing to an empty cell: this is demo data, and a row typed in a dialog
 * during a session is exactly the case that has no roster entry yet.
 */
const PATIENT_BY_MRN = new Map(PATIENTS.map((patient) => [patient.mrn, patient]));

function patientCell(row) {
  const patient = PATIENT_BY_MRN.get(row.mrn);
  const facts = patient
    ? [patient.dob, patient.age != null ? `${patient.age} yrs` : null, patient.sex]
        .filter(Boolean)
        .join(' \u00b7 ')
    : '';
  const sub = facts || (row.mrn ? `MRN ${row.mrn}` : '');
  // The fallback is a bare number and reads as one — tabular figures, so a
  // column of MRNs lines up. The identity line is prose and does not want them.
  const subClass = facts ? 'tsk__patient-sub' : 'tsk__mrn';

  const name = row.mrn
    ? `<a class="tsk__patient-name" href="patient-chart.html?mrn=${encodeURIComponent(
        row.mrn
      )}">${esc(row.patient)}</a>`
    : `<span class="tsk__patient-name">${esc(row.patient)}</span>`;

  return `<span class="tsk__patient">
    <ui-avatar name="${esc(row.patient)}" size="sm"></ui-avatar>
    <span class="tsk__patient-text">
      ${name}
      ${sub ? `<span class="${subClass}">${esc(sub)}</span>` : ''}
    </span>
  </span>`;
}

/** Subject over its one-line detail. */
function subjectCell(row) {
  return `<span class="tsk__subject">
    <strong>${esc(row.subject)}</strong>
    ${row.detail ? `<span class="tsk__detail">${esc(row.detail)}</span>` : ''}
  </span>`;
}

/**
 * A status badge over the one line that qualifies it — a denial reason, a
 * pharmacy's rejection note.
 *
 * The two lists that carry one used to write the badge and the note as
 * siblings with nothing stacking them, so the note ran along the row from the
 * badge's right edge and into the Actions column beside it: "Denied Patient
 * overdue for review" read as one sentence spanning two columns. Every other
 * two-line cell on this screen is the thing over its detail, and so is this.
 */
function statusCell(vocab, key, detail) {
  return `<span class="tsk__status">
    ${badge(vocab, key)}
    ${detail ? `<span class="tsk__detail">${esc(detail)}</span>` : ''}
  </span>`;
}

function idCell(row) {
  return `<button type="button" class="tsk__id" data-open="${row.id}">${esc(row.id)}</button>`;
}

function rowMenuCell(row) {
  return `<button type="button" class="ui-row-menu-btn" data-menu="${row.id}"
    aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(row.id)}">
    ${icon('more-vertical')}
  </button>`;
}

/**
 * A coloured dot before a source label.
 *
 * <ui-status-dot> draws the dot and lays the row out; the tone class stays on
 * the host so the LABEL keeps the colour it had. The component colours only
 * its mark, which is the right default — here the whole cell has always been
 * tinted, and changing that would be a redesign smuggled in as a refactor.
 */
function sourceCell(label, tone = 'brand') {
  return `<ui-status-dot status="${tone}" class="tsk__source--${tone}">${esc(label)}</ui-status-dot>`;
}

const MENU_COLUMN = {
  key: 'menu',
  label: '<span class="u-sr-only">Actions</span>',
  actions: true,
  render: rowMenuCell,
};

/* ============================================================================
   STATE — working copies, so the prototype can be used without editing data.
   ========================================================================= */

const state = {
  tab: 'all',
  tasks: TASKS.map((t) => ({ ...t })),
  /* loadRecalls() already hands back a fresh array of fresh objects — the
     seed is never the thing being edited — so this one is not copied again. */
  recalls: loadRecalls(),
  refills: REFILLS.map((r) => ({ ...r })),
  labOrders: LAB_ORDERS.map((o) => ({ ...o })),
  prescriptions: EPRESCRIPTIONS.map((p) => ({ ...p })),

  // Each worklist keeps its own filters AND its own sort, so switching tabs
  // never rearranges the one you left.
  all: { search: '', assignedTo: '', priority: '', source: '', status: '', sort: null },
  mine: { search: '', priority: '', status: '', future: false, sort: null },
  recallsF: { search: '', provider: '', location: '', source: '', sort: null },
  refillsF: { search: '', provider: '', pharmacy: '', status: '', sort: null },
  ordersF: { sub: 'lab', search: '', priority: '', provider: '', status: '', sort: null },

  // The set the New Task dialog is holding — one send, one task per name.
  taskRecipients: [],
  pendingDeny: null,
};

// Set once at boot (gatePatientFirst) — re-run whenever the matching dialog
// opens, since a patient chosen on an earlier visit is still in the field.
let applyRecallGate = () => {};
let applyLabGate = () => {};
let applyRefillGate = () => {};

/* ============================================================================
   FLASH

   A report on something that has already finished — "assigned", "cancelled",
   "queued" — and so it floats in the corner rather than being painted into
   the page. The bar this used to write into sat between the tab strip and the
   table and pushed both down for five seconds, which moved the row somebody
   was about to click on precisely the beat they were reaching for it.

   The name stays because thirty call sites below say flash(); only where the
   words land has changed.
   ========================================================================= */

function flash(message, tone = 'info') {
  notify(message, tone);
}

/* ============================================================================
   HEADER ACTION

   One "add" button for the whole screen, contextual to whichever tab (and,
   on Orders, sub-tab) is open — not a second button duplicating whatever
   the tab's own toolbar already offers. E-prescriptions has nothing to add
   from here, so the slot goes empty rather than showing a button that does
   nothing.
   ========================================================================= */

function headerActionMarkup() {
  if (state.tab === 'recalls') {
    return `<ui-button variant="primary" icon="plus" data-testid="tsk--new-recall">New Recall</ui-button>`;
  }
  if (state.tab === 'refills') {
    return `<ui-button variant="primary" icon="plus" data-testid="tsk--new-refill">New Refill</ui-button>`;
  }
  if (state.tab === 'orders') {
    return state.ordersF.sub === 'lab'
      ? `<ui-button variant="primary" icon="plus" data-testid="tsk--new-lab-order">New Lab Order</ui-button>`
      : '';
  }
  return `<ui-button variant="primary" icon="plus" data-testid="tsk--new-task">New Task</ui-button>`;
}

function paintHeaderAction() {
  const host = $('#headerAction');
  if (host) host.innerHTML = headerActionMarkup();
}

/* ============================================================================
   TOOLBAR AND TABLE PLUMBING

   Every tab has the same shape: a search box, some filter selects, sometimes
   one action, and a table. Building that shape once here is what keeps the
   five tabs consistent without five copies of the same markup.
   ========================================================================= */

/**
 * A filter select. Real <option> children, not the comma-separated `options`
 * attribute — "K. Brandt, RN" is one person, and the attribute would offer
 * "K. Brandt" and "RN" as two. <ui-select> reads children when it upgrades,
 * which is exactly when this markup is inserted.
 *
 * `empty-option` rather than `placeholder`, because everything built here is a
 * filter: the hidden label is what the field reads while nothing is chosen,
 * and it has to stay in the list as a row, since picking it is how the filter
 * gets turned back off. A placeholder is a question and is kept out.
 *
 * MULTIPLE, ON ALL FOURTEEN OF THEM.
 * Every filter this builds names a SET a task can belong to — three
 * priorities, five statuses, the people in the practice — and the work these
 * tabs exist for is nearly always two of them at once: Urgent and High before
 * a clinic session, Pending and Overdue when clearing a backlog, two nurses
 * covering each other's lists. One answer at a time meant looking twice and
 * holding the difference in your head. The rows become checkboxes, the closed
 * field reads back what has been ticked, and nothing chosen still means the
 * filter is off. The reading half is admits(); see js/lib/filter-set.js.
 */
/**
 * One question in the filter panel.
 *
 * The five worklists ask different questions of different vocabularies, so the
 * panel is built from JS rather than declared in tasks.html — but the shape is
 * the shared one (js/components/ui-filter.js), and `name` is deliberately the
 * key on this tab's slice of `state`, which is what lets one listener at the
 * bottom of this file write any of them back.
 */
function group(name, label, options) {
  return { name, label, options };
}

/* ============================================================================
   THE HEADER'S CONTROLS

   One search box, one filter panel and one "extra" slot for all five
   worklists, re-pointed at whichever tab is open — see the comment in
   tasks.html for why they are not five toolbars over five tables any more.

   Each tab describes its own controls here rather than building them inside
   its painter, because the painters run ONCE (see `painted`) while the header
   has to be rewritten every time a tab is shown.

   The ids are unchanged, which is what keeps onFilterChange's map working: it
   reads the id of whatever fired, not where it sits.
   ========================================================================= */

function controlsFor(tab) {
  if (tab === 'mine') {
    return {
      searchId: 'mineSearch',
      searchPlaceholder: 'Search my tasks',
      searchValue: state.mine.search,
      groups: [
        group('priority', 'Priority', Object.values(TASK_PRIORITIES).map((p) => p.label)),
        group('status', 'Status', Object.values(TASK_STATUSES).map((s) => s.label)),
        /* Future-dated used to be a pressed-state button below the selects. It
           is a filter — it hides rows — so it is a box in the panel with the
           rest of them, and it counts towards the badge like the rest of them. */
        group('future', 'Due date', [{ value: 'on', label: 'Show future-dated' }]),
      ],
    };
  }

  if (tab === 'recalls') {
    return {
      searchId: 'recallSearch',
      // Phrased like the other four — "Search by …", without naming the list
      // the box already sits over. It was the one placeholder long enough to
      // be cut off inside the shared 18rem box, which read as a typo.
      searchPlaceholder: 'Search by patient or procedure',
      searchValue: state.recallsF.search,
      groups: [
        group('provider', 'Provider', RECALL_PROVIDERS),
        group('location', 'Location', RECALL_LOCATIONS),
        group('source', 'Source', Object.values(RECALL_SOURCES).map((s) => s.label)),
      ],
      extra: `<ui-button variant="outline" icon="printer" data-testid="tsk--generate-letters"
          >Generate letters</ui-button
        >`,
    };
  }

  if (tab === 'refills') {
    return {
      searchId: 'refillSearch',
      searchPlaceholder: 'Search by patient or medication',
      searchValue: state.refillsF.search,
      groups: [
        group('provider', 'Provider', RECALL_PROVIDERS),
        group('pharmacy', 'Pharmacy', PHARMACIES),
        group('status', 'Status', Object.values(REFILL_STATUSES).map((s) => s.label)),
      ],
    };
  }

  if (tab === 'orders') {
    // Priority only exists on lab orders, and the status vocabularies differ,
    // so the filters are rebuilt with the sub-tab rather than shared.
    const lab = state.ordersF.sub === 'lab';
    const statusOptions = lab
      ? Object.values(ORDER_STATUSES).map((s) => s.label)
      : Object.values(EPRESCRIPTION_STATUSES).map((s) => s.label);

    return {
      searchId: 'orderSearch',
      searchPlaceholder: lab ? 'Search by patient or order ID' : 'Search by patient or medication',
      searchValue: state.ordersF.search,
      groups: [
        ...(lab
          ? [group('priority', 'Priority', Object.values(TASK_PRIORITIES).map((p) => p.label))]
          : []),
        group('provider', 'Provider', RECALL_PROVIDERS),
        group('status', 'Status', statusOptions),
      ],
      extra: lab
        ? ''
        : `<ui-button variant="outline" icon="refresh" data-testid="tsk--rx-refresh"
             >Refresh status</ui-button
           >`,
    };
  }

  return {
    searchId: 'allSearch',
    searchPlaceholder: 'Search by patient, subject or task ID',
    searchValue: state.all.search,
    groups: [
      group('assignedTo', 'Assigned to', STAFF),
      group('priority', 'Priority', Object.values(TASK_PRIORITIES).map((p) => p.label)),
      group('source', 'Source', Object.values(TASK_SOURCES).map((s) => s.label)),
      group('status', 'Status', Object.values(TASK_STATUSES).map((s) => s.label)),
    ],
  };
}

/** Which slice of `state` the open tab filters through. */
function filterState(tab = state.tab) {
  return {
    all: state.all,
    mine: state.mine,
    recalls: state.recallsF,
    refills: state.refillsF,
    orders: state.ordersF,
  }[tab];
}

/*
 * The panel's questions, and the answers already given to them.
 *
 * <ui-filter> counts its own ticks for the badge, so the screen no longer
 * counts filters. `future` is the one answer that is not a set on this
 * screen's state — it is a boolean — so it is translated at the boundary in
 * both directions rather than changing what the worklist code reads.
 */
function filterValuesFor(tab = state.tab) {
  const f = filterState(tab) ?? {};
  const values = {};
  for (const [key, value] of Object.entries(f)) {
    if (['search', 'sort', 'sub'].includes(key)) continue;
    if (key === 'future') values.future = value ? ['on'] : [];
    else values[key] = chosen(value);
  }
  return values;
}

function paintHeaderControls() {
  const { searchId, searchPlaceholder, searchValue, groups, extra = '' } = controlsFor(state.tab);

  const search = $('#headerSearch');
  if (search) {
    search.innerHTML = `<ui-input id="${searchId}" icon="search"
      label="${esc(searchPlaceholder)}" label-hidden placeholder="${esc(searchPlaceholder)}"
      value="${esc(searchValue)}" data-testid="${searchId}"></ui-input>`;
  }

  /* One control, restocked for whichever worklist is open. setGroups() before
     the values, or the answers would be filtered against the previous tab's
     vocabulary and quietly dropped. */
  const filter = $('#tskFilter');
  if (filter) {
    filter.setGroups(groups);
    filter.value = filterValuesFor();
  }

  const host = $('#headerExtra');
  if (host) host.innerHTML = extra;
}

/** Put the open worklist's filters back to "everything", search included. */
/**
 * Everything back to "the whole worklist", search box included.
 *
 * The panel's own Clear unticks the boxes it drew; the search field is beside
 * the button rather than inside the panel, and a "cleared" worklist still
 * hiding half its rows behind a forgotten search term is not cleared.
 */
function clearTaskFilters() {
  const f = filterState();
  if (!f) return;
  Object.keys(f).forEach((key) => {
    if (['sort', 'sub'].includes(key)) return;
    f[key] = key === 'future' ? false : '';
  });
  paintHeaderControls();
  resetPaging();
  APPLIERS[state.tab]?.();
}

/**
 * Fill a table element. Never replaces the element: <ui-data-table> keeps its
 * sort direction privately, and a fresh element would read every header click
 * as the first one.
 */
function fillTable(selector, columns, rows, emptyText) {
  const table = $(selector);
  if (!table) return;
  table.columns = columns;
  table.setAttribute('empty-text', emptyText);
  table.rows = rows;
  table.setAttribute('state', rows.length ? 'ready' : 'empty');
}

/* --- Paging ------------------------------------------------------------------
   The footer every other worklist in the EHR carries — the patient directory's
   and the leads inbox's — now sits under these five too. It is the same
   control from lib/pagination.js, so "1-15 of 24 tasks" is read here exactly
   the way it is read there, and the rows-per-page a coordinator sets on one
   list is the same choice offered on the next.

   ONE PAGER PER WORKLIST rather than one for the screen. The five tabs keep
   their own filters, their own sort and their own scroll; a shared pager would
   also make them share a page number, so opening Recalls from page 3 of All
   tasks would land on a page of recalls nobody asked for. Each is built the
   first time its tab is painted, alongside the table it belongs to.
   -------------------------------------------------------------------------- */

const pagers = new Map();

/**
 * Draw the footer for `rows` under the open worklist and return the slice that
 * belongs on the current page. Called from every apply*(), which is the one
 * place that knows what survived the filters.
 */
function paged(tab, rows, noun) {
  const host = $(`[data-foot="${tab}"]`);
  if (!host) return rows;

  // Rebuilt against the host currently in the DOM, not merely cached by tab.
  // Orders repaints its whole panel when the sub-tab changes, which throws the
  // old footer away with it; a pager still pointing at the detached one would
  // draw page numbers nobody can see and leave the table stuck on page 1.
  let entry = pagers.get(tab);
  if (!entry || entry.host !== host) {
    entry = {
      host,
      pager: createPager(host, {
        noun,
        testidPrefix: `tsk-${tab}`,
        onChange: () => APPLIERS[tab]?.(),
      }),
    };
    pagers.set(tab, entry);
  }
  const { pager } = entry;
  // Orders swaps lab orders for prescriptions under one pager; the count is
  // the one thing a footer exists to say, so it has to say it about the right
  // thing. See setNoun in lib/pagination.js.
  pager.setNoun(noun);
  const { start, end } = pager.render(rows.length);
  return rows.slice(start, end);
}

/**
 * Back to page one. A narrowed list read from page 3 is a list the reader is
 * looking at the empty end of — every search keystroke, filter tick and sort
 * change comes through here first.
 */
function resetPaging(tab = state.tab) {
  pagers.get(tab)?.pager.reset();
}

const matches = (value, query) => String(value ?? '').toLowerCase().includes(query);

/* --- Sorting -----------------------------------------------------------------
   <ui-data-table> reports which header was clicked and in which direction, but
   it does not reorder the rows — the screen owns its data, so it owns the
   sort. Without this the headers would look sortable and do nothing.

   Three columns need more than a string compare: priority sorts by urgency
   rather than alphabetically (STAT before Urgent before Routine), status by
   its label, and dates by their sortable ISO value rather than the "Overdue
   2 d" the column displays.
   -------------------------------------------------------------------------- */

function sortKeyFor(row, key) {
  if (key === 'priority') return String(TASK_PRIORITIES[row.priority]?.rank ?? 9);
  if (key === 'status') {
    const label =
      TASK_STATUSES[statusFor(row)]?.label ??
      RECALL_STATUSES[row.status]?.label ??
      REFILL_STATUSES[row.status]?.label ??
      ORDER_STATUSES[row.status]?.label ??
      EPRESCRIPTION_STATUSES[row.status]?.label ??
      '';
    return label;
  }
  if (key === 'due') return row.due ?? '';
  if (key === 'orderedLabel') return row.ordered ?? '';
  if (key === 'receivedLabel') return row.received ?? '';
  if (key === 'tests') return String(row.tests ?? 0).padStart(4, '0');
  return String(row[key] ?? '');
}

function applySort(rows, sort) {
  if (!sort?.key) return rows;
  const sign = sort.direction === 'descending' ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      sign *
      sortKeyFor(a, sort.key).localeCompare(sortKeyFor(b, sort.key), undefined, { numeric: true })
  );
}

/* ============================================================================
   ALL TASKS
   ========================================================================= */

const TASK_COLUMNS = [
  { key: 'id', label: 'Task', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  { key: 'subject', label: 'Subject', wrap: true, render: subjectCell, sortable: true },
  {
    key: 'priority',
    label: 'Priority',
    sortable: true,
    render: (row) => badge(TASK_PRIORITIES, row.priority),
  },
  {
    key: 'source',
    label: 'Source',
    render: (row) =>
      sourceCell(
        TASK_SOURCES[row.source]?.label ?? row.source,
        TASK_SOURCES[row.source]?.auto ? 'brand' : 'neutral'
      ),
  },
  { key: 'assignedTo', label: 'Assigned to', sortable: true },
  { key: 'from', label: 'From' },
  {
    key: 'due',
    label: 'Due',
    sortable: true,
    render: (row) => `<span class="tsk__due">${esc(dueLabelFor(row.due))}</span>`,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => badge(TASK_STATUSES, statusFor(row)),
  },
  MENU_COLUMN,
];

function visibleAllTasks() {
  const f = state.all;
  const query = f.search.trim().toLowerCase();
  return applySort(state.tasks.filter((task) => {
    if (query && !(matches(task.patient, query) || matches(task.subject, query) || matches(task.id, query)))
      return false;
    if (!admits(f.assignedTo, task.assignedTo)) return false;
    if (!admits(f.priority, TASK_PRIORITIES[task.priority]?.label)) return false;
    if (!admits(f.source, TASK_SOURCES[task.source]?.label)) return false;
    if (!admits(f.status, TASK_STATUSES[statusFor(task)]?.label)) return false;
    return true;
  }), state.all.sort);
}

function paintAll() {
  $('#allPanel').innerHTML = `
  <div class="ui-table-card">
    <ui-data-table id="allTable" sticky-first data-testid="tsk--all-table"></ui-data-table>
    <div data-foot="all"></div>
  </div>`;

  applyAll();
}

function applyAll() {
  const rows = visibleAllTasks();
  fillTable('#allTable', TASK_COLUMNS, paged('all', rows, 'tasks'), 'No task matches these filters.');
}

/* ============================================================================
   MY TASKS

   Fewer columns on purpose: "Assigned to" is always me, and Source matters far
   less than who asked. Repeating my own name down a column is nine rows of
   nothing.
   ========================================================================= */

const MY_TASK_COLUMNS = [
  { key: 'id', label: 'Task', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  { key: 'subject', label: 'Subject', wrap: true, render: subjectCell, sortable: true },
  {
    key: 'priority',
    label: 'Priority',
    sortable: true,
    render: (row) => badge(TASK_PRIORITIES, row.priority),
  },
  { key: 'from', label: 'From', sortable: true },
  {
    key: 'due',
    label: 'Due',
    sortable: true,
    render: (row) => `<span class="tsk__due">${esc(dueLabelFor(row.due))}</span>`,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => badge(TASK_STATUSES, statusFor(row)),
  },
  MENU_COLUMN,
];

function visibleMyTasks() {
  const f = state.mine;
  const query = f.search.trim().toLowerCase();
  return applySort(state.tasks.filter((task) => {
    if (task.assignedTo !== CURRENT_USER) return false;
    if (!f.future && task.futureDated) return false;
    if (query && !(matches(task.patient, query) || matches(task.subject, query) || matches(task.id, query)))
      return false;
    if (!admits(f.priority, TASK_PRIORITIES[task.priority]?.label)) return false;
    if (!admits(f.status, TASK_STATUSES[statusFor(task)]?.label)) return false;
    return true;
  }), state.mine.sort);
}

function paintMine() {
  $('#minePanel').innerHTML = `
  <div class="ui-table-card">
    <ui-data-table id="mineTable" sticky-first data-testid="tsk--my-table"></ui-data-table>
    <div data-foot="mine"></div>
  </div>`;

  applyMine();
}

function applyMine() {
  const rows = visibleMyTasks();
  fillTable(
    '#mineTable',
    MY_TASK_COLUMNS,
    paged('mine', rows, 'tasks'),
    state.mine.future ? 'Nothing assigned to you.' : 'Nothing due. Turn on future-dated to see scheduled work.'
  );
}

/* ============================================================================
   RECALLS
   ========================================================================= */

const RECALL_COLUMNS = [
  { key: 'id', label: 'Recall', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  { key: 'dueFor', label: 'Due for', wrap: true, sortable: true },
  { key: 'interval', label: 'Interval' },
  { key: 'provider', label: 'Provider', sortable: true },
  { key: 'location', label: 'Location' },
  {
    key: 'source',
    label: 'Source',
    render: (row) => sourceCell(RECALL_SOURCES[row.source]?.label ?? row.source, 'success'),
  },
  {
    key: 'due',
    label: 'Due',
    sortable: true,
    render: (row) => `<span class="tsk__due">${esc(dueLabelFor(row.due))}</span>`,
  },
  {
    key: 'lastContacted',
    label: 'Last contacted',
    render: (row) => esc(row.lastContacted ?? '—'),
  },
  { key: 'status', label: 'Status', sortable: true, render: (row) => badge(RECALL_STATUSES, row.status) },
  MENU_COLUMN,
];

function visibleRecalls() {
  const f = state.recallsF;
  const query = f.search.trim().toLowerCase();
  return applySort(state.recalls.filter((recall) => {
    if (query && !(matches(recall.patient, query) || matches(recall.dueFor, query) || matches(recall.id, query)))
      return false;
    if (!admits(f.provider, recall.provider)) return false;
    if (!admits(f.location, recall.location)) return false;
    if (!admits(f.source, RECALL_SOURCES[recall.source]?.label)) return false;
    return true;
  }), state.recallsF.sort);
}

function paintRecalls() {
  $('#recallsPanel').innerHTML = `
    <ui-alert severity="info" heading="New capability" data-testid="tsk--recall-note">
      Recalls currently have no reminders — a staff member works the list by hand
      and mails letters. Due and upcoming recalls now surface here as tasks.
    </ui-alert>

    <div class="ui-table-card">
      <ui-data-table id="recallTable" sticky-first data-testid="tsk--recall-table"></ui-data-table>
      <div data-foot="recalls"></div>
    </div>`;

  applyRecalls();
}

function applyRecalls() {
  const rows = visibleRecalls();
  fillTable(
    '#recallTable',
    RECALL_COLUMNS,
    paged('recalls', rows, 'recalls'),
    'No recall matches these filters.'
  );
}

/* ============================================================================
   REFILL REQUESTS

   Approve and Deny sit in the row rather than behind the "⋮". This is a queue
   worked one row at a time, and burying the only two actions it has behind a
   menu doubles every interaction.
   ========================================================================= */

const REFILL_COLUMNS = [
  { key: 'id', label: 'Request', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  {
    key: 'medication',
    label: 'Medication',
    wrap: true,
    sortable: true,
    render: (row) => `<span class="tsk__subject">
      <strong>${esc(row.medication)}</strong>
      ${row.detail ? `<span class="tsk__detail">${esc(row.detail)}</span>` : ''}
    </span>`,
  },
  { key: 'pharmacy', label: 'Pharmacy', sortable: true },
  { key: 'provider', label: 'Provider', sortable: true },
  { key: 'receivedLabel', label: 'Received', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => statusCell(REFILL_STATUSES, row.status, row.reason),
  },
  {
    key: 'act',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) =>
      row.status === 'awaiting'
        ? `<span class="tsk__row-buttons">
             <ui-button size="xs" variant="outline" data-approve="${row.id}">Approve</ui-button>
             <ui-button size="xs" variant="outline" data-deny="${row.id}">Deny</ui-button>
           </span>`
        : rowMenuCell(row),
  },
];

function visibleRefills() {
  const f = state.refillsF;
  const query = f.search.trim().toLowerCase();
  return applySort(state.refills.filter((refill) => {
    if (query && !(matches(refill.patient, query) || matches(refill.medication, query) || matches(refill.id, query)))
      return false;
    if (!admits(f.provider, refill.provider)) return false;
    if (!admits(f.pharmacy, refill.pharmacy)) return false;
    if (!admits(f.status, REFILL_STATUSES[refill.status]?.label)) return false;
    return true;
  }), state.refillsF.sort);
}

function paintRefills() {
  $('#refillsPanel').innerHTML = `
  <div class="ui-table-card">
    <ui-data-table id="refillTable" sticky-first data-testid="tsk--refill-table"></ui-data-table>
    <div data-foot="refills"></div>
  </div>`;

  applyRefills();
}

function applyRefills() {
  const rows = visibleRefills();
  fillTable(
    '#refillTable',
    REFILL_COLUMNS,
    paged('refills', rows, 'requests'),
    'No refill request matches.'
  );
}

/* ============================================================================
   ORDERS — Lab orders / E-prescriptions
   ========================================================================= */

const LAB_COLUMNS = [
  { key: 'id', label: 'Order', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  {
    key: 'priority',
    label: 'Priority',
    sortable: true,
    render: (row) => badge(TASK_PRIORITIES, row.priority),
  },
  { key: 'tests', label: 'Tests', numeric: true, sortable: true, render: (row) => `${row.tests} tests` },
  { key: 'route', label: 'Route' },
  { key: 'provider', label: 'Ordering provider', sortable: true },
  { key: 'orderedLabel', label: 'Ordered', sortable: true },
  { key: 'status', label: 'Status', sortable: true, render: (row) => badge(ORDER_STATUSES, row.status) },
  MENU_COLUMN,
];

const RX_COLUMNS = [
  { key: 'id', label: 'Prescription', render: idCell, sortable: true },
  { key: 'patient', label: 'Patient', render: patientCell, sortable: true },
  {
    key: 'medication',
    label: 'Medication',
    wrap: true,
    sortable: true,
    render: (row) => `<span class="tsk__subject">
      <strong>${esc(row.medication)}</strong>
      <span class="tsk__detail">${esc(row.sig)}</span>
    </span>`,
  },
  { key: 'pharmacy', label: 'Pharmacy', sortable: true },
  { key: 'provider', label: 'Prescriber', sortable: true },
  { key: 'orderedLabel', label: 'Sent', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => statusCell(EPRESCRIPTION_STATUSES, row.status, row.detail),
  },
  MENU_COLUMN,
];

function visibleOrders() {
  const f = state.ordersF;
  const query = f.search.trim().toLowerCase();

  if (f.sub === 'lab') {
    return applySort(state.labOrders.filter((order) => {
      if (query && !(matches(order.patient, query) || matches(order.id, query))) return false;
      if (!admits(f.priority, TASK_PRIORITIES[order.priority]?.label)) return false;
      if (!admits(f.provider, order.provider)) return false;
      if (!admits(f.status, ORDER_STATUSES[order.status]?.label)) return false;
      return true;
    }), state.ordersF.sort);
  }

  return applySort(state.prescriptions.filter((rx) => {
    if (query && !(matches(rx.patient, query) || matches(rx.medication, query) || matches(rx.id, query)))
      return false;
    if (!admits(f.provider, rx.provider)) return false;
    if (!admits(f.status, EPRESCRIPTION_STATUSES[rx.status]?.label)) return false;
    return true;
  }), state.ordersF.sort);
}

/**
 * ORDERS, and its switch between the two lists.
 *
 * The strip is a real <ui-tabs> rather than two buttons wearing role="tab".
 * The hand-built pair said tablist and tab in the markup and then answered
 * none of the keys the pattern promises — no Left/Right between them, no
 * Home/End, both in the tab order rather than the strip taking one stop — and
 * it was a second, private copy of a shape the product already has. It is the
 * SECONDARY level, inside the section the primary strip opened, so it takes
 * the pill-on-a-sunk-track shape the Scheduler's Unsigned/Signed switch wears
 * (.tsk__subtabs, and see the note in js/components/ui-tabs.js): two segmented
 * strips of the same shape stacked would read as one level.
 *
 * THE SWITCH IS INSIDE THE CARD, not floating above it — the shape the
 * encounters queue uses for Unsigned / Signed (.sch__card in
 * css/screen-scheduler.css). One border and one radius run round the switch,
 * the rows and the pager together, so the three read as one object: the switch
 * belongs to the table it changes rather than sitting over it as a separate
 * control that happens to be nearby. It was outside the card here, which left
 * a rounded pill on the page above a rounded card and two edges between them.
 *
 * The panel is still repainted whole on a switch rather than kept as two, so
 * the card below carries the id of whichever list is open and the strip's
 * aria-controls lands on it.
 */
function paintOrders() {
  const lab = state.ordersF.sub === 'lab';

  $('#ordersPanel').innerHTML = `
    <div class="tsk__card">
      <div class="tsk__subtabs">
        <ui-tabs selected="${lab ? 'lab' : 'rx'}" id="orderSubTabs"
          aria-label="Order type" data-testid="tsk--sub-tabs">
          <ui-tab value="lab" label="Lab orders"></ui-tab>
          <ui-tab value="rx" label="E-prescriptions"></ui-tab>
        </ui-tabs>
      </div>

      <div class="ui-table-card" id="panel-${lab ? 'lab' : 'rx'}" role="tabpanel"
        aria-labelledby="tab-${lab ? 'lab' : 'rx'}">
        <ui-data-table id="orderTable" sticky-first data-testid="tsk--order-table"></ui-data-table>
        <div data-foot="orders"></div>
      </div>
    </div>`;

  // Bound to the strip rather than delegated from the document: this repaint
  // replaces the strip that fired the event, and a document-level listener
  // would then be handing the next one an element already thrown away.
  $('#orderSubTabs')?.addEventListener('ui-change', (event) => showOrderSub(event.detail.value));

  applyOrders();
}

/**
 * Switch between lab orders and e-prescriptions.
 *
 * The filters are cleared on the way through: they are the open list's
 * questions, and "Awaiting result" is not one an e-prescription can answer.
 */
function showOrderSub(value) {
  if (state.ordersF.sub === value) return;
  state.ordersF.sub = value;
  state.ordersF.search = '';
  state.ordersF.priority = '';
  state.ordersF.status = '';
  paintOrders();
  paintHeaderControls();
  paintHeaderAction();
}

function applyOrders() {
  const lab = state.ordersF.sub === 'lab';
  const rows = visibleOrders();
  fillTable(
    '#orderTable',
    lab ? LAB_COLUMNS : RX_COLUMNS,
    paged('orders', rows, lab ? 'lab orders' : 'prescriptions'),
    lab ? 'No lab order matches.' : 'No prescription matches.'
  );
}

/* ============================================================================
   ROW MENUS
   ========================================================================= */

function openMenu(anchor, items, onPick) {
  document.querySelectorAll('.tsk__dropdown').forEach((el) => el.remove());
  anchor.setAttribute('aria-expanded', 'true');

  const menu = document.createElement('div');
  menu.className = 'tsk__dropdown';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = items
    .map(
      (item) =>
        `<button type="button" role="menuitem" class="tsk__dropdown-item${
          item.danger ? ' tsk__dropdown-item--danger' : ''
        }" data-action="${item.action}">${esc(item.label)}</button>`
    )
    .join('');

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${rect.right + window.scrollX - menu.offsetWidth}px`;

  menu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action) onPick(action);
    menu.remove();
  });

  const close = (event) => {
    if (!menu.contains(event.target)) {
      anchor.setAttribute('aria-expanded', 'false');
      menu.remove();
      document.removeEventListener('click', close, true);
    }
  };
  document.addEventListener('click', close, true);
}

function taskMenu(anchor, id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  openMenu(
    anchor,
    [
      { label: 'Mark complete', action: 'complete' },
      { label: 'Start progress', action: 'start' },
      { label: 'Reassign to me', action: 'mine' },
      { label: 'Open patient chart', action: 'chart' },
      { label: 'Delete task', action: 'delete', danger: true },
    ],
    (action) => {
      /* Start and Complete go through the same comment dialog the detail
         panel uses. The row menu is a shortcut to the same two moves, and a
         move made from a row is no less worth a sentence than the same move
         made from the panel — leaving the shortcut silent would mean the trail
         recorded a comment or not depending on which control was nearer the
         mouse. The dialog carries the task with it, so it does not matter
         whether the panel happens to be open on this one. */
      if (action === 'complete' || action === 'start') {
        openStepModal(action, task, anchor);
        return;
      }

      if (action === 'mine') {
        task.assignedTo = CURRENT_USER;
        flash(`${task.id} reassigned to you.`, 'success');
      } else if (action === 'chart') {
        window.location.href = `patient-chart.html?mrn=${encodeURIComponent(task.mrn)}`;
        return;
      } else if (action === 'delete') {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        flash(`${task.id} deleted.`, 'success');
      }
      applyAll();
      applyMine();
    }
  );
}

function recallMenu(anchor, id) {
  const recall = state.recalls.find((r) => r.id === id);
  if (!recall) return;

  openMenu(
    anchor,
    [
      { label: 'Send letter', action: 'letter' },
      { label: 'Mark booked', action: 'booked' },
      { label: 'Create task', action: 'task' },
      { label: 'Open patient chart', action: 'chart' },
    ],
    (action) => {
      if (action === 'letter') {
        recall.status = 'letter-sent';
        recall.lastContacted = dueLabelFor(todayIso()) === 'Today' ? 'Today' : todayIso();
        flash(`Letter queued for ${recall.patient}.`, 'success');
      } else if (action === 'booked') {
        recall.status = 'booked';
        flash(`${recall.patient} marked as booked.`, 'success');
      } else if (action === 'task') {
        addTask({
          patient: recall.patient,
          mrn: recall.mrn,
          subject: `Recall — ${recall.dueFor}`,
          detail: `Due ${recall.dueLabel}`,
          priority: recall.status === 'overdue' ? 'medium' : 'low',
          assignedTo: CURRENT_USER,
          from: 'Recalls',
          due: recall.due,
        });
        flash(`Task raised for ${recall.patient}.`, 'success');
      } else if (action === 'chart') {
        window.location.href = `patient-chart.html?mrn=${encodeURIComponent(recall.mrn)}`;
        return;
      }
      applyRecalls();
    }
  );
}

function refillMenu(anchor, id) {
  const refill = state.refills.find((r) => r.id === id);
  if (!refill) return;

  openMenu(
    anchor,
    [
      { label: 'View request', action: 'view' },
      { label: 'Open patient chart', action: 'chart' },
    ],
    (action) => {
      if (action === 'chart') {
        window.location.href = `patient-chart.html?mrn=${encodeURIComponent(refill.mrn)}`;
      } else {
        flash(`${refill.id} — ${refill.medication} for ${refill.patient}.`);
      }
    }
  );
}

function orderMenu(anchor, id) {
  const lab = state.ordersF.sub === 'lab';
  const row = (lab ? state.labOrders : state.prescriptions).find((o) => o.id === id);
  if (!row) return;

  openMenu(
    anchor,
    lab
      ? [
          { label: 'View requisition', action: 'view' },
          { label: 'Print requisition', action: 'print' },
          { label: 'Cancel order', action: 'cancel', danger: true },
        ]
      : [
          { label: 'View prescription', action: 'view' },
          { label: 'Resend to pharmacy', action: 'resend' },
        ],
    (action) => {
      if (action === 'print') {
        window.print();
        return;
      }
      if (action === 'cancel') {
        row.status = 'cancelled';
        flash(`${row.id} cancelled.`, 'success');
      } else if (action === 'resend') {
        row.status = 'sent';
        flash(`${row.id} resent to ${row.pharmacy}.`, 'success');
      } else {
        flash(`${row.id} — ${row.patient}.`);
      }
      applyOrders();
    }
  );
}

/* ============================================================================
   TASK DETAIL PANEL

   The panel docked to the right of the worklist — see the comment on #taskPane
   in screens/tasks.html for why it is docked rather than centred.

   IT IS THE SAME WORKING COPY, NOT A SNAPSHOT. Everything drawn here reads
   straight out of state.tasks, and everything done here writes straight back
   to it and repaints both the panel and the tables beneath. A task started
   from the panel therefore changes its Status cell in the row behind it while
   the panel is still open, which is the whole reason the list stayed visible.

   ONLY TASKS OPEN HERE. A recall, a refill and a lab order are different
   objects with different facts and different verbs; giving them a panel that
   merely looks the same would put five vocabularies behind one shape. Their
   IDs still answer with the status line they always did.
   ========================================================================= */

/** Which task the panel is showing, or null when it is closed. */
let openTaskId = null;

/**
 * Which of the panel's two lists is open — 'timeline' or 'comments'.
 *
 * It is remembered ACROSS TASKS rather than reset on every open. Reading a
 * worklist is done one task after another, and somebody working through a
 * morning's comments would otherwise be sent back to the timeline by every
 * row they clicked and have to press Comments again each time. The choice is
 * about how they are reading, not about the task in front of them.
 */
let paneTab = 'timeline';

/**
 * "2026-08-06T17:04" → "06 Aug, 5:04 PM", or "Today, 5:04 PM".
 *
 * The same relative-then-absolute rule the Due column follows: today's entries
 * are read against now, and anything older is read as a date.
 */
function stampLabel(value) {
  if (!value) return '';
  const [date, time = ''] = String(value).split('T');
  const [hour24, minute] = time.split(':').map(Number);

  const clock = Number.isFinite(hour24)
    ? `${((hour24 + 11) % 12) + 1}:${String(minute ?? 0).padStart(2, '0')} ${
        hour24 < 12 ? 'AM' : 'PM'
      }`
    : '';

  const day = date === todayIso() ? 'Today' : dateLabel(date);
  return clock ? `${day}, ${clock}` : day;
}

/** "2026-08-06" → "06 Aug 2026". Spelled out, because a panel has the room. */
function dateLabel(iso) {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** The stamp to write on something that just happened. */
function nowStamp() {
  const now = new Date();
  return `${todayIso()}T${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

/**
 * The priority mark: two chevrons up for High and Medium, two bars for Low.
 * Shape first, colour second — see the sprite's note on the three.
 */
function priorityMark(priority) {
  const entry = TASK_PRIORITIES[priority] ?? TASK_PRIORITIES.low;
  const name = priority === 'low' ? 'priority-medium' : 'priority-high';
  return icon(name, `ui-icon tsk__prio tsk__prio--${entry.tone}`);
}

/**
 * Add an entry to the task's own trail.
 *
 * `comment` is what the person moving the task had to say about it, and it
 * hangs off the entry rather than being spliced into `action`: the action is a
 * fixed phrase the timeline can rely on ("completed this task"), and a
 * sentence somebody typed is not. Kept separate, the trail still reads as a
 * list of what happened, with the words underneath the step they belong to.
 */
function noteOnTask(task, actor, action, comment = '') {
  task.history = [
    ...(task.history ?? []),
    { actor, action, at: nowStamp(), kind: 'person', ...(comment ? { comment } : {}) },
  ];
}

/* --- The rows ---------------------------------------------------------------
   Six facts, three of them editable. `edit` is the action name the click
   handler dispatches on; a row without one is a fact you can only read. */

function factRow(iconName, label, valueHtml, edit) {
  const value = edit
    ? `<button type="button" class="tsk__fact-edit" data-fact="${edit}">
         ${valueHtml}${icon('caret-down', 'ui-icon tsk__fact-caret')}
       </button>`
    : valueHtml;

  return `<div class="tsk__fact">
    <span class="tsk__fact-label">${icon(iconName)}${esc(label)}</span>
    <span class="tsk__fact-value">${value}</span>
  </div>`;
}

/**
 * What the primary button offers, which is whatever comes next for this task
 * rather than a list of every state it could be moved to.
 */
function nextStep(task) {
  /* The STORED status, not statusFor(). Overdue is a fact about the clock, not
     about how far the work has got: a task someone started last week is still
     in progress on the day it runs late, and offering them Start again would
     be the panel forgetting what they already did. The row's Status cell goes
     on saying Overdue, which is the part that is about time. */
  if (task.status === 'completed') return { action: 'reopen', label: 'Reopen', icon: 'rotate' };
  if (task.status === 'in-progress') return { action: 'complete', label: 'Complete', icon: 'check' };
  return { action: 'start', label: 'Start', icon: 'play' };
}

function paintTaskPane() {
  const pane = $('#taskPane');
  if (!pane) return;

  const task = state.tasks.find((t) => t.id === openTaskId);

  // The task can go while the panel is open — deleted from its own row menu,
  // or from the "⋮" on the row behind. Closing is the honest answer; leaving
  // a panel of facts about a record that no longer exists is not.
  if (!task) {
    closeTaskPane();
    return;
  }

  const step = nextStep(task);

  pane.innerHTML = `
    <div class="tsk__pane-head">
      ${priorityMark(task.priority)}
      <span class="tsk__pane-id" id="taskPaneId">${esc(task.id)}</span>
      <button type="button" class="tsk__pane-close" data-pane-close
        aria-label="Close ${esc(task.id)}" data-testid="tsk--pane-close">${icon('close')}</button>
    </div>

    <div class="tsk__pane-body">
      <h2 class="tsk__pane-title">${esc(task.subject)}</h2>

      ${
        task.description || task.detail
          ? `<p class="tsk__pane-label">${icon('menu')}Description</p>
             <p class="tsk__pane-desc">${esc(task.description || task.detail)}</p>`
          : ''
      }

      <div class="tsk__facts">
        ${factRow('tag', 'Type', esc(task.type ?? 'General'))}
        ${factRow(
          'flag',
          'Priority',
          `${priorityMark(task.priority)}${esc(TASK_PRIORITIES[task.priority]?.label ?? '—')}`,
          'priority'
        )}
        ${factRow('user-check', 'Assignee', esc(task.assignedTo), 'assignee')}
        ${factRow('calendar', 'Due', esc(dueLabelFor(task.due)), 'due')}
        ${factRow(
          'user',
          'Patient',
          task.mrn
            ? `<a class="tsk__id" href="patient-chart.html?mrn=${encodeURIComponent(
                task.mrn
              )}">${esc(task.patient)}</a>`
            : esc(task.patient)
        )}
        ${factRow('clock', 'Created', esc(dateLabel(task.created)))}
      </div>

      <div class="tsk__pane-actions">
        <ui-button variant="outline" icon="user-plus" full
          data-pane-action="reassign" data-testid="tsk--pane-reassign">Reassign</ui-button>
        <ui-button variant="primary" icon="${step.icon}" full
          data-pane-action="${step.action}" data-testid="tsk--pane-step">${step.label}</ui-button>
      </div>

      <div class="tsk__pane-tabs">
        <ui-tabs selected="${paneTab}" id="taskPaneTabs" aria-label="Task activity"
          data-testid="tsk--pane-tabs">
          <ui-tab value="timeline" label="Timeline"></ui-tab>
          <ui-tab value="comments" label="Comments"></ui-tab>
        </ui-tabs>
      </div>

      <div id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline"
        data-testid="tsk--pane-timeline"${paneTab === 'timeline' ? '' : ' hidden'}>
        <div class="tsk__tl">
          ${(task.history ?? [])
            .map(
              (entry) => `<div class="tsk__tl-item">
                <span class="tsk__tl-mark${
                  entry.kind === 'person' ? ' tsk__tl-mark--person' : ''
                }">${icon(entry.kind === 'person' ? 'user' : 'settings')}</span>
                <p class="tsk__tl-text">${esc(entry.actor)} ${esc(entry.action)}</p>
                ${
                  /* The comment, in the words it was typed in and marked as a
                     quotation, so it is not read as another thing the system
                     did. Absent on every entry that has none, which is most of
                     them — an empty line here would make the trail look like it
                     had lost something. */
                  entry.comment
                    ? `<p class="tsk__tl-comment">${esc(entry.comment)}</p>`
                    : ''
                }
                <p class="tsk__tl-when">${esc(stampLabel(entry.at))}</p>
              </div>`
            )
            .join('')}
        </div>
      </div>

      <div id="panel-comments" role="tabpanel" aria-labelledby="tab-comments"
        data-testid="tsk--pane-comments"${paneTab === 'comments' ? '' : ' hidden'}>
        ${commentComposer()}
        <div class="tsk__cmts" id="taskComments">${commentList(task)}</div>
      </div>
    </div>`;

  wirePane();
  pane.hidden = false;
}

/* --- The conversation -------------------------------------------------------
   THE SECOND TAB, and the reason there are tabs at all.

   The panel used to end in a timeline and nothing else, which meant the only
   way to say something about a task was to move it: the Start and Complete
   dialogs each take a comment, and both of those are a comment you can only
   leave at the moment you change the task's state. A question — "did anyone
   reach her?", "which report is this, the duplicate?" — had nowhere to go, so
   it went into the corridor and never came back to the record.

   This is that place. It is the shape everybody already knows from Jira,
   Linear and every issue tracker since: your own box at the top, the thread
   under it, each entry a face, a name, a time and the words.

   NEWEST FIRST, and the box ABOVE the thread. The usual argument for
   oldest-first — that a conversation is read in the order it happened — holds
   in a page-wide thread you scroll through once. This is a 24rem column below
   six facts and two buttons, and on the tasks that most need discussing the
   thread is longest; oldest-first would put the line that matters and the box
   you answer it in at the bottom of a scroll, every time. The most recent
   thing said is what the next person needs, so it is the first thing they get.
   -------------------------------------------------------------------------- */

/**
 * A person, as a name an avatar can make initials out of.
 *
 * "Dr. A. Mensah" initialises to DA, because <ui-avatar> takes the first
 * letter of the first two words and the first of those is a title. Dropping
 * the honorific gives AM — the initials the person actually goes by, and the
 * same two letters their colleagues write on a chart.
 */
function avatarName(name) {
  return String(name ?? '').replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.|Mx\.)\s+/, '');
}

/**
 * The box you write in, with your own face beside it.
 *
 * ONE LINE UNTIL IT IS USED. It opened as a three-row box with a button and a
 * shortcut under it, which put an empty rectangle the depth of two comments
 * between the tab and the first thing anyone had said — the thread was pushed
 * down the column by a control that was not being used. Collapsed, it reads as
 * the invitation it is; a click or a Tab into it gives the room to write in
 * and brings its buttons with it. The same behaviour Jira, Linear and GitHub
 * all settled on, for the same reason.
 */
function commentComposer() {
  return `<div class="tsk__cmt-new" id="taskCommentNew" data-testid="tsk--comment-new">
    <ui-avatar size="sm" name="${esc(avatarName(CURRENT_USER))}"></ui-avatar>
    <div class="tsk__cmt-field">
      <ui-textarea id="taskCommentBox" label="Add a comment" label-hidden rows="2"
        placeholder="Add a comment…" data-testid="tsk--comment-box"></ui-textarea>
      <div class="tsk__cmt-send">
        <span class="tsk__cmt-hint"><kbd>${keyHint()}</kbd> to post</span>
        <ui-button variant="tertiary" size="sm"
          data-pane-action="comment-cancel" data-testid="tsk--comment-cancel">Cancel</ui-button>
        <ui-button variant="primary" size="sm" icon="send"
          data-pane-action="comment" data-testid="tsk--comment-post">Comment</ui-button>
      </div>
    </div>
  </div>`;
}

/**
 * The shortcut, in the key this machine actually has. A Mac reader told to
 * press Ctrl looks for a key that does nothing there, and the reverse.
 */
function keyHint() {
  return /Mac|iPhone|iPad/.test(navigator.platform ?? '') ? '⌘ + Enter' : 'Ctrl + Enter';
}

/**
 * When a comment was left, read the way a conversation is read.
 *
 * The trail above keeps its absolute stamps — "06 Aug 2026, 5:04 PM" is what
 * an audit of a task wants, and every entry in it is equally far away. A
 * thread is not read like that: what matters about the last line is that it
 * was ten minutes ago rather than last week, and a column of full dates makes
 * the reader work that out for themselves on every one of them. So the recent
 * end is relative and the far end falls back to the date — with the exact
 * stamp on the element's title, because "3 h ago" is the wrong thing to quote
 * down a phone.
 */
function commentWhen(at) {
  const when = new Date(String(at));
  if (Number.isNaN(when.getTime())) return stampLabel(at);

  const now = new Date();
  const clock = `${((when.getHours() + 11) % 12) + 1}:${String(when.getMinutes()).padStart(
    2,
    '0'
  )} ${when.getHours() < 12 ? 'AM' : 'PM'}`;

  // Whole days between the two MIDNIGHTS, not hours divided by 24: something
  // said at 11pm was said yesterday when it is read at 1am, and "2 h ago" for
  // it would be true and useless.
  const midnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((midnight(now) - midnight(when)) / 86_400_000);

  if (days === 0) {
    /* FLOOR, not round. nowStamp() writes the minute and drops the seconds, so
       a comment posted forty seconds ago is 0.7 of a minute old — rounded, it
       would read "1 min ago" the instant it was posted. */
    const minutes = Math.max(0, Math.floor((now - when) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
  }
  if (days === 1) return `Yesterday, ${clock}`;
  return `${String(when.getDate()).padStart(2, '0')} ${MONTHS[when.getMonth()]}, ${clock}`;
}

/** The thread itself, newest first — see the note above. */
function commentList(task) {
  const comments = [...(task.comments ?? [])].reverse();

  /* An empty tab says what it is FOR rather than that it is empty. "No
     comments" is a fact the blank space had already given them; the invitation
     is the part they came for. */
  if (!comments.length) {
    return `<p class="tsk__cmt-empty" data-testid="tsk--comment-empty">
      ${icon('chat')}
      <span>Nothing said about this task yet. Ask a question or leave what you
      know — whoever picks it up next reads this first.</span>
    </p>`;
  }

  /* The count and the order, said once above the thread. Newest first is the
     right way round for a column this narrow (see above) and the wrong way
     round from what a reader expects of a conversation, so it is stated rather
     than left to be worked out from the timestamps. */
  const heading = `<p class="tsk__cmt-count">
    ${comments.length} comment${comments.length === 1 ? '' : 's'}
    <span>· newest first</span>
  </p>`;

  return (
    heading +
    comments
      .map((comment) => {
        const own = comment.author === CURRENT_USER;
        return `<article class="tsk__cmt${own ? ' tsk__cmt--own' : ''}">
          <ui-avatar size="sm" name="${esc(avatarName(comment.author))}"
            color="${own ? 'brand' : 'grey'}"></ui-avatar>
          <div class="tsk__cmt-body">
            <p class="tsk__cmt-head">
              <span class="tsk__cmt-who">${esc(comment.author)}</span>
              <time class="tsk__cmt-when" datetime="${esc(comment.at)}"
                title="${esc(stampLabel(comment.at))}">${esc(commentWhen(comment.at))}</time>
            </p>
            <p class="tsk__cmt-text">${esc(comment.body)}</p>
          </div>
        </article>`;
      })
      .join('')
  );
}

/**
 * Wire the two controls the repainted panel brings with it.
 *
 * Bound here rather than delegated from the document for the reason the Orders
 * sub-tabs give: every repaint throws these elements away, and a document-level
 * listener would go on holding the strip that no longer exists.
 */
function wirePane() {
  $('#taskPaneTabs')?.addEventListener('ui-change', (event) => {
    /* The strip shows and hides its own panels — all this has to do is
       remember which one, so the next task opens on the same list. Repainting
       here would throw away whatever is half-typed in the comment box. */
    paneTab = event.detail.value;
  });

  const box = $('#taskCommentBox')?.querySelector('textarea');
  box?.addEventListener('keydown', (event) => {
    // Enter alone stays a newline: a comment is prose, and a thread whose
    // paragraphs cannot be broken is one somebody stopped writing properly.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      postComment();
    }
    // Escape gives the box up, the way it closes every other transient thing
    // in the product — but only while it is empty, so a paragraph someone has
    // been writing cannot be lost to a key pressed out of habit.
    if (event.key === 'Escape' && !box.value.trim()) collapseComposer();
  });

  /* Open on the way in, shut again on the way out — and only shut on an EMPTY
     box. Half a sentence left in it is work in progress, and a composer that
     folded it away every time somebody looked at the thread to check a name
     would be hiding what they were in the middle of writing.

     focusin/focusout rather than focus/blur: the buttons underneath are inside
     this box, and moving to one of them is not leaving. */
  const composer = $('#taskCommentNew');
  composer?.addEventListener('focusin', () => composer.classList.add('tsk__cmt-new--open'));
  composer?.addEventListener('focusout', (event) => {
    if (composer.contains(event.relatedTarget)) return;
    if (!box?.value.trim()) composer.classList.remove('tsk__cmt-new--open');
  });
}

/** Give the box up: empty it, fold it, and hand focus back to the thread. */
function collapseComposer() {
  const box = $('#taskCommentBox')?.querySelector('textarea');
  if (box) box.value = '';
  $('#taskCommentNew')?.classList.remove('tsk__cmt-new--open');
  box?.blur();
}

/**
 * Post what is in the box.
 *
 * It does NOT write a timeline entry. A comment is not a change to the task,
 * and "Dr. A. Mensah commented on this task" in the trail is a line that tells
 * the reader nothing they cannot see by pressing the tab it is about — while
 * making a trail read for state changes noisier the more the task is talked
 * about. The two lists stay what they each are.
 */
function postComment() {
  const task = state.tasks.find((t) => t.id === openTaskId);
  const box = $('#taskCommentBox');
  const control = box?.querySelector('textarea');
  if (!task || !control) return;

  const body = control.value.trim();
  if (!body) {
    // Nothing typed is not an error worth a red box — it is a miss. The caret
    // goes where the words were meant to go.
    control.focus();
    return;
  }

  task.comments = [...(task.comments ?? []), { author: CURRENT_USER, at: nowStamp(), body }];

  /* Only the thread is redrawn, not the whole panel: repainting would replace
     the box the person is still standing in and take their caret with it. */
  const list = $('#taskComments');
  if (list) list.innerHTML = commentList(task);
  control.value = '';
  control.focus();
  flash(`Comment added to ${task.id}.`, 'success');
}

function openTaskPane(id) {
  openTaskId = id;

  /* THE PANEL MOVES TO THE WORKLIST, rather than one panel per tab.

     It is a column of whichever card is open, so it has to be inside that
     tab's panel to sit beside it — and it is parked outside them all in the
     markup so that repainting a worklist can never take it with it. The class
     is what turns that tab into two columns, and this is the only place that
     knows which list is being read, so both are settled here. */
  const host = $(`#panel-${state.tab}`);
  const pane = $('#taskPane');
  if (host && pane) {
    /* The move is conditional, the class is NOT. Closing the panel leaves it
       parked in the worklist it was read from and takes only the class off, so
       on every open after the first the parent is already right and there is
       nothing to move — but the tab still needs telling it has two columns
       again. Adding the class inside the move meant the second open silently
       stayed one column: the panel dropped below the table at full width and
       the worklist collapsed to a single row above it. */
    if (pane.parentElement !== host) host.appendChild(pane);
    host.classList.add('tsk__split');
  }

  paintTaskPane();
  rememberOpenTask();
  // Focus lands on the way out rather than on the first fact: the panel is
  // opened to be read, and moving focus to a control would make a screen
  // reader announce that control instead of the task.
  $('#taskPane [data-pane-close]')?.focus();
}

/**
 * The open task goes in the URL, for the same reason the open tab does: a task
 * is the thing people send each other. "Have a look at TK-4344" is a link that
 * lands on the task with its worklist behind it, rather than on a worklist
 * with instructions to go and find a row.
 */
function rememberOpenTask() {
  const url = new URL(window.location.href);
  if (openTaskId) url.searchParams.set('task', openTaskId);
  else url.searchParams.delete('task');
  window.history.replaceState(null, '', url);
}

function closeTaskPane() {
  const pane = $('#taskPane');
  if (!pane || pane.hidden) return;

  // Back to the row it was opened from, if that row is still on the page —
  // otherwise focus would fall to the top of the document and the reader would
  // have to walk the whole worklist again.
  const row = document.querySelector(`[data-open="${openTaskId}"]`);
  openTaskId = null;
  pane.hidden = true;
  pane.innerHTML = '';

  // The list takes the whole card back. The panel itself stays where it was
  // parked — an empty, hidden element beside the table costs nothing, and
  // moving it home would be a second place that has to know where home is.
  pane.parentElement?.classList.remove('tsk__split');

  rememberOpenTask();
  row?.focus();
}

/** The three editable facts, each answered by the row menu control. */
function editFact(anchor, field) {
  const task = state.tasks.find((t) => t.id === openTaskId);
  if (!task) return;

  const choices = {
    priority: Object.entries(TASK_PRIORITIES).map(([key, entry]) => ({
      label: entry.label,
      action: key,
    })),
    assignee: STAFF.map((name) => ({ label: name, action: name })),
    // Relative, not a date picker: a due date moved from here is moved by "not
    // today, tomorrow" reasoning, and the dialog that creates a task is where
    // an exact date belongs.
    due: [
      { label: 'Today', action: '0' },
      { label: 'Tomorrow', action: '1' },
      { label: 'In 3 days', action: '3' },
      { label: 'Next week', action: '7' },
    ],
  }[field];

  openMenu(anchor, choices, (value) => {
    if (field === 'priority') {
      task.priority = value;
      noteOnTask(task, CURRENT_USER, `set priority to ${TASK_PRIORITIES[value].label}`);
      flash(`${task.id} is now ${TASK_PRIORITIES[value].label}.`, 'success');
    } else if (field === 'assignee') {
      task.assignedTo = value;
      noteOnTask(task, CURRENT_USER, `assigned this task to ${value}`);
      flash(`${task.id} assigned to ${value}.`, 'success');
    } else {
      const due = new Date(`${todayIso()}T00:00:00`);
      due.setDate(due.getDate() + Number(value));
      task.due = [
        due.getFullYear(),
        String(due.getMonth() + 1).padStart(2, '0'),
        String(due.getDate()).padStart(2, '0'),
      ].join('-');
      // A task moved into the future is no longer overdue, whatever it said a
      // moment ago; statusFor() derives that, so the stored status only has to
      // stop claiming otherwise.
      if (task.status === 'overdue') task.status = 'open';
      noteOnTask(task, CURRENT_USER, `moved the due date to ${dateLabel(task.due)}`);
      flash(`${task.id} is now due ${dueLabelFor(task.due)}.`, 'success');
    }
    applyAll();
    applyMine();
    paintTaskPane();
  });
}

/* --- Moving a task on, with something to say about it ----------------------
   Start and Complete are the two moments when the person holding a task knows
   something the task does not. Until now that knowledge had nowhere to go:
   both fired straight from the panel and wrote one fixed line into the trail,
   so the next person to open a closed task read "A. Mensah completed this
   task" and had to ring somebody to find out what happened.

   Both now ask, through one dialog rather than two — they are the same
   question at two moments, and the heading, the prompt and the button take
   their words from whichever verb opened it.

   The comment is OPTIONAL. Most tasks are exactly what their subject says;
   a required box would be answered with a full stop inside a week.

   Reopen does NOT ask. It is not progress on the work, it is an admission the
   task was closed too early, and the useful comment there is the next one —
   made when it is finished properly.
   -------------------------------------------------------------------------- */

/** The three verbs, in the words each one needs. */
const TASK_STEPS = {
  start: {
    heading: 'Start task',
    confirm: 'Start',
    prompt: 'Anything to note as you pick this up? Optional.',
    status: 'in-progress',
    trail: 'started this task',
    flash: (task) => `${task.id} is now in progress.`,
  },
  complete: {
    heading: 'Complete task',
    confirm: 'Complete',
    prompt: 'What was done, or why nothing was? Optional.',
    status: 'completed',
    trail: 'completed this task',
    flash: (task) => `${task.id} marked complete.`,
  },
};

/**
 * The verb the step dialog is about, and the task it is about it FOR.
 *
 * The task travels with the verb rather than being read back off `openTaskId`
 * at confirm time, because the dialog is reachable from two places: the detail
 * panel, where the open task is the subject, and a worklist row's ⋮ menu,
 * where the panel may not be open at all and the row may not be the task the
 * panel last showed. One of those two would have committed against the wrong
 * record.
 */
let pendingStep = null;

function openStepModal(action, task, trigger) {
  const step = TASK_STEPS[action];
  const modal = $('#taskStepModal');
  if (!step || !modal) return;

  pendingStep = { action, taskId: task.id };
  modal.setAttribute('heading', step.heading);

  const subject = $('#taskStepSubject');
  if (subject) subject.textContent = `${task.id} — ${task.subject}`;

  const comment = $('#taskStepComment');
  if (comment) {
    comment.setAttribute('placeholder', step.prompt);
    const box = comment.querySelector('textarea');
    // Blank every time: a comment left over from the last task is the one
    // thing this box must never carry into the next one.
    if (box) box.value = '';
    comment.setAttribute('value', '');
  }

  /* `text`, not .textContent. Writing text onto a <ui-button> wipes the
     <button> it rendered — the label changes and the control stops being a
     control. The component owns the swap; see the `text` attribute in
     ui-button.js. */
  $('[data-testid="tsk--step-confirm"]')?.setAttribute('text', step.confirm);

  modal.open(trigger);
}

/** Commit the verb the dialog was opened for, with whatever was typed. */
function confirmStep() {
  const step = TASK_STEPS[pendingStep?.action];
  const task = state.tasks.find((t) => t.id === pendingStep?.taskId);
  const wasOpen = pendingStep?.taskId === openTaskId;
  $('#taskStepModal')?.close();
  pendingStep = null;
  if (!step || !task) return;

  const comment = ($('#taskStepComment')?.querySelector('textarea')?.value || '').trim();
  task.status = step.status;
  noteOnTask(task, CURRENT_USER, step.trail, comment);
  flash(step.flash(task), 'success');

  applyAll();
  applyMine();
  /* Only if the panel was already showing this task. paintTaskPane() unhides
     the panel as a matter of course, so calling it after a move made from a
     row menu would open a detail column nobody asked for. */
  if (wasOpen) paintTaskPane();
}

/* --- Handing a task to somebody else ---------------------------------------
   Reassign used to open the same nine-name dropdown the Assignee fact row
   opens, anchored under the button: a bare list of people with no task
   attached to it. That is fine on the fact row, which sits inside a panel
   already headed by the task it belongs to, and wrong on a button that is
   also reachable with the list scrolled somewhere else entirely — every row
   on this screen looks like every other row, and a menu that names only
   people cannot tell you which task it is about to move.

   So the button asks in a dialog in the middle of the screen, which is the
   house shape for a decision that commits something (see the step dialog
   above). It names the task, states who has it now, and only then offers the
   roster. The note is optional for the same reason the step comment is: most
   handovers are self-explanatory, and a required box would be answered with
   a full stop inside a week. Filled, it hangs under the trail entry so the
   next person reads why it landed with them rather than just that it did. */

/** The task the reassign dialog is open for, held for the same reason
    pendingStep is: the dialog outlives the click that opened it, and the
    panel behind it may have moved on by the time Reassign is pressed. */
let pendingReassign = null;

function openReassignModal(task, trigger) {
  const modal = $('#taskReassignModal');
  if (!modal) return;

  pendingReassign = task.id;

  const subject = $('#taskReassignSubject');
  if (subject) subject.textContent = `${task.id} — ${task.subject}`;

  /* Who holds it and how soon it matters — the two facts that decide whether
     this task should move at all, said in the words the worklist says them in.
     "Due" is not prefixed onto an overdue label: dueLabelFor already answers
     with "Overdue 18 d" there, and "Due Overdue 18 d" is not a sentence.
     ISO dates compare as strings, which is what makes that test one line. */
  const from = $('#taskReassignFrom');
  if (from) {
    const holder = task.assignedTo ? `Currently with ${task.assignedTo}` : 'Currently unassigned';
    const when = !task.due
      ? 'no due date'
      : task.due < todayIso()
        ? dueLabelFor(task.due).toLowerCase()
        : `due ${dueLabelFor(task.due)}`;
    from.textContent = `${holder} — ${when}.`;
  }

  /* The person who already holds it is not an answer to "who should hold it
     instead", so they are left out rather than offered and then rejected. */
  const picker = $('#taskReassignTo');
  if (picker) {
    /* Attributes first, options last. Every one of these three writes redraws
       the control, and the redraw reads the value and error attributes off the
       element as it goes — so the list is filled after them, and the field
       that ends up on screen is the empty, unerrored one. */
    picker.removeAttribute('error');
    picker.setAttribute('value', '');
    picker.setOptions(STAFF.filter((name) => name !== task.assignedTo));
  }

  // Blank every time — a note left over from the last handover is the one
  // thing this box must never carry into the next one.
  const note = $('#taskReassignNote');
  if (note) {
    const box = note.querySelector('textarea');
    if (box) box.value = '';
    note.setAttribute('value', '');
  }

  modal.open(trigger);
}

/** Commit the handover, with whatever was typed alongside it. */
function confirmReassign() {
  const task = state.tasks.find((t) => t.id === pendingReassign);
  const picker = $('#taskReassignTo');
  const to = picker?.value;
  if (!task) return;

  /* A dialog whose whole question is "who" cannot be answered with nobody.
     The refusal is said once, on the field — a second line at the foot of the
     form would repeat it in different words a centimetre lower down, which
     reads as two problems rather than one. */
  if (!to) {
    picker?.setAttribute('error', 'Choose who this goes to.');
    picker?.focus();
    return;
  }

  const wasOpen = pendingReassign === openTaskId;
  const note = ($('#taskReassignNote')?.querySelector('textarea')?.value || '').trim();

  $('#taskReassignModal')?.close();
  pendingReassign = null;

  task.assignedTo = to;
  noteOnTask(task, CURRENT_USER, `assigned this task to ${to}`, note);
  flash(`${task.id} assigned to ${to}.`, 'success');

  applyAll();
  applyMine();
  /* Only if the panel was already showing this task — paintTaskPane() unhides
     the panel as a matter of course, so calling it after a handover made from
     somewhere else would open a detail column nobody asked for. */
  if (wasOpen) paintTaskPane();
}

/** Reassign and the one primary verb. */
function paneAction(button, action) {
  const task = state.tasks.find((t) => t.id === openTaskId);
  if (!task) return;

  if (action === 'reassign') {
    openReassignModal(task, button);
    return;
  }

  if (action === 'comment') {
    postComment();
    return;
  }

  if (action === 'comment-cancel') {
    collapseComposer();
    return;
  }

  if (TASK_STEPS[action]) {
    openStepModal(action, task, button);
    return;
  }

  if (action === 'reopen') {
    task.status = 'open';
    noteOnTask(task, CURRENT_USER, 'reopened this task');
    flash(`${task.id} reopened.`, 'success');
  }

  applyAll();
  applyMine();
  paintTaskPane();
}

/* ============================================================================
   PATIENT-FIRST GATING

   Recall Form, New Refill Request and New Lab Order all ask who the record
   is for before anything else — Provider, Location, medication, tests all
   depend on that patient, so asking for them first just means re-asking
   once the patient is known. The rest of each dialog stays disabled until
   a patient is chosen.
   ========================================================================= */

function setFieldsDisabled(selectors, disabled) {
  for (const selector of selectors) {
    const field = $(selector);
    if (!field) continue;
    if (field.classList.contains('tsk__checks')) {
      field.classList.toggle('tsk__checks--disabled', disabled);
      field.querySelectorAll('input[type="checkbox"]').forEach((box) => {
        box.disabled = disabled;
      });
    } else {
      field.disabled = disabled;
    }
  }
}

/**
 * Wires the gate and returns a function that re-applies it — called once
 * more whenever the dialog opens, since a patient chosen on a previous
 * visit is still sitting in the field and the gate has to match it.
 */
function gatePatientFirst(patientSelector, fieldSelectors) {
  const patientField = $(patientSelector);
  const apply = () => setFieldsDisabled(fieldSelectors, !patientField?.value);
  patientField?.addEventListener('ui-change', apply);
  apply();
  return apply;
}

/* ============================================================================
   CREATING THINGS
   ========================================================================= */

function addTask(partial) {
  const author = partial.from === 'Self' || !partial.from ? CURRENT_USER : partial.from;

  const task = {
    id: `TK-${4413 + state.tasks.length}`,
    source: 'manual',
    status: 'open',
    dueLabel: '',
    type: 'General',
    created: todayIso(),
    ...partial,
  };

  /* A task made here starts its own trail rather than opening on an empty
     Timeline heading. Two entries, because two things genuinely happened: it
     was written, and it was handed to somebody. Anything a caller already
     knows better is passed in and kept. */
  task.history = partial.history ?? [
    { actor: author, action: 'created this task', at: nowStamp(), kind: 'person' },
    ...(task.assignedTo && task.assignedTo !== author
      ? [
          {
            actor: author,
            action: `assigned this task to ${task.assignedTo}`,
            at: nowStamp(),
            kind: 'person',
          },
        ]
      : []),
  ];

  state.tasks.unshift(task);
  applyAll();
  applyMine();
}

/* --- New Task dialog --------------------------------------------------------- */

/** What a new task is unless someone says otherwise. */
const DEFAULT_TASK_PRIORITY = 'low';


/**
 * SEVERAL RECIPIENTS, AND WHAT THAT COSTS SAID OUT LOUD.
 *
 * The field takes a set of names, because the same work is genuinely handed to
 * two or three people at once and asking for that one send at a time is the
 * same form typed three times.
 *
 * Behind it, three names are three tasks — three ids, three trails, three
 * statuses, and completing one completes nothing for the others. That is not a
 * shortcut taken here, it is what the record is: a task has an assignee, a
 * status and a history, all of which are answers about one person, so there is
 * no such object as one task owned by three people.
 *
 * The old chip row did exactly this and never said so, which is why it was
 * taken out. What comes back with it is the sentence saying so — see
 * paintFanout(), which draws "Sends 3 separate tasks — one each…" under the
 * field the moment a second name is picked, before Send is pressed rather than
 * a week later when somebody closes one of the three.
 *
 * Order is the list's own, not the order the names were ticked in — see
 * syncRecipientPicker(), which reads the set back off the control after
 * writing it. The face on the closed field reads in that order, so the
 * confirmation has to as well: a person checking that a send went where they
 * meant it to is comparing two lines of the same names.
 */
function setRecipients(names) {
  state.taskRecipients = [...new Set((names ?? []).filter(Boolean))];

  /* Naming somebody answers the only complaint this field can make, so the
     complaint goes as soon as it is answered rather than sitting in red until
     the next attempt to send. Clearing it re-renders the field — the <select>
     underneath is replaced — which is precisely why the sync below runs after
     it rather than before. */
  const picker = $('#taskRecipientPicker');
  if (picker?.hasAttribute('error')) picker.removeAttribute('error');

  syncRecipientPicker();
  paintFanout();
}

/**
 * Put the chosen set back onto the control, whatever the control is now.
 *
 * WHY NOT JUST WRITE `value`. A multiple <ui-select> carries its answers as
 * one comma-joined string, and half this practice is called "K. Brandt, RN" —
 * a name with a comma in it. Written into that attribute and read back out it
 * becomes two names, neither of which is anybody. So the selection is set on
 * the real <option>s, by identity, and never round-tripped through a string.
 *
 * The `change` is dispatched rather than implied because two other things are
 * listening for it and both have to keep up: the face select-menu.js draws
 * over the hidden <select>, which is what a person actually reads, and
 * <ui-select>'s own handler, which quietly mirrors the value. The guard stops
 * that second one from calling straight back into setRecipients().
 */
let syncingRecipients = false;
function syncRecipientPicker() {
  const select = $('#taskRecipientPicker')?.querySelector('select');
  if (!select) return;

  const chosen = new Set(state.taskRecipients);
  for (const option of select.options) {
    option.selected = Boolean(option.value) && chosen.has(option.value);
  }

  syncingRecipients = true;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  syncingRecipients = false;

  /* Read the set back rather than trusting the order it went in. A <select>
     reports its selection in list order whatever order it was ticked in, and
     the face is drawn from that, so this is the order on screen — which is
     the order everything else about this send has to speak in. */
  state.taskRecipients = [...select.selectedOptions].map((o) => o.value).filter(Boolean);
}

/** Add one name to the set without disturbing the ones already in it. */
function addRecipient(name) {
  if (!name) return;
  setRecipients([...state.taskRecipients, name]);
}

/**
 * The sentence that makes the fan-out honest.
 *
 * Drawn only from the second name on: one recipient is one task, which is what
 * a person already assumes, and a line explaining that would be noise in the
 * nine-out-of-ten case. Two or more is the case where the assumption is wrong,
 * so that is the case the dialog speaks up in.
 */
function paintFanout() {
  const note = $('#taskFanout');
  if (!note) return;

  const count = state.taskRecipients.length;
  note.hidden = count < 2;
  note.textContent =
    count < 2
      ? ''
      : `Sends ${count} separate tasks — one each, so each has its own status and history.`;
}

/**
 * How the confirmation reads a set of names back.
 *
 * Semicolons from three names on, because half the names in this practice have
 * a comma inside them — "K. Brandt, RN" — and a comma-separated list of them
 * reads as twice as many people as were actually written to. Two names take
 * the plain "and", where there is nothing to miscount.
 */
function nameList(names) {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join('; ')}; and ${names[names.length - 1]}`;
}

/**
 * Priority, as three buttons rather than a dropdown.
 *
 * Built from TASK_PRIORITIES so the vocabulary keeps one home — a fourth
 * priority would appear here the moment the data file grew one. Least urgent
 * first: the row then reads left to right the way escalation does, and
 * Routine — the answer nine times out of ten — is where the eye starts.
 */
function paintTaskPriorities() {
  const track = $('#taskPriority .tsk__seg-track');
  if (!track) return;

  track.innerHTML = Object.keys(TASK_PRIORITIES)
    .sort((a, b) => TASK_PRIORITIES[b].rank - TASK_PRIORITIES[a].rank)
    .map(
      (key) => `<label class="tsk__seg-item" data-tone="${TASK_PRIORITIES[key].tone}">
        <input type="radio" name="taskPriority" value="${key}"${
          key === DEFAULT_TASK_PRIORITY ? ' checked' : ''
        }>
        <span>${esc(TASK_PRIORITIES[key].label)}</span>
      </label>`
    )
    .join('');
}


function openTaskModal(trigger) {
  state.taskRecipients = [];
  $('#taskRecipientPicker')?.setAttribute('value', '');
  syncRecipientPicker();
  paintFanout();

  for (const id of ['#taskSubject']) {
    const field = $(id);
    if (field) {
      field.value = '';
      field.removeAttribute('error');
    }
  }
  const message = $('#taskMessage')?.querySelector('textarea');
  if (message) message.value = '';

  $('#taskStart')?.setAttribute('value', todayIso());
  $('#taskDue')?.setAttribute('value', '');

  const routine = $(`#taskPriority input[value="${DEFAULT_TASK_PRIORITY}"]`);
  if (routine) routine.checked = true;

  $('#taskRecipientPicker')?.removeAttribute('error');

  $('#taskModal')?.open(trigger);
}

function sendTask({ andNew = false } = {}) {
  const subjectField = $('#taskSubject');
  const subject = (subjectField?.value || '').trim();
  const picker = $('#taskRecipientPicker');
  const recipients = state.taskRecipients;

  // Both complaints this form can make are made by the field that has to
  // change, in the field's own error slot, and both move the caret there.
  // The recipient one used to be a line of red at the very bottom of the
  // panel — past the dates, three fields below the box it was about.
  if (!recipients.length) {
    picker?.setAttribute('error', 'Choose at least one recipient, or send it to yourself.');
    picker?.focus();
    return;
  }
  picker?.removeAttribute('error');

  if (!subject) {
    subjectField?.setAttribute('error', 'Give the task a subject.');
    subjectField?.focus();
    return;
  }
  subjectField?.removeAttribute('error');

  const patientName = $('#taskPatient')?.value || '';
  const patient = PATIENTS.find((p) => p.name === patientName);
  const due = $('#taskDue')?.value || todayIso();

  /* ONE TASK PER RECIPIENT, which is what the line under the picker has been
     saying since the second name went in. Each is a whole task in its own
     right — its own id, its own trail, its own status — rather than one row
     with three names on it, because there is no such row: everything the
     worklist, the filters and the detail panel read off a task is an answer
     about one person. */
  const shared = {
    patient: patient?.name ?? '—',
    mrn: patient?.mrn ?? '',
    subject,
    detail: ($('#taskMessage')?.querySelector('textarea')?.value || '').trim(),
    // The dialog has always asked for a Type and then dropped the answer on
    // the floor; the detail panel is the first thing that shows it back.
    type: $('#taskType')?.value || 'General',
    priority: $('#taskPriority input:checked')?.value ?? DEFAULT_TASK_PRIORITY,
    from: 'Self',
    due,
  };

  for (const assignedTo of recipients) addTask({ ...shared, assignedTo });

  /* The confirmation counts, because the count is the thing a person needs to
     have noticed: one send has just put three separate rows in the worklist. */
  flash(
    recipients.length === 1
      ? `Task sent to ${recipients[0]}.`
      : `${recipients.length} tasks sent — one each to ${nameList(recipients)}.`,
    'success'
  );

  if (andNew) {
    // Keep the dialog open and clear it, which is what "Send & New" is for.
    state.taskRecipients = [];
    $('#taskRecipientPicker')?.setAttribute('value', '');
    syncRecipientPicker();
    paintFanout();
    if (subjectField) subjectField.value = '';
    const message = $('#taskMessage')?.querySelector('textarea');
    if (message) message.value = '';
    subjectField?.focus();
    return;
  }
  $('#taskModal')?.close();
}

/* --- Recall form ------------------------------------------------------------- */

function openRecallModal(trigger) {
  for (const id of ['#recallPatient', '#recallProvider', '#recallType', '#recallDate']) {
    $(id)?.removeAttribute('error');
  }
  $('#recallDate')?.setAttribute('value', '');
  const note = $('#recallNote')?.querySelector('textarea');
  if (note) note.value = '';
  const error = $('#recallError');
  if (error) error.hidden = true;
  applyRecallGate();

  $('#recallModal')?.open(trigger);
}

function saveRecall() {
  const patientName = $('#recallPatient')?.value;
  const provider = $('#recallProvider')?.value;
  const type = $('#recallType')?.value;
  const date = $('#recallDate')?.value;

  let ok = true;
  for (const [selector, value, message] of [
    ['#recallPatient', patientName, 'Choose a patient.'],
    ['#recallProvider', provider, 'Choose a provider.'],
    ['#recallType', type, 'Choose a recall type.'],
    ['#recallDate', date, 'Set a due date.'],
  ]) {
    // Every problem is reported at once — validating one field at a time makes
    // the user press Save four times to find four mistakes.
    if (value) $(selector)?.removeAttribute('error');
    else {
      $(selector)?.setAttribute('error', message);
      ok = false;
    }
  }
  if (!ok) return;

  const patient = PATIENTS.find((p) => p.name === patientName);
  state.recalls.unshift({
    id: `RC-${2320 + state.recalls.length}`,
    patient: patientName,
    mrn: patient?.mrn ?? '',
    dueFor: type,
    interval: $('#recallInterval')?.value || '1 year',
    provider,
    location: $('#recallLocation')?.value || RECALL_LOCATIONS[0],
    source: 'manual-form',
    due: date,
    dueLabel: dueLabelFor(date),
    lastContacted: null,
    status: date < todayIso() ? 'overdue' : 'upcoming',
  });

  $('#recallModal')?.close();
  applyRecalls();
  flash(`Recall created for ${patientName}.`, 'success');
}

/* --- New lab order ------------------------------------------------------------ */

function openLabModal(trigger) {
  for (const id of ['#labPatient', '#labProvider']) $(id)?.removeAttribute('error');
  document.querySelectorAll('#labTests input:checked').forEach((box) => {
    box.checked = false;
  });
  const error = $('#labError');
  if (error) error.hidden = true;
  applyLabGate();
  $('#labOrderModal')?.open(trigger);
}

function saveLabOrder() {
  const patientName = $('#labPatient')?.value;
  const provider = $('#labProvider')?.value;
  const tests = [...document.querySelectorAll('#labTests input:checked')];
  const error = $('#labError');

  let ok = true;
  if (patientName) $('#labPatient')?.removeAttribute('error');
  else {
    $('#labPatient')?.setAttribute('error', 'Choose a patient.');
    ok = false;
  }
  if (provider) $('#labProvider')?.removeAttribute('error');
  else {
    $('#labProvider')?.setAttribute('error', 'Choose an ordering provider.');
    ok = false;
  }
  if (error) {
    error.textContent = 'Select at least one test.';
    error.hidden = tests.length > 0;
  }
  if (!ok || !tests.length) return;

  const patient = PATIENTS.find((p) => p.name === patientName);
  state.labOrders.unshift({
    id: `OR-${10260 + state.labOrders.length}`,
    patient: patientName,
    mrn: patient?.mrn ?? '',
    priority:
      Object.keys(TASK_PRIORITIES).find(
        (key) => TASK_PRIORITIES[key].label === $('#labPriority')?.value
      ) ?? 'low',
    tests: tests.length,
    route: $('#labRoute')?.value || ORDER_ROUTES[0],
    provider,
    ordered: todayIso(),
    orderedLabel: 'Today',
    status: 'in-progress',
  });

  $('#labOrderModal')?.close();
  state.ordersF.sub = 'lab';
  paintOrders();
  paintHeaderControls();
  paintHeaderAction();
  flash(`Lab order sent for ${patientName}.`, 'success');
}

/* --- New refill request --------------------------------------------------------
   Refill requests normally arrive from the pharmacy, not typed in here —
   this is for the phone-call/fax exception, so it asks for exactly what a
   pharmacy's own request carries (medication, pharmacy, prescriber). */

function openRefillModal(trigger) {
  for (const id of ['#refillPatient', '#refillMedication', '#refillPharmacy', '#refillProvider']) {
    $(id)?.removeAttribute('error');
  }
  const medication = $('#refillMedication');
  if (medication) medication.value = '';
  const detail = $('#refillDetail');
  if (detail) detail.value = '';
  const error = $('#refillError');
  if (error) error.hidden = true;
  applyRefillGate();

  $('#refillModal')?.open(trigger);
}

function saveRefill() {
  const patientName = $('#refillPatient')?.value;
  const medication = ($('#refillMedication')?.value || '').trim();
  const pharmacy = $('#refillPharmacy')?.value;
  const provider = $('#refillProvider')?.value;

  let ok = true;
  for (const [selector, value, message] of [
    ['#refillPatient', patientName, 'Choose a patient.'],
    ['#refillMedication', medication, 'Enter the medication.'],
    ['#refillPharmacy', pharmacy, 'Choose a pharmacy.'],
    ['#refillProvider', provider, 'Choose a prescriber.'],
  ]) {
    if (value) $(selector)?.removeAttribute('error');
    else {
      $(selector)?.setAttribute('error', message);
      ok = false;
    }
  }
  if (!ok) return;

  const patient = PATIENTS.find((p) => p.name === patientName);
  state.refills.unshift({
    id: `RF-${8842 + state.refills.length}`,
    patient: patientName,
    mrn: patient?.mrn ?? '',
    medication,
    detail: ($('#refillDetail')?.value || '').trim(),
    pharmacy,
    provider,
    received: todayIso(),
    receivedLabel: 'Today',
    status: 'awaiting',
  });

  $('#refillModal')?.close();
  applyRefills();
  flash(`Refill request added for ${patientName}.`, 'success');
}

/* --- Refill decisions ---------------------------------------------------------- */

function approveRefill(id) {
  const refill = state.refills.find((r) => r.id === id);
  if (!refill) return;
  refill.status = 'approved';
  delete refill.reason;
  applyRefills();
  flash(`${refill.medication} approved for ${refill.patient}.`, 'success');
}

function openDeny(id, trigger) {
  const refill = state.refills.find((r) => r.id === id);
  if (!refill) return;
  state.pendingDeny = id;

  const body = $('#denyBody');
  if (body) {
    body.textContent = `${refill.medication} for ${refill.patient}, requested by ${refill.pharmacy}.`;
  }
  $('#denyReason')?.removeAttribute('error');
  const error = $('#denyError');
  if (error) error.hidden = true;
  $('#denyModal')?.open(trigger);
}

function confirmDeny() {
  const refill = state.refills.find((r) => r.id === state.pendingDeny);
  const reason = $('#denyReason')?.value;
  if (!refill) return;

  if (!reason) {
    $('#denyReason')?.setAttribute('error', 'Choose a reason.');
    return;
  }

  refill.status = 'denied';
  refill.reason = reason;
  state.pendingDeny = null;
  $('#denyModal')?.close();
  applyRefills();
  flash(`${refill.medication} denied — ${reason}.`, 'success');
}

/* --- Generate letters ----------------------------------------------------------- */

function openLetters(trigger) {
  const targets = visibleRecalls().filter(
    (r) => r.status === 'due' || r.status === 'overdue'
  );
  const body = $('#lettersBody');
  if (body) {
    body.textContent = targets.length
      ? `${targets.length} recall${targets.length === 1 ? '' : 's'} in this list are due or overdue and have no letter out.`
      : 'Nothing in this list is due or overdue, so there are no letters to generate.';
  }
  $('#lettersModal')?.open(trigger);
}

function confirmLetters() {
  const targets = visibleRecalls().filter((r) => r.status === 'due' || r.status === 'overdue');
  for (const recall of targets) {
    recall.status = 'letter-sent';
    recall.lastContacted = 'Today';
  }
  $('#lettersModal')?.close();
  applyRecalls();
  flash(
    targets.length
      ? `${targets.length} letter${targets.length === 1 ? '' : 's'} queued for printing.`
      : 'No letters to generate.',
    targets.length ? 'success' : 'info'
  );
}

/* ============================================================================
   ROUTING
   ========================================================================= */

const PAINTERS = {
  all: paintAll,
  mine: paintMine,
  recalls: paintRecalls,
  refills: paintRefills,
  orders: paintOrders,
};

/* Refilling a table, without the caller having to know which tab is open —
   what the shared filter panel needs after it changes anything. */
const APPLIERS = {
  all: applyAll,
  mine: applyMine,
  recalls: applyRecalls,
  refills: applyRefills,
  orders: applyOrders,
};

const painted = new Set();

/** Paint a tab the first time it is shown; afterwards it keeps its own state. */
function showTab(value) {
  state.tab = value;
  // The panel belongs to the list it was opened from. Left standing over the
  // Recalls table it would be a task's facts floating over another worklist's
  // rows, which is a claim the screen cannot back up.
  closeTaskPane();
  if (!painted.has(value)) {
    PAINTERS[value]?.();
    painted.add(value);
  }
  paintHeaderControls();
  paintHeaderAction();

  // The tab is the screen's whole navigation, so it belongs in the URL: a
  // recall worklist can then be linked to and reached with Back.
  const url = new URL(window.location.href);
  url.searchParams.set('tab', value);
  window.history.replaceState(null, '', url);
}

/* ============================================================================
   WIRING
   ========================================================================= */

/**
 * Fill a <ui-select> from JavaScript.
 *
 * setOptions() rather than the comma-separated `options` attribute: staff
 * names contain commas ("K. Brandt, RN") and the attribute would split one
 * name into two choices.
 */
function fillSelect(selector, options, value) {
  const field = $(selector);
  if (!field) return;
  field.setOptions(options);
  if (value) field.setAttribute('value', value);
}

function onClick(event) {
  const menuButton = event.target.closest('[data-menu]');
  if (menuButton) {
    const id = menuButton.dataset.menu;
    if (id.startsWith('TK')) taskMenu(menuButton, id);
    else if (id.startsWith('RC')) recallMenu(menuButton, id);
    else if (id.startsWith('RF')) refillMenu(menuButton, id);
    else orderMenu(menuButton, id);
    return;
  }

  const open = event.target.closest('[data-open]');
  if (open) {
    const id = open.dataset.open;
    // Only tasks have a panel. The other four worklists still answer, because
    // a link that does nothing at all reads as broken rather than as unbuilt.
    if (id.startsWith('TK')) openTaskPane(id);
    else flash(`${id} — detail view is not built in this prototype yet.`);
    return;
  }

  if (event.target.closest('[data-pane-close]')) {
    closeTaskPane();
    return;
  }

  const fact = event.target.closest('[data-fact]');
  if (fact) {
    editFact(fact, fact.dataset.fact);
    return;
  }

  /* "Me" adds rather than replaces. The commonest pairing in this dialog is
     somebody else and the person typing — assign the chase, keep the copy —
     and a quick-pick that threw away the name already chosen would make that
     the one thing the button could not do. */
  if (event.target.closest('[data-testid="tsk--recipient-self"]')) {
    addRecipient(CURRENT_USER);
  }
}

function onUiClick(event) {
  const hit = (testid) => event.target.closest(`[data-testid="${testid}"]`);

  const paneButton = event.target.closest('[data-pane-action]');
  if (paneButton) return paneAction(paneButton, paneButton.dataset.paneAction);

  if (hit('tsk--new-task')) return openTaskModal(event.target.closest('ui-button'));
  if (hit('tsk--send')) return sendTask();
  if (hit('tsk--send-new')) return sendTask({ andNew: true });
  if (hit('tsk--new-recall')) return openRecallModal(event.target.closest('ui-button'));
  if (hit('tsk--recall-save')) return saveRecall();
  if (hit('tsk--generate-letters')) return openLetters(event.target.closest('ui-button'));
  if (hit('tsk--letters-confirm')) return confirmLetters();

  if (hit('tsk--new-lab-order')) return openLabModal(event.target.closest('ui-button'));
  if (hit('tsk--lab-save')) return saveLabOrder();
  if (hit('tsk--rx-refresh')) return flash('Prescription statuses refreshed.', 'success');

  if (hit('tsk--new-refill')) return openRefillModal(event.target.closest('ui-button'));
  if (hit('tsk--refill-save')) return saveRefill();

  const approve = event.target.closest('[data-approve]');
  if (approve) return approveRefill(approve.dataset.approve);

  const deny = event.target.closest('[data-deny]');
  if (deny) return openDeny(deny.dataset.deny, deny);

  if (hit('tsk--deny-confirm')) return confirmDeny();
  if (hit('tsk--step-confirm')) return confirmStep();
  if (hit('tsk--reassign-confirm')) return confirmReassign();

  if (event.target.closest('[data-tsk-dismiss]')) {
    // Cancelling the step dialog abandons the verb with it. Left set, a later
    // confirm on a different task would commit whichever move was last
    // offered and walked away from.
    if (event.target.closest('#taskStepModal')) pendingStep = null;
    if (event.target.closest('#taskReassignModal')) pendingReassign = null;
    event.target.closest('ui-modal')?.close();
  }
  return undefined;
}

/**
 * The search boxes. Every keystroke, one per worklist.
 *
 * The filter SELECTS used to arrive here too, which is why this was a
 * twenty-entry lookup table. They are the panel's business now, and the panel
 * reports its whole state at once — see onPanelFilterChange below.
 */
function onFilterChange(event) {
  const id = event.target.closest('[id]')?.id;
  const value = event.detail?.value ?? '';

  const map = {
    allSearch: () => (state.all.search = value),
    mineSearch: () => (state.mine.search = value),
    recallSearch: () => (state.recallsF.search = value),
    refillSearch: () => (state.refillsF.search = value),
    orderSearch: () => (state.ordersF.search = value),
  };

  if (!map[id]) return;
  map[id]();

  // Only the table is refilled — the toolbar the user is typing in is left
  // alone, which is what keeps the caret where it was.
  resetPaging();
  APPLIERS[state.tab]?.();
}

/**
 * A box was ticked in the filter panel.
 *
 * Every group is named after the key it answers on this tab's slice of state,
 * so writing the answers back is one assignment — with `future` translated on
 * the way through, because it is a boolean rather than a set.
 */
function onPanelFilterChange(values) {
  const f = filterState();
  if (!f) return;
  for (const [key, picked] of Object.entries(values)) {
    if (!(key in f)) continue;
    f[key] = key === 'future' ? picked.includes('on') : picked;
  }
  resetPaging();
  APPLIERS[state.tab]?.();
}

/**
 * A header was clicked. The table reports which column and which direction and
 * re-renders itself; reordering the rows is this screen's job, because this
 * screen owns the data.
 */
function onSort(event) {
  const id = event.target.closest('ui-data-table')?.id;
  const sort = { key: event.detail.key, direction: event.detail.direction };

  const targets = {
    allTable: () => {
      state.all.sort = sort;
      applyAll();
    },
    mineTable: () => {
      state.mine.sort = sort;
      applyMine();
    },
    recallTable: () => {
      state.recallsF.sort = sort;
      applyRecalls();
    },
    refillTable: () => {
      state.refillsF.sort = sort;
      applyRefills();
    },
    orderTable: () => {
      state.ordersF.sort = sort;
      applyOrders();
    },
  };
  if (!targets[id]) return;
  // Reordering the whole list while the reader is on page 2 would hand them
  // the middle of the new order; the top of it is what they asked for.
  resetPaging();
  targets[id]();
}

/* ============================================================================
   BOOT
   ========================================================================= */

customElements.whenDefined('ui-data-table').then(() => {
  // Dialog dropdowns are filled from the data file rather than hard-coded in
  // the markup, so a new staff member or location appears everywhere at once.
  fillSelect('#taskRecipientPicker', STAFF);
  fillSelect('#taskPatient', PATIENTS.map((p) => p.name));
  fillSelect('#taskType', TASK_TYPES, 'General');
  paintTaskPriorities();

  fillSelect('#recallPatient', PATIENTS.map((p) => p.name));
  fillSelect('#recallProvider', RECALL_PROVIDERS);
  fillSelect('#recallLocation', RECALL_LOCATIONS, RECALL_LOCATIONS[0]);
  fillSelect('#recallType', RECALL_TYPES);
  fillSelect('#recallInterval', RECALL_INTERVALS, '1 year');

  fillSelect('#labPatient', PATIENTS.map((p) => p.name));
  fillSelect('#labProvider', RECALL_PROVIDERS);
  fillSelect('#labRoute', ORDER_ROUTES, ORDER_ROUTES[0]);
  fillSelect(
    '#labPriority',
    Object.values(TASK_PRIORITIES).map((p) => p.label),
    TASK_PRIORITIES.low.label
  );
  fillSelect('#denyReason', DENIAL_REASONS);
  fillSelect('#lettersHeader', ['GastroEMR Practice Header', 'Centered Referral Header'], 'GastroEMR Practice Header');

  fillSelect('#refillPatient', PATIENTS.map((p) => p.name));
  fillSelect('#refillPharmacy', PHARMACIES);
  fillSelect('#refillProvider', RECALL_PROVIDERS);

  const labTests = $('#labTests');
  if (labTests) {
    labTests.innerHTML = LAB_TESTS.map(
      (test) => `<label class="tsk__check">
        <input type="checkbox" value="${esc(test)}"><span>${esc(test)}</span>
      </label>`
    ).join('');
  }

  // Provider, location, medication, tests — everything past "who is this
  // for" — stays disabled until a patient is chosen. See gatePatientFirst.
  applyRecallGate = gatePatientFirst('#recallPatient', [
    '#recallProvider',
    '#recallLocation',
    '#recallType',
    '#recallInterval',
    '#recallDate',
    '#recallNote',
  ]);
  applyLabGate = gatePatientFirst('#labPatient', [
    '#labProvider',
    '#labRoute',
    '#labPriority',
    '#labTests',
  ]);
  applyRefillGate = gatePatientFirst('#refillPatient', [
    '#refillMedication',
    '#refillPharmacy',
    '#refillProvider',
    '#refillDetail',
  ]);

  const tabs = $('[data-testid="tsk--tabs"]');
  tabs?.addEventListener('ui-change', (event) => showTab(event.detail.value));

  document.addEventListener('click', onClick);
  document.addEventListener('ui-click', onUiClick);

  /* Escape closes the detail panel. <ui-modal> traps and handles its own, so
     this only ever reaches the panel — and a dialog opened over it (Reassign
     from the row menu, say) still closes first, because the dialog stops the
     key before it gets here. */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTaskPane();
  });
  document.addEventListener('ui-change', onFilterChange);
  document.addEventListener('ui-input', onFilterChange);
  document.addEventListener('ui-sort', onSort);

  /* --- The filter panel ---------------------------------------------------
     Opening, closing, Escape, click-away and the count badge all belong to
     <ui-filter> now. What is left is what this screen alone knows: which
     worklist the answers belong to, and that Clear here also empties the
     search box beside the button. */
  const filter = $('#tskFilter');
  filter?.addEventListener('ui-filter-change', (event) =>
    onPanelFilterChange(event.detail.values)
  );
  filter?.addEventListener('ui-filter-clear', clearTaskFilters);

  /* The picker IS the answer — the names it holds are the names Send reads,
     and nothing is cleared on change, so ticking a second person adds to the
     first rather than replacing it. `values` rather than `value`: the joined
     string cannot be split back apart safely when a name has a comma in it,
     which "K. Brandt, RN" does. The guard is for the echo syncRecipientPicker()
     causes when it writes the set back onto the control. */
  $('#taskRecipientPicker')?.addEventListener('ui-change', (event) => {
    if (syncingRecipients) return;
    setRecipients(event.detail.values ?? [event.detail.value]);
  });

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('tab');
  const start = Object.keys(PAINTERS).includes(requested) ? requested : 'all';
  if (start !== 'all') tabs?.setAttribute('selected', start);
  showTab(start);

  // After the tab, because showTab() closes the panel — the worklist has to be
  // standing before the task is opened over it.
  const task = params.get('task');
  if (task && state.tasks.some((t) => t.id === task)) openTaskPane(task);
});
