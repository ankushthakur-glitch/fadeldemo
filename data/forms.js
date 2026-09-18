/**
 * DEMO DATA for the Forms module.
 * Entirely invented — no real patient information.
 *
 * The chart now carries exactly ONE form — the Patient Interview Form. The
 * assessment scores, the consents and the release of information that used
 * to sit alongside it have been taken out: MediNova only wanted the interview
 * questionnaire in the chart, and a catalog full of forms nobody assigns
 * reads as scope this prototype does not have.
 *
 * Three kinds of thing live here:
 *   FORM_CATALOG    what the practice can assign, grouped by category — the
 *                    source for the Assign Form dialog's two dropdowns. One
 *                    category, one form, so both dropdowns have a single
 *                    honest choice rather than a menu of stubs.
 *   FORM_SCHEMAS     the actual field layout for forms that can be filled out
 *                     in this prototype, keyed by form name. Transcribed from
 *                     MediNova Gastroenterology's real Patient Interview Form —
 *                     see chart-forms.js for how a schema becomes a fill-out
 *                     dialog.
 *   PATIENT_FORMS    what has actually been sent to (or completed by) a
 *                    given patient, keyed by MRN like every other per-patient
 *                    data file in this chart. A completed row's `answers`
 *                    match its schema's field keys.
 */

export const FORM_CATALOG = {
  Intake: ['Patient Interview Form'],
};

