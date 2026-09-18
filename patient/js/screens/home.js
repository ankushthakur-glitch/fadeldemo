/**
 * HOME — the dashboard.
 *
 * A greeting, then four cards two by two:
 *
 *     Welcome back, Henna West
 *     Upcoming Appointment            Messages
 *     Current Medication              Forms & Consents
 *
 * The rule the record cards follow is unchanged: a card shows the few things
 * a patient checks at a glance, and "More ↗" goes to the screen that shows
 * the rest. Nothing is only available here.
 *
 * The fourth card used to be Latest Reports. It is paperwork now, because the
 * dashboard is read at the moment a patient wonders what is being asked of
 * them: a result is something they go looking for on Health Records, while a
 * form with a due date on it is work the practice is waiting on and nothing
 * else on this screen would mention. See the FORMS & CONSENTS block below.
 *
 * ── WHAT THE GREETING CARRIES NOW ────────────────────────────────────────────
 *
 * A balance panel with a Pay Bill button sat beside the greeting, a row of
 * three "needs your attention" tiles sat under it, and a message digest ran
 * across the foot. All three are gone: the dashboard was four bands of
 * summonses before it showed a single fact about the record, and every errand
 * they carried already has a screen of its own in the nav — Billing, Forms,
 * Notifications, Messages. Messages came back as a CARD in the grid, listed
 * like the record cards beside it, rather than as a band of quoted replies.
 *
 * What survives is the SENTENCE under the greeting, and it is still derived:
 * it counts the real fixtures at paint time — upcoming visits, forms still to
 * do, unread notifications — so it cannot claim work that is not there. When
 * nothing at all is outstanding it falls back to the practice's own welcome
 * copy rather than to a cheerful line this file invented.
 *
 * ── WHAT THIS SCREEN BORROWS ─────────────────────────────────────────────────
 *
 * The Upcoming Appointment card is drawn with the SAME parts as a card on the
 * Appointment screen — .pp-appt-when for the headline, the Today/Tomorrow
 * pill beside it, and the icon'd .pp-appt-facts underneath. Those live in
 * components.css, so the two cannot drift.
 *
 * ── HOW THE FOUR ARE LAID OUT ────────────────────────────────────────────────
 *
 * One grid, two columns, and the cards fill it in source order — appointments
 * and messages on the top row, medications and paperwork under them. The
 * appointment card had a full-width band of its own while there were only
 * three cards; at half the well its two visits stack instead of sitting side
 * by side, which costs height it gets back by sharing a row with Messages
 * rather than standing above one.
 *
 * The appointment card carries the next TWO rather than only the featured
 * one: a patient checking the dashboard wants to know what is next and what
 * follows it, and a single visit made them open the Appointment screen to
 * find out whether there was a second. Two is where it stops — past that the
 * card is the Appointment screen in a smaller frame, and "More ↗" already
 * goes there. The same rule limits Messages to the head of the thread list.
 *
 * A PAIR IS MADE THE SAME HEIGHT, and the shorter card of a pair spends the
 * difference on its rows rather than on white space at the foot: the lists
 * set .pp-home__list, and every row in one takes an equal share of whatever
 * height the card was given. That is what lets six threads stand level with
 * two appointments without either card ending in a blank panel.
 *
 * The paperwork card is the one exception, and it opts out of both halves of
 * that: its rows keep their own height and the card stops where they stop.
 * Three rows given the height of six medications came to nearly 200px each,
 * which is a list whose rows are further apart than they are tall. See the
 * FORMS CARD block in screen-home.css.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc, initials, plural } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import {
  UPCOMING,
  featured,
  dayLabel,
  formatHeadline,
} from '../../data/appointments.js';
import { medicationsBy, medicationTags } from '../../data/health.js';
import { formsBy, outstandingCount } from '../../data/forms.js';
import { hasDraft, rehydrateForms } from '../../data/form-store.js';
import { unreadCount } from '../../data/notifications.js';
import { THREADS } from '../../data/messages.js';
import { PATIENT, WELCOME } from '../../data/patient.js';

document.addEventListener('DOMContentLoaded', () => {
  /*
   * Before anything counts a form.
   *
   * FORMS is a fixture and what the patient has actually submitted lives in
   * localStorage, so a dashboard that read the module directly would tell
   * somebody to complete a form they filled in ten minutes ago. It runs
   * before mountShell() as well as before the greeting, so the "3 Pending"
   * tag on the nav row agrees with the sentence under the title.
   */
  rehydrateForms();

  const session = mountShell({ active: 'home' });
  if (!session) return;

  const host = document.getElementById('dashboard');
  host.innerHTML = `
    ${hello()}
    <div class="pp-home__grid">
      ${appointment()}
      ${messages()}
      ${medications()}
      ${paperwork()}
    </div>
  `;

  wire(host);
});

