/**
 * VISIT SUMMARY — one past visit, written for the person who attended it.
 *
 * Reached from the Past tab of the Appointment screen:
 *
 *     appointment.html?tab=past  →  View Visit Summary
 *                                →  visit-summary.html?appointment=appt-aug-08
 *
 * ⚠ WHAT THIS SCREEN MAY NOT SHOW
 *
 * The clinician's note. Not an excerpt of it, not a "clinical detail" section
 * that quietly grows into it. The portal reads data/visit-summaries.js, which
 * holds authored patient-facing documents and has no field a note could sit
 * in — see the header there. The footnote at the end of the page says as much
 * to the patient, so the absence reads as a decision rather than a gap, and
 * points at the way to get the full record: ask the practice.
 *
 * The visit's own facts — date, provider, mode, location — come from
 * data/appointments.js, not from a copy inside the summary. It is the same
 * appointment the patient just clicked; two copies of it is two chances to
 * disagree about when they were seen.
 *
 * HOW IT IS SET OUT: THE CLINICIAN'S NOTE, IN THE PATIENT'S WORDS
 *
 * The same sectioning as the Encounter Summary in the EHR — see
 * js/screens/encounter-summary.js and css/screen-encounter-summary.css. Every
 * section is one card with a brand rule beside its heading, and the facts
 * inside it are a BAND: labelled cells across the width, divided by thin
 * rules, a small grey label over its value.
 *
 * WHY BORROW THE LAYOUT AND NOT THE WORDS. The two documents are read by
 * different people for different reasons, and the wording must not be shared —
 * that is what the warning above is about. But the SHAPE can be, and there are
 * two arguments for it. A patient who takes this sheet to another clinician
 * hands over something that reads the way a note reads, so the person
 * receiving it can find the vitals and the problem list where they expect
 * them. And a band of labelled facts is simply a better way to carry short
 * facts than the column of bordered cards this page used to draw: six facts
 * cost six rows of a very wide column, and the eye tracked back to the left
 * margin for every one of them.
 *
 * SHORT VALUES PACK, SENTENCES GET A WIDER COLUMN, and the choice is made for
 * a whole band rather than cell by cell — a narrow column between two wide
 * ones leaves the values stepping in and out down the page. Same rule, and the
 * same reasoning, as the note's own `isShort`.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { generatedOn } from '../lib/dates.js';
import { UPCOMING, PAST } from '../../data/appointments.js';
import { PATIENT } from '../../data/patient.js';
import { visitSummaryFor } from '../../data/visit-summaries.js';

document.addEventListener('DOMContentLoaded', () => {
  // Appointment stays lit in the side nav: this is a leaf of that section, not
  // a place of its own, and a nav with nothing highlighted reads as lost.
  if (!mountShell({ active: 'appointment' })) return;

  const id = new URLSearchParams(location.search).get('appointment');
  const appointment = PAST.find((appt) => appt.id === id) ?? null;
  const summary = id ? visitSummaryFor(id) : null;

  const host = document.getElementById('screen');

  if (!appointment || !summary) {
    host.innerHTML = unavailable(appointment);
    return;
  }

  host.innerHTML = render(appointment, summary);

  /*
   * A real print, not a toast about one. The summary is the one page in the
   * portal a patient hands to somebody else, and css/screen-visit-summary.css
   * drops the shell for the printer.
   *
   * PRINT AND DOWNLOAD ARE ONE BUTTON'S WORTH OF CODE, on purpose. The portal
   * has no backend to render a PDF on, and every desktop print dialog already
   * offers Save as PDF while iOS and Android offer Share → Save — so the same
   * window.print() is both. It is the rule the medication list already
   * follows; see the header of js/lib/med-print.js. What the two buttons do
   * not share is the WORD: a patient looking for a file to email their
   * insurer does not go hunting under a printer icon, so Download says
   * Download, and the sheet both of them produce carries the patient's name,
   * date of birth and MRN — see printHead().
   */
  host.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });
});

/* ============================================================================
   THE DOCUMENT
   ========================================================================= */

