/**
 * Patient check-in — the procedure arrival flow.
 *
 * Reached from the scheduler when a Procedure booking is checked in, with the
 * appointment id on the query string. Everything it needs is derived from that
 * booking, so the desk never retypes — or mis-picks — what the schedule
 * already knows.
 *
 * ONE PANE AT A TIME, WITH THE WHOLE OF IT DOWN THE SIDE
 *
 * The paperwork used to be a single scrolling column of cards with a progress
 * bar across the top. Two things were wrong with that. The consent documents
 * are long, so the bar scrolled out of reach exactly when somebody wanted to
 * know what was left; and every section was on screen at once, which made a
 * run of documents look like one enormous form rather than five things to
 * work through in order.
 *
 * So: a rail on the left listing every step with its own state, and one pane
 * open at a time on the right. The rail is the answer to "what is still
 * outstanding" and it never moves. Previous and Next walk the same list.
 *
 * PANES ARE HIDDEN, NEVER REBUILT
 *
 * Every pane exists in the DOM from the start and switching steps toggles
 * `hidden`. It has to work that way: the signature pad holds the only copy of
 * whatever has been drawn on it — the mark lives in a <canvas>, not in state —
 * and a re-render would take it with it, mid-signing, which is precisely when
 * someone reaches for the step they were on a moment ago. The same goes for a
 * half-answered radio group or a part-typed note.
 *
 * WHO SIGNS WHAT
 *
 * Two panes are signed: the procedure consent and the insurance authorisation,
 * which are the two things on this run the patient AGREES to. The pad is
 * literally the patient portal's, imported rather than rebuilt: draw it, or
 * upload a photograph or scan of a signed sheet.
 *
 * Nothing else is. The privacy notice is acknowledged Yes or No, and the
 * directives and arrival panes are questions the desk answers from what the
 * patient says — a mark under a transcription is not an attestation of it.
 * CHECKIN_SECTIONS in data/checkin.js is where that is decided, and its header
 * carries the reasoning pane by pane.
 */
import {
  CONSENT_DOCUMENTS,
  ARRIVAL_MODES,
  DISCHARGE_ARRANGEMENTS,
  DRIVER_REQUIRED,
  CHECKIN_SECTIONS,
} from '../../data/checkin.js';
import { findAppointment, updateAppointment } from '../../data/appointment-store.js';
import { DIRECTORY } from '../../data/directory.js';
/*
 * The patient portal's signature block, used here rather than rebuilt.
 *
 * Check-in signs the same consents the portal does, and there is no argument
 * for the desk and the patient meeting two different controls for the one
 * act. Everything hard about a signature pad — sizing the backing store to
 * the element's real box, keeping a stroke across a resize, the upload
 * alternative and what counts as signed — is solved in that module already,
 * and a second copy of it on this side would drift from the first.
 *
 * Its styling comes across in css/components/sign-pad.css, which bridges the
 * portal's token names onto this side's so the rules could be copied intact.
 */
import { signatureMarkup, wireSignature } from '../../patient/js/lib/signature-pad.js';
import { installIconSprite as installPortalIcons } from '../../patient/js/lib/icons.js';
import { notify as toast } from '../lib/toast.js';
import { downloadAsPdf } from '../lib/print-document.js';

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function displayTime(value) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

const DOCUMENTS = new Map(CONSENT_DOCUMENTS.map((doc) => [doc.id, doc]));

/* Only so a filed signature can name its signer — nothing on screen reads
   from this any more. */
const PATIENTS = new Map(DIRECTORY.map((p) => [p.mrn, p]));

/*
 * The portal's sprite, alongside this side's own.
 *
 * The signature block's upload zone asks for `#pi-image`, and the two sprites
 * use different id prefixes — `i-` here, `pi-` there — so both can sit in the
 * page without either shadowing the other.
 */
installPortalIcons();

/* ===================== State ===================== */

const appointment = findAppointment(
  new URLSearchParams(window.location.search).get('appt')
);

const state = {
  /* What was actually captured, per pane: the name, how it was given, and the
     mark itself. A tick alone says a signature happened; a consent form has to
     be able to show whose it was. Keyed by section id. */
  signatures: new Map(),
  /** Which pane is open — an index into CHECKIN_SECTIONS. */
  step: 0,
};

const sectionAt = (index) => CHECKIN_SECTIONS[index];
const currentSection = () => sectionAt(state.step);

/* ===================== Is a step finished? ===================== */

/**
 * The advance directives pane, answered through.
 *
 * Not "the first question has a value". Each answer opens the question below
 * it, and the pane is only done once that chain has run out: a directive on
 * file, or an offer made and taken up or refused. An unanswered HAS is not a
 * finished pane, which is why the first branch below tests for "No" rather
 * than assuming anything that is not "Yes" must be it.
 */
