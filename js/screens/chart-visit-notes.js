/**
 * VISIT NOTES — this patient's visits and the note each one owes.
 *
 * READ FROM THE BOOKINGS, NOT FROM A LIST OF ITS OWN
 * The rows used to be a demo list kept for this section alone, with nothing
 * behind them: no booking to open, no note to sign, and a "View Encounter"
 * action that could only say it wasn't built. They are now the patient's own
 * bookings from the one copy of the schedule (data/appointment-store.js), with
 * each note's state from data/visit-notes.js — the same two sources the
 * Scheduler's Encounters worklist reads. So this section and that worklist are
 * two views of the same notes: sign one from either and both read Signed.
 *
 * WHERE A ROW GOES
 * Exactly where the worklist sends it, so a note is opened the same way from
 * the chart as from the schedule — all from the row's ⋮ menu:
 *
 *   Unsigned  Open Encounter → the working surface (encounter.html), where the
 *             note is written; Sign Note → the summary, which carries Sign &
 *             Lock.
 *   Co-Sign   Review & Sign → the summary, read before the name goes on.
 *   Signed    View Note → the summary, read-only, with Download.
 *
 * Every one of them carries `return=` back to this section (js/lib/return-to.js),
 * so Cancel, Save and the back arrow on the far side land the clinician on the
 * chart they came from rather than on a worklist they never opened.
 *
 * Uses <ui-data-table>, the same component every other worklist in this app
 * uses. Appointment, Note and Bill Status render as <ui-badge> pills, matching
 * how every other status column in this chart reads.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { withReturn } from '../lib/return-to.js';
import { loadAppointments } from '../../data/appointment-store.js';
import { TODAY, providerById, typeById, procedureById } from '../../data/schedule.js';
import { NOTE_STATES, hasVisitNote, noteFor } from '../../data/visit-notes.js';
import { VISIT_BILL_STATUS } from '../../data/chart-visit-notes.js';

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

const APPT_STATUS_TONE = {
  Completed: 'success',
  'No Show': 'critical',
  'Checked In': 'info',
  Triage: 'info',
  'Check Out': 'success',
};
const BILL_STATUS_TONE = { Paid: 'success', Pending: 'warning', Overdue: 'critical', Cancelled: 'neutral' };
/* Unsigned is the warning tone, not the critical one: a note awaiting a
   signature is work outstanding, not something gone wrong, and painting it the
   colour of a no-show would put the two on the same footing. Co-Sign takes the
   tone the Encounters worklist gives it. */
const NOTE_STATUS_TONE = { Signed: 'success', Unsigned: 'warning', 'Co-Sign': 'info' };

/** Bookings that are the clinic's to document, whatever their date. */
const IN_THE_BUILDING = ['Checked In', 'Triage', 'Check Out'];

/*
 * THE VIEWS — All, Signed, Unsigned.
 *
 * Signed and unsigned notes are two different jobs. A clinician opens this
 * section either to read what was decided at a visit, which wants the signed
 * record, or to clear what they still owe, which wants the unsigned pile and
 * nothing else. A status column alone answers neither quickly once the list
 * runs past a screen, so the status is also the switch on the module head,
 * each view carrying its own count — the count on Unsigned is the number a
 * provider is actually looking for when they open the chart.
 *
 * A note waiting on a co-signature is still owed, so it is Unsigned here, the
 * same as on the Encounters worklist. A no-show has no note at all, so it
 * belongs to All and to neither of the other two.
 */
const VIEWS = [
  { value: 'all', label: 'All', admits: () => true },
  { value: 'signed', label: 'Signed', admits: (row) => row.signed === true },
  { value: 'unsigned', label: 'Unsigned', admits: (row) => row.signed === false },
];

/* ===================== Rows ===================== */

/** '2026-08-03' → '03-08-2026', the chart's own date format. */
const chartDate = (iso) => iso.split('-').reverse().join('-');

