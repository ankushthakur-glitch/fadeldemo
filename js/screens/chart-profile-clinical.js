/**
 * PROFILE · CLINICAL — the full clinical record.
 *
 * Everything the Face Sheet used to show (allergies, diagnoses, medications,
 * immunizations, social history, procedures, vitals) lives here now, in the
 * same card-grid visual language, plus the sections the Face Sheet never had
 * room for: a running summary, the full alert list, medical orders,
 * screening recommendations, recalls, diagnostic studies, implantable
 * devices and family history. Reference: the attached CustomEMR "Clinical"
 * tab screenshots.
 *
 * Alerts and the upcoming appointment are read from data/patient-chart.js
 * (patient.alerts, patient.activity.upcoming) rather than duplicated in
 * data/profile-clinical.js — one source of truth for both the header and
 * this module.
 */
import { registerModule } from './chart-workspace.js';
import {
  PROFILE_CLINICAL,
  EMPTY_PROFILE_CLINICAL,
  CHART_FORMULARY,
} from '../../data/profile-clinical.js';
import { ALERT_CATEGORIES, ALERT_PRIORITIES } from '../../data/patient-chart.js';
/* The three History lists, read from the file the History section maintains
   rather than copied into this one. These cards are a GLANCE at that record —
   they show it and link across to it with "View All"; the section owns adding
   to it, correcting it and taking things off it. Two forms writing the same
   three lists from two screens is how the two screens end up disagreeing. */
import {
  CHART_HISTORY,
  EMPTY_CHART_HISTORY,
  PAST_MEDICAL_STATUS_TONE,
  SOCIAL_HISTORY_CATEGORIES,
} from '../../data/chart-history.js';

/* ============================================================================
   SMALL HELPERS — duplicated rather than shared, matching how every other
   screen in this app keeps its own tiny date/escape helpers local.
   ========================================================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return { d, m, y };
}

function formatDate(value) {
  const parts = parseDate(value);
  if (!parts) return '—';
  return `${String(parts.d).padStart(2, '0')} ${MONTHS[parts.m - 1]} ${parts.y}`;
}

function isoOf(value) {
  const parts = parseDate(value);
  if (!parts) return '';
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

function weekday(value) {
  const parts = parseDate(value);
  if (!parts) return '';
  return new Date(parts.y, parts.m - 1, parts.d).toLocaleDateString('en-US', { weekday: 'long' });
}

/** yyyy-mm-dd (what a native date input returns) → dd-mm-yyyy, the data
 *  file's only date format. */
