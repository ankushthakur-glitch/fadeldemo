/**
 * THE PRE-PROCEDURE CHECKLIST SHEET.
 *
 * One host today — encounter.html, step 1 of the procedure run, which is where
 * the nurse works it with the patient in the room.
 *
 * It had a second host: screens/pre-check.html, a page of its own opened from
 * the booking, which check-in handed over to. That page is gone. The sheet was
 * identical either side of the hand-off, so a patient being checked in meant
 * working it, filing it, and then arriving at an encounter that opened the
 * same sheet again.
 *
 * The split between this file and its host is worth keeping even with one host
 * left: the markup and behaviour live here and the HOST supplies the chrome —
 * its own header, its own notice line, and what a completed sheet means to it.
 * A second copy of this form would be two sheets free to drift apart, and the
 * one sheet that cannot is the one saying a patient is safe to sedate.
 *
 * WHAT THE HOST OWNS
 *   the appointment record       passed in; the sheet never reads the URL
 *   notify()                     where a message goes on this screen
 *   onChange()                   called after every edit, so the host can
 *                                re-gate whatever it gates
 *
 * WHAT THIS OWNS
 *   every field on the sheet, the derived outstanding list, and the practice
 *   default. Signing is NOT here — it is the one action that means something
 *   different in each host (the bay hands the patient on; the room advances a
 *   step), so each host wires its own commit and calls values() for the data.
 *
 * WHERE THE QUESTIONS THEMSELVES LIVE
 * Not here. js/lib/pre-check-fields.js declares every field — its control, the
 * rule that reveals it, and whether it has to be answered — and this file
 * renders that declaration. The sheet is around a hundred and eighty questions
 * now; hand-written markup for that many is where a reveal rule and its grid
 * cell drift apart without anyone noticing.
 */
import {
  PATIENT_VERIFICATION_CHECKS,
  ALLERGY_CHECKS,
  ALLERGY_TYPES,
  ALLERGY_REACTIONS,
  ALLERGY_SEVERITIES,
  NPO_CHECKS,
  NPO_EXTENDED,
  NEEDLE_GAUGES,
  IV_SITES,
  IV_TRIALS,
  NUMERIC_RANGES,
  PRE_CHECK_DEFAULT,
  PRE_CHECK_SEED,
  PRE_CHECK_SIGNATURE,
  migratePreCheck,
} from '../../data/pre-check.js';
import {
  PRE_CHECK_SECTIONS,
  eachField,
  isGlp1,
  abnormalVitals,
  trialCount,
} from './pre-check-fields.js';
import { PRACTICE_PROFILES } from '../../data/practice.js';
import { currentSession } from './auth-store.js';
import { iconMarkup } from './icons.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ============================================================================
   TIME

   Stamps are stored as UTC ISO and rendered in the facility's zone. Those are
   two different things and the sheet used to conflate them: a local "07:41"
   filed in Fargo and read in a browser set to another zone was silently a
   different moment, and the one field on this sheet that a coroner might read
   back is the one saying when the patient entered the room.
   ========================================================================= */

/** 'America/Chicago (CST)' → 'America/Chicago'. The label is for people. */
const FACILITY_ZONE = (PRACTICE_PROFILES?.asc?.timeZone ?? 'America/Chicago').split(' ')[0];

const stampNow = () => new Date().toISOString();

/**
 * Render a stamp in the facility's zone.
 *
 * Accepts the legacy 'HH:MM' shape as well, because sheets filed before stamps
 * were ISO are still in the store — those are shown as they were recorded,
 * without pretending to know which zone they were typed in.
 */
