/**
 * Clinical encounter — the procedure day as a run of steps.
 *
 * WHAT THIS MODULE OWNS
 * The SHELL the documents hang in: a three-column layout, a seven-step ladder
 * in the left rail, a substep tab strip over the working column, the standing
 * clinical record in the right rail. The documents themselves are declared
 * elsewhere and mounted into the middle — see js/lib/encounter-logs.js for
 * everything shaped like a table and js/lib/encounter-docs.js for everything
 * shaped like a form. Steps whose document has not been built yet say so in
 * place rather than showing an empty middle column.
 *
 * HOW IT GOT HERE — TWICE, THE SAME WAY
 * This address has been settled by a bake-off twice, and both times the same
 * way: build the replacement at a second URL, put a V1 / V2 switch in the head
 * bar so one reviewer can walk one case through both, and when the rebuild
 * wins let it take this address while the other file, its stylesheet and the
 * switch's wiring are deleted.
 *
 * The first time decided the SHAPE of the screen — a three-stage workspace
 * against this step run — and the step run won. The second decided the
 * PROCEDURE REPORT, and the rebuild won: the specimen table and the jar
 * dialog, the live scope feed with its captures and its pedal, the instrument
 * recorded by serial, the timings the withdrawal is read off, and the
 * narrative note assembled from all of it — all of it simply part of this
 * screen now.
 *
 * What survives the pattern is the pattern: nothing in here was edited while
 * either rebuild was going on, which is the whole reason a fork at a second
 * address is worth the duplication.
 *
 * Every flow that opens an encounter — the scheduler, triage, check-in, the
 * chart, instant scheduling — arrives here.
 *
 * THE ONE PIECE OF STATE THAT MATTERS
 * `state.step` and `state.substep` are a two-level selection, and they move
 * together: choosing a step moves to that step's first document, and choosing a
 * document sets both. Two independent selections would let the rail highlight
 * step 4 while the work column named step 2's Vitals, which is the state a
 * three-person screen can least afford. Both are chosen in the rail — the
 * working column names them and navigates nothing.
 *
 * Opened with ?appt=<id>.
 */
/* CLINICAL_SECTIONS is the chart's four history lists, quoted on the H&P.
   ICD10 is the diagnosis catalogue the procedure report's indication card
   searches — the same one the rest of the product attaches diagnoses from, so
   a code attached here means what it means everywhere else. */
import { CLINICAL_SECTIONS, ICD10 } from '../../data/encounter.js';
/* What the booking implies the note should be, before anybody has picked
   anything. The worklist and the encounter summary derive it the same way from
   the same function — see noteTypeFor — so the three screens cannot disagree
   about what kind of note a colonoscopy files. */
import { noteTypeFor } from '../../data/visit-notes.js';
/* The chart's alert notes, so the band under the title says exactly what the
   patient's chart says. A second list of alerts written for this screen would
   be a second answer to "what must everyone in the room know". */
import { PATIENTS, ALERT_CATEGORIES, ALERT_PRIORITIES } from '../../data/patient-chart.js';
import {
  ENCOUNTER_STEPS,
  STEP_STATUS,
  initialStepId,
  PROCEDURE_CONSENT_CAPTURE,
} from '../../data/procedure-encounter-run.js';
/* The readiness card on step 2's last document — the five lines the bedside
   checks and the score the first of them is read against. Both come from the
   same module the nursing record reads them from, so the two screens cannot
   disagree about what "ready" means. */
import {
  DISCHARGE_READINESS_CHECKS,
  ALDRETE_CATEGORIES,
  ALDRETE_THRESHOLD,
  /* The handout, which IS the discharge record now — the resolved sheet for
     whichever set is chosen at the head of it, and the two lines about results
     and the phone. See DOC_LEADS below. */
  dischargeSheetFor,
  DISCHARGE_INSTRUCTION_SETS,
  DISCHARGE_DEFAULTS,
  DISCHARGE_FOLLOW_UP,
} from '../../data/procedure-encounter.js';
/* The ASC's own phone number, read at render rather than written into the
   sheet: a practice that changes its number changes it in one place. */
import { PRACTICE_PROFILES } from '../../data/practice.js';
/* How many images one report may carry. Read from the same constant the other
   report's photo card has always used rather than a number written here: a cap
   that differs between two screens is a cap nobody can state. */
import { EGD_MAX_PHOTOS as DOC_MAX_PHOTOS } from '../../data/procedure-intra.js';
import { REPORT_STAFF } from '../../data/procedure-report.js';
import { providerById, typeById, procedureById } from '../../data/schedule.js';
import { findAppointment } from '../../data/appointment-store.js';
import { DIRECTORY } from '../../data/directory.js';
import { iconMarkup } from '../lib/icons.js';
/* Step 1 IS the bay's pre-procedure sheet, declared once in its own module
   rather than rebuilt here. A second copy would be two forms free to drift
   apart, and the one form that cannot is the one saying a patient is safe to
   sedate. This screen supplies the chrome; the questions and the gate come from
   there. */
import {
  preCheckSheetMarkup,
  preCheckActionsMarkup,
  mountPreCheckSheet,
  preCheckOutstanding,
} from '../lib/pre-check-form.js';
/* The nurse the sheet names, borrowed for one fallback: the discharge sign-off
   on step 2 signs as whoever is at the workstation, and needs a name to offer
   when a screen is opened straight off a deep link with no session behind it.
   Step 1's nurse is the truest guess available — the same person worked the
   checklist this run — and reading it from there rather than writing a second
   name here keeps the two steps naming one nurse. */
import { PRE_CHECK_SIGNATURE } from '../../data/pre-check.js';
import { updateAppointment } from '../../data/appointment-store.js';
/* Twelve documents across steps 2, 3, 4 and 7 are twelve tables and twelve
   add-forms of the same shape. The shape is declared once — see the header of
   js/lib/encounter-logs.js for why they are a spec rather than twelve
   hand-built pairs of cards. */
/* `nowTime` comes from there too, rather than a second reading of the clock
   written here: the logs stamp their rows with it and the documents' Now
   buttons stamp their fields with it, and one case charted through both should
   not be able to disagree with itself about what "now" is formatted as. */
import {
  ENCOUNTER_LOGS,
  DEFAULT_SIGNER,
  nowTime,
  setNoteContext,
} from '../lib/encounter-logs.js';
/* The other half: everything that is a form rather than a table — the consents,
   the assessments, the discharge summary. See that file's header for why the
   two are declared separately. */
import { ENCOUNTER_DOCS as BASE_ENCOUNTER_DOCS } from '../lib/encounter-docs.js';
/*
 * THE SPECIMEN TABLE, WHICH WAS THE REBUILD'S OPENING ARGUMENT.
 *
 * The record of the jars a case produces, the dialog that opens one, and the
 * two things that print off them. Everything about why a jar links to a
 * finding instead of carrying a site of its own — and why a jar is committed
 * in a dialog rather than typed into a row — is over js/lib/specimen-table.js.
 * This screen only hosts it.
 */
/*
 * THE AI SCRIBE, ON THE PROCEDURE REPORT.
 *
 * The same component the visit note mounts, handed the procedure room's own
 * material: an endoscopist calling findings over a scope, and a draft aimed at
 * this document's fields rather than a consultation's. Why the draft does not
 * fill the report by itself is over js/lib/ai-scribe.js.
 */
import { mountAiScribe } from '../lib/ai-scribe.js';
import {
  PROCEDURE_SPEAKERS,
  PROCEDURE_TRANSCRIPT,
  PROCEDURE_DURATION,
  PROCEDURE_DRAFT,
  PROCEDURE_STAGES,
} from '../../data/scribe-transcript.js';
import {
  specimenStoreFor,
  specimensHtml,
  specimensHeadHtml,
  specimenDialogHtml,
  openSpecimenDialog,
  describeSpecimens,
  jarForFinding,
  tookTissue,
  jarLabelsMarkup,
  requisitionMarkup,
} from '../lib/specimen-table.js';
/* The findings diagram on the Procedure report: a renderer that knows how to
   draw a clickable organ and the forms that hang off it, and the colon it is
   pointed at. Neither knows about this screen — see DIAGRAMS below. */
import { findingsHtml, wireFindings, findingSummary } from '../lib/segment-findings.js';
/* The one narrator, and the note it composes. Both moved out of this file when
   the narrative card arrived: a finding's sentence is written once and used
   twice — for the `findings` field the impression seeds from, and for the note
   that prints — and two copies of it would be two accounts of one polyp. */
import { narrateFindings, narrativeBlocks, narrativeText } from '../lib/procedure-narrative.js';
import { COLON_SEGMENTS, COLON_FINDING_TYPES } from '../../data/colon-findings.js';
/* The right rail: the fourteen clinical sections, the cards they sit in and the
   copy controls on them. Shared with the clinic visit, which mounts the same
   rail in the same place — see the note at the head of that module. */
import { mountClinicalRail, wireRailCollapse } from '../lib/clinical-rail.js';
/* The patient card at the top of the left rail. A component rather than this
   screen's own markup because three other note screens draw the same card —
   see the head of js/lib/patient-card.js. */
import { paintPatientCard } from '../lib/patient-card.js';

/* Signatures are check-in's, not a second answer to what counts as signed —
   the pad, the filed mark and Sign again all come from one place. */
import { paintSignatureBlock, signedAtLabel } from '../lib/signature-block.js';
import { currentSession } from '../lib/auth-store.js';
/* The product's one notification. The step run had no way to report anything
   that happens outside a document's own footer — and the footer is hidden on
   every log. */
import { notify } from '../lib/toast.js';
/* Printing a whole STEP means printing something that is not on screen — seven
   of the eight logs are behind a tab the reader is not on. This is the sheet
   the estimate and the check-in record already print through: a container the
   composed document is rendered into, with everything else on the page taken
   off the paper for the length of the dialog. */
import { printAsPdf, downloadAsPdf } from '../lib/print-document.js';
/* the live picture from the endoscopy stack, and the facts about the stack
   it mirrors. The panel is a lib because it is a MONITOR — it draws a lumen,
   runs a pedal and hands back frames, and knows nothing about encounters,
   findings or jars. Everything that decides what a capture MEANS is in this
   file. See the head of js/lib/scope-feed.js. */
import { mountScopeFeed } from '../lib/scope-feed.js';
import {
  FEED_SOURCE,
  FEED_PEDALS,
  FEED_CLIP_MAX_SECONDS,
  FEED_GATE_STEP,
  feedClock,
} from '../../data/procedure-feed.js';
/* The clock readings a colonoscopy is judged by, and the arithmetic on them —
   the withdrawal time in particular. See the head of that module for why a
   number nobody states is a number nobody audits. */
import {
  procedureTimings,
  durationLabel,
  TIMING_MARKS,
  WITHDRAWAL_TARGET_MINUTES,
} from '../../data/procedure-timings.js';
/* Which instrument, not which kind of instrument. */
import {
  scopeById,
  scopeLabel,
  scopesFor,
  scopeReady,
  SCOPE_HANG_TIME_HOURS,
} from '../../data/procedure-scopes.js';

/* ===================== Helpers ===================== */

/* ===========================================================================
   WHAT THE REBUILD ADDED TO THE PROCEDURE REPORT

   These sections are folded into the shared spec HERE rather than declared in
   js/lib/encounter-docs.js, and the reason was that the rebuild ran at a
   second address for a while: the two versions had to ask one set of
   questions, from one place, without the older screen's document changing
   under it overnight.

   The older screen is gone and the arrangement has outlived its first reason,
   but it has a second one that still holds. js/lib/encounter-docs.js is a
   DECLARATION of what documents are — a file with no imports from data/ that
   knows about cases, staff or equipment — and every card below needs one:
   the instrument list is the unit's asset register, the timings are read off
   another step's log, the note is assembled from the whole case. Putting them
   there would make that file a thing that acts.

   The Specimens card goes directly after Findings, which is the order the work
   happens in: the polyp is described, then it goes in a pot. Putting it before
   the narrative cards also means the endoscopist meets it while the tissue is
   still in their hand, rather than after they have written the impression.

   The live feed is NOT one of these additions, and the reason is worth saying
   here because it was: it spent a version as a section of the report, drawn in
   a two-track split beside Findings. The pairing was right and the mechanism
   was wrong. A card in a scrolling document is somewhere the picture can be
   scrolled away from, it is locked to one place on one step, and it takes half
   the working column from the findings it is supposed to sit beside.

   So the panel is a WINDOW now — floating over the report, dragged wherever
   the endoscopist wants it, on top of whatever they scroll to. See feedWindow
   below. Nothing about it is a section, which is why the report's spec does
   not mention it and the foot never counts it.
   ======================================================================== */

const SPECIMEN_SECTION = {
  id: 'specimens',
  title: 'Specimens',
  /*
   * `headSlot` — A CARD WHOSE COUNT AND CONTROLS BELONG TO ITS HEADING.
   *
   * "Specimens" and "0 jars" are one statement and read as one line, and the
   * three controls beside them act on the card rather than on any row. Drawn
   * under the heading they became a second header bar with the title stranded
   * above it; in the heading they are what the heading says.
   *
   * A slot rather than markup in the spec, because what goes in it is the
   * specimen module's own and changes as jars are added — see
   * specimensHeadHtml and mountSpecimenField.
   */
  headSlot: true,
  fields: [{ key: 'specimens', type: 'specimens', label: 'Specimens', span: 2 }],
};


/*
 * WHICH SCOPE WENT IN — A CHOICE, THEN THE FACTS THAT FOLLOW FROM IT.
 *
 * The select is an ordinary document field, so `required`, the foot's
 * outstanding count and the print all treat it like any other answer. The
 * panel under it is derived and holds nothing: serial, asset tag and the
 * reprocessing cycle are properties of the instrument, read from the unit's
 * register at the moment it is named. Asking anybody to retype a serial number
 * off a sticker is asking for a digit to be wrong in the one record that is
 * only ever read when a wrong digit matters.
 */
const SCOPE_SECTION = {
  id: 'scope',
  title: 'Instrument',
  note: 'The physical scope, by serial — this is what a recall or an outbreak is traced through.',
  fields: [
    {
      key: 'scopeId',
      type: 'select',
      label: 'Scope used',
      options: [],
      required: true,
      span: 2,
    },
    { key: 'scopeRecord', type: 'scope-record', label: 'Instrument record', span: 2 },
  ],
};

/*
 * THE CLOCK, READ OFF THE TIMES LOG RATHER THAN ASKED FOR AGAIN.
 *
 * Every mark this card reports is already recorded by the circulating nurse on
 * step 2, as the case happens, at the moment it happens. Asking the
 * endoscopist for them again at the end would be asking for times
 * reconstructed from memory next to times written down live — and the
 * reconstructed set would win, because it is the one on the document being
 * signed.
 *
 * So the card holds nothing and derives everything. What it ADDS is the
 * arithmetic nobody does by hand: insertion, withdrawal, total.
 */
const TIMINGS_SECTION = {
  id: 'timings',
  title: 'Timings',
  note: 'Read from the times recorded on Intra-procedure Management as the case ran.',
  fields: [{ key: 'timings', type: 'timings', label: 'Timings', span: 2 }],
};

/*
 * THE NOTE, ASSEMBLED FROM EVERYTHING ABOVE IT.
 *
 * Read-only on purpose, and the argument is the diagram's: record the anatomy
 * and the prose writes itself. An editable copy of a generated note is two
 * accounts of one case with nothing to say which is right — see the head of
 * js/lib/procedure-narrative.js. The endoscopist's own words are the
 * Impression, which is the next card and is theirs.
 */
const NARRATIVE_SECTION = {
  id: 'narrative',
  title: 'Narrative note',
  note: 'Written from the record above. It changes as the record does; the Impression below is yours.',
  fields: [{ key: 'narrative', type: 'narrative', label: 'Narrative note', span: 2 }],
};

/** The shared specs, with this screen's own cards folded into the report. */
function reportDocs(base) {
  const report = base['procedure-report'];
  const at = report.sections.findIndex((section) => section.id === 'findings');
  const sections = [...report.sections];
  sections.splice(at + 1, 0, SPECIMEN_SECTION);

  /*
   * AND THE PICTURES COME UP TO SIT UNDER THE JARS.
   *
   * The photo card shipped at the foot of the report, after the impression and
   * the recommendations, which is where it belonged when the only way onto it
   * was choosing files off a disk at the end of the case. It is not where it
   * belongs now. A capture is taken DURING the case, off the live feed, and it
   * is taken in the same breath as the jar off the same finding — see the feed
   * — so the three cards the endoscopist works while the scope is in are now
   * consecutive: what was found, what went in a pot, what was photographed.
   *
   * Everything below them is written afterwards, with the scope out.
   */
  const photosAt = sections.findIndex((section) => section.id === 'photos');
  const [photos] = sections.splice(photosAt, 1);
  sections.splice(at + 2, 0, photos);

  /* The instrument and the clock go ABOVE Findings, because both are true of
     the whole examination rather than of anything found in it — and because
     the scope is named before it goes in, not after it comes out. */
  sections.splice(at, 0, SCOPE_SECTION, TIMINGS_SECTION);

  /* And the note goes under everything it reads and directly above the
     Impression, which is the order a reader meets them in: the account of the
     case, then the judgement made on it. */
  sections.splice(
    sections.findIndex((section) => section.id === 'impression'),
    0,
    NARRATIVE_SECTION
  );

  return { ...base, 'procedure-report': { ...report, sections } };
}

const ENCOUNTER_DOCS = reportDocs(BASE_ENCOUNTER_DOCS);

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

/**
 * Put a value into a mounted control, attribute AND live element both.
 *
 * <ui-input> patches its own <input> when `value` changes, but only once it has
 * upgraded — and a control written to in the same tick it was painted may not
 * have. Writing both means the value is right whichever order those two land
 * in, which is what a Now pressed the instant a document opens depends on.
 */
function setFieldValue(node, value) {
  if (!node) return;
  const next = value ?? '';
  node.setAttribute('value', next);
  const control = node.querySelector('input, select, textarea');
  if (control) control.value = next;
}

/**
 * What "now" means to a given field.
 *
 * A time field wants 09:18 and a datetime field wants 2026-08-20T09:18 — the
 * same instant, in the two formats the two controls will accept. Written here
 * rather than in the handler because the handler has one line to do and the
 * awkward part is entirely about which control is being filled.
 *
 * `nowTime` is not re-derived for the time case: the logs stamp their rows
 * with it and one case charted through both halves of this screen should not
 * be able to disagree with itself about what the clock said.
 */
function nowValueFor(field) {
  if (field?.type !== 'datetime') return nowTime();
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  return `${day}T${nowTime()}`;
}

/** One field of a document spec, by key — the sections are the only index. */
const fieldByKey = (spec, key) =>
  spec.sections.flatMap((section) => section.fields ?? []).find((field) => field.key === key);

/* ===================== Context ===================== */

const searchParams = new URLSearchParams(window.location.search);
const appointment = findAppointment(searchParams.get('appt'));

/**
 * ONLY A PROCEDURE GETS THE STEP RUN.
 *
 * The seven steps are a sedation day — a pre-procedure checklist, an
 * anaesthetic record, an Aldrete score, a discharge to recovery, a desk that
 * checks the patient out. An office visit has none of that. It is one clinician
 * and one note, and splitting that across seven steps owned by four roles is
 * ceremony with nothing behind it.
 *
 * For a while there was no test here at all, so every care type landed on this
 * screen: pressing Start on a follow-up opened a sedation ladder, and the only
 * thing that made it look wrong was the reader. This is the test the previous
 * encounter used, restored unchanged. It reads the BOOKING rather than the
 * appointment type — `kind` is stamped by data/schedule.js for the two
 * scope-list types, and `procedureId` names what is actually being done.
 * Either alone is enough, because a list entry can be tagged a procedure
 * before anyone has chosen which procedure it is.
 *
 * A booking that is not a procedure belongs on the clinic note, which is the
 * screen it opened before the two encounters were merged into one address.
 *
 * `replace`, not `href`. The clinic note takes this screen's PLACE in history
 * rather than sitting on top of it: pushing would leave the encounter behind
 * the visit note, and Back would land the clinician on a screen whose only
 * remaining job is to send them forward again. With replace, Back from the
 * clinic note reaches the scheduler, which is where they came from.
 *
 * No appointment at all — `encounter.html` opened bare, the way the gallery
 * links it — stays here. There is no booking to route on, and the procedure
 * run is what this address is for.
 */
const isProcedure =
  appointment?.kind === 'procedure' || Boolean(appointment?.procedureId);

if (appointment && !isProcedure) {
  window.location.replace(`clinic-visit.html?appt=${encodeURIComponent(appointment.id)}`);
}

const patient =
  DIRECTORY.find((p) => p.mrn === appointment?.mrn) ?? DIRECTORY.find((p) => p.active);

const stepById = (id) => ENCOUNTER_STEPS.find((s) => s.id === id);

/** The document a step opens on: its first, or none for a step with none. */
const firstSubstep = (step) => step?.substeps?.[0]?.id ?? '';

/*
 * OPENING STRAIGHT ONTO A DOCUMENT.
 *
 * `?step=procedure&doc=procedure-report` opens the run on that step with that
 * document showing. Added for the rebuild rather than inherited from v1, and
 * for a reason the rebuild creates: a reviewer being shown what changed is
 * being sent to ONE card on ONE document, and an instruction to open the
 * encounter and then press the fifth step and its fifth document is an
 * instruction half of them will get wrong.
 *
 * Both halves are checked against the run before they are believed. A link
 * naming a step that does not exist — an old link, a typo, a step renamed since
 * it was sent — falls back to where the encounter would have opened anyway.
 */
function linkedStep() {
  const asked = stepById(searchParams.get('step') ?? '');
  return asked ? asked.id : initialStepId();
}

function linkedSubstep(stepId) {
  const step = stepById(stepId);
  const asked = searchParams.get('doc') ?? '';
  return step?.substeps?.some((substep) => substep.id === asked) ? asked : firstSubstep(step);
}

const state = {
  /* Which step is open in the rail and showing in the centre column. */
  step: linkedStep(),
  /* Which of that step's documents. Empty for a step that holds no documents —
     step 1's checklist and step 5's post-anaesthesia record are each one sheet,
     not a set of them. */
  substep: linkedSubstep(linkedStep()),
  /* Which steps show their documents in the rail. The open one always does;
     the others are the ones the user has expanded to look into, which is why
     this is a Set rather than "the open step, and nothing else" — three people
     work this screen, and reading ahead into someone else's step should not
     move the work column off yours. */
  expanded: new Set([linkedStep()]),
  /* Which clinical sections are open in the right rail. Diagnoses, allergies
     and medications start open because they are the three the sedation plan
     turns on; the histories are there to be gone looking for. */
  sections: new Set(['diagnosis', 'allergies', 'medications']),

  /* --- Step 1: the pre-procedure sheet ---
     Answers live HERE, not inside the mounted sheet, because the sheet is torn
     down and rebuilt every time the step is left and come back to. Outstanding
     is seeded from the record rather than left empty: the footer has to be
     right before the sheet has ever been painted. */
  preCheckValues: appointment?.preCheck ?? null,
  preCheckOutstanding: preCheckOutstanding(appointment?.preCheck ?? null),

  /* Whether the alerts band under the title is showing its notes or folded to
     its summary line.

     FOLDED, ALWAYS, ON ARRIVAL. It used to open itself whenever the chart held
     an authored high-priority note, and on this patient — and on most patients
     worth opening an encounter for — that is every case. The band then stood
     three hundred and sixty pixels tall above all fourteen documents, which on
     a laptop is a third of the column: the vitals table, the procedure's tick
     list and every signature block began below the fold, on a screen whose
     whole argument is that the work is in the middle.

     What made the auto-open defensible was that folded said less than open.
     It no longer does: the head carries the count AND every alert's title as a
     chip in its own priority colour, so a folded band still answers what is
     wrong with this patient and how badly, in one line. The body underneath —
     the note's wording, who wrote it and when — is what the press is for, and
     the press sticks for the rest of the encounter because this lives in state
     rather than being re-derived per document. */
  alertsOpen: false,

  /* --- Whether the booking card is open ---

     Shut, like the alerts band above it and for a version of the same reason.
     The six facts the front desk booked are reference material: they are read
     when you arrive at a case you did not book and when you code one you did,
     and on every other screenful they are a hundred pixels of answer to a
     question nobody is asking, sitting between the reader and the document
     they came to work on.

     What makes shut defensible is that shut still says something. The head
     carries the service, the slot and the provider — which booking this is —
     and what the press buys is the location, the note type, the age of the
     encounter and the reason. Those are the four somebody goes looking for,
     and going looking for them is the moment the press belongs at.

     In state rather than re-derived per document, so it sticks: the clinician
     who opens it is coding, and they want it open on all fourteen documents
     rather than on whichever one they happened to press it on. */
  apptOpen: false,

  /* --- What kind of note this encounter files ---

     Read off the booking if the desk or an earlier session already settled it,
     derived from the appointment otherwise — never hard-coded, because the
     worklist prints the same answer in its Note Type column and the two must be
     the same fact.

     It is READ here and nowhere set. There was a picker for it in a strip
     across the top of this screen, and on a procedure day it never had a
     decision to offer: a booking with a procedure on it files a Procedure
     Follow-up, and the other four entries in that list belong to the clinic
     note, which now carries the picker (see the document bar in
     screens/clinic-visit.html). What is left here is the fact, printed in the
     booking band with the other five. */
  noteType:
    appointment?.noteType ??
    noteTypeFor(appointment?.kind, typeById(appointment?.typeId)?.title ?? ''),
};

/** The mounted sheet, while step 1 is on screen. Null the rest of the time. */
let preCheckSheet = null;

/* ===================== Header ===================== */

/**
 * What is being done to this patient, as one string.
 *
 * Pulled out of paintHeader when the medication logs started stamping it onto
 * stock movements: the procedure a drug was given during travels with the
 * movement to the ledger, and a second derivation of it here would be a second
 * thing to keep in step with the header. One answer, two readers.
 */
function procedureLabel() {
  const label = appointment?.procedureId
    ? procedureById(appointment.procedureId)?.title
    : typeById(appointment?.typeId)?.title;
  return label ?? 'Colonoscopy';
}

function paintHeader() {
  const label = procedureLabel();

  /* The one line under the title: what is being done, by whom, where, and on
     what day. Same four facts in the same order as the clinic visit's meta
     line (paintHeader in js/screens/clinic-visit.js), so a clinician who works
     both screens reads the same sentence in the same place. The fallback is
     the demo colonoscopy, for the case where this screen is opened without an
     appointment behind it. */
  el('encounterMeta').textContent = appointment
    ? `${label} · ${providerById(appointment.providerId)?.name} · ${
        appointment.location || appointment.area || 'MediNova Gastroenterology'
      } · ${shortDate(appointment.date)}`
    : `${label} · ${REPORT_STAFF.endoscopist} · MediNova Gastroenterology`;

  /* Procedure and endoscopist only. Payer and prior auth used to sit here too,
     and they were the wrong two facts for a header that is read mid-procedure:
     cover is a front-desk question, settled before anybody scrubbed in, and it
     is still on the patient card in the left rail for whoever needs it. What
     is left is what the header is for — what is being done, and by whom. */
  const facts = [
    ['Procedure', label],
    ['Endoscopist', providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist],
  ];

  el('encounterFacts').innerHTML = facts
    .map(([term, value]) => `<div><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`)
    .join('');
}

/* ===================== The booking ===================== */

/**
 * The patient's age at the time of this encounter, as years and months.
 *
 * "Age of Encounter" rather than "Age", because the two are different numbers
 * on any note read after the day it was written — a report opened next year
 * should say how old the patient was when the scope went in, not how old they
 * are now. Months as well as years because the distinction matters at both
 * ends of a list: paediatric dosing at one, and a surveillance interval that
 * turned due three months ago at the other.
 *
 * The directory writes dates of birth DD-MM-YYYY and the scheduler writes
 * appointment dates ISO, so both are parsed rather than compared as strings.
 */
function ageOfEncounter() {
  const [dd, mm, yyyy] = String(patient?.dob ?? '').split('-').map(Number);
  if (!yyyy) return patient?.age ? `${patient.age} yrs` : '—';

  const on = appointment?.date ? new Date(`${appointment.date}T00:00:00`) : new Date();
  let months = (on.getFullYear() - yyyy) * 12 + (on.getMonth() + 1 - mm);
  if (on.getDate() < dd) months -= 1;
  if (months < 0) return '—';

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yrs, ${rest} mo` : `${years} yrs`;
}

/**
 * The steps that do NOT carry the booking card.
 *
 * Everywhere else on the run, what the desk booked is reference the reader may
 * not have: they have arrived at a case they did not book, or they are coding
 * one they did, and leaving the screen to look up the service type is the whole
 * cost of not printing it.
 *
 * The Procedure step is the one place none of that is true. Its own document
 * opens on the service, the indication and the date as the first things it
 * asks for and then asserts them again in the report it writes — so the card
 * would be a third copy of the same six facts, a screenful above the report
 * that is about to state them, on the one step where vertical room in the work
 * column is scarcest.
 *
 * A Set rather than a comparison so the next step that earns the exemption is
 * a word added here rather than a condition rewritten.
 */
const STEPS_WITHOUT_BOOKING = new Set(['procedure']);

/**
 * What the front desk booked, in one card.
 *
 * Six facts. The same six the encounter summary prints under the same heading
 * (js/screens/encounter-summary.js), in the same order, because a clinician who
 * reads the card here and the band there is reading one booking twice and
 * should not have to find their place again.
 *
 * Hidden outright when the screen was opened without a booking behind it —
 * the gallery links this page bare — rather than drawn as six em dashes.
 *
 * A step that does not carry it is a DIFFERENT kind of hidden, and the two are
 * kept apart on purpose. `hidden` means there is no booking to show and there
 * is nothing to print either; `data-off-step` means this step does not want it
 * ON SCREEN, and the card is still painted and still filed — @media print puts
 * it back, because a procedure report pulled out of a folder has to say whose
 * booking it was. See the print block in css/screen-encounter.css.
 *
 * Repainted from paintWork rather than once at boot, because which step is open
 * is now one of the things that decides whether it shows at all.
 */
function paintApptDetails() {
  const band = el('apptDetails');
  if (!band) return;

  if (!appointment) {
    band.hidden = true;
    return;
  }
  band.hidden = false;
  band.dataset.offStep = String(STEPS_WITHOUT_BOOKING.has(state.step));

  const facts = [
    ['Service Type', procedureLabel()],
    ['Location', appointment.location || appointment.area || 'MediNova Gastroenterology'],
    ['Note Type', state.noteType],
    ['Age of Encounter', ageOfEncounter()],
    [
      'Service Date & Time',
      [shortDate(appointment.date), appointment.start].filter(Boolean).join(' · '),
    ],
    ['Provider', providerById(appointment.providerId)?.name ?? REPORT_STAFF.endoscopist],
  ];

  /* The reason runs the whole width under the six, rather than taking a
     seventh column. It is the one fact here that is a sentence, and a sentence
     in a 10rem column wraps to four lines and drags the band down with it. */
  const reason = appointment.reason || appointment.triage?.reason || '';

  el('apptFacts').innerHTML =
    facts
      .map(
        ([term, value]) =>
          `<div class="encv__appt-fact"><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join('') +
    (reason
      ? `<div class="encv__appt-fact encv__appt-fact--full">
           <dt>Reason For Visit</dt><dd>${esc(reason)}</dd>
         </div>`
      : '');

  paintApptFold(facts);
}

/*
 * The fold: the caret, the summary on the head, and the body behind it.
 *
 * WHICH THREE FACTS GO ON THE HEAD. The service, the slot and the provider —
 * the three that answer "which booking is this", which is the only question a
 * shut card has to be able to answer. They are taken off the same `facts`
 * array the body is built from rather than recomputed here, so the head and
 * the body cannot come to disagree about the provider's name.
 *
 * THE SUMMARY IS GONE WHEN THE CARD IS OPEN. The alerts band keeps its chips
 * in both states because open renders something else entirely — the note's
 * wording, its author, its date. Here open renders these same three values in
 * a row forty pixels below, and a head that repeats the first line of its own
 * body is a head that has stopped being a summary.
 */
function paintApptFold(facts) {
  const open = state.apptOpen;
  const toggle = el('apptToggle');
  const body = el('apptFacts');
  if (!toggle || !body) return;

  toggle.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  el('apptCaret').innerHTML = iconMarkup(open ? 'caret-up' : 'caret-down');

  const summary = ['Service Type', 'Service Date & Time', 'Provider']
    .map((term) => facts.find(([name]) => name === term)?.[1])
    .filter(Boolean)
    .join(' · ');
  el('apptSummary').textContent = open ? '' : summary;

  /* Bound once, not per paint. The head is markup this screen ships rather
     than markup it writes — unlike the alerts band, whose listener is thrown
     away and replaced with its innerHTML on every paint — so a listener added
     here would be added again on every step change and the card would flip
     twice, then four times, then eight. */
  if (toggle.dataset.wired) return;
  toggle.dataset.wired = 'true';
  toggle.addEventListener('click', () => {
    state.apptOpen = !state.apptOpen;
    paintApptDetails();
  });
}

/* ===================== Left rail: the patient ===================== */

/*
 * The card is js/lib/patient-card.js, which the clinic visit, its fork and the
 * encounter summary mount as well — the same bargain the clinical rail on the
 * right strikes. What stays here is the one thing this screen knows that the
 * card cannot: which provider owns this booking.
 */
function paintPatient() {
  paintPatientCard({
    host: el('patientCard'),
    patient,
    provider: providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist,
    testid: 'encv--patient',
  });
}

/* ===================== The document toolbar ===================== */

/*
 * PRINT, VIEW PDF AND DOWNLOAD PDF, ON EVERY DOCUMENT.
 *
 * Every one of the twenty documents in this run is paper somewhere: a consent
 * that goes in the notes, an anaesthetic record a coroner might read back, a
 * log the practice has to produce on request. Only the checklist offered a
 * PDF, and only half of one — the encounter dropped View on the argument that
 * the sheet was already on screen being looked at. That argument holds for the
 * sheet and for nothing else: what is on screen is a form, and what a PDF
 * shows is the FILED document, which is a different object — the form without
 * the shell around it. So all three are offered everywhere, from one place,
 * and every document's toolbar is built by adding its own controls in front
 * of them.
 *
 * ALL THREE GO THROUGH THE BROWSER'S OWN PRINT PATH, and they are honest about
 * it. The consents in particular are useless without one — a signed anesthesia
 * consent that cannot leave the screen is not a document anybody can file —
 * and the prototype has no build step and no PDF library, so what it has to
 * work with is the print dialog and a stylesheet that makes the page worth
 * sending to it. See @media print in css/screen-encounter.css: the shell, the
 * rails, the toolbar and the footer all go, and what is left on the paper is
 * the document and its signatures.
 *
 * Print and View PDF are the same action from the reader's side — the print
 * dialog IS the preview, and it is the preview of exactly what will be filed.
 * Download PDF is the same dialog with a word about where the file comes from,
 * because "Save as PDF" is a destination inside it rather than a button here,
 * and pretending otherwise would be a control that appears to write a file and
 * does not.
 */
function pdfActionsMarkup() {
  return `<ui-button variant="outline" size="sm" id="docPrint"
      data-testid="encv--print">Print</ui-button>
    <ui-button variant="outline" size="sm" id="docViewPdf"
      data-testid="encv--view-pdf">View PDF</ui-button>
    <ui-button variant="outline" size="sm" id="docDownloadPdf"
      data-testid="encv--download-pdf">Download PDF</ui-button>`;
}

/*
 * Told, and announced.
 *
 * A toast rather than the footer hint. The hint lives in #docFoot, which is
 * HIDDEN on every log — so on eight of the fourteen documents a message put
 * there was announced to a screen reader and shown to nobody. Everything that
 * has something to report to the person working the column goes through here:
 * the PDF buttons saying where the file comes from, and the section defaults
 * confirming what they just saved or filled in.
 */
function say(message) {
  el('copyLive').textContent = message;
  notify(message, 'info');
}

/**
 * Hand the open document to the browser's print path.
 *
 * The message goes out BEFORE the dialog rather than after: window.print()
 * blocks the page for as long as the dialog is up, so a toast fired afterwards
 * would appear once the reader had already finished with it and read as a
 * report on something they had done rather than as an instruction for what
 * they are about to do.
 */
function printDocument(message) {
  if (message) say(message);
  window.print();
}

/**
 * Fill the toolbar: the document's own controls, then the print trio.
 *
 * Every painter goes through here rather than assigning #docActions directly,
 * so a new document cannot arrive without them.
 */
function paintDocActions(own = '') {
  el('docActions').innerHTML = own + pdfActionsMarkup();

  /*
   * WHAT THE TRIO PRINTS, AND WHY IT IS NOT ALWAYS THE OPEN DOCUMENT.
   *
   * On thirteen of the fourteen steps the open document IS the step — one
   * sheet, filled in once, signed — so printing the screen prints the record
   * and these three buttons hand the page straight to the browser.
   *
   * On a TABBED step it is not. Its documents are worked alternately and only
   * one of them is in the DOM at a time, so "print what is on screen" quietly
   * means "print one eighth of the record". The unit that gets filed there is
   * the step, so that is what these print — see printStep and the header over
   * stepSheetMarkup for the whole argument.
   *
   * Read off `state` at press time rather than captured when the toolbar was
   * built: paintDocActions runs on every document, and a handler that
   * remembered which step it was wired for would be one more thing that can
   * disagree with the rail.
   */
  const wholeStep = () => {
    const step = stepById(state.step);
    return TABBED_STEPS.has(step?.id) && step.substeps.length > 1 ? step : null;
  };

  el('docPrint').addEventListener('ui-click', () => {
    const step = wholeStep();
    if (step) printStep(step);
    else printDocument();
  });

  el('docViewPdf').addEventListener('ui-click', () => {
    const step = wholeStep();
    if (step) {
      printStep(step, {
        message: `Opening the print preview — all ${step.substeps.length} sections of ${step.label}, as they file.`,
      });
    } else {
      printDocument('Opening the print preview — this is the document as it files.');
    }
  });

  el('docDownloadPdf').addEventListener('ui-click', () => {
    const step = wholeStep();
    if (step) {
      printStep(step, {
        download: true,
        message: `Saving all ${step.substeps.length} sections of ${step.label} — choose “Save as PDF” as the destination.`,
      });
    } else {
      printDocument('Choose “Save as PDF” as the destination to keep a copy.');
    }
  });
}

/* ===================== The alerts band ===================== */

