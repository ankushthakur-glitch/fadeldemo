/**
 * APPOINTMENT — the next visits on a rail, the ones that happened in a table.
 *
 * ⚠ THE LAYOUT CHANGED; THE SCREEN DID NOT. Everything the tabbed version
 * could do it still does — complete an intake form, read the change-of-plan
 * policy, reschedule, cancel with the fee stated first, open a visit summary.
 * What moved is where they sit.
 *
 * WHY UPCOMING AND PAST ARE ON ONE PAGE AGAIN, AND WHY THAT IS NOT THE OLD
 * TWO COLUMNS. They were drawn side by side, which gave each list half a
 * card's width and four rows of height. They were then split into two tabs,
 * which gave each the whole screen at the price of a click and an address to
 * be on. This is the third arrangement and it is the first that suits the
 * shapes of the two lists rather than treating them as the same list twice:
 *
 *   UPCOMING is two or three rich cards. Each one has to carry when, who,
 *   where, why and four things you can do about it — so it gets card width,
 *   full height, and a horizontal rail when there is more than the well can
 *   show. A vertical list of these wastes the right-hand half of the screen.
 *
 *   PAST is a log. Nothing on it can be changed and the question asked of it
 *   is "when did I last see somebody about this" — which is a scan down a
 *   column, so it is a table with Date, Time, Provider, Mode, Type, Reason
 *   and Status, and the one action a past visit has sits at the end of its
 *   row.
 *
 * Cancel is only ever on an upcoming card, which is what stops "Cancel
 * Appointment" ever appearing beside a visit that happened last month.
 *
 * `appointment.html?tab=past` still works — Visit Summary links back to it.
 * There is no second address to be on any more, so it scrolls the past table
 * into view instead of 404-ing the idea.
 *
 * The screen is still read-only for booking — appointments are made by the
 * practice, not from here.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import {
  UPCOMING,
  PAST,
  CANCELLATION_POLICY,
  cancellationCharge,
  cancelAppointment,
  dayLabel,
  formatDay,
  formatHeadline,
  formatTime,
  formatWhen,
} from '../../data/appointments.js';
import { hasVisitSummary } from '../../data/visit-summaries.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell({ active: 'appointment' })) return;

  const host = document.getElementById('screen');
  paint(host);
  wire(host);
  wireCancel(host);

  // The old ?tab=past address. Nothing links to a tab that no longer exists,
  // but Visit Summary's back link does, and so may a patient's bookmark.
  if (new URLSearchParams(location.search).get('tab') === 'past') {
    document.getElementById('pastSection')?.scrollIntoView({ block: 'start' });
  }
});

/**
 * Draw both sections.
 *
 * Called again after a cancellation: the visit leaves the rail and appears in
 * the table, and a screen that still showed it on the rail would be
 * disagreeing with the toast that just said it was gone.
 */
function paint(host) {
  host.innerHTML = `
    <section aria-labelledby="upcomingHeading">
      <!--
        The heading and the rail's two buttons on one row. The buttons used to
        stand at either end of the track, which cost the cards ~6rem of width;
        up here they sit in space the heading was already occupying, and they
        are beside the thing they scroll rather than wrapped around it.

        No line of explanation under either heading. "Upcoming Appointment"
        over a row of dated cards and "Past Appointment" over a table of
        completed ones do not need a sentence to say what they are — the two
        lists look nothing alike, which is the point of giving them different
        furniture. The sentences were there to carry a distinction the tab
        strip used to carry, and the layout carries it now.
      -->
      <div class="pp-appt__sec-head">
        <h2 class="pp-section-title" id="upcomingHeading">Upcoming Appointment</h2>
        ${railNav()}
      </div>
      ${rail()}
    </section>

    <section id="pastSection" aria-labelledby="pastHeading">
      <div class="pp-appt__sec-head">
        <h2 class="pp-section-title" id="pastHeading">Past Appointment</h2>
      </div>
      ${PAST.length ? pastTable() : emptyPast()}
    </section>
  `;

  wireRail(host);
}

