/**
 * THE AI SCRIBE.
 *
 * A purple button at the top of the note. Press it and the room is being
 * listened to: a recording bar, a timer, and the consultation appearing as
 * transcript while it is spoken. Stop, and it drafts. What comes back is a
 * DRAFT, in a panel, beside the note — not in it.
 *
 * NOTHING FILLS THE NOTE UNTIL IT IS COPIED, AND THAT IS THE FEATURE.
 *
 * Every product that does this fills the form and asks the clinician to check
 * it afterwards. That is the wrong way round for a document somebody signs
 * their name to: text that is already in the box has been accepted by default,
 * and checking it means reading for an error you have no reason to expect.
 *
 * So the draft sits beside the note and each section has one button — Copy to
 * note. The clinician reads a paragraph, decides, and presses; what they did
 * not press is not in the note. A section already copied says so rather than
 * offering to do it again, because the failure this arrangement has to prevent
 * is the same paragraph arriving twice in one note.
 *
 * AND EVERY SENTENCE CAN BE CHECKED AGAINST WHAT WAS SAID. A draft section
 * names the transcript lines it was drawn from; pressing it scrolls the
 * transcript to them. A summary nobody can check is a summary nobody should
 * sign.
 *
 * WHAT IT IS NOT. There is no microphone, no stream and no model here — see
 * data/scribe-transcript.js. The transcript is authored and revealed in time
 * with a timer. What is being designed is the shape of the interaction: what
 * the clinician sees while the room is listened to, what comes back, and what
 * it takes to get any of it into the note.
 *
 * WHAT IT KNOWS ABOUT THE SCREEN. Nothing. It is handed a host to draw into
 * and an `onCopy` for the one thing only the screen can do — put text in a
 * field — and it reports what was copied. The clinic visit mounts it; the
 * procedure report could.
 */

import { iconMarkup } from './icons.js';
import {
  SCRIBE_SPEAKERS,
  SCRIBE_TRANSCRIPT,
  SCRIBE_DURATION,
  SCRIBE_DRAFT,
  SCRIBE_STAGES,
} from '../../data/scribe-transcript.js';

/*
 * ONE COMPONENT, WHATEVER ROOM IT IS IN.
 *
 * The clinic consultation is the default because it is what the scribe was
 * built against, but the material is an argument: a screen hands over the
 * speakers, the transcript and the draft its own document is made of. The
 * procedure report does exactly that — an endoscopist calling findings over a
 * scope is not holding a consultation, and a draft offering the clinic's four
 * sections there would be aimed at fields that document does not have. See
 * PROCEDURE_TRANSCRIPT in data/scribe-transcript.js.
 */
const CLINIC_SOURCE = {
  /* What the pill offers to write. The procedure room hands over 'Report'. */
  noun: 'Note',
  speakers: SCRIBE_SPEAKERS,
  transcript: SCRIBE_TRANSCRIPT,
  duration: SCRIBE_DURATION,
  draft: SCRIBE_DRAFT,
  stages: SCRIBE_STAGES,
};

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** mm:ss, as a recorder writes it. */
const clock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/* ===================== The states ===================== */

/*
 * idle        the tile, alone — nothing has been recorded
 * recording   the bar, the clock, the transcript filling in
 * paused      the same, stopped where it is
 * ready       there is a recording; the tile reads Generate Note
 * drafting    the dialog in the middle of the screen
 * draft       the draft, section by section, each with Copy to note
 *
 * One string rather than a set of booleans because they are exclusive and
 * always have been: a scribe that is both recording and drafting is a bug, and
 * two booleans can express it.
 *
 * `ready` is the state the reference spends the least time in and the one the
 * flow turns on — a recording exists and nothing has been done with it yet.
 * Reached when the consultation finishes on its own, or when somebody pauses
 * and closes the panel.
 */

/** Everything the scribe needs to know, for one mounting of it. */
function initialState() {
  return {
    phase: 'idle',
    elapsed: 0,
    /* CC puts the transcript away and leaves the recording running. */
    captions: true,
    /* The transcript's type size, and whether the menu offering it is open.
       It is on the component sheet for a reason: this is read across a room by
       somebody who is also holding a scope, and being able to make the words
       bigger without changing anything else is the accessibility control that
       actually matters here. */
    textSize: 'Default',
    sizeMenu: false,
    /* Where the panel has been dragged to, once it has been. Null until then
       — see panelPosition for where it opens. */
    pos: null,
    /* Which tab of the generated note is showing. */
    tab: 'note',
    /* Sections already in the document, and any the clinician has edited
       before inserting. Edits live here rather than on the draft data, so the
       original is never lost and a second mounting starts clean. */
    copied: new Set(),
    text: {},
    editing: '',
    /* Stamped when the draft lands, because the modal states both — the sheet
       shows "Generated 1:34 pm" and "Created in 18 seconds", and a note that
       claimed a time it did not take would be the first lie on the screen. */
    generatedAt: '',
    tookSeconds: 0,
  };
}

