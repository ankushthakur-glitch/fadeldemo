/**
 * The Schedule Appointment menu, and the Instant Appointment it offers.
 *
 * There are two ways to start a visit and they are not variations of each
 * other:
 *
 *   New Appointment      — book a slot for later. The full form: date, time,
 *                          provider, resources, eligibility, billing.
 *   Instant Appointment  — the patient is at the desk NOW. Two questions, then
 *                          straight into the encounter.
 *
 * Instant still creates a booking. It would be simpler not to — the desk only
 * asked to open a chart — but an encounter with no appointment behind it has
 * nothing to bill against, does not appear on the day list, and gives check-out
 * nothing to close. So "instant" means the paperwork is written FOR the desk,
 * not skipped.
 *
 * This file owns the menu and the dialog. It does not own the appointment
 * list: creating one is handed back to the scheduler through `createAppointment`
 * so there is exactly one place that decides what an appointment id is and
 * writes it to the store.
 */
import {
  APPOINTMENT_KINDS,
  PROVIDERS,
  TODAY,
  LOCATIONS,
  typeById,
  activeAppointmentTypes,
} from '../../data/schedule.js';
import { DIRECTORY } from '../../data/directory.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { notify } from '../lib/toast.js';

/**
 * What each care type books BY DEFAULT.
 *
 * A walk-in still has to land on a real appointment type, in a real place —
 * the day list, the claim and the room board all read these. Clinical goes to
 * Consultation rather than New Patient because a walk-in is as likely to be
 * neither, and Consultation is the one that does not assert which.
 *
 * These are now the Activity field's opening answer rather than its only one.
 * Choosing the care type still fills the field, so the fast path is unchanged
 * — but a walk-in that is plainly a wound check or a blood draw can be said
 * to be one, instead of being filed as a consultation because that is what
 * the table above happened to say.
 */
const KIND_BOOKING = {
  clinical: { typeId: 'at8', location: LOCATIONS[0] },
  procedure: { typeId: 'at6', location: LOCATIONS[2] },
  infusion: { typeId: 'at12', location: LOCATIONS[3] },
};

