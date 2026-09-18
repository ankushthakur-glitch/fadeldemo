/**
 * DEMO DATA — the three tabs that sit alongside the procedure report while
 * In-procedure is open: the History & Physical, the standing Orders, and the
 * EGD report (a second report type next to the existing colonoscopy one).
 *
 * These are reference/summary documents the endoscopist can glance at or
 * sign without leaving the charting view — most of their content is fixed
 * protocol text, not something re-typed per visit.
 */

/* --- Pre-procedure History & Physical --------------------------------------- */

export const HP_GENERAL_OPTIONS = [
  'Alert, oriented, no acute distress',
  'Anxious',
  'Lethargic',
  'Acute distress',
];

export const HP_LUNG_OPTIONS = [
  'Clear to auscultation',
  'Wheezes',
  'Rhonchi',
  'Diminished breath sounds',
];

export const HP_CV_OPTIONS = ['Normal', 'Irregular rhythm', 'Murmur present', 'Tachycardic'];

export const HP_NEURO_OPTIONS = ['Normal Mental status', 'Confused', 'Somnolent'];

export const HP_AIRWAY_OPTIONS = [
  'Mallampati Class I',
  'Mallampati Class II',
  'Mallampati Class III',
  'Mallampati Class IV',
];

export const ASA_CLASSIFICATIONS = [
  'ASA I — Normal healthy patient',
  'ASA II — Mild systemic disease',
  'ASA III — Severe systemic disease',
  'ASA IV — Severe systemic disease, constant threat to life',
  'ASA V — Moribund, not expected to survive without procedure',
  'ASA VI — Brain-dead, organ donor',
];

export const HP_DEFAULTS = {
  general: HP_GENERAL_OPTIONS[0],
  lung: HP_LUNG_OPTIONS[0],
  cv: HP_CV_OPTIONS[0],
  neuro: HP_NEURO_OPTIONS[0],
  airway: HP_AIRWAY_OPTIONS[0],
  asa: ASA_CLASSIFICATIONS[0],
};

export const HP_ASSESSMENT_STATEMENT =
  'Patient appropriate for procedure. Risks, benefits, alternatives and limitations ' +
  'reviewed prior to procedure. Patient verbalized understanding and elected to proceed.';

/* --- Orders -------------------------------------------------------------------- */

export const PRE_PROCEDURE_ORDER_LINES = [
  'NPO per protocol',
  'Bowel preparation per protocol',
  'Establish IV access',
  'As needed use IV solution: Normal Saline, LR, or D5W; 250mL or 500mL; to keep open (TKO) or wide open',
];

export const POST_PROCEDURE_ORDER_LINES = [
  'Remove IV',
  'Monitor vitals per protocol until discharge criteria met',
  'Aldrete score ≥8 or back to baseline for discharge',
  'Advance diet as tolerated once patient awake and alert',
  'Provide discharge instructions',
];

export const SEDATION_TYPES = [
  'Moderate Conscious Sedation',
  'Deep Sedation',
  'General Anesthesia',
  'Monitored Anesthesia Care (MAC)',
  'No Sedation',
];

/** The standing medication order set — a reference range, not a per-visit dose log. */
export const SEDATION_ORDER_MEDICATIONS = [
  'Fentanyl 25–250 mcg IV',
  'Propofol 10–300 mg IV',
  'Midazolam 1–10 mg IV',
  'Remimazolam 2.5–20 mg IV',
  'Ondansetron 4–8 mg IV/SL',
  'Meperidine 25–100 mg IV',
  'Lidocaine 2–4% topical sol. 120 mg',
  'Diphenhydramine 25–50 mg IV',
  'Atropine 0.4–0.8 mg IV',
  'Flumazenil 0.2 mg IV',
  'Naloxone 0.2 mg IV',
  'Epinephrine 1/10000 1–10 mg IV',
];

/* --- EGD report ------------------------------------------------------------------ */

/* Same shape and same argument as the colonoscopy list next door — see
   COLONOSCOPY_PROCEDURES_PERFORMED in data/procedure-report.js for why a
   procedure the report says was performed carries the code it is claimed
   under. These are the upper-GI codes for the same eight acts. */
export const EGD_PROCEDURES_PERFORMED = [
  { code: '43235', label: 'Diagnostic EGD' },
  { code: '43249', label: 'Esophageal dilation' },
  { code: '43239', label: 'Biopsy' },
  { code: '43251', label: 'Polypectomy' },
  { code: '43247', label: 'Foreign body removal' },
  { code: '43244', label: 'Variceal band ligation' },
  { code: '43246', label: 'PEG tube placement' },
  { code: '43255', label: 'Hemostasis' },
];

