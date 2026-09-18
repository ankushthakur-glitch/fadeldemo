/**
 * The procedure encounter — its run of work, as data.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM data/procedure-encounter.js
 * That file holds the CONTENTS of the day's documents — the consent wording,
 * the checklist questions, the assessment fields. This one holds the SHAPE of
 * the day: eight numbered steps, each owned by one role, each naming the
 * documents that role signs. The encounter screen reads this to draw its rail
 * and reads the other to fill the documents in it, and keeping the two apart
 * means changing the order of the day never means editing clinical wording.
 *
 * The screen once had a rival arrangement that modelled the visit as three
 * filed STAGES (pre / intra / post) instead, and the two ran side by side
 * behind a version switch. The step run won; the stage screen and the switch
 * are gone, and this is the only arrangement left.
 *
 * The steps are a LADDER, not a menu: the numbering is the order the run is
 * WORKED, which is the order of the day everywhere but one row — see the note
 * over post-anaesthesia for the one break and why it is there — and the rail
 * draws it as a vertical stepper so the eye reads "where is this case up to"
 * before it reads any single document. Substeps are the documents
 * inside one step, and the rail is the only place they are chosen from. Steps
 * once carried a flag asking for their substeps to be repeated across the top of
 * the working column as well; it is gone, because two sets of controls for the
 * same eight destinations had to be kept agreeing with each other and bought
 * nothing for it.
 *
 * STATUS is prototype fixture data, exactly as the rest of data/ is. Four
 * values, and the rail draws each differently:
 *
 *   'complete'     signed and done — green tick
 *   'in-progress'  opened, part-filled, not signed — amber clock
 *   'current'      where the case is now — the step the rail opens on
 *   'todo'         not started — hollow marker
 *
 * EVERY STEP AND SUBSTEP STARTS AT 'todo'. The fixtures used to open the case
 * mid-run — checklist signed, three of the eight intra-procedure facets part
 * filled — which was useful for seeing all four markers at once and wrong for
 * everything else: a screen that opens on a half-done case cannot be walked
 * from the beginning, and walking it from the beginning is what a review of the
 * run needs to do. The other three values stay defined because they are the
 * states a step MOVES through; nothing authored here uses them yet.
 *
 * With no step authored as 'current', `initialStepId` falls through to the
 * first, so the encounter opens on the pre-procedure checklist — which is where
 * the day actually starts. The rail still draws whichever step is open with the
 * 'current' marker, so "where am I" is answered without any fixture claiming
 * work has been done that has not.
 *
 * A step's own status is NOT derived from its substeps. It is authored, so a
 * fixture can show a step part-way through with its substeps in a mix of
 * states — a derivation would flatten that.
 */

/* The consent the desk takes on the way in. Step 4 quotes it rather than
   restating it — see THE PROCEDURE CONSENT below for why that is the whole
   point of the document. */
import { CONSENT_DOCUMENTS } from './checkin.js';

/**
 * The four marker states, and how each is drawn.
 *
 * `icon` is a sprite id where one says the thing better than a shape can — a
 * tick for done, a clock for started-not-finished. The other two states have
 * no icon on purpose: "here" and "not yet" are a filled ring and a hollow one,
 * drawn in CSS, because a glyph inside a 1rem marker at those two states reads
 * as noise rather than as a word. `tone` picks the semantic colour family the
 * rail paints the marker and its label in.
 */
export const STEP_STATUS = {
  complete: { icon: 'check', tone: 'success', label: 'Complete' },
  'in-progress': { icon: 'clock', tone: 'warning', label: 'In progress' },
  current: { icon: '', tone: 'brand', label: 'Current step' },
  todo: { icon: '', tone: 'neutral', label: 'Not started' },
};

