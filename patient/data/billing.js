/**
 * Billing — statements, payment history, saved cards, insurance.
 *
 * The four billing screens are four views of this one module.
 *
 * STATEMENTS AND PAYMENTS RUN LONGER THAN THE DESIGN'S FIVE ROWS, ON PURPOSE.
 *
 * They were cut to the five the reference screenshot draws, on the reasoning
 * that a pager under five rows is a control with nothing to do. That was true
 * of the fixture and false of the screen: billing is the one part of the
 * portal that only ever grows, because every visit adds a statement and
 * sooner or later a payment. A patient two years into the practice opens a
 * table hundreds of rows long, and both screens have to be built for that
 * reader rather than for a fixture that fits on one page.
 *
 * So the two tables carry two years of history, newest first, and both screens
 * page through it — see js/lib/pagination.js. The first five rows of each are
 * still the design's five, unchanged, so the reference screenshot can be laid
 * beside page one and compared line for line.
 */

export const STATEMENTS = [
  { id: 'st-1', provider: 'Cameron Williamson', generated: 'Sep 21, 2026 at 03:05 pm', balance: 526 },
  { id: 'st-2', provider: 'Darlene Robertson', generated: 'Aug 18, 2026 at 04:12 pm', balance: 62 },
  { id: 'st-3', provider: 'Jane Cooper', generated: 'Jun 4, 2026 at 12:14 pm', balance: 112 },
  { id: 'st-4', provider: 'Ralph Edwards', generated: 'Jun 4, 2026 at 11:00 am', balance: 854 },
  { id: 'st-5', provider: 'Esther Howard', generated: 'May 13, 2026 at 08:05 am', balance: 635 },
  { id: 'st-6', provider: 'Kristin Watson', generated: 'Apr 29, 2026 at 02:40 pm', balance: 218 },
  { id: 'st-7', provider: 'Devon Lane', generated: 'Apr 2, 2026 at 09:25 am', balance: 1240 },
  { id: 'st-8', provider: 'Courtney Henry', generated: 'Mar 17, 2026 at 01:55 pm', balance: 74 },
  { id: 'st-9', provider: 'Brooklyn Simmons', generated: 'Mar 3, 2026 at 10:10 am', balance: 389 },
  { id: 'st-10', provider: 'Leslie Alexander', generated: 'Feb 11, 2026 at 03:48 pm', balance: 156 },
  { id: 'st-11', provider: 'Guy Hawkins', generated: 'Jan 27, 2026 at 08:30 am', balance: 942 },
  { id: 'st-12', provider: 'Annette Black', generated: 'Jan 6, 2026 at 04:05 pm', balance: 85 },
  { id: 'st-13', provider: 'Wade Warren', generated: 'Dec 15, 2025 at 11:20 am', balance: 467 },
  { id: 'st-14', provider: 'Theresa Webb', generated: 'Nov 24, 2025 at 02:15 pm', balance: 1085 },
  { id: 'st-15', provider: 'Marvin McKinney', generated: 'Nov 5, 2025 at 09:50 am', balance: 233 },
  { id: 'st-16', provider: 'Floyd Miles', generated: 'Oct 14, 2025 at 03:30 pm', balance: 58 },
  { id: 'st-17', provider: 'Jerome Bell', generated: 'Sep 30, 2025 at 12:45 pm', balance: 712 },
  { id: 'st-18', provider: 'Kathryn Murphy', generated: 'Sep 8, 2025 at 10:05 am', balance: 164 },
  { id: 'st-19', provider: 'Cameron Williamson', generated: 'Aug 19, 2025 at 04:25 pm', balance: 320 },
  { id: 'st-20', provider: 'Jane Cooper', generated: 'Jul 28, 2025 at 08:15 am', balance: 1470 },
  { id: 'st-21', provider: 'Darlene Robertson', generated: 'Jul 7, 2025 at 01:35 pm', balance: 96 },
  { id: 'st-22', provider: 'Esther Howard', generated: 'Jun 16, 2025 at 11:40 am', balance: 505 },
  { id: 'st-23', provider: 'Ralph Edwards', generated: 'May 22, 2025 at 09:05 am', balance: 278 },
];

/*
 * ⚠ REPRODUCED AS DRAWN, AND IT DOES NOT READ RIGHT.
 *
 * Rows 2 and 4 carry a success note against a Failed status — "Transaction
 * completed. Your timely payment is duly acknowledged" beside Failed, and
 * "Payment successfully verified" beside Failed. That is what the design
 * screenshot shows, so that is what is built: a reviewer should see the
 * mismatch on the screen rather than have it quietly corrected underneath
 * them and never notice it went out in the spec.
 *
 * The history added behind those five rows repeats the same five notes, so
 * the mismatch now recurs on the later Failed rows too. That is the same
 * decision carried down the list rather than a second one: correcting it in
 * the history and not in the header rows would make the fault look like a
 * one-off typo instead of a gap in the spec.
 *
 * Failed rows need their own copy — what went wrong and what to do next. Once
 * that copy exists, every Failed row below wants it.
 */
