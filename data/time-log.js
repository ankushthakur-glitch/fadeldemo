/**
 * DEMO DATA — every shift below is invented. Nobody's real hours.
 *
 * The recorded timesheet the Time report reads. Three sources feed that
 * report and this is the largest of them:
 *
 *   this file                    the practice's punch history
 *   js/lib/time-clock-store.js   the signed-in user's live punches, today
 *   js/lib/timesheet-store.js    manual entries and admin corrections
 *
 * The roster is looked up in Settings ▸ Practice ▸ Users rather than invented
 * here, so a name on a timesheet is a name in the user directory. Only ACTIVE
 * accounts appear: a pending account has never signed in, so it has never
 * punched a clock.
 *
 * Entries use the SAME SHAPE as the live clock's ({ in, out, breaks: [{start,
 * end}] }), so workedMs() and breakMs() from the clock store measure a demo
 * shift and a real one identically. There is one definition of "worked time",
 * not one per source.
 *
 * Nothing here is random. A reviewer who reloads has to see the same hours, or
 * "the total changed while I was reading it" becomes a bug report.
 */
import { USERS } from './practice.js';

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** Far enough back to cover several pay periods, short enough to stay legible. */
const WEEKS_OF_HISTORY = 10;

/* ============================================================================
   THE ROSTER

   Each person's normal week, because a timesheet is only interesting where it
   departs from one. days are JS weekday numbers (1 = Monday).

   `exempt` is the overtime question, not a seniority one: salaried clinical
   staff are exempt from overtime, hourly staff are not. The report shows a
   dash rather than 0h of overtime for exempt people — 0 would claim they
   worked no extra hours, which is a different statement.
   ========================================================================= */

const PATTERNS = [
  { userId: null, name: 'Amara Mensah', role: 'Physician', exempt: true,
    days: [1, 2, 3, 4, 5], start: 7.5, hours: 9.5, lunch: 30 },
  { userId: 'u3', exempt: true, days: [1, 2, 3, 4, 5], start: 8, hours: 9, lunch: 45 },
  { userId: 'u2', exempt: false, days: [1, 2, 3, 4, 5], start: 6.75, hours: 8.5, lunch: 30 },
  { userId: 'u5', exempt: true, days: [1, 2, 4, 5], start: 8.5, hours: 9, lunch: 45 },
  { userId: 'u6', exempt: false, days: [1, 2, 3, 4, 5], start: 8.5, hours: 8, lunch: 60 },
  { userId: 'u8', exempt: false, days: [1, 2, 3, 4, 5], start: 7, hours: 8, lunch: 45 },
];

/**
 * The signed-in identity, and the one the header's clock widget writes for.
 * Named once here so the report, the CSV and the audit trail cannot disagree
 * about whose punches the live clock is producing.
 */
export const SIGNED_IN_EMPLOYEE = 'emp-amara';

export const TIME_EMPLOYEES = PATTERNS.map((pattern) => {
  const user = pattern.userId ? USERS.find((u) => u.id === pattern.userId) : null;
  const name = pattern.name ?? user?.name ?? 'Unknown';
  return {
    id: pattern.userId ? `emp-${pattern.userId}` : SIGNED_IN_EMPLOYEE,
    name,
    role: pattern.role ?? user?.role ?? '—',
    exempt: pattern.exempt,
  };
});

export const EMPLOYEE_INDEX = Object.fromEntries(TIME_EMPLOYEES.map((e) => [e.id, e]));

export function employeeName(id) {
  return EMPLOYEE_INDEX[id]?.name ?? 'Unknown';
}

/* ============================================================================
   PAY PERIODS

   Bi-weekly, the commonest cadence in a US clinic — 26 periods a year, each
   starting on a Monday. Change WEEKS and the anchor and every period label,
   dropdown entry and export follows; nothing else knows the cadence.

   Periods are stepped with setDate() rather than by adding 14 × 86,400,000 ms.
   Two of the year's boundaries cross a daylight-saving change, and a fixed
   millisecond stride lands an hour into the previous day there — which reads
   as a pay period that starts on a Sunday.
   ========================================================================= */

