/**
 * DEMO DATA — the clinic visit note, one spec per template.
 * Invented throughout. No real patient information.
 *
 * WHY THESE EXIST
 * The encounter screen has always offered a list of note templates — SOAP Note,
 * GI Consultation, New Patient and the rest, declared in data/encounter.js and
 * shown on the Visit Note worklist — and behind every one of them it rendered
 * the same thing: a colonoscopy procedure report. Opening a New Patient
 * consultation and being handed a form asking for bowel preparation quality and
 * caecal intubation depth is not a cosmetic problem. It is the screen telling
 * the clinician that the template they picked does not mean anything.
 *
 * So each template is now a document of its own, declared here and rendered by
 * one renderer in js/screens/clinic-visit.js.
 *
 * THE SHAPE, AND WHY IT IS THIS SHAPE
 * A template is a title and a list of sections. A section is a heading and any
 * combination of two things:
 *
 *   fields   the questions this template actually asks — the same
 *            select/text/textarea vocabulary the procedure report and the
 *            procedure run's documents use, so a field behaves the same way
 *            wherever it is met.
 *   note     one line of guidance under the heading, where a section needs it.
 *
 * There is deliberately no third kind. Every template below is expressible in
 * those two, and a spec language with an escape hatch stops being a spec.
 *
 * `rich: true` ON A TEXTAREA, AND WHY IT IS A FLAG RATHER THAN A TYPE.
 * Two fields in this file carry it — both of them the history of present
 * illness — and it asks the renderer for a prose field with a formatting bar
 * (<ui-richtext>) instead of a plain box. It is a flag on `type: 'textarea'`
 * rather than `type: 'richtext'` for one specific reason: everything that
 * decides where to PUT prose reads the type, and it reads it to mean "this
 * field takes a paragraph". The rail's Import and the AI scribe's Copy to note
 * both look for a textarea and both write plain text with newlines in it; a
 * new type name would have hidden the HPI from both of them, which is the one
 * section either of them is most likely to be filling. The flag changes how
 * the field is DRAWN and leaves what it IS alone — and the v1 screen, which
 * knows nothing about it, goes on rendering a plain textarea from the same
 * spec.
 *
 * THERE USED TO BE A THIRD: `pulled`, a read-only block quoting what the chart
 * already knew — the active problem list under Assessment, the medication list
 * under Medications and allergies, the check-in vitals under Examination, each
 * with a line saying where it came from and where to go to change it. Eleven of
 * them across seven templates.
 *
 * They came out when the clinical record moved into the rail on the right of
 * this screen. Every one of those lists is in that rail, in full, one press
 * away, kept in one place — so the block in the note was a third copy of the
 * same facts, printed at the top of the very section whose job is to say
 * something NEW about them. A clinician writing an assessment does not need the
 * problem list quoted above the box; they need the box, and the list where the
 * list lives.
 *
 * WHAT IS NOT IN HERE
 * The signature block. It is the same on every clinical document in the
 * practice and is mounted by the screen rather than declared per template.
 *
 * ORDER MATTERS. Sections are read top to bottom in the order a clinician works:
 * what the patient said, what was found, what it means, what happens next. Two
 * templates that ask the same question ask it under the same heading, so a
 * reader moving between a follow-up and a consultation is not relearning the
 * document each time.
 */

/* --- Shared option lists ---------------------------------------------------
   Small, closed vocabularies that more than one template needs. Kept beside
   the templates rather than in a general list module: they are the wording of
   this note, and a change to them is a change to how the note reads. */

const GENERAL_APPEARANCE = [
  'Well, in no distress',
  'Uncomfortable but stable',
  'Unwell — see assessment',
];

const ABDOMEN_FINDINGS = [
  'Soft, non-tender, no organomegaly',
  'Soft, mild generalised tenderness',
  'Tender — localised, see assessment',
  'Distended',
];

const SYMPTOM_TREND = ['Improved', 'Unchanged', 'Worse', 'Resolved'];

const FOLLOW_UP_INTERVAL = [
  'No routine follow-up — as needed',
  '4 weeks',
  '3 months',
  '6 months',
  '12 months',
];

const TOLERANCE = ['Tolerated well', 'Minor reaction — settled', 'Reaction — infusion stopped'];

/* --- Sections reused across templates --------------------------------------
   Declared once and spread into the templates that want them. Two notes asking
   "what did the examination show" under two different headings, with two
   different option lists, is exactly the drift this file exists to stop. */

