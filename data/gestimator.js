/**
 * gESTIMATOR — the procedure-level, two-step estimate run off an eligibility
 * response.
 *
 * NOT THE SAME THING AS data/estimator.js. That one prices ONE booking
 * against ONE plan from the scheduler's row menu — a quick "what will this
 * visit cost" for the desk. This is the payer-facing instrument: it starts
 * from a stored eligibility response, takes a line per CPT code with its own
 * provider, units and modifier, and works out what the plan allows for each
 * before any patient responsibility is applied. They answer different
 * questions and are deliberately not merged; money() is shared because the
 * formatting must match wherever a dollar figure appears.
 *
 * WHY THE ESTIMATE IS BUILT FROM THE ALLOWED AMOUNT
 * A charge is what the clinic bills. The ALLOWED amount is what the plan has
 * contracted to recognise, and everything the patient owes comes off that.
 * Estimating from the charge is the most common way a good-faith estimate
 * comes out several times too high.
 *
 * WHY COVERAGE OPTIONS ARE OPT-IN
 * The deductible, coinsurance and copay rows come from the eligibility
 * response, and the response is frequently incomplete or stale — a
 * deductible "remaining" figure can be weeks behind. So each is APPLIED by
 * the person running the estimate rather than assumed, and the total says so
 * until they choose. An estimate that silently applies a $0.00-remaining
 * deductible reads as authoritative when it is a guess.
 *
 * Every plan, rate and amount below is invented. No real patient
 * information, and nothing here is a real good-faith estimate.
 */
import { money } from './estimator.js';

export { money };

/* ============================================================================
   VOCABULARY
   ========================================================================= */

/** Place of service on the estimate, not on the claim — "ANY" means "price
 *  it whichever way the plan pays best", which is what the desk wants first. */
export const GEST_PLACES_OF_SERVICE = [
  'ANY',
  'Office (11)',
  'Ambulatory Surgical Center (24)',
  'Outpatient Hospital (22)',
];

/** The handful a GI practice actually applies. "None" first, because most
 *  lines carry no modifier and a required pick would invite a wrong one. */
export const GEST_MODIFIERS = [
  'None',
  '26 — Professional component',
  '33 — Preventive service',
  '50 — Bilateral procedure',
  '51 — Multiple procedures',
  '59 — Distinct procedural service',
  'PT — Screening converted to diagnostic',
];

/** What share of the allowed amount this line is priced at. A reduced
 *  percentage is how multiple-procedure and assistant-surgeon rules are
 *  expressed on an estimate. */
export const GEST_ALLOWED_PERCENTAGES = ['100%', '75%', '50%', '25%'];

/** Each coverage row is applied or not. Two states, named the way the
 *  payer's own worksheet names them. */
export const GEST_COVERAGE_OPTIONS = ['Apply', "Don't apply"];

/* ============================================================================
   CONTRACTED RATES

   Keyed by CPT. `billed` is the clinic's charge; the two allowed figures are
   what the plan recognises depending on where the service happens — a
   facility rate is lower because the facility bills its own fee for the room.
   ========================================================================= */

const RATES = {
  99213: { billed: 300, nonFacility: 99.48, facility: 72.1, matchType: 'Provider NPI Match' },
  99214: { billed: 420, nonFacility: 142.35, facility: 104.8, matchType: 'Provider NPI Match' },
  45378: { billed: 1850, nonFacility: 412.6, facility: 289.4, matchType: 'Fee Schedule Match' },
  45380: { billed: 2100, nonFacility: 486.15, facility: 341.2, matchType: 'Fee Schedule Match' },
  45385: { billed: 2400, nonFacility: 552.9, facility: 388.7, matchType: 'Fee Schedule Match' },
  43235: { billed: 1400, nonFacility: 331.05, facility: 232.6, matchType: 'Fee Schedule Match' },
  43239: { billed: 1600, nonFacility: 378.2, facility: 265.8, matchType: 'Fee Schedule Match' },
  91110: { billed: 1950, nonFacility: 502.75, facility: 502.75, matchType: 'Fee Schedule Match' },
};

