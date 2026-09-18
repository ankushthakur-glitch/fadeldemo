/**
 * Schedule workspace — a rebuild of staging.medinovagastro.com/schedule.
 *
 * The layout, wording and control set follow that page: a Day View listing
 * appointments as cards with procedure pills and an indication line, a Week
 * View time grid from 6 AM to 8 PM, and a "Schedule New Procedure" dialog.
 *
 * It reads the same demo data as the rest of the prototype (data/schedule.js),
 * so a booking made here is the same record the other scheduler screen shows.
 * Where the reference's vocabulary differs from ours the mapping is:
 *
 *   reference          here
 *   Procedure Type  →  appointment type (Settings → Appointment)
 *   Doctor          →  provider
 *   Indication      →  the appointment's reason for visit
 *   Referring       →  referring physician resource
 *
 * NO INLINE STYLES: week-grid geometry is written to a generated stylesheet,
 * the same approach the other calendar uses.
 */
import {
  APPOINTMENTS,
  PROVIDERS,
  activeAppointmentTypes,
  STATUS_COLOURS,
  REFERRING_PHYSICIANS,
  TODAY,
  providerById,
  typeById,
  referrerById,
  durationOf,
  toMinutes,
  span,
} from '../../data/schedule.js';
import { DIRECTORY } from '../../data/directory.js';

/* ===================== Constants ===================== */

/** The visible span of the week grid, in minutes. 6:00 AM → 8:00 PM. */
const GRID_START = 6 * 60;
const GRID_END = 20 * 60;
const SLOT = 30;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** Statuses that mean the visit is finished, and ones that mean it is off. */
const COMPLETED = ['Check Out'];
const DEAD = ['Cancelled', 'No Show', 'Declined'];

/* ===================== Helpers ===================== */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const el = (id) => document.getElementById(id);

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

/** Monday of the week containing `iso`. */
function startOfWeek(iso) {
  const date = parseISO(iso);
  return addDays(iso, -((date.getDay() + 6) % 7));
}

/** "2026-08-03" → "Monday, August 3, 2026" — the reference's date heading. */
function longDate(iso) {
  const date = parseISO(iso);
  return `${DAY_NAMES[(date.getDay() + 6) % 7]}, ${
    MONTHS[date.getMonth()]
  } ${date.getDate()}, ${date.getFullYear()}`;
}

/** "2026-08-03" → "Aug 3" */
const shortDate = (iso) => {
  const date = parseISO(iso);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
};

