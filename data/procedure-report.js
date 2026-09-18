/**
 * DEMO DATA — the endoscopy report.
 *
 * THE MECHANIC WORTH KEEPING
 * The endoscopist never writes the Findings paragraph. They record structure —
 * a polyp, in the cecum, 1 cm from the anus, 1–2 mm, sessile, benign, not
 * bleeding, removed with a cold snare — and the report writes the prose. That
 * is what makes the narrative consistent between operators and what lets the
 * same record drive the impression, the specimen list and the coding.
 *
 * So the finding shapes below are the source of truth, and narrate() in
 * js/screens/encounter.js turns them into sentences. Nothing types prose twice.
 */

/* --- The findings tree ------------------------------------------------------ */

export const COMMON_FINDINGS = [
  {
    group: 'Favourites',
    items: [
      { id: 'normal-mucosa', label: 'Normal mucosa (whole colon)', kind: 'simple' },
      { id: 'normal-exam', label: 'Normal colonoscopy exam', kind: 'simple' },
    ],
  },
  {
    group: 'Polyps',
    items: [
      { id: 'polyp', label: 'Polyp — structured', kind: 'polyp' },
      { id: 'polyp-cold-forceps', label: 'Sessile polyp / cold forceps', kind: 'polyp', preset: { pedicle: 'sessile', intervention: 'Cold forceps polypectomy' } },
      { id: 'polyp-cold-snare', label: 'Sessile polyp / cold snare', kind: 'polyp', preset: { pedicle: 'sessile', intervention: 'Cold snare polypectomy (single piece)' } },
      { id: 'polyp-hot-snare', label: 'Pedunculated polyp / hot snare', kind: 'polyp', preset: { pedicle: 'pedunculated', intervention: 'Hot snare polypectomy' } },
    ],
  },
  {
    group: 'Mucosa and other',
    items: [
      { id: 'diverticulosis', label: 'Diverticulosis', kind: 'simple' },
      { id: 'haemorrhoids', label: 'Internal haemorrhoids', kind: 'simple' },
      { id: 'anal-fissure', label: 'Anal fissure', kind: 'simple' },
      { id: 'retroflexion', label: 'Retroflexion in the rectum performed', kind: 'simple' },
    ],
  },
];

/** The sentence each one-click finding contributes. */
export const SIMPLE_FINDING_TEXT = {
  'normal-mucosa': 'The mucosa appeared normal throughout the examined colon.',
  'normal-exam': 'This was a normal colonoscopy examination.',
  diverticulosis: 'Scattered diverticula were seen in the sigmoid colon without inflammation.',
  haemorrhoids: 'Small internal haemorrhoids were seen on retroflexion.',
  'anal-fissure': 'A superficial anal fissure was noted in the posterior midline.',
  retroflexion: 'Retroflexion was performed in the rectum and was unremarkable.',
};

export const SIMPLE_FINDING_IMPRESSION = {
  'normal-mucosa': 'Normal colonic mucosa.',
  'normal-exam': 'Normal colonoscopy.',
  diverticulosis: 'Sigmoid diverticulosis.',
  haemorrhoids: 'Internal haemorrhoids.',
  'anal-fissure': 'Anal fissure.',
  retroflexion: '',
};

/* --- The structured polyp form ---------------------------------------------- */

export const POLYP_SITES = [
  'anal canal', 'anastomosis', 'anus', 'appendiceal orifice', 'ascending colon',
  'cecum', 'descending colon', 'distal ascending colon', 'distal descending colon',
  'hepatic flexure', 'ileocaecal valve', 'rectum', 'sigmoid colon',
  'splenic flexure', 'transverse colon',
];

export const POLYP_APPEARANCE = ['benign', 'diminutive', 'multilobular', 'malignant'];
export const POLYP_PEDICLE = ['sessile', 'pedunculated', 'semi-pedunculated', 'mixed', 'flat'];
export const POLYP_BLEEDING = ['no', 'yes', 'stigmata', 'scant'];

export const POLYP_INTERVENTIONS = [
  'Cold snare polypectomy (single piece)',
  'Cold forceps polypectomy',
  'Hot snare polypectomy',
  'Hot biopsy',
  'Piecemeal snare polypectomy',
  'India ink tattoo',
  'Haemostasis — clip',
  'No intervention',
];