function fromIso(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}-${m}-${y}` : null;
}

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

const SEVERITY_TONE = { Severe: 'critical', Moderate: 'warning', Mild: 'neutral' };
const PROBLEM_TONE = { Active: 'warning', New: 'info', Resolved: 'success' };

/* ============================================================================
   CARD SHELL — same contract Profile · Billing uses: uppercase title, an
   optional stubbed "+", an optional "View All", a bulleted body.
   ========================================================================= */

function cardShell({ title, note, add, view, eyebrow, group: groupLabel, bodyHtml, testid }) {
  // data-pc-card is what the drag handler moves: the card's key is its testid,
  // so the thing on screen and the thing in the column order are the same
  // name in both directions.
  return `<section class="fs__card" data-pc-card="${testid}" data-testid="chart--pc-${testid}">
      <header class="fs__card-head">
        <button type="button" class="fs__grip" data-pc-grip
          aria-label="Reorder ${esc(title)}" title="Drag to reorder"
          data-testid="chart--pc-grip-${testid}">${icon('grip')}</button>
        <h3 class="fs__card-title">${esc(title)}${
          note ? ` <span class="fs__title-note">(${esc(note)})</span>` : ''
        }</h3>
        ${
          add
            ? `<button type="button" class="fs__add" data-pc-add="${esc(testid)}"
                 aria-label="Add ${esc(add).toLowerCase()}" title="Add ${esc(add).toLowerCase()}"
                 data-testid="chart--pc-add-${testid}">
                 ${icon('plus-circle')}
               </button>`
            : ''
        }
        ${
          view
            ? `<button type="button" class="fs__view" data-pc-view="${view}"
                 data-testid="chart--pc-view-${testid}">View All</button>`
            : ''
        }
      </header>
      <div class="fs__card-body">
        ${eyebrow ? `<p class="fs__eyebrow">${esc(eyebrow)}</p>` : ''}
        ${groupLabel ? group(groupLabel) : ''}
        ${bodyHtml}
      </div>
    </section>`;
}

function emptyRow(text) {
  return `<li class="fs__empty">${esc(text)}</li>`;
}

/** Most cards here are just a list of "bold primary line, muted meta line"
 *  rows — one row-builder instead of restating the markup nine times. */
function simpleList(items, toRow, emptyText) {
  const body = items.length ? items.map(toRow).join('') : emptyRow(emptyText);
  return `<ul class="fs__list">${body}</ul>`;
}

/* ----------------------------------------------------------------------------
   ONE ENTRY SHAPE, AND EVERY CARD USES IT.

   The cards had drifted into nine different ways of saying the same thing —
   "Lab — CBC with differential", "Blood pressure: 128/82 mmHg", a bold name
   with a muted aside beside it, a date glued to a finding by a middle dot.
   Nine punctuations meant the eye had to work out the rule again on every
   card, and the rule was never the same twice.

   There is one rule now, and it is the reference EMR's:

     • Segment : Segment : Segment      the HEADLINE — the things that
                                        identify the entry, in order, joined
                                        by a colon
       Label - value                    a DETAIL line — a name, a hyphen, the
       Label - value                    fact. As many as the entry has.

   One bullet marks the entry, not each of its lines. Detail lines are single
   line and clip with an ellipsis, exactly as they do in the reference, with
   the full text on the element's title so nothing is actually lost. */

/** The headline's segments, in the order they identify the entry. Falsy
 *  segments drop out rather than leaving " : : " behind. A ui-badge segment
 *  goes in last and without a colon — a pill separates itself. */
const seg = (...parts) => parts.filter(Boolean).join(' <span class="fs__sep">:</span> ');

/** "Onset Date - 12 Jun 2019". The label and its hyphen are one span, so the
 *  hyphen stays with the name it belongs to when the line clips. */
const detail = (label, value, extraClass = '') =>
  `<p class="fs__item-meta${extraClass}" title="${esc(`${label} - ${stripTags(value)}`)}"
      ><span class="fs__meta-label">${esc(label)} -</span> ${value}</p>`;

/** A detail line the reference states without a name — a medication's route
 *  and schedule, an appointment's type and provider. */
const plainDetail = (value) =>
  `<p class="fs__item-meta" title="${esc(stripTags(value))}">${value}</p>`;

/** One entry: a headline, then its detail lines, under a single bullet. */
const entry = (headline, ...details) => `<li class="fs__item">
    <p class="fs__item-line">${headline}</p>
    ${details.filter(Boolean).join('')}
  </li>`;

/** The title attribute has to carry the text a reader would have seen, not
 *  the markup that draws it — a clipped line whose tooltip reads "<span
 *  class=..." is worse than no tooltip at all. */
function stripTags(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name against its value, in aligned columns with a dash between them —
 *  the vitals/social shape, where the names are a fixed set and lining them
 *  up is the point. The dash is its own column so the values start at one x
 *  position however long the longest name turns out to be. */
const pair = (label, value, empty) => `<p class="fs__pair">
    <span class="fs__pair-label">${esc(label)}</span>
    <span class="fs__dash" aria-hidden="true">&ndash;</span>
    <span class="fs__pair-value${empty ? ' fs__pair-value--empty' : ''}">${esc(value)}</span>
  </p>`;

/** A group heading inside a card body — "Open", "Upcoming". */
const group = (text) => `<p class="fs__group">${esc(text)}</p>`;

/* ============================================================================
   CARDS — active clinical picture
   ========================================================================= */

function summaryCard(notes) {
  const body = notes
    ? `<p class="fs__prose">${esc(notes)}</p>`
    : `<p class="fs__empty" style="padding-left:0">No summary notes on file.</p>`;
  return cardShell({ title: 'Summary / Notes', bodyHtml: body, testid: 'summary' });
}

/** Highest priority first, then most recent — same ordering the header's
 *  Alert Note preview uses, so "top of the list" means the same thing
 *  everywhere in the chart. */
function sortedAlerts(alerts) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...(alerts || [])].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || isoOf(b.date).localeCompare(isoOf(a.date))
  );
}

function alertsCard(alerts, openIds) {
  const sorted = sortedAlerts(alerts);
  const body = sorted.length
    ? sorted
        .map((alert) => {
          const open = openIds.has(alert.id);
          const category = ALERT_CATEGORIES[alert.category] || ALERT_CATEGORIES.clinical;
          const priority = ALERT_PRIORITIES[alert.priority] || ALERT_PRIORITIES.low;
          return `<li class="fs__alert fs__alert--${priority.tone}">
              <button type="button" class="fs__alert-head" data-pc-alert="${alert.id}"
                aria-expanded="${open}">
                <span class="fs__alert-title">${esc(alert.title)}</span>
                <ui-badge status="${category.tone}" size="sm">${category.label}</ui-badge>
                ${icon(open ? 'caret-up' : 'caret-down', 'ui-icon fs__alert-chevron')}
              </button>
              ${
                open
                  ? `<div class="fs__alert-body">
                       <p>${esc(alert.body)}</p>
                       <p class="fs__item-meta">${priority.label} priority · ${esc(
                         alert.author
                       )} · ${formatDate(alert.date)}</p>
                     </div>`
                  : ''
              }
            </li>`;
        })
        .join('')
    : emptyRow('No alert notes on this record.');

  return cardShell({
    title: 'Alerts',
    bodyHtml: `<ul class="fs__list fs__list--tight">${body}</ul>`,
    testid: 'alerts',
  });
}

function problemsCard(problems, openIds) {
  const body = problems.length
    ? problems
        .map((p) => {
          const open = openIds.has(p.code + p.date);
          return `<li class="fs__item">
              <button type="button" class="fs__expand" data-pc-problem="${p.code}${p.date}"
                aria-expanded="${open}"${p.note ? '' : ' disabled'}>
                ${
                  p.note
                    ? icon(open ? 'caret-down' : 'caret-right', 'ui-icon fs__expand-chevron')
                    : '<span class="fs__expand-chevron fs__expand-chevron--none"></span>'
                }
                <ui-badge status="${PROBLEM_TONE[p.status] || 'neutral'}" size="sm"
                  >${esc(p.status)}</ui-badge
                >
                <span class="fs__code">${esc(p.code)}</span>
                <span class="fs__dash">-</span>
                <span>${esc(p.label)}</span>
              </button>
              ${detail('Onset Date', formatDate(p.date), ' fs__item-meta--indent')}
              ${
                open && p.note
                  ? detail('Note', esc(p.note), ' fs__item-meta--indent')
                  : ''
              }
            </li>`;
        })
        .join('')
    : emptyRow('No problems recorded.');

  return cardShell({
    title: 'Problems / Diagnoses',
    add: 'Problems',
    bodyHtml: `<ul class="fs__list">${body}</ul>`,
    testid: 'problems',
  });
}

function medicationsCard(list, reconciliation) {
  const body = simpleList(
    list,
    (m) =>
      entry(
        seg(esc(m.name)),
        m.dose ? plainDetail(esc(m.dose)) : '',
        detail('Start Date', formatDate(m.startDate))
      ),
    'No active medications.'
  );
  const eyebrow = reconciliation
    ? `Reconciled ${formatDate(reconciliation.date)} by ${reconciliation.by}`
    : null;

  return cardShell({
    title: 'Current Medications',
    add: 'Medications',
    view: 'medications',
    eyebrow,
    bodyHtml: body,
    testid: 'medications',
  });
}

function allergiesCard(list) {
  const body = simpleList(
    list,
    (a) =>
      // Category, then substance, then how bad — the reference's
      // "Drug : Penicillin : Moderate", in that order. The reaction was
      // riding the headline as a muted aside, which put "Anaphylaxis, airway
      // involvement" in the quietest type on the row; it is a detail line of
      // its own now, above the onset date nobody reads in a hurry.
      entry(
        `${seg(esc(a.category), esc(a.substance))}
         <ui-badge status="${SEVERITY_TONE[a.severity] || 'neutral'}" size="sm"
           >${esc(a.severity)}</ui-badge
         >`,
        detail('Reaction', esc(a.reaction)),
        detail('Onset Date', formatDate(a.onsetDate))
      ),
    'No known allergies documented.'
  );
  return cardShell({
    title: 'Allergies',
    add: 'Allergies',
    view: 'allergies',
    bodyHtml: body,
    testid: 'allergies',
  });
}

/* ============================================================================
   CARDS — care activity
   ========================================================================= */

function ordersCard(orders) {
  // The order TYPE is a category and the description is the order, so the
  // two are no longer set at one weight either side of an em dash: "Lab"
  // steps back, "CBC with differential" is the headline. A closed order's
  // status is the one thing on its row that changed, and it is the half of
  // the date line worth looking at.
  const section = (label, list) => `
    ${group(label)}
    ${simpleList(
      list,
      (o) =>
        entry(
          seg(esc(o.type), esc(o.description), o.status ? esc(o.status) : ''),
          detail('Ordered', formatDate(o.date))
        ),
      `No ${label.toLowerCase()} orders.`
    )}
  `;

  return cardShell({
    title: 'Medical Orders',
    view: 'orders',
    bodyHtml: `${section('Open', orders.open)}${section('Recently Closed', orders.recentlyClosed)}`,
    testid: 'orders',
  });
}

function recommendationsCard(list) {
  const body = simpleList(
    list,
    (r) => entry(seg(esc(r.label), esc(r.frequency)), detail('Due', formatDate(r.dueDate))),
    'No open recommendations.'
  );
  return cardShell({ title: 'Recommendations', bodyHtml: body, testid: 'recommendations' });
}

/** Reads the shell's activity data — the same fact the header and the old
 *  Face Sheet Appointments card both showed, never duplicated here. */
function appointmentsCard(activity) {
  const upcoming = activity?.upcoming;
  // The reference states an appointment as a date-and-time headline with the
  // kind of visit under it — "08/27/2025, 2:00 PM - 2:30 PM" over
  // "Virtual : New (45min)". Same two lines here, and the "Upcoming" heading
  // that used to sit above them goes: the headline is the date, so a label
  // saying the date is in the future was the second statement of it.
  const body = upcoming
    ? `<ul class="fs__list">${entry(
        `<span class="fs__item-line--brand">${seg(
          `${weekday(upcoming.date)}, ${formatDate(upcoming.date)}`,
          esc(upcoming.time)
        )}</span>`,
        plainDetail(seg(esc(upcoming.type), esc(upcoming.provider)))
      )}</ul>`
    : `<ul class="fs__list">${emptyRow('No upcoming appointment.')}</ul>`;

  return cardShell({
    title: 'Future Appointments',
    view: 'appointments',
    bodyHtml: body,
    testid: 'appointments',
  });
}

function recallsCard(list) {
  const body = simpleList(
    list,
    (r) => entry(seg(esc(r.type), esc(r.status)), detail('Due', formatDate(r.date))),
    'No recalls due.'
  );
  return cardShell({ title: 'Recalls', bodyHtml: body, testid: 'recalls' });
}

function vitalsCard(list) {
  // "Blood pressure: 128/82 mmHg" set as one bold string made the name of the
  // measurement as loud as the measurement, and left the four readings
  // starting at four different x positions — so the column could not be
  // scanned, which is the only thing a vitals list is for.
  //
  // The timestamps are the other half of it. A set of vitals is taken in one
  // go, so "23 Oct 2025 · 12:00 PM" was printed under three of the four rows,
  // three times, in the same grey as the readings — three lines of noise
  // between the numbers someone is trying to compare. The stamp the set
  // shares is stated once above the card; only a reading taken at some other
  // time still carries its own, which is exactly when the date is worth
  // reading.
  const stampOf = (v) => `${formatDate(v.date)} · ${v.time}`;
  const stamps = list.map(stampOf);
  const shared = stamps.length && stamps.every((stamp) => stamp === stamps[0]) ? stamps[0] : null;
  const commonest = shared
    ? shared
    : stamps.reduce(
        (best, stamp) =>
          stamps.filter((s) => s === stamp).length > stamps.filter((s) => s === best).length
            ? stamp
            : best,
        stamps[0]
      );

  // ONE bullet for the set, not one per reading. A bullet marks an entry and
  // a set of vitals taken in one go is one entry — eight dots down the side
  // of a table say there are eight unrelated things here.
  const body = list.length
    ? `<ul class="fs__list"><li class="fs__item">
        ${list
          .map(
            (v) => `${pair(v.label, v.value)}${
              stampOf(v) === commonest
                ? ''
                : `<p class="fs__item-meta fs__item-meta--pair">${esc(stampOf(v))}</p>`
            }`
          )
          .join('')}
      </li></ul>`
    : `<ul class="fs__list">${emptyRow('No vitals recorded.')}</ul>`;
  return cardShell({
    title: 'Vitals',
    add: 'Vitals',
    view: 'vitals',
    note: list.length ? commonest.split(' · ')[0] : null,
    bodyHtml: body,
    testid: 'vitals',
  });
}

/* ============================================================================
   CARDS — history
   ========================================================================= */

function immunizationsCard(list) {
  const body = simpleList(
    list,
    (v) => entry(seg(esc(v.name)), detail('Date', formatDate(v.date))),
    'No immunizations on file.'
  );
  return cardShell({ title: 'Immunizations', add: 'Immunizations', bodyHtml: body, testid: 'immunizations' });
}

function dxStudiesCard(list) {
  // The finding was the tail of a grey run that began with the date. It is
  // the result of the study — it goes on its own line, and the date rides up
  // beside the study's name where a date belongs.
  const body = simpleList(
    list,
    (d) => entry(seg(esc(d.type), formatDate(d.date)), detail('Finding', esc(d.finding))),
    'No diagnostic studies on file.'
  );
  return cardShell({ title: 'Dx Studies', bodyHtml: body, testid: 'dx-studies' });
}

/**
 * PAST MEDICAL HISTORY — the background, not the problem list.
 *
 * The two sit one column apart and they are not the same card. Problems /
 * Diagnoses is what is being treated now, coded and billed from; this is what
 * the patient arrives with — the anaemia that resolved, the H. pylori that was
 * eradicated, the childhood asthma.
 */
function pastMedicalHistoryCard(list) {
  const body = simpleList(
    list,
    (h) =>
      entry(
        `${seg(esc(h.condition))} <ui-badge status="${
          PAST_MEDICAL_STATUS_TONE[h.status] || 'neutral'
        }" size="sm">${esc(h.status)}</ui-badge>`,
        detail('Onset', formatDate(h.onsetDate)),
        h.note ? detail('Note', esc(h.note)) : ''
      ),
    'No past medical history recorded.'
  );
  return cardShell({
    title: 'Past Medical History',
    view: 'history',
    bodyHtml: body,
    testid: 'past-medical-history',
  });
}

