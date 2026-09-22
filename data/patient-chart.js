/**
 * DEMO DATA for the patient chart shell.
 * Entirely invented — no real patient information.
 *
 * WHAT THIS FILE IS FOR
 * The chart is a frame: a sidebar, a header, and a workspace the modules drop
 * into. Everything the FRAME needs to draw itself lives here, and nothing the
 * modules need does. A module (Face Sheet, Visit Notes, Orders …) brings its
 * own data file, so adding one never edits this one.
 *
 * MRNs, names and dates line up with data/directory.js so the same person is
 * the same person whichever screen you arrive from.
 *
 * AGE IS NOT STORED. It is derived from the date of birth at render time —
 * a stored age is wrong the day after it is typed, and the directory already
 * carries a few that no longer match their DOB.
 */

/* ============================================================================
   FLAG VOCABULARY

   A flag is a standing fact that changes how you treat the person in front of
   you, so it rides in the header on every module. `tone` maps onto the status
   palette; `solid` is reserved for the two that must never be scanned past.

   `note` is what the flag actually asks of whoever reads it. The label alone
   is a category — "Fall Risk" names a class of patient without saying what
   anybody is meant to do differently — and the flag manager lists the note
   beside the chip so the person adding one is choosing a consequence rather
   than a colour. It is deliberately one clause: a flag that needs a paragraph
   is an alert note, and the chart has those too.
   ========================================================================= */
export const FLAG_TYPES = {
  diabetic: {
    label: 'Diabetic',
    tone: 'warning',
    icon: 'pill',
    note: 'Check glucose before sedation; confirm the morning insulin dose.',
  },
  allergy: {
    label: 'Allergy',
    tone: 'critical',
    icon: 'critical',
    solid: true,
    note: 'Read the allergy list before prescribing or opening a tray.',
  },
  fallRisk: {
    label: 'Fall Risk',
    tone: 'warning',
    icon: 'warning',
    note: 'Escort to and from the room; do not leave unattended on the trolley.',
  },
  highPriority: {
    label: 'High Priority',
    tone: 'critical',
    icon: 'warning',
    note: 'Bring forward on the worklist; do not roll to the next clinic.',
  },
  vip: {
    label: 'VIP',
    tone: 'brand',
    icon: 'shield',
    note: 'Route messages and results through the practice manager.',
  },
  dnr: {
    label: 'DNR',
    tone: 'critical',
    icon: 'shield',
    solid: true,
    note: 'Advance directive on file — confirm it before any procedure.',
  },
  assistance: {
    label: 'Special Assistance',
    tone: 'info',
    icon: 'users',
    note: 'Interpreter, mobility or caregiver support booked with the visit.',
  },
};

/* ============================================================================
   ALERT NOTES

   Four categories, because the four people who write them want different
   things noticed. Priority drives the colour of the rail down the left of the
   card; category drives the chip.
   ========================================================================= */
export const ALERT_CATEGORIES = {
  clinical: { label: 'Clinical', tone: 'critical' },
  administrative: { label: 'Administrative', tone: 'info' },
  scheduling: { label: 'Scheduling', tone: 'warning' },
  billing: { label: 'Billing', tone: 'neutral' },
};

export const ALERT_PRIORITIES = {
  high: { label: 'High', tone: 'critical' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
};

/* ============================================================================
   PORTAL STATES

   Three, not two. "Invited but never activated" is the state the front desk
   actually has to act on, and folding it into "not enrolled" loses the fact
   that an invitation is already out — which is how a patient ends up with
   three of them.
   ========================================================================= */
export const PORTAL_STATES = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invitation sent', tone: 'warning' },
  none: { label: 'Not enrolled', tone: 'neutral' },
  locked: { label: 'Locked', tone: 'critical' },
};

/* ============================================================================
   PATIENTS — keyed by MRN, which is what the URL carries.
   ========================================================================= */
