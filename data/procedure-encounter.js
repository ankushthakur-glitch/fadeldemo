/**
 * DEMO DATA — the procedure encounter, either side of the scope.
 *
 * A procedure visit is three documents, not one: what the nurse and the
 * anaesthetist record before the patient goes under, what the endoscopist
 * records during, and what recovery records before the patient is allowed to
 * leave. They are signed by different people at different times, which is why
 * the encounter is staged rather than one long form.
 *
 * The in-procedure document is the colonoscopy report — it lives in
 * data/procedure-report.js, because it has its own findings-to-prose mechanic.
 */

/* --- The three stages -------------------------------------------------------- */

/*
 * The stages, in the order they must be worked.
 *
 * "Pre-anaesthesia", not "Pre-procedure": the two documents in this stage are
 * the post-anaesthesia report and the anaesthesia management record, and the
 * nurse's Pre-procedure checklist is a different artifact that is already
 * done before this stage opens. Naming the stage after the checklist made
 * them look like the same thing.
 *
 * `id` stays 'pre' — it is in URLs, testids and the DOM, and renaming a label
 * is not a reason to churn all three.
 */
export const ENCOUNTER_STAGES = [
  { id: 'pre', label: 'Pre-anaesthesia' },
  { id: 'intra', label: 'In-procedure' },
  { id: 'post', label: 'Post-procedure' },
];

/* --- Pre-procedure: the three documents -------------------------------------- */

/**
 * Who owns what before the scope goes in.
 *
 * The role sits above the title because on the day it is the question being
 * asked — the nurse is looking for their checklist, not for a document called
 * "Pre-procedure checklist".
 */
export const PRE_DOCUMENTS = [
  {
    id: 'checklist',
    role: 'Nurse',
    title: 'Pre-procedure checklist',
    staff: 'Kayla Brandt, RN',
    status: 'Signed',
    time: '07:48',
    tone: 'signed',
  },
  /*
   * The anaesthesia professional's own document — the front half of the
   * Anesthesia Procedure Note.
   *
   * It is the CRNA's, not the endoscopist's: the plan, the airway, and the two
   * statements that have to be true before induction. The airway and ASA
   * fields live here and nowhere else, because two documents holding one
   * Mallampati score is two scores that can disagree.
   *
   * The note's back half — times, recovery assessment, complications and the
   * signature — is step 3. One document, two steps, because they are filled in
   * at two different moments: this one before induction, that one after.
   */
  {
    id: 'preanaesthesia',
    role: 'CRNA',
    title: 'Pre-anaesthesia (CRNA)',
    staff: 'M. Osei, CRNA',
    status: 'Awaiting signature',
    time: '',
    tone: 'pending',
  },
  /*
   * The back half of the same note, and the third step rather than the fourth.
   *
   * It is titled "Post-anaesthesia" because that is what it records — the
   * times, the complications, the recovery assessment — and because the run
   * now reads as the three things that bracket the case (before, after, and
   * the assessment that clears the patient) followed by the log that was kept
   * throughout it.
   *
   * `id` stays 'report'. It is in testids and in state.preDoc, and a title
   * change is not a reason to churn either.
   */
  {
    id: 'report',
    role: 'Anaesthetist',
    title: 'Post-anaesthesia',
    staff: 'M. Osei, CRNA',
    status: 'Signed',
    time: '07:55',
    tone: 'signed',
  },
  /*
   * Last, and the one step that is not a document.
   *
   * It is the running log kept from induction to recovery, so it is open for
   * the whole case and closed by nothing of its own — which is why it sits at
   * the end of the run, under the nurse's Save & Sign, rather than in the
   * middle of documents that each terminate in a completed state.
   */
  {
    id: 'management',
    role: 'Nurse / Anaesthesia',
    title: 'Anaesthesia management',
    staff: 'K. Brandt, RN · M. Osei, CRNA',
    status: 'Recording',
    time: '',
    tone: 'recording',
  },
];

/** The nurse's checklist. Everything that has to be true before induction. */
export const PRE_PROCEDURE_CHECKLIST = [
  { id: 'identity', label: 'Patient identity confirmed against two identifiers', done: true },
  { id: 'site', label: 'Procedure and site confirmed with the patient', done: true },
  { id: 'consent', label: 'Signed consent present in the chart', done: true },
  { id: 'npo', label: 'NPO since midnight — confirmed verbally', done: true },
  { id: 'allergies', label: 'Allergies reviewed — egg, soy, amoxicillin', done: true },
  { id: 'anticoag', label: 'Anticoagulant held per protocol — apixaban, 5 days', done: true },
  { id: 'glp1', label: 'GLP-1 agonist held per protocol — semaglutide, 7 days', done: true },
  { id: 'iv', label: 'IV access established — 20G left antecubital', done: true },
  { id: 'prosthetics', label: 'Dentures, jewellery and contact lenses removed', done: true },
  { id: 'escort', label: 'Responsible escort present and contactable', done: false },
];

/* ============================================================================
   THE ANESTHESIA PROCEDURE NOTE

   One document, worked in two sittings, which is why it is spread over two
   steps rather than crammed into one long form nobody can be half-way through:

     step 2  what is planned  — procedure, indication, the airway, the two
                                statements that must be true before induction
     step 3  what happened    — times, recovery assessment, complications,
                                and the signature over the whole note

   The labels below are the note's own, spelled as the document spells them
   ("Anesthesia", not "anaesthesia"). That is the same convention the H&P and
   the Orders documents already follow on this screen: the surrounding app
   speaks British English, the clinical documents are reproduced verbatim.
   ========================================================================= */

/**
 * The three documents the anaesthesia step carries.
 *
 * All three are the CRNA's, and all three are worked in the room: the note
 * (what is planned and what happened), the consent (the patient's own
 * signature on it), and the orders (what is actually going into them).
 */
export const ANAESTHESIA_DOCUMENTS = [
  { id: 'note', label: 'Anesthesia Procedure Note', icon: 'stethoscope' },
  { id: 'consent', label: 'Anesthesia Consent Form', icon: 'paperclip' },
  { id: 'orders', label: 'Orders', icon: 'pill' },
];

