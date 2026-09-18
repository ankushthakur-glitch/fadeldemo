/**
 * BILLING — the chart sidebar's own top-level Billing section (last item in
 * the list), distinct from Profile > Billing's account-balance card grid.
 * A single tab strip over the billing lifecycle: Invoice, Claims, Ledger,
 * Prior Auth, Patient Payment, Payment Methods, and gEstimator.
 *
 * Credit Balance, Payment Plan, Insurance and History used to live here too
 * — they were cut. Insurance in particular is not gone, just not
 * duplicated: Profile > Insurance (chart-profile-billing.js) is now the
 * only place that reads/writes data/profile-billing.js's payers, though
 * gEstimator still reads that same list for its payer dropdown.
 *
 * Every worklist tab uses <ui-data-table>, the same component every other
 * worklist in this app uses.
 *
 * Prior Auth handles medication PAs only — a search box and a
 * "+ New Authorization" modal whose right rail mirrors the patient's own
 * clinical snapshot (vitals, allergies, medications, problem list)
 * read-only — reference: the attached gGastro "New Authorization" screens.
 *
 * gEstimator has no reference screen at all — it is built as an honest,
 * minimal cost estimator (procedure + payer in, a stated estimate out) per
 * that same "say what a real integration would do, rather than fabricate
 * one" rule this app uses everywhere a full backend is out of scope.
 *
 * ctx only provides { patient, age, go, flash }. The module owns every
 * modal and menu it needs, the same contract every other chart module
 * follows.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { PROFILE_BILLING, EMPTY_PROFILE_BILLING } from '../../data/profile-billing.js';
// The New Authorization modal's context rail reads the SAME clinical record
// Profile > Clinical shows — no second, divergent copy of vitals/allergies/
// medications/problems invented here.
import { PROFILE_CLINICAL, EMPTY_PROFILE_CLINICAL } from '../../data/profile-clinical.js';
import {
  CHART_INVOICES,
  EMPTY_CHART_INVOICES,
  CHART_CLAIMS,
  EMPTY_CHART_CLAIMS,
  CHART_LEDGER,
  EMPTY_CHART_LEDGER,
  CHART_PAYMENT_METHODS,
  EMPTY_CHART_PAYMENT_METHODS,
  CHART_PATIENT_PAYMENTS,
  EMPTY_CHART_PATIENT_PAYMENTS,
  CHART_PRIOR_AUTHS,
  EMPTY_CHART_PRIOR_AUTHS,
  AUTH_CATEGORIES,
  PBM_PLANS,
  DISPENSING_PHARMACIES,
  AUTH_DIAGNOSIS_CODES,
} from '../../data/chart-billing.js';
// The estimates this tab lists are gEstimator's output, filed against the
// patient by Profile ▸ Insurance — not a second estimator living here.
import {
  estimateDocument,
  estimateDocuments,
} from '../../data/gestimator.js';
import {
  estimateDocumentMarkup,
  downloadEstimateDocument,
} from '../lib/estimate-document.js';
import { printAsPdf } from '../lib/print-document.js';

/* ============================================================================
   SMALL HELPERS — duplicated rather than shared, matching how every other
   chart module keeps its own tiny date/escape helpers local.
   ========================================================================= */

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

/** "20-02-1961" → { d, m, y } or null. The data file's only date format. */
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

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

