/**
 * Clinical encounter — the procedure report workspace.
 *
 * Two columns: the patient record on the left, the report in the middle. The
 * record stays put while the report scrolls, because it exists to be consulted
 * mid-sentence.
 *
 * THE MECHANIC THIS SCREEN IS BUILT AROUND
 * The endoscopist never writes the Findings paragraph and never fills in the
 * narrative by hand. They record structure — a polyp, in the sigmoid, 6 mm,
 * sessile, cold snare — and the report writes the prose. The narrative's
 * [Bracketed Tokens] work the same way: each resolves from a structured field,
 * and one still unset stays visible and highlighted rather than silently
 * blank, because a report that trails off mid-sentence is worse than one that
 * says out loud what is missing. Clean up strips the leftovers.
 *
 * Opened with ?appt=<id>, so the header and patient come from the booking.
 */
import { CLINICAL_SECTIONS, ICD10 } from '../../data/encounter.js';
import { CPT_CODES } from '../../data/master.js';
import {
  REPORT_TEMPLATE,
  REPORT_TEMPLATES,
  REPORT_STAFF,
  ADMINISTERED_MEDICATIONS,
  TIME_MARKERS,
  SAMPLES,
  NARRATIVE_TOKENS,
  PATHOLOGY_STATUS,
  PROCEDURE_NARRATIVE,
  COMMON_FINDINGS,
  SIMPLE_FINDING_TEXT,
  SIMPLE_FINDING_IMPRESSION,
  POLYP_SITES,
  POLYP_APPEARANCE,
  POLYP_PEDICLE,
  POLYP_BLEEDING,
  POLYP_INTERVENTIONS,
  SIZE_UNITS,
  COLONOSCOPY_PROCEDURES_PERFORMED,
  COLONOSCOPY_PROCEDURE_DETAILS,
  COLONOSCOPY_BOWEL_PREP_TYPES,
  COLONOSCOPY_BOWEL_PREP_QUALITY,
  COLONOSCOPY_DEFAULT_COMPLICATIONS,
  EXAM_SYSTEMS,
  EXAM_TABS,
  EXAM_CONTEXTS,
  EXAM_SYSTEM_SETS,
  EXAM_FLAGS,
  OUTPUT_STEPS,
} from '../../data/procedure-report.js';
import {
  ENCOUNTER_STAGES,
  PRE_DOCUMENTS,
  ANAESTHESIA_DOCUMENTS,
  ANAESTHESIA_CONSENT,
  PRE_ANAESTHESIA_PLAN,
  ANAESTHESIA_TYPES,
  ANAESTHESIA_INDICATION,
  AIRWAY_FIELDS,
  AIRWAY_OTHER,
  ANAESTHESIA_NOTE_CHECKS,
  ANAESTHESIA_CHECKS,
  ANAESTHESIA_TIMES,
  PROCEDURE_PHASES,
  RAMSAY_SCALE,
  DISCHARGE_READINESS_CHECKS,
  VITALS_LOG,
  MEDICATION_LOG,
  SEDATION_FORMULARY,
  MEDICATION_ROUTES,
  MEDICATION_CATEGORIES,
  MEDICATION_UNITS,
  IV_SOLUTIONS,
  IV_SOLUTION_TYPES,
  IV_RATES,
  OXYGEN_LOG,
  OXYGEN_DELIVERY,
  ALDRETE_CATEGORIES,
  ALDRETE_PHASES,
  ALDRETE_THRESHOLD,
  DISCHARGE_CRITERIA,
  DISCHARGE_DESTINATIONS,
  DISCHARGE_MODES,
  TRANSPORT_METHODS,
  DISCHARGE_STATUSES,
  DISCHARGE_INSTRUCTION_SETS,
  DISCHARGE_DEFAULTS,
  SPECIMEN_LOG,
  COMPLICATION_TYPES,
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
  PRE_PROCEDURE_ORDER_LINES,
  POST_PROCEDURE_ORDER_LINES,
  SEDATION_TYPES,
  SEDATION_ORDER_MEDICATIONS,
  EGD_PROCEDURES_PERFORMED,
  EGD_MODIFIERS,
  EGD_PROCEDURE_DETAILS,
  EGD_BLOOD_LOSS_OPTIONS,
  EGD_DEFAULT_COMPLICATIONS,
  EGD_FINDING_REGIONS,
  EGD_RECOMMENDATIONS,
  EGD_REPEAT_UNITS,
  EGD_MAX_PHOTOS,
} from '../../data/procedure-intra.js';
/* The right rail: the fourteen clinical sections, the cards they sit in and the
   copy controls on them. Shared with the procedure's step run, which mounts the
   same rail in the same place — see the note at the head of that module. */
import { mountClinicalRail, wireRailCollapse } from '../lib/clinical-rail.js';
/* The patient card at the top of the left rail — the same component the
   procedure encounter and the encounter summary draw, so one patient's
   identity is one thing however the note was opened. This screen used to hold
   its own copy, complete with a hard-coded insurance plan; see the head of
   js/lib/patient-card.js for what that cost. */
import { paintPatientCard } from '../lib/patient-card.js';
import { providerById, typeById, procedureById, coverageFor } from '../../data/schedule.js';
import { findAppointment, updateAppointment } from '../../data/appointment-store.js';
import { DIRECTORY } from '../../data/directory.js';
import { BILLING_PROCEDURES } from '../../data/billing.js';
import { enqueueSuperbill } from '../../data/billing-bridge.js';
// Step 1 of the pre-anaesthesia stage IS the bay's pre-procedure sheet — the
// same markup and the same rules, so the two cannot answer differently.
import {
  preCheckSheetMarkup,
  preCheckActionsMarkup,
  mountPreCheckSheet,
  preCheckOutstanding,
} from '../lib/pre-check-form.js';
/* A clinic visit is not a procedure, and for a long time this screen rendered
   it as one: every note template in the picker produced a colonoscopy report.
   Each template now has a document of its own. */
import {
  VISIT_NOTE_TEMPLATES,
  VISIT_NOTE_TITLES,
  templateByTitle,
} from '../../data/visit-note-templates.js';
import { noteTypeFor } from '../../data/visit-notes.js';
/* The chart's own order vocabularies. A lab raised from the Plan has to be
   the same kind of thing as a lab raised on the chart's Orders tab — same
   test catalogue, same vendors, same ICD list — or the note quietly invents a
   second way of ordering the same test. */
import {
  LAB_TEST_CATALOG,
  LAB_VENDORS,
  ICD_CODES,
  PROCEDURE_TYPES,
  PROCEDURE_FACILITIES,
  PROCEDURE_PRIORITIES,
} from '../../data/chart-orders.js';
import { raiseOrders } from '../../data/order-store.js';
import {
  RECALL_TYPES,
  RECALL_INTERVALS,
  RECALL_LOCATIONS,
} from '../../data/tasks.js';
import { addRecall, recallIntervalFor, dueFromInterval } from '../../data/recall-store.js';
import { notify as toast } from '../lib/toast.js';
/*
 * THE AI SCRIBE, WHICH IS WHAT V2 OF THIS SCREEN IS FOR.
 *
 * The purple button on the document bar, the transcript it fills while the
 * consultation happens, and the draft it hands back. Everything about why the
 * draft does NOT go into the note by itself is over js/lib/ai-scribe.js.
 */
import { mountAiScribe } from '../lib/ai-scribe.js';
/*
 * V2: THE TWO BLOCKS A CLINICIAN CAN ADD TO ANY NOTE.
 *
 * A review of systems and a marked-up body map are not sections of a template
 * — every template could carry either, and most consultations want neither —
 * so they are added at the desk from the tool row under the Plan, and they
 * render as note sections once they exist. See insertPointForExtra() for where
 * each one lands and why it is not simply appended at the bottom.
 */
import {
  ROS_SYSTEMS,
  ROS_ANSWERS,
  ROS_NEGATIVE,
  ROS_SECTION_ID,
  ROS_SECTION_TITLE,
} from '../../data/ros.js';
import {
  openBodyDiagram,
  bodyDiagramBlock,
  bodyDiagramPresetOptions,
} from '../lib/body-diagram.js';
import { bodyMapById } from '../../data/body-maps.js';

/* ===================== Helpers ===================== */

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const initials = (name) =>
  name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/* ===================== Context ===================== */

const searchParams = new URLSearchParams(window.location.search);
const appointment = findAppointment(searchParams.get('appt'));

/** The mounted pre-procedure sheet, while step 1 is on screen. */
let preCheckSheet = null;

/**
 * Which anaesthesia document opens first.
 *
 * Step one, unless the URL asks otherwise. The two are a run — the report is
 * written from the management log — so opening on the report would land the
 * anaesthetist on the document that depends on work not yet done.
 */
const landOn = searchParams.get('land') === 'report' ? 'report' : 'checklist';

const patient =
  DIRECTORY.find((p) => p.mrn === appointment?.mrn) ??
  DIRECTORY.find((p) => p.active);

/**
 * Only a procedure is staged.
 *
 * A procedure visit is three documents signed by three people at three times —
 * the nurse and anaesthetist before, the endoscopist during, recovery after —
 * so it gets the stage tabs. A clinic visit is one clinician and one note, and
 * splitting that into three tabs would be ceremony with nothing behind it.
 */
const isProcedure =
  appointment?.kind === 'procedure' || Boolean(appointment?.procedureId);

/**
 * A PROCEDURE DOES NOT BELONG HERE ANY MORE.
 *
 * This file still carries the whole staged procedure workspace it was written
 * as — the pre-anaesthesia documents, the colonoscopy and EGD reports, the
 * recovery stage. That arrangement lost its review to the seven-step run at
 * `encounter.html`, and the run is now the only procedure screen. What was
 * still wanted from this file was its OTHER half: the clinic visit, one
 * clinician and one note, which the run has no mode for.
 *
 * So the stages stay in the source and stop being reachable. A procedure that
 * arrives here — a stale link, a bookmark, a hand-typed address — is sent to
 * the run rather than shown a second procedure workspace that nobody is
 * maintaining and that would quietly disagree with the first.
 *
 * This cannot ping-pong with the gate at the top of js/screens/encounter.js:
 * that one forwards bookings where `isProcedure` is FALSE, this one forwards
 * bookings where it is TRUE, and the two read the same expression off the same
 * booking. Every appointment matches exactly one of them, and a booking that
 * matches neither is one with no appointment at all, which neither forwards.
 */
if (appointment && isProcedure) {
  window.location.replace(`encounter.html?appt=${encodeURIComponent(appointment.id)}`);
}

/** Every exam row starts normal — the desk unticks what is not. */
const examRowKeys = () =>
  EXAM_SYSTEMS.flatMap((group) => group.rows.map((row) => `${group.system}|${row.label}`));

const state = {
  /*
   * V2: WHICH FIELDS HOLD WORDS THE SCRIBE DRAFTED.
   *
   * Field keys, not section ids, because that is the grain at which text was
   * accepted: a clinician who copied the Plan and typed the Assessment
   * themselves should see the mark on one and not the other. Read by
   * visitNoteSectionHtml on every repaint — see the note there for why the
   * record has to carry this at all.
   */
  scribeFilled: new Set(),

  /* --- Stage --- */
  stage: isProcedure ? 'pre' : 'intra',
  preDoc: landOn,

  /* --- In-procedure: which document is showing beside the report --- */
  intraTab: 'report',
  reportType: 'colonoscopy',

  /*
   * --- The clinic visit note ---
   *
   * A clinic visit produces one note, on one template, and the template is not
   * a label: it decides which questions the note asks. Which one it opens on is
   * read off the BOOKING rather than defaulted, because the front desk already
   * chose — an appointment booked as a consultation is a consultation, and
   * asking the clinician to pick that a second time is asking them to agree
   * with the schedule or accidentally disagree with it.
   *
   * `values` is keyed by field key across the whole template. Switching
   * template keeps it: the templates share keys on purpose (every one of them
   * calls the plan `plan`), so a note started as a follow-up and re-templated
   * as a consultation carries its prose across instead of silently emptying
   * itself, which is the behaviour that teaches people never to touch the
   * picker.
   */
  visitNote: {
    template: noteTypeFor(appointment?.kind, typeById(appointment?.typeId)?.title ?? ''),
    values: {},
    /* Seeded from the booking, because signing sends the clinician to the
       summary and coming back is a fresh page load. A note filed a minute ago
       that reopens here as an unsigned draft is the same note in two states,
       and the editable one is the dangerous half of that pair. */
    signed: Boolean(appointment?.noteSignedBy),
    signedBy: appointment?.noteSignedBy ?? '',
    signedDate: appointment?.noteSignedOn ?? '',
    signedTime: appointment?.noteSignedAt ?? '',
  },

  /*
   * --- V2: THE BLOCKS THIS NOTE HAS HAD ADDED TO IT ---
   *
   * Neither of these is part of any template, and that is the point of them.
   * A review of systems and a body map are things a clinician reaches for
   * DURING a consultation, when the history turns out to need them — which is
   * exactly the moment a template cannot have predicted. So the note carries
   * an empty slot for each, and the tool row under the Plan fills it.
   *
   * `added` is separate from whether there is anything in the block, because
   * the two mean different things. A ROS with every system still unanswered is
   * a ROS the clinician has begun and not finished, and a note that silently
   * dropped it on the next repaint because it held no answers yet would be
   * throwing away the decision to ask.
   */
  extras: {
    ros: {
      added: false,
      /* Keyed by system id, holding one of ROS_ANSWERS. Absent means the
         question has not been answered — which is NOT the same as "Not
         examined", and is why that third answer has to be sayable. */
      answers: {},
      detail: '',
    },
    bodyMap: {
      added: false,
      mapId: 'abdomen',
      /* Each mark is { x, y, label }, x and y being fractions of the diagram's
         viewBox — see js/lib/body-diagram.js for why fractions. */
      marks: [],
    },
  },

  /*
   * --- What the Plan commits to, beside the prose that describes it ---
   *
   * The Plan of a visit note has always been the section somebody ACTS on
   * afterwards, and until now acting on it meant reading the paragraph and
   * going somewhere else to do the thing: the chart's Orders tab for a lab,
   * the Recalls worklist for a follow-up. Both of those are a different
   * screen, which means both of them happen later or not at all — and a plan
   * whose orders live only in prose is a plan that produces nothing a system
   * can chase.
   *
   * So the Plan carries the two commitments as records rather than sentences.
   * They are STAGED here and filed on signature, never before: a draft note is
   * a clinician thinking, and a half-written plan that has already sent a
   * colonoscopy order to the ASC is worse than one that sent nothing. The
   * signature is what turns the document into the record, and it is what turns
   * these into orders too. See filePlanCommitments().
   */
  plan: {
    /* Staged orders, in the order they were raised. Each carries its own
       `kind` — 'lab', 'egd' or 'colonoscopy' — because the two scopes are one
       record shape but two different things to ask about. */
    orders: [],

    /*
     * The recall this note will write.
     *
     * `dueFor` empty means no recall, and that is the only way to say so —
     * there is no separate "no recall" tick, because a tick and an empty
     * picker would be two ways of saying one thing that can disagree.
     *
     * `intervalTouched` is what stops the note overwriting a deliberate
     * choice. The interval is normally derived from the Plan's own follow-up
     * field, and re-derived whenever that changes; once somebody has set it by
     * hand — a three-year surveillance recall off a note whose clinic
     * follow-up is six months — the derivation stops, or the next keystroke in
     * the Plan would throw their answer away.
     */
    recall: { dueFor: '', interval: '', intervalTouched: false },

    /*
     * Whether this visit's plan has already been filed.
     *
     * Carried on the booking rather than in memory because the booking
     * outlives the page: the note is reopened from the worklist as a fresh
     * load, with the Plan's orders read back out of the store. Without it, a
     * signed note that somehow reached a second signature — a reload, a route
     * a later change adds back — would raise every order on its Plan again,
     * and the clinician correcting a typo in the Assessment would book two
     * colonoscopies.
     */
    filed: Boolean(appointment?.planFiled),
  },

  /* --- In-procedure: the colonoscopy report --- */
  template: REPORT_TEMPLATE,
  findings: [],
  tokens: new Map(NARRATIVE_TOKENS.map((t) => [t.token, t.value])),
  cleaned: false,
  signed: false,
  signedBy: '',
  signedDate: '',
  signedTime: '',
  exam: {
    normal: new Set(examRowKeys()),
    detail: new Map(),
    flags: new Set(),
    time: '08:47',
  },

  /* --- In-procedure: Pre-procedure H&P ---
     indicationCodes holds the attached diagnoses: {icd, cpts: []} per row —
     many diagnoses, and many CPT codes billed under each one. See
     indicationCodesHtml — the EGD and colonoscopy reports carry the same
     list, under the same widget. --- */
  hp: { ...HP_DEFAULTS, indication: '', indicationCodes: [] },
  hpSign: { signed: false, signedBy: '', signedDate: '', signedTime: '' },

  /* --- In-procedure: Orders --- */
  orders: { sedationType: SEDATION_TYPES[0], additionalMeds: '' },
  ordersSign: { signed: false, signedBy: '', signedDate: '', signedTime: '' },

  /* --- In-procedure: EGD report --- */
  egd: {
    proceduresPerformed: new Set(),
    modifiers: new Set(),
    indication: '',
    indicationCodes: [],
    details: Object.fromEntries(EGD_PROCEDURE_DETAILS.map((f) => [f.id, ''])),
    bloodLoss: EGD_BLOOD_LOSS_OPTIONS[0],
    estimatedAmount: '',
    complications: EGD_DEFAULT_COMPLICATIONS,
    findings: [],
    biopsies: [],
    impression: '',
    recommendations: new Set(),
    repeatProcedure: false,
    repeatValue: '1',
    repeatUnit: EGD_REPEAT_UNITS[0],
    customRecommendations: [],
    photos: [],
  },
  egdSign: { signed: false, signedBy: '', signedDate: '', signedTime: '' },

  /* --- In-procedure: colonoscopy report — structured fields alongside the
     narrative above. The narrative/findings mechanic is the report of
     record; these are the same per-visit charting fields the EGD report
     collects, specialised for a colonoscopy. --- */
  csc: {
    proceduresPerformed: new Set(),
    modifiers: new Set(),
    indication: '',
    indicationCodes: [],
    bowelPrepType: COLONOSCOPY_BOWEL_PREP_TYPES[0],
    bowelPrepQuality: '',
    details: Object.fromEntries(COLONOSCOPY_PROCEDURE_DETAILS.map((f) => [f.id, ''])),
    bloodLoss: EGD_BLOOD_LOSS_OPTIONS[0],
    estimatedAmount: '',
    complications: COLONOSCOPY_DEFAULT_COMPLICATIONS,
    biopsies: [],
    recommendations: new Set(),
    repeatProcedure: false,
    repeatValue: '1',
    repeatUnit: EGD_REPEAT_UNITS[0],
    customRecommendations: [],
    photos: [],
  },

  /* --- Pre-procedure --- */
  /* Step 1 is the bay's pre-procedure sheet (js/lib/pre-check-form.js). Its
     answers live here rather than inside the sheet, because the sheet is
     re-mounted every time the pre body repaints. `preCheckOutstanding` is what
     the sheet last reported as unanswered — the strip, the footer hint and the
     stage locks all read it. */
  preCheckValues: appointment?.preCheck ?? null,
  /* Seeded from the record, not left empty: a case can land straight on
     anaesthesia management without step 1 ever being painted, and the stage
     locks have to be right before the sheet has been on screen. */
  preCheckOutstanding: preCheckOutstanding(appointment?.preCheck ?? null),

  /* The nurse's sign-off on the stage as a whole, once all four are done. */
  preSignedBy: '',
  preSignedTime: '',
  preSignedDate: '',

  /* The Anesthesia Procedure Note, both halves. Steps 2 and 3 are two sittings
     at one document, so they read and write one object rather than two that
     could drift. `doc` is which of the step's three tabs is showing — the
     note, the consent form, or the orders. */
  anaesthesia: {
    doc: 'note',

    /* The consent form's two signatures, kept apart because they are different
       kinds of thing: a captured mark from the patient, an attestation from the
       clinician. Either can be present without the other, and the form is only
       filed when both are. */
    consent: { patient: null, provider: null, filed: false },

    type: ANAESTHESIA_TYPES[0],
    indication: ANAESTHESIA_INDICATION,
    airway: new Map(AIRWAY_FIELDS.map((f) => [f.id, f.value])),
    /* What "Other" actually was, for the two rows that can be answered that
       way. Kept beside the airway rather than in it: the answer is still
       Normal-or-Other, and the description is what follows from it. */
    airwayOther: new Map(AIRWAY_FIELDS.filter((f) => f.other).map((f) => [f.id, ''])),
    checks: new Set(
      [...ANAESTHESIA_NOTE_CHECKS, ...ANAESTHESIA_CHECKS].filter((c) => c.done).map((c) => c.id)
    ),
    start: ANAESTHESIA_TIMES.start,
    stop: ANAESTHESIA_TIMES.stop,
    complication: false,
    complicationDetail: '',
    postAssessment: false,
  },
  vitals: VITALS_LOG.map((v) => ({ ...v })),
  /* The pre-sedation assessment. Sets rather than objects: each of these is
     "which of these did the nurse answer yes to", and a Set says that without
     a key per question that has to be kept in step with the data file. */
  meds: MEDICATION_LOG.map((m) => ({ ...m })),
  // A mutable seed, same idea as vitals/meds above — the quick-select
  // formulary can grow at runtime without touching the demo import.
  formulary: SEDATION_FORMULARY.map((d) => ({ ...d })),
  solutions: IV_SOLUTIONS.map((s) => ({ ...s })),
  oxygen: OXYGEN_LOG.map((o) => ({ ...o })),

  /* --- Aldrete score: scored in both Anaesthesia management and
     Post-procedure against this same Map, so the two never diverge. The
     history log is separate — a timestamped record of each reassessment,
     which recovery repeats over time rather than answering once. --- */
  aldrete: new Map(ALDRETE_CATEGORIES.map((c) => [c.id, c.value])),
  aldreteHistory: [],

  /* --- In-procedure: the nursing record ---------------------------------
     The three stamps the nurse takes in the room, in the order they can be
     taken. Each is empty until pressed, and each gates the next: a cecum time
     before a time out is not a correction, it is a typo nobody can spot later.
     Withdrawal is never stored — it is cecum→end, worked out on the way past,
     so it cannot disagree with the two stamps it comes from. --- */
  nursingTimes: { timeOut: '', cecum: '', endOfProcedure: '' },

  /* The vitals entry form, kept out of the log it writes into. `editing` is
     the index of the reading being corrected, or null for a new one. */
  vitalsDraft: { phase: '', systolic: '', diastolic: '', hr: '', spo2: '', resp: '', pain: '', ramsay: '' },
  vitalsEditing: null,

  /* The Aldrete entry form. Separate from state.aldrete, which holds the
     CURRENT score the post-procedure document and the discharge gate read:
     this is the assessment being written, and it lands in both the log and
     state.aldrete once recorded, so a third view cannot drift from the two. */
  aldreteDraft: { phase: '', scores: new Map() },
  aldreteInitialsConfirmed: false,

  /* The medication entry form and its own initials confirmation — signing for
     a drug is a separate act from signing for a score, and one click must not
     stand for both. */
  medDraft: { time: '', name: '', dose: '', route: 'IV', notes: '' },
  medInitialsConfirmed: false,

  /* The IV and oxygen panels each have two faces — what is running, and the
     form that starts one. `open` says which is showing. The form replaces the
     card rather than covering the page, so the history beside it stays
     readable while a nurse fills it in. */
  ivFormOpen: false,
  ivDraft: { type: '', volume: '', rate: '', notes: '' },
  ivInitialsConfirmed: false,

  o2FormOpen: false,
  o2Draft: { time: '', flow: '', delivery: '', notes: '' },
  o2InitialsConfirmed: false,

  /* Stamped on every entry the nursing record takes, so the discharge panel
     can say when it was last touched rather than when the page was opened. */
  nursingUpdatedAt: stampNow(),

  /* --- Post-procedure --- */
  criteria: new Set(DISCHARGE_CRITERIA.filter((c) => c.done).map((c) => c.id)),
  discharge: { ...DISCHARGE_DEFAULTS, ready: true, done: Boolean(appointment?.encounterLocked) },
  complication: { occurred: false, type: '', detail: '' },

  /* --- Encounter lock: set once all three documents are signed ---
     A procedure's lock only. The banner it raises speaks about three signed
     documents and a superbill in Billing, none of which a clinic visit has —
     a signed clinic note is locked by its own signature, said by the toolbar
     badge and the disabled fields, not by a procedure's banner. */
  locked: isProcedure && Boolean(appointment?.encounterLocked),
  superbillId: appointment?.superbillId ?? null,
};

/** Write both the attribute and the live control — ui-textarea has no setter. */
function setValue(node, value) {
  if (!node) return;
  const next = value ?? '';
  node.setAttribute('value', next);
  const control = node.querySelector('input, select, textarea');
  if (control) control.value = next;
}

/** Fill a <ui-select> from a list of plain strings. */
function options(id, list, value) {
  const node = el(id);
  if (!node) return;
  node.optionList = list.map((v) => ({ value: v, label: v }));
  setValue(node, value);
}

/* ===================== Diagnostic indication: ICD-10 → CPT =====================
   Attaching a diagnosis is two decisions, not one line of prose: which ICD-10
   codes the visit is coded to, and which CPT codes each of those diagnoses is
   billed under. Typed free text could carry neither — an indication that reads
   "reflux" is not a code anything can be claimed against — so the ICD is
   picked from the catalogue and every attached diagnosis owns a list of CPTs.

   BOTH SIDES ARE LISTS, AND THEY NEST
   A visit routinely carries more than one diagnosis, and one diagnosis is
   routinely billed under more than one CPT: a screening colonoscopy that finds
   a polyp is one indication claimed as both the diagnostic scope and the snare
   removal. A single CPT per diagnosis would force the coder to attach the same
   ICD twice to say that, which reads as two diagnoses and codes as a duplicate.
   So the shape is many diagnoses, each owning many procedure codes.

   Three places in the note attach a diagnosis: the pre-procedure H&P, the EGD
   report and the colonoscopy report. They share this one widget, so a code
   attached in one reads and behaves exactly like a code attached in another.
   -------------------------------------------------------------------------- */

const ICD_OPTIONS = ICD10.map((d) => ({ value: d.code, label: `${d.code} — ${d.text}` }));

/** The practice's own CPT master, minus the codes it has retired. */
const CPT_OPTIONS = CPT_CODES.filter((c) => c.active).map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.description}`,
}));

const icdText = (code) => ICD10.find((d) => d.code === code)?.text ?? '';
const cptText = (code) => CPT_CODES.find((c) => c.code === code)?.description ?? '';

/** Bookings made before the CPT became a list carry a single `cpt` string.
 *  Read through this rather than off the row, so an older draft still opens. */
const cptsOf = (row) => row.cpts ?? (row.cpt ? [row.cpt] : []);

/**
 * What one diagnosis can still be billed under.
 *
 * Codes already attached to THIS diagnosis are left out rather than offered
 * and then refused: the same CPT twice under one ICD is a duplicate claim
 * line, and a picker that cannot produce one needs no warning to explain it.
 * The same CPT under a DIFFERENT diagnosis is ordinary, so the filter is
 * per-row.
 */
const cptOptionsFor = (row) => {
  const taken = new Set(cptsOf(row));
  return CPT_OPTIONS.filter((option) => !taken.has(option.value));
};

/** The CPT codes billed under one diagnosis, and the control that adds another. */
function cptBlockHtml(row, i, testid) {
  const cpts = cptsOf(row);
  const icd = esc(row.icd);

  const list = cpts.length
    ? `<ul class="enc__cpt-list">
        ${cpts
          .map(
            (code, c) => `<li class="enc__cpt" data-cpt-row="${c}">
              <code>${esc(code)}</code>
              <span class="enc__cpt-text">${esc(cptText(code))}</span>
              <button type="button" class="enc__code-drop" data-drop-cpt="${i}"
                data-cpt-index="${c}" aria-label="Remove CPT ${esc(code)} from ${icd}"
                data-testid="${testid}-cpt-drop-${icd}-${esc(code)}">×</button>
            </li>`
          )
          .join('')}
      </ul>`
    : `<p class="enc__cpt-empty" data-testid="${testid}-cpt-empty-${icd}">
         No CPT code yet — this diagnosis is not billable until one is attached.
       </p>`;

  // Nothing left to offer. Saying so beats an empty select that looks broken.
  const add = cptOptionsFor(row).length
    ? `<div class="enc__cpt-add">
        <ui-select data-cpt="${i}" label="CPT code for ${icd}" label-hidden
          size="sm" placeholder="Select CPT code"
          data-testid="${testid}-cpt-${icd}"></ui-select>
        <ui-button variant="outline" size="sm" data-add-cpt="${i}"
          data-testid="${testid}-cpt-add-${icd}">Add CPT</ui-button>
      </div>`
    : `<p class="enc__cpt-empty">Every active CPT code is already attached to ${icd}.</p>`;

  return `${list}${add}`;
}

/**
 * The picker, plus a block per attached diagnosis.
 *
 * `prefix` namespaces the two top-level control ids (hp/egd/csc) and `testid`
 * the data-testids, so three copies of this can be on the page without
 * colliding. Inside a block, the per-row controls are addressed by index and
 * found under the host — there is no id to collide in the first place.
 */
function indicationCodesHtml(prefix, rows, testid) {
  const attached = rows.length
    ? rows
        .map(
          (row, i) => `<div class="enc__code-row" data-code-row="${i}">
            <div class="enc__code-head">
              <span class="enc__code-icd">
                <code>${esc(row.icd)}</code>
                <span class="enc__code-text">${esc(icdText(row.icd))}</span>
              </span>
              <button type="button" class="enc__code-drop" data-drop-code="${i}"
                aria-label="Remove ${esc(row.icd)}"
                data-testid="${testid}-drop-${esc(row.icd)}">×</button>
            </div>
            ${cptBlockHtml(row, i, testid)}
          </div>`
        )
        .join('')
    : `<p class="enc__code-empty">No diagnosis attached yet.</p>`;

  return `<div class="enc__codes" data-testid="${testid}">
    <div class="enc__code-add">
      <ui-select id="${prefix}IcdPick" label="Attach diagnosis (ICD-10)" size="sm"
        placeholder="Select ICD-10 code" data-testid="${testid}-pick"></ui-select>
      <ui-button variant="outline" size="sm" id="${prefix}IcdAdd"
        data-testid="${testid}-add">Attach</ui-button>
    </div>
    <div class="enc__code-list">${attached}</div>
  </div>`;
}

/**
 * Wire one instance.
 *
 * `host` is the container the rows were painted into — the row controls are
 * found under it rather than by id, because there are three of these on the
 * page and the rows are rebuilt on every repaint.
 */
function wireIndicationCodes(prefix, rows, host, repaint) {
  const pick = el(`${prefix}IcdPick`);
  if (!pick || !host) return;
  pick.optionList = ICD_OPTIONS;

  el(`${prefix}IcdAdd`)?.addEventListener('ui-click', () => {
    const code = pick.value;
    if (!code) {
      notify('Choose an ICD-10 code to attach.', 'warning');
      return;
    }
    // The same diagnosis twice is a coding error, not two diagnoses — a second
    // procedure on the same diagnosis is a second CPT under the row that is
    // already there.
    if (rows.some((r) => r.icd === code)) {
      notify(`${code} is already attached. Add another CPT code under it instead.`, 'warning');
      return;
    }
    rows.push({ icd: code, cpts: [] });
    repaint();
  });

  // Each diagnosis offers only what it is not already billed under.
  host.querySelectorAll('[data-cpt]').forEach((select) => {
    select.optionList = cptOptionsFor(rows[Number(select.dataset.cpt)]);
  });

  host.querySelectorAll('[data-add-cpt]').forEach((button) =>
    button.addEventListener('ui-click', () => {
      const index = Number(button.dataset.addCpt);
      const row = rows[index];
      const code = host.querySelector(`[data-cpt="${index}"]`)?.value;
      if (!code) {
        notify(`Choose a CPT code to bill ${row.icd} under.`, 'warning');
        return;
      }
      row.cpts = [...cptsOf(row), code];
      repaint();
    })
  );

  host.querySelectorAll('[data-drop-cpt]').forEach((button) =>
    button.addEventListener('click', () => {
      const row = rows[Number(button.dataset.dropCpt)];
      row.cpts = cptsOf(row).filter((_, c) => c !== Number(button.dataset.cptIndex));
      repaint();
    })
  );

  // Dropping the diagnosis takes its CPT codes with it: they were only ever
  // the procedures billed against this indication.
  host.querySelectorAll('[data-drop-code]').forEach((button) =>
    button.addEventListener('click', () => {
      rows.splice(Number(button.dataset.dropCode), 1);
      repaint();
    })
  );
}

/* ===================== Findings → prose ===================== */

function narratePolyp(f) {
  const size =
    f.sizeFrom && f.sizeTo && f.sizeFrom !== f.sizeTo
      ? `ranging in size from ${f.sizeFrom} ${f.unit} to ${f.sizeTo} ${f.unit}`
      : `${f.sizeFrom || f.sizeTo} ${f.unit}`;
  const bleeding = f.bleeding === 'no' ? 'non-bleeding ' : '';
  const distance = f.distance ? ` at ${f.distance} cm from the anus` : '';
  const plural = Number(f.count) > 1;

  const found =
    `${plural ? `${f.count} ${bleeding}${f.pedicle} polyps` : `A single ${bleeding}${f.pedicle} polyp`} ` +
    `of ${f.appearance} appearance, ${size}, ${plural ? 'were' : 'was'} found in the ` +
    `${f.site}${distance}.`;

  const removal =
    f.intervention && f.intervention !== 'No intervention'
      ? ` ${f.intervention} was performed. The polyp was completely removed.`
      : '';

  return `${found}${removal}${f.notes ? ` ${f.notes}` : ''}`;
}

function impressPolyp(f) {
  const size =
    f.sizeFrom && f.sizeTo && f.sizeFrom !== f.sizeTo
      ? `${f.sizeFrom} ${f.unit} and ${f.sizeTo} ${f.unit}`
      : `${f.sizeFrom || f.sizeTo} ${f.unit}`;
  const removed =
    f.intervention && f.intervention !== 'No intervention' ? ' Polypectomy performed.' : '';
  return `${f.count} polyp${Number(f.count) > 1 ? 's' : ''} (${size}) in the ${f.site}.${removed}`;
}

const findingText = (f) =>
  f.kind === 'polyp' ? narratePolyp(f) : SIMPLE_FINDING_TEXT[f.id] ?? '';
const findingImpression = (f) =>
  f.kind === 'polyp' ? impressPolyp(f) : SIMPLE_FINDING_IMPRESSION[f.id] ?? '';

/* ===================== Left: the patient ===================== */

function paintPatient() {
  paintPatientCard({
    host: el('patientCard'),
    patient,
    provider: providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist,
    testid: 'enc--patient',
  });
}

/* ===================== Right rail: the clinical picture ===================== */

/*
 * The standing clinical picture, on the right, drawn by the component the
 * procedure encounter uses — js/lib/clinical-rail.js.
 *
 * WHERE IT WAS, AND WHY IT MOVED.
 * It was a panel under the patient card in the LEFT rail, with its own markup
 * and its own styling: sections with a count and a caret, rows with a coloured
 * dot, and a pair of hover actions — "Copy to note" and "View more" — on each
 * heading. The step run's rail renders the same fourteen sections a different
 * way: numbered rows, the severity spelled out in words beside the dot, and a
 * copy that puts the list on the clipboard.
 *
 * Two renderings of one patient's allergy list is two answers to a question
 * that has one, and they had already drifted — a clinician moving between a
 * clinic morning and a procedure list read the same record twice in two
 * different shapes. So this screen mounts the step run's rail rather than
 * keeping a second version of it, in the same column, folded the same way, with
 * the same controls on it.
 *
 * WHAT WENT WITH THE OLD PANEL. "Copy to note" wrote a section into whichever
 * prose field was last focused, and "View more" said the full record view is
 * not built. The shared rail copies to the clipboard instead — which is what
 * the step run does, because its centre column is whichever document the step
 * is up to and there is no one note to write into. One rail whose buttons mean
 * one thing is worth more than a rail that means something different depending
 * on which encounter you opened it from.
 */

/* ===================== Header and alerts ===================== */

function paintHeader() {
  const label = appointment?.procedureId
    ? procedureById(appointment.procedureId)?.title
    : typeById(appointment?.typeId)?.title;

  el('encounterMeta').textContent = appointment
    ? `${label} · ${providerById(appointment.providerId)?.name} · ${
        appointment.location || appointment.area || 'MediNova Gastroenterology'
      } · ${shortDate(appointment.date)}`
    : `Colonoscopy · ${REPORT_STAFF.endoscopist} · MediNova Gastroenterology`;

  /*
   * The picker offers the templates of whichever document is open.
   *
   * A procedure picks between report templates — the choice rewrites the
   * narrative. A clinic visit picks between NOTE templates, which is a
   * different question with a different list behind it, and offering
   * "Colonoscopy — screening" on a New Patient consultation was the visible
   * end of the screen rendering one document for every template it named.
   */
  if (isProcedure) {
    options('reportTemplate', REPORT_TEMPLATES.map((t) => t.title), state.template);
  } else {
    options('reportTemplate', VISIT_NOTE_TITLES, state.visitNote.template);
  }

  /* Procedure and endoscopist only. Payer and prior auth used to sit here too,
     and they were the wrong two facts for a header that is read mid-procedure:
     cover is a front-desk question, settled before anybody scrubbed in, and it
     is still on the patient card in the left rail for whoever needs it. What
     is left is what the header is for — what is being done, and by whom. */
  const facts = [
    ['Procedure', label ?? 'Colonoscopy'],
    ['Endoscopist', providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist],
  ];

  el('encounterFacts').innerHTML = facts
    .map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`)
    .join('');
}

/* ===================== Stages ===================== */

/**
 * The badge on each stage tab.
 *
 * It answers "where is this visit up to" without opening anything, which is
 * the question asked from the corridor.
 */
function stageBadge(id) {
  if (id === 'pre') {
    const signed = PRE_DOCUMENTS.filter((d) => preDocTone(d).tone === 'signed').length;
    return `${signed} of ${PRE_DOCUMENTS.length} signed`;
  }
  if (id === 'intra') return state.signed ? 'signed' : 'in progress';
  return state.discharge.done ? 'discharged' : 'not started';
}

/* ---------------------------------------------------------------------------
   ALL THREE STAGES ARE REACHABLE, ALWAYS.

   They were gated for a while — In-procedure shut until the nurse had signed
   Pre-anaesthesia off, Post-procedure shut until the report was signed — on
   the grounds that the record is only true if it was made in order.

   That is still true of the RECORD, and it is still enforced where it counts:
   each document refuses its own signature until it is complete, the stage
   refuses its sign-off until all four are done, and the footer's commit walks
   the run in order. What the tabs no longer do is stop anyone LOOKING. Three
   different people work this screen at once — the anaesthetist fills the plan
   while the nurse is still on the checklist, and the endoscopist wants the
   report open before the scope goes in — and a tab that will not open is a
   room where nobody can see what anyone else is doing.
   -------------------------------------------------------------------------- */

