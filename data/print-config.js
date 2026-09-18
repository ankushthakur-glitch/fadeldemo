/**
 * DEMO DATA for Practice Settings → Print Configuration.
 * Entirely invented — no real practice information.
 *
 * A print configuration is the letterhead that goes on top of anything the
 * practice prints: prescriptions, referrals, clinical notes, invoices,
 * patient summaries. Exactly one is the default, which is the one used when
 * nobody chooses.
 *
 * WHY PRACTICE FIELDS ARE A LIST OF TOGGLES RATHER THAN FREE TEXT
 * The practice's NPI, tax ID and address already exist in Practice Profile.
 * Retyping them into a letterhead is how a clinic ends up printing an address
 * it moved out of two years ago. A configuration stores WHICH facts to show;
 * the values come from the profile.
 */

/** Pulled from Practice Profile — the letterhead never stores its own copy. */
export const PRACTICE_FIELDS = [
  { id: 'name', label: 'Practice Name', value: 'MediNova Gastroenterology Clinic' },
  { id: 'address', label: 'Address', value: '8642 Yule Street, Arvada, CO 80007' },
  { id: 'phone', label: 'Phone', value: '303-555-0110' },
  { id: 'fax', label: 'Fax', value: '303-555-0111' },
  { id: 'email', label: 'Email', value: 'records@medinovagi.example.com' },
  { id: 'website', label: 'Website', value: 'medinovagi.example.com' },
  { id: 'npi', label: 'NPI', value: '1962748503' },
  { id: 'taxId', label: 'Tax ID', value: '84-3920184' },
  { id: 'license', label: 'License Number', value: 'CO-GI-40218' },
  { id: 'provider', label: 'Provider Name', value: 'Dr. Amara Mensah, MD FACG' },
  { id: 'clia', label: 'CLIA Number', value: '34D2109887' },
  { id: 'ccn', label: 'CCN', value: '351302' },
  { id: 'placeOfService', label: 'Place of Service', value: 'Office (11)' },
  { id: 'billingAddress', label: 'Billing Address', value: '2678 East 875th Road, Oglesby, ND 61348' },
  { id: 'contact', label: 'Contact Person', value: 'Amara Mensah' },
  { id: 'specialty', label: 'Specialty', value: 'Gastroenterology' },
];

export const PRACTICE_FIELD_INDEX = Object.fromEntries(
  PRACTICE_FIELDS.map((f) => [f.id, f])
);

/** How the logo and the text sit relative to each other. */
export const LAYOUT_MODES = [
  { id: 'logo-text', label: 'Logo + Text' },
  { id: 'logo-only', label: 'Logo Only' },
  { id: 'text-only', label: 'Text Only' },
];

export const ALIGNMENTS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

/** Optional lines under the page. */
export const FOOTER_OPTIONS = [
  {
    id: 'disclaimer',
    label: 'Practice disclaimer',
    text: 'This document is part of the patient’s legal medical record.',
  },
  {
    id: 'hipaa',
    label: 'HIPAA statement',
    text:
      'Confidential — protected health information. Disclosure is restricted under HIPAA (45 CFR Parts 160 and 164).',
  },
  { id: 'website', label: 'Website', text: 'medinovagi.example.com' },
  { id: 'confidential', label: 'Confidential footer', text: 'CONFIDENTIAL' },
  { id: 'signature', label: 'Electronic signature line', text: 'Electronically signed by ______________________' },
  { id: 'page-number', label: 'Page number', text: 'Page 1 of 1' },
  { id: 'appointment-line', label: 'Appointment line', text: 'To change an appointment call 701-555-0144.' },
  { id: 'billing-line', label: 'Billing enquiries', text: 'Billing enquiries: 303-555-0112 · accounts@medinovagi.example.com' },
  { id: 'portal', label: 'Patient portal', text: 'View this document in the patient portal at medinovagi.example.com/portal' },
  { id: 'interpreter', label: 'Interpreter notice', text: 'Interpreter services are available free of charge.' },
  { id: 'nondiscrimination', label: 'Non-discrimination notice', text: 'MediNova Gastroenterology complies with applicable federal civil rights laws.' },
];

export const PAPER_SIZES = ['Letter (8.5 × 11 in)', 'A4 (210 × 297 mm)'];
export const ORIENTATIONS = ['Portrait', 'Landscape'];
export const MARGIN_PRESETS = ['Narrow (0.5 in)', 'Normal (0.75 in)', 'Wide (1 in)'];

