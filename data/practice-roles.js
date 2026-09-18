/**
 * DEMO DATA for Practice Settings → Roles & Responsibility.
 * Entirely invented — no real practice or user information.
 *
 * THE SHAPE OF THE PROBLEM
 * A permission matrix is Role × Feature × Action. Written out longhand that
 * is 10 roles × 28 features × 8 actions = 2,240 booleans, which nobody can
 * read and nobody can keep correct. So a role is stored as a POLICY instead:
 * a baseline that applies to every feature, plus the handful of features that
 * differ. Reading a role then tells you what the role IS ("clinical staff:
 * read everything, write the chart") rather than making you diff a wall of
 * ticks.
 *
 * permissionsFor() expands a policy into the full matrix at load time, so the
 * screen still works with plain objects and never has to know about policies.
 */

/* ============================================================================
   ACTIONS — the columns of the matrix.

   `all` is not one of these. It is a summary of the row, computed from the
   others, and storing it would give two sources of truth for one fact.
   ========================================================================= */
export const PERMISSION_ACTIONS = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'archive', label: 'Archive' },
  { id: 'export', label: 'Export' },
  { id: 'print', label: 'Print' },
  { id: 'approve', label: 'Approve' },
];

export const ACTION_IDS = PERMISSION_ACTIONS.map((a) => a.id);

/** Common shorthands used by the policies below. */
const NONE = [];
const READ = ['view'];
const READ_PRINT = ['view', 'print', 'export'];
const CONTRIBUTE = ['view', 'create', 'edit', 'print', 'export'];
const MANAGE = ['view', 'create', 'edit', 'delete', 'archive', 'export', 'print'];
const FULL = [...ACTION_IDS];

/* ============================================================================
   FEATURES — grouped, because 28 flat rows is a wall.

   The groups are the shape of the product, not of the database: an
   administrator setting up a Front Desk role thinks "they need scheduling and
   patients, not clinical documentation", and the grouping lets them act on
   that thought without reading every row.
   ========================================================================= */
