/**
 * VISIT NOTES — the note register behind the Scheduler's Visit Note tab.
 *
 * DERIVED FROM THE BOOKINGS, NOT KEPT BESIDE THEM
 * A visit note is not a record of its own in this prototype: it belongs to the
 * appointment it documents. So the worklist is derived from the one copy of
 * the bookings (data/appointment-store.js) rather than held in a second list
 * that would drift out of step with it. Check a patient out on the Appointment
 * tab and their note is owed on the Visit Note tab immediately; lock an
 * encounter in encounter.js — which sets `encounterLocked` on the booking —
 * and it reads as Signed here without anything having to be told.
 *
 * WHAT COUNTS AS A NOTE
 * A note exists once the clinic has the patient: checked in, in triage, or
 * checked out. Past bookings that were never advanced count too — a visit
 * whose date has gone by and that nobody cancelled is exactly the case an
 * unsigned-notes worklist exists to catch. Cancelled, rescheduled and
 * unconfirmed bookings never had a visit, so they never owe a note.
 *
 * All names, dates and states below are invented. No real patient information.
 */

/**
 * The three states a note can be in, and what the row offers to do about it.
 *
 * `action` is the verb on the row: an unsigned note is opened and finished by
 * its own author; a co-sign note is already written and wants the supervising
 * provider to read it before adding their name; a signed note is read-only.
 */
export const NOTE_STATES = {
  unsigned: {
    label: 'Unsigned',
    tone: 'neutral',
    action: 'Open Encounter',
    icon: 'stethoscope',
    signed: false,
  },
  'co-sign': {
    label: 'Co-Sign',
    tone: 'info',
    action: 'Review & Sign',
    icon: 'eye',
    signed: false,
  },
  signed: {
    label: 'Signed',
    tone: 'success',
    action: 'View Note',
    icon: 'document',
    signed: true,
  },
};

/**
 * The seeded state of the notes for the demo bookings.
 *
 * EMPTY ON PURPOSE. Every booking now opens Unsigned — the state a booking made
 * in the prototype starts in anyway — so the encounters worklist is one queue
 * with everything in it rather than a demo that arrives half worked through.
 * A reviewer who wants to see the Signed half puts something there by signing
 * it, which is the route a clinician has and the only one that proves the
 * screens behind it work.
 *
 * It stays as a register rather than being deleted, because `noteFor` below is
 * written against it and because the shape is the documentation for seeding a
 * state back. Keyed by appointment id, which is positional in data/schedule.js
 * (`ap1` is the first row of ROWS) — the same join SCOPE_LISTS makes there —
 * and a line names its patient so the table can be read without counting rows,
 * and so a reordering of ROWS shows up as an obviously wrong name rather than
 * a silent mis-mapping:
 *
 *   ap1: { state: 'signed', signedOn: '2026-08-03' },  // Priya Raman
 *   ap3: { state: 'co-sign', draftedBy: 'u4' },        // Henryk Duszynski
 *
 *   signed    filed and closed; `signedOn` is the day it was signed, which is
 *             what the Updated column shows.
 *   co-sign   drafted by a supervised clinician (`draftedBy` is a staff id
 *             from the practice user list — a Nurse Practitioner or Physician
 *             Assistant, both of whom "document and sign under a supervising
 *             physician" per data/practice-roles.js) and waiting on the
 *             provider's countersignature.
 *
 * NOTE_STATES keeps both entries whatever is seeded here: a note signed during
 * a session is 'signed' at runtime, and the worklist has to have a badge and a
 * row action for it.
 */
export const NOTE_REGISTER = {};

/** Bookings that never became a visit, so never a note. */
const NO_VISIT = ['Cancelled', 'Rescheduled', 'No Show', 'Pending Confirmation'];

/** Bookings the clinic has the patient for, whatever the date says. */
const IN_THE_BUILDING = ['Checked In', 'Triage', 'Check Out'];

/**
 * Does this booking owe a note?
 *
 * `today` is passed in rather than read from the clock: the prototype's TODAY
 * is a fixed date (see data/schedule.js) and a worklist that quietly used the
 * real one would empty itself out as the demo data aged.
 */
export function hasVisitNote(appt, today) {
  if (IN_THE_BUILDING.includes(appt.status)) return true;
  return appt.date < today && !NO_VISIT.includes(appt.status);
}

/**
 * Which template the note was written on.
 *
 * The strings are the ones the clinic note's own picker offers
 * (VISIT_NOTE_TITLES in data/visit-note-templates.js), so the column names a
 * template a clinician can actually open rather than a label invented for this
 * table.
 */
export function noteTypeFor(kindId, typeTitle = '') {
  if (kindId === 'procedure') return 'Procedure Follow-up';
  if (kindId === 'infusion') return 'Infusion Visit';
  if (/consultation/i.test(typeTitle)) return 'GI Consultation';
  if (/new patient/i.test(typeTitle)) return 'New Patient';
  return 'SOAP Note';
}

/**
 * The note for one booking: its state, who is waiting on whom, and the day it
 * was last written to.
 *
 * A locked encounter outranks the seed — encounter.js sets `encounterLocked`
 * when the last document is signed, and that is a fact about this session, not
 * a fixture.
 */
export function noteFor(appt) {
  const seeded = NOTE_REGISTER[appt.id];

  /*
   * The note is signed once the note itself is signed.
   *
   * `encounterLocked` is a stronger fact — every document in a procedure
   * visit signed, superbill raised — and it still counts. But the worklist
   * asks "has this note been signed", and a procedure report that has been
   * signed while the post-procedure discharge is still open answers yes to
   * that. Waiting for the lock left signed notes sitting in the Unsigned
   * queue, which is the one thing that queue must not do.
   */
  if (appt.noteSigned || appt.encounterLocked) {
    return {
      state: 'signed',
      updatedOn: seeded?.signedOn ?? appt.date,
      draftedBy: null,
    };
  }

  if (!seeded) return { state: 'unsigned', updatedOn: appt.date, draftedBy: null };

  return {
    state: seeded.state,
    // A note that has not been signed was last touched on the day of the
    // visit; a signed one, on the day it was signed.
    updatedOn: seeded.signedOn ?? appt.date,
    draftedBy: seeded.draftedBy ?? null,
  };
}