/** The sample documents the preview can be checked against. */
export const PREVIEW_DOCUMENTS = [
  {
    id: 'prescription',
    label: 'Prescription',
    body: [
      ['Patient', 'Henna West · MRN 326486 · DOB 20 Feb 1961'],
      ['Prescribed', 'Mesalamine 800 mg — 1 tablet orally three times daily'],
      ['Quantity', '90 tablets · 2 refills'],
      ['Prescriber', 'Dr. Amara Mensah, MD FACG'],
    ],
  },
  {
    id: 'referral',
    label: 'Referral',
    body: [
      ['Patient', 'Henna West · MRN 326486'],
      ['Referred to', 'Dr. Kwame Osei — Endocrinology'],
      ['Reason', 'Poorly controlled type 2 diabetes complicating GI management'],
      ['Urgency', 'Routine — within 4 weeks'],
    ],
  },
  {
    id: 'clinical-note',
    label: 'Clinical Note',
    body: [
      ['Encounter', 'Surveillance colonoscopy · 23 Oct 2025'],
      ['Assessment', 'Two sessile polyps removed from sigmoid colon; histology pending.'],
      ['Plan', 'Repeat surveillance in 3 years. Continue current therapy.'],
      ['Signed', 'Dr. Amara Mensah, MD FACG'],
    ],
  },
  {
    id: 'invoice',
    label: 'Invoice',
    body: [
      ['Invoice', 'INV-2026-00418 · Issued 06 Aug 2026'],
      ['Patient', 'Henna West · MRN 326486'],
      ['Services', 'Colonoscopy with polypectomy (45385) — $1,240.00'],
      ['Balance due', '$124.00'],
    ],
  },
  {
    id: 'patient-summary',
    label: 'Patient Summary',
    body: [
      ['Patient', 'Henna West · 65 · Female'],
      ['Allergies', 'Penicillin — anaphylaxis'],
      ['Active problems', "Crohn's disease; Type 2 diabetes"],
      ['Next appointment', '17 May 2026 · Post-polypectomy review'],
    ],
  },
];

export const LOGO_FORMATS = '.png,.svg,.jpg,.jpeg';
export const LOGO_MAX_BYTES = 3 * 1024 * 1024;

/** The practice logo already in the prototype — used by the seeded headers. */
const MEDINOVA_LOGO = '../assets/img/medinova-logo.svg';

/* ============================================================================
   THE REST OF THE LETTERHEADS.

   Three are written out above because each shows a different SHAPE — logo and
   text left, everything centred, text only. Those three are the layouts the
   editor can produce, and they are worth reading.

   A practice does not stop at three, though. Every document type that leaves
   the building wants its own header, every site wants its address on it, and
   every retired version stays on the list because a reprint of last year's
   letter has to come out looking like last year's letter. That is what the
   table below is: one line per letterhead, expanded into the same record the
   three above are written as.
   ========================================================================= */

