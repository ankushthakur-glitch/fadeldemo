/**
 * THE ENCOUNTER'S DOCUMENTS, AS A SPEC.
 *
 * The other half of the encounter. js/lib/encounter-logs.js declares everything
 * that is a TABLE — a run of entries, each stamped with a time — and this
 * declares everything that is a FORM: a consent, an assessment, a discharge
 * summary. One is appended to; the other is filled in once and signed.
 *
 * They are different shapes and get different renderers, which is the whole
 * reason for two files. A consent form rendered as a log would be a
 * single-row table, and a vitals trend rendered as a form would be a hundred
 * fields nobody could read down.
 *
 * A DOCUMENT MAY SHOW A LOG INSIDE IT — a section that names one gets its
 * table and its own Add button, drawn by the same code that draws it anywhere
 * else. The anaesthesia order set used to be the one that did; it is now the
 * practice's standing set, printed rather than assembled a row at a time (see
 * 'anaes-preop'), and no document declares a log at present. The mechanism
 * stays because the next table-shaped section will want it.
 *
 * NOTHING HERE DECLARES A BUTTON, AND THAT IS THE RULE RATHER THAN AN OMISSION.
 * Every document used to carry a `commit` — the label on a primary button at
 * the foot: "Sign consent", "Sign assessment", "File record". The button asked
 * for the act the page had just been worked through in order to perform. On
 * the documents that end in a pad it asked for a signature under signatures
 * that were already down; on the one that does not — check-out, which no
 * clinician signs — it was a receipt for a form whose own answers were the
 * receipt. A document here is complete when the things it asks for
 * have been answered and signed, and the foot says so in a sentence. What used
 * to hang off the press — check-out setting the appointment to Check Out —
 * happens at that moment instead, once, on completion. See paintDocFoot and
 * DOC_COMPLETION_EFFECTS in js/screens/encounter.js.
 *
 * WHAT A SPEC SAYS
 *   title              what the document is
 *   sections           the cards it is worked through in, each one of:
 *     prose            paragraphs to be read — a consent's own words
 *     fields           the same controls the logs use, plus textarea —
 *                      a time field marked `now: true` gets a Now button
 *                      beside it that stamps the clock onto it, and a field of
 *                      type `suggest` gets a box that is typed into over the
 *                      list its `options` names rather than closed to it
 *     checks           a list of statements to be ticked. One marked
 *                      `required: true` counts as outstanding until it is,
 *                      exactly as a required field does, and `short` is the
 *                      name the footer calls it by where the label is a
 *                      whole sentence and would swamp the line
 *                      a field of type `lines` is not a control at all: it
 *                      carries no key and collects nothing, and prints a run
 *                      of standing order lines where the document reaches them
 *     picker           on a section that has `checks`: collect them through one
 *                      type-or-pick box and a written-out list of what was
 *                      picked, rather than as a grid of boxes — for a list read
 *                      as "what was done" rather than worked down statement by
 *                      statement. A code the list does not carry is typed into
 *                      the same box, and `typedNote` is what the box says while
 *                      that is what is happening. The answer is the same answer
 *                      either way: the same ids, in the same `values.checks`.
 *                      Neither card carrying one takes a `note`: the
 *                      placeholder asks the question, and a line of guidance
 *                      above a box that is already asking it is a second
 *                      instruction to read before the first can be answered
 *     log              the id of a log in js/lib/encounter-logs.js, shown as
 *                      its table plus its own Add button — for a section whose
 *                      content is a run of entries rather than a set of
 *                      answers. Nothing declares one today
 *     signature        a <ui-signature> block, with whose signature it is —
 *                      `methods` narrows the routes the pad offers, and
 *                      `filed` names a signature taken ELSEWHERE that this
 *                      block only quotes: the mark arrives with the document,
 *                      there is no pad, and nothing here can sign or clear it.
 *                      The procedure consent's patient block is the one that
 *                      does — see 'patient-consent'
 *     note             a line of guidance under the section's title
 *     history          `true` on a section that shows the patient's own
 *                      clinical record — read-only, and rendered by the
 *                      screen, because the patient is known there not here
 *
 * WHERE THE CONTENT COMES FROM
 * The data modules, unchanged, wherever they already hold it — the consent
 * paragraphs, the airway rows, the discharge criteria and the H&P option lists
 * are all read from data/procedure-encounter.js and data/procedure-intra.js
 * rather than retyped. Two copies of a consent form is two consent forms.
 */
import {
  ANAESTHESIA_CONSENT,
  ANAESTHESIA_INDICATION,
  PROCEDURE_INDICATIONS,
  ANAESTHESIA_NOTE_CHECKS,
  ANAESTHESIA_CHECKS,
  AIRWAY_FIELDS,
  AIRWAY_OTHER,
  PRE_ANAESTHESIA_PLAN,
  DISCHARGE_CRITERIA,
  DISCHARGE_DESTINATIONS,
  DISCHARGE_MODES,
  TRANSPORT_METHODS,
  DISCHARGE_WITH,
  DISCHARGE_STATUSES,
  DISCHARGE_DEFAULTS,
  POST_ANAESTHESIA_ASSESSMENT,
  ANAESTHESIA_COMPLICATIONS,
  ANAESTHESIA_COMPLICATION_OPTIONS,
} from '../../data/procedure-encounter.js';
import {
  HP_GENERAL_OPTIONS,
  HP_LUNG_OPTIONS,
  HP_CV_OPTIONS,
  HP_NEURO_OPTIONS,
  HP_AIRWAY_OPTIONS,
  ASA_CLASSIFICATIONS,
  HP_DEFAULTS,
  HP_ASSESSMENT_STATEMENT,
  SEDATION_TYPES,
  SEDATION_ORDER_MEDICATIONS,
  PRE_PROCEDURE_ORDER_LINES,
  EGD_MODIFIERS,
  EGD_BLOOD_LOSS_OPTIONS,
  EGD_DEFAULT_COMPLICATIONS,
  EGD_RECOMMENDATIONS,
} from '../../data/procedure-intra.js';
/* The endoscopist's report is the one document in the run that had no
   declaration at all — the Procedure step showed "Not built yet". Its
   vocabulary already existed for the colonoscopy report on the clinic-visit
   screen, so it is read from there rather than invented a second time: two
   lists of procedures performed would be two definitions of what was done. */
import {
  COLONOSCOPY_PROCEDURES_PERFORMED,
  COLONOSCOPY_PROCEDURE_DETAILS,
  COLONOSCOPY_BOWEL_PREP_TYPES,
  COLONOSCOPY_BOWEL_PREP_QUALITY,
  COLONOSCOPY_REPEAT_YEARS,
} from '../../data/procedure-report.js';
import { PROCEDURE_CONSENT } from '../../data/procedure-encounter-run.js';

/*
 * THE ANAESTHESIA PROFESSIONAL'S SIGNATURE — ONE DECLARATION, THREE PLACES.
 *
 * The run asks this one person for exactly three signatures and no more:
 *
 *   the anaesthesia consent      what the patient agreed to
 *   pre-op & orders              the plan, and the drugs it may reach for
 *   the post-anaesthesia record  that the patient came back, and who was told
 *
 * There used to be a fourth, because the standing order set was its own
 * document with its own pad under it — the same person attesting twice, four
 * inches apart, to two halves of one decision. The orders moved inside the
 * pre-op assessment (see 'anaes-preop' below) and the fourth signature went
 * with them.
 *
 * AND ALL THREE ARE A NAME AND A TIMESTAMP, NOT A DRAWN MARK.
 *
 * A patient signing a consent is making a mark: they are not logged in, the
 * mark is the only thing tying them to the words above it, and drawing or
 * photographing it is how that is done. A CRNA is the opposite case in every
 * respect. They are authenticated, the screen already knows their name, and
 * they sign six of these on a list — so a pad asking them to draw with a mouse
 * collects a squiggle that resembles nobody's handwriting and adds nothing the
 * session did not already say. `methods: 'type'` drops the picker and leaves
 * the one route that is honest here: the typed legal name, filed with the
 * moment it was typed. See paintSignatureBlock in js/lib/signature-block.js
 * for why that route deliberately files no image.
 *
 * Declared once and spread into each of the three, so "how does anaesthesia
 * sign here" has one answer rather than three that can drift.
 */
const ANAESTHESIA_SIGNATURE = {
  heading: 'Anesthesia provider signature',
  who: 'provider',
  signer: ANAESTHESIA_CONSENT.provider.name,
  methods: 'type',
};

