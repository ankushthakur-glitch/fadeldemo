/**
 * Time report — the first report in the Reports section.
 *
 * WHAT THIS SCREEN IS
 * The practice's timesheet: who worked, when, for how long, and what payroll
 * should be paid for it. It answers two questions with the same layout — "how
 * did the practice do this pay period" (all employees) and "what did this
 * person work" (one employee) — because they are the same report at two
 * depths, not two reports.
 *
 * THREE SOURCES, ONE RECORD
 *   data/time-log.js            the practice's punch history
 *   js/lib/time-clock-store.js  the signed-in user's live punches, today
 *   js/lib/timesheet-store.js   manual entries and administrator corrections
 *
 * They are composed here and nowhere else. Corrections are an OVERLAY: the
 * punch the clock recorded is never edited, so the report can always show both
 * what the badge saw and what payroll agreed. See timesheet-store.js.
 *
 * WHAT COUNTS AS TIME
 *   worked        (out − in) − breaks. A break is never paid twice by being
 *                 left inside the total.
 *   running       a shift with no clock-out that started TODAY. Real.
 *   missing punch a shift with no clock-out on any earlier day. NOT time: it
 *                 counts as zero hours and is raised as an exception, because
 *                 "clocked in last Tuesday and never out" is not a 140-hour
 *                 shift, it is a mistake nobody has fixed yet.
 *   overtime      hours past forty in a calendar week, for non-exempt staff
 *                 only. Weeks are computed from the whole week's work, then
 *                 apportioned into the range on screen — see weeklyOvertime().
 *
 * WHO SEES WHAT
 * An administrator sees the roster and can correct it. Everyone else sees
 * their own hours, read-only: a colleague's shift pattern is a record of when
 * they are alone in the building. Add ?as=employee to review that view.
 */
import { createPager } from '../lib/pagination.js';
import * as clock from '../lib/time-clock-store.js';
import * as sheet from '../lib/timesheet-store.js';
import { currentSession } from '../lib/auth-store.js';
import { notify } from '../lib/toast.js';
import {
  ADJUSTMENT_REASONS,
  EMPLOYEE_INDEX,
  OVERTIME_WEEKLY_HOURS,
  PAY_CYCLE,
  PRACTICE_OWNER,
  SIGNED_IN_EMPLOYEE,
  TIME_EMPLOYEES,
  buildTimeLog,
  canAdministerTime,
  dayId,
  payPeriodFor,
  payPeriods,
} from '../../data/time-log.js';

const MINUTE = 60_000;
const HOUR = 3_600_000;

/* The recorded history is built once, from the moment the screen opened. It is
   not re-derived on every paint: a report whose fixtures shift under a filter
   change would show different totals for the same range. */
const HISTORY = buildTimeLog();

/**
 * Who is looking.
 *
 * Every screen in this prototype is reachable without signing in, and the app
 * chrome already names the practice owner in its avatar. With no session, the
 * screen assumes that same identity rather than locking a reviewer out of the
 * report they opened.
 */
function viewer() {
  const session = currentSession() ?? { name: PRACTICE_OWNER, role: 'Physician' };
  const asEmployee = new URLSearchParams(location.search).get('as') === 'employee';
  return {
    name: session.name,
    role: session.role,
    admin: !asEmployee && canAdministerTime(session),
  };
}

/* --- Dates -------------------------------------------------------------------
   Every step below moves whole DATES, never a fixed number of milliseconds.
   Two weeks of 86,400,000 lands an hour out across a daylight-saving change,
   which is enough to move a shift into the previous pay period. */

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

function addMonths(value, months) {
  const d = new Date(value);
  d.setMonth(d.getMonth() + months, 1);
  return d;
}

/** Monday-first, matching the scheduler's week and the pay cycle's. */
function startOfWeek(value) {
  const d = startOfDay(value);
  return addDays(d, -((d.getDay() + 6) % 7));
}

function startOfMonth(value) {
  const d = startOfDay(value);
  d.setDate(1);
  return d;
}

function isSameDay(a, b) {
  return dayId(a) === dayId(b);
}

/* --- Field <-> timestamp ------------------------------------------------------ */

const toDateField = (ms) => dayId(ms);

