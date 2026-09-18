/**
 * THE SHAPE OF THE PRE-PROCEDURE SHEET.
 *
 * Every question, in the order the nurse works it, as data rather than markup.
 *
 * WHY A SPEC AND NOT MARKUP
 * The sheet is around a hundred and eighty questions. Hand-written markup for
 * that many fields is where reveal rules and grid cells drift apart: a
 * conditional ends up in the column next to the control that triggered it, a
 * required field is required in the renderer but not in the gate, and nobody
 * notices until a sheet is signed with a blank on it. Declaring each field once
 * — its control, its reveal rule, its validation, and the cell it belongs in —
 * means the renderer, the gate and the PDF all read the same source.
 *
 * THE ONE RULE THAT MATTERS
 * `children` render INSIDE their parent's grid cell, directly under the control
 * that revealed them. That is not a layout preference. A "Specify other" input
 * that lands in a different column from its select is a question with no
 * visible subject, and the answer typed into it means nothing.
 *
 * WHAT LIVES NEXT DOOR
 *   data/pre-check.js        the closed lists, the default, the demo seed
 *   js/lib/pre-check-form.js the renderer and the wiring
 */
import {
  YES_NO,
  YES_NO_UNKNOWN,
  ARRIVAL_MODES,
  INTERPRETER_METHODS,
  PATIENT_VERIFICATION_CHECKS,
  SITE_MARKED_OPTIONS,
  CODE_STATUS_OPTIONS,
  SEDATION_HISTORY,
  APFEL_FACTORS,
  MASTECTOMY_OPTIONS,
  AV_SHUNT_OPTIONS,
  DENTURES_OPTIONS,
  GLASSES_OPTIONS,
  CONTACT_LENS_OPTIONS,
  HEARING_AID_OPTIONS,
  JEWELRY_OPTIONS,
  DIABETES_TYPES,
  PUMP_ACTIONS,
  AICD_DEVICE_TYPES,
  OSA_OPTIONS,
  STOPBANG_FACTORS,
  PREGNANCY_OPTIONS,
  HCG_RESULTS,
  STENT_TYPES,
  IMPLANT_OPTIONS,
  SUBSTANCE_USE,
  INFECTION_PRECAUTIONS,
  FALL_RISK,
  OXYGEN_DELIVERY,
  TEMPERATURE_ROUTES,
  ORIENTATION_OPTIONS,
  VITAL_FLAGS,
  ASA_CLASSES,
  MALLAMPATI_CLASSES,
  MOUTH_OPENING,
  THYROMENTAL_DISTANCE,
  NECK_ROM,
  PLANNED_ANAESTHESIA_TYPES,
  WEIGHT_LOSS_TYPES,
  GLP1_AGENTS,
  WEIGHT_LOSS_FREQUENCY,
  HELD_OPTIONS,
  GLP1_SYMPTOMS,
  GASTRIC_ULTRASOUND_RESULTS,
  ANTICOAGULANT_TYPES,
  ANTICOAGULANT_INDICATIONS,
  ALLERGY_CHECKS,
  MEDS_TAKEN_OPTIONS,
  BETA_BLOCKER_OPTIONS,
  NPO_RESULTS,
  COLON_PREPARATIONS,
  PREP_COMPLETION,
  PREP_TOLERANCE,
  EFFLUENT_APPEARANCE,
  IV_FLUIDS,
  IV_SITE_CONDITIONS,
  GROUNDING_PAD_OPTIONS,
  SPECIAL_EQUIPMENT,
  SCOPE_OPTIONS,
  STAFF_CREDENTIALS,
  ATTESTATION_TEXT,
  NUMERIC_RANGES,
} from '../../data/pre-check.js';

/* ============================================================================
   DERIVED VALUES

   Scores the sheet works out rather than asks for. Each is a plain function of
   the values so the gate, the badge and the PDF cannot disagree about it.
   ========================================================================= */

export const ponvScore = (v) => APFEL_FACTORS.filter((f) => v[f.id]).length;

export const stopBangScore = (v) => STOPBANG_FACTORS.filter((f) => v[f.id]).length;

