/**
 * Complications Tracker — three figures over one log.
 *
 * WHAT THE SCREEN IS
 *
 * One row per complication, and above it the only three numbers anybody asks
 * an endoscopy unit for: how many, how often, and which one. The rate is the
 * reason the screen exists — a list of bad outcomes with no denominator says
 * nothing, because five perforations in a year is a scandal in a unit that
 * runs fifty cases and unremarkable in one that runs five thousand.
 *
 * THE FIGURES MOVE WITH THE FILTERS, INCLUDING THE DENOMINATOR
 *
 * Narrow to one physician and one month and the rate becomes THAT physician's
 * rate over THAT month: the numerator is her complications and the denominator
 * is the cases she ran in the window. A summary pinned to the practice total
 * while the table underneath showed a slice would be answering a question
 * nobody asked, and it is the question this screen is opened to answer.
 *
 * Which filters narrow which half is not arbitrary — see filteredProcedures().
 * The ones that describe WHICH CASES (dates, physician, patient) narrow both;
 * complication type narrows only the numerator, because "our perforation rate"
 * is perforations over all procedures, not perforations over perforations.
 *
 * Nothing here persists. Records live in memory for the session, like every
 * other write in the prototype.
 */
import {
  COMPLICATIONS,
  COMPLETED_PROCEDURES,
  COMPLICATION_TYPES,
  SEVERITIES,
  PHYSICIANS,
  procedureById,
  procedureLabel,
  severityTone,
  complicationRate,
  mostCommonType,
  severityCounts,
} from '../../data/complications.js';
import { createPager } from '../lib/pagination.js';
import { admits, chosen } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * "4 Aug 2026" — unambiguous, unlike 08/04/2026, which is two dates depending
 * on which side of the Atlantic reads it. The house format everywhere in this
 * prototype, and this table is the one people print and post.
 */
function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const el = (id) => document.getElementById(id);

/**
 * Push a value into a field component, control and all.
 *
 * `setAttribute('value', …)` alone is not enough to REFILL a form. The
 * components only write the attribute back on `change`, so a box that was
 * typed into and then abandoned still holds the typed text while its attribute
 * holds the last committed one — and setting the attribute to a value it
 * already has is a no-op, so the stale text survives the next open. Both
 * drawers are filled from state every time they open, which is exactly the
 * case that breaks. The control is queried AFTER the attribute is set, because
 * <ui-select> and <ui-textarea> rebuild themselves on it.
 */
function setField(id, value) {
  const field = el(id);
  const next = value ?? '';
  field.setAttribute('value', next);
  const control = field.querySelector('input, select, textarea');
  if (control && control.value !== next) control.value = next;
}

/* ===================== State ===================== */

/* A working copy. Recording, editing and deleting all change it, and the seed
   in data/complications.js must stay the seed for a reload. */
let rows = COMPLICATIONS.map((row) => ({ ...row }));

/* New ids continue past the seeded ones rather than restarting at 1 — two
   records sharing an id is how an edit lands on the wrong row. */
let nextId = rows.length + 1;

const filterDefaults = () => ({ patient: '', from: '', to: '', physician: [], type: [] });

const state = {
  filters: filterDefaults(),
  /* Which record the drawer is open against. Empty means "recording a new
     one" — the same drawer does both, because the fields are identical and a
     second one is a second place for them to drift. */
  editingId: '',
  /* What the picker inside the drawer has chosen, held here rather than read
     off the input: the input shows a LABEL and the record needs an id. */
  pickedProcedureId: '',
  deletingId: '',
};

let pager;

/* A card in the bottom-left corner was this screen's own version of the toast,
   down to the fade and the reduced-motion guard. The words go to lib/toast.js
   now — same report, one corner, one implementation. */
function flash(message, tone = 'success') {
  notify(message, tone);
}

/* ===================== Filtering =====================
   Two filtered sets, not one, and they are the numerator and the denominator.
   ========================================================================= */

/* Whether the figures above the table are describing the whole log or a slice
   of it. <ui-filter> carries the count on its own badge; this only has to know
   whether anything at all is narrowing. */