/**
 * THE ANAESTHESIA CONSENT FORM.
 *
 * Reproduced as the document reads, and spelled as it spells itself. `{type}`
 * is the planned anaesthesia type from the assessment next door — the consent
 * has to name the technique the patient is consenting TO, and a consent form
 * carrying a different type from the note beside it is the one contradiction
 * this document cannot survive.
 *
 * TWO SIGNATURES, AND THEY ARE NOT THE SAME KIND.
 * The patient's is a mark: drawn or typed, captured, kept. The provider's is an
 * attestation by an identified clinician already logged in — a name and a
 * press, which is what "electronically signing" means for staff. Collecting a
 * drawn squiggle from the CRNA would be theatre; collecting only a press from
 * the patient would not be consent.
 */
/*
 * The consent form, in two cuts of the same wording.
 *
 * The opening sentence is the consent; the clause after it names the planned
 * technique, and whether that clause belongs depends on whether the host asked
 * for a technique. The clinic-visit screen does — its assessment carries an
 * anaesthesia type and the consent quotes it. The encounter's step run does
 * not: the type came off the pre-anaesthesia note, because it was being
 * answered twice and the head of the bed decides it anyway.
 *
 * Split rather than patched at the call site. A consent form that has a
 * sentence cut out of it by a string replace somewhere else in the codebase is
 * a consent form nobody can read to find out what it says.
 */
const CONSENT_OPENING =
  'I hereby consent to the administration of anesthesia/sedation as deemed necessary ' +
  'by the anesthesia provider.';

const CONSENT_TYPE_CLAUSE = ' The type of anesthesia planned is {type} or as otherwise indicated.';

const CONSENT_BODY = [
  'I understand that all forms of anesthesia involve some risks and no guarantees or ' +
    'assurances have been made to me concerning the results of the procedure. I have ' +
    'been given the opportunity to ask questions about the anesthesia, the procedure, ' +
    'risks, and my options, and my questions have been answered to my satisfaction.',
  'Risks discussed include but are not limited to: sore throat, nausea/vomiting, ' +
    'dental damage, allergic reaction, aspiration, respiratory depression, ' +
    'cardiovascular complications, and in rare cases, death.',
];

export const ANAESTHESIA_CONSENT = {
  title: 'Anesthesia Consent Form',
  paragraphs: [CONSENT_OPENING + CONSENT_TYPE_CLAUSE, ...CONSENT_BODY],
  /** The same form, for a host that does not record a planned type. */
  paragraphsWithoutType: [CONSENT_OPENING, ...CONSENT_BODY],
  patientHeading: 'Patient Signature',
  patientNote: 'Patient or authorized representative must sign below',
  providerHeading: 'Anesthesia Provider Electronic Signature',
  /* Says what signing is, not which control does it — the same sentence sits
     under a pad on the procedure run and under a pad on the clinic visit, and
     it named a Confirm button that neither of them has any more. */
  providerNote: 'Signing below electronically signs this consent form',
  provider: { name: 'M. Osei', role: 'Anesthesia Provider (CRNA)' },
};

/** The fallback when a booking carries no procedure of its own. The indication
 *  is not here: it is a field on the note, seeded from ANAESTHESIA_INDICATION
 *  below, and one string in two constants is two places for it to drift. */
export const PRE_ANAESTHESIA_PLAN = { procedure: 'Colonoscopy' };

export const ANAESTHESIA_TYPES = [
  'Monitored Anesthesia Care (MAC)',
  'Conscious Sedation',
  'General Anesthesia',
  'Topical Anesthesia Only',
];

export const ANAESTHESIA_INDICATION = 'Surveillance — prior adenomatous polyps';

/**
 * THE INDICATIONS THIS UNIT ACTUALLY LISTS, OFFERED RATHER THAN ENFORCED.
 *
 * The indication arrives on both pre-op documents already filled in — off the
 * booking, through `fromCase` (see js/lib/encounter-docs.js) — and it has
 * always been typed over when it was wrong. What it had no way of doing was
 * showing the physician what the unit's other cases are booked as, so a
 * surveillance case that turned into a bleeding workup between the desk and
 * the bay was re-worded from scratch, in whatever words came to hand, on a
 * field that ends up on the report and in the coder's queue.
 *
 * So the field is a type-or-pick box over this list: nine cases in ten are one
 * of these lines and are one press, and the tenth is still whatever the
 * physician types, because a closed list on the one field that has to be able
 * to say something new would be the drift it was meant to stop. The list is
 * the unit's own vocabulary — the same complaints the schedule books against —
 * not a coding taxonomy; the ICD-10 codes are asked for separately on the
 * report, where they are claimed.
 *
 * ANAESTHESIA_INDICATION leads it because it is the prototype's own default,
 * and a fallback that is not in the list it is offered beside would read as a
 * value somebody had already typed over.
 */
export const PROCEDURE_INDICATIONS = [
  ANAESTHESIA_INDICATION,
  'Screening colonoscopy — average risk',
  'Surveillance — family history of colorectal cancer',
  'Positive FIT',
  'Iron deficiency anaemia',
  'Rectal bleeding',
  'Chronic diarrhoea, ?IBD',
  'Altered bowel habit',
  'Abdominal pain — under investigation',
  'Weight loss — under investigation',
  'Dysphagia',
  'GORD, poor PPI response',
  'Barrett’s surveillance',
  'Coeliac disease — duodenal biopsy',
];

/**
 * The single line on the note that is answered before anything else.
 *
 * It sits on the note's cover rather than in the assessment below because it
 * is a statement about the chart, not about this airway — the chart was read
 * and brought up to date, which is what makes every answer under it worth
 * having.
 */
export const ANAESTHESIA_NOTE_CHECKS = [
  {
    id: 'pmhx',
    label: 'PMHX/Allergies/Medications/Labs: Reviewed and updated in EMR',
    done: false,
  },
];

/**
 * The answer that is not an answer.
 *
 * "Other" on a chest or a heart tells the next reader that this patient is not
 * normal and then refuses to say how — which is the one thing the row was
 * asking. So the two rows that offer it carry the field that finishes the
 * sentence, and the assessment will not file until that field is filled.
 *
 * Declared here rather than at the two render sites. Both the encounter's step
 * run and the clinic-visit screen draw AIRWAY_FIELDS, and two declarations of
 * one follow-up is two different questions about one chest.
 */
export const AIRWAY_OTHER = 'Other';

/**
 * The airway, as the note asks for it.
 *
 * Row order matters: the note lays these out two to a row, and the pairing —
 * ASA beside Mallampati, dentition beside neck movement, lungs beside heart —
 * is how the assessment is read back. The two follow-up fields are NOT part of
 * that pairing and are drawn under it, so choosing Other does not shunt the
 * heart onto a row of its own.
 */
