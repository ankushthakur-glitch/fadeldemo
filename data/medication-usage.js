/**
 * DEMO DATA — procedure medication usage. Every patient, dose and lot invented.
 *
 * WHAT THIS IS FOR
 *
 * An endoscopy list runs on drugs that come off a trolley: midazolam and
 * fentanyl at induction, propofol to hold the patient there, ondansetron on
 * the way out, and — twice a year — a reversal agent nobody wanted to reach
 * for. Before this file those two facts lived in different halves of the
 * system and never met:
 *
 *   the CHART knew Marcus Adeyemi had 2 mg of midazolam at 08:04
 *   the SHELF knew there were 100 ampoules in LOT-MID-88
 *
 * and nothing joined them, so "how much did today's list use", "which lot did
 * that dose come out of" and "will we get through tomorrow" had no answer.
 * This is that join: one row per administration, carrying both the clinical
 * dose and the stock it came out of.
 *
 * THE TWO QUANTITIES, AND WHY THERE ARE TWO
 *
 * A sedation record is written in milligrams and a shelf is counted in
 * ampoules. They are not convertible without knowing the presentation, and
 * pretending they are is how an inventory quietly goes wrong:
 *
 *   units  what left the shelf      1 ampoule     drawn from LOT-MID-88
 *   dose   what reached the patient 2 mg          charted against the case
 *
 * Stock moves on `units` and only on `units`. `dose` is the clinical fact and
 * never touches a count. A 5 mg ampoule giving a 2 mg dose still costs the
 * shelf a whole ampoule — the rest goes down the sink, which is what `wasted`
 * records.
 *
 * WASTE IS PART OF THE UNIT ALREADY COUNTED
 *
 * `wasted` is the part of a drawn unit that did not reach the patient. It is
 * NOT a second deduction: the ampoule was already spent when it was opened.
 * Recording it separately is the point — a list that routinely opens 5 mg
 * ampoules to give 2 mg is a list that should be buying 2 mg ampoules, and
 * that is invisible if the discard is folded into the dose.
 */
import {
  MEDICATIONS, STOCK_ENTRIES, PROCEDURE_MEDICATIONS, TODAY,
  medicationById,
} from './medication-inventory.js';

/* ============================================================================
   THE PEOPLE

   Endoscopists from the same three the rest of the prototype uses. The people
   who actually push the drug are a separate list: in an ASC the sedation is
   given by the anaesthesia provider or the circulating nurse, not by the
   endoscopist whose hands are on the scope. A report that credited the
   proceduralist with every dose would be a report nobody could sign.
   ========================================================================= */

export const USAGE_PROVIDERS = [
  'Dr. Amara Mensah',
  'Dr. Luca Bianchi',
  'Dr. Sana Nakamura',
];

export const USAGE_ADMINISTERED_BY = [
  'M. Osei, CRNA',
  'K. Brandt, RN',
  'Robert Fox',
];

/** Patients from data/patients.js — the same roster and the same MRNs. */
const USAGE_PATIENTS = [
  { name: 'Priya Raman', mrn: '884120' },
  { name: 'Daniel Okafor', mrn: '773901' },
  { name: 'Margaret Whitfield', mrn: '910233' },
  { name: 'Tomás Herrera', mrn: '660418' },
  { name: 'Aisha Bello', mrn: '552207' },
  { name: 'Henryk Duszynski', mrn: '431885' },
  { name: 'Fatima Al-Rashid', mrn: '328874' },
  { name: 'Callum Fraser', mrn: '295116' },
  { name: 'Ingrid Solberg', mrn: '204471' },
  { name: 'Marcus Webb', mrn: '187629' },
  { name: 'Yuki Tanaka', mrn: '156390' },
  { name: 'Rosa Delgado', mrn: '142857' },
];

/** The procedures a MediNova list is made of, from data/schedule.js. */
const USAGE_PROCEDURES = [
  'Colonoscopy',
  'EGD',
  'Sigmoidoscopy',
  'ERCP',
  'EUS',
];

/* ============================================================================
   THE RECIPE

   What one case of each procedure takes off the trolley. Written as a recipe
   rather than typed out per case because a colonoscopy is a colonoscopy: the
   variation between two of them is the patient's weight and how they settle,
   not a different set of drugs. `vary` is how much the propofol moves with
   that — the one dose on the list that genuinely does.

   Doses are in the ranges SEDATION_ORDER_MEDICATIONS already documents on the
   procedure encounter, so a reviewer reading both sees one practice rather
   than two that happen to share a drug name.
   ========================================================================= */

