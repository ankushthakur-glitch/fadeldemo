/**
 * PATIENT CHART — DIAGNOSES.
 *
 * The maintained problem list: what this patient is carrying, whether it is
 * still live, and the three dates that say how long it has been true.
 *
 * WHY THIS IS ITS OWN LIST
 * Profile · Clinical carries a `problems` array too, and the same argument
 * applies here as applies to allergies (see data/chart-allergies.js). That
 * one is the face-sheet summary — code, label, status — read at a glance
 * beside the medications. This is the maintained record: it adds the type,
 * the date the practice wrote it down and the date it was resolved, which is
 * what lets somebody answer "when did we stop treating this" rather than only
 * "is it still on the list". Merging them would mean the face sheet grew
 * three columns nobody reads there, or this screen lost the provenance that
 * is its whole point.
 *
 * A ROW STORES A CODE, NOT A SENTENCE.
 * The wording of a diagnosis lives in data/icd10.js and nowhere else — that
 * file exists because four screens had each kept their own copy of the same
 * code and the copies had drifted. So a row here carries `code`, and the
 * module renders it through `icd10Label()`. Adding a description column to
 * this fixture would be re-opening the drift the catalogue was built to
 * close, so every code below is one the catalogue knows.
 *
 * THREE DATES, AND THEY ARE NOT INTERCHANGEABLE
 *   onsetDate     when the condition began, as the patient or the record has it
 *   recordedDate  when this practice wrote it down
 *   resolveDate   when it stopped being true — null while it is still Active
 * Onset and recorded are the same day for something diagnosed in the building
 * and years apart for something the patient arrives already carrying. A
 * record that cannot tell those apart cannot answer "how long have we known".
 *
 * STATUS AND TYPE ANSWER DIFFERENT QUESTIONS
 * Status is whether it is live — Active or Historical. Type is how it
 * behaves — Chronic or Acute. A chronic condition can be Historical (a
 * colitis in long remission) and an acute one can be Active (a flare being
 * treated this week), so neither can be derived from the other and the
 * add form asks for both.
 */

/* --- The vocabularies the form offers -------------------------------------- */

/**
 * Two statuses, not three. "Resolved" is not a third state — it is what
 * Historical means, and the resolve date beside it is the fact that separates
 * a condition that ended from one that was never really there.
 */
export const DIAGNOSIS_STATUSES = ['Active', 'Historical'];

export const DIAGNOSIS_TYPES = ['Chronic', 'Acute'];

/** Status → the badge tone the table draws it in. */
export const DIAGNOSIS_STATUS_TONE = { Active: 'warning', Historical: 'neutral' };

/* --- The recorded lists ---------------------------------------------------- */

/**
 * Keyed by MRN. A patient with no entry has no recorded diagnoses, which is
 * NOT the same as "nothing wrong with them" — it means nobody has written a
 * problem list yet, and the empty table says exactly that.
 *
 * Henna West's rows are the same conditions her face sheet lists, so the two
 * screens agree about the same person. The gastritis is the one that has been
 * closed off, because a list where nothing is ever Historical never exercises
 * the resolve date.
 */
export const CHART_DIAGNOSES = {
  326486: [
    {
      id: 'dx1',
      code: 'K21.9',
      type: 'Chronic',
      onsetDate: '04-10-2024',
      recordedDate: '04-10-2024',
      resolveDate: null,
      status: 'Active',
      note: '',
    },
    {
      id: 'dx2',
      code: 'K29.00',
      type: 'Acute',
      onsetDate: '10-10-2025',
      recordedDate: '10-10-2025',
      resolveDate: '23-12-2025',
      status: 'Historical',
      note: 'Settled on the PPI; no repeat scope needed.',
    },
    {
      id: 'dx3',
      code: 'K57.30',
      type: 'Chronic',
      onsetDate: '15-03-2023',
      recordedDate: '15-03-2023',
      resolveDate: null,
      status: 'Active',
      note: '',
    },
    {
      id: 'dx4',
      code: 'K44.9',
      type: 'Chronic',
      onsetDate: '12-11-2025',
      recordedDate: '15-11-2025',
      resolveDate: null,
      status: 'Active',
      note: 'Small sliding hiatus hernia seen at the last endoscopy.',
    },
  ],

  326477: [
    {
      id: 'dx1',
      code: 'K75.81',
      type: 'Chronic',
      onsetDate: '19-10-2025',
      recordedDate: '19-10-2025',
      resolveDate: null,
      status: 'Active',
      note: 'Found on imaging during the abdominal pain work-up.',
    },
  ],
};

export const EMPTY_CHART_DIAGNOSES = [];