function directivesAnswered() {
  const has = el('hasDirectives').value;
  if (has === 'Yes') return Boolean(el('directivesOnFile').value);
  if (has !== 'No') return false;

  const offered = el('offeredDirectives').value;
  if (offered === 'No') return true;
  return offered === 'Yes' && Boolean(el('directiveOutcome').value);
}

/** The arrival pane: how they came, how they leave, and who takes them. */
function arrivalAnswered() {
  const discharge = el('discharge').value;
  if (!el('arrival').value || !discharge) return false;
  if (!DRIVER_REQUIRED.includes(discharge)) return true;
  // Sedation and no named escort is the case the rule exists to catch.
  return Boolean(el('driverName').value.trim() && el('driverPhone').value.trim());
}

/**
 * Everything a pane needs before the rail marks it done.
 *
 * An optional step used to answer `true` here the moment the screen opened,
 * which put a tick against Additional Notes before anybody had been near it.
 * A rail that starts with something already ticked is telling the desk it did
 * work it has not done, and the one mark on an otherwise empty list is the one
 * the eye goes to. Optional means "this need not be filled in", not "this is
 * finished" — so it earns its tick the same way every other step does, by
 * having something in it. What a mark is NOT is permission. Nothing in here
 * holds the save shut any more — the rail records what has been worked, and
 * the desk decides when the check-in is finished.
 */
function sectionDone(section) {
  if (section.sign && !state.signatures.has(section.id)) return false;
  /* Either answer finishes the pane. "No" is a real record — the notice was
     offered and the patient did not take a copy — and a rail that only ticked
     on Yes would be pressing the desk towards the answer it wanted. */
  if (section.id === 'privacy') return Boolean(el('privacyAck')?.value);
  if (section.id === 'directives') return directivesAnswered();
  if (section.id === 'arrival') return arrivalAnswered();
  if (section.id === 'notes') return Boolean(el('notes').value.trim());
  return true;
}

/* ===================== The rail ===================== */

function paintRail() {
  const done = CHECKIN_SECTIONS.map(sectionDone);

  /* No count above the list. Each step already carries its own mark, so a
     tally of them restated in words was the same fact a second time — and it
     was the fact nobody needed, since what the desk acts on is which step is
     outstanding, not how many are. The foot of the pane names those. */
  el('rail').innerHTML = `
    <ol class="cin__rail-list">
      ${CHECKIN_SECTIONS.map((section, index) => {
        const classes = [
          'cin__rail-item',
          done[index] && 'cin__rail-item--done',
          index === state.step && 'cin__rail-item--current',
        ].filter(Boolean).join(' ');

        return `<li>
          <button type="button" class="${classes}" data-step="${index}"
            ${index === state.step ? 'aria-current="step"' : ''}
            data-testid="cin--rail-${section.id}">
            <span class="cin__rail-mark" aria-hidden="true">
              <svg class="ui-icon"><use href="#i-check"></use></svg>
            </span>
            <span class="cin__rail-label">${esc(section.title)}</span>
            ${section.optional ? '<span class="cin__rail-note">Optional</span>' : ''}
          </button>
        </li>`;
      }).join('')}
    </ol>`;

  el('rail').querySelectorAll('[data-step]').forEach((button) =>
    button.addEventListener('click', () => showStep(Number(button.dataset.step)))
  );

  /* Nothing below this line disables Save, and that is deliberate. A patient
     who will not answer the directives question, or who turns up for a sedated
     procedure without the escort the discharge plan wants, still has to be
     checked in; a Save greyed out in front of that case leaves the desk with
     no way through the screen and no record of the visit at all. The rail
     still marks every step that has been worked, so what is outstanding is on
     the screen the whole time — as information, not as a lock. */
}

/* ===================== Signature blocks ===================== */

/**
 * A signed pane — the mark, and who made it.
 *
 * The image is shown rather than a tick alone. "Signed electronically" is a
 * claim about something that happened; the signature is the evidence, and a
 * consent that cannot show it is not much of a record. Sign again is there
 * because the commonest mistake at a busy desk is the wrong person signing,
 * and a mark that cannot be taken back would have to be undone by starting
 * check-in over.
 */
function signedMarkup(id) {
  const mark = state.signatures.get(id);
  return `<p class="cin__doc-signed">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
      Signed electronically by ${esc(mark.name)}.
    </p>
    <figure class="cin__doc-mark">
      <img src="${mark.dataUrl}" alt="Signature of ${esc(mark.name)}"
        data-testid="cin--signature-image-${id}">
      <!-- Who and when, as two things rather than a run-on — the same caption
           the encounter's filed marks carry (js/lib/signature-block.js). The
           name is the attribution and is set as one; the route the mark was
           given by has gone, because it answers a question nobody reading back
           a consent asks and it was crowding the two that matter. -->
      <figcaption class="cin__doc-by">
        <span class="cin__doc-signer">${esc(mark.name)}</span>
        <span class="cin__doc-at">${esc(mark.at)}</span>
      </figcaption>
    </figure>
    <div class="cin__doc-actions">
      <ui-button variant="ghost" data-resign="${id}"
        data-testid="cin--resign-${id}">Sign again</ui-button>
    </div>`;
}