/* ============================================================================
   UPCOMING — THE RAIL

   Horizontal, because two cards fill a 1440px well and a third would
   otherwise push the past table off the bottom of the screen. The track
   scrolls natively and snaps; the two buttons live up in the section head and
   are a second way to do what a trackpad already does, not the only way.
   ========================================================================= */

function railNav() {
  return `
    <div class="pp-appt__sec-nav">
      <button type="button" class="pp-rail__nav" data-rail="-1"
        aria-controls="upcomingTrack" aria-label="Show earlier appointments"
        data-testid="appt--rail-prev">
        ${icon('chevron-left', { size: 'sm' })}
      </button>
      <button type="button" class="pp-rail__nav" data-rail="1"
        aria-controls="upcomingTrack" aria-label="Show later appointments"
        data-testid="appt--rail-next">
        ${icon('chevron-right', { size: 'sm' })}
      </button>
    </div>
  `;
}

function rail() {
  return `
    <!--
      tabindex="0" on the track.

      It scrolls, and a card whose only controls are off to the right would
      otherwise be unreachable without a mouse. Making the region itself a
      tab stop is what gives the arrow keys something to scroll.
    -->
    <div class="pp-rail__track pp-scroll" id="upcomingTrack" data-rail-track
      data-testid="appt--upcoming" tabindex="0" role="group"
      aria-label="Upcoming appointments">
      ${UPCOMING.length ? UPCOMING.map(upcomingCard).join('') : emptyUpcoming()}
    </div>
  `;
}

/**
 * One upcoming visit.
 *
 * The headline is the whole point of the card and it carries the weekday:
 * "Tuesday, February 21, 2027 · 01:08 PM" answers "is that this week" where
 * "February 21" sends you to a calendar. The pill beside it says Today,
 * Tomorrow or Upcoming — that is a fact about the clock, so it is derived
 * from the start time rather than stored on the row.
 */
function upcomingCard(appt) {
  const when = dayLabel(appt.startsAt);
  const virtual = appt.mode === 'Virtual';

  const provider = appt.specialty
    ? `${esc(appt.provider)} <span class="pp-appt-fact__sub">— ${esc(appt.specialty)}</span>`
    : esc(appt.provider);

  const visit = `${esc(appt.mode)} — ${esc(appt.type)}` +
    (appt.duration ? ` (${esc(appt.duration)})` : '');

  return `
    <article class="pp-appt-card" data-appointment="${esc(appt.id)}" data-testid="appt--card">
      <header class="pp-appt-card__head">
        <p class="pp-appt-when">${esc(formatHeadline(appt.startsAt))}</p>
        <span class="pp-badge ${when === 'Upcoming' ? 'pp-badge--info' : 'pp-badge--purple'}"
          >${esc(when)}</span>
      </header>

      <dl class="pp-appt-facts">
        ${fact('stethoscope', 'Provider', provider, true)}
        ${fact('map-pin', 'Location', esc(appt.location))}
        ${fact(virtual ? 'video' : 'calendar', 'Visit mode and type', visit)}

        <!-- The one label the design shows in words. A reason printed on its
             own reads as a symptom the portal is asserting; "Reason for Visit
             — cold and fever" is what the patient told the practice. Label and
             answer share a line: on two lines the label cost a row of card
             height to say four words that fit beside the answer. -->
        <div class="pp-appt-fact pp-appt-fact--wide pp-appt-fact--inline">
          <dt>${icon('record', { size: 'sm' })}<span>Reason for Visit</span></dt>
          <dd>${esc(appt.reason || 'Not given')}</dd>
        </div>
      </dl>

      <div class="pp-appt-card__actions">
        ${
          appt.intakeComplete
            ? `<span class="pp-badge pp-badge--ok">${icon('check', {
                size: 'sm',
              })}Intake complete</span>`
            : `<a class="pp-link" href="forms.html">Complete Intake Form</a>`
        }

        <button type="button" class="pp-appt-card__info" data-details
          aria-label="About changing this appointment">
          ${icon('info', { size: 'sm' })}
        </button>

        <button type="button" class="pp-btn pp-btn--quiet pp-btn--sm"
          data-cancel data-testid="appt--cancel">
          Cancel Appointment
        </button>
        <button type="button" class="pp-btn pp-btn--outline pp-btn--sm" data-reschedule>
          Reschedule Appointment
        </button>
      </div>
    </article>
  `;
}