export const AIRWAY_FIELDS = [
  { id: 'asa', label: 'ASA Classification', options: ['I', 'II', 'III', 'IV'], value: 'III' },
  {
    id: 'mallampati',
    label: 'Mallampati Classification',
    options: ['Class 1', 'Class 2', 'Class 3', 'Class 4'],
    value: 'Class 2',
  },
  { id: 'dentition', label: 'Dentition', options: ['Intact', 'Loose', 'Dentures'], value: 'Intact' },
  { id: 'neck', label: 'Neck ROM', options: ['Normal', 'Limited'], value: 'Normal' },
  {
    id: 'lungs',
    label: 'Lungs',
    options: ['Normal', AIRWAY_OTHER],
    value: 'Normal',
    other: {
      id: 'lungsOther',
      label: 'Lungs — other findings',
      placeholder: 'What was heard, and where',
    },
  },
  {
    id: 'cardio',
    label: 'CV (Cardiovascular)',
    options: ['Normal', AIRWAY_OTHER],
    value: 'Normal',
    other: {
      id: 'cardioOther',
      label: 'CV — other findings',
      placeholder: 'What was found',
    },
  },
];

/** The two statements that close the pre-anaesthesia assessment. */
export const ANAESTHESIA_CHECKS = [
  {
    id: 'reviewed',
    label: 'Anesthesia type, risks, and ASA class reviewed with patient, and consent obtained',
    done: false,
  },
  { id: 'npo', label: 'NPO Status adequate', done: false },
];

export const ANAESTHESIA_TIMES = { start: '08:04', stop: '' };

/* --- Pre-sedation assessment ------------------------------------------------
   What the nurse establishes before anything is given. Three questions the
   record could not answer before: how hard this airway will be, whether the
   patient is actually fasted, and whether the room is ready to rescue them.

   All three are ASSESSMENTS rather than statements — each is worked out from
   answers rather than typed in — which is why they are here as inputs and a
   rule rather than as a stored conclusion somebody would have to remember to
   update.
   -------------------------------------------------------------------------- */

/**
 * STOP-BANG. Eight yes/no questions, and the score is the whole point.
 *
 * Obstructive sleep apnoea is the single commonest reason a routine sedation
 * becomes an airway emergency, and it is usually undiagnosed — the patient
 * cannot tell you they have it. Three or more here changes the plan: deeper
 * monitoring, a lower target depth, or an anaesthetist rather than nurse-
 * administered sedation.
 *
 * `hint` is what the nurse asks out loud. The letters are a mnemonic for
 * whoever already knows the tool; the question is for everyone else.
 */
export const STOP_BANG_QUESTIONS = [
  { id: 'snore', letter: 'S', label: 'Snoring', hint: 'Loudly enough to be heard through a closed door?' },
  { id: 'tired', letter: 'T', label: 'Tired', hint: 'Often tired or sleepy during the daytime?' },
  { id: 'observed', letter: 'O', label: 'Observed apnoea', hint: 'Has anyone seen them stop breathing in their sleep?' },
  { id: 'pressure', letter: 'P', label: 'Pressure', hint: 'Treated for high blood pressure?' },
  { id: 'bmi', letter: 'B', label: 'BMI over 35', hint: 'Body mass index above 35 kg/m².' },
  { id: 'age', letter: 'A', label: 'Age over 50', hint: 'Older than 50 years.' },
  { id: 'neck', letter: 'N', label: 'Neck over 40 cm', hint: 'Collar size 16 inches or more.' },
  { id: 'gender', letter: 'G', label: 'Male', hint: 'Recorded sex is male.' },
];

/**
 * The bands, and what each one is FOR.
 *
 * A score with no consequence attached is a number nobody acts on, so each
 * band carries the thing it changes about today.
 */
export const STOP_BANG_BANDS = [
  { max: 2, label: 'Low risk', tone: 'success', action: 'Standard monitoring is appropriate.' },
  {
    max: 4,
    label: 'Intermediate risk',
    tone: 'warning',
    action: 'Capnography throughout, and keep the airway trolley at the bedside.',
  },
  {
    max: 8,
    label: 'High risk',
    tone: 'critical',
    action: 'Discuss with the anaesthetist before induction — consider MAC rather than nurse-administered sedation.',
  },
];

export const stopBangBand = (score) =>
  STOP_BANG_BANDS.find((band) => score <= band.max) ?? STOP_BANG_BANDS.at(-1);

/**
 * The fasting rule, in hours.
 *
 * ASA guidance, and the two numbers people mix up: clear fluids are safe at
 * two hours, everything else needs six. A patient who had tea with milk at
 * 06:00 is NOT a clear-fluid patient, which is exactly the mistake the record
 * has to be able to catch — so the two are asked separately rather than as one
 * "when did you last eat or drink".
 */
export const NPO_RULE = { solids: 6, fluids: 2 };

/**
 * What has to be in the room before anything is given.
 *
 * Every one of these is something you need in the sixty seconds after a
 * sedation goes wrong, and every one of them is useless if it is fetched then.
 * They are checked off against the room, not against a memory of the room.
 */
export const SEDATION_READINESS = [
  { id: 'suction', label: 'Suction connected and tested' },
  { id: 'oxygen', label: 'Oxygen source and delivery device to hand' },
  { id: 'airway', label: 'Airway trolley in the room — sizes checked' },
  { id: 'reversal', label: 'Reversal agents drawn up and labelled' },
  { id: 'monitor', label: 'Monitor alarms on, limits set for this patient' },
  { id: 'access', label: 'IV access patent and running' },
];

/* --- Charting the case: phases, scales and the logs they file into ---------- */

/**
 * The phases anything charted during a case is filed against.
 *
 * One list, not two. There used to be a second — the depth-of-sedation ladder
 * (pre-sedation, induction, maintenance, emergence, recovery) — on the theory
 * that the anaesthetist charts depth and the nurse charts position. In practice
 * the two lists only ever disagreed: a vital filed under "Maintenance" and an
 * Aldrete filed under "Intra Procedure" describe the same minute of the same
 * case, and nothing downstream could line them up. Depth of sedation is already
 * recorded, properly and on the reading itself, as the Ramsay score.
 *
 * Discharge is the fourth because it is a real charting moment and not a
 * synonym for post: the last set of observations before the patient leaves is
 * the one the discharge decision rests on, and burying it in "Post" loses it.
 *
 * The words are deliberately bare — "Pre", not "Pre Procedure". These render as
 * badges in a dense log table beside a time and a blood pressure, and the
 * "Procedure" half of every label was the same on every row.
 */
