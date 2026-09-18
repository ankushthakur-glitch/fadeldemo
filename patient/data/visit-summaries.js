/**
 * VISIT SUMMARIES — what the patient may read about a visit that has happened.
 *
 * ⚠ THIS IS NOT THE CLINICIAN'S NOTE, AND MUST NOT BECOME IT.
 *
 * The chart note behind a visit carries the differential, the possibilities
 * that were weighed and dropped, the coding and the clinician's own shorthand.
 * None of that belongs on a screen a patient reads alone at home — half of it
 * frightens without informing, and the other half is meaningless without the
 * training to read it.
 *
 * So a summary is WRITTEN, not extracted. Each entry below is an authored
 * document in the patient's own language, and there is deliberately no `note`
 * field on these objects: there is nowhere for a clinician's note to be poured
 * in by accident, and adding one would be the change that breaks the promise
 * this file exists to keep.
 *
 * Keyed by appointment id — see data/appointments.js. An appointment with no
 * entry here has no summary, which is the right state for one that was
 * cancelled: nothing happened, so there is nothing to summarise.
 *
 * WHERE THE CLINICAL FACTS COME FROM
 * `vitals` and `conditions` are the numbers and the problem list the practice
 * recorded at the visit, and they are written to MATCH THE CLINICIAN'S CHART
 * rather than paraphrase it: the blood pressure, pulse, weight and BMI below
 * are the figures in data/chart-vitals.js for MRN 326486, and every condition
 * carries the same ICD-10 code the same patient's problem list carries in
 * data/chart-diagnoses.js. A patient who is told "your blood pressure was
 * fine" and then reads a different number on a letter from the practice has
 * been given two records of one afternoon, and will believe the worse one.
 *
 * The CODE rides along with a sentence of plain English, not instead of one.
 * "K21.9" is what the practice, the insurer and the next specialist all call
 * this, so a patient who has to quote it can; "reflux — stomach acid coming
 * back up" is what it means, and that is what is set in the larger type.
 *
 * THERE IS NO `plan` FIELD, AND THAT IS THE POINT
 * There was one, and it read as an index of the rest of the page: change your
 * medication (see Medication changes), recheck your bloods (see Tests), book
 * the colonoscopy (see Next steps). Three sections of the document, restated
 * as bullets above them. A patient reading their instructions three times in
 * three wordings cannot tell whether it is one instruction or three, so the
 * plan is now DERIVED — see the checklist the screen builds from medication
 * changes, tests and next steps.
 *
 * THE MEDICATION CHANGES ARE RECORDED HERE, not derived from data/health.js.
 * A summary is a snapshot of one day; the medication list is the record as it
 * stands now. The two agree — Pantoprazole and Famotidine below are the same
 * two rows the Medications screen shows, with the same dates — but they agree
 * because they were written to, not because one is computed from the other. A
 * summary that re-derived itself would change wording every time a patient
 * stopped something in the portal.
 */