/*
 * AND THE SAME ANSWER FOR THE MD, ON ALL FOUR DOCUMENTS THEY SIGN.
 *
 * The physician signs four times on step 4 — the consent they took, the H&P
 * they wrote, the orders they set, the report they dictated — and all of them
 * were the full three-route pad, which is the control the PATIENT needs and
 * not the one the endoscopist does. Every word of the argument above transfers
 * unchanged: they are authenticated, the screen already knows their name, and
 * they do this four times a case on a list of twelve. A signature drawn with a
 * mouse at that rate is not a mark, it is a picture of one, and it files as an
 * image no later reader can tie to a person any better than the session
 * already does.
 *
 * So the physician types the name, and what is filed is the name and the
 * moment it was typed. See paintSignatureBlock in js/lib/signature-block.js
 * for why that route deliberately files no image at all.
 *
 * A FUNCTION RATHER THAN AN OBJECT TO SPREAD, because the only thing that
 * differs across the four is the words over the pad: the consent is taken by
 * the clinician, the H&P is written and the orders are set by the physician,
 * the report is signed by the endoscopist. Three names for the work — the H&P
 * and the order sheet share one, because they are the same person doing the
 * same kind of thing twenty minutes apart — one person, one way of signing.
 *
 * Nothing here names a `signer` — who it is on the day is whoever is signed
 * in, which is what signerFor in js/screens/encounter.js reads, and Type Name
 * opens holding that name so the fast route stays one press and an Enter.
 *
 * WHAT IS DELIBERATELY NOT NARROWED: the patient's own pad on the two consents
 * — they are not logged in, and their mark is the only thing tying them to the
 * paragraphs above it. Everyone else on the run types, the desk's discharging
 * signature included: the same argument holds for anybody the screen has
 * already authenticated, whether or not they are a clinician.
 */
const typedClinicianSignature = (heading) => ({
  heading,
  who: 'provider',
  methods: 'type',
});

/* The airway rows arrive as {id, label, options, value}; the form wants them
   as fields. Mapped rather than retyped, so the note and this document
   cannot end up asking different questions about the same airway. */
const airwaySelects = AIRWAY_FIELDS.map((row) => ({
  key: row.id,
  type: 'select',
  label: row.label,
  options: row.options,
  value: row.value,
}));

/*
 * WHERE "OTHER" IS FINISHED.
 *
 * Lungs and CV are the two rows that can be answered Other, and Other on its
 * own is a finding withheld. Each carries the text field that says what was
 * actually heard or found (`other` in data/procedure-encounter.js), shown only
 * once its row is answered that way and required from the moment it appears —
 * an assessment that files with an unexplained Other on the chest is the
 * assessment nobody can read back.
 *
 * They sit AFTER the six selects rather than each under its own row: the
 * section is laid out two to a row and the pairing is how the note is read
 * back, so a full-width field spliced in between Lungs and CV would put the
 * heart on a line of its own the moment a chest was abnormal.
 */
const airwayOtherFields = AIRWAY_FIELDS.filter((row) => row.other).map((row) => ({
  key: row.other.id,
  type: 'text',
  label: row.other.label,
  placeholder: row.other.placeholder,
  required: true,
  span: 2,
  showWhen: { key: row.id, is: AIRWAY_OTHER },
}));

const airwayFields = [...airwaySelects, ...airwayOtherFields];

