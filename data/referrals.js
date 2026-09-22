/**
 * DEMO DATA — the referral desk.
 *
 * A referral is a document that arrives by fax or email and has to become a
 * patient, a chart, and an appointment. Everything here exists to make that
 * journey visible: what arrived, what the OCR read off it, who it might
 * already match in the directory, and what still stands between the referral
 * and a booked visit.
 *
 * THE MECHANIC WORTH KEEPING
 * Nobody retypes a fax. The document is read once, the extraction populates
 * the registration form, and the person at the desk corrects rather than
 * transcribes. That is why OCR_EXTRACTS is keyed to the referral and carries
 * a `confidence` per field — a low-confidence date of birth should look
 * different from one the machine is sure about, because the desk needs to
 * know where to look.
 *
 * Names, numbers, MRNs and fax numbers are invented. No real PHI.
 */

/* ===================== Vocabulary ===================== */

/** Incoming referrals move through these, in order. */
export const STATUS_IN = [
  'Received',
  'OCR Processing',
  'Needs Review',
  'Assigned',
  'Processed',
  'Completed',
  'Rejected',
];

/** Outgoing referrals move through these. Expired is a dead end, not a step. */
export const STATUS_OUT = [
  'Draft',
  'Pending ROI',
  'Ready to Send',
  'Sent',
  'Delivered',
  'Viewed',
  'Completed',
  'Expired',
];

/** Badge tone per status, so the queue reads at a glance. */
export const STATUS_TONES = {
  Received: 'info',
  'OCR Processing': 'info',
  'Needs Review': 'warning',
  Assigned: 'info',
  Processed: 'success',
  Completed: 'success',
  Rejected: 'critical',
  Draft: 'neutral',
  'Pending ROI': 'warning',
  'Ready to Send': 'info',
  Sent: 'info',
  Delivered: 'success',
  Viewed: 'success',
  Expired: 'critical',
  'Not Sent': 'neutral',
  New: 'info',
  Signed: 'success',
};

/**
 * Priority.
 *
 * Primary and Secondary describe where the referral sits in the patient's
 * care, and STAT describes how fast it has to move. They are different axes,
 * which is why a card can carry both.
 */
export const PRIORITIES = ['Primary', 'Secondary'];
export const PRIORITY_TONES = { Primary: 'warning', Secondary: 'info' };

export const REFERRAL_SOURCES = [
  'Primary care physician',
  'Emergency department',
  'Hospital discharge',
  'Specialist',
  'Self-referral',
  'Insurance care management',
  'Employer health programme',
];

/** Where an incoming referral can be routed inside the practice. */
export const REFERRED_TO = [
  'Dr. Olivia Rhye — Gastroenterology',
  'Dr. Michael Johnson — Hepatology',
  'Dr. Emily Chen — IBD clinic',
  'Dr. David Smith — Endoscopy',
  'Dr. Kate Morrison — Motility',
  'Intake team — unassigned',
];

export const DOCUMENT_TYPES = [
  { id: 'demographics', label: 'Patient demographics' },
  { id: 'insurance', label: 'Insurance documents' },
  { id: 'history', label: 'Patient medical history' },
  { id: 'referral', label: 'Referral documents' },
  { id: 'id', label: 'Patient ID' },
  { id: 'other', label: 'Other' },
];

/* ===================== The outside world ===================== */

/**
 * The contact directory an outgoing referral is addressed from.
 *
 * Typing a fax number by hand is how a referral goes to the wrong practice,
 * so the directory is the default and manual entry is the exception.
 */
