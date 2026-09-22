/**
 * ENCOUNTER SUMMARY — the note as it reads once it is written.
 *
 * The Encounters worklist (Scheduler → Encounters) opens into this: the whole
 * note on one page, read rather than edited, with its signatures beside it.
 * Unsigned it is the last look before committing; signed it is the filed
 * record.
 *
 * WHY THE CONTENT IS DERIVED, NOT STORED PER VISIT
 * A note's shape comes from its type — a SOAP note has the same five headings
 * whoever is writing it — and its content comes from the booking it documents.
 * Keeping a hand-written body for all sixty-odd demo bookings would mean sixty
 * chances for the name in the note to disagree with the name on the booking.
 * So the sections are templates filled from the appointment, with a handful of
 * specific bodies for the patients the rest of the prototype already tells a
 * story about.
 *
 * All names, findings and dates are invented. No real patient information.
 */

/**
 * The signature register: who has signed which encounter, and when.
 *
 * EMPTY, BECAUSE NOTE_REGISTER IS. It is seeded for exactly the notes
 * data/visit-notes.js calls signed, so that the two agree on the first paint —
 * a summary that showed "unsigned" for a row the worklist filed under Signed
 * would be the same bug in two places. That register is empty now, so this one
 * is too, and the pairing is the thing to keep rather than either list.
 *
 * An entry is { by, on, at }, keyed by appointment id:
 *
 *   ['ap1', { by: 'Olivia Rhye, MD', on: '3 Aug 2026', at: '04:12 PM' }],
 *
 * Written to at runtime when an encounter is signed, which is how a signature
 * gets in here now — so it is a Map read through the helpers below rather than
 * a frozen table.
 */
const SIGNATURES = new Map();

export const signatureFor = (apptId) => SIGNATURES.get(apptId) ?? null;

/** Record a signature. Returns the entry so the caller can paint from it. */
export function signEncounter(apptId, by, on, at) {
  const entry = { by, on, at };
  SIGNATURES.set(apptId, entry);
  return entry;
}

/** Drop a signature — "Amend" reopens a filed note for editing. */
export function unsignEncounter(apptId) {
  SIGNATURES.delete(apptId);
}

/**
 * The note body, by note type.
 *
 * Each section is { heading, rows } where a row is either a labelled line
 * ({ label, value }) or a paragraph ({ text }). Two shapes rather than one
 * because a note is genuinely both: "Medical History: acid reflux" is a
 * labelled fact, and the HPI is prose.
 */
/* --- Reading the patient's own record ---------------------------------------
   WHY THIS IS HERE AT ALL

   These templates used to print the same six facts into every note in the
   practice: "Medical History: Acid reflux, hypertension, type II diabetes.
   Surgical History: Carpal tunnel release." Every patient, every visit, whoever
   they were and whatever the chart actually said about them. It read like a
   record and it was a fixture, which is the one thing a clinical document must
   never be — a reader has no way to tell a templated line from a recorded one,
   and the two look identical on a signed note.

   So the parts of a note that RESTATE THE CHART now come from the chart:
   data/chart-history.js for the histories, data/profile-clinical.js for the
   problem list, the vitals and the open orders. The parts that are per-visit
   NARRATIVE — what the examination found today, what the endoscope saw — have
   no source in this prototype and stay templated, because there is nothing to
   read them from; they are written from the booking's own facts so at least
   they cannot name a provider the appointment does not.

   AND WHERE THE CHART IS EMPTY, THE SECTION IS EMPTY. Most of the demo patients
   have no clinical record behind them. A note that filled the gap with plausible
   history would be asserting, in a document somebody signs, facts nobody
   recorded. An absent section says "nothing is on file"; an invented one says
   something false. Empty sections are dropped by summarySections() below.
   -------------------------------------------------------------------------- */

import { CHART_HISTORY } from './chart-history.js';
import { PROFILE_CLINICAL } from './profile-clinical.js';

const historyFor = (mrn) => CHART_HISTORY[mrn] ?? null;
const clinicalFor = (mrn) => PROFILE_CLINICAL[mrn] ?? null;

/** A row, or nothing — so a section can be built by listing what it might say. */
const row = (label, value) => (value ? [{ label, value }] : []);

/** '18-07-2018' → '2018'. A history is read by era, not by day. */
const yearOf = (date) => String(date ?? '').split('-').pop() ?? '';

/**
 * The past medical history, as the sentence a note carries.
 *
 * Active and chronic conditions first and named plainly; the resolved ones
 * after, marked as resolved, because "had H. pylori, eradicated" is a different
 * fact from "has hypothyroidism" and a note that ran them together would be
 * read as a list of current problems.
 */
function pastMedicalLine(mrn) {
  const list = historyFor(mrn)?.pastMedical ?? [];
  if (!list.length) return '';
  const current = list.filter((entry) => entry.status !== 'Resolved');
  const resolved = list.filter((entry) => entry.status === 'Resolved');
  return [
    ...current.map((entry) => entry.condition),
    ...resolved.map((entry) => `${entry.condition} (resolved)`),
  ].join(', ');
}

/** Operations with the year they were done, which is what a history is asked for. */
function surgicalLine(mrn) {
  const list = historyFor(mrn)?.surgical ?? [];
  return list
    .map((entry) => (yearOf(entry.date) ? `${entry.procedure} (${yearOf(entry.date)})` : entry.procedure))
    .join(', ');
}

