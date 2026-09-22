/**
 * DEMO DATA — practice settings.
 * Names, numbers, NPIs and addresses are invented. No real records.
 */

export const WEEK_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/* ============================================================================
   PRACTICE PROFILES — the clinic and the ASC are two entities, not one.

   MediNova bills as two: a professional practice (office visits, CMS-1500,
   place of service 11) and an ambulatory surgery centre (facility claims,
   UB-04, place of service 24, its own CCN). They have different group NPIs,
   different opening hours, and they offer different appointment types —
   nobody books an annual wellness visit into an endoscopy suite.

   Modelling that as one practice record with a location list underneath it
   was the thing that did not survive contact: a Group NPI is a property of
   the BILLING ENTITY, and the ASC's is not the clinic's. So the profile is
   the unit, and a location belongs to one.

   WHICH ONE YOU ARE WORKING AS is a single app-wide choice, kept in
   localStorage so it survives the page loads between Settings, the Scheduler
   and Billing. `PRACTICE` below is the active profile — every screen that
   already read it keeps working and now follows the switch.
   ========================================================================= */

const clinicProfile = {
  id: 'clinic',
  label: 'Clinic',
  kind: 'Professional practice',
  name: 'GastroEMR Gastroenterology Clinic',
  type: 'Gastroenterology',
  npi: '2365987458',
  website: 'www.medinovagastro.example',
  phone: '(701) 555-0144',
  email: 'reception@medinovagastro.example',
  fax: '(701) 555-0145',
  ehrSystem: 'GastroEMR',
  contactPerson: 'Amara Mensah',
  placeOfService: 'Office (11)',
  timeZone: 'America/Chicago (CST)',
  physicalAddress: {
    line1: '25 Federal Plaza',
    line2: 'Suite 400',
    city: 'Fargo',
    state: 'ND',
    country: 'USA',
    zip: '58102',
  },
  billingAddress: {
    line1: '2678 East 875th Road',
    line2: '',
    city: 'Oglesby',
    state: 'ND',
    country: 'USA',
    zip: '61348',
  },
  information:
    'GastroEMR Gastroenterology is a specialist digestive health practice serving the Red River Valley. The team covers diagnostic endoscopy, IBD management, hepatology and an on-site infusion suite, supported by an ambulatory surgery centre.',
  officeHours: WEEK_DAYS.map((day) => ({
    day,
    open: day !== 'Sunday',
    from: '09:00',
    to: '17:00',
  })),
  billing: {
    billingType: 'Professional',
    claimForm: 'CMS-1500 (837P)',
    placeOfService: 'Office (11)',
    taxonomy: '207RG0100X — Gastroenterology',
    taxId: '45-2938107',
    ccn: null,
    clia: '34D2109887',
    feeSchedule: 'Medicare Physician Fee Schedule',
    acceptsAssignment: true,
  },
};

/*
 * The ASC's hours are the ones that actually differ in practice: procedure
 * lists start before the clinic opens and stop mid-afternoon, and the suites
 * are dark at the weekend. Copying the clinic's 09:00–17:00 here would have
 * made the whole feature look like a duplicate record.
 */
const ascProfile = {
  id: 'asc',
  label: 'ASC',
  kind: 'Ambulatory surgery centre',
  name: 'GastroEMR Gastroenterology ASC',
  type: 'Ambulatory Surgical Center',
  npi: '1215455217',
  website: 'www.medinovagastro.example/asc',
  phone: '(701) 356-1001',
  email: 'asc@medinovagastro.example',
  fax: '(701) 639-4550',
  ehrSystem: 'GastroEMR',
  contactPerson: 'Amara Mensah',
  placeOfService: 'Ambulatory Surgical Center (24)',
  timeZone: 'America/Chicago (CST)',
  physicalAddress: {
    line1: '5049 33rd Ave S',
    line2: '',
    city: 'Fargo',
    state: 'ND',
    country: 'USA',
    zip: '58104',
  },
  billingAddress: {
    line1: '2678 East 875th Road',
    line2: '',
    city: 'Oglesby',
    state: 'ND',
    country: 'USA',
    zip: '61348',
  },
  information:
    'GastroEMR Gastroenterology ASC is a Medicare-certified ambulatory surgery centre with four endoscopy suites. It bills as a facility, separately from the professional fee raised by the clinic for the same case.',
  officeHours: WEEK_DAYS.map((day) => ({
    day,
    open: !['Saturday', 'Sunday'].includes(day),
    from: '06:30',
    to: '15:00',
  })),
  billing: {
    billingType: 'Facility',
    claimForm: 'UB-04 (837I)',
    placeOfService: 'Ambulatory Surgical Center (24)',
    taxonomy: '261QA1903X — Ambulatory Surgical Center',
    taxId: '45-2938233',
    ccn: '351302',
    clia: null,
    feeSchedule: 'Medicare ASC Payment System (ASC PPS)',
    acceptsAssignment: true,
  },
};

export const PRACTICE_PROFILES = { clinic: clinicProfile, asc: ascProfile };

/** Switcher order. Clinic first: it is where most of the day happens. */
export const PRACTICE_PROFILE_IDS = ['clinic', 'asc'];

const ACTIVE_PROFILE_KEY = 'medinova.practiceProfile';

function storedProfileId() {
  try {
    const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return PRACTICE_PROFILES[saved] ? saved : 'clinic';
  } catch {
    // private mode, file:// restrictions — the choice simply does not persist
    return 'clinic';
  }
}

/*
 * `let`, not `const`, and that is the point.
 *
 * ES module exports are live bindings: reassigning these here updates every
 * screen that imported them, without a single one having to subscribe to
 * anything. Read them inside a render function (as every consumer does) and
 * you get the profile that is active at the moment of the paint.
 */
export let ACTIVE_PRACTICE_ID = storedProfileId();
export let PRACTICE = PRACTICE_PROFILES[ACTIVE_PRACTICE_ID];

/**
 * Switch the entity the whole app is working as.
 * @param {'clinic'|'asc'} id
 * @returns {object} the now-active profile
 */
export function setActivePracticeProfile(id) {
  if (!PRACTICE_PROFILES[id]) return PRACTICE;
  ACTIVE_PRACTICE_ID = id;
  PRACTICE = PRACTICE_PROFILES[id];
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch {
    /* the switch still works for this session */
  }
  return PRACTICE;
}

/* --- Locations ---------------------------------------------------------------
   Shape follows the gGastro Location Form: a business unit, a scheduling
   colour, place of service and teaching status, then the identifier block
   (NPI, CLIA, CCN and the registry IDs) that billing and reporting need.
   -------------------------------------------------------------------------- */

export const BUSINESS_UNITS = [
  'GastroEMR Gastroenterology ASC',
  'GastroEMR Gastroenterology LTD',
];

export const CONTACT_TYPES = ['Work', 'Fax', 'Mobile', 'After Hours'];

export const BILLING_TYPES = ['Facility', 'Professional'];

