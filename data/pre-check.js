/**
 * DEMO DATA — the pre-procedure verification checklist.
 *
 * The nurse's paper sheet, taken off paper. It is worked through in the room
 * after the patient changes and before anaesthesia is called: who they are,
 * what they are here for, what is in them that matters, what was held, how the
 * prep went, and where the cannula is.
 *
 * WHY IT IS NOT THE ENCOUNTER CHECKLIST
 * The encounter's Pre-procedure checklist is the induction sign-off — ten lines
 * that must all be true before the scope goes in. This is the sheet that gets
 * filled in an hour earlier, at the point the patient is still in the bay, and
 * it records values rather than ticks: a gauge, a site, a prep quality. Signing
 * this is what makes the induction checklist answerable.
 *
 * WHAT LIVES HERE vs. NEXT DOOR
 * This file holds what the practice OFFERS — the closed lists a nurse picks
 * from, the practice default, and the demo seed. The shape of the sheet (which
 * question sits in which section, what reveals what, what must be answered
 * before it can be signed) lives in js/lib/pre-check-fields.js, because that is
 * structure rather than data. Rendering lives in js/lib/pre-check-form.js.
 */
import { INSTRUMENTS } from './master.js';

/* --- The two shapes every binary question takes ---------------------------------
   Values are lowercase and stable; labels are what the nurse reads. They are
   kept apart because the label is allowed to change and the stored answer is
   not — a sheet filed last year still has to load.
   -------------------------------------------------------------------------- */

export const YES_NO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

export const YES_NO_UNKNOWN = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'unknown', label: 'Unknown' },
];

/* --- Patient arrival ------------------------------------------------------------ */

export const ARRIVAL_MODES = ['Ambulatory', 'Wheelchair', 'Stretcher', 'Assisted'];
export const INTERPRETER_METHODS = ['In-person', 'Phone', 'Video'];

/* --- Patient verification -------------------------------------------------------
   Ticked in the room before anaesthesia is called. Allergy review sits with the
   Allergies section below, because it is answered in the same breath as
   NKDA/Soy/Egg rather than alongside identity and teaching.

   `understanding` and `consent` are two lines, not one. They were one line for
   a while, labelled as consent and asked as comprehension, which meant a signed
   consent form and a patient who understood it were recorded by the same tick.
   -------------------------------------------------------------------------- */

export const PATIENT_VERIFICATION_CHECKS = [
  { id: 'verified', label: 'Patient and procedure verified' },
  { id: 'teaching', label: 'Pre-procedure teaching done' },
  { id: 'understanding', label: 'Patient or companion verbalizes understanding' },
];

export const SITE_MARKED_OPTIONS = ['N/A', 'Marked', 'Not applicable to procedure'];
export const CODE_STATUS_OPTIONS = ['Full code', 'DNR', 'DNI', 'Modified'];

/* --- Sedation history ------------------------------------------------------------
   A longer list than the three it started as. Every line added is one that
   changes what anaesthesia brings into the room.
   -------------------------------------------------------------------------- */

export const SEDATION_HISTORY = [
  { value: 'none', label: 'None' },
  { value: 'nausea_vomiting', label: 'Nausea or vomiting' },
  { value: 'difficult_airway', label: 'Difficult airway' },
  { value: 'prolonged_sedation', label: 'Prolonged sedation' },
  { value: 'malignant_hyperthermia', label: 'Malignant hyperthermia' },
  { value: 'postop_delirium', label: 'Post-operative delirium' },
  { value: 'allergic_reaction', label: 'Allergic reaction' },
  { value: 'other', label: 'Other' },
];

/**
 * Apfel's four. Each is worth one point and the sum predicts post-operative
 * nausea — which is why they are asked as four boxes rather than a judgement.
 */
export const APFEL_FACTORS = [
  { id: 'ponvFemale', testid: 'ponv-female', label: 'Female' },
  { id: 'ponvNonSmoker', testid: 'ponv-non-smoker', label: 'Non-smoker' },
  { id: 'ponvHistory', testid: 'ponv-history', label: 'History of PONV or motion sickness' },
  { id: 'ponvPostopOpioids', testid: 'ponv-postop-opioids', label: 'Expected post-op opioids' },
];

/* --- Medical conditions ---------------------------------------------------------
   Diabetes and AICD are pressed as a yes/no pair — asked out loud, answered
   with one tap. The others are selects because the answer is a side or a state,
   and "Yes" on its own would not be enough to act on.
   -------------------------------------------------------------------------- */

