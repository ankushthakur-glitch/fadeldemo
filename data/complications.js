/**
 * DEMO DATA — post-procedure complications. Every case, patient and note invented.
 *
 * WHAT THIS IS FOR
 *
 * An endoscopy unit is judged on what went wrong and how often. That is one
 * number — complications ÷ procedures — and before this file the practice
 * could not produce it, because the two halves lived apart: the list knew what
 * had been done, and a bad outcome was a sentence somewhere in a note. Nothing
 * counted either, so "what is our perforation rate" was answered from memory.
 *
 * THE DENOMINATOR IS NOT TYPED IN
 *
 * A tracker that stores its own procedure count is a tracker whose rate can be
 * wrong in a way nobody can see. The completed procedures here are DERIVED from
 * data/medication-usage.js — the same case list the inventory ledger draws the
 * shelf down by — so the denominator moves with the theatre log rather than
 * beside it, and the two screens cannot disagree about how many cases the unit
 * has run.
 *
 * That file is written per ADMINISTRATION: one row per drug given, several rows
 * to a case. A case here is those rows folded back together on the case number
 * their ids already carry, which is what makes "6 completed procedures" a
 * countable fact rather than a figure somebody maintains.
 *
 * A COMPLICATION HANGS OFF A PROCEDURE, NOT OFF A PATIENT
 *
 * `procedureId` is the whole join. Patient, procedure type, physician and the
 * date the case ran are all read through it, never stored again here — so a
 * complication cannot end up filed against the wrong endoscopist, and the row
 * in this table always names the same clinician the theatre log does. The only
 * facts this file owns are the ones the procedure record genuinely does not
 * hold: what went wrong, how badly, when it showed itself, and what was done.
 *
 * `date` IS SEPARATE FROM THE PROCEDURE DATE, AND HAS TO BE
 *
 * A perforation is found on the table; an infection is found four days later.
 * Folding the two into one date would make delayed complications invisible to
 * a date filter — which is exactly the group a unit most wants to look at — so
 * "Date of Occurrence" is asked for and defaults to nothing rather than
 * quietly inheriting the case date.
 */
import { PROCEDURE_USAGE } from './medication-usage.js';

/* ============================================================================
   THE VOCABULARY
   ========================================================================= */

/**
 * What can go wrong, as an endoscopy unit reports it.
 *
 * Short and closed on purpose. A free-text complication field gives you
 * "bleed", "bleeding", "PP bleed" and "post-polypectomy haemorrhage" as four
 * different things, and the moment that happens the Most Common Type figure is
 * worthless. `Other` is the pressure valve, and the note beside it carries what
 * the list could not.
 */
export const COMPLICATION_TYPES = [
  'Bleeding',
  'Perforation',
  'Infection',
  'Adverse Reaction to Sedation',
  'Cardiopulmonary Event',
  'Other',
];

/**
 * How badly, in three steps, each with the badge tone it wears.
 *
 * Three rather than five: the distinction that changes what anybody does is
 * "sent home", "kept and treated", "escalated". A five-point scale is graded
 * differently by every person filling it in, and a severity nobody grades the
 * same way cannot be summed.
 */
export const SEVERITIES = [
  { value: 'Mild', tone: 'success' },
  { value: 'Moderate', tone: 'warning' },
  { value: 'Severe', tone: 'critical' },
];

export const severityTone = (value) =>
  SEVERITIES.find((s) => s.value === value)?.tone ?? 'neutral';

/* ============================================================================
   THE DENOMINATOR — every case the unit has completed

   Folded out of the administration log. A row belongs to a case when its id
   carries a case number and it names a patient; the daily throat-spray bottle
   is drawn against the LIST rather than against anybody, so it has no MRN and
   is not a procedure.
   ========================================================================= */

const CASE_ID = /^use-\d{4}-\d{2}-\d{2}-(\d+)-/;

