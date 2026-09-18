/**
 * The Clinical data rail — the standing clinical picture, beside whatever is
 * being charted.
 *
 * WHAT THIS IS
 * The patient's fourteen record sections — diagnoses, allergies, medications,
 * the histories, labs — as a column of collapsible cards with the rail's own
 * copy controls on them. It is the panel on the right of the procedure's step
 * run, and it is now the same panel on the right of the clinic visit, because
 * a clinician who has learned where the allergy list lives during a sedated
 * case should not have to learn a second answer for an office visit.
 *
 * WHY IT MOVED OUT OF A SCREEN AND INTO A LIBRARY
 * There were two of these. The step run had this one; the clinic visit had a
 * second implementation in its left rail with its own markup, its own styling
 * and its own idea of what a flagged row looks like. Two renderings of one
 * patient's allergies is two answers to the question the propofol depends on,
 * and the two had already drifted: one numbered its rows and spelled the
 * severity out, the other did neither. One module, two mount points.
 *
 * WHY THE CLASS NAMES STILL SAY `encv__`
 * They are the procedure screen's prefix, and this rail was its markup first.
 * Renaming them would rewrite every rule in css/components/clinical-rail.css
 * and every line of markup on the screen this was lifted from, to change
 * nothing anybody can see. The prefix is a scar, not a claim about ownership.
 *
 * WHAT A HOST SCREEN PROVIDES
 * The <aside> itself, because that element is a member of the screen's own
 * grid and column layout is the screen's business, not the rail's. Everything
 * inside it — the handle, the spine, the tab strip and the cards — is drawn
 * here.
 *
 * TWO TABS, NOT ONE PANEL
 * The rail answers two different questions and they were never the same
 * question. "What is true of this patient right now" is the fourteen clinical
 * sections — the standing record, always current, never dated. "What did we
 * write the last three times we saw them" is the note history, and a clinician
 * charting today reaches for it constantly: the plan they set last visit, the
 * examination they are comparing against, the history they wrote out in full
 * once and should not have to write out again.
 *
 * That second question had no answer anywhere on an encounter screen. Getting
 * to it meant leaving the visit for the chart, finding the note, reading it,
 * coming back and retyping from memory — which is how a plan gets paraphrased
 * into something slightly different from what was actually agreed.
 *
 * So the rail is a tab strip over two panels, and the Encounter tab lists every
 * earlier visit newest-first, opens any one of them as the note that was
 * written, and puts an Import on each section of it. Both tabs are the same
 * rail in the same place on all three kinds of encounter — a clinic visit, an
 * infusion and a procedure day — for the same reason the clinical sections are:
 * one answer, one place, whatever you opened.
 */
import { CLINICAL_SECTIONS } from '../../data/encounter.js';
import {
  pastAppointments,
  priorEncounterNote,
  appointmentSections,
} from '../../data/prior-encounters.js';
import { iconMarkup } from './icons.js';

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/*
 * Copy means the CLIPBOARD, not "copy to note".
 *
 * On the step run the centre column is whichever document the step is up to,
 * so there is no one note for the rail to write into — and the clipboard puts
 * the list somewhere the clinician can paste it, which is what they were doing
 * by hand out of the rail anyway. The clinic visit does have a single note, but
 * it gets the same control: one rail that behaves one way is worth more than a
 * rail whose buttons mean something different depending on which encounter you
 * opened.
 */
const sectionText = (section) =>
  `${section.label}: ${section.items
    .map((item) => (item.meta ? `${item.text} — ${item.meta}` : item.text))
    .join('; ')}.`;

/**
 * The word and the glyph a button goes back to once its confirmation fades.
 *
 * It has to be READ OFF THE BUTTON rather than assumed. Three controls share
 * this treatment now — the section Copy, the per-row copy, and the Encounter
 * tab's Import — and hard-coding the revert to "Copy" put an Import button back
 * wearing the wrong word and the wrong icon, permanently, the first time a
 * refused import fell through to the clipboard.
 */
const restingState = (button) => [
  button.dataset.verb || 'Copy',
  `#i-${button.dataset.glyph || 'copy'}`,
];

/**
 * WHICH STATUSES GET A BADGE, AND WHY MOST OF THEM DO NOT.
 *
 * This list is history: every row on it is a visit that has already been and
 * gone. On a past appointment, "Confirmed" and "Checked In" and "Scheduled"
 * say only that the visit happened the way visits happen — and a column of
 * nine green and blue pills saying so is nine pills of nothing, loud enough to
 * be read before the dates they sit beside.
 *
 * So only the statuses that mean the visit did NOT happen normally carry one.
 * Those are the ones that explain a gap: why there is no note that week, why
 * the surveillance is overdue, why the referral went unanswered. Everything
 * else leaves the row to its date and its note, which is what the panel is for.
 *
 * The tones are the chart's own (see STATUS_TONES in
 * js/screens/chart-appointments.js), so a booking that reads amber there does
 * not read red here.
 */
const STATUS_TONES = {
  'Pending Confirmation': 'warning',
  Rescheduled: 'warning',
  'No Show': 'critical',
  Cancelled: 'critical',
  Declined: 'critical',
};