/* ============================================================================
   THE GREETING
   ========================================================================= */

/**
 * "Welcome back, Henna" over a sentence that counts what is waiting.
 *
 * The first name only. The top bar already names the account in full, and a
 * greeting that repeats a surname reads like a letter from a utility company.
 */
function hello() {
  return `
    <section class="pp-hello" data-testid="home--hello">
      <h1 class="pp-hello__title">Welcome back, ${esc(PATIENT.name.split(' ')[0])}</h1>
      <p class="pp-hello__sub">${esc(summary())}</p>
    </section>
  `;
}

/**
 * The line under the greeting.
 *
 * Counted at paint time from the same fixtures the cards read, so it cannot
 * say "3 forms" over a portal that offers two.
 */
function summary() {
  const forms = outstandingCount();
  const unread = unreadCount();

  const parts = [
    UPCOMING.length && `${UPCOMING.length} upcoming ${plural(UPCOMING.length, 'appointment')}`,
    forms && `${forms} ${plural(forms, 'form')} to complete`,
    unread && `${unread} unread ${plural(unread, 'notification')}`,
  ].filter(Boolean);

  if (!parts.length) return WELCOME.body;

  const last = parts.pop();
  return `You have ${parts.length ? `${parts.join(', ')} and ` : ''}${last}.`;
}

/* ============================================================================
   UPCOMING APPOINTMENT

   The same description an Appointment card gives — headline, day pill, icon'd
   facts — inside this screen's card frame. See the APPOINTMENT FACTS block in
   components.css.
   ========================================================================= */

function appointment() {
  const visits = upcoming();

  /*
   * There may be nothing upcoming.
   *
   * Not a theoretical branch since the Appointment screen learned to cancel:
   * a reviewer who cancels every visit and clicks Home used to land on a
   * white page, because featured() returns undefined against an empty list
   * and this function read .mode off it. The card says so instead, and says
   * who books.
   */
  if (!visits.length) {
    return `
      <section class="pp-card" data-testid="home--appointment">
        ${cardHead('calendar', 'Upcoming Appointment', 'appointment.html')}
        <div class="pp-card__body">
          <p class="pp-home__empty">No upcoming appointments</p>
          <p class="pp-home__empty-meta">
            The practice books them — call (808) 555-0100 or message your care
            team to arrange one.
          </p>
        </div>
        <div class="pp-card__foot">
          <a class="pp-btn pp-btn--outline" href="messages.html">Message the practice</a>
        </div>
      </section>
    `;
  }

  return `
    <section class="pp-card" data-testid="home--appointment">
      ${cardHead('calendar', 'Upcoming Appointment', 'appointment.html')}
      <div class="pp-card__body pp-card__body--flush pp-home__appts">
        ${visits.map(visit).join('')}
      </div>
    </section>
  `;
}

/** How many visits fit on the dashboard before it becomes a list. */
const VISITS_SHOWN = 2;

/**
 * WHICH visits the card draws.
 *
 * The featured one first — it is the entry the design puts on the dashboard,
 * and demoting it because another fixture happens to fall sooner would change
 * the screen every time somebody edits a date. Everything after it is in the
 * order a patient meets it, soonest first, and the card stops at two: past
 * that it is the Appointment screen with a smaller heading, and "More ↗"
 * already goes there.
 */
function upcoming() {
  const first = featured();
  if (!first) return [];

  const rest = UPCOMING.filter((appt) => appt !== first).sort(
    (a, b) => new Date(a.startsAt) - new Date(b.startsAt)
  );

  return [first, ...rest].slice(0, VISITS_SHOWN);
}

/**
 * ONE visit on the card — the same description an Appointment card gives.
 *
 * Each one carries its own actions, because Intake Form and Join Visit belong
 * to a particular visit: a single footer under three appointments would join
 * whichever the card happened to draw first.
 */
