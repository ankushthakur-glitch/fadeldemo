/**
 * DEMO DATA for the Visit Notes module (chart section "visit-notes").
 * Entirely invented — no real patient information.
 *
 * WHAT IS NOT HERE ANY MORE
 * This file used to hold each patient's visit list outright — date, provider,
 * reason, note status — as rows of its own. Nothing could be done with them:
 * a row had no booking behind it, so there was no encounter to open and no
 * note to sign, and the "View Encounter" action could only apologise. The
 * visits now come from the one copy of the bookings (data/appointment-store.js)
 * and the note state from data/visit-notes.js — the same two sources the
 * Scheduler's Encounters worklist reads — so a row in the chart opens the real
 * encounter, and a note signed from either place reads Signed in both.
 *
 * What the bookings do not carry is billing, so that alone stays here, keyed
 * by appointment id (positional in data/schedule.js — see the comment on the
 * visit-history rows at the end of ROWS). A visit with no entry has nothing
 * billed yet and reads as a dash.
 *
 * billStatus: 'Paid' | 'Pending' | 'Overdue' | 'Cancelled'
 */
export const VISIT_BILL_STATUS = {
  // Henna West
  ap8: 'Pending',
  ap282: 'Paid',
  ap281: 'Cancelled',
  ap280: 'Pending',
  // Natali Craig
  ap85: 'Pending',
  ap283: 'Overdue',
  // Liam Rodriguez
  ap83: 'Pending',
  ap197: 'Pending',
  // Zoe Tran
  ap76: 'Pending',
  ap199: 'Pending',
  ap284: 'Paid',
  // The rest of the history: billed and paid once the note is filed.
  ap285: 'Pending',
  ap286: 'Pending',
  ap287: 'Paid',
  ap288: 'Paid',
  ap289: 'Paid',
  ap290: 'Pending',
  ap291: 'Pending',
  ap292: 'Paid',
  ap293: 'Paid',
  ap294: 'Pending',
  ap295: 'Pending',
  ap296: 'Paid',
  ap297: 'Paid',
  ap298: 'Pending',
  ap299: 'Pending',
  ap300: 'Paid',
  ap301: 'Paid',
};