const EXAMINATION_SECTION = {
  id: 'exam',
  title: 'Examination',
  fields: [
    { key: 'general', type: 'select', label: 'General appearance', options: GENERAL_APPEARANCE },
    { key: 'abdomen', type: 'select', label: 'Abdomen', options: ABDOMEN_FINDINGS },
    {
      key: 'examOther',
      type: 'textarea',
      label: 'Other findings',
      rows: 2,
      placeholder: 'Anything the two answers above do not cover…',
      span: 2,
    },
  ],
};

const ASSESSMENT_SECTION = {
  id: 'assessment',
  title: 'Assessment',
  fields: [
    {
      key: 'assessment',
      type: 'textarea',
      label: 'Assessment',
      labelHidden: true,
      rows: 3,
      placeholder: 'What the findings mean for this patient today…',
      span: 2,
    },
  ],
};

const PLAN_SECTION = {
  id: 'plan',
  title: 'Plan',
  /* The plan is the part of the note the patient leaves with, and the part the
     next clinician reads first. It is the one section that names its follow-up
     as a field rather than leaving it inside the prose, so the recall can be
     read off the note without anybody parsing a sentence. */
  fields: [
    {
      key: 'plan',
      type: 'textarea',
      label: 'Plan',
      labelHidden: true,
      rows: 3,
      placeholder: 'Investigations, treatment changes, referrals, patient instructions…',
      span: 2,
      emphasis: true,
    },
    { key: 'followUp', type: 'select', label: 'Follow-up interval', options: FOLLOW_UP_INTERVAL },
  ],
};

