/**
 * FORMS — the paperwork the practice has sent this patient to fill in.
 *
 * ⚠ WHERE THE FIELDS COME FROM
 *
 * The field set below is the practice's, not an invention of the portal. It is
 * the same set the chart collects in its Forms module (the EHR's
 * `data/forms.js` → FORM_SCHEMAS), transcribed from MediNova Gastroenterology's
 * Patient Interview Form and its Authorization for Use and Disclosure of
 * Protected Health Information. The point of a portal form is that a patient
 * fills in at home exactly what they would otherwise fill in on a clipboard in
 * the waiting room, and what lands in the chart afterwards has to be the same
 * shape either way.
 *
 * So the KEYS ARE IDENTICAL to the chart's — `noKnownDrugAllergies`,
 * `smokingStatus`, `consentImportMedHistory` and the rest — and so are the
 * option lists. If a key here drifts from the chart's, the answer a patient
 * types stops landing in the field a clinician reads. THAT is the thing to
 * keep in step when either side changes.
 *
 * Two deliberate differences, both about audience:
 *
 *   1. THE LABELS ARE IN THE SECOND PERSON. The chart asks a clinician
 *      "Patient has no known drug allergies"; the portal asks the patient
 *      "I have no known drug allergies". Same key, same answer, read by the
 *      person actually answering it.
 *   2. `reviewedWith` drops its "Not Present" option. It exists so a
 *      clinician can record that the form was filled in without the patient
 *      there. Someone signed into the portal is, by definition, present.
 *
 * ⚠ WHY THE PORTAL HOLDS ITS OWN COPY
 *
 * This directory shares nothing with the EHR prototype — see the README. A
 * portal screen importing `../../../data/forms.js` would be the first thread
 * of the two apps becoming one, and the separation is worth more than the
 * duplication costs. In a real build both sides read one schema from the
 * server; in this prototype they are two files that must agree.
 *
 * MUTABLE, like data/documents.js and data/health.js: submitting a form
 * really moves it to Completed and really keeps the answers, for the life of
 * the page view. A form that validates and changes nothing tells a reviewer
 * whether the FIELDS are right but not whether submitting lands anywhere.
 */

/* ============================================================================
   FIELD TYPES

   The renderer in js/screens/forms.js understands:

     text · email · number · date · textarea
     select        — options: string[]
     radio         — options: string[]
     checkbox      — a single yes/no box; the label carries the question
     checkboxGroup — options: string[]; the answer is the array of ticked ones
     statement     — NOT a question. A block of prose the patient reads before
                     answering, rendered as text with no control and collected
                     as no answer. The consents need it: the thing being
                     consented to is the paragraph, and a consent form that
                     shows only the tick box has hidden the part that matters.

   `prefill(patient)` takes a starting value from the record the patient
   already has, so nobody retypes a name the practice knows. `readonly` marks
   a fact the form reports rather than asks — an MRN is not a question.
   `required` is the short list a form cannot be submitted without.
   ========================================================================= */