function money(value) {
  return value == null ? '—' : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function badge(label, tone) {
  return `<ui-badge status="${tone}" size="sm">${esc(label)}</ui-badge>`;
}

let uid = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${++uid}`;

/* ============================================================================
   TAB DEFINITIONS — order matches the sidebar's reference screens, plus
   gEstimator appended per this build's brief.
   ========================================================================= */

const TABS = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'claims', label: 'Claims' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'prior-auth', label: 'Prior Auth' },
  { value: 'patient-payment', label: 'Patient Payment' },
  /* "Payment Methods" was the label and is now "Cards". Every row on it is a
     card, the dialog behind it asks for a card number, and the tab beside it
     is already called Patient Payment — two tabs whose names both said
     "payment" put the reader one word away from the wrong one. */
  { value: 'payment-methods', label: 'Cards' },
  { value: 'gestimator', label: 'gEstimator' },
];

/* ============================================================================
   INVOICE
   ========================================================================= */

const INVOICE_STATUS_TONE = { Sent: 'info', Paid: 'success', Partial: 'warning', Overdue: 'critical', Blocked: 'neutral' };

const INVOICE_COLUMNS = [
  { key: 'id', label: 'Invoice #' },
  { key: 'invoiceDate', label: 'Invoice Date', render: (r) => formatDate(r.invoiceDate) },
  { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
  { key: 'amount', label: 'Amount', numeric: true, render: (r) => money(r.amount) },
  { key: 'paid', label: 'Paid', numeric: true, render: (r) => money(r.paid) },
  { key: 'balance', label: 'Balance', numeric: true, render: (r) => money(r.amount - r.paid) },
  { key: 'status', label: 'Status', render: (r) => badge(r.status, INVOICE_STATUS_TONE[r.status] || 'neutral') },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (r) => rowActionButton('inv-menu', r.id, 'Invoice actions'),
  },
];

/* ============================================================================
   CLAIMS
   ========================================================================= */

const CLAIM_STATUS_TONE = { Ready: 'info', Denied: 'critical', Paid: 'success', Rejected: 'warning', Submitted: 'neutral' };

const CLAIMS_COLUMNS = [
  { key: 'id', label: 'Claim #' },
  { key: 'provider', label: 'Provider' },
  { key: 'dos', label: 'DOS', render: (r) => formatDate(r.dos) },
  { key: 'payer', label: 'Payer' },
  { key: 'location', label: 'Location' },
  { key: 'allowedAmount', label: 'Allowed Amount', numeric: true, render: (r) => money(r.allowedAmount) },
  { key: 'insurancePaid', label: 'Insurance Paid', numeric: true, render: (r) => money(r.insurancePaid) },
  { key: 'ptResp', label: 'Pt Resp', numeric: true, render: (r) => money(r.ptResp) },
  { key: 'status', label: 'Status', render: (r) => badge(r.status, CLAIM_STATUS_TONE[r.status] || 'neutral') },
  { key: 'tflDays', label: 'TFL (Days)', numeric: true },
  { key: 'lastActivity', label: 'Last Activity', render: (r) => formatDate(r.lastActivity) },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (r) => rowActionButton('claim-menu', r.id, 'Claim actions'),
  },
];

/* ============================================================================
   LEDGER
   ========================================================================= */

const LEDGER_COLUMNS = [
  { key: 'encounter', label: 'Encounter #' },
  { key: 'dos', label: 'DOS', render: (r) => formatDate(r.dos) },
  { key: 'payer', label: 'Payer' },
  { key: 'cpt', label: 'CPT' },
  { key: 'location', label: 'Location' },
  { key: 'dx', label: 'Dx' },
  { key: 'copay', label: 'Copay', numeric: true, render: (r) => money(r.copay) },
  { key: 'flagged', label: 'Flag', render: (r) => (r.flagged ? 'Y' : 'N') },
  { key: 'charges', label: 'Charges', numeric: true, render: (r) => money(r.charges) },
  { key: 'adjust', label: 'Adjust', numeric: true, render: (r) => money(r.adjust) },
  { key: 'payment', label: 'Payment', numeric: true, render: (r) => money(r.payment) },
  { key: 'balance', label: 'Balance', numeric: true, render: (r) => money(r.balance) },
  { key: 'status', label: 'Status', render: (r) => badge(r.status, INVOICE_STATUS_TONE[r.status] || 'neutral') },
];

/* ============================================================================
   PAYMENT METHODS
   ========================================================================= */

const PAYMENT_METHOD_COLUMNS = [
  { key: 'label', label: 'Card' },
  { key: 'type', label: 'Type' },
  { key: 'expires', label: 'Expires' },
  { key: 'isDefault', label: 'Default', render: (r) => (r.isDefault ? badge('Default', 'brand') : '—') },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (r) => rowActionButton('pm-menu', r.id, 'Card actions'),
  },
];

/* ============================================================================
   ADDING A CARD

   The number is never stored, here or anywhere: what a practice keeps is the
   last four digits and a token from the processor. So the dialog takes a full
   number to identify the card and immediately reduces it — which is also why
   there is no "edit card". A card is replaced, not amended.
   ========================================================================= */

const CARD_BRANDS = [
  { id: 'visa', label: 'Visa', test: /^4/ },
  { id: 'mastercard', label: 'Mastercard', test: /^5[1-5]|^2[2-7]/ },
  { id: 'amex', label: 'American Express', test: /^3[47]/ },
  { id: 'discover', label: 'Discover', test: /^6(?:011|5)/ },
];

/** Brand from the leading digits, the way a terminal reads it off the strip. */
function brandOf(digits) {
  return CARD_BRANDS.find((brand) => brand.test.test(digits))?.label ?? 'Card';
}

/**
 * Luhn.
 *
 * Not security — it is the check digit every card carries, and it catches the
 * transposed pair that is the commonest way a sixteen-digit number gets typed
 * wrong. Failing it at the desk beats failing it at the processor a week later
 * when the patient is no longer standing there.
 */
function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

/** "09-2028" → true while that month has not finished. */
function expiryIsFuture(month, year, today = new Date()) {
  const m = Number(month);
  const y = Number(year);
  if (!m || !y || m < 1 || m > 12) return false;
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);
  return endOfMonth >= today;
}

/* ============================================================================
   PATIENT PAYMENT
   ========================================================================= */

const PATIENT_PAYMENT_COLUMNS = [
  { key: 'encounter', label: 'Encounter #' },
  { key: 'method', label: 'Payment Method' },
  { key: 'type', label: 'Payment Type' },
  { key: 'processedDate', label: 'Processed Date', render: (r) => `${formatDate(r.processedDate)}, ${esc(r.processedTime)}` },
  { key: 'amount', label: 'Amount', numeric: true, render: (r) => money(r.amount) },
  { key: 'reconciled', label: 'Reconciled', render: (r) => (r.reconciled ? badge('Yes', 'success') : badge('No', 'neutral')) },
  { key: 'status', label: 'Status', render: (r) => badge(r.status, 'success') },
];

/* ============================================================================
   PRIOR AUTH
   ========================================================================= */

const AUTH_STATUS_TONE = { Approved: 'success', Pending: 'warning', Denied: 'critical' };

function priorAuthColumns() {
  return [
    { key: 'id', label: 'Auth #' },
    { key: 'drug', label: 'Drug' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'sentTo', label: 'Sent to' },
    { key: 'provider', label: 'Provider' },
    { key: 'submitted', label: 'Submitted', render: (r) => formatDate(r.submitted) },
    { key: 'effectiveTill', label: 'Effective Till', render: (r) => formatDate(r.effectiveTill) },
    { key: 'status', label: 'Status', render: (r) => badge(r.status, AUTH_STATUS_TONE[r.status] || 'neutral') },
    {
      key: 'menu',
      label: '<span class="u-sr-only">Actions</span>',
      actions: true,
      render: (r) => rowActionButton('auth-menu', r.id, 'Authorization actions'),
    },
  ];
}

/* ============================================================================
   SHARED ROW-ACTION BUTTON — same "⋮" shape every worklist in this app uses.
   ========================================================================= */

function rowActionButton(attr, id, label) {
  return `<button type="button" class="ui-row-menu-btn" data-${attr}="${id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${label}">
      ${icon('more-vertical')}
    </button>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

/**
 * The head's action slot for one tab. It lives out here rather than in
 * render() because the shell asks for the opening set before render() has
 * run — syncHead() swaps it for the rest.
 *
 * Only two of the seven tabs act on anything: Prior Auth adds an
 * authorisation (and is long enough to need a search over it), and Cards adds
 * a card. The other five are records to read, and an empty slot is the honest
 * answer for them.
 */
function tabActions(tab) {
  if (tab === 'prior-auth') {
    return `<ui-input class="ord__search" size="sm" icon="search" label="Search authorizations"
        label-hidden placeholder="Search" data-testid="chart--auth-search"></ui-input
      ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-authorization"
        >New Authorization</ui-button
      >`;
  }
  if (tab === 'payment-methods') {
    return `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-card"
      >Add Card</ui-button>`;
  }
  return '';
}

registerModule('billing', {
  /* The sidebar's open row already says Billing, and the tab lit beside it
     names the view you are in; a third "Billing" on the same row is a word
     the eye steps over on the way to the switch. hideTitle takes it off the
     screen without taking it out of the document — the h2 is still there for
     a screen reader and for the outline, and because .u-sr-only is absolutely
     positioned it is not a flex item, so the strip starts at the panel's own
     left edge rather than one gap in from it. Same arrangement as Orders,
     Appointments and Profile. */
  hideTitle: true,

  /* The billing switch sits in the module head, where the heading would have
     been drawn and ahead of the actions — the slot the shell reserves for a
     module's own view switch, so it is at the same height here as in Orders,
     Tasks and Prescriptions. */
  tabs: () =>
    `<ui-tabs primary selected="invoice" data-testid="chart--billing-tabs">
      ${TABS.map((t) => `<ui-tab value="${t.value}" label="${t.label}"></ui-tab>`).join('')}
    </ui-tabs>`,

  /* What a tab adds to follows the strip up onto the head row, where every
     other module keeps its whole-module action. Which buttons those are
     depends on the open tab, so this is only the opening set — see
     syncHead(). */
  actions: () => tabActions('invoice'),

  render(host, ctx) {
    const mrn = ctx.patient.mrn;
    // Copied rather than mutated in place — same reasoning as every other
    // chart module: re-rendering must not carry state from a previous visit.
    const data = {
      invoices: [...(CHART_INVOICES[mrn] || EMPTY_CHART_INVOICES)],
      claims: [...(CHART_CLAIMS[mrn] || EMPTY_CHART_CLAIMS)],
      ledger: [...(CHART_LEDGER[mrn] || EMPTY_CHART_LEDGER)],
      paymentMethods: [...(CHART_PAYMENT_METHODS[mrn] || EMPTY_CHART_PAYMENT_METHODS)],
      patientPayments: [...(CHART_PATIENT_PAYMENTS[mrn] || EMPTY_CHART_PATIENT_PAYMENTS)],
      priorAuths: [...(CHART_PRIOR_AUTHS[mrn] || EMPTY_CHART_PRIOR_AUTHS)],
      // Not duplicated — same list Profile > Insurance reads, kept here only
      // for gEstimator's payer dropdown.
      payers: PROFILE_BILLING[mrn]?.payers || EMPTY_PROFILE_BILLING.payers,
      // Read-only context for the New Authorization modal — same record
      // Profile > Clinical shows, not a second copy.
      clinical: PROFILE_CLINICAL[mrn] || EMPTY_PROFILE_CLINICAL,
    };

    // The only prior-auth category left — see data/chart-billing.js.
    const AUTH_CATEGORY = AUTH_CATEGORIES[0].value;

    /* The strip and the tab's own action are the shell's markup, rendered into
       the module head — a sibling of this host, not a child of it. Both the
       events they fire and the selection this module keeps current are
       addressed there. */
    const head = host.parentElement;

    const state = {
      tab: 'invoice',
      authSearch: '',
      /** Which saved estimate is open as a document; null = the list. */
      estimateId: null,
    };

    /* --- Derived -------------------------------------------------------- */

    function visibleAuths() {
      let list = data.priorAuths.filter((a) => a.category === AUTH_CATEGORY);
      if (state.authSearch) {
        const q = state.authSearch.toLowerCase();
        list = list.filter((a) => a.drug.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
      }
      return list;
    }

    /* --- Panels ----------------------------------------------------------- */

    function panel(value, innerHtml) {
      return `<div id="panel-${value}" role="tabpanel" class="bl__panel" ${
        value === state.tab ? '' : 'hidden'
      }>${innerHtml}</div>`;
    }

    function simpleTablePanel(value, testid, emptyText) {
      return panel(value, `<ui-data-table empty-text="${esc(emptyText)}" data-testid="${testid}"></ui-data-table>`);
    }

    /* Its own panel rather than simpleTablePanel: this is the one billing list
       the desk ADDS to, so it needs the action beside the table. */
    function cardsPanel() {
      return panel(
        'payment-methods',
        `<div class="bl__auth-toolbar">
          <h3 class="bl__auth-toolbar-title">Cards on file</h3>
        </div>
        <ui-data-table empty-text="No cards on file." data-testid="chart--payment-methods-table"></ui-data-table>`
      );
    }

    function cardFormMarkup() {
      const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
      const thisYear = new Date().getFullYear();
      const years = Array.from({ length: 12 }, (_, i) => String(thisYear + i));

      return `<div class="bl__card-form">
        <ui-input class="bl__card-wide" label="Name on card" required
          data-testid="chart--card-name"></ui-input>

        <!-- The number is used to identify the card and then reduced to its
             last four. Nothing here keeps it. -->
        <ui-input class="bl__card-wide" label="Card number" required
          placeholder="0000 0000 0000 0000" inputmode="numeric"
          hint="Only the last four digits are kept on the record."
          data-testid="chart--card-number"></ui-input>

        <div class="bl__card-expiry">
          <ui-select label="Expiry month" required data-testid="chart--card-month">
            <option value=""></option>
            ${months.map((m) => `<option value="${m}">${m}</option>`).join('')}
          </ui-select>
          <ui-select label="Expiry year" required data-testid="chart--card-year">
            <option value=""></option>
            ${years.map((y) => `<option value="${y}">${y}</option>`).join('')}
          </ui-select>
        </div>

        <!-- Not stored either — it is the one field a processor forbids
             keeping — but it is what proves the card is in the room. -->
        <ui-input label="Security code" required placeholder="123" inputmode="numeric"
          data-testid="chart--card-cvc"></ui-input>

        <div class="bl__card-default">
          <ui-checkbox data-testid="chart--card-default">Make this the default card</ui-checkbox>
        </div>

        <p class="bl__card-error" id="blCardError" role="alert" hidden
          data-testid="chart--card-error"></p>
      </div>

      <div class="ui-modal__actions">
        <ui-button variant="outline" data-modal-dismiss data-testid="chart--card-cancel"
          >Cancel</ui-button>
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" data-testid="chart--card-save">Add card</ui-button>
      </div>`;
    }

    function priorAuthPanel() {
      // Medication PA is the only category now — a search box and the New
      // Authorization action, no category tabs to choose between.
      return panel(
        'prior-auth',
        `<div class="bl__auth-toolbar">
          <h3 class="bl__auth-toolbar-title">${esc(AUTH_CATEGORIES[0].label)}</h3>
        </div>
        <ui-data-table empty-text="No authorizations on file." data-testid="chart--auth-table"></ui-data-table>`
      );
    }

    /* --- gEstimator: the estimates on file ---------------------------------
       The estimator itself ran from Profile ▸ Insurance, off a stored
       eligibility response — that section left the sidebar on 21 Aug 2026, so
       no new full estimates are produced in the prototype for now and this
       tab lists the ones already on file plus its own Quick estimate. What lands HERE is its output: the documents. A
       patient asking "what were we told this would cost?" is asking for the
       record, and the record belongs with the rest of their billing.

       A patient accumulates several — different days, different plans, run
       different ways — so this is a list, and each row opens the document as
       it was saved. Read-only: see js/lib/estimate-document.js. */

    function estimateCardMarkup(doc) {
      const due = doc.result.anyApplied
        ? `<span class="bl__est-due">${money(doc.result.patientOwes)} due</span>`
        : '<span class="bl__est-due bl__est-due--pending">Not calculated</span>';

      const codes = doc.lines.map((line) => line.code).join(', ');

      return `<article class="bl__est-card" data-testid="chart--est-card">
        <div class="bl__est-main">
          <p class="bl__est-title">
            <button type="button" class="bl__est-open" data-est-open="${esc(doc.id)}"
              data-testid="chart--est-open">Estimate #${esc(doc.estimateNumber)}</button>
            ${
              doc.sentToPortal
                ? '<ui-badge status="info" size="sm">Sent to portal</ui-badge>'
                : ''
            }
          </p>
          <p class="bl__est-meta">
            ${esc(doc.insurance.payer)} · DOS ${esc(doc.encounter.scheduledDos)} ·
            ${esc(codes)} · ${esc(doc.rateBasis)}
          </p>
          <p class="bl__est-meta bl__est-meta--faint">
            Saved ${esc(doc.savedAt)} by ${esc(doc.savedBy)} · Elig ID ${esc(doc.eligibilityId)}
          </p>
        </div>
        <div class="bl__est-figures">
          <span class="bl__est-allowed">${money(doc.totalAllowed)} allowed</span>
          ${due}
        </div>
        <div class="bl__est-actions">
          <ui-button variant="outline" size="sm" data-est-view="${esc(doc.id)}"
            data-testid="chart--est-view">View</ui-button>
          <ui-button variant="tertiary" size="sm" icon="download" data-est-download="${esc(doc.id)}"
            data-testid="chart--est-download">Download</ui-button>
        </div>
      </article>`;
    }

    function estimateListMarkup() {
      const docs = estimateDocuments(mrn);

      if (!docs.length) {
        return `<div class="bl__est-empty" data-testid="chart--est-empty">
          <p>No estimates on file for this patient.</p>
        </div>`;
      }

      return `<div class="bl__est-list" data-testid="chart--est-list">
        ${docs.map(estimateCardMarkup).join('')}
      </div>`;
    }

    function estimateDocumentView() {
      const doc = estimateDocument(mrn, state.estimateId);
      if (!doc) return estimateListMarkup();

      return `<div class="bl__est-doc">
        <div class="bl__est-doc-bar">
          <button type="button" class="bl__est-back" data-est-back
            data-testid="chart--est-back">${icon('caret-left')} All estimates</button>
          <span class="bl__spacer"></span>
          <ui-button variant="outline" size="sm" icon="download" data-est-download="${esc(doc.id)}"
            data-testid="chart--est-doc-download">Download</ui-button>
          <ui-button variant="outline" size="sm" icon="printer" data-est-print
            data-testid="chart--est-print">Print</ui-button>
        </div>
        ${estimateDocumentMarkup(doc)}
      </div>`;
    }

    function gestimatorPanel() {
      return panel(
        'gestimator',
        `<div class="bl__gestimator">
          ${
            state.estimateId
              ? estimateDocumentView()
              : `<div class="bl__est-head">
                   <h3 class="bl__est-heading">Estimates on file</h3>
                 </div>
                 ${estimateListMarkup()}

                 <div class="bl__est-quick">
                   <h3 class="bl__est-heading">Quick estimate</h3>
                   <div class="bl__gestimator-form">
                     <ui-select label="Procedure" options="Office Visit — Established,Office Visit — New,Colonoscopy,Upper Endoscopy (EGD),Lab Panel"
                       data-testid="chart--gest-procedure"></ui-select>
                     <ui-select label="Insurance / Payer" options="${data.payers.map((p) => esc(p.name)).concat('Self-pay').join(',')}"
                       data-testid="chart--gest-payer"></ui-select>
                     <ui-button variant="primary" data-testid="chart--gest-estimate">Estimate Cost</ui-button>
                   </div>
                   <div id="blGestResult" class="bl__gestimator-result" hidden></div>
                   <p class="bl__gestimator-note">
                     This is a rough estimate based on typical allowed amounts — it is not a claim
                     adjudication and does not check this patient's real benefits or deductible.
                     The documents above are the ones that do.
                   </p>
                 </div>`
          }
        </div>`
      );
    }

    /* --- Paint -------------------------------------------------------------- */

    /**
     * The module head, on every paint: the strip's selection, and the actions
     * belonging to whichever tab is open.
     *
     * The actions are only rewritten when the tab actually changed. A modal
     * remembers the button that opened it so it can hand focus back on close,
     * and rebuilding that button on every repaint would leave the modal
     * holding a node that is no longer in the document.
     */
    function syncHead() {
      head?.querySelector('[data-testid="chart--billing-tabs"]')?.setAttribute('selected', state.tab);

      const actions = head?.querySelector('.ch__module-actions');
      if (actions && actions.dataset.tab !== state.tab) {
        actions.dataset.tab = state.tab;
        actions.innerHTML = tabActions(state.tab);
      }
    }

    function paint() {
      syncHead();

      host.innerHTML = `${simpleTablePanel('invoice', 'chart--invoice-table', 'No invoices on file.')}
        ${simpleTablePanel('claims', 'chart--claims-table', 'No claims on file.')}
        ${simpleTablePanel('ledger', 'chart--ledger-table', 'No ledger entries on file.')}
        ${priorAuthPanel()}
        ${simpleTablePanel('patient-payment', 'chart--patient-payment-table', 'No patient payments on file.')}
        ${cardsPanel()}
        ${gestimatorPanel()}

        <ui-modal id="blAuthModal" heading="New Authorization" size="xl">
          ${authFormMarkup()}
        </ui-modal>

        <ui-modal id="blCardModal" heading="Add card" size="md">
          ${cardFormMarkup()}
        </ui-modal>`;

      fillTable('chart--invoice-table', INVOICE_COLUMNS, data.invoices);
      fillTable('chart--claims-table', CLAIMS_COLUMNS, data.claims);
      fillTable('chart--ledger-table', LEDGER_COLUMNS, data.ledger);
      fillTable('chart--auth-table', priorAuthColumns(), visibleAuths());
      fillTable('chart--patient-payment-table', PATIENT_PAYMENT_COLUMNS, data.patientPayments);
      fillTable('chart--payment-methods-table', PAYMENT_METHOD_COLUMNS, data.paymentMethods);
    }

    function fillTable(testid, columns, rows) {
      const table = host.querySelector(`[data-testid="${testid}"]`);
      if (!table) return;
      table.columns = columns;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    /* --- New Authorization modal --------------------------------------------
       Reference: the attached "New Authorization" screens — a form on the
       left, and the patient's own clinical snapshot, read-only, on the
       right. The snapshot reads the same profile-clinical data Profile >
       Clinical already shows, rather than a second copy invented here. */

    function authFormMarkup() {
      return `<div class="bl__auth-form-grid">
        <div class="bl__auth-form">
          <div class="bl__auth-patient-banner">
            <strong>${esc(ctx.patient.name)}</strong>
            ${ctx.age != null && ctx.age < 18 ? `<ui-badge status="warning" size="sm">Minor</ui-badge>` : ''}
            <span class="bl__muted">#${esc(ctx.patient.mrn)}</span>
          </div>

          <div class="bl__auth-field-grid">
            <ui-select label="PBM/Plan" options="${PBM_PLANS.join(',')}" data-testid="chart--auth-pbm"></ui-select>
            <ui-select label="Dispensing Pharmacy" options="${DISPENSING_PHARMACIES.join(',')}" data-testid="chart--auth-pharmacy"></ui-select>

            <ui-input label="Drug" placeholder="Search drug" data-testid="chart--auth-drug" class="bl__auth-field--wide"></ui-input>
            <ui-button variant="outline" size="sm" data-testid="chart--auth-check-coverage" class="bl__auth-check-coverage"
              >Check Coverage</ui-button
            >

            <ui-input label="Quantity" type="number" placeholder="e.g. 1" data-testid="chart--auth-quantity"></ui-input>
            <ui-select label="Days Supply" options="7,14,30,60,90" data-testid="chart--auth-days-supply"></ui-select>
            <ui-select label="Refills" options="0,1,2,3,6,12" data-testid="chart--auth-refills"></ui-select>

            <ui-select label="Prescriber" options="Dr. Amara Mensah,Dr. Luca Bianchi,Dr. Sana Nakamura" data-testid="chart--auth-prescriber"></ui-select>
            <ui-select label="Diagnosis Code (ICD-10)" options="${AUTH_DIAGNOSIS_CODES.join(',')}" data-testid="chart--auth-diagnosis"></ui-select>

            <ui-input label="Submitted Date" type="date" value="${isoOf(todayDdMmYyyy())}" data-testid="chart--auth-submitted"></ui-input>
            <ui-input label="Effective From" type="date" data-testid="chart--auth-effective-from"></ui-input>
            <ui-input label="Effective Till" type="date" data-testid="chart--auth-effective-till"></ui-input>

            <ui-input label="Payer Auth#" data-testid="chart--auth-payer-authno"></ui-input>
            <ui-input label="Call Ref#" data-testid="chart--auth-call-ref"></ui-input>

            <ui-input label="Approved Visits" type="number" data-testid="chart--auth-approved-visits"></ui-input>
            <ui-select label="Authorized by" options="Dr. Amara Mensah,Dr. Luca Bianchi,Dr. Sana Nakamura" data-testid="chart--auth-authorized-by"></ui-select>

            <ui-select label="Insurance" options="${PBM_PLANS.join(',')}" data-testid="chart--auth-insurance"></ui-select>
            <ui-input label="Member ID" data-testid="chart--auth-member-id"></ui-input>

            <ui-input label="RX BIN" data-testid="chart--auth-rx-bin"></ui-input>
            <ui-input label="RX PCN" data-testid="chart--auth-rx-pcn"></ui-input>
            <ui-input label="RX Group ID" data-testid="chart--auth-rx-group"></ui-input>
            <ui-input label="Member ID" data-testid="chart--auth-rx-member-id"></ui-input>

            <ui-input label="Step Therapy / Prior Trials" class="bl__auth-field--wide" data-testid="chart--auth-step-therapy"></ui-input>

            <ui-textarea label="Clinical Notes" rows="3" placeholder="Enter note…" class="bl__auth-field--wide"
              data-testid="chart--auth-clinical-notes"></ui-textarea>
          </div>

          <button type="button" class="bl__auth-attach" data-testid="chart--auth-attach">
            ${icon('upload')} Add Attachment
          </button>
        </div>

        <aside class="bl__auth-context">
          ${authContextMarkup()}
        </aside>
      </div>

      <div slot="footer">
        <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--auth-cancel">Cancel</ui-button>
        <ui-button variant="outline" data-testid="chart--auth-save-draft">Save as Draft</ui-button>
        <ui-button variant="primary" data-testid="chart--auth-submit">Submit Authorization</ui-button>
      </div>`;
    }

    /** Read-only clinical snapshot — same record Profile > Clinical shows. */
    function authContextMarkup() {
      const { vitals, allergies, medications, problems } = data.clinical;
      return `<section class="bl__ctx-card">
          <h4>Vitals</h4>
          ${
            vitals.length
              ? `<ul>${vitals.map((v) => `<li>${esc(v.label)} – ${esc(v.value)}</li>`).join('')}</ul>`
              : `<p class="bl__ctx-empty">No vitals on file.</p>`
          }
        </section>
        <section class="bl__ctx-card">
          <h4>Active Allergies</h4>
          ${
            allergies.length
              ? `<ul>${allergies.map((a) => `<li>${esc(a.substance)} — ${esc(a.reaction)}</li>`).join('')}</ul>`
              : `<p class="bl__ctx-empty">No known allergies.</p>`
          }
        </section>
        <section class="bl__ctx-card">
          <h4>Current Medications</h4>
          ${
            medications.length
              ? `<ul>${medications.map((m) => `<li>${esc(m.name)} ${esc(m.dose)}</li>`).join('')}</ul>`
              : `<p class="bl__ctx-empty">No active medications.</p>`
          }
        </section>
        <section class="bl__ctx-card">
          <h4>Problem List</h4>
          ${
            problems.length
              ? `<ul>${problems.map((p) => `<li>${esc(p.code)} • ${esc(p.label)}</li>`).join('')}</ul>`
              : `<p class="bl__ctx-empty">No problems recorded.</p>`
          }
        </section>`;
    }

    /* --- Actions -------------------------------------------------------------- */

    function saveAuth() {
      const modal = host.querySelector('#blAuthModal');
      const field = (testid) => modal.querySelector(`[data-testid="${testid}"]`)?.value;
      const drug = field('chart--auth-drug')?.trim();

      if (!drug) {
        modal.querySelector('[data-testid="chart--auth-drug"]')?.setAttribute('error', 'Enter a drug.');
        return;
      }

      data.priorAuths.unshift({
        id: nextId('MPA'),
        category: AUTH_CATEGORY,
        drug,
        pharmacy: field('chart--auth-pharmacy') || DISPENSING_PHARMACIES[0],
        sentTo: field('chart--auth-insurance') || PBM_PLANS[0],
        provider: field('chart--auth-prescriber') || ctx.patient.provider?.name || 'Dr. Amara Mensah',
        submitted: todayDdMmYyyy(),
        effectiveTill: field('chart--auth-effective-till') ? fromIso(field('chart--auth-effective-till')) : '—',
        status: 'Pending',
      });

      modal.close();
      paint();
      ctx.flash('Authorization submitted and awaiting payer response.', 'success');
    }

    function fromIso(iso) {
      const [y, m, d] = String(iso).split('-');
      return y && m && d ? `${d}-${m}-${y}` : '—';
    }

    const PROCEDURE_ESTIMATES = {
      'Office Visit — Established': 145,
      'Office Visit — New': 220,
      Colonoscopy: 1850,
      'Upper Endoscopy (EGD)': 1400,
      'Lab Panel': 95,
    };

    function estimateCost() {
      const procedure = host.querySelector('[data-testid="chart--gest-procedure"]')?.value;
      const payerName = host.querySelector('[data-testid="chart--gest-payer"]')?.value;
      const result = host.querySelector('#blGestResult');
      if (!procedure || !payerName) {
        ctx.flash('Choose a procedure and a payer to estimate.', 'warning');
        return;
      }

      const billed = PROCEDURE_ESTIMATES[procedure] ?? 150;
      const isSelfPay = payerName === 'Self-pay';
      const patientShare = isSelfPay ? billed : Math.round(billed * 0.25);

      result.hidden = false;
      result.innerHTML = `<p><strong>Estimated charge:</strong> ${money(billed)}</p>
        <p><strong>Estimated ${isSelfPay ? 'self-pay total' : 'patient responsibility'}:</strong> ${money(
          patientShare
        )}</p>`;
    }

    /* --- Wiring ----------------------------------------------------------- */


    /* --- Adding a card ------------------------------------------------------ */

    const cardField = (name) => host.querySelector(`[data-testid="chart--card-${name}"]`);

    function openCardDialog(trigger) {
      for (const name of ['name', 'number', 'month', 'year', 'cvc']) {
        const node = cardField(name);
        node?.removeAttribute('error');
        node?.setAttribute('value', '');
      }
      const box = cardField('default')?.querySelector('input');
      // The first card on an empty record is the default by definition — there
      // is nothing else for a payment to fall back to.
      if (box) box.checked = data.paymentMethods.length === 0;

      const error = host.querySelector('#blCardError');
      if (error) error.hidden = true;

      host.querySelector('#blCardModal')?.open(trigger);
    }

    function saveCard() {
      const name = (cardField('name')?.value || '').trim();
      const digits = (cardField('number')?.value || '').replace(/\D/g, '');
      const month = cardField('month')?.value || '';
      const year = cardField('year')?.value || '';
      const cvc = (cardField('cvc')?.value || '').replace(/\D/g, '');

      let valid = true;
      const fail = (which, message) => {
        cardField(which)?.setAttribute('error', message);
        valid = false;
      };
      const pass = (which) => cardField(which)?.removeAttribute('error');

      if (!name) fail('name', 'Enter the name printed on the card');
      else pass('name');

      /* Two different failures, said differently: a short number is unfinished
         typing, a number that fails its check digit is a real mistake. */
      if (!digits) fail('number', 'Enter the card number');
      else if (digits.length < 13) fail('number', 'That number is too short');
      else if (!passesLuhn(digits)) fail('number', 'Check that number — a digit looks wrong');
      else pass('number');

      if (!month || !year) fail(month ? 'year' : 'month', 'Set the expiry');
      else if (!expiryIsFuture(month, year)) fail('month', 'That card has expired');
      else {
        pass('month');
        pass('year');
      }

      if (cvc.length < 3) fail('cvc', 'Enter the code from the back of the card');
      else pass('cvc');

      const error = host.querySelector('#blCardError');
      if (!valid) {
        if (error) {
          error.textContent = 'Check the fields marked above.';
          error.hidden = false;
        }
        return;
      }
      if (error) error.hidden = true;

      const makeDefault = cardField('default')?.querySelector('input')?.checked ?? false;
      // First card wins by default whatever the box says: a record with cards
      // and no default has no answer to "charge the card on file".
      const isDefault = makeDefault || data.paymentMethods.length === 0;

      if (isDefault) {
        for (const method of data.paymentMethods) method.isDefault = false;
      }

      data.paymentMethods.push({
        id: `PM-${data.paymentMethods.length + 1}-${digits.slice(-4)}`,
        type: 'Card',
        // The number is reduced here and the full one is never held: what a
        // practice keeps is the last four and a processor token.
        label: `${brandOf(digits)} •••• ${digits.slice(-4)}`,
        expires: `${month}-${year}`,
        nameOnCard: name,
        isDefault,
      });

      host.querySelector('#blCardModal')?.close();
      paint();
      ctx.flash(`${brandOf(digits)} ending ${digits.slice(-4)} added.`, 'success');
    }

    function setDefaultCard(id) {
      for (const method of data.paymentMethods) method.isDefault = method.id === id;
      paint();
      const card = data.paymentMethods.find((m) => m.id === id);
      ctx.flash(`${card?.label ?? 'Card'} is now the default.`, 'success');
    }

    function removeCard(id) {
      const at = data.paymentMethods.findIndex((m) => m.id === id);
      if (at < 0) return;
      const [gone] = data.paymentMethods.splice(at, 1);

      /* Removing the default leaves the record with cards and nothing to
         charge, so the next one inherits it rather than nobody holding it. */
      if (gone.isDefault && data.paymentMethods.length) {
        data.paymentMethods[0].isDefault = true;
      }

      paint();
      ctx.flash(`${gone.label} removed.`, 'success');
    }

    function onClick(event) {
      /* A card has no detail behind it — the record IS the last four, the
         expiry and whether it is the default — so its menu offers the two
         things that can actually be done to one instead. */
      const cardTrigger = event.target.closest('[data-pm-menu]');
      if (cardTrigger) {
        const card = data.paymentMethods.find((m) => m.id === cardTrigger.dataset.pmMenu);
        openRowMenu(cardTrigger, [
          ...(card?.isDefault
            ? []
            : [
                {
                  label: 'Make default',
                  icon: 'star',
                  run: () => setDefaultCard(cardTrigger.dataset.pmMenu),
                },
              ]),
          {
            label: 'Remove card',
            icon: 'trash',
            danger: true,
            run: () => removeCard(cardTrigger.dataset.pmMenu),
          },
        ]);
        return;
      }

      const menuTrigger = event.target.closest(
        '[data-inv-menu], [data-claim-menu], [data-auth-menu]'
      );
      if (menuTrigger) {
        openRowMenu(menuTrigger, [
          {
            label: 'View detail',
            icon: 'eye',
            run: () => ctx.flash("This record's full detail isn't viewable in this prototype yet."),
          },
        ]);
        return;
      }

      if (event.target.closest('[data-testid="chart--add-authorization"]')) {
        host.querySelector('#blAuthModal')?.open(event.target.closest('ui-button'));
        return;
      }

      if (event.target.closest('[data-testid="chart--add-card"]')) {
        openCardDialog(event.target.closest('ui-button'));
        return;
      }
      if (event.target.closest('[data-testid="chart--card-save"]')) {
        saveCard();
        return;
      }
      if (event.target.closest('[data-testid="chart--auth-check-coverage"]')) {
        ctx.flash('Coverage check requires a live payer connection, not available in this prototype.');
        return;
      }
      if (event.target.closest('[data-testid="chart--auth-attach"]')) {
        ctx.flash('Attaching files requires a document store, not available in this prototype.');
        return;
      }
      if (event.target.closest('[data-testid="chart--auth-save-draft"]')) {
        host.querySelector('#blAuthModal')?.close();
        ctx.flash('Authorization saved as a draft.', 'success');
        return;
      }

      if (event.target.closest('[data-testid="chart--gest-estimate"]')) {
        estimateCost();
        return;
      }

      /* --- Saved estimates ------------------------------------------------- */

      const open = event.target.closest('[data-est-open], [data-est-view]');
      if (open) {
        state.estimateId = open.dataset.estOpen || open.dataset.estView;
        paint();
        return;
      }

      if (event.target.closest('[data-est-back]')) {
        state.estimateId = null;
        paint();
        return;
      }

      const download = event.target.closest('[data-est-download]');
      if (download) {
        const doc = estimateDocument(mrn, download.dataset.estDownload);
        if (doc) {
          /* The message goes out BEFORE the dialog, not after. Download is
             print-to-PDF here (js/lib/print-document.js) and window.print()
             blocks the page for as long as the browser's own window is up, so
             a note fired afterwards arrives once the reader has already
             finished with the thing it was reporting on. */
          ctx.flash(
            `Choose “Save as PDF” to download estimate #${doc.estimateNumber}.`,
            'info'
          );
          downloadEstimateDocument(doc, mrn);
        }
        return;
      }

      /* The same sheet Download produces, not the screen behind it. Printing
         the screen printed the whole chart — the module's own bar with Back,
         Download and Print on it included — and left the two buttons on that
         bar disagreeing about what an estimate looks like. See
         js/lib/print-document.js. */
      const print = event.target.closest('[data-est-print]');
      if (print) {
        const doc = estimateDocument(mrn, state.estimateId);
        if (doc) printAsPdf({ markup: estimateDocumentMarkup(doc) });
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--auth-submit"]')) saveAuth();
    }

    function onChange(event) {
      if (event.target.closest('[data-testid="chart--billing-tabs"]')) {
        state.tab = event.detail.value;
        paint();
        return;
      }
      if (event.target.closest('[data-testid="chart--auth-search"]')) {
        state.authSearch = event.detail.value;
        paint();
      }
    }

    /*
     * ONCE PER EVENT, NOT TWICE.
     *
     * The same handlers are bound to the head as well as to the panel: the
     * strip, the search box and the two Add buttons are the shell's markup
     * above this host, and everything they fire is already answered by the
     * branches below.
     *
     * But `head` is host.parentElement — the workspace that CONTAINS both the
     * head and this panel, not the head element beside it. So an event raised
     * inside the panel bubbles through host's listener and then through this
     * one, and every branch below ran for it twice. Nearly all of them are
     * idempotent — a second `paint()` off the same state draws the same panel
     * — which is why nobody noticed. Download is not: it now opens a print
     * dialog, and it opened two.
     *
     * So the head's pass skips anything that came from inside the panel,
     * which host's own listener has already dealt with. The head outlives
     * this module, so its listeners come off again on teardown — the panel's
     * go with the markup they are on.
     */
    const fromAboveThePanel = (handler) => (event) => {
      if (host.contains(event.target)) return;
      handler(event);
    };
    const onHeadClick = fromAboveThePanel(onClick);
    const onHeadChange = fromAboveThePanel(onChange);

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onChange);
    host.addEventListener('ui-input', onChange);
    head?.addEventListener('click', onHeadClick);
    head?.addEventListener('ui-change', onHeadChange);
    head?.addEventListener('ui-input', onHeadChange);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onChange);
      host.removeEventListener('ui-input', onChange);
      head?.removeEventListener('click', onHeadClick);
      head?.removeEventListener('ui-change', onHeadChange);
      head?.removeEventListener('ui-input', onHeadChange);
      closeRowMenu();
    };
  },
});