function displayTime(value, { seconds = true } = {}) {
  if (!value) return 'Not recorded';

  const legacy = /^(\d{2}):(\d{2})$/.exec(value);
  if (legacy) {
    const h = Number(legacy[1]);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${String(hour).padStart(2, '0')}:${legacy[2]} ${suffix}`;
  }

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(at);
}

/**
 * The same stamp with the day in front of it.
 *
 * A time alone answers "when in the shift" and nothing else. What is being
 * stamped here is who closed a safety checklist and when — read back days or
 * years later, off a sheet that may sit beside another dated the same hour on
 * a different day — so the date travels with the clock or the stamp cannot be
 * placed at all.
 */
function displayStamp(value) {
  if (!value) return 'Not recorded';

  const at = new Date(value);
  // Legacy 'HH:MM' sheets carry no day to show; displayTime renders those as
  // they were recorded rather than inventing today's date for them.
  if (Number.isNaN(at.getTime())) return displayTime(value, { seconds: false });

  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(at);

  return `${day}, ${displayTime(value, { seconds: false })}`;
}

/**
 * Who is closing the sheet — the person at the keyboard, not the fixture.
 *
 * The stamp used to read the demo nurse's name out of PRE_CHECK_SIGNATURE no
 * matter who was signed in, which made it decoration: a field that says the
 * same thing for everybody records nothing about anybody. It reads the session
 * instead, and falls back to the fixture only when there is no session at all
 * — a sheet opened straight off a deep link, where naming the demo nurse is
 * still better than naming nobody.
 */
function currentSigner() {
  const session = currentSession();
  if (!session?.name) return PRE_CHECK_SIGNATURE.nurse;
  return session.role ? `${session.name}, ${session.role}` : session.name;
}

/**
 * How far the facility's zone is from UTC at a given instant, in ms.
 *
 * Formatting the instant into the zone and reading it back as if it were UTC
 * gives the offset, including whichever side of a daylight-saving change the
 * instant falls on. Doing it by hand rather than with a library because the
 * prototype has no build step and this is the only place that needs it.
 */
function zoneOffsetMs(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_ZONE,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')
  );
  return asUtc - instant.getTime();
}

/**
 * A wall-clock time in the FACILITY's zone, as a UTC instant.
 *
 * The nurse typing "08:15" means quarter past eight in Fargo, not quarter past
 * eight wherever the browser happens to think it is. Reading the typed time in
 * the browser's zone is how a correction made on a machine set to another zone
 * came back rendered as the previous evening.
 *
 * Two passes: the first offset is looked up at roughly the right instant, the
 * second re-checks it in case that guess landed the wrong side of a
 * daylight-saving boundary.
 */
function facilityWallTimeToIso(baseInstant, hours, minutes) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(baseInstant);
  const get = (type) => Number(parts.find((p) => p.type === type).value);

  const naive = Date.UTC(get('year'), get('month') - 1, get('day'), hours, minutes, 0, 0);
  let stamp = naive - zoneOffsetMs(new Date(naive));
  stamp = naive - zoneOffsetMs(new Date(stamp));
  return new Date(stamp).toISOString();
}

/** An ISO stamp as the 'HH:MM' a native time input wants, in facility time. */
function isoToLocalTimeInput(value) {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** 'Kayla Brandt, RN' → 'KB' — the initials the sheet auto-fills. */
function initialsOf(name) {
  return name
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/* ============================================================================
   MARKUP

   The shell only. Sections are rendered by the mount, because what is on the
   sheet depends on what has been answered on it.

   `actions` is optional because the room does not need Set Default / Preview
   Default / Use Default / PDF sitting over the sheet — those belong to the bay, where the
   sheet is set up before the case.
   ========================================================================= */

/**
 * `title` may be empty, and is where the sheet is opened from a stepper that
 * has already named the step — printing it again is the same heading twice,
 * one under the other.
 */
/**
 * The sheet's five document actions, on their own.
 *
 * Exported so a HOST can put them in its own card header, beside its own title,
 * rather than the sheet drawing a second header underneath it. Embedded in the
 * encounter that is what happened: the host's heading row had a title and an
 * empty right-hand half, and the sheet's row had five buttons and no title —
 * two bands of chrome to say what one says.
 *
 * They are still wired by mountPreCheckSheet, which scopes its lookups to the
 * mount root; a host card header inside that root is found either way.
 */
/**
 * `viewPdf: false` and `downloadPdf: false` drop the sheet's own PDF pair.
 *
 * The encounter turns both off — not because the sheet should have no PDF, but
 * because that screen offers View PDF and Download PDF over EVERY document in
 * the run from one place, and two Download PDFs side by side in one toolbar is
 * a question about which of them is the real one. The default keeps both, so a
 * host that says nothing is unaffected.
 */
export function preCheckActionsMarkup({ viewPdf = true, downloadPdf = true } = {}) {
  return `<ui-button variant="outline" size="sm" data-pck="setDefault"
      data-testid="pck--set-default">Set Default</ui-button>
    <ui-button variant="outline" size="sm" data-pck="previewDefault"
      data-testid="pck--preview-default">Preview Default</ui-button>
    <ui-button variant="outline" size="sm" data-pck="useDefault"
      data-testid="pck--use-default">Use Default</ui-button>
    ${
      viewPdf
        ? `<ui-button variant="outline" size="sm" data-pck="viewPdf"
             data-testid="pck--view-pdf">View PDF</ui-button>`
        : ''
    }
    ${
      downloadPdf
        ? `<ui-button variant="outline" size="sm" data-pck="downloadPdf"
             data-testid="pck--download-pdf">Download PDF</ui-button>`
        : ''
    }`;
}

export function preCheckSheetMarkup({
  actions = true,
  header = true,
  title = 'Pre-Procedure Verification Checklist',
} = {}) {
  /* `header: false` says the host is providing the heading row. The sheet then
     drops its own frame too: nested inside the host's card it was a second
     border and a second inset around the same content. */
  return `<section class="pck__card${header ? '' : ' pck__card--embedded'}">
    ${
      header
        ? `<header class="pck__card-head${title ? '' : ' pck__card-head--actions-only'}">
             ${
               title
                 ? `<h2 class="pck__card-title">${iconMarkup('document')}${esc(title)}</h2>`
                 : ''
             }
             ${actions ? `<div class="pck__card-actions">${preCheckActionsMarkup()}</div>` : ''}
           </header>`
        : ''
    }

    <!-- One column, every section open, in the order they are worked through.
         The sheet reads as a single document from arrival to sign-off — which
         is how the paper form it replaces reads, and how it is checked back
         over afterwards. -->
    <div class="pck__sheet">
      <div class="pck__card-body" data-pck="sections"></div>
    </div>
    ${actions ? `<div class="pck__sticky" data-pck="sticky" data-testid="pck--sticky"></div>` : ''}

    <!--
      THE THREE DIALOGS BELONG TO THE DEFAULT TRIO, NOT TO THE STICKY FOOTER.

      They used to render only when "actions" was true, which is the sheet's
      own footer — and the encounter mounts with actions: false and puts Set
      Default / Preview Default / Use Default in its own toolbar. So in the
      room the buttons were there and the dialogs they open were not: Use
      Default over a part-worked sheet reached for a modal that did not exist
      and threw, which looked exactly like a button that does nothing. The
      dialogs are chrome for the default trio and the trio is always offered,
      so they are always rendered.
    -->
    <ui-modal data-pck="overwriteModal" heading="Overwrite answers already given?"
      data-testid="pck--overwrite-modal">
      <p class="pck__confirm-text" data-pck="overwriteBody"></p>
      <div slot="footer">
        <ui-button variant="outline" data-pck="overwriteCancel"
          data-testid="pck--overwrite-cancel">Keep what is there</ui-button>
        <ui-button variant="danger" data-pck="overwriteConfirm"
          data-testid="pck--overwrite-confirm">Overwrite</ui-button>
      </div>
    </ui-modal>

    <!--
      Set Default rewrites the template every sheet after this one starts from,
      for everybody. It is one press, it looks exactly like Use Default beside
      it, and until now it happened silently — the only evidence was a line of
      toast that had gone by the time anyone wondered what they had just
      pressed. So it asks first, and says what it is about to save.
    -->
    <!--
      PREVIEW DEFAULT — WHAT USE DEFAULT IS ABOUT TO DO, BEFORE IT DOES IT.

      Use Default is a template nobody in the room can see. It is set by
      whoever last pressed Set Default, it is invisible until it lands on the
      sheet, and the only account of it afterwards is a line of toast. On a
      part-worked sheet that made it a press people avoided: filling ten blanks
      was worth having, but not at the price of not knowing what the eleventh
      answer was going to be. So the template is readable first — grouped the
      way the sheet is grouped, each line marked with what Use Default would
      actually do to it, and with Use Default offered from inside the dialog so
      reading it and taking it is one gesture rather than two presses and a
      guess in between.

      It is a preview, never a write. Nothing here touches the sheet unless the
      reader presses the button that says so.
    -->
    <ui-modal data-pck="previewModal" size="lg" heading="The practice default for this checklist"
      data-testid="pck--preview-modal">
      <div data-pck="previewBody"></div>
      <div slot="footer">
        <ui-button variant="outline" data-pck="previewClose"
          data-testid="pck--preview-close">Close</ui-button>
        <ui-button variant="primary" data-pck="previewApply"
          data-testid="pck--preview-apply">Use these answers</ui-button>
      </div>
    </ui-modal>

    <ui-modal data-pck="setDefaultModal" heading="Save this sheet as the practice default?"
      data-testid="pck--set-default-modal">
      <p class="pck__confirm-text" data-pck="setDefaultBody"></p>
      <div slot="footer">
        <ui-button variant="outline" data-pck="setDefaultCancel"
          data-testid="pck--set-default-cancel">Cancel</ui-button>
        <ui-button variant="primary" data-pck="setDefaultConfirm"
          data-testid="pck--set-default-confirm">Save as default</ui-button>
      </div>
    </ui-modal>
  </section>`;
}

/* ============================================================================
   THE GATE

   What is still unanswered on a set of values — the rule, without a DOM.

   The encounter has to know whether the sheet is complete before it has ever
   been on screen: a case can land straight on anaesthesia management, and the
   stage locks still have to be right. So the rule lives here as a plain
   function and the mounted sheet calls the same one.

   Derived, never a stored list: the GLP-1 line only exists once a weight-loss
   medication has been recorded, which is the whole point of asking.
   ========================================================================= */

const isBlank = (value) =>
  value === undefined || value === null || value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * The spec, walked once and kept.
 *
 * `eachField` recurses the whole tree, and the gate used to call it three times
 * per evaluation while rebuilding a parent map each time — on a sheet of ~180
 * fields, evaluated on every tick, that was most of the cost of using it.
 */
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  const flat = [];
  const parents = new Map();
  const byTestid = new Map();
  const byKey = new Map();
  eachField((f, section, parent) => {
    flat.push(f);
    parents.set(f, parent);
    if (f.testid) byTestid.set(f.testid, f);
    /* Keyed by the control that DRAWS the field. A virtual companion shares
       its key with the widget above it, and the one that renders wins. */
    if (f.key && !f.virtual) byKey.set(f.key, f);
  });

  /* Each field's full ancestor chain, so visibility is one loop rather than a
     climb per lookup. */
  const chains = new Map();
  flat.forEach((f) => {
    const chain = [];
    for (let node = f; node; node = parents.get(node)) chain.unshift(node);
    chains.set(f, chain);
  });

  INDEX = { flat, parents, byTestid, byKey, chains };
  return INDEX;
}

/** Is this field on screen — its own reveal rule and every parent's. */
const fieldVisible = (spec, v, ctx) =>
  index().chains.get(spec).every((node) => !node.when || node.when(v, ctx));

/** A number that is present but outside what the field will accept. */
function rangeError(spec, value) {
  if (!spec.range || isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${spec.label} must be a number`;
  const { min, max } = spec.range;
  if (n < min || n > max) return `${spec.label} must be between ${min} and ${max}`;
  return null;
}

export function preCheckOutstanding(values, ctx = {}) {
  const v = normalise(values);
  const missing = [];
  const has = (list, id) => (v[list] ?? []).includes(id);

  if (!v.timeInRoom) missing.push('Time in room');

  PATIENT_VERIFICATION_CHECKS.filter((check) => !has('verified', check.id)).forEach((check) =>
    missing.push(check.label)
  );

  if (!has('allergyChecks', 'medications')) {
    missing.push('Medications/Allergies reviewed in EMR with patient');
  }

  /* NKDA is the claim that there are none, and the UI clears the allergen
     rows when it is ticked. The rule is repeated here because the UI is not
     the only way values arrive: a filed sheet, a template, or a migrated
     record can all carry the contradiction, and a sheet that says both "no
     known drug allergies" and "anaphylaxis to amoxicillin" must not be
     signable whichever door it came in through. */
  const namedAllergen =
    has('allergyChecks', 'soy') ||
    has('allergyChecks', 'egg') ||
    (v.allergies ?? []).some((row) => String(row.allergen ?? '').trim()) ||
    Boolean(String(v.otherAllergies ?? '').trim());

  if (has('allergyChecks', 'nkda') && namedAllergen) {
    missing.push('NKDA contradicts a recorded allergen');
  }

  if (!v.npoStatus) missing.push('NPO status');
  if (isGlp1(v) && !v.npoExtended) missing.push('Extended fast — GLP-1 protocol');

  if (!String(v.ivDetails ?? '').trim()) missing.push('IV details');

  /* Everything the spec declares required, but only where it is on screen —
     a rule hidden behind an unanswered parent is not outstanding, it is not
     being asked. Numbers out of range count too: a systolic of 700 is not an
     answer, and letting it through means the PDF prints it. */
  index().flat.forEach((f) => {
    if (!f.key || !fieldVisible(f, v, ctx)) return;

    const required = typeof f.required === 'function' ? f.required(v, ctx) : f.required;
    if (required && (isBlank(v[f.key]) || v[f.key] === false)) missing.push(f.label ?? f.key);

    const error = rangeError(f, v[f.key]);
    if (error) missing.push(error);
  });

  /* Blocking alerts. Advisory ones (GLP-1, abnormal vitals, difficult airway,
     MH, NPO window) deliberately do not gate: the call to proceed belongs to
     anaesthesia, and the sheet's job is to make sure they were told. */
  if (v.escortPresent === 'no') missing.push('Responsible adult — sedation cannot proceed');
  if (v.anticoagulant === 'yes' && v.anticoagulantHeld === 'no' && !v.anticoagulantAcknowledged) {
    missing.push('Acknowledge anticoagulant not held');
  }

  return missing;
}

/** A stored sheet, migrated and filled out to the current shape. */
function normalise(values) {
  const migrated = migratePreCheck(values) ?? {};
  const v = { ...PRE_CHECK_SEED, ...migrated };
  v.verified = [...(migrated.verified ?? PRE_CHECK_SEED.verified)];
  v.allergyChecks = [...(migrated.allergyChecks ?? PRE_CHECK_SEED.allergyChecks)];
  v.allergies = [...(migrated.allergies ?? [])];
  v.implants = [...(migrated.implants ?? PRE_CHECK_SEED.implants ?? [])];
  v.specialEquipment = [...(migrated.specialEquipment ?? PRE_CHECK_SEED.specialEquipment ?? [])];
  v.weightLossGiSymptoms = [...(migrated.weightLossGiSymptoms ?? PRE_CHECK_SEED.weightLossGiSymptoms ?? [])];

  /* The three IV quick-selects, copied rather than shared. Without this the
     sheet's state would hold the SEED's own array and a chip pressed on one
     case would still be pressed on the next one opened in the same tab. */
  ['ivGauge', 'ivSite', 'ivTrials'].forEach((key) => {
    v[key] = Array.isArray(v[key]) ? [...v[key]] : v[key] ? [v[key]] : [];
  });

  /* Two fields answer themselves unless someone says otherwise. Both are
     pre-filled rather than left blank because the blank version is the one
     that gets signed empty: whoever is working the sheet started the line, and
     the vitals were taken when they were taken. Either can be typed over. */
  if (!v.ivStartedBy) v.ivStartedBy = initialsOf(currentSigner());
  if (!v.vitalsTakenAt) v.vitalsTakenAt = isoToLocalTimeInput(stampNow());

  return v;
}

/* ============================================================================
   THE PRACTICE DEFAULT

   sessionStorage for the same reason the appointments use it: a reviewer's
   "Set Default" should not follow the next person into a fresh tab.
   ========================================================================= */

const DEFAULT_KEY = 'medinova.precheck.default';

function loadDefault() {
  try {
    const saved = sessionStorage.getItem(DEFAULT_KEY);
    if (saved) return { ...PRE_CHECK_DEFAULT, ...(migratePreCheck(JSON.parse(saved)) ?? {}) };
  } catch {
    /* fall through to the shipped default */
  }
  return { ...PRE_CHECK_DEFAULT };
}

function storeDefault(values) {
  try {
    sessionStorage.setItem(DEFAULT_KEY, JSON.stringify(values));
  } catch {
    /* nothing to do — the screen keeps working from memory */
  }
}

/* ============================================================================
   READING THE DEFAULT BEFORE TAKING IT

   Use Default lands a template nobody in the room has ever seen. It is written
   by whoever last pressed Set Default, it is invisible until it is on the
   sheet, and the only account of it afterwards is a line of toast that has
   gone by the time anyone wonders what changed. On a part-worked sheet that
   made it a press people avoided — filling ten blanks was worth having, but
   not at the price of not knowing what the eleventh answer was going to say.

   So the template is readable. What follows turns a stored set of values into
   the lines a nurse would recognise: the sheet's own section titles, the
   sheet's own field labels, the words a closed list shows rather than the
   value it stores, and against each one what Use Default would actually do to
   it here — fill a blank, agree with what is already there, or clash and ask.

   ONLY WHAT THE SHEET RENDERS IS PREVIEWED. A stored default carries around
   two hundred keys and the form asks about thirty of them; the rest are the
   superset the sheet used to be. Listing them would be a preview of a sheet
   nobody is looking at, so the walk goes through the spec — if a question is
   not on the form, its stored answer is not in the preview.
   ========================================================================= */

/** Do two answers say the same thing — lists compared by contents, not identity. */
const sameAnswer = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    return left.length === right.length && left.every((value, i) => value === right[i]);
  }
  return a === b;
};