/**
 * One icon'd line on a card.
 *
 * A real <dl>: the label/value pairing is the content, not a layout accident.
 * Three of the four labels are for screen readers only — the glyph and the
 * value say it to everyone else, and "Location: 4517 Washington Ave" printed
 * in full is the card telling you what a map pin means.
 */
function fact(glyph, label, value, wide = false) {
  return `
    <div class="pp-appt-fact${wide ? ' pp-appt-fact--wide' : ''}">
      <dt class="pp-sr-only">${esc(label)}</dt>
      <dd>${icon(glyph, { size: 'sm' })}<span>${value}</span></dd>
    </div>
  `;
}

function emptyUpcoming() {
  return `
    <div class="pp-empty pp-appt__empty">
      <span class="pp-empty__icon">${icon('calendar')}</span>
      <h3 class="pp-empty__title">No upcoming appointments</h3>
      <p>
        The practice books your appointments. Call ${esc(CANCELLATION_POLICY.phone)} or
        message your care team to arrange one.
      </p>
    </div>
  `;
}

/* ============================================================================
   PAST — THE TABLE

   Read-only by construction. The row's only control is the visit summary, and
   it is only offered where there is one to read: a cancelled visit says so in
   words rather than carrying a disabled button a patient has to click to find
   out why it is disabled.
   ========================================================================= */

function pastTable() {
  return `
    <div class="pp-table-wrap">
      <table class="pp-table pp-appt-table" data-testid="appt--past">
        <caption class="pp-sr-only">Appointments you have already had</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Provider</th>
            <th scope="col">Visit Mode</th>
            <th scope="col">Visit Type</th>
            <th scope="col">Reason For Visit</th>
            <th scope="col">Status</th>
            <th scope="col" class="pp-table__action">
              <span class="pp-sr-only">Visit summary</span>
            </th>
          </tr>
        </thead>
        <tbody>${PAST.map(pastRow).join('')}</tbody>
      </table>
    </div>
  `;
}

function pastRow(appt) {
  const at = new Date(appt.startsAt);
  const completed = appt.status === 'Completed';
  const summary = hasVisitSummary(appt.id);

  return `
    <tr data-appointment="${esc(appt.id)}">
      <td>${esc(formatDay(at))}</td>
      <td>${esc(formatTime(at))}</td>
      <td>
        ${esc(appt.provider)}
        ${appt.specialty ? `<span class="pp-appt-table__sub">${esc(appt.specialty)}</span>` : ''}
      </td>
      <td>${esc(appt.mode)}</td>
      <td>${esc(appt.type ?? '—')}</td>
      <td>${esc(appt.reason ?? '—')}</td>
      <td>
        <span class="pp-badge pp-badge--${completed ? 'ok' : 'bad'}">${esc(appt.status)}</span>
      </td>
      <td class="pp-table__action">
        ${
          summary
            ? `<a class="pp-link" href="visit-summary.html?appointment=${encodeURIComponent(
                appt.id
              )}"
                 data-testid="appt--view-summary"
                 aria-label="View the visit summary for ${esc(appt.dateTime)}">
                 ${icon('file', { size: 'sm' })}<span>View Visit Summary</span>
               </a>`
            : `<span class="pp-appt-table__note">${
                completed ? 'Summary not published yet' : 'No visit summary'
              }</span>`
        }
      </td>
    </tr>
  `;
}

function emptyPast() {
  return `
    <div class="pp-empty">
      <span class="pp-empty__icon">${icon('calendar')}</span>
      <h3 class="pp-empty__title">No past appointments</h3>
      <p>Visits you have already had will be listed here.</p>
    </div>
  `;
}

/* ============================================================================
   ACTIONS

   Delegated from the container rather than bound per card: the list is
   rendered as one HTML string, and eleven listeners attached in a loop is
   eleven things to detach if it is ever re-rendered in place.
   ========================================================================= */

