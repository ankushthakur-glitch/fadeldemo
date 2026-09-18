/**
 * AUDIT LOG — who did what, to whose record, and whether the system allowed it.
 *
 * WHAT THIS SCREEN IS FOR
 * Three questions, and the filter bar is built around them: "who has been in
 * this patient's chart?", "what did this user do last Tuesday?", and "what was
 * refused?". Everything else on the screen serves getting to one of those and
 * then getting the answer out of the building — hence Export.
 *
 * READ-ONLY, ON PURPOSE
 * The row menu offers View details and Copy entry ID. There is no edit and no
 * delete, and their absence is the feature: an audit log somebody can tidy is
 * not evidence of anything. See data/audit-log.js.
 *
 * EXPORTING IS ITSELF AUDITED
 * Taking the log out of the system is exactly the kind of act the log exists
 * to record, so it writes an entry about itself. That entry is at the top of
 * the table before the download finishes.
 */
import { createPager } from '../lib/pagination.js';
import { iconMarkup as icon } from '../lib/icons.js';
import {
  AUDIT_ACTORS,
  AUDIT_FILTER_ACTORS,
  AUDIT_CATEGORIES,
  AUDIT_EVENTS,
  AUDIT_OUTCOMES,
  EVENT_INDEX,
  buildAuditLog,
} from '../../data/audit-log.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { admits, chosen } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

const el = (id) => document.getElementById(id);
const test = (name) => document.querySelector(`[data-testid="aud--${name}"]`);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* The history is built once, at open. Re-deriving it per repaint would move
   entries under a reader mid-filter. */
const LOG = buildAuditLog();

/** The signed-in user, for entries this screen writes about itself. */
const VIEWER = AUDIT_ACTORS[0];

const state = {
  from: '',
  to: '',
  category: '',
  event: '',
  user: '',
  patient: '',
  outcome: '',
};

/* --- Dates ------------------------------------------------------------------
   Filter bounds are whole local days: From means from midnight, To means up to
   and including the end of that day. A range that stopped at midnight on the
   morning of the To date would drop that day's entries — the commonest thing
   anyone looks for is "today". */

