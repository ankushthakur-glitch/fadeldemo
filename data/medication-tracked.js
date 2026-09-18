/**
 * DEMO DATA for Inventory ▸ Daily Count Sheet — the drawer count. Every
 * medication, strength and carried-forward figure is invented.
 *
 * WHERE THIS SHEET LIVES, AND WHY IT MOVED.
 *
 * It was the encounter's Intra-procedure ▸ Medication inventory tab, and it
 * was in the wrong place. A count is only worth anything RECONCILED — against
 * lots, expiry dates, par levels and a wastage register, all of which live
 * once for the whole practice. Kept per encounter it reconciled against
 * nothing, because the next case opened a fresh sheet over the same drawer.
 *
 * So the sheet is on Inventory now, beside the register it is counted against,
 * and it is kept BY THE DAY rather than by the case: a drawer is counted at
 * the start of a list and again at the end of one, not eight times because
 * eight patients went through the room.
 *
 * WHAT A COUNT SHEET IS, AND WHY IT IS NOT THE STOCK REGISTER
 *
 * Medication Management answers "how much have we got and what needs
 * reordering" over the whole catalogue, lot by lot, expiry by expiry. This
 * answers one much narrower question, asked at the drawer: the count in it
 * when the day started, everything that went in or out of it since, and
 * whether the number left agrees with the arithmetic.
 *
 * They are different documents because they are worked by different people at
 * different moments. A count is signed off by two nurses standing at an open
 * drawer; the register is maintained at a desk when a delivery arrives. Filing
 * the count as adjustments against lots would spread one signed reconciliation
 * across four boxes and lose the one figure it exists to produce — the
 * discrepancy.
 *
 * PRIOR END IS THE ONLY THING THAT SURVIVES THE DAY. What one day counted out
 * is what the next day counts in, so it is offered as the start count rather
 * than left blank: a sheet that opens empty invites somebody to write down
 * what they see instead of what they were handed, and a drawer that always
 * agrees with itself is a drawer nobody is really counting.
 *
 * The figure here is the seed — what the drawer was left holding before the
 * prototype's records begin. Once a day has been filed, the carry-forward is
 * that day's end count instead; see priorEndFor in js/lib/count-sheet-store.js.
 *
 * A medication with no prior end has never been counted here — it went onto
 * the sheet after the last close — so it starts blank and says nothing, rather
 * than claiming a carried-forward zero nobody wrote. That is what a drug added
 * mid-week looks like; every line SEEDED here carries a figure, because a
 * stocked drawer that has been counted before is the ordinary case and a sheet
 * that opens mostly blank shows the exception as if it were the rule.
 */

export const TRACKED_MEDICATIONS = [
  {
    id: 'trk-diazepam-5',
    name: 'Diazepam (Valium)',
    strength: '5 mg/mL',
    unit: 'mg',
    category: 'benzodiazepine',
    priorEnd: 4,
  },
  {
    id: 'trk-fentanyl-100',
    name: 'Fentanyl',
    strength: '100 mcg/2 mL',
    unit: 'mcg',
    category: 'opioid',
    priorEnd: 26,
  },
  {
    id: 'trk-flumazenil-05',
    name: 'Flumazenil',
    strength: '0.5 mg',
    unit: 'mg',
    category: 'reversal agent',
    priorEnd: 6,
  },
  {
    /* No strength on the tube the practice buys, so the sub-line under the
       name carries the unit alone rather than an invented concentration. */
    id: 'trk-lidocaine-topical',
    name: 'Lidocaine Topical',
    strength: '',
    unit: 'mg',
    category: 'anaesthetic',
    priorEnd: 3,
  },
  {
    id: 'trk-meperidine-50',
    name: 'Meperidine (Demerol)',
    strength: '50 mg/mL',
    unit: 'mg',
    category: 'opioid',
    priorEnd: 12,
  },
  {
    id: 'trk-midazolam-oral',
    name: 'Midazolam (Oral)',
    strength: '5 mg/2.5 mL',
    unit: 'mg',
    category: 'benzodiazepine',
    priorEnd: 9,
  },
  /*
   * THE SAME DRUG TWICE, ON PURPOSE.
   *
   * Two strengths of Versed sit in the drawer and they are counted separately,
   * because a 10 mg vial and a 2 mg vial are not interchangeable units — one
   * line for "Midazolam (Versed)" would be a count of two different things
   * added together, which is the error a controlled-drug sheet exists to
   * catch. The strength under the name is what tells the two rows apart, which
   * is also why the add dialog offers it.
   */
  {
    id: 'trk-midazolam-10',
    name: 'Midazolam (Versed)',
    strength: '10 mg/10 mL',
    unit: 'mg',
    category: 'benzodiazepine',
    priorEnd: 15,
  },
  {
    id: 'trk-midazolam-2',
    name: 'Midazolam (Versed)',
    strength: '2 mg/2 mL',
    unit: 'mg',
    category: 'benzodiazepine',
    priorEnd: 22,
  },
];

