/**
 * PATIENT CHART — the shell.
 *
 * The frame around the chart: the top bar, the patient banner, the section
 * rail down the left, and the panel the sections render into. It draws none
 * of the chart itself. Every section — Allergies, Orders, Visit Notes, all
 * fifteen — is its own module file, registered against its id in
 * js/screens/chart-workspace.js and reading its own data file, and this shell
 * knows only how to hand one of them a host element and a context object:
 *
 *   the shell  ──  chart-workspace.js  ──  the fifteen modules  ──  data/
 *
 * That line is the reason this file could be replaced wholesale without a
 * single module changing, which is exactly what happened: the chart was drawn
 * by two shells side by side for a while — this design and an earlier one, a
 * switch in the top bar flipping between them — and when this one won, the
 * other was deleted and nothing inside the frame had to be touched. The URL
 * carries both halves of where you are, which is what made the comparison
 * possible and is now simply how the chart is linked to from everywhere else:
 *
 *   patient-chart.html?mrn=326486#allergies
 *
 * The small pure helpers below (esc, formatDate, ageFrom …) are restated
 * rather than imported. That is this codebase's own convention — every module
 * file carries its own esc() and icon() — and it is what keeps the shell
 * readable start to finish.
 */
import {
  PATIENTS,
  DEFAULT_MRN,
  CHART_NAV,
  FLAG_TYPES,
  ALERT_CATEGORIES,
  ALERT_PRIORITIES,
  PORTAL_STATES,
} from '../../data/patient-chart.js';
import { PROFILE_CLINICAL } from '../../data/profile-clinical.js';
import { renderWorkspace, moduleTitle, MODULE_IDS } from './chart-workspace.js';

// The modules themselves. Imported for their side effect: a module
// registers itself against its id when its file is imported, and the
// workspace looks it up by that id. Nothing here calls into them.
import './chart-appointments.js';
import './chart-visit-notes.js';
import './chart-notes.js';
import './chart-history.js';
import './chart-diagnoses.js';
import './chart-prescriptions.js';
import './chart-medications.js';
import './chart-allergies.js';
import './chart-orders.js';
import './chart-vitals.js';
import './chart-profile.js';
import './chart-profile-clinical.js';
/* chart-profile-billing.js ("Insurance") is deliberately NOT imported: the
   section left the sidebar on 21 Aug 2026, and registerModule() warns about
   any module whose id is no longer in CHART_NAV. Restore this line together
   with the CHART_NAV row to bring the tab back. */
import './chart-forms.js';
import './chart-tasks.js';
import './chart-billing.js';
import './chart-documents.js';
import { notify } from '../lib/toast.js';

/* ============================================================================
   HELPERS
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20-02-1961" → { d, m, y } or null. The data files' only date format. */
function parseDate(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return { d, m, y };
}

/** "20-02-1961" → "20 Feb 1961". Ambiguous numeric dates get misread. */
function formatDate(value) {
  const parts = parseDate(value);
  if (!parts) return '—';
  return `${String(parts.d).padStart(2, '0')} ${MONTHS[parts.m - 1]} ${parts.y}`;
}