/*
 * THE ALERTS THAT FOLLOW THE PATIENT THROUGH THE WHOLE ENCOUNTER.
 *
 * Three people work this screen across fourteen documents, and until now the
 * only thing carrying a warning was an allergy count on the patient card in a
 * rail that collapses. An alert that has to be gone looking for is not an
 * alert. So the chart's active alert notes sit under the title, on every step,
 * painted once and never torn down by a document change.
 *
 * COLLAPSIBLE, NOT DISMISSIBLE. A band of four alerts would eat the top of
 * the working column for the whole case, so it folds to its summary line —
 * which still names the count and the highest priority in it. What it will not
 * do is go away: dismissing an alert is a decision about the CHART, made in
 * the chart, not a way of getting a strip off one screen.
 */
/*
 * WHERE AN ALERT COMES FROM, AND THE FALLBACK THAT MATTERS MORE THAN THE
 * PRIMARY SOURCE.
 *
 * The chart's alert notes are the authored ones — written by a named person,
 * for a reason, with a date. Most patients do not have any. What every patient
 * on this screen DOES have is a clinical record with items marked critical in
 * it: an anaphylactic allergy, a diagnosis that changes the sedation plan, a
 * drug interaction. Those are active alerts by any reading, and they were
 * visible only in a rail that collapses.
 *
 * So: the authored notes where a patient has them, and the critical clinical
 * items where they do not. Not both — a patient whose chart already carries
 * "Anaphylaxis to penicillin" as an alert note would otherwise meet it twice
 * in one band, once as an alert and once as an allergy.
 */

/*
 * ONLY THE TWO SECTIONS THAT CHANGE WHAT MAY BE GIVEN.
 *
 * Every section of the clinical record marks its own critical items, and
 * sweeping all fourteen produced twelve "alerts" — a weight change, a
 * vaccination due, a haemoglobin — which is not an alert band, it is the
 * record again with a red edge on it. What belongs at the top of every step of
 * a sedation day is what would change the drug or stop the case: what the
 * patient reacts to, and what they have.
 */
const ALERT_SECTIONS = ['allergies', 'diagnosis'];

function criticalClinicalAlerts() {
  return CLINICAL_SECTIONS.filter((section) => ALERT_SECTIONS.includes(section.id)).flatMap(
    (section) =>
      section.items
        .filter((item) => item.critical)
        .map((item, i) => ({
          id: `${section.id}-${i}`,
          priority: 'high',
          title: item.text,
          body: item.meta ?? '',
          /* The section it came from IS its category — one badge saying where
             it is written down, rather than a "Clinical / High" pair that says
             the same thing twice on every row. */
          badge: { label: section.label, tone: 'critical' },
        }))
  );
}

function activeAlerts() {
  const authored = PATIENTS[patient.mrn]?.alerts;
  if (authored?.length) {
    return authored.map((alert) => ({
      ...alert,
      badge: ALERT_CATEGORIES[alert.category] ?? { label: alert.category, tone: 'neutral' },
      priorityBadge: ALERT_PRIORITIES[alert.priority] ?? { label: alert.priority, tone: 'neutral' },
      source: `${alert.author} · ${alert.date}`,
    }));
  }
  return criticalClinicalAlerts();
}

/** Highest priority present, for the collapsed summary line's tone. */
const alertTone = (alerts) =>
  ['high', 'medium', 'low'].find((level) => alerts.some((a) => a.priority === level)) ?? 'low';

function paintAlerts() {
  const host = el('docAlerts');
  const alerts = activeAlerts();

  /* A patient with no alerts gets no band at all, rather than one saying so.
     "No active alerts" is a sentence every reader has to read and discard on
     every step of every case. */
  host.hidden = alerts.length === 0;
  if (!alerts.length) return;

  const open = state.alertsOpen;
  const tone = ALERT_PRIORITIES[alertTone(alerts)].tone;

  host.dataset.tone = tone;
  host.innerHTML = `
    <button type="button" class="encv__alerts-head" id="alertsToggle"
      aria-expanded="${open}" aria-controls="alertsList" data-testid="encv--alerts-toggle">
      ${iconMarkup('warning')}
      <span class="encv__alerts-title">${alerts.length} active alert${
        alerts.length === 1 ? '' : 's'
      }</span>
      ${/* The titles as CHIPS, one per alert, each in its own priority's colour
           — not a middot-joined string. The string said which alerts were
           folded inside; the chips say that AND which of them is the high one,
           which is the whole question a reader has of a band they are about to
           leave shut. They live in the head rather than the list because this
           is what the band says when it is saying the least. */ ''}
      <span class="encv__alerts-summary">${alerts
        .map(
          (a) =>
            `<span class="encv__alerts-chip" data-tone="${
              ALERT_PRIORITIES[a.priority]?.tone ?? 'neutral'
            }">${esc(a.title)}</span>`
        )
        .join('')}</span>
      ${iconMarkup(open ? 'caret-up' : 'caret-down')}
    </button>
    <ul class="encv__alerts-list" id="alertsList" ${open ? '' : 'hidden'}>
      ${alerts
        .map(
          (alert) => `<li class="encv__alert" data-priority="${esc(alert.priority)}"
            data-testid="encv--alert-${esc(alert.id)}">
            <div class="encv__alert-head">
              <strong class="encv__alert-title">${esc(alert.title)}</strong>
              <ui-badge status="${alert.badge.tone}" size="sm">${esc(alert.badge.label)}</ui-badge>
              ${
                alert.priorityBadge
                  ? `<ui-badge status="${alert.priorityBadge.tone}" size="sm"
                      >${esc(alert.priorityBadge.label)}</ui-badge>`
                  : ''
              }
            </div>
            ${/* Who wrote it and when, RUN ON to the end of the note rather than
                 set on a line of its own. It is an attribution, not a second
                 fact: nobody scans a column of alert bodies for the date, they
                 read one note and then want to know whose it was. Kept as its
                 own element so it still greys back — it just no longer costs a
                 line of the band's height per alert. */ ''}
            ${
              alert.body
                ? `<p class="encv__alert-body">${esc(alert.body)}${
                    alert.source
                      ? ` <span class="encv__alert-by">${esc(alert.source)}</span>`
                      : ''
                  }</p>`
                : alert.source
                  ? `<p class="encv__alert-by">${esc(alert.source)}</p>`
                  : ''
            }
          </li>`
        )
        .join('')}
    </ul>`;

  el('alertsToggle').addEventListener('click', () => {
    state.alertsOpen = !state.alertsOpen;
    paintAlerts();
  });
}

/* ===================== Left rail: the stepper ===================== */

/*
 * ONE MARKER PER STEP, FOUR STATES.
 *
 * The step's own authored status, except for the step that is open — that one
 * is drawn as `current` whatever the fixture says, because "where the case is"
 * and "which step I am looking at" are the same question from the rail, and two
 * different markers claiming to be "here" is the one thing a stepper must not
 * do. Where the case actually is stays legible in the other six markers.
 */
function markerFor(step) {
  const status = step.id === state.step ? 'current' : step.status;
  const { icon, tone, label } = STEP_STATUS[status];
  return `<span class="encv__marker" data-tone="${tone}" role="img"
    aria-label="${esc(label)}">${icon ? iconMarkup(icon) : ''}</span>`;
}

function substepsMarkup(step) {
  if (!step.substeps.length) return '';

  return `<ul class="encv__substeps" role="list">
    ${step.substeps
      .map((sub) => {
        const open = step.id === state.step && sub.id === state.substep;
        /* Selection beats status on the marker, the same rule the step markers
           follow: "here" and "done" are different answers and the open document
           has to give the first one. Its real status stays in the tooltip. */
        const { tone } = STEP_STATUS[open ? 'current' : sub.status];
        const { label } = STEP_STATUS[sub.status];
        const hint = sub.note;
        return `<li class="encv__substep" data-open="${open}">
          <button type="button" class="encv__substep-btn"
            ${open ? 'aria-current="true"' : ''}
            data-step="${step.id}" data-substep="${sub.id}"
            title="${esc(hint ? `${label} — ${hint}` : label)}"
            data-testid="encv--substep-${sub.id}">
            <span class="encv__dot" data-tone="${tone}" aria-hidden="true"></span>
            <span class="encv__substep-label">${esc(sub.label)}</span>
          </button>
        </li>`;
      })
      .join('')}
  </ul>`;
}

function paintStepper() {
  el('stepper').innerHTML = ENCOUNTER_STEPS.map((step) => {
    const leaf = step.substeps.length === 0;
    const expanded = state.expanded.has(step.id);

    return `<li class="encv__step" data-open="${step.id === state.step}"
      data-leaf="${leaf}">
      <button type="button" class="encv__step-row"
        ${step.id === state.step ? 'aria-current="step"' : ''}
        ${leaf ? '' : `aria-expanded="${expanded}"`}
        title="${esc(step.role ? `${step.label} — ${step.role}` : step.label)}"
        data-step="${step.id}" data-testid="encv--step-${step.id}">
        ${markerFor(step)}
        <span class="encv__step-name">${esc(step.label)}</span>
        <span class="encv__step-caret" aria-hidden="true">${iconMarkup('caret-down')}</span>
      </button>
      ${expanded ? substepsMarkup(step) : ''}
    </li>`;
  }).join('');

  /*
   * The step row does two things at once, and both are wanted: it opens the
   * step in the work column AND expands its documents in the rail. Splitting
   * them across two targets — row to open, caret to expand — was the first
   * arrangement, and it meant reaching a document took two presses on two
   * different 16px targets in a rail. One press does both; a second press on
   * the step you are already on folds the documents away again.
   */
  el('stepper').querySelectorAll('.encv__step-row').forEach((row) =>
    row.addEventListener('click', () => openStep(row.dataset.step))
  );

  el('stepper').querySelectorAll('[data-substep]').forEach((btn) =>
    btn.addEventListener('click', () => openSubstep(btn.dataset.step, btn.dataset.substep))
  );
}

/* ===================== Centre: the work ===================== */

/*
 * THE WORKING COLUMN NAMES WHAT IT IS SHOWING, AND NAVIGATES ONE STEP.
 *
 * It used to carry a tab strip of EVERY step's documents across the top. That
 * strip is gone, and for a good reason: every one of those documents is
 * already listed under its step in the rail, so on thirteen of the fourteen
 * steps it was a second set of controls for the same destinations three inches
 * away, and the two had to be kept agreeing with each other for no gain.
 *
 * The fourteenth step is the one that earns it back — see TABBED_STEPS below.
 *
 * What is always here is a title: the step, and the document inside it. That
 * is what the centre column owes the reader — "you are in Intra-procedure
 * Management, on Times" — and it is the thing the rail cannot say once it is
 * collapsed.
 */

/**
 * THE STEPS WHOSE DOCUMENTS ALSO SIT IN THE WORKING COLUMN.
 *
 * One entry, and it is meant to stay roughly that size. A step qualifies when
 * its documents are worked ALTERNATELY rather than in order — when charting it
 * means going round the set several times instead of down it once.
 *
 * Intra-procedure Management is the only one on this run that does. Its eight
 * logs are the live case: a set of obs, the drug given in answer to them, the
 * bag that went up, then back to the obs a few minutes later. Reaching each of
 * those through the rail is a trip to the far side of a three-column screen,
 * to a row 16px tall, and on a collapsed rail to a row that is not drawn at
 * all — repeated a few dozen times over a case.
 *
 * Every other step is filled in once and signed. Those keep the rail alone.
 */
const TABBED_STEPS = new Set(['intra']);

/**
 * The segment strip for the open step's documents, or nothing.
 *
 * `primary` because this is the working column's own top-level switch between
 * places — the joined, filled segment ui-tabs draws for exactly that, not the
 * underline it draws for a switch between lists inside one section.
 *
 * REBUILT ONLY WHEN THE STEP CHANGES, never when the document does. paintWork
 * runs on every substep press, and re-rendering <ui-tabs> replaces the very
 * button that was just clicked or arrowed onto — focus would land on the body
 * mid-keystroke. Moving between documents therefore only writes `selected`,
 * which the component is built to take without a re-render.
 */
let docTabsFor = null;

function paintDocTabs(step, sub) {
  const host = el('docTabs');
  const wanted = TABBED_STEPS.has(step.id) && step.substeps.length > 1;

  if (!wanted) {
    if (docTabsFor !== null) {
      host.innerHTML = '';
      docTabsFor = null;
    }
    host.hidden = true;
    return;
  }

  host.hidden = false;

  if (docTabsFor === step.id) {
    /* Same strip, different document. One attribute, and <ui-tabs> moves the
       fill itself — see the note above. */
    const strip = host.querySelector('ui-tabs');
    if (strip) strip.setAttribute('selected', sub?.id ?? '');
    return;
  }

  host.innerHTML = `<ui-tabs primary selected="${esc(sub?.id ?? '')}"
    data-testid="encv--doc-tabs-strip">
    ${step.substeps
      .map(
        (substep) => `<ui-tab value="${esc(substep.id)}"
          label="${esc(substep.label)}"></ui-tab>`
      )
      .join('')}
  </ui-tabs>`;
  docTabsFor = step.id;
}

/*
 * The strip navigates; it does not own the state. openSubstep is the same
 * entry point the rail's rows call, so the rail and the strip cannot end up
 * disagreeing about which document is open — there is one writer.
 *
 * ONE LISTENER, ON THE HOST, FOR THE LIFE OF THE SCREEN. The host survives
 * every repaint (only its contents are replaced) and ui-change bubbles, so
 * binding here rather than inside paintDocTabs means a strip rebuilt for a
 * second step cannot leave the first step's handler behind still claiming its
 * presses. It reads the open step off `state` for the same reason: nothing
 * about the wiring is allowed to remember a step.
 */
function wireDocTabs() {
  el('docTabs').addEventListener('ui-change', (event) => {
    const value = event.detail?.value;
    if (value && value !== state.substep) openSubstep(state.step, value);
  });
}
function paintWork() {
  const step = stepById(state.step);
  const sub = step.substeps.find((s) => s.id === state.substep);

  /* The booking card comes and goes with the step — see STEPS_WITHOUT_BOOKING.
     Painted here rather than once at boot so that moving between steps is what
     puts it away and brings it back. */
  paintApptDetails();

  /* Torn down before anything else touches the DOM. The sheet registers a
     beforeunload guard and holds ~180 upgraded custom elements; leaving one
     mounted while its markup is replaced leaks both. */
  if (preCheckSheet) {
    preCheckSheet.destroy();
    preCheckSheet = null;
  }

  /* and the feed, for the same reason and one more of its own. It holds an
     interval and a keydown listener on the DOCUMENT — the foot pedal — and a
     pedal still bound while the nursing record is open would freeze and
     capture a panel that is no longer on the page.
     The window goes with it. It floats over the whole screen rather than
     sitting in the document, so nothing else would have taken it away, and a
     monitor still running over the top of somebody's Aldrete score is a panel
     that has stopped belonging to anything on screen.
     The feed's own STATE is untouched, including where the window was put: the
     case has not stopped because somebody opened another step, and the panel
     comes back where they left it when the report is opened again. */
  stopFeedPanel();
  hideFeedWindow();

  /*
   * THE BODY IS REPLACED, NOT EMPTIED.
   *
   * paintDocument binds four delegated listeners to #docBody ITSELF — the
   * field writes, the Now presses and the two halves of Set/Use Default — and
   * each of them closes over the spec and the answer store of the document it
   * was bound for. Emptying the element leaves every one of them attached, so
   * a session that opened three documents had three sets listening, and the
   * two oldest were still holding the wrong store.
   *
   * That was not theoretical on this run. The discharge record and check-out
   * once shared six field keys, so a Now pressed on one of them ran the other
   * document's handler as well, and which store the stamp landed in came down
   * to the order the listeners happened to be added in. Those six now live on
   * check-out alone — but a screen whose correctness rests on listener order is
   * a screen waiting to be reordered, so the swap stays.
   *
   * A shallow clone keeps the id, the class and the aria wiring and takes
   * nothing else, and every reader looks the element up by id — so the swap is
   * invisible to the rest of the module.
   */
  const body = el('docBody');
  body.replaceWith(body.cloneNode(false));
  el('docName').textContent = step.label;

  /* The step's documents as a segment strip, on the one step that is charted
     by going round them — see TABBED_STEPS. Hidden everywhere else. */
  paintDocTabs(step, sub);

  /* The document, beside the step rather than under it: they are one location
     read left to right, not a heading with a caption. Empty for a step that is
     a single sheet, and the separator goes with it.

     WRITTEN ALWAYS, SHOWN ONLY WHEN THE STRIP IS NOT. On the one step that
     draws the strip, the lit segment already names the document a few pixels
     lower, in the control that moves between them, so the title beside the
     step would be saying the same word twice about the same thing.

     Quietened with an attribute rather than emptied, because the strip is
     navigation and does not print: on paper this line is the only thing that
     says which of the eight logs the page is, and @media print turns it back
     on. A cleared textContent would leave nothing there to turn on. */
  el('docSub').textContent = sub ? sub.label : '';
  el('docSub').hidden = !sub;
  el('docSub').dataset.quiet = String(Boolean(sub) && TABBED_STEPS.has(step.id));

  /* A fresh element each paint rather than a retitled one — see the host div
     in screens/encounter.html. The role badge stays: with the rail's rows
     down to a name apiece, this is the only place the owning role is written.

     The STEP's role, and only the step's. A substep could carry its own for a
     while, because check-out was filed under Procedure and badging the desk's
     document "MD" named the wrong person for it. Check-out is a step now and
     carries "Front desk" itself, so every document on the run is owned by
     whoever signs the step it is on again — which is what the rail already
     says. */
  const role = step.role;
  el('docRole').innerHTML = role
    ? `<ui-badge status="neutral" size="sm">${esc(role)}</ui-badge>`
    : '';

  if (step.id === 'checklist') paintChecklist();
  /* Not a log any more — see the header above paintToRecovery. */
  else if (sub?.id === 'to-recovery') paintToRecovery();
  else if (sub && ENCOUNTER_LOGS[sub.id]) paintLog(sub.id);
  else if (sub && ENCOUNTER_DOCS[sub.id]) paintDocument(sub.id);
  else if (ENCOUNTER_DOCS[step.id]) paintDocument(step.id);
  else paintPlaceholder(step, sub);
}

/* ===================== The form-shaped documents ===================== */

/*
 * Consents, assessments, the discharge summary — everything filled in once and
 * signed rather than appended to. Drawn from js/lib/encounter-docs.js by one
 * renderer, the same arrangement the logs use and for the same reason: six
 * hand-built forms drift, and the two that must not are the consents.
 *
 * Sections are the checklist's cards, so a nurse moving from step 1 to step 3
 * meets the same object twice — a marked edge, a title, a rule, the questions
 * under it.
 */

/** Every document's answers, by document id. Survives leaving the step. */
const docValues = {};

/*
 * WHAT THE CASE ITSELF ANSWERS, FOR A FIELD NOBODY SHOULD RETYPE.
 *
 * `fromCase: 'indication'` on a field in js/lib/encounter-docs.js means: fill
 * it from the booking this encounter was opened for, not from the spec's own
 * `value`. It is the counterpart to `seedFrom` below — that one carries an
 * answer across from another DOCUMENT on the run, this one carries a fact the
 * case has held since before any document was opened.
 *
 * The indication is the one the run needs and the reason this exists. It is
 * settled when the procedure is booked, shown to the patient and confirmed by
 * the desk at check-in, and then asked for again on two documents at the bay —
 * where, until now, both answered it with the same authored string on every
 * patient. Retyping a fact the record holds is how two documents on one case
 * end up naming two different reasons for it.
 *
 * It lives HERE and not in the spec because the spec is a declaration of what
 * the documents ARE, and it has no way of knowing which booking is open — the
 * appointment comes off the query string on this screen. Same reason
 * DOC_COMPLETION_EFFECTS is here.
 *
 * A fact that comes back empty — an encounter.html opened bare, with no `appt`
 * behind it — falls through to the spec's own `value`, so a demo run still
 * meets a filled-in form rather than a blank one.
 */
const CASE_FACTS = {
  /* The booking's reason for visit IS the indication: that is this practice's
     own vocabulary, written down in the mapping table at the head of
     js/screens/schedule.js, and it is the line the desk reads back at
     check-in. */
  indication: () => appointment?.reason ?? '',
};

/**
 * SIGNATURES THIS SCREEN DOES NOT TAKE, AND WHERE IT READS THEM FROM.
 *
 * `filed` on a spec's signature block names one of these. The block then shows
 * the mark it returns instead of a pad: the consent at step 4 was signed at the
 * front desk on the way in, and the bay quotes it rather than asking a
 * pre-medicated patient to sign the same document twice (see 'patient-consent'
 * in js/lib/encounter-docs.js).
 *
 * It lives here rather than in the spec for the reason CASE_FACTS does: the
 * spec declares what the documents ARE and has no way of knowing which booking
 * is open. The NAME on the mark is the patient off this appointment and the
 * TIME is read off its slot, so a consent quoted at the bay can never be quoted
 * against somebody else's patient — only how long before the slot the desk took
 * it is authored, in data/procedure-encounter-run.js.
 *
 * NO IMAGE, DELIBERATELY. The desk's pad files a bitmap with the check-in
 * record and the prototype has no store carrying it between screens; a filed
 * mark with no `dataUrl` renders the name in the signature face instead (see
 * markMarkup in js/lib/signature-block.js), which is the honest rendering of
 * "this was signed and here is the record of it". Drawing an invented squiggle
 * over a patient's name would be the one thing a consent screen must not do.
 */
const FILED_MARKS = {
  'checkin-consent': () => {
    const slot =
      appointment?.date && appointment?.start
        ? new Date(`${appointment.date}T${appointment.start}:00`)
        : new Date();
    const taken = new Date(slot.getTime() - PROCEDURE_CONSENT_CAPTURE.minutesBeforeSlot * 60000);
    return {
      name: patient.name,
      method: PROCEDURE_CONSENT_CAPTURE.method,
      fileName: null,
      dataUrl: null,
      at: signedAtLabel(taken),
      source: PROCEDURE_CONSENT_CAPTURE.where,
    };
  },
};

/** Answers for one document, seeded from the spec the first time it is opened. */
function valuesFor(id) {
  if (docValues[id]) return docValues[id];

  const spec = ENCOUNTER_DOCS[id];
  const values = { checks: new Set(), signature: {} };
  spec.sections.forEach((section) => {
    (section.fields ?? []).forEach((field) => {
      /* A field with no key answers nothing — the standing order lines are the
         only ones, and they are read rather than filled in. */
      if (!field.key) return;
      const fact = field.fromCase ? CASE_FACTS[field.fromCase]?.() : '';
      values[field.key] = String(fact ?? '').trim() || (field.value ?? '');
    });
    /* A check that arrives already true — the discharge criteria do — starts
       ticked rather than being presented as outstanding work that is done. */
    (section.checks ?? []).forEach((check) => {
      if (check.checked) values.checks.add(check.id);
    });

    /* A signature taken somewhere else arrives with the document rather than
       being waited for: the patient's consent was signed at the desk, so the
       block opens holding it and the foot never counts it as outstanding. See
       FILED_MARKS. */
    if (section.signature?.filed) {
      const mark = FILED_MARKS[section.signature.filed]?.();
      if (mark) values.signature[section.signature.who] = mark;
    }

    /*
     * A SECTION THAT STARTS FROM ANOTHER DOCUMENT'S ANSWERS.
     *
     * `seedFrom: { doc, keys }` on a section means: before anybody types
     * anything here, copy those keys across from the named document. The H&P's
     * sedation type is what is left using it — the technique is decided on the
     * anaesthesia pre-op and read back on the endoscopist's own pre-op, and a
     * second blank copy of that question is an invitation to answer it
     * differently.
     *
     * Seeded rather than shared, and the distinction is the point: the second
     * document may correct what it is looking at, but it may not start from an
     * empty box and re-decide from memory.
     *
     * It used to carry more. The desk's Discharge Details was seeded from the
     * nurse's record, which asked the same five questions first — until the
     * record stopped asking them at all and became the handout alone, leaving
     * the desk as the only place they are answered. Nothing to seed, nothing to
     * disagree.
     *
     * Only keys the OTHER document has actually been opened and worked in come
     * across — an unopened source has no store — so this quietly does nothing
     * rather than writing blanks over the spec's own defaults. A key whose
     * source is empty is skipped for the same reason.
     */
    if (section.seedFrom && docValues[section.seedFrom.doc]) {
      const source = docValues[section.seedFrom.doc];
      section.seedFrom.keys.forEach((key) => {
        if (String(source[key] ?? '').trim()) values[key] = source[key];
      });
    }
  });
  docValues[id] = values;
  return values;
}

/*
 * A FIELD THAT ONLY EXISTS ONCE SOMETHING ELSE HAS BEEN ANSWERED.
 *
 * `showWhen: { key, is }` on a field means: draw it, but keep it out of the
 * form until the field it names holds that answer. The pre-anaesthesia
 * assessment is the case it was written for — Lungs and CV can be answered
 * "Other", and Other with nothing after it is a finding withheld, so each
 * opens the text field that finishes the sentence.
 *
 * Hidden rather than absent from the markup: the field has to be able to
 * appear the instant its select changes, and re-rendering the section to grow
 * one input would take the signature pads below it with it (see repaintProse
 * for the same constraint, for the same reason).
 *
 * A field nobody can see is a field nobody can answer, so a hidden one is not
 * counted as outstanding — paintDocFoot asks the same question through here.
 */
const fieldShown = (field, values) =>
  !field.showWhen || values[field.showWhen.key] === field.showWhen.is;

/**
 * A spec field type, as an <input> type.
 *
 * Anything not named here is text, which is the right default: a spec is free
 * to describe a field in its own vocabulary and the ones that need a special
 * control say so.
 */
const DOC_INPUT_TYPES = {
  number: 'number',
  time: 'time',
  date: 'date',
  /* A moment, not a clock reading. The discharge instructions can be given the
     morning after a late case and the pathology conversation days later, so
     the field has to be able to say WHICH day — see the discharge document in
     js/lib/encounter-docs.js. */
  datetime: 'datetime-local',
};

/* ---------------------------------------------------------------------------
   THE FINDINGS DIAGRAM

   `type: 'diagram'` on a document field, with `diagram: 'colon'` naming which
   picture. The renderer in js/lib/segment-findings.js is deliberately ignorant
   of anatomy — it draws whatever segments and finding types it is handed — so
   the colon is assembled here and looked up by name. Aiming the same field at
   an upper-GI drawing is another entry in this object and no change to the
   renderer, the field type, or the document spec's shape.
   ------------------------------------------------------------------------ */
const DIAGRAMS = {
  colon: {
    segments: COLON_SEGMENTS,
    types: COLON_FINDING_TYPES,
    image: '../assets/img/colon-diagram.png',
    alt:
      'Anatomical diagram of the large bowel, labelled: cecum, appendix, ascending colon, ' +
      'transverse colon, descending colon, sigmoid colon, rectum and anus.',
  },
};

/**
 * The diagram's own state for one field, kept on the document's answers.
 *
 * It lives in `values` rather than in a module-level map because that is where
 * the rest of the document's work lives: opening another step and coming back
 * repaints from `values`, and findings that did not survive that round trip
 * would be findings lost to a glance at the vitals.
 *
 * `findings` is the structured record and `values[key]` is the prose read off
 * it — two representations of one thing, which is safe only because exactly
 * one of them is ever written by hand. Neither is.
 */
function diagramStoreFor(key, values) {
  values.diagrams ??= {};
  values.diagrams[key] ??= {
    findings: [],
    showRegions: false,
    draftType: '',
    draftValues: {},
    openSegment: null,
  };
  return values.diagrams[key];
}


/* ---------------------------------------------------------------------------
   ICD-10 ON A DOCUMENT

   `type: 'icd'` on a document field. The indication card on the procedure
   report is the one that has it, and the argument for it is in the spec beside
   the field: the paragraph above says WHY the patient was scoped, in the
   endoscopist's words, and this says what that is called in the one vocabulary
   a claim can be made in.

   SEARCHED, NOT PICKED FROM A LIST. The other place in the product that
   attaches a diagnosis offers a dropdown of the catalogue, which is workable
   at ten codes and nothing else — and a closed list is wrong here in the
   direction that matters, because the code that is not on it is still the
   patient's diagnosis. So it is a box that matches on the code AND on the
   words: "K21" and "reflux" both reach gastro-oesophageal reflux disease, and
   the reader who knows the code types the code.

   The attached codes are a list because an indication routinely is one — a
   surveillance scope on a patient with iron deficiency is two diagnoses, and a
   single-code field would make the endoscopist choose which of them to leave
   off the report.
   ------------------------------------------------------------------------ */

/** How many matches the box shows at once. */
const ICD_RESULT_LIMIT = 8;

/** The codes attached to one field, on the document's own answers. */
function icdStoreFor(key, values) {
  values.codes ??= {};
  values.codes[key] ??= [];
  return values.codes[key];
}

/**
 * The catalogue narrowed to what was typed.
 *
 * Both halves of every entry are searched, and the comparison is
 * case-insensitive on both sides — a coder types "k21", a clinician types
 * "Reflux", and a search that answered only one of them would send the other
 * away believing the code is not in the catalogue.
 *
 * An empty box matches nothing rather than everything: a list that unrolls the
 * whole catalogue under the field the moment it is focused buries the card
 * below it, and the answer to "which of these ten" is not a list of ten.
 */
function icdMatches(query, attached) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ICD10.filter(
    (entry) =>
      !attached.includes(entry.code) &&
      (entry.code.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q))
  ).slice(0, ICD_RESULT_LIMIT);
}

/** The matches, or the sentence that says why there are none. */
function icdResultsMarkup(query, attached) {
  if (!query.trim()) return '';

  const matches = icdMatches(query, attached);
  if (!matches.length) {
    /* Named rather than blank. A results box that empties itself reads as a
       search that is still thinking, and the reason it found nothing — no such
       code, or a code already on the report — is the thing worth saying. */
    return `<p class="encv__icd-empty">No ICD-10 code matches “${esc(
      query.trim()
    )}” — check the spelling, or it may already be attached.</p>`;
  }

  return `<ul class="encv__icd-results">
    ${matches
      .map(
        (entry) => `<li>
          <button type="button" class="encv__icd-result" data-icd-attach="${esc(entry.code)}"
            data-testid="encv--icd-result-${esc(entry.code)}">
            <code>${esc(entry.code)}</code>
            <span>${esc(entry.text)}</span>
          </button>
        </li>`
      )
      .join('')}
  </ul>`;
}

/** What is on the report already, each with the press that takes it off. */
function icdAttachedMarkup(attached) {
  if (!attached.length) {
    return `<p class="encv__icd-none">No diagnosis code attached yet.</p>`;
  }

  return `<ul class="encv__icd-list">
    ${attached
      .map(
        (code) => `<li class="encv__icd-code" data-testid="encv--icd-attached-${esc(code)}">
          <code>${esc(code)}</code>
          <span class="encv__icd-text">${esc(
            ICD10.find((entry) => entry.code === code)?.text ?? ''
          )}</span>
          <button type="button" class="encv__icd-drop" data-icd-drop="${esc(code)}"
            aria-label="Remove ${esc(code)}"
            data-testid="encv--icd-drop-${esc(code)}">×</button>
        </li>`
      )
      .join('')}
  </ul>`;
}

/* ---------------------------------------------------------------------------
   PHOTOS ON A DOCUMENT

   `type: 'photos'` on a document field, which the procedure report's own card
   is the only user of. Read locally through a FileReader and held as data URLs
   on the document's answers — there is no server in this prototype, so what is
   attached lives as long as the encounter does, which is the same bargain
   every other answer on the run makes.
   ------------------------------------------------------------------------ */

/** The images attached to one field, on the document's own answers. */
function photoStoreFor(key, values) {
  values.uploads ??= {};
  values.uploads[key] ??= [];
  return values.uploads[key];
}

/** Ids are per-session and only have to be unique within the page. */
let nextDocPhotoId = 1;

/**
 * The document's answer for a photo field, as a sentence.
 *
 * The store is the images and this is what everything generic reads — the
 * foot's required check, a print, a default. Same arrangement the diagram
 * makes with its findings: one structured record, one readable form of it, and
 * nothing writes the readable one by hand.
 */
function describePhotos(list) {
  if (!list.length) return '';
  return list.length === 1 ? '1 photo attached' : `${list.length} photos attached`;
}

/*
 * A TILE SAYS WHEN IT WAS TAKEN, AND WHETHER IT MOVES.
 *
 * Uploaded photos carry a file name and nothing else, which was the whole of a
 * caption while the only way onto this card was choosing files. A capture off
 * the live feed arrives with two more facts and both of them are read rather
 * than looked up: WHEN, because a run of stills is read as a sequence and the
 * clock is what puts them in one, and WHETHER IT IS A CLIP, because a still
 * and a ten-second recording are not the same kind of evidence and a strip of
 * identical tiles cannot say which is which.
 *
 * Both are optional. A photo chosen from disk has neither, and its tile is the
 * tile it always was.
 */
function photosMarkup(key, list, nextCapture = null) {
  /*
   * WHERE THE NEXT PRESS WILL LAND, SHOWN ON THE CARD IT WILL LAND ON.
   *
   * While the feed is running, the destination of a capture is a choice made
   * three cards up — the finding selected in the Findings list — and the
   * endoscopist's eyes are on the monitor, not on either. A dashed tile at the
   * end of the strip is the cheapest possible answer to "if I press the pedal
   * now, what does this become", and it is on the strip because that is where
   * the answer shows up two seconds later.
   */
  const next = nextCapture
    ? `<div class="encv__photo encv__photo--next" data-testid="encv--photo-next">
        <span class="encv__photo-next-lead">next capture</span>
        <span class="encv__photo-next-target">→ ${esc(nextCapture)}</span>
      </div>`
    : '';

  const grid = list.length || next
    ? `<div class="encv__photo-grid">
        ${list
          .map(
            (photo) => `<figure class="encv__photo" data-testid="encv--photo-${photo.id}">
              <img src="${photo.dataUrl}" alt="${esc(photo.name)}" />
              ${
                photo.seconds
                  ? `<span class="encv__photo-clip" data-testid="encv--photo-clip-${photo.id}">${
                      photo.seconds
                    }s clip</span>`
                  : ''
              }
              <figcaption>
                <span class="encv__photo-name">${esc(photo.name)}</span>
                ${photo.at ? `<span class="encv__photo-at">${esc(photo.at)}</span>` : ''}
              </figcaption>
              <button type="button" class="encv__photo-drop" data-photo-drop="${photo.id}"
                aria-label="Remove ${esc(photo.name)}"
                data-testid="encv--photo-drop-${photo.id}">×</button>
            </figure>`
          )
          .join('')}
        ${next}
      </div>`
    : `<p class="encv__icd-none">No photos attached yet.</p>`;

  return `<div class="encv__photos-head">
      <span class="encv__photos-count" data-testid="encv--photo-count">${
        list.length
      } of ${DOC_MAX_PHOTOS}</span>
      <ui-button variant="outline" size="sm" icon="image" data-photo-add="${esc(key)}"
        data-testid="encv--photo-add">Add photos</ui-button>
    </div>
    ${grid}
    ${/* Off screen rather than absent: the button above opens it, and a file
         input styled to look like the rest of the form is a control the
         browser will not let anybody style consistently anyway. */ ''}
    <input type="file" accept="image/*" multiple class="u-sr-only"
      data-photo-input="${esc(key)}" aria-label="Add procedure photos"
      data-testid="encv--photo-input" />`;
}

const docFieldMarkup = (field, values) => {
  /*
   * PROTOCOL TEXT, INSIDE THE FORM RATHER THAN BESIDE IT.
   *
   * `type: 'lines'` collects nothing and has no key: it is a run of standing
   * order lines the practice orders for every case, drawn where the document
   * reaches them. It is a FIELD rather than a section-level list because its
   * position is the whole point — the sedation medications belong between the
   * technique they follow from and the box for anything ordered on top of
   * them, and a key on the section could only ever put them before both or
   * after both.
   *
   * Read-only for the reason the lists are standing in the first place: a line
   * typed over in one encounter is a protocol that quietly differs from the
   * one every other room is working to. What this patient needs on top of it
   * goes in the field underneath, which is a field precisely because it is not
   * the protocol.
   */
  if (field.type === 'lines') {
    return `<div style="grid-column: span 2" data-testid="encv--dlines-${field.id}">
      ${field.label ? `<p class="encv__doc-lines-label">${esc(field.label)}</p>` : ''}
      <ul class="encv__doc-lines">${field.lines
        .map((line) => `<li>${esc(line)}</li>`)
        .join('')}</ul>
    </div>`;
  }

  /*
   * THE DIAGRAM, WHICH IS A FIELD AND NOT A SECTION.
   *
   * It has a key and it holds a value, so it is a field — that is what keeps
   * `required`, the footer's outstanding count and the impression seed working
   * without any of them learning what a diagram is. What it does NOT do is
   * render a control: the markup is the picture, the hotspots and the list of
   * what has been recorded, and the value it holds is the prose read off them.
   *
   * `data-doc-field` is deliberately absent. That attribute is what the
   * document's two delegated listeners look for, and a stray ui-change from a
   * checkbox inside the drawer must not overwrite the generated prose with a
   * checkbox's value. The diagram writes to the store itself, through the
   * commit its wiring is given.
   */
  if (field.type === 'diagram') {
    const config = DIAGRAMS[field.diagram];
    if (!config) return '';
    return `<div style="grid-column: span 2" data-diagram-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}">${findingsHtml(
      diagramStoreFor(field.key, values),
      config
    )}</div>`;
  }

  /*
   * THE TWO FIELDS THAT ARE A PANEL RATHER THAN A CONTROL.
   *
   * Both are keyed and both hold an answer, which is what keeps `required`,
   * the foot's outstanding count and everything else generic working without
   * any of them learning what a code list or a photo grid is. Neither carries
   * `data-doc-field`, for the same reason the diagram above does not: a stray
   * ui-change from a search box inside them must not overwrite the answer the
   * panel maintains for itself.
   */
  if (field.type === 'icd') {
    return `<div style="grid-column: span 2" data-icd-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}">
      <p class="encv__doc-lines-label">${esc(field.label)}</p>
      <ui-input data-icd-search="${esc(field.key)}" label="Search ICD-10" label-hidden
        placeholder="Search by code or description — “K21”, “reflux”…"
        data-testid="encv--icd-search"></ui-input>
      <div data-icd-results></div>
      <div data-icd-attached>${icdAttachedMarkup(icdStoreFor(field.key, values))}</div>
    </div>`;
  }

  /* the jars. A whole-width host the mount fills, the same arrangement the
     diagram and the photo grid use — the section's own markup is built by
     js/lib/specimen-table.js, which is also what the Pathology step will draw
     when a jar comes back. */
  if (field.type === 'specimens') {
    return `<div style="grid-column: span 2" class="spec" data-specimen-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}"></div>`;
  }

  /* THE THREE DERIVED PANELS. Each is a keyed field so the generic machinery
     keeps working, and each holds a READABLE form of something recorded
     elsewhere — the instrument register, the times log, the whole report.
     None carries `data-doc-field`: nothing inside them is a control, and a
     stray ui-change must not overwrite what they derive. */
  if (field.type === 'scope-record') {
    return `<div style="grid-column: span 2" data-scope-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}"></div>`;
  }

  if (field.type === 'timings') {
    return `<div style="grid-column: span 2" data-timings-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}"></div>`;
  }

  if (field.type === 'narrative') {
    return `<div style="grid-column: span 2" data-narrative-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}"></div>`;
  }

  if (field.type === 'photos') {
    return `<div style="grid-column: span 2" data-photo-host="${esc(field.key)}"
      data-testid="encv--df-${esc(field.key)}">${photosMarkup(
      field.key,
      photoStoreFor(field.key, values),
      feedNextCaptureLabel(values)
    )}</div>`;
  }

  const id = `docf-${field.key}`;
  const label = esc(field.label);
  const required = field.required ? ' required' : '';
  const span = field.span ? ' style="grid-column: span 2"' : '';
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
  const value = values[field.key] ?? '';
  const wrap = `<div${span} data-doc-field-wrap="${field.key}"${
    fieldShown(field, values) ? '' : ' hidden'
  }>`;

  if (field.type === 'select') {
    return `${wrap}<ui-select id="${id}" label="${label}"${required}
      data-doc-field="${field.key}" data-testid="encv--df-${field.key}"></ui-select></div>`;
  }
  /*
   * TYPED, OVER A LIST THAT IS VISIBLY THERE — the documents' half of the
   * control the log drawer's medication box already uses, and here for the
   * same reason: the question whose answer is usually one of a handful and
   * occasionally is not one of them at all.
   *
   * The pre-op indication is the one asking it. A <ui-select> would refuse the
   * patient whose reason for being here is not on anybody's list, and the bare
   * <ui-input> it used to be offered nothing at all — so a physician
   * correcting the booking's words retyped them, and the field the report and
   * the coder read collected a dozen spellings of three cases.
   *
   * It emits the same `ui-input`/`ui-change` pair carrying the same detail as
   * <ui-input> does, so the two delegated listeners below reach it through
   * `data-doc-field` without learning anything new about it. The options
   * cannot ride in on an attribute — see the whenDefined dance in
   * paintDocument, and setOptions' own note in js/components/ui-suggest.js.
   */
  if (field.type === 'suggest') {
    const hint = field.hint ? ` hint="${esc(field.hint)}"` : '';
    return `${wrap}<ui-suggest id="${id}" label="${label}"${required}${placeholder}${hint}
      value="${esc(value)}" data-doc-field="${field.key}"
      data-testid="encv--df-${field.key}"></ui-suggest></div>`;
  }
  /*
   * A CHOICE OF TWO OR THREE, DRAWN OUT RATHER THAN FOLDED INTO A LIST.
   *
   * The same answer a select collects, and the reason to have both is what the
   * question costs to read. A dropdown holding two options hides one of them
   * behind a press and says nothing about the shape of the decision; laid out
   * inline, the whole question — did anything go wrong, yes or no — is read
   * without touching it, which is what a document worked down at speed needs.
   *
   * Selects keep the long lists, where drawing eight destinations out would be
   * eight lines of chrome for one answer. `options` goes on as an attribute
   * rather than through a property, so a radio group needs none of the
   * whenDefined dance <ui-select> does below.
   */
  if (field.type === 'radio') {
    return `${wrap}<ui-radio-group inline id="${id}" label="${label}"
      options="${esc(field.options.join(','))}" value="${esc(value)}"
      data-doc-field="${field.key}" data-testid="encv--df-${field.key}"></ui-radio-group></div>`;
  }
  if (field.type === 'textarea') {
    return `${wrap}<ui-textarea id="${id}" label="${label}"${required} rows="3"${placeholder}
      data-doc-field="${field.key}" data-testid="encv--df-${field.key}"
      value="${esc(value)}"></ui-textarea></div>`;
  }
  /* `datetime` is spelled out to `datetime-local` on the way to the control.
     The spec says what the field IS — a moment on a calendar — and the
     platform's name for the input that collects one is an implementation
     detail the document has no business carrying. */
  const type = DOC_INPUT_TYPES[field.type] ?? 'text';
  const hint = field.hint ? ` hint="${esc(field.hint)}"` : '';
  const input = `<ui-input id="${id}" type="${type}" label="${label}"${required}${placeholder}${hint}
    value="${esc(value)}" data-doc-field="${field.key}"
    data-testid="encv--df-${field.key}"></ui-input>`;

  /*
   * A TIME THAT CAN BE STAMPED RATHER THAN TYPED.
   *
   * `now: true` on a field puts a Now beside it. The times these fields hold
   * are read off the clock at the moment the thing happens — anaesthesia
   * started, anaesthesia stopped — and a clinician with their hands on a
   * patient either types four digits one-handed or writes them on the back of
   * something and transcribes them afterwards. Both are how a sedation record
   * ends up saying 09:15 because that is a round number. The logs in step 2
   * already stamp their own time as a field DEFAULT (see nowTime in
   * js/lib/encounter-logs.js); a document is filled in over a case rather than
   * submitted at one moment, so the same clock is offered as a press instead.
   *
   * The button sits INSIDE the field's wrap, so a conditional field takes its
   * Now with it when it hides, and so the pair occupies one cell of the
   * two-column grid rather than the button drifting into the next.
   */
  if (!field.now) return `${wrap}${input}</div>`;

  return `${wrap}<div class="encv__field-now">
    ${input}
    <ui-button variant="outline" size="sm" data-doc-now="${field.key}"
      data-testid="encv--dfnow-${field.key}">Now</ui-button>
  </div></div>`;
};

