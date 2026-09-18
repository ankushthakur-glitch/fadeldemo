/**
 * DEMO DATA — Settings ▸ Billing. Entirely invented; no real contracted rate.
 *
 * FEE SCHEDULE
 * One row is what a single procedure is worth for a single provider over a
 * date range: what the practice charges (rate) and what it expects to be
 * allowed against that charge. The claim built in Billing prices its lines
 * from here, which is why the codes and providers below are the ones those
 * screens already use — CPT_CODES from data/master.js, BILLING_PROVIDERS from
 * data/billing.js. A fee schedule that named its own would let Settings
 * quietly contradict the claim.
 *
 * A row does NOT name a payer. It used to, on the argument that a rate is what
 * a contract says it is — but the list this screen keeps is the practice's own
 * price list, one price per code per provider, and hanging a payer off it made
 * the same code appear a dozen times over with a dozen different answers to
 * "what do we charge for this", which is the single question the list exists
 * to answer. What each payer allows against that charge is a fact about the
 * contract, and it belongs with the payer record rather than in here.
 *
 * A ROW DOES NAME ITS CHARGE TYPE.
 * One case done at the surgical centre raises two charges, not one: the
 * facility fee for the room, the scope, the nursing and the recovery bay, and
 * the professional fee for the clinician who did the work. They are different
 * amounts, and they go out on different forms — the ASC charge on a UB-04,
 * the professional charge on a CMS-1500 — so a price list that could hold
 * only one of them forced the practice to keep the other somewhere else.
 *
 * Charge type is therefore the third part of a row's identity, beside the
 * procedure and the provider. The same code for the same clinician can appear
 * twice, once as ASC and once as Professional, at two amounts that have
 * nothing to do with each other; it cannot appear twice as the same one,
 * which would be two prices for one claim line with nothing to choose between
 * them. Those two are the whole list — there is no third kind of charge here.
 *
 * Dates are ISO (YYYY-MM-DD): they sort as plain strings, feed
 * <ui-input type="date"> without conversion, and are formatted for display by
 * the screen. Status is NOT stored — see statusOf() in the screen module. A
 * contract year that has not started yet is Pending, and one that has run out
 * has stopped applying; both are facts about the dates, and storing a status
 * beside them is how the two drift apart.
 */
import { CPT_CODES } from './master.js';
import { BILLING_PROVIDERS } from './billing.js';

/** "45378 - Colonoscopy, flexible; diagnostic" — the way a coder picks one. */
export const PROCEDURE_OPTIONS = CPT_CODES.map((c) => `${c.code} - ${c.description}`);

export const FEE_PROVIDER_OPTIONS = [...BILLING_PROVIDERS];

/** The three a fee schedule can be in — see statusOf() in the screen module.
 *  The filter offers these; its placeholder is the unfiltered "all". */
export const FEE_STATUSES = ['Active', 'Pending', 'Inactive'];

/**
 * The two charges one piece of work can raise.
 *
 * ASC is the facility fee — what the surgical centre bills for the room, the
 * scope, the staff and the recovery bay. Professional is the clinician's own
 * fee for doing the procedure. Both are real charges against the same case,
 * at amounts with nothing to do with each other, which is the whole reason
 * the field exists: a single Amount column could only ever have held one of
 * them. See PRACTICE_PROFILES in data/practice.js — the clinic and the ASC
 * are two billing entities in this practice, and this is that same division
 * reaching the price list.
 */
export const CHARGE_TYPES = ['ASC', 'Professional'];

/* ============================================================================
   THE REST OF THE SCHEDULE — generated, and here is why.

   The eleven rows below are written out because each one is there to SHOW
   something: the same code priced for two different providers, a rate that has
   not started yet (Pending), one that ran out at the end of last year
   (Inactive), and one switched off by hand while its code is under review.
   Those are the cases the screen's statusOf() exists for, and a generator that
   happened to produce them would be a generator nobody could read.

   What the rest of a fee schedule is, though, is the same two numbers repeated
   for every code the practice bills, for every provider who bills it — several
   hundred rows in a real practice, and none of them interesting on its own.
   Written longhand that is a wall nobody would check; generated from the
   charge master and one allowance it stays honest, because those two numbers
   are exactly what a fee schedule row is made of.

   Deterministic: rates come from the table below and the dates are fixed
   strings, so a screenshot taken today looks the same next month.
   ========================================================================= */