/**
 * SURGICAL HISTORY — what this card has always held, under the name the rest
 * of the building uses for it. It was called "Procedures" while its own empty
 * state read "No past surgical history", which is the tell: a card whose
 * title and whose empty line name two different things. "Procedures" also
 * collided with the procedure a patient is booked in for this morning, which
 * is an encounter and lives nowhere near here.
 */
function surgicalHistoryCard(list) {
  const body = simpleList(
    list,
    (p) => {
      const where = [p.surgeon, p.facility].filter(Boolean).join(', ');
      return entry(
        seg(esc(p.procedure), formatDate(p.date)),
        where ? detail('Performed by', esc(where)) : ''
      );
    },
    'No past surgical history.'
  );
  return cardShell({
    title: 'Surgical History',
    view: 'history',
    bodyHtml: body,
    testid: 'surgical-history',
  });
}

function implantableDevicesCard(list) {
  const body = simpleList(
    list,
    (d) => entry(seg(esc(d.device), formatDate(d.date))),
    'No implantable devices on file.'
  );
  return cardShell({ title: 'Implantable Devices', bodyHtml: body, testid: 'devices' });
}

function familyHistoryCard(list) {
  // This card had its hierarchy exactly inverted: "Mother" was the headline
  // and "Colorectal cancer, diagnosed age 68" the faint line under it. Nobody
  // opens family history to find out that the patient has a mother. The
  // condition is the headline; the relative qualifies it.
  const body = simpleList(
    list,
    (f) => entry(seg(esc(f.condition), esc(f.relation))),
    'No family history recorded.'
  );
  return cardShell({ title: 'Family History', add: 'Family history', bodyHtml: body, testid: 'family-history' });
}