/**
 * Show or hide every conditional field, after something has been answered.
 *
 * A field that goes back into hiding is EMPTIED as it goes. A description
 * typed against "Other" and then left behind when the answer changed back to
 * Normal is a sentence about an airway nobody is claiming any more — and it
 * would file, invisibly, on the signed document.
 */
function applyFieldReveals(spec, values) {
  spec.sections.forEach((section) =>
    (section.fields ?? []).forEach((field) => {
      if (!field.showWhen) return;
      const wrap = el('docBody').querySelector(`[data-doc-field-wrap="${field.key}"]`);
      if (!wrap) return;

      const show = fieldShown(field, values);
      wrap.hidden = !show;
      if (show || !String(values[field.key] ?? '').trim()) return;

      values[field.key] = '';
      /* Through setFieldValue, which writes the ATTRIBUTE AND THE CONTROL.
         `node.value = ''` alone is not enough on a field that has been typed
         into: the components mirror their value attribute, typing does not
         write it back, and UiElement skips the re-render when an attribute is
         set to what it already held — so the wrapper was told to clear a value
         it never knew about and the text stayed on screen under an answer that
         had just retracted it. */
      setFieldValue(el(`docf-${field.key}`), '');
    })
  );
}

/*
 * A paragraph with its blanks filled.
 *
 * The consent stores "{type}" rather than a spliced-in default, so a form
 * printed after the anaesthesia type changed cannot still name the old one.
 * Substituted at render, from the same values the fields above it write to.
 */
const fillProse = (text, values) =>
  esc(text).replace(/\{(\w+)\}/g, (_, key) => esc(values[key] || `[${key}]`));

/* ---------------------------------------------------------------------------
   SET DEFAULT / USE DEFAULT, PER SECTION

   A list of twelve colonoscopies discharges to the same destination, on the
   same instruction set, under the same UB-04 code, all day — and the discharge
   document made recovery re-answer all of it twelve times. The pre-procedure
   sheet solved this years ago with the same pair of buttons (see
   preCheckActionsMarkup in js/lib/pre-check-form.js); this is that pair, per
   SECTION rather than per document, because the parts of a discharge that
   repeat and the parts that do not are not the same parts. Where the patient
   is going repeats; the time they left never does.

   The pair sits in the section's own heading rather than in the document
   toolbar, so it is unambiguous which questions it is about. A single Set
   Default over a whole document would either save the discharge TIME with
   everything else, or need a rule about which fields it skips that nobody
   reading the button could see.

   SET writes what is on screen now; USE puts it back. Neither is destructive
   in a direction that cannot be undone in one press — Use over a part-worked
   section is recoverable by pressing Set again on the values that were there,
   which is why this does not ask for confirmation the way the pre-procedure
   sheet's does. That sheet's Set Default rewrites the template for EVERYBODY;
   this one is the session's own.

   Held in memory for the session, deliberately: a prototype that wrote a
   practice-wide default to a store would be claiming a persistence it does not
   have. What it demonstrates is the mechanic.
   ------------------------------------------------------------------------ */

/** Saved section defaults, keyed `<document>:<section>`. */
const sectionDefaults = {};

const sectionDefaultsMarkup = (id, section) => `<span class="encv__doc-legend-actions">
    <ui-button variant="outline" size="sm" data-set-default="${section.id}"
      data-testid="encv--set-default-${section.id}">Set as default</ui-button>
    <ui-button variant="outline" size="sm" data-use-default="${section.id}"
      ${sectionDefaults[`${id}:${section.id}`] ? '' : 'disabled'}
      data-testid="encv--use-default-${section.id}">Use as default</ui-button>
  </span>`;

/**
 * Everything one section holds, as a plain object — fields and ticks both.
 *
 * The ticks go in because a section can be nothing but ticks: Discharge
 * Criteria is eight statements and no fields, and a Set Default that saved
 * only fields would come back from it having saved nothing while reporting
 * success.
 *
 * A DERIVED tick is skipped. The Aldrete line is answered from step 2's score,
 * and a default that carried it would be a saved claim about a patient who has
 * not been scored yet.
 */
/*
 * WHAT THE PAIR ON THIS SECTION ACTUALLY COVERS.
 *
 * `defaults: true` means the whole card, which is what a section wants when
 * every answer on it repeats — the discharge destinations, the H&P's physical
 * examination. `defaults: ['asa', 'sedation']` means those two answers and
 * nothing else on the card.
 *
 * The list form exists because one card on the run is mixed. The H&P's
 * Assessment and plan holds two answers that read the same all day — the ASA
 * grade and the sedation chosen against it — beside three that are this
 * patient's alone: the indication carried off their booking, their history,
 * and the sentence saying whether THEY should be having this. A Set as default
 * over all five would save one patient's story under a button that then
 * presses it onto the next twelve, which is the one way this pair could do
 * harm rather than save time.
 *
 * Splitting the card in two was the alternative and it is worse: the judgement
 * is one thought, and a card boundary drawn where the DEFAULT button's reach
 * happens to end would be the control dictating how the note reads.
 */
const coveredByDefault = (section, key) =>
  !Array.isArray(section.defaults) || section.defaults.includes(key);

/*
 * WHAT THE ANNOUNCEMENT CALLS WHAT IT JUST SAVED.
 *
 * The section's title where the pair covers the section — "Discharge Details
 * saved as the default for this session". Where it covers only part of a card
 * the title would be a claim about answers the button did not touch, so the
 * announcement names the answers themselves instead: "ASA classification and
 * Planned sedation saved as the default for this session." The buttons sit in
 * a section heading, so a partial default is exactly the case where somebody
 * would otherwise walk away believing the whole card was saved.
 */