const filtersActive = () =>
  Boolean(state.filters.patient || state.filters.from || state.filters.to) ||
  chosen(state.filters.physician).length > 0 ||
  chosen(state.filters.type).length > 0;

/** A complication, joined to the case it happened during. */
const withProcedure = (row) => ({ ...row, procedure: procedureById(row.procedureId) ?? null });

/**
 * The cases the rate is measured against.
 *
 * Narrowed by everything that describes WHICH CASES — the date window, the
 * endoscopist, the patient — and by nothing else. Complication type is not one
 * of those: filtering the denominator by it would make every rate 100%.
 *
 * Note which date this reads. A procedure is counted in the window if the CASE
 * ran in it; a complication is counted if the COMPLICATION was recorded in it.
 * They are different dates on purpose (see data/complications.js), and pairing
 * them any other way would let a delayed perforation land in a month whose
 * denominator never included the case that caused it.
 */
function filteredProcedures() {
  const { patient, from, to, physician } = state.filters;
  const needle = patient.trim().toLowerCase();

  return COMPLETED_PROCEDURES.filter((row) => {
    if (from && row.date < from) return false;
    if (to && row.date > to) return false;
    if (!admits(physician, row.physician)) return false;
    if (needle && !row.patient.toLowerCase().includes(needle)) return false;
    return true;
  });
}