export const PROCEDURE_PHASES = ['Pre', 'Intra', 'Post', 'Discharge'];

/**
 * The Ramsay Sedation Scale, 1–6.
 *
 * A closed list rather than a typed number, because the number on its own is
 * not the observation — "3" means "responds to commands only", and a nurse
 * reading the log back needs the sentence, not the digit.
 */
export const RAMSAY_SCALE = [
  { value: '1', label: '1 — Anxious, agitated or restless' },
  { value: '2', label: '2 — Cooperative, oriented, tranquil' },
  { value: '3', label: '3 — Responds to commands only' },
  { value: '4', label: '4 — Brisk response to stimulus' },
  { value: '5', label: '5 — Sluggish response to stimulus' },
  { value: '6', label: '6 — No response' },
];

/**
 * The observation log.
 *
 * `high` marks a reading outside range. It is set on the record rather than
 * worked out at paint time because what counts as out of range depends on the
 * patient's baseline, and the baseline is not in this prototype.
 */
export const VITALS_LOG = [
  { time: '08:02', phase: 'Pre', bp: '138/84', hr: 76, spo2: 98, resp: 16, ramsay: 1, pain: 0, by: 'KB' },
  { time: '08:06', phase: 'Intra', bp: '142/88', hr: 82, spo2: 97, resp: 14, ramsay: 3, pain: 0, by: 'MO' },
  { time: '08:11', phase: 'Intra', bp: '164/96', hr: 91, spo2: 96, resp: 12, ramsay: 4, pain: 0, by: 'MO', high: true },
  { time: '08:16', phase: 'Intra', bp: '158/92', hr: 88, spo2: 97, resp: 13, ramsay: 4, pain: 0, by: 'MO', high: true },
];

export const MEDICATION_LOG = [
  { time: '08:04', name: 'Midazolam', dose: '2 mg', route: 'IV', category: 'sedation', by: 'MO' },
  { time: '08:05', name: 'Fentanyl', dose: '50 mcg', route: 'IV', category: 'analgesic', by: 'MO' },
  { time: '08:09', name: 'Propofol', dose: '60 mg', route: 'IV', category: 'sedation', by: 'MO' },
];

/* ============================================================================
   WHAT WAS GIVEN, BY PATIENT

   The log above belongs to the case being charted; this is the same fact filed
   against the person, so the chart can read it back later. Keyed by MRN and
   grouped by the procedure it was given during, because a patient accumulates
   several over the years and "2 mg of midazolam" means nothing without the
   case it was given in.

   The open case's own rows are NOT retyped here — MEDICATION_LOG itself is
   the value, so the seeded record the chart reads and the one the encounter
   opens on are one text rather than two copies to keep in step. The encounter
   clones it into its editable state on load, so drugs given live in a session
   stay in that session; a real system would write them back on sign-off.

   `by` is a full name rather than the log's initials: on the encounter the
   initials sit beside the person who wrote them, and in the chart months later
   there is nobody to ask what MO stood for.
   ========================================================================= */
export const ADMINISTERED_MEDICATIONS = {
  /* Marcus Adeyemi — the case the encounter screen opens on (ap28), so the
     procedure and date are the booking's own: 07:30 on 4 Aug 2026, surveillance
     colonoscopy. He has no chart record in data/patient-chart.js yet, so this
     is not reachable from a chart today; it is filed against him rather than
     against whoever does have one, because a sedation record belongs to the
     person who was sedated. */
  326490: [
    {
      procedure: 'Colonoscopy — surveillance',
      date: '2026-08-04',
      location: 'Red River ASC',
      by: 'M. Osei, CRNA',
      meds: MEDICATION_LOG,
    },
  ],

  /* Henna West — her last visit, 23 Oct 2025, which is what her chart header
     already says and what her surveillance recall is counted from. */
  326486: [
    {
      procedure: 'Colonoscopy — surveillance',
      date: '2025-10-23',
      location: 'Red River ASC',
      by: 'M. Osei, CRNA',
      meds: [
        { time: '09:12', name: 'Midazolam', dose: '2 mg', route: 'IV', category: 'sedation' },
        { time: '09:13', name: 'Fentanyl', dose: '50 mcg', route: 'IV', category: 'analgesic' },
        { time: '09:41', name: 'Ondansetron', dose: '4 mg', route: 'IV', category: 'antiemetic' },
      ],
    },
  ],

  /* Liam Rodriguez — an EGD where the sedation had to be reversed. Kept in the
     demo data because a reversal is the one entry anybody goes looking for. */
  326481: [
    {
      procedure: 'EGD — diagnostic',
      date: '2026-08-02',
      location: 'Red River ASC',
      by: 'M. Osei, CRNA',
      meds: [
        { time: '10:04', name: 'Midazolam', dose: '3 mg', route: 'IV', category: 'sedation' },
        { time: '10:22', name: 'Flumazenil', dose: '0.2 mg', route: 'IV', category: 'reversal' },
      ],
    },
  ],
};

/**
 * The quick-select formulary.
 *
 * `reversal` agents are marked here rather than matched by name at the call
 * site, so adding naloxone's siblings later does not mean remembering to
 * update a list of strings somewhere else.
 *
 * WHY A DRUG HAS THREE NAMES HERE.
 * `name` is what the cart and the record call it — the generic, which is what
 * gets charted. `generic` states it again explicitly rather than leaving the
 * reader to infer that `name` happens to be one, and `brand` is what is
 * actually printed on the vial somebody is holding. A nurse looking for
 * Versed in an inventory that only lists Midazolam is looking for a drug the
 * practice stocks and cannot find, which is how a second one gets ordered.
 *
 * `strength` is the concentration in the vial — the inventory calls it that
 * now, because "strength" was being read as the dose and they are not the
 * same number.
 *
 * WHY EACH DRUG CARRIES A LADDER OF DOSES AND NOT JUST ITS USUAL ONE.
 * `dose` is what gets pre-filled when the drug is picked — the first increment,
 * the one that is right most of the time. `doses` is the short list of amounts
 * that are actually drawn up for it, and it exists because the administration
 * log asks for the dose as a DROPDOWN now rather than as a typed box. A typed
 * box accepts "2mg", "2 mg", "2.0mg" and "20 mg" with equal enthusiasm, and
 * only one of those is a keystroke away from a tenfold error at the head of the
 * bed. The ladder belongs to the drug because a dose list is meaningless
 * without one: 50 mcg is a fentanyl dose and a lethal-sounding nonsense against
 * midazolam, and a single list mixing mg and mcg offers both to whoever is
 * holding the syringe.
 */