export const PLACES_OF_SERVICE = [
  'Office (11)',
  'Outpatient Hospital (22)',
  'Ambulatory Surgical Center (24)',
  'Telehealth (02)',
];

/** Colours a location can be given on the schedule. */
export const LOCATION_COLOURS = [
  '#339900', '#0b6cb5', '#8a2be2', '#c8641b', '#b3261e', '#00838f', '#6e655e',
];

/* --- The rest of the network -------------------------------------------------
   The four above are the sites the prototype's other screens book into, so they
   are written out in full — a location a scheduler can pick has to carry its
   real identifier block, and a generated CCN would put a plausible-looking
   number on a facility claim.

   Everything after them is an outreach clinic, an infusion chair or a satellite
   suite: a name, a place, a colour and a place of service. Those are the four
   facts the Locations table actually shows, and the ones a growing group adds
   twenty of in a year. They are built from the compact table below rather than
   written out as fifty forty-line literals, because forty lines of empty
   identifier fields repeated fifty times is a file nobody can read and nothing
   the screen can use.

   The identifier block is present but mostly empty on purpose. A satellite
   clinic that bills under the group's NPI has no NPI of its own, and seeding
   one would say the opposite.
   -------------------------------------------------------------------------- */

/** [id, name, city, state, zip, line1, placeOfService, unit, colour, description, active] */
const NETWORK_SITES = [
  ['ND41180', 'GastroEMR Gastroenterology LTD — West Fargo', 'West Fargo', '58078', '1201 Sheyenne St', 0, 1, 1, 'Satellite clinic — four consulting rooms.', true],
  ['ND41181', 'GastroEMR Gastroenterology LTD — South University', 'Fargo', '58103', '3232 University Dr S', 0, 1, 2, 'Clinic annexe shared with the dietetics team.', true],
  ['ND41182', 'Prairie Endoscopy Suite', 'Fargo', '58104', '4820 40th Ave S', 2, 0, 4, 'Two-room endoscopy suite, weekday lists only.', true],
  ['ND41183', 'Red River Infusion Centre — North', 'Fargo', '58102', '910 Broadway N', 1, 1, 3, 'Infusion suite, four chairs.', true],
  ['ND41184', 'GastroEMR Motility Laboratory', 'Fargo', '58103', '1717 University Dr S', 0, 1, 5, 'Manometry and pH studies.', true],
  ['ND41185', 'GastroEMR Capsule Reading Room', 'Fargo', '58103', '1717 University Dr S', 0, 1, 6, 'Reading room — no patient-facing sessions.', true],
  ['ND41186', 'Grand Forks Outreach Clinic', 'Grand Forks', '58201', '1450 S Columbia Rd', 0, 1, 2, 'Consultant outreach — alternate Tuesdays.', true],
  ['ND41187', 'Grand Forks Endoscopy Partnership', 'Grand Forks', '58201', '1200 S Columbia Rd', 2, 0, 4, 'Sessions bought at the host hospital.', true],
  ['ND41188', 'Devils Lake Outreach Clinic', 'Devils Lake', '58301', '1031 7th St NE', 0, 1, 2, 'Monthly hepatology outreach.', true],
  ['ND41189', 'Jamestown Outreach Clinic', 'Jamestown', '58401', '2422 20th St SW', 0, 1, 2, 'Monthly general GI outreach.', true],
  ['ND41190', 'Valley City Outreach Clinic', 'Valley City', '58072', '720 E Main St', 0, 1, 2, 'Quarterly outreach clinic.', false],
  ['ND41191', 'Wahpeton Outreach Clinic', 'Wahpeton', '58075', '275 4th St N', 0, 1, 2, 'Monthly outreach, shared rooms.', true],
  ['ND41192', 'Bismarck Consulting Rooms', 'Bismarck', '58501', '900 E Broadway Ave', 0, 1, 2, 'Two rooms, Wednesday and Friday.', true],
  ['ND41193', 'Bismarck Endoscopy Sessions', 'Bismarck', '58501', '310 N 9th St', 2, 0, 4, 'Purchased list time.', true],
  ['ND41194', 'Mandan Outreach Clinic', 'Mandan', '58554', '1000 18th St NW', 0, 1, 2, 'Fortnightly outreach.', false],
  ['ND41195', 'Minot Outreach Clinic', 'Minot', '58701', '2815 16th St SW', 0, 1, 2, 'Monthly outreach clinic.', true],
  ['ND41196', 'Minot Infusion Chairs', 'Minot', '58701', '2815 16th St SW', 1, 1, 3, 'Two chairs inside the host clinic.', true],
  ['ND41197', 'Williston Outreach Clinic', 'Williston', '58801', '1301 15th Ave W', 0, 1, 2, 'Quarterly outreach clinic.', false],
  ['ND41198', 'Dickinson Outreach Clinic', 'Dickinson', '58601', '2500 Fairway St', 0, 1, 2, 'Quarterly outreach clinic.', true],
  ['ND41199', 'Fargo Telehealth Studio A', 'Fargo', '58102', '25 Federal Plaza', 3, 1, 0, 'Telehealth room — clinic entity.', true],
  ['ND41200', 'Fargo Telehealth Studio B', 'Fargo', '58102', '25 Federal Plaza', 3, 1, 0, 'Telehealth room — overflow.', true],
  ['ND41201', 'GastroEMR Nurse Clinic — Fargo', 'Fargo', '58103', '1717 University Dr S', 0, 1, 5, 'Nurse-led follow-up and injections.', true],
  ['ND41202', 'GastroEMR Research Unit', 'Fargo', '58104', '5049 33rd Ave S', 0, 1, 6, 'Study visits and screening.', true],
  ['ND41203', 'GastroEMR Records Office', 'Fargo', '58102', '25 Federal Plaza', 0, 1, 6, 'Release of information — no clinical sessions.', true],
  ['ND41204', 'GastroEMR Billing Office', 'Oglesby', '61348', '2678 East 875th Road', 0, 1, 6, 'Back office — billing entity address.', true],
  ['MN51100', 'Moorhead Clinic — Main', 'Moorhead', '56560', '2810 Main Ave', 0, 1, 1, 'Full clinic, five rooms.', true],
  ['MN51101', 'Moorhead Infusion Suite', 'Moorhead', '56560', '2810 Main Ave', 1, 1, 3, 'Three chairs.', true],
  ['MN51102', 'Detroit Lakes Outreach Clinic', 'Detroit Lakes', '56501', '1027 Washington Ave', 0, 1, 2, 'Monthly outreach.', true],
  ['MN51103', 'Fergus Falls Outreach Clinic', 'Fergus Falls', '56537', '712 Cascade St S', 0, 1, 2, 'Monthly outreach.', true],
  ['MN51104', 'Bemidji Outreach Clinic', 'Bemidji', '56601', '1300 Anne St NW', 0, 1, 2, 'Quarterly outreach.', false],
  ['MN51105', 'Alexandria Outreach Clinic', 'Alexandria', '56308', '111 17th Ave E', 0, 1, 2, 'Quarterly outreach.', true],
  ['MN51106', 'Thief River Falls Outreach', 'Thief River Falls', '56701', '120 Labree Ave S', 0, 1, 2, 'Quarterly outreach.', false],
  ['MN51107', 'Crookston Outreach Clinic', 'Crookston', '56716', '323 S Minnesota St', 0, 1, 2, 'Quarterly outreach.', true],
  ['MN51108', 'East Grand Forks Nurse Clinic', 'East Grand Forks', '56721', '1401 Central Ave NW', 0, 1, 5, 'Nurse-led clinic, Thursdays.', true],
  ['MN51109', 'Wadena Outreach Clinic', 'Wadena', '56482', '415 Jefferson St N', 0, 1, 2, 'Quarterly outreach.', false],
  ['MN51110', 'Perham Outreach Clinic', 'Perham', '56573', '1000 Coney St W', 0, 1, 2, 'Quarterly outreach.', true],
  ['SD61100', 'Sioux Falls Consulting Rooms', 'Sioux Falls', '57105', '1000 E 23rd St', 0, 1, 2, 'Two rooms, monthly.', true],
  ['SD61101', 'Sioux Falls Endoscopy Sessions', 'Sioux Falls', '57105', '1000 E 23rd St', 2, 0, 4, 'Purchased list time.', true],
  ['SD61102', 'Aberdeen Outreach Clinic', 'Aberdeen', '57401', '1321 15th Ave NE', 0, 1, 2, 'Quarterly outreach.', true],
  ['SD61103', 'Watertown Outreach Clinic', 'Watertown', '57201', '401 9th Ave NW', 0, 1, 2, 'Quarterly outreach.', false],
  ['SD61104', 'Brookings Outreach Clinic', 'Brookings', '57006', '400 22nd Ave', 0, 1, 2, 'Quarterly outreach.', true],
  ['SD61105', 'Rapid City Outreach Clinic', 'Rapid City', '57701', '353 Fairmont Blvd', 0, 1, 2, 'Twice yearly outreach.', false],
  ['MT71100', 'Billings Outreach Clinic', 'Billings', '59101', '2825 8th Ave N', 0, 1, 2, 'Twice yearly outreach.', false],
  ['MT71101', 'Miles City Outreach Clinic', 'Miles City', '59301', '2600 Wilson St', 0, 1, 2, 'Twice yearly outreach.', false],
  ['ND41205', 'Fargo Mobile Screening Unit', 'Fargo', '58102', '25 Federal Plaza', 0, 1, 4, 'Mobile unit — screening events.', true],
  ['ND41206', 'GastroEMR Sedation Recovery Bay', 'Fargo', '58104', '5049 33rd Ave S', 2, 0, 3, 'Recovery bays attached to the ASC.', true],
  ['ND41207', 'GastroEMR Pre-Assessment Clinic', 'Fargo', '58104', '5049 33rd Ave S', 0, 0, 5, 'Pre-procedure assessment, ASC entity.', true],
  ['ND41208', 'GastroEMR Weekend Endoscopy List', 'Fargo', '58104', '5049 33rd Ave S', 2, 0, 4, 'Saturday lists, seasonal.', false],
];

