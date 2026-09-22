/**
 * DEMO DATA — Settings ▸ Provider.
 *
 * The signed-in provider's own settings, as opposed to the practice's. Three
 * data sets live here; the fourth (the practice this provider works at) is not
 * duplicated — the Practice tab reads the LOCATION records in practice.js,
 * because a provider's practice IS one of the locations the practice
 * administrator already set up.
 *
 * THE PROVIDER RECORD
 * PROVIDER below is shaped exactly like a saved submission of the provider
 * onboarding form (Practice ▸ Users ▸ Add Provider): the single-value fields
 * of PROVIDER_FIELDS, plus one row list per PROVIDER_GROUPS entry. Both of
 * those definitions live in data/practice.js and are shared, so a field added
 * to onboarding shows up here without a second edit.
 *
 * Amara Mensah is the account the prototype signs in as — see lib/auth-store.js
 * — so these are her settings, not a generic provider's.
 *
 * Every name, number, NPI, DEA and address is invented. No real records.
 */

/* --- The signed-in provider -------------------------------------------------- */

export const PROVIDER = {
  id: 'prov-amara',

  /* Which of the scheduler's providers this account IS.
   *
   * data/schedule.js keeps its own PROVIDERS list — pr1..pr6 — because a
   * calendar column is a bookable diary and not a user account, and the two
   * lists were written by different parts of the prototype. Nothing joined
   * them, so "my schedule" had no answer: every booking belonged to somebody
   * who was not the person signed in.
   *
   * pr3 rather than any of the others because it is the only diary that runs
   * at BOTH sites — a Fargo clinic and a Red River ASC list in the same
   * fortnight — which is the working pattern the notes field below describes
   * and the only one that leaves the clinic/ASC switch with anything to
   * switch between. Pointing this at a single-site diary would have made one
   * of the two tabs permanently empty for my own day.
   */
  scheduleId: 'pr3',

  // Single-value fields — keys match PROVIDER_FIELDS in practice.js.
  prefix: 'Dr.',
  firstName: 'Amara',
  middleName: 'Kwarteng',
  lastName: 'Mensah',
  suffix: 'MD',
  /* A CREDENTIAL, because that is what PROVIDER_TITLES holds — the list the
     Edit Provider Profile select is built from. A job description here
     ('Consultant Gastroenterologist') is not in that list, so the select
     fell back to its first option and one Save would have silently
     rewritten this provider's title to APRN. */
  title: 'MD',
  dob: '1982-04-17',
  gender: 'Female',
  type: 'Provider',
  specialty: 'Gastroenterology',
  status: 'Active',

  notes:
    'Endoscopy lists Tuesday and Thursday at the ASC. IBD clinic Monday afternoons. Covers the infusion suite on alternate Fridays.',
  certified: true,
  signature: 'a-mensah-signature.png',

  /* The repeatable groups, one array per PROVIDER_GROUPS entry. A provider
     with two working locations and three identifiers is the ordinary case,
     which is the whole reason these are lists. */
  groups: {
    addresses: [
      { type: 'Work', value: '5049 33rd Ave S, Fargo, North Dakota 58104-7080' },
      { type: 'Mailing', value: 'PO Box 2214, Fargo, North Dakota 58108' },
    ],
    phones: [
      { type: 'Office', value: '(701) 555-0166' },
      { type: 'Mobile', value: '(701) 555-0177' },
      { type: 'Pager', value: '(701) 555-0902' },
    ],
    emails: [
      { type: 'Work', value: 'amara.mensah@medinovagi.example' },
      { type: 'Personal', value: 'a.mensah@example.com' },
    ],
    // Values match LOCATIONS[].name in practice.js — the Practice tab looks
    // the full location record up by this name.
    locations: [
      { type: '', value: 'GastroEMR Gastroenterology ASC' },
      { type: '', value: 'GastroEMR Gastroenterology LTD — Fargo' },
    ],
    // EVERY number this clinician is known by, NPI and DEA included. They
    // used to be two single-value fields on the record above; they came off it
    // when PROVIDER_FIELDS dropped them, because a locum carries more than one
    // NPI and a fixed pair of boxes has nowhere to put the second. Kept first
    // in the list so the two most-asked-for numbers still read first.
    identifications: [
      { type: 'NPI', value: '1487203965' },
      { type: 'DEA', value: 'BM4471903' },
      { type: 'Lic#.', value: 'ND-MD-14472' },
      { type: 'UPIN', value: 'C88214' },
      { type: 'MCD', value: 'ND-MCD-770412' },
    ],
    /* TWO LICENCES, because this provider works both sides of the river — the
       Fargo clinic sits a mile from the Minnesota line and a referral from
       Moorhead is an ordinary Tuesday. Each carries its own taxonomy, its own
       number and its own dates, which is the case a single Lic#. row in the
       list above could not hold: one of these renews eighteen months before
       the other. */
    licenses: [
      {
        type: '',
        taxonomy: '207RG0100X',
        value: 'ND-MD-14472',
        start: '2021-07-01',
        end: '2027-06-30',
      },
      {
        type: '',
        taxonomy: '207RG0100X',
        value: 'MN-58-119043',
        start: '2023-01-15',
        end: '2026-01-14',
      },
    ],
  },
};