/** '13:05' → '01:05 PM'. */
function chartTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * This patient's visits, newest first: every booking that owes a note, plus
 * the no-shows — a visit that did not happen is still part of the history a
 * reader scans, and it is the reason an expected note is missing.
 *
 * Read fresh on every paint: a note signed in another tab, or on the far side
 * of a navigation, has to show here the moment the section is drawn again.
 */
function visitsFor(mrn) {
  return loadAppointments()
    .filter((appt) => appt.mrn === mrn)
    .filter(
      (appt) => hasVisitNote(appt, TODAY) || (appt.status === 'No Show' && appt.date < TODAY)
    )
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
    .map((appt) => {
      const noShow = appt.status === 'No Show';
      const state = noShow ? null : noteFor(appt).state;
      const spec = state ? NOTE_STATES[state] : null;
      const provider = providerById(appt.providerId);
      return {
        id: appt.id,
        appt,
        date: chartDate(appt.date),
        time: chartTime(appt.start),
        provider: provider ? `Dr. ${provider.name}` : '—',
        type: appt.procedureId
          ? procedureById(appt.procedureId)?.title ?? 'Procedure'
          : typeById(appt.typeId)?.title ?? '—',
        reason: appt.reason,
        appointmentStatus: noShow
          ? 'No Show'
          : IN_THE_BUILDING.includes(appt.status)
            ? appt.status
            : 'Completed',
        state,
        noteStatus: spec?.label ?? null,
        signed: spec ? spec.signed : null,
        billStatus: VISIT_BILL_STATUS[appt.id] ?? null,
      };
    });
}

/* ===================== Where a row goes ===================== */

/** Back to this section of this chart, after whatever the row opens. */
const backHere = (mrn) => `patient-chart.html?mrn=${encodeURIComponent(mrn)}#visit-notes`;

const encounterUrl = (row, mrn) =>
  withReturn(`encounter.html?appt=${encodeURIComponent(row.id)}`, backHere(mrn));

const summaryUrl = (row, mrn) =>
  withReturn(`encounter-summary.html?appt=${encodeURIComponent(row.id)}`, backHere(mrn));

/** Everything the ⋮ menu offers for a row, in the order it offers it. */
function menuItems(row, mrn) {
  const go = (url) => () => {
    window.location.href = url;
  };
  if (row.state === 'unsigned') {
    return [
      { label: 'Open Encounter', icon: 'stethoscope', run: go(encounterUrl(row, mrn)) },
      { label: 'Sign Note', icon: 'pencil', run: go(summaryUrl(row, mrn)) },
      { label: 'View in Schedule', icon: 'calendar', run: go('scheduler.html?tab=visit-notes') },
    ];
  }
  if (row.state === 'co-sign') {
    return [
      { label: 'Review & Sign', icon: 'eye', run: go(summaryUrl(row, mrn)) },
      { label: 'View in Schedule', icon: 'calendar', run: go('scheduler.html?tab=visit-notes') },
    ];
  }
  if (row.state === 'signed') {
    return [
      { label: 'View Note', icon: 'document', run: go(summaryUrl(row, mrn)) },
      { label: 'View in Schedule', icon: 'calendar', run: go('scheduler.html?tab=visit-notes') },
    ];
  }
  // A no-show: no note, so the way on is to book the visit again.
  return [{ label: 'Rebook in Schedule', icon: 'calendar', run: go('scheduler.html') }];
}

/**
 * Only the ⋮ menu. Every row used to lead with a labelled button — Open
 * Encounter, Review & Sign, View Note — beside the menu; it repeated the
 * menu's first item on every row and took a column of width to do it. One
 * control per row, the same ⋮ every other chart table carries.
 */
function rowActions(row) {
  return `<button type="button" class="ui-row-menu-btn" data-vn-menu="${esc(row.id)}"
      aria-haspopup="menu" aria-expanded="false" aria-label="Visit actions"
      data-testid="chart--vn-menu-${esc(row.id)}">
      ${icon('more-vertical')}
    </button>`;
}