/* The map from method to words — "Drawn signature", "Uploaded image", "Typed
   name" — used to close the caption under every filed mark, and went with it:
   the evidence sits directly above the line, and how it was given says nothing
   about who signed or when. `method` is still stored on every mark. */

/**
 * A pane waiting to be signed.
 *
 * The pad is on screen from the start, the way the patient portal puts it on
 * a consent form. It used to be hidden behind the e-signature tickbox, on the
 * reasoning that showing it first would collect a mark the patient had not
 * agreed could be given that way. What that produced in practice was a step
 * that looked finished — a document, a notice, a checkbox — with the actual
 * work invisible until somebody guessed that ticking the box would reveal
 * more. The desk reads the consent aloud, the patient reaches for the pad,
 * and there is no pad.
 *
 * The consent still governs: it sits under the pad, and confirming a mark
 * without it is refused below rather than prevented by hiding the control.
 * Nothing is filed until the box is ticked, which is the part that actually
 * mattered — a drawn line that is never recorded is not a signature.
 */
function signingMarkup(id) {
  /*
   * The portal renders one of these per page; check-in holds six at once,
   * hidden rather than removed, so anything the block names globally has to
   * be made per-pane on the way in. The radio group is the one that bites —
   * six pads sharing `name="signMode"` are one group, and choosing Upload on
   * the insurance form would take the procedure consent's Draw off with it.
   * The heading id follows for the same reason: `aria-labelledby` pointing at
   * a duplicated id resolves to whichever came first.
   */
  return `<div class="cin__pad" data-pad-wrap="${id}">${signatureMarkup()
    .replaceAll('name="signMode"', `name="signMode-${id}"`)
    .replaceAll('sign-heading', `sign-heading-${id}`)
    .replace('data-testid="form--signature"', `data-testid="cin--signature-${id}"`)}</div>`;
}

/** Draw (or redraw) one pane's signature block and wire whatever is in it. */
function paintSignature(id) {
  const host = document.querySelector(`[data-sign="${id}"]`);
  if (!host) return;

  const signed = state.signatures.has(id);
  host.innerHTML = signed ? signedMarkup(id) : signingMarkup(id);

  if (signed) {
    host.querySelector(`[data-resign="${id}"]`).addEventListener('ui-click', () => {
      state.signatures.delete(id);
      paintSignature(id);
      paintRail();
      paintPaneHead();
    });
    return;
  }

  /*
   * No Confirm button of its own.
   *
   * The portal's block finishes when there is a mark AND the confirmation
   * beneath it is ticked, and it reports that moment through onChange. That is
   * the whole of "signed", so filing on it is exact: a third control asking
   * the desk to confirm the confirmation would only add a way to draw a
   * signature, tick the box, and still walk away with nothing recorded.
   *
   * The mark carries the patient's name from the booking. Nothing on this
   * screen displays it any more, but a consent that cannot say whose
   * signature it holds is not a record of anything.
   */
  const signer = PATIENTS.get(appointment?.mrn)?.name ?? 'Patient';

  const pad = wireSignature(host, {
    name: signer,
    onChange: (isSigned) => {
      if (!isSigned) return;

      const mark = pad.read();
      if (!mark) return;

      state.signatures.set(id, {
        name: mark.name,
        method: mark.method,
        fileName: mark.fileName,
        dataUrl: mark.dataUrl,
        at: signedAtLabel(),
      });
      paintSignature(id);
      paintRail();
      paintPaneHead();
    },
  });
}

