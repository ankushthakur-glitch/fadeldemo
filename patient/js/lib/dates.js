/**
 * DATES — the conversions the portal keeps needing, in one place.
 *
 * WHY THIS MODULE EXISTS
 *
 * Medications and Allergies each carried a private copy of these, identical
 * down to the comment explaining the bug they avoid. Merging the two screens
 * into one would have meant either two copies in the same file or one screen
 * reaching into another's module, so they came here. Forms and both print
 * modules use them now, which is the better argument for the module: the
 * timezone bug below is one nobody re-derives correctly a second time.
 *
 * THE BUG ALL OF THIS AVOIDS
 *
 * Every conversion below is done on the STRING and never through
 * `new Date(iso)`. An ISO date with no time is parsed as UTC midnight, so
 * anywhere behind UTC it renders as the day before: a medication added on the
 * 17th at 9pm files itself as the 16th. The failure is invisible to whoever
 * writes the code — it needs a timezone and a late hour to show up — and
 * obvious to the patient it happens to.
 *
 * `new Date()` with no argument is fine and is used below: it reads the
 * clock, which is exactly what it is for. It is only PARSING that is unsafe.
 */

/** Today as `YYYY-MM-DD`, in the user's own timezone. */
export function isoToday() {
  const now = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-08-17` → `08/17/2026`, the padded form every fixture uses. */
export function stamp(iso) {
  const [year, month, day] = String(iso || '').split('-');
  return year && month && day ? `${month}/${day}/${year}` : '';
}

/** Today, in the same padded form the fixtures use. */
export const todayStamp = () => stamp(isoToday());

/**
 * "18 August 2026 at 2:45 pm" — for a document that says when it was made.
 *
 * Printed lists and completed forms both carry one, and both are read away
 * from the screen that produced them, so the month is spelled out: 08/09 is
 * two different days depending on which side of the Atlantic is reading it.
 */
export function generatedOn(when = new Date()) {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const hour24 = when.getHours();
  const hour = hour24 % 12 || 12;
  const minute = String(when.getMinutes()).padStart(2, '0');
  const meridiem = hour24 < 12 ? 'am' : 'pm';

  return (
    `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()} ` +
    `at ${hour}:${minute} ${meridiem}`
  );
}
