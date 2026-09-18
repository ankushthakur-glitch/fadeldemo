/**
 * Appointments — one list, read by both Home and the Appointment screen.
 *
 * ⚠ A NOTE ON THE DATES
 *
 * The supplied screenshots disagree with each other. Home draws a virtual
 * visit dated 21 FEB; the Appointment screen draws two in-person visits in
 * September 2026, listed newest-first rather than soonest-first. Both are
 * kept, because both were drawn and both should be reviewable — but they
 * cannot both be "the next appointment".
 *
 * The resolution: one list, and the entry Home features is marked. Home draws
 * `featured()`; the Appointment screen draws the whole list in the order
 * below. If the intent was that Home always shows the SOONEST appointment,
 * delete the flag and sort — that is a one-line change in featured().
 */

/* ============================================================================
   DATES

   Hand-rolled rather than Intl, because these have to match the format the
   supplied screenshots use exactly — "September 05, 2026 02:30 PM", with a
   padded day and a padded 12-hour clock and no comma before the time. Every
   locale-aware formatter produces something close and none produces that, and
   a deadline printed in a different shape from the appointment above it reads
   as two different systems talking.
   ========================================================================= */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (value) => String(value).padStart(2, '0');

/** A Date → "September 05, 2026 02:30 PM". Exported: the cancellation dialog
    prints the notice deadline, and it has to look like the rest of the card. */
export function formatWhen(date) {
  const hour = date.getHours() % 12 || 12;
  const meridiem = date.getHours() < 12 ? 'AM' : 'PM';
  return (
    `${MONTHS[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()} ` +
    `${pad(hour)}:${pad(date.getMinutes())} ${meridiem}`
  );
}

/**
 * The weekday, for the headline on an upcoming card — "Tuesday, May 05, 2026
 * · 10:30 AM". The card leads with when the visit is, and a patient reading
 * "05" has to go to a calendar to find out whether that is this week.
 */
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** A Date → "September 05, 2026". The Date column of the past table. */
export const formatDay = (date) =>
  `${MONTHS[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()}`;