/** [name, description, layout, logoAlign, textAlign, fields, footer, margins, active] */
const HEADER_SPECS = [
  ['Clinical Note Header', 'Used on progress and procedure notes.', 'logo-text', 'left', 'left', ['phone', 'npi'], ['hipaa', 'page-number']],
  ['Procedure Report Header', 'Endoscopy reports leaving the ASC.', 'logo-text', 'left', 'left', ['address', 'phone', 'ccn'], ['hipaa', 'signature', 'page-number']],
  ['Pathology Request Header', 'Accompanies specimens to the laboratory.', 'logo-text', 'left', 'left', ['address', 'phone', 'clia'], ['confidential', 'page-number']],
  ['Prescription Header', 'Printed prescriptions and refill authorisations.', 'logo-text', 'left', 'left', ['address', 'phone', 'fax', 'npi'], ['signature']],
  ['Controlled Prescription Header', 'Schedule II prescriptions — security wording added.', 'logo-text', 'left', 'left', ['address', 'phone', 'npi', 'license'], ['signature', 'confidential']],
  ['Discharge Instructions Header', 'Handed to the patient in recovery.', 'logo-text', 'center', 'center', ['phone', 'website'], ['appointment-line', 'portal']],
  ['Bowel Prep Instructions Header', 'Sent with the appointment confirmation.', 'logo-text', 'center', 'center', ['phone', 'website'], ['appointment-line', 'interpreter']],
  ['Patient Summary Header', 'After-visit summary given at check-out.', 'logo-text', 'left', 'left', ['address', 'phone', 'website'], ['portal', 'page-number']],
  ['Appointment Letter Header', 'Posted appointment confirmations.', 'logo-text', 'left', 'left', ['address', 'phone'], ['appointment-line', 'interpreter']],
  ['Recall Letter Header', 'Surveillance recall letters.', 'logo-text', 'left', 'left', ['address', 'phone', 'website'], ['appointment-line', 'portal']],
  ['Consent Form Header', 'Procedure consent forms.', 'logo-text', 'center', 'center', ['name', 'address'], ['signature', 'page-number']],
  ['Referral Letter Header — Clinic', 'Outbound referrals from the clinic entity.', 'logo-text', 'left', 'left', ['address', 'phone', 'fax', 'npi'], ['disclaimer', 'website']],
  ['Referral Letter Header — ASC', 'Outbound correspondence from the ASC.', 'logo-text', 'left', 'left', ['address', 'phone', 'ccn'], ['disclaimer', 'website']],
  ['Referral Reply Header', 'Replies to referring clinicians.', 'logo-text', 'left', 'left', ['phone', 'fax'], ['disclaimer', 'page-number']],
  ['Lab Result Letter Header', 'Result letters posted to patients.', 'logo-text', 'left', 'left', ['phone', 'website'], ['portal', 'interpreter']],
  ['Imaging Request Header', 'Requests sent to imaging providers.', 'logo-text', 'left', 'left', ['address', 'phone', 'fax', 'npi'], ['confidential']],
  ['Prior Authorisation Header', 'Authorisation requests to payers.', 'text-only', 'left', 'left', ['address', 'phone', 'fax', 'taxId', 'npi'], ['confidential', 'page-number']],
  ['Appeal Letter Header', 'Claim appeals and reconsideration letters.', 'text-only', 'left', 'left', ['address', 'phone', 'taxId', 'npi'], ['confidential', 'page-number']],
  ['Statement Header — Clinic', 'Patient statements, professional charges.', 'text-only', 'left', 'left', ['address', 'taxId'], ['billing-line', 'page-number']],
  ['Statement Header — ASC', 'Patient statements, facility charges.', 'text-only', 'left', 'left', ['billingAddress', 'taxId', 'ccn'], ['billing-line', 'page-number']],
  ['Final Notice Header', 'Balances past 90 days.', 'text-only', 'left', 'left', ['billingAddress', 'phone'], ['billing-line']],
  ['Payment Plan Header', 'Payment plan agreements.', 'text-only', 'left', 'left', ['billingAddress', 'phone', 'taxId'], ['signature', 'billing-line']],
  ['Good Faith Estimate Header', 'Self-pay estimates.', 'logo-text', 'left', 'left', ['address', 'phone', 'taxId'], ['disclaimer', 'page-number']],
  ['Receipt Header', 'Point of service receipts.', 'text-only', 'left', 'left', ['name', 'phone'], []],
  ['Superbill Header', 'Superbills handed to self-pay patients.', 'text-only', 'left', 'left', ['address', 'taxId', 'npi', 'placeOfService'], ['page-number']],
  ['Records Release Header', 'Release of information cover sheets.', 'logo-text', 'left', 'left', ['address', 'phone', 'fax'], ['hipaa', 'signature']],
  ['Records Cover Sheet — Fax', 'Fax cover sheet for record transfers.', 'text-only', 'left', 'left', ['name', 'phone', 'fax'], ['hipaa', 'confidential']],
  ['Subpoena Response Header', 'Legal record responses.', 'text-only', 'left', 'left', ['address', 'phone', 'taxId'], ['hipaa', 'confidential', 'page-number']],
  ['Research Consent Header', 'Study documentation.', 'logo-text', 'center', 'center', ['name', 'address'], ['signature', 'page-number']],
  ['Clinical Trial Letter Header', 'Correspondence with study sponsors.', 'logo-text', 'left', 'left', ['address', 'phone', 'contact'], ['confidential']],
  ['Infusion Consent Header', 'Biologic and iron infusion consent.', 'logo-text', 'center', 'center', ['name', 'phone'], ['signature']],
  ['Nutrition Plan Header', 'Dietitian plans and handouts.', 'logo-text', 'left', 'left', ['phone', 'website'], ['portal']],
  ['Behavioural Health Header', 'Behavioural health documentation.', 'logo-text', 'left', 'left', ['phone'], ['hipaa', 'confidential']],
  ['Genetics Report Header', 'Genetic risk assessments.', 'logo-text', 'left', 'left', ['address', 'phone', 'specialty'], ['hipaa', 'page-number']],
  ['Outreach Clinic Header — Grand Forks', 'Letterhead for the Grand Forks outreach clinic.', 'logo-text', 'left', 'left', ['phone', 'website'], ['appointment-line']],
  ['Outreach Clinic Header — Bismarck', 'Letterhead for the Bismarck consulting rooms.', 'logo-text', 'left', 'left', ['phone', 'website'], ['appointment-line']],
  ['Outreach Clinic Header — Moorhead', 'Letterhead for the Moorhead clinic.', 'logo-text', 'left', 'left', ['phone', 'website'], ['appointment-line']],
  ['Outreach Clinic Header — Minot', 'Letterhead for the Minot outreach clinic.', 'logo-text', 'left', 'left', ['phone', 'website'], ['appointment-line']],
  ['Telehealth Visit Header', 'Documents from telehealth visits.', 'logo-text', 'left', 'left', ['phone', 'website'], ['portal', 'interpreter']],
  ['Employer Letter Header', 'Fitness to work and absence letters.', 'logo-text', 'left', 'left', ['address', 'phone'], ['signature', 'confidential']],
  ['School Letter Header', 'Letters for schools and universities.', 'logo-text', 'left', 'left', ['address', 'phone'], ['signature']],
  ['Travel Letter Header', 'Medication and equipment travel letters.', 'logo-text', 'left', 'left', ['address', 'phone', 'npi'], ['signature']],
  ['Complaint Response Header', 'Responses to patient complaints.', 'logo-text', 'left', 'left', ['address', 'phone', 'contact'], ['confidential', 'nondiscrimination']],
  ['Patient Rights Notice Header', 'Notice of privacy practices and rights.', 'logo-text', 'center', 'center', ['name', 'address', 'phone'], ['hipaa', 'nondiscrimination', 'page-number']],
  ['Quality Report Header', 'Internal quality and outcomes packs.', 'text-only', 'left', 'left', ['name', 'specialty'], ['confidential', 'page-number']],
  ['Board Pack Header', 'Papers for the practice board.', 'text-only', 'left', 'left', ['name'], ['confidential', 'page-number']],
  ['Credentialling Pack Header', 'Provider enrolment and credentialling packs.', 'text-only', 'left', 'left', ['address', 'taxId', 'npi', 'license'], ['confidential', 'page-number']],
  ['Supplier Letter Header', 'Purchasing and supplier correspondence.', 'logo-text', 'left', 'left', ['billingAddress', 'phone', 'taxId'], ['website']],
  ['Logo Only Header', 'Continuation sheets — logo without the address block.', 'logo-only', 'left', 'left', [], ['page-number']],
  ['Plain Continuation Header', 'Continuation sheets with no logo at all.', 'text-only', 'left', 'left', ['name'], ['page-number']],
];