function fromDateField(text) {
  const [y, m, d] = String(text || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : NaN;
}

function toTimeField(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A time is only meaningful against a date — 09:15 of which day. */
function fromTimeField(dayMs, text) {
  const [h, m] = String(text || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  const d = new Date(dayMs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const toMonthField = (ms) => dayId(ms).slice(0, 7);

function fromMonthField(text) {
  const [y, m] = String(text || '').split('-').map(Number);
  return y ? new Date(y, m - 1, 1).getTime() : NaN;
}

/* --- Formatting ---------------------------------------------------------------- */

function formatDay(ms) {
  return new Date(ms).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDay(ms) {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Hours as a decimal, the way a payroll export wants them. */
function decimalHours(ms) {
  return (Math.max(0, ms) / HOUR).toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* --- The visible state --------------------------------------------------------
   The whole report is a function of these five values, so every control does
   exactly one thing: change one of them and repaint. */

const state = {
  employee: 'all',
  period: 'Week',
  /** Any day inside the period being shown. The period type turns it into
      bounds — see resolveRange(). */
  anchor: startOfDay(Date.now()).getTime(),
  custom: { from: startOfWeek(Date.now()).getTime(), to: startOfDay(Date.now()).getTime() },
  exceptionsOnly: false,
};

const PERIODS = ['Day', 'Week', 'Pay period', 'Month', 'Custom range'];

/** [from, to) — `to` is exclusive, so a day is midnight to midnight. */
function resolveRange() {
  const anchor = state.anchor;
  switch (state.period) {
    case 'Day': {
      const from = startOfDay(anchor);
      return [from.getTime(), addDays(from, 1).getTime()];
    }
    case 'Pay period': {
      const period = payPeriodFor(anchor);
      return [period.from, period.to];
    }
    case 'Month': {
      const from = startOfMonth(anchor);
      return [from.getTime(), addMonths(from, 1).getTime()];
    }
    case 'Custom range': {
      const from = startOfDay(state.custom.from);
      /* The To field names a day the report should INCLUDE. Payroll ranges are
         inclusive of both ends; a range that quietly stopped at midnight on the
         morning of the last day would drop that day's shifts. */
      const to = addDays(startOfDay(state.custom.to), 1);
      return [from.getTime(), Math.max(from.getTime(), to.getTime())];
    }
    case 'Week':
    default: {
      const from = startOfWeek(anchor);
      return [from.getTime(), addDays(from, 7).getTime()];
    }
  }
}

function rangeLabel([from, to]) {
  const last = addDays(to, -1).getTime();
  if (state.period === 'Day') return formatDay(from);
  if (state.period === 'Pay period') {
    return `${formatShortDay(from)} — ${formatShortDay(last)} · ${PAY_CYCLE.weeks}-week pay period`;
  }
  if (state.period === 'Month') {
    return new Date(from).toLocaleDateString([], { month: 'long', year: 'numeric' });
  }
  return `${formatShortDay(from)} — ${formatShortDay(last)}`;
}

/* --- Composing the record ------------------------------------------------------ */

/**
 * Every entry the viewer is allowed to see, with corrections applied.
 *
 * Live clock entries carry no employee of their own: the header widget only
 * ever writes for whoever is signed in, which is the identity this screen
 * already assumes.
 */
function allEntries() {
  const live = clock.getEntries().map((entry) => ({
    ...entry,
    employeeId: SIGNED_IN_EMPLOYEE,
    source: 'clock',
  }));

  return [...HISTORY, ...live, ...sheet.manualEntries()].map((entry) =>
    sheet.applyAdjustment(entry)
  );
}

function isRunning(entry, now) {
  return entry.out === null && isSameDay(entry.in, now);
}

function isMissingPunch(entry, now) {
  return entry.out === null && !isSameDay(entry.in, now);
}

function entryWorkedMs(entry, now) {
  if (isMissingPunch(entry, now)) return 0;
  return clock.workedMs(entry, now);
}

function entryBreakMs(entry, now) {
  if (isMissingPunch(entry, now)) return 0;
  return clock.breakMs(entry, now);
}

/**
 * Overtime, computed on whole weeks and then apportioned into the range.
 *
 * Overtime is a fact about a week, not about a shift or a report: the same
 * Thursday is overtime or not depending on the Monday to Wednesday before it.
 * So each entry's week is totalled IN FULL — including days outside the range
 * on screen — and the hours past forty are attributed to the shifts that
 * crossed the line, latest first. A range that starts mid-week therefore still
 * reports the right overtime for the days it does show.
 *
 * Exempt staff have no overtime to apportion; their extra hours are simply
 * hours, and the column shows a dash rather than a zero.
 */
function weeklyOvertime(entries, now) {
  const overtime = new Map(); // entry id -> ms of this entry that is overtime
  const weeks = new Map();

  for (const entry of entries) {
    if (EMPLOYEE_INDEX[entry.employeeId]?.exempt) continue;
    const key = `${entry.employeeId}|${dayId(startOfWeek(entry.in))}`;
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(entry);
  }

  for (const week of weeks.values()) {
    const ordered = [...week].sort((a, b) => a.in - b.in);
    const threshold = OVERTIME_WEEKLY_HOURS * HOUR;
    let running = 0;

    for (const entry of ordered) {
      const worked = entryWorkedMs(entry, now);
      const before = running;
      running += worked;
      if (running <= threshold) continue;
      // Only the part of this shift that crossed forty hours is overtime.
      overtime.set(entry.id, Math.min(worked, running - Math.max(threshold, before)));
    }
  }

  return overtime;
}

/** Everything the tiles, the tables and the export are computed from. */
function report() {
  const now = Date.now();
  const [from, to] = resolveRange();
  const view = viewer();

  const mine = view.admin
    ? allEntries()
    : allEntries().filter((entry) => entry.employeeId === SIGNED_IN_EMPLOYEE);

  const inRange = mine
    .filter((entry) => entry.in >= from && entry.in < to)
    .filter((entry) => state.employee === 'all' || entry.employeeId === state.employee)
    .sort((a, b) => b.in - a.in); // newest first — the shift you just worked

  /* Overtime is measured against the FULL weeks the range touches, not against
     the range, so it is computed from the unfiltered log. */
  const weekFrom = startOfWeek(from).getTime();
  const weekTo = addDays(startOfWeek(addDays(to, -1)), 7).getTime();
  const overtime = weeklyOvertime(
    mine
      .filter((entry) => entry.in >= weekFrom && entry.in < weekTo)
      .filter((entry) => state.employee === 'all' || entry.employeeId === state.employee),
    now
  );

  const rows = inRange.map((entry) => {
    const worked = entryWorkedMs(entry, now);
    const over = overtime.get(entry.id) ?? 0;
    return {
      entry,
      employee: EMPLOYEE_INDEX[entry.employeeId] ?? { name: 'Unknown', role: '—', exempt: false },
      worked,
      breaks: entryBreakMs(entry, now),
      overtime: over,
      regular: Math.max(0, worked - over),
      running: isRunning(entry, now),
      missing: isMissingPunch(entry, now),
      adjusted: Boolean(entry.adjustment),
      manual: entry.source === 'manual',
    };
  });

  const exceptions = rows.filter((row) => row.missing);
  /* Correcting the last exception while filtered to exceptions would otherwise
     leave the screen on an empty table that reads as "everything vanished". */
  if (!exceptions.length) state.exceptionsOnly = false;
  const visible = state.exceptionsOnly ? exceptions : rows;

  return { now, from, to, view, rows, visible, exceptions, totals: totalsFor(rows) };
}

function totalsFor(rows) {
  const worked = rows.reduce((sum, r) => sum + r.worked, 0);

  /* A day counted PER PERSON, not per calendar date. Six people working
     Monday is six days worked, and the average that falls out of it is the
     length of a working day — which is the number anyone reads it as. Counting
     calendar dates instead made "average per day" the practice's combined
     hours, so a normal Monday averaged thirty-nine hours. */
  const days = new Set(rows.map((r) => `${r.entry.employeeId}|${dayId(r.entry.in)}`)).size;
  return {
    worked,
    breaks: rows.reduce((sum, r) => sum + r.breaks, 0),
    overtime: rows.reduce((sum, r) => sum + r.overtime, 0),
    regular: rows.reduce((sum, r) => sum + r.regular, 0),
    shifts: rows.length,
    days,
    average: days ? worked / days : 0,
  };
}

/** One line per person, for the all-employees view. */
function byEmployee(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = row.entry.employeeId;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      employee: group[0].employee,
      ...totalsFor(group),
    }))
    .sort((a, b) => b.worked - a.worked);
}

/* ============================================================================
   THE SCREEN
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const view = viewer();
  const el = (id) => document.getElementById(id);
  const test = (name) => document.querySelector(`[data-testid="time-report--${name}"]`);

  const whoSelect = el('rWho');
  const periodSelect = el('rPeriod');
  const rowsHost = document.querySelector('[data-rows]');
  const summaryHost = document.querySelector('[data-summary-rows]');
  const summarySection = el('repSummary');
  const emptyNote = document.querySelector('[data-empty]');
  const exceptionsBox = el('repExceptions');
  const modal = el('modalEntry');

  const pager = createPager(document.querySelector('[data-foot="entries"]'), {
    noun: 'entries',
    testidPrefix: 'time-entries',
    onChange: () => paint(),
  });

  /** null = adding, otherwise the row being corrected. */
  let editing = null;

  /* --- Controls ---------------------------------------------------------------- */

  /* No "All employees" row: nothing ticked is what all of them means, and a
     tickable All beside eight names it cancels is a ninth thing to tick. */
  whoSelect.setGroupOptions(
    'employee',
    (view.admin ? TIME_EMPLOYEES : TIME_EMPLOYEES.filter((e) => e.id === SIGNED_IN_EMPLOYEE))
      .map((e) => ({ value: e.id, label: e.name }))
  );

  if (!view.admin) {
    state.employee = SIGNED_IN_EMPLOYEE;
    whoSelect.value = { employee: [SIGNED_IN_EMPLOYEE] };
    whoSelect.setAttribute('disabled', '');
  } else {
    test('add').hidden = false;
  }

  el('fEmployee').setOptions(TIME_EMPLOYEES.map((e) => ({ value: e.id, label: e.name })));
  el('fReason').setOptions(ADJUSTMENT_REASONS);

  /* A link may open the timesheet straight at a period —
     time-reports.html?range=week. The Reports hub used to be the one that did
     it and the hub is gone, but the parameter is not the hub's: it is how any
     link, a bookmark included, says which week it wants. */
  const preset = { today: 'Day', week: 'Week', month: 'Month', period: 'Pay period' }[
    new URLSearchParams(location.search).get('range')
  ];
  if (preset) state.period = preset;
  periodSelect.setAttribute('value', state.period);

  function refreshPayPeriods() {
    /* Eight periods normally — about four months, which is as far back as a
       payroll question usually goes. The list grows to reach the period being
       shown, because stepping back past the eighth would otherwise leave the
       dropdown with no entry matching the report on screen. */
    const cycleMs = PAY_CYCLE.weeks * 7 * 86_400_000;
    const back = Math.round((payPeriodFor(Date.now()).from - payPeriodFor(state.anchor).from) / cycleMs);
    const list = payPeriods(Math.max(8, back + 1), Date.now());
    el('navPeriod').setOptions(
      list.map((p) => ({
        value: p.id,
        label: `${formatShortDay(p.from)} — ${formatShortDay(addDays(p.to, -1))}${
          p.current ? ' (current)' : ''
        }`,
      }))
    );
    el('navPeriod').setAttribute('value', dayId(payPeriodFor(state.anchor).from));
  }

  /** Push the anchor into whichever navigator is on screen. */
  function syncNavigators() {
    document.querySelectorAll('[data-nav]').forEach((nav) => {
      nav.hidden = nav.dataset.nav !== state.period;
    });

    el('navDay').setAttribute('value', toDateField(state.anchor));
    el('navWeek').setAttribute('value', toDateField(startOfWeek(state.anchor)));
    el('navMonth').setAttribute('value', toMonthField(state.anchor));
    el('navFrom').setAttribute('value', toDateField(state.custom.from));
    el('navTo').setAttribute('value', toDateField(state.custom.to));
    refreshPayPeriods();
  }

  periodSelect.addEventListener('ui-change', () => {
    state.period = PERIODS.includes(periodSelect.value) ? periodSelect.value : 'Week';
    state.exceptionsOnly = false;
    pager.reset();
    syncNavigators();
    paint();
  });

  whoSelect.addEventListener('ui-filter-change', (event) => {
    state.employee = event.detail.values.employee[0] ?? 'all';
    pager.reset();
    paint();
  });

  el('navDay').addEventListener('ui-change', () => {
    const ms = fromDateField(el('navDay').value);
    if (Number.isFinite(ms)) state.anchor = ms;
    pager.reset();
    paint();
  });

  el('navWeek').addEventListener('ui-change', () => {
    const ms = fromDateField(el('navWeek').value);
    if (Number.isFinite(ms)) state.anchor = ms;
    pager.reset();
    paint();
  });

  el('navMonth').addEventListener('ui-change', () => {
    const ms = fromMonthField(el('navMonth').value);
    if (Number.isFinite(ms)) state.anchor = ms;
    pager.reset();
    paint();
  });

  el('navPeriod').addEventListener('ui-change', () => {
    const ms = fromDateField(el('navPeriod').value);
    if (Number.isFinite(ms)) state.anchor = ms;
    pager.reset();
    paint();
  });

  ['navFrom', 'navTo'].forEach((id) => {
    el(id).addEventListener('ui-change', () => {
      const from = fromDateField(el('navFrom').value);
      const to = fromDateField(el('navTo').value);
      if (Number.isFinite(from)) state.custom.from = from;
      if (Number.isFinite(to)) state.custom.to = to;
      /* A backwards range is a slip, not an instruction. Pull the other end
         with it rather than reporting on nothing. */
      if (state.custom.to < state.custom.from) {
        if (id === 'navFrom') state.custom.to = state.custom.from;
        else state.custom.from = state.custom.to;
      }
      pager.reset();
      // The fields have to show the range that is actually being reported —
      // silently fixing it behind an unchanged To date is worse than the slip.
      syncNavigators();
      paint();
    });
  });

  el('exceptionsToggle').addEventListener('click', () => {
    state.exceptionsOnly = !state.exceptionsOnly;
    pager.reset();
    paint();
  });

  /* --- Painting ----------------------------------------------------------------- */

  function paint() {
    const data = report();
    const { totals } = data;

    document.querySelector('[data-print-meta]').textContent = [
      state.employee === 'all' ? 'All employees' : EMPLOYEE_INDEX[state.employee]?.name,
      rangeLabel([data.from, data.to]),
      `Generated ${formatShortDay(data.now)} at ${clock.formatTime(data.now)} by ${data.view.name}`,
    ].join(' · ');

    setText('total', clock.formatDuration(totals.worked));
    setText('regular', clock.formatDuration(totals.regular));
    setText('overtime', overtimeLabel(data));
    setText('breaks', clock.formatDuration(totals.breaks));
    setText('shifts', String(totals.shifts));
    setText('days', String(totals.days));
    setText('avg', clock.formatDuration(totals.average));

    paintExceptions(data);
    paintSummary(data);
    paintRows(data);
  }

  function setText(name, text) {
    const node = test(name);
    if (node) node.textContent = text;
  }

  /** A dash, not 0h 0m, when nobody in view can earn overtime. */
  function overtimeLabel(data) {
    const anyNonExempt = data.rows.some((row) => !row.employee.exempt);
    return anyNonExempt || !data.rows.length ? clock.formatDuration(data.totals.overtime) : '—';
  }

  function paintExceptions(data) {
    const count = data.exceptions.length;
    exceptionsBox.hidden = count === 0;
    if (!count) return;

    exceptionsBox.querySelector('[data-exception-text]').textContent =
      count === 1
        ? '1 shift has no clock-out. It counts as zero hours until it is corrected.'
        : `${count} shifts have no clock-out. They count as zero hours until they are corrected.`;

    el('exceptionsToggle').textContent = state.exceptionsOnly
      ? 'Show all entries'
      : 'Show only these';
  }

  function paintSummary(data) {
    const show = state.employee === 'all' && data.view.admin && !state.exceptionsOnly;
    summarySection.hidden = !show;
    if (!show) return;

    summaryHost.innerHTML = byEmployee(data.rows)
      .map(
        /* The name is the control, not the row. A <tr role="button"> would
           take the row out of the table for anyone using a screen reader, to
           buy a click target the cell already provides. */
        (line) => `<tr data-testid="time-report--summary-row">
          <td><button type="button" class="rep__link-btn" data-employee="${line.id}"
            >${escapeHtml(line.employee.name)}</button></td>
          <td class="rep__muted">${escapeHtml(line.employee.role)}</td>
          <td class="ui-table__cell--numeric">${line.days}</td>
          <td class="ui-table__cell--numeric">${line.shifts}</td>
          <td class="ui-table__cell--numeric">${clock.formatDuration(line.breaks)}</td>
          <td class="ui-table__cell--numeric">${clock.formatDuration(line.regular)}</td>
          <td class="ui-table__cell--numeric">${
            line.employee.exempt ? '<span class="rep__muted">—</span>' : clock.formatDuration(line.overtime)
          }</td>
          <td class="ui-table__cell--numeric rep__strong">${clock.formatDuration(line.worked)}</td>
        </tr>`
      )
      .join('');
  }

  function paintRows(data) {
    const { start, end } = pager.render(data.visible.length);
    const page = data.visible.slice(start, end);

    rowsHost.innerHTML = page.map((row) => rowMarkup(row, data)).join('');
    emptyNote.hidden = data.visible.length > 0;
  }

  function rowMarkup(row, data) {
    const { entry } = row;
    const badges = [];
    if (row.running) badges.push('<ui-badge status="brand" size="sm">Running</ui-badge>');
    if (row.missing) badges.push('<ui-badge status="warning" size="sm">Needs review</ui-badge>');
    if (row.manual) badges.push('<ui-badge status="info" size="sm">Manual</ui-badge>');
    if (row.adjusted) badges.push('<ui-badge status="neutral" size="sm">Edited</ui-badge>');

    const out = row.running
      ? '<span class="rep__running">Running</span>'
      : row.missing
        ? '<span class="rep__missing">Not recorded</span>'
        : clock.formatTime(entry.out);

    /* A shift still in progress has no final hours to correct, so the action
       is disabled rather than absent — an empty cell reads as "this row is
       different" without saying how. */
    const action = data.view.admin
      ? `<button type="button" class="ui-row-menu-btn" data-adjust="${entry.id}"
           ${row.running ? 'disabled title="A running shift can be corrected once it is closed"' : ''}
           aria-label="Adjust ${escapeHtml(row.employee.name)}, ${formatShortDay(entry.in)}"
           data-testid="time-report--adjust">
           <svg class="ui-icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
         </button>`
      : '';

    return `<tr data-testid="time-report--row" data-entry="${entry.id}">
      <td>${formatDay(entry.in)}</td>
      <td>${escapeHtml(row.employee.name)}</td>
      <td>${clock.formatTime(entry.in)}</td>
      <td>${out}</td>
      <td class="ui-table__cell--numeric">${row.breaks ? clock.formatDuration(row.breaks) : '—'}</td>
      <td class="ui-table__cell--numeric rep__strong">${clock.formatDuration(row.worked)}</td>
      <td>${badges.join(' ') || '<span class="rep__muted">—</span>'}</td>
      <td>${
        entry.notes
          ? `<span class="rep__note" title="${escapeHtml(entry.notes)}">${escapeHtml(entry.notes)}</span>`
          : '<span class="rep__muted">—</span>'
      }</td>
      <td class="ui-table__cell--actions">${action}</td>
    </tr>`;
  }

  /* --- Drill-down ---------------------------------------------------------------
     The all-employees table is a way IN to the per-person report, not a dead
     summary: the row you are reading becomes the report you wanted. */

  summaryHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-employee]');
    if (button) selectEmployee(button.dataset.employee);
  });

  function selectEmployee(id) {
    state.employee = id;
    whoSelect.value = { employee: id === 'all' ? [] : [id] };
    pager.reset();
    paint();
  }

  /* --- Adjusting and adding ------------------------------------------------------ */

  rowsHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-adjust]');
    if (!button || button.disabled) return;
    const row = report().rows.find((r) => r.entry.id === button.dataset.adjust);
    if (row) openEntryForm(row, button);
  });

  test('add')?.addEventListener('ui-click', (event) => openEntryForm(null, event.target));

  function openEntryForm(row, trigger) {
    editing = row;
    const now = Date.now();

    modal.setAttribute('heading', row ? 'Adjust time entry' : 'Add time entry');
    el('entryError').hidden = true;

    const employeeId = row?.entry.employeeId ?? (state.employee === 'all' ? SIGNED_IN_EMPLOYEE : state.employee);
    el('fEmployee').setAttribute('value', employeeId);
    el('fEmployee').toggleAttribute('disabled', Boolean(row));

    const day = row ? row.entry.in : now;
    el('fDate').setAttribute('value', toDateField(day));

    /* Adding takes a range; correcting one shift does not. The To field is
       taken off the form in that mode rather than disabled, because a disabled
       date beside an enabled one reads as a field that is broken. */
    el('fDate').setAttribute('label', row ? 'Date' : 'From date');
    el('fDateTo').hidden = Boolean(row);
    el('fDateTo').setAttribute('value', toDateField(day));
    el('fIn').setAttribute('value', row ? toTimeField(row.entry.in) : '09:00');
    el('fOut').setAttribute('value', row?.entry.out ? toTimeField(row.entry.out) : '17:00');
    el('fBreak').setAttribute('value', String(Math.round((row?.breaks ?? 0) / MINUTE)));
    el('fNotes').setAttribute('value', row?.entry.notes ?? '');
    el('fReason').setAttribute(
      'value',
      row?.missing ? 'Missed clock-out' : row ? 'Payroll correction' : 'Missed clock-in'
    );
    // setAttribute, not .value — <ui-textarea> exposes a value getter only, and
    // the attribute is what its render() reads back into the field.
    el('fNote').setAttribute('value', '');

    paintOriginal(row);
    paintAudit(row);
    paintPreview();
    modal.open(trigger);
  }

  /** What the clock recorded, kept visible while somebody overwrites it. */
  function paintOriginal(row) {
    const box = el('entryOriginal');
    const first = row?.entry.adjustment?.history?.[0]?.from;
    if (!row || !first) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `<h3 class="rep__original-title">What the clock recorded</h3>
      <p>${escapeHtml(punchLine(first))}</p>`;
  }

  function punchLine(values) {
    const out = values.out ? clock.formatTime(values.out) : 'no clock-out';
    const breakText = values.breakMinutes ? `${values.breakMinutes}m break` : 'no break';
    return `${formatShortDay(values.in)}, ${clock.formatTime(values.in)} — ${out} · ${breakText}`;
  }

  function paintAudit(row) {
    const box = el('entryAudit');
    const history = row?.entry.adjustment?.history ?? [];
    const manual = row?.entry.source === 'manual' ? row.entry : null;

    if (!history.length && !manual) {
      box.hidden = true;
      return;
    }

    const lines = [];
    if (manual) {
      lines.push(auditLine({ at: manual.at, by: manual.by, reason: manual.reason, note: manual.note }, 'Added manually'));
    }
    history.forEach((record) => lines.push(auditLine(record, `Was ${punchLine(record.from)}`)));

    box.hidden = false;
    box.innerHTML = `<h3 class="rep__audit-title">History</h3><ul class="rep__audit-list">${lines.join('')}</ul>`;
  }

  function auditLine(record, detail) {
    return `<li class="rep__audit-item">
      <p class="rep__audit-head">${escapeHtml(record.by ?? 'Unknown')} · ${escapeHtml(
        formatShortDay(record.at)
      )} at ${clock.formatTime(record.at)}</p>
      <p class="rep__audit-reason">${escapeHtml(record.reason ?? '')}${
        record.note ? ` — ${escapeHtml(record.note)}` : ''
      }</p>
      <p class="rep__audit-detail">${escapeHtml(detail)}</p>
    </li>`;
  }

  el('entrySave').addEventListener('ui-click', () => {
    const values = readEntryForm();
    if (values.error) {
      const box = el('entryError');
      box.textContent = values.error;
      box.hidden = false;
      return;
    }

    const view2 = viewer();
    if (editing) {
      sheet.adjust(
        editing.entry.id,
        values,
        {
          by: view2.name,
          reason: values.reason,
          note: values.note,
          previous: {
            in: editing.entry.in,
            out: editing.entry.out,
            breakMinutes: Math.round(editing.breaks / MINUTE),
          },
        }
      );
      flash(`Entry corrected — ${EMPLOYEE_INDEX[editing.entry.employeeId]?.name}, ${formatShortDay(values.in)}.`);
    } else {
      /* One entry per day in the range.
       *
       * Across a RANGE, days that already carry an entry are left alone: a
       * backfill written over days somebody actually clocked would double
       * their hours, and nobody would find it until payroll ran.
       *
       * A single day is not a backfill. Two shifts in one day is an ordinary
       * thing — a morning clinic and an evening list — and refusing the second
       * one would make the commonest correction impossible. */
      const writing =
        values.days.length === 1 ? values.days : values.days.filter((day) => !day.taken);
      writing.forEach((day) => {
        const shift = shiftFor(day.ms, values.inText, values.outText);
        sheet.addManual({
          employeeId: values.employeeId,
          in: shift.in,
          out: shift.out,
          breakMinutes: values.breakMinutes,
          notes: values.notes,
          reason: values.reason,
          note: values.note,
          by: view2.name,
        });
      });

      const who = EMPLOYEE_INDEX[values.employeeId]?.name;
      const skipped = values.days.length - writing.length;
      flash(
        writing.length === 1
          ? `Entry added — ${who}, ${formatShortDay(writing[0].ms)}.`
          : `${writing.length} entries added — ${who}, ${formatShortDay(
              writing[0].ms
            )} to ${formatShortDay(writing[writing.length - 1].ms)}.` +
              (skipped ? ` ${skipped} ${skipped === 1 ? 'day' : 'days'} already recorded.` : '')
      );
    }

    modal.close();
    paint();
  });

  /**
   * A manual add covers a run of days: a week somebody covered, a badge that
   * failed all week. More than a month at once is far likelier to be a slip in
   * a date field than an intention, and 400 invented shifts is not something a
   * flash message can undo.
   */
  const MAX_MANUAL_DAYS = 31;

  /** The same clock-in and clock-out, placed on a given day. */
  function shiftFor(dayMs, inText, outText) {
    const start = fromTimeField(dayMs, inText);
    let end = fromTimeField(dayMs, outText);
    if (end <= start) end = addDays(end, 1).getTime();
    return { in: start, out: end };
  }

  /**
   * Every day the range covers, and whether that day already has an entry for
   * this employee.
   *
   * Checked against the WHOLE record — the demo history, the live clock and
   * anything added by hand — not against what happens to be on screen. A range
   * written over a day somebody actually clocked would double their hours, and
   * the report would not look wrong until payroll ran.
   */
  function plannedDays(employeeId, fromMs, toMs) {
    const now = Date.now();
    const taken = new Set(
      allEntries()
        .filter((entry) => entry.employeeId === employeeId)
        .map((entry) => dayId(entry.in))
    );

    const days = [];
    const last = startOfDay(toMs).getTime();
    for (let cursor = startOfDay(fromMs); cursor.getTime() <= last; cursor = addDays(cursor, 1)) {
      const ms = cursor.getTime();
      days.push({ ms, taken: taken.has(dayId(ms)) });
      if (days.length > MAX_MANUAL_DAYS) break;
    }
    return days.length ? days : [{ ms: startOfDay(now).getTime(), taken: false }];
  }

  /**
   * What Save is about to do, in words, before it does it.
   *
   * A range is the one control on this form whose consequence is not obvious
   * from the control itself — "10 Aug to 21 Aug" is twelve entries, two of
   * which may be dropped. Saying so is cheaper than explaining it afterwards.
   */
  function paintPreview() {
    const box = el('entryPreview');
    if (editing) {
      box.hidden = true;
      return;
    }

    const employeeId = el('fEmployee').value;
    const from = fromDateField(el('fDate').value);
    const to = fromDateField(el('fDateTo').value);
    if (!employeeId || !Number.isFinite(from) || !Number.isFinite(to) || to < from) {
      box.hidden = true;
      return;
    }

    const days = plannedDays(employeeId, from, to);
    const single = days.length === 1;
    const writing = single ? days : days.filter((day) => !day.taken);
    const skipped = days.length - writing.length;

    const span = single
      ? formatShortDay(days[0].ms)
      : `${formatShortDay(days[0].ms)} to ${formatShortDay(days[days.length - 1].ms)}`;

    box.hidden = false;

    if (!writing.length) {
      box.textContent = `Every day from ${span} already has an entry for this employee.`;
      return;
    }

    /* A second shift on a day that already has one is legitimate, so it is
       said rather than prevented — the person adding it should know, and then
       decide. */
    const note = single
      ? days[0].taken
        ? ' This employee already has an entry that day; this adds a second shift.'
        : ''
      : skipped
        ? ` ${skipped} ${skipped === 1 ? 'day is' : 'days are'} already recorded and will be left alone.`
        : '';

    box.textContent =
      `Adds ${writing.length} ${writing.length === 1 ? 'entry' : 'entries'} — ${span}.${note}`;
  }

  /* Any of these changes what Save would write, so the sentence under the form
     is rebuilt from all of them rather than from the field that moved. */
  ['fEmployee', 'fDate', 'fDateTo'].forEach((id) => {
    el(id).addEventListener('ui-change', paintPreview);
  });

  /**
   * Changing From collapses the range onto that day.
   *
   * Almost every manual entry is one shift on one day, so From is "the day"
   * and To is the deliberate extension of it — set after, not before. Leaving
   * To where it was would mean picking a date and silently getting every day
   * between it and whatever To happened to hold, which is how somebody records
   * a week they never meant to.
   */
  el('fDate').addEventListener('ui-change', () => {
    const from = fromDateField(el('fDate').value);
    if (!Number.isFinite(from)) return;
    el('fDateTo').setAttribute('value', toDateField(from));
    paintPreview();
  });

  /**
   * Read and check the form.
   *
   * Every rule here is one a timesheet cannot survive being wrong about: a
   * shift that ends before it starts, a break longer than the shift that
   * contains it, or hours claimed for a day that has not happened. A reason is
   * required because an unexplained correction is not an audit trail.
   */
  function readEntryForm() {
    const employeeId = el('fEmployee').value;
    const day = fromDateField(el('fDate').value);
    const inText = el('fIn').value;
    const outText = el('fOut').value;
    const start = fromTimeField(day, inText);
    const breakMinutes = Math.max(0, Number(el('fBreak').value) || 0);
    const reason = el('fReason').value;
    const note = el('fNote').value.trim();
    const notes = el('fNotes').value.trim();

    if (!employeeId) return { error: 'Choose an employee.' };
    if (!Number.isFinite(day)) return { error: 'Give the date this shift was worked.' };
    if (!Number.isFinite(start)) return { error: 'Give a clock-in time.' };

    let end = fromTimeField(day, outText);
    if (!Number.isFinite(end)) return { error: 'Give a clock-out time.' };
    /* A night shift clocks out on the following date. Reading it as "out before
       in" would reject exactly the shift most likely to need a correction. */
    if (end <= start) end = addDays(end, 1).getTime();

    /* The last day of the range, not the first, is the one that cannot be in
       the future — and when correcting an entry there is only ever one day. */
    const last = editing ? day : fromDateField(el('fDateTo').value) || day;
    if (!Number.isFinite(last)) return { error: 'Give the date this range ends.' };
    if (last < day) return { error: 'The To date is before the From date.' };
    if (last > startOfDay(Date.now()).getTime()) {
      return { error: 'That date is in the future — hours cannot be recorded before they are worked.' };
    }

    if (breakMinutes * MINUTE >= end - start) {
      return { error: 'The break is longer than the shift.' };
    }
    if (end - start > 20 * HOUR) {
      return { error: 'That shift is longer than 20 hours. Check the clock-out time.' };
    }
    if (!reason) return { error: 'Choose a reason for the change.' };
    if (reason === 'Other' && !note) return { error: 'Say what happened — “Other” needs a note.' };

    const days = plannedDays(employeeId, day, last);
    if (days.length > MAX_MANUAL_DAYS) {
      return {
        error: `That range covers ${days.length} days. Add at most ${MAX_MANUAL_DAYS} at a time — a longer backfill is worth checking a week at a time.`,
      };
    }
    // Only a range can be entirely redundant — a single day is always allowed
    // to carry a second shift.
    if (!editing && days.length > 1 && days.every((d) => d.taken)) {
      return {
        error: `Every day in that range already has an entry for ${
          EMPLOYEE_INDEX[employeeId]?.name ?? 'this employee'
        }. Correct the existing entries instead.`,
      };
    }

    return { employeeId, in: start, out: end, inText, outText, breakMinutes, notes, reason, note, days };
  }

  /* --- Flash ---------------------------------------------------------------------
     Corrections happen in a dialog that closes on save, so without this the
     only evidence anything happened is a number changing somewhere in a table
     of ninety rows. The card this used to position by hand in the top corner
     is lib/toast.js's job now. */
  function flash(message) {
    notify(message);
  }

  /* --- Export and print ------------------------------------------------------------ */

  test('export').addEventListener('ui-click', () => exportCsv(report()));
  test('print').addEventListener('ui-click', () => window.print());

  /* --- Live updates ------------------------------------------------------------------
     A shift clocked from the header, or a correction made in another tab,
     repaints this screen rather than going stale behind it. */
  clock.subscribe(paint);
  sheet.subscribe(paint);

  syncNavigators();
  paint();
});