function fromDateField(text) {
  const [y, m, d] = String(text || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : NaN;
}

function endOfDay(text) {
  const start = fromDateField(text);
  if (!Number.isFinite(start)) return NaN;
  const d = new Date(start);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function formatStamp(ms) {
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${d
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/* --- Filtering ---------------------------------------------------------------- */

function filtered() {
  const from = fromDateField(state.from);
  const to = endOfDay(state.to);
  const patient = state.patient.trim().toLowerCase();

  return LOG.filter((entry) => {
    if (Number.isFinite(from) && entry.at < from) return false;
    if (Number.isFinite(to) && entry.at > to) return false;
    /* Four sets rather than four single answers. An audit question is almost
       never about one category — "who touched billing OR scheduling last
       Tuesday", "every Failure and every Denied" — and asking it one value at
       a time meant reading the log four times. See js/lib/filter-set.js. */
    if (!admits(state.category, entry.category)) return false;
    if (!admits(state.event, entry.event)) return false;
    if (!admits(state.user, entry.actorId)) return false;
    if (!admits(state.outcome, entry.outcome)) return false;
    if (patient) {
      const haystack = entry.patient
        ? `${entry.patient.name} ${entry.patient.mrn}`.toLowerCase()
        : '';
      if (!haystack.includes(patient)) return false;
    }
    return true;
  });
}

/* ============================================================================
   THE SCREEN
   ========================================================================= */

const rowsHost = document.querySelector('[data-rows]');
const emptyNote = document.querySelector('[data-empty]');

const pager = createPager(document.querySelector('[data-foot="audit"]'), {
  noun: 'entries',
  testidPrefix: 'aud',
  onChange: () => paint(),
});

/* --- Filter controls -------------------------------------------------------

   Opening, closing, Escape, click-away, the count badge and Clear all belong
   to <ui-filter> (js/components/ui-filter.js). What is left here is what only
   this screen knows: which questions it asks, that Event Type depends on
   Category, and that a backwards date range is a slip rather than an
   instruction.
   --------------------------------------------------------------------------- */

const filterEl = el('audFilter');

filterEl.setGroupOptions(
  'category',
  Object.entries(AUDIT_CATEGORIES).map(([id, c]) => ({ value: id, label: c.label }))
);
/*
 * WHO DID IT — the filter a compliance officer reaches for first.
 *
 * Tick a person and the table is that person's activity and nothing else;
 * tick two and it is both of them, which is what the question "who has been
 * in this chart?" usually turns into once there is a name to check against a
 * second one. The roster is everyone the log can hold rather than only the
 * employees, so no entry sits outside every possible answer — see
 * AUDIT_FILTER_ACTORS in data/audit-log.js.
 *
 * The role rides along in the label because a practice roster has two Olivias
 * in it more often than it does not, and "which one" is not a question the
 * panel should make somebody leave to answer.
 */
filterEl.setGroupOptions(
  'user',
  AUDIT_FILTER_ACTORS.map((a) => ({ value: a.id, label: `${a.name} — ${a.role}` }))
);
filterEl.setGroupOptions(
  'outcome',
  Object.entries(AUDIT_OUTCOMES).map(([id, o]) => ({ value: id, label: o.label }))
);

/** Event types, narrowed to the ticked categories — all of them, now. */
function paintEventOptions() {
  const categories = chosen(state.category);
  const events = categories.length
    ? AUDIT_EVENTS.filter((e) => categories.includes(e.category))
    : AUDIT_EVENTS;

  filterEl.setGroupOptions(
    'event',
    events.map((e) => ({ value: e.id, label: e.label }))
  );
}

paintEventOptions();

filterEl.addEventListener('ui-filter-change', (event) => {
  const values = event.detail.values;
  Object.assign(state, {
    category: values.category,
    event: values.event,
    user: values.user,
    outcome: values.outcome,
  });

  /* An event type from a category just unticked would filter to nothing, and
     read as "there are no entries" rather than "that pair cannot co-exist".
     Only the orphans go: the event types belonging to the categories still
     ticked are answers the person deliberately gave and are kept. Narrowing
     the offered list does the removal — setGroupOptions drops a tick whose
     answer is no longer on offer. */
  if (event.detail.name === 'category') {
    paintEventOptions();
    state.event = filterEl.value.event;
  }

  pager.reset();
  paint();
});

['fFrom', 'fTo'].forEach((id) => {
  el(id).addEventListener('ui-change', () => {
    state.from = el('fFrom').value;
    state.to = el('fTo').value;
    /* A backwards range is a slip, not an instruction — pull the other end
       with it rather than reporting on nothing. */
    if (state.from && state.to && state.to < state.from) {
      if (id === 'fFrom') state.to = state.from;
      else state.from = state.to;
      el('fFrom').setAttribute('value', state.from);
      el('fTo').setAttribute('value', state.to);
    }
    pager.reset();
    paint();
  });
});

el('fPatient').addEventListener('ui-input', (event) => {
  state.patient = event.detail.value;
  pager.reset();
  paint();
});

/* Clear empties the dates and the patient box too — they are this screen's
   own fields inside the panel, and the panel only unticks what it drew. */
filterEl.addEventListener('ui-filter-clear', () => {
  Object.assign(state, {
    from: '', to: '', category: [], event: [], user: '', patient: '', outcome: [],
  });
  ['fFrom', 'fTo', 'fPatient'].forEach((id) => {
    el(id).setAttribute('value', '');
    const input = el(id).querySelector('input');
    if (input) input.value = '';
  });
  paintEventOptions();
  pager.reset();
  paint();
});

/* --- Painting ---------------------------------------------------------------- */

function paint() {
  const rows = filtered();
  const { start, end } = pager.render(rows.length);

  rowsHost.innerHTML = rows.slice(start, end).map(rowMarkup).join('');
  emptyNote.hidden = rows.length > 0;
}

function badge(map, key) {
  const item = map[key];
  return item ? `<ui-badge status="${item.tone}" size="sm">${esc(item.label)}</ui-badge>` : '—';
}

function rowMarkup(entry) {
  const patient = entry.patient
    ? `${esc(entry.patient.name)}<br><span class="aud__mrn">MRN ${esc(entry.patient.mrn)}</span>`
    : '<span class="aud__muted">—</span>';

  return `<tr data-testid="aud--row" data-entry="${esc(entry.id)}">
    <td class="aud__stamp">${esc(formatStamp(entry.at))}</td>
    <td>${esc(entry.actor)}<br><span class="aud__muted">${esc(entry.username)}</span></td>
    <td>${esc(entry.role)}</td>
    <td>${esc(EVENT_INDEX[entry.event]?.label ?? entry.event)}</td>
    <td>${badge(AUDIT_CATEGORIES, entry.category)}</td>
    <td>${patient}</td>
    <td>${esc(entry.resource)}</td>
    <td>${badge(AUDIT_OUTCOMES, entry.outcome)}</td>
    <td>${esc(entry.source)}</td>
    <td class="ui-table__cell--actions">
      <button type="button" class="ui-row-menu-btn" data-menu="${esc(entry.id)}"
        aria-haspopup="menu" aria-expanded="false"
        aria-label="Actions for ${esc(formatStamp(entry.at))}"
        data-testid="aud--row-menu">${icon('more-vertical')}</button>
    </td>
  </tr>`;
}

/* --- Row ⋮ menu ---------------------------------------------------------------
   Parented to <body> rather than the cell: the table scrolls inside itself, so
   a panel in the row would be clipped by that overflow. Same shape as Master
   and Billing — see css/components/row-menu.css. */


function sheet(id) {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement('style');
    node.id = id;
    document.head.appendChild(node);
  }
  return node;
}

/* The panel, its placement and its teardown are js/lib/row-menu.js now.
   This screen kept the name it already called. */
const openMenu = openRowMenu;

rowsHost.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-menu]');
  if (!trigger) return;
  const entry = LOG.find((e) => e.id === trigger.dataset.menu);
  if (!entry) return;

  openMenu(trigger, [
    { label: 'View details', icon: 'eye', run: (t) => openDetail(entry, t) },
    { label: 'Copy entry ID', icon: 'copy', run: () => copyId(entry) },
  ]);
});

