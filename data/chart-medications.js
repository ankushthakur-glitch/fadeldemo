/**
 * MEDICATION — what the patient is actually taking right now.
 *
 * THIS FILE HOLDS NO DATA OF ITS OWN, deliberately. A patient's active
 * medication already exists in two places, and both are true:
 *
 *   data/chart-prescriptions.js  — scripts THIS practice wrote (rich: sig,
 *                                  diagnosis, dispense, prescriber, dates)
 *   data/profile-clinical.js     — the reconciled medication list, which
 *                                  includes drugs started somewhere else and
 *                                  is what the front desk actually confirms
 *
 * A clinician asking "what is this person on?" means the union of the two.
 * Seeding a third list would be a third thing to keep in step, and it would
 * be the one that goes stale — so this file composes the answer instead.
 *
 * Nothing writes here. Prescribing stays in the Prescriptions module — which
 * is now the space the e-prescribing integration renders into — and the
 * reconciled list stays on Profile · Clinical. This is the read, and since the
 * vendor took over the writing it is the ONLY place in the chart where a full medication history
 * is assembled: active, past, and what was pushed under sedation.
 */
import { CHART_PRESCRIPTIONS } from './chart-prescriptions.js';
import { PROFILE_CLINICAL } from './profile-clinical.js';
import { ADMINISTERED_MEDICATIONS } from './procedure-encounter.js';
import {
  MEDICATIONS,
  STOCK_ENTRIES,
  isExpired,
  daysUntil,
} from './medication-inventory.js';

/* ============================================================================
   SOURCES

   A row's provenance is shown, not hidden. "Reported" is not a lesser record —
   it is the half of the list nobody in this building prescribed and therefore
   the half that has to be confirmed with the patient rather than looked up.
   ========================================================================= */
export const MEDICATION_SOURCES = {
  prescribed: { label: 'Prescribed here', tone: 'brand' },
  reported: { label: 'Reported', tone: 'neutral' },
};

/**
 * Dose forms carry no identity — "Omeprazole 20mg" and "Omeprazole 20mg
 * capsule" are one drug written down twice. Stripping the form word (and
 * punctuation, and case) is enough to catch that in demo data. A real system
 * would match on RxNorm; this is a prototype and says so rather than
 * pretending the string comparison is clinical-grade.
 */
const DOSE_FORMS =
  /\b(tablet|tablets|capsule|capsules|oral solution|solution|topical cream|cream|injection|inhaler|suspension|syrup)\b/g;

function dedupeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(DOSE_FORMS, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Every active medication for one patient, prescriptions first so that when
 * the same drug appears in both lists the richer record is the one kept.
 *
 * Rows are a single shape regardless of where they came from, and that shape
 * is the one the Add Medication form captures — quantity, dosage unit,
 * frequency, the dates and the lot. The two seed sources cannot fill all of
 * it, and nothing here invents the difference: a field the source does not
 * have is null and the module prints an em dash.
 *
 *   prescribed  quantity/unit come from the dispense, frequency from the sig
 *   reported    only the frequency and a start date were ever collected —
 *               nobody here dispensed it, so there is no quantity or lot
 *
 * @param {string} mrn
 * @returns {Array<{id, name, diagnosis, source, quantity, dosageUnit,
 *                  frequency, startDate, endDate, lot, prescriber}>}
 *          sorted A–Z by name: a medication list is scanned for a name, not
 *          read in the order the drugs were started.
 */
export function activeMedicationsFor(mrn) {
  const prescribed = (CHART_PRESCRIPTIONS[mrn]?.active || []).map((rx) => ({
    id: `med-rx-${rx.id}`,
    name: rx.name,
    diagnosis: rx.diagnosis,
    source: 'prescribed',
    quantity: rx.dispenseQty ?? null,
    dosageUnit: rx.dispenseUnit || null,
    /* The sig is the whole instruction — "1 tablet orally twice daily" — and
       the frequency is inside it. Shown whole rather than cut down to the two
       words that look like a frequency: "orally" and "1 tablet" are part of
       how the drug is taken, and dropping them to fit a column heading would
       lose more than it tidies. */
    frequency: rx.sig || null,
    startDate: rx.startDate,
    endDate: rx.endDate || null,
    /* A script is filled at a pharmacy, not out of our cupboard, so there is
       no lot of ours behind it. */
    lot: null,
    prescriber: rx.provider,
  }));

  const reported = (PROFILE_CLINICAL[mrn]?.medications || [])
    .filter((med) => med.status === 'active')
    .map((med, index) => ({
      id: `med-cl-${index}`,
      name: med.name,
      diagnosis: null,
      source: 'reported',
      quantity: null,
      dosageUnit: null,
      frequency: med.dose,
      startDate: med.startDate,
      endDate: null,
      lot: null,
      prescriber: null,
    }));

  const seen = new Set();
  return [...prescribed, ...reported]
    .filter((med) => {
      const key = dedupeKey(med.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Everything this patient HAS been on and is not on now.
 *
 * The mirror image of the list above, built from the same two sources so the
 * two halves of a medication history cannot disagree about where a row came
 * from. A stopped script keeps the reason it stopped — Completed is a course
 * that ran its length, Discontinued is one somebody called off, and the
 * difference is the whole point of looking a drug up in the past list.
 *
 * Sorted by end date, most recently stopped first — NOT A–Z like the active
 * list. The two are read with different questions in hand: "what is this
 * person on" is a lookup by name, and "what have they been on" is almost
 * always "what did we stop, and when". A past list alphabetised buries the
 * answer to the second among drugs from four years ago.
 *
 * @param {string} mrn
 * @returns {Array} the active list's row shape plus `status`.
 */
export function pastMedicationsFor(mrn) {
  const stopped = (CHART_PRESCRIPTIONS[mrn]?.past || []).map((rx) => ({
    id: `med-rx-past-${rx.id}`,
    name: rx.name,
    diagnosis: rx.diagnosis,
    source: 'prescribed',
    quantity: rx.dispenseQty ?? null,
    dosageUnit: rx.dispenseUnit || null,
    frequency: rx.sig || null,
    startDate: rx.startDate,
    endDate: rx.endDate || null,
    lot: null,
    prescriber: rx.provider,
    status: rx.status || 'Completed',
  }));

  /* A drug the patient reported and has since stopped. The reconciled list
     carries no end date and no reason — nobody here stopped it — so the row
     says Stopped and leaves the rest as em dashes rather than inventing a
     date somebody could read as a fact. */
  const reported = (PROFILE_CLINICAL[mrn]?.medications || [])
    .filter((med) => med.status !== 'active')
    .map((med, index) => ({
      id: `med-cl-past-${index}`,
      name: med.name,
      diagnosis: null,
      source: 'reported',
      quantity: null,
      dosageUnit: null,
      frequency: med.dose,
      startDate: med.startDate,
      endDate: med.endDate || null,
      lot: null,
      prescriber: null,
      status: 'Stopped',
    }));

  const seen = new Set();
  return [...stopped, ...reported]
    .filter((med) => {
      const key = dedupeKey(med.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => toSortable(b.endDate) - toSortable(a.endDate));
}

/** dd-mm-yyyy → a number that sorts. A row with no end date sorts last
 *  rather than first: "we don't know when it stopped" is not news. */
function toSortable(ddmmyyyy) {
  const [d, m, y] = String(ddmmyyyy || '').split('-').map(Number);
  if (!d || !m || !y) return 0;
  return y * 10000 + m * 100 + d;
}

/**
 * What was given during a procedure, read back from the anaesthesia record.
 *
 * DELIBERATELY NOT MERGED INTO THE LIST ABOVE. That list answers "what is this
 * person on right now", and a drug given once under sedation is not something
 * they are on — it finished when the case did. Sorting propofol into the A–Z
 * between Omeprazole and Sertraline would say the patient is taking it, which
 * is the one thing a medication list must never say by accident.
 *
 * So it is fetched here and shown as its own record: same page, because "what
 * were they given" is asked in the same breath as "what are they on", and a
 * separate section because the two are different claims.
 *
 * Flattened to one row per drug, newest procedure first, each row carrying the
 * case it belongs to — 2 mg of midazolam means nothing without it.
 */
export function administeredMedicationsFor(mrn) {
  const cases = ADMINISTERED_MEDICATIONS[mrn] || [];

  return [...cases]
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((entry) =>
      entry.meds.map((med, index) => ({
        id: `med-adm-${entry.date}-${index}`,
        name: med.name,
        dose: med.dose,
        route: med.route,
        category: med.category,
        time: med.time,
        date: entry.date,
        procedure: entry.procedure,
        location: entry.location,
        by: entry.by,
      }))
    );
}

/* ============================================================================
   ADDING A MEDICATION

   The form vocabulary below is exactly that — vocabulary, not patient data, so
   it does not break this file's rule about seeding a third list. What it is
   NOT allowed to invent is the drug or the box it comes out of: both are read
   from the practice's own inventory, so a medication added to a chart is one
   the practice actually stocks and a lot is one that is actually on the shelf.
   ========================================================================= */

export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'mL', 'IU', 'tablet', 'capsule', 'puff', 'drop', 'patch'];

export const MEDICATION_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Weekly',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'As needed (PRN)',
];

/** Everything the practice is set up to stock, for the Medication picker. */
export const DISPENSABLE_MEDICATIONS = MEDICATIONS.map((med) => ({
  value: med.id,
  label: med.name,
}));

/**
 * The lots of one medication that may actually be given, soonest-expiring
 * first.
 *
 * Expired boxes and empty ones are left out rather than shown greyed: this
 * list is the answer to "which box do I open", and an option that must not be
 * chosen has no business being choosable. First-expired-first-out is the order
 * a nurse works in, so it is the order they are offered in.
 */
export function dispensableLotsFor(medicationId) {
  return STOCK_ENTRIES.filter(
    (entry) => entry.medicationId === medicationId && entry.quantity > 0 && !isExpired(entry)
  ).sort((a, b) => a.expiry.localeCompare(b.expiry));
}

/** "LOT-MET-22 · 180 left · expires in 264 days" — enough to choose between. */
export function lotLabel(entry) {
  const days = daysUntil(entry.expiry);
  return `${entry.lot} · ${entry.quantity} left · expires in ${days} day${days === 1 ? '' : 's'}`;
}