/**
 * The eight steps of a procedure day, in order.
 *
 * CHECK-OUT IS A STEP OF ITS OWN, AND IT SITS AFTER THE CLINICAL ROWS.
 * It spent a while as a document under Procedure, filed beside the discharge
 * record. That put it in the right hour of the day and the wrong room: the desk
 * is not the endoscopist, and a document reachable only by opening somebody
 * else's step is a document the front desk has to be taught to find. It has its
 * own row again — one press from anywhere in the rail, badged to the desk, with
 * a whole step to itself.
 *
 * The row is sixth, under the last clinical step, because that is the order the
 * day ends in: the room finishes with the patient and the patient walks to the
 * counter. It was briefly fifth, in among the clinical steps, on the argument
 * that the desk works it while recovery is still writing up — but a step
 * numbered between two clinical steps reads as a pause in the clinical work,
 * and the counter is not that. Sixth puts it where the run actually breaks:
 * everything above it happens with the patient in the building, and the one
 * step below it happens days later, from whatever came back in the post.
 *
 * What it is still NOT is the original check-out step, which stood at the
 * bottom of the rail holding the words "not built yet". This one is a document,
 * and it is above post-procedure rather than beneath it.
 *
 * The printed instruction sheet is not a row of its own, and it is not on this
 * row either. It was briefly a document between the discharge record and the
 * desk, then the lead of check-out — read back at the counter above the desk's
 * own questions. It IS the discharge record now, on the step above: the sheet
 * is gone through in recovery, with the patient still in the chair, by the
 * nurse discharging them. What the desk does at the counter is confirm that it
 * happened and where the patient went, which is the two cards this row holds.
 *
 * Which set was given is chosen at the head of the sheet itself rather than on
 * a card four inches from it, so a record naming one handout while a different
 * one is on screen is not a state the run can be in — they are one page. See
 * DOC_LEADS in js/screens/encounter.js.
 *
 * THE RUN ENDS AT POST-PROCEDURE.
 * It briefly had a row below it — "End encounter" — which put the act of
 * closing the record on the rail as an eighth step. Closing an encounter is
 * not work anybody sits down to do on this screen: it is what is true once
 * the pots are resulted and the letters have gone, and a row asking for it
 * was a step the run could show as outstanding while nothing was left to
 * chase. Post-procedure is the last thing worked here, so it is the last row
 * here; check-out still says in its own foot that the encounter stays open
 * behind it for pathology.
 *
 * `role` is who signs the step, not who may open it — three people work this
 * screen at once, and every step stays readable to all of them for the same
 * reason the old stage tabs stopped being gated: a step nobody can look into is
 * a room nobody can see the work in.
 */