/**
 * SOCIAL HISTORY — the questionnaire, drawn in full, answered or not.
 *
 * The card used to draw whatever the record happened to contain, so a chart
 * nobody had asked and a chart where every answer was "none" looked
 * identical: one line saying no social history recorded. The nine questions
 * are declared once in data/chart-history.js and all nine are drawn for
 * everybody, with the unanswered ones in the empty italic and their count in
 * the title. The gaps are what the panel is read for — "has anyone asked
 * about financial strain" only has an answer if the question is on the page.
 *
 * The same shape as Vitals, for the same reason: a fixed set of names against
 * their values, so one bullet marks the block and the answers line up in a
 * column that can be scanned.
 */
function socialHistoryCard(answers) {
  const asked = SOCIAL_HISTORY_CATEGORIES.filter((c) => answers[c.id]).length;

  const rows = SOCIAL_HISTORY_CATEGORIES.map((category) => {
    const answer = answers[category.id];
    return pair(
      category.label,
      answer ? answer.response : 'Not recorded',
      !answer
    );
  }).join('');

  return cardShell({
    title: 'Social History',
    note: `${asked} of ${SOCIAL_HISTORY_CATEGORIES.length} answered`,
    view: 'history',
    bodyHtml: `<ul class="fs__list fs__list--scroll" tabindex="0">
        <li class="fs__item fs__item--tight">${rows}</li>
      </ul>`,
    testid: 'social-history',
  });
}

