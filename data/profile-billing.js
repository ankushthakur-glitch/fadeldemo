/**
 * DEMO DATA for Profile · Insurance (module id "profile-billing" — kept
 * unchanged so existing routes/testids don't churn; only the sidebar label
 * changed, from "Billing" to "Insurance").
 * Entirely invented — no real patient information.
 *
 * Used to carry aging/episodes/guarantor/authorizations too. Those moved
 * out — the account balance already lives in the header's Patient Balance
 * box (patient.balance in data/patient-chart.js), and authorizations live
 * in the sidebar's own top-level Billing section's Prior Auth tab
 * (data/chart-billing.js) — so payers is the substance of what is left here,
 * and it is the ONE list both Profile · Insurance and Billing's own Insurance
 * tab read, kept in step because there is only one copy.
 *
 * billingGroup sits alongside it: which of the practice's billing entities
 * this patient's charges are raised under — professional, facility,
 * pathology, anaesthesia, or none of them if they self-pay. It was added to
 * the Insurance tab when the client asked for the chart's Billing section to
 * go (RM-014), and it stays here now the section is back, because it belongs
 * beside the coverage: same conversation, same person answering it.
 *
 * Keyed by MRN, same as every other per-patient data file in this chart.
 */

export const PROFILE_BILLING = {
  326486: {
    billingGroup: 'MediNova GI — Professional',
    payers: [
      {
        name: 'Medicare Part B',
        type: 'Primary',
        insuranceType: 'Medicare',
        phone: '800-555-0122',
        policy: 'MB48120556A',
        group: null,
        effective: '01-03-2026',
        expires: null,
        relationship: 'Self',
        subscriberFirst: 'Henna',
        subscriberLast: 'West',
        subscriberDob: '20-02-1961',
        subscriberSex: 'Female',
        subscriberSameAddress: true,
        offCopay: null,
        specCopay: null,
      },
    ],
  },

  // Two policies on file — the demo case for Make Primary: Summit Bridge is
  // Primary today, but Anthem is a real Secondary a front desk could promote.
  326477: {
    billingGroup: 'MediNova GI — Professional',
    payers: [
      {
        name: 'Summit Bridge PPO',
        type: 'Primary',
        insuranceType: 'Commercial',
        phone: '800-555-0187',
        policy: 'SB99204471',
        group: 'GRP-4471',
        effective: '01-01-2025',
        expires: null,
        relationship: 'Self',
        subscriberFirst: 'Natali',
        subscriberLast: 'Craig',
        subscriberDob: null,
        subscriberSex: 'Female',
        subscriberSameAddress: true,
        offCopay: null,
        specCopay: null,
      },
      {
        name: 'Anthem BlueCross Secondary',
        type: 'Secondary',
        insuranceType: 'Commercial',
        phone: '800-555-0163',
        policy: 'ANT773410X',
        group: 'GRP-2209',
        effective: '01-06-2025',
        expires: null,
        relationship: 'Spouse',
        subscriberFirst: 'Jordan',
        subscriberLast: 'Craig',
        subscriberDob: null,
        subscriberSex: 'Male',
        subscriberSameAddress: true,
        offCopay: null,
        specCopay: null,
      },
    ],
  },

  326481: {
    billingGroup: 'Self-pay / Time of service',
    payers: [],
  },

  326495: {
    billingGroup: 'MediNova GI — Facility / ASC',
    payers: [
      {
        name: 'ND Medicaid Expansion',
        type: 'Primary',
        insuranceType: 'Medicaid',
        phone: '800-555-0140',
        policy: 'ND2201558',
        group: null,
        effective: '01-01-2026',
        expires: null,
        relationship: 'Self',
        subscriberFirst: null,
        subscriberLast: null,
        subscriberDob: null,
        subscriberSex: null,
        subscriberSameAddress: true,
        offCopay: null,
        specCopay: null,
      },
    ],
  },
};

export const EMPTY_PROFILE_BILLING = {
  billingGroup: '',
  payers: [],
};