function paintStages() {
  /*
   * The progress count is the tab's accessible name, not a visible chip.
   *
   * Three tabs plus three badges do not fit the 20rem sidebar — they were
   * clipped, and "Post-procedure" fell off the end entirely, which is worse
   * than not showing a count. The count still reaches a screen reader, and
   * the footer hint states the same thing in words for everyone else.
   */
  el('stageTabs').innerHTML = ENCOUNTER_STAGES.map(
    (stage) => `<button type="button" class="enc__stage-tab" role="tab"
      aria-selected="${stage.id === state.stage}" aria-controls="stage-${stage.id}"
      aria-label="${esc(stage.label)} — ${esc(stageBadge(stage.id))}"
      title="${esc(stageBadge(stage.id))}"
      data-stage="${stage.id}" data-testid="enc--stage-tab-${stage.id}">
      ${esc(stage.label)}
    </button>`
  ).join('');

  el('stageTabs').querySelectorAll('[data-stage]').forEach((tab) =>
    tab.addEventListener('click', () => showStage(tab.dataset.stage))
  );
}

function showStage(id) {
  state.stage = id;
  ENCOUNTER_STAGES.forEach((stage) => {
    el(`stage-${stage.id}`).hidden = stage.id !== id;
  });
  paintStages();
  if (id === 'pre') paintPre();
  if (id === 'intra') paintIntra();
  if (id === 'post') paintPost();
  updateHint();
}

/* ===================== Small render helpers ===================== */

const card = (title, body, actions = '', testid = '') => `
  <section class="enc__panel-card"${testid ? ` data-testid="${testid}"` : ''}>
    <header class="enc__panel-head">
      <h2 class="enc__panel-title">${title}</h2>
      ${actions ? `<div class="enc__panel-actions">${actions}</div>` : ''}
    </header>
    <div class="enc__panel-body">${body}</div>
  </section>`;

const legend = (text) => `<h3 class="enc__legend">${esc(text)}</h3>`;

/** A log table, or a line saying there is nothing in it yet. */
function logTable(headers, rows, empty) {
  if (!rows.length) return `<p class="enc__empty">${esc(empty)}</p>`;
  return `<table class="enc__log">
    <thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

/* ===================== Pre-procedure ===================== */

/**
 * The live tone/status/time for a pre-procedure document, standing in for
 * the static demo values in PRE_DOCUMENTS wherever a document now has a real
 * interactive sign state. Used for both the card badges and the stage-badge
 * / lock-gate counts, so the two can never disagree about what is signed.
 *
 * Anaesthesia management never terminates in a signed state — it is a
 * running log, not a document — so it keeps its static entry as-is.
 */
function preDocTone(doc) {
  if (doc.id === 'checklist') {
    const outstanding = state.preCheckOutstanding.length;
    return outstanding
      ? { tone: 'recording', status: `${outstanding} outstanding`, time: '' }
      : { tone: 'signed', status: 'Complete', time: '' };
  }
  if (doc.id === 'preanaesthesia') {
    /* No signature of its own — the nurse's Save & Sign at the end signs and
       locks the whole note, so the note's front half is done when the three
       statements on it have all been made. */
    const outstanding = noteChecksOutstanding().length;
    return outstanding
      ? { tone: 'recording', status: `${outstanding} outstanding`, time: '' }
      : { tone: 'signed', status: 'Complete', time: '' };
  }
  if (doc.id === 'report') {
    // No signature of its own either — complete when the three facts that can
    // only be known after the case are recorded.
    return reportOutstanding()
      ? { tone: 'recording', status: 'Pending', time: '' }
      : { tone: 'signed', status: 'Complete', time: '' };
  }
  return { tone: doc.tone, status: doc.status, time: doc.time };
}

/**
 * Whether every one of the four documents has been carried as far as it goes.
 *
 * Management is the exception and always will be: it is a running log kept
 * during the case, not a document that terminates in a signature, so "done"
 * for it means the case has moved past it rather than that anybody signed it.
 */
function preStepsComplete() {
  const checklistDone = state.preCheckOutstanding.length === 0;
  return checklistDone && !noteChecksOutstanding().length && !reportOutstanding();
}

/**
 * The statements on the note's front half that have not been made yet.
 *
 * Three lines across two cards — the chart review on the note's cover, and the
 * consent and NPO statements that close the assessment — and they are counted
 * together because they are one document's worth of claims. The step chip, the
 * card's own warning and the footer hint all read from here, so none of them
 * can hold a different idea of what is left.
 */
function noteChecksOutstanding() {
  return [...ANAESTHESIA_NOTE_CHECKS, ...ANAESTHESIA_CHECKS].filter(
    (c) => !state.anaesthesia.checks.has(c.id)
  );
}

/**
 * All four pre-anaesthesia documents, as a numbered run.
 *
 * They are numbered because that is the order they are worked: the nurse
 * verifies the patient, the endoscopist attests they are fit to proceed, the
 * anaesthetist writes the post-anaesthesia report, and the running record kept
 * through the case is closed off last. The numbering is guidance, not a gate —
 * every step opens on a click, so anyone can fill in their own document early
 * or look back at another at any point. Save & Proceed walks the run in order
 * for whoever wants to be walked.
 *
 * The checklist used to sit above this run as a one-line banner, on the
 * grounds that it was finished before anaesthesia started. It is a step like
 * the other three now: it is one of the four things this stage produces, and a
 * banner could not show it as one of four or count toward the sign-off.
 */
const PRE_STEPS = PRE_DOCUMENTS;

/**
 * The run, as four numbered names on one row.
 *
 * It carried the owner's name and a status pill per step, which made four
 * two-line cards across two rows — a block of chrome above the document
 * somebody actually came to fill in. Both facts are still on the screen where
 * they are worked: each document names its own author, and the sign-off band
 * below spells out what is still outstanding BY NAME, which is the thing a
 * status pill could only count.
 *
 * A finished step swaps its numeral for a tick. That is the one piece of state
 * the strip cannot do without — a run of steps with no notion of done is a tab
 * strip — and it costs no space and no second line.
 */
function preDocCards() {
  return PRE_STEPS.map((doc, index) => {
    const { tone, status } = preDocTone(doc);
    const current = doc.id === state.preDoc;
    const done = tone === 'signed';

    return `<button type="button" class="enc__step${current ? ' enc__step--on' : ''}${
      done ? ' enc__step--done' : ''
    }"
      role="tab" aria-selected="${current}" data-predoc="${doc.id}"
      data-testid="enc--predoc-${doc.id}">
      <span class="enc__step-num" aria-hidden="true">${
        done ? '<svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>' : index + 1
      }</span>
      <span class="enc__step-title">${esc(doc.title)}</span>
      <!-- The tick is decoration to a screen reader, so the state it stands
           for is said in words that are not on screen. -->
      <span class="u-sr-only">${esc(status)}</span>
    </button>`;
  }).join('');
}

/**
 * The nurse's sign-off, once the stage is closed.
 *
 * It used to be a standing band under the documents, present from the moment
 * the stage opened and mostly saying what was still outstanding — a permanent
 * fixture reporting an absence. The commit moved to the footer, where every
 * other commit in this screen lives, so what is left here is the receipt:
 * shown only after signing, and only on the document it locked.
 */
function preLockBannerHtml() {
  if (!state.preSignedBy) return '';
  return `<div class="enc__signoff enc__signoff--done" data-testid="enc--pre-signoff">
    <svg class="ui-icon" aria-hidden="true"><use href="#i-lock"></use></svg>
    <span class="enc__signoff-body">
      <span class="enc__signoff-title">Pre-anaesthesia signed and locked</span>
      <span class="enc__signoff-note">Signed by ${esc(state.preSignedBy)} at
        <code>${esc(state.preSignedTime)}</code>. In-procedure is open.</span>
    </span>
    <span class="enc__spacer"></span>
    <ui-button variant="outline" size="sm" id="preUnlock" data-lock-exempt
      data-testid="enc--pre-unlock">Unlock to amend</ui-button>
  </div>`;
}

/**
 * The tab strip the Anesthesia Procedure Note sits behind.
 *
 * Two documents, and only one of them is built here: the consent form was
 * signed at check-in and is not re-collected in the room, so its tab reports
 * that rather than opening an empty form. It is still a tab and not a button,
 * because on the day the question is "where is the consent" — and the answer
 * has to be somewhere you would look for a document.
 */
function anaesthesiaDocTabs(step) {
  return `<div class="enc__doc-bar">
    <div class="enc__exam-tabs enc__exam-tabs--pill" role="tablist"
      aria-label="Anesthesia documents" data-testid="enc--a-doc-tabs">
      ${ANAESTHESIA_DOCUMENTS.map(
        (doc) => `<button type="button" class="enc__exam-tab" role="tab"
          aria-selected="${doc.id === state.anaesthesia.doc}" data-anesdoc="${doc.id}"
          data-testid="enc--a-doc-${doc.id}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-${doc.icon}"></use></svg>
          ${esc(doc.label)}
        </button>`
      ).join('')}
    </div>
    ${anaesthesiaReadActions(step)}
  </div>`;
}

/**
 * The three ways to get the document onto paper.
 *
 * They sit level with the document tabs rather than at the foot of the note,
 * because they belong to whichever document the tabs are pointing at — and
 * because "where do I print this" is asked at the top of a long form, not
 * after scrolling to the end of one.
 *
 * All three are `data-lock-exempt`: they READ the document, and a signed note
 * is exactly the one somebody wants on paper. Only Update — the one that
 * writes — goes behind the signature.
 */
function anaesthesiaReadActions(step) {
  return `<div class="enc__doc-bar-actions">
    <ui-button variant="outline" size="sm" id="a${step}Print" data-lock-exempt
      data-testid="enc--a-${step}-print">Print</ui-button>
    <ui-button variant="outline" size="sm" id="a${step}DownloadPdf" data-lock-exempt
      data-testid="enc--a-${step}-download-pdf">Download</ui-button>
    <ui-button variant="outline" size="sm" id="a${step}ViewPdf" data-lock-exempt
      data-testid="enc--a-${step}-view-pdf">View</ui-button>
  </div>`;
}

/**
 * The document's own commit, which is not the encounter footer.
 *
 * The footer commits the STAGE — it walks the run and eventually signs the
 * whole pre-anaesthesia note. This one saves what has been typed into the
 * document in front of you without moving off the step.
 *
 * `reads` puts the print trio in this row instead of level with the tabs. Step
 * 3 has no tab strip to hang them off, so that is where they go there.
 */
function anaesthesiaDocActions(step, { reads = false } = {}) {
  return `<div class="enc__doc-actions">
    ${reads ? anaesthesiaReadActions(step) : ''}
    <ui-button variant="primary" size="sm" id="a${step}Update"
      data-testid="enc--a-${step}-update">Update Assessment</ui-button>
  </div>`;
}

/* ============================================================================
   THE ANAESTHESIA CONSENT FORM

   The second of the step's three documents. It was a notify() saying consent
   had been taken at check-in, which answered "where is it" but gave the room no
   way to take it — and anaesthesia consent is the CRNA's to take, after the
   risks conversation that happens here rather than at the desk.
   ========================================================================= */

/** When a signature was made, in words, for the caption under it. */
function signedStamp() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * A signature that has been taken — the mark, and who made it.
 *
 * The image is shown rather than a tick. "Signed electronically" is a claim
 * about something that happened; the signature is the evidence, and a consent
 * form that cannot produce it is not much of a record.
 */
function consentMarkHtml(mark, testid) {
  return `<figure class="enc__consent-mark" data-testid="${testid}">
    ${
      mark.dataUrl
        ? `<img src="${mark.dataUrl}" alt="Signature of ${esc(mark.name)}">`
        : ''
    }
    <figcaption>
      <strong>${esc(mark.name)}</strong>
      <span>${esc(mark.role ?? 'Patient')} · signed ${esc(mark.at)}</span>
    </figcaption>
  </figure>`;
}

function anaesthesiaConsentBody() {
  const c = state.anaesthesia.consent;
  const form = ANAESTHESIA_CONSENT;
  const bothSigned = Boolean(c.patient && c.provider);

  /* The consent names the technique it is consenting TO, read from the
     assessment rather than restated — two copies of the anaesthesia type is one
     that can disagree with the other. */
  const paragraphs = form.paragraphs
    .map(
      (p) =>
        `<p class="enc__consent-text">${esc(p).replace(
          '{type}',
          `<strong>${esc(state.anaesthesia.type)}</strong>`
        )}</p>`
    )
    .join('');

  const patientBlock = c.patient
    ? consentMarkHtml(c.patient, 'enc--a-consent-patient-mark')
    : `<ui-signature data-consent-pad heading="Patient Signature"
         signer="${esc(patient.name)}"
         data-testid="enc--a-consent-pad"></ui-signature>`;

  /* The provider signs on a pad, like the patient does and like the same
     provider does on the procedure run's copy of this consent.

     It used to be a press — a Confirm Electronic Signature button, on the
     argument that an identified clinician who is already signed in has nothing
     to prove by drawing a squiggle. The argument holds; what it cost was one
     consent form carrying two different ideas of what a signature is, one
     under each heading, and a reader of the filed document being able to tell
     which half was signed by whom from the shape of the control rather than
     from the name on it. The pad's Type Name route is the press, for a CRNA
     who does not want to draw: the name is already in the field, and Enter
     files it. */
  const providerBlock = c.provider
    ? consentMarkHtml(c.provider, 'enc--a-consent-provider-mark')
    : `<div class="enc__consent-provider">
         <p class="enc__consent-provider-name">
           <strong>${esc(form.provider.name)}</strong>
           <span>${esc(form.provider.role)}</span>
         </p>
       </div>
       <ui-signature data-consent-provider-pad heading="Anesthesia Provider Signature"
         signer="${esc(form.provider.name)}"
         data-testid="enc--a-consent-provider-pad"></ui-signature>`;

  return card(
    form.title,
    `${paragraphs}

    <section class="enc__consent-sig" data-testid="enc--a-consent-patient">
      ${legend(form.patientHeading)}
      <p class="enc__consent-hint">${esc(form.patientNote)}</p>
      ${patientBlock}
    </section>

    <section class="enc__consent-sig" data-testid="enc--a-consent-provider">
      ${legend(form.providerHeading)}
      <p class="enc__consent-hint">${esc(form.providerNote)}</p>
      ${providerBlock}
    </section>`,
    /* Disabled rather than absent: the button is what says the form is
       saveable, and a control that appears only once you are finished cannot
       tell you that you are not. */
    `<ui-button variant="primary" size="sm" id="aConsentSave"
       ${bothSigned && !c.filed ? '' : 'disabled data-own-disabled'}
       data-testid="enc--a-consent-save">Save Consent Form</ui-button>`,
    'enc--a-consent'
  );
}

/* ============================================================================
   ANAESTHESIA ORDERS

   The standing order set, opened at the pre-op sitting — the same document the
   endoscopist reads back on the In-procedure Orders tab, not a second one.
   See ORDER_SET_VIEWS below for why one document renders under two sets of ids.

   This tab used to be a three-field drug picker: a name, a dose and a route,
   typed per case into a table nothing downstream read. What is actually
   decided here is which sedation the patient is having and whether anything is
   ordered on top of the protocol set — and what went in on the day is charted
   on the management step's administration log, which is the record the
   recovery nurse and the billing pass both read. One drug is now recorded in
   one place instead of three.
   ========================================================================= */

function anaesthesiaOrdersBody() {
  return `${orderSetDocHtml(ORDER_SET_VIEWS.anaesthesia)}
  <div class="enc__doc-actions">
    <ui-button variant="tertiary" size="sm" id="aOrdersSetDefault"
      data-testid="enc--a-orders-set-default">Set Default</ui-button>
    <ui-button variant="tertiary" size="sm" id="aOrdersUseDefault"
      data-testid="enc--a-orders-use-default">Use Default</ui-button>
    <ui-button variant="primary" size="sm" id="aOrdersSave"
      data-testid="enc--a-orders-save">Save Orders</ui-button>
  </div>`;
}

/** The procedure this note is written against — the booking's, not a fixture's. */
function anaesthesiaProcedure() {
  return (
    (appointment?.procedureId ? procedureById(appointment.procedureId)?.title : '') ||
    typeById(appointment?.typeId)?.title ||
    PRE_ANAESTHESIA_PLAN.procedure
  );
}

/**
 * The front half of the Anesthesia Procedure Note — what is planned.
 *
 * Two cards, because the note is two things: a cover that says what this is
 * and that the chart behind it was read, and the assessment of the airway that
 * follows from it. Plan and airway sit HERE because both are decided before
 * the case; step 3 keeps what can only be written after it.
 */
function preAnaesthesiaBody() {
  const a = state.anaesthesia;

  /* The tab strip is the step's chrome and stays put; only what sits under it
     changes. The consent and the orders are documents in their own right, so
     each takes the whole body rather than appearing as another card below the
     note — a tab that adds to the page instead of replacing it is not a tab. */
  if (a.doc === 'consent') return `${anaesthesiaDocTabs('note')}${anaesthesiaConsentBody()}`;
  if (a.doc === 'orders') return `${anaesthesiaDocTabs('note')}${anaesthesiaOrdersBody()}`;

  /* No outstanding-statements notice on this card. What is still unticked is
     already visible — the boxes are right there, unticked — and the footer
     hint says what the stage is waiting on. A third telling of it was the
     same fact three times on one screen. `noteChecksOutstanding()` still
     drives the gate; only the banner is gone. */
  return `${anaesthesiaDocTabs('note')}
  ${card(
    'Anesthesia Procedure Note',
    /* Procedure is read-only: it is the booking, and a note that could
       disagree with the appointment it was written for is worse than one that
       cannot be edited here. Indication appears once, and only here — it used
       to be a read-only fact on one step and an editable field on the other,
       which is two places for one string to stop matching. */
    `<ui-input id="aProcedure" label="Procedure" readonly
      value="${esc(anaesthesiaProcedure())}" data-testid="enc--a-procedure"></ui-input>
    <ui-input id="aIndication" label="Indication"
      placeholder="Enter indication for procedure" data-testid="enc--a-indication"></ui-input>
    <div class="enc__checks enc__checks--stack">
      ${ANAESTHESIA_NOTE_CHECKS.map(
        (c) => `<ui-checkbox data-acheck="${c.id}" ${a.checks.has(c.id) ? 'checked' : ''}
          data-testid="enc--acheck-${c.id}">${esc(c.label)}</ui-checkbox>`
      ).join('')}
    </div>`,
    '',
    'enc--a-note'
  )}
  ${card(
    'Pre-Anesthesia Assessment',
    `<ui-select id="aType" label="Planned Anesthesia Type" data-testid="enc--a-type"></ui-select>
    <div class="enc__grid-2">
      ${AIRWAY_FIELDS.map(
        (f) => `<ui-radio-group inline label="${esc(f.label)}" data-airway="${f.id}"
          options="${esc(f.options.join(','))}" value="${esc(a.airway.get(f.id))}"
          data-testid="enc--airway-${f.id}"></ui-radio-group>`
      ).join('')}
    </div>
    ${/* Other, finished. Lungs and CV are the two rows that offer it, and Other
         on its own is a finding withheld — the row says this chest is not
         normal and then declines to say how. The field appears under the grid
         rather than inside it so answering one does not shunt the other onto a
         line of its own; it is emptied again if the answer goes back to
         Normal, because a description of a finding nobody is claiming any more
         would otherwise sit on the filed note. */ ''}
    ${AIRWAY_FIELDS.filter((f) => f.other && a.airway.get(f.id) === AIRWAY_OTHER)
      .map(
        (f) => `<ui-input data-airway-other="${f.id}" label="${esc(f.other.label)}"
          placeholder="${esc(f.other.placeholder)}" value="${esc(a.airwayOther.get(f.id) ?? '')}"
          data-testid="enc--airway-other-${f.id}"></ui-input>`
      )
      .join('')}
    <div class="enc__checks enc__checks--2">
      ${ANAESTHESIA_CHECKS.map(
        (c) => `<ui-checkbox data-acheck="${c.id}" ${a.checks.has(c.id) ? 'checked' : ''}
          data-testid="enc--acheck-${c.id}">${esc(c.label)}</ui-checkbox>`
      ).join('')}
    </div>`,
    /* Both act on the assessment's own fields — the type, the airway and the
       two statements below it — so they sit on that card rather than over the
       note as a whole. The chart-review line on the cover is deliberately out
       of their reach: a default that ticks "reviewed in EMR" would be the
       prototype making a claim on somebody's behalf. */
    `<ui-button variant="tertiary" size="sm" id="aSetDefault"
       data-testid="enc--a-set-default">Set Default</ui-button>
     <ui-button variant="tertiary" size="sm" id="aUseDefault"
       data-testid="enc--a-use-default">Use Default</ui-button>`,
    'enc--preanaesthesia'
  )}
  ${anaesthesiaDocActions('note')}`;
}

/**
 * The back half of the Anesthesia Procedure Note — what happened.
 *
 * Four cards, in the order the case produces them: the clock, the recovery
 * assessment, whether anything went wrong, and the signature over the note as
 * a whole. They render on step 3, which is the step named for them — step 2 is
 * what is planned before the case, this is what the case produced.
 */
function anaesthesiaReportCards() {
  const a = state.anaesthesia;

  return `${card(
    `<svg class="ui-icon" aria-hidden="true"><use href="#i-clock"></use></svg> Anesthesia Times`,
    `<div class="enc__grid-2">
      <div class="enc__row enc__row--end">
        <ui-input id="aStart" type="time" label="Start Time" data-testid="enc--a-start"></ui-input>
        <ui-button variant="outline" size="sm" id="aStartNow" data-testid="enc--a-start-now">Now</ui-button>
      </div>
      <div class="enc__row enc__row--end">
        <ui-input id="aStop" type="time" label="Stop Time" data-testid="enc--a-stop"></ui-input>
        <ui-button variant="outline" size="sm" id="aStopNow" data-testid="enc--a-stop-now">Now</ui-button>
      </div>
    </div>`,
    '',
    'enc--a-times'
  )}
  ${card(
    'Post-Anesthesia Assessment',
    /* The statement, and only the statement. A free-text Assessment Notes box
       sat under it for a while; what the bay saw belongs in the course of the
       case above and in the complications card below, and a notes box on the
       card whose whole job is one attested sentence reads as a second, weaker
       version of it.

       The wording of the statement is read from data/procedure-encounter.js,
       so this card and the run's own post-anaesthesia record cannot end up
       asserting two different sentences. */
    `<ui-checkbox id="aPostAssessment" ${a.postAssessment ? 'checked' : ''}
      data-testid="enc--a-post-assessment">
      ${esc(POST_ANAESTHESIA_ASSESSMENT.label)}
    </ui-checkbox>`,
    '',
    'enc--a-post'
  )}
  ${card(
    `<svg class="ui-icon" aria-hidden="true"><use href="#i-critical"></use></svg> Anesthesia Complications`,
    /* The description appears only once something is being described. "None"
       is the answer nine times in ten, and an empty box under it invites the
       tenth to be recorded as a shrug. */
    `<ui-radio-group inline id="aComplications"
      options="${esc(ANAESTHESIA_COMPLICATION_OPTIONS.join(','))}"
      value="${esc(a.complication ? ANAESTHESIA_COMPLICATIONS.occurred : ANAESTHESIA_COMPLICATIONS.none)}"
      data-testid="enc--a-complications"></ui-radio-group>
    ${
      a.complication
        ? `<ui-textarea id="aComplicationDetail" label="${esc(ANAESTHESIA_COMPLICATIONS.detail.label)}" rows="3"
            placeholder="${esc(ANAESTHESIA_COMPLICATIONS.detail.placeholder)}"
            value="${esc(a.complicationDetail)}"
            data-testid="enc--a-complication-detail"></ui-textarea>`
        : ''
    }`,
    '',
    'enc--a-report'
  )}
  ${card(
    'Anesthesia Professional Signature',
    `<div id="aSignature" data-testid="enc--a-signature"></div>`,
    '',
    'enc--a-sign-card'
  )}`;
}

/**
 * Step 1 IS the bay's pre-procedure sheet — the same one, not a summary of it.
 *
 * It used to be ten tick-boxes here and the real sheet on its own screen, which
 * meant a nurse answered "NPO confirmed" twice and the two answers could
 * disagree. Markup and behaviour come from js/lib/pre-check-form.js and the
 * answers live on the appointment, so the bay and the room are one document.
 *
 * The card actions (Set Default, Use Default, the PDF pair) and the sheet's own
 * commit bar are on in here too. They were left off on the grounds that they
 * belonged to setting the sheet up before the case — but the room is where the
 * sheet is actually filled in, and a nurse who has just worked down it needs
 * the same "Update" the bay gets, plus the PDF to hand to the patient.
 */
function checklistBody() {
  /* The sheet's document actions go in THIS card's header, beside its title.
     The sheet drew its own heading row underneath — a title with an empty
     right-hand half above four buttons with no title — which was two bands of
     chrome saying what one says, and the empty halves of each were most of the
     white space at the top of the step.

     What is outstanding is said in the footer hint and on the step chip; the
     sheet marks its own unanswered lines. A banner under the sheet counting
     them again was a fourth voice on the same question. */
  return card(
    'Pre-procedure checklist',
    preCheckSheetMarkup({ actions: true, header: false }),
    preCheckActionsMarkup(),
    'enc--checklist'
  );
}

/**
 * The back half of the Anesthesia Procedure Note — what happened.
 *
 * Four cards, in the order the case produces them: the clock, the recovery
 * assessment, whether anything went wrong, and the signature over the note as
 * a whole. The plan and the airway are not restated here — they are one screen
 * away on step 2, and a read-only copy of them is one more thing that can fall
 * out of step with the fields it is copying.
 *
 * NO TAB STRIP. The consent form and the orders are step 2's documents: they
 * are taken before the case, from the same sitting as the plan. Repeating
 * their tabs here offered a way OUT of the step from inside it, and put the
 * back half of the note behind a tab that only ever had one thing under it.
 */
/* What is still missing is said ONCE, in the footer hint, and shown by the step
   chip and Save & Sign's refusal. A banner in the body repeated it a third time
   directly above the buttons it was talking about. */
function anaesthesiaReportBody() {
  return `${anaesthesiaReportCards()}
  ${anaesthesiaDocActions('report', { reads: true })}`;
}

/**
 * The signature panel, reading the ONE signature this stage has.
 *
 * The note is not signed on its own card — the nurse's Save & Sign at the end
 * of the run signs and locks all four documents together, and that is the
 * signature shown here. A second signature of its own would be a second answer
 * to "is this note signed", and the two would disagree the first time somebody
 * amended one of them.
 */
function anaesthesiaSignatureHtml() {
  if (!state.preSignedBy) {
    return `<div class="enc__sign-panel">
      <p class="enc__caption">
        Not signed. Save &amp; Sign at the end of the run signs and locks this note
        together with the checklist and the anaesthesia record.
      </p>
    </div>`;
  }
  return `<div class="enc__signed-panel" data-testid="enc--a-signed-panel">
    <svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
    <div>
      <strong>Report Electronically Signed</strong>
      <p>Signed by: ${esc(state.preSignedBy)} · Date: ${esc(state.preSignedDate)}
        · Time: ${esc(state.preSignedTime)}</p>
    </div>
    <ui-button variant="outline" size="sm" id="aReSign" data-lock-exempt
      data-testid="enc--a-resign">Clear Signature &amp; Re-sign</ui-button>
  </div>`;
}

/**
 * What the note's back half is still missing, as a phrase — or '' when it is
 * complete.
 *
 * It has no signature of its own; the nurse's Save & Sign at the end of the
 * run is the one signature over the whole note. So "done" for it is the three
 * things that can only be known once the case is under way, and this is the
 * single place that says which they are: the card's own warning, the step chip
 * and Save & Sign's refusal all read from here rather than each keeping their
 * own idea of complete.
 */
function reportOutstanding() {
  const a = state.anaesthesia;
  const missing = [];
  if (!a.type) missing.push('the planned anaesthesia type');
  if (!a.start) missing.push('the anaesthesia start time');
  if (!a.postAssessment) missing.push('the post-anaesthesia assessment');
  if (!missing.length) return '';
  return missing.length === 1
    ? `Waiting on ${missing[0]}`
    : `Waiting on ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
}

/**
 * The Aldrete score fields, shared verbatim by Anaesthesia management and
 * Post-procedure — both score against the same state.aldrete Map, so the two
 * can never diverge. `prefix` keeps the two renderings' element ids apart,
 * since both stages exist in the DOM at once (only one is `hidden`).
 */
function aldreteFieldsHtml(prefix) {
  const total = aldreteTotal();
  const max = ALDRETE_CATEGORIES.length * 2;
  const ready = total >= ALDRETE_THRESHOLD;
  return `<div class="enc__grid-2">
    ${ALDRETE_CATEGORIES.map(
      (c) => `<ui-select id="${prefix}-${c.id}" label="${esc(c.label)}"
        data-testid="enc--aldrete-${prefix}-${c.id}"></ui-select>`
    ).join('')}
    <div class="enc__score enc__score--${ready ? 'ok' : 'low'}" aria-live="polite"
      data-testid="enc--aldrete-${prefix}-total">
      <strong>${total}</strong>
      <span>of ${max} · ${ALDRETE_THRESHOLD} or above required for discharge</span>
    </div>
  </div>`;
}

function wireAldreteFields(prefix, onChange) {
  ALDRETE_CATEGORIES.forEach((c) => {
    const node = el(`${prefix}-${c.id}`);
    if (!node) return;
    node.optionList = c.options.map((o) => ({ value: String(o.points), label: `${o.label} — ${o.points}` }));
    setValue(node, String(state.aldrete.get(c.id)));
    node.addEventListener('ui-change', (event) => {
      // Every ui-select carries a blank first option. Left to itself it would
      // score zero here and silently drag the total down, so a category
      // cannot be un-answered once it has been answered.
      if (event.detail.value === '') {
        setValue(node, String(state.aldrete.get(c.id)));
        return;
      }
      state.aldrete.set(c.id, Number(event.detail.value));
      // The Aldrete criterion is derived, never ticked by hand — it is the
      // one line on the readiness list the score already answers.
      if (aldreteTotal() >= ALDRETE_THRESHOLD) state.criteria.add('aldrete');
      else state.criteria.delete('aldrete');
      onChange();
    });
  });
}

function aldreteHistoryRows() {
  return state.aldreteHistory.map(
    (h) => `<tr>
      <td><code>${esc(h.time)}</code></td>
      <td>${h.activity}</td><td>${h.respiration}</td><td>${h.circulation}</td>
      <td>${h.consciousness}</td><td>${h.oxygen}</td>
      <td><strong>${h.total}</strong></td>
      <td>${esc(h.by)}</td>
    </tr>`
  );
}

/** The live record: what was given, what it did, and when. */
/* ---------------------------------------------------------------------------
   THE PRE-SEDATION ASSESSMENT

   Three things the nurse establishes before anything is given, and all three
   are WORKED OUT rather than typed: an airway risk score, whether the patient
   is genuinely fasted, and whether the room can rescue them.

   They sit at the top of Anaesthesia management because that is the document
   the nurse has open when they do them, and above the sedation record because
   they all happen before its first row.
   -------------------------------------------------------------------------- */


/** Hours between a clock time this morning and now, to one decimal. */
/**
 * Fasting, judged rather than reported.
 *
 * Solids and clear fluids are asked separately because they have different
 * rules and because "when did you last eat or drink" is the question that gets
 * tea with milk recorded as a clear fluid.
 */
/**
 * STEP 4 — the anaesthesia management record.
 *
 * The nurse`s record of the case as it runs: who is on the table, the three
 * stamps, the observations, what was given, and the assessment that clears the
 * patient. Every panel is a pair — the form on the LEFT and what it wrote on
 * the RIGHT — so a reading is typed and read back in one glance.
 *
 * It replaced a longer document that also carried a pre-sedation assessment,
 * a sedation-phase strip and a quick-select formulary. Those are gone rather
 * than hidden: this step is now exactly the form the unit works, and a field
 * nobody fills is a field that makes the ones beside it look optional.
 *
 * The panels themselves live further down with the rest of the nursing record
 * — see nursingPanels() — because they are built from the same helpers.
 */
function anaesthesiaManagementBody() {
  return nursingPanels();
}

/** Just the four step cards and the sign-off band — reused by the sign and
 *  re-sign actions below, which need the badges to refresh without rebuilding
 *  the open document underneath them. */
function paintPreDocs() {
  el('preDocs').innerHTML = preDocCards();

  // A repaint replaces every one of these nodes, which is why the listeners go
  // on after the markup rather than being bound once.
  el('preDocs')
    .querySelectorAll('[data-predoc]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        state.preDoc = button.dataset.predoc;
        paintPre();
      })
    );

}

/**
 * The nurse closes the stage.
 *
 * Guarded as well as disabled: the button is the affordance, this is the rule.
 * A disabled button is a hint, and a stage that can be closed over an
 * unsigned attestation because someone reached the handler another way is a
 * case starting on a document nobody signed.
 */
function signPreStage({ name } = {}) {
  if (!preStepsComplete()) {
    const outstanding = PRE_STEPS.filter(
      (doc) => doc.id !== 'management' && preDocTone(doc).tone !== 'signed'
    );
    notify(
      `Cannot sign — waiting on ${outstanding.map((d) => d.title).join(', ')}.`,
      'warning'
    );
    return false;
  }

  /* The signer is whoever typed their name in the dialog. It falls back to the
     nurse the checklist was recorded under, so a caller that signs without the
     dialog still puts a real name on the record rather than an empty one. */
  const signedBy = (name || '').trim() || defaultPreSigner();
  const { date, time } = signStamp();

  state.preSignedBy = signedBy;
  state.preSignedTime = time;
  state.preSignedDate = date;

  paintPre();
  paintStages();
  notify(`Pre-anaesthesia signed and locked by ${state.preSignedBy}.`, 'success');
  return true;
}

/** Who the dialog offers first: the nurse the checklist was recorded under. */
function defaultPreSigner() {
  return PRE_DOCUMENTS.find((d) => d.id === 'checklist')?.staff ?? 'Kayla Brandt, RN';
}

/** The moment a signature is made, in the two shapes the record shows it in:
 *  "27 May 2025" for the date line, and a 12-hour clock for the time. */