export const PAY_CYCLE = {
  weeks: 2,
  /** A Monday. Every period boundary is a whole number of cycles from here. */
  anchor: new Date(2026, 0, 5),
};

export const OVERTIME_WEEKLY_HOURS = 40;

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(value, days) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Midnight on the first day of the pay period containing `ms`. */
export function payPeriodStart(ms) {
  const anchor = startOfDay(PAY_CYCLE.anchor);
  const days = Math.round((startOfDay(ms) - anchor) / 86_400_000);
  const span = PAY_CYCLE.weeks * 7;
  return addDays(anchor, Math.floor(days / span) * span);
}

/** The [from, to) bounds of the period containing `ms`, plus its label. */
export function payPeriodFor(ms) {
  const from = payPeriodStart(ms);
  const to = addDays(from, PAY_CYCLE.weeks * 7);
  return { from: from.getTime(), to: to.getTime(), id: dayId(from) };
}

/** The `count` most recent periods, current first. */
export function payPeriods(count = 8, now = Date.now()) {
  const list = [];
  let cursor = payPeriodStart(now);
  for (let i = 0; i < count; i += 1) {
    const to = addDays(cursor, PAY_CYCLE.weeks * 7);
    list.push({ id: dayId(cursor), from: cursor.getTime(), to: to.getTime(), current: i === 0 });
    cursor = addDays(cursor, -PAY_CYCLE.weeks * 7);
  }
  return list;
}

/** Local YYYY-MM-DD. Not toISOString(), which files an evening west of UTC
 *  under tomorrow's date. */