function visit(appt, index) {
  const when = dayLabel(appt.startsAt);
  const virtual = appt.mode === 'Virtual';

  const provider = appt.specialty
    ? `${esc(appt.provider)} <span class="pp-appt-fact__sub">— ${esc(appt.specialty)}</span>`
    : esc(appt.provider);

  const visitLine = `${esc(appt.mode)} — ${esc(appt.type)}` +
    (appt.duration ? ` (${esc(appt.duration)})` : '');

  // The first visit keeps the plain hooks the rest of the portal already
  // points at; the others are suffixed so three Join buttons stay tellable
  // apart.
  const hook = (name) => (index === 0 ? `home--${name}` : `home--${name}-${index + 1}`);

  return `
      <article class="pp-home__appt" data-testid="home--appt-${esc(appt.id)}">
        <div class="pp-home__appt-head">
          <p class="pp-appt-when">${esc(formatHeadline(appt.startsAt))}</p>
          <span class="pp-badge ${when === 'Upcoming' ? 'pp-badge--info' : 'pp-badge--purple'}"
            >${esc(when)}</span>
        </div>

        <!-- The column count is a container query on the visit, so the facts
             follow the COLUMN they are in and not the viewport: two across
             while the visits share the well between two of them, one under
             the other once three columns or a narrow window take the room
             away. Neither this file nor components.css measures the screen. -->
        <dl class="pp-appt-facts">
          ${fact('stethoscope', 'Provider', provider)}
          ${fact('map-pin', 'Location', esc(appt.location))}
          ${fact(virtual ? 'video' : 'calendar', 'Visit mode and type', visitLine)}

          <!-- The one label shown in words. A reason printed on its own reads
               as a symptom the portal is asserting; "Reason for Visit — cold
               and fever" is what the patient told the practice. -->
          <div class="pp-appt-fact pp-appt-fact--wide pp-appt-fact--inline">
            <dt>${icon('record', { size: 'sm' })}<span>Reason for Visit</span></dt>
            <dd>${esc(appt.reason || 'Not given')}</dd>
          </div>
        </dl>

        <div class="pp-home__appt-actions">
          <!-- Forms, not Documents. The link is drawn on the appointment card in
               the design and it used to land on the Documents table, which lists
               paperwork already filed and offers nothing to fill in. -->
          ${
            appt.intakeComplete
              ? `<span class="pp-badge pp-badge--ok">${icon('check', {
                  size: 'sm',
                })}Intake complete</span>`
              : `<a class="pp-link" href="forms.html" data-testid="${hook('intake')}">Intake Form</a>`
          }
          <button type="button" class="pp-btn pp-btn--primary pp-push"
            data-join="${esc(appt.id)}" data-testid="${hook('join')}">Join Visit</button>
        </div>
      </article>
  `;
}

/**
 * One icon'd line on the card.
 *
 * A real <dl>, and the labels are for screen readers only: the glyph and the
 * value say it to everyone else, and "Location: 4517 Washington Ave" printed
 * in full is the card telling you what a map pin means. `wide` is for the one
 * fact that takes a row to itself — the reason draws its own markup, so
 * nothing passes it today, and the argument stays for the next fact that has
 * to.
 */
function fact(glyph, label, value, wide = false) {
  return `
    <div class="pp-appt-fact${wide ? ' pp-appt-fact--wide' : ''}">
      <dt class="pp-sr-only">${esc(label)}</dt>
      <dd>${icon(glyph, { size: 'sm' })}<span>${value}</span></dd>
    </div>
  `;
}

/* ============================================================================
   MESSAGES

   The head of the thread list on the Messages screen, in the dashboard's own
   list frame. Unread threads come first — that is the only reason to look at
   this card from Home — and the rest follow in the order the Messages screen
   itself lists them, so the two cannot disagree about which conversation is
   at the top.

   The rows are not links. Every other list on this screen is read-only and
   "More ↗" goes to the screen that can open a thread; a row that opened one
   would be the only clickable line in the grid.

   SIX of them — see THREADS_SHOWN. The card is stretched to the height of the
   appointment card beside it (.pp-home__list in screen-home.css) and the rows
   share out whatever the stretch adds, so the count is what decides whether
   that is a few pixels a row or a hundred.
   ========================================================================= */