export const PATIENTS = {
  326486: {
    mrn: '326486',
    name: 'Henna West',
    preferredName: 'Hennie',
    /* The one patient in this demo set with a photograph on file, so every
       screen with a photo slot can be seen in both of its states: this record
       filled, and every other record falling back to initials in the same
       disc. The file itself is a drawn portrait rather than a photograph of a
       real person — see the note in assets/img/patient-photo-01.svg. Relative
       to the page, the way every other asset path in data/ is (see
       MEDINOVA_LOGO in data/print-config.js). */
    photo: '../assets/img/patient-photo-01.svg',
    dob: '20-02-1961',
    gender: 'Female',
    language: 'English',
    phone: '202-555-0188',
    phoneType: 'Mobile',
    email: 'hennawest@example.com',
    address: '8642 Yule Street, Arvada CO 80007',
    status: 'active',
    balance: 124,
    // What the insurers still owe on the same account. The header states the
    // two side by side because "what do we chase, and from whom" is one
    // question — a single balance hides which half is the patient's problem.
    insuranceBalance: 386,
    quickNote: 'Prefers text reminders over calls.',

    flags: ['allergy', 'diabetic', 'fallRisk', 'vip', 'assistance'],

    alerts: [
      {
        id: 'al-1',
        category: 'clinical',
        priority: 'high',
        title: 'Anaphylaxis to penicillin',
        body: 'Airway involvement in 2019 — epinephrine given in ED. Cephalosporins have been tolerated since, but confirm with the patient before every order.',
        author: 'Dr. Amara Mensah',
        date: '12-06-2025',
      },
      {
        id: 'al-2',
        category: 'scheduling',
        priority: 'medium',
        title: 'Afternoon appointments only',
        body: 'Patient relies on a carer for transport and cannot arrive before 13:00. Do not offer morning procedure slots.',
        author: 'Front desk — Ruth Adeyemi',
        date: '04-09-2025',
      },
      {
        id: 'al-3',
        category: 'billing',
        priority: 'low',
        title: 'Medicare secondary on file',
        body: 'Retiree plan pays first. Verify order of benefits before submitting the facility claim.',
        author: 'Billing — Sam Okoro',
        date: '18-09-2025',
      },
    ],

    provider: {
      name: 'Dr. Amara Mensah',
      credentials: 'MD, FACG',
      specialty: 'Gastroenterology',
      clinic: 'MediNova GI — Arvada',
      phone: '303-555-0110',
    },

    activity: {
      lastVisitDate: '23-10-2025',
      lastEncounterType: 'Surveillance colonoscopy',
      lastProvider: 'Dr. Amara Mensah',
      upcoming: {
        date: '17-05-2026',
        time: '14:30 – 15:00',
        type: 'Post-polypectomy review',
        provider: 'Dr. Amara Mensah',
      },
    },

    portal: {
      state: 'active',
      invitationSent: '02-03-2024',
      lastLogin: '24 Mar 2026, 12:35 PM',
      username: 'hennawest',
    },

    counts: { visitNotes: 3, prescriptions: 3, orders: 4, forms: 7, tasks: 4, billing: 2, documents: 11 },
  },

  326477: {
    mrn: '326477',
    name: 'Natali Craig',
    preferredName: 'Nat',
    photo: null,
    dob: '15-07-1966',
    gender: 'Female',
    language: 'English · Polish interpreter for consents',
    phone: '949-555-7564',
    phoneType: 'Mobile',
    email: 'natali.craig@example.com',
    address: '114 Larkspur Lane, Fargo ND 58102',
    status: 'active',
    balance: 340,
    insuranceBalance: 0,
    quickNote: null,

    flags: ['highPriority', 'diabetic'],

    alerts: [
      {
        id: 'al-1',
        category: 'administrative',
        priority: 'high',
        title: 'Plan is not contracted',
        body: 'Summit Bridge PPO is out of network. Quote self-pay rates and take written consent before scheduling anything billable.',
        author: 'Billing — Sam Okoro',
        date: '21-10-2025',
      },
    ],

    provider: {
      name: 'Dr. Luca Bianchi',
      credentials: 'MD',
      specialty: 'Hepatology',
      clinic: 'MediNova GI — Fargo',
      phone: '701-555-0164',
    },

    activity: {
      lastVisitDate: '19-10-2025',
      lastEncounterType: 'New patient consult',
      lastProvider: 'Dr. Luca Bianchi',
      upcoming: null,
    },

    portal: {
      state: 'invited',
      invitationSent: '20-10-2025',
      lastLogin: null,
      username: null,
    },

    counts: { visitNotes: 1, prescriptions: 0, orders: 0, forms: 2, tasks: 1, billing: 3, documents: 4 },
  },

  326481: {
    mrn: '326481',
    name: 'Liam Rodriguez',
    preferredName: null,
    photo: null,
    dob: '09-12-1971',
    gender: 'Male',
    language: 'Spanish',
    phone: '415-555-0198',
    phoneType: 'Home',
    email: null,
    address: '77 Cottonwood Court, Bismarck ND 58501',
    status: 'inactive',
    balance: 0,
    insuranceBalance: 0,
    quickNote: null,

    flags: ['dnr', 'assistance'],

    alerts: [],

    provider: {
      name: 'Dr. Sana Nakamura',
      credentials: 'MD, MPH',
      specialty: 'Gastroenterology',
      clinic: 'MediNova GI — Bismarck',
      phone: '701-555-0132',
    },

    activity: {
      lastVisitDate: '17-10-2025',
      lastEncounterType: 'Telephone follow-up',
      lastProvider: 'Dr. Sana Nakamura',
      upcoming: null,
    },

    portal: {
      state: 'none',
      invitationSent: null,
      lastLogin: null,
      username: null,
    },

    counts: { visitNotes: 0, prescriptions: 0, orders: 0, forms: 0, tasks: 2, billing: 1, documents: 2 },
  },

  326495: {
    mrn: '326495',
    name: 'Zoe Tran',
    preferredName: null,
    photo: null,
    dob: '14-03-2013', // a minor — exercises the age-category badge in the header
    gender: 'Female',
    language: 'English',
    phone: '208-555-0171',
    phoneType: 'Mobile (guardian)',
    email: 'guardian.tran@example.com',
    address: '19 Birchwood Ave, Boise ID 83702',
    status: 'active',
    balance: 0,
    insuranceBalance: 0,
    quickNote: 'Guardian: Mai Tran, 208-555-0172.',

    flags: ['assistance'],

    alerts: [
      {
        id: 'al-1',
        category: 'clinical',
        priority: 'medium',
        title: 'Consent requires a parent or guardian present',
        body: 'Patient is a minor. A parent or legal guardian must co-sign consent for any procedure.',
        author: 'Dr. Sana Nakamura',
        date: '02-01-2026',
      },
    ],

    provider: {
      name: 'Dr. Sana Nakamura',
      credentials: 'MD, MPH',
      specialty: 'Pediatric Gastroenterology',
      clinic: 'MediNova GI — Bismarck',
      phone: '701-555-0132',
    },

    activity: {
      lastVisitDate: '02-01-2026',
      lastEncounterType: 'Celiac panel follow-up',
      lastProvider: 'Dr. Sana Nakamura',
      upcoming: null,
    },

    portal: {
      state: 'none',
      invitationSent: null,
      lastLogin: null,
      username: null,
    },

    counts: { visitNotes: 1, prescriptions: 1, orders: 0, forms: 3, tasks: 0, billing: 0, documents: 1 },
  },
};