function render(appointment, summary) {
  return `
    <a class="pp-back" href="appointment.html?tab=past" data-testid="visit--back">
      ${icon('arrow-left', { size: 'sm' })}<span>Past appointments</span>
    </a>

    <article class="pp-visit" data-testid="visit--summary">
      ${printHead()}

      <header class="pp-visit__head">
        <div class="pp-visit__headline">
          <h1 class="pp-visit__title">Visit Summary</h1>
          <p class="pp-visit__reason">${esc(summary.reason)}</p>
        </div>

        <div class="pp-visit__tools">
          <button type="button" class="pp-btn pp-btn--neutral pp-btn--sm" data-print
            data-testid="visit--print">
            ${icon('printer', { size: 'sm' })}<span>Print</span>
          </button>
          <button type="button" class="pp-btn pp-btn--neutral pp-btn--sm" data-print
            data-testid="visit--download">
            ${icon('download', { size: 'sm' })}<span>Download</span>
          </button>
        </div>
      </header>

      ${section('Visit Details', visitDetails(appointment, summary))}
      ${section('What we talked about', paragraphs(summary.summary))}
      ${section('What we measured', vitals(summary.vitals))}
      ${section('What we are treating', conditions(summary.conditions))}
      ${section('Medication changes', medicationChanges(summary))}
      ${section('How to look after yourself', bullets(summary.instructions))}
      ${section('Tests we ordered', tests(summary.tests))}
      ${section('Upcoming procedure and next steps', nextSteps(summary.nextSteps))}

      <!--
        The footnote, and the reason this screen exists in the shape it does.
        Said plainly rather than hidden: a patient who wants the whole record
        is entitled to it, and the way to ask is the practice, not a search
        for a link that is not on the page.
      -->
      <footer class="pp-visit__foot">
        <div class="pp-alert pp-alert--info" data-testid="visit--note-notice">
          <span class="pp-visit__foot-icon">${icon('info', { size: 'sm' })}</span>
          <div>
            <div class="pp-alert__heading">This is a summary, not your full medical record</div>
            <p class="pp-alert__body">
              Your clinician's complete note for this visit is not shown here. To request a
              copy of your full record, message your care team or call the practice on
              (808) 555-0100.
            </p>
          </div>
        </div>
      </footer>
    </article>
  `;
}

/**
 * One section of the note: a card, a heading with a brand rule beside it, and
 * whatever the section carries. The EHR's own `sectionHtml`, in the portal's
 * class names.
 */
function section(title, body) {
  return `
    <section class="pp-visit__section">
      <h2 class="pp-visit__section-title">${esc(title)}</h2>
      <div class="pp-visit__section-body">${body}</div>
    </section>
  `;
}

/* ============================================================================
   THE BAND — the note's unit for carrying labelled facts

   A grid of cells across the width of the section, each one a small grey
   label over its value, divided by thin rules. Two column widths, chosen for
   the whole band rather than cell by cell: a band whose every value is short
   packs several across the way a flowsheet does, and one holding a sentence
   gives every cell the wider track so the values do not step in and out down
   the page.

   The wrapper clips the leftmost cell's own left border, so the rules fall
   BETWEEN the columns and never against the card's edge — on the first row and
   on every row the grid wraps to. Straight from the EHR's `bandHtml`, and for
   the same reason.
   ========================================================================= */

/** A value long enough to be read rather than scanned. Same figure as the note. */
const SHORT_VALUE = 32;

function band(cells) {
  const wide = !cells.every((cell) => (cell.value ?? '').length <= SHORT_VALUE && !cell.note);

  return `
    <div class="pp-band-wrap">
      <dl class="pp-band${wide ? ' pp-band--wide' : ''}">
        ${cells.map(cellHtml).join('')}
      </dl>
    </div>
  `;
}

/**
 * One cell.
 *
 * `badge` is the portal's addition to the note's vocabulary and it earns its
 * place: a status a patient has to act on — "Waiting for you to go" — is not
 * the same kind of fact as the words beside it, and a reader skimming for what
 * is outstanding should be able to find it without reading the cell.
 *
 * `note` is the second addition, and the reason the patient's copy needs one.
 * A clinician reads "118/76" and knows what it means; a patient needs the
 * sentence under it. It is set quieter than the value so the band still scans.
 */
function cellHtml({ label, value, note, badge, full }) {
  return `
    <div class="pp-band__cell${full ? ' pp-band__cell--full' : ''}">
      <dt>
        <span>${esc(label)}</span>
        ${badge ? `<span class="pp-badge pp-badge--info">${esc(badge)}</span>` : ''}
      </dt>
      <dd>
        ${esc(value)}
        ${note ? `<span class="pp-band__note">${esc(note)}</span>` : ''}
      </dd>
    </div>
  `;
}

/** The prose sections — Assessment and Plan are paragraphs in the note too. */
function paragraphs(items) {
  return items.map((para) => `<p class="pp-visit__para">${esc(para)}</p>`).join('');
}

