/**
 * WAIT LIST — patients who want an appointment sooner than the one they have,
 * or who have no appointment yet and are waiting for something to open up.
 *
 * WHAT AN ENTRY IS
 * Not a booking. It is a standing request: this patient, this activity, with
 * this provider if possible, at this location, any time inside a date window
 * and on these days of the week. Nothing is reserved and nobody is expected —
 * which is exactly why it is a separate list rather than an appointment with a
 * flag on it.
 *
 * WHY IT MATTERS ON THE CALENDAR
 * A cancellation is the only time a wait list pays for itself, and that is the
 * moment the desk is looking at the calendar, not at a list. So the calendar
 * asks: new appointment, or somebody already waiting for this slot? Answering
 * from the schedule is the whole point; a wait list nobody opens is a list of
 * names.
 *
 * WHAT IS NOT ON THIS LIST
 * Procedures. A scope list is deferred and brought forward on the list itself
 * — by Status, with prep instructions, an anaesthetist and a suite tied to the
 * date — so a cancelled 10:15 colonoscopy is not filled by ringing the next
 * name in a queue. Every activity here is clinic work: office visits, virtual
 * appointments, infusion chair time. The booking form says the same thing by
 * giving its procedure field set no "Add to wait list" checkbox, and the
 * wait-list drawer offers only the clinic's activity types.
 *
 * All names, dates and contact details below are invented. No real patients.
 */

/** The window and the days a request is good for. */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WAITLIST_PRIORITIES = {
  routine: { label: 'Routine', tone: 'neutral' },
  soon: { label: 'Soon', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'critical' },
};

/**
 * The seeded list.
 *
 * `mrn` joins to data/directory.js, so a row never carries a name the
 * directory would disagree with — the table reads the patient through the
 * same lookup every other screen uses.
 *
 *   from/to      the window the patient is available in (ISO)
 *   start/end    a time-of-day preference, both optional — most requests have
 *                none, and an empty column is the honest rendering of that
 *   days         weekday indexes the patient can attend; empty means any
 */
