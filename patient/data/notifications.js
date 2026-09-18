/**
 * NOTIFICATIONS — what the bell in the top bar is counting.
 *
 * The bell drew "02" and did nothing when pressed. Two was already a claim
 * about data that did not exist anywhere, so this is the list that claim was
 * always about, and NOTIFICATION_COUNT in lib/shell.js is now derived from it
 * rather than being a literal that could drift.
 *
 * EVERY ONE OF THEM IS ABOUT SOMETHING THAT EXISTS
 *
 * A notification whose link goes nowhere is worse than no notification: it
 * teaches the patient that the bell is decoration. So each row below names a
 * real fixture row — a form in data/forms.js, a thread in data/messages.js, a
 * report in data/health.js, an appointment in data/appointments.js — and
 * carries the address that opens it, including the deep-link parameter that
 * makes the target scroll to and flash the right item.
 *
 * READ STATE IS PERSISTED. Marking one read has to survive the navigation it
 * causes — the whole interaction is "press it, go there" — and a badge that
 * silently resets on the next page load would make the count meaningless.
 * localStorage holds the ids that have been read; the list itself stays a
 * fixture, so a reviewer can get the unread state back by clearing the key.
 */

const KEY = 'medinova.patient.notifications.v1';
const VERSION = 1;

/**
 * `unread` here is the SEEDED state, not the live one. Whether a row is
 * actually unread is `unread && !hasBeenRead(id)` — see notifications().
 *
 * `icon` names a symbol in lib/icons.js. `href` is where pressing it goes:
 * the deep-link parameters (`highlight`, `thread`, `report`) are read by the
 * target screens, which scroll the item into view and flash it.
 *
 * `when` is a relative phrase rather than a timestamp. These are fixtures
 * with fixed dates in a prototype whose "today" moves, and computing "2 days
 * ago" from a hard-coded date would drift into "412 days ago" by next year.
 * A real build derives this from the timestamp.
 */
export const NOTIFICATIONS = [
  {
    id: 'nt-form-interview',
    kind: 'form',
    icon: 'clipboard',
    title: 'Patient Interview Form is due 09/01/2026',
    body: 'Your care team reads it before your visit on September 5.',
    when: '2 days ago',
    unread: true,
    href: 'forms.html?highlight=form-interview',
  },
  {
    id: 'nt-message-cooper',
    kind: 'message',
    icon: 'chat',
    title: 'New message from Cooper Kristin',
    body: 'About your recent results and what happens next.',
    when: '3 days ago',
    unread: true,
    href: 'messages.html?thread=th-livia',
  },
  {
    id: 'nt-report-cbc',
    kind: 'report',
    icon: 'record',
    title: 'Your CBC result is ready',
    body: 'Ordered by Jane Cooper on 10/28/2025. Flagged abnormal.',
    when: 'Last week',
    unread: false,
    href: 'health-reports.html?report=rep-cbc',
  },
  {
    id: 'nt-appointment-sep',
    kind: 'appointment',
    icon: 'calendar',
    title: 'Upcoming appointment with Jane Cooper',
    body: 'September 5, 2026. Bring your insurance card.',
    when: 'Last week',
    unread: false,
    href: 'appointment.html',
  },
  {
    id: 'nt-form-insurance',
    kind: 'form',
    icon: 'clipboard',
    title: 'Insurance Disclosure needs your signature',
    body: 'Sent 08/14/2026 so we can bill your insurer directly.',
    when: '2 weeks ago',
    unread: false,
    href: 'forms.html?highlight=form-insurance-disclosure',
  },
];

/* ============================================================================
   READ STATE
   ========================================================================= */

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return parsed?.version === VERSION ? parsed : { version: VERSION, readIds: [] };
  } catch {
    return { version: VERSION, readIds: [] };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Private browsing. The count is right for this page view. */
  }
}

const hasBeenRead = (id) => read().readIds.includes(id);

/**
 * The list as it actually stands, newest first, with `unread` resolved.
 *
 * Callers get a copy rather than the fixture, so nothing downstream can mark
 * one read by assignment and bypass the store.
 */
export const notifications = () =>
  NOTIFICATIONS.map((entry) => ({ ...entry, unread: entry.unread && !hasBeenRead(entry.id) }));

/** What the badge shows. Zero means no badge at all, not "00". */
export const unreadCount = () => notifications().filter((entry) => entry.unread).length;

export function markRead(id) {
  const state = read();
  if (!state.readIds.includes(id)) state.readIds.push(id);
  write(state);
  return unreadCount();
}

export function markAllRead() {
  write({ version: VERSION, readIds: NOTIFICATIONS.map((entry) => entry.id) });
  return 0;
}

/** Test hook — puts the seeded unread state back. Not reachable from the UI. */
export function resetNotifications() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