/* ============================================================================
   ADD-TO-CARD MODAL — one popup shape reused by every card's "+", schema-
   driven per card the same way chart-forms.js drives its fill-out dialog.
   Future Appointments has no "+" and stays that way: scheduling is a real
   workflow (provider, slot, encounter type) this modal is deliberately too
   thin for — Schedule already owns that job.
   ========================================================================= */

const ADD_SCHEMAS = {
  problems: {
    label: 'Problem',
    dataKey: 'problems',
    fields: [
      { key: 'code', label: 'ICD-10 Code', required: true },
      { key: 'label', label: 'Diagnosis', required: true, wide: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'New', 'Resolved'], default: 'Active' },
      { key: 'date', label: 'Onset Date', type: 'date' },
      { key: 'note', label: 'Note', type: 'textarea', wide: true },
    ],
    build: (v) => ({ code: v.code, label: v.label, status: v.status || 'Active', date: v.date || null, note: v.note || null }),
  },

  medications: {
    label: 'Medication',
    dataKey: 'medications',
    fields: [
      /*
       * TYPED, WITH THE CLINIC'S OWN SIX UNDER IT.
       *
       * The field stays a plain text box because a reconciled list is mostly
       * drugs somebody else started, and a closed list cannot hold those. But
       * the drugs this practice writes itself are the ones typed over and
       * over, and typed by hand they arrive spelled six ways — "Omeprazole
       * 20mg", "omeprazole 20 mg cap", "Omperazole" — which is a med list that
       * cannot be counted or searched. `quickSelect` draws them under the box
       * as pressable rows carrying the drug, its class and the frequency it is
       * usually taken at, so the common case is one press and the rare case is
       * unchanged. See CHART_FORMULARY in data/profile-clinical.js for which
       * six, and why the frequency does not come from stock control.
       */
      {
        key: 'name',
        label: 'Medication Name',
        required: true,
        wide: true,
        quickSelect: CHART_FORMULARY,
      },
      { key: 'dose', label: 'Dose / Frequency' },
      { key: 'startDate', label: 'Start Date', type: 'date' },
    ],
    build: (v) => ({ name: v.name, dose: v.dose || null, startDate: v.startDate || null, status: 'active' }),
  },

  allergies: {
    label: 'Allergy',
    dataKey: 'allergies',
    fields: [
      { key: 'substance', label: 'Substance', required: true, wide: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Medication', 'Food', 'Environment', 'Other'], default: 'Medication' },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Severe', 'Moderate', 'Mild'], default: 'Moderate' },
      { key: 'reaction', label: 'Reaction', wide: true },
      { key: 'onsetDate', label: 'Onset Date', type: 'date' },
    ],
    build: (v) => ({ substance: v.substance, category: v.category || 'Medication', reaction: v.reaction || null, severity: v.severity || 'Moderate', onsetDate: v.onsetDate || null }),
  },

  immunizations: {
    label: 'Immunization',
    dataKey: 'immunizations',
    fields: [
      { key: 'name', label: 'Vaccine', required: true, wide: true },
      { key: 'date', label: 'Date Given', type: 'date' },
    ],
    build: (v) => ({ name: v.name, date: v.date || null }),
  },

  'family-history': {
    label: 'Family History',
    dataKey: 'familyHistory',
    fields: [
      { key: 'relation', label: 'Relation', required: true },
      { key: 'condition', label: 'Condition', required: true },
    ],
    build: (v) => ({ relation: v.relation, condition: v.condition }),
  },

  vitals: {
    label: 'Vital',
    dataKey: 'vitals',
    fields: [
      {
        key: 'label',
        label: 'Vital',
        type: 'select',
        options: ['Blood pressure', 'Heart rate', 'Respiratory rate', 'Temperature', 'O2 Saturation', 'BMI', 'Height', 'Weight'],
        required: true,
      },
      { key: 'value', label: 'Value', required: true },
      { key: 'date', label: 'Date', type: 'date', default: () => todayDdMmYyyy() },
      { key: 'time', label: 'Time', type: 'time' },
    ],
    build: (v) => ({ label: v.label, value: v.value, date: v.date || todayDdMmYyyy(), time: v.time || '—' }),
  },
};