export const SEDATION_FORMULARY = [
  { name: 'Midazolam', generic: 'Midazolam', brand: 'Versed', strength: '1 mg/ml', dose: '1 mg', doses: ['0.5 mg', '1 mg', '2 mg', '3 mg', '5 mg'], route: 'IV', category: 'sedation' },
  { name: 'Fentanyl', generic: 'Fentanyl citrate', brand: 'Sublimaze', strength: '25 mcg/ml', dose: '25 mcg', doses: ['25 mcg', '50 mcg', '75 mcg', '100 mcg'], route: 'IV', category: 'analgesic' },
  { name: 'Propofol', generic: 'Propofol', brand: 'Diprivan', strength: '10 mg/ml', dose: '20 mg', doses: ['10 mg', '20 mg', '30 mg', '40 mg', '60 mg', '80 mg'], route: 'IV', category: 'sedation' },
  { name: 'Ondansetron', generic: 'Ondansetron', brand: 'Zofran', strength: '4 mg', dose: '4 mg', doses: ['4 mg', '8 mg'], route: 'IV', category: 'antiemetic' },
  { name: 'Flumazenil', generic: 'Flumazenil', brand: 'Romazicon', strength: '0.1 mg/ml', dose: '0.2 mg', doses: ['0.2 mg', '0.3 mg', '0.5 mg', '1 mg'], route: 'IV', category: 'reversal', reversal: true },
  { name: 'Naloxone', generic: 'Naloxone hydrochloride', brand: 'Narcan', strength: '0.4 mg/ml', dose: '0.4 mg', doses: ['0.1 mg', '0.2 mg', '0.4 mg', '0.8 mg'], route: 'IV', category: 'reversal', reversal: true },
];

/**
 * The dose list a drug the cart does not stock falls back to.
 *
 * The medication field is typed as well as picked — somebody can name a drug
 * that is not on this formulary at all — and a dose dropdown that empties
 * itself the moment they do is a dropdown that cannot be answered. So the union
 * of every ladder above stands in until a known drug narrows it. Derived rather
 * than written out, because a seventh drug added to the formulary should not
 * also have to be remembered here. Sorted by unit and then by amount, because
 * derived order is the order the drugs happen to be listed in, and a dropdown
 * reading 0.5, 1, 2, 25 mcg, 10, 20 is a list nobody can scan.
 */
export const MEDICATION_DOSES = [
  ...new Set(SEDATION_FORMULARY.flatMap((d) => d.doses)),
].sort((a, b) => {
  const [aAmount, aUnit] = a.split(' ');
  const [bAmount, bUnit] = b.split(' ');
  return aUnit === bUnit ? Number(aAmount) - Number(bAmount) : aUnit.localeCompare(bUnit);
});

export const REVERSAL_NOTE = {
  heading: 'Reversal agents flag a sedation event.',
  detail:
    'Administering flumazenil or naloxone creates a complication record automatically and is reported in quality metrics.',
};

/**
 * A drug that is cross-reactive with a known allergy class, matched against
 * the patient's allergy list by keyword. Deliberately small and explicit —
 * this is a prototype safety prompt, not a drug-interaction engine — but
 * Propofol's egg/soy lecithin risk is real, and the bay's pre-procedure sheet
 * asks for egg and soy by name for exactly this reason (ALLERGY_CHECKS in
 * data/pre-check.js). This is the prompt at the point of administration.
 */
export const MEDICATION_ALLERGY_RULES = {
  Propofol: {
    keywords: ['egg', 'soy'],
    note: 'Propofol is formulated in an egg/soy lecithin emulsion.',
  },
};

export const MEDICATION_ROUTES = ['IV', 'IM', 'PO', 'SL', 'Topical', 'PR'];
export const MEDICATION_CATEGORIES = [
  'sedation', 'analgesic', 'antiemetic', 'reversal', 'antibiotic', 'other',
];

/**
 * The units a default dose is expressed in.
 *
 * The formulary form asks for an amount and a unit separately rather than for
 * one typed string, for the same reason the administration log offers its dose
 * as a dropdown: a free box takes "2mg", "2 mg" and "20 mg" with equal
 * enthusiasm and only one of them is right. Split, the amount is the only
 * thing anybody types and every dose on the cart list is spelled one way.
 *
 * Derived from the units the seeded formulary actually uses and then topped up
 * with the rest, rather than written out, so a unit that is already in the data
 * can never be missing from the list that has to round-trip it. A drug carrying
 * something stranger than these — a rate like mg/kg/hr — keeps it: the form
 * adds whatever it was given to the top of the list rather than quietly
 * rewriting the dose to the first option (see unitOptions in
 * js/screens/clinic-visit.js).
 */
export const MEDICATION_UNITS = [
  ...new Set([
    ...SEDATION_FORMULARY.map((drug) => drug.dose.split(' ')[1]).filter(Boolean),
    'mg', 'mcg', 'g', 'ml', 'units', 'mEq',
  ]),
];

/*
 * One bag still up and one already down, because the IV log is two tables now
 * — running and completed — and a seed where every row is Active leaves the
 * second of them empty on a screen whose whole point is that a bag moves from
 * the first to the second when it is ended.
 */
export const IV_SOLUTIONS = [
  {
    time: '07:42:00',
    solution: 'Lactated Ringer’s',
    volume: '1000',
    rate: '100',
    status: 'Completed',
    infused: '750 ml',
  },
  { time: '08:01:00', solution: 'Sodium chloride 0.9%', volume: '500', rate: '125', status: 'Active' },
];

/** Standing rates, in ml/h. Volume is typed — bags come in sizes the list
 *  would only ever be a subset of. */
export const IV_RATES = ['50', '75', '100', '125', '150', '200'];

export const IV_SOLUTION_TYPES = [
  'Sodium chloride 0.9%',
  'Lactated Ringer’s',
  'Dextrose 5% in water',
  'Sodium chloride 0.45%',
];

export const OXYGEN_LOG = [
  { time: '08:04:00', delivery: 'Nasal cannula', flow: '2', status: 'Active' },
];

