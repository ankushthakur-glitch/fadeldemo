/**
 * TIMESHEET CORRECTIONS
 *
 * What an administrator has changed about the punch record, kept separate from
 * the punch record itself.
 *
 * WHY IT IS A SEPARATE STORE
 * The clock log (js/lib/time-clock-store.js) is append-only on purpose: it is
 * what the clock actually saw, and a report that edits it in place can no
 * longer answer "what did the badge register?". Payroll needs both halves —
 * the raw punch AND the corrected hours — so corrections are recorded as an
 * OVERLAY: the original entry is never touched, and every change carries who
 * made it, when, and why.
 *
 * Two kinds of record live here:
 *   adjustments   patches keyed by the id of an existing entry
 *   manual        whole entries somebody typed in, because no punch exists —
 *                 a shift worked off-site, or a badge that never registered
 *
 * SHAPES
 *   adjustment  { in, out, breakMinutes, notes, history: [audit] }
 *   audit       { at, by, reason, note, from: {in, out, breakMinutes} }
 *   manual      { id, employeeId, in, out, breaks, notes,
 *                 source: 'manual', by, at, reason }
 *
 * A corrected break is stored as MINUTES, not as start/end pairs. An
 * administrator agreeing "she took forty minutes" knows the duration and not
 * which forty minutes; writing back an invented 12:04–12:44 would be the
 * report making up a fact nobody has.
 */

const KEY = 'medinova.timesheet.v1';
const VERSION = 1;

const listeners = new Set();

function emptyState() {
  return { version: VERSION, adjustments: {}, manual: [] };
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed?.version !== VERSION || !Array.isArray(parsed.manual)) return emptyState();
    return { ...emptyState(), ...parsed };
  } catch {
    // Private browsing, or hand-edited junk. The screen still has to work.
    return emptyState();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Quota or a blocked store — notify() still repaints this page view. */
  }
  notify();
}

function notify() {
  for (const fn of listeners) fn();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) notify();
  });
}

let idSeed = 0;
function nextId() {
  return `ts-${Date.now().toString(36)}-${(idSeed += 1)}`;
}

/* --- Reading ---------------------------------------------------------------- */

export function adjustments() {
  return read().adjustments;
}

export function manualEntries() {
  return read().manual;
}

export function adjustmentFor(entryId) {
  return read().adjustments[entryId] ?? null;
}

/* --- Writing ----------------------------------------------------------------- */

/**
 * Record a correction to an existing entry.
 *
 * `previous` is the values as they stood before this change, so the audit
 * trail reads as a sequence of moves rather than as a pile of end states. The
 * first correction to an entry captures the punch itself; later ones capture
 * the correction they replaced.
 */
export function adjust(entryId, values, { by, reason, note = '', previous }) {
  const state = read();
  const existing = state.adjustments[entryId];

  const audit = {
    at: Date.now(),
    by,
    reason,
    note,
    from: previous,
  };

  state.adjustments[entryId] = {
    in: values.in,
    out: values.out,
    breakMinutes: values.breakMinutes,
    notes: values.notes ?? '',
    history: [...(existing?.history ?? []), audit],
  };

  write(state);
  return state.adjustments[entryId];
}

/** Add a shift that was never punched. */
export function addManual({ employeeId, in: start, out, breakMinutes, notes, by, reason, note = '' }) {
  const state = read();
  const entry = {
    id: nextId(),
    employeeId,
    in: start,
    out,
    breaks: breakMinutes ? [{ start, end: start + breakMinutes * 60_000 }] : [],
    notes: notes ?? '',
    source: 'manual',
    by,
    at: Date.now(),
    reason,
    note,
  };
  state.manual.push(entry);
  write(state);
  return entry;
}

/**
 * Apply an overlay to an entry, returning a NEW object.
 *
 * The original is left alone — callers hold demo data and clock entries that
 * other screens read, and mutating one here would edit the record this store
 * exists to preserve.
 */
export function applyAdjustment(entry, adjustment = adjustmentFor(entry.id)) {
  if (!adjustment) return entry;
  const breakMs = (adjustment.breakMinutes ?? 0) * 60_000;
  return {
    ...entry,
    in: adjustment.in,
    out: adjustment.out,
    breaks: breakMs ? [{ start: adjustment.in, end: adjustment.in + breakMs }] : [],
    notes: adjustment.notes ?? entry.notes,
    adjustment,
  };
}

/** Test hook — clears every correction. Not reachable from the UI. */
export function resetAll() {
  write(emptyState());
}