function addFieldMarkup(field) {
  const testid = `chart--pc-field-${field.key}`;
  const wideClass = field.wide ? ' fs__field--wide' : '';
  const defaultValue = typeof field.default === 'function' ? field.default() : field.default;

  if (field.type === 'select') {
    return `<ui-select class="${wideClass.trim()}" label="${esc(field.label)}"
        options="${field.options.map(esc).join(',')}" value="${esc(defaultValue || '')}"
        data-testid="${testid}"></ui-select>`;
  }
  if (field.type === 'textarea') {
    return `<ui-textarea class="${wideClass.trim()}" label="${esc(field.label)}" rows="3"
        data-testid="${testid}"></ui-textarea>`;
  }
  if (field.type === 'date') {
    return `<ui-input class="${wideClass.trim()}" label="${esc(field.label)}" type="date"
        value="${defaultValue ? isoOf(defaultValue) : ''}" data-testid="${testid}"></ui-input>`;
  }
  if (field.type === 'time') {
    return `<ui-input class="${wideClass.trim()}" label="${esc(field.label)}" type="time"
        data-testid="${testid}"></ui-input>`;
  }
  return `<ui-input class="${wideClass.trim()}" label="${esc(field.label)}"
      data-testid="${testid}"></ui-input>`
    + quickSelectMarkup(field);
}

/**
 * The formulary rows that sit under a field declaring `quickSelect`.
 *
 * A sibling of the field rather than a child of it: the modal's body is a
 * two-column grid and these rows want the full width of it, which they can
 * only have by being a grid item themselves. They follow the box they fill
 * immediately, so "type it" and "press it" are one decision made in one
 * place, and the label above the rows says what they are for rather than
 * leaving a stack of unexplained buttons under an empty field.
 *
 * Each row carries the two facts it writes — the drug's name and the
 * frequency it is usually taken at — on the button, so pressing one is a
 * lookup of nothing: the handler reads its own dataset. The frequency is
 * offered, not imposed; it lands in the Dose / Frequency box where it can be
 * typed straight over, because "once daily" is the usual answer and not the
 * only one.
 */
function quickSelectMarkup(field) {
  const options = field.quickSelect || [];
  if (!options.length) return '';

  return `<section class="fs__formulary fs__field--wide" data-testid="chart--pc-formulary">
      <h4 class="fs__formulary-legend">Quick Select from Formulary:</h4>
      <div class="fs__formulary-list">
        ${options
          .map(
            (drug) => `<button type="button" class="fs__drug" aria-pressed="false"
              data-pc-drug="${esc(drug.name)}" data-pc-drug-dose="${esc(drug.usual || '')}"
              data-testid="chart--pc-drug-${esc(slug(drug.name))}">
              <strong>${esc(drug.name)}</strong>
              <span>${esc(drug.type)}${drug.usual ? ` &middot; ${esc(drug.usual)}` : ''}</span>
            </button>`
          )
          .join('')}
      </div>
    </section>`;
}