export const FORM_SCHEMAS = {
  'Patient Interview Form': [
    {
      title: 'About you',
      fields: [
        {
          key: 'firstName',
          label: 'First name',
          type: 'text',
          required: true,
          prefill: (p) => p.name.split(' ')[0],
        },
        {
          key: 'lastName',
          label: 'Last name',
          type: 'text',
          required: true,
          prefill: (p) => p.name.split(' ').slice(1).join(' '),
        },
        { key: 'mrn', label: 'Medical record number', type: 'text', readonly: true, prefill: (p) => p.mrn },
        { key: 'dob', label: 'Date of birth', type: 'text', readonly: true, prefill: (p) => p.dob },
        {
          key: 'preferredEmail',
          label: 'Which email should we use?',
          type: 'radio',
          options: ['Personal', 'Work'],
        },
        { key: 'email', label: 'Email', type: 'email', prefill: (p) => p.email },
        {
          key: 'notes',
          label: 'Anything you would like your care team to know before the visit',
          type: 'textarea',
        },
      ],
    },
    {
      title: 'Demographics',
      fields: [
        {
          key: 'race',
          label: 'Race — choose one or more',
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
            'I prefer not to say',
          ],
        },
        {
          key: 'ethnicity',
          label: 'Ethnicity',
          type: 'radio',
          options: [
            'Hispanic or Latino',
            'Not Hispanic or Latino',
            'I prefer not to say',
            'Unknown',
          ],
        },
        {
          key: 'sex',
          label: 'Sex',
          type: 'radio',
          options: ['Male', 'Female', 'Other', 'Unknown'],
          prefill: (p) => p.gender,
        },
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
            'I prefer not to say',
          ],
        },
        {
          key: 'preferredLanguage',
          label: 'Preferred language',
          type: 'select',
          options: ['English', 'Spanish', 'French', 'Other'],
          prefill: (p) => p.languages.split(',')[0].trim(),
        },
      ],
    },
    {
      title: 'Allergies',
      fields: [
        { key: 'noKnownAllergies', label: 'I have no known allergies', type: 'checkbox' },
        { key: 'noKnownDrugAllergies', label: 'I have no known drug allergies', type: 'checkbox' },
        {
          key: 'allergyList',
          label: 'Allergies — what you react to, and what happens',
          type: 'textarea',
        },
      ],
    },
    {
      title: 'Immunisations',
      fields: [
        {
          key: 'immunizations',
          label: 'Immunisations you have had',
          type: 'checkboxGroup',
          options: ['Flu vaccine', 'Hepatitis B', 'Varicella', 'Hepatitis A (adult)', 'None'],
        },
        { key: 'immunizationsOther', label: 'Other immunisations', type: 'text' },
      ],
    },
    {
      title: 'Tests you have had',
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
        { key: 'diagnosticStudiesOther', label: 'Other tests', type: 'text' },
      ],
    },
    {
      title: 'Medical conditions, past or present',
      fields: [
        {
          key: 'conditions',
          label: 'Conditions you have or have had',
          type: 'checkboxGroup',
          options: [
            'Gastroesophageal Reflux Disease (GERD)',
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
        { key: 'conditionsOther', label: 'Other conditions', type: 'text' },
      ],
    },
    {
      title: 'Previous procedures',
      fields: [
        {
          key: 'procedures',
          label: 'Procedures you have had',
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
        { key: 'proceduresOther', label: 'Other procedures', type: 'text' },
      ],
    },
    {
      title: 'Social history',
      fields: [
        { key: 'occupation', label: 'Occupation', type: 'text' },
        {
          key: 'maritalStatus',
          label: 'Marital status',
          type: 'select',
          options: [
            'Single',
            'Married',
            'Civil Union',
            'Divorced',
            'Separated',
            'Widowed',
            'Unknown',
            'Other',
          ],
        },
        { key: 'numberOfChildren', label: 'Number of children', type: 'number' },
        {
          key: 'alcoholUse',
          label: 'Alcohol use',
          type: 'select',
          options: ['None', 'Occasional', 'Moderate', 'Heavy'],
        },
        { key: 'alcoholDetail', label: 'Alcohol — what, how much, how often', type: 'text' },
        { key: 'caffeineIntake', label: 'Caffeine — how much a day', type: 'text' },
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
        { key: 'drugUse', label: 'Recreational drug use', type: 'select', options: ['None', 'Yes'] },
        { key: 'drugDetail', label: 'Drugs — what, how much, how often', type: 'text' },
        { key: 'exercise', label: 'Exercise', type: 'text' },
      ],
    },
    {
      title: 'Consents',
      fields: [
        {
          key: 'consentImportMedHistory',
          label:
            'I consent to the practice obtaining a history of the medications I have bought at pharmacies.',
          type: 'radio',
          options: ['Yes', 'No'],
          required: true,
        },
        {
          key: 'consentShareData',
          label:
            'I consent to my medical and demographic information being shared with other health care entities.',
          type: 'radio',
          options: ['Yes', 'No'],
          required: true,
        },
      ],
    },
    {
      title: 'Sign and submit',
      fields: [
        {
          key: 'reviewedWith',
          label: 'Who is filling this in?',
          type: 'radio',
          options: ['Patient', 'Parent', 'Guardian'],
          required: true,
        },
        {
          key: 'signature',
          label: 'Signature — type your full name to sign',
          type: 'text',
          required: true,
          requiredMessage: 'Type your full name to sign.',
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  'Release Of Information': [
    {
      title: 'You',
      fields: [
        { key: 'patientName', label: 'Your name', type: 'text', readonly: true, prefill: (p) => p.name },
        { key: 'dob', label: 'Date of birth', type: 'text', readonly: true, prefill: (p) => p.dob },
        { key: 'mrn', label: 'Medical record number', type: 'text', readonly: true, prefill: (p) => p.mrn },
      ],
    },
    {
      title: 'Release my information to',
      fields: [
        {
          key: 'releaseTo',
          label: 'Name and address of the person or organisation receiving it',
          type: 'textarea',
          required: true,
          requiredMessage: 'Say who should receive your records.',
        },
      ],
    },
    {
      title: 'Why',
      fields: [
        {
          key: 'purpose',
          label: 'Purpose of the disclosure',
          type: 'checkboxGroup',
          options: [
            'Continuing care',
            'Payment of claim',
            "Worker's compensation",
            'School',
            'Insurance application',
            'Personal use',
            'Legal',
            'Other',
          ],
        },
        { key: 'purposeOther', label: 'Other purpose', type: 'text' },
      ],
    },
    {
      title: 'What to release',
      fields: [
        { key: 'dateFrom', label: 'Dates of service — from', type: 'date' },
        { key: 'dateTo', label: 'Dates of service — to', type: 'date' },
        {
          key: 'infoTypes',
          label: 'Records to release',
          type: 'checkboxGroup',
          options: [
            'Discharge summary',
            'H&P',
            'Consult',
            'Labs report',
            'X-rays reports and films or CD',
            'Pathology reports',
            'Procedure reports (Colonoscopy, EGD)',
            'Operative reports',
            'Immunizations',
            'Entire medical records',
            'Correspondence',
            "Provider's progress notes",
            'Other',
          ],
        },
        { key: 'infoOther', label: 'Other records', type: 'text' },
      ],
    },
    {
      title: 'Restrictions',
      fields: [
        {
          key: 'restrictBehavioralHealth',
          label:
            'Do not release records about alcohol or drug treatment, or behavioural health information',
          type: 'checkbox',
        },
      ],
    },
    {
      title: 'Expiry',
      fields: [
        {
          key: 'expiration',
          label:
            'This authorisation expires on (a date or an event — 12 months from signing if you leave it blank)',
          type: 'text',
        },
      ],
    },
    {
      title: 'Sign and submit',
      fields: [
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'relationship', label: 'If you are not the patient, your authority or relationship', type: 'text' },
        {
          key: 'signature',
          label: 'Signature — type your full name to sign',
          type: 'text',
          required: true,
          requiredMessage: 'Type your full name to sign.',
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  /* ==========================================================================
     THE FOUR SHORT CONSENTS AND THE INSURANCE AUTHORISATION

     Each is a page of prose in the paper world with two or three questions at
     the end. Only the questions are here — the prose is what `about` on the
     form row says, plus the `statement` field type below, which renders a
     block of text the patient reads rather than answers.

     They are short on purpose. A consent that asks fifteen questions is a
     consent nobody reads to the end of, and the thing being consented to is
     the paragraph, not the form.
     ====================================================================== */

  'Insurance Disclosure': [
    {
      title: 'What you are authorising',
      fields: [
        {
          key: 'statementBilling',
          type: 'statement',
          label:
            'You are authorising GastroEMR Clinic to send claims to your insurer on your behalf, and to release the clinical information a claim needs — diagnoses, procedure codes and the notes supporting them. You are also confirming that anything your plan does not cover remains your responsibility.',
        },
      ],
    },
    {
      title: 'Your cover',
      fields: [
        {
          key: 'insurer',
          label: 'Insurance company',
          type: 'text',
          required: true,
        },
        { key: 'memberId', label: 'Member ID', type: 'text', required: true },
        {
          key: 'policyHolder',
          label: 'Who holds the policy',
          type: 'radio',
          options: ['Me', 'My spouse or partner', 'A parent or guardian', 'Someone else'],
          required: true,
        },
        {
          key: 'secondaryCover',
          label: 'I have a second insurance plan',
          type: 'checkbox',
        },
      ],
    },
    {
      title: 'Agreement',
      fields: [
        {
          key: 'authorisesBilling',
          label: 'I authorise the practice to bill my insurer directly',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to authorise direct billing.',
        },
        {
          key: 'acceptsBalance',
          label: 'I accept responsibility for anything my plan does not cover',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to accept responsibility for the balance.',
        },
      ],
    },
  ],

  'Consent for Treatment': [
    {
      title: 'What you are consenting to',
      fields: [
        {
          key: 'statementCare',
          type: 'statement',
          label:
            'You are consenting to routine care at this practice — examination, the tests your care team judges necessary, and the treatment they recommend. Consent for anything beyond routine care, including any procedure carrying its own risks, is asked for separately and at the time.',
        },
      ],
    },
    {
      title: 'Agreement',
      fields: [
        {
          key: 'understands',
          label: 'I have read the above and consent to routine care at this practice',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to consent to treatment.',
        },
        {
          key: 'questionsAnswered',
          label: 'I have had the chance to ask questions',
          type: 'checkbox',
        },
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  'Notice of Privacy Practices': [
    {
      title: 'The notice',
      fields: [
        {
          key: 'statementNotice',
          type: 'statement',
          label:
            'The practice’s Notice of Privacy Practices describes how your health information is used and shared — for your treatment, to obtain payment, and to run the practice — and the rights you have over it: to see your record, to ask for a correction, to ask us to restrict what we share, and to be told when it has been disclosed.',
        },
      ],
    },
    {
      title: 'Acknowledgement',
      fields: [
        {
          key: 'received',
          label: 'I have received the practice’s Notice of Privacy Practices',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to acknowledge you received the notice.',
        },
        {
          key: 'format',
          label: 'How you received it',
          type: 'select',
          options: ['Paper copy at the front desk', 'By email', 'Read in the patient portal'],
        },
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  'Advance Directive': [
    {
      title: 'What this asks',
      fields: [
        {
          key: 'statementDirective',
          type: 'statement',
          label:
            'An advance directive says what care you would want if you could not speak for yourself, and who may decide for you. You are not required to have one, and your care here does not depend on it. We ask so that your record is accurate and so we know who to contact.',
        },
      ],
    },
    {
      title: 'Your directive',
      fields: [
        {
          key: 'hasDirective',
          label: 'Do you have an advance directive or a healthcare proxy?',
          type: 'radio',
          options: ['Yes', 'No', 'I am not sure'],
          required: true,
        },
        { key: 'proxyName', label: 'If yes, who is your healthcare proxy?', type: 'text' },
        { key: 'proxyPhone', label: 'Their contact number', type: 'text' },
        {
          key: 'wantsInformation',
          label: 'Please send me information about making one',
          type: 'checkbox',
        },
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  'Telehealth Policy': [
    {
      title: 'How video visits work here',
      fields: [
        {
          key: 'statementTelehealth',
          type: 'statement',
          label:
            'A video visit suits follow-ups, results discussions and medication reviews. It cannot replace an examination, and your clinician may end one and ask you to come in. If the connection fails and cannot be restored, we call you back on the number in your record and the visit continues by phone.',
        },
      ],
    },
    {
      title: 'Agreement',
      fields: [
        {
          key: 'understandsLimits',
          label: 'I understand a video visit cannot replace an in-person examination',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to confirm you understand the limits.',
        },
        {
          key: 'understandsFallback',
          label: 'I understand you will phone me if the connection fails',
          type: 'checkbox',
        },
        {
          key: 'consents',
          label: 'Do you consent to video visits?',
          type: 'radio',
          options: ['Yes', 'No'],
          required: true,
        },
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ],

  'Text Message Policy': [
    {
      title: 'What texting means',
      fields: [
        {
          key: 'statementText',
          type: 'statement',
          label:
            'Text messages are not a secure channel. Anyone holding your phone can read them, and they travel through networks the practice does not control. We keep them to appointment reminders and short notifications; nothing clinical is sent by text. Standard message rates from your carrier apply, and you can stop them at any time by replying STOP or telling us.',
        },
      ],
    },
    {
      title: 'Your choice',
      fields: [
        {
          key: 'consents',
          label: 'May we send you text messages?',
          type: 'radio',
          options: ['Yes', 'No'],
          required: true,
        },
        {
          key: 'mobile',
          label: 'Mobile number to use',
          type: 'text',
          prefill: (patient) => patient.phone,
        },
        { key: 'reminders', label: 'Appointment reminders', type: 'checkbox' },
        { key: 'results', label: 'A note when a result is ready to view', type: 'checkbox' },
        {
          key: 'understandsNotSecure',
          label: 'I understand text messages are not secure',
          type: 'checkbox',
          required: true,
          requiredMessage: 'Tick this to confirm you understand texts are not secure.',
        },
        {
          key: 'signedBy',
          label: 'Signed by',
          type: 'radio',
          options: ['Patient', 'Guardian', 'Representative'],
          required: true,
        },
        { key: 'date', label: 'Date', type: 'text', readonly: true, prefillToday: true },
      ],
    },
  ]
};

/* ============================================================================
   WHAT HAS BEEN SENT TO THIS PATIENT

   `schema` names an entry in FORM_SCHEMAS. A form WITHOUT one still belongs in
   this list — the practice sent it and the patient has to know about it — but
   the portal cannot open what it does not know the shape of, and says so
   rather than drawing an empty page. Both such rows below are already signed,
   which is the honest half of that: this prototype does not put a "Start" on
   something it cannot start.

   ⚠ `kind` — THE FORM / CONSENT SPLIT, AND WHY IT IS A FIELD AND NOT A GUESS

   The screen is two tabs, and this is what decides which one a row lands on.
   The rule is about what the paper DOES, not what it is called:

     'form'    — answers. The patient tells the practice something, and if
                 they got it wrong they correct it. A correction files a new
                 version and the old one is kept.
     'consent' — permission. The practice acts on it until the patient takes
                 it back, so the only thing that can happen to a given consent
                 is that it is WITHDRAWN.

   That is why the Notice of Privacy Practices and the Advance Directive are
   forms rather than consents despite reading like consents: one records that
   a document was received and the other records whether a living will exists.
   Neither is a permission, so there is nothing in either to withdraw — and
   putting a Withdraw button on "I received the notice" would offer to unsay
   a fact. The two Authorisation rows go the other way: an authorisation to
   release records is a permission, and a patient may revoke it at any time.

   `status` is 'todo', 'completed' or — consents only — 'revoked'. A revoked
   consent is outstanding again: the practice no longer has permission, and
   the patient can give it afresh. `revokedOn` / `revokeReason` are the record
   of that, mirrored here from data/form-store.js on load.

   ⚠ `signatureRequired` — TRUE ON EVERY CONSENT, AND IT FOLLOWS FROM `kind`

   A consent is a permission the practice will act on, so it is signed: the
   block at the foot of the form is what the patient is held to, and a
   permission given by ticking a box and pressing a button leaves the practice
   with nothing on the file to show for it. Two of them below did not ask for
   one and now do.

   It stays a FIELD rather than being derived from `kind` in the renderer,
   because the forms are not all one way — the Interview Form and the Advance
   Directive sign inside their own "Sign and submit" section, and the Notice of
   Privacy Practices records receipt rather than agreement. So the flag says
   what each paper needs, and the rule "every consent needs one" is a rule
   about the DATA, kept here where the data is.

   Dates are MM/DD/YYYY, the format every other portal fixture uses.
   ========================================================================= */

export const FORMS = [
  {
    id: 'form-interview',
    kind: 'form',
    name: 'Patient Interview Form',
    category: 'Intake',
    schema: 'Patient Interview Form',
    signatureRequired: false,
    about:
      'Your history, allergies, medications and social history. Your care team reads it before your visit, so filling it in at home saves the clipboard in the waiting room.',
    sentOn: '08/10/2026',
    dueOn: '09/01/2026',
    // Tied to the September 5 visit — see data/appointments.js. The Appointment
    // card's "Complete Intake Form" is the other way into this same row.
    appointmentId: 'appt-sep-05',
    status: 'todo',
    completedOn: null,
    answers: null,
  },
  {
    id: 'form-roi',
    kind: 'consent',
    name: 'Release Of Information',
    category: 'Authorisation',
    schema: 'Release Of Information',
    signatureRequired: true,
    about:
      'Names anyone outside the practice who may receive a copy of your records — another clinic, an insurer, a family member.',
    sentOn: '08/10/2026',
    dueOn: null,
    appointmentId: null,
    status: 'todo',
    completedOn: null,
    revokedOn: null,
    revokeReason: '',
    answers: null,
  },
  {
    id: 'form-insurance-disclosure',
    kind: 'consent',
    name: 'Insurance Disclosure',
    category: 'Authorisation',
    schema: 'Insurance Disclosure',
    signatureRequired: true,
    about:
      'Authorises the practice to bill your insurer directly and to give them the clinical detail a claim needs. It also confirms you are responsible for anything your plan does not cover.',
    sentOn: '08/14/2026',
    dueOn: '09/01/2026',
    appointmentId: 'appt-sep-05',
    status: 'todo',
    completedOn: null,
    revokedOn: null,
    revokeReason: '',
    answers: null,
  },
  {
    id: 'form-consent-treatment',
    kind: 'consent',
    name: 'Consent for Treatment',
    category: 'Consent',
    schema: 'Consent for Treatment',
    signatureRequired: true,
    about: 'Covers routine care at this practice — examinations, tests and the treatment your care team recommends.',
    sentOn: '02/12/2026',
    dueOn: null,
    appointmentId: null,
    status: 'completed',
    completedOn: '02/12/2026',
    revokedOn: null,
    revokeReason: '',
    answers: {
      understands: true,
      questionsAnswered: true,
      signedBy: 'Patient',
      date: '02/12/2026',
    },
  },
  {
    /*
     * WAS "HIPAA Acknowledgment".
     *
     * The old name asked the patient to acknowledge an acronym. What they are
     * actually being given is a document — the practice's Notice of Privacy
     * Practices — and naming the row after the notice rather than after the
     * law it satisfies is the difference between a form you can decide about
     * and one you tick past. The id is unchanged so nothing that links to it
     * breaks.
     */
    id: 'form-hipaa',
    kind: 'form',
    name: 'Notice of Privacy Practices',
    category: 'Consent',
    schema: 'Notice of Privacy Practices',
    signatureRequired: false,
    about:
      'The practice’s notice describing how your health information is used and shared.',
    sentOn: '02/12/2026',
    dueOn: null,
    appointmentId: null,
    status: 'completed',
    completedOn: '02/12/2026',
    answers: {
      received: true,
      format: 'Paper copy at the front desk',
      signedBy: 'Patient',
      date: '02/12/2026',
    },
  },
  {
    id: 'form-advance-directive',
    kind: 'form',
    name: 'Advance Directive',
    category: 'Consent',
    schema: 'Advance Directive',
    signatureRequired: false,
    about:
      'Tells us whether you have a living will or a healthcare proxy, and who to contact if you cannot speak for yourself. You are not required to have one.',
    sentOn: '02/12/2026',
    dueOn: null,
    appointmentId: null,
    status: 'completed',
    completedOn: '02/14/2026',
    answers: {
      hasDirective: 'No',
      proxyName: '',
      proxyPhone: '',
      wantsInformation: true,
      signedBy: 'Patient',
      date: '02/14/2026',
    },
  },
  {
    id: 'form-telehealth',
    kind: 'consent',
    name: 'Telehealth Policy',
    category: 'Consent',
    schema: 'Telehealth Policy',
    signatureRequired: true,
    about:
      'How video visits work here — what they are suitable for, what they are not, and what happens if the connection fails mid-visit.',
    sentOn: '06/02/2026',
    dueOn: null,
    appointmentId: null,
    status: 'completed',
    completedOn: '06/02/2026',
    revokedOn: null,
    revokeReason: '',
    answers: {
      understandsLimits: true,
      understandsFallback: true,
      consents: 'Yes',
      signedBy: 'Patient',
      date: '06/02/2026',
    },
  },
  {
    id: 'form-text-policy',
    kind: 'consent',
    name: 'Text Message Policy',
    category: 'Consent',
    schema: 'Text Message Policy',
    signatureRequired: true,
    about:
      'Whether we may text you appointment reminders and results notifications, and the number to use. Standard message rates apply and texts are not secure.',
    sentOn: '06/02/2026',
    dueOn: null,
    appointmentId: null,
    status: 'completed',
    completedOn: '06/04/2026',
    revokedOn: null,
    revokeReason: '',
    answers: {
      consents: 'Yes',
      mobile: '(808) 555-0111',
      reminders: true,
      results: false,
      understandsNotSecure: true,
      signedBy: 'Patient',
      date: '06/04/2026',
    },
  },
];


/* ============================================================================
   READING
   ========================================================================= */

/** Still to do. The single definition of the To complete / Completed split. */
export const isOutstanding = (form) => form.status !== 'completed';

/** Given and then taken back. Consents only — see `kind` above. */
export const isRevoked = (form) => form.status === 'revoked';

/**
 * A tab's half of the list.
 *
 * `which` is the split down the middle of either tab: what the patient still
 * has to deal with, and what is settled. A REVOKED CONSENT COUNTS AS
 * OUTSTANDING — the practice has no permission, which is the same situation
 * as never having been given it, and burying it under "Consent given" would
 * file it as the opposite of what it is.
 *
 * @param {'todo'|'completed'} which
 * @param {'form'|'consent'} [kind] both, when it is left out
 */
export const formsBy = (which, kind) =>
  FORMS.filter((form) => (kind ? form.kind === kind : true)).filter((form) =>
    which === 'completed' ? !isOutstanding(form) : isOutstanding(form)
  );

export const formById = (id) => FORMS.find((form) => form.id === id) ?? null;

/** The schema a form is filled in against, or null when the portal has none. */
export const schemaFor = (form) => (form?.schema ? FORM_SCHEMAS[form.schema] ?? null : null);

/**
 * What the side nav puts beside "Forms". Zero means no tag at all.
 *
 * `status === 'todo'`, NOT `isOutstanding` — the tag reads "3 Pending", and a
 * consent the patient deliberately withdrew is not work they owe anybody. It
 * is outstanding in the list, where the section it sits in explains itself;
 * it would be a chore in the nav, where nothing does.
 */
export const outstandingCount = () => FORMS.filter((form) => form.status === 'todo').length;

/* ============================================================================
   WRITING
   ========================================================================= */

/**
 * Submit one.
 *
 * The answers are kept whole, so the completed form can be read back exactly
 * as it was sent rather than re-derived from the patient's record — which by
 * then may have moved on. Guarded on the schema: a form the portal cannot
 * open is a form it must not mark as filled in here.
 */
export function completeForm(id, answers, completedOn) {
  const form = formById(id);
  if (!form || !form.schema) return null;

  form.status = 'completed';
  form.completedOn = completedOn;
  form.answers = answers;
  // Giving a consent again clears the withdrawal: what is on the record now is
  // permission, and a row that says both would say neither.
  form.revokedOn = null;
  form.revokeReason = '';
  return form;
}

/**
 * Take a consent back.
 *
 * WHAT IT DOES NOT DO IS DELETE ANYTHING. The versions stay exactly where they
 * were — the patient did give this consent, the practice did act on it, and a
 * withdrawal that erased the record would leave nothing to explain what
 * happened between the two dates. The row becomes outstanding again, carrying
 * the date it was withdrawn, and the signed version it is withdrawing stays
 * viewable and printable from the card.
 *
 * Guarded on `kind`: a form has answers, not permission, and there is nothing
 * in one to withdraw. The screen never offers it — this is the check that
 * makes that true rather than merely drawn.
 */
export function revokeConsent(id, revokedOn, reason = '') {
  const form = formById(id);
  if (!form || form.kind !== 'consent' || form.status !== 'completed') return null;

  form.status = 'revoked';
  form.revokedOn = revokedOn;
  form.revokeReason = reason;
  return form;
}