/**
 * CSV built and downloaded in the page — the prototype has no server to post
 * to, and a Blob URL keeps the export honest: what downloads is what is on
 * screen, for the same filters, in the same order.
 *
 * Durations are decimal hours, not "7h 30m": this file is going into a payroll
 * system, and 7.50 is what one can add up.
 */
function exportCsv(data) {
  const header = [
    'Date', 'Employee', 'Role', 'Clock in', 'Clock out',
    'Break hours', 'Regular hours', 'Overtime hours', 'Total hours',
    'Status', 'Source', 'Notes', 'Adjusted by', 'Adjustment reason',
  ];

  const lines = data.visible.map((row) => {
    const { entry } = row;
    const last = entry.adjustment?.history?.at(-1);
    return [
      formatShortDay(entry.in),
      row.employee.name,
      row.employee.role,
      clock.formatTime(entry.in),
      row.running ? 'Running' : row.missing ? 'Not recorded' : clock.formatTime(entry.out),
      decimalHours(row.breaks),
      decimalHours(row.regular),
      row.employee.exempt ? 'Exempt' : decimalHours(row.overtime),
      decimalHours(row.worked),
      row.missing ? 'Needs review' : row.running ? 'Running' : 'Complete',
      entry.source === 'manual' ? 'Manual' : 'Clock',
      entry.notes ?? '',
      last?.by ?? entry.by ?? '',
      last?.reason ?? entry.reason ?? '',
    ];
  });

  /* Quote every field and double any inner quote. A note containing a comma
     would otherwise shift every column after it by one. */
  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `time-report-${dayId(data.from)}-to-${dayId(addDays(data.to, -1))}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
