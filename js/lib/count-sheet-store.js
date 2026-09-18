/**
 * THE DRAWER COUNT, KEPT BY THE DAY.
 *
 * Inventory ▸ Daily Count Sheet asks one question of one date: what was in the
 * controlled drawer when the day started, what went in or out of it, what is
 * in there now, and whether those two agree. This module owns the answer —
 * which medications are counted, what has been filed against each date, and
 * what one day hands the next.
 *
 * WHY A DATE AND NOT A RANGE.
 *
 * The report this replaced read across a range, because an administration log
 * is a stream and "the last fortnight of propofol" is a fair question of it. A
 * count is not a stream. It is a DOCUMENT: one drawer, counted once, signed by
 * the two people who counted it. A count sheet spanning two days is not a
 * wider count, it is two counts printed on one page — and the discrepancy it
 * would report is the sum of two reconciliations that were each meant to be
 * answered on their own day.
 *
 * So the date field is not a filter over rows that exist regardless. It is
 * which sheet is on the desk, and every figure on screen is fetched for it.
 *
 * WHAT IS PERSISTED, AND WHY IT IS SESSION STORAGE.
 *
 * The same reasoning js/lib/medication-ledger.js gives for the shelf: somebody
 * clicking through the prototype should find the line they filed ten minutes
 * ago still filed, and somebody opening it fresh tomorrow should find the
 * seeded drawer rather than a drawer six months of demos have scribbled on. A
 * session is the natural unit — the tab is the shift.
 */
import {
  TRACKED_MEDICATIONS,
  blankCount,
  discrepancy,
} from '../../data/medication-tracked.js';

/* Two keys, because they are two different lifetimes. The catalogue is what
   the drawer holds and changes when a drug is added to it; the sheets are what
   was counted, and a day that has been filed is filed regardless of what has
   since come off the list. Kept in one blob they could not be reasoned about
   separately, and clearing one would have meant clearing both. */
const CATALOGUE_KEY = 'medinova.count-sheet.medications';
const SHEETS_KEY = 'medinova.count-sheet.days';

/* ============================================================================
   READING AND WRITING

   Anything unparseable is dropped back to the seed rather than thrown. A
   hand-edited or half-written storage key should cost a demo its counts, not
   the screen.
   ========================================================================= */

function read(key, fallback) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing, or a full quota. The line is lost and the screen is
       not, which is the right way round for a prototype. */
  }
}

/* ============================================================================
   THE CATALOGUE — which medications are counted at all
   ========================================================================= */

/**
 * Every medication on the sheet, in the order it is read in.
 *
 * Alphabetical by name and then by strength, which is not decoration: the
 * person holding the sheet is looking for one drug in a drawer of eight, and
 * the two strengths of Versed have to sit together or the second one is the
 * line somebody skips. Insertion order would put whatever was added last at
 * the bottom, which is the one place nobody looks.
 */
export function trackedMedications() {
  const stored = read(CATALOGUE_KEY, null);
  const list = Array.isArray(stored) && stored.length ? stored : TRACKED_MEDICATIONS;
  return [...list].sort(
    (a, b) =>
      a.name.localeCompare(b.name) || String(a.strength).localeCompare(String(b.strength))
  );
}

/** Ids are stamped rather than derived from the name: two vials of the same
 *  drug are two lines, and a name-based id would make them one. */
let seq = 0;
const newId = () => `trk-${Date.now().toString(36)}-${(seq += 1)}`;

/**
 * Put a medication on the sheet.
 *
 * `priorEnd` is null and cannot be given: a drug that has just been added to
 * the sheet was never counted out of it, so there is nothing to carry forward
 * and the start count is a figure somebody has to go and read off the drawer.
 */
export function addTracked({ name, strength = '', unit, category = 'other' }) {
  const created = {
    id: newId(),
    name: name.trim(),
    strength: strength.trim(),
    unit,
    category,
    priorEnd: null,
  };
  write(CATALOGUE_KEY, [...trackedMedications(), created]);
  return created;
}

/** Correct the line itself — a name typed wrong, a strength read off the
 *  wrong box. Never the counts, which are corrected on the sheet. */
export function updateTracked(id, patch) {
  const next = trackedMedications().map((med) =>
    med.id === id
      ? {
          ...med,
          ...patch,
          name: (patch.name ?? med.name).trim(),
          strength: (patch.strength ?? med.strength).trim(),
        }
      : med
  );
  write(CATALOGUE_KEY, next);
  return next.find((med) => med.id === id);
}