export const MASTECTOMY_OPTIONS = ['No', 'Left', 'Right', 'Bilateral'];
export const AV_SHUNT_OPTIONS = ['No', 'Left arm', 'Right arm', 'Left leg', 'Right leg'];
export const DENTURES_OPTIONS = ['NA', 'Upper', 'Lower', 'Full', 'Partial — removed'];
export const GLASSES_OPTIONS = ['NA', 'Removed', 'Contact lenses removed', 'Left in place'];

export const CONTACT_LENS_OPTIONS = ['NA', 'Removed', 'Not removed'];
export const HEARING_AID_OPTIONS = ['NA', 'Removed', 'Left in', 'Right in', 'Both in'];
export const JEWELRY_OPTIONS = ['NA', 'Removed', 'Not removed'];

export const DIABETES_TYPES = ['Type 1', 'Type 2', 'Gestational', 'Steroid-induced'];
export const PUMP_ACTIONS = ['Continue', 'Suspend', 'Removed'];

export const AICD_DEVICE_TYPES = ['Pacemaker', 'ICD', 'CRT-D', 'CRT-P', 'Loop recorder'];

export const OSA_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'suspected', label: 'Suspected' },
];

/**
 * STOP-BANG's eight. Five or more is the threshold that changes the airway
 * plan, so the score is shown rather than left to be counted off the boxes.
 */
export const STOPBANG_FACTORS = [
  { id: 'stopBangSnoring', testid: 'stopbang-snoring', label: 'Snoring loudly' },
  { id: 'stopBangTired', testid: 'stopbang-tired', label: 'Tired during the day' },
  { id: 'stopBangObservedApnea', testid: 'stopbang-observed-apnea', label: 'Observed apnoea' },
  { id: 'stopBangPressure', testid: 'stopbang-pressure', label: 'High blood pressure' },
  { id: 'stopBangBmi', testid: 'stopbang-bmi', label: 'BMI over 35' },
  { id: 'stopBangAge', testid: 'stopbang-age', label: 'Age over 50' },
  { id: 'stopBangNeck', testid: 'stopbang-neck', label: 'Neck over 40 cm' },
  { id: 'stopBangGender', testid: 'stopbang-gender', label: 'Male' },
];

export const PREGNANCY_OPTIONS = ['N/A', 'Not pregnant', 'Pregnant', 'Unknown'];
export const HCG_RESULTS = ['Negative', 'Positive', 'Not done'];
export const STENT_TYPES = ['Bare metal', 'Drug-eluting', 'Unknown'];

export const IMPLANT_OPTIONS = [
  { id: 'joint', label: 'Joint replacement' },
  { id: 'metal', label: 'Metal implants' },
  { id: 'port', label: 'Port or central line' },
  { id: 'nerve', label: 'Nerve stimulator' },
  { id: 'pump', label: 'Insulin pump' },
  { id: 'cgm', label: 'CGM' },
  { id: 'other', label: 'Other' },
];

export const SUBSTANCE_USE = [
  { value: 'never', label: 'Never' },
  { value: 'former', label: 'Former' },
  { value: 'current', label: 'Current' },
];

export const INFECTION_PRECAUTIONS = [
  'None', 'Contact', 'Droplet', 'Airborne', 'MRSA', 'C. diff',
];
export const FALL_RISK = ['Low', 'Moderate', 'High'];

/* --- Baseline vital signs --------------------------------------------------------
   The numbers anaesthesia is handed at the door. Out-of-range highlighting is
   advisory, not a block: a systolic of 182 in a nervous patient is a
   conversation, not a cancellation, and the sheet should say so rather than
   refuse to be signed.
   -------------------------------------------------------------------------- */

export const OXYGEN_DELIVERY = ['Room air', 'Nasal cannula', 'Mask'];
export const TEMPERATURE_ROUTES = ['Oral', 'Temporal', 'Axillary', 'Tympanic'];
export const ORIENTATION_OPTIONS = [
  'A&O ×4', 'A&O ×3', 'A&O ×2', 'A&O ×1', 'Confused', 'Non-verbal',
];

/** What a number is allowed to be. Rejected outside this; flagged inside it. */
export const NUMERIC_RANGES = {
  bpSystolic: { min: 40, max: 300, unit: 'mmHg' },
  bpDiastolic: { min: 20, max: 200, unit: 'mmHg' },
  heartRate: { min: 20, max: 250, unit: 'bpm' },
  respiratoryRate: { min: 4, max: 60, unit: '/min' },
  spo2: { min: 50, max: 100, unit: '%' },
  temperature: { min: 90, max: 110, unit: '°F' },
  lastBloodSugar: { min: 20, max: 800, unit: 'mg/dL' },
  inrValue: { min: 0.5, max: 10, unit: '' },
  plateletCount: { min: 0, max: 1000000, unit: '/µL' },
  oxygenLpm: { min: 0, max: 15, unit: 'L/min' },
  heightIn: { min: 20, max: 90, unit: 'in' },
  weightLb: { min: 20, max: 900, unit: 'lb' },
  ivRate: { min: 0, max: 999, unit: 'mL/hr' },
};