function defaultScopeLabel(section) {
  if (!Array.isArray(section.defaults)) return section.title;
  const labels = (section.fields ?? [])
    .filter((field) => coveredByDefault(section, field.key))
    .map((field) => field.label);
  if (!labels.length) return section.title;
  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function readSection(section, values) {
  return {
    fields: Object.fromEntries(
      (section.fields ?? [])
        .filter((field) => coveredByDefault(section, field.key))
        .map((field) => [field.key, values[field.key] ?? ''])
    ),
    checks: (section.checks ?? [])
      .filter(
        (check) =>
          !check.derived && coveredByDefault(section, check.id) && values.checks.has(check.id)
      )
      .map((check) => check.id),
  };
}

/*
 * A TICK LIST THAT IS A PICK LIST, NOT A SET OF STATEMENTS.
 *
 * Two different things wear .encv__check on this screen and they want opposite
 * layouts. One is a run of STATEMENTS somebody attests to — "Anticoagulant
 * held per protocol — apixaban, 5 days", "Patient identity confirmed against
 * two identifiers" — read down the column one line at a time, each considered
 * before it is ticked. The other is a PICK LIST: the sixteen short nouns on
 * the procedure report that say what was done and what modifies it. Set in one
 * column those sixteen cost four hundred pixels of the working column and use
 * a sixth of its width, and nothing about them is read in sequence — they are
 * scanned for the four that apply.
 *
 * So a section's ticks go multi-column when they are all SHORT, unhinted and
 * nobody's derivation, and stay a single column otherwise. Measured off the
 * content rather than flagged in data/ because the distinction is a fact about
 * the words: a 45-character clinical statement does not become scannable by
 * somebody adding `grid: true` beside it, and a two-word noun does not stop
 * being scannable by somebody forgetting to.
 */
const GRID_CHECK_MAX = 44;

/* A CODE DOES NOT DISQUALIFY A PICK LIST. The sixteen nouns on the procedure
   report each wear the CPT they are claimed under now, and a five-character
   code in front of a two-word label is still something scanned rather than
   read in sequence — it is what makes them scannable, in fact, for the reader
   who is looking for 45385 rather than for the word. `hint` still does
   disqualify one, because a hint is a second line of prose. */
const checksAreAPickList = (checks) =>
  checks.length >= 4 &&
  checks.every(
    (check) => !check.hint && !check.derived && check.label.length <= GRID_CHECK_MAX
  );

/* ---------------------------------------------------------------------------
   A PICK LIST THAT IS PICKED FROM, AND THAT CAN BE ADDED TO

   `picker` on a section that has `checks` — see the note over the two cards
   that carry it in js/lib/encounter-docs.js. Same answer as the grid of boxes
   it replaces, held in the same `values.checks`, so nothing that reads a
   document's ticks — a required check, a saved default, the foot's outstanding
   count, a print — learned anything about this.

   What changed is the shape of the question. A dropdown asks "which of these",
   which is what a coder is answering, and the answer is then written out
   underneath as the list it is rather than left as four ticks scattered
   through sixteen boxes. The picked list is not decoration: it is the complete
   statement of what this report codes for, and it is the half that prints.

   ONE BOX, NOT THREE.

   It was three: a multiple <select>, and under it a code box, a words box and
   an Add button for the procedure the practice's list does not carry. That is
   a card asking the same question — WHAT WAS DONE — in two different places
   with two different gestures, and the second of them was a small form to fill
   in, complete with its own validation and its own error message about which
   of its two boxes was compulsory.

   Both are now one <ui-suggest>: press it and the practice's list drops under
   it, type and the list narrows, type something it does not carry and that is
   the answer instead. Nothing is submitted — there is no Add, because there
   was never anything to add TO. A code typed here goes onto this report and
   nowhere else (see pickExtrasFor); the practice's catalogue is a file in
   data/ and is edited by whoever maintains it.

   The box empties on each answer and the line appears underneath, so a case
   that was four procedures is four passes at one control rather than one
   control that has to hold four answers at once and show them all in a field
   one line tall.
   ------------------------------------------------------------------------ */

/**
 * The codes this document has had TYPED onto one section, over the list the
 * practice ships.
 *
 * Per document rather than per practice, and gone when the encounter is: this
 * is one endoscopist saying what they did on one case, not an edit to the
 * catalogue. A code that ought to be on every report belongs in data/, added
 * by whoever maintains it.
 */
function pickExtrasFor(sectionId, values) {
  values.picked ??= {};
  values.picked[sectionId] ??= [];
  return values.picked[sectionId];
}

/** Everything pickable on one section: the practice's list, then what was typed. */
const pickOptionsFor = (section, values) => [
  ...(section.checks ?? []),
  ...pickExtrasFor(section.id, values),
];

/** "45385 Polypectomy" — the code first, for the reader looking for the code. */
const pickOptionLabel = (option) =>
  option.code && option.label ? `${option.code} ${option.label}` : option.label || option.code;

/**
 * What has been picked, written out.
 *
 * In the order the list carries them rather than the order they were pressed:
 * this is read as a statement of the case, and a statement whose lines move
 * about depending on which box was ticked first is one nobody can check
 * against the last report they read. An added code sits after the practice's
 * own, which is where it was added.
 */
function pickChosenMarkup(section, values) {
  const chosen = pickOptionsFor(section, values).filter((option) =>
    values.checks.has(option.id)
  );

  /* NOTHING PICKED SAYS SO BY BEING EMPTY.
     The ICD field below names its own empty state, because it sits among
     fields that are all asking something and a blank there could be a control
     that had not finished loading. This card is nothing but the box and this
     list, so a card holding one box IS the statement that nothing has been
     picked — and a sentence under it saying so again is a line to read past on
     every report that has not been started yet. */
  if (!chosen.length) return '';

  return `<ul class="encv__icd-list">
    ${chosen
      .map(
        (option) => `<li class="encv__icd-code" data-testid="encv--pick-chosen-${option.id}">
          ${option.code ? `<code>${esc(option.code)}</code>` : ''}
          <span class="encv__icd-text">${esc(option.label)}</span>
          ${/* A code the endoscopist typed is marked as one. A coder reading a
               report has to know which of these came off the practice's list
               and which is a claim somebody made up on the spot, because only
               one of the two has already been agreed with a payer. */ ''}
          ${option.typed ? '<span class="encv__pick-typed">Added</span>' : ''}
          <button type="button" class="encv__icd-drop" data-pick-drop="${esc(option.id)}"
            aria-label="Remove ${esc(pickOptionLabel(option))}"
            data-testid="encv--pick-drop-${option.id}">×</button>
        </li>`
      )
      .join('')}
  </ul>`;
}

/**
 * The control: one multi-select, one pair of boxes that adds to it, and the
 * list of what has been picked.
 *
 * The <ui-select> gets its options in mountPicker rather than from an
 * attribute — the same whenDefined dance every other select on a document
 * does, and here it is not optional either way: `options` splits on commas and
 * a procedure called "Polypectomy, cold snare" would arrive as two.
 */
function pickerMarkup(section, values) {
  return `<div class="encv__pick" data-pick-host="${esc(section.id)}"
      data-testid="encv--pick-${section.id}">
    ${/* The whole control. What has been picked is NOT shown inside it — it is
         written out underneath, where it can be read as the list a coder wants
         — so the box is empty whenever it is not being used, and its
         placeholder goes on asking the question the card is for. */ ''}
    <ui-suggest label="${esc(section.title)}" label-hidden
      placeholder="${esc(section.picker.placeholder)}"
      empty-note="${esc(section.picker.typedNote)}"
      data-pick-input data-testid="encv--pick-input-${esc(section.id)}"></ui-suggest>
    <div data-pick-chosen>${pickChosenMarkup(section, values)}</div>
  </div>`;
}

/**
 * Wire one picker: one box, into the document's ticks.
 *
 * Everything is delegated from the host, because the picked list underneath is
 * rewritten on every answer and a listener bound to a × inside it would be
 * bound to a button that no longer exists.
 */
function mountPicker(id, section, values) {
  const host = el('docBody')?.querySelector(`[data-pick-host="${section.id}"]`);
  if (!host) return;

  const extras = pickExtrasFor(section.id, values);
  const box = host.querySelector('[data-pick-input]');
  const chosen = host.querySelector('[data-pick-chosen]');

  /*
   * WHAT IS OFFERED IS WHAT IS NOT ALREADY ON THE REPORT.
   *
   * The same rule the ICD search below keeps, and for the same reason: the
   * same code twice is a coding error rather than two procedures, and a list
   * that goes on offering what has just been picked invites exactly that. A
   * line taken off with its × comes straight back into the list, which is what
   * makes the × an undo rather than a deletion.
   *
   * setOptions does not re-render the control — see js/components/ui-suggest.js
   * — so this is safe to call while somebody is typing into it.
   */
  const paintOptions = () =>
    customElements.whenDefined('ui-suggest').then(() =>
      box.setOptions(
        pickOptionsFor(section, values)
          .filter((option) => !values.checks.has(option.id))
          .map(pickOptionLabel)
      )
    );

  const commit = () => {
    chosen.innerHTML = pickChosenMarkup(section, values);
    paintDocFoot(id);
  };

  /*
   * ONE ANSWER, HOWEVER IT ARRIVED.
   *
   * A row pressed in the panel, Enter on a row the typing had narrowed to, a
   * code typed straight past the list and left there — all three reach this
   * with a string, and all three mean the same thing: this was done, put it on
   * the report. There is nothing to press afterwards.
   *
   * WHAT THE STRING IS SPLIT INTO. A code and what it is called are two facts,
   * and the two boxes this replaced existed to keep them apart. One box can
   * still do it, because a code has no spaces in it and the words always do:
   * the first token is the code, the rest is the label. "45391 Endoscopic
   * ultrasound" lands as a code and a name; "45391" alone lands as a code with
   * no name, which is the coder who knows the number and not the practice's
   * word for it, and was always allowed.
   *
   * A CODE THAT IS ALREADY ON THE LIST IS NOT A NEW ONE. Typed or picked, an
   * entry whose code the practice already ships ticks the practice's row — one
   * line, one spelling, one thing for a coder to read — and an entry matching
   * one already typed onto this report ticks that, rather than stacking a
   * second copy of it underneath.
   */
  const take = (text) => {
    const entry = String(text ?? '').trim();
    /* Cleared FIRST, so the ui-change that blur fires on a box this has just
       emptied finds nothing to do, and so the caret is back at the start of an
       empty field for the next procedure. The panel goes with it: this answer
       is finished, and a list left open would sit over the line it has just
       written underneath. The cursor stays, because the next procedure is
       typed into the same box. */
    setFieldValue(box, '');
    box.close?.();
    if (!entry) return;

    const [, code, label] = entry.match(/^(\S+)\s*(.*)$/) ?? [, entry, ''];
    const known = pickOptionsFor(section, values).find(
      (option) =>
        pickOptionLabel(option).toLowerCase() === entry.toLowerCase() ||
        (option.code ?? '').toLowerCase() === code.toLowerCase()
    );

    if (known) {
      /*
       * QUIETLY, EXCEPT WHERE NOTHING WOULD OTHERWISE HAPPEN.
       *
       * A picked row writes itself into the list underneath, in front of the
       * person who picked it — announcing that as well would put a toast over
       * the card for every procedure on a four-procedure case, which is five
       * notifications reporting what the page already shows. The one case that
       * needs saying is the code that was already on the report: the box
       * empties, the list does not change, and without a word that reads as a
       * control that swallowed an answer.
       */
      const already = values.checks.has(known.id);
      values.checks.add(known.id);
      if (already) say(`${pickOptionLabel(known)} is already on this report.`);
    } else {
      const option = {
        id: `${section.id}-typed-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        code,
        label,
        typed: true,
      };
      extras.push(option);
      values.checks.add(option.id);
      /* This one is said out loud. The panel had just told them the practice's
         list does not carry it, and the difference between "not on the list,
         so recorded as typed" and "not on the list, so refused" is the whole
         reason a code can be typed here at all. */
      say(`${entry} added to ${section.title.toLowerCase()} as typed.`);
    }

    paintOptions();
    commit();
  };

  paintOptions();

  /* The control commits on a pick, on Enter over a row it had narrowed to, and
     on leaving a box with something in it — see the header of
     js/components/ui-suggest.js. All three are somebody saying what was done. */
  host.addEventListener('ui-change', (event) => {
    if (!event.target.closest('[data-pick-input]')) return;
    take(event.detail.value);
  });

  /*
   * AND ENTER ON A BOX THAT MATCHED NOTHING.
   *
   * The control leaves that keystroke alone on purpose — Enter on a field
   * whose answer is typed belongs to the form around it, not to the picker —
   * which would mean the twelfth procedure was recorded only by clicking away
   * from the box afterwards. Here the form IS this card, so Enter takes it.
   *
   * `aria-activedescendant` is how the control says it has a row highlighted:
   * where it has one, it has already handled the key and committed through
   * ui-change above, and `take` has emptied the box — so this runs, finds
   * nothing, and does nothing.
   */
  host.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest('.ui-suggest__input');
    if (!input || input.getAttribute('aria-activedescendant')) return;
    event.preventDefault();
    take(input.value);
  });

  host.addEventListener('click', (event) => {
    const drop = event.target.closest('[data-pick-drop]');
    if (!drop) return;
    values.checks.delete(drop.dataset.pickDrop);
    /* A typed code goes back into the list rather than out of existence: the
       endoscopist who takes one off by mistake picks it again instead of
       retyping it, and the × means the same thing on every line of the card
       whether the practice ships that code or somebody typed it. */
    paintOptions();
    commit();
  });
}

function docSectionMarkup(section, values, id) {
  const checkClass = `encv__checks${
    checksAreAPickList(section.checks ?? []) ? ' encv__checks--pick' : ''
  }`;
  const checks = (section.checks ?? [])
    .map(
      (check) => `<label class="encv__check${
        check.derived ? ' encv__check--derived' : ''
      }">
        <input type="checkbox" class="ui-choice__input" data-doc-check="${check.id}"
          ${values.checks.has(check.id) ? 'checked' : ''}
          ${check.derived ? 'disabled' : ''}
          data-testid="encv--dc-${check.id}">
        <span class="ui-choice__box">
          ${iconMarkup('check-bold', 'ui-icon ui-choice__mark')}
        </span>
        <span class="encv__check-text">${/* The statement and its marker are ONE
          flex item. .encv__check-text stacks its children, so an asterisk left
          as a sibling of the label would drop to the line below and read as a
          footnote to the statement rather than as part of it. */ ''}<span>${
            /* The code the tick is claimed under, where the list carries one —
               the CPT on Procedures performed, the two digits on Modifiers.
               In front of the words rather than after them, because a column
               of codes down the left of the grid is what a coder reads; the
               same codes trailing each label would be sixteen different
               distances from the edge and could not be scanned at all. */
            check.code
              ? `<code class="encv__check-code">${esc(check.code)}</code> `
              : ''
          }${esc(check.label)}${
            /* The same asterisk a required field wears, in the same red, so a
               statement the document will not be signed without is marked as
               one thing on the page rather than by two conventions. */
            check.required
              ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
              : ''
          }</span>${
          check.hint ? `<span class="encv__check-hint">${esc(check.hint)}</span>` : ''
        }</span>
      </label>`
    )
    .join('');

/*
 * WHAT THE PATIENT ALREADY HAS, ON THE DOCUMENT THAT DECIDES WHETHER TO SEDATE.
 *
 * A pre-op H&P that asks for an airway, an ASA grade and an indication, and
 * says nothing about what the patient is already carrying, asks the physician
 * to grade them from memory or from another screen. These four rows are the
 * four that get asked every time: what the patient has, what has already been
 * done to them, what they react to, and what they take.
 *
 * IT IS THE RAIL'S OWN LIST, NOT A SECOND COPY OF IT.
 * Every row is read from CLINICAL_SECTIONS (data/encounter.js) — the same four
 * sections the Clinical data rail shows on the right of this very screen. Two
 * lists of a patient's allergies is two answers to the question the propofol
 * depends on, so there is one list, quoted twice.
 *
 * READ-ONLY for the same reason. A history corrected on one morning's H&P and
 * not in the record is a correction the next clinician never sees.
 *
 * `critical` carries across. The rail marks the allergy that is anaphylactic
 * and the medication that is flagged; dropping that mark on the way here would
 * make the H&P the quieter of two views of one fact, and the H&P is the one
 * being signed.
 */
const HISTORY_ROWS = [
  { id: 'history', label: 'Medical history' },
  { id: 'surgical', label: 'Surgical history' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'medications', label: 'Current Medications' },
];

function historyRowMarkup(label, items) {
  /* A row with nothing behind it says so in words rather than going blank. A
     blank beside "Allergies", on the sheet somebody is about to give propofol
     from, reads as "none" — and none is a positive statement no record here
     has made. */
  const body = items.length
    ? `<ul class="encv__history-list">${items
        .map(
          (item) => `<li${item.critical ? ' class="encv__history-flag"' : ''}>
            <span class="encv__history-text">${esc(item.text)}</span>
            ${item.meta ? `<span class="encv__history-meta">${esc(item.meta)}</span>` : ''}
          </li>`
        )
        .join('')}</ul>`
    : `<span class="encv__history-empty">Nothing recorded — see the Clinical data rail</span>`;

  return `<div class="encv__history-row"><dt>${esc(label)}</dt><dd>${body}</dd></div>`;
}

/**
 * WHO THIS IS, ON THE DOCUMENT RATHER THAN AROUND IT.
 *
 * Check-out's own card — see the note over the section in
 * js/lib/encounter-docs.js for why the desk is the one step in the run that
 * needs it. Six facts: who the patient is, what was done to them, by whom and
 * when.
 *
 * EVERY ONE OF THEM IS QUOTED, NOT ASKED. The patient comes off the booking's
 * MRN, the procedure off the booking, the endoscopist off the provider on it —
 * the same three derivations the header and the left rail already make, called
 * through the same helpers rather than re-derived here. A counter that could
 * type over any of these could file a check-out against a different patient
 * from the one the rest of the encounter is about.
 *
 * Two facts to a row on the wide screen and one on a narrow one, which is the
 * .encv__history grid it borrows: these are read in pairs — the name with the
 * number that identifies it, the procedure with who did it — rather than as
 * six independent lines.
 */
function patientOverviewMarkup() {
  const rows = [
    ['Patient', patient.name],
    ['MRN', patient.mrn],
    [
      'Date of birth',
      `${patient.dob} (${patient.age} yrs, ${patient.sex === 'M' ? 'Male' : 'Female'})`,
    ],
    ['Procedure', procedureLabel()],
    ['Endoscopist', providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist],
    /* A booking opened bare has no date to show, and today's is not it: an
       encounter with no appointment behind it is the demo fallback, and a date
       invented for it would be the one fact on this card that was made up. */
    ['Date of procedure', appointment ? shortDate(appointment.date) : '—'],
  ];

  return `<dl class="encv__overview" data-testid="encv--patient-overview">
    ${rows
      .map(
        ([term, value]) =>
          `<div class="encv__overview-row"><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`
      )
      .join('')}
  </dl>`;
}

function patientHistoryMarkup() {
  return `<dl class="encv__history" data-testid="encv--patient-history">
    ${HISTORY_ROWS.map((row) =>
      historyRowMarkup(row.label, CLINICAL_SECTIONS.find((s) => s.id === row.id)?.items || [])
    ).join('')}
  </dl>`;
}

  /* A section that declares `picker` asks for the same ticks through a
     dropdown instead of drawing them as boxes — see pickerMarkup. The switch is
     over how the list is ASKED for, not over what is stored, so everything
     above and below that reads `section.checks` is untouched by it. */
  const ticks = section.picker
    ? pickerMarkup(section, values)
    : checks && `<div class="${checkClass}">${checks}</div>`;

  /* `data-section` carries the spec's own id onto the element. The testid
     already spells it, and something that is not a test must not be pinned to
     a test hook: the live feed reaches for the Findings card by name to swap
     its instruction while a feed is beside it (see markFeedOnFindings), and
     which card that is is a fact about the document rather than about how it
     is tested. */
  return `<section class="encv__doc-section"
    data-section="${esc(section.id)}" data-testid="encv--section-${section.id}">
    <h3 class="encv__doc-legend">${esc(section.title)}
      ${/* a host the section's own mount fills — the specimen count and
           its controls, on the title's line. Absent from every other
           section. */ ''}
      ${section.headSlot ? '<span class="spec__legend-slot" data-head-slot></span>' : ''}
      ${section.defaults ? sectionDefaultsMarkup(id, section) : ''}
    </h3>
    <div class="encv__doc-section-body">
      ${section.note ? `<p class="encv__doc-note">${esc(section.note)}</p>` : ''}
      ${section.overview ? patientOverviewMarkup() : ''}
      ${section.history ? patientHistoryMarkup() : ''}
      ${
        section.prose
          ? `<div class="encv__prose">${section.prose
              .map((text) => `<p>${fillProse(text, values)}</p>`)
              .join('')}</div>`
          : ''
      }
      ${section.checksAfter ? '' : ticks}
      ${
        section.fields
          ? `<div class="encv__doc-grid">${section.fields
              .map((field) => docFieldMarkup(field, values))
              .join('')}</div>`
          : ''
      }
      ${/* `checksAfter` on a section whose ticks are the JUDGEMENT made from
           the fields above them, rather than questions to answer before them.
           The pre-anaesthesia assessment is the case it exists for: the airway
           findings, then the statements read off them. */ ''}
      ${section.checksAfter ? ticks : ''}
      ${section.log ? docLogMarkup(section.log) : ''}
      ${
        section.signature
          ? `<div data-sign-host="${id}:${section.id}"
              data-sig-who="${section.signature.who}"
              data-testid="encv--sig-${section.signature.who}-${section.id}"></div>`
          : ''
      }
    </div>
  </section>`;
}

/* ---------------------------------------------------------------------------
   A LOG DRAWN INSIDE A DOCUMENT

   One section on one document has this, and it is meant to stay roughly that
   size: the anaesthesia order set, on the pre-op assessment it is chosen
   against and under the same signature (see 'anaes-preop' in
   js/lib/encounter-docs.js). It is a table by nature — a run of entries, each
   added, each stamped — so describing it as document fields would have meant
   re-declaring the order set as a form, and two vocabularies for the drugs one
   sedation plan may call on is one too many.

   So the log is drawn where it is declared: the same columns, the same rows in
   `logRows`, the same add/edit drawer. What it does NOT get is the log page's
   chrome — the search box, the filters, the stats cards, the toolbar Add at the
   top of the working column. A page's chrome belongs to a page; inside a
   document this is a card among cards, with one button under it.
   ------------------------------------------------------------------------ */

/**
 * WHERE THE OPEN DOCUMENT'S LOG IS, IF IT HAS ONE.
 *
 * The add/edit drawer and the row confirm both end by repainting "the log" —
 * and until now there was only one thing that could mean, because a log was
 * always a step of its own. Now it may be a card halfway down a document, and
 * repainting it as a page would swap the assessment out from under somebody
 * who had just added an order to it. See repaintLog.
 */
let docLogHost = null;

function docLogMarkup(logId) {
  const spec = ENCOUNTER_LOGS[logId];
  return `<div class="encv__doc-log" data-doc-log="${logId}">
    <ui-data-table id="docLogTable-${logId}" sticky-first density="compact"
      empty-text="${esc(spec.empty)}"
      data-testid="encv--doc-log-table-${logId}"></ui-data-table>
    <div class="encv__doc-log-actions">
      <ui-button variant="outline" size="sm" icon="plus" id="docLogAdd-${logId}"
        data-testid="encv--doc-log-add-${logId}">${esc(spec.addLabel)}</ui-button>
    </div>
  </div>`;
}

/**
 * Fill the table in. Data only — the markup above is painted with the document
 * and stays put, so this can be called again after a row lands without taking
 * the section's signature pad or half-typed fields with it.
 */
function paintDocLog(logId) {
  const spec = ENCOUNTER_LOGS[logId];
  const table = el(`docLogTable-${logId}`);
  if (!table) return;

  /* `_i` is the row's index in the log, carried because the pencil acts on the
     entry it is drawn beside — the same contract paintLog's tables have. */
  const rows = logRows[logId].map((row, i) => ({ ...row, _i: i }));
  table.columns = tableColumns(spec, logId);
  table.rows = rows;
  table.rowClass = (row) => (row.high ? 'encv__log-row--flagged' : '');
  table.setAttribute('state', rows.length ? 'ready' : 'empty');
}

/** Add and Edit, bound once per document paint — see paintLog's rowAction. */
function wireDocLog(docId, logId) {
  el(`docLogAdd-${logId}`)?.addEventListener('ui-click', () => openLogDrawer(logId));

  /* Delegated on the table, because <ui-data-table> rebuilds its own tbody
     every time the rows are set and per-button listeners would be left on
     nodes it has already thrown away. */
  el(`docLogTable-${logId}`)?.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-row]');
    if (edit) openLogDrawer(logId, Number(edit.dataset.editRow));
  });
}

/**
 * Repaint whichever drawing of a log is actually on screen.
 *
 * The drawer and the row confirm both call this rather than paintLog, because
 * the same log can be a page on one step and a card on a document — and
 * repainting the wrong one either does nothing or replaces a document somebody
 * is part-way through with a table.
 */
function repaintLog(logId) {
  if (docLogHost && docLogHost.logId === logId) {
    paintDocLog(logId);
    /* The document's foot counts an empty order set as outstanding, so it is
       re-read with the table rather than left saying what was true before the
       row landed. */
    paintDocFoot(docLogHost.docId);
    return;
  }
  paintLog(paintedLogId ?? logId);
}

/**
 * Bind one diagram field, and repaint only itself when a finding changes.
 *
 * Repainting the whole document would be one line shorter and would throw away
 * every uncommitted keystroke around it — the indication, the impression, the
 * specimen list are all textareas being worked in the same sitting. Recording
 * a polyp must not cost the sentence somebody was halfway through.
 *
 * It re-mounts itself after each repaint because the markup it just replaced
 * carried the listeners. The store is the same object across all of it, so the
 * drawer opened from the old markup keeps working while it is open.
 */
function mountDiagram(id, field, values) {
  const config = DIAGRAMS[field.diagram];
  const host = el('docBody')?.querySelector(`[data-diagram-host="${field.key}"]`);
  if (!config || !host) return;

  const store = diagramStoreFor(field.key, values);

  wireFindings({
    root: host,
    drawer: el('findingsDrawer'),
    store,
    config,
    repaint: () => {
      host.innerHTML = findingsHtml(store, config);
      mountDiagram(id, field, values);
      /* the jars are drawn onto whatever the renderer just produced. */
      markSpecimensOnDiagram(values);
      /* and so is the capture target, for the same reason and in the same
         place — the renderer has just replaced every row the marks were on. */
      markFeedOnFindings(values);
    },
    /* The document's answer for this field is the prose, regenerated from the
       structure every time the structure changes. Nothing writes it by hand,
       so the two can never disagree. The foot is re-read because `findings` is
       a REQUIRED field and the first one recorded is what stops the report
       being outstanding. */
    commit: () => {
      values[field.key] = narrateFindings(store.findings, config);
      paintDocFoot(id);
      /* a finding is what a jar is labelled with, so the table under the
         diagram follows every change to it — including a deletion, which
         leaves its jar behind saying so rather than taking the only record of
         some tissue with it. See siteOf in js/lib/specimen-table.js. */
      repaintSpecimens(id, values);

      /* and a finding is what a capture is filed against, so the aim
         follows the list too. Recording a finding while the feed is running
         moves the aim onto it — the endoscopist has just described the thing
         they are looking at, and the next press of the pedal is a picture of
         it. See ensureFeedTarget, which only ever fills a hole. */
      ensureFeedTarget(values);
      markFeedOnFindings(values);
      feedPanel?.paintTarget();
      repaintPhotos(id, values);
      /* and the note, whose Findings paragraph IS this list. */
      repaintDerived(id, values);
    },
  });

  /* the offer on a finding whose tissue has nowhere to go. It opens the
     same dialog as everything else, already linked to that finding and with the
     technique and size read off it — so the commonest path is four answers
     already filled in and one press. */
  if (host.dataset.specOfferWired !== 'yes') {
    host.dataset.specOfferWired = 'yes';
    host.addEventListener('click', (event) => {
      const offer = event.target.closest('[data-spec-offer]');
      if (!offer) return;
      const finding = store.findings.find((entry) => entry.id === offer.dataset.specOffer);
      if (finding) openJarDialog(id, values, { finding, trigger: offer });
    });
  }

  /* and the press that aims the feed at a finding. Delegated from the same
     host and guarded the same way, because the rows it is on are rebuilt every
     time anything about the findings changes. */
  if (host.dataset.feedAimWired !== 'yes') {
    host.dataset.feedAimWired = 'yes';
    host.addEventListener('click', (event) => {
      const aim = event.target.closest('[data-feed-aim]');
      if (aim) aimFeedAt(id, values, aim.dataset.feedAim);
    });
  }

  markSpecimensOnDiagram(values);
  markFeedOnFindings(values);
}

/* ---------------------------------------------------------------------------
   THE SPECIMENS

   `type: 'specimens'` on a document field. The table, the dialog that fills it
   and the whole argument for their shape are in js/lib/specimen-table.js; what
   lives here is everything that needs to know which case is open — the findings
   the jars link to, the patient whose name goes on the label, and the document
   foot that counts what is outstanding.
   ------------------------------------------------------------------------ */

/**
 * The findings the jars can be taken off, and the anatomy they are described in.
 *
 * Read live off the diagram's own store rather than copied when the section is
 * drawn: a finding recorded after the specimen table was painted must be
 * offerable as a jar without the report being reopened.
 */
function specimenContext(values) {
  const config = DIAGRAMS.colon;
  return {
    findings: diagramStoreFor('findings', values).findings,
    segments: config.segments,
    types: config.types,
  };
}

/** Everything a label and a requisition say about the case they came off. */
function specimenHeader(values) {
  return {
    patient: patient?.name ?? 'Unknown patient',
    mrn: patient?.mrn ?? '—',
    dob: patient?.dob ?? '—',
    date: shortDate(appointment?.date) || shortDate(new Date().toISOString()),
    endoscopist: REPORT_STAFF.endoscopist,
    procedure: procedureLabel(),
    indication: values.indication ?? '',
  };
}

/**
 * The dialog, mounted once on <body> and kept there.
 *
 * NOT inside the document, which is replaced wholesale every time a step is
 * opened — a dialog that lived in there would be torn out from under itself the
 * moment anything repainted, and <ui-modal> reads its content once on connect,
 * so a second copy per paint would be a second focus trap per paint too.
 */
function specimenDialog() {
  let modal = document.getElementById('specimenModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', specimenDialogHtml());
    modal = document.getElementById('specimenModal');
  }
  return modal;
}

/**
 * Open the jar dialog, and put back whatever it saved.
 *
 * One way in for all three routes — the card's Add biopsy, the prompt on a
 * finding, and a row's pencil — because they are one question: what is in this
 * pot, and which finding did it come off.
 */
function openJarDialog(id, values, { jar = null, finding = null, trigger = null } = {}) {
  openSpecimenDialog({
    modal: specimenDialog(),
    store: specimenStoreFor(values),
    ctx: specimenContext(values),
    jar,
    finding,
    trigger,
    announce: say,
    onSave: (saved, edited) => {
      repaintSpecimens(id, values);
      markSpecimensOnDiagram(values);
      /* the note's Specimens paragraph is read off the jars. */
      repaintDerived(id, values);
      say(
        edited
          ? `Jar ${saved.jar} updated.`
          : `Jar ${saved.jar} labelled — and on the requisition when it builds.`
      );
    },
  });
}

function mountSpecimenField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-specimen-host="${field.key}"]`);
  if (!host) return;

  const store = specimenStoreFor(values);

  /* The card, from its heading down: the count and controls sit in the slot in
     the <h3> and the table fills the body, so both are repainted together and
     cannot disagree about how many jars there are. */
  const section = host.closest('.encv__doc-section');
  const slot = section?.querySelector('[data-head-slot]');

  const paint = () => {
    host.innerHTML = specimensHtml(store, specimenContext(values));
    if (slot) slot.innerHTML = specimensHeadHtml(store);
    /* The diagram wears the jars too — see markSpecimensOnDiagram for why the
       marks are put on rather than drawn by the renderer. */
    markSpecimensOnDiagram(values);
  };

  /* The document's answer is the sentence, regenerated from the jars. Nothing
     writes it by hand, so the two cannot disagree. */
  const commit = () => {
    values[field.key] = describeSpecimens(store);
    paintDocFoot(id);
  };

  paint();

  /* Built now rather than on the first press. It costs nothing to have an
     unopened dialog on the page, and creating one inside a click handler means
     the first Add biopsy of a case is the one press that has to build a focus
     trap before it can answer. */
  specimenDialog();

  /* Delegated from the host and bound once per paint of the document: every row
     is rebuilt whenever any of them changes, and a listener bound to a row is
     bound to a row that stops existing. */
  /* Bound to the SECTION, not to the body of it: the three controls are in the
     heading now and the rows are below it, and one listener over both is what
     keeps "add a jar" and "delete a jar" on the same path. */
  const root = section ?? host;
  if (root.dataset.specWired !== 'yes') {
    root.dataset.specWired = 'yes';
    root.addEventListener('click', (event) => {
      const jarOf = (node) => {
        const jarId = node.closest('[data-jar]')?.dataset.jar;
        return store.jars.find((entry) => entry.id === jarId) ?? null;
      };

      const edit = event.target.closest('[data-jar-edit]');
      if (edit) {
        openJarDialog(id, values, { jar: jarOf(edit), trigger: edit });
        return;
      }

      const drop = event.target.closest('[data-jar-drop]');
      if (drop) {
        const jar = jarOf(drop);
        if (!jar) return;
        store.jars = store.jars.filter((entry) => entry.id !== jar.id);
        commit();
        paint();
        say(`Jar ${jar.jar} removed. Jar numbers already given out are not reused.`);
        return;
      }

      const add = event.target.closest('[data-spec-add]');
      if (add) {
        openJarDialog(id, values, { trigger: add });
        return;
      }

      const labels = event.target.closest('[data-spec-labels]');
      const requisition = event.target.closest('[data-spec-requisition]');
      if (!labels && !requisition) return;

      /* Printing is the host's job rather than the table's: the table knows
         what a label says, this knows how this prototype hands paper over.
         Both refuse an empty run rather than printing a sheet with nothing on
         it. */
      if (!store.jars.length) {
        say('No specimens to print yet — open a jar on a finding first.');
        return;
      }

      const ctx = specimenContext(values);
      const header = specimenHeader(values);

      if (labels) {
        say(`Printing labels for ${store.jars.length} jar${store.jars.length === 1 ? '' : 's'}.`);
        printAsPdf({ markup: jarLabelsMarkup(store, ctx, header) });
        return;
      }

      /* A requisition is the handover. Every jar on it has left the room with
         it, which is what `sent` means — see SPECIMEN_STATUSES for why the
         journey stops being modelled at that point. */
      store.jars.forEach((jar) => {
        jar.status = 'sent';
      });
      commit();
      say('Requisition built from the specimen table.');
      printAsPdf({ markup: requisitionMarkup(store, ctx, header) });
      paint();
    });
  }

  commit();
}

/**
 * Redraw the specimen table after something else changed what it says.
 *
 * Goes through the same mount the painter uses rather than reaching into the
 * markup: one way to draw it, whoever asked.
 */
function repaintSpecimens(id, values) {
  const field = ENCOUNTER_DOCS[id]?.sections
    ?.flatMap((section) => section.fields ?? [])
    .find((entry) => entry.type === 'specimens');
  if (field) mountSpecimenField(id, field, values);
}

/**
 * THE JARS, ON THE DIAGRAM AND ON THE RECORDED FINDINGS.
 *
 * Put on after the fact rather than drawn by js/lib/segment-findings.js, and
 * the reason is the same one that keeps v1 untouched: that renderer is shared
 * with the screen this one is being compared against, and a specimen mark
 * taught to the renderer would appear on v1's diagram too.
 *
 * So the marks are applied to what the renderer produced. Every repaint of the
 * findings runs through here again — see the `repaint` handed to wireFindings
 * in mountDiagram — so a jar opened, moved or dropped is on the picture within
 * the same frame as it is in the table.
 */
function markSpecimensOnDiagram(values) {
  const host = el('docBody')?.querySelector('[data-diagram-host="findings"]');
  if (!host) return;

  const store = specimenStoreFor(values);
  const ctx = specimenContext(values);

  /* The recorded findings list: a jar chip on the ones that have a jar, and an
     offer on the ones whose tissue is otherwise unaccounted for. */
  host.querySelectorAll('.segf__item').forEach((item) => {
    const finding = ctx.findings.find((entry) => entry.id === item.dataset.finding);
    if (!finding) return;

    item.querySelector('.spec__chip, .spec__offer')?.remove();
    const jar = jarForFinding(store, finding.id);
    const body = item.querySelector('.segf__item-body');
    if (!body) return;

    if (jar) {
      body.insertAdjacentHTML(
        'beforeend',
        `<span class="spec__chip" data-testid="encv--spec-chip-${jar.id}">Jar ${jar.jar}</span>`
      );
      return;
    }

    /* Only findings that actually produced tissue are asked about. An offer on
       a graded haemorrhoid would train the endoscopist to ignore the offer,
       which is the one thing it cannot afford — see tookTissue. */
    if (!tookTissue(finding)) return;
    body.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="spec__offer" data-spec-offer="${finding.id}"
        data-testid="encv--spec-offer-${finding.id}">+ Add biopsy</button>`
    );
  });

  /* And the segments themselves. A hotspot holding tissue is marked so that the
     picture answers "what left the room, and from where" on its own — which is
     the question asked at the end of a case, out loud, before the patient is
     moved. */
  const marked = new Set(
    store.jars
      .map((jar) => ctx.findings.find((finding) => finding.id === jar.findingId)?.segment)
      .filter(Boolean)
  );
  host.querySelectorAll('.segf__hotspot').forEach((hotspot) => {
    hotspot.classList.toggle('segf__hotspot--specimen', marked.has(hotspot.dataset.openSegment));
  });

  const legend = host.querySelector('.segf__legend');
  if (legend && !legend.querySelector('.spec__legend')) {
    legend.insertAdjacentHTML(
      'beforeend',
      '<span class="spec__legend"><span class="segf__swatch spec__swatch"></span> Specimen taken</span>'
    );
  }
}

/* ---------------------------------------------------------------------------
   THE LIVE FEED

   `type: 'feed'` on a document field. The panel itself — the drawn lumen, the
   pedal, the control bar, the frames it hands back — is js/lib/scope-feed.js
   and knows nothing about this case. What lives here is everything that only
   makes sense on a procedure report:

     WHEN it may be opened      the gate on step 3's signatures
     WHERE a capture goes       the photo card, as a still with a time on it
     WHAT it is about           the finding the endoscopist has selected
     WHAT ELSE a press can do   + Biopsy opens the jar dialog on that finding

   THE FEED IS NOT AN ANSWER. Its field holds nothing, it is never required,
   and closing it changes no part of the document. What it produces — captures
   and jars — is the record, and every one of those is a thing the report could
   already hold. A panel that had become load-bearing on the way to a signature
   would be a report that cannot be written for a patient whose stack was down.
   ------------------------------------------------------------------------ */

/**
 * The state of the feed, on the document's own answers.
 *
 * Under `liveFeed` rather than on the `feed` field for the reason the jars are
 * under `specimenJars`: every keyed field is seeded with an empty string when
 * the document is first opened, so a store kept under the field's own name
 * would find a string sitting there and leave it alone.
 *
 * It survives leaving the document, which is deliberate. The case does not
 * stop because somebody opened the nursing record to chart a set of obs, and a
 * feed that closed itself when they did would have to be restarted — with a
 * new clock, and with whatever was on screen in the meantime lost.
 */
function feedStoreFor(values) {
  values.liveFeed ??= {
    on: false,
    startedAt: null,
    frozen: false,
    /* Which finding the next capture files against. Null is a legitimate
       state: the landmark shots at the start of a withdrawal are taken before
       anything has been found. */
    findingId: null,
    /* Whether that choice was made by hand. Until it is, the aim FOLLOWS the
       most recently recorded finding — see ensureFeedTarget. */
    pinned: false,
    captures: 0,
    clips: 0,
  };
  return values.liveFeed;
}

/** The live panel, while there is one. One per page — there is one monitor. */
let feedPanel = null;

function stopFeedPanel() {
  feedPanel?.destroy();
  feedPanel = null;
}

/** What the scope's own header calls this case. */
const feedCaseRef = () => (patient?.mrn ? `MRN ${patient.mrn}` : '');

/**
 * WHAT THE CASE IS STILL WAITING FOR, OR NULL IF IT IS READY.
 *
 * The scope does not go in until the patient is asleep, and nobody is put to
 * sleep until the anaesthesia professional has assessed them and signed to say
 * so. This is that rule, as a sentence — shown on the panel and said once when
 * it opens. It used to be a veto; see startFeed for why reporting it turned
 * out to be the honest instrument and refusing was not. See FEED_GATE_STEP.
 *
 * `docValues` is read directly rather than through valuesFor: asking for a
 * document's answers CREATES them, and a gate that seeded two anaesthesia
 * documents as a side effect of being checked would be a gate with opinions.
 * A document nobody has opened has no signature, which is the right answer.
 */
function feedGateReason() {
  const step = stepById(FEED_GATE_STEP);
  if (!step) return null;

  const outstanding = step.substeps.filter((sub) => {
    const spec = ENCOUNTER_DOCS[sub.id];
    if (!spec) return false;
    const marks = docValues[sub.id]?.signature ?? {};
    return spec.sections
      .filter((section) => section.signature)
      .some((section) => !marks[section.signature.who]);
  });

  if (!outstanding.length) return null;
  return `${step.label} is not signed yet — ${outstanding
    .map((sub) => sub.label)
    .join(' and ')} still to sign. The feed is open for set-up; the scope does not go in until it is.`;
}

/* ===== What a capture is about ===== */

/** The findings on the report, read live off the diagram's own store. */
const feedFindings = (values) => diagramStoreFor('findings', values).findings;

/** The finding the next capture files against, or null. */
function feedTarget(values) {
  const { findingId } = feedStoreFor(values);
  return feedFindings(values).find((finding) => finding.id === findingId) ?? null;
}

/**
 * WHERE THE AIM GOES WHEN NOBODY HAS AIMED IT.
 *
 * At the most recently recorded finding, and it moves as the list grows. The
 * endoscopist describes what they are looking at while they are looking at it,
 * so the newest finding is a very good guess at what the next capture is a
 * picture of — and a feature that made every capture cost an extra press on a
 * list three cards away is a feature that gets used for the first polyp and
 * abandoned for the rest of the case.
 *
 * Once the aim IS set by hand it stays where it was put (`pinned`), because
 * the reason to press "capture here" on an older finding is that you have gone
 * back to it and want the next three shots filed there.
 *
 * A pinned finding that is then DELETED unpins: the choice it recorded is
 * gone, so the guess takes over again rather than the aim silently pointing at
 * nothing.
 */
function ensureFeedTarget(values) {
  const feed = feedStoreFor(values);
  const findings = feedFindings(values);
  const stands = feed.findingId && findings.some((finding) => finding.id === feed.findingId);
  if (feed.pinned && stands) return;
  if (feed.pinned) feed.pinned = false;
  feed.findingId = findings.length ? findings[findings.length - 1].id : null;
}

/**
 * The size recorded on a finding, whichever of the three shapes it is in.
 *
 * The finding forms ask for size as a range of millimetres, as a single
 * number, or as small/medium/large, because each reads naturally in its own
 * form — see data/colon-findings.js. The measurement box has to print one
 * string, so this is the one place the three become one, and an unrecorded
 * size is an empty string rather than a guess.
 */
function feedSizeText(finding) {
  const size = finding?.values?.size;
  if (!size) return '';
  if (typeof size === 'object') {
    const { from, to } = size;
    if (!from && !to) return '';
    return from && to ? `${from}–${to} mm` : `${from || to} mm`;
  }
  return /^\d/.test(String(size)) ? `${size} mm` : String(size);
}

/** The type of a finding, in the words the report uses for it. */
function feedTypeLabel(finding) {
  const config = DIAGRAMS.colon;
  return config.types.find((type) => type.id === finding.type)?.label ?? finding.type;
}

/** The segment a finding is in, in the words the diagram labels it with. */
function feedSegmentLabel(finding) {
  const config = DIAGRAMS.colon;
  return (
    config.segments.find((segment) => segment.id === finding.segment)?.label ?? finding.segment
  );
}

/** What the box over the lesion says, or null for no box. */
function feedTargetLabel(values) {
  const finding = feedTarget(values);
  if (!finding) return null;
  const size = feedSizeText(finding);
  return { label: [size, feedTypeLabel(finding)].filter(Boolean).join(' · ') };
}

/**
 * What a capture is titled on the photo card.
 *
 * The segment and the type, which is the caption a later reader wants: "a
 * polyp in the ascending colon" is what they are looking through the strip
 * for. A capture with no finding selected is a landmark shot and is titled as
 * one — the caecum and the ileocaecal valve are photographed to prove the scope
 * got there, not because anything was found.
 */
function feedCaptureName(finding, isClip) {
  if (finding) return `${feedSegmentLabel(finding)} · ${feedTypeLabel(finding)}`;
  return isClip ? 'Clip — no finding selected' : 'Landmark';
}

/** The line the photo card's dashed tile prints, or null when nothing is live. */
function feedNextCaptureLabel(values) {
  const feed = feedStoreFor(values);
  if (!feed.on) return null;
  const finding = feedTarget(values);
  return finding
    ? `${feedSegmentLabel(finding)} · ${feedTypeLabel(finding)}`
    : 'landmark — no finding selected';
}

/* ===== The control in the document's toolbar ===== */

/**
 * START, OR THE CLOCK AND THE WAY OUT.
 *
 * In the toolbar and nowhere else. A second Start button on the panel's own
 * card would be a control for the thing that is already open; a second one in
 * the Findings card would be two places to press for one act. The toolbar is
 * where the document's own controls are, and the feed is the document's.
 */
function feedToolbarMarkup(id) {
  if (id !== 'procedure-report') return '';

  const feed = feedStoreFor(valuesFor(id));
  if (!feed.on) {
    return `<ui-button variant="secondary" size="sm" icon="play" id="feedStart"
      data-testid="encv--feed-start">Start live feed</ui-button>`;
  }

  return `<span class="encv__feed-pill" data-testid="encv--feed-pill">
      <span class="encv__feed-dot" aria-hidden="true"></span>
      Live · <span id="feedClock" data-testid="encv--feed-clock">00:00</span>
    </span>
    <ui-button variant="primary" size="sm" id="feedEnd"
      data-testid="encv--feed-end">End feed</ui-button>`;
}

function wireFeedToolbar(id) {
  el('feedStart')?.addEventListener('ui-click', () => startFeed(id));
  el('feedEnd')?.addEventListener('ui-click', () => endFeed(id));
}

/* ===== Opening and closing ===== */

/**
 * Draw the open document again from its own store.
 *
 * The body is SWAPPED first, exactly as paintWork does and for exactly the
 * same reason: paintDocument binds four delegated listeners to #docBody
 * itself, and a second paint onto the same element leaves the first set
 * attached. Nothing is lost by the swap — every answer on the page lives in
 * `values`, which is the whole point of the arrangement — and the scroll
 * position is carried across by hand, because starting a feed is not a reason
 * to send somebody back to the top of a report they were halfway down.
 */
function repaintDocument(id) {
  const body = el('docBody');
  const scroll = body.scrollTop;
  body.replaceWith(body.cloneNode(false));
  paintDocument(id);
  el('docBody').scrollTop = scroll;
}

/*
 * THE PRESS ALWAYS OPENS THE FEED. THE SIGNATURE IS A WARNING, NOT A LOCK.
 *
 * It was a lock: the button refused while the pre-anaesthesia step was
 * unsigned and said which documents were outstanding. The rule behind it is
 * real — the scope does not go in until the patient is asleep — but a lock was
 * the wrong instrument for it, for two reasons that turned out to matter more
 * than the rule does.
 *
 * The first is that it was untrue to the room. The feed is a MIRROR of a
 * monitor that is already on. It is switched on while the stack is set up,
 * white-balanced and focused, which happens before anybody is anaesthetised —
 * so a screen that refuses to show the picture until a signature is down is
 * refusing to show something that is visibly happening three feet away.
 *
 * The second is that nothing is protected by it. The feed writes nothing to
 * the record on its own; only a capture does, and a capture lands on a report
 * whose own signature still gates everything that matters. There was no
 * failure being prevented, only a picture being withheld.
 *
 * So the state is reported rather than enforced: the panel opens, and says on
 * its own face that the case is not ready yet. See feedGateReason, which is
 * now read for its words instead of for its veto.
 */
function startFeed(id) {
  const feed = feedStoreFor(valuesFor(id));
  feed.on = true;
  feed.startedAt = Date.now();
  feed.frozen = false;
  repaintDocument(id);

  /* Nothing to scroll to. The window opens over whatever is on screen, which
     is the point of it being a window — the previous arrangement put a card
     halfway down the report and had to send the reader after it. */
  const waiting = feedGateReason();
  if (waiting) notify(waiting, 'warning');
  else say('Live feed open — drag it by its header, or its corner to resize.');
}

function endFeed(id) {
  const values = valuesFor(id);
  const feed = feedStoreFor(values);

  /* A clip still recording is FILED rather than lost. Ending the feed with a
     recording running is what happens when the case finishes on something
     worth having recorded, and dropping it would be the one press on this
     panel that silently destroys a record. */
  if (feedPanel?.recording) feedPanel.stopClip();

  const seconds = feed.startedAt ? Math.floor((Date.now() - feed.startedAt) / 1000) : 0;
  const kept = [
    `${feed.captures} capture${feed.captures === 1 ? '' : 's'}`,
    feed.clips ? `${feed.clips} clip${feed.clips === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  feed.on = false;
  feed.frozen = false;
  feed.startedAt = null;

  stopFeedPanel();
  repaintDocument(id);
  say(`Feed closed after ${feedClock(seconds)} — ${kept} on the report.`);
}

/* ===== The window ===== */

/*
 * THE PANEL IS A WINDOW, AND IT LIVES ON <body>.
 *
 * It spent a version as a card inside the report, in a two-track split beside
 * Findings. Three things were wrong with that and all three are the same
 * thing: a card belongs to a document. It could be scrolled away from while
 * the endoscopist worked further down the report; it existed only on the one
 * substep that declared it; and it took half the working column from the
 * findings it was supposed to sit beside.
 *
 * A window is none of those. It floats over the report wherever it was put,
 * it stays put while the column scrolls under it, and the findings card gets
 * its full width back.
 *
 * Mounted once on <body> and kept, exactly as the jar dialog is and for the
 * same reason: #docBody is replaced wholesale on every repaint, so a window
 * living in there would be torn out from under itself — and torn out mid-drag,
 * which is the one moment it must not move.
 */
function feedWindow() {
  let node = document.getElementById('feedWindow');
  if (!node) {
    node = document.createElement('section');
    node.id = 'feedWindow';
    node.className = 'feed feed-window';
    /* A region rather than a dialog: nothing is blocked while it is open, the
       page behind it is still being worked, and a dialog role would promise a
       focus trap and a close that this deliberately does not have. */
    node.setAttribute('role', 'region');
    node.setAttribute('aria-label', 'Live scope feed');
    node.hidden = true;
    document.body.append(node);
  }
  return node;
}

/**
 * WHERE THE WINDOW SITS, AND WHY IT IS REMEMBERED.
 *
 * On the feed's own store, so it survives every repaint of the document and
 * every trip to another step and back. Somewhere to put the picture is a
 * decision the endoscopist makes once, about their own room and their own
 * hands, and a window that returned to the middle of the screen each time the
 * report repainted would be a window nobody bothers to move.
 *
 * `null` until it has been placed — see placeFeedWindow for where a window
 * that has never been dragged opens.
 */
const FEED_WINDOW_MARGIN = 24;

/*
 * HOW BIG THE WINDOW MAY BE, AND WHY BOTH ENDS ARE FIXED.
 *
 * The floor is where the control bar stops fitting on one line. Below it the
 * four buttons wrap into a keypad over the lumen, which is the one thing the
 * bottom of this panel may not do — so rather than let somebody drag into that
 * state and wonder what broke, the window stops.
 *
 * The ceiling is the screen. A monitor wider than the window it is in is a
 * monitor with its own controls off the edge.
 */
const FEED_WINDOW_MIN_WIDTH = 384;

const feedWidthRange = () => ({
  min: FEED_WINDOW_MIN_WIDTH,
  max: Math.max(FEED_WINDOW_MIN_WIDTH, window.innerWidth - FEED_WINDOW_MARGIN * 2),
});

function placeFeedWindow(node, feed) {
  /* Width first, because everything below measures the box and the box is a
     different size once it has been applied. The height is not set at all: it
     follows the picture's own ratio (see .feed__scene in
     css/components/scope-feed.css), which is what keeps a resized monitor a
     monitor rather than a stretched one. */
  if (feed.width) {
    const { min, max } = feedWidthRange();
    feed.width = Math.min(Math.max(feed.width, min), max);
    node.style.width = `${feed.width}px`;
  }

  const box = node.getBoundingClientRect();
  const maxLeft = Math.max(FEED_WINDOW_MARGIN, window.innerWidth - box.width - FEED_WINDOW_MARGIN);
  const maxTop = Math.max(FEED_WINDOW_MARGIN, window.innerHeight - box.height - FEED_WINDOW_MARGIN);

  /* Opening position: bottom right. Not the middle, which is where a dialog
     goes and is therefore where something demanding an answer goes; not the
     top left, which is the patient and the run. The bottom right of the
     viewport is the corner a second monitor would be in. */
  const left = feed.window ? feed.window.left : maxLeft;
  const top = feed.window ? feed.window.top : maxTop;

  /* Clamped on every paint, not only on drop: a window dragged to the right
     of a wide screen and then met on a narrow one would otherwise open off
     the edge, with no way left to reach it. */
  feed.window = {
    left: Math.min(Math.max(left, FEED_WINDOW_MARGIN), maxLeft),
    top: Math.min(Math.max(top, FEED_WINDOW_MARGIN), maxTop),
  };

  node.style.left = `${feed.window.left}px`;
  node.style.top = `${feed.window.top}px`;
}

/**
 * Dragging, by the header that already names the panel.
 *
 * Pointer events rather than mouse events, so a finger on a tablet at the
 * bedside moves it the same way a mouse does, and `setPointerCapture` so a
 * drag that outruns the header — which every drag does — keeps being a drag
 * rather than stopping the moment the cursor leaves the strip it started on.
 *
 * Bound once per window, not per paint: the node is kept on <body> across
 * every repaint, so rebinding would stack a listener per repaint onto an
 * element that is never replaced.
 */
function wireFeedWindow(node, feed) {
  if (node.dataset.windowWired === 'yes') return;
  node.dataset.windowWired = 'yes';

  /*
   * One pointerdown for both gestures, because they are the same gesture with
   * a different sum: press somewhere, follow the pointer, commit on release.
   * What differs is only what the movement is applied to — where the window is
   * for the header, how wide it is for the corner.
   */
  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const grip = event.target.closest('[data-feed-drag]');
    const corner = event.target.closest('[data-feed-resize]');
    if (!grip && !corner) return;

    const handle = grip ?? corner;
    const box = node.getBoundingClientRect();
    /* Where inside the window the pointer went down. Kept so the window moves
       WITH the pointer rather than jumping its own corner under it — the one
       thing that makes a drag feel like picking something up. */
    const offsetX = event.clientX - box.left;
    const offsetY = event.clientY - box.top;

    node.dataset[grip ? 'dragging' : 'resizing'] = 'yes';
    event.preventDefault();

    /*
     * Pointer capture is an ENHANCEMENT here, not the mechanism.
     *
     * It is what keeps the gesture smooth when the pointer crosses an iframe
     * or leaves the document, and it throws where there is no live pointer to
     * capture — which is rare in a browser and routine under a test harness
     * driving synthetic events. It was called first and uncaught, so the throw
     * took the rest of this handler with it and the window simply would not
     * move: a capability that only improves a gesture must never be able to
     * prevent it. The listeners below are on `window`, so the drag works
     * either way.
     */
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* No pointer to capture. The window listeners do the work. */
    }

    const move = (moved) => {
      if (grip) {
        feed.window = { left: moved.clientX - offsetX, top: moved.clientY - offsetY };
      } else {
        /* The corner sets the WIDTH and nothing else. Height follows the
           picture's own ratio, so the monitor cannot be stretched into a shape
           no endoscopy stack produces — and the lumen stays round, which is
           the whole reason anybody can judge a polyp's size off it. */
        feed.width = Math.round(moved.clientX - box.left);
      }
      placeFeedWindow(node, feed);
    };

    const drop = () => {
      delete node.dataset.dragging;
      delete node.dataset.resizing;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', drop);
    };

    /* On `window` rather than on the handle. Every drag outruns the strip it
       started on within a few pixels, and a listener bound to that strip stops
       hearing the moment it does — which, without capture to paper over it,
       leaves the window stuck to the first inch of the gesture. */
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
  });

  /*
   * And both from the keyboard, from the handle that does each.
   *
   * A window that can only be moved or resized with a pointer cannot be
   * touched at all by somebody driving the screen from the keys, and where the
   * picture sits and how big it is are the entire point of it being a window.
   * A whole step at a time, because nudging a panel one pixel across a 1600px
   * screen is not a thing anybody will do twice; Shift for the fine version.
   */
  node.addEventListener('keydown', (event) => {
    const grip = event.target.closest('[data-feed-drag]');
    const corner = event.target.closest('[data-feed-resize]');
    if (!grip && !corner) return;

    const step = event.shiftKey ? 4 : 32;
    const box = node.getBoundingClientRect();

    if (corner) {
      const by = { ArrowLeft: -step, ArrowRight: step, ArrowDown: step, ArrowUp: -step }[event.key];
      if (by === undefined) return;
      event.preventDefault();
      feed.width = box.width + by;
      placeFeedWindow(node, feed);
      return;
    }

    const by = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (!by) return;
    event.preventDefault();
    feed.window = { left: box.left + by[0], top: box.top + by[1] };
    placeFeedWindow(node, feed);
  });

  /* A resized viewport can strand the window off the edge, or leave it wider
     than the screen. Same clamp, same place, so there is one answer to how big
     it may be and where it may sit. */
  window.addEventListener('resize', () => {
    if (!node.hidden) placeFeedWindow(node, feed);
  });
}

/**
 * Show the window, or take it down — whichever the feed's state calls for.
 *
 * Called on every paint of the procedure report, so it is the one place that
 * decides whether there is a panel at all.
 */
function paintFeedWindow(id, values) {
  const feed = feedStoreFor(values);
  const node = feedWindow();

  /* Whatever was running is torn down first. The document is repainted for a
     dozen reasons that have nothing to do with the feed, and a panel left
     ticking would go on holding the pedal and the interval for the rest of
     the session. */
  stopFeedPanel();

  if (!feed.on) {
    node.hidden = true;
    node.innerHTML = '';
    return;
  }

  ensureFeedTarget(values);
  node.hidden = false;

  feedPanel = mountScopeFeed({
    host: node,
    source: FEED_SOURCE,
    pedals: FEED_PEDALS,
    clipMaxSeconds: FEED_CLIP_MAX_SECONDS,
    caseRef: feedCaseRef(),
    startedAt: feed.startedAt,
    frozen: feed.frozen,
    target: () => feedTargetLabel(values),
    /* Frozen survives leaving the document and coming back, because a frame
       somebody froze to look at is a frame they are still looking at. */
    onFreeze: (frozen) => {
      feed.frozen = frozen;
    },
    onElapsed: (seconds) => {
      const clock = el('feedClock');
      if (clock) clock.textContent = feedClock(seconds);
    },
    onCapture: (frame) => keepFrame(id, values, frame),
    onClip: ({ seconds, frame, atCap }) => {
      keepFrame(id, values, frame, { seconds });
      if (atCap) {
        notify(
          `Clip stopped at the ${FEED_CLIP_MAX_SECONDS}-second limit and filed — start another if the case needs it.`,
          'warning'
        );
      }
    },
    onBiopsy: () => openBiopsyFromFeed(id, values),
  });

  /* THE CORNER, appended after the panel rather than drawn by it. Resizing is
     something the WINDOW does; the feed inside it neither knows nor cares how
     wide it has been made, which is why the lib writes no handle and this does
     — and why mounting the panel, which replaces everything in the node, has
     to happen first. */
  node.insertAdjacentHTML(
    'beforeend',
    `<button type="button" class="feed-window__corner" data-feed-resize
      data-testid="encv--feed-resize"
      aria-label="Resize the live feed panel — drag, or use the arrow keys"></button>`
  );

  /* Placed and wired after it has been filled, because both need the window's
     real size: a clamp run against an empty box would put an empty rectangle
     in the corner and the filled one half off the screen. */
  placeFeedWindow(node, feed);
  wireFeedWindow(node, feed);
}

/** Take the window down without touching the feed's state — see paintWork. */
function hideFeedWindow() {
  const node = document.getElementById('feedWindow');
  if (!node) return;
  node.hidden = true;
  node.innerHTML = '';
}

/**
 * A frame off the feed, onto the report.
 *
 * The same store the Add photos button fills, and deliberately so: a still is
 * a still, and a card that kept captures apart from uploads would be two
 * answers to "what pictures does this report carry". What a capture brings
 * with it that an upload cannot is the two facts the room knows and a file
 * name does not — the time, and the finding it is about.
 *
 * `findingId` is kept even though nothing reads it back yet. It is the link a
 * later reader needs to ask "show me the pictures of jar 2", and recording it
 * costs nothing at the moment the answer is known; deriving it afterwards from
 * a caption is not possible at all.
 */
function keepFrame(id, values, frame, clip = null) {
  const feed = feedStoreFor(values);
  /* The card's own key, read off the document rather than written here: a
     capture must land in the store the card is drawn from, whatever it is
     called. */
  const field = photoFieldOf(id);
  if (!field) return;
  const photos = photoStoreFor(field.key, values);

  if (photos.length >= DOC_MAX_PHOTOS) {
    notify(
      `This report holds ${DOC_MAX_PHOTOS} images — remove one before capturing again.`,
      'warning'
    );
    return;
  }

  const finding = feedTarget(values);
  const at = nowTime();
  photos.push({
    id: nextDocPhotoId++,
    name: feedCaptureName(finding, Boolean(clip)),
    dataUrl: frame,
    at,
    findingId: finding?.id ?? null,
    seconds: clip?.seconds ?? null,
  });

  if (clip) feed.clips += 1;
  else feed.captures += 1;

  repaintPhotos(id, values);
  say(
    clip
      ? `${clip.seconds}s clip filed at ${at}${finding ? ` against ${feedSegmentLabel(finding)}` : ''}.`
      : `Captured at ${at}${finding ? ` — filed against ${feedSegmentLabel(finding)}` : ' — no finding selected, filed as a landmark'}.`
  );
}

/**
 * + Biopsy, which is the jar dialog and not a second way of opening one.
 *
 * The endoscopist's hands are on the scope and the tissue is in the forceps;
 * the jar has to be openable from the panel they are looking at. What opens is
 * the SAME dialog the Specimens card and the finding prompt open, with the
 * finding being captured against already filled in.
 *
 * IT OPENS WITH NO FINDING TOO. It used to refuse — "select a finding first" —
 * on the argument that a jar is labelled with the finding it came off, which
 * is true and is not this control's business to enforce. The dialog asks that
 * question itself, first, and will not save without an answer; a button that
 * pre-refused was a second guard on one rule, and the one it displaced was the
 * one that can actually offer the list of findings to pick from.
 */
function openBiopsyFromFeed(id, values) {
  openJarDialog(id, values, {
    finding: feedTarget(values),
    trigger: document.querySelector('#feedWindow [data-feed-act="biopsy"]'),
  });
}

/**
 * WHICH FINDING IS BEING CAPTURED AGAINST, ON THE FINDINGS LIST ITSELF.
 *
 * Put onto what js/lib/segment-findings.js produced rather than drawn by it,
 * for the reason the specimen chips are: that renderer is shared with the
 * screen this one is being compared against, and a capture target taught to it
 * would appear on a screen that has no feed.
 *
 * Every recorded finding gets a press that aims the next capture at it, and
 * the one currently aimed at says so instead of offering. Only while the feed
 * is running — a report being read back the next morning has nothing to aim.
 */
function markFeedOnFindings(values) {
  const host = el('docBody')?.querySelector('[data-diagram-host="findings"]');
  if (!host) return;

  const feed = feedStoreFor(values);

  host.querySelectorAll('.segf__item').forEach((item) => {
    item.querySelector('.feed__aim')?.remove();
    const on = feed.on && item.dataset.finding === feed.findingId;
    item.classList.toggle('segf__item--capturing', on);
    if (!feed.on) return;

    const body = item.querySelector('.segf__item-body');
    if (!body) return;
    body.insertAdjacentHTML(
      'beforeend',
      on
        ? `<span class="feed__aim feed__aim--on" data-testid="encv--feed-aimed">capturing here</span>`
        : `<button type="button" class="feed__aim" data-feed-aim="${esc(item.dataset.finding)}"
            data-testid="encv--feed-aim-${esc(item.dataset.finding)}">capture here</button>`
    );
  });

  /* And the card's own instruction, while there is something to instruct. The
     note under the title normally explains the diagram; with a feed beside it
     the more urgent sentence is what the list is FOR at that moment. */
  const note = el('docBody')?.querySelector('[data-section="findings"] .encv__doc-note');
  if (note) {
    note.textContent = feed.on
      ? 'Select a finding — captures from the feed attach to it.'
      : ENCOUNTER_DOCS['procedure-report'].sections.find((s) => s.id === 'findings')?.note ?? '';
    note.classList.toggle('encv__doc-note--live', feed.on);
  }
}

/** Aim the next capture, from a press on the findings list. */
function aimFeedAt(id, values, findingId) {
  const feed = feedStoreFor(values);
  feed.findingId = findingId;
  /* Chosen, so it stops following the newest finding — see ensureFeedTarget. */
  feed.pinned = true;
  markFeedOnFindings(values);
  feedPanel?.paintTarget();
  /* The dashed tile at the end of the photo strip names the new destination —
     see photosMarkup. */
  repaintPhotos(id, values);
}

/**
 * The ICD field, bound once and repainted in halves.
 *
 * THE SEARCH BOX IS NEVER RE-RENDERED. The obvious arrangement redraws the
 * whole panel on every keystroke, which is what the diagram does — and a
 * diagram has nothing in it holding the caret. Redrawing a search box under
 * somebody's hands takes the focus and the half-typed word with it, so the
 * results and the attached list are the only two things repainted, and the box
 * is left exactly where it was.
 *
 * Both presses are delegated to the host for the ordinary reason: the lists
 * they live in are rebuilt whenever either changes, and a listener bound to a
 * node is bound to a node that stops existing.
 */
function mountIcdField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-icd-host="${field.key}"]`);
  if (!host) return;

  const attached = icdStoreFor(field.key, values);
  const search = host.querySelector('[data-icd-search]');
  const results = host.querySelector('[data-icd-results]');
  const list = host.querySelector('[data-icd-attached]');

  /* The document's answer is read off the codes, never typed — see the same
     bargain on the diagram. Comma-separated because that is how a coder writes
     a run of them, and because the foot's required check reads a string. */
  const commit = () => {
    values[field.key] = attached.join(', ');
    list.innerHTML = icdAttachedMarkup(attached);
    results.innerHTML = icdResultsMarkup(search.value ?? '', attached);
    paintDocFoot(id);
  };

  search?.addEventListener('ui-input', (event) => {
    results.innerHTML = icdResultsMarkup(event.detail.value ?? '', attached);
  });

  host.addEventListener('click', (event) => {
    const add = event.target.closest('[data-icd-attach]');
    const drop = event.target.closest('[data-icd-drop]');
    if (add) {
      /* The same code twice is a coding error rather than two diagnoses, and
         the search already leaves out what is attached — this is the guard for
         the press that arrives from a stale list. */
      if (!attached.includes(add.dataset.icdAttach)) attached.push(add.dataset.icdAttach);
      /* The box is cleared on a hit: the next code is a different search, and
         a query left sitting over a result that has just been taken off the
         list reads as a search that did not work. */
      setFieldValue(search, '');
      commit();
      return;
    }
    if (!drop) return;
    attached.splice(attached.indexOf(drop.dataset.icdDrop), 1);
    commit();
  });
}

/**
 * The photo field: an Add that opens the file input, and a × per image.
 *
 * Read locally, one FileReader per file, and each image lands as it finishes
 * rather than the grid waiting for the slowest of a batch — which is also why
 * the repaint is inside the reader's callback rather than after the loop.
 *
 * The cap is enforced on the way in rather than by refusing afterwards: a
 * selection of sixty images against a cap of fifty attaches fifty and says so,
 * because the alternative is a dialog that throws away a selection somebody has
 * just made.
 */
/**
 * Draw the photo card again and rebind it.
 *
 * Lifted out of the mount's own closure because three things now change what
 * this card shows and only one of them is a press inside it: a capture off the
 * live feed lands here, and so does a change of which finding the next capture
 * is aimed at. One painter, whoever asked — see repaintPhotos.
 */
function paintPhotoField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-photo-host="${field.key}"]`);
  if (!host) return;

  const photos = photoStoreFor(field.key, values);
  values[field.key] = describePhotos(photos);
  host.innerHTML = photosMarkup(field.key, photos, feedNextCaptureLabel(values));
  mountPhotoField(id, field, values);
  /* the note counts the images. */
  repaintDerived(id, values);
  paintDocFoot(id);
}