const heard = (source, state) => source.transcript.filter((line) => line.at <= state.elapsed);

/* ===================== Drawing ===================== */

/*
 * THE CHROME IS THE COMPONENT SHEET'S, PIECE FOR PIECE.
 *
 * A white card holding a purple tile and a tinted bar: mic, waveform, a red
 * dot and the running clock, with Pause and CC at the end. Pause rearranges
 * it — Stop first behind a rule of its own, Resume where Pause was — because
 * paused is a decision point rather than a live thing being watched. The
 * transcript sits under the bar in the same card, with a T control that sizes
 * it. Stop puts a purple Generate control under the card, and pressing that
 * opens the generated note in the middle of the screen.
 *
 * Copied deliberately and exactly: this is the part somebody has already
 * designed and signed off, and the argument to be had about the scribe is what
 * it does with the draft, not whether the timer sits left or right of the
 * waveform. The one departure is the one that was asked for — nothing reaches
 * the note until Insert to Note is pressed. See the file header.
 */

/** The sizes the T control offers, and what each does to the transcript. */
const TEXT_SIZES = [
  { label: 'Default', scale: 1 },
  { label: 'Extra Large', scale: 1.5 },
  { label: 'Large', scale: 1.3 },
  { label: 'Medium', scale: 1.15 },
  { label: 'Small', scale: 0.9 },
];

const scaleFor = (label) => TEXT_SIZES.find((size) => size.label === label)?.scale ?? 1;

/* Eight bars, taller in the middle, as the sheet draws them. */
const WAVE_HEIGHTS = [40, 70, 100, 55, 85, 45, 65, 35];

/** One transcript line, in the panel's own layout. */
function transcriptLinesHtml(source, state, { colon = false } = {}) {
  const lines = heard(source, state);
  if (!lines.length) {
    return `<p class="scribe__waiting">Listening. What is said in the room appears here.</p>`;
  }

  return lines
    .map((line) => {
      const speaker = source.speakers[line.who];
      return `<p class="scribe__line" data-at="${line.at}" data-testid="scribe--line-${line.at}">
        <span class="scribe__at">${clock(line.at)}</span>
        <span class="scribe__who scribe__who--${esc(speaker.tone)}">${esc(speaker.label)}</span>
        ${colon ? '<span class="scribe__colon">:</span>' : ''}
        <span class="scribe__said">${esc(line.text)}</span>
      </p>`;
    })
    .join('');
}

/** The T control on the transcript, and the menu of sizes under it. */
function textSizeHtml(state) {
  return `<div class="scribe__size">
      <button type="button" class="scribe__size-btn" data-scribe-size
        aria-expanded="${Boolean(state.sizeMenu)}" aria-label="Transcript text size"
        data-testid="scribe--size">T<span class="scribe__caret" aria-hidden="true"></span></button>
      ${
        state.sizeMenu
          ? `<ul class="scribe__size-menu" role="menu" data-testid="scribe--size-menu">
              ${TEXT_SIZES.map(
                (size) => `<li role="none"><button type="button" role="menuitem"
                  class="scribe__size-item${
                    size.label === state.textSize ? ' scribe__size-item--on' : ''
                  }" data-scribe-size-pick="${esc(size.label)}">${esc(size.label)}</button></li>`
              ).join('')}
            </ul>`
          : ''
      }
    </div>`;
}

/**
 * The bar, in its two compositions.
 *
 * Recording is a live thing being watched: the waveform moves, the dot is lit,
 * and the only control is Pause. Paused is a decision point, so the row
 * rearranges around it. The waveform goes flat rather than disappearing, so
 * nothing changes width when the room goes quiet.
 */