const STATE_NAMES = { ND: 'North Dakota', MN: 'Minnesota', SD: 'South Dakota', MT: 'Montana' };

/**
 * Fill the compact table above out into the full location record.
 *
 * Everything the table does not carry gets the empty value the form would
 * write, not a plausible-looking invention — see the note above about
 * identifiers.
 */
function networkSites() {
  return NETWORK_SITES.map(([id, name, city, zip, line1, posIndex, unitIndex, colourIndex, description, active]) => ({
    id,
    name,
    businessUnit: BUSINESS_UNITS[unitIndex],
    colour: LOCATION_COLOURS[colourIndex],
    description,
    active,
    placeOfService: PLACES_OF_SERVICE[posIndex],
    directAddress: '',
    outsideLab: false,
    taxRate: '0.00',
    contactPerson: { first: '', middle: '', last: '' },
    address: { line1, line2: '', city, state: STATE_NAMES[id.slice(0, 2)], zip },
    facilityName: '',
    contactNumbers: [],
    billingTypes: [],
    costCentres: [],
    ids: {
      locationNpi: '', clia: '', stateId: '',
      immunizationRegistryId: '', immunizationLocationId: '', syndromicSurveillanceId: '',
      externalErxLocationId: '', id340b: '', cahpsId: '', ccn: '', ccnName: '',
    },
  }));
}