/**
 * The bands that earn an amber ring. Narrower than NUMERIC_RANGES on purpose:
 * one says "that cannot be a blood pressure", the other says "that is a blood
 * pressure worth telling anaesthesia about".
 */
export const VITAL_FLAGS = [
  { key: 'bpSystolic', low: 90, high: 180, label: 'Systolic BP' },
  { key: 'heartRate', low: 50, high: 120, label: 'Heart rate' },
  { key: 'spo2', low: 92, high: null, label: 'SpO₂' },
  { key: 'respiratoryRate', low: 8, high: 24, label: 'Respiratory rate' },
  { key: 'temperature', low: null, high: 100.4, label: 'Temperature' },
];

/* --- Airway assessment ----------------------------------------------------------- */

export const ASA_CLASSES = ['I', 'II', 'III', 'IV', 'V', 'VI'];
export const MALLAMPATI_CLASSES = ['I', 'II', 'III', 'IV'];
export const MOUTH_OPENING = ['≥3 fingerbreadths', '<3 fingerbreadths'];
export const THYROMENTAL_DISTANCE = ['≥6 cm', '<6 cm'];
export const NECK_ROM = ['Full', 'Limited'];
export const PLANNED_ANAESTHESIA_TYPES = [
  'MAC', 'Moderate sedation', 'General', 'Topical only',
];

/* --- Weight-loss medication and anticoagulant ------------------------------------
   Two separate yes/no questions, because the two drug classes fail
   differently: an anticoagulant is a bleeding risk during the procedure, a
   GLP-1 agonist is an aspiration risk at induction.
   -------------------------------------------------------------------------- */

export const WEIGHT_LOSS_TYPES = [
  'Ozempic (Semaglutide)', 'Wegovy (Semaglutide)',
  'Mounjaro (Tirzepatide)', 'Zepbound (Tirzepatide)',
  'Saxenda (Liraglutide)', 'Victoza (Liraglutide)',
  'Qsymia', 'Contrave', 'Xenical (Orlistat)', 'Alli (Orlistat)',
  'Phentermine', 'Other',
];

/**
 * The subset that delays gastric emptying.
 *
 * Qsymia, Contrave, Orlistat and phentermine are weight-loss drugs too, and
 * none of them is an aspiration risk — so the alert keys off this list rather
 * than off "a weight-loss medication was recorded".
 */
export const GLP1_AGENTS = [
  'Ozempic (Semaglutide)', 'Wegovy (Semaglutide)',
  'Mounjaro (Tirzepatide)', 'Zepbound (Tirzepatide)',
  'Saxenda (Liraglutide)', 'Victoza (Liraglutide)',
];

export const WEIGHT_LOSS_FREQUENCY = ['Daily', 'Weekly'];

export const HELD_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_instructed', label: 'Not instructed' },
];

export const GLP1_SYMPTOMS = [
  { id: 'none', label: 'None' },
  { id: 'nausea', label: 'Nausea' },
  { id: 'vomiting', label: 'Vomiting' },
  { id: 'satiety', label: 'Early satiety or fullness' },
  { id: 'pain', label: 'Abdominal pain' },
];

export const GASTRIC_ULTRASOUND_RESULTS = ['Empty', 'Full', 'Indeterminate'];

/**
 * The rule stated where it applies.
 *
 * GLP-1 agonists are the newest way for a well-prepped patient to arrive
 * unsafe: the colon is clear and the stomach is not. Anaesthesia has to be
 * told before induction, not found out at it.
 */
export const GLP1_NOTE = {
  heading: 'Semaglutide recorded.',
  detail:
    'GLP-1 agonists delay gastric emptying. Confirm the extended fasting window was ' +
    'followed and notify anaesthesia before sedation.',
};

export const ANTICOAGULANT_OPTIONS = ['No Anticoagulant', 'Taking Anticoagulant'];

export const ANTICOAGULANT_TYPES = [
  'Brilinta (Ticagrelor)', 'Coumadin (Warfarin)', 'Effient (Prasugrel)',
  'Eliquis (Apixaban)', 'Heparin', 'Lovenox', 'Plavix (Clopidogrel)',
  'Pradaxa (Dabigatran)', 'Xarelto (Rivaroxaban)', 'Other',
];

