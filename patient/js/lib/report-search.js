/**
 * REPORT SEARCH — the matcher behind the filter bar on Reports.
 *
 * Reports is the one collection in the portal big enough to be worth
 * searching and small enough to search honestly: four rows today, and the
 * thing a patient actually goes looking for by name or by date.
 *
 * THE RULES LIVE HERE, not in the screen, so what "Oct 2025" means is settled
 * in one place rather than re-decided by whatever surface is asking.
 *
 * WHY DATES ARE MATCHED FOUR WAYS
 *
 * A patient looking for a result knows roughly when it was, and types it the
 * way they think of it: 10/28/2025 off the printout, 2025-10-28 if they are
 * copying from something technical, "Oct 2025" if they only remember the
 * month, "2025" if they only remember the year. All four are the same
 * question. Matching only the format the fixture happens to store would make
 * the other three look like no results.
 */

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/* ============================================================================
   MATCHING
   ========================================================================= */

/** `10/28/2025` → `{ month: 10, day: 28, year: 2025 }`. */
function parts(stamped) {
  const [month, day, year] = String(stamped).split('/').map(Number);
  return { month, day, year };
}

/**
 * Every string form of one report's date that a query may legitimately match.
 *
 * Built as a list of haystacks rather than as a parser for the query, because
 * the query is whatever somebody typed and the date is ours. Four known forms
 * beat one clever regular expression that has to guess.
 */
function dateForms(report) {
  const { month, day, year } = parts(report.date);
  const name = MONTHS[month - 1] ?? '';
  const pad = (n) => String(n).padStart(2, '0');

  return [
    report.date, // 10/28/2025
    `${year}-${pad(month)}-${pad(day)}`, // 2025-10-28
    `${name} ${year}`, // october 2025
    `${name.slice(0, 3)} ${year}`, // oct 2025
    `${name} ${day} ${year}`, // october 28 2025
    String(year), // 2025
    `${month}/${day}/${year}`, // 10/28/2025 unpadded
  ].map((form) => form.toLowerCase());
}

/**
 * Does this report answer this query?
 *
 * Case-insensitive substring on the name, and a looser match on the date: the
 * query has its separators normalised so "oct-2025" and "oct 2025" are the
 * same question, and it matches if any of the date's forms CONTAINS it.
 */
export function matches(report, query) {
  const asked = query.trim().toLowerCase();
  if (!asked) return true;

  if (report.name.toLowerCase().includes(asked)) return true;
  if (report.orderedBy.toLowerCase().includes(asked)) return true;

  const loose = asked.replace(/[-.]/g, ' ').replace(/\s+/g, ' ');
  return dateForms(report).some((form) => form.includes(asked) || form.includes(loose));
}

/**
 * Within a From/To range, on whole days.
 *
 * The bounds are `YYYY-MM-DD` from two <input type="date">s. Compared as
 * strings after the report's own date is converted to the same shape —
 * lexicographic order on a zero-padded ISO date IS chronological order, which
 * avoids parsing anything into a Date and inheriting the UTC-midnight bug
 * lib/dates.js exists to dodge.
 */
export function withinRange(report, from, to) {
  if (!from && !to) return true;
  const { month, day, year } = parts(report.date);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