export const VISIT_NOTE_TEMPLATES = [
  {
    id: 'soap',
    title: 'SOAP Note',
    /* The default for anything the practice has not given a shape of its own.
       Four sections, in the order the acronym names them — which is also the
       order the visit happens in, which is why the acronym has outlived every
       system that has ever printed it. */
    sections: [
      {
        id: 'subjective',
        title: 'Subjective',
        fields: [
          {
            key: 'subjective',
            type: 'textarea',
            label: 'Subjective',
            labelHidden: true,
            rows: 4,
            placeholder: 'What the patient reports — symptoms, duration, what has changed…',
            span: 2,
          },
          { key: 'trend', type: 'select', label: 'Since last visit', options: SYMPTOM_TREND },
        ],
      },
      { ...EXAMINATION_SECTION, id: 'objective', title: 'Objective' },
      ASSESSMENT_SECTION,
      PLAN_SECTION,
    ],
  },

  {
    id: 'gi-consultation',
    title: 'GI Consultation',
    /* A consultation is written to be sent. It ends with the letter rather than
       the plan, because the letter is the deliverable — a consultation whose
       reply has to be composed somewhere else is a consultation that will be
       replied to late or not at all. */
    sections: [
      {
        id: 'referral',
        title: 'Reason for consultation',
        note: 'Carried from the referral. Correct it here if the referral was unclear.',
        fields: [
          { key: 'referredBy', type: 'text', label: 'Referred by' },
          { key: 'reason', type: 'text', label: 'Reason for referral' },
          {
            key: 'question',
            type: 'textarea',
            label: 'The question being asked',
            rows: 2,
            placeholder: 'What the referrer wants decided…',
            span: 2,
          },
        ],
      },
      {
        id: 'hpi',
        title: 'History of present illness',
        fields: [
          {
            key: 'hpi',
            type: 'textarea',
            rich: true,
            label: 'History of present illness',
            labelHidden: true,
            rows: 5,
            placeholder: 'Onset, character, course, what has been tried…',
            span: 2,
          },
        ],
      },
      {
        id: 'background',
        title: 'Background',
        fields: [
          {
            key: 'background',
            type: 'textarea',
            label: 'Relevant history not in the problem list',
            rows: 3,
            span: 2,
          },
        ],
      },
      { ...EXAMINATION_SECTION },
      {
        id: 'impression',
        title: 'Impression',
        fields: [
          {
            key: 'impression',
            type: 'textarea',
            label: 'Impression',
            labelHidden: true,
            rows: 3,
            placeholder: 'The answer to the question that was asked…',
            span: 2,
          },
        ],
      },
      {
        id: 'letter',
        title: 'Letter to the referring physician',
        note: 'Sent with the note when it is signed. Written to the referrer, not to the chart.',
        fields: [
          {
            key: 'letter',
            type: 'textarea',
            label: 'Letter',
            labelHidden: true,
            rows: 4,
            placeholder: 'Thank you for referring this patient…',
            span: 2,
            emphasis: true,
          },
        ],
      },
      PLAN_SECTION,
    ],
  },

  {
    id: 'new-patient',
    title: 'New Patient',
    /* The longest note the practice writes, because it is the only one written
       against a blank chart. Its history and medication sections ask for
       ADDITIONS AND CORRECTIONS rather than the lists themselves — what check-in
       and the intake forms collected is on the chart, and in the clinical rail
       beside this note; what the visit adds is whatever they missed. */
    sections: [
      {
        id: 'presenting',
        title: 'Presenting complaint',
        fields: [
          { key: 'complaint', type: 'text', label: 'Chief complaint', span: 2 },
          {
            key: 'hpi',
            type: 'textarea',
            rich: true,
            label: 'History of present illness',
            rows: 5,
            placeholder: 'Onset, character, course, what has been tried…',
            span: 2,
          },
        ],
      },
      {
        id: 'history',
        title: 'Past medical and surgical history',
        fields: [
          {
            key: 'history',
            type: 'textarea',
            label: 'Additions and corrections',
            rows: 3,
            placeholder: 'Anything the intake forms missed…',
            span: 2,
          },
        ],
      },
      {
        id: 'medications',
        title: 'Medications and allergies',
        /* NO NOTE ON THIS SECTION.
           It read "Reviewed with the patient at this visit." — an assertion,
           printed above the two fields that ASK whether the review happened
           and whose third option is "Not reviewed". So the note stated as
           settled the very thing the section exists to record, and a note
           signed with "Not reviewed" in both boxes carried a line directly
           contradicting them. The fields answer it; the line does not. */
        fields: [
          {
            key: 'medsReviewed',
            type: 'select',
            label: 'Medication reconciliation',
            options: ['Reviewed — no change', 'Reviewed — changes made', 'Not reviewed'],
          },
          {
            key: 'allergiesReviewed',
            type: 'select',
            label: 'Allergy review',
            options: ['Reviewed — no change', 'Reviewed — changes made', 'Not reviewed'],
          },
        ],
      },
      {
        id: 'social',
        title: 'Family and social history',
        fields: [
          {
            key: 'family',
            type: 'textarea',
            label: 'Family history',
            rows: 2,
            placeholder: 'GI cancer, IBD, coeliac disease in first-degree relatives…',
          },
          {
            key: 'social',
            type: 'textarea',
            label: 'Social history',
            rows: 2,
            placeholder: 'Alcohol, smoking, occupation, who is at home…',
          },
        ],
      },
      { ...EXAMINATION_SECTION },
      ASSESSMENT_SECTION,
      PLAN_SECTION,
    ],
  },

  {
    id: 'established-patient',
    title: 'Established Patient',
    /* Short by design. The chart already holds the history; what this visit
       adds is the interval — what has happened since the last note and what
       that changes. A follow-up template that re-asks the new-patient
       questions produces a note nobody reads and a chart that repeats itself. */
    sections: [
      {
        id: 'interval',
        title: 'Interval history',
        fields: [
          {
            key: 'interval',
            type: 'textarea',
            label: 'Interval history',
            labelHidden: true,
            rows: 4,
            placeholder: 'What has happened since the last visit…',
            span: 2,
          },
          { key: 'trend', type: 'select', label: 'Symptoms since last visit', options: SYMPTOM_TREND },
        ],
      },
      {
        id: 'therapy',
        title: 'Current therapy',
        fields: [
          {
            key: 'adherence',
            type: 'select',
            label: 'Adherence',
            options: ['Taking as prescribed', 'Missed doses', 'Stopped — see note'],
          },
          {
            key: 'tolerance',
            type: 'textarea',
            label: 'Tolerance and side effects',
            rows: 2,
          },
        ],
      },
      { ...EXAMINATION_SECTION },
      ASSESSMENT_SECTION,
      PLAN_SECTION,
    ],
  },

  {
    id: 'colonoscopy-follow-up',
    title: 'Colonoscopy Follow-up',
    /* Written against a report that already exists, so it does not ask what was
       done — the first section asks only whether the results have been given to
       the patient. The surveillance interval is a field of its own for the same
       reason the plan's follow-up is: a recall date buried in prose is a recall
       date that will be missed. */
    sections: [
      {
        id: 'procedure',
        title: 'Procedure reviewed',
        note: 'The findings and impression are in the report itself and are not restated here.',
        fields: [
          {
            key: 'discussed',
            type: 'select',
            label: 'Results discussed with the patient',
            options: ['Yes — in person today', 'Yes — by telephone', 'Not yet'],
          },
        ],
      },
      {
        id: 'pathology',
        title: 'Pathology',
        fields: [
          {
            key: 'pathStatus',
            type: 'select',
            label: 'Pathology status',
            options: ['Resulted and reviewed', 'Resulted — not yet reviewed', 'Awaited'],
          },
          { key: 'pathSummary', type: 'textarea', label: 'Summary', rows: 2, span: 2 },
        ],
      },
      {
        id: 'recovery',
        title: 'Recovery since the procedure',
        fields: [
          {
            key: 'recovery',
            type: 'select',
            label: 'Recovery',
            options: ['Uncomplicated', 'Minor symptoms — settled', 'Complication — see assessment'],
          },
          { key: 'recoveryNote', type: 'textarea', label: 'Detail', rows: 2 },
        ],
      },
      {
        id: 'surveillance',
        title: 'Surveillance',
        fields: [
          {
            key: 'interval',
            type: 'select',
            label: 'Next colonoscopy due in',
            options: ['No further surveillance', '1 year', '3 years', '5 years', '10 years'],
            emphasis: true,
          },
          { key: 'basis', type: 'text', label: 'Basis for the interval' },
        ],
      },
      PLAN_SECTION,
    ],
  },

  {
    id: 'procedure-follow-up',
    title: 'Procedure Follow-up',
    /* The generic form of the colonoscopy follow-up, for everything else the
       endoscopy list produces. Same shape, no surveillance section — a
       banding or a dilatation has a next step, but not an interval. */
    sections: [
      {
        id: 'procedure',
        title: 'Procedure reviewed',
        fields: [
          {
            key: 'discussed',
            type: 'select',
            label: 'Results discussed with the patient',
            options: ['Yes — in person today', 'Yes — by telephone', 'Not yet'],
          },
        ],
      },
      {
        id: 'recovery',
        title: 'Recovery since the procedure',
        fields: [
          {
            key: 'recovery',
            type: 'select',
            label: 'Recovery',
            options: ['Uncomplicated', 'Minor symptoms — settled', 'Complication — see assessment'],
          },
          { key: 'recoveryNote', type: 'textarea', label: 'Detail', rows: 2 },
        ],
      },
      { ...EXAMINATION_SECTION },
      ASSESSMENT_SECTION,
      PLAN_SECTION,
    ],
  },

  {
    id: 'infusion-visit',
    title: 'Infusion Visit',
    /* Not a consultation at all — a dose given and watched. It ends with the
       next dose rather than a plan, because that is the decision the visit
       exists to make and the one the scheduler needs back. */
    sections: [
      {
        id: 'indication',
        title: 'Indication and regimen',
        fields: [
          { key: 'drug', type: 'text', label: 'Drug and dose' },
          { key: 'cycle', type: 'text', label: 'Cycle' },
        ],
      },
      {
        id: 'pre',
        title: 'Pre-infusion assessment',
        fields: [
          {
            key: 'fitToInfuse',
            type: 'select',
            label: 'Fit to infuse',
            options: ['Yes', 'Yes — with premedication', 'No — deferred'],
            emphasis: true,
          },
          { key: 'preNote', type: 'textarea', label: 'Interval symptoms and screening', rows: 2 },
        ],
      },
      {
        id: 'record',
        title: 'Infusion record',
        fields: [
          { key: 'startTime', type: 'time', label: 'Started' },
          { key: 'endTime', type: 'time', label: 'Finished' },
          { key: 'site', type: 'text', label: 'Access site' },
          { key: 'tolerance', type: 'select', label: 'Tolerance', options: TOLERANCE },
        ],
      },
      {
        id: 'post',
        title: 'Post-infusion observation',
        fields: [
          {
            key: 'observed',
            type: 'select',
            label: 'Observation period completed',
            options: ['Yes — 30 minutes', 'Yes — 60 minutes', 'Left early against advice'],
          },
          { key: 'postNote', type: 'textarea', label: 'Observations', rows: 2 },
        ],
      },
      {
        id: 'next',
        title: 'Next dose',
        fields: [
          {
            key: 'nextDue',
            type: 'select',
            label: 'Next dose due in',
            options: ['4 weeks', '6 weeks', '8 weeks', 'On hold — see plan'],
            emphasis: true,
          },
          { key: 'nextNote', type: 'text', label: 'Instructions for the booking' },
        ],
      },
    ],
  },
];

/** One template by title — the value the note-type picker carries. */
export const templateByTitle = (title) =>
  VISIT_NOTE_TEMPLATES.find((t) => t.title === title);

/** Every template title, in the order the picker offers them. */
export const VISIT_NOTE_TITLES = VISIT_NOTE_TEMPLATES.map((t) => t.title);