const RECIPES = {
  Colonoscopy: [
    { medicationId: 'med-mid', units: 1, dose: 2, unitOfDose: 'mg', at: 0 },
    { medicationId: 'med-fen', units: 1, dose: 50, unitOfDose: 'mcg', at: 1 },
    { medicationId: 'med-pro', units: 1, dose: 60, unitOfDose: 'mg', at: 5, vary: 40 },
  ],
  EGD: [
    { medicationId: 'med-lid', units: 0, dose: 4, unitOfDose: 'spray', at: 0, shared: true },
    { medicationId: 'med-mid', units: 1, dose: 3, unitOfDose: 'mg', at: 1 },
    { medicationId: 'med-fen', units: 1, dose: 50, unitOfDose: 'mcg', at: 2 },
    { medicationId: 'med-pro', units: 1, dose: 40, unitOfDose: 'mg', at: 6, vary: 30 },
  ],
  Sigmoidoscopy: [
    { medicationId: 'med-mid', units: 1, dose: 2, unitOfDose: 'mg', at: 0 },
    { medicationId: 'med-fen', units: 1, dose: 25, unitOfDose: 'mcg', at: 1 },
  ],
  ERCP: [
    { medicationId: 'med-mid', units: 1, dose: 3, unitOfDose: 'mg', at: 0 },
    { medicationId: 'med-fen', units: 2, dose: 100, unitOfDose: 'mcg', at: 2 },
    { medicationId: 'med-pro', units: 2, dose: 140, unitOfDose: 'mg', at: 6, vary: 60 },
    { medicationId: 'med-ond', units: 1, dose: 4, unitOfDose: 'mg', at: 40 },
  ],
  EUS: [
    { medicationId: 'med-mid', units: 1, dose: 2, unitOfDose: 'mg', at: 0 },
    { medicationId: 'med-fen', units: 1, dose: 50, unitOfDose: 'mcg', at: 1 },
    { medicationId: 'med-pro', units: 1, dose: 80, unitOfDose: 'mg', at: 5, vary: 40 },
    { medicationId: 'med-ond', units: 1, dose: 4, unitOfDose: 'mg', at: 35 },
  ],
};

/**
 * The lidocaine bottle.
 *
 * `shared: true` means a dose was given but nothing came off the shelf for it:
 * a throat spray is used across a whole list and the bottle is written off
 * when it runs out, not per patient. The row still appears — the patient DID
 * receive it and a medication record that omits it is wrong — and it draws
 * zero units, which is why `units` and `dose` had to be separate fields
 * rather than one number wearing two hats.
 *
 * The bottle itself is drawn once a day by the nurse who opens it.
 */
const DAILY_DRAW = { medicationId: 'med-lid', units: 1, note: 'Opened for the list' };

/* ============================================================================
   THE LIST

   Deterministic: no Math.random(), so a reviewer reloading sees the same day.
   Cases run on weekdays only — an ASC list does not sit on a Sunday, and a
   report whose busiest day is a Saturday is one nobody believes.
   ========================================================================= */

const at = (list, i) => list[i % list.length];

/** Days of list, ending on the fixture's today. */
const USAGE_DAYS = 12;

/** Cases per day, cycled. A light day and a heavy day read as a real diary. */
const CASES_PER_DAY = [6, 8, 5, 7, 9, 6, 4, 8];

/** First case on the table, and the gap between them. */
const LIST_START_MINUTES = 7 * 60 + 30;
const CASE_GAP_MINUTES = 50;

/**
 * N days before an ISO date, still as an ISO date.
 *
 * Formatted from the LOCAL parts rather than through toISOString(). The date
 * is constructed at local midnight, and toISOString() converts that to UTC —
 * so anywhere east of Greenwich local midnight is the previous day in UTC and
 * every date in this file came out a day early. The fixture's today then had
 * no rows at all, which is the one day the report opens on.
 */
function isoDaysBefore(iso, days) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const isWeekend = (iso) => [0, 6].includes(new Date(`${iso}T00:00:00`).getDay());

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Which lot a draw comes out of — first expired, first out.
 *
 * The same rule the medication list already uses to name the "next" lot, so
 * the box the detail screen tells a nurse to open is the box the usage report
 * says the dose came from. Two different answers to "which box" would make one
 * of the two screens a liar.
 *
 * Lots are consumed in order and the running counter is carried across the
 * whole log, so a lot genuinely runs out and the next one starts being drawn.
 */
