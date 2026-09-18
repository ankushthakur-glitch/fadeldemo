/**
 * THE LEDGER — where an administration and a wastage go so the shelf hears
 * about them.
 *
 * Two files already knew half of this and neither could see the other half.
 * data/medication-usage.js joins a dose to a lot for the twelve days of
 * FIXTURE list that ships with the prototype: it is a log somebody wrote out,
 * and nothing running in the browser can add a row to it. The encounter's own
 * administration log (js/lib/encounter-logs.js) is the opposite — everything
 * in it is typed live, at the head of the bed, and its own import comment said
 * so out loud: "nothing here writes back to stock control, which keeps its own
 * counts."
 *
 * That was the gap. A nurse could push 2 mg of midazolam on the intra-
 * procedure step, walk to Settings ▸ Inventory, and find a shelf that had
 * never heard of it — the same disconnect between the chart and the shelf that
 * data/medication-usage.js was written to close, reopened at the one place
 * where the drug actually leaves the trolley.
 *
 * So this file is the third thing: a small, session-scoped log of movements
 * recorded DURING a click-through, in exactly the shape data/medication-usage.js
 * writes its own twelve days of list in. The encounter posts to it; the
 * inventory screen reads it and folds it into the fixture, so the shelf the
 * register reports is the shelf the lists have left. Neither imports the other.
 *
 * TWO KINDS OF MOVEMENT, AND WHY THEY ARE ONE LIST
 *
 *   given    a drug reached a patient. Units come off a lot; the part of the
 *            ampoule that did not reach them is the discard.
 *   wasted   a drug did not reach anybody. A dropped ampoule, a broken vial, a
 *            syringe drawn up for a case that was cancelled. Units come off a
 *            lot and no dose is charted, because there was none.
 *
 * They are one list because they are one question — "what happened to that
 * box" — and because a reconciliation that has to read two logs and add them
 * up is a reconciliation nobody does twice. The `kind` field is what tells
 * them apart, and it is the only field either has that the other does not use.
 *
 * WHY sessionStorage
 *
 * The same reasoning js/lib/pre-check-form.js gives for its own defaults: a
 * reviewer clicking through several screens should find their own entry still
 * there, and a reviewer opening the prototype fresh tomorrow should find the
 * fixture shelf rather than a shelf that has been quietly drained by six
 * months of demos. A session is the natural unit — the tab is the visit.
 */
import {
  MEDICATIONS,
  STOCK_ENTRIES,
  isExpired,
  TODAY,
} from '../../data/medication-inventory.js';
/* The presentation each trolley drug comes in, and the twelve days of fixture
   list that have already come off the shelf. AMPOULE_CONTENT is read here for
   the same sum the report does — two copies of "a midazolam ampoule holds
   5 mg" is how the report and the encounter come to disagree about what a 2 mg
   dose discards — and applyUsage is what makes currentShelf() below the count
   in the room rather than the count on the delivery note. */
import { AMPOULE_CONTENT, applyUsage } from '../../data/medication-usage.js';

const KEY = 'medinova.medication-ledger';

/* ============================================================================
   READING AND WRITING THE LOG
   ========================================================================= */

/**
 * Everything recorded this session, oldest first.
 *
 * Oldest first because that is the order a running balance has to be walked
 * in; the report sorts it back to newest-first for reading. Anything that
 * cannot be parsed is dropped rather than thrown — a hand-edited or
 * half-written storage key should cost a demo its ledger, not the screen.
 */
export function ledgerMovements() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(movements) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(movements));
  } catch {
    /* Private browsing, or a full quota. The movement is lost and the screen
       is not, which is the right way round for a prototype. */
  }
}

/** For a reviewer who wants the fixture shelf back without closing the tab. */
export function clearLedger() {
  write([]);
}

/* ============================================================================
   JOINING WHAT WAS TYPED TO WHAT IS ON THE SHELF
   ========================================================================= */

/**
 * The drug named at the bedside → the drug on the shelf.
 *
 * They are not the same string and never will be. A nurse charts "Midazolam";
 * the catalogue holds "Midazolam 5 mg/5 mL Ampoule", because the shelf has to
 * know the pack size and the chart does not. The join is the same narrowest-
 * true one the encounter's formulary prefill already uses — a catalogue entry
 * belongs to a charted drug when the shelf's name STARTS WITH what was typed —
 * so the two agree by construction rather than by two people remembering the
 * same rule.
 *
 * A drug the practice does not stock returns null, and the caller records the
 * administration without a stock movement. That is the honest outcome: the
 * dose happened and the shelf genuinely has no box to take it off.
 */
