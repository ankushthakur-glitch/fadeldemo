/**
 * DEMO DATA — the clinical encounter.
 * Invented throughout. No real patient information.
 *
 * HOW THE SEVERITY FLAG WORKS
 * Sidebar sections carry `critical: true` on any item that should pull the
 * clinician's eye — a documented anaphylaxis, an out-of-range result, an
 * overdue surveillance. The panel rolls those up so a collapsed section still
 * says "there is something in here", which is the only way a collapsed panel
 * is safe in a clinical context.
 */

/*
 * The note templates the encounter offers.
 *
 * Derived from the documents themselves rather than typed out again. Each
 * title in this list used to be a label with nothing behind it — every one of
 * them rendered the same colonoscopy report — and the way that stayed true for
 * so long is that the list of names and the list of documents were two
 * separate lists. They are one list now: a template exists here because a
 * document for it exists in data/visit-note-templates.js, and adding a name
 * without a document is no longer possible.
 */
export { VISIT_NOTE_TITLES as NOTE_TEMPLATES } from './visit-note-templates.js';

export const SMART_TEMPLATES = [
  'Insert last visit’s plan',
  'Carry forward active problems',
  'Build HPI from triage note',
];

export const FAVOURITE_TEMPLATES = ['SOAP Note', 'Colonoscopy Follow-up'];

/* --- Left sidebar: the clinical record ------------------------------------- */

/*
 * Every section carries a detail line on every row.
 *
 * Several were thin — Social History had three rows with nothing under two of
 * them, and most sections stopped at the two or three entries needed to prove
 * the layout worked. That is fine for a layout and wrong for a review: a rail
 * whose sections each hold two lines never shows what it does when a real
 * problem list, a real medication list or a real set of labs is in it, which is
 * the thing being decided when someone looks at this screen. So each section is
 * now the length it would plausibly be for THIS patient — a 49-year-old on
 * infliximab for ileal Crohn's, anaemic, in for a surveillance colonoscopy —
 * and the detail line is never empty, because a row with a blank second line
 * makes the whole column look ragged for no reason.
 *
 * `critical` marks the row somebody flagged. On an allergy it means the
 * reaction is anaphylactic; everywhere else it means "this is the one that
 * matters", which is why the rail spells the two out differently.
 */