/** The photo field of a document, where it has one — the report is the only one. */
const photoFieldOf = (id) =>
  ENCOUNTER_DOCS[id]?.sections
    ?.flatMap((section) => section.fields ?? [])
    .find((entry) => entry.type === 'photos') ?? null;

/** The photo card of whichever document is open, redrawn from outside it. */
function repaintPhotos(id, values) {
  const field = photoFieldOf(id);
  if (field) paintPhotoField(id, field, values);
}

function mountPhotoField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-photo-host="${field.key}"]`);
  if (!host) return;

  const photos = photoStoreFor(field.key, values);
  const input = host.querySelector('[data-photo-input]');

  const repaint = () => paintPhotoField(id, field, values);

  host.querySelector('[data-photo-add]')?.addEventListener('ui-click', () => input.click());

  input?.addEventListener('change', () => {
    const room = DOC_MAX_PHOTOS - photos.length;
    const files = [...input.files];
    const taken = files.slice(0, Math.max(room, 0));

    if (files.length > taken.length) {
      notify(`This report holds ${DOC_MAX_PHOTOS} photos — ${taken.length} of the ${files.length} chosen were added.`, 'warning');
    }

    taken.forEach((file) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        photos.push({ id: nextDocPhotoId++, name: file.name, dataUrl: reader.result });
        repaint();
      });
      reader.readAsDataURL(file);
    });
  });

  host.querySelectorAll('[data-photo-drop]').forEach((button) =>
    button.addEventListener('click', () => {
      const dropped = Number(button.dataset.photoDrop);
      photos.splice(
        photos.findIndex((photo) => photo.id === dropped),
        1
      );
      repaint();
    })
  );
}

/* ---------------------------------------------------------------------------
   THE THREE DERIVED CARDS

   The instrument, the clock and the note. None of them collects anything: each
   is a READING of something already recorded — the unit's scope register, the
   nurse's times log, the whole report above it — drawn where the endoscopist
   needs it rather than where it happens to be stored.

   They repaint together, through repaintDerived, because all three read the
   document's own answers and any one of those answers can change any of them:
   naming the scope rewrites the note's first paragraph, and a finding recorded
   on the diagram rewrites its fourth.
   ------------------------------------------------------------------------ */

/** The scopes this booking would reach for, as the select's options. */
const scopeOptions = () =>
  scopesFor(procedureLabel()).map((scope) => `${scope.model} · ${scope.asset}`);

/** The instrument behind whatever the select is showing. */
function chosenScope(values) {
  const picked = String(values.scopeId ?? '').trim();
  if (!picked) return null;
  return (
    scopesFor(procedureLabel()).find((scope) => `${scope.model} · ${scope.asset}` === picked) ??
    scopeById(picked)
  );
}

/**
 * The instrument record: what was named, and what is known about it.
 *
 * Every line is read from the register rather than typed, which is the whole
 * point — see data/procedure-scopes.js. The hang-time line is the one that can
 * be bad news, and it is drawn as a warning rather than as a refusal: the
 * scope is in the patient by the time anybody reads this card, and a screen
 * that declined to record the truth about it would leave the unit with no
 * record of the thing it most needs to investigate.
 */
function mountScopeField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-scope-host="${field.key}"]`);
  if (!host) return;

  const scope = chosenScope(values);
  if (!scope) {
    host.innerHTML =
      '<p class="encv__icd-none" data-testid="encv--scope-none">No scope named yet — the model on the booking is a type, not an instrument.</p>';
    return;
  }

  /*
   * MEASURED TO THE MOMENT OF USE, NOT TO NOW.
   *
   * Hang time is the gap between a scope coming out of the washer and going
   * into a patient. Measuring it to the wall clock would make the same case
   * read as compliant at eleven and non-compliant at nine that evening, purely
   * because somebody opened the report again — and the fact being recorded
   * happened once, at the moment the scope was passed.
   *
   * So it is measured to the case's own scope-in time, and falls back to the
   * clock only for a case that has not started yet, where "how long has this
   * been out of the washer" is genuinely a question about now.
   */
  const usedAt = procedureTimings(logRows.times ?? []).scopeIn ?? nowTime();
  const ready = scopeReady(scope, usedAt);
  const rows = [
    ['Instrument', `${scope.kind} · ${scope.model}`],
    ['Serial', scope.serial],
    ['Asset tag', scope.asset],
    ['Last reprocessed', `${scope.reprocessedAt}${scope.reprocessedYesterday ? ' (previous day)' : ''}`],
    ['Washer', scope.aer],
    ['Cycle', scope.cycle],
  ];

  host.innerHTML = `<dl class="scope__facts" data-testid="encv--scope-facts">
      ${rows
        .map(
          ([label, value]) => `<div>
            <dt>${esc(label)}</dt>
            <dd>${esc(value)}</dd>
          </div>`
        )
        .join('')}
    </dl>
    ${
      ready.ready
        ? ''
        : `<p class="scope__stale" data-testid="encv--scope-stale">
            Outside the ${SCOPE_HANG_TIME_HOURS}-hour window since reprocessing — the unit's policy is to
            reprocess before use. Recorded as used; raise it with the lead nurse.
          </p>`
    }`;
}

/**
 * The timings card.
 *
 * Three marks across the top and three intervals under them, and the
 * withdrawal is the one drawn large — it is the number this card exists for.
 * A missing mark is "—" and the interval that depends on it is "—" too; see
 * procedureTimings for why nothing here is estimated.
 */
function mountTimingsField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-timings-host="${field.key}"]`);
  if (!host) return;

  const t = procedureTimings(logRows.times ?? []);
  const mark = (label, time) => `<div class="timing">
      <dt class="timing__label">${esc(label)}</dt>
      <dd class="timing__value">${esc(time ?? '—')}</dd>
    </div>`;

  const gap = (label, minutes, extra = '') => `<div class="timing${extra}">
      <dt class="timing__label">${esc(label)}</dt>
      <dd class="timing__value">${esc(durationLabel(minutes))}</dd>
    </div>`;

  host.innerHTML = `<dl class="timings" data-testid="encv--timings">
      ${mark(TIMING_MARKS.scopeIn, t.scopeIn)}
      ${mark(TIMING_MARKS.caecum, t.caecum)}
      ${mark(TIMING_MARKS.scopeOut, t.scopeOut)}
    </dl>
    <dl class="timings timings--derived" data-testid="encv--timings-derived">
      ${gap('Insertion', t.insertion)}
      ${gap('Withdrawal', t.withdrawal, t.withdrawalShort ? ' timing--short' : ' timing--lead')}
      ${gap('Total', t.total)}
    </dl>
    ${
      t.withdrawal === null
        ? `<p class="timings__note" data-testid="encv--timings-missing">
            Withdrawal time needs both a caecal time and a scope-out time. Record them on
            Intra-procedure Management ▸ Times.
          </p>`
        : t.withdrawalShort
          ? `<p class="timings__note timings__note--warn" data-testid="encv--timings-short">
              Under the ${WITHDRAWAL_TARGET_MINUTES}-minute standard for a screening examination. A short
              withdrawal is expected where time went on taking something off; the number is recorded either way.
            </p>`
          : ''
    }`;
}

/** Everything the note reads, gathered from the one case that is open. */
function narrativeContext(values) {
  const config = DIAGRAMS.colon;
  const store = specimenStoreFor(values);
  const findings = diagramStoreFor('findings', values).findings;

  return {
    procedure: procedureLabel(),
    endoscopist: REPORT_STAFF.endoscopist,
    sedation: values.sedation ?? '',
    indication: values.indication ?? '',
    icd: icdStoreFor('icd', values),
    scope: chosenScope(values),
    timings: procedureTimings(logRows.times ?? []),
    prepType: values.prepType ?? '',
    prepQuality: values.prepQuality ?? '',
    /* "Depth Reached" on the Procedure details card — the caecum, the
       hepatic flexure, wherever the scope actually got to. Read by its own
       field id rather than guessed at, see COLONOSCOPY_PROCEDURE_DETAILS. */
    extent: values.depth ?? '',
    outcome: values.outcome ?? '',
    findings,
    config,
    /* The jars, with the site read through the finding each came off — the one
       rule the specimen record has, see data/procedure-specimens.js. */
    jars: store.jars.map((jar) => {
      const finding = findings.find((entry) => entry.id === jar.findingId);
      const segment = config.segments.find((s2) => s2.id === finding?.segment);
      return {
        jar: jar.jar,
        site: segment?.label ?? 'unlinked',
        technique: jar.technique ?? '',
      };
    }),
    photos: photoStoreFor('photos', values).length,
    bloodLoss: values.bloodLoss ?? '',
    bloodLossAmount: values.bloodLossAmount ?? '',
    complications: values.complications ?? '',
  };
}

/**
 * The narrative note.
 *
 * Blocks with their own small headings rather than one wall of text: a report
 * on a pile is skimmed for one of five things, and a reader looking for what
 * was taken should not have to read what the prep was like to find out.
 *
 * Copy is the only control. There is nothing to edit — see NARRATIVE_SECTION —
 * and what somebody actually wants from a generated note is to put it in the
 * letter they are writing.
 */
function mountNarrativeField(id, field, values) {
  const host = el('docBody')?.querySelector(`[data-narrative-host="${field.key}"]`);
  if (!host) return;

  const report = narrativeContext(values);
  const blocks = narrativeBlocks(report);

  host.innerHTML = `<div class="narrative" data-testid="encv--narrative">
      ${blocks
        .map(
          (block) => `<section class="narrative__block" data-narrative-block="${esc(block.id)}">
            <h4 class="narrative__title">${esc(block.title)}</h4>
            <p class="narrative__text">${esc(block.text)}</p>
          </section>`
        )
        .join('')}
    </div>
    <div class="narrative__actions">
      <ui-button variant="outline" size="sm" icon="copy" data-narrative-copy
        data-testid="encv--narrative-copy">Copy the note</ui-button>
    </div>`;

  /* The document's own answer for this field is the note as one block of text,
     so a print, a required check and anything else generic reads the same
     words that are on screen. Nothing writes it by hand. */
  values[field.key] = narrativeText(report);

  host.querySelector('[data-narrative-copy]')?.addEventListener('ui-click', async () => {
    try {
      await navigator.clipboard.writeText(values[field.key]);
      say('Narrative note copied.');
    } catch {
      /* Clipboard access is refused in plenty of ordinary situations — an
         insecure origin, a browser setting, a page that has not been clicked
         in. Saying so is better than a button that appears to work. */
      say('Could not reach the clipboard — select the note and copy it by hand.');
    }
  });
}

/**
 * Redraw every derived card.
 *
 * Called whenever ANY answer on the document changes, because any of them can
 * change what these three say. One entry point rather than three call sites
 * per change: a card that is only repainted by the fields somebody remembered
 * to wire is a card that is wrong for whichever field they forgot.
 */
const DERIVED_TYPES = new Set(['scope-record', 'timings', 'narrative']);

function repaintDerived(id, values) {
  const spec = ENCOUNTER_DOCS[id];
  if (!spec) return;
  spec.sections.forEach((section) =>
    (section.fields ?? [])
      .filter((entry) => DERIVED_TYPES.has(entry.type))
      .forEach((entry) => MOUNTS_DERIVED[entry.type](id, entry, values))
  );
}

const MOUNTS_DERIVED = {
  'scope-record': mountScopeField,
  timings: mountTimingsField,
  narrative: mountNarrativeField,
};

function paintDocument(id) {
  const spec = ENCOUNTER_DOCS[id];
  const values = valuesFor(id);

  /* the document's own control in front of the print trio — the live feed
     on the procedure report, and nothing on the other thirteen. See
     feedToolbarMarkup. */
  paintDocActions(feedToolbarMarkup(id));
  wireFeedToolbar(id);
  /* And the window itself, which is not a section of this document and so is
     not reached by any of the section loops below. Painted here, beside the
     control that opens it, because the two are one feature: the toolbar says
     whether a feed is running and this is the feed. It takes itself down when
     one is not. */
  paintFeedWindow(id, values);
  /* A lead is markup that belongs to the document but is not a section of its
     spec — see DOC_LEADS. The discharge record's is the handout, and on that
     one document it is the whole page: the spec has no sections at all, so the
     join below is a lead and an empty string. */
  const lead = DOC_LEADS[id];
  el('docBody').innerHTML =
    (lead ? lead.markup() : '') +
    spec.sections.map((section) => docSectionMarkup(section, values, id)).join('');

  /* Selects cannot take their options from markup, so they are filled once the
     component is defined — the same dance the log drawer does. */
  spec.sections.forEach((section) =>
    (section.fields ?? []).forEach((field) => {
      if (field.type !== 'select') return;
      customElements.whenDefined('ui-select').then(() => {
        const node = el(`docf-${field.key}`);
        if (!node) return;
        /* one select takes its options from the unit's asset register
           rather than from the spec, because the spec is a declaration of what
           is asked and the answer here is a list of real objects that changes
           when a scope is bought or sent for repair. */
        const options = field.key === 'scopeId' ? scopeOptions() : field.options;
        node.options = ['', ...options];
        node.value = values[field.key] ?? '';
      });
    })
  );

  /* And the type-or-pick boxes, for the same reason and with one difference:
     no leading blank. A <ui-select>'s empty row is how an unanswered question
     says so, and a box that can be typed into says it by being empty — an
     empty row in its panel would be a line offering to erase the answer. */
  spec.sections.forEach((section) =>
    (section.fields ?? []).forEach((field) => {
      if (field.type !== 'suggest') return;
      customElements.whenDefined('ui-suggest').then(() =>
        el(`docf-${field.key}`)?.setOptions(field.options ?? [])
      );
    })
  );

  /* The three field types that are a panel rather than a control. None of them
     carries `data-doc-field`, so none of the delegated listeners below reach
     them — each maintains its own answer through its own commit. */
  const MOUNTS = {
    diagram: mountDiagram,
    icd: mountIcdField,
    photos: mountPhotoField,
    specimens: mountSpecimenField,
    /* the three derived cards — see repaintDerived. */
    'scope-record': mountScopeField,
    timings: mountTimingsField,
    narrative: mountNarrativeField,
  };
  spec.sections.forEach((section) =>
    (section.fields ?? [])
      .filter((field) => MOUNTS[field.type])
      .forEach((field) => MOUNTS[field.type](id, field, values))
  );

  /* And the sections that ask their ticks through a dropdown rather than a
     grid of boxes — see mountPicker. A panel, like the three above, so it
     maintains its own answer and carries no `data-doc-field`. */
  spec.sections
    .filter((section) => section.picker)
    .forEach((section) => mountPicker(id, section, values));

  /* One delegated listener for the whole document. Per-field listeners would be
     re-attached on every repaint, and the prose repaints whenever a field it
     quotes changes. */
  el('docBody').addEventListener('ui-change', (event) => {
    const field = event.target.closest('[data-doc-field]');
    if (!field) return;
    values[field.dataset.docField] = event.detail.value;
    repaintProse(spec, values);
    /* and the cards that are a reading of the whole report — the note in
       particular, whose first paragraph is the scope that was just named. */
    repaintDerived(id, values);
    /* An answer can open or close a field below it, and opening a REQUIRED one
       changes what the document is still waiting on — so the foot is re-read
       with it rather than left saying the form is complete. */
    applyFieldReveals(spec, values);
    paintDocFoot(id);
  });
  el('docBody').addEventListener('ui-input', (event) => {
    const field = event.target.closest('[data-doc-field]');
    if (!field) return;
    values[field.dataset.docField] = event.detail.value;
    repaintProse(spec, values);
    repaintDerived(id, values);
    paintDocFoot(id);
  });

  /*
   * Now, delegated for the same reason the field listeners above are: the
   * button is re-rendered whenever its section is, and a listener bound to the
   * node would be bound to a node that no longer exists.
   *
   * The value is written to the store FIRST and patched onto the control
   * second, because the control is the display and the store is the document —
   * setting only the attribute would leave a time on screen that the footer,
   * the prose and the commit button all still believed was blank.
   */
  el('docBody').addEventListener('ui-click', (event) => {
    const button = event.target.closest('[data-doc-now]');
    if (!button) return;

    const key = button.dataset.docNow;
    values[key] = nowValueFor(fieldByKey(spec, key));
    setFieldValue(el(`docf-${key}`), values[key]);
    repaintProse(spec, values);
    applyFieldReveals(spec, values);
    paintDocFoot(id);
  });

  /*
   * Set / Use default, on the same delegated listener for the same reason.
   *
   * Use writes into the store first and onto the controls second — the same
   * order Now uses, and for the same reason: the store is the document and the
   * controls are its display, so a control filled without the store behind it
   * is a value the footer and the commit button do not believe in.
   *
   * A <ui-select> is set through its own `value` property rather than
   * setFieldValue: it keeps its chosen option in a property and paints its own
   * trigger from it, so writing the attribute alone would leave the list
   * selecting one thing and the box reading another.
   */
  el('docBody').addEventListener('ui-click', (event) => {
    const set = event.target.closest('[data-set-default]');
    const use = event.target.closest('[data-use-default]');
    if (!set && !use) return;

    const sectionId = (set ?? use).dataset[set ? 'setDefault' : 'useDefault'];
    const section = spec.sections.find((s) => s.id === sectionId);
    if (!section) return;

    if (set) {
      sectionDefaults[`${id}:${sectionId}`] = readSection(section, values);
      el('docBody').querySelector(`[data-use-default="${sectionId}"]`)?.removeAttribute('disabled');
      say(`${defaultScopeLabel(section)} saved as the default for this session.`);
      return;
    }

    const saved = sectionDefaults[`${id}:${sectionId}`];
    if (!saved) return;

    /* Only what Set saved is put back — see coveredByDefault. A card whose
       `defaults` names its keys leaves everything else on it exactly as the
       physician left it, which is the point of naming them. */
    (section.fields ?? [])
      .filter((field) => coveredByDefault(section, field.key))
      .forEach((field) => {
        values[field.key] = saved.fields[field.key] ?? '';
        const node = el(`docf-${field.key}`);
        if (field.type === 'select') {
          if (node) node.value = values[field.key];
        } else {
          setFieldValue(node, values[field.key]);
        }
      });

    (section.checks ?? [])
      .filter((check) => !check.derived && coveredByDefault(section, check.id))
      .forEach((check) => {
        const on = saved.checks.includes(check.id);
        if (on) values.checks.add(check.id);
        else values.checks.delete(check.id);
        const box = el('docBody').querySelector(`[data-doc-check="${check.id}"]`);
        if (box) box.checked = on;
      });

    repaintProse(spec, values);
    applyFieldReveals(spec, values);
    paintDocFoot(id);
    say(`${defaultScopeLabel(section)} filled in from the saved default.`);
  });

  el('docBody').querySelectorAll('[data-doc-check]').forEach((box) =>
    box.addEventListener('change', () => {
      const key = box.dataset.docCheck;
      if (box.checked) values.checks.add(key);
      else values.checks.delete(key);
      paintDocFoot(id);
    })
  );

  spec.sections
    .filter((section) => section.signature)
    .forEach((section) => paintDocSignature(id, section));

  /* A log drawn inside this document is now the drawing of it that is on
     screen, so the drawer and the row confirm have to repaint here rather than
     rebuild the log page — see repaintLog. Both are cleared first: a document
     with no log section must not leave the last one's claim standing. */
  docLogHost = null;
  paintedLogId = null;
  spec.sections
    .filter((section) => section.log)
    .forEach((section) => {
      docLogHost = { docId: id, logId: section.log };
      paintDocLog(section.log);
      wireDocLog(id, section.log);
    });

  /* Cards that have taken text from the scribe wear a badge saying so, and
     the document is repainted for a dozen reasons that have nothing to do with
     the scribe — so it is re-applied on every paint rather than only when a
     section is inserted. See markAiFilled. */
  markAiFilled(id, values);

  /* After the spec's own wiring, so a lead may reach anything on the page —
     and last, so nothing below re-renders the nodes it has just bound to. */
  lead?.wire?.();

  paintDocFoot(id);
}

/*
 * One document signature, in whichever state it is in.
 *
 * Re-painted through here rather than in place, so signing and Sign again are
 * the same code path — the block is the pad when there is no mark and the mark
 * when there is, and nothing else has to know which.
 *
 * Who signs decides whose name the pad arrives holding: the patient's from the
 * booking, the provider's from the section that asked for it. A consent that
 * cannot say whose signature it holds is not a record of anything.
 */
/**
 * Who a clinician block offers to sign as.
 *
 * The section's own name where the spec knows it — the anaesthetist on both
 * anaesthesia consents — and otherwise whoever is signed in, which is the only
 * honest answer for the five blocks whose signer depends on who happens to be
 * standing there. See the note at the call site.
 */
/**
 * Whoever is signed in, written the way a filed mark carries them — name then
 * role — or null when there is no session to read.
 *
 * Two callers, and they differ in what they fall back to: a clinician's pad
 * drops to the appointment's provider, the discharge sign-off on step 2 drops
 * to the nurse who filed the checklist. So the fallback belongs to each of
 * them and not to this function, which answers one question only.
 */
function sessionSigner() {
  const session = currentSession();
  if (!session?.name) return null;
  return session.role ? `${session.name}, ${session.role}` : session.name;
}

function signerFor(section) {
  if (section.signature.signer) return section.signature.signer;
  return sessionSigner() ?? providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist;
}

function paintDocSignature(id, section) {
  const values = valuesFor(id);
  const who = section.signature.who;
  const key = `${id}:${section.id}`;

  paintSignatureBlock(el('docBody').querySelector(`[data-sign-host="${key}"]`), {
    id: key.replace(/[^a-z0-9]+/gi, '-'),
    /* The section's own words. The pad's heading is clipped inside a document
       section — the title above it already says whose signature this is, and
       the same phrase twice two lines apart is noise (see
       css/screen-encounter.css) — but clipped is not gone, and the name a
       screen reader is given for the pad has to be the name of the block it is
       actually in. */
    heading: section.signature.heading,
    /* WHO THE PAD WILL FILE THE MARK UNDER, AND WHY IT IS NEVER THE HEADING.
       The patient comes from the booking; the provider from the section where
       it names one — the anaesthetist on both anaesthesia consents.

       The heading was the fallback once, and on the five blocks that name no
       signer — the consent's clinician, the H&P's physician, the endoscopist,
       the recovery nurse — what that put into the pad's old "Full Name" field
       was the string "Clinician signature", which was then FILED as the name:
       a consent whose mark reads "signed electronically by Clinician
       signature". A heading names a role and no role has ever been able to
       stand in for the person in it.

       Whoever is signed in can, and is the truer answer besides: the person at
       the workstation putting a mark on a recovery-nurse block IS the recovery
       nurse, and naming the booking's endoscopist there would file one
       clinician's signature under another's. The session is what the pre-check
       sheet's stamp already reads for the same reason (js/lib/
       pre-check-form.js), and it falls back to the booking's provider only
       when there is no session at all — a screen opened straight off a deep
       link, where naming the clinician on the appointment beats naming nobody.
       Anyone standing in for the name offered signs through Type Name, whose
       field is the mark and opens holding it. */
    signer: who === 'patient' ? patient.name : signerFor(section),
    role: section.signature.role,
    /* WHICH ROUTES THE PAD OFFERS, WHERE THE SPEC NARROWS THEM.
       Left to the block's own default — draw, upload or type — for a patient,
       who is not logged in and whose mark is the only thing tying them to the
       words above it. The anaesthesia professional's three blocks ask for
       `type` alone: a name and a timestamp from somebody already
       authenticated. See ANAESTHESIA_SIGNATURE in js/lib/encounter-docs.js. */
    methods: section.signature.methods,
    mark: values.signature[who] ?? null,
    /* A QUOTED signature has no Sign again under it, and no pad behind it. The
       patient's consent was taken at the desk (see FILED_MARKS): this screen
       is showing that record, and a button offering to take it back off would
       be offering to unsign a document this screen never signed. The line
       under the name says where it came from instead. */
    retake: !section.signature.filed,
    source: section.signature.filed ? values.signature[who]?.source ?? '' : '',
    onSign: (mark) => {
      values.signature[who] = mark;
      paintDocSignature(id, section);
      paintDocFoot(id);
    },
    onClear: () => {
      delete values.signature[who];
      paintDocSignature(id, section);
      paintDocFoot(id);
    },
  });
}

/*
 * The prose re-reads its blanks whenever a field it quotes changes.
 *
 * Only the paragraphs are rewritten, never the section around them — a repaint
 * of the whole document would take the signature pads with it, and a pad
 * re-rendered mid-signature loses the only copy of what was drawn on it.
 */
function repaintProse(spec, values) {
  const blocks = [...el('docBody').querySelectorAll('.encv__prose')];
  const sections = spec.sections.filter((section) => section.prose);
  blocks.forEach((block, i) => {
    block.innerHTML = sections[i].prose
      .map((text) => `<p>${fillProse(text, values)}</p>`)
      .join('');
  });
}

/*
 * The foot states what is outstanding, then offers the commit — the same
 * arrangement step 1 uses, for the same reason: a signature that can be given
 * at any time with no statement of what is unanswered invites signing a
 * half-worked form.
 */
function paintDocFoot(id) {
  const spec = ENCOUNTER_DOCS[id];
  const values = valuesFor(id);

  const missing = [];
  spec.sections.forEach((section) => {
    (section.fields ?? []).forEach((field) => {
      /* A field the form is not showing is not a field anybody is refusing to
         answer — see fieldShown. Nor is one that asks nothing: the standing
         order lines are printed, not answered. */
      if (!field.key || !fieldShown(field, values)) return;
      if (field.required && !String(values[field.key] ?? '').trim()) missing.push(field.label);
    });
    /* A required TICK is outstanding the same way a required field is. The
       post-anaesthesia handover is the case it exists for: the record was
       signable with the statement that the patient came back to themselves
       left unticked, which is the one line on that document nobody can
       reconstruct afterwards. `short` because the statement is a whole
       sentence and the hint below names three of these on one line. */
    (section.checks ?? []).forEach((check) => {
      if (check.required && !values.checks.has(check.id)) {
        missing.push(check.short ?? check.label);
      }
    });
    /* A section whose content is a log is answered by having entries in it. An
       assessment signed over an EMPTY standing order set says the sedation
       plan may reach for nothing, which is not a plan anybody meant to file. */
    if (section.log && !logRows[section.log].length) missing.push(section.title);
    if (section.signature && !values.signature[section.signature.who]) {
      missing.push(section.title);
    }
  });

  /* Whatever the lead is still waiting on counts against the document it leads.
     Nothing does at the moment — the handout was the one page that owed
     anything and it no longer does — but the hole stays, because a lead is a
     document's own markup and a document's own markup is free to ask for
     something the spec cannot describe. */
  missing.push(...(DOC_LEADS[id]?.missing?.() ?? []));

  const done = missing.length === 0;
  el('docFoot').hidden = false;
  /* "and signed" only where something IS signed. Every document on the run
     ends in a pad now — check-out's is the desk's release rather than a
     clinician's attestation — but the flag stays read off the spec rather than
     assumed: a document that grows a section with no pad under it must not go
     on claiming a signature it stopped having. */
  const signed = spec.sections.some((section) => section.signature);

  /*
   * THE FOOT REPORTS. IT DOES NOT OFFER A BUTTON.
   *
   * Every document used to end in a primary button — "Sign consent", "Sign
   * assessment", "File record" — and on none of them did the press mean
   * anything the page had not already meant. Seven of the nine end in a pad:
   * by the time the foot could offer anything the mark was down, so the button
   * asked for a signature that had been given and read as though the pad above
   * it had not counted. The two that end in ticks instead — check-out and the
   * post-anaesthesia record — were no better off; a receipt for a form whose
   * own answers are the receipt.
   *
   * So a document is complete when the things it asks for have been answered
   * and signed, and this sentence says so at that moment. See the note at the
   * head of js/lib/encounter-docs.js.
   */
  const wasFiled = docFiled.has(id);
  el('docHint').textContent = done
    ? completionSentence(id, spec, signed)
    : `${missing.length} still to answer: ${missing.slice(0, 3).join(', ')}${
        missing.length > 3 ? `, and ${missing.length - 3} more` : ''
      }.`;
  el('docHint').dataset.tone = done ? 'ready' : 'outstanding';
  /* Announced once, on the crossing. The hint is a live region, so repainting
     it with the same words on every keystroke afterwards would be the screen
     saying "check-out complete" into a reader for as long as the form is
     touched. */
  if (done && !wasFiled) el('copyLive').textContent = el('docHint').textContent;
  /* Nothing lives in the foot's action slot any more. Emptied rather than left
     holding whichever document's button was drawn last. */
  el('docFootActions').innerHTML = '';
}

/**
 * What each document said when it completed, and the effects that ran then.
 *
 * A document completes once. The sentence is kept because the foot is
 * repainted on every keystroke afterwards and a check-out that announced it
 * had set the appointment, then dropped back to "Patient check-out is
 * complete." on the next tick, would read as though the effect had been undone.
 * Keeping it is also what makes the effects fire exactly once: `docFiled.has`
 * is the guard, so a field cleared and re-answered does not close the
 * encounter twice.
 */
const docFiled = new Map();

function completionSentence(id, spec, signed) {
  if (!docFiled.has(id)) {
    /* The effect first, the words about it second — so a document that says it
       moved the appointment cannot say so and then fail to. */
    docFiled.set(
      id,
      DOC_COMPLETION_EFFECTS[id]?.() ?? `${spec.title} is complete${signed ? ' and signed' : ''}.`,
    );
  }
  return docFiled.get(id);
}

/**
 * The documents whose completion does something outside this screen.
 *
 * Completing is otherwise a prototype no-op — the foot changes its sentence and
 * that is all, which is honest for a consent nobody is really countersigning.
 * Check-out is the exception, and it has to be: its own body says that
 * completing it sets the appointment to Check Out, and a document that
 * describes an effect it does not have teaches a reviewer to disbelieve the
 * rest of the screen.
 *
 * Keyed by document id and kept HERE rather than on the spec, because
 * js/lib/encounter-docs.js is a declaration of what documents are and importing
 * the appointment store into it would make it a thing that acts.
 *
 * Each returns the sentence to put in the foot, so the effect and the words
 * about the effect are written in one place. Each runs exactly once, the moment
 * its document stops having anything outstanding — see completionSentence.
 */
const DOC_COMPLETION_EFFECTS = {
  checkout: () => {
    if (!appointment) return 'Check-out complete.';
    updateAppointment(appointment.id, { status: 'Check Out' });
    /* Deliberately says what did NOT happen as well. Every other commit on this
       screen closes the thing it is on; this one closes the VISIT and leaves
       the encounter open behind it, and a front desk that reads "complete" and
       stops chasing pathology is the failure step 7 exists to prevent. */
    return 'Check-out complete — appointment set to Check Out. The encounter stays open for pathology.';
  },
};


/* ========== Discharge: the sheet the patient goes home holding ========== */

/*
 * DISCHARGE INSTRUCTIONS.
 *
 * The discharge record has a field called "Instruction set". It is a dropdown
 * with four entries, it is required, and until now it named a page that existed
 * nowhere — the nurse chose "Post-polypectomy — standard", filed the record,
 * and what the patient was actually handed came off a shelf of photocopies the
 * prototype had never seen. This is that page, and it is drawn FROM that field:
 * change the set on the record and this sheet changes under it, because a
 * record claiming one handout was given while a different one prints is the
 * failure the pairing exists to prevent.
 *
 * IT IS THE DISCHARGE RECORD, NOT A PAGE ABOVE SOMEBODY ELSE'S FORM.
 * It has been three other things: a required dropdown naming a page that
 * existed nowhere, then a document of its own between the record and the desk,
 * then the lead of check-out — read back at the counter, above the desk's own
 * questions. The last of those put the sheet in the right hands and the wrong
 * room. The handout is gone through in recovery, with the patient still in the
 * chair, by the nurse who is discharging them; the desk's job at the counter is
 * to confirm that it happened and where the patient went.
 *
 * So Discharge under Procedure is this page and nothing else, and the desk's
 * two cards are the whole of check-out. Nothing is asked twice on the run any
 * more, which is why the record's own criteria, destination and signature are
 * not here to be read: they are the desk's, once.
 *
 * It is barely a form. Everything below the instruction set is read, not
 * answered, and the only other control is the one thing nobody can fill in
 * from a template: whatever the endoscopist wants this particular patient to
 * know.
 *
 * WHICH SET IS CHOSEN HERE, ON THE PAGE IT CHANGES.
 * The set used to be a required field on the record, four cards away from the
 * sheet it selected, and the note at the top of the sheet had to say where to
 * go and change it. The record IS the sheet now, so the choice is the first
 * line of it and the page redraws underneath the answer.
 */

/** The four lists, resolved for whichever set the discharge record names. */
const sheetListMarkup = (items, tone = '') =>
  `<ul class="encv__sheet-list"${tone ? ` data-tone="${tone}"` : ''}>
    ${items.map((item) => `<li>${esc(item)}</li>`).join('')}
  </ul>`;

/*
 * THE SHEET NO LONGER CARRIES THE ANTICOAGULANT.
 *
 * It used to end its warning block with a paragraph quoting what the bay had
 * recorded — the drug, how many days it was held — and a date field for the
 * restart, which was the one thing on the whole handout the document would not
 * complete without.
 *
 * It is off the sheet. The medication a patient resumes and the day they
 * resume it is a PRESCRIBING decision, made against the reason it was held and
 * the bleeding risk of what was actually done — which is the endoscopist's
 * discharge summary and the prescriber's letter, not a page printed at the
 * counter for a patient who has been sedated for the last hour. A date typed
 * into a handout is also the one instruction on it nobody downstream can see:
 * it printed, it went home, and no order, no medication list and no letter knew
 * it had been given.
 *
 * What the patient still leaves with is the endoscopist's own words for them,
 * in Additional instructions below, which is where an instruction about their
 * own medication belongs — written by the person making the decision, and read
 * back with them.
 */
function dischargeSheetMarkup() {
  /* The discharge record's own store. See the note above: one fact, one store. */
  const values = valuesFor('discharge');
  const setName = values.instructions || DISCHARGE_DEFAULTS.instructions;
  const sheet = dischargeSheetFor(setName);

  return `
    ${/* WHICH OF THE FOUR SETS, ASKED AT THE TOP OF THE SHEET IT SELECTS.
         Three of the four differ by two bullets, so a reader who cannot see
         the name cannot tell which page they are looking at — and a name shown
         but not changeable was the arrangement this replaces, where the field
         that decided it sat four cards away on a form the nurse had already
         left. The page below redraws on the answer, so the record and the
         handout cannot name two different sheets: they are one page. */ ''}
    <div class="encv__sheet-set" data-testid="encv--sheet-set">
      <ui-select id="sheetSet" label="Instruction set"
        data-testid="encv--sheet-set-select"></ui-select>
    </div>

    ${/* Side by side because they are read side by side: what you may not do
         today, and what you may eat today. Stacked, the diet lines fall below
         the fold on a laptop and the sheet reads as being about restrictions
         alone. */ ''}
    <div class="encv__sheet-pair">
      <section class="encv__doc-section" data-testid="encv--section-activity">
        <h3 class="encv__doc-legend">Activity restrictions</h3>
        <div class="encv__doc-section-body">${sheetListMarkup(sheet.activity)}</div>
      </section>
      <section class="encv__doc-section" data-testid="encv--section-diet">
        <h3 class="encv__doc-legend">Diet instructions</h3>
        <div class="encv__doc-section-body">${sheetListMarkup(sheet.diet)}</div>
      </section>
    </div>

    ${/* The one block on the sheet that is not an instruction but a trigger,
         and the only one drawn in the danger colour. It is full width and it
         is not paired with anything, because a reader who is frightened enough
         to be looking for it should not have to find it in a column. */ ''}
    <section class="encv__doc-section encv__doc-section--danger"
      data-testid="encv--section-warnings">
      <h3 class="encv__doc-legend">Warning signs — call or seek care if:</h3>
      <div class="encv__doc-section-body">
        ${sheetListMarkup(sheet.warnings, 'danger')}
      </div>
    </section>

    ${/* The endoscopist's own words for this patient. It was one of two boxes
         writing to one key — this one and an "Additional instructions" field on
         the record's own Discharge Instructions card, inches apart on the same
         run, and the one further from the sheet had no way to pull the
         impression in. The record is the sheet now, so there is one box. */ ''}
    <section class="encv__doc-section" data-testid="encv--section-additional">
      <h3 class="encv__doc-legend">Additional instructions</h3>
      <div class="encv__doc-section-body">
        <div class="encv__sheet-additional">
          <ui-button variant="outline" size="sm" id="sheetImpression"
            data-testid="encv--sheet-impression">Add impression from report</ui-button>
        </div>
        <ui-textarea id="sheetNotes" label="For this patient" rows="4"
          placeholder="Enter any additional discharge instructions…"
          value="${esc(values.notes ?? '')}"
          data-testid="encv--sheet-notes"></ui-textarea>
        <div class="encv__sheet-additional">
          <ui-button variant="outline" size="sm" id="sheetSave"
            data-testid="encv--sheet-save">Save</ui-button>
        </div>
      </div>
    </section>

    ${/* "Results and contact", not "Follow-up". Follow-up is a question about
         the diary — when the next appointment is — and it belongs to the
         scheduler, not to a page the patient is holding. This is the two facts
         patients actually ring about: when the letter lands, and the number to
         call. */ ''}
    <section class="encv__doc-section" data-testid="encv--section-results">
      <h3 class="encv__doc-legend">Results and contact</h3>
      <div class="encv__doc-section-body">
        <dl class="encv__sheet-terms">
          ${DISCHARGE_FOLLOW_UP.map(
            (entry) => `<div class="encv__sheet-term">
              <dt>${esc(entry.term)}</dt>
              <dd>${esc(entry.text.replace('{phone}', PRACTICE_PROFILES.asc.phone))}</dd>
            </div>`
          ).join('')}
        </dl>
      </div>
    </section>`;
}

/**
 * The controls on the handout, bound after the document around it is drawn.
 *
 * Both write into the DISCHARGE record's store — which set the sheet is, and
 * the endoscopist's own words for this patient — and both survive leaving the
 * step and coming back, because the store is the document and the page is only
 * its drawing.
 */
function wireDischargeSheet() {
  const values = valuesFor('discharge');

  /*
   * THE SET, AND WHY CHANGING IT REPAINTS THE WHOLE STEP.
   *
   * Options cannot come from markup — <ui-select> takes them as a property once
   * it is defined, the same dance the document renderer does for its own
   * selects. And the answer does not change one line on the page: three of the
   * four sheets differ from each other throughout, so activity, diet, warnings
   * and follow-up are all redrawn. paintWork() is the repaint that does that
   * safely, because it replaces #docBody rather than emptying it — see the note
   * at the head of it for what emptying leaves attached.
   */
  customElements.whenDefined('ui-select').then(() => {
    const set = el('sheetSet');
    if (!set) return;
    set.options = DISCHARGE_INSTRUCTION_SETS;
    set.value = values.instructions || DISCHARGE_DEFAULTS.instructions;
  });
  el('sheetSet')?.addEventListener('ui-change', (event) => {
    values.instructions = event.detail.value;
    paintWork();
  });

  /*
   * THE IMPRESSION, PULLED RATHER THAN RETYPED.
   *
   * The endoscopist has already written what they found, in the procedure
   * report on this same step. Retyping it into the handout is how the two come
   * to disagree, and the version that disagrees is the one the patient takes
   * home. So it is copied, appended rather than overwriting whatever is already
   * in the box, and it refuses when there is nothing to copy — a button that
   * silently does nothing reads as broken.
   */
  el('sheetImpression')?.addEventListener('ui-click', () => {
    const impression = String(docValues['procedure-report']?.impression ?? '').trim();
    if (!impression) {
      notify('The procedure report has no impression yet.', 'info');
      return;
    }
    const existing = String(el('sheetNotes').value ?? '').trim();
    if (existing.includes(impression)) {
      notify('The impression is already on the sheet.', 'info');
      return;
    }
    setFieldValue(el('sheetNotes'), existing ? `${existing}\n\n${impression}` : impression);
    notify('Impression added from the procedure report.', 'success');
  });

  /* Save rather than save-as-you-type, because a paragraph is composed and then
     committed — see the restart date above for the field where the opposite is
     true. Nothing else on the run holds a second copy of this box any more, so
     the press commits it to one store and says so. */
  el('sheetSave')?.addEventListener('ui-click', () => {
    values.notes = el('sheetNotes').value ?? '';
    notify('Additional instructions saved to the discharge record.', 'success');
    el('copyLive').textContent = 'Additional instructions saved to the discharge record.';
  });
}

/**
 * MARKUP A DOCUMENT OWNS BUT ITS SPEC DOES NOT DECLARE.
 *
 * js/lib/encounter-docs.js describes a document as sections of fields, ticks,
 * prose and signatures, and the handout is none of those — it is six blocks of
 * read-only text with three controls buried in it. Declaring it there would
 * mean inventing a section type for "a page", and the one page in the run would
 * be the only thing that used it.
 *
 * So a lead is a hole in the renderer instead: markup that goes above the
 * spec's sections, wiring that runs after they are bound, and a say-so in what
 * the foot considers outstanding. Keyed by document id, so every existing
 * `paintDocFoot(id)` call site picks it up without knowing it exists.
 *
 * The discharge record is the one document that is ALL lead and no sections —
 * which is why the renderer joins the two with a `+` rather than caring which
 * of them is empty.
 */

const DOC_LEADS = {
  /* No `missing`. The restart date was the one thing this page held back the
     document for, and it is off the sheet — see the note over
     dischargeSheetMarkup. Everything left on the handout is either read or
     chosen from a default, so the record is complete once it has been opened,
     which is an honest account of what going through a printed sheet with
     somebody is. The key is left off rather than stubbed to an empty array:
     paintDocFoot already asks for it optionally, and a function returning
     nothing would look like one that had lost its answer. */
  discharge: {
    markup: dischargeSheetMarkup,
    wire: wireDischargeSheet,
  },
};

/* ===================== Step 2: the intra-procedure logs ===================== */

/*
 * ONE TABLE, ONE BUTTON, ONE DRAWER — EIGHT TIMES OVER.
 *
 * The obvious arrangement gives each facet an inline form stacked on top of
 * its own table, so half the working column is a form nobody is filling in and
 * the log it belongs to starts below the fold. During a case the log is the thing being read — what
 * has been given, what the last set of obs was — and the form is wanted for a
 * few seconds at a time. So the table has the column and the form is a drawer.
 *
 * All of them are drawn from js/lib/encounter-logs.js. Nothing below knows what
 * a vital sign, a specimen pot or a bag of fluid is.
 */

/** Rows for each log, seeded from the spec, mutated as the case is charted. */
const logRows = Object.fromEntries(
  Object.entries(ENCOUNTER_LOGS).map(([id, spec]) => [id, [...spec.seed]])
);

/*
 * THE CASE, HANDED TO THE NOTE COMPOSER.
 *
 * The Note log drafts a letter on the practice letterhead — see composeNote in
 * js/lib/encounter-logs.js — and a letter names the patient, their MRN, what
 * was done to them, when, why, and who referred them. None of that is knowable
 * from a file that describes what a log IS, so the screen says it once, here.
 *
 * Immediately after logRows, and that ordering matters: the specimens handed
 * over are the pathology log's own array, not a copy of it. A letter drafted
 * on Thursday about a pot that came back on Wednesday has to carry Wednesday's
 * result, and a snapshot taken at load would carry whatever the register held
 * before the case had started. The array's identity never changes — rows are
 * pushed onto it — so passing the reference keeps the composer current for
 * free.
 *
 * THE INDICATION COMES OFF THE BOOKING, which is the same place the physician's
 * H&P and the procedure report both take theirs from (see `fromCase` in
 * js/lib/encounter-docs.js). Three documents about one case must not have three
 * different reasons for it on them.
 */
setNoteContext({
  practice: PRACTICE_PROFILES.clinic,
  patient: patient?.name ?? '',
  mrn: patient?.mrn ?? '',
  procedure: procedureLabel(),
  procedureDate: appointment?.date ? shortDate(appointment.date) : '',
  indication: appointment?.reason ?? '',
  referring: REPORT_STAFF.referring,
  provider: providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist,
  specimens: logRows.pathology,
});

/*
 * A spec column becomes a <ui-data-table> column.
 *
 * The hand-rolled <table> this replaces got the visuals right and everything
 * else wrong: no sticky header, no keyboard row movement, no empty state, and
 * its own idea of what a numeric column looks like. <ui-data-table> is the
 * app's table and it has all four. `render` is where the spec's formatting,
 * badges and monospace go, so the component stays the thing that knows about
 * tables and the spec stays the thing that knows about sedation records.
 */
/**
 * One cell's text, before anything decides how to dress it.
 *
 * Pulled out of the column renderer below when the whole step started
 * printing: the sheet in stepSheetMarkup composes the SAME logs into plain
 * <table>s, and a second reading of `format` written there would be a second
 * answer to what a blank SpO₂ or an unset pain score looks like. One function,
 * two readers — the screen's table dresses what comes back in badges and
 * monospace, the paper prints it as it stands.
 */
function cellText(column, row) {
  const raw = row[column.key];
  const value = column.format ? column.format(raw) : raw;
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function tableColumns(spec, id) {
  const columns = spec.columns.map((column) => ({
    key: column.key,
    label: column.label,
    numeric: column.align === 'right',
    /*
     * WHO GETS THE SLACK, SAID OUT LOUD.
     *
     * <ui-data-table> lays out on `table-layout: auto`, so the width a table
     * has spare goes to whichever column the browser decides wants it — and
     * left to itself it decided the Note register's Date column did, which
     * sat a right-aligned date in the middle of an inch of nothing while the
     * Subject beside it ellipsised with half the table empty to its right.
     *
     * The component already answers this and the logs were not using it. A
     * date, a pill and a name are fixed-size things and say so with `narrow`;
     * the one column whose text is worth all the room says so with
     * `truncate`, and takes the slack. See .ui-table__cell--narrow in
     * css/components/data-table.css, which has the whole argument.
     *
     * `clip` on the three other logs that use it is the older, screen-local
     * answer — a hard 14rem cap — left where it is rather than swept up here,
     * because changing it would resize the orders and complications tables and
     * neither of those asked for anything.
     */
    narrow: column.narrow,
    truncate: column.truncate,
    render: (row) => {
      const text = cellText(column, row);

      if (column.badge) {
        /* A column may say what tone each value wears — the Note register does,
           because its badge is the kind of letter rather than a reading that
           can be out of range, and "warning if flagged" has nothing to say
           about a letter to a referring clinician. Everything else keeps the
           flag rule it was written with. */
        const tone = column.tone ? column.tone(row) : row.high ? 'warning' : 'neutral';
        return `<ui-badge status="${esc(tone)}" size="sm">${esc(text)}</ui-badge>`;
      }
      /* CLIPPED TO ONE LINE, WITH THE WHOLE THING IN THE TOOLTIP.
         The same answer screens/complications.html gives its Notes column, for
         the same reason: a treatment paragraph set loose in a cell turns every
         row into four, and a register is read by scanning down it. The title
         carries what the clip cuts, so nothing is lost — only folded. */
      if (column.clip) {
        return `<span class="encv__log-clip" title="${esc(text)}">${esc(text)}</span>`;
      }
      return column.mono ? `<code>${esc(text)}</code>` : esc(text);
    },
    /* A COUNTED LOG'S CELLS ARE NOT TEXT.
       Last, so it wins: on a count sheet every column but the drug's name is a
       box, a sum or a button, and the plain renderer above has nothing to say
       about any of them. See countCell — the column declares which KIND of
       cell it is, the spec keeps the arithmetic, and the markup stays here.
       No log declares `count` at the moment; see the section header below. */
    ...(spec.count ? countCell(spec, id, column) : null),
  }));

  /* Actions last, unlabelled. A column heading over a row of pencils names the
     control rather than the data, and the header row is a description of what
     the columns hold.

     Stop before Edit, because on a log that has it, stopping is the thing
     actually done at the bedside and correcting a typo is the rarer errand.

     All of them name the row by its FIRST column, which is what the row is
     called — the stop was naming it by the second, so a screen reader offered
     "End 500" for a bag of sodium chloride.
     Remove last, because it is the one action nothing puts back. */
  /* A log can say it draws its own row actions. A count sheet does: its pencil
     and bin sit beside the drug's name, because they act on the LINE rather
     than on the count typed into it, and its last column is the button that
     files the line. Appending this one as well would put two sets of controls
     on every row. */
  if (spec.rowActions === false) return columns;

  columns.push({
    key: '_actions',
    label: '',
    /* The component's own answer for a column of controls: sized to them and
       right-aligned. Without it the actions column is just another auto-laid-out
       column competing for the table's spare width with the Subject beside it,
       which is the argument the `narrow`/`truncate` note above makes. */
    actions: true,
    render: (row) => `<div class="encv__row-actions">
      ${
        spec.stop && spec.stop.when(row)
          ? `<button type="button" class="encv__row-stop"
              data-stop-row="${row._i}"
              aria-label="${esc(spec.stop.label)} ${esc(row[spec.columns[0].key] ?? '')}"
              data-testid="encv--stop-${id}-${row._i}">${esc(spec.stop.label)}</button>`
          : ''
      }
      ${
        /* A LOG MAY HAVE NOTHING TO CORRECT.
           The pencil is the default because eleven of the twelve logs are a
           case being charted as it happens, where the last row is minutes old
           and a typo in it is worth going back for. The register of notes sent
           is the exception — see `edit: false` on 'letters' in
           js/lib/encounter-logs.js — and on a log that says so the row simply
           does not carry one, rather than carrying a disabled one that has to
           be pressed to find out. */
        spec.edit === false
          ? ''
          : `<button type="button" class="encv__row-edit"
              data-edit-row="${row._i}" aria-label="Edit the ${esc(
                row[spec.columns[0].key] ?? ''
              )} entry" data-testid="encv--edit-${id}-${row._i}">
              ${iconMarkup('pencil')}
            </button>`
      }
      ${
        /* READING THE ROW, on a log whose row is longer than its columns. The
           Note register carries a whole letter and shows four facts about it,
           so there has to be a way to open the thing itself — see `view` on
           'letters' in js/lib/encounter-logs.js. Nothing else needs one: a set
           of observations IS its columns, and a dialog repeating them would be
           a second reading of the row the reader is already looking at. */
        spec.view
          ? `<button type="button" class="encv__row-view"
              data-view-row="${row._i}" aria-label="${esc(spec.view.label)} the ${esc(
                row[spec.columns[0].key] ?? ''
              )} entry" data-testid="encv--view-${id}-${row._i}">
              ${iconMarkup('eye')}
            </button>`
          : ''
      }
      ${
        /* And beside it, on the log that asked for it, a copy of the row.
           Named by the first column the way the stop and the bin are, so the
           button announces "Print the 4 Aug 2026 entry" rather than the row
           number it happens to be sitting on. */
        spec.print
          ? `<button type="button" class="encv__row-print"
              data-print-row="${row._i}" aria-label="${esc(spec.print.label)} the ${esc(
                row[spec.columns[0].key] ?? ''
              )} entry" data-testid="encv--print-${id}-${row._i}">
              ${iconMarkup('printer')}
            </button>`
          : ''
      }
      ${
        spec.remove
          ? `<button type="button" class="encv__row-remove"
              data-remove-row="${row._i}" aria-label="${esc(spec.remove.label)} ${esc(
                /* The first column names the row on a formulary, where it is
                   the drug. It does not on a running sheet, where it is the
                   clock — "Delete 09:14" is a label for the time of day. A log
                   whose first column is not its subject says so with
                   `describe`. */
                spec.remove.describe
                  ? spec.remove.describe(row)
                  : row[spec.columns[0].key] ?? ''
              )}" data-testid="encv--remove-${id}-${row._i}">
              ${iconMarkup('trash')}
            </button>`
          : ''
      }
    </div>`,
  });

  return columns;
}

/* ---------------------------------------------------------------------------
   THE COUNT SHEET'S CELLS

   A COUNTED log is not written, it is counted, and its row is a form: the
   figure in the drawer at the start, what went into it, what was given, what
   was destroyed, what is in there now, and the difference between the
   arithmetic and the count. A log declares that by carrying `count`, which
   owns every one of those definitions — the spec keeps the meaning, this file
   keeps the markup.

   NOTHING ON THIS SCREEN DECLARES IT TODAY, AND THE SHEET HAS SINCE ARRIVED
   WHERE IT WAS GOING. The medication inventory tab declared it; the count now
   lives on Inventory ▸ Daily Count Sheet, beside the lots and par levels it is
   actually reconciled against, kept by the DAY rather than by the case — see
   js/screens/medication-count.js, which draws these same nine columns from the
   same fixture in data/medication-tracked.js.

   This is left standing because it is the general machinery: `count` is a
   property any log spec can declare, and the next running sheet that needs a
   row of boxes with two sums on the end gets it by asking for one rather than
   by having this written a third time.

   What lives here is markup, and only markup. The column says which KIND of
   cell it is — a box, a sum, the drug, the button — and this draws it in the
   app's own controls, the same way tableColumns draws a badge for a column
   that asked for one.

   THE VALUES ARE ON THE ROW, WHICH IS WHY THEY SURVIVE.
   A repaint rebuilds every <ui-input> in the table, so a figure that lived
   only inside the control would be wiped by adding a drug, filing a line or
   coming back to the tab. Each box is rendered FROM the row and each keystroke
   is written back to it — the table is a view of the count, not the place it
   is kept.
   ------------------------------------------------------------------------ */

/**
 * One field in a row.
 *
 * Every one carries a hidden label naming BOTH the figure and the drug it
 * belongs to. On a grid of identical boxes, "Given" alone tells a screen-reader
 * user which column they are in and nothing about which of eight rows — and
 * this is a table where putting a number on the wrong line is the whole
 * failure mode.
 */
function countField(row, key, label, { type = 'number', placeholder = '' } = {}) {
  return `<ui-input class="encv__count-field" size="sm" type="${type}"
    label="${esc(label)} for ${esc(row.name)}" label-hidden
    ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}
    value="${esc(row[key] ?? '')}"
    data-count-row="${row._i}" data-count-field="${key}"
    data-testid="encv--count-${key}"></ui-input>`;
}

/**
 * A sum, as it reads right now.
 *
 * Split out from the cell around it because it is redrawn on every keystroke —
 * see refreshCount. The em dash is the important half: a discrepancy of zero
 * against a drawer nobody has counted would report the untouched line as
 * reconciled, which is the one lie a controlled-drug sheet must not tell.
 */
function countSumInner(spec, row, which) {
  if (which !== 'difference') return String(spec.count[which](row));

  const diff = spec.count.difference(row);
  if (diff === null) return '<span class="encv__count-none">—</span>';
  /* Signed, because +1 in the drawer and −1 out of it are different problems,
     and only one of them is a drug that has gone missing. */
  const sign = diff > 0 ? '+' : '';
  return `<span class="encv__count-diff encv__count-diff--${
    diff === 0 ? 'level' : 'off'
  }">${sign}${diff}</span>`;
}