/** Sortable form, so two dates compare correctly as strings. */
function isoOf(value) {
  const parts = parseDate(value);
  if (!parts) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** Age from the date of birth, computed now rather than stored — a stored age
 *  is a fact with an expiry date. */
function ageFrom(dob) {
  const parts = parseDate(dob);
  if (!parts) return null;
  const today = new Date();
  let age = today.getFullYear() - parts.y;
  const hadBirthday =
    today.getMonth() + 1 > parts.m ||
    (today.getMonth() + 1 === parts.m && today.getDate() >= parts.d);
  return hadBirthday ? age : age - 1;
}

/** Whole dollars. The billing section states the pennies. */
function money(amount) {
  return `$${Number(amount || 0).toLocaleString('en-US')}`;
}

/* ============================================================================
   STATE
   ========================================================================= */

const params = new URLSearchParams(location.search);
const mrn = params.get('mrn');
const patient = PATIENTS[mrn] || PATIENTS[DEFAULT_MRN];

const state = {
  module: 'profile-clinical',
};

const els = {
  side: document.getElementById('chartSide'),
  header: document.getElementById('chartHeader'),
  workspace: document.getElementById('chartWorkspace'),
  alertModal: document.getElementById('alertModal'),
  flagModal: document.getElementById('flagModal'),
  printModal: document.getElementById('printModal'),
  alertsSummaryModal: document.getElementById('alertsSummaryModal'),
};

/**
 * What a chart-wide action wants the module it is landing in to do the moment
 * it arrives — `{ action, trigger }` — or null on an ordinary navigation.
 *
 * Refer Out is the reason this exists. The button is in the banner, but the
 * form it opens belongs to Orders: a referral raised from the banner has to
 * end up on the orders record beside every other referral, so the banner must
 * not grow a second form of its own that writes somewhere else. Set
 * immediately before the panel is painted and cleared immediately after, so a
 * module sees it only on the render the action caused.
 */
let pendingIntent = null;

/** Handed to every module, so a module never reaches for globals. This shape
 *  is the contract the fifteen modules are written to. */
const ctx = {
  patient,
  get age() {
    return ageFrom(patient.dob);
  },
  /** See pendingIntent — null on every render but the one an action asked for. */
  get intent() {
    return pendingIntent;
  },
  go: (id) => go(id),
  flash: (message, tone) => flash(message, tone),
};

/* ============================================================================
   FLASH — a report on something already done, over the corner of the window.

   It was a status line between the chart header and the workspace. Every
   module in the chart writes to it, and each time it appeared the whole
   workspace — a long scrolling module, often mid-read — shifted down by the
   height of the line and back up again six seconds later. The words are the
   same; they now land in the shared toast region with everything else the
   product says after an action.
   ========================================================================= */

function flash(message, tone = 'info') {
  const toast = notify(message, tone);
  /* The chart specs reached for the old bar by name. Keeping the hook on the
     toast that replaced it saves rewriting a dozen assertions to say the same
     thing about a different element. */
  toast.dataset.testid = 'chart--flash';
  return toast;
}

/* ============================================================================
   SIDEBAR

   A plain list of sections down the left of the body card. The active row is
   marked with a bar on the edge it is attached to, and tinted behind, rather
   than filled like a pill: a bar reads as "you are in this branch of the
   page" — it is drawn on the join between the rail and the panel it opens —
   where a filled pill reads as a button that has been pressed, and nobody
   presses a location.
   ========================================================================= */

function navRow(item) {
  const isActive = state.module === item.id;
  return `<li class="ch__nav-item">
      <button type="button"
        class="ch__nav-link${isActive ? ' ch__nav-link--active' : ''}"
        data-nav="${item.id}" tabindex="-1" title="${esc(item.label)}"
        ${isActive ? 'aria-current="page"' : ''}
        data-testid="chart--nav-${item.id}">
        ${icon(item.icon)}
        <span class="ch__nav-label">${esc(item.label)}</span>
      </button>
    </li>`;
}

function renderSidebar() {
  els.side.innerHTML = `
    <nav class="ch__nav" aria-label="Patient chart sections">
      <ul class="ch__nav-list">${CHART_NAV.map(navRow).join('')}</ul>
    </nav>`;

  // Roving tabindex: the rail is one Tab stop and the arrows move inside it.
  // Sixteen sections between Tab and the workspace is what makes a sidebar
  // unusable by keyboard.
  const first =
    els.side.querySelector('.ch__nav-link--active') || els.side.querySelector('.ch__nav-link');
  if (first) first.tabIndex = 0;
}

function navButtons() {
  return [...els.side.querySelectorAll('.ch__nav-link')];
}

function focusNav(button) {
  if (!button) return;
  for (const other of navButtons()) other.tabIndex = -1;
  button.tabIndex = 0;
  button.focus();
}

els.side.addEventListener('click', (event) => {
  const link = event.target.closest('.ch__nav-link');
  if (link) go(link.dataset.nav);
});

els.side.addEventListener('keydown', (event) => {
  const buttons = navButtons();
  const index = buttons.indexOf(document.activeElement);
  if (index === -1) return;

  const moves = {
    ArrowDown: index + 1,
    ArrowUp: index - 1,
    Home: 0,
    End: buttons.length - 1,
  };
  if (event.key in moves) {
    event.preventDefault();
    const next = Math.max(0, Math.min(buttons.length - 1, moves[event.key]));
    focusNav(buttons[next]);
    return;
  }

  /* Type-ahead, the same as any long list of named things: press o and the
     focus lands on Orders. It searches from the row AFTER the current one and
     wraps, so pressing the same letter twice walks the sections that share
     it rather than sitting on the first one. */
  if (event.key.length === 1 && /\S/.test(event.key) && !event.altKey && !event.ctrlKey) {
    const letter = event.key.toLowerCase();
    const ordered = [...buttons.slice(index + 1), ...buttons.slice(0, index + 1)];
    const match = ordered.find((button) =>
      button.querySelector('.ch__nav-label')?.textContent.toLowerCase().startsWith(letter)
    );
    if (match) {
      event.preventDefault();
      focusNav(match);
    }
  }
});

/* ============================================================================
   THE PATIENT BANNER

   One card, four columns: who they are, how to reach them, the three
   read-outs, and the chart-wide actions. The order is the order the questions
   get asked at a desk with the patient standing at it.
   ========================================================================= */

function photoMarkup() {
  if (patient.photo) {
    return `<img class="ch__photo" src="${esc(patient.photo)}" alt="${esc(patient.name)}" />`;
  }
  const initials = patient.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase();
  return `<span class="ch__photo ch__photo--initials" aria-hidden="true">${esc(initials)}</span>`;
}

function identityBadges() {
  const age = ageFrom(patient.dob);
  const isMinor = age !== null && age < 18;
  const active = patient.status === 'active';

  return `${
    isMinor
      ? `<ui-badge status="info" size="sm" data-testid="chart--minor-badge">Minor</ui-badge>`
      : ''
  }
    <ui-badge status="${active ? 'success' : 'neutral'}" size="sm"
      data-testid="chart--status-badge">${active ? 'Active' : 'Inactive'}</ui-badge>`;
}

/* ============================================================================
   IDENTITY FLAGS — on the name line, not in a box of their own.

   The standing facts that change how the person in front of you is treated
   (see FLAG_TYPES in data/patient-chart.js), set as a pill row directly after
   the name. A flag is read WITH the name — "Henna West, allergy, fall risk"
   is one sentence — and this shell used to make it two by putting the flags
   in a box three columns away, where the eye reaches them after the balance
   and the provider.

   Removing one still edits the record; see the ui-close handler further down.
   ========================================================================= */

function flagChips() {
  const flags = (patient.flags || [])
    .map((key) => ({ key, ...FLAG_TYPES[key] }))
    .filter((flag) => flag.label);

  const chips = flags.length
    ? flags
        .map(
          (flag) =>
            `<ui-chip removable data-flag="${flag.key}" data-testid="chart--flag">${esc(
              flag.label
            )}</ui-chip>`
        )
        .join('')
    : `<span class="ch__flags-empty">None</span>`;

  // The word "Flags" is not drawn — every chip already says what it is, and a
  // word introducing a row of labels is a label on a label — but it is still
  // announced, so the row is not read as loose adjectives after the name.
  return `<span class="ch__flags" role="group" aria-label="Flags" data-testid="chart--flags">
      <span class="u-sr-only">Flags</span>
      ${chips}
      <button type="button" class="ch__flags-add" data-flag-add
        aria-label="Add flag" title="Add flag"
        data-testid="chart--flag-add">${icon('plus')}</button>
    </span>`;
}

/** Date of birth, sex, language, phone, e-mail, address — always in the
 *  clear. Every one of them is used to confirm the right chart is open. */
function factsMarkup() {
  const age = ageFrom(patient.dob);
  const dobValue = `${formatDate(patient.dob)}${age === null ? '' : ` (${age} yrs)`}`;

  const facts = [
    ['calendar', 'Date of birth', dobValue],
    ['user', 'Gender', patient.gender],
    ['globe', 'Language', patient.language],
    ['phone', patient.phoneType || 'Phone', patient.phone],
    patient.email ? ['mail', 'Email', patient.email] : null,
    ['map-pin', 'Address', patient.address],
  ].filter(Boolean);

  return facts
    .map(
      ([glyph, label, value]) => `<div class="ch__fact">
        ${icon(glyph, 'ui-icon ch__fact-icon')}
        <span class="u-sr-only">${esc(label)}:</span>
        <span class="ch__fact-value" title="${esc(value)}">${esc(value)}</span>
      </div>`
    )
    .join('');
}

/* ============================================================================
   THE THREE READ-OUTS — Primary Provider · Patient Balance · Special Triggers

   Three bordered read-outs across the end of the banner, all built from the
   same pair: a small muted label with its value on the line below it. Label
   ABOVE value rather than beside it, because the values are the part that is
   scanned, and a leading label pushes every one of them to a different
   x-position — which is what the paired `dl` this replaces was doing.

   Four boxes stood here before, one of them holding nothing but the flags and
   another nothing but the quick note. Both of those belong WITH something
   else: a flag belongs with the name it qualifies, and a quick note belongs
   with the alert it sits under in Special Triggers. Folding them back leaves
   three boxes carrying three questions — who is responsible for this patient,
   what is outstanding on the account, and what has to be read before they are
   touched — which is what the design this shell is being fitted to states.

   White with a hairline rather than a sunken fill: these sit on a card on a
   grey ground, and a grey box inside a white card on a grey page is a hole in
   the card rather than a panel on it.
   ========================================================================= */

/** One "label over value" pair. `value` is already-escaped markup, because
 *  several of these carry a badge or a button rather than plain text. */
function boxPair(label, value) {
  return `<p class="ch__pair">
      <span class="ch__pair-label">${esc(label)}</span>
      <span class="ch__pair-value">${value}</span>
    </p>`;
}

function providerBox() {
  const status = PORTAL_STATES[patient.portal.state] || PORTAL_STATES.none;

  /* An active portal has nothing to invite anybody to. The offer only makes
     sense while the patient is still outside: "Send invite" when none has
     gone out, "Resend invite" when one has and nothing came of it. Leaving it
     on an active account is an invitation to send a second one to somebody
     already signed in. */
  const invite =
    patient.portal.state === 'active'
      ? ''
      : `<button type="button" class="ch__pair-link" data-action="portal-invite"
          data-testid="chart--portal-invite">${
            patient.portal.state === 'invited' ? 'Resend invite' : 'Send invite'
          }</button>`;

  return `<section class="ch__box ch__box--provider" data-testid="chart--provider-portal">
      ${boxPair('Primary Provider', esc(patient.provider.name))}
      ${boxPair('Last Visit', formatDate(patient.activity.lastVisitDate))}

      <!-- The portal pair is the one carrying controls rather than text, and
           the one whose label is short enough to sit BESIDE its value. Doing
           that costs the box a line, which is the difference between these
           three standing as tall as the identity block and standing taller. -->
      <p class="ch__pair ch__pair--portal">
        <span class="ch__pair-label">Portal</span>
        <span class="ch__pair-value">
          <ui-badge status="${status.tone}" size="sm">${status.label}</ui-badge>
          ${invite}
        </span>
      </p>
    </section>`;
}

/** What the patient owes and what the insurers still owe, one above the
 *  other. A single balance reads as the whole debt, and it never is. */
function balanceBox() {
  return `<section class="ch__box" data-testid="chart--balance">
      ${boxPair('Patient Balance', `<span class="ch__amount">${money(patient.balance)}</span>`)}
      ${boxPair('Insurance', `<span class="ch__amount">${money(patient.insuranceBalance)}</span>`)}
    </section>`;
}

/** Highest priority first, then most recent — the reading order that matters. */
function sortedAlerts() {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...(patient.alerts || [])].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || isoOf(b.date).localeCompare(isoOf(a.date))
  );
}