/**
 * The contracted rate for a code.
 *
 * An unpriced code still has to produce a line — a blank row is read as "this
 * one is free". It is marked `estimated` so the screen can say the figure is
 * a default rather than a contract rate.
 */
export function rateFor(code) {
  const rate = RATES[String(code).trim()];
  if (rate) return { ...rate, estimated: false };
  return { billed: 250, nonFacility: 82.5, facility: 60.0, matchType: 'No Match — default rate', estimated: true };
}

/* ============================================================================
   THE ELIGIBILITY RESPONSE THIS ESTIMATE IS RUN FROM
   ========================================================================= */

/** Stable per patient rather than random: the same chart re-opened has to
 *  show the same Elig ID, or the screen looks like it re-queried the payer. */
const digitsOf = (mrn) => String(mrn).replace(/\D/g, '').padStart(6, '0');

const PAYER_IDS = {
  Medicare: { payerId: 'MEDICAREB', inbound: 'Medicare Part B', insType: 'MEDICARE PART B' },
  Medicaid: { payerId: 'NDDHSMED', inbound: 'ND Medicaid', insType: 'CARETAKER OF DEPRIVED CHILD' },
  Commercial: { payerId: 'BCBSND', inbound: 'BCBS North Dakota', insType: 'PPO — EMPLOYER GROUP' },
};

const FALLBACK_PAYER_ID = { payerId: 'UNKNOWN', inbound: 'Unlisted payer', insType: 'ACTIVE COVERAGE' };

/**
 * Everything the two steps print in their header: who was checked, against
 * what, and when the answer came back.
 *
 * @param {object} patient  from data/patient-chart.js
 * @param {object} payer    one entry from data/profile-billing.js payers
 * @param {string} today    dd-mm-yyyy — passed in, because a data file that
 *                          reads the clock produces a different answer on
 *                          every render and cannot be tested.
 */
export function gestimatorContext(patient, payer, today) {
  const ids = PAYER_IDS[payer?.insuranceType] || FALLBACK_PAYER_ID;
  const digits = digitsOf(patient.mrn);

  return {
    eligibilityId: `8${digits}${digits.slice(0, 2)}`,
    estimateNumber: `14${digits.slice(-4)}${digits.slice(0, 2)}`,
    receivedOn: today,
    coverage: 'Active Coverage',
    patient: {
      name: patient.name.toUpperCase(),
      memberId: payer?.policy || '—',
      plan: payer?.plan || payer?.name || '—',
      birthdate: patient.dob,
    },
    insurance: {
      name: (payer?.name || 'Self pay').toUpperCase(),
      payerId: ids.payerId,
      inboundName: ids.inbound,
      insuranceTypeFromEligibility: ids.insType,
    },
  };
}

/* ============================================================================
   BENEFITS FROM THE ELIGIBILITY RESPONSE

   Three tables, because the payer sends three and they do not agree with each
   other often enough to be merged. Each row keeps the payer's own wording in
   `information` — that text is what the desk quotes back when a patient
   disputes the estimate, so paraphrasing it would be a loss.
   ========================================================================= */

