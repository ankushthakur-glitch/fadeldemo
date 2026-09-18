/**
 * DEMO DATA for Settings ▸ Medication Inventory.
 * Every lot number, quantity and name is invented.
 *
 * THE MODEL, AND WHY IT IS TWO TABLES
 *
 * A medication is a thing the practice stocks. A LOT is a physical box of it
 * that arrived on a date, from a manufacturer, with an expiry. They are not
 * the same record and the difference is the whole screen:
 *
 *     MEDICATIONS      Paracetamol 500 mg Tablet · Analgesic · reorder at 50
 *       └─ lots        LOT-PCM-24  102  exp 2027-02-28
 *                      LOT-PCM-31   84  exp 2026-09-30
 *                      LOT-PCM-19    0  exp 2025-08-06   ← expired, not stock
 *
 * "How much Paracetamol do we have?" is a question about the medication.
 * "Which box do I open next?" is a question about the lots. The list screen
 * answers the first, the detail screen answers the second.
 *
 * EXPIRY IS NOT DECORATION. An expired lot is excluded from the available
 * total — counting it would tell the desk they have stock they may not give a
 * patient, which is the one mistake an inventory screen must not make.
 */

/** Fixed so the statuses and "expires in N days" stay stable in review. */
export const TODAY = '2026-08-04';

/* ============================================================================
   TYPES

   The Medication Type column, and the filter above it. One vocabulary, so a
   drug filed under "Antibiotic" is found by the filter that says Antibiotic.
   ========================================================================= */
export const MEDICATION_TYPES = [
  'Analgesic',
  'Antibiotic',
  'Antidiabetic',
  'Antiemetic',
  'Antihistamine',
  'Antihypertensive',
  'Biologic',
  'Bronchodilator',
  'Corticosteroid',
  'Hormonal',
  'Immunosuppressant',
  'Lipid Lowering',
  'NSAID',
  'Proton Pump Inhibitor',
  'Reversal Agent',
  'Sedative',
];

export const MANUFACTURERS = [
  'Abbott',
  'Alembic Pharma',
  'Alkem Labs',
  'Cipla Ltd.',
  "Dr. Reddy's Labs",
  'GlaxoSmithKline',
  'Intas Pharma',
  'Janssen Biotech',
  'Lupin Ltd.',
  'Mankind Pharma',
  'Novo Nordisk',
  'Pfizer',
  'Sun Pharma',
  'Takeda',
  'Torrent Pharma',
];

/* ============================================================================
   THE CATALOGUE

   Everything the practice is set up to stock — NOT everything it currently
   holds. The two differ on purpose: a drug that has run out completely still
   has to be findable, or the first thing you do when you run out is lose the
   ability to record that you have reordered it.

   `threshold` is the reorder point, and it belongs here rather than on a lot.
   You reorder a medication; a box does not have a reorder level of its own.

   `unit` is what ONE of the available quantity is — a tablet, a vial, an
   ampoule. It reads as decoration on this screen, where the column is just a
   number, and it is load-bearing wherever a dose meets a shelf: a sedation
   record says "2 mg" and the shelf counts ampoules, so the ledger has to be
   able to take one ampoule off a lot for a 2 mg dose rather than pretending a
   dose and a stock count are the same number.
   ========================================================================= */