function barHtml(state) {
  const recording = state.phase === 'recording';

  const stop = `<button type="button" class="scribe__stop" data-scribe-stop
      data-testid="scribe--stop">
      <span class="scribe__stop-glyph" aria-hidden="true"></span>Stop
    </button>
    <span class="scribe__rule" aria-hidden="true"></span>`;

  return `<div class="scribe__bar${recording ? '' : ' scribe__bar--paused'}"
    data-testid="scribe--bar">
      ${recording ? '' : stop}
      <span class="scribe__mic${recording ? '' : ' scribe__mic--off'}">${iconMarkup('mic')}</span>
      <span class="scribe__wave${recording ? ' scribe__wave--on' : ' scribe__wave--flat'}"
        aria-hidden="true">${WAVE_HEIGHTS.map(
          (height, i) => `<i style="--h:${height}%;--i:${i}"></i>`
        ).join('')}</span>
      <span class="scribe__status" data-testid="scribe--timer">
        ${
          recording
            ? '<span class="scribe__dot scribe__dot--live"></span>'
            : '<span class="scribe__pause-glyph scribe__pause-glyph--ink" aria-hidden="true"><i></i><i></i></span>'
        }
        <span class="scribe__status-word">${recording ? 'Recording' : 'Paused'}</span>
        <span class="scribe__status-time">- ${clock(state.elapsed)}</span>
      </span>
      <button type="button" class="scribe__pause" data-scribe-pause
        data-testid="scribe--pause">
        <span class="scribe__pause-glyph" aria-hidden="true">${
          recording ? '<i></i><i></i>' : '<b></b>'
        }</span>${recording ? 'Pause' : 'Resume'}
      </button>
      <button type="button" class="scribe__cc${state.captions ? ' scribe__cc--on' : ''}"
        data-scribe-cc aria-pressed="${Boolean(state.captions)}"
        aria-label="Show or hide the transcript" data-testid="scribe--cc">CC</button>
    </div>`;
}

/** The tile: the sparkle, and nothing else. */
/*
 * THE TRIGGER SITS ON THE DOCUMENT'S OWN BAR, BESIDE THE CLOCK.
 *
 * It was a tab welded to the right-hand edge of the window, floating over
 * whatever was scrolled past, and the float was buying less than it cost. The
 * scribe belongs to ONE document — it listens to the consultation being
 * written up here and drafts into these fields — and a control stuck to the
 * glass says the opposite: that it belongs to the window, to the application,
 * to no document in particular. Worse, it stood clear of the card it acts on,
 * so the first thing a clinician saw on the note was a purple square hanging
 * off the frame with nothing under it.
 *
 * On the bar it reads as what it is: one of this document's controls, in the
 * row that already carries the document's name, its template and its clock.
 * It is drawn at the bar's own control height so it lines up with the clock
 * beside it rather than standing a head above it — see .scribe__tile--bar in
 * css/components/ai-scribe.css.
 *
 * The SAME tile, with a modifier: it is still the purple sparkle, and the
 * moment recording starts it goes back into the card's own row as the badge
 * at the left of the bar. One element, two placements, so the thing the
 * clinician pressed is visibly the thing now listening.
 */
const tileHtml = ({ bar = false } = {}) =>
  `<button type="button" class="scribe__tile${bar ? ' scribe__tile--bar' : ''}"
    data-scribe-toggle
    aria-label="Start the AI scribe" title="Start the AI scribe"
    data-testid="scribe--button">
      <span class="scribe__spark" aria-hidden="true">${iconMarkup('sparkle')}</span>
    </button>`;

/** The purple control with the white pill in it, as the sheet draws it. */
/*
 * THE CONTROL BETWEEN RECORDINGS, AND WHY ITS LABEL CHANGES.
 *
 * `ready` is one phase covering two situations, and until now it said the same
 * thing in both. Before anything has been drafted it offers to draft — that is
 * Generate. AFTER a draft exists, and after the clinician has imported it, the
 * button does not generate anything: it reopens the draft that is already
 * there, which is a different act and has to be a different word. Pressing
 * "Generate Report" and getting the report you generated four minutes ago is
 * the kind of small lie that teaches people not to read buttons.
 *
 * It stands where the trigger stood — on the document's bar, at the bar's own
 * control height — because it is the same control in a later phase, and a
 * button that answers a press by reappearing somewhere else has to be hunted
 * for rather than returned to.
 */
const generateHtml = (source, state) => {
  const drafted = Boolean(state.generatedAt);
  return `<button type="button" class="scribe__generate scribe__generate--bar"
    data-scribe-generate data-testid="scribe--generate">
      <span class="scribe__spark" aria-hidden="true">${iconMarkup('sparkle')}</span>
      <span class="scribe__pill">${
        drafted ? 'View Notes' : `Generate ${esc(source.noun)}`
      }</span>
    </button>`;
};