export const ENCOUNTER_DOCS = {
  /* ========================================================================
     STEP 3 — PRE-ANAESTHESIA ASSESSMENT (CRNA)
     ===================================================================== */

  /*
   * WHY THIS CONSENT NO LONGER OPENS WITH A FORM.
   *
   * It used to lead with "What is being consented to" — a type, a procedure
   * and an indication, filled in above the paragraphs. Every one of those was
   * already answered: the procedure and the indication come from the booking
   * and are carried by the run itself — the band above the work column and the
   * patient card in the rail — and the anaesthesia type came off the run
   * entirely (see 'anaes-preop'). What
   * the section actually did was ask a clinician to retype three facts the
   * record already held, in front of a patient waiting to sign.
   *
   * So the consent starts where a consent starts: with what it says.
   *
   * AND IT ENDS WHERE ONE ENDS: on the pads. Nothing follows them — the foot
   * of a consent has nothing left to offer once both marks are down, and the
   * button that used to sit there said "Sign consent" under two signatures
   * that had already been given. See the note at the head of this file.
   */
  'anaes-consent': {
    title: 'Anesthesia consent',
    sections: [
      {
        id: 'form',
        title: ANAESTHESIA_CONSENT.title,
        /* The cut without the planned-type clause — nothing on this run
           records a type, and a consent that printed "[type]" where the
           technique should be would be worse than one that does not name it. */
        prose: ANAESTHESIA_CONSENT.paragraphsWithoutType,
      },
      /*
       * The section heading names WHO SIGNS, and is the only heading on the
       * block. The data modules carry title-case labels — "Patient Signature",
       * "Anesthesia Provider Electronic Signature" — which are the words the
       * paper form uses; here they sat above a pad that headed itself
       * "Signature", so every signature on the screen had two titles. One
       * heading, in the sentence case the rest of the screen uses, saying whose
       * mark this is. "Electronic" is dropped: nothing here is signed any other
       * way, so the word distinguished nothing.
       */
      {
        id: 'patient-sign',
        title: 'Patient signature',
        note: ANAESTHESIA_CONSENT.patientNote,
        signature: { heading: 'Patient signature', who: 'patient' },
      },
      /*
       * THE PATIENT MAKES A MARK; THE PROVIDER TYPES A NAME.
       *
       * The two pads on this document are deliberately not the same control,
       * and the pair is the clearest place in the run to see why. The patient
       * is not logged in: their mark is the only thing tying them to the
       * paragraphs above it, so their pad keeps all three routes — draw it,
       * photograph the signed sheet, or type the name. The anaesthesia
       * professional is already authenticated and the screen knows who they
       * are, so theirs is a name and a timestamp.
       *
       * Both were the full three-route pad for a while, on a consistency
       * argument that turned out to be about the control rather than about the
       * signature: a CRNA drawing their name with a mouse for the sixth time
       * on a list is not making a mark, they are producing a picture of one.
       * See ANAESTHESIA_SIGNATURE at the head of this file.
       */
      {
        id: 'provider-sign',
        title: 'Anesthesia provider signature',
        note: ANAESTHESIA_CONSENT.providerNote,
        signature: ANAESTHESIA_SIGNATURE,
      },
    ],
  },

  /*
   * THE PRE-ANAESTHESIA ASSESSMENT, AND THE ORDER SET THAT FOLLOWS FROM IT.
   *
   * Two clinical cards, then the orders, then one signature over all three —
   * the whole of what the anaesthesia professional writes before induction, on
   * one page, ending in one attestation.
   *
   * The two clinical cards were five for a while: a document that asked one
   * question per card — a chart review that was a single tick, a plan that
   * restated the booking, an airway assessment, a STOP-BANG panel, and an
   * assessment. Five cards, and the two that carried the clinical content were
   * third and fifth.
   *
   * WHAT MOVED, AND WHY
   *   Chart review     was never a section. It is one statement — the record
   *                    was read and brought up to date — and it belongs at the
   *                    top of the note it qualifies, not in a card of its own
   *                    that reads as work with a heading over it.
   *   Plan             is the ANAESTHESIA PROCEDURE NOTE. That is what a CRNA
   *                    calls the thing they write, and "Plan" named a section
   *                    of it rather than the document.
   *   Anesthesia type  is gone. It was asked here and again on the consent,
   *                    which is two answers to one question, and neither is
   *                    binding — the technique is decided at the head of the
   *                    bed and what was actually given is recorded on the
   *                    post-anaesthesia record in step 5.
   *   Airway           IS the pre-anaesthesia assessment, so it is named that.
   *                    The airway rows and the assessment statements that used
   *                    to sit two cards below them are one section now: the
   *                    findings and the judgement made from them, read
   *                    together, which is how the note is read back.
   *   STOP-BANG        is off the note. Sleep-apnoea risk is screened on the
   *                    pre-procedure checklist in step 1, before the patient is
   *                    anywhere near this document — running it twice produced
   *                    two scores for one patient and no rule about which won.
   */
  'anaes-preop': {
    title: 'Anesthesia pre-op & orders',
    sections: [
      {
        id: 'plan',
        title: 'Anesthesia procedure note',
        /* The chart-review statement, at the head of the note it qualifies.
           Everything below is only worth having if the record it was written
           from was read first. */
        checks: ANAESTHESIA_NOTE_CHECKS.map((c) => ({ id: c.id, label: c.label })),
        fields: [
          { key: 'procedure', type: 'text', label: 'Procedure', value: PRE_ANAESTHESIA_PLAN.procedure },
          /* The same indication the physician's H&P carries, off the same
             booking rather than out of a second authored string — see the
             field's own note on 'pre-op' below. Two documents on one case
             naming two different reasons for it is the drift `fromCase`
             exists to close. Editable here too, and over the same list: the
             CRNA who is told something new at the bay writes it down where
             they are, and picking the line the physician would have picked is
             how the two documents keep saying it in one set of words. */
          {
            key: 'indication',
            type: 'suggest',
            label: 'Indication',
            options: PROCEDURE_INDICATIONS,
            fromCase: 'indication',
            value: ANAESTHESIA_INDICATION,
            placeholder: 'Pick the indication, or type this patient’s own',
            hint: 'Carried from check-in — pick another from the list, or type over it, if the indication has changed.',
            span: 2,
          },
        ],
      },
      {
        id: 'airway',
        title: 'Pre-anesthesia assessment',
        note: 'Paired as the note reads them back — ASA beside Mallampati, dentition beside neck movement, lungs beside heart. The statements below are the judgement made from them.',
        fields: [...airwayFields, { key: 'notes', type: 'textarea', label: 'Assessment notes', span: 2 }],
        checks: ANAESTHESIA_CHECKS.map((c) => ({ id: c.id, label: c.label })),
        /* The statements are read OFF the findings, so they follow them. */
        checksAfter: true,
        /*
         * SET DEFAULT / USE DEFAULT, ON THIS CARD AND NOT ON THE NOTE ABOVE.
         *
         * Nine assessments in ten on a screening list read the same: ASA II,
         * Mallampati I or II, dentition intact, neck free, chest and heart
         * clear. Retyping six selects for each of them is how the tenth — the
         * one with the short neck and the loose crown — gets clicked through
         * at the same speed as the nine.
         *
         * It sits on the ASSESSMENT rather than over the whole document,
         * because the two are not the same kind of thing. The findings repeat;
         * the chart-review statement on the note above does not, and a default
         * that ticked "record reviewed in EMR" would be the prototype making a
         * claim on a clinician's behalf about a chart nobody opened.
         *
         * Both presses are the session's own, not the practice's — see the
         * note over sectionDefaults in js/screens/encounter.js for why that
         * makes the pair safe without a confirmation step.
         */
        defaults: true,
      },
      /*
       * THE ORDER SET, ON THE DOCUMENT THAT DECIDES IT.
       *
       * It was a substep of its own — its own row in the rail, its own page,
       * its own signature at the foot. Nothing about the day works that way.
       * The anaesthesia professional reads the airway, forms a plan, and names
       * the drugs that plan may reach for, in one sitting in front of one
       * patient; splitting the last of those three onto a separate page made
       * the same person sign twice for one decision, and put the drugs a
       * corridor away from the assessment they follow from.
       *
       * So the orders are CARDS on this document, after the assessment they
       * are chosen against and before the signature that covers all of them.
       *
       * AND THEY ARE THE PRACTICE'S ORDER SET, NOT A TABLE TO BUILD.
       *
       * This was a log: an empty table, an Add order button, and a drawer
       * asking for a medication, a dose and a route. Everything about that was
       * a re-typing. The pre-procedure instructions are the same on every case
       * in the room — NPO, the prep, the line in — and the medications the
       * sedation plan may reach for are the practice's standing list
       * (PRE_PROCEDURE_ORDER_LINES and SEDATION_ORDER_MEDICATIONS in
       * data/procedure-intra.js). Asking a CRNA to assemble that list a row at
       * a time, twelve times a list, produces twelve slightly different order
       * sets and one signature over each of them.
       *
       * So the standing lines are PRINTED, and what is actually decided here is
       * decided here: which technique this patient is having, and anything
       * ordered on top of the set. Both are fields; everything else is the
       * protocol, and a protocol somebody can edit on one document is not one.
       *
       * TWO CARDS, AND NOTHING ABOUT RECOVERY. What is ordered for after the
       * case — the line out, the vitals, the Aldrete, the diet, the sheet —
       * is not decided at this sitting and is not this signature's to cover.
       * It belongs to the post-anaesthesia record and the discharge, which are
       * the documents the people doing it actually work from; printed here it
       * was a card nobody at the bay acts on, between the drugs and the pad.
       */
      {
        id: 'orders-pre',
        title: 'Pre-procedure orders',
        fields: [{ type: 'lines', id: 'orders-pre', lines: PRE_PROCEDURE_ORDER_LINES }],
      },
      {
        id: 'orders-sedation',
        title: 'Sedation orders',
        note: 'The standing order set names every medication the plan may call on and no specific dosing. The dose is decided at the head of the bed and recorded against step 2’s Medication administered.',
        fields: [
          /*
           * THE TECHNIQUE, ANSWERED BY THE PERSON GIVING IT.
           *
           * The physician's H&P asks for a planned sedation two steps down, and
           * until now that was the only place on the run that recorded one —
           * which put the answer on the document of the person who does not
           * administer it. It is asked HERE first, on the order set it governs,
           * and the H&P's field seeds from this one (see `seedFrom` on 'pre-op'
           * below) so the two cannot end up naming different techniques for one
           * patient.
           */
          {
            key: 'sedation',
            type: 'select',
            label: 'Sedation type',
            options: SEDATION_TYPES,
            value: SEDATION_TYPES[0],
            required: true,
            span: 2,
          },
          { type: 'lines', id: 'orders-medications', label: 'Medications', lines: SEDATION_ORDER_MEDICATIONS },
          /*
           * WHERE THIS PATIENT DIFFERS FROM THE SET.
           *
           * Free text and not a second table: what goes in it is an instruction
           * to the person at the head of the bed — hold the midazolam, the
           * patient is on a soy precaution, glycopyrrolate available — and the
           * table that used to sit here could not carry any of those. Empty on
           * most cases, which is the honest answer on most cases.
           */
          {
            key: 'additionalOrders',
            type: 'textarea',
            label: 'Additional medication orders',
            placeholder: 'Anything ordered on top of the standing set…',
            span: 2,
          },
        ],
      },
      /*
       * ONE SIGNATURE, OVER THE ASSESSMENT AND THE ORDERS BOTH.
       *
       * Which is the reason the two are on one page rather than a convenience
       * that followed from it. The section says so in its own words, because a
       * pad at the foot of a long document is read as covering whatever is
       * directly above it — and here it covers the card above that as well.
       *
       * A name and a timestamp, not a drawn mark; see ANAESTHESIA_SIGNATURE at
       * the head of this file.
       */
      {
        id: 'sign',
        title: 'Anesthesia provider signature',
        note: 'One signature covers the assessment and the order set above it.',
        signature: ANAESTHESIA_SIGNATURE,
      },
    ],
  },

  /* ========================================================================
     STEP 4 — PROCEDURE (MD)
     ===================================================================== */

  /*
   * THE CONSENT FORM AS THE BAY MEETS IT: ALREADY SIGNED, AWAITING ONE MARK.
   *
   * THE PATIENT DOES NOT SIGN HERE. They signed at the front desk on the way
   * in — the same document, versioned, in data/checkin.js — before any
   * pre-medication and while they were standing up, which is the reason a
   * consent is taken at check-in rather than at the trolley. This document is
   * that one filled in: the paragraphs they agreed to, quoted rather than
   * rewritten, with their mark shown under them as filed.
   *
   * A pad here would have been a second signature on one consent, taken from a
   * patient in a gown who has already been cannulated, and worth less than the
   * first for exactly that reason. Worse, it could disagree with it — two
   * marks, two times, and nothing saying which one the procedure proceeded
   * under. So the patient block quotes and cannot be signed on; see `filed`
   * on it below.
   *
   * The one signature this screen TAKES is the clinician's. That is what the
   * bay adds to the record: not the patient's agreement, which is already
   * filed, but the attestation by the person about to hold the scope that the
   * conversation happened, that they have read back what was signed, and that
   * this is the consent they are proceeding under.
   *
   * It used to open with "What is being consented to" — the procedure, the
   * endoscopist and the indication, as three required text boxes — and to
   * carry a "Risks discussed" card of tick-boxes between the prose and the
   * pads. Both are gone, and the document is now the same three things the
   * anaesthesia consent next door is: what it says, who agreed, who took it.
   *
   * WHAT IS BEING CONSENTED TO was three facts the record already held, put
   * in front of a clinician to retype while a patient waited to sign. The
   * procedure and the indication come off the booking and are carried by the
   * run — the band above the work column, the patient card in the rail; the
   * endoscopist is the clinician whose signature closes the document. Three
   * required fields that could only ever restate the screen they were on, and
   * could disagree with it.
   *
   * RISKS DISCUSSED was a checklist of six statements beside a consent that
   * did not name a single risk in its own words. What it recorded was not
   * whether the conversation happened but whether somebody ticked six boxes
   * about it — and the instrument for "this was explained and understood" is
   * the signature underneath, which is what a consent form IS. So the risks
   * moved INTO the document (see PROCEDURE_RISKS in
   * data/procedure-encounter-run.js), where the patient reads them and the
   * mark at the foot covers them, exactly as the anaesthesia consent next
   * door names its own.
   *
   * The document is outstanding until it is signed, which the renderer takes
   * from the presence of a signature block rather than from a flag: an
   * unsigned consent is not a partly complete document, it is not a consent.
   * The patient's block arrives already holding its mark and so is never what
   * the foot is waiting on — the clinician's is. See paintDocFoot.
   *
   * Which is also why nothing follows them. The pad IS the signing; a "Sign
   * consent" button beneath it was a second press for an act already complete,
   * and the foot's own sentence — complete and signed — is the receipt.
   */
  'patient-consent': {
    title: 'Patient consent',
    sections: [
      {
        id: 'form',
        title: PROCEDURE_CONSENT.title,
        /* The version under the title, because the paragraphs below are a
           QUOTATION — of the document the desk showed the patient — and a
           quotation whose edition is not named cannot be checked against the
           mark that covers it. */
        note: `Signed by the patient at check-in · ${PROCEDURE_CONSENT.version} · shown as filed`,
        prose: PROCEDURE_CONSENT.paragraphs,
      },
      {
        id: 'patient-sign',
        title: 'Patient signature',
        note: 'Taken at the desk before sedation — the patient does not sign again at the bay.',
        /*
         * QUOTED, NOT TAKEN. `filed` names the record this block reads its
         * mark out of, and the presence of it is what turns the pad into a
         * receipt: no canvas, no Sign again, nothing on this screen that could
         * write over what the desk filed. See FILED_MARKS in
         * js/screens/encounter.js for where the name and the time come from.
         */
        signature: { heading: 'Patient signature', who: 'patient', filed: 'checkin-consent' },
      },
      /*
       * "Clinician", not "Physician".
       *
       * The person who takes this consent is whoever had the conversation and
       * is credentialled to have had it — which on a list is the endoscopist,
       * and is not always someone the word physician covers. The document
       * asks for the clinician taking the consent; who that is on the day is
       * said by the name under the mark.
       *
       * AND THE MARK IS A NAME AND A TIMESTAMP, which is what makes this pad
       * and the patient's two lines above it different controls on one
       * document. The pairing is the same one the anaesthesia consent next
       * door draws, for the same reason: the patient is not logged in and
       * their drawn mark is the evidence, while the clinician is, and the
       * session already says who they are better than a mouse can. See
       * typedClinicianSignature at the head of this file.
       */
      {
        id: 'clinician-sign',
        title: 'Clinician signature',
        note: 'Signed by the clinician who took this consent — the name is filed with the time it was signed.',
        signature: typedClinicianSignature('Clinician signature'),
      },
    ],
  },

  'pre-op': {
    title: 'Pre-op history and physical',
    sections: [
      /*
       * WHAT WAS FOUND, THEN WHAT IS MADE OF IT. TWO SECTIONS, NOT THREE.
       *
       * The exam card used to end on ASA classification, sitting in the grid
       * as though it were a sixth finding alongside General, Lungs and Airway.
       * It is not a finding — nothing about the patient is observed by reading
       * an ASA grade off them. It is the physician's SUMMARY of how sick this
       * patient is, made from every finding above it plus the history, and it
       * is the single number the sedation plan is chosen against. Filed with
       * the observations it belongs to neither the eye nor the record: a
       * clinician scanning the exam for what was found reads a judgement, and a
       * clinician looking for the judgement finds it three cards away from the
       * sentence that states it.
       *
       * So it moves down, and the two cards it moves into become one. Splitting
       * "Indication and plan" from "Assessment" put a card boundary through the
       * middle of one thought — the indication, the sedation chosen for it, the
       * history behind it and the sentence concluding all three — and the
       * second card was one textarea under a title, which is a heading spent on
       * nothing. Merged, the section reads in the order the judgement is
       * actually made: why the patient is here, how sick they are, how they
       * will be sedated, the history, the conclusion.
       *
       * ASA sits beside Planned sedation deliberately. They share a row because
       * they answer each other — the grade is the reason the sedation is what
       * it is, and an ASA IV next to Moderate Conscious Sedation is a pairing a
       * reader should not have to hold two cards apart to notice.
       */
      {
        id: 'exam',
        title: 'Physical examination',
        /*
         * SET DEFAULT / USE DEFAULT, OVER THE WHOLE CARD.
         *
         * The same pair the pre-anaesthesia assessment carries two steps up,
         * and here for the same reason: five selects, and on nine screening
         * lists in ten all five read the same — well developed, clear chest,
         * regular rate, alert, Mallampati I or II. Retyping them twelve times
         * a list is how the one patient with the short neck gets clicked
         * through at the speed of the eleven who did not have one.
         *
         * The whole card is covered because the whole card repeats: every
         * field on it is an observation whose normal is the same normal on
         * every patient, and none of it is a fact carried from this patient's
         * booking. The Assessment and plan below it is not like that — see
         * its own `defaults`.
         */
        defaults: true,
        fields: [
          { key: 'general', type: 'select', label: 'General', options: HP_GENERAL_OPTIONS, value: HP_DEFAULTS.general },
          { key: 'lung', type: 'select', label: 'Lungs', options: HP_LUNG_OPTIONS, value: HP_DEFAULTS.lung },
          { key: 'cv', type: 'select', label: 'Cardiovascular', options: HP_CV_OPTIONS, value: HP_DEFAULTS.cv },
          { key: 'neuro', type: 'select', label: 'Neurological', options: HP_NEURO_OPTIONS, value: HP_DEFAULTS.neuro },
          { key: 'airway', type: 'select', label: 'Airway assessment', options: HP_AIRWAY_OPTIONS, value: HP_DEFAULTS.airway },
        ],
      },
      {
        /* Still `indication` — the section kept its id through the merge, so a
           value already stored against it, and anything holding a reference to
           it, still lands on the card that now holds all of this. */
        id: 'indication',
        title: 'Assessment and plan',
        note: 'The default pair on this card covers ASA and planned sedation only — the indication, the history and the conclusion are this patient’s.',
        /*
         * A DEFAULT OVER TWO OF THE FIVE ANSWERS, NAMED ONE AT A TIME.
         *
         * ASA and the sedation chosen against it are the pair that repeats:
         * an ASA II on moderate conscious sedation is most of a screening
         * list, and those two are what a physician would want back with one
         * press. Nothing else on this card is a candidate.
         *
         *   Indication   came off THIS patient's booking (see `fromCase`
         *                below). A default that saved it would take one
         *                patient's reason for being here and press it onto
         *                the next twelve.
         *   History      is this patient's story and nothing else's.
         *   Assessment   is the sentence the H&P exists to make, and the case
         *                it has to survive is the patient who is NOT
         *                appropriate for the procedure. A saved copy of the
         *                standing sentence, reapplied over an edit that said
         *                so, is exactly the accident the field's own note
         *                below refuses.
         *
         * So `defaults` is a LIST rather than `true`: it names the keys the
         * pair covers and leaves everything else on the card alone. See
         * readSection in js/screens/encounter.js for how the list is read.
         */
        defaults: ['asa', 'sedation'],
        /*
         * AND THE SEDATION ARRIVES ALREADY ANSWERED.
         *
         * The anaesthesia professional named the technique on their own order
         * set two steps up, in front of the patient, before any of it was
         * drawn up. This card asks the same question of the physician, who is
         * writing the H&P the sedation is chosen against — so it opens holding
         * what was actually ordered rather than the standing default, and a
         * disagreement between the two documents becomes something somebody
         * typed on purpose instead of something nobody noticed.
         *
         * Seeded, not shared: the physician may still change it, and if they
         * do, the change is theirs and is signed as theirs. See the note over
         * `seedFrom` in js/screens/encounter.js.
         */
        seedFrom: { doc: 'anaes-preop', keys: ['sedation'] },
        fields: [
          /*
           * THE INDICATION IS CARRIED, NOT RETYPED.
           *
           * It used to seed from ANAESTHESIA_INDICATION — one authored string,
           * the same on every patient the prototype opened. The real answer
           * has existed since the booking was made: the reason for visit the
           * desk confirms at check-in, which is what this practice's schedule
           * calls the indication (see the vocabulary table at the head of
           * js/screens/schedule.js). `fromCase` reads it off the appointment
           * this encounter was opened for; the authored string stays as the
           * fallback for a screen opened with no booking behind it, so the
           * field is never blank on a demo run.
           *
           * STILL AN EDITABLE FIELD. What the booking holds is what somebody
           * wrote weeks ago at the desk, and the indication the H&P is signed
           * under is the one the physician is willing to put their name to
           * today — a surveillance interval that turned into a bleeding
           * workup between booking and bay is the ordinary case, not the
           * exception. So it arrives filled in and can be typed over, which is
           * the whole difference between carrying a fact and locking one.
           *
           * AND THE UNIT'S OWN LIST IS UNDER IT. It was a bare text box, which
           * said "type over me" and nothing else: a physician correcting the
           * indication at the bay re-worded it from scratch, and the field
           * that ends up on the report and in the coder's queue collected a
           * dozen spellings of the same three cases. `suggest` is the control
           * for a question that is USUALLY one of a handful and occasionally
           * is not one of them at all — the list drops under the box on the
           * first press, the typed answer is still an answer, and nothing is
           * enforced. See PROCEDURE_INDICATIONS in data/procedure-encounter.js
           * for the list, and the header of js/components/ui-suggest.js for
           * why the picker is ours rather than a native datalist.
           */
          {
            key: 'indication',
            type: 'suggest',
            label: 'Indication',
            options: PROCEDURE_INDICATIONS,
            fromCase: 'indication',
            value: ANAESTHESIA_INDICATION,
            placeholder: 'Pick the indication, or type this patient’s own',
            hint: 'Carried from check-in — pick another from the list, or type over it, if the indication has changed.',
            span: 2,
          },
          { key: 'asa', type: 'select', label: 'ASA classification', options: ASA_CLASSIFICATIONS, value: HP_DEFAULTS.asa },
          { key: 'sedation', type: 'select', label: 'Planned sedation', options: SEDATION_TYPES, value: SEDATION_TYPES[0] },
          { key: 'hpi', type: 'textarea', label: 'History of present illness', span: 2 },
          /* The statement the H&P exists to make, and so the last thing on the
             card. Editable, because a patient who is NOT appropriate for the
             procedure is exactly the case where the standing sentence must not
             be filed unread. */
          {
            key: 'assessment',
            type: 'textarea',
            label: 'Assessment and plan',
            value: HP_ASSESSMENT_STATEMENT,
            span: 2,
            required: true,
          },
        ],
      },
      /* A name and a timestamp, like the consent's and the report's — see
         typedClinicianSignature at the head of this file. */
      {
        id: 'sign',
        title: 'Physician signature',
        note: 'Signed by the physician who made this assessment — the name is filed with the time it was signed.',
        signature: typedClinicianSignature('Physician signature'),
      },
    ],
  },

  /*
   * THE ENDOSCOPIST'S ORDER SHEET, WHICH IS THE ANAESTHESIA ONE AGAIN.
   *
   * This was a LOG: an empty table, an Add order button, and a drawer asking
   * for an order line, a phase, an ordered time, a completed time, a status
   * and a note. Its own seed gave the game away — twelve rows, the twelve
   * standing lines, every one of them stamped 07:35 by the same physician,
   * because that is what the practice orders on every case in the room. A
   * table of that shape does not record a decision; it asks somebody to
   * re-type a protocol twelve times a list, and what it produces is twelve
   * slightly different order sheets with one signature over each.
   *
   * The anaesthesia professional's order set two steps up had exactly this
   * problem and has already been answered: the standing lines are PRINTED, and
   * the only things asked for are the ones actually decided in front of this
   * patient. So the endoscopist's sheet is that document, card for card,
   * rather than a second answer to one question. The argument in full is over
   * 'anaes-preop' above and is deliberately not repeated here — two copies of
   * it would drift the way the two order sets did.
   *
   * WHAT DIFFERS, AND IT IS ONLY THESE THREE THINGS:
   *
   *   Pre-procedure orders only  The anaesthesia set stops at the drugs and
   *                              says nothing about recovery, because what is
   *                              ordered for after the case is not decided at
   *                              that sitting and is not that signature's to
   *                              cover. The same holds here, so the
   *                              Post-procedure half of the old table went out
   *                              with the table: the line out, the vitals, the
   *                              Aldrete and the diet belong to the
   *                              post-anaesthesia record and the discharge,
   *                              which are the documents the people doing them
   *                              actually work from.
   *   Medication orders          The same card under the physician's name for
   *                              it. “Sedation orders” is the anaesthesia
   *                              professional's heading for their own set, and
   *                              a second card called that on the document of
   *                              the person who does not administer it reads
   *                              as a second sedation decision rather than the
   *                              one decision written where the physician
   *                              signs.
   *   Physician signature        Not the anaesthesia pad. This is the fourth
   *                              signature the endoscopist gives on step 4 and
   *                              it is given the same way the other three are
   *                              — see typedClinicianSignature at the head of
   *                              this file.
   */
  orders: {
    title: 'Procedure orders',
    sections: [
      {
        id: 'orders-pre',
        title: 'Pre-procedure orders',
        fields: [{ type: 'lines', id: 'orders-pre', lines: PRE_PROCEDURE_ORDER_LINES }],
      },
      {
        id: 'orders-medications',
        title: 'Medication orders',
        note: 'The standing order set names every medication the plan may call on and no specific dosing. The dose is decided at the head of the bed and recorded against step 2’s Medication administered.',
        /*
         * AND THE TECHNIQUE ARRIVES ALREADY ANSWERED, FOR THE THIRD TIME.
         *
         * It is decided on the anaesthesia order set, by the person giving it,
         * before any of this is drawn up. The H&P above seeds from there and
         * so does this card: a third blank copy of one question is a third
         * chance to answer it differently, and the run would then hold three
         * documents naming three techniques for one patient with no rule about
         * which won.
         *
         * Seeded rather than shared — the physician may still change it, and
         * if they do the change is theirs and is signed as theirs. See the
         * note over `seedFrom` in js/screens/encounter.js.
         */
        seedFrom: { doc: 'anaes-preop', keys: ['sedation'] },
        fields: [
          {
            key: 'sedation',
            type: 'select',
            label: 'Sedation type',
            options: SEDATION_TYPES,
            value: SEDATION_TYPES[0],
            required: true,
            span: 2,
          },
          { type: 'lines', id: 'orders-medications', label: 'Medications', lines: SEDATION_ORDER_MEDICATIONS },
          /* Where this patient differs from the set, and free text rather than
             a second table for the reason the anaesthesia card gives: what
             goes in it is an instruction to the person at the head of the bed,
             and no set of columns carries one. Empty on most cases, which is
             the honest answer on most cases. */
          {
            key: 'additionalOrders',
            type: 'textarea',
            label: 'Additional medication orders',
            placeholder: 'Anything ordered on top of the standing set…',
            span: 2,
          },
        ],
      },
      /*
       * ONE SIGNATURE, OVER BOTH CARDS — and it says so, because a pad at the
       * foot of a document is read as covering whatever sits directly above
       * it, and here it covers the card above that as well.
       */
      {
        id: 'sign',
        title: 'Physician signature',
        note: 'One signature covers the pre-procedure orders and the medication orders above them.',
        signature: typedClinicianSignature('Physician signature'),
      },
    ],
  },

  /* ========================================================================
     STEP 4 — THE ENDOSCOPIST'S REPORT

     WHY IT IS A SPEC AND NOT THE OTHER REPORT

     A full colonoscopy report already exists, on the clinic-visit screen: a
     narrative engine that turns structured findings into prose, a findings
     tree, a polyp drawer, photo attachments. None of that could be moved here
     without moving the engine with it, and a second copy of an engine is two
     engines that disagree about what a 6 mm sessile polyp reads like.

     What CAN move — and what the Procedure step actually owed the endoscopist,
     which until now showed "Not built yet" — is the charting the report is
     built on: what was performed, why, how, what was taken and what happens
     next. Every one of those is a closed list or a paragraph, which is exactly
     what this file's renderer is for, and every one of those lists is imported
     from the same data module the other report reads. So the two documents ask
     the same questions in the same words, and the narrative stays in the one
     place that owns it.
     ===================================================================== */

  'procedure-report': {
    title: 'Procedure report',
    sections: [
      /* The tick carries the code it is claimed under — see `code` on a check
         in docSectionMarkup (js/screens/encounter.js), and the two lists
         themselves in data/. The id is keyed off the CPT rather than off a
         slug of the words, because the code is the stable half: a practice
         that renames "Tattoo placement" to "Submucosal marking" has not
         changed which procedure was ticked, and an id read off the label would
         say it had. */
      /*
       * PICKED FROM A LIST THAT CAN BE ADDED TO, NOT TICKED OFF A CLOSED ONE.
       *
       * These two cards were a grid of sixteen checkboxes, and both things
       * wrong with that are the same thing: a coder reads them as a LIST OF
       * WHAT WAS DONE, and a grid of sixteen boxes is a list of what could
       * have been done with four of them ticked somewhere inside it. The four
       * that apply had to be found by eye every time the report was reread,
       * and the twelve that do not applied four hundred pixels of pressure to
       * the working column for nothing.
       *
       * `picker` says: collect this the way the answer is read. The dropdown
       * holds the practice's list and takes as many of it as apply; what has
       * been picked is written out underneath, in code order, which is the
       * line the coder actually wants. Nothing about the ANSWER changed — the
       * ids are the same ids and they still live in `values.checks`, so a
       * required tick, a saved default and the foot's outstanding count all go
       * on reading the same store they always did. See pickerMarkup and
       * mountPicker in js/screens/encounter.js.
       *
       * AND THE CODE THAT IS NOT ON THE LIST IS STILL WHAT WAS DONE. That is
       * the second half of `picker` and the reason the checkbox grid could not
       * simply be made prettier: a closed list of eleven procedures is right
       * until the twelfth is performed, and an endoscopist who cannot record
       * it here records it in the indication paragraph, where no claim can
       * reach it.
       *
       * IN THE SAME BOX, THOUGH. It used to be a second, separate control — a
       * code box, a words box and an Add button under the dropdown — which
       * asked the one question this card exists to ask twice, in two places,
       * with two different gestures. There is one box now: the list drops out
       * of it, typing narrows the list, and typing past the list is the
       * answer. `typedNote` is what the panel says at that moment, so nobody
       * has to wonder whether a code the practice does not ship was taken.
       * Nothing is submitted, because nothing is being added TO anything: a
       * typed code goes onto this report and no further. See pickerMarkup and
       * mountPicker in js/screens/encounter.js.
       */
      {
        id: 'performed',
        title: 'Procedures performed',
        picker: {
          placeholder: 'Pick a procedure, or type a CPT or HCPCS code',
          typedNote: 'Not on the practice’s list — it goes on this report exactly as typed.',
        },
        checks: COLONOSCOPY_PROCEDURES_PERFORMED.map(({ code, label }) => ({
          id: `performed-${code.toLowerCase()}`,
          code,
          label,
        })),
      },
      {
        id: 'modifiers',
        title: 'Modifiers',
        picker: {
          placeholder: 'Pick a modifier, or type one',
          typedNote: 'Not on the practice’s list — it goes on this report exactly as typed.',
        },
        checks: EGD_MODIFIERS.map(({ code, label }) => ({
          id: `modifier-${code.toLowerCase()}`,
          code,
          label,
        })),
      },
      {
        id: 'indication',
        title: 'Indication and preparation',
        fields: [
          {
            key: 'indication',
            type: 'textarea',
            label: 'Diagnostic indication',
            span: 2,
            required: true,
          },
          /*
           * AND THE SAME INDICATION AS SOMETHING THAT CAN BE CLAIMED AGAINST.
           *
           * The paragraph above says why the patient was scoped, in the
           * endoscopist's own words, and it always will — "surveillance, two
           * adenomas in 2023" is the sentence the next endoscopist wants. What
           * it is not is a diagnosis code, and a report whose only statement
           * of the indication is prose leaves the coder to derive one from it
           * days later.
           *
           * So the codes are attached here, on the report, by the person who
           * knows which they are. Typed rather than picked from a list: a
           * dropdown of the practice's ten favourites is fine until the
           * eleventh is needed, and the search matches on the code and on the
           * words, so both "K21" and "reflux" reach the same line.
           */
          { key: 'icd', type: 'icd', label: 'ICD-10 diagnosis codes', span: 2 },
          {
            key: 'prepType',
            type: 'select',
            label: 'Bowel preparation assessment',
            options: COLONOSCOPY_BOWEL_PREP_TYPES,
            value: COLONOSCOPY_BOWEL_PREP_TYPES[0],
          },
          {
            key: 'prepQuality',
            type: 'select',
            label: 'Bowel preparation quality',
            options: COLONOSCOPY_BOWEL_PREP_QUALITY,
          },
        ],
      },
      {
        id: 'details',
        title: 'Procedure details',
        /* The eight dropdowns, straight off the shared list — so a detail
           recorded here means what it means on the other report. */
        fields: COLONOSCOPY_PROCEDURE_DETAILS.map((detail) => ({
          key: detail.id,
          type: 'select',
          label: detail.label,
          options: detail.options,
        })),
      },
      /* =====================================================================
         FINDINGS ARE RECORDED ON THE BOWEL, NOT TYPED INTO A BOX.

         This was a textarea reading "one finding per line, as it should read
         in the report", and it worked in the sense that a sentence came out of
         it. What did not come out of it was a RECORD: no two endoscopists
         described a 6 mm sessile polyp the same way, nothing downstream could
         count polyps or find the segment they were in, and the site was a word
         somebody had to remember to include.

         So the box is now a diagram. The endoscopist presses the segment,
         which is faster than naming it and impossible to leave out, and fills
         in a form shaped for the KIND of thing found there — the eleven of
         them are in data/colon-findings.js. The report's sentences are then
         generated from the structure, which is the same bargain the other
         report's polyp form has always struck: record the anatomy, and the
         prose writes itself.

         `key: 'findings'` is deliberately unchanged. It still holds a string
         and that string is still what the impression seeds from, what the
         required check reads and what prints — see the diagram field in
         docFieldMarkup. What changed is who writes it.
         ================================================================== */
      {
        id: 'findings',
        title: 'Findings',
        note: 'Click a segment on the diagram to record findings at that location.',
        /* Nothing but the diagram. Blood loss and complications used to sit
           under it and are their own card now — see below for why. */
        fields: [
          {
            key: 'findings',
            type: 'diagram',
            label: 'Findings',
            span: 2,
            required: true,
            diagram: 'colon',
          },
        ],
      },

      /*
       * BLOOD LOSS AND COMPLICATIONS ARE NOT FINDINGS.
       *
       * They sat on the Findings card while that card was a textarea, where
       * three more boxes under a box read as more of the same question. Beside
       * the diagram they do not: the card now ends in an illustration and a
       * legend, and a dropdown hanging off the bottom of that reads as part of
       * the picture's own controls rather than as the next question.
       *
       * They are also a different question. A finding is something that was
       * SEEN, recorded against the segment it was seen in. Blood loss and
       * complications are what HAPPENED to the patient over the case as a
       * whole — they belong to the procedure, not to a segment of bowel, which
       * is exactly why neither of them has anywhere to go on the diagram.
       *
       * A complication that belongs to one finding still has its own place:
       * the polyp and Other forms both carry one inside their intervention
       * card, because a perforation made taking a polyp off is a fact about
       * that polyp. This card is for the ones that are not.
       */
      {
        id: 'course',
        title: 'Blood loss and complications',
        fields: [
          {
            key: 'bloodLoss',
            type: 'select',
            label: 'Blood loss',
            options: EGD_BLOOD_LOSS_OPTIONS,
            value: EGD_BLOOD_LOSS_OPTIONS[0],
          },
          { key: 'bloodLossAmount', type: 'number', label: 'Estimated amount (mL)' },
          {
            key: 'complications',
            type: 'textarea',
            label: 'Complications',
            value: EGD_DEFAULT_COMPLICATIONS,
            span: 2,
          },
        ],
      },
      {
        id: 'impression',
        title: 'Impression',
        fields: [
          { key: 'impression', type: 'textarea', label: 'Impression', span: 2, required: true },
        ],
      },
      {
        id: 'recommendations',
        title: 'Recommendations',
        checks: EGD_RECOMMENDATIONS.map((rec) => ({ id: rec.id, label: rec.label })),
        fields: [
          /* Years, from a list — see COLONOSCOPY_REPEAT_YEARS for what the
             free-text box this replaces was actually collecting. The unit is
             in the label rather than in a second control beside it: every
             surveillance interval this practice recalls on is a number of
             years, and a unit picker offering weeks would invite an answer the
             recall list cannot use. */
          {
            key: 'recallInterval',
            type: 'select',
            label: 'Repeat procedure in (years)',
            options: COLONOSCOPY_REPEAT_YEARS,
          },
          { key: 'recommendationNote', type: 'text', label: 'Other instructions' },
        ],
      },
      /*
       * THE PICTURES, ON THE REPORT THEY BELONG TO.
       *
       * An endoscopy report without its images is half a record: the landmark
       * shots are how a later reader knows the caecum was reached, and the
       * picture of the polyp is what the next endoscopist looks for before
       * they go back in. The Procedure details card above already asks whether
       * landmarks were "identified and images taken", which was a claim the
       * document had nowhere to keep the evidence for.
       *
       * Read locally and held on the document's own answers, like everything
       * else here — this is a prototype with no server behind it, so what is
       * attached lives as long as the encounter is open.
       */
      {
        id: 'photos',
        title: 'Procedure photos',
        note: 'Images captured during the case. Landmarks first, then anything found.',
        fields: [{ key: 'photos', type: 'photos', label: 'Procedure photos', span: 2 }],
      },
      /* The third of the physician's three, and typed like the other two —
         see typedClinicianSignature at the head of this file. */
      {
        id: 'sign',
        title: 'Endoscopist signature',
        note: 'Signing files the report to the chart and closes the Procedure step.',
        signature: typedClinicianSignature('Endoscopist signature'),
      },
    ],
  },

  /*
   * THE DISCHARGE, WHICH IS THE PAGE THE PATIENT LEAVES HOLDING AND NOTHING ELSE.
   *
   * It used to be the nurse's record: a criteria checklist, where the patient
   * was going and who with, which instruction set they were given and when, and
   * a recovery signature under all of it. Every one of those questions is now
   * asked once, at the counter, on the desk's own form — see `checkout` below,
   * which carries the criteria list and the leaving details themselves. Asking
   * them here as well made the run put the same answers into two stores and
   * then spend a `seedFrom` keeping them from disagreeing.
   *
   * So the questions went to the desk and the PAGE stayed here. What is left is
   * the handout itself — the activity and diet lines, the warning signs, the
   * anticoagulant restart, the endoscopist's own words for this patient, and
   * the number to ring — read back in recovery, where the sheet is actually
   * gone through with the patient before they get up.
   *
   * IT HAS NO SECTIONS, AND THAT IS THE DOCUMENT RATHER THAN AN OMISSION.
   * A section in this file is a card of fields, ticks or a signature, and the
   * handout is none of the three: it is six blocks of text with three controls
   * buried in them. It is drawn as a LEAD instead — markup a document owns that
   * its spec does not declare — which is what it has always been, moved here
   * from check-out. See DOC_LEADS in js/screens/encounter.js.
   */
  discharge: {
    title: 'Discharge instructions',
    sections: [],
  },

  /*
   * CHECK-OUT — step 6's whole document, and the only one nobody clinical signs.
   *
   * It is a step of its own because the desk is its own room: the front desk
   * should not have to open the endoscopist's step to find the form it works
   * every visit. What it is NOT is the empty step this began as, which sat in
   * the same place holding the words "not built yet" — the position was never
   * the problem, the emptiness was. The row belongs under post-anaesthesia
   * because the counter is the last thing that happens with the patient in the
   * building; see the ladder in data/procedure-encounter-run.js.
   *
   * It ends in a pad like every other document in the run, and for a while it
   * deliberately did not — the argument, and why it turned out to be wrong,
   * is at the signature section itself. What that pad is NOT is a clinical
   * attestation: it is the name of whoever released the patient. Signing it is
   * what sets the appointment to Check Out (see DOC_COMPLETION_EFFECTS in
   * js/screens/encounter.js), and the encounter stays open behind it.
   *
   * IT IS TWO CARDS AND A SIGNATURE. It carried four more cards — the handout
   * read back in full above them, then Handed over, Follow-up, Account and
   * Close the visit — which made it much the longest page in the run and
   * buried the two questions the desk is actually standing there to answer
   * under six cards of patient-facing prose. The handout has gone back to the
   * discharge record, which is now nothing but the handout; the booking and
   * the balance belong to the scheduler and to billing, which own them
   * properly.
   */
  checkout: {
    title: 'Patient check-out',
    sections: [
      /*
       * WHO IS STANDING AT THE COUNTER, BEFORE ANYTHING IS TICKED ABOUT THEM.
       *
       * Every other document in the run is opened by somebody who was in the
       * room: the nurse who did the checklist, the anaesthetist at the head of
       * the bed, the endoscopist who wrote the report. The desk was not. They
       * meet the patient for the first time at this counter, minutes after
       * sedation, and the page they were given opened straight onto eight
       * ticks about a discharge they had no way to check was the right
       * patient's — the name was in the left rail, in the shell around the
       * document rather than on it, and the printed copy of check-out carried
       * no identity at all.
       *
       * So the document says who this is first: the patient, the procedure
       * they had, who did it and when. Read-only and read from the booking and
       * the chart, exactly as the H&P's history card is — a fact retyped at
       * the counter is a fact that can disagree with the record it came from.
       */
      { id: 'overview', title: 'Patient Overview', overview: true },

      /*
       * DISCHARGE CRITERIA — THE ONLY PLACE THE RUN ASKS WHETHER THE PATIENT
       * MAY GO, IN WORDS.
       *
       * The eight lines are read from DISCHARGE_CRITERIA in
       * data/procedure-encounter.js rather than typed out here. The same list
       * is what the clinic-visit screen's discharge panel works through, and
       * two copies of it would be two definitions of a safe discharge — the
       * kind that agree on the day they are written and drift apart after.
       *
       * They arrive already ticked, and that is not the form answering itself.
       * The criteria are worked in recovery, minutes earlier; the desk is
       * confirming a discharge somebody else assessed rather than assessing
       * one a second time. UN-ticking is what the counter is actually for —
       * the lift that never turned up, the sheet that means nothing to the
       * person now holding it — so the list opens as the state of the patient
       * as last recorded and asks whether it is still true.
       *
       * The Aldrete line is `derived` and stays derived. It is answered from
       * step 2's score read against the threshold, so the renderer draws it
       * disabled under the sentence saying where it came from; a box the desk
       * could tick by hand would let a patient scoring 6 out of the building
       * on a click. See docSectionMarkup in js/screens/encounter.js.
       */
      {
        id: 'criteria',
        /* "Discharge Criteria" named the LIST; this card is the act of working
           down it. The desk is not being shown the practice's criteria, it is
           assessing this patient against them and un-ticking what is no longer
           true, and the title now says which of the two is being asked for. */
        title: 'Discharge Readiness Assessment',
        note: 'Every line has to be true before the patient leaves. The Aldrete line is answered from step 2’s score, never ticked by hand.',
        defaults: true,
        checks: DISCHARGE_CRITERIA.map((c) => ({
          id: c.id,
          label: c.label,
          checked: c.done,
          derived: c.derived,
        })),
      },

      /*
       * DISCHARGE DETAILS — WHERE THE PATIENT WENT, ASKED ONCE.
       *
       * These six were on the nurse's record as well, and `seedFrom` used to
       * carry recovery's answers across so the desk started from what had
       * already been filed rather than from a blank form. Both halves of that
       * are gone: the record is the handout and nothing else now (see
       * `discharge` above), so there is nothing to seed from and nothing to
       * disagree with. The option lists are still read from
       * data/procedure-encounter.js rather than typed here, because the
       * vocabulary for where a patient went belongs to the practice and not to
       * one form.
       *
       * WHO IS TAKING THEM HOME IS TWO FIELDS, NOT ONE.
       * "Discharge with" is the reportable fact — was there a responsible
       * adult — and "Accompanied by" is who that was. One field holding both
       * would either be a free-text box nobody can count, or a picklist with
       * somebody's name in it. The name is not required, and it must stay that
       * way: an unaccompanied patient who had no sedation is a legitimate
       * discharge, and it is left blank for a facility transfer too, where
       * "Facility staff" is who they leave with and no individual is being
       * named. "(if applicable)" is in the label rather than the field being
       * revealed by the answer above it, because there is no single answer
       * that means "now ask".
       *
       * Discharge status is the UB-04 code, which is why the code leads the
       * label and the words after it are the gloss: what the facility claim
       * carries is the number.
       */
      /*
       * `defaults` NAMES ITS FIVE KEYS RATHER THAN COVERING THE CARD.
       *
       * It was `defaults: true`, which was right while every answer on the card
       * repeated: a list of twelve colonoscopies goes home, by car, with a
       * responsible adult, under the same UB-04 code, all day. The two answers
       * added below do not repeat — a time and a moment are this patient's
       * alone — and a Set as default that swept them up would press one
       * patient's discharge time onto the next twelve. See coveredByDefault in
       * js/screens/encounter.js.
       */
      {
        id: 'discharge-details',
        title: 'Discharge Details',
        defaults: ['destination', 'mode', 'transport', 'dischargeWith', 'status'],
        fields: [
          { key: 'destination', type: 'select', label: 'Discharge From ASC To', options: DISCHARGE_DESTINATIONS, value: DISCHARGE_DEFAULTS.destination, required: true },
          { key: 'mode', type: 'select', label: 'Discharge mode', options: DISCHARGE_MODES, value: DISCHARGE_DEFAULTS.mode, required: true },
          { key: 'transport', type: 'select', label: 'Transport method', options: TRANSPORT_METHODS, value: DISCHARGE_DEFAULTS.transport, required: true },
          { key: 'dischargeWith', type: 'select', label: 'Discharge with', options: DISCHARGE_WITH, value: DISCHARGE_DEFAULTS.dischargeWith, required: true },
          { key: 'accompaniedBy', type: 'text', label: 'Accompanied by (if applicable)', placeholder: 'Name of the person taking the patient home', span: 2 },
          { key: 'status', type: 'select', label: 'Discharge status (UB-04)', options: DISCHARGE_STATUSES, value: DISCHARGE_DEFAULTS.status, span: 2, required: true },
          /*
           * WHEN THE SHEET WAS GONE THROUGH, AND WHEN THEY WALKED OUT. TWO
           * FACTS, TWO FIELDS, AND ONE OF THEM NEEDS A DATE.
           *
           * The handout on the step above is read back in recovery, with the
           * patient still in the chair, and the desk confirms at the counter
           * that it happened. Until now it confirmed it in the same breath as
           * everything else on this card — which is to say it did not confirm
           * it at all, and the one question a discharge is disputed over
           * afterwards is when the patient was told what.
           *
           * It carries a DATE as well as a clock reading because it is not
           * always today: a case that finishes at seven in the evening is
           * discharged the same night, but the instructions for a patient kept
           * for observation are gone through the following morning, and a
           * bare time on a form filed under yesterday's encounter says the
           * wrong day without ever looking wrong.
           *
           * The discharge time is a clock reading, because the patient leaving
           * the building is an event on the day the encounter already names —
           * and it is the one answer on this card that is different for every
           * patient, which is why both sit outside the defaults above and why
           * this one has a Now beside it.
           */
          {
            key: 'instructionsGivenAt',
            type: 'datetime',
            label: 'Discharge instructions given at',
            hint: 'When the handout was gone through with the patient.',
          },
          { key: 'dischargeTime', type: 'time', label: 'Discharge time', now: true },
        ],
      },

      /*
       * WHO LET THE PATIENT GO, AND THE ONE MARK ON THE RUN THAT IS NOT A
       * CLINICIAN'S.
       *
       * This document had no pad for a long time, on the argument that nothing
       * at the counter is an attestation — the desk is confirming a discharge
       * recovery already decided, and a pad under a receipt dresses it up as a
       * clinical record. The argument was about the WORDS and it missed what
       * the card above it does. Un-ticking "Transportation arranged" is not
       * transcription: it is a person at the counter, minutes after the
       * bedside, overriding what the record says and holding the patient. A
       * page where somebody can do that and the page cannot say who did is the
       * one place on the run a decision is made anonymously.
       *
       * So the last thing on the desk's step is the name of the person who let
       * the patient walk out. It is not the endoscopist's signature and it is
       * not recovery's — both of those are further up the run, against the
       * clinical work — and it does not turn check-out into a clinical record,
       * because what is being signed is a release and not a finding.
       *
       * `who: 'discharging'` rather than the 'provider' key the clinical pads
       * share. The key is what the mark is filed under (see paintDocSignature
       * in js/screens/encounter.js) and the desk is not a provider; filing the
       * front desk's release beside the anaesthetist's consent under one name
       * would make two different claims look like one person's.
       *
       * Typed, like every other authenticated signer on this run: the screen
       * knows who is at the workstation, and a mark drawn with a mouse a dozen
       * times a list is a picture of a signature rather than one. See
       * typedClinicianSignature at the head of this file for the full argument.
       *
       * AND IT IS WHAT MAKES THE STEP TAKE A DECISION. Every required answer
       * on the two cards above arrives pre-filled from the practice's own
       * defaults, so before this pad the document was complete the instant it
       * was opened — the appointment moved to Check Out with nobody having
       * looked at it. The one thing on the page no default can supply is a
       * person putting their name to it.
       */
      {
        id: 'sign',
        title: 'Discharging staff signature',
        note: 'Signing releases the patient and sets the appointment to Check Out.',
        signature: {
          heading: 'Discharging staff signature',
          who: 'discharging',
          methods: 'type',
        },
      },
    ],
  },

  /* ========================================================================
     STEP 5 — POST-ANAESTHESIA (CRNA)
     ===================================================================== */

  'post-anaesthesia': {
    title: 'Post-anaesthesia record',
    /*
     * THE HANDOVER, WHAT ELSE WAS SEEN, AND WHETHER ANYTHING WENT WRONG.
     *
     * This record used to carry the anaesthesia times, the course of the case,
     * the Aldrete readiness list and a provider signature pad underneath them
     * all. Every one of those is already written somewhere the day actually
     * writes it — the times and the course on the clinic note's anaesthesia
     * card, the readiness list against the score answered in step 2 — so the
     * record was a second place to say the same things and a second place for
     * them to disagree. All of it went, and for a while what was left was one
     * tick and nothing else.
     *
     * The claim that survived is the one nothing else on the run makes: that
     * the patient came back to themselves and that a person, not a chart, was
     * told. Four facts in one sentence because they are attested together at
     * one moment, at the bedside, and splitting them into four boxes would
     * invite three of them to be ticked and the fourth left as an oversight.
     *
     * Required, so the record cannot be filed with the handover unsaid.
     *
     * THE TICK, AND A BOX UNDER IT FOR WHAT THE TICK CANNOT SAY.
     *
     * The Assessment Notes box under the statement has been removed and put
     * back more than once, and the argument for removing it was that a card
     * carrying one signed sentence should carry nothing else — a free-text box
     * beside an attestation blurs what is being attested and what is merely
     * being noted. What that argument kept losing to is the bedside: a tick
     * cannot say a slow emergence resolved, cannot name the nurse the report
     * was given to, cannot record that the patient was held twenty minutes
     * longer than the room expected. Those are not complications — the card
     * below asks that question, and filing them there would read as a case
     * that went wrong — so with no box they were written nowhere, or written
     * into the complications description, which is worse.
     *
     * The box is optional and the statement above it is not, which is what
     * keeps the two from blurring into each other: the sentence is the thing
     * that must be true before the record can be filed, and the notes are
     * whatever else the person who ticked it wants the chart to know.
     *
     * IT IS SIGNED, AND FOR A WHILE IT WAS NOT.
     *
     * The argument for leaving it unsigned was that a tick made at the bedside
     * by the person who made the assessment is itself the attestation, and a
     * pad under it asks for the same assurance twice. That is true of the tick
     * and untrue of the record: a checkbox carries no name and no time, so the
     * one document in the run stating that a patient was safe to hand over was
     * also the only one that could not say who said so or when. It is the
     * third of the anaesthesia professional's three signatures on this run —
     * consent, pre-op and orders, and this — and the last thing they do on the
     * case.
     */
    sections: [
      {
        id: 'handover',
        title: 'Post-anaesthesia assessment',
        /* The wording is read from data/procedure-encounter.js rather than
           typed here, so this record and the clinic note's own
           Post-Anesthesia Assessment card cannot end up asserting two
           different sentences. */
        checks: [
          {
            id: POST_ANAESTHESIA_ASSESSMENT.id,
            label: POST_ANAESTHESIA_ASSESSMENT.label,
            required: true,
            short: 'the post-anaesthesia assessment',
          },
        ],
        /* Under the tick, not beside it — checks render before fields, and the
           order is the point: the statement is answered, then anything that
           needs saying about it. Full width because it is prose; a half-width
           textarea alongside nothing would read as one of a pair of answers. */
        fields: [
          {
            key: POST_ANAESTHESIA_ASSESSMENT.note.id,
            type: 'textarea',
            label: POST_ANAESTHESIA_ASSESSMENT.note.label,
            placeholder: POST_ANAESTHESIA_ASSESSMENT.note.placeholder,
            span: 2,
          },
        ],
      },

      /*
       * WHETHER ANYTHING WENT WRONG — ASKED HERE, NOT INFERRED FROM SILENCE.
       *
       * The record used to have nowhere to say it. A case that desaturated in
       * recovery and came back was written into the clinic note's complications
       * box if it was written anywhere, and the run's own anaesthesia record —
       * the document the CRNA signs at the end of the case — carried a tick
       * saying the patient was fine and nothing that could say otherwise.
       *
       * Now it can, in the shape the clinic note already asks it in: None or
       * Complications occurred, with a description that opens behind the second
       * answer. Both options and the description's wording come from
       * data/procedure-encounter.js, so the two documents cannot end up asking
       * different questions about one case.
       */
      {
        id: 'complications',
        title: ANAESTHESIA_COMPLICATIONS.label,
        /*
         * TWO RADIOS AND A BOX BEHIND ONE OF THEM — THE CLINIC NOTE'S SHAPE.
         *
         * It was briefly a single tick, on the argument that the flag is what
         * the record needs and the account of it belongs with the rest of the
         * case. What that lost is the difference between "no complications"
         * and "nobody answered": a box left alone reads as both, and this is
         * the one question on the record where those two must not look the
         * same. None is CHOSEN here.
         *
         * The description is not required. A complication with no account of
         * it is a poor entry, but the account is written up at length on the
         * clinic note, and a required box here would make the honest answer
         * the expensive one — which is how flags stop being ticked.
         */
        fields: [
          {
            key: ANAESTHESIA_COMPLICATIONS.id,
            type: 'radio',
            /* "Complications", under a card headed "Anesthesia Complications" —
               the heading says what the question is about, the label says what
               is being asked. Kept rather than dropped because the group needs
               a name of its own for anybody reading the form through a screen
               reader, where the card heading is not attached to it. */
            label: 'Complications',
            options: ANAESTHESIA_COMPLICATION_OPTIONS,
            value: ANAESTHESIA_COMPLICATIONS.none,
            /* Full width, so the two options sit on one line. In a half-width
               cell "Complications occurred" wraps under its own radio and the
               pair stops reading as a pair. */
            span: 2,
          },
          {
            key: ANAESTHESIA_COMPLICATIONS.detail.id,
            type: 'textarea',
            label: ANAESTHESIA_COMPLICATIONS.detail.label,
            placeholder: ANAESTHESIA_COMPLICATIONS.detail.placeholder,
            span: 2,
            showWhen: {
              key: ANAESTHESIA_COMPLICATIONS.id,
              is: ANAESTHESIA_COMPLICATIONS.occurred,
            },
          },
        ],
      },

      /* A name and a timestamp, the same as the two above it — see
         ANAESTHESIA_SIGNATURE at the head of this file. */
      {
        id: 'sign',
        title: 'Anesthesia provider signature',
        signature: ANAESTHESIA_SIGNATURE,
      },
    ],
  },
};
