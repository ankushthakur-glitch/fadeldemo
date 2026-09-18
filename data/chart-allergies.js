/**
 * PATIENT CHART — ALLERGIES.
 *
 * The recorded allergy list for a patient: what they react to, how badly, and
 * who wrote it down.
 *
 * WHY THIS IS ITS OWN LIST
 * Profile · Clinical carries an `allergies` array too, but that one is the
 * face-sheet summary — substance, reaction, severity — read at a glance beside
 * the diagnoses. This is the maintained record: it adds the onset date, the
 * date it was recorded and the person who recorded it, which is what makes an
 * allergy auditable rather than merely displayed. The two are deliberately
 * separate; merging them would mean the face sheet either grew three columns
 * nobody reads there, or this screen lost the provenance that is its point.
 *
 * ONSET vs RECORDED
 * Two dates, not one. Onset is when the patient first reacted; recorded is
 * when the practice learned of it. They are the same day when a reaction
 * happens in the building and years apart when a patient reports a childhood
 * allergy — and a record that cannot tell those apart cannot answer "how long
 * have we known this".
 */

/* --- The pickers the drawer offers -----------------------------------------
   Allergy names are listed per type: a drug list under Drug, foods under Food.
   One flat list would offer "Latex" under Food, which is how a wrong allergen
   gets filed against the right patient.
   -------------------------------------------------------------------------- */

export const ALLERGY_TYPES = ['Drug', 'Food', 'Environment'];

export const ALLERGY_NAMES = {
  Drug: [
    'Amoxicillin',
    'Aspirin',
    'Codeine',
    'Erythromycin',
    'Ibuprofen',
    'Iodinated contrast',
    'Lithium',
    'Morphine',
    'Penicillin',
    'Sertraline',
    'Sulfonamides',
    'Tetracycline',
  ],
  Food: [
    'Caffeine',
    'Egg',
    'Milk',
    'Peanut',
    'Shellfish',
    'Soy',
    'Tree nut',
    'Wheat',
  ],
  Environment: [
    'Adhesive / tape',
    'Animal dander',
    'Dust mite',
    'Grass pollen',
    'Latex',
    'Mould',
  ],
};

export const ALLERGY_REACTIONS = [
  'Anaphylaxis',
  'Hives',
  'Insomnia, increased anxiety',
  'Itching',
  'Nausea, dizziness',
  'Rash',
  'Respiratory distress',
  'Swelling',
  'Tremors, confusion',
  'Vomiting',
];

export const ALLERGY_SEVERITIES = ['Mild', 'Moderate', 'Severe'];

/** Who can be named as having recorded it — the clinical staff on the floor. */
export const ALLERGY_RECORDERS = [
  'Phyllis Nguyen',
  'Richard Walker',
  'Shelia Stevenson',
  'Kayla Brandt, RN',
  'Amara Mensah',
];

/* --- The recorded lists ---------------------------------------------------- */

/**
 * Keyed by MRN. A patient with no entry has no recorded allergies, which is
 * NOT the same as "no known allergies" — that is a positive statement somebody
 * has to make, and the empty table says so rather than implying it.
 */
export const CHART_ALLERGIES = {
  326486: [
    {
      id: 'al1',
      type: 'Drug',
      allergen: 'Sertraline',
      reaction: 'Nausea, dizziness',
      severity: 'Moderate',
      onsetDate: '04-10-2025',
      recordedDate: '04-10-2025',
      recordedBy: 'Phyllis Nguyen',
      note: '',
    },
    {
      id: 'al2',
      type: 'Drug',
      allergen: 'Lithium',
      reaction: 'Tremors, confusion',
      severity: 'Severe',
      onsetDate: '10-10-2025',
      recordedDate: '10-10-2025',
      recordedBy: 'Richard Walker',
      note: 'Held before the last procedure; confirm level before restarting.',
    },
    {
      id: 'al3',
      type: 'Food',
      allergen: 'Caffeine',
      reaction: 'Insomnia, increased anxiety',
      severity: 'Mild',
      onsetDate: '15-11-2025',
      recordedDate: '15-11-2025',
      recordedBy: 'Shelia Stevenson',
      note: '',
    },
  ],
};

export const EMPTY_CHART_ALLERGIES = [];