/* --- Notification preferences -------------------------------------------------
   What this provider is told about, and down which channel. Grouped by the
   thing the event happens TO, because that is how someone decides: "stop
   telling me about invoices" is one decision, not four.

   The values below are also the DEFAULTS — the Default button restores exactly
   this, so the seed is the reset target rather than a second copy of it.
   -------------------------------------------------------------------------- */

export const NOTIFICATION_GROUPS = [
  {
    id: 'form',
    title: 'Form',
    rows: [
      { id: 'form-submitted', title: 'Patient submits a form', push: true, text: true, email: false },
      { id: 'form-overdue', title: 'Form is still outstanding the day before the visit', push: false, text: true, email: true },
      { id: 'form-declined', title: 'Patient declines a form', push: false, text: false, email: true },
      { id: 'form-signed', title: 'Consent form is signed', push: true, text: false, email: false },
    ],
  },
  {
    id: 'note',
    title: 'Note',
    rows: [
      { id: 'note-assigned', title: 'Patient note assigned to me', push: true, text: true, email: false },
      { id: 'note-missing', title: 'Appointment has missing note', push: false, text: true, email: false },
      { id: 'note-cosign', title: 'Note is waiting on my co-signature', push: true, text: true, email: true },
      { id: 'note-addendum', title: 'Addendum added to a note I signed', push: false, text: false, email: true },
      { id: 'note-unsigned-72h', title: 'Note unsigned after 72 hours', push: true, text: false, email: true },
    ],
  },
  {
    id: 'appointment',
    title: 'Appointment',
    rows: [
      { id: 'appt-booked', title: 'Appointment booked into my diary', push: true, text: false, email: false },
      { id: 'appt-cancelled', title: 'Appointment cancelled inside 24 hours', push: true, text: true, email: false },
      { id: 'appt-rescheduled', title: 'Appointment rescheduled', push: false, text: true, email: false },
      { id: 'appt-noshow', title: 'Patient does not attend', push: true, text: false, email: false },
      { id: 'appt-waitlist', title: 'Wait list patient can be brought forward', push: false, text: true, email: false },
      { id: 'appt-doublebooked', title: 'A slot has been double booked', push: true, text: true, email: true },
    ],
  },
  {
    id: 'patient',
    title: 'Patient',
    rows: [
      { id: 'patient-message', title: 'Patient sends a portal message', push: true, text: true, email: false },
      { id: 'patient-registered', title: 'New patient completes registration', push: false, text: false, email: true },
      { id: 'patient-flag', title: 'A flag is added to one of my patients', push: false, text: true, email: false },
      { id: 'patient-admitted', title: 'One of my patients is admitted to hospital', push: true, text: true, email: true },
      { id: 'patient-deceased', title: 'A patient record is marked deceased', push: false, text: false, email: true },
    ],
  },
  {
    id: 'results',
    title: 'Labs and results',
    rows: [
      { id: 'lab-result', title: 'Lab result returned', push: true, text: false, email: false },
      { id: 'lab-abnormal', title: 'Abnormal result returned', push: true, text: true, email: true },
      { id: 'lab-critical', title: 'Critical result returned', push: true, text: true, email: true },
      { id: 'lab-overdue', title: 'Ordered lab still outstanding after 14 days', push: false, text: true, email: false },
      { id: 'path-report', title: 'Pathology report filed against my procedure', push: true, text: true, email: false },
      { id: 'imaging-report', title: 'Imaging report returned', push: false, text: true, email: false },
    ],
  },
  {
    id: 'order',
    title: 'Orders and prescriptions',
    rows: [
      { id: 'order-signature', title: 'Order waiting on my signature', push: true, text: true, email: false },
      { id: 'rx-refill', title: 'Refill request received', push: true, text: true, email: false },
      { id: 'rx-rejected', title: 'Prescription rejected by the pharmacy', push: true, text: true, email: true },
      { id: 'rx-controlled', title: 'Controlled substance prescription needs a second factor', push: true, text: false, email: false },
      { id: 'order-cancelled', title: 'Order cancelled before it was actioned', push: false, text: false, email: true },
    ],
  },
  {
    id: 'referral',
    title: 'Referral',
    rows: [
      { id: 'referral-in', title: 'Referral received and assigned to me', push: true, text: true, email: false },
      { id: 'referral-accepted', title: 'Outgoing referral accepted', push: false, text: true, email: false },
      { id: 'referral-declined', title: 'Outgoing referral declined', push: true, text: true, email: true },
      { id: 'referral-stale', title: 'Referral untouched for 7 days', push: false, text: false, email: true },
    ],
  },
  {
    id: 'task',
    title: 'Task',
    rows: [
      { id: 'task-assigned', title: 'Task assigned to me', push: true, text: true, email: false },
      { id: 'task-due', title: 'Task falls due today', push: true, text: false, email: false },
      { id: 'task-overdue', title: 'Task is overdue', push: true, text: true, email: true },
      { id: 'task-commented', title: 'Someone comments on my task', push: false, text: false, email: true },
    ],
  },
  {
    id: 'invoice',
    title: 'Invoice',
    rows: [
      { id: 'invoice-paid', title: 'Invoice is paid', push: true, text: true, email: false },
      { id: 'invoice-autocharge', title: 'Auto charge payment fails', push: false, text: true, email: false },
      { id: 'invoice-nocard', title: 'Patient has no card on file', push: false, text: false, email: false },
      { id: 'invoice-refund', title: 'Refund issued against one of my invoices', push: false, text: false, email: true },
      { id: 'invoice-overdue', title: 'Patient balance passes 90 days', push: false, text: true, email: true },
    ],
  },
  {
    id: 'claim',
    title: 'Claim',
    rows: [
      { id: 'claim-era', title: 'ERA report is processed', push: true, text: true, email: false },
      {
        id: 'claim-auth',
        title: 'Prior authorization number is about to expire',
        push: false,
        text: true,
        email: false,
      },
      {
        id: 'claim-era-invoice',
        title: 'Invoice has been created or updated because ERA',
        push: false,
        text: false,
        email: false,
      },
      { id: 'claim-denied', title: 'Claim denied by the payer', push: true, text: true, email: true },
      { id: 'claim-coding', title: 'Claim returned to me for a coding query', push: true, text: true, email: false },
      { id: 'claim-eligibility', title: 'Eligibility check fails before a booked visit', push: false, text: true, email: true },
    ],
  },
  {
    id: 'procedure',
    title: 'Procedure and ASC',
    rows: [
      { id: 'proc-list-published', title: 'My procedure list is published', push: true, text: false, email: true },
      { id: 'proc-list-changed', title: 'A case is added to or removed from my list', push: true, text: true, email: false },
      { id: 'proc-complication', title: 'Complication recorded on one of my cases', push: true, text: true, email: true },
      { id: 'proc-scope-quarantined', title: 'A scope I used is quarantined by reprocessing', push: true, text: true, email: true },
      { id: 'proc-recall-due', title: 'A recall I set falls due', push: false, text: true, email: false },
    ],
  },
  {
    id: 'account',
    title: 'Account and security',
    rows: [
      { id: 'sec-signin', title: 'Sign-in from a device I have not used before', push: true, text: true, email: true },
      { id: 'sec-password', title: 'My password is changed', push: false, text: true, email: true },
      { id: 'sec-permissions', title: 'My permissions are changed', push: false, text: false, email: true },
      { id: 'sec-delegate', title: 'Someone is given delegate access to my inbox', push: true, text: false, email: true },
      { id: 'sec-maintenance', title: 'Planned maintenance affecting the EHR', push: false, text: false, email: true },
    ],
  },
];