/**
 * Special Triggers — the highest-priority alert note in preview, not the list
 * itself, with the quick note under it. Two things that have to be read before
 * this patient is touched, in the one box coloured to be read.
 *
 * The count says how many alerts stand behind the one on show. The pencil
 * edits the quick note — which means putting the caret in the field already
 * sitting under it, not opening a second place to type the same sentence —
 * and the plus opens the categorised composer every alert is created through,
 * the same one pressing the preview opens.
 */
function triggersBox() {
  const alerts = sortedAlerts();
  const top = alerts[0];
  const overflow = alerts.length - 1;

  return `<section class="ch__box ch__box--warn" data-testid="chart--alert-note">
      <header class="ch__box-head">
        <p class="ch__box-label">
          Special Triggers
          ${overflow > 0 ? `<span class="ch__box-count">+${overflow}</span>` : ''}
        </p>
        <span class="ch__box-tools">
          <button type="button" class="ch__box-tool" data-edit-note
            aria-label="Edit quick note" title="Edit quick note"
            data-testid="chart--notes-edit">${icon('pencil')}</button>
          <button type="button" class="ch__box-tool" data-open-alerts
            aria-label="Add alert note" title="Add alert note"
            data-testid="chart--alert-add">${icon('plus')}</button>
        </span>
      </header>
      <div class="ch__box-body" data-testid="chart--notes">
        <button type="button" class="ch__box-note" data-open-alerts
          data-testid="chart--alert-note-open">
          ${top ? esc(top.title) : 'No alert notes — add one'}
        </button>
        <textarea class="ch__inline-edit" data-quick-note rows="2"
          placeholder="Add a quick note…" data-testid="chart--notes-input"
        >${esc(patient.quickNote || '')}</textarea>
      </div>
    </section>`;
}