/**
 * What the practice CHARGES for a code — one price, the same for everyone.
 *
 * 43239 is deliberately absent: it is priced by hand below, and a code sitting
 * in both places would be priced twice over for the same provider, which is
 * the one thing the schedule must not do now that the procedure and the
 * provider are the whole of a row's identity.
 */
const CHARGE_MASTER = {
  '45379': 1180,
  '45381': 1090,
  '45382': 1310,
  '45384': 1055,
  '45386': 1265,
  '45388': 1395,
  '45390': 1640,
  '45398': 1210,
  '43200': 690,
  '43202': 785,
  '43236': 905,
  '43244': 1340,
  '43246': 1425,
  '43249': 1080,
  '43251': 1165,
  '43254': 1580,
  '43255': 1290,
  '91010': 720,
  '91034': 640,
  '91037': 880,
  '91122': 560,
  '99203': 245,
  '99204': 365,
  '99212': 120,
  '99215': 310,
  '96365': 285,
  '96366': 145,
};

/**
 * What the practice expects to be allowed, as a share of what it charges.
 *
 * One share for the whole schedule, because a row no longer names the payer
 * that would vary it: this is the blended allowance the practice prices and
 * budgets against. The real spread is wide — commercial contracts land in the
 * seventies, Medicare near forty, Medicaid near thirty — and blending them is
 * precisely what a single price list does.
 */
const ALLOWED_SHARE = 0.75;

/** Rounded to the cent the way a contract writes it, not to a whole dollar. */
const allowed = (rate) => Math.round(rate * ALLOWED_SHARE * 100) / 100;

/**
 * Which codes raise a facility charge as well as a professional one.
 *
 * The endoscopy families — 43xxx upper, 45xxx lower — are the work that
 * happens in a suite at the surgical centre, so each of them is priced twice:
 * once for the centre and once for the clinician. Everything else in the
 * charge master is done in a consulting room and raises the professional
 * charge alone. An office visit with an ASC facility fee beside it would be a
 * row nobody could ever bill.
 */
const facilityBillable = (code) => code.startsWith('43') || code.startsWith('45');

/**
 * What the centre charges for a case the clinician charges CHARGE_MASTER for.
 *
 * A facility fee is not a share of a professional fee — the two are
 * negotiated separately and neither is derived from the other. It is written
 * as a multiple here only because the alternative is a second hand-typed
 * table of the same length whose numbers nobody could check either. For
 * endoscopy the facility side is the larger of the two, which is what this
 * says, and it is rounded to five dollars the way a chargemaster is written.
 */
const ASC_FACILITY_MULTIPLE = 1.35;
const facilityRate = (rate) => Math.round((rate * ASC_FACILITY_MULTIPLE) / 5) * 5;

function contractedRates() {
  const codes = Object.keys(CHARGE_MASTER);
  const providers = FEE_PROVIDER_OPTIONS;
  const descriptions = Object.fromEntries(CPT_CODES.map((c) => [c.code, c.description]));

  const rows = [];
  codes.forEach((code, index) => {
    // Every provider carries every code — that is what a schedule keyed on the
    // two of them looks like. The rotation only decides which provider a
    // code's block starts on, so consecutive codes do not read down the
    // Provider column in lockstep; each block still holds all three exactly
    // once, which is what keeps the generator from colliding with itself.
    for (let n = 0; n < providers.length; n += 1) {
      const professional = CHARGE_MASTER[code];
      // Professional first, then the facility charge where there is one, so
      // the two halves of one case sit next to each other in the list rather
      // than a hundred rows apart.
      const charges = facilityBillable(code)
        ? [['Professional', professional], ['ASC', facilityRate(professional)]]
        : [['Professional', professional]];

      for (const [chargeType, rate] of charges) {
        rows.push({
          id: `fee-${14 + rows.length}`,
          procedure: `${code} - ${descriptions[code] ?? 'Procedure'}`,
          provider: providers[(index + n) % providers.length],
          chargeType,
          rate,
          allowedAmount: allowed(rate),
          fromDate: '2026-01-01',
          endDate: '2026-12-31',
          active: true,
        });
      }
    }
  });

  return rows;
}

