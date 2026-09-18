/**
 * PROFILE · INSURANCE (module id "profile-billing" — unchanged so existing
 * routes/testids don't churn; only the sidebar label changed). Insurance
 * the patient provided at onboarding: one or more policies, each with its
 * own "Check Eligibility" action, plus the running history of every check.
 * With two or more policies on file, every card but the current Primary
 * offers "Make Primary" — coverage order is something front desk corrects
 * often (a new employer plan, a payer that dropped coverage), not a
 * one-time onboarding decision.
 *
 * Insurance is not duplicated — data/profile-billing.js's payers list is
 * the same one the sidebar's top-level Billing section's own Insurance tab
 * reads (js/screens/chart-billing.js), and the eligibility history read
 * and written here is data/chart-billing.js's CHART_ELIGIBILITY_HISTORY,
 * that same shared list. Adding a policy or checking eligibility from
 * either screen keeps both in step, because there is only one copy of
 * each.
 *
 * Account balance, episodes and authorizations used to live here too —
 * they moved out: the balance is the header's own Patient Balance box, and
 * authorizations are the Billing section's Prior Auth tab. This module is
 * insurance and the billing group, and nothing else.
 *
 * The billing group is the one exception to "the money lives in Billing". It
 * arrived here when the client asked for the Billing section to be removed
 * (RM-014) and kept its place when the section was reinstated, because it is
 * answered in the same breath as the coverage — who pays, and which of the
 * practice's books the charges go on — by the same person, at the same desk.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { PROFILE_BILLING, EMPTY_PROFILE_BILLING } from '../../data/profile-billing.js';
// The practice's own billing entities. One list, defined once, so the group
// a patient is filed under is chosen from the same names everywhere.
import { BILLING_GROUPS } from '../../data/registration.js';
import {
  CHART_ELIGIBILITY_HISTORY,
  EMPTY_CHART_ELIGIBILITY_HISTORY,
} from '../../data/chart-billing.js';
import {
  GEST_MODIFIERS,
  GEST_ALLOWED_PERCENTAGES,
  GEST_COVERAGE_OPTIONS,
  gestimatorContext,
  benefitsFor,
  calculateEstimate,
  saveEstimateDocument,
  money,
} from '../../data/gestimator.js';
// Downloading, sending or saving an estimate files it against the patient, so
// Billing ▸ gEstimator can show what they were quoted. One text builder for
// both screens, so the file on somebody's desktop and the document on screen
// cannot disagree.
import { downloadEstimateDocument } from '../lib/estimate-document.js';
import { PROVIDERS } from '../../data/schedule.js';
import { PRACTICE } from '../../data/practice.js';
import { CPT_CODES } from '../../data/master.js';

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

/** "01-03-2026" → "2026-03-01", the format a native date input wants. */
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

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('profile-billing', {
  render(host, ctx) {
    const mrn = ctx.patient.mrn;
    const data = {
      // Same array Billing's own Insurance tab reads — pushed to in place,
      // not copied, so an addition here shows up there too.
      payers: (PROFILE_BILLING[mrn] || EMPTY_PROFILE_BILLING).payers,
      billingGroup: (PROFILE_BILLING[mrn] || EMPTY_PROFILE_BILLING).billingGroup,
      eligibilityHistory: [...(CHART_ELIGIBILITY_HISTORY[mrn] || EMPTY_CHART_ELIGIBILITY_HISTORY)],
    };

    function insuranceCards() {
      if (!data.payers.length) {
        return `<li class="fs__empty">No insurance on file — self-pay.</li>`;
      }
      return data.payers
        .map(
          (p, index) => `<li class="fs__card" data-testid="chart--pb-insurance-card">
              <header class="fs__card-head">
                <h3 class="fs__card-title">${esc(p.name)}</h3>
                <ui-badge status="${p.type === 'Primary' ? 'brand' : 'neutral'}" size="sm">${esc(p.type)}</ui-badge>
                <div class="fs__card-actions">
                  ${
                    data.payers.length > 1 && p.type !== 'Primary'
                      ? `<button type="button" class="fs__card-action-link" data-pb-make-primary="${index}"
                          data-testid="chart--pb-make-primary">Make Primary</button>`
                      : ''
                  }
                  <button type="button" class="fs__card-menu" data-pb-menu="${index}"
                    aria-haspopup="menu" aria-expanded="false"
                    data-testid="chart--pb-actions">Actions ${icon('caret-down')}</button>
                </div>
              </header>
              <div class="fs__card-body">
                <dl class="fs__kv">
                  <dt>Insurance Type</dt><dd>${esc(p.insuranceType) || '—'}</dd>
                  <dt>Policy</dt><dd>${esc(p.policy) || '—'}</dd>
                  <dt>Group</dt><dd>${esc(p.group) || '—'}</dd>
                  <dt>Effective</dt><dd>${p.effective ? formatDate(p.effective) : '—'}</dd>
                  <dt>Expires</dt><dd>${p.expires ? formatDate(p.expires) : '—'}</dd>
                  <dt>Phone</dt><dd>${esc(p.phone) || '—'}</dd>
                </dl>
              </div>
            </li>`
        )
        .join('');
    }

    function paint() {
      host.innerHTML = `<div class="fs__grid fs__grid--2" data-testid="chart--pb-grid">
          <div class="fs__col">
            <section class="fs__card" data-testid="chart--pb-insurance">
              <header class="fs__card-head">
                <h3 class="fs__card-title">Current Insurance</h3>
                <button type="button" class="fs__add" data-pb-add-insurance
                  aria-label="Add insurance" title="Add insurance" data-testid="chart--pb-add-insurance">
                  ${icon('plus')}
                </button>
              </header>
              <div class="fs__card-body">
                <ul class="fs__list" data-testid="chart--pb-payers">${insuranceCards()}</ul>
              </div>
            </section>

            <!-- Which of the practice's billing entities this patient's
                 charges are raised under. It sits directly under the payers
                 because it is the same conversation — who pays, and which of
                 our books it goes on. The Billing section carries the money
                 itself; this is the one piece of it the front desk sets by
                 hand while the coverage is in front of them. -->
            <section class="fs__card" data-testid="chart--pb-billing-group">
              <header class="fs__card-head"><h3 class="fs__card-title">Billing Group</h3></header>
              <div class="fs__card-body">
                <ui-select label="Billing group" label-hidden placeholder="Not assigned"
                  options="${esc(BILLING_GROUPS.join(','))}" value="${esc(data.billingGroup)}"
                  data-testid="chart--pb-billing-group-select"></ui-select>
              </div>
            </section>
          </div>
          <div class="fs__col">
            <section class="fs__card" data-testid="chart--pb-eligibility">
              <header class="fs__card-head"><h3 class="fs__card-title">Eligibility History</h3></header>
              <div class="fs__card-body">
                ${
                  data.eligibilityHistory.length
                    ? `<div class="fs__table-wrap" tabindex="0"><table class="fs__table" data-testid="chart--pb-eligibility-table">
                        <thead><tr><th>Checked On</th><th>Payer</th><th>Result</th><th>Checked By</th></tr></thead>
                        <tbody>
                          ${data.eligibilityHistory
                            .map(
                              (e) => `<tr>
                                <td>${formatDate(e.checkedOn)}</td>
                                <td>${esc(e.payer)}</td>
                                <td><ui-badge status="${e.result === 'Active' ? 'success' : 'critical'}" size="sm"
                                  >${esc(e.result)}</ui-badge
                                ></td>
                                <td>${esc(e.checkedBy)}</td>
                              </tr>`
                            )
                            .join('')}
                        </tbody>
                      </table></div>`
                    : `<p class="fs__empty" style="padding-left:0">No eligibility checks on file.</p>`
                }
              </div>
            </section>
          </div>
        </div>

        <ui-modal id="pbInsuranceModal" heading="Add Insurance" size="lg">
          <!-- Same fields Patient Intake collects on the Insurance tab
               (screens/patient-add.html#panel-insurance) — a policy added
               here should ask for nothing an onboarding policy didn't. -->
          <div class="fs__grid fs__grid--2">
            <ui-select label="Coverage Order" options="Primary,Secondary,Tertiary"
              value="${data.payers.length ? 'Secondary' : 'Primary'}"
              data-testid="chart--pb-ins-order"></ui-select>
            <ui-select label="Insurance Type" placeholder="Select"
              options="Commercial,Medicare,Medicaid,Workers comp,Self-pay"
              data-testid="chart--pb-ins-kind"></ui-select>

            <ui-input class="fs__field--wide" label="Insurance Name" required
              data-testid="chart--pb-ins-name"></ui-input>

            <ui-input label="Member ID" data-testid="chart--pb-ins-policy"></ui-input>
            <ui-input label="Group Number" data-testid="chart--pb-ins-group"></ui-input>

            <ui-input label="Effective Start Date" type="date" data-testid="chart--pb-ins-effective"></ui-input>
            <ui-input label="Effective End Date" type="date" data-testid="chart--pb-ins-expires"></ui-input>

            <ui-select class="fs__field--wide" label="Patient Relationship To Insured"
              options="Self,Spouse,Child,Other" value="Self"
              data-testid="chart--pb-ins-relationship"></ui-select>

            <ui-input label="Subscriber First Name" data-testid="chart--pb-ins-sub-first"></ui-input>
            <ui-input label="Subscriber Last Name" data-testid="chart--pb-ins-sub-last"></ui-input>

            <ui-input label="Subscriber Date of Birth" type="date" data-testid="chart--pb-ins-sub-dob"></ui-input>
            <ui-select label="Subscriber Sex" placeholder="Select" options="Female,Male,Other"
              data-testid="chart--pb-ins-sub-sex"></ui-select>

            <div class="fs__field--wide">
              <ui-checkbox checked data-testid="chart--pb-ins-same-address"
                >Subscriber address same as patient</ui-checkbox
              >
            </div>
          </div>

          <h3 class="fs__eyebrow" style="margin-top: var(--space-6)">Upload Insurance Card</h3>
          <div class="fs__grid fs__grid--2">
            <ui-file-upload label="Front Side" accept=".png,.jpg" max-size="5MB"
              data-testid="chart--pb-ins-card-front"></ui-file-upload>
            <ui-file-upload label="Back Side" accept=".png,.jpg" max-size="5MB"
              data-testid="chart--pb-ins-card-back"></ui-file-upload>
          </div>

          <div slot="footer">
            <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--pb-ins-cancel">Cancel</ui-button>
            <ui-button variant="primary" data-testid="chart--pb-ins-save">Add Insurance</ui-button>
          </div>
        </ui-modal>

        <!-- gEstimator. One dialog, three views: the launch prompt, then the
             two steps. The body is rebuilt per view rather than three modals
             being swapped, so the dialog never closes and reopens under the
             user mid-estimate. <ui-modal> supports exactly this — see
             hoistFooter() in js/components/ui-modal.js. -->
        <ui-modal id="pbGestModal" heading="Launch gEstimator" size="xl">
          <div id="pbGestBody" data-testid="chart--gest-body"></div>
        </ui-modal>`;
    }

    /* ========================================================================
       gESTIMATOR

       Three views in one dialog: the launch prompt, Step 1 (Launch) and
       Step 2 (Calculation). `gest.view` is the only thing that decides which
       is on screen, and paintGest() is the only thing that draws — so there
       is no way for the stepper and the body to disagree about where you are.

       Nothing here calls the module's own paint(): that rewrites host, modal
       included, and would tear the dialog down mid-estimate.
       ===================================================================== */

    const PROVIDER_OPTIONS = PROVIDERS.map((p) => `${p.name}`);
    const CPT_OPTIONS = CPT_CODES.filter((c) => c.active);

    const gest = {
      view: 'launch',
      payerIndex: 0,
      context: null,
      benefits: null,
      encounter: null,
      lines: [],
      // Non-Facility first: an office estimate is the common case, and the
      // facility rate understates what the patient owes when the case is in
      // fact done in a room the clinic does not bill for.
      rateBasis: 'Non-Facility',
      applied: { deductible: false, coinsurance: false, copay: false },
      note: '',
      result: null,
      sentToPortal: false,
    };

    function newLine() {
      return { provider: 'Main', units: 1, code: '', modifier: 'None', percentOfAllowed: '100%' };
    }

    function startGestimator(index, trigger) {
      const payer = data.payers[index];
      if (!payer) return;

      gest.view = 'launch';
      gest.payerIndex = index;
      gest.context = gestimatorContext(ctx.patient, payer, todayDdMmYyyy());
      gest.benefits = benefitsFor(payer);
      gest.encounter = {
        patientAccount: `PA-${ctx.patient.mrn}`,
        scheduledDos: todayDdMmYyyy(),
        encounterId: 'UNKNOWN',
        diagnosisCode: '',
        previousBalance: ctx.patient.balance ? money(ctx.patient.balance) : 'NONE',
        practice: PRACTICE.name,
        // The chart's provider is written "Dr. Amara Mensah"; the schedule's
        // list is bare names. An unmatched value renders as a blank select,
        // which reads as "no provider" rather than "not one of these" — so
        // fall back rather than setting a value the list does not carry.
        mainProvider: PROVIDER_OPTIONS.find((name) =>
          String(ctx.patient.provider?.name || '').includes(name)
        ) || PROVIDER_OPTIONS[0],
        other1: 'NONE',
        other2: 'NONE',
        other3: 'NONE',
      };
      gest.lines = [newLine()];
      gest.rateBasis = 'Non-Facility';
      gest.applied = { deductible: false, coinsurance: false, copay: false };
      gest.note = '';
      gest.result = null;
      gest.sentToPortal = false;

      paintGest();
      host.querySelector('#pbGestModal')?.open(trigger);
    }

    /* --- View: the launch prompt --------------------------------------------- */

    function launchMarkup() {
      const payer = data.payers[gest.payerIndex];
      return `<p class="gst__lead">
          gEstimator prices this visit against the eligibility response on file
          for the policy below. Confirm who and which plan, then launch.
        </p>
        <div class="fs__grid fs__grid--2">
          <ui-input label="Patient" readonly value="${esc(ctx.patient.name)}"
            data-testid="chart--gest-patient"></ui-input>
          <ui-input label="Insurance" readonly value="${esc(payer?.name || 'Self pay')}"
            data-testid="chart--gest-insurance"></ui-input>
        </div>
        <div class="ui-modal__actions">
          <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--gest-cancel"
            >Cancel</ui-button
          >
          <span class="ui-modal__actions-spacer"></span>
          <ui-button variant="primary" data-testid="chart--gest-submit-launch">Submit</ui-button>
        </div>`;
    }

    /* --- The stepper ---------------------------------------------------------- */

    /** Two steps, and only two — the launch prompt is a confirmation, not a
     *  stage of the estimate, so it is not numbered. */
    function stepperMarkup(current) {
      const steps = [
        { n: 1, label: 'Launch', hint: 'Encounter and procedures' },
        { n: 2, label: 'Calculation', hint: 'Rates and patient estimate' },
      ];
      return `<ol class="gst__steps" data-testid="chart--gest-steps">
        ${steps
          .map((step) => {
            const state = step.n === current ? 'on' : step.n < current ? 'done' : 'todo';
            return `<li class="gst__step gst__step--${state}"
                ${state === 'on' ? 'aria-current="step"' : ''}
                data-testid="chart--gest-step-${step.n}">
                <span class="gst__step-num" aria-hidden="true">${
                  state === 'done' ? icon('check', 'ui-icon') : step.n
                }</span>
                <span class="gst__step-body">
                  <span class="gst__step-label">Step ${step.n} — ${step.label}</span>
                  <span class="gst__step-hint">${step.hint}</span>
                </span>
              </li>`;
          })
          .join('')}
      </ol>`;
    }

    /** The "what response is this run off, and when did it come back" banner
     *  both steps carry. It carries no step title — the dialog heading and
     *  the stepper already say which step you are on, and a third copy of the
     *  same words pushed the actual content below the fold. */
    function responseBanner(subtitle) {
      const c = gest.context;
      return `<header class="gst__banner">
        <p class="gst__banner-sub">${esc(subtitle)}</p>
        <p class="gst__banner-coverage">
          <ui-badge status="success" size="sm">${esc(c.coverage)}</ui-badge>
          <button type="button" class="fs__card-action-link" data-gest-response
            data-testid="chart--gest-view-response">View Eligibility Response</button>
        </p>
      </header>`;
    }

    function partyBlocks(withEncounter) {
      const c = gest.context;
      const e = gest.encounter;
      return `<div class="gst__parties">
        <section class="gst__party" data-testid="chart--gest-party-patient">
          <h4 class="gst__party-title">Patient</h4>
          <dl class="fs__kv">
            <dt>Name</dt><dd>${esc(c.patient.name)}</dd>
            <dt>Member ID</dt><dd>${esc(c.patient.memberId)}</dd>
            <dt>Plan</dt><dd>${esc(c.patient.plan)}</dd>
            <dt>Birthdate</dt><dd>${formatDate(c.patient.birthdate)}</dd>
          </dl>
        </section>
        ${
          withEncounter
            ? `<section class="gst__party" data-testid="chart--gest-party-encounter">
                 <h4 class="gst__party-title">Encounter</h4>
                 <dl class="fs__kv">
                   <dt>Scheduled DOS</dt><dd>${formatDate(e.scheduledDos)}</dd>
                   <dt>Practice</dt><dd>${esc(e.practice)}</dd>
                   <dt>Provider</dt><dd>${esc(e.mainProvider)}</dd>
                   <dt>Diagnosis</dt><dd>${esc(e.diagnosisCode || '—')}</dd>
                 </dl>
               </section>`
            : ''
        }
        <section class="gst__party" data-testid="chart--gest-party-insurance">
          <h4 class="gst__party-title">Insurance</h4>
          <dl class="fs__kv">
            <dt>Payer</dt><dd>${esc(c.insurance.name)}</dd>
            <dt>Payer ID</dt><dd>${esc(c.insurance.payerId)}</dd>
            <dt>Inbound Name</dt><dd>${esc(c.insurance.inboundName)}</dd>
          </dl>
        </section>
      </div>`;
    }

    /* --- View: Step 1 (Launch) ------------------------------------------------ */

    function selectMarkup(label, testid, options, value, extra = '') {
      return `<ui-select label="${esc(label)}" data-testid="${testid}" ${extra}
        options="${options.map((o) => esc(o)).join(',')}" value="${esc(value)}"></ui-select>`;
    }

    function procedureRowsMarkup() {
      return gest.lines
        .map(
          (line, index) => `<div class="gst__proc-row" data-gest-line="${index}"
            data-testid="chart--gest-line">
            <span class="gst__proc-index">${index + 1}</span>
            <ui-select label="Provider" label-hidden size="sm" data-gest-field="provider"
              options="Main,${PROVIDER_OPTIONS.map((p) => esc(p)).join(',')}"
              value="${esc(line.provider)}"></ui-select>
            <ui-input label="Units" label-hidden size="sm" type="number" min="1"
              data-gest-field="units" value="${line.units}"
              data-testid="chart--gest-units"></ui-input>
            <ui-select label="Procedure Code" label-hidden size="sm" placeholder="Select CPT"
              data-gest-field="code" value="${esc(line.code)}" data-testid="chart--gest-code">
              ${CPT_OPTIONS.map(
                (c) => `<option value="${c.code}">${c.code} — ${esc(c.description)}</option>`
              ).join('')}
            </ui-select>
            <ui-select label="Modifier" label-hidden size="sm" data-gest-field="modifier"
              options="${GEST_MODIFIERS.map((m) => esc(m)).join(',')}"
              value="${esc(line.modifier)}"></ui-select>
            <button type="button" class="fs__card-action-link" data-gest-remove-line="${index}"
              aria-label="Remove procedure ${index + 1}"
              ${gest.lines.length === 1 ? 'disabled' : ''}>Remove</button>
          </div>`
        )
        .join('');
    }

    function step1Markup() {
      const c = gest.context;
      const e = gest.encounter;

      return `${stepperMarkup(1)}
        ${responseBanner(
          `from Elig ID ${c.eligibilityId}, response received on ${formatDate(c.receivedOn)}`
        )}
        ${partyBlocks(false)}

        <section class="gst__section" data-testid="chart--gest-encounter">
          <h4 class="gst__section-title">Encounter Information</h4>
          <div class="fs__grid fs__grid--3">
            <ui-input label="Patient Account" readonly value="${esc(e.patientAccount)}"></ui-input>
            <ui-input label="Scheduled DOS" type="date" value="${isoOf(e.scheduledDos)}"
              data-gest-enc="scheduledDos" data-testid="chart--gest-dos"></ui-input>
            <ui-input label="Encounter ID" readonly value="${esc(e.encounterId)}"></ui-input>

            <ui-input label="Diagnosis Code" placeholder="e.g. K21.9" value="${esc(e.diagnosisCode)}"
              data-gest-enc="diagnosisCode" data-testid="chart--gest-dx"></ui-input>
            <ui-input label="Previous Balance" readonly value="${esc(e.previousBalance)}"></ui-input>
            <ui-input label="Practice" readonly value="${esc(e.practice)}"
              data-testid="chart--gest-practice"></ui-input>

            ${selectMarkup('Main Provider', 'chart--gest-main-provider', PROVIDER_OPTIONS, e.mainProvider, 'data-gest-enc="mainProvider"')}
            ${selectMarkup('Other Provider 1', 'chart--gest-other-1', ['NONE', ...PROVIDER_OPTIONS], e.other1, 'data-gest-enc="other1"')}
            ${selectMarkup('Other Provider 2', 'chart--gest-other-2', ['NONE', ...PROVIDER_OPTIONS], e.other2, 'data-gest-enc="other2"')}

            ${selectMarkup('Other Provider 3', 'chart--gest-other-3', ['NONE', ...PROVIDER_OPTIONS], e.other3, 'data-gest-enc="other3"')}
          </div>
        </section>

        <section class="gst__section" data-testid="chart--gest-procedures">
          <h4 class="gst__section-title">Enter Procedures and Modifiers</h4>
          <div class="gst__proc-head" aria-hidden="true">
            <span>#</span><span>Provider</span><span>Units</span>
            <span>Procedure Code</span><span>Modifier</span><span></span>
          </div>
          <div class="gst__proc-rows">${procedureRowsMarkup()}</div>
          <button type="button" class="gst__add-line" data-gest-add-line
            data-testid="chart--gest-add-line">${icon('plus')} Additional Procedure</button>
        </section>

        <div class="ui-modal__actions">
          <ui-button variant="tertiary" data-gest-back="launch" data-testid="chart--gest-back-launch"
            >Back</ui-button
          >
          <span class="ui-modal__actions-spacer"></span>
          <ui-button variant="primary" data-testid="chart--gest-submit-step1">Submit</ui-button>
        </div>`;
    }

    /* --- View: Step 2 (Calculation) ------------------------------------------- */

    function ratesTableMarkup() {
      const rows = gest.result.lines
        .map(
          (line, index) => `<tr data-testid="chart--gest-rate-row">
            <td>${line.units}</td>
            <td>${esc(line.code)}</td>
            <td>${esc(line.modifier === 'None' ? '—' : line.modifier.split(' ')[0])}</td>
            <td class="gst__num">${money(line.billedPerUnit)}</td>
            <td class="gst__num" data-testid="chart--gest-allowed">${money(line.allowedPerUnit)}</td>
            <td>${esc(line.insType)}</td>
            <td>${esc(line.posLabel)}</td>
            <td>${esc(line.matchType)}</td>
            <td>
              <ui-select label="% of allowed for line ${index + 1}" label-hidden size="sm"
                data-gest-line-pct="${index}"
                options="${GEST_ALLOWED_PERCENTAGES.join(',')}"
                value="${esc(line.percentOfAllowed)}"></ui-select>
            </td>
            <td class="gst__num">${money(line.lineAllowed)}</td>
          </tr>`
        )
        .join('');

      return `<div class="fs__table-wrap" tabindex="0">
        <table class="fs__table gst__table" data-testid="chart--gest-rates-table">
          <thead><tr>
            <th>Units</th><th>Code</th><th>Modifier</th>
            <th class="gst__num">Billed / unit</th><th class="gst__num">Allowed / unit</th>
            <th>Ins type</th><th>Place of service</th><th>Match type</th>
            <th>% of allowed</th><th class="gst__num">Line allowed</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <th colspan="9">Total expected allowed</th>
            <td class="gst__num" data-testid="chart--gest-total-allowed"
              >${money(gest.result.totalAllowed)}</td>
          </tr></tfoot>
        </table>
      </div>`;
    }

    /** One eligibility table — copay, deductible or coinsurance. The payer's
     *  own wording is reproduced in Information, because that text is what the
     *  desk quotes back when a patient disputes the estimate. */
    function benefitTableMarkup(title, rows, kind, testid) {
      if (!rows.length) {
        return `<section class="gst__section" data-testid="${testid}">
          <h4 class="gst__section-title">${esc(title)}</h4>
          <p class="fs__empty" style="padding-left:0">The response carried no ${esc(
            kind
          )} information.</p>
        </section>`;
      }

      return `<section class="gst__section" data-testid="${testid}">
        <div class="gst__section-head">
          <h4 class="gst__section-title">${esc(title)}</h4>
          <ui-select label="Apply ${esc(kind)}" size="sm" data-gest-apply="${kind}"
            options="${GEST_COVERAGE_OPTIONS.join(',')}"
            value="${gest.applied[kind] ? 'Apply' : "Don't apply"}"
            data-testid="chart--gest-apply-${kind}"></ui-select>
        </div>
        <div class="fs__table-wrap" tabindex="0">
          <table class="fs__table gst__table">
            <thead><tr>
              <th>Services</th><th>Network</th><th>Type</th><th>Level</th>
              <th class="gst__num">Amount</th><th>Information</th>
            </tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td>${esc(row.services)}</td>
                    <td>${esc(row.network)}</td>
                    <td>${esc(row.type)}</td>
                    <td>${esc(row.level)}</td>
                    <td class="gst__num">${
                      kind === 'coinsurance'
                        ? `${row.percent}%`
                        : `${money(row.amount)}${
                            row.remaining === undefined
                              ? ''
                              : `<span class="gst__remaining">${money(row.remaining)} remaining</span>`
                          }`
                    }</td>
                    <td class="gst__info">${esc(row.information)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>`;
    }

    function estimateDueMarkup() {
      const r = gest.result;
      if (!r.anyApplied) {
        return `<section class="gst__due gst__due--pending" data-testid="chart--gest-due">
          <p class="gst__due-label">Current estimate due</p>
          <p class="gst__due-pending">
            The estimate will update when one or more coverage options are applied.
          </p>
        </section>`;
      }

      return `<section class="gst__due" data-testid="chart--gest-due">
        <p class="gst__due-label">Current estimate due</p>
        <p class="gst__due-amount" data-testid="chart--gest-due-amount">${money(r.patientOwes)}</p>
        <dl class="gst__due-work">
          <dt>Total expected allowed</dt><dd>${money(r.totalAllowed)}</dd>
          <dt>Copay</dt><dd>${money(r.copay)}</dd>
          <dt>Towards deductible</dt><dd>${money(r.towardsDeductible)}</dd>
          <dt>Coinsurance (${r.coinsuranceRate}%)</dt><dd>${money(r.coinsurance)}</dd>
          <dt>Plan is expected to pay</dt><dd>${money(r.planPays)}</dd>
        </dl>
      </section>`;
    }

    function step2Markup() {
      const c = gest.context;
      return `${stepperMarkup(2)}
        ${responseBanner(
          `Estimate #${c.estimateNumber} from Elig ID ${c.eligibilityId}, response received on ${formatDate(
            c.receivedOn
          )}`
        )}
        ${partyBlocks(true)}

        <section class="gst__section" data-testid="chart--gest-rates">
          <div class="gst__section-head">
            <h4 class="gst__section-title">Estimated rates for selected procedures</h4>
            <div class="gst__basis" role="group" aria-label="Select rates by place of service">
              <span class="gst__basis-label">Select rates by place of service</span>
              ${['Non-Facility', 'Facility']
                .map(
                  (basis) => `<button type="button" class="gst__basis-btn"
                    data-gest-basis="${basis}" aria-pressed="${gest.rateBasis === basis}"
                    data-testid="chart--gest-basis-${basis.toLowerCase()}">${basis}</button>`
                )
                .join('')}
            </div>
          </div>
          <p class="gst__section-note">
            Active coverage insurance type from the eligibility response:
            <strong>${esc(c.insurance.insuranceTypeFromEligibility)}</strong>
          </p>
          ${ratesTableMarkup()}
        </section>

        ${benefitTableMarkup('Copay from eligibility', gest.benefits.copay, 'copay', 'chart--gest-copay')}
        ${benefitTableMarkup('Deductible from eligibility', gest.benefits.deductible, 'deductible', 'chart--gest-deductible')}
        ${benefitTableMarkup('Coinsurance from eligibility', gest.benefits.coinsurance, 'coinsurance', 'chart--gest-coinsurance')}

        ${estimateDueMarkup()}

        <section class="gst__section">
          <ui-textarea label="Optional note for patient" rows="3"
            placeholder="Anything the patient should read alongside the figure…"
            data-gest-note data-testid="chart--gest-note"></ui-textarea>
        </section>

        ${
          gest.sentToPortal
            ? `<p class="gst__sent" data-testid="chart--gest-sent">
                 ${icon('check')} Sent to the patient portal.
               </p>`
            : ''
        }

        <div class="ui-modal__actions">
          <ui-button variant="tertiary" data-gest-back="step1" data-testid="chart--gest-back-step1"
            >Back to Step 1</ui-button
          >
          <span class="ui-modal__actions-spacer"></span>
          <ui-button variant="outline" icon="download" data-testid="chart--gest-download"
            >Download</ui-button
          >
          <ui-button variant="outline" icon="send" data-testid="chart--gest-portal"
            >Send to portal</ui-button
          >
          <ui-button variant="primary" data-testid="chart--gest-save"
            >Save selections</ui-button
          >
        </div>`;
    }

    /* --- Paint ---------------------------------------------------------------- */

    const GEST_HEADINGS = {
      launch: 'Launch gEstimator',
      step1: 'gEstimator — Step 1 (Launch)',
      step2: 'gEstimator — Step 2 (Calculation)',
    };

    function paintGest() {
      const modal = host.querySelector('#pbGestModal');
      const body = host.querySelector('#pbGestBody');
      if (!modal || !body) return;

      if (gest.view === 'step2') {
        // The place-of-service basis is stamped on every line here rather than
        // being stored per line — one control sets it for the whole estimate,
        // so one place applies it.
        gest.result = calculateEstimate(
          gest.lines.map((line) => ({
            ...line,
            placeOfService: gest.rateBasis,
            insType: data.payers[gest.payerIndex]?.insuranceType || 'Self pay',
          })),
          gest.benefits,
          gest.applied
        );
      }

      modal.setAttribute('heading', GEST_HEADINGS[gest.view]);
      modal.setAttribute('size', gest.view === 'launch' ? 'md' : 'xl');
      body.innerHTML =
        gest.view === 'launch' ? launchMarkup() : gest.view === 'step1' ? step1Markup() : step2Markup();

      // The action row is written at the end of each view; this lifts it into
      // the pinned footer so a long Step 2 never scrolls its buttons away.
      modal.hoistFooter?.();

      if (gest.view === 'step2') {
        const note = body.querySelector('[data-gest-note] textarea');
        if (note) note.value = gest.note;
      }
    }

    /** Every line needs a code before there is anything to price. */
    function submitStep1() {
      const priced = gest.lines.filter((line) => String(line.code || '').trim());
      if (!priced.length) {
        ctx.flash('Add at least one procedure code before submitting.', 'warning');
        host.querySelector('[data-testid="chart--gest-code"]')?.focus();
        return;
      }
      gest.lines = priced;
      gest.view = 'step2';
      paintGest();
    }

    /* --- Download and portal ------------------------------------------------- */

    /**
     * The estimate as it stands, in the shape a saved document has.
     *
     * Everything is COPIED, not referenced: the document has to keep reading
     * the same in November when the fee schedule and the deductible remaining
     * have both moved. Which coverage options were applied travels with it,
     * because the same rates run without the deductible produce a different
     * number and nobody remembers six weeks later which way it was run.
     */
    function estimateDocument() {
      const c = gest.context;
      const r = gest.result;

      return {
        estimateNumber: c.estimateNumber,
        eligibilityId: c.eligibilityId,
        receivedOn: formatDate(c.receivedOn),
        savedAt: formatDate(todayDdMmYyyy()),
        // The one signed-in identity this prototype has.
        savedBy: 'Amara Mensah',
        coverage: c.coverage,
        patient: {
          name: c.patient.name,
          memberId: c.patient.memberId,
          plan: c.patient.plan,
          birthdate: c.patient.birthdate,
        },
        encounter: {
          scheduledDos: formatDate(gest.encounter.scheduledDos),
          practice: gest.encounter.practice,
          provider: gest.encounter.mainProvider,
          diagnosis: gest.encounter.diagnosisCode || '—',
        },
        insurance: {
          payer: c.insurance.name,
          payerId: c.insurance.payerId,
          inboundName: c.insurance.inboundName,
          insuranceTypeFromEligibility: c.insurance.insuranceTypeFromEligibility,
        },
        rateBasis: gest.rateBasis,
        lines: r.lines.map((line) => ({
          units: line.units,
          code: line.code,
          modifier: line.modifier === 'None' ? '—' : line.modifier.split(' ')[0],
          billedPerUnit: line.billedPerUnit,
          allowedPerUnit: line.allowedPerUnit,
          insType: line.insType,
          posLabel: line.posLabel,
          matchType: line.matchType,
          percentOfAllowed: line.percentOfAllowed,
          lineAllowed: line.lineAllowed,
        })),
        totalAllowed: r.totalAllowed,
        benefits: gest.benefits,
        applied: { ...gest.applied },
        result: { ...r },
        note: gest.note.trim(),
        sentToPortal: gest.sentToPortal,
      };
    }

    /** File it against the patient, so Billing ▸ gEstimator has the record. */
    function fileEstimate() {
      return saveEstimateDocument(ctx.patient.mrn, estimateDocument());
    }

    function downloadEstimate() {
      const doc = fileEstimate();
      /* Before the dialog, not after: Download is print-to-PDF here (see
         js/lib/print-document.js) and window.print() blocks the page until the
         browser's own window is dismissed. It also has to say the estimate was
         FILED, which is the half of this the Save dialog cannot tell anybody. */
      ctx.flash(
        'Filed under Billing ▸ gEstimator. Choose “Save as PDF” to download it.',
        'info'
      );
      downloadEstimateDocument(doc, ctx.patient.mrn);
    }

    function sendToPortal() {
      if (!gest.result?.anyApplied) {
        ctx.flash('Apply at least one coverage option before sending an estimate.', 'warning');
        return;
      }
      gest.sentToPortal = true;
      paintGest();
      // Filed after the flag is set, so the document records that it went out.
      fileEstimate();
      ctx.flash(
        `Estimate #${gest.context.estimateNumber} sent to ${ctx.patient.name}'s portal.`,
        'success'
      );
    }

    /* --- Actions -------------------------------------------------------------- */

    function fromIso(iso) {
      const [y, m, d] = String(iso).split('-');
      return y && m && d ? `${d}-${m}-${y}` : null;
    }

    function checkEligibility(index) {
      const payer = data.payers[index];
      if (!payer) return;
      data.eligibilityHistory.unshift({
        checkedOn: todayDdMmYyyy(),
        payer: payer.name,
        result: 'Active',
        checkedBy: 'Front desk — Ruth Adeyemi',
      });
      paint();
      ctx.flash(`Eligibility verified with ${payer.name}.`, 'success');
    }

    /** Swaps ranks with whoever currently holds the target's coverage order,
     *  rather than just stamping every card "Primary" — this keeps Primary/
     *  Secondary/Tertiary unique no matter which card is promoted. */
    function makePrimary(index) {
      const target = data.payers[index];
      if (!target || target.type === 'Primary') return;

      const currentPrimary = data.payers.find((p) => p.type === 'Primary');
      if (currentPrimary) currentPrimary.type = target.type;
      target.type = 'Primary';

      paint();
      ctx.flash(`${target.name} is now the primary insurance.`, 'success');
    }

    function saveInsurance() {
      const modal = host.querySelector('#pbInsuranceModal');
      const field = (testid) => modal.querySelector(`[data-testid="${testid}"]`)?.value;
      const checked = (testid) => modal.querySelector(`[data-testid="${testid}"]`)?.checked;
      const name = field('chart--pb-ins-name')?.trim();

      if (!name) {
        modal.querySelector('[data-testid="chart--pb-ins-name"]')?.setAttribute('error', 'Enter a payer name.');
        return;
      }

      data.payers.push({
        name,
        type: field('chart--pb-ins-order') || 'Primary',
        insuranceType: field('chart--pb-ins-kind') || null,
        phone: null,
        policy: field('chart--pb-ins-policy') || null,
        group: field('chart--pb-ins-group') || null,
        effective: fromIso(field('chart--pb-ins-effective')),
        expires: fromIso(field('chart--pb-ins-expires')),
        relationship: field('chart--pb-ins-relationship') || 'Self',
        subscriberFirst: field('chart--pb-ins-sub-first') || null,
        subscriberLast: field('chart--pb-ins-sub-last') || null,
        subscriberDob: fromIso(field('chart--pb-ins-sub-dob')),
        subscriberSex: field('chart--pb-ins-sub-sex') || null,
        subscriberSameAddress: checked('chart--pb-ins-same-address') ?? true,
        offCopay: null,
        specCopay: null,
      });

      modal.close();
      paint();
      ctx.flash('Insurance added to the chart.', 'success');
    }

    /* --- The per-policy action menu -------------------------------------------
       Two actions, and they are not peers of each other in weight: an
       eligibility check is one click and writes a history row, gEstimator
       opens a two-step instrument. A menu keeps the second from looking like
       something you press casually, and leaves room for the third when it
       arrives. It is the shared .ui-row-menu every worklist in the app opens,
       which is what the chart's other row menus have become too.
       ---------------------------------------------------------------------- */

    function closeMenus() {
      closeRowMenu();
      host.querySelectorAll('[data-pb-menu]').forEach((button) =>
        button.setAttribute('aria-expanded', 'false')
      );
    }

    function openMenu(anchor, index) {
      const wasOpen = anchor.getAttribute('aria-expanded') === 'true';
      closeMenus();
      if (wasOpen) return;

      openRowMenu(
        anchor,
        [
          {
            label: 'Check Eligibility',
            icon: 'shield',
            testid: 'chart--pb-check-eligibility',
            run: () => checkEligibility(index),
          },
          {
            label: 'Check gEstimator',
            icon: 'dollar',
            testid: 'chart--pb-check-gestimator',
            run: () => startGestimator(index, anchor),
          },
        ],
        { testid: 'chart--pb-actions-menu' }
      );
    }

    /* --- Wiring ----------------------------------------------------------- */

    function onClick(event) {
      const menuTrigger = event.target.closest('[data-pb-menu]');
      if (menuTrigger) {
        openMenu(menuTrigger, Number(menuTrigger.dataset.pbMenu));
        return;
      }

      const primaryTrigger = event.target.closest('[data-pb-make-primary]');
      if (primaryTrigger) {
        makePrimary(Number(primaryTrigger.dataset.pbMakePrimary));
        return;
      }

      if (event.target.closest('[data-pb-add-insurance]')) {
        host.querySelector('#pbInsuranceModal')?.open(event.target.closest('button'));
        return;
      }

      /* --- gEstimator ------------------------------------------------------ */

      if (event.target.closest('[data-gest-response]')) {
        ctx.flash(
          `Eligibility response ${gest.context.eligibilityId} — ${gest.context.coverage}, received ${formatDate(
            gest.context.receivedOn
          )}.`
        );
        return;
      }

      if (event.target.closest('[data-gest-add-line]')) {
        gest.lines.push(newLine());
        paintGest();
        return;
      }

      const removeLine = event.target.closest('[data-gest-remove-line]');
      if (removeLine) {
        if (gest.lines.length === 1) return;
        gest.lines.splice(Number(removeLine.dataset.gestRemoveLine), 1);
        paintGest();
        return;
      }

      const basis = event.target.closest('[data-gest-basis]');
      if (basis) {
        gest.rateBasis = basis.dataset.gestBasis;
        paintGest();
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--pb-ins-save"]')) {
        saveInsurance();
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-submit-launch"]')) {
        gest.view = 'step1';
        paintGest();
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-submit-step1"]')) {
        submitStep1();
        return;
      }

      const back = event.target.closest('[data-gest-back]');
      if (back) {
        gest.view = back.dataset.gestBack;
        paintGest();
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-download"]')) {
        downloadEstimate();
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-portal"]')) {
        sendToPortal();
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-save"]')) {
        fileEstimate();
        ctx.flash(
          gest.result?.anyApplied
            ? `Estimate #${gest.context.estimateNumber} saved to Billing ▸ gEstimator — ${money(gest.result.patientOwes)} due from the patient.`
            : 'Saved to Billing ▸ gEstimator. Apply a coverage option to produce a figure.',
          'success'
        );
      }
    }

    /**
     * One handler for every control in the estimator, because every one of
     * them does the same thing: write to `gest` and repaint. Splitting it per
     * field is how a control ends up silently not saving.
     */
    function onUiChange(event) {
      const target = event.target;

      /* The billing group is written straight back to the patient's record —
         no Save button, because there is nothing else on the card to save
         with it and a one-field form with a button is a button asking to be
         forgotten. No repaint either: the select already shows the answer. */
      if (target.closest('[data-testid="chart--pb-billing-group-select"]')) {
        const record = (PROFILE_BILLING[mrn] ||= { billingGroup: '', payers: [] });
        record.billingGroup = event.detail.value;
        data.billingGroup = event.detail.value;
        ctx.flash(`Billing group set to ${event.detail.value}.`, 'success');
        return;
      }

      const encField = target.closest('[data-gest-enc]')?.dataset.gestEnc;
      if (encField) {
        gest.encounter[encField] =
          encField === 'scheduledDos' ? fromIso(event.detail.value) || gest.encounter.scheduledDos : event.detail.value;
        return; // no repaint: retyping would lose the caret
      }

      const lineRow = target.closest('[data-gest-line]');
      const lineField = target.closest('[data-gest-field]')?.dataset.gestField;
      if (lineRow && lineField) {
        const line = gest.lines[Number(lineRow.dataset.gestLine)];
        if (line) line[lineField] = lineField === 'units' ? Number(event.detail.value) || 1 : event.detail.value;
        return;
      }

      const pctIndex = target.closest('[data-gest-line-pct]')?.dataset.gestLinePct;
      if (pctIndex !== undefined) {
        const line = gest.lines[Number(pctIndex)];
        if (line) line.percentOfAllowed = event.detail.value;
        paintGest();
        return;
      }

      const applyKind = target.closest('[data-gest-apply]')?.dataset.gestApply;
      if (applyKind) {
        gest.applied[applyKind] = event.detail.value === 'Apply';
        paintGest();
        return;
      }

      if (target.closest('[data-gest-note]')) gest.note = event.detail.value;
    }

    /** The menu is anchored to document.body, outside `host`, so dismissing it
     *  has to be watched from the document. */
    function onDocumentClick(event) {
      if (event.target.closest('.ui-row-menu-panel') || event.target.closest('[data-pb-menu]')) return;
      closeMenus();
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onUiChange);
    document.addEventListener('click', onDocumentClick, true);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onUiChange);
      document.removeEventListener('click', onDocumentClick, true);
      closeMenus();
    };
  },
});