function wire(host) {
  const find = (event, attribute) => event.target.closest(`[${attribute}]`);

  host.addEventListener('click', (event) => {
    const details = find(event, 'data-details');
    if (details) {
      return void toast(
        `Appointments can be changed up to ${CANCELLATION_POLICY.noticeHours} hours before the ` +
          `start time. After that, call the practice on ${CANCELLATION_POLICY.phone}.`
      );
    }

    const cancel = find(event, 'data-cancel');
    if (cancel) {
      const appt = appointmentOf(cancel);
      if (appt) openCancel(appt);
      return;
    }

    const reschedule = find(event, 'data-reschedule');
    if (reschedule) {
      const appt = appointmentOf(reschedule);
      return void toast(
        `This would open ${appt?.provider ?? 'the provider'}'s available times.`
      );
    }
  });
}

const appointmentOf = (element) =>
  UPCOMING.find((appt) => appt.id === element.closest('[data-appointment]')?.dataset.appointment);

/* ============================================================================
   THE RAIL'S BUTTONS

   Re-wired on every paint, because paint() replaces the track. One
   AbortController per paint drops the previous listeners with it — including
   the one on window, which is the only one that would otherwise outlive its
   element and pile up a listener per cancellation.
   ========================================================================= */

let railListeners = null;

function wireRail(host) {
  railListeners?.abort();
  railListeners = new AbortController();
  const { signal } = railListeners;

  const track = host.querySelector('[data-rail-track]');
  const navs = [...host.querySelectorAll('[data-rail]')];
  if (!track) return;

  /** One card and the gap after it. Measured, not guessed: the gap is a token
      and the card width changes with the well. */
  const step = () => {
    const cards = track.querySelectorAll('.pp-appt-card');
    if (cards.length > 1) return cards[1].offsetLeft - cards[0].offsetLeft;
    return cards[0]?.getBoundingClientRect().width || track.clientWidth * 0.9;
  };

  /**
   * Grey out the button that would do nothing.
   *
   * A rail with everything already on screen disables both — the design draws
   * the buttons whether or not there is anything to scroll to, and a control
   * that looks live and moves nothing is worse than one that says it is spent.
   */
  const sync = () => {
    const furthest = track.scrollWidth - track.clientWidth;
    navs.forEach((nav) => {
      const back = Number(nav.dataset.rail) < 0;
      nav.disabled =
        furthest <= 1 || (back ? track.scrollLeft <= 1 : track.scrollLeft >= furthest - 1);
    });
  };

  navs.forEach((nav) =>
    nav.addEventListener(
      'click',
      () => track.scrollBy({ left: Number(nav.dataset.rail) * step(), behavior: 'smooth' }),
      { signal }
    )
  );

  track.addEventListener('scroll', sync, { passive: true, signal });
  window.addEventListener('resize', sync, { signal });
  sync();
}

/* ============================================================================
   THE CANCELLATION WARNING

   The screen's only irreversible action, and the only one that can cost the
   patient money. Everything below exists so that nobody finds out about the
   fee on a statement three weeks later.
   ========================================================================= */

/** The appointment the open dialog is about. Cleared when it closes. */
let pending = null;

/**
 * "$50", not format.js's money() → "$ 50.00".
 *
 * That spaced, always-two-decimal form is the design's, and it is right in a
 * billing table where a column of figures has to line up. In a sentence it
 * reads as a typo — "charged $ 50.00" — and on a button it is worse. Whole
 * dollars, no space, because that is how a person says a fee out loud.
 */
const fee = (amount) => `$${amount}`;

/** The dialog's parts, looked up once. */
const dialog = () => ({
  modal: document.getElementById('cancelModal'),
  body: document.getElementById('cancelBody'),
  confirm: document.getElementById('confirmCancel'),
  keep: document.getElementById('keepAppointment'),
  close: document.getElementById('closeCancel'),
});