/** When the mark was made, in words — the caption under a filed signature. */
function signedAtLabel() {
  const now = new Date();
  return `${longDate(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`
  )} at ${displayTime(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  )}`;
}

/* ===================== The consent documents ===================== */

/**
 * One pane per document, built once.
 *
 * The prose is a scrolling region rather than a block the pane grows to fit: a
 * consent form the desk cannot see the end of is one nobody reads, and a
 * page-length wall of it buries the signature underneath.
 *
 * A document may carry no prose at all — the privacy notice does not, because
 * it is handed over on paper and only the yes-or-no about that needs
 * recording. The region is then left out entirely rather than drawn empty: an
 * empty bordered box reads as prose that failed to load.
 */
function buildDocumentPanes() {
  el('docViews').innerHTML = CONSENT_DOCUMENTS.map(
    (doc) => `<section class="cin__view" data-view="${doc.id}" hidden>
      ${
        doc.paragraphs?.length
          ? `<div class="cin__doc-text" tabindex="0" role="region"
           aria-label="${esc(doc.title)} content">
        ${doc.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      </div>`
          : ''
      }
      ${
        doc.acknowledge
          ? acknowledgeMarkup(doc)
          : `<div class="cin__sign" data-sign="${doc.id}"></div>
             <!--
               PRINT ONLY, AND ONLY WHILE THE PAD IS STILL THERE.

               A signed consent prints its mark and says who signed and when.
               An unsigned one printed as the document and stopped, which is a
               sheet that can be mistaken for the record of an act that never
               happened — and it is a copy of an unsigned consent that a
               patient is most likely to be handed, because that is the one
               they take away to read. The .txt this download used to produce
               said so in words; the PDF says it here. See .cin__unsigned in
               css/screen-checkin.css, which shows it only on paper and only
               for a document whose pad has not been signed.
             -->
             <p class="cin__unsigned">NOT SIGNED — this is a copy of the document
               only. It records no consent.</p>`
      }
    </section>`
  ).join('');

  /* One listener on the head's slot rather than two per document. The bar is
     rebuilt on every step change, and a handler bound to each button would have
     to be rebound with it; delegation survives that by not caring. */
  el('paneActions').addEventListener('ui-click', onDocumentBarClick);
}

/* ===================== Print and download ===================== */

/**
 * THE TWO THINGS A DESK DOES WITH A CONSENT THAT ARE NOT READING IT.
 *
 * Print and Download are the patient's copy. They are asked for at the moment
 * the form is handed over rather than four paragraphs in, and they are live
 * before the document is signed as well as after. An unsigned copy is a
 * legitimate thing to want: it is what somebody takes away to read, and the
 * text below says in so many words that it is not a record of consent.
 *
 * The pair sits in the pane head, on the heading's own line, rather than on a
 * bar of its own between the heading and the prose. Two rows of furniture
 * above a document that is already inside a scrolling box pushed the reading
 * down the pane for nothing; the head was built with a right-hand slot for
 * exactly this and was standing empty.
 *
 * There was a third button here, E-sign, which scrolled the pane to the
 * signature pad. It has gone. The pad is on the pane from the start now and
 * the rail marks which documents still want a mark, so a button whose whole
 * job was to scroll was one more control on the row that answered a question
 * nobody was left asking.
 */
function documentBarMarkup(doc) {
  return `<div class="cin__doc-bar" data-doc-bar="${doc.id}">
    <ui-button variant="tertiary" size="sm" icon="printer" data-doc-print="${doc.id}"
      data-testid="cin--print-${doc.id}">Print</ui-button>
    <ui-button variant="tertiary" size="sm" icon="download" data-doc-download="${doc.id}"
      data-testid="cin--download-${doc.id}">Download</ui-button>
  </div>`;
}

function onDocumentBarClick(event) {
  const button = event.target.closest('[data-doc-print], [data-doc-download]');
  if (!button) return;

  const { docPrint, docDownload } = button.dataset;
  if (docPrint) return printDocument(DOCUMENTS.get(docPrint));
  downloadDocument(DOCUMENTS.get(docDownload));
}

/**
 * Hand the open document to the browser's print path.
 *
 * Only the open pane is on screen — every other one is `hidden` — so the
 * browser prints the document in front of the desk and nothing else. What the
 * print stylesheet takes out is the furniture around it: the rail, this bar,
 * the pad and the way out of the step. See @media print in
 * css/screen-checkin.css.
 *
 * The report goes out BEFORE the dialog, not after: window.print() blocks the
 * page for as long as the browser's own window is up, so a message fired
 * afterwards arrives once the reader has already finished with the thing it
 * was reporting on.
 */
function printDocument(doc) {
  if (!doc) return;
  toast(`Printing ${doc.title}.`);
  window.print();
}

/**
 * Hand the open document over as a PDF.
 *
 * Download used to write a .txt file. A consent form is a document — it is
 * taken away, read, filed and shown to somebody who was not at the desk — and
 * a text file carried none of what makes it one: no letterhead, no layout,
 * and no way for the patient's own mark to travel with it. It is a PDF now,
 * through the same print path Print uses, so the copy on somebody's desktop
 * and the copy on paper are the same document. See js/lib/print-document.js
 * for why "download a PDF" is the browser's own Save as PDF here.
 *
 * Only the open pane is on screen — every other one is `hidden` — so no
 * markup is passed: the screen already IS this document. What the download
 * adds is the title, which is what the browser's Save dialog offers as the
 * filename.
 *
 * The unsigned case is not silent. The .txt said "NOT SIGNED" in words
 * because a mark cannot travel in a text file; on paper the mark travels, but
 * an unsigned consent would otherwise print as the document and stop, which
 * is a sheet that can be mistaken for the record of an act that never
 * happened. See .cin__unsigned in css/screen-checkin.css, printed by the
 * documents that have a signature block and have not been signed.
 */
function downloadDocument(doc) {
  if (!doc) return;
  const patient = PATIENTS.get(appointment?.mrn);

  /* Before the dialog, not after — window.print() blocks the page for as long
     as the browser's own window is up, so a message fired afterwards arrives
     once the reader has finished with the thing it was reporting on. */
  toast(`Choose “Save as PDF” to download ${doc.title}.`);
  downloadAsPdf({
    title: patient ? `${doc.title} — ${patient.name} (MRN ${patient.mrn})` : doc.title,
  });
}

/**
 * A document that is received rather than agreed to.
 *
 * Drawn in the same slot the pad would take and in the same shape as the
 * directives questions next door — the statement on the left, the two answers
 * on the right — because it is the same kind of thing: one fact about what
 * happened at the desk, with two possible answers. See the note over the
 * privacy document in data/checkin.js for why it is not a signature.
 */
function acknowledgeMarkup(doc) {
  const ask = doc.acknowledge;
  return `<div class="cin__q-grid">
    <div class="cin__q">
      <span class="cin__q-text">
        <strong>${esc(ask.question)}</strong>
      </span>
      <ui-radio-group id="${esc(ask.id)}" label="${esc(ask.question)}"
        label-hidden inline options="${esc(ask.options)}"
        data-testid="cin--${esc(doc.id)}-ack"></ui-radio-group>
    </div>
  </div>`;
}

/* ===================== Moving between panes ===================== */

function paintPaneHead() {
  const section = currentSection();
  el('paneTitle').textContent = section.title;

  /* Beside the name, Print and Download for the document being worked — and
     nothing on the steps that are not a document, because there is no file for
     them to hand over. Rebuilt per step rather than one bar per pane: only one
     pane is ever open, so six of them were five hidden copies of the same two
     buttons.

     What used to stand here besides — when the document was created, which
     version it is, and a badge repeating the signed-or-not that the rail
     already marks — was reference material about the form rather than anything
     the desk acts on while working it. */
  const doc = DOCUMENTS.get(section.id);
  el('paneActions').innerHTML = doc ? documentBarMarkup(doc) : '';

  el('prev').disabled = state.step === 0;

  /*
   * Next and Confirm are the same slot, not two buttons that happen to sit
   * together. On the last step there is nothing to go on to, so a Next that
   * is merely disabled is a dead control occupying the one place the eye goes
   * for what to do; Confirm takes the slot instead and the step ends the way
   * it actually ends. Being on the last step is now the whole of the question:
   * Confirm is shown there and is always live, since nothing on this screen
   * withholds the save any more.
   */
  const last = state.step === CHECKIN_SECTIONS.length - 1;
  el('next').hidden = last;
  el('confirm').hidden = !last;
}

function showStep(index) {
  state.step = Math.max(0, Math.min(index, CHECKIN_SECTIONS.length - 1));
  const id = currentSection().id;

  document.querySelectorAll('.cin__view').forEach((view) => {
    view.hidden = view.dataset.view !== id;
  });

  paintPaneHead();
  paintRail();
  // A pane opened after scrolling through a long document starts at its top,
  // not wherever the last one was left.
  el('views').scrollTop = 0;

  sizePadFor(id);
}

/**
 * Let a pad measure itself once its pane is actually on screen.
 *
 * The signature block sizes its canvas from the element's own box when it is
 * wired, and every pane here is `hidden` at that moment — check-in builds all
 * six up front and shows one. A hidden canvas measures 0, the block's resize
 * gives up on that, and the canvas is left at the browser's default 300×150
 * backing store behind a box that is nearer 1080×160. What that looks like at
 * the desk is a pad whose right-hand two thirds is dead: the stroke is being
 * drawn into a bitmap that ends at x=300, so ink past that point lands nowhere
 * and the patient signs on a surface that does not answer.
 *
 * The block re-measures on window resize, so telling the window it resized is
 * asking it to do the one thing it already knows how to do — and it is a
 * public event rather than a reach into the portal's internals, which matters
 * because that module is shared with a portal deployed from its own tree.
 * Only fired when a canvas is actually mis-sized, so switching steps does not
 * broadcast a layout event to the whole page for nothing.
 */
function sizePadFor(id) {
  const canvas = document.querySelector(`[data-sign="${id}"] [data-sign-canvas]`);
  if (!canvas) return;

  // The block draws at a fixed 2× rather than at devicePixelRatio — a
  // signature is printed and emailed, so its resolution is decided by the
  // paper it ends up on and not by the monitor it was given on.
  const box = canvas.getBoundingClientRect();
  if (!box.width || canvas.width === Math.round(box.width * 2)) return;

  window.dispatchEvent(new Event('resize'));
}

/* ===================== The check-in record ===================== */

/**
 * WHAT WAS FILED, AS LABEL AND VALUE.
 *
 * One definition for three readers — the dialog's summary, the sheet that
 * prints and the text file that downloads. A check-in that reads one way on
 * screen and another on paper is worse than one that only exists in a single
 * place, because the two copies are both handed out and only one of them can
 * be right.
 *
 * Read from the controls rather than from what updateAppointment was given, so
 * it says the same thing whether or not there was a booking to save against.
 */
function recordPairs() {
  const patient = PATIENTS.get(appointment?.mrn);
  const signed = CONSENT_DOCUMENTS.filter((doc) => state.signatures.has(doc.id));
  const discharge = el('discharge').value || 'Not recorded';
  const driver = el('driverName').value.trim();
  const notes = el('notes').value.trim();
  const pairs = [];

  if (patient) pairs.push(['Patient', `${patient.name} (MRN ${patient.mrn})`]);
  if (appointment) {
    pairs.push([
      'Appointment',
      `${longDate(appointment.date)} at ${displayTime(appointment.start)}`,
    ]);
    if (appointment.location) pairs.push(['Location', appointment.location]);
  }

  pairs.push(['Checked in', signedAtLabel()]);
  pairs.push([
    'Consents signed',
    signed.length ? signed.map((doc) => doc.title).join('; ') : 'None',
  ]);
  /* Three states, not two: acknowledged, declined, and never reached. See the
     note over the privacy document in data/checkin.js for why the third one
     has to stay tellable apart from the second. */
  pairs.push(['Privacy notice', el('privacyAck')?.value || 'Not recorded']);
  pairs.push(['Advance directives', directiveSummary()]);
  pairs.push(['Arrival', el('arrival').value || 'Not recorded']);
  pairs.push([
    'Discharge',
    driver ? `${discharge} — ${driver}, ${el('driverPhone').value.trim()}` : discharge,
  ]);
  if (notes) pairs.push(['Notes', notes]);

  return pairs;
}

/** The four directive questions, collapsed into the one sentence they add up to. */
function directiveSummary() {
  const has = el('hasDirectives').value;
  if (has === 'Yes') {
    const onFile = el('directivesOnFile').value;
    return onFile ? `Held; copy on file: ${onFile}` : 'Held; copy on file not recorded';
  }
  if (has === 'No') {
    const offered = el('offeredDirectives').value;
    if (offered === 'No') return 'None held; information not offered';
    if (offered === 'Yes') {
      const outcome = el('directiveOutcome').value;
      return outcome
        ? `None held; information offered and ${outcome.toLowerCase()}`
        : 'None held; information offered, outcome not recorded';
    }
  }
  return 'Not recorded';
}

/**
 * Fill the dialog's summary and the sheet that prints, from the same rows.
 *
 * Both are written now rather than at print time: window.print() is
 * synchronous, so anything built inside a beforeprint handler is a race with
 * the browser's own snapshot of the page.
 */
function paintRecord() {
  const rows = recordPairs()
    .map(
      ([label, value]) =>
        `<div class="cin__record-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
    )
    .join('');

  el('doneSummary').innerHTML =
    `<dl class="cin__record-list" data-testid="cin--done-summary">${rows}</dl>`;

  el('printRecord').innerHTML = `<h1 class="cin__record-title">Check-in record</h1>
    <dl class="cin__record-list">${rows}</dl>
    <p class="cin__record-foot">The signed consents are filed with the encounter.
      This sheet summarises the check-in; it is not a copy of them.</p>`;
}

