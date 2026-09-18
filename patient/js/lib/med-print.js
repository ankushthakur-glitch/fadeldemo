/**
 * THE DOWNLOADED MEDICATION OR ALLERGY LIST.
 *
 * WHY PRINT IS THE DOWNLOAD FEATURE
 *
 * The portal has no backend, so there is nothing to generate a PDF on. The
 * browser already has one: every print dialog on every desktop platform
 * offers "Save as PDF", and iOS and Android both offer Share → Save. So one
 * window.print() gives the patient paper AND a file, with no library to load
 * and nothing to keep in step with a server.
 *
 * ONE RECORD PER DOWNLOAD
 *
 * This used to build all four tabs into one document, and then swung the
 * other way and built exactly the panel on screen — which meant a patient who
 * wanted their medication list had to take it twice, once for the current
 * ones and once for what they had stopped, and hand over two sheets.
 *
 * A RECORD is the right unit, and it is the unit the tabs already use.
 * Medications means the whole medication history: current, then past, two
 * tables under one header. Allergies means the allergies. So a patient asked
 * for their allergies on a form is not handing over their drug history, and a
 * patient asked "what are you on, and what have you been on" presses one
 * button.
 *
 * The header stays whole either way — clinic, patient, date of birth, MRN and
 * a generation stamp. A loose sheet with a medication list on it and no way
 * to tell whose it is is a hazard, not a document, and that is true of a
 * one-record sheet exactly as much as it was of the four-tab one.
 *
 * WHY A SEPARATE CONTAINER RATHER THAN PRINT RULES OVER THE LIVE MARKUP
 *
 * The panel not on screen is `hidden`, and no arrangement of @media print
 * rules can print an element with the hidden attribute without un-hiding it
 * on screen first. Building the document into its own container also means
 * the print layout owes nothing to the screen layout: no sidebar to suppress
 * inside it, no scroll wrapper, and no column widths tuned for a browser
 * window rather than a sheet of paper.
 *
 * It is rebuilt on every press rather than kept in sync, so it always says
 * what the screen says.
 */

import { esc } from './format.js';
import { generatedOn } from './dates.js';
import { PATIENT } from '../../data/patient.js';
import { medicationsBy } from '../../data/health.js';
import { ALLERGIES, typeLabel } from '../../data/allergies.js';

/** The practice, as it should read on a document leaving the building. */
const CLINIC = 'MediNova Clinic';

/**
 * What each section is called — on the sheet, and on the button that makes it.
 *
 * Exported so the screen's button label and the document's title come from
 * one string. A button reading "Download allergies" that produces a page
 * headed "Allergy record" is two names for one thing, and the person holding
 * the printout is the one who has to reconcile them.
 */
export const SECTION_TITLES = {
  medications: 'Medications',
  allergies: 'Allergies',
};

/** What each TABLE inside a section is called. Current and Past are two of
    these under the one Medications heading. */
const TABLE_TITLES = {
  current: 'Current medications',
  past: 'Past medications',
};

/**
 * Build one record into `host` and open the print dialog.
 *
 * @param {HTMLElement} host     the #printDoc container in health-medications.html
 * @param {string}      section  'medications' or 'allergies'
 */
export function downloadSection(host, section) {
  if (!host) return;
  const body = SECTIONS[section];
  if (!body) return;

  host.innerHTML = [header(SECTION_TITLES[section]), body(), footer()].join('');

  /*
   * print() is synchronous in every current browser: it blocks until the
   * dialog is dismissed, and the markup above is already in the DOM by the
   * time it runs. No timeout is needed, and adding one would race.
   */
  window.print();
}

/* ============================================================================
   THE SECTIONS
   ========================================================================= */

const SECTIONS = {
  /* Current first, then past. A reader who needs one of the two almost always
     needs the current list, and a sheet that opens with what somebody stopped
     taking buries it. */
  medications: () => medicationSection(true) + medicationSection(false),
  allergies: allergySection,
};

/**
 * The medication table, current or past.
 *
 * Past carries three columns Current does not. A stop date alone says a
 * medication ended, which the heading already says; the REASON is the fact a
 * clinician needs, because a finished course and a drug that made the patient
 * ill are history and a contraindication respectively and a bare date cannot
 * tell them apart. "Stopped by" is there because the practice ending a course
 * and the patient stopping on their own are read differently.
 */