/** The drug, what the vial says, what the last shift left — and the two
 *  buttons that act on the LINE rather than on the count typed into it. */
function countIdentity(spec, id, row) {
  const facts = [row.strength, row.unit].filter(Boolean).join(' · ');
  return `<div class="encv__count-name">
    <div class="encv__count-name-text">
      <span class="encv__count-drug">${esc(row.name)}</span>
      ${facts ? `<small class="encv__count-facts">${esc(facts)}</small>` : ''}
      ${
        /* Only where there is one. A line that has never been counted here has
           nothing to carry forward, and "Prior end: 0" would be a figure
           nobody wrote. */
        row.priorEnd == null
          ? ''
          : `<small class="encv__count-prior">Prior end: ${esc(row.priorEnd)}</small>`
      }
    </div>
    <div class="encv__row-actions">
      <button type="button" class="encv__row-edit" data-edit-row="${row._i}"
        aria-label="Edit ${esc(row.name)}" data-testid="encv--edit-${id}-${row._i}">
        ${iconMarkup('pencil')}
      </button>
      <button type="button" class="encv__row-remove" data-remove-row="${row._i}"
        aria-label="${esc(spec.remove.label)} ${esc(spec.remove.describe(row))}"
        data-testid="encv--remove-${id}-${row._i}">
        ${iconMarkup('trash')}
      </button>
    </div>
  </div>`;
}

/** Which cell a counted log's column draws, or nothing for a column that is
 *  still just a value. */
function countCell(spec, id, column) {
  if (column.identity) {
    return { wrap: true, render: (row) => countIdentity(spec, id, row) };
  }

  if (column.field) {
    return {
      render: (row) =>
        column.with
          ? /* The figure, and under it the person it is accounted for by. One
               cell, because they are one answer: a witness in a column of its
               own would float free of the number it belongs to. */
            `<div class="encv__count-stack">
              ${countField(row, column.key, column.label, { type: column.field })}
              ${countField(row, column.with.key, column.with.label, {
                type: 'text',
                placeholder: column.with.placeholder,
              })}
            </div>`
          : countField(row, column.key, column.label, { type: column.field }),
    };
  }

  if (column.derived) {
    /* Wrapped in a span carrying the row and the sum it is, so a keystroke can
       redraw this one cell rather than the table it sits in — repainting would
       replace the box being typed into and take the caret with it. */
    return {
      render: (row) => `<span class="encv__count-sum" data-count-cell="${column.derived}"
        data-count-row="${row._i}"
        data-testid="encv--count-${column.derived}">${countSumInner(
          spec,
          row,
          column.derived
        )}</span>`,
    };
  }

  if (column.commit) {
    return {
      actions: true,
      render: (row) => `<ui-button variant="outline" size="sm" data-save-row="${row._i}"
        data-testid="encv--count-save">${esc(column.commit)}</ui-button>`,
    };
  }

  return null;
}

/** Redraw the two sums on one line, in place. */
function refreshCount(table, spec, logId, index) {
  const row = { ...logRows[logId][index], _i: index };
  table
    .querySelectorAll(`[data-count-row="${index}"][data-count-cell]`)
    .forEach((cell) => {
      cell.innerHTML = countSumInner(spec, row, cell.dataset.countCell);
    });
}

/**
 * File one line of the count.
 *
 * The spec says what has to be answered first and what to say once it is — see
 * `count.check` and `count.filed` in js/lib/encounter-logs.js. Nothing is
 * blocked with an inline error: the field is focused and the message is said
 * once, because an error rendered inside a cell grows the row and shifts the
 * eight fields under it while somebody is typing in one of them.
 */
function saveCountLine(logId, index) {
  const spec = ENCOUNTER_LOGS[logId];
  const row = logRows[logId][index];
  if (!spec?.count || !row) return;

  const problem = spec.count.check(row);
  if (problem) {
    document
      .querySelector(`[data-count-row="${index}"][data-count-field="${problem.field}"]`)
      ?.focus();
    notify(problem.message, 'warning');
    el('copyLive').textContent = problem.message;
    return;
  }

  /* A filed line that does not reconcile is the one row on the sheet worth
     stopping the eye on, and it stays flagged until it does — the same
     highlight every other log gives a reading that is out of range. */
  row.high = spec.count.difference(row) !== 0 && spec.count.difference(row) !== null;

  const { message, tone = 'success' } = spec.count.filed(row);
  notify(message, tone);
  el('copyLive').textContent = message;
  repaintLog(logId);
}

/* ---------------------------------------------------------------------------
   FILTERS AND CARDS, FOR THE ONE LOG THAT IS A REGISTER

   Eleven of the twelve logs are running sheets worked during a case: they hold
   a handful of rows, every one of them is wanted, and a filter over six vital
   signs would be furniture. The complications register is the exception. It is
   read AFTER the fact, by somebody asking a question of it — how many, how
   bad, how many escalated — and that reader arrives from
   screens/complications.html, which answers exactly those three questions with
   three cards over a filtered table.

   So both are declared on the spec (`stats`, `filters`) and drawn here, and a
   log that declares neither renders exactly what it rendered before.
   ------------------------------------------------------------------------ */

/** Which values are ticked in the open log's filter, by group name. */
let logFilter = {};

/**
 * Which log `logFilter` belongs to.
 *
 * One filter state, not one per log, because only one log is on screen at a
 * time — but it has to be dropped when a different one opens. A severity
 * ticked on Complications and then carried into a log that has no severity
 * would narrow nothing and still show the control as active, which is a filter
 * lying about what it is doing.
 */
let logFilterFor = null;

/**
 * The empty state, which is two different sentences.
 *
 * "No complications recorded" is a fact about the case and is good news. "None
 * match these filters" is a fact about the reader's own ticks and is a prompt
 * to clear them. A table that says the first when the second is true has hidden
 * rows and told the reader there are none.
 */
const logEmptyText = (spec, rows, shown) =>
  rows.length && !shown.length ? 'Nothing matches these filters' : spec.empty;

/**
 * The tables one log draws — usually one, two for a log that is split.
 *
 * Eleven of the twelve logs are a running sheet: one table, every row in it,
 * newest at the bottom. The IV log is not, because a bag has two states and
 * the reader mid-case only wants one of them — see the `split` note in
 * js/lib/encounter-logs.js. Rather than teach the table about infusions, the
 * spec says where to cut and this hands back the pieces, so the split log and
 * the plain log go through exactly the same painting, wiring and row indices
 * below.
 *
 * `_i` survives the cut. It is the row's index in the LOG, so the End on a
 * row of the running table still points at the entry it is drawn beside even
 * though that row is now the first line of the second table it appears in.
 */
function logSections(spec, rows) {
  if (!spec.split) return [{ key: 'all', title: '', rows }];
  return spec.split.parts.map((part) => ({
    key: part.key,
    title: part.title,
    empty: part.empty,
    rows: rows.filter(part.when),
  }));
}

/**
 * The rows a log is currently showing.
 *
 * Nothing ticked means nothing narrowed — the same rule <ui-filter> is built
 * on, and the reason there is deliberately no "All" row in any group.
 */
function filteredLogRows(spec, rows) {
  if (!spec.filters) return rows;
  return rows.filter((row) =>
    spec.filters.every((group) => {
      const chosen = logFilter[group.name] ?? [];
      return chosen.length === 0 || chosen.includes(row[group.key]);
    })
  );
}

/** The filter control, with one tickable group per axis the spec names. */
const logFilterMarkup = (spec) => `<ui-filter id="logFilter" class="encv__log-filter"
    label="Filters" panel-label="Filter ${esc(spec.title.toLowerCase())}"
    data-testid="encv--log-filter">
    ${spec.filters
      .map(
        (group) => `<ui-filter-group name="${esc(group.name)}" label="${esc(group.label)}"
          options="${esc(group.options.join(','))}"></ui-filter-group>`
      )
      .join('')}
  </ui-filter>`;

/**
 * The cards, read off the FILTERED rows.
 *
 * Which is the whole reason they sit on the same card as the filter rather
 * than in the toolbar: narrowing to Severe and reading the count off the first
 * card is the question this register exists to answer, and a card that kept
 * reporting the unfiltered total would answer a different one silently.
 */
const logStatsMarkup = (spec, rows) => `<section class="encv__log-stats"
    aria-label="${esc(spec.title)} summary">
    ${spec.stats
      .map((stat) => {
        const meta = stat.meta?.(rows) ?? '';
        return `<div class="encv__log-stat" data-testid="encv--log-stat-${stat.id}">
          <div class="encv__log-stat-body">
            <p class="encv__log-stat-label">${esc(stat.label)}</p>
            <p class="encv__log-stat-figure">
              <span class="encv__log-stat-value${
                stat.text ? ' encv__log-stat-value--text' : ''
              }"${
                /* The text card clips — see .encv__log-stat-value--text. The
                   whole value goes on the title so a clipped one is still
                   readable, and it is left off the numeric cards, where a
                   tooltip repeating a two-digit number is noise. */
                stat.text ? ` title="${esc(stat.value(rows))}"` : ''
              }>${esc(stat.value(rows))}</span>
              ${meta ? `<span class="encv__log-stat-meta">${esc(meta)}</span>` : ''}
            </p>
          </div>
          <span class="encv__log-stat-icon" data-tone="${stat.tone}" aria-hidden="true">
            ${iconMarkup(stat.icon)}
          </span>
        </div>`;
      })
      .join('')}
  </section>`;

/**
 * What the search box is currently filtering each log by, keyed by log id.
 *
 * Kept OUTSIDE the paint so a query survives the repaint that adding, editing
 * or removing a row triggers: typing "mid", removing the row you found, and
 * being handed back the unfiltered cart is the table taking the search off you
 * at the moment you were using it.
 */
const logQueries = {};

/*
 * Which log the column is actually SHOWING.
 *
 * Read rather than assumed, because a log drawn inside a document is not the
 * log page: a drawer save has to repaint whatever the nurse is looking at
 * rather than swap the document out from under them. See repaintLog.
 */
let paintedLogId = null;

/** The rows of one log that match its search box, each carrying its real index. */
function visibleRows(id) {
  const spec = ENCOUNTER_LOGS[id];
  const rows = logRows[id].map((row, i) => ({ ...row, _i: i }));

  const query = (logQueries[id] ?? '').trim().toLowerCase();
  const searched =
    spec.search && query
      ? rows.filter((row) =>
          spec.search.keys.some((key) => String(row[key] ?? '').toLowerCase().includes(query))
        )
      : rows;

  /* Search and filter narrow the same list, so they narrow it in the same
     place — one function that answers "what is this log showing", rather than
     a table that has to consult two of them and a footer that has to agree
     with both. */
  return filteredLogRows(spec, searched);
}

function paintLog(id) {
  const spec = ENCOUNTER_LOGS[id];
  paintedLogId = id;
  /* The page is the drawing that is on screen now; whatever document was
     showing a log a moment ago is not. */
  docLogHost = null;

  /* A filter belongs to the log it was set on — see logFilterFor. */
  if (logFilterFor !== id) {
    logFilter = {};
    logFilterFor = id;
  }

  const rows = visibleRows(id);
  const searching = Boolean(spec.search && (logQueries[id] ?? '').trim());
  const sections = logSections(spec, rows);

  /* A split log's own empty sentence per table — "Nothing is running" is a
     different fact from "Nothing has been taken down yet", and one sentence
     under both would be wrong under one of them. Search wins over either,
     for the reason in logEmptyText. */
  const emptyFor = (section) =>
    searching ? spec.search.empty : section.empty ?? logEmptyText(spec, logRows[id], rows);

  /* Every log in the run takes new entries, pathology included — a pot that
     never made it onto the procedure report still has to be enterable
     somewhere, so the button is unconditional rather than gated on the spec. */
  /*
   * And nothing beside it. Medication inventory carried a second, red "Record
   * wastage" here that opened a form filing onto the practice's register
   * rather than into this table; wastage is now recorded on that register
   * itself, where it can be written off against a lot. See the comment on
   * 'med-inventory' in js/lib/encounter-logs.js.
   */
  paintDocActions(
    `<ui-button variant="primary" size="sm" icon="plus" id="logAdd"
      data-testid="encv--log-add">${esc(spec.addLabel)}</ui-button>`
  );
  el('docFoot').hidden = true;

  el('docBody').innerHTML = `
    ${spec.stats ? logStatsMarkup(spec, rows) : ''}
    <section class="encv__log-card${spec.split ? ' encv__log-card--split' : ''}${
      /* The counted log is laid out tighter than the eleven that are read:
         nine columns of fields have to fit a working column with a chart rail
         either side of it. See .encv__log-card--count. */
      spec.count ? ' encv__log-card--count' : ''
    }" data-testid="encv--log-${id}">
      <div class="encv__log-head">
        <h3 class="encv__log-title">${esc(spec.title)}</h3>
        ${
          /* In the card's heading rather than over the toolbar: it filters
             THIS table, and a box up beside Add medication would read as a
             search of the whole encounter. */
          spec.search
            ? `<ui-input id="logSearch" class="encv__log-filter" type="search" size="sm"
                 label="Search ${esc(spec.title)}" label-hidden icon="search"
                 placeholder="${esc(spec.search.placeholder)}"
                 value="${esc(logQueries[id] ?? '')}"
                 data-testid="encv--log-search"></ui-input>`
            : ''
        }
        ${spec.filters ? logFilterMarkup(spec) : ''}
      </div>
      ${sections
        .map(
          (section) => `<div class="encv__log-part">
          ${
            /* Only a split log has these. The heading IS the status of every
               row under it, which is why the rows no longer carry one. */
            section.title
              ? `<h4 class="encv__log-subtitle">${esc(section.title)}<span
                   class="encv__log-count">${section.rows.length}</span></h4>`
              : ''
          }
          <ui-data-table id="logTable-${section.key}" sticky-first density="compact"
            empty-text="${esc(emptyFor(section))}"
            data-testid="encv--log-table${spec.split ? `-${section.key}` : ''}"></ui-data-table>
        </div>`
        )
        .join('')}

      ${
        /* A filtered table has to say it is filtered. Without this the cart
           looks like it holds one drug, and the obvious reading of that is
           that everything else has been deleted. */
        searching
          ? `<p class="encv__log-note" data-testid="encv--log-filtered">Showing ${
              rows.length
            } of ${logRows[id].length} — filtered by search.</p>`
          : ''
      }
      ${
        /* And the same sentence for the other way of hiding rows. Said
           separately from the search line because a reader who has narrowed by
           severity has a different control to go and clear. */
        !searching && spec.filters && rows.length < logRows[id].length
          ? `<p class="encv__log-note" data-testid="encv--log-narrowed">Showing ${
              rows.length
            } of ${logRows[id].length} — filtered.</p>`
          : ''
      }
      ${
        /* WHERE ONE ROW GOES WHEN IT IS PRINTED.
           Empty on screen and empty most of the time on paper too — see
           printLogRow, which fills it for the length of the print dialog and
           empties it again. It is rendered here rather than built and appended
           on the press because the card is repainted from this template on
           every keystroke of the search box, and an element grafted on
           afterwards would be thrown away by the next repaint. */
        spec.print ? `<div class="encv__log-print" data-testid="encv--log-print"></div>` : ''
      }
    </section>`;

  sections.forEach((section) => {
    const table = el(`logTable-${section.key}`);
    const last = section.rows.length - 1;
    table.columns = tableColumns(spec, id);
    /* `_i` is the row's index in the LOG, not in this filtered view — carried so
       the pencil, the stop and the bin all act on the entry they are drawn
       beside even when a search has hidden half the table. */
    table.rows = section.rows;
    /* Flagged and latest, through the component's own hook rather than by reaching
       into its <tr>s afterwards — the table rebuilds its tbody on every set and
       would drop anything applied from outside. */
    table.rowClass = (row, i) =>
      `${row.high ? 'encv__log-row--flagged' : ''}${
        spec.markLatest && i === last ? ' encv__log-row--latest' : ''
      }`.trim();
    table.setAttribute('state', section.rows.length ? 'ready' : 'empty');
    table.addEventListener('click', rowAction);

    /* A counted log's boxes write straight back to the row they were drawn
       from, and redraw the two sums beside them. Delegated on the table for
       the same reason rowAction is: <ui-data-table> rebuilds its own tbody,
       and per-control listeners would be attached to nodes it has replaced. */
    if (spec.count) {
      table.addEventListener('ui-input', (event) => {
        const box = event.target.closest('[data-count-field]');
        if (!box) return;
        const index = Number(box.dataset.countRow);
        const row = logRows[id][index];
        if (!row) return;
        row[box.dataset.countField] = event.detail.value;
        refreshCount(table, spec, id, index);
      });
    }
  });

  el('logAdd')?.addEventListener('ui-click', () => openLogDrawer(id));

  /* Live, on every tick rather than on Done: the cards above the table are the
     reason somebody is ticking, and making them wait for a second press to see
     the number move would be asking them to guess what the filter did. */
  if (spec.filters) {
    const filter = el('logFilter');
    /* `value`, singular — the component's own name for the whole ticked state,
       `{ severity: ['Severe'] }`. Written back on every repaint because the
       control is rebuilt with the card around it. */
    filter.value = logFilter;
    ['ui-filter-change', 'ui-filter-clear'].forEach((event) =>
      filter.addEventListener(event, (e) => {
        logFilter = e.detail.values;
        paintLog(id);
      })
    );
  }

  /* Repainted on every keystroke, and the box is rebuilt with the card — so
     focus and the caret have to be put back, or typing a second character
     lands nowhere. */
  el('logSearch')?.addEventListener('ui-input', (event) => {
    logQueries[id] = event.detail.value;
    paintLog(id);
    const box = el('logSearch')?.querySelector('input');
    box?.focus();
    box?.setSelectionRange(box.value.length, box.value.length);
  });

  /* Delegated, because <ui-data-table> rebuilds its own tbody and per-button
     listeners would be attached to nodes it has already replaced. One handler
     for however many tables the log drew, since a row carries the index it
     acts on and not the table it happens to be sitting in. */
  function rowAction(event) {
    const edit = event.target.closest('[data-edit-row]');
    if (edit) {
      openLogDrawer(id, Number(edit.dataset.editRow));
      return;
    }

    /*
     * Taking a line down, and taking a drug off the cart.
     *
     * Neither happens on the press. Both open the confirm dialog first — see
     * openRowConfirm, and the note over #rowConfirm in screens/encounter.html
     * for why they share one. The stop REPLACES its row rather than appending:
     * a bag going up and coming down is one event with two ends, and a second
     * row would double the count of lines the patient had and leave the reader
     * to work out that they were the same one.
     */
    const stop = event.target.closest('[data-stop-row]');
    if (stop) {
      openRowConfirm(id, Number(stop.dataset.stopRow), 'stop');
      return;
    }

    const remove = event.target.closest('[data-remove-row]');
    if (remove) {
      openRowConfirm(id, Number(remove.dataset.removeRow), 'remove');
      return;
    }

    /* Reading the row, and printing it. Both straight through — there is
       nothing to confirm about either, and a dialog in front of an act that
       changes nothing would be a second press for no reason. */
    const view = event.target.closest('[data-view-row]');
    if (view) {
      openRowView(id, Number(view.dataset.viewRow));
      return;
    }

    const print = event.target.closest('[data-print-row]');
    if (print) {
      printLogRow(id, Number(print.dataset.printRow));
      return;
    }

    /* And the one press that is neither a correction nor a deletion: filing a
       counted line. See saveCountLine. */
    const save = event.target.closest('[data-save-row]');
    if (save) saveCountLine(id, Number(save.dataset.saveRow));
  }
}