/* ============================================================================
   THE ACTION RAIL

   The chart-wide actions, as a column of icon buttons at the far right of the
   banner. They belong to the CHART rather than to any one module, which is
   why they are not in the module's own action row: printing and messaging
   mean the same thing whichever section is open, and a control that moves
   when the panel changes gets hunted for every time.

   They sit banked against the right edge of the banner card, behind a
   hairline that separates them from the read-outs, so the row reads as
   "facts, then things to do with them".
   ========================================================================= */

/* NO "REFER OUT". It opened an Add Referral form on the Orders section, and
   that form has gone with the Referrals tab it lived on — referrals are raised
   and tracked on the Referrals screen, which is where the fax cover sheet, the
   packet and the reply live. A rail button that opened a second, thinner
   referral form inside the chart was a second place to raise the same thing,
   and the two records never met. */
const RAIL_ACTIONS = [
  ['print-summary', 'printer', 'Print chart'],
  ['message-patient', 'chat', 'Message patient'],
];

function actionRail() {
  return `<div class="ch__rail" role="group" aria-label="Chart actions">
      ${RAIL_ACTIONS.map(
        ([action, glyph, label]) => `<button type="button" class="ch__rail-btn"
          data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}"
          data-testid="chart--rail-${action}">${icon(glyph)}</button>`
      ).join('')}
    </div>`;
}

/**
 * The banner, in four columns: the photograph, the identity block (one
 * wrapping name line carrying the badges and flags, then the contact facts as
 * a grid), the three read-outs, and the action rail.
 *
 * DOB, phone, e-mail and address are always in the clear. A front-desk or
 * bedside chart that hides them behind a click costs more than it protects,
 * and every one of them is used to confirm the right patient is on screen.
 */
function renderHeader() {
  els.header.innerHTML = `
    <div class="ch__ident">
      <div class="ch__who">
        ${photoMarkup()}

      <div class="ch__ident-main">
        <div class="ch__name-line">
          <h1 class="ch__name" data-testid="chart--name">${esc(patient.name)}</h1>
          <span class="ch__mrn" data-testid="chart--mrn">
            <span class="u-sr-only">MRN</span> (${esc(patient.mrn)})
          </span>
          ${identityBadges()}
          ${flagChips()}
        </div>

        <div class="ch__facts">${factsMarkup()}</div>
      </div>
      </div>

      <div class="ch__boxes">
        ${providerBox()}
        ${balanceBox()}
        ${triggersBox()}
      </div>

      ${actionRail()}
    </div>`;
}

/* ============================================================================
   BANNER EVENTS
   ========================================================================= */

els.header.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-alerts]')) {
    els.alertModal?.open?.(event.target.closest('[data-open-alerts]'));
    return;
  }

  if (event.target.closest('[data-flag-add]')) {
    openFlagPicker(event.target.closest('[data-flag-add]'));
    return;
  }

  // The pencil on Special Triggers has nothing to open: the quick note is
  // already an editable field sitting under it, so "edit" means put the caret
  // in it. A modal here would be a second place to type the same sentence.
  if (event.target.closest('[data-edit-note]')) {
    els.header.querySelector('[data-quick-note]')?.focus();
    return;
  }

  const actionEl = event.target.closest('[data-action]');
  // The element goes with the action: an action that opens a dialog hands it
  // over as the trigger, so focus comes back to the button that was pressed.
  if (actionEl) runAction(actionEl.dataset.action, actionEl);
});

/** ui-chip fires ui-close on its remove button — take the flag off the record
 *  and repaint, rather than just hiding the chip. */
els.header.addEventListener('ui-close', (event) => {
  const chip = event.target.closest('[data-flag]');
  if (!chip) return;
  patient.flags = (patient.flags || []).filter((key) => key !== chip.dataset.flag);
  renderHeader();
});

/** The quick note is real, in-memory state — saved on blur, not on every
 *  keystroke, so a repaint mid-sentence never steals focus. */
els.header.addEventListener(
  'blur',
  (event) => {
    if (!event.target.matches('[data-quick-note]')) return;
    patient.quickNote = event.target.value.trim() || null;
  },
  true
);

function runAction(action, trigger) {
  switch (action) {
    case 'print-summary':
      openPrintPicker(trigger);
      return;

    case 'message-patient':
      location.href = 'communications.html';
      return;

    case 'portal-invite': {
      const target = patient.email || patient.phone;
      patient.portal.state = 'invited';
      patient.portal.invitationSent = todayDdMmYyyy();
      renderHeader();
      flash(`Portal invitation sent to ${target}.`, 'success');
      return;
    }

    default:
      return;
  }
}

