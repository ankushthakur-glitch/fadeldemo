/**
 * DEMO DATA for History — past medical, surgical and social.
 * Entirely invented — no real patient information.
 *
 * THE CANONICAL HOME FOR ALL THREE.
 *
 * Two screens read this file and neither owns it. The History section
 * (js/screens/chart-history.js) is where the record is maintained — the full
 * tables, and the add / edit / delete that write them. Profile · Clinical
 * summarises the same three lists as cards in its grid and links across with
 * "View All". A second copy for the summary would be two answers to "what has
 * this patient had", free to disagree the moment either was edited, and the
 * disagreement would be invisible: nobody has both screens open at once.
 *
 * Keyed by MRN, same as every other per-patient data file in this chart.
 *
 * WHY SOCIAL HISTORY IS SHAPED DIFFERENTLY FROM THE OTHER TWO.
 * Past medical and surgical history are OPEN LISTS: a patient has as many
 * conditions and operations as they have, and a new one is a new row. Social
 * history is a QUESTIONNAIRE — a fixed set of nine questions the practice is
 * required to ask — so it is stored as answers keyed by the question rather
 * than as a list of rows. Nothing is ever added to it or removed from it;
 * answers are given, corrected and cleared. Both screens draw all nine
 * whether or not they have been answered, because the unanswered ones are
 * what a social history is read to find.
 */

/* ============================================================================
   PAST MEDICAL HISTORY

   Deliberately NOT the problem list, which lives in data/chart-diagnoses.js
   and is coded, maintained and billed from. This is the background a patient
   arrives with: the anaemia that resolved, the H. pylori that was eradicated,
   the childhood asthma. Coding it would be pretending a half-remembered year
   is a claim line, so there is no ICD field here — a condition, roughly when
   it started, whether it is still going, and the sentence that makes it
   useful to whoever reads it next.

   The statuses are not the problem list's either. "New" is a thing the
   problem list says about today and means nothing in a history; "Chronic" is
   the one a background history needs most and the problem list has no word
   for.
   ========================================================================= */

export const PAST_MEDICAL_STATUSES = ['Active', 'Chronic', 'Resolved'];

export const PAST_MEDICAL_STATUS_TONE = {
  Active: 'warning',
  Chronic: 'info',
  Resolved: 'success',
};

/* ============================================================================
   SOCIAL HISTORY — the nine questions, and the answers each one offers.

   The categories come from the practice's intake sheet, in the order it asks
   them. They are declared once, here, because three things have to agree
   about them: the History section's table, the Clinical card, and the form
   that writes an answer. A tenth question added here appears in all three.

   `options` is what the form offers for that question — the answers a
   screening instrument actually collects, so the same fact is recorded the
   same way twice rather than typed as "quit years ago" once and "ex-smoker"
   the next time. It is an offer and not a cage: every answer carries a free
   Detail line beside it for what the list cannot hold, which is where "quit
   in 2023, 20/day for thirty years before that" goes.
   ========================================================================= */