/**
 * How many conversations fit in the card's half of the grid.
 *
 * Six, because six rows is about what two appointments are tall: the card is
 * stretched to the appointment card's height beside it, and a count that
 * leaves the stretch nothing much to do is a card of rows rather than a short
 * list floating in a tall white box.
 */
const THREADS_SHOWN = 6;

function messages() {
  // Unread first, each group in its original order — a stable sort, so the
  // Messages screen's own ordering survives inside both halves.
  const threads = [...THREADS]
    .sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0))
    .slice(0, THREADS_SHOWN);

  const rows = threads
    .map(
      (thread) => `
    <li class="pp-list__item">
      <span class="pp-avatar pp-avatar--sm${thread.members ? ' pp-avatar--group' : ''}"
        aria-hidden="true"
        >${thread.members ? icon('users', { size: 'sm' }) : esc(initials(thread.name))}</span>
      <div class="pp-list__main">
        <div class="pp-list__name pp-home__thread-name">
          <span>${esc(thread.name)}</span>
          <!-- Urgency is a mark beside the name, the way the Messages screen
               draws it — not a second chip. Two chips on a row this narrow
               push the preview into an ellipsis to say what one glyph and one
               count already say. -->
          ${
            thread.urgent
              ? `<span class="pp-home__urgent">${icon('bell-alert', { size: 'sm' })}
                   <span class="pp-sr-only">Marked urgent</span></span>`
              : ''
          }
        </div>
        <div class="pp-list__meta pp-home__preview">${esc(thread.preview)}</div>
      </div>
      <div class="pp-list__tags">
        ${
          thread.unread
            ? `<span class="pp-badge pp-badge--info"
                 >${thread.unread} new<span class="pp-sr-only"
                   > ${plural(thread.unread, 'message')}</span></span>`
            : ''
        }
      </div>
    </li>`
    )
    .join('');

  return `
    <section class="pp-card pp-home__list" data-testid="home--messages">
      ${cardHead('chat', 'Messages', 'messages.html')}
      <div class="pp-card__body pp-card__body--flush">
        <ul class="pp-list">${rows}</ul>
      </div>
    </section>
  `;
}

/* ============================================================================
   CURRENT MEDICATION

   Everything the patient is on TODAY, from either direction — the four the
   practice prescribed and the two they added themselves. "Current" is the
   question this card answers, and a vitamin is as much a part of the answer
   as a tablet on a script, which is why the self-reported pair carry a chip
   saying where the row came from rather than being left out.

   Stopped medications never appear. They are history, and this card is the
   smallest possible answer to a question about today.

   The rows are derived — medicationsBy() and medicationTags() — rather than a
   list of their own, so the card cannot drift from the screen behind it.
   ========================================================================= */

function medications() {
  const meds = medicationsBy({ active: true });

  const rows = meds
    .map((med, index) => {
      const tags = medicationTags(med);
      // Where the row came from, said on the row itself. The Medications
      // screen splits prescribed from self-reported into sections and needs
      // no chip; this card is one list, so it does.
      if (med.source === 'self') tags.push({ label: 'Self-reported', tone: '' });

      return `
    <li class="pp-list__item">
      <span class="pp-list__index">${index + 1}.</span>
      <div class="pp-list__main">
        <div class="pp-list__name">${esc(med.name)}</div>
        <div class="pp-list__meta">${esc(med.dose)}</div>
      </div>
      <div class="pp-list__tags">
        ${tags
          .map(
            (tag) =>
              `<span class="pp-badge${tag.tone ? ` pp-badge--${tag.tone}` : ''}"
                >${esc(tag.label)}</span>`
          )
          .join('')}
      </div>
    </li>`;
    })
    .join('');

  return `
    <section class="pp-card pp-home__list" data-testid="home--medications">
      ${cardHead('pill', 'Current Medication', 'health-medications.html')}
      <div class="pp-card__body pp-card__body--flush">
        <ul class="pp-list">${rows}</ul>
      </div>
    </section>
  `;
}

