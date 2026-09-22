/**
 * THE CLOCK READINGS A COLONOSCOPY IS JUDGED BY.
 *
 * Six moments get written down in an endoscopy room, and three of them are
 * only interesting as the gaps between them. This module holds the six, and
 * the arithmetic that turns them into the two intervals anybody actually
 * quotes — insertion and withdrawal.
 *
 * WHY WITHDRAWAL TIME IS A NUMBER AND NOT A NICETY.
 *
 * It is the single best-evidenced process measure in screening colonoscopy.
 * Adenomas are found on the way OUT, while the scope is being drawn back and
 * the wall is being inspected fold by fold; going in is navigation and finds
 * almost nothing. Endoscopists who spend at least six minutes on that
 * withdrawal detect substantially more adenomas than those who do not, which
 * is why six minutes is the number written into every quality standard on the
 * subject and why units audit it per endoscopist.
 *
 * A report that records "scope in 08:06, scope out 08:26" has the number in it
 * and does not state it. Twenty minutes in the room could be a four-minute
 * withdrawal after a difficult insertion, or a fourteen-minute one — those are
 * different pieces of work and only one of them meets the standard. So the
 * report states it.
 *
 * WHAT THIS MODULE WILL NOT DO IS INVENT ONE. Every interval here is null
 * until both of the marks it spans have been recorded in the times log. A
 * withdrawal time derived from a missing caecal time would be the total
 * procedure time wearing a quality metric's name, which is worse than no
 * number at all: it is the same number the audit wants, reading high.
 */

/**
 * The six marks, in the order the day makes them.
 *
 * This is the list the times log offers and the list the report reads back,
 * and it is one list because two would be a report quietly failing to find a
 * marker the log had been allowed to spell differently. The log imports it —
 * see `times` in js/lib/encounter-logs.js.
 */
export const PROCEDURE_TIME_MARKERS = [
  'Anaesthesia start',
  'Scope in',
  'Caecum reached',
  'Scope out',
  'Anaesthesia stop',
  'Out of room',
];

/**
 * The three the intervals are measured between, by the name the log files them
 * under. Named rather than indexed into the list above: a marker inserted at
 * the top of that array must not silently re-point what "withdrawal" means.
 */
export const TIMING_MARKS = {
  scopeIn: 'Scope in',
  caecum: 'Caecum reached',
  scopeOut: 'Scope out',
};

/**
 * Six minutes, and where the number comes from.
 *
 * The threshold every published standard settles on for screening colonoscopy,
 * measured from the caecum to the scope leaving. It is a floor for the AVERAGE
 * withdrawal across an endoscopist's normal-result cases, not a rule about any
 * one of them — a case that finds a polyp at four minutes and spends the next
 * twenty taking it off has a short withdrawal and nothing wrong with it.
 *
 * So the report MARKS a short withdrawal rather than complaining about one:
 * the number is shown in a warning tone, next to a sentence saying what the
 * six minutes is for. Anything stronger would be the screen second-guessing a
 * case it cannot see.
 */
export const WITHDRAWAL_TARGET_MINUTES = 6;

/** 'HH:MM' as minutes past midnight, or null for anything that is not one. */
function minutesOf(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? '').trim());
  if (!match) return null;
  const [, h, m] = match;
  return Number(h) * 60 + Number(m);
}

/**
 * The gap between two clock readings, in minutes.
 *
 * MIDNIGHT IS HANDLED, AND IT IS NOT AN ACADEMIC CASE. An emergency scope for
 * a bleed at half past eleven at night is a real Tuesday, and a withdrawal
 * time of minus 1,412 minutes on the one report somebody will actually go back
 * and read is not the place to discover that a day boundary exists. A negative
 * gap is read as having crossed midnight; the log's times carry no date, so
 * this is the best the record can do and it is right for every case that does
 * not run more than twelve hours, which is all of them.
 */
export function minutesBetween(from, to) {
  const a = minutesOf(from);
  const b = minutesOf(to);
  if (a === null || b === null) return null;
  const gap = b - a;
  return gap < 0 ? gap + 24 * 60 : gap;
}

/** Minutes as the report writes them: "14 min", or "1 h 06 min" past the hour. */
export function durationLabel(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/**
 * The timings of one case, read off the rows of the times log.
 *
 * Takes the log's rows — `{ marker, time }` at minimum — and gives back the
 * three marks and the three intervals. Anything not yet recorded comes back
 * null, and every caller is expected to say "—" rather than guess.
 *
 * THE LAST ROW FOR A MARKER WINS. A time is corrected by recording it again;
 * the log keeps both, because a record that quietly overwrites a time is a
 * record nobody can audit. What the report wants is the one that stands.
 */
export function procedureTimings(rows = []) {
  const at = (marker) => {
    const found = [...rows].reverse().find((row) => row.marker === marker);
    return found?.time ?? null;
  };

  const scopeIn = at(TIMING_MARKS.scopeIn);
  const caecum = at(TIMING_MARKS.caecum);
  const scopeOut = at(TIMING_MARKS.scopeOut);

  const insertion = minutesBetween(scopeIn, caecum);
  const withdrawal = minutesBetween(caecum, scopeOut);
  const total = minutesBetween(scopeIn, scopeOut);

  return {
    scopeIn,
    caecum,
    scopeOut,
    /* Scope in to the caecum: how hard the colon was to get round. It is the
       number that explains a short withdrawal on a difficult case, which is
       why it is reported beside it rather than left to be worked out. */
    insertion,
    withdrawal,
    total,
    /* Only ever true when there IS a withdrawal time. An unrecorded caecal
       time must not read as a failed one. */
    withdrawalShort: withdrawal !== null && withdrawal < WITHDRAWAL_TARGET_MINUTES,
  };
}