const statusBadge = (status) =>
  STATUS_TONES[status]
    ? `<ui-badge status="${STATUS_TONES[status]}" size="sm">${esc(status)}</ui-badge>`
    : '';

/*
 * What the flag on a flagged row is CALLED.
 *
 * `critical` means different things per section and the word has to follow it.
 * On an allergy it means the reaction is anaphylactic, and "Severe" is the term
 * the chart uses. On a diagnosis, a family history or a lab it means somebody
 * marked the row as the one that matters — calling an iron deficiency "Severe"
 * would be putting a clinical grading on the record that nothing in the record
 * supports. "Flagged" says what is true: this one is marked.
 */
const CRITICAL_WORD = { allergies: 'Severe' };

function clinicalItem(item, sectionId, index) {
  const word = CRITICAL_WORD[sectionId] ?? 'Flagged';
  /* The whole row's text, which is what its own copy button hands over —
     "Penicillin — Anaphylaxis, documented 2014" is the useful unit, not the
     allergen with its reaction left behind in the rail. */
  const line = item.meta ? `${item.text} — ${item.meta}` : item.text;

  return `<li class="encv__item${item.critical ? ' encv__item--critical' : ''}">
    <span class="encv__item-num" aria-hidden="true">${index + 1}.</span>
    <span class="encv__item-text">${esc(item.text)}</span>
    ${item.critical ? `<span class="encv__item-severity">${word}</span>` : ''}
    <button type="button" class="encv__item-copy"
      data-copy-line="${esc(line)}" data-copy-label="${esc(item.text)}"
      aria-label="Copy ${esc(item.text)}"
      data-testid="encv--copy-item">${iconMarkup('copy')}</button>
    ${item.meta ? `<span class="encv__item-meta">${esc(item.meta)}</span>` : ''}
  </li>`;
}

/**
 * The rail's own furniture: the handle, the spine, the tab strip, the panels.
 *
 * Rendered rather than written into each screen's HTML, so the two mount points
 * cannot end up with different controls on them — which is exactly how the
 * clinic visit came to have a "View more" the step run had never heard of.
 *
 * `withEncounters` is false when the host named no patient — the gallery's bare
 * `encounter.html`, mostly. There is nothing to list, so the strip collapses
 * back to the plain title it was before the second tab existed rather than
 * offering a tab that opens on "no encounters" every time.
 */
function railChrome(bodyId, withEncounters) {
  /*
   * THE STRIP IS THE PRODUCT'S OWN SEGMENTED CONTROL, not a shape invented for
   * this rail.
   *
   * `.ui-tabs--primary` is what the Scheduler's Appointments / Encounters /
   * Wait List strip is, and what every screen's own sections are — a single
   * bordered box, hairlines between the cells, the open one tinted. The
   * reasoning behind every part of it is in css/components/overlay.css, and
   * none of it is worth restating here in a second set of class names that
   * would then have to be kept in step by hand.
   *
   * So the rail writes that component's markup rather than its own. This is
   * plain markup and not `<ui-tabs>` itself because the element wants its tabs
   * as `<ui-tab>` children it reads on connect, and the rail builds its whole
   * inside from one innerHTML — the custom element would have to upgrade in the
   * middle of a string. The classes are the contract; the rail keeps its own
   * keyboard and panel wiring, which it needs anyway for the collapse.
   *
   * The tabs go INSIDE the title bar rather than in a strip under it. The bar
   * already had the shape — a name on the left, the rail's one action on the
   * right — and a separate row would cost a rail this narrow a third of the
   * header height to say the same thing twice.
   */
  const heading = withEncounters
    ? `<div class="ui-tabs ui-tabs--primary encv__rail-tabs" role="tablist"
         aria-label="Rail contents">
         <button type="button" class="ui-tabs__tab ui-tabs__tab--selected"
           role="tab" data-tab="clinical"
           id="${bodyId}-tab-clinical" aria-selected="true"
           aria-controls="${bodyId}" data-testid="encv--tab-clinical">
           <span class="ui-tabs__label">Clinical data</span></button>
         <button type="button" class="ui-tabs__tab" role="tab" data-tab="encounters"
           id="${bodyId}-tab-encounters" aria-selected="false" tabindex="-1"
           aria-controls="${bodyId}Enc" data-testid="encv--tab-encounters">
           <span class="ui-tabs__label">Encounter</span></button>
       </div>`
    : '<span>Clinical data</span>';

  return `
    <button type="button" class="encv__rail-handle" aria-expanded="false"
      aria-controls="${bodyId}" data-testid="encv--toggle-right">
      ${iconMarkup('caret-left')}
    </button>

    <button type="button" class="encv__rail-spine" data-spine="right"
      aria-hidden="true" tabindex="-1">Clinical data</button>

    <div class="encv__rail-title">
      ${heading}
      <!-- One control, not two. Fourteen sections is enough that opening or
           shutting them one at a time is real work, but "Expand all" and
           "Collapse all" side by side means one of the pair is always the
           no-op — so it is a single button that says which way it will go.

           It belongs to the Clinical data panel alone and is hidden with it:
           an "Expand all" sitting over a list of past visits, none of which
           expand, is a control that lies about what the panel does. -->
      <button type="button" class="encv__rail-action"
        data-testid="encv--toggle-all"></button>
    </div>
    <div class="encv__rail-body" id="${bodyId}" role="tabpanel"
      aria-labelledby="${bodyId}-tab-clinical" data-testid="encv--clinical"></div>
    ${
      withEncounters
        ? `<div class="encv__rail-body encv__rail-body--encounters" id="${bodyId}Enc"
             role="tabpanel" aria-labelledby="${bodyId}-tab-encounters"
             data-testid="encv--encounters" hidden></div>`
        : ''
    }`;
}