/** The three channels, in the order the table columns run. */
export const NOTIFICATION_CHANNELS = [
  { key: 'push', label: 'Push' },
  { key: 'text', label: 'Text' },
  { key: 'email', label: 'Email' },
];

/* --- Patient flags ------------------------------------------------------------
   The chips a chart can be marked with. The colour is the point: a flag is
   read at a glance from a worklist, so it has to be distinguishable without
   the label being read.
   -------------------------------------------------------------------------- */

export const FLAG_COLOURS = [
  '#c9a227', '#7b1fa2', '#00796b', '#00bcd4', '#0d3b66',
  '#b3261e', '#e07b39', '#3f51b5', '#6e655e',
  '#a3160e', '#8f5ab5', '#e07ce8', '#f48fb1', '#6fd3f7',
  '#00acc4', '#1d4b76', '#00897b', '#4f61c5', '#5f71d5',
  '#c8473b', '#d8574b', '#e8675b', '#7e756e', '#8f6b3a',
  '#9f7b4a', '#af8b5a', '#7a3b8f', '#6a2b7f', '#5a1b6f',
  '#4a0b5f', '#e65100', '#f57c00', '#ff9800', '#c0a36e',
  '#e69ff5', '#4e342e', '#5d4037', '#6d4c41', '#8e8e8e',
  '#9e9e9e', '#827717', '#880e4f', '#ad1457', '#616161',
];