export const LOCATIONS = [
  {
    id: 'ND34792',
    name: 'GastroEMR Gastroenterology ASC',
    businessUnit: 'GastroEMR Gastroenterology ASC',
    colour: '#339900',
    description: 'Ambulatory surgery centre — endoscopy suites 1 to 4.',
    active: true,
    placeOfService: 'Ambulatory Surgical Center (24)',
    directAddress: 'asc@direct.medinovagastro.example',
    outsideLab: false,
    taxRate: '0.00',
    contactPerson: { first: 'Amara', middle: 'K', last: 'Mensah' },
    address: { line1: '5049 33rd Ave S', line2: '', city: 'Fargo', state: 'North Dakota', zip: '58104-7080' },
    facilityName: 'GastroEMR Gastroenterology ASC',
    contactNumbers: [
      { type: 'Fax', number: '(701) 639-4550' },
      { type: 'Work', number: '(701) 356-1001' },
    ],
    billingTypes: [
      { unit: 'GastroEMR Gastroenterology ASC', type: 'Facility' },
      { unit: 'GastroEMR Gastroenterology LTD', type: 'Professional' },
    ],
    costCentres: [{ name: 'Endoscopy', effective: '01-01-2026', expiration: '' }],
    ids: {
      locationNpi: '1215455217',
      clia: '34D2109887',
      stateId: 'ND-ASC-4471',
      immunizationRegistryId: '',
      immunizationLocationId: '',
      syndromicSurveillanceId: '',
      externalErxLocationId: '',
      id340b: '',
      cahpsId: '',
      ccn: '351302',
      ccnName: 'GastroEMR Gastroenterology ASC',
    },
  },
  {
    id: 'ND65258',
    name: 'GastroEMR Gastroenterology LTD — Fargo',
    businessUnit: 'GastroEMR Gastroenterology LTD',
    colour: '#0b6cb5',
    description: 'Main outpatient clinic.',
    active: true,
    placeOfService: 'Office (11)',
    directAddress: 'clinic@direct.medinovagastro.example',
    outsideLab: true,
    taxRate: '0.00',
    contactPerson: { first: 'Lucas', middle: '', last: 'Thomas' },
    address: { line1: '25 Federal Plaza', line2: 'Suite 400', city: 'Fargo', state: 'North Dakota', zip: '58102' },
    facilityName: 'GastroEMR Gastroenterology LTD',
    contactNumbers: [{ type: 'Work', number: '(701) 555-0113' }],
    billingTypes: [{ unit: 'GastroEMR Gastroenterology LTD', type: 'Professional' }],
    costCentres: [],
    ids: {
      locationNpi: '1477889201',
      clia: '',
      stateId: 'ND-CL-1180',
      immunizationRegistryId: 'NDIIS-4420',
      immunizationLocationId: '',
      syndromicSurveillanceId: '',
      externalErxLocationId: 'ERX-88120',
      id340b: '',
      cahpsId: '',
      ccn: '',
      ccnName: '',
    },
  },
  {
    id: 'ND62423',
    name: 'Red River Infusion Centre',
    businessUnit: 'GastroEMR Gastroenterology LTD',
    colour: '#00838f',
    description: 'Infusion suite, eight chairs.',
    active: true,
    placeOfService: 'Outpatient Hospital (22)',
    directAddress: '',
    outsideLab: false,
    taxRate: '0.00',
    contactPerson: { first: 'Sophia', middle: '', last: 'Wilson' },
    address: { line1: '4140 Parker Rd', line2: 'Building C', city: 'Fargo', state: 'North Dakota', zip: '58104' },
    facilityName: 'Red River Infusion Centre',
    contactNumbers: [{ type: 'Work', number: '(701) 555-0124' }],
    billingTypes: [{ unit: 'GastroEMR Gastroenterology LTD', type: 'Facility' }],
    costCentres: [],
    ids: {
      locationNpi: '1093822417',
      clia: '', stateId: '', immunizationRegistryId: '',
      immunizationLocationId: '', syndromicSurveillanceId: '', externalErxLocationId: '',
      id340b: '340B-2211', cahpsId: '', ccn: '', ccnName: '',
    },
  },
  {
    id: 'MN35355',
    name: 'Moorhead Annexe',
    businessUnit: 'GastroEMR Gastroenterology LTD',
    colour: '#6e655e',
    description: 'Hepatology outreach clinic — Thursdays only.',
    active: false,
    placeOfService: 'Office (11)',
    directAddress: '',
    outsideLab: false,
    taxRate: '0.00',
    contactPerson: { first: 'Mia', middle: '', last: 'Jackson' },
    address: { line1: '1901 Thornridge Circle', line2: '', city: 'Moorhead', state: 'Minnesota', zip: '56560' },
    facilityName: '',
    contactNumbers: [{ type: 'Work', number: '(218) 555-0107' }],
    billingTypes: [],
    costCentres: [],
    ids: {
      locationNpi: '', clia: '', stateId: '',
      immunizationRegistryId: '', immunizationLocationId: '', syndromicSurveillanceId: '',
      externalErxLocationId: '', id340b: '', cahpsId: '', ccn: '', ccnName: '',
    },
  },
  ...networkSites(),
];

/** The identifier block, in the order the legacy form lists it. */
export const LOCATION_ID_FIELDS = [
  ['locationNpi', 'Location NPI'],
  ['clia', 'CLIA Number'],
  ['stateId', 'State ID'],
  ['immunizationRegistryId', 'Immunization Registry ID'],
  ['immunizationLocationId', 'Immunization Location ID'],
  ['syndromicSurveillanceId', 'Syndromic Surveillance ID'],
  ['externalErxLocationId', 'External eRX Location ID'],
  ['id340b', '340B Location ID'],
  ['cahpsId', 'CAHPS ID'],
  ['ccn', 'CCN'],
  ['ccnName', 'CCN Name'],
];

/** The role set the LEGACY single-page user form (user-add.html) still uses.
 *  Kept exactly as-is — that form and its tests are untouched by the table
 *  redesign below. Every user record also carries a `role` from the newer,
 *  granular PROVIDER_ROLES / STAFF_ROLES vocabulary the table filters by;
 *  the two do not line up one-to-one, which is why they are separate lists
 *  rather than one renamed in place. */
export const USER_ROLES = [
  'Administrator-Superuser',
  'Billing',
  'Clinical',
  'Front Desk',
  'Physician-Superuser',
  'Provider',
];

/* ===========================================================================
   Practice ▸ Users — enterprise directory.

   Two entity TYPES share one table: Provider (clinical, has its own
   not-yet-built onboarding flow) and User (everyone else). Type is a
   column of its own, separate from the granular Role beneath it, because
   "who can I message a lab result to" and "who can I task with a billing
   question" are different questions a scanner asks.
   ========================================================================= */

export const USER_TYPES = ['Provider', 'User'];

/**
 * WHAT KIND OF STAFF MEMBER, on the provider onboarding form.
 *
 * Not USER_TYPES. That list has two entries — Provider and User — and it
 * answers a different question: whether an account belongs to somebody who
 * treats patients or to somebody who works the desk. It is what the Users
 * table's Type column filters on, and widening it would have put nine clinical
 * job families into a filter whose whole job is that binary split.
 *
 * This is the provider form's own list, and it is the practice's roster of who
 * turns up: a physician, a transcriptionist and a scope technician are three
 * different kinds of person with three different reaches into a chart, and
 * until now the form could only call all three "Provider".
 *
 * The four clinicians a GI group actually credentials and bills under —
 * Physician, CRNA, Physician Assistant and Nurse Practitioner — sit at the
 * top, because they are what this form is asked for most and a list that
 * buries them under "Administrative Personnel" is a list people scroll past.
 * Physician Assistant is spelt out rather than abbreviated to "PA" so it reads
 * the way every other entry here does; the abbreviation belongs on the
 * credential, which is PROVIDER_TITLES' job, not this list's.
 *
 * Anesthesiologist and Radiologist are deliberately absent. Neither is a kind
 * of person this practice onboards — sedation on this roster is a CRNA's job,
 * and imaging is read somewhere else and arrives as a result — and a type
 * nobody in the building can honestly pick is a type somebody eventually picks
 * by accident. The granular Role vocabulary further down still carries both,
 * and should: a role describes what a person does inside a chart, and the ASC
 * does host an anaesthesiologist who never gets an account of their own.
 *
 * "Other" is last and is real. A practice hires people this list has not
 * imagined, and a form with no way to say so gets the nearest wrong answer.
 */
export const PROVIDER_TYPES = [
  'Physician',
  'CRNA',
  'Physician Assistant',
  'Nurse Practitioner',
  'Provider',
  'Administrative Personnel',
  'Nurse',
  'Medical Assistant',
  'Technician',
  'Transcriptionist',
  'Other',
];

/**
 * The credential that goes after a clinician's name.
 *
 * Typed free-hand until now, which is how one practice ends up holding "MD",
 * "M.D.", "M.D" and "md" for four people doing the same job — and the title is
 * not decoration: it prints on the letterhead, on the prescription and on the
 * claim, where a payer matches it.
 *
 * Some entries carry a comma of their own ("APRN, CNP"), so this list must be
 * handed to a picker as data — the `options` attribute splits on commas and
 * would turn that one credential into two.
 */
