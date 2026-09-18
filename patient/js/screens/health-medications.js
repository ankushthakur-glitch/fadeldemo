/**
 * HEALTH RECORDS — medications and allergies
 *
 * Two records over one screen — Medications, split into Current and Past, and
 * Allergies. See the note in lib/meds-tabs.js for why the strip is nested
 * rather than four tabs in a row, and health-medications.html for the markup
 * and for why the screen is named for the section rather than its contents.
 *
 * WHY THIS SCREEN NO LONGER WRITES ANYTHING
 *
 * It used to add a self-reported medication, stop one, resume one, remove
 * one, and add or edit an allergy — four dialogs and six row buttons. All of
 * it is gone, and the two data modules behind it export no mutators any more.
 *
 * The argument for the controls was that a patient takes things the practice
 * never prescribed, and a list built from prescriptions can never contain
 * them. That is still true; what it does not establish is that the PORTAL is
 * where the patient should type them. A medication list is read in the one
 * situation where being wrong is expensive — by whoever is about to prescribe
 * or anaesthetise — and a row a patient typed carries the same visual weight
 * as one a prescriber wrote. A badge saying which is which helps a careful
 * reader and does nothing for a hurried one. The same argument, harder, for
 * allergies: a severity a patient can quietly move from Severe to Mild is
 * exactly the edit a chart must not accept.
 *
 * So the portal shows the record and the patient amends it by telling the
 * practice — through Messages, or at the desk. Slower, and the correct
 * channel. What is left here is reading, and one way to take it with you.
 *
 * WHAT THIS MODULE OWNS AND WHAT IT DELEGATES
 *   Owns:      the tab state, the medication table, and the download button.
 *   Delegates: the allergy table to lib/allergy-panel.js and the printed
 *              document to lib/med-print.js.
 */

import { mountShell } from '../lib/shell.js';
import { esc } from '../lib/format.js';
import { medsTabs, medViews, tabFrom, sectionOf } from '../lib/meds-tabs.js';
import { paintAllergies } from '../lib/allergy-panel.js';
import { downloadSection, SECTION_TITLES } from '../lib/med-print.js';
import { medicationsBy, medicationTags } from '../../data/health.js';

/** Which panel is on screen — 'current', 'past' or 'allergies'. */
let showing = 'current';

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell({ active: 'health-medications' })) return;

  showing = tabFrom(location.search);

  wireTabs();
  wireDownload();

  paint();
});

/* ============================================================================
   THE TABS

   Links to real addresses, intercepted so a click repaints in place instead
   of reloading the page. The interception is an optimisation, not the
   mechanism: with JavaScript broken the hrefs still work.

   One listener per STRIP, on the host element rather than on the links.
   Both hosts are emptied and refilled by every repaint but never replaced, so
   a listener bound here survives; one bound to a link would have to be
   rebound on every paint, and the paint that forgot would leave a tab that
   silently reloads the page instead of switching.
   ========================================================================= */

function wireTabs() {
  ['tabs', 'views'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');
      if (!tab) return;
      event.preventDefault();
      select(tab.dataset.tab);
    });
  });
}

/**
 * Move to one of the three panels.
 *
 * replaceState rather than pushState: flipping between the tabs four times
 * should not cost four presses of Back to leave the screen. The address still
 * changes, so a reload and a copied link both land where the person is.
 */
function select(next) {
  showing = next;

  const url = new URL(location.href);
  if (next === 'current') url.searchParams.delete('tab');
  else url.searchParams.set('tab', next);
  history.replaceState(null, '', url);

  paint();
}

/* ============================================================================
   PAINTING
   ========================================================================= */

/*
 * There is no line of prose under the tabs any more.
 *
 * It said what each panel held — "everything you are taking now, and where
 * each one is dispensed" — which is what the tab above it and the column
 * headings below it already say, in fewer words and in the place the reader
 * is looking. A caption that repeats its table pushes the first row down a
 * band for nothing.
 */

function paint() {
  medsTabs(document.getElementById('tabs'), showing);
  medViews(document.getElementById('views'), showing);

  // The button downloads the RECORD you are on and says which — see
  // wireDownload(). The name comes from med-print.js so the button and the
  // sheet it produces cannot end up calling one thing two things.
  const record = SECTION_TITLES[sectionOf(showing)].toLowerCase();
  document.getElementById('downloadLabel').textContent = `Download ${record}`;

  const meds = document.getElementById('medsPanel');
  const allergies = document.getElementById('allergiesPanel');

  const onMedications = sectionOf(showing) === 'medications';
  meds.hidden = !onMedications;
  allergies.hidden = onMedications;

  if (onMedications) paintMedications(meds, showing === 'current');
  else paintAllergies(allergies);
}