/*
 * WHICH SECTIONS ARE OPEN WHEN THE SCREEN LOADS.
 *
 * Diagnoses, allergies and medications, because they are the three read on
 * every single visit — and, on a procedure day, the three the sedation plan
 * turns on. The other eleven arrive shut with their heading showing: nothing is
 * hidden, but the rail is a contents page rather than a four-thousand-pixel
 * transcript nobody scrolls.
 */
const OPEN_ON_LOAD = ['diagnosis', 'allergies', 'medications'];

/**
 * Put the rail inside `rail`, and wire it.
 *
 * `rail`      the host <aside>, already carrying .encv__rail.
 * `announce`  how this screen speaks to its live region. The rail has no
 *             region of its own: a screen has one, and a second would announce
 *             into a place the rest of the screen never uses.
 * `mrn`       whose encounters the second tab lists. Omitted — the gallery's
 *             bare encounter screen, with no booking behind it — and the tab
 *             is not drawn at all.
 * `before`    the ISO date of the visit being charted. Everything on or after
 *             it is not history and stays off the list.
 * `exclude`   the appointment being charted, kept off its own history.
 * `onImport`  what this screen does with a section of an old note:
 *             `(section, encounter) => { ok: boolean, message: string }`.
 *             A screen that has no single note to import into — the procedure
 *             run, whose centre column is whichever document the step is up to
 *             — passes nothing, and the control becomes a Copy instead. See
 *             the note over `sectionText` for why that is the honest default.
 */
