/**
 * THE PRINTED FORM — one completed version, on paper or as a PDF.
 *
 * Same bargain as lib/med-print.js: the browser's own print dialog offers
 * "Save as PDF" on every desktop platform and Share → Save on both mobile
 * ones, so a single window.print() covers paper and download with no backend
 * and no library. The control on a row is the download glyph and its tooltip
 * says "Print or download", because both are true — see glyphAction() in
 * js/screens/forms.js for why the row spells it out in a tooltip rather than
 * on the button.
 *
 * WHAT MAKES THIS DIFFERENT FROM PRINTING THE SCREEN
 *
 * A signed form leaving the portal is evidence. It has to carry, on its face,
 * the four things a reader needs in order to rely on it: which practice, which
 * patient, which version, and who signed it when. The screen shows three of
 * those in chrome — the header, the badge, the nav — and chrome does not
 * print. So the document is rebuilt rather than restyled.
 *
 * THE SIGNATURE IMAGE MUST SURVIVE THE TRIP. It is a data: URL in an <img>,
 * not a CSS background: browsers suppress background images when printing by
 * default and print <img> regardless. A signature that silently vanishes from
 * the printout is the single worst failure this file could have.
 */

import { esc } from './format.js';
import { generatedOn } from './dates.js';
import { signatureMethodLabel } from './signature-pad.js';
import { schemaFor } from '../../data/forms.js';
import { PATIENT } from '../../data/patient.js';

const CLINIC = 'MediNova Clinic';

/**
 * Build the document into `host` and open the print dialog.
 *
 * @param {HTMLElement} host   the #printDoc container in forms.html
 * @param {object}      form   the form row
 * @param {object}      entry  the version being printed
 */
export function printFormVersion(host, form, entry) {
  if (!host || !form || !entry) return;

  const schema = schemaFor(form) ?? [];

  host.innerHTML = `
    <header class="pp-print__head">
      <div class="pp-print__brand">
        <img class="pp-print__logo" src="assets/medinova-logo.svg" alt="" width="335" height="68" />
        <p class="pp-print__clinic">${esc(CLINIC)}</p>
      </div>

      <h1 class="pp-print__title">${esc(form.name)}</h1>

      <dl class="pp-print__facts">
        <div><dt>Patient</dt><dd>${esc(PATIENT.name)}</dd></div>
        <div><dt>Date of birth</dt><dd>${esc(PATIENT.dob)}</dd></div>
        ${PATIENT.mrn ? `<div><dt>MRN</dt><dd>${esc(PATIENT.mrn)}</dd></div>` : ''}
        <div>
          <dt>${form.kind === 'consent' ? 'Consent given' : 'Completed'}</dt>
          <dd>${esc(entry.completedOn)}</dd>
        </div>
        <div><dt>Version</dt><dd>${entry.version}${
          entry.superseded ? ' (superseded)' : ''
        }</dd></div>
      </dl>
    </header>

    ${
      /*
       * A superseded version says so at the top of the page, not the bottom.
       *
       * The whole hazard of keeping old versions is that one gets printed,
       * filed and acted on as though it were current. Whoever picks up this
       * sheet has to learn that before they read the answers, not after.
       */
      entry.superseded
        ? `<p class="pp-print__flag">
             This version was corrected on ${esc(entry.supersededOn)} and is no longer
             current. A later version of this form supersedes it.
           </p>`
        : ''
    }

    ${
      /*
       * A WITHDRAWN CONSENT SAYS SO ON ITS FACE, above the answers, for the
       * same reason a superseded version does: this sheet gets filed, and
       * whoever picks it up is deciding whether the practice may act on it.
       * A consent that has been taken back and does not say so is the one
       * document this file could produce that would actively mislead.
       */
      form.status === 'revoked' && !entry.superseded
        ? `<p class="pp-print__flag">
             This consent was withdrawn by the patient on ${esc(form.revokedOn ?? '')} and no
             longer applies. It was in force from ${esc(entry.completedOn)} until that date.
           </p>`
        : ''
    }

    ${
      entry.reason
        ? `<p class="pp-print__note"><strong>Reason for correction:</strong> ${esc(
            entry.reason
          )}</p>`
        : ''
    }

    ${schema.map((section) => sectionBlock(section, entry.answers)).join('')}

    ${signatureBlock(form, entry)}

    <footer class="pp-print__foot">
      <p>${signedLine(form, entry)}</p>
      <p>
        Generated from the ${esc(CLINIC)} patient portal on ${esc(generatedOn())}.
      </p>
    </footer>
  `;

  window.print();
}

/* ============================================================================
   THE PARTS
   ========================================================================= */

function sectionBlock(section, answers) {
  const asked = section.fields.filter((field) => field.type !== 'statement');
  const statements = section.fields.filter((field) => field.type === 'statement');

  // A section of pure prose still prints — on a consent, the prose IS the
  // thing consented to, and a printed consent that shows only the tick boxes
  // has dropped the part that gives them meaning.
  if (!asked.length && !statements.length) return '';

  return `
    <section class="pp-print__section">
      <h2 class="pp-print__heading">${esc(section.title)}</h2>
      ${statements
        .map((field) => `<p class="pp-print__prose">${esc(field.label)}</p>`)
        .join('')}
      ${
        asked.length
          ? `<dl class="pp-print__answers">
               ${asked
                 .map(
                   (field) => `
                 <div>
                   <dt>${esc(field.label)}</dt>
                   <dd>${esc(answerText(field, answers?.[field.key]))}</dd>
                 </div>`
                 )
                 .join('')}
             </dl>`
          : ''
      }
    </section>`;
}

function answerText(field, value) {
  if (field.type === 'checkboxGroup') {
    return Array.isArray(value) && value.length ? value.join(', ') : '—';
  }
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  return value ? String(value) : '—';
}

function signatureBlock(form, entry) {
  if (!form.signatureRequired) return '';

  const sig = entry.signature;
  if (!sig) {
    return `
      <section class="pp-print__section">
        <h2 class="pp-print__heading">Signature</h2>
        <p class="pp-print__prose">No signature was recorded against this version.</p>
      </section>`;
  }

  return `
    <section class="pp-print__section pp-print__signature">
      <h2 class="pp-print__heading">Signature</h2>
      ${
        sig.dataUrl
          ? `<img class="pp-print__sig-image" src="${esc(sig.dataUrl)}"
               alt="Signature of ${esc(sig.name)}" />`
          : `<p class="pp-print__sig-name">${esc(sig.name)}</p>`
      }
      <p class="pp-print__sig-rule"></p>
      <p class="pp-print__sig-meta">
        ${esc(sig.name)} — ${signatureMethodLabel(sig).toLowerCase()}
      </p>
    </section>`;
}

/** The footer line the requirement names, worded for whoever reads the sheet. */
function signedLine(form, entry) {
  if (!form.signatureRequired) {
    return `Completed on ${esc(entry.completedOn)} by ${esc(PATIENT.name)}.`;
  }

  const sig = entry.signature;
  const on = esc(sig?.signedOn ?? entry.completedOn);
  const by = esc(sig?.name ?? PATIENT.name);
  return `Signed electronically on ${on} by ${by}, through the ${esc(CLINIC)} patient portal.`;
}
