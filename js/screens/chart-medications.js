/**
 * MEDICATION — this patient's whole drug history, on three tabs.
 *
 *   Active            what they are on right now, from wherever it came
 *   Past              what they have been on and are not on now, and why it
 *                     stopped — Completed, Discontinued, or merely Stopped
 *                     for something the patient reported and no longer takes
 *   During Procedure  what they were GIVEN while they were under, read off
 *                     the anaesthesia record
 *
 * WHY ALL THREE ARE HERE AND NOT IN PRESCRIPTIONS
 * Prescriptions is now the space the e-prescribing integration
 * renders into — a vendor UI that will know about the scripts this practice
 * sends and nothing else. The chart's reading of a patient's medication therefore has
 * to live somewhere that is not inside somebody else's iframe, and this is
 * it. Active and Past used to be tabs over there; they moved here, where they
 * sit beside the drugs another practice started and the drugs pushed under
 * sedation, which the prescribing vendor has never heard of and never will.
 *
 * NOTHING IS WRITTEN HERE. A script is written in the vendor's window; the reconciled
 * list is confirmed on Profile · Clinical. Both already had somewhere to be
 * entered, and a third door onto them is how a med list ends up disagreeing
 * with itself. This page is the read.
 *
 * WHY DURING PROCEDURE STAYS ITS OWN TAB rather than being folded into Past
 * now that a Past tab exists: a drug pushed once under sedation was never a
 * course of treatment that ended, so "when did we stop it" is not a question
 * about it. It has a time, a route and a case instead of a frequency, a
 * prescriber and an end date — a different record with different columns, not
 * an older row of the same one. The tab is omitted for anyone who has never
 * had a procedure rather than shown empty.
 *
 * There is no Source column. Provenance has not vanished with it:
 * a drug this practice dispensed carries a quantity, a lot, an end date and a
 * prescriber, and one the patient merely reports carries none of them. The
 * blanks say which is which. It is a quieter signal than a badge, and worth
 * knowing that it is quieter — the reported half of a list is the half that
 * still has to be confirmed with the patient rather than looked up.
 *
 * Data comes from data/chart-medications.js, which composes the existing
 * sources rather than seeding a third, and reads the drug catalogue and its
 * lots from the practice inventory.
 */
import { registerModule } from './chart-workspace.js';
import {
  activeMedicationsFor,
  pastMedicationsFor,
  administeredMedicationsFor,
} from '../../data/chart-medications.js';

/* ============================================================================
   SMALL HELPERS — kept local, the same way every other chart module keeps its
   own escape/date pair rather than reaching for a shared one.
   ========================================================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23-08-2020" → "23 Aug 2020". Numeric dates get read the wrong way round. */
