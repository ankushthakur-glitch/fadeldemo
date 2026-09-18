/**
 * APPOINTMENTS — this patient's booked visits, upcoming and past.
 *
 * THE ONE THING THAT MATTERS ABOUT THIS MODULE
 * It does not have its own appointment data. It reads the shared booking
 * store — the same one the scheduler, check-in and the encounter write to —
 * filtered to this patient's MRN. A visit booked here appears on the
 * scheduler, and a visit checked in from the scheduler shows as Checked In
 * here, because there is only ever one copy of the booking. A demo list local
 * to the chart would have drifted from the schedule by the second click.
 *
 * That is also why the list is re-read from the store on every paint rather
 * than held in module state: another screen may have moved a booking on since
 * this panel was drawn.
 *
 * ctx only provides { patient, age, go, flash }. The Add Appointment modal is
 * this module's own, same contract as every other chart module.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import {
  activeAppointmentTypes,
  waitlistableAppointmentTypes,
  PROVIDERS,
  LOCATIONS,
  STAFF,
  STATUS_COLOURS,
  TODAY,
  providerById,
  providerLabel,
  typeById,
  procedureById,
  durationOf,
  PROCEDURE_TYPES,
  coverageFor,
  eligibilityFor,
  toMinutes,
  toTime,
  weekdayName,
  availabilityOn,
  blockedDuring,
} from '../../data/schedule.js';
/* The infusion unit is open when the practice is open — there is no
   provider's session to cut into chair times. See openChairSlots(). */
import { PRACTICE } from '../../data/practice.js';
import { icd10Label } from '../../data/icd10.js';
/* Ticking "Add to wait list" puts the patient on the queue the scheduler's
   wait list reads. A flag that drew a chip and did nothing else was the one
   part of that form the chart could not honestly copy. */
import { addToWaitlist } from '../../data/waitlist.js';
import { money } from '../../data/patient-balance.js';
import {
  loadAppointments,
  saveAppointments,
  updateAppointment,
} from '../../data/appointment-store.js';
import { notify as toast } from '../lib/toast.js';

/* ============================================================================
   SMALL HELPERS — kept local, the way every other chart module keeps its own.
   ========================================================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-09-18" → "18 Sep 2026", the format the scheduler uses. */
function longDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Number.isFinite(d) ? `${d} ${MONTHS_SHORT[m - 1]} ${y}` : String(iso ?? '');
}

/** "07:38" → "07:38 AM". */
function displayTime(value) {
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h)) return String(value ?? '');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

/*
 * Care type, derived the same way the scheduler derives it.
 *
 * Duplicated rather than imported: js/screens/scheduler.js owns a screen, not
 * a library, and a chart module importing from another screen's file would
 * couple the two. The rule is three lines and lives beside the data it reads.
 */
const INFUSION_TYPE = 'at12';

function kindOf(appt) {
  if (appt.kind) return appt.kind;
  if (appt.procedureId) return 'procedure';
  if (appt.typeId === INFUSION_TYPE) return 'infusion';
  return 'clinical';
}

/*
 * The kind's ink. Still the three tones the pill used to wear — it is only
 * the shape that changed; see typeCell() for why a dot replaced the pill.
 */
const KIND_TONES = { clinical: 'info', procedure: 'brand', infusion: 'warning' };

/*
 * Types this screen will not book.
 *
 * A scope list is not just a slot: it needs the procedure itself, a room and
 * the kit, and the scheduler's form is where those are chosen. Offering
 * "Procedure Visit" here would produce a booking that says procedure and
 * carries none of it — which every downstream screen would then read as an
 * ordinary clinic visit. Booking one stays where it belongs.
 */
const PROCEDURE_TYPE_IDS = ['at6', 'at15'];

/** What the booking is for: the procedure if there is one, else the type. */
function labelOf(appt) {
  return appt.procedureId
    ? procedureById(appt.procedureId)?.title ?? 'Procedure'
    : typeById(appt.typeId)?.title ?? 'Appointment';
}

function lengthOf(appt) {
  return appt.procedureId
    ? procedureById(appt.procedureId)?.duration ?? 30
    : durationOf(appt.typeId);
}

/*
 * Status tone.
 *
 * Grouped by what the desk does about it rather than by the status colours in
 * Settings: the palette there is for telling appointments apart on a calendar
 * grid, which is a different job from saying "this one needs attention".
 */
const STATUS_TONES = {
  Confirmed: 'success',
  'Checked In': 'success',
  'Check Out': 'success',
  Scheduled: 'info',
  'Pending Confirmation': 'warning',
  Triage: 'warning',
  Rescheduled: 'warning',
  'No Show': 'critical',
  Cancelled: 'critical',
  Declined: 'critical',
};

/** Statuses where the visit is over or abandoned, so there is nothing to start. */
const CLOSED_STATUSES = ['Cancelled', 'No Show', 'Declined', 'Check Out'];

/* ============================================================================
   COLUMNS
   ========================================================================= */

function providerCell(row) {
  const provider = providerById(row.providerId);
  return `<span class="apt__provider">
    <strong class="apt__provider-name">${esc(provider?.name ?? 'Unassigned')}</strong>
    <span class="apt__provider-role">${esc(provider?.role ?? '')}</span>
  </span>`;
}

/*
 * When, and for how long, in one cell.
 *
 * Duration had a column of its own, which gave a column heading and a ninth
 * of the table's width to a number that only ever qualifies the time beside
 * it — and pushed Reason and Location far enough right that the row's own
 * Start button fell off the end. Set under the time it modifies it costs no
 * width at all, and "09:00 AM · 30 min" is the sentence a reader was
 * assembling from two columns anyway.
 */
function whenCell(row) {
  return `<span class="apt__when">
    <strong class="apt__when-date">${esc(longDate(row.date))}</strong>
    <span class="apt__when-time">${esc(displayTime(row.start))} &middot; ${lengthOf(row)} min</span>
  </span>`;
}

/*
 * What the visit is — set as text, with the kind as a dot in front of it.
 *
 * It was a pill. Every row on this table has a type, so a type in a pill is
 * fifteen pills down one column, and the status column beside it is pills
 * too: two columns of the same object, neither of which is then scanned. The
 * type is the row's subject and belongs in the same plain ink as the reason
 * next to it. The dot keeps clinical, procedure and infusion separable at a
 * glance without spending the emphasis a status needs.
 */
function typeCell(row) {
  return `<span class="apt__type apt__type--${KIND_TONES[kindOf(row)]}"
    ><span class="apt__dot" aria-hidden="true"></span>${esc(labelOf(row))}</span>`;
}

/*
 * The settled statuses, and the ink each is set in.
 *
 * Confirmed or Scheduled is what nearly every row says. A filled pill on
 * every row is a table with no emphasis left to spend on the one row that is
 * a No Show, so the settled states are set as the status word in its own
 * colour behind a leading dot — still colour-coded, still findable by colour,
 * but flat against the row. Check Out is quiet for the opposite reason: the
 * visit is over and nothing is owed on it.
 *
 * Everything else keeps the badge. Pending Confirmation, Triage, Cancelled,
 * No Show are the rows the desk has to do something about, and they are now
 * the only rows on the table carrying a filled object.
 */
const STATUS_QUIET = {
  Confirmed: 'success',
  Scheduled: 'info',
  'Check Out': 'neutral',
};