export const MEDICATIONS = [
  { id: 'med-pcm', name: 'Paracetamol 500 mg Tablet', type: 'Analgesic', threshold: 100, unit: 'tablet' },
  { id: 'med-amx', name: 'Amoxicillin 250 mg Capsule', type: 'Antibiotic', threshold: 60, unit: 'capsule' },
  { id: 'med-ins', name: 'Insulin Glargine 100 IU/mL Injection', type: 'Antidiabetic', threshold: 20, unit: 'pen' },
  { id: 'med-ctz', name: 'Cetirizine 10 mg Tablet', type: 'Antihistamine', threshold: 80, unit: 'tablet' },
  { id: 'med-sal', name: 'Salbutamol 100 mcg Inhaler', type: 'Bronchodilator', threshold: 10, unit: 'inhaler' },
  { id: 'med-met', name: 'Metformin 500 mg Tablet', type: 'Antidiabetic', threshold: 100, unit: 'tablet' },
  { id: 'med-aml', name: 'Amlodipine 5 mg Tablet', type: 'Antihypertensive', threshold: 60, unit: 'tablet' },
  { id: 'med-atr', name: 'Atorvastatin 10 mg Tablet', type: 'Lipid Lowering', threshold: 60, unit: 'tablet' },
  { id: 'med-omp', name: 'Omeprazole 20 mg Capsule', type: 'Proton Pump Inhibitor', threshold: 80, unit: 'capsule' },
  { id: 'med-azi', name: 'Azithromycin 500 mg Tablet', type: 'Antibiotic', threshold: 40, unit: 'tablet' },
  { id: 'med-dic', name: 'Diclofenac 50 mg Tablet', type: 'NSAID', threshold: 60, unit: 'tablet' },
  { id: 'med-los', name: 'Losartan 50 mg Tablet', type: 'Antihypertensive', threshold: 60, unit: 'tablet' },
  { id: 'med-lev', name: 'Levothyroxine 50 mcg Tablet', type: 'Hormonal', threshold: 40, unit: 'tablet' },
  { id: 'med-pan', name: 'Pantoprazole 40 mg Tablet', type: 'Proton Pump Inhibitor', threshold: 80, unit: 'tablet' },

  /* The infusion suite's own shelf. A gastroenterology practice that runs
     biologics holds these, and they are the expensive, cold-chain, tightly
     counted end of the inventory — which is exactly where a reorder point
     earns its keep. */
  { id: 'med-inf', name: 'Infliximab 100 mg Vial', type: 'Biologic', threshold: 8, unit: 'vial' },
  { id: 'med-ved', name: 'Vedolizumab 300 mg Vial', type: 'Biologic', threshold: 6, unit: 'vial' },
  { id: 'med-ada', name: 'Adalimumab 40 mg Pen', type: 'Biologic', threshold: 10, unit: 'pen' },
  { id: 'med-mes', name: 'Mesalamine 800 mg Tablet', type: 'Immunosuppressant', threshold: 90, unit: 'tablet' },
  { id: 'med-bud', name: 'Budesonide 3 mg Capsule', type: 'Corticosteroid', threshold: 40, unit: 'capsule' },
  { id: 'med-irn', name: 'Ferric Carboxymaltose 500 mg Vial', type: 'Biologic', threshold: 6, unit: 'vial' },

  /* ------------------------------------------------------------------------
     THE PROCEDURE TROLLEY.

     The drugs an endoscopy list actually runs on, and the reason the shelf
     and the chart were joined at all. They were charted on the encounter and
     stocked nowhere: the sedation record knew Midazolam had been given and
     the inventory had never heard of it, so nothing could answer "how much
     did today's list cost us" or "do we have enough for tomorrow".

     `procedureUse` marks them as trolley stock — the drugs a case can draw
     down, and the only ones the ledger ever takes a lot off for. Nobody is
     pushing Atorvastatin during a colonoscopy.

     Reorder points are deliberately tight. These come off the shelf several
     times a day, so a week's drift is the difference between a full list and
     a cancelled one. Reversal agents are the exception: naloxone and
     flumazenil are stocked to be THERE, not to be used, and their reorder
     point is a floor nobody expects to approach.
     --------------------------------------------------------------------- */
  { id: 'med-mid', name: 'Midazolam 5 mg/5 mL Ampoule', type: 'Sedative', threshold: 40, unit: 'ampoule', procedureUse: true },
  { id: 'med-fen', name: 'Fentanyl 100 mcg/2 mL Ampoule', type: 'Analgesic', threshold: 40, unit: 'ampoule', procedureUse: true },
  { id: 'med-pro', name: 'Propofol 200 mg/20 mL Vial', type: 'Sedative', threshold: 30, unit: 'vial', procedureUse: true },
  { id: 'med-ond', name: 'Ondansetron 4 mg/2 mL Ampoule', type: 'Antiemetic', threshold: 25, unit: 'ampoule', procedureUse: true },
  { id: 'med-lid', name: 'Lidocaine 10% Topical Spray', type: 'Analgesic', threshold: 4, unit: 'bottle', procedureUse: true },
  { id: 'med-flu', name: 'Flumazenil 0.5 mg/5 mL Ampoule', type: 'Reversal Agent', threshold: 6, unit: 'ampoule', procedureUse: true },
  { id: 'med-nal', name: 'Naloxone 0.4 mg/mL Ampoule', type: 'Reversal Agent', threshold: 6, unit: 'ampoule', procedureUse: true },
];