export const OXYGEN_DELIVERY = [
  'Nasal cannula', 'Simple face mask', 'Non-rebreather mask', 'Room air',
];

/* --- Post-procedure: the Aldrete score --------------------------------------- */

/**
 * The modified Aldrete score, 0–2 per category.
 *
 * The options carry their own points so the total is derived, never typed —
 * the same principle as the findings narrative. Eight out of ten is the
 * discharge threshold, and the panel says so rather than leaving recovery to
 * remember it.
 */
export const ALDRETE_CATEGORIES = [
  {
    id: 'activity',
    /* "Activity level", not "Activity". On its own the word reads as a yes/no
       about whether the patient is moving; what is being scored is HOW MUCH
       they move on command, which is a level. Named once here so the form, the
       history table and the post-anaesthesia record all ask it the same way. */
    label: 'Activity level',
    options: [
      { label: 'Four limbs on command', points: 2 },
      { label: 'Two limbs on command', points: 1 },
      { label: 'No movement on command', points: 0 },
    ],
    value: 2,
  },
  {
    id: 'respiration',
    label: 'Respiration',
    options: [
      { label: 'Breathes and coughs freely', points: 2 },
      { label: 'Dyspnoea or limited breathing', points: 1 },
      { label: 'Apnoeic', points: 0 },
    ],
    value: 2,
  },
  {
    id: 'circulation',
    label: 'Circulation',
    options: [
      { label: 'BP ±20 mmHg of baseline', points: 2 },
      { label: 'BP ±20–50 mmHg', points: 1 },
      { label: 'BP ±50 mmHg or more', points: 0 },
    ],
    value: 1,
  },
  {
    id: 'consciousness',
    label: 'Consciousness',
    options: [
      { label: 'Fully awake', points: 2 },
      { label: 'Rousable on calling', points: 1 },
      { label: 'Not responding', points: 0 },
    ],
    value: 2,
  },
  {
    id: 'oxygen',
    label: 'Oxygen saturation',
    options: [
      { label: 'Above 92% on room air', points: 2 },
      { label: 'Supplemental oxygen needed to stay above 90%', points: 1 },
      { label: 'Below 90% with oxygen', points: 0 },
    ],
    value: 2,
  },
];

export const ALDRETE_THRESHOLD = 8;

/**
 * The moments an Aldrete score is actually taken at.
 *
 * Not PROCEDURE_PHASES, and the difference is the point. That list is the four
 * stages anything charted during a case is filed against — a blood pressure is
 * read in every one of them, including the middle of the procedure. An Aldrete
 * score is not: it is a recovery instrument, and it is asked three times.
 * Baseline before anything is given, so there is something to have come back
 * TO; once the patient is out; and again at the door. Offering "Intra" beside
 * those invited a score to be filed against a sedated patient mid-scope, which
 * is a number that means nothing — every category is scored on response to
 * command, and a patient at Ramsay 4 has no responses to score.
 *
 * "Baseline" rather than "Pre" for the same reason the score exists: circulation
 * is scored as BP within ±20 mmHg OF BASELINE, so the first reading is not
 * merely the earliest one, it is the one everything after it is measured
 * against. Naming it "Pre" made it look like one of a series.
 */
export const ALDRETE_PHASES = ['Baseline', 'Post Procedure', 'Discharge'];

/* --- Post-anaesthesia: the handover statement --------------------------------- */

/**
 * The one line the anaesthesia professional signs the recovery handover on.
 *
 * It is a single statement rather than four tick-boxes because it is asserted
 * as a whole: mental status back to baseline, awake, observations stable, and
 * the verbal report actually given to the nurse taking over. Splitting it would
 * invite three of the four to be ticked and the fourth — the handover itself,
 * the only part that involves another person — to be the one left out.
 *
 * Spelled "anesthesia" because it is the note's own wording; the surrounding
 * app speaks British English and the clinical documents are reproduced verbatim.
 */
export const POST_ANAESTHESIA_ASSESSMENT = {
  id: 'post-assessment',
  label:
    "Patient's mental status returned to baseline, awake, VS stable, and a report given to RN",
  /*
   * The box under the statement, for the recovery a tick cannot describe.
   *
   * The statement above is asserted whole or not at all, which is what makes
   * it worth signing and also what makes it silent about everything either
   * side of it: a slow emergence that resolved, the name of the nurse the
   * report was actually given to, a patient held twenty minutes longer than
   * the room expected. None of those are complications — the card below asks
   * that question and would be the wrong place to file them — and none of them
   * fit inside a sentence that is either true or untrue.
   *
   * Optional, and deliberately so. Required, it would ask for a paragraph on
   * the nine cases in ten where the tick says everything there is to say, and
   * a box that must be filled on an uneventful recovery gets filled with
   * "uneventful" — which is worse than an empty box, because it looks like an
   * observation.
   */
  note: {
    id: 'post-assessment-note',
    label: 'Assessment Notes',
    placeholder: 'Anything about the recovery the statement above does not cover',
  },
};

/**
 * Did anything go wrong, and if so what — asked once, worded once.
 *
 * Two documents ask it: the anaesthesia procedure note on the clinic-visit
 * screen and the post-anaesthesia record in the procedure run — where, until
 * recently, it was not asked at all and a case that went wrong could only be
 * inferred from silence. The wording lives here so the two cannot end up naming
 * the same event differently.
 *
 * They ask it in different SHAPES, deliberately. The clinic note is where the
 * case is written up at length, so it keeps the two-option choice and the
 * description behind it — `none`, `occurred` and `detail` below are what it
 * reads. The run's record asks the same question in the same shape but does not
 * require the description: the account belongs on the note, and a required box
 * here would ask the same person to write the same paragraph twice.
 *
 * There, the description appears only once something is being described. "None"
 * is the answer nine times in ten, and an empty box under it invites the tenth
 * to be recorded as a shrug.
 */
export const ANAESTHESIA_COMPLICATIONS = {
  id: 'complications',
  label: 'Anesthesia Complications',
  none: 'None',
  occurred: 'Complications occurred',
  detail: {
    id: 'complication-detail',
    label: 'Describe Complications',
    placeholder: 'Describe any complications that occurred',
  },
};

/* The two options in the order the record offers them — None first, because
   it is both the common answer and the safe default to open holding. */
export const ANAESTHESIA_COMPLICATION_OPTIONS = [
  ANAESTHESIA_COMPLICATIONS.none,
  ANAESTHESIA_COMPLICATIONS.occurred,
];