export const CONTACT_DIRECTORY = [
  {
    id: 'c1',
    provider: 'Dr. David Park, MD',
    facility: 'Austin Psychiatric Associates',
    specialty: 'Psychiatry',
    phone: '(512) 555-0312',
    fax: '(512) 555-0313',
    email: 'referrals@austinpsych.example',
  },
  {
    id: 'c2',
    provider: 'Dr. Helena Vargas, MD',
    facility: 'Red River Surgical Institute',
    specialty: 'Colorectal surgery',
    phone: '(701) 555-0144',
    fax: '(701) 555-0145',
    email: 'intake@redriversurgical.example',
  },
  {
    id: 'c3',
    provider: 'Dr. Samuel Achebe, MD',
    facility: 'Prairie Imaging Centre',
    specialty: 'Diagnostic radiology',
    phone: '(701) 555-0188',
    fax: '(701) 555-0189',
    email: 'orders@prairieimaging.example',
  },
  {
    id: 'c4',
    provider: 'Dr. Nina Kowalski, MD',
    facility: 'Northern Plains Oncology',
    specialty: 'Medical oncology',
    phone: '(701) 555-0210',
    fax: '(701) 555-0211',
    email: 'referrals@nponcology.example',
  },
  {
    id: 'c5',
    provider: 'Bethany Ross, RD',
    facility: 'GastroEMR Nutrition Services',
    specialty: 'Clinical dietetics',
    phone: '(701) 555-0266',
    fax: '(701) 555-0267',
    email: 'bethany.ross@medinovanutrition.example',
  },
];

/** Facilities the suggester offers while typing. */
export const FACILITY_SUGGESTIONS = [
  'Rochester Psychiatric Associates',
  'Red River Family Medicine',
  'Sanford Digestive Health',
  'Prairie Rose Internal Medicine',
  'Valley Community Health',
  'Northern Plains Oncology',
];

export const REFERRING_PROVIDERS = [
  'Dr. Julianne Conley, MD',
  'Dr. Gerald Doctor, MD',
  'Dr. Priyanka Nair, MD',
  'Dr. Tobias Lind, DO',
  'Sarah Chen, LCSW',
];

/* ===================== Fax pages ===================== */

/**
 * A faxed page, as plain text.
 *
 * The prototype has no PDF engine, so a page is text laid out in the fax's
 * own monospaced idiom. That is enough to exercise everything the viewer has
 * to do — zoom, rotate, paginate, thumbnail — without pretending to render
 * something we do not have.
 */
const COVER_SHEET = `REFERRAL COVER SHEET

Date:  18 March 2026
To:    GastroEMR Gastroenterology Clinic — Intake Department
Fax:   (701) 639-4550
From:  Dr. Julianne Conley, MD — Rochester Psychiatric Associates
Phone: (585) 393-0485

RE: Patient Referral — Henna West
DOB: 14/09/1992   |   MRN: EXT-44219

Dear Intake Team,

I am referring the above-named patient for outpatient gastroenterology
evaluation and ongoing management. Ms. West has been under my care since
January 2025 for iron deficiency anaemia with intermittent lower
abdominal pain.

Current Medications:
  • Ferrous sulfate 325 mg daily
  • Omeprazole 20 mg daily

Reason for Referral:
Patient is relocating to your service area and requires continuity of
care. She has been stable on the current regimen but would benefit from
colonoscopic evaluation and adjustment of pharmacotherapy.

Please find enclosed: Clinical Summary, Patient History, and recent
laboratory results.

Please contact my office if additional information is needed.

Sincerely,
Julianne Conley, MD
Board Certified Psychiatrist
Rochester Psychiatric Associates`;

const CLINICAL_SUMMARY = `CLINICAL SUMMARY

Patient:  West, Henna J.
DOB:      14/09/1992        Sex: F
MRN:      EXT-44219
Address:  8642 Yule Street, Williston, ND 80007
Phone:    (569) 822-4144

PRESENTING COMPLAINT
Intermittent lower abdominal pain, 8 months. Associated with loose
stool 3–4 times daily, worse in the mornings. No nocturnal symptoms.
No rectal bleeding reported.

PAST MEDICAL HISTORY
  2019  Iron deficiency anaemia — responded to oral replacement
  2021  Appendicectomy
  2024  Helicobacter pylori — eradicated, confirmed by breath test

FAMILY HISTORY
  Mother — colorectal carcinoma, diagnosed age 58
  Father — type 2 diabetes

EXAMINATION
  BP 118/74   HR 72   BMI 23.4
  Abdomen soft, mild left iliac fossa tenderness, no masses.
  No hepatosplenomegaly. Bowel sounds normal.

INVESTIGATIONS
  Hb 10.2 g/dL     Ferritin 11 ng/mL     CRP 4 mg/L
  Faecal calprotectin 118 µg/g
  Coeliac serology negative

IMPRESSION
Iron deficiency anaemia with altered bowel habit and a first-degree
family history of colorectal carcinoma. Colonoscopy indicated.`;