/**
 * The two social answers a clinical note actually turns on.
 *
 * The questionnaire has nine categories and most of them — financial strain,
 * exposure to violence — belong in the record and to the people who act on
 * them, not restated in the body of every visit note. Tobacco and alcohol are
 * the two that change what is prescribed and what is screened for.
 *
 * TWO ROWS, NOT ONE. They were packed into a single "Social History" value —
 * "Tobacco: Former smoker — quit Apr 2023. Alcohol: 2–3 times a week — ..." —
 * which put a second set of labels inside a value that already had one, and
 * left the reader parsing full stops to find where the smoking answer ended.
 * They are two questions with two answers, so they are two rows.
 */
function socialRows(mrn) {
  const social = historyFor(mrn)?.social ?? {};
  return [
    ['tobacco', 'Tobacco'],
    ['alcohol', 'Alcohol'],
  ].flatMap(([key, label]) => {
    const answer = social[key];
    if (!answer?.response) return [];
    return row(label, answer.detail ? `${answer.response} — ${answer.detail}` : answer.response);
  });
}

/** The active problem list, with the codes the practice bills under. */
function problemLine(mrn) {
  const problems = (clinicalFor(mrn)?.problems ?? []).filter((p) => p.status === 'Active');
  return problems.map((p) => `${p.label} (${p.code})`).join(', ');
}

/**
 * The vitals on file, most recent set first.
 *
 * Only the ones sharing the newest date, because a note's Objective section is
 * what was measured at a visit — pulling a respiratory rate from six months
 * earlier in beside today's blood pressure reads as one set of observations
 * when it is two.
 */
function vitalsLine(mrn) {
  const vitals = clinicalFor(mrn)?.vitals ?? [];
  if (!vitals.length) return '';
  const latest = vitals[0].date;
  return vitals
    .filter((v) => v.date === latest)
    .map((v) => `${v.label} ${v.value}`)
    .join(' · ');
}

/** Investigations already out, which is half of what a plan is. */
function openOrdersLine(mrn) {
  const open = clinicalFor(mrn)?.orders?.open ?? [];
  return open.map((order) => `${order.description} (${order.type})`).join(', ');
}

/** What the patient is booked back for, and when. */
function recallLine(mrn) {
  const recalls = clinicalFor(mrn)?.recalls ?? [];
  return recalls.map((recall) => `${recall.type} — ${recall.date} (${recall.status})`).join(', ');
}

const SOAP_SECTIONS = (ctx) => [
  {
    heading: 'Subjective',
    rows: [
      { label: "Today's Visit", value: ctx.reason },
      ...row('Medical History', pastMedicalLine(ctx.mrn)),
      ...row('Surgical History', surgicalLine(ctx.mrn)),
      ...socialRows(ctx.mrn),
    ],
  },
  {
    heading: 'Objective',
    rows: [...row('Vitals', vitalsLine(ctx.mrn))],
  },
  {
    heading: 'Assessment',
    rows: [
      ...row('Active problems', problemLine(ctx.mrn)),
      { text: `${ctx.reason} — reviewed with ${ctx.provider}.` },
    ],
  },
  {
    heading: 'Plan',
    rows: [
      ...row('Investigations outstanding', openOrdersLine(ctx.mrn)),
      ...row('Recall', recallLine(ctx.mrn)),
    ],
  },
];

const PROCEDURE_SECTIONS = (ctx) => [
  {
    heading: 'Indication',
    rows: [{ text: ctx.reason }],
  },
  {
    heading: 'Procedure',
    rows: [
      { label: 'Procedure', value: ctx.apptType },
      { label: 'Endoscopist', value: ctx.provider },
      { label: 'Sedation', value: 'Monitored anaesthesia care. Tolerated well, no complications.' },
    ],
  },
  {
    heading: 'Findings',
    rows: [{ text: 'The examination was completed to the intended landmark. Mucosa normal throughout.' }],
  },
  {
    heading: 'Recommendations',
    rows: [
      { text: 'Discharge home with a responsible escort. Written instructions given.' },
      { text: 'Histology to follow; the patient will be contacted with the result.' },
    ],
  },
];

const INFUSION_SECTIONS = (ctx) => [
  {
    heading: 'Indication',
    rows: [{ text: ctx.reason }],
  },
  {
    heading: 'Infusion',
    rows: [
      { label: 'Therapy', value: ctx.apptType },
      { label: 'Access', value: 'Peripheral cannula, right antecubital fossa, first attempt.' },
      { label: 'Observations', value: 'Recorded per protocol throughout. No infusion reaction.' },
    ],
  },
  {
    heading: 'Plan',
    rows: [{ text: 'Next cycle booked. The patient knows who to call if symptoms change before then.' }],
  },
];

/**
 * The sections for one encounter.
 *
 * `ctx` carries what the sections are built from: the booking's own facts —
 * `reason`, `provider`, `apptType` — so the note can never name a provider the
 * appointment does not, and `mrn`, so the parts that restate the chart can read
 * the chart rather than a fixture.
 *
 * A SECTION WITH NO ROWS IS DROPPED. Most of the demo patients have no clinical
 * record, so an Objective section built from their vitals has nothing in it —
 * and a heading over an empty card is a worse answer than no heading, because
 * it reads as "we looked and found nothing" rather than "nothing was recorded".
 */
export function summarySections(kind, ctx) {
  const sections =
    kind === 'procedure'
      ? PROCEDURE_SECTIONS(ctx)
      : kind === 'infusion'
        ? INFUSION_SECTIONS(ctx)
        : SOAP_SECTIONS(ctx);

  return sections.filter((section) => section.rows.length);
}

/** The one-line reason a visit happened, when the booking did not record one. */
export const DEFAULT_REASON = 'Routine review — no specific complaint recorded at booking.';
