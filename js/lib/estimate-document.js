/**
 * A SAVED gESTIMATOR ESTIMATE, RENDERED AS A DOCUMENT.
 *
 * Step 2 of gEstimator (Profile ▸ Insurance) is a working screen: it has
 * dropdowns for the place-of-service basis, the per-line percentage and which
 * coverage options to apply. Once the estimate is downloaded or saved, that
 * same content becomes a RECORD — what was quoted, on what basis, to whom, on
 * what day — and a record has no controls on it.
 *
 * So this module renders the document half, and it renders it from the values
 * FROZEN INTO THE DOCUMENT rather than recomputing from today's fee schedule.
 * An estimate handed to a patient in August must still read the same in
 * November after the rates change; a document that quietly recalculates is not
 * a copy of what anybody was told.
 *
 * Used by the gEstimator tab in Billing (the list and the view), and by the
 * download in both places — one definition, so the file on somebody's desktop
 * and the screen it came from cannot disagree.
 */
import { money } from '../../data/gestimator.js';
import { downloadAsPdf } from './print-document.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* --- Markup ------------------------------------------------------------------- */

function partyBlock(title, pairs) {
  return `<section class="est__party">
    <h4 class="est__party-title">${esc(title)}</h4>
    <dl>
      ${pairs
        .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '—')}</dd></div>`)
        .join('')}
    </dl>
  </section>`;
}

function ratesTable(doc) {
  return `<div class="est__table-wrap" tabindex="0">
    <table class="est__table" data-testid="est--rates">
      <thead><tr>
        <th>Units</th><th>Code</th><th>Modifier</th>
        <th class="est__num">Billed / unit</th><th class="est__num">Allowed / unit</th>
        <th>Ins type</th><th>Place of service</th><th>Match type</th>
        <th class="est__num">% of allowed</th><th class="est__num">Line allowed</th>
      </tr></thead>
      <tbody>
        ${doc.lines
          .map(
            (line) => `<tr data-testid="est--rate-row">
              <td>${esc(line.units)}</td>
              <td>${esc(line.code)}</td>
              <td>${esc(line.modifier)}</td>
              <td class="est__num">${money(line.billedPerUnit)}</td>
              <td class="est__num">${money(line.allowedPerUnit)}</td>
              <td>${esc(line.insType)}</td>
              <td>${esc(line.posLabel)}</td>
              <td>${esc(line.matchType)}</td>
              <td class="est__num">${esc(line.percentOfAllowed)}</td>
              <td class="est__num">${money(line.lineAllowed)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
      <tfoot><tr>
        <th colspan="9">Total expected allowed</th>
        <td class="est__num" data-testid="est--total-allowed">${money(doc.totalAllowed)}</td>
      </tr></tfoot>
    </table>
  </div>`;
}

/**
 * A benefit table, with the decision that was made about it.
 *
 * "Applied" / "Not applied" is stated per table rather than left implicit,
 * because it is the single most consequential thing on the document: the same
 * figures with the deductible left off produce a different number, and six
 * weeks later nobody remembers which way it was run.
 */
function benefitTable(title, rows, kind, applied) {
  const decision = applied
    ? '<span class="est__applied">Applied</span>'
    : '<span class="est__not-applied">Not applied</span>';

  if (!rows?.length) {
    return `<section class="est__section" data-testid="est--${kind}">
      <div class="est__section-head">
        <h4 class="est__section-title">${esc(title)}</h4>${decision}
      </div>
      <p class="est__empty">The response carried no ${esc(kind)} information.</p>
    </section>`;
  }

  return `<section class="est__section" data-testid="est--${kind}">
    <div class="est__section-head">
      <h4 class="est__section-title">${esc(title)}</h4>${decision}
    </div>
    <div class="est__table-wrap" tabindex="0">
      <table class="est__table">
        <thead><tr>
          <th>Services</th><th>Network</th><th>Type</th><th>Level</th>
          <th class="est__num">Amount</th><th>Information</th>
        </tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
                <td>${esc(row.services)}</td>
                <td>${esc(row.network)}</td>
                <td>${esc(row.type)}</td>
                <td>${esc(row.level)}</td>
                <td class="est__num">${
                  kind === 'coinsurance'
                    ? `${esc(row.percent)}%`
                    : `${money(row.amount)}${
                        row.remaining === undefined
                          ? ''
                          : `<span class="est__remaining">${money(row.remaining)} remaining</span>`
                      }`
                }</td>
                <td class="est__info">${esc(row.information)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </section>`;
}

function dueBlock(doc) {
  const r = doc.result;
  if (!r.anyApplied) {
    return `<section class="est__due est__due--pending" data-testid="est--due">
      <p class="est__due-label">Estimate due from patient</p>
      <p class="est__due-pending">Not calculated — no coverage option was applied.</p>
      <p class="est__due-note">
        Which is not the same as the patient owing nothing. This estimate was
        saved with the copay, deductible and coinsurance left off.
      </p>
    </section>`;
  }

  return `<section class="est__due" data-testid="est--due">
    <p class="est__due-label">Estimate due from patient</p>
    <p class="est__due-amount" data-testid="est--due-amount">${money(r.patientOwes)}</p>
    <dl class="est__due-work">
      <div><dt>Total expected allowed</dt><dd>${money(doc.totalAllowed)}</dd></div>
      <div><dt>Copay</dt><dd>${money(r.copay)}</dd></div>
      <div><dt>Towards deductible</dt><dd>${money(r.towardsDeductible)}</dd></div>
      <div><dt>Coinsurance (${esc(r.coinsuranceRate)}%)</dt><dd>${money(r.coinsurance)}</dd></div>
      <div><dt>Plan is expected to pay</dt><dd>${money(r.planPays)}</dd></div>
    </dl>
  </section>`;
}

/** The whole document, read-only. No control of any kind is emitted here. */
export function estimateDocumentMarkup(doc) {
  return `<article class="est" data-testid="est--document" data-estimate="${esc(doc.id)}">
    <header class="est__head">
      <p class="est__ref">
        Estimate #${esc(doc.estimateNumber)} from Elig ID ${esc(doc.eligibilityId)},
        response received on ${esc(doc.receivedOn)}
      </p>
      <p class="est__coverage">
        <ui-badge status="success" size="sm">${esc(doc.coverage)}</ui-badge>
        <span class="est__saved">Saved ${esc(doc.savedAt)} by ${esc(doc.savedBy)}</span>
      </p>
    </header>

    <div class="est__parties">
      ${partyBlock('Patient', [
        ['Name', doc.patient.name],
        ['Member ID', doc.patient.memberId],
        ['Plan', doc.patient.plan],
        ['Birthdate', doc.patient.birthdate],
      ])}
      ${partyBlock('Encounter', [
        ['Scheduled DOS', doc.encounter.scheduledDos],
        ['Practice', doc.encounter.practice],
        ['Provider', doc.encounter.provider],
        ['Diagnosis', doc.encounter.diagnosis],
      ])}
      ${partyBlock('Insurance', [
        ['Payer', doc.insurance.payer],
        ['Payer ID', doc.insurance.payerId],
        ['Inbound Name', doc.insurance.inboundName],
      ])}
    </div>

    <section class="est__section" data-testid="est--rates-section">
      <div class="est__section-head">
        <h4 class="est__section-title">Estimated rates for selected procedures</h4>
        <span class="est__basis">Rates by place of service: <strong>${esc(doc.rateBasis)}</strong></span>
      </div>
      <p class="est__section-note">
        Active coverage insurance type from the eligibility response:
        <strong>${esc(doc.insurance.insuranceTypeFromEligibility)}</strong>
      </p>
      ${ratesTable(doc)}
    </section>

    ${benefitTable('Copay from eligibility', doc.benefits.copay, 'copay', doc.applied.copay)}
    ${benefitTable('Deductible from eligibility', doc.benefits.deductible, 'deductible', doc.applied.deductible)}
    ${benefitTable('Coinsurance from eligibility', doc.benefits.coinsurance, 'coinsurance', doc.applied.coinsurance)}

    ${dueBlock(doc)}

    ${
      doc.note
        ? `<section class="est__section" data-testid="est--note">
             <h4 class="est__section-title">Note for patient</h4>
             <p class="est__note">${esc(doc.note)}</p>
           </section>`
        : ''
    }

    <footer class="est__foot">
      <p>
        This is an estimate, not a bill. What the plan actually allows is decided
        when the claim adjudicates.
      </p>
      ${
        doc.sentToPortal
          ? '<p class="est__sent" data-testid="est--sent">Sent to the patient portal.</p>'
          : ''
      }
    </footer>
  </article>`;
}

/**
 * Download the document as a PDF — the same document both screens render.
 *
 * The markup is passed rather than the screen being printed, because Download
 * sits on every ROW of the estimates list as well as on the open document, and
 * on a row what is on screen is the list. Passing it means both buttons
 * produce the same file, which is the whole reason this module exists.
 *
 * The title becomes the filename the browser's Save dialog offers; see
 * js/lib/print-document.js for why a download here is print-to-PDF at all.
 */
export function downloadEstimateDocument(doc, mrn) {
  downloadAsPdf({
    title: `Estimate ${doc.estimateNumber} — ${doc.patient.name} (MRN ${mrn})`,
    markup: estimateDocumentMarkup(doc),
  });
}
