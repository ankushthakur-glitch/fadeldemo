/**
 * Scheduler — the booked appointments, as a list or a calendar.
 *
 * One state object drives both views, so switching between them never changes
 * what you are looking at: the same period, the same four filters, the same
 * rows. Day / Week / Month sets the period for both.
 *
 * AVAILABILITY
 * The shading behind the day and week grids is not decoration — it is the
 * provider's configured availability from Settings → Appointment → Availability
 * Preferences, read through data/schedule.js. A provider's day slots become the
 * white bookable bands, their block days become the hatched red ones, and
 * anything left is outside their hours. The new-appointment form checks a
 * booking against the same source before it saves.
 *
 * NO INLINE STYLES
 * Block positions and clinic-chosen colours are written into two generated
 * stylesheets (see writePalette / writeGeometry) rather than style attributes.
 */
import {
  APPOINTMENTS,
  PROVIDERS,
  LOCATIONS,
  APPOINTMENT_TYPES,
  activeAppointmentTypes,
  waitlistableAppointmentTypes,
  STATUS_COLOURS,
  STAFF,
  AREAS,
  PROCEDURE_TYPES,
  procedureById,
  coverageFor,
  recallsFor,
  eligibilityFor,
  TODAY,
  providerById,
  providerLabel,
  staffById,
  typeById,
  statusByName,
  durationOf,
  toMinutes,
  toTime,
  weekdayName,
  availabilityOn,
  blockedDuring,
} from '../../data/schedule.js';
import { PRACTICE } from '../../data/practice.js';
import { loadAppointments, saveAppointments } from '../../data/appointment-store.js';
import { icd10ByCode, icd10CodeFrom, icd10Label } from '../../data/icd10.js';
import { initScheduleActions } from './scheduler-instant.js';
import { DIRECTORY } from '../../data/directory.js';
import { TRIAGE_VITALS_FIELDS } from '../../data/triage.js';
import {
  NOTE_STATES,
  hasVisitNote,
  noteFor,
  noteTypeFor,
} from '../../data/visit-notes.js';
import {
  allWaitlist,
  waitlistById,
  waitlistCount,
  addToWaitlist,
  updateWaitlistEntry,
  removeFromWaitlist,
  waitingFor,
  shortDate as wlShortDate,
  WAITLIST_PRIORITIES,
} from '../../data/waitlist.js';
import {
  plansFor,
  planById,
  chargeFor,
  estimate,
} from '../../data/estimator.js';
import {
  money,
  balanceFor,
  collectPayment,
  PAYMENT_METHODS,
} from '../../data/patient-balance.js';
/* What the chart already knows this patient is on — the first half of the
   Triage drawer's Medication Name list. Read at open time rather than cached:
   a prescription written this morning should be on offer this afternoon. */
import { activeMedicationsFor } from '../../data/chart-medications.js';
/* The second half: everything the practice is set up to stock. The trolley
   drugs come with it and are filtered out where the list is built — see
   fillTriageMedications. */
import { MEDICATIONS } from '../../data/medication-inventory.js';
import { admits, chosen } from '../lib/filter-set.js';
import { notify as toast } from '../lib/toast.js';
import { openRowMenu } from '../lib/row-menu.js';
import { createPager } from '../lib/pagination.js';

/* ===================== Constants ===================== */

/** The visible window of the day grid. Mirrors the values in screen-scheduler.css. */
const DAY_START = 7 * 60;
const DAY_END = 20 * 60;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/* ===================== Small helpers ===================== */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "Pending Confirmation" → "pending-confirmation", for a CSS class. */
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* --- Dates. Local Date objects only; no UTC parsing, so no off-by-one. ----- */

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso, count) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + count);
  return toISO(date);
}