function wireCancel(host) {
  const { modal, confirm, keep, close } = dialog();

  const dismiss = () => modal.close();
  keep.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);

  // Clicking the backdrop closes it. The <dialog> element itself IS the
  // backdrop's hit target; a click on the box arrives from a child.
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.close();
  });

  // Escape, the close button and the backdrop all land here. Forgetting the
  // appointment on the way out is what stops a stale one being cancelled by
  // the next click on Confirm.
  modal.addEventListener('close', () => {
    pending = null;
  });

  confirm.addEventListener('click', () => {
    if (!pending) return;

    const charge = cancellationCharge(pending);
    const cancelled = cancelAppointment(pending.id);
    modal.close();

    if (!cancelled) return;

    paint(host);
    toast(
      charge.chargeable
        ? `${cancelled.dateTime} cancelled. The ${fee(charge.fee)} late cancellation fee will ` +
            'appear on your next statement.'
        : `${cancelled.dateTime} cancelled. There is nothing to pay.`,
      charge.chargeable ? '' : 'ok'
    );
  });
}

/** Fill the dialog for one appointment and show it. */
function openCancel(appt) {
  const { modal, body, confirm, keep } = dialog();

  pending = appt;
  const charge = cancellationCharge(appt);

  body.innerHTML = warning(appt, charge);

  // The confirm button states the price. "Confirm" beside a warning you have
  // already scrolled past is how a fee gets agreed to without being read.
  confirm.textContent = charge.chargeable
    ? `Cancel and Accept ${fee(charge.fee)} Fee`
    : 'Cancel Appointment';

  modal.showModal();
  // Keep, not Confirm. The dialog opens on the harmless answer, so a
  // reflexive Enter costs nothing.
  keep.focus();
}

/**
 * THE WARNING ITSELF.
 *
 * Three things, in the order a patient needs them:
 *
 *   1. Does THIS cancellation cost anything, and how much. Not "fees may
 *      apply" — the dialog knows the answer and says it.
 *   2. Which appointment is about to go. A confirmation that does not name
 *      what it is confirming is how the wrong visit gets cancelled.
 *   3. The two ways out that cost nothing: reschedule, or call. A warning
 *      that only offers "pay or don't come" is a threat.
 *
 * The no-show fee is stated in both branches. It is the one charge a patient
 * can incur by doing nothing at all, so the moment they are thinking about
 * not attending is exactly when it needs saying.
 */
function warning(appt, charge) {
  const hours = Math.round(charge.hoursLeft);
  const hoursLeft = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const alert = charge.chargeable
    ? `
      <div class="pp-alert pp-alert--warning" data-testid="appt--cancel-fee">
        ${icon('info')}
        <div>
          <p class="pp-alert__heading">
            Cancelling now will be charged ${esc(fee(charge.fee))}.
          </p>
          <p class="pp-alert__body">
            This visit starts in ${esc(hoursLeft)}, inside the practice's
            ${CANCELLATION_POLICY.noticeHours}-hour notice window. The fee will appear on your
            next statement.
          </p>
        </div>
      </div>`
    : `
      <div class="pp-alert pp-alert--info" data-testid="appt--cancel-free">
        ${icon('info')}
        <div>
          <p class="pp-alert__heading">There is no fee for cancelling now.</p>
          <p class="pp-alert__body">
            Cancelling is free until <strong>${esc(formatWhen(charge.deadline))}</strong> —
            ${CANCELLATION_POLICY.noticeHours} hours before the visit. After that it is
            ${esc(fee(charge.fee))}.
          </p>
        </div>
      </div>`;

  return `
    ${alert}

    <dl class="pp-defs pp-cancel__facts">
      <dt>Appointment Mode</dt><dd>${esc(appt.mode)}</dd>
      <dt>Date &amp; Time</dt><dd>${esc(appt.dateTime)}</dd>
      <dt>Provider Name</dt><dd>${esc(appt.provider)}</dd>
      <dt>Location</dt><dd>${esc(appt.location)}</dd>
    </dl>

    <p class="pp-cancel__note">
      <strong>Not going to make it?</strong> Rescheduling is free at any time, including
      inside the notice window — use Reschedule Appointment instead, or call the practice on
      ${esc(CANCELLATION_POLICY.phone)}.
    </p>
    <p class="pp-cancel__note" data-testid="appt--no-show-fee">
      Simply not attending without cancelling is recorded as a no-show and charged
      ${esc(fee(charge.noShowFee))} — more than cancelling, because a slot the practice
      hears about can still be given to someone else.
    </p>
  `;
}