/* ============================================================================
   VISIT DETAILS

   The note opens with Appointment Details and so does this: the same facts,
   under the labels a patient recognises, with the reason for the visit taking
   the whole width underneath because it is prose sitting below short facts.

   The visit's own facts come from data/appointments.js, not from a copy inside
   the summary — see the header of this file.
   ========================================================================= */

function visitDetails(appointment, summary) {
  return band([
    { label: 'Date & Time', value: appointment.dateTime },
    { label: 'Provider', value: appointment.provider },
    { label: 'Visit Mode', value: appointment.mode },
    { label: 'Location', value: appointment.location },
    { label: 'Summary written by', value: summary.author },
    { label: 'Published', value: summary.publishedOn },
    { label: 'Reason For Visit', value: summary.reason, full: true },
  ]);
}

function bullets(items) {
  return `<ul class="pp-visit__list">${items
    .map((item) => `<li>${esc(item)}</li>`)
    .join('')}</ul>`;
}

/* ============================================================================
   WHAT WE MEASURED

   The note's Objective section: the numbers taken in the room, packed across
   the band the way a flowsheet packs them. The figures are the ones in the
   practice's own chart — see the header of data/visit-summaries.js — so the
   sheet a patient prints and the record the clinician reads describe one
   afternoon.

   Each number carries a line saying what it MEANS, which is the one thing the
   clinician's copy does not need. Nobody can act on 118/76; anybody can act on
   "in the healthy range".
   ========================================================================= */

function vitals(rows) {
  if (!rows.length) {
    return `<p class="pp-visit__none" data-testid="visit--no-vitals">
      Nothing was measured at this visit — it was a video call, so there was no blood
      pressure, weight or temperature taken.
    </p>`;
  }

  return band(
    rows.map((row) => ({ label: row.label, value: row.value, note: row.note }))
  );
}

/* ============================================================================
   WHAT WE ARE TREATING

   The problem list, under the practice's own ICD-10 codes.

   THE PLAIN NAME IS THE LABEL AND THE CODE IS THE FOOTNOTE, which is the
   opposite of how the clinician's chart sets it. Both readers are right: a
   coder scans a column of codes, and a patient needs to be told they have acid
   reflux before being told it is K21.9. But the code is on the page, because
   it is the string that identifies this condition to an insurer, a second
   opinion or an emergency department at two in the morning, and a patient who
   cannot quote it has to ring the practice to get it.
   ========================================================================= */

function conditions(rows) {
  if (!rows.length) {
    return `<p class="pp-visit__none">
      No ongoing conditions were reviewed at this visit.
    </p>`;
  }

  return (
    band(
      rows.map((row) => ({
        label: row.plain,
        badge: row.status,
        value: row.detail,
        note: `${row.code} — ${row.clinicalName}${row.since ? ` · ${row.since}` : ''}`,
      }))
    ) +
    `<p class="pp-visit__aside">
      The code under each one is how your practice, your insurer and any other clinician
      you see refer to it.
    </p>`
  );
}

/* ============================================================================
   TESTS WE ORDERED

   Every cell answers the two questions a patient leaves with and nobody
   answers: what is waiting on me, and where will the result turn up. The badge
   carries the first at a glance, because a patient scanning this section is
   looking for what is still outstanding.
   ========================================================================= */

function tests(rows) {
  if (!rows.length) {
    return `<p class="pp-visit__none" data-testid="visit--no-tests">
      No tests were ordered at this visit.
    </p>`;
  }

  return (
    band(
      rows.map((test) => ({
        label: test.name,
        badge: test.status,
        value: test.why,
        note: `When: ${test.when} · Where: ${test.where}`,
      }))
    ) +
    `<p class="pp-visit__aside">
      Results appear on your <a href="health-reports.html">Reports</a> screen as soon as the
      lab sends them, and you will get a notification when one arrives.
    </p>`
  );
}

/* ============================================================================
   THE PRINTED SHEET'S IDENTITY BLOCK

   Hidden on screen — the page already says whose it is, because you signed in
   to reach it — and printed at the top of the paper, where nothing does.

   A page of medication instructions with no name on it is not a document, it
   is a hazard: it gets handed to a specialist, photocopied into somebody
   else's file, or found on a kitchen table by a relative who cannot tell
   whether it is current. The generation stamp is the other half of that —
   what makes a sheet trustworthy is knowing how old it is. Same reasoning,
   and same fields, as the printed medication list in js/lib/med-print.js.
   ========================================================================= */