const INSURANCE_PAGE = `INSURANCE VERIFICATION

Subscriber:      West, Henna J.
Member ID:       NPH-4471-8820
Group:           WILLISTON-CIVIC-04
Carrier:         Northern Plains Health Plan
Plan type:       PPO
Effective:       01/01/2026
Termination:     —

Copay — specialist:        $40
Deductible:                $1,500   (met: $420)
Out-of-pocket maximum:     $6,000   (met: $420)

Prior authorisation required for:
  • Colonoscopy — screening         NO
  • Colonoscopy — diagnostic        NO
  • Capsule endoscopy               YES
  • Anaesthesia (MAC)               YES

Verified by:  M. Ruiz, Patient Access
Verified on:  17 March 2026, 14:22`;

const LAB_PAGE = `LABORATORY REPORT

Collected:  12 March 2026 08:14
Reported:   12 March 2026 16:02
Accession:  QDO-58-10801111

FULL BLOOD COUNT                    RESULT      REFERENCE
  Haemoglobin                       10.2 L      12.0 – 15.5 g/dL
  Mean cell volume                  76.4 L      80 – 100 fL
  Platelets                         388         150 – 400 x10^9/L
  White cell count                  6.8         4.0 – 11.0 x10^9/L

IRON STUDIES
  Ferritin                          11 L        15 – 200 ng/mL
  Transferrin saturation            9 % L       20 – 50 %

INFLAMMATORY MARKERS
  C-reactive protein                4           < 5 mg/L
  Faecal calprotectin               118 H       < 50 µg/g

COELIAC SEROLOGY
  Tissue transglutaminase IgA       < 1.0       < 4.0 U/mL
  Total IgA                         2.1         0.7 – 4.0 g/L

ICD-10 diagnosis codes: D50.9, R10.31

Performing laboratory: Informed Diagnostics, Fargo ND
Director: N. Vadalia, MD`;

const OUTBOUND_PAGE = `REFERRAL — OUTBOUND

From:  GastroEMR Gastroenterology Clinic
       5049 33rd Ave S, Fargo, ND 58104
       Phone (701) 356-1001   Fax (701) 639-4550

To:    Dr. David Park, MD
       Austin Psychiatric Associates
       Fax (512) 555-0313

Patient:   Kristin Watson
MRN:       MRN-12345
DOB:       18/05/1970
Phone:     (505) 555-0125

Referring provider: Sarah Chen, LCSW
Referral source:    Specialist
Reason:             Psychiatric evaluation — mood symptoms complicating
                    inflammatory bowel disease management

CLINICAL BACKGROUND
Ms. Watson carries a diagnosis of ulcerative colitis, currently in
remission on mesalazine. Over the past four months she reports low
mood, anhedonia and disrupted sleep, which have not responded to
primary care management.

ENCLOSED
  1. Clinical summary
  2. Current medication list
  3. PHQ-9 and GAD-7 scores
  4. Most recent colonoscopy report

ICD-10: K51.90, F32.1

Signed: Sarah Chen, LCSW — 22 January 2026`;

/* ===================== Incoming referrals ===================== */

/**
 * The inbox.
 *
 * Fax referrals carry pages; email referrals carry a letter and attachments.
 * The queue treats them the same because the desk's job is the same either
 * way — read it, match it to a patient, route it.
 */
