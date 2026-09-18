/**
 * Health record — the medication list and the lab/diagnostic reports.
 *
 * Home shows the first few of each; the Health Record screens show the lot.
 * One source either way, so a medication cannot appear on the dashboard and
 * be missing from the list behind it.
 */

/* ============================================================================
   MEDICATIONS
   ========================================================================= */

/**
 * Every medication the patient is on, or was on, from either direction.
 *
 * TWO AXES, and the Medications screen splits on both:
 *
 *   source   'prescribed' — ordered by the practice. Read-only in the portal.
 *            'self'       — the patient added it themselves. Theirs to change.
 *   ended    null while they are taking it; a date once they stopped.
 *
 * `ended` rather than a `status: 'active' | 'past'` field, so a row cannot
 * claim to be Active and carry a stop date at the same time. isActive() below
 * is the only thing that reads it, and every screen asks that instead of
 * comparing strings.
 *
 * `schedule` is a field rather than a pre-baked badge: the chips a row shows
 * are derived by medicationTags(), so Home and the Medications screen cannot
 * drift apart on what a medication looks like.
 *
 * `pharmacy` is where THIS medication is dispensed, on the row rather than in
 * a list of its own. It used to be a Pharmacy tab holding the patient's
 * pharmacies, which answered "where do you collect prescriptions" — a
 * question nobody arrives at this screen asking. The one they do ask is "this
 * one, where do I pick it up", and that is a property of the medication: a
 * ninety-day maintenance box and a five-day antibiotic routinely come from
 * two different counters. Blank on the rows the patient added themselves,
 * which is honest — a supplement off a shop shelf was not dispensed anywhere.
 *
 * READ-ONLY. The portal shows this list; it does not change it. Every mutator
 * this file used to export went with the Add / Stop / Remove controls the
 * Medications screen no longer draws — see the note at the top of
 * js/screens/health-medications.js. A record the practice keeps is amended by
 * telling the practice, not by editing your own copy of it.
 */
export const MEDICATIONS = [
  /* --- Prescribed, current -------------------------------------------------
     Pantoprazole is the medication started at the August 8 visit, and the
     Famotidine below is the one stopped at it. Both are named in that visit's
     summary (data/visit-summaries.js) with these doses and these dates: a
     patient who reads "we started you on pantoprazole" and then opens
     Medications has to find it there. */
  {
    id: 'med-pantoprazole',
    name: 'Pantoprazole',
    dose: '40 mg',
    schedule: 'Once a day',
    prescriber: 'Dianne Russell',
    pharmacy: 'Westside Pharmacy',
    started: '08/08/2026',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'prescribed',
    refill: false,
    note: '',
  },
  {
    id: 'med-coumadin',
    name: 'Coumadin',
    dose: '10 mg',
    schedule: 'Once a day',
    prescriber: 'Jane Cooper',
    pharmacy: 'Meridian Mail Pharmacy',
    started: '10/02/2025',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'prescribed',
    refill: false,
    note: '',
  },
  {
    id: 'med-amox',
    name: 'Amoxicillin and Clavulanate',
    dose: '10 mg',
    schedule: 'Every 8 hrs',
    prescriber: 'Dianne Russell',
    pharmacy: 'Westside Pharmacy',
    started: '09/18/2025',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'prescribed',
    refill: false,
    note: '',
  },
  {
    id: 'med-glipizide',
    name: 'Glipizide and metformin',
    dose: '10 mg',
    schedule: 'Alternate days',
    prescriber: 'Jane Cooper',
    pharmacy: 'Meridian Mail Pharmacy',
    started: '07/30/2025',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'prescribed',
    refill: true,
    note: '',
  },

  /* --- Prescribed, finished ------------------------------------------------ */
  {
    id: 'med-famotidine',
    name: 'Famotidine',
    dose: '20 mg',
    schedule: 'Twice a day',
    prescriber: 'Dianne Russell',
    pharmacy: 'Westside Pharmacy',
    started: '02/12/2026',
    ended: '08/08/2026',
    stopReason: 'Switched to Pantoprazole',
    stoppedBy: 'Dianne Russell',
    source: 'prescribed',
    refill: false,
    note: '',
  },
  {
    id: 'med-omeprazole',
    name: 'Omeprazole',
    dose: '20 mg',
    schedule: 'Once a day',
    prescriber: 'Jane Cooper',
    pharmacy: 'Westside Pharmacy',
    started: '03/14/2025',
    ended: '06/30/2025',
    stopReason: 'Course completed',
    stoppedBy: 'Jane Cooper',
    source: 'prescribed',
    refill: false,
    note: '',
  },
  {
    id: 'med-prednisone',
    name: 'Prednisone',
    dose: '5 mg',
    schedule: 'Twice a day',
    prescriber: 'Guy Hawkins',
    pharmacy: 'Westside Pharmacy',
    started: '01/08/2025',
    ended: '02/05/2025',
    stopReason: 'Course completed',
    stoppedBy: 'Guy Hawkins',
    source: 'prescribed',
    refill: false,
    note: '',
  },

  /* --- Added by the patient ------------------------------------------------- */
  {
    id: 'med-vitamin-d',
    name: 'Vitamin D3',
    dose: '2000 IU',
    schedule: 'Once a day',
    prescriber: '',
    pharmacy: '',
    started: '05/02/2025',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'self',
    refill: false,
    note: 'Suggested at my last physical',
  },
  {
    id: 'med-probiotic',
    name: 'Probiotic (Culturelle)',
    dose: '1 capsule',
    schedule: 'Once a day',
    prescriber: '',
    pharmacy: '',
    started: '11/12/2025',
    ended: null,
    stopReason: '',
    stoppedBy: '',
    source: 'self',
    refill: false,
    note: 'For bloating',
  },
  {
    id: 'med-ibuprofen',
    name: 'Ibuprofen',
    dose: '200 mg',
    schedule: 'As needed',
    prescriber: '',
    pharmacy: '',
    started: '08/01/2025',
    ended: '09/10/2025',
    stopReason: 'Upset stomach (patient reported)',
    stoppedBy: 'Patient',
    source: 'self',
    refill: false,
    /*
     * `note` used to read "Stopped — it upset my stomach", which was the stop
     * reason filed in the only field that existed to hold it. Now that
     * stopReason is a column, the two are separated: `note` answers "why do
     * you take this" and belongs to the row for its whole life, stopReason
     * answers "why did this end" and only exists once it has.
     */
    note: 'For occasional back pain',
  },
];