/* ============================================================================
   FORMS & CONSENTS

   The paperwork the practice is still waiting on — not the lab reports that
   used to sit here. A patient opens the portal to find out what is being
   ASKED OF THEM; a result they cannot act on is something they go looking for,
   and Health Records is where they go. Paperwork is the opposite: it is work
   the practice needs back before a visit, it has a due date, and the only
   thing standing between it and being done is somebody remembering it exists.
   That is what a dashboard card is for.

   The rows are derived — formsBy('todo') — so the card cannot claim work the
   Forms screen has already taken off the list. WITHDRAWN CONSENTS ARE ON IT,
   because formsBy() counts them as outstanding: the practice has no
   permission, which is the same situation as never having been given it. The
   row says so on its meta line, and its button offers the consent again, so
   nobody reads a right the patient exercised as a chore they forgot.

   THE ROWS ARE THE ONLY ONES IN THE GRID THAT DO NOT STRETCH, and this card
   is the only one that stops at the height of its own content. Both are the
   same decision — see the FORMS CARD block in screen-home.css.

   EVERY ROW CARRIES ITS OWN BUTTON, and this is the one card in the grid
   that does. The other three list a record — visits, medications, threads —
   and the reading of it is the whole errand, so "More ↗" is the only control
   they need. A row here is not a fact, it is a JOB: the patient reads
   "Patient Interview Form — due 09/01/2026" and the very next thing they want
   is to start it. Sending them to the head of the Forms screen to find the
   row they were already looking at is a step that exists for the layout's
   sake, not for theirs.

   So the button says exactly what the same row says on the Forms screen —
   Start Form, Review & Consent, Continue on a draft, Give consent again on a
   consent that was withdrawn — and it goes straight to that form, because a
   patient who pressed "Start Form" has said what they want to do. See
   action() in js/screens/forms.js, which is where those words come from and
   the file to keep them in step with.

   They are LINKS drawn as buttons rather than buttons: Home cannot render a
   form, the control's entire job is to reach the screen that can, and a real
   href is what lets it be middle-clicked, opened in a new tab, and read off
   the status bar before it is pressed. "More ↗" stays in the head for the
   patient whose question is "what else is waiting", which is the question the
   list itself cannot answer once it is capped.
   ========================================================================= */

/**
 * How many pieces of paperwork fit in the card's half of the grid.
 *
 * Six, the same as the Messages card it shares its frame with. The fixtures
 * offer three, so the cap only matters to whoever adds a fourth and a fifth —
 * past six the card is the Forms screen in a smaller frame, and the link in
 * the head already goes there.
 */
const FORMS_SHOWN = 6;

function paperwork() {
  /*
   * Soonest first, and the undated at the back.
   *
   * A due date is the only thing on this card that makes one row more urgent
   * than another, so it decides the order. The consents that carry none — a
   * Release Of Information sits waiting rather than expiring — keep their
   * fixture order behind the dated rows instead of being sorted against a
   * date they do not have.
   */
  const pending = [...formsBy('todo')]
    .sort((a, b) => {
      if (!a.dueOn && !b.dueOn) return 0;
      if (!a.dueOn) return 1;
      if (!b.dueOn) return -1;
      return new Date(a.dueOn) - new Date(b.dueOn);
    })
    .slice(0, FORMS_SHOWN);

  /*
   * There may be nothing outstanding — a reviewer who fills both forms in
   * empties this card, the same way cancelling every visit empties the
   * appointment card. It says so, and says where the settled ones are kept,
   * rather than drawing an empty list frame.
   */
  if (!pending.length) {
    return `
      <section class="pp-card pp-home__list" data-testid="home--forms">
        ${cardHead('clipboard', 'Forms & Consents', 'forms.html')}
        <div class="pp-card__body">
          <p class="pp-home__empty">Nothing to fill in</p>
          <p class="pp-home__empty-meta">
            Everything the practice has sent you is done. Completed forms and
            the consents you have given are kept on Forms &amp; Consents.
          </p>
        </div>
      </section>
    `;
  }

  const rows = pending
    .map((form, index) => {
      const revoked = form.status === 'revoked';
      const drafted = !revoked && hasDraft(form.id);

      /*
       * The line under the name answers "by when?" before it answers
       * anything else. A form with no due date says when it was sent
       * instead, so every row carries a date and none of them is bare.
       *
       * A withdrawn consent says when it was withdrawn: it is back on this
       * card because the practice has no permission, and the date that
       * explains why it reappeared is the withdrawal, not the day it was
       * first sent out.
       */
      const meta = [
        form.category,
        revoked && form.revokedOn
          ? `Withdrawn ${form.revokedOn}`
          : form.dueOn
            ? `Due ${form.dueOn}`
            : `Sent ${form.sentOn}`,
      ].filter(Boolean);

      /*
       * NO STATUS CHIP ON THESE ROWS.
       *
       * The Forms screen needs one: its table holds pending and completed
       * paperwork under the same columns, so a row has to say which it is.
       * This card holds ONE of those states — everything on it is
       * outstanding, that is the whole rule for being here — and a column of
       * identical "Pending" chips down a card headed with what the practice
       * is waiting on says nothing the card has not already said, in the one
       * colour the portal keeps for something needing attention.
       *
       * The two states that are not merely pending say so without a chip.
       * A draft reads "Continue" on its button rather than "Start Form", and
       * a withdrawn consent carries the date it was withdrawn on its meta
       * line and "Give consent again" on its button. Both are said by the
       * thing the patient was going to read anyway.
       */
      return `
    <li class="pp-list__item">
      <span class="pp-list__index">${index + 1}.</span>
      <div class="pp-list__main">
        <div class="pp-list__name">${esc(form.name)}</div>
        <div class="pp-list__meta">${esc(meta.join(' · '))}</div>
      </div>
      ${cta(form, { revoked, drafted })}
    </li>`;
    })
    .join('');

  return `
    <section class="pp-card pp-home__list pp-home__forms" data-testid="home--forms">
      ${cardHead('clipboard', 'Forms & Consents', 'forms.html')}
      <div class="pp-card__body pp-card__body--flush">
        <ul class="pp-list">${rows}</ul>
      </div>
    </section>
  `;
}

