/**
 * PATIENT BALANCE — what the last visit left owing, and whether that stands in
 * the way of booking the next one.
 *
 * WHY THE SCHEDULER ASKS THIS AT ALL
 * The desk books the next appointment while the patient is still standing
 * there. That is the one moment an outstanding balance can be collected
 * without a letter, a statement run and a phone call — so the New Appointment
 * form says what is owed the moment a patient is chosen, and offers to take it.
 *
 * WHY IT DOES NOT HARD-BLOCK
 * A balance is a reason to ask for payment, not a reason to refuse care. The
 * desk can always book anyway by recording why — every clinic has patients who
 * genuinely cannot pay today, and a rule that cannot be overridden is a rule
 * the desk works around by booking under a different name. The override is
 * recorded; the refusal would not have been.
 *
 * All names, amounts and dates below are invented. No real patient
 * information, and nothing here is a real financial record.
 */

/** How long after the due date a balance stops being "pending" and is overdue. */
export const OVERDUE_AFTER_DAYS = 30;

/**
 * What each patient's previous visit left owing.
 *
 * Keyed by MRN, matching data/directory.js. Only patients with something
 * outstanding are listed — anyone absent is settled up, which is the ordinary
 * case and does not need a row to say so.
 *
 *   amount   what the patient owes, in dollars
 *   since    the visit it is from (dd-mm-yyyy, as elsewhere in the chart)
 *   reason   what the charge was for, so the desk can answer "for what?"
 *   overdue  past the clinic's terms — a firmer prompt, not a different rule
 */
const BALANCES = new Map([
  ['326486', { amount: 125, since: '21-06-2026', reason: 'Office visit copay — invoice INV-2026-0142', overdue: false }],
  ['326494', { amount: 95, since: '27-03-2026', reason: 'Non-covered service — invoice INV-2026-0098', overdue: true }],
  ['326490', { amount: 240, since: '27-05-2026', reason: 'Infusion chair fee, part paid', overdue: false }],
  ['326493', { amount: 60, since: '14-05-2026', reason: 'Outstanding coinsurance', overdue: false }],
  ['326477', { amount: 310, since: '19-02-2026', reason: 'Self-pay consultation', overdue: true }],
  ['326492', { amount: 45, since: '02-07-2026', reason: 'Late cancellation fee', overdue: false }],
]);

/** Collections taken in this session, so a paid balance stays paid on repaint. */
const COLLECTED = new Map();

/** Bookings made over an outstanding balance, with the reason the desk gave. */
const DEFERRED = new Map();

/**
 * What this patient owes right now.
 *
 * Returns null for a patient with nothing outstanding — including one whose
 * balance was collected a moment ago in the scheduling form, which is the
 * whole point of collecting it there.
 */
export function balanceFor(mrn) {
  if (!mrn) return null;
  const seeded = BALANCES.get(String(mrn));
  if (!seeded) return null;

  const paid = COLLECTED.get(String(mrn)) ?? 0;
  const remaining = Math.round((seeded.amount - paid) * 100) / 100;
  if (remaining <= 0) return null;

  return { ...seeded, amount: remaining, paid };
}

/**
 * Whether this patient can be booked, and what the desk should do about it.
 *
 *   clear     nothing owed — book
 *   pending   owed, within terms — collect while they are here
 *   overdue   owed and past terms — collect, and say so more firmly
 *
 * `blocking` is what the form acts on. It is never true once the balance has
 * been collected or the booking deliberately deferred.
 */
export function scheduleEligibility(mrn) {
  const balance = balanceFor(mrn);
  if (!balance) {
    return { state: 'clear', blocking: false, balance: null, deferred: deferralFor(mrn) };
  }

  const deferred = deferralFor(mrn);
  return {
    state: balance.overdue ? 'overdue' : 'pending',
    blocking: !deferred,
    balance,
    deferred,
  };
}

/** Take a payment against the balance. Returns what is left owing. */
export function collectPayment(mrn, amount, method) {
  const key = String(mrn);
  const taken = Math.max(0, Number(amount) || 0);
  COLLECTED.set(key, (COLLECTED.get(key) ?? 0) + taken);
  return { remaining: balanceFor(key)?.amount ?? 0, taken, method };
}

/** Book over a balance, on the record. */
export function deferCollection(mrn, reason) {
  DEFERRED.set(String(mrn), { reason, at: 'this booking' });
}

export const deferralFor = (mrn) => (mrn ? DEFERRED.get(String(mrn)) ?? null : null);

/** Undo a deferral — used when the form is reopened for a different patient. */
export function clearDeferral(mrn) {
  DEFERRED.delete(String(mrn));
}

/** The reasons a desk is allowed to book over a balance. Free text is not an
 *  option: "why" has to be answerable from a report later. */
export const DEFERRAL_REASONS = [
  'Clinically urgent — book now, bill later',
  'Payment plan already agreed',
  'Balance disputed, under review',
  'Insurance reprocessing the claim',
  'Financial hardship — waiver requested',
];

/** How a payment was taken at the desk. */
export const PAYMENT_METHODS = ['Card on file', 'Card — manual entry', 'Cash', 'Cheque', 'Patient portal'];

export const money = (amount) =>
  `$${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
