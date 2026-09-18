/**
 * DEMO DATA for Profile · Clinical.
 * Entirely invented — no real patient information.
 *
 * This is the canonical home for a patient's clinical record. It used to be
 * split across the Face Sheet (allergies, diagnoses, medications, vaccines,
 * social history, procedures, vitals); that content moved here so it exists
 * in exactly one place, and Face Sheet now only carries the AI highlights
 * summary that points back at it.
 *
 * Alerts and the upcoming appointment are NOT duplicated here — they already
 * live in data/patient-chart.js (patient.alerts, patient.activity.upcoming),
 * which the shell header and this module both read directly.
 *
 * PAST MEDICAL, SURGICAL AND SOCIAL HISTORY ARE NOT HERE EITHER. They moved
 * to data/chart-history.js when History became a section of its own, for the
 * same reason everything moved here from the Face Sheet: the section
 * maintains them and Profile · Clinical summarises them, and two copies of
 * the answer to "what has this patient had" would be free to disagree the
 * moment either was edited. `procedures` was the old name for the surgical
 * list and `socialHistory` for the questionnaire; both are gone from this
 * file rather than kept as a second, staler copy.
 *
 * Keyed by MRN, same as every other per-patient data file in this chart.
 */

import { medicationById } from './medication-inventory.js';

export const PROFILE_CLINICAL = {
  326486: {
    summaryNotes:
      'Long-standing GI patient, well engaged with care. Diabetes diet- and metformin-controlled. ' +
      'Confirm penicillin allergy verbally before any antibiotic order.',

    problems: [
      { code: 'K21.9', label: 'GORD', status: 'Active', date: '04-10-2024' },
      {
        code: 'E11.9',
        label: 'Type 2 diabetes mellitus',
        status: 'Active',
        date: '23-08-2020',
        note: 'Diet- and metformin-controlled',
      },
      { code: 'K57.30', label: 'Diverticulosis of colon', status: 'Active', date: '15-03-2023' },
      { code: 'I10', label: 'Essential hypertension', status: 'Active', date: '11-01-2022' },
      { code: 'K44.9', label: 'Diaphragmatic hernia', status: 'Active', date: '12-11-2025' },
    ],

    medications: [
      { name: 'Metformin 500mg', dose: 'Twice daily', startDate: '23-08-2020', status: 'active' },
      { name: 'Omeprazole 20mg', dose: 'Once daily', startDate: '04-10-2024', status: 'active' },
      { name: 'Amlodipine 5mg', dose: 'Once daily', startDate: '11-01-2022', status: 'active' },
    ],
    medicationReconciliation: { date: '23-10-2025', by: 'Ruth Adeyemi' },

    orders: {
      open: [
        { type: 'Lab', description: 'CBC with differential', date: '20-10-2025' },
        { type: 'Imaging', description: 'Abdominal ultrasound', date: '18-10-2025' },
      ],
      recentlyClosed: [
        { type: 'Lab', description: 'HbA1c', date: '23-08-2025', status: 'Resulted' },
      ],
    },

    recommendations: [
      { label: 'Colorectal cancer screening', frequency: 'Every 10 years', dueDate: '23-10-2035' },
      { label: 'Influenza vaccine', frequency: 'Annual', dueDate: '01-10-2025' },
    ],

    recalls: [{ type: 'Surveillance colonoscopy', date: '23-10-2028', status: 'Scheduled' }],

    vitals: [
      { label: 'Blood pressure', value: '128/82 mmHg', date: '23-10-2025', time: '12:00 PM' },
      { label: 'Heart rate', value: '76 bpm', date: '23-10-2025', time: '12:00 PM' },
      { label: 'BMI', value: '27.4', date: '23-10-2025', time: '12:00 PM' },
      { label: 'Respiratory rate', value: '14 bpm', date: '10-04-2025', time: '09:35 AM' },
    ],

    allergies: [
      {
        substance: 'Penicillin',
        category: 'Medication',
        reaction: 'Anaphylaxis, airway involvement',
        severity: 'Severe',
        onsetDate: '12-06-2019',
      },
      {
        substance: 'Iodinated contrast',
        category: 'Medication',
        reaction: 'Hives, facial swelling',
        severity: 'Moderate',
        onsetDate: '03-02-2021',
      },
      {
        substance: 'Latex',
        category: 'Environment',
        reaction: 'Contact dermatitis',
        severity: 'Mild',
        onsetDate: '11-03-2015',
      },
    ],

    immunizations: [
      { name: 'Influenza, seasonal', date: '10-10-2025' },
      { name: 'COVID-19, mRNA bivalent', date: '15-11-2024' },
      { name: 'Pneumococcal PPSV23', date: '02-05-2023' },
      { name: 'Td booster', date: '20-06-2021' },
    ],

    dxStudies: [
      { type: 'Colonoscopy', date: '23-10-2025', finding: 'Diverticulosis, no polyps' },
      { type: 'EGD', date: '04-10-2024', finding: 'Esophagitis, LA grade A' },
    ],

    implantableDevices: [],

    familyHistory: [
      { relation: 'Mother', condition: 'Colorectal cancer, diagnosed age 68' },
      { relation: 'Father', condition: 'Type 2 diabetes' },
    ],
  },

  326477: {
    summaryNotes: null,
    problems: [{ code: 'K76.0', label: 'Hepatic steatosis', status: 'New', date: '19-10-2025' }],
    medications: [],
    medicationReconciliation: null,
    orders: { open: [], recentlyClosed: [] },
    recommendations: [],
    recalls: [],
    vitals: [
      { label: 'Blood pressure', value: '132/88 mmHg', date: '19-10-2025', time: '10:15 AM' },
      { label: 'Heart rate', value: '82 bpm', date: '19-10-2025', time: '10:15 AM' },
    ],
    allergies: [
      {
        substance: 'Sulfa drugs',
        category: 'Medication',
        reaction: 'Rash',
        severity: 'Moderate',
        onsetDate: '19-10-2025',
      },
    ],
    immunizations: [{ name: 'COVID-19, mRNA bivalent', date: '02-09-2024' }],
    dxStudies: [],
    implantableDevices: [],
    familyHistory: [],
  },

  326481: {
    summaryNotes: null,
    problems: [],
    medications: [],
    medicationReconciliation: null,
    orders: { open: [], recentlyClosed: [] },
    recommendations: [],
    recalls: [],
    vitals: [],
    allergies: [],
    immunizations: [],
    dxStudies: [],
    implantableDevices: [],
    familyHistory: [],
  },

  326495: {
    summaryNotes: 'Pediatric GI follow-up. Guardian consent required for any procedure.',
    problems: [
      { code: 'K90.0', label: 'Celiac disease', status: 'Active', date: '02-01-2026' },
    ],
    medications: [],
    medicationReconciliation: null,
    orders: { open: [{ type: 'Lab', description: 'Celiac panel, repeat', date: '02-01-2026' }], recentlyClosed: [] },
    recommendations: [{ label: 'Bone density follow-up', frequency: 'Once', dueDate: '02-01-2027' }],
    recalls: [],
    vitals: [{ label: 'Height/weight', value: '58 in / 92 lb', date: '02-01-2026', time: '09:00 AM' }],
    allergies: [],
    immunizations: [{ name: 'COVID-19, mRNA bivalent', date: '15-11-2024' }],
    dxStudies: [{ type: 'EGD with biopsy', date: '02-01-2026', finding: 'Villous atrophy, Marsh 3a' }],
    implantableDevices: [],
    familyHistory: [{ relation: 'Mother', condition: 'Celiac disease' }],
  },
};