const SEED = [
  { id: 'WL-1041', mrn: '326491', activity: 'at2', providerId: 'pr1', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-16', to: '2026-08-26', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-14', note: 'Prefers mornings' },
  { id: 'WL-1042', mrn: '326492', activity: 'at3', providerId: 'pr1', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-27', to: '2026-09-02', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-20', note: '' },
  { id: 'WL-1043', mrn: '326493', activity: 'at1', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-27', to: '2026-09-01', start: '', end: '', days: [], priority: 'soon', addedOn: '2026-07-21', note: 'Symptoms worsening' },
  { id: 'WL-1044', mrn: '326494', activity: 'at3', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-17', to: '2026-08-24', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-15', note: '' },
  { id: 'WL-1045', mrn: '326486', activity: 'at3', providerId: 'pr1', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-30', to: '2026-09-02', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-28', note: '' },
  { id: 'WL-1046', mrn: '326477', activity: 'at4', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-22', to: '2026-08-27', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-20', note: '' },
  { id: 'WL-1047', mrn: '326490', activity: 'at3', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-13', to: '2026-08-18', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-10', note: '' },
  // A patient who can only come on weekdays — the case the Days column exists
  // for. It used to be an EGD at the ASC, which was the wrong example twice
  // over: a scope is not waitlisted at all (see WHAT IS NOT ON THIS LIST
  // above), and the request it modelled would never have been made.
  { id: 'WL-1048', mrn: '326476', activity: 'at36', providerId: 'pr3', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-30', to: '2026-08-27', start: '', end: '', days: [1, 2, 3, 4, 5], priority: 'soon', addedOn: '2026-07-25', note: 'Weekends unavailable — works alternate shifts' },
  { id: 'WL-1049', mrn: '326475', activity: 'at3', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-08-03', to: '2026-09-08', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-08-01', note: '' },
  { id: 'WL-1050', mrn: '326474', activity: 'at1', providerId: 'pr1', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-08-10', to: '2026-09-10', start: '09:00', end: '12:00', days: [], priority: 'urgent', addedOn: '2026-08-05', note: 'Mornings only — carer availability' },
  { id: 'WL-1051', mrn: '326473', activity: 'at4', providerId: 'pr2', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-08-05', to: '2026-09-10', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-08-03', note: '' },
  { id: 'WL-1052', mrn: '326482', activity: 'at1', providerId: 'pr1', location: 'GastroEMR Gastroenterology — Fargo', from: '2026-07-27', to: '2026-09-01', start: '', end: '', days: [], priority: 'routine', addedOn: '2026-07-24', note: '' },
];

/* ===================== The store ===================== */

/* v2: v1 sessions can still be holding the procedure request that used to be
   seeded here, and a stale row naming an activity the drawer no longer offers
   would edit to a blank Activity. Bumping the key retires those rows with the
   seed that created them. */
const KEY = 'medinova.waitlist.v2';

const clone = (rows) => rows.map((r) => ({ ...r, days: [...r.days] }));

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let entries = read() ?? clone(SEED);
let nextId = 1053;

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* A prototype that cannot persist still has to run. */
  }
}

export const allWaitlist = () => clone(entries);

export const waitlistById = (id) => {
  const found = entries.find((e) => e.id === id);
  return found ? { ...found, days: [...found.days] } : null;
};

export const waitlistCount = () => entries.length;

export function addToWaitlist(entry) {
  const record = {
    id: `WL-${nextId++}`,
    days: [],
    start: '',
    end: '',
    note: '',
    priority: 'routine',
    addedOn: new Date().toISOString().slice(0, 10),
    ...entry,
  };
  entries = [record, ...entries];
  persist();
  return record;
}

/**
 * Change a standing request in place.
 *
 * In place, and keeping its id and addedOn: a patient whose window moves or
 * whose priority is raised is the SAME request, and remove-then-add would
 * send them to the back of a queue ordered by how long they have waited. That
 * is the one thing editing must not silently do.
 *
 * @param {string} id
 * @param {object} patch  only the fields being changed
 * @returns {object|null} the updated entry, or null if the id is unknown
 */
export function updateWaitlistEntry(id, patch) {
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const updated = { ...entries[index], ...patch, id, addedOn: entries[index].addedOn };
  updated.days = [...(patch.days ?? entries[index].days)];
  entries[index] = updated;
  persist();
  return { ...updated, days: [...updated.days] };
}

export function removeFromWaitlist(id) {
  const before = entries.length;
  entries = entries.filter((e) => e.id !== id);
  persist();
  return entries.length < before;
}

/**
 * Which waiting patients could take a slot on this date.
 *
 * The date has to fall inside the window AND on a day the patient said they
 * can attend. Provider and location are NOT filtered here — the desk offering
 * a cancelled slot to somebody who asked for a different clinician is a
 * conversation, not an error, and hiding those rows would hide the person the
 * slot is actually for.
 */
export function waitingFor(iso, { providerId } = {}) {
  if (!iso) return [];
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  return clone(entries)
    .filter((e) => iso >= e.from && iso <= e.to)
    .filter((e) => !e.days.length || e.days.includes(weekday))
    .map((e) => ({ ...e, matchesProvider: !providerId || e.providerId === providerId }))
    .sort((a, b) => {
      // The ones who asked for this clinician first, then by how long they
      // have been waiting — the two things the desk actually decides on.
      if (a.matchesProvider !== b.matchesProvider) return a.matchesProvider ? -1 : 1;
      const rank = { urgent: 0, soon: 1, routine: 2 };
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      return a.addedOn.localeCompare(b.addedOn);
    });
}

/** 'Mon, Tue, Wed' — or an empty string, which reads as "any day". */
export const daysList = (days) => (days ?? []).map((d) => WEEKDAYS[d]).join(', ');

/**
 * The same set said short enough to sit in a narrow column: 'Mon–Fri' rather
 * than 'Mon, Tue, Wed, Thu, Fri'. Somebody available every weekday is the
 * commonest entry on the list, and spelling all five out is what pushed the
 * Days column into its neighbour. Runs of three or more collapse to a range,
 * anything shorter stays listed — 'Mon, Thu' is already as short as it gets,
 * and 'Mon–Tue' would read as a range where there is none.
 *
 * Weeks are read Monday-first here, so Sunday sorts last: a Sat/Sun request
 * is a weekend, not a run that wraps around the end of the array.
 */
export function daysLabel(days) {
  const set = [...new Set(days ?? [])];
  if (!set.length) return '';
  if (set.length === 7) return 'Every day';

  // Monday-first index, so Sunday (0) becomes 6.
  const ordered = set.map((d) => (d + 6) % 7).sort((a, b) => a - b);
  const name = (i) => WEEKDAYS[(i + 1) % 7];

  if (ordered.length === 5 && ordered.every((d, i) => d === i)) return 'Weekdays';
  if (ordered.length === 2 && ordered[0] === 5 && ordered[1] === 6) return 'Weekends';

  const parts = [];
  for (let i = 0; i < ordered.length; ) {
    let j = i;
    while (j + 1 < ordered.length && ordered[j + 1] === ordered[j] + 1) j += 1;
    parts.push(j - i >= 2 ? `${name(ordered[i])}–${name(ordered[j])}` : ordered.slice(i, j + 1).map(name).join(', '));
    i = j + 1;
  }
  return parts.join(', ');
}

/** '2026-07-16' → '7/16/2026', the format the reference list uses. */
export function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
}