function statusCell(row) {
  const quiet = STATUS_QUIET[row.status];
  if (quiet) {
    return `<span class="apt__status apt__status--${quiet}"
      ><span class="apt__dot" aria-hidden="true"></span>${esc(row.status)}</span>`;
  }
  return `<ui-badge status="${STATUS_TONES[row.status] ?? 'neutral'}" size="sm"
    >${esc(row.status)}</ui-badge>`;
}

/**
 * Start is only offered where it means something.
 *
 * A cancelled or no-show visit keeps the button in place but disabled, rather
 * than dropping it: a column that gains and loses controls row by row is
 * harder to scan than one where the same control is visibly unavailable.
 *
 * Outlined brand rather than outlined neutral. Starting the visit is the only
 * thing this row asks of the reader, and with the provider's name no longer
 * set in green it is the only brand-coloured object left in the row — so the
 * accent now marks the action instead of decorating a name.
 */
function startCell(row, past) {
  const closed = CLOSED_STATUSES.includes(row.status);
  const disabled = past || closed;
  return `<ui-button size="sm" variant="secondary" icon="play"
    data-apt-start="${esc(row.id)}" ${disabled ? 'disabled' : ''}>Start</ui-button>`;
}

function menuCell(row) {
  return `<button type="button" class="ui-row-menu-btn" data-apt-menu="${esc(row.id)}"
      aria-haspopup="menu" aria-expanded="false" aria-label="Appointment actions">
      ${icon('more-vertical')}
    </button>`;
}

/*
 * Column order is the order the row is read in: who, when, what, why, where,
 * and what state it is in. Location used to sit second, between the provider
 * and the date — which put the most-repeated value on the table, the same
 * clinic name over and over, in the second-most-looked-at position, and
 * pushed the date, the thing a schedule is actually read by, behind it.
 */
function columns(past) {
  return [
    { key: 'provider', label: 'Provider', wrap: true, render: providerCell },
    { key: 'when', label: 'Date & Time', render: whenCell },
    { key: 'type', label: 'Type', wrap: true, render: typeCell },
    /*
     * Reason and Location hold the flexible middle of the table — everything
     * else on the row (a name, a date, a status word, a button) is as wide as
     * it is. Both are capped on the cell's own content rather than by a width
     * on the column: in an auto-laid-out table a width on a <th> is a floor,
     * not a ceiling, so it cannot stop a column growing — a max-width on the
     * thing inside the cell can, because it caps what that column reports as
     * its widest value in the first place.
     *
     * Reason gets the bigger cap and truncates: it is the one column here
     * whose value is written fresh for this booking, so there is nothing in
     * it a reader could finish from its first few words.
     */
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => `<span class="apt__reason">${esc(row.reason) || '—'}</span>`,
    },
    /*
     * Location WRAPS rather than truncates, and it costs nothing to let it:
     * every row here is already two lines tall — the provider over their role,
     * the date over the time — so a clinic name breaking onto a second line
     * lands inside height the row had spent anyway.
     *
     * Truncating it was wrong twice over. Cut to a column narrow enough to
     * fit, "MediNova Gastroenterology — Fargo" and "MediNova Gastroenterology —
     * West Fargo" both come out as "MediNova Gastroenterolog…" — the ellipsis
     * eats the only word that says which site, and keeps the words that are
     * the same on nearly every row.
     */
    {
      key: 'location',
      label: 'Location',
      wrap: true,
      render: (row) => `<span class="apt__meta">${esc(row.area || row.location) || '—'}</span>`,
    },
    { key: 'status', label: 'Appointment Status', render: statusCell },
    { key: 'start', label: '<span class="u-sr-only">Start visit</span>', render: (row) => startCell(row, past) },
    {
      key: 'menu',
      label: '<span class="u-sr-only">Actions</span>',
      actions: true,
      render: menuCell,
    },
  ];
}

/* ============================================================================
   ADD APPOINTMENT

   THIS IS THE SCHEDULER'S OWN BOOKING FORM, MINUS THE PATIENT PICKER.

   It used to be a small dialog of its own: two typed boxes for the day and the
   time, a flat grid of pickers, and no idea whether the provider was free at
   the moment it was told to book them. Booking from the chart and booking from
   the scheduler therefore looked — and behaved — like two different features
   for the same job, and the chart's was the one that could quietly double-book
   a clinic.

   So it asks what the scheduler asks, in the scheduler's own layout: the care
   type first, then the field set that follows from it, then the When panel
   with a month on the left and that day's genuinely open starts on the right,
   then the complaint and the diagnoses it is coded to, then the people on the
   booking and the payer's answer. The markup carries the same `appt__` classes
   and reads from css/components/appointment-form.css, which both screens link
   — one dialog drawn by two stylesheets is a dialog that drifts.

   THE ONE FIELD THAT IS GONE IS PATIENT. This form is opened from inside a
   chart, so whose appointment it is was settled before the button was pressed;
   a required picker restating it is a question with one possible answer and
   one possible mistake. Everything the scheduler derives from that picker —
   the eligibility check, the wait-list entry, the saved `mrn` — is read from
   ctx.patient instead.

   WHY IT IS COPIED RATHER THAN IMPORTED. js/screens/scheduler.js owns a
   screen, not a library: it reaches for `state.anchor`, the filter bar and the
   calendar's repaint on nearly every line of its form. A chart module
   importing from it would couple the two screens far more tightly than the
   handful of rules below are worth. The same call this file already makes for
   kindOf() and locationForKind(), for the same reason — and, as there, what is
   copied is only the part that reads data/schedule.js.
   ========================================================================= */

/** Start times are offered on a quarter-hour grid, or finer for short visits.
 *  The scheduler's own step, so the two forms offer the same times. */
const SLOT_STEP = 15;

/** "2026-08-04" plus n days, for the wait list's default window. */
function addDays(iso, count) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
}

/** The minutes a booking occupies, for the clash check below. */
function spanOf(appt) {
  const start = toMinutes(appt.start);
  return { start, end: start + lengthOf(appt) };
}

/**
 * A provider's configured hours for a day, cut into starts the booking fits
 * into, minus what is already taken.
 *
 * Every appointment in the store is checked, not just this patient's: a clash
 * is a clash with whoever else is in the room. This is what makes a booking
 * made from the chart as safe as one made from the scheduler — the old form
 * took a typed time and asked nobody.
 */