export function mountClinicalRail({
  rail,
  announce = () => {},
  mrn = '',
  before = '',
  exclude = '',
  onImport = null,
}) {
  /* The body keeps an id because the handle points `aria-controls` at it, and
     because the screen this was lifted from already had one — `railRightBody`,
     which some of its own code and its tests still reach for by name. */
  const bodyId = `${rail.id || 'railRight'}Body`;

  /* Read once, at mount. The bookings do not change under a rail that is being
     read — nothing on an encounter screen books a visit — and re-deriving the
     list on every repaint would rebuild fifteen rows to redraw one. */
  const visits = mrn ? pastAppointments(mrn, { before, exclude }) : [];

  /* The tab is drawn for every patient, including one with nothing behind them
     — a first visit is an ANSWER to "what did we write last time", and a tab
     that disappeared on some patients would leave the clinician wondering
     whether the history is missing or the rail is. It is the empty list that
     says "none", not the absence of the tab. */
  rail.innerHTML = railChrome(bodyId, Boolean(mrn));

  const body = rail.querySelector('.encv__rail-body');
  const encBody = rail.querySelector('.encv__rail-body--encounters');
  const toggleAll = rail.querySelector('.encv__rail-action');
  const open = new Set(OPEN_ON_LOAD);

  /*
   * ONE CARD PER SECTION.
   *
   * The rail was a run of rules with headings between them, and at fourteen
   * sections it read as one long list of everything rather than as fourteen
   * separate records you consult one of. A card per section gives each an edge,
   * so a collapsed one is a closed drawer rather than a heading with nothing
   * under it, and the open one is visibly a thing with contents.
   */
  function paint() {
    body.innerHTML = CLINICAL_SECTIONS.map((section) => {
      const isOpen = open.has(section.id);
      const critical = section.items.some((i) => i.critical);

      return `<section class="encv__card${isOpen ? ' encv__card--open' : ''}">
        <div class="encv__card-head">
          <!-- The heading is text, not a control. Opening and shutting is the
               caret's job alone — so the header can carry the section's own
               Copy without a press near it landing on the accordion instead. -->
          <span class="encv__card-title">${esc(section.label)}</span>
          ${
            critical
              ? `<span class="encv__card-flag" role="img"
                   aria-label="Contains a flagged entry"></span>`
              : ''
          }

          <span class="encv__card-spacer"></span>

          <!-- The section's own copy: every item at once. Always visible,
               unlike the per-item buttons, because it is the one a clinician
               reaches for and a control found only by hovering is not one that
               can be found. -->
          <button type="button" class="encv__copy" data-copy="${section.id}"
            aria-label="Copy all of ${esc(section.label)} to the clipboard"
            data-testid="encv--copy-${section.id}">
            ${iconMarkup('copy')}<span class="encv__copy-label">Copy</span>
          </button>

          <button type="button" class="encv__card-caret" data-section="${section.id}"
            aria-expanded="${isOpen}" aria-controls="csec-${section.id}"
            aria-label="${isOpen ? 'Collapse' : 'Expand'} ${esc(section.label)}"
            data-testid="encv--section-${section.id}">
            ${iconMarkup('caret-down')}
          </button>
        </div>

        <ol class="encv__items" id="csec-${section.id}" ${isOpen ? '' : 'hidden'}>
          ${section.items.map((item, i) => clinicalItem(item, section.id, i)).join('')}
        </ol>
      </section>`;
    }).join('');

    body.querySelectorAll('[data-section]').forEach((toggle) =>
      toggle.addEventListener('click', () => {
        const { section } = toggle.dataset;
        if (open.has(section)) open.delete(section);
        else open.add(section);
        const now = open.has(section);
        /* The one place this rail mutates in place rather than repainting: a
           repaint would scroll it back to the top, and a section is collapsed
           precisely to reach what is under it. */
        toggle.setAttribute('aria-expanded', String(now));
        toggle.setAttribute(
          'aria-label',
          `${now ? 'Collapse' : 'Expand'} ${CLINICAL_SECTIONS.find((x) => x.id === section).label}`
        );
        toggle.closest('.encv__card').classList.toggle('encv__card--open', now);
        body.querySelector(`#csec-${section}`).hidden = !now;
        /* Shutting the last open section has to flip the header's button, or it
           goes on offering to collapse a rail that is already collapsed. */
        paintToggleAll();
      })
    );

    body.querySelectorAll('[data-copy]').forEach((button) =>
      button.addEventListener('click', () => {
        const section = CLINICAL_SECTIONS.find((s) => s.id === button.dataset.copy);
        copySection(sectionText(section), section.label, button);
      })
    );

    /* One row at a time. The button carries its own text rather than looking the
       item back up by index, so nothing has to stay in step with the data. */
    body.querySelectorAll('[data-copy-line]').forEach((button) =>
      button.addEventListener('click', () =>
        copySection(button.dataset.copyLine, button.dataset.copyLabel, button)
      )
    );
  }

  /*
   * Open everything, or shut everything.
   *
   * Which of the two it offers is decided by what is on screen: if every section
   * is already open the only useful move is to shut them, and vice versa. A
   * partly-open rail counts as "not all open", so the button offers Expand all —
   * the move that changes the most, and the one somebody hunting for a fact
   * wants. Repainting the whole rail is fine here because, unlike toggling one
   * section, the scroll position is meaningless the moment every section changes
   * height.
   */
  function paintToggleAll() {
    const all = CLINICAL_SECTIONS.every((section) => open.has(section.id));
    toggleAll.textContent = all ? 'Collapse all' : 'Expand all';
    toggleAll.dataset.mode = all ? 'collapse' : 'expand';
  }

  toggleAll.addEventListener('click', () => {
    if (toggleAll.dataset.mode === 'collapse') open.clear();
    else CLINICAL_SECTIONS.forEach((section) => open.add(section.id));
    paint();
    paintToggleAll();
    announce(open.size === 0 ? 'All sections collapsed.' : 'All sections expanded.');
  });

  /**
   * Copy `text`, and say so on the button that was pressed.
   *
   * The confirmation is on the control rather than in a toast across the screen,
   * because the rail is the far edge of the layout and a notice in the middle of
   * the window is not where the eye is after pressing something at the right of
   * it. The live region carries the same sentence for anyone who cannot see the
   * button change.
   *
   * navigator.clipboard needs a secure context, which `file://` is not — and this
   * prototype is opened that way often enough to matter (see
   * js/open-me-properly.js). So the old execCommand path stays as a fallback:
   * deprecated, but it is the only thing that works there, and a copy button that
   * silently does nothing is worse than a deprecated API.
   */
  function copySection(text, label, button) {
    /* The section button carries a word beside its glyph; the per-item ones are
       the glyph alone, so the label is optional here rather than assumed. */
    const labelEl = button.querySelector('.encv__copy-label');
    const [original, originalGlyph] = restingState(button);

    const done = () => {
      button.classList.add('is-copied');
      if (labelEl) labelEl.textContent = 'Copied';
      /* The glyph changes with the word. Retargeting the <use> rather than
         rewriting the button's HTML, because rewriting it would replace the
         element this handler is holding and the revert below would fire against
         a node no longer in the document. */
      button.querySelector('use')?.setAttribute('href', '#i-check');
      announce(`${label} copied to the clipboard.`);

      clearTimeout(button._copyTimer);
      button._copyTimer = setTimeout(() => {
        button.classList.remove('is-copied');
        if (labelEl) labelEl.textContent = original;
        button.querySelector('use')?.setAttribute('href', originalGlyph);
      }, 1600);
    };

    const failed = () =>
      announce(`${label} could not be copied — the clipboard is unavailable.`);

    /* The pre-clipboard-API dance: a throwaway textarea, selected and copied.
       Off-screen rather than hidden, because a display:none field cannot be
       selected and so cannot be copied from. */
    const legacyCopy = () => {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      document.body.append(field);
      field.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      field.remove();
      return copied;
    };

    const fallback = () => (legacyCopy() ? done() : failed());

    /*
     * The fallback catches a REJECTION as well as a missing API, and that is the
     * case that actually happens: `writeText` rejects with NotAllowedError
     * whenever the document is not focused — a click that arrived while focus sat
     * in another pane, an automated run, a background tab. Treating only the
     * missing-API case as a fallback meant the common failure reported "the
     * clipboard is unavailable" while the old path would have copied it fine.
     */
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
      return;
    }

    fallback();
  }

  /* ===================== The Encounter tab ===================== */

  /*
   * WHICH ENCOUNTER IS OPEN, AND WHY THAT IS THE WHOLE STATE.
   *
   * The panel is a list, or one encounter's note. There is no third state and
   * no scroll position to keep: `null` is the list, an appointment id is that
   * note. Going back is setting it to null.
   *
   * It is deliberately NOT remembered across a mount. A rail that reopened on
   * the note somebody was reading half an hour ago, on a screen three people
   * share, presents another clinician's place in the history as though it were
   * yours.
   */
  let openEncounter = null;

  /**
   * The list: every earlier visit, newest first.
   *
   * A row carries the date it happened and the note that was written at it, in
   * that order, because the date is what a visit is remembered by and the note
   * type is what tells you whether the thing you are after will be in it.
   * Pressing anywhere on the row opens it — the "View" at the right is a
   * signpost, not the only target, because a 3rem-wide link at the far edge of
   * a narrow rail is a hit area nobody should have to aim at.
   */
  function encounterListHtml() {
    if (!visits.length) {
      return `<p class="encv__enc-empty" data-testid="encv--enc-empty">
        This is the first visit on record for this patient. What is written
        today will show here next time.</p>`;
    }

    /* One list, no headings. It was three groups while the panel carried the
       diary as well; now that it is history alone, every row is the same kind
       of thing in the same order — most recent first — and a heading reading
       "Past" over the only group there is says nothing the tab has not. */
    return `<ol class="encv__enc-list" data-testid="encv--enc-list">
      ${visits.map(visitRowHtml).join('')}
    </ol>`;
  }

  /**
   * One booking in the list.
   *
   * TWO KINDS OF ROW, AND THE DIFFERENCE IS WHETHER THERE IS ANYTHING TO READ.
   * A past visit that was written up is a button: pressing it opens the note.
   * Everything else — still to come, cancelled, a no-show — is a plain item
   * carrying its status, because a control that opens nothing is worse than no
   * control at all, and the status is the whole of what that row has to say.
   *
   * The second line changes with the row for the same reason. On something
   * still to come the useful facts are the time and what it is booked as; on a
   * visit that happened, it is which note was written; on one that never
   * happened, what it would have been.
   */
  function visitRowHtml(visit) {
    /* The second line: what was written, and what the visit was. A booking
       nobody charted has no note to name, so it says what it was booked as and
       leaves it there. */
    const meta = visit.hasNote
      ? [visit.noteType, visit.apptType].filter(Boolean).join(' · ')
      : visit.apptType;

    return `<li>
      <button type="button" class="encv__enc-row" data-enc="${esc(visit.id)}"
        data-testid="encv--enc-${esc(visit.id)}">
        <span class="encv__enc-when">
          <span class="encv__enc-date">${esc(visit.date)}</span>
          <span class="encv__enc-note">${esc(meta)}</span>
        </span>
        ${statusBadge(visit.status)}
        <span class="encv__enc-chevron" aria-hidden="true">${iconMarkup('caret-right')}</span>
      </button>
    </li>`;
  }

  /**
   * What is behind a row, whichever kind of row it is.
   *
   * A past visit that was written up opens its NOTE. Everything else opens the
   * BOOKING — why the patient is coming, who they are seeing, on what, and what
   * the desk wrote on it. Both come back as the same `{id, label, text}`
   * sections, so the detail view and the Import know nothing about which of the
   * two they are showing.
   */
  const sectionsFor = (visit) =>
    visit?.hasNote ? priorEncounterNote(visit.id) : appointmentSections(visit?.id);

  /**
   * A section's contents: labelled facts, and paragraphs.
   *
   * WHY THIS IS NOT ONE BLOCK OF TEXT.
   * It was — the flattened form, printed with `white-space: pre-wrap` — and it
   * turned a record into a grey paragraph. "Medical History" is a label and
   * "Gallstones, asymptomatic" is the answer to it, and setting the two at the
   * same size in the same ink asks the reader to parse the colon in the middle
   * of every line to find where one ends and the next begins. Down four facts
   * that is four acts of parsing to answer a question the structure could have
   * answered for free.
   *
   * So a fact is its label over its value: the label small and quiet because it
   * is known before it is read, the value in the ink the panel is actually for.
   * Stacked rather than side by side because the rail is 21rem wide and
   * "Hospitalisation / Major Diagnostic Procedure" is not a column heading it
   * can afford.
   *
   * A row with no label is prose — the reason a patient came, an assessment —
   * and it is drawn as prose. The flattened text is still what an Import
   * pastes; a note field takes characters, not a data structure.
   */
  function sectionBodyHtml(section) {
    const rows = section.rows?.length ? section.rows : [{ text: section.text }];

    return `<div class="encv__enc-body">
      ${rows
        .map((row) =>
          row.label
            ? `<div class="encv__enc-fact">
                 <span class="encv__enc-fact-label">${esc(row.label)}</span>
                 <span class="encv__enc-fact-value">${esc(row.value)}</span>
               </div>`
            : `<p class="encv__enc-para">${esc(row.text)}</p>`
        )
        .join('')}
    </div>`;
  }

  /**
   * One earlier note, section by section, each with its own Import.
   *
   * IMPORT IS PER SECTION AND NOT PER NOTE.
   * "Import the whole visit" is almost never what is wanted: a clinician
   * pulling last month's note forward wants the history they already wrote out
   * in full, or the plan they are continuing — not the examination findings
   * from a different day pasted into today's, which is how a chart fills up
   * with observations nobody made.
   *
   * The heading bar is the same shape as a clinical section's, one press to the
   * right, so the two tabs of this rail read as one rail.
   */
  function encounterDetailHtml(id) {
    const encounter = visits.find((visit) => visit.id === id) ?? null;
    const sections = sectionsFor(encounter);
    /* The verb changes with what the host screen can actually do. See the
       `onImport` note on this function's options. */
    const verb = onImport ? 'Import' : 'Copy';
    const glyph = onImport ? 'download' : 'copy';

    return `
      <div class="encv__enc-head">
        <button type="button" class="encv__enc-back" data-enc-back
          aria-label="Back to the list of appointments" data-testid="encv--enc-back">
          ${iconMarkup('caret-left')}
        </button>
        <!-- The date, and only the date. It carried the note type in brackets
             after it — "Tue, 4 Aug 2026 (GI Consultation)" — which the row you
             pressed to get here already showed, and which the line underneath
             says again in other words. Three statements of what kind of visit
             this was, stacked above a panel whose job is what was written at
             it. -->
        <h3 class="encv__enc-head-text">${esc(encounter?.date ?? 'Encounter')}</h3>
        ${statusBadge(encounter?.status)}
      </div>

      <p class="encv__enc-meta">${[
        encounter?.hasNote ? encounter.apptType : encounter?.time,
        encounter?.provider,
      ]
        .filter(Boolean)
        .map(esc)
        .join(' · ')}</p>

      ${
        sections.length
          ? sections
              .map(
                (section) => `<section class="encv__card encv__card--open">
                  <div class="encv__card-head encv__enc-card-head">
                    <span class="encv__enc-card-title">${esc(section.label)}</span>
                    <span class="encv__card-spacer"></span>
                    <button type="button" class="encv__copy encv__enc-import"
                      data-import="${esc(section.id)}"
                      data-verb="${verb}" data-glyph="${glyph}"
                      aria-label="${verb} ${esc(section.label)}"
                      data-testid="encv--import-${esc(section.id)}">
                      ${iconMarkup(glyph)}<span class="encv__copy-label">${verb}</span>
                    </button>
                  </div>
                  ${sectionBodyHtml(section)}
                </section>`
              )
              .join('')
          : `<p class="encv__enc-empty">Nothing was recorded against this appointment.</p>`
      }`;
  }

  /**
   * Draw whichever of the two states the panel is in, and wire it.
   *
   * A full repaint per press rather than swapping two rendered trees: the
   * detail view is at most nine short sections, and holding both in the DOM to
   * save a paint that nobody can perceive is how a panel ends up with two
   * Import buttons for one section, one of them wired to the previous
   * encounter.
   */
  function paintEncounters() {
    if (!encBody) return;

    encBody.innerHTML = openEncounter
      ? encounterDetailHtml(openEncounter)
      : encounterListHtml();

    encBody.querySelectorAll('[data-enc]').forEach((row) =>
      row.addEventListener('click', () => {
        openEncounter = row.dataset.enc;
        paintEncounters();
        /* Focus moves to the way back, which is the first control of the view
           that just replaced the one the press happened in. Without it, focus
           is on a button that no longer exists and lands back at the top of
           the document. */
        encBody.querySelector('[data-enc-back]')?.focus();
        const encounter = visits.find((v) => v.id === openEncounter);
        announce(
          `${encounter?.hasNote ? encounter.noteType : encounter?.apptType ?? 'Appointment'} of ${
            encounter?.date ?? ''
          } opened.`
        );
      })
    );

    encBody.querySelector('[data-enc-back]')?.addEventListener('click', () => {
      const wasOpen = openEncounter;
      openEncounter = null;
      paintEncounters();
      encBody.querySelector(`[data-enc="${wasOpen}"]`)?.focus();
      announce('Back to the list of appointments.');
    });

    encBody.querySelectorAll('[data-import]').forEach((button) =>
      button.addEventListener('click', () => {
        const section = sectionsFor(visits.find((v) => v.id === openEncounter)).find(
          (s) => s.id === button.dataset.import
        );
        if (!section) return;
        importSection(section, button);
      })
    );
  }

  /**
   * Hand one section of an old note to the screen — or, failing that, to the
   * clipboard.
   *
   * The screen gets first refusal because only it knows where the text belongs
   * and whether the note it belongs in is still open. When it takes the text,
   * the button says "Imported" and the screen's own message says what happened
   * and where. When there is no screen to take it — the procedure run — the
   * button was already drawn as a Copy and behaves as one, which is the same
   * bargain the clinical sections strike.
   */
  function importSection(section, button) {
    if (!onImport) {
      copySection(section.text, section.label, button);
      return;
    }

    const encounter = visits.find((v) => v.id === openEncounter) ?? null;
    const result = onImport(section, encounter) ?? {};

    if (!result.ok) {
      /*
       * A refusal is a sentence, not a silent no-op. The screen supplies it,
       * because the reason is the screen's — a signed note, a template with
       * nowhere for this section to go.
       *
       * And a refusal that asks for `copy` still gets the words out of the
       * rail. The clinician pressed the button because they want this text; a
       * screen that cannot take it into the note has no business also denying
       * them the clipboard, which is where they would have gone next anyway.
       */
      if (result.copy) {
        copySection(section.text, section.label, button);
        announce(result.message || `${section.label} copied to the clipboard.`);
        return;
      }
      announce(result.message || `${section.label} could not be imported.`);
      flash(button, 'Not imported', 'warning');
      return;
    }

    announce(result.message || `${section.label} imported into the note.`);
    flash(button, 'Imported', 'check');
  }

  /**
   * Say on the button what just happened, then put it back.
   *
   * Same treatment and the same 1.6s as a copy — see `copySection`. The
   * confirmation is on the control because the rail is the far edge of the
   * layout and the eye is on the button that was pressed, not on the middle of
   * the window.
   */
  function flash(button, word, glyph) {
    const labelEl = button.querySelector('.encv__copy-label');
    const [original, originalGlyph] = restingState(button);

    button.classList.add('is-copied');
    if (labelEl) labelEl.textContent = word;
    button.querySelector('use')?.setAttribute('href', `#i-${glyph}`);

    clearTimeout(button._copyTimer);
    button._copyTimer = setTimeout(() => {
      button.classList.remove('is-copied');
      if (labelEl) labelEl.textContent = original;
      button.querySelector('use')?.setAttribute('href', originalGlyph);
    }, 1600);
  }

  /* ===================== Switching tabs ===================== */

  /*
   * A tab hides its panel with `hidden` rather than a class, so a collapsed
   * rail's tabindex sweep (see wireRailCollapse) and the browser's own find-in-
   * page agree with each other about what is on screen.
   */
  function showTab(name) {
    rail.querySelectorAll('.ui-tabs__tab').forEach((tab) => {
      const on = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(on));
      /* The class is what paints the tint — `.ui-tabs--primary` is styled off
         `--selected` and not off aria, so the two have to be set together the
         way js/components/ui-tabs.js sets them. */
      tab.classList.toggle('ui-tabs__tab--selected', on);
      /* Roving tabindex: one stop for the whole strip, arrows move within it. */
      if (on) tab.removeAttribute('tabindex');
      else tab.setAttribute('tabindex', '-1');
    });

    body.hidden = name !== 'clinical';
    if (encBody) encBody.hidden = name !== 'encounters';
    /* Expand all belongs to the clinical sections and to nothing else. */
    toggleAll.hidden = name !== 'clinical';
  }

  const tabs = [...rail.querySelectorAll('.ui-tabs__tab')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
    /* Left and right move between tabs, which is what a tablist owes a keyboard
       — without it the strip is two buttons that happen to sit side by side. */
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      showTab(next.dataset.tab);
      next.focus();
    });
  });

  paint();
  paintToggleAll();
  paintEncounters();
  if (tabs.length) showTab('clinical');
  return { repaint: paint, repaintEncounters: paintEncounters };
}