export function medicationForName(name) {
  const typed = String(name ?? '').trim().toLowerCase();
  if (!typed) return null;
  return (
    MEDICATIONS.find((med) => med.name.toLowerCase() === typed) ??
    MEDICATIONS.find((med) => med.name.toLowerCase().startsWith(typed)) ??
    null
  );
}

/**
 * The shelf as it stands: booked in, less the lists that have run, less
 * everything recorded this session.
 *
 * The one definition of "what is actually there", and the reason it is here
 * rather than on the screen that draws it. Picking a lot to draw from is a
 * question about the CURRENT count, and the first version of nextLotFor asked
 * it of STOCK_ENTRIES — what arrived. That is a different number by twelve
 * days of list, and where the fixture had already emptied a lot it named a box
 * with nothing in it: the movement pointed at an empty lot, the deduction
 * clamped at zero, and the units quietly failed to come off the shelf at all.
 */
export const currentShelf = (entries = STOCK_ENTRIES) => applyLedger(applyUsage(entries));

/**
 * Which box this comes out of — first expired, first out.
 *
 * The same rule `summarise()` uses to name the "next" lot on the medication
 * list and the same rule the fixture's own lot picker follows. Three different
 * answers to "which box" would make two of the three screens a liar, and the
 * one a recall reads is this one.
 *
 * Expired lots are not offered. There may be boxes on that shelf and they may
 * not be given, which is the single mistake an inventory screen must not make.
 */
export function nextLotFor(medicationId, entries = currentShelf(), today = TODAY) {
  return (
    entries
      .filter((e) => e.medicationId === medicationId && e.quantity > 0 && !isExpired(e, today))
      .sort((a, b) => a.expiry.localeCompare(b.expiry))[0] ?? null
  );
}

/**
 * What a draw actually costs, given what is in the box it is coming out of.
 *
 * A push wants a number of units and the lot has however many it has. They are
 * the same number almost always — a dose is one or two ampoules and a lot
 * holds fifty — and the exception is the last box on the shelf, which is
 * exactly when getting it wrong matters.
 *
 * Capped rather than split across lots. Splitting is what a real stock system
 * does and it would need a second lot id on the movement, a second row on the
 * report and a rule for which of the two the recall column names; capping
 * keeps the ledger and the shelf in exact agreement, which is the property
 * every screen here is read for. The remainder is not silently dropped — it
 * simply was not there to draw, and the count says so.
 */
const drawable = (lot, units) => (lot ? Math.min(units, lot.quantity) : 0);

/* ============================================================================
   THE TWO QUANTITIES

   Stated at length in data/medication-usage.js and true again here: a sedation
   record is written in milligrams and a shelf is counted in ampoules, and
   pretending they are one number is how an inventory quietly goes wrong.
   ========================================================================= */