const KIND_ICON = {
  clinical: 'stethoscope',
  procedure: 'clipboard',
  // No drip or droplet in the set; a flask is the nearest thing that reads as
  // something being given rather than something being done.
  infusion: 'flask',
};

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "14:35" — the real clock, floored to five minutes. */
function nowTime() {
  const now = new Date();
  const minutes = Math.floor(now.getMinutes() / 5) * 5;
  return `${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function displayTime(value) {
  const [h, m] = value.split(':').map(Number);
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/* ===================== The menu ===================== */

/**
 * Anchored under its trigger and parented to <body>, the same way the row ⋮
 * menus are: the page head is a flex row that clips, and a panel inside it
 * would be cut off at the button's own edge.
 */
/* The panel, its placement and its teardown are js/lib/row-menu.js now.
   This screen kept the name it already called. */
const openMenu = openRowMenu;

/* ===================== Wiring ===================== */

/**
 * @param onNew               opens the full booking form (the existing flow)
 * @param createAppointment   writes one booking and returns it with its id
 * @param defaultProviderId   the provider the schedule is already filtered to,
 *                            or '' when that is not exactly one
 */
export function initScheduleActions({ onNew, createAppointment, defaultProviderId }) {
  const trigger = document.querySelector('[data-testid="sch--new"]');
  const modal = document.getElementById('instantModal');
  if (!trigger || !modal) return;

  // ui-button renders its own <button>; these belong on that, not on the host,
  // which is not the thing a screen reader treats as the control.
  const control = trigger.querySelector('button');
  control?.setAttribute('aria-haspopup', 'menu');
  control?.setAttribute('aria-expanded', 'false');

  const kinds = document.getElementById('instantKinds');
  const who = document.getElementById('instantWho');
  const activity = document.getElementById('instantActivity');
  const patient = document.getElementById('instantPatient');
  const provider = document.getElementById('instantProvider');
  const summary = document.getElementById('instantSummary');

  let kind = '';

  /* --- Step 1: the three care types --- */

  kinds.innerHTML = APPOINTMENT_KINDS.map(
    (item) => `<button type="button" class="wl__choice-option" role="radio"
      aria-checked="false" data-kind="${esc(item.id)}"
      data-testid="sch--instant-kind-${esc(item.id)}">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-${
        KIND_ICON[item.id] ?? 'calendar'
      }"></use></svg>
      <span>
        <strong>${esc(item.label)}</strong>
        <small>${esc(item.hint)}</small>
      </span>
      <svg class="ui-icon sch__kind-tick" aria-hidden="true"><use href="#i-check"></use></svg>
    </button>`
  ).join('');

  function paintSummary() {
    if (!kind) {
      summary.hidden = true;
      return;
    }

    const booking = KIND_BOOKING[kind];
    // The FIELD, falling back to the care type's default only while the field
    // is still empty — the summary has to describe the booking that is about
    // to be made, not the one the table would have made.
    const type = typeById(activity.value || booking.typeId);
    const chosen = PROVIDERS.find((p) => p.id === provider.value);
    const person = DIRECTORY.find((p) => p.mrn === patient.value);

    summary.hidden = false;
    summary.textContent =
      `${type.title} · ${displayTime(nowTime())} today · ${booking.location}` +
      (chosen ? ` · ${chosen.name}` : '') +
      (person ? ` · ${person.name}` : '');
  }

  function chooseKind(next) {
    kind = next;
    for (const button of kinds.querySelectorAll('[data-kind]')) {
      button.setAttribute('aria-checked', String(button.dataset.kind === next));
    }
    /* The care type's usual activity, written into the field as its opening
       answer. Overwritten on every change of care type rather than only when
       the field is empty: a desk that picks Clinical, then Infusion, has
       changed its mind about what is happening, and leaving Consultation
       standing under an Infusion header would be the field contradicting the
       choice directly above it. */
    activity.setAttribute('value', KIND_BOOKING[next].typeId);
    activity.removeAttribute('error');

    // The patient question only makes sense once the care type has answered
    // how long the visit is and where it happens.
    who.hidden = false;
    paintSummary();
  }

  kinds.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kind]');
    if (button) chooseKind(button.dataset.kind);
  });

  /* Arrow keys move between radios, which is what a radiogroup promises. */
  kinds.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    const buttons = [...kinds.querySelectorAll('[data-kind]')];
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = buttons[(index + step + buttons.length) % buttons.length];
    next.focus();
    chooseKind(next.dataset.kind);
  });

  /* --- Step 2: who --- */

  /* The same list the full booking form offers — what the active practice
     profile books — so a walk-in cannot be filed under an activity the
     scheduler itself would not let anybody choose. */
  activity.optionList = activeAppointmentTypes().map((t) => ({
    value: t.id,
    label: `${t.title} · ${t.duration} ${t.unit.toLowerCase()}`,
  }));

  patient.optionList = DIRECTORY.filter((p) => p.active).map((p) => ({
    value: p.mrn,
    label: `${p.name} · MRN ${p.mrn}`,
  }));
  provider.optionList = PROVIDERS.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.role}`,
  }));

  activity.addEventListener('ui-change', () => {
    activity.removeAttribute('error');
    paintSummary();
  });
  patient.addEventListener('ui-change', () => {
    patient.removeAttribute('error');
    paintSummary();
  });
  provider.addEventListener('ui-change', () => {
    provider.removeAttribute('error');
    paintSummary();
  });

  /* --- Opening and closing --- */

  function openInstant(from) {
    kind = '';
    for (const button of kinds.querySelectorAll('[data-kind]')) {
      button.setAttribute('aria-checked', 'false');
    }
    who.hidden = true;
    summary.hidden = true;

    activity.setAttribute('value', '');
    activity.removeAttribute('error');
    patient.setAttribute('value', '');
    patient.removeAttribute('error');
    provider.removeAttribute('error');
    // Pre-filled only when the schedule is already showing one provider —
    // guessing beyond that would file the encounter under the wrong clinician.
    provider.setAttribute('value', defaultProviderId() || '');

    modal.open(from);
  }

  /* --- Start --- */

  function start() {
    if (!kind) {
      /* The words in the toast, the caret on the first care type: the same
         division of labour the fields below use, where the ring says WHERE
         and the message says WHAT. */
      notify('Choose a care type.', 'warning');
      kinds.querySelector('[data-kind]')?.focus();
      return;
    }

    let valid = true;
    for (const [element, message] of [
      [activity, 'Choose what this visit is for'],
      [patient, 'Choose the patient in front of you'],
      [provider, 'Choose whose encounter this is'],
    ]) {
      if (element.value) element.removeAttribute('error');
      else {
        element.setAttribute('error', message);
        valid = false;
      }
    }
    if (!valid) return;

    const booking = KIND_BOOKING[kind];
    const person = DIRECTORY.find((p) => p.mrn === patient.value);

    const created = createAppointment({
      date: TODAY,
      start: nowTime(),
      mrn: patient.value,
      providerId: provider.value,
      // The field's answer. `booking` still supplies the place, which follows
      // from the care type and is not asked for here.
      typeId: activity.value,
      location: booking.location,
      // Already here, already seen — the desk has nothing left to check in.
      status: 'Checked In',
      reason: `Walk-in — ${kind}`,
      waitList: false,
      notes: `Instant appointment for ${person?.name ?? patient.value}.`,
      // What makes the encounter staged for a procedure and a single note
      // otherwise. encounter.js reads exactly this.
      kind,
      area: '',
      equipment: [],
      staff: [],
      referrers: [],
      coProviders: [],
    });

    window.location.href = `encounter.html?appt=${encodeURIComponent(created.id)}`;
  }

  document.getElementById('instantStart').addEventListener('ui-click', start);
  document
    .getElementById('instantCancel')
    .addEventListener('ui-click', () => modal.close());

  /* --- The menu itself --- */

  trigger.addEventListener('ui-click', () => {
    openMenu(trigger, [
      {
        action: 'new',
        icon: 'calendar',
        label: 'New Appointment',
        testid: 'sch--menu-new',
        run: (from) => onNew(from),
      },
      {
        action: 'instant',
        icon: 'play',
        label: 'Instant Appointment',
        testid: 'sch--menu-instant',
        run: (from) => openInstant(from),
      },
    ]);
  });
}