export const ENCOUNTER_STEPS = [
  {
    id: 'checklist',
    label: 'Pre-procedure checklist',
    role: 'RN',
    status: 'todo',
    substeps: [],
  },

  /*
   * Renamed from the older "Anesthesia Management".
   *
   * The step is not only the anaesthetist's record — it is everything the
   * circulating nurse charts while the scope is in: the times, the vitals
   * trend, the Aldrete scores, fluids, oxygen, what was given and what came
   * off the cart. "Anesthesia Management" named one of those eight things and
   * so read as the anaesthetist's tab, which is the one person who does NOT
   * own it. Intra-procedure Management names the window instead of one of its
   * contents.
   */
  {
    id: 'intra',
    label: 'Intra-procedure Management',
    role: 'RN',
    status: 'todo',
    substeps: [
      { id: 'times', label: 'Times', status: 'todo' },
      { id: 'vitals', label: 'Vitals', status: 'todo' },
      { id: 'aldrete', label: 'Aldrete', status: 'todo' },
      { id: 'iv', label: 'IV', status: 'todo' },
      { id: 'oxygen', label: 'Oxygen', status: 'todo' },
      { id: 'meds-given', label: 'Medication administered', status: 'todo' },
      /* Wastage used to sit here, between what was given and what is on the
         cart, as a tab of its own; then as a second button on Medication
         inventory's toolbar. It is neither now. A write-off is only worth
         anything reconciled — against the lot, its expiry and the par level —
         and all of those live once for the whole practice in Settings ▸
         Medication inventory, which is where the form is. Charting it here
         produced a record the cart list underneath could not even show. */
      { id: 'med-inventory', label: 'Medication inventory', status: 'todo' },
      { id: 'to-recovery', label: 'Discharge', status: 'todo' },
    ],
  },

  /*
   * THE CRNA SIGNS TWICE ON THIS STEP, NOT THREE TIMES.
   *
   * The step used to carry three documents — the consent, the pre-op
   * assessment, and the standing order set as a row of its own. The order set
   * was never a separate sitting: the anaesthesia professional decides the
   * plan and the drugs it may call on in one thought, at one moment, in front
   * of one patient. Splitting them into two rows split one act into two
   * documents, each ending in its own signature, so the same person attested
   * twice to two halves of a decision they had made once.
   *
   * So the orders are shown inside the pre-op assessment — the plan, then the
   * drugs the plan may reach for, then one signature over both. See the three
   * `orders-*` sections on 'anaes-preop' in js/lib/encounter-docs.js: the
   * practice's standing set, printed, with the technique and anything ordered
   * on top of it as the only two fields on them.
   *
   * What this leaves is the three places the anaesthesia professional signs
   * across the whole run, and only three: the consent here, the pre-op and
   * orders here, and the post-anaesthesia record on the step below.
   */
  {
    id: 'pre-anaesthesia',
    label: 'Pre-anaesthesia assessment',
    role: 'CRNA',
    status: 'todo',
    substeps: [
      { id: 'anaes-consent', label: 'Anesthesia consent', status: 'todo' },
      /* One standing order set travels with it, not a prescription: it names
         every drug the sedation plan may call on and deliberately carries no
         dose, because the dose is decided at the head of the bed and recorded
         in step 2's Medication administered. An order set that pre-committed a
         dose would either be ignored or followed without looking. */
      {
        id: 'anaes-preop',
        label: 'Anesthesia pre-op & orders',
        status: 'todo',
        note: 'Assessment and the standing order set — every medication, no specific dosing',
      },
    ],
  },

  /*
   * POST-ANAESTHESIA SITS WITH THE OTHER CRNA STEP, NOT AFTER THE SCOPE.
   *
   * By the clock it is written last of the three — the assessment is made in
   * recovery, once the patient is back. By the RAIL it belongs here, directly
   * under the pre-anaesthesia step, because the rail is read by a person
   * looking for their own work: the anaesthesia professional signs in three
   * places on this run and all three are now one press apart, rather than two
   * at the top of the ladder and the third stranded below somebody else's
   * step.
   *
   * That is a deliberate break from strict chronology, and it is the only one
   * in the run. Everything else on the ladder is in the order it happens; this
   * row is in the order it is WORKED, by the one role whose documents are not
   * contiguous in time. The document itself still says what it always said —
   * that the patient came back to themselves and that a person was told — and
   * nothing about being drawn above Procedure lets it be filed any earlier.
   */
  {
    id: 'post-anaesthesia',
    label: 'Post-anaesthesia',
    role: 'CRNA',
    status: 'todo',
    substeps: [],
  },

  {
    id: 'procedure',
    label: 'Procedure',
    role: 'MD',
    status: 'todo',
    substeps: [
      { id: 'patient-consent', label: 'Patient consent', status: 'todo' },
      { id: 'pre-op', label: 'Pre-op', status: 'todo' },
      /* The physician's order sheet, and it is a FORM rather than the table it
         used to be — the practice's standing pre-procedure lines printed, the
         medications the case may reach for printed under them, and one
         signature over both. It mirrors the anaesthesia order set two steps up
         card for card, because the two are the same act by two people and were
         never two different shapes of paperwork. See 'orders' in
         js/lib/encounter-docs.js. */
      {
        id: 'orders',
        label: 'Orders',
        status: 'todo',
        note: 'The standing pre-procedure set and the medications it may call on — no specific dosing',
      },
      { id: 'procedure-report', label: 'Procedure', status: 'todo' },

      /*
       * DISCHARGE ENDS THE STEP, AND IT IS THE HANDOUT.
       *
       * It briefly had company here — a rendered instruction sheet, and then
       * the desk's check-out — and neither belonged on the endoscopist's step
       * as a row of its own. Check-out is the step below. The sheet is this
       * row: the page the patient leaves holding, gone through with them in
       * recovery, with the set chosen at the top of it.
       *
       * What is NOT here any more is the paper record around it — the criteria,
       * where the patient is going, who is taking them, and a nurse's signature
       * under all of it. Every one of those questions is asked at the counter,
       * once, on the desk's own two cards. Two documents asking the same five
       * things is two answers to them.
       */
      { id: 'discharge', label: 'Discharge', status: 'todo' },
    ],
  },

  /*
   * The desk's step, and the only one in the run no clinician signs — which is
   * why it carries a role none of the others do.
   *
   * It sits at the foot of the clinical rows because it is the LAST thing that
   * happens while the patient is still in the building: the room finishes with
   * them, and then they walk to the counter. Everything above this row is
   * clinical work on the case; everything below it lands days later. So the
   * rail breaks where the day does, and the desk's row is the foot of the
   * in-building work rather than an interruption in the middle of it.
   *
   * One document, so no substeps: the rail opens straight into it. Two cards —
   * the discharge criteria, confirmed with the patient in front of you, and
   * where they went — and completing them is what sets the appointment to
   * Check Out while leaving the ENCOUNTER open for pathology. They are the only
   * place on the run those questions are asked; the step above is the sheet,
   * not a second record.
   */
  {
    id: 'checkout',
    label: 'Patient check-out',
    role: 'Front desk',
    status: 'todo',
    substeps: [],
  },

  /* Everything that lands after the patient has gone home, which is why it is
     one step rather than three: the same person works all three, days apart,
     from whatever came back in the post. */
  {
    id: 'post-procedure',
    label: 'Post-procedure',
    role: 'MD',
    status: 'todo',
    substeps: [
      { id: 'complications', label: 'Complications', status: 'todo' },
      { id: 'pathology', label: 'Pathology', status: 'todo' },
      /* Titled "Note" and keyed `letters` — see the spec in
         js/lib/encounter-logs.js for why the key does not follow the label. */
      { id: 'letters', label: 'Note', status: 'todo' },
    ],
  },
];