/** A Date → "02:30 PM". The Time column, and the tail of a headline. */
export function formatTime(date) {
  const hour = date.getHours() % 12 || 12;
  return `${pad(hour)}:${pad(date.getMinutes())} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** An ISO start → "Tuesday, September 24, 2026 · 02:30 PM". */
export function formatHeadline(startsAt) {
  const at = new Date(startsAt);
  return `${WEEKDAYS[at.getDay()]}, ${formatDay(at)} \u00b7 ${formatTime(at)}`;
}

/**
 * "Today", "Tomorrow" or "Upcoming" — the pill in the corner of a card.
 *
 * Compared by calendar day rather than by hours elapsed: a visit at 9am
 * tomorrow is 20 hours away and is not "today", and one at 11pm tonight is 14
 * hours away and is.
 */
export function dayLabel(startsAt) {
  const at = new Date(startsAt);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((at - midnight) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return 'Upcoming';
}

/** N hours from now, rounded up to the next quarter hour. */
function nextSlot(hours) {
  const at = new Date(Date.now() + hours * 3_600_000);
  at.setSeconds(0, 0);
  at.setMinutes(Math.ceil(at.getMinutes() / 15) * 15);
  return at;
}

/* ============================================================================
   WHEN A CANCELLATION COSTS SOMETHING

   The numbers a patient is charged, in one place. They are stated on the
   confirmation dialog before anything is cancelled, and the dialog says which
   of them applies to the visit in front of them — "fees may apply" is not a
   warning, it is a disclaimer.

   ⚠ THE FIGURES ARE PLACEHOLDERS. The practice's real notice window and its
   real fees have not been supplied. They are together in one object so
   replacing them is one edit and no screen has to be reread.
   ========================================================================= */

export const CANCELLATION_POLICY = {
  /** Cancel with more notice than this and there is nothing to pay. */
  noticeHours: 24,
  /** Charged for cancelling inside that window. */
  lateCancelFee: 50,
  /** Charged for simply not turning up. Always more than a late cancel — the
      practice can still fill a slot it hears about. */
  noShowFee: 75,
  phone: '(808) 555-0100',
};

/* ============================================================================
   THE LIST

   `startsAt` is the machine-readable start; `dateTime` is what a person
   reads. Both, because the fee rule has to do arithmetic and parsing it back
   out of "September 05, 2026 02:30 PM (45 Mins)" is how a display string
   quietly becomes an API. They must agree — see formatWhen() below, which is
   what the generated row uses so it cannot disagree with itself.

   ⚠ `specialty` and `reason` ARE NOT FROM THE SUPPLIED SCREENSHOTS. The card
   and the past table both name them — a patient scanning six past visits
   tells them apart by why they went, not by which Tuesday it was — so the
   fixtures carry plausible values. They are the practice's to replace.
   ========================================================================= */

/**
 * ⚠ NOT FROM THE DESIGN — and dated relative to right now, unlike every other
 * fixture in the portal.
 *
 * Every appointment the screenshots supply is weeks or months out, so the
 * cancellation fee could never apply to any of them and the warning this
 * screen exists to give would be unreachable in review: you would see "no fee
 * for cancelling now" three times and have to take the other branch on trust.
 *
 * This one sits 18 hours out, inside the notice window, whenever the
 * prototype is opened. The time of day it lands on is arbitrary — that is the
 * cost of it always being reviewable, and an early slot is not unrealistic
 * for a practice that does morning procedures.
 *
 * It is the first thing to delete once the fixtures carry real dates.
 */
const soon = nextSlot(18);

export const UPCOMING = [
  {
    id: 'appt-soon',
    day: String(soon.getDate()).padStart(2, '0'),
    month: MONTHS[soon.getMonth()].slice(0, 3).toUpperCase(),
    type: 'Follow-up',
    mode: 'Virtual',
    startsAt: soon.toISOString(),
    dateTime: `${formatWhen(soon)} (30 Mins)`,
    time: `${formatWhen(soon).split(' ').slice(3).join(' ')} (30 Mins)`,
    duration: '30 Mins',
    provider: 'Dianne Russell',
    specialty: 'Internal Medicine',
    reason: 'Blood pressure medication review',
    location: 'Video visit',
    intakeComplete: true,
  },
  {
    id: 'appt-feb-21',
    featured: true, // the card Home draws
    day: '21',
    month: 'FEB',
    type: 'New',
    mode: 'Virtual',
    startsAt: '2027-02-21T13:08:00',
    dateTime: 'February 21, 2027 01:08 PM (45 Mins)',
    time: '01:08 PM (45 Mins)',
    duration: '45 Mins',
    provider: 'Jane Cooper',
    specialty: 'Family Medicine',
    reason: 'Cold, fever and a rash on the skin for the past 2 weeks',
    location: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    intakeComplete: false,
  },
  {
    id: 'appt-sep-24',
    day: '24',
    month: 'SEP',
    type: 'Follow-up',
    mode: 'In-Person',
    startsAt: '2026-09-24T14:30:00',
    dateTime: 'September 24, 2026 02:30 PM (45 Mins)',
    time: '02:30 PM (45 Mins)',
    duration: '45 Mins',
    provider: 'Jane Cooper',
    specialty: 'Family Medicine',
    reason: 'Left knee pain after a fall',
    location: '4517 Washington Ave. Manchester, Kentucky 39495',
    intakeComplete: false,
  },
  {
    id: 'appt-sep-05',
    day: '05',
    month: 'SEP',
    type: 'Follow-up',
    mode: 'In-Person',
    startsAt: '2026-09-05T14:30:00',
    dateTime: 'September 05, 2026 02:30 PM (45 Mins)',
    time: '02:30 PM (45 Mins)',
    duration: '45 Mins',
    provider: 'Jane Cooper',
    specialty: 'Family Medicine',
    reason: 'Routine check-up',
    location: '4517 Washington Ave. Manchester, Kentucky 39495',
    intakeComplete: true,
  },
];

export const PAST = [
  {
    id: 'appt-aug-10',
    type: 'Follow-up',
    mode: 'In-Person',
    startsAt: '2026-08-10T11:00:00',
    dateTime: 'August 10, 2026 11:00 AM (30 Mins)',
    duration: '30 Mins',
    provider: 'Guy Hawkins',
    specialty: 'Cardiology',
    reason: 'Illness',
    location: '2118 Thornridge Cir. Syracuse, Connecticut 35624',
    status: 'Cancelled',
  },
  {
    id: 'appt-aug-08',
    type: 'Follow-up',
    mode: 'In-Person',
    startsAt: '2026-08-08T11:00:00',
    dateTime: 'August 08, 2026 11:00 AM (30 Mins)',
    duration: '30 Mins',
    provider: 'Dianne Russell',
    specialty: 'Internal Medicine',
    reason: 'Routine check-up',
    location: '4517 Washington Ave. Manchester, Kentucky 39495',
    status: 'Completed',
  },
  {
    id: 'appt-jul-22',
    type: 'Follow-up',
    mode: 'Virtual',
    startsAt: '2026-07-22T09:15:00',
    dateTime: 'July 22, 2026 09:15 AM (20 Mins)',
    duration: '20 Mins',
    provider: 'Jane Cooper',
    specialty: 'Family Medicine',
    reason: 'Medication review',
    location: 'Video visit',
    status: 'Completed',
  },
];

/** The appointment Home puts on its card. */
export const featured = () => UPCOMING.find((appointment) => appointment.featured) ?? UPCOMING[0];

/* ============================================================================
   CANCELLING
   ========================================================================= */

/**
 * What cancelling this appointment RIGHT NOW would cost.
 *
 * Derived from the clock rather than stored on the row, because a stored
 * `chargeable: true` is only true for as long as nobody looks at it twice.
 * The dialog asks this at the moment the patient clicks Cancel, which is the
 * only moment the answer is worth anything.
 *
 * @returns {{chargeable: boolean, fee: number, noShowFee: number,
 *            hoursLeft: number, deadline: Date, starts: Date}}
 */
export function cancellationCharge(appointment) {
  const starts = new Date(appointment.startsAt);
  const deadline = new Date(starts.getTime() - CANCELLATION_POLICY.noticeHours * 3_600_000);
  const now = Date.now();

  return {
    chargeable: now > deadline.getTime(),
    fee: CANCELLATION_POLICY.lateCancelFee,
    noShowFee: CANCELLATION_POLICY.noShowFee,
    hoursLeft: Math.max(0, (starts.getTime() - now) / 3_600_000),
    deadline,
    starts,
  };
}

/**
 * Actually cancel it: out of Upcoming, into Past, marked Cancelled.
 *
 * A confirmation that warns you about a $50 fee and then changes nothing
 * cannot be reviewed — you learn whether the WARNING is right but not whether
 * the visit a patient just gave up actually went anywhere.
 *
 * NO BILLING ROW IS CREATED. data/billing.js is the practice's own statement
 * fixture, and inventing a $50 line in it would be this screen asserting
 * something about a system it does not own. The dialog and the toast say the
 * fee is coming; nothing here pretends it has been charged.
 */
export function cancelAppointment(id) {
  const at = UPCOMING.findIndex((appointment) => appointment.id === id);
  if (at === -1) return null;

  const [appointment] = UPCOMING.splice(at, 1);
  const cancelled = { ...appointment, status: 'Cancelled' };
  PAST.unshift(cancelled);
  remember(id);
  return cancelled;
}

/* ============================================================================
   REMEMBERING A CANCELLATION FOR THE REST OF THE SESSION

   sessionStorage, which is neither of the two obvious answers.

   In memory alone is not enough here, unlike the document uploads. Upcoming
   and Past share one page now, but the screens around them do not: a patient
   who cancels, opens a visit summary and comes back has crossed two full page
   loads, and a fresh module would put the visit straight back on the rail.
   The screen would tell you it was cancelled and then show it as upcoming.

   localStorage is too much, for the reason data/documents.js gives: a
   reviewer's stray click should not still be sitting in the list next week
   with nothing to say where it came from. sessionStorage ends with the tab,
   which is exactly the life a prototype's state should have.
   ========================================================================= */

const CANCELLED_KEY = 'medinova.patient.cancelled.v1';

/** Ids cancelled in this tab. Storage can throw (private mode, quota) and a
    prototype should not white-screen over a feature it could do without. */
function cancelledIds() {
  try {
    const raw = sessionStorage.getItem(CANCELLED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function remember(id) {
  try {
    sessionStorage.setItem(CANCELLED_KEY, JSON.stringify([...new Set([...cancelledIds(), id])]));
  } catch {
    /* The move already happened in memory; persisting it is the bonus. */
  }
}

// Replay this tab's cancellations over the fixtures, once, at load. Runs
// before any screen reads the lists, so no screen has to know this exists.
cancelledIds().forEach((id) => {
  const at = UPCOMING.findIndex((appointment) => appointment.id === id);
  if (at === -1) return;
  const [appointment] = UPCOMING.splice(at, 1);
  PAST.unshift({ ...appointment, status: 'Cancelled' });
});