/** Expand one line of HEADER_SPECS into the record the editor reads. */
function seededHeaders() {
  // Fixed stamps, cycled — a created-on date computed from today would move
  // every time the page is opened.
  const stamps = [
    ['08-01-2026', 'Amara Mensah', '19-05-2026'],
    ['22-02-2026', 'Ruth Adeyemi', '14-06-2026'],
    ['11-03-2026', 'Sam Okoro', '02-07-2026'],
    ['27-04-2026', 'Lucas Thomas', '21-07-2026'],
    ['15-11-2025', 'Amara Mensah', '30-03-2026'],
  ];

  return HEADER_SPECS.map(([name, description, layout, logoAlign, textAlign, fields, footer], index) => {
    const [createdOn, createdBy, updatedOn] = stamps[index % stamps.length];
    return {
      id: `cfg-${index + 4}`,
      name,
      description,
      isDefault: false,
      layout,
      logoAlign,
      textAlign,
      logo: layout === 'text-only' ? null : MEDINOVA_LOGO,
      logoName: layout === 'text-only' ? null : 'medinova-logo.svg',
      headerHtml:
        layout === 'logo-only'
          ? ''
          : `<div><strong>MediNova Gastroenterology Clinic</strong></div><div>${name}</div>`,
      fields,
      footer,
      paper: PAPER_SIZES[index % 7 === 6 ? 1 : 0],
      orientation: index % 11 === 10 ? 'Landscape' : 'Portrait',
      margins: MARGIN_PRESETS[index % 3],
      headerHeight: layout === 'text-only' ? '1.0 in' : '1.4 in',
      footerHeight: footer.length > 1 ? '0.8 in' : '0.5 in',
      createdOn,
      createdBy,
      updatedOn,
      versions: [
        { on: updatedOn, by: createdBy, note: 'Wording and field selection reviewed.' },
        { on: createdOn, by: createdBy, note: 'Created.' },
      ],
    };
  });
}