export const ANTICOAGULANT_INDICATIONS = [
  'Atrial fibrillation', 'DVT/PE', 'Mechanical valve',
  'Coronary stent', 'Stroke prophylaxis', 'Other',
];

/* --- Allergies -------------------------------------------------------------------
   The three legacy boxes stay as quick-add chips because they are the three a
   GI unit asks by name every single time — soy and egg for the propofol
   carrier, NKDA for everything else. Anything past those three is a row.
   -------------------------------------------------------------------------- */

export const ALLERGY_CHECKS = [
  { id: 'nkda', label: 'NKDA' },
  { id: 'soy', label: 'Soy' },
  { id: 'egg', label: 'Egg' },
  { id: 'medications', label: 'Medications/Allergies reviewed in EMR with patient' },
];

export const ALLERGY_TYPES = [
  'Drug', 'Food', 'Environmental', 'Latex', 'Contrast', 'Adhesive/Tape', 'Other',
];
export const ALLERGY_REACTIONS = [
  'Rash', 'Hives', 'Itching', 'Swelling', 'Anaphylaxis',
  'Nausea/Vomiting', 'Respiratory distress', 'Other',
];
export const ALLERGY_SEVERITIES = ['Mild', 'Moderate', 'Severe'];

/* --- Medication reconciliation ---------------------------------------------------- */

export const MEDS_TAKEN_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partial', label: 'Partial' },
];

export const BETA_BLOCKER_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
];

/* --- Procedure information ------------------------------------------------------ */

export const NPO_CHECKS = [
  { id: 'standard', label: 'At least 6 hours for solids, at least 2 hours for liquids' },
  { id: 'other', label: 'Other' },
];

/** Kept off NPO_CHECKS: it is a separate tick, not a third mutually exclusive one. */
export const NPO_EXTENDED = {
  id: 'extended',
  label: 'Extended fast — GLP-1 protocol',
};

export const NPO_RESULTS = [
  'NPO status confirmed',
  'Not NPO — proceed with caution',
  'Unable to verify',
];

export const COLON_PREPARATIONS = [
  'No preparation',
  'Split-dose PEG',
  'Single-dose PEG',
  'Sulfate-free PEG',
  'Sodium picosulfate',
  'Magnesium citrate',
  'GoLytely', 'Miralax', 'MoviPrep', 'Plenvu', 'SUTAB', 'SUPREP', 'SUFLAVE',
  'Other',
];

export const PREP_COMPLETION = ['Completed as directed', 'Partially completed', 'Not completed'];
export const PREP_TOLERANCE = ['Tolerated well', 'Nausea', 'Vomiting', 'Unable to finish'];

export const EFFLUENT_APPEARANCE = [
  { value: 'liquid', label: 'Liquid' },
  { value: 'semi_liquid', label: 'Semi-liquid' },
  { value: 'solid', label: 'Solid' },
  { value: 'other', label: 'Other' },
];

/* --- IV access -------------------------------------------------------------------
   One field, not three. The quick-select chips build it — gauge, then site,
   then trials — but the nurse can just as well type "22G Left AC - 1 trial"
   straight in, because a gloved hand does not always want to hunt for a chip.

   EACH OF THE THREE CHIP GROUPS TAKES MORE THAN ONE ANSWER, so ivGauge,
   ivSite and ivTrials are LISTS. A single choice apiece was only ever right
   for the cannula that goes in first time. A patient stuck twice has two
   sites, and often two gauges — the 20G that blew in the left hand and the
   22G that took in the right — and forcing one answer meant the sheet
   recorded the last attempt and silently lost the first. The one that failed
   is the one anaesthesia most wants to know about.
   -------------------------------------------------------------------------- */

export const NEEDLE_GAUGES = ['14G', '16G', '18G', '20G', '22G', '24G', '26G'];
export const IV_SITES = [
  'Left AC', 'Right AC', 'Left Hand', 'Right Hand',
  'Left Forearm', 'Right Forearm', 'Left Wrist', 'Right Wrist',
];
export const IV_TRIALS = ['1 trial', '2 trials', '3 trials', '4 trials', '5+ trials'];

export const IV_FLUIDS = ['NS', 'LR', 'D5W', 'None'];
export const IV_SITE_CONDITIONS = ['Patent', 'Infiltrated', 'Painful', 'Not assessed'];

/* --- Equipment and safety --------------------------------------------------------- */

export const GROUNDING_PAD_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
];