/* ---------------------------------------------------------------------------
   PRINTING ONE ROW

   The print trio at the top of the column prints the DOCUMENT — on a log, that
   is the whole table, which is the right answer when what is wanted is the
   sedation record or the specimen list. It is the wrong answer when what is
   wanted is a copy of the note that went to the patient last Tuesday, and a
   register of twelve rows printed to get at one of them is a page the reader
   then has to go through with a highlighter.

   So the row's printer prints the row. There is no PDF library here and no
   build step — the same constraint the document toolbar works under — so this
   goes through the browser's print path like everything else, and the shaping
   is done in @media print: the card's head and its tables are taken off the
   paper for the length of the dialog, and the sheet below takes their place.

   ARMED, PRINTED, DISARMED, ALL IN ONE PRESS.
   window.print() blocks the page until the dialog is dismissed, so the two
   lines either side of it run before the paper is composed and after it is
   finished with. Nothing about the armed state ever reaches the screen, which
   is why this can reach into the card directly instead of going through a
   repaint: there is no frame in between for a repaint to draw.
   ------------------------------------------------------------------------ */

/** Arm the card with one row's sheet, hand it to the print path, disarm. */
function printLogRow(id, index) {
  const spec = ENCOUNTER_LOGS[id];
  const row = logRows[id]?.[index];
  if (!row) return;

  const card = document.querySelector(`[data-testid="encv--log-${id}"]`);
  const sheet = card?.querySelector('.encv__log-print');
  if (!sheet) return;

  /* The spec's rendering, not one composed here from its columns. A letter is
     a laid-out page rather than a list of the four facts the table shows, and
     it is the SAME rendering the View dialog draws — so what was read on
     screen and what comes out of the printer cannot drift. */
  sheet.innerHTML = spec.print.sheet(row);
  card.setAttribute('data-printing', 'true');
  /* Said before the dialog for the reason over printDocument: the dialog
     blocks, so a message fired after it would arrive as a report on something
     the reader had already finished doing. What it has to say is which of the
     two prints this is, because the toolbar's Print is a keypress away and
     produces a different page. */
  printDocument(
    `Printing the ${row[spec.columns[0].key] ?? 'selected'} entry — this row on its own, not the whole ${spec.title.toLowerCase()} log.`
  );
  card.removeAttribute('data-printing');
  sheet.innerHTML = '';
}

/* ---------------------------------------------------------------------------
   THE WHOLE STEP, ON ONE SHEET

   WHAT WAS WRONG WITH PRINTING A TABBED STEP
   Intra-procedure Management is eight documents worked alternately — see
   TABBED_STEPS. Only one of them is in the DOM at a time: paintWork replaces
   #docBody on every tab press, so the seven the reader is not looking at do not
   exist to print. Pressing Print therefore produced whichever log happened to
   be open and nothing else, and the sheet did not say so — a page headed
   "Intra-procedure Management" carrying the vitals table alone reads as the
   step's record, and filing it loses the times, the Aldrete scores, the
   fluids, the oxygen, the drugs given and the count off the cart.

   That is the wrong unit. Nobody files a third of a sedation record. The step
   IS the document here: what went in, when, and what the patient did about it,
   which is only an account of the case when it is all together and in order.

   SO THE TRIO PRINTS THE STEP. On a tabbed step Print, View PDF and Download
   PDF compose every substep — all eight, in rail order, whichever tab is open
   — and hand that over. The row printer is untouched: a single entry is still
   a single entry, and that is the one place a part of this step is worth
   printing on its own.

   COMPOSED, NOT SCRAPED. The rows are read from `logRows`, which is the case
   as charted, and the cells through cellText, which is the same formatter the
   on-screen tables use — so the paper cannot say something the screen does
   not. And they are read UNFILTERED: the search box and the severity filters
   are how somebody finds a row on screen, and a document that quietly dropped
   the rows a filter was hiding would be a record that is wrong about the case.
   ------------------------------------------------------------------------ */