/* ============================================================================
   PATIENT FLAGS — the one place a set of flags is managed.

   This was a tick list of the whole vocabulary: seven boxes, answered at once.
   It asked a question about flags in general when the two things a person
   opens this dialog to do are read what THIS chart carries and take one off,
   and it made removal an act of un-ticking — the one gesture in the product
   that removes a standing clinical fact, drawn as the same box that adds one.

   So the dialog is now a table of what is set, one row per flag, each row
   carrying the note that says what the flag asks of a reader and its own
   Remove. Adding is a separate, deliberate act above the table: a dropdown
   offering only what is NOT already on the chart, and an Add button. When the
   list is exhausted both controls disable rather than disappear, so the row
   does not move about as flags come and go.

   Nothing here touches the record until Save flags. The table edits `draft`,
   a copy taken when the dialog opens, which is what makes Cancel mean cancel
   — un-ticking a box used to be reversible only by remembering what had been
   ticked. Removing a chip from the banner still writes straight through, and
   is still the quicker way to drop a single flag.
   ========================================================================= */

/** The working copy the dialog edits. Replaced on every open; committed by
 *  Save flags, thrown away by Cancel or the × or Escape. */
let flagDraft = [];

/** Vocabulary order, never the order things were added — so the table and the
 *  chip row beside the name read the same way on every chart, and Allergy sits
 *  where Allergy sits. */
const inFlagOrder = (keys) => Object.keys(FLAG_TYPES).filter((key) => keys.includes(key));

function openFlagPicker(trigger) {
  if (!els.flagModal) return;
  flagDraft = inFlagOrder(patient.flags || []);
  renderFlagManager();
  els.flagModal.open(trigger);
}

/** Draw both halves of the dialog — the chooser and the table — from `draft`. */
function renderFlagManager() {
  const choice = document.getElementById('flagChoice');
  const addButton = document.getElementById('flagAdd');
  const table = document.getElementById('flagTable');
  if (!choice || !addButton || !table) return;

  /* The dropdown lists what is left. Offering a flag already on the chart
     would give the Add button a second meaning — "add, or quietly do nothing"
     — and the reader cannot tell which they are about to get from the option
     text alone. */
  const remaining = Object.keys(FLAG_TYPES).filter((key) => !flagDraft.includes(key));
  choice.setAttribute('value', '');
  choice.setAttribute(
    'placeholder',
    remaining.length ? 'Select a flag' : 'Every flag is already on this chart'
  );
  choice.toggleAttribute('disabled', remaining.length === 0);
  addButton.toggleAttribute('disabled', remaining.length === 0);
  /* `optionList`, not innerHTML: <ui-select> reads <option> children exactly
     once, when it upgrades, and rebuilds its own markup on every render — a
     list written into the tag after that is wiped by the next paint. */
  choice.optionList = remaining.map((key) => ({ value: key, label: FLAG_TYPES[key].label }));

  table.columns = [
    {
      key: 'label',
      label: 'Flag',
      narrow: true,
      render: (row) =>
        `<ui-badge status="${esc(FLAG_TYPES[row.key].tone)}" size="sm">${esc(row.label)}</ui-badge>`,
    },
    /* `wrap` rather than the single-line default: the note is a sentence, and
       clipped at the column edge it would say "Check glucose before sed…" —
       which is the half that does not change what anybody does. */
    { key: 'note', label: 'What it asks for', wrap: true },
    {
      key: 'remove',
      label: '<span class="u-sr-only">Actions</span>',
      actions: true,
      render: (row) =>
        `<button type="button" class="ch__flag-remove" data-flag-remove="${esc(row.key)}"
          aria-label="Remove the ${esc(row.label)} flag">${icon('trash')}</button>`,
    },
  ];

  const rows = flagDraft.map((key) => ({ key, ...FLAG_TYPES[key] }));
  table.rows = rows;
  table.setAttribute('state', rows.length ? 'ready' : 'empty');

  /* The table redraws its own cells, so the buttons in it are new elements
     every time and are wired here rather than through one delegated listener
     — the same shape chart-allergies.js uses for its row actions. */
  table.querySelectorAll('[data-flag-remove]').forEach((button) =>
    button.addEventListener('click', () => {
      flagDraft = flagDraft.filter((key) => key !== button.dataset.flagRemove);
      renderFlagManager();
    })
  );
}

document.getElementById('flagAdd')?.addEventListener('ui-click', () => {
  const choice = document.getElementById('flagChoice');
  const key = choice?.value;
  if (!key || !FLAG_TYPES[key] || flagDraft.includes(key)) return;
  flagDraft = inFlagOrder([...flagDraft, key]);
  renderFlagManager();
});

document.getElementById('flagCancel')?.addEventListener('ui-click', () => els.flagModal?.close());

document.getElementById('flagSave')?.addEventListener('ui-click', () => {
  patient.flags = inFlagOrder(flagDraft);

  els.flagModal?.close();
  renderHeader();
  flash(
    patient.flags.length
      ? `Flags updated — ${patient.flags.map((key) => FLAG_TYPES[key].label).join(', ')}.`
      : 'All flags cleared.',
    'success'
  );
});

/* ============================================================================
   PRINT CHART — which sections, then print.

   The button used to call window.print() on whatever section happened to be
   open. A chart is printed for a reason — a referral pack, a records request,
   a patient asking for their medication list — and each reason names a
   different handful of sections, none of which is "whichever tab I last
   clicked".

   The prototype cannot render sixteen modules into one document without
   opening each of them, so what it does is honest about that: it prints the
   chart with the chosen sections named on the sheet, and says what was asked
   for. The choosing is the part that has to exist for the flow to be
   reviewable; the composition is the part a real build owns.
   ========================================================================= */

/** Sections chosen last time, so a second print of the same pack is one click.
 *  Starts as the whole chart — the commonest request is "all of it". */
let printSections = CHART_NAV.map((item) => item.id);