export const PROVIDER_TITLES = [
  'APRN',
  'APRN, CNM',
  'APRN, CNP',
  'CFNP',
  'CPA',
  'CRNA',
  'DC',
  'DDS',
  'DMD',
  'DNP-FNP',
  'DO',
  'FNP-C',
  'MA',
  'MBA',
  'MD',
  'MS',
  'MSN',
  'ND',
  'NP',
  'OD',
  'PA',
  'PhD',
  'RN',
  'RPA',
];

/* --- The provider record's repeatable groups ---------------------------------
   A provider has any number of addresses, phone numbers, emails, working
   locations and identifiers — a locum with three sites and two NPIs is
   ordinary. So each of those is a LIST that grows, not a fixed pair of fields,
   and every row carries its own type. Fixed slots are how the second office
   phone ends up in the notes field.

   Lives here rather than in the onboarding screen because two screens now
   read it: Practice ▸ Users builds the form from it, and Provider Settings ▸
   Profile reads a saved provider back out of it. One definition, so the form
   and the profile cannot drift into disagreeing about what a provider is.
   -------------------------------------------------------------------------- */
export const PROVIDER_GROUPS = [
  {
    id: 'addresses',
    title: 'Addresses',
    types: ['Home', 'Work', 'Billing', 'Mailing'],
    fields: [{ key: 'value', label: 'Address', width: 'wide' }],
  },
  {
    id: 'phones',
    title: 'Contact numbers',
    types: ['Mobile', 'Office', 'Home', 'Pager', 'Fax'],
    fields: [{ key: 'value', label: 'Contact number' }],
  },
  {
    id: 'emails',
    title: 'Emails',
    types: ['Work', 'Personal', 'Billing'],
    fields: [{ key: 'value', label: 'Email', type: 'email' }],
  },
  {
    /* ONE MULTI-SELECT, NOT A GROWING LIST OF SINGLE PICKERS.
       Working at three sites meant three "+" presses and three dropdowns, each
       of which could be left blank or set to a site already chosen above it —
       and nothing stopped either. Which locations somebody works at is one
       question with a set of answers, which is exactly what <ui-select
       multiple> is for: a panel of tick boxes, every site listed once, and the
       closed field reading back everything ticked. */
    id: 'locations',
    title: 'Locations',
    types: [],
    multiple: true,
    fields: [{ key: 'value', label: 'Location', kind: 'location' }],
  },
  {
    /* THE NUMBERS A CLINICIAN IS KNOWN BY, and there are more of them than a
       fixed pair of NPI and DEA boxes could hold — which is why those two came
       off the single-value block above and joined this list. A locum carries
       two NPIs; a practice submitting to a state registry carries an
       immunization ID that looks like nothing else here; a controlled-substance
       prescriber in a mid-level role carries a NADEAN alongside a DEA. Each is
       a number with a kind, so each is a row.

       The vocabulary is the one the clearing house and the registries use,
       abbreviations and all — "MCD" and "MCR" are how Medicaid and Medicare
       provider numbers are labelled on the forms these are copied off, and
       renaming them here to something more readable would mean the person
       transcribing has to translate. */
    id: 'identifications',
    title: 'Identifications',
    types: [
      'NPI',
      'Lic#.',
      'DEA',
      'MCD',
      'MCR',
      'UPIN',
      'CTP',
      'Immunization Registry ID',
      'Syndromic Surveillance ID',
      'Staff ID',
      'NADEAN',
      'Other',
    ],
    fields: [{ key: 'value', label: 'Identification' }],
  },
  {
    /* A LICENCE IS NOT JUST ANOTHER NUMBER, which is why it is not a row in
       the list above. The identifiers up there answer "which number is this
       clinician known by"; a licence answers "is this clinician allowed to
       practise, where, and until when" — and that last part is a date the
       practice has to act on. A licence that lapsed in March is a licence the
       roster has to notice in February, and a bare "Lic#. ND-MD-14472" with
       nowhere to record the expiry cannot be noticed at all: it reads exactly
       the same on the day it is valid and the day it is not.

       So each row is the whole licence — the taxonomy code the payer uses to
       decide what this person may bill for, the number the state board
       issued, and the two dates that bound it. Four answers to one question,
       which is why this group renders its fields as a small labelled block
       rather than the single typed row the contact groups use.

       Taxonomy sits here rather than beside Specialty on the left because it
       travels with the licence: a clinician licensed in two states under two
       taxonomies has two rows, and a taxonomy asked for once on the record
       above would have had to pick one of them. */
    id: 'licenses',
    title: 'Licenses',
    types: [],
    fields: [
      { key: 'taxonomy', label: 'Taxonomy number' },
      { key: 'value', label: 'License number' },
      { key: 'start', label: 'Start date', type: 'date' },
      { key: 'end', label: 'End date', type: 'date' },
    ],
  },
];

/** The single-value fields of the provider record, in the order the
 *  onboarding form asks for them. Each carries where its options come from,
 *  so the profile can render a saved value and the form can offer the list
 *  without the two keeping separate copies. */
export const PROVIDER_FIELDS = [
  { key: 'prefix', label: 'Prefix', options: ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Mx.'] },
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'middleName', label: 'Middle Name' },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'suffix', label: 'Suffix', options: ['MD', 'DO', 'NP', 'PA-C', 'RN', 'LCSW', 'RD', 'PhD'] },
  { key: 'title', label: 'Title', options: PROVIDER_TITLES },
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  {
    key: 'gender',
    label: 'Gender',
    options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'],
  },
  { key: 'type', label: 'Type', options: PROVIDER_TYPES },
  { key: 'specialty', label: 'Specialty', optionsFrom: 'specialty' },
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
  /* NO npi / dea HERE. They were two single-value boxes in Additional info,
     beside the date of birth — and a clinician does not have one NPI any more
     than they have one address: a locum carries one per group they cover for.
     Both are kinds of identification, and Identifications is a list that grows
     (see PROVIDER_GROUPS), so that is where they are asked for and where the
     second one can be recorded. Two places to put an NPI is how a claim goes
     out under the wrong one. */
];

/* The clinical vocabulary, long enough to be the real one.
   A GI group that runs its own ASC does not employ eight kinds of clinician —
   it employs a procedure nurse, a recovery nurse and a triage nurse who are
   three different jobs with three different reaches into the chart, and an
   endoscopy technician who has none. Collapsing them into "RN" is what makes a
   permissions screen useless: everybody ends up in the one role that can do
   the most. */
