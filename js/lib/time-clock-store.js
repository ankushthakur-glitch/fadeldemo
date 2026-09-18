/**
 * TIME CLOCK STORE
 *
 * One shift log, shared by every screen. The widget in the top bar is the only
 * UI, so this file owns the whole model: what a shift is and what counts as
 * worked time.
 *
 * The log is APPEND-ONLY from the UI's point of view — entries are created by
 * clocking in and closed by clocking out. Nothing edits or deletes one, so the
 * record always reflects what the clock actually saw.
 *
 * Persisted to localStorage rather than held in memory, because the widget
 * lives in a header that is re-created from scratch on every navigation — an
 * in-memory clock would reset the moment someone opened a patient. The
 * `storage` event means two tabs of the prototype stay in step.
 *
 * ENTRY SHAPE
 *   { id, in: ms, out: ms|null, breaks: [{ start: ms, end: ms|null }], notes }
 *
 * `out: null` means the shift is running. There is at most one of those at a
 * time — see the guard in clockIn().
 */

const KEY = 'medinova.timeclock.v1';

/* Bumped only if the shape changes in a way old data cannot survive. Reading
   an unknown version throws the log away rather than guessing at a migration:
   this is prototype data, and a half-migrated shift is worse than none. */
const VERSION = 1;

const listeners = new Set();

function emptyState() {
  return { version: VERSION, entries: [] };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Array.isArray(parsed.entries)) {
      return emptyState();
    }
    return parsed;
  } catch {
    // Private-browsing localStorage, or hand-edited junk. Either way the clock
    // still has to work for this session.
    return emptyState();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Quota or a blocked store — the in-page UI still updates from notify(). */
  }
  notify();
}

function notify() {
  for (const fn of listeners) fn();
}

/** Subscribe to every change, including ones made in another tab. */
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
  // Date.now() alone collides if two shifts start in the same millisecond.
  return `tc-${Date.now().toString(36)}-${(idSeed += 1)}`;
}

/* --- Reading ---------------------------------------------------------------- */

export function getEntries() {
  return read().entries;
}

/** Local YYYY-MM-DD. Not toISOString() — that shifts the day for anyone west
    of UTC, so an evening shift would file itself under tomorrow. */
export function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Entries that STARTED on the given day, oldest first. */
export function entriesForDay(day = dayKey()) {
  return getEntries()
    .filter((entry) => dayKey(entry.in) === day)
    .sort((a, b) => a.in - b.in);
}

/** The running shift, or undefined. */
export function activeEntry() {
  return getEntries().find((entry) => entry.out === null);
}

/** The running break within the running shift, or undefined. */
export function activeBreak() {
  return activeEntry()?.breaks.find((b) => b.end === null);
}

/** 'out' | 'in' | 'break' — the three states the widget renders. */
export function status() {
  if (!activeEntry()) return 'out';
  return activeBreak() ? 'break' : 'in';
}

/* --- Durations --------------------------------------------------------------
   Worked time EXCLUDES breaks. A shift that ran 4h with a 30m lunch reads
   3h 30m worked and 30m break, so the two numbers never have to be mentally
   subtracted from one another. */

export function breakMs(entry, now = Date.now()) {
  return entry.breaks.reduce(
    (total, b) => total + Math.max(0, (b.end ?? now) - b.start),
    0
  );
}

export function workedMs(entry, now = Date.now()) {
  const elapsed = Math.max(0, (entry.out ?? now) - entry.in);
  return Math.max(0, elapsed - breakMs(entry, now));
}

export function totalWorkedMs(day = dayKey(), now = Date.now()) {
  return entriesForDay(day).reduce(
    (total, entry) => total + workedMs(entry, now),
    0
  );
}

/* --- Formatting -------------------------------------------------------------- */

/** "1h 34m" — the format the reference screens use, minutes truncated. */
export function formatDuration(ms) {
  const safe = Math.max(0, ms);
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLongDate(ms = Date.now()) {
  return new Date(ms).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}



/* --- Clock actions ----------------------------------------------------------- */

export function clockIn(notes = '', now = Date.now()) {
  const state = read();
  // Guard rather than stack a second shift: two running entries would make
  // every total double-count, and there is no UI that could untangle it.
  if (state.entries.some((entry) => entry.out === null)) return null;

  const entry = { id: nextId(), in: now, out: null, breaks: [], notes };
  state.entries.push(entry);
  write(state);
  return entry;
}

export function clockOut(now = Date.now()) {
  const state = read();
  const entry = state.entries.find((e) => e.out === null);
  if (!entry) return null;
  // Clocking out mid-break would leave an unterminated break that then runs
  // forever against a finished shift. Close it at the same instant.
  for (const b of entry.breaks) if (b.end === null) b.end = now;
  entry.out = now;
  write(state);
  return entry;
}

export function startBreak(now = Date.now()) {
  const state = read();
  const entry = state.entries.find((e) => e.out === null);
  if (!entry || entry.breaks.some((b) => b.end === null)) return null;
  entry.breaks.push({ start: now, end: null });
  write(state);
  return entry;
}

export function endBreak(now = Date.now()) {
  const state = read();
  const entry = state.entries.find((e) => e.out === null);
  const open = entry?.breaks.find((b) => b.end === null);
  if (!open) return null;
  open.end = now;
  write(state);
  return entry;
}

export function setNotes(id, notes) {
  const state = read();
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.notes = notes;
  write(state);
  return entry;
}

/** Test hook — wipes the log. Not reachable from the UI. */
export function resetAll() {
  write(emptyState());
}