/** Imperial in, BMI out. Blank unless both halves are there and sane. */
export function bmiOf(v) {
  const inches = Number(v.heightIn);
  const pounds = Number(v.weightLb);
  if (!inches || !pounds) return null;
  const bmi = (pounds / (inches * inches)) * 703;
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

/** Was a GLP-1/GIP agent recorded — the aspiration-risk subset, not any diet drug. */
export const isGlp1 = (v) => v.weightLoss === 'yes' && GLP1_AGENTS.includes(v.weightLossType);

/**
 * Hours between an ISO-ish local timestamp and the procedure.
 *
 * Returns null rather than 0 when either end is missing, because "no answer"
 * and "no time elapsed" must not both read as a violation.
 */
export function hoursBefore(stamp, reference) {
  if (!stamp || !reference) return null;
  const then = new Date(stamp);
  const at = new Date(reference);
  if (Number.isNaN(then.getTime()) || Number.isNaN(at.getTime())) return null;
  return (at - then) / 36e5;
}

/** Which vitals are outside the band worth telling anaesthesia about. */
export function abnormalVitals(v) {
  return VITAL_FLAGS.filter(({ key, low, high }) => {
    const n = Number(v[key]);
    if (v[key] === '' || v[key] === undefined || !Number.isFinite(n)) return false;
    return (low !== null && n < low) || (high !== null && n > high);
  });
}

/* ============================================================================
   FIELD HELPERS

   Small constructors, so a field reads as the question it is rather than as an
   object literal. Every one of them returns the same shape.
   ========================================================================= */

const field = (spec) => spec;

/** A yes/no (or yes/no/unknown) question. Radios, always — never a box pair. */
const radio = (key, testid, label, options = YES_NO, rest = {}) =>
  field({ key, testid, label, type: 'radio', options, ...rest });

const select = (key, testid, label, options, rest = {}) =>
  field({ key, testid, label, type: 'select', options, ...rest });

const text = (key, testid, label, rest = {}) =>
  field({ key, testid, label, type: 'text', ...rest });

const number = (key, testid, label, rest = {}) =>
  field({ key, testid, label, type: 'number', range: NUMERIC_RANGES[key], ...rest });

const check = (key, testid, label, rest = {}) =>
  field({ key, testid, label, type: 'check', ...rest });

const date = (key, testid, label, rest = {}) =>
  field({ key, testid, label, type: 'date', ...rest });

const time = (key, testid, label, rest = {}) =>
  field({ key, testid, label, type: 'time', ...rest });

/** A read-only derived badge with an aria-live region. */
const score = (testid, label, compute, rest = {}) =>
  field({ testid, label, type: 'score', compute, ...rest });

/** A derived banner. `severity: 'critical'` blocks the sign-off. */
const alert = (testid, severity, heading, detail, when, rest = {}) =>
  field({ testid, type: 'alert', severity, heading, detail, when, ...rest });

/** The "if you picked Other, say what" pair, stated once. */
const otherText = (key, testid, label, when, rest = {}) =>
  text(key, testid, label, {
    when,
    required: when,
    placeholder: 'Enter details',
    ...rest,
  });

/* ============================================================================
   THE SECTIONS

   Order follows the paper form it replaces, because the nurse works down it in
   the room in that order: who and what, then what is in them, then their
   numbers, then their airway, then what was held, then allergies, then what
   they took today, then how the prep went and where the cannula is.
   ========================================================================= */

/**
 * The sheet, section by section.
 *
 * Cut back to the fields the paper form actually carries. It had grown a
 * superset — baseline vitals, an airway assessment, a medication
 * reconciliation and a long tail of conditions — and the unit does not fill
 * those in here. What is left is the form as it is worked, and nothing past it.
 *
 * The conditional children that remain are each the chosen answer's own
 * detail — "Other → say which" — which is the same pattern the form itself
 * uses for Other Anticoagulant, NPO details and Other Result. They are not
 * extra questions; they are the second half of the question above them.
 */
export const PRE_CHECK_SECTIONS = [
  /* --- 1. Patient arrival -------------------------------------------------
     `compact` says this section's whole answer fits on the line its own title
     is already occupying, so a host that draws sections as cards can put the
     two side by side instead of spending a heading band, a lead and a body
     inset on one stamped time. Two sections qualify — arrival and the sign-off
     stamp — and between them they were costing two hundred pixels of scroll to
     carry two single-line stamps.

     It is a HINT, not a layout: nothing here says how the pair is arranged,
     and a host that ignores it renders exactly what it rendered before. See
     .encv .pck__section--compact in css/screen-encounter.css.
     ---------------------------------------------------------------------- */
  {
    id: 'arrival',
    title: 'Patient Arrival',
    columns: 3,
    compact: true,
    fields: [
      field({ type: 'time-in-room', testid: 'time-in-room', span: 3 }),
    ],
  },

  /* --- 2. Patient verification -------------------------------------------- */
  {
    id: 'verification',
    title: 'Patient Verification',
    columns: 3,
    fields: [
      field({ type: 'verify-checks', testid: 'verify', span: 3, required: true }),
    ],
  },

  /* --- 3. Sedation history ------------------------------------------------
     Not `compact`, unlike the other two one-answer sections. Those two carry a
     stamp — a time, a pair of initials — that reads as a value belonging to
     the words beside it. This one carries a list the nurse chooses from, and
     the question is long enough that with the title taking the left half of
     the row there was little left for the list. Stacked, the question keeps
     the whole width of the card and the list sits in the first grid column
     under it, lined up with every other control on the sheet — and the box
     Other opens has somewhere to go that is not a squeezed half-row.
     ---------------------------------------------------------------------- */
  {
    id: 'sedation',
    title: 'History of problems with sedation',
    columns: 3,
    fields: [
      /* The section heading already asks the question, so the control does not
         repeat it — the label is kept for screen readers and taken off screen. */
      select('sedationHistory', 'sedation-history', 'History of sedation problems', SEDATION_HISTORY, {
        labelHidden: true,
        /* Other opens a box BENEATH the list rather than replacing it.

           This one is the exception to the sheet's "Other is typed into the
           field that asked" rule, and it is the exception for a reason. The
           other Others on the form name a thing — an anticoagulant, a prep,
           a weight-loss drug — so the typed name reads as the answer and the
           list it came from is not missed. This one asks for a sentence about
           an event, and swapping the select for a text box meant the chosen
           option vanished the moment it became typeable: a half-typed sheet
           showed an empty box under the heading with nothing on screen saying
           "Other" had been picked at all, which reads as a question nobody
           answered rather than one being answered right now.

           The box is a `child`, so it renders inside this field's own cell,
           directly under the question — not off in the next column, which is
           the defect that made the in-place pattern worth having. */
        children: [
          otherText(
            'sedationHistoryOther',
            'sedation-other',
            'Specify other sedation history',
            (v) => v.sedationHistory === 'other',
            { placeholder: 'What happened last time?' }
          ),
        ],
      }),
    ],
  },

  /* --- 4. Medical conditions ---------------------------------------------- */
  {
    id: 'conditions',
    title: 'Medical Conditions',
    columns: 3,
    fields: [
      /* Yes opens the reading. It is a `child` so it renders inside the
         Diabetes cell — a blood sugar sitting in the column beside AICD is a
         number with no visible subject.

         "if known" is the point of it: the box is offered, never demanded, so
         it is not `required`. A nurse who does not have the figure moves on,
         and a sheet that held the room open for a number nobody took would be
         a worse sheet. */
      radio('diabetes', 'diabetes', 'Diabetes', YES_NO, {
        legacySlugs: true,
        /* THE ONE CELL IN THIS SECTION THAT TAKES THE WHOLE ROW.

           Everything Diabetes reveals — a sugar, an insulin box, a pump
           action — stacks inside its own cell, so a Yes turned a 44px answer
           into a tall column while AICD and Mastectomy sat at the top of the
           same grid row with a quarter of a screen of nothing under them. The
           reveal is not the problem; a third of a row to lay it out in is.
           Across the full width the same answers are a row rather than a
           column (see .pck__cell--span-3 .pck__children), the section loses
           height, and the hole beside it closes. */
        span: 3,
        children: [
          number('lastBloodSugar', 'blood-sugar', 'Last Blood Sugar (if known)', {
            when: (v) => v.diabetes === 'yes',
            /* The unit rides in the placeholder rather than on the label: the
               label already carries a parenthetical, and "(if known) (mg/dL)"
               is two of them. It still has to be SOMEWHERE — 122 is an
               ordinary sugar in mg/dL and a lethal one in mmol/L — and the
               20–800 range behind the field is stated in mg/dL. */
            suffix: '',
            placeholder: 'Enter blood sugar level (mg/dL)',
          }),

          /* WHY INSULIN IS ASKED SEPARATELY FROM DIABETES.

             "Diabetic" and "on insulin" are two different problems for the
             room. The first changes the sugar you check; the second changes
             what you do about the answer, because a patient who took a
             long-acting dose last night and has been NPO since midnight is
             the one who arrives hypoglycaemic.

             The sheet used to go on to ask WHICH insulin and WHEN the last
             dose was. Both are off the form now: the medication list already
             carries the product and the pharmacy record carries the timing,
             and asking a patient at the desk to recall either produced an
             answer nobody in the room trusted enough to act on. What is left
             is the fact the desk can actually establish — that there is
             insulin in the picture at all.

             A checkbox rather than a Yes/No pair: it hangs off an answer that
             has already been given, so the question is "and also this?"
             rather than one more thing to answer twice. */
          check('takingInsulin', 'taking-insulin', 'Taking insulin', {
            when: (v) => v.diabetes === 'yes',
            children: [
              /* A pump can be left running, suspended or taken off, and a
                 pump still delivering basal insulin through a sedated case is
                 the failure this line exists to prevent. It used to hang off
                 an "Insulin type" of Pump; with that question gone the pump
                 answer is asked of everyone on insulin, and a patient who
                 does not wear one leaves it blank. Not required, for the same
                 reason. */
              select('pumpAction', 'pump-action', 'Insulin pump', PUMP_ACTIONS, {
                when: (v) => v.diabetes === 'yes' && v.takingInsulin === true,
              }),
            ],
          }),
        ],
      }),

      /* AICD stays a bare yes/no — the device follow-ups are not on the form. */
      radio('aicd', 'aicd', 'AICD', YES_NO, { legacySlugs: true }),
      select('mastectomy', 'mastectomy', 'Mastectomy', MASTECTOMY_OPTIONS),
      select('shunt', 'shunt', 'AV shunt', AV_SHUNT_OPTIONS),
      select('dentures', 'dentures', 'Dentures', DENTURES_OPTIONS),
      select('glasses', 'glasses', 'Glasses', GLASSES_OPTIONS),
    ],
  },

  /* --- 5. Weight-loss medication ------------------------------------------
     The type sits beside the Yes/No rather than inside its cell, because that
     is where the form puts it: the question on the left, its answer's detail
     on the right.
     ---------------------------------------------------------------------- */
  {
    id: 'weight-loss',
    title: 'Weight Loss Medication',
    columns: 2,
    fields: [
      radio('weightLoss', 'weight-loss', 'Weight loss medication', YES_NO, {
        legacySlugs: true,
        legacyLabels: ['No', 'Yes'],
        labelHidden: true,
      }),

      select('weightLossType', 'weight-loss-type', 'Type of weight loss medication', WEIGHT_LOSS_TYPES, {
        when: (v) => v.weightLoss === 'yes',
        required: (v) => v.weightLoss === 'yes',
        /* Other is typed into THIS field rather than into one that opens under
           it. The list is long and mostly brand names, so the answer that is
           not on it is a name too. */
        freeText: 'Other',
        freeTextKey: 'weightLossOther',
        freeTextPlaceholder: 'Enter medication name',
        children: [
          otherText(
            'weightLossOther',
            'weight-loss-other',
            'Other medication name',
            (v) => v.weightLoss === 'yes' && v.weightLossType === 'Other',
            { virtual: true }
          ),
        ],
      }),
    ],
  },

  /* --- 6. Anticoagulant --------------------------------------------------- */
  {
    id: 'anticoagulant',
    title: 'Anticoagulant',
    /* Three, so the whole question is one row: taking it, which one, and when
       it was last taken. At two the date had nowhere to go but a second row of
       its own, with the column beside it empty — seventy pixels spent saying
       "and one more thing" about an answer that was already on screen. The
       long option labels wrap to two lines in a third of the width, which is
       still shorter than the row they cost. */
    columns: 3,
    fields: [
      radio('anticoagulant', 'anticoagulant', 'Anticoagulant', YES_NO, {
        legacySlugs: true,
        legacyLabels: ['No Anticoagulant', 'Taking Anticoagulant'],
        labelHidden: true,
      }),

      select('anticoagulantType', 'anticoagulant-type', 'Type of anticoagulant', ANTICOAGULANT_TYPES, {
        when: (v) => v.anticoagulant === 'yes',
        required: (v) => v.anticoagulant === 'yes',
        /* The list is nine brand names; the answer that is not on it is a
           tenth brand name, so it is typed straight into the same box. */
        freeText: 'Other',
        freeTextKey: 'anticoagulantOther',
        freeTextPlaceholder: 'Enter the anticoagulant name',
        children: [
          otherText(
            'anticoagulantOther',
            'anticoagulant-other',
            'Specify other anticoagulant',
            (v) => v.anticoagulant === 'yes' && v.anticoagulantType === 'Other',
            { virtual: true }
          ),
        ],
      }),

      date('anticoagulantDate', 'anticoagulant-date', 'Date last taken', {
        when: (v) => v.anticoagulant === 'yes',
      }),
    ],
  },

  /* --- 7. Allergies ------------------------------------------------------- */
  {
    id: 'allergies',
    title: 'Allergies',
    columns: 2,
    fields: [
      field({ type: 'allergy-checks', testid: 'allergies', items: ALLERGY_CHECKS }),
      text('otherAllergies', 'other-allergies', 'Other allergies', {
        placeholder: 'e.g., Amoxicillin, Bupropion, Morphine',
      }),
    ],
  },

  /* --- 8. Procedure information ------------------------------------------- */
  {
    id: 'procedure',
    title: 'Procedure Information',
    columns: 2,
    fields: [
      /* The NPO widget draws its own free-text, so the "Other → say which"
         rule has to be declared here or the gate never learns about it. */
      field({
        type: 'npo-choice',
        testid: 'npo',
        required: true,
        children: [
          otherText(
            'npoOtherText',
            'npo-other-text',
            'Other NPO detail',
            (v) => v.npoStatus === 'other',
            { virtual: true, placeholder: 'Enter NPO details' }
          ),
        ],
      }),

      select('preparation', 'preparation', 'Colon Preparation', COLON_PREPARATIONS, {
        placeholder: 'Select preparation type',
        /* Same as the anticoagulant list: what a patient actually took is a
           product name, and the one not on the list is typed here. */
        freeText: 'Other',
        freeTextKey: 'colonPrepOther',
        freeTextPlaceholder: 'Enter preparation type',
        children: [
          otherText(
            'colonPrepOther',
            'colon-prep-other',
            'Other preparation',
            (v) => v.preparation === 'Other',
            { virtual: true }
          ),
        ],
      }),

      /* Results is a cell of its own rather than a child of the preparation,
         because the form lays it out on a row of its own. It is still absent
         — not greyed — when there was no prep at all.

         Single vs split dosing used to be asked here beside it. It has come
         off the sheet: the preparation names above already imply their own
         dosing, and what the endoscopist reads is the effluent, not how the
         prep got there. */
      select('colonPrepResults', 'colon-prep-results', 'Results', EFFLUENT_APPEARANCE, {
        when: (v) => hasPrep(v),
        placeholder: 'Select result type',
        /* An effluent the three words do not cover gets described in the same
           box rather than in one that appears under it. */
        freeText: 'other',
        freeTextKey: 'colonPrepResultsOther',
        freeTextPlaceholder: 'Describe the effluent',
        children: [
          otherText(
            'colonPrepResultsOther',
            'colon-prep-results-other',
            'Other Result',
            (v) => hasPrep(v) && v.colonPrepResults === 'other',
            { virtual: true }
          ),
        ],
      }),

      /* The one cell on the sheet that takes the whole row. Three rows of
         quick-select chips — seven gauges, nine sites, five trial counts —
         are twenty-one targets, and in half a column they broke four rows
         deep while "Scope" sat beside them with nothing under it: the tallest
         cell on the sheet paired with the shortest, and about four hundred
         pixels of nothing between them. Across the full width each row of
         chips is a row, which is what a row of chips is for. */
      field({
        type: 'iv-access',
        testid: 'iv',
        label: 'IV Details (gauge/site/trials)',
        required: true,
        span: 2,
      }),

      select('scope', 'scope', 'Scope', SCOPE_OPTIONS, { placeholder: 'Select instrument' }),
    ],
  },

  /* --- 9. Notes ----------------------------------------------------------- */
  {
    id: 'notes',
    title: 'Additional Notes',
    columns: 1,
    fields: [
      field({
        type: 'textarea',
        key: 'notes',
        testid: 'notes',
        label: 'Additional notes',
        labelHidden: true,
        rows: 3,
        placeholder: 'Any additional notes or observations…',
      }),
    ],
  },

  /* --- 10. Sign-off ------------------------------------------------------- */
  {
    id: 'signoff',
    title: 'Staff Initials',
    columns: 3,
    compact: true,
    fields: [
      field({ type: 'staff-initials', testid: 'staff-initials' }),
    ],
  },
];

/* ============================================================================
   RULES THE SPEC LEANS ON
   ========================================================================= */

/** Was there a preparation at all — the gate on every prep follow-up. */
export function hasPrep(v) {
  return Boolean(v.preparation) && v.preparation !== 'No preparation';
}

/**
 * "4 trials" → 4. Used to decide whether escalation has to be recorded.
 *
 * ivTrials is a LIST since the quick-selects went multi-select, so the count
 * is the HIGHEST answer given rather than the first or the last. A sheet
 * recording both "1 trial" in the right hand and "4 trials" in the left has
 * had four attempts at a cannula, and it is the four that has to be escalated.
 */
export function trialCount(v) {
  const answers = Array.isArray(v.ivTrials) ? v.ivTrials : v.ivTrials ? [v.ivTrials] : [];
  return answers.reduce((most, answer) => {
    const match = /^(\d+)/.exec(answer ?? '');
    return match ? Math.max(most, Number(match[1])) : most;
  }, 0);
}

/** Was a dose taken within N days of today. */
export function withinDays(stamp, days) {
  if (!stamp) return false;
  const then = new Date(stamp);
  if (Number.isNaN(then.getTime())) return false;
  return (Date.now() - then.getTime()) / 864e5 <= days;
}

/**
 * Which fasting windows were missed.
 *
 * Six hours for solids, two for clears, measured to the scheduled start rather
 * than to now — a case running late does not make the patient safer, and a
 * window that quietly satisfies itself while everyone waits is the bug.
 */
export function npoViolations(v, ctx = {}) {
  const at = ctx.scheduledAt;
  const out = [];
  const solids = hoursBefore(v.lastSolidIntake, at);
  const clears = hoursBefore(v.lastClearLiquidIntake, at);
  if (solids !== null && solids < 6) {
    out.push(`Solids ${solids.toFixed(1)} h before the procedure (6 h required).`);
  }
  if (clears !== null && clears < 2) {
    out.push(`Clear liquids ${clears.toFixed(1)} h before the procedure (2 h required).`);
  }
  return out;
}

/* ============================================================================
   WALKING THE SPEC

   Both the gate and the PDF need every field including the revealed ones, and
   neither should have to know that `children` exist.
   ========================================================================= */

/** Every field in the sheet, parents before children, sections in order. */
export function eachField(visit) {
  const walk = (fields, section, parent) => {
    fields.forEach((f) => {
      visit(f, section, parent);
      if (f.children) walk(f.children, section, f);
    });
  };
  PRE_CHECK_SECTIONS.forEach((section) => walk(section.fields, section, null));
}

/** Is this field on screen right now — its own rule and all of its parents'. */
export function isVisible(fieldSpec, values, ctx, parents = []) {
  return [...parents, fieldSpec].every((f) => !f.when || f.when(values, ctx));
}