/** Month arithmetic that never rolls over: 31 Jan + 1 month is 28 Feb. */
function addMonths(iso, count) {
  const date = parseISO(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISO(date);
}

/** Monday of the week containing `iso` — WEEK_DAYS is Monday-first. */
function startOfWeek(iso) {
  const date = parseISO(iso);
  const offset = (date.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

function endOfMonth(iso) {
  const date = parseISO(iso);
  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** "2026-08-04" → "Tuesday, 4 August 2026" */
function longDate(iso) {
  const date = parseISO(iso);
  return `${DAY_NAMES[(date.getDay() + 6) % 7]}, ${date.getDate()} ${
    MONTHS[date.getMonth()]
  } ${date.getFullYear()}`;
}

/** "2026-08-04" → "4 Aug" */
function shortDate(iso) {
  const date = parseISO(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "4 Aug 2026" — shortDate plus the year. The visit-note worklist is not
 *  bounded by a period the way the schedule is, so a row can be weeks or
 *  months old and the year is the difference between "overdue" and "ancient". */
function shortDateYear(iso) {
  return `${shortDate(iso)} ${parseISO(iso).getFullYear()}`;
}

/** "27 May 2025" — day, full month name, year. No weekday: this is a value
 *  in a compact facts table, not a headline like longDate(). */
function triageDateLabel(iso) {
  const date = parseISO(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** 510 → "8:30 AM". The 12-hour clock without the padding zero, for places
 *  where the time sits inside something narrow — a calendar block, the hour
 *  gutter — and every character it does not spend is one the name can. */
function clockLabel(minute) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * 480, 510 → "8:00 – 8:30 AM".
 *
 * One meridiem when both ends share it. A calendar block is as wide as a
 * seventh of a week and the two AMs were the first thing to be truncated —
 * losing the end time to spell out something the other half of the same line
 * already said.
 */
function spanLabel(from, to) {
  const half = (minute) => (Math.floor(minute / 60) >= 12 ? 'PM' : 'AM');
  if (half(from) !== half(to)) return `${clockLabel(from)} – ${clockLabel(to)}`;
  return `${clockLabel(from).replace(/ [AP]M$/, '')} – ${clockLabel(to)}`;
}

/** 420 → "7 AM". The label on an hour line, where the minutes are always
 *  zero and printing them says nothing. */
function hourLabel(minute) {
  const h = Math.floor(minute / 60);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

/** "08:30" → "08:30 AM", the format the rest of the prototype uses. */
function displayTime(value) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

/* ===================== State ===================== */

/**
 * Bookings made in the prototype live in the shared store, not in the data
 * file — so check-in can open the procedure that was just booked, and a
 * reload does not throw the morning's work away.
 */
let appointments = loadAppointments();
let nextId = appointments.length + 1;

const state = {
  tab: 'appointments', // appointments | visit-notes
  noteTab: 'unsigned', // unsigned | signed — which half of the note worklist
  view: 'list', // list | calendar
  range: 'week', // day | week | month
  anchor: TODAY,
  /* Empty means every provider. A set rather than a string because a covering
     partner needs two or three lists side by side, not one at a time. */
  providerIds: new Set(),
  location: '',
  typeId: '',
  kind: '',
  query: '',
  /* The filter rail starts open: on a booking screen the filters are the
     first thing touched, and a rail that has to be found before it can be
     used is a rail nobody uses. */
  railOpen: true,
};

const PATIENTS = new Map(DIRECTORY.map((p) => [p.mrn, p]));
const patientOf = (mrn) => PATIENTS.get(mrn) ?? { name: 'Unknown patient', mrn };

const field = (id) => document.getElementById(id);

/**
 * Write a value into one of the field components.
 *
 * ui-input and ui-select mirror `value` back to the attribute as the user
 * edits, but ui-textarea does not — and its `value` is a getter with no
 * setter, so plain assignment throws. Setting the attribute AND the live
 * control covers all three, and keeps a re-opened form from showing what the
 * last edit left behind.
 */
function setValue(el, value) {
  const next = value ?? '';
  el.setAttribute('value', next);

  /* <ui-icd10> holds codes but SHOWS "K21.9 — description", and paints that
     itself off the attribute. Reaching past it to write the raw value into
     its text box would replace the description with the bare code. */
  if (el.tagName === 'UI-ICD10') return;

  const control = el.querySelector('input, select, textarea');
  if (control) control.value = next;
}

const setField = (id, value) => setValue(field(id), value);

/* --- Reading a booking whichever form made it -----------------------------
   A clinical visit takes its length and label from the configured appointment
   type; a procedure carries its own. Everything that draws an appointment —
   the list, both calendars, the slot picker — goes through these.
   -------------------------------------------------------------------------- */

/**
 * Which of the three forms a booking came from.
 *
 * Bookings made before the form branched carry no `kind`, so it is derived:
 * a procedure id means Procedure, the configured infusion activity means
 * Infusion, and everything else is a clinical visit. This is what decides
 * which note template an encounter opens with.
 */
const INFUSION_TYPE = 'at12';

function kindOf(appt) {
  if (appt.kind) return appt.kind;
  if (appt.procedureId) return 'procedure';
  if (appt.typeId === INFUSION_TYPE) return 'infusion';
  return 'clinical';
}

/*
 * Where a booking happens, derived rather than asked (RM-024).
 *
 * The desk used to pick a Location on the clinical form. It was a question
 * with one right answer: the practice runs a single clinic and a single ASC,
 * and the care type already decides which of the two you are in — you see a
 * patient in clinic, you infuse them in clinic, you scope them at the surgery
 * centre. Asking anyway meant the desk could book a colonoscopy into the
 * clinic, and nothing downstream would catch it.
 *
 * So the mapping lives here, once, keyed by the same `kind` that kindOf()
 * returns, and every place that needs a booking's location reads it through
 * locationForKind(). The values are entries of LOCATIONS in data/schedule.js,
 * not new strings: the calendar filter and the wait list still offer that full
 * list, and a location this map does not produce has to keep rendering because
 * older bookings carry them.
 */
const KIND_LOCATIONS = {
  clinical: LOCATIONS[0], // MediNova Gastroenterology — Fargo, the clinic
  infusion: LOCATIONS[0], // Infusions run in the clinic, not at a site of their own
  procedure: LOCATIONS[2], // Red River ASC
};

/** The location a booking of this care type belongs to. Clinic is the fallback:
    an unknown kind is a clinic visit until something says otherwise. */
function locationForKind(bookingKind) {
  return KIND_LOCATIONS[bookingKind] ?? KIND_LOCATIONS.clinical;
}

const KIND_LABELS = { clinical: 'Clinical', procedure: 'Procedure', infusion: 'Infusion' };
const KIND_TONES = { clinical: 'info', procedure: 'brand', infusion: 'warning' };

function lengthOf(appt) {
  // A length written on the booking itself wins. The procedure form lets the
  // desk book a difficult case longer than the standard slot, and the calendar
  // has to draw the block it was actually given rather than the catalogue's.
  if (appt.duration) return appt.duration;
  const booked = procedureIdsOf(appt);
  if (booked.length) return proceduresMinutes(booked) || 30;
  // Whose diary this is decides the length where the type names an exception
  // for them — see durationOf() in data/schedule.js.
  return durationOf(appt.typeId, appt.providerId);
}

function labelOf(appt) {
  /* A scope list entry can be several procedures — an upper and a lower under
     one sedation is one booking. They are joined with a thin space and a plus
     rather than a comma so a two-procedure block reads as one entry at
     calendar size instead of as two rows that lost their divider. */
  const booked = procedureIdsOf(appt);
  if (booked.length) {
    return booked.map((id) => procedureById(id)?.title ?? '').filter(Boolean).join(' + ');
  }
  return typeById(appt.typeId)?.title ?? '';
}

/**
 * Every procedure on a booking, oldest shape first.
 *
 * `procedureIds` is the list the form now saves; `procedureId` is the single
 * id every other screen in the product still reads — check-in, the encounter
 * and the chart all open a booking by it — so it is kept, holding the first of
 * the list. Bookings made before the form took more than one have only the
 * singular, and they have to keep drawing.
 */
function procedureIdsOf(appt) {
  if (appt?.procedureIds?.length) return appt.procedureIds;
  return appt?.procedureId ? [appt.procedureId] : [];
}

/** The minute a booking starts and the minute it ends. */
function spanOf(appt) {
  const start = toMinutes(appt.start);
  return { start, end: start + lengthOf(appt) };
}

/* ===================== Generated stylesheets ===================== */

function sheet(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Colours chosen by the clinic (appointment types, status colours) and the
 * fixed hour offsets of the gutter. Written once — they only change when the
 * settings data changes.
 */
function writePalette() {
  const rules = [
    ...APPOINTMENT_TYPES.map((t) => `.sch-t-${t.id}{--sch-colour:${t.color};}`),
    ...STATUS_COLOURS.map((s) => `.sch-s-${slug(s.name)}{--sch-colour:${s.color};}`),
  ];
  for (let minute = DAY_START; minute <= DAY_END; minute += 60) {
    rules.push(`[data-hour="${minute}"]{--sch-top:${minute - DAY_START};}`);
  }
  sheet('schPalette').textContent = rules.join('\n');
}

/** Block geometry for the current calendar paint. Replaced on every repaint. */
function writeGeometry(rules) {
  sheet('schGeometry').textContent = rules.join('\n');
}

/* ===================== Filtering ===================== */

/**
 * The provider whose availability can be drawn.
 *
 * Only one, and only when exactly one is picked — two providers' bands
 * overlaid on the same grid describe nobody's day.
 */
function soleProvider() {
  return state.providerIds.size === 1 ? [...state.providerIds][0] : '';
}

/** The providers to show columns for: the picked ones, or everybody. */
function pickedProviders() {
  if (!state.providerIds.size) return PROVIDERS;
  return PROVIDERS.filter((p) => state.providerIds.has(p.id));
}

/* --- The provider filter -----------------------------------------------------
   A set, not a single answer: a partner covering two colleagues wants both
   lists at once, not one and then the other.

   It is <ui-select multiple> like the three filters under it. The hand-built
   disclosure this replaces was written when picking several meant ctrl-
   clicking names in a native list box — a control nobody can drive — and it
   had grown a trigger, a panel, checkbox rows, "Select all", its own Escape
   handling and ninety lines of stylesheet to hold it all up. select-menu.js
   draws that panel for every multiple select in the product now, so the rail
   keeps the behaviour and stops being the one place it is bespoke.

   The Set stays: every reader downstream — the day grid's columns, the
   availability shading, the form's default provider — asks it questions a Set
   answers, and none of them had to learn what the field underneath is.
   -------------------------------------------------------------------------- */

function readProviderFilter() {
  state.providerIds = new Set(chosen(field('fProvider').value));
}

function wireProviderFilter() {
  field('fProvider').optionList = PROVIDERS.map((provider) => ({
    value: provider.id,
    label: `${provider.name} · ${provider.role}`,
  }));

  field('fProvider').addEventListener('ui-change', () => {
    readProviderFilter();
    resetPage();
    paint();
  });
}

/**
 * The search box, which sits in the page head and so is on screen on both
 * tabs. Kept apart from the rail filters because the Encounters tab has no
 * rail: a filter the user cannot see is a filter they cannot undo, so that
 * tab honours the search and nothing else.
 */
function matchesSearch(appt) {
  if (!state.query) return true;
  const patient = patientOf(appt.mrn);
  const haystack = `${patient.name} ${appt.mrn} ${appt.reason}`.toLowerCase();
  return haystack.includes(state.query.toLowerCase());
}

function matchesFilters(appt) {
  /* The provider filter was always a set — a Set of ids behind a column of
     checkboxes — because covering a colleague is the ordinary case on a
     scheduler. The other three now agree: two rooms, two appointment types,
     in-person and telehealth together. Same reading either way. */
  if (state.providerIds.size && !state.providerIds.has(appt.providerId)) return false;
  if (!admits(state.location, appt.location)) return false;
  if (!admits(state.typeId, appt.typeId)) return false;
  if (!admits(state.kind, kindOf(appt))) return false;
  return matchesSearch(appt);
}

/** Appointments inside a date span that survive the filter bar, in clinic order. */
function filtered(from, to) {
  return appointments
    .filter((a) => a.date >= from && a.date <= to && matchesFilters(a))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** The span the period controls currently describe. */
function periodBounds() {
  if (state.range === 'day') return { from: state.anchor, to: state.anchor };
  if (state.range === 'week') {
    const from = startOfWeek(state.anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: startOfMonth(state.anchor), to: endOfMonth(state.anchor) };
}

function periodTitle() {
  if (state.range === 'day') return longDate(state.anchor);
  if (state.range === 'week') {
    const from = startOfWeek(state.anchor);
    const to = addDays(from, 6);
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return sameMonth
      ? `${parseISO(from).getDate()} – ${shortDate(to)} ${parseISO(to).getFullYear()}`
      : `${shortDate(from)} – ${shortDate(to)} ${parseISO(to).getFullYear()}`;
  }
  const date = parseISO(state.anchor);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/* ===================== List view ===================== */

function timeCell(appt) {
  const { start, end } = spanOf(appt);
  return `<span class="sch__cell-time">${displayTime(toTime(start))}</span>
    <span class="sch__cell-sub">${lengthOf(appt)} min · ends ${toTime(end)}</span>`;
}

/**
 * Name only, and it goes to the chart.
 *
 * The MRN and reason for visit used to sit under it, but every other column
 * already carries a fact about the same booking — the row was doing the work
 * of a summary card. Both are still searchable, and both are on the detail
 * drawer, which is where you go when the name is not enough.
 *
 * The name used to open the booking form, which is not what a name promises:
 * everywhere else in the product — the visit-notes tab below, tasks,
 * communications, the directory — a patient's name is the way into that
 * patient's chart, and the desk clicking it here wanted the person, not the
 * appointment. The appointment is still one click away on the same row: Start
 * opens the details drawer, and Edit Appointment sits in the "⋮" menu beside
 * it.
 */
function patientCell(appt) {
  const patient = patientOf(appt.mrn);
  return `<a class="sch__cell-name" href="patient-chart.html?mrn=${encodeURIComponent(
    appt.mrn
  )}">${esc(patient.name)}</a>${
    appt.waitList ? '<span class="sch__waitlist">Wait list</span>' : ''
  }`;
}

const LIST_COLUMNS = [
  {
    key: 'start',
    label: 'Time',
    render: (row) => timeCell(row),
  },
  {
    key: 'patient',
    label: 'Patient',
    render: (row) => patientCell(row),
  },
  {
    key: 'provider',
    label: 'Provider',
    render: (row) => {
      const provider = providerById(row.providerId);
      return `${esc(provider?.name ?? '')}<span class="sch__cell-sub">${esc(
        provider?.role ?? ''
      )}</span>`;
    },
  },
  {
    key: 'typeId',
    label: 'Appointment Type',
    render: (row) => {
      // A procedure has no configured colour, so it borrows the neutral dot.
      return `<span class="sch__dot sch-t-${row.typeId || 'none'}"></span>${esc(labelOf(row))}`;
    },
  },
  {
    key: 'location',
    label: 'Location',
    truncate: true,
    render: (row) => esc(row.location),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) =>
      `<span class="sch__status sch-s-${slug(row.status)}">${esc(row.status)}</span>`,
  },
  {
    key: 'kind',
    label: 'Care Type',
    render: (row) => {
      const kindId = kindOf(row);
      return `<ui-badge status="${KIND_TONES[kindId]}">${KIND_LABELS[kindId]}</ui-badge>`;
    },
  },
  {
    key: 'actions',
    label: 'Actions',
    actions: true,
    render: (row) => {
      const name = esc(patientOf(row.mrn).name);
      /*
       * Always Start, always pressable.
       *
       * The button used to go flat and read "Started" once a booking reached
       * Checked In or Check Out, on the reasoning that a patient already
       * through the door cannot be walked through it again. Two things were
       * wrong with that. The button does not check anyone in — it opens the
       * booking's details, and Check In inside that dialog is what moves the
       * status — so what it disabled was the only way into a visit that is
       * ALREADY under way, which is the row somebody is most likely to want to
       * open. And because statuses persist for the session, a reviewer who
       * pressed Start once found that row closed to them for the rest of the
       * tab, with a reload no help: the seed is clean, but the session is not.
       *
       * The status is not hidden by this. It has its own column two along, and
       * a row reading Checked In beside a button reading Start is a truer
       * account of where the visit is than a dead control was.
       */
      return `<span class="sch__row-actions">
        <ui-button variant="primary" size="xs" data-start="${row.id}">
          Start
        </ui-button>
        <button type="button" class="ui-row-menu-btn" data-menu="${row.id}"
          aria-haspopup="menu" aria-expanded="false"
          aria-label="Actions for ${name}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
        </button>
      </span>`;
    },
  },
];

/* --- Row actions -----------------------------------------------------------
   The ⋮ menu on each row. It is rendered to the body rather than inside the
   cell, because the table scrolls inside itself and a panel parented to a row
   would be clipped by that overflow.
   -------------------------------------------------------------------------- */

/* --- The row menu ------------------------------------------------------------
   Everything a booked appointment can have done to it that is not "open it".

   The panel is <ui-menu> through openRowMenu() (js/lib/row-menu.js) — the same
   surface nine other tables in the product open, which owns the parts that are
   genuinely hard: role="menu", the roving focus, arrows that wrap past the
   ends, Escape, an outside press, and re-anchoring when the row scrolls. This
   screen had its own copy of all of that.

   Change Status was a sub-list that expanded inside the old panel. A menu of
   actions cannot hold a menu of values — one DOES something, the other SETS
   something — so it is now a second menu, opened on the same trigger. The
   first closes as the second opens, which is what the row menu does anyway
   when a second one is asked for.
   -------------------------------------------------------------------------- */

function statusMenu(appt, trigger) {
  const patient = patientOf(appt.mrn);

  openRowMenu(
    trigger,
    STATUS_COLOURS.map((status) => ({
      label: status.name,
      /* The one it is already on is marked, not repeated: ui-menu draws a
         tick against a selected row. */
      selected: appt.status === status.name,
      testid: `sch--status-${slug(status.name)}`,
      run: () => {
        appt.status = status.name;
        notify(`${patient.name} set to ${appt.status}.`);
        paint();
      },
    }))
  );
}

function rowMenu(appt, trigger) {
  const patient = patientOf(appt.mrn);
  const triageable =
    kindOf(appt) === 'clinical' && ['Checked In', 'Triage'].includes(appt.status);

  const items = [
    {
      label: 'gEstimator',
      icon: 'dollar',
      testid: 'sch--menu-estimate',
      run: () => openEstimate(appt),
    },
    {
      label: 'Check Eligibility',
      icon: 'shield',
      testid: 'sch--menu-eligibility',
      run: () => {
        const coverage = coverageFor(appt.mrn);
        const active = coverage.eligibility === 'Active';
        notify(
          `${patient.name} — ${coverage.insurance}: ${coverage.eligibility}.`,
          active ? 'success' : 'warning'
        );
      },
    },
    {
      label: 'Change Status',
      description: appt.status,
      icon: 'check',
      testid: 'sch--menu-status',
      /* The trigger is handed back by openRowMenu, so the second menu hangs
         off the same "⋮" rather than off a menu item that is about to close. */
      run: (from) => statusMenu(appt, from),
    },
    triageable && {
      label: appt.triage?.completed ? 'View Triage' : 'Start Triage',
      icon: 'vitals',
      testid: 'sch--menu-triage',
      run: (from) => openTriage(appt, from),
    },
    {
      label: 'Open Encounter',
      icon: 'stethoscope',
      testid: 'sch--menu-encounter',
      run: () => {
        window.location.href = `encounter.html?appt=${encodeURIComponent(appt.id)}`;
      },
    },
    {
      label: 'Edit Appointment',
      icon: 'pencil',
      testid: 'sch--menu-edit',
      run: (from) => openAppointment(appt, from),
    },
    { divider: true },
    {
      label: 'Discharge',
      icon: 'user-check',
      testid: 'sch--menu-discharge',
      run: () => {
        appt.status = 'Check Out';
        notify(`${patient.name} discharged and checked out.`);
        paint();
      },
    },
  ].filter(Boolean);

  openRowMenu(trigger, items);
}

/* ===================== Triage =====================
   A nurse's pass over a checked-in Clinical visit, before the provider's own
   encounter: vitals, current medications, a note for the provider — all of it
   taken against the reason the booking was already made for, which the drawer
   PRINTS rather than asks for. Deliberately no Assessments/Screening section.

   THE DRAWER IS A CHECKLIST, AND IT SAYS SO.
   The first version printed identical amber clocks that only ever changed
   after the drawer had been saved and reopened, so the one question a nurse
   asks a checklist — how much of this is left — could not be answered by
   looking at it. Now the drawer opens on WHO it is for, and every mark and
   footer hint is recomputed from the live fields on each keystroke
   (refreshTriage). The marks show a step NUMBER until the step is answered
   and a tick after, which is also what tells the reader the three sections
   are meant to be worked through in order rather than picked at. A segmented
   track and a running "2 of 3 steps filled in" line sat under the patient
   strip as well; three numbered marks already down the drawer answer the same
   question in the place the work is, so the recap was two more bands of
   chrome between the nurse and the first question.

   Vitals and Medications collapse. They are the two sections that are often
   already on file, and a drawer that opens with a seven-field grid and a
   three-field mini-form unfurled reads as far more work than it is. Collapsed
   is not hidden, though: a collapsed section that HAS content prints it on
   one line ("BP 120/80 · HR 72 · Temp 98.6"), so the state of the pass can be
   read without opening anything.

   Everything in the drawer is read from the DOM only when Save as Draft or
   Complete Triage is pressed — the same "read at submit" convention every
   other form in this app uses — EXCEPT the medications list, which needs to
   grow one row at a time as the nurse adds each one. That list is re-rendered
   on its own (#triageMedsList) rather than the whole drawer, so adding a
   medication can never wipe out vitals the nurse has taken or a note they
   have typed but not saved yet.
   ==================================================== */

/** The appointment the Triage drawer is open for. */
let triagingId = null;

/** Working copy of the medications list for the open drawer — appended to
 *  as the nurse adds each one, persisted into appt.triage on save. */
let triageMedsDraft = [];

/** What the seven vitals boxes held when the vitals window was last opened.
 *  Cancel puts it back — see openTriageVitals. */
let triageVitalsSnapshot = null;

/**
 * The Medication Name list's last row: "this is not on the list".
 *
 * A sentinel rather than a real drug id, and one no medication could ever be
 * called, because <ui-select free-text> matches it against the field's VALUE
 * to decide whether to become a text box.
 */
const TRIAGE_MED_OTHER = '__other';

/**
 * What one of the three medication fields is actually saying.
 *
 * All three are lists with an "Other" row now, and all three answer the same
 * way: picked from the list, or typed into the box the list turns into. The
 * sentinel is the field's VALUE in that second case and the typed string lives
 * on free-text-value — see <ui-select free-text> — so what gets stored is what
 * the nurse wrote, never the sentinel itself.
 */
function triageChosen(field) {
  const picked = field?.value ?? '';
  return picked === TRIAGE_MED_OTHER
    ? (field.getAttribute('free-text-value') ?? '').trim()
    : picked.trim();
}

/**
 * One name reduced to what actually identifies the drug.
 *
 * "Pantoprazole 40 mg Tablet" on the practice catalogue and "Pantoprazole
 * 40mg tablets" on a reported list are one medication written down twice, and
 * offering both puts the nurse in front of two rows that are the same answer.
 * Case, punctuation and the plural on the dose form are all that differ in the
 * demo data, so stripping them is enough to catch it here — a real system
 * would match on RxNorm, and data/chart-medications.js says the same thing
 * where it dedupes the two halves of a chart's own list.
 */
const triageMedKey = (name) =>
  String(name || '').toLowerCase().replace(/s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Fill the medication picker: this patient's own list first, the practice
 * catalogue under it.
 *
 * WHAT THIS PATIENT IS ON comes first because it is the answer nearly every
 * time. Active prescriptions and self-reported medications, both of which the
 * chart holds under the patient's own MRN — so the commonest triage entry
 * ("still taking everything on the list") is a pick rather than a retype, and
 * the name that gets recorded is the name the chart already uses.
 *
 * THE CATALOGUE is under it because that list runs out. A patient started on
 * something at another practice, at a walk-in, or in hospital since the last
 * visit is on a drug this chart has never seen — and until now the only way to
 * record it was "Other" and a typed name, which is precisely how one drug ends
 * up on file under four spellings. Everything the practice stocks is on offer
 * instead, spelled the way the practice spells it.
 *
 * The trolley is left out. Midazolam and propofol are pushed in the endoscopy
 * room and charted on the encounter; nobody goes home on them, so a triage
 * pass has no business offering them, and seven rows that can never be the
 * answer are seven rows in the way of the ones that can be.
 *
 * Deduplicated across both halves, and the patient's own row wins: a drug that
 * is both prescribed here and stocked here is one medication, and the chart's
 * spelling of it is the one the rest of the record already uses.
 */
function fillTriageMedications(mrn) {
  const field_ = triageField('sch--triage-med-name');
  if (!field_) return;

  const seen = new Set();
  const onFile = [];
  triageMedFacts.clear();

  /* The catalogue is read first, though it is offered second: it is where the
     dispensing unit comes from, and a drug that is both on file here and
     stocked here should ask for its dose in the unit stock control holds —
     the patient's own row wins on the NAME, not on what the drug is counted
     in. See fillTriageDoseAndFrequency. */
  MEDICATIONS.forEach((med) => {
    const key = triageMedKey(med.name);
    if (key) triageMedFacts.set(key, { unit: med.unit ?? null, frequency: null });
  });

  activeMedicationsFor(mrn).forEach(({ name, frequency }) => {
    const key = triageMedKey(name);
    if (!key) return;
    triageMedFacts.set(key, {
      unit: triageMedFacts.get(key)?.unit ?? null,
      frequency: frequency || null,
    });
    if (seen.has(key)) return;
    seen.add(key);
    onFile.push(name);
  });

  const catalogue = MEDICATIONS.filter((med) => !med.procedureUse)
    .map((med) => med.name)
    .filter((name) => {
      const key = triageMedKey(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));

  /* The headings are only drawn when there are two halves to tell apart. A
     patient with nothing on file would otherwise get a lone "Practice
     catalogue" heading over the whole list, which names nothing. */
  const grouped = onFile.length > 0;

  field_.optionList = [
    ...onFile.map((name) => ({
      value: name,
      label: name,
      group: grouped ? 'On file for this patient' : undefined,
    })),
    ...catalogue.map((name) => ({
      value: name,
      label: name,
      group: grouped ? 'Practice catalogue' : undefined,
    })),
    { value: TRIAGE_MED_OTHER, label: 'Other — not on file' },
  ];

  // Nothing named yet, so the two answer lists start on the general ones.
  fillTriageDoseAndFrequency('');
}

/**
 * What the chart knows about each drug it just offered, keyed the same way the
 * list was deduplicated.
 *
 * Kept beside the picker rather than looked up again when a name is chosen,
 * because the two questions under it — how much, how often — are answered
 * FROM this: the frequency the chart already holds for a drug is the answer
 * nearly every time, and the catalogue's dispensing unit is what says whether
 * this one is counted in tablets, injections or puffs.
 *
 * @type {Map<string, {unit: string|null, frequency: string|null}>}
 */
const triageMedFacts = new Map();

/**
 * The dose ladder for one dispensing unit.
 *
 * A dose is a COUNT of something the drug comes as, and what it comes as is
 * the one fact the catalogue already records — so "Adalimumab 40 mg Pen" asks
 * for injections and "Mesalamine 800 mg Tablet" asks for tablets, rather than
 * both offering the same generic list with two thirds of it nonsense.
 *
 * Halves are only offered where a dose can actually be halved: a tablet is
 * scored, a pre-filled pen is not, and "Half an injection" on the list is an
 * answer nobody should be able to record.
 */
const TRIAGE_DOSE_UNITS = {
  tablet: { word: 'tablet', half: true },
  capsule: { word: 'capsule', half: true },
  pen: { word: 'injection', half: false },
  vial: { word: 'injection', half: false },
  ampoule: { word: 'injection', half: false },
  inhaler: { word: 'puff', half: false },
  bottle: { word: 'dose', half: false },
  /* Not units stock control counts in — nothing is dispensed by the injection
     or the sachet — but both are what a NAME says a drug comes as, and the
     name is all there is to go on for a drug this catalogue has never
     stocked. See triageUnitFromName. */
  injection: { word: 'injection', half: false },
  sachet: { word: 'sachet', half: true },
};

/**
 * The form a drug comes in, read off its own name.
 *
 * The catalogue is asked first and answers for everything the practice
 * stocks — but a patient's chart holds drugs it does not, at strengths it does
 * not ("Mesalamine 1.2g tablet" against a stocked 800 mg tablet), and those
 * fall through to a general list that offers capsules and puffs for something
 * the name plainly calls a tablet. Nearly every medication name ends in what
 * it is, so that word is taken when the catalogue has nothing: it is a weaker
 * source than stock control, which is why it is only consulted second.
 */
function triageUnitFromName(name) {
  const match = String(name || '')
    .toLowerCase()
    .match(/\b(tablets?|capsules?|pens?|vials?|ampoules?|inhalers?|injections?|sachets?)\b/);
  return match ? match[1].replace(/s$/, '') : null;
}

/** Every form the fallback list has to cover, for a drug the catalogue has
 *  never seen — typed under "Other", or on file here under a name stock
 *  control does not stock. Broader than any one drug's ladder on purpose:
 *  nothing is known about the form, so all the common ones are offered. */
const TRIAGE_DOSE_ANY = [
  'Half a tablet',
  '1 tablet',
  '2 tablets',
  '1 capsule',
  '2 capsules',
  '5 mL',
  '10 mL',
  '1 injection',
  '1 puff',
  '1 sachet',
];

/**
 * How often, in the words a sig is written in.
 *
 * Twelve answers cover nearly every reported medication, and the point of
 * having them on a list at all is that "BD", "bd", "2x day" and "Twice daily"
 * stop being four ways of recording one fact — a triage list is read by the
 * provider ten minutes later, and a frequency they have to interpret is a
 * frequency they have to ask about again.
 */
const TRIAGE_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every morning',
  'At bedtime',
  'Every other day',
  'Once weekly',
  'Twice weekly',
  'Every other week',
  'Once monthly',
  'As needed',
];

/** The counted rungs for one unit — "1 tablet", "2 tablets" — with the half
 *  step first where the form allows one. */
function triageDoseLadder(unit) {
  const form = TRIAGE_DOSE_UNITS[unit];
  if (!form) return TRIAGE_DOSE_ANY;
  const counted = [1, 2, 3, 4].map((n) => `${n} ${form.word}${n === 1 ? '' : 's'}`);
  return form.half ? [`Half a ${form.word}`, ...counted] : counted;
}

/**
 * Put a list on one of the two answer fields without losing the answer
 * already sitting in it — and without redrawing the field when the list it is
 * being handed is the list it already has.
 *
 * THE UNCHANGED CASE IS THE IMPORTANT ONE, and it is most of them: two tablets
 * in a row ask for the same five doses, and the frequency list is the same
 * twelve for every drug that has nothing on file. Redrawing anyway replaces a
 * live <select> — and the moment this runs is exactly the moment a nurse is
 * moving INTO one of these boxes, because the name field commits what was
 * typed in it on the way out. A field rebuilt on that blur is a field the
 * focus lands nowhere on and a press that hits a control that no longer
 * exists, which is the same bargain the drawer's own repaints make (see
 * paintTriageOpenButton).
 *
 * When the list genuinely does change, setOptions redraws the control, so a
 * value that survives the change of drug has to be written back afterwards —
 * and one that does not survive it is dropped rather than left behind, because
 * "3 tablets" carried over onto a pre-filled pen is a dose the nurse never
 * gave and would have to notice to correct. A typed "Other" answer is left
 * alone either way: it belongs to no list, so no list can invalidate it.
 */
function setTriageAnswerOptions(field, values, freeLabel) {
  if (!field) return;
  const wanted = [
    ...values.map((value) => (typeof value === 'string' ? { value, label: value } : value)),
    { value: TRIAGE_MED_OTHER, label: freeLabel },
  ];

  const same =
    field.optionList.length === wanted.length &&
    wanted.every((option, index) => {
      const held = field.optionList[index];
      return held.value === option.value && held.label === option.label && held.group === option.group;
    });
  if (same) return;

  const had = field.value;
  field.optionList = wanted;
  if (had === TRIAGE_MED_OTHER) field.value = TRIAGE_MED_OTHER;
  else field.value = values.some((v) => (typeof v === 'string' ? v : v.value) === had) ? had : '';
}

/**
 * Fit the Dose and Frequency lists to the medication now named.
 *
 * Run when the name changes and once when the window is drawn, so the two
 * boxes are never offering answers for the drug before this one.
 *
 * WHAT THE CHART ALREADY SAYS comes first on the frequency list, as its own
 * group, for the same reason the patient's own drugs head the name list: the
 * commonest thing a triage pass records is that nothing has changed, and that
 * answer should be a pick rather than a retype. It is the whole sig where
 * there is one — "1 tablet orally twice daily" — because that is how the
 * chart's own medication list prints it, and cutting it down to the two words
 * that look like a frequency would lose how the drug is taken.
 */
function fillTriageDoseAndFrequency(name) {
  const facts = triageMedFacts.get(triageMedKey(name)) ?? {};

  setTriageAnswerOptions(
    triageField('sch--triage-med-dose'),
    triageDoseLadder(facts.unit ?? triageUnitFromName(name)),
    'Other — type the dose'
  );

  const onFile = facts.frequency && !TRIAGE_FREQUENCIES.includes(facts.frequency)
    ? [{ value: facts.frequency, label: facts.frequency, group: 'On file for this patient' }]
    : [];

  setTriageAnswerOptions(
    triageField('sch--triage-med-frequency'),
    [
      ...onFile,
      ...TRIAGE_FREQUENCIES.map((value) => ({
        value,
        label: value,
        group: onFile.length ? 'Usual frequencies' : undefined,
      })),
    ],
    'Other — type the frequency'
  );
}

/**
 * The three steps of the pass, in the order the drawer prints them.
 *
 * One list rather than three hard-coded section headers, because the same
 * keys have to line up in two places — the round mark rendered onto each
 * section and the repaint refreshTriage runs over them on every keystroke —
 * and two hand-maintained copies of the same order is a chance for them to
 * disagree about what step 2 is.
 *
 * Reason For Visit was the first of them and is not a step any more: the
 * booking already carries it, so the drawer prints it with the rest of the
 * booking instead of asking the nurse to type it out a second time. See the
 * booking block in renderTriageBody.
 */
const TRIAGE_STEPS = [
  { key: 'vitals', label: 'Vitals' },
  { key: 'meds', label: 'Medications' },
  { key: 'note', label: 'Note' },
];

/** Inside of the round mark beside a section heading: the step's number while
 *  it is unanswered, a tick once it is. The screen-reader text is spelled out
 *  because neither a bare "3" nor a tick glyph says which of the two states
 *  it is announcing. */
function triageMarkInner(index, done, label) {
  return done
    ? `<svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
       <span class="u-sr-only">${esc(label)}: done</span>`
    : `<span class="sch__triage-step" aria-hidden="true">${index + 1}</span>
       <span class="u-sr-only">${esc(label)}: step ${index + 1}, not filled in yet</span>`;
}

function triageMark(key, index, done, label) {
  return `<span class="sch__triage-mark sch__triage-mark--${done ? 'done' : 'pending'}"
      data-triage-mark="${key}">${triageMarkInner(index, done, label)}</span>`;
}

/**
 * The same mark for Pain Level, with the step number left out.
 *
 * Pain gets the heading its neighbours get, but it is not a fourth step of
 * the pass — the three numbered ones are the pass, and the drawer's whole
 * claim is that there are three of them. Numbering pain would make
 * Medications step 3 and the Note step 4 for a reading that is optional and
 * belongs to the
 * observations above it; leaving the circle empty until a score is pressed
 * says the same two things the numbered marks say — this is a thing to
 * answer, and it has not been answered — without joining a ladder it is not
 * on. Answered, it is the identical green tick, because "recorded" is
 * recorded whichever section it happened in.
 */
function triagePainMark(saved) {
  const done = Boolean(triagePainValue(saved));
  return `<span class="sch__triage-mark sch__triage-mark--${done ? 'done' : 'pending'}"
      data-triage-pain-mark>${triagePainMarkInner(done)}</span>`;
}

function triagePainMarkInner(done) {
  return done
    ? `<svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
       <span class="u-sr-only">Pain level: recorded</span>`
    : '<span class="u-sr-only">Pain level: not recorded yet</span>';
}

/**
 * The button on a section whose fields are captured in a window of their own.
 *
 * Vitals and Current Medication were disclosures that unfolded in place until
 * the drawer grew past the point where that worked: unfolding either one pushed
 * the numbered steps apart far enough that the pass stopped being one screen,
 * and the nurse was scrolling a drawer to find the step they were on.
 * Both are a press that opens a centred window now — not a toggle, so it
 * carries no aria-expanded and no caret. `aria-haspopup="dialog"` says what
 * the press is about to do for anyone who cannot see the window arrive.
 *
 * `filled` swaps the wording and the glyph once the section holds something:
 * "Check Vitals" becomes "Edit Vitals" under a pencil, because a plus beside
 * a section that already has an answer is how the answer gets entered twice.
 */
function triageOpenButton(which, testid, addLabel, editLabel, filled) {
  return `<button type="button" class="sch__triage-action" data-triage-open="${which}"
      data-add-label="${esc(addLabel)}" data-edit-label="${esc(editLabel)}"
      aria-haspopup="dialog" data-testid="${testid}">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-${filled ? 'pencil' : 'plus'}"></use></svg>
      <span data-triage-open-label>${filled ? editLabel : addLabel}</span>
    </button>`;
}

/** Move one of those buttons between its two words as the section fills and
 *  empties. Repainted rather than re-rendered, for the same reason as every
 *  other mark on this drawer: refreshTriage runs on every keystroke, and a
 *  button rebuilt under a nurse's finger is a press that lands on nothing. */
function paintTriageOpenButton(which, filled) {
  const button = document.querySelector(`[data-triage-open="${which}"]`);
  if (!button) return;
  button.querySelector('[data-triage-open-label]').textContent = filled
    ? button.dataset.editLabel
    : button.dataset.addLabel;
  button.querySelector('use').setAttribute('href', `#i-${filled ? 'pencil' : 'plus'}`);
}

/**
 * Add whatever the mini-form holds to the running medications list.
 *
 * Its own function rather than a lump inside the click handler because two
 * things reach it: the Add button, and Enter pressed in any of the three
 * fields. Choosing a drug, typing a dose and a frequency and then having to
 * travel to a button to commit them is three keystrokes of friction on a list
 * that is often five or six medications long.
 */
function addTriageMedication() {
  const body = document.getElementById('triageMedBody');
  const nameField = body?.querySelector('[data-testid="sch--triage-med-name"]');
  if (!body) return;

  /* Picked from the list, or typed into the box the list turns into. "Other"
     is the field's value in that second case and the typed string lives on
     free-text-value — see <ui-select free-text> — so a medication added that
     way is stored under what the nurse wrote, not under the sentinel. */
  const picked = nameField?.value ?? '';
  const name = triageChosen(nameField);

  if (!name) {
    nameField?.setAttribute(
      'error',
      picked === TRIAGE_MED_OTHER ? 'Type the medication name.' : 'Choose a medication.'
    );
    nameField?.focusFreeText?.() || nameField?.querySelector('select')?.focus();
    return;
  }

  triageMedsDraft.push({
    name,
    dose: triageChosen(body.querySelector('[data-testid="sch--triage-med-dose"]')) || null,
    frequency: triageChosen(body.querySelector('[data-testid="sch--triage-med-frequency"]')) || null,
  });
  renderTriageMedsList();

  /* All three are lists again for the next row, and all three give up their
     typed text as well as their selection. Clearing `value` alone would leave
     the typed string behind, so a nurse who added one "Other" medication and
     then picked a real one from the list would have the old text waiting in
     the box the next time they stepped out of it. */
  ['sch--triage-med-name', 'sch--triage-med-dose', 'sch--triage-med-frequency'].forEach((testid) => {
    const el = body.querySelector(`[data-testid="${testid}"]`);
    if (!el) return;
    el.value = '';
    el.setAttribute('free-text-value', '');
    el.removeAttribute('error');
  });

  // And the two answer lists go back to the general ones, since no drug is
  // named any more for them to be fitted to.
  fillTriageDoseAndFrequency('');

  // Straight back to the name field: the next medication is the likeliest next
  // thing to happen, and this list is usually more than one row long.
  nameField?.querySelector('select')?.focus();
  refreshTriage();
}

/* Pain is asked on the drawer, not in the Check Vitals window the other seven
   went into — see the Pain Level block in renderTriageBody. Filtered out of
   the grid here by key so the two can never both draw it. */
const TRIAGE_PAIN_KEY = 'painScore';

/* Pain's own row on the vitals list, which is where the scale's heading gets
   its "0-10" from. Read off the list rather than written out here so the
   heading cannot drift from what a saved triage says the field is measured
   in — the list is the one description of these readings. */
const TRIAGE_PAIN_FIELD = TRIAGE_VITALS_FIELDS.find((f) => f.key === TRIAGE_PAIN_KEY);

/**
 * What each stretch of the 0-to-10 scale is called, in the words the scale
 * itself is taught in — the bands a nurse already carries in their head when
 * they ask the question, printed rather than left to be remembered.
 *
 * `tone` is the colour band and is deliberately coarser than `word`: 10 is
 * named "Worst possible" but is painted in the same red as 7-9, because a
 * fifth colour on an eleven-step ramp says "different kind of answer" when
 * what it is is the top of the same one.
 *
 * Ordered low to high and read with the first `max` a score fits under, so a
 * band's range is implied by the band above it rather than repeated.
 */
const TRIAGE_PAIN_BANDS = [
  { max: 0, tone: 'none', word: 'No pain' },
  { max: 3, tone: 'mild', word: 'Mild' },
  { max: 6, tone: 'moderate', word: 'Moderate' },
  { max: 9, tone: 'severe', word: 'Severe' },
  { max: 10, tone: 'severe', word: 'Worst possible' },
];

const triagePainBand = (score) => TRIAGE_PAIN_BANDS.find((band) => score <= band.max);

/** The saved score as the string the scale compares against, or '' for a
 *  question nobody put. `?? ''` alone would let a saved 0 through as the
 *  number zero, which `String(n) === value` then fails to match. */
const triagePainValue = (saved) => (saved == null || saved === '' ? '' : String(saved));

/**
 * The eleven answers laid out as the ramp they are.
 *
 * This was a dropdown of eleven rows, and before that a box you typed a
 * number into. Both asked the nurse to translate what the patient just said
 * — "about a seven, worse after eating" — into a value picked out of a list
 * that looks the same at every step, with nothing on screen saying where the
 * line between mild and severe falls. Laid out flat, the scale is the thing
 * it is describing: eleven steps, left to right, tinted from green to red,
 * with the band words under the ends so the vocabulary the patient is being
 * asked in is visible while they are being asked it. One press records a
 * score instead of open-select-scroll-pick.
 *
 * Still not a slider. A slider has a thumb that has to sit somewhere, so it
 * shows an answer before there is one — and "no pain" and "not asked" are
 * different findings that a thumb parked at 0 cannot tell apart. Here nothing
 * is pressed until something is pressed, and the readout says so in words.
 *
 * The value lives in a hidden input rather than on the buttons so that
 * readTriageForm can go on reading every vital the same way — one testid,
 * one `.value` — and so a score of 0 reaches it as "0" rather than as the
 * absence of a pressed button.
 */
function triagePainScale(saved) {
  const value = triagePainValue(saved);

  const steps = Array.from({ length: 11 }, (_, n) => {
    const selected = value === String(n);
    const band = triagePainBand(n);
    /* Roving tabindex: the scale is one stop on the way through the drawer,
       not eleven. Tab lands on whatever is chosen, or on 0 when nothing is,
       and the arrow keys move from there — see the keydown handler. */
    const stop = selected || (!value && n === 0);
    return `<button type="button" role="radio" aria-checked="${selected}"
        class="sch__pain-step sch__pain-step--${band.tone}${selected ? ' is-selected' : ''}"
        data-pain="${n}" tabindex="${stop ? '0' : '-1'}"
        aria-label="${n} out of 10, ${esc(band.word.toLowerCase())}"
        data-testid="sch--triage-pain-${n}">${n}</button>`;
  }).join('');

  /* The name of the reading, its unit and its Clear button are not here:
     they are the section's own header, written out in renderTriageBody
     alongside the headers of the sections either side of this one, so the
     three stay one block of markup and cannot drift apart. What this builds
     is the scale itself. */
  return `<div class="sch__pain">
      <div class="sch__pain-scale" role="radiogroup" aria-labelledby="triagePainLabel"
        data-testid="sch--triage-pain-scale">${steps}</div>
      <div class="sch__pain-anchors" aria-hidden="true">
        <span>No pain</span><span>Moderate</span><span>Worst possible</span>
      </div>
      <p class="sch__pain-readout" data-pain-readout aria-live="polite" ${value ? '' : 'hidden'}
        data-testid="sch--triage-pain-readout">${triagePainReadout(value)}</p>
      <input type="hidden" value="${esc(value)}"
        data-testid="sch--triage-vital-${TRIAGE_PAIN_KEY}" />
    </div>`;
}

/** The chosen score said back in both languages at once — the number the
 *  chart stores and the word the patient used — so the press can be checked
 *  without counting along the ramp to see which step went dark.
 *
 *  Empty until something is pressed, and the line is hidden with it. It used
 *  to read "Not recorded", which is a sentence saying the drawer is doing
 *  what a blank control already says it is doing. */
function triagePainReadout(value) {
  if (!value) return '';
  const band = triagePainBand(Number(value));
  return `<strong class="sch__pain-readout-score sch__pain-readout-score--${band.tone}">${esc(value)}/10</strong> ${esc(band.word)}`;
}

/**
 * Move the scale to a score — or to nothing, when `value` is ''.
 *
 * Repaints in place rather than re-rendering the drawer: the nurse may be
 * mid-pass with a caret in the note box, and this is called from a click
 * and from every arrow keypress.
 */
function setTriagePain(value) {
  const scale = document.querySelector('.sch__pain');
  if (!scale) return;

  scale.querySelector(`[data-testid="sch--triage-vital-${TRIAGE_PAIN_KEY}"]`).value = value;

  scale.querySelectorAll('[data-pain]').forEach((step) => {
    const selected = step.dataset.pain === value;
    step.setAttribute('aria-checked', String(selected));
    step.classList.toggle('is-selected', selected);
    step.tabIndex = selected || (!value && step.dataset.pain === '0') ? 0 : -1;
  });

  const readout = scale.querySelector('[data-pain-readout]');
  readout.innerHTML = triagePainReadout(value);
  readout.hidden = !value;
  /* Clear sits in the section's header now, beside the title, rather than
     inside the scale — so it is looked for on the drawer rather than within
     `scale`, and it is looked for at all rather than assumed. */
  const clear = document.querySelector('[data-pain-clear]');
  if (clear) clear.hidden = !value;
  refreshTriage();
}

function triageVitalsGrid(saved) {
  return TRIAGE_VITALS_FIELDS.filter((f) => f.key !== TRIAGE_PAIN_KEY).map(
    (f) => `<div class="sch__vital-field">
        <label class="sch__vital-label" for="triageVital-${f.key}">
          ${esc(f.label)}${f.computed ? ' <span class="sch__vital-auto">auto</span>' : ''}
        </label>
        <div class="sch__vital-control${f.computed ? ' sch__vital-control--computed' : ''}">
          <input id="triageVital-${f.key}" type="text" class="sch__vital-input"
            placeholder="${esc(f.placeholder ?? '')}"
            ${f.computed ? 'readonly aria-describedby="triageBmiHint"' : ''}
            value="${esc(saved?.[f.key] ?? '')}" data-testid="sch--triage-vital-${f.key}" />
          <span class="sch__vital-unit">${esc(f.unit)}</span>
        </div>
      </div>`
  ).join('');
}

/** Height and weight already say what the body mass index is, so the nurse
 *  does not type it: it fills itself the moment both boxes hold a number.
 *  Never cleared — a value that came back off a saved triage stays put even
 *  if the two fields it was derived from were not saved with it. */
function refreshTriageBmi() {
  const bmi = triageField('sch--triage-vital-bmi');
  if (!bmi) return;

  const kg = Number(triageField('sch--triage-vital-weight')?.value);
  const cm = Number(triageField('sch--triage-vital-height')?.value);
  if (kg > 0 && cm > 0) bmi.value = (kg / (cm / 100) ** 2).toFixed(1);
}

/**
 * The list the window has built, in the same three columns the drawer prints
 * it in — plus the × that takes a row back out again.
 *
 * It was a stack of bordered cards, each one a name in bold with "40 mg ·
 * Once daily" run together beside it. Every row asked the same three
 * questions and every row answered them in a different place, because the
 * dose and the frequency were joined by a dot and centred on whatever the
 * name's width left over. Under column headings the doses line up under
 * Dose, which is what makes a list of six readable as a list rather than as
 * six sentences.
 */
function triageMedsListMarkup() {
  if (!triageMedsDraft.length) return '';
  /* Boxed like the two summaries on the drawer, and boxed WITHOUT giving up the
     column ruler this list shares with the form above it — see the --aligned
     modifier for the one declaration that buys both. */
  return `<div class="sch__triage-table-wrap sch__triage-table-wrap--aligned">
      <table class="sch__triage-table sch__triage-med-table">
        <thead>
          <tr>
            <th scope="col">Medication</th>
            <th scope="col">Dose</th>
            <th scope="col">Frequency</th>
            <th scope="col"><span class="u-sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          ${triageMedsDraft
            .map(
              (m, index) => `<tr data-testid="sch--triage-med-row">
                <th scope="row">${esc(m.name)}</th>
                <td>${esc(m.dose) || '—'}</td>
                <td>${esc(m.frequency) || '—'}</td>
                <td class="sch__triage-med-remove-cell">
                  <button type="button" class="sch__triage-med-remove" data-triage-med-remove="${index}"
                    aria-label="Remove ${esc(m.name)}" data-testid="sch--triage-med-remove">
                    <svg class="ui-icon" aria-hidden="true"><use href="#i-close"></use></svg>
                  </button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function renderTriageMedsList() {
  const list = document.getElementById('triageMedsList');
  if (list) list.innerHTML = triageMedsListMarkup();
}

/**
 * Who is in front of the nurse.
 *
 * The drawer used to open on "Service Type / Location / Note Type" and never
 * name the patient at all — six facts about the booking above nothing about
 * the person. Name, MRN and age come first now, with the booking's own status
 * beside them, because the first thing a triage pass has to be sure of is
 * that it is the right patient's pass.
 */
function triagePatientStrip(patient, appt) {
  const initials = String(patient.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  /* Date of birth but not the age, though the line carried both. The age at
     this encounter is printed a few lines down as one of the booking facts,
     and "DOB 22-08-1982 · 43 yrs, 11 mo" beside a fact reading "43 yrs, 11 mo"
     is the same answer given twice — the second costs a glance to read and
     recognise as nothing new. */
  const facts = [
    `MRN ${esc(patient.mrn)}`,
    patient.sex && esc(patient.sex),
    patient.dob && `DOB ${esc(patient.dob)}`,
  ].filter(Boolean);

  return `<div class="sch__triage-patient" data-testid="sch--triage-patient">
      <span class="sch__triage-avatar" aria-hidden="true">${esc(initials)}</span>
      <div class="sch__triage-who">
        <p class="sch__triage-who-name">${esc(patient.name)}</p>
        <p class="sch__triage-who-meta">${facts.join(' · ')}</p>
      </div>
      <span class="sch__status sch-s-${slug(appt.status)}">${esc(appt.status)}</span>
    </div>`;
}

function renderTriageBody(appt) {
  const patient = patientOf(appt.mrn);
  const provider = providerById(appt.providerId);
  const { start } = spanOf(appt);
  const triage = appt.triage || {};
  triageMedsDraft = triage.medications ? [...triage.medications] : [];

  /* Whether either section has an answer in it — which decides the wording on
     its button, and nothing else now that neither one folds. Vitals are
     counted by the summary rather than by `triage.vitals` being present,
     because a pain score alone fills that object and pain is not one of the
     observations the Check Vitals window asks for. */
  const vitalsTaken = triageVitalsTaken(triage.vitals).length > 0;
  const medsTaken = triageMedsDraft.length > 0;

  const body = document.getElementById('triageBody');
  body.innerHTML = `
    ${triagePatientStrip(patient, appt)}

    <!-- THE BOOKING, AND NOTHING FOLDED BEHIND IT.

         Six facts in a bordered card were the second block of reference
         matter on the opening screen, under a progress bar that is reference
         matter too, and between them they pushed the first thing the nurse
         has to DO below the fold. Folding them away behind an "Appointment
         Details" disclosure only moved the problem: the fold was still a
         control the eye had to dismiss on the way to the first field, and
         what it opened was reference matter the nurse had already confirmed
         on the row she started the pass from. Not one of the six changes how
         the pass is taken — they say which visit this is, and the three that
         answer that on their own (what kind of visit, when, with whom) say it
         here on one line.

         WHAT THE VISIT IS FOR IS PRINTED UNDER THEM, NOT ASKED AGAIN.

         Reason For Visit used to be step one of the pass: a required textarea
         the nurse had to type into before Complete Triage would fire. But the
         reason for the visit is not something a triage pass discovers — it is
         what the booking was made FOR, taken down by whoever answered the
         phone and coded on the booking form, and it has been sitting on this
         appointment ever since. Asking for it a second time gets one of two
         answers: the nurse retypes what the row already says, or they write a
         shorter version of it that now disagrees with the one the provider
         will read on the encounter. Neither is worth a step, and a box that
         can only be filled in wrongly is worse than no box.

         So it is printed, through the same indicationValue() the appointment
         drawer prints it with — the sentence the desk typed and whatever it
         was coded to, read back through the catalogue — and it sits with the
         booking facts rather than above the numbered marks, because a heading
         with no mark beside it in a column of marked headings reads as a step
         somebody forgot to number. The pass now starts at Vitals, which is
         the first thing on this drawer the nurse actually does. -->
    <div class="sch__triage-booking">
      <p class="sch__triage-booking-line" data-triage-booking-line data-testid="sch--triage-booking">
        ${[
          esc(labelOf(appt)),
          `${triageDateLabel(appt.date)}, ${displayTime(toTime(start))}`,
          esc(provider?.name),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p class="sch__triage-booking-reason" data-testid="sch--triage-reason">
        <span class="sch__triage-booking-label">Reason For Visit</span>
        <span class="sch__triage-booking-value">${indicationValue(appt)}</span>
      </p>
    </div>

    <!-- VITALS: A PRESS, A WINDOW, AND A LINE SAYING WHAT CAME BACK.

         The seven boxes used to unfold in place. Two of the steps could do
         that, and with both unfolded the drawer was three screens long —
         so the nurse was scrolling to find the step they were on, in a panel
         whose whole argument is that the pass is three short steps. The boxes
         are in a window of their own now (#triageVitalsModal): the section
         keeps one line whether or not a set has been taken, and taking one
         gets the middle of the screen rather than a slot in a list. -->
    <section class="sch__triage-section">
      <header class="sch__triage-section-head">
        ${triageMark('vitals', 0, Boolean(triage.vitals), 'Vitals')}
        <div class="sch__triage-section-text">
          <p class="sch__triage-section-title">Vitals</p>
        </div>
        ${triageOpenButton('vitals', 'sch--triage-check-vitals', 'Check Vitals', 'Edit Vitals', vitalsTaken)}
      </header>
      <div class="sch__triage-summary" data-triage-summary="vitals"></div>
    </section>

    <!-- PAIN LEVEL, ON THE DRAWER RATHER THAN IN THE VITALS WINDOW — AND NOW
         UNDER A HEADING OF THE SAME RANK AS THE READINGS EITHER SIDE OF IT.

         It sat in the grid as an eighth box with "0-10" printed in the unit
         slot, which made a patient-reported score look like another thing the
         nurse measures. It did not follow the other seven into the Check
         Vitals window either: this is the one reading on the drawer that
         routinely changes what happens next, and a score you have to open
         something to see is a score nobody reads twice. Out here it is always
         on screen.

         What it kept after that move was a small grey label, indented under
         the Vitals heading. That is the right weight for a caption on a
         single box and the wrong one for what is actually beneath it: eleven
         steps, three anchor words and a readout — a block the size of the
         flowsheet above it, arriving between two sections that each announce
         themselves with a mark and a title. A rank below its neighbours, the
         scale read as an appendix to the vitals table rather than as a
         reading of its own, which is exactly backwards for the reading a
         nurse scrolls this drawer to find.

         So it takes the heading its neighbours take: the same round mark, the
         same title, and Clear sitting where Check Vitals and Add Medication
         sit. The unit rides beside the title rather than under it, because
         0-to-10 is the one scale in the pass that cannot be inferred from the
         value — a 7 says nothing without the 10.

         The eleven answers are laid out as a ramp rather than folded into a
         dropdown or a typed box — see triagePainScale for why. -->
    <section class="sch__triage-section">
      <header class="sch__triage-section-head">
        ${triagePainMark(triage.vitals?.[TRIAGE_PAIN_KEY])}
        <div class="sch__triage-section-text">
          <p class="sch__triage-section-title" id="triagePainLabel">Pain Level
            <span class="sch__triage-section-unit">${esc(TRIAGE_PAIN_FIELD.unit)}</span></p>
        </div>
        <button type="button" class="sch__pain-clear" data-pain-clear
          ${triagePainValue(triage.vitals?.[TRIAGE_PAIN_KEY]) ? '' : 'hidden'}
          data-testid="sch--triage-pain-clear">Clear</button>
      </header>
      <div class="sch__triage-pain">
        ${triagePainScale(triage.vitals?.[TRIAGE_PAIN_KEY])}
      </div>
    </section>

    <!-- CURRENT MEDICATION: THE SAME MOVE, FOR THE SAME REASON.

         Four fields and then a row per medication, unfolding inside the
         drawer, is a section that grows past the Note step the moment the
         patient is on more than three things — and a list of six is ordinary.
         The form and the list it builds live in #triageMedModal now. They
         live there and nowhere else: one place for a row to be read and
         removed, so the drawer can never disagree with the window about what
         has been recorded. What stands here is the count and the names. -->
    <section class="sch__triage-section">
      <header class="sch__triage-section-head">
        ${triageMark('meds', 1, medsTaken, 'Medications')}
        <div class="sch__triage-section-text">
          <p class="sch__triage-section-title">Current Medication</p>
        </div>
        ${triageOpenButton('meds', 'sch--triage-add-medication', 'Add Medication', 'Edit Medication', medsTaken)}
      </header>
      <div class="sch__triage-summary" data-triage-summary="meds"></div>
    </section>

    <section class="sch__triage-section">
      <header class="sch__triage-section-head">
        ${triageMark('note', 2, Boolean(triage.note), 'Note')}
        <div class="sch__triage-section-text">
          <p class="sch__triage-section-title">Note</p>
        </div>
      </header>
      <ui-textarea rows="3" placeholder="e.g. Came in with her daughter, who has the medication list"
        value="${esc(triage.note || '')}" data-testid="sch--triage-note"></ui-textarea>
    </section>`;

  renderTriageVitalsModal(triage.vitals);
  renderTriageMedModal();

  fillTriageMedications(appt.mrn);
  refreshTriage();
}

/**
 * The two windows the drawer opens are filled here, at the same moment the
 * drawer itself is — not when they are opened.
 *
 * readTriageForm reads the vitals boxes whether or not the window is on
 * screen, and Save as Draft can be pressed without either window ever having
 * been opened. Filling them on open would mean a saved set of observations
 * sitting in an appointment and nowhere in the DOM, which is a draft that
 * quietly drops what the last pass recorded.
 *
 * They are the drawer's own markup in every other respect: same classes, same
 * testids, same delegated listeners (see wireTriageSurface).
 */
function renderTriageVitalsModal(vitals) {
  const host = document.getElementById('triageVitalsBody');
  if (!host) return;
  host.innerHTML = `<div class="sch__vital-grid" id="triageVitalsGrid"
      data-testid="sch--triage-vitals-grid">${triageVitalsGrid(vitals)}</div>`;
}

function renderTriageMedModal() {
  const host = document.getElementById('triageMedBody');
  if (!host) return;
  host.innerHTML = `
    <div class="sch__triage-med-form">
      <!-- THE PATIENT'S OWN LIST, NOT A BLANK BOX.

           Typing the name meant retyping what the chart already holds, at a
           keyboard, from memory, under time pressure — which is how
           "Pantoprazole 40 mg" gets recorded as "pantoprazol 40" and stops
           matching anything. The dropdown is what is on file for THIS
           patient: active prescriptions and the medications they have
           reported, so the pass is the nurse CONFIRMING a list rather than
           rebuilding it.

           "Other" is the last row and turns the field into a text box, so
           something genuinely new — bought over the counter, started
           elsewhere since the last visit — is still typed where it was asked
           for. See fillTriageMedications(). -->
      <ui-select label="Medication Name" label-hidden
        placeholder="Medication name"
        free-text="${TRIAGE_MED_OTHER}"
        free-text-placeholder="Type the medication name"
        data-testid="sch--triage-med-name"></ui-select>
      <!-- HOW MUCH AND HOW OFTEN ARE PICKED TOO, for the reason the name is.
           Both were free text, and free text is how one fact gets recorded
           four ways: "20mg", "20 mg", "1 tab", "1 tablet" are one dose, and a
           provider reading the pass ten minutes later has to interpret each
           of them. Dose is the drug's OWN unit counted out — tablets for a
           tablet, injections for a pre-filled pen — and frequency is the
           twelve a sig is actually written in, with whatever the chart
           already holds for this drug offered above them.

           Both keep an "Other" row that turns the control into a text box,
           because a list of twelve cannot be every answer: half a sachet
           twice a week is a real prescription, and it is typed where it was
           asked for rather than not recordable. See
           fillTriageDoseAndFrequency(). -->
      <ui-select label="Dose" label-hidden placeholder="Dose"
        free-text="${TRIAGE_MED_OTHER}"
        free-text-placeholder="Type the dose"
        data-testid="sch--triage-med-dose"></ui-select>
      <ui-select label="Frequency" label-hidden placeholder="Frequency"
        free-text="${TRIAGE_MED_OTHER}"
        free-text-placeholder="Type the frequency"
        data-testid="sch--triage-med-frequency"></ui-select>
      <!-- FULL, so the button fills its track: that track is a fixed width the
           list below measures its last column against, and a button sized to
           the word "Add" would leave the two disagreeing by whatever is left
           over. See the column ruler in css/screen-scheduler.css. -->
      <ui-button variant="outline" size="sm" full id="triageMedAdd" data-testid="sch--triage-med-add">Add</ui-button>
    </div>
    <div id="triageMedsList">${triageMedsListMarkup()}</div>`;
}

/**
 * The three surfaces a triage answer can be sitting on: the drawer itself,
 * the vitals window and the medication window.
 *
 * A lookup by testid used to be `triageBody.querySelector(...)` and could
 * afford to be, because every field was inside the drawer. Two of them are
 * now in dialogs of their own, parented to <body> rather than to the drawer,
 * so the search has to cross all three — in this order, because the pain
 * score is the one vital that stayed behind on the drawer and would otherwise
 * be looked for only where it is not.
 */
function triageSurfaces() {
  return ['triageBody', 'triageVitalsBody', 'triageMedBody']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

/** The one field wearing this testid, wherever of the three it lives. */
function triageField(testid) {
  for (const surface of triageSurfaces()) {
    const found = surface.querySelector(`[data-testid="${testid}"]`);
    if (found) return found;
  }
  return null;
}

/**
 * Every answer the pass currently holds, across all three of its surfaces.
 *
 * Vitals are read whether or not their window is on screen — which is the
 * whole reason the boxes are filled in at render rather than at open. A read
 * that only reached what was visible would save a blank set for the nurse who
 * took the observations, shut the window and then pressed Save as Draft.
 */
function readTriageForm() {
  const body = document.getElementById('triageBody');
  if (!body) return null;

  const collected = {};
  let anyVital = false;
  TRIAGE_VITALS_FIELDS.forEach((f) => {
    const value = triageField(`sch--triage-vital-${f.key}`)?.value?.trim();
    if (value) anyVital = true;
    collected[f.key] = value || null;
  });

  return {
    note: body.querySelector('[data-testid="sch--triage-note"]')?.value?.trim() || null,
    vitals: anyVital ? collected : null,
    medications: [...triageMedsDraft],
  };
}

/** The observations a saved set actually holds, in grid order. Pain is left
 *  out of it: it is asked on the drawer rather than in the window, and the
 *  scale it is asked on is three lines below this — a "Pain 5" printed here
 *  would be the same answer twice, once as a value and once as a pressed
 *  step. */
const triageVitalsTaken = (vitals) =>
  TRIAGE_VITALS_FIELDS.filter((f) => f.key !== TRIAGE_PAIN_KEY && vitals?.[f.key]);

/**
 * What came back from the Check Vitals window, as a flowsheet row.
 *
 * This was one line of text — "BP 118/76 · HR 74 · Temp 98.6 · Resp 16" —
 * which is how a set of observations is written in a sentence and not how it
 * is read: seven short names and seven numbers alternating along a line, with
 * nothing but a dot saying which number belongs to which name, and the units
 * dropped altogether because they would not fit. Set out as a table it is the
 * shape every chart in this build already prints vitals in — a column per
 * reading, its unit under its name, one row of values — and a nurse checking
 * the temperature reads down a column rather than counting along a line.
 *
 * Only the readings that were taken get a column. A blank column is a
 * question about whether the value is missing or the field is unused, and a
 * partial set is the normal case in triage.
 */
function triageVitalsTable(vitals) {
  const taken = triageVitalsTaken(vitals);
  if (!taken.length) return '';

  /* Wrapped, and the wrapper is not a spare div: it carries the outline and
     the rounded corners a collapsed table cannot clip for itself, and it is
     what lets seven readings slide sideways in a drawer narrower than they
     are. See .sch__triage-table-wrap. */
  return `<div class="sch__triage-table-wrap">
      <table class="sch__triage-table sch__triage-table--flowsheet"
        data-testid="sch--triage-vitals-table">
        <thead>
          <tr>${taken
            .map(
              (f) => `<th scope="col">${esc(f.short)}
                <span class="sch__triage-table-unit">${esc(f.unit)}</span></th>`
            )
            .join('')}</tr>
        </thead>
        <tbody>
          <tr>${taken
            .map(
              (f) => `<td data-testid="sch--triage-vitals-cell-${f.key}">${esc(vitals[f.key])}</td>`
            )
            .join('')}</tr>
        </tbody>
      </table>
    </div>`;
}

/**
 * The medications recorded so far, on the drawer, read-only.
 *
 * The count and the names on one line — "2 recorded — Pantoprazole,
 * Mesalazine" — said how many and which, and nothing about the two things
 * that make a medication list worth taking: the dose and how often. Three
 * columns say all four facts in the width the line took, and the dash in an
 * empty cell is a dose nobody gave rather than a dose nobody asked for.
 *
 * Removing a row is not offered here. The rows are added and taken away in
 * the medication window, which is the one place that owns the list — see the
 * comment on the Current Medication section.
 */
function triageMedsTable(meds) {
  if (!meds.length) return '';

  /* Boxed, banded and ruled, exactly as the vitals flowsheet three lines up
     the drawer is — the two are peers. Both are a read-only answer to a step
     of the pass, they sit one under the other in the same column, and a list
     of six drugs asks the same question of the eye that a row of six readings
     does: which heading does this cell belong to. What made the flowsheet
     legible makes this legible, so it is the same wrapper and the same rules.

     No --stacked here any more. That modifier only ever pulled the outer two
     columns flush with the drawer's edge, which is right for a table with no
     border and wrong inside one — the name would sit against the outline. The
     medication window's own list keeps it, for a reason spelled out there. */
  return `<div class="sch__triage-table-wrap">
      <table class="sch__triage-table" data-testid="sch--triage-meds-table">
        <thead>
          <tr>
            <th scope="col">Medication</th>
            <th scope="col">Dose</th>
            <th scope="col">Frequency</th>
          </tr>
        </thead>
        <tbody>
          ${meds
            .map(
              (m) => `<tr>
                <th scope="row">${esc(m.name)}</th>
                <td>${esc(m.dose) || '—'}</td>
                <td>${esc(m.frequency) || '—'}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

/**
 * Repaint everything derived from the live fields: the three marks and the
 * two collapsed summaries. Called on every keystroke in the drawer, so it
 * only ever writes text and class names — nothing here rebuilds an input the
 * nurse might have the caret in.
 */
function refreshTriage() {
  const body = document.getElementById('triageBody');
  const draft = readTriageForm();
  if (!body || !draft) return;

  /* Vitals are counted by the observations that were actually taken, not by
     `draft.vitals` being present — a pain score alone fills that object, and
     pain is a heading of its own now. Counting it here would tick the Vitals
     mark green over an empty flowsheet, next to a Check Vitals button that
     still says nothing has been checked. */
  const observations = triageVitalsTaken(draft.vitals);
  const done = {
    vitals: observations.length > 0,
    meds: draft.medications.length > 0,
    note: Boolean(draft.note),
  };

  TRIAGE_STEPS.forEach((step, index) => {
    const mark = body.querySelector(`[data-triage-mark="${step.key}"]`);
    if (mark) {
      mark.className = `sch__triage-mark sch__triage-mark--${done[step.key] ? 'done' : 'pending'}`;
      mark.innerHTML = triageMarkInner(index, done[step.key], step.label);
    }
  });

  /* Pain's mark is repainted the same way and for the same reason — written
     over, never rebuilt — but it is read off the hidden input rather than off
     the step list, because it is not one of the three steps. */
  const painMark = body.querySelector('[data-triage-pain-mark]');
  if (painMark) {
    const painDone = Boolean(draft.vitals?.[TRIAGE_PAIN_KEY]);
    painMark.className = `sch__triage-mark sch__triage-mark--${painDone ? 'done' : 'pending'}`;
    painMark.innerHTML = triagePainMarkInner(painDone);
  }

  /* THE TABLE IS THE SECTION NOW.

     Vitals and Current Medication are each a heading, a button and whatever
     the button has recorded — and what it has recorded is set out as a table
     rather than run together into a line of text. See triageVitalsTable and
     triageMedsTable.

     A section with no answer in it yet prints nothing at all. It used to say
     "No observations taken yet" and "Nothing recorded yet", which is a
     sentence telling the nurse what the empty space beneath a button called
     Check Vitals had already told them — and two more grey lines on a drawer
     whose whole argument is that the pass is three short steps. */
  const paint = (key, markup) => {
    const el = body.querySelector(`[data-triage-summary="${key}"]`);
    if (el) el.innerHTML = markup;
  };
  paintTriageOpenButton('vitals', observations.length > 0);
  paintTriageOpenButton('meds', done.meds);

  paint('vitals', triageVitalsTable(draft.vitals));
  paint('meds', triageMedsTable(draft.medications));
}

function openTriage(appt, trigger) {
  triagingId = appt.id;
  renderTriageBody(appt);
  document.getElementById('triageModal').open(trigger);
}

/**
 * Open one of the drawer's two windows.
 *
 * Neither one is filled here: both were filled when the drawer was rendered,
 * for the reason set out on renderTriageVitalsModal. What opening does is
 * take a copy of the vitals, because a dialog offering Cancel has to be able
 * to honour it — and the boxes behind that dialog ARE the live answer, so
 * without a copy "Cancel" would keep every number typed before it was pressed
 * and mean nothing at all.
 *
 * The medication window has no Cancel for the same reason inverted: each Add
 * commits a row to the list the moment it is pressed, and the rows are removed
 * one at a time with the × beside them. There is no pending state left for a
 * Cancel to throw away, so it offers Done and nothing else.
 */
function openTriageVitals(trigger) {
  triageVitalsSnapshot = {};
  TRIAGE_VITALS_FIELDS.filter((f) => f.key !== TRIAGE_PAIN_KEY).forEach((f) => {
    triageVitalsSnapshot[f.key] = triageField(`sch--triage-vital-${f.key}`)?.value ?? '';
  });
  document.getElementById('triageVitalsModal').open(trigger);
}

/** Put the boxes back as the window found them, then shut it. */
function cancelTriageVitals() {
  Object.entries(triageVitalsSnapshot || {}).forEach(([key, value]) => {
    const input = triageField(`sch--triage-vital-${key}`);
    if (input) input.value = value;
  });
  document.getElementById('triageVitalsModal').close();
  refreshTriage();
}

/** Shut the window on what is in it. Nothing is written here — the boxes are
 *  the draft, and Complete Triage / Save as Draft are what commit it — so
 *  this repaints the mark and the summary line and gets out of the way. */
function closeTriageVitals() {
  triageVitalsSnapshot = null;
  document.getElementById('triageVitalsModal').close();
  refreshTriage();
}

function wireTriageSurface(surface) {
  surface.addEventListener('click', (event) => {
    /* The two windows open from the drawer and return to it. The button that
       opened one is handed to open() as the trigger, so closing puts focus
       back on it rather than at the top of the drawer — a nurse who took the
       vitals and shut the window lands on "Edit Vitals", one Tab from the
       medication step below it. */
    const openBtn = event.target.closest('[data-triage-open]');
    if (openBtn) {
      if (openBtn.dataset.triageOpen === 'vitals') openTriageVitals(openBtn);
      else document.getElementById('triageMedModal').open(openBtn);
      return;
    }

    const removeBtn = event.target.closest('[data-triage-med-remove]');
    if (removeBtn) {
      triageMedsDraft.splice(Number(removeBtn.dataset.triageMedRemove), 1);
      renderTriageMedsList();
      refreshTriage();
      return;
    }

    /* The pain scale is buttons, so nothing it does raises `input` the way
       every other field in the drawer does — the marks and the summary are
       repainted from inside setTriagePain instead. Pressing the step that is
       already chosen clears it: the only way back out of a score otherwise is
       the Clear button, and a nurse who pressed 7 for the wrong patient's
       answer should be able to undo it where they did it. */
    const painStep = event.target.closest('[data-pain]');
    if (painStep) {
      const chosen = painStep.getAttribute('aria-checked') === 'true';
      setTriagePain(chosen ? '' : painStep.dataset.pain);
      painStep.focus();
      return;
    }

    if (event.target.closest('[data-pain-clear]')) {
      setTriagePain('');
      document.querySelector('.sch__pain [data-pain="0"]')?.focus();
    }
  });

  /* The scale is one radiogroup, so it is driven the way a radiogroup is: the
     arrows walk it, Home and End jump to either end, and selection follows
     focus — on a scale of eleven adjacent values there is no step you would
     want to land on without choosing. Backspace and Delete take the answer
     back off, which is the keyboard's version of pressing the chosen step. */
  surface.addEventListener('keydown', (event) => {
    const step = event.target.closest('[data-pain]');
    if (!step) return;

    const current = Number(step.dataset.pain);
    const next = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      Home: 0,
      End: 10,
    }[event.key];

    if (next != null) {
      event.preventDefault();
      const clamped = Math.min(10, Math.max(0, next));
      setTriagePain(String(clamped));
      document.querySelector(`.sch__pain [data-pain="${clamped}"]`)?.focus();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      setTriagePain('');
      step.focus();
    }
  });

  /* Every mark, tick and hint in the drawer is derived from what the fields
     hold, so all of it is recomputed as they are typed into. One delegated
     `input` listener catches the lot: ui-textarea and ui-input render native
     controls into the light DOM, so their events bubble up to here exactly
     like the vitals grid's own bare inputs do. */
  surface.addEventListener('input', (event) => {
    if (event.target.matches('[data-testid="sch--triage-vital-weight"], [data-testid="sch--triage-vital-height"]')) {
      refreshTriageBmi();
    }
    refreshTriage();
  });

  /* Enter commits the medication from a box that is being TYPED in — an
     "Other" name, dose or frequency — so a row finished by typing is a row
     added without the hand leaving the keyboard.

     It cannot mean that on the three lists, and should not: Enter on a closed
     dropdown opens it, which is what the keyboard has always done and what
     js/lib/select-menu.js implements (it takes the key in the capture phase,
     so this listener never sees it). From a list the commit is the Add button,
     which is the next stop after Frequency — Tab, Enter. */
  surface.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.closest('.sch__triage-med-form')) return;
    event.preventDefault();
    addTriageMedication();
  });

  surface.addEventListener('ui-click', (event) => {
    if (event.target.closest('#triageMedAdd')) addTriageMedication();
  });

  /* Naming the drug is what tells the two boxes beside it what to offer, so
     the dose ladder and the frequency list are refitted the moment it is
     named — before the hand gets to them, rather than after an answer has been
     chosen off the previous drug's list. Only the name field does this; the
     other two changing say nothing about what either should hold.

     BOTH EVENTS, and the typed one is why. A name PICKED off the list arrives
     as ui-change and nothing is moving; a name TYPED under "Other" commits on
     the way out of the box — which is the same moment the hand is arriving at
     Dose, so a refit that waited for it would rebuild the field being moved
     into. Refitting on every keystroke instead means the lists are already
     right by the time the box is left, and the ui-change that follows finds
     nothing to change. See setTriageAnswerOptions. */
  const refitFromName = (event) => {
    const field = event.target.closest('[data-testid="sch--triage-med-name"]');
    if (field) fillTriageDoseAndFrequency(triageChosen(field));
  };
  surface.addEventListener('ui-change', refitFromName);
  surface.addEventListener('ui-input', refitFromName);
}

/** Reads every field currently in the drawer — including the medications
 *  list built up in triageMedsDraft — and saves it onto the appointment. */
function saveTriage(complete) {
  const appt = appointments.find((a) => a.id === triagingId);
  if (!appt) return;
  const patient = patientOf(appt.mrn);
  const draft = readTriageForm();
  if (!draft) return;

  /* Nothing blocks Complete Triage any more. The one field that used to —
     Reason For Visit — is printed off the booking rather than typed here, so
     there is no longer an answer the nurse can arrive at the footer without
     having given. Every remaining section is a reading that may legitimately
     not have been taken: a patient who declines a blood pressure, a patient
     on nothing, a pass with nothing worth telling the provider. Refusing to
     complete over any of those would be the drawer inventing a requirement
     the clinic does not have. */

  /* The reason is copied onto the saved pass rather than left to be looked up
     off the appointment later. What the nurse was working against is part of
     what the pass RECORDED — and if the desk re-codes the booking next week,
     the triage should still say what was in front of them at the time. */
  appt.triage = {
    reason: appt.reason || null,
    vitals: draft.vitals,
    vitalsAddedAt: draft.vitals
      ? appt.triage?.vitalsAddedAt || displayTime(toTime(nowMinutes()))
      : null,
    medications: draft.medications,
    note: draft.note,
    completed: Boolean(complete),
  };
  appt.status = complete ? 'Checked In' : 'Triage';

  saveAppointments(appointments);
  document.getElementById('triageModal').close();

  // Completing triage is what hands the visit to the provider, so it goes
  // straight to the encounter rather than back to the list — a draft still
  // has more of the sheet to fill in, so that one stays on the scheduler.
  if (complete) {
    window.location.href = `encounter.html?appt=${encodeURIComponent(appt.id)}`;
    return;
  }

  paint();
  notify(`Triage saved as a draft for ${patient.name}.`, 'success');
}

/** Minutes since midnight, right now — for the Vitals "Added On" stamp.
 *  toTime() elsewhere in this file converts FROM minutes, so this is the one
 *  spot that has to go the other way. */
function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/* ===================== Appointment details ===================== */

/** The appointment the details drawer is showing. */
let viewingId = null;

/**
 * One cell of the appointment card: its label above its value.
 *
 * Label above rather than beside, which is what lets two of them sit side by
 * side in a drawer this narrow. Nine of these stacked in a label/value column
 * was a screen and a half of scrolling to read eleven short facts.
 *
 * `wide` spans both columns, for the two values — the indication and the
 * desk's note — that are sentences rather than measurements.
 */
const detailRow = (label, value, { wide = false, sub = '' } = {}) =>
  `<div class="sch__detail-row${wide ? ' sch__detail-row--wide' : ''}">
    <span class="sch__detail-label">${esc(label)}</span>
    <span class="sch__detail-value">${value}</span>
    ${sub ? `<span class="sch__detail-sub">${sub}</span>` : ''}
  </div>`;

/** One labelled fact under the patient's name: "DOB 30-10-1969". */
const patientFact = (label, value) =>
  `<span><span class="sch__detail-fact-label">${esc(label)}</span>${esc(value)}</span>`;

/**
 * The indication, as the drawer prints it.
 *
 * A diagnosis is attached on the booking form, not here — the drawer is what
 * the desk READS against the patient in front of them, and a picker sitting
 * among printed facts reads as one more printed fact until you happen to click
 * it. Both halves of the stored reason are shown: the sentence the desk typed
 * and whatever it has been coded to, each on its own line, with the codes read
 * back through the catalogue so what is printed is the current description
 * rather than whatever wording was saved.
 */
function indicationValue(appt) {
  const parts = String(appt.reason ?? '')
    .split(REASON_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return '—';

  return parts
    .map((part) => {
      // Only the code is set in mono — it is an identifier and reads as one.
      // Its description is a sentence and is left as prose.
      const entry = icd10ByCode(icd10CodeFrom(part));
      return entry
        ? `<span class="sch__detail-code">${esc(entry.code)}</span> ${esc(entry.description)}`
        : esc(part);
    })
    .join('<br />');
}

/**
 * The forms this appointment type sends out, on one line rather than three.
 *
 * The state is the mark beside the name — back, or still out — and only a form
 * still out carries an action, because Resend beside a form already returned
 * is a button with nothing to do.
 */
function formsValue(forms) {
  if (!forms.length) {
    return '<p class="sch__detail-muted">No forms are attached to this appointment type.</p>';
  }

  return `<div class="sch__forms">${forms
    .map((form, index) => {
      // The first is back and the rest are not — the prototype's standing
      // fiction about form returns, unchanged.
      const returned = index === 0;
      return `<span class="sch__form${returned ? ' sch__form--done' : ''}">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-${
          returned ? 'check' : 'clock'
        }"></use></svg>
        ${esc(form)}
        ${
          returned
            ? '<span class="u-sr-only">returned</span>'
            : `<button type="button" class="sch__detail-action"
                 data-resend="${index}">Resend</button>`
        }
      </span>`;
    })
    .join('')}</div>`;
}

/* --- The commit button, and the step it is offering ------------------------
   One button used to say "Complete Check In" at every booking it was ever
   shown beside — at one already checked in, at one cancelled last week, at
   one three months out. It was never wrong about what it WOULD do, only
   silent about whether that was the sensible thing to do next. So it reads
   the booking and names the step this particular visit is actually at.

   It is never disabled. A booking marked No Show by mistake is a thing the
   desk fixes by checking the patient in, which is the same reason the Start
   button on the row is deliberately always pressable.
   -------------------------------------------------------------------------- */

/** Statuses that mean the patient is already through the door. */
const ARRIVED_STATUSES = ['Checked In', 'Triage', 'Check Out'];

/**
 * The label and the routing for the drawer's primary button.
 *
 * Read fresh every time the status changes, which is why it is a function of
 * the booking rather than something decided once when the drawer opened.
 */
function checkInStep(appt) {
  const kindId = kindOf(appt);

  if (ARRIVED_STATUSES.includes(appt.status)) {
    // A clinical visit's nurse pass is the step between the door and the
    // provider, so that is where an arrived patient's button goes; Triage as a
    // status means the pass is started but unfinished.
    if (kindId === 'clinical' && appt.status !== 'Check Out') {
      return {
        label: appt.status === 'Triage' ? 'Resume Triage' : 'Start Triage',
        go: (modal) => {
          modal.close();
          openTriage(appt);
        },
      };
    }

    return {
      label: 'Open Encounter',
      go: () => {
        window.location.href = `encounter.html?appt=${encodeURIComponent(appt.id)}`;
      },
    };
  }

  return {
    label: 'Complete Check In',
    go: (modal) => {
      // A procedure needs consent, privacy acknowledgement and a ride home
      // before the patient is actually in, so it goes through the check-in
      // screen. A clinic visit is checked in at the desk in one click.
      if (kindId === 'procedure') {
        window.location.href = `check-in.html?appt=${encodeURIComponent(appt.id)}`;
        return;
      }

      appt.status = 'Checked In';
      saveAppointments(appointments);

      // A Clinical visit goes straight into Triage — a nurse's vitals /
      // medications / note pass before the provider ever opens the encounter.
      // There is no triage step for Infusion, so that still opens the
      // encounter directly, same as before. (Start Triage / View Triage on the
      // row menu still reaches the same drawer afterwards, to resume or
      // review it.)
      if (kindId === 'clinical') {
        modal.close();
        openTriage(appt);
        return;
      }

      window.location.href = `encounter.html?appt=${encodeURIComponent(appt.id)}`;
    },
  };
}

/**
 * WHAT THERE IS TO TAKE, AND THE MEANS OF TAKING IT — in the check-in drawer,
 * because that is the one moment it can be taken.
 *
 * The patient is at the desk. Everything after this — a statement run, a
 * letter, a collections call — costs more than the balance is usually worth,
 * so the drawer the desk already has open on the way to "Complete Check In"
 * is where the ask belongs. Not a new screen, not a hand-off to Billing: the
 * copay this visit attracts and anything the last visit left owing, added up,
 * with a button under them.
 *
 * IT IS NEVER A GATE. The check-in button beneath is untouched by whether
 * anything has been collected — a balance is a reason to ask for payment, not
 * a reason to turn a patient away, and a desk that cannot check somebody in
 * without taking money finds another way to check them in.
 *
 * The card is drawn whenever there is a figure to name, which means a copay
 * on the plan or an outstanding balance. With neither, a "Payment" heading
 * over "$0.00" would be a row of the drawer spent saying nothing.
 */
function paymentPanel(appt, coverage) {
  const balance = balanceFor(appt.mrn);
  const copay = coverage.copay ?? 0;
  if (!copay && !balance) return '';

  const lines = [
    copay ? { label: `Copay — ${coverage.insurance}`, value: money(copay) } : null,
    balance
      ? {
          label: `Previous balance — ${balance.reason}`,
          value: money(balance.amount),
          overdue: balance.overdue,
        }
      : null,
  ].filter(Boolean);

  const due = copay + (balance?.amount ?? 0);

  return `
    <section class="sch__detail-card" data-testid="sch--d-payment">
      <h3 class="sch__detail-title">
        Payment
        <button type="button" class="sch__detail-action" id="dCollectOpen"
          data-testid="sch--d-collect-open">Collect Payment</button>
      </h3>

      <dl class="sch__pay-lines">
        ${lines
          .map(
            (line) => `<div${line.overdue ? ' class="sch__pay-line--overdue"' : ''}>
              <dt>${esc(line.label)}${
              line.overdue ? ' <ui-badge status="critical">Overdue</ui-badge>' : ''
            }</dt>
              <dd>${esc(line.value)}</dd>
            </div>`
          )
          .join('')}
        <div class="sch__pay-total">
          <dt>Due today</dt><dd>${esc(money(due))}</dd>
        </div>
      </dl>

      <!-- Hidden until asked for. The figures above are what the desk reads;
           the form is what it uses once the patient has said yes, and a method
           dropdown standing open under every unpaid balance reads as a demand
           rather than an option. -->
      <div class="sch__pay-form" id="dCollectForm" hidden>
        <ui-input id="dPayAmount" type="number" min="0" step="0.01" size="sm"
          label="Amount" value="${esc(due.toFixed(2))}"
          data-testid="sch--d-pay-amount"></ui-input>
        <ui-select id="dPayMethod" label="Method" size="sm"
          options="${esc(PAYMENT_METHODS.join(','))}"
          value="${esc(PAYMENT_METHODS[0])}"
          data-testid="sch--d-pay-method"></ui-select>
        <ui-button variant="primary" size="sm" id="dPayTake"
          data-testid="sch--d-pay-take">Take payment</ui-button>
      </div>

      <div id="dPayResult" aria-live="polite"></div>
    </section>`;
}

/** Wire the payment panel, if this booking drew one. */
function wirePaymentPanel(appt) {
  const open = document.getElementById('dCollectOpen');
  if (!open) return;

  const form = document.getElementById('dCollectForm');
  open.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) field('dPayAmount')?.focus?.();
  });

  document.getElementById('dPayTake').addEventListener('ui-click', () => {
    const amount = Number(field('dPayAmount').value);
    if (!(amount > 0)) {
      field('dPayAmount').setAttribute('error', 'Enter an amount to take');
      return;
    }
    field('dPayAmount').removeAttribute('error');

    const method = field('dPayMethod').value;
    const { remaining } = collectPayment(appt.mrn, amount, method);

    form.hidden = true;
    document.getElementById('dPayResult').innerHTML =
      `<ui-alert severity="success">${esc(money(amount))} taken by ${esc(
        method
      )}. ${remaining ? `${esc(money(remaining))} still outstanding.` : 'Nothing left outstanding.'}</ui-alert>`;
    notify(`${money(amount)} collected from ${patientOf(appt.mrn).name}.`);
  });
}

function openDetails(appt, trigger) {
  const modal = document.getElementById('startModal');
  if (!modal || !appt) return;
  viewingId = appt.id;

  const patient = patientOf(appt.mrn);
  const coverage = coverageFor(appt.mrn);
  const { start, end } = spanOf(appt);
  const type = typeById(appt.typeId);
  /* The booking's own answer first. Sniffing the activity's TITLE for the word
     "virtual" was the only way to tell before the form asked — which meant a
     telehealth consultation booked as "Consultation" printed "In person", and
     the desk had no way to say otherwise. The sniff is kept as the fallback
     for bookings made before the field existed. */
  const virtual = appt.mode
    ? appt.mode === 'Telehealth'
    : /virtual|telemed/i.test(type?.title ?? '');
  const forms = type?.forms ?? [];
  const kindId = kindOf(appt);

  document.getElementById('startBody').innerHTML = `
    <section class="sch__detail-card sch__detail-patient">
      <div class="sch__detail-ident">
        <ui-avatar name="${esc(patient.name)}" size="md"></ui-avatar>
        <div class="sch__detail-name">
          <strong>${esc(patient.name)}</strong>
          <span class="sch__detail-mrn">#${esc(appt.mrn)}</span>
          ${patient.age < 18 ? '<ui-badge status="info">Minor</ui-badge>' : ''}
        </div>
        ${
          /* Status sits with the name rather than nine rows down among the
             booking's measurements, because it is the one fact that says what
             is happening to this person right now — and the only field the
             drawer still sets, everything else about the booking being changed
             on the form behind Edit. The dot is the colour the clinic gave that
             status in Settings, the same colour the list and both calendars
             draw it in. */ ''
        }
        <div class="sch__detail-status">
          <span class="sch__dot" id="dStatusDot" aria-hidden="true"></span>
          <ui-select id="dStatus" label="Status" label-hidden size="sm"
            data-testid="sch--d-status"></ui-select>
        </div>
      </div>
      ${
        /* Labelled facts, not a run of values separated by dots. "Female ·
           30-10-1969 (69 yrs) · 602-555-3857" asks the reader to work out which
           is which; naming them costs four grey words and means the eye can go
           straight to the one it came for. They take the card's full width
           rather than the column left over beside the status control, which is
           what was breaking four short facts over three ragged lines. */ ''
      }
      <div class="sch__detail-facts">
        ${patientFact('DOB', patient.dob)}
        ${patientFact('Age', `${patient.age}Y`)}
        ${patientFact('Sex', patient.sex === 'M' ? 'Male' : 'Female')}
        ${patientFact('Phone', patient.phone)}
      </div>
    </section>

    <section class="sch__detail-card">
      <div class="sch__detail-grid">
        ${detailRow(
          'Date & Time',
          esc(longDate(appt.date)),
          { sub: `${displayTime(toTime(start))} – ${displayTime(toTime(end))}` }
        )}
        ${detailRow('Appointment Type', esc(labelOf(appt)), {
          sub: `${KIND_LABELS[kindId]} · ${lengthOf(appt)} min`,
        })}
        ${
          /* Mode is a CLINICAL question — is this person coming in or dialling
             in — and a procedure has only one answer to it. A scope cannot be
             passed down a video call, so a row reading "In person" on every
             procedure ever booked is a line that has never once told anybody
             anything.

             It carried the facility underneath it, and that IS worth reading,
             so the cell is replaced rather than simply dropped: same fact,
             named for what it actually says. */
          kindId === 'procedure'
            ? detailRow('Location', esc(appt.location) || '—')
            : detailRow(
                'Mode',
                virtual ? 'Telehealth' : 'In person',
                {
                  sub: virtual
                    ? `<a class="sch__detail-link" href="#">meet.medinovagastro.example/${esc(
                        appt.id
                      )}</a>`
                    : esc(appt.location),
                }
              )
        }
        ${detailRow('Provider', esc(providerLabel(providerById(appt.providerId)) || '—'))}
        ${detailRow('Indication (Diagnosis)', indicationValue(appt), { wide: true })}
        ${
          /* A cell reading "Notes —" is a cell that has said nothing and
             charged a row of the card for it. Most bookings carry no note, so
             the cell appears when there is something in it. */
          appt.notes ? detailRow('Notes', esc(appt.notes), { wide: true }) : ''
        }
      </div>
    </section>

    ${
      /* Forms and cover are two cards, not one.
         They were briefly put under a single "Before check-in" heading on the
         reasoning that both are the desk asking whether this patient can go
         through. What that produced was Run Eligibility Check sitting at the
         top of a block whose first three lines are forms — an action reading
         as though it belonged to the thing printed directly under it. An
         action has to sit with its own subject, so each has its heading back
         and the button is in the one it acts on. */ ''
    }
    <section class="sch__detail-card">
      <h3 class="sch__detail-title">Forms</h3>
      ${formsValue(forms)}
    </section>

    ${
      /* Money sits between the forms and the cover, which is the order the
         desk works in: what is outstanding to sign, what is outstanding to
         pay, and then what the payer says about the visit itself. */
      paymentPanel(appt, coverage)
    }

    <section class="sch__detail-card">
      <h3 class="sch__detail-title">
        Insurance Eligibility
        <button type="button" class="sch__detail-action" id="dRunEligibility"
          data-testid="sch--d-run-eligibility">Run Eligibility Check</button>
      </h3>
      <div id="dEligibility" aria-live="polite">
        <ui-alert severity="${coverage.eligibility === 'Active' ? 'success' : 'warning'}">
          ${esc(coverage.insurance)} — ${esc(coverage.eligibility)}.
          Last checked ${esc(coverage.lastCheck)}.
        </ui-alert>
      </div>
    </section>`;

  /** The status dot wears whatever colour the clinic gave that status, and the
   *  footer offers whatever step that status has the visit at. */
  const paintStatus = () => {
    const dot = document.getElementById('dStatusDot');
    if (dot) dot.className = `sch__dot sch-s-${slug(appt.status)}`;
    field('dCheckIn')?.setAttribute('text', checkInStep(appt).label);
  };

  const status = field('dStatus');
  status.optionList = STATUS_COLOURS.map((s) => ({ value: s.name, label: s.name }));
  setValue(status, appt.status);
  status.addEventListener('ui-change', (event) => {
    appt.status = event.detail.value;
    paintStatus();
    paint();
  });
  paintStatus();

  wirePaymentPanel(appt);

  field('dRunEligibility').addEventListener('click', () => {
    field('dEligibility').innerHTML = `<ui-alert severity="${
      coverage.eligibility === 'Active' ? 'success' : 'warning'
    }">${esc(coverage.insurance)} — ${esc(coverage.eligibility)}. Checked just now.</ui-alert>`;
  });

  document
    .getElementById('startBody')
    .querySelectorAll('[data-resend]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        button.textContent = 'Sent';
        button.disabled = true;
      })
    );

  modal.setAttribute('heading', 'Appointment Details');
  modal.open(trigger);
}

/*
 * The pager, shared with every other table in the product.
 *
 * A week at MediNova is sixty bookings and a month is two hundred and fifty; the
 * list drew all of them and let the browser find the row. It pages the
 * APPOINTMENTS, not the rendered rows — the date headings are inserted after
 * the slice is taken, so a page always carries the heading for the day it
 * starts in rather than inheriting one off the page before.
 */
let pager = null;

/** Back to page one whenever the set underneath changes shape. */
const resetPage = () => pager?.reset();

/*
 * Paper has no pages to click.
 *
 * The printed schedule has always been the whole period — that is what the
 * desk hands to a provider in the morning — and paging the list on screen
 * must not quietly turn that into fifteen rows. While this is set the list
 * draws every row it has and the pager stands down; beforeprint/afterprint
 * put it back. Both handlers repaint synchronously, which is the one thing
 * that has to be true of anything hung off beforeprint.
 */
let printingEverything = false;

function paintList(rows) {
  const table = document.getElementById('apptTable');
  const empty = document.getElementById('listEmpty');

  empty.hidden = rows.length > 0;
  table.hidden = rows.length === 0;

  /* The pager's range line carries the count now, and the period after it —
     both of which used to be repeated in a strip under the table. Set before
     render(), which is what draws it. */
  const bounds = periodBounds();
  pager.setSuffix(`${shortDate(bounds.from)} to ${shortDate(bounds.to)}`);

  const { start, end } = printingEverything
    ? { start: 0, end: rows.length }
    : pager.render(rows.length);
  const page = rows.slice(start, end);

  table.columns = LIST_COLUMNS;
  table.rows = page;

  /*
   * Start the visit.
   *
   * Every kind opens the details drawer first. It is where the booking is
   * confirmed against the patient in front of you — right provider, right
   * procedure, eligibility still active — and Complete Check In there is what
   * routes onward: a procedure into the check-in flow, a clinic visit straight
   * into the encounter.
   */
  table.querySelectorAll('[data-start]').forEach((el) =>
    el.addEventListener('ui-click', () =>
      openDetails(appointments.find((a) => a.id === el.dataset.start), el)
    )
  );

  table.querySelectorAll('[data-menu]').forEach((el) =>
    el.addEventListener('click', () =>
      rowMenu(appointments.find((a) => a.id === el.dataset.menu), el)
    )
  );
}

/* ===================== Visit notes =====================
   The documentation side of the same bookings: which visits owe a note, who
   is waiting on whom, and which are filed. Rows are derived from the live
   appointment list rather than a second store — see data/visit-notes.js for
   why — so checking a patient out on the Appointment tab puts their note in
   this queue with nothing else having to be told.

   No period. A note owed three weeks ago is still owed, so this list is not
   bounded by the calendar's day/week/month the way the schedule is; it is
   bounded by the filters and by the Unsigned / Signed switch.
   ==================================================== */

/**
 * The worklist, newest visit first.
 *
 * The rail filters it: provider, location, appointment type, care type and
 * the patient search all mean the same thing to a booking and to the note
 * that booking owes, so matchesFilters() is the same one the list view uses.
 * Note type is the one filter that only exists here.
 */
function visitNoteRows() {
  return appointments
    .filter((appt) => hasVisitNote(appt, TODAY) && matchesSearch(appt))
    .map((appt) => {
      const kindId = kindOf(appt);
      const apptType = labelOf(appt);
      const note = noteFor(appt);
      return {
        id: `note-${appt.id}`,
        appt,
        apptType,
        noteType: noteTypeFor(kindId, apptType),
        noteState: note.state,
        updatedOn: note.updatedOn,
        draftedBy: note.draftedBy,
      };
    })
    .sort(
      (a, b) =>
        b.appt.date.localeCompare(a.appt.date) ||
        b.appt.start.localeCompare(a.appt.start)
    );
}

/**
 * Name, then date of birth, age and sex.
 *
 * The three facts under the name are what tell two patients with the same
 * name apart — the only reason to print anything under a name at all. The
 * name links into that patient's own visit-note history rather than to this
 * booking: from a documentation queue, the question is "what else is
 * outstanding for them", not "when are they next in".
 */
function notePatientCell(row) {
  const patient = patientOf(row.appt.mrn);
  const facts = [patient.dob, patient.age != null ? `${patient.age} yrs` : null, patient.sex]
    .filter(Boolean)
    .join(' · ');

  return `<span class="sch__vn-patient">
    <ui-avatar name="${esc(patient.name)}" size="sm"></ui-avatar>
    <span class="sch__vn-patient-text">
      <a class="sch__vn-name" href="patient-chart.html?mrn=${encodeURIComponent(
        row.appt.mrn
      )}#visit-notes">${esc(patient.name)}</a>
      <span class="sch__cell-sub">${esc(facts) || `MRN ${esc(row.appt.mrn)}`}</span>
    </span>
  </span>`;
}

/** Credentials as a clinical table writes them. The column is a seventh of a
 *  table that already has eight, and "Physician Assistant" spelled out costs
 *  more width than it adds meaning. */
const CREDENTIALS = {
  'Nurse Practitioner': 'NP',
  'Physician Assistant': 'PA',
  'Medical Assistant': 'MA',
};

/** The provider — and, on a co-sign row, who wrote what they are being asked
 *  to countersign. A co-sign queue without that name is a list of homework
 *  with no author. */
function noteProviderCell(row) {
  const provider = providerById(row.appt.providerId);
  const drafter = row.draftedBy ? staffById(row.draftedBy) : null;
  if (!drafter) {
    return `${esc(provider?.name ?? '—')}<span class="sch__cell-sub">${esc(
      provider?.role ?? ''
    )}</span>`;
  }

  const by = `Drafted by ${drafter.name}, ${CREDENTIALS[drafter.role] ?? drafter.role}`;
  return `${esc(provider?.name ?? '—')}<span class="sch__vn-by" title="${esc(
    by
  )}">${esc(by)}</span>`;
}

const NOTE_COLUMNS = [
  {
    key: 'apptType',
    label: 'Appointment Type',
    truncate: true,
    render: (row) =>
      `<span class="sch__dot sch-t-${row.appt.typeId || 'none'}"></span>${esc(row.apptType)}`,
  },
  { key: 'patient', label: 'Patient Name', render: notePatientCell },
  {
    key: 'service',
    label: 'Date of Service',
    render: (row) =>
      `<span class="sch__cell-time">${esc(shortDateYear(row.appt.date))}</span>
       <span class="sch__cell-sub">${displayTime(row.appt.start)}</span>`,
  },
  { key: 'noteType', label: 'Note Type', truncate: true },
  {
    key: 'updatedOn',
    label: 'Updated',
    render: (row) => `<span class="sch__cell-time">${esc(shortDateYear(row.updatedOn))}</span>`,
  },
  { key: 'provider', label: 'Provider Name', render: noteProviderCell },
  {
    key: 'noteState',
    label: 'Status',
    render: (row) => {
      const spec = NOTE_STATES[row.noteState];
      return `<ui-badge status="${spec.tone}">${spec.label}</ui-badge>`;
    },
  },
  {
    key: 'actions',
    label: 'Actions',
    actions: true,
    render: (row) => {
      const spec = NOTE_STATES[row.noteState];
      return `<ui-button variant="outline" size="xs" icon="${spec.icon}"
        data-note="${row.appt.id}">${spec.action}</ui-button>`;
    },
  },
];

/** One of the two note tables. Both are painted on every repaint: they hold a
 *  clinic's worth of rows, not a hospital's, and a stale count behind the tab
 *  you are not looking at is worse than the work of filling it. */
function paintNoteTable(tableId, emptyId, rows) {
  const table = document.getElementById(tableId);
  const empty = document.getElementById(emptyId);

  empty.hidden = rows.length > 0;
  table.hidden = rows.length === 0;

  table.columns = NOTE_COLUMNS;
  table.rows = rows;

  /*
   * Where a row goes depends on what it is for.
   *
   * A note still being written opens the working surface — encounter.html,
   * where the charting is. A note that is written and only wants a name, or
   * one already filed, opens the summary: the whole note on one page, read
   * rather than edited, with Sign & Lock or Download beside it. Sending a
   * co-signer into the editing screen would be asking them to review a
   * document by scrolling through its input fields.
   */
  table.querySelectorAll('[data-note]').forEach((el) =>
    el.addEventListener('ui-click', () => {
      const id = el.dataset.note;
      const row = rows.find((r) => r.appt.id === id);
      const readOnly = row && row.noteState !== 'unsigned';
      const screen = readOnly ? 'encounter-summary.html' : 'encounter.html';
      window.location.href = `${screen}?appt=${encodeURIComponent(id)}`;
    })
  );
}

/** Paints both halves of the worklist and returns how many notes are in it. */
function paintVisitNotes() {
  const rows = visitNoteRows();
  const unsigned = rows.filter((row) => !NOTE_STATES[row.noteState].signed);
  const signed = rows.filter((row) => NOTE_STATES[row.noteState].signed);

  paintNoteTable('vnUnsignedTable', 'vnUnsignedEmpty', unsigned);
  paintNoteTable('vnSignedTable', 'vnSignedEmpty', signed);

  // The two sizes are said once, under the strip, rather than twice as chips on
  // it — and said in words, where "12 awaiting signature" is a sentence and
  // "12" beside a tab is a puzzle.
  document.querySelector('[data-testid="sch--vn-range"]').textContent = rows.length
    ? `${unsigned.length} awaiting signature · ${signed.length} signed`
    : 'No encounters yet';

  return rows.length;
}

/* ===================== Calendar view ===================== */

/**
 * Lanes for overlapping appointments: each cluster of blocks that touch gets
 * split into as many columns as it needs, so a double-booked slot shows both
 * appointments side by side instead of one hiding the other.
 */
/*
 * How many of a clash the grid will draw, decided by how wide a column is.
 *
 * This is the whole argument about a busy calendar in one number. A seventh of
 * a week is about 180px — one card, at the size the rest of the product sets
 * type. Put two in there and neither is a card any more: they are coloured
 * strips with the first letter of a name on them, which is the worst of both
 * outcomes, showing that something is there without showing what.
 *
 * So the budget follows the width. One or two columns — a day filtered to a
 * provider or two — can hold three side by side. Three or four can hold two.
 * Seven days, or six providers' columns at once, hold one, and anything that
 * collides with it becomes a "+N" that opens the day as a list, where six
 * bookings at ten o'clock are six rows and nothing overlaps anything at all.
 */
const laneBudget = (columnCount) =>
  columnCount <= 2 ? 3 : columnCount <= 4 ? 2 : 1;

function laneLayout(appts, maxLanes) {
  const items = appts
    .map((appt) => ({ appt, ...spanOf(appt) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed = [];
  /** One entry per over-full cluster: where it starts, and how many it hides. */
  const overflow = [];
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }
      item.lane = lane;
    }

    const shown = cluster.filter((item) => item.lane < maxLanes);
    const hidden = cluster.length - shown.length;
    for (const item of shown) {
      // The step between lanes is worked out from what is DRAWN, not from what
      // the cluster holds, or a hidden fourth would still narrow the three.
      item.lanes = Math.min(laneEnds.length, maxLanes);
      placed.push(item);
    }
    if (hidden) {
      overflow.push({
        count: hidden,
        start: Math.min(...cluster.map((item) => item.start)),
      });
      /* The chip sits at the top-right of the run, which is exactly where the
         front card's own top line ends. Marking that card is what stops the
         two from being drawn on top of each other. */
      const front = shown.find((item) => item.lane === 0);
      if (front) front.crowded = true;
    }
    cluster = [];
  };

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return { placed, overflow };
}

/** Clamp a time window to the visible grid; null when it falls outside it. */
function clampToGrid(startMinute, endMinute) {
  const top = Math.max(startMinute, DAY_START);
  const bottom = Math.min(endMinute, DAY_END);
  if (bottom <= top) return null;
  return { top: top - DAY_START, length: bottom - top };
}

/**
 * The hours the column is NOT bookable in.
 *
 * This used to be drawn the other way up: the open hours got a white band with
 * a green edge and a location caption, and everything else was left plain. It
 * put a mark on the normal case — six providers' worth of green edges down a
 * week grid — to say nothing had gone wrong. Hatching the closed hours instead
 * leaves the bookable day as plain paper, which is what a schedule is, and
 * spends ink only where a booking cannot go.
 *
 * The gaps are the complement of the configured blocks: before the first,
 * between any two, and after the last. A column with no configured hours at
 * all is hatched whole by .sch__col--closed and needs none of this.
 */
function closedMarkup(column, geometry) {
  const open = column.availability.blocks
    .map((block) => ({ start: toMinutes(block.start), end: toMinutes(block.end) }))
    .sort((a, b) => a.start - b.start);
  if (!open.length) return '';

  const gaps = [];
  let cursor = DAY_START;
  for (const block of open) {
    if (block.start > cursor) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < DAY_END) gaps.push({ start: cursor, end: DAY_END });

  return gaps
    .map((gap, index) => {
      const box = clampToGrid(gap.start, gap.end);
      if (!box) return '';
      const id = `cl-${column.key}-${index}`;
      geometry.push(`[data-band="${id}"]{--sch-top:${box.top};--sch-len:${box.length};}`);
      return `<div class="sch__band sch__band--closed" data-band="${id}"></div>`;
    })
    .join('');
}

function bandsMarkup(column, geometry) {
  if (!column.availability) return '';

  const parts = [closedMarkup(column, geometry)];

  /* A block day is not the same as an unworked hour: someone took hours that
     exist away, and the desk needs to see the difference between "never open"
     and "closed today, and here is why". It keeps its own red band and its
     title. */
  column.availability.blocked.forEach((block, index) => {
    const box = clampToGrid(toMinutes(block.start), toMinutes(block.end));
    if (!box) return;
    const id = `bl-${column.key}-${index}`;
    geometry.push(`[data-band="${id}"]{--sch-top:${box.top};--sch-len:${box.length};}`);
    parts.push(`<div class="sch__band sch__band--blocked" data-band="${id}">
      <span class="sch__band-label">${esc(block.title)}</span>
    </div>`);
  });

  return parts.join('');
}

/**
 * Is this booking a video visit?
 *
 * The practice names its own appointment types, and the ones it means to be
 * held over video say so in the title — there is no separate flag on the
 * booking to read. So the glyph follows the name: a screen for a virtual
 * visit, a pin for one the patient has to travel to.
 */
/* The calendar's little globe-or-pin, from the booking's own Mode where it has
   one and from the activity's name where it does not — the same fallback the
   details drawer uses, so the icon and the drawer can never disagree. */
const isVirtual = (appt) =>
  appt.mode ? appt.mode === 'Telehealth' : /virtual|tele/i.test(labelOf(appt));

const modeIcon = (appt) =>
  `<svg class="ui-icon sch__event-mode" aria-hidden="true"><use href="#i-${
    isVirtual(appt) ? 'globe' : 'map-pin'
  }"></use></svg>`;

/** A note is owed or written for this visit — the paper the booking made. */
const noteIcon = (appt) =>
  hasVisitNote(appt, TODAY)
    ? `<svg class="ui-icon sch__event-doc" aria-hidden="true"><use href="#i-document"></use></svg>`
    : '';

function eventsMarkup(column, geometry, maxLanes) {
  const { placed, overflow } = laneLayout(column.appts, maxLanes);

  /* The date this column stands for: a week column IS a date, a provider
     column takes the one the whole grid is anchored to. It is what "+N more"
     opens. */
  const iso = column.kind === 'day' ? column.key : state.anchor;

  const more = overflow
    .map((run, index) => {
      const box = clampToGrid(run.start, run.start + 30);
      if (!box) return '';
      const id = `mo-${column.key}-${index}`;
      geometry.push(`[data-more="${id}"]{--sch-top:${box.top};}`);
      const plural = run.count === 1 ? '' : 's';
      return `<button type="button" class="sch__more" data-more="${id}"
        data-more-date="${iso}"
        aria-label="${run.count} more appointment${plural} at this time. Opens ${esc(
          longDate(iso)
        )} as a list."
        title="${run.count} more at this time — open the day as a list"
      >+${run.count}</button>`;
    })
    .join('');

  return more + placed
    .map((item) => {
      const box = clampToGrid(item.start, item.end);
      if (!box) return '';
      const { appt } = item;
      const patient = patientOf(appt.mrn);
      const provider = providerById(appt.providerId);

      geometry.push(
        `[data-appt="${appt.id}"]{--sch-top:${box.top};--sch-len:${box.length};` +
          `--sch-lane:${item.lane};--sch-lanes:${item.lanes};}`
      );

      // How much the block can say depends on how tall it is. See the
      // --xs / --sm rules in screen-scheduler.css.
      const length = item.end - item.start;
      const tiny = length < 30;
      const density = tiny ? ' sch__event--xs' : length < 45 ? ' sch__event--sm' : '';

      /* A card under half an hour is one line, and on that line the name is
         what is being looked for. So it gets the start time only: "8:30 AM"
         rather than "8:30 – 8:50 AM (20 min)", which is forty pixels of
         punctuation bought with the patient's surname. */
      /* And on a one-line card that is ALSO carrying a count, the meridiem
         goes too: the hour gutter down the left says AM or PM for the whole
         row, and those three characters are the difference between "Tomas
         Herrera" and "Tomas H…". */
      const when = tiny
        ? item.crowded
          ? clockLabel(item.start).replace(/ [AP]M$/, '')
          : clockLabel(item.start)
        : `${spanLabel(item.start, item.end)}
           <span class="sch__event-mins">(${length} min)</span>`;

      /* Three lines, and everything else in the tooltip. A block is a name,
         when, and where it has got to; the type and the provider are a column
         heading away in the day grid and one click away in either, and putting
         them on the card is what made it four lines of small print instead of
         something readable at arm's length. */
      const label = labelOf(appt);
      const where = column.kind === 'provider' ? appt.location : provider?.name ?? '';

      return `<button type="button" data-appt="${appt.id}" data-details="${appt.id}"
        class="sch__event sch-t-${appt.typeId}${density}${
        item.crowded ? ' sch__event--crowded' : ''
      }${appt.status === 'Cancelled' ? ' sch__event--cancelled' : ''}" title="${esc(patient.name)} — ${esc(label)} · ${esc(where)} — ${esc(
        appt.reason
      )} (${esc(appt.status)})">
        <span class="sch__event-head">
          ${modeIcon(appt)}
          <span class="sch__event-name">${esc(patient.name)}</span>
          ${noteIcon(appt)}
        </span>
        <span class="sch__event-time">${when}</span>
        <span class="sch__event-status sch-s-${slug(appt.status)}">${esc(appt.status)}</span>
      </button>`;
    })
    .join('');
}

function gridMarkup(columns, geometry) {
  const hours = [];
  for (let minute = DAY_START; minute <= DAY_END; minute += 60) {
    hours.push(`<span class="sch__hour" data-hour="${minute}">${hourLabel(minute)}</span>`);
  }

  // A day column carries a weekday and a date; a provider column a name and a
  // role. The first pair reads as one line — "Mon 13" is how a week is spoken
  // — and the second stacks, because a name and a specialty are two facts.
  const heads = columns
    .map((column) => {
      const day = column.kind === 'day';
      return `<div class="sch__col-head${day ? ' sch__col-head--day' : ''}${
        column.today ? ' sch__col-head--today' : ''
      }"${column.full ? ` title="${esc(column.full)}"` : ''}>
        <span class="sch__col-head-name">${esc(column.title)}</span>
        <span class="sch__col-head-sub">${esc(column.sub)}</span>
      </div>`;
    })
    .join('');

  const maxLanes = laneBudget(columns.length);

  const bodies = columns
    .map((column) => {
      const closed = column.availability && column.availability.blocks.length === 0;
      return `<div class="sch__col${closed ? ' sch__col--closed' : ''}">
        ${bandsMarkup(column, geometry)}
        ${eventsMarkup(column, geometry, maxLanes)}
      </div>`;
    })
    .join('');

  /* --- Now ---------------------------------------------------------------
     The line the day is read against. Without it a grid of blocks says what
     is booked but not what is next, and "what is next" is the question the
     desk is actually asking. Drawn only when today is on screen and the
     clock is inside the hours the grid covers — a line pinned to an edge
     would be a lie about a time that is not there. */
  const minute = nowMinutes();
  const todayShowing =
    columns.some((column) => column.key === TODAY) || (columns[0]?.kind === 'provider' && state.anchor === TODAY);
  const showNow = todayShowing && minute >= DAY_START && minute <= DAY_END;
  if (showNow) geometry.push(`[data-now]{--sch-top:${minute - DAY_START};}`);

  const nowLine = showNow
    ? `<div class="sch__now" data-now aria-hidden="true"></div>`
    : '';
  const nowLabel = showNow
    ? `<span class="sch__now-label" data-now>${clockLabel(minute)}</span>`
    : '';

  return `<div class="sch__cal">
    <div class="sch__cal-head">
      <div class="sch__cal-head-gutter"></div>
      <div class="sch__cols">${heads}</div>
    </div>
    <div class="sch__cal-scroll">
      <div class="sch__cal-grid">
        <div class="sch__gutter">${hours.join('')}${nowLabel}</div>
        <div class="sch__cols">${bodies}${nowLine}</div>
      </div>
    </div>
  </div>`;
}

/** Day grid — one column per provider, each shaded with its own availability. */
function dayColumns(rows) {
  const providers = pickedProviders();

  return providers.map((provider) => ({
    kind: 'provider',
    key: provider.id,
    title: provider.name,
    sub: provider.role,
    today: state.anchor === TODAY,
    availability: availabilityOn(provider.id, state.anchor),
    appts: rows.filter((a) => a.providerId === provider.id),
  }));
}

/**
 * Week grid — one column per day.
 *
 * Availability is only drawn when a single provider is selected: seven days ×
 * six providers of overlapping bands would be noise, not information.
 */
function weekColumns(rows) {
  const from = startOfWeek(state.anchor);
  return DAY_NAMES.map((name, index) => {
    const iso = addDays(from, index);
    return {
      kind: 'day',
      key: iso,
      title: name.slice(0, 3),
      sub: String(parseISO(iso).getDate()),
      full: longDate(iso),
      today: iso === TODAY,
      availability: soleProvider() ? availabilityOn(soleProvider(), iso) : null,
      appts: rows.filter((a) => a.date === iso),
    };
  });
}

const MAX_CHIPS = 3;

function monthMarkup() {
  const first = startOfMonth(state.anchor);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(gridStart, 41);
  const rows = filtered(gridStart, gridEnd);
  const month = state.anchor.slice(0, 7);

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const iso = addDays(gridStart, index);
    const dayAppts = rows.filter((a) => a.date === iso);
    const sole = soleProvider();
    const availability = sole ? availabilityOn(sole, iso) : null;
    const closed = availability && availability.blocks.length === 0;

    const chips = dayAppts
      .slice(0, MAX_CHIPS)
      .map(
        (appt) => `<span class="sch__chip sch-t-${appt.typeId}${
          appt.status === 'Cancelled' ? ' sch__chip--cancelled' : ''
        }">
          ${modeIcon(appt)}
          <b>${toTime(toMinutes(appt.start))}</b>
          <span class="sch__chip-name">${esc(patientOf(appt.mrn).name)}</span>
          ${noteIcon(appt)}
        </span>`
      )
      .join('');
    const overflow = dayAppts.length - MAX_CHIPS;

    /* A block day names itself, because it is a thing that HAPPENED to a
       working day. The old "08:00–17:00" pill beside it did not: hatching
       already says which days are not worked, and a cell that spends its top
       line repeating the same hours thirty times is a cell with less room
       for the bookings it exists to show. */
    const tag = availability?.blocked.length
      ? `<span class="sch__day-tag sch__day-tag--blocked">${esc(
          availability.blocked[0].title
        )}</span>`
      : '';

    const classes = [
      'sch__day',
      iso.slice(0, 7) !== month && 'sch__day--outside',
      iso === TODAY && 'sch__day--today',
      closed && 'sch__day--closed',
    ].filter(Boolean).join(' ');

    cells.push(`<button type="button" class="${classes}" data-date="${iso}"
      aria-label="${esc(longDate(iso))}, ${dayAppts.length} appointments">
      <span class="sch__day-top">
        <span class="sch__day-num">${parseISO(iso).getDate()}</span>
        ${tag}
      </span>
      <span class="sch__chips">${chips}${
      overflow > 0 ? `<span class="sch__chip-more">${overflow} more…</span>` : ''
    }</span>
    </button>`);
  }

  return `<div class="sch__cal">
    <div class="sch__month">
      <div class="sch__month-head">${DAY_NAMES.map(
        (d) => `<span>${d.slice(0, 3)}</span>`
      ).join('')}</div>
      <div class="sch__month-grid">${cells.join('')}</div>
    </div>
  </div>`;
}

function paintCalendar(rows) {
  const host = document.getElementById('calBody');
  const geometry = [];

  if (state.range === 'month') {
    host.innerHTML = monthMarkup();
  } else {
    const columns = state.range === 'day' ? dayColumns(rows) : weekColumns(rows);
    host.innerHTML = gridMarkup(columns, geometry);
  }
  writeGeometry(geometry);

  /*
   * The banner that used to sit here is gone.
   *
   * It said "pick a single provider to see their availability" above every
   * multi-provider week and month — a paragraph of blue, permanently, to
   * explain the absence of shading most people had not noticed and none of
   * them could act on without leaving what they were doing. The shading
   * appears when a provider is picked, which is the fact it was describing.
   */

  /* "+N more" hands the clash to the one view that can hold it: that day, as
     a list, where six bookings at ten o'clock are six rows. */
  host.querySelectorAll('[data-more-date]').forEach((el) =>
    el.addEventListener('click', () => {
      state.anchor = el.dataset.moreDate;
      state.range = 'day';
      state.view = 'list';
      setField('fDate', state.anchor);
      resetPage();
      paint();
    })
  );

  /*
   * A block on the calendar is READ far more often than it is rewritten.
   *
   * Clicking one used to drop the desk straight into the booking form — every
   * field editable, Save sitting under them — when the question being asked
   * was almost always "who is this, what for, and are they confirmed?". That
   * is a question a form answers badly: the facts are spread across eight
   * controls, the ones that matter (balance owing, forms still out, whether
   * the cover is live) are not on it at all, and a stray keystroke in a
   * control you only opened to read is a booking quietly changed.
   *
   * So the card opens the same Appointment Details drawer the list's Start
   * button does — the booking printed, not offered for editing — and Edit in
   * its footer is one click away for the times the answer is "and move them
   * to Thursday".
   */
  host.querySelectorAll('[data-details]').forEach((el) =>
    el.addEventListener('click', () =>
      openDetails(appointments.find((a) => a.id === el.dataset.details), el)
    )
  );

  /*
   * Picking a day asks what for.
   *
   * A free slot is the only moment a wait list is worth anything, and that
   * moment happens here — on the schedule, looking at a gap. Asking here is
   * what stops the list being something the desk has to remember exists on
   * another tab. "Just open this day" keeps the old drill-in, which the desk
   * already has in its fingers.
   */
  host.querySelectorAll('[data-date]').forEach((el) =>
    el.addEventListener('click', () => openBookChoice(el.dataset.date))
  );
}

/* ===================== Paint ===================== */

/* The month the rail is showing, last time we looked. */
let pickerAnchor = null;

/**
 * Keep the rail's month on the anchor the rest of the screen is using.
 *
 * The picker holds its own idea of which month is on VIEW — that is what lets
 * someone look three months ahead for a slot without moving the schedule. So
 * it is only pulled back when the anchor itself moves: a week stepped in the
 * toolbar, a day opened out of the month grid, a booking saved onto another
 * date. Browsing the picker alone leaves both alone.
 */
function syncPicker() {
  if (pickerAnchor === state.anchor) return;
  pickerAnchor = state.anchor;
  const picker = field('fDate');
  if (!picker) return;
  // Drop the browsed month so the grid follows the date it is now showing,
  // and paint by hand: the attribute may already hold this date — the picker
  // itself just set it — and an unchanged attribute renders nothing.
  picker._view = null;
  setValue(picker, state.anchor);
  if (picker._upgraded) picker.render();
}

function paint() {
  // Every mutation repaints, so this is the one place the store needs writing.
  saveAppointments(appointments);

  applyTab();

  const count =
    state.tab === 'visit-notes'
      ? paintVisitNotes()
      : state.tab === 'waitlist'
        ? paintWaitlist()
        : paintAppointments();

  // "12 waiting" rather than "12 waitings" — the count on this tab is people,
  // and the noun the others pluralise does not exist for it.
  document.querySelector('[data-testid="sch--count"]').textContent =
    state.tab === 'waitlist'
      ? `${count} waiting`
      : state.tab === 'visit-notes'
        ? `${count} encounter${count === 1 ? '' : 's'}`
        : `${count} appointment${count === 1 ? '' : 's'}`;

  syncPicker();
  paintRailCount();
  paintPrintHead(count);
}

/** The bookings themselves — the period, the view switch and whichever of the
 *  list and the calendar is showing. Returns how many are in the period. */
function paintAppointments() {
  const bounds = periodBounds();
  const rows = filtered(bounds.from, bounds.to);

  document.querySelector('[data-testid="sch--range"]').textContent = periodTitle();

  const listView = document.getElementById('listView');
  const calendarView = document.getElementById('calendarView');
  listView.hidden = state.view !== 'list';
  calendarView.hidden = state.view !== 'calendar';

  document.querySelectorAll('[data-view]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.view === state.view))
  );
  document.querySelectorAll('[data-range]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.range === state.range))
  );

  if (state.view === 'list') paintList(rows);
  else paintCalendar(rows);

  return rows.length;
}

/* ===================== WAIT LIST =====================
   Standing requests. Nothing here is booked, so the table is about the
   REQUEST — what they want, and the window they can take it in — rather than
   about a time, which is the one thing a wait-list row does not have.
   ================================================== */

const WL_COLUMNS = [
  {
    key: 'patient',
    label: 'Patient/MRN',
    render: (row) => {
      const p = patientOf(row.mrn);
      const dob = p.dob ? ` (${esc(p.dob)})` : '';
      return `<span class="sch__wl-name">${esc(p.name)}${dob}</span>
        <span class="sch__cell-sub">MRN ${esc(row.mrn)}${
        p.phone ? ` · ${esc(p.phone)}` : ''
      }</span>`;
    },
  },
  {
    /* Activity only. Coverage used to print underneath, and on a single-site
       gastroenterology wait list it read as "Self pay — no coverage on file"
       eleven rows running: a line the eye learns to skip in three rows and
       then keeps skipping on the row where it finally differs. Coverage is a
       thing the desk checks when the request becomes a booking, and the
       booking form is where it is checked. */
    key: 'activity',
    label: 'Activity',
    render: (row) => `<span class="sch__wl-activity">${esc(
      typeById(row.activity)?.title ?? '—'
    )}</span>`,
  },
  {
    /* Provider alone. Place was stacked underneath after "Resources" and
       "Location" were folded into one column, but the practice has one clinic,
       so the second line was the same eleven words on every row — the exact
       repetition that folding the columns was meant to end. If the practice
       ever runs a second site, put it back. */
    key: 'provider',
    label: 'Provider',
    render: (row) => `<span>${esc(providerById(row.providerId)?.name ?? '—')}</span>`,
  },
  {
    /* ONE COLUMN FOR THE WHOLE WINDOW.
       From, To and Start/End were three columns holding one answer — "any time
       between 30 Jul and 27 Aug, mornings only" — split across three headings
       that each said a third of it. Read as one line it is the sentence the
       desk says down the phone; read as three cells it was arithmetic. The
       time preference only prints when there is one, because most requests
       have none — and a row that prints nothing under the dates is saying
       exactly that, more quietly and more truthfully than a line of type
       repeating "Any time of day" down the whole column. Printing it only when
       the patient actually gave one is what makes it worth reading when it
       does appear. */
    key: 'window',
    label: 'Available',
    render: (row) => {
      const time =
        row.start || row.end
          ? `<span class="sch__cell-sub">${esc(row.start || 'any')} – ${esc(
              row.end || 'any'
            )}</span>`
          : '';
      return `<span>${esc(wlShortDate(row.from))} – ${esc(wlShortDate(row.to))}</span>
        ${time}`;
    },
  },
  {
    /* The slot the desk found while the patient was still on the phone, if it
       found one. Empty is the normal case and says so plainly rather than with
       a dash: a request with no slot picked is the queue behaving as it always
       has, not a missing value. */
    key: 'slot',
    label: 'Selected slot',
    render: (row) =>
      row.slotDate && row.slotStart
        ? `<span class="sch__wl-slot">${esc(wlShortDate(row.slotDate))}</span>
           <span class="sch__cell-sub">${esc(displayTime(row.slotStart))}</span>`
        : `<span class="sch__cell-sub">Not picked yet</span>`,
  },
  {
    key: 'priority',
    label: 'Priority',
    render: (row) => {
      const spec = WAITLIST_PRIORITIES[row.priority] ?? WAITLIST_PRIORITIES.routine;
      return `<ui-badge status="${spec.tone}">${esc(spec.label)}</ui-badge>`;
    },
  },
  {
    /* How long they have been on it — the figure the queue is ordered by, and
       until now the one thing the table ordered by and never showed. */
    key: 'waiting',
    label: 'Waiting',
    render: (row) => `<span>${esc(wlWaitLength(row.addedOn))}</span>
      <span class="sch__cell-sub">since ${esc(wlShortDate(row.addedOn))}</span>`,
  },
  {
    key: 'actions',
    label: 'Actions',
    actions: true,
    // Edit before Remove, and both spelled out: a wait list entry is edited
    // far more often than it is deleted — windows slip, priorities are
    // raised, a patient calls back to say mornings only after all.
    render: (row) => `<span class="sch__wl-actions">
      <ui-button variant="outline" size="xs" icon="pencil"
        data-wl-edit="${esc(row.id)}"
        data-testid="sch--wl-edit-${esc(row.id)}">Edit</ui-button>
      <ui-button variant="outline" size="xs" icon="trash"
        data-wl-remove="${esc(row.id)}"
        data-testid="sch--wl-remove-${esc(row.id)}">Remove</ui-button>
    </span>`,
  },
];

/** Urgent first, then whoever has waited longest — which is the order the
 *  caption under the table has always claimed and the table never actually
 *  applied. Sorted here rather than in the store because it is a reading
 *  order, and the store is also read by the "who could take this slot?"
 *  picker, which ranks on something else again. */
const WL_RANK = { urgent: 0, soon: 1, routine: 2 };
const byPriorityThenWait = (a, b) =>
  (WL_RANK[a.priority] ?? 2) - (WL_RANK[b.priority] ?? 2) ||
  String(a.addedOn).localeCompare(String(b.addedOn));

function paintWaitlist() {
  const rows = allWaitlist()
    .filter((row) => matchesSearch({ mrn: row.mrn, reason: '' }))
    .sort(byPriorityThenWait);
  const table = field('wlTable');
  if (!table) return 0;

  field('wlEmpty').hidden = rows.length > 0;
  table.hidden = rows.length === 0;
  table.columns = WL_COLUMNS;
  table.rows = rows;

  table.querySelectorAll('[data-wl-edit]').forEach((el) =>
    el.addEventListener('ui-click', () => openWaitlistForm(el.dataset.wlEdit, el))
  );

  table.querySelectorAll('[data-wl-remove]').forEach((el) =>
    el.addEventListener('ui-click', () => {
      const entry = waitlistById(el.dataset.wlRemove);
      removeFromWaitlist(el.dataset.wlRemove);
      notify(`${patientOf(entry.mrn).name} removed from the wait list.`, 'info');
      paint();
    })
  );

  document.querySelector('[data-testid="sch--wl-range"]').textContent = rows.length
    ? `${rows.length} waiting · longest wait first`
    : 'Nobody is waiting';

  return rows.length;
}

/* --- Add to / edit the wait list -------------------------------------------
   ONE dialog for both. Adding a request and correcting one ask the same
   questions about the same request, and a second near-identical form is how
   the two drift until only one of them validates the date window.

   `wlEditingId` is the whole difference: null means add, an id means update
   that entry in place — keeping its position in a queue ordered by how long
   each patient has waited.

   One question is asked only once, though: WHO. The patient is not a property
   of a standing request that can be corrected, it is the request — repointing
   an entry at somebody else would hand them a place in the queue that was
   earned by the wait of the person whose name was there before, and would do
   it without a word. So the picker is in the form while the entry is being
   created and gone afterwards, replaced by a locked identity strip that says
   the remedy out loud: remove this one, add the right one.
   -------------------------------------------------------------------------- */

let wlEditingId = null;

/**
 * @param {string|null} id       an entry to edit, or null to add a new one
 * @param {Element} [trigger]    what focus returns to on close
 */
function openWaitlistForm(id = null, trigger) {
  const entry = id ? waitlistById(id) : null;
  wlEditingId = entry ? entry.id : null;

  field('wlPatient').optionList = DIRECTORY.filter((p) => p.active).map((p) => ({
    value: p.mrn,
    label: `${p.name} · MRN ${p.mrn}`,
  }));
  field('wlPriority').optionList = Object.entries(WAITLIST_PRIORITIES).map(([value, s]) => ({
    value,
    label: s.label,
  }));
  /* Clinic activities only — no procedures on the wait list.
     A standing request is a queue for clinic time, and a scope list is not
     queued: it is deferred and brought forward on its own list, by Status,
     with prep, anaesthesia and a suite behind the date. The booking form
     already says this by giving the procedure field set no "Add to wait list"
     checkbox; offering an endoscopy in this dropdown would let the same
     request in through the back door and put a patient on a queue nothing
     ever reads. Infusion and pre-procedure work stay on offer — the clinic
     runs them, and they do queue for a chair. */
  field('wlActivity').optionList = waitlistableAppointmentTypes().map((t) => ({
    value: t.id,
    label: `${t.title} · ${t.duration} ${t.unit.toLowerCase()}`,
  }));
  field('wlProvider').optionList = PROVIDERS.map((p) => ({
    value: p.id,
    label: providerLabel(p),
  }));
  field('wlLocation').optionList = LOCATIONS.map((l) => ({ value: l, label: l }));

  /* Who this request belongs to is settled the moment it exists.
     A wait list is a queue of standing asks, and the patient is the ask —
     pointing an existing entry at somebody else would move that person's
     place in a queue ordered by how long each of them has waited, and would
     do it silently. So the picker is taken out of the form rather than left
     there greyed out, and the select is made readonly behind it in case
     anything else reaches for it. Getting the wrong person onto the list is
     fixed by removing the entry and adding the right one, which is the honest
     description of what that change actually is. */
  field('wlPatientRow').hidden = Boolean(entry);
  field('wlPatient').toggleAttribute('readonly', Boolean(entry));

  ['wlPatient', 'wlActivity', 'wlProvider', 'wlLocation', 'wlFrom', 'wlTo', 'wlEnd'].forEach(
    (fieldId) => field(fieldId)?.removeAttribute('error')
  );
  setField('wlPatient', entry ? entry.mrn : '');
  setField('wlPriority', entry ? entry.priority : 'routine');
  setField('wlActivity', entry ? entry.activity : '');
  setField('wlProvider', entry ? entry.providerId : (soleProvider() ?? ''));
  setField('wlLocation', entry ? entry.location : state.location || LOCATIONS[0]);
  setField('wlFrom', entry ? entry.from : TODAY);
  setField('wlTo', entry ? entry.to : addDays(TODAY, 30));
  setField('wlStart', entry ? entry.start : '');
  setField('wlEnd', entry ? entry.end : '');
  setField('wlNote', entry ? entry.note : '');

  /* The slot the request already holds, if it has one. Set before the panel
     is drawn, so an entry opened for editing shows its own slot picked rather
     than a fresh list the desk has to find it in again. */
  wlSlot =
    entry?.slotDate && entry?.slotStart
      ? { date: entry.slotDate, start: entry.slotStart }
      : null;
  renderWaitlistSlots();
  paintWaitlistRecap();
  paintWaitlistFacts(entry ? entry.mrn : '', entry);

  const modal = document.getElementById('wlModal');
  modal.setAttribute('heading', entry ? 'Edit Wait List Entry' : 'Add To Wait List');

  // Two buttons rather than one whose words change: <ui-button> captures its
  // label from its own text once, and swapping that at runtime means reaching
  // past the component. Showing the right one costs a line and no trickery.
  field('wlSave').hidden = Boolean(entry);
  field('wlUpdate').hidden = !entry;

  modal.open(trigger);
}

/* --- Select Slot ------------------------------------------------------------
   The window says when the patient COULD come. This says which of those times
   is actually free, and lets the desk take one there and then.

   Seven weekday checkboxes used to stand here. They were asked of every
   request, answered on almost none, and what they narrowed was a queue that
   nothing reads by weekday. The constraint that matters is the window, and now
   that a real slot can be picked out of it, "which weekdays suit" is answered
   by which slot the desk chooses.

   A slot carries its DATE as well as its time. A wait-list slot is two weeks
   out as often as not, and "10:15" on its own is not an offer anybody can make
   down a phone.

   Optional, and deliberately so. A request with no slot picked is the queue
   working the way it always has: the desk rings round when something frees up.
   One WITH a slot is the desk having found the answer while the patient was
   still on the line.
   -------------------------------------------------------------------------- */

/** How far into the window the search actually walks. A patient available for
 *  six months is not asking to be shown six months of quarter-hours — the
 *  offer that gets made is one of the first few that fit. */
const WL_SCAN_DAYS = 60;
const WL_SHOW_DAYS = 6;

/** The slot the open request has taken, as `{ date, start }`, or null. Held
 *  here rather than read back off the buttons so it survives the repaint that
 *  draws them. */
let wlSlot = null;

/**
 * Every open start inside the window, day by day, at the activity's own
 * length, honouring the time-of-day preference if one was given.
 *
 * The provider's real availability, through the same openSlots() the booking
 * form offers times from — so a slot taken from this list is a slot the
 * booking form would have offered, rather than a second opinion about when the
 * clinic is open.
 */
function waitlistSlotDays() {
  const providerId = field('wlProvider').value;
  const typeId = field('wlActivity').value;
  const from = field('wlFrom').value;
  const to = field('wlTo').value;
  if (!providerId || !typeId || !from || !to || to < from) return null;

  const duration = durationOf(typeId, providerId);
  const earliest = field('wlStart').value ? toMinutes(field('wlStart').value) : null;
  const latest = field('wlEnd').value ? toMinutes(field('wlEnd').value) : null;

  const days = [];
  let iso = from;
  let scanned = 0;
  while (iso <= to && scanned < WL_SCAN_DAYS && days.length < WL_SHOW_DAYS) {
    const starts = openSlots(providerId, iso, duration)
      .flatMap((group) => group.slots)
      .filter(
        (start) =>
          (earliest === null || start >= earliest) &&
          (latest === null || start + duration <= latest)
      );
    if (starts.length) days.push({ iso, starts });
    iso = addDays(iso, 1);
    scanned += 1;
  }
  return { days, duration, truncated: iso <= to };
}

function renderWaitlistSlots() {
  const host = field('wlSlots');
  if (!host) return;

  const found = waitlistSlotDays();

  /* NOTHING TO SAY YET, SO ONE LINE SAYING WHICH FIELD IS MISSING. The search
     needs an activity (for the length), a provider (for the hours) and a
     window — all three of which are being filled in a few rows above, so the
     line names what is still outstanding rather than repeating the whole
     instruction. */
  if (!found) {
    host.innerHTML = `<p class="wl__slots-hint">
      Choose an activity, a provider and a date window and the open slots
      inside it appear here.</p>`;
    return;
  }

  const { days, duration, truncated } = found;
  if (!days.length) {
    wlSlot = null;
    host.innerHTML = `<p class="wl__slots-hint">
      No ${duration}-minute slot is open in that window — which is usually why
      somebody is going on the wait list. Save the request without one and the
      desk will offer the first cancellation.</p>`;
    return;
  }

  const chosen = wlSlot
    ? `<span class="wl__slots-chosen">${esc(shortDateYear(wlSlot.date))} ·
        ${esc(displayTime(wlSlot.start))}</span>`
    : '';

  host.innerHTML = `
    <div class="wl__slots-head">
      ${chosen}
      <span class="wl__slots-count">${days.reduce(
        (sum, day) => sum + day.starts.length,
        0
      )} free${truncated ? '+' : ''} · ${duration} min</span>
      ${
        wlSlot
          ? `<button type="button" class="wl__slots-clear" data-wl-slot-clear
              data-testid="sch--wl-slot-clear">Clear</button>`
          : ''
      }
    </div>
    ${days
      .map(
        (day) => `<div class="wl__slot-group">
          <span class="wl__slot-group-label">${esc(longDate(day.iso))}</span>
          <div class="wl__slot-row">
            ${day.starts
              .map((start) => {
                const time = toTime(start);
                const selected = wlSlot?.date === day.iso && wlSlot?.start === time;
                return `<button type="button" class="wl__slot${
                  selected ? ' wl__slot--selected' : ''
                }" data-wl-slot="${esc(day.iso)}|${time}"
                  aria-pressed="${selected}">${esc(displayTime(time))}</button>`;
              })
              .join('')}
          </div>
        </div>`
      )
      .join('')}`;

  host.querySelectorAll('[data-wl-slot]').forEach((button) =>
    button.addEventListener('click', () => {
      const [date, start] = button.dataset.wlSlot.split('|');
      wlSlot = { date, start };
      renderWaitlistSlots();
      paintWaitlistRecap();
    })
  );
  host.querySelector('[data-wl-slot-clear]')?.addEventListener('click', () => {
    wlSlot = null;
    renderWaitlistSlots();
    paintWaitlistRecap();
  });
}

/** "09:00" → "9:00 AM", and nothing at all for an empty field. */
const wlTimeLabel = (value) => (value ? clockLabel(toMinutes(value)) : '');

/**
 * The six availability controls said back as the one sentence they add up to.
 *
 * The desk does not act on "from 2026-07-30, to 2026-08-27, days 1,2,3,4,5" —
 * it acts on "weekdays between 30 Jul and 27 Aug, mornings only", which is
 * what it will read down the phone when a slot opens. Reading that off six
 * controls is work; reading it off one line is not, and a window typed the
 * wrong way round is visible in the sentence before anything is saved.
 */
function paintWaitlistRecap() {
  const host = field('wlRecap');
  if (!host) return;

  const from = field('wlFrom').value;
  const to = field('wlTo').value;
  if (!from || !to) {
    host.className = 'wl__recap wl__recap--quiet';
    host.textContent = 'Pick a date window and this line will say what to offer them.';
    return;
  }

  const start = wlTimeLabel(field('wlStart').value);
  const end = wlTimeLabel(field('wlEnd').value);
  const time = start && end
    ? `${start} – ${end}`
    : start
      ? `from ${start}`
      : end
        ? `until ${end}`
        : 'any time of day';

  const backwards = to < from;
  host.className = `wl__recap${backwards ? ' wl__recap--warning' : ''}`;

  /* A request that has taken a slot is no longer an instruction to ring
     round — it is an appointment waiting to be written, and the line says so
     instead of describing a window nobody now needs to search. */
  if (!backwards && wlSlot) {
    host.textContent = `Holding ${shortDateYear(wlSlot.date)} at ${displayTime(
      wlSlot.start
    )} for them, inside ${shortDate(from)} – ${shortDateYear(to)}.`;
    return;
  }

  host.textContent = backwards
    ? `${shortDateYear(to)} is before ${shortDateYear(from)} — that window is the wrong way round.`
    : `Offer any day between ${shortDate(from)} and ${shortDateYear(to)}, ${time}.`;
}

/**
 * Who is waiting, drawn from the record rather than asked for again — retyping
 * what is already on file is how the two come to disagree.
 *
 * `entry` is passed when an existing request is open, and it buys two things
 * the add path has nothing to say about: the lock, which explains why there is
 * no patient picker above this strip, and how long the person has been on the
 * list — the fact that decides who gets the slot when two requests fit it.
 */
function paintWaitlistFacts(mrn, entry = null) {
  const host = field('wlFacts');
  if (!mrn) {
    host.className = 'wl__who wl__who--empty';
    host.innerHTML = `<svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>
      <p>Choose a patient and their details appear here.</p>`;
    return;
  }

  const p = patientOf(mrn);
  const initials = String(p.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  host.className = 'wl__who';
  host.innerHTML = `
    <div class="wl__who-head">
      <span class="wl__who-avatar" aria-hidden="true">${esc(initials)}</span>
      <span class="wl__who-id">
        <strong>${esc(p.name)}</strong>
        <small>MRN ${esc(p.mrn)}${p.age ? ` · ${esc(p.age)} yrs` : ''}${
          p.sex ? ` · ${esc(p.sex)}` : ''
        }</small>
      </span>
      ${
        entry
          ? `<span class="wl__who-lock" data-testid="sch--wl-lock">
              <svg class="ui-icon" aria-hidden="true"><use href="#i-lock"></use></svg>
              Patient cannot be changed
            </span>`
          : ''
      }
    </div>
    <dl class="wl__facts">
      <div><dt>DOB</dt><dd>${esc(p.dob ?? '—')}</dd></div>
      <div><dt>MRN</dt><dd><code>${esc(p.mrn)}</code></dd></div>
      <div><dt>Sex</dt><dd>${esc(p.sex ?? '—')}</dd></div>
      <div><dt>Phone</dt><dd>${esc(p.phone ?? '—')}</dd></div>
      ${
        entry
          ? `<div><dt>Waiting since</dt><dd>${esc(shortDateYear(entry.addedOn))} <span
              class="wl__who-wait">(${esc(wlWaitLength(entry.addedOn))})</span></dd></div>`
          : ''
      }
    </dl>`;
}

/** "31 days" — the figure the queue is ordered by, beside the date it counts
 *  from, because "5 Aug" and "12 days" answer two different questions and the
 *  desk asks both: how long has this person been waiting, and is that date old
 *  enough to be worth apologising for. */
function wlWaitLength(addedOn) {
  if (!addedOn) return 'today';
  const days = Math.max(
    0,
    Math.round((parseISO(TODAY) - parseISO(addedOn)) / (1000 * 60 * 60 * 24))
  );
  if (days === 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function saveWaitlistEntry() {
  const required = {
    wlPatient: 'Choose a patient',
    wlActivity: 'Choose an activity',
    wlProvider: 'Choose a provider',
    wlLocation: 'Choose a location',
    wlFrom: 'Pick the first date they can come',
    wlTo: 'Pick the last date they can come',
  };
  let valid = true;
  for (const [id, message] of Object.entries(required)) {
    if (field(id).value) field(id).removeAttribute('error');
    else {
      field(id).setAttribute('error', message);
      valid = false;
    }
  }
  if (!valid) return;

  // A window that ends before it starts is not a window.
  if (field('wlTo').value < field('wlFrom').value) {
    field('wlTo').setAttribute('error', 'The last date is before the first');
    return;
  }

  // Nor is a day that ends before it begins. Both ends are optional, so this
  // only applies when both were given — one time on its own is a floor or a
  // ceiling, and neither can contradict anything.
  const start = field('wlStart').value;
  const end = field('wlEnd').value;
  if (start && end && end < start) {
    field('wlEnd').setAttribute('error', 'The latest time is before the earliest');
    return;
  }

  const values = {
    mrn: field('wlPatient').value,
    activity: field('wlActivity').value,
    providerId: field('wlProvider').value,
    location: field('wlLocation').value,
    from: field('wlFrom').value,
    to: field('wlTo').value,
    start,
    end,
    /* Weekday preferences are not asked for any more — the window plus the
       slot picked inside it is the whole of "when". Written empty rather than
       dropped: waitingFor() reads `days` to decide who could take a cancelled
       day, and an entry without the key would be an entry it could not match. */
    days: [],
    slotDate: wlSlot?.date ?? '',
    slotStart: wlSlot?.start ?? '',
    priority: field('wlPriority').value || 'routine',
    note: field('wlNote').value.trim(),
  };

  const editing = wlEditingId;
  const entry = editing ? updateWaitlistEntry(editing, values) : addToWaitlist(values);
  wlEditingId = null;

  document.getElementById('wlModal').close();
  notify(
    `${patientOf(entry.mrn).name} ${editing ? 'updated on' : 'added to'} the wait list.`,
    editing ? 'info' : 'success'
  );
  state.tab = 'waitlist';
  field('schTabs').setAttribute('selected', 'waitlist');
  paint();
}

/* --- Booking a day: new, or somebody already waiting ----------------------- */

/** The date the choice dialog is about. */
let choiceDate = null;

function openBookChoice(iso) {
  choiceDate = iso;
  const waiting = waitingFor(iso, { providerId: soleProvider() });

  field('choiceLead').textContent = `${longDate(iso)} — what would you like to do?`;
  field('choiceWaitCount').textContent = waiting.length
    ? `${waiting.length} patient${waiting.length === 1 ? '' : 's'} waiting could take this day.`
    : 'Nobody on the wait list is available on this day.';
  field('choiceWait').disabled = waiting.length === 0;

  document.getElementById('bookChoiceModal').open();
}

/** Open the day without booking — what a month cell used to do on its own. */
function openDay(iso) {
  state.anchor = iso;
  state.range = 'day';
  setField('fDate', iso);
  resetPage();
  paint();
}

function openWaitlistPicker() {
  const waiting = waitingFor(choiceDate, { providerId: soleProvider() });

  field('wlPickBody').innerHTML = `
    <p class="wl__pick-lead">
      ${esc(waiting.length)} waiting for a slot on ${esc(longDate(choiceDate))}.
      Choosing one opens the booking form with their request already filled in.
    </p>
    <div class="wl__pick-list">
      ${waiting
        .map((row) => {
          const p = patientOf(row.mrn);
          const spec = WAITLIST_PRIORITIES[row.priority] ?? WAITLIST_PRIORITIES.routine;
          return `<button type="button" class="wl__pick-row" data-wl-pick="${esc(row.id)}"
            data-testid="sch--wl-pick-${esc(row.id)}">
            <span class="wl__pick-main">
              <strong>${esc(p.name)}</strong>
              <small>${esc(typeById(row.activity)?.title ?? '')} ·
                ${esc(providerById(row.providerId)?.name ?? '')}</small>
            </span>
            <span class="wl__pick-meta">
              <ui-badge status="${spec.tone}" size="sm">${esc(spec.label)}</ui-badge>
              ${
                row.matchesProvider
                  ? ''
                  : '<span class="wl__pick-other">asked for another provider</span>'
              }
              <small>waiting since ${esc(wlShortDate(row.addedOn))}</small>
            </span>
          </button>`;
        })
        .join('')}
    </div>`;

  field('wlPickBody')
    .querySelectorAll('[data-wl-pick]')
    .forEach((b) => b.addEventListener('click', () => bookFromWaitlist(b.dataset.wlPick)));

  document.getElementById('wlPickModal').open();
}

/**
 * Take a waiting patient into the booking form.
 *
 * The entry is NOT removed here. It comes off the list when the appointment is
 * actually saved — abandoning the form half way should leave the patient
 * exactly where they were, still waiting.
 */
function bookFromWaitlist(id) {
  const entry = waitlistById(id);
  if (!entry) return;

  document.getElementById('wlPickModal').close();
  document.getElementById('bookChoiceModal').close();

  state.anchor = choiceDate;
  setField('fDate', choiceDate);

  pendingWaitlistId = id;
  openAppointment(null);

  // Fill the request into the form the desk is about to complete.
  setField('mPatient', entry.mrn);
  setField('mType', entry.activity);
  setField('mProvider', entry.providerId);
  setField('mDate', choiceDate);
  setField('mReason', entry.note ?? '');
  paintPatientPanels();
  renderSlots();

  notifyInForm(
    `Booking ${patientOf(entry.mrn).name} from the wait list. They come off the list once this is saved.`,
    'info'
  );
}

/** Set while a wait-list booking is in the form; cleared when it saves. */
let pendingWaitlistId = null;

/* --- The filter rail --------------------------------------------------------
   One rail, two tabs. Most of the filters mean the same thing on both sides —
   a provider's bookings and that provider's outstanding notes are the same
   provider — so they stay put and keep their value when the tab changes. Only
   the two that belong to one side swap: the date the calendar is anchored to,
   and the note template.
   -------------------------------------------------------------------------- */

/**
 * The rail belongs to the Appointments tab alone.
 *
 * Encounters is a worklist of everything still owed, not a period to narrow —
 * and every rail filter that did apply to it applied invisibly once the rail
 * was gone, which is the worst of both. So the rail is hidden there outright
 * and visitNoteRows() honours the search box only.
 */
function applyTab() {
  // The rail narrows a booking inside a period. Neither Encounters nor the
  // wait list has a period, so it steps aside on both rather than showing
  // controls that would mean something else.
  field('filterRail').hidden = state.tab !== 'appointments';

  /*
   * The primary action belongs to the open tab, not to the screen.
   *
   * Appointments books. The wait list adds to itself. Encounters is a worklist
   * of notes already owed — there is nothing to create from it, so it shows no
   * button rather than one that would create the wrong kind of thing.
   */
  document.querySelector('[data-testid="sch--new"]').hidden = state.tab !== 'appointments';
  /* NOTHING TO SWAP IN ON THE WAIT LIST. A standing request is raised from the
     booking form, by ticking "Add to wait list" at the moment none of the
     offered times will do — so the queue screen has no create button of its
     own to show or hide here. */
}

function applyRail() {
  field('filterRail').classList.toggle('sch__rail--collapsed', !state.railOpen);
  field('railToggle').setAttribute('aria-expanded', String(state.railOpen));
  field('railBody').hidden = !state.railOpen;
}

/**
 * How many filters are on.
 *
 * Only the ones that take rows away: the anchor date moves the period rather
 * than narrowing it, and a badge that read "1 filter" for every week you paged
 * to would mean nothing. Shut, this is the only thing the rail can still say,
 * and without it a filtered list is indistinguishable from a short one.
 */
function activeFilterCount() {
  return [
    state.providerIds.size > 0,
    state.location,
    state.typeId,
    state.kind,
  ].filter(Boolean).length;
}

function paintRailCount() {
  const count = activeFilterCount();
  const badge = field('railCount');
  badge.hidden = count === 0;
  badge.textContent = String(count);

  // Shut, the word "Filters" is not on screen, so the button carries it in its
  // accessible name and its tooltip instead of being a bare icon.
  const name = count ? `Filters — ${count} applied` : 'Filters';
  field('railToggle').setAttribute('aria-label', name);
  field('railToggle').setAttribute('title', name);
}

/**
 * The header the printed copy carries.
 *
 * Kept in the DOM and hidden on screen rather than built at print time,
 * because window.print() is synchronous — anything rendered inside a
 * beforeprint handler is a race with the browser's own snapshot.
 *
 * It names the filters that were on. A printed list handed to a nurse with
 * three providers silently filtered out is worse than no list, because it
 * looks complete.
 */
function paintPrintHead(count) {
  const notes = state.tab === 'visit-notes';

  const applied = [
    state.providerIds.size &&
      `Providers: ${[...state.providerIds].map((id) => providerById(id)?.name).join(', ')}`,
    state.location && `Location: ${state.location}`,
    state.typeId && `Type: ${typeById(state.typeId)?.title}`,
    state.kind && `Care type: ${KIND_LABELS[state.kind]}`,
    state.query && `Search: “${state.query}”`,
  ].filter(Boolean);

  // The note worklist has no period, so its second line names the half of the
  // queue on the page instead — "Unsigned" and "Signed" are different lists,
  // and a printed one that does not say which is a list of names.
  const heading = notes
    ? `Visit notes · ${state.noteTab === 'signed' ? 'Signed' : 'Unsigned'}`
    : periodTitle();

  field('printHead').innerHTML = `
    <div class="sch__print-brand">
      <!-- The practice's name is not written here. Every printed page in this
           product carries the practice letterhead above whatever the screen
           printed — see js/lib/print-letterhead.js — and this line used to
           repeat it directly underneath. What is left is the one thing the
           letterhead cannot say: which list this is. -->
      <span>${
        notes
          ? 'Encounter worklist'
          : `Appointment schedule · ${esc(state.view === 'list' ? 'List' : 'Calendar')} ·
             ${esc(state.range)} view`
      }</span>
    </div>
    <div class="sch__print-meta">
      <strong>${esc(heading)}</strong>
      <span>${count} ${notes ? 'encounter' : 'appointment'}${count === 1 ? '' : 's'}</span>
    </div>
    <p class="sch__print-filters">${
      applied.length
        ? `Filtered — ${esc(applied.join(' · '))}`
        : 'No filters applied — every provider, location and type.'
    }</p>`;
}

/* ===================== New / edit appointment ===================== */

let editingId = null;

/**
 * The Resources lists.
 *
 * Each of these used to be a stack of single-answer <ui-select> rows that grew
 * one at a time from a + button: naming two nurses cost a click on +, a pick,
 * a click on + again and a second pick, and a row someone opened and then
 * thought better of stayed on screen as an empty dropdown with a bin beside
 * it. Every one of them asks the same question — which of these are on this
 * booking — and the product already has the control for that question. The
 * filter bar above the calendar is four <ui-select multiple>s; this is one
 * more. One field, a panel of checkboxes, and the closed field reads back
 * everything that has been chosen.
 *
 * Two other lists used to be here. Instruments went first: a clinic booking
 * does not reserve a scope (RM-026), so the list moved out of the form rather
 * than sitting on it unanswered. Referring Physicians followed, for the reason
 * the procedure form had already dropped its Referring Clinician — who sent
 * the patient is a directory fact, kept where referrals are, not a question
 * put to whoever is making the booking. Both keys, `equipment` and
 * `referrers`, still exist on the appointment record: other parts of the
 * product own those questions, and bookings made before the fields went carry
 * answers to them that must survive an edit here.
 *
 * The selection therefore lives in the DOM rather than in a module-level array
 * that had to be kept in step with it: the field is asked what it holds when
 * the form is saved, the same way every other control on this form is. The map
 * is down to a single entry and keeps its shape — the three helpers below read
 * the same either way, and Resources is the kind of section that grows back.
 */
const RESOURCE_FIELDS = {
  staff: {
    id: 'mStaff',
    options: () => STAFF.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` })),
  },
};

/** The catalogue behind the field. It does not change, so this runs once. */
function fillResourcePickers() {
  Object.values(RESOURCE_FIELDS).forEach((spec) => {
    const select = field(spec.id);
    if (select) select.optionList = spec.options();
  });
}

/** Open the form on what a saved booking holds — or on nothing, for a new one. */
function setResources(appt) {
  Object.entries(RESOURCE_FIELDS).forEach(([kind, spec]) => {
    const select = field(spec.id);
    if (select) select.values = appt?.[kind] ?? [];
  });
}

/** What one of them currently holds. */
const chosenResources = (kind) =>
  field(RESOURCE_FIELDS[kind].id)?.values.filter(Boolean) ?? [];

function fillPickers() {
  field('mPatient').optionList = DIRECTORY.filter((p) => p.active).map((p) => ({
    value: p.mrn,
    label: `${p.name} · MRN ${p.mrn}`,
  }));
  // Booking offers only what the active practice profile does. The colour
  // classes registered above still cover every type, so an appointment booked
  // under the other entity keeps rendering.
  field('mType').optionList = activeAppointmentTypes().map((t) => ({
    value: t.id,
    label: `${t.title} · ${t.duration} ${t.unit.toLowerCase()}`,
  }));
  field('mProvider').optionList = PROVIDERS.map((p) => ({
    value: p.id,
    label: providerLabel(p),
  }));
  fillResourcePickers();
}

/* --- The right-hand rail and the eligibility list -------------------------- */

/** Billing, recalls, wait list and eligibility all key off the patient. */
/* --- gEstimator --------------------------------------------------------------
   What the visit will cost this patient. The booking answers who and what, so
   the dialog only asks which plan — and shows the working, because an estimate
   the desk cannot explain is one they will not quote.
   -------------------------------------------------------------------------- */

/** The appointment the open estimate is for. Captured on open: the row menu
 *  is gone by then, so there is nothing to read it back off. */
let estimatingAppt = null;

function openEstimate(appt) {
  estimatingAppt = appt;
  const patient = patientOf(appt.mrn);
  const activity = labelOf(appt);

  field('estimateWho').innerHTML = `
    <div><dt>Patient</dt><dd>${esc(patient.name)} · MRN ${esc(appt.mrn)}</dd></div>
    <div><dt>Visit</dt><dd>${esc(activity)} · ${esc(longDate(appt.date))}</dd></div>
    <div><dt>Provider</dt><dd>${esc(providerById(appt.providerId)?.name ?? '—')}</dd></div>`;

  const plans = plansFor(appt.mrn);
  field('estPlan').optionList = plans.map((p) => ({
    value: p.id,
    label: `${p.name}${p.network === 'n/a' ? '' : ` · ${p.network}`}`,
  }));

  // The plan the booking would actually bill is the sensible default, so the
  // common case is answered before the desk touches anything.
  setField('estPlan', plans[0]?.id ?? '');
  paintEstimate();

  document.getElementById('estimateModal').open();
}

function paintEstimate() {
  const host = field('estResult');
  if (!estimatingAppt) return;

  const plan = planById(estimatingAppt.mrn, field('estPlan').value);
  if (!plan) {
    host.innerHTML = `<p class="est__empty">Choose a plan to see the estimate.</p>`;
    return;
  }

  const activity = labelOf(estimatingAppt);
  const { amount, estimated } = chargeFor(activity);
  const e = estimate(amount, plan);

  // Every line of the working, then the total. The order is the order a claim
  // adjudicates in, so the desk can walk a patient down it.
  const line = (label, value, note = '') => `<div class="est__line">
    <dt>${esc(label)}${note ? ` <span class="est__note">${esc(note)}</span>` : ''}</dt>
    <dd>${esc(money(value))}</dd>
  </div>`;

  host.innerHTML = `
    <dl class="est__calc" data-testid="sch--est-calc">
      ${line('Clinic charge', e.charge, estimated ? 'no contracted price on file — approximate' : '')}
      ${line('Less contractual adjustment', -e.contractualAdjustment, plan.network)}
      <div class="est__line est__line--sub">
        <dt>Allowed amount</dt><dd>${esc(money(e.allowed))}</dd>
      </div>
      ${e.copay ? line('Copay', e.copay) : ''}
      ${
        e.towardsDeductible
          ? line('Towards deductible', e.towardsDeductible, `${money(e.deductibleLeft)} outstanding`)
          : ''
      }
      ${e.coinsurance ? line('Coinsurance', e.coinsurance, `${e.coinsuranceRate}%`) : ''}
      ${line('Plan pays', e.planPays)}
    </dl>

    <div class="est__total" data-testid="sch--est-total">
      <span>Estimated patient responsibility</span>
      <strong data-testid="sch--est-owes">${esc(money(e.patientOwes))}</strong>
    </div>

    <p class="est__caveat">
      An estimate, not a bill. It assumes the visit goes as booked and that
      coverage is unchanged on the day — anything found or done during the
      visit is billed on top.
    </p>`;
}

/**
 * Run an eligibility check, and say what came back.
 *
 * A real check is a request to the payer, so this is an action with a result
 * rather than a fact sitting on a rail: the desk presses it while the patient
 * is on the phone, and the answer decides whether the booking goes ahead as it
 * stands. Both field sets get one — a procedure needs the answer more than a
 * clinic visit does, not less.
 */
function runEligibilityCheck(which) {
  const mrn = which === 'q' ? field('qPatient').value : field('mPatient').value;
  const host = field(which === 'q' ? 'qEligResult' : 'mEligResult');
  if (!host) return;

  if (!mrn) {
    host.innerHTML = '<ui-alert severity="warning">Choose a patient first.</ui-alert>';
    return;
  }

  const coverage = coverageFor(mrn);
  const active = coverage.eligibility === 'Active';
  // Self pay is not a failed check — there is no payer to ask, and reading it
  // as "not eligible" would send the desk chasing a plan that does not exist.
  const self = coverage.memberId === '—';

  const severity = self ? 'info' : active ? 'success' : 'critical';
  const heading = self
    ? 'No coverage on file'
    : active
      ? 'Active coverage'
      : 'Coverage not active';

  host.innerHTML = `<ui-alert severity="${severity}" heading="${esc(heading)}">
    <dl class="appt__elig">
      <div><dt>Plan</dt><dd>${esc(coverage.insurance)}</dd></div>
      <div><dt>Member ID</dt><dd>${esc(coverage.memberId)}</dd></div>
      <div><dt>Status</dt><dd>${esc(coverage.eligibility)}</dd></div>
      <div><dt>Authorisation</dt><dd>${esc(coverage.auth)}</dd></div>
      ${
        self
          ? ''
          : `<div><dt>Copay</dt><dd>${esc(money(coverage.copay))}</dd></div>
             <div><dt>Coinsurance</dt><dd>${esc(coverage.coinsurance)}%</dd></div>`
      }
      <div><dt>Checked</dt><dd>just now</dd></div>
    </dl>
  </ui-alert>`;
}

function paintPatientPanels() {
  // Whichever field set is showing owns the patient these panels describe.
  const mrn = kind === 'procedure' ? field('qPatient').value : field('mPatient').value;

  const history = mrn ? eligibilityFor(mrn) : [];
  field('mEligibility').innerHTML = history.length
    ? history
        .map(
          (h) => `<div class="appt__history-row">
            <span class="appt__history-date">${esc(h.checked)}</span>
            <span>${esc(h.payer)} — ${esc(h.result)}</span>
            <span class="appt__history-by">${esc(h.by)}</span>
          </div>`
        )
        .join('')
    : `<p class="appt__rail-empty">${
        mrn ? 'No eligibility checks recorded for this patient.' : 'Choose a patient first.'
      }</p>`;
}

/* --- Open slots ------------------------------------------------------------
   The provider's configured hours for the chosen date, cut into start times
   that the chosen activity actually fits into, minus whatever is already
   booked. Offering these is the difference between "type a time and find out"
   and "pick one of these".
   -------------------------------------------------------------------------- */

/** Start times are offered on a quarter-hour grid, or finer for short visits. */
const SLOT_STEP = 15;

function openSlots(providerId, iso, duration) {
  const { blocks } = availabilityOn(providerId, iso);
  const step = Math.min(SLOT_STEP, duration);

  // Everything already on this provider's day, except the appointment being
  // edited — its own slot is not a clash with itself.
  const taken = appointments
    .filter(
      (a) =>
        a.providerId === providerId &&
        a.date === iso &&
        a.status !== 'Cancelled' &&
        a.id !== editingId
    )
    .map(spanOf);

  return blocks
    .map((block) => {
      const from = toMinutes(block.start);
      const to = toMinutes(block.end);
      const slots = [];

      for (let start = from; start + duration <= to; start += step) {
        const end = start + duration;
        if (taken.some((t) => t.start < end && t.end > start)) continue;
        if (blockedDuring(providerId, iso, start, end).length) continue;
        slots.push(start);
      }

      return { label: `${block.start}–${block.end}`, location: block.location, slots };
    })
    .filter((group) => group.slots.length);
}

/**
 * The infusion unit's open starts for a day, with nobody's name on them.
 *
 * An infusion booking names no provider — see syncProviderField() — so there
 * is no configured session for openSlots() to cut into times. What is being
 * reserved is chair time in a unit that is open when the practice is open, and
 * the nurse who looks after it is whoever is on the floor when the patient
 * arrives. So the starts come from the practice's own hours for that weekday,
 * on the same grid every other slot on this form uses.
 *
 * NOTHING IS SUBTRACTED FOR WHAT IS ALREADY BOOKED. A provider can only be in
 * one room at a time, which is why openSlots() drops their taken minutes. A
 * unit with a row of chairs cannot, and refusing ten o'clock because one
 * patient already has it would be this form inventing a capacity limit the
 * prototype does not model.
 */
function openChairSlots(iso, duration) {
  const day = PRACTICE.officeHours.find((hours) => hours.day === weekdayName(iso));
  if (!day?.open) return [];

  const step = Math.min(SLOT_STEP, duration);
  const to = toMinutes(day.to);
  const slots = [];
  for (let start = toMinutes(day.from); start + duration <= to; start += step) slots.push(start);

  return slots.length ? [{ label: `${day.from}–${day.to}`, location: PRACTICE.name, slots }] : [];
}

/* The Clinical/Infusion start time. There is no Time field on the form any
   more — the slot buttons below are the only way to set it, so the value has
   to be held here rather than read back off a control. */
let startTime = '';

function renderSlots() {
  const host = field('mSlots');
  if (!host) return;
  // Optional: an infusion booking has no Provider control on the form at all,
  // because it is taken out of the document rather than hidden. See
  // syncProviderField().
  const providerId = field('mProvider')?.value ?? '';
  const typeId = field('mType').value;
  const date = field('mDate').value;

  /* NOTHING TO SAY YET, SO NOTHING IS DRAWN.
     Until there is a provider and an activity there are no times to offer, and
     a bordered box announcing "TIME — no time picked. Choose a provider, date
     and activity to see open slots." is two lines of chrome telling the desk
     to fill in the fields it is already filling in. The box collapses instead
     (.appt__slots:empty), so the panel is a calendar until the moment it has
     times to put beside it. */
  if (!typeId || !date || (kind !== 'infusion' && !providerId)) {
    host.innerHTML = '';
    return;
  }

  /* A save refused for a missing day or time rings the whole When panel (see
     save()). Picking a time is the fix, so the ring comes off as soon as there
     is one. */
  if (startTime) field('mWhen')?.classList.remove('appt__when--error');

  // The slots offered are the ones this provider's own length fits into: a
  // clinician the type gives 45 minutes to is not offered a 30-minute gap.
  const duration = durationOf(typeId, providerId);
  const groups =
    kind === 'infusion' ? openChairSlots(date, duration) : openSlots(providerId, date, duration);
  const total = groups.reduce((sum, group) => sum + group.slots.length, 0);
  const current = startTime ? toMinutes(startTime) : null;

  /* The booked time in words, at the top of the box under the panel's Time
     label. It is the only place the time is stated — a selected button is easy
     to miss, and a booking made outside these hours has no button to
     highlight. Before one is picked there is no head at all: the buttons
     underneath are the instruction, and "no time picked" printed above them
     was the form narrating itself. */
  const chosen = startTime
    ? `<span class="appt__slots-chosen">${esc(displayTime(startTime))}</span>`
    : '';

  if (!total) {
    /* Whose hours ran out, and therefore what there is to change. An infusion
       has no provider to name or to try a different one of — the unit's own
       hours are what the desk is being told about. */
    const whose =
      kind === 'infusion'
        ? "the infusion unit's hours"
        : `${esc(providerById(providerId)?.name ?? 'this provider')}'s hours`;
    const instead = kind === 'infusion' ? 'date or activity' : 'date, provider or activity';
    host.innerHTML = `
      ${chosen ? `<div class="appt__slots-head">${chosen}</div>` : ''}
      <p class="appt__slots-hint">
        No ${duration}-minute slot is open in ${whose} on
        ${esc(longDate(date))}. Try another ${instead}.
      </p>`;
    return;
  }

  host.innerHTML = `
    <div class="appt__slots-head">
      ${chosen}
      <span class="appt__slots-count">${total} free · ${duration} min</span>
    </div>
    ${groups
      .map(
        (group) => `<div class="appt__slot-group">
          <span class="appt__slot-group-label">${esc(group.label)}${
          group.location ? ` · ${esc(group.location)}` : ''
        }</span>
          <div class="appt__slot-row">
            ${group.slots
              .map(
                (start) => `<button type="button" class="appt__slot${
                  start === current ? ' appt__slot--selected' : ''
                }" data-slot="${start}"
                  aria-pressed="${start === current}">${toTime(start)}</button>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('')}`;

  host.querySelectorAll('[data-slot]').forEach((button) =>
    button.addEventListener('click', () => {
      startTime = toTime(Number(button.dataset.slot));
      renderSlots();
    })
  );
}

/* --- Appointment kind ------------------------------------------------------
   Procedure swaps in the endoscopy field set. Clinical and Infusion share the
   general booking form — an infusion is booked on the same facts as a clinic
   visit (patient, activity, chair, nurse), so until it earns fields of its own
   it uses that one rather than a placeholder nobody can book from.
   -------------------------------------------------------------------------- */

let kind = 'clinical';

/** Which field set a kind books through. */
const usesGeneralForm = () => kind !== 'procedure';

function applyKind() {
  field('kindClinical').hidden = !usesGeneralForm();
  field('kindProcedure').hidden = kind !== 'procedure';
  // ui-radio-group keys off the option label, not the id. Its own setter
  // re-renders and checks the right radio; setValue() would poke the first
  // input instead.
  field('mKind').value = kind.charAt(0).toUpperCase() + kind.slice(1);
  syncProviderField();
  syncWaitlistOption();
}

/* Where the Provider control waits while an infusion is being booked, and the
   control itself. Module-level because applyKind() can run many times over one
   dialog and has to put back the SAME element — the one carrying the option
   list and the listener that redraws the slots. */
let parkedProviderAnchor = null;
let parkedProvider = null;

/**
 * AN INFUSION NAMES NO PROVIDER.
 *
 * Nobody is chosen when the chair is booked. The unit assigns whoever is in
 * the office when the patient arrives, at check-in — so a Provider dropdown at
 * booking asked a question whose answer nobody has yet, and a REQUIRED one at
 * that: the desk had to name somebody, and the name it named was wrong as
 * often as not.
 *
 * The control comes OUT of the document rather than being hidden. A field with
 * display:none on it is still a field — it holds a value, `field('mProvider')`
 * still finds it, and the next thing to read the form reads back an answer the
 * desk was never shown. Off the form there is nothing to read, which is why
 * renderSlots(), draft() and save() all ask whether the control is THERE
 * rather than what it says.
 *
 * A comment node holds its place in the grid so it returns to the same
 * position — after Activity, before the When panel — when the care type
 * changes back, with its options and its slot listener intact.
 */
function syncProviderField() {
  const wanted = kind !== 'infusion';
  const control = field('mProvider');

  if (!wanted && control) {
    parkedProviderAnchor = document.createComment(
      ' Provider — off the form: an infusion names nobody at booking '
    );
    parkedProvider = control;
    control.replaceWith(parkedProviderAnchor);
    return;
  }

  if (wanted && !control && parkedProvider && parkedProviderAnchor) {
    parkedProviderAnchor.replaceWith(parkedProvider);
    parkedProviderAnchor = null;
    parkedProvider = null;
  }
}

/**
 * "Add to wait list" is offered for the activities that can actually be
 * waitlisted, and taken away for the ones that cannot.
 *
 * The procedure field set has no wait list at all — a scope is deferred and
 * brought forward on its own list, not by joining a queue. But Clinical is not
 * the same thing as "not a procedure": working as the ASC entity, this field
 * set's Activity dropdown is filled from the ASC's own types, so a desk could
 * pick Screening Colonoscopy here and tick a box the procedure form
 * deliberately does not have. That is the same request through a side door,
 * and it would leave a patient on a queue nothing ever reads.
 *
 * So the checkbox follows the activity rather than the care type. Hidden, not
 * disabled: a control that cannot ever apply to this booking is not a choice
 * being withheld, and a tick already made is cleared on the way out so an
 * activity changed after the fact cannot save a flag the form is no longer
 * showing.
 */
function syncWaitlistOption() {
  const box = field('mWaitList');
  if (!box) return;
  const typeId = field('mType').value;
  const allowed = !typeId || waitlistableAppointmentTypes().some((t) => t.id === typeId);
  if (!allowed) box.checked = false;
  box.hidden = !allowed;
  syncWaitlistRange();
}

/**
 * The date window, shown only once the booking is actually going on a queue.
 *
 * "First date they can come / last date they can come" is a question about a
 * STANDING REQUEST, not about a booking — on a booking that has a slot picked
 * above it, the two dates say nothing and read as a second, contradictory
 * answer to the When panel. So they arrive with the tick and leave with it.
 *
 * Cleared on the way out rather than merely hidden, for the reason the
 * Provider control is taken off an infusion form: a hidden field still holds
 * an answer, and draft() would otherwise write a window nobody meant onto a
 * booking whose checkbox is not even on screen. It opens on today and a month
 * out, which is the window nine requests in ten are asking for.
 */
function syncWaitlistRange() {
  const range = field('mWaitRange');
  const box = field('mWaitList');
  if (!range || !box) return;

  const wanted = box.checked && !box.hidden;
  range.hidden = !wanted;

  if (!wanted) {
    setField('mWaitFrom', '');
    setField('mWaitTo', '');
    return;
  }
  if (!field('mWaitFrom').value) setField('mWaitFrom', TODAY);
  if (!field('mWaitTo').value) setField('mWaitTo', addDays(TODAY, 30));
}

/* --- Indications ------------------------------------------------------------
   The booking stores its indications as they READ — "Z12.11 — Encounter for
   screening for malignant neoplasm of colon" — because billing shows that
   string as the visit reason. The picker works in bare codes, so the stored
   string is parsed on the way in and rebuilt on the way out.

   The field takes several diagnoses now, which need a separator that cannot
   turn up inside one. A semicolon is safe: ICD-10 descriptions use commas and
   dashes freely but never a semicolon.
   -------------------------------------------------------------------------- */

const REASON_SEPARATOR = '; ';

/** Stored reason string → the comma-separated codes <ui-icd10 multiple> wants. */
const codesFromReason = (reason) =>
  String(reason ?? '')
    .split(REASON_SEPARATOR)
    .map((part) => icd10CodeFrom(part))
    .filter(Boolean)
    .join(',');

/** The picker's codes → the reason string the rest of the app reads. */
const reasonFromCodes = (value) =>
  String(value ?? '')
    .split(',')
    .map((code) => icd10Label(code.trim()))
    .filter(Boolean)
    .join(REASON_SEPARATOR);

/**
 * The part of a stored reason that is NOT a diagnosis — the typed complaint.
 *
 * Clinic visits carry a sentence here ("Coeliac — first assessment") and some
 * procedure bookings do too, from before the field asked for codes. The picker
 * cannot hold that text, so it is kept aside and written back alongside the
 * codes: attaching a diagnosis must not silently delete what the desk typed.
 *
 * "Is this a code" is answered by the catalogue rather than by the shape of the
 * string, so a sentence that merely starts code-shaped stays a sentence.
 */
const textFromReason = (reason) =>
  String(reason ?? '')
    .split(REASON_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part && !icd10ByCode(icd10CodeFrom(part)))
    .join(REASON_SEPARATOR);

/** Typed text plus picked codes, back into the one string every screen reads. */
const reasonFrom = (text, codes) =>
  [String(text ?? '').trim(), reasonFromCodes(codes)].filter(Boolean).join(REASON_SEPARATOR);

/** The standard length of a set of procedures, added up. */
const proceduresMinutes = (ids) =>
  ids.reduce((total, id) => total + (procedureById(id)?.duration ?? 0), 0);

/**
 * The booked length in minutes — DERIVED, never typed.
 *
 * It used to be whatever was in the Duration box, falling back to the
 * catalogue. The box is disabled now: the length of a scope list entry is the
 * sum of the standard lengths of the procedures on it, and a desk overruling
 * that from a number field was a booking the theatre list had not agreed to.
 *
 * Read from the SELECTION rather than off the disabled field, because the
 * selection is what the number is computed from — asking the box would be
 * asking a display for the fact it is displaying, and a paint that had not
 * happened yet would answer with the previous booking's length.
 *
 * Everything that needs a length — the slot search, the clash check, the saved
 * record — asks this, so they cannot disagree.
 */
function procedureMinutes() {
  return proceduresMinutes(field('qProcedure')?.values ?? []);
}

/** Write the derived length into the read-only Duration box. */
function syncProcedureDuration() {
  const minutes = procedureMinutes();
  setField('qDuration', minutes || '');
}

/** Fill the procedure field set. Clinical is filled by openAppointment. */
function fillProcedure(appt) {
  const procedures = PROCEDURE_TYPES.map((p) => ({
    value: p.id,
    label: `${p.title} · ${p.duration} min`,
  }));

  field('qPatient').optionList = DIRECTORY.filter((p) => p.active).map((p) => ({
    value: p.mrn,
    label: `${p.name} · MRN ${p.mrn}`,
  }));
  field('qProcedure').optionList = procedures;
  field('qDoctor').optionList = PROVIDERS.map((p) => ({
    value: p.id,
    label: providerLabel(p),
  }));
  /* The same catalogue the clinical set's Staff field offers, so the two forms
     hold the fact in one shape and a case moved between them keeps its people. */
  field('qStaff').optionList = STAFF.map((s) => ({
    value: s.id,
    label: `${s.name} — ${s.role}`,
  }));
  // The same list Settings colours the calendar from, so a status set here is
  // one the schedule already knows how to draw.
  field('qStatus').optionList = STATUS_COLOURS.map((s) => ({
    value: s.name,
    label: s.name,
  }));

  setField('qPatient', appt?.mrn ?? '');
  /* Both multiple selects, so they are opened through `.values` rather than
     setField: writing "pt1,pt3" into a <select multiple> through its `value`
     matches no single <option> and clears the selection outright. */
  field('qProcedure').values = procedureIdsOf(appt);
  setField('qStatus', appt?.status ?? 'Scheduled');
  setField('qDate', appt?.date ?? state.anchor);
  procStartTime = appt?.start ?? '';
  /* The length follows the procedures, on an edit as on a new booking — see
     procedureMinutes. A booking opened with nothing picked shows an empty box
     rather than a house default, because a number under a disabled label is a
     claim about what is booked and nothing is. */
  syncProcedureDuration();
  setField('qDoctor', appt?.providerId || soleProvider());
  field('qStaff').values = appt?.staff ?? [];
  setField('qRoom', appt?.area ?? '');
  /* The one stored reason, split back into the two fields that write it — the
     typed complaint and the coded indications — exactly as the clinical set
     splits it. A case booked while this was a single prose field keeps its
     sentence in the textarea; one booked while it was a picker gets its codes
     back into the picker rather than shown as text somebody has to retype. */
  setField('qReason', textFromReason(appt?.reason));
  setField('qIndication', codesFromReason(appt?.reason));
  setField('qNotes', appt?.notes ?? '');

  ['qPatient', 'qProcedure', 'qDate', 'qDoctor'].forEach((id) =>
    field(id).removeAttribute('error')
  );
  field('qWhen')?.classList.remove('appt__when--error');
  renderProcedureSlots();
}

/* The procedure booking's start time. Same shape as the clinical form's: the
   slot buttons are the only way to set it, so it is held here rather than read
   back off a control. */
let procStartTime = '';

/** The provider's open slots for this date, procedure and length. */
function renderProcedureSlots() {
  const host = field('qSlots');
  if (!host) return;

  const providerId = field('qDoctor').value;
  const procedure = procedureById(field('qProcedure').value);
  const date = field('qDate').value;
  const minutes = procedureMinutes();

  /* Nothing to offer yet, so nothing is drawn — the same rule the clinical
     panel follows. The box collapses (.appt__slots:empty) rather than standing
     there telling the clerk to fill in the fields being filled in. */
  if (!providerId || !procedure || !date || !minutes) {
    host.innerHTML = '';
    return;
  }

  /* A save refused for a missing day or time rings the whole When panel (see
     saveProcedure()). Picking a time is the fix, so the ring comes off as soon
     as there is one — the same rule the clinical panel follows. */
  if (procStartTime) field('qWhen')?.classList.remove('appt__when--error');

  const groups = openSlots(providerId, date, minutes);

  const total = groups.reduce((sum, group) => sum + group.slots.length, 0);
  const current = procStartTime ? toMinutes(procStartTime) : null;
  /* The booked time in words, at the top of the box under the panel's Time
     label — the only place it is now stated, since the Time select that used
     to sit above these buttons has gone with the panels. Before one is picked
     there is no head, exactly as on the clinical form. */
  const chosen = procStartTime
    ? `<span class="appt__slots-chosen">${esc(displayTime(procStartTime))}</span>`
    : '';

  if (!total) {
    host.innerHTML = `
      ${chosen ? `<div class="appt__slots-head">${chosen}</div>` : ''}
      <p class="appt__slots-hint">
        No ${minutes}-minute slot is open in
        ${esc(providerById(providerId)?.name ?? 'this provider')}'s hours on
        ${esc(longDate(date))}. Try another date, provider or length.
      </p>`;
    return;
  }

  host.innerHTML = `
    <div class="appt__slots-head">
      ${chosen}
      <span class="appt__slots-count">${total} free · ${minutes} min</span>
    </div>
    ${groups
      .map(
        (group) => `<div class="appt__slot-group">
          <span class="appt__slot-group-label">${esc(group.label)}${
          group.location ? ` · ${esc(group.location)}` : ''
        }</span>
          <div class="appt__slot-row">
            ${group.slots
              .map(
                (start) => `<button type="button" class="appt__slot${
                  start === current ? ' appt__slot--selected' : ''
                }" data-qslot="${start}"
                  aria-pressed="${start === current}">${toTime(start)}</button>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('')}`;

  host.querySelectorAll('[data-qslot]').forEach((button) =>
    button.addEventListener('click', () => {
      procStartTime = toTime(Number(button.dataset.qslot));
      renderProcedureSlots();
    })
  );
}

/** Save a procedure booking. Clinical goes through save(). */
function saveProcedure() {
  const required = {
    qPatient: [field('qPatient').value, 'Choose a patient'],
    qProcedure: [field('qProcedure').values.join(','), 'Choose at least one procedure'],
    qDoctor: [field('qDoctor').value, 'Choose a provider'],
  };
  let valid = true;
  for (const [id, [value, message]] of Object.entries(required)) {
    if (value) field(id).removeAttribute('error');
    else {
      field(id).setAttribute('error', message);
      valid = false;
    }
  }

  /* NEITHER HALF OF "WHEN" IS A FIELD THAT CAN CARRY AN ERROR — the day is a
     month grid and the time is a row of buttons — so the panel that holds them
     both is what wears the error, and it is said once in the form's notice
     bar. Same rule, same words, as the clinical set: the two forms now refuse
     a save the same way as well as asking for it the same way. */
  const when = field('qWhen');
  const bookedDate = field('qDate').value;
  if (!bookedDate || !procStartTime) {
    when?.classList.add('appt__when--error');
    notifyInForm(
      bookedDate ? 'Pick a time from the open slots.' : 'Pick a day and a time.',
      'warning'
    );
    valid = false;
  } else {
    when?.classList.remove('appt__when--error');
  }

  if (!valid) return;

  const record = {
    kind: 'procedure',
    mrn: field('qPatient').value,
    typeId: '',
    /* The list, and its first entry under the singular name. Every other
       screen that opens a booking — check-in, the encounter, the chart's
       appointment tab — reads `procedureId`, and none of them has any business
       learning about combined lists to keep showing what was booked. */
    procedureIds: field('qProcedure').values,
    procedureId: field('qProcedure').values[0] ?? '',
    providerId: field('qDoctor').value,
    coProviders: [],
    date: field('qDate').value,
    start: procStartTime,
    duration: procedureMinutes(),
    // A procedure is at the ASC by definition — the same derivation the
    // clinical form now uses, rather than the blank this used to store.
    location: locationForKind('procedure'),
    // The form owns the status now. On a new booking the field already reads
    // Scheduled; on an edit it opens on whatever the booking is at.
    status: field('qStatus').value || 'Scheduled',
    reason: reasonFrom(field('qReason').value, field('qIndication').value),
    /* Typed on the form now, and stored on the same key the clinical set uses
       — three screens fall back to `area` when a booking has no location. */
    area: field('qRoom').value.trim(),
    notes: field('qNotes').value.trim(),
    /*
     * Referring Clinician is no longer asked on this form: who is owed the
     * report is a directory fact, maintained where referrals are. The KEY
     * stays, carrying whatever an edited booking already held, so reopening a
     * case booked before this change does not quietly drop the referrers
     * somebody recorded on it.
     */
    referrers: editingId ? appointments.find((a) => a.id === editingId)?.referrers ?? [] : [],
    staff: field('qStaff').values,
    equipment: [],
    waitList: false,
  };

  const patient = patientOf(record.mrn);
  if (editingId) {
    Object.assign(appointments.find((a) => a.id === editingId), record);
    notify(`Procedure for ${patient.name} updated.`);
  } else {
    appointments.push({ id: `ap${nextId++}`, ...record });
    notify(
      `${record.status} — ${procedureById(record.procedureId).title} for ${patient.name} on ${longDate(
        record.date
      )} at ${displayTime(record.start)}.`
    );
  }

  state.anchor = record.date;
  setField('fDate', record.date);
  document.getElementById('apptModal').close();
  paint();
}

function openAppointment(appt, trigger) {
  const modal = document.getElementById('apptModal');
  if (!modal) return;
  editingId = appt?.id ?? null;
  kind = appt ? kindOf(appt) : 'clinical';
  /* Before anything is written into the form, because the last dialog may
     have left the Provider control parked off it — see syncProviderField().
     applyKind() calls this again at the end of the fill; running it twice
     costs nothing and running it once, late, would mean setField() reaching
     for a control that is not in the document yet. */
  syncProviderField();

  /* The heading is not touched. Booking and editing are the same form doing
     the same job — the only difference is whether the fields arrive empty —
     and re-titling the dialog per case made them look like two features, one
     of which put the patient's name in the title bar of a form whose first
     field is that patient. `heading="Appointment"` in the markup covers both.
     See the note above the dialog in scheduler.html. */

  // Filling the form is wrapped so that a failure in one panel cannot stop the
  // dialog from opening. A half-populated form you can see and correct beats a
  // button that looks broken because nothing happened. It fails quietly: the
  // banner that used to be raised here told the desk to reload a form that is
  // usually complete enough to work in, and it was the first thing on screen
  // in a dialog they had just opened to book someone. The console still gets
  // the error.
  try {
    // A new booking inherits the filter bar: if you are looking at one
    // provider's Tuesday, that is almost always what you are booking into.
    setField('mPatient', appt?.mrn ?? '');
    setField('mType', appt?.typeId ?? state.typeId);
    setField('mDate', appt?.date ?? state.anchor);
    // A new booking starts with no time: it is picked from the open slots, so
    // there is nothing sensible to guess and no field left to correct a guess
    // in. An existing one keeps the time it was booked at.
    startTime = appt?.start ?? '';
    // Guarded: on an infusion there is no Provider control to write into,
    // and there is no answer to write — the unit names somebody at check-in.
    if (field('mProvider')) setField('mProvider', appt?.providerId ?? soleProvider() ?? '');
    // The one reason string, split back into the two fields that write it: the
    // typed complaint and the coded indications.
    setField('mReason', textFromReason(appt?.reason));
    setField('mIndication', codesFromReason(appt?.reason));
    setField('mMode', appt?.mode ?? 'In person');
    setField('mRoom', appt?.area ?? '');
    field('mWaitList').checked = Boolean(appt?.waitList);
    setField('mWaitFrom', appt?.waitFrom ?? '');
    setField('mWaitTo', appt?.waitTo ?? '');
    syncWaitlistOption();
    syncWaitlistRange();

    setResources(appt);
    paintPatientPanels();

    ['mPatient', 'mType', 'mDate', 'mProvider'].forEach((id) =>
      field(id)?.removeAttribute('error')
    );

    fillProcedure(appt);
    applyKind();
    renderSlots();
  } catch (error) {
    console.error('Appointment form could not be filled in fully.', error);
  }

  modal.open(trigger);
}

/** What the form currently describes, whether or not it is complete. */
function draft() {
  return {
    // Clinical and Infusion share this form, so the booking has to say which
    // one it is — the activity alone cannot tell them apart.
    kind,
    mrn: field('mPatient').value,
    typeId: field('mType').value,
    date: field('mDate').value,
    start: startTime,
    // Empty on an infusion: the control is not on the form to answer, and
    // the unit names somebody at check-in instead.
    providerId: field('mProvider')?.value ?? '',
    coProviders: [],
    // Not asked for: derived from the care type. See KIND_LOCATIONS.
    location: locationForKind(kind),
    // Status is no longer asked for: a new booking is Scheduled, and an
    // existing one keeps whatever the day has done to it. It is changed from
    // the row menu, which is where it actually gets changed — the desk marks
    // someone checked in at the desk, not by reopening the booking form.
    status: editingId
      ? appointments.find((a) => a.id === editingId)?.status ?? 'Scheduled'
      : 'Scheduled',
    reason: reasonFrom(field('mReason').value, field('mIndication').value),
    /* Coming in or dialling in. Read off the field rather than sniffed out of
       the activity's title, which is what every screen printing a mode used to
       do — "Virtual Follow Patient" happened to contain the word, and a
       telehealth consultation booked under any other type did not. */
    mode: field('mMode')?.value || 'In person',
    waitList: field('mWaitList').checked,
    /* The window a waiting patient can be offered. Only meaningful while the
       box above is ticked, and cleared with it, so a booking that came off the
       wait list does not carry a stale pair of dates around for ever. */
    waitFrom: field('mWaitList').checked ? field('mWaitFrom')?.value || '' : '',
    waitTo: field('mWaitList').checked ? field('mWaitTo')?.value || '' : '',
    /*
     * The room, typed rather than picked (RM-025 reversed). The exam rooms and
     * infusion bays are handed out by whoever is running the floor, and what
     * they hand out is a number rather than an entry in a catalogue — so the
     * field takes whatever the desk was told.
     *
     * Still stored on `area`, which is the key three screens already read: the
     * encounter header, the visit facility line and the chart's appointment
     * table all fall back to it when a booking carries no `location`.
     */
    area: field('mRoom')?.value.trim() ?? '',
    staff: chosenResources('staff'),
    /*
     * Referring Physicians is no longer asked here either — the same call the
     * procedure form made. The KEY stays, carrying whatever an edited booking
     * already held, so reopening a visit booked before this change does not
     * quietly drop the referrers somebody recorded on it.
     */
    referrers: editingId ? appointments.find((a) => a.id === editingId)?.referrers ?? [] : [],
    // No instruments on a clinic booking — the field is not on the form to
    // answer. Kept as a key so the record shape is the same either side of a
    // care-type switch and nothing downstream has to test for its absence.
    equipment: [],
  };
}

/*
 * Reports float; conditions stay put.
 *
 * This used to write a <ui-alert> into a strip at the top of the screen —
 * a banner that pushed the work down the page to say something that had
 * already finished, and then sat there until the next one replaced it.
 * <ui-toast> in the shared top-right region is the component for that
 * (js/lib/toast.js): it reports, it stacks, and it goes.
 *
 * `severity` is kept as the argument name at every call site; the toast
 * library takes the same words.
 */
function notify(message, severity = 'success') {
  toast(message, severity);
}

/*
 * The same, from inside the dialog.
 *
 * It used to lay a <ui-alert> into the top of the form, because the toast
 * region was assumed to be under the dialog. It is not: --z-toast is above
 * --z-modal, and the modal is a positioned element rather than a top-layer
 * <dialog>, so the report lands over the corner of the sheet like every other
 * report in the product. One channel, and the form no longer grows a band
 * that shunts the field somebody is filling in.
 */
function notifyInForm(message, severity = 'success') {
  toast(message, severity);
}

/**
 * A TICKED BOX NOW PUTS SOMEBODY ON THE QUEUE.
 *
 * "Add to wait list" used to set a flag that drew a chip on the row and did
 * nothing else — the wait list itself was only ever filled from its own Add
 * button. That button has gone (a standing request is discovered in the
 * booking form, at the moment none of the offered times will do), so the
 * checkbox has to be what it has always said it is: the way onto the queue.
 *
 * The booking is still made. Being on the list is not an alternative to having
 * an appointment — it is "I have taken the 3rd, but ring me if something opens
 * sooner", which is the request a wait list exists to hold.
 *
 * The entry is tied to the booking by `waitlistId` so that editing is editing
 * rather than adding: re-saving a booking already on the queue updates the
 * entry in place, keeping its id and the date it joined — which is what the
 * queue is ordered by — and un-ticking the box takes it off again. Without the
 * link, every save of the same booking would put the patient on the list one
 * more time.
 */
function syncWaitlistEntryFor(appt) {
  const existing = appt.waitlistId ? waitlistById(appt.waitlistId) : null;

  if (!appt.waitList) {
    if (existing) removeFromWaitlist(existing.id);
    appt.waitlistId = '';
    return null;
  }

  const values = {
    mrn: appt.mrn,
    activity: appt.typeId,
    providerId: appt.providerId,
    location: appt.location,
    /* The window the form asked for. A booking whose box was ticked before the
       range existed falls back to its own date, which is the honest reading of
       "sooner than this if anything opens". */
    from: appt.waitFrom || appt.date,
    to: appt.waitTo || appt.waitFrom || appt.date,
    start: '',
    end: '',
    days: [],
    slotDate: '',
    slotStart: '',
    priority: 'routine',
    // The typed complaint, not the coded half: this is what the desk reads out
    // when it rings to offer a slot.
    note: textFromReason(appt.reason),
  };

  const entry = existing ? updateWaitlistEntry(existing.id, values) : addToWaitlist(values);
  appt.waitlistId = entry.id;
  return entry;
}

function save() {
  // Each field set owns its own save.
  if (kind === 'procedure') {
    saveProcedure();
    return;
  }

  const form = draft();

  // Required fields, flagged on the control that is missing.
  const required = {
    mPatient: [form.mrn, 'Choose a patient'],
    mType: [form.typeId, 'Choose an activity'],
    // Not on an infusion, where the control is not on the form to answer.
    ...(kind === 'infusion' ? {} : { mProvider: [form.providerId, 'Choose a provider'] }),
  };
  let valid = true;
  for (const [id, [value, message]] of Object.entries(required)) {
    if (value) field(id).removeAttribute('error');
    else {
      field(id).setAttribute('error', message);
      valid = false;
    }
  }

  /* NEITHER HALF OF "WHEN" IS A FIELD THAT CAN CARRY AN ERROR.
     The day is a month grid and the time is a row of buttons, so a missing
     answer is rung on the panel that holds them both and said once in the
     form's notice bar. The old sentence pointed at "the open slots under
     Providers" — a block that has not existed since the provider became a
     field on the grid above. */
  const when = field('mWhen');
  if (!form.date || !form.start) {
    when?.classList.add('appt__when--error');
    notifyInForm(
      form.date ? 'Pick a time from the open slots.' : 'Pick a day and a time.',
      'warning'
    );
    valid = false;
  } else {
    when?.classList.remove('appt__when--error');
  }

  if (!valid) return;

  const patient = patientOf(form.mrn);
  let saved;
  if (editingId) {
    const existing = appointments.find((a) => a.id === editingId);
    Object.assign(existing, form);
    saved = existing;
    notify(`Appointment for ${patient.name} updated.`);
  } else {
    saved = { id: `ap${nextId++}`, ...form };
    appointments.push(saved);
    /* An infusion has no clinician to name, so the sentence does not pretend
       to one. "with undefined" is how a booking confirmation loses the desk's
       trust in every other line it prints. */
    const withWhom = form.providerId ? ` with ${providerById(form.providerId).name}` : '';
    notify(
      `${form.status} — ${patient.name}${withWhom} on ${longDate(form.date)} at ${displayTime(
        form.start
      )}.`
    );
  }

  /*
   * A wait-list booking comes off the list HERE, not when it was picked.
   * Abandoning the form half way has to leave the patient exactly where they
   * were — still waiting — so the entry survives everything up to the save.
   */
  if (pendingWaitlistId) {
    removeFromWaitlist(pendingWaitlistId);
    pendingWaitlistId = null;
    notify(`${patient.name} booked from the wait list and removed from it.`);
  }

  /* And a booking whose box IS ticked joins the queue — or leaves it, if the
     box was cleared on this pass. Done after the wait-list removal above so
     that a patient booked off the list and immediately put back on it for a
     better slot ends up on it once, not twice. */
  const queued = syncWaitlistEntryFor(saved);
  if (queued) {
    notify(`${patient.name} added to the wait list for a sooner slot.`, 'info');
  }

  // Follow the booking, so a save outside the current period is not invisible.
  state.anchor = form.date;
  setField('fDate', form.date);

  document.getElementById('apptModal').close();
  paint();
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  writePalette();
  fillPickers();

  /* --- Tabs: Appointments / Encounters ---
     ?tab=visit-notes opens straight on the Encounters worklist, so coming
     back from a note lands where you left rather than on the schedule. */
  const wanted = new URLSearchParams(window.location.search).get('tab');
  if (wanted === 'visit-notes' || wanted === 'appointments') {
    state.tab = wanted;
    field('schTabs').setAttribute('selected', wanted);
  }

  field('schTabs').addEventListener('ui-change', (event) => {
    state.tab = event.detail.value;
    resetPage();
    paint();
  });
  field('vnTabs').addEventListener('ui-change', (event) => {
    state.noteTab = event.detail.value;
    // Only the print header and the footing change, but both are written by
    // paint(), and repainting two short tables costs less than a second path.
    paint();
  });

  /* --- Filter rail --- */
  field('railToggle').addEventListener('click', () => {
    state.railOpen = !state.railOpen;
    applyRail();
  });
  applyRail();

  /* The list's footer. `sch` prefixed test ids so the pager reads as this
     screen's, matching every other paged table in the product. */
  pager = createPager(document.getElementById('foot'), {
    testidPrefix: 'sch',
    noun: 'appointments',
    onChange: () => paint(),
  });

  wireProviderFilter();
  field('fLocation').optionList = LOCATIONS.map((l) => ({ value: l, label: l }));
  field('fType').optionList = activeAppointmentTypes().map((t) => ({
    value: t.id,
    label: t.title,
  }));
  setField('fDate', state.anchor);

  field('fLocation').addEventListener('ui-change', (event) => {
    state.location = event.detail.value;
    resetPage();
    paint();
  });
  field('fType').addEventListener('ui-change', (event) => {
    state.typeId = event.detail.value;
    resetPage();
    paint();
  });
  field('fKind').optionList = Object.entries(KIND_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  field('fKind').addEventListener('ui-change', (event) => {
    state.kind = event.detail.value;
    resetPage();
    paint();
  });
  field('fDate').addEventListener('ui-change', (event) => {
    if (!event.detail.value) return;
    state.anchor = event.detail.value;
    resetPage();
    paint();
  });
  /* Day / Week / Month. The buttons carry no state of their own — the
     pressed one is written back from paintAppointments(), so a period changed
     from anywhere else (opening a day out of the month grid, say) lights the
     right one without that caller having to know the strip exists. */
  document.querySelectorAll('[data-range]').forEach((button) =>
    button.addEventListener('click', () => {
      state.range = button.dataset.range;
      resetPage();
      paint();
    })
  );

  /*
   * Print what is on screen.
   *
   * No separate print view: the schedule the desk is looking at — this view,
   * this period, these filters — is the one they mean to hand over. The print
   * stylesheet strips the chrome and lets the list run past one screenful.
   */
  window.addEventListener('beforeprint', () => {
    printingEverything = true;
    paint();
  });
  window.addEventListener('afterprint', () => {
    printingEverything = false;
    paint();
  });

  field('printSchedule').addEventListener('ui-click', () => {
    if (state.view === 'calendar' && state.range === 'month') {
      notify('Printing the month grid. The list view prints one row per appointment.', 'info');
    }
    window.print();
  });

  document.querySelector('[data-testid="sch--clear"]').addEventListener('ui-click', () => {
    state.providerIds.clear();
    state.location = '';
    state.typeId = '';
    state.kind = '';
    state.query = '';
    state.anchor = TODAY;
    setField('fProvider', '');
    setField('fLocation', '');
    setField('fType', '');
    setField('fKind', '');
    setField('fDate', TODAY);
    setValue(document.querySelector('[data-testid="sch--search"]'), '');
    resetPage();
    paint();
  });

  document
    .querySelector('[data-testid="sch--search"]')
    .addEventListener('ui-input', (event) => {
      state.query = event.detail.value;
      resetPage();
      paint();
    });

  /* --- Period navigation --- */
  const step = (direction) => {
    if (state.range === 'day') state.anchor = addDays(state.anchor, direction);
    else if (state.range === 'week') state.anchor = addDays(state.anchor, direction * 7);
    else state.anchor = addMonths(state.anchor, direction);
    setField('fDate', state.anchor);
    resetPage();
    paint();
  };
  document
    .querySelector('[data-testid="sch--prev"]')
    .addEventListener('ui-click', () => step(-1));
  document
    .querySelector('[data-testid="sch--next"]')
    .addEventListener('ui-click', () => step(1));
  document.querySelector('[data-testid="sch--today"]').addEventListener('ui-click', () => {
    state.anchor = TODAY;
    setField('fDate', TODAY);
    resetPage();
    paint();
  });

  /* --- View switch --- */
  document.querySelectorAll('[data-view]').forEach((button) =>
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      paint();
    })
  );

  /* --- The Schedule Appointment menu ---
     Two ways to start a visit: book a slot for later, or take the patient at
     the desk straight into an encounter. The menu and the instant dialog live
     in scheduler-instant.js; creating the appointment stays here, because this
     is the module that owns the list and its ids. */
  initScheduleActions({
    onNew: (trigger) => openAppointment(null, trigger),

    createAppointment: (record) => {
      const created = { id: `ap${nextId++}`, ...record };
      appointments.push(created);
      // Written now, not at the next paint(): the encounter screen is a fresh
      // page load and reads the store before this one gets to repaint.
      saveAppointments(appointments);
      return created;
    },

    // Only when the schedule is showing exactly one provider. Two or none is
    // not a default, it is a guess.
    defaultProviderId: () =>
      state.providerIds.size === 1 ? [...state.providerIds][0] : '',
  });

  // Wired once, at start-up, while every control is still on the form. The
  // Provider control keeps this listener while it is parked off the document
  // for an infusion, because it is the same element that goes back.
  ['mType', 'mDate', 'mProvider'].forEach((id) =>
    field(id).addEventListener('ui-change', renderSlots)
  );
  // The activity decides whether a wait list applies at all — see
  // syncWaitlistOption().
  field('mType').addEventListener('ui-change', syncWaitlistOption);
  // And ticking the box is what puts the date window on the form — see
  // syncWaitlistRange().
  field('mWaitList').addEventListener('ui-change', syncWaitlistRange);

  /* --- Check eligibility, on both field sets --- */
  field('mCheckElig').addEventListener('ui-click', () => runEligibilityCheck('m'));
  field('qCheckElig').addEventListener('ui-click', () => runEligibilityCheck('q'));
  field('mPatient').addEventListener('ui-change', paintPatientPanels);
  field('qPatient').addEventListener('ui-change', paintPatientPanels);

  /* --- Appointment kind --- */
  field('mKind').addEventListener('ui-change', (event) => {
    kind = event.detail.value.toLowerCase();
    applyKind();
  });
  /* Ticking or unticking a procedure rewrites the booked length. Registered
     before the shared handler below so the new number is in the box before the
     slot search reads it — though the search asks procedureMinutes() rather
     than the box, so the order is belt and braces rather than load-bearing. */
  field('qProcedure').addEventListener('ui-change', syncProcedureDuration);

  /* Duration is not in this list any more. It is disabled and written to, so
     it has no user change to listen for — and the length it holds is derived
     from the procedures, which are. */
  ['qProcedure', 'qDate', 'qDoctor'].forEach((id) =>
    field(id).addEventListener('ui-change', renderProcedureSlots)
  );
  /* --- Appointment details drawer --- */
  const detailsModal = document.getElementById('startModal');
  const viewed = () => appointments.find((a) => a.id === viewingId);

  field('dClose').addEventListener('ui-click', () => detailsModal.close());
  field('dEdit').addEventListener('ui-click', (event) => {
    const appt = viewed();
    detailsModal.close();
    openAppointment(appt, event.target);
  });
  /* Where the button goes is decided by checkInStep(), against the booking as
     it stands at the moment it is pressed rather than as it stood when the
     drawer opened — the status select sitting up beside the patient's name is
     there precisely so it can be changed first, and a footer routing on a
     stale reading of it would send the desk somewhere it had just corrected. */
  field('dCheckIn').addEventListener('ui-click', () => {
    const appt = viewed();
    if (appt) checkInStep(appt).go(detailsModal);
  });

  /* --- Triage drawer ---------------------------------------------------
     The innerHTML of each of the three surfaces is rebuilt on every open
     (renderTriageBody and the two window renderers), but the containers
     themselves never are — delegated listeners registered here keep working
     across every open, the same reason row-menu actions are matched by
     data-action rather than rebound per render.

     Registered on all three rather than on the drawer alone, because the two
     windows are dialogs parented to <body>: an event raised in the vitals
     grid does not pass through #triageBody on its way up any more. Every
     branch below is guarded by a closest() that only one surface can match,
     so the same handler on all three is three cheap misses, not three
     answers. */
  field('triageDraft').addEventListener('ui-click', () => saveTriage(false));
  field('triageComplete').addEventListener('ui-click', () => saveTriage(true));

  field('triageVitalsCancel').addEventListener('ui-click', cancelTriageVitals);
  field('triageVitalsSave').addEventListener('ui-click', closeTriageVitals);
  field('triageMedDone').addEventListener('ui-click', () => {
    document.getElementById('triageMedModal').close();
    refreshTriage();
  });

  triageSurfaces().forEach(wireTriageSurface);

  /* --- Wait list --- */
  // Wrapped, not passed straight through: ui-click hands the listener an
  // event, and openWaitlistForm's first parameter is the id to edit.
  field('wlCancel').addEventListener('ui-click', () => {
    wlEditingId = null;
    document.getElementById('wlModal').close();
  });
  field('wlSave').addEventListener('ui-click', saveWaitlistEntry);
  field('wlUpdate').addEventListener('ui-click', saveWaitlistEntry);
  field('wlPatient').addEventListener('ui-change', (event) => {
    field('wlPatient').removeAttribute('error');
    paintWaitlistFacts(event.detail.value);
  });

  /* The availability half of the form recaps itself as it is filled in, so
     every control that feeds the sentence has to say when it changes. ui-input
     fires on each keystroke and ui-change on commit — a date box emits both,
     and painting a line of text twice costs nothing, where missing one leaves
     the recap contradicting the field above it. */
  ['wlFrom', 'wlTo', 'wlStart', 'wlEnd'].forEach((id) => {
    const el = field(id);
    ['ui-input', 'ui-change'].forEach((event) =>
      el.addEventListener(event, () => {
        el.removeAttribute('error');
        /* A slot chosen under the old window is not a slot inside the new
           one, so it goes the moment either end of the window moves. Letting
           it stand would save a request holding a time outside its own
           availability — the one contradiction this panel exists to prevent. */
        wlSlot = null;
        renderWaitlistSlots();
        paintWaitlistRecap();
      })
    );
  });

  /* The slot list is cut from the provider's hours at the activity's length,
     so both of those change what is on offer as surely as the window does. */
  ['wlActivity', 'wlProvider'].forEach((id) =>
    field(id).addEventListener('ui-change', () => {
      field(id).removeAttribute('error');
      wlSlot = null;
      renderWaitlistSlots();
      paintWaitlistRecap();
    })
  );

  /* --- The calendar's booking choice --- */
  field('choiceNew').addEventListener('click', () => {
    document.getElementById('bookChoiceModal').close();
    state.anchor = choiceDate;
    setField('fDate', choiceDate);
    pendingWaitlistId = null;
    openAppointment(null);
    setField('mDate', choiceDate);
    renderSlots();
  });
  field('choiceWait').addEventListener('click', () => {
    document.getElementById('bookChoiceModal').close();
    openWaitlistPicker();
  });
  field('choiceOpen').addEventListener('click', () => {
    document.getElementById('bookChoiceModal').close();
    openDay(choiceDate);
  });
  field('choiceCancel').addEventListener('ui-click', () =>
    document.getElementById('bookChoiceModal').close()
  );
  field('wlPickCancel').addEventListener('ui-click', () =>
    document.getElementById('wlPickModal').close()
  );

  /* Save and Close, and nothing else — the form has no third button to wire
     now that cancelling a booking is a status change made from the row menu
     rather than a red button inside the edit form. */
  field('mSave').addEventListener('ui-click', save);
  field('mClose').addEventListener('ui-click', () =>
    document.getElementById('apptModal').close()
  );

  /* --- gEstimator. Changing the plan re-runs the sum in place: the whole
         point of one dialog is that the desk can compare two plans without
         leaving it. --- */
  field('estPlan').addEventListener('ui-change', paintEstimate);
  field('estClose').addEventListener('ui-click', () =>
    document.getElementById('estimateModal').close()
  );
  field('estPrint').addEventListener('ui-click', () => window.print());

  paint();
});
