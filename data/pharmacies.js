/**
 * DEMO DATA — pharmacy directory and referring physicians.
 * Every name, address, number and ID is invented. No real records.
 */

/** E-Rx capability flags shown against each pharmacy in the picker. */
export const RX_FLAGS = {
  R: 'Retail',
  L: 'Long term care',
  S: 'Specialty',
  M: 'Mail order',
  CS: 'Certified for EPCS (controlled substances)',
};

export const PHARMACIES = [
  { id: 'ph1', flags: ['R', 'L', 'CS'], name: 'Red River Pharmacy #14', address: '501 N Lincoln Ave, Ste 10R', city: 'Fargo, ND 58102', phone: '(701) 555-0142', fax: '(701) 555-0143', rcopia: '11154420270', type: 'Retail' },
  { id: 'ph2', flags: ['S', 'CS'], name: 'Prairie Specialty Pharmacy', address: '703 Main Street', city: 'Moorhead, MN 56560', phone: '(218) 555-0164', fax: '(218) 555-0165', rcopia: '12126443280', type: 'Specialty' },
  { id: 'ph3', flags: ['R', 'L'], name: 'First Choice Pharmacy LTC', address: '4105 49th St N, Ste B', city: 'Fargo, ND 58104', phone: '(701) 555-0188', fax: '(701) 555-0189', rcopia: '11107487640', type: 'Long term care' },
  { id: 'ph4', flags: ['R'], name: 'Northgate Pharmacy, Inc.', address: '2228 US Hwy 19', city: 'West Fargo, ND 58078', phone: '(701) 555-0106', fax: '(701) 555-0107', rcopia: '87245400', type: 'Retail' },
  { id: 'ph5', flags: ['R', 'CS'], name: 'Three Rivers Pharmacy', address: '117 Fox Plan Rd, Ste 301', city: 'Grand Forks, ND 58201', phone: '(701) 555-0123', fax: '(701) 555-0124', rcopia: '14100338300', type: 'Retail' },
  { id: 'ph6', flags: ['R', 'L'], name: 'Clinic Pharmacy 406 — LTC', address: '1315 Wyoming St, Ste 1A', city: 'Bismarck, ND 58501', phone: '(701) 555-0160', fax: '(701) 555-0161', rcopia: '11615147800', type: 'Long term care' },
  { id: 'ph7', flags: ['M'], name: 'GastroEMR Mail Order Rx', address: '14332 Ramona Blvd', city: 'Minot, ND 58701', phone: '(701) 555-0199', fax: '(701) 555-0198', rcopia: '10982331200', type: 'Mail order' },
  { id: 'ph8', flags: ['R', 'S', 'CS'], name: 'Sanford Plaza Pharmacy', address: '88 Broadway N', city: 'Fargo, ND 58102', phone: '(701) 555-0111', fax: '(701) 555-0112', rcopia: '13398210050', type: 'Retail' },
];

export const PHARMACY_TYPES = [
  'All types',
  'Retail',
  'Mail order',
  'Specialty',
  'Long term care',
];

/**
 * Provider roles on a patient's record.
 *
 * The referring physician list and the "Providers" panel used to be two
 * separate places holding the same kind of person, which meant a PCP who also
 * sent the referral had to be entered twice. They are one list now, and the
 * role is what tells them apart.
 */
export const PROVIDER_ROLES = [
  'Primary care',
  'Referring',
  'Consulting',
  'Treating',
];

/** Providers already on file for this patient — PCP and referrers alike. */
export const PATIENT_PROVIDERS = [
  {
    id: 'pv1',
    type: 'Person',
    role: 'Primary care',
    name: 'Dr. Helena Ward',
    specialty: 'Family Medicine',
    institution: 'Red River Family Medicine',
    phone: '(701) 555-0177',
    email: 'h.ward@example.com',
    status: 'Active',
  },
  {
    id: 'pv2',
    type: 'Person',
    role: 'Referring',
    name: 'Dr. Amara Mensah',
    specialty: 'Family Medicine',
    institution: 'Red River Family Practice',
    phone: '(701) 555-0170',
    email: 'a.mensah@example.com',
    status: 'Active',
  },
];

/**
 * THE CLINICIANS THIS PRACTICE ALREADY KNOWS, for the Provider picker on the
 * registration form.
 *
 * The drawer used to open on First Name / Last Name, and a clinician the
 * practice refers to every week was re-keyed at every registration — "Dr
 * Helena Ward", "Helena Ward MD", "H. Ward" — so the same person ended up on
 * three patients under three spellings, joined to nothing and searchable as
 * none of them. These are the people who are genuinely on the list: the
 * practice's own providers, and the referrers it works with.
 *
 * Each entry carries what the drawer's other fields ask for, so choosing a
 * name fills the specialty, the practice and the contact details from one
 * record rather than from whatever the registrar remembers.
 *
 * The picker keeps a free-text way out, and it matters — a patient's PCP three
 * states away is genuinely not on this list, and a closed picker would send
 * the registrar off to maintain a master mid-registration.
 */
export const PROVIDER_DIRECTORY = [
  { id: 'pd1', name: 'Dr. Helena Ward', specialty: 'Family Medicine', institution: 'Red River Family Medicine', phone: '(701) 555-0177', email: 'h.ward@example.com' },
  { id: 'pd2', name: 'Dr. Amara Mensah', specialty: 'Family Medicine', institution: 'Red River Family Practice', phone: '(701) 555-0170', email: 'a.mensah@example.com' },
  { id: 'pd3', name: 'Dr. Alan Whitcombe', specialty: 'Internal Medicine', institution: 'Red River Family Medicine', phone: '(701) 555-0131', email: 'a.whitcombe@example.com' },
  { id: 'pd4', name: 'Dr. Sofia Marchetti', specialty: 'Internal Medicine', institution: 'Prairie Internal Medicine', phone: '(701) 555-0135', email: 's.marchetti@example.com' },
  { id: 'pd5', name: 'Dr. Neil Ashworth', specialty: 'General Surgery', institution: 'Fargo Surgical Associates', phone: '(701) 555-0148', email: 'n.ashworth@example.com' },
  { id: 'pd6', name: 'Dr. Grace Ibarra', specialty: 'Family Medicine', institution: 'Northside Community Health', phone: '(701) 555-0152', email: 'g.ibarra@example.com' },
  { id: 'pd7', name: 'Dr. Peter Lindgren', specialty: 'Family Medicine', institution: 'Moorhead Family Practice', phone: '(218) 555-0159', email: 'p.lindgren@example.com' },
  { id: 'pd8', name: 'Olivia Rhye, MD', specialty: 'Gastroenterology', institution: 'GastroEMR Gastroenterology — Fargo', phone: '(701) 555-0100', email: 'o.rhye@medinovagastro.example' },
  { id: 'pd9', name: 'Michael Johnson, MD', specialty: 'Gastroenterology', institution: 'GastroEMR Gastroenterology — Fargo', phone: '(701) 555-0101', email: 'm.johnson@medinovagastro.example' },
  { id: 'pd10', name: 'Emily Chen, DO', specialty: 'Gastroenterology', institution: 'GastroEMR Gastroenterology — Fargo', phone: '(701) 555-0102', email: 'e.chen@medinovagastro.example' },
];

export const providerFromDirectory = (id) => PROVIDER_DIRECTORY.find((p) => p.id === id);

export const SPECIALTIES = [
  'Family Medicine',
  'Internal Medicine',
  'Gastroenterology',
  'General Surgery',
  'Oncology',
  'Emergency Medicine',
];
