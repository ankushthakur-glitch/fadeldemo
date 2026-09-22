/**
 * ENCOUNTER SUMMARY — the note, read rather than written, with its signatures.
 *
 * Opened from Scheduler → Encounters with ?appt=<id>. It is one screen in two
 * states, not two screens:
 *
 *   unsigned  the last look before committing — Cancel, Sign & Lock
 *   signed    the filed record — Cancel, Save, and the signature beside it
 *
 * Signing goes through a dialog rather than straight off the button. A name
 * stamped on a legal document by a single click is a click nobody meant to
 * make; typing the name and seeing it rendered as the signature that will go
 * on the note makes the commit deliberate, and gives the note a real signature
 * to carry rather than a boolean.
 */
import { findAppointment, updateAppointment } from '../../data/appointment-store.js';
import { DIRECTORY } from '../../data/directory.js';
/* The patient card, drawn by the component the three note screens draw. This
   screen's own version was the one that already linked the name to the chart
   and already read the plan from the coverage record — both of those went into
   the component and out to the other three. */
import { paintPatientCard } from '../lib/patient-card.js';
import { providerById, typeById, procedureById } from '../../data/schedule.js';
import { CLINICAL_SECTIONS } from '../../data/encounter.js';
import { NOTE_STATES, noteTypeFor, noteFor } from '../../data/visit-notes.js';
import { notify as toast } from '../lib/toast.js';
import {
  summarySections,
  signatureFor,
  signEncounter,
  DEFAULT_REASON,
} from '../../data/encounter-summary.js';

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const params = new URLSearchParams(window.location.search);
const appointment = findAppointment(params.get('appt'));

const patient =
  DIRECTORY.find((p) => p.mrn === appointment?.mrn) ?? DIRECTORY.find((p) => p.active);

/** The activity that means an infusion — same id the scheduler keys off. */
const INFUSION_TYPE = 'at12';

/** Same rule the scheduler uses, so a visit is the same kind on both screens. */
function kindOf(appt) {
  if (!appt) return 'clinical';
  if (appt.kind) return appt.kind;
  if (appt.procedureId) return 'procedure';
  if (appt.typeId === INFUSION_TYPE) return 'infusion';
  return 'clinical';
}

const kind = kindOf(appointment);

const apptTypeLabel = appointment?.procedureId
  ? procedureById(appointment.procedureId)?.title ?? 'Procedure'
  : typeById(appointment?.typeId)?.title ?? 'Visit';

const providerName = providerById(appointment?.providerId)?.name
  ? `${providerById(appointment.providerId).name}, MD`
  : 'MediNova Gastroenterology';

const reason = appointment?.reason?.trim() || DEFAULT_REASON;

/* ===================== State ===================== */

/**
 * Signed-ness has three sources and they have to agree.
 *
 * The register holds signatures made on this screen, in this page load. The
 * booking holds one made on the visit screen, where a clinic note is signed
 * in its Sign and Lock dialog before it is sent here to be read — that name
 * arrives across a navigation, which the register cannot survive. The seeded
 * note state is the last resort, for the fixtures that are filed but were
 * never signed by anybody in this session.
 *
 * Read in that order: most specific first, so a note signed a moment ago
 * shows the name that was actually typed rather than the provider the booking
 * happens to name.
 */
function currentSignature() {
  const recorded = signatureFor(appointment?.id);
  if (recorded) return recorded;
  if (!appointment) return null;
  if (appointment.noteSignedBy) {
    return {
      by: appointment.noteSignedBy,
      on: appointment.noteSignedOn ?? longDate(appointment.date),
      at: appointment.noteSignedAt ?? '—',
    };
  }
  const note = noteFor(appointment);
  if (!NOTE_STATES[note.state]?.signed) return null;
  return { by: providerName, on: longDate(note.updatedOn), at: '—' };
}

const isSigned = () => Boolean(currentSignature());

/* ===================== Formatting ===================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-08-03' → '3 Aug 2026'. Parsed by hand: `new Date('2026-08-03')` is
 *  UTC midnight, which is the previous day in any western timezone. */
function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function displayTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function nowParts() {
  const now = new Date();
  return {
    on: `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    at: displayTime(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`),
  };
}

/*
 * Reports float; conditions stay put.
 *
 * This used to write a <ui-alert> into a strip at the top of the screen —
 * a banner that pushed the work down the page to say something that had
 * already finished, and then sat there until the next one replaced it.
 * <ui-toast> in the shared top-right region is the component for that
 * (js/lib/toast.js): it reports, it stacks, and it goes.
 */
function notify(message, severity = 'success') {
  toast(message, severity);
}

/* ===================== The patient card ===================== */