/**
 * The keys a COMPOSITE widget owns, and what to call each one in a preview.
 *
 * Most fields carry their own key and label, so the walk reads them straight
 * off the spec. The half-dozen widgets that draw several answers at once —
 * the verification ticks, the NPO question, the IV row — do not: they are one
 * `field({ type })` with no key, and the values they write are known only to
 * the renderer. Naming them here is the one place that has to be kept in step
 * with those renderers, which is why it sits directly under them in the file
 * rather than in data/.
 */
const PREVIEW_COMPOSITE_KEYS = {
  'time-in-room': { timeInRoom: 'Time in room' },
  'verify-checks': { verified: 'Verification checks' },
  'allergy-checks': { allergyChecks: 'Allergy review' },
  'npo-choice': { npoStatus: 'NPO status', npoExtended: NPO_EXTENDED.label },
  'iv-access': {
    ivGauge: 'Needle gauge',
    ivSite: 'IV site',
    ivTrials: 'Trials',
    ivDetails: 'IV details',
  },
  'blood-pressure': { bpSystolic: 'Systolic', bpDiastolic: 'Diastolic' },
};

/**
 * Every key the sheet actually RENDERS — the spec's own, plus the composite
 * widgets' — built once and kept.
 *
 * A stored default carries around two hundred keys because the sheet used to
 * ask about two hundred things; the form asks about thirty of them now and the
 * rest are a superset nothing draws. Both the preview and the clash count that
 * Use Default asks with are scoped to this set, and they have to be scoped to
 * the SAME set: a preview that says five answers differ, followed by a dialog
 * that says thirty-four fields differ, is two claims about one press and no
 * way to tell which is the true one. Twenty-nine of those thirty-four were
 * questions nobody could see, on a sheet nobody could have answered them on.
 *
 * Narrowing the count never widens what is written. A press with no clashes
 * fills blanks and stops — so the fields dropped from the count are fields
 * this can no longer offer to overwrite, not fields it overwrites silently.
 */
let RENDERED_KEYS = null;
function renderedKeys() {
  if (RENDERED_KEYS) return RENDERED_KEYS;
  RENDERED_KEYS = new Set();
  eachField((spec) => {
    if (spec.key) RENDERED_KEYS.add(spec.key);
    else Object.keys(PREVIEW_COMPOSITE_KEYS[spec.type] ?? {}).forEach((key) => RENDERED_KEYS.add(key));
  });
  return RENDERED_KEYS;
}

/** The closed list behind a key whose own field spec does not carry one. */
const PREVIEW_OPTIONS = {
  verified: PATIENT_VERIFICATION_CHECKS,
  allergyChecks: ALLERGY_CHECKS,
  npoStatus: NPO_CHECKS,
};

/** What Use Default would do with a line, in the words the tag shows. */
const PREVIEW_STATUS = {
  fills: 'Fills a blank',
  same: 'Already answered',
  differs: 'Differs — asks first',
};

/**
 * An option's label, whether the list holds plain strings or objects.
 *
 * The closed lists in data/pre-check.js are both shapes and deliberately so —
 * 'Ambulatory' is its own label, 'nausea_vomiting' is not. A preview that
 * printed the stored value would show the second kind as a slug, which is the
 * one thing a preview must not do: read as a different answer from the one the
 * sheet would show.
 */
function optionLabel(options, value) {
  const match = (options ?? []).find((option) =>
    typeof option === 'string' ? option === value : (option.value ?? option.id) === value
  );
  if (!match) return String(value);
  return typeof match === 'string' ? match : match.label;
}

/** One stored answer, in the words the sheet would show it in. */
function previewValue(key, value, spec) {
  if (value === true) return 'Ticked';
  if (value === false) return 'Not ticked';

  const options = PREVIEW_OPTIONS[key] ?? spec?.options ?? spec?.items;
  if (Array.isArray(value)) return value.map((entry) => optionLabel(options, entry)).join(', ');
  return options ? optionLabel(options, value) : String(value);
}

/**
 * The template as a list of lines, grouped by the section they are asked in.
 *
 * `current` is the sheet as it stands, and it is here for the status alone —
 * nothing in this function writes to it. The three statuses are exactly the
 * three branches the Use Default handler takes below, worked out from the same
 * comparison, so the preview cannot promise one thing and the press do
 * another.
 */
function defaultPreviewGroups(preset, current) {
  const groups = new Map();
  const seen = new Set();

  const consider = (section, key, label, spec) => {
    /* A key is previewed once. A virtual companion shares its key with the
       widget that draws it, and whichever the walk reaches first is the one
       whose label is used — both name the same question. */
    if (seen.has(key)) return;
    seen.add(key);

    const value = preset[key];
    if (isBlank(value)) return;

    /* An unticked box is the absence of a claim, not a claim of absence, and a
       template made mostly of them would read as thirty answers where there
       are none. It earns a line only where it would take one back off — the
       box is ticked on this sheet and the template says it should not be. */
    if (value === false && current[key] !== true) return;

    const status = isBlank(current[key])
      ? 'fills'
      : sameAnswer(current[key], value)
        ? 'same'
        : 'differs';

    if (!groups.has(section.title)) groups.set(section.title, []);
    groups.get(section.title).push({
      key,
      label,
      value: previewValue(key, value, spec),
      status,
    });
  };

  eachField((spec, section) => {
    if (spec.key) {
      consider(section, spec.key, spec.label ?? spec.key, spec);
      return;
    }
    const composite = PREVIEW_COMPOSITE_KEYS[spec.type];
    if (composite) {
      Object.entries(composite).forEach(([key, label]) => consider(section, key, label, spec));
    }
  });

  return [...groups].map(([title, rows]) => ({ title, rows }));
}

/** The preview dialog's body. Rebuilt on every opening, from the live sheet. */
function defaultPreviewMarkup(preset, current) {
  const groups = defaultPreviewGroups(preset, current);
  const rows = groups.flatMap((group) => group.rows);

  /* A practice that has never pressed Set Default still has the shipped
     template, so this is rare — but a dialog that opened onto nothing at all
     would read as a broken button rather than as an empty template, and the
     way out of it is worth saying. */
  if (!rows.length) {
    return `<p class="pck__confirm-text" data-testid="pck--preview-empty">
      The template is empty — there is nothing for Use Default to fill in. Work
      this sheet through and press Set Default to give the practice one.
    </p>`;
  }

  const count = (status) => rows.filter((row) => row.status === status).length;
  const fills = count('fills');
  const differs = count('differs');

  return `<p class="pck__confirm-text" data-testid="pck--preview-summary">
      ${rows.length} answer${rows.length === 1 ? '' : 's'} in the practice template.
      ${fills} would fill a blank on this sheet${
        differs
          ? `, and ${differs} differ${differs === 1 ? 's' : ''} from an answer already
             given here — Use Default asks before it replaces those.`
          : '. Nothing already answered would be replaced.'
      }
    </p>
    <div class="pck__preview" data-testid="pck--preview-list">
      ${groups
        .map(
          (group) => `<section class="pck__preview-group">
            <h3 class="pck__preview-title">${esc(group.title)}</h3>
            <dl class="pck__preview-rows">
              ${group.rows
                .map(
                  (row) => `<div class="pck__preview-row" data-status="${row.status}"
                    data-testid="pck--preview-row-${slug(row.key)}">
                    <dt class="pck__preview-label">${esc(row.label)}</dt>
                    <dd class="pck__preview-value">
                      <span>${esc(row.value)}</span>
                      <span class="pck__preview-tag pck__preview-tag--${row.status}"
                        >${esc(PREVIEW_STATUS[row.status])}</span>
                    </dd>
                  </div>`
                )
                .join('')}
            </dl>
          </section>`
        )
        .join('')}
    </div>`;
}

/* ============================================================================
   MOUNT
   ========================================================================= */

/**
 * Wire a rendered sheet inside `root`.
 *
 * Returns a controller so the host can gate on the sheet without reaching into
 * it: `outstanding()` for what is still unanswered, `values()` for the record
 * to file, `state` for the signed flag, `dirty()` for whether anything has been
 * typed that is not yet committed.
 *
 * `actionsRoot` IS NOT OPTIONAL DECORATION — it is the fix for five dead
 * buttons.
 *
 * preCheckActionsMarkup exists so a host can put the default trio and the PDF
 * pair in ITS OWN header rather than have the sheet draw a second
 * heading row underneath. The clinic-visit screen does that inside the card
 * that also holds the sheet, so one root found both. The encounter puts them
 * in the working column's toolbar, which is a sibling of the mount root — so
 * every lookup for them returned null and none of the five was ever wired. In
 * the room they were buttons that did nothing, on the one screen where "start
 * this sheet from the practice template" is the whole reason a template
 * exists. A host that renders the actions outside `root` names where.
 */