function openPrintPicker(trigger) {
  const host = document.getElementById('printPicks');
  if (!host || !els.printModal) return;

  const on = new Set(printSections);
  host.innerHTML = CHART_NAV.map(
    (item) => `<label class="ch__print-pick">
      <input type="checkbox" data-print-pick="${item.id}" ${on.has(item.id) ? 'checked' : ''} />
      ${icon(item.icon)}
      <span>${esc(item.label)}</span>
    </label>`
  ).join('');

  syncPrintCount();
  els.printModal.open(trigger);
}

const printBoxes = () => [...document.querySelectorAll('[data-print-pick]')];

/** The running tally over the list. Sixteen tick boxes is more than a reader
 *  counts by looking, and "all of it" and "all but Billing" are two different
 *  print jobs that look identical at a glance — so the dialog says which one
 *  is loaded. It is also the only acknowledgement Select all and Clear get:
 *  pressing a button that silently reshapes a grid you are not looking at
 *  reads as a button that did nothing. */
function syncPrintCount() {
  const label = document.getElementById('printCount');
  if (!label) return;

  const boxes = printBoxes();
  const chosen = boxes.filter((box) => box.checked).length;

  /* "None" rather than "0 of 16", because zero is the one count that stops
     the Print button, and a number reads as a quantity where a word reads as
     a state. */
  label.textContent = chosen
    ? `${chosen} of ${boxes.length} sections`
    : 'No sections chosen';
}

/* One listener on the container rather than sixteen on the boxes, and it
   survives the repaint that openPrintPicker() does on every open. */
document
  .getElementById('printPicks')
  ?.addEventListener('change', (event) => {
    if (event.target.matches('[data-print-pick]')) syncPrintCount();
  });

document.getElementById('printAll')?.addEventListener('ui-click', () => {
  printBoxes().forEach((box) => {
    box.checked = true;
  });
  syncPrintCount();
});

document.getElementById('printNone')?.addEventListener('ui-click', () => {
  printBoxes().forEach((box) => {
    box.checked = false;
  });
  syncPrintCount();
});

document.getElementById('printCancel')?.addEventListener('ui-click', () => els.printModal?.close());

document.getElementById('printConfirm')?.addEventListener('ui-click', () => {
  const chosen = printBoxes()
    .filter((box) => box.checked)
    .map((box) => box.dataset.printPick);

  /* Nothing ticked is not a print job. Said in the flash rather than by
     disabling the button, because a disabled Print with no explanation reads
     as broken. */
  if (!chosen.length) {
    flash('Choose at least one section to print.', 'warning');
    return;
  }

  printSections = CHART_NAV.map((item) => item.id).filter((id) => chosen.includes(id));
  els.printModal?.close();

  const names = printSections.map((id) => moduleTitle(id));
  flash(`Printing ${names.length} section${names.length === 1 ? '' : 's'}: ${names.join(', ')}.`);
  window.print();
});

/* ============================================================================
   ADD ALERT NOTE — the one way an alert is created.
   ========================================================================= */

document.getElementById('alertCancel')?.addEventListener('ui-click', () => {
  els.alertModal?.close();
});

document.getElementById('alertSave')?.addEventListener('ui-click', () => {
  const titleField = document.getElementById('alertTitle');
  const bodyField = document.getElementById('alertBody');
  const category = document.getElementById('alertCategory');
  const priority = document.getElementById('alertPriority');

  const title = (titleField?.value || '').trim();
  if (!title) {
    titleField?.setAttribute('error', 'An alert note needs a subject.');
    return;
  }
  titleField?.removeAttribute('error');

  patient.alerts = patient.alerts || [];
  patient.alerts.unshift({
    id: `al-${patient.alerts.length + 1}-${Date.now()}`,
    category: (category?.value || 'Clinical').toLowerCase(),
    priority: (priority?.value || 'Medium').toLowerCase(),
    title,
    body: (bodyField?.value || '').trim(),
    author: 'Dr. Amara Mensah',
    date: todayDdMmYyyy(),
  });

  if (titleField) titleField.value = '';
  if (bodyField) bodyField.value = '';

  els.alertModal?.close();
  renderHeader();
  flash('Alert note added to the chart.', 'success');
});

/* ============================================================================
   ALERTS AND DUE RECOMMENDATIONS — a read-only digest shown every time a
   chart is opened (see BOOT below). Distinct from #alertModal, which composes
   a new alert note.

   This is the one part of the chart that outlived the shell it was written
   for. When the two designs were being compared each drew its own digest,
   and the other one drew it shorter: no test id on the lede, a line break
   where the due date wanted a second line, a priority badge on every row
   including the ones meant to stay quiet, and "Review in chart" offered on
   charts with nothing to review. This version is the finished one, so it is
   the one that stayed.

   It is the first thing anyone sees on a chart, and it is read standing up
   with the patient already in the room, so it answers the three questions in
   the order they actually get asked:

     1. Is there anything here I have to act on?   — the banner at the top
     2. What is it?                                — the alerts, worst first
     3. What has been missed?                      — the recommendations,
                                                     overdue first

   Nothing has been dropped to do that. Priority, author and date are all
   still on every alert; they have simply been sorted into the row's three
   lines by how urgently they are needed — severity in the rail and the badge,
   the sentence in the middle, provenance in the quiet line underneath.

   The rows are deliberately NOT the .fs__alert markup Profile · Clinical
   uses. That one is a button: it has a chevron, a hover fill and a pointer
   cursor because it expands. Here there is nothing to expand — every word is
   already on screen — and a row that invites a click it cannot honour is the
   single most confusing thing a read-only dialog can do.
   ========================================================================= */

/** Whole days from today to a "dd-mm-yyyy" date; negative once it is past. */
function daysUntil(value) {
  const parts = parseDate(value);
  if (!parts) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(parts.y, parts.m - 1, parts.d) - today) / 86400000);
}

