/**
 * gESTIMATOR — what this visit will cost the patient, before it happens.
 *
 * Launched from a booking's row menu. The patient is already known — it is
 * their appointment — so the only thing to choose is which of their plans to
 * estimate against, and the answer appears in the same dialog rather than on a
 * screen the desk has to go to and come back from.
 *
 * WHAT AN ESTIMATE ACTUALLY IS
 * Not "the price". A charge is what the clinic bills; the ALLOWED AMOUNT is
 * what the plan has contracted to recognise, and everything the patient owes
 * is worked out from that, not from the charge. Estimating off the charge is
 * the single most common way a good-faith estimate comes out wrong — it can
 * overstate the patient's share several-fold on a well-contracted plan.
 *
 * The order matters too, and it is the order a claim adjudicates in:
 *
 *   1. copay          a flat amount, taken off the top, if the plan has one
 *   2. deductible     the patient pays the allowed amount until it is met
 *   3. coinsurance    a percentage of whatever allowed amount is left
 *
 * Reversing 2 and 3 — charging coinsurance before the deductible — understates
 * the bill on any plan with a deductible still to meet.
 *
 * Every plan, amount and contract rate below is invented. No real patient
 * information, and no estimate here is a real good-faith estimate.
 */

/**
 * The plans on file for each patient, most recent first.
 *
 * A patient can carry more than one — a primary and a secondary, or a plan
 * that has just termed and its replacement — which is exactly why the dialog
 * asks rather than assuming. Self pay is appended for everyone: the desk
 * needs to be able to price a visit the plan will not cover.
 */
const PLANS = {
  326486: [
    { id: 'bcbs-ppo', name: 'Blue Cross Blue Shield ND — PPO', network: 'In network', allowedRate: 0.62, copay: 30, coinsurance: 20, deductibleLeft: 250 },
    { id: 'bcbs-sec', name: 'Prairie Mutual — secondary', network: 'In network', allowedRate: 0.70, copay: 0, coinsurance: 10, deductibleLeft: 0 },
  ],
  326491: [
    { id: 'sanford-hmo', name: 'Sanford Health Plan — HMO', network: 'In network', allowedRate: 0.58, copay: 25, coinsurance: 0, deductibleLeft: 0 },
  ],
  326490: [
    { id: 'medicare-b', name: 'Medicare Part B', network: 'In network', allowedRate: 0.55, copay: 0, coinsurance: 20, deductibleLeft: 0 },
  ],
  326493: [
    { id: 'medicaid-nd', name: 'Medicaid ND', network: 'In network', allowedRate: 0.50, copay: 0, coinsurance: 0, deductibleLeft: 0 },
  ],
  326494: [
    { id: 'npn', name: 'Northern Plains Health Plan', network: 'Out of network', allowedRate: 0.85, copay: 0, coinsurance: 40, deductibleLeft: 800 },
  ],
  326477: [
    { id: 'summit', name: 'Summit Bridge PPO — not contracted', network: 'Out of network', allowedRate: 1, copay: 0, coinsurance: 50, deductibleLeft: 1200 },
  ],
};

/** Always available: the desk has to be able to price a visit without a plan. */
export const SELF_PAY_PLAN = {
  id: 'self-pay',
  name: 'Self pay — no insurance',
  network: 'n/a',
  allowedRate: 0.75, // the clinic's self-pay rate, a discount off the charge
  copay: 0,
  coinsurance: 100,
  deductibleLeft: 0,
};

export const plansFor = (mrn) => [...(PLANS[String(mrn)] ?? []), SELF_PAY_PLAN];

export const planById = (mrn, id) => plansFor(mrn).find((p) => p.id === id) ?? null;

/**
 * What the clinic charges for a visit of this kind.
 *
 * Keyed by the words that appear in an activity or procedure title, longest
 * first so "Infusion Therapy" is not matched by a shorter rule that happens to
 * appear inside it. A fallback keeps the estimator answering for an activity
 * nobody has priced yet — a blank estimate is worse than an approximate one
 * clearly labelled as such.
 */
const CHARGE_RULES = [
  [/colonoscopy/i, 1850],
  [/endoscop|EGD|ERCP|EUS/i, 1400],
  [/infusion/i, 2400],
  [/annual wellness/i, 220],
  [/consultation|new patient/i, 320],
  [/follow/i, 180],
];

const FALLBACK_CHARGE = 250;

export function chargeFor(activityTitle) {
  const rule = CHARGE_RULES.find(([pattern]) => pattern.test(activityTitle ?? ''));
  return { amount: rule ? rule[1] : FALLBACK_CHARGE, estimated: !rule };
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * The estimate.
 *
 * Returns every line, not just the total — a number with no working shown is a
 * number the desk cannot defend when the patient asks how it was reached, and
 * "the computer said so" is not an answer at a front desk.
 */
export function estimate(charge, plan) {
  const allowed = round(charge * plan.allowedRate);
  const contractualAdjustment = round(charge - allowed);

  // 1. Copay comes off the top, and never exceeds the allowed amount.
  const copay = Math.min(plan.copay, allowed);
  let remaining = round(allowed - copay);

  // 2. The deductible: the patient pays the allowed amount until it is met.
  const towardsDeductible = round(Math.min(plan.deductibleLeft, remaining));
  remaining = round(remaining - towardsDeductible);

  // 3. Coinsurance on whatever allowed amount is left after the deductible.
  const coinsurance = round(remaining * (plan.coinsurance / 100));
  const planPays = round(remaining - coinsurance);

  const patientOwes = round(copay + towardsDeductible + coinsurance);

  return {
    charge: round(charge),
    contractualAdjustment,
    allowed,
    copay,
    towardsDeductible,
    coinsurance,
    coinsuranceRate: plan.coinsurance,
    planPays,
    patientOwes,
    deductibleLeft: plan.deductibleLeft,
  };
}

export const money = (amount) =>
  `$${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