/**
 * THE PROCEDURE CONSENT — QUOTED FROM CHECK-IN, NOT WRITTEN AGAIN.
 *
 * data/procedure-encounter.js carries the ANAESTHESIA consent and nothing for
 * the procedure itself. Step 4 needs one, and for a while this file authored
 * it: four paragraphs of its own, written to sit beside the anaesthesia
 * wording, with a risk list of its own underneath.
 *
 * That was a second procedure consent. The patient has already signed one —
 * at the desk, on the way in, in data/checkin.js, versioned and filed — and
 * the document the physician meets at the bay is meant to BE that one, filled
 * in and signed, rather than a differently-worded restatement of it that the
 * physician then countersigns. Two texts is two consents: the patient agreed
 * to the paragraphs the desk showed them, and the only paragraphs anybody may
 * countersign are those.
 *
 * So the wording is read off the check-in document, version and all, and this
 * module holds only what the RUN adds to it: the record of when and how the
 * mark under it was taken. The risk list that used to live here went with the
 * paragraphs it belonged to — the check-in text names its own risks in its
 * own second paragraph, which is the one the patient read.
 *
 * Prototype boilerplate either way: a real deployment replaces the check-in
 * documents with the practice's approved wording, and this follows it there
 * without being edited.
 */
const CHECKIN_PROCEDURE_CONSENT = CONSENT_DOCUMENTS.find((doc) => doc.id === 'procedure');

export const PROCEDURE_CONSENT = {
  title: CHECKIN_PROCEDURE_CONSENT.title,
  /* The version the patient signed. It is shown at the bay because a consent
     quoted without its version is a quotation nobody can check: the practice
     revises this wording, and "v2.0" is how a reader six months later knows
     which paragraphs the mark below actually covered. */
  version: CHECKIN_PROCEDURE_CONSENT.version,
  paragraphs: CHECKIN_PROCEDURE_CONSENT.paragraphs,
};

/**
 * THE MARK THE DESK TOOK, AS THE BAY QUOTES IT BACK.
 *
 * The patient does not sign at the bay. They signed at check-in, before
 * sedation was anywhere near them, which is the point of taking a consent at
 * the desk at all — and a second pad in front of a pre-medicated patient on a
 * trolley would collect a mark worth less than the one already filed.
 *
 * So step 4 shows the filed signature rather than offering a pad: who signed,
 * when, and where it was taken. The only signature the bay TAKES is the
 * clinician's, attesting that the conversation happened and that this is the
 * consent it happened under.
 *
 * `minutesBeforeSlot` is how long before the booked start the desk took it —
 * prototype fixture, the same kind of authored fact as every status in this
 * file. The name on the mark and the day it was made are not authored here:
 * they come off the booking that is actually open, because a consent filed
 * against the wrong patient is the one failure a consent screen must not have.
 * See FILED_MARKS in js/screens/encounter.js.
 */
export const PROCEDURE_CONSENT_CAPTURE = {
  minutesBeforeSlot: 45,
  /* Drawn on the desk's pad — which is why the block at the bay shows the name
     and the time rather than an image. The bitmap lives with the check-in
     record; the prototype has no store to carry it across screens, and
     inventing a squiggle to stand in for the patient's would be worse than
     naming what was taken. */
  method: 'draw',
  where: 'Taken at the front desk during check-in',
};

/** The step the rail opens on: the authored `current`, or the first step. */
export const initialStepId = () =>
  (ENCOUNTER_STEPS.find((step) => step.status === 'current') ?? ENCOUNTER_STEPS[0]).id;

/** A step by id, for the handful of places that hold one as a string. */
export const stepById = (id) => ENCOUNTER_STEPS.find((step) => step.id === id);
