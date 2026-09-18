/**
 * LEAD → PATIENT, on the existing onboarding form.
 *
 * This is deliberately a SEPARATE module bolted onto patient-add.html rather
 * than changes threaded through patient-add.js. The brief was explicit that
 * the onboarding workflow is not to be redesigned, and the surest way to keep
 * that promise is for the conversion to be additive: without ?lead= in the URL
 * this file does nothing at all, and the form behaves exactly as it did.
 *
 * What it adds, in order:
 *
 *   1. a banner saying this is a conversion, and of which enquiry
 *   2. the five submitted fields, pre-filled and still editable
 *   3. a duplicate check before the patient is created
 *   4. on create: MRN, link back to the lead, lead marked Converted
 *
 * Nothing is created when Convert to Patient is pressed on the Leads screen.
 * The patient is created here, by a person, at the end.
 */
import { DIRECTORY } from '../../data/directory.js';
import {
  leadById,
  convertLead,
  logAudit,
  findDuplicates,
  shortDob,
} from '../../data/leads.js';

const params = new URLSearchParams(window.location.search);
const leadId = params.get('lead');

/* Without a lead in the URL this is an ordinary new patient. Do nothing. */
if (leadId) {
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const byTest = (id) => document.querySelector(`[data-testid="${id}"]`);

  /**
   * Write both the attribute and the live control — ui-* mirror on blur — and
   * then say so. A value typed by hand emits ui-input and ui-change, and the
   * form listens for those: the date of birth alone decides the patient's age
   * and whether a guarantor is asked for at all. Filling the box silently
   * would put a lead for a twelve-year-old on screen with no guarantor
   * section and nothing to explain why.
   */
  function setField(node, value) {
    if (!node) return;
    node.setAttribute('value', value ?? '');
    const control = node.querySelector('input, select, textarea');
    if (control) control.value = value ?? '';

    for (const type of ['ui-input', 'ui-change']) {
      node.dispatchEvent(
        new CustomEvent(type, { detail: { value: value ?? '' }, bubbles: true })
      );
    }
  }

  customElements.whenDefined('ui-input').then(() => {
    const lead = leadById(leadId);
    if (!lead) return;

    if (lead.status === 'converted') {
      // Someone converted it between the click and this page loading.
      alreadyConverted(lead);
      return;
    }

    paintBanner(lead);
    prefill(lead);
    interceptCreate(lead);
  });

  /* ===================== 1 · The conversion chip ===================== */

  /**
   * This was a banner: a green card across the top of the form, three facts
   * wide, above the first question. Where the record came from is context, not
   * the first thing to read — and pushing the form itself below the fold to say
   * it made every conversion start with a scroll. It is a chip in the first
   * card's heading now: same three facts, one line, out of the way of the work.
   */
  function paintBanner(lead) {
    const host = document.getElementById('leadSlot');
    if (!host) return;

    const chip = document.createElement('span');
    chip.className = 'lead-convert';
    chip.dataset.testid = 'add--lead-banner';
    chip.title =
      'This patient information was submitted through the website. Review and complete it before creating the patient.';
    chip.innerHTML = `
      <svg class="ui-icon" aria-hidden="true"><use href="#i-user-plus"></use></svg>
      <span class="lead-convert__title">Converting lead</span>
      <code class="lead-convert__id">${esc(lead.id)}</code>
      <span class="lead-convert__meta">Website Lead · ${esc(
        shortDob(String(lead.submittedAt).split('T')[0])
      )}</span>`;

    host.appendChild(chip);
  }

  /* ===================== 2 · Pre-population ===================== */

  /**
   * The five website fields, and only those five.
   *
   * Everything stays editable: the website form was filled in by the patient,
   * not by the clinic, and the desk has to be able to correct a typo before it
   * becomes a permanent record.
   */
  function prefill(lead) {
    const map = [
      ['add--first-name', lead.firstName],
      ['add--last-name', lead.lastName],
      ['add--dob', lead.dob],
      ['add--mobile', lead.phone],
      ['add--email', lead.email],
    ];

    let filled = 0;
    map.forEach(([testid, value]) => {
      if (!value) return;
      const node = byTest(testid);
      if (!node) return;
      setField(node, value);
      node.classList.add('is-prefilled');
      filled += 1;
    });

    logAudit(lead.id, 'Lead Viewed', `Onboarding opened · ${filled} fields pre-filled`);
  }

  /* ===================== 3 · Duplicate check ===================== */

  /**
   * Runs BEFORE the patient is created, not after.
   *
   * A duplicate found afterwards is a merge — two charts, two claim histories,
   * and a clinician who has read the wrong one. Found beforehand it is just a
   * question, and the answer might well be "yes, create it anyway": people do
   * share names and birthdays. So it offers both, and decides nothing.
   */
  function duplicatesFor(lead) {
    const live = {
      ...lead,
      firstName: byTest('add--first-name')?.value || lead.firstName,
      lastName: byTest('add--last-name')?.value || lead.lastName,
      dob: byTest('add--dob')?.value || lead.dob,
      phone: byTest('add--mobile')?.value || lead.phone,
      email: byTest('add--email')?.value || lead.email,
    };
    return { live, matches: findDuplicates(live, DIRECTORY) };
  }

  function showDuplicateDialog(lead, live, matches, proceed) {
    const modal = document.createElement('ui-modal');
    modal.id = 'leadDupeModal';
    modal.setAttribute('heading', 'Possible Existing Patient');
    modal.setAttribute('size', 'md');
    modal.dataset.testid = 'add--dupe';

    modal.innerHTML = `
      <div class="lead-dupe">
        <p class="lead-dupe__lead">
          We found ${matches.length === 1 ? 'a patient' : `${matches.length} patients`}
          with similar information to
          <strong>${esc(live.firstName)} ${esc(live.lastName)}</strong>.
        </p>
        ${matches
          .slice(0, 3)
          .map(
            (m) => `<div class="lead-dupe__match" data-testid="add--dupe-match">
              <dl>
                <div><dt>Patient</dt><dd>${esc(m.patient.name)}</dd></div>
                <div><dt>DOB</dt><dd>${esc(m.patient.dob)}</dd></div>
                <div><dt>MRN</dt><dd><code>${esc(m.patient.mrn)}</code></dd></div>
                <div><dt>Phone</dt><dd>${esc(m.patient.phone ?? '—')}</dd></div>
              </dl>
              <ui-button variant="outline" size="sm" data-view-mrn="${esc(m.patient.mrn)}"
                data-testid="add--dupe-view">View Patient</ui-button>
            </div>`
          )
          .join('')}
      </div>

      <div class="ui-modal__actions">
        <ui-button variant="tertiary" data-dupe-cancel data-testid="add--dupe-cancel">
          Cancel</ui-button>
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" data-dupe-continue data-testid="add--dupe-continue">
          Continue Anyway</ui-button>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-view-mrn]').forEach((b) =>
      b.addEventListener('ui-click', () => {
        window.location.href = `patient-chart.html?mrn=${encodeURIComponent(b.dataset.viewMrn)}`;
      })
    );
    modal.querySelector('[data-dupe-cancel]').addEventListener('ui-click', () => modal.close());
    modal.querySelector('[data-dupe-continue]').addEventListener('ui-click', () => {
      logAudit(lead.id, 'Lead Status Changed', 'Duplicate warning overridden');
      modal.close();
      proceed();
    });

    modal.open();
  }

  /* ===================== 4 · Create the patient ===================== */

  /**
   * MRN generation.
   *
   * The directory's numbers run in a block, so the next one is the highest
   * plus one. A real system would take this from the master patient index;
   * what matters here is that the number is issued at creation and is the
   * thing the lead is linked to afterwards.
   */
  function nextMrn() {
    const highest = DIRECTORY.reduce(
      (max, p) => Math.max(max, Number(p.mrn) || 0),
      326000
    );
    return String(highest + 1);
  }

  function interceptCreate(lead) {
    const save = byTest('add--save');
    if (!save) return;

    // Relabel the inner control, never the host — <ui-button> renders its own
    // <button> into itself and textContent on the host would delete it.
    const control = save.querySelector('button');
    if (control) control.textContent = 'Create Patient';

    // Capture phase, so the duplicate check runs BEFORE the form's own save.
    save.addEventListener(
      'ui-click',
      (event) => {
        const { live, matches } = duplicatesFor(lead);

        const create = () => createPatient(lead, live);

        if (matches.length) {
          event.stopImmediatePropagation();
          event.preventDefault();
          showDuplicateDialog(lead, live, matches, create);
          return;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        create();
      },
      true
    );
  }

  function createPatient(lead, live) {
    const mrn = nextMrn();
    const patientName = `${live.firstName} ${live.lastName}`.trim();

    // The link is written here and only here: the lead becomes Converted at
    // the moment the patient exists, not when the button that opens this form
    // was pressed.
    convertLead(lead.id, { mrn, patientName });

    showCreated(lead, patientName, mrn);
  }

  /* ===================== Success, and the already-converted case ========== */

  function showCreated(lead, patientName, mrn) {
    const modal = document.createElement('ui-modal');
    modal.setAttribute('heading', 'Patient Created Successfully');
    modal.setAttribute('size', 'sm');
    modal.dataset.testid = 'add--created';

    modal.innerHTML = `
      <div class="lead-done">
        <svg class="ui-icon lead-done__icon" aria-hidden="true"><use href="#i-check"></use></svg>
        <p><strong>${esc(patientName)}</strong> has been added to the patient system.</p>
        <span class="lead-done__mrn" data-testid="add--created-mrn">MRN: ${esc(mrn)}</span>
      </div>

      <div class="ui-modal__actions">
        <ui-button variant="tertiary" data-back-to-leads data-testid="add--created-leads">
          Back to Leads</ui-button>
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" data-view-chart data-testid="add--created-chart">
          View Patient Chart</ui-button>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelector('[data-back-to-leads]').addEventListener('ui-click', () => {
      window.location.href = `leads.html?converted=${encodeURIComponent(lead.id)}`;
    });
    modal.querySelector('[data-view-chart]').addEventListener('ui-click', () => {
      window.location.href = `patient-chart.html?mrn=${encodeURIComponent(mrn)}`;
    });

    modal.open();
  }

  function alreadyConverted(lead) {
    const modal = document.createElement('ui-modal');
    modal.setAttribute('heading', 'Lead Already Converted');
    modal.setAttribute('size', 'sm');
    modal.dataset.testid = 'add--already';

    modal.innerHTML = `
      <p>This Lead has already been converted into a patient
        (${esc(lead.conversion?.patientName ?? '')},
        MRN ${esc(lead.conversion?.mrn ?? '')}).</p>

      <div class="ui-modal__actions">
        <ui-button variant="tertiary" data-back data-testid="add--already-leads">
          Back to Leads</ui-button>
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" data-chart data-testid="add--already-chart">
          View Patient Chart</ui-button>
      </div>`;

    document.body.appendChild(modal);
    modal.querySelector('[data-back]').addEventListener('ui-click', () => {
      window.location.href = 'leads.html';
    });
    modal.querySelector('[data-chart]').addEventListener('ui-click', () => {
      window.location.href = `patient-chart.html?mrn=${encodeURIComponent(lead.conversion.mrn)}`;
    });
    modal.open();
  }
}