/** Plural without the "(s)" — "1 day", "3 days". */
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * A date only becomes a decision once you know how far away it is. "01 Oct
 * 2025" needs arithmetic done in the reader's head; "11 months overdue" does
 * not, and it is the half of the cell that decides whether anyone acts.
 * Units coarsen with distance for the same reason — nobody schedules a 2035
 * screening to the day.
 */
function duePhrase(days) {
  const past = days < 0;
  const n = Math.abs(days);
  if (n === 0) return 'due today';

  let span;
  if (n < 31) span = plural(n, 'day');
  else if (n < 365) span = plural(Math.max(1, Math.round(n / 30)), 'month');
  else span = plural(Math.max(1, Math.round(n / 365)), 'year');

  return past ? `${span} overdue` : `due in ${span}`;
}

/** Overdue first, then soonest — the order they need working through. */
function sortedRecommendations(recs) {
  return [...recs].sort((a, b) => isoOf(a.dueDate).localeCompare(isoOf(b.dueDate)));
}

function isOverdue(rec) {
  return isoOf(rec.dueDate) < isoOf(todayDdMmYyyy());
}

function dueDateCell(rec) {
  const days = daysUntil(rec.dueDate);
  const overdue = isOverdue(rec);
  return `<span class="ch__due">
      <span class="ch__due-date${overdue ? ' ch__due-overdue' : ''}">${esc(
        formatDate(rec.dueDate)
      )}</span>
      ${
        days === null
          ? ''
          : `<span class="ch__due-note${overdue ? ' ch__due-note--overdue' : ''}">${esc(
              duePhrase(days)
            )}</span>`
      }
    </span>`;
}

const DUE_RECOMMENDATIONS_COLUMNS = [
  { key: 'label', label: 'Recommendation' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'dueDate', label: 'Due', render: dueDateCell },
];

/** The glyph that says which desk an alert belongs to, so the category reads
 *  before the word next to it does. */
const ALERT_CATEGORY_ICONS = {
  clinical: 'stethoscope',
  administrative: 'clipboard',
  scheduling: 'calendar',
  billing: 'dollar',
};

/** One glyph per priority, carried in the coloured rail. Colour alone would
 *  leave the severity unreadable to anyone who cannot separate red from
 *  amber — the shape has to say it too. */
const ALERT_PRIORITY_ICONS = { high: 'critical', medium: 'warning', low: 'info' };

function alertsSummaryAlertsMarkup(alerts) {
  if (!alerts.length) return `<p class="fs__empty" style="padding-left:0">No active alerts.</p>`;

  return `<ul class="ch__digest-list">
      ${alerts
        .map((alert) => {
          const category = ALERT_CATEGORIES[alert.category] || ALERT_CATEGORIES.clinical;
          const priority = ALERT_PRIORITIES[alert.priority] || ALERT_PRIORITIES.low;
          return `<li class="ch__digest-alert ch__digest-alert--${priority.tone}">
              <span class="ch__digest-alert-mark" aria-hidden="true">${icon(
                ALERT_PRIORITY_ICONS[alert.priority] || 'info'
              )}</span>
              <div class="ch__digest-alert-main">
                <div class="ch__digest-alert-head">
                  <h4 class="ch__digest-alert-title">${esc(alert.title)}</h4>
                  ${
                    /* Only the exceptions are labelled. A badge on all three
                       rows makes the badge mean "this is an alert", which the
                       reader already knew, and the low-priority one is the
                       row you want quiet. */
                    alert.priority === 'low'
                      ? ''
                      : `<ui-badge status="${priority.tone}" variant="outline" size="sm"
                    >${esc(priority.label)} priority</ui-badge
                  >`
                  }
                </div>
                <p class="ch__digest-alert-body">${esc(alert.body)}</p>
                <p class="ch__digest-alert-meta">
                  ${icon(
                    ALERT_CATEGORY_ICONS[alert.category] || 'info',
                    'ui-icon ch__digest-alert-meta-icon'
                  )}
                  <span>${esc(category.label)} · ${esc(alert.author)} · ${formatDate(
                    alert.date
                  )}</span>
                </p>
              </div>
            </li>`;
        })
        .join('')}
    </ul>`;
}

/**
 * The line under the heading. One sentence, no box: what in here is actually
 * pressing. It sits in the body text rather than a tinted panel because a
 * dialog that shouts on every chart opening stops being read on the one where
 * it mattered — and on a quiet chart it says so plainly instead of leaving
 * "nothing is wrong" to be inferred from an absence of colour.
 */
function alertsSummaryLedeMarkup(alerts, recs) {
  const high = alerts.filter((alert) => alert.priority === 'high').length;
  const overdue = recs.filter(isOverdue).length;

  const pressing = [];
  if (high) pressing.push(plural(high, 'high-priority alert'));
  if (overdue) pressing.push(`${plural(overdue, 'recommendation')} overdue`);

  if (!pressing.length) {
    const nothing = alerts.length || recs.length ? 'Nothing here is urgent or overdue.' : 'Nothing on file for this patient.';
    return `<p class="ch__digest-lede" data-testid="chart--alerts-summary-lede">${nothing}</p>`;
  }

  return `<p class="ch__digest-lede ch__digest-lede--${high ? 'critical' : 'warning'}"
      data-testid="chart--alerts-summary-lede">
      ${icon(high ? 'critical' : 'warning', 'ui-icon ch__digest-lede-icon')}
      <span>${esc(pressing.join(' and '))}.</span>
    </p>`;
}

/** A section heading, and only that. It used to carry its own count in
 *  brackets — "Alerts (3)" — on the argument that a section could then be
 *  skipped without being read. Nothing else in the product states a number on
 *  a label any more, and the rows are directly underneath: the reader is one
 *  glance from the real answer and does not have to trust a bracket for it. */