/* --- Post-procedure: discharge ------------------------------------------------ */

export const DISCHARGE_CRITERIA = [
  { id: 'aldrete', label: 'Aldrete score 8 or above', done: true, derived: true },
  { id: 'vitals', label: 'Vital signs stable and within normal limits', done: true },
  { id: 'bleeding', label: 'No active bleeding', done: true },
  { id: 'pain', label: 'Pain adequately controlled', done: true },
  { id: 'oriented', label: 'Patient alert and oriented', done: true },
  { id: 'education', label: 'Patient education provided', done: true },
  { id: 'understanding', label: 'Patient demonstrates understanding', done: true },
  { id: 'transport', label: 'Transportation arranged', done: true },
];

/**
 * The five lines recovery reads back before releasing a patient.
 *
 * A shorter list than DISCHARGE_CRITERIA on purpose. That one is the full
 * discharge workup the post-procedure document works through — education
 * given, understanding demonstrated, transport arranged. This is the bedside
 * readiness check the nursing record shows beside the Aldrete score, and it
 * carries only what the score is read against.
 *
 * `derived: true` marks the line the sheet answers for itself: the Aldrete
 * threshold is computed from the score, never ticked by hand.
 */
export const DISCHARGE_READINESS_CHECKS = [
  { id: 'aldrete', label: 'Aldrete Score ≥8 points', derived: true },
  { id: 'vitals', label: 'Stable vital signs' },
  { id: 'bleeding', label: 'No active bleeding' },
  { id: 'pain', label: 'Pain adequately controlled' },
  { id: 'oriented', label: 'Patient alert and oriented' },
];

export const DISCHARGE_DESTINATIONS = [
  'Home', 'Skilled nursing facility', 'Transferred to hospital', 'Observation',
];
export const DISCHARGE_MODES = ['Ambulatory', 'Wheelchair', 'Stretcher'];

/**
 * Who the patient physically leaves with.
 *
 * A different question from TRANSPORT_METHODS, which is the vehicle, and from
 * DISCHARGE_MODES, which is whether they walk out or are wheeled. Sedation is
 * the reason all three are asked: a patient can be discharged Ambulatory, by
 * private car, and still be leaving with nobody — which is the one combination
 * an ASC may not release. Naming the escort's RELATIONSHIP here and their name
 * in the field beside it keeps the reportable fact (was there a responsible
 * adult) separate from the identifying one (who).
 *
 * The last option is deliberately not "Alone". A patient may legitimately
 * leave unaccompanied when no sedation was given, and an option that only says
 * "Alone" invites it to be chosen for a sedated patient as the nearest fit.
 */
export const DISCHARGE_WITH = [
  'Responsible adult',
  'Family member',
  'Friend',
  'Caregiver',
  'Facility staff',
  'Unaccompanied — no sedation given',
];
export const TRANSPORT_METHODS = [
  'Private vehicle — accompanied',
  'Taxi or rideshare — accompanied',
  'Ambulance',
  'Facility transport',
];

/** UB-04 patient discharge status codes, which is why the code leads. */
export const DISCHARGE_STATUSES = [
  '01 — Discharged home / self-care',
  '02 — Transferred to short-term hospital',
  '06 — Discharged to home health service',
  '07 — Left against medical advice',
];

export const DISCHARGE_INSTRUCTION_SETS = [
  'Post-polypectomy — standard',
  'Post-colonoscopy — standard',
  'Post-EGD — standard',
  'Post-polypectomy — large lesion',
];

export const DISCHARGE_DEFAULTS = {
  instructionsAt: '09:18',
  destination: 'Home',
  mode: 'Wheelchair',
  transport: 'Private vehicle — accompanied',
  /* The escort's RELATIONSHIP, defaulted; their NAME never is. A pre-filled
     name is a claim about a specific person nobody at the desk made. */
  dischargeWith: 'Responsible adult',
  time: '09:26',
  status: '01 — Discharged home / self-care',
  instructions: 'Post-polypectomy — standard',
  recordedBy: 'K. Brandt, RN',
};

/* --- Post-procedure: the instruction sheet the patient goes home with --------
   DISCHARGE_INSTRUCTION_SETS above names the sheet on the nurse's record — it
   is the field the discharge document files, and it is one line of a form. This
   is the sheet ITSELF: the page that is printed, read aloud at the chair and
   handed over with the report. The two are deliberately the same list, keyed by
   the same strings, because a record that says "Post-EGD — standard" was given
   and a handout that says something else is the failure this whole section
   exists to prevent.

   A sedated patient reads none of this on the day. The person who does is
   whoever collected them, hours later, at home — which is why the sheet is
   written in the second person, why the warning signs are their own block in
   their own colour, and why every line is an instruction rather than a finding.

   WHERE IT IS RENDERED. On the desk's check-out, above the desk's own
   questions — not on a document of its own beside the discharge record. Reading
   the sheet back and closing the visit are one conversation with one person at
   one counter, and a handout on its own row could be marked as handed over by
   somebody who was not holding it out. See DOC_LEADS in js/screens/encounter.js.
   -------------------------------------------------------------------------- */

/**
 * What every sheet says, whatever was done.
 *
 * These are the sedation instructions, not the procedure's: they follow from
 * the anaesthetic and so are true of all four sets. Anything specific to what
 * the scope did is added or replaced per set below.
 */
const DISCHARGE_SHEET_BASE = {
  activity: [
    'Do not drive or operate any heavy machinery today',
    'Do not make important decisions or sign legal documents today',
    'Rest for the remainder of the day',
  ],
  diet: [
    'You can resume your regular diet',
    'Start with a light meal and advance as tolerated',
    'Avoid drinking alcohol today',
    'Drink plenty of fluids and keep yourself well hydrated',
  ],
  warnings: [
    'Worsening severe abdominal pain',
    'Persistent fever greater than 101°F (38.3°C)',
    'Persistent nausea or vomiting',
    'Passing black or red blood per rectum (more than 2 teaspoons)',
    'Pain or redness at the site where the intravenous needle was placed',
  ],
};

