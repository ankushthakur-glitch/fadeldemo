/**
 * DEMO DATA for Settings ▸ Documents & Templates.
 * Entirely invented — no real patient information, no real clinician names.
 *
 * WHAT A TEMPLATE IS HERE
 * A note template is an ORDERED LIST OF SECTIONS, not a document. gGastro's
 * builder (the legacy screen this replaces) is a palette of every section the
 * practice has on the left and the template's running order on the right; you
 * assemble a note by choosing sections and putting them in order. So a
 * template row stores `sections: [sectionId…]` and nothing about layout — the
 * layout belongs to the section.
 *
 * MACROS ARE NOT TEMPLATES
 * A macro is a block of prose a clinician drops into a note they are already
 * writing ("Hypertension", "Semaglutide Initiation Protocol"). It has a title
 * and a body and no sections at all, which is why it gets its own tab, its own
 * columns and its own, much smaller, create dialog.
 */

/* ============================================================================
   THE TABS

   Two kinds, and they are genuinely different things: a visit note template is
   an ordered list of sections built in the builder, a macro is a block of
   prose. Everything else is listed in the same table and built in the same
   builder, so the tabs were sorting templates by what they happened to be
   called rather than by anything the screen does differently.

   Custom Questionnaire, Review of System, Physical Exam, Annotable Image and
   Order Set were here and are gone. They were five names for "an ordered list
   of sections", which Visit Notes already is — and a questionnaire that is
   filed under Questionnaire cannot be found by someone looking under Visit
   Notes for the intake form they wrote. The Type column carries what a
   template is FOR, which is the distinction worth keeping.
   ========================================================================= */
export const TEMPLATE_KINDS = [
  { id: 'visit-notes', label: 'Visit Notes', noun: 'visit note template' },
  { id: 'macros', label: 'Macros', noun: 'macro', macros: true },
];

export const kindById = (id) => TEMPLATE_KINDS.find((k) => k.id === id) ?? TEMPLATE_KINDS[0];

/** What the Type column offers. A template is one of these shapes. */
export const TEMPLATE_TYPES = [
  'Procedure',
  'Infusion',
  'Clinic visit',
  'Consultation',
  'Follow-up',
  'Screening',
];

/* ============================================================================
   THE SECTION PALETTE — the left-hand list in the builder.

   Grouped, because a flat alphabetical list of sixty is the legacy screen's
   worst feature: "Layout - Space/Blank Line" and "Patient Date of Birth" sat
   next to each other with nothing to say they are different kinds of thing.

   `once: true` marks a section that can only appear once in a template —
   there is one letterhead and one service date. Layout spacers repeat freely.
   ========================================================================= */