export const SPECIAL_EQUIPMENT = [
  { id: 'co2', label: 'CO₂ insufflation' },
  { id: 'water', label: 'Water pump' },
  { id: 'clips', label: 'Hemostasis clips' },
  { id: 'snare', label: 'Snare' },
  { id: 'apc', label: 'APC' },
  { id: 'emr', label: 'EMR/ESD kit' },
  { id: 'needle', label: 'Injection needle' },
  { id: 'other', label: 'Other' },
];

/** The instruments a GI unit tracks (data/master.js) — the same list Settings ▸
 *  Master reads, so a scope picked here is the one actually on the shelf. */
export const SCOPE_OPTIONS = INSTRUMENTS.filter((i) => i.active).map((i) => i.name);

/* --- Sign-off --------------------------------------------------------------------- */

export const STAFF_CREDENTIALS = ['RN', 'LPN', 'CRNA', 'MD', 'DO', 'Tech'];

export const ATTESTATION_TEXT =
  'I attest the above was verified with the patient prior to the procedure.';

/* ============================================================================
   DEFAULTS

   Two sets, and they are not the same thing.

   PRE_CHECK_DEFAULT is the practice's standard sheet — what "Use default"
   fills in, and what "Set default" overwrites. It is deliberately empty where
   the answer belongs to the patient in front of you: time, notes, vitals and
   every alert acknowledgement are never defaulted, because a pre-filled
   arrival time is a lie and a pre-filled attestation is a forged one.

   PRE_CHECK_SEED is this demo patient's sheet, already worked through.
   ========================================================================= */

