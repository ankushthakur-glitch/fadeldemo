/**
 * Field vocabularies for the Add Patient form.
 *
 * Structure and field names are taken from the legacy gGastro Patient Form
 * (Patient Info / Insurance / Guarantor / Billing / Portal). Every VALUE below is
 * invented for the prototype — no real patient data, and the code lists are
 * illustrative rather than the full published value sets.
 *
 * Where gGastro shows an unlabelled dropdown, the option list here is the
 * standard one for that field (OMB race and ethnicity categories, HL7 marital
 * status, and so on) trimmed to what a demo needs.
 */

export const PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Dr.', 'Rev.', 'Prof.'];

export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'MD', 'PhD', 'RN'];

export const TITLES = ['Patient', 'Employee', 'Provider', 'Guarantor only'];

/** gGastro's "Birth Sex", with the "more..." link's expanded set folded in. */
export const BIRTH_SEXES = ['Female', 'Male', 'Intersex', 'Unknown'];

/* --- Sex and gender detail ------------------------------------------------
   Revealed by "Birth Sex Declined". Several labels contain commas, so these
   lists must be handed to ui-select as data (optionList), never through the
   comma-separated `options` attribute — that would split them mid-label. */

export const GENDER_IDENTITIES = [
  'Male',
  'Female',
  'Transgender male / Trans man / Female-to-male',
  'Transgender female / Trans woman / Male-to-female',
  'Genderqueer, neither exclusively male nor female',
  'Additional gender category (or other), please specify',
  'Chooses not to disclose',
];

export const SEXUAL_ORIENTATIONS = [
  'Straight or heterosexual',
  'Lesbian, gay or homosexual',
  'Bisexual',
  'Something else, please describe',
  "Don't know",
  'Chooses not to disclose',
];

export const PRONOUNS = [
  'he/him/his/his/himself',
  'she/her/her/hers/herself',
  'they/them/their/theirs/themselves',
  'Something else, please specify',
  'Chooses not to disclose',
];

/**
 * Sex for Clinical Use — which reference ranges and clinical defaults to
 * apply. It is a CLINICAL setting, not an identity: it decides whether a
 * haemoglobin result reads as normal, so it is asked separately from the
 * three above.
 */
export const SEX_FOR_CLINICAL_USE = [
  'Apply female-typical setting or reference range',
  'Apply male-typical setting or reference range',
  'Specified',
  'Unknown',
];

export const PATIENT_TYPES = ['Outpatient', 'Inpatient', 'Ambulatory surgery', 'Reference lab only'];

/* --- OMB categories, as gGastro collects them --------------------------- */

export const RACES = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Other race',
  'Declined to specify',
];

/** Enabled only once a Race is chosen — matches the greyed field on screen. */
export const RACE_DETAILS = {
  Asian: ['Asian Indian', 'Chinese', 'Filipino', 'Japanese', 'Korean', 'Vietnamese', 'Other Asian'],
  'Native Hawaiian or Other Pacific Islander': ['Native Hawaiian', 'Guamanian or Chamorro', 'Samoan', 'Other Pacific Islander'],
  'Black or African American': ['African American', 'African', 'Haitian', 'Other'],
  White: ['European', 'Middle Eastern or North African', 'Other'],
};

export const ETHNICITIES = ['Hispanic or Latino', 'Not Hispanic or Latino', 'Declined to specify'];

export const ETHNICITY_DETAILS = {
  'Hispanic or Latino': ['Mexican', 'Puerto Rican', 'Cuban', 'Central American', 'South American', 'Other'],
};

export const TRIBAL_AFFILIATIONS = [
  'Standing Rock Sioux Tribe',
  'Spirit Lake Tribe',
  'Turtle Mountain Band of Chippewa Indians',
  'Three Affiliated Tribes (MHA Nation)',
  'Sisseton Wahpeton Oyate',
  'Other federally recognised tribe',
  'Not applicable',
];

export const LANGUAGES = [
  'English (en)',
  'Spanish (es)',
  'Somali (so)',
  'Nepali (ne)',
  'Arabic (ar)',
  'Vietnamese (vi)',
  'German (de)',
  'Norwegian (no)',
  'American Sign Language (ase)',
];

export const NATIONALITIES = [
  'United States',
  'Canada',
  'Mexico',
  'Somalia',
  'Nepal',
  'Bhutan',
  'Iraq',
  'Vietnam',
  'Other',
];

export const MARITAL_STATUSES = [
  'Single',
  'Married',
  'Domestic partner',
  'Legally separated',
  'Divorced',
  'Widowed',
  'Unknown',
];

/* REFERRAL_SOURCES was here and is gone. Where a patient came from is recorded
   on the referral itself, in Document In — asking again at registration gave a
   second answer that could disagree with it. */

export const CONTACT_PREFERENCES = [
  'Mobile phone',
  'Home phone',
  'Work phone',
  'E-mail',
  'Patient portal',
  'Post',
  'Text message',
];

/* IDENTIFICATION_TYPES was here and is gone with the Details Info card — the
   practice does not capture ID documents at registration. */

/* HEALTH_STATUSES (alive / deceased / …) was here and is gone — the practice
   does not use the Health Status field. PATIENT_STATUSES below is the RECORD
   status, which is a different thing and drives the directory's tabs. */