/** "2 mg" → { amount: 2, unit: 'mg' }. Anything unparseable → null. */
export function parseAmount(text) {
  const match = String(text ?? '').trim().match(/^([\d.]+)\s*(\D.*)?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return { amount, unit: (match[2] ?? '').trim() };
}

/**
 * How many units a dose costs the shelf.
 *
 * At least one, always: an ampoule opened for 2 mg is an ampoule gone, and a
 * shelf that counted it as 0.4 would be a shelf that never runs out. More than
 * one when the dose exceeds what a single unit holds — 140 mg of propofol out
 * of 200 mg vials is one vial, 240 mg is two.
 *
 * A drug whose presentation is not on file draws one unit, which is the
 * commonest truth and the only guess available.
 */
function unitsForDose(medicationId, dose) {
  const held = AMPOULE_CONTENT[medicationId];
  if (!held || !dose || dose.unit !== held.unit) return 1;
  return Math.max(1, Math.ceil(dose.amount / held.amount));
}

/**
 * What went down the sink, when nobody typed it.
 *
 * The remainder of the units drawn after the dose came out of them. Computed
 * rather than assumed zero, because the whole reason waste is a separate
 * figure is that a list routinely opening 5 mg ampoules to give 2 mg is a list
 * that should be buying 2 mg ampoules — and that is invisible if the discard
 * is folded into the dose or left blank.
 *
 * A typed waste always wins over this. The point of a record is that the
 * things in it were observed, and somebody at the bedside writing "3 mg" has
 * observed something this arithmetic is only inferring.
 */
function discardFor(medicationId, units, dose) {
  const held = AMPOULE_CONTENT[medicationId];
  if (!held || !dose || dose.unit !== held.unit) return null;
  const left = Number((held.amount * units - dose.amount).toFixed(2));
  return left > 0 ? { amount: left, unit: held.unit } : null;
}

/* ============================================================================
   RECORDING

   Both writers build the SAME row shape the fixture list is written in (see
   PROCEDURE_USAGE in data/medication-usage.js). That is deliberate: the shelf
   is drawn down by one subtraction over one kind of row rather than by two
   that can disagree, so what the register reports is the same figure whether a
   dose came out of the fixture or out of a case charted five minutes ago.
   ========================================================================= */

/** Today, as the fixture counts it, so a live row files beside the fixture's. */
const stamp = () => TODAY;

let sequence = 0;
const nextId = (kind) => `led-${kind}-${Date.now().toString(36)}-${(sequence += 1)}`;

function push(movement) {
  const movements = ledgerMovements();
  movements.push(movement);
  write(movements);
  return movement;
}

/**
 * A drug reached a patient.
 *
 * `patient`, `mrn`, `procedure` and `provider` say who it reached and what was
 * being done to them. The encounter knows all four and the log row asks for
 * none of them, which is right: a nurse mid-case should not be retyping the
 * patient they are standing over, and a typed copy is one more thing that can
 * come to disagree with the header above it.
 */
export function recordAdministration({
  name, dose: doseText, waste: wasteText, reason: wasteReason, time, by, witness,
  patient = '', mrn = '', procedure = '', provider = '', note = '',
} = {}) {
  const medication = medicationForName(name);
  const dose = parseAmount(doseText);

  /* A drug the practice does not stock still produces a row — the patient DID
     receive it and a medication record that omits it is wrong — and it draws
     nothing, because there is no box to draw from. Same handling the fixture
     gives its shared throat-spray bottle, and the same reason `units` and
     `dose` had to be separate fields rather than one number wearing two hats. */
  const wanted = medication ? unitsForDose(medication.id, dose) : 0;
  const lot = medication ? nextLotFor(medication.id) : null;
  const units = drawable(lot, wanted);

  /* The discard is measured against what was DRAWN UP, not against what the
     shelf could supply. Those differ only on the last box — and there the
     clinical fact is still that a whole ampoule was opened for a part dose.
     Computing it from the capped figure would report a short lot as a case
     that happened to waste nothing, which is the opposite of true. */
  const typedWaste = parseAmount(wasteText);
  const waste = typedWaste ?? (medication ? discardFor(medication.id, wanted, dose) : null);

  return push({
    id: nextId('given'),
    kind: 'given',
    date: stamp(),
    time: time || '',
    medicationId: medication?.id ?? null,
    medicationName: medication?.name ?? String(name ?? '').trim(),
    lotId: lot?.id ?? null,
    patient,
    mrn,
    procedure,
    provider,
    administeredBy: by || '',
    witness: witness && witness !== '—' ? witness : '',
    units,
    dose: dose?.amount ?? null,
    doseUnit: dose?.unit ?? '',
    wasted: waste?.amount ?? 0,
    wasteUnit: waste?.unit ?? '',
    /* The reason, where somebody gave one. A discard the ledger worked out for
       itself is a part dose by definition and needs no asking; a discard TYPED
       against a witness on the administration form was asked, and the answer is
       not always "part-dose discarded" — an ampoule can be dropped between the
       drawer and the patient, and a register that files that under the default
       has lost the only fact that made it worth recording. */
    reason: waste ? wasteReason || 'Part-dose discarded' : '',
    note: note || (medication ? '' : 'Not in the practice catalogue — no stock drawn'),
  });
}

/**
 * A drug reached nobody.
 *
 * The dropped ampoule, the broken vial, the syringe drawn up for a case that
 * was cancelled on the table. This is NOT the part-dose discard above — that
 * one belongs to an administration that happened and is recorded on it. This
 * is stock destroyed on its own, which is why it is a separate entry point and
 * a separate button rather than an administration with an empty dose: an
 * administration with an empty dose is a record of nothing, and it would sit
 * on the MAR next to five real ones.
 *
 * `units` is what came off the shelf and `amount` is what was in them. Both,
 * for the reason the two-quantities note gives — one ampoule is the shelf's
 * fact and 5 mg is the reconciliation's, and a controlled-drug register that
 * cannot state the second is a register nobody can sign.
 */
export function recordWastage({
  name, units: unitsText, amount: amountText, reason, witness, time, by,
  patient = '', mrn = '', procedure = '', provider = '', note = '',
} = {}) {
  const medication = medicationForName(name);
  const wanted = Math.max(0, Math.round(Number(unitsText) || 0));
  const lot = medication ? nextLotFor(medication.id) : null;
  const units = drawable(lot, wanted);

  /* What was in them, if nobody said. A whole ampoule wasted is the whole
     ampoule's content — the one sum that needs no observing. */
  const held = medication ? AMPOULE_CONTENT[medication.id] : null;
  const amount =
    parseAmount(amountText) ??
    (held && wanted ? { amount: Number((held.amount * wanted).toFixed(2)), unit: held.unit } : null);

  return push({
    id: nextId('wasted'),
    kind: 'wasted',
    date: stamp(),
    time: time || '',
    medicationId: medication?.id ?? null,
    medicationName: medication?.name ?? String(name ?? '').trim(),
    lotId: lot?.id ?? null,
    patient,
    mrn,
    procedure,
    provider,
    administeredBy: by || '',
    witness: witness && witness !== '—' ? witness : '',
    units,
    /* No dose. Nothing reached a patient, and a zero here would read as
       "0 mg given" on a report where every other row means it. */
    dose: null,
    doseUnit: '',
    wasted: amount?.amount ?? 0,
    wasteUnit: amount?.unit ?? '',
    reason: reason || 'Wasted',
    note: note || (medication ? '' : 'Not in the practice catalogue — no stock drawn'),
  });
}

/* ============================================================================
   FOLDING THE LEDGER BACK INTO THE SHELF
   ========================================================================= */

/*
 * ledgerUsage() STOOD HERE, AND WENT WITH THE REPORT IT FED.
 *
 * It was every movement the catalogue recognised, given and wasted alike, in
 * the shape the Daily Usage table drew a row from. That table is the Daily
 * Count Sheet now — a document counted at the drawer rather than a report
 * assembled from the record — and nothing reads a flat list of movements any
 * more. What the ledger still does, and the only thing this screen needs of
 * it, is draw the shelf down: see applyLedger below.
 */

/**
 * Stock, with this session's movements drawn out of it.
 *
 * The companion to applyUsage() in data/medication-usage.js and applied AFTER
 * it: that one subtracts the twelve days of fixture list, this one subtracts
 * what the reviewer has just recorded. Composed rather than merged so each
 * stays readable on its own; currentShelf() above is that composition, and it
 * is the one thing anybody outside this file should be calling.
 *
 * A wastage movement does two things here and an administration does one, and
 * the difference is worth stating because it is the thing easiest to get
 * wrong. Both take units off `quantity`. Only the wastage ALSO appends to the
 * lot's `waste` log — that log is what an audit reads, and a part-dose discard
 * on an administration does not belong in it: the ampoule was already spent
 * when it was opened, so counting the discard there would deduct the same
 * ampoule twice and report a shelf below the one in the room.
 */
export function applyLedger(entries, movements = ledgerMovements()) {
  if (!movements.length) return entries;

  const drawn = new Map();
  const logged = new Map();

  movements.forEach((movement) => {
    if (!movement.lotId || movement.units <= 0) return;
    drawn.set(movement.lotId, (drawn.get(movement.lotId) ?? 0) + movement.units);
    if (movement.kind !== 'wasted') return;
    if (!logged.has(movement.lotId)) logged.set(movement.lotId, []);
    logged.get(movement.lotId).push({
      quantity: movement.units,
      reason: movement.reason,
      by: movement.administeredBy || movement.witness || 'Recorded at the bedside',
      on: movement.date,
    });
  });

  return entries.map((entry) => {
    const used = drawn.get(entry.id) ?? 0;
    const waste = logged.get(entry.id);
    if (!used && !waste) return entry;
    return {
      ...entry,
      quantity: Math.max(0, entry.quantity - used),
      ...(waste ? { waste: [...(entry.waste ?? []), ...waste] } : {}),
    };
  });
}