/** The trolley, in catalogue order — what a case can draw from. */
export const PROCEDURE_MEDICATIONS = MEDICATIONS.filter((m) => m.procedureUse);

export const medicationById = (id) => MEDICATIONS.find((m) => m.id === id) ?? null;

/* ============================================================================
   THE LOTS

   `addedBy` is a name, not an id: it is provenance for a physical count, and
   the person who booked a box in is often not a system user at all.
   ========================================================================= */
export const STOCK_ENTRIES = [
  /* Paracetamol — the worked example. Three lots, one of them already dead. */
  { id: 'stk-001', medicationId: 'med-pcm', lot: 'LOT-PCM-24', manufacturer: 'Cipla Ltd.', addedOn: '2025-12-12', addedBy: 'Dianne Russell', quantity: 102, received: 200, expiry: '2027-02-28', waste: [{ quantity: 6, reason: 'Damaged in transit', by: 'Dianne Russell', on: '2025-12-12' }] },
  { id: 'stk-002', medicationId: 'med-pcm', lot: 'LOT-PCM-31', manufacturer: 'Cipla Ltd.', addedOn: '2026-02-09', addedBy: 'Floyd Miles', quantity: 84, received: 100, expiry: '2026-09-30' },
  { id: 'stk-003', medicationId: 'med-pcm', lot: 'LOT-PCM-19', manufacturer: 'Sun Pharma', addedOn: '2025-05-08', addedBy: 'Bessie Cooper', quantity: 40, received: 100, expiry: '2025-08-06' },

  { id: 'stk-010', medicationId: 'med-amx', lot: 'LOT-AMX-18', manufacturer: 'Sun Pharma', addedOn: '2026-02-11', addedBy: 'Floyd Miles', quantity: 45, received: 100, expiry: '2026-11-30' },

  { id: 'stk-020', medicationId: 'med-ins', lot: 'LOT-INS-09', manufacturer: 'Novo Nordisk', addedOn: '2026-05-09', addedBy: 'Robert Fox', quantity: 12, received: 60, expiry: '2026-10-15', waste: [{ quantity: 3, reason: 'Cold-chain excursion', by: 'Robert Fox', on: '2026-06-02' }, { quantity: 2, reason: 'Broken vial or container', by: 'K. Brandt, RN', on: '2026-07-14' }] },

  { id: 'stk-030', medicationId: 'med-ctz', lot: 'LOT-CTZ-31', manufacturer: "Dr. Reddy's Labs", addedOn: '2026-01-09', addedBy: 'Albert Flores', quantity: 210, received: 240, expiry: '2027-06-30' },

  /* Salbutamol — genuinely nothing on the shelf. */
  { id: 'stk-040', medicationId: 'med-sal', lot: 'LOT-SAL-07', manufacturer: 'GlaxoSmithKline', addedOn: '2025-09-01', addedBy: 'Bessie Cooper', quantity: 0, received: 30, expiry: '2027-01-31' },

  { id: 'stk-050', medicationId: 'med-met', lot: 'LOT-MET-22', manufacturer: 'Lupin Ltd.', addedOn: '2026-03-18', addedBy: 'Dianne Russell', quantity: 180, received: 240, expiry: '2027-04-30' },
  { id: 'stk-051', medicationId: 'med-met', lot: 'LOT-MET-27', manufacturer: 'Lupin Ltd.', addedOn: '2026-06-02', addedBy: 'Jacob Jones', quantity: 60, received: 60, expiry: '2027-11-30' },

  { id: 'stk-060', medicationId: 'med-aml', lot: 'LOT-AML-14', manufacturer: 'Torrent Pharma', addedOn: '2026-04-22', addedBy: 'Jacob Jones', quantity: 65, received: 120, expiry: '2027-03-31' },

  { id: 'stk-070', medicationId: 'med-atr', lot: 'LOT-ATR-11', manufacturer: 'Pfizer', addedOn: '2026-01-30', addedBy: 'Albert Flores', quantity: 20, received: 200, expiry: '2026-08-31' },

  { id: 'stk-080', medicationId: 'med-omp', lot: 'LOT-OMP-06', manufacturer: 'Abbott', addedOn: '2026-03-03', addedBy: 'Brooklyn Simmons', quantity: 95, received: 120, expiry: '2027-05-31' },

  { id: 'stk-090', medicationId: 'med-azi', lot: 'LOT-AZI-19', manufacturer: 'Alembic Pharma', addedOn: '2026-02-20', addedBy: 'Floyd Miles', quantity: 20, received: 100, expiry: '2026-12-31' },

  { id: 'stk-100', medicationId: 'med-dic', lot: 'LOT-DIC-27', manufacturer: 'Intas Pharma', addedOn: '2026-04-04', addedBy: 'Dianne Russell', quantity: 140, received: 200, expiry: '2027-07-31' },

  { id: 'stk-110', medicationId: 'med-los', lot: 'LOT-LOS-33', manufacturer: 'Mankind Pharma', addedOn: '2026-06-08', addedBy: 'Jacob Jones', quantity: 72, received: 120, expiry: '2027-08-31' },

  /* Levothyroxine — 15 on the shelf but the lot expired in May. Reads
     "Expired", and the available total is 0, because expired stock is not
     stock. This is the row that proves the rule. */
  { id: 'stk-120', medicationId: 'med-lev', lot: 'LOT-LEV-04', manufacturer: 'Abbott', addedOn: '2025-05-08', addedBy: 'Bessie Cooper', quantity: 15, received: 60, expiry: '2026-05-31' },

  { id: 'stk-130', medicationId: 'med-pan', lot: 'LOT-PAN-21', manufacturer: 'Alkem Labs', addedOn: '2026-03-02', addedBy: 'Brooklyn Simmons', quantity: 110, received: 150, expiry: '2027-02-28' },

  /* The infusion shelf. */
  { id: 'stk-140', medicationId: 'med-inf', lot: 'LOT-INF-52', manufacturer: 'Janssen Biotech', addedOn: '2026-06-15', addedBy: 'K. Brandt, RN', quantity: 14, received: 30, expiry: '2027-09-30' },
  { id: 'stk-141', medicationId: 'med-inf', lot: 'LOT-INF-48', manufacturer: 'Janssen Biotech', addedOn: '2026-03-11', addedBy: 'K. Brandt, RN', quantity: 6, received: 30, expiry: '2026-09-15', waste: [{ quantity: 2, reason: 'Preparation error', by: 'K. Brandt, RN', on: '2026-05-30' }] },
  { id: 'stk-150', medicationId: 'med-ved', lot: 'LOT-VED-12', manufacturer: 'Takeda', addedOn: '2026-05-20', addedBy: 'K. Brandt, RN', quantity: 5, received: 20, expiry: '2027-04-30' },
  { id: 'stk-160', medicationId: 'med-ada', lot: 'LOT-ADA-77', manufacturer: 'Abbott', addedOn: '2026-07-01', addedBy: 'Robert Fox', quantity: 24, received: 30, expiry: '2027-10-31' },
  { id: 'stk-170', medicationId: 'med-mes', lot: 'LOT-MES-40', manufacturer: 'Sun Pharma', addedOn: '2026-04-18', addedBy: 'Dianne Russell', quantity: 240, received: 300, expiry: '2027-12-31' },
  { id: 'stk-180', medicationId: 'med-bud', lot: 'LOT-BUD-15', manufacturer: 'Takeda', addedOn: '2026-05-05', addedBy: 'Albert Flores', quantity: 38, received: 60, expiry: '2026-08-25', waste: [{ quantity: 4, reason: 'Spillage', by: 'Albert Flores', on: '2026-06-19' }] },
  { id: 'stk-190', medicationId: 'med-irn', lot: 'LOT-IRN-08', manufacturer: 'Pfizer', addedOn: '2026-06-28', addedBy: 'K. Brandt, RN', quantity: 9, received: 12, expiry: '2027-06-30' },

  /* ------------------------------------------------------------------------
     THE PROCEDURE TROLLEY, AS BOOKED IN.

     `quantity` here is what was on the shelf after the box was opened and any
     receipt damage written off — BEFORE a single list ran. Procedure use is
     not baked into these numbers; it is applied by data/medication-usage.js,
     which walks the day's administrations and draws each one from the lot it
     came out of.

     Kept that way round on purpose. A hand-reconciled quantity is a number
     somebody has to remember to re-derive every time a usage row is added or
     moved, and the first time they forget, the shelf and the log disagree with
     no way to tell which is wrong. Derived, they cannot drift.

     Midazolam and Propofol carry two lots each so the report has a real
     first-expired-first-out choice to make, and LOT-MID-88 is close enough to
     expiry that it is the one being worked through.
     --------------------------------------------------------------------- */
  { id: 'stk-200', medicationId: 'med-mid', lot: 'LOT-MID-88', manufacturer: 'Pfizer', addedOn: '2026-05-14', addedBy: 'K. Brandt, RN', quantity: 100, received: 100, expiry: '2026-10-31' },
  { id: 'stk-201', medicationId: 'med-mid', lot: 'LOT-MID-92', manufacturer: 'Pfizer', addedOn: '2026-07-20', addedBy: 'K. Brandt, RN', quantity: 100, received: 100, expiry: '2027-06-30' },

  { id: 'stk-210', medicationId: 'med-fen', lot: 'LOT-FEN-45', manufacturer: 'Janssen Biotech', addedOn: '2026-06-11', addedBy: 'K. Brandt, RN', quantity: 100, received: 100, expiry: '2027-03-31' },

  { id: 'stk-220', medicationId: 'med-pro', lot: 'LOT-PRO-63', manufacturer: 'Abbott', addedOn: '2026-06-02', addedBy: 'Robert Fox', quantity: 48, received: 50, expiry: '2026-11-30', waste: [{ quantity: 2, reason: 'Damaged in transit', by: 'Robert Fox', on: '2026-06-02' }] },
  { id: 'stk-221', medicationId: 'med-pro', lot: 'LOT-PRO-71', manufacturer: 'Abbott', addedOn: '2026-07-28', addedBy: 'Robert Fox', quantity: 50, received: 50, expiry: '2027-05-31' },

  { id: 'stk-230', medicationId: 'med-ond', lot: 'LOT-OND-29', manufacturer: 'Alkem Labs', addedOn: '2026-06-19', addedBy: 'Dianne Russell', quantity: 50, received: 50, expiry: '2027-08-31' },

  { id: 'stk-240', medicationId: 'med-lid', lot: 'LOT-LID-03', manufacturer: 'Torrent Pharma', addedOn: '2026-04-30', addedBy: 'Dianne Russell', quantity: 12, received: 12, expiry: '2027-04-30' },

  /* Reversal agents. Stocked to BE there — a box that never moves is the point
     of them, so the counts are small and the expiry is the thing to watch. */
  { id: 'stk-250', medicationId: 'med-flu', lot: 'LOT-FLU-17', manufacturer: 'Cipla Ltd.', addedOn: '2026-01-15', addedBy: 'K. Brandt, RN', quantity: 10, received: 10, expiry: '2027-01-31' },
  { id: 'stk-260', medicationId: 'med-nal', lot: 'LOT-NAL-22', manufacturer: 'Cipla Ltd.', addedOn: '2026-01-15', addedBy: 'K. Brandt, RN', quantity: 10, received: 10, expiry: '2027-02-28' },
];