export const SECTION_GROUPS = [
  {
    id: 'header',
    label: 'Header',
    sections: [
      { id: 'letterhead', label: 'Letterhead', once: true },
      { id: 'service-date', label: 'Service Date', once: true },
      { id: 'patient-name', label: 'Patient Name', once: true },
      { id: 'patient-mrn', label: 'Patient Record Number', once: true },
      { id: 'patient-dob', label: 'Patient Date of Birth', once: true },
      { id: 'patient-gender', label: 'Patient Gender', once: true },
      { id: 'providers', label: 'Provider(s)/Endoscopist(s)', once: true },
      { id: 'nurses', label: 'Nurse(s)' },
      { id: 'anesthesia-provider', label: 'Anesthesia Provider' },
      { id: 'cc-referring', label: 'CC Referring Physician(s)' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    sections: [
      { id: 'layout-2col', label: 'Group in 2 Columns' },
      { id: 'layout-space', label: 'Space / Blank Line' },
      { id: 'layout-text', label: 'Free Text' },
      { id: 'layout-list', label: 'List' },
      { id: 'layout-rule', label: 'Horizontal Rule' },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical',
    sections: [
      { id: 'chief-complaint', label: 'Chief Complaint' },
      { id: 'indications', label: 'Indications' },
      { id: 'allergies', label: 'Allergies' },
      { id: 'assessment', label: 'Assessment' },
      { id: 'complications', label: 'Complications' },
      { id: 'clinical-scoring', label: 'Clinical Scoring' },
      { id: 'asa-class', label: 'ASA Class' },
      { id: 'diagnostic-studies', label: 'Diagnostic Studies' },
      { id: 'data-review', label: 'Data Review' },
      { id: 'consultation-narrative', label: 'Consultation Note Narrative' },
    ],
  },
  {
    id: 'medication',
    label: 'Medication',
    sections: [
      { id: 'administered-meds', label: 'Administered Medications (Total)' },
      { id: 'medication-ibd', label: 'Medication for IBD' },
      { id: 'cimzia-dosing', label: 'Cimzia Dosing' },
      { id: 'remicade-infusion', label: 'Remicade Infusion' },
      { id: 'infusion-reaction', label: 'Infusion Reaction' },
      { id: 'labs', label: 'Labs' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    sections: [
      { id: 'alcohol', label: 'Alcohol' },
      { id: 'caffeine', label: 'Caffeine' },
      { id: 'breath-test', label: 'Breath Test' },
      { id: 'breath-test-readings', label: 'Breath Test Readings' },
      { id: 'complaints', label: 'Complaints' },
      { id: 'consulting', label: 'Consulting' },
    ],
  },
  {
    id: 'admin',
    label: 'Administrative',
    sections: [
      { id: 'all-insurances', label: 'All Insurances' },
      { id: 'additional-insurance', label: 'Additional Insurance' },
      { id: 'billing', label: 'Billing' },
      { id: 'billing-infusions', label: 'Billing Infusions' },
      { id: 'additional-notes', label: 'Additional Notes' },
      { id: 'comment', label: 'Comment' },
      { id: 'complaints-rights', label: 'Complaints Rights' },
      { id: 'assessment-checklist', label: 'Patient Assessment Checklist' },
    ],
  },
];

/** Flat id → section, for the canvas and the preview. */
export const SECTION_INDEX = new Map(
  SECTION_GROUPS.flatMap((group) =>
    group.sections.map((section) => [section.id, { ...section, group: group.label }])
  )
);

export const sectionById = (id) => SECTION_INDEX.get(id) ?? null;

/* ============================================================================
   TEMPLATES

   `sections` is the running order the builder writes back. The Actemra
   Infusion template is the one from the legacy screenshot, section for
   section, so the builder can be checked against a known-good example.
   ========================================================================= */
export const TEMPLATES = [
  {
    id: 'TPL-101',
    kind: 'visit-notes',
    name: 'Actemra Infusion',
    type: 'Infusion',
    createdAt: '2026-03-14',
    createdBy: 'Dr. A. Mensah',
    sections: [
      'letterhead',
      'layout-text',
      'service-date',
      'layout-2col',
      'patient-name',
      'patient-gender',
      'patient-mrn',
      'patient-dob',
      'providers',
      'layout-space',
      'nurses',
      'layout-space',
      'indications',
      'cimzia-dosing',
      'layout-space',
      'allergies',
      'medication-ibd',
      'labs',
      'assessment-checklist',
      'layout-list',
      'remicade-infusion',
      'layout-list',
      'infusion-reaction',
    ],
  },
  {
    id: 'TPL-104',
    kind: 'visit-notes',
    name: 'Colonoscopy — Screening',
    type: 'Procedure',
    createdAt: '2026-02-02',
    createdBy: 'Dr. F. Nammour',
    sections: [
      'letterhead',
      'service-date',
      'patient-name',
      'patient-mrn',
      'providers',
      'indications',
      'asa-class',
      'assessment',
      'complications',
    ],
  },
  {
    id: 'TPL-107',
    kind: 'visit-notes',
    name: 'IBD Clinic Follow-up',
    type: 'Follow-up',
    createdAt: '2026-04-28',
    createdBy: 'Dr. S. Maidinger',
    sections: ['letterhead', 'service-date', 'chief-complaint', 'medication-ibd', 'labs', 'assessment'],
  },
  {
    id: 'TPL-112',
    kind: 'visit-notes',
    name: 'EGD — Diagnostic',
    type: 'Procedure',
    createdAt: '2026-01-19',
    createdBy: 'Dr. F. Nammour',
    sections: ['letterhead', 'service-date', 'patient-name', 'indications', 'assessment'],
  },
  {
    id: 'TPL-118',
    kind: 'visit-notes',
    name: 'New Patient Consultation',
    type: 'Consultation',
    createdAt: '2026-05-06',
    createdBy: 'Dr. A. Mensah',
    sections: ['letterhead', 'service-date', 'chief-complaint', 'consultation-narrative', 'assessment'],
  },

  {
    id: 'TPL-201',
    kind: 'visit-notes',
    name: 'Pre-Procedure Intake',
    type: 'Screening',
    createdAt: '2026-02-11',
    createdBy: 'K. Brandt, RN',
    sections: ['patient-name', 'patient-dob', 'alcohol', 'caffeine', 'allergies'],
  },
  {
    id: 'TPL-204',
    kind: 'visit-notes',
    name: 'Infusion Suite Check-in',
    type: 'Infusion',
    createdAt: '2026-03-30',
    createdBy: 'K. Brandt, RN',
    sections: ['patient-name', 'allergies', 'assessment-checklist'],
  },

  {
    id: 'TPL-301',
    kind: 'visit-notes',
    name: 'GI Review of Systems',
    type: 'Clinic visit',
    createdAt: '2026-01-08',
    createdBy: 'Dr. A. Mensah',
    sections: ['chief-complaint', 'complaints', 'diagnostic-studies'],
  },

  {
    id: 'TPL-401',
    kind: 'visit-notes',
    name: 'Abdominal Examination',
    type: 'Clinic visit',
    createdAt: '2026-02-24',
    createdBy: 'Dr. S. Maidinger',
    sections: ['assessment', 'clinical-scoring'],
  },

  {
    id: 'TPL-601',
    kind: 'visit-notes',
    name: 'Colon Segment Diagram',
    type: 'Procedure',
    createdAt: '2026-04-02',
    createdBy: 'Dr. F. Nammour',
    sections: ['layout-text', 'assessment'],
  },

  {
    id: 'TPL-701',
    kind: 'visit-notes',
    name: 'Pre-Colonoscopy Labs',
    type: 'Procedure',
    createdAt: '2026-03-05',
    createdBy: 'Dr. F. Nammour',
    sections: ['labs', 'diagnostic-studies'],
  },
];

/* ============================================================================
   MACROS

   Title and author only — the same two columns the reference screen shows.
   A macro's body is prose, so there is nothing else to put in a column that
   would not just be the first line of it.
   ========================================================================= */
export const MACROS = [
  { id: 'MAC-01', title: 'Hypertension', createdBy: 'Dr. A. Mensah', description: 'Standing paragraph for a hypertensive patient seen for an unrelated GI complaint.' },
  { id: 'MAC-02', title: 'Depression', createdBy: 'Dr. S. Maidinger', description: 'PHQ-9 result and the follow-up wording that goes with each band.' },
  { id: 'MAC-03', title: 'Male Hormone Replacement Therapy Overview', createdBy: 'Dr. F. Nammour', description: 'Counselling summary handed to the patient at the first visit.' },
  { id: 'MAC-04', title: 'Semaglutide Initiation Protocol', createdBy: 'Dr. A. Mensah', description: 'Dose ladder and the review points at each step.' },
  { id: 'MAC-05', title: 'Semaglutide Treatment Start Guide', createdBy: 'K. Brandt, RN', description: 'What the nurse covers at the start-of-treatment call.' },
  { id: 'MAC-06', title: 'Semaglutide Administration Overview', createdBy: 'K. Brandt, RN', description: 'Injection technique, sites and rotation.' },
  { id: 'MAC-07', title: 'Semaglutide Onboarding Process', createdBy: 'S. Okoro', description: 'The administrative steps between prescribing and the first dose.' },
  { id: 'MAC-08', title: 'Semaglutide Patient Start Instructions', createdBy: 'K. Brandt, RN', description: 'Plain-language instructions the patient takes home.' },
  { id: 'MAC-09', title: 'Semaglutide Introduction for Patients', createdBy: 'S. Okoro', description: 'What the drug is and what to expect in the first month.' },
  { id: 'MAC-10', title: 'Semaglutide Initial Treatment Steps', createdBy: 'Dr. S. Maidinger', description: 'First four weeks, week by week.' },
  { id: 'MAC-11', title: 'Semaglutide Start-Up Guidelines', createdBy: 'Dr. A. Mensah', description: 'Prescribing guardrails — contraindications and the checks before dose one.' },
  { id: 'MAC-12', title: 'Semaglutide Kickoff Plan', createdBy: 'S. Schochenmaier', description: 'Scheduling pattern for the initiation visits.' },
  { id: 'MAC-13', title: 'Semaglutide Launch Protocol', createdBy: 'Dr. F. Nammour', description: 'Clinic-wide protocol agreed at the 2026-02 meeting.' },
  { id: 'MAC-14', title: 'Semaglutide Start Checklist', createdBy: 'K. Brandt, RN', description: 'Tick list completed before the first injection is given.' },
  { id: 'MAC-15', title: 'Semaglutide Patient Onboarding Guide', createdBy: 'S. Okoro', description: 'Everything handed over at onboarding, in one document.' },
];