/** Opened without an ?mrn= — the chart still has to show a chart. */
export const DEFAULT_MRN = '326486';

/* ============================================================================
   SIDEBAR

   The order below is the agreed order and is not sorted, grouped or
   rearranged anywhere downstream.

   NO COUNTS ON THE SECTIONS. Every row used to be able to carry one — the
   entry named a key in the patient's `counts` object and the rail drew it as
   a pill, which is why half the list below argued about whether its number
   could be kept honest. A section is a place; the list it opens is the tally,
   at full detail, the moment you press it. `counts` itself stays where it is
   — the visit-note, task and document fixtures are all built to agree with
   it, so it is now purely a fixture anchor (see data/chart-documents.js).

   Profile, Clinical and Insurance were a "Profile" group with the latter two
   nested under it — collapsed at the 2026-08 design review into three plain,
   equal sections. Profile used to be pure grouping (nothing was registered
   against the bare id, only its children stood in for it); it is a real
   module now, so it needs no different treatment from anything else here.

   Insurance ("profile-billing") was then taken out of the rail on the
   client's instruction, 21 Aug 2026. Coverage is read from the top-level
   Billing section; the module file survives unregistered so the tab can be
   put back by restoring this row and its two shell imports.
   ========================================================================= */
export const CHART_NAV = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'profile-clinical', label: 'Clinical', icon: 'stethoscope' },
  { id: 'appointments', label: 'Appointments', icon: 'calendar' },
  { id: 'visit-notes', label: 'Visit Notes', icon: 'clipboard' },
  /*
   * History is the background, so it is read before the lists that describe
   * today. It sits ABOVE Diagnoses rather than below it for the same reason
   * Diagnoses sits above Prescriptions: what a patient has had explains the
   * problem list the way the problem list explains the prescriptions. Putting
   * it lower — filed after Orders with the other reference lists — would have
   * separated it from Clinical, which is where the reader has just come from
   * and which summarises these three lists as cards.
   */
  { id: 'history', label: 'History', icon: 'clock' },
  /*
   * Diagnoses sits above the three sections that treat them. The problem
   * list is what a prescription, an order and a medication are all FOR, so
   * it is read before them rather than filed after them as one more list —
   * and a reader who has just come from Clinical arrives at the maintained
   * version of the problems that screen summarised.
   */
  { id: 'diagnoses', label: 'Diagnoses', icon: 'heart' },
  { id: 'prescriptions', label: 'Prescriptions', icon: 'pill' },
  { id: 'medications', label: 'Medication', icon: 'medication' },
  /*
   * Allergies sits directly under Medication, because that is the pair they
   * are read as: the question "can this patient have this drug" is answered
   * by both lists at once, and a nav that separates them makes somebody check
   * one and not the other.
   */
  { id: 'allergies', label: 'Allergies', icon: 'critical' },
  { id: 'orders', label: 'Orders', icon: 'flask' },
  { id: 'forms', label: 'Forms', icon: 'document' },
  { id: 'vitals', label: 'Vitals', icon: 'vitals' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'notes', label: 'Notes', icon: 'pencil' },
  { id: 'documents', label: 'Documents', icon: 'layers' },
  { id: 'billing', label: 'Billing', icon: 'dollar' },
];