function buildProcedures() {
  const cases = new Map();

  PROCEDURE_USAGE.forEach((row) => {
    const match = CASE_ID.exec(row.id);
    if (!match || !row.mrn) return;

    const id = `case-${match[1]}`;
    const seen = cases.get(id);

    if (!seen) {
      cases.set(id, {
        id,
        date: row.date,
        /* The case starts when the first drug goes in. Rows arrive newest
           first, so the earliest time has to be kept rather than the first
           one met. */
        time: row.time,
        patient: row.patient,
        mrn: row.mrn,
        procedure: row.procedure,
        physician: row.provider,
      });
      return;
    }

    if (row.time < seen.time) seen.time = row.time;
  });

  /* Newest first — the case somebody is recording against is nearly always
     the one that just finished. */
  return [...cases.values()].sort((a, b) =>
    `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  );
}

export const COMPLETED_PROCEDURES = buildProcedures();

export const procedureById = (id) => COMPLETED_PROCEDURES.find((p) => p.id === id);

/**
 * A case as the picker shows it — "Daniel Okafor — EGD".
 *
 * One function rather than a template literal at each call site: the drawer,
 * the table's empty fallback and the print report all name a case, and three
 * copies is three places for the same case to be written up differently.
 */
export const procedureLabel = (procedure) =>
  procedure ? `${procedure.patient} — ${procedure.procedure}` : '';

/** Every endoscopist who has run a case, for the physician filter. */
export const PHYSICIANS = [...new Set(COMPLETED_PROCEDURES.map((p) => p.physician))].sort(
  (a, b) => a.localeCompare(b)
);

/* ============================================================================
   THE NUMERATOR — what has been recorded so far

   Fifty across twelve days of lists, filed against fifty of the fifty-four
   cases the theatre log holds. That is a demo volume, not a plausible unit:
   the rate card reads in the nineties, which no endoscopy service would
   survive. It is here because a four-row table exercises nothing — no second
   page, no filter that meaningfully narrows, no Most Common Type worth
   computing — and every one of those is on this screen. Read the figures as
   fixtures. If this file is ever wanted as a believable practice again, thin
   the seed rather than padding the denominator: the denominator is derived,
   and inventing cases to flatter the rate is exactly the lie the derivation
   was written to prevent.

   The spread is deliberate. Every type in COMPLICATION_TYPES appears, all
   three severities appear, all three endoscopists and all five procedure
   kinds carry at least one, and several are dated after the case they belong
   to — so no filter on this screen has an empty result to explain and the
   delayed-complication case stays visible.

   `case-17` is the flumazenil case data/medication-usage.js already logs as
   "Sedation reversed — complication recorded". That row and this one are the
   same event seen from the trolley and from the tracker, which is the point:
   a reversal that appears in the drug log and nowhere else is a complication
   the unit never counted.
   ========================================================================= */

const SEED = [
  {
    id: 'cx-1',
    procedureId: 'case-17',
    type: 'Adverse Reaction to Sedation',
    severity: 'Moderate',
    date: '2026-07-28',
    notes:
      'Desaturation to 88% after the second midazolam increment. Flumazenil 0.2 mg given, '
      + 'airway supported on the table. Full recovery, discharged the same day.',
  },
  {
    id: 'cx-2',
    procedureId: 'case-30',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-30',
    notes:
      'Oozing at the polypectomy site. Two clips applied, haemostasis confirmed before '
      + 'withdrawal. No transfusion.',
  },
  {
    /* Recorded a day AFTER the case it belongs to — the ERCP ran on the 3rd
       and the CT that found this was the next morning. Exactly why Date of
       Occurrence is asked for rather than inherited; see the header note. */
    id: 'cx-3',
    procedureId: 'case-41',
    type: 'Perforation',
    severity: 'Severe',
    date: '2026-08-04',
    notes:
      'Retroperitoneal air on the next-morning CT. Transferred to the regional hospital '
      + 'and managed conservatively.',
  },
  {
    id: 'cx-4',
    procedureId: 'case-45',
    type: 'Bleeding',
    severity: 'Moderate',
    date: '2026-08-03',
    notes:
      'Fresh rectal bleeding in recovery. Re-scoped, single clip to the caecal polypectomy '
      + 'base. Kept for four hours of observation.',
  },
  {
    id: 'cx-5',
    procedureId: 'case-0',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-24',
    notes:
      'Minor ooze from a 6 mm sigmoid polypectomy site. Adrenaline injection alone, no clip. '
      + 'Haemoglobin unchanged at four hours.',
  },
  {
    id: 'cx-6',
    procedureId: 'case-1',
    type: 'Other',
    severity: 'Moderate',
    date: '2026-07-25',
    notes:
      'Post-ERCP pancreatitis. Epigastric pain overnight, amylase 840 the next morning. '
      + 'Admitted for fluids and analgesia, home on day three.',
  },
  {
    id: 'cx-7',
    procedureId: 'case-2',
    type: 'Adverse Reaction to Sedation',
    severity: 'Mild',
    date: '2026-07-24',
    notes:
      'Hypotension to 84 systolic after the fentanyl increment. Fluids and head-down tilt, no '
      + 'reversal agent. Settled on the trolley.',
  },
  {
    id: 'cx-8',
    procedureId: 'case-3',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-24',
    notes:
      'Ooze from the FNA tract seen on withdrawal. Watched for two minutes, stopped without '
      + 'intervention.',
  },
  {
    id: 'cx-9',
    procedureId: 'case-5',
    type: 'Cardiopulmonary Event',
    severity: 'Moderate',
    date: '2026-07-24',
    notes:
      'Bradycardia to 38 on caecal intubation, then a vasovagal faint in recovery. Atropine 0.6 '
      + 'mg, kept for an hour of monitoring.',
  },
  {
    id: 'cx-10',
    procedureId: 'case-6',
    type: 'Infection',
    severity: 'Severe',
    date: '2026-07-26',
    notes:
      'Rigors and 39.1 degrees two days after a difficult cannulation. Blood cultures grew E. '
      + 'coli. Admitted for IV antibiotics and repeat drainage.',
  },
  {
    id: 'cx-11',
    procedureId: 'case-7',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-27',
    notes: 'Oozing from a duodenal biopsy site. Single clip, observed two hours, discharged.',
  },
  {
    id: 'cx-12',
    procedureId: 'case-8',
    type: 'Adverse Reaction to Sedation',
    severity: 'Moderate',
    date: '2026-07-27',
    notes:
      'Loss of the gag reflex on the second propofol increment. Airway held with a jaw thrust '
      + 'and the case paused four minutes. No reversal, no admission.',
  },
  {
    id: 'cx-13',
    procedureId: 'case-9',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-27',
    notes:
      'Contact bleeding from inflamed rectal mucosa at biopsy. Stopped spontaneously before '
      + 'withdrawal.',
  },
  {
    id: 'cx-14',
    procedureId: 'case-10',
    type: 'Perforation',
    severity: 'Severe',
    date: '2026-07-27',
    notes:
      'Free air on the post-procedure film after a difficult sigmoid loop. Laparoscopic repair '
      + 'the same evening; four nights in.',
  },
  {
    id: 'cx-15',
    procedureId: 'case-11',
    type: 'Other',
    severity: 'Mild',
    date: '2026-07-28',
    notes:
      'Hyperamylasaemia of 410 on the morning bloods with no pain and no tenderness. Not '
      + 'treated, recorded because it was looked for.',
  },
  {
    id: 'cx-16',
    procedureId: 'case-12',
    type: 'Cardiopulmonary Event',
    severity: 'Mild',
    date: '2026-07-27',
    notes:
      'Three short runs of atrial ectopics on the monitor during intubation of the oesophagus. '
      + 'Self-terminating, ECG in recovery normal.',
  },
  {
    id: 'cx-17',
    procedureId: 'case-13',
    type: 'Infection',
    severity: 'Moderate',
    date: '2026-07-30',
    notes:
      'Fever of 38.4 three days after cyst aspiration. Oral ciprofloxacin from the GP, no '
      + 'admission, reviewed in clinic at a week.',
  },
  {
    id: 'cx-18',
    procedureId: 'case-15',
    type: 'Bleeding',
    severity: 'Moderate',
    date: '2026-07-28',
    notes:
      'Bleeding at the resection bed of a 25 mm ascending polyp. Four clips and adrenaline; '
      + 'kept for six hours, no transfusion.',
  },
  {
    id: 'cx-19',
    procedureId: 'case-16',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-28',
    notes:
      'Sphincterotomy ooze, self-limiting. Spray adrenaline applied, dry before the scope came '
      + 'out.',
  },
  {
    id: 'cx-20',
    procedureId: 'case-18',
    type: 'Adverse Reaction to Sedation',
    severity: 'Mild',
    date: '2026-07-28',
    notes:
      'Prolonged drowsiness past the discharge criteria. Kept a further two hours and sent home '
      + 'with an escort.',
  },
  {
    id: 'cx-21',
    procedureId: 'case-19',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-28',
    notes: 'Bleeding after a rectal biopsy in a patient on apixaban. Pressure and a single clip.',
  },
  {
    id: 'cx-22',
    procedureId: 'case-20',
    type: 'Cardiopulmonary Event',
    severity: 'Moderate',
    date: '2026-07-28',
    notes:
      'Chest tightness with 1 mm of ST depression on the monitor. Procedure abandoned at the '
      + 'splenic flexure, medical review the same afternoon; troponin negative.',
  },
  {
    id: 'cx-23',
    procedureId: 'case-21',
    type: 'Other',
    severity: 'Moderate',
    date: '2026-07-30',
    notes:
      'Biliary stent found displaced into the duodenum on the day-two film. Brought back for a '
      + 'repeat ERCP to replace it.',
  },
  {
    id: 'cx-24',
    procedureId: 'case-22',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-29',
    notes:
      'Ooze after dilatation of a peptic stricture. Observed, no intervention, home the same '
      + 'day.',
  },
  {
    id: 'cx-25',
    procedureId: 'case-23',
    type: 'Adverse Reaction to Sedation',
    severity: 'Severe',
    date: '2026-07-29',
    notes:
      'Apnoea after the propofol top-up. Bag-mask ventilation for four minutes with the '
      + 'anaesthetist called to the room. Kept overnight, discharged well.',
  },
  {
    id: 'cx-26',
    procedureId: 'case-24',
    type: 'Cardiopulmonary Event',
    severity: 'Mild',
    date: '2026-07-29',
    notes:
      'Vasovagal episode on the table with a brief bradycardia. Legs raised, resolved in under '
      + 'a minute, procedure completed.',
  },
  {
    id: 'cx-27',
    procedureId: 'case-25',
    type: 'Bleeding',
    severity: 'Moderate',
    date: '2026-07-31',
    notes:
      'Fresh bleeding per rectum the day after a hot snare polypectomy. Re-scoped, two clips to '
      + 'the base. Haemoglobin down 11 g/L, no transfusion.',
  },
  {
    id: 'cx-28',
    procedureId: 'case-26',
    type: 'Infection',
    severity: 'Moderate',
    date: '2026-08-01',
    notes:
      'Low-grade cholangitis at two days — temperature 38.2, bilirubin rising. Oral '
      + 'antibiotics, managed at home with daily phone review.',
  },
  {
    id: 'cx-29',
    procedureId: 'case-27',
    type: 'Adverse Reaction to Sedation',
    severity: 'Mild',
    date: '2026-07-30',
    notes:
      'Itching and a blotchy rash across the chest after pethidine. Chlorphenamine 10 mg, '
      + 'settled before discharge. Allergy flagged on the chart.',
  },
  {
    id: 'cx-30',
    procedureId: 'case-28',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-30',
    notes: 'Small ooze at the needle tract after node sampling. Stopped under observation.',
  },
  {
    id: 'cx-31',
    procedureId: 'case-29',
    type: 'Other',
    severity: 'Mild',
    date: '2026-07-30',
    notes:
      'Painful distension from retained insufflation, still tender at two hours. Nothing found '
      + 'on the film; settled with mobilisation.',
  },
  {
    id: 'cx-32',
    procedureId: 'case-31',
    type: 'Other',
    severity: 'Severe',
    date: '2026-08-01',
    notes:
      'Severe post-ERCP pancreatitis. HDU for three days with fluid resuscitation, discharged '
      + 'on day nine.',
  },
  {
    id: 'cx-33',
    procedureId: 'case-32',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-31',
    notes: 'Antral biopsy-site ooze on aspirin. Watched, dry within a minute.',
  },
  {
    id: 'cx-34',
    procedureId: 'case-33',
    type: 'Infection',
    severity: 'Mild',
    date: '2026-08-03',
    notes:
      'Fever and sore throat three days on. Chest film clear, aspiration excluded; oral '
      + 'antibiotics from the GP.',
  },
  {
    id: 'cx-35',
    procedureId: 'case-35',
    type: 'Perforation',
    severity: 'Moderate',
    date: '2026-07-31',
    notes:
      'Serosal tear seen at the polypectomy base. Closed with three clips endoscopically. '
      + 'Admitted for IV antibiotics and 24 hours of observation, no surgery.',
  },
  {
    id: 'cx-36',
    procedureId: 'case-36',
    type: 'Infection',
    severity: 'Severe',
    date: '2026-08-02',
    notes:
      'Cholangitis with hypotension 36 hours after an incomplete drainage. Admitted septic, ITU '
      + 'reviewed, drained again at repeat ERCP.',
  },
  {
    id: 'cx-37',
    procedureId: 'case-37',
    type: 'Adverse Reaction to Sedation',
    severity: 'Moderate',
    date: '2026-07-31',
    notes:
      'Desaturation to 90% requiring 4 L of oxygen and a long recovery. Discharged at four '
      + 'hours.',
  },
  {
    id: 'cx-38',
    procedureId: 'case-38',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-07-31',
    notes: 'Ooze from the FNA site of a pancreatic head lesion. Settled without intervention.',
  },
  {
    id: 'cx-39',
    procedureId: 'case-39',
    type: 'Cardiopulmonary Event',
    severity: 'Mild',
    date: '2026-07-31',
    notes:
      'Bradycardia to 44 on rectal insufflation. Resolved on stopping insufflation; no drugs '
      + 'given.',
  },
  {
    id: 'cx-40',
    procedureId: 'case-40',
    type: 'Bleeding',
    severity: 'Moderate',
    date: '2026-08-03',
    notes:
      'Bleeding from a 15 mm transverse polypectomy site. Clipped, kept for observation, '
      + 'haemoglobin stable.',
  },
  {
    id: 'cx-41',
    procedureId: 'case-42',
    type: 'Adverse Reaction to Sedation',
    severity: 'Mild',
    date: '2026-08-03',
    notes:
      'Nausea and vomiting in recovery after midazolam. Ondansetron 4 mg, discharged at three '
      + 'hours.',
  },
  {
    id: 'cx-42',
    procedureId: 'case-43',
    type: 'Infection',
    severity: 'Moderate',
    date: '2026-08-06',
    notes:
      'Fever and a CRP of 130 three days after cyst aspiration. Admitted for 48 hours of IV '
      + 'antibiotics.',
  },
  {
    id: 'cx-43',
    procedureId: 'case-44',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-08-03',
    notes: 'Bleeding from a distal rectal biopsy. Adrenaline injection, dry before withdrawal.',
  },
  {
    id: 'cx-44',
    procedureId: 'case-46',
    type: 'Other',
    severity: 'Moderate',
    date: '2026-08-04',
    notes:
      'Basket impacted on a large stone. Freed at a second procedure the following morning '
      + 'after mechanical lithotripsy.',
  },
  {
    id: 'cx-45',
    procedureId: 'case-47',
    type: 'Cardiopulmonary Event',
    severity: 'Severe',
    date: '2026-08-03',
    notes:
      'Aspiration during an urgent EGD for haematemesis. Desaturated to 82%, suctioned and '
      + 'given oxygen; admitted with aspiration pneumonia and treated for five days.',
  },
  {
    id: 'cx-46',
    procedureId: 'case-48',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-08-04',
    notes: 'Ooze at the puncture site after node sampling. No intervention.',
  },
  {
    id: 'cx-47',
    procedureId: 'case-50',
    type: 'Perforation',
    severity: 'Severe',
    date: '2026-08-04',
    notes:
      'Perforation at a tight diverticular segment. Open repair with a defunctioning stoma the '
      + 'same night.',
  },
  {
    id: 'cx-48',
    procedureId: 'case-51',
    type: 'Other',
    severity: 'Moderate',
    date: '2026-08-05',
    notes:
      'Post-ERCP pancreatitis the morning after a difficult cannulation. Amylase 720, admitted '
      + 'for fluids, home on day four.',
  },
  {
    id: 'cx-49',
    procedureId: 'case-52',
    type: 'Adverse Reaction to Sedation',
    severity: 'Mild',
    date: '2026-08-04',
    notes:
      'Slow to rouse after midazolam and fentanyl. Observed an extra ninety minutes, no '
      + 'reversal.',
  },
  {
    id: 'cx-50',
    procedureId: 'case-53',
    type: 'Bleeding',
    severity: 'Mild',
    date: '2026-08-04',
    notes: 'Ooze from the FNA tract of a subepithelial lesion. Stopped spontaneously.',
  },
];

/**
 * The seed, with anything that no longer names a real case dropped.
 *
 * The case list is derived, so a change to the theatre log can retire a case
 * number out from under a seeded complication. Keeping the orphan would put a
 * row on the table with no patient, no physician and no procedure in it — four
 * empty cells that read as a broken screen rather than as stale demo data.
 */
export const COMPLICATIONS = SEED.filter((entry) => procedureById(entry.procedureId));

/* ============================================================================
   THE FIGURES

   Computed rather than stored, and computed HERE rather than on the screen, so
   the three cards, the print report and any later export cannot each arrive at
   a different answer to the same question.
   ========================================================================= */

/**
 * Complications ÷ completed procedures, as a percentage.
 *
 * Null when there are no procedures to divide by — the card then says "—"
 * rather than "0.0%", because those are different claims: one is "nothing went
 * wrong", the other is "there is nothing to report on yet".
 */
export function complicationRate(complicationCount, procedureCount) {
  if (!procedureCount) return null;
  return (complicationCount / procedureCount) * 100;
}

/**
 * The type recorded most often, or null on an empty set.
 *
 * Ties break on COMPLICATION_TYPES order rather than alphabetically, so the
 * card does not swap its answer between two equally common types every time a
 * filter changes.
 */
export function mostCommonType(rows) {
  if (!rows.length) return null;

  const counts = new Map();
  rows.forEach((row) => counts.set(row.type, (counts.get(row.type) ?? 0) + 1));

  let best = null;
  COMPLICATION_TYPES.forEach((type) => {
    const count = counts.get(type) ?? 0;
    if (count > (best?.count ?? 0)) best = { type, count };
  });

  return best;
}

/** How many of each severity — the four figures the printed report heads with. */
export function severityCounts(rows) {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s.value, 0]));
  rows.forEach((row) => {
    if (row.severity in counts) counts[row.severity] += 1;
  });
  return counts;
}