export const SOCIAL_HISTORY_CATEGORIES = [
  {
    id: 'education',
    label: 'Education Level',
    options: [
      'Less than high school',
      'High school or equivalent',
      'Some college',
      'Associate degree',
      'Bachelor’s degree',
      'Postgraduate degree',
      'Still in education',
    ],
  },
  {
    id: 'financial',
    label: 'Financial Strain',
    options: ['Not hard at all', 'Not very hard', 'Somewhat hard', 'Hard', 'Very hard'],
  },
  {
    id: 'violence',
    label: 'Exposure to Violence',
    options: ['Never', 'Rarely', 'Sometimes', 'Fairly often', 'Frequently', 'Declined to answer'],
  },
  {
    id: 'tobacco',
    label: 'Tobacco Use',
    options: [
      'Never smoker',
      'Former smoker',
      'Current every-day smoker',
      'Current some-day smoker',
      'Smokeless tobacco',
      'Unknown',
    ],
  },
  {
    id: 'alcohol',
    label: 'Alcohol Use',
    options: [
      'Never',
      'Monthly or less',
      '2–4 times a month',
      '2–3 times a week',
      '4 or more times a week',
    ],
  },
  {
    id: 'activity',
    label: 'Physical Activity',
    options: ['None', '1–2 days a week', '3–4 days a week', '5 or more days a week'],
  },
  {
    id: 'stress',
    label: 'Stress',
    options: ['Not at all', 'Only a little', 'Somewhat', 'Quite a bit', 'Very much'],
  },
  {
    id: 'orientation',
    label: 'Sexual Orientation',
    options: [
      'Straight or heterosexual',
      'Lesbian or gay',
      'Bisexual',
      'Something else',
      'Don’t know',
      'Prefer not to say',
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition History',
    options: [
      'No restrictions',
      'Diabetic diet',
      'Gluten-free',
      'Low FODMAP',
      'Low residue',
      'Vegetarian or vegan',
      'Other restriction',
    ],
  },
];

/* ============================================================================
   SURGICAL HISTORY — what the form offers for "what" and "where".

   Both are dropdowns rather than empty boxes, and for the same reason the
   chart formulary exists on the medication form: a surgical history typed by
   hand arrives spelled six ways. "Lap chole", "Cholecystectomy (lap)",
   "gallbladder removed" and "Cholesystectomy" are one operation and four
   rows nobody can count, search or hand to the next hospital. The list is the
   intake sheet's, GI and abdominal first because this is a gastroenterology
   practice and those are the ones asked about every day, then the general
   ones a history routinely turns up.

   BOTH LISTS END IN "Other", AND OTHER IS A TEXT BOX. A closed list cannot
   hold a surgical history — a patient has had whatever they have had, and a
   form that refuses to record an operation because it is not on a list is a
   form that loses the operation. Picking Other turns the same field into a
   box and the answer is typed where the question was asked. See the
   `free-text` notes in js/components/ui-select.js.
   ========================================================================= */

export const SURGICAL_OTHER = 'Other';

export const SURGICAL_PROCEDURES = [
  'Appendectomy',
  'Cholecystectomy, laparoscopic',
  'Cholecystectomy, open',
  'Colectomy, partial',
  'Colectomy, total',
  'Small bowel resection',
  'Gastrectomy, partial',
  'Fundoplication / hiatal hernia repair',
  'Hernia repair, inguinal',
  'Hernia repair, umbilical',
  'Haemorrhoidectomy',
  'Anal fistula repair',
  'Bariatric surgery — gastric bypass',
  'Bariatric surgery — sleeve gastrectomy',
  'Liver resection',
  'Whipple procedure',
  'Splenectomy',
  'Caesarean section',
  'Hysterectomy',
  'Tonsillectomy',
  'Thyroidectomy',
  'Cholangiography / ERCP with sphincterotomy',
  'Coronary artery bypass graft',
  'Total hip replacement',
  'Total knee replacement',
  'Cataract surgery',
  SURGICAL_OTHER,
];

/* This practice's own sites first — a procedure done here should never be
   recorded under a name the practice does not use for itself — then the
   hospitals the area's patients actually come from. */
export const SURGICAL_FACILITIES = [
  'GastroEMR Gastroenterology ASC',
  'GastroEMR Gastroenterology LTD — Fargo',
  'Red River Infusion Centre',
  'Moorhead Annexe',
  'Sanford Medical Center Fargo',
  'Essentia Health — Fargo',
  'Altru Hospital, Grand Forks',
  'CHI St Alexius Health, Bismarck',
  'GastroEMR Orthopaedic Centre',
  'St Luke’s General',
  SURGICAL_OTHER,
];

/** The category, by the id an answer is filed under. */
export function socialCategory(id) {
  return SOCIAL_HISTORY_CATEGORIES.find((category) => category.id === id) || null;
}

/* ============================================================================
   THE RECORD
   ========================================================================= */

export const CHART_HISTORY = {
  /* Henna West — the worked example. A history with something in all three
     lists, including two entries whose facts are deliberately incomplete
     (a tonsillectomy from 1975 nobody has the surgeon for, a question nobody
     has asked) because that is what a real one looks like. */
  326486: {
    pastMedical: [
      {
        id: 'pmh1',
        condition: 'Hypothyroidism',
        status: 'Chronic',
        onsetDate: '20-06-2011',
        recordedDate: '04-10-2024',
        recordedBy: 'Amara Mensah',
        note: 'Levothyroxine 75mcg, TFTs stable since 2013',
      },
      {
        id: 'pmh2',
        condition: 'Iron deficiency anaemia',
        status: 'Resolved',
        onsetDate: '02-05-2016',
        recordedDate: '04-10-2024',
        recordedBy: 'Amara Mensah',
        note: 'Two iron infusions; ferritin normal since 2018',
      },
      {
        id: 'pmh3',
        condition: 'Helicobacter pylori infection',
        status: 'Resolved',
        onsetDate: '11-09-2014',
        recordedDate: '04-10-2024',
        recordedBy: 'Richard Walker',
        note: 'Eradicated on triple therapy, breath test negative',
      },
      {
        id: 'pmh4',
        condition: 'Childhood asthma',
        status: 'Resolved',
        onsetDate: '01-06-1968',
        recordedDate: '04-10-2024',
        recordedBy: 'Amara Mensah',
        note: '',
      },
    ],

    surgical: [
      {
        id: 'sx1',
        procedure: 'Cholecystectomy, laparoscopic',
        date: '18-07-2018',
        surgeon: 'Mr A Whitfield',
        facility: 'St Luke’s General',
        recordedDate: '04-10-2024',
        recordedBy: 'Amara Mensah',
        note: 'Uncomplicated, day case',
      },
      {
        id: 'sx2',
        procedure: 'Total knee replacement, right',
        date: '28-02-2021',
        surgeon: 'Ms P Okonjo',
        facility: 'GastroEMR Orthopaedic Centre',
        recordedDate: '04-10-2024',
        recordedBy: 'Amara Mensah',
        note: '',
      },
      {
        id: 'sx3',
        procedure: 'Tonsillectomy',
        date: '14-09-1975',
        surgeon: '',
        facility: '',
        recordedDate: '04-10-2024',
        recordedBy: 'Richard Walker',
        note: 'Patient-reported, no records available',
      },
    ],

    social: {
      education: {
        response: 'Bachelor’s degree',
        detail: 'Retired schoolteacher',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      financial: {
        response: 'Not hard at all',
        detail: '',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      violence: {
        response: 'Never',
        detail: '',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      tobacco: {
        response: 'Former smoker',
        detail: 'Quit Apr 2023; 20/day for about thirty years before that',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      alcohol: {
        response: '2–3 times a week',
        detail: 'Two or three glasses of wine a week',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      activity: {
        response: '5 or more days a week',
        detail: 'Walks about 30 minutes daily',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      stress: {
        response: 'Only a little',
        detail: '',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      nutrition: {
        response: 'Diabetic diet',
        detail: 'Self-managed, no dietitian input since 2022',
        recordedDate: '23-10-2025',
        recordedBy: 'Kayla Brandt, RN',
      },
      /* orientation is deliberately absent — one unanswered question, so both
         screens have something real to show in the "not recorded" state. */
    },
  },

  326477: {
    pastMedical: [
      {
        id: 'pmh1',
        condition: 'Gallstones, asymptomatic',
        status: 'Chronic',
        onsetDate: '14-02-2022',
        recordedDate: '19-10-2025',
        recordedBy: 'Richard Walker',
        note: 'Incidental on ultrasound, never symptomatic',
      },
    ],
    surgical: [],
    social: {
      tobacco: {
        response: 'Never smoker',
        detail: '',
        recordedDate: '19-10-2025',
        recordedBy: 'Phyllis Nguyen',
      },
      alcohol: {
        response: '4 or more times a week',
        detail: 'Around ten units a week, discussed at this visit',
        recordedDate: '19-10-2025',
        recordedBy: 'Phyllis Nguyen',
      },
    },
  },

  /* A chart nobody has asked yet. Both screens have to be honest about that
     rather than drawing an empty box — see the empty states in
     js/screens/chart-history.js. */
  326481: { pastMedical: [], surgical: [], social: {} },

  326495: {
    pastMedical: [
      {
        id: 'pmh1',
        condition: 'Iron deficiency anaemia',
        status: 'Resolved',
        onsetDate: '10-09-2025',
        recordedDate: '02-01-2026',
        recordedBy: 'Shelia Stevenson',
        note: 'Responded to oral iron — the finding that prompted the celiac panel',
      },
    ],
    surgical: [],
    social: {
      education: {
        response: 'Still in education',
        detail: 'Grade 8, mainstream school',
        recordedDate: '02-01-2026',
        recordedBy: 'Shelia Stevenson',
      },
      nutrition: {
        response: 'Gluten-free',
        detail: 'Since diagnosis, Jan 2026',
        recordedDate: '02-01-2026',
        recordedBy: 'Shelia Stevenson',
      },
    },
  },
};

export const EMPTY_CHART_HISTORY = { pastMedical: [], surgical: [], social: {} };

/**
 * A patient's history, COPIED rather than handed out by reference.
 *
 * Every module in this chart works on its own copy of the fixtures — switching
 * patients and coming back must not carry edits made during the previous
 * visit, and two screens open on the same record must not write through each
 * other. The nested arrays and the social map are copied too; a shallow spread
 * would have left all three sharing the same rows.
 */
export function historyFor(mrn) {
  const record = CHART_HISTORY[mrn] || EMPTY_CHART_HISTORY;
  return {
    pastMedical: record.pastMedical.map((row) => ({ ...row })),
    surgical: record.surgical.map((row) => ({ ...row })),
    social: Object.fromEntries(
      Object.entries(record.social).map(([id, answer]) => [id, { ...answer }])
    ),
  };
}