function lotPicker(entries) {
  /* `quantity` is already the current count — the receipt-damage write-off in
     a lot's waste log came off it when the box was booked in. Subtracting
     wastedTotal here would take it off twice, and the report's closing balance
     would then sit below the shelf by exactly the damaged units. */
  const remaining = new Map(entries.map((e) => [e.id, e.quantity]));

  return (medicationId, units) => {
    const usable = entries
      .filter((e) => e.medicationId === medicationId && (remaining.get(e.id) ?? 0) > 0)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));

    const lot = usable[0] ?? entries.find((e) => e.medicationId === medicationId) ?? null;
    if (lot && units > 0) remaining.set(lot.id, (remaining.get(lot.id) ?? 0) - units);
    return lot;
  };
}

/**
 * A part-dose discard, where the presentation forces one.
 *
 * A 5 mg midazolam ampoule giving 2 mg leaves 3 mg in the barrel. That is the
 * commonest waste in an endoscopy suite and the one worth surfacing, so it is
 * computed from the ampoule rather than sprinkled about: every row that draws
 * a whole unit and gives less than it holds reports the difference.
 *
 * Exported because js/lib/medication-ledger.js has to do the same sum on a
 * dose typed at the head of the bed. Two copies of "a midazolam ampoule holds
 * 5 mg" is how the fixture report and a live administration come to disagree
 * about what a 2 mg push discards, which is precisely the number both exist to
 * surface.
 */
export const AMPOULE_CONTENT = {
  'med-mid': { amount: 5, unit: 'mg' },
  'med-fen': { amount: 100, unit: 'mcg' },
  'med-pro': { amount: 200, unit: 'mg' },
  'med-ond': { amount: 4, unit: 'mg' },
  'med-flu': { amount: 0.5, unit: 'mg' },
  'med-nal': { amount: 0.4, unit: 'mg' },
};

function discard(medicationId, units, dose) {
  const held = AMPOULE_CONTENT[medicationId];
  if (!held || units <= 0) return 0;
  const drawn = held.amount * units;
  return Number((drawn - dose).toFixed(2)) > 0 ? Number((drawn - dose).toFixed(2)) : 0;
}