export const CLINICAL_SECTIONS = [
  {
    id: 'diagnosis',
    label: 'Diagnosis',
    items: [
      { text: 'Crohn’s disease of ileum, without complication', meta: 'K50.00 · active since 2019' },
      { text: 'Iron deficiency anaemia', meta: 'D50.9 · active', critical: true },
      { text: 'Vitamin D deficiency', meta: 'E55.9 · active' },
      { text: 'Perianal fistula, healed', meta: 'K60.3 · resolved 2022' },
      { text: 'Migraine without aura', meta: 'G43.009 · resolved' },
    ],
  },
  {
    id: 'allergies',
    label: 'Allergies',
    items: [
      { text: 'Penicillin', meta: 'Anaphylaxis — documented 2014', critical: true },
      { text: 'Egg and soy', meta: 'Hives — documented 2011, propofol precaution', critical: true },
      { text: 'Sulfonamides', meta: 'Rash — documented 2016' },
      { text: 'Latex', meta: 'Contact dermatitis — use latex-free gloves' },
      { text: 'Adhesive tape', meta: 'Skin irritation — use paper tape' },
    ],
  },
  {
    id: 'medications',
    label: 'Current Medications',
    items: [
      { text: 'Infliximab 5 mg/kg IV', meta: 'Every 8 weeks · last 3 Aug 2026' },
      { text: 'Ferrous sulfate 325 mg', meta: 'Once daily, oral · with vitamin C' },
      { text: 'Cholecalciferol 800 IU', meta: 'Once daily, oral' },
      { text: 'Azathioprine 100 mg', meta: 'Once daily, oral · FBC monthly' },
      { text: 'Loperamide 2 mg', meta: 'As needed, up to four times daily' },
      { text: 'Paracetamol 500 mg', meta: 'As needed · avoid NSAIDs', critical: true },
    ],
  },
  {
    id: 'history',
    label: 'Medical History',
    items: [
      { text: 'Crohn’s disease', meta: 'Diagnosed 2019 · ileocolonic, stricturing' },
      { text: 'Iron deficiency anaemia', meta: 'Recurrent · two iron infusions since 2023' },
      { text: 'Migraine without aura', meta: 'Resolved · none since 2021' },
      { text: 'Vitamin D deficiency', meta: 'On replacement since 2020' },
      { text: 'Anxiety', meta: 'Situational · no current treatment' },
    ],
  },
  {
    id: 'surgical',
    label: 'Surgical History',
    items: [
      { text: 'Ileocaecal resection', meta: 'March 2021 · open, 20 cm' },
      { text: 'Examination under anaesthesia, fistula', meta: 'August 2022 · seton removed' },
      { text: 'Appendicectomy', meta: '2003 · laparoscopic' },
      { text: 'Wisdom tooth extraction', meta: '1998 · general anaesthetic, uneventful' },
    ],
  },
  {
    id: 'family',
    label: 'Family History',
    items: [
      { text: 'Mother — ulcerative colitis', meta: 'Diagnosed age 44' },
      { text: 'Father — colorectal carcinoma', meta: 'Age 61 · surveillance indication', critical: true },
      { text: 'Sister — coeliac disease', meta: 'Diagnosed age 29' },
      { text: 'Maternal grandmother — type 2 diabetes', meta: 'Diagnosed age 58' },
    ],
  },
  {
    id: 'social',
    label: 'Social History',
    items: [
      { text: 'Never smoker', meta: 'Never smoked · no vaping' },
      { text: 'Alcohol — 4 units per week', meta: 'Wine with meals · no binge drinking' },
      { text: 'Works as a teacher', meta: 'Primary school · lives with partner' },
      { text: 'Exercise — walks daily', meta: 'About 30 minutes, no formal exercise' },
      { text: 'Escort home arranged', meta: 'Partner collecting · confirmed 3 Aug', critical: true },
    ],
  },
  {
    id: 'vitals',
    label: 'Vitals',
    items: [
      { text: 'BP 118/74 mmHg', meta: 'Today, 08:02' },
      { text: 'Pulse 72 bpm', meta: 'Today, 08:02 · regular' },
      { text: 'Temp 36.8 °C', meta: 'Today, 08:02 · tympanic' },
      { text: 'SpO₂ 98% on air', meta: 'Today, 08:02' },
      { text: 'Height 1.63 m', meta: 'Recorded 3 Aug 2026' },
      { text: 'Weight 61.4 kg', meta: 'Down 2.1 kg since March · BMI 23.1', critical: true },
    ],
  },
  {
    id: 'vaccines',
    label: 'Vaccinations',
    items: [
      { text: 'Influenza', meta: 'October 2025 · annual, on immunosuppression' },
      { text: 'COVID-19 booster', meta: 'November 2025' },
      { text: 'Pneumococcal', meta: 'Due — on immunosuppression', critical: true },
      { text: 'Hepatitis B', meta: 'Course complete 2019 · immune' },
      { text: 'Shingles', meta: 'Not given · discuss with gastroenterology' },
    ],
  },
  {
    id: 'labs',
    label: 'Lab Results',
    items: [
      { text: 'Haemoglobin 10.4 g/dL', meta: 'Low · 2 Aug 2026', critical: true },
      { text: 'Ferritin 18 ng/mL', meta: 'Low · 2 Aug 2026', critical: true },
      { text: 'CRP 8 mg/L', meta: 'Slightly raised · 2 Aug 2026' },
      { text: 'Faecal calprotectin 210 µg/g', meta: 'Raised · 28 Jul 2026', critical: true },
      { text: 'Platelets 388 ×10⁹/L', meta: 'Upper normal · 2 Aug 2026' },
      { text: 'Creatinine 68 µmol/L', meta: 'Normal · 2 Aug 2026' },
      { text: 'ALT 24 U/L', meta: 'Normal · 2 Aug 2026 · azathioprine monitoring' },
      { text: 'INR 1.0', meta: 'Normal · 2 Aug 2026' },
    ],
  },
  {
    id: 'imaging',
    label: 'Imaging',
    items: [
      { text: 'MR enterography', meta: 'May 2026 — 6 cm neo-terminal ileal inflammation' },
      { text: 'Abdominal ultrasound', meta: 'January 2026 — normal' },
      { text: 'Chest radiograph', meta: 'September 2025 — clear, pre-biologic' },
      { text: 'DEXA bone density', meta: 'March 2025 — osteopenia, T-score −1.4' },
    ],
  },
  {
    id: 'assessments',
    label: 'Recent Assessments',
    items: [
      { text: 'Harvey–Bradshaw Index 6', meta: '3 Aug 2026 — mild activity' },
      { text: 'PHQ-9 score 4', meta: '3 Aug 2026 — minimal' },
      { text: 'ASA classification II', meta: '3 Aug 2026 — mild systemic disease' },
      { text: 'Mallampati class II', meta: '3 Aug 2026 — airway assessment' },
      { text: 'Bowel prep tolerance', meta: '4 Aug 2026 — completed, clear effluent' },
    ],
  },
  /* The plan, which is the section every other one exists to inform — and the
     only one that is about what happens next rather than what has happened. */
  {
    id: 'care-plan',
    label: 'Care Plan',
    items: [
      { text: 'Surveillance colonoscopy', meta: 'Today — family history and disease duration' },
      { text: 'Continue infliximab', meta: 'Next dose 28 Sep 2026' },
      { text: 'Iron infusion if Hb below 10', meta: 'Repeat FBC in six weeks', critical: true },
      { text: 'Gastroenterology review', meta: 'Six weeks post-procedure' },
      { text: 'Bone protection review', meta: 'Calcium and vitamin D — DEXA due 2027' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    items: [
      { text: 'Referral letter — Dr Whitcombe', meta: 'PDF · 12 Jul 2026' },
      { text: 'Histology report', meta: 'PDF · 2 Apr 2026' },
      { text: 'MR enterography report', meta: 'PDF · 14 May 2026' },
      { text: 'Anaesthesia consent', meta: 'Signed · 4 Aug 2026' },
      { text: 'Bowel prep instructions', meta: 'Sent to portal · 28 Jul 2026' },
    ],
  },
];

/* --- Triage note ------------------------------------------------------------ */

export const TRIAGE_NOTE = {
  lines: [
    'Vitals obtained and within acceptable limits.',
    'Medication list reviewed with the patient and reconciled.',
    'Initial clinical assessment completed and documented.',
  ],
  alerts: ['Penicillin allergy — anaphylaxis', 'Weight down 2.1 kg since March'],
  by: 'Ryan Weste, Front Desk',
};

/* --- Quick inserts for the Subjective editor -------------------------------- */

export const QUICK_INSERTS = [
  {
    id: 'hpi',
    label: 'HPI',
    html:
      '<h4>History of present illness</h4><p>Patient reports intermittent right iliac fossa ' +
      'discomfort over the past three weeks, worse after meals. Stool frequency 3–4 per day, ' +
      'no blood. No fever, no night sweats.</p>',
  },
  {
    id: 'ros',
    label: 'ROS',
    html:
      '<h4>Review of systems</h4><p>General: fatigue present, no fever. GI: as above. ' +
      'Cardiorespiratory: no chest pain, no dyspnoea. MSK: no arthralgia. Skin: no rash. ' +
      'All other systems reviewed and negative.</p>',
  },
  {
    id: 'meds',
    label: 'Medication review',
    html:
      '<h4>Medication review</h4><p>Taking infliximab 5 mg/kg every 8 weeks, ferrous sulfate ' +
      '325 mg daily and cholecalciferol 800 IU daily. Medication list reviewed and reconciled ' +
      'with the patient. Adherence reported as good.</p>',
  },
  {
    id: 'narrative',
    label: 'Patient narrative',
    html:
      '<h4>In the patient’s words</h4><p>“The pain comes back an hour or so after I eat, and ' +
      'I am more tired than I was in the spring.”</p>',
  },
];

/* --- Objective -------------------------------------------------------------- */

export const LAST_VITALS = {
  bp: '118/74',
  pulse: '72',
  temp: '36.8',
  resp: '14',
  spo2: '98',
  weight: '61.4',
  height: '166',
};

export const EXAM_NORMAL =
  'Alert and orientated, comfortable at rest. Abdomen soft, mild right iliac fossa ' +
  'tenderness, no guarding or rebound. No palpable mass. Bowel sounds normal. ' +
  'No peripheral oedema. Perianal inspection normal.';

/* --- Assessment ------------------------------------------------------------- */

export const ICD10 = [
  { code: 'K50.00', text: 'Crohn’s disease of small intestine without complications' },
  { code: 'K50.90', text: 'Crohn’s disease, unspecified, without complications' },
  { code: 'K51.90', text: 'Ulcerative colitis, unspecified, without complications' },
  { code: 'D50.9', text: 'Iron deficiency anaemia, unspecified' },
  { code: 'K21.9', text: 'Gastro-oesophageal reflux disease without oesophagitis' },
  { code: 'K58.0', text: 'Irritable bowel syndrome with diarrhoea' },
  { code: 'R10.31', text: 'Right lower quadrant pain' },
  { code: 'E55.9', text: 'Vitamin D deficiency, unspecified' },
  { code: 'Z12.11', text: 'Encounter for screening for malignant neoplasm of colon' },
  { code: 'R19.7', text: 'Diarrhoea, unspecified' },
];

export const FAVOURITE_DIAGNOSES = ['K50.00', 'D50.9', 'K21.9'];

/** What the assistant proposes, and why — the reason is the point. */
export const SUGGESTED_DIAGNOSES = [
  {
    code: 'K50.00',
    text: 'Crohn’s disease of small intestine without complications',
    confidence: 'High',
    because: 'Raised calprotectin, MR enterography findings and matching symptoms',
  },
  {
    code: 'D50.9',
    text: 'Iron deficiency anaemia, unspecified',
    confidence: 'High',
    because: 'Haemoglobin 10.4 g/dL with ferritin 18 ng/mL',
  },
  {
    code: 'E55.9',
    text: 'Vitamin D deficiency, unspecified',
    confidence: 'Moderate',
    because: 'On long-term supplementation, no recent level',
  },
];

/** Decision support that fires against the current record. */
export const DECISION_SUPPORT = [
  {
    severity: 'critical',
    title: 'Penicillin allergy',
    detail: 'Anaphylaxis documented. Avoid beta-lactams; consider ciprofloxacin and metronidazole.',
  },
  {
    severity: 'warning',
    title: 'Pneumococcal vaccination due',
    detail: 'Patient is on biologic immunosuppression and has no pneumococcal cover on file.',
  },
  {
    severity: 'info',
    title: 'Ferritin below target on iron',
    detail: 'Oral iron for 6 months without response — consider IV iron.',
  },
];

/* --- Plan ------------------------------------------------------------------- */

export const ORDER_SETS = [
  'FBC, ferritin, CRP',
  'Faecal calprotectin',
  'Infliximab trough level and antibodies',
  'Vitamin D level',
  'MR enterography',
  'Ileocolonoscopy with biopsies',
];

export const MEDICATION_OPTIONS = [
  'Ferric carboxymaltose 1000 mg IV, single dose',
  'Ferrous sulfate 325 mg orally, once daily',
  'Cholecalciferol 20,000 IU weekly for 8 weeks',
  'Budesonide 9 mg orally, once daily for 8 weeks',
  'Infliximab 5 mg/kg IV, every 8 weeks — continue',
];

export const REFERRAL_OPTIONS = [
  'Dietitian — IBD service',
  'IBD clinical nurse specialist',
  'Colorectal surgery',
  'Rheumatology',
];

export const PROCEDURE_OPTIONS = [
  'Ileocolonoscopy with biopsies',
  'Upper GI endoscopy',
  'Capsule endoscopy',
  'IV iron infusion',
];

export const FOLLOW_UP_OPTIONS = [
  '2 weeks',
  '4 weeks',
  '8 weeks — with infusion',
  '3 months',
  '6 months',
  'As needed',
];

export const PATIENT_EDUCATION = [
  'Crohn’s disease — living with it',
  'Iron deficiency anaemia and diet',
  'Infliximab — what to expect',
  'When to call the IBD nurse',
];

/* --- Right utility panel ---------------------------------------------------- */

export const PREVIOUS_ENCOUNTERS = [
  { date: '3 Aug 2026', type: 'Infusion visit', provider: 'Aisha Patel', summary: 'Infliximab cycle 6 given, no reaction.' },
  { date: '12 May 2026', type: 'GI consultation', provider: 'Olivia Rhye', summary: 'MR enterography reviewed, dose interval maintained.' },
  { date: '2 Apr 2026', type: 'Colonoscopy follow-up', provider: 'David Smith', summary: 'Histology consistent with quiescent Crohn’s.' },
];

export const RECENT_LABS = [
  { name: 'Haemoglobin', value: '10.4 g/dL', range: '12.0–15.5', flag: 'low' },
  { name: 'Ferritin', value: '18 ng/mL', range: '30–200', flag: 'low' },
  { name: 'CRP', value: '8 mg/L', range: '0–5', flag: 'high' },
  { name: 'Albumin', value: '41 g/L', range: '35–50', flag: 'normal' },
  { name: 'Calprotectin', value: '210 µg/g', range: '0–50', flag: 'high' },
];

export const ATTACHMENTS = [
  { name: 'Referral letter.pdf', meta: '184 KB · 12 Jul 2026' },
  { name: 'MR enterography report.pdf', meta: '2.1 MB · 14 May 2026' },
  { name: 'Histology report.pdf', meta: '96 KB · 2 Apr 2026' },
];

export const CODING_SUGGESTIONS = [
  { code: '99214', text: 'Established patient, moderate complexity', note: 'Supported by two chronic problems with lab review' },
  { code: '99215', text: 'Established patient, high complexity', note: 'Would need documented medication risk discussion' },
  { code: 'G0463', text: 'Hospital outpatient clinic visit', note: 'Only if delivered in the outpatient department' },
];

export const CALCULATORS = [
  { id: 'hbi', name: 'Harvey–Bradshaw Index', hint: 'Crohn’s disease activity' },
  { id: 'bmi', name: 'Body mass index', hint: 'From height and weight' },
  { id: 'mayo', name: 'Mayo score', hint: 'Ulcerative colitis activity' },
];

export const CLINICAL_INSIGHTS = [
  'Calprotectin has risen from 96 to 210 µg/g since April, against a stable CRP.',
  'Weight is down 2.1 kg over five months without a documented cause.',
  'Ferritin has not responded to six months of oral iron.',
];