function medicationSection(current) {
  const meds = medicationsBy({ active: current });

  const columns = [
    'Medication',
    'Dose',
    'Schedule',
    'Source',
    'Prescribed by',
    'Pharmacy',
    'Started',
  ];
  if (!current) columns.push('Stopped', 'Reason stopped', 'Stopped by');

  return section(
    TABLE_TITLES[current ? 'current' : 'past'],
    meds.length,
    columns,
    meds.map((med) => {
      const cells = [
        med.name,
        med.dose,
        med.schedule,
        sourceWord(med),
        med.prescriber,
        med.pharmacy,
        med.started,
      ];
      if (!current) cells.push(med.ended, med.stopReason, med.stoppedBy);
      return cells;
    }),
    current ? 'Nothing recorded.' : 'Nothing has been stopped.'
  );
}

function allergySection() {
  return section(
    SECTION_TITLES.allergies,
    ALLERGIES.length,
    ['Allergen', 'Type', 'Reaction', 'Severity', 'Onset date', 'Recorded', 'Recorded by'],
    ALLERGIES.map((allergy) => [
      allergy.name,
      typeLabel(allergy),
      allergy.reaction,
      allergy.severity,
      allergy.onsetDate,
      allergy.recordedOn,
      allergy.recordedBy,
    ]),
    /*
     * "None recorded" is NOT the same as "no allergies", and a printed list
     * is exactly where that distinction gets lost. Whoever reads this sheet
     * is deciding what they can safely give someone, so an empty table has to
     * say which of the two it means.
     */
    'None recorded. This is not the same as having no allergies — please confirm with the patient.'
  );
}

/* ============================================================================
   THE FRAME
   ========================================================================= */

/**
 * Clinic, patient, what this sheet is, and when it was made.
 *
 * The generation stamp is not decoration. A medication list is a snapshot the
 * moment it leaves the screen, and the single most useful thing printed on it
 * is how old it is — whoever reads it needs to know whether to trust it or
 * ask.
 *
 * The title names the record, so a sheet holding only the allergies does not
 * arrive headed "Medication & Allergy List" and invite the reader to look for
 * medications that were never on it.
 */
function header(title) {
  return `
    <header class="pp-print__head">
      <div class="pp-print__brand">
        <img class="pp-print__logo" src="assets/medinova-logo.svg" alt="" width="335" height="68" />
        <p class="pp-print__clinic">${esc(CLINIC)}</p>
      </div>

      <h1 class="pp-print__title">${esc(title)}</h1>

      <dl class="pp-print__facts">
        <div><dt>Name</dt><dd>${esc(PATIENT.name)}</dd></div>
        <div><dt>Date of birth</dt><dd>${esc(PATIENT.dob)}</dd></div>
        ${PATIENT.mrn ? `<div><dt>MRN</dt><dd>${esc(PATIENT.mrn)}</dd></div>` : ''}
        <div><dt>Generated on</dt><dd>${esc(generatedOn())}</dd></div>
      </dl>
    </header>`;
}

/**
 * The footer says the sheet is one part of the record, not all of it.
 *
 * Worth more now than when the document held everything: someone handed the
 * allergy sheet has no way to tell from the page whether the medications were
 * withheld or simply do not exist, and this says which.
 */
function footer() {
  return `
    <footer class="pp-print__foot">
      <p>
        One section of the record held in the ${esc(CLINIC)} patient portal —
        medications and allergies download separately. Please review with your
        care team.
      </p>
    </footer>`;
}

/* ============================================================================
   SHARED
   ========================================================================= */

/** "Prescribed" / "Self-reported" as a word — a printed page has no chips. */
const sourceWord = (med) => (med.source === 'self' ? 'Self-reported' : 'Prescribed');

/**
 * One titled table, or the empty line that stands in for it.
 *
 * The count is in the heading because a printed list is read away from the
 * screen that made it: "Current medications (6)" tells the reader at a glance
 * whether a second page went missing.
 */
function section(title, count, columns, rows, emptyText) {
  const heading = `<h2 class="pp-print__heading">${esc(title)}${
    count ? ` <span class="pp-print__count">(${count})</span>` : ''
  }</h2>`;

  if (!count) {
    return `
      <section class="pp-print__section">
        ${heading}
        <p class="pp-print__empty">${esc(emptyText)}</p>
      </section>`;
  }

  return `
    <section class="pp-print__section">
      ${heading}
      <table class="pp-print__table">
        <thead>
          <tr>${columns.map((column) => `<th scope="col">${esc(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map((cells) => `<tr>${cells.map((cell) => `<td>${cell ? esc(cell) : '—'}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
    </section>`;
}