function openSlots(providerId, iso, duration) {
  const { blocks } = availabilityOn(providerId, iso);
  const step = Math.min(SLOT_STEP, duration);

  const taken = loadAppointments()
    .filter((a) => a.providerId === providerId && a.date === iso && a.status !== 'Cancelled')
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
 * The infusion unit's open starts, with nobody's name on them.
 *
 * An infusion names no provider at booking, so there is no configured session
 * to cut into times: what is being reserved is chair time in a unit that is
 * open when the practice is open. Nothing is subtracted for what is already
 * booked — a unit with a row of chairs can take more than one patient at ten
 * o'clock, and refusing the second would be this form inventing a capacity
 * limit the prototype does not model. The scheduler's openChairSlots(), rule
 * for rule.
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

/**
 * Draw a When panel's open starts.
 *
 * One function for both field sets: the clinical panel and the procedure panel
 * differ in what they search — a provider's session or the infusion unit's
 * hours, an activity's length or the sum of the procedures ticked — and in
 * nothing at all about how the answer is drawn. The scheduler keeps two copies
 * of this markup, one per panel, and they have to be edited in step; here they
 * are the same twelve lines called twice.
 *
 * `attribute` names the data-* the buttons carry, so the delegated click
 * handler can tell which panel a press came from.
 */
function paintSlots(host, { groups, chosen, attribute, hint, minutes }) {
  if (!host) return;

  const total = groups.reduce((sum, group) => sum + group.slots.length, 0);
  const current = chosen ? toMinutes(chosen) : null;
  /* The booked time in words, at the top of the box under the panel's Time
     label. It is the only place the time is stated — a selected button is easy
     to miss. Before one is picked there is no head at all: the buttons
     underneath are the instruction, and "no time picked" printed above them
     would be the form narrating itself. */
  const head = chosen
    ? `<span class="appt__slots-chosen">${esc(displayTime(chosen))}</span>`
    : '';

  if (!total) {
    host.innerHTML = `
      ${head ? `<div class="appt__slots-head">${head}</div>` : ''}
      <p class="appt__slots-hint">${hint}</p>`;
    return;
  }

  host.innerHTML = `
    <div class="appt__slots-head">
      ${head}
      <span class="appt__slots-count">${total} free &middot; ${minutes} min</span>
    </div>
    ${groups
      .map(
        (group) => `<div class="appt__slot-group">
          <span class="appt__slot-group-label">${esc(group.label)}${
          group.location ? ` &middot; ${esc(group.location)}` : ''
        }</span>
          <div class="appt__slot-row">
            ${group.slots
              .map(
                (start) => `<button type="button" class="appt__slot${
                  start === current ? ' appt__slot--selected' : ''
                }" ${attribute}="${start}" aria-pressed="${start === current}"
                  >${toTime(start)}</button>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('')}`;
}

/* --- The one reason string, and the two fields that write it ----------------
   A booking stores its indications as they READ — "Z12.11 — Encounter for
   screening for malignant neoplasm of colon" — because that is the string
   billing and the details drawer print. The picker works in bare codes, so the
   stored string is parsed on the way in and rebuilt on the way out, exactly as
   scheduler.js does it. A semicolon separates them: ICD-10 descriptions use
   commas and dashes freely but never a semicolon.
   -------------------------------------------------------------------------- */

const REASON_SEPARATOR = '; ';

/** The picker's codes → the string every other screen reads. */
const reasonFromCodes = (value) =>
  String(value ?? '')
    .split(',')
    .map((code) => icd10Label(code.trim()))
    .filter(Boolean)
    .join(REASON_SEPARATOR);

/** Typed complaint plus picked codes, back into that one string. */
const reasonFrom = (text, codes) =>
  [String(text ?? '').trim(), reasonFromCodes(codes)].filter(Boolean).join(REASON_SEPARATOR);

/** The standard length of a set of procedures, added up. */
const proceduresMinutes = (ids) =>
  ids.reduce((total, id) => total + (procedureById(id)?.duration ?? 0), 0);

/*
 * THE THREE KINDS THE SCHEDULER BOOKS, ASKED THE WAY IT ASKS THEM.
 *
 *   Clinical / Infusion  one shared field set — activity, provider (dropped on
 *                        an infusion), mode, room — over the When panel, the
 *                        wait list, the reason pair, Resources and Eligibility
 *   Procedure            procedure types (more than one per list entry), the
 *                        provider, the status, the room and the derived
 *                        length, over the same When panel and the same tail
 *
 * NO LOCATION FIELD ON EITHER. Where a booking happens is decided by the care
 * type — clinic for a visit or an infusion, the ASC for a scope — so asking
 * let the chart book a colonoscopy into a consulting room and nothing
 * downstream would catch it. See locationForKind().
 *
 * NO REFERRING CLINICIAN PICKER, on either set, for the reason the scheduler
 * dropped its own: a referrer is a directory record with an address and a fax
 * number on it, and who is owed the report is settled where referrals are
 * maintained.
 *
 * Two self-contained field sets, each with its own When panel rather than one
 * shared pair moved between them — the same choice scheduler.js makes, so
 * switching kinds never has to relocate a panel the other set still owns.
 */
function addModal() {
  return `<ui-modal id="aptAddModal" heading="Add Appointment" size="xl">
    <form class="appt" id="aptForm">
      <ui-radio-group
        id="aptKind"
        label="Care Type"
        inline
        value="Clinical"
        options="Clinical,Procedure,Infusion"
        data-testid="chart--appt-kind"
      ></ui-radio-group>

      <div class="appt__cols">
        <div class="appt__main">
          <!-- ===================== CLINICAL ===================== -->
          <div id="aptKindClinical" class="appt__kind" data-testid="chart--appt-clinical">
            <div class="appt__grid">
              <ui-select id="aptType" label="Activity" required
                placeholder="Select activity" data-testid="chart--appt-type"></ui-select>

              <!-- Hidden AND cleared on an infusion: the unit names somebody at
                   check-in, so a required Provider at booking asks a question
                   nobody has the answer to yet — and a field merely hidden
                   still holds an answer the desk was never shown. See
                   applyKind(). -->
              <ui-select id="aptProvider" label="Provider" required
                placeholder="Select provider" data-testid="chart--appt-provider"></ui-select>

              <!-- Coming in or dialling in. Asked on the booking rather than
                   sniffed out of the activity's title, which is what every
                   screen that prints a mode used to do. -->
              <ui-select id="aptMode" label="Appointment Mode"
                options="In person,Telehealth" value="In person"
                data-testid="chart--appt-mode"></ui-select>

              <!-- Typed, not picked from a catalogue that goes stale the first
                   time the unit renumbers its bays. Stored on the booking's
                   "area" key, which the encounter header and the visit
                   facility line already read. -->
              <ui-input id="aptRoom" label="Room Number"
                placeholder="e.g. Clinic Room 2" data-testid="chart--appt-room"></ui-input>
            </div>

            <!-- ---------------- WHEN ----------------
                 The day and the time are one question, so they are one panel:
                 a month on the left, that day's open starts on the right. The
                 times on offer are only the ones that fit — openSlots() cuts
                 the day by the provider's hours, drops the block days and
                 drops what is already booked — which is the whole reason this
                 replaced a pair of typed boxes that would take any answer. -->
            <section class="appt__when" id="aptWhen" data-testid="chart--appt-when">
              <div class="appt__when-cal">
                <span class="appt__when-label" id="aptDateLabel">
                  Date<span class="ui-field__required" aria-hidden="true"> *</span>
                </span>
                <ui-date-picker id="aptDate" hide-today class="appt__picker"
                  aria-labelledby="aptDateLabel" data-testid="chart--appt-date"></ui-date-picker>
              </div>

              <div class="appt__when-times">
                <span class="appt__when-label" id="aptTimeLabel">
                  Time<span class="ui-field__required" aria-hidden="true"> *</span>
                </span>
                <div id="aptSlots" class="appt__slots" role="group"
                  aria-labelledby="aptTimeLabel" data-testid="chart--appt-time"></div>
              </div>
            </section>

            <!-- Outside the When panel, not inside it: "none of these times
                 will do" is a fact about the booking rather than a modifier on
                 the slot above it, and inside the panel it disappeared with
                 the times column on a day that had none. Clinical and Infusion
                 only, and only for activities that can actually be queued —
                 see syncWaitlistOption(). -->
            <ui-checkbox id="aptWaitList" class="appt__waitlist"
              data-testid="chart--appt-waitlist">
              Add to wait list
            </ui-checkbox>

            <div class="appt__grid appt__grid--2" id="aptWaitRange" hidden
              data-testid="chart--appt-wait-range">
              <ui-input id="aptWaitFrom" type="date" label="First date they can come"
                data-testid="chart--appt-wait-from"></ui-input>
              <ui-input id="aptWaitTo" type="date" label="Last date they can come"
                data-testid="chart--appt-wait-to"></ui-input>
            </div>

            <!-- The complaint in the patient's words and the diagnoses it is
                 coded to are two different facts, so they are two fields — but
                 one answer to one question, stored as a single reason string
                 because that is what billing and the details drawer read. -->
            <div class="appt__grid appt__grid--2">
              <ui-textarea id="aptReason" label="Chief Complaint" rows="2"
                placeholder="Reason for the visit" data-testid="chart--appt-reason"></ui-textarea>
              <ui-icd10 id="aptIndication" label="Indication (Diagnosis)" multiple
                suggest="common" suggest-label="Common indications"
                data-testid="chart--appt-indication"></ui-icd10>
            </div>

            <!-- ---------------- Resources ----------------
                 Who else is on the booking. One multiple select rather than a
                 stack of single pickers grown a row at a time — the same
                 control, and the same catalogue, the scheduler offers. -->
            <section class="appt__section">
              <div class="appt__section-head">
                <h3 class="appt__section-title">Resources</h3>
              </div>
              <div class="appt__grid">
                <ui-select id="aptStaff" multiple label="Staff"
                  placeholder="Select staff" data-testid="chart--appt-staff"></ui-select>
              </div>
            </section>

            <!-- ---------------- Eligibility ----------------
                 An action with an answer, not a fact to read: it is run while
                 the patient is on the phone, and the result decides whether
                 the booking goes ahead as it stands. The patient is the one
                 whose chart this is, so unlike the scheduler's there is nobody
                 to choose first. -->
            <section class="appt__section">
              <div class="appt__section-head">
                <h3 class="appt__section-title">Eligibility</h3>
                <ui-button variant="outline" size="sm" id="aptCheckElig"
                  data-testid="chart--appt-check-eligibility">Check eligibility</ui-button>
              </div>
              <div id="aptEligResult" class="appt__elig-result"
                data-testid="chart--appt-elig-result"></div>
              <div id="aptEligibility" class="appt__history"
                data-testid="chart--appt-eligibility"></div>
            </section>
          </div>

          <!-- ===================== PROCEDURE ===================== -->
          <div id="aptKindProcedure" class="appt__kind" hidden
            data-testid="chart--appt-procedure-set">
            <div class="appt__grid">
              <!-- MORE THAN ONE PROCEDURE PER LIST ENTRY. A patient on the
                   table for an upper and a lower is one booking, one sedation
                   and one recovery. This is the product's multiple select, and
                   the booked length is the sum of what is ticked. -->
              <ui-select id="aptProcedure" multiple label="Procedure Type"
                placeholder="Select procedure type" required
                data-testid="chart--appt-procedure"></ui-select>

              <ui-select id="aptDoctor" label="Provider" placeholder="Select provider" required
                data-testid="chart--appt-doctor"></ui-select>

              <!-- A field here rather than a row-menu-only setting, because a
                   scope list is confirmed, deferred and cancelled from the
                   call the clerk is already on. -->
              <ui-select id="aptStatus" label="Status"
                data-testid="chart--appt-status"></ui-select>

              <!-- Typed here too, and for the same reason: the centre calls
                   the room whatever is on the board that morning. -->
              <ui-input id="aptProcRoom" label="Room Number"
                placeholder="e.g. Endoscopy Suite A" data-testid="chart--appt-proc-room"></ui-input>

              <!-- READ-ONLY, and the sum of the standard lengths of what is
                   ticked above. Disabled rather than hidden: it is what the
                   slot panel underneath is searching on, and a search whose
                   input is invisible is a search nobody can check. -->
              <ui-input id="aptDuration" type="number" min="5" step="5" disabled
                label="Duration (minutes)" hint="Set by the procedures booked above"
                data-testid="chart--appt-duration"></ui-input>
            </div>

            <section class="appt__when" id="aptProcWhen" data-testid="chart--appt-proc-when">
              <div class="appt__when-cal">
                <span class="appt__when-label" id="aptProcDateLabel">
                  Date<span class="ui-field__required" aria-hidden="true"> *</span>
                </span>
                <ui-date-picker id="aptProcDate" hide-today class="appt__picker"
                  aria-labelledby="aptProcDateLabel"
                  data-testid="chart--appt-proc-date"></ui-date-picker>
              </div>

              <div class="appt__when-times">
                <span class="appt__when-label" id="aptProcTimeLabel">
                  Time<span class="ui-field__required" aria-hidden="true"> *</span>
                </span>
                <div id="aptProcSlots" class="appt__slots" role="group"
                  aria-labelledby="aptProcTimeLabel"
                  data-testid="chart--appt-proc-time"></div>
              </div>
            </section>

            <div class="appt__grid appt__grid--2">
              <ui-textarea id="aptProcReason" label="Chief Complaint" rows="2"
                placeholder="Reason for the visit"
                data-testid="chart--appt-proc-reason"></ui-textarea>
              <ui-icd10 id="aptProcIndication" label="Indication (Diagnosis)" multiple
                suggest="common" suggest-label="Common indications"
                data-testid="chart--appt-proc-indication"></ui-icd10>
            </div>

            <section class="appt__section">
              <div class="appt__section-head">
                <h3 class="appt__section-title">Resources</h3>
              </div>
              <div class="appt__grid">
                <ui-select id="aptProcStaff" multiple label="Staff"
                  placeholder="Select staff" data-testid="chart--appt-proc-staff"></ui-select>
              </div>
            </section>

            <section class="appt__section">
              <div class="appt__section-head">
                <h3 class="appt__section-title">Eligibility</h3>
                <ui-button variant="outline" size="sm" id="aptProcCheckElig"
                  data-testid="chart--appt-proc-check-eligibility">Check eligibility</ui-button>
              </div>
              <div id="aptProcEligResult" class="appt__elig-result"
                data-testid="chart--appt-proc-elig-result"></div>
            </section>

            <!-- LAST, BECAUSE IT IS WRITTEN LAST: the sentence that starts
                 "the list should know that…", typed once what is being done,
                 by whom and when are all settled. Full width — prose gets the
                 measure. -->
            <ui-textarea id="aptProcNotes" label="Procedure Notes" rows="3"
              placeholder="Preparation, sedation, access or anything the list needs to know"
              data-testid="chart--appt-proc-notes"></ui-textarea>
          </div>
        </div>
      </div>

      <p class="apt__modal-note">
        ${icon('info')}
        <span>Booked here, it appears on the scheduler straight away — this is the same
          booking, not a copy. Staff and equipment assignment stay in the scheduler.</span>
      </p>

      <div class="ui-modal__actions">
        <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--appt-cancel"
          >Cancel</ui-button>
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" data-testid="chart--appt-save">Book Appointment</ui-button>
      </div>
    </form>
  </ui-modal>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

/** The two tallies the tab strip carries. The strip is drawn by the shell into
 *  the module head — before render() has run and outside this module's host —
 *  so the count cannot come from a closure the way it did when the strip was
 *  part of the panel. paint() calls this again after a booking or a
 *  cancellation to keep the two labels honest. */
function tabCounts(mrn) {
  const list = loadAppointments().filter((appointment) => appointment.mrn === mrn);
  return {
    upcoming: list.filter((a) => a.date >= TODAY).length,
    past: list.filter((a) => a.date < TODAY).length,
  };
}

registerModule('appointments', {
  /* The strip below already reads "Upcoming Appointments" and "Past
     Appointments", and the sidebar row lit above it says Appointments too; a
     bare "Appointments" heading between them was a third copy of the same
     word for the eye to step over on the way to the switch. hideTitle takes
     it off the screen without taking it out of the document — the h2 is still
     there for a screen reader and for the outline, and because .u-sr-only is
     absolutely positioned it is not a flex item, so the strip starts at the
     panel's own left edge rather than one gap in from it. Same arrangement as
     Profile. */
  hideTitle: true,

  /* The switch moves up into the module head, the slot the shell reserves for
     exactly this, so it sits where every other module's view switch sits — and
     so the head is not left as an empty band above the panel now that the
     title is gone. The counts are rendered here once, at mount; paint() keeps
     them current afterwards. */
  tabs: (ctx) => {
    const { upcoming, past } = tabCounts(ctx.patient.mrn);
    return `<ui-tabs primary selected="upcoming" data-testid="chart--appt-tabs">
      <ui-tab value="upcoming" label="Upcoming Appointments (${upcoming})"></ui-tab>
      <ui-tab value="past" label="Past Appointments (${past})"></ui-tab>
    </ui-tabs>`;
  },

  /* Add Appointment follows the strip up: the module's one whole-module action
     belongs on the same row as its switch, which is where Profile, Allergies
     and every other module put theirs. */
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus"
      data-testid="chart--add-appointment">Add Appointment</ui-button>`,

  render(host, ctx) {
    const state = { tab: 'upcoming' };

    /* The strip and the Add button are rendered by the shell into the module
       head, a sibling of this host — so both the events they fire and the
       labels this module keeps current are addressed there, not here. */
    const head = host.parentElement;

    /** Read fresh every time: the scheduler and check-in write to this store too. */
    const mine = () =>
      loadAppointments().filter((appointment) => appointment.mrn === ctx.patient.mrn);

    function visible() {
      const list = mine();
      // TODAY is the prototype's fixed clock, the same one the scheduler
      // opens on — using the real date would put the demo's whole week in
      // the past on a machine with a different clock.
      return state.tab === 'upcoming'
        ? list
            .filter((a) => a.date >= TODAY)
            .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
        : list
            .filter((a) => a.date < TODAY)
            .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`));
    }

    function find(id) {
      return mine().find((appointment) => appointment.id === id) ?? null;
    }

    /* --- Paint ------------------------------------------------------------- */

    function tableMarkup() {
      return `<ui-data-table class="apt__table"
        empty-text="${
          state.tab === 'upcoming'
            ? 'No upcoming appointments booked.'
            : 'No past appointments on this record.'
        }"
        data-testid="chart--appt-table"></ui-data-table>`;
    }

    /* The strip is not re-rendered on a repaint — <ui-tabs> deliberately
       refuses to rebuild its own buttons, because replacing the button under
       a pointer that just landed on it loses focus mid-keystroke. So the two
       labels are edited in place and the selection is set through the
       attribute the component watches. */
    function syncTabs() {
      const tabs = head?.querySelector('[data-testid="chart--appt-tabs"]');
      if (!tabs) return;
      const { upcoming, past } = tabCounts(ctx.patient.mrn);
      const label = (value, text) => {
        const span = tabs.querySelector(`[data-value="${value}"] .ui-tabs__label`);
        if (span) span.textContent = text;
      };
      label('upcoming', `Upcoming Appointments (${upcoming})`);
      label('past', `Past Appointments (${past})`);
      tabs.setAttribute('selected', state.tab);
    }

    function paint() {
      syncTabs();

      // Both panels exist whichever tab is selected: <ui-tabs> points each
      // tab's aria-controls at "panel-<value>", so a panel that is only in the
      // DOM when its tab is active leaves the other tab referring to nothing.
      // Only the selected one is filled.
      host.innerHTML = `<div id="panel-upcoming" role="tabpanel" class="apt__panel"
          ${state.tab === 'upcoming' ? '' : 'hidden'}>
          ${state.tab === 'upcoming' ? tableMarkup() : ''}
        </div>
        <div id="panel-past" role="tabpanel" class="apt__panel"
          ${state.tab === 'past' ? '' : 'hidden'}>
          ${state.tab === 'past' ? tableMarkup() : ''}
        </div>

        ${addModal()}`;

      const rows = visible();
      const table = host.querySelector('[data-testid="chart--appt-table"]');
      table.columns = columns(state.tab === 'past');
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');

      /* The dialog is rebuilt with the panel, so its catalogues are filled
         again here rather than once at mount. Cheap — five option lists — and
         it keeps a picker from going stale when a repaint replaces the form
         under it. */
      fillForm();
    }

    /* --- The booking form -----------------------------------------------------
       Everything below drives the dialog addModal() draws. The shape is
       scheduler.js's, on the chart's one patient: fill the catalogues, open on
       an empty booking, keep the open slots in step with the fields that decide
       them, and refuse a save the same way the scheduler refuses one.
       ----------------------------------------------------------------------- */

    /** A control inside the dialog. */
    const field = (id) => host.querySelector(`#${id}`);

    /**
     * Write a value into one of the field components.
     *
     * ui-input and ui-select mirror `value` back to the attribute as the user
     * edits, but ui-textarea does not — and its `value` is a getter with no
     * setter, so plain assignment throws. Setting the attribute AND the live
     * control covers all three. <ui-icd10> is left to paint itself off the
     * attribute: it holds codes but SHOWS "K21.9 — description", and reaching
     * past it to write the raw value would replace the description with the
     * bare code. scheduler.js's setValue(), rule for rule.
     */
    function setField(id, value) {
      const el = field(id);
      if (!el) return;
      const next = value ?? '';
      el.setAttribute('value', next);
      if (el.tagName === 'UI-ICD10') return;
      const control = el.querySelector('input, select, textarea');
      if (control) control.value = next;
    }

    /* The two start times. There is no Time field on either panel — the slot
       buttons are the only way to set one — so the answer is held here rather
       than read back off a control. */
    let startTime = '';
    let procStartTime = '';

    const providerOptions = () =>
      PROVIDERS.map((p) => ({ value: p.id, label: providerLabel(p) }));

    /** Every catalogue the dialog offers. */
    function fillForm() {
      // Two filters, for two reasons: procedures are booked through the
      // procedure picker below rather than as a plain visit, and the rest is
      // whatever the active practice profile actually offers. The label
      // carries the length, as the scheduler's does — it is what the slot
      // panel underneath will be searching on.
      field('aptType').optionList = activeAppointmentTypes()
        .filter((t) => !PROCEDURE_TYPE_IDS.includes(t.id))
        .map((t) => ({ value: t.id, label: `${t.title} · ${t.duration} ${t.unit.toLowerCase()}` }));
      field('aptProvider').optionList = providerOptions();
      field('aptDoctor').optionList = providerOptions();

      /* The length is stated, not asked, so the picker offers it — the same
         label the scheduler's procedure picker uses. */
      field('aptProcedure').optionList = PROCEDURE_TYPES.map((p) => ({
        value: p.id,
        label: `${p.title} · ${p.duration} min`,
      }));

      // The same list Settings colours the calendar from, so a status set here
      // is one the schedule already knows how to draw.
      field('aptStatus').optionList = STATUS_COLOURS.map((s) => ({ value: s.name, label: s.name }));

      /* One catalogue for both Staff fields, so a booking moved between the
         care types keeps its people. */
      const staff = STAFF.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` }));
      field('aptStaff').optionList = staff;
      field('aptProcStaff').optionList = staff;

      resetForm();
    }

    /**
     * Open the dialog on an empty booking.
     *
     * Called on every fill rather than only at mount: this form is opened,
     * abandoned and opened again, and a second booking that inherits the
     * first's provider, complaint and half-picked slot is how a chart books
     * the wrong visit. The scheduler's openAppointment() does the same job for
     * the same reason — it just has a saved booking to open on as well.
     */
    function resetForm() {
      startTime = '';
      procStartTime = '';

      setField('aptKind', 'Clinical');
      // Both panels open on today, which is the day a chart books from far
      // more often than not, and the day the scheduler's own filter bar starts
      // on. TODAY is the prototype's fixed clock, not the machine's.
      setField('aptDate', TODAY);
      setField('aptProcDate', TODAY);
      setField('aptStatus', 'Scheduled');
      field('aptWaitList').checked = false;

      ['aptType', 'aptProvider', 'aptDoctor', 'aptProcedure'].forEach((id) =>
        field(id)?.removeAttribute('error')
      );
      field('aptWhen').classList.remove('appt__when--error');
      field('aptProcWhen').classList.remove('appt__when--error');

      applyKind();
      paintEligibilityHistory();
    }

    /** Which field set is showing, in the scheduler's own vocabulary. */
    const currentKind = () => (field('aptKind')?.value || 'Clinical').toLowerCase();

    /* --- The open slots, on both panels ------------------------------------- */

    function renderSlots() {
      const host_ = field('aptSlots');
      if (!host_) return;

      const kind = currentKind();
      const providerId = field('aptProvider').value;
      const typeId = field('aptType').value;
      const date = field('aptDate').value;

      /* NOTHING TO SAY YET, SO NOTHING IS DRAWN. Until there is an activity —
         and, unless this is an infusion, a provider — there are no times to
         offer, and a bordered box telling the reader to fill in the fields
         they are filling in is chrome. The box collapses instead
         (.appt__slots:empty), so the panel is a calendar until it has times to
         put beside it. */
      if (!typeId || !date || (kind !== 'infusion' && !providerId)) {
        host_.innerHTML = '';
        return;
      }

      /* A save refused for a missing day or time rings the whole When panel.
         Picking a time is the fix, so the ring comes off as soon as there is
         one. */
      if (startTime) field('aptWhen').classList.remove('appt__when--error');

      const minutes = durationOf(typeId);
      const groups =
        kind === 'infusion' ? openChairSlots(date, minutes) : openSlots(providerId, date, minutes);

      /* Whose hours ran out, and therefore what there is to change. An
         infusion has no provider to name or to try a different one of — the
         unit's own hours are what the reader is being told about. */
      const whose =
        kind === 'infusion'
          ? "the infusion unit's hours"
          : `${esc(providerById(providerId)?.name ?? 'this provider')}'s hours`;
      const instead = kind === 'infusion' ? 'date or activity' : 'date, provider or activity';

      paintSlots(host_, {
        groups,
        chosen: startTime,
        attribute: 'data-slot',
        minutes,
        hint: `No ${minutes}-minute slot is open in ${whose} on
          ${esc(longDate(date))}. Try another ${instead}.`,
      });
    }

    /** The booked length — DERIVED from what is ticked, never typed. */
    const procedureMinutes = () => proceduresMinutes(field('aptProcedure')?.values ?? []);

    /** Write that derived length into the read-only Duration box. */
    function syncProcedureDuration() {
      setField('aptDuration', procedureMinutes() || '');
    }

    function renderProcedureSlots() {
      const host_ = field('aptProcSlots');
      if (!host_) return;

      const providerId = field('aptDoctor').value;
      const date = field('aptProcDate').value;
      const minutes = procedureMinutes();

      if (!providerId || !date || !minutes) {
        host_.innerHTML = '';
        return;
      }

      if (procStartTime) field('aptProcWhen').classList.remove('appt__when--error');

      paintSlots(host_, {
        groups: openSlots(providerId, date, minutes),
        chosen: procStartTime,
        attribute: 'data-proc-slot',
        minutes,
        hint: `No ${minutes}-minute slot is open in
          ${esc(providerById(providerId)?.name ?? 'this provider')}'s hours on
          ${esc(longDate(date))}. Try another date, provider or length.`,
      });
    }

    /* --- The wait list -------------------------------------------------------- */

    /**
     * "Add to wait list" is offered for the activities that can actually be
     * queued, and taken away for the ones that cannot.
     *
     * Hidden, not disabled: a control that can never apply to this booking is
     * not a choice being withheld. A tick already made is cleared on the way
     * out, so an activity changed after the fact cannot save a flag the form is
     * no longer showing.
     */
    function syncWaitlistOption() {
      const box = field('aptWaitList');
      if (!box) return;
      const typeId = field('aptType').value;
      const allowed =
        currentKind() !== 'procedure' &&
        (!typeId || waitlistableAppointmentTypes().some((t) => t.id === typeId));
      if (!allowed) box.checked = false;
      box.hidden = !allowed;
      syncWaitlistRange();
    }

    /**
     * The date window, shown only once the booking is actually going on a
     * queue. "First date they can come / last date they can come" says nothing
     * about a booking that has a slot picked above it — it is a fact about a
     * STANDING REQUEST — so the pair arrives with the tick and leaves with it,
     * cleared rather than merely hidden so the save cannot read back a window
     * nobody meant.
     */
    function syncWaitlistRange() {
      const range = field('aptWaitRange');
      const box = field('aptWaitList');
      if (!range || !box) return;

      const wanted = box.checked && !box.hidden;
      range.hidden = !wanted;

      if (!wanted) {
        setField('aptWaitFrom', '');
        setField('aptWaitTo', '');
        return;
      }
      // Today and a month out, which is the window nine requests in ten want.
      if (!field('aptWaitFrom').value) setField('aptWaitFrom', TODAY);
      if (!field('aptWaitTo').value) setField('aptWaitTo', addDays(TODAY, 30));
    }

    /* --- Eligibility ---------------------------------------------------------- */

    /**
     * Ask the payer, and say what came back.
     *
     * The scheduler has to check that a patient has been chosen first; here
     * there is only ever one, so the button does the thing it says on the
     * first press. Both field sets get one — a procedure needs the answer more
     * than a clinic visit does, not less.
     */
    function runEligibilityCheck(which) {
      const target = field(which === 'proc' ? 'aptProcEligResult' : 'aptEligResult');
      if (!target) return;

      const coverage = coverageFor(ctx.patient.mrn);
      const active = coverage.eligibility === 'Active';
      /* Self pay is not a failed check — there is no payer to ask, and reading
         it as "not eligible" would send the desk chasing a plan that does not
         exist. */
      const self = coverage.memberId === '—';

      const severity = self ? 'info' : active ? 'success' : 'critical';
      const heading = self
        ? 'No coverage on file'
        : active
          ? 'Active coverage'
          : 'Coverage not active';

      target.innerHTML = `<ui-alert severity="${severity}" heading="${esc(heading)}">
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

    /** What has been asked before, under the check that asks again. */
    function paintEligibilityHistory() {
      const target = field('aptEligibility');
      if (!target) return;
      const history = eligibilityFor(ctx.patient.mrn);
      target.innerHTML = history.length
        ? history
            .map(
              (h) => `<div class="appt__history-row">
                <span class="appt__history-date">${esc(h.checked)}</span>
                <span>${esc(h.payer)} — ${esc(h.result)}</span>
                <span class="appt__history-by">${esc(h.by)}</span>
              </div>`
            )
            .join('')
        : `<p class="appt__rail-empty">No eligibility checks recorded for this patient.</p>`;
    }

    /** A refusal said from inside the dialog. It goes to the same corner as
     *  every other report in the product: the toast region sits above the
     *  modal (--z-toast 900, --z-modal 700), so a band inside the form is not
     *  needed to be seen, and the fields stay where the eye left them. */
    function notifyInForm(message, severity = 'warning') {
      toast(message, severity);
    }

    /**
     * Clinical / Infusion / Procedure — the same field-swap the scheduler's
     * own form does on its Care Type radio.
     *
     * Clinical and Infusion share one field set, because an infusion is booked
     * on the same facts as a clinic visit. The one difference is Provider: an
     * infusion names nobody at booking, so the control is hidden AND cleared.
     * Hidden alone would leave a value behind for the save to read back — an
     * answer the reader was never shown. (The scheduler takes the control out
     * of the document instead; hiding and clearing settles the same question
     * without a parked element to put back, and this dialog is rebuilt on every
     * repaint anyway.)
     */
    function applyKind() {
      const kind = currentKind();
      field('aptKindClinical').hidden = kind === 'procedure';
      field('aptKindProcedure').hidden = kind !== 'procedure';

      const provider = field('aptProvider');
      const wanted = kind !== 'infusion';
      if (provider) {
        provider.hidden = !wanted;
        if (!wanted) {
          provider.setAttribute('value', '');
          provider.removeAttribute('error');
        }
      }

      /* The room placeholder follows the care type, because the two units call
         their rooms different things and an example that names the wrong one
         is worse than none. */
      field('aptRoom')?.setAttribute(
        'placeholder',
        kind === 'infusion' ? 'e.g. Infusion Bay 2' : 'e.g. Clinic Room 2'
      );

      syncWaitlistOption();
      /* An infusion searches the unit's hours where a clinic visit searches
         the provider's, so the times on offer change with the care type even
         though nothing else on the panel did. */
      renderSlots();
      renderProcedureSlots();
    }

    /**
     * Where a booking happens, derived rather than asked — the same mapping
     * the scheduler uses. The practice runs one clinic and one ASC, and the
     * care type already decides which of the two you are in: you see a patient
     * in clinic, you infuse them in clinic, you scope them at the surgery
     * centre. Asking anyway let the chart book a colonoscopy into a consulting
     * room with nothing downstream to catch it.
     */
    function locationForKind(bookingKind) {
      if (bookingKind === 'procedure') return LOCATIONS[2] ?? LOCATIONS[0];
      return LOCATIONS[0];
    }

    /* --- Start the visit ----------------------------------------------------
       The same routing the scheduler uses when a booking is checked in: a
       procedure has consents and an escort to settle first, a clinic visit
       starts at the encounter. Anything else would mean two screens
       disagreeing about how a visit begins.
       --------------------------------------------------------------------- */

    function startVisit(id) {
      const appointment = find(id);
      if (!appointment) return;

      if (kindOf(appointment) === 'procedure') {
        window.location.href = `check-in.html?appt=${encodeURIComponent(appointment.id)}`;
        return;
      }

      updateAppointment(appointment.id, { status: 'Checked In' });
      window.location.href = `encounter.html?appt=${encodeURIComponent(appointment.id)}`;
    }

    /* --- Row menu ------------------------------------------------------------ */


    function rowMenu(id) {
      const appointment = find(id);
      if (!appointment) return;

      const closed = CLOSED_STATUSES.includes(appointment.status);
      const items =
        state.tab === 'past'
          ? [
              { label: 'Open visit notes', icon: 'document', action: 'notes' },
              { label: 'Open in scheduler', icon: 'calendar', action: 'scheduler' },
            ]
          : [
              ...(closed ? [] : [{ label: 'Start visit', icon: 'play', action: 'start' }]),
              { label: 'Open in scheduler', icon: 'calendar', action: 'scheduler' },
              ...(closed
                ? []
                : [
                    {
                      label: 'Cancel appointment',
                      icon: 'close',
                      action: 'cancel',
                      danger: true,
                    },
                  ]),
            ];

      const anchor = host.querySelector(`[data-apt-menu="${id}"]`);

      function apply(action) {
        if (action === 'start') return startVisit(id);
        if (action === 'notes') return ctx.go('visit-notes');
        if (action === 'scheduler') {
          window.location.href = 'scheduler.html';
          return;
        }
        if (action === 'cancel') {
          updateAppointment(id, { status: 'Cancelled' });
          paint();
          ctx.flash(
            `Appointment on ${longDate(appointment.date)} cancelled. The scheduler shows it as cancelled too.`,
            'success'
          );
        }
      }

      openRowMenu(anchor, items.map((item) => ({ ...item, run: () => apply(item.action) })));
    }

    /* --- Booking --------------------------------------------------------------

       Two saves, one per field set, exactly as scheduler.js splits them — and
       refusing in the same two ways: a missing answer is flagged on the control
       that is missing, and a missing day or time rings the When panel and is
       said once in the notice bar, because neither half of "when" is a field
       that can carry an error.
       ----------------------------------------------------------------------- */

    /** Flag what is missing on the control that is missing it, rather than in
     *  one summary line above the fields. */
    function validate(required) {
      let missing = false;
      for (const [id, value, message] of required) {
        const control = field(id);
        if (!control) continue;
        if (value) control.removeAttribute('error');
        else {
          control.setAttribute('error', message);
          missing = true;
        }
      }
      return !missing;
    }

    /** The day and the time, checked together and reported on the panel that
     *  holds them both. */
    function validateWhen(panelId, date, start) {
      const panel = field(panelId);
      if (date && start) {
        panel?.classList.remove('appt__when--error');
        return true;
      }
      panel?.classList.add('appt__when--error');
      notifyInForm(date ? 'Pick a time from the open slots.' : 'Pick a day and a time.');
      return false;
    }

    function finishBooking(booking) {
      const list = loadAppointments();
      list.push(booking);
      saveAppointments(list);

      /* A ticked box puts the patient on the queue the scheduler's wait list
         reads. Being on the list is not an alternative to having an
         appointment — it is "I have taken the 3rd, but ring me if something
         opens sooner" — so the booking is made either way. */
      let queued = false;
      if (booking.waitList) {
        const entry = addToWaitlist({
          mrn: booking.mrn,
          activity: booking.typeId,
          providerId: booking.providerId,
          location: booking.location,
          /* The window the form asked for, falling back to the booking's own
             date — the honest reading of "sooner than this if anything
             opens". */
          from: booking.waitFrom || booking.date,
          to: booking.waitTo || booking.waitFrom || booking.date,
          // The typed complaint, not the coded half: this is what is read out
          // when somebody rings to offer a slot.
          note: field('aptReason').value.trim(),
        });
        booking.waitlistId = entry.id;
        saveAppointments(loadAppointments().map((a) => (a.id === booking.id ? booking : a)));
        queued = true;
      }

      host.querySelector('#aptAddModal')?.close();
      // A booking made for next month is not on the tab you are looking at if
      // you were reading Past, so the list moves to where the new row is.
      state.tab = booking.date >= TODAY ? 'upcoming' : 'past';
      paint();
      head?.querySelector('[data-testid="chart--add-appointment"]')?.focus();
      ctx.flash(
        `${labelOf(booking)} booked for ${longDate(booking.date)} at ${displayTime(booking.start)}.${
          queued ? ' Added to the wait list for a sooner slot.' : ''
        }`,
        'success'
      );
    }

    /** Clinical and Infusion, which share a field set and differ in one
     *  answer: an infusion names no provider at booking. */
    function bookGeneral(bookingKind) {
      const typeId = field('aptType').value;
      const providerId = bookingKind === 'infusion' ? '' : field('aptProvider').value;
      const date = field('aptDate').value;

      const ok = validate([
        ['aptType', typeId, 'Choose an activity'],
        /* Provider is required on a clinic visit and not asked at all on an
           infusion, so the rule is skipped rather than satisfied with a
           placeholder — a required check on a hidden field is a save that
           refuses for a reason nobody can see. */
        ...(bookingKind === 'infusion' ? [] : [['aptProvider', providerId, 'Choose a provider']]),
      ]);
      const whenOk = validateWhen('aptWhen', date, startTime);
      if (!ok || !whenOk) return;

      const onQueue = field('aptWaitList').checked && !field('aptWaitList').hidden;

      finishBooking({
        id: `ap-${Date.now()}`,
        kind: bookingKind,
        date,
        start: startTime,
        duration: durationOf(typeId),
        mrn: ctx.patient.mrn,
        providerId,
        typeId,
        mode: field('aptMode').value || 'In person',
        location: locationForKind(bookingKind),
        status: 'Scheduled',
        // The typed complaint and the coded indications, into the one string
        // billing and the details drawer read.
        reason: reasonFrom(field('aptReason').value, field('aptIndication').value),
        waitList: onQueue,
        waitFrom: onQueue ? field('aptWaitFrom').value || '' : '',
        waitTo: onQueue ? field('aptWaitTo').value || '' : '',
        notes: '',
        area: field('aptRoom').value.trim(),
        equipment: [],
        staff: field('aptStaff').values,
        /* Not asked on this form — a referrer is settled where referrals are
           maintained. The key stays so the record shape is the same either
           side of a care-type switch. */
        referrers: [],
        coProviders: [],
      });
    }

    /** Same record shape scheduler.js's saveProcedure() writes — `kind`, the
     *  procedure list under both its plural and singular keys, `area` for the
     *  typed room, the location derived from the care type — so a procedure
     *  booked from the chart is indistinguishable downstream (check-in, the
     *  encounter, the scheduler's own calendar) from one booked on the
     *  scheduler itself. */
    function bookProcedure() {
      const procedureIds = field('aptProcedure').values;
      const providerId = field('aptDoctor').value;
      const date = field('aptProcDate').value;

      const ok = validate([
        ['aptProcedure', procedureIds.length ? 'yes' : '', 'Choose at least one procedure'],
        ['aptDoctor', providerId, 'Choose a provider'],
      ]);
      const whenOk = validateWhen('aptProcWhen', date, procStartTime);
      if (!ok || !whenOk) return;

      finishBooking({
        id: `ap-${Date.now()}`,
        kind: 'procedure',
        date,
        start: procStartTime,
        duration: procedureMinutes(),
        mrn: ctx.patient.mrn,
        typeId: '',
        /* The list, and its first entry under the singular name. Check-in,
           the encounter and this module's own table all read `procedureId`
           and none of them has any business learning about combined lists
           to go on showing what was booked. */
        procedureIds,
        procedureId: procedureIds[0] ?? '',
        providerId,
        coProviders: [],
        location: locationForKind('procedure'),
        // The form owns the status: a scope list is confirmed or deferred on
        // the call the booking is being made on.
        status: field('aptStatus').value || 'Scheduled',
        reason: reasonFrom(field('aptProcReason').value, field('aptProcIndication').value),
        notes: field('aptProcNotes').value.trim(),
        area: field('aptProcRoom').value.trim(),
        referrers: [],
        staff: field('aptProcStaff').values,
        equipment: [],
        waitList: false,
      });
    }

    function book() {
      const kind = currentKind();
      if (kind === 'procedure') return bookProcedure();
      return bookGeneral(kind);
    }
    /* --- Wiring --------------------------------------------------------------- */

    function onClick(event) {
      const menuButton = event.target.closest('[data-apt-menu]');
      if (menuButton) {
        rowMenu(menuButton.dataset.aptMenu);
        return;
      }

      /* The open slots are plain <button>s, so they arrive here rather than as
         ui-click. Delegated rather than wired per button: the panel is
         redrawn on every pick, and re-attaching a listener to forty buttons
         each time is work the bubble already does. */
      const slot = event.target.closest('[data-slot]');
      if (slot) {
        startTime = toTime(Number(slot.dataset.slot));
        renderSlots();
        return;
      }
      const procSlot = event.target.closest('[data-proc-slot]');
      if (procSlot) {
        procStartTime = toTime(Number(procSlot.dataset.procSlot));
        renderProcedureSlots();
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      const start = event.target.closest('[data-apt-start]');
      if (start) {
        if (!start.hasAttribute('disabled')) startVisit(start.dataset.aptStart);
        return;
      }

      if (event.target.closest('#aptCheckElig')) return runEligibilityCheck('clinical');
      if (event.target.closest('#aptProcCheckElig')) return runEligibilityCheck('proc');

      if (event.target.closest('[data-testid="chart--appt-save"]')) book();
    }

    /**
     * Every control on the form that something else depends on.
     *
     * Delegated on the host rather than wired control by control, because the
     * dialog is rebuilt with the panel on every repaint — a listener attached
     * to the picker that was there a moment ago is a listener on an element
     * nothing can reach.
     */
    function onChange(event) {
      const target = event.target;
      if (target.closest('#aptKind')) return applyKind();

      // The activity decides both the length the slot search runs on and
      // whether a wait list applies at all.
      if (target.closest('#aptType')) {
        syncWaitlistOption();
        renderSlots();
        return;
      }
      if (target.closest('#aptProvider') || target.closest('#aptDate')) return renderSlots();

      if (target.closest('#aptWaitList')) return syncWaitlistRange();

      /* Ticking or unticking a procedure rewrites the booked length, so the
         box is written before the slot search runs — though the search asks
         procedureMinutes() rather than the box, so the order is belt and
         braces rather than load-bearing. */
      if (target.closest('#aptProcedure')) {
        syncProcedureDuration();
        renderProcedureSlots();
        return;
      }
      if (target.closest('#aptDoctor') || target.closest('#aptProcDate')) {
        renderProcedureSlots();
      }
    }

    /* --- The module head ------------------------------------------------------
       The strip and the Add button are the shell's markup, outside this host,
       so their two events are listened for on the head instead.
       ----------------------------------------------------------------------- */

    function onHeadChange(event) {
      if (!event.target.closest('[data-testid="chart--appt-tabs"]')) return;
      state.tab = event.detail.value;
      paint();
    }

    function onHeadUiClick(event) {
      if (event.target.closest('[data-testid="chart--add-appointment"]')) {
        /* Opened on an empty booking every time. A form abandoned half way
           keeps whatever was typed into it until the panel next repaints, and
           a second booking that inherits the first's provider, complaint and
           half-picked slot is how a chart books the wrong visit. */
        resetForm();
        host.querySelector('#aptAddModal')?.open(event.target.closest('ui-button'));
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onChange);
    head?.addEventListener('ui-change', onHeadChange);
    head?.addEventListener('ui-click', onHeadUiClick);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onChange);
      head?.removeEventListener('ui-change', onHeadChange);
      head?.removeEventListener('ui-click', onHeadUiClick);
      // The row menu is appended to <body>, so it outlives the panel unless
      // it is taken down here.
      closeRowMenu();
    };
  },
});
