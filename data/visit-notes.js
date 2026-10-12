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
 * SEEDED HALF WORKED THROUGH. This register used to be empty, so every
 * booking opened Unsigned and the Signed half of the Encounters worklist read
 * "No signed notes yet" — a demo of a queue with no history behind it. A clinic
 * on a Tuesday morning has both: yesterday's notes mostly filed, a handful
 * still owed, and a few written by a nurse practitioner or physician assistant
 * waiting on a countersignature. So roughly half the visits that owe a note
 * are seeded Signed, three are seeded Co-Sign, and the rest — including the
 * four charted patients' most recent visits, which their charts' Visit Notes
 * also show as Unsigned — stay Unsigned. Signing one in the session still
 * moves it across, exactly as before.
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
export const NOTE_REGISTER = {
  ap1: { state: 'signed', signedOn: '2026-08-03' }, // 326491 · Coeliac — first assessment
  ap2: { state: 'signed', signedOn: '2026-08-03' }, // 326492 · GORD, poor PPI response
  ap3: { state: 'co-sign', draftedBy: 'u4' }, // 326494 · IBS — dietitian referral discussion
  ap4: { state: 'signed', signedOn: '2026-08-03' }, // 326496 · Post-op review, ileocaecal resection
  ap6: { state: 'signed', signedOn: '2026-08-03' }, // 326502 · Fatty liver — results review
  ap9: { state: 'signed', signedOn: '2026-08-03' }, // 326493 · Ulcerative colitis — flare review
  ap12: { state: 'signed', signedOn: '2026-08-03' }, // 326490 · Infliximab infusion, cycle 6
  ap74: { state: 'signed', signedOn: '2026-07-31' }, // 326502 · Follow-up — gastroparesis
  ap75: { state: 'signed', signedOn: '2026-08-01' }, // 326505 · Anaemia — IBD screen
  ap77: { state: 'signed', signedOn: '2026-08-03' }, // 326500 · Banding follow-up
  ap78: { state: 'co-sign', draftedBy: 'u5' }, // 326504 · Diverticular disease review
  ap81: { state: 'signed', signedOn: '2026-08-03' }, // 326474 · Post-op review, hernia repair
  ap82: { state: 'signed', signedOn: '2026-08-03' }, // 326479 · Cirrhosis surveillance
  ap84: { state: 'co-sign', draftedBy: 'u5' }, // 326475 · LFT recheck
  ap86: { state: 'signed', signedOn: '2026-08-03' }, // 326478 · Coeliac — dietitian handover
  ap197: { state: 'signed', signedOn: '2026-08-03' }, // 326481 Liam Rodriguez · Gastroscopy — gastritis
  ap199: { state: 'signed', signedOn: '2026-08-03' }, // 326495 Zoe Tran · Surveillance colonoscopy
  ap223: { state: 'signed', signedOn: '2026-08-03' }, // 326483 · Post-op review, ileocaecal resection
  ap224: { state: 'signed', signedOn: '2026-08-03' }, // 326485 · Records request — disability claim
  // The charted patients' visit history (the rows appended at the end of
  // ROWS in data/schedule.js) — all filed long ago. ap281 is a no-show and
  // owes no note, so it is not here.
  ap280: { state: 'signed', signedOn: '2025-09-05' }, // 326486 Henna West · GERD and T2DM review
  ap282: { state: 'signed', signedOn: '2025-10-23' }, // 326486 Henna West · Surveillance colonoscopy review
  ap283: { state: 'signed', signedOn: '2025-10-20' }, // 326477 Natali Craig · Hepatology consult
  ap284: { state: 'signed', signedOn: '2026-01-02' }, // 326495 Zoe Tran · Celiac EGD follow-up
  // The rest of that history (ap285 onwards). Those not listed are unsigned.
  ap287: { state: 'signed', signedOn: '2026-05-13' }, // Henna fatty liver
  ap288: { state: 'signed', signedOn: '2026-03-17' }, // Henna dysphagia
  ap289: { state: 'signed', signedOn: '2026-02-11' }, // Henna DM/GERD
  ap291: { state: 'co-sign', draftedBy: 'u5' }, // Natali constipation
  ap292: { state: 'signed', signedOn: '2026-05-27' }, // Natali steatosis
  ap293: { state: 'signed', signedOn: '2026-03-04' }, // Natali IBD steroid
  ap296: { state: 'signed', signedOn: '2026-06-03' }, // Liam iron studies
  ap297: { state: 'signed', signedOn: '2026-04-22' }, // Liam dyspepsia
  ap300: { state: 'signed', signedOn: '2026-04-14' }, // Zoe growth
  ap301: { state: 'signed', signedOn: '2026-02-25' }, // Zoe celiac serology
};

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