export const REFERRALS_IN = [
  {
    id: 'ri1',
    channel: 'fax',
    unread: true,
    priority: 'Secondary',
    stat: true,
    status: 'Needs Review',
    receivedAt: '2026-08-05T08:45',
    patient: { name: 'Henna West', dob: '14/09/1992', phone: '+1 585 393 0485' },
    from: {
      provider: 'Dr. Julianne Conley, MD',
      facility: 'Rochester Psychiatric Associates',
      fax: '+1 585 393 0485',
      phone: '(585) 393-0485',
    },
    summary: 'Iron deficiency anaemia with altered bowel habit — colonoscopy requested.',
    referredTo: 'Intake team — unassigned',
    source: 'Primary care physician',
    reason: 'Continuity of care — relocating patient',
    pages: [
      { title: 'Cover sheet — referral', text: COVER_SHEET },
      { title: 'Clinical summary', text: CLINICAL_SUMMARY },
      { title: 'Insurance verification', text: INSURANCE_PAGE },
      { title: 'Laboratory report', text: LAB_PAGE },
    ],
  },
  {
    id: 'ri2',
    channel: 'fax',
    unread: true,
    priority: '',
    stat: false,
    status: 'Rejected',
    receivedAt: '2026-08-05T07:20',
    patient: { name: 'Theresa Webb', dob: '02/02/1988', phone: '+1 585 393 0485' },
    from: {
      provider: 'Dr. Tobias Lind, DO',
      facility: 'Valley Community Health',
      fax: '+1 585 393 0485',
      phone: '(701) 555-0332',
    },
    summary: 'Duplicate of a referral received 03 August — returned to sender.',
    referredTo: 'Intake team — unassigned',
    source: 'Primary care physician',
    reason: 'Duplicate submission',
    rejection: 'Duplicate of referral RI-2026-0731. No action required.',
    pages: [{ title: 'Cover sheet — referral', text: COVER_SHEET }],
  },
  {
    id: 'ri3',
    channel: 'fax',
    unread: false,
    priority: '',
    stat: false,
    status: 'Assigned',
    receivedAt: '2026-08-04T15:02',
    patient: { name: 'Savannah Nguyen', dob: '30/11/1979', phone: '+1 585 393 0485' },
    from: {
      provider: 'Dr. Priyanka Nair, MD',
      facility: 'Red River Family Medicine',
      fax: '+1 585 393 0485',
      phone: '(701) 555-0410',
    },
    summary: 'Chronic reflux, poor response to PPI — upper endoscopy requested.',
    referredTo: 'Dr. Olivia Rhye — Gastroenterology',
    source: 'Primary care physician',
    reason: 'Refractory gastro-oesophageal reflux',
    pages: [
      { title: 'Cover sheet — referral', text: COVER_SHEET },
      { title: 'Clinical summary', text: CLINICAL_SUMMARY },
    ],
  },
  {
    id: 'ri4',
    channel: 'fax',
    unread: false,
    priority: 'Primary',
    stat: true,
    status: 'Received',
    receivedAt: '2026-08-04T11:38',
    patient: { name: 'Leslie Alexander', dob: '07/04/2001', phone: '+1 585 393 0485' },
    from: {
      provider: 'Dr. Gerald Doctor, MD',
      facility: 'Sanford Digestive Health',
      fax: '+1 585 393 0485',
      phone: '(701) 555-0198',
    },
    summary: 'Acute lower GI bleeding — urgent assessment requested.',
    referredTo: 'Intake team — unassigned',
    source: 'Emergency department',
    reason: 'Acute lower gastrointestinal bleeding',
    pages: [
      { title: 'Cover sheet — referral', text: COVER_SHEET },
      { title: 'Laboratory report', text: LAB_PAGE },
      { title: 'Insurance verification', text: INSURANCE_PAGE },
    ],
  },

  /* --- Email --- */
  {
    id: 'ri5',
    channel: 'email',
    unread: false,
    priority: 'Primary',
    stat: false,
    status: 'Needs Review',
    receivedAt: '2026-08-05T08:45',
    patient: {
      name: 'Theresa Webb',
      dob: '22/05/1996',
      phone: '(555) 234-6789',
      email: 'theresaweb@example.com',
    },
    from: {
      provider: 'Dr. Julianne Conley, MD',
      facility: 'Rochester Psychiatric Associates',
      email: 'theresaweb@example.com',
    },
    subject: 'Referral — Emily Johnson, comprehensive GI evaluation',
    summary: 'Persistent low mood with GI symptoms — comprehensive evaluation requested.',
    referredTo: 'Intake team — unassigned',
    source: 'Specialist',
    reason: 'Comprehensive evaluation and management',
    letter: [
      'Dear Dr. Smith,',
      'I hope you are doing well.',
      'I am referring my patient, Emily Johnson, a 29-year-old female, for comprehensive gastroenterology evaluation and management.',
      'Patient Information:',
      { list: ['Name: Emily Johnson', 'Date of Birth: 22 May 1996', 'Phone: (555) 234-6789'] },
      'Clinical Summary:',
      'Ms. Johnson presents with a 3-month history of persistent abdominal discomfort, decreased appetite, and disrupted sleep. She reports increased bloating and occasional episodes of nausea. These symptoms have begun to interfere with her daily functioning and work performance.',
      'Relevant History:',
      {
        list: [
          'No prior gastrointestinal surgery',
          'No history of substance use',
          'Family history significant for coeliac disease',
        ],
      },
      'Current Medications:',
      { list: ['Omeprazole 20 mg daily', 'Hyoscine butylbromide 10 mg PRN'] },
      'Please contact my office if any further information would be helpful.',
      'Kind regards,',
      'Julianne Conley, MD',
    ],
    attachments: [
      { title: 'Cover sheet — referral', meta: 'Referral cover · 1p · 85 KB', text: COVER_SHEET },
      { title: 'Clinical summary', meta: 'Clinical · 1p · 85 KB', text: CLINICAL_SUMMARY },
      { title: 'Insurance verification', meta: 'Insurance · 1p · 85 KB', text: INSURANCE_PAGE },
      { title: 'Laboratory report', meta: 'Labs · 1p · 85 KB', text: LAB_PAGE },
    ],
  },
  {
    id: 'ri6',
    channel: 'email',
    unread: true,
    priority: '',
    stat: false,
    status: 'Received',
    receivedAt: '2026-08-05T06:12',
    patient: {
      name: 'Jane Cooper',
      dob: '11/01/1984',
      phone: '(555) 812-4410',
      email: 'jane.cooper@example.com',
    },
    from: {
      provider: 'Dr. Priyanka Nair, MD',
      facility: 'Prairie Rose Internal Medicine',
      email: 'jane.cooper@example.com',
    },
    subject: 'Referral — coeliac screening',
    summary: 'Positive coeliac serology — duodenal biopsy requested.',
    referredTo: 'Intake team — unassigned',
    source: 'Primary care physician',
    reason: 'Coeliac disease confirmation',
    letter: [
      'Dear Intake Team,',
      'Please accept this referral for duodenal biopsy to confirm coeliac disease following positive serology.',
      'The patient remains on a gluten-containing diet pending endoscopy, as advised.',
      'Kind regards,',
      'Priyanka Nair, MD',
    ],
    attachments: [
      { title: 'Cover sheet — referral', meta: 'Referral cover · 1p · 85 KB', text: COVER_SHEET },
      { title: 'Laboratory report', meta: 'Labs · 1p · 85 KB', text: LAB_PAGE },
      { title: 'Clinical summary', meta: 'Clinical · 1p · 85 KB', text: CLINICAL_SUMMARY },
      { title: 'Insurance verification', meta: 'Insurance · 1p · 85 KB', text: INSURANCE_PAGE },
    ],
  },
  {
    id: 'ri7',
    channel: 'email',
    unread: false,
    priority: '',
    stat: false,
    status: 'Processed',
    receivedAt: '2026-08-04T13:55',
    patient: {
      name: 'Floyd Miles',
      dob: '19/07/1966',
      phone: '(555) 640-2288',
      email: 'floyd.miles@example.com',
    },
    from: {
      provider: 'Dr. Gerald Doctor, MD',
      facility: 'Red River Family Medicine',
      email: 'floyd.miles@example.com',
    },
    subject: 'Referral — surveillance colonoscopy',
    summary: 'Three-year surveillance colonoscopy following adenoma removal.',
    referredTo: 'Dr. David Smith — Endoscopy',
    source: 'Primary care physician',
    reason: 'Surveillance colonoscopy',
    letter: [
      'Dear Colleague,',
      'Mr. Miles is due his three-year surveillance colonoscopy following removal of two tubular adenomas in 2023.',
      'He remains asymptomatic. Please arrange at your convenience.',
      'Kind regards,',
      'Gerald Doctor, MD',
    ],
    attachments: [
      { title: 'Cover sheet — referral', meta: 'Referral cover · 1p · 85 KB', text: COVER_SHEET },
      { title: 'Clinical summary', meta: 'Clinical · 1p · 85 KB', text: CLINICAL_SUMMARY },
    ],
  },
  {
    id: 'ri8',
    channel: 'email',
    unread: false,
    priority: 'Primary',
    stat: false,
    status: 'Completed',
    receivedAt: '2026-08-03T09:30',
    patient: {
      name: 'Robert Fox',
      dob: '03/03/1958',
      phone: '(555) 330-9912',
      email: 'robert.fox@example.com',
    },
    from: {
      provider: 'Dr. Tobias Lind, DO',
      facility: 'Valley Community Health',
      email: 'robert.fox@example.com',
    },
    subject: 'Referral — abnormal liver enzymes',
    summary: 'Persistently raised transaminases — hepatology opinion requested.',
    referredTo: 'Dr. Michael Johnson — Hepatology',
    source: 'Primary care physician',
    reason: 'Abnormal liver function tests',
    letter: [
      'Dear Hepatology Team,',
      'Mr. Fox has had persistently raised transaminases over six months with no obvious cause on first-line investigation.',
      'Alcohol history is negligible. Viral serology negative. Ultrasound shows mild steatosis.',
      'Grateful for your opinion.',
      'Tobias Lind, DO',
    ],
    attachments: [
      { title: 'Cover sheet — referral', meta: 'Referral cover · 1p · 85 KB', text: COVER_SHEET },
      { title: 'Laboratory report', meta: 'Labs · 1p · 85 KB', text: LAB_PAGE },
    ],
  },
];