/*
 * The same card the encounter rail carries.
 *
 * It used to be its own thing: a tinted payer/provider block that folded away
 * behind a caret straddling the card's bottom edge. Two screens showing the
 * same patient in two different shapes is a cost paid by whoever reads both —
 * the eye has to relearn where the MRN sits every time it crosses from the
 * encounter to the note it produced — and the folding saved height the rail
 * had to spare anyway.
 *
 * So this is the encounter's card, fact for fact: identity across the top with
 * the allergy count where an alert belongs, then the three looked-up facts
 * under a rule. Mobile, cover and the owning provider are not clinical detail;
 * they are what somebody leaves the note to go and find — ring the escort,
 * check the plan before a corrected claim, name the provider on a call.
 */
function paintPatient() {
  paintPatientCard({
    host: el('patientCard'),
    patient,
    provider: providerName,
    testid: 'es--patient',
  });
}

/* ===================== The note ===================== */

/*
 * Every labelled fact is a cell in one band of columns. What the section
 * decides is how wide those columns are, not whether it is a band at all.
 *
 * A vital sign or a therapy name is a few characters and reads best packed
 * several across, the way a flowsheet does — four or five on one line with a
 * rule between. A history or an examination finding is a sentence: squeezed
 * into a quarter of the width it wraps to four lines and stops being scannable,
 * so it gets a wider column. It does not get the WHOLE width, which is what it
 * used to get — six one-line histories then cost six rows of a column fifteen
 * hundred pixels across, and the Plan sat two screens below the Subjective for
 * no reason but the layout.
 *
 * The width is chosen for the whole section rather than row by row, because a
 * narrow band between two wide ones leaves the values stepping in and out down
 * the page and the eye spends its time on the layout rather than the note. So
 * a section is a flowsheet only when every fact in it is short enough to be
 * one; the moment one of them is a sentence, they all take the wide column.
 */
const SHORT_VALUE = 32;

const isShort = (row) => !row.text && String(row.value ?? '').length <= SHORT_VALUE;

function cellHtml(row, modifier = '') {
  return `<div class="es__cell${modifier}">
    <dt>${esc(row.label)}</dt>
    <dd>${esc(row.value)}</dd>
  </div>`;
}

/**
 * One band of facts, from the cells' own markup.
 *
 * The rules between columns are the cells' own left borders; the wrapper clips
 * the leftmost one so a rule never appears against the card edge.
 */
function bandHtml(cells, wide) {
  return `<div class="es__grid-wrap">
    <dl class="es__grid${wide ? ' es__grid--wide' : ''}">${cells}</dl>
  </div>`;
}

function rowsHtml(section) {
  const labelled = section.rows.filter((row) => !row.text);
  const paras = section.rows.filter((row) => row.text);

  const facts = labelled.length
    ? bandHtml(labelled.map((row) => cellHtml(row)).join(''), !labelled.every(isShort))
    : '';

  return facts + paras.map((row) => `<p class="es__para">${esc(row.text)}</p>`).join('');
}

function sectionHtml(section) {
  return `<section class="es__section">
    <h3 class="es__section-title">${esc(section.heading)}</h3>
    <div class="es__section-body">
      ${section.subheading ? `<h4 class="es__section-sub">${esc(section.subheading)}</h4>` : ''}
      ${rowsHtml(section)}
    </div>
  </section>`;
}

function paintBody() {
  const noteType = noteTypeFor(kind, apptTypeLabel);
  const sections = summarySections(kind, {
    reason,
    provider: providerName,
    apptType: apptTypeLabel,
    /* The patient, so the histories, problem list, vitals and open orders come
       off this chart rather than out of a fixture. */
    mrn: String(appointment?.mrn ?? ''),
  });

  el('docTitle').textContent = /note$/i.test(noteType) ? noteType : `${noteType} Note`;

  /* The reason for the visit is the last fact of the booking, not a section of
     its own. A card, a heading and a border round one line of prose cost more
     height than the line did — and the reason belongs beside the date and the
     provider anyway, since all six come off the same appointment. It keeps the
     whole width of the band; the five short facts share the row above it. */
  const apptFacts = [
    { label: 'Service Type', value: apptTypeLabel },
    { label: 'Location', value: appointment?.location ?? '—' },
    { label: 'Note Type', value: noteType },
    {
      label: 'Service Date & Time',
      value: `${longDate(appointment?.date)} · ${displayTime(appointment?.start)}`,
    },
    { label: 'Provider', value: providerName },
  ];

  el('summaryBody').innerHTML = `
    <section class="es__section">
      <h3 class="es__section-title">Appointment Details</h3>
      <div class="es__section-body">
        ${bandHtml(
          apptFacts.map((row) => cellHtml(row)).join('') +
            cellHtml({ label: 'Reason For Visit', value: reason }, ' es__cell--full'),
          false
        )}
      </div>
    </section>

    ${sections.map(sectionHtml).join('')}`;
}

/* ===================== Signatures ===================== */