/**
 * How each set differs from that base.
 *
 * `add` appends to a list, `replace` swaps it out. Both, rather than four
 * complete sheets: the sedation lines are the same words on every one of them,
 * and four copies of the same paragraph is four places for the practice's
 * wording to drift apart. What differs really is only what the scope did — a
 * lifting restriction after a polypectomy, a numb throat after an EGD — and
 * writing only the difference is what makes the difference readable.
 *
 * Post-EGD replaces both diet and warnings rather than adding to them, because
 * neither is an addition: nothing is eaten until the throat spray wears off,
 * and "blood per rectum" is the wrong organ to be watching after an upper
 * endoscopy. A warning aimed at the wrong end is worse than no warning, since
 * it teaches the reader that the list is generic and can be skimmed.
 */
export const DISCHARGE_INSTRUCTION_SHEETS = {
  'Post-colonoscopy — standard': {
    add: {
      diet: ['Bloating and wind are normal for a few hours — walking helps'],
    },
  },

  'Post-polypectomy — standard': {
    add: {
      activity: ['No strenuous exercise or heavy lifting for 7 days'],
      diet: ['Avoid spicy or heavily seasoned food for 24 hours'],
    },
  },

  /* The one set with a delayed-bleeding window long enough to matter, so the
     restrictions are counted in weeks and air travel is named: a bleed at
     37,000 feet is hours from the nearest endoscopy suite. */
  'Post-polypectomy — large lesion': {
    add: {
      activity: [
        'No strenuous exercise or heavy lifting for 14 days',
        'Do not fly for 14 days without speaking to us first',
      ],
    },
    replace: {
      diet: [
        'Clear liquids only for the rest of today',
        'Soft diet for the next 48 hours, then return to your regular diet',
        'Avoid drinking alcohol for 7 days',
        'Drink plenty of fluids and keep yourself well hydrated',
      ],
    },
  },

  'Post-EGD — standard': {
    add: {
      activity: ['Your throat may feel sore for a day or two — this is expected'],
    },
    replace: {
      diet: [
        'Do not eat or drink until the numbness in your throat has worn off, about 1 hour',
        'Start with cool liquids, then a light meal as tolerated',
        'Avoid drinking alcohol today',
        'Drink plenty of fluids and keep yourself well hydrated',
      ],
      warnings: [
        'Worsening severe abdominal or chest pain',
        'Persistent fever greater than 101°F (38.3°C)',
        'Vomiting blood, or material that looks like coffee grounds',
        'Black, tarry stools',
        'Difficulty or pain on swallowing that is getting worse',
        'Pain or redness at the site where the intravenous needle was placed',
      ],
    },
  },
};

/**
 * One sheet, resolved: base, with the set's replacements and additions applied.
 *
 * An unknown set name returns the base rather than nothing. The instruction set
 * is a free-ish field on a prototype form, and a handout that renders empty
 * because somebody typed a set that has no variant would drop the sedation
 * warnings — which are the lines that are true no matter what was done.
 */
export const dischargeSheetFor = (setName) => {
  const variant = DISCHARGE_INSTRUCTION_SHEETS[setName] ?? {};
  const resolve = (key) => [
    ...(variant.replace?.[key] ?? DISCHARGE_SHEET_BASE[key]),
    ...(variant.add?.[key] ?? []),
  ];
  return {
    activity: resolve('activity'),
    diet: resolve('diet'),
    warnings: resolve('warnings'),
  };
};

/**
 * The anticoagulant paragraph.
 *
 * Held for the procedure and therefore owed a restart date, which is the single
 * most dangerous blank on the sheet: a patient who stops apixaban for five days
 * and is never told when to start again simply does not start again. So the
 * drug is quoted back from the pre-check record rather than typed here, and the
 * date is a field the nurse has to fill before the sheet will print.
 *
 * `{drug}` is substituted at render. When the pre-check holds no anticoagulant
 * the whole block is dropped rather than rendered with the name missing — a
 * sentence reading "Our records show you are taking ." is not a smaller version
 * of this instruction, it is a different and alarming one.
 */
export const ANTICOAGULANT_BLOCK = {
  title: 'Anticoagulant',
  records: 'Our records show you are taking {drug}.',
  resume: 'You may resume your anticoagulant on',
  contact:
    'If you have any further concerns or questions about your anticoagulant medication, ' +
    'contact your primary physician.',
  /* Shown in place of the date once one is chosen and the sheet is read back —
     the restart is the instruction, not the date field. */
  missing: 'A restart date has not been set. Confirm it with the endoscopist before the patient leaves.',
};

/**
 * What happens after they have gone home, which is the part patients ring about.
 *
 * Two facts and no more: when the result lands, and the number to call. The
 * phone number is not written here — it is read from the ASC profile at render,
 * so a practice that changes its number changes it in one place and every sheet
 * printed after that carries the new one.
 */
export const DISCHARGE_FOLLOW_UP = [
  {
    term: 'Results',
    text:
      'Please expect a letter within 1 to 2 weeks detailing your procedure findings ' +
      'and the results of any biopsies performed.',
  },
  {
    term: 'Contact',
    text: 'If you have any questions or problems, please call us at {phone} during business hours.',
  },
];

/* --- Post-procedure: the desk's check-out ------------------------------------
   The last thing that happens to the patient in the building, and the only
   document in the run nobody clinical signs. It is step 6 — its own row in the
   rail rather than a document filed under the endoscopist's step, sitting where
   the day breaks: everything above it happens with the patient here, and the
   one step below it lands days later from whatever came back in the post.

   Everything here is a HANDOVER, not a finding: what was given to them, what
   was booked for them, what was taken from them. Which is why the step is ticks
   and short fields rather than prose, and why nothing on it is signed.

   It has no list of its own below. The desk works DISCHARGE_CRITERIA and the
   discharge option lists further up this file — the same words recovery used,
   confirmed once at the counter rather than restated in a second vocabulary.
   -------------------------------------------------------------------------- */

/* --- Post-procedure: specimens and complications ------------------------------ */

export const SPECIMEN_LOG = [
  { pot: 1, site: 'Sigmoid polyp', sent: '05 Aug 09:40', lab: 'Informed Diagnostics', status: 'In transit', told: '' },
  { pot: 2, site: 'Transverse polyp', sent: '05 Aug 09:40', lab: 'Informed Diagnostics', status: 'In transit', told: '' },
  { pot: 3, site: 'Oesophagus ×4', sent: '05 Aug 09:40', lab: 'Informed Diagnostics', status: 'In transit', told: '' },
];

export const COMPLICATION_TYPES = [
  'Bleeding requiring intervention',
  'Perforation',
  'Oversedation — reversal agent given',
  'Cardiopulmonary event',
  'Unplanned admission',
  'Other',
];