export const SIZE_UNITS = ['mm', 'cm'];

/* --- Pre-procedure physical exam --------------------------------------------- */

/**
 * The systems the pre-procedure exam covers.
 *
 * `tokens` are the sub-findings each row can carry — the same bracketed
 * placeholders the narrative uses. Marking a row normal fills them with the
 * `normal` wording; anything abnormal is typed against the row instead.
 */
export const EXAM_SYSTEMS = [
  {
    system: 'Constitutional',
    rows: [{ label: 'Appearance', tokens: ['General'], normal: 'well appearing, no distress' }],
  },
  {
    system: 'Skin',
    rows: [{ label: 'Inspection', tokens: ['General'], normal: 'warm and dry, no rash' }],
  },
  {
    system: 'Head/face',
    rows: [{ label: 'Inspection', tokens: ['General'], normal: 'normocephalic, atraumatic' }],
  },
  {
    system: 'Respiratory',
    rows: [
      { label: 'Effort', tokens: ['Effort'], normal: 'unlaboured' },
      { label: 'Auscultation', tokens: ['Sounds'], normal: 'clear to auscultation bilaterally' },
    ],
  },
  {
    system: 'Cardiovascular',
    rows: [
      {
        label: 'Auscultation',
        tokens: ['rhythm', 'gallops', 'sounds'],
        normal: 'S1 and S2 normal, no murmurs, no gallops',
      },
    ],
  },
  {
    system: 'Gastrointestinal/Abdomen',
    rows: [
      {
        label: 'Abdomen',
        tokens: ['palpation', 'sounds'],
        normal: 'soft, non-tender, normal bowel sounds',
      },
    ],
  },
  {
    system: 'Psychiatric',
    rows: [
      { label: 'Judgment/insight', tokens: ['general'], normal: 'normal judgement, normal insight' },
      { label: 'Orientation', tokens: ['orientation'], normal: 'oriented to time, place and person' },
    ],
  },
];

/** The two tabs the exam editor carries, and the context it is recorded in. */
export const EXAM_TABS = ['Physical exam', 'Functional/mental status'];
export const EXAM_CONTEXTS = ['Pre-procedure', 'Intra-procedure', 'Post-procedure'];
export const EXAM_SYSTEM_SETS = ['Systems', 'Focused GI', 'Full examination'];

/** Flags recorded alongside the exam rather than against a system. */
export const EXAM_FLAGS = [
  { id: 'not-performed', label: 'Not performed' },
  { id: 'chaperoned', label: 'Chaperoned' },
  { id: 'prior-anaesthesia', label: 'Prior to anaesthesia' },
];

/* --- Output manager ----------------------------------------------------------- */

export const OUTPUT_STEPS = [
  { id: 'sign', title: 'Sign', detail: 'Document(s) will be signed.', severity: 'info' },
  {
    id: 'appointment',
    title: 'Update appointment',
    detail: 'Appointment status will be changed to Check Out.',
    severity: 'info',
  },
  {
    id: 'charges',
    title: 'Create charges',
    detail: 'Charges will be created. Anaesthesia superbill will not be created — configuration missing.',
    severity: 'warning',
  },
  {
    id: 'medrec',
    title: 'Medication reconciliation',
    detail: 'Medication reconciliation not performed.',
    severity: 'warning',
  },
];

/* --- The report document ----------------------------------------------------
   Everything the printed report carries that is not a finding.
   -------------------------------------------------------------------------- */

export const REPORT_TEMPLATE = 'Colonoscopy — screening';

/**
 * The report templates the practice writes against.
 *
 * `type` is the value the [Colonoscopy Type] narrative token resolves to, so
 * switching template rewrites the opening sentence rather than only relabelling
 * the document. A template that changes nothing but a caption is a decoration.
 */
export const REPORT_TEMPLATES = [
  { title: 'Colonoscopy — screening', type: 'screening' },
  { title: 'Colonoscopy — surveillance', type: 'surveillance' },
  { title: 'Colonoscopy — diagnostic', type: 'diagnostic' },
  { title: 'Colonoscopy with polypectomy', type: 'therapeutic' },
  { title: 'EGD — diagnostic', type: 'diagnostic' },
  { title: 'EGD + colonoscopy', type: 'diagnostic' },
  { title: 'Flexible sigmoidoscopy — screening', type: 'screening' },
];