function signStamp(when = new Date()) {
  return {
    date: when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

/* --- Sign and Lock dialog ----------------------------------------------------
   Save & Sign closes the stage and locks four documents behind one signature,
   so it asks before it does that. The dialog is deliberately thin: a name, and
   the mark it produces shown as it is typed. */

/**
 * Open the dialog for the pre-procedure stage.
 *
 * The gate runs FIRST. Opening a signing dialog over an unfinished stage would
 * ask for a signature that cannot be given, and the refusal would land after
 * the name was typed rather than instead of the dialog.
 */
function openPreSignDialog(trigger) {
  if (!preStepsComplete()) {
    const outstanding = PRE_STEPS.filter(
      (doc) => doc.id !== 'management' && preDocTone(doc).tone !== 'signed'
    );
    notify(`Cannot sign — waiting on ${outstanding.map((d) => d.title).join(', ')}.`, 'warning');
    return;
  }

  const name = defaultPreSigner();
  const nameField = el('signName');
  nameField.removeAttribute('error');
  setValue(nameField, name);
  setSignLead(
    `Signing closes the pre-anaesthesia stage for ${patient?.name ?? 'this patient'} and ` +
      'locks its four documents. They can be amended afterwards only by withdrawing this signature.'
  );
  paintSignPreview(name);

  el('signModal').open(trigger);
}

/** The line above the fields. Both flows write it; neither leaves the other's
    sentence standing over a document it is not about. */
function setSignLead(text) {
  const lead = el('signLead');
  if (lead) lead.textContent = text;
}

/** The signature as it will be filed, repainted on every keystroke. */
function paintSignPreview(name) {
  const trimmed = (name ?? '').trim();
  const { date, time } = signStamp();

  const ink = el('signInk');
  // The credential is dropped from the ink — a signature is a name, and
  // "Kayla Brandt, RN" written in script reads as part of the mark.
  ink.textContent = trimmed.replace(/,.*$/, '') || '—';
  ink.classList.toggle('enc__sign-ink--empty', !trimmed);

  el('signBy').textContent = trimmed ? `Signed by ${trimmed}` : 'Not signed';
  el('signWhen').textContent = `${date} at ${time}`;
}

function wireSignDialog() {
  const modal = el('signModal');

  el('signName')
    .querySelector('input')
    ?.addEventListener('input', (event) => paintSignPreview(event.target.value));

  el('signCancel')?.addEventListener('ui-click', () => modal.close());

  el('signConfirm').addEventListener('ui-click', () => {
    const name = (el('signName').value || '').trim();
    if (!name) {
      el('signName').setAttribute('error', 'Type the name you are signing under');
      return;
    }

    /* One dialog, two documents behind it. A procedure uses it to close the
       pre-anaesthesia stage; a clinic visit uses it to sign the note itself.
       Asking here which screen this is beats a second dialog with the same
       three fields, which is how two signature flows drift apart. */
    if (!isProcedure) {
      signVisitNote({ name });
      modal.close();
      return;
    }

    if (!signPreStage({ name })) {
      modal.close();
      return;
    }

    modal.close();
    tryLockEncounter();
    showStage('intra');
  });
}

/**
 * Open the dialog for a clinic visit's note.
 *
 * Save & Sign used to walk straight off the screen to the Encounter Summary,
 * so the button labelled "Sign" signed nothing and the clinician discovered
 * on the next screen that they still had to. It asks here instead: the name
 * going on the note, and the mark it produces shown before it is committed.
 * Confirming it files the note and returns to the schedule — the encounter is
 * over at that point, and what comes next is the next patient (see
 * signVisitNote).
 *
 * There is no completeness gate, deliberately — the footer hint names the
 * sections still empty, and a consultation with nothing under family history
 * is a finished note, not an error. See updateHint().
 */
function openVisitSignDialog(trigger) {
  const name = actingProvider();
  const nameField = el('signName');
  nameField.removeAttribute('error');
  setValue(nameField, name);
  /* The lead says what signing costs, and it no longer promises a way back:
     a clinic visit's note is final once it is signed, and a dialog that says
     otherwise is a dialog people press through. */
  setSignLead(
    `Signing files the ${state.visitNote.template} for ${patient?.name ?? 'this patient'} to the ` +
      'chart, locks it, and completes the encounter. Nothing in it can be changed afterwards.'
  );
  paintSignPreview(name);

  el('signModal').open(trigger);
}

/**
 * Sign the visit note. The signature is what completes the encounter.
 *
 * The signature is written in two places on purpose. `state.visitNote` is what
 * this screen paints — the signature block at the foot of the note, the badge
 * in the toolbar, the Unlock to amend that withdraws it. The booking is what
 * every other screen reads: the Encounters worklist filters on it and the
 * summary renders its rail from it. A signature written to only one of them is
 * a note that is signed on one screen and unsigned on the next.
 */
function signVisitNote({ name } = {}) {
  const signedBy = (name || '').trim() || actingProvider();
  const { date, time } = signStamp();

  state.visitNote.signed = true;
  state.visitNote.signedBy = signedBy;
  state.visitNote.signedDate = date;
  state.visitNote.signedTime = time;

  /*
   * The Plan's orders and its recall become records HERE, with the signature
   * and under the name on it, because that is when the document becomes the
   * record. Before the booking is written rather than after: filing is what
   * the clinician pressed the button for, and a navigation that beat it would
   * lose the orders and leave a signed note claiming to have raised them.
   */
  filePlanCommitments(signedBy);

  if (appointment) {
    /*
     * The signature travels on the booking, because the screen that shows it
     * is a different page load.
     *
     * The Encounter Summary's own signature register lives in a module and is
     * rebuilt from its seeds every navigation, so writing there would put the
     * name somewhere the next screen cannot see it — the summary would show
     * the note as signed by whoever the booking's provider is, at no
     * particular time. The booking is the one thing both screens read and the
     * only one that survives the trip, so the name, the day and the clock go
     * on it beside the flags the worklist filters on.
     *
     * Short-month — "3 Aug 2026" — to match the shape the summary's seeded
     * signatures use, so the rail reads the same for a note signed a moment
     * ago as for one signed last week.
     */
    updateAppointment(appointment.id, {
      /* `noteSigned`, not `encounterLocked`: the note is filed, and that is
         the whole of what a clinic visit signs. The encounter lock is the
         procedure run's — three documents and a superbill — and claiming it
         here would put a procedure's banner over a consultation. */
      noteSigned: true,
      /* And the visit is over. A clinic visit is one document, so the
         signature on it is the end of the encounter, not a step in it — the
         booking moves to the terminal status the procedure run also finishes
         on, rather than sitting in Scheduled behind a note nobody can edit. */
      status: 'Check Out',
      noteSignedBy: signedBy,
      noteSignedOn: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      noteSignedAt: time,
    });
  }

  /* Painted before the trip so the signed state is what any code reading the
     screen after this — and the note, if the navigation is ever dropped —
     sees. It costs one repaint and saves a signed note rendering as a draft. */
  paintDoc();

  /*
   * Signed means finished, so the clinician goes back to the schedule.
   *
   * It used to be the Encounter Summary, which is a reading screen for a past
   * encounter — it renders two of the note's sections and carries a Save
   * button of its own — so landing there off a signature read as a second
   * document to deal with at the moment the work was already done. The
   * encounter is locked at this point and there is nothing left to do on it:
   * what comes next is the next patient. That is the schedule, the same place
   * the back arrow on this screen goes (screens/clinic-visit.html), and
   * the row for this visit is the receipt — it reads Check Out with the note
   * filed as signed, written by the updateAppointment above.
   *
   * No toast before it: a toast lives in the DOM of the page that raised it,
   * so one fired here would be thrown away by the navigation a frame later.
   */
  window.location.href = 'scheduler.html';
}

function paintPre() {
  paintPreDocs();

  const bodies = {
    checklist: checklistBody,
    preanaesthesia: preAnaesthesiaBody,
    report: anaesthesiaReportBody,
    management: anaesthesiaManagementBody,
  };
  /* Step 3 carries the note's own signature card, which says everything the
     banner says and says it where the document ends. Two receipts for one
     signature on one screen is one too many. It moved with the rest of the
     note's back half. */
  const banner = state.preDoc === 'report' ? '' : preLockBannerHtml();
  el('preBody').innerHTML = banner + bodies[state.preDoc]();

  // The footer hint names the next step, so it has to move when the step
  // does — ticking the checklist or opening the report both change it.
  updateHint();

  if (state.preDoc === 'checklist') wireChecklist();
  else if (state.preDoc === 'preanaesthesia') wirePreAnaesthesia();
  else if (state.preDoc === 'report') {
    /* Step 3 has no tab strip, so the note's back half is always what is on
       screen here — bound unconditionally, unlike step 2 where consent or
       orders can be showing instead. */
    wireAnaesthesiaReport();
    wireAnaesthesiaDocChrome('report');
  } else wireManagement();

  applyPreLock();
}

/**
 * A signed stage is a locked one.
 *
 * The nurse's signature says these four documents are the record — so nothing
 * inside them stays editable behind it. Done by disabling the controls after
 * they are wired rather than by threading a `locked` flag through four
 * document renderers: one place to change, and no way for a new field to be
 * added to a document and quietly stay live after the lock.
 *
 * Amending is still possible, and deliberately explicit: Unlock to amend
 * clears the signature first, so an amended record is never sitting under a
 * signature given before the amendment.
 */

/** The two ways back out of the lock. Both withdraw the same signature. */
const PRE_UNLOCK_IDS = ['preUnlock', 'aReSign'];

function applyPreLock() {
  const body = el('preBody');
  if (!body) return;

  const locked = Boolean(state.preSignedBy);
  body
    .querySelectorAll('ui-input, ui-select, ui-textarea, ui-checkbox, ui-radio-group, ui-button')
    .forEach((control) => {
      /* `data-lock-exempt` is for controls that do not WRITE to the record:
         the two ways out of the lock, and the three that put the document on
         paper. Disabling the first would close the door behind everyone, and
         a signed note is exactly the one somebody wants to print. */
      if (control.hasAttribute('data-lock-exempt')) return;

      /* Some controls disable THEMSELVES, and unlocking must not hand them
         back. The pre-procedure sheet greys out the allergen boxes once NKDA
         is ticked, and this pass — which runs after the sheet mounts — was
         re-enabling them, so a sheet that said "no known drug allergies"
         opened with Soy and Egg tickable again. The lock is about the
         signature; it does not overrule the sheet's own rules. */
      if (!locked && control.hasAttribute('data-own-disabled')) return;
      control.toggleAttribute('disabled', locked);
    });

  PRE_UNLOCK_IDS.forEach((id) =>
    body.querySelector(`#${id}`)?.addEventListener('ui-click', unlockPreStage)
  );
}

/**
 * Withdraw the stage signature so the four documents can be amended.
 *
 * Reached two ways — the banner's "Unlock to amend" on steps 1, 2 and 4, and
 * the note's "Clear Signature & Re-sign" on step 3 — and they are the same
 * act, so they are the same function rather than two that could drift.
 */
function unlockPreStage() {
  state.preSignedBy = '';
  state.preSignedTime = '';
  state.preSignedDate = '';
  paintPre();
  paintStages();
  notify('Pre-anaesthesia unlocked for amendment. It must be signed again.', 'warning');
}

/**
 * Step 2 — the note's front half.
 *
 * Nothing here signs anything. The document has no signature of its own:
 * making the last of its three statements completes it, and the nurse's
 * Save & Sign at the end of the run signs and locks the note as a whole.
 */
function wirePreAnaesthesia() {
  /* Guarded, because the consent and orders tabs replace the note body
     entirely: the plan and airway controls are not on screen then, and binding
     them threw before the tab could finish painting. The note's back half is
     step 3's now, and is bound from there. */
  if (state.anaesthesia.doc === 'note') wireAnaesthesiaPlan();
  wireAnaesthesiaDocChrome('note');
}

/**
 * Mount the shared sheet into step 1.
 *
 * The sheet is re-mounted on every repaint of the pre body, so its answers
 * cannot live inside it — they live on `state.preCheckValues` and are handed
 * back in each time. Losing a nurse's ticks because she looked at step 2 and
 * came back would be the worst kind of quiet bug.
 *
 * onChange deliberately does NOT call paintPre(): that would tear the sheet
 * out from under the field being edited. Only the things that depend on the
 * answers are repainted — the step strip, the footer hint and the stage locks.
 */
function wireChecklist() {
  preCheckSheet = mountPreCheckSheet({
    root: el('preBody'),
    appointment: state.preCheckValues ? { preCheck: state.preCheckValues } : appointment,
    notify: (message, severity = 'success') => notify(message, severity),
    onChange: (missing) => {
      state.preCheckOutstanding = missing;
      state.preCheckValues = preCheckSheet?.values() ?? state.preCheckValues;
      paintPreDocs();
      updateHint();
      paintStages();
    },
  });
}

/**
 * The chrome both halves of the note carry: the tab strip and the action row.
 *
 * `step` keeps the two renderings' element ids apart, since the same four
 * buttons appear at the foot of step 2 and step 3.
 */
/**
 * The consent form's two signatures and its commit.
 *
 * Only bound when the consent tab is the one on screen — the other two
 * documents do not render any of these, so every lookup below is a no-op then.
 */
function wireAnaesthesiaConsent() {
  const c = state.anaesthesia.consent;

  el('preBody')
    ?.querySelector('[data-consent-pad]')
    ?.addEventListener('ui-sign', (event) => {
      c.patient = {
        name: event.detail.name,
        method: event.detail.method,
        dataUrl: event.detail.dataUrl,
        role: 'Patient',
        at: signedStamp(),
      };
      paintPre();
    });

  const providerPad = el('preBody')?.querySelector('[data-consent-provider-pad]');

  /* Both pads are told who is signing in the markup that draws them — the
     patient from the booking, the provider from the consent — rather than
     having a name typed into a field after the upgrade, which is what this
     used to do and what the pad no longer has anywhere to put. */
  if (providerPad) {
    providerPad.addEventListener('ui-sign', (event) => {
      /* The role is the form's, not the pad's — a signature says who signed,
         and what they were is what the consent asked them to sign AS. */
      c.provider = {
        name: event.detail.name,
        method: event.detail.method,
        dataUrl: event.detail.dataUrl,
        role: ANAESTHESIA_CONSENT.provider.role,
        at: signedStamp(),
      };
      paintPre();
    });
  }

  el('aConsentSave')?.addEventListener('ui-click', () => {
    if (!c.patient || !c.provider) return;
    c.filed = true;
    paintPre();
    notify('Anaesthesia consent form saved to the encounter.');
  });
}

function wireAnaesthesiaDocChrome(step) {
  const body = el('preBody');

  body.querySelectorAll('[data-anesdoc]').forEach((tab) =>
    tab.addEventListener('click', () => {
      state.anaesthesia.doc = tab.dataset.anesdoc;
      paintPre();
    })
  );

  wireAnaesthesiaConsent();
  wireOrderSet(ORDER_SET_VIEWS.anaesthesia);

  el(`a${step}ViewPdf`)?.addEventListener('ui-click', () => window.print());
  el(`a${step}Print`)?.addEventListener('ui-click', () => window.print());
  el(`a${step}DownloadPdf`)?.addEventListener('ui-click', () =>
    notify('PDF download is not built in this prototype.', 'info')
  );
  el(`a${step}Update`)?.addEventListener('ui-click', () => {
    /* Everything is already on `state.anaesthesia` — the fields write to it as
       they are edited — so this repaints rather than gathers. What it is
       actually for is the receipt: a long form with no way to say "saved"
       leaves people pressing Next to find out whether it took. */
    paintPre();
    paintStages();
    notify('Anaesthesia assessment updated.');
  });
}

/**
 * The plan and airway controls on step 2.
 *
 * Only one pre-procedure document is in the DOM at a time, so a listener bound
 * in the wrong wire-up would be looking for elements that are not there.
 */
function wireAnaesthesiaPlan() {
  const a = state.anaesthesia;

  options('aType', ANAESTHESIA_TYPES, a.type);
  setValue(el('aIndication'), a.indication);

  el('aType').addEventListener('ui-change', (event) => {
    a.type = event.detail.value;
  });
  el('aIndication').addEventListener('ui-input', (event) => {
    a.indication = event.detail.value;
  });

  el('preBody').querySelectorAll('[data-airway]').forEach((group) =>
    group.addEventListener('ui-change', (event) => {
      const id = group.dataset.airway;
      const before = a.airway.get(id);
      a.airway.set(id, event.detail.value);

      /* Only the two rows that carry a follow-up can change what is on screen,
         and only when they cross into or out of Other. Repainting on every
         airway answer would redraw the card — and the radio the user just
         pressed — six times for nothing. */
      if (!a.airwayOther.has(id) || before === event.detail.value) return;
      if (event.detail.value !== AIRWAY_OTHER) a.airwayOther.set(id, '');
      if (before === AIRWAY_OTHER || event.detail.value === AIRWAY_OTHER) paintPre();
    })
  );

  el('preBody').querySelectorAll('[data-airway-other]').forEach((input) =>
    input.addEventListener('ui-input', (event) =>
      a.airwayOther.set(input.dataset.airwayOther, event.detail.value)
    )
  );

  el('preBody').querySelectorAll('[data-acheck]').forEach((box) =>
    box.addEventListener('ui-change', (event) => {
      if (event.detail.checked) a.checks.add(box.dataset.acheck);
      else a.checks.delete(box.dataset.acheck);
      /* These three are what "complete" means for this step, so ticking one
         has to move the step chip, the card's warning and the footer hint. */
      paintPre();
      paintStages();
    })
  );

  el('aSetDefault').addEventListener('ui-click', () =>
    notify('Saving a default anaesthesia set-up is not built in this prototype.', 'info')
  );

  // "Use Default" is the practice's standard MAC set-up. It exists because
  // nine visits in ten are the same, and retyping them is how the tenth gets
  // rushed. It reaches the assessment's own fields only — see the card actions.
  el('aUseDefault').addEventListener('ui-click', () => {
    a.type = ANAESTHESIA_TYPES[0];
    a.airway = new Map(AIRWAY_FIELDS.map((f) => [f.id, f.value]));
    /* The default set-up is a normal airway, so it takes the two Other
       descriptions off with it rather than leaving them behind a row that no
       longer says Other. */
    a.airwayOther = new Map(AIRWAY_FIELDS.filter((f) => f.other).map((f) => [f.id, '']));
    ANAESTHESIA_CHECKS.forEach((c) => a.checks.add(c.id));
    paintPre();
    paintStages();
    notify('Default anaesthesia set-up applied.');
  });
}

/** Step 3 — the note's back half. */
function wireAnaesthesiaReport() {
  const a = state.anaesthesia;

  setValue(el('aStart'), a.start);
  setValue(el('aStop'), a.stop);

  el('aStart').addEventListener('ui-input', (event) => {
    a.start = event.detail.value;
  });
  el('aStop').addEventListener('ui-input', (event) => {
    a.stop = event.detail.value;
  });

  el('aComplications').addEventListener('ui-change', (event) => {
    a.complication = event.detail.value !== ANAESTHESIA_COMPLICATIONS.none;
    /* Answering "None" puts the description away. Its text goes with it — a
       description left behind under an answer that says nothing happened is a
       complication nobody can see and nobody retracted. */
    if (!a.complication) a.complicationDetail = '';
    paintPre();
  });

  el('aComplicationDetail')?.addEventListener('ui-change', (event) => {
    a.complicationDetail = event.detail.value;
  });

  el('aStartNow').addEventListener('ui-click', () => {
    a.start = nowTime();
    setValue(el('aStart'), a.start);
  });
  el('aStopNow').addEventListener('ui-click', () => {
    a.stop = nowTime();
    setValue(el('aStop'), a.stop);
  });

  el('aPostAssessment').addEventListener('ui-change', (event) => {
    a.postAssessment = event.detail.checked;
    /* The last of the three facts this half is waiting on, so ticking it can
       be what completes the document — the step chip, the card's warning and
       the footer all have to follow it. */
    paintPre();
    paintStages();
  });

  el('aSignature').innerHTML = anaesthesiaSignatureHtml();
  /* The doc actions are bound by the caller, alongside this — they are step
     chrome rather than part of the document. */
}

/**
 * Relabel a ui-button.
 *
 * Writes to the inner <button>, never the host: <ui-button> renders its own
 * button into itself, so setting textContent on the host deletes the control.
 */
function setButtonLabel(id, text) {
  const control = el(id)?.querySelector('button');
  if (control) control.textContent = text;
}

/**
 * Step 4 is now the nursing record, so its wiring is the record`s wiring.
 *
 * What used to be here bound a sedation-phase strip, a pre-sedation
 * assessment and four buttons that opened drawers. The panels replaced all
 * of it with forms that are already on the page, and a drawer over a form
 * asking the same question was the duplication worth removing.
 */
function wireManagement() {
  wireNursing();
}

/* ===================== Post-procedure ===================== */

const aldreteTotal = () => [...state.aldrete.values()].reduce((sum, n) => sum + n, 0);

function paintPost() {
  const d = state.discharge;
  const outstanding = DISCHARGE_CRITERIA.filter((c) => !state.criteria.has(c.id));

  el('postBody').innerHTML = `
    ${card(
      `Aldrete score <span class="enc__pill">Post-anaesthesia recovery · 0–2 points per category</span>`,
      aldreteFieldsHtml('al'),
      '',
      'enc--aldrete'
    )}

    ${card(
      'Discharge readiness',
      `<div class="enc__checks enc__checks--2">
        ${DISCHARGE_CRITERIA.map(
          (c) => `<ui-checkbox data-criterion="${c.id}"
            ${state.criteria.has(c.id) ? 'checked' : ''}
            data-testid="enc--criterion-${c.id}">${esc(c.label)}</ui-checkbox>`
        ).join('')}
      </div>

      ${legend('Discharge details')}
      <div class="enc__grid-2">
        <ui-input id="dInstructionsAt" type="time" label="Discharge instructions given at"
          data-testid="enc--d-instructions-at"></ui-input>
        <ui-select id="dDestination" label="Discharge from ASC to"
          data-testid="enc--d-destination"></ui-select>
        <ui-select id="dMode" label="Discharge mode" data-testid="enc--d-mode"></ui-select>
        <ui-select id="dTransport" label="Transport method"
          data-testid="enc--d-transport"></ui-select>
        <ui-input id="dTime" type="time" label="Discharge time"
          data-testid="enc--d-time"></ui-input>
      </div>

      ${legend('Claim and instructions')}
      <div class="enc__grid-2">
        <div>
          <ui-select id="dStatus" label="Discharge status"
            hint="Carries to the UB-04 facility claim." data-testid="enc--d-status"></ui-select>
        </div>
        <div class="enc__stack">
          <ui-select id="dInstructions" label="Discharge instructions"
            data-testid="enc--d-instructions"></ui-select>
          <div class="enc__row">
            <ui-button variant="outline" size="sm" id="dPreview">Preview</ui-button>
            <ui-button variant="outline" size="sm" id="dPrint">Print for patient</ui-button>
          </div>
        </div>
      </div>

      <div class="enc__confirm${d.ready ? ' enc__confirm--on' : ''}">
        <ui-checkbox id="dReady" ${d.ready ? 'checked' : ''} data-testid="enc--d-ready">
          Ready for discharge — all criteria met
        </ui-checkbox>
        <span class="enc__confirm-meta">Recorded ${esc(d.time)} · ${esc(d.recordedBy)}</span>
      </div>

      <div class="enc__panel-foot">
        <ui-badge status="${outstanding.length ? 'warning' : 'success'}">
          ${
            outstanding.length
              ? `${outstanding.length} requirement${outstanding.length === 1 ? '' : 's'} outstanding`
              : 'All requirements met'
          }
        </ui-badge>
        <span class="enc__spacer"></span>
        <ui-button variant="outline" size="sm" id="dSummary">Print discharge summary</ui-button>
        <ui-button variant="outline" size="sm" id="dSave">Save progress</ui-button>
        <ui-button variant="primary" size="sm" id="dComplete"
          data-testid="enc--d-complete">${d.done ? 'Discharged' : 'Complete discharge'}</ui-button>
      </div>`,
      '',
      'enc--discharge'
    )}

    ${card(
      `Specimens and pathology <span class="enc__pill enc__pill--warn">${
        SPECIMEN_LOG.length
      } specimens · awaiting results</span>`,
      `${logTable(
        ['Pot', 'Site', 'Sent', 'Lab', 'Status', 'Patient told'],
        SPECIMEN_LOG.map(
          (s) => `<tr>
            <td>${s.pot}</td>
            <td><code>${esc(s.site)}</code></td>
            <td><code>${esc(s.sent)}</code></td>
            <td>${esc(s.lab)}</td>
            <td><ui-badge status="warning">${esc(s.status)}</ui-badge></td>
            <td>${s.told ? esc(s.told) : '—'}</td>
          </tr>`
        ),
        'No specimens taken.'
      )}`,
      '',
      'enc--specimens'
    )}

    ${card(
      'Complications',
      `<ui-radio-group inline label="Complications" label-hidden id="cOccurred"
        options="None,Complication occurred"
        value="${state.complication.occurred ? 'Complication occurred' : 'None'}"
        data-testid="enc--complication"></ui-radio-group>
      <div class="enc__grid-2" id="complicationFields"${
        state.complication.occurred ? '' : ' hidden'
      }>
        <ui-select id="cType" label="Type" data-testid="enc--c-type"></ui-select>
        <ui-input id="cDetail" label="Detail" data-testid="enc--c-detail"></ui-input>
      </div>`,
      '',
      'enc--complications'
    )}`;

  wirePost();
}

function wirePost() {
  const d = state.discharge;

  wireAldreteFields('al', paintPost);

  el('postBody').querySelectorAll('[data-criterion]').forEach((box) =>
    box.addEventListener('ui-change', (event) => {
      if (event.detail.checked) state.criteria.add(box.dataset.criterion);
      else state.criteria.delete(box.dataset.criterion);
      paintPost();
    })
  );

  setValue(el('dInstructionsAt'), d.instructionsAt);
  setValue(el('dTime'), d.time);
  options('dDestination', DISCHARGE_DESTINATIONS, d.destination);
  options('dMode', DISCHARGE_MODES, d.mode);
  options('dTransport', TRANSPORT_METHODS, d.transport);
  options('dStatus', DISCHARGE_STATUSES, d.status);
  options('dInstructions', DISCHARGE_INSTRUCTION_SETS, d.instructions);

  const bind = (id, key, event = 'ui-change') =>
    el(id).addEventListener(event, (e) => {
      d[key] = e.detail.value;
    });
  bind('dInstructionsAt', 'instructionsAt', 'ui-input');
  bind('dTime', 'time', 'ui-input');
  bind('dDestination', 'destination');
  bind('dMode', 'mode');
  bind('dTransport', 'transport');
  bind('dStatus', 'status');
  bind('dInstructions', 'instructions');

  el('dReady').addEventListener('ui-change', (event) => {
    d.ready = event.detail.checked;
    paintPost();
  });

  el('dPreview').addEventListener('ui-click', () =>
    notify(`Preview — ${d.instructions}. The instruction sheet is not built.`, 'info')
  );
  el('dPrint').addEventListener('ui-click', () => window.print());
  el('dSummary').addEventListener('ui-click', () => window.print());
  el('dSave').addEventListener('ui-click', () => notify('Discharge progress saved.'));

  el('dComplete').addEventListener('ui-click', () => {
    const outstanding = DISCHARGE_CRITERIA.filter((c) => !state.criteria.has(c.id));
    if (outstanding.length) {
      notify(
        `${outstanding.length} discharge requirement${
          outstanding.length === 1 ? ' is' : 's are'
        } outstanding: ${outstanding.map((c) => c.label).join('; ')}.`,
        'warning'
      );
      return;
    }
    if (!d.ready) {
      notify('Tick "Ready for discharge" — the sign-off is the record.', 'warning');
      return;
    }
    d.done = true;
    if (appointment) updateAppointment(appointment.id, { status: 'Check Out', noteSigned: true });
    paintPost();
    paintStages();
    notify(`Discharged to ${d.destination} at ${d.time}. Appointment set to Check Out.`);
    tryLockEncounter();
  });

  /* --- Complications --- */
  options('cType', COMPLICATION_TYPES, state.complication.type);
  setValue(el('cDetail'), state.complication.detail);
  el('cOccurred').addEventListener('ui-change', (event) => {
    state.complication.occurred = event.detail.value !== 'None';
    el('complicationFields').hidden = !state.complication.occurred;
  });
  el('cType').addEventListener('ui-change', (event) => {
    state.complication.type = event.detail.value;
  });
  el('cDetail').addEventListener('ui-input', (event) => {
    state.complication.detail = event.detail.value;
  });
}

/* ===================== The record drawer ===================== */

/**
 * One drawer for every intra-operative entry.
 *
 * An observation, a drug, a solution and oxygen are the same shape — a few
 * fields and a time, appended to a log — so they share a drawer built from a
 * field spec. Four near-identical drawers would drift apart within a month.
 */
/** The clock, as a field default. */
function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/* ===================== Medication formulary ===================== */

/**
 * Add and edit share one form, the same shape as every other add/edit pair
 * in this app (e.g. Master's openForm) — null means "adding new", an index
 * means "overwriting that entry".
 */
let formularyEditIndex = null;

/**
 * The stored dose is one string — "25 mcg" — and the form asks for it as two
 * fields, so it is taken apart on the way in and put back together on the way
 * out. One string is what every reader of the formulary wants: the quick-select
 * chip, the MAR line, the report. Two fields is what the person typing wants,
 * for the reason MEDICATION_UNITS gives.
 *
 * A dose written without a space ("25mcg") still comes apart correctly,
 * because the seeds are not the only thing that has ever been in this list.
 */
function splitDose(dose) {
  const match = String(dose ?? '').trim().match(/^([\d.]+)\s*(.*)$/);
  return match ? { amount: match[1], unit: match[2].trim() } : { amount: '', unit: '' };
}

/**
 * The unit list, widened to keep whatever the drug already had.
 *
 * A drug carrying a rate rather than an amount — 5 mg/kg/hr — is not on the
 * standard list, and a select that cannot show the value it was handed would
 * silently rewrite that drug's dose to milligrams the moment somebody opened
 * it to correct a spelling. So the odd one out goes on the front of the list.
 */
function unitOptions(unit) {
  return unit && !MEDICATION_UNITS.includes(unit) ? [unit, ...MEDICATION_UNITS] : MEDICATION_UNITS;
}

function resetFormularyForm() {
  setValue(el('fmName'), '');
  el('fmName').removeAttribute('error');
  setValue(el('fmGeneric'), '');
  setValue(el('fmBrand'), '');
  setValue(el('fmDose'), '');
  el('fmDose').removeAttribute('error');
  setValue(el('fmConcentration'), '');
  options('fmUnit', MEDICATION_UNITS, MEDICATION_UNITS[0]);
  options('fmRoute', MEDICATION_ROUTES, MEDICATION_ROUTES[0]);
  options('fmCategory', MEDICATION_CATEGORIES, MEDICATION_CATEGORIES[0]);
}

/**
 * The search matches on every name the drug has, and on its category.
 *
 * A nurse comes to this list holding an ampoule and types what is printed on
 * it. Matching the practice's own name alone told them the room does not stock
 * Versed, which it does — it stocks it under Midazolam. The cart's own
 * inventory tab already searches all three for this reason (see the
 * 'med-inventory' spec in js/lib/encounter-logs.js).
 */
function formularyRows(query) {
  const q = query.trim().toLowerCase();
  if (!q) return state.formulary.map((drug, index) => ({ ...drug, _i: index }));
  return state.formulary
    .map((drug, index) => ({ ...drug, _i: index }))
    .filter((drug) =>
      ['name', 'generic', 'brand', 'category'].some((key) =>
        String(drug[key] ?? '').toLowerCase().includes(q)
      )
    );
}

function paintFormularyTable() {
  const rows = formularyRows(el('fmSearch').value ?? '');

  /*
   * THE NAME CELL CARRIES THE OTHER TWO NAMES, AND THE DOSE CELL THE
   * CONCENTRATION.
   *
   * The form now asks for all of it, and a field that is typed into a form and
   * then never shown anywhere is a field nobody fills in twice. So the table
   * prints what the form collects: the brand under the name, because that is
   * what is on the vial, and the concentration under the dose, because those
   * are the two numbers that get confused for each other and reading them one
   * above the other is what tells them apart.
   *
   * The generic is printed only when it is NOT the practice's own name for the
   * drug. Most of what a sedation cart carries is charted under its generic
   * already, and "Generic: Midazolam" under "Midazolam" is a line of noise on
   * every row — it says nothing, and it pushes the rows that DO have something
   * to say down the list.
   *
   * The route is an outline pill rather than plain text so it reads as the
   * fixed, small vocabulary it is (IV, IM, PO …) beside the category's filled
   * one, and neither is mistaken for something typed.
   */
  el('fmTable').innerHTML = `<table class="enc__log enc__fm-table">
    <thead>
      <tr><th>Name</th><th>Dosage</th><th>Route</th><th>Category</th><th>Actions</th></tr>
    </thead>
    <tbody>
      ${
        rows.length
          ? rows.map((drug) => {
              const aliases = [
                drug.generic && drug.generic !== drug.name ? `Generic: ${drug.generic}` : '',
                drug.brand ? `Brand: ${drug.brand}` : '',
              ].filter(Boolean);
              return `<tr>
                <td>
                  <strong>${esc(drug.name)}</strong>
                  ${aliases
                    .map((line) => `<span class="enc__caption">${esc(line)}</span>`)
                    .join('')}
                </td>
                <td>
                  <code>${esc(drug.dose)}</code>
                  ${
                    /* Suppressed when it repeats the dose. Ondansetron comes
                       as a 4 mg vial, so its concentration and its default
                       dose are the same string, and "4 mg" printed twice on
                       top of itself reads as a rendering fault rather than as
                       a whole vial being the dose. */
                    drug.strength && drug.strength !== drug.dose
                      ? `<span class="enc__caption">${esc(drug.strength)}</span>`
                      : ''
                  }
                </td>
                <td><ui-badge status="neutral" variant="outline">${esc(drug.route)}</ui-badge></td>
                <td><ui-badge status="${drug.category === 'reversal' ? 'warning' : 'neutral'}">${esc(drug.category)}</ui-badge></td>
                <td class="enc__formulary-actions">
                  <button type="button" class="enc__icon-btn" data-edit-drug="${drug._i}"
                    aria-label="Edit ${esc(drug.name)}">
                    <svg class="ui-icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
                  </button>
                  <button type="button" class="enc__remove" data-delete-drug="${drug._i}"
                    aria-label="Remove ${esc(drug.name)}">
                    <svg class="ui-icon" aria-hidden="true"><use href="#i-close"></use></svg>
                  </button>
                </td>
              </tr>`;
            }).join('')
          : `<tr><td colspan="5" class="enc__empty">No medications match.</td></tr>`
      }
    </tbody>
  </table>`;

  el('fmTable').querySelectorAll('[data-edit-drug]').forEach((button) =>
    button.addEventListener('click', () => editFormularyDrug(Number(button.dataset.editDrug)))
  );
  el('fmTable').querySelectorAll('[data-delete-drug]').forEach((button) =>
    button.addEventListener('click', () => deleteFormularyDrug(Number(button.dataset.deleteDrug)))
  );
}

function editFormularyDrug(index) {
  const drug = state.formulary[index];
  const { amount, unit } = splitDose(drug.dose);
  formularyEditIndex = index;
  setValue(el('fmName'), drug.name);
  el('fmName').removeAttribute('error');
  setValue(el('fmGeneric'), drug.generic ?? '');
  setValue(el('fmBrand'), drug.brand ?? '');
  setValue(el('fmDose'), amount);
  el('fmDose').removeAttribute('error');
  setValue(el('fmConcentration'), drug.strength ?? '');
  options('fmUnit', unitOptions(unit), unit || MEDICATION_UNITS[0]);
  options('fmRoute', MEDICATION_ROUTES, drug.route);
  options('fmCategory', MEDICATION_CATEGORIES, drug.category);
  el('fmName').focus();
}

function deleteFormularyDrug(index) {
  const [drug] = state.formulary.splice(index, 1);
  if (formularyEditIndex === index) {
    formularyEditIndex = null;
    resetFormularyForm();
  }
  paintFormularyTable();
  if (state.preDoc === 'management') paintPre();
  notify(`${drug.name} removed from the formulary.`, 'info');
}

function wireFormularyModal() {
  /* Built once, here, rather than on open. The three selects have to be
     carrying their options and the table its rows before anybody can read
     either, and nothing re-enters this drawer to do it — it is opened, not
     rendered. */
  resetFormularyForm();
  paintFormularyTable();

  el('fmSearch').addEventListener('ui-input', () => paintFormularyTable());

  el('fmSave').addEventListener('ui-click', () => {
    const name = el('fmName').value.trim();
    const amount = el('fmDose').value.trim();
    el('fmName').removeAttribute('error');
    el('fmDose').removeAttribute('error');

    if (!name) {
      el('fmName').setAttribute('error', 'A medication name is required.');
      return;
    }
    /* A cart entry with no default dose is one the administration form cannot
       pre-fill, which is most of what the default dose is for. */
    if (!amount) {
      el('fmDose').setAttribute('error', 'A default dosage is required.');
      return;
    }

    const unit = el('fmUnit').value || MEDICATION_UNITS[0];
    const dose = `${amount} ${unit}`;
    const entry = {
      name,
      /* The generic falls back to the name because for most of what a sedation
         cart carries the name IS the generic, and a blank here would print as
         a drug with no generic name rather than as one that never needed
         restating. */
      generic: el('fmGeneric').value.trim() || name,
      brand: el('fmBrand').value.trim(),
      strength: el('fmConcentration').value.trim(),
      dose,
      route: el('fmRoute').value || MEDICATION_ROUTES[0],
      category: el('fmCategory').value || MEDICATION_CATEGORIES[0],
    };
    /* Assigned either way rather than only when true: an edit that moves a drug
       OUT of the reversal category has to clear the flag as well, or the entry
       goes on quietly filing a sedation event for a drug that no longer
       reverses anything. */
    entry.reversal = entry.category === 'reversal';

    if (formularyEditIndex !== null) {
      const existing = state.formulary[formularyEditIndex];
      Object.assign(existing, entry);
      /* The ladder is the list of amounts the administration log offers for
         this drug. A new default that is not on it is a default nobody can
         pick, so it goes on the front. */
      if (existing.doses && !existing.doses.includes(dose)) {
        existing.doses = [dose, ...existing.doses];
      }
      notify(`${name} updated.`);
    } else {
      state.formulary.push({ ...entry, doses: [dose] });
      notify(`${name} added to the formulary.`);
    }

    formularyEditIndex = null;
    resetFormularyForm();
    paintFormularyTable();
    if (state.preDoc === 'management') paintPre();
  });

  el('fmClose').addEventListener('ui-click', () => el('formularyModal').close());
}

/* ===================== Pre-procedure physical exam ===================== */

/**
 * The one line the report prints for the exam.
 *
 * All-normal collapses to the systems list, which is how a normal exam reads
 * on paper. Anything abnormal is named instead, because that is the part a
 * reader needs.
 */
function examSummary() {
  if (state.exam.flags.has('not-performed')) return 'Physical exam not performed.';

  const rows = EXAM_SYSTEMS.flatMap((group) =>
    group.rows.map((row) => ({ key: `${group.system}|${row.label}`, group, row }))
  );
  const abnormal = rows.filter((r) => !state.exam.normal.has(r.key));

  if (!abnormal.length) {
    return `${EXAM_SYSTEMS.map((s) => s.system).join(', ')} — all normal`;
  }

  const normalSystems = EXAM_SYSTEMS.filter((group) =>
    group.rows.every((row) => state.exam.normal.has(`${group.system}|${row.label}`))
  ).map((s) => s.system);

  // Systems with more than one row are qualified, so "Respiratory" does not
  // stand for the effort and the breath sounds at once.
  const findings = abnormal.map((r) => {
    const detail = state.exam.detail.get(r.key);
    const where =
      r.group.rows.length > 1
        ? `${r.group.system} (${r.row.label.toLowerCase()})`
        : r.group.system;
    return `${where} — ${detail || 'abnormal, not described'}`;
  });

  return `${normalSystems.length ? `${normalSystems.join(', ')} normal. ` : ''}${findings.join('; ')}.`;
}

function paintExamEditor() {
  el('examTabs').innerHTML = EXAM_TABS.map(
    (tab, index) => `<button type="button" class="enc__exam-tab" role="tab"
      aria-selected="${index === 0}" data-exam-tab="${index}">${esc(tab)}</button>`
  ).join('');

  el('examFlags').innerHTML = EXAM_FLAGS.map(
    (flag) => `<label class="enc__exam-flag">
      <input type="checkbox" data-flag="${flag.id}"
        ${state.exam.flags.has(flag.id) ? 'checked' : ''} />
      ${esc(flag.label)}
    </label>`
  ).join('');

  el('examSystems').innerHTML = EXAM_SYSTEMS.map(
    (group) => `<section class="enc__exam-group">
      <h4>${esc(group.system)}</h4>
      ${group.rows
        .map((row) => {
          const key = `${group.system}|${row.label}`;
          const normal = state.exam.normal.has(key);
          return `<div class="enc__exam-line">
            <label class="enc__exam-check">
              <input type="checkbox" data-row="${esc(key)}" ${normal ? 'checked' : ''} />
              <span>${esc(row.label)}</span>
            </label>
            <span class="enc__exam-tokens">
              ${row.tokens.map((t) => `<code>[${esc(t)}]</code>`).join(' ')}
            </span>
            <input type="text" class="enc__exam-detail" data-detail="${esc(key)}"
              value="${esc(state.exam.detail.get(key) ?? '')}"
              placeholder="${esc(row.normal)}" ${normal ? 'disabled' : ''} />
          </div>`;
        })
        .join('')}
    </section>`
  ).join('');

  /* --- Wiring --- */
  el('examTabs').querySelectorAll('[data-exam-tab]').forEach((tab) =>
    tab.addEventListener('click', () => {
      el('examTabs')
        .querySelectorAll('[data-exam-tab]')
        .forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      // Only the physical exam is built; the second tab says so rather than
      // showing an empty panel that looks broken.
      el('examSystems').hidden = tab.dataset.examTab !== '0';
      if (tab.dataset.examTab !== '0') {
        notify('Functional and mental status is not built in this prototype.', 'info');
      }
    })
  );

  el('examFlags').querySelectorAll('[data-flag]').forEach((box) =>
    box.addEventListener('change', () => {
      if (box.checked) state.exam.flags.add(box.dataset.flag);
      else state.exam.flags.delete(box.dataset.flag);
    })
  );

  // Ticking a row normal fills it from the template and locks the free text;
  // unticking hands it back so the abnormality can be described.
  el('examSystems').querySelectorAll('[data-row]').forEach((box) =>
    box.addEventListener('change', () => {
      const key = box.dataset.row;
      const detail = el('examSystems').querySelector(`[data-detail="${CSS.escape(key)}"]`);
      if (box.checked) {
        state.exam.normal.add(key);
        state.exam.detail.delete(key);
        detail.value = '';
        detail.disabled = true;
      } else {
        state.exam.normal.delete(key);
        detail.disabled = false;
        detail.focus();
      }
    })
  );

  el('examSystems').querySelectorAll('[data-detail]').forEach((input) =>
    input.addEventListener('input', () =>
      state.exam.detail.set(input.dataset.detail, input.value.trim())
    )
  );
}

function openExam(trigger) {
  paintExamEditor();
  el('examContext').optionList = EXAM_CONTEXTS.map((c) => ({ value: c, label: c }));
  el('examContext').setAttribute('value', 'Pre-procedure');
  el('examSet').optionList = EXAM_SYSTEM_SETS.map((s) => ({ value: s, label: s }));
  el('examSet').setAttribute('value', 'Systems');
  el('examDate').setAttribute('value', appointment?.date ?? '2026-08-05');
  el('examTime').setAttribute('value', state.exam.time);
  el('examModal').open(trigger);
}

/* ===================== In-procedure: the nursing record ====================
   Two documents the nurse works in the room, both built the same way: an
   entry form on the LEFT and what has been entered on the RIGHT, paired row
   by row. The pairing is the point — a nurse types a reading and reads it
   back in the same glance, without the record being somewhere else on the
   page or behind a dialog.

   These write into the SAME state the anaesthesia management document reads:
   state.vitals, state.meds, state.solutions, state.oxygen, state.aldrete.
   They are two views of one record, not two records. A drug given once must
   not be able to appear on one MAR and not the other.
   ========================================================================= */

const cardIcon = (name) =>
  `<svg class="ui-icon enc__panel-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

/** The initials the nursing record signs with — the nurse the checklist was
 *  recorded under, so one person is not two sets of initials in one encounter. */
const nurseInitials = () => initials(defaultPreSigner());

/**
 * The "Confirm My Initials" control.
 *
 * A press, not a text box. Typed initials are the field everyone fills with
 * whatever is quickest, and the point of the field is that a named person
 * says they gave the drug. Each form owns its own confirmation, because
 * signing for a dose and signing for a score are separate acts.
 */
function initialsFieldHtml(id, confirmed, testid) {
  const who = nurseInitials();
  return `<div class="enc__initials">
    <button type="button" id="${id}" data-testid="${testid}" aria-pressed="${confirmed}"
      class="enc__initials-button${confirmed ? ' enc__initials-button--on' : ''}">
      ${cardIcon(confirmed ? 'check' : 'user')}
      <span>${confirmed ? esc(who) : `Confirm My Initials (${esc(who)})`}</span>
    </button>
    <span class="enc__initials-hint">${
      confirmed ? 'Identity confirmed' : 'Click to confirm your identity'
    }</span>
  </div>`;
}

/* --- Current patient ------------------------------------------------------ */

/* --- Nursing times --------------------------------------------------------
   Three stamps taken in one order, each gating the next. The button on an
   ungated line says what is missing rather than sitting there disabled with
   no reason given — "Record Cecum Time First" is the instruction, and a plain
   greyed button is a dead end.
   ----------------------------------------------------------------------- */

/** cecum → end of procedure, in whole minutes. Never stored: a withdrawal
 *  time kept alongside the two stamps it comes from is a third number free to
 *  disagree with them. */
function withdrawalMinutes() {
  const { cecum, endOfProcedure } = state.nursingTimes;
  if (!cecum || !endOfProcedure) return null;
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const span = toMinutes(endOfProcedure) - toMinutes(cecum);
  return span >= 0 ? span : null;
}

function nursingTimesCard() {
  const t = state.nursingTimes;
  const withdrawal = withdrawalMinutes();

  const line = (label, value, button) => `<div class="enc__nt-row">
    <span class="enc__nt-label">${label}:</span>
    <span class="enc__nt-value${value ? '' : ' enc__nt-value--empty'}">
      <code>${value ? esc(value) : 'Not recorded'}</code>
    </span>
    ${button}
  </div>`;

  const stamp = (id, testid, label, enabled, blockedLabel) =>
    enabled
      ? `<ui-button variant="outline" size="sm" id="${id}" data-testid="${testid}">${label}</ui-button>`
      : `<ui-button variant="outline" size="sm" disabled data-own-disabled
           data-testid="${testid}">${blockedLabel}</ui-button>`;

  return card(
    `${cardIcon('clock')}Nursing Times`,
    `${line(
      'Time Out',
      t.timeOut,
      stamp('ntTimeOut', 'enc--nt-time-out', 'Record Time', !t.timeOut, 'Recorded')
    )}
    ${line(
      'Cecum Time',
      t.cecum,
      stamp('ntCecum', 'enc--nt-cecum', 'Record Time', Boolean(t.timeOut) && !t.cecum,
        t.cecum ? 'Recorded' : 'Record Time Out First')
    )}
    ${line(
      'End of Procedure Time',
      t.endOfProcedure,
      stamp('ntEnd', 'enc--nt-end', 'Record Time', Boolean(t.cecum) && !t.endOfProcedure,
        t.endOfProcedure ? 'Recorded' : 'Record Cecum Time First')
    )}
    <div class="enc__nt-row">
      <span class="enc__nt-label">Withdrawal Time:</span>
      <span class="enc__nt-value${withdrawal === null ? ' enc__nt-value--empty' : ''}">
        <code>${withdrawal === null ? 'Not calculated' : `${withdrawal} min`}</code>
      </span>
      <span class="enc__caption">(Auto-calculated)</span>
    </div>`,
    '',
    'enc--np-times'
  );
}

/* --- Vital signs ---------------------------------------------------------- */

function recordVitalsCard() {
  const d = state.vitalsDraft;
  const editing = state.vitalsEditing !== null;

  return card(
    'Record Vital Signs',
    `<ui-select id="npPhase" label="Procedure Phase" required
      placeholder="Select phase..." data-testid="enc--np-phase"></ui-select>
    <div class="enc__grid-2">
      <ui-input id="npSystolic" type="number" label="Systolic BP" placeholder="120"
        value="${esc(d.systolic)}" data-testid="enc--np-systolic"></ui-input>
      <ui-input id="npDiastolic" type="number" label="Diastolic BP" placeholder="80"
        value="${esc(d.diastolic)}" data-testid="enc--np-diastolic"></ui-input>
      <ui-input id="npHr" type="number" label="Heart Rate" placeholder="72"
        value="${esc(d.hr)}" data-testid="enc--np-hr"></ui-input>
      <ui-input id="npSpo2" type="number" label="SpO2 (%)" placeholder="98"
        value="${esc(d.spo2)}" data-testid="enc--np-spo2"></ui-input>
      <ui-input id="npResp" type="number" label="Resp Rate" placeholder="16"
        value="${esc(d.resp)}" data-testid="enc--np-resp"></ui-input>
      <ui-input id="npPain" type="number" label="Pain Level (0-10)" placeholder="0"
        value="${esc(d.pain)}" data-testid="enc--np-pain"></ui-input>
    </div>
    <ui-select id="npRamsay" label="Ramsay Sedation Scale" placeholder="Select..."
      data-testid="enc--np-ramsay"></ui-select>
    <div class="enc__np-submit">
      <ui-button variant="primary" id="npRecordVitals" data-testid="enc--np-record-vitals-save"
        >${editing ? 'Update Vitals' : 'Record Vitals'}</ui-button>
    </div>`,
    '',
    'enc--np-record-vitals'
  );
}

function vitalsSignsCard() {
  const latest = state.vitals.length - 1;
  const rows = state.vitals.map(
    (v, i) => `<tr class="${i === latest ? 'enc__log-row--latest' : ''}">
      <td class="enc__vs-time"><code>${esc(v.time)}</code>
        <button type="button" class="enc__row-edit" data-edit-vital="${i}"
          aria-label="Edit the ${esc(v.time)} reading" data-testid="enc--np-edit-vital-${i}">
          ${cardIcon('pencil')}
        </button></td>
      <td><ui-badge status="neutral">${esc(v.phase)}</ui-badge></td>
      <td><code>${esc(v.bp)}</code></td>
      <td>${esc(v.hr || '--')}</td>
      <td>${v.spo2 ? `${esc(v.spo2)}%` : '--'}</td>
      <td>${esc(v.resp || '--')}</td>
      <td>${v.pain === '' || v.pain === undefined ? '--/10' : `${esc(v.pain)}/10`}</td>
      <td>${esc(v.ramsay || '--')}</td>
    </tr>`
  );

  return card(
    `${cardIcon('vitals')}Vital Signs`,
    `${logTable(
      ['Time', 'Phase', 'BP', 'HR', 'SpO2', 'RR', 'Pain', 'Ramsay (RSS)'],
      rows,
      'No vital signs recorded'
    )}
    ${
      rows.length
        ? `<p class="enc__caption">Latest reading highlighted &middot; ${rows.length} total recording${
            rows.length === 1 ? '' : 's'
          }</p>`
        : ''
    }`,
    '',
    'enc--np-vitals'
  );
}

/* --- Aldrete -------------------------------------------------------------- */

/** The five categories under the names the nursing form asks them by. */
const ALDRETE_FORM_LABELS = {
  activity: 'Activity Level',
  respiration: 'Respiration',
  circulation: 'Circulation',
  consciousness: 'Consciousness',
  oxygen: 'Oxygen Saturation',
};

/** The same five, abbreviated for the history table's row headings. */
const ALDRETE_ROW_LABELS = {
  activity: 'Activity',
  respiration: 'Respiration',
  circulation: 'Circulation',
  consciousness: 'Consciousness',
  oxygen: 'O2 Sat',
};

const aldreteDraftTotal = () =>
  [...state.aldreteDraft.scores.values()].reduce((sum, n) => sum + n, 0);

function aldreteAssessmentCard() {
  const max = ALDRETE_CATEGORIES.length * 2;
  const total = aldreteDraftTotal();

  return card(
    `${cardIcon('document')}Aldrete Score Assessment`,
    `<p class="enc__caption">Post-Anesthesia Recovery Assessment (0-2 points each category)</p>
    <ui-select id="npAlPhase" label="Procedure Phase" required
      placeholder="Select procedure phase" data-testid="enc--np-al-phase"></ui-select>
    <div class="enc__grid-2">
      ${ALDRETE_CATEGORIES.map(
        (c) => `<ui-select id="npAl-${c.id}" label="${esc(ALDRETE_FORM_LABELS[c.id])}" required
          placeholder="Select ${ALDRETE_FORM_LABELS[c.id].toLowerCase()}"
          data-al="${c.id}" data-testid="enc--np-al-${c.id}"></ui-select>`
      ).join('')}
    </div>
    <div class="enc__np-total">
      <div>
        <strong>Total Score:</strong>
        <p class="enc__caption">Score must be &ge;${ALDRETE_THRESHOLD} for discharge</p>
      </div>
      <span class="enc__pill${total >= ALDRETE_THRESHOLD ? ' enc__pill--ok' : ''}"
        data-testid="enc--np-al-total">${total}/${max}</span>
    </div>
    <span class="ui-field__label">Staff Initials <span class="ui-field__required">*</span></span>
    ${initialsFieldHtml('npAlInitials', state.aldreteInitialsConfirmed, 'enc--np-al-initials')}
    <div class="enc__np-submit">
      <ui-button variant="primary" id="npRecordAldrete"
        data-testid="enc--np-record-aldrete">Record Aldrete Score</ui-button>
    </div>`,
    '',
    'enc--np-aldrete'
  );
}

/**
 * The history, transposed: one column per assessment, one row per category.
 *
 * Recovery reads this down a category — "is circulation improving" — not
 * across a timestamp, so the categories are the stable axis and each new
 * assessment adds a column.
 */
function aldreteHistoryCard() {
  const entries = state.aldreteHistory;
  const max = ALDRETE_CATEGORIES.length * 2;

  const body = entries.length
    ? `<div class="enc__table-scroll"><table class="enc__log enc__log--matrix">
        <thead><tr><th scope="col">Phase</th>${entries
          .map((e) => `<th scope="col">${esc(e.phase ?? e.time)}</th>`)
          .join('')}</tr></thead>
        <tbody>
          ${ALDRETE_CATEGORIES.map(
            (c) => `<tr><th scope="row">${esc(ALDRETE_ROW_LABELS[c.id])}</th>${entries
              .map((e) => `<td><code>${e[c.id] ?? 0}/2</code></td>`)
              .join('')}</tr>`
          ).join('')}
          <tr><th scope="row">Total</th>${entries
            .map(
              (e) => `<td><span class="enc__pill${
                e.total >= ALDRETE_THRESHOLD ? ' enc__pill--ok' : ''
              }">${e.total}/${max}</span></td>`
            )
            .join('')}</tr>
          <tr><th scope="row">Assessed By</th>${entries
            .map((e) => `<td>${esc(e.by)}</td>`)
            .join('')}</tr>
        </tbody>
      </table></div>`
    : `<p class="enc__empty">No Aldrete scores recorded yet</p>`;

  return card('Aldrete Score History', body, '', 'enc--np-aldrete-history');
}

/* --- Discharge ------------------------------------------------------------ */

function dischargeStatusCard() {
  const max = ALDRETE_CATEGORIES.length * 2;
  const latest = state.aldreteHistory[state.aldreteHistory.length - 1];
  const score = latest ? latest.total : null;
  const meets = score !== null && score >= ALDRETE_THRESHOLD;

  return card(
    `${cardIcon('check')}Patient Discharge Status`,
    `<section class="enc__np-criteria">
      <h3 class="enc__legend">Discharge Criteria Checklist</h3>
      <ul class="enc__np-criteria-list">
        ${DISCHARGE_READINESS_CHECKS.map(
          (c) => `<li data-testid="enc--np-criterion-${c.id}">${esc(c.label)}</li>`
        ).join('')}
      </ul>
    </section>

    <div class="enc__np-latest">
      ${cardIcon('document')}
      <div>
        <strong>Latest Aldrete Score</strong>
        <p class="enc__caption" data-testid="enc--np-latest-score">${
          score === null ? 'Not yet assessed' : `${score}/${max} points`
        }</p>
      </div>
      <ui-badge status="${meets ? 'success' : 'warning'}" data-testid="enc--np-threshold"
        >${meets ? 'Meets Threshold' : 'Below Threshold'}</ui-badge>
    </div>

    <div class="enc__np-ready">
      <ui-checkbox id="npReady" ${state.discharge.ready ? 'checked' : ''}
        data-testid="enc--np-ready">Ready for Discharge</ui-checkbox>
    </div>

    <p class="enc__caption enc__np-updated" data-testid="enc--np-updated"
      >Last updated: ${esc(state.nursingUpdatedAt)}</p>`,
    '',
    'enc--np-discharge'
  );
}

/**
 * The seven panels of the record, in the order the case is worked.
 *
 * Who is on the table, the stamps, the observations, the recovery score, the
 * discharge decision — then what was given, which is the running half and sits
 * under the assessment it explains rather than in a document of its own.
 */
function nursingPanels() {
  return `<div class="enc__np">
    ${nursingTimesCard()}
    <div class="enc__grid-2">
      ${recordVitalsCard()}
      ${vitalsSignsCard()}
    </div>
    <div class="enc__grid-2">
      ${aldreteAssessmentCard()}
      ${aldreteHistoryCard()}
    </div>
    <div class="enc__grid-2">
      ${administerMedicationCard()}
      ${marCard()}
    </div>
    <div class="enc__grid-2">
      ${ivSolutionsCard()}
      ${ivHistoryCard()}
    </div>
    <div class="enc__grid-2">
      ${oxygenCard()}
      ${oxygenHistoryCard()}
    </div>
    ${/* Last, because it is the decision everything above it feeds — the
         Aldrete score it reads back is not final until the record is. */ ''}
    ${dischargeStatusCard()}
  </div>`;
}

/* --- Medications ---------------------------------------------------------- */

/** The route codes the record stores, under the names the form asks by. */
const ROUTE_LABELS = {
  IV: 'Intravenous (IV)',
  IM: 'Intramuscular (IM)',
  PO: 'Oral (PO)',
  SL: 'Sublingual (SL)',
  Topical: 'Topical',
  PR: 'Rectal (PR)',
};

function administerMedicationCard() {
  const d = state.medDraft;

  return card(
    `${cardIcon('plus')}Administer Medication`,
    `<ui-input id="npMedTime" type="datetime-local" label="Administration Time" required
      value="${esc(d.time)}" data-testid="enc--np-med-time"></ui-input>

    <ui-input id="npMedName" label="Medication Name" required
      placeholder="Search medication or type name..."
      value="${esc(d.name)}" data-testid="enc--np-med-name"></ui-input>

    <section class="enc__np-formulary">
      <h3 class="enc__legend">Quick Select from Formulary:</h3>
      ${state.formulary
        .map(
          (drug, index) => `<button type="button" class="enc__np-drug" data-np-drug="${index}"
            data-testid="enc--np-drug-${drug.name.toLowerCase()}">
            <strong>${esc(drug.name)}</strong>
            <span>${esc(drug.strength)} &bull; ${esc(drug.route ?? 'IV')}</span>
          </button>`
        )
        .join('')}
    </section>

    <ui-input id="npMedDose" label="Dosage" required
      placeholder="e.g., 5mg/kg/hr, 10mg, 0.5ml"
      value="${esc(d.dose)}" data-testid="enc--np-med-dose"></ui-input>

    <ui-select id="npMedRoute" label="Route" required data-testid="enc--np-med-route"></ui-select>

    <span class="ui-field__label">Staff Initials <span class="ui-field__required">*</span></span>
    ${initialsFieldHtml('npMedInitials', state.medInitialsConfirmed, 'enc--np-med-initials')}

    <ui-textarea id="npMedNotes" label="Notes" rows="3" placeholder="Additional notes..."
      value="${esc(d.notes)}" data-testid="enc--np-med-notes"></ui-textarea>
    <div class="enc__np-submit">
      <ui-button variant="primary" id="npRecordMed"
        data-testid="enc--np-record-med">Record Administration</ui-button>
    </div>`,
    '',
    'enc--np-administer'
  );
}

function marCard() {
  const rows = state.meds.map(
    (m) => `<tr>
      <td><code>${esc(m.time)}</code></td>
      <td><code>${esc(m.name)}</code></td>
      <td><code>${esc(m.dose)}</code></td>
      <td>${esc(m.route)}</td>
      <td>${esc(m.by)}</td>
    </tr>`
  );

  return card(
    'Medication Administration Record',
    logTable(
      ['Administration Time', 'Medication Name', 'Dose', 'Route', 'Initials'],
      rows,
      'No medications administered'
    ),
    '',
    'enc--np-mar'
  );
}

/* --- IV solutions ------------------------------------------------------------
   The card has two faces. Closed it lists what is running, each line with the
   End that stops it; open it IS the form that starts one. A drawer over the
   page was the wrong shape here — this panel is half of a pair, and a dialog
   covering the history beside it hides the answer to "what is already up".
   -------------------------------------------------------------------------- */

function ivFormCard() {
  const d = state.ivDraft;
  return card(
    `${cardIcon('vitals')}Start IV Solution`,
    `<ui-select id="npIvType" label="Solution Type" required
      placeholder="Select solution type" data-testid="enc--np-iv-type"></ui-select>
    <div class="enc__grid-2">
      <ui-input id="npIvVolume" type="number" label="Volume (mL)" required
        placeholder="Select or enter volume" value="${esc(d.volume)}"
        data-testid="enc--np-iv-volume"></ui-input>
      <ui-select id="npIvRate" label="Rate" required
        placeholder="Select rate" data-testid="enc--np-iv-rate"></ui-select>
    </div>
    <span class="ui-field__label">Staff Initials <span class="ui-field__required">*</span></span>
    ${initialsFieldHtml('npIvInitials', state.ivInitialsConfirmed, 'enc--np-iv-initials')}
    <ui-textarea id="npIvNotes" label="Notes" rows="3" placeholder="Additional notes..."
      value="${esc(d.notes)}" data-testid="enc--np-iv-notes"></ui-textarea>
    <div class="enc__np-submit">
      <ui-button variant="primary" id="npIvSave"
        data-testid="enc--np-iv-save">Start IV Solution</ui-button>
    </div>`,
    `<button type="button" class="enc__np-close" id="npIvCancel"
       aria-label="Cancel starting a solution" data-testid="enc--np-iv-cancel">
       ${cardIcon('close')}</button>`,
    'enc--np-iv'
  );
}

function ivSolutionsCard() {
  if (state.ivFormOpen) return ivFormCard();

  const running = state.solutions
    .map((s, i) => ({ ...s, _i: i }))
    .filter((s) => s.status === 'Active');

  return card(
    `${cardIcon('vitals')}IV Solutions`,
    running.length
      ? `<ul class="enc__np-running">${running
          .map(
            (s) => `<li data-testid="enc--np-iv-running-${s._i}">
              <div>
                <strong>${esc(s.solution)}</strong>
                <span>${esc(s.volume)}mL at ${esc(s.rate)}</span>
                <span>Started: ${esc(s.time)}</span>
              </div>
              <ui-button variant="outline" size="sm" data-end-iv="${s._i}"
                data-testid="enc--np-end-iv-${s._i}">End</ui-button>
            </li>`
          )
          .join('')}</ul>`
      : `<p class="enc__empty">No IV solutions started</p>`,
    `<ui-button variant="outline" size="sm" icon="plus" id="npStartIv"
       data-testid="enc--np-start-iv">Start IV Solution</ui-button>`,
    'enc--np-iv'
  );
}

function ivHistoryCard() {
  const rows = state.solutions.map(
    (s) => `<tr>
      <td><span class="enc__np-started">Started:</span><br><code>${esc(s.time)}</code></td>
      <td>${esc(s.solution)}</td>
      <td><code>${esc(s.volume)}mL @ ${esc(s.rate)}</code></td>
      <td><ui-badge status="${s.status === 'Active' ? 'success' : 'neutral'}">${esc(s.status)}</ui-badge></td>
    </tr>`
  );

  return card(
    'IV Solutions History',
    logTable(['Time', 'Solution', 'Volume/Rate', 'Status'], rows, 'No IV solutions started'),
    '',
    'enc--np-iv-history'
  );
}

/* --- Oxygen ---------------------------------------------------------------- */

function oxygenFormCard() {
  const d = state.o2Draft;
  return card(
    `${cardIcon('vitals')}Record Oxygen Administration`,
    `<ui-input id="npO2Time" type="datetime-local" label="Administration Time" required
      value="${esc(d.time)}" data-testid="enc--np-o2-time"></ui-input>
    <div class="enc__grid-2">
      <ui-input id="npO2Flow" type="number" label="Flow Rate (L/min)" required
        placeholder="2" value="${esc(d.flow)}" data-testid="enc--np-o2-flow"></ui-input>
      <ui-select id="npO2Delivery" label="Delivery Method" required
        placeholder="Select method" data-testid="enc--np-o2-delivery"></ui-select>
    </div>
    <span class="ui-field__label">Staff Initials <span class="ui-field__required">*</span></span>
    ${initialsFieldHtml('npO2Initials', state.o2InitialsConfirmed, 'enc--np-o2-initials')}
    <ui-textarea id="npO2Notes" label="Notes" rows="3"
      placeholder="Additional notes about oxygen administration..."
      value="${esc(d.notes)}" data-testid="enc--np-o2-notes"></ui-textarea>
    <div class="enc__np-submit">
      <ui-button variant="primary" id="npO2Save"
        data-testid="enc--np-o2-save">Record Oxygen Administration</ui-button>
    </div>`,
    `<button type="button" class="enc__np-close" id="npO2Cancel"
       aria-label="Cancel recording oxygen" data-testid="enc--np-o2-cancel">
       ${cardIcon('close')}</button>`,
    'enc--np-o2'
  );
}

function oxygenCard() {
  if (state.o2FormOpen) return oxygenFormCard();

  const running = state.oxygen
    .map((o, i) => ({ ...o, _i: i }))
    .filter((o) => o.status === 'Active');

  return card(
    `${cardIcon('vitals')}Oxygen Administration`,
    running.length
      ? `<ul class="enc__np-running">${running
          .map(
            (o) => `<li data-testid="enc--np-o2-running-${o._i}">
              <div>
                <strong>${esc(o.delivery)}</strong>
                <span>${esc(o.flow)} L/min</span>
                <span>Started: ${esc(o.time)}</span>
              </div>
              <ui-button variant="outline" size="sm" data-end-o2="${o._i}"
                data-testid="enc--np-end-o2-${o._i}">End</ui-button>
            </li>`
          )
          .join('')}</ul>`
      : `<p class="enc__empty">Click "Record Oxygen" to document oxygen administration</p>`,
    `<ui-button variant="outline" size="sm" icon="plus" id="npRecordO2"
       data-testid="enc--np-record-o2">Record Oxygen</ui-button>`,
    'enc--np-o2'
  );
}

function oxygenHistoryCard() {
  const rows = state.oxygen.map(
    (o) => `<tr>
      <td><span class="enc__np-started">Started:</span><br><code>${esc(o.time)}</code></td>
      <td>${esc(o.delivery)}</td>
      <td><code>${esc(o.flow)} L/min</code></td>
      <td><ui-badge status="${o.status === 'Active' ? 'success' : 'neutral'}">${esc(o.status)}</ui-badge></td>
    </tr>`
  );

  return card(
    'Oxygen Administration History',
    logTable(['Time', 'Delivery', 'Flow', 'Status'], rows, 'No oxygen administration records yet'),
    '',
    'enc--np-o2-history'
  );
}


/* --- Wiring ---------------------------------------------------------------
   The record repaints through paintPre(), which rebuilds the open step and
   rebinds it — the same shape the other three steps of this stage use.
   ----------------------------------------------------------------------- */

/** '07/08/2026, 17:07:21' — the stamp the discharge panel reads back. */
function stampNow() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(',', ',');
}

/** Mark the record touched, then repaint the tab that changed. */
function nursingChanged() {
  state.nursingUpdatedAt = stampNow();
  paintPre();
}

/** Read a <ui-input>'s live value, falling back to its attribute. */
const fieldValue = (id) => el(id)?.value ?? '';

/**
 * Now, in the exact shape a datetime-local wants.
 *
 * 'YYYY-MM-DDTHH:MM'. Anything else and the control shows empty without
 * complaining, which reads as "no time was taken" rather than as a bug.
 */
function localDateTimeNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

/** Bind the whole record — both halves, in one pass over the rebuilt step. */
function wireNursing() {
  wireNursingRecord();
  wireMedicationRecord();
}

function wireNursingRecord() {
  /* --- Nursing times --- */
  el('ntTimeOut')?.addEventListener('ui-click', () => {
    state.nursingTimes.timeOut = nowTime();
    nursingChanged();
    notify(`Time out recorded at ${state.nursingTimes.timeOut}.`);
  });
  el('ntCecum')?.addEventListener('ui-click', () => {
    state.nursingTimes.cecum = nowTime();
    nursingChanged();
    notify(`Cecum time recorded at ${state.nursingTimes.cecum}.`);
  });
  el('ntEnd')?.addEventListener('ui-click', () => {
    state.nursingTimes.endOfProcedure = nowTime();
    nursingChanged();
    notify(`End of procedure recorded at ${state.nursingTimes.endOfProcedure}.`);
  });

  /* --- The vitals form --- */
  options('npPhase', PROCEDURE_PHASES, state.vitalsDraft.phase);
  const ramsay = el('npRamsay');
  if (ramsay) {
    ramsay.optionList = RAMSAY_SCALE;
    setValue(ramsay, state.vitalsDraft.ramsay);
  }

  /* Held softly: the draft is read back off the DOM when Record is pressed,
     so typing never triggers the repaint that would take the caret with it.
     Only the two selects write through, because they cannot be mid-edit. */
  el('npPhase')?.addEventListener('ui-change', (e) => {
    state.vitalsDraft.phase = e.detail.value;
  });
  ramsay?.addEventListener('ui-change', (e) => {
    state.vitalsDraft.ramsay = e.detail.value;
  });

  el('npRecordVitals')?.addEventListener('ui-click', () => {
    const draft = {
      phase: state.vitalsDraft.phase,
      systolic: fieldValue('npSystolic'),
      diastolic: fieldValue('npDiastolic'),
      hr: fieldValue('npHr'),
      spo2: fieldValue('npSpo2'),
      resp: fieldValue('npResp'),
      pain: fieldValue('npPain'),
      ramsay: state.vitalsDraft.ramsay,
    };

    if (!draft.phase) {
      notify('A procedure phase says when the reading was taken — pick one.', 'warning');
      return;
    }
    if (!draft.systolic || !draft.diastolic) {
      notify('A blood pressure is the minimum an observation has to carry.', 'warning');
      return;
    }

    const entry = {
      time: nowTime(),
      phase: draft.phase,
      bp: `${draft.systolic}/${draft.diastolic}`,
      hr: draft.hr,
      spo2: draft.spo2,
      resp: draft.resp,
      pain: draft.pain,
      ramsay: draft.ramsay,
      by: nurseInitials(),
      high: Number(draft.systolic) >= 160,
    };

    if (state.vitalsEditing === null) {
      state.vitals.push(entry);
    } else {
      /* A correction keeps the time it was taken at — the stamp records when
         the observation happened, not when the typo was noticed. */
      entry.time = state.vitals[state.vitalsEditing].time;
      state.vitals[state.vitalsEditing] = entry;
      state.vitalsEditing = null;
    }

    state.vitalsDraft = { phase: '', systolic: '', diastolic: '', hr: '', spo2: '', resp: '', pain: '', ramsay: '' };
    nursingChanged();
    notify(`Vital signs recorded for ${entry.phase}.`);
  });

  /* Correcting a reading loads it back into the form that took it, rather
     than opening a second editor that could save a different shape. */
  document.querySelectorAll('[data-edit-vital]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.dataset.editVital);
      const v = state.vitals[index];
      const [systolic = '', diastolic = ''] = String(v.bp ?? '').split('/');
      state.vitalsEditing = index;
      state.vitalsDraft = {
        phase: v.phase ?? '', systolic, diastolic,
        hr: v.hr ?? '', spo2: v.spo2 ?? '', resp: v.resp ?? '',
        pain: v.pain ?? '', ramsay: v.ramsay ?? '',
      };
      paintPre();
      el('npSystolic')?.focus();
    })
  );

  /* --- The Aldrete form --- */
  /* The Aldrete form asks its own three phases, not the four every other thing
     charted in this record files against: the score is a recovery instrument
     and there is nothing to score mid-scope. See ALDRETE_PHASES in
     data/procedure-encounter.js. */
  options('npAlPhase', ALDRETE_PHASES, state.aldreteDraft.phase);
  el('npAlPhase')?.addEventListener('ui-change', (e) => {
    state.aldreteDraft.phase = e.detail.value;
  });

  ALDRETE_CATEGORIES.forEach((c) => {
    const node = el(`npAl-${c.id}`);
    if (!node) return;
    node.optionList = c.options.map((o) => ({
      value: String(o.points),
      label: `${o.label} — ${o.points}`,
    }));
    const held = state.aldreteDraft.scores.get(c.id);
    setValue(node, held === undefined ? '' : String(held));
    node.addEventListener('ui-change', (event) => {
      if (event.detail.value === '') state.aldreteDraft.scores.delete(c.id);
      else state.aldreteDraft.scores.set(c.id, Number(event.detail.value));
      paintPre();
    });
  });

  el('npAlInitials')?.addEventListener('click', () => {
    state.aldreteInitialsConfirmed = !state.aldreteInitialsConfirmed;
    paintPre();
  });

  el('npRecordAldrete')?.addEventListener('ui-click', () => {
    const { phase, scores } = state.aldreteDraft;
    if (!phase) {
      notify('An Aldrete score belongs to a phase — pick one.', 'warning');
      return;
    }
    if (scores.size < ALDRETE_CATEGORIES.length) {
      notify('Every category has to be scored before the assessment can be filed.', 'warning');
      return;
    }
    if (!state.aldreteInitialsConfirmed) {
      notify('Confirm your initials before recording the assessment.', 'warning');
      return;
    }

    const total = aldreteDraftTotal();
    const entry = { time: nowTime(), phase, total, by: nurseInitials() };
    ALDRETE_CATEGORIES.forEach((c) => {
      entry[c.id] = scores.get(c.id);
      /* The current score the post-procedure document and the discharge gate
         read moves with the newest assessment, so a third view of the Aldrete
         cannot drift from the two that already share it. */
      state.aldrete.set(c.id, scores.get(c.id));
    });
    state.aldreteHistory.push(entry);

    if (total >= ALDRETE_THRESHOLD) state.criteria.add('aldrete');
    else state.criteria.delete('aldrete');

    state.aldreteDraft = { phase: '', scores: new Map() };
    state.aldreteInitialsConfirmed = false;
    nursingChanged();
    notify(`Aldrete score of ${total} recorded for ${phase}.`);
  });

  /* --- Discharge --- */
  el('npReady')?.addEventListener('ui-change', (event) => {
    state.discharge.ready = event.detail.checked;
    nursingChanged();
  });
}

function wireMedicationRecord() {
  const d = state.medDraft;

  if (!d.time) {
    d.time = localDateTimeNow();
    setValue(el('npMedTime'), d.time);
  }

  const route = el('npMedRoute');
  if (route) {
    route.optionList = MEDICATION_ROUTES.map((r) => ({ value: r, label: ROUTE_LABELS[r] ?? r }));
    setValue(route, d.route);
  }
  route?.addEventListener('ui-change', (event) => {
    state.medDraft.route = event.detail.value;
  });

  /* Quick select fills the two fields it knows and leaves the dose to the
     person giving it — a pre-filled dose is the one nobody re-reads. */
  document.querySelectorAll('[data-np-drug]').forEach((button) =>
    button.addEventListener('click', () => {
      const drug = state.formulary[Number(button.dataset.npDrug)];
      state.medDraft = {
        ...state.medDraft,
        time: fieldValue('npMedTime') || state.medDraft.time,
        name: drug.name,
        dose: fieldValue('npMedDose'),
        notes: fieldValue('npMedNotes'),
        route: drug.route ?? state.medDraft.route,
      };
      paintPre();
      el('npMedDose')?.focus();
    })
  );

  el('npMedInitials')?.addEventListener('click', () => {
    state.medDraft = {
      ...state.medDraft,
      time: fieldValue('npMedTime'),
      name: fieldValue('npMedName'),
      dose: fieldValue('npMedDose'),
      notes: fieldValue('npMedNotes'),
    };
    state.medInitialsConfirmed = !state.medInitialsConfirmed;
    paintPre();
  });

  el('npRecordMed')?.addEventListener('ui-click', () => {
    const entry = {
      time: fieldValue('npMedTime'),
      name: fieldValue('npMedName').trim(),
      dose: fieldValue('npMedDose').trim(),
      route: state.medDraft.route,
      notes: fieldValue('npMedNotes').trim(),
    };

    if (!entry.time) {
      notify('An administration time is what makes this a record — enter one.', 'warning');
      return;
    }
    if (!entry.name) {
      notify('Name the medication before recording it.', 'warning');
      return;
    }
    if (!entry.dose) {
      notify('A dose is required — "given" without how much is not a record.', 'warning');
      return;
    }
    if (!state.medInitialsConfirmed) {
      notify('Confirm your initials before recording the administration.', 'warning');
      return;
    }

    state.meds.push({
      /* The MAR shows a clock, not a datetime — the date is the encounter's. */
      time: entry.time.includes('T') ? entry.time.split('T')[1] : entry.time,
      name: entry.name,
      dose: entry.dose,
      route: entry.route,
      category: state.formulary.find((f) => f.name === entry.name)?.reversal
        ? 'reversal'
        : 'sedation',
      by: nurseInitials(),
      notes: entry.notes,
    });
    state.meds.sort((a, b) => a.time.localeCompare(b.time));

    state.medDraft = { time: '', name: '', dose: '', route: entry.route, notes: '' };
    state.medInitialsConfirmed = false;
    nursingChanged();
    notify(`${entry.name} ${entry.dose} recorded.`);
  });

  /* IV and oxygen reuse the drawers the management document already opens,
     so a solution started from either view is one entry in one list. */
  wireIvSolutions();
  wireOxygen();
}

/** 'Started: 17:15:31' — the clock a running line and its history row agree on. */
const startedAt = () => new Date().toTimeString().slice(0, 8);

function wireIvSolutions() {
  el('npStartIv')?.addEventListener('ui-click', () => {
    state.ivFormOpen = true;
    paintPre();
    el('npIvType')?.focus();
  });

  el('npIvCancel')?.addEventListener('click', () => {
    state.ivFormOpen = false;
    state.ivDraft = { type: '', volume: '', rate: '', notes: '' };
    state.ivInitialsConfirmed = false;
    paintPre();
  });

  const type = el('npIvType');
  if (type) {
    options('npIvType', IV_SOLUTION_TYPES, state.ivDraft.type);
    type.addEventListener('ui-change', (event) => {
      state.ivDraft.type = event.detail.value;
    });
  }

  const rate = el('npIvRate');
  if (rate) {
    options('npIvRate', IV_RATES, state.ivDraft.rate);
    rate.addEventListener('ui-change', (event) => {
      state.ivDraft.rate = event.detail.value;
    });
  }

  el('npIvInitials')?.addEventListener('click', () => {
    state.ivDraft.volume = fieldValue('npIvVolume');
    state.ivDraft.notes = fieldValue('npIvNotes');
    state.ivInitialsConfirmed = !state.ivInitialsConfirmed;
    paintPre();
  });

  el('npIvSave')?.addEventListener('ui-click', () => {
    const { type: solution, rate: flowRate } = state.ivDraft;
    const volume = fieldValue('npIvVolume');

    if (!solution) return notify('Pick the solution before starting it.', 'warning');
    if (!volume) return notify('A volume is required — a bag with no size is not a record.', 'warning');
    if (!flowRate) return notify('Pick the rate it is running at.', 'warning');
    if (!state.ivInitialsConfirmed) {
      return notify('Confirm your initials before starting the solution.', 'warning');
    }

    state.solutions.push({
      time: startedAt(),
      solution,
      volume,
      rate: flowRate,
      status: 'Active',
      notes: fieldValue('npIvNotes'),
      by: nurseInitials(),
    });

    state.ivFormOpen = false;
    state.ivDraft = { type: '', volume: '', rate: '', notes: '' };
    state.ivInitialsConfirmed = false;
    nursingChanged();
    notify(`${solution} started at ${flowRate} ml/h.`);
  });

  /* Ending a solution keeps the row — the bag ran, and a record that removed
     it would be saying it never did. */
  document.querySelectorAll('[data-end-iv]').forEach((button) =>
    button.addEventListener('ui-click', () => {
      const entry = state.solutions[Number(button.dataset.endIv)];
      entry.status = 'Ended';
      entry.stopTime = startedAt();
      nursingChanged();
      notify(`${entry.solution} stopped.`);
    })
  );
}

function wireOxygen() {
  el('npRecordO2')?.addEventListener('ui-click', () => {
    state.o2FormOpen = true;
    if (!state.o2Draft.time) state.o2Draft.time = localDateTimeNow();
    paintPre();
    el('npO2Flow')?.focus();
  });

  el('npO2Cancel')?.addEventListener('click', () => {
    state.o2FormOpen = false;
    state.o2Draft = { time: '', flow: '', delivery: '', notes: '' };
    state.o2InitialsConfirmed = false;
    paintPre();
  });

  const delivery = el('npO2Delivery');
  if (delivery) {
    options('npO2Delivery', OXYGEN_DELIVERY, state.o2Draft.delivery);
    delivery.addEventListener('ui-change', (event) => {
      state.o2Draft.delivery = event.detail.value;
    });
  }

  el('npO2Initials')?.addEventListener('click', () => {
    state.o2Draft.time = fieldValue('npO2Time');
    state.o2Draft.flow = fieldValue('npO2Flow');
    state.o2Draft.notes = fieldValue('npO2Notes');
    state.o2InitialsConfirmed = !state.o2InitialsConfirmed;
    paintPre();
  });

  el('npO2Save')?.addEventListener('ui-click', () => {
    const time = fieldValue('npO2Time');
    const flow = fieldValue('npO2Flow');
    const method = state.o2Draft.delivery;

    if (!time) return notify('An administration time is what makes this a record.', 'warning');
    if (!flow) return notify('A flow rate is required.', 'warning');
    if (!method) return notify('Pick how the oxygen is being delivered.', 'warning');
    if (!state.o2InitialsConfirmed) {
      return notify('Confirm your initials before recording the administration.', 'warning');
    }

    state.oxygen.push({
      time: time.includes('T') ? `${time.split('T')[1]}:00` : time,
      delivery: method,
      flow,
      status: 'Active',
      notes: fieldValue('npO2Notes'),
      by: nurseInitials(),
    });

    state.o2FormOpen = false;
    state.o2Draft = { time: '', flow: '', delivery: '', notes: '' };
    state.o2InitialsConfirmed = false;
    nursingChanged();
    notify(`${method} at ${flow} L/min recorded.`);
  });

  document.querySelectorAll('[data-end-o2]').forEach((button) =>
    button.addEventListener('ui-click', () => {
      const entry = state.oxygen[Number(button.dataset.endO2)];
      entry.status = 'Ended';
      entry.stopTime = startedAt();
      nursingChanged();
      notify(`${entry.delivery} stopped.`);
    })
  );
}

/* ===================== In-procedure: H&P / Orders / report switch ========= */

/**
 * The three documents available while In-procedure is open.
 *
 * "Pre-procedure" here is the History & Physical — a different document from
 * the pre-procedure STAGE's anaesthesia paperwork, kept on hand so the
 * endoscopist can check it without leaving the charting view.
 */
const INTRA_TABS = [
  { id: 'hp', label: 'Pre-procedure' },
  { id: 'orders', label: 'Orders' },
  { id: 'report', label: 'Procedure Report' },
];

const REPORT_TYPES = [
  { id: 'colonoscopy', label: 'Colonoscopy Report' },
  { id: 'egd', label: 'EGD Report' },
];

function paintIntraTabs() {
  el('intraTabs').innerHTML = INTRA_TABS.map(
    (tab) => `<button type="button" class="enc__exam-tab" role="tab"
      aria-selected="${tab.id === state.intraTab}" data-intra-tab="${tab.id}"
      data-testid="enc--intra-tab-${tab.id}">${esc(tab.label)}</button>`
  ).join('');

  el('intraTabs').querySelectorAll('[data-intra-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      state.intraTab = button.dataset.intraTab;
      paintIntra();
    })
  );
}

function paintReportTypeTabs() {
  el('reportTypeTabs').innerHTML = REPORT_TYPES.map((type) => {
    const signed = type.id === 'colonoscopy' ? state.signed : state.egdSign.signed;
    return `<button type="button" class="enc__exam-tab" role="tab"
      aria-selected="${type.id === state.reportType}" data-report-type="${type.id}"
      data-testid="enc--report-type-${type.id}">
      ${esc(type.label)}${signed ? ' <span class="enc__exam-tab-check" aria-hidden="true">✓</span>' : ''}
    </button>`;
  }).join('');

  el('reportTypeTabs').querySelectorAll('[data-report-type]').forEach((button) =>
    button.addEventListener('click', () => {
      state.reportType = button.dataset.reportType;
      paintIntra();
    })
  );
}

/**
 * The dispatcher for everything beside the In-procedure stage tabs — mirrors
 * paintPre()'s "paint the tab bar, then swap the one body that is showing"
 * shape, just across three documents instead of one.
 */
function paintIntra() {
  paintIntraTabs();

  el('intraHp').hidden = state.intraTab !== 'hp';
  el('intraOrders').hidden = state.intraTab !== 'orders';
  el('intraReport').hidden = state.intraTab !== 'report';

  if (state.intraTab === 'hp') {
    el('intraHp').innerHTML = hpBody();
    wireHp();
  } else if (state.intraTab === 'orders') {
    el('intraOrders').innerHTML = ordersBody();
    wireOrderSet(ORDER_SET_VIEWS.intra);
  } else {
    paintReportTypeTabs();
    el('colonoscopyReport').hidden = state.reportType !== 'colonoscopy';
    el('egdDoc').hidden = state.reportType !== 'egd';
    if (state.reportType === 'egd') {
      el('egdDoc').innerHTML = egdBody();
      wireEgd();
    }
  }

  updateHint();
}

/** The provider currently charting — same fallback paintDoc() uses, so the
 *  name on every signed document in this encounter agrees. */
function actingProvider() {
  return providerById(appointment?.providerId)?.name
    ? `${providerById(appointment.providerId).name}, MD`
    : REPORT_STAFF.endoscopist;
}

/* --- Pre-procedure H&P ------------------------------------------------------- */

/**
 * The H&P's history section, written from the record rather than about it.
 *
 * This used to be three lines of "Reviewed and updated in the EMR" — true, and
 * useless to the endoscopist reading it, who then had to leave the document for
 * the record it was pointing at. The four rows below are the four facts asked
 * for before a sedation case: what the patient has, what has already been done
 * to them, what they react to, and what they take.
 *
 * They are read from CLINICAL_SECTIONS (data/encounter.js) — the same list the
 * patient rail on the left of this screen shows. Two lists of a patient's
 * allergies is two answers to the question the sedation depends on, so there is
 * one list, quoted wherever it is needed.
 *
 * Read-only: a history corrected here and not in the record is a correction the
 * next clinician never sees.
 */
const HP_HISTORY_ROWS = [
  { id: 'history', label: 'Medical history' },
  { id: 'surgical', label: 'Surgical history' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'medications', label: 'Current Medications' },
];

function historyRowHtml(label, items) {
  /* A row with nothing behind it says so in words rather than going blank — a
     blank beside "Allergies" on a document somebody is about to sedate from
     reads as "none", and none is a positive statement no record here made. */
  const body = items.length
    ? `<ul class="enc__kv-sublist">${items
        .map(
          (item) => `<li${item.critical ? ' class="enc__kv-flag"' : ''}>
            <span class="enc__kv-sub-text">${esc(item.text)}</span>
            ${item.meta ? `<span class="enc__kv-sub-meta">${esc(item.meta)}</span>` : ''}
          </li>`
        )
        .join('')}</ul>`
    : '<span class="enc__kv-sub-meta">Nothing recorded — see the record</span>';

  return `<div><dt>${esc(label)}</dt><dd>${body}</dd></div>`;
}

function patientHistoryHtml() {
  return `<dl class="enc__kv-list" data-testid="enc--hp-history-list">
    ${HP_HISTORY_ROWS.map((row) =>
      historyRowHtml(row.label, CLINICAL_SECTIONS.find((s) => s.id === row.id)?.items || [])
    ).join('')}
  </dl>
  <p class="enc__kv-line">
    <strong>Allergies confirmed:</strong> See pre-procedure checklist
  </p>`;
}

function physicalExamSummaryHtml() {
  /* Five selects in one grid rather than four in a grid and a fifth on its own
     line below a sentence. The airway is a finding like the other four — it was
     full-width only because it happened to be added last, and a control that is
     twice the width of its peers reads as twice as important. */
  return `<div class="enc__grid-2 enc__vn-grid">
    <ui-select id="hpGeneral" label="General" data-testid="enc--hp-general"></ui-select>
    <ui-select id="hpLung" label="Lung" data-testid="enc--hp-lung"></ui-select>
    <ui-select id="hpCv" label="CV" data-testid="enc--hp-cv"></ui-select>
    <ui-select id="hpNeuro" label="Neuro" data-testid="enc--hp-neuro"></ui-select>
    <ui-select id="hpAirway" label="Airway Assessment" data-testid="enc--hp-airway"></ui-select>
  </div>
  <p class="enc__kv-line"><strong>Vitals:</strong> See Nurse/Anesthesia monitoring</p>`;
}

function assessmentPlanHtml() {
  const h = state.hp;
  const procedureLabel = appointment?.procedureId
    ? procedureById(appointment.procedureId)?.title
    : typeById(appointment?.typeId)?.title ?? 'Procedure';

  return `<p class="enc__kv-line"><strong>Procedure:</strong> ${esc(procedureLabel)}</p>
  <ui-textarea id="hpIndication" label="Indication" rows="3"
    placeholder="Enter or edit indication..." data-testid="enc--hp-indication"></ui-textarea>
  ${indicationCodesHtml('hp', h.indicationCodes, 'enc--hp-codes')}
  <ui-select id="hpAsa" label="ASA Classification" data-testid="enc--hp-asa"></ui-select>
  <p class="enc__kv-line"><strong>NPO Status:</strong> Verified per pre-procedure checklist</p>
  <p class="enc__kv-line">${esc(HP_ASSESSMENT_STATEMENT)}</p>`;
}

function hpSignatureHtml() {
  const s = state.hpSign;
  if (s.signed) {
    return `<div class="enc__signed-panel" data-testid="enc--hp-signed-panel">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
      <div>
        <strong>H&amp;P Electronically Signed</strong>
        <p>Signed by: ${esc(s.signedBy)} · Date: ${esc(s.signedDate)} · Time: ${esc(s.signedTime)}</p>
      </div>
      <ui-button variant="outline" size="sm" id="hpReSign"
        data-testid="enc--hp-resign">Clear Signature &amp; Re-sign</ui-button>
    </div>`;
  }
  return `<div class="enc__sign-panel">
    <p class="enc__caption">
      By signing, you confirm that you have reviewed and approve this pre-procedure H&amp;P.
      Signing as: ${esc(actingProvider())}
    </p>
    <ui-button variant="primary" size="sm" id="hpSign" data-testid="enc--hp-sign">Sign H&amp;P</ui-button>
  </div>`;
}

/**
 * The toolbar over a document that is not the colonoscopy report.
 *
 * Same shape as the report's own bar in screens/clinic-visit.html — name on the
 * left, the document's own actions on the right, and nothing else. Save and
 * Sign are not among them: they live once, in the note's shared footer, where
 * the clinician gets to after writing.
 */
function docBarHtml(name, { stampId, actions = '', testid = '' } = {}) {
  return `<div class="enc__doc-bar"${testid ? ` data-testid="${testid}"` : ''}>
    <h2 class="enc__doc-name">${name}</h2>
    ${stampId ? `<span id="${stampId}"></span>` : ''}
    <span class="enc__spacer"></span>
    ${actions}
  </div>`;
}

/*
 * The H&P as a DOCUMENT rather than four cards.
 *
 * It was a stack of bordered panels — Patient History beside Physical
 * Examination, then Assessment, then a signature card, then a loose row of
 * buttons under everything. That arrangement says "form"; the colonoscopy
 * report beside it says "document", and the two were the same visit, signed by
 * the same person, on the same screen. Now it is a run of sections — so a
 * printed H&P and a printed report are plainly two pages from one clinic, and a
 * clinician who has written one has written both.
 *
 * The four file actions moved into the toolbar with the document's name, which
 * is where the report keeps its own. A row of buttons at the bottom of a
 * scrolling document is a row of buttons nobody scrolls to.
 */
function hpBody() {
  return `${docBarHtml('Pre-procedure H&amp;P', {
    stampId: 'hpStamp',
    testid: 'enc--hp-bar',
    actions: `<ui-button variant="tertiary" size="sm" id="hpSetDefault"
        data-testid="enc--hp-set-default">Set Default</ui-button>
      <ui-button variant="tertiary" size="sm" id="hpUseDefault"
        data-testid="enc--hp-use-default">Use Default</ui-button>
      <ui-button variant="outline" size="sm" id="hpViewPdf"
        data-testid="enc--hp-view-pdf">View PDF</ui-button>
      <ui-button variant="outline" size="sm" id="hpDownloadPdf"
        data-testid="enc--hp-download-pdf">Download PDF</ui-button>`,
  })}

  <article class="enc__doc" data-testid="enc--hp-doc">
    <section class="enc__doc-section" data-testid="enc--hp-history">
      <h3>Patient history</h3>
      ${patientHistoryHtml()}
    </section>

    <section class="enc__doc-section" data-testid="enc--hp-exam">
      <h3>Physical examination</h3>
      ${physicalExamSummaryHtml()}
    </section>

    <section class="enc__doc-section" data-testid="enc--hp-assessment">
      <h3>Assessment and plan</h3>
      ${assessmentPlanHtml()}
    </section>

    <section class="enc__doc-section" data-testid="enc--hp-sign-card">
      <h3>Provider signature</h3>
      <div id="hpSignature" data-testid="enc--hp-signature"></div>
    </section>
  </article>`;
}

/**
 * The signed badge in a document's toolbar.
 *
 * The colonoscopy report has always carried one (paintColonoscopyBar); the H&P
 * and the orders did not, so the only way to tell a signed H&P from an unsigned
 * one was to scroll to the bottom of it. Whether a document is signed is the
 * first thing anyone wants to know about it, so it belongs beside its name.
 */
function paintDocStamp(id, sign, label) {
  const stamp = el(id);
  if (!stamp) return;
  stamp.innerHTML = sign.signed
    ? `<ui-badge status="success">${esc(label)} by ${esc(sign.signedBy)} · ${esc(
        sign.signedDate
      )}, ${esc(sign.signedTime)}</ui-badge>`
    : '<ui-badge status="warning">Unsigned</ui-badge>';
}

function paintHpSignature() {
  el('hpSignature').innerHTML = hpSignatureHtml();
  paintDocStamp('hpStamp', state.hpSign, 'Signed');
  const s = state.hpSign;

  if (s.signed) {
    el('hpReSign').addEventListener('ui-click', () => {
      s.signed = false;
      s.signedBy = '';
      s.signedDate = '';
      s.signedTime = '';
      paintHpSignature();
      notify('Signature cleared. The H&P is open for edits again.', 'info');
    });
    return;
  }

  el('hpSign').addEventListener('ui-click', () => {
    const now = new Date();
    s.signed = true;
    s.signedBy = actingProvider();
    s.signedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    s.signedTime = nowTime();
    paintHpSignature();
    notify('Pre-procedure H&P signed and filed to the chart.');
  });
}

function wireHp() {
  const h = state.hp;
  options('hpGeneral', HP_GENERAL_OPTIONS, h.general);
  options('hpLung', HP_LUNG_OPTIONS, h.lung);
  options('hpCv', HP_CV_OPTIONS, h.cv);
  options('hpNeuro', HP_NEURO_OPTIONS, h.neuro);
  options('hpAirway', HP_AIRWAY_OPTIONS, h.airway);
  options('hpAsa', ASA_CLASSIFICATIONS, h.asa);
  setValue(el('hpIndication'), h.indication);

  el('hpGeneral').addEventListener('ui-change', (e) => (h.general = e.detail.value));
  el('hpLung').addEventListener('ui-change', (e) => (h.lung = e.detail.value));
  el('hpCv').addEventListener('ui-change', (e) => (h.cv = e.detail.value));
  el('hpNeuro').addEventListener('ui-change', (e) => (h.neuro = e.detail.value));
  el('hpAirway').addEventListener('ui-change', (e) => (h.airway = e.detail.value));
  el('hpAsa').addEventListener('ui-change', (e) => (h.asa = e.detail.value));
  el('hpIndication').addEventListener('ui-change', (e) => (h.indication = e.detail.value));

  wireIndicationCodes('hp', h.indicationCodes, el('intraHp'), paintIntra);

  el('hpSetDefault').addEventListener('ui-click', () =>
    notify('Saving a default H&P template is not built in this prototype.', 'info')
  );
  el('hpUseDefault').addEventListener('ui-click', () => {
    Object.assign(h, HP_DEFAULTS);
    paintIntra();
    notify('Default H&P values applied.');
  });
  el('hpViewPdf').addEventListener('ui-click', () => window.print());
  el('hpDownloadPdf').addEventListener('ui-click', () =>
    notify('PDF download is not built in this prototype.', 'info')
  );

  paintHpSignature();
}

/* --- Orders -------------------------------------------------------------------- */

/*
 * The standing orders, in the same document clothes as the H&P beside them.
 *
 * These are signed by the same person, at the same visit, and travel with the
 * same chart — so they are a page of the same document set rather than three
 * cards and a button row. The three order lists keep their own sections
 * because they are acted on at three different times: before the case, during
 * it, and in recovery.
 *
 * ONE ORDER SET, READ FROM TWO PLACES. The anaesthetist opens it on the
 * pre-procedure note's Orders tab, before the case; the endoscopist reads it
 * back here, in the room. Both render orderSetDocHtml() over the same
 * state.orders and the same state.ordersSign, because two copies of an order
 * set are two answers to "what was ordered" and they stop agreeing the first
 * time a line changes.
 *
 * What the two views cannot share is their element ids. All three stages sit
 * in the DOM together — the ones you are not on are merely hidden — so an id
 * used by both would belong to whichever painted last, and el() would hand the
 * wrong view's control to the wrong wire-up. Hence a descriptor per side: same
 * markup, same state, its own ids.
 */
const ORDER_SET_VIEWS = {
  intra: {
    testid: 'enc--orders',
    ids: {
      sedationType: 'ordersSedationType',
      additional: 'ordersAdditional',
      signature: 'ordersSignature',
      stamp: 'ordersStamp',
      sign: 'ordersSign',
      resign: 'ordersReSign',
      save: 'ordersSave',
      setDefault: 'ordersSetDefault',
      useDefault: 'ordersUseDefault',
      viewPdf: 'ordersViewPdf',
      downloadPdf: 'ordersDownloadPdf',
    },
    repaint: () => paintIntra(),
  },
  anaesthesia: {
    testid: 'enc--a-orders',
    /* No viewPdf/downloadPdf here: the pre-procedure note's tab strip already
       carries Print, Download and View for whichever of its documents is open,
       and they are wired with the rest of that chrome. A second pair inside
       the document would print the same page from two rows on one screen. */
    ids: {
      sedationType: 'aOrdersSedationType',
      additional: 'aOrdersAdditional',
      signature: 'aOrdersSignature',
      stamp: 'aOrdersStamp',
      sign: 'aOrdersSign',
      resign: 'aOrdersReSign',
      save: 'aOrdersSave',
      setDefault: 'aOrdersSetDefault',
      useDefault: 'aOrdersUseDefault',
    },
    repaint: () => paintPre(),
  },
};

/**
 * The order set as a document: three lists, the sedation type, the signature.
 *
 * The lists are protocol text and are not editable — they are what the practice
 * orders for every case, and a line typed over in one encounter is a protocol
 * that quietly differs from the one everybody else is working to. The two
 * things that ARE this patient's are the sedation type and anything additional,
 * and those are the two fields here.
 */
function orderSetDocHtml({ ids, testid }) {
  return `<article class="enc__doc" data-testid="${testid}-doc">
    <section class="enc__doc-section" data-testid="${testid}-pre">
      <h3>Pre-procedure orders</h3>
      <ul class="enc__order-list">${PRE_PROCEDURE_ORDER_LINES.map(
        (l) => `<li>${esc(l)}</li>`
      ).join('')}</ul>
    </section>

    <section class="enc__doc-section" data-testid="${testid}-sedation">
      <h3>Sedation orders</h3>
      <div class="enc__grid-2 enc__vn-grid">
        <ui-select id="${ids.sedationType}" label="Sedation Type"
          data-testid="${testid}-sedation-type"></ui-select>
      </div>
      <p class="enc__kv-line"><strong>Medications:</strong></p>
      <ul class="enc__order-list">${SEDATION_ORDER_MEDICATIONS.map(
        (m) => `<li>${esc(m)}</li>`
      ).join('')}</ul>
      <ui-textarea id="${ids.additional}" label="Additional Medication Orders" rows="3"
        placeholder="Enter any additional medication orders..."
        data-testid="${testid}-additional"></ui-textarea>
    </section>

    <section class="enc__doc-section" data-testid="${testid}-post">
      <h3>Post-procedure orders</h3>
      <ul class="enc__order-list">${POST_PROCEDURE_ORDER_LINES.map(
        (l) => `<li>${esc(l)}</li>`
      ).join('')}</ul>
    </section>

    <section class="enc__doc-section" data-testid="${testid}-sign-card">
      <h3>Provider signature</h3>
      <div id="${ids.signature}" data-testid="${testid}-signature"></div>
    </section>
  </article>`;
}

function ordersBody() {
  return `${docBarHtml('Pre- and post-procedure orders', {
    stampId: 'ordersStamp',
    testid: 'enc--orders-bar',
    actions: `<ui-button variant="primary" size="sm" id="ordersSave"
        data-testid="enc--orders-save">Save Orders</ui-button>
      <ui-button variant="tertiary" size="sm" id="ordersSetDefault"
        data-testid="enc--orders-set-default">Set Default</ui-button>
      <ui-button variant="tertiary" size="sm" id="ordersUseDefault"
        data-testid="enc--orders-use-default">Use Default</ui-button>
      <ui-button variant="outline" size="sm" id="ordersViewPdf"
        data-testid="enc--orders-view-pdf">View PDF</ui-button>
      <ui-button variant="outline" size="sm" id="ordersDownloadPdf"
        data-testid="enc--orders-download-pdf">Download PDF</ui-button>`,
  })}

  ${orderSetDocHtml(ORDER_SET_VIEWS.intra)}`;
}

function orderSetSignatureHtml({ ids, testid }) {
  const s = state.ordersSign;
  if (s.signed) {
    return `<div class="enc__signed-panel" data-testid="${testid}-signed-panel">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
      <div>
        <strong>Orders Electronically Signed</strong>
        <p>Signed by: ${esc(s.signedBy)} · Date: ${esc(s.signedDate)} · Time: ${esc(s.signedTime)}</p>
      </div>
      <ui-button variant="outline" size="sm" id="${ids.resign}"
        data-testid="${testid}-resign">Clear Signature &amp; Re-sign</ui-button>
    </div>`;
  }
  return `<div class="enc__sign-panel">
    <p class="enc__caption">
      By signing below, you confirm that you have reviewed and approve these orders.
      Signing as: ${esc(actingProvider())}
    </p>
    <ui-button variant="primary" size="sm" id="${ids.sign}"
      data-testid="${testid}-sign">Sign Orders</ui-button>
  </div>`;
}

function paintOrderSetSignature(view) {
  const { ids } = view;
  const panel = el(ids.signature);
  if (!panel) return;

  panel.innerHTML = orderSetSignatureHtml(view);
  paintDocStamp(ids.stamp, state.ordersSign, 'Signed');
  const s = state.ordersSign;

  if (s.signed) {
    el(ids.resign).addEventListener('ui-click', () => {
      s.signed = false;
      s.signedBy = '';
      s.signedDate = '';
      s.signedTime = '';
      paintOrderSetSignature(view);
      notify('Signature cleared. Orders are open for edits again.', 'info');
    });
    return;
  }

  el(ids.sign).addEventListener('ui-click', () => {
    const now = new Date();
    s.signed = true;
    s.signedBy = actingProvider();
    s.signedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    s.signedTime = nowTime();
    paintOrderSetSignature(view);
    notify('Orders signed and filed to the chart.');
  });
}

/**
 * Wire whichever view of the order set is on screen.
 *
 * Bails if this view is not rendered: the anaesthesia side is behind a tab that
 * is usually showing the note instead, and the in-procedure side behind a stage
 * that may not be the open one.
 */
function wireOrderSet(view) {
  const { ids } = view;
  const o = state.orders;
  if (!el(ids.sedationType)) return;

  options(ids.sedationType, SEDATION_TYPES, o.sedationType);
  setValue(el(ids.additional), o.additionalMeds);

  el(ids.sedationType).addEventListener('ui-change', (e) => (o.sedationType = e.detail.value));
  el(ids.additional).addEventListener('ui-change', (e) => (o.additionalMeds = e.detail.value));

  el(ids.save)?.addEventListener('ui-click', () => notify('Orders saved.'));
  el(ids.setDefault)?.addEventListener('ui-click', () =>
    notify('Saving a default order set is not built in this prototype.', 'info')
  );
  el(ids.useDefault)?.addEventListener('ui-click', () => {
    o.sedationType = SEDATION_TYPES[0];
    o.additionalMeds = '';
    view.repaint();
    notify('Default orders applied.');
  });
  el(ids.viewPdf)?.addEventListener('ui-click', () => window.print());
  el(ids.downloadPdf)?.addEventListener('ui-click', () =>
    notify('PDF download is not built in this prototype.', 'info')
  );

  paintOrderSetSignature(view);
}

/* --- EGD report ------------------------------------------------------------------
   A second report type alongside the colonoscopy narrative engine — structured
   fields rather than generated prose, since EGD does not share the polyp
   mechanic the colonoscopy report is built around. --------------------------- */

let nextEgdFindingId = 1;
let nextEgdBiopsyId = 1;
let nextEgdPhotoId = 1;

function egdChecklistHtml(toggleId, title, options, selected) {
  return `<section class="enc__card enc__card--sub" data-card="${toggleId}">
    <header class="enc__card-head">
      <h3 class="enc__card-title">${esc(title)} <span class="enc__caption">(select all that apply)</span></h3>
      <button type="button" class="enc__toggle" data-toggle="${toggleId}"
        aria-expanded="false" aria-controls="body-${toggleId}">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-up"></use></svg>
      </button>
    </header>
    <div class="enc__card-body" id="body-${toggleId}" hidden>
      <div class="enc__checks enc__checks--2">
        ${options
          .map(
            ({ code, label }) => `<ui-checkbox data-${toggleId}="${esc(label)}"
              ${selected.has(label) ? 'checked' : ''}><code>${esc(
                code
              )}</code> ${esc(label)}</ui-checkbox>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

function egdDetailsHtml() {
  const d = state.egd.details;
  return `<div class="enc__grid-2">
    ${EGD_PROCEDURE_DETAILS.map(
      (f) => `<ui-select id="egdDetail-${f.id}" label="${esc(f.label)}"
        placeholder="${esc(f.placeholder)}" data-testid="enc--egd-${f.id}"></ui-select>`
    ).join('')}
  </div>`;
}

function egdBloodLossHtml() {
  return `<ui-select id="egdBloodLoss" label="Blood Loss" data-testid="enc--egd-blood-loss"></ui-select>
  <ui-input id="egdEstimatedAmount" type="number" label="Estimated Amount (mL)"
    placeholder="Enter amount" data-testid="enc--egd-estimated-amount"></ui-input>`;
}

/** Three regions, drawn as stacked buttons rather than a literal image asset. */
function egdFindingsHtml() {
  const rows = state.egd.findings;
  return `<div class="enc__egd-findings">
    <div class="enc__egd-findings-list" id="egdFindingsList">
      ${
        rows.length
          ? rows
              .map(
                (f) => `<div class="enc__egd-finding-row" data-finding-row="${f.id}">
                  <span class="enc__egd-finding-tag">${esc(
                    EGD_FINDING_REGIONS.find((r) => r.id === f.region)?.label ?? f.region
                  )}</span>
                  <textarea id="egdFinding-${f.id}" rows="2" class="enc__doc-area"
                    placeholder="Describe the finding..."
                    data-testid="enc--egd-finding-${f.id}">${esc(f.description)}</textarea>
                  <button type="button" class="enc__icon-action" data-remove-finding="${f.id}"
                    aria-label="Remove finding">
                    <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
                  </button>
                </div>`
              )
              .join('')
          : '<p class="enc__empty">No findings recorded yet</p>'
      }
    </div>
    <div class="enc__egd-diagram">
      <p class="enc__caption">Click a segment to add findings</p>
      <div class="enc__egd-body">
        ${EGD_FINDING_REGIONS.map(
          (r) => `<button type="button" class="enc__egd-region enc__egd-region--${r.id}"
            data-region="${r.id}" data-testid="enc--egd-region-${r.id}">${esc(r.label)}</button>`
        ).join('')}
      </div>
      <p class="enc__egd-diagram-legend">
        <span><span class="enc__egd-swatch enc__egd-swatch--on"></span> Findings recorded</span>
        <span><span class="enc__egd-swatch"></span> Hover / click to add</span>
      </p>
    </div>
  </div>`;
}

function egdBiopsiesHtml() {
  const rows = state.egd.biopsies;
  return `${
    rows.length
      ? rows
          .map(
            (b) => `<div class="enc__grid-3 enc__egd-biopsy-row" data-biopsy-row="${b.id}">
              <ui-input id="egdBiopsySite-${b.id}" label="Site" value="${esc(b.site)}"
                data-testid="enc--egd-biopsy-site-${b.id}"></ui-input>
              <ui-input id="egdBiopsySize-${b.id}" label="Size" placeholder="e.g. 4 mm"
                value="${esc(b.size)}" data-testid="enc--egd-biopsy-size-${b.id}"></ui-input>
              <div class="enc__row enc__row--end">
                <ui-input id="egdBiopsyCount-${b.id}" type="number" label="Jars"
                  value="${esc(b.count)}" data-testid="enc--egd-biopsy-count-${b.id}"></ui-input>
                <button type="button" class="enc__icon-action" data-remove-biopsy="${b.id}"
                  aria-label="Remove biopsy row">
                  <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
                </button>
              </div>
            </div>`
          )
          .join('')
      : '<p class="enc__empty">No biopsies or specimens recorded.</p>'
  }`;
}

function egdRecommendationsHtml() {
  const e = state.egd;
  return `<div class="enc__checks enc__checks--stack">
    ${EGD_RECOMMENDATIONS.map(
      (r) => `<ui-checkbox data-recommendation="${r.id}" ${e.recommendations.has(r.id) ? 'checked' : ''}
        data-testid="enc--egd-rec-${r.id}">${esc(r.label)}</ui-checkbox>`
    ).join('')}
    <div class="enc__row">
      <ui-checkbox id="egdRepeat" ${e.repeatProcedure ? 'checked' : ''}
        data-testid="enc--egd-repeat">Repeat procedure in</ui-checkbox>
      <ui-input id="egdRepeatValue" type="number" size="sm" value="${esc(e.repeatValue)}"
        label="Repeat in" label-hidden data-testid="enc--egd-repeat-value"></ui-input>
      <ui-select id="egdRepeatUnit" size="sm" label="Unit" label-hidden
        data-testid="enc--egd-repeat-unit"></ui-select>
    </div>
  </div>
  <div class="enc__egd-custom-rec">
    <ui-input id="egdCustomRec" label="Custom Recommendations" label-hidden
      placeholder="Enter custom recommendation (max 200 chars)..."
      data-testid="enc--egd-custom-rec"></ui-input>
    <ui-button variant="outline" size="sm" id="egdCustomRecAdd"
      data-testid="enc--egd-custom-rec-add">Add</ui-button>
  </div>
  ${
    e.customRecommendations.length
      ? `<div class="enc__chip-row">${e.customRecommendations
          .map(
            (text, i) => `<span class="enc__chip">${esc(text)}
              <button type="button" data-drop-custom-rec="${i}" aria-label="Remove">×</button>
            </span>`
          )
          .join('')}</div>`
      : ''
  }`;
}

function egdPhotosHtml() {
  const photos = state.egd.photos;
  return `<div class="enc__egd-photos-head">
    <span class="enc__caption">${photos.length}/${EGD_MAX_PHOTOS} photos</span>
    <ui-button variant="outline" size="sm" icon="image" id="egdAddPhotos"
      data-testid="enc--egd-add-photos">Add Photos</ui-button>
  </div>
  ${
    photos.length
      ? `<div class="enc__egd-photo-grid">${photos
          .map(
            (p) => `<figure class="enc__egd-photo" data-photo="${p.id}">
              <img src="${p.dataUrl}" alt="${esc(p.name)}" />
              <button type="button" class="enc__icon-action" data-remove-photo="${p.id}"
                aria-label="Remove photo">
                <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
              </button>
            </figure>`
          )
          .join('')}</div>`
      : `<p class="enc__empty">No photos yet. Click "Add Photos" to attach procedure images.</p>`
  }
  <input type="file" id="egdPhotoInput" accept="image/*" multiple class="u-sr-only"
    aria-label="Add procedure photos" data-testid="enc--egd-photo-input" />`;
}

function egdSignatureHtml() {
  const s = state.egdSign;
  if (s.signed) {
    return `<div class="enc__signed-panel" data-testid="enc--egd-signed-panel">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-check"></use></svg>
      <div>
        <strong>EGD Report Electronically Signed</strong>
        <p>Signed by: ${esc(s.signedBy)} · Date: ${esc(s.signedDate)} · Time: ${esc(s.signedTime)}</p>
      </div>
      <ui-button variant="outline" size="sm" id="egdReSign"
        data-testid="enc--egd-resign">Clear Signature &amp; Re-sign</ui-button>
    </div>`;
  }
  return `<p class="enc__caption">Not yet signed — use Sign &amp; Finalize above.</p>`;
}

function egdBody() {
  const e = state.egd;
  const s = state.egdSign;
  // Save draft and Sign live in the note's shared footer, not here — one
  // commit per document, in the place the clinician reaches after writing
  // it. The bar carries only what is specific to this report.
  return `<div class="enc__doc-bar">
    <h2 class="enc__doc-name">EGD Report</h2>
    ${
      s.signed
        ? `<ui-badge status="success" data-testid="enc--egd-signed-stamp">Signed by ${esc(
            s.signedBy
          )} · ${esc(s.signedDate)}, ${esc(s.signedTime)}</ui-badge>`
        : ''
    }
    <span class="enc__spacer"></span>
    ${
      s.signed
        ? `<ui-button variant="outline" size="sm" icon="lock" id="egdUnlock"
             data-testid="enc--egd-unlock">Unlock for Amendment</ui-button>`
        : ''
    }
  </div>

  <article class="enc__doc">
    ${egdChecklistHtml('egd-procedures', 'Procedures Performed', EGD_PROCEDURES_PERFORMED, e.proceduresPerformed)}
    ${egdChecklistHtml('egd-modifiers', 'Modifiers', EGD_MODIFIERS, e.modifiers)}

    <section class="enc__doc-section">
      <h3>Diagnostic Indication</h3>
      <ui-textarea id="egdIndication" label="Diagnostic Indication" label-hidden rows="3"
        placeholder="Enter or edit clinical indication..." data-testid="enc--egd-indication"></ui-textarea>
      ${indicationCodesHtml('egd', e.indicationCodes, 'enc--egd-codes')}
    </section>

    <section class="enc__doc-section">
      <h3>Procedure Details</h3>
      ${egdDetailsHtml()}
    </section>

    <section class="enc__doc-section">
      <h3>Blood Loss</h3>
      ${egdBloodLossHtml()}
    </section>

    <section class="enc__doc-section">
      <h3>Complications</h3>
      <ui-textarea id="egdComplications" label="Complications" label-hidden rows="2"
        data-testid="enc--egd-complications"></ui-textarea>
    </section>

    <section class="enc__doc-section">
      <h3>Findings</h3>
      ${egdFindingsHtml()}
    </section>

    <section class="enc__doc-section">
      <header class="enc__doc-section-head">
        <h3>Biopsies / Specimens</h3>
        <ui-button variant="outline" size="sm" id="egdAddBiopsy"
          data-testid="enc--egd-add-biopsy">Add Biopsy</ui-button>
      </header>
      <div id="egdBiopsies">${egdBiopsiesHtml()}</div>
    </section>

    <section class="enc__doc-section">
      <header class="enc__doc-section-head">
        <h3>Impression / Summary</h3>
        <ui-button variant="outline" size="sm" id="egdAutoImpression"
          data-testid="enc--egd-auto-impression">Auto-populate from findings</ui-button>
      </header>
      <ui-textarea id="egdImpression" label="Impression" label-hidden rows="3"
        placeholder="Enter impression or summary of findings" data-testid="enc--egd-impression"></ui-textarea>
    </section>

    <section class="enc__doc-section">
      <h3>Recommendations</h3>
      ${egdRecommendationsHtml()}
    </section>

    <section class="enc__doc-section">
      <h3>Procedure Photos</h3>
      ${egdPhotosHtml()}
    </section>

    ${card('Provider Electronic Signature', `<div id="egdSignature">${egdSignatureHtml()}</div>`, '', 'enc--egd-sign-card')}
  </article>`;
}

function signEgdReport() {
  // Before the gate as well as before the repaint: the finding descriptions
  // and biopsy rows live in the DOM until this runs, so signing without it
  // would both judge and file a report missing whatever was typed last.
  syncEgdFromDom();

  const e = state.egd;
  if (!e.indication.trim()) {
    notify('Enter a diagnostic indication before signing.', 'warning');
    return;
  }
  if (!e.findings.length) {
    notify('Record at least one finding before signing.', 'warning');
    return;
  }
  const now = new Date();
  state.egdSign.signed = true;
  state.egdSign.signedBy = actingProvider();
  state.egdSign.signedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  state.egdSign.signedTime = nowTime();
  paintIntra();
  notify('EGD report signed and filed to the chart.');
}

/**
 * Pull every free-text field's live value back into state.
 *
 * A structural change (add/remove a row, tick a box) repaints the whole EGD
 * document from state, the same way paintPre() repaints its stage — so
 * anything typed in another field and not yet in state would otherwise be
 * discarded by that repaint. Called before every state change that triggers
 * one.
 */
function syncEgdFromDom() {
  const e = state.egd;
  e.indication = el('egdIndication')?.value ?? e.indication;
  e.complications = el('egdComplications')?.value ?? e.complications;
  e.impression = el('egdImpression')?.value ?? e.impression;
  e.estimatedAmount = el('egdEstimatedAmount')?.value ?? e.estimatedAmount;
  e.findings.forEach((f) => {
    const field = el(`egdFinding-${f.id}`);
    if (field) f.description = field.value;
  });
  e.biopsies.forEach((b) => {
    b.site = el(`egdBiopsySite-${b.id}`)?.value ?? b.site;
    b.size = el(`egdBiopsySize-${b.id}`)?.value ?? b.size;
    b.count = el(`egdBiopsyCount-${b.id}`)?.value ?? b.count;
  });
}

function wireEgd() {
  const e = state.egd;

  options('egdBloodLoss', EGD_BLOOD_LOSS_OPTIONS, e.bloodLoss);
  setValue(el('egdEstimatedAmount'), e.estimatedAmount);
  setValue(el('egdIndication'), e.indication);
  setValue(el('egdComplications'), e.complications);
  setValue(el('egdImpression'), e.impression);
  options('egdRepeatUnit', EGD_REPEAT_UNITS, e.repeatUnit);
  EGD_PROCEDURE_DETAILS.forEach((f) => options(`egdDetail-${f.id}`, f.options, e.details[f.id]));

  el('egdBloodLoss').addEventListener('ui-change', (ev) => (e.bloodLoss = ev.detail.value));
  el('egdEstimatedAmount').addEventListener('ui-change', (ev) => (e.estimatedAmount = ev.detail.value));
  el('egdIndication').addEventListener('ui-change', (ev) => (e.indication = ev.detail.value));
  el('egdComplications').addEventListener('ui-change', (ev) => (e.complications = ev.detail.value));
  el('egdImpression').addEventListener('ui-change', (ev) => (e.impression = ev.detail.value));
  EGD_PROCEDURE_DETAILS.forEach((f) =>
    el(`egdDetail-${f.id}`).addEventListener('ui-change', (ev) => (e.details[f.id] = ev.detail.value))
  );

  /* --- Collapsible checklists (Procedures Performed / Modifiers) --- */
  ['egd-procedures', 'egd-modifiers'].forEach((toggleId) => {
    const button = el('egdDoc').querySelector(`[data-toggle="${toggleId}"]`);
    button.addEventListener('click', () => {
      const body = el(`body-${toggleId}`);
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });
  });
  el('egdDoc').querySelectorAll('[data-egd-procedures]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const label = box.dataset.egdProcedures;
      if (ev.detail.checked) e.proceduresPerformed.add(label);
      else e.proceduresPerformed.delete(label);
    })
  );
  el('egdDoc').querySelectorAll('[data-egd-modifiers]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const label = box.dataset.egdModifiers;
      if (ev.detail.checked) e.modifiers.add(label);
      else e.modifiers.delete(label);
    })
  );

  /* --- Attached diagnoses, same widget as the H&P and colonoscopy tabs.
         Attaching or dropping one repaints the whole document, so the typed
         findings have to be read back first — same contract as the findings
         and biopsy rows below. --- */
  wireIndicationCodes('egd', e.indicationCodes, el('egdDoc'), () => {
    syncEgdFromDom();
    paintIntra();
  });

  /* --- Findings diagram --- */
  el('egdDoc').querySelectorAll('[data-region]').forEach((button) =>
    button.addEventListener('click', () => {
      syncEgdFromDom();
      e.findings.push({ id: nextEgdFindingId++, region: button.dataset.region, description: '' });
      paintIntra();
      el(`egdFinding-${e.findings[e.findings.length - 1].id}`)?.focus();
    })
  );
  el('egdDoc').querySelectorAll('[data-remove-finding]').forEach((button) =>
    button.addEventListener('click', () => {
      syncEgdFromDom();
      e.findings = e.findings.filter((f) => f.id !== Number(button.dataset.removeFinding));
      paintIntra();
    })
  );

  /* --- Biopsies --- */
  el('egdAddBiopsy').addEventListener('ui-click', () => {
    syncEgdFromDom();
    e.biopsies.push({ id: nextEgdBiopsyId++, site: '', size: '', count: '1' });
    paintIntra();
  });
  el('egdDoc').querySelectorAll('[data-remove-biopsy]').forEach((button) =>
    button.addEventListener('click', () => {
      syncEgdFromDom();
      e.biopsies = e.biopsies.filter((b) => b.id !== Number(button.dataset.removeBiopsy));
      paintIntra();
    })
  );

  /* --- Auto-populate impression from the findings just recorded --- */
  el('egdAutoImpression').addEventListener('ui-click', () => {
    const text = e.findings
      .map((f) => {
        const label = EGD_FINDING_REGIONS.find((r) => r.id === f.region)?.label ?? f.region;
        const desc = el(`egdFinding-${f.id}`)?.value.trim();
        return desc ? `${label}: ${desc}` : '';
      })
      .filter(Boolean)
      .join(' ');
    if (!text) {
      notify('Describe at least one finding before auto-populating.', 'warning');
      return;
    }
    e.impression = text;
    setValue(el('egdImpression'), text);
    notify('Impression populated from the recorded findings.');
  });

  /* --- Recommendations --- */
  el('egdDoc').querySelectorAll('[data-recommendation]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const id = box.dataset.recommendation;
      if (ev.detail.checked) e.recommendations.add(id);
      else e.recommendations.delete(id);
    })
  );
  el('egdRepeat').addEventListener('ui-change', (ev) => (e.repeatProcedure = ev.detail.checked));
  el('egdRepeatValue').addEventListener('ui-change', (ev) => (e.repeatValue = ev.detail.value));
  el('egdRepeatUnit').addEventListener('ui-change', (ev) => (e.repeatUnit = ev.detail.value));

  el('egdCustomRecAdd').addEventListener('ui-click', () => {
    const value = el('egdCustomRec').value.trim();
    if (!value) return;
    syncEgdFromDom();
    e.customRecommendations.push(value.slice(0, 200));
    paintIntra();
  });
  el('egdDoc').querySelectorAll('[data-drop-custom-rec]').forEach((button) =>
    button.addEventListener('click', () => {
      syncEgdFromDom();
      e.customRecommendations.splice(Number(button.dataset.dropCustomRec), 1);
      paintIntra();
    })
  );

  /* --- Photos — read locally, no server round trip needed for a prototype --- */
  el('egdAddPhotos').addEventListener('ui-click', () => el('egdPhotoInput').click());
  el('egdPhotoInput').addEventListener('change', () => {
    const files = [...el('egdPhotoInput').files].slice(0, EGD_MAX_PHOTOS - e.photos.length);
    if (!files.length) return;
    let pending = files.length;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        e.photos.push({ id: nextEgdPhotoId++, name: file.name, dataUrl: reader.result });
        pending -= 1;
        if (pending === 0) {
          syncEgdFromDom();
          paintIntra();
        }
      };
      reader.readAsDataURL(file);
    });
  });
  el('egdDoc').querySelectorAll('[data-remove-photo]').forEach((button) =>
    button.addEventListener('click', () => {
      syncEgdFromDom();
      e.photos = e.photos.filter((p) => p.id !== Number(button.dataset.removePhoto));
      paintIntra();
    })
  );

  const s = state.egdSign;
  if (s.signed) {
    // Two ways in, one action: the bar's Unlock for Amendment and the
    // signature panel's Clear Signature are the same thing said where each
    // is being read.
    const unlock = () => {
      s.signed = false;
      s.signedBy = '';
      s.signedDate = '';
      s.signedTime = '';
      paintIntra();
      notify('Signature cleared. The EGD report is open for edits again.', 'info');
    };
    el('egdReSign')?.addEventListener('ui-click', unlock);
    el('egdUnlock')?.addEventListener('ui-click', unlock);
  }
}

/* --- Colonoscopy report: the structured fields -------------------------------
   These sit around the narrative rather than replacing it. The narrative and
   its findings-to-prose engine remain the report of record; what follows is
   the per-visit charting the same document also has to carry — what was
   performed, how, what was taken and what happens next.

   Deliberately built from the same helpers the EGD report uses (checklist
   card, biopsy rows, recommendations, photos) so the two report types read
   and behave the same way where they are the same thing.
   -------------------------------------------------------------------------- */

let nextCscBiopsyId = 1;
let nextCscPhotoId = 1;

function cscChecklistHtml(toggleId, title, list, selected) {
  return `<section class="enc__card enc__card--sub" data-card="${toggleId}">
    <header class="enc__card-head">
      <h3 class="enc__card-title">${esc(title)} <span class="enc__caption">(select all that apply)</span></h3>
      <button type="button" class="enc__toggle" data-toggle="${toggleId}"
        aria-expanded="false" aria-controls="body-${toggleId}">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-up"></use></svg>
      </button>
    </header>
    <div class="enc__card-body" id="body-${toggleId}" hidden>
      <div class="enc__checks enc__checks--2">
        ${list
          .map(
            ({ code, label }) => `<ui-checkbox data-${toggleId}="${esc(label)}"
              ${selected.has(label) ? 'checked' : ''}><code>${esc(
                code
              )}</code> ${esc(label)}</ui-checkbox>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

function cscBiopsiesHtml() {
  const rows = state.csc.biopsies;
  if (!rows.length) return '<p class="enc__empty">No biopsies or specimens recorded.</p>';
  return rows
    .map(
      (b) => `<div class="enc__grid-3 enc__egd-biopsy-row" data-csc-biopsy-row="${b.id}">
        <ui-input id="cscBiopsySite-${b.id}" label="Site" value="${esc(b.site)}"
          data-testid="enc--csc-biopsy-site-${b.id}"></ui-input>
        <ui-input id="cscBiopsySize-${b.id}" label="Size" placeholder="e.g. 4 mm"
          value="${esc(b.size)}" data-testid="enc--csc-biopsy-size-${b.id}"></ui-input>
        <div class="enc__row enc__row--end">
          <ui-input id="cscBiopsyCount-${b.id}" type="number" label="Jars"
            value="${esc(b.count)}" data-testid="enc--csc-biopsy-count-${b.id}"></ui-input>
          <button type="button" class="enc__icon-action" data-remove-csc-biopsy="${b.id}"
            aria-label="Remove biopsy row">
            <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
          </button>
        </div>
      </div>`
    )
    .join('');
}

function cscRecommendationsHtml() {
  const c = state.csc;
  return `<div class="enc__checks enc__checks--stack">
    ${EGD_RECOMMENDATIONS.map(
      (r) => `<ui-checkbox data-csc-recommendation="${r.id}"
        ${c.recommendations.has(r.id) ? 'checked' : ''}
        data-testid="enc--csc-rec-${r.id}">${esc(r.label)}</ui-checkbox>`
    ).join('')}
    <div class="enc__row">
      <ui-checkbox id="cscRepeat" ${c.repeatProcedure ? 'checked' : ''}
        data-testid="enc--csc-repeat">Repeat procedure in</ui-checkbox>
      <ui-input id="cscRepeatValue" type="number" size="sm" value="${esc(c.repeatValue)}"
        label="Repeat in" label-hidden data-testid="enc--csc-repeat-value"></ui-input>
      <ui-select id="cscRepeatUnit" size="sm" label="Unit" label-hidden
        data-testid="enc--csc-repeat-unit"></ui-select>
    </div>
  </div>
  <div class="enc__egd-custom-rec">
    <ui-input id="cscCustomRec" label="Custom Recommendations" label-hidden
      placeholder="Enter custom recommendation (max 200 chars)..."
      data-testid="enc--csc-custom-rec"></ui-input>
    <ui-button variant="outline" size="sm" id="cscCustomRecAdd"
      data-testid="enc--csc-custom-rec-add">Add</ui-button>
  </div>
  ${
    c.customRecommendations.length
      ? `<div class="enc__chip-row">${c.customRecommendations
          .map(
            (text, i) => `<span class="enc__chip">${esc(text)}
              <button type="button" data-drop-csc-rec="${i}" aria-label="Remove">×</button>
            </span>`
          )
          .join('')}</div>`
      : ''
  }`;
}

function cscPhotosHtml() {
  const photos = state.csc.photos;
  return `<div class="enc__egd-photos-head">
    <span class="enc__caption">${photos.length}/${EGD_MAX_PHOTOS} photos</span>
    <ui-button variant="outline" size="sm" icon="image" id="cscAddPhotos"
      data-testid="enc--csc-add-photos">Add Photos</ui-button>
  </div>
  ${
    photos.length
      ? `<div class="enc__egd-photo-grid">${photos
          .map(
            (p) => `<figure class="enc__egd-photo" data-csc-photo="${p.id}">
              <img src="${p.dataUrl}" alt="${esc(p.name)}" />
              <button type="button" class="enc__icon-action" data-remove-csc-photo="${p.id}"
                aria-label="Remove photo">
                <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
              </button>
            </figure>`
          )
          .join('')}</div>`
      : `<p class="enc__empty">No photos yet. Click "Add Photos" to attach procedure images.</p>`
  }
  <input type="file" id="cscPhotoInput" accept="image/*" multiple class="u-sr-only"
    aria-label="Add procedure photos" data-testid="enc--csc-photo-input" />`;
}

/**
 * The structured fields that describe the case itself — what was performed,
 * why, how, and what went wrong. They belong above the findings, because they
 * are the setup the findings are recorded against.
 */
function cscSetupHtml() {
  const c = state.csc;
  return `
    ${cscChecklistHtml('csc-procedures', 'Procedures Performed', COLONOSCOPY_PROCEDURES_PERFORMED, c.proceduresPerformed)}
    ${cscChecklistHtml('csc-modifiers', 'Modifiers', EGD_MODIFIERS, c.modifiers)}

    <section class="enc__doc-section">
      <h3>Diagnostic indication</h3>
      <ui-textarea id="cscIndication" label="Diagnostic Indication" label-hidden rows="3"
        placeholder="Enter or edit clinical indication..."
        data-testid="enc--csc-indication"></ui-textarea>
      ${indicationCodesHtml('csc', c.indicationCodes, 'enc--csc-codes')}
    </section>

    <section class="enc__doc-section">
      <h3>Bowel preparation</h3>
      <div class="enc__grid-2">
        <ui-select id="cscPrepType" label="Bowel Preparation Assessment Type"
          data-testid="enc--csc-prep-type"></ui-select>
        <ui-select id="cscPrepQuality" label="Bowel Preparation Quality"
          placeholder="Select prep quality" data-testid="enc--csc-prep-quality"></ui-select>
      </div>
    </section>

    <section class="enc__doc-section">
      <header class="enc__doc-section-head">
        <h3>Procedure details</h3>
        <ui-button variant="outline" size="sm" id="cscSetDefaults"
          data-testid="enc--csc-set-defaults">Set Defaults</ui-button>
      </header>
      <div class="enc__grid-2">
        ${COLONOSCOPY_PROCEDURE_DETAILS.map(
          (f) => `<ui-select id="cscDetail-${f.id}" label="${esc(f.label)}"
            placeholder="${esc(f.placeholder)}" data-testid="enc--csc-${f.id}"></ui-select>`
        ).join('')}
      </div>
    </section>

    <section class="enc__doc-section">
      <h3>Blood loss</h3>
      <div class="enc__grid-2">
        <ui-select id="cscBloodLoss" label="Blood Loss" data-testid="enc--csc-blood-loss"></ui-select>
        <ui-input id="cscEstimatedAmount" type="number" label="Estimated Amount (mL)"
          placeholder="Enter amount" data-testid="enc--csc-estimated-amount"></ui-input>
      </div>
    </section>

    <section class="enc__doc-section">
      <h3>Complications</h3>
      <ui-textarea id="cscComplications" label="Complications" label-hidden rows="2"
        data-testid="enc--csc-complications"></ui-textarea>
    </section>`;
}

/**
 * What the case produced: specimens taken, what happens next, and the images.
 * These read after the findings and impression, because that is the order the
 * decisions are made in.
 */
function cscOutcomeHtml() {
  return `
    <section class="enc__doc-section">
      <header class="enc__doc-section-head">
        <h3>Colonoscopy biopsies / specimens</h3>
        <ui-button variant="outline" size="sm" id="cscAddBiopsy"
          data-testid="enc--csc-add-biopsy">Add Biopsy</ui-button>
      </header>
      <div id="cscBiopsies">${cscBiopsiesHtml()}</div>
    </section>

    <section class="enc__doc-section">
      <h3>Recommendations</h3>
      ${cscRecommendationsHtml()}
    </section>

    <section class="enc__doc-section">
      <h3>Procedure photos</h3>
      ${cscPhotosHtml()}
    </section>`;
}

/**
 * Pull every free-text colonoscopy field back into state.
 *
 * Same contract as syncEgdFromDom(): a structural change repaints the whole
 * document from state, so anything typed and not yet committed to state would
 * be discarded by that repaint.
 */
function syncCscFromDom() {
  const c = state.csc;
  c.indication = el('cscIndication')?.value ?? c.indication;
  c.complications = el('cscComplications')?.value ?? c.complications;
  c.estimatedAmount = el('cscEstimatedAmount')?.value ?? c.estimatedAmount;
  c.biopsies.forEach((b) => {
    b.site = el(`cscBiopsySite-${b.id}`)?.value ?? b.site;
    b.size = el(`cscBiopsySize-${b.id}`)?.value ?? b.size;
    b.count = el(`cscBiopsyCount-${b.id}`)?.value ?? b.count;
  });
}

function wireCsc() {
  const c = state.csc;

  options('cscPrepType', COLONOSCOPY_BOWEL_PREP_TYPES, c.bowelPrepType);
  options('cscPrepQuality', COLONOSCOPY_BOWEL_PREP_QUALITY, c.bowelPrepQuality);
  options('cscBloodLoss', EGD_BLOOD_LOSS_OPTIONS, c.bloodLoss);
  options('cscRepeatUnit', EGD_REPEAT_UNITS, c.repeatUnit);
  COLONOSCOPY_PROCEDURE_DETAILS.forEach((f) => options(`cscDetail-${f.id}`, f.options, c.details[f.id]));
  setValue(el('cscIndication'), c.indication);
  setValue(el('cscComplications'), c.complications);
  setValue(el('cscEstimatedAmount'), c.estimatedAmount);

  el('cscPrepType').addEventListener('ui-change', (ev) => (c.bowelPrepType = ev.detail.value));
  el('cscPrepQuality').addEventListener('ui-change', (ev) => (c.bowelPrepQuality = ev.detail.value));
  el('cscBloodLoss').addEventListener('ui-change', (ev) => (c.bloodLoss = ev.detail.value));
  el('cscEstimatedAmount').addEventListener('ui-change', (ev) => (c.estimatedAmount = ev.detail.value));
  el('cscIndication').addEventListener('ui-change', (ev) => (c.indication = ev.detail.value));
  el('cscComplications').addEventListener('ui-change', (ev) => (c.complications = ev.detail.value));
  COLONOSCOPY_PROCEDURE_DETAILS.forEach((f) =>
    el(`cscDetail-${f.id}`).addEventListener('ui-change', (ev) => (c.details[f.id] = ev.detail.value))
  );

  /* --- Collapsible checklists --- */
  ['csc-procedures', 'csc-modifiers'].forEach((toggleId) => {
    const button = el('reportDoc').querySelector(`[data-toggle="${toggleId}"]`);
    button.addEventListener('click', () => {
      const body = el(`body-${toggleId}`);
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });
  });
  el('reportDoc').querySelectorAll('[data-csc-procedures]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const label = box.dataset.cscProcedures;
      if (ev.detail.checked) c.proceduresPerformed.add(label);
      else c.proceduresPerformed.delete(label);
    })
  );
  el('reportDoc').querySelectorAll('[data-csc-modifiers]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const label = box.dataset.cscModifiers;
      if (ev.detail.checked) c.modifiers.add(label);
      else c.modifiers.delete(label);
    })
  );

  /* --- Attached diagnoses, same widget as the H&P and EGD tabs. paintDoc()
         syncs the typed rows out of the DOM itself, so it is the repaint. --- */
  wireIndicationCodes('csc', c.indicationCodes, el('reportDoc'), paintDoc);

  /* --- Procedure details: the normal case, filled in one press --- */
  el('cscSetDefaults').addEventListener('ui-click', () => {
    syncCscFromDom();
    COLONOSCOPY_PROCEDURE_DETAILS.forEach((f) => {
      c.details[f.id] = f.options[0];
    });
    paintDoc();
    notify('Procedure details set to the standard case. Change anything that differed.');
  });

  /* --- Biopsies --- */
  el('cscAddBiopsy').addEventListener('ui-click', () => {
    syncCscFromDom();
    c.biopsies.push({ id: nextCscBiopsyId++, site: '', size: '', count: '1' });
    paintDoc();
  });
  el('reportDoc').querySelectorAll('[data-remove-csc-biopsy]').forEach((button) =>
    button.addEventListener('click', () => {
      syncCscFromDom();
      c.biopsies = c.biopsies.filter((b) => b.id !== Number(button.dataset.removeCscBiopsy));
      paintDoc();
    })
  );

  /* --- Recommendations --- */
  el('reportDoc').querySelectorAll('[data-csc-recommendation]').forEach((box) =>
    box.addEventListener('ui-change', (ev) => {
      const id = box.dataset.cscRecommendation;
      if (ev.detail.checked) c.recommendations.add(id);
      else c.recommendations.delete(id);
    })
  );
  el('cscRepeat').addEventListener('ui-change', (ev) => (c.repeatProcedure = ev.detail.checked));
  el('cscRepeatValue').addEventListener('ui-change', (ev) => (c.repeatValue = ev.detail.value));
  el('cscRepeatUnit').addEventListener('ui-change', (ev) => (c.repeatUnit = ev.detail.value));

  el('cscCustomRecAdd').addEventListener('ui-click', () => {
    const value = el('cscCustomRec').value.trim();
    if (!value) return;
    syncCscFromDom();
    c.customRecommendations.push(value.slice(0, 200));
    paintDoc();
  });
  el('reportDoc').querySelectorAll('[data-drop-csc-rec]').forEach((button) =>
    button.addEventListener('click', () => {
      syncCscFromDom();
      c.customRecommendations.splice(Number(button.dataset.dropCscRec), 1);
      paintDoc();
    })
  );

  /* --- Photos — read locally, no server round trip needed for a prototype --- */
  el('cscAddPhotos').addEventListener('ui-click', () => el('cscPhotoInput').click());
  el('cscPhotoInput').addEventListener('change', () => {
    const files = [...el('cscPhotoInput').files].slice(0, EGD_MAX_PHOTOS - c.photos.length);
    if (!files.length) return;
    let pending = files.length;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        c.photos.push({ id: nextCscPhotoId++, name: file.name, dataUrl: reader.result });
        pending -= 1;
        if (pending === 0) {
          syncCscFromDom();
          paintDoc();
        }
      };
      reader.readAsDataURL(file);
    });
  });
  el('reportDoc').querySelectorAll('[data-remove-csc-photo]').forEach((button) =>
    button.addEventListener('click', () => {
      syncCscFromDom();
      c.photos = c.photos.filter((p) => p.id !== Number(button.dataset.removeCscPhoto));
      paintDoc();
    })
  );
}

/**
 * The colonoscopy bar's signed state.
 *
 * Signing is what closes the document, so the bar swaps from "this is being
 * written" to "this is filed, and here is how to reopen it" — the same pair
 * the EGD bar carries.
 */
function paintColonoscopyBar() {
  const stamp = el('colonoscopyStamp');
  const unlock = el('unlockReport');
  if (!stamp || !unlock) return;

  stamp.innerHTML = state.signed
    ? `<ui-badge status="success">Signed by ${esc(state.signedBy)} · ${esc(
        state.signedDate
      )}, ${esc(state.signedTime)}</ui-badge>`
    : '';
  unlock.hidden = !state.signed;
}

/* ===================== The clinic visit note =====================
   WHY THIS IS HERE AT ALL

   A clinic visit and a procedure are not the same document, and for a long
   time this screen rendered them as if they were: whichever note template the
   picker showed — SOAP Note, GI Consultation, New Patient — the middle column
   was a colonoscopy report, asking for bowel preparation quality and caecal
   intubation depth. The template was a label with nothing behind it.

   So each template is now a document, declared in data/visit-note-templates.js
   and rendered by the four functions below. They are deliberately small: the
   spec decides what a note asks, and this file decides only how a question
   looks. Adding a template is a change to the data module and nothing else.

   IT WEARS THE SAME CHROME AS THE REPORT
   Section headings, signature block — all the same `enc__doc-*` styles the
   colonoscopy report uses. That is the whole point. A clinician who has
   written one document in this practice has written all of them, and a reader
   holding a printed consultation and a printed procedure report is holding two
   pages that were plainly produced by the same clinic.
   -------------------------------------------------------------------------- */

/** The spec behind whatever the picker is showing, never undefined. */
const visitNoteSpec = () =>
  templateByTitle(state.visitNote.template) ?? VISIT_NOTE_TEMPLATES[0];

/** Every field across a template, flattened — for seeding and for reading back. */
const visitNoteFields = (spec) => spec.sections.flatMap((section) => section.fields ?? []);

/**
 * One question.
 *
 * Three control types cover every template, and they are the same three the
 * procedure report and the procedure run's documents use, so a select behaves
 * like a select wherever it is met. `span` puts a field across both columns —
 * prose always does, because a four-line textarea in a half-width column is a
 * ransom note.
 */
function visitNoteFieldHtml(field) {
  const id = `vn-${field.key}`;
  const testid = `enc--vn-${field.key}`;
  const label = esc(field.label);
  const hidden = field.labelHidden ? ' label-hidden' : '';
  /* The emphasised field is the one thing on the note somebody acts on later —
     the plan the patient leaves with, the interval the recall is booked from.
     The class no longer paints anything: the edge rule that marked it came off
     both documents (see .enc__vn-field--emphasis in css/screen-clinic-visit.css
     for why). It stays on the element so the field remains addressable. */
  const classes = `enc__vn-field${field.span ? ' enc__span-2' : ''}${
    field.emphasis ? ' enc__vn-field--emphasis' : ''
  }`;

  if (field.type === 'select') {
    return `<div class="${classes}"><ui-select id="${id}" label="${label}"${hidden}
      placeholder="${esc(field.placeholder ?? 'Select')}"
      data-vn-field="${esc(field.key)}" data-testid="${testid}"></ui-select></div>`;
  }
  if (field.type === 'textarea') {
    /*
     * V2: THE LONG PROSE FIELD GETS A FORMATTING BAR.
     *
     * `rich` is set on exactly the histories of present illness — see the note
     * about the flag at the head of data/visit-note-templates.js. The tag is
     * different and nothing else is: same id, same data-vn-field, same
     * data-testid, and the same ui-input/ui-change pair on the way out, so the
     * note's delegated commit handler, syncVisitNoteFromDom, the rail's Import
     * and the scribe's Copy to note all go on treating it as the prose field
     * it has always been.
     */
    if (field.rich) {
      return `<div class="${classes}"><ui-richtext id="${id}" label="${label}"${hidden}
        rows="${field.rows ?? 5}" placeholder="${esc(field.placeholder ?? '')}"
        data-vn-field="${esc(field.key)}" data-testid="${testid}"></ui-richtext></div>`;
    }
    return `<div class="${classes}"><ui-textarea id="${id}" label="${label}"${hidden}
      rows="${field.rows ?? 3}" placeholder="${esc(field.placeholder ?? '')}"
      data-vn-field="${esc(field.key)}" data-testid="${testid}"></ui-textarea></div>`;
  }
  return `<div class="${classes}"><ui-input id="${id}" type="${field.type === 'time' ? 'time' : 'text'}"
    label="${label}"${hidden} placeholder="${esc(field.placeholder ?? '')}"
    data-vn-field="${esc(field.key)}" data-testid="${testid}"></ui-input></div>`;
}

/**
 * One section: heading, whatever the chart already knows, then the questions.
 *
 * A CARD, THE WAY A PROCEDURE DOCUMENT IS A RUN OF CARDS.
 * The note used to be a flat column with its sections marked by a small grey
 * uppercase heading over a hairline — SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN.
 * That is the report's rhythm, and it works on the report, where fourteen dense
 * sections could not each afford a border. A visit note has four to six, each
 * one a question the clinician answers in a block and then leaves, and the
 * flat treatment gave them nothing to leave: the eye had to re-find where
 * Objective stopped and Assessment started every time it came back up the
 * column.
 *
 * So a section is a card with a marked edge before its title, which is exactly
 * what the pre-procedure sheet does with its eleven — see .encv .pck__section
 * in css/screen-encounter.css. Same shape, same green bar, same inset, so a
 * clinician who has worked a procedure day recognises a block of questions on
 * sight. The infusion note gains the most from it, being the one template whose
 * sections are worked at five different points in a two-hour visit.
 *
 * The body is a wrapper element rather than the card's own padding, because the
 * header band is inset on its own and a padded card would inset the title
 * twice.
 *
 * NO QUOTED BLOCK AT THE TOP OF A SECTION any more. A section used to open with
 * whatever the chart already knew about it — the problem list over Assessment,
 * the medication list over Medications and allergies, the check-in vitals over
 * Examination — read-only, with a line saying to go and edit it on the chart.
 * All of it is in the clinical rail on the right of this screen, in full and in
 * one place, so the block was a third copy of the same facts sitting at the top
 * of the very section whose job is to say something new about them. See the
 * note at the head of data/visit-note-templates.js.
 */
function visitNoteSectionHtml(section) {
  /*
   * V2: A SECTION SAYS WHEN A MACHINE DRAFTED IT.
   *
   * The note is signed by a clinician and they are accountable for every word
   * in it, including the words they accepted from the scribe. The record
   * should say which those were — so a section that was copied out of the
   * draft carries the mark, in the scribe's own purple, and one the clinician
   * typed carries nothing.
   *
   * It survives a repaint because it is read off `state.scribeFilled` rather
   * than stuck onto the DOM at the moment of copying.
   */
  const filled = section.fields?.some((field) => state.scribeFilled.has(field.key));

  return `<section class="enc__doc-section enc__vn-section"
    data-testid="enc--vn-section-${section.id}">
    <h3>${esc(section.title)}${
      filled
        ? `<span class="scribe-filled" data-testid="enc--vn-ai-${section.id}">AI drafted</span>`
        : ''
    }</h3>
    <div class="enc__vn-section-body">
      ${
        section.note
          ? `<p class="enc__doc-caption enc__doc-caption--lead">${esc(section.note)}</p>`
          : ''
      }
      ${
        section.fields
          ? `<div class="enc__grid-2 enc__vn-grid">${section.fields
              .map(visitNoteFieldHtml)
              .join('')}</div>`
          : ''
      }
      ${
        /* The Plan, and only the Plan, carries what it commits to. Keyed off
           the section id rather than the template, because every template that
           HAS a plan shares this one section object — see PLAN_SECTION in
           data/visit-note-templates.js — and a template that does not have one
           (the infusion note ends in a next dose, not a plan) is a note with
           nothing to raise orders from. */
        section.id === 'plan' ? planCommitmentsHtml() : ''
      }
      ${
        /* And the tool row sits under all of it, at the foot of the last card
           on the note — which is where a clinician is when they discover the
           note needs something the template did not give them. */
        isToolRowSection(section) ? noteToolsHtml() : ''
      }
    </div>
  </section>`;
}

/* ===========================================================================
   V2: THE TOOL ROW UNDER THE PLAN

   Three things a note can be given that no template offers: a review of
   systems, a marked-up diagram, and an order raised against the plan.

   WHY THEY ARE AT THE BOTTOM AND NOT IN A TOOLBAR AT THE TOP.

   Because they are not things you decide before writing. A clinician reaches
   the foot of the Plan having just written what happens next, and that is the
   moment the gaps show — the history needed a systems review, the examination
   needed a picture, the plan needs a lab behind it. A toolbar above the note
   asks for those decisions before any of them can be made.

   WHY "ADD ORDERS" IS HERE WHEN THE PLAN CARD ALREADY HAS THREE RAISE BUTTONS.

   It is the same action and it is deliberately not a fourth way to do it: the
   button takes the clinician to the Orders group inside the Plan and puts the
   focus on it. The raise buttons stay where the orders they produce are
   listed, because a control that files something belongs beside the thing it
   files into — and the tool row stays a complete answer to "what else can this
   note have", which it would not be if orders were missing from it.
   ======================================================================== */

/**
 * Which section carries the tool row: the Plan, or the last section on a note
 * that has no plan.
 *
 * Every template but one ends in a plan, and that is where a clinician is when
 * they find the note needs something the template did not give them. The
 * Infusion Visit is the exception — it ends in a next dose, not a plan, because
 * nothing is decided at an infusion visit that was not decided before it — and
 * keying the row to `plan` alone left that one template with no way to add a
 * review of systems or a body map at all. Which is the wrong answer twice
 * over: an infusion is exactly the visit where somebody wants to mark where
 * the site reacted.
 *
 * The plan commitments stay keyed to the Plan itself. Those really are about
 * orders raised from a plan, and a note with no plan has nothing to raise.
 */
function isToolRowSection(section) {
  if (section.id === 'plan') return true;
  const sections = visitNoteSpec().sections;
  return !sections.some((entry) => entry.id === 'plan') &&
    sections[sections.length - 1]?.id === section.id;
}

function noteToolsHtml() {
  const signed = state.visitNote.signed;
  /* A signed note is the record. Nothing may be added to it, and the row goes
     rather than greying out: six disabled controls under a signature is a
     paragraph of chrome explaining that the document is finished, which the
     signature above it has already said. */
  if (signed) return '';

  const ros = state.extras.ros.added;
  const map = state.extras.bodyMap.added;

  return `<div class="enc__vn-tools" data-testid="enc--vn-tools">
    <span class="enc__vn-tools-label">Add to this note</span>
    <div class="enc__vn-tools-row">
      <ui-button variant="outline" size="sm" icon="${ros ? 'check' : 'plus'}"
        data-note-tool="ros" data-testid="enc--tool-ros"
        ${ros ? 'disabled' : ''}>${ros ? 'ROS added' : 'ROS'}</ui-button>
      <ui-button variant="outline" size="sm" icon="image"
        data-note-tool="bodymap" data-testid="enc--tool-bodymap">
        ${map ? 'Edit annotated image' : 'Annotable Image'}</ui-button>
      <ui-button variant="outline" size="sm" icon="flask"
        data-note-tool="orders" data-testid="enc--tool-orders">Add Orders</ui-button>
    </div>
  </div>`;
}

/* ===========================================================================
   V2: THE TWO ADDED BLOCKS, AS SECTIONS OF THE NOTE

   Both render as .enc__vn-section cards — the same band, the same title, the
   same inset as every section the template declared. That is not laziness. A
   block that is going to be signed is part of the document, and a body map
   drawn as an attachment clipped to the side of a note is a body map the next
   clinician reads as an attachment: optional, supplementary, skippable. It is
   none of those things. It is where the finding is.
   ======================================================================== */

/*
 * Where an added block goes in a note that did not come with one.
 *
 * IMMEDIATELY BEFORE THE EXAMINATION. That is not a layout preference, it is
 * the definition of the thing: a review of systems is what is ASKED after the
 * history is taken and before a hand is laid on the patient, and a body map is
 * read against the examination it illustrates. Anchoring on the exam puts both
 * blocks at that seam in every template the practice writes, whatever its
 * history is called — Subjective, Interval history, Presenting complaint — and
 * without this file having to know any of those names.
 *
 * THE FIRST RULE WAS "AFTER THE FIRST SECTION THAT HOLDS PROSE", and it is
 * worth recording why it came out, because it reads perfectly well until you
 * run it against the seven templates. It was right for a SOAP note and for a
 * follow-up, and wrong for the two longest documents: a GI Consultation opens
 * with Reason for consultation, whose referral question is a textarea, so the
 * systems review landed above the history of present illness; and a New
 * Patient note put it above the past medical history, medications and family
 * history, which are exactly the things a clinician asks BEFORE running the
 * systems. A rule that is correct on the short notes and wrong on the long
 * ones is worse than no rule, because the long notes are the ones anybody
 * would add a review of systems to.
 *
 * The fallbacks walk the same clinical order outwards — assessment, then plan
 * — so a template with no examination still puts the block before the
 * reasoning rather than after it. A template with none of the three is not one
 * that exists today, and appending is the only honest answer if one is added.
 */
const EXTRA_ANCHORS = [
  ['exam', 'objective', 'examination'],
  ['assessment', 'impression'],
  ['plan'],
];

function insertPointForExtra(sections) {
  for (const anchor of EXTRA_ANCHORS) {
    const index = sections.findIndex((section) => anchor.includes(section.id));
    if (index !== -1) return index;
  }
  return sections.length;
}

/** One ROS row: the system, its prompt, and the three-way answer. */
function rosRowHtml(system) {
  const value = state.extras.ros.answers[system.id] ?? '';
  return `<div class="enc__ros-row" data-testid="enc--ros-${system.id}">
    <ui-radio-group inline label="${esc(system.label)}"
      options="${esc(ROS_ANSWERS.join(','))}" value="${esc(value)}"
      data-ros="${esc(system.id)}"></ui-radio-group>
    <p class="enc__ros-prompt">${esc(system.prompt)}</p>
  </div>`;
}

function rosSectionHtml() {
  const ros = state.extras.ros;
  const signed = state.visitNote.signed;
  const answered = ROS_SYSTEMS.filter((system) => ros.answers[system.id]).length;

  /*
   * A SIGNED ROS IS PROSE, NOT FOURTEEN DEAD RADIO GROUPS.
   *
   * Under a signature the answers stop being a form and become a sentence in
   * the record, so they are printed as one — the abnormal systems named first
   * because they are the reason anybody reads a review of systems, then the
   * normal ones collapsed into the phrase every clinician already writes.
   */
  if (signed) {
    const grouped = ROS_ANSWERS.map((answer) => ({
      answer,
      systems: ROS_SYSTEMS.filter((system) => ros.answers[system.id] === answer),
    })).filter((group) => group.systems.length);

    return `<section class="enc__doc-section enc__vn-section"
      data-testid="enc--vn-section-ros">
      <h3>${esc(ROS_SECTION_TITLE)}</h3>
      <div class="enc__vn-section-body">
        ${
          grouped.length
            ? `<dl class="enc__ros-signed">${grouped
                .map(
                  (group) => `<dt>${esc(group.answer)}</dt>
                    <dd>${group.systems.map((s) => esc(s.label)).join(', ')}</dd>`
                )
                .join('')}</dl>`
            : '<p class="enc__doc-caption">No systems were reviewed.</p>'
        }
        ${ros.detail.trim() ? `<p class="enc__ros-detail">${esc(ros.detail)}</p>` : ''}
      </div>
    </section>`;
  }

  return `<section class="enc__doc-section enc__vn-section"
    data-testid="enc--vn-section-ros">
    <h3>${esc(ROS_SECTION_TITLE)}
      <span class="enc__ros-count" data-testid="enc--ros-count">${answered} of ${
        ROS_SYSTEMS.length
      }</span>
    </h3>
    <div class="enc__vn-section-body">
      <div class="enc__ros-bar">
        <ui-button variant="outline" size="sm" data-ros-all
          data-testid="enc--ros-all">All systems negative</ui-button>
        <ui-button variant="tertiary" size="sm" data-ros-remove
          data-testid="enc--ros-remove">Remove this section</ui-button>
      </div>
      <div class="enc__ros-grid">${ROS_SYSTEMS.map(rosRowHtml).join('')}</div>
      <div class="enc__ros-detail-field">
        <ui-textarea id="vn-rosDetail" label="Detail on anything abnormal" rows="2"
          placeholder="What was abnormal, and how…"
          data-testid="enc--ros-detail"></ui-textarea>
      </div>
    </div>
  </section>`;
}

function bodyMapSectionHtml() {
  const { mapId, marks } = state.extras.bodyMap;
  const signed = state.visitNote.signed;

  return `<section class="enc__doc-section enc__vn-section"
    data-testid="enc--vn-section-bodymap">
    <h3>Annotated image
      <span class="enc__ros-count">${esc(bodyMapById(mapId).label)}</span>
    </h3>
    <div class="enc__vn-section-body">
      ${bodyDiagramBlock({ mapId, marks })}
      ${
        signed
          ? ''
          : `<div class="enc__ros-bar">
              <ui-button variant="outline" size="sm" data-note-tool="bodymap"
                data-testid="enc--bodymap-edit">Edit marks</ui-button>
              <ui-button variant="tertiary" size="sm" data-bodymap-remove
                data-testid="enc--bodymap-remove">Remove this section</ui-button>
            </div>`
      }
    </div>
  </section>`;
}

/*
 * visitNoteOutstanding() USED TO BE HERE.
 *
 * It returned the titles of the sections nobody had written into, and the one
 * thing that called it was the footer hint that counted them — see updateHint()
 * for why that line came off. Deleted rather than kept for a caller that might
 * want it one day: a function with no callers is a function that quietly stops
 * agreeing with the document it describes, and this one already had no opinion
 * about the two blocks a clinician can now ADD to a note.
 */

/**
 * Pull the note out of the DOM and into state.
 *
 * Same contract as syncCscFromDom(): a repaint rebuilds every control from
 * state, so anything typed and not yet committed would be thrown away by it.
 * Switching template repaints, and switching template is exactly when a
 * half-written paragraph is most likely to be sitting in a textarea.
 */
function syncVisitNoteFromDom() {
  const values = state.visitNote.values;
  visitNoteFields(visitNoteSpec()).forEach((field) => {
    const node = el(`vn-${field.key}`);
    if (node) values[field.key] = node.value ?? values[field.key] ?? '';
  });
}

/* ===================== The encounter clock =====================

   HOW LONG THIS ENCOUNTER HAS BEEN OPEN, on the note's own document bar beside
   the template picker. The two of them are what a clinician working a clinic
   visit needs above the note and all that is left of a wider strip that used to
   run across the top of the procedure screen: what kind of note this is, and
   how long it has been open.

   Counted from the moment the screen opened, and the title on the pill says so.
   It is tempting to count from check-in instead — that is the number a clinic
   actually manages — but the booking carries no arrival stamp, so a clock
   claiming to measure the wait would be measuring the page load and calling it
   something else.
   -------------------------------------------------------------------------- */

/* Module scope rather than state: it is set once, by the act of loading the
   screen, and nothing that repaints may move it. */
const encounterOpenedAt = Date.now();

/** hh:mm:ss since the screen opened. */
function elapsedLabel() {
  const seconds = Math.floor((Date.now() - encounterOpenedAt) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(
    seconds % 60
  )}`;
}

/*
 * Show the pill and start it.
 *
 * Only the DIGITS are rewritten once a second — the pill, its icon and its
 * title are painted once and left alone, because repainting the whole bar every
 * second would take the focus ring off the template picker beside it once a
 * second for as long as the note is open.
 *
 * aria-live is off on the value for the same reason: a screen reader announcing
 * the time every second would make the page unusable. The pill is still a
 * role="timer" a reader can go and read on purpose.
 */
function startEncounterClock() {
  const pill = el('encTimer');
  if (!pill) return;
  pill.hidden = false;

  const tick = () => {
    const value = el('encTimerValue');
    if (value) value.textContent = elapsedLabel();
  };
  tick();
  window.setInterval(tick, 1000);
}

/* ===================== Importing from an earlier encounter =================
   The Encounter tab of the clinical rail lists every visit this patient has
   already had and puts an Import on each section of the note that was written
   at it. This is where that text lands.

   WHY THE RAIL DOES NOT DECIDE WHERE IT GOES
   Because it cannot. The rail knows it is handing over an "Assessment"; only
   this screen knows which of seven templates is on the desk and whether that
   template has anywhere for an assessment to go — an Infusion Visit does not.
   So the rail asks, and this answers.
   -------------------------------------------------------------------------- */

/*
 * WHERE A SECTION OF AN OLD NOTE GOES IN A NEW ONE.
 *
 * Consulted only when the note has no section of its own with the same name —
 * a SOAP note's Assessment goes to its `assessment` field without anything
 * here having to say so, and a mapping that only exists for the cases that do
 * not line up is a mapping that stays small enough to be read.
 *
 * The candidates are tried in order and the first one the CURRENT template
 * actually has wins. Keys can repeat across the list because a template that
 * has `assessment` and one that has `impression` are asking the same question
 * under two names.
 *
 * TEXTAREAS ONLY, enforced below rather than here. A paragraph of last month's
 * note pasted into "Fit to infuse", whose three answers are Yes, Yes with
 * premedication and No, is not an import — it is a broken field.
 *
 * AND THE LISTS RUN OUT ON PURPOSE. An Infusion Visit has no assessment and no
 * plan — it records a dose given and watched, and it ends at the next one — so
 * `assessment` and `plan` find nothing on it and the section goes to the
 * clipboard instead. Earlier drafts kept going and put both of them in
 * "Post-infusion observation", which was the only prose box left: a note that
 * files last month's plan under this month's observations is worse than a note
 * that admits it has nowhere to put it. A candidate belongs on a list only if
 * the section MEANS the same thing there.
 */
const IMPORT_TARGETS = {
  subjective: ['subjective', 'hpi', 'interval', 'question', 'preNote'],
  objective: ['examOther', 'recoveryNote', 'postNote'],
  assessment: ['assessment', 'impression', 'pathSummary'],
  plan: ['plan', 'letter'],
  indication: ['subjective', 'hpi', 'question', 'interval', 'preNote'],
  procedure: ['pathSummary', 'recoveryNote', 'background', 'history'],
  findings: ['pathSummary', 'examOther', 'recoveryNote'],
  recommendations: ['plan', 'letter'],
  infusion: ['preNote', 'postNote', 'recoveryNote'],

  /*
   * A BOOKING'S OWN RECORD, opened from a row that has no note behind it —
   * something still to come, or a visit nobody wrote up. The sections are
   * `appt-` prefixed by data/prior-encounters.js so they cannot be matched
   * against a note section of the same name.
   *
   * Only the reason has a home. It is the words the desk took down when the
   * appointment was made — "Post-op review, hernia repair" — and that is what
   * the presenting complaint of today's note is for, so importing it saves the
   * one bit of retyping on this screen that is genuinely error-prone: a
   * clinician reading a reason out of a header and writing it down slightly
   * differently from what the patient said.
   *
   * The rest are not here and are not meant to be. Where the room is, who is
   * assisting and what the desk wrote on the booking are facts ABOUT the
   * appointment; a clinical note has no section that means any of them, and the
   * clipboard is the honest place for text with nowhere to go.
   */
  'appt-reason': ['subjective', 'hpi', 'question', 'interval', 'preNote'],
};

/**
 * The field on today's note that an old section belongs in, or null.
 *
 * Two passes. First the template's own section of the same name, because a
 * heading that matches is a mapping nobody has to maintain and nobody can let
 * drift. Then the table above, for the notes whose sections are named for what
 * they are rather than for the four letters of SOAP.
 */
function importTargetField(section) {
  const spec = visitNoteSpec();
  const prose = (field) => field.type === 'textarea';

  const named = spec.sections.find((s) => s.id === section.id);
  const byName = named?.fields?.find(prose);
  if (byName) return byName;

  const fields = visitNoteFields(spec);
  for (const key of IMPORT_TARGETS[section.id] ?? []) {
    const field = fields.find((f) => f.key === key && prose(f));
    if (field) return field;
  }
  return null;
}

/**
 * Put one section of an earlier note into today's, and say what happened.
 *
 * IT APPENDS, IT NEVER REPLACES. The clinician may already have typed into the
 * field, and an import that swallowed a half-written paragraph would be the one
 * unrecoverable thing a read-only rail could do.
 *
 * IT SAYS WHERE THE WORDS CAME FROM. Copy-forward is how a chart fills up with
 * findings nobody made and plans nobody agreed, and the mitigation is not to
 * refuse the paste — clinicians need it, which is why every EHR has it — but to
 * make the paste say what it is. One line naming the visit it came from, above
 * the block, so a reader of the signed note can tell today's words from last
 * month's without opening anything.
 *
 * @returns {{ok: boolean, message: string, copy?: boolean}} the contract
 *   js/lib/clinical-rail.js reads. `copy: true` on a refusal asks the rail to
 *   put the text on the clipboard instead, so a press always gets the words
 *   somewhere rather than merely explaining why it will not.
 */
function importIntoNote(section, encounter) {
  if (state.locked || state.visitNote.signed) {
    return {
      ok: false,
      copy: true,
      message:
        'The note is signed, so nothing can be imported into it. The section has been copied to the clipboard instead.',
    };
  }

  const field = importTargetField(section);
  if (!field) {
    return {
      ok: false,
      copy: true,
      message: `A ${state.visitNote.template} has no free-text section for ${section.label}. It has been copied to the clipboard instead.`,
    };
  }

  /* Capture before writing, for the same reason paintVisitNote does: state is
     behind the DOM until something reads the controls back. */
  syncVisitNoteFromDom();

  const existing = String(state.visitNote.values[field.key] ?? '').trim();
  /* Name the SOURCE for what it is. A row with a note behind it is a note; a
     row without one is a booking, and calling an appointment still in the diary
     "the SOAP Note of Thu, 6 Aug" would put a citation in the chart for a
     document nobody has written. */
  const provenance = encounter?.hasNote
    ? `From the ${encounter.noteType} of ${encounter.date}:`
    : `From the ${encounter?.apptType ?? 'appointment'} booked for ${
        encounter?.date ?? 'another date'
      }:`;
  const block = `${provenance}\n${section.text}`;
  const next = existing ? `${existing}\n\n${block}` : block;

  state.visitNote.values[field.key] = next;

  /* Written straight onto the live control rather than through a repaint. A
     repaint would rebuild every field on the note, which throws away the
     caret, the scroll position and any focus the clinician had — a heavy
     price for changing one textarea. */
  const node = el(`vn-${field.key}`);
  if (node) {
    node.value = next;
    /* Show them where it went. The rail is at the right edge and the field is
       in the middle column, so an import with no movement anywhere looks like
       a button that did nothing. */
    node.scrollIntoView({ block: 'nearest' });
  }

  updateHint();

  return {
    ok: true,
    message: `${section.label} imported into ${field.label}.`,
  };
}

/* ===================== What the Plan commits to =====================
   ORDERS AND A RECALL, RAISED WHERE THE DECISION IS MADE.

   Two things follow from the Plan of a clinic visit and neither of them used
   to leave it. The clinician wrote "check LFTs, book a surveillance scope, see
   me in six months" and then — if the afternoon allowed — went to the chart's
   Orders tab, typed the lab, went to the Recalls worklist, typed the recall.
   Two more screens, both of them after the patient has gone, and the record of
   what was decided living in a paragraph that nothing can query.

   What that cost is visible in the demo data: TK-4394 in data/tasks.js is a
   task chasing a surveillance interval because "the check-out sheet guessed
   five years and nobody has confirmed it". The desk was guessing because the
   note it should have been reading did not say, in any form a desk can read.

   So the Plan raises them itself, in place:

     ORDERS      a lab, an EGD or a colonoscopy, each asked for in the
                 practice's own vocabulary — the same catalogue, vendors and
                 ICD list the chart's Orders tab uses, so an order raised here
                 IS an order and not a note about one.
     A RECALL    read off the Plan's own follow-up interval, which has been a
                 field rather than prose since the note was built, and which
                 until now nothing consumed.

   NOTHING IS FILED UNTIL THE NOTE IS SIGNED. A draft is a clinician thinking
   and can be abandoned, re-templated or half-written for an hour; raising a
   colonoscopy order the moment a button is pressed would mean the ASC hears
   about decisions that were never made. The signature is what turns the
   document into the record, and it is what turns these into orders — which is
   also why the block says so, in the line under each list, rather than leaving
   people to find out by signing.

   WHY THE RECALL IS TWO CONTROLS AND NOT FOUR. A recall row needs a type, an
   interval, a provider and a location. Only the first two are decisions: the
   provider is whoever is signing the note, and whether the patient comes back
   to the clinic or to the ASC follows from what they are coming back FOR. Both
   are derived and shown in the summary line, where they can be read and
   disagreed with, rather than being two more pickers on a document that is
   already a column of them. The desk can change either on the Recalls screen,
   which is where a booking is actually made.
   -------------------------------------------------------------------------- */

/**
 * The three things a Plan can raise, and what each one is asked about.
 *
 * A lab and a scope are different questions — a vendor and a patient
 * instruction against a facility and a priority — so they are two dialogs
 * wearing one modal rather than one dialog with half its fields hidden.
 *
 * EGD and colonoscopy are separate entries rather than one "procedure" with a
 * picker, because they are separate DECISIONS: a clinician orders a
 * colonoscopy, not a procedure they then have to specify. The picker inside
 * each is the indication-bearing form of the one they chose.
 */
const PLAN_ORDER_KINDS = {
  lab: { label: 'Lab', heading: 'Raise a lab order', group: 'labs' },
  egd: { label: 'EGD', heading: 'Raise an EGD order', group: 'procedures' },
  colonoscopy: {
    label: 'Colonoscopy',
    heading: 'Raise a colonoscopy order',
    group: 'procedures',
  },
};

/** The procedure types one of the two scope buttons may raise. */
const planScopeTypes = (kind) =>
  PROCEDURE_TYPES.filter((type) =>
    kind === 'egd' ? type.startsWith('EGD') : /Colonoscopy|sigmoidoscopy/i.test(type)
  );

/** The staged order in one line, which is all a list of them needs to be. */
function planOrderSummary(order) {
  return order.kind === 'lab'
    ? [order.test, order.vendor, order.indication].filter(Boolean).join(' · ')
    : [order.procedure, order.priority, order.facility].filter(Boolean).join(' · ');
}

/**
 * Where a recall of this kind is kept.
 *
 * A scope is done in the ASC and a clinic follow-up in the clinic, and that is
 * the whole of the rule. Anything the list does not name falls to the clinic,
 * which is where a patient with no stated reason to be anywhere else goes.
 */
const planRecallLocation = (dueFor) =>
  /colonoscopy|egd|endoscopy|capsule/i.test(dueFor) ? RECALL_LOCATIONS[0] : RECALL_LOCATIONS[1];

/**
 * Re-derive the recall from the Plan, without overwriting a deliberate answer.
 *
 * Called whenever the follow-up field changes. Three cases:
 *   nothing chosen          the recall is left exactly as it is — an empty
 *                           follow-up is a question not yet answered, not an
 *                           instruction to cancel a recall somebody has set.
 *   "no routine follow-up"  that IS an answer, and it says no recall. The type
 *                           is cleared, which is how this module says "none".
 *   an interval             a recall is proposed: a general clinic follow-up
 *                           unless a scope has already been raised on this
 *                           plan, in which case the patient is plainly coming
 *                           back for that.
 */
function syncPlanRecall() {
  const recall = state.plan.recall;
  const followUp = String(state.visitNote.values.followUp ?? '').trim();
  if (!followUp) return;

  if (/^no routine follow/i.test(followUp)) {
    recall.dueFor = '';
    recall.interval = '';
    recall.intervalTouched = false;
    return;
  }

  if (!recall.dueFor) {
    const scope = state.plan.orders.find((order) => order.kind !== 'lab');
    /* The scope's own type is used verbatim when the recall vocabulary has it,
       because the two lists are worded to match on purpose — see
       PROCEDURE_TYPES in data/chart-orders.js. A scope whose wording has no
       recall equivalent falls back rather than inventing a type the Recalls
       screen's own filters would not recognise. */
    recall.dueFor =
      (scope && RECALL_TYPES.find((type) => type === scope.procedure)) ??
      'Clinic follow-up — general';
  }

  if (!recall.intervalTouched) {
    recall.interval = recallIntervalFor(followUp) || recall.interval;
  }
}

/** The sentence under the recall controls: what will be written, in full. */
function planRecallSummary() {
  const { dueFor, interval } = state.plan.recall;
  const followUp = String(state.visitNote.values.followUp ?? '').trim();

  if (/^no routine follow/i.test(followUp) && !dueFor) {
    return 'This plan sets no routine follow-up, so no recall will be written.';
  }
  if (!dueFor) {
    return 'Choose what the patient is coming back for, and a recall is written when this note is signed.';
  }
  if (!interval) return 'Choose an interval, and the due date is worked out from today.';

  const { dueLabel } = dueFromInterval(interval);
  return `Due ${dueLabel} · ${actingProvider()} · ${planRecallLocation(dueFor)} — written to Recalls when this note is signed.`;
}

/**
 * The block, appended inside the Plan section.
 *
 * Signed, it is a record of what was filed rather than a set of controls: the
 * orders went to the chart and the recall to the worklist, and both are now
 * somebody else's to change. Re-offering a "+ Lab" button under a signature
 * would be offering to raise an order this note cannot account for.
 */
function planCommitmentsHtml() {
  const { orders, recall, filed } = state.plan;
  const signed = state.visitNote.signed;

  const orderRows = orders.length
    ? orders
        .map(
          (order, i) => `<li class="enc__commit-item" data-testid="enc--plan-order-${i}">
            <span class="enc__commit-kind">${esc(PLAN_ORDER_KINDS[order.kind].label)}</span>
            <span class="enc__commit-text">${esc(planOrderSummary(order))}</span>
            ${
              signed
                ? ''
                : `<button type="button" class="enc__commit-drop" data-plan-drop="${i}"
                     aria-label="Remove this order from the plan"
                     data-testid="enc--plan-order-drop-${i}">&times;</button>`
            }
          </li>`
        )
        .join('')
    : `<li class="enc__commit-empty">No orders raised from this plan.</li>`;

  return `<div class="enc__commit" id="planCommit" data-testid="enc--plan-commit">
    <div class="enc__commit-group">
      <h4 class="enc__commit-title">Orders</h4>
      ${
        signed
          ? ''
          : `<div class="enc__commit-raise">${Object.entries(PLAN_ORDER_KINDS)
              .map(
                ([kind, spec]) =>
                  `<ui-button variant="outline" size="sm" icon="plus" data-plan-raise="${kind}"
                     data-testid="enc--plan-raise-${kind}">${esc(spec.label)}</ui-button>`
              )
              .join('')}</div>`
      }
      <ul class="enc__commit-list">${orderRows}</ul>
      <p class="enc__commit-foot">${
        signed
          ? filed
            ? 'Raised to the chart with this signature.'
            : 'Nothing was raised from this plan.'
          : 'Raised to the chart’s Orders tab when this note is signed.'
      }</p>
    </div>

    <div class="enc__commit-group">
      <h4 class="enc__commit-title">Follow-up and recall</h4>
      ${
        signed
          ? ''
          : `<div class="enc__grid-2 enc__commit-fields">
              <div class="enc__vn-field">
                <ui-select id="planRecallFor" label="Recall for" placeholder="No recall"
                  data-testid="enc--plan-recall-for"></ui-select>
              </div>
              <div class="enc__vn-field">
                <ui-select id="planRecallInterval" label="Interval" placeholder="Select"
                  data-testid="enc--plan-recall-interval"></ui-select>
              </div>
            </div>`
      }
      <p class="enc__commit-foot" data-testid="enc--plan-recall-summary">${
        signed
          ? recall.dueFor && filed
            ? `${esc(recall.dueFor)} · ${esc(recall.interval)} — written to Recalls with this signature.`
            : 'No recall was written from this plan.'
          : esc(planRecallSummary())
      }</p>
    </div>
  </div>`;
}

/**
 * Wire the block. Called from wireVisitNote, so it is re-run on every repaint.
 *
 * The two selects are filled here rather than in the markup for the same
 * reason every other picker on this screen is: <ui-select> takes its options
 * as a property, and an attribute list would have to be escaped into a
 * comma-separated string that breaks on the first option containing a comma.
 */
function wirePlanCommitments() {
  const host = el('planCommit');
  if (!host || state.visitNote.signed) return;

  options('planRecallFor', ['', ...RECALL_TYPES], state.plan.recall.dueFor);
  options('planRecallInterval', ['', ...RECALL_INTERVALS], state.plan.recall.interval);

  host.addEventListener('ui-change', (event) => {
    const field = event.target.closest('#planRecallFor, #planRecallInterval');
    if (!field) return;
    if (field.id === 'planRecallFor') state.plan.recall.dueFor = event.detail.value;
    else {
      state.plan.recall.interval = event.detail.value;
      /* A hand-set interval stops being re-derived — see the note on
         `intervalTouched` in state.plan. Clearing it back to blank is a
         retraction, so the derivation resumes. */
      state.plan.recall.intervalTouched = Boolean(event.detail.value);
    }
    paintDoc();
  });

  host.addEventListener('ui-click', (event) => {
    const raise = event.target.closest('[data-plan-raise]');
    if (!raise) return;
    openPlanOrderDialog(raise.dataset.planRaise, raise);
  });

  host.addEventListener('click', (event) => {
    const drop = event.target.closest('[data-plan-drop]');
    if (!drop) return;
    const order = state.plan.orders[Number(drop.dataset.planDrop)];
    state.plan.orders.splice(Number(drop.dataset.planDrop), 1);
    notify(`${PLAN_ORDER_KINDS[order.kind].label} order removed from the plan.`, 'info');
    paintDoc();
  });
}

/* --- Raising one order ------------------------------------------------------
   A dialog rather than a row of fields in the note, and for the same reason
   the procedure report opens a dialog to fill a specimen jar: an order is a
   commitment with a handful of parts, and a half-filled row that can reach a
   requisition is worse than no row at all. The dialog hands back a complete
   order or nothing.
   -------------------------------------------------------------------------- */

/** The fields for one kind, built fresh each time the dialog opens. */
function planOrderFieldsHtml(kind) {
  if (kind === 'lab') {
    return `<div class="enc__grid-2">
      <div class="enc__vn-field enc__span-2">
        <ui-select id="planOrdTest" label="Test" placeholder="Select a test" required
          data-testid="enc--plan-ord-test"></ui-select>
      </div>
      <div class="enc__vn-field">
        <ui-select id="planOrdVendor" label="Performing lab" placeholder="Select"
          data-testid="enc--plan-ord-vendor"></ui-select>
      </div>
      <div class="enc__vn-field">
        <ui-select id="planOrdIndication" label="Indication" placeholder="Select ICD code"
          data-testid="enc--plan-ord-indication"></ui-select>
      </div>
      <div class="enc__vn-field enc__span-2">
        <ui-input id="planOrdInstruction" label="Patient instruction"
          placeholder="Fasting, timing, anything the patient has to do…"
          data-testid="enc--plan-ord-instruction"></ui-input>
      </div>
    </div>`;
  }

  return `<div class="enc__grid-2">
    <div class="enc__vn-field enc__span-2">
      <ui-select id="planOrdProcedure" label="Procedure" placeholder="Select" required
        data-testid="enc--plan-ord-procedure"></ui-select>
    </div>
    <div class="enc__vn-field">
      <ui-select id="planOrdIndication" label="Indication" placeholder="Select ICD code"
        data-testid="enc--plan-ord-indication"></ui-select>
    </div>
    <div class="enc__vn-field">
      <ui-select id="planOrdPriority" label="Priority" placeholder="Select"
        data-testid="enc--plan-ord-priority"></ui-select>
    </div>
    <div class="enc__vn-field enc__span-2">
      <ui-select id="planOrdFacility" label="Facility" placeholder="Select"
        data-testid="enc--plan-ord-facility"></ui-select>
    </div>
    <div class="enc__vn-field enc__span-2">
      <ui-textarea id="planOrdNotes" label="Notes" rows="2"
        placeholder="Prep, sedation plan, anything the endoscopist should know…"
        data-testid="enc--plan-ord-notes"></ui-textarea>
    </div>
  </div>`;
}

/** Which kind the open dialog is raising. Read back by savePlanOrder(). */
let planOrderKind = 'lab';

function openPlanOrderDialog(kind, trigger) {
  if (state.visitNote.signed) return;
  planOrderKind = kind;

  const modal = el('planOrderModal');
  modal.setAttribute('heading', PLAN_ORDER_KINDS[kind].heading);
  el('planOrderBody').innerHTML = planOrderFieldsHtml(kind);

  if (kind === 'lab') {
    options('planOrdTest', ['', ...LAB_TEST_CATALOG], '');
    options('planOrdVendor', LAB_VENDORS, LAB_VENDORS[0]);
    options('planOrdIndication', ['', ...ICD_CODES], '');
  } else {
    const types = planScopeTypes(kind);
    options('planOrdProcedure', ['', ...types], types[0] ?? '');
    options('planOrdIndication', ['', ...ICD_CODES], '');
    options('planOrdPriority', PROCEDURE_PRIORITIES, PROCEDURE_PRIORITIES[0]);
    options('planOrdFacility', PROCEDURE_FACILITIES, PROCEDURE_FACILITIES[0]);
  }

  modal.open(trigger);
}

/**
 * Read the dialog back and stage the order.
 *
 * The one required answer is what is being ordered. Everything else has a
 * defensible default — the in-house lab, a routine priority, the practice's
 * own ASC — and a dialog that refuses to close over an unset facility is a
 * dialog that gets abandoned mid-consultation.
 */
function savePlanOrder() {
  const kind = planOrderKind;

  if (kind === 'lab') {
    const test = el('planOrdTest')?.value ?? '';
    if (!test) {
      el('planOrdTest')?.setAttribute('error', 'Choose a test.');
      return;
    }
    state.plan.orders.push({
      kind,
      test,
      vendor: el('planOrdVendor')?.value || LAB_VENDORS[0],
      indication: el('planOrdIndication')?.value || '',
      instruction: el('planOrdInstruction')?.value.trim() || '',
    });
    notify(`${test} staged on the plan.`);
  } else {
    const procedure = el('planOrdProcedure')?.value ?? '';
    if (!procedure) {
      el('planOrdProcedure')?.setAttribute('error', 'Choose a procedure.');
      return;
    }
    state.plan.orders.push({
      kind,
      procedure,
      indication: el('planOrdIndication')?.value || '',
      priority: el('planOrdPriority')?.value || PROCEDURE_PRIORITIES[0],
      facility: el('planOrdFacility')?.value || PROCEDURE_FACILITIES[0],
      notes: el('planOrdNotes')?.value.trim() || '',
    });
    notify(`${procedure} staged on the plan.`);
  }

  /* A scope raised before the follow-up was answered should still be able to
     become the recall, so the derivation is re-run rather than left to the
     next change of the follow-up field. */
  syncPlanRecall();
  el('planOrderModal').close();
  paintDoc();
}

/* --- Filing, on signature ---------------------------------------------------- */

/** dd-mm-yyyy, the shape every order in data/chart-orders.js is stamped with. */
function orderStamp(date = new Date()) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('-');
}

/** A counter, so two orders raised in one signature cannot share an id. */
let planOrderSeq = 0;
const nextPlanOrderId = (prefix) => `${prefix}-note-${++planOrderSeq}`;

/**
 * Turn the staged plan into records, once.
 *
 * Called from signVisitNote and nowhere else. It is deliberately silent about
 * a plan with nothing on it: a consultation that needs no labs and no recall
 * is an ordinary consultation, and a toast saying "0 orders raised" is the
 * screen congratulating itself for doing nothing.
 *
 * `filed` is set before the writes rather than after, and carried on the
 * booking, because the failure this guards against is a SECOND signature —
 * see the note on state.plan.filed.
 */
function filePlanCommitments(signedBy) {
  if (state.plan.filed) return;

  const stamp = orderStamp();
  const raisedFrom = `${state.visitNote.template} · ${stamp}`;

  const labs = state.plan.orders
    .filter((order) => order.kind === 'lab')
    .map((order) => ({
      id: nextPlanOrderId('lab'),
      name: order.test,
      status: 'ordered',
      orderedOn: stamp,
      orderedBy: signedBy,
      receivedOn: null,
      icdCode: order.indication,
      vendor: order.vendor,
      patientInstruction: order.instruction,
      report: null,
    }));

  const procedures = state.plan.orders
    .filter((order) => order.kind !== 'lab')
    .map((order) => ({
      id: nextPlanOrderId('prc'),
      procedure: order.procedure,
      priority: order.priority,
      facility: order.facility,
      indication: order.indication,
      notes: order.notes,
      status: 'ordered',
      orderedOn: stamp,
      orderedBy: signedBy,
      scheduledOn: null,
      /* The one field a chart-raised order leaves blank. It is what lets the
         Orders worklist say that a signed note is standing behind this row. */
      raisedFrom,
    }));

  const filed = raiseOrders(patient?.mrn, { labs, procedures });

  const { dueFor, interval } = state.plan.recall;
  let recall = null;
  if (dueFor && interval) {
    recall = addRecall({
      patient: patient?.name ?? '',
      mrn: patient?.mrn ?? '',
      dueFor,
      interval,
      provider: signedBy,
      location: planRecallLocation(dueFor),
      source: 'note-plan',
    });
  }

  state.plan.filed = true;
  if (appointment) updateAppointment(appointment.id, { planFiled: true });

  /* One sentence naming both halves, because they were one decision. Said
     only when there was something to say — see the note above. */
  const said = [
    filed ? `${filed} order${filed === 1 ? '' : 's'} raised to the chart` : '',
    recall ? `recall ${recall.id} due ${recall.dueLabel}` : '',
  ].filter(Boolean);
  if (said.length) notify(`${said.join(' · ')}.`);
}

function visitNoteSignatureHtml() {
  const n = state.visitNote;
  if (!n.signed) return `<strong>${esc(actingProvider())}</strong>`;
  return `<div class="enc__doc-signed" data-testid="enc--vn-signed">
    <strong>Electronically signed by: ${esc(n.signedBy)}</strong>
    <span>Signed: ${esc(n.signedDate)}, ${esc(n.signedTime)}</span>
  </div>`;
}

function paintVisitNote() {
  /* Capture before destroying — see syncCscFromDom's note. Safe on first paint:
     the fields do not exist yet and the read falls through to state. */
  syncVisitNoteFromDom();

  const spec = visitNoteSpec();

  /*
   * The template's own sections, with whatever has been added to this note
   * spliced into them.
   *
   * Built as a list of already-rendered strings rather than as a list of
   * section objects, because the two added blocks are not sections in the
   * spec's sense — they have no `fields`, and pretending they did would mean
   * teaching visitNoteFieldHtml about fourteen-row matrices and SVG figures to
   * save one splice here. See insertPointForExtra() for where the splice goes.
   */
  const blocks = spec.sections.map(visitNoteSectionHtml);
  const at = insertPointForExtra(spec.sections);
  const extras = [
    state.extras.ros.added ? rosSectionHtml() : '',
    state.extras.bodyMap.added ? bodyMapSectionHtml() : '',
  ].filter(Boolean);
  blocks.splice(at, 0, ...extras);

  el('reportDoc').innerHTML = `
    ${blocks.join('')}

    <footer class="enc__doc-sign">
      ${visitNoteSignatureHtml()}
      <ui-badge status="${state.visitNote.signed ? 'success' : 'warning'}">
        ${state.visitNote.signed ? 'Signed' : 'Unsigned'}
      </ui-badge>
    </footer>`;

  wireVisitNote();
  paintVisitNoteBar();
  applyVisitNoteLock();
  updateHint();
}

/**
 * A signed note is a locked one.
 *
 * "Sign and Lock" has to mean the second word as well as the first: the
 * signature says this document is the record, so nothing inside it stays
 * typeable behind it. Done after the fields are wired rather than by
 * threading a flag through the template renderer — one place to change, and
 * no way for a new field to be added to a template and quietly stay live
 * under a signature.
 *
 * Only the note body. The toolbar's Unlock to amend lives outside it and
 * stays live, because locking the way out of the lock closes the door behind
 * everybody.
 */
function applyVisitNoteLock() {
  const locked = state.visitNote.signed;
  el('reportDoc')
    ?.querySelectorAll(
      'ui-input, ui-select, ui-textarea, ui-richtext, ui-checkbox, ui-radio-group'
    )
    .forEach((control) => control.toggleAttribute('disabled', locked));
}

/**
 * The document toolbar, for a clinic visit.
 *
 * The colonoscopy report's own bar (paintColonoscopyBar) speaks about the
 * report's signature; this one says the same things about the note. Both write
 * into the same three elements, because there is one toolbar on the screen and
 * whichever document is open owns it.
 */
function paintVisitNoteBar() {
  const name = document.querySelector('.enc__doc-name');
  const stamp = el('colonoscopyStamp');
  const unlock = el('unlockReport');
  /* The heading says what the document IS; the picker beside it says which
     template it is written from. It used to say the template as well, so the
     bar read "SOAP Note ......... SOAP Note" and left the dropdown looking
     like a copy of the title rather than the control that changes it. */
  if (name) name.textContent = 'Visit note';
  if (stamp) {
    stamp.innerHTML = state.visitNote.signed
      ? `<ui-badge status="success">Signed by ${esc(state.visitNote.signedBy)} · ${esc(
          state.visitNote.signedDate
        )}, ${esc(state.visitNote.signedTime)}</ui-badge>`
      : '';
  }
  /*
   * NO UNLOCK ON A CLINIC VISIT.
   *
   * The bar is shared with the procedure report, which keeps its own Unlock
   * for Amendment because a report genuinely is amended — pathology comes
   * back days later and the findings have to be corrected. A consultation
   * note is not that document: it is signed once, at the end of the visit,
   * and the signature completes the encounter. Offering to withdraw it put a
   * button on the toolbar whose whole purpose was to undo the thing the
   * clinician had just deliberately done, so the button stays hidden here and
   * the signed note is simply the record.
   */
  if (unlock) unlock.hidden = true;
}

function wireVisitNote() {
  const values = state.visitNote.values;

  visitNoteFields(visitNoteSpec()).forEach((field) => {
    const node = el(`vn-${field.key}`);
    if (!node) return;
    if (field.type === 'select') options(`vn-${field.key}`, ['', ...field.options], values[field.key] ?? '');
    else setValue(node, values[field.key] ?? '');
  });

  /* One delegated pair of listeners rather than two per field. The note has
     upwards of twenty controls and is repainted whenever the template changes;
     re-attaching forty listeners each time is how a screen ends up firing a
     handler four times for one keystroke. */
  const commit = (event) => {
    const host = event.target.closest('[data-vn-field]');
    if (!host) return;
    values[host.dataset.vnField] = event.detail.value;

    /* The follow-up interval is the one field on the note that something else
       reads, so changing it re-derives the recall and redraws the block that
       states it. Everything else only updates the hint. A full repaint is safe
       here and nowhere else in this handler: follow-up is a select, so there is
       no half-typed paragraph for the rebuild to throw away — and
       syncVisitNoteFromDom would capture it anyway. */
    if (host.dataset.vnField === 'followUp') {
      syncPlanRecall();
      paintDoc();
      return;
    }

    updateHint();
  };
  el('reportDoc').addEventListener('ui-change', commit);
  el('reportDoc').addEventListener('ui-input', commit);

  wirePlanCommitments();
  wireNoteTools();
  wireRosSection();
}

/* ===========================================================================
   V2: WIRING THE TOOL ROW AND THE TWO BLOCKS IT ADDS

   Attached fresh on every repaint, like wirePlanCommitments() beside it: the
   note's innerHTML is rebuilt wholesale, so nothing survives to be
   double-bound. See the note on `commit` above for why the FIELDS are
   delegated and these are not — the fields number forty and change with the
   template, these are six and do not.
   ======================================================================== */

function wireNoteTools() {
  el('reportDoc')
    ?.querySelectorAll('[data-note-tool]')
    .forEach((button) =>
      button.addEventListener('ui-click', () => {
        const tool = button.dataset.noteTool;
        if (tool === 'ros') addRosSection();
        else if (tool === 'bodymap') openNoteBodyMap(button);
        else if (tool === 'orders') focusPlanOrders();
      })
    );

  el('reportDoc')
    ?.querySelector('[data-bodymap-remove]')
    ?.addEventListener('ui-click', () => {
      /* The marks go with the section. Keeping them against the day it is
         added back would mean a clinician who removed a wrong diagram and
         added a fresh one getting the wrong diagram's pins on it. */
      state.extras.bodyMap.added = false;
      state.extras.bodyMap.marks = [];
      paintDoc();
      toast('Annotated image removed from the note.', 'info');
    });
}

/**
 * Add Orders takes the clinician to the orders, rather than being a fourth
 * way of raising one.
 *
 * See the note at the head of noteToolsHtml() for why that is the right shape.
 * The focus move is the whole of the behaviour and it is not a consolation
 * prize: the raise buttons are inside the Plan card, below its prose and its
 * follow-up, and on a long note they are genuinely off screen from where the
 * tool row sits.
 */
function focusPlanOrders() {
  const first = el('reportDoc')?.querySelector('[data-plan-raise]');
  if (!first) {
    toast('This note has no plan to raise orders from.', 'warning');
    return;
  }
  first.closest('.enc__commit-group')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  first.focus?.();
}

function addRosSection() {
  state.extras.ros.added = true;
  paintDoc();
  const section = el('reportDoc')?.querySelector('[data-testid="enc--vn-section-ros"]');
  section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  /* It is inserted into the history rather than where the button was pressed,
     so the toast says so. A section that appears somewhere the clinician was
     not looking is a section they go hunting for. */
  toast('Review of systems added to the history.', 'info');
}

function wireRosSection() {
  const host = el('reportDoc');
  if (!host || !state.extras.ros.added || state.visitNote.signed) return;

  const ros = state.extras.ros;

  host.querySelectorAll('[data-ros]').forEach((group) =>
    group.addEventListener('ui-change', (event) => {
      ros.answers[group.dataset.ros] = event.detail.value;
      /* The count in the heading is the only thing that moves, so it is
         written by hand rather than repainted. A repaint here would rebuild
         fourteen radio groups and the HPI above them on every answer. */
      const count = host.querySelector('[data-testid="enc--ros-count"]');
      if (count) {
        const answered = ROS_SYSTEMS.filter((system) => ros.answers[system.id]).length;
        count.textContent = `${answered} of ${ROS_SYSTEMS.length}`;
      }
    })
  );

  const detail = el('vn-rosDetail');
  if (detail) {
    setValue(detail, ros.detail);
    detail.addEventListener('ui-change', (event) => {
      ros.detail = event.detail.value;
    });
  }

  host.querySelector('[data-ros-all]')?.addEventListener('ui-click', () => {
    /*
     * IT FILLS THE GAPS AND OVERWRITES NOTHING.
     *
     * "All systems negative" is a statement about the systems nobody has said
     * anything about yet. A clinician who has already marked the GI system
     * abnormal and then presses it has not changed their mind about the GI
     * system — and a button that quietly did would make the phrase unsafe to
     * offer at all, which is the reason most notes are written without it.
     */
    let filled = 0;
    ROS_SYSTEMS.forEach((system) => {
      if (!ros.answers[system.id]) {
        ros.answers[system.id] = ROS_NEGATIVE;
        filled += 1;
      }
    });
    paintDoc();
    toast(
      filled
        ? `${filled} unanswered system${filled === 1 ? '' : 's'} marked normal. ` +
            'Anything already answered was left alone.'
        : 'Every system already has an answer.',
      'info'
    );
  });

  host.querySelector('[data-ros-remove]')?.addEventListener('ui-click', () => {
    state.extras.ros = { added: false, answers: {}, detail: '' };
    paintDoc();
    toast('Review of systems removed from the note.', 'info');
  });
}

/** Open the marking dialog on whatever this note already has. */
function openNoteBodyMap(trigger) {
  const map = state.extras.bodyMap;
  openBodyDiagram({
    modal: el('bodyMapModal'),
    trigger,
    mapId: map.mapId,
    marks: map.marks,
    readOnly: state.visitNote.signed,
    onCommit: ({ mapId, marks }) => {
      map.mapId = mapId;
      map.marks = marks;
      /*
       * A diagram with nothing on it is not a finding, so committing an empty
       * one takes the section off the note rather than leaving an unmarked
       * figure in the signed record for a reader to wonder about.
       */
      map.added = marks.length > 0;
      paintDoc();
      if (!marks.length) {
        toast('No marks placed, so no image was added to the note.', 'info');
        return;
      }
      el('reportDoc')
        ?.querySelector('[data-testid="enc--vn-section-bodymap"]')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      toast(
        `${marks.length} mark${marks.length === 1 ? '' : 's'} added to the note.`,
        'success'
      );
    },
  });
}

/* ===================== The report document ===================== */

/**
 * Render the narrative with its tokens.
 *
 * A resolved token becomes plain prose. An unresolved one stays as a
 * highlighted chip so it is impossible to sign a report with a hole in it by
 * accident — unless Clean up has been run, which removes the sentence fragment
 * around it deliberately.
 */
function narrativeHtml() {
  return PROCEDURE_NARRATIVE.map((paragraph) => {
    const filled = paragraph.replace(/\[([^\]]+)\]/g, (match, token) => {
      const value = state.tokens.get(token);
      if (value) return esc(value);
      return state.cleaned
        ? '<span class="enc__token-gone">—</span>'
        : `<span class="enc__token" title="Unset — resolves from the structured fields">[${esc(
            token
          )}]</span>`;
    });
    return `<p>${filled}</p>`;
  }).join('');
}

function paintDoc() {
  /*
   * A clinic visit is a different document, so it is a different painter.
   *
   * The dispatch is HERE rather than at the call sites because everything that
   * repaints the middle column — signing, switching template, unlocking, saving
   * the exam, saving a polyp, first paint — goes through this one function. A
   * branch at each call site is a branch somebody adds a seventh call site
   * without.
   */
  if (!isProcedure) {
    paintVisitNote();
    return;
  }

  /*
   * Capture before destroying.
   *
   * This function rebuilds #reportDoc from state, which throws away whatever
   * is currently typed into it. The biopsy rows have no change listeners of
   * their own — they are read out of the DOM — so every repaint has to pull
   * them into state first. Doing it here rather than at each call site means
   * Sign, Clean up, template switch, unlock, exam save and polyp save are all
   * covered, instead of only the ones someone remembered.
   *
   * Safe on first paint: syncCscFromDom() reads through `?.` and falls back
   * to the existing state when the fields do not exist yet.
   */
  syncCscFromDom();

  const findings = state.findings.map(findingText).filter(Boolean);
  const impressions = state.findings.map(findingImpression).filter(Boolean);
  const endoscopist = providerById(appointment?.providerId)?.name
    ? `${providerById(appointment.providerId).name}, MD`
    : REPORT_STAFF.endoscopist;

  el('reportDoc').innerHTML = `
    ${cscSetupHtml()}

    <section class="enc__doc-section">
      <h3>Administered medications</h3>
      <div class="enc__doc-pulled">
        ${esc(ADMINISTERED_MEDICATIONS.join(' · '))}
        <span>pulled from the medication record</span>
      </div>
    </section>

    <section class="enc__doc-section">
      <h3>Physical exam</h3>
      <button type="button" class="enc__doc-pulled enc__doc-pulled--edit" id="examOpen"
        data-testid="enc--exam-open">
        ${esc(examSummary())}
        <span>pre-procedure exam · ${esc(state.exam.time)} — click to edit</span>
      </button>
    </section>

    <section class="enc__doc-section">
      <h3>Procedure narrative</h3>
      <div class="enc__doc-narrative">${narrativeHtml()}</div>
    </section>

    <section class="enc__doc-section">
      <h3>Time markers</h3>
      <table class="enc__doc-table">
        <thead><tr><th scope="col">Marker</th><th scope="col">Time</th></tr></thead>
        <tbody>
          ${TIME_MARKERS.map(
            (m) => `<tr><td><code>${esc(m.marker)}</code></td><td>${esc(m.time)}</td></tr>`
          ).join('')}
        </tbody>
      </table>
    </section>

    <section class="enc__doc-section">
      <h3>Limitations</h3>
      <input type="text" class="enc__doc-input" id="docLimitations"
        placeholder="None recorded" data-testid="enc--limitations" />
    </section>

    <section class="enc__doc-section">
      <h3>Findings</h3>
      <div class="enc__doc-findings">
        ${
          findings.length
            ? findings.map((f) => `<p>${esc(f)}</p>`).join('')
            : '<p class="enc__empty">No findings recorded.</p>'
        }
      </div>
      <div class="enc__doc-add" id="findingPicker"></div>
    </section>

    <section class="enc__doc-section">
      <h3>Other interventions</h3>
      <input type="text" class="enc__doc-input" id="docInterventions"
        placeholder="None" data-testid="enc--interventions" />
    </section>

    <section class="enc__doc-section">
      <h3>Impression / summary</h3>
      <textarea class="enc__doc-area" id="docImpressions" rows="2"
        placeholder="Enter impression or summary of findings"
        data-testid="enc--impressions">${esc(impressions.join(' '))}</textarea>
    </section>

    ${cscOutcomeHtml()}

    <section class="enc__doc-section">
      <h3>Plan</h3>
      <textarea class="enc__doc-area enc__doc-area--plan" id="docPlan" rows="2"
        data-testid="enc--plan">Repeat colonoscopy in 3 years pending pathology. Recall entry created.</textarea>
    </section>

    <section class="enc__doc-section">
      <h3>Samples</h3>
      <div class="enc__doc-pulled">
        ${esc(SAMPLES.pots.join(' · '))}
        <span>${esc(SAMPLES.summary)}</span>
      </div>
    </section>

    <section class="enc__doc-section">
      <h3>Additional notes</h3>
      <textarea class="enc__doc-area" id="docNotes" rows="2" placeholder="Optional"
        data-testid="enc--doc-notes"></textarea>
    </section>

    <section class="enc__doc-section">
      <h3>Pathology</h3>
      <div class="enc__doc-pending">${esc(PATHOLOGY_STATUS)}</div>
    </section>

    <footer class="enc__doc-sign">
      ${
        state.signed
          ? `<div class="enc__doc-signed" data-testid="enc--doc-signed">
               <strong>Electronically signed by: ${esc(state.signedBy || endoscopist)}</strong>
               <span>Signed: ${esc(state.signedDate)}, ${esc(state.signedTime)}</span>
             </div>`
          : `<strong>${esc(endoscopist)}</strong>`
      }
      <ui-badge status="${state.signed ? 'success' : 'warning'}">
        ${state.signed ? 'Signed' : 'Unsigned'}
      </ui-badge>
    </footer>`;

  wireFindingPicker();
  wireCsc();
  el('examOpen').addEventListener('click', (event) => openExam(event.currentTarget));
  paintColonoscopyBar();
  updateHint();
}

/* --- Add finding ------------------------------------------------------------- */

function wireFindingPicker() {
  el('findingPicker').innerHTML = `<ui-button variant="outline" size="sm" id="addFinding"
    data-testid="enc--add-finding">Add finding</ui-button>
    <div class="enc__find-row" id="quickFindings" hidden></div>`;

  const quick = el('quickFindings');
  quick.innerHTML = COMMON_FINDINGS.flatMap((g) => g.items)
    .map(
      (item) => `<button type="button" class="enc__find" data-finding="${item.id}"
        data-testid="enc--finding-${item.id}">${esc(item.label)}</button>`
    )
    .join('');

  el('addFinding').addEventListener('ui-click', () => {
    quick.hidden = !quick.hidden;
  });

  quick.querySelectorAll('[data-finding]').forEach((button) =>
    button.addEventListener('click', () => {
      const item = COMMON_FINDINGS.flatMap((g) => g.items).find(
        (i) => i.id === button.dataset.finding
      );
      if (item.kind === 'polyp') openPolyp(item, button);
      else {
        state.findings.push({ id: item.id, kind: 'simple', label: item.label });
        paintDoc();
      }
    })
  );
}

/* --- The structured polyp drawer --------------------------------------------- */

function polypDraft() {
  return {
    kind: 'polyp',
    id: 'polyp',
    label: 'Polyp',
    site: el('pSite').value,
    distance: el('pDistance').value,
    sizeFrom: el('pSizeFrom').value,
    sizeTo: el('pSizeTo').value,
    unit: el('pUnit').value || 'mm',
    appearance: el('pAppearance').value || 'benign',
    pedicle: el('pPedicle').value || 'sessile',
    bleeding: el('pBleeding').value || 'no',
    intervention: el('pIntervention').value,
    count: el('pCount').value || '1',
    notes: el('pNotes').value.trim(),
  };
}

function previewPolyp() {
  const draft = polypDraft();
  el('polypPreview').innerHTML = draft.site
    ? `<span class="enc__polyp-label">The report will read</span><p>${esc(
        narratePolyp(draft)
      )}</p>`
    : '<p class="enc__empty">Choose a site to see the sentence this will write.</p>';
}

function openPolyp(item, trigger) {
  const set = (id, list, value) => {
    el(id).optionList = list.map((v) => ({ value: v, label: v }));
    el(id).setAttribute('value', value ?? '');
  };
  set('pSite', POLYP_SITES, 'sigmoid colon');
  set('pUnit', SIZE_UNITS, 'mm');
  set('pAppearance', POLYP_APPEARANCE, 'benign');
  set('pPedicle', POLYP_PEDICLE, item.preset?.pedicle ?? 'sessile');
  set('pBleeding', POLYP_BLEEDING, 'no');
  set('pIntervention', POLYP_INTERVENTIONS, item.preset?.intervention ?? POLYP_INTERVENTIONS[0]);

  [['pDistance', '28'], ['pSizeFrom', '6'], ['pSizeTo', '6'], ['pCount', '1'], ['pNotes', '']].forEach(
    ([id, value]) => {
      el(id).setAttribute('value', value);
      const control = el(id).querySelector('input, textarea');
      if (control) control.value = value;
    }
  );

  previewPolyp();
  el('polypModal').open(trigger);
}

/* ===================== Output manager ===================== */

function wireOutput() {
  el('outputSteps').innerHTML = OUTPUT_STEPS.map(
    (step) => `<ui-alert severity="${step.severity}" heading="${esc(step.title)}">
      ${esc(step.detail)}
    </ui-alert>`
  ).join('');

  el('execute').addEventListener('ui-click', () => signReport(true));
}

/* ===================== Notices and commit ===================== */

/*
 * Reports float; conditions stay put — the rule the scheduler and Leads
 * already follow (js/lib/toast.js).
 *
 * The eighty-odd sentences below all report on something that has finished:
 * a form saved, a signature locked, a discharge recorded. They were written
 * into a strip at the top of the note, which pushed the whole visit down the
 * page and then sat there until the next one replaced it — and on a note
 * scrolled past the first section, out of sight entirely. A toast reports
 * from the same corner on every screen, stacks, and goes.
 *
 * `severity` stays the argument name at every call site; the toast library
 * takes the same words.
 */
function notify(message, severity = 'success') {
  toast(message, severity);
}

/**
 * The footer says what the visit is still waiting for.
 *
 * It speaks about the stage in front of you rather than the report only, so a
 * nurse on the post-procedure tab is not told about narrative tokens they
 * cannot do anything about.
 */
function updateHint() {
  const hint = el('footHint');
  if (!hint) return;

  /*
   * Which commit the footer offers depends on the stage.
   *
   * Pre-procedure has nothing to sign at stage level — the checklist and the
   * post-anaesthesia report are each signed where they are written — so it offers
   * the way onward instead. Signing the procedure report from the
   * pre-procedure stage would sign a document the clinician cannot see.
   */
  const isPre = state.stage === 'pre';
  el('proceed').hidden = !isPre;
  // Reschedule belongs to the pre-procedure stage only: once the case has
  // started there is nothing left to move.
  el('reschedule').hidden = !isPre;
  // A clinic visit commits with Save & Sign, which signs the note through the
  // Sign and Lock dialog, completes the encounter and goes back to the
  // schedule. "Sign report" is the procedure report's own commit, so it stays
  // hidden on a clinic visit at every repaint — not only the first one.
  el('sign').hidden = isPre || !isProcedure;
  el('saveAndSign').hidden = isProcedure;
  /*
   * TWO COMMITS ON A CLINIC VISIT, NOT THREE.
   *
   * Save draft and Save ran exactly the same code — read the open document out
   * of the DOM, keep it — and differed only in the sentence they toasted
   * afterwards. Three buttons in a footer where two of them do the same thing
   * is a decision the clinician has to make every time and can never get
   * right, so the note keeps Save as Draft and Save & Sign: hold it, or file
   * it. The first of those is named for what it leaves behind — a draft — so
   * the choice in the footer reads as the choice it actually is, rather than
   * as a plain Save that might or might not have finished the note.
   *
   * The procedure workspace keeps Save draft beside Sign report, where the
   * pair really is draft-versus-file and there is no plain Save at all.
   */
  el('saveDraft').hidden = isPre || !isProcedure;

  /*
   * The commit is labelled for what it actually does at this step, not for the
   * run as a whole. "Save & Proceed" everywhere meant one word standing for
   * three different actions — moving on, signing a document, and closing the
   * stage — and a button whose effect you have to guess is a button people
   * stop pressing.
   *
   *   steps 1–3          Next          — walk the run; each document is signed
   *                                      on its own card, by its own person
   *   step 4             Save & Sign   — the nurse closes and locks the stage
   *   in-procedure       Save & Sign   — signs the procedure report
   *
   * The per-document signatures moved off this button and back onto the cards
   * that own them. One button that signed as the endoscopist on one step and
   * as the anaesthetist on the next was asking the person pressing it to
   * remember whose name went on what.
   */
  if (isPre) {
    const last = state.preDoc === 'management';
    setButtonLabel('proceed', last ? 'Save & Sign' : 'Next');
    setButtonLabel('reschedule', last ? 'Reschedule appointment' : 'Reschedule');
  }
  if (!isPre && isProcedure) setButtonLabel('sign', 'Save & Sign');

  if (isPre) {
    /*
     * The hint names the next step, because Save & Proceed does a different
     * thing at each one and its label cannot say all four. A button whose
     * effect you have to guess is a button people stop pressing.
     */
    const outstanding = state.preCheckOutstanding;
    if (outstanding.length) {
      hint.textContent = `Checklist outstanding: ${outstanding.join('; ')}.`;
    } else if (state.preDoc === 'checklist') {
      hint.textContent = 'Checklist complete. Next opens the pre-anaesthesia assessment.';
    } else if (state.preDoc === 'preanaesthesia') {
      const missing = noteChecksOutstanding().length;
      hint.textContent = missing
        ? `${missing} statement${missing === 1 ? '' : 's'} outstanding on this assessment.`
        : 'Pre-anaesthesia complete. Next opens the post-anaesthesia report.';
    } else if (state.preDoc === 'report') {
      /* Step 3. What the report is still waiting on is worth saying here as
         well as on the card — it is the one document that cannot be finished
         until the case is over, so "Next" moving on is not the same as done. */
      const waiting = reportOutstanding();
      hint.textContent = waiting
        ? `${waiting}. Next opens the anaesthesia record.`
        : 'Post-anaesthesia complete. Next opens the anaesthesia record.';
    } else if (state.preSignedBy) {
      hint.textContent = `Signed and locked by ${state.preSignedBy}. In-procedure is open.`;
    } else {
      // The last step, where Save & Sign closes the stage. The hint names what
      // is still in the way, by document, rather than counting them.
      const outstandingDocs = PRE_STEPS.filter(
        (doc) => doc.id !== 'management' && preDocTone(doc).tone !== 'signed'
      );
      hint.textContent = outstandingDocs.length
        ? `Waiting on ${outstandingDocs.map((d) => d.title).join(', ')}.`
        : 'Save & Sign closes the pre-anaesthesia note and opens In-procedure.';
    }
    return;
  }

  if (state.stage === 'post') {
    const outstanding = DISCHARGE_CRITERIA.filter((c) => !state.criteria.has(c.id));
    hint.textContent = state.discharge.done
      ? `Discharged to ${state.discharge.destination} at ${state.discharge.time}.`
      : outstanding.length
        ? `${outstanding.length} discharge requirement${
            outstanding.length === 1 ? '' : 's'
          } outstanding.`
        : 'Ready for discharge.';
    return;
  }

  /*
   * A clinic visit has one document and it is not a report.
   *
   * V2: THE FOOTER NO LONGER COUNTS THE EMPTY SECTIONS.
   *
   * It used to. The hint read "New Patient · 5 sections still empty —
   * Presenting complaint, Past medical and surgical history and 3 more", and
   * it was never a gate: a note is finished when the clinician says it is, and
   * a consultation with nothing under family history is not an error. That was
   * the defence of it, and it is also the case against it. A line that names
   * five things and asks for none of them is read once, ignored afterwards,
   * and in the meantime it is the widest thing in the footer — it changed
   * length on every keystroke and shoved the two commit buttons sideways while
   * the clinician was reaching for them.
   *
   * What is left is what the footer is actually for: saying, once the note is
   * signed, that it is. Everything else the clinician can see by looking up.
   */
  if (!isProcedure) {
    const n = state.visitNote;
    /* A filed note offers no way to change it. The three commits go dead
       together rather than leaving Save & Sign live over a document that is
       already signed — pressing it would ask for a second signature on a
       record that has one. There is no way back: a signed clinic note is the
       record, and an amendment is a new document. */
    ['saveAndSign', 'saveDraft', 'save'].forEach((id) => {
      const button = el(id);
      if (button) button.disabled = n.signed;
    });
    hint.textContent = n.signed
      ? `Completed · signed by ${n.signedBy} · ${n.signedDate}. The note is part of the chart.`
      : '';
    return;
  }

  /*
   * In-procedure carries two report types behind one commit.
   *
   * The footer signs whichever report is open, so it has to speak about that
   * one — an endoscopist on the EGD tab being told about colonoscopy
   * narrative tokens would be told about a document they cannot see.
   */
  if (state.reportType === 'egd') {
    const e = state.egd;
    if (state.egdSign.signed) hint.textContent = 'Signed. The EGD report is part of the chart.';
    else if (!e.indication.trim()) hint.textContent = 'Enter a diagnostic indication before signing.';
    else if (!e.findings.length) hint.textContent = 'Record at least one finding before signing.';
    else hint.textContent = 'Ready to sign the EGD report.';
    return;
  }

  const unresolved = [...state.tokens.entries()].filter(([, v]) => !v).length;
  if (state.signed) hint.textContent = 'Signed. The report is part of the chart.';
  else if (!state.findings.length) hint.textContent = 'Record at least one finding before signing.';
  else if (unresolved && !state.cleaned) {
    hint.textContent = `${unresolved} narrative token${
      unresolved === 1 ? '' : 's'
    } still unset — fill them in, or sign and they will be stripped.`;
  } else hint.textContent = 'Ready to sign.';
}

/* ===================== Encounter lock → ASC superbill ===================== */

/**
 * "A procedure visit is three documents, not one" (data/procedure-encounter.js):
 * what the nurse and anaesthetist record before, what the endoscopist records
 * during, and what recovery records before the patient leaves. The checklist
 * and the post-anaesthesia report both now carry a real sign state (preDocTone) —
 * anaesthesia management itself never does, it is a running log, not a
 * document — so all three gates below reflect what has actually happened.
 */
function allDocumentsSigned() {
  const preDocsSigned = PRE_DOCUMENTS
    .filter((doc) => doc.id !== 'management')
    .every((doc) => preDocTone(doc).tone === 'signed');
  return preDocsSigned && state.signed && state.discharge.done;
}

/** The booked procedure's charge, falling back to a flat ASC facility fee. */
function procedureCharge(code) {
  return BILLING_PROCEDURES.find((p) => p.code === code)?.price ?? 1500;
}

/** Everything Billing needs to raise the ASC/facility claim — nothing more. */
function buildAscSuperbill() {
  const label = appointment?.procedureId
    ? procedureById(appointment.procedureId)?.title
    : typeById(appointment?.typeId)?.title;
  const code = appointment?.procedureId ? procedureById(appointment.procedureId)?.code ?? '' : '';
  const coverage = coverageFor(patient.mrn);
  const selfPay = coverage.insurance.startsWith('Self pay');
  const total = procedureCharge(code);
  const insuranceAmount = selfPay ? 0 : Math.round(total * 0.8);

  return {
    id: `asc-${appointment.id}`,
    claimType: 'UB-04',
    billDate: shortDate(appointment.date),
    dos: shortDate(appointment.date),
    patient: patient.name,
    mrn: patient.mrn,
    dob: patient.dob,
    sex: patient.sex,
    provider: providerById(appointment.providerId)?.name ?? REPORT_STAFF.endoscopist,
    facility: appointment.location || appointment.area || 'MediNova Gastroenterology ASC',
    procedureCode: code,
    procedureTitle: label ?? 'Procedure',
    admissionDate: shortDate(appointment.date),
    dischargeStatus: state.discharge.status.split(' — ')[0] || '01',
    dischargeStatusLabel: state.discharge.status,
    dischargeTime: state.discharge.time,
    payer: selfPay ? 'Self Pay' : coverage.insurance,
    memberId: coverage.memberId,
    totalAmount: total,
    insuranceAmount,
    patientPaid: 0,
    patientBalance: total - insuranceAmount,
    status: selfPay ? 'Self Pay' : 'In Network',
  };
}

/**
 * Locking is one-way. The moment the third document is signed, the note
 * closes and the ASC superbill is raised — nobody has to remember to do it,
 * and nothing else in the note can change underneath a claim that has
 * already gone to Billing.
 */
function tryLockEncounter() {
  if (state.locked || !appointment || !allDocumentsSigned()) return;

  const superbill = buildAscSuperbill();
  state.locked = true;
  state.superbillId = superbill.id;
  enqueueSuperbill(superbill);
  updateAppointment(appointment.id, {
    status: 'Check Out',
    encounterLocked: true,
    superbillId: superbill.id,
  });

  paintLockState();
  notify(
    `Encounter locked — all three documents are signed. ASC superbill ${superbill.id} was created and sent to Billing.`,
    'success'
  );
}

/** Read-only chrome for a locked note: the foot actions disable, a banner explains why. */
function paintLockState() {
  document.body.classList.toggle('is-locked', state.locked);
  if (el('sign')) el('sign').disabled = state.locked;
  if (el('saveDraft')) el('saveDraft').disabled = state.locked;

  const banner = el('lockBanner');
  if (!banner) return;
  banner.hidden = !state.locked;
  banner.innerHTML = state.locked
    ? `<svg class="ui-icon" aria-hidden="true"><use href="#i-shield"></use></svg>
       <span><strong>Encounter locked.</strong> All three documents are signed — the note is closed to further edits.</span>
       <a class="enc__lock-link" href="billing.html" data-testid="enc--lock-billing">View in Billing</a>`
    : '';
}

function signReport(viaOutputManager = false) {
  if (!state.findings.length) {
    notify('Record at least one finding before signing.', 'warning');
    return;
  }
  /*
   * Unresolved tokens used to block the sign, on the grounds that the way
   * past was the Clean up button. That button is gone, so refusing here would
   * be a dead end — the clinician would have no action left to take. Signing
   * now does what Clean up did: strip the sentence fragments around the unset
   * tokens so the filed report has no holes in it, and say how many went.
   */
  const unresolved = [...state.tokens.entries()].filter(([, v]) => !v).length;
  if (unresolved) state.cleaned = true;

  const now = new Date();
  state.signed = true;
  state.signedBy = actingProvider();
  state.signedDate = now.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
  state.signedTime = nowTime();
  // Signing the report is what the Encounters worklist calls a signed note,
  // so the row moves out of Unsigned the moment this happens rather than
  // waiting for the whole encounter to lock.
  if (appointment) updateAppointment(appointment.id, { status: 'Check Out', noteSigned: true });
  paintDoc();
  paintStages();
  // The Colonoscopy/EGD sub-tab carries its own "signed" checkmark, same as
  // the report-type tab itself — it would otherwise only catch up once the
  // clinician switches away and back.
  if (el('reportTypeTabs')) paintReportTypeTabs();
  const stripped = unresolved
    ? ` ${unresolved} unset narrative token${unresolved === 1 ? ' was' : 's were'} stripped.`
    : '';
  notify(
    (viaOutputManager
      ? 'Executed — report signed, appointment set to Check Out, charges created.'
      : 'Report signed and filed to the chart.') + stripped
  );
  tryLockEncounter();
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-select').then(() => {
  paintPatient();
  mountClinicalRail({
    rail: el('railRight'),
    announce: (message) => {
      el('copyLive').textContent = message;
    },
    /* The Encounter tab: everything already written about this patient, and an
       Import on each section of it. A clinic visit and an infusion both land
       here, so both get it. See importIntoNote below for where the text goes. */
    mrn: appointment?.mrn ?? '',
    before: appointment?.date ?? '',
    exclude: appointment?.id ?? '',
    onImport: importIntoNote,
  });
  wireRailCollapse({
    rail: el('railRight'),
    cols: el('cols'),
    side: 'right',
    name: 'clinical data',
  });
  paintHeader();
  paintDoc();
  wireOutput();
  paintLockState();

  /*
   * The visit opens where it is up to.
   *
   * Arriving from check-in on a procedure means the pre-procedure documents
   * are the next thing to do, so that is the tab that is showing — nobody has
   * to find it. A clinic visit has no stages at all and keeps the single note
   * view it has always had.
   */
  if (isProcedure) {
    showStage('pre');
  } else {
    el('stageTabs').hidden = true;
    startEncounterClock();
    el('encounterFacts').hidden = true;
    el('save').hidden = false;

    /* A clinic visit is one document read top to bottom, so it is laid out as
       a document: capped to a reading measure and centred in the column,
       rather than stretched to whatever the window happens to be. A textarea
       1500px wide is not a bigger field, it is an unreadable one. The
       procedure workspace keeps the full width it was built for — its tables
       and logs need every pixel — which is why this is a class rather than a
       change to .enc__note. */
    document.body.classList.add('enc--visit');

    /* The annotatable image's preset labels, filled once. The <datalist> is in
       the page rather than inside the dialog — see bodyDiagramPresetOptions()
       for why it has to be. */
    const presets = el('bodymap-presets');
    if (presets) presets.innerHTML = bodyDiagramPresetOptions();

    /*
     * A clinic visit commits with Save & Sign, which asks for the signature
     * in the Sign and Lock dialog and then hands the filed note to the
     * Encounter Summary to be read whole. Which of the two buttons is on
     * screen is decided in updateHint(), so it survives every repaint.
     */
    el('saveAndSign').addEventListener('ui-click', () => {
      // Read the note out of the DOM before anything signs it, or whatever is
      // in the field under the cursor never reaches the document being signed.
      syncVisitNoteFromDom();
      openVisitSignDialog(el('saveAndSign'));
    });

    el('stage-pre').hidden = true;
    el('stage-post').hidden = true;
    el('stage-intra').hidden = false;
    // The H&P/Orders/report-type tabs exist for a staged procedure visit —
    // a clinic visit keeps the single note it has always had, nothing beside it.
    el('intraTabs').hidden = true;
    el('reportTypeTabs').hidden = true;
    /*
     * The Output Manager belongs to the procedure report.
     *
     * It runs the report's post-sign steps — the superbill, the pathology
     * request, the letter to the referrer — none of which a clinic visit
     * produces. It was on screen anyway, collapsed, under a note that had
     * nothing to output: a control that does nothing is a control somebody
     * eventually presses to find out.
     */
    const outputCard = document.querySelector('[data-card="output"]');
    if (outputCard) outputCard.hidden = true;
    el('save').addEventListener('ui-click', () => {
      syncVisitNoteFromDom();
      notify('Draft saved. It can still be edited until it is signed.');
    });
    updateHint();
  }

  el('recordCancel').addEventListener('ui-click', () => el('recordModal').close());
  wireFormularyModal();

  /* --- Document actions --- */
  /*
   * Switching template rewrites the narrative, not just the label.
   *
   * [Colonoscopy Type] resolves from here, so a surveillance template makes
   * the opening sentence say surveillance. The blank first option every
   * ui-select carries is ignored — a report always has a template.
   */
  el('reportTemplate').addEventListener('ui-change', (event) => {
    /*
     * On a clinic visit the picker changes WHICH DOCUMENT this is, not which
     * wording a report opens with. Answers survive the switch — the templates
     * share field keys deliberately (every one of them calls the plan `plan`),
     * so re-templating a half-written note carries the prose across instead of
     * emptying it, which is the behaviour that teaches people never to touch
     * the picker. syncVisitNoteFromDom() inside paintVisitNote() is what makes
     * that true for text not yet committed to state.
     */
    if (!isProcedure) {
      const spec = templateByTitle(event.detail.value);
      if (!spec) {
        setValue(el('reportTemplate'), state.visitNote.template);
        return;
      }
      state.visitNote.template = spec.title;
      paintDoc();
      notify(`Note template switched to ${spec.title}.`);
      return;
    }

    const picked = REPORT_TEMPLATES.find((t) => t.title === event.detail.value);
    if (!picked) {
      setValue(el('reportTemplate'), state.template);
      return;
    }
    state.template = picked.title;
    state.tokens.set('Colonoscopy Type', picked.type);
    paintDoc();
    notify(`Template switched to ${picked.title}.`);
  });

  /*
   * The toolbar's unlock belongs to the procedure report alone.
   *
   * It used to answer for both documents, branching on which one the bar was
   * sitting over, and the clinic visit's branch withdrew the signature on a
   * consultation note. That note is now final once signed — the button is
   * hidden on a clinic visit (paintVisitNoteBar) and the branch that served
   * it has gone with it, so there is no route left to an unsigned clinic note
   * and no half-state for the worklist to disagree with.
   */
  el('unlockReport').addEventListener('ui-click', () => {
    if (!isProcedure) return;
    state.signed = false;
    state.signedBy = '';
    state.signedDate = '';
    state.signedTime = '';
    paintDoc();
    paintStages();
    if (el('reportTypeTabs')) paintReportTypeTabs();
    notify('Signature cleared. The colonoscopy report is open for amendment.', 'info');
  });
  /* --- Physical exam drawer --- */
  el('examAllNormal').addEventListener('ui-click', () => {
    state.exam.normal = new Set(examRowKeys());
    state.exam.detail.clear();
    paintExamEditor();
  });
  el('examClear').addEventListener('ui-click', () => {
    state.exam.normal.clear();
    paintExamEditor();
  });
  el('examReset').addEventListener('ui-click', () => {
    state.exam.normal = new Set(examRowKeys());
    state.exam.detail.clear();
    state.exam.flags.clear();
    paintExamEditor();
  });
  el('examNow').addEventListener('ui-click', () => {
    const now = new Date();
    const value = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    el('examTime').setAttribute('value', value);
    const control = el('examTime').querySelector('input');
    if (control) control.value = value;
  });
  el('examClearTime').addEventListener('ui-click', () => {
    el('examTime').setAttribute('value', '');
    const control = el('examTime').querySelector('input');
    if (control) control.value = '';
  });
  el('examCancel').addEventListener('ui-click', () => el('examModal').close());
  el('examSave').addEventListener('ui-click', () => {
    state.exam.time = el('examTime').value || state.exam.time;
    el('examModal').close();
    paintDoc();
    notify('Physical exam saved into the report.');
  });

  /* --- Polyp drawer --- */
  ['pSite', 'pUnit', 'pAppearance', 'pPedicle', 'pBleeding', 'pIntervention'].forEach((id) =>
    el(id).addEventListener('ui-change', previewPolyp)
  );
  ['pDistance', 'pSizeFrom', 'pSizeTo', 'pCount'].forEach((id) =>
    el(id).addEventListener('ui-input', previewPolyp)
  );
  el('polypCancel').addEventListener('ui-click', () => el('polypModal').close());
  el('polypSave').addEventListener('ui-click', () => {
    const draft = polypDraft();
    if (!draft.site) {
      el('pSite').setAttribute('error', 'Choose a site');
      return;
    }
    el('pSite').removeAttribute('error');
    state.findings.push(draft);
    el('polypModal').close();
    paintDoc();
    notify('Finding recorded — the report narrative has been rewritten.');
  });

  /* --- Commit ---
     One footer, two report types behind it: In-procedure shows either the
     colonoscopy report or the EGD one, and the commit belongs to whichever
     is open. Duplicating these into each report's own toolbar would give the
     endoscopist two Sign buttons for one document. */
  el('saveDraft').addEventListener('ui-click', () => {
    /* Pull whichever document is open out of the DOM before claiming to have
       saved it. A "draft saved" that did not read the textarea the clinician
       was typing into is a lie the screen tells cheerfully. */
    if (!isProcedure) syncVisitNoteFromDom();
    else if (state.reportType === 'egd') syncEgdFromDom();
    else syncCscFromDom();
    notify('Draft saved. Nothing has been filed to the chart.');
  });
  el('sign').addEventListener('ui-click', () =>
    state.reportType === 'egd' ? signEgdReport() : signReport()
  );

  /*
   * Save & Proceed — the one way forward through the pre-anaesthesia stage.
   *
   * The stage is a run of four, and this button walks it:
   *
   *   1 Pre-procedure checklist →  2 Pre-anaesthesia
   *   2 Pre-anaesthesia         →  3 Post-anaesthesia
   *   3 Post-anaesthesia        →  4 Anaesthesia management
   *   4 Anaesthesia management  →  the nurse's sign-off       (closing the log)
   *
   * It stops at the sign-off rather than walking through it. Closing a stage
   * on behalf of four people is not a "next" — it is its own commit, by a
   * named person, and it has its own button.
   *
   * The checklist gate applies at every step, not just the first: it is the
   * assertion that this patient is safe to start on, and un-ticking an item
   * after passing it has to stop the case just as firmly.
   */
  /*
   * The other way a pre-procedure stage ends.
   *
   * Offered at every step, because the reason to stop — no anaesthetist, a
   * patient who ate breakfast, an escort who did not arrive — turns up at
   * whichever step it turns up at, not conveniently at the last one.
   */
  const rescheduleModal = el('rescheduleModal');
  el('reschedule').addEventListener('ui-click', () => {
    setValue(el('rescheduleReason'), '');
    el('rescheduleReason').removeAttribute('error');
    rescheduleModal.open();
  });
  el('rescheduleCancel').addEventListener('ui-click', () => rescheduleModal.close());

  wireSignDialog();

  /* The Plan's order dialog. Wired once at boot rather than on every repaint,
     because the modal lives in the page rather than inside the note the
     repaint rebuilds — the same arrangement as the signing dialog above. */
  el('planOrderCancel')?.addEventListener('ui-click', () => el('planOrderModal').close());
  el('planOrderSave')?.addEventListener('ui-click', savePlanOrder);

  el('rescheduleConfirm').addEventListener('ui-click', () => {
    const reason = el('rescheduleReason').value.trim();
    if (!reason) {
      el('rescheduleReason').setAttribute('error', 'A reason is required.');
      return;
    }
    if (appointment) {
      updateAppointment(appointment.id, {
        status: 'Rescheduled',
        rescheduledReason: reason,
        rescheduledAt: new Date().toISOString(),
      });
    }
    rescheduleModal.close();
    notify(`Appointment marked Rescheduled — ${reason}`, 'warning');
  });

  el('proceed').addEventListener('ui-click', () => {
    const outstanding = state.preCheckOutstanding;
    if (outstanding.length) {
      // The warning is enough — it does not also yank whatever document the
      // clinician was reading to the checklist. They know where it is.
      notify(
        `Cannot proceed — ${outstanding.length} checklist item${
          outstanding.length === 1 ? '' : 's'
        } outstanding.`,
        'warning'
      );
      return;
    }

    /* Next moves; it does not sign. The endoscopist's signature is on their
       own card, under their own name — a footer button that signed as the
       endoscopist here and as the anaesthetist two steps later asked whoever
       pressed it to remember whose name went on what. An unsigned document is
       not skipped past silently either: it is one of the ones Save & Sign
       names as outstanding at the end. */
    if (state.preDoc === 'preanaesthesia') {
      state.preDoc = 'report';
      paintPre();
      return;
    }

    /* The last step. Save & Sign is the nurse's commit on the whole stage —
       it signs and locks the pre-anaesthesia note, then opens In-procedure.
       Management is a running log rather than a document, so there is nothing
       of its own to sign here: closing it IS the stage sign-off.

       It asks before it signs: the dialog is where the name and any note are
       given, and it is what carries the stage on to In-procedure once the
       signature is made. */
    if (state.preDoc === 'management') {
      if (state.preSignedBy) {
        showStage('intra');
        notify('Pre-anaesthesia is signed and locked. In-procedure documentation is open.');
        return;
      }
      openPreSignDialog(el('proceed'));
      return;
    }

    if (state.preDoc === 'checklist') {
      state.preDoc = 'preanaesthesia';
      paintPre();
      notify('Checklist complete. Continue to the pre-anaesthesia assessment.');
      return;
    }

    // The report: written after the case, and the last of the three documents
    // that terminate in a completed state. What is left is the log.
    state.preDoc = 'management';
    paintPre();
    notify('Post-anaesthesia saved. Continue to the anaesthesia record.');
  });

  /* --- Card collapse (Output Manager) ---
     Scoped to the one static card this is for. A blanket [data-toggle] bind
     would also catch the collapsible cards the colonoscopy and EGD reports
     paint into their own containers — those are wired by wireCsc()/wireEgd()
     when they are rendered, and a second identical handler here would read
     the aria-expanded the first one just flipped and flip it straight back,
     leaving the card permanently shut. */
  document.querySelectorAll('[data-card="output"] [data-toggle]').forEach((button) =>
    button.addEventListener('click', () => {
      const body = el(`body-${button.dataset.toggle}`);
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    })
  );
});


/* ===========================================================================
   V2: THE SCRIBE ON THIS NOTE

   The component knows how to listen, draft and hand sections over; it knows
   nothing about this screen. What lives here is the one thing only the screen
   can do — put a section's words into a field of the note that is open — and
   the two ways that can fail.
   ======================================================================== */

/**
 * Copy one drafted section into the note.
 *
 * Returns false when it could not be placed, which is not a failure to report
 * as an error: the note templates differ (data/visit-note-templates.js), and a
 * GI Consultation has a family-history field where a SOAP note does not. The
 * scribe leaves such a section offered rather than marking it copied, so
 * switching template and pressing again does the right thing.
 *
 * APPENDED, NEVER OVERWRITTEN. A clinician who typed two lines before pressing
 * Copy to note has written those two lines about this patient, and no draft is
 * worth losing them. The draft goes under what is there, with a blank line
 * between, the way the rail's own Import has always done it.
 */
function copyScribeSection(section) {
  const field = visitNoteSpec()
    .sections.flatMap((entry) => entry.fields ?? [])
    .find((entry) => entry.key === section.field);

  if (!field) {
    toast(
      `This ${state.visitNote.template} has no ${section.title.toLowerCase()} field. ` +
        'Switch template, or copy it into the section it belongs in.',
      'warning'
    );
    return false;
  }

  /* Read the controls back before writing, or a paragraph typed since the last
     repaint is about to be overwritten by stale state. Same reason
     paintVisitNote does it. */
  syncVisitNoteFromDom();

  const existing = String(state.visitNote.values[field.key] ?? '').trim();
  state.visitNote.values[field.key] = existing ? `${existing}\n\n${section.text}` : section.text;
  state.scribeFilled.add(field.key);

  /* Written onto the live control rather than through a repaint, which would
     throw away the caret and the scroll position of a note somebody is working
     in. The heading's mark is the one thing that does need the repaint, so it
     is drawn by hand here too. */
  const node = el(`vn-${field.key}`);
  if (node) {
    node.value = state.visitNote.values[field.key];
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('enc__vn-field--landed');
    setTimeout(() => node.classList.remove('enc__vn-field--landed'), 1200);
  }

  const heading = node?.closest('.enc__vn-section')?.querySelector('h3');
  if (heading && !heading.querySelector('.scribe-filled')) {
    heading.insertAdjacentHTML(
      'beforeend',
      '<span class="scribe-filled">AI drafted</span>'
    );
  }

  return true;
}

mountAiScribe({
  host: el('aiScribe'),
  onCopy: copyScribeSection,
  announce: (message) => toast(message, 'info'),
});