export const EMPTY_PROFILE_CLINICAL = {
  summaryNotes: null,
  problems: [],
  medications: [],
  medicationReconciliation: null,
  orders: { open: [], recentlyClosed: [] },
  recommendations: [],
  recalls: [],
  vitals: [],
  allergies: [],
  immunizations: [],
  dxStudies: [],
  implantableDevices: [],
  familyHistory: [],
};

/* ============================================================================
   THE CHART FORMULARY — what the "+" on Current Medications offers to fill in.

   The drug added to a reconciled list is nearly always one this practice
   starts itself, and typing "Omeprazole 20 mg Capsule" by hand is how the
   same drug ends up on the list under four spellings. So the six the clinic
   writes most often are on the form, one press away, exactly as the sedation
   cart is on the anaesthesia record (SEDATION_FORMULARY in
   data/procedure-encounter.js). The field stays typed: a drug started at
   another practice is still just typed in, which is most of what a reconciled
   list is made of.

   NAMES COME FROM THE PRACTICE CATALOGUE rather than being written out again
   here. `id` is the inventory's, so a strength corrected in stock control is
   corrected on this form too, and a drug that is renamed cannot end up named
   two ways in one building. The frequency does NOT come from there: how often
   a patient takes something is a fact about the prescription, and the
   inventory is a count of boxes on a shelf.

   The trolley drugs are deliberately absent. Nobody goes home on propofol,
   and the record of what was pushed under sedation is written on the
   encounter, not typed into the chart afterwards.
   ========================================================================= */

const CHART_FORMULARY_SEED = [
  { id: 'med-omp', usual: 'Once daily' },
  { id: 'med-pan', usual: 'Once daily' },
  { id: 'med-mes', usual: 'Three times daily' },
  { id: 'med-bud', usual: 'Once daily' },
  { id: 'med-ada', usual: 'Every other week' },
  { id: 'med-amx', usual: 'Twice daily' },
];

/**
 * The six, resolved against the catalogue.
 *
 * An id the catalogue has never heard of is dropped rather than drawn as a
 * blank button — a quick-select whose label is empty is a button that fills
 * the field with nothing, which is worse than not offering it.
 *
 * @type {Array<{name: string, type: string, usual: string}>}
 */
export const CHART_FORMULARY = CHART_FORMULARY_SEED.flatMap(({ id, usual }) => {
  const drug = medicationById(id);
  return drug ? [{ name: drug.name, type: drug.type, usual }] : [];
});