/**
 * Say it is done, and show what "it" was.
 *
 * The dialog is filled every time it opens rather than once, because a
 * check-in can be saved, dismissed, corrected on a step and saved again — and
 * a summary that still showed the first attempt would be a printed sheet
 * disagreeing with the record it claims to describe.
 */
function openDone(trigger) {
  paintRecord();

  const patient = PATIENTS.get(appointment?.mrn);
  el('doneLead').textContent = appointment
    ? `${patient?.name ?? 'The patient'} is checked in and the visit has started.`
    : 'The paperwork is signed and on the record.';

  /* Opened without a booking there is no encounter to open, so the primary
     goes where the desk actually can: back to the schedule. Setting `text`
     rather than textContent — writing over a ui-button's own text wipes the
     <button> it rendered. */
  el('doneOpen').setAttribute('text', appointment ? 'Open note' : 'Back to the scheduler');

  el('doneModal').open(trigger);
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-select').then(() => {
  buildDocumentPanes();
  CHECKIN_SECTIONS.filter((section) => section.sign).forEach((section) =>
    paintSignature(section.id)
  );

  /*
   * Paint before wiring, not after.
   *
   * This used to be the last statement in this callback, which meant every
   * line of wiring below stood between the screen and its own contents.
   * Anything that threw in between — a control this file reaches for by id
   * that the markup no longer carries — left the panes built but every one of
   * them still hidden and the rail empty: a screen with a header, two empty
   * boxes and no way to tell that something had gone wrong. Painting first
   * means the worst a later failure can do is leave a control unresponsive on
   * a screen that otherwise reads correctly.
   */
  showStep(0);

  /* --- The privacy notice --- */
  /* Bound after the panes are built, because the group is rendered by
     buildDocumentPanes rather than written into check-in.html. Either answer
     moves the rail; see sectionDone. */
  el('privacyAck')?.addEventListener('ui-change', paintRail);

  /* --- Arrival and discharge --- */
  el('arrival').optionList = ARRIVAL_MODES.map((m) => ({ value: m, label: m }));
  el('discharge').optionList = DISCHARGE_ARRANGEMENTS.map((d) => ({ value: d, label: d }));

  el('arrival').addEventListener('ui-change', paintRail);
  el('discharge').addEventListener('ui-change', (event) => {
    el('driverFields').hidden = !DRIVER_REQUIRED.includes(event.detail.value);
    paintRail();
  });
  // An escort's name and number are part of what makes the pane answered, so
  // typing them has to move the rail with it.
  ['driverName', 'driverPhone'].forEach((id) =>
    el(id).addEventListener('ui-input', paintRail)
  );

  /* Notes earn their tick by having something in them, so typing has to move
     the rail with it — and deleting it all has to take the tick back off.
     The native `input` event rather than this component's own: <ui-textarea>
     emits ui-change on blur, and a tick that waits for the desk to click away
     before appearing looks like it missed the typing. `input` bubbles up from
     the inner <textarea>, so it lands here either way. */
  el('notes').addEventListener('input', paintRail);

  /* --- Advance directives ---
     Four separate facts: whether one exists, whether a copy is on file here,
     whether information was offered, and what came of the offer. Only the
     first is asked outright; the rest appear as the answer above them makes
     them relevant, and any answer already given is withdrawn when it stops
     being relevant.

     Withdrawing matters more than revealing. A desk that answers "Received",
     changes its mind about whether anything was offered, and signs would
     otherwise file an outcome for an offer that never happened — the record
     would be internally contradictory and nothing on screen would say so. */
  function reveal(cell, group, shown) {
    el(cell).hidden = !shown;
    if (!shown) group.removeAttribute('value');
    return shown;
  }

  function syncDirectives() {
    const has = el('hasDirectives').value;

    // Where the copy is only matters once there is one to find.
    reveal('directivesOnFileAsk', el('directivesOnFile'), has === 'Yes');

    // Nothing on file to record, so offer them the information instead.
    const offering = reveal('offeredDirectivesAsk', el('offeredDirectives'), has === 'No');

    reveal(
      'directiveOutcomeAsk',
      el('directiveOutcome'),
      offering && el('offeredDirectives').value === 'Yes'
    );

    paintRail();
  }

  ['hasDirectives', 'directivesOnFile', 'offeredDirectives', 'directiveOutcome'].forEach((id) =>
    el(id).addEventListener('ui-change', syncDirectives)
  );
  syncDirectives();

  /* --- Walking the rail --- */
  el('prev').addEventListener('ui-click', () => showStep(state.step - 1));
  el('next').addEventListener('ui-click', () => showStep(state.step + 1));

  /* --- The end of the run ---
     Print puts the record on paper, Download puts it in a file, and the
     primary goes on to the encounter. All three are wired once here; what
     they READ is rebuilt on every open, in openDone. */
  el('donePrint').addEventListener('ui-click', () => {
    /*
     * The body class swaps what prints: the record sheet instead of the pane
     * behind the dialog, which by this point is Additional Notes. Taken off
     * again on afterprint rather than on the next line — window.print() is
     * synchronous in most browsers but not guaranteed to be, and a class
     * removed a tick too early prints the wrong page. Same shape as the
     * chart's vitals print (js/screens/chart-vitals.js).
     */
    document.body.classList.add('cin--print-record');
    toast('Printing the check-in record.');
    window.print();
  });
  window.addEventListener('afterprint', () =>
    document.body.classList.remove('cin--print-record')
  );

  /* Download is Print with a filename on it. Both put the record sheet on the
     page the same way — the class below — and the only difference is that a
     download sets the document title, because that is what the browser's Save
     dialog offers as the name of the file. It used to write a .txt; see
     js/lib/print-document.js for why the file is a PDF now. */
  el('doneDownload').addEventListener('ui-click', () => {
    const patient = PATIENTS.get(appointment?.mrn);
    document.body.classList.add('cin--print-record');
    toast('Choose “Save as PDF” to download the check-in record.');
    downloadAsPdf({
      title: patient
        ? `Check-in record — ${patient.name} (MRN ${patient.mrn})`
        : 'Check-in record',
    });
  });

  el('doneOpen').addEventListener('ui-click', () => {
    if (appointment) {
      window.location.href = `encounter.html?appt=${encodeURIComponent(appointment.id)}`;
      return;
    }
    window.location.href = 'scheduler.html';
  });

  /* --- Commit --- */
  /*
   * Saving check-in starts the visit, and hands straight over to the note.
   *
   * The button says what it does — "Save and open note" — because that is the
   * whole of it: the paperwork is filed and the encounter opens. It used to
   * read "Confirm my initials (AM)", which named the desk's attestation and
   * left the part that actually happens next unsaid.
   *
   * The nurse's pre-procedure checklist still comes before anaesthesia — it is
   * step 1 of the encounter's Pre-anaesthesia stage, and the stage cannot be
   * closed until it is signed. What has gone is the separate screen it used to
   * live on: the sheet was identical either side of the hand-off, so checking a
   * patient in meant working it, filing it, and then arriving somewhere that
   * opened it again.
   */
  el('confirm').addEventListener('ui-click', (event) => {
    if (appointment) {
      updateAppointment(appointment.id, {
        status: 'Checked In',
        checkIn: {
          arrival: el('arrival').value,
          discharge: el('discharge').value,
          driverName: el('driverName').value.trim(),
          driverPhone: el('driverPhone').value.trim(),
          notes: el('notes').value.trim(),
          consents: CONSENT_DOCUMENTS.map((doc) => doc.id).filter((id) =>
            state.signatures.has(id)
          ),
          // Who signed each pane, how, and when. The mark itself goes with it —
          // a consent that cannot be shown later is not evidence of anything.
          signatures: Object.fromEntries(state.signatures),
          /* Yes, No, or null for a check-in saved before the question was
             reached. A boolean cannot carry that third state, and "was the
             notice acknowledged" has to be able to answer "nobody recorded
             it" — filing an unanswered question as `false` would put a
             refusal on the record that nobody made. See the note over the
             privacy document in data/checkin.js. */
          privacy: el('privacyAck')?.value || null,
          // Recorded, not just asked. These were collected and thrown away
          // before, which makes a compliance section theatre — the whole
          // point of asking is that somebody can show the answer later.
          // A question that was never put to the patient files as null rather
          // than as a "No" nobody said. The three below only get asked when
          // the answer above them makes them relevant.
          directives: {
            has: el('hasDirectives').value,
            onFile: el('directivesOnFile').value || null,
            offered: el('offeredDirectives').value || null,
            outcome: el('directiveOutcome').value || null,
          },
        },
      });
    }

    /*
     * The run ends on a dialog, and the encounter opens from it.
     *
     * This used to set window.location on the spot. The save is the only
     * moment in the whole flow where anything is confirmed to the desk, and
     * navigating away at that moment spent it on a page load: the patient is
     * still at the counter, and what they ask for next is a copy of what they
     * just signed. The dialog is where Print and Download for the whole
     * check-in live, so there is somewhere to ask.
     *
     * Nothing is lost by the wait. The record is filed above, before anything
     * is shown — closing the dialog with Escape does not undo a check-in — and
     * the encounter is one button away, which is what the button behind this
     * one promised.
     *
     * The encounter still opens straight onto the bay's pre-procedure sheet:
     * it is step 1 of Pre-anaesthesia rather than a screen of its own, so
     * checking a patient in no longer means filling that sheet, filing it, and
     * then arriving somewhere that shows it again.
     */
    openDone(event.target);
  });

  // The rail reads the arrival and directive controls, which only finished
  // being wired above, so it gets the last word on what is outstanding.
  paintRail();
})
  /*
   * A screen that cannot build itself has to say so.
   *
   * Everything above hangs off one promise, and for as long as that promise
   * neither resolves nor rejects this screen is a header over two empty boxes
   * — indistinguishable, to the person at the desk, from one that is merely
   * slow. Both ways out of that silence are covered here: a throw during the
   * wiring lands in the catch, and a <ui-select> that never registers at all
   * (a component module that failed to load, so whenDefined sits unsettled
   * for ever) trips the timeout instead.
   *
   * The message names paper on purpose. Check-in gates a procedure, and a
   * desk that cannot get consent signed needs to be told to fall back rather
   * than left waiting on a screen that is never going to arrive.
   */
  .catch((error) => {
    console.error('Check-in could not finish loading.', error);
    const notice = el('notice');
    if (!notice) return;
    notice.innerHTML = `<ui-alert severity="critical"
      heading="This screen did not load properly"
      data-testid="cin--load-failure">
      Reload the page. If it happens again, take this patient's consent on
      paper and tell IT — do not treat an empty form as a completed one.
    </ui-alert>`;
  });

/*
 * The watchdog for the case above: whenDefined never settling.
 *
 * Left alone it is a permanently blank screen with nothing in the console to
 * explain it. Five seconds is long past a local module load and far short of
 * anyone's patience with a patient waiting at the desk.
 */
setTimeout(() => {
  if (customElements.get('ui-select') || el('rail')?.innerHTML.trim()) return;
  console.error('Check-in: <ui-select> never registered — components did not load.');
  const notice = el('notice');
  if (!notice) return;
  notice.innerHTML = `<ui-alert severity="critical"
    heading="This screen did not load properly"
    data-testid="cin--load-failure">
    Reload the page. If it happens again, take this patient's consent on
    paper and tell IT — do not treat an empty form as a completed one.
  </ui-alert>`;
}, 5000);