export function dayId(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ============================================================================
   THE PUNCH HISTORY

   Built at load from today's date, so the report is never showing a stale
   month. Everything varies by a fixed arithmetic wobble rather than by
   Math.random(): the same reviewer reloading sees the same timesheet.
   ========================================================================= */

/** ±10 minutes of human imprecision, repeating every seven shifts. */
function wobble(seed) {
  return ((seed * 7) % 5) - 2;
}

function buildEntry({ employeeId, day, pattern, seed }) {
  const base = startOfDay(day).getTime();
  const start = base + pattern.start * HOUR + wobble(seed) * 5 * MINUTE;

  /* Every fifth shift runs long. Somebody stays late — that is where overtime
     comes from, and a timesheet where nobody ever does is not worth a report. */
  const extra = seed % 5 === 0 ? 1.25 * HOUR : 0;
  const end = start + pattern.hours * HOUR + extra + wobble(seed + 3) * 5 * MINUTE;

  /* Lunch is taken roughly four hours in — near enough that a break column
     reads as a lunch break rather than as an unexplained gap. */
  const lunchStart = start + 4 * HOUR + wobble(seed + 1) * 10 * MINUTE;

  return {
    id: `tl-${employeeId}-${dayId(day)}`,
    employeeId,
    in: start,
    out: end,
    breaks: [{ start: lunchStart, end: lunchStart + pattern.lunch * MINUTE }],
    notes: '',
    source: 'clock',
  };
}

/**
 * The whole practice's history, oldest first.
 *
 * Two departures from the pattern are deliberate, because they are what an
 * administrator actually opens this report to deal with:
 *
 *   MISSING PUNCH   a shift clocked in and never clocked out. It is left with
 *                   out: null on a past day, which the report reads as an
 *                   exception rather than as a shift still running — see
 *                   isMissingPunch() in the screen.
 *   WEEKEND COVER   one Saturday inside the current pay period, which pushes
 *                   that person's week past forty hours.
 */
export function buildTimeLog(now = Date.now()) {
  const entries = [];
  const today = startOfDay(now);
  const firstDay = addDays(today, -(WEEKS_OF_HISTORY * 7));

  TIME_EMPLOYEES.forEach((employee, employeeIndex) => {
    const pattern = PATTERNS[employeeIndex];
    let seed = employeeIndex * 3;

    for (let cursor = new Date(firstDay); cursor <= today; cursor = addDays(cursor, 1)) {
      if (!pattern.days.includes(cursor.getDay())) continue;

      const isToday = dayId(cursor) === dayId(today);

      /* Today's shift for the signed-in user is the live clock's business, not
         history's: the header widget is writing it right now, and inventing a
         second one would double-count the day. */
      if (isToday && employee.id === SIGNED_IN_EMPLOYEE) continue;

      seed += 1;
      const entry = buildEntry({ employeeId: employee.id, day: cursor, pattern, seed });

      if (isToday) {
        /* Everybody else is mid-day. Someone who has not arrived yet has no
           entry at all, and someone still on the floor has no clock-out —
           which is what "Running" means, and it is only true of today. */
        if (entry.in > now) continue;
        if (entry.out > now) {
          entry.out = null;
          entry.breaks = entry.breaks.filter((b) => b.end <= now);
        }
      }

      entries.push(entry);
    }
  });

  applyMissingPunch(entries, today);
  addWeekendCover(entries, today);

  return entries.sort((a, b) => a.in - b.in);
}

/** Esther's badge did not register a clock-out four working days ago. */
function applyMissingPunch(entries, today) {
  const target = entries
    .filter((e) => e.employeeId === 'emp-u2' && e.in < addDays(today, -3).getTime())
    .pop();
  if (!target) return;
  target.out = null;
  target.breaks = [];
  target.notes = 'Badge reader offline at close';
}

/** Ryan covered a Saturday clinic in the current pay period. */
function addWeekendCover(entries, today) {
  const period = payPeriodFor(today);
  let saturday = new Date(period.from);
  while (saturday.getDay() !== 6) saturday = addDays(saturday, 1);
  if (saturday.getTime() >= today.getTime()) return;

  const start = saturday.setHours(8, 0, 0, 0);
  entries.push({
    id: `tl-emp-u8-${dayId(saturday)}-cover`,
    employeeId: 'emp-u8',
    in: start,
    out: start + 6 * HOUR,
    breaks: [{ start: start + 3 * HOUR, end: start + 3.5 * HOUR }],
    notes: 'Weekend endoscopy cover',
    source: 'clock',
  });
}

/* ============================================================================
   ADJUSTMENTS

   A correction has to say why. The list is short and specific on purpose: a
   free-text-only reason box fills up with "fixed" and stops being an audit
   trail. "Other" keeps the honest escape hatch, and the screen requires a note
   with it.
   ========================================================================= */

export const ADJUSTMENT_REASONS = [
  'Missed clock-in',
  'Missed clock-out',
  'Forgot to clock out for break',
  'Badge or terminal fault',
  'Worked off-site',
  'Approved schedule change',
  'Payroll correction',
  'Other',
];

/* ============================================================================
   WHO MAY ADMINISTER TIME

   Timekeeping is a management function. Somebody who is not an administrator
   gets their own hours and nothing else: no roster, no adjust action, no
   manual entry. That is not decoration — reading a colleague's shift pattern
   is reading when they are alone in the building.
   ========================================================================= */

export const TIMEKEEPING_ADMIN_ROLES = [
  'Practice Admin',
  'Super Admin',
  'Practice Manager',
  'Operations Manager',
  'Office Manager',
  'Billing Manager',
];

/**
 * The practice owner. The prototype has one working sign-in and it is hers
 * (js/lib/auth-store.js), where she is recorded by clinical role — Physician —
 * because that is what she practises as. She is also the person who created
 * every user in Settings ▸ Practice ▸ Users, i.e. this practice's
 * administrator. Naming her here keeps the role list above honest: it is a
 * list of management roles, not a list bent to let the demo account in.
 */
export const PRACTICE_OWNER = 'Amara Mensah';

export function canAdministerTime(session) {
  if (!session) return false;
  return session.name === PRACTICE_OWNER || TIMEKEEPING_ADMIN_ROLES.includes(session.role);
}