export const STATUS = {
  completed: { label: 'Completed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
};

/* ============================================================================
   FORM SCHEMAS

   Field types the renderer in chart-forms.js understands:
     text · email · number · date · textarea
     select        — options: string[]
     radio         — options: string[]
     checkbox      — a single yes/no box, label carries the question
     checkboxGroup — options: string[], answer is the array of checked ones

   `prefill(patient)` pulls a starting value from the chart the patient
   already belongs to, so nobody retypes a name or MRN the form is about.
   `readonly` marks fields that came FROM the chart rather than being asked
   on the form — DOB and MRN are facts, not something this form collects.
   ========================================================================= */

export const FORM_SCHEMAS = {
  'Patient Interview Form': [
    {
      title: 'Patient Information',
      fields: [
        { key: 'firstName', label: 'First name', type: 'text', prefill: (p) => p.name.split(' ')[0] },
        { key: 'lastName', label: 'Last name', type: 'text', prefill: (p) => p.name.split(' ').slice(1).join(' ') },
        { key: 'mrn', label: 'MRN', type: 'text', readonly: true, prefill: (p) => p.mrn },
        { key: 'dob', label: 'Date of birth', type: 'text', readonly: true, format: 'date', prefill: (p) => p.dob },
        { key: 'preferredEmail', label: 'Preferred email', type: 'radio', options: ['Personal', 'Work'] },
        { key: 'email', label: 'Email', type: 'email', prefill: (p) => p.email || '' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    {
      title: 'Demographics',
      fields: [
        {
          key: 'race',
          label: 'Race — select one or more',
          type: 'checkboxGroup',
          options: [
            'White',
            'Black or African American',
            'Asian',
            'American Indian or Alaska Native',
            'Native Hawaiian or Other Pacific Islander',
            'Middle Eastern or North African',
            'Other',
            'Unknown',
            'Patient declines to specify',
          ],
        },
        {
          key: 'ethnicity',
          label: 'Ethnicity',
          type: 'radio',
          options: ['Hispanic or Latino', 'Not Hispanic or Latino', 'Patient declines to specify', 'Unknown'],
        },
        { key: 'sex', label: 'Sex', type: 'radio', options: ['Male', 'Female', 'Other', 'Unknown'], prefill: (p) => p.gender },
        {
          key: 'genderIdentity',
          label: 'Gender identity',
          type: 'radio',
          options: [
            'Male',
            'Female',
            'Transgender male / trans man',
            'Transgender female / trans woman',
            'Genderqueer, neither exclusively male nor female',
            'Other',
            'Chooses not to disclose',
          ],
        },
        { key: 'preferredLanguage', label: 'Preferred language', type: 'select', options: ['English', 'Spanish', 'French', 'Other'], prefill: (p) => (p.language || '').split(' ')[0] },
      ],
    },
    {
      title: 'Allergies',
      fields: [
        { key: 'noKnownAllergies', label: 'Patient has no known allergies', type: 'checkbox' },
        { key: 'noKnownDrugAllergies', label: 'Patient has no known drug allergies', type: 'checkbox' },
        { key: 'allergyList', label: 'Allergies (substance and reaction)', type: 'textarea' },
      ],
    },
    {
      title: 'Immunizations',
      fields: [
        {
          key: 'immunizations',
          label: 'Immunizations',
          type: 'checkboxGroup',
          options: ['Flu vaccine', 'Hepatitis B', 'Varicella', 'Hepatitis A (adult)', 'None'],
        },
        { key: 'immunizationsOther', label: 'Other', type: 'text' },
      ],
    },
    {
      title: 'Diagnostic Studies / Tests',
      fields: [
        {
          key: 'diagnosticStudies',
          label: 'Diagnostic studies or tests',
          type: 'checkboxGroup',
          options: [
            'Colonoscopy',
            'EGD / Upper Endoscopy',
            'Esophageal Manometry',
            'Gastric Emptying Study',
            'CT Abdomen/Pelvis',
            'Anorectal Manometry',
            'HIDA Scan',
            'Liver Biopsy',
            'Abdominal Ultrasound',
            'None',
          ],
        },
        { key: 'diagnosticStudiesOther', label: 'Other', type: 'text' },
      ],
    },
    {
      title: 'Past or Present Medical Conditions',
      fields: [
        {
          key: 'conditions',
          label: 'Medical conditions',
          type: 'checkboxGroup',
          options: [
            "Gastroesophageal Reflux Disease (GERD)",
            "Barrett's Esophagus",
            'Depression',
            'Colon cancer',
            'Diabetes Mellitus, Non-Insulin Dependent (Type 2)',
            'Gastric Bypass Surgery',
            'Colon polyp history',
            'Anxiety disorder',
            'Hemorrhoids',
            'Irritable Bowel Syndrome',
            "Crohn's Disease",
            'Ulcerative Colitis',
            'Celiac Disease',
            'None',
          ],
        },
        { key: 'conditionsOther', label: 'Other', type: 'text' },
      ],
    },
    {
      title: 'Previous Procedures',
      fields: [
        {
          key: 'procedures',
          label: 'Previous procedures',
          type: 'checkboxGroup',
          options: [
            'Appendectomy',
            'Cholecystectomy',
            'Colectomy',
            'Colostomy',
            'Gastric Lap Band (banded gastroplasty)',
            'Gastric Bypass — type unspecified',
            'Hemorrhoid banding',
            'Hemorrhoidectomy',
            'Hernia Repair — site unspecified',
            'Abdominoplasty',
            'None',
          ],
        },
        { key: 'proceduresOther', label: 'Other', type: 'text' },
      ],
    },
    {
      title: 'Social History',
      fields: [
        { key: 'occupation', label: 'Occupation', type: 'text' },
        {
          key: 'maritalStatus',
          label: 'Marital status',
          type: 'select',
          options: ['Single', 'Married', 'Civil Union', 'Divorced', 'Separated', 'Widowed', 'Unknown', 'Other'],
        },
        { key: 'numberOfChildren', label: 'Number of children', type: 'number' },
        { key: 'alcoholUse', label: 'Alcohol use', type: 'select', options: ['None', 'Occasional', 'Moderate', 'Heavy'] },
        { key: 'alcoholDetail', label: 'Alcohol — type, quantity, frequency', type: 'text' },
        { key: 'caffeineIntake', label: 'Caffeine intake', type: 'text' },
        {
          key: 'smokingStatus',
          label: 'Tobacco — smoking status',
          type: 'select',
          options: [
            'Never smoker',
            'Former smoker',
            'Current every day smoker',
            'Current some day smoker',
            'Light tobacco smoker',
            'Heavy tobacco smoker',
            'Smoker, current status unknown',
            'Unknown if ever smoked',
          ],
        },
        { key: 'drugUse', label: 'Drug use', type: 'select', options: ['None', 'Yes'] },
        { key: 'drugDetail', label: 'Drug use — type, quantity, frequency', type: 'text' },
        { key: 'exercise', label: 'Exercise', type: 'text' },
      ],
    },
    {
      title: 'Consents',
      fields: [
        {
          key: 'consentImportMedHistory',
          label: 'I consent to obtaining a history of my medications purchased at pharmacies.',
          type: 'radio',
          options: ['Yes', 'No'],
        },
        {
          key: 'consentShareData',
          label: 'I consent to having my medical and demographic information shared with other health care entities.',
          type: 'radio',
          options: ['Yes', 'No'],
        },
      ],
    },
    {
      title: 'Reviewed & Signature',
      fields: [
        { key: 'reviewedWith', label: 'Reviewed with', type: 'radio', options: ['Patient', 'Parent', 'Guardian', 'Not Present'] },
        { key: 'signature', label: 'Signature — type full name to sign', type: 'text' },
        { key: 'date', label: 'Date', type: 'text', readonly: true, format: 'date', prefillToday: true },
      ],
    },
  ],
};

function f(id, name, category, sentOn, status, completedOn = null, answers = null) {
  return { id, name, category, sentOn, status, completedOn, answers };
}

export const PATIENT_FORMS = {
  326486: [
    f(
      'f-1',
      'Patient Interview Form',
      'Intake',
      '23-08-2020',
      'completed',
      '23-08-2020',
      {
        firstName: 'Henna',
        lastName: 'West',
        mrn: '326486',
        dob: '20-02-1961',
        preferredEmail: 'Personal',
        email: 'hennawest@example.com',
        race: ['White'],
        ethnicity: 'Not Hispanic or Latino',
        sex: 'Female',
        genderIdentity: 'Female',
        preferredLanguage: 'English',
        noKnownAllergies: false,
        noKnownDrugAllergies: false,
        allergyList: 'Penicillin — anaphylaxis. Iodinated contrast — hives. Latex — contact dermatitis.',
        immunizations: ['Flu vaccine', 'Hepatitis A (adult)'],
        diagnosticStudies: ['Colonoscopy', 'EGD / Upper Endoscopy'],
        conditions: ['Gastroesophageal Reflux Disease (GERD)', 'Diabetes Mellitus, Non-Insulin Dependent (Type 2)'],
        procedures: ['Cholecystectomy'],
        occupation: 'Retired schoolteacher',
        maritalStatus: 'Married',
        numberOfChildren: '2',
        alcoholUse: 'Occasional',
        alcoholDetail: '2–3 drinks per week',
        caffeineIntake: '1 cup of coffee per day',
        smokingStatus: 'Former smoker',
        drugUse: 'None',
        exercise: 'Walks daily, ~30 min',
        consentImportMedHistory: 'Yes',
        consentShareData: 'Yes',
        reviewedWith: 'Patient',
        signature: 'Henna West',
        date: '23-08-2020',
      }
    ),
  ],

  326477: [
    f('f-1', 'Patient Interview Form', 'Intake', '19-10-2025', 'completed', '19-10-2025', {
      firstName: 'Natali',
      lastName: 'Craig',
      mrn: '326477',
      dob: '15-07-1966',
      email: 'natali.craig@example.com',
      sex: 'Female',
      preferredLanguage: 'English',
      allergyList: 'Sulfa drugs — rash.',
      conditions: ['None'],
      smokingStatus: 'Never smoker',
      drugUse: 'None',
      reviewedWith: 'Patient',
      signature: 'Natali Craig',
      date: '19-10-2025',
    }),
  ],

  326481: [],

  326495: [
    f('f-1', 'Patient Interview Form', 'Intake', '02-01-2026', 'completed', '02-01-2026', {
      firstName: 'Zoe',
      lastName: 'Tran',
      mrn: '326495',
      dob: '14-03-2013',
      sex: 'Female',
      preferredLanguage: 'English',
      conditions: ['None'],
      smokingStatus: 'Never smoker',
      drugUse: 'None',
      reviewedWith: 'Guardian',
      signature: 'Mai Tran',
      date: '02-01-2026',
    }),
  ],
};

export const EMPTY_PATIENT_FORMS = [];