/** A testid-safe handle for a drug — "Omeprazole 20 mg Capsule" is not one. */
function slug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('profile-clinical', {
  /* The section's name is drawn, like every other section's. It was hidden
     here for a while on the argument that the lit sidebar entry three inches
     to the left already says "Clinical" — true, but it made this the one
     section whose head opened with empty space where the rest of the chart
     opens with its name, so moving between Insurance and Clinical moved the
     first line of the page. A heading that agrees with the sidebar costs a
     line; a head that changes shape per section costs the reader their place.

     There is no view strip either. The Timeline that used to sit beside the
     Face Sheet held no data of its own — every row in it was an entry from a
     card here, re-sorted by date — so it was a second reading of one record
     that had to be kept true to the first for as long as it existed. The
     record is read across the cards. */

  actions: () => `<ui-button variant="outline" size="sm" icon="printer"
      data-testid="chart--pc-print">Print Chart</ui-button>`,

  render(host, ctx) {
    const data = PROFILE_CLINICAL[ctx.patient.mrn] || EMPTY_PROFILE_CLINICAL;
    /* Read, never written — the "+" on these three cards is deliberately
       absent (see the card builders above), so this module has no reason to
       hold a copy. */
    const history = CHART_HISTORY[ctx.patient.mrn] || EMPTY_CHART_HISTORY;
    const openAlerts = new Set();
    const openProblems = new Set();

    /* --- The cards, and the order they are in ---------------------------
       Each card is a key and a builder rather than a call in the middle of a
       template, because the column order is state now: dragging a card by its
       grip moves its key between these arrays and repaints. A template
       literal cannot be re-ordered; a list of keys can. */
    const CARDS = {
      summary: () => summaryCard(data.summaryNotes),
      alerts: () => alertsCard(ctx.patient.alerts, openAlerts),
      problems: () => problemsCard(data.problems, openProblems),
      medications: () => medicationsCard(data.medications, data.medicationReconciliation),
      allergies: () => allergiesCard(data.allergies),
      orders: () => ordersCard(data.orders),
      recommendations: () => recommendationsCard(data.recommendations),
      recalls: () => recallsCard(data.recalls),
      appointments: () => appointmentsCard(ctx.patient.activity),
      vitals: () => vitalsCard(data.vitals),
      immunizations: () => immunizationsCard(data.immunizations),
      'dx-studies': () => dxStudiesCard(data.dxStudies),
      'past-medical-history': () => pastMedicalHistoryCard(history.pastMedical),
      'surgical-history': () => surgicalHistoryCard(history.surgical),
      devices: () => implantableDevicesCard(data.implantableDevices),
      'family-history': () => familyHistoryCard(data.familyHistory),
      'social-history': () => socialHistoryCard(history.social),
    };

    /* The third column is the HISTORY column: past medical, surgical, social
       and family, in the order a clinician asks for them, with the two cards
       that are also history — immunisations and diagnostic studies — under
       them. Implantable Devices moves to the second column to keep the three
       roughly even; it is empty for most patients and was the shortest thing
       in the stack. */
    const columns = [
      ['summary', 'alerts', 'problems', 'medications', 'allergies'],
      ['orders', 'recommendations', 'recalls', 'appointments', 'vitals', 'devices'],
      [
        'past-medical-history',
        'surgical-history',
        'social-history',
        'family-history',
        'immunizations',
        'dx-studies',
      ],
    ];

    /** Which column holds a key — the drag can cross columns, so neither end
     *  of a move can be assumed to be where the other one is. */
    const columnOf = (key) => columns.find((column) => column.includes(key));

    function moveCard(fromKey, toKey) {
      if (!fromKey || !toKey || fromKey === toKey) return;
      const from = columnOf(fromKey);
      const to = columnOf(toKey);
      if (!from || !to) return;

      from.splice(from.indexOf(fromKey), 1);
      // Dropped ON a card means "take its place" — insert before it, which is
      // what the outline drawn along its top edge during the drag promised.
      to.splice(to.indexOf(toKey), 0, fromKey);
      paint();
    }

    function faceSheetMarkup() {
      return `<div class="fs__grid" data-testid="chart--pc-grid">
          ${columns
            .map(
              (column) =>
                `<div class="fs__col">${column.map((key) => CARDS[key]()).join('')}</div>`
            )
            .join('')}
        </div>`;
    }

    function paint() {
      host.innerHTML = `
        ${faceSheetMarkup()}

        <ui-modal id="pcAddModal" heading="Add" size="md" data-testid="chart--pc-add-modal">
          <div id="pcAddBody"></div>
          <div slot="footer">
            <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--pc-add-cancel">Cancel</ui-button>
            <ui-button variant="primary" data-testid="chart--pc-add-save">Add</ui-button>
          </div>
        </ui-modal>`;
    }

    /* --- Add-to-card modal --------------------------------------------- */

    function openAddModal(cardKey, trigger) {
      const schema = ADD_SCHEMAS[cardKey];
      if (!schema) return;

      const modal = host.querySelector('#pcAddModal');
      const body = host.querySelector('#pcAddBody');
      modal.setAttribute('heading', `Add ${schema.label}`);
      body.dataset.pcAddKey = cardKey;
      body.innerHTML = `<div class="fs__grid fs__grid--2">
          ${schema.fields.map(addFieldMarkup).join('')}
        </div>`;

      modal.open(trigger);
    }

    function saveAddItem() {
      const body = host.querySelector('#pcAddBody');
      const cardKey = body.dataset.pcAddKey;
      const schema = ADD_SCHEMAS[cardKey];
      if (!schema) return;

      const field = (key) => {
        const el = body.querySelector(`[data-testid="chart--pc-field-${key}"]`);
        if (!el) return '';
        const raw = el.value;
        return typeof raw === 'string' ? raw.trim() : raw;
      };

      const values = {};
      for (const f of schema.fields) values[f.key] = field(f.key);

      const missing = schema.fields.filter((f) => f.required && !values[f.key]);
      if (missing.length) {
        missing.forEach((f) => {
          body
            .querySelector(`[data-testid="chart--pc-field-${f.key}"]`)
            ?.setAttribute('error', `Enter ${f.label.toLowerCase()}.`);
        });
        return;
      }

      // Date fields arrive as yyyy-mm-dd from the native input — convert
      // before handing off to build(), which expects this file's dd-mm-yyyy.
      for (const f of schema.fields) {
        if (f.type === 'date' && values[f.key]) values[f.key] = fromIso(values[f.key]);
      }

      const item = schema.build(values);
      const list = data[schema.dataKey];

      if (schema.upsertKey) {
        const existing = list.findIndex((row) => row[schema.upsertKey] === item[schema.upsertKey]);
        if (existing > -1) list[existing] = item;
        else list.push(item);
      } else {
        list.unshift(item);
      }

      host.querySelector('#pcAddModal')?.close();
      paint();
      ctx.flash(`${schema.label} added to the chart.`, 'success');
    }

    function onClick(event) {
      const alertToggle = event.target.closest('[data-pc-alert]');
      if (alertToggle) {
        const id = alertToggle.dataset.pcAlert;
        if (openAlerts.has(id)) openAlerts.delete(id);
        else openAlerts.add(id);
        paint();
        return;
      }

      const problemToggle = event.target.closest('[data-pc-problem]');
      if (problemToggle) {
        const id = problemToggle.dataset.pcProblem;
        if (openProblems.has(id)) openProblems.delete(id);
        else openProblems.add(id);
        paint();
        return;
      }

      /* --- A drug pressed off the formulary -----------------------------
         The press answers "which drug", and nothing else. The name goes in
         and the frequency box is filled ONLY if it is empty, then focused:
         "Once daily" is the usual answer for most of these six and a useful
         thing to find already there, but a frequency somebody has typed is
         the one they meant, and a quick-select that overwrites it is a
         quick-select nobody trusts twice. Same bargain the anaesthesia
         record's cart makes — see the [data-np-drug] handler in
         js/screens/clinic-visit.js.

         No repaint. The modal is drawn by paint() along with the rest of the
         page, so repainting here would tear the open dialog down around the
         press. The two fields are set in place instead. */
      const drugBtn = event.target.closest('[data-pc-drug]');
      if (drugBtn) {
        const body = host.querySelector('#pcAddBody');
        const nameField = body?.querySelector('[data-testid="chart--pc-field-name"]');
        const doseField = body?.querySelector('[data-testid="chart--pc-field-dose"]');
        if (nameField) {
          nameField.value = drugBtn.dataset.pcDrug;
          nameField.removeAttribute('error');
        }
        const usual = drugBtn.dataset.pcDrugDose;
        if (doseField && usual && !doseField.value) doseField.value = usual;

        /* Which row was pressed, said on the row itself. The field above it
           now reads the drug's name, but that box is also the box somebody
           may have typed into, so it cannot be the only answer to "did that
           press register". */
        for (const other of body?.querySelectorAll('[data-pc-drug]') ?? []) {
          other.classList.toggle('fs__drug--picked', other === drugBtn);
          other.setAttribute('aria-pressed', String(other === drugBtn));
        }

        doseField?.focus();
        return;
      }

      const addBtn = event.target.closest('[data-pc-add]');
      if (addBtn) {
        openAddModal(addBtn.dataset.pcAdd, addBtn);
        return;
      }

      const viewBtn = event.target.closest('[data-pc-view]');
      if (viewBtn) {
        ctx.go(viewBtn.dataset.pcView);
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--pc-add-save"]')) saveAddItem();
      if (event.target.closest('[data-testid="chart--pc-print"]')) window.print();
    }

    /* --- Re-ordering the cards -------------------------------------------
       A card is only draggable while its grip is held. Making the whole card
       draggable all the time is what stops anyone selecting a line of text
       inside it, and the text in these cards is there to be copied into notes
       and messages. */

    let dragKey = null;

    function onPointerDown(event) {
      const grip = event.target.closest('[data-pc-grip]');
      if (!grip) return;
      grip.closest('.fs__card')?.setAttribute('draggable', 'true');
    }

    function onDragStart(event) {
      const card = event.target.closest('.fs__card');
      if (!card) return;
      dragKey = card.dataset.pcCard;
      card.classList.add('fs__card--dragging');
      event.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag at all without something set here.
      event.dataTransfer.setData('text/plain', dragKey);
    }

    function onDragOver(event) {
      const card = event.target.closest('.fs__card');
      if (!card || !dragKey || card.dataset.pcCard === dragKey) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      for (const other of host.querySelectorAll('.fs__card--drop')) {
        other.classList.remove('fs__card--drop');
      }
      card.classList.add('fs__card--drop');
    }

    function onDrop(event) {
      const card = event.target.closest('.fs__card');
      if (!card || !dragKey) return;
      event.preventDefault();
      moveCard(dragKey, card.dataset.pcCard); // repaints, which clears the classes
      dragKey = null;
    }

    /* Fires on a cancelled drag as well as a completed one, so it is the only
       reliable place to put the card back the way it was found. */
    function onDragEnd() {
      dragKey = null;
      for (const card of host.querySelectorAll('.fs__card')) {
        card.removeAttribute('draggable');
        card.classList.remove('fs__card--dragging', 'fs__card--drop');
      }
    }

    /* Print Chart is drawn by the shell in the module head, which is outside
       `host`, so its listener goes on the head. The head is torn down with
       the module on the next switch; the teardown below removes the listener
       in the meantime. */
    const head = host.closest('.ch__workspace')?.querySelector('.ch__module-head');

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('dragstart', onDragStart);
    host.addEventListener('dragover', onDragOver);
    host.addEventListener('drop', onDrop);
    host.addEventListener('dragend', onDragEnd);
    head?.addEventListener('ui-click', onUiClick);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('dragstart', onDragStart);
      host.removeEventListener('dragover', onDragOver);
      host.removeEventListener('drop', onDrop);
      host.removeEventListener('dragend', onDragEnd);
      head?.removeEventListener('ui-click', onUiClick);
    };
  },
});