export const PAYMENTS = [
  {
    id: 'pay-1',
    processed: 'Sep 21, 2026 at 03:05 pm',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 526,
    status: 'Paid',
  },
  {
    id: 'pay-2',
    processed: 'Aug 18, 2026 at 04:12 pm',
    note: 'Transaction completed. Your timely payment is duly acknowledged',
    amount: 62,
    status: 'Failed',
  },
  {
    id: 'pay-3',
    processed: 'Jun 4, 2026 at 12:14 pm',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 112,
    status: 'Paid',
  },
  {
    id: 'pay-4',
    processed: 'Jun 4, 2026 at 11:00 am',
    note: 'Payment successfully verified. Your promptness is highly valued',
    amount: 854,
    status: 'Failed',
  },
  {
    id: 'pay-5',
    processed: 'May 13, 2026 at 08:05 am',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 635,
    status: 'Paid',
  },
  {
    id: 'pay-6',
    processed: 'Apr 29, 2026 at 02:40 pm',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 218,
    status: 'Paid',
  },
  {
    id: 'pay-7',
    processed: 'Apr 2, 2026 at 09:25 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 1240,
    status: 'Paid',
  },
  {
    id: 'pay-8',
    processed: 'Mar 17, 2026 at 01:55 pm',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 74,
    status: 'Paid',
  },
  {
    id: 'pay-9',
    processed: 'Mar 3, 2026 at 10:10 am',
    note: 'Transaction completed. Your timely payment is duly acknowledged',
    amount: 389,
    status: 'Failed',
  },
  {
    id: 'pay-10',
    processed: 'Feb 11, 2026 at 03:48 pm',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 156,
    status: 'Paid',
  },
  {
    id: 'pay-11',
    processed: 'Jan 27, 2026 at 08:30 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 942,
    status: 'Paid',
  },
  {
    id: 'pay-12',
    processed: 'Jan 6, 2026 at 04:05 pm',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 85,
    status: 'Paid',
  },
  {
    id: 'pay-13',
    processed: 'Dec 15, 2025 at 11:20 am',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 467,
    status: 'Paid',
  },
  {
    id: 'pay-14',
    processed: 'Nov 24, 2025 at 02:15 pm',
    note: 'Payment successfully verified. Your promptness is highly valued',
    amount: 1085,
    status: 'Failed',
  },
  {
    id: 'pay-15',
    processed: 'Nov 5, 2025 at 09:50 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 233,
    status: 'Paid',
  },
  {
    id: 'pay-16',
    processed: 'Oct 14, 2025 at 03:30 pm',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 58,
    status: 'Paid',
  },
  {
    id: 'pay-17',
    processed: 'Sep 30, 2025 at 12:45 pm',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 712,
    status: 'Paid',
  },
  {
    id: 'pay-18',
    processed: 'Sep 8, 2025 at 10:05 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 164,
    status: 'Paid',
  },
  {
    id: 'pay-19',
    processed: 'Aug 19, 2025 at 04:25 pm',
    note: 'Transaction completed. Your timely payment is duly acknowledged',
    amount: 320,
    status: 'Failed',
  },
  {
    id: 'pay-20',
    processed: 'Jul 28, 2025 at 08:15 am',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 1470,
    status: 'Paid',
  },
  {
    id: 'pay-21',
    processed: 'Jul 7, 2025 at 01:35 pm',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 96,
    status: 'Paid',
  },
  {
    id: 'pay-22',
    processed: 'Jun 16, 2025 at 11:40 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 505,
    status: 'Paid',
  },
  {
    id: 'pay-23',
    processed: 'May 22, 2025 at 09:05 am',
    note: 'Transaction processed successfully. Your timely payment is acknowledged',
    amount: 278,
    status: 'Paid',
  },
  {
    id: 'pay-24',
    processed: 'Apr 30, 2025 at 02:50 pm',
    note: 'Payment successfully verified. Your promptness is highly valued',
    amount: 640,
    status: 'Failed',
  },
  {
    id: 'pay-25',
    processed: 'Apr 8, 2025 at 10:35 am',
    note: 'Payment successfully processed. We appreciate your prompt settlement',
    amount: 129,
    status: 'Paid',
  },
  {
    id: 'pay-26',
    processed: 'Mar 19, 2025 at 09:15 am',
    note: 'Payment received and processed. We appreciate your prompt remittance.',
    amount: 815,
    status: 'Paid',
  },
];