export function mountPreCheckSheet({
  root,
  actionsRoot = null,
  appointment,
  onChange = () => {},
  notify = () => {},
  context = {},
  /**
   * Sections this host renders for itself, by id.
   *
   * Nothing skips anything today. The encounter used to skip `signoff` — the
   * read-only stamp of the nurse's initials, auto-filled from the session — and
   * put a drawn signature block there instead, on the argument that initials
   * typed by nobody and a signature are not the same claim about who was in the
   * room. That signature has been taken off the checklist, so every host now
   * renders the sheet whole, stamp included.
   *
   * The parameter stays. It is a parameter rather than a change to
   * PRE_CHECK_SECTIONS, because hosts are
   * allowed to disagree about the sign-off — that is exactly the line the
   * module header draws: every question is here, signing belongs to whoever
   * mounted it. The section stays declared so a host that wants the stamp can
   * still have it.
   */
  skipSections = [],
}) {
  /* Scoped to the mount root, not the document: in the encounter this sheet is
     one panel among several, and getElementById would happily reach into a
     sibling with the same field name. */
  const el = (name) =>
    root.querySelector(`[data-pck="${name}"]`) ??
    actionsRoot?.querySelector(`[data-pck="${name}"]`) ??
    null;

  /**
   * The sheet starts from whatever is already known: a signed sheet, then the
   * demo seed. There is no draft to fall back to — the sheet is either open
   * and being worked, or it is signed.
   */
  const state = {
    ...normalise(appointment?.preCheck ?? null),
    signed: Boolean(appointment?.preCheck?.signed),
  };

  const ctx = {
    scheduledAt: appointment?.scheduledAt ?? appointment?.start ?? null,
    sex: context.sex,
    age: context.age ?? appointment?.patient?.age,
    ...context,
  };

  let dirty = false;

  const has = (list, id) => (state[list] ?? []).includes(id);

  function toggle(list, id, on) {
    const next = new Set(state[list] ?? []);
    if (on) next.add(id);
    else next.delete(id);
    state[list] = [...next];
  }

  /** Every value the sheet holds, without the signature — what a default is. */
  const values = () => {
    const out = {};
    Object.keys(PRE_CHECK_DEFAULT).forEach((key) => {
      const value = state[key];
      out[key] = Array.isArray(value) ? [...value] : value;
    });
    out.verified = [...state.verified];
    out.allergyChecks = [...state.allergyChecks];
    out.allergies = state.allergies.map((row) => ({ ...row }));
    return out;
  };

  /** The lines still to answer — the same rule the host uses headlessly. */
  const outstanding = () => preCheckOutstanding(state, ctx);

  /* --- Painting ------------------------------------------------------------ */

  /* Marks the sheet edited. Telling the host is paint()'s job, so that a tick
     costs one evaluation of the gate rather than two. */
  const changed = () => {
    dirty = true;
  };

  /* ------------------------------------------------------------------------
     CONTROLS

     One renderer per control type. Each returns markup carrying `data-f`, the
     state key it writes, so a single wiring pass can bind the lot.
     --------------------------------------------------------------------- */

  const testidOf = (spec) => `pck--${spec.testid}`;

  const optionsOf = (spec) =>
    (spec.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  /** The unit a number carries, shown in its label rather than beside it. */
  const labelWithUnit = (spec) => {
    const unit = spec.suffix ?? spec.range?.unit;
    return unit ? `${spec.label} (${unit})` : spec.label;
  };

  /**
   * A yes/no question — real radios sharing a name, so one tab stop and arrow
   * keys come from the platform rather than from us.
   *
   * These were a pair of checkboxes. Two boxes for one question is a shape
   * that can say both and can say neither, and "Diabetes: No ☑ Yes ☑" was a
   * state the old sheet could be signed in.
   */
  let radioSeq = 0;
  function radioMarkup(spec) {
    const name = `pck-radio-${spec.key}-${++radioSeq}`;
    const options = optionsOf(spec);
    const labels = spec.legacyLabels;

    return `<fieldset class="ui-radio-group pck__radio" data-f="${spec.key}"
      data-testid="${testidOf(spec)}">
      <legend class="${spec.labelHidden ? 'u-sr-only' : 'ui-field__label'}">${esc(spec.label)}</legend>
      <div class="ui-radio-group__options">
        ${options
          .map((option, index) => {
            const display = labels?.[index] ?? option.label;
            /* The testid follows what the item SAYS, not what it stores, so
               the ids that existed before the enum rename still resolve. */
            const id = `${name}-${index}`;
            /* The input is a SIBLING BEFORE the box, never inside it. Every
               checked/focus/disabled rule in css/components/forms.css is written
               with the adjacent-sibling combinator —
               `.ui-choice__input:checked + .ui-choice__box` — so an input nested
               inside the box matches none of them: the radio takes the value and
               fires its change event, and then paints nothing at all. This is
               the order <ui-radio-group> uses; these two hand-built groups must
               keep to it. */
            return `<label class="ui-choice" for="${id}">
              <input id="${id}" class="ui-choice__input" type="radio" name="${name}"
                value="${esc(option.value)}"
                data-testid="${testidOf(spec)}-${slug(spec.legacySlugs ? display : option.value)}"
                ${state[spec.key] === option.value ? 'checked' : ''}>
              <span class="ui-choice__box ui-choice__box--radio">
                <span class="ui-choice__dot"></span>
              </span>
              <span>${esc(display)}</span>
            </label>`;
          })
          .join('')}
      </div>
    </fieldset>`;
  }

  /**
   * `data-optional` marks a box the sheet does not insist on.
   *
   * It exists for the test walk in tests/helpers/page-helpers.js, which closes
   * this stage by ticking whatever is still unticked. That was fine when the
   * sheet had four boxes; it now has sixty-odd that are answers in their own
   * right — an unticked "Magnet available in room" means there is no magnet,
   * and a helper that ticks it to get to the next screen is writing a clinical
   * claim nobody made. The attribute lets the walk tick only what is actually
   * holding the gate shut, the same way `data-value` used to fence off the
   * Yes/No pairs.
   */
  const optionalAttr = (spec) => {
    const required = typeof spec.required === 'function' ? spec.required(state, ctx) : spec.required;
    return required ? '' : ' data-optional';
  };

  function checkMarkup(spec) {
    return `<ui-checkbox data-f="${spec.key}" ${state[spec.key] ? 'checked' : ''}
      ${spec.disabled ? 'disabled' : ''}${optionalAttr(spec)}
      data-testid="${testidOf(spec)}">${esc(spec.label)}</ui-checkbox>`;
  }

  /** A multi-select group. `exclusive` names the option that clears the rest. */
  function checksMarkup(spec) {
    const list = spec.list ?? spec.key;
    return `<div class="pck__field">
      <span class="pck__field-label" id="pck-${spec.testid}-label">${esc(spec.label)}</span>
      <div class="pck__checks pck__checks--wrap" role="group"
        aria-labelledby="pck-${spec.testid}-label" data-testid="${testidOf(spec)}">
        ${spec.items
          .map((item) => {
            const on = spec.list ? has(list, item.id) : Boolean(state[item.id]);
            /* A risk factor is never required — an unticked STOP-BANG line
               means the patient does not have it. */
            return `<ui-checkbox data-group="${spec.testid}" data-item="${item.id}"
              ${on ? 'checked' : ''} data-optional
              data-testid="pck--${item.testid ?? `${spec.testid}-${item.id}`}"
              >${esc(item.label)}</ui-checkbox>`;
          })
          .join('')}
      </div>
    </div>`;
  }

  function inputMarkup(spec) {
    const type = spec.type === 'number' ? 'number' : spec.type === 'tel' ? 'tel' : spec.type;
    const native = { text: 'text', tel: 'tel', number: 'number', date: 'date', time: 'time', datetime: 'datetime-local' }[type] ?? 'text';
    const error = rangeError(spec, state[spec.key]);
    const flagged = spec.flag && state[spec.key] !== '' && spec.flag(Number(state[spec.key]));

    return `<ui-input data-f="${spec.key}" type="${native}"
      label="${esc(labelWithUnit(spec))}"
      ${spec.labelHidden ? 'label-hidden' : ''}
      ${spec.placeholder ? `placeholder="${esc(spec.placeholder)}"` : ''}
      ${spec.step ? `step="${spec.step}"` : ''}
      value="${esc(state[spec.key] ?? '')}"
      ${error ? `error="${esc(error)}"` : flagged ? `hint="${esc(spec.flagNote ?? 'Outside the expected range.')}"` : ''}
      class="${flagged && !error ? 'pck__flagged' : ''}"
      data-testid="${testidOf(spec)}"></ui-input>`;
  }

  /* The value is written into the markup as well as set as a property. The
     section cache keys off this markup, so a value that changed without the
     layout changing — "Use Default" filling a select — has to be visible in
     the string, or the repaint is skipped and the control keeps the old
     answer on screen while the state holds the new one. */
  function selectMarkup(spec) {
    /* A list with an Other that is typed into the same box. The typed value is
       written into the markup for the same reason the selection is: the
       section cache keys off this string, so a name filled in by "Use Default"
       has to be visible in it or the repaint is skipped. */
    const free = spec.freeText
      ? ` free-text="${esc(spec.freeText)}"
          free-text-value="${esc(state[spec.freeTextKey] ?? '')}"
          ${spec.freeTextPlaceholder ? `free-text-placeholder="${esc(spec.freeTextPlaceholder)}"` : ''}`
      : '';

    return `<ui-select data-f="${spec.key}" label="${esc(spec.label)}"
      ${spec.labelHidden ? 'label-hidden' : ''}
      value="${esc(state[spec.key] ?? '')}"
      ${spec.placeholder ? `placeholder="${esc(spec.placeholder)}"` : ''}${free}
      data-testid="${testidOf(spec)}"></ui-select>`;
  }

  function textareaMarkup(spec) {
    return `<ui-textarea data-f="${spec.key}" label="${esc(spec.label)}"
      ${spec.labelHidden ? 'class="pck__notes"' : ''}
      rows="${spec.rows ?? 3}"
      value="${esc(state[spec.key] ?? '')}"
      ${spec.placeholder ? `placeholder="${esc(spec.placeholder)}"` : ''}
      data-testid="${testidOf(spec)}"></ui-textarea>`;
  }

  function sliderMarkup(spec) {
    const value = Number(state[spec.key] ?? 0);
    return `<div class="pck__field">
      <label class="pck__field-label" for="pck-${spec.testid}">${esc(spec.label)}</label>
      <div class="pck__slider-row">
        <input id="pck-${spec.testid}" class="pck__slider" type="range"
          min="${spec.min}" max="${spec.max}" value="${value}" data-f="${spec.key}"
          data-testid="${testidOf(spec)}">
        <output class="pck__slider-value" aria-live="polite">${value}</output>
      </div>
    </div>`;
  }

  /** A derived read-only badge. Announced, because nobody watches a number. */
  function scoreMarkup(spec) {
    return `<div class="pck__score">
      <span class="pck__field-label">${esc(spec.label)}</span>
      <span class="pck__score-value" aria-live="polite" role="status"
        data-testid="${testidOf(spec)}">${esc(spec.compute(state, ctx))}</span>
    </div>`;
  }

  function alertMarkup(spec) {
    const detail = spec.detailOf ? spec.detailOf(state, ctx) : spec.detail;
    const blocking = spec.severity === 'critical' && spec.blocking !== false;
    return `<div class="pck__alert-wrap">
      <ui-alert severity="${spec.severity}" heading="${esc(spec.heading)}"
        data-testid="pck--alert-${spec.testid}">${esc(detail)}</ui-alert>
      ${
        spec.acknowledge
          ? `<ui-checkbox data-f="${spec.acknowledge}"
              ${state[spec.acknowledge] ? 'checked' : ''}
              data-testid="pck--${spec.acknowledgeTestid}"
              >Acknowledged — proceeding with the bleeding risk noted.</ui-checkbox>`
          : ''
      }
      ${blocking ? '<p class="pck__hint">The sheet cannot be signed while this stands.</p>' : ''}
    </div>`;
  }

  /* --- Bespoke widgets ----------------------------------------------------- */

  function timeInRoomMarkup() {
    const audit = state.timeInRoomAudit;
    return `<div class="pck__row">
      <span class="pck__row-label">Time In Room:
        <strong data-pck="timeInRoomValue" data-testid="pck--time-in-room-value">${
          state.timeInRoom ? `${iconMarkup('clock', 'ui-icon')} ${esc(displayTime(state.timeInRoom))}` : 'Not recorded'
        }</strong>
      </span>
      <span class="pck__row-actions">
        ${
          state.timeInRoom
            ? `<button type="button" class="pck__icon-button" data-pck="editTime"
                 aria-label="Edit recorded time" data-testid="pck--edit-time-in-room"
                 >${iconMarkup('pencil')}</button>`
            : ''
        }
        <ui-button variant="outline" size="sm" data-pck="recordTime"
          data-testid="pck--record-time">Record Time</ui-button>
      </span>
      ${
        state.editingTime
          ? `<div class="pck__time-edit">
               <ui-input type="time" label="Corrected time in room" data-pck="timeEditInput"
                 value="${esc(isoToLocalTimeInput(state.timeInRoom))}"
                 data-testid="pck--time-in-room-input"></ui-input>
               <ui-button size="sm" data-pck="timeEditSave"
                 data-testid="pck--time-in-room-save">Save</ui-button>
               <ui-button variant="ghost" size="sm" data-pck="timeEditCancel"
                 data-testid="pck--time-in-room-cancel">Cancel</ui-button>
             </div>`
          : ''
      }
      ${
        audit
          ? `<p class="pck__hint" data-testid="pck--time-in-room-audit">
               Corrected from ${esc(displayTime(audit.from))} by ${esc(audit.by)}
               at ${esc(displayTime(audit.at))}.
             </p>`
          : ''
      }
    </div>`;
  }

  function verifyChecksMarkup() {
    return `<div class="pck__checks pck__checks--3" data-testid="pck--verify">
      ${PATIENT_VERIFICATION_CHECKS.map(
        (check) => `<ui-checkbox data-verify="${check.id}"
          ${has('verified', check.id) ? 'checked' : ''}
          data-testid="pck--verify-${check.id}">${esc(check.label)}</ui-checkbox>`
      ).join('')}
    </div>`;
  }

  /**
   * The three legacy allergen boxes, kept as quick-add chips.
   *
   * NKDA is not a fourth allergen — it is the claim that there are none, and
   * the sheet used to let it stand beside Soy and Egg. Ticking it now clears
   * and locks the rest; naming any allergen clears it.
   */
  function allergyChecksMarkup() {
    const nkda = has('allergyChecks', 'nkda');
    /* --answer marks a group that IS the answer to the section heading rather
       than a labelled field of its own — screen-pre-check.css lines it up with
       the labelled control sharing its row. */
    return `<div class="pck__checks pck__checks--answer" data-testid="pck--allergies">
      ${ALLERGY_CHECKS.map((check) => {
        const locked = nkda && check.id !== 'nkda' && check.id !== 'medications';
        /* Only the EMR review is required. NKDA, soy and egg are answers, and
           an allergen ticked to satisfy a walk is a fabricated allergy. */
        return `<ui-checkbox data-allergy="${check.id}"
          ${has('allergyChecks', check.id) ? 'checked' : ''}
          ${locked ? 'disabled data-own-disabled' : ''}${check.id === 'medications' ? '' : ' data-optional'}
          data-testid="pck--allergy-${check.id}">${esc(check.label)}</ui-checkbox>`;
      }).join('')}
    </div>`;
  }

  function allergyRowsMarkup() {
    const nkda = has('allergyChecks', 'nkda');
    const rows = state.allergies ?? [];

    const cell = (row, index, key, label, list) => `
      <ui-select data-row="${index}" data-row-key="${key}" label="${esc(label)}"
        placeholder="Select" data-list="${list}"
        data-testid="pck--allergy-${key}-${index}"></ui-select>`;

    return `<div class="pck__field">
      <span class="pck__field-label">Recorded allergies</span>
      ${
        nkda
          ? `<p class="pck__hint">NKDA is ticked — untick it to record an allergen.</p>`
          : ''
      }
      <div class="pck__allergy-rows">
        ${rows
          .map(
            (row, index) => `<div class="pck__allergy-row" data-testid="pck--allergy-row-${index}">
              <ui-input data-row="${index}" data-row-key="allergen" label="Allergen"
                value="${esc(row.allergen ?? '')}" placeholder="e.g., Amoxicillin"
                data-testid="pck--allergy-allergen-${index}"></ui-input>
              ${cell(row, index, 'type', 'Type', 'types')}
              ${cell(row, index, 'reaction', 'Reaction', 'reactions')}
              ${cell(row, index, 'severity', 'Severity', 'severities')}
              <button type="button" class="pck__icon-button" data-remove-allergy="${index}"
                aria-label="Remove allergy row ${index + 1}"
                data-testid="pck--remove-allergy-${index}">${iconMarkup('trash')}</button>
            </div>`
          )
          .join('')}
      </div>
      <ui-button variant="outline" size="sm" data-pck="addAllergy" ${nkda ? 'disabled data-own-disabled' : ''}
        data-testid="pck--add-allergy">Add allergy</ui-button>
    </div>`;
  }

  /**
   * The NPO lines.
   *
   * Standard and Other are one question, not two boxes — they were two, and
   * both could be ticked, which is a fasting status that says two different
   * things at once. The extended-fast line stays a separate tick because it is
   * an additional protocol rather than an alternative to either.
   *
   * It is not hidden when it does not apply — it is simply not there. A
   * greyed-out line invites the reading "not needed today"; an absent one
   * cannot be misread, and it reappears the moment a GLP-1 agonist is recorded.
   */
  function npoMarkup(spec) {
    const glp1 = isGlp1(state);
    const name = `pck-radio-npo-${++radioSeq}`;

    return `<div class="pck__field">
      <fieldset class="ui-radio-group pck__radio" data-testid="pck--npo">
        <legend class="ui-field__label">NPO</legend>
        <div class="ui-radio-group__options pck__npo-options">
          ${NPO_CHECKS.map((check, index) => {
            const id = `${name}-${index}`;
            /* The detail box is nested inside Other's own row rather than
               placed after the group. Sitting under the option that asked for
               it is what makes it read as that option's answer — after the
               fieldset it would be a box belonging to the whole question. */
            const detail =
              check.id === 'other' && state.npoStatus === 'other'
                ? `<div class="pck__npo-detail">
                     <ui-input data-f="npoOtherText" label="Other NPO detail" label-hidden
                       placeholder="Enter NPO details" value="${esc(state.npoOtherText ?? '')}"
                       data-testid="pck--npo-other-text"></ui-input>
                   </div>`
                : '';
            /* Sibling before the box — see the note on radioMarkup. */
            return `<label class="ui-choice" for="${id}">
              <input id="${id}" class="ui-choice__input" type="radio" name="${name}"
                value="${check.id}" data-f="npoStatus"
                data-testid="pck--npo-${check.id}"
                ${state.npoStatus === check.id ? 'checked' : ''}>
              <span class="ui-choice__box ui-choice__box--radio">
                <span class="ui-choice__dot"></span>
              </span>
              <span>${esc(check.label)}</span>
            </label>${detail}`;
          }).join('')}
        </div>
      </fieldset>
      ${
        glp1
          ? `<ui-checkbox data-f="npoExtended" ${state.npoExtended ? 'checked' : ''}
               data-testid="pck--npo-extended">${esc(NPO_EXTENDED.label)}</ui-checkbox>`
          : ''
      }
    </div>`;
  }

  /**
   * The three quick-select groups build one free-text field — pressed or typed.
   *
   * ALL THREE TAKE MORE THAN ONE ANSWER. A cannula that goes in first time is
   * one gauge at one site; a patient stuck twice is two of each, and the
   * attempt that FAILED is the one anaesthesia wants to know about. So the
   * composed line reads "20G / 22G Left Hand, Right AC - 2 trials" and keeps
   * both, rather than the last chip pressed overwriting the first.
   *
   * Gauges are joined with a slash and sites with a comma because that is how
   * they are said out loud: two gauges are alternatives tried on one patient,
   * two sites are two places on them.
   */
  const ivList = (key) => {
    const value = state[key];
    return Array.isArray(value) ? value : value ? [value] : [];
  };

  function composeIvDetails() {
    const gaugeSite = [ivList('ivGauge').join(' / '), ivList('ivSite').join(', ')]
      .filter(Boolean)
      .join(' ');
    const trials = ivList('ivTrials').join(', ');
    if (gaugeSite && trials) return `${gaugeSite} - ${trials}`;
    return gaugeSite || trials || '';
  }

  function ivAccessMarkup() {
    const group = (key, label, list, testid) => {
      const chosen = ivList(key);
      return `
      <div class="pck__field pck__field--sub">
        <span class="pck__field-label" id="pck-${key}-label">Quick Select - ${esc(label)}</span>
        <div class="pck__chips" role="group" aria-labelledby="pck-${key}-label"
          data-testid="pck--${testid}">
          ${list
            .map(
              (option) => `<button type="button" class="pck__chip"
                aria-pressed="${chosen.includes(option)}" data-set="${key}"
                data-value="${esc(option)}"
                data-testid="pck--${testid}-${slug(option)}">
                ${esc(option)}
              </button>`
            )
            .join('')}
        </div>
      </div>`;
    };

    return `<div class="pck__field">
      <span class="pck__field-label">IV Details (gauge/site/trials)</span>
      <div class="pck__stack" data-testid="pck--iv">
        ${group('ivGauge', 'Needle Gauge', NEEDLE_GAUGES, 'gauge')}
        ${group('ivSite', 'IV Site', IV_SITES, 'site')}
        ${group('ivTrials', 'Trials', IV_TRIALS, 'trials')}
        <div class="pck__iv-input-row">
          <ui-input data-f="ivDetails" label="IV details" label-hidden
            placeholder="Type manually or use quick select buttons above (e.g., 22G Left AC - 1 trial)"
            value="${esc(state.ivDetails)}" data-testid="pck--iv-details"></ui-input>
          <button type="button" class="pck__iv-clear" data-pck="ivClear" aria-label="Clear IV details"
            data-testid="pck--iv-clear">${iconMarkup('close')}</button>
        </div>
      </div>
    </div>`;
  }

  function bloodPressureMarkup(spec) {
    const abnormal = abnormalVitals(state).some((f) => f.key === 'bpSystolic');
    return `<div class="pck__field">
      <span class="pck__field-label">Blood pressure (mmHg)</span>
      <div class="pck__bp ${abnormal ? 'pck__flagged' : ''}">
        <ui-input data-f="bpSystolic" type="number" label="Systolic" label-hidden
          placeholder="120" value="${esc(state.bpSystolic ?? '')}"
          data-testid="pck--bp-systolic"></ui-input>
        <span class="pck__bp-slash" aria-hidden="true">/</span>
        <ui-input data-f="bpDiastolic" type="number" label="Diastolic" label-hidden
          placeholder="80" value="${esc(state.bpDiastolic ?? '')}"
          data-testid="pck--bp-diastolic"></ui-input>
      </div>
    </div>`;
  }

  /*
   * The stamp: whose initials, and when they closed it.
   *
   * Before the sheet is filed this shows who WOULD sign it — the person at the
   * keyboard — so nobody is surprised by the name that lands on it. Once it is
   * filed it shows the name recorded at that moment (state.completedBy) rather
   * than re-deriving it from the session, because the session changes when the
   * next nurse signs in and a filed sheet must not quietly change hands with
   * it.
   */
  function staffInitialsMarkup() {
    const signer = state.completedBy || currentSigner();
    return `<div class="pck__staff" data-testid="pck--staff-initials">
      ${iconMarkup('user', 'ui-icon')}
      <strong>${esc(initialsOf(signer))}</strong>
      <span>(${state.completedAt ? 'Signed by' : 'Auto-filled from'} ${esc(signer)})</span>
      ${
        state.completedAt
          ? `<span class="pck__staff-at" data-testid="pck--completed-at"
               >Completed at ${esc(displayStamp(state.completedAt))}</span>`
          : ''
      }
    </div>`;
  }

  /* --- The renderer -------------------------------------------------------- */

  const RENDERERS = {
    radio: radioMarkup,
    check: checkMarkup,
    checks: checksMarkup,
    text: inputMarkup,
    tel: inputMarkup,
    number: inputMarkup,
    date: inputMarkup,
    time: inputMarkup,
    datetime: inputMarkup,
    select: selectMarkup,
    textarea: textareaMarkup,
    slider: sliderMarkup,
    score: scoreMarkup,
    alert: alertMarkup,
    'time-in-room': timeInRoomMarkup,
    'verify-checks': verifyChecksMarkup,
    'allergy-checks': allergyChecksMarkup,
    'allergy-rows': allergyRowsMarkup,
    'npo-choice': npoMarkup,
    'iv-access': ivAccessMarkup,
    'blood-pressure': bloodPressureMarkup,
    'staff-initials': staffInitialsMarkup,
  };

  const shown = (spec) => !spec.when || spec.when(state, ctx);

  /**
   * What the sheet currently LOOKS like — which fields are on screen, and
   * which of them are showing an error or a flag.
   *
   * Typing does not usually change any of that, and repainting anyway is not
   * free: the sheet re-renders on blur, so a nurse who types into a field and
   * then clicks a radio has the radio torn out from under the click. Comparing
   * this before and after a committed edit means the repaint happens only when
   * the edit actually revealed, hid, or invalidated something.
   */
  function layoutSignature() {
    const parts = [];
    index().flat.forEach((spec) => {
      if (!shown(spec)) return;
      parts.push(spec.testid ?? spec.key ?? '');

      /* Derived values belong in here too. A BMI badge is not revealed or
         hidden by typing a weight — it just says something different — so
         without this the sheet skipped the repaint and went on showing the
         old number beside the new weight. */
      if (spec.type === 'score') parts.push(String(spec.compute(state, ctx)));
      if (spec.type === 'alert' && spec.detailOf) parts.push(spec.detailOf(state, ctx));

      if (spec.key) {
        if (rangeError(spec, state[spec.key])) parts.push('!');
        if (spec.flag && state[spec.key] !== '' && spec.flag(Number(state[spec.key]))) parts.push('~');
      }
    });
    return parts.join('|');
  }

  /**
   * One field and everything it reveals, as a single grid cell.
   *
   * Children are nested INSIDE the cell rather than appended to the section.
   * That is the whole fix for a "Specify other" input that used to render in
   * the left column while the select that asked for it sat in the right.
   */
  function fieldMarkup(spec) {
    /* Virtual fields exist for the gate only — a composite widget above them
       already draws the control. Rendering them too would double the input. */
    if (spec.virtual || !shown(spec)) return '';
    const render = RENDERERS[spec.type];
    if (!render) return '';

    const children = (spec.children ?? []).map(fieldMarkup).filter(Boolean).join('');

    return `<div class="pck__cell${spec.span ? ` pck__cell--span-${spec.span}` : ''}">
      ${render(spec)}
      ${children ? `<div class="pck__children">${children}</div>` : ''}
    </div>`;
  }

  const sectionBodyMarkup = (section) =>
    section.fields.map(fieldMarkup).filter(Boolean).join('');

  /** The wrappers, built once. Only the bodies inside them are ever replaced. */
  function shellMarkup() {
    return PRE_CHECK_SECTIONS.filter((section) => !skipSections.includes(section.id)).map(
      (section) => `<section class="pck__section${
        /* A section whose whole answer fits on its own title line — see
           `compact` in js/lib/pre-check-fields.js. The class only says so;
           what a host does with that is the host's business. */
        section.compact ? ' pck__section--compact' : ''
      }" id="pck-section-${section.id}"
        data-testid="pck--section-${section.id}">
        <h3 class="pck__legend" data-testid="pck--section-title-${section.id}">
          ${esc(section.title)}
        </h3>
        <div class="pck__grid pck__grid--${section.columns}"
          id="pck-body-${section.id}"></div>
      </section>`
    ).join('');
  }

  /* ------------------------------------------------------------------------
     WIRING

     Discrete controls repaint immediately because they open and close other
     fields; text repaints on commit, and only when the commit actually
     revealed something — re-rendering the input a nurse is typing into would
     take the caret with it.

     The repaint is per SECTION, not per sheet. The sheet is ~180 fields of
     custom elements; rebuilding all of them to tick one box cost enough to
     be felt on every interaction, and upgrading two hundred elements to show
     one revealed input is work nobody asked for.
     --------------------------------------------------------------------- */

  const painted = new Map();

  /** The signature of what is currently rendered — see the ui-change handler. */
  let lastSignature = '';

  /** The testid of a control the next paint has to hand focus back to. */
  let refocus = null;

  function paint() {
    const missing = outstanding();

    PRE_CHECK_SECTIONS.forEach((section) => {
      const body = sectionBodyMarkup(section);
      if (painted.get(section.id) === body) return;
      painted.set(section.id, body);

      const host = root.querySelector(`#pck-body-${section.id}`);
      if (!host) return;

      host.innerHTML = body;
      fillSelects(host);
      wire(host);
    });

    if (el('sticky')) {
      el('sticky').innerHTML = `<p class="pck__sticky-hint">${
        missing.length
          ? `${missing.length} item${missing.length === 1 ? '' : 's'} outstanding — ${esc(missing.slice(0, 3).join(' · '))}${missing.length > 3 ? ' …' : ''}`
          : 'Every line on the sheet is answered.'
      }</p>
      <ui-button data-pck="submit" ${missing.length ? 'disabled data-own-disabled' : ''}
        data-testid="pck--submit">Update Pre-Procedure Checklist</ui-button>`;
      wireSubmit();
    }

    if (refocus) {
      const node = root.querySelector(`[data-testid="${refocus}"]`);
      refocus = null;
      /* The typed box if the field has one, else the control itself — a
         ui-select back in list mode focuses its <select>. */
      if (node && !node.focusFreeText?.()) node.focus?.();
    }

    lastSignature = layoutSignature();
    onChange(missing);
  }

  /** <ui-select> takes its choices as data, so they are set after render. */
  function fillSelects(scope) {
    const lists = {
      types: ALLERGY_TYPES, reactions: ALLERGY_REACTIONS, severities: ALLERGY_SEVERITIES,
    };
    scope.querySelectorAll('ui-select[data-f]').forEach((node) => {
      const spec = index().byKey.get(node.dataset.f);
      if (!spec || spec.type !== 'select') return;
      node.optionList = optionsOf(spec).map((o) => ({ value: o.value, label: o.label }));
      node.setAttribute('value', state[spec.key] ?? '');
    });

    scope.querySelectorAll('ui-select[data-list]').forEach((node) => {
      const row = Number(node.dataset.row);
      const key = node.dataset.rowKey;
      node.optionList = (lists[node.dataset.list] ?? []).map((o) => ({ value: o, label: o }));
      node.setAttribute('value', state.allergies[row]?.[key] ?? '');
    });
  }

  /** Write a value and repaint. `soft` skips the repaint (mid-typing). */
  function set(key, value, { soft = false } = {}) {
    state[key] = value;
    if (soft) {
      dirty = true;
      onChange(outstanding());
      return;
    }
    changed();
    paint();
  }

  /**
   * Bind one freshly rendered section body.
   *
   * Scoped rather than document-wide: only the section that changed is
   * re-rendered, so a document-wide pass would bind a second listener to every
   * untouched control on the sheet each time a box is ticked.
   */
  function wire(scope) {
    const q = (selector) => scope.querySelectorAll(selector);
    const one = (name) => scope.querySelector(`[data-pck="${name}"]`);

    /* --- Radios ---------------------------------------------------------- */
    q('.pck__radio input[type="radio"]').forEach((input) => {
      const key = input.dataset.f ?? input.closest('[data-f]')?.dataset.f;
      input.addEventListener('change', () => {
        if (input.checked) set(key, input.value);
      });
    });

    /* --- Single checkboxes ------------------------------------------------ */
    q('ui-checkbox[data-f]').forEach((box) =>
      box.addEventListener('ui-change', (event) => set(box.dataset.f, event.detail.checked))
    );

    /* --- Grouped checkboxes ----------------------------------------------- */
    q('ui-checkbox[data-group]').forEach((box) =>
      box.addEventListener('ui-change', (event) => {
        const spec = specByTestid(box.dataset.group);
        const id = box.dataset.item;
        if (!spec) return;

        if (spec.list) {
          /* "None" and a symptom cannot both be true. */
          if (spec.exclusive && id === spec.exclusive && event.detail.checked) {
            state[spec.list] = [spec.exclusive];
          } else {
            toggle(spec.list, id, event.detail.checked);
            if (spec.exclusive && id !== spec.exclusive && event.detail.checked) {
              toggle(spec.list, spec.exclusive, false);
            }
          }
        } else {
          state[id] = event.detail.checked;
        }
        changed();
        paint();
      })
    );

    /* --- Verification and allergy legacy boxes ----------------------------- */
    q('[data-verify]').forEach((box) =>
      box.addEventListener('ui-change', (event) => {
        toggle('verified', box.dataset.verify, event.detail.checked);
        changed();
        paint();
      })
    );

    q('[data-allergy]').forEach((box) =>
      box.addEventListener('ui-change', (event) => {
        const id = box.dataset.allergy;
        const on = event.detail.checked;

        /* NKDA is the claim that there are none. Ticking it clears every
           allergen the sheet holds — including the typed ones, which is the
           only reading of "no known drug allergies" that is not a
           contradiction. Naming an allergen unticks it. */
        if (id === 'nkda' && on) {
          state.allergyChecks = state.allergyChecks.filter((c) => c === 'medications');
          state.allergyChecks.push('nkda');
          state.allergies = [];
          state.otherAllergies = '';
        } else {
          toggle('allergyChecks', id, on);
          if (on && id !== 'medications') toggle('allergyChecks', 'nkda', false);
        }
        changed();
        paint();
      })
    );

    /* --- Text, number, date and time -------------------------------------- */
    q('ui-input[data-f]').forEach((node) => {
      const key = node.dataset.f;
      node.addEventListener('ui-input', (event) => {
        state[key] = event.detail.value;
        if (key === 'otherAllergies' && event.detail.value.trim()) {
          toggle('allergyChecks', 'nkda', false);
        }
        dirty = true;
        onChange(outstanding());
      });
      /* Commit — and only now repaint, so a revealed follow-up appears when
         the nurse leaves the field rather than on the first keystroke. And
         only if something actually changed: see layoutSignature.

         Compared against the signature of what is ON SCREEN, not one taken at
         the top of this handler. `ui-input` has already written the new value
         by the time `ui-change` fires, so a snapshot taken here would be of
         the new state and would always match itself — which is exactly how
         the BMI badge and the abnormal-vitals banner came to sit out their
         own updates. */
      node.addEventListener('ui-change', (event) => {
        state[key] = event.detail.value;
        if (key === 'ivDetails') {
          state.ivGauge = [];
          state.ivSite = [];
          state.ivTrials = [];
        }
        changed();
        if (key === 'ivDetails' || layoutSignature() !== lastSignature) paint();
      });
    });

    q('ui-textarea[data-f]').forEach((node) =>
      node.addEventListener('ui-change', (event) => set(node.dataset.f, event.detail.value, { soft: true }))
    );

    /* --- Selects ---------------------------------------------------------- */
    q('ui-select[data-f]').forEach((node) => {
      const key = node.dataset.f;
      const spec = index().byKey.get(key);
      const free = spec?.freeTextKey;

      if (!free) {
        node.addEventListener('ui-change', (event) => {
          /* A select whose answer reveals a box under it — sedation history's
             Other — repaints the whole section, which replaces the <select>
             that was just used. Focus would land on nothing and a keyboard
             user would be back at the top of the sheet, so the next paint is
             told to put it back on this field. */
          refocus = node.dataset.testid;
          set(key, event.detail.value);
        });
        return;
      }

      /* A list whose Other is typed into the same box. The typed half behaves
         exactly like <ui-input>: soft on every keystroke, committed on blur,
         and repainted only if the commit changed the shape of the sheet —
         re-rendering the box being typed into takes the caret with it. */
      node.addEventListener('ui-input', (event) => {
        state[free] = event.detail.freeText;
        dirty = true;
        onChange(outstanding());
      });

      node.addEventListener('ui-change', (event) => {
        const wasTyping = state[key] === spec.freeText;
        const nowTyping = event.detail.value === spec.freeText;

        /* The swap between list and box is the same FIELD but a different
           ELEMENT once the section repaints, so the caret has to be put back
           by hand. Without it, picking Other drops focus on the floor and the
           box it just opened is one nobody is in. */
        if (wasTyping !== nowTyping) refocus = node.dataset.testid;

        if ('freeText' in event.detail) {
          state[free] = event.detail.freeText;
          state[key] = event.detail.value;
          changed();
          if (layoutSignature() !== lastSignature) paint();
          else refocus = null;
          return;
        }

        /* Stepping off Other and onto a listed drug leaves the typed name
           behind it — a record carrying both says two things at once. */
        if (!nowTyping) state[free] = '';
        set(key, event.detail.value);
      });
    });

    /* --- Sliders ---------------------------------------------------------- */
    q('input[type="range"][data-f]').forEach((node) =>
      node.addEventListener('input', () => {
        state[node.dataset.f] = Number(node.value);
        node.parentElement.querySelector('output').textContent = node.value;
        dirty = true;
        onChange(outstanding());
      })
    );

    /* --- Allergy rows ------------------------------------------------------ */
    q('[data-row]').forEach((node) => {
      const index = Number(node.dataset.row);
      const key = node.dataset.rowKey;
      const commit = (value) => {
        state.allergies[index] = { ...state.allergies[index], [key]: value };
        toggle('allergyChecks', 'nkda', false);
        changed();
        paint();
      };
      node.addEventListener('ui-change', (event) => commit(event.detail.value));
    });

    q('[data-remove-allergy]').forEach((button) =>
      button.addEventListener('click', () => {
        state.allergies.splice(Number(button.dataset.removeAllergy), 1);
        changed();
        paint();
      })
    );

    one('addAllergy')?.addEventListener('ui-click', () => {
      state.allergies.push({ allergen: '', type: '', reaction: '', severity: '' });
      toggle('allergyChecks', 'nkda', false);
      changed();
      paint();
    });

    /* --- IV quick-select ---------------------------------------------------
       A press ADDS to the row's answers and a second press takes it back off,
       because a patient can be stuck twice with two gauges at two sites. The
       composed ivDetails line is rebuilt from all three lists every time, so
       the typed field and the chips can never say different things.
       -------------------------------------------------------------------- */
    q('[data-set]').forEach((button) =>
      button.addEventListener('click', () => {
        const key = button.dataset.set;
        const value = button.dataset.value;
        const chosen = ivList(key);
        state[key] = chosen.includes(value)
          ? chosen.filter((option) => option !== value)
          : [...chosen, value];
        state.ivDetails = composeIvDetails();
        if (trialCount(state) < 3) state.ivEscalated = false;
        changed();
        paint();
      })
    );

    one('ivClear')?.addEventListener('click', () => {
      Object.assign(state, { ivGauge: [], ivSite: [], ivTrials: [], ivDetails: '', ivEscalated: false });
      changed();
      paint();
    });

    /* --- Time in room ------------------------------------------------------ */
    one('recordTime')?.addEventListener('ui-click', () => {
      state.timeInRoom = stampNow();
      state.editingTime = false;
      changed();
      paint();
    });

    one('editTime')?.addEventListener('click', () => {
      state.editingTime = true;
      paint();
    });

    one('timeEditCancel')?.addEventListener('ui-click', () => {
      state.editingTime = false;
      paint();
    });

    one('timeEditSave')?.addEventListener('ui-click', () => {
      const typed = el('timeEditInput')?.value;
      if (typed) {
        const from = state.timeInRoom;
        /* A corrected time is the same DAY at a different clock time — the
           nurse is fixing a stamp, not moving the case to another date.

           A sheet filed before stamps were ISO carries 'HH:MM', which is not
           a date any browser can parse; `new Date('07:41')` is Invalid, and
           calling toISOString on it threw where the correction was supposed
           to happen. Those fall back to today, which is the only day the
           correction can sensibly be on. */
        const parsed = new Date(from ?? '');
        const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        const [h, m] = typed.split(':').map(Number);
        state.timeInRoom = facilityWallTimeToIso(base, h, m);
        /* Same rule as the completion stamp: the correction is attributed to
           whoever made it, not to the fixture nurse. Two who-did-it stamps on
           one sheet disagreeing about who is at the keyboard is worse than
           either of them being wrong. */
        state.timeInRoomAudit = {
          from,
          at: stampNow(),
          by: currentSigner(),
        };
      }
      state.editingTime = false;
      changed();
      paint();
    });

  }

  /*
   * Closing the sheet, wherever the press came from.
   *
   * The sheet's own commit bar is one caller; a host that renders its own foot
   * over the sheet — the encounter screen's "Update checklist" — is the other,
   * through markCompleted() on the returned controller. Both go through here
   * so the stamp is written the same way either way: a host that reached into
   * state itself would be one refactor away from filing a sheet with a time
   * and no name on it.
   */
  function stampCompletion() {
    state.completedBy = currentSigner();
    state.completedAt = stampNow();
    dirty = false;
    painted.clear();
    paint();
    return { by: state.completedBy, at: state.completedAt };
  }

  /** The commit bar re-renders on every paint, so its button rebinds with it. */
  function wireSubmit() {
    el('submit')?.addEventListener('ui-click', () => {
      if (outstanding().length) return;
      stampCompletion();
      notify('Pre-procedure checklist updated.');
    });
  }

  /** Find a spec by its testid — grouped checkboxes carry it, not the key. */
  const specByTestid = (testid) => index().byTestid.get(testid);

  /* --- The default trio ----------------------------------------------------
     Nine sheets in ten are the practice's standard set-up, and retyping them
     is how the tenth gets rushed. Set writes the template, Preview reads it,
     Use takes it.
     -------------------------------------------------------------------- */

  /** Apply the template. `overwrite` decides what happens to answers already given. */
  function applyDefault(preset, overwrite) {
    Object.entries(preset).forEach(([key, value]) => {
      if (overwrite || isBlank(state[key])) {
        state[key] = Array.isArray(value) ? [...value] : value;
      }
    });
    changed();
    paint();
    notify('Default checklist applied. Arrival time and notes are left as they were typed.');
  }

  /*
   * Use Default, as a function rather than only a listener.
   *
   * The preview dialog offers the same press from inside itself — reading the
   * template and taking it is one gesture — and it has to be the SAME press,
   * clash dialog and all. A second copy of this that skipped the asking would
   * be a preview that promised one thing and did another.
   *
   * `trigger` is what focus returns to when whatever this opens is closed.
   */
  function runUseDefault(trigger) {
    const preset = loadDefault();

    /* Use Default fills the blanks; it does not overwrite work. Anything
       already answered stays unless the nurse says otherwise — a template that
       silently replaced a typed blood sugar would be worse than no template at
       all. So the clash is counted first and asked about, rather than resolved
       on the sheet's own authority.

       Counted over the questions the sheet asks, not over every key the stored
       default happens to carry — see renderedKeys. The number in this dialog
       and the number Preview Default shows are then the same number. */
    const clashes = [...renderedKeys()].filter(
      (key) => !isBlank(state[key]) && !isBlank(preset[key]) && !sameAnswer(state[key], preset[key])
    );

    if (clashes.length === 0) {
      applyDefault(preset, false);
      return;
    }

    const modal = el('overwriteModal');
    el('overwriteBody').textContent =
      `${clashes.length} field${clashes.length === 1 ? '' : 's'} on this sheet already ` +
      'have an answer that differs from the practice default. Overwriting replaces ' +
      'them; keeping them fills only the blanks.';

    const cancel = el('overwriteCancel');
    const confirm = el('overwriteConfirm');

    /* Bound per opening and torn down on the way out, so a second Use Default
       does not apply the template twice. */
    const finish = (overwrite) => {
      cancel.removeEventListener('ui-click', onCancel);
      confirm.removeEventListener('ui-click', onConfirm);
      modal.close();
      applyDefault(preset, overwrite);
    };
    function onCancel() { finish(false); }
    function onConfirm() { finish(true); }

    cancel.addEventListener('ui-click', onCancel);
    confirm.addEventListener('ui-click', onConfirm);
    modal.open(trigger);
  }

  el('useDefault')?.addEventListener('ui-click', (event) => runUseDefault(event.target));

  /*
   * Preview Default reads; it never writes.
   *
   * The body is rebuilt on every opening rather than once at mount, because
   * every line in it is a comparison against the sheet as it stands — a
   * preview built at mount would still be claiming "fills a blank" about a
   * field answered since.
   */
  el('previewDefault')?.addEventListener('ui-click', (event) => {
    const modal = el('previewModal');
    /* No dialog rendered — a host embedding the sheet some other way. Saying
       nothing is better than throwing behind a button. */
    if (!modal) return;

    const trigger = event.target;
    el('previewBody').innerHTML = defaultPreviewMarkup(loadDefault(), state);

    const close = el('previewClose');
    const apply = el('previewApply');

    /* Bound per opening and torn down on the way out, for the same reason the
       other two dialogs are: a second preview must not leave a listener behind
       that applies the template twice.

       Torn down on the dialog's own ui-close as well as on its buttons, because
       a preview is the one of the three that gets DISMISSED rather than
       answered — read it, decide against it, press Esc. That route never
       reaches the buttons, so without this the listeners survive it and the
       next Use these answers would apply the template once per preview opened
       before it.

       The preview closes BEFORE Use Default runs, so the clash dialog it may
       open is not a second modal stacked over this one — and focus returns to
       the toolbar button either way. */
    const finish = (use) => {
      modal.removeEventListener('ui-close', onDismiss);
      close.removeEventListener('ui-click', onClose);
      apply.removeEventListener('ui-click', onApply);
      modal.close();
      if (use) runUseDefault(trigger);
    };
    function onClose() { finish(false); }
    function onApply() { finish(true); }
    /* Unbound above before close() is called, so this cannot re-enter. */
    function onDismiss() { finish(false); }

    modal.addEventListener('ui-close', onDismiss);
    close.addEventListener('ui-click', onClose);
    apply.addEventListener('ui-click', onApply);
    modal.open(trigger);
  });

  el('setDefault')?.addEventListener('ui-click', (event) => {
    // Time and notes belong to the patient in front of you, never to the
    // default — a pre-filled arrival time is a lie the next nurse signs, and a
    // pre-filled attestation is a forged one.
    const preset = {
      ...values(),
      timeInRoom: '',
      timeInRoomAudit: null,
      notes: '',
      attestation: false,
      anticoagulantAcknowledged: false,
      completedBy: '',
      completedAt: '',
      vitalsTakenAt: '',
    };

    const modal = el('setDefaultModal');
    /* No dialog rendered — a host embedding the sheet some other way. Saving
       silently is better than a button that does nothing. */
    if (!modal) {
      storeDefault(preset);
      notify('Saved as the practice default for this checklist.');
      return;
    }

    /* Counted, not listed. The number is what makes the press worth pausing
       over; naming a hundred and eighty fields would not. */
    const answered = Object.keys(preset).filter((key) => !isBlank(preset[key])).length;
    el('setDefaultBody').textContent =
      `${answered} answers on this sheet will become the template every ` +
      'pre-procedure checklist opens from, for everyone in the practice. The ' +
      'arrival time, the notes and the attestation are never saved — those ' +
      'belong to the patient in front of you.';

    const cancel = el('setDefaultCancel');
    const confirm = el('setDefaultConfirm');

    /* Bound per opening and torn down on the way out, for the same reason the
       overwrite dialog is: a second press must not save the template twice. */
    const finish = (save) => {
      cancel.removeEventListener('ui-click', onCancel);
      confirm.removeEventListener('ui-click', onConfirm);
      modal.close();
      if (!save) return;
      storeDefault(preset);
      notify('Saved as the practice default for this checklist.');
    };
    function onCancel() { finish(false); }
    function onConfirm() { finish(true); }

    cancel.addEventListener('ui-click', onCancel);
    confirm.addEventListener('ui-click', onConfirm);
    modal.open(event.target);
  });

  el('viewPdf')?.addEventListener('ui-click', () =>
    notify('PDF preview is not available in this prototype.', 'info')
  );
  el('downloadPdf')?.addEventListener('ui-click', () =>
    notify('PDF export is not available in this prototype.', 'info')
  );

  /* --- The unsaved-changes guard -------------------------------------------
     A sheet half worked through is the one thing on this screen that cannot
     be reconstructed from anywhere else.
     -------------------------------------------------------------------- */

  const guard = (event) => {
    if (!dirty) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  };
  window.addEventListener('beforeunload', guard);

  /* --- Go ------------------------------------------------------------------
     The wrappers go in once; paint() fills the bodies and keeps them in step
     from there.
     -------------------------------------------------------------------- */

  el('sections').innerHTML = shellMarkup();
  paint();

  return {
    state,
    values,
    outstanding,
    refresh: () => {
      painted.clear();
      paint();
    },
    signature: PRE_CHECK_SIGNATURE,
    /** Who would sign it right now — for a host drawing its own foot. */
    signer: currentSigner,
    /** Stamp and repaint, for a host whose commit lives outside the sheet. */
    markCompleted: stampCompletion,
    dirty: () => dirty,
    markSaved: () => {
      dirty = false;
    },
    destroy: () => window.removeEventListener('beforeunload', guard),
  };
}