/* ============================================================================
   WASTE

   Stock that was destroyed rather than given. It is tracked separately from an
   ordinary adjustment because it is a different KIND of fact: a dispensed unit
   reached a patient, a wasted one did not and somebody has to account for it.
   Wastage is a cost line, a quality signal and — for controlled and biologic
   stock — a reportable one, so it is recorded as a log with a name against
   each entry rather than a number that quietly goes down.
   ========================================================================= */

export const WASTE_REASONS = [
  'Broken vial or container',
  'Damaged in transit',
  'Contaminated',
  'Cold-chain excursion',
  'Expired — withdrawn',
  'Part-dose discarded',
  'Spillage',
  'Preparation error',
];

/**
 * Who may be named as having wasted stock.
 *
 * A short list of the people who actually handle it, not the whole 150-strong
 * user directory: a free-text name cannot be held to account and a directory
 * that long turns a two-second entry into a search.
 */
export const STOCK_HANDLERS = [
  'Amara Mensah',
  'K. Brandt, RN',
  'Dianne Russell',
  'Floyd Miles',
  'Robert Fox',
  'Albert Flores',
  'Bessie Cooper',
  'Brooklyn Simmons',
  'Jacob Jones',
];

/** Everything wasted out of one lot. */
export const wastedTotal = (entry) =>
  (entry.waste ?? []).reduce((sum, w) => sum + w.quantity, 0);

