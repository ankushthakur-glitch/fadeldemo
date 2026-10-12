/**
 * DEMO DATA for patient registration. Entirely invented — no real PHI, and
 * the payer names are fictional.
 *
 * Three lists, all driven by the registration workflow:
 *   BILLING_GROUPS  → "Assign billing group"
 *   PREFERRED_LABS  → "Pharmacy and preferred lab"
 *   ACCEPTED_PLANS  → "Plan accepted by practice?", the decision the
 *                     eligibility check on the Insurance tab answers
 */

export const BILLING_GROUPS = [
  'GastroEMR GI — Professional',
  'GastroEMR GI — Facility / ASC',
  'GastroEMR GI — Pathology',
  'GastroEMR GI — Anesthesia',
  'Self-pay / Time of service',
];

export const PREFERRED_LABS = [
  'GastroEMR GI in-house lab',
  'LabCorp — Fargo',
  'Quest Diagnostics — Moorhead',
  'Sanford Reference Lab',
  'Mayo Clinic Laboratories',
];

/**
 * Plans the practice contracts with. A carrier that is absent — or one the
 * registrar typed that matches nothing here — is NOT contracted, which is the
 * branch of the workflow where no booking can be taken.
 */
export const ACCEPTED_PLANS = [
  { carrier: 'Northern Plains Health Plan', accepted: true, network: 'In network' },
  { carrier: 'Prairie Mutual', accepted: true, network: 'In network' },
  { carrier: 'Great Lakes Choice', accepted: true, network: 'Out of network' },
  { carrier: 'Medicare Part B', accepted: true, network: 'In network' },
  { carrier: 'ND Medicaid Expansion', accepted: true, network: 'In network' },
  { carrier: 'Summit Bridge PPO', accepted: false, network: 'Not contracted' },
  { carrier: 'Cascade Value HMO', accepted: false, network: 'Not contracted' },
];

/**
 * THE DEMO REGISTRATION — what the Add Patient form opens already filled with.
 *
 * An empty form shows that the form exists; a filled one shows what it is for.
 * Somebody walking a stakeholder through registration wants to see a complete
 * record — the age worked out beside the date of birth, the race detail
 * unlocked by the race, a contracted carrier ready to check, a support person
 * and a pharmacy on file — not seventy blank boxes and a promise. So the form
 * opens on one invented adult patient, every field still editable, and Save
 * goes through because nothing required is left outstanding.
 *
 * NOT ON A LEAD CONVERSION. With ?lead= in the URL the form is a real
 * conversion of a real enquiry (js/screens/patient-add-lead.js), and a demo
 * address and insurer filled in around somebody else's name would be a record
 * of a person who does not exist. The fill is skipped there.
 *
 * Keyed by the field's data-testid, the same handle the tests use, so the
 * list reads as the form reads. Order matters in one place: a parent select
 * (Race, Ethnicity) is set before its detail, because choosing the parent is
 * what clears and unlocks the detail.
 *
 * Entirely invented. No real person.
 */
export const DEMO_REGISTRATION = [
  // Patient Basic Details
  ['add--prefix', 'Mr.'],
  ['add--first-name', 'Daniel'],
  ['add--middle-name', 'James'],
  ['add--last-name', 'Whitaker'],
  ['add--preferred-name', 'Dan'],
  ['add--dob', '1968-03-14'],
  ['add--birth-sex', 'Male'],
  ['add--ssn', '412-55-7810'],
  ['add--country', 'United States'],
  ['add--address1', '1420 Elm Street South'],
  ['add--address2', 'Apt 3B'],
  ['add--city', 'Fargo'],
  ['add--state', 'ND'],
  ['add--zip', '58103'],
  ['add--mobile', '(701) 555-0147'],
  ['add--home-phone', '(701) 555-0192'],
  ['add--work-phone', '(701) 555-0310'],
  ['add--email', 'daniel.whitaker@email.com'],
  ['add--contact-preference', 'Mobile phone'],
  ['add--preferred-lab', 'LabCorp — Fargo'],

  // Additional Details
  ['add--type', 'Outpatient'],
  ['add--nationality', 'United States'],
  ['add--marital-status', 'Married'],
  ['add--status', 'Active'],
  ['add--race', 'White'],
  ['add--race-details', 'European'],
  ['add--ethnicity', 'Not Hispanic or Latino'],
  ['add--language', 'English (en)'],
  ['add--sexual-orientation', 'Straight or heterosexual'],
  ['add--gender-identity', 'Male'],
  ['add--pronouns', 'he/him/his/his/himself'],
  ['add--sex-clinical', 'Apply male-typical setting or reference range'],

  // Information Sharing
  ['add--protect-data', 'No'],
  ['add--medication-history-import', 'Patient consents'],
  ['add--cahps', 'No'],

  // Insurance — a contracted carrier, so Check eligibility comes back green.
  ['add--coverage-order', 'Primary'],
  ['add--insurance-type', 'Commercial'],
  ['add--insurance-name', 'Northern Plains Health Plan'],
  ['add--member-id', 'NPH448210937'],
  ['add--group-number', 'GRP-20817'],
  ['add--effective-start', '2026-01-01'],
  ['add--effective-end', '2026-12-31'],
  ['add--relationship-to-insured', 'Self'],
  ['add--subscriber-first', 'Daniel'],
  ['add--subscriber-last', 'Whitaker'],
  ['add--subscriber-dob', '1968-03-14'],
  ['add--subscriber-sex', 'Male'],
];

/** The tick-boxes the demo record has ticked. */
export const DEMO_REGISTRATION_CHECKS = ['add--privacy-policy'];

/** Who is on file to ring — one person, both permissions granted. */
export const DEMO_SUPPORT_PERSONS = [
  {
    id: 'sp1',
    name: 'Linda Whitaker',
    relationship: 'Spouse',
    phone: '(701) 555-0148',
    email: 'linda.whitaker@email.com',
    emergency: true,
    hipaa: true,
  },
];

/** The pharmacy on file, by id from data/pharmacies.js. */
export const DEMO_PHARMACY_IDS = ['ph1'];