/* Three, and only three. Merged and Prospective were states the legacy
   database moved a record through on its own — a duplicate folded into
   another, an enquiry that had not become a patient yet — and neither is a
   thing a registrar sets by hand. Offered in the dropdown they were two
   ways to file a live patient somewhere the directory's tabs never look. */
export const PATIENT_STATUSES = ['Active', 'Inactive', 'Deceased'];

/* Written the way a name is written, not shouted. The legacy form held these
   in caps because its database did; a form that reads UNITED STATES back at
   the person who chose it is quoting a column, not answering them. */
export const COUNTRIES = ['United States', 'Canada', 'Mexico', 'Other'];

/* --- Guarantor ------------------------------------------------------------
   "Self" is the guarantor being the patient. Choosing it mirrors the patient
   record into the form and locks it, which is why the legacy screen shows
   every demographic field greyed until the relationship changes. */

export const GUARANTOR_RELATIONSHIPS = [
  'Self',
  'Spouse',
  'Parent',
  'Legal guardian',
  'Child',
  'Other',
];

/** The legacy Guarantor form labels this "Gender", not "Birth Sex". */
export const GUARANTOR_GENDERS = ['Female', 'Male', 'Other', 'Unknown'];

export const STATES = ['ND', 'SD', 'MN', 'MT', 'IA', 'WI', 'NE'];

/* --- Information Sharing ------------------------------------------------- */

/**
 * Yes or No, because that is the question.
 *
 * The two options used to be sentences — "Patient consents to share" /
 * "Patient declines to share" — which read well and answered a DIFFERENT
 * question from the one the label asks. "Protect Data: Patient consents to
 * share" is a double negative you have to unpick every time you read it back,
 * and staff coming off the legacy screen, where this field is a plain Yes/No,
 * picked the wrong sentence often enough that the note underneath is the only
 * reason anybody noticed.
 *
 * Yes means the data IS protected — not shared with other providers, no HIE
 * and no registry submission. That is what the footnote under the field spells
 * out, and it appears on Yes.
 */
export const PROTECT_DATA_OPTIONS = ['Yes', 'No'];

/* Medication History Import.
 *
 * Whether the e-prescribing vendor may ask the pharmacy benefit network what
 * this patient has been dispensed. The options are sentences here, unlike
 * Protect Data above, because the label is a noun rather than a question —
 * "Medication History Import: Yes" says nothing about who is consenting to
 * what, and the legacy screen the desk works from spells it out the same way.
 *
 * "Patient consents" is the default because it is the answer for very nearly
 * everybody and because the alternative — leaving it blank — reads as an
 * unasked question when it is really the ordinary case.
 */
export const MEDICATION_HISTORY_OPTIONS = [
  'Patient consents',
  'Patient declines',
];

export const CAHPS_OPTIONS = ['No', 'Yes'];

/* --- Support persons ------------------------------------------------------
   One person carries two INDEPENDENT permissions. A neighbour who drives the
   patient home may be rung in an emergency and told nothing else; a daughter
   who calls for results may be told everything and lives four states away.
   Either, both, or neither is a legitimate answer — the son who is on the
   record so the chart knows he exists has neither.

   They were a single required three-way choice (Emergency / HIPAA / Both),
   where "Both" existed only because a radio group cannot say yes twice and
   "neither" could not be said at all. Two flags say the same thing without
   the third option that was really a conjunction. */

export const SUPPORT_PERMISSIONS = [
  {
    key: 'emergency',
    label: 'Emergency Contact',
    short: 'Emergency',
    status: 'warning',
    note: 'Called in an emergency.',
  },
  {
    key: 'hipaa',
    label: 'HIPAA Approved',
    short: 'HIPAA',
    status: 'info',
    note: 'May discuss the chart, results and appointments with the practice.',
  },
];

export const SUPPORT_RELATIONSHIPS = [
  'Spouse',
  'Partner',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Legal guardian',
  'Friend',
  'Neighbour',
  'Carer',
  'Other',
];

/* --- Collapsible reference panels ----------------------------------------
   The "+" panels down the right of the gGastro form. Each is a repeating
   sub-record rather than a single field, which is why they collapse.

   Three panels have left this list:
     PHR Accounts  — the practice does not use it
     Employment    — dropped from the registration form
     Support Persons and Providers — promoted to full sections of their own,
                     because a collapsed panel cannot show a designation or a
                     provider role, and both of those decide who gets told
                     what.                                                  */

export const PATIENT_PANELS = [
  {
    key: 'contact-numbers',
    title: 'Contact Numbers',
    addLabel: 'Add contact number',
    entries: [
      { type: 'Mobile', value: '(701) 555-0184', primary: true },
      { type: 'Home', value: '(701) 555-0143' },
    ],
  },
  {
    key: 'addresses',
    title: 'Addresses',
    addLabel: 'Add address',
    entries: [
      { type: 'Home', value: '4218 Prairie Rose Ln', sub: 'Fargo, ND 58104', primary: true },
    ],
  },
  {
    key: 'emails',
    title: 'Emails',
    addLabel: 'Add email',
    entries: [{ type: 'Personal', value: 'm.delacroix@example.com', primary: true }],
  },
];

/**
 * "Chart accessible only by" — an empty restriction list means the chart is
 * open to the whole practice, which the legacy form states as "Everyone".
 */
export const CHART_ACCESS = [];