function buildUsage() {
  const entries = STOCK_ENTRIES.map((e) => ({ ...e }));
  const pickLot = lotPicker(entries);
  const rows = [];

  let caseNumber = 0;
  let n = 0;

  /* Oldest day first, so the lot picker consumes in chronological order and a
     lot that runs out does so on the day it actually ran out. */
  for (let back = USAGE_DAYS - 1; back >= 0; back -= 1) {
    const date = isoDaysBefore(TODAY, back);
    if (isWeekend(date)) continue;

    /* The nurse opens a throat-spray bottle for the day's list. One draw, one
       row, before the first case. */
    const bottle = pickLot(DAILY_DRAW.medicationId, DAILY_DRAW.units);
    rows.push({
      id: `use-${date}-open`,
      date,
      time: hhmm(LIST_START_MINUTES - 20),
      medicationId: DAILY_DRAW.medicationId,
      lotId: bottle?.id ?? null,
      patient: '',
      mrn: '',
      procedure: '',
      provider: '',
      administeredBy: at(USAGE_ADMINISTERED_BY, n),
      units: DAILY_DRAW.units,
      dose: null,
      doseUnit: '',
      wasted: 0,
      wasteUnit: '',
      note: DAILY_DRAW.note,
    });
    n += 1;

    const caseCount = at(CASES_PER_DAY, back);
    for (let c = 0; c < caseCount; c += 1, caseNumber += 1) {
      const patient = at(USAGE_PATIENTS, caseNumber * 5);
      const procedure = at(USAGE_PROCEDURES, caseNumber * 3);
      const provider = at(USAGE_PROVIDERS, caseNumber);
      const administeredBy = at(USAGE_ADMINISTERED_BY, caseNumber * 2);
      const start = LIST_START_MINUTES + c * CASE_GAP_MINUTES;

      RECIPES[procedure].forEach((step, s) => {
        /* Propofol moves with the patient; everything else is a fixed push. */
        const dose = step.vary
          ? step.dose + (((caseNumber * 7 + s) % 3) - 1) * (step.vary / 2)
          : step.dose;
        const lot = step.units > 0 ? pickLot(step.medicationId, step.units) : null;

        rows.push({
          id: `use-${date}-${caseNumber}-${s}`,
          date,
          time: hhmm(start + step.at),
          medicationId: step.medicationId,
          lotId: lot?.id ?? null,
          patient: patient.name,
          mrn: patient.mrn,
          procedure,
          provider,
          administeredBy,
          units: step.units,
          dose,
          doseUnit: step.unitOfDose,
          wasted: discard(step.medicationId, step.units, dose),
          wasteUnit: AMPOULE_CONTENT[step.medicationId]?.unit ?? '',
          note: step.shared ? 'From the list bottle' : '',
        });
        n += 1;
      });

      /* One reversal on the whole twelve days. Flumazenil is the entry every
         auditor goes looking for and the report has to be able to show one —
         but a list where reversals are common is a list with a sedation
         problem, so there is exactly one. */
      if (caseNumber === 17) {
        const lot = pickLot('med-flu', 1);
        rows.push({
          id: `use-${date}-${caseNumber}-rev`,
          date,
          time: hhmm(start + 18),
          medicationId: 'med-flu',
          lotId: lot?.id ?? null,
          patient: patient.name,
          mrn: patient.mrn,
          procedure,
          provider,
          administeredBy,
          units: 1,
          dose: 0.2,
          doseUnit: 'mg',
          wasted: discard('med-flu', 1, 0.2),
          wasteUnit: 'mg',
          note: 'Sedation reversed — complication recorded',
          reversal: true,
        });
        n += 1;
      }
    }
  }

  /* Newest first: a daily report is read from the top of today. */
  return rows.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export const PROCEDURE_USAGE = buildUsage();

/* ============================================================================
   THE JOIN BACK TO THE SHELF
   ========================================================================= */

/**
 * Stock, with procedure use drawn out of it.
 *
 * The lots in data/medication-inventory.js carry what was booked in. This
 * subtracts every unit the list has since taken, so Medication Management
 * shows what is actually there rather than what arrived — and the two tabs
 * cannot disagree, because one is computed from the other.
 */
export function applyUsage(entries = STOCK_ENTRIES, usage = PROCEDURE_USAGE) {
  const drawn = new Map();
  usage.forEach((row) => {
    if (row.lotId && row.units > 0) {
      drawn.set(row.lotId, (drawn.get(row.lotId) ?? 0) + row.units);
    }
  });

  return entries.map((entry) => {
    const used = drawn.get(entry.id) ?? 0;
    if (!used) return { ...entry };
    return { ...entry, quantity: Math.max(0, entry.quantity - used), used };
  });
}

/**
 * The running balance behind each usage row.
 *
 * "Remaining Stock" is answered as at THAT administration, not as of now: a
 * row from last Tuesday reporting today's shelf count tells you nothing, and
 * the same number repeated down a column is not a fact anybody can reconcile.
 *
 * Computed by walking each medication forward from what it held before the
 * log starts, so the last row of every medication lands exactly on the count
 * Medication Management shows. That equality is the whole point: it is what
 * lets somebody take a day's report to the shelf and find the discrepancy.
 *
 * Returns a Map of usage id → balance after that row.
 */
export function runningBalances(usage = PROCEDURE_USAGE, entries = STOCK_ENTRIES) {
  const opening = new Map();
  MEDICATIONS.forEach((medication) => {
    /* Straight `quantity`, for the reason lotPicker gives: it is the current
       count already, not a received figure waiting to have waste taken off. */
    const held = entries
      .filter((e) => e.medicationId === medication.id)
      .reduce((sum, e) => sum + Math.max(0, e.quantity), 0);
    opening.set(medication.id, held);
  });

  const balances = new Map();
  const running = new Map(opening);

  /* Oldest first — the log is stored newest-first for reading. */
  [...usage]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .forEach((row) => {
      const left = (running.get(row.medicationId) ?? 0) - row.units;
      running.set(row.medicationId, left);
      balances.set(row.id, left);
    });

  return balances;
}

/** Formatted as the report prints it — "2 mg", "50 mcg", "4 spray". */
export function doseLabel(row) {
  if (row.dose == null) return '—';
  return `${row.dose} ${row.doseUnit}`.trim();
}

/** "1 ampoule" / "2 vials" — the stock side of the same administration. */
export function unitsLabel(row) {
  const medication = medicationById(row.medicationId);
  const noun = medication?.unit ?? 'unit';
  if (row.units === 0) return 'None drawn';
  return `${row.units} ${noun}${row.units === 1 ? '' : 's'}`;
}

/** The trolley, for the report's medication filter. */
export const USAGE_MEDICATIONS = PROCEDURE_MEDICATIONS;