export const PRE_CHECK_DEFAULT = {
  /* Arrival */
  timeInRoom: '',
  timeInRoomAudit: null,
  arrivalMode: 'Ambulatory',
  twoIdentifiersVerified: false,
  escortPresent: '',
  escortName: '',
  escortRelationship: '',
  escortPhone: '',
  interpreterNeeded: 'no',
  interpreterLanguage: '',
  interpreterMethod: '',
  valuablesSecured: false,

  /* Verification */
  verified: [],
  consentSigned: false,
  consentMatchesProcedure: false,
  hpReviewed: false,
  hpDate: '',
  siteMarked: 'N/A',
  timeoutCompleted: false,
  timeoutTime: '',
  timeoutParticipants: '',
  codeStatus: 'Full code',
  codeStatusDetail: '',
  codeStatusSuspended: '',
  advanceDirectiveOnFile: 'unknown',

  /* Sedation history */
  sedationHistory: 'none',
  sedationHistoryOther: '',
  mhFamilyHistory: 'unknown',
  priorAnesthesiaRecord: false,
  ponvFemale: false,
  ponvNonSmoker: false,
  ponvHistory: false,
  ponvPostopOpioids: false,

  /* Medical conditions */
  diabetes: 'no',
  diabetesType: '',
  lastBloodSugar: '',
  lastBloodSugarTime: '',
  takingInsulin: false,
  insulinPumpPresent: '',
  pumpAction: '',
  cgmPresent: '',
  aicd: 'no',
  aicdDeviceType: '',
  aicdManufacturer: '',
  aicdLastInterrogation: '',
  aicdMagnetAvailable: false,
  aicdRepNotified: false,
  pacerDependent: '',
  mastectomy: 'No',
  shunt: 'No',
  dentures: 'NA',
  glasses: 'NA',
  contactLenses: 'NA',
  hearingAids: 'NA',
  jewelryPiercings: 'NA',
  dentalConcerns: 'no',
  dentalConcernsDetail: '',
  osa: 'no',
  cpapHome: '',
  cpapBrought: '',
  stopBangSnoring: false,
  stopBangTired: false,
  stopBangObservedApnea: false,
  stopBangPressure: false,
  stopBangBmi: false,
  stopBangAge: false,
  stopBangNeck: false,
  stopBangGender: false,
  pregnancyStatus: 'N/A',
  lmpDate: '',
  hcgResult: '',
  hcgDate: '',
  latexAllergy: 'no',
  asthmaCopd: 'no',
  inhalerLastUse: '',
  seizureDisorder: 'no',
  lastSeizureDate: '',
  dialysis: 'no',
  lastDialysisDate: '',
  dialysisAccessSite: '',
  liverDisease: 'no',
  strokeTia: 'no',
  strokeDate: '',
  cardiacStent: 'no',
  stentDate: '',
  stentType: '',
  implants: [],
  tobaccoUse: 'never',
  tobaccoLastUse: '',
  alcoholUse: 'never',
  alcoholLastUse: '',
  recreationalDrugUse: 'never',
  recreationalDrugLastUse: '',
  infectionPrecautions: 'None',
  fallRisk: 'Low',

  /* Baseline vitals — never defaulted */
  bpSystolic: '',
  bpDiastolic: '',
  heartRate: '',
  respiratoryRate: '',
  spo2: '',
  oxygenDelivery: 'Room air',
  oxygenLpm: '',
  temperature: '',
  temperatureRoute: 'Oral',
  painScore: 0,
  heightIn: '',
  weightLb: '',
  orientation: 'A&O ×4',
  vitalsTakenAt: '',

  /* Airway */
  asaClass: '',
  asaEmergency: false,
  mallampati: '',
  mouthOpening: '',
  thyromentalDistance: '',
  neckRom: '',
  facialHair: 'no',
  difficultAirwayHistory: 'no',
  difficultAirwayDetail: '',
  anesthesiaType: 'MAC',

  /* Weight loss */
  weightLoss: 'no',
  weightLossType: '',
  weightLossOther: '',
  weightLossFrequency: '',
  weightLossLastDose: '',
  weightLossHeld: '',
  weightLossDaysHeld: '',
  weightLossGiSymptoms: [],
  gastricUltrasound: '',
  gastricUltrasoundResult: '',

  /* Anticoagulant */
  anticoagulant: 'no',
  anticoagulantType: '',
  anticoagulantOther: '',
  anticoagulantDate: '',
  anticoagulantLastTime: '',
  anticoagulantIndication: '',
  anticoagulantHeld: '',
  anticoagulantDaysHeld: '',
  anticoagulantAcknowledged: false,
  bridgingTherapy: '',
  bridgingAgent: '',
  inrValue: '',
  inrDate: '',
  plateletCount: '',
  plateletDate: '',
  reversalAgentAvailable: false,
  reversalAgentName: '',
  antiplateletUse: 'no',
  antiplateletAgent: '',
  antiplateletLastDose: '',

  /* Allergies */
  allergyChecks: [],
  otherAllergies: '',
  allergies: [],
  allergyBandApplied: false,

  /* Medication reconciliation */
  homeMedsReconciled: false,
  medsTakenToday: '',
  medsTakenList: '',
  betaBlockerTaken: 'na',
  chronicOpioids: 'no',
  opioidDetails: '',
  abxProphylaxisRequired: 'no',
  abxAgent: '',
  abxDose: '',
  abxTimeGiven: '',

  /* Procedure information */
  npoStatus: 'standard',
  npoOtherText: '',
  npoExtended: false,
  lastSolidIntake: '',
  lastClearLiquidIntake: '',
  npoVerifiedWithPatient: false,
  npoResult: '',
  preparation: 'Split-dose PEG',
  colonPrepOther: '',
  prepCompletion: '',
  prepLastDoseTime: '',
  prepTolerance: '',
  colonPrepResults: '',
  colonPrepResultsOther: '',
  ivGauge: [],
  ivSite: [],
  ivTrials: [],
  ivDetails: '',
  ivStartedBy: '',
  ivStartTime: '',
  ivFluid: 'NS',
  ivRate: '',
  ivSiteCondition: 'Patent',
  ivEscalated: false,
  scope: '',
  secondInstrumentId: '',
  scopeReprocessingVerified: false,
  reprocessingLogNumber: '',
  groundingPadPlaced: 'na',
  groundingPadSite: '',
  specialEquipment: [],
  suctionOxygenChecked: false,
  emergencyMedsAvailable: false,
  notes: '',

  /* Sign-off — never defaulted */
  staffCredential: 'RN',
  secondVerifierInitials: '',
  attestation: false,
  /* Who closed it, recorded at the moment it was closed rather than derived
     later — the session moves on to the next nurse, the filed sheet does not. */
  completedBy: '',
  completedAt: '',
};

/**
 * This demo patient's sheet, already worked through in the bay.
 *
 * Every line the sheet gates on is answered here, because the encounter opens
 * onto a patient who has already been through pre-op — a seed that left the
 * gate open would show the room a checklist it could never close.
 */