/** The card: the tile and bar, with the transcript under them when CC is on. */
function cardHtml(source, state) {
  const open = state.phase === 'recording' || state.phase === 'paused';
  if (!open) return '';

  /*
   * THE PANEL FLOATS, AND IS DRAGGED BY ITS BAR.
   *
   * It was a card in the flow at the top of the note, which meant the
   * transcript scrolled away from whatever the clinician was actually
   * charting — and the transcript is the thing you look at WHILE charting.
   * Floating, it stays; draggable, it goes wherever the work is not.
   *
   * The drag handle is the row holding the tile and the recording bar, which
   * is this panel's title bar in everything but name: it says what the panel
   * is and carries no text to select. The controls inside it — Pause, CC,
   * Stop — are buttons, and a press that lands on one of those is a press,
   * not a drag; see the handler.
   */
  return `<div class="scribe__card scribe__card--float" data-scribe-panel
      data-testid="scribe--panel">
      <div class="scribe__row" data-scribe-drag>${tileHtml()}${barHtml(state)}</div>
      ${
        /* CC PUTS THE TRANSCRIPT AWAY AND LEAVES THE RECORDING RUNNING: the
           control a clinician reaches for when the patient is saying something
           they would rather not have standing on the screen between them.
           Stopping is what Stop is for. */
        state.captions
          ? `<div class="scribe__transcript" data-scribe-transcript
              style="--scribe-scale:${scaleFor(state.textSize)}">
              ${/* Only the T control here now. There was an Expand beside it,
                   which was the wrong answer to "the transcript is too small":
                   a panel that can be picked up and put anywhere can simply BE
                   the size it needs to be, and a button that grew it was a
                   second way to say where the panel should sit. */ ''}
              <div class="scribe__transcript-tools">${textSizeHtml(state)}</div>
              <div class="scribe__transcript-scroll" data-scribe-scroll>
                ${transcriptLinesHtml(source, state)}
              </div>
            </div>`
          : ''
      }
    </div>`;
}

/**
 * The dialog shown while it drafts — in the middle of the screen, over
 * everything, as the sheet has it. This is the one moment in the flow where
 * the clinician has nothing to do and needs to know the system has not simply
 * stopped. Dismissable, because a wait nobody can escape is worse than a draft
 * nobody waited for.
 */
function draftingHtml(source, state) {
  const step = Math.min(source.stages.length - 1, Math.floor(state.elapsed / 2));
  return `<div class="scribe__scrim" data-testid="scribe--drafting">
      <div class="scribe__dialog" role="dialog" aria-live="polite"
        aria-label="Generating AI-assisted note">
        <span class="scribe__ring" aria-hidden="true"></span>
        <p class="scribe__dialog-title">Generating AI-Assisted ${esc(source.noun)}</p>
        <p class="scribe__dialog-body">Analyzing conversation along with relevant patient history,
          treatment plans, and prior documentation to create a comprehensive
          ${esc(source.noun.toLowerCase())}.</p>
        <p class="scribe__dialog-stage">${esc(source.stages[step])}</p>
        <button type="button" class="scribe__ghost" data-scribe-cancel
          data-testid="scribe--cancel">Cancel</button>
      </div>
    </div>`;
}

/**
 * THE GENERATED NOTE, IN THE MIDDLE OF THE SCREEN.
 *
 * Two tabs over one recording: what was written, and what was said. The note
 * is the tab that opens, because it is what the clinician came for; the
 * transcript is one press away and is the thing that makes the note
 * checkable — a summary nobody can check is a summary nobody should sign.
 *
 * INSERT TO NOTE IS PER SECTION, AND IMPORT TO NOTE TAKES THE REST. Both are
 * presses the clinician makes after reading. Nothing is in the note before
 * them, and the head of the modal says so.
 */