export const PRINT_CONFIGS = [
  {
    id: 'cfg-1',
    name: 'MediNova Practice Header',
    description: 'Standard letterhead for clinical documents.',
    isDefault: true,
    layout: 'logo-text',
    logoAlign: 'left',
    textAlign: 'left',
    logo: MEDINOVA_LOGO,
    logoName: 'medinova-logo.svg',
    headerHtml:
      '<div><strong>MediNova Gastroenterology Clinic</strong></div><div>8642 Yule Street, Arvada, CO 80007</div>',
    fields: ['phone', 'fax', 'npi'],
    footer: ['hipaa', 'page-number'],
    paper: PAPER_SIZES[0],
    orientation: 'Portrait',
    margins: MARGIN_PRESETS[1],
    headerHeight: '1.4 in',
    footerHeight: '0.6 in',
    createdOn: '12-03-2026',
    createdBy: 'Amara Mensah',
    updatedOn: '02-07-2026',
    versions: [
      { on: '02-07-2026', by: 'Amara Mensah', note: 'Added fax number and HIPAA footer.' },
      { on: '12-03-2026', by: 'Amara Mensah', note: 'Created.' },
    ],
  },
  {
    id: 'cfg-2',
    name: 'Centered Referral Header',
    description: 'Centred layout used on outbound referrals and letters.',
    isDefault: false,
    layout: 'logo-text',
    logoAlign: 'center',
    textAlign: 'center',
    logo: MEDINOVA_LOGO,
    logoName: 'medinova-logo.svg',
    headerHtml:
      '<div><strong>MediNova Gastroenterology Clinic</strong></div><div><em>Referral and Consultation Services</em></div>',
    fields: ['address', 'phone', 'website'],
    footer: ['disclaimer', 'website'],
    paper: PAPER_SIZES[0],
    orientation: 'Portrait',
    margins: MARGIN_PRESETS[1],
    headerHeight: '1.8 in',
    footerHeight: '0.6 in',
    createdOn: '04-05-2026',
    createdBy: 'Ruth Adeyemi',
    updatedOn: '04-05-2026',
    versions: [{ on: '04-05-2026', by: 'Ruth Adeyemi', note: 'Created.' }],
  },
  {
    id: 'cfg-3',
    name: 'Billing Statement Header',
    description: 'Text-only header for statements and invoices.',
    isDefault: false,
    layout: 'text-only',
    logoAlign: 'left',
    textAlign: 'left',
    logo: null,
    logoName: null,
    headerHtml:
      '<div><strong>MediNova Gastroenterology Clinic — Patient Accounts</strong></div><div>Questions about this statement? Call 303-555-0112.</div>',
    fields: ['address', 'taxId'],
    footer: ['confidential', 'page-number'],
    paper: PAPER_SIZES[0],
    orientation: 'Portrait',
    margins: MARGIN_PRESETS[0],
    headerHeight: '1.0 in',
    footerHeight: '0.5 in',
    createdOn: '19-06-2026',
    createdBy: 'Sam Okoro',
    updatedOn: '28-06-2026',
    versions: [
      { on: '28-06-2026', by: 'Sam Okoro', note: 'Switched to text-only after logo printed grey on the statement stock.' },
      { on: '19-06-2026', by: 'Sam Okoro', note: 'Created.' },
    ],
  },
  ...seededHeaders(),
];

/** A brand-new configuration, before the administrator has typed anything. */
export function blankConfig() {
  return {
    id: null,
    name: '',
    description: '',
    isDefault: false,
    layout: 'logo-text',
    logoAlign: 'left',
    textAlign: 'left',
    logo: null,
    logoName: null,
    headerHtml: '',
    fields: ['address', 'phone'],
    footer: [],
    paper: PAPER_SIZES[0],
    orientation: 'Portrait',
    margins: MARGIN_PRESETS[1],
    headerHeight: '1.4 in',
    footerHeight: '0.6 in',
    createdOn: null,
    createdBy: null,
    updatedOn: null,
    versions: [],
  };
}

export const MAX_HEADER_LINES = 6;