/**
 * Take a medication off the sheet — but not out from under a count that has
 * been filed against it.
 *
 * The same rule the lot list keeps for a box with a waste log. A filed count
 * is a signed reconciliation of a controlled drawer; removing the line it was
 * filed on would delete the record and leave nothing saying it ever existed.
 * A drug that is no longer stocked stops being counted by being counted to
 * zero, which leaves the history intact.
 *
 * Returns the days it has been counted on, so the caller can say which.
 */
export function countedDates(id) {
  const sheets = read(SHEETS_KEY, {});
  return Object.keys(sheets)
    .filter((date) => sheets[date]?.[id])
    .sort();
}

export function removeTracked(id) {
  if (countedDates(id).length) return false;
  write(CATALOGUE_KEY, trackedMedications().filter((med) => med.id !== id));
  return true;
}

/* ============================================================================
   THE SHEETS — what was counted, and on which day
   ========================================================================= */

/**
 * What one day hands the next.
 *
 * The most recent day BEFORE this one that was actually counted out, or the
 * seeded figure where the prototype's records begin. Not the day before
 * literally: a drawer counted on Friday and not touched over the weekend is
 * still holding Friday's closing figure on Monday, and a Monday sheet that
 * opened blank because Sunday was empty would be asking somebody to invent a
 * carry-forward that is sitting right there in the last sheet filed.
 *
 * A day whose end count was never entered carries nothing forward, because
 * there is nothing to carry — the sheet was started and not closed.
 */
export function priorEndFor(medId, date) {
  const sheets = read(SHEETS_KEY, {});
  const earlier = Object.keys(sheets)
    .filter((day) => day < date)
    .sort()
    .reverse();

  for (const day of earlier) {
    const end = sheets[day]?.[medId]?.end;
    if (end !== undefined && end !== null && end !== '') return Number(end);
  }

  const seeded = trackedMedications().find((med) => med.id === medId);
  return seeded?.priorEnd ?? null;
}

/**
 * The sheet for one date: every counted medication, with whatever has been
 * filed against it that day, or a blank line carrying yesterday's close.
 *
 * `filed` is what tells those two apart on screen. A row of zeros somebody
 * typed and signed off and a row of zeros nobody has looked at are the same
 * numbers and opposite facts, and the sheet has to be able to say which.
 */
export function sheetFor(date) {
  const day = read(SHEETS_KEY, {})[date] ?? {};

  return trackedMedications().map((med) => {
    const priorEnd = priorEndFor(med.id, date);
    const saved = day[med.id];
    return {
      ...med,
      priorEnd,
      ...(saved ? { ...blankCount(priorEnd), ...saved } : blankCount(priorEnd)),
      filed: Boolean(saved),
    };
  });
}

/** The six figures a line owns. Everything else on a row — the name, the
 *  strength, the carried-forward figure — belongs to the catalogue or is
 *  computed, and storing a copy of it per day is how the two come to
 *  disagree about what a drug is called. */
const COUNT_KEYS = ['start', 'added', 'given', 'givenBy', 'wasted', 'witness', 'end'];

/** File one line of one day's count. */
export function saveLine(date, medId, values) {
  const sheets = read(SHEETS_KEY, {});
  const day = { ...(sheets[date] ?? {}) };
  day[medId] = Object.fromEntries(COUNT_KEYS.map((key) => [key, String(values[key] ?? '')]));
  write(SHEETS_KEY, { ...sheets, [date]: day });
}

/**
 * How a day's sheet stands, for the line above the table.
 *
 * Counted, still open, and — the figure the whole document exists to produce —
 * how many lines do not reconcile. Said as a count rather than a flag, because
 * "one line out" and "four lines out" are a miscount and a problem, and a
 * banner that reads the same for both is a banner that stops being read.
 */
export function sheetStatus(rows) {
  const filed = rows.filter((row) => row.filed);
  return {
    total: rows.length,
    filed: filed.length,
    off: filed.filter((row) => {
      const diff = discrepancy(row);
      return diff !== null && diff !== 0;
    }).length,
  };
}

/** For a reviewer who wants the seeded drawer back without closing the tab. */
export function clearCountSheets() {
  write(SHEETS_KEY, {});
  write(CATALOGUE_KEY, TRACKED_MEDICATIONS);
}