const BENEFITS = {
  Medicaid: {
    copay: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicaid', level: 'Individual', amount: 0, information: 'Plan Name: MEDICAID FEE FOR SERVICE. Access North Dakota DHS Provider Portal for copay details.' },
    ],
    deductible: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicaid', level: 'Individual', amount: 0, remaining: 0, information: 'Plan Name: MEDICAID FEE FOR SERVICE. $0.00 per service year.' },
    ],
    coinsurance: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicaid', level: 'Individual', percent: 0, information: 'Plan Name: MEDICAID FEE FOR SERVICE.' },
    ],
  },
  Medicare: {
    copay: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicare Part B', level: 'Individual', amount: 0, information: 'Part B carries no copay; the patient share is coinsurance after the deductible.' },
    ],
    deductible: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicare Part B', level: 'Individual', amount: 257, remaining: 112.4, information: '2026 Part B deductible $257.00 per calendar year. $112.40 remaining as at the response date.' },
    ],
    coinsurance: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'Medicare Part B', level: 'Individual', percent: 20, information: 'Standard 20% coinsurance on the Medicare-approved amount after the deductible.' },
    ],
  },
  Commercial: {
    copay: [
      { services: 'Specialist Office Visit', network: 'In Network', type: 'PPO', level: 'Individual', amount: 40, information: 'Specialist copay applies to office visits only, not to procedures.' },
    ],
    deductible: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'PPO', level: 'Individual', amount: 1500, remaining: 640, information: 'Calendar-year deductible. $640.00 remaining as at the response date.' },
    ],
    coinsurance: [
      { services: 'Health Benefit Plan Coverage', network: 'In Network', type: 'PPO', level: 'Individual', percent: 20, information: 'In-network coinsurance after the deductible is met.' },
    ],
  },
};

const NO_BENEFITS = { copay: [], deductible: [], coinsurance: [] };

export function benefitsFor(payer) {
  return BENEFITS[payer?.insuranceType] || NO_BENEFITS;
}

/* ============================================================================
   THE CALCULATION
   ========================================================================= */

const round = (n) => Math.round(n * 100) / 100;

/** "Office (11)" and "ANY" price at the non-facility rate; a facility place
 *  of service prices at the lower facility rate. */
export function allowedForLine(code, placeOfService) {
  const rate = rateFor(code);
  const pos = placeOfService || '';
  // `pos === 'Facility'` is checked explicitly rather than by regex: the
  // string "Non-Facility" contains "Facility", and a naive test priced every
  // office visit at the lower facility rate.
  const facility = pos === 'Facility' || /Surgical Center|Outpatient Hospital/.test(pos);
  return {
    ...rate,
    allowedPerUnit: facility ? rate.facility : rate.nonFacility,
    posLabel: facility ? 'Facility' : 'Non-Facility',
  };
}

/**
 * Price every line, then work out what the patient owes.
 *
 * Order matters, and it is the order a claim adjudicates in:
 *   1. copay        flat, off the top
 *   2. deductible   the patient pays the allowed amount until it is met
 *   3. coinsurance  a percentage of whatever allowed amount is left
 *
 * Reversing 2 and 3 understates the bill on any plan with a deductible still
 * to meet, which is the failure this ordering exists to prevent.
 *
 * @param {Array}  lines    { code, modifier, units, percentOfAllowed, placeOfService }
 * @param {object} benefits from benefitsFor()
 * @param {object} applied  { deductible, coinsurance, copay } — booleans
 */