/** The distinct people named on a lot's waste log, most recent first. */
export function wastedBy(entry) {
  const seen = [];
  for (const record of [...(entry.waste ?? [])].reverse()) {
    if (!seen.includes(record.by)) seen.push(record.by);
  }
  return seen;
}

/* ============================================================================
   STATUS

   Four, and each one means something different to the person reading it:

     In Stock     nothing to do
     Low Stock    still usable, but reorder now
     Out of Stock there is none — do not promise it to a patient
     Expired      there IS some, and it may not be given

   Expired is separate from Out of Stock on purpose. They look the same to a
   count and are completely different to a nurse: one shelf is empty, the other
   has boxes on it that have to be pulled and destroyed.
   ========================================================================= */
export const STOCK_STATUSES = {
  'in-stock': { label: 'In Stock', tone: 'success' },
  'low-stock': { label: 'Low Stock', tone: 'warning' },
  'out-of-stock': { label: 'Out of Stock', tone: 'critical' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** Whole days from `from` to `iso`; negative once the date has passed. */
export function daysUntil(iso, from = TODAY) {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((new Date(iso).getTime() - new Date(from).getTime()) / day);
}

export const isExpired = (entry, today = TODAY) => daysUntil(entry.expiry, today) < 0;

/** Within three months — near enough to use first, not near enough to pull. */
export const EXPIRING_SOON_DAYS = 90;

export const isExpiringSoon = (entry, today = TODAY) => {
  const days = daysUntil(entry.expiry, today);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
};

/**
 * How little is left of a box before it counts as nearly gone.
 *
 * A lot cannot be judged against the medication's reorder point — that number
 * is about the shelf, not the box. Measured that way, a full 84-unit carton of
 * a drug we reorder at 100 reads "Low Stock" while the medication above it
 * reads "In Stock", and the screen contradicts itself. Measured against what
 * ARRIVED in that box, "low" means what a nurse means by it: nearly used up,
 * open the next one.
 */
export const LOT_LOW_FRACTION = 0.2;

/** One lot's own status. Nothing here consults the medication. */
export function entryStatus(entry, today = TODAY) {
  if (isExpired(entry, today)) return 'expired';
  if (entry.quantity <= 0) return 'out-of-stock';
  const received = entry.received || entry.quantity;
  return entry.quantity <= received * LOT_LOW_FRACTION ? 'low-stock' : 'in-stock';
}

/**
 * A medication rolled up from its lots.
 *
 * `available` counts only lots that may actually be given, so a shelf full of
 * expired boxes reads as nothing available — which is the truth.
 */
export function summarise(medication, entries, today = TODAY) {
  const lots = entries.filter((e) => e.medicationId === medication.id);
  const usable = lots.filter((e) => !isExpired(e, today) && e.quantity > 0);
  const available = usable.reduce((sum, e) => sum + e.quantity, 0);

  /* First-expired, first-out: the lot the nurse should open next, and
     therefore the one worth naming on a one-line-per-medication list. */
  const next = [...usable].sort((a, b) => a.expiry.localeCompare(b.expiry))[0] ?? null;

  let status = 'in-stock';
  if (available <= 0) status = lots.some((e) => isExpired(e, today)) ? 'expired' : 'out-of-stock';
  else if (available <= medication.threshold) status = 'low-stock';

  return {
    ...medication,
    lots,
    lotCount: lots.length,
    available,
    next,
    status,
    expiredCount: lots.filter((e) => isExpired(e, today)).length,
    /* Across every lot, including expired ones — waste that happened before a
       box went out of date still happened, and a wastage figure that resets
       when the lot expires is a wastage figure nobody can act on. */
    wasted: lots.reduce((sum, e) => sum + wastedTotal(e), 0),
  };
}