/**
 * Saved cards.
 *
 * `last4` only — the masking is rendered by the screen, so no part of this
 * prototype ever holds a string that LOOKS like a full card number. The habit
 * costs nothing here and is the difference between a safe fixture and one
 * somebody copies into a real build.
 *
 * There is no `name` on the card either. The reference's table does not show
 * one, and a cardholder name is the one field on the Add Card form worth
 * keeping only if something displays it. Nothing does, so nothing stores it.
 */
export const CARDS = [
  { id: 'card-9090', brand: 'VISA', last4: '9090', expires: 'Dec-25', active: false },
  { id: 'card-5655', brand: 'VISA', last4: '5655', expires: 'Sep-25', active: true },
  { id: 'card-3436', brand: 'VISA', last4: '3436', expires: 'Jul-26', active: false },
  { id: 'card-8987', brand: 'VISA', last4: '8987', expires: 'Sep-24', active: true },
  { id: 'card-1234', brand: 'VISA', last4: '1234', expires: 'Feb-30', active: true },
];

/**
 * Put a card on file.
 *
 * ⚠ THE SIGNATURE IS THE SAFEGUARD. It takes a brand, a LAST FOUR and an
 * expiry — there is no parameter a full card number could be passed in, and
 * none for a CVV. The Add Card form reads a whole number off the patient,
 * takes those two facts from it and drops the rest before calling this; see
 * js/screens/profile-cards.js. A real build hands the number to the payment
 * provider and gets a token back, and the token would join this row — but the
 * shape of what the portal itself keeps does not change.
 *
 * In memory only, like every other fixture here: gone on reload.
 *
 * @param {object} card
 * @param {string} card.brand    'VISA', 'MASTERCARD', …
 * @param {string} card.last4    exactly four digits
 * @param {string} card.expires  'Sep-25', as the table prints it
 * @returns {object} the stored row
 */
export function addCard({ brand, last4, expires }) {
  if (!/^\d{4}$/.test(last4)) {
    throw new Error('addCard takes the last four digits, not a card number.');
  }

  const card = {
    id: `card-${last4}-${CARDS.length + 1}`,
    brand,
    last4,
    expires,
    // A card is added to be used. Inactive is a state a card ARRIVES at —
    // expired, declined, withdrawn — not one anybody chooses at the form.
    active: true,
  };

  CARDS.push(card);
  return card;
}

/*
 * ⚠ The expiry below is in the past — the design dates it March 13, 2024
 * while the rest of the fixture data sits in 2026. Left as drawn. A plan that
 * expired two years ago should almost certainly be flagged on this screen
 * rather than printed as an ordinary field, which is the review this is here
 * to provoke.
 */
const PLAN = {
  insurer: 'BKK Mobil Oil AG Blutzuckersel',
  memberId: '43756',
  groupName: 'N2-112',
  groupId: '8811',
  planId: '7791',
  expires: 'March 13, 2024',
};

/**
 * Coverage order.
 *
 * INSURANCE is an ORDERED list and `rank` is derived from position, not
 * stored independently — see restampRanks(). Keeping the two in sync by hand
 * is how a screen ends up with two plans both labelled Secondary.
 */
export const RANKS = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'];

export const INSURANCE = [
  { id: 'ins-primary', rank: 'Primary', primary: true, ...PLAN, cards: ['Front of card', 'Back of card'] },
  { id: 'ins-secondary', rank: 'Secondary', primary: false, ...PLAN, cards: [] },
];

/** Re-derive `rank` and `primary` from position. The only writer of either. */
function restampRanks() {
  INSURANCE.forEach((plan, index) => {
    plan.rank = RANKS[index] ?? `Level ${index + 1}`;
    plan.primary = index === 0;
  });
}

/**
 * Add a policy at a chosen coverage order.
 *
 * Inserting at Primary pushes the old primary down to Secondary, and so on —
 * which is what a coverage ORDER means. In memory only; gone on reload.
 *
 * @param {object} plan   the policy, without `rank`/`primary`
 * @param {string} order  'Primary' | 'Secondary' | 'Tertiary' | …
 */
export function addInsurance(plan, order) {
  const at = RANKS.indexOf(order);
  INSURANCE.splice(at === -1 ? INSURANCE.length : at, 0, { ...plan });
  restampRanks();
}

/** Move one policy to the front. Everything above it shifts down a step. */
export function makePrimary(id) {
  const at = INSURANCE.findIndex((plan) => plan.id === id);
  if (at <= 0) return;
  INSURANCE.unshift(...INSURANCE.splice(at, 1));
  restampRanks();
}