/** Taking it now. The single definition of the Active/Past split. */
export const isActive = (med) => !med.ended;

/**
 * The chips a row shows, in the order they are drawn.
 *
 * Schedule first, always; the refill marker after it, on the one that is due.
 * 'info' blue for the schedule, 'purple' for Refill — the two tones the
 * design uses here. A finished medication carries no refill marker, whatever
 * the flag says: nothing is due on something you stopped taking.
 */
export function medicationTags(med) {
  const tags = [];
  if (med.schedule) tags.push({ label: med.schedule, tone: 'info' });
  if (med.refill && isActive(med)) tags.push({ label: 'Refill', tone: 'purple' });
  return tags;
}

/**
 * The list for one section of the Medications screen.
 *
 * @param {object}  query
 * @param {string} [query.source]  'prescribed' or 'self'; both when omitted
 * @param {boolean}[query.active]  true for current, false for stopped
 */
export function medicationsBy({ source, active } = {}) {
  return MEDICATIONS.filter(
    (med) =>
      (source === undefined || med.source === source) &&
      (active === undefined || isActive(med) === active)
  );
}

/* ============================================================================
   REPORTS
   ========================================================================= */

/**
 * Latest reports.
 *
 * `abnormal` rather than a status string, so the screens decide how to say
 * it. Home prints a badge; the Reports screen prints the same badge plus the
 * ordering provider, and neither has to parse a label to know what it means.
 */
export const REPORTS = [
  {
    id: 'rep-cbc',
    name: 'CBC',
    date: '10/28/2025',
    orderedBy: 'Jane Cooper',
    abnormal: true,
  },
  {
    id: 'rep-cmp',
    name: 'Comprehensive metabolic panel',
    date: '10/22/2025',
    orderedBy: 'Jane Cooper',
    abnormal: false,
  },
  {
    id: 'rep-ecg',
    name: 'Electrocardiogram',
    date: '10/20/2025',
    orderedBy: 'Guy Hawkins',
    abnormal: true,
  },
  {
    id: 'rep-diabetes',
    name: 'Diabetes test',
    date: '10/12/2025',
    orderedBy: 'Dianne Russell',
    abnormal: false,
  },
];