/* ===================== Outgoing referrals ===================== */

/**
 * Release of Information.
 *
 * The clinic cannot transmit a referral containing the patient's record
 * until the patient has signed the release. It is the single hard gate in
 * the outbound flow, so the panel leads with it and the Send button stays
 * shut behind it — a rule that can be clicked past is not a rule.
 */
export const ROI_STEPS = ['Sent to Patient', 'Signed', 'Expired'];

export const REFERRALS_OUT = [
  {
    id: 'ro1',
    channel: 'fax',
    unread: false,
    stat: true,
    status: 'Not Sent',
    roi: 'pending',
    createdAt: '2026-08-05T09:10',
    sentAt: '',
    patient: {
      name: 'Devon Lane',
      mrn: 'MRN-12345',
      dob: '22/01/1991',
      phone: '(505) 555-0125',
      email: 'devon.lane@example.com',
    },
    referredTo: {
      provider: 'Dr. David Park, MD',
      facility: 'Austin Psychiatric Associates',
      specialty: 'Psychiatry',
      phone: '(512) 555-0312',
      fax: '(512) 555-0313',
    },
    referringProvider: 'Sarah Chen, LCSW',
    source: 'Specialist',
    reason: 'Psychiatric evaluation — mood symptoms complicating IBD management',
    notes: 'Patient aware of referral. Prefers afternoon appointments.',
    diagnosis: 'K51.90 · F32.1',
    pages: [
      { title: 'Referral — outbound', text: OUTBOUND_PAGE },
      { title: 'Clinical summary', text: CLINICAL_SUMMARY },
      { title: 'Laboratory report', text: LAB_PAGE },
    ],
  },
  {
    id: 'ro2',
    channel: 'fax',
    unread: false,
    stat: false,
    status: 'Sent',
    roi: 'signed',
    createdAt: '2026-08-04T14:20',
    sentAt: '2026-08-04T14:41',
    patient: {
      name: 'Marcus Thompson',
      mrn: 'MRN-30988',
      dob: '02/02/1951',
      phone: '(907) 555-0101',
      email: 'marcus.thompson@example.com',
    },
    referredTo: {
      provider: 'Dr. Helena Vargas, MD',
      facility: 'Red River Surgical Institute',
      specialty: 'Colorectal surgery',
      phone: '(701) 555-0144',
      fax: '(701) 555-0145',
    },
    referringProvider: 'Dr. Olivia Rhye, MD',
    source: 'Specialist',
    reason: 'Surgical opinion — recurrent sigmoid diverticulitis',
    notes: 'Three admissions in twelve months. Imaging enclosed.',
    diagnosis: 'K57.32',
    pages: [
      { title: 'Referral — outbound', text: OUTBOUND_PAGE },
      { title: 'Clinical summary', text: CLINICAL_SUMMARY },
    ],
  },
  {
    id: 'ro3',
    channel: 'fax',
    unread: false,
    stat: false,
    status: 'Delivered',
    roi: 'signed',
    createdAt: '2026-08-03T10:05',
    sentAt: '2026-08-03T10:26',
    patient: {
      name: 'Kristin Watson',
      mrn: 'MRN-11204',
      dob: '18/05/1970',
      phone: '(505) 555-0125',
      email: 'kristin.watson@example.com',
    },
    referredTo: {
      provider: 'Dr. Samuel Achebe, MD',
      facility: 'Prairie Imaging Centre',
      specialty: 'Diagnostic radiology',
      phone: '(701) 555-0188',
      fax: '(701) 555-0189',
    },
    referringProvider: 'Dr. Emily Chen, MD',
    source: 'Specialist',
    reason: 'MR enterography — suspected small bowel Crohn’s disease',
    notes: 'Renal function checked 01 Aug — eGFR 88.',
    diagnosis: 'K50.00',
    pages: [{ title: 'Referral — outbound', text: OUTBOUND_PAGE }],
  },
  {
    id: 'ro4',
    channel: 'fax',
    unread: true,
    stat: false,
    status: 'Expired',
    roi: 'expired',
    createdAt: '2026-06-28T08:40',
    sentAt: '',
    patient: {
      name: 'Cameron Williamson',
      mrn: 'MRN-40771',
      dob: '09/09/1962',
      phone: '(907) 555-0177',
      email: 'cameron.williamson@example.com',
    },
    referredTo: {
      provider: 'Dr. Nina Kowalski, MD',
      facility: 'Northern Plains Oncology',
      specialty: 'Medical oncology',
      phone: '(701) 555-0210',
      fax: '(701) 555-0211',
    },
    referringProvider: 'Dr. Michael Johnson, MD',
    source: 'Specialist',
    reason: 'Oncology opinion — hepatic lesion on surveillance imaging',
    notes: 'Release of information expired unsigned after 30 days.',
    diagnosis: 'K76.9',
    pages: [{ title: 'Referral — outbound', text: OUTBOUND_PAGE }],
  },

  /* --- Email --- */
  {
    id: 'ro5',
    channel: 'email',
    unread: false,
    stat: false,
    status: 'Viewed',
    roi: 'signed',
    createdAt: '2026-08-04T16:15',
    sentAt: '2026-08-04T16:18',
    patient: {
      name: 'Brooklyn Simmons',
      mrn: 'MRN-22087',
      dob: '27/10/1988',
      phone: '(505) 555-0190',
      email: 'brooklyn.simmons@example.com',
    },
    referredTo: {
      provider: 'Bethany Ross, RD',
      facility: 'GastroEMR Nutrition Services',
      specialty: 'Clinical dietetics',
      phone: '(701) 555-0266',
      fax: '(701) 555-0267',
      email: 'bethany.ross@medinovanutrition.example',
    },
    referringProvider: 'Dr. Emily Chen, MD',
    source: 'Specialist',
    reason: 'Dietetic input — newly diagnosed coeliac disease',
    notes: 'Patient would prefer a virtual first appointment.',
    diagnosis: 'K90.0',
    subject: 'Referral — Brooklyn Simmons, coeliac dietetic input',
    letter: [
      'Dear Bethany,',
      'Please accept this referral for Ms. Simmons, newly diagnosed with coeliac disease confirmed on duodenal biopsy this month.',
      'She would benefit from structured dietary education and follow-up.',
      'Kind regards,',
      'Emily Chen, MD',
    ],
    attachments: [
      { title: 'Referral — outbound', meta: 'Referral · 1p · 85 KB', text: OUTBOUND_PAGE },
      { title: 'Clinical summary', meta: 'Clinical · 1p · 85 KB', text: CLINICAL_SUMMARY },
    ],
  },
  {
    id: 'ro6',
    channel: 'email',
    unread: false,
    stat: false,
    status: 'Draft',
    roi: 'none',
    createdAt: '2026-08-05T11:02',
    sentAt: '',
    patient: {
      name: 'Wade Warren',
      mrn: 'MRN-51663',
      dob: '14/12/1974',
      phone: '(907) 555-0144',
      email: 'wade.warren@example.com',
    },
    referredTo: {
      provider: 'Dr. David Park, MD',
      facility: 'Austin Psychiatric Associates',
      specialty: 'Psychiatry',
      phone: '(512) 555-0312',
      fax: '(512) 555-0313',
      email: 'referrals@austinpsych.example',
    },
    referringProvider: 'Sarah Chen, LCSW',
    source: 'Specialist',
    reason: 'Psychological support — functional gut disorder',
    notes: '',
    diagnosis: 'K58.0',
    subject: 'Referral — Wade Warren',
    letter: ['Draft — not yet written.'],
    attachments: [],
  },
];

