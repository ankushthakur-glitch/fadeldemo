/**
 * DEMO DATA for the top-level Billing module (chart section "billing" — the
 * sidebar's last entry, distinct from Profile > Insurance's card grid).
 * Entirely invented — no real patient information.
 *
 * Keyed by MRN, same convention as every other chart data file. Only the
 * primary demo patient (Henna West, 326486) carries a full seeded history
 * across every tab; the rest fall back to EMPTY_* so their tabs render an
 * honest empty state rather than a second copy of the same rows.
 *
 * CHART_ELIGIBILITY_HISTORY lives here rather than in profile-billing.js
 * because it started as this module's own Insurance tab — that tab is gone,
 * but the list is still the one Profile > Insurance (chart-profile-billing.js)
 * reads and writes.
 */

export const CHART_INVOICES = {
  326486: [
    { id: 'INV-2026-0142', invoiceDate: '21-06-2026', dueDate: '21-07-2026', amount: 125, paid: 0, status: 'Sent' },
    { id: 'INV-2026-0138', invoiceDate: '04-04-2026', dueDate: '04-05-2026', amount: 80, paid: 80, status: 'Paid' },
    { id: 'INV-2026-0121', invoiceDate: '27-05-2026', dueDate: '27-06-2026', amount: 240, paid: 100, status: 'Partial' },
    { id: 'INV-2026-0098', invoiceDate: '27-03-2026', dueDate: '27-04-2026', amount: 95, paid: 0, status: 'Overdue' },
  ],
};
export const EMPTY_CHART_INVOICES = [];

export const CHART_CLAIMS = {
  326486: [
    { id: 'CLM-2026-0892', provider: 'Dr. Amara Mensah', dos: '21-06-2026', payer: 'Medicare Part B', location: '1 – Arvada', allowedAmount: 245, insurancePaid: null, ptResp: null, status: 'Ready', tflDays: 78, lastActivity: '21-06-2026' },
    { id: 'CLM-2026-0870', provider: 'Dr. Amara Mensah', dos: '27-05-2026', payer: 'Medicare Part B', location: '1 – Arvada', allowedAmount: 125, insurancePaid: 100, ptResp: 25, status: 'Paid', tflDays: 8, lastActivity: '27-05-2026' },
    { id: 'CLM-2026-0847', provider: 'Dr. Amara Mensah', dos: '27-03-2026', payer: 'Medicare Part B', location: '1 – Arvada', allowedAmount: 185, insurancePaid: null, ptResp: null, status: 'Rejected', tflDays: 42, lastActivity: '27-03-2026' },
  ],
};
export const EMPTY_CHART_CLAIMS = [];

export const CHART_LEDGER = {
  326486: [
    { encounter: 'ENC-21-06-2026', dos: '21-06-2026', payer: 'Self', cpt: '99214', location: '01', dx: 'K21.9', copay: null, flagged: false, charges: 125, adjust: 0, payment: 0, balance: 125, status: 'Sent' },
    { encounter: 'ENC-27-05-2026', dos: '27-05-2026', payer: 'Medicare Part B', cpt: '99214', location: '01', dx: 'E11.9', copay: 25, flagged: false, charges: 125, adjust: 0, payment: 100, balance: 25, status: 'Partial' },
    { encounter: 'ENC-04-04-2026', dos: '04-04-2026', payer: 'Medicare Part B', cpt: '90833', location: '01', dx: 'K57.30', copay: null, flagged: false, charges: 80, adjust: 0, payment: 80, balance: 0, status: 'Paid' },
  ],
};
export const EMPTY_CHART_LEDGER = [];

export const CHART_PAYMENT_METHODS = {
  326486: [
    { id: 'PM-1', type: 'Card', label: 'Visa •••• 4242', expires: '09-2028', isDefault: true },
  ],
};
export const EMPTY_CHART_PAYMENT_METHODS = [];

export const CHART_PATIENT_PAYMENTS = {
  326486: [
    { encounter: 'ENC-27-05-2026', method: 'Visa •••• 4242', type: 'Copay', processedDate: '27-05-2026', processedTime: '10:12 AM', amount: 25, reconciled: true, status: 'Successful' },
    { encounter: 'ENC-04-04-2026', method: 'Visa •••• 4242', type: 'Copay', processedDate: '04-04-2026', processedTime: '09:48 AM', amount: 80, reconciled: false, status: 'Successful' },
  ],
};
export const EMPTY_CHART_PATIENT_PAYMENTS = [];

export const CHART_ELIGIBILITY_HISTORY = {
  326486: [
    { checkedOn: '01-03-2026', payer: 'Medicare Part B', result: 'Active', checkedBy: 'Front desk — Ruth Adeyemi' },
  ],
};
export const EMPTY_CHART_ELIGIBILITY_HISTORY = [];

/* --- Prior Auth ---------------------------------------------------------- */

// Prior Auth handles medication PAs only — Office Visit Auth and Other were
// dropped from the tab, so this is a single-entry list rather than a bare
// string, to keep priorAuthPanel() reading a { value, label } shape.
export const AUTH_CATEGORIES = [{ value: 'medication-pa', label: 'Medication PA' }];

export const CHART_PRIOR_AUTHS = {
  326486: [
    {
      id: 'MPA-241',
      category: 'medication-pa',
      drug: 'Omeprazole 40mg',
      pharmacy: 'CVS #118 – Arvada',
      sentTo: 'Medicare Part B',
      provider: 'Dr. Amara Mensah',
      submitted: '15-01-2026',
      effectiveTill: '15-01-2027',
      status: 'Approved',
    },
    {
      id: 'MPA-256',
      category: 'medication-pa',
      drug: 'Adalimumab 40mg',
      pharmacy: 'GastroEMR GI in-house pharmacy',
      sentTo: 'Medicare Part B',
      provider: 'Dr. Amara Mensah',
      submitted: '20-05-2026',
      effectiveTill: '20-08-2026',
      status: 'Pending',
    },
  ],
};
export const EMPTY_CHART_PRIOR_AUTHS = [];

export const PBM_PLANS = ['Medicare Part B', 'Summit Bridge PPO', 'ND Medicaid Expansion', 'Self-pay'];
export const DISPENSING_PHARMACIES = [
  'CVS #118 – Arvada',
  'GastroEMR GI in-house pharmacy',
  'Walgreens #4421 – Fargo',
  'OptumRx Mail Order',
];
export const AUTH_DIAGNOSIS_CODES = ['K21.9', 'E11.9', 'K57.30', 'I10', 'K44.9'];