/**
 * The one control on a row — the Forms screen's own, in the card's frame.
 *
 * THE WORDS ARE NOT INVENTED HERE. They are the four labels action() puts on
 * a pending row, and the point of repeating them is that the patient presses
 * "Review & Consent" on the dashboard and arrives at a screen whose heading
 * and whose submit button say the same thing. A card that said "Open" and
 * landed on "Review & Consent" would make the patient check they had pressed
 * the right thing.
 *
 * OUTLINED, like the row it is copying: three solid primaries stacked down
 * half the dashboard would shout louder than the appointment beside them, and
 * the outline is still the only bordered thing in the row.
 *
 * `?form=<id>` opens the form itself rather than the list. The Forms screen
 * reads that on arrival (see route() there), and its Back arrow goes to the
 * right record — Consents for a consent — so a patient who came here to
 * check rather than to fill lands somewhere sensible.
 */
function cta(form, { revoked, drafted }) {
  const label = revoked
    ? 'Give consent again'
    : drafted
      ? 'Continue'
      : form.kind === 'consent'
        ? 'Review &amp; Consent'
        : 'Start Form';

  /*
   * The form's name is on the button for anyone not using a pointer. Three
   * buttons reading "Start Form" out of the list name three different jobs,
   * and only the row above each one says which — which a screen reader
   * tabbing between them never hears.
   */
  return `
      <a class="pp-btn pp-btn--outline pp-btn--sm pp-home__cta"
        href="forms.html?form=${encodeURIComponent(form.id)}"
        data-testid="home--form-cta"
        >${label}<span class="pp-sr-only"> — ${esc(form.name)}</span></a>`;
}

/* ============================================================================
   SHARED
   ========================================================================= */

/** Icon, title, and the "More ↗" that leads to the full section. */
function cardHead(glyph, title, href) {
  return `
    <div class="pp-card__head">
      <h2 class="pp-card__title">${icon(glyph)}<span>${esc(title)}</span></h2>
      <a class="pp-more pp-push" href="${esc(href)}">More ${icon('external', { size: 'sm' })}</a>
    </div>
  `;
}

/*
 * The one button whose real destination is a system this prototype does not
 * have. It says what would happen next rather than doing nothing — see
 * lib/toast.js for why that is the choice.
 */
function wire(host) {
  host.querySelectorAll('[data-join]').forEach((button) => {
    button.addEventListener('click', () => {
      const appt = UPCOMING.find((entry) => entry.id === button.dataset.join);
      if (!appt) return;

      toast(
        appt.mode === 'Virtual'
          ? `This would open the video visit with ${appt.provider}.`
          : `This visit is in person — ${appt.location}.`
      );
    });
  });
}