/**
 * The six circumstances that change the claim, each under the modifier it is
 * actually appended as.
 *
 * A MODIFIER WITHOUT ITS DIGITS IS NOT A MODIFIER. This was six clinical
 * phrases — "Incomplete exam", "Reduced services" — which is how the
 * endoscopist thinks about the case and not what goes on the claim line. The
 * two are not the same vocabulary and the translation between them was being
 * done from memory, by whoever coded the report days later, off a tick whose
 * whole purpose was to say which two digits to append.
 *
 * The label stays the endoscopist's phrase, because they are the one ticking
 * it. The code beside it is the CPT modifier the practice bills that
 * circumstance under, so the same tick answers both readers.
 *
 * Both lists are shared by the colonoscopy and EGD reports — a modifier means
 * the same thing whichever end of the patient the scope went in.
 */
export const EGD_MODIFIERS = [
  /* Control of bleeding at the same sitting as another endoscopic procedure —
     a distinct service, not part of the scope it was found during. */
  { code: '59', label: 'Bleeding' },
  /* Substantially more work than the code describes. */
  { code: '22', label: 'Difficult intubation' },
  { code: '53', label: 'Incomplete exam' },
  /* By the same physician. A repeat by a different one is 77, which this
     practice's list has never needed and would be a seventh line here. */
  { code: '76', label: 'Repeat procedure' },
  { code: '80', label: 'Assistant surgeon' },
  { code: '52', label: 'Reduced services' },
];

/** The 8 dropdown fields under Procedure Details, in display order. */
export const EGD_PROCEDURE_DETAILS = [
  {
    id: 'position',
    label: 'Patient Position',
    placeholder: 'Select position',
    options: ['Left lateral decubitus', 'Supine', 'Right lateral decubitus'],
  },
  {
    id: 'distension',
    label: 'Distension Method',
    placeholder: 'Select method',
    options: ['Air insufflation', 'CO2 insufflation', 'Water immersion'],
  },
  {
    id: 'difficulty',
    label: 'Procedure Difficulty',
    placeholder: 'Select difficulty',
    options: ['Easy', 'Moderate', 'Difficult'],
  },
  {
    id: 'extent',
    label: 'Extent of Examination',
    placeholder: 'Select extent',
    options: [
      'Esophagus only',
      'Esophagus and stomach',
      'Esophagus, stomach and duodenum (D2)',
      'Esophagus, stomach and duodenum (D3)',
    ],
  },
  {
    id: 'outcome',
    label: 'Procedure Outcome',
    placeholder: 'Select outcome',
    options: [
      'Completed',
      'Incomplete — patient intolerance',
      'Incomplete — technical difficulty',
      'Aborted',
    ],
  },
  {
    id: 'retroflexion',
    label: 'Gastric Retroflexion',
    placeholder: 'Select retroflexion status',
    options: ['Performed — normal', 'Performed — abnormal', 'Not performed'],
  },
  {
    id: 'tolerance',
    label: 'Patient Tolerance',
    placeholder: 'Select tolerance',
    options: ['Excellent', 'Good', 'Fair', 'Poor'],
  },
  {
    id: 'landmarks',
    label: 'Landmarks identified and images taken',
    placeholder: 'Select',
    options: ['Yes — all landmarks', 'Yes — partial', 'No'],
  },
];

export const EGD_BLOOD_LOSS_OPTIONS = ['None', 'Minimal', 'Moderate', 'Severe'];

export const EGD_DEFAULT_COMPLICATIONS = 'No immediate complications';

/** The three clickable regions on the findings diagram, top to bottom. */
export const EGD_FINDING_REGIONS = [
  { id: 'esophagus', label: 'Esophagus' },
  { id: 'stomach', label: 'Stomach' },
  { id: 'duodenum', label: 'Duodenum' },
];

export const EGD_RECOMMENDATIONS = [
  { id: 'biopsy-results', label: 'Follow up biopsy results' },
  { id: 'follow-up-clinic', label: 'Follow up in clinic' },
  { id: 'follow-up-primary', label: 'Follow up with your primary' },
  { id: 'continue-medications', label: 'Continue current medications' },
];

export const EGD_REPEAT_UNITS = ['years', 'months', 'weeks'];

export const EGD_MAX_PHOTOS = 50;