/** 450 → "7:30". The reference drops the leading zero on the hour. */
function clockTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 450 → "7:30 AM", used down the week grid's gutter. */
function meridiemTime(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

const initials = (name) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

/** Providers are people; the reference addresses them by surname. */
const doctorName = (providerId) => {
  const provider = providerById(providerId);
  if (!provider) return '';
  return `Dr. ${provider.name.split(' ').slice(-1)[0]}`;
};

/* ===================== State ===================== */

let appointments = APPOINTMENTS.map((a) => ({ ...a }));
let nextId = appointments.length + 1;

const state = {
  view: 'day',
  date: TODAY,
  query: '',
  status: '',
  doctor: '',
  weekends: false,
};

const PATIENTS = new Map(DIRECTORY.map((p) => [p.mrn, p]));
const patientOf = (mrn) => PATIENTS.get(mrn) ?? { name: 'Unknown patient', mrn };

/* ===================== Generated geometry ===================== */

function geometrySheet() {
  let sheet = el('dgiGeometry');
  if (!sheet) {
    sheet = document.createElement('style');
    sheet.id = 'dgiGeometry';
    document.head.appendChild(sheet);
  }
  return sheet;
}

/* ===================== Filtering ===================== */

function matches(appt) {
  if (state.status && appt.status !== state.status) return false;
  if (state.doctor && appt.providerId !== state.doctor) return false;
  if (state.query) {
    const patient = patientOf(appt.mrn);
    const hay = `${patient.name} ${appt.mrn} ${appt.reason}`.toLowerCase();
    if (!hay.includes(state.query.toLowerCase())) return false;
  }
  return true;
}

const onDate = (iso) =>
  appointments
    .filter((a) => a.date === iso && matches(a))
    .sort((a, b) => a.start.localeCompare(b.start));

/* ===================== Day view ===================== */

function apptCard(appt) {
  const patient = patientOf(appt.mrn);
  const type = typeById(appt.typeId);
  const combo = appt.combo ? typeById(appt.combo) : null;
  const referrer = appt.referrers?.[0] ? referrerById(appt.referrers[0]) : null;

  return `<button type="button" class="dgi__appt" data-appt="${appt.id}"
    data-testid="dgi--appt-${appt.id}">
    <span class="dgi__appt-time">${clockTime(toMinutes(appt.start))}</span>
    <span class="dgi__appt-avatar" aria-hidden="true">${esc(initials(patient.name))}</span>

    <span class="dgi__appt-body">
      <span class="dgi__appt-head">
        <span class="dgi__appt-name">${esc(patient.name)}</span>
        <span class="dgi__pill dgi__pill--procedure">${esc(type?.title ?? '')}</span>
        ${combo ? `<span class="dgi__pill dgi__pill--combo">${esc(combo.title)}</span>` : ''}
      </span>
      <span class="dgi__appt-meta">
        <span>${esc(doctorName(appt.providerId))}</span>
        <span>Duration: ${durationOf(appt.typeId, appt.providerId)} min</span>
      </span>
      <span class="dgi__appt-indication">
        <strong>Indication:</strong> ${esc(appt.reason)}
      </span>
      ${
        referrer
          ? `<span class="dgi__appt-referring">Referring: ${esc(
              referrer.name.replace(/^Dr\.\s*/, '')
            )}</span>`
          : ''
      }
    </span>

    <span class="dgi__appt-side">
      <span class="dgi__pill dgi__pill--status">${esc(appt.status.toLowerCase())}</span>
      <span class="dgi__icon-btn" aria-hidden="true">
        <svg class="ui-icon"><use href="#i-more-horizontal"></use></svg>
      </span>
    </span>
  </button>`;
}

function paintDay() {
  const rows = onDate(state.date);

  el('dayView').querySelector('[data-testid="dgi--date"]').textContent = longDate(state.date);
  el('dayTodayPill').hidden = state.date !== TODAY;

  const list = el('dayList');
  list.innerHTML = rows.length
    ? rows.map(apptCard).join('')
    : '<p class="dgi__empty">No appointments scheduled for this date</p>';

  list.querySelectorAll('[data-appt]').forEach((button) =>
    button.addEventListener('click', () =>
      openDialog(appointments.find((a) => a.id === button.dataset.appt), button)
    )
  );

  const q = (name) => document.querySelector(`[data-testid="dgi--stat-${name}"]`);
  q('total').textContent = String(rows.length);
  q('completed').textContent = String(rows.filter((a) => COMPLETED.includes(a.status)).length);
  q('upcoming').textContent = String(
    rows.filter((a) => !COMPLETED.includes(a.status) && !DEAD.includes(a.status)).length
  );
}

/* ===================== Week view ===================== */

/**
 * Split a day's appointments into side-by-side lanes.
 *
 * Blocks that touch form a cluster; the cluster is as wide as the most
 * simultaneous appointments in it, and each block takes the first free lane.
 */
function laneLayout(dayAppointments) {
  const items = dayAppointments
    .map((appt) => ({ appt, ...span(appt) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed = [];
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
    cluster.forEach((item) => placed.push({ ...item, lanes: laneEnds.length }));
    cluster = [];
  };

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

function paintWeek() {
  const from = startOfWeek(state.date);
  const dayCount = state.weekends ? 7 : 5;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));

  el('weekRange').textContent = `${shortDate(from)} - ${shortDate(addDays(from, 6))}, ${parseISO(
    from
  ).getFullYear()}`;

  const heads = days
    .map((iso, index) => {
      const isToday = iso === TODAY;
      return `<div class="dgi__grid-day${isToday ? ' dgi__grid-day--today' : ''}">
        <span class="dgi__grid-dow">${DAY_NAMES[index].slice(0, 3)}</span>
        <span class="dgi__grid-dom">${parseISO(iso).getDate()}</span>
        ${isToday ? '<span class="dgi__today-pill">Today</span>' : ''}
      </div>`;
    })
    .join('');

  const hours = [];
  for (let minute = GRID_START; minute < GRID_END; minute += SLOT) {
    hours.push(`<div class="dgi__hour">${meridiemTime(minute)}</div>`);
  }

  const geometry = [];
  const columns = days
    .map((iso) => {
      const events = laneLayout(onDate(iso))
        .map(({ appt, lane, lanes }) => {
          const { start, end } = span(appt);
          const top = Math.max(start, GRID_START) - GRID_START;
          const length = Math.min(end, GRID_END) - Math.max(start, GRID_START);
          if (length <= 0) return '';

          geometry.push(
            `[data-event="${appt.id}"]{--dgi-top:${top};--dgi-len:${length};` +
              `--dgi-lane:${lane};--dgi-lanes:${lanes};}`
          );

          const patient = patientOf(appt.mrn);
          const type = typeById(appt.typeId);
          return `<button type="button" class="dgi__event" data-event="${appt.id}"
            data-appt="${appt.id}" title="${esc(patient.name)} — ${esc(type?.title ?? '')}">
            <span class="dgi__event-name">${esc(patient.name.split(' ').slice(-1)[0])}</span>
            <span class="dgi__event-proc">${esc(type?.title ?? '')}</span>
            <span class="dgi__event-menu" aria-hidden="true">
              <svg class="ui-icon"><use href="#i-more-horizontal"></use></svg>
            </span>
          </button>`;
        })
        .join('');
      return `<div class="dgi__col">${events}</div>`;
    })
    .join('');

  el('weekGrid').innerHTML = `
    <div class="dgi__grid-head">
      <div class="dgi__grid-gutter">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-clock"></use></svg>
      </div>
      <div class="dgi__grid-cols">${heads}</div>
    </div>
    <div class="dgi__grid-scroll">
      <div class="dgi__grid-body">
        <div class="dgi__grid-gutter">${hours.join('')}</div>
        <div class="dgi__grid-cols">${columns}</div>
      </div>
    </div>`;

  geometrySheet().textContent = geometry.join('\n');

  el('weekGrid')
    .querySelectorAll('[data-appt]')
    .forEach((button) =>
      button.addEventListener('click', () =>
        openDialog(appointments.find((a) => a.id === button.dataset.appt), button)
      )
    );
}

/* ===================== Paint ===================== */

function paint() {
  el('dayView').hidden = state.view !== 'day';
  el('weekView').hidden = state.view !== 'week';
  document.querySelectorAll('[data-view]').forEach((tab) =>
    tab.setAttribute('aria-selected', String(tab.dataset.view === state.view))
  );

  document.querySelector('[data-testid="dgi--today"]').disabled = state.date === TODAY;

  if (state.view === 'day') paintDay();
  else paintWeek();
}

/* ===================== Dialog ===================== */

let editingId = null;

/**
 * `<option>` markup for a select, with a leading empty row — and the two
 * things that row can be.
 *
 * `options()` writes a PLACEHOLDER: "Select doctor", the question the field is
 * asking. It shows in the closed field and is `disabled hidden`, so it is not
 * a row in the list — picking it would answer nothing.
 *
 * `optionsWithEmpty()` writes an ANSWER: "All Statuses", "None — single
 * procedure only". Same empty value, but it is what a filter is put back to
 * and what an optional field is left as, so it stays in the list.
 */
function options(list, placeholder, selected) {
  return emptyRow(placeholder, selected, false) + rows(list, selected);
}

function optionsWithEmpty(list, label, selected) {
  return emptyRow(label, selected, true) + rows(list, selected);
}

function emptyRow(label, selected, pickable) {
  return `<option value=""${pickable ? '' : ' disabled hidden'}${
    selected ? '' : ' selected'
  }>${esc(label)}</option>`;
}

function rows(list, selected) {
  return list
    .map(
      (item) =>
        `<option value="${esc(item.value)}"${
          String(item.value) === String(selected ?? '') ? ' selected' : ''
        }>${esc(item.label)}</option>`
    )
    .join('');
}

function fillDialog(appt) {
  const patients = DIRECTORY.filter((p) => p.active).map((p) => ({
    value: p.mrn,
    label: `${p.name} · MRN ${p.mrn}`,
  }));
  // Only what the active practice profile offers — see data/appointments.js.
  const procedures = activeAppointmentTypes().map((t) => ({ value: t.id, label: t.title }));
  const doctors = PROVIDERS.map((p) => ({ value: p.id, label: `${p.name} — ${p.role}` }));
  const referrers = REFERRING_PHYSICIANS.map((r) => ({
    value: r.id,
    label: `${r.name} — ${r.practice}`,
  }));
  const statuses = STATUS_COLOURS.map((s) => ({ value: s.name, label: s.name }));

  el('pPatient').innerHTML = options(patients, 'Search patients by name, MRN...', appt?.mrn);
  el('pProcedure').innerHTML = options(procedures, 'Select procedure type', appt?.typeId);
  el('pCombo').innerHTML = optionsWithEmpty(procedures, 'None – single procedure only', appt?.combo);
  el('pDoctor').innerHTML = options(doctors, 'Select doctor', appt?.providerId);
  el('pReferring').innerHTML = options(
    referrers,
    'Search or type clinician name...',
    appt?.referrers?.[0]
  );
  el('pStatus').innerHTML = options(statuses, 'Select status', appt?.status ?? 'Scheduled');

  el('pIndication').value = appt?.reason ?? '';
  el('pDate').value = appt?.date ?? state.date;
  el('pTime').value = appt?.start ?? '';
  el('pDuration').value = appt ? durationOf(appt.typeId, appt.providerId) : 30;
  el('pRoom').value = appt?.area ?? '';
  el('pNotes').value = appt?.notes ?? '';

  ['pPatient', 'pProcedure', 'pDoctor', 'pDate', 'pTime'].forEach((id) =>
    el(id).removeAttribute('aria-invalid')
  );
}

function openDialog(appt, trigger) {
  const modal = el('procedureModal');
  editingId = appt?.id ?? null;
  modal.setAttribute(
    'heading',
    appt ? `Procedure — ${patientOf(appt.mrn).name}` : 'Schedule New Procedure'
  );
  fillDialog(appt);
  modal.open(trigger);
}

/** The duration box is free text in the reference, so a picked type seeds it —
 *  with the doctor's own length where the type names one for them, which is
 *  why the doctor box is read here as well as the procedure box. */
function syncDuration() {
  const type = typeById(el('pProcedure').value);
  if (type) el('pDuration').value = durationOf(type.id, el('pDoctor').value);
}

function save() {
  const mrn = el('pPatient').value;
  const typeId = el('pProcedure').value;
  const providerId = el('pDoctor').value;
  const date = el('pDate').value;
  const start = el('pTime').value;

  // The reference marks Patient, Procedure Type, Doctor, Date and Time
  // required; everything else is optional.
  const required = [
    ['pPatient', mrn], ['pProcedure', typeId], ['pDoctor', providerId],
    ['pDate', date], ['pTime', start],
  ];
  required.forEach(([id, value]) =>
    el(id).setAttribute('aria-invalid', value ? 'false' : 'true')
  );
  if (required.some(([, value]) => !value)) return;

  const record = {
    mrn,
    typeId,
    providerId,
    date,
    start,
    combo: el('pCombo').value || '',
    reason: el('pIndication').value.trim(),
    status: el('pStatus').value || 'Scheduled',
    area: el('pRoom').value.trim(),
    notes: el('pNotes').value.trim(),
    referrers: el('pReferring').value ? [el('pReferring').value] : [],
  };

  if (editingId) {
    Object.assign(appointments.find((a) => a.id === editingId), record);
  } else {
    appointments.push({
      id: `dgi${nextId++}`,
      location: '',
      waitList: false,
      staff: [],
      equipment: [],
      coProviders: [],
      ...record,
    });
  }

  state.date = date;
  el('procedureModal').close();
  paint();
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-modal').then(() => {
  /* --- Filters --- */
  el('fStatus').innerHTML = optionsWithEmpty(
    STATUS_COLOURS.map((s) => ({ value: s.name, label: s.name })),
    'All Statuses'
  );
  el('fDoctor').innerHTML = optionsWithEmpty(
    PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
    'All Doctors'
  );

  el('fStatus').addEventListener('change', (event) => {
    state.status = event.target.value;
    paint();
  });
  el('fDoctor').addEventListener('change', (event) => {
    state.doctor = event.target.value;
    paint();
  });
  el('fSearch').addEventListener('input', (event) => {
    state.query = event.target.value;
    paint();
  });

  /* --- View tabs --- */
  document.querySelectorAll('[data-view]').forEach((tab) =>
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      paint();
    })
  );

  /* --- Date stepping. The step size is on the button, so day and week
         navigation share one handler. --- */
  document.querySelectorAll('[data-step]').forEach((button) =>
    button.addEventListener('click', () => {
      state.date = addDays(state.date, Number(button.dataset.step));
      paint();
    })
  );

  const goToday = () => {
    state.date = TODAY;
    paint();
  };
  document.querySelector('[data-testid="dgi--today"]').addEventListener('click', goToday);
  document.querySelector('[data-testid="dgi--week-today"]').addEventListener('click', goToday);

  el('fWeekends').addEventListener('change', (event) => {
    state.weekends = event.target.checked;
    paint();
  });

  /* --- Dialog --- */
  document
    .querySelector('[data-testid="dgi--new"]')
    .addEventListener('click', (event) => openDialog(null, event.currentTarget));
  document
    .querySelector('[data-testid="dgi--week-new"]')
    .addEventListener('click', (event) => openDialog(null, event.currentTarget));

  el('pProcedure').addEventListener('change', syncDuration);
  // Changing the doctor can change the length too, for a type that gives them
  // one of their own.
  el('pDoctor').addEventListener('change', syncDuration);
  el('pSave').addEventListener('click', save);
  el('pCancel').addEventListener('click', () => el('procedureModal').close());

  /* --- Print --- */
  document
    .querySelector('[data-testid="dgi--print"]')
    .addEventListener('click', () => window.print());

  paint();
});