export const VISIT_SUMMARIES = {
  /* ==========================================================================
     August 08, 2026 — Dianne Russell, in person
     ======================================================================= */
  'appt-aug-08': {
    appointmentId: 'appt-aug-08',
    reason: 'Follow-up for reflux and bloating',
    publishedOn: 'August 9, 2026',
    author: 'Dianne Russell, MD',

    summary: [
      'We talked about the heartburn you have been getting in the evenings, ' +
        'usually an hour or two after dinner, and the bloating that comes with it. ' +
        'You have had it most days for about three months, and it wakes you roughly ' +
        'twice a week.',
      'Your blood pressure was 118/76 and your weight 175 lb — both unchanged since ' +
        'your last visit — and examining your abdomen was comfortable throughout. We went ' +
        'through your blood tests together: everything was in range apart from a mildly low ' +
        'iron, which is worth rechecking rather than treating today.',
    ],

    /* The figures the practice recorded in the room, and the same figures the
       chart holds — see the note at the top of this file. `note` is what the
       number MEANS for this patient, which is the only part of a vital sign a
       patient can act on: 118/76 is a number, "in the healthy range" is an
       answer. */
    vitals: [
      {
        label: 'Blood pressure',
        value: '118/76 mmHg',
        note: 'In the healthy range, and the same as your last reading.',
      },
      { label: 'Pulse', value: '76 bpm', note: 'Normal rate, regular rhythm.' },
      { label: 'Weight', value: '175 lb (79.4 kg)', note: 'No change since your last visit.' },
      { label: 'Height', value: "5 ft 8 in (173 cm)", note: '' },
      {
        label: 'BMI',
        value: '26.6',
        note: 'Just above the healthy range. Worth a conversation, not a worry.',
      },
    ],

    /* The problem list, in the patient's language and under the practice's
       codes. K21.9 and K44.9 are the two rows the chart carries as Active for
       this patient — the hernia is here because it is the reason the reflux
       keeps coming back, and a patient told to change a tablet without being
       told why stops taking it in a fortnight. */
    conditions: [
      {
        code: 'K21.9',
        clinicalName: 'GERD, without esophagitis',
        plain: 'Acid reflux',
        detail:
          'Stomach acid coming back up into your food pipe. This is the long-standing one ' +
          'we are treating, and it is what the medication change is for.',
        status: 'Being treated',
        since: 'Recorded since October 2024',
      },
      {
        code: 'K44.9',
        clinicalName: 'Diaphragmatic hernia without obstruction or gangrene',
        plain: 'Small hiatus hernia',
        detail:
          'A small part of the stomach sits a little higher than it should, which is why ' +
          'the reflux keeps returning. It was seen at your last endoscopy and it does not ' +
          'need an operation.',
        status: 'Stable, watching',
        since: 'Seen at your last endoscopy, November 2025',
      },
    ],

    /* Tests ordered on the day. `status` is the patient's half of the question
       — what is waiting on THEM — and `resultsAt` is the other half, which the
       old page never answered: a test you are sent for and never told where to
       look for is a phone call to the practice a fortnight later. */
    tests: [
      {
        name: 'Iron studies and ferritin',
        why: 'Your iron was mildly low. This checks whether it is still falling or has settled.',
        when: 'In about six weeks, before your September visit',
        where: 'Walk-in lab, any morning — no appointment needed',
        status: 'Waiting for you to go',
        resultsAt: 'reports',
      },
      {
        name: 'Full blood count',
        why: 'Taken at the same time, from the same sample as the iron.',
        when: 'In about six weeks, before your September visit',
        where: 'Walk-in lab, any morning — no appointment needed',
        status: 'Waiting for you to go',
        resultsAt: 'reports',
      },
    ],

    instructions: [
      'Take the pantoprazole 30 to 60 minutes before breakfast, on an empty stomach. ' +
        'It does not work well taken with food.',
      'Keep a food and symptom diary for the next two weeks — what you ate, when the ' +
        'symptoms came, and how bad they were — so we can look at the evening pattern together.',
      'Stop eating about three hours before you lie down, and raise the head of the bed ' +
        'if the night-time symptoms continue.',
      'Bring the food diary to your September visit — a photo of the page is fine.',
      'Call the office on (808) 555-0100 if you have trouble swallowing, black or bloody ' +
        'stools, or you lose weight without meaning to.',
    ],

    medicationsStarted: [
      {
        name: 'Pantoprazole',
        dose: '40 mg',
        schedule: 'Once a day, before breakfast',
        why: 'For the evening reflux, in place of the famotidine.',
      },
    ],

    medicationsStopped: [
      {
        name: 'Famotidine',
        dose: '20 mg',
        why: 'It was not holding the symptoms overnight. Stop it the day you start the pantoprazole — do not take both.',
      },
    ],

    nextSteps: [
      {
        title: 'Screening colonoscopy',
        when: 'Being booked for October 2026',
        detail:
          'The office will call you with a date and post the preparation instructions two ' +
          'weeks beforehand. You will need someone to drive you home.',
      },
      {
        // Resolved against data/appointments.js by the screen, so the date and
        // the provider cannot drift from the appointment the patient sees on
        // the Upcoming tab.
        appointmentId: 'appt-sep-05',
        title: 'Follow-up visit',
        detail: 'We will go through the repeat bloods and the food diary.',
      },
    ],
  },

  /* ==========================================================================
     July 22, 2026 — Jane Cooper, video visit
     ======================================================================= */
  'appt-jul-22': {
    appointmentId: 'appt-jul-22',
    reason: 'Video check-in about the change in bowel habit',
    publishedOn: 'July 22, 2026',
    author: 'Jane Cooper, MD',

    summary: [
      'We spoke by video about the looser stools and the cramping that started in the ' +
        'middle of June, after the course of antibiotics. You were keeping fluids down, ' +
        'had no fever, and had not seen any blood.',
      'Nothing about this needs an in-person visit today. It is worth testing rather than ' +
        'guessing, so we ordered stool tests and a blood count, and we will read them together ' +
        'at your September appointment.',
    ],

    /* Empty, and the screen says why rather than dropping the heading: this
       was a video visit, so nobody took a blood pressure. A row of dashes
       where the numbers should be reads as a measurement that went missing. */
    vitals: [],

    conditions: [
      {
        code: 'K57.30',
        clinicalName: 'Diverticulosis of large intestine without perforation or abscess',
        plain: 'Diverticulosis',
        detail:
          'Small pouches in the wall of the large bowel. Very common, usually silent, and ' +
          'part of the reason a change in your bowel habit is worth testing rather than ' +
          'watching.',
        status: 'Known, not active',
        since: 'Recorded since March 2023',
      },
    ],

    tests: [
      {
        name: 'Stool tests',
        why: 'To find out whether an infection is behind the looser stools, rather than guessing.',
        when: 'Collect one sample when the kit arrives, and post it back the same day if you can',
        where: 'At home — the lab posts you the kit',
        status: 'Kit being posted to you',
        resultsAt: 'reports',
      },
      {
        name: 'Full blood count and metabolic panel',
        why: 'A general check on inflammation, your blood count and your salts and kidneys.',
        when: 'Any morning that suits you',
        where: 'Walk-in lab — no appointment needed',
        status: 'Waiting for you to go',
        resultsAt: 'reports',
      },
    ],

    instructions: [
      'Post the stool kit back within three days of collecting the sample.',
      'Drink to thirst, plus a glass of water with each meal.',
      'Plain starches for a week — rice, banana, toast — then add your usual foods back one at a time.',
      'Call the same day if you see blood, run a temperature above 38 °C, or the pain becomes constant ' +
        'rather than coming in waves.',
    ],

    // Both empty on purpose: a check-in that changes nothing about the
    // medications is the common case, and the screen says so rather than
    // leaving a heading with nothing under it.
    medicationsStarted: [],
    medicationsStopped: [],

    nextSteps: [
      {
        appointmentId: 'appt-sep-24',
        title: 'Follow-up visit',
        detail: 'We will read the stool tests and the blood count together.',
      },
    ],
  },
};

/** The summary for one appointment, or null when the visit has none. */
export const visitSummaryFor = (appointmentId) => VISIT_SUMMARIES[appointmentId] ?? null;

/** Whether a "View Visit Summary" action belongs on an appointment's card. */
export const hasVisitSummary = (appointmentId) => appointmentId in VISIT_SUMMARIES;