export const PROVIDER_ROLES = [
  'Physician',
  'Hepatologist',
  'Advanced Endoscopist',
  'Fellow',
  'Resident',
  'Nurse Practitioner',
  'Physician Assistant',
  'Anesthesiologist',
  'CRNA',
  'Anesthesia Technician',
  'RN',
  'LPN',
  'Procedure Nurse',
  'Recovery Nurse',
  'Triage Nurse',
  'Infusion Nurse',
  'Endoscopy Technician',
  'Medical Assistant',
  'Clinical Pharmacist',
  'Dietician',
  'Behavioral Health Provider',
  'Genetic Counselor',
  'Radiologic Technologist',
  'Sonographer',
  'Phlebotomist',
  'Research Coordinator',
];

export const STAFF_ROLES = [
  'Practice Administrator',
  'Operations Manager',
  'Clinic Supervisor',
  'Front Desk',
  'Receptionist',
  'Scheduler',
  'Call Center',
  'Patient Access Specialist',
  'Referral Coordinator',
  'Prior Authorization Specialist',
  'Insurance Verifier',
  'Billing Staff',
  'Coding Specialist',
  'Charge Entry Clerk',
  'Payment Poster',
  'Denials Analyst',
  'Collections Specialist',
  'Revenue Cycle Manager',
  'Finance',
  'Medical Records',
  'Health Information Technician',
  'Transcriptionist',
  'Compliance Officer',
  'Privacy Officer',
  'Quality Coordinator',
  'Infection Control Coordinator',
  'Credentialing Specialist',
  'Human Resources',
  'Marketing Coordinator',
  'Materials Manager',
  'Inventory Clerk',
  'Facilities Coordinator',
  'IT Administrator',
  'Systems Analyst',
  'Help Desk Technician',
  'Data Analyst',
];

/*
 * Every role's home department.
 *
 * The Users table used to show Role and Department side by side, and this map
 * existed so the two columns agreed with each other on every generated row.
 * Department is no longer asked for or shown anywhere (RM-047) — the practice
 * is a single entity and the answer was always implied by the job title — but
 * the map is not dead with it. Permissions are granted by department, and a
 * role still names one; the map is now the step between the question the form
 * asks and the grant the answer earns. See permissionsForRole() below.
 */
const ROLE_DEPARTMENT = {
  /* --- Clinical --- */
  Physician: 'Clinical', Hepatologist: 'Clinical', 'Advanced Endoscopist': 'Clinical',
  Fellow: 'Clinical', Resident: 'Clinical', 'Nurse Practitioner': 'Clinical',
  'Physician Assistant': 'Clinical', RN: 'Clinical', LPN: 'Clinical',
  'Procedure Nurse': 'Clinical', 'Recovery Nurse': 'Clinical', 'Triage Nurse': 'Clinical',
  'Infusion Nurse': 'Clinical', 'Endoscopy Technician': 'Clinical', 'Medical Assistant': 'Clinical',
  Dietician: 'Clinical', 'Behavioral Health Provider': 'Clinical', 'Genetic Counselor': 'Clinical',
  'Radiologic Technologist': 'Clinical', Sonographer: 'Clinical', Phlebotomist: 'Clinical',
  'Research Coordinator': 'Clinical',
  /* --- Anesthesia and pharmacy sit apart from the rest of Clinical: both are
     answerable to their own leads and both are asked for as a group. --- */
  Anesthesiologist: 'Anesthesia', CRNA: 'Anesthesia', 'Anesthesia Technician': 'Anesthesia',
  'Clinical Pharmacist': 'Pharmacy',
  /* --- Front office --- */
  'Front Desk': 'Front Office', Receptionist: 'Front Office', Scheduler: 'Front Office',
  'Call Center': 'Front Office', 'Patient Access Specialist': 'Front Office',
  /* --- Referrals and authorisation --- */
  'Referral Coordinator': 'Referrals', 'Prior Authorization Specialist': 'Referrals',
  'Insurance Verifier': 'Referrals',
  /* --- Revenue cycle --- */
  'Billing Staff': 'Billing', 'Coding Specialist': 'Billing', 'Charge Entry Clerk': 'Billing',
  'Payment Poster': 'Billing', 'Denials Analyst': 'Billing', 'Collections Specialist': 'Billing',
  'Revenue Cycle Manager': 'Finance', Finance: 'Finance',
  /* --- Records --- */
  'Medical Records': 'Medical Records', 'Health Information Technician': 'Medical Records',
  Transcriptionist: 'Medical Records',
  /* --- Oversight --- */
  'Practice Administrator': 'Administration', 'Operations Manager': 'Operations',
  'Clinic Supervisor': 'Operations', 'Facilities Coordinator': 'Operations',
  'Compliance Officer': 'Quality and Compliance', 'Privacy Officer': 'Quality and Compliance',
  'Quality Coordinator': 'Quality and Compliance',
  'Infection Control Coordinator': 'Quality and Compliance',
  'Credentialing Specialist': 'Human Resources', 'Human Resources': 'Human Resources',
  'Marketing Coordinator': 'Administration',
  /* --- Stock and systems --- */
  'Materials Manager': 'Materials', 'Inventory Clerk': 'Materials',
  'IT Administrator': 'IT', 'Systems Analyst': 'IT', 'Help Desk Technician': 'IT',
  'Data Analyst': 'IT',
};

/** A department's default permission grant — assigned by department so
 *  "who can touch billing" stays answerable without opening every profile. */
export const DEPARTMENT_PERMISSIONS = {
  Clinical: ['View Patients', 'Edit Patients', 'View Schedule'],
  Anesthesia: ['View Patients', 'Edit Patients', 'View Schedule'],
  Pharmacy: ['View Patients', 'Edit Patients'],
  Billing: ['View Billing', 'Edit Billing'],
  'Front Office': ['View Patients', 'View Schedule', 'Manage Schedule'],
  Administration: ['View Patients', 'Manage Users', 'Administer Settings'],
  Operations: ['View Patients', 'View Schedule', 'Manage Schedule', 'Manage Users'],
  IT: ['Manage Users', 'Administer Settings'],
  Referrals: ['View Patients', 'View Schedule'],
  'Medical Records': ['View Patients'],
  Finance: ['View Billing'],
  'Quality and Compliance': ['View Patients', 'View Billing', 'Administer Settings'],
  'Human Resources': ['Manage Users'],
  Materials: ['Administer Settings'],
};

/**
 * The permissions a role earns, by way of the department that role belongs to.
 *
 * This is the composition the fixtures below already performed inline, lifted
 * out and exported because the Add User drawer now needs it too. Department
 * left that form (RM-047), and a new user's grant used to be looked up from
 * the department they were assigned; asking for a role and deriving the
 * department from it reaches the same grant without the second question.
 *
 * An unmapped role yields an empty list, which is the honest answer — a job
 * title nobody has placed in a department has not earned anything yet — and
 * the drawer says so rather than creating the user silently unable to open
 * anything.
 */
export function permissionsForRole(role) {
  return DEPARTMENT_PERMISSIONS[ROLE_DEPARTMENT[role]] ?? [];
}

export const USER_PERMISSIONS = [
  'View Patients',
  'Edit Patients',
  'View Schedule',
  'Manage Schedule',
  'View Billing',
  'Edit Billing',
  'Manage Users',
  'Administer Settings',
];

