/**
 * PRESCRIPTIONS — the ScriptSure window, framed but not loaded.
 *
 * WHAT THIS SECTION IS. Prescribing is not this product's job. Writing a
 * script means a drug database, interaction checking, EPCS identity proofing
 * and a live connection to Surescripts — four things a practice buys rather
 * than builds, and four things this EHR is not going to reimplement. So the
 * section that used to be our own Active / Past worklist with an Add
 * Medication form is now the frame ScriptSure's e-prescribing UI loads into.
 *
 * THE CHROME IS OURS; THE INTERIOR IS NOT. What this file draws is the window
 * around the vendor, and only that: which patient the session is scoped to.
 * That belongs to the host application precisely because it is what nobody can
 * check from inside somebody else's document — an e-prescribing window with
 * the wrong chart open is the failure the patient strip exists to make
 * visible. The window used to carry a title bar above it as well, naming the
 * tenant, the site and the connection state; it was removed because it was our
 * own heading restating a section the module title already names, stacked on
 * top of a frame that has nothing in it to be titled.
 *
 * WHAT IS DELIBERATELY NOT DRAWN is the vendor's own UI. It carried a dummy
 * Current / History / Pending window for a while — demo rows laid out the way
 * the integration was expected to return them. That was a guess about somebody
 * else's screen, and a guess drawn convincingly enough to review is a guess
 * people start treating as a specification: it invites feedback on columns
 * this product will never own, and it reads as progress on a connection that
 * does not exist. Inside the frame the window says the one true thing instead
 * — this is where ScriptSure renders — and says it again in the Add
 * Prescription dialog, which is the other place a reader arrives at it.
 *
 * WHERE THE OLD CONTENT WENT. The Active and Past tables moved to the
 * Medication module, which already carried the reconciled list and the
 * sedation record. That is the right home for them: the chart's reading of a
 * patient's drugs has to include the ones another practice started and the
 * ones pushed under sedation, neither of which ScriptSure has ever heard of,
 * and it cannot live inside somebody else's iframe. The demo record in
 * data/chart-prescriptions.js therefore stays exactly where it is — nothing on
 * this screen reads it any more, but Medication composes its Active and Past
 * tabs from it. See chart-medications.js.
 *
 * ctx provides { patient, age, go, flash }; the patient strip inside the frame
 * is the only thing on the screen that is specific to one chart.
 */
import { registerModule } from './chart-workspace.js';
import { SCRIPTSURE_SESSION } from '../../data/chart-prescriptions.js';

/* ============================================================================
   THE ONE SENTENCE

   Written once and shown in both places, because the section body and the Add
   Prescription dialog are answering the same question — "why is there nothing
   here" — and two wordings of one answer is how a reader ends up wondering
   whether they are two different situations.
   ========================================================================= */

const INTEGRATION_LINE = `The ${SCRIPTSURE_SESSION.vendor} window renders here.`;

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name) {
  return `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20-02-1961" → "20 Feb 1961". Numeric dates get read the wrong way round. */
function formatDate(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  if (!d || !m || !y) return '—';
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The reserved space, drawn the same way in the section and in the dialog.
 *
 * `note` is the sentence under the line, and it differs between the two: the
 * section can afford to say where the medication list actually lives, and the
 * dialog — opened by somebody who has just tried to write a script — needs to
 * say what happens to the thing they were about to do.
 */
function stub(note, { modal = false } = {}) {
  return `<div class="rx__stub${modal ? ' rx__stub--modal' : ''}">
    <span class="rx__stub-mark">${icon('pill')}</span>
    <p class="rx__stub-line">${INTEGRATION_LINE}</p>
    <p class="rx__stub-note">${note}</p>
  </div>`;
}

const SECTION_NOTE =
  `The integration is not wired up in this prototype, so nothing loads into the ` +
  `frame. The patient's medication list — including drugs started elsewhere and ` +
  `drugs given under sedation — is read under <strong>Medication</strong>.`;

const DIALOG_NOTE =
  `A script is composed, signed and transmitted inside ${SCRIPTSURE_SESSION.vendor}. ` +
  `Nothing typed here would reach a pharmacy, so there is no form to type into.`;

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('prescriptions', {
  /* The heading stays. It used to be hidden because the Active / Past strip
     beside it already said "medication" twice over; there is no strip any
     more, and a section holding a single sentence is exactly the place a
     reader needs to be told which part of the chart they are standing in.

     One action, and it is deliberately the one the section is named for.
     Add Prescription is what somebody comes to this screen to do, and a
     button that is missing reads as a screen that is broken — where a button
     that opens and explains reads as a screen that is waiting. */
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--rx-add"
      >Add Prescription</ui-button
    >`,

  render(host, ctx) {
    /* The button is the shell's markup, rendered into the head — a sibling of
       this host, not a descendant — so its event is listened for up there. */
    const head = host.parentElement;

    host.innerHTML = `<section class="rx__ss" data-testid="chart--rx-scriptsure"
        aria-label="${esc(SCRIPTSURE_SESSION.product)}">

        <div class="rx__ss-frame" data-testid="chart--rx-empty">
          <!-- The patient the vendor session is scoped to. Inside the frame,
               not above it: a copy of our own header outside it would prove
               nothing about what the vendor thinks it is looking at. -->
          <div class="rx__ss-patient">
            <strong>${esc(ctx.patient.name)}</strong>
            <span>MRN ${esc(ctx.patient.mrn)}</span>
            <span>${formatDate(ctx.patient.dob)}${
              ctx.age == null ? '' : ` · ${esc(ctx.age)} yrs`
            }</span>
            <span>${esc(ctx.patient.gender || '—')}</span>
          </div>

          ${stub(SECTION_NOTE)}
        </div>
      </section>

      <ui-modal id="rxAddModal" heading="Add Prescription" size="md"
        data-testid="chart--rx-add-modal">
        ${stub(DIALOG_NOTE, { modal: true })}
        <div class="ui-modal__actions">
          <span class="ui-modal__actions-spacer"></span>
          <ui-button variant="primary" data-rx-dismiss data-testid="chart--rx-add-close"
            >Close</ui-button
          >
        </div>
      </ui-modal>`;

    const modal = host.querySelector('#rxAddModal');

    function onHostUiClick(event) {
      if (event.target.closest('[data-rx-dismiss]')) modal.close();
    }

    function onHeadUiClick(event) {
      const trigger = event.target.closest('[data-testid="chart--rx-add"]');
      if (trigger) modal.open(trigger);
    }

    host.addEventListener('ui-click', onHostUiClick);
    head?.addEventListener('ui-click', onHeadUiClick);

    return () => {
      host.removeEventListener('ui-click', onHostUiClick);
      head?.removeEventListener('ui-click', onHeadUiClick);
    };
  },
});