export const FEATURE_GROUPS = [
  {
    id: 'clinical',
    label: 'Clinical',
    features: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'scheduling', label: 'Scheduling' },
      { id: 'patients', label: 'Patients' },
      { id: 'patient-chart', label: 'Patient Chart' },
      { id: 'soap-notes', label: 'SOAP Notes' },
      { id: 'clinical-notes', label: 'Clinical Notes' },
      { id: 'orders', label: 'Orders' },
      { id: 'labs', label: 'Labs' },
      { id: 'assessments', label: 'Assessments' },
      { id: 'referrals', label: 'Referrals' },
    ],
  },
  {
    id: 'workflow',
    label: 'Communication & Workflow',
    features: [
      { id: 'communication', label: 'Communication' },
      { id: 'documents', label: 'Documents' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'alerts', label: 'Alerts' },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue Cycle',
    features: [
      { id: 'billing', label: 'Billing' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'claims', label: 'Claims' },
      { id: 'era', label: 'ERA' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Reporting & Intelligence',
    features: [
      { id: 'reports', label: 'Reports' },
      { id: 'ai-agent', label: 'AI Agent' },
      { id: 'live-agent', label: 'Live Agent' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    features: [
      { id: 'settings', label: 'Settings' },
      { id: 'templates', label: 'Templates' },
      { id: 'users', label: 'Users' },
      { id: 'roles', label: 'Roles & Permissions' },
      { id: 'audit-log', label: 'Audit Log' },
      { id: 'legal', label: 'Legal' },
      { id: 'master-data', label: 'Master Data' },
    ],
  },
];

/** Flat list, in display order — what the matrix actually iterates. */
export const FEATURES = FEATURE_GROUPS.flatMap((group) =>
  group.features.map((feature) => ({ ...feature, group: group.id, groupLabel: group.label }))
);

export const FEATURE_INDEX = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

/* ============================================================================
   ROLE TYPES and ROLES

   A Role Type is the family ("Clinical"); a Role is the job ("Nurse"). The
   two dropdowns above the matrix are dependent because a role only means
   anything inside its type.

   `reserved` marks the roles the system depends on. Super Admin cannot be
   deleted or stripped of Roles & Permissions, because doing either locks
   every administrator out of the screen that would undo it.
   ========================================================================= */
export const ROLE_TYPES = [
  { id: 'admin', name: 'Admin', description: 'Practice-wide administration and configuration.', status: 'active' },
  { id: 'provider', name: 'Provider', description: 'Licensed clinicians who document and sign.', status: 'active' },
  { id: 'clinical', name: 'Clinical', description: 'Clinical support staff working in the chart.', status: 'active' },
  { id: 'billing', name: 'Billing', description: 'Revenue cycle, claims and patient balances.', status: 'active' },
  { id: 'front-desk', name: 'Front Desk', description: 'Scheduling, check-in and patient registration.', status: 'active' },
  { id: 'medical-assistant', name: 'Medical Assistant', description: 'Rooming, vitals and order preparation.', status: 'active' },
  { id: 'practice-manager', name: 'Practice Manager', description: 'Operational oversight across the practice.', status: 'active' },
  { id: 'it-admin', name: 'IT Administrator', description: 'Integrations, security and system health.', status: 'inactive' },
];

export const ROLES = [
  // --- Admin ---
  {
    id: 'super-admin',
    typeId: 'admin',
    name: 'Super Admin',
    description: 'Unrestricted access to every module and every configuration screen.',
    status: 'active',
    reserved: true,
    users: 2,
    updatedOn: '18-06-2026',
    updatedBy: 'Amara Mensah',
    policy: { baseline: FULL },
  },
  {
    id: 'practice-admin',
    typeId: 'admin',
    name: 'Practice Admin',
    description: 'Everything except system-level security and legal configuration.',
    status: 'active',
    users: 4,
    updatedOn: '02-07-2026',
    updatedBy: 'Amara Mensah',
    policy: {
      baseline: MANAGE,
      overrides: { legal: READ, 'audit-log': READ_PRINT, 'master-data': READ, 'ai-agent': READ },
    },
  },

  // --- Provider ---
  {
    id: 'physician',
    typeId: 'provider',
    name: 'Physician',
    description: 'Documents, signs and approves clinical work.',
    status: 'active',
    users: 9,
    updatedOn: '21-07-2026',
    updatedBy: 'Luca Bianchi',
    policy: {
      baseline: CONTRIBUTE,
      overrides: {
        'soap-notes': FULL,
        'clinical-notes': FULL,
        orders: FULL,
        labs: FULL,
        assessments: FULL,
        referrals: FULL,
        users: NONE,
        roles: NONE,
        settings: READ,
        legal: READ,
        'master-data': READ,
        'audit-log': NONE,
        claims: READ,
        era: NONE,
      },
    },
  },
  {
    id: 'nurse-practitioner',
    typeId: 'provider',
    name: 'Nurse Practitioner',
    description: 'Documents and orders within scope; approvals limited to own notes.',
    status: 'active',
    users: 3,
    updatedOn: '21-07-2026',
    updatedBy: 'Luca Bianchi',
    policy: {
      baseline: CONTRIBUTE,
      overrides: {
        'soap-notes': [...CONTRIBUTE, 'approve'],
        orders: [...CONTRIBUTE, 'approve'],
        labs: CONTRIBUTE,
        users: NONE,
        roles: NONE,
        settings: READ,
        legal: NONE,
        'master-data': NONE,
        'audit-log': NONE,
        billing: READ,
        claims: NONE,
        era: NONE,
      },
    },
  },
  {
    id: 'therapist',
    typeId: 'provider',
    name: 'Therapist',
    description: 'Session documentation and assessments only.',
    status: 'active',
    users: 1,
    updatedOn: '05-05-2026',
    updatedBy: 'Amara Mensah',
    policy: {
      baseline: READ,
      overrides: {
        'clinical-notes': CONTRIBUTE,
        assessments: CONTRIBUTE,
        documents: CONTRIBUTE,
        tasks: CONTRIBUTE,
        users: NONE,
        roles: NONE,
        settings: NONE,
        'audit-log': NONE,
        legal: NONE,
        'master-data': NONE,
        billing: NONE,
        invoices: NONE,
        claims: NONE,
        era: NONE,
      },
    },
  },

  // --- Clinical ---
  {
    id: 'nurse',
    typeId: 'clinical',
    name: 'Nurse',
    description: 'Chart documentation, vitals and order preparation.',
    status: 'active',
    users: 7,
    updatedOn: '14-07-2026',
    updatedBy: 'Sana Nakamura',
    policy: {
      baseline: READ,
      overrides: {
        'patient-chart': CONTRIBUTE,
        'clinical-notes': CONTRIBUTE,
        assessments: CONTRIBUTE,
        orders: ['view', 'create', 'edit'],
        labs: ['view', 'create', 'print'],
        tasks: CONTRIBUTE,
        documents: CONTRIBUTE,
        communication: CONTRIBUTE,
        users: NONE,
        roles: NONE,
        settings: NONE,
        'audit-log': NONE,
        legal: NONE,
        'master-data': NONE,
        billing: NONE,
        invoices: NONE,
        claims: NONE,
        era: NONE,
      },
    },
  },
  {
    id: 'clinical-medical-assistant',
    typeId: 'clinical',
    name: 'Medical Assistant',
    description: 'Rooming and intake; reads the chart, writes vitals and tasks.',
    status: 'active',
    users: 5,
    updatedOn: '14-07-2026',
    updatedBy: 'Sana Nakamura',
    policy: {
      baseline: READ,
      overrides: {
        'patient-chart': ['view', 'create', 'edit'],
        tasks: CONTRIBUTE,
        documents: ['view', 'create'],
        scheduling: ['view', 'edit'],
        users: NONE,
        roles: NONE,
        settings: NONE,
        'audit-log': NONE,
        legal: NONE,
        'master-data': NONE,
        billing: NONE,
        invoices: NONE,
        claims: NONE,
        era: NONE,
        'soap-notes': READ,
      },
    },
  },

  // --- Billing ---
  {
    id: 'billing-manager',
    typeId: 'billing',
    name: 'Billing Manager',
    description: 'Owns the revenue cycle end to end, including write-offs and approvals.',
    status: 'active',
    users: 2,
    updatedOn: '28-06-2026',
    updatedBy: 'Sam Okoro',
    policy: {
      baseline: READ,
      overrides: {
        billing: FULL,
        invoices: FULL,
        claims: FULL,
        era: FULL,
        reports: READ_PRINT,
        patients: READ_PRINT,
        'soap-notes': NONE,
        'clinical-notes': NONE,
        assessments: NONE,
        orders: NONE,
        labs: NONE,
        users: NONE,
        roles: NONE,
        settings: NONE,
        'master-data': NONE,
      },
    },
  },
  {
    id: 'billing-executive',
    typeId: 'billing',
    name: 'Billing Executive',
    description: 'Works claims and invoices; cannot approve adjustments.',
    status: 'active',
    users: 6,
    updatedOn: '28-06-2026',
    updatedBy: 'Sam Okoro',
    policy: {
      baseline: NONE,
      overrides: {
        dashboard: READ,
        patients: READ,
        billing: CONTRIBUTE,
        invoices: CONTRIBUTE,
        claims: CONTRIBUTE,
        era: READ_PRINT,
        reports: READ_PRINT,
        tasks: CONTRIBUTE,
        communication: READ,
        documents: READ_PRINT,
      },
    },
  },

  // --- Front Desk ---
  {
    id: 'front-desk-coordinator',
    typeId: 'front-desk',
    name: 'Front Desk Coordinator',
    description: 'Scheduling, registration and check-in.',
    status: 'active',
    users: 8,
    updatedOn: '11-07-2026',
    updatedBy: 'Ruth Adeyemi',
    policy: {
      baseline: NONE,
      overrides: {
        dashboard: READ,
        scheduling: MANAGE,
        patients: CONTRIBUTE,
        'patient-chart': READ,
        documents: ['view', 'create', 'print'],
        communication: CONTRIBUTE,
        tasks: CONTRIBUTE,
        alerts: READ,
        referrals: ['view', 'create'],
        invoices: READ_PRINT,
      },
    },
  },

  // --- Practice Manager ---
  {
    id: 'operations-manager',
    typeId: 'practice-manager',
    name: 'Operations Manager',
    description: 'Oversight across scheduling, staffing and reporting.',
    status: 'active',
    users: 1,
    updatedOn: '30-06-2026',
    updatedBy: 'Amara Mensah',
    policy: {
      baseline: READ_PRINT,
      overrides: {
        scheduling: MANAGE,
        reports: MANAGE,
        tasks: MANAGE,
        users: ['view', 'create', 'edit'],
        templates: MANAGE,
        roles: READ,
        'audit-log': READ_PRINT,
        legal: READ,
      },
    },
  },

  // --- Medical Assistant (its own type, per the brief's list) ---
  {
    id: 'senior-medical-assistant',
    typeId: 'medical-assistant',
    name: 'Senior Medical Assistant',
    description: 'Medical assistant duties plus order queue management.',
    status: 'active',
    users: 2,
    updatedOn: '14-07-2026',
    updatedBy: 'Sana Nakamura',
    policy: {
      baseline: READ,
      overrides: {
        'patient-chart': CONTRIBUTE,
        orders: CONTRIBUTE,
        labs: ['view', 'create', 'print'],
        tasks: MANAGE,
        documents: CONTRIBUTE,
        users: NONE,
        roles: NONE,
        settings: NONE,
        billing: NONE,
        claims: NONE,
        era: NONE,
      },
    },
  },

  // --- IT Administrator ---
  {
    id: 'system-administrator',
    typeId: 'it-admin',
    name: 'System Administrator',
    description: 'Configuration, integrations and audit — no clinical data.',
    status: 'inactive',
    users: 0,
    updatedOn: '09-04-2026',
    updatedBy: 'Amara Mensah',
    policy: {
      baseline: NONE,
      overrides: {
        dashboard: READ,
        settings: FULL,
        templates: MANAGE,
        users: MANAGE,
        roles: MANAGE,
        'audit-log': READ_PRINT,
        'master-data': MANAGE,
        legal: MANAGE,
        'ai-agent': MANAGE,
        'live-agent': MANAGE,
      },
    },
  },
];

/* ============================================================================
   EXPANSION
   ========================================================================= */

/**
 * Expand a role's policy into { featureId: { view: true, create: false, … } }.
 *
 * Returned fresh every call: the screen edits this object directly while in
 * Edit Permissions mode, and a shared object would leak one role's unsaved
 * edits into another.
 */
export function permissionsFor(role) {
  const baseline = role?.policy?.baseline ?? NONE;
  const overrides = role?.policy?.overrides ?? {};

  const matrix = {};
  for (const feature of FEATURES) {
    const granted = overrides[feature.id] ?? baseline;
    matrix[feature.id] = Object.fromEntries(
      ACTION_IDS.map((action) => [action, granted.includes(action)])
    );
  }
  return matrix;
}

/* ============================================================================
   THE ROLES THE SCREEN ACTUALLY LISTS

   One vocabulary, not two. The roles an administrator assigns on Add User are
   the roles whose permissions they configure here — a permissions screen that
   lists roles nobody can be given is a screen that describes a different
   product. So the list is built from PROVIDER_ROLES + STAFF_ROLES, and the
   policies below say what each one may do.

   Where a role already had a policy above under a different name (Nurse →
   RN, Front Desk Coordinator → Front Desk) the policy is reused rather than
   re-invented.
   ========================================================================= */

const CLINICAL_WRITE = {
  baseline: CONTRIBUTE,
  overrides: {
    'soap-notes': FULL,
    'clinical-notes': FULL,
    orders: FULL,
    labs: FULL,
    assessments: FULL,
    referrals: FULL,
    billing: READ,
    claims: READ,
    payments: NONE,
    roles: NONE,
    settings: NONE,
    users: NONE,
    legal: READ,
  },
};

const CLINICAL_SUPPORT = {
  baseline: READ_PRINT,
  overrides: {
    'soap-notes': CONTRIBUTE,
    'clinical-notes': CONTRIBUTE,
    orders: CONTRIBUTE,
    labs: CONTRIBUTE,
    scheduling: MANAGE,
    billing: NONE,
    claims: NONE,
    payments: NONE,
    roles: NONE,
    settings: NONE,
    users: NONE,
  },
};

const FRONT_OFFICE = {
  baseline: READ,
  overrides: {
    scheduling: MANAGE,
    patients: MANAGE,
    'patient-chart': READ,
    referrals: CONTRIBUTE,
    'soap-notes': NONE,
    'clinical-notes': NONE,
    orders: NONE,
    labs: NONE,
    billing: READ,
    roles: NONE,
    settings: NONE,
    users: NONE,
  },
};

const REVENUE = {
  baseline: READ,
  overrides: {
    billing: FULL,
    claims: FULL,
    payments: FULL,
    'patient-chart': READ_PRINT,
    'soap-notes': READ,
    'clinical-notes': READ,
    scheduling: READ,
    roles: NONE,
    settings: NONE,
    users: NONE,
  },
};

const ADMINISTRATIVE = {
  baseline: MANAGE,
  overrides: { legal: READ, 'audit-log': READ_PRINT, 'master-data': READ, 'ai-agent': READ },
};

const TECHNICAL = {
  baseline: READ_PRINT,
  overrides: {
    settings: FULL,
    users: FULL,
    roles: FULL,
    'master-data': FULL,
    'audit-log': FULL,
    'soap-notes': NONE,
    'clinical-notes': NONE,
    'patient-chart': NONE,
  },
};

const RECORDS = {
  baseline: READ_PRINT,
  overrides: {
    documents: MANAGE,
    'clinical-notes': READ_PRINT,
    'soap-notes': READ_PRINT,
    orders: NONE,
    labs: READ_PRINT,
    billing: NONE,
    claims: NONE,
    roles: NONE,
    settings: NONE,
    users: NONE,
  },
};

const QUALITY = {
  baseline: READ_PRINT,
  overrides: {
    reports: MANAGE,
    'audit-log': READ_PRINT,
    legal: CONTRIBUTE,
    alerts: MANAGE,
    tasks: MANAGE,
    'soap-notes': READ,
    'clinical-notes': READ,
    orders: NONE,
    roles: READ,
    settings: READ,
    users: READ,
  },
};

const OPERATIONS = {
  baseline: READ_PRINT,
  overrides: {
    scheduling: MANAGE,
    tasks: MANAGE,
    reports: MANAGE,
    templates: MANAGE,
    users: ['view', 'create', 'edit'],
    roles: READ,
    'audit-log': READ_PRINT,
    'soap-notes': READ,
    'clinical-notes': READ,
    orders: NONE,
  },
};

const PEOPLE_OPS = {
  baseline: NONE,
  overrides: {
    dashboard: READ,
    users: MANAGE,
    roles: READ,
    tasks: CONTRIBUTE,
    documents: CONTRIBUTE,
    reports: READ_PRINT,
    'audit-log': READ,
  },
};

const SUPPLIES = {
  baseline: NONE,
  overrides: {
    dashboard: READ,
    settings: READ,
    tasks: CONTRIBUTE,
    documents: READ_PRINT,
    reports: READ_PRINT,
    alerts: READ,
  },
};

/** Reads the chart to do the job, writes nothing into it — a technologist,
 *  a phlebotomist, a transcriptionist waiting on a note to type. */
const CLINICAL_READ = {
  baseline: READ,
  overrides: {
    documents: ['view', 'create', 'print'],
    tasks: CONTRIBUTE,
    billing: NONE,
    invoices: NONE,
    claims: NONE,
    era: NONE,
    roles: NONE,
    settings: NONE,
    users: NONE,
    'audit-log': NONE,
    legal: NONE,
  },
};

/** Works claims and authorisations without reaching the clinical record
 *  beyond what a claim needs. */
const AUTHORISATION = {
  baseline: NONE,
  overrides: {
    dashboard: READ,
    patients: READ,
    scheduling: READ,
    referrals: CONTRIBUTE,
    billing: READ,
    claims: CONTRIBUTE,
    documents: READ_PRINT,
    tasks: CONTRIBUTE,
    communication: CONTRIBUTE,
    alerts: READ,
  },
};

/** Policy per assignable job role. Anything unlisted falls back to READ. */
const JOB_ROLE_POLICIES = {
  /* --- Signs and prescribes --- */
  Physician: CLINICAL_WRITE,
  Hepatologist: CLINICAL_WRITE,
  'Advanced Endoscopist': CLINICAL_WRITE,
  'Nurse Practitioner': CLINICAL_WRITE,
  'Physician Assistant': CLINICAL_WRITE,
  'Behavioral Health Provider': CLINICAL_WRITE,
  Anesthesiologist: CLINICAL_WRITE,

  /* A fellow documents everything a physician does and approves none of it —
     the approval is the supervising consultant's, which is the whole point of
     the grade. */
  Fellow: { ...CLINICAL_WRITE, overrides: { ...CLINICAL_WRITE.overrides, 'soap-notes': CONTRIBUTE, 'clinical-notes': CONTRIBUTE, orders: CONTRIBUTE } },
  Resident: { ...CLINICAL_WRITE, overrides: { ...CLINICAL_WRITE.overrides, 'soap-notes': CONTRIBUTE, 'clinical-notes': CONTRIBUTE, orders: CONTRIBUTE, referrals: CONTRIBUTE } },

  /* --- Writes the chart without signing it --- */
  CRNA: CLINICAL_SUPPORT,
  RN: CLINICAL_SUPPORT,
  LPN: CLINICAL_SUPPORT,
  'Procedure Nurse': CLINICAL_SUPPORT,
  'Recovery Nurse': CLINICAL_SUPPORT,
  'Triage Nurse': CLINICAL_SUPPORT,
  'Infusion Nurse': CLINICAL_SUPPORT,
  'Medical Assistant': CLINICAL_SUPPORT,
  'Clinical Pharmacist': CLINICAL_SUPPORT,
  Dietician: CLINICAL_SUPPORT,
  'Genetic Counselor': CLINICAL_SUPPORT,
  'Research Coordinator': CLINICAL_SUPPORT,

  /* --- Reads the chart to do the job --- */
  'Endoscopy Technician': CLINICAL_READ,
  'Anesthesia Technician': CLINICAL_READ,
  'Radiologic Technologist': CLINICAL_READ,
  Sonographer: CLINICAL_READ,
  Phlebotomist: CLINICAL_READ,
  Transcriptionist: CLINICAL_READ,

  /* --- Front office --- */
  'Practice Administrator': ADMINISTRATIVE,
  'Front Desk': FRONT_OFFICE,
  Scheduler: FRONT_OFFICE,
  Receptionist: FRONT_OFFICE,
  'Call Center': FRONT_OFFICE,
  'Patient Access Specialist': FRONT_OFFICE,
  'Referral Coordinator': FRONT_OFFICE,

  /* --- Authorisation and eligibility --- */
  'Prior Authorization Specialist': AUTHORISATION,
  'Insurance Verifier': AUTHORISATION,

  /* --- Revenue and systems --- */
  'Billing Staff': REVENUE,
  'Coding Specialist': REVENUE,
  'Charge Entry Clerk': REVENUE,
  'Payment Poster': REVENUE,
  'Denials Analyst': REVENUE,
  'Collections Specialist': REVENUE,
  'Revenue Cycle Manager': REVENUE,
  Finance: REVENUE,
  'IT Administrator': TECHNICAL,
  'Systems Analyst': TECHNICAL,
  'Help Desk Technician': { baseline: READ, overrides: { users: ['view', 'edit'], settings: READ, 'audit-log': READ, 'patient-chart': NONE, 'soap-notes': NONE, 'clinical-notes': NONE } },
  'Data Analyst': { baseline: READ_PRINT, overrides: { reports: MANAGE, 'soap-notes': NONE, 'clinical-notes': NONE, roles: NONE, settings: NONE, users: NONE } },

  /* --- Records --- */
  'Medical Records': RECORDS,
  'Health Information Technician': RECORDS,

  /* --- Oversight --- */
  'Operations Manager': OPERATIONS,
  'Clinic Supervisor': OPERATIONS,
  'Facilities Coordinator': SUPPLIES,
  'Compliance Officer': QUALITY,
  'Privacy Officer': QUALITY,
  'Quality Coordinator': QUALITY,
  'Infection Control Coordinator': QUALITY,
  'Credentialing Specialist': PEOPLE_OPS,
  'Human Resources': PEOPLE_OPS,
  'Marketing Coordinator': { baseline: NONE, overrides: { dashboard: READ, reports: READ_PRINT, communication: CONTRIBUTE, documents: READ_PRINT } },
  'Materials Manager': SUPPLIES,
  'Inventory Clerk': SUPPLIES,
};

/** How many people hold each role, so the screen is not a wall of zeroes. */
const JOB_ROLE_USERS = {
  Physician: 9, Hepatologist: 3, 'Advanced Endoscopist': 2, Fellow: 4, Resident: 3,
  'Nurse Practitioner': 4, 'Physician Assistant': 3, Anesthesiologist: 2, CRNA: 4,
  'Anesthesia Technician': 3, RN: 6, LPN: 4, 'Procedure Nurse': 7, 'Recovery Nurse': 6,
  'Triage Nurse': 5, 'Infusion Nurse': 5, 'Endoscopy Technician': 8, 'Medical Assistant': 7,
  'Clinical Pharmacist': 2, Dietician: 2, 'Behavioral Health Provider': 2,
  'Genetic Counselor': 1, 'Radiologic Technologist': 2, Sonographer: 2, Phlebotomist: 4,
  'Research Coordinator': 2,
  'Practice Administrator': 2, 'Operations Manager': 2, 'Clinic Supervisor': 4,
  'Front Desk': 8, Receptionist: 4, Scheduler: 5, 'Call Center': 6,
  'Patient Access Specialist': 4, 'Referral Coordinator': 3,
  'Prior Authorization Specialist': 4, 'Insurance Verifier': 3,
  'Billing Staff': 6, 'Coding Specialist': 4, 'Charge Entry Clerk': 3, 'Payment Poster': 3,
  'Denials Analyst': 3, 'Collections Specialist': 2, 'Revenue Cycle Manager': 1, Finance: 2,
  'Medical Records': 3, 'Health Information Technician': 2, Transcriptionist: 2,
  'Compliance Officer': 1, 'Privacy Officer': 1, 'Quality Coordinator': 2,
  'Infection Control Coordinator': 1, 'Credentialing Specialist': 1, 'Human Resources': 2,
  'Marketing Coordinator': 1, 'Materials Manager': 1, 'Inventory Clerk': 2,
  'Facilities Coordinator': 1, 'IT Administrator': 1, 'Systems Analyst': 1,
  'Help Desk Technician': 2, 'Data Analyst': 1,
};

const roleSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Build the assignable roles from the Add User vocabulary.
 *
 * `names` is passed in rather than imported so this file stays the single
 * place that knows about policies and data/practice.js stays the single
 * place that knows which roles exist.
 */
export function jobRoles(names) {
  return names.map((name) => ({
    id: roleSlug(name),
    name,
    typeId: 'job',
    description: ROLE_DESCRIPTIONS[name] ?? `Permissions for the ${name} role.`,
    status: 'active',
    reserved: false,
    users: JOB_ROLE_USERS[name] ?? 0,
    updatedOn: '18-06-2026',
    updatedBy: 'Amara Mensah',
    policy: JOB_ROLE_POLICIES[name] ?? { baseline: READ },
  }));
}

const ROLE_DESCRIPTIONS = {
  Physician: 'Documents, signs and approves clinical work.',
  Hepatologist: 'Liver clinic documentation, signing and approvals.',
  'Advanced Endoscopist': 'Therapeutic endoscopy, ERCP and EUS documentation.',
  Fellow: 'Documents under supervision; approvals rest with the consultant.',
  Resident: 'Documents under supervision; no approvals.',
  'Nurse Practitioner': 'Documents and signs within scope of practice.',
  'Physician Assistant': 'Documents and signs under supervising physician.',
  Anesthesiologist: 'Sedation plan, anaesthetic record and recovery sign-off.',
  CRNA: 'Sedation record, medication administration and recovery.',
  'Anesthesia Technician': 'Prepares the sedation trolley; reads the case list.',
  RN: 'Chart documentation, orders and patient education.',
  LPN: 'Rooming, vitals and medication administration.',
  'Procedure Nurse': 'Intra-procedure documentation and specimen handling.',
  'Recovery Nurse': 'Recovery observations and discharge documentation.',
  'Triage Nurse': 'Telephone triage, symptom assessment and escalation.',
  'Infusion Nurse': 'Infusion administration and reaction monitoring.',
  'Endoscopy Technician': 'Scope handling and reprocessing; reads the case list.',
  'Medical Assistant': 'Rooming, vitals and order preparation.',
  'Clinical Pharmacist': 'Medication review, dosing and interaction checks.',
  Dietician: 'Nutrition assessment and dietary plans.',
  'Behavioral Health Provider': 'Behavioural health assessment and notes.',
  'Genetic Counselor': 'Family history assessment and genetic risk counselling.',
  'Radiologic Technologist': 'Imaging acquisition; reads the order, writes no note.',
  Sonographer: 'Ultrasound acquisition and technical worksheets.',
  Phlebotomist: 'Specimen collection against an existing order.',
  'Research Coordinator': 'Study visits, consent and protocol documentation.',
  'Practice Administrator': 'Everything except system security and legal configuration.',
  'Operations Manager': 'Oversight across scheduling, staffing and reporting.',
  'Clinic Supervisor': 'Day-to-day running of one site.',
  'Front Desk': 'Scheduling, check-in and patient registration.',
  Receptionist: 'Arrivals, messages and front-of-house tasks.',
  Scheduler: 'Books, moves and cancels appointments.',
  'Call Center': 'Inbound calls, booking and message triage.',
  'Patient Access Specialist': 'Registration, demographics and financial clearance.',
  'Referral Coordinator': 'Incoming and outgoing referral management.',
  'Prior Authorization Specialist': 'Obtains and tracks authorisation before a procedure.',
  'Insurance Verifier': 'Eligibility and benefit checks ahead of the visit.',
  'Billing Staff': 'Claims, payments and patient balances.',
  'Coding Specialist': 'Assigns and audits diagnosis and procedure codes.',
  'Charge Entry Clerk': 'Enters charges against completed encounters.',
  'Payment Poster': 'Posts remittances and patient payments.',
  'Denials Analyst': 'Works denied claims and files appeals.',
  'Collections Specialist': 'Aged balances, payment plans and collections.',
  'Revenue Cycle Manager': 'Owns the revenue cycle end to end.',
  Finance: 'Revenue reporting and reconciliation.',
  'Medical Records': 'Release of information and record requests.',
  'Health Information Technician': 'Record integrity, indexing and chart correction.',
  Transcriptionist: 'Types dictated notes; reads the chart for context.',
  'Compliance Officer': 'Policy, audit and regulatory oversight.',
  'Privacy Officer': 'Access reviews, disclosures and privacy incidents.',
  'Quality Coordinator': 'Quality measures, outcomes and improvement work.',
  'Infection Control Coordinator': 'Reprocessing audit and infection surveillance.',
  'Credentialing Specialist': 'Provider enrolment, licences and payer credentialling.',
  'Human Resources': 'Staff records, onboarding and offboarding.',
  'Marketing Coordinator': 'Outreach, campaigns and patient communications.',
  'Materials Manager': 'Purchasing, stock levels and supplier contracts.',
  'Inventory Clerk': 'Receipting, counts and stock movements.',
  'Facilities Coordinator': 'Rooms, equipment servicing and site logistics.',
  'IT Administrator': 'Integrations, security and system health.',
  'Systems Analyst': 'Configuration, interfaces and data mapping.',
  'Help Desk Technician': 'Account resets and first-line support. No clinical data.',
  'Data Analyst': 'Reporting and analytics across the practice.',
};

/** Every action off — the starting point for a role built from scratch. */
export function blankPermissions() {
  return Object.fromEntries(
    FEATURES.map((feature) => [
      feature.id,
      Object.fromEntries(ACTION_IDS.map((action) => [action, false])),
    ])
  );
}

/**
 * Features a reserved role must keep, whatever the administrator ticks.
 *
 * Removing "Roles & Permissions" from Super Admin is the one edit on this
 * screen that cannot be undone from inside the product: it takes away the
 * screen you would use to put it back.
 */
export const LOCKED_FOR_RESERVED = ['roles', 'settings', 'users'];

/* ============================================================================
   AUDIT TRAIL — seeded so the History panel has something to show.
   ========================================================================= */
export const PERMISSION_AUDIT = [
  {
    id: 'aud-1',
    roleId: 'billing-executive',
    roleLabel: 'Billing → Billing Executive',
    date: '28-06-2026',
    time: '14:12',
    by: 'Sam Okoro',
    summary: 'Granted Export on Reports; removed Delete on Claims.',
    changes: 2,
  },
  {
    id: 'aud-2',
    roleId: 'front-desk-coordinator',
    roleLabel: 'Front Desk → Front Desk Coordinator',
    date: '11-07-2026',
    time: '09:40',
    by: 'Ruth Adeyemi',
    summary: 'Granted Create on Referrals so the desk can start a referral at check-out.',
    changes: 1,
  },
  {
    id: 'aud-3',
    roleId: 'physician',
    roleLabel: 'Provider → Physician',
    date: '21-07-2026',
    time: '17:05',
    by: 'Luca Bianchi',
    summary: 'Removed all access to Audit Log and Users.',
    changes: 16,
  },
  {
    id: 'aud-4',
    roleId: 'physician',
    roleLabel: 'Provider → Physician',
    date: '29-07-2026',
    time: '08:20',
    by: 'Amara Mensah',
    summary: 'Granted Export on Reports.',
    changes: 1,
  },
  {
    id: 'aud-5',
    roleId: 'hepatologist',
    roleLabel: 'Provider → Hepatologist',
    date: '23-07-2026',
    time: '09:40',
    by: 'Sam Okoro',
    summary: 'Removed Delete on Claims.',
    changes: 1,
  },
  {
    id: 'aud-6',
    roleId: 'advanced-endoscopist',
    roleLabel: 'Provider → Advanced Endoscopist',
    date: '18-07-2026',
    time: '10:15',
    by: 'Ruth Adeyemi',
    summary: 'Granted Approve on SOAP Notes.',
    changes: 1,
  },
  {
    id: 'aud-7',
    roleId: 'fellow',
    roleLabel: 'Provider → Fellow',
    date: '12-07-2026',
    time: '11:32',
    by: 'Luca Bianchi',
    summary: 'Removed all access to Audit Log.',
    changes: 8,
  },
  {
    id: 'aud-8',
    roleId: 'resident',
    roleLabel: 'Provider → Resident',
    date: '07-07-2026',
    time: '13:05',
    by: 'Sana Nakamura',
    summary: 'Granted Create and Edit on Documents.',
    changes: 2,
  },
  {
    id: 'aud-9',
    roleId: 'nurse-practitioner',
    roleLabel: 'Provider → Nurse Practitioner',
    date: '01-07-2026',
    time: '14:12',
    by: 'Lucas Thomas',
    summary: 'Removed Edit on Billing after the quarterly access review.',
    changes: 1,
  },
  {
    id: 'aud-10',
    roleId: 'physician-assistant',
    roleLabel: 'Provider → Physician Assistant',
    date: '26-06-2026',
    time: '15:48',
    by: 'Mia Jackson',
    summary: 'Granted Print on Patient Chart so the desk can hand over a summary.',
    changes: 1,
  },
  {
    id: 'aud-11',
    roleId: 'anesthesiologist',
    roleLabel: 'Anaesthesia → Anesthesiologist',
    date: '20-06-2026',
    time: '16:30',
    by: 'Amara Mensah',
    summary: 'Cloned from Medical Assistant, then Orders reduced to view only.',
    changes: 12,
  },
  {
    id: 'aud-12',
    roleId: 'crna',
    roleLabel: 'Anaesthesia → CRNA',
    date: '15-06-2026',
    time: '17:05',
    by: 'Sam Okoro',
    summary: 'Granted Manage on Scheduling for the outreach sites.',
    changes: 4,
  },
  {
    id: 'aud-13',
    roleId: 'rn',
    roleLabel: 'Clinical → RN',
    date: '09-06-2026',
    time: '08:20',
    by: 'Ruth Adeyemi',
    summary: 'Removed Users and Roles following the compliance audit.',
    changes: 16,
  },
  {
    id: 'aud-14',
    roleId: 'lpn',
    roleLabel: 'Clinical → LPN',
    date: '04-06-2026',
    time: '09:40',
    by: 'Luca Bianchi',
    summary: 'Granted View on Reports for the monthly outcomes pack.',
    changes: 1,
  },
  {
    id: 'aud-15',
    roleId: 'procedure-nurse',
    roleLabel: 'Clinical → Procedure Nurse',
    date: '29-05-2026',
    time: '10:15',
    by: 'Sana Nakamura',
    summary: 'Removed Export on Patients — data leaving the practice on a spreadsheet.',
    changes: 1,
  },
  {
    id: 'aud-16',
    roleId: 'recovery-nurse',
    roleLabel: 'Clinical → Recovery Nurse',
    date: '24-05-2026',
    time: '11:32',
    by: 'Lucas Thomas',
    summary: 'Granted Archive on Tasks so a closed queue can be cleared down.',
    changes: 1,
  },
  {
    id: 'aud-17',
    roleId: 'triage-nurse',
    roleLabel: 'Clinical → Triage Nurse',
    date: '18-05-2026',
    time: '13:05',
    by: 'Mia Jackson',
    summary: 'Granted Approve on Orders within scope of practice.',
    changes: 2,
  },
  {
    id: 'aud-18',
    roleId: 'infusion-nurse',
    roleLabel: 'Clinical → Infusion Nurse',
    date: '13-05-2026',
    time: '14:12',
    by: 'Amara Mensah',
    summary: 'Removed ERA entirely; the role never worked remittances.',
    changes: 6,
  },
  {
    id: 'aud-19',
    roleId: 'endoscopy-technician',
    roleLabel: 'Clinical → Endoscopy Technician',
    date: '07-05-2026',
    time: '15:48',
    by: 'Sam Okoro',
    summary: 'Granted Edit on Referrals at the coordinator team lead’s request.',
    changes: 1,
  },
  {
    id: 'aud-20',
    roleId: 'medical-assistant',
    roleLabel: 'Clinical → Medical Assistant',
    date: '02-05-2026',
    time: '16:30',
    by: 'Ruth Adeyemi',
    summary: 'Role created from Front Desk and narrowed to registration only.',
    changes: 22,
  },
  {
    id: 'aud-21',
    roleId: 'clinical-pharmacist',
    roleLabel: 'Pharmacy → Clinical Pharmacist',
    date: '26-04-2026',
    time: '17:05',
    by: 'Luca Bianchi',
    summary: 'Granted Print and Export on Invoices for the statement run.',
    changes: 2,
  },
  {
    id: 'aud-22',
    roleId: 'dietician',
    roleLabel: 'Clinical → Dietician',
    date: '21-04-2026',
    time: '08:20',
    by: 'Sana Nakamura',
    summary: 'Removed Create on Patients — duplicates were being raised at check-in.',
    changes: 1,
  },
  {
    id: 'aud-23',
    roleId: 'front-desk',
    roleLabel: 'Front Office → Front Desk',
    date: '15-04-2026',
    time: '09:40',
    by: 'Lucas Thomas',
    summary: 'Granted View on Audit Log for the privacy review.',
    changes: 1,
  },
  {
    id: 'aud-24',
    roleId: 'scheduler',
    roleLabel: 'Front Office → Scheduler',
    date: '10-04-2026',
    time: '10:15',
    by: 'Mia Jackson',
    summary: 'Granted Export on Reports.',
    changes: 1,
  },
  {
    id: 'aud-25',
    roleId: 'call-center',
    roleLabel: 'Front Office → Call Center',
    date: '04-04-2026',
    time: '11:32',
    by: 'Amara Mensah',
    summary: 'Removed Delete on Claims.',
    changes: 1,
  },
  {
    id: 'aud-26',
    roleId: 'patient-access-specialist',
    roleLabel: 'Front Office → Patient Access Specialist',
    date: '30-03-2026',
    time: '13:05',
    by: 'Sam Okoro',
    summary: 'Granted Approve on SOAP Notes.',
    changes: 1,
  },
  {
    id: 'aud-27',
    roleId: 'referral-coordinator',
    roleLabel: 'Referrals → Referral Coordinator',
    date: '24-03-2026',
    time: '14:12',
    by: 'Ruth Adeyemi',
    summary: 'Removed all access to Audit Log.',
    changes: 8,
  },
  {
    id: 'aud-28',
    roleId: 'prior-authorization-specialist',
    roleLabel: 'Referrals → Prior Authorization Specialist',
    date: '19-03-2026',
    time: '15:48',
    by: 'Luca Bianchi',
    summary: 'Granted Create and Edit on Documents.',
    changes: 2,
  },
  {
    id: 'aud-29',
    roleId: 'insurance-verifier',
    roleLabel: 'Referrals → Insurance Verifier',
    date: '13-03-2026',
    time: '16:30',
    by: 'Sana Nakamura',
    summary: 'Removed Edit on Billing after the quarterly access review.',
    changes: 1,
  },
  {
    id: 'aud-30',
    roleId: 'billing-staff',
    roleLabel: 'Billing → Billing Staff',
    date: '08-03-2026',
    time: '17:05',
    by: 'Lucas Thomas',
    summary: 'Granted Print on Patient Chart so the desk can hand over a summary.',
    changes: 1,
  },
  {
    id: 'aud-31',
    roleId: 'coding-specialist',
    roleLabel: 'Billing → Coding Specialist',
    date: '02-03-2026',
    time: '08:20',
    by: 'Mia Jackson',
    summary: 'Cloned from Medical Assistant, then Orders reduced to view only.',
    changes: 12,
  },
  {
    id: 'aud-32',
    roleId: 'charge-entry-clerk',
    roleLabel: 'Billing → Charge Entry Clerk',
    date: '25-02-2026',
    time: '09:40',
    by: 'Amara Mensah',
    summary: 'Granted Manage on Scheduling for the outreach sites.',
    changes: 4,
  },
  {
    id: 'aud-33',
    roleId: 'payment-poster',
    roleLabel: 'Billing → Payment Poster',
    date: '19-02-2026',
    time: '10:15',
    by: 'Sam Okoro',
    summary: 'Removed Users and Roles following the compliance audit.',
    changes: 16,
  },
  {
    id: 'aud-34',
    roleId: 'denials-analyst',
    roleLabel: 'Billing → Denials Analyst',
    date: '14-02-2026',
    time: '11:32',
    by: 'Ruth Adeyemi',
    summary: 'Granted View on Reports for the monthly outcomes pack.',
    changes: 1,
  },
  {
    id: 'aud-35',
    roleId: 'collections-specialist',
    roleLabel: 'Billing → Collections Specialist',
    date: '08-02-2026',
    time: '13:05',
    by: 'Luca Bianchi',
    summary: 'Removed Export on Patients — data leaving the practice on a spreadsheet.',
    changes: 1,
  },
  {
    id: 'aud-36',
    roleId: 'revenue-cycle-manager',
    roleLabel: 'Finance → Revenue Cycle Manager',
    date: '03-02-2026',
    time: '14:12',
    by: 'Sana Nakamura',
    summary: 'Granted Archive on Tasks so a closed queue can be cleared down.',
    changes: 1,
  },
  {
    id: 'aud-37',
    roleId: 'finance',
    roleLabel: 'Finance → Finance',
    date: '28-01-2026',
    time: '15:48',
    by: 'Lucas Thomas',
    summary: 'Granted Approve on Orders within scope of practice.',
    changes: 2,
  },
  {
    id: 'aud-38',
    roleId: 'medical-records',
    roleLabel: 'Medical Records → Medical Records',
    date: '23-01-2026',
    time: '16:30',
    by: 'Mia Jackson',
    summary: 'Removed ERA entirely; the role never worked remittances.',
    changes: 6,
  },
  {
    id: 'aud-39',
    roleId: 'health-information-technician',
    roleLabel: 'Medical Records → Health Information Technician',
    date: '17-01-2026',
    time: '17:05',
    by: 'Amara Mensah',
    summary: 'Granted Edit on Referrals at the coordinator team lead’s request.',
    changes: 1,
  },
  {
    id: 'aud-40',
    roleId: 'transcriptionist',
    roleLabel: 'Medical Records → Transcriptionist',
    date: '12-01-2026',
    time: '08:20',
    by: 'Sam Okoro',
    summary: 'Role created from Front Desk and narrowed to registration only.',
    changes: 22,
  },
  {
    id: 'aud-41',
    roleId: 'compliance-officer',
    roleLabel: 'Quality → Compliance Officer',
    date: '06-01-2026',
    time: '09:40',
    by: 'Ruth Adeyemi',
    summary: 'Granted Print and Export on Invoices for the statement run.',
    changes: 2,
  },
  {
    id: 'aud-42',
    roleId: 'privacy-officer',
    roleLabel: 'Quality → Privacy Officer',
    date: '01-01-2026',
    time: '10:15',
    by: 'Luca Bianchi',
    summary: 'Removed Create on Patients — duplicates were being raised at check-in.',
    changes: 1,
  },
  {
    id: 'aud-43',
    roleId: 'quality-coordinator',
    roleLabel: 'Quality → Quality Coordinator',
    date: '26-12-2025',
    time: '11:32',
    by: 'Sana Nakamura',
    summary: 'Granted View on Audit Log for the privacy review.',
    changes: 1,
  },
  {
    id: 'aud-44',
    roleId: 'infection-control-coordinator',
    roleLabel: 'Quality → Infection Control Coordinator',
    date: '21-12-2025',
    time: '13:05',
    by: 'Lucas Thomas',
    summary: 'Granted Export on Reports.',
    changes: 1,
  },
  {
    id: 'aud-45',
    roleId: 'credentialing-specialist',
    roleLabel: 'Human Resources → Credentialing Specialist',
    date: '15-12-2025',
    time: '14:12',
    by: 'Mia Jackson',
    summary: 'Removed Delete on Claims.',
    changes: 1,
  },
  {
    id: 'aud-46',
    roleId: 'human-resources',
    roleLabel: 'Human Resources → Human Resources',
    date: '10-12-2025',
    time: '15:48',
    by: 'Amara Mensah',
    summary: 'Granted Approve on SOAP Notes.',
    changes: 1,
  },
  {
    id: 'aud-47',
    roleId: 'operations-manager',
    roleLabel: 'Operations → Operations Manager',
    date: '04-12-2025',
    time: '16:30',
    by: 'Sam Okoro',
    summary: 'Removed all access to Audit Log.',
    changes: 8,
  },
  {
    id: 'aud-48',
    roleId: 'clinic-supervisor',
    roleLabel: 'Operations → Clinic Supervisor',
    date: '29-11-2025',
    time: '17:05',
    by: 'Ruth Adeyemi',
    summary: 'Granted Create and Edit on Documents.',
    changes: 2,
  },
  {
    id: 'aud-49',
    roleId: 'materials-manager',
    roleLabel: 'Materials → Materials Manager',
    date: '23-11-2025',
    time: '08:20',
    by: 'Luca Bianchi',
    summary: 'Removed Edit on Billing after the quarterly access review.',
    changes: 1,
  },
  {
    id: 'aud-50',
    roleId: 'inventory-clerk',
    roleLabel: 'Materials → Inventory Clerk',
    date: '18-11-2025',
    time: '09:40',
    by: 'Sana Nakamura',
    summary: 'Granted Print on Patient Chart so the desk can hand over a summary.',
    changes: 1,
  },
  {
    id: 'aud-51',
    roleId: 'facilities-coordinator',
    roleLabel: 'Operations → Facilities Coordinator',
    date: '12-11-2025',
    time: '10:15',
    by: 'Lucas Thomas',
    summary: 'Cloned from Medical Assistant, then Orders reduced to view only.',
    changes: 12,
  },
  {
    id: 'aud-52',
    roleId: 'it-administrator',
    roleLabel: 'IT → IT Administrator',
    date: '07-11-2025',
    time: '11:32',
    by: 'Mia Jackson',
    summary: 'Granted Manage on Scheduling for the outreach sites.',
    changes: 4,
  },
  {
    id: 'aud-53',
    roleId: 'systems-analyst',
    roleLabel: 'IT → Systems Analyst',
    date: '01-11-2025',
    time: '13:05',
    by: 'Amara Mensah',
    summary: 'Removed Users and Roles following the compliance audit.',
    changes: 16,
  },
  {
    id: 'aud-54',
    roleId: 'help-desk-technician',
    roleLabel: 'IT → Help Desk Technician',
    date: '27-10-2025',
    time: '14:12',
    by: 'Sam Okoro',
    summary: 'Granted View on Reports for the monthly outcomes pack.',
    changes: 1,
  },
  {
    id: 'aud-55',
    roleId: 'data-analyst',
    roleLabel: 'IT → Data Analyst',
    date: '21-10-2025',
    time: '15:48',
    by: 'Ruth Adeyemi',
    summary: 'Removed Export on Patients — data leaving the practice on a spreadsheet.',
    changes: 1,
  },
];

export const ROLE_STATUSES = ['Active', 'Inactive'];