/** The complications on the table. */
function filteredRows() {
  const { patient, from, to, physician, type } = state.filters;
  const needle = patient.trim().toLowerCase();

  return rows
    .map(withProcedure)
    .filter((row) => {
      if (from && row.date < from) return false;
      if (to && row.date > to) return false;
      /* Both take a set. A safety log is read by theme — perforation AND
         bleeding across a quarter, or the two endoscopists who share a room —
         and one answer at a time turned one question into four passes. */
      if (!admits(type, row.type)) return false;
      if (!admits(physician, row.procedure?.physician)) return false;
      if (needle && !(row.procedure?.patient ?? '').toLowerCase().includes(needle)) return false;
      return true;
    })
    /* Newest first. A safety log is read from what just happened. */
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/* ===================== The table ===================== */

/**
 * The patient, with the case's own date under the name.
 *
 * Not decoration: the Date column carries when the COMPLICATION was recorded,
 * and for a delayed one those are different days. Without this, a perforation
 * dated the 4th sitting against an ERCP run on the 3rd looks like a data
 * error rather than a next-morning CT finding.
 */
function patientCell(row) {
  if (!row.procedure) return '<span class="cx__none">—</span>';
  const sameDay = row.procedure.date === row.date;
  return `<span class="cx__stack">${esc(row.procedure.patient)}${
    sameDay ? '' : `<span class="cx__sub">Case ${longDate(row.procedure.date)}</span>`
  }</span>`;
}

const COLUMNS = [
  { key: 'date', label: 'Date', render: (row) => longDate(row.date) },
  { key: 'patient', label: 'Patient', wrap: true, render: patientCell },
  {
    key: 'procedure',
    label: 'Procedure',
    render: (row) => esc(row.procedure?.procedure ?? '—'),
  },
  {
    /* Not truncated. "Dr. Sana …" and "Dr. Amara …" are the same cell to a
       reader, and this is the column an audit is usually run down. The Notes
       column gives up the width instead — it is the one that can afford to,
       because its whole value is in the tooltip anyway. */
    key: 'physician',
    label: 'Physician',
    render: (row) => esc(row.procedure?.physician ?? '—'),
  },
  {
    key: 'type',
    label: 'Complication',
    render: (row) => `<ui-badge status="warning">${esc(row.type)}</ui-badge>`,
  },
  {
    key: 'severity',
    label: 'Severity',
    /* Optional on the form, so it is genuinely absent on some rows — and an
       ungraded complication has to look ungraded rather than mild. */
    render: (row) => (row.severity
      ? `<ui-badge status="${severityTone(row.severity)}">${esc(row.severity)}</ui-badge>`
      : '<span class="cx__none">—</span>'),
  },
  {
    key: 'notes',
    label: 'Notes',
    /* Clipped to one line with the whole note in the tooltip. A treatment
       paragraph set loose in a cell turns every row into four. */
    render: (row) => (row.notes
      ? `<span class="cx__notes" title="${esc(row.notes)}">${esc(row.notes)}</span>`
      : '<span class="cx__none">—</span>'),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (row) => `<span class="cx__row-actions">
      <button type="button" class="cx__row-btn" data-edit="${esc(row.id)}"
        aria-label="Edit this complication" data-testid="cx--edit">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
      </button>
      <button type="button" class="cx__row-btn cx__row-btn--danger" data-delete="${esc(row.id)}"
        aria-label="Delete this complication" data-testid="cx--delete">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
      </button>
    </span>`,
  },
];

/* ===================== Painting ===================== */

/** "Showing all 4 complications" / "Showing 2 of 4 complications". */
/*
 * What the filters have left, said in the pager's own suffix rather than on a
 * line of its own above the table.
 *
 * The range the pager already writes — "1-10 of 24 complications" — answers
 * "how many" for the filtered set. The one thing it cannot say is how many
 * there were BEFORE the filters, which is the number that tells a reader a
 * short list is short because they narrowed it. So that is all this adds, and
 * only while something is actually narrowed.
 */
function filteredSuffix(total) {
  return filtersActive() ? `filtered from ${total}` : '';
}

function paintStats(shown, procedures) {
  el('statTotal').textContent = String(shown.length);

  const rate = complicationRate(shown.length, procedures.length);
  el('statRate').textContent = rate == null ? '—' : `${rate.toFixed(1)}%`;
  /* Beside the figure, not under it, so it has to read as a phrase off the
     percentage: "94.4% of 54 cases". */
  el('statRateMeta').textContent = procedures.length === 1
    ? 'of 1 case'
    : `of ${procedures.length} cases`;

  const common = mostCommonType(shown);
  const commonEl = el('statCommon');
  commonEl.textContent = common ? common.type : '—';
  /* The full name in the tooltip, because the card clips it — see
     .cx__stat-value--text. */
  commonEl.title = common ? common.type : '';
}

function paint() {
  const shown = filteredRows();
  const procedures = filteredProcedures();

  paintStats(shown, procedures);

  pager.setSuffix(filteredSuffix(rows.length));
  const { start, end } = pager.render(shown.length);
  const slice = shown.slice(start, end);

  const table = el('cxTable');
  table.columns = COLUMNS;
  table.rows = slice;
  table.setAttribute('state', slice.length ? 'ready' : 'empty');

  paintReport(shown, procedures);
}

/* ===================== The printed report =====================
   Rebuilt on every paint rather than at print time: window.print() is
   synchronous and a browser will not wait for a repaint fired from inside it,
   so a report built in the handler prints one revision behind.
   ========================================================================= */

/** "17 Aug 2026, 6:22 pm" — when the sheet in somebody's hand was produced. */
function printedAt() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${longDate(iso)}, ${hours}:${minutes} ${now.getHours() < 12 ? 'am' : 'pm'}`;
}

/** What the report covers, in words — the filters as a reader would say them. */
function reportScope(procedures) {
  const { patient, from, to, physician, type } = state.filters;
  const parts = [];

  if (from && to) parts.push(`${longDate(from)} – ${longDate(to)}`);
  else if (from) parts.push(`From ${longDate(from)}`);
  else if (to) parts.push(`To ${longDate(to)}`);
  else parts.push('All dates');

  if (chosen(physician).length) parts.push(chosen(physician).join(', '));
  if (chosen(type).length) parts.push(chosen(type).join(', '));
  if (patient.trim()) parts.push(`Patient matching “${patient.trim()}”`);

  parts.push(procedures.length === 1
    ? '1 completed procedure'
    : `${procedures.length} completed procedures`);

  return parts.join(' · ');
}

function paintReport(shown, procedures) {
  el('reportMeta').textContent = `${reportScope(procedures)} · Printed: ${printedAt()}`;

  const counts = severityCounts(shown);
  el('reportTiles').innerHTML = [
    ['Total Complications', shown.length],
    ...SEVERITIES.map((s) => [s.value, counts[s.value]]),
  ]
    .map(([label, value]) => `<dl class="cx__report-tile">
      <dt>${esc(label)}</dt><dd>${value}</dd>
    </dl>`)
    .join('');

  el('reportRows').innerHTML = shown.length
    ? shown.map((row) => `<tr>
        <td>${longDate(row.date)}</td>
        <td>${esc(row.procedure?.patient ?? '—')}</td>
        <td>${esc(row.procedure?.procedure ?? '—')}</td>
        <td>${esc(row.procedure?.physician ?? '—')}</td>
        <td>${esc(row.type)}</td>
        <td>${esc(row.severity || '—')}</td>
        <td>${esc(row.notes || '—')}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="cx__report-empty">
         No complications were recorded in this period.
       </td></tr>`;
}

/* ===================== The procedure picker =====================
   A combobox over every completed case: type to narrow, arrows to move, Enter
   to take, Escape to close. See the note in the markup for why it is a search
   rather than a <select>.
   ========================================================================= */

const procedureSub = (procedure) =>
  `${longDate(procedure.date)} · ${procedure.time} · ${procedure.physician}`;

const picker = {
  /* Which option the keyboard is on. -1 is "the list is open and nothing is
     highlighted yet", which is what a fresh open looks like. */
  active: -1,
  matches: [],

  get input() { return el('procedureInput'); },
  get panel() { return el('procedureList'); },

  /**
   * Cases whose patient, procedure or endoscopist contains the query.
   *
   * All three fields, because all three are how somebody arrives here: "the
   * Okafor case", "yesterday's ERCP", "one of Mensah's". A picker that only
   * matched the patient would fail two of those three.
   */
  search(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return COMPLETED_PROCEDURES;
    return COMPLETED_PROCEDURES.filter((row) =>
      `${row.patient} ${row.procedure} ${row.physician}`.toLowerCase().includes(needle)
    );
  },

  open(query = '') {
    this.matches = this.search(query);
    this.active = -1;

    this.panel.innerHTML = this.matches.length
      ? this.matches.map((row, index) => `<li class="cx__combo-opt" role="option"
          id="cx-proc-opt-${index}" aria-selected="false" data-pick="${esc(row.id)}">
          <span class="cx__combo-opt-main">${esc(procedureLabel(row))}</span>
          <span class="cx__combo-opt-sub">${esc(procedureSub(row))}</span>
        </li>`).join('')
      : '<li class="cx__combo-empty" role="presentation">No completed procedure matches that.</li>';

    this.panel.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  },

  close() {
    this.panel.hidden = true;
    this.active = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  },

  /** Move the highlight, wrapping at both ends. */
  move(step) {
    if (this.panel.hidden) return this.open(this.input.value);
    if (!this.matches.length) return;

    const count = this.matches.length;
    this.active = (this.active + step + count) % count;

    [...this.panel.querySelectorAll('.cx__combo-opt')].forEach((option, index) => {
      const on = index === this.active;
      option.classList.toggle('is-active', on);
      option.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) option.scrollIntoView({ block: 'nearest' });
    });

    this.input.setAttribute('aria-activedescendant', `cx-proc-opt-${this.active}`);
    return undefined;
  },

  /** Commit a case. Passing '' empties the field. */
  pick(id) {
    const procedure = id ? procedureById(id) : null;
    state.pickedProcedureId = procedure ? procedure.id : '';
    this.input.value = procedure ? procedureLabel(procedure) : '';
    el('procedureClear').hidden = !procedure;
    this.close();
    if (procedure) clearProcedureError();
  },
};

function showProcedureError(message) {
  const error = el('procedureError');
  error.textContent = message;
  error.hidden = false;
  el('procedureField').querySelector('.ui-input').classList.add('ui-input--error');
}

function clearProcedureError() {
  el('procedureError').hidden = true;
  el('procedureField').querySelector('.ui-input').classList.remove('ui-input--error');
}

/* ===================== The record / edit drawer ===================== */

/**
 * Open the drawer, either empty or filled from an existing record.
 *
 * One drawer for both. The fields are identical, and a second copy is a second
 * place for the field set to drift — which is how "Severity" ends up required
 * on one of them and optional on the other.
 */
function openForm(id, trigger) {
  const existing = id ? rows.find((row) => row.id === id) : null;
  state.editingId = existing ? existing.id : '';

  const drawer = el('recordDrawer');
  drawer.setAttribute('heading', existing ? 'Edit Complication' : 'Record Complication');
  /* `text`, not .textContent — setting the tag's text wipes the <button>
     <ui-button> rendered inside itself. See the attribute's note there. */
  el('formSave').setAttribute('text', existing ? 'Save Changes' : 'Record Complication');

  picker.pick(existing?.procedureId ?? '');
  setField('typeField', existing?.type);
  setField('severityField', existing?.severity);
  setField('dateField', existing?.date);
  setField('notesField', existing?.notes);

  el('typeField').removeAttribute('error');
  clearProcedureError();
  drawer.open(trigger);
}

function saveForm() {
  const procedureId = state.pickedProcedureId;
  const type = el('typeField').value;

  /* The two starred fields, checked before anything is written. A complication
     with no case is a row the table cannot fill and the rate cannot count; one
     with no type is a row the Most Common Type card has to skip. */
  if (!procedureId) {
    showProcedureError('Choose the procedure this complication happened during.');
    el('procedureInput').focus();
    return;
  }
  if (!type) {
    el('typeField').setAttribute('error', 'Choose a complication type.');
    el('typeField').focus?.();
    return;
  }
  el('typeField').removeAttribute('error');

  const record = {
    procedureId,
    type,
    severity: el('severityField').value || '',
    /* Falls back to the day the case ran. A complication found ON the table
       has no separate date to give, and leaving it blank would drop the row
       out of every date filter — including the one the printed report runs
       on. */
    date: el('dateField').value || procedureById(procedureId).date,
    notes: el('notesField').value.trim(),
  };

  if (state.editingId) {
    const index = rows.findIndex((row) => row.id === state.editingId);
    rows[index] = { ...rows[index], ...record };
    flash('Complication updated.');
  } else {
    rows = [...rows, { id: `cx-${nextId}`, ...record }];
    nextId += 1;
    flash('Complication recorded.');
  }

  el('recordDrawer').close();
  pager.reset();
  paint();
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  pager = createPager(el('cxFoot'), {
    rowsPerPage: 10,
    noun: 'complications',
    testidPrefix: 'cx',
    onChange: paint,
  });

  /* --- The form's two dropdowns ------------------------------------------ */
  el('typeField').optionList = COMPLICATION_TYPES.map((type) => ({ value: type, label: type }));
  el('severityField').optionList = SEVERITIES.map((s) => ({ value: s.value, label: s.value }));

  /* --- The filters --------------------------------------------------------
     The drawer this used to be is gone. It was the only filter in the product
     that arrived from the side, and a screen that also opens a FORM drawer
     from that side was asking the reader to tell two different things apart by
     nothing but their heading. It is the standard panel now
     (js/components/ui-filter.js), on the standard button, in the header where
     every other list keeps it.

     Applied on Done rather than live, which is the one thing worth keeping
     from the drawer: a half-entered range would otherwise repaint the table,
     the count AND the rate against a From with no To. */
  const filterEl = el('cxFilter');
  filterEl.setGroupOptions('physician', PHYSICIANS);
  filterEl.setGroupOptions('type', COMPLICATION_TYPES);

  const readFilters = () => {
    const picked = filterEl.value;
    const next = {
      patient: el('fPatient').value || '',
      from: el('fFrom').value || '',
      to: el('fTo').value || '',
      physician: picked.physician,
      type: picked.type,
    };

    /* A range entered backwards returns nothing and reads as a bug in the data
       rather than a typo in the form, so the two ends are swapped into the
       order they were meant in. */
    if (next.from && next.to && next.from > next.to) {
      [next.from, next.to] = [next.to, next.from];
    }
    return next;
  };

  filterEl.addEventListener('ui-filter-apply', () => {
    state.filters = readFilters();
    pager.reset();
    paint();
  });

  filterEl.addEventListener('ui-filter-clear', () => {
    state.filters = filterDefaults();
    ['fPatient', 'fFrom', 'fTo'].forEach((id) => {
      setField(id, '');
      const input = el(id).querySelector('input');
      if (input) input.value = '';
    });
    pager.reset();
    paint();
  });

  /* --- The procedure picker ---------------------------------------------- */
  const input = el('procedureInput');

  input.addEventListener('input', () => {
    /* Typing over a chosen case un-chooses it. The box would otherwise show
       one thing and the record hold another, and the mismatch only surfaces
       after Save. */
    state.pickedProcedureId = '';
    el('procedureClear').hidden = true;
    picker.open(input.value);
  });

  /* Click opens the list, focus alone does not. The drawer moves focus to its
     first field on open, and a fifty-case panel unrolling over the four fields
     below it every time the drawer appears is a menu nobody asked for. */
  input.addEventListener('click', () => picker.open(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); picker.move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); picker.move(-1); }
    else if (event.key === 'Escape' && !picker.panel.hidden) {
      /* Swallowed, so Escape closes the LIST first and the drawer second — a
         single press that did both would throw away a half-filled form. */
      event.stopPropagation();
      picker.close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = picker.matches[picker.active];
      if (chosen) picker.pick(chosen.id);
    }
  });

  picker.panel.addEventListener('mousedown', (event) => {
    /* mousedown, not click: the input's blur would close the panel out from
       under the pointer before a click ever landed. */
    const option = event.target.closest('[data-pick]');
    if (!option) return;
    event.preventDefault();
    picker.pick(option.dataset.pick);
  });

  input.addEventListener('blur', () => {
    /* Deferred past the panel's own mousedown, which is the one blur that must
       not close it. */
    window.setTimeout(() => picker.close(), 120);
  });

  el('procedureClear').addEventListener('click', () => {
    picker.pick('');
    input.focus();
  });

  /* --- Recording, editing, deleting -------------------------------------- */
  el('recordBtn').addEventListener('ui-click', (event) => openForm('', event.target));
  el('formSave').addEventListener('ui-click', saveForm);
  el('formCancel').addEventListener('ui-click', () => el('recordDrawer').close());

  el('cxTable').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    if (edit) { openForm(edit.dataset.edit, edit); return; }

    const remove = event.target.closest('[data-delete]');
    if (!remove) return;

    const row = withProcedure(rows.find((r) => r.id === remove.dataset.delete));
    state.deletingId = row.id;
    el('deleteLead').innerHTML =
      `<strong>${esc(row.type)}</strong> recorded against
       <strong>${esc(procedureLabel(row.procedure) || 'this procedure')}</strong> on
       ${longDate(row.date)} will be removed from the tracker and from the rate.`;
    el('deleteModal').open(remove);
  });

  el('deleteCancel').addEventListener('ui-click', () => el('deleteModal').close());

  el('deleteConfirm').addEventListener('ui-click', () => {
    rows = rows.filter((row) => row.id !== state.deletingId);
    state.deletingId = '';
    el('deleteModal').close();
    pager.reset();
    paint();
    flash('Complication deleted.', 'warning');
  });

  el('printBtn').addEventListener('ui-click', () => window.print());

  /* The sheet is stamped with the moment it was produced, so the timestamp is
     refreshed on the way to the printer rather than left at whenever the table
     last repainted. On `beforeprint` rather than in the button's handler
     because Ctrl+P has to produce the same document the button does. */
  window.addEventListener('beforeprint', () => paintReport(filteredRows(), filteredProcedures()));

  paint();
});