function printHead() {
  return `
    <div class="pp-visit__print-head" aria-hidden="true">
      <!--
        The mark, for the same reason the printed form and the printed
        medication list carry one (lib/form-print.js, lib/med-print.js): this
        sheet is handed to a specialist and filed in somebody else's notes, and
        the clinic's name in text is a line anybody could have typed. It is an
        <img> rather than a background because browsers suppress background
        images when printing by default and print <img> regardless.
      -->
      <img class="pp-visit__print-logo" src="assets/gastroemr-logo.svg" alt=""
        width="335" height="68" />
      <p class="pp-visit__print-clinic">GastroEMR Clinic — Visit Summary</p>
      <dl class="pp-visit__print-facts">
        <div><dt>Name</dt><dd>${esc(PATIENT.name)}</dd></div>
        <div><dt>Date of birth</dt><dd>${esc(PATIENT.dob)}</dd></div>
        ${PATIENT.mrn ? `<div><dt>MRN</dt><dd>${esc(PATIENT.mrn)}</dd></div>` : ''}
        <div><dt>Printed on</dt><dd>${esc(generatedOn())}</dd></div>
      </dl>
    </div>
  `;
}

/* ============================================================================
   MEDICATION CHANGES

   Started and stopped in one band, and the LABEL is which of the two it is.
   That is the fact a patient has to act on tonight, and putting it in the
   label rather than beside the drug name means the two words a reader is
   scanning for sit in the same place in every cell.

   It used to be two headed lists side by side, which cost a heading each and
   left one column short whenever a visit only changed one thing.
   ========================================================================= */

function medicationChanges({ medicationsStarted, medicationsStopped }) {
  if (!medicationsStarted.length && !medicationsStopped.length) {
    return `<p class="pp-visit__none" data-testid="visit--no-med-changes">
      No medications were started or stopped at this visit. Keep taking everything on your
      current list as before.
    </p>`;
  }

  const cells = [
    ...medicationsStarted.map((med) => ({
      label: 'Started',
      value: `${med.name} ${med.dose}${med.schedule ? ` — ${med.schedule.toLowerCase()}` : ''}`,
      note: med.why,
    })),
    ...medicationsStopped.map((med) => ({
      label: 'Stopped',
      value: `${med.name} ${med.dose}`,
      note: med.why,
    })),
  ];

  return (
    band(cells) +
    `<p class="pp-visit__aside">
      Your full list is on the <a href="health-medications.html">Medications</a> screen.
    </p>`
  );
}

/* ============================================================================
   NEXT STEPS

   A step that names an appointment id carries no date of its own — it is
   resolved against data/appointments.js here, so a rescheduled visit changes
   the summary too instead of leaving it quoting a date that has moved.

   The label says which KIND of next step it is: one already in the diary, or
   one the practice is still arranging. That is the difference between "turn up"
   and "wait for our call", and it is the only thing a patient has to work out
   from this section.
   ========================================================================= */

function nextSteps(steps) {
  if (!steps.length) {
    return `<p class="pp-visit__none">Nothing further is arranged after this visit.</p>`;
  }

  return band(
    steps.map((step) => {
      const appointment = step.appointmentId
        ? UPCOMING.find((appt) => appt.id === step.appointmentId)
        : null;

      const when = appointment
        ? `${appointment.dateTime} — ${appointment.provider}`
        : step.when ?? '';

      return {
        label: step.title,
        badge: appointment ? 'Booked' : 'Being arranged',
        value: when,
        note: step.detail,
      };
    })
  );
}

/* ============================================================================
   NO SUMMARY

   Two different reasons, and they deserve two different sentences. A
   cancelled visit has no summary because nothing happened; an unknown id is a
   mistyped or stale address. Telling a patient "not found" when the answer is
   "you cancelled it" sends them to the phone for nothing.
   ========================================================================= */

function unavailable(appointment) {
  const cancelled = appointment?.status === 'Cancelled';

  return `
    <a class="pp-back" href="appointment.html?tab=past">
      ${icon('arrow-left', { size: 'sm' })}<span>Past appointments</span>
    </a>

    <div class="pp-empty" data-testid="visit--unavailable">
      <span class="pp-empty__icon">${icon('file')}</span>
      <h1 class="pp-empty__title">No visit summary</h1>
      <p>
        ${
          cancelled
            ? `The ${esc(appointment.dateTime)} appointment was cancelled, so there is
               nothing to summarise.`
            : `We could not find a summary for that visit. It may have been written since
               you last signed in, or the link may be out of date.`
        }
      </p>
      <a class="pp-btn pp-btn--outline" href="appointment.html?tab=past">
        Back to past appointments
      </a>
    </div>
  `;
}