/* ============================================================================
   THE MEDICATION TABLE

   A table, and the same columns the printed sheet carries.

   It was cards for a while, on the argument that a medication is one heading
   and half a dozen facts. What that lost is the reason anyone opens this
   screen: a medication list is READ DOWN. "Which of these do I take in the
   morning", "is anything from the mail pharmacy", "when did the prednisone
   stop" — every one of those is a question about a column, and a column is
   exactly what a grid of cards does not have. So the facts line up again.

   Past carries three columns Current does not — when it stopped, why, and who
   stopped it. Drawn only on Past rather than as three em dashes on every
   current row, which is the one thing the card layout got right.

   The wrap scrolls sideways rather than the columns being dropped: a
   medication list with a column hidden is a list somebody can be wrong from.
   ========================================================================= */

/** The columns, per panel. Current is the first seven; Past adds three. */
const MED_COLUMNS = [
  'Medication',
  'Dose',
  'Schedule',
  'Source',
  'Prescriber',
  'Pharmacy',
  'Start Date',
];
const PAST_COLUMNS = ['End Date', 'Reason Stopped', 'Stopped By'];

function paintMedications(host, current) {
  const meds = medicationsBy({ active: current });
  const columns = current ? MED_COLUMNS : [...MED_COLUMNS, ...PAST_COLUMNS];
  const title = current ? 'Current medications' : 'Past medications';

  host.innerHTML = `
    <div class="pp-table-wrap">
      <table class="pp-table" data-testid="meds--list">
        <caption class="pp-sr-only">${esc(title)}</caption>
        <thead>
          <tr>${columns.map((column) => `<th scope="col">${esc(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${
            meds.length
              ? meds.map((med) => row(med, current)).join('')
              : empty(columns.length, current)
          }
        </tbody>
      </table>
    </div>`;
}

/**
 * One medication.
 *
 * The name cell carries the note under it — "why you take it" is the patient's
 * own line about the medication, and it belongs beside the name rather than in
 * a column that would be blank on most rows.
 */
function row(med, current) {
  return `
    <tr data-med="${esc(med.id)}">
      <td>
        <span class="pp-meds__name">${esc(med.name)}</span>
        ${med.note ? `<span class="pp-meds__note">${esc(med.note)}</span>` : ''}
      </td>
      ${cell(med.dose)}
      <td>${schedule(med)}</td>
      <td>${source(med)}</td>
      ${cell(med.prescriber)}
      ${cell(med.pharmacy)}
      ${cell(med.started)}
      ${
        current
          ? ''
          : `${cell(med.ended)}
             ${cell(med.stopReason)}
             ${cell(med.stoppedBy)}`
      }
    </tr>`;
}

/**
 * A value, or an em dash.
 *
 * Not a blank cell: an empty box in a grid reads as a rendering fault, and on
 * a medication list the reader has to be able to tell "nobody recorded this"
 * from "the page failed to draw it".
 */
function cell(text) {
  return `<td>${text ? esc(text) : '<span class="pp-table__none">—</span>'}</td>`;
}

/** The head still names the columns, so an empty list reads as empty and not
    as broken. */
function empty(span, current) {
  return `
    <tr>
      <td class="pp-table__empty" colspan="${span}" data-testid="meds--empty">${esc(
        current
          ? 'Nothing is current right now.'
          : 'Nothing has been stopped yet. Medications you finish or come off will be kept here.'
      )}</td>
    </tr>`;
}

/** How often it is taken, and whether a refill is due — see medicationTags(). */
function schedule(med) {
  const tags = medicationTags(med);
  if (!tags.length) return '<span class="pp-table__none">—</span>';
  return tags
    .map((tag) => `<span class="pp-badge pp-badge--${tag.tone}">${esc(tag.label)}</span>`)
    .join(' ');
}

/**
 * WHERE THE ROW CAME FROM — the practice, or the patient.
 *
 * WHO WROTE THIS ROW DOWN is still worth saying even though the patient can
 * no longer add one. Three of these medications are the patient's own account
 * of what they take, seeded into the record; a clinician reading the list
 * needs "we ordered this" and "they told us this" to be distinguishable at a
 * glance, because only one of the two has a prescription behind it.
 *
 * Green for the practice's own, purple for the patient's. Deliberately not
 * green-and-grey: a grey chip beside a green one reads as second-class data,
 * and the self-reported rows are the ones most worth reading.
 */
function source(med) {
  return med.source === 'self'
    ? '<span class="pp-badge pp-badge--purple" data-testid="meds--source-self">Self-reported</span>'
    : '<span class="pp-badge pp-badge--ok" data-testid="meds--source-prescribed">Prescribed</span>';
}

/* ============================================================================
   DOWNLOAD

   ONE BUTTON PER RECORD, AND ONE SHEET.

   It used to print all four tabs at once; then it printed exactly the panel on
   screen, which meant a patient who wanted their medications had to press it
   twice — once on Current, once on Past — and hand over two sheets that say
   the same thing about the same person.

   So the scope is the RECORD and not the panel. On either medication tab the
   button reads "Download medications" and produces one sheet carrying both
   the current list and the past one; on Allergies it reads "Download
   allergies" and carries those. A patient asked for their allergies on a form
   still is not handing over their drug history, which is the reason the
   button stopped printing everything in the first place.
   ========================================================================= */

function wireDownload() {
  document.getElementById('download').addEventListener('click', () => {
    downloadSection(document.getElementById('printDoc'), sectionOf(showing));
  });
}