export const PATIENT_FLAGS = [
  { id: 'pf1', name: 'Diabetic', colour: '#c9a227', updated: '20/05/2025', created: '17/05/2025' },
  { id: 'pf2', name: 'Chronically late', colour: '#7b1fa2', updated: '28/06/2025', created: '10/05/2025' },
  { id: 'pf3', name: 'Needs Assistance', colour: '#00796b', updated: '28/06/2025', created: '10/05/2025' },
  { id: 'pf4', name: 'Spanish Speaking', colour: '#00bcd4', updated: '28/06/2025', created: '10/05/2025' },
  { id: 'pf5', name: 'Allergic to Latex', colour: '#0d3b66', updated: '28/06/2025', created: '10/05/2025' },
  { id: 'pf6', name: 'Anticoagulated', colour: '#b3261e', updated: '14/07/2025', created: '02/06/2025' },
  { id: 'pf7', name: 'Difficult Airway', colour: '#a3160e', updated: '14/07/2025', created: '02/06/2025' },
  { id: 'pf8', name: 'Sedation Risk — ASA III+', colour: '#e07b39', updated: '21/07/2025', created: '02/06/2025' },
  { id: 'pf9', name: 'Prior Incomplete Colonoscopy', colour: '#c9a227', updated: '21/07/2025', created: '02/06/2025' },
  { id: 'pf10', name: 'Poor Bowel Prep History', colour: '#8f6b3a', updated: '28/07/2025', created: '11/06/2025' },
  { id: 'pf11', name: 'Immunosuppressed', colour: '#7b1fa2', updated: '28/07/2025', created: '11/06/2025' },
  { id: 'pf12', name: 'Biologic Therapy', colour: '#8f5ab5', updated: '04/08/2025', created: '11/06/2025' },
  { id: 'pf13', name: 'Pregnancy — Confirmed', colour: '#e07ce8', updated: '04/08/2025', created: '11/06/2025' },
  { id: 'pf14', name: 'Breastfeeding', colour: '#f48fb1', updated: '11/08/2025', created: '20/06/2025' },
  { id: 'pf15', name: 'Pediatric Transition Patient', colour: '#6fd3f7', updated: '11/08/2025', created: '20/06/2025' },
  { id: 'pf16', name: 'Interpreter Required', colour: '#00bcd4', updated: '18/08/2025', created: '20/06/2025' },
  { id: 'pf17', name: 'Somali Speaking', colour: '#00acc4', updated: '18/08/2025', created: '20/06/2025' },
  { id: 'pf18', name: 'Hearing Impaired', colour: '#0d3b66', updated: '25/08/2025', created: '04/07/2025' },
  { id: 'pf19', name: 'Vision Impaired', colour: '#1d4b76', updated: '25/08/2025', created: '04/07/2025' },
  { id: 'pf20', name: 'Wheelchair Access Required', colour: '#00796b', updated: '01/09/2025', created: '04/07/2025' },
  { id: 'pf21', name: 'Transport Assistance', colour: '#00897b', updated: '01/09/2025', created: '04/07/2025' },
  { id: 'pf22', name: 'Caregiver Must Attend', colour: '#3f51b5', updated: '08/09/2025', created: '18/07/2025' },
  { id: 'pf23', name: 'Legal Guardian on File', colour: '#4f61c5', updated: '08/09/2025', created: '18/07/2025' },
  { id: 'pf24', name: 'Advance Directive on File', colour: '#5f71d5', updated: '15/09/2025', created: '18/07/2025' },
  { id: 'pf25', name: 'Do Not Resuscitate', colour: '#b3261e', updated: '15/09/2025', created: '18/07/2025' },
  { id: 'pf26', name: 'Allergic to Contrast', colour: '#c8473b', updated: '22/09/2025', created: '01/08/2025' },
  { id: 'pf27', name: 'Allergic to Penicillin', colour: '#d8574b', updated: '22/09/2025', created: '01/08/2025' },
  { id: 'pf28', name: 'Allergic to Propofol', colour: '#e8675b', updated: '29/09/2025', created: '01/08/2025' },
  { id: 'pf29', name: 'Latex-Free Room Required', colour: '#0d3b66', updated: '29/09/2025', created: '01/08/2025' },
  { id: 'pf30', name: 'MRSA Colonized', colour: '#6e655e', updated: '06/10/2025', created: '15/08/2025' },
  { id: 'pf31', name: 'C. difficile History', colour: '#7e756e', updated: '06/10/2025', created: '15/08/2025' },
  { id: 'pf32', name: 'Hepatitis B Carrier', colour: '#8f6b3a', updated: '13/10/2025', created: '15/08/2025' },
  { id: 'pf33', name: 'Hepatitis C — Treated', colour: '#9f7b4a', updated: '13/10/2025', created: '15/08/2025' },
  { id: 'pf34', name: 'Cirrhosis — Compensated', colour: '#af8b5a', updated: '20/10/2025', created: '29/08/2025' },
  { id: 'pf35', name: 'Transplant Recipient', colour: '#7a3b8f', updated: '20/10/2025', created: '29/08/2025' },
  { id: 'pf36', name: 'Lynch Syndrome', colour: '#6a2b7f', updated: '27/10/2025', created: '29/08/2025' },
  { id: 'pf37', name: 'FAP — Familial Polyposis', colour: '#5a1b6f', updated: '27/10/2025', created: '29/08/2025' },
  { id: 'pf38', name: 'Colorectal Cancer Survivor', colour: '#4a0b5f', updated: '03/11/2025', created: '12/09/2025' },
  { id: 'pf39', name: 'Active Oncology Treatment', colour: '#8f5ab5', updated: '03/11/2025', created: '12/09/2025' },
  { id: 'pf40', name: 'Opioid Therapy Agreement', colour: '#e65100', updated: '10/11/2025', created: '12/09/2025' },
  { id: 'pf41', name: 'Substance Use Support', colour: '#f57c00', updated: '10/11/2025', created: '12/09/2025' },
  { id: 'pf42', name: 'Alcohol Use Disorder', colour: '#ff9800', updated: '17/11/2025', created: '26/09/2025' },
  { id: 'pf43', name: 'Needle Phobia', colour: '#c0a36e', updated: '17/11/2025', created: '26/09/2025' },
  { id: 'pf44', name: 'Anxiety — Sedation Support', colour: '#e69ff5', updated: '24/11/2025', created: '26/09/2025' },
  { id: 'pf45', name: 'Safeguarding Concern', colour: '#b3261e', updated: '24/11/2025', created: '26/09/2025' },
  { id: 'pf46', name: 'Confidential Address', colour: '#4e342e', updated: '01/12/2025', created: '10/10/2025' },
  { id: 'pf47', name: 'Do Not Leave Voicemail', colour: '#5d4037', updated: '01/12/2025', created: '10/10/2025' },
  { id: 'pf48', name: 'Portal Access Restricted', colour: '#6d4c41', updated: '08/12/2025', created: '10/10/2025' },
  { id: 'pf49', name: 'Research Study Participant', colour: '#8e8e8e', updated: '08/12/2025', created: '10/10/2025' },
  { id: 'pf50', name: 'Self Pay — Estimate Required', colour: '#9e9e9e', updated: '15/12/2025', created: '24/10/2025' },
  { id: 'pf51', name: 'Payment Plan Active', colour: '#827717', updated: '15/12/2025', created: '24/10/2025' },
  { id: 'pf52', name: 'Balance Over 90 Days', colour: '#880e4f', updated: '05/01/2026', created: '24/10/2025' },
  { id: 'pf53', name: 'Collections Hold', colour: '#ad1457', updated: '05/01/2026', created: '24/10/2025' },
  { id: 'pf54', name: 'Chronically Cancels', colour: '#7b1fa2', updated: '19/01/2026', created: '07/11/2025' },
  { id: 'pf55', name: 'Repeat No Show', colour: '#616161', updated: '19/01/2026', created: '07/11/2025' },
  { id: 'pf56', name: 'VIP — Practice Contact', colour: '#c9a227', updated: '02/02/2026', created: '07/11/2025' },
];

/** Today, as the flag table writes dates. Fixed rather than computed so a
 *  screenshot taken today looks the same next month. */
export const FLAG_TODAY = '10/08/2026';