export const PRE_CHECK_SEED = {
  ...PRE_CHECK_DEFAULT,

  timeInRoom: '07:41',
  arrivalMode: 'Ambulatory',
  twoIdentifiersVerified: true,
  escortPresent: 'yes',
  escortName: 'Dana Whitfield',
  escortRelationship: 'Spouse',
  escortPhone: '(701) 555-0148',
  interpreterNeeded: 'no',
  valuablesSecured: true,

  verified: ['verified', 'teaching', 'understanding'],
  consentSigned: true,
  consentMatchesProcedure: true,
  hpReviewed: true,
  hpDate: '2026-08-01',
  siteMarked: 'Not applicable to procedure',
  timeoutCompleted: true,
  timeoutTime: '07:52',
  timeoutParticipants: 'K. Brandt RN, Dr. Fadel, T. Okafor Tech',
  codeStatus: 'Full code',
  advanceDirectiveOnFile: 'yes',

  sedationHistory: 'none',
  mhFamilyHistory: 'no',
  priorAnesthesiaRecord: true,
  ponvFemale: true,
  ponvNonSmoker: true,

  diabetes: 'yes',
  diabetesType: 'Type 2',
  lastBloodSugar: '132',
  lastBloodSugarTime: '06:20',
  takingInsulin: true,
  insulinPumpPresent: 'no',
  cgmPresent: 'yes',
  aicd: 'no',
  mastectomy: 'No',
  shunt: 'No',
  dentures: 'NA',
  glasses: 'NA',
  contactLenses: 'NA',
  hearingAids: 'NA',
  jewelryPiercings: 'Removed',
  dentalConcerns: 'no',
  osa: 'suspected',
  cpapHome: 'no',
  stopBangSnoring: true,
  stopBangTired: true,
  stopBangPressure: true,
  stopBangAge: true,
  pregnancyStatus: 'N/A',
  latexAllergy: 'no',
  asthmaCopd: 'no',
  seizureDisorder: 'no',
  dialysis: 'no',
  liverDisease: 'no',
  strokeTia: 'no',
  cardiacStent: 'no',
  tobaccoUse: 'former',
  alcoholUse: 'never',
  recreationalDrugUse: 'never',
  infectionPrecautions: 'None',
  fallRisk: 'Moderate',

  bpSystolic: '138',
  bpDiastolic: '82',
  heartRate: '74',
  respiratoryRate: '16',
  spo2: '97',
  oxygenDelivery: 'Room air',
  temperature: '98.2',
  temperatureRoute: 'Oral',
  painScore: 0,
  heightIn: '66',
  weightLb: '186',
  orientation: 'A&O ×4',
  vitalsTakenAt: '07:44',

  asaClass: 'II',
  mallampati: 'II',
  mouthOpening: '≥3 fingerbreadths',
  thyromentalDistance: '≥6 cm',
  neckRom: 'Full',
  facialHair: 'no',
  difficultAirwayHistory: 'no',
  anesthesiaType: 'MAC',

  weightLoss: 'yes',
  weightLossType: 'Ozempic (Semaglutide)',
  weightLossFrequency: 'Weekly',
  weightLossLastDose: '2026-08-04',
  weightLossHeld: 'yes',
  weightLossDaysHeld: '10',
  weightLossGiSymptoms: ['none'],
  gastricUltrasound: 'no',

  anticoagulant: 'yes',
  anticoagulantType: 'Eliquis (Apixaban)',
  anticoagulantDate: '2026-08-09',
  anticoagulantLastTime: '20:00',
  anticoagulantIndication: 'Atrial fibrillation',
  anticoagulantHeld: 'yes',
  anticoagulantDaysHeld: '5',
  bridgingTherapy: 'no',
  plateletCount: '243000',
  plateletDate: '2026-08-07',
  reversalAgentAvailable: true,
  reversalAgentName: 'Andexanet alfa',
  antiplateletUse: 'no',

  allergyChecks: ['nkda', 'medications'],
  allergies: [],
  allergyBandApplied: false,

  homeMedsReconciled: true,
  medsTakenToday: 'partial',
  medsTakenList: 'Metoprolol 25 mg with a sip of water at 06:10. Metformin held.',
  betaBlockerTaken: 'yes',
  chronicOpioids: 'no',
  abxProphylaxisRequired: 'no',

  npoStatus: 'standard',
  npoExtended: true,
  lastSolidIntake: '2026-08-13T19:15',
  lastClearLiquidIntake: '2026-08-14T04:30',
  npoVerifiedWithPatient: true,
  npoResult: 'NPO status confirmed',
  preparation: 'Split-dose PEG',
  prepCompletion: 'Completed as directed',
  prepLastDoseTime: '2026-08-14T03:30',
  prepTolerance: 'Tolerated well',
  colonPrepResults: 'liquid',
  ivGauge: ['16G'],
  ivSite: ['Left AC'],
  ivTrials: ['4 trials'],
  ivDetails: '16G Left AC - 4 trials',
  ivStartedBy: 'KB',
  ivStartTime: '07:48',
  ivFluid: 'NS',
  ivRate: 'KVO',
  ivSiteCondition: 'Patent',
  ivEscalated: true,
  scope: SCOPE_OPTIONS[0] ?? '',
  scopeReprocessingVerified: true,
  reprocessingLogNumber: 'RP-2026-0814-03',
  groundingPadPlaced: 'na',
  specialEquipment: ['co2', 'clips'],
  suctionOxygenChecked: true,
  emergencyMedsAvailable: true,
  notes: 'Patient reports last apixaban dose 5 days ago, confirmed with pharmacy record.',

  staffCredential: 'RN',
  secondVerifierInitials: 'TO',
  attestation: true,
};