const COLUMNS = [
  { key: 'no', label: 'No.' },
  { key: 'visit', label: 'Visit Date & Time', render: (row) => `${esc(row.date)}, ${esc(row.time)}` },
  { key: 'provider', label: 'Provider' },
  { key: 'type', label: 'Type', truncate: true },
  { key: 'reason', label: 'Reason', wrap: true },
  {
    key: 'appointmentStatus',
    label: 'Appointment Status',
    render: (row) =>
      `<ui-badge status="${APPT_STATUS_TONE[row.appointmentStatus] || 'neutral'}" size="sm"
        >${esc(row.appointmentStatus)}</ui-badge
      >`,
  },
  {
    key: 'noteStatus',
    label: 'Note Status',
    render: (row) =>
      row.noteStatus
        ? `<ui-badge status="${NOTE_STATUS_TONE[row.noteStatus] || 'neutral'}" size="sm"
            data-testid="chart--vn-note-status">${esc(row.noteStatus)}</ui-badge>`
        : '—',
  },
  {
    key: 'billStatus',
    label: 'Bill Status',
    render: (row) =>
      row.billStatus
        ? `<ui-badge status="${BILL_STATUS_TONE[row.billStatus] || 'neutral'}" size="sm"
            >${esc(row.billStatus)}</ui-badge
          >`
        : '—',
  },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: rowActions,
  },
];

const viewCount = (mrn, view) => visitsFor(mrn).filter(view.admits).length;

registerModule('visit-notes', {
  /* No visible "Visit Notes" heading: the sidebar row lit beside it already
     says it, and the All / Signed / Unsigned strip is what the eye goes to.
     hideTitle keeps the h2 in the document for screen readers and the
     outline, the same arrangement Appointments uses. */
  hideTitle: true,

  /* The switch sits on the module head, in the slot the shell keeps for a
     module's own views — the same place Appointments puts Upcoming / Past. */
  tabs: (ctx) => `<ui-tabs primary selected="all" data-testid="chart--vn-tabs">
      ${VIEWS.map(
        (view) =>
          `<ui-tab value="${view.value}" label="${view.label} (${viewCount(ctx.patient.mrn, view)})"></ui-tab>`
      ).join('')}
    </ui-tabs>`,

  render(host, ctx) {
    const mrn = ctx.patient.mrn;
    const state = { view: 'all' };
    const head = host.parentElement;
    let data = [];

    function paint() {
      data = visitsFor(mrn);
      const view = VIEWS.find((v) => v.value === state.view) ?? VIEWS[0];
      const rows = data.filter(view.admits);

      host.innerHTML = `<ui-data-table
        empty-text="${
          state.view === 'unsigned'
            ? 'Nothing waiting for a signature.'
            : state.view === 'signed'
              ? 'No signed notes on this record yet.'
              : 'No visits on file.'
        }"
        data-testid="chart--visit-notes-table"
      ></ui-data-table>`;

      /* The visit number is the row's place in the whole history, oldest
         first, not in the filtered view: "visit 003" should not become "visit
         001" because the Unsigned switch is on. */
      const table = host.querySelector('[data-testid="chart--visit-notes-table"]');
      table.columns = COLUMNS;
      table.rows = rows.map((row) => ({
        ...row,
        no: String(data.length - data.indexOf(row)).padStart(3, '0'),
      }));
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    /* The strip lives in the module head, a sibling of this host, so its
       change event is heard there. */
    function onHeadChange(event) {
      const tabs = event.target.closest?.('[data-testid="chart--vn-tabs"]');
      if (!tabs || !VIEWS.some((v) => v.value === event.detail?.value)) return;
      state.view = event.detail.value;
      paint();
    }

    const rowById = (id) => data.find((row) => row.id === id);

    /* The ⋮ menu: everything else the row can do — see menuItems(). */
    function onClick(event) {
      const trigger = event.target.closest('[data-vn-menu]');
      if (!trigger) return;
      const row = rowById(trigger.dataset.vnMenu);
      if (row) openRowMenu(trigger, menuItems(row, mrn));
    }

    host.addEventListener('click', onClick);
    head?.addEventListener('ui-change', onHeadChange);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      head?.removeEventListener('ui-change', onHeadChange);
      closeRowMenu();
    };
  },
});