/* ===================== OCR ===================== */

/**
 * What the machine read off the document.
 *
 * `confidence` is the point of this shape. A field the OCR is unsure about
 * is worth a second's attention from the desk; one it is confident about is
 * not. Flattening both to plain text would throw that away and make every
 * field equally suspicious, which in practice means none of them get checked.
 */
export const OCR_EXTRACTS = {
  ri1: {
    seconds: 2.4,
    fields: {
      firstName: { value: 'Henna', confidence: 0.98 },
      middleName: { value: 'John', confidence: 0.71 },
      lastName: { value: 'West', confidence: 0.99 },
      dob: { value: '1992-09-14', confidence: 0.94 },
      gender: { value: 'Female', confidence: 0.88 },
      mrn: { value: 'EXT-44219', confidence: 0.91 },
      phone: { value: '569-822-4144', confidence: 0.86 },
      email: { value: 'hennawest@example.com', confidence: 0.62 },
      address1: { value: '8642 Yule Street', confidence: 0.93 },
      city: { value: 'Williston', confidence: 0.95 },
      state: { value: 'ND', confidence: 0.9 },
      zip: { value: '80007', confidence: 0.97 },
      insurer: { value: 'Northern Plains Health Plan', confidence: 0.89 },
      memberId: { value: 'NPH-4471-8820', confidence: 0.84 },
      referringProvider: { value: 'Dr. Julianne Conley, MD', confidence: 0.96 },
      reason: { value: 'Continuity of care — relocating patient', confidence: 0.79 },
      diagnosis: { value: 'D50.9 · R10.31', confidence: 0.82 },
    },
    /** Patients the document describes. A fax often carries more than one. */
    patients: [
      { key: 'p1', label: 'Patient 1', match: 'exact' },
      { key: 'p2', label: 'Patient 2', match: 'none' },
    ],
    documents: ['demographics', 'insurance'],
  },
};

/** What the second patient on the fax resolved to — no directory match. */
export const OCR_SECOND_PATIENT = {
  name: 'Marcus Thompson',
  dob: '02/02/1951',
  age: 75,
  phone: '(907) 555-0101',
};

/* ===================== Add-on actions ===================== */

/**
 * The overflow menu.
 *
 * `destructive` is marked here rather than matched by label at the call
 * site, so renaming "Reject referral" never quietly turns it into an
 * ordinary action.
 */
export const ADDON_ACTIONS = [
  { id: 'process', label: 'Process document', scope: 'in' },
  { id: 'forward', label: 'Forward referral', scope: 'both' },
  { id: 'download', label: 'Download original', scope: 'both' },
  { id: 'print', label: 'Print', scope: 'both' },
  { id: 'reject', label: 'Reject referral', scope: 'in', destructive: true },
];

export const REJECTION_REASONS = [
  'Duplicate referral',
  'Incomplete clinical information',
  'Outside our scope of practice',
  'Patient not eligible — out of area',
  'Insurance not contracted',
  'Referred in error',
];