export const USER_STATUS = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  pending: { label: 'Pending Invitation', tone: 'warning' },
  locked: { label: 'Locked', tone: 'critical' },
  suspended: { label: 'Suspended', tone: 'critical' },
};

/** Role → tone for the Role column's pill, grouped by what the role can
 *  reach rather than by severity — the same idea the old USER_ROLE_TONE
 *  used, re-keyed to the granular roles above. */
export const USER_ROLE_TONE = {
  /* Signs and prescribes. */
  Physician: 'brand', Hepatologist: 'brand', 'Advanced Endoscopist': 'brand',
  'Nurse Practitioner': 'brand', 'Physician Assistant': 'brand', Anesthesiologist: 'brand',
  CRNA: 'brand', Fellow: 'brand', Resident: 'brand',
  /* Works in the chart without signing it. */
  RN: 'info', LPN: 'info', 'Procedure Nurse': 'info', 'Recovery Nurse': 'info',
  'Triage Nurse': 'info', 'Infusion Nurse': 'info', 'Medical Assistant': 'info',
  'Endoscopy Technician': 'info', 'Anesthesia Technician': 'info', 'Clinical Pharmacist': 'info',
  Dietician: 'info', 'Behavioral Health Provider': 'info', 'Genetic Counselor': 'info',
  'Radiologic Technologist': 'info', Sonographer: 'info', Phlebotomist: 'info',
  'Research Coordinator': 'info',
  /* Can reach settings, users or the audit log. */
  'Practice Administrator': 'critical', 'Operations Manager': 'critical',
  'IT Administrator': 'critical', 'Systems Analyst': 'critical',
  'Compliance Officer': 'critical', 'Privacy Officer': 'critical',
  /* Touches money. */
  'Billing Staff': 'warning', 'Coding Specialist': 'warning', 'Charge Entry Clerk': 'warning',
  'Payment Poster': 'warning', 'Denials Analyst': 'warning', 'Collections Specialist': 'warning',
  'Revenue Cycle Manager': 'warning', Finance: 'warning',
  'Prior Authorization Specialist': 'warning', 'Insurance Verifier': 'warning',
  /* Everyone else. */
  'Front Desk': 'neutral', Scheduler: 'neutral', Receptionist: 'neutral', 'Call Center': 'neutral',
  'Patient Access Specialist': 'neutral', 'Referral Coordinator': 'neutral',
  'Medical Records': 'neutral', 'Health Information Technician': 'neutral',
  Transcriptionist: 'neutral', 'Quality Coordinator': 'neutral',
  'Infection Control Coordinator': 'neutral', 'Credentialing Specialist': 'neutral',
  'Human Resources': 'neutral', 'Marketing Coordinator': 'neutral', 'Clinic Supervisor': 'neutral',
  'Materials Manager': 'neutral', 'Inventory Clerk': 'neutral', 'Facilities Coordinator': 'neutral',
  'Help Desk Technician': 'neutral', 'Data Analyst': 'neutral',
};

const CREATED_BY = ['Amara Mensah', 'Lucas Thomas', 'System Import'];

/** Eight names carried over from the original directory, remapped onto the
 *  new Type/Role/Department shape rather than replaced — the id, name,
 *  email, phone and last-login stay exactly what they were. */
const CURATED_USERS = [
  { id: 'u1', firstName: 'Andres', lastName: 'Hurley', type: 'User', role: 'Billing Staff', status: 'pending', lastLogin: null, phone: '(701) 555-0183', email: 'a.hurley@example.com', username: 'ahurley' },
  { id: 'u2', firstName: 'Esther', lastName: 'Howard', type: 'Provider', role: 'RN', status: 'active', lastLogin: '20 Dec 2025 at 02:25 PM', phone: '(701) 555-0198', email: 'e.howard@example.com', username: 'ehoward' },
  { id: 'u3', firstName: 'Arlene', lastName: 'McCoy', type: 'Provider', role: 'Physician', status: 'active', lastLogin: '20 Dec 2025 at 02:25 PM', phone: '(701) 555-0198', email: 'a.mccoy@example.com', username: 'amccoy' },
  { id: 'u4', firstName: 'Savannah', lastName: 'Nguyen', type: 'Provider', role: 'Nurse Practitioner', status: 'pending', lastLogin: null, phone: '(701) 555-0198', email: 's.nguyen@example.com', username: 'snguyen' },
  { id: 'u5', firstName: 'Eduardo', lastName: 'Mcguire', type: 'Provider', role: 'Physician Assistant', status: 'active', lastLogin: '20 Dec 2025 at 02:25 PM', phone: '(701) 555-0198', email: 'e.mcguire@example.com', username: 'emcguire' },
  { id: 'u6', firstName: 'Jacque', lastName: 'Andrews', type: 'User', role: 'Billing Staff', status: 'active', lastLogin: '20 Dec 2025 at 02:25 PM', phone: '(701) 555-0198', email: 'j.andrews@example.com', username: 'jandrews' },
  { id: 'u7', firstName: 'Adrienne', lastName: 'Warner', type: 'Provider', role: 'Medical Assistant', status: 'pending', lastLogin: null, phone: '(701) 555-0198', email: 'a.warner@example.com', username: 'awarner' },
  { id: 'u8', firstName: 'Ryan', lastName: 'Weste', type: 'User', role: 'Front Desk', status: 'active', lastLogin: '20 Dec 2025 at 02:25 PM', phone: '(701) 555-0183', email: 'r.weste@example.com', username: 'rweste' },
];

const GEN_FIRST = [
  'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Elijah', 'Sophia', 'Lucas', 'Isabella', 'Mason',
  'Mia', 'Ethan', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
  'Emily', 'Daniel', 'Elizabeth', 'Matthew', 'Grace', 'Henry', 'Chloe', 'Samuel',
];
const GEN_LAST = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson',
  'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Walker', 'Young', 'Allen',
];

/** A spread of real-looking timestamps, cycled by index. Not exhaustive —
 *  the point is variety for sorting and the Last Login filter, not a
 *  unique value per row. */
const LOGIN_TIMES = [
  '02 Feb 2026 at 08:41 AM', '01 Feb 2026 at 04:12 PM', '30 Jan 2026 at 11:05 AM',
  '28 Jan 2026 at 09:30 AM', '22 Jan 2026 at 03:47 PM', '15 Jan 2026 at 01:15 PM',
  '02 Jan 2026 at 10:00 AM', '20 Dec 2025 at 02:25 PM', '05 Dec 2025 at 05:50 PM',
  '18 Nov 2025 at 08:05 AM',
];

const STATUS_CYCLE = [
  'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active',
  'pending', 'inactive', 'locked', 'suspended',
];