/* ===================== Collapsing a rail ===================== */

/*
 * THE THREE LAYOUTS, AND WHICH ONE WANTS A RAIL COLLAPSED.
 *
 * Wide — the rails sit beside the work. Open; collapsing one is a choice.
 * Medium — under 64rem, an opened rail overlays the work instead of squeezing
 *   it (see the 64rem block in each screen's stylesheet). An overlay that
 *   arrived already open would cover the column it exists to sit beside, so
 *   here the rails start collapsed and the layout is spines and a surface.
 * Phone — under 30rem, one column, everything stacked. A "collapsed" rail has
 *   nothing to get out of the way of, and collapsing it would leave a
 *   full-width box with a sideways label in it. So there is no collapse at all:
 *   the handles are hidden and every rail is open.
 */
const OVERLAY = window.matchMedia('(max-width: 64rem)');
const PHONE = window.matchMedia('(max-width: 30rem)');

/**
 * What the layout wants, absent any instruction from the user.
 *
 * The two kinds of rail do not want the same thing. A rail that is the MAP of
 * the encounter — which step you are on and what is left — stays open wherever
 * there is room for it, and only folds away when a third column would squeeze
 * the document.
 *
 * The clinical rail is REFERENCE: history, medications, allergies, the fourteen
 * sections. It is consulted, not worked in, and while it is open it takes a
 * column's worth of width away from the form actually being filled in. So it
 * starts collapsed to its spine at every width that has a spine, and whoever
 * wants it presses the handle or the spine to bring it back — one click, and
 * that instruction then sticks (see `touched`).
 */