function modalHtml(source, state) {
  const onNote = state.tab !== 'transcript';
  const outstanding = source.draft.filter((section) => !state.copied.has(section.id));

  const sections = source.draft
    .map((section) => {
      const done = state.copied.has(section.id);
      const editing = state.editing === section.id;
      const text = state.text[section.id] ?? section.text;
      return `<article class="scribe__section${done ? ' scribe__section--done' : ''}"
        data-draft="${esc(section.id)}" data-testid="scribe--draft-${esc(section.id)}">
        <header class="scribe__section-head">
          <h4 class="scribe__section-title">${esc(section.title)}</h4>
          <div class="scribe__section-actions">
            ${
              done
                ? '<span class="scribe__done">In the note</span>'
                : `<button type="button" class="scribe__insert" data-scribe-copy="${esc(
                    section.id
                  )}" data-testid="scribe--copy-${esc(section.id)}">Insert to Note</button>`
            }
            <button type="button" class="scribe__edit${editing ? ' scribe__edit--on' : ''}"
              data-scribe-edit="${esc(section.id)}"
              data-testid="scribe--edit-${esc(section.id)}">
              ${iconMarkup('pencil')}${editing ? 'Done' : 'Edit'}
            </button>
          </div>
        </header>
        ${
          /* EDIT BEFORE IT GOES IN, NOT AFTER. A draft that can only be
             corrected once it is in the note has already put words in a
             document somebody signs; correcting it here is correcting a
             proposal. What is typed is what Insert to Note then carries. */
          editing
            ? `<textarea class="scribe__section-edit" data-scribe-text="${esc(section.id)}"
                data-testid="scribe--text-${esc(section.id)}">${esc(text)}</textarea>`
            : `<p class="scribe__section-text">${esc(text)}</p>`
        }
      </article>`;
    })
    .join('');

  return `<div class="scribe__scrim" data-testid="scribe--modal">
      <div class="scribe__modal" role="dialog" aria-label="AI generated ${esc(
        source.noun.toLowerCase()
      )}">
        <header class="scribe__modal-head">
          <div class="scribe__tabs" role="tablist">
            <button type="button" role="tab" aria-selected="${onNote}"
              class="scribe__tab${onNote ? ' scribe__tab--on' : ''}"
              data-scribe-tab="note" data-testid="scribe--tab-note">AI Generated ${esc(
                source.noun
              )}</button>
            <button type="button" role="tab" aria-selected="${!onNote}"
              class="scribe__tab${onNote ? '' : ' scribe__tab--on'}"
              data-scribe-tab="transcript"
              data-testid="scribe--tab-transcript">Transcription</button>
          </div>
          <button type="button" class="scribe__close" data-scribe-close
            aria-label="Close" data-testid="scribe--close">${iconMarkup('close')}</button>
        </header>

        ${
          onNote
            ? `<p class="scribe__meta">Generated ${esc(state.generatedAt)}
                <span class="scribe__meta-rule"></span> Created in ${state.tookSeconds} seconds
                <span class="scribe__meta-rule"></span> ${
                  outstanding.length
                    ? `Nothing is in the ${esc(source.noun.toLowerCase())} yet`
                    : `All sections are in the ${esc(source.noun.toLowerCase())}`
                }</p>
              <div class="scribe__modal-body">${sections}</div>`
            : `<div class="scribe__modal-body scribe__modal-body--transcript"
                style="--scribe-scale:${scaleFor(state.textSize)}">
                ${transcriptLinesHtml(source, state, { colon: true })}
              </div>`
        }

        <footer class="scribe__modal-foot">
          <button type="button" class="scribe__ghost" data-scribe-close
            data-testid="scribe--modal-close">Close</button>
          ${
            onNote
              ? `<button type="button" class="scribe__primary" data-scribe-import
                  ${outstanding.length ? '' : 'disabled'}
                  data-testid="scribe--import">Import to ${esc(source.noun)}</button>`
              : `<button type="button" class="scribe__download" data-scribe-download
                  data-testid="scribe--download">${iconMarkup('download')}Download</button>`
          }
        </footer>
      </div>
    </div>`;
}

function render(host, source, state) {
  host.innerHTML = `${state.phase === 'idle' ? tileHtml({ bar: true }) : ''}
    ${cardHtml(source, state)}
    ${state.phase === 'ready' ? generateHtml(source, state) : ''}
    ${state.phase === 'drafting' ? draftingHtml(source, state) : ''}
    ${state.phase === 'draft' ? modalHtml(source, state) : ''}`;
}

/* ===================== Wiring ===================== */

/**
 * Mount the scribe into `host`.
 *
 * @param {object}   options
 * @param {Element}  options.host     where the tile, bar and panel are drawn
 * @param {Function} options.onCopy   (section) => boolean — put this section's
 *                                    text in the note; false means it could not
 *                                    be placed, and the section stays offered
 * @param {Function} [options.announce] the screen's own way of saying something
 * @param {object}   [options.source] the room's material — speakers, transcript,
 *                                    duration, draft, stages. Defaults to the
 *                                    clinic consultation.
 */
export function mountAiScribe({ host, onCopy, announce = () => {}, source: given = CLINIC_SOURCE }) {
  if (!host) return null;

  const source = { noun: 'Note', ...given };

  const state = initialState();
  let timer = null;

  /*
   * WHERE THE PANEL SITS.
   *
   * Applied after every paint rather than written into the markup, because the
   * panel is re-rendered once a second while recording and an inline style in
   * the template would be re-read — and re-clamped — on every one of those.
   *
   * IT OPENS ON THE LINE OF THE BUTTON THAT OPENED IT.
   *
   * Over towards the right border, on the line of the trigger standing on the
   * document's toolbar, so the first frame of the panel is that button's
   * corner and the growth is visibly the button unfolding; see
   * .scribe__card--opening. A panel that appeared in a
   * different corner would be a second object arriving, and the press that
   * produced it would have to be remembered rather than watched.
   *
   * The button is measured rather than assumed, because the bar it stands on
   * is at a different height on every screen that mounts this — the encounter
   * stacks two header bands, the clinic note has one. --scribe-panel-top is the
   * offset used when there is nothing to measure — a first paint with no
   * button laid out yet — and the screens still set it: see .enc in
   * css/screen-clinic-visit.css.
   *
   * It stops a small step short of the right border rather than against it.
   * The panel is a thing standing on the page, and a shadowed card with its
   * edge welded to the window's has nothing to cast a shadow onto. The gap is
   * what says it is on top.
   *
   * Clamped into the viewport on every paint, because a panel dragged to the
   * edge of a wide screen and met on a narrow one would otherwise open off it
   * with nothing left to grab. The clamp still allows flush, because a panel
   * somebody has dragged there is where they put it.
   */
  const PANEL_EDGE_GAP = 16;
  const fallbackTop = () => {
    const raw = getComputedStyle(host).getPropertyValue('--scribe-panel-top').trim();
    if (!raw) return 76;
    /* Resolved against the page's own font size rather than parsed by hand:
       the variable is authored in rem by whichever screen set it, and this is
       the one place that has to turn it into a pixel. */
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;height:${raw}`;
    document.body.append(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px || 76;
  };

  /*
   * WHERE THE TRIGGER WAS STANDING WHEN IT WAS PRESSED.
   *
   * Read off the button itself, on the paint BEFORE the one that opens the
   * panel, because by the time there is a panel to place the button it grew
   * out of has been replaced by it. The host's own box is no use once that
   * has happened — an empty flex item on a centred bar collapses to a
   * hairline, and the panel would open on the bar's midline rather than on
   * the button's top edge.
   */
  let triggerTop = null;

  const rememberTrigger = () => {
    /* The bar's copy specifically. The recording panel carries a tile of its
       own, at the left of its title row, and that one is part of the panel
       being placed rather than the thing it was opened from. */
    const trigger = host.querySelector('.scribe__tile--bar, .scribe__generate--bar');
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    if (box.height) triggerTop = box.top;
  };

  const placePanel = () => {
    const panel = host.querySelector('[data-scribe-panel]');
    if (!panel) return;

    const box = panel.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - box.width);
    const maxTop = Math.max(0, window.innerHeight - box.height);

    const left = state.pos ? state.pos.left : Math.max(0, maxLeft - PANEL_EDGE_GAP);
    const top = state.pos ? state.pos.top : Math.min(triggerTop ?? fallbackTop(), maxTop);

    state.pos = {
      left: Math.min(Math.max(left, 0), maxLeft),
      top: Math.min(Math.max(top, 0), maxTop),
    };
    panel.style.left = `${state.pos.left}px`;
    panel.style.top = `${state.pos.top}px`;

    /*
     * The unfold, once. The panel is rebuilt every second while recording, so
     * the class has to be withheld from every paint after the first — put on
     * each one it would replay a hundred and eighty times in a three-minute
     * recording, which is not an animation, it is a strobe.
     */
    if (!openedOnce) {
      openedOnce = true;
      panel.classList.add('scribe__card--opening');
    }
  };

  const paint = () => {
    notePinned();
    rememberTrigger();
    render(host, source, state);
    restorePinned();
    /* A phase with no panel is a panel that has closed: the next one to open
       is a new one and gets the animation again. Read after the render, from
       the DOM rather than from the phase, so there is one definition of
       "there is a panel" and both this and placePanel use it. */
    if (!host.querySelector('[data-scribe-panel]')) {
      openedOnce = false;
      /* And where it sits is forgotten with it. A panel dragged out of the way
         during one recording should not make the next one open in the corner
         somebody put the last one — the button on the bar is where it comes
         from, every time. */
      state.pos = null;
    }
    placePanel();
  };

  const stopClock = () => {
    clearInterval(timer);
    timer = null;
  };

  /*
   * KEEP THE NEWEST LINE IN VIEW — UNLESS SOMEBODY HAS SCROLLED BACK.
   *
   * A transcript being written is read from the bottom, so it follows. But the
   * reason to scroll a live transcript at all is to read something that was
   * said thirty seconds ago, and a box that yanks itself back to the bottom
   * every second is a box in which that cannot be done. So the follow only
   * happens when the view is already at the bottom, within a line's slack —
   * scroll up and it stays put; scroll back down and it starts following
   * again, with no mode to set and nothing to remember.
   */
  const followTranscript = () => {
    const log = host.querySelector('[data-scribe-scroll]');
    if (!log) return;
    if (log.dataset.pinned === 'no') return;
    log.scrollTop = log.scrollHeight;
  };

  /* Whether the panel has already played its opening. Reset when the panel
     goes away, so a second recording in the same sitting unfolds again. */
  let openedOnce = false;

  /* Read BEFORE the repaint that replaces the element, and stamped onto the
     new one after — the scroll position does not survive innerHTML, so
     whether it was at the bottom has to cross that gap as a flag. */
  let pinnedToBottom = true;

  const notePinned = () => {
    const log = host.querySelector('[data-scribe-scroll]');
    if (!log) return;
    const slack = 24;
    pinnedToBottom = log.scrollHeight - log.scrollTop - log.clientHeight <= slack;
  };

  const restorePinned = () => {
    const log = host.querySelector('[data-scribe-scroll]');
    if (log) log.dataset.pinned = pinnedToBottom ? 'yes' : 'no';
  };

  /*
   * One second of recording per second, and the transcript follows the clock.
   *
   * It stops itself at the end of the consultation rather than running on into
   * silence — a recorder still counting after the last thing anybody said
   * invites the clinician to sit and wait for more — and lands in `ready`,
   * where the tile offers to write the note.
   */
  const startClock = () => {
    stopClock();
    timer = setInterval(() => {
      state.elapsed += 1;
      if (state.elapsed >= source.duration) {
        state.elapsed = source.duration;
        state.phase = 'ready';
        stopClock();
        announce('The consultation has finished. Generate the note when you are ready.');
      }
      paint();
      followTranscript();
    }, 1000);
  };

  const toDraft = () => {
    state.phase = 'drafting';
    state.elapsed = 0;
    paint();
    stopClock();
    /* The wait is authored, and about as long as the real thing takes. Long
       enough that the dialog has to say what it is doing; short enough that
       nobody goes to make tea. */
    timer = setInterval(() => {
      state.elapsed += 1;
      if (state.elapsed >= 6) {
        stopClock();
        state.phase = 'draft';
        state.elapsed = source.duration;
        state.generatedAt = new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        });
        state.tookSeconds = 6;
        /* No toast: the panel that has just opened says this at its head, and
           says it every time it is opened rather than once, in passing. */
      }
      paint();
    }, 1000);
  };

  /* Typing in an open section is kept as it is typed. Not on `input` into a
     repaint — that would take the caret out of the box on every keystroke —
     but into state, so a repaint from anywhere else does not lose the edit. */
  host.addEventListener('input', (event) => {
    const box = event.target.closest('[data-scribe-text]');
    if (box) state.text[box.dataset.scribeText] = box.value;
  });

  /*
   * DRAGGING THE PANEL.
   *
   * Bound once to the host, which survives every repaint — the panel inside it
   * does not, so a listener on the panel would be a listener on an element
   * replaced a second later.
   *
   * A press that lands on a CONTROL is not a drag. The handle is the whole bar
   * because that is what a title bar is, and the bar happens to have Pause, CC
   * and Stop sitting in it; without this test, pressing Pause would move the
   * panel a pixel and never pause anything.
   *
   * Listeners on `window` and pointer capture as an enhancement rather than
   * the mechanism, for the reason the live feed's window does the same: every
   * drag leaves the strip it started on within a few pixels, and capture
   * throws where there is no live pointer to capture.
   */
  host.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const handle = event.target.closest('[data-scribe-drag]');
    if (!handle || event.target.closest('button')) return;

    const panel = host.querySelector('[data-scribe-panel]');
    if (!panel) return;

    const box = panel.getBoundingClientRect();
    const offsetX = event.clientX - box.left;
    const offsetY = event.clientY - box.top;

    panel.dataset.dragging = 'yes';
    event.preventDefault();
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* Nothing to capture. The window listeners below do the work. */
    }

    const move = (moved) => {
      state.pos = { left: moved.clientX - offsetX, top: moved.clientY - offsetY };
      placePanel();
    };
    const drop = () => {
      panel.removeAttribute('data-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', drop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
  });

  /* A resized viewport can strand the panel off the edge. Same clamp, same
     place, so there is one answer to where it may be. */
  window.addEventListener('resize', placePanel);

  host.addEventListener('click', (event) => {
    /* The size menu closes on the next press anywhere that is not itself. */
    if (state.sizeMenu && !event.target.closest('.scribe__size')) {
      state.sizeMenu = false;
      paint();
    }

    if (event.target.closest('[data-scribe-toggle]')) {
      state.phase = 'recording';
      startClock();
      paint();
      return;
    }

    if (event.target.closest('[data-scribe-generate]')) {
      /* A draft already exists — this is the way back into it, not a second
         run at the same recording. See generateHtml. */
      if (state.generatedAt) {
        state.phase = 'draft';
        paint();
        return;
      }
      toDraft();
      return;
    }

    if (event.target.closest('[data-scribe-close]')) {
      stopClock();
      /* Closed with something recorded stays offered; closed with nothing goes
         back to the bare tile. Closing the generated note does NOT throw the
         draft away — the recording is still there and the control says so. */
      state.phase = state.elapsed > 0 ? 'ready' : 'idle';
      state.editing = '';
      paint();
      return;
    }

    if (event.target.closest('[data-scribe-stop]')) {
      stopClock();
      state.phase = 'ready';
      paint();
      return;
    }

    if (event.target.closest('[data-scribe-pause]')) {
      if (state.phase === 'recording') {
        state.phase = 'paused';
        stopClock();
      } else {
        state.phase = 'recording';
        startClock();
      }
      paint();
      return;
    }

    if (event.target.closest('[data-scribe-cc]')) {
      state.captions = !state.captions;
      paint();
      return;
    }

    if (event.target.closest('[data-scribe-size]')) {
      state.sizeMenu = !state.sizeMenu;
      paint();
      return;
    }

    const pick = event.target.closest('[data-scribe-size-pick]');
    if (pick) {
      state.textSize = pick.dataset.scribeSizePick;
      state.sizeMenu = false;
      paint();
      return;
    }

    const tab = event.target.closest('[data-scribe-tab]');
    if (tab) {
      state.tab = tab.dataset.scribeTab;
      paint();
      return;
    }

    const edit = event.target.closest('[data-scribe-edit]');
    if (edit) {
      const id = edit.dataset.scribeEdit;
      state.editing = state.editing === id ? '' : id;
      paint();
      host.querySelector('[data-scribe-text]')?.focus();
      return;
    }

    if (event.target.closest('[data-scribe-cancel]')) {
      stopClock();
      state.phase = 'ready';
      state.elapsed = source.duration;
      paint();
      return;
    }

    /* The transcript, as a file. It is the record of what was said, and a
       clinician who wants it outside this screen — for a complaint, a
       supervision, a second opinion — should not have to select it by hand. */
    if (event.target.closest('[data-scribe-download]')) {
      const text = source.transcript
        .map((line) => `${clock(line.at)}  ${source.speakers[line.who].label}: ${line.text}`)
        .join('\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'transcript.txt';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    /* One section, or the rest of them. Both go through the same `take`, so
       what Import does to five sections is exactly what Insert did to one. */
    const take = (section) => {
      const words = state.text[section.id] ?? section.text;
      if (onCopy({ ...section, text: words }) === false) return false;
      state.copied.add(section.id);
      return true;
    };

    const copy = event.target.closest('[data-scribe-copy]');
    if (copy) {
      const section = source.draft.find((entry) => entry.id === copy.dataset.scribeCopy);
      if (!section || !take(section)) return;
      state.editing = '';
      paint();
      announce(`${section.title} inserted into the ${source.noun.toLowerCase()}.`);
      return;
    }

    /*
     * IMPORT TAKES THE WHOLE DRAFT AND SHUTS THE DIALOG.
     *
     * Insert to Note is the per-section press, for the clinician reading one
     * paragraph at a time and deciding about each; Import is the other
     * decision, made once, about all of it. It used to take the outstanding
     * sections and leave the dialog standing over the document it had just
     * written into — which is the one moment the clinician wants to SEE the
     * document, to check what landed where.
     *
     * So it closes. A section already inserted by hand is not inserted twice:
     * `take` is only offered the ones not yet copied, which is the same guard
     * the per-section button has.
     */
    if (event.target.closest('[data-scribe-import]')) {
      const taken = source.draft
        .filter((section) => !state.copied.has(section.id))
        .filter((section) => take(section)).length;

      state.editing = '';
      /* Back to the offered state rather than to nothing: the recording still
         exists and the draft can be reopened from the control that says so. */
      stopClock();
      state.phase = state.elapsed > 0 ? 'ready' : 'idle';
      paint();

      announce(
        taken
          ? `${taken} section${taken === 1 ? '' : 's'} inserted into the ${source.noun.toLowerCase()} — marked as AI filled.`
          : 'Nothing could be placed in this document.'
      );
    }
  });

  paint();

  /* Returned so the screen can put the scribe away when the note is signed or
     the encounter is left — a recorder running over a closed note is the one
     state this must not be able to reach. */
  return {
    close() {
      stopClock();
      state.phase = state.elapsed > 0 ? 'ready' : 'idle';
      paint();
    },
  };
}