async function copyId(entry) {
  try {
    await navigator.clipboard.writeText(entry.id);
    flash(`Entry ID ${entry.id} copied.`);
  } catch {
    // Clipboard permission is the browser's to give. Say what was not done
    // rather than pretending it was.
    flash('Copying needs clipboard permission — the entry ID is in the detail view.', 'warning');
  }
}

/* --- Detail ------------------------------------------------------------------- */

function detailRow(label, value) {
  return `<div class="aud__detail-row">
    <dt>${esc(label)}</dt><dd>${value}</dd>
  </div>`;
}

function openDetail(entry, trigger) {
  const modal = el('auditDetail');
  const event = EVENT_INDEX[entry.event];

  el('auditDetailBody').innerHTML = `
    <dl class="aud__detail-list">
      ${detailRow('Entry ID', `<code>${esc(entry.id)}</code>`)}
      ${detailRow('Timestamp', esc(new Date(entry.at).toLocaleString()))}
      ${detailRow('Event', `${esc(event?.label ?? entry.event)} ${badge(AUDIT_CATEGORIES, entry.category)}`)}
      ${detailRow('Outcome', badge(AUDIT_OUTCOMES, entry.outcome))}
      ${entry.reason ? detailRow('Reason', esc(entry.reason)) : ''}
      ${detailRow('User', `${esc(entry.actor)} <span class="aud__muted">(${esc(entry.username)})</span>`)}
      ${detailRow('Role at the time', esc(entry.role))}
      ${detailRow(
        'Patient',
        entry.patient
          ? `${esc(entry.patient.name)} <span class="aud__muted">MRN ${esc(entry.patient.mrn)}</span>`
          : '<span class="aud__muted">Not a patient-record event</span>'
      )}
      ${detailRow('Resource', esc(entry.resource))}
      ${detailRow('Source', esc(entry.source))}
      ${detailRow('IP address', esc(entry.ip))}
      ${detailRow('Session', `<code>${esc(entry.session)}</code>`)}
      ${detailRow('Device', esc(entry.device))}
    </dl>`;

  modal.open(trigger);
}

el('auditDetail')?.addEventListener('ui-click', (event) => {
  if (event.target.closest('[data-detail-close]')) el('auditDetail').close();
});

/* --- Flash ---------------------------------------------------------------------
   This screen already floated its own card in the top corner — the same idea
   as the toast, built a second time and positioned by hand. It hands the words
   to lib/toast.js now, so an export from here stacks under an export from
   anywhere else rather than printing over it. */

function flash(message, tone = 'success') {
  notify(message, tone);
}

/* --- Export ---------------------------------------------------------------------
   What is on screen, for the filters that are set — the answer to the question
   somebody just asked, not the whole log every time. The filters that produced
   it ride along in the filename, because a CSV called audit-log.csv on
   somebody's desktop is a file nobody can vouch for a month later. */

test('export').addEventListener('ui-click', () => {
  const rows = filtered();

  const header = [
    'Entry ID', 'Timestamp', 'User', 'Username', 'Role', 'Event', 'Category',
    'Patient', 'MRN', 'Resource', 'Outcome', 'Reason', 'Source', 'IP address', 'Session', 'Device',
  ];

  const lines = rows.map((entry) => [
    entry.id,
    new Date(entry.at).toISOString(),
    entry.actor,
    entry.username,
    entry.role,
    EVENT_INDEX[entry.event]?.label ?? entry.event,
    AUDIT_CATEGORIES[entry.category]?.label ?? entry.category,
    entry.patient?.name ?? '',
    entry.patient?.mrn ?? '',
    entry.resource,
    AUDIT_OUTCOMES[entry.outcome]?.label ?? entry.outcome,
    entry.reason,
    entry.source,
    entry.ip,
    entry.session,
    entry.device,
  ]);

  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  recordExport(rows.length);
  flash(`Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}.`);
});

/**
 * The export writes an entry about itself.
 *
 * Taking a copy of the audit log out of the system is precisely the kind of
 * act the log exists to record. It appears at the top of the table
 * immediately, which is also the clearest possible demonstration that this
 * screen is reading a live record rather than a fixed list.
 */
function recordExport(count) {
  LOG.unshift({
    id: `aud-exp-${Date.now().toString(36)}`,
    at: Date.now(),
    event: 'audit-log-exported',
    category: 'export',
    actorId: VIEWER.id,
    username: VIEWER.username,
    actor: VIEWER.name,
    role: VIEWER.role,
    patient: null,
    resource: `Audit log (CSV) · ${count} ${count === 1 ? 'entry' : 'entries'}`,
    outcome: 'success',
    reason: '',
    ip: '10.4.1.9',
    session: 'ses-current',
    device: 'This session',
    source: 'MediNova Web',
  });
  pager.reset();
  paint();
}

paint();