export function calculateEstimate(lines, benefits, applied) {
  const priced = lines
    .filter((line) => String(line.code || '').trim())
    .map((line) => {
      const rate = allowedForLine(line.code, line.placeOfService);
      const percent = Number(String(line.percentOfAllowed || '100%').replace('%', '')) / 100;
      const units = Number(line.units) || 1;
      return {
        ...line,
        units,
        billedPerUnit: rate.billed,
        allowedPerUnit: round(rate.allowedPerUnit * percent),
        // The plan being billed, not where the service happens — those are
        // two different columns on the payer's own worksheet and showing the
        // facility basis in both made one of them dead weight.
        insType: line.insType || 'Self pay',
        posLabel: rate.posLabel,
        matchType: rate.matchType,
        estimated: rate.estimated,
        lineAllowed: round(rate.allowedPerUnit * percent * units),
      };
    });

  const totalAllowed = round(priced.reduce((sum, line) => sum + line.lineAllowed, 0));

  const copay = applied.copay ? Math.min(benefits.copay[0]?.amount ?? 0, totalAllowed) : 0;
  let remaining = round(totalAllowed - copay);

  const deductibleRemaining = benefits.deductible[0]?.remaining ?? 0;
  const towardsDeductible = applied.deductible ? round(Math.min(deductibleRemaining, remaining)) : 0;
  remaining = round(remaining - towardsDeductible);

  const coinsuranceRate = benefits.coinsurance[0]?.percent ?? 0;
  const coinsurance = applied.coinsurance ? round(remaining * (coinsuranceRate / 100)) : 0;

  const patientOwes = round(copay + towardsDeductible + coinsurance);

  return {
    lines: priced,
    totalAllowed,
    copay,
    towardsDeductible,
    coinsurance,
    coinsuranceRate,
    planPays: round(totalAllowed - patientOwes),
    patientOwes,
    // Nothing applied is not the same as "the patient owes nothing" — the
    // screen has to be able to tell those two apart.
    anyApplied: Boolean(applied.copay || applied.deductible || applied.coinsurance),
  };
}

/* ============================================================================
   SAVED ESTIMATES — the document half of gEstimator

   Step 2 is a working screen. The moment an estimate is downloaded, sent to
   the portal or saved, it becomes a RECORD of what somebody was quoted — and
   that record belongs where the rest of the patient's billing lives, which is
   Billing ▸ gEstimator. A patient asking "what were we told it would cost?" is
   asking for the document, not for the calculator.

   A document is FROZEN. Every figure is copied in at save time rather than
   recomputed on read: the fee schedule changes, and the deductible remaining
   moves as claims land. An estimate that quietly recalculated would stop being
   a copy of what was handed over. That is also why the document keeps WHICH
   coverage options were applied — the same rates with the deductible left off
   produce a different number, and six weeks later nobody remembers which way
   it was run.

   sessionStorage, like every other live store here: one reviewer's run must
   not leak into the next person's tab.
   ========================================================================= */

const DOC_KEY = 'medinova.gestimator.docs.v1';

