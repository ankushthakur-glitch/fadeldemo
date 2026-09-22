/**
 * The one copy of the recall list.
 *
 * WHY THIS EXISTS
 * The Recalls worklist used to take a private copy of RECALLS at boot, which
 * was fine while nothing outside that screen could write one. The visit note
 * can now: signing a clinic note turns the follow-up interval on its Plan into
 * a recall, and the whole point of doing that is that somebody at the desk
 * finds it afterwards. A recall written into a module-level array on the
 * encounter screen does not survive the navigation to Tasks — the module is
 * re-imported and rebuilt from its seed — so the clinician would sign a note
 * saying "back in three months" and the desk would open Recalls and find
 * nothing.
 *
 * sessionStorage rather than localStorage, for the same reason as
 * data/appointment-store.js: the demo data should come back fresh in a new
 * tab, not carry one reviewer's afternoon into the next person's session.
 *
 * WHAT THIS IS NOT. It is not a general-purpose recall API. Recalls are
 * created here and read here; nothing has yet needed to amend or close one
 * from outside the Tasks screen, and a setter nobody calls is a setter that is
 * wrong by the time somebody does. The Tasks screen still owns everything that
 * happens to a recall once it is on the list.
 */
import { RECALLS, RECALL_INTERVALS } from './tasks.js';

const KEY = 'medinova.recalls';

/** A fresh copy of the seed data, so the module-level array is never mutated. */
const seed = () => RECALLS.map((r) => ({ ...r }));

/**
 * Storage can throw — private browsing, a full quota, or a file:// page with
 * no origin to key on. None of those should stop the screen loading, so every
 * failure falls back to the seed and the prototype behaves as it always did.
 */
export function loadRecalls() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* fall through to the seed */
  }
  return seed();
}

export function saveRecalls(list) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* nothing to do — the screen keeps working from memory */
  }
}

/* ===================== Turning an interval into a date =====================
   A recall is stored as a due DATE, because that is what the worklist sorts,
   filters and colours by. What the clinician chose was an INTERVAL. The
   conversion happens once, here, rather than at each call site: a recall
   written by the note and a recall typed on the recall form have to land on
   the same day for the same words, or the two ways of making one are two
   different things wearing one name.
   -------------------------------------------------------------------------- */

/** Every interval in the practice's vocabulary, in months. */
const INTERVAL_MONTHS = {
  '4 weeks': 1,
  '3 months': 3,
  '6 months': 6,
  '1 year': 12,
  '2 years': 24,
  '3 years': 36,
  '5 years': 60,
  '10 years': 120,
};

/**
 * The note's own follow-up vocabulary, mapped onto the practice's recall one.
 *
 * The two lists are not the same and should not be forced to be: a clinic
 * follow-up is chosen in weeks and months, a surveillance recall in years, and
 * a single list long enough for both would offer "10 years" to somebody
 * booking a wound check. Only the overlap is mapped; anything with no recall
 * equivalent returns '' and the caller asks for the interval instead of
 * guessing one.
 */
const NOTE_INTERVALS = {
  '4 weeks': '4 weeks',
  '3 months': '3 months',
  '6 months': '6 months',
  '12 months': '1 year',
};

/** The recall interval a note's follow-up answer implies, or '' if none does. */
export const recallIntervalFor = (followUp) => NOTE_INTERVALS[followUp] ?? '';

/**
 * `due` and `dueLabel` for an interval, counted from today.
 *
 * Both are stored because the worklist needs them for different jobs — the ISO
 * date sorts and filters, the label is what a human reads in the cell — and
 * deriving the label at render time in three places is how two rows end up
 * writing the same day differently.
 */
export function dueFromInterval(interval, from = new Date()) {
  const months = INTERVAL_MONTHS[interval];
  const due = new Date(from.getTime());
  if (months) due.setMonth(due.getMonth() + months);

  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(
    due.getDate()
  ).padStart(2, '0')}`;

  const label = due.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });

  return { due: iso, dueLabel: label };
}

/**
 * Which status a recall opens in.
 *
 * Nothing written today is overdue, and calling everything "Upcoming" would
 * bury a four-week follow-up under a list of ten-year screening recalls. The
 * line is thirty days, which is roughly how far ahead this practice's desk
 * works when it books.
 */
function openingStatus(iso) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 30 ? 'due' : 'upcoming';
}

/** The next free recall id, counted off the list rather than a module counter
 *  so two screens in one session cannot both mint RC-2301. */
function nextRecallId(list) {
  const highest = list.reduce((top, recall) => {
    const n = Number(String(recall.id).replace(/\D/g, ''));
    return Number.isFinite(n) && n > top ? n : top;
  }, 2200);
  return `RC-${highest + 1}`;
}

/**
 * File a recall and hand it back as it was stored.
 *
 * `interval` is the practice's vocabulary — the caller converts the note's
 * words with recallIntervalFor() before getting here. The due date is derived
 * rather than accepted, because a recall whose date and interval disagree is
 * unreadable and there is no honest way to decide which of the two was meant.
 */
export function addRecall({
  patient,
  mrn,
  dueFor,
  interval,
  provider,
  location = 'Clinic',
  source = 'note-plan',
}) {
  const list = loadRecalls();
  const { due, dueLabel } = dueFromInterval(interval);

  const recall = {
    id: nextRecallId(list),
    patient,
    mrn,
    dueFor,
    interval,
    provider,
    location,
    source,
    due,
    dueLabel,
    lastContacted: null,
    status: openingStatus(due),
  };

  list.unshift(recall);
  saveRecalls(list);
  return recall;
}

/** Exported for the callers that need to offer the vocabulary in a field. */
export { RECALL_INTERVALS };