/* ============================================================================
   MIGRATION

   Sheets filed before this revision are still in the store, and they are the
   ones a nurse is most likely to open in a hurry. Loading one must not lose an
   answer or invent one.
   ========================================================================= */

/** The old capitalised / long-label binaries, mapped to the stored enum. */
const LEGACY_BINARY = {
  yes: 'yes', Yes: 'yes', no: 'no', No: 'no',
  'Taking Anticoagulant': 'yes', 'No Anticoagulant': 'no',
};

const LEGACY_SEDATION = {
  None: 'none',
  'Nausea or vomiting': 'nausea_vomiting',
  'Prolonged sedation': 'prolonged_sedation',
  'Difficult airway': 'difficult_airway',
  'Malignant hyperthermia — family or self': 'malignant_hyperthermia',
  Other: 'other',
};

/**
 * Bring a persisted sheet up to the current shape.
 *
 * Three things changed and each has to be undone in a way that cannot guess:
 *   - binaries were 'Yes'/'No' strings (and, before that, a pair of booleans)
 *   - NPO was a multi-select array; it is now one choice plus a separate tick
 *   - sedation history was stored as its own label
 *
 * A value that does not match anything known is left exactly as it is rather
 * than defaulted — a sheet that loads with a blank where an answer used to be
 * is worse than one that loads with something unrecognised in it.
 */
export function migratePreCheck(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const next = { ...saved };

  /* The two-boolean shape, from before either was a single field. */
  const pair = (key, noKey, yesKey) => {
    if (next[key] !== undefined) return;
    if (saved[yesKey] === true) next[key] = 'yes';
    else if (saved[noKey] === true) next[key] = 'no';
  };
  pair('diabetes', 'diabetesNo', 'diabetesYes');
  pair('aicd', 'aicdNo', 'aicdYes');
  pair('weightLoss', 'weightLossNo', 'weightLossYes');
  pair('anticoagulant', 'anticoagulantNo', 'anticoagulantYes');

  ['diabetes', 'aicd', 'weightLoss', 'anticoagulant'].forEach((key) => {
    if (LEGACY_BINARY[next[key]]) next[key] = LEGACY_BINARY[next[key]];
  });

  if (LEGACY_SEDATION[next.sedationHistory]) {
    next.sedationHistory = LEGACY_SEDATION[next.sedationHistory];
  }

  /* NPO: one array became a choice plus a tick. 'other' wins over 'standard'
     when a legacy sheet somehow carries both — it is the one with free text
     attached, so keeping it is the only reading that preserves an answer. */
  if (Array.isArray(saved.npo)) {
    const list = saved.npo;
    if (next.npoStatus === undefined) {
      next.npoStatus = list.includes('other') ? 'other' : list.includes('standard') ? 'standard' : '';
    }
    if (next.npoExtended === undefined) next.npoExtended = list.includes('extended');
    delete next.npo;
  }

  /* Allergy rows arrived later; a sheet without them has none, not undefined. */
  if (!Array.isArray(next.allergies)) next.allergies = [];

  /* The three IV quick-selects were one choice each before they were lists.
     A stored '16G' becomes ['16G'] rather than being dropped: the composed
     ivDetails string is what the gate reads, but the chips have to come back
     up pressed or the nurse re-answers a question already answered. */
  ['ivGauge', 'ivSite', 'ivTrials'].forEach((key) => {
    if (Array.isArray(next[key])) return;
    next[key] = next[key] ? [next[key]] : [];
  });

  return next;
}

/**
 * Who signs it, and what signing it does.
 *
 * Signing does not end the visit — it hands it on. The sheet is filed and the
 * patient is cleared to proceed into anaesthesia management.
 */
export const PRE_CHECK_SIGNATURE = {
  nurse: 'Kayla Brandt, RN',
  note: 'Signing files the sheet and clears the patient to proceed.',
  filed: 'Filed to the encounter.',
};