export const defaultCollapsed = (side) =>
  side === 'right' ? !PHONE.matches : OVERLAY.matches && !PHONE.matches;

/**
 * Which rails the user has taken a decision about.
 *
 * The breakpoint drives a rail's state only while nobody has touched it. Once
 * someone has collapsed or opened one by hand, resizing the window stops
 * moving it: a rail that reopens itself because the window grew is a rail that
 * discards the one instruction it was given, and on a screen three people share
 * a panel appearing on its own is read as someone else having done it.
 *
 * Keyed by the element, not by the side, because two screens now call this and
 * "right" is not a name that identifies a rail across them.
 *
 * Phone width is the exception, and has to be: the handle that recorded the
 * instruction is not on screen there, so honouring it would leave a rail shut
 * with nothing to reopen it.
 */
const touched = new WeakSet();

/**
 * Wire a rail's collapse, and set its starting state.
 *
 * A rail collapses to a spine, not to nothing. The handle's caret points the way
 * the rail will move, which for a left rail means it flips between caret-left
 * (collapse, moving left) and caret-right (open, moving right) — and the
 * opposite on a right rail. A fixed chevron would be pointing the wrong way half
 * the time, which on a control whose only job is direction is worse than no icon
 * at all.
 *
 * `cols`  the grid the rail sits in. Its data-left / data-right attributes are
 *         what actually move the column, so the rail cannot narrow itself.
 * `name`  what the handle offers to show or hide, in words: "clinical data".
 */