function formatDate(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  if (!d || !m || !y) return '—';
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** The anaesthesia record dates in ISO; this list reads DD-MM-YYYY. */
function fromIso(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}-${m}-${y}` : '';
}

/* ============================================================================
   COLUMNS
   ========================================================================= */

/** The drug, and underneath it what it is for. How it is taken has columns of
 *  its own now, so it is not repeated here. */
function medicationCell(row) {
  return `<span class="ord__med">
    <strong class="ord__med-name">${esc(row.name)}</strong>
    ${
      row.diagnosis
        ? `<span class="ord__med-meta ord__med-meta--muted">${esc(row.diagnosis)}</span>`
        : ''
    }
  </span>`;
}

const dash = (value) => (value == null || value === '' ? '—' : esc(value));

/**
 * The list reads back what Add Medication asks for, column for column, so the
 * form and the table describe a medication the same way.
 *
 * Half of these are blank on a row nobody here dispensed — a drug the patient
 * reported has a frequency and a start date and nothing else, and an em dash
 * says that plainly rather than the row implying a quantity nobody counted.
 */
const MEDICATION_COLUMNS = [
  { key: 'name', label: 'Medication', wrap: true, render: medicationCell },
  /* Left, not right-aligned. A dispense count is read off its own row against
     the drug beside it, never compared down the column the way money is — and
     right-aligning it put the em dash of an empty cell in the numeric face,
     where it renders visibly shorter than the dashes in every other column. */
  { key: 'quantity', label: 'Quantity', render: (row) => dash(row.quantity) },
  { key: 'dosageUnit', label: 'Dosage Unit', render: (row) => dash(row.dosageUnit) },
  { key: 'frequency', label: 'Frequency', render: (row) => dash(row.frequency) },
  { key: 'lot', label: 'Lot', render: (row) => dash(row.lot) },
  { key: 'startDate', label: 'Start Date', render: (row) => formatDate(row.startDate) },
  { key: 'endDate', label: 'End Date', render: (row) => (row.endDate ? formatDate(row.endDate) : '—') },
  { key: 'prescriber', label: 'Prescriber', render: (row) => dash(row.prescriber) },
];

/**
 * Past medication: the active columns, plus the one fact only a stopped drug
 * has — why it stopped.
 *
 * Discontinued is the only status that gets colour. Completed is a course
 * that ran its length, which is the ordinary end of a prescription and not
 * news; Discontinued is somebody deciding to stop a drug early, which is the
 * row a reader scanning a past list is usually looking for. Stopped is the
 * reported half — a drug the patient says they no longer take, with nobody
 * here having decided anything about it — and it stays grey for exactly that
 * reason: it is a report, not a clinical decision.
 */
const PAST_STATUS_TONE = {
  Completed: 'neutral',
  Discontinued: 'critical',
  Stopped: 'neutral',
};

/* Lot is dropped rather than carried over. A lot number identifies a box on
   this practice's shelf, and nothing in the past list can have one: a stopped
   script was filled at a pharmacy, and a drug the patient reported and no
   longer takes was never ours to dispense. The column was a straight run of em
   dashes, and dropping it keeps Past the same width as Active with Status
   added — nine columns pushed the badge off the edge of the panel. */
const PAST_MEDICATION_COLUMNS = [
  ...MEDICATION_COLUMNS.filter((column) => column.key !== 'lot'),
  {
    key: 'status',
    label: 'Status',
    render: (row) => `<ui-badge status="${PAST_STATUS_TONE[row.status] || 'neutral'}" size="sm"
      >${esc(row.status)}</ui-badge
    >`,
  },
];

/**
 * The procedure record's own columns — not the list's.
 *
 * A drug given under sedation has no frequency, no prescriber and no end date;
 * it has a time, a route, and the case it was given in. Forcing it into the
 * eight columns above would have printed six em dashes a row and lost the two
 * facts that matter. Different record, different shape.
 *
 * The reversal badge is the one piece of colour: flumazenil in a list means
 * something went wrong enough to reverse, and it is the row a reader is
 * scanning for. Kept identical to the encounter's own sedation table so the
 * same drug does not change appearance between the two screens.
 */
const ADMINISTERED_COLUMNS = [
  {
    key: 'name',
    label: 'Medication',
    wrap: true,
    render: (row) => `<span class="ord__med">
      <strong class="ord__med-name">${esc(row.name)}</strong>
      <span class="ord__med-meta ord__med-meta--muted">${esc(row.procedure)}</span>
    </span>`,
  },
  { key: 'dose', label: 'Dose', render: (row) => dash(row.dose) },
  { key: 'route', label: 'Route', render: (row) => dash(row.route) },
  {
    key: 'category',
    label: 'Type',
    render: (row) =>
      `<ui-badge status="${row.category === 'reversal' ? 'warning' : 'neutral'}">${esc(
        row.category
      )}</ui-badge>`,
  },
  /* Date and time in one cell, in that order. They are one fact — when it was
     given — and 08:04 on its own is unreadable a year later. */
  {
    key: 'date',
    label: 'Given',
    render: (row) => `${formatDate(fromIso(row.date))} · ${esc(row.time)}`,
  },
  { key: 'location', label: 'Location', render: (row) => dash(row.location) },
  { key: 'by', label: 'Administered By', render: (row) => dash(row.by) },
];

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('medications', {
  /* The strip below already reads "Medication", and the sidebar row lit to
     the left says Medication too; a bare "Medication" heading between them
     was a third copy of the same word for the eye to step over on the way to
     the switch. hideTitle takes it off the screen without taking it out of
     the document — the h2 is still there for a screen reader and for the
     outline, and because .u-sr-only is absolutely positioned it is not a flex
     item, so the strip starts at the panel's own left edge rather than one
     gap in from it. Same arrangement as Appointments, Prescriptions, Profile
     and Orders.

     Asked per patient, not declared once, because the strip it defers to is
     itself conditional: a chart with no procedure record has no switch, and
     hiding the title there would leave a head carrying nothing but a search
     box over a table nobody had named. */
  hideTitle: true,

  /* The Active / Past / During Procedure switch sits in the module head,
     between the heading and the actions — the slot the shell reserves for
     exactly this, so a module's own view switch is at the same height in
     every module that has one.

     Active and Past are always both there, for every patient, even when one
     of them is empty: they are the two halves of one question, and a strip
     that appears and disappears with the data would mean a reader who found
     no Past tab could not tell "nothing has stopped" from "this chart does
     not keep that". The empty table says the first, plainly.

     During Procedure is different — it is a SECOND RECORD rather than the
     other half of this one, and a patient who has never had a procedure does
     not have it at all. That tab is drawn only when there is something behind
     it. */
  tabs: (ctx) =>
    `<ui-tabs primary selected="med-list" data-testid="chart--med-tabs">
      <ui-tab value="med-list" label="Active"></ui-tab>
      <ui-tab value="med-past" label="Past"></ui-tab>
      ${
        administeredMedicationsFor(ctx.patient.mrn).length
          ? '<ui-tab value="med-given" label="During Procedure"></ui-tab>'
          : ''
      }
    </ui-tabs>`,

  /* The search box follows the strip up onto the heading row. Nothing is
     entered on this screen — a script is written in the vendor's window
     under Prescriptions, and the reconciled list is confirmed on Profile ·
     Clinical — so the one control this module owns is the one that narrows
     what is on the page.

     Rendered once, when the module mounts: the box is no longer torn down and
     rebuilt under the cursor between keystrokes. */
  actions: () =>
    `<ui-input class="ord__search" size="sm" icon="search" label="Search medication"
      label-hidden placeholder="Search" data-testid="chart--med-list-search"></ui-input>`,

  render(host, ctx) {
    const medications = activeMedicationsFor(ctx.patient.mrn);
    const past = pastMedicationsFor(ctx.patient.mrn);
    const administered = administeredMedicationsFor(ctx.patient.mrn);

    /* Active and Past are always both on the strip; During Procedure only
       exists for a patient who has actually had one. See the `tabs` hook. */
    const hasAdministered = administered.length > 0;

    const state = { tab: 'med-list', search: '' };

    /* The strip and the search box are the shell's markup, rendered into the
       head — a sibling of this host, not a descendant. */
    const head = host.parentElement;

    /* --- Searching ----------------------------------------------------------
       One box over the whole page, not over the tab in front of you. A reader
       typing "omeprazole" is asking the chart whether this person has ever
       been on it, and the answer "not currently" is worse than useless if the
       drug is sitting one tab away under Past. The tables cannot show each
       other's rows, so the empty state names the tab holding the matches —
       see emptyText below.

       Each list searches what its own rows actually show: the A–Z lists match
       on the lot, which is the one thing you arrive at a med list holding in
       your hand, and the sedation record matches on the case and the person
       who gave the drug, which is how that record is looked up.
       ---------------------------------------------------------------------- */

    function filterList(list) {
      if (!state.search) return list;
      const q = state.search.toLowerCase();
      return list.filter(
        (med) =>
          med.name.toLowerCase().includes(q) ||
          (med.frequency || '').toLowerCase().includes(q) ||
          (med.diagnosis || '').toLowerCase().includes(q) ||
          (med.lot || '').toLowerCase().includes(q) ||
          (med.prescriber || '').toLowerCase().includes(q) ||
          (med.status || '').toLowerCase().includes(q)
      );
    }

    function visibleAdministered() {
      if (!state.search) return administered;
      const q = state.search.toLowerCase();
      return administered.filter(
        (med) =>
          med.name.toLowerCase().includes(q) ||
          med.procedure.toLowerCase().includes(q) ||
          med.category.toLowerCase().includes(q) ||
          (med.by || '').toLowerCase().includes(q)
      );
    }

    /* --- Empty text ---------------------------------------------------------
       A tab hides the other records, which an empty table on its own would
       quietly turn into "not on this chart". When a search has emptied the
       tab in front of the reader and filled another, the empty state names
       the tabs holding the matches — the one thing they cannot see for
       themselves — and says how many are in each, so it is worth the press.
       ---------------------------------------------------------------------- */

    function emptyText(others, blank) {
      if (!state.search) return blank;
      const elsewhere = others.filter((other) => other.count > 0);
      if (!elsewhere.length) return 'Nothing here matches that search.';
      const where = elsewhere
        .map(
          (other) =>
            `${other.count} ${other.count === 1 ? 'match' : 'matches'} under ${other.label}`
        )
        .join(', ');
      return `Nothing here matches that search — ${where}.`;
    }

    /* --- Paint --------------------------------------------------------------- */

    function paint() {
      const activeRows = filterList(medications);
      const pastRows = filterList(past);
      const givenRows = visibleAdministered();

      /* Nothing is added from this screen. A script is written in the
         e-prescribing window under Prescriptions and the reconciled list is
         confirmed on Profile · Clinical, which is where both already were; a
         third door onto them is how a med list ends up disagreeing with
         itself. This is the read.

         The strip and the search box are the shell's, in the module head
         above this panel — everything below is only the records themselves. */
      host.innerHTML = `<div class="ord__panel" id="panel-med-list"${panelAttrs('med-list')}
          data-testid="chart--med-list">
          <ui-data-table
            empty-text="${esc(
              emptyText(
                [
                  { label: 'Past', count: pastRows.length },
                  { label: 'During Procedure', count: givenRows.length },
                ],
                'No active medications recorded.'
              )
            )}"
            data-testid="chart--med-list-table"
          ></ui-data-table>
        </div>

        <div class="ord__panel" id="panel-med-past"${panelAttrs('med-past')}
          data-testid="chart--med-past">
          <ui-data-table
            empty-text="${esc(
              emptyText(
                [
                  { label: 'Active', count: activeRows.length },
                  { label: 'During Procedure', count: givenRows.length },
                ],
                'No past medications recorded.'
              )
            )}"
            data-testid="chart--med-past-table"
          ></ui-data-table>
        </div>

        ${administeredPanel(activeRows.length, pastRows.length)}`;

      /* Only the tab on screen is given its rows — a hidden table holding a
         stale copy of a filtered list is a second answer to the same question
         waiting to be believed. */
      fillTable('chart--med-list-table', MEDICATION_COLUMNS, state.tab === 'med-list' ? activeRows : []);
      fillTable('chart--med-past-table', PAST_MEDICATION_COLUMNS, state.tab === 'med-past' ? pastRows : []);
      fillTable('chart--med-given-table', ADMINISTERED_COLUMNS, state.tab === 'med-given' ? givenRows : []);
    }

    function fillTable(testid, columns, rows) {
      const table = host.querySelector(`[data-testid="${testid}"]`);
      if (!table) return;
      table.columns = columns;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    /* --- The three records --------------------------------------------------
       Tabs, not three tables stacked down one page. They answer three
       different questions — what is this person on, what have they been on,
       and what were they given while they were under — and the last two are
       read at a different moment from the first, the sedation record usually
       not at all. Stacking them made a reader scroll past a whole procedure
       to reach the end of the med list, and put the three close enough that
       the eye could read across from one to another. A tab is the plainest
       way to say "same page, other record".

       During Procedure stays apart for the reason it always did: a drug
       pushed once under sedation finished when the case did, and sorting
       propofol into the A–Z between Omeprazole and Sertraline would say the
       patient is taking it — the one thing a medication list must never say
       by accident. */

    function panelAttrs(value) {
      return ` role="tabpanel" aria-labelledby="tab-${value}"${
        state.tab === value ? '' : ' hidden'
      }`;
    }

    function administeredPanel(activeCount, pastCount) {
      if (!hasAdministered) return '';

      return `<section class="ord__panel" id="panel-med-given"${panelAttrs(
        'med-given'
      )} data-testid="chart--med-given">
        <ui-data-table
          empty-text="${esc(
            emptyText(
              [
                { label: 'Active', count: activeCount },
                { label: 'Past', count: pastCount },
              ],
              'No procedure medication recorded.'
            )
          )}"
          data-testid="chart--med-given-table"
        ></ui-data-table>
      </section>`;
    }

    /* --- Wiring --------------------------------------------------------------- */

    function onChange(event) {
      if (!event.target.closest('[data-testid="chart--med-tabs"]')) return;
      state.tab = event.detail.value;
      paint();
    }

    // <ui-input>'s search field fires ui-input as the user types and ui-change
    // only on blur — the filter has to follow every keystroke.
    function onSearch(event) {
      if (!event.target.closest('[data-testid="chart--med-list-search"]')) return;
      state.search = event.detail.value;
      paint();
    }

    /* Both controls are the shell's markup in the head above this host, so
       their events are listened for there — and taken off again on teardown,
       because the head outlives the module that filled it. */
    head?.addEventListener('ui-change', onChange);
    head?.addEventListener('ui-input', onSearch);
    paint();

    return () => {
      head?.removeEventListener('ui-change', onChange);
      head?.removeEventListener('ui-input', onSearch);
    };
  },
});