function paintSignatures() {
  const signature = currentSignature();

  el('stateBadge').innerHTML = signature
    ? `<ui-badge status="success" data-testid="es--state-badge">Signed</ui-badge>`
    : `<ui-badge status="neutral" data-testid="es--state-badge">Unsigned</ui-badge>`;

  el('signatures').innerHTML = signature
    ? `<div class="es__signature" data-testid="es--signature">
         <span class="es__signature-ink">${esc(signature.by.replace(/,.*$/, ''))}</span>
         <p class="es__signature-by">Signed by ${esc(signature.by)}</p>
         <p class="es__signature-when">${esc(signature.on)} · ${esc(signature.at)}</p>
       </div>`
    : `<p class="es__signature-none" data-testid="es--signature-none">
         Not signed yet. Signing locks the note and records who signed it and when.
       </p>`;
}

/* ===================== The footer ===================== */

function paintFoot() {
  const signed = isSigned();

  el('footHint').textContent = signed
    ? 'This note is filed and locked.'
    : 'Review the note, then sign to file it to the chart.';

  /*
   * Both states end in the same pair of slots — a way out on the left, the
   * commit on the right — so the button under the cursor never moves when the
   * note is signed. Only the commit changes what it means: Sign & Lock while
   * the note is open, Save once it is filed and there is nothing left to do to
   * it but close it down.
   */
  el('footActions').innerHTML = signed
    ? `<ui-button variant="tertiary" id="cancel" data-testid="es--cancel">Cancel</ui-button>
       <ui-button variant="primary" id="save" data-testid="es--save">Save</ui-button>`
    : `<ui-button variant="tertiary" id="cancel" data-testid="es--cancel">Cancel</ui-button>
       <ui-button variant="primary" id="signLock" data-testid="es--sign-lock">
         Sign &amp; Lock
       </ui-button>`;

  wireFoot();
}

function wireFoot() {
  el('cancel')?.addEventListener('ui-click', () => {
    window.location.href = 'scheduler.html?tab=visit-notes';
  });

  el('signLock')?.addEventListener('ui-click', openSignDialog);

  /* The note is already filed by the time Save is on screen — signing wrote it
     through to the appointment store. Save is therefore the way out that says
     so, rather than a second write: it confirms and returns to the worklist. */
  el('save')?.addEventListener('ui-click', () => {
    notify('Note saved to the chart.');
    window.location.href = 'scheduler.html?tab=visit-notes';
  });
}

/* ===================== Sign & Lock ===================== */

function openSignDialog() {
  const modal = el('signModal');
  el('signLead').textContent =
    `You are signing the ${noteTypeFor(kind, apptTypeLabel)} for ${patient?.name ?? 'this patient'}, ` +
    `${longDate(appointment?.date)}.`;

  const nameField = el('signName');
  nameField.removeAttribute('error');
  setValue(nameField, providerName);
  el('signAttest').checked = false;
  paintInk(providerName);

  modal.open(el('signLock'));
}

/** Write both the attribute and the live control — same reason as elsewhere. */
function setValue(node, value) {
  if (!node) return;
  node.setAttribute('value', value ?? '');
  const control = node.querySelector('input, textarea');
  if (control) control.value = value ?? '';
}

/** The signature as it will appear on the note, updated as the name is typed. */
function paintInk(name) {
  const ink = el('signInk');
  const trimmed = (name ?? '').trim();
  ink.textContent = trimmed.replace(/,.*$/, '') || '—';
  ink.classList.toggle('es__sign-ink--empty', !trimmed);
}

function wireSignDialog() {
  const modal = el('signModal');

  el('signName')
    .querySelector('input')
    ?.addEventListener('input', (event) => paintInk(event.target.value));

  el('signCancel').addEventListener('ui-click', () => modal.close());

  el('signConfirm').addEventListener('ui-click', () => {
    const name = el('signName').value.trim();
    if (!name) {
      el('signName').setAttribute('error', 'Type the name you are signing under');
      return;
    }
    if (!el('signAttest').checked) {
      notify('Tick the confirmation before signing.', 'warning');
      return;
    }

    const { on, at } = nowParts();
    signEncounter(appointment.id, name, on, at);
    // The worklist reads signed-ness off the booking, so the note only moves
    // from Unsigned to Signed there if this is written back to it.
    if (appointment) {
      /* The name goes on the booking as well as into the register: the
         register is rebuilt from its seeds on the next page load, and a
         signature that vanishes on reload is worse than one that was never
         shown. Same three fields the visit screen writes. */
      updateAppointment(appointment.id, {
        noteSigned: true,
        encounterLocked: true,
        noteSignedBy: name,
        noteSignedOn: on,
        noteSignedAt: at,
      });
    }

    modal.close();
    paintSignatures();
    paintFoot();
    notify(`Encounter signed by ${name} and locked.`);
  });
}

/* ===================== Boot ===================== */

customElements.whenDefined('ui-modal').then(() => {
  if (!appointment) {
    el('summaryBody').innerHTML = `<p class="es__para">
      This encounter could not be found. Open one from the Encounters list.
    </p>`;
    el('footActions').innerHTML = '';
    el('footHint').textContent = '';
    return;
  }

  paintPatient();
  paintBody();
  paintSignatures();
  paintFoot();
  wireSignDialog();
});