export const ADMINISTERED_MEDICATIONS = [
  'Midazolam 2 mg IV',
  'Fentanyl 50 mcg IV',
  'Propofol 60 mg IV',
];

export const REPORT_STAFF = {
  endoscopist: 'Fadel Nammour, MD',
  instrument: 'CF-HQ190L · 2841196',
  anaesthesia: 'M. Osei, CRNA',
  referring: 'G. Doctor, MD',
  pcp: 'G. Doctor, MD',
};

export const TIME_MARKERS = [
  { marker: 'Scope in', time: '08:06' },
  { marker: 'Caecum reached', time: '08:14' },
  { marker: 'Scope out', time: '08:26' },
];

export const SAMPLES = {
  pots: ['Pot 1 — sigmoid polyp', 'Pot 2 — transverse polyp', 'Pot 3 — oesophagus ×4'],
  summary: '3 specimens · Informed Diagnostics',
};

export const REPORT_ALERTS = [
  {
    severity: 'warning',
    title: 'Blood pressure trending high',
    detail: 'last three readings above range',
  },
  {
    severity: 'info',
    title: 'Medication due',
    detail: 'next sedation maintenance in 5 minutes',
  },
];

/**
 * The bracketed tokens in the narrative.
 *
 * Each one resolves from a structured field — the same principle as the
 * findings: record the fact once, and the prose assembles itself. A token that
 * is still unset is left visible and highlighted rather than silently blank,
 * because a report that reads "the extent reached was" and stops is worse than
 * one that visibly says what is missing. Clean up strips the leftovers.
 */
export const NARRATIVE_TOKENS = [
  { token: 'Risk Assessment', value: 'average' },
  { token: 'Colonoscopy Type', value: 'screening' },
  { token: 'Prior Date', value: '' },
  { token: 'Interval Reason', value: '' },
  { token: 'Type of Anesthesia', value: 'Monitored anaesthesia care' },
  { token: 'Anesthesia Provided By', value: 'M. Osei, CRNA' },
  { token: 'Prep Quality', value: 'good' },
  { token: 'Extent', value: 'the caecum' },
  { token: 'Distance', value: '' },
  { token: 'Sites Poorly Visualised', value: '' },
  { token: 'Landmarks', value: 'The appendiceal orifice and ileocaecal valve were photographed.' },
];

export const PATHOLOGY_STATUS =
  'Awaiting results — report remains open until pathology returns';

/** The templated body of the report, above the findings. */
export const PROCEDURE_NARRATIVE = [
  'This is a [Risk Assessment] risk patient undergoing [Colonoscopy Type] colonoscopy. ' +
    'Prior colonoscopy was performed on [Prior Date]. This colonoscopy is being performed ' +
    'sooner than the recommended timeframe due to [Interval Reason].',
  'The procedure, indications, preparation and potential complications were explained to ' +
    'the patient, who indicated understanding and signed the corresponding consent forms. ' +
    '[Type of Anesthesia] was administered by [Anesthesia Provided By]. Continuous pulse ' +
    'oximetry and blood pressure monitoring were used throughout. Supplemental oxygen was ' +
    'used. The quality of preparation was [Prep Quality]. Patient was placed in left ' +
    'lateral decubitus position. The colonoscope was introduced through the rectum and ' +
    'advanced under direct visualisation until [Extent] was reached at a distance of ' +
    '[Distance] cm. Visualisation of [Sites Poorly Visualised] was poor. [Landmarks] The ' +
    'colonoscope was retroflexed within the rectum. Careful visualisation was performed as ' +
    'the instrument was withdrawn. Patient tolerance was excellent. The procedure was not ' +
    'difficult. Digital exam was normal.',
];

/* --- Structured procedure-detail fields --------------------------------------
   These sit alongside the narrative above rather than replacing it — the
   narrative is still what prints as the procedure note; these are the same
   kind of per-visit charting fields EGD's report is built from (see
   data/procedure-intra.js), specialised for a colonoscopy. Blood loss,
   recommendations, the repeat-procedure unit list and the photo cap are
   identical concepts either way, so the encounter screen reuses EGD's
   exports for those instead of a second copy of the same four constants.
   -------------------------------------------------------------------------- */