function digestSectionTitle(label) {
  return `<h3 class="ch__alerts-summary-title">${esc(label)}</h3>`;
}

function renderAlertsSummary() {
  const body = els.alertsSummaryModal?.querySelector('#alertsSummaryBody');
  if (!body) return;

  const alerts = sortedAlerts();
  const recs = sortedRecommendations(PROFILE_CLINICAL[patient.mrn]?.recommendations || []);

  body.innerHTML = `${alertsSummaryLedeMarkup(alerts, recs)}
    <section class="ch__alerts-summary-section" data-testid="chart--alerts-summary-alerts">
      ${digestSectionTitle('Alerts')}
      ${alertsSummaryAlertsMarkup(alerts)}
    </section>
    <section class="ch__alerts-summary-section" data-testid="chart--alerts-summary-recs">
      ${digestSectionTitle('Due Recommendations')}
      <ui-data-table data-testid="chart--alerts-summary-recs-table"></ui-data-table>
    </section>`;

  const table = body.querySelector('[data-testid="chart--alerts-summary-recs-table"]');
  table.columns = DUE_RECOMMENDATIONS_COLUMNS;
  table.rows = recs;
  table.setAttribute('state', recs.length ? 'ready' : 'empty');
  table.setAttribute('empty-text', 'No open recommendations.');

  /* Nothing to review means nothing to send anyone to review. The button is
     hidden with a style rather than the hidden attribute because ui-button
     sets its own display and would win over it. */
  const review = document.getElementById('alertsSummaryGoClinical');
  if (review) review.style.display = alerts.length || recs.length ? '' : 'none';
}

function openAlertsSummary() {
  if (!els.alertsSummaryModal) return;
  renderAlertsSummary();
  els.alertsSummaryModal.open();

  /* ui-modal focuses the first control that is not the ×, which here is
     "Review in chart" — so the dialog would open with the ring on the button
     that navigates, and a reflex Enter would take you somewhere rather than
     dismiss. The dismissal is the right default for a digest. */
  document.querySelector('#alertsSummaryClose button')?.focus();
}

document.getElementById('alertsSummaryClose')?.addEventListener('ui-click', () => {
  els.alertsSummaryModal?.close();
});

/* The digest is read-only, so the one thing it owes the reader is the way out
   to the place that is not. Profile · Clinical is where both of these lists
   are maintained, and it is also the chart's default section — so simply
   setting the hash would, in the common case of arriving with no hash at all,
   dismiss the dialog onto a screen that had not visibly changed and read as a
   button that did nothing. It scrolls the Alerts card into view as well,
   which is the part of that section the reader was sent for. */
document.getElementById('alertsSummaryGoClinical')?.addEventListener('ui-click', () => {
  els.alertsSummaryModal?.close();
  go('profile-clinical');
  els.workspace
    ?.querySelector('[data-testid="chart--pc-alerts"]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ============================================================================
   ROUTING — the section is the fragment, the patient is the query string, so
   either can change without the other reloading.
   ========================================================================= */

function moduleFromHash() {
  const id = location.hash.replace('#', '');
  return MODULE_IDS.includes(id) ? id : 'profile-clinical';
}

function go(id, intent = null) {
  if (!MODULE_IDS.includes(id)) return;
  pendingIntent = intent;

  /* Keyed off the ADDRESS BAR rather than off state.module, and the
     difference matters exactly once: on a chart opened with no fragment at
     all. The chart shows Clinical in that case, so state.module already says
     `profile-clinical` while the URL says nothing — and the digest's "Review
     in chart" sends the reader to precisely that section. Comparing against
     state.module would make that a no-op: the dialog would close onto a page
     that had not visibly changed, at an address that still did not say where
     it was, and the button would read as one that does nothing. Comparing
     against the hash writes it, which both moves the address bar and leaves a
     back step to return by. */
  if (location.hash === `#${id}`) {
    // Already there, so no hashchange is coming. An ordinary navigation is a
    // no-op at that point; an intent still has to reach the module, and the
    // render IS how a module is told what to open.
    if (intent) show(id);
    return;
  }
  location.hash = id;
}

function show(id) {
  state.module = id;
  document.title = `GastroEMR — ${patient.name} · ${moduleTitle(id)}`;
  renderSidebar();
  renderWorkspace(id, els.workspace, ctx);
  // Spent. A module reads the intent while it renders; anything that repaints
  // the panel afterwards must not open the same dialog a second time.
  pendingIntent = null;
  els.workspace.scrollTop = 0;
}

window.addEventListener('hashchange', () => show(moduleFromHash()));

/* ============================================================================
   GLOBAL KEYS

   Alt+C only. Anything richer would collide with the browser's own
   shortcuts, and a chart shortcut that steals Ctrl+P from Print Chart is
   worse than no shortcut.
   ========================================================================= */

document.addEventListener('keydown', (event) => {
  if (!event.altKey || event.ctrlKey || event.metaKey) return;

  const inField = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (inField) return;

  if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    focusNav(
      els.side.querySelector('.ch__nav-link--active') || els.side.querySelector('.ch__nav-link')
    );
  }
});

/* ============================================================================
   BOOT
   ========================================================================= */

// The MRN in the address bar and the patient on screen must always agree.
if (patient.mrn !== mrn) {
  params.set('mrn', patient.mrn);
  history.replaceState(null, '', `?${params}${location.hash}`);
}

renderHeader();
show(moduleFromHash());

// Every chart opening, with no "already seen" state to suppress it: a digest
// that goes quiet after the first look is one nobody reads on the visit it
// mattered for, and the cost of showing it again is one keystroke.
openAlertsSummary();