/** Every row one log holds, as tables — its split parts kept apart. */
function sheetLogMarkup(id) {
  const spec = ENCOUNTER_LOGS[id];
  const rows = logRows[id] ?? [];

  /* Right-aligned on paper for the same columns the table right-aligns on
     screen: a column of figures read down is read down its last digit. */
  const align = (column) => (column.align === 'right' ? ' class="encv-sheet__num"' : '');

  return logSections(spec, rows)
    .map((section) => {
      /* A split log's part headings — "Running now" over the lines that are up,
         "Completed" over the ones that came down. On screen those headings ARE
         the status of every row under them, which is why the rows carry no
         status column; drop the headings on paper and the two tables become
         one undifferentiated list. */
      const heading = section.title
        ? `<h3 class="encv-sheet__sub">${esc(section.title)}</h3>`
        : '';

      if (!section.rows.length) {
        return `${heading}<p class="encv-sheet__empty">${esc(
          section.empty ?? spec.empty
        )}</p>`;
      }

      return `${heading}
        <table class="encv-sheet__table">
          <thead>
            <tr>${spec.columns
              .map((column) => `<th${align(column)}>${esc(column.label)}</th>`)
              .join('')}</tr>
          </thead>
          <tbody>
            ${section.rows
              .map(
                (row) => `<tr>${spec.columns
                  .map((column) => `<td${align(column)}>${esc(cellText(column, row))}</td>`)
                  .join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    })
    .join('');
}

/**
 * The one substep on this step that is not a log.
 *
 * Discharge is a checklist, a score read off the Aldrete log and a decision —
 * see paintToRecovery, which draws the same three things as controls. Printed
 * they are three statements, and the middle one is the reason the other two
 * are on the page: the score is what the tick was made against.
 */
function sheetDischargeMarkup() {
  const max = ALDRETE_CATEGORIES.length * 2;
  const score = latestAldreteTotal();
  const meets = score !== null && score >= ALDRETE_THRESHOLD;

  return `
    <h3 class="encv-sheet__sub">Discharge criteria checklist</h3>
    <ul class="encv-sheet__list">
      ${DISCHARGE_READINESS_CHECKS.map((check) => `<li>${esc(check.label)}</li>`).join('')}
    </ul>
    <dl class="encv-sheet__facts">
      <div>
        <dt>Latest Aldrete score</dt>
        <dd>${
          /* "Not yet assessed" rather than 0, for the reason paintToRecovery
             gives it: a score nobody has taken is not a score of nothing. */
          score === null
            ? 'Not yet assessed'
            : `${score}/${max} points — ${meets ? 'meets threshold' : 'below threshold'}`
        }</dd>
      </div>
      <div>
        <dt>Ready to discharge from procedure room</dt>
        <dd>${toRecovery.ready ? 'Yes' : 'No'}</dd>
      </div>
      ${
        toRecovery.updatedAt
          ? `<div><dt>Last updated</dt><dd>${esc(toRecovery.updatedAt)}</dd></div>`
          : ''
      }
    </dl>`;
}

/** The step as a filed document: who it is about, then every section of it. */
function stepSheetMarkup(step) {
  const facts = [
    ['Patient', patient?.name],
    ['MRN', patient?.mrn],
    ['Procedure', procedureLabel()],
    ['Date', appointment?.date ? shortDate(appointment.date) : ''],
    ['Recorded by', step.role],
  ].filter(([, value]) => Boolean(value));

  return `<article class="encv-sheet" data-testid="encv--step-sheet">
    <header class="encv-sheet__head">
      <h1 class="encv-sheet__title">${esc(step.label)}</h1>
      <dl class="encv-sheet__facts">
        ${facts
          .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
          .join('')}
      </dl>
    </header>

    ${step.substeps
      .map((sub) => {
        const spec = ENCOUNTER_LOGS[sub.id];
        const count = spec ? (logRows[sub.id]?.length ?? 0) : null;

        return `<section class="encv-sheet__part"
          data-testid="encv--sheet-part-${esc(sub.id)}">
          <h2 class="encv-sheet__part-title">
            ${/* The spec's own title, which is what the card says on screen —
                 not the tab label, which is shortened to fit a segment. */ ''}
            ${esc(spec?.title ?? (sub.id === 'to-recovery' ? 'Patient discharge status' : sub.label))}
            ${
              count === null
                ? ''
                : `<span class="encv-sheet__count">${count} ${
                    count === 1 ? 'entry' : 'entries'
                  }</span>`
            }
          </h2>
          ${
            spec
              ? sheetLogMarkup(sub.id)
              : sub.id === 'to-recovery'
                ? sheetDischargeMarkup()
                : /* A substep this screen has not built yet. Said out loud
                     rather than left out: a section missing from a printed
                     record reads as a section with nothing in it. */
                  `<p class="encv-sheet__empty">Not recorded on this encounter.</p>`
          }
        </section>`;
      })
      .join('')}
  </article>`;
}

/**
 * Hand the composed step to the print path.
 *
 * The message goes out first, for the reason printDocument gives — the dialog
 * blocks — and what it has to say is that this is the WHOLE step, because the
 * row printers a few inches below produce a single entry and the reader has
 * just pressed something called Print on a page showing one tab.
 */
function printStep(step, { message = null, download = false } = {}) {
  const markup = stepSheetMarkup(step);
  const count = step.substeps.length;

  say(
    message ??
      `Printing ${step.label} — all ${count} sections on one document, not just the open tab.`
  );

  if (!download) {
    printAsPdf({ markup });
    return;
  }

  /* The title is the filename the browser's Save dialog offers. Without it
     every saved sedation record on somebody's desktop is called
     "MediNova EHR — Encounter". */
  downloadAsPdf({
    title: `${step.label} — ${patient?.name ?? 'Patient'}${
      patient?.mrn ? ` (MRN ${patient.mrn})` : ''
    }`,
    markup,
  });
}

/* ---------------------------------------------------------------------------
   READING ONE ROW

   Every log but one is entirely visible in its own table: a set of
   observations, a bag of fluid, a specimen pot — the columns ARE the entry,
   and a dialog that opened to show them again would be showing the reader what
   they just clicked on.

   The Note register is the exception, because its row carries a letter. Four
   columns say who it went to and what it was about; the letter itself is the
   thing somebody opening a row wants, and it cannot go in a cell. So a log may
   declare `view`, and this draws whatever sheet the spec hands back.

   The footer is Close and Print, in that order, with Print as the primary —
   the two things there are to do with a letter you have finished reading, and
   the reason most people open one is to get a copy of it into the paper file.
   Print goes through printLogRow, the same path the row's own printer takes,
   so the dialog is not a third place that knows how to compose a letter.
   ------------------------------------------------------------------------ */

function openRowView(id, index) {
  const spec = ENCOUNTER_LOGS[id];
  const row = logRows[id]?.[index];
  if (!row) return;

  const dialog = el('rowView');
  dialog.setAttribute('heading', spec.view.heading ?? spec.title);
  el('rowViewBody').innerHTML = spec.view.sheet(row);
  el('rowViewActions').innerHTML = `
    <ui-button variant="tertiary" id="rowViewClose"
      data-testid="encv--row-view-close">Close</ui-button>
    <span class="ui-modal__actions-spacer"></span>
    <ui-button variant="primary" icon="printer" id="rowViewPrint"
      data-testid="encv--row-view-print">${esc(spec.print?.label ?? 'Print')}</ui-button>`;

  el('rowViewClose').addEventListener('ui-click', () => dialog.close?.());
  /* Shut FIRST, then print. The dialog is a fixed overlay with the page dimmed
     behind it, and a print fired from underneath it composes a sheet of paper
     with a modal on top of the letter. Closing it also puts the reader back on
     the register, which is where they are when the print dialog is dismissed. */
  el('rowViewPrint')?.addEventListener('ui-click', () => {
    dialog.close?.();
    printLogRow(id, index);
  });

  dialog.open?.();
}

/* ---------------------------------------------------------------------------
   THE ROW CONFIRM

   One dialog for the two things a log can do to a row that are not
   corrections: end a running IV solution, and take a medication off the
   formulary. Both are declared on the log's own spec — `stop` and `remove` in
   js/lib/encounter-logs.js — and this reads whichever of them was asked for.

   A stop may ask for one value on the way through. The IV log's does: the
   volume LEFT in the bag as it comes down, which is the one number still
   readable at that moment — infused is worked out from it by the spec, and is
   the figure the fluid balance is added up from. See the `stop` note in
   js/lib/encounter-logs.js for why the question is asked that way round.
   ------------------------------------------------------------------------ */

/** Which log and row the confirm dialog is open over, and which action. */
let confirmTarget = null;

function openRowConfirm(logId, index, action) {
  const spec = ENCOUNTER_LOGS[logId];
  const config = spec[action];
  const row = logRows[logId][index];
  if (!config || !row) return;

  confirmTarget = { logId, index, action };

  const ask = action === 'stop' ? config.confirm : null;
  el('rowConfirm').setAttribute('heading', config.heading);

  el('rowConfirmBody').innerHTML = `
    ${
      config.body
        ? `<p class="encv__confirm-text">${esc(config.body(row))}</p>`
        : ''
    }
    ${
      ask
        ? `<ui-input id="rowConfirmField" type="${esc(ask.type)}"
             label="${esc(ask.label)}" ${ask.required ? 'required' : ''}
             ${ask.hint ? `hint="${esc(ask.hint)}"` : ''}
             value="${esc(ask.default ? ask.default(row) : '')}"
             data-testid="encv--row-confirm-field"></ui-input>`
        : ''
    }
    ${
      /*
       * AND THIS DIALOG SIGNS TOO.
       *
       * Every add/edit modal on the run asks who is charting; these two asked
       * nobody, and they are not lesser acts. Ending a bag writes the infused
       * volume the fluid balance is added up from, and Delete takes a charted
       * administration off the record entirely — the line an auditor stops on
       * is more often the one that vanished than the one that was typed. A
       * press that does either without a name behind it is the gap the
       * initials button was introduced to close, left open on the two presses
       * hardest to undo.
       *
       * Its own id rather than the form's `logf-` prefix: this dialog is a
       * sibling of the drawer and both can hold a hidden input at once, and
       * two nodes answering to one id is how the wrong one gets read.
       */
      initialsFieldMarkup(
        { key: 'confirm-initials', label: 'Staff initials', required: true },
        logId,
        'rowConfirmInitials'
      )
    }
    <p class="encv__log-error" id="rowConfirmError" role="alert"></p>`;

  /* Always unpressed: a confirmation is a fresh act, not a row being reopened,
     so nothing about the entry being ended or deleted pre-confirms it. */
  wireInitialsControls(el('rowConfirmBody'), () => false);

  el('rowConfirmActions').innerHTML = `
    <ui-button variant="tertiary" id="rowConfirmCancel"
      data-testid="encv--row-confirm-cancel">Cancel</ui-button>
    <span class="ui-modal__actions-spacer"></span>
    <ui-button variant="primary" id="rowConfirmCommit"
      data-testid="encv--row-confirm-commit">${esc(config.commit)}</ui-button>`;

  el('rowConfirmCancel').addEventListener('ui-click', () => el('rowConfirm').close?.());
  el('rowConfirmCommit').addEventListener('ui-click', commitRowConfirm);

  /* open() puts focus on the dialog's first control by itself, which on a stop
     is the volume field and on a plain are-you-sure is Cancel — both correct,
     so nothing else is done about it here. */
  el('rowConfirm').open?.();
}

function commitRowConfirm() {
  if (!confirmTarget) return;
  const { logId, index, action } = confirmTarget;
  const spec = ENCOUNTER_LOGS[logId];
  const config = spec[action];
  const row = logRows[logId][index];
  if (!row) return;

  /* Checked before the action's own question, because it is the one this
     dialog will not proceed without either way — and an error naming the
     volume while the identity is also missing sends somebody round twice. */
  if (!String(el('rowConfirmInitials')?.value ?? '').trim()) {
    el('rowConfirmError').textContent = 'Staff initials are required.';
    return;
  }

  if (action === 'stop') {
    const ask = config.confirm;
    const answer = { [ask.key]: el('rowConfirmField')?.value ?? '' };
    if (ask.required && !String(answer[ask.key]).trim()) {
      el('rowConfirmError').textContent = `${ask.label} is required.`;
      return;
    }
    logRows[logId][index] = config.apply(row, answer);
    el('copyLive').textContent = `${spec.title} — entry ended.`;
  } else {
    logRows[logId].splice(index, 1);
    el('copyLive').textContent = `${spec.title} — entry removed.`;
  }

  confirmTarget = null;
  el('rowConfirm').close?.();
  repaintLog(logId);
}

/* ---------------------------------------------------------------------------
   THE ADD / EDIT MODAL

   Built from the same spec the table is, and used for both jobs — `index` is
   null to add and a row number to edit, the shape every other add/edit pair in
   this app uses (see Master's openForm). Two dialogs would be two sets of
   fields free to disagree about what a vital sign is.

   Centred rather than a side drawer: it is the only thing being done while it
   is open, and a modal at the edge of a three-column screen puts the form as
   far as possible from the table it is adding to.
   ------------------------------------------------------------------------ */

/** Which log the open modal belongs to, and which row — null when adding. */
let drawerLogId = null;
let drawerRowIndex = null;

/**
 * WHO IS CHARTING, AS A PRESS RATHER THAN A TEXT BOX.
 *
 * A sedation record's initials column is the field everybody fills with
 * whatever is quickest — and the whole point of it is that a NAMED person says
 * they gave the drug, took the score, hung the bag. Typed into a box that is
 * exactly as true of "xx" as of "MO". So it is a button that fills itself with
 * the session's initials when it is pressed, and is empty until it is: the act
 * is deliberate, and it is required, so the entry cannot be filed without one.
 *
 * The value lives in a hidden input carrying the field's id, because that is
 * where saveLogEntry and the required check already look — every other control
 * on the form answers to `el('logf-<key>').value` and this one has no business
 * being the exception.
 */
/*
 * WHOSE IDENTITY THE BUTTON IS CONFIRMING, AND WHAT CONFIRMING IT FILES.
 *
 * The run is charted by two people. The sedation record is the nurse
 * anaesthetist's and stamps its rows with initials; the orders, the specimens,
 * the complications and the notes are the endoscopist's and stamp a name. A
 * single fixture for both was fine while only the five sedation logs asked the
 * question — it is wrong now that all twelve do, because a doctor's form
 * offering to confirm the nurse's initials is a form that attributes an order
 * to somebody who did not write it.
 *
 * So each spec names its signer (`signer` in js/lib/encounter-logs.js, with
 * DEFAULT_SIGNER standing in for the eight that do not) and carries both
 * halves: the `name` the button shows the initials of, and the `stamp` the
 * confirmed press writes into the row. The Note's signer is a function,
 * because whose name goes on a letter is not known until the encounter is.
 */
function logSigner(logId) {
  const declared = ENCOUNTER_LOGS[logId]?.signer ?? DEFAULT_SIGNER;
  return typeof declared === 'function' ? declared() : declared;
}

/* Taken from the button rather than from whichever dialog is open, because two
   of them ask this now — the add/edit modal and the End/Delete confirm — and a
   module-level "the log being edited" was only ever true of the first. */
const buttonSigner = (button) => logSigner(button.dataset.initialsLog);

function initialsFieldMarkup(field, logId, id = `logf-${field.key}`) {
  const who = initials(logSigner(logId).name);
  return `<div style="grid-column: span 2">
    <span class="encv__initials-label">${esc(field.label)}${
      field.required ? ' <span aria-hidden="true">*</span>' : ''
    }</span>
    <div class="encv__initials">
      <button type="button" class="encv__initials-button" aria-pressed="false"
        data-initials-for="${id}" data-initials-log="${esc(logId)}"
        data-testid="encv--f-${field.key}">
        ${iconMarkup('user')}
        <span data-initials-text>Confirm my initials (${esc(who)})</span>
      </button>
      <span class="encv__initials-hint" data-initials-hint>Click to confirm your identity</span>
    </div>
    <input type="hidden" id="${id}" data-log-field="${field.key}" value="" />
  </div>`;
}

/**
 * Bind every initials control inside one dialog.
 *
 * `confirmed` decides the state they start in: an entry being CORRECTED keeps
 * whoever confirmed it — re-opening a row with the button back at "Confirm my
 * initials" would either make the correction unfileable or invite a second
 * person's initials onto somebody else's dose — while a confirm dialog is a
 * fresh act and always starts unpressed.
 */
function wireInitialsControls(root, confirmed = (button) => Boolean(el(button.dataset.initialsFor)?.value)) {
  root.querySelectorAll('[data-initials-for]').forEach((button) => {
    paintDrawerInitials(button, confirmed(button));
    button.addEventListener('click', () =>
      paintDrawerInitials(button, button.getAttribute('aria-pressed') !== 'true')
    );
  });
}

function fieldMarkup(field, logId) {
  const id = `logf-${field.key}`;
  const required = field.required ? ' required' : '';
  const span = field.span ? ' style="grid-column: span 2"' : '';
  const label = esc(field.label);

  if (field.type === 'initials') return initialsFieldMarkup(field, logId);

  if (field.type === 'select') {
    return `<div${span}><ui-select id="${id}" label="${label}"${required}
      data-log-field="${field.key}" data-testid="encv--f-${field.key}"></ui-select></div>`;
  }

  /*
   * A QUESTION THAT OPENS FOUR MORE.
   *
   * `toggle` is the only field on the run that is not an answer in itself: it
   * says whether the fields marked `showIf` for it are being asked at all. The
   * medication form's wastage half is the whole reason it exists — most pushes
   * waste nothing, and four permanent boxes on every dose form are four things
   * skipped mid-case by the person who most needed to answer them once.
   *
   * A checkbox rather than <ui-toggle>, and the difference is not cosmetic. A
   * switch reads as a setting that persists — something turned on for the
   * screen — and this is a statement about the dose in front of you, ticked
   * fresh on the one push in ten it is true of. The hint underneath says what
   * ticking it will DO, because filing a line onto the practice's register is
   * not a consequence anybody should discover afterwards.
   */
  if (field.type === 'toggle') {
    return `<div class="encv__log-switch"${span || ' style="grid-column: span 2"'}>
      <ui-checkbox id="${id}" data-log-field="${field.key}"
        data-testid="encv--f-${field.key}">${label}</ui-checkbox>
      ${field.hint ? `<p class="encv__log-switch-hint">${esc(field.hint)}</p>` : ''}
    </div>`;
  }

  /*
   * TYPED, OVER A LIST THAT IS VISIBLY THERE.
   *
   * The question that is a pick AND a name: the drug given is nearly always one
   * of the six on the cart, and occasionally is not one of them at all. A
   * <select> can only say the first half and a bare text box only the second.
   *
   * This was a native <datalist> first — the same control the stock form's
   * vendor and waste-reason boxes use — and it was wrong here for one reason:
   * the browser decides whether that list appears. On this field it did not.
   * The box wore a grey caret, nothing dropped under the typing, and a
   * formulary nobody can see is a formulary nobody uses. <ui-suggest> draws the
   * panel itself, so the six are under the cursor from the first keystroke.
   * The options are handed over in openLogDrawer.
   */
  if (field.type === 'suggest') {
    return `<div${span}><ui-suggest id="${id}" label="${label}"${required}
      placeholder="${esc(field.placeholder ?? '')}"
      ${field.emptyNote ? `empty-note="${esc(field.emptyNote)}"` : ''}
      data-log-field="${field.key}" data-testid="encv--f-${field.key}"></ui-suggest></div>`
      + quickSelectMarkup(field);
  }

  /* A PARAGRAPH RATHER THAN AN ANSWER.
     Every other field on every other log is a reading, a name or a pick from a
     closed list, and a single-line input is the honest control for all three.
     The complications register's Notes is not: it is asked to carry what
     happened, what was done about it and how it ended, and a one-line box tells
     the person writing it that a phrase will do. Same control the documents'
     textareas use, so a `textarea` on a log and a `textarea` on a form stay the
     same thing. */
  /* FIVE ROWS UNLESS THE FIELD SAYS OTHERWISE. Five is right for a
     complication — what happened, what was done, how it ended — and wrong for
     the Note log's Content, which arrives holding a drafted letter of about
     twenty lines. A box that has to be scrolled before the draft can be read
     over is how a letter goes out with the template's guess still in it.

     `mono` puts the box in the numeric face. Only correspondence asks for it:
     a letter is read as a laid-out page, with the letterhead lining up, and a
     proportional face makes a wrapped address look like prose. */
  if (field.type === 'textarea') {
    return `<div${span}><ui-textarea id="${id}" label="${label}"${required}
      rows="${field.rows ?? 5}"${field.mono ? ' class="encv__field-mono"' : ''}
      placeholder="${esc(field.placeholder ?? '')}"
      data-log-field="${field.key}" data-testid="encv--f-${field.key}"></ui-textarea></div>`;
  }

  /* The same map the documents' fields use — one answer to "what control does
     this field type get", so a `date` on a log and a `date` on a form are the
     same control. */
  const type = DOC_INPUT_TYPES[field.type] ?? 'text';
  return `<div${span}><ui-input id="${id}" type="${type}" label="${label}"${required}
    placeholder="${esc(field.placeholder ?? '')}"
    data-log-field="${field.key}" data-testid="encv--f-${field.key}"></ui-input></div>`;
}

/**
 * The formulary rows drawn under a field that declares `quickSelect`.
 *
 * A sibling of the field rather than something inside it, spanning both
 * columns of the drawer's grid: these are wide rows carrying three facts each,
 * and half a dialog is not enough to set a drug, its strength and its route on
 * one line. They follow the box they answer immediately, so "type it" and
 * "press it" are one decision in one place.
 *
 * Each row carries the name it writes, so the press is a lookup of nothing —
 * and it writes it THROUGH the field, not around it: see the wiring in
 * openLogDrawer, which puts the value in and then says so in the field's own
 * commit event. Everything that hangs off answering the field by hand — the
 * dose ladder narrowing, the usual dose and route filling in — therefore
 * happens on a press as well, without a second copy of any of it here.
 */
function quickSelectMarkup(field) {
  const options = field.quickSelect || [];
  if (!options.length) return '';

  return `<section class="encv__formulary" style="grid-column: span 2"
      data-testid="encv--formulary-${field.key}">
      <h3 class="encv__formulary-legend">Quick Select from Formulary:</h3>
      <div class="encv__formulary-list">
        ${options
          .map(
            (drug) => `<button type="button" class="encv__drug" aria-pressed="false"
              data-log-drug="${esc(drug.name)}" data-log-drug-for="${esc(field.key)}"
              data-testid="encv--drug-${esc(drug.name.toLowerCase())}">
              <strong>${esc(drug.name)}</strong>
              <span>${esc(drug.note ?? '')}</span>
            </button>`
          )
          .join('')}
      </div>
    </section>`;
}

/**
 * The options a select should be offering, given what is filled in so far.
 *
 * Most lists are fixed and this returns the spec's own. A field that names
 * `dependsOn` has its list computed instead — the dose ladder is the drug's,
 * and the drug is answered in another field. The value already in the control
 * is kept in the list whatever it says: a row filed before the ladder existed,
 * or under a drug that has since come off the cart, must not lose its dose to
 * being opened for a correction to its time.
 */
function selectOptions(spec, field, values) {
  const options = (spec.optionsFor?.(field.key, values ?? {}) ?? field.options) || [];
  const held = values?.[field.key];
  return held && !options.includes(held) ? [held, ...options] : options;
}

/**
 * Repaint every list that hangs off the field just answered.
 *
 * Rebuilt rather than filtered, because <ui-select> owns its own <option>s.
 * The answer is put back if the new list still contains it — changing the
 * route should not silently blank a dose that is still true — and dropped when
 * it does not, which is the case where it is no longer a dose of this drug.
 */
function repaintDependentOptions(spec, key, value) {
  if (!spec.optionsFor) return;
  spec.fields.forEach((field) => {
    if (field.dependsOn !== key) return;
    const node = el(`logf-${field.key}`);
    if (!node?.setOptions) return;

    const held = node.value;
    const options = selectOptions(spec, field, { [key]: value });
    /* An unchanged list is left alone: setOptions re-renders, and re-rendering
       a control on every keystroke of the field above it is churn nobody asked
       for. */
    if (node.optionList.map((o) => o.value).join('\u0000') === ['', ...options].join('\u0000')) return;
    node.setOptions(['', ...options]);
    node.value = options.includes(held) ? held : '';
  });
}

/** Set one initials control to confirmed or not, and hold the value with it. */
function paintDrawerInitials(button, confirmed) {
  const { name, stamp } = buttonSigner(button);
  const who = initials(name);
  button.setAttribute('aria-pressed', String(confirmed));
  button.classList.toggle('encv__initials-button--on', confirmed);
  button.querySelector('[data-initials-text]').textContent = confirmed
    ? who
    : `Confirm my initials (${who})`;
  button.querySelector('use')?.setAttribute('href', confirmed ? '#i-check' : '#i-user');
  button.closest('.encv__initials').querySelector('[data-initials-hint]').textContent = confirmed
    ? 'Identity confirmed'
    : 'Click to confirm your identity';
  /* The button SHOWS initials and STORES what the log stamps — the same two
     letters on the sedation record, the signer's name on the doctor's logs.
     Storing the display value on both would have quietly turned every new
     order, specimen and complication row's By column from "D. Smith, MD" into
     "DS", beside seeded rows that still read the name. */
  const store = el(button.dataset.initialsFor);
  if (store) store.value = confirmed ? stamp : '';
}

/**
 * The running total, under the form that is producing it.
 *
 * A score whose meaning only appears after the entry is filed is a score the
 * nurse has to save to read. `liveTotal` on a log spec says the form has one,
 * and this draws it against the threshold it has to clear.
 */
function paintLiveTotal() {
  const spec = ENCOUNTER_LOGS[drawerLogId];
  const host = el('logTotal');
  if (!host || !spec?.liveTotal) return;

  const { max, threshold, note, label, compute } = spec.liveTotal;
  const values = Object.fromEntries(
    spec.fields.map((field) => [field.key, el(`logf-${field.key}`)?.value ?? ''])
  );
  const total = compute(values);
  const ready = total >= threshold;

  host.innerHTML = `<div>
      <strong>${esc(label)}</strong>
      <span class="encv__log-total-note">${esc(note)}</span>
    </div>
    <span class="encv__log-total-pill${ready ? ' encv__log-total-pill--ok' : ''}"
      data-testid="encv--log-total">${total} / ${max}</span>`;
}

/**
 * The sentence under the form saying what the commit will do.
 *
 * Same shape as paintLiveTotal and repainted off the same events: it depends on
 * answers, so it has to follow them. Empty until the answer it depends on has
 * been given — a line that says "this will be sent to" with nothing after it is
 * worse than no line.
 */
function paintLiveNote() {
  const spec = ENCOUNTER_LOGS[drawerLogId];
  const host = el('logNote');
  if (!host || !spec?.liveNote) return;

  const text = spec.liveNote(currentFormValues(spec)) ?? '';
  host.textContent = text;
  host.hidden = !text;
}

function openLogDrawer(id, index = null) {
  const spec = ENCOUNTER_LOGS[id];
  drawerLogId = id;
  drawerRowIndex = index;

  const editing = index !== null;
  /* Editing an entry that already exists is not "Record vitals". The heading is
     the one place the difference is visible before the form is submitted. */
  el('logDrawer').setAttribute('heading', editing ? `Edit — ${spec.title}` : spec.addLabel);
  el('logForm').innerHTML =
    spec.fields
      .map((field) => {
        const markup = fieldMarkup(field, id);
        /*
         * A FIELD THAT IS ONLY SOMETIMES ASKED.
         *
         * `showIf` names the toggle above it, and the wrapper exists so one
         * press can hide a run of fields without any of them knowing about each
         * other. It is `display: contents` in the stylesheet, so the fields
         * inside stay direct children of the drawer's two-column grid and keep
         * their own spans — a wrapper that participated in the grid itself
         * would silently widen every field it held.
         *
         * Hidden with the `hidden` attribute rather than a class, because that
         * is the one that takes the fields out of the accessibility tree and
         * out of the tab order too. A wastage witness that can be tabbed into
         * while the wastage question is unticked is a field somebody fills and
         * then watches vanish.
         */
        return field.showIf
          ? `<div class="encv__log-when" data-log-when="${esc(field.showIf)}" hidden>${markup}</div>`
          : markup;
      })
      .join('') +
    (spec.liveTotal
      ? '<div class="encv__log-total" id="logTotal" aria-live="polite" style="grid-column: span 2"></div>'
      : '') +
    /* WHAT THE COMMIT IS ABOUT TO DO, SAID BEFORE IT IS PRESSED.
       The Note log's button does not save a row, it posts a letter — to the
       patient portal, to an email address, down a fax line — and which of
       those depends on an answer given three fields up. A confirmation that
       arrives only afterwards tells somebody where their letter has gone,
       which is the wrong half of the sentence to be certain about. So the
       destinations are on the form, under the fields that decide them, and the
       toast afterwards confirms the same list. */
    (spec.liveNote
      ? '<p class="encv__log-commit-note" id="logNote" aria-live="polite" style="grid-column: span 2" data-testid="encv--log-commit-note"></p>'
      : '');
  el('logError').textContent = '';

  /* The footer is rebuilt, never relabelled — see the note in the markup. */
  el('logActions').innerHTML = `
    <ui-button variant="tertiary" id="logCancel"
      data-testid="encv--log-cancel">Cancel</ui-button>
    <span class="ui-modal__actions-spacer"></span>
    <ui-button variant="primary" id="logSave"
      data-testid="encv--log-save">${
        /* "Record" is right for a reading taken off a monitor and wrong for a
           drug being put on the cart list, which is added. A log that files
           something other than an observation says so with `commit`. */
        editing ? 'Save changes' : spec.commit ?? 'Record'
      }</ui-button>`;
  el('logCancel').addEventListener('ui-click', () => el('logDrawer').close?.());
  el('logSave').addEventListener('ui-click', saveLogEntry);

  const existing = editing ? spec.toForm?.(logRows[id][index]) ?? logRows[id][index] : null;

  spec.fields.forEach((field) => {
    const node = el(`logf-${field.key}`);
    if (field.type === 'select') {
      customElements.whenDefined('ui-select').then(() => {
        /* setOptions rather than the `options` attribute, which is a
           comma-joined string and so cannot carry an option containing one.
           It is also the list repaintDependentOptions reads back. */
        const options = selectOptions(spec, field, existing ?? {});
        node.setOptions(['', ...options]);
        /* A default on a select had to be honoured HERE rather than in the
           branch below, and used not to be honoured at all. This callback runs
           a tick or two after the drawer opens — once <ui-select> is defined —
           so anything the synchronous pass wrote into `node.value` was
           overwritten by the blank on this line. Nothing noticed while the only
           defaults on the run were on time fields; the medication form defaults
           two selects, and both would have opened empty. */
        node.value = editing
          ? formValue(existing, field, options)
          : field.default?.() ?? '';
        paintLiveTotal();
      });
    }
    /* THROUGH selectOptions, THE WAY A <select> IS.
       A suggest used to be filled from `field.options` alone, which meant a
       spec could answer `optionsFor` for it and be ignored — the Note log's
       Recipient box offered nothing at all, because the two names worth
       offering are the referring clinician and the patient and neither is
       knowable from a static list in a spec file. There is one answer to "what
       is this field offering", and both controls read it. */
    if (field.type === 'suggest') {
      customElements.whenDefined('ui-suggest').then(() =>
        node.setOptions(selectOptions(spec, field, existing ?? {}))
      );
    }
    /* A checkbox has no `value` to write — it is ticked or it is not — and
       writing one would leave the control unticked with a string hanging off
       it that nothing reads. Reopening a dose that recorded a wastage has to
       come back with the box ticked and the four fields under it showing, or
       the correction files a row that says nothing was wasted. */
    if (field.type === 'toggle') node.checked = editing && Boolean(existing?.[field.key]);
    else if (editing) node.value = formValue(existing, field);
    else if (field.default) node.value = field.default();
  });

  wireInitialsControls(el('logForm'));

  /*
   * THE FIELDS A TOGGLE OPENS, SHOWN AND HIDDEN.
   *
   * Delegated on the form rather than bound to the checkbox, for the reason
   * the live total and the live note are: the drawer's controls define
   * themselves a tick or two after this runs, and a listener attached to a
   * node that is about to re-render is a listener on nothing. Run once up
   * front as well, so a row reopened with its wastage already recorded shows
   * the wastage fields before anybody touches anything.
   */
  if (spec.fields.some((field) => field.showIf)) {
    const paintConditionalFields = () => {
      el('logForm').querySelectorAll('[data-log-when]').forEach((wrap) => {
        const control = el(`logf-${wrap.dataset.logWhen}`);
        wrap.hidden = !(control?.checked ?? false);
      });
    };
    el('logForm').addEventListener('ui-change', paintConditionalFields);
    paintConditionalFields();
  }

  /* The total re-adds as the answers land — see paintLiveTotal. Delegated on
     the form, so it survives the selects filling themselves in later. */
  if (spec.liveTotal) {
    ['ui-change', 'ui-input'].forEach((event) =>
      el('logForm').addEventListener(event, paintLiveTotal)
    );
    paintLiveTotal();
  }

  /* Delegated on the form for the reason the total is: the selects fill
     themselves in a tick or two after the drawer opens, and a listener on the
     control would be attached to a node that is about to be replaced. */
  if (spec.liveNote) {
    ['ui-change', 'ui-input'].forEach((event) =>
      el('logForm').addEventListener(event, paintLiveNote)
    );
    paintLiveNote();
  }

  /*
   * ONE ANSWER FILLING IN THE OTHERS.
   *
   * Two things hang off a field being answered — the values another field is
   * pre-filled with, and the list another field is offering — and they are
   * done in that order because the pre-filled dose has to land on an option
   * that by then exists.
   *
   * `ui-input` as well as `ui-change`, so a name that is typed rather than
   * picked fills in as soon as it is complete rather than when the field is
   * finally left. Both hooks answer null for anything that is not a drug the
   * formulary knows, so the half-typed keystrokes on the way there change
   * nothing.
   *
   * AND EACH ANSWER FILLS IN ONCE. A typed field commits on every keystroke and
   * again on blur, so the same name arrived here several times — and each
   * arrival re-applied the formulary's usual dose, quietly undoing the dose the
   * nurse had just chosen the moment they tabbed out of the name. The pre-fill
   * is a suggestion made when the answer CHANGES, not a rule enforced while it
   * stays the same, so what each field last filled from is remembered and an
   * unchanged answer does nothing. Opening a row for correction seeds that
   * memory with what the row already says, for the same reason: nothing about
   * editing a time should reach in and reset a dose.
   */
  if (spec.prefill || spec.optionsFor) {
    const lastAnswer = new Map(
      editing ? spec.fields.map((field) => [field.key, formValue(existing, field)]) : []
    );
    const answered = (node, event) => {
      const key = node.dataset.logField;
      const { value } = event.detail;
      if (lastAnswer.get(key) === value) return;
      lastAnswer.set(key, value);

      repaintDependentOptions(spec, key, value);
      /* The whole form as it stands, alongside the one answer that changed.
         The dose ladder only ever needed the drug that was picked; the Note
         log's composer needs the type AND the recipient AND whatever is in the
         body already, because it is deciding whether it may redraft. Specs
         that do not take a third argument are unaffected. */
      const filled = spec.prefill?.(key, value, currentFormValues(spec));
      if (!filled) return;
      Object.entries(filled).forEach(([target, next]) => {
        const field = el(`logf-${target}`);
        if (field) field.value = next;
        /* What the pre-fill wrote is this field's answer now — the field's own
           commit event is about to say so, and must not be mistaken for the
           user changing their mind. */
        lastAnswer.set(target, next);
      });
    };
    el('logForm').querySelectorAll('[data-log-field]').forEach((node) =>
      ['ui-change', 'ui-input'].forEach((type) =>
        node.addEventListener(type, (event) => answered(node, event))
      )
    );
  }

  /*
   * A DRUG PRESSED OFF THE CART.
   *
   * The press does not fill the form in; it answers the field, and lets the
   * form fill itself in the way it already does for a name that was typed.
   * The value goes into the control and the control's own commit event is
   * fired behind it, so the dose ladder narrows and `prefill` writes the usual
   * dose and route through exactly the path a typed "Propofol" takes. Anything
   * that is ever added to that path is on the buttons the same day.
   *
   * Wired here rather than delegated on the form, because the buttons are
   * rebuilt with the form on every open — new nodes each time, so nothing
   * accumulates.
   *
   * Focus lands on the field AFTER the one answered — the dose, which is the
   * one thing the cart cannot know. The rest of the row is already filled in
   * by the time the cursor arrives.
   */
  el('logForm').querySelectorAll('[data-log-drug]').forEach((button) => {
    button.addEventListener('click', () => {
      const { logDrug: name, logDrugFor: key } = button.dataset;
      const node = el(`logf-${key}`);
      if (!node) return;

      node.value = name;
      node.dispatchEvent(new CustomEvent('ui-change', { detail: { value: name }, bubbles: true }));

      /* Which row was pressed, said on the row. The field above it now reads
         the drug's name, but that box is also the box somebody may have typed
         into, so it cannot be the only answer to "did that press register". */
      el('logForm').querySelectorAll('[data-log-drug]').forEach((other) => {
        other.classList.toggle('encv__drug--picked', other === button);
        other.setAttribute('aria-pressed', String(other === button));
      });

      const next = spec.fields[spec.fields.findIndex((f) => f.key === key) + 1];
      if (next) el(`logf-${next.key}`)?.focus?.();
    });
  });

  el('logDrawer').open?.();
  customElements.whenDefined('ui-input').then(() =>
    setTimeout(() => el(`logf-${spec.fields[0].key}`)?.focus?.(), 0)
  );
}

/*
 * A stored row read back into the control that wrote it.
 *
 * The row holds what the table needs — "168/99", "12 min", "9 / 10" — and the
 * form needs what was typed. Stripping the unit back off is the price of
 * storing rows ready to render; the alternative is a second copy of every
 * entry in raw form, which is a second thing to keep in step.
 */
function formValue(row, field, options = field.options) {
  /* The confirmed initials are filed in the row's `by` column rather than under
     the field's own key — one attribution per row, not two saying the same
     thing — so that is where a correction reads them back from.
     Unless the row DOES hold the field's own key, which is the medication
     form: it asks twice, once for the dose and once for the wastage witness,
     and two buttons cannot both read back out of one `by`. A row that stores
     the answer under the field's key wins; every other log stores nothing
     there and still falls through to `by`. */
  const raw =
    field.type === 'initials' ? row?.[field.key] ?? row?.by : row?.[field.key];
  if (raw === undefined || raw === null || raw === '—') return '';
  const text = String(raw);

  if (field.type === 'number') {
    const number = text.match(/-?\d+(\.\d+)?/);
    return number ? number[0] : '';
  }
  /* A select's stored value may be the short form the table shows — Ramsay is
     filed as "3" and chosen as the whole sentence — so the option that starts
     with it is the one to re-select. */
  if (field.type === 'select' && options) {
    return (
      options.find((option) => option === text) ??
      options.find((option) => String(option).startsWith(`${text} `)) ??
      options.find((option) => String(option).startsWith(text)) ??
      ''
    );
  }
  return text;
}

/**
 * Every field on the open drawer, read back off the controls.
 *
 * Two callers, which is why it is a function: the save, which needs the whole
 * form to build a row from, and the pre-fill, which needs it to decide what a
 * changed answer implies about the answers around it.
 */
function currentFormValues(spec) {
  return Object.fromEntries(spec.fields.map((field) => [field.key, fieldValue(field)]));
}

/**
 * One field, read off whichever control the type put on the form.
 *
 * `value` answers for every control on the run but one. A checkbox is ticked or
 * it is not, and reading `.value` off <ui-checkbox> returns undefined — which
 * arrives at the spec's `build` as an empty string, indistinguishable from a
 * box nobody ticked, so a recorded wastage would have filed silently as no
 * wastage at all. The tick becomes a string here rather than a boolean because
 * everything downstream of a log field — the required check, the row a spec
 * builds — is written for strings.
 */
function fieldValue(field) {
  const node = el(`logf-${field.key}`);
  if (!node) return '';
  if (field.type === 'toggle') return node.checked ? 'yes' : '';
  return node.value ?? '';
}

function saveLogEntry() {
  const spec = ENCOUNTER_LOGS[drawerLogId];
  const typed = currentFormValues(spec);

  /*
   * WHAT AN EDIT MUST NOT SILENTLY THROW AWAY.
   *
   * A row can hold facts no field on the form owns, because they were not
   * typed into it: an IV bag's status and the volume that went in are put
   * there by the End dialog, not by the form that hung it. Building the row
   * from the typed values alone meant a correction to a spelling in the Notes
   * of a finished bag rebuilt it without either — the spec's `build` fell back
   * to Active, the bag jumped out of Completed and back into the running
   * table, and the infused volume the fluid balance is added up from was gone
   * with no way to get it back.
   *
   * So an edit starts from the row it is editing and the form writes over it.
   * Nothing here needs to know which keys those are; the spec's `build` reads
   * whichever ones it named, and a log whose rows hold nothing but typed
   * answers is unaffected.
   */
  const values =
    drawerRowIndex === null ? typed : { ...logRows[drawerLogId][drawerRowIndex], ...typed };

  /* Checked here rather than left to each spec, because "required" is a
     property of the field and every log would otherwise write its own loop. */
  const missing = spec.fields
    .filter((field) => {
      if (!field.required) return false;
      /* A field its toggle is hiding is not a field anybody declined to
         answer. Checked against the form as it stands rather than against the
         row being edited, so unticking the wastage question on a correction
         lets the dose be filed without the witness the closed half is still
         holding. */
      if (field.showIf && !String(typed[field.showIf] ?? '').trim()) return false;
      return !String(typed[field.key] ?? '').trim();
    })
    .map((field) => field.label);

  if (missing.length) {
    el('logError').textContent = `Still needed: ${missing.join(', ')}.`;
    return;
  }

  const row = spec.build(values);
  /* Overwrite in place when editing, so the entry keeps its position in the
     log. Re-appending an edited row would reorder the record by when somebody
     corrected a typo rather than by when the observation was made. */
  if (drawerRowIndex === null) logRows[drawerLogId].push(row);
  else logRows[drawerLogId][drawerRowIndex] = row;

  const editing = drawerRowIndex !== null;

  /*
   * WHAT HAPPENS OUTSIDE THE ENCOUNTER WHEN A ROW LANDS.
   *
   * Only the administration log declares a `post`, and what it posts is a
   * stock movement: a drug that came off the trolley has to reach the shelf's
   * own record of itself, or the chart and the inventory go on being two
   * systems that happen to be about the same drugs. See `post` on 'meds-given'
   * in js/lib/encounter-logs.js.
   *
   * NEW ROWS ONLY, and that is the load-bearing half of this. An edit corrects
   * what a record SAYS about something that already happened; it does not make
   * it happen a second time. Posting on every save meant fixing a typo in the
   * witness initials of a midazolam push took another ampoule off the shelf,
   * and the shelf then sat below the room by however many times somebody had
   * gone back to tidy the record — which is exactly the drift the ledger was
   * written to remove.
   *
   * The case context is stamped here rather than asked for on the form. The
   * encounter knows who the patient is and what is being done to them; a nurse
   * standing over them should not be retyping it, and a typed copy is one more
   * thing that can disagree with the header.
   */
  if (!editing && spec.post) {
    spec.post(row, {
      patient: patient?.name ?? '',
      mrn: patient?.mrn ?? '',
      procedure: procedureLabel(),
      provider: providerById(appointment?.providerId)?.name ?? REPORT_STAFF.endoscopist,
    });
  }

  el('logDrawer').close?.();
  /*
   * WHAT THE PRESS ACTUALLY DID, WHERE THAT IS MORE THAN "SAVED".
   *
   * "Note — entry recorded" is a true sentence and a useless one on the log
   * where recording it also posts it to the patient portal, emails it and
   * faxes it. A press with three consequences the reader cannot see has to
   * name them, or the only evidence a letter went anywhere is a row that looks
   * exactly like a row that has not. A log says so with `recorded`; the other
   * eleven have nothing to add and keep the flat line.
   *
   * Through say() rather than the live region alone, because a toast is what
   * the reader is looking at when the drawer closes — the live region is heard
   * and not seen, and this is a report on something that has already happened
   * to the outside world.
   */
  const announcement = (!editing && spec.recorded?.(row)) || null;
  if (announcement) say(announcement);
  else el('copyLive').textContent = `${spec.title} — entry ${editing ? 'updated' : 'recorded'}.`;
  repaintLog(drawerLogId);
}

/* ===================== Step 2: discharge to recovery ===================== */

/*
 * THE STEP THAT STOPPED BEING A LOG.
 *
 * Discharge to recovery used to be a thirteenth log: a table of handovers and a
 * "Record handover" button that opened the same drawer every other log opens.
 * A patient is handed to recovery ONCE, so the table was a running sheet with
 * room for exactly one row — and it opened empty, on a step whose real question
 * is not "what has been recorded" but "may this patient go".
 *
 * So the step reads back the decision instead. The five readiness lines the
 * bedside checks, the Aldrete score the first of them is judged against — taken
 * from the Aldrete log on this same step rather than retyped, because a second
 * copy of the score is how the two come to disagree at the one moment they must
 * not — and the single tick that says the decision was made.
 *
 * The score line is DERIVED and stays derived: nothing here can tick the
 * threshold by hand. See DISCHARGE_READINESS_CHECKS in
 * data/procedure-encounter.js for why that one is marked apart from the other
 * four.
 */

/**
 * The decision, kept outside the paint so a tick survives leaving the step.
 *
 * `mark` is the sign-off once it has been given, and it is a NAME AND A
 * TIMESTAMP — never a drawn one. The person deciding this is standing at the
 * trolley already logged in, the screen knows who they are, and a squiggle
 * made with a mouse resembles nobody's handwriting and adds nothing the
 * session did not already say. It is the same answer the anaesthesia
 * professional's three signatures and the endoscopist's three give on this
 * run; see ANAESTHESIA_SIGNATURE in js/lib/encounter-docs.js for the argument
 * in full, and paintSignatureBlock in js/lib/signature-block.js for why a
 * typed attestation deliberately files no image at all.
 */
const toRecovery = { ready: false, updatedAt: '', mark: null };

/**
 * Whose name goes on the sign-off.
 *
 * Whoever is signed in, because who lets a patient out of the procedure room
 * is decided at the trolley on the day and not by a fixture chosen weeks ago.
 * Step 1's nurse stands in when there is no session to read — see the import.
 */
function dischargeSigner() {
  return sessionSigner() ?? PRE_CHECK_SIGNATURE.nurse;
}

/** The clock, as this card prints it under itself. */
const stampNow = () =>
  new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

/**
 * The latest Aldrete total, as a number, or null before any has been scored.
 *
 * The log stores it as "8 / 10" — the form the table prints — so the number is
 * read back off the front of that rather than kept a second time.
 */
function latestAldreteTotal() {
  const rows = logRows.aldrete ?? [];
  const latest = rows[rows.length - 1];
  if (!latest) return null;
  const total = Number.parseInt(String(latest.total), 10);
  return Number.isNaN(total) ? null : total;
}

function paintToRecovery() {
  const max = ALDRETE_CATEGORIES.length * 2;
  const score = latestAldreteTotal();
  const meets = score !== null && score >= ALDRETE_THRESHOLD;

  /* Nothing to ADD — there is no row to record here — so the toolbar is the
     print trio only. Filing is the bar at the bottom; see
     paintToRecoveryFoot. */
  paintDocActions();

  el('docBody').innerHTML = `
    <section class="encv__doc-section" data-testid="encv--to-recovery">
      <h3 class="encv__doc-legend">Patient Discharge Status</h3>
      <div class="encv__doc-section-body">

        <section class="encv__rec-criteria">
          <h4 class="encv__rec-legend">Discharge Criteria Checklist</h4>
          <ul class="encv__rec-criteria-list" role="list">
            ${DISCHARGE_READINESS_CHECKS.map(
              (check) => `<li data-testid="encv--rec-criterion-${check.id}">${esc(
                check.label
              )}</li>`
            ).join('')}
          </ul>
        </section>

        <div class="encv__rec-latest">
          <span class="encv__rec-latest-icon" aria-hidden="true">${iconMarkup('document')}</span>
          <div>
            <strong>Latest Aldrete Score</strong>
            ${/* "Not yet assessed" rather than 0/10: a score nobody has taken is
                 not a score of nothing, and a zero on this line reads as a
                 patient in trouble. */ ''}
            <p class="encv__doc-note" data-testid="encv--rec-score">${
              score === null ? 'Not yet assessed' : `${score}/${max} points`
            }</p>
          </div>
          <ui-badge status="${meets ? 'success' : 'warning'}" data-testid="encv--rec-threshold"
            >${meets ? 'Meets Threshold' : 'Below Threshold'}</ui-badge>
        </div>

        ${
          /*
           * THE DECISION, AND THEN THE NAME AGAINST IT — IN TWO STATES THAT
           * SAY DIFFERENT THINGS RATHER THAN THE SAME THING TWICE.
           *
           * The signed card used to stack five lines that were all one fact:
           * a greyed-out tick, "Patient approved for discharge", "Signed
           * electronically by X", the mark with the name under it again, and a
           * "Last updated" stamp in a third format. Four names and three
           * timestamps for one signature — and the line that matters most, the
           * decision itself, was the faintest of them because a disabled
           * checkbox greys its own label.
           *
           * So each state carries only what is not already said:
           *
           *   unsigned — the tick, its echo in words once it is on, and a
           *              sentence naming who the press will file it as, so
           *              nobody discovers whose name went on it afterwards.
           *   signed   — the decision as a STATEMENT in full ink, and the mark.
           *              The echo goes: a signed attestation says more than
           *              "approved" ever did. The tick goes with it, because an
           *              input nobody may touch is not a control — Sign again,
           *              under the mark, is how the decision is released.
           */ ''
        }
        <div class="encv__rec-ready" data-signed="${String(Boolean(toRecovery.mark))}">
          ${
            toRecovery.mark
              ? `<p class="encv__rec-locked" data-testid="encv--rec-locked">
                  <span aria-hidden="true">${iconMarkup(
                    'check'
                  )}</span>Ready to Discharge from Procedure Room
                </p>
                <div class="encv__rec-sign" data-sign-host="to-recovery"
                  data-testid="encv--rec-sign"></div>`
              : `<ui-checkbox id="recReady" ${toRecovery.ready ? 'checked' : ''}
                  data-testid="encv--rec-ready">Ready to Discharge from Procedure Room</ui-checkbox>
                ${
                  toRecovery.ready
                    ? `<p class="encv__rec-approved" data-testid="encv--rec-approved">
                        <span aria-hidden="true">${iconMarkup(
                          'check'
                        )}</span>Patient approved for discharge
                      </p>`
                    : ''
                }
                <p class="encv__doc-note encv__rec-signing" data-testid="encv--rec-signing"
                  >Sign &amp; Save files this as ${esc(
                    dischargeSigner()
                  )}, with the time it is signed.</p>`
          }
        </div>

        ${
          /* AND ONLY WHILE IT IS UNSIGNED. This line reports on the CARD — when
             the tick last moved — which is worth saying right up until a
             signature says it better, in words, with a name attached. Kept
             after that it was a third rendering of one instant, in a third
             format, under the two that had already given it. */
          toRecovery.updatedAt && !toRecovery.mark
            ? `<p class="encv__doc-note encv__rec-updated" data-testid="encv--rec-updated"
                >Last updated: ${esc(toRecovery.updatedAt)}</p>`
            : ''
        }
      </div>
    </section>`;

  /* The filed mark is drawn by the same module the run's eight document
     signatures are drawn by, so a nurse's sign-off and an anaesthetist's look
     like one thing rather than two. Only ever called WITH a mark: an unsigned
     block would render the pad, and this card's signature is not drawn — the
     bar at the bottom is what takes it. */
  if (toRecovery.mark) {
    paintSignatureBlock(el('docBody').querySelector('[data-sign-host="to-recovery"]'), {
      id: 'to-recovery',
      mark: toRecovery.mark,
      onClear: unsignToRecovery,
    });
  }

  /* There is no tick on a signed card — the decision is a statement by then —
     so there is nothing to bind. */
  el('recReady')?.addEventListener('ui-change', (event) => {
    toRecovery.ready = event.detail.checked;
    toRecovery.updatedAt = stampNow();
    /* Repainted rather than patched: the approved line and the stamp both come
       and go with the tick, and two hand-written DOM updates for one fact is
       how they end up disagreeing. */
    paintToRecovery();
    el('copyLive').textContent = toRecovery.ready
      ? 'Patient approved for discharge.'
      : 'Discharge approval withdrawn.';
    notify(
      toRecovery.ready
        ? 'Patient approved for discharge.'
        : 'Discharge approval removed — the patient stays in recovery.',
      toRecovery.ready ? 'success' : 'info'
    );
  });

  paintToRecoveryFoot();
}

/*
 * THE BOTTOM BAR, AND WHY THIS ONE CARRIES A BUTTON.
 *
 * The nine form-shaped documents' foot reports and offers nothing: seven of
 * them end in a pad, so by the time the foot could offer a commit the mark is
 * already down and a button under it would read as though the pad had not
 * counted (see paintDocFoot).
 *
 * This card has no pad, and that left it as the one place on the run where a
 * decision was made anonymously. The tick stamped a time and no name — a
 * patient left a procedure room and the record could not say who let them.
 * Without a control there is no MOMENT at which the decision is made either:
 * a checkbox is a setting, and this is an attestation.
 *
 * So the bar says what is outstanding and then offers Sign & Save — the
 * arrangement step 1's checklist uses, for the same reason. A commit that can
 * be pressed at any time with no statement of what is unanswered invites
 * signing a half-worked card.
 */
function paintToRecoveryFoot() {
  const max = ALDRETE_CATEGORIES.length * 2;
  const score = latestAldreteTotal();
  const meets = score !== null && score >= ALDRETE_THRESHOLD;

  el('docFoot').hidden = false;

  /*
   * SIGNED: the bar reports and stops offering anything.
   *
   * Taking the sign-off back off is Sign again, drawn under the mark it would
   * be removing, rather than a second control down here — an Unsign at the far
   * end of the card from the signature is a press whose target the reader has
   * to work out.
   */
  if (toRecovery.mark) {
    /* The name, not the name and the moment: the mark a few inches above is
       carrying the timestamp, in the format every other signature on the run
       is read in. A bar that repeated it made the same instant appear twice on
       one screenful written two different ways. */
    el('docHint').textContent = `Signed and filed by ${toRecovery.mark.name}.`;
    el('docHint').dataset.tone = 'ready';
    el('docFootActions').innerHTML = '';
    return;
  }

  /*
   * THE SCORE IS STATED, NOT ENFORCED.
   *
   * A patient below the Aldrete threshold is occasionally discharged from the
   * room anyway, on a decision somebody makes and owns — which is exactly what
   * this bar now collects. Disabling the press on a derived number would put
   * that decision beyond the record instead of inside it. The tick is the only
   * gate; the number is said out loud beside it so nobody signs past it
   * without having read it.
   */
  const scoreNote =
    score === null
      ? 'No Aldrete score has been taken yet.'
      : meets
        ? ''
        : `Aldrete ${score}/${max} is below the threshold of ${ALDRETE_THRESHOLD}.`;

  const lead = toRecovery.ready
    ? `Ready to sign as ${dischargeSigner()}.`
    : 'Not signed — tick the discharge decision above, then sign.';

  el('docHint').textContent = scoreNote ? `${scoreNote} ${lead}` : lead;
  el('docHint').dataset.tone = toRecovery.ready && meets ? 'ready' : 'outstanding';

  /* Rebuilt rather than relabelled: <ui-button> reads its label once on
     connect, so a button whose text is rewritten in place keeps the first one.
     Same `lg` primary the checklist's commit uses — this is the one press on
     the step that files anything. */
  el('docFootActions').innerHTML = `
    <ui-button variant="primary" size="lg" id="recSign"
      ${toRecovery.ready ? '' : 'disabled'}
      data-testid="encv--rec-sign-save">Sign &amp; Save</ui-button>`;
  el('recSign').addEventListener('ui-click', signToRecovery);
}

/**
 * File the sign-off: a typed name and the moment, and nothing else.
 *
 * `signedAtLabel` is the signature module's own clock, so this mark's caption
 * reads exactly like the eight on the documents rather than in this card's
 * dd/mm/yyyy stamp — two ways of writing the same instant on one encounter is
 * how a record starts arguing with itself. The card's own "Last updated" line
 * keeps its format, because it is reporting on the CARD and not on a
 * signature.
 */
function signToRecovery() {
  if (!toRecovery.ready || toRecovery.mark) return;

  toRecovery.mark = { name: dischargeSigner(), method: 'type', at: signedAtLabel() };
  toRecovery.updatedAt = stampNow();
  paintToRecovery();

  el('copyLive').textContent = `Discharge signed by ${toRecovery.mark.name}.`;
  notify(`Discharge from the procedure room signed by ${toRecovery.mark.name}.`, 'success');
}

/**
 * Sign again — the mark comes off and the tick is released with it.
 *
 * The decision itself is deliberately LEFT TICKED. Withdrawing a signature is
 * usually the wrong person having signed, not the wrong decision, and clearing
 * the tick as well would make the commonest correction on the card into two
 * presses and a re-read of the criteria.
 */
function unsignToRecovery() {
  toRecovery.mark = null;
  toRecovery.updatedAt = stampNow();
  paintToRecovery();

  el('copyLive').textContent = 'Discharge sign-off withdrawn.';
  notify('Sign-off withdrawn — the discharge is unsigned again.', 'info');
}

/* ===================== Step 1: the pre-procedure checklist ===================== */

/*
 * WHAT THIS SCREEN CHANGES ABOUT THE SHEET, AND WHAT IT DOES NOT.
 *
 * Not the questions, not the reveal rules, and not the gate — those are all
 * js/lib/pre-check-form.js, mounted unchanged. What this screen owns is the
 * chrome around it:
 *
 *   - `header: false`, because the working column already has a title band. The
 *     sheet's own heading row would be a second one saying the same thing.
 *   - `viewPdf: false`. View PDF and Download PDF render the same sheet, one to
 *     look at and one to keep — and the sheet is on screen being looked at.
 *   - Each section drawn as a card with a marked edge, so the sheet reads as a
 *     count of things to work through rather than one long form. That is CSS
 *     over the sheet's own markup; see .encv .pck__section.
 *   - One commit at the foot, stated in words, rather than a strip of equals.
 *
 * It used to add one thing of its own: a signature block below the sheet — the
 * portal's pad — replacing the sheet's read-only Staff Initials stamp, so a
 * nurse put a drawn or uploaded mark to the sheet that says this patient is
 * safe to sedate, and could not file it without one. That is gone. The sheet is
 * mounted whole again, sign-off section and all, and filing it is gated on the
 * questions alone. Signing belongs to whoever mounts the sheet, and this host
 * has decided it does not ask for one.
 */
function paintChecklist() {
  /* The sheet's own View PDF is dropped and this screen's is used instead —
     one pair of PDF controls on the toolbar, wired the same way as every other
     document's. See pdfActionsMarkup for why View is offered at all. */
  paintDocActions(preCheckActionsMarkup({ viewPdf: false, downloadPdf: false }));
  el('docBody').innerHTML = preCheckSheetMarkup({ actions: false, header: false });

  preCheckSheet = mountPreCheckSheet({
    root: el('docBody'),
    /* Set Default and Use Default live in the working column's TOOLBAR, which
       is a sibling of the sheet rather than part of it — so the mount has to
       be told where to find them. See mountPreCheckSheet. */
    actionsRoot: el('docActions'),
    /* The values this screen is holding win over the record, so answers given,
       navigated away from and come back to are still there. */
    appointment: state.preCheckValues ? { preCheck: state.preCheckValues } : appointment,
    context: { sex: patient.sex, age: patient.age },
    notify: (message) => {
      el('copyLive').textContent = message;
      el('docHint').textContent = message;
    },
    onChange: (missing) => {
      state.preCheckOutstanding = missing;
      state.preCheckValues = preCheckSheet?.values() ?? state.preCheckValues;
      /* The foot under the sheet is the only place the count is read now. It
         used to be read twice — here and on an Intake button in a strip across
         the top of the screen — and two readings of one list is two numbers to
         keep agreeing for a button that jumped to the sheet already on screen. */
      paintChecklistFoot();
    },
  });

  paintChecklistFoot();
}

/**
 * Whose name goes on the filed sheet — whoever is signed in and working the
 * sheet, read off the mount rather than duplicated here so the stamp on screen
 * and the name in the record can never disagree.
 *
 * It used to read the sheet's fixture nurse, which named the same person for
 * everybody; the mount now derives it from the session and falls back to that
 * fixture only when there is no session to read.
 */
function checklistSigner() {
  return preCheckSheet?.signer?.() ?? preCheckSheet?.signature?.nurse ?? 'the attending nurse';
}

/*
 * The foot says what is left, then offers the commit.
 *
 * In that order and on one line, because "Update checklist" is only meaningful
 * next to how much of it is answered — a button that can be pressed at any time
 * with no statement of what is still missing invites signing a half-worked
 * sheet. The count is the sheet's own gate (preCheckOutstanding), not a second
 * rule that could disagree with it.
 */
function paintChecklistFoot() {
  /* The gate is the sheet's own count of unanswered questions and nothing
     else. There is no signature on step 1 — the sheet closes with the Staff
     Initials stamp it carries itself, auto-filled from the session, which is
     not something anyone has to answer and so is not part of the count. */
  const outstanding = state.preCheckOutstanding ?? [];
  const done = outstanding.length === 0;

  el('docFoot').hidden = false;
  el('docHint').textContent = done
    ? 'Checklist complete — nothing left to answer.'
    : `${outstanding.length} still to answer: ${outstanding.slice(0, 3).join(', ')}${
        outstanding.length > 3 ? `, and ${outstanding.length - 3} more` : ''
      }.`;
  el('docHint').dataset.tone = done ? 'ready' : 'outstanding';

  /* Rebuilt rather than relabelled: <ui-button> reads its label once on
     connect, so a button whose text is rewritten in place keeps the first one.
     `lg` and `primary` because this is the only commit on the screen and the
     brief asked for it to carry — everything else here is an outline. */
  el('docFootActions').innerHTML = `
    <ui-button variant="secondary" id="checklistReset"
      data-testid="encv--checklist-reset">Reschedule</ui-button>
    <ui-button variant="primary" size="lg" id="checklistUpdate"
      ${done ? '' : 'disabled'}
      data-testid="encv--checklist-update">Update checklist</ui-button>`;
  el('checklistUpdate').addEventListener('ui-click', commitChecklist);
  el('checklistReset').addEventListener('ui-click', () => {
    el('docHint').textContent = 'Rescheduling is not built in the prototype yet.';
  });
}

/*
 * Filing the sheet.
 *
 * It writes through to the appointment record — data/appointment-store.js, the
 * same store check-in and the scheduler work in — rather than being held in
 * this module. The sheet then survives a reload and is readable by anything
 * else that opens the appointment, which is the whole reason a checklist filed
 * in the bay is worth filing at all.
 */
function commitChecklist() {
  if ((state.preCheckOutstanding ?? []).length) return;

  /* Stamped first, and by the sheet rather than here: the Staff Initials
     section is the sheet's own, so the moment and the name that go into the
     record have to be the moment and the name it just painted. Doing it in
     this order also means values() below reads the sheet WITH the stamp on
     it. */
  const stamp = preCheckSheet?.markCompleted?.() ?? {
    by: checklistSigner(),
    at: new Date().toISOString(),
  };

  state.preCheckValues = preCheckSheet?.values() ?? state.preCheckValues;
  if (appointment) {
    updateAppointment(appointment.id, {
      preCheck: {
        ...state.preCheckValues,
        signed: true,
        /* Who filed it travels with the answers. A signed flag on its own says
           the sheet was closed but not by whom, which is the first thing asked
           of it afterwards. The name is the sheet's own — the nurse the Staff
           Initials stamp names — since nothing on screen asks for another. */
        signedBy: stamp.by,
        signedAt: stamp.at,
      },
    });
  }
  preCheckSheet?.markSaved();

  /*
   * Filed, then straight into the room.
   *
   * The foot used to say the pre-anaesthesia assessment was next and leave the
   * nurse on the sheet they had just closed. Both halves were wrong. The step
   * the checklist hands the patient to is INTRA-PROCEDURE MANAGEMENT — the
   * times, the vitals, the Aldrete scores charted while the scope is in, which
   * is what the same nurse does next and what the rail puts directly below the
   * checklist. Pre-anaesthesia is the CRNA's step and is worked in parallel;
   * naming it here sent the person who just signed to somebody else's document.
   *
   * A toast rather than the foot's hint, because the foot goes with the step:
   * a confirmation written into #docHint would be painted over by the document
   * we are opening, and the press would look like it did nothing.
   */
  say(`Checklist filed by ${stamp.by}. Opening Intra-procedure Management.`);
  openStep('intra');
}

/* ===================== Every other step, for now ===================== */

/*
 * The placeholder says what is missing, and no longer repeats the title.
 *
 * The head above it names the step and the document, so the placeholder says
 * the one thing the head does not: that nothing is built here yet, and — where
 * the fixture carries one — the note that came with the document, such as the
 * standing order set's "no specific dosing".
 */
function paintPlaceholder(step, sub) {
  /* Nothing to print — a placeholder is the absence of a document, and a
     Download PDF over it would offer a file of the words "not built yet". */
  el('docActions').innerHTML = '';
  el('docFoot').hidden = true;

  el('docBody').innerHTML = `
    <div class="encv__empty" data-testid="encv--empty">
      <span class="encv__empty-icon">${iconMarkup('document')}</span>
      <p class="encv__empty-title">Not built yet</p>
      <p class="encv__empty-note">${esc(
        sub?.note
          ? `${sub.note}. This document has not been built into the prototype.`
          : 'This document has not been built into the prototype.'
      )}</p>
    </div>`;
}

/* ===================== Selection ===================== */

function openStep(id) {
  /* Pressing the step you are already on folds its documents away. Anywhere
     else, the step opens and its documents come with it. */
  if (id === state.step && state.expanded.has(id)) {
    state.expanded.delete(id);
  } else {
    state.step = id;
    state.substep = firstSubstep(stepById(id));
    state.expanded.add(id);
  }
  paintStepper();
  paintWork();
}

function openSubstep(stepId, substepId) {
  state.step = stepId;
  state.substep = substepId;
  state.expanded.add(stepId);
  paintStepper();
  paintWork();
}

/* ===================== Right rail: the clinical picture ===================== */

/*
 * The standing clinical picture, and only that.
 *
 * It sits in the RIGHT rail rather than beside the patient on the left,
 * because the stepper and the record were competing for one column's height —
 * and the record is what a clinician reads mid-sentence while charting rather
 * than something they navigate by.
 *
 * The rail itself — its markup, its cards, its copy buttons and the reasoning
 * behind every one of them — is js/lib/clinical-rail.js. It moved there when
 * the clinic visit stopped rendering its own second version of the same
 * fourteen sections in its own left column: one patient's allergy list is one
 * thing, drawn one way, wherever an encounter is being charted from.
 */
/* ===================== The rails ===================== */

/*
 * Both rails fold to a spine, and the rules for when they do that on their own
 * live with the rail component — js/lib/clinical-rail.js. They are the same
 * rules for a stepper as for a clinical record apart from one thing: which one
 * the layout folds first. A map of the encounter stays open wherever there is
 * room for it; a reference panel starts folded at every width that has a spine.
 * `wireRailCollapse` reads that off the side it is given.
 */
function railToggle(side) {
  wireRailCollapse({
    rail: el(side === 'left' ? 'railLeft' : 'railRight'),
    cols: el('cols'),
    side,
    name: side === 'left' ? 'encounter steps' : 'clinical data',
  });
}

/* ===================== Boot ===================== */

paintHeader();
paintPatient();
paintAlerts();
paintStepper();
/* paintWork paints the booking card as well — it is the step that decides
   whether there is one. */
paintWork();
mountClinicalRail({
  rail: el('railRight'),
  announce: (message) => {
    el('copyLive').textContent = message;
  },
  /*
   * The Encounter tab, on a procedure day too.
   *
   * The rail is the same rail on all three kinds of encounter, and the note
   * history is wanted here as much as on a clinic visit — more, arguably: the
   * indication for the scope, the surveillance interval set at the last one and
   * the pathology that came back from it are all in earlier notes, and the
   * endoscopist reads them mid-case.
   *
   * NO `onImport`, deliberately. The centre column of a step run is whichever
   * document the step is up to — a checklist, a report, a discharge — so there
   * is no single note for an import to land in, and a button that guessed
   * between them would be writing into whichever document happened to be open.
   * Without it the rail draws Copy instead of Import, which is the same bargain
   * the clinical sections already strike on this screen. See the note over
   * `sectionText` in js/lib/clinical-rail.js.
   */
  mrn: appointment?.mrn ?? '',
  before: appointment?.date ?? '',
  exclude: appointment?.id ?? '',
});
wireDocTabs();
railToggle('left');
railToggle('right');


/* ===========================================================================
   THE SCRIBE ON THIS REPORT

   The component listens, drafts and hands sections over; it knows nothing
   about this screen. What lives here is the one thing only the screen can do —
   put a section's words into a field of the document that is open — and the
   two ways that can fail.
   ======================================================================== */

/** The procedure room's material, as the scribe takes it. */
const PROCEDURE_SCRIBE = {
  /* What the pill offers to write here. This document is a report. */
  noun: 'Report',
  speakers: PROCEDURE_SPEAKERS,
  transcript: PROCEDURE_TRANSCRIPT,
  duration: PROCEDURE_DURATION,
  draft: PROCEDURE_DRAFT,
  stages: PROCEDURE_STAGES,
};

/**
 * Copy one drafted section into the document that is open.
 *
 * Returns false when it cannot be placed, which is not an error to shout
 * about: the scribe drafts for the procedure report, and the run has thirteen
 * other documents. Pressing Copy to note while the discharge sheet is open
 * should say so and leave the section offered, not write an impression into a
 * consent form.
 *
 * APPENDED, NEVER OVERWRITTEN, for the reason the visit note does the same: an
 * endoscopist who has already typed a line has written it about this patient,
 * and no draft is worth losing it.
 */
function copyScribeSection(section) {
  const docId = state.substep && ENCOUNTER_DOCS[state.substep] ? state.substep : state.step;
  const spec = ENCOUNTER_DOCS[docId];
  const field = spec?.sections
    .flatMap((entry) => entry.fields ?? [])
    .find((entry) => entry.key === section.field);

  if (!field) {
    say(
      `Open the procedure report to take the draft — this document has no ` +
        `${section.title.toLowerCase()} field.`
    );
    return false;
  }

  const values = valuesFor(docId);
  const existing = String(values[section.field] ?? '').trim();
  values[section.field] = existing ? `${existing}\n\n${section.text}` : section.text;

  /*
   * AND THE CARD IS MARKED AS HAVING TAKEN MACHINE TEXT.
   *
   * A signature at the foot of this report covers every word above it,
   * including the words a model wrote. The clinician read them in the draft
   * panel and pressed a button, which is consent — but consent given in a
   * dialog that is now closed, to a paragraph that from this moment looks
   * exactly like one they typed.
   *
   * So the card says so, on the document, for as long as the document is open.
   * It is not a warning and it does not stop anything: it is provenance, which
   * is the thing a reader six months later has no other way of recovering, and
   * the thing the endoscopist wants to see before they sign.
   *
   * Kept on the answers rather than in the DOM so that it survives the repaint
   * a dozen other things trigger — see aiFilledFor.
   */
  aiFilledFor(values).add(section.field);

  /* Written onto the live control rather than through a repaint, which would
     rebuild every field on the report and take the caret with it. The badge
     goes on the same way, for the same reason. */
  const node = el('docBody')?.querySelector(`[data-doc-field="${section.field}"]`);
  if (node) {
    node.value = values[section.field];
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  markAiFilled(docId, values);

  paintDocFoot(docId);
  return true;
}

/** The fields on one document that took text from the scribe. */
function aiFilledFor(values) {
  values.aiFilled ??= new Set();
  return values.aiFilled;
}

/**
 * Put the badge on every card holding a field the scribe filled.
 *
 * Applied to the painted document rather than built into docSectionMarkup, for
 * the reason the specimen chips are: a section is marked because of something
 * that happened to it, and the renderer that draws sections has no business
 * knowing where their text came from. Idempotent, so it can be called after
 * any paint and after each individual insert.
 */
function markAiFilled(id, values) {
  const body = el('docBody');
  if (!body) return;

  const filled = aiFilledFor(values);
  const spec = ENCOUNTER_DOCS[id];
  if (!spec) return;

  spec.sections.forEach((section) => {
    const host = body.querySelector(`[data-section="${section.id}"]`);
    if (!host) return;

    const took = (section.fields ?? []).some((field) => field.key && filled.has(field.key));
    const badge = host.querySelector('.encv__ai-badge');
    if (!took) {
      badge?.remove();
      return;
    }
    if (badge) return;

    host
      .querySelector('.encv__doc-legend')
      ?.insertAdjacentHTML(
        'beforeend',
        `<span class="encv__ai-badge" data-testid="encv--ai-filled-${esc(section.id)}">
          ${iconMarkup('sparkle')}AI filled
        </span>`
      );
  });
}

mountAiScribe({
  host: el('aiScribe'),
  source: PROCEDURE_SCRIBE,
  onCopy: copyScribeSection,
  announce: say,
});