/**
 * What was done, and the code each one is claimed under.
 *
 * THE CODE IS ON THE LIST BECAUSE THE LIST IS WHAT GETS CODED.
 * These were ten bare nouns, and the note over the card on the procedure
 * report has always said "what is ticked here is what gets coded" — which was
 * a promise the list could not keep on its own. A coder reading "Polypectomy"
 * still had to decide between the snare removal, the hot biopsy and the cold
 * forceps, from a report that had already been signed, and the endoscopist who
 * knew which one it was had left the building. So the CPT the practice bills
 * each of these under is on the line beside it, where it is chosen.
 *
 * The three whole-examination rows carry the code the visit is claimed under
 * rather than a procedure code — a screening scope on an average-risk patient
 * is G0121 and on a high-risk one G0105, and the difference is the whole
 * reason the two are separate lines here. The seven below them are the
 * therapeutic codes for the work done through the scope.
 *
 * Prototype fixture data, like every other list in this directory: a real
 * deployment reads its own fee schedule. What is NOT negotiable is the shape —
 * a label with no code beside it is the arrangement this replaced.
 */
export const COLONOSCOPY_PROCEDURES_PERFORMED = [
  { code: '45378', label: 'Diagnostic colonoscopy' },
  { code: 'G0121', label: 'Screening colonoscopy' },
  { code: 'G0105', label: 'Surveillance colonoscopy' },
  { code: '45385', label: 'Polypectomy' },
  { code: '45380', label: 'Biopsy' },
  { code: '45382', label: 'Hemostasis' },
  { code: '45379', label: 'Foreign body removal' },
  { code: '45386', label: 'Dilation' },
  { code: '45381', label: 'Tattoo placement' },
  { code: '45389', label: 'Stent placement' },
];

/**
 * When the patient comes back, in years.
 *
 * It was a free-text box reading "Repeat procedure in", which collected "3",
 * "3 years", "three years", "3/12" and — on a form filled in at the end of a
 * list — "3 yrs (sooner if symptomatic)". None of those is a date anything can
 * recall a patient on, which is what this answer is FOR: the surveillance
 * interval is what the recall list is built from, and a recall list cannot
 * parse prose.
 *
 * Years, and only years. The intervals are the ones the guidelines actually
 * name for a colonoscopy — a repeat measured in weeks is not surveillance, it
 * is an incomplete examination being redone, and that is recorded as an
 * outcome on the report rather than as a recall.
 */
export const COLONOSCOPY_REPEAT_YEARS = ['1', '2', '3', '5', '7', '10'];

/** The 10 dropdown fields under Procedure Details, in display order. */
export const COLONOSCOPY_PROCEDURE_DETAILS = [
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
    options: ['Air insufflation', 'CO2 insufflation', 'Water exchange'],
  },
  {
    id: 'compression',
    label: 'Abdominal compression and patient repositioning to facilitate cecal intubation',
    placeholder: 'Select compression',
    options: ['Not required', 'Abdominal compression', 'Patient repositioning', 'Both'],
  },
  {
    id: 'landmarks',
    label: 'Landmarks identified and images taken',
    placeholder: 'Select',
    options: ['Yes — all landmarks', 'Yes — partial', 'No'],
  },
  {
    id: 'difficulty',
    label: 'Procedure Difficulty',
    placeholder: 'Select difficulty',
    options: ['Easy', 'Moderate', 'Difficult'],
  },
  {
    id: 'depth',
    label: 'Depth Reached',
    placeholder: 'Select depth',
    options: [
      'Terminal ileum',
      'Cecum',
      'Ascending colon',
      'Hepatic flexure',
      'Transverse colon',
      'Splenic flexure',
      'Descending colon',
      'Sigmoid colon',
      'Rectum',
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
    label: 'Retroflexion',
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
    id: 'aiUsed',
    label: 'Artificial Intelligence (AI) Used',
    placeholder: 'Select',
    options: ['Yes — polyp detection', 'Yes — quality monitoring', 'No'],
  },
];

export const COLONOSCOPY_BOWEL_PREP_TYPES = [
  'Quality Assessment',
  'Boston Bowel Prep Score',
  'Aronchick Scale',
];

export const COLONOSCOPY_BOWEL_PREP_QUALITY = ['Excellent', 'Good', 'Fair', 'Poor', 'Inadequate'];

export const COLONOSCOPY_DEFAULT_COMPLICATIONS = 'No immediate complications';