export function wireRailCollapse({ rail, cols, side, name }) {
  const handle = rail.querySelector('.encv__rail-handle');
  /* Every panel, not the first one. The rail grew a second body when the
     Encounter tab arrived, and sweeping only the clinical one left the past
     encounters' rows and Import buttons in the tab order of a rail folded down
     to a spine — reachable by keyboard, invisible on screen, which is the exact
     failure this sweep exists to prevent. */
  const bodies = [...rail.querySelectorAll('.encv__rail-body')];

  const apply = (collapsed) => {
    rail.dataset.collapsed = String(collapsed);
    cols.dataset[side] = collapsed ? 'collapsed' : 'open';
    handle.setAttribute('aria-expanded', String(!collapsed));
    handle.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} ${name}`);
    /* Left rail: collapsing moves it left, opening moves it right. */
    const pointsLeft = side === 'left' ? !collapsed : collapsed;
    handle.innerHTML = iconMarkup(pointsLeft ? 'caret-left' : 'caret-right');
    /* Out of the tab order while it is off screen — a collapsed rail's contents
       are not reachable, and keyboard focus that lands in a hidden panel
       strands the user in a column they cannot see. */
    bodies.forEach((panel) =>
      panel.querySelectorAll('button, a, input, select, textarea').forEach((node) => {
        if (collapsed) node.setAttribute('tabindex', '-1');
        else node.removeAttribute('tabindex');
      })
    );
    /* The tab strip goes with them: it is header furniture rather than panel
       contents, so the sweep above never reached it, and a collapsed rail whose
       hidden tabs still take focus is the same stranding by another door. */
    rail.querySelectorAll('.ui-tabs__tab').forEach((tab) => {
      /* Open, the strip keeps its roving tabindex — one stop for the two tabs,
         arrows to move between them — which is what showTab() left behind. */
      const selected = !collapsed && tab.getAttribute('aria-selected') === 'true';
      if (selected) tab.removeAttribute('tabindex');
      else tab.setAttribute('tabindex', '-1');
    });
  };

  const toggle = () => {
    touched.add(rail);
    apply(rail.dataset.collapsed !== 'true');
  };

  handle.addEventListener('click', toggle);
  /* The spine is the other way back: it is the whole visible surface of a
     collapsed rail, so pressing it anywhere opens it. */
  rail.querySelector(`[data-spine="${side}"]`).addEventListener('click', toggle);

  apply(defaultCollapsed(side));

  /* Both queries, because the rail's default sits between them: entering phone
     width forces open, leaving it hands the decision back to the overlay band. */
  const relayout = () => {
    if (PHONE.matches) {
      /* The handle is gone at this width, so an instruction given through it
         cannot be taken back — drop it rather than strand the rail. */
      touched.delete(rail);
      apply(false);
    } else if (!touched.has(rail)) {
      apply(defaultCollapsed(side));
    }
  };

  OVERLAY.addEventListener('change', relayout);
  PHONE.addEventListener('change', relayout);

  return { apply };
}