/**
 * ~150 rows total (eight curated above plus these) — enough to make
 * pagination, sorting and every filter combination genuinely exercise the
 * table, the way "hundreds of users" does in practice, without hand-typing
 * a hundred and forty near-identical literals. Deterministic throughout —
 * no Math.random(), no Date.now() — so a screenshot taken today looks the
 * same next month.
 */
function generateUsers(count) {
  const providerRoles = PROVIDER_ROLES;
  const staffRoles = STAFF_ROLES;
  const locations = LOCATIONS.map((l) => l.name);
  const rows = [];

  /*
   * Roles are dealt from counters of their own, not from `i`.
   *
   * Every third row is a Provider, so indexing the staff list by `i` only ever
   * reaches staff roles whose position is 1 or 2 mod 3 — with a 36-role staff
   * vocabulary that silently left a third of it, Front Desk and Coding
   * Specialist among them, on nobody at all. A counter per list deals every
   * role in turn regardless of how the Provider/User rhythm falls.
   */
  let providerSeen = 0;
  let staffSeen = 0;

  for (let i = 0; i < count; i += 1) {
    const first = GEN_FIRST[i % GEN_FIRST.length];
    // A second cycle length coprime with the first keeps first/last pairs
    // from repeating in lockstep before the full count is reached.
    const last = GEN_LAST[(i * 5 + 3) % GEN_LAST.length];
    const isProvider = i % 3 === 0;
    const role = isProvider
      ? providerRoles[providerSeen++ % providerRoles.length]
      : staffRoles[staffSeen++ % staffRoles.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const id = `u${9 + i}`;

    rows.push({
      id,
      firstName: first,
      lastName: last,
      type: isProvider ? 'Provider' : 'User',
      role,
      location: locations[i % locations.length],
      email: `${first[0].toLowerCase()}.${last.toLowerCase()}${9 + i}@example.com`,
      phone: `(701) 555-0${String(200 + i).padStart(3, '0')}`,
      username: `${first[0]}${last}${9 + i}`.toLowerCase(),
      status,
      // A pending invitation has never been signed into; a handful of the
      // rest have not logged in recently enough to have a login on file.
      lastLogin: status === 'pending' || i % 15 === 0 ? null : LOGIN_TIMES[i % LOGIN_TIMES.length],
      createdBy: CREATED_BY[i % CREATED_BY.length],
      permissions: permissionsForRole(role),
    });
  }

  return rows;
}

export const USERS = [
  ...CURATED_USERS.map((u) => ({
    ...u,
    name: `${u.firstName} ${u.lastName}`,
    location: LOCATIONS[0].name,
    createdBy: 'Amara Mensah',
    permissions: permissionsForRole(u.role),
  })),
  ...generateUsers(142).map((u) => ({ ...u, name: `${u.firstName} ${u.lastName}` })),
];

/** Sign-in requirement for locking and signing service documents. */
export const AUTH_MODES = [
  { value: 'pin', label: 'Require a Sign PIN' },
  { value: 'none', label: 'Authentication not required' },
  { value: 'org', label: 'Use Organization Preference' },
];

/* A group is a list you can address or grant as one — a task queue, a
   distribution list, a permission grant. Fifty of them is what a practice ends
   up with once every clinic, every site and every committee has one. */
export const USER_GROUPS = [
  { name: 'Endoscopy team', users: 12 },
  { name: 'Billing office', users: 5 },
  { name: 'Front desk', users: 8 },
  { name: 'On-call providers', users: 6 },
  { name: 'ASC nursing', users: 14 },
  { name: 'ASC recovery', users: 9 },
  { name: 'Anaesthesia team', users: 7 },
  { name: 'Procedure technicians', users: 6 },
  { name: 'Reprocessing team', users: 5 },
  { name: 'IBD clinic', users: 8 },
  { name: 'Hepatology clinic', users: 6 },
  { name: 'Motility service', users: 4 },
  { name: 'Capsule reading', users: 3 },
  { name: 'Infusion suite', users: 10 },
  { name: 'Nutrition and dietetics', users: 4 },
  { name: 'Behavioural health', users: 3 },
  { name: 'Genetics service', users: 2 },
  { name: 'Research unit', users: 5 },
  { name: 'Nurse triage', users: 9 },
  { name: 'Nurse practitioners', users: 6 },
  { name: 'Physician assistants', users: 4 },
  { name: 'Fellows and residents', users: 7 },
  { name: 'Clinical pharmacists', users: 3 },
  { name: 'Phlebotomy', users: 5 },
  { name: 'Imaging technologists', users: 4 },
  { name: 'Scheduling team', users: 11 },
  { name: 'Call centre', users: 13 },
  { name: 'Patient access', users: 8 },
  { name: 'Referral coordinators', users: 6 },
  { name: 'Prior authorisation', users: 7 },
  { name: 'Insurance verification', users: 6 },
  { name: 'Coding team', users: 8 },
  { name: 'Charge entry', users: 5 },
  { name: 'Payment posting', users: 4 },
  { name: 'Denials and appeals', users: 6 },
  { name: 'Collections', users: 4 },
  { name: 'Revenue cycle leadership', users: 3 },
  { name: 'Finance office', users: 4 },
  { name: 'Medical records', users: 6 },
  { name: 'Release of information', users: 3 },
  { name: 'Transcription', users: 4 },
  { name: 'Quality committee', users: 9 },
  { name: 'Infection control', users: 5 },
  { name: 'Compliance and privacy', users: 4 },
  { name: 'Credentialling', users: 3 },
  { name: 'Human resources', users: 4 },
  { name: 'Practice leadership', users: 6 },
  { name: 'Site leads — Fargo', users: 7 },
  { name: 'Site leads — Grand Forks', users: 4 },
  { name: 'Site leads — Moorhead', users: 4 },
  { name: 'Outreach clinicians', users: 11 },
  { name: 'Telehealth providers', users: 9 },
  { name: 'Materials and inventory', users: 5 },
  { name: 'Facilities', users: 4 },
  { name: 'IT and systems', users: 6 },
  { name: 'Help desk', users: 4 },
  { name: 'Reporting and analytics', users: 3 },
  { name: 'Marketing and outreach', users: 3 },
];

export const SPECIALTY_TYPES = [
  'Gastroenterology',
  'Hepatology',
  'Primary Care',
  'Ambulatory Surgery',
  'Multispecialty',
];

/* NO TIME_ZONES LIST. It existed to fill one dropdown on the Edit Practice
   Profile dialog, and that field has gone: where the building is is not
   something the office manager picks from a menu, and the only reader of the
   practice's `timeZone` — the pre-check form's timestamps — wants the answer
   the building actually runs on, not the last thing chosen on a form. The
   value itself is still on each profile above. */

export const ID_QUALIFIERS = [
  '0B — State Licence Number',
  '1G — Provider UPIN Number',
  'G2 — Provider Commercial Number',
  'LU — Location Number',
];

export const STATES = [
  'North Dakota', 'South Dakota', 'Minnesota', 'Montana', 'Iowa',
];