function readDocs() {
  try {
    const raw = sessionStorage.getItem(DOC_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Private browsing, or hand-edited junk. The tab still has to open.
    return {};
  }
}

function writeDocs(map) {
  try {
    sessionStorage.setItem(DOC_KEY, JSON.stringify(map));
  } catch {
    /* A prototype that cannot persist still has to run. */
  }
}

/**
 * Two estimates already on file for the demo patient.
 *
 * A list that only fills up once the reviewer has run the estimator themselves
 * cannot show what the screen is FOR — several estimates, taken on different
 * days, against different plans, run different ways. The first is the Medicare
 * colonoscopy with nothing applied; the second is a commercial EGD with the
 * copay and deductible applied, so both halves of "estimate due" — calculated
 * and not — are on screen at once.
 */
const SEEDED = {
  326486: [
    {
      id: 'est-14648632',
      estimateNumber: '14648632',
      eligibilityId: '832648632',
      receivedOn: '12-08-2026',
      savedAt: '12-08-2026',
      savedBy: 'Amara Mensah',
      coverage: 'Active Coverage',
      patient: {
        name: 'HENNA WEST',
        memberId: 'MB48120556A',
        plan: 'Medicare Part B',
        birthdate: '20-02-1961',
      },
      encounter: {
        scheduledDos: '12-08-2026',
        practice: 'MediNova Gastroenterology ASC',
        provider: 'Olivia Rhye',
        diagnosis: '—',
      },
      insurance: {
        payer: 'MEDICARE PART B',
        payerId: 'MEDICAREB',
        inboundName: 'Medicare Part B',
        insuranceTypeFromEligibility: 'MEDICARE PART B',
      },
      rateBasis: 'Non-Facility',
      lines: [
        {
          units: 1,
          code: '45378',
          modifier: '—',
          billedPerUnit: 1850,
          allowedPerUnit: 412.6,
          insType: 'Medicare',
          posLabel: 'Non-Facility',
          matchType: 'Fee Schedule Match',
          percentOfAllowed: '100%',
          lineAllowed: 412.6,
        },
      ],
      totalAllowed: 412.6,
      benefits: BENEFITS.Medicare,
      applied: { copay: false, deductible: false, coinsurance: false },
      result: {
        totalAllowed: 412.6,
        copay: 0,
        towardsDeductible: 0,
        coinsurance: 0,
        coinsuranceRate: 20,
        planPays: 412.6,
        patientOwes: 0,
        anyApplied: false,
      },
      note: '',
      sentToPortal: false,
    },
    {
      id: 'est-14648701',
      estimateNumber: '14648701',
      eligibilityId: '832648632',
      receivedOn: '04-08-2026',
      savedAt: '04-08-2026',
      savedBy: 'Ruth Adeyemi',
      coverage: 'Active Coverage',
      patient: {
        name: 'HENNA WEST',
        memberId: 'BCBS-4471902',
        plan: 'BCBS ND — PPO Employer Group',
        birthdate: '20-02-1961',
      },
      encounter: {
        scheduledDos: '21-08-2026',
        practice: 'MediNova Gastroenterology Clinic',
        provider: 'Dr. Amara Mensah',
        diagnosis: 'K21.9',
      },
      insurance: {
        payer: 'BCBS NORTH MEDINOVA',
        payerId: 'BCBSND',
        inboundName: 'BCBS North Dakota',
        insuranceTypeFromEligibility: 'PPO — EMPLOYER GROUP',
      },
      rateBasis: 'Facility',
      lines: [
        {
          units: 1,
          code: '43235',
          modifier: '—',
          billedPerUnit: 1400,
          allowedPerUnit: 305.2,
          insType: 'Commercial',
          posLabel: 'Facility',
          matchType: 'Fee Schedule Match',
          percentOfAllowed: '100%',
          lineAllowed: 305.2,
        },
        {
          units: 1,
          code: '99213',
          modifier: '25',
          billedPerUnit: 150,
          allowedPerUnit: 62.4,
          insType: 'Commercial',
          posLabel: 'Facility',
          matchType: 'Fee Schedule Match',
          percentOfAllowed: '100%',
          lineAllowed: 62.4,
        },
      ],
      totalAllowed: 367.6,
      benefits: BENEFITS.Commercial,
      applied: { copay: true, deductible: true, coinsurance: false },
      result: {
        totalAllowed: 367.6,
        copay: 40,
        towardsDeductible: 327.6,
        coinsurance: 0,
        coinsuranceRate: 20,
        planPays: 0,
        patientOwes: 367.6,
        anyApplied: true,
      },
      note: 'The deductible has $640 remaining, so this visit is expected to fall entirely within it.',
      sentToPortal: true,
    },
  ],
};

/** Every estimate on file for a patient, newest first. */
export function estimateDocuments(mrn) {
  const key = String(mrn);
  const saved = readDocs()[key] ?? [];
  const seeded = SEEDED[key] ?? [];
  return [...saved, ...seeded];
}

export function estimateDocument(mrn, id) {
  return estimateDocuments(mrn).find((doc) => doc.id === id) ?? null;
}

/**
 * File an estimate against the patient.
 *
 * Idempotent per estimate number: downloading, sending to the portal and then
 * saving the same run is one estimate, not three. The latest write wins, so
 * applying the deductible and downloading again updates the document rather
 * than leaving two versions for somebody to choose between.
 */
export function saveEstimateDocument(mrn, doc) {
  const key = String(mrn);
  const map = readDocs();
  const list = (map[key] ?? []).filter((d) => d.estimateNumber !== doc.estimateNumber);
  const stored = { ...doc, id: `est-${doc.estimateNumber}` };
  map[key] = [stored, ...list];
  writeDocs(map);
  return stored;
}