/*
 * Rate is the practice's charge; allowedAmount is what it expects to collect
 * against it. The two are kept side by side rather than one being figured from
 * the other on screen, because a schedule is negotiated line by line: a row
 * can be written with an allowance nothing like the blended one, and the list
 * has to be able to say so.
 */
export const FEE_SCHEDULES = [
  {
    // The two halves of one screening colonoscopy, and the reason charge type
    // is part of a row's identity: same code, same clinician, two charges,
    // and the amounts are nothing like each other.
    id: 'fee-1',
    procedure: '45378 - Colonoscopy, flexible; diagnostic',
    provider: 'Dr. Amara Mensah',
    chargeType: 'Professional',
    rate: 985,
    allowedAmount: 742.5,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-2',
    procedure: '45378 - Colonoscopy, flexible; diagnostic',
    provider: 'Dr. Amara Mensah',
    chargeType: 'ASC',
    rate: 1330,
    allowedAmount: 997.5,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-3',
    procedure: '45380 - Colonoscopy, flexible; with biopsy, single or multiple',
    provider: 'Dr. Amara Mensah',
    chargeType: 'Professional',
    rate: 1145,
    allowedAmount: 868.75,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-4',
    procedure: '45385 - Colonoscopy, flexible; with removal of lesion by snare technique',
    provider: 'Dr. Luca Bianchi',
    chargeType: 'ASC',
    rate: 1420,
    allowedAmount: 1065,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-5',
    procedure: '43235 - Esophagogastroduodenoscopy, flexible; diagnostic',
    provider: 'Dr. Luca Bianchi',
    chargeType: 'Professional',
    rate: 810,
    allowedAmount: 607.5,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-6',
    procedure: '43239 - Esophagogastroduodenoscopy, flexible; with biopsy',
    provider: 'Dr. Luca Bianchi',
    chargeType: 'Professional',
    rate: 960,
    allowedAmount: 724,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    // The same code for a second provider, at the same charge: one row each,
    // which is what the list looks like once the payer is out of it.
    id: 'fee-7',
    procedure: '43239 - Esophagogastroduodenoscopy, flexible; with biopsy',
    provider: 'Dr. Sana Nakamura',
    chargeType: 'Professional',
    rate: 960,
    allowedAmount: 724,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-8',
    procedure: '91110 - Gastrointestinal tract imaging, intraluminal (capsule endoscopy)',
    provider: 'Dr. Sana Nakamura',
    chargeType: 'Professional',
    rate: 1680,
    allowedAmount: 1260,
    // Negotiated late and effective next quarter — Pending until it starts.
    fromDate: '2026-09-01',
    endDate: '2027-08-31',
    active: true,
  },
  {
    // An office visit raises no facility fee — nobody bills a consulting room
    // as an ambulatory surgery centre.
    id: 'fee-9',
    procedure: '99213 - Office visit, established patient, 20–29 minutes',
    provider: 'Dr. Amara Mensah',
    chargeType: 'Professional',
    rate: 165,
    allowedAmount: 128.4,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-11',
    procedure: '99214 - Office visit, established patient, 30–39 minutes',
    provider: 'Dr. Sana Nakamura',
    chargeType: 'Professional',
    rate: 235,
    allowedAmount: 181.9,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
  },
  {
    id: 'fee-12',
    procedure: '45331 - Sigmoidoscopy, flexible; with biopsy',
    provider: 'Dr. Luca Bianchi',
    chargeType: 'ASC',
    rate: 620,
    allowedAmount: 465,
    // Last year's schedule, not renewed at this rate — reads Inactive on dates
    // alone, without anyone having to remember to switch it off.
    fromDate: '2025-01-01',
    endDate: '2025-12-31',
    active: true,
  },
  {
    id: 'fee-13',
    procedure: '43450 - Dilation of esophagus, by unguided sound or bougie',
    provider: 'Dr. Sana Nakamura',
    chargeType: 'Professional',
    rate: 540,
    allowedAmount: 405,
    fromDate: '2026-01-01',
    endDate: '2026-12-31',
    // Switched off by hand: the code is under review and should not price a
    // claim until it is settled.
    active: false,
  },
  ...contractedRates(),
];