/*
 * WHAT THE ADD DIALOG OFFERS FOR THE TWO FIELDS THAT HAVE A CLOSED SET.
 *
 * The name and the strength are typed, because a drawer holds whatever the
 * practice buys and a fixed list of drugs is a list the next delivery is not
 * on. The unit and the category are not like that: a unit is one of a handful
 * of measures and typing it freehand gives you "mcg", "µg" and "ug" as three
 * different columns of the same drug, which is exactly the arithmetic this
 * sheet exists to protect.
 *
 * mL is capitalised the way a vial is, not the way a keyboard is. It is the
 * string that goes under a drug's name on the sheet, so it has to match what
 * the person counting is reading off the box.
 */
export const TRACKED_UNITS = ['mg', 'mcg', 'g', 'mL', 'units'];

/*
 * Why the drawer holds it, which is not the same question as what it does. A
 * count sheet is a controlled-drug document first: the categories are the ones
 * that decide whether a line needs a witness against its wastage, and
 * "anaesthetic" is here because the lidocaine is in the same drawer rather
 * than because anybody counts it as tightly.
 */
export const TRACKED_CATEGORIES = [
  'benzodiazepine',
  'opioid',
  'reversal agent',
  'anaesthetic',
  'other',
];

/**
 * A line nobody has touched yet.
 *
 * Added, Given and Wasted open at zero because zero is the truth about a drug
 * nobody has taken out of the drawer — the sheet is asking "what moved", and
 * for most of the drawer the answer is nothing.
 *
 * Start and End open EMPTY, because they are the two figures somebody has to
 * physically count. A zero pre-filled into either is a count nobody made, and
 * the sheet cannot tell it apart from one they did — except at the start of a
 * shift that was HANDED a closing figure, which is what `priorEnd` is.
 */
export const blankCount = (priorEnd = null) => ({
  start: priorEnd == null ? '' : String(priorEnd),
  added: '0',
  given: '0',
  givenBy: '',
  wasted: '0',
  witness: '',
  end: '',
});

/**
 * The count that should be in the drawer: what was there, plus what went in,
 * less what went out.
 *
 * Kept here beside the fixture rather than in the screen, because it is the
 * definition of the document — the expected figure and the discrepancy are the
 * same sum read from two ends, and two copies of it would be two answers.
 */
export function expectedEnd({ start, added, given, wasted }) {
  return num(start) + num(added) - num(given) - num(wasted);
}

/**
 * End count against expected, or null while nothing has been counted.
 *
 * Null rather than zero: an uncounted drawer and a drawer that counted right
 * are the opposite of each other, and a column showing 0 for both would report
 * every untouched line as reconciled.
 */
export function discrepancy(row) {
  if (row.end === '' || row.end == null) return null;
  return num(row.end) - expectedEnd(row);
}

/** Blank reads as nothing rather than NaN — a field nobody has typed in is
 *  not a number, and arithmetic against it has to treat it as no movement. */
function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
