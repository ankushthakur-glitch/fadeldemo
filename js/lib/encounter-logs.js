/**
 * THE ENCOUNTER'S LOGS, AS A SPEC.
 *
 * Named for the intra-procedure step it was written for, and no longer only
 * that: the practice's medication cart, the specimen pots and the
 * complications register are the same shape as a vitals trend, so they are
 * declared here too.
 *
 * TWO ORDER SETS USED TO BE DECLARED HERE AND NEITHER IS ANY MORE. The
 * anaesthetist's went first, then the endoscopist's, and both went for the
 * same reason: an order set is not a run of entries somebody appends to during
 * a case, it is the practice's standing list, decided once in front of one
 * patient and signed. Both are forms now — see 'anaes-preop' and 'orders' in
 * js/lib/encounter-docs.js.
 *
 * That shape is: a table of what has been recorded, and a form that appends one
 * more row to it. A set of observations, a drug, a bag of fluid, oxygen, an
 * Aldrete score, a pot, a complication —
 * different columns, identical mechanics.
 *
 * Built the obvious way, each of those is its own pair of cards — an inline
 * form stacked on top of its own table, eight times over. That is where they
 * drift: the vitals form knows to stamp a time and the oxygen form does not,
 * one table shows an empty state and the next shows an empty tbody, and nobody
 * notices because no two of them are ever on screen together. The record
 * drawer's own comment made the same case before this file existed — "four
 * near-identical drawers would drift apart within a month".
 *
 * So this file declares them and one renderer draws them all. Adding a ninth
 * log is an entry in this object, not a new screenful of markup.
 *
 * WHAT A SPEC SAYS
 *   title / addLabel   what the log is called, and what the button offers
 *   empty              what an untouched log says instead of showing a headless
 *                      table — "no vitals recorded" is information; a table with
 *                      only headings is a bug the eye has to rule out
 *   columns            [{ key, label, mono, badge, align, format }]
 *   fields             the add form, in the order it is filled
 *   build(values)      form values → one row, including the stamp
 *   seed               the rows the case opens with
 *
 * FIELD TYPES are text, number, time, select, textarea and `suggest` — a typed
 * box with the known answers attached to it, for the one question that is both
 * a pick and a name (see the medication field below).
 *
 * Two more exist:
 *
 *   initials a press confirming who is accountable for the entry. On every log
 *            but one there is a single such field and its answer is filed in
 *            the row's `by` column; the medication form asks TWICE — once for
 *            the dose, once for the wastage witness — and each stores its
 *            answer under its own key as well.
 *   toggle   a tick that decides whether a run of other fields is asked at all.
 *            Fields name it back through `showIf`, and a field its toggle is
 *            hiding is neither required nor read.
 *
 * Anything that wants a seventh is probably not a log entry.
 *
 * EVERY COLUMN HAS A FIELD THAT FILLS IT. The logs were widened to carry what a
 * real sedation record carries — the gauge the fluid went through, the witness
 * on a controlled drug, the mean arterial pressure — and each one arrived with
 * the control that answers it. A column nothing can write to is a column of
 * dashes, which is worse than not having asked.
 *
 * OPTIONS THAT DEPEND ON ANOTHER ANSWER. A select may name `dependsOn`, and the
 * spec then answers `optionsFor(key, values)` with the list that field should
 * be offering given what has been filled in so far. The dose ladder is the
 * whole reason it exists: the amounts worth offering are the ones that belong
 * to the drug, and the drug is a different field.
 */
import {
  VITALS_LOG,
  MEDICATION_LOG,
  IV_SOLUTIONS,
  OXYGEN_LOG,
  SEDATION_FORMULARY,
  PROCEDURE_PHASES,
  RAMSAY_SCALE,
  MEDICATION_ROUTES,
  MEDICATION_CATEGORIES,
  MEDICATION_UNITS,
  MEDICATION_DOSES,
  IV_SOLUTION_TYPES,
  IV_RATES,
  OXYGEN_DELIVERY,
  ALDRETE_CATEGORIES,
  ALDRETE_PHASES,
  ALDRETE_THRESHOLD,
} from '../../data/procedure-encounter.js';
import { REPORT_STAFF, TIME_MARKERS } from '../../data/procedure-report.js';
/* The practice's stock catalogue, so the encounter's own cart list can be
   filled from what is actually on the shelf rather than from memory — and the
   reasons a lot is written off, so the wastage log offers the same eight the
   inventory screen does. One vocabulary: "Broken vial or container" recorded
   at the bedside is the line the register already groups by. */
import { MEDICATIONS, WASTE_REASONS } from '../../data/medication-inventory.js';
/*
 * AND THE WRITE BACK, WHICH FOR A LONG TIME DID NOT EXIST.
 *
 * The comment above these imports used to end "read only — nothing here writes
 * back to stock control, which keeps its own counts", and that was an accurate
 * description of a bug. Stock control kept counts of a shelf that nobody was
 * drawing from: the twelve days of fixture list in data/medication-usage.js
 * came off it, and the drug a nurse actually pushed on this screen did not.
 *
 * The ledger closes it. Both medication logs below post to it — an
 * administration draws units off the first-expiring lot, a wastage draws units
 * AND writes a line into that lot's waste log — and Settings ▸ Inventory folds
 * the result into what it shows. See js/lib/medication-ledger.js for why the
 * two are one list and why it is scoped to the session.
 */
import { recordAdministration } from './medication-ledger.js';
import {
  SPECIMEN_LOG,
  COMPLICATION_TYPES,
} from '../../data/procedure-encounter.js';

/** The clock, as a field default. Every log stamps the moment it was written. */
export function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * An ISO date as the register prints it — 2026-08-20 becomes 20 Aug 2026.
 *
 * Only the complications table needs it, and only because it is the one log
 * whose rows are not all from the same day. Anything that is not a date is
 * handed back untouched, so a row seeded or corrected with a word in the field
 * shows the word rather than "NaN".
 */
const DATE_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function shortDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} ${DATE_MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * Today, as a field default, in the form <input type="date"> reads back.
 *
 * Only the complications register needs it: every other log on this screen is
 * a within-the-case sheet where the day is a given. See the note on that
 * spec's `date` column for why that one is different.
 */
export function nowDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/**
 * How badly, in the three words the practice register already uses.
 *
 * Deliberately the SAME three as data/complications.js, and deliberately not
 * imported from it: that module derives fifty seeded complications off the
 * theatre log to compute a unit-wide rate, and pulling all of that in for three
 * strings would make one encounter's severity dropdown depend on the whole
 * medication-usage file. The list is short, closed and the sort of thing that
 * changes in both places or neither.
 *
 * Ascending, worst last, because the Highest severity card walks it backwards
 * and a list written in the order a badge escalates needs no comment at the
 * call site to say which end is which.
 */
const SEVERITY_LEVELS = ['Mild', 'Moderate', 'Severe'];

/**
 * The type that comes up most, and how often — or nothing, on an empty table.
 *
 * Ties go to whichever the reader met first, which is the only answer that does
 * not need a tie-break rule nobody would be able to predict. On a single
 * encounter a tie is two rows, and naming either is honest.
 */
function commonComplication(rows) {
  const counts = new Map();
  rows.forEach((row) => counts.set(row.type, (counts.get(row.type) ?? 0) + 1));
  let best = null;
  counts.forEach((count, type) => {
    if (!best || count > best.count) best = { type, count };
  });
  return best;
}

/* Who is charting. A fixture — a real system takes it from the session — but it
   is stamped rather than left blank, because an unattributed row in a sedation
   record is the one thing nobody can reconstruct afterwards. */
const BY = 'MO';

/* And who signs the doctor's half of the run. The two halves stamp their rows
   differently and always have: the sedation record's By column prints initials
   and the specimens, complications and notes print a name, which is what a
   reader of each of those tables expects to find in it. Attaching an
   attestation to a form must not quietly change what its rows say, so each
   signer carries both — the `name` the drawer's button confirms an identity
   against, and the `stamp` that identity puts in the row. */
const MD_BY = 'D. Smith, MD';

/* The nurse anaesthetist charts most of the run, so this is the default the
   drawer falls back to; only the logs below that say otherwise are the
   doctor's. See drawerSigner in js/screens/encounter.js. */
export const DEFAULT_SIGNER = Object.freeze({ name: REPORT_STAFF.anaesthesia, stamp: BY });
const MD_SIGNER = Object.freeze({ name: MD_BY, stamp: MD_BY });

/*
 * WHO CHARTED IT, ASKED ON EVERY MODAL THE RUN OPENS.
 *
 * A press, not a text box — see the note on the field type in
 * js/screens/encounter.js. Signing for an entry is an act, and typed initials
 * are the field everybody fills with whatever is quickest.
 *
 * It used to sit on five of the twelve logs — the ones that hand a drug or a
 * score to a patient — and the other seven filed on a stamped name nobody had
 * pressed anything to assert. That split does not survive being read back: a
 * pathology pot, a cancelled order, a complication and a note that went to the
 * patient are all entries somebody has to stand behind, and a record where
 * some rows carry an attestation and some only carry a default cannot tell a
 * reader which is which. So it is one object, shared by every spec rather than
 * copied into each — the question is identical wherever it is asked, and a
 * per-log copy is a per-log chance for one form to stop requiring it.
 */
const INITIALS_FIELD = Object.freeze({
  key: 'initials',
  type: 'initials',
  label: 'Staff initials',
  required: true,
  span: 2,
});

/*
 * TWO OF THEM, ON THE ONE FORM THAT NEEDS TWO.
 *
 * INITIALS_FIELD above is the single attestation every other log asks for, and
 * the control is right: signing for an entry is an act, and typed initials are
 * the field everybody fills with whatever is quickest.
 *
 * What that shape could not express is a form describing something TWO people
 * did. A controlled drug routinely involves two: the CRNA pushes, and somebody
 * else watches the remainder go into the sink. One button on the medication
 * form meant one name against both facts, so a discard witnessed by the
 * recovery nurse was filed under whoever charted the dose — thin on the dose
 * and simply wrong on the wastage, which exists precisely to record that a
 * second person was there.
 *
 * So that form asks twice, with the same control both times: press to confirm
 * for the dose, press again to confirm the wastage. The button is unchanged
 * everywhere on the run, including here; what changed is how many of them one
 * form can carry, and that each stamps its own column rather than sharing one.
 */
const medicationSignerField = (key, label, extra = {}) =>
  Object.freeze({ key, type: 'initials', label, required: true, span: 2, ...extra });

/** Aldrete categories as select options, and the points each answer carries. */
const aldretePoints = (categoryId, label) =>
  ALDRETE_CATEGORIES.find((c) => c.id === categoryId)?.options.find((o) => o.label === label)
    ?.points ?? 0;

const aldreteField = (category) => ({
  key: category.id,
  type: 'select',
  label: category.label,
  options: category.options.map((o) => `${o.label} (${o.points})`),
  required: true,
});

/* The form gives back "Fully awake (2)"; the row wants the words and the score
   separately. Splitting on the trailing bracket keeps the option list readable
   in the drawer, which is where the points actually help the person choosing. */
const stripPoints = (value) => String(value ?? '').replace(/\s*\(\d\)$/, '');

/* ===========================================================================
   THE NOTE, WHICH USED TO BE THE LETTER MODULE

   Everything the 'letters' log needs that is not a field: the three types, the
   case it is writing about, the composer that turns the two into a draft, and
   the one rendering both the View dialog and the printer use.

   It lives here rather than in js/screens/encounter.js because it is a
   description of what a letter IS, and the screen's job is to draw things. The
   same rule that put a vital sign's columns in this file rather than in the
   renderer that paints them.
   ======================================================================== */

/**
 * The three staging offered, and no more.
 *
 * They are not "what the letter says" — that is the subject — but WHO it is
 * for, because that is the fact everything downstream turns on: who it is
 * addressed to, what it is allowed to contain, and which of the three
 * destinations it goes out by. A fourth would need an answer to all three
 * before it could be added.
 */
export const NOTE_TYPES = ['Clinician', 'Patient', 'Recall'];

/* The pill each type wears. Clinician is the loud one because it is the letter
   with a deadline on it — a referrer waiting on a result — and a register is
   scanned for it. The other two are quiet: they are routine, and a table where
   every row shouts is a table where nothing does. */
const NOTE_TYPE_TONES = {
  Clinician: 'info',
  Patient: 'neutral',
  Recall: 'neutral',
};

/**
 * WHERE EACH TYPE GOES, AND WHY IT IS NOT A SET OF TICK BOXES.
 *
 * Under the workflow this replaces staging's with, filing the note sends it.
 * The destinations are therefore a property of who it is addressed to, not a
 * question asked at the moment of sending: a referring clinician's letter has
 * no business in the patient's portal, and a patient does not have a fax
 * machine. Three checkboxes on the form would be three chances a month to send
 * a clinician's letter to the wrong place, in exchange for a flexibility
 * nobody has asked for.
 */
const NOTE_ROUTES = {
  Clinician: ['the recipient’s email', 'the fax line on file'],
  Patient: ['the patient portal', 'the email on file'],
  Recall: ['the patient portal', 'the email on file'],
};

/**
 * THE CASE THE NOTES ARE ABOUT.
 *
 * A letter is the one log entry that cannot be written from the spec alone: it
 * names the patient, their MRN, what was done to them, when, and who referred
 * them, and none of that is knowable from a file describing what a log is.
 *
 * So the screen hands it over once, on load — see setNoteContext, called from
 * js/screens/encounter.js — and the composer reads it. The alternative was to
 * put the composer on the screen, which would have split the definition of a
 * note across two files with the fields in one and the letter in the other.
 *
 * The defaults are what a letter drafted before the screen has said anything
 * reads like: blanks rather than placeholder names, because a template that
 * invents a patient is a template that eventually sends one.
 */
let noteContext = {
  practice: null,
  patient: '',
  mrn: '',
  procedure: '',
  procedureDate: '',
  indication: '',
  referring: '',
  provider: '',
  specimens: [],
};

/** Told once, by the screen that knows. See noteContext. */
export function setNoteContext(next) {
  noteContext = { ...noteContext, ...next };
}

/** The two the recipient box offers, in the order a procedure generates them. */
function recipientOptions() {
  return [noteContext.referring, noteContext.patient].filter(Boolean);
}

/** Today, as the register's Date column prints it. */
function noteDateLabel() {
  return shortDate(nowDate());
}

/** Today, as a letter dates itself — "4 August 2026", not "04/08/2026". */
function letterDateLabel() {
  const now = new Date();
  return `${now.getDate()} ${
    ['January','February','March','April','May','June',
     'July','August','September','October','November','December'][now.getMonth()]
  } ${now.getFullYear()}`;
}

/** "a, b and c" — for the sentence that reports where a note went. */
function listSentence(items) {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * How a letter opens, given who is reading it.
 *
 * "Dear Dr Aberle" for a clinician and "Dear Mr Doe" for a patient is a
 * distinction the composer cannot reliably draw from a name — so it does not
 * try. The recipient is greeted by the name that was typed, which is what
 * staging did and what a letter with a title already in the name wants.
 */
const salutation = (recipient) => `Dear ${recipient || '—'},`;

/**
 * The letterhead every note is written on.
 *
 * Read from the practice profile rather than typed, so a practice that renames
 * itself in Settings renames itself on its correspondence. Four lines and a
 * rule, which is the shape staging used and the shape a fax cover expects.
 */
function letterhead() {
  const practice = noteContext.practice;
  if (!practice) return '';
  const { line1, line2, city, state, zip } = practice.physicalAddress ?? {};
  return [
    practice.name,
    line1,
    line2,
    [city, state, zip].filter(Boolean).join(', '),
    `Phone: ${practice.phone} | Fax: ${practice.fax}`,
    '—'.repeat(46),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The clinical middle of the letter — what was done, why, and what came back.
 *
 * Only the lines that have an answer. A draft that prints "Indication: —" is
 * asking the clinician to notice an empty field and delete it, and the one
 * they do not notice goes out with a dash in it.
 */
function clinicalBlock() {
  const lines = [
    noteContext.procedure && `Procedure: ${noteContext.procedure}`,
    noteContext.procedureDate && `Date of procedure: ${noteContext.procedureDate}`,
    noteContext.indication && `Indication: ${noteContext.indication}`,
  ].filter(Boolean);

  /* The pots, as the pathology register has them. A result letter whose whole
     subject is what came back from the lab should arrive with the lab's own
     rows in it rather than with the clinician retyping them off the table one
     tab away — and a pot still in transit is named as such, because "no
     result yet" is the thing the referrer most needs telling. */
  const specimens = (noteContext.specimens ?? []).map(
    (pot) => `  Pot ${pot.pot} — ${pot.site}: ${pot.result && pot.result !== '—' ? pot.result : `awaited (${pot.status.toLowerCase()})`}`
  );

  if (specimens.length) lines.push('', 'Specimens:', ...specimens);
  return lines.join('\n');
}

/**
 * A DRAFT, FROM THE TYPE AND THE RECIPIENT.
 *
 * Returns all three of the answers that follow from picking a type — who it
 * goes to, what it is about, and the letter — so the form can fill in as much
 * of itself as the case allows and leave the clinician the paragraph that is
 * actually theirs to write.
 *
 * The three types are three different letters, not one letter with three
 * addresses on it. A referrer is being sent a result; a patient is being told
 * what was found in words they did not need a degree to read; a recall is
 * neither, it is an appointment being asked for. Writing one template and
 * swapping the salutation would have produced a patient letter that reads like
 * a pathology report, which is the specific thing patients complain about.
 */
function composeNote(values = {}) {
  const kind = values.kind || '';
  const { patient, mrn, provider, practice } = noteContext;
  const who = mrn ? `${patient} (MRN ${mrn})` : patient;

  const recipient =
    values.recipient || (kind === 'Clinician' ? noteContext.referring : patient) || '';

  const subject = {
    Clinician: `Procedure and pathology report — ${patient}`,
    Patient: `Your procedure results — ${patient}`,
    Recall: `Appointment recall — ${patient}`,
  }[kind] ?? '';

  const signOff = ['', 'Sincerely,', provider || '', practice?.name || ''].filter(
    (line, i) => i === 0 || line
  );

  const opening = {
    Clinician: [
      `Re: ${who}`,
      '',
      clinicalBlock(),
      '',
      'Thank you for referring this patient. The findings and any histology are set out above; a copy of the full report is enclosed.',
    ],
    Patient: [
      `Re: your procedure on ${noteContext.procedureDate || 'the date of your appointment'}`,
      '',
      clinicalBlock(),
      '',
      'This letter is to let you know the results of your recent procedure. Please read it through, and contact the clinic if anything in it is unclear or if your symptoms change.',
    ],
    Recall: [
      `Re: ${who}`,
      '',
      clinicalBlock(),
      '',
      'Our records show that you are due for a further procedure. Please contact the clinic to arrange an appointment at your convenience.',
    ],
  }[kind];

  if (!opening) return { recipient, subject, body: '' };

  const body = [letterhead(), '', letterDateLabel(), '', salutation(recipient), '', ...opening, ...signOff]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return { recipient, subject, body };
}

/**
 * Is this body still the composer's, or has somebody written in it?
 *
 * The pre-fill redrafts on a change of type or recipient, and must not do that
 * over a paragraph a clinician has typed. Comparing against every draft the
 * composer could have produced for the current case is cheap — there are three
 * types and a handful of recipients — and it is exact, where a "has it been
 * touched" flag would be one more piece of state to keep in step with a field
 * that can also be edited, undone and retyped back to where it started.
 */
function isComposedBody(body) {
  const text = String(body ?? '').trim();
  if (!text) return true;
  return NOTE_TYPES.some((kind) =>
    ['', ...recipientOptions()].some(
      (recipient) => composeNote({ kind, recipient }).body.trim() === text
    )
  );
}

/**
 * ONE RENDERING OF A LETTER, FOR BOTH THINGS THAT SHOW IT.
 *
 * The View dialog and the printer draw the same markup, because they are the
 * same letter and the reader is entitled to expect that what they read on
 * screen is what comes out of the printer. Staging had them as two — a modal
 * and a print window — and they had already drifted: the modal showed a Type
 * badge the printed page did not.
 *
 * Returned as markup rather than as a component, because the printer's copy
 * is written into a bare element inside the log card (see printLogRow in
 * js/screens/encounter.js) and nothing about a page being composed for paper
 * wants a custom element upgrading in the middle of it.
 */
function letterSheet(row) {
  const line = (label, value) =>
    `<div class="encv__letter-line"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;

  return `<dl class="encv__letter-meta">
      ${line('Recipient', row.recipient)}
      ${line('Type', row.kind)}
      ${line('Subject', row.subject)}
      ${line('Sent', row.date)}
      ${line('By', row.by)}
    </dl>
    <div class="encv__letter-body" data-testid="encv--letter-body"
      tabindex="0" role="region" aria-label="Letter">${escapeHtml(row.body)}</div>
    ${
      /* Where it went, under the letter rather than beside it. It is the one
         thing on this sheet that is not part of the letter — it is what the
         system did with it — and a reader checking a copy against what the
         recipient holds should reach the end of the letter first. */
      row.routes?.length
        ? `<p class="encv__letter-routes" data-testid="encv--letter-routes">Sent to ${escapeHtml(
            listSentence(row.routes)
          )} on ${escapeHtml(row.date)}.</p>`
        : ''
    }`;
}

/* The renderer's own escape, because this file composes markup for two dialogs
   and cannot reach the screen's. Same five characters, same order. */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const ENCOUNTER_LOGS = {
  /* --- Times ---------------------------------------------------------------
     Not the anaesthesia start/stop pair, which is two fields on the record, but
     the run of marked moments the case is reconstructed from afterwards. Same shape as
     every other log, so it is one. */
  times: {
    title: 'Procedure times',
    addLabel: 'Record time',
    empty: 'No times recorded',
    columns: [
      { key: 'time', label: 'Time', mono: true },
      { key: 'marker', label: 'Marker' },
      { key: 'phase', label: 'Phase', badge: true },
      { key: 'elapsed', label: 'Elapsed', mono: true, align: 'right' },
      { key: 'source', label: 'Source' },
      { key: 'room', label: 'Room' },
      { key: 'verified', label: 'Verified', badge: true },
      { key: 'note', label: 'Note' },
      { key: 'by', label: 'By', align: 'right' },
    ],
    fields: [
      {
        key: 'marker',
        type: 'select',
        label: 'Marker',
        required: true,
        options: [
          'Anaesthesia start', 'Scope in', 'Caecum reached', 'Scope out',
          'Anaesthesia stop', 'Out of room',
        ],
      },
      { key: 'time', type: 'time', label: 'Time', required: true, default: nowTime },
      { key: 'phase', type: 'select', label: 'Phase', options: PROCEDURE_PHASES, required: true },
      { key: 'elapsed', type: 'number', label: 'Elapsed (min from start)', placeholder: '0' },
      /* Who says so. A time typed by a nurse and a time read off the monitor
         are different evidence, and the record should not flatten them. */
      { key: 'source', type: 'select', label: 'Source', options: ['Manual', 'Monitor', 'Scope'] },
      { key: 'room', type: 'select', label: 'Room', options: ['Endo 1', 'Endo 2', 'Recovery'] },
      /* A time read back to the room and agreed, versus one written down. The
         distinction is the whole point of a timeout. */
      { key: 'verified', type: 'select', label: 'Verified aloud', options: ['Yes', 'No'] },
      { key: 'note', type: 'text', label: 'Note', placeholder: 'Anything the record should carry', span: 2 },
      INITIALS_FIELD,
    ],
    build: (v) => ({
      time: v.time,
      marker: v.marker,
      phase: v.phase,
      elapsed: v.elapsed === '' ? '—' : `${v.elapsed} min`,
      source: v.source || 'Manual',
      room: v.room || 'Endo 1',
      verified: v.verified || 'No',
      note: v.note || '—',
      by: v.initials || BY,
      high: v.verified === 'No',
    }),
    seed: TIME_MARKERS.map((m, i) => ({
      ...m,
      phase: 'Intra',
      elapsed: `${[2, 10, 22][i] ?? 0} min`,
      source: i === 1 ? 'Scope' : 'Manual',
      room: 'Endo 1',
      verified: 'Yes',
      note: '—',
      by: BY,
    })),
  },

  /* --- Vitals -------------------------------------------------------------- */
  vitals: {
    title: 'Vital signs',
    addLabel: 'Record vitals',
    empty: 'No vital signs recorded',
    /* The last row is the one being acted on, so it is marked. A trend table
       where every row looks the same makes the reader find "now" by date. */
    markLatest: true,
    columns: [
      { key: 'time', label: 'Time', mono: true },
      { key: 'phase', label: 'Phase', badge: true },
      { key: 'bp', label: 'BP', mono: true },
      { key: 'hr', label: 'HR' },
      { key: 'spo2', label: 'SpO₂', format: (v) => (v ? `${v}%` : '—') },
      { key: 'resp', label: 'RR' },
      { key: 'pain', label: 'Pain', format: (v) => (v === '' || v == null ? '—' : `${v}/10`) },
      { key: 'ramsay', label: 'Ramsay' },
      { key: 'map', label: 'MAP', mono: true, align: 'right' },
      { key: 'by', label: 'By', align: 'right' },
    ],
    fields: [
      /* The same four phases every other log on this step files against. This
         field once offered the depth-of-sedation ladder instead, on the grounds
         that a vitals trend is read against induction and maintenance — but the
         depth of sedation is on the reading already, as its Ramsay score, and
         a phase that no other log used could not be lined up with any of them. */
      { key: 'phase', type: 'select', label: 'Procedure phase', options: PROCEDURE_PHASES, required: true },
      { key: 'time', type: 'time', label: 'Time', required: true, default: nowTime },
      { key: 'systolic', type: 'number', label: 'Systolic BP', placeholder: '120', required: true },
      { key: 'diastolic', type: 'number', label: 'Diastolic BP', placeholder: '80', required: true },
      { key: 'hr', type: 'number', label: 'Heart rate', placeholder: '72' },
      { key: 'spo2', type: 'number', label: 'SpO₂ (%)', placeholder: '98' },
      { key: 'resp', type: 'number', label: 'Respiratory rate', placeholder: '16' },
      { key: 'pain', type: 'number', label: 'Pain (0–10)', placeholder: '0' },
      {
        key: 'ramsay',
        type: 'select',
        label: 'Ramsay sedation scale',
        options: RAMSAY_SCALE.map((r) => r.label),
        span: 2,
      },
      INITIALS_FIELD,
    ],
    build: (v) => ({
      time: v.time,
      phase: v.phase,
      bp: `${v.systolic}/${v.diastolic}`,
      hr: v.hr,
      spo2: v.spo2,
      resp: v.resp,
      pain: v.pain,
      /* Stored as the digit, chosen as the sentence: "3" is what the table has
         room for, and "responds to commands only" is what makes it choosable. */
      ramsay: String(v.ramsay ?? '').split(' ')[0],
      /* Mean arterial pressure, computed rather than asked for: it is
         (systolic + 2 × diastolic) / 3 every time, and a field for it is a
         field somebody can get wrong. */
      map: v.systolic && v.diastolic
        ? String(Math.round((Number(v.systolic) + 2 * Number(v.diastolic)) / 3))
        : '—',
      by: v.initials || BY,
      /* Flagged rather than judged: the row is marked so the eye stops on it,
         and what to do about it stays with the anaesthetist. */
      high: Number(v.systolic) >= 160 || Number(v.diastolic) >= 95,
    }),
    /*
     * The row holds `bp: "142/88"` because that is what the table shows; the
     * form asks for the two numbers separately because that is how they are
     * read off the monitor. Everything else round-trips on its own, so this is
     * the only mapping the log needs — and without it, opening an entry to
     * correct it presented an empty systolic and diastolic and then refused to
     * save.
     */
    toForm: (row) => {
      const [systolic = '', diastolic = ''] = String(row.bp ?? '').split('/');
      return { ...row, systolic, diastolic };
    },
    seed: VITALS_LOG.map((r) => {
      const [sys, dia] = r.bp.split('/').map(Number);
      return { ...r, map: String(Math.round((sys + 2 * dia) / 3)) };
    }),
  },

  /* --- Aldrete --------------------------------------------------------------
     THE TABLE IS THE HISTORY, and the title says so.

     Recovery does not read one Aldrete score, it reads the run of them: 6 at
     handover, 8 twenty minutes later, 10 before the patient dresses. Titled
     "Aldrete scores" it read as the place a score is TAKEN, and the history
     everyone went looking for seemed to be missing — it was on screen the
     whole time under a name that did not claim to be it.

     No time column. A score is filed against the PHASE of the case, which is
     what it is read against, and every row already carries the initials of
     whoever gave it. A clock time on a score taken "at some point in
     recovery" was a precision the record does not have.
     ----------------------------------------------------------------------- */
  aldrete: {
    title: 'Aldrete score history',
    addLabel: 'Score patient',
    empty: 'No Aldrete score recorded',
    markLatest: true,
    columns: [
      { key: 'phase', label: 'Procedure phase', badge: true },
      { key: 'activity', label: 'Activity level' },
      { key: 'respiration', label: 'Respiration' },
      { key: 'circulation', label: 'Circulation' },
      { key: 'consciousness', label: 'Consciousness' },
      { key: 'oxygen', label: 'O₂ sat' },
      { key: 'total', label: 'Total', align: 'right', mono: true },
      { key: 'dischargeable', label: 'Dischargeable' },
      { key: 'note', label: 'Note' },
      { key: 'by', label: 'Initials', align: 'right' },
    ],
    fields: [
      /* ALDRETE_PHASES, not the shared list every other log files against — an
         Aldrete score is only meaningful at the three moments named there. See
         the note on the constant in data/procedure-encounter.js. */
      { key: 'phase', type: 'select', label: 'Procedure phase', options: ALDRETE_PHASES, required: true },
      ...ALDRETE_CATEGORIES.map(aldreteField),
      { key: 'note', type: 'text', label: 'Note', placeholder: 'Anything the score does not say', span: 2 },
      INITIALS_FIELD,
    ],
    /*
     * The running total, shown in the form while it is being filled.
     *
     * Ten is the whole point of the score and it was only visible after the
     * entry was filed — so the nurse chose five answers, saved, and only then
     * found out whether the patient was dischargeable. It adds up as it is
     * answered instead, against the threshold it has to clear.
     */
    liveTotal: {
      label: 'Total score',
      max: ALDRETE_CATEGORIES.length * 2,
      threshold: ALDRETE_THRESHOLD,
      note: `${ALDRETE_THRESHOLD} or above is required for discharge`,
      compute: (v) =>
        ALDRETE_CATEGORIES.reduce((sum, c) => sum + aldretePoints(c.id, stripPoints(v[c.id])), 0),
    },
    build: (v) => {
      const total = ALDRETE_CATEGORIES.reduce(
        (sum, c) => sum + aldretePoints(c.id, stripPoints(v[c.id])),
        0
      );
      return {
        ...Object.fromEntries(ALDRETE_CATEGORIES.map((c) => [c.id, stripPoints(v[c.id])])),
        total: `${total} / 10`,
        phase: v.phase,
        /* Spelled out rather than left to be worked out from ten against a
           threshold the reader has to remember. This is the whole reason the
           score is taken. */
        dischargeable: total >= ALDRETE_THRESHOLD ? 'Yes' : 'Not yet',
        note: v.note || '—',
        by: v.initials || BY,
        high: total < ALDRETE_THRESHOLD,
      };
    },
    seed: [],
  },

  /* --- IV -------------------------------------------------------------------
     "IV", not "IVF". IVF is in-vitro fertilisation everywhere else in medicine,
     and this is the line and what is running through it. */
  iv: {
    title: 'IV',
    addLabel: 'Start IV solution',
    empty: 'No IV fluids recorded',
    /*
     * WHAT THIS LOG STOPPED ASKING, AND WHY.
     *
     * The cannula is not charted here. Its gauge, its site and how many
     * attempts it took are answered ONCE, on the pre-procedure checklist,
     * before the patient is sedated — asking again on every bag that runs
     * through it produced a second answer free to disagree with the first,
     * about the one line in the patient's arm.
     *
     * WHY THE STATUS CAME BACK.
     *
     * It was taken off, along with the start and stop times, on the argument
     * that nobody returns to close a bag and a row reading "Active" for ever
     * is worse than no status at all. That argument was about a status nobody
     * could maintain — and the fix for that is to make taking a line down one
     * press from the row it is on, not to stop recording whether it is
     * running. A nurse looking at this table mid-case is asking "what is up",
     * and a table that only lists what was ever hung cannot answer it.
     *
     * So: Active until it is ended, Completed once it has been, with the row
     * REPLACED rather than a second one appended — a bag going up and coming
     * down is one event with two ends. What ended it carries the total volume
     * actually infused, which is the number the fluid balance is added up
     * from and the one thing that cannot be reconstructed after the bag is in
     * the bin.
     */
    /*
     * TWO TABLES, NOT ONE TABLE WITH A STATUS COLUMN.
     *
     * Hanging a bag and taking it down are the two halves of one event, and
     * they are read by two different people asking two different questions.
     * Mid-case the question is "what is going into this patient right now",
     * and it was being answered by reading a Status column down a table that
     * also held every bag that had already come down — the running line, the
     * one thing that has to be found in a second, sat wherever it happened to
     * have been charted.
     *
     * So the log is split where the case splits it. What is up is its own
     * table at the top, with the End on every row of it; what has finished
     * drops into the table under it, with the volume that went in. Ending a
     * bag is the move between them, and there is nothing to file or repeat to
     * make that happen — the row leaves the first table and appears in the
     * second, which is what "we have taken that one down" looks like.
     *
     * Both tables are the same columns, deliberately. They are the same
     * record at two points in its life, not two records, and a reader
     * comparing what is running against what already ran should not have to
     * re-learn the column order half way down the card.
     */
    split: {
      parts: [
        {
          key: 'active',
          title: 'Running now',
          when: (row) => row.status === 'Active',
          empty: 'Nothing is running',
        },
        {
          key: 'done',
          title: 'Completed',
          when: (row) => row.status !== 'Active',
          empty: 'Nothing has been taken down yet',
        },
      ],
    },
    columns: [
      { key: 'solution', label: 'Solution' },
      { key: 'volume', label: 'Volume', format: (v) => `${v} ml` },
      { key: 'rate', label: 'Rate', format: (v) => `${v} ml/h` },
      /* No status column. The table a row is in IS its status now, and a badge
         reading "Active" on every row of a table headed "Running now" is the
         heading again in smaller type. What the two tables cannot say by being
         two tables is how much of the bag actually went in, so that stays. */
      { key: 'infused', label: 'Infused' },
      { key: 'note', label: 'Notes' },
      { key: 'by', label: 'Staff initials', align: 'right' },
    ],
    fields: [
      { key: 'solution', type: 'select', label: 'Solution', options: IV_SOLUTION_TYPES, required: true, span: 2 },
      { key: 'volume', type: 'number', label: 'Volume (ml)', placeholder: '500', required: true },
      { key: 'rate', type: 'select', label: 'Rate (ml/h)', options: IV_RATES, required: true },
      /* The bag that is different from the last one: a second line, a fluid
         run for a specific reason, the site it went into when it is not the
         one on the checklist. Free text because what makes a bag worth a
         remark is not a list anybody could write in advance. */
      { key: 'note', type: 'text', label: 'Notes', placeholder: 'Anything the columns above do not carry', span: 2 },
      INITIALS_FIELD,
    ],
    build: (v) => ({
      solution: v.solution,
      volume: v.volume,
      rate: v.rate,
      /* A bag being edited keeps whatever it is at; a new one is hung
         running. `build` is used for both, so the status has to survive the
         round trip rather than being reset to Active by a corrected typo. */
      status: v.status || 'Active',
      infused: v.infused || '—',
      note: v.note || '—',
      by: v.initials || BY,
    }),
    /*
     * TAKING THE LINE DOWN, AND ASKING FOR THE NUMBER THAT IS ACTUALLY ON THE
     * BAG.
     *
     * `confirm` is what makes this different from the one-press stop the logs
     * used to offer. Ending an infusion is not a correction — it closes a
     * record the fluid balance is added up from — so the press opens a dialog
     * and nothing moves between the two tables until that dialog is answered.
     *
     * What it asks for is what is LEFT, not what went in. Both describe the
     * same bag and only one of them is readable: the nurse taking the line
     * down is looking at a graduated bag with fluid still in it, and the
     * volume infused is that reading subtracted from what was hung — a sum
     * they were being asked to do in their head, at the end of a case, with
     * the next patient waiting. Left is a number they can copy off the bag.
     * Infused is derived from it and is what the table shows, because that is
     * the number the fluid balance is added up from.
     *
     * Defaulted to 0 — the bag that ran through is the common case, and a
     * blank required field between a nurse and the next patient is how a
     * volume gets typed without looking at the bag either. Clamped at both
     * ends, because "left" read off the wrong bag can exceed what was hung and
     * a negative infused volume is worse than a wrong one: it is a number
     * nothing downstream can defend itself against.
     */
    stop: {
      label: 'End',
      when: (row) => row.status === 'Active',
      heading: 'End this IV solution?',
      body: (row) => `${row.solution}, ${row.volume} ml hung at ${row.rate} ml/h.`,
      confirm: {
        key: 'left',
        type: 'number',
        label: 'Volume left in the bag (ml)',
        hint: 'Read it off the bag as it comes down. The rest is recorded as infused.',
        default: () => '0',
        required: true,
      },
      commit: 'End solution',
      apply: (row, answer) => {
        const hung = Number(row.volume) || 0;
        const left = Math.min(Math.max(Number(answer.left) || 0, 0), hung);
        return {
          ...row,
          status: 'Completed',
          infused: `${hung - left} ml`,
        };
      },
    },
    seed: IV_SOLUTIONS.map((r) => ({
      solution: r.solution,
      volume: r.volume,
      rate: r.rate,
      /* Taken from the seed rather than forced to Active: the case starts with
         one bag up and one already down, and hard-coding the status here put
         a finished bag back in the running table. */
      status: r.status || 'Active',
      infused: r.infused || '—',
      note: '—',
      by: BY,
    })),
  },

  /* --- Oxygen --------------------------------------------------------------- */
  oxygen: {
    title: 'Oxygen',
    addLabel: 'Add oxygen',
    empty: 'No oxygen recorded',
    /*
     * OXYGEN SPLITS THE WAY THE IV LOG SPLITS, AND FOR THE SAME REASON.
     *
     * The note that used to sit here said the start/stop pair had gone because
     * nobody ever came back to close it, so every entry read "Active" for the
     * rest of the record. That was true of a status COLUMN on one flat table,
     * and it is exactly what the IV log fixed rather than deleted: the two
     * states became two tables, and closing an entry became one press from the
     * row it is on instead of a form to find and file. Oxygen is the same fact
     * about a case — something is running on the patient, and at some point it
     * comes off — so it gets the same answer. What is on now is the table at
     * the top, what has come off is the table under it, and the End is the
     * move between them.
     *
     * Both tables are the same columns, as on the IV log. They are one record
     * at two points in its life, and a reader comparing what is running now
     * against what already ran should not have to re-learn the column order
     * half way down the card.
     */
    split: {
      parts: [
        {
          key: 'active',
          title: 'Running now',
          when: (row) => row.status === 'Active',
          empty: 'No oxygen running',
        },
        {
          key: 'done',
          title: 'Stopped',
          when: (row) => row.status !== 'Active',
          empty: 'Nothing has been stopped yet',
        },
      ],
    },
    columns: [
      /* "Started at", so the two time columns on this table read as the pair
         they are. The FIELD that fills it is called Administration time,
         because that is the question being answered at the bedside — the
         moment oxygen went on the patient — and "Started at" only becomes the
         better name once there is a "Stopped at" beside it to be read against. */
      { key: 'time', label: 'Started at', narrow: true, mono: true },
      { key: 'delivery', label: 'Delivery method' },
      { key: 'flow', label: 'Flow', narrow: true, format: (v) => (v ? `${v} L/min` : '—') },
      { key: 'spo2', label: 'SpO₂ at start', narrow: true, format: (v) => (v ? `${v}%` : '—') },
      { key: 'indication', label: 'Indication', clip: true },
      /* No status column, for the reason the IV log has none: the table a row
         sits in IS its status. What the two tables cannot say by being two
         tables is WHEN it came off, so that stays as a column — blank on
         everything still running. */
      { key: 'stopped', label: 'Stopped at', narrow: true },
      { key: 'note', label: 'Notes', clip: true },
      { key: 'by', label: 'By', align: 'right', narrow: true },
    ],
    fields: [
      /*
       * WHEN IT WENT ON, ASKED RATHER THAN ASSUMED.
       *
       * The log stamped nothing at the start. Every row therefore said what was
       * running and — once ended — when it came off, and the one number
       * recovery actually reads off this table, how long the patient needed
       * support, could not be worked out from it: a duration needs both ends.
       * The End dialog has always understood this about its own half of the
       * pair, and its reasoning applies identically here. Oxygen goes on in the
       * seconds around induction, when nobody is at a keyboard, so the time it
       * is charted is not the time it started.
       *
       * Defaulted to now and left editable, exactly as the End is: right often
       * enough to be a default, wrong often enough to be a field.
       */
      { key: 'time', type: 'time', label: 'Administration time', required: true, default: nowTime },
      { key: 'delivery', type: 'select', label: 'Delivery method', options: OXYGEN_DELIVERY, required: true },
      { key: 'flow', type: 'number', label: 'Flow (L/min)', placeholder: '2' },
      { key: 'spo2', type: 'number', label: 'SpO₂ at start (%)', placeholder: '96' },
      {
        key: 'indication',
        type: 'select',
        label: 'Indication',
        options: ['Routine sedation', 'Desaturation', 'Pre-oxygenation', 'Recovery'],
        required: true,
        span: 2,
      },
      { key: 'note', type: 'text', label: 'Notes', placeholder: 'Anything the other columns do not carry', span: 2 },
      /* Signed the way an Aldrete score is signed, and for the same reason: a
         press that stamps the session's initials, not a box to type two letters
         into. Oxygen started for a desaturation is the row a case gets reviewed
         on, and "MO" filed by nobody in particular is what the By column had
         been carrying on every row until now. */
      INITIALS_FIELD,
    ],
    build: (v) => ({
      time: v.time,
      delivery: v.delivery,
      flow: v.flow,
      spo2: v.spo2,
      indication: v.indication,
      /* Oxygen being edited keeps whatever state it is in; a new entry is
         filed running. `build` is used for both, so neither the status nor the
         time it came off may be reset by a corrected typo in the notes. */
      status: v.status || 'Active',
      stopped: v.stopped || '—',
      note: v.note || '—',
      by: v.initials || BY,
      /* Oxygen started because the patient desaturated is not the same event as
         oxygen started routinely, and the reader should not have to know the
         difference from the flow rate. */
      high: v.indication === 'Desaturation',
    }),
    /*
     * TAKING IT OFF, AND ASKING WHEN.
     *
     * The IV's End asks for the one number only the person at the bedside can
     * read — what is left in the bag. Oxygen has no such number; what its
     * record is missing at the end is the time. Recovery reads this log to
     * answer how long the patient needed support, and a stamp taken silently
     * at the moment somebody remembered to press End is not that time. It is
     * the time of the press.
     *
     * So the press opens the same dialog the IV's does, with the clock
     * defaulted to now and left editable. Now is right often enough to be the
     * default and wrong often enough to be a field: the mask usually comes off
     * some minutes before anyone is free to chart it.
     */
    stop: {
      label: 'End',
      when: (row) => row.status === 'Active',
      heading: 'End this oxygen?',
      body: (row) =>
        `${row.delivery}${row.flow ? ` at ${row.flow} L/min` : ''}, started for ${String(
          row.indication || 'oxygen'
        ).toLowerCase()}.`,
      confirm: {
        key: 'stopped',
        type: 'time',
        label: 'Time it came off',
        hint: 'Defaults to now. Correct it if the patient came off oxygen before anyone got to this.',
        default: () => nowTime(),
        required: true,
      },
      commit: 'End oxygen',
      apply: (row, answer) => ({
        ...row,
        status: 'Stopped',
        stopped: answer.stopped,
      }),
    },
    seed: OXYGEN_LOG.map((r) => ({
      /* The fixture carries seconds because the clinic-visit record renders it
         through a datetime control; this table shows clock times, so the row is
         trimmed to what it is going to be read as. */
      time: String(r.time).slice(0, 5),
      delivery: r.delivery,
      flow: r.flow,
      spo2: '97',
      indication: 'Routine sedation',
      /* From the seed, not forced: the case opens with the cannula still on,
         and a hard-coded status here would put a finished entry back into the
         running table the way it once did on the IV log. */
      status: r.status || 'Active',
      stopped: r.stopped || '—',
      note: '—',
      by: BY,
    })),
  },

  /* --- Medication administered ---------------------------------------------- */
  'meds-given': {
    title: 'Medication administered',
    /* "Administer medication" — what the nurse is about to do, in the words
       they would use for it. "Give medication" read as an instruction to hand
       something over. */
    addLabel: 'Administer medication',
    empty: 'No medication given',
    /*
     * WHAT A DOSE RECORD HAS TO SAY, AND WHAT IT WAS SAYING TWICE.
     *
     * Category, strength and site all came off this log because none of them
     * is a fact about the DOSE. Category and strength are properties of the
     * drug, answered once in the inventory and re-asked on every push — and
     * pre-filled from the formulary, so what they actually recorded was
     * whether anyone had edited the pre-fill. Site was a select whose answer
     * was "IV cannula" on every row of every case.
     *
     * The lot number followed them off, and for the same reason once removed.
     * A lot belongs to the BOX, not to the push: it is booked in, counted and
     * reconciled in stock control (screens/medication-inventory.html), where
     * every lot of a drug is on file with its manufacturer and expiry. Asked
     * again here it was a serial number re-read off a vial and re-typed by
     * hand, mid-case, with nothing to check it against — so what the column
     * actually held was whichever characters got typed, in a record whose
     * whole value is that the things in it were observed. The clinic's copy of
     * the lot is the one that is right, and it is the one the reconciliation
     * is done from.
     *
     * Waste and its witness came off last, and they are the reason this note
     * now ends here rather than a paragraph later. Neither is a fact about the
     * push either: the discard is arithmetic — what was in the ampoule less
     * what went in the patient — and js/lib/medication-ledger.js has always
     * done that sum itself (see `discardFor`), so the box only ever collected
     * a hand-typed second opinion on a figure the ledger already knew. The
     * witness went with it because a witness with nothing left to witness on
     * the form is two keystrokes asked of somebody mid-case for nothing. The
     * controlled-drug register that actually needs both still has them, on the
     * wastage log below, where an ampoule destroyed is the whole subject
     * rather than a footnote to a dose.
     *
     * THE TIME WENT LAST, AND IT IS THE ONE THAT IS STILL RECORDED.
     * It was a required field defaulting to the clock, which meant the form
     * asked a nurse with a syringe in one hand to confirm what the clock
     * already said — and the only answers it could collect were the right one,
     * left alone, or a wrong one, typed over it minutes later from memory. The
     * push is charted AT the push; the moment it is charted is the moment it
     * happened, which is exactly what a default of `now` was already asserting.
     * So the row is still stamped — see `build` — and the column still leads
     * the table, because a MAR read down the time column is how anybody checks
     * how long it has been since the last dose. What is gone is being asked.
     *
     * What is left on the form is what changes push to push: which drug, how
     * much, by which route — and the initials of the person saying they gave
     * it.
     */
    columns: [
      { key: 'time', label: 'Time', mono: true },
      { key: 'name', label: 'Medication' },
      { key: 'dose', label: 'Dose', mono: true },
      { key: 'route', label: 'Route' },
      /*
       * AND WHAT DID NOT REACH THE PATIENT, ON THE SAME LINE AS WHAT DID.
       *
       * Read the note over the fields for why the discard is asked for again.
       * Read here for why it is a COLUMN rather than something the form quietly
       * posts to the register: a controlled drug is reconciled by reading the
       * amount that came out of the ampoule against the amount that went into
       * the patient, and those two figures being on one line is the whole of
       * that check. Split across two documents it is a join somebody has to do
       * by hand, mid-audit, from a table that gives them no reason to think
       * there is anything to join.
       *
       * A dash on most rows, and that is the point of it: a MAR read down this
       * column shows at a glance which pushes left something over, which is the
       * shortlist a count is chased down when the drawer does not add up.
       */
      { key: 'waste', label: 'Wasted' },
      /* Two attributions, side by side, and they are frequently different
         people — which is the reason the second column exists at all. Renamed
         from a bare "Initials", because one column called Initials beside
         another column of initials tells a reader nothing about which is
         which. */
      { key: 'by', label: 'Given by', align: 'right' },
      { key: 'wasteBy', label: 'Waste witness', align: 'right' },
    ],
    fields: [
      /*
       * THE DRUG: TYPED AND PICKED, IN ONE FIELD.
       *
       * It was a closed list, and a closed list is wrong here in the one
       * direction that matters — the cart carries six drugs and a case can
       * need a seventh. Somebody reaching for glycopyrrolate found a dropdown
       * that did not contain it and no way to say so, which is how a dose ends
       * up written into the nearest free-text box, or not written at all.
       *
       * So it is a typed box with the formulary under it. Press it and the
       * cart's six drop down to pick from, exactly as before; start typing and
       * the same six narrow to what matches, so "mid" reaches Midazolam in
       * three keystrokes; type straight past them and the drug that is not on
       * the list is simply the drug that was given, which the panel says out
       * loud rather than leaving it to be guessed from an empty list. Naming
       * one the formulary knows still fills its usual dose and route in — see
       * `prefill` — because that is the half of the old dropdown worth keeping.
       */
      {
        key: 'name',
        type: 'suggest',
        label: 'Medication',
        options: SEDATION_FORMULARY.map((d) => d.name),
        placeholder: 'Type a name, or pick from the formulary',
        emptyNote: 'Not on this cart — it will be recorded exactly as typed.',
        required: true,
        span: 2,
        /*
         * AND THE CART, DRAWN OUT UNDER IT.
         *
         * The panel above only exists once somebody has pressed the box or
         * typed into it, which is the right behaviour for a list of names and
         * the wrong one for the six drugs on the trolley: mid-case, one-handed,
         * the drug is chosen before the form is touched, and a formulary that
         * has to be summoned first is one more step in the exact moment there
         * is no time for one. So the six are also on the form, as rows carrying
         * the strength and route the vial actually says — the same three facts
         * the recovery nurse's cart shows (administerMedicationCard in
         * js/screens/clinic-visit.js), because it is the same cart.
         *
         * Pressing one answers the field exactly as typing the name does: the
         * dose ladder narrows to that drug's and `prefill` below fills its
         * usual dose and route, because the press goes back in through the
         * field rather than around it.
         */
        quickSelect: SEDATION_FORMULARY.map((d) => ({
          name: d.name,
          note: `${d.strength} · ${d.route}`,
        })),
      },
      /* The amounts this drug is actually drawn up in — see `doses` on the
         formulary, and `optionsFor` below for how the list follows the drug. */
      {
        key: 'dose',
        type: 'select',
        label: 'Dose',
        options: MEDICATION_DOSES,
        dependsOn: 'name',
        required: true,
      },
      { key: 'route', type: 'select', label: 'Route', options: MEDICATION_ROUTES, required: true },
      /* The dose's own attestation. Labelled "Given by" rather than "Staff
         initials", because this form now carries two of these and a pair of
         identically-labelled buttons is a pair nobody can tell apart. */
      medicationSignerField('givenBy', 'Given by'),
      /*
       * ===================================================================
       * AND THE HALF OF THE AMPOULE THAT WENT DOWN THE SINK.
       *
       * This used to be somewhere else, and "somewhere else" was the whole
       * problem. Wastage was recorded on a form of its own, reached from the
       * Medication inventory tab — so a nurse who drew up a 5 mg ampoule and
       * gave 3 mg charted the dose here, closed the drawer, changed tab, opened
       * a second form and re-answered the drug, the time and their own identity
       * in order to say what happened to the other 2 mg. Three of those four
       * answers were already on the screen she had just closed.
       *
       * What that costs is not keystrokes. It is the wastage record, which is
       * the one somebody stops doing when the case is running late — and a
       * controlled drug whose remainder is never written down is exactly the
       * gap a diversion hides in. The discard is a fact about THIS push, it is
       * known at the moment the push is charted, and it is asked for there now.
       *
       * A TOGGLE, NOT FOUR PERMANENT BOXES. Most pushes waste nothing: a whole
       * ampoule goes in, or the drug is drawn from a shared bottle that is not
       * spent by this patient. Four empty boxes on every dose form is four
       * things to skip past mid-case, and a form that is mostly skipped is a
       * form that gets skipped in the one place it mattered.
       *
       * WHAT IS NOT ASKED IS "UNITS WASTED", and its absence is deliberate. The
       * standalone wastage form asks for it because that form describes an
       * ampoule that came off the shelf and reached nobody — the shelf has to
       * lose a unit. Here the unit is ALREADY GONE: it was drawn for this dose
       * and the ledger took it off the moment the administration posted. Asking
       * again would have the same ampoule leave the shelf twice, which is the
       * double-deduction the ledger's own notes were written to prevent. What
       * is left to ask is how much of it was destroyed, why, and who watched.
       * ===================================================================
       */
      {
        key: 'wasted',
        type: 'toggle',
        label: 'Some of this vial was wasted',
        hint: 'Records the discard against this dose, and files it on the practice wastage register.',
        span: 2,
      },
      /* In the drug's own units, because that is what a controlled-drug
         register is reconciled in and what is written on the ampoule. Left
         blank it would be a wastage of an unstated amount, which is a line an
         auditor cannot do anything with — so it is required once the toggle is
         on, and required of nobody while it is off. See `showIf` and
         saveLogEntry in js/screens/encounter.js. */
      {
        key: 'wasteAmount',
        type: 'text',
        label: 'Amount wasted',
        placeholder: 'e.g. 3 mg',
        required: true,
        showIf: 'wasted',
      },
      /* The same eight the inventory screen offers, so a discard recorded at
         the bedside lands in the group the register already sorts by. It opens
         on the one this form exists for — a part dose — rather than on a blank,
         because the other seven describe an ampoule that never got as far as a
         patient and none of them can be true of a row that also records a
         dose. */
      {
        key: 'wasteReason',
        type: 'select',
        label: 'Reason',
        options: WASTE_REASONS,
        default: () => 'Part-dose discarded',
        required: true,
        showIf: 'wasted',
      },
      /*
       * AND THE SECOND PRESS, WHICH IS THE POINT OF ASKING TWICE.
       *
       * A wastage nobody saw is a wastage nobody can attest to, and on the
       * standalone form this was a text box holding two typed letters — which
       * is precisely what somebody writes when there was no witness and the
       * form will not close without one. A press is an act; a typed pair of
       * letters is a formality.
       *
       * Its own button rather than the dose's, because the whole reason the
       * witness is recorded is that they are a different person. One press
       * covering both would file a wastage witnessed by the person who wasted
       * it, which is the opposite of what a witness is for.
       */
      medicationSignerField('wasteWitness', 'Wastage witnessed by', { showIf: 'wasted' }),
    ],
    build: (v) => {
      /* The toggle answers with a string or an empty one — see fieldValue in
         js/screens/encounter.js — and everything below it is read only through
         this, so a form filled in, toggled off and filed cannot leave a witness
         and a reason on a row that says nothing was wasted. */
      const wasted = Boolean(v.wasted);
      const amount = String(v.wasteAmount ?? '').trim();

      return {
        /* Stamped rather than asked — see the note over the columns. An edited
           row keeps whatever it was charted at: `v.time` is what the drawer
           opened holding, and re-reading the clock on a correction would move
           the dose to the time somebody fixed a typo at. */
        time: v.time || nowTime(),
        name: v.name,
        dose: v.dose,
        route: v.route,
        /* Stored twice on purpose, and the two are read by different things.
           `by` is the sedation record's own column, which has always printed
           the confirmed initials. `givenBy` is the FIELD's answer, and the
           drawer reads it back under that key when the row is opened for a
           correction — a second initials field on the same form means `by` can
           no longer be the one place both of them are read from. */
        givenBy: v.givenBy || BY,
        by: v.givenBy || BY,
        wasted: wasted ? 'yes' : '',
        wasteAmount: wasted ? amount : '',
        wasteReason: wasted ? v.wasteReason : '',
        wasteWitness: wasted ? v.wasteWitness : '',
        /* The cell, pre-composed. A dash rather than an empty cell on the rows
           that wasted nothing: an empty column reads as a question nobody got
           round to, and "nothing was left over" is an answer. */
        waste: wasted ? `${amount} · ${v.wasteReason}` : '—',
        wasteBy: wasted ? v.wasteWitness : '—',
        /* A reversal agent is the row a reader looks for first — it means
           something went wrong enough to need undoing. Read off the formulary
           now that the class is not asked for on the form: the drug knows what
           it is, and it is the drug that was given.

           A discard marks the row for the same reason by a different route: it
           is not that the case went wrong, it is that this line is one of the
           handful a controlled-drug count will be chased through. */
        high: wasted || Boolean(SEDATION_FORMULARY.find((d) => d.name === v.name)?.reversal),
      };
    },
    seed: MEDICATION_LOG.map((r) => ({
      time: r.time,
      name: r.name,
      dose: r.dose,
      route: r.route,
      givenBy: BY,
      by: BY,
      /* The case opens with three pushes and no discard against any of them,
         which is what a seeded run should say: a wastage is an event, and one
         nobody recorded must not appear on the register because a fixture
         thought it looked realistic. */
      waste: '—',
      wasteBy: '—',
      high: Boolean(SEDATION_FORMULARY.find((d) => d.name === r.name)?.reversal),
    })),
    /*
     * DELETING A PUSH, WHICH IS NOT THE SAME AS UNDOING ONE.
     *
     * Every other running sheet on this step is corrected and never emptied,
     * for the reason the formulary's own delete note gives: a set of obs taken
     * at 08:12 happened, and a record that lets somebody make it un-happen is
     * not a record. That still holds for a drug that went in.
     *
     * The row this is for is the one where the drug did NOT go in — charted on
     * the wrong case, the wrong patient, or opened, half-typed and abandoned
     * when the pump alarmed. Editing cannot fix that: there is no correct set
     * of values for an administration that never occurred, and leaving it with
     * a plausible dose and somebody's initials against it is worse than the
     * blank. Charted-in-error is a real thing that happens to a MAR, and the
     * only honest handling of it is to take the line off.
     *
     * Because the line being removed is a controlled drug going off a record
     * the stock count is reconciled against, the dialog reads the row back
     * rather than asking "are you sure?" over an anonymous one — the reader
     * has to be able to see that the row about to go is the row they meant,
     * and a reconciliation short a dose is the cost of getting that wrong.
     */
    remove: {
      label: 'Delete',
      heading: 'Delete this administration?',
      /* The discard is read back with the dose, and it has to be: a line
         carrying a wastage is a line the controlled-drug register has a copy
         of, and somebody about to remove it should be told that the copy is
         not coming with it. The last sentence says so — the register is the
         practice's record and this dialog cannot reach it. */
      body: (row) =>
        `${row.name} ${row.dose} ${row.route} at ${row.time}, ${row.by}` +
        `${row.wasted ? `, with ${row.wasteAmount} wasted and witnessed by ${row.wasteBy}` : ''}. Deleting ` +
        'takes the line off the record entirely — use it only for an entry ' +
        'charted in error, never to correct one. A dose that was given and ' +
        'written up wrongly is edited, not deleted.' +
        (row.wasted
          ? ' The wastage already filed on the practice register stays filed; ' +
            'correct that in Settings ▸ Medication inventory.'
          : ''),
      commit: 'Delete administration',
      /* The time is this log's first column, so the generic aria-label would
         read "Delete 09:14" — a label naming the clock rather than the drug.
         See `describe` in js/screens/encounter.js. */
      describe: (row) => `the ${row.name} ${row.dose} at ${row.time}`,
    },
    /* Naming a drug fills its usual dose and route from the formulary — as
       soon as what has been typed IS a drug, not only once the field is left,
       so the answer appears under the fingers of somebody who typed "midaz"
       and stopped. The nurse still has to look at what is filled in, and
       typing both for a drug the formulary already describes is how the wrong
       one gets typed. */
    prefill: (key, value) => {
      if (key !== 'name') return null;
      const drug = SEDATION_FORMULARY.find((d) => d.name === value);
      return drug ? { dose: drug.dose, route: drug.route } : null;
    },
    /* And the dose list narrows to that drug's ladder. Off the formulary — a
       drug typed rather than picked — it stays the union, because a dropdown
       with nothing in it is a form that cannot be filed. */
    optionsFor: (key, values) => {
      if (key !== 'dose') return null;
      const drug = SEDATION_FORMULARY.find((d) => d.name === values.name);
      return drug?.doses ?? MEDICATION_DOSES;
    },
    /*
     * AND THE SHELF FINDS OUT.
     *
     * `post` is the hook the log engine calls once a NEW row has been written
     * — never on an edit, for the reason saveLogEntry gives. Everything above
     * this line is the clinical record: what was given, to whom, by whom. This
     * one line is the stock consequence of it, and it is deliberately the only
     * thing in the spec that reaches outside the encounter.
     *
     * Before it, this file's own import comment said "nothing here writes back
     * to stock control, which keeps its own counts" — and that was the whole
     * problem. A nurse could push 2 mg of midazolam here, walk to Settings ▸
     * Inventory, and find a shelf that had never heard of it. The dose was on
     * the chart and the ampoule was still notionally in the box.
     *
     * What it does NOT do is deduct twice, and it is not told what was
     * discarded. The part of the ampoule that did not reach the patient is the
     * ledger's own subtraction — `discardFor` in js/lib/medication-ledger.js
     * takes the ampoule's content less this dose — and the ampoule itself was
     * already spent when it was opened, so the ledger counts it once either
     * way. Passing a hand-typed waste alongside the dose only gave the two
     * figures a way to disagree.
     */
    /*
     * WHAT THE PRESS DID BESIDES SAVE A ROW.
     *
     * "Medication administered — entry recorded" is a true sentence and an
     * incomplete one on the press that also writes a line into the practice's
     * controlled-drug register. The nurse has to be told the discard left the
     * encounter, and told WHERE it went, because the whole reason this form
     * absorbed the wastage question is that the register is somewhere she is
     * not going to walk to and check. A push that wasted nothing has nothing to
     * add and keeps the flat line.
     */
    recorded: (row) =>
      row.wasted
        ? `${row.name} ${row.dose} recorded. ${row.wasteAmount} wasted ` +
          `(${row.wasteReason.toLowerCase()}), witnessed by ${row.wasteWitness} — ` +
          'filed on the practice wastage register.'
        : null,
    post: (row, context) => recordAdministration({
      name: row.name,
      dose: row.dose,
      time: row.time,
      by: row.by,
      /*
       * ONE POST, NOT TWO, AND THAT IS THE LOAD-BEARING DECISION HERE.
       *
       * The obvious build of "capture given and wasted together" is to call
       * recordAdministration and then recordWastage, and it is wrong: each of
       * them draws units off the first-expiring lot, so one ampoule opened for
       * one part dose would leave the shelf twice and the count would sit below
       * the room by a unit for every discard anybody bothered to record. The
       * ledger has always understood a part dose — see `discardFor` — and has
       * always taken the whole ampoule once.
       *
       * So the typed figures OVERRIDE the ledger's own arithmetic on this one
       * movement rather than adding a second movement beside it. Passed
       * undefined when the toggle is off, which is the case recordAdministration
       * has always handled: it works the discard out itself, exactly as before.
       *
       * The two figures can now disagree — a nurse can type 2 mg where the
       * ampoule maths says 3 — and the note the fields removed said that was a
       * reason not to ask. It was, while nobody was accountable for the answer.
       * With a named witness against it the typed figure is an OBSERVATION and
       * the subtraction is an inference, and where those two differ the record
       * should keep the one somebody watched.
       */
      waste: row.wasteAmount || undefined,
      reason: row.wasteReason || undefined,
      witness: row.wasteWitness || undefined,
      ...context,
    }),
  },

  /* --- Medication inventory -------------------------------------------------- */
  /*
   * THE CART LIST, WHICH IS WHAT THIS TAB IS AGAIN.
   *
   * For a while this was a SHIFT COUNT: a row per drug carrying the drawer's
   * opening figure, what went into it, what was given, what was destroyed and
   * what was counted out at the end, with the arithmetic done on screen and
   * the difference stated rather than left to be worked out standing up.
   *
   * The sheet was right about what a controlled-drug drawer needs and wrong
   * about where it belongs. A count is only worth anything RECONCILED — against
   * lots, expiry dates, par levels and a wastage register, all of which live
   * once for the whole practice in Settings ▸ Medication inventory. Kept per
   * encounter it reconciles against nothing, because the next case opens a
   * fresh sheet and the drawer it describes is the same drawer.
   *
   * So the count comes off the encounter and goes to stock control, where the
   * figures it is counted against already are. The machinery it was built on
   * stays where it is — `count` and countCell in js/screens/encounter.js, the
   * fixture in data/medication-tracked.js — because the sheet is moving rather
   * than being deleted, and because nothing else on this screen reads either.
   *
   * What the room gets back is what the room had: the cart's formulary. What
   * the trolley carries, under all three of the names a drug goes by, and
   * whether there is any of it left.
   */
  'med-inventory': {
    title: 'Medication inventory',
    addLabel: 'Add medication',
    /* "Record" is right for a reading taken off a monitor and wrong for a drug
       being put on the cart list, which is added. */
    commit: 'Add',
    empty: 'No medications in the formulary',
    /*
     * ONE BUTTON ON THIS TOOLBAR, NOT TWO.
     *
     * A second, red "Record wastage" used to sit beside Add medication and
     * open a wastage form that filed nowhere near this table — the row went
     * onto the practice's own register in Settings ▸ Medication inventory, and
     * the cart list underneath was left saying what it said before. Two
     * buttons a thumb's width apart, one adding a drug to a catalogue and one
     * writing a controlled substance off an auditable register, is a pairing
     * the colour was doing all the work to keep apart.
     *
     * So wastage is recorded where it is reconciled: on the register itself,
     * in stock control, against the lot and expiry it belongs to. See
     * js/screens/medication-inventory.js — that form knows which lot a write-off
     * comes off, which this one never did.
     */
    /*
     * A SEARCH BOX, BECAUSE THIS IS THE ONE LOG THAT IS READ RATHER THAN
     * WRITTEN.
     *
     * Every other table on this step is a handful of rows the case produced:
     * three sets of obs, two bags, four pushes, and scanning them is nothing.
     * The formulary is a catalogue — it opens full, it grows, and what a nurse
     * comes to it for is one drug. Scrolling a stocked cart to find Versed is
     * the errand the box removes.
     *
     * It matches on all three names on purpose. A drug goes by the generic on
     * the chart, the brand on the vial and whatever this practice calls it,
     * and somebody typing the one printed on the ampoule in their hand should
     * not be told the room does not stock it.
     */
    search: {
      placeholder: 'Search medications…',
      keys: ['name', 'generic', 'brand', 'category'],
      empty: 'No medications match that search.',
    },
    /*
     * AND A DELETE, WHICH ALMOST NOTHING ELSE ON THIS SCREEN HAS.
     *
     * The rest of the run is a clinical record: a set of obs taken at 08:12
     * happened, and a record that lets somebody make it un-happen is not a
     * record. Rows there are corrected, never removed.
     *
     * A formulary is not a record of anything — it is a list of what the cart
     * carries. A drug that is discontinued, or was added under the wrong name,
     * should come off it, and leaving it there with an editable name is how a
     * cart ends up listing something nobody can find in it. It asks first, for
     * the obvious reason.
     */
    remove: {
      label: 'Remove',
      heading: 'Remove this medication from the formulary?',
      body: (row) =>
        `${row.name} comes off the cart list for this encounter. Nothing already ` +
        'given is affected — the administration log keeps its own record of what ' +
        'was drawn up.',
      commit: 'Remove medication',
    },
    /*
     * WHAT THIS TABLE IS FOR DURING A CASE.
     *
     * Naming the drug and saying whether there is any. That is all — the lot,
     * the expiry date and the par level belong to the practice's stock control
     * (screens/medication-inventory.html), which is where they are maintained
     * and where somebody actually acts on them. Charted here they were a
     * second copy going stale beside the first, and every one of them had to
     * be re-typed for a drug already described.
     *
     * A drug goes by three names and the cart uses all of them: the generic on
     * the chart, the brand on the vial, and whatever this practice calls it.
     * A nurse hunting for Versed in a list that only says Midazolam is looking
     * for something the room stocks and cannot find.
     *
     * "Concentration", not "strength". Strength was read as the dose — they
     * are different numbers and confusing them is a tenfold error.
     */
    columns: [
      { key: 'name', label: 'Medication' },
      { key: 'generic', label: 'Generic name' },
      { key: 'brand', label: 'Brand name' },
      { key: 'dose', label: 'Default dose', mono: true },
      { key: 'concentration', label: 'Concentration' },
      { key: 'route', label: 'Route' },
      { key: 'stock', label: 'On hand', align: 'right', mono: true },
      { key: 'category', label: 'Category', badge: true, align: 'right' },
    ],
    /*
     * THE DEFAULT DOSE IS TWO FIELDS AND ONE COLUMN.
     *
     * The amount and the unit are asked for separately, for the reason the
     * administration log offers its dose as a dropdown rather than a box: a
     * typed dose takes "2mg", "2 mg" and "20 mg" with equal enthusiasm and
     * only one of those is right. They are shown joined, because "25" and
     * "mcg" in two columns is one number split across a table and read as two.
     *
     * `doseAmount` and `unit` are what the form owns and `dose` is what the
     * table reads, so an edit re-opens on the amount that was typed rather
     * than on the joined string — the same reason the drawer keeps the keys it
     * did not collect (see saveLogEntry in js/screens/encounter.js).
     */
    fields: [
      { key: 'name', type: 'text', label: 'Medication name', required: true, span: 2 },
      { key: 'generic', type: 'text', label: 'Generic name', placeholder: 'e.g. Midazolam' },
      { key: 'brand', type: 'text', label: 'Brand name', placeholder: 'e.g. Versed' },
      { key: 'doseAmount', type: 'text', label: 'Default dosage', placeholder: 'e.g. 2' },
      { key: 'unit', type: 'select', label: 'Unit', options: MEDICATION_UNITS, required: true },
      { key: 'concentration', type: 'text', label: 'Concentration', placeholder: 'e.g. 10 mg/ml' },
      { key: 'route', type: 'select', label: 'Route', options: MEDICATION_ROUTES, required: true },
      { key: 'category', type: 'select', label: 'Category', options: MEDICATION_CATEGORIES, required: true },
      { key: 'stock', type: 'number', label: 'Units on hand', placeholder: '12', required: true },
      /* Asked here too, on the one log whose table has no By column to print
         it in. What is being signed for is the cart itself — a drug added to
         the formulary, or a count corrected against what is on the shelf — and
         a stock figure nobody stood behind is exactly the one that turns out
         to have been somebody's guess. The press is the gate; there is no
         column for it, and inventing one would put an attribution into a
         formulary reference that is otherwise about the drug. */
      INITIALS_FIELD,
    ],
    build: (v) => ({
      name: v.name,
      generic: v.generic || '—',
      brand: v.brand || '—',
      doseAmount: v.doseAmount ?? '',
      unit: v.unit,
      dose: String(v.doseAmount ?? '').trim() ? `${String(v.doseAmount).trim()} ${v.unit}` : '—',
      concentration: v.concentration || '—',
      route: v.route,
      category: v.category,
      stock: v.stock,
      /* Nothing left on the cart is the one state worth stopping the eye on,
         and it is the only one this table can still know: the par level it
         used to be measured against belongs to stock control now. */
      high: v.stock !== '' && Number(v.stock) === 0,
    }),
    seed: SEDATION_FORMULARY.map((d, i) => {
      const stock = [8, 14, 6, 20, 4, 4][i] ?? 10;
      const [doseAmount, unit] = d.dose.split(' ');
      return {
        name: d.name,
        generic: d.generic ?? d.name,
        brand: d.brand ?? '—',
        doseAmount,
        unit,
        dose: d.dose,
        concentration: d.strength,
        route: d.route,
        category: d.category,
        stock: String(stock),
        high: stock === 0,
      };
    }),
  },

  /* ========================================================================
     STEP 7 — POST-PROCEDURE (MD)
     ===================================================================== */

  /*
   * The specimen pots, and why the encounter does not close at discharge.
   *
   * The recall interval is set from the RESULT, not from what was seen on the
   * day — so an encounter that closed at discharge would strand the pot and the
   * patient letter behind it. Every row carries who has been told, because
   * "resulted" and "the patient knows" are different states and only the second
   * one finishes the visit.
   */
  pathology: {
    title: 'Pathology',
    /* The doctor's, not the sedation record's — everything from here down is
       taken or written by the endoscopist, so the initials button on these
       forms confirms their identity and their rows go on printing a name. The
       note used to sit on the endoscopist's order sheet, which was the first
       of the MD's logs until it became a form ('orders' in
       js/lib/encounter-docs.js); it moved down with the role rather than out
       with the table. See DEFAULT_SIGNER above. */
    signer: MD_SIGNER,
    /*
     * ADD SPECIMEN IS BACK ON THIS TABLE.
     *
     * The usual route into the register is still the procedure: a pot exists
     * because something was taken out of a patient, and the endoscopist
     * records it on the procedure report in step 4 with the site, the size and
     * the intervention that produced it. Those rows arrive here and are chased
     * — which lab, what came back, whether the patient has been told.
     *
     * But that route cannot be the ONLY one. A pot that reaches the lab
     * without ever making it onto the report, or one taken after the report
     * was signed, has nowhere else to be entered, and a register that refuses
     * the row is a register the lab's own list disagrees with. So the button
     * stays, and the site field is the thing to reconcile against the
     * findings, rather than the door being locked to make the reconciliation
     * unnecessary.
     */
    addLabel: 'Add specimen',
    empty: 'No specimens sent',
    columns: [
      { key: 'pot', label: 'Pot', align: 'right', mono: true },
      { key: 'site', label: 'Site' },
      { key: 'sent', label: 'Sent', mono: true },
      { key: 'lab', label: 'Laboratory' },
      { key: 'status', label: 'Status', badge: true },
      { key: 'result', label: 'Result' },
      { key: 'told', label: 'Patient told', mono: true },
      { key: 'by', label: 'By', align: 'right' },
    ],
    fields: [
      { key: 'pot', type: 'number', label: 'Pot number', placeholder: '1', required: true },
      { key: 'site', type: 'text', label: 'Site', placeholder: 'e.g. Sigmoid polyp', required: true },
      { key: 'sent', type: 'text', label: 'Sent', placeholder: 'e.g. 05 Aug 09:40', required: true },
      {
        key: 'lab',
        type: 'select',
        label: 'Laboratory',
        options: ['Informed Diagnostics', 'Sanford Pathology', 'In-house'],
        required: true,
      },
      {
        key: 'status',
        type: 'select',
        label: 'Status',
        options: ['In transit', 'Received', 'Resulted', 'Lost'],
        required: true,
      },
      /*
       * Patient told sits BESIDE Status rather than under Result, and the
       * full-width Result closes the form — which is where every other log on
       * this screen puts its wide free-text field, and it leaves no half-empty
       * row in a two-column grid. The pair is honest as well as tidy: chasing a
       * pot is asking the same two questions, where is it and does the patient
       * know, and the table's own Status and Patient told columns are the two
       * that get read together. Result is the sentence that comes back, and a
       * sentence gets the width of the dialog.
       */
      { key: 'told', type: 'text', label: 'Patient told', placeholder: 'e.g. 12 Aug, by phone' },
      { key: 'result', type: 'text', label: 'Result', placeholder: 'Left blank until it comes back', span: 2 },
      INITIALS_FIELD,
    ],
    build: (v) => ({
      pot: v.pot,
      site: v.site,
      sent: v.sent,
      lab: v.lab,
      status: v.status,
      result: v.result || '—',
      told: v.told || '—',
      by: v.initials || MD_BY,
      /* A lost pot, or one resulted that the patient has not been told about:
         the two states this table exists to stop anybody forgetting. */
      high: v.status === 'Lost' || (v.status === 'Resulted' && !String(v.told ?? '').trim()),
    }),
    seed: SPECIMEN_LOG.map((r) => ({ ...r, result: '—', told: '—', by: 'D. Smith, MD' })),
  },

  /*
   * The complications register.
   *
   * Empty is the normal and hoped-for state, which is exactly why it is a table
   * with an empty state rather than a free-text box: "nothing went wrong" and
   * "nobody wrote anything" look identical in a textarea.
   */
  complications: {
    title: 'Complications',
    signer: MD_SIGNER,
    addLabel: 'Record complication',
    empty: 'No complications recorded',
    /*
     * THE THREE CARDS — THE SAME THREE THE TRACKER ASKS, SCOPED TO ONE CASE.
     *
     * HOW MANY, HOW BAD, WHICH ONE. screens/complications.html asks the unit
     * those three questions over a whole list; this asks them of one encounter,
     * in the same words, so a reviewer who has read the practice's register
     * meets no new vocabulary when they open a single case.
     *
     * The tracker's middle card is a RATE, and a rate is the one figure that
     * cannot survive the trip down here: the denominator on a single encounter
     * is one, so "100%" would be true and useless. Highest severity takes that
     * slot, because on one case the question a rate is standing in for — does
     * anything else have to happen — is answered by the worst row, not by an
     * arithmetic mean of the case with itself.
     *
     * All three read the FILTERED rows, which is why they sit on the same card
     * as the filter. Narrowing to Severe and reading the count off the first
     * card is the question this register exists to answer.
     */
    stats: [
      {
        id: 'total',
        label: 'Total complications',
        tone: 'critical',
        icon: 'critical',
        value: (rows) => String(rows.length),
      },
      {
        id: 'severity',
        label: 'Highest severity',
        tone: 'warning',
        icon: 'flag',
        text: true,
        value: (rows) =>
          SEVERITY_LEVELS.slice().reverse().find((level) =>
            rows.some((r) => r.severity === level)
          ) ?? '—',
        /* Severity is optional on the form (it is optional on the tracker's
           too), so "Mild" as the highest can mean either "nothing worse
           happened" or "nobody graded the worst one". Saying how many rows are
           ungraded is the difference between those two readings. */
        meta: (rows) => {
          const ungraded = rows.filter((r) => !SEVERITY_LEVELS.includes(r.severity)).length;
          return ungraded ? `${ungraded} ungraded` : '';
        },
      },
      {
        id: 'common',
        label: 'Most common type',
        tone: 'brand',
        icon: 'vitals',
        text: true,
        value: (rows) => commonComplication(rows)?.type ?? '—',
        meta: (rows) => {
          const top = commonComplication(rows);
          return top ? `${top.count} of ${rows.length}` : '';
        },
      },
    ],
    /*
     * WHAT THE FILTER NARROWS.
     *
     * Type and severity — the two axes the form now records and the two a
     * reviewer reads this table down. Outcome went with the outcome field: a
     * filter over a column that no longer exists narrows nothing while showing
     * itself as a control, which is a filter lying about what it is doing.
     */
    filters: [
      { name: 'type', label: 'Type', key: 'type', options: COMPLICATION_TYPES },
      { name: 'severity', label: 'Severity', key: 'severity', options: SEVERITY_LEVELS },
    ],
    columns: [
      /* The DATE leads. Every other log on this screen is a within-the-case
         running sheet where the day is a given and a bare clock reading is
         unambiguous. This one is not: a complication is recorded when it is
         recognised, and the ones that matter most — delayed bleeding, a
         perforation that declared itself overnight, an admission two days later
         — are recognised after the patient has gone home. A register of those
         stamped only "14:20" cannot say which day.

         The clock reading itself is gone with the rest of the intra-case
         detail: on a register worked days after the fact, the minute something
         was noticed is a precision nobody has. */
      { key: 'date', label: 'Date of occurrence', mono: true, format: shortDate },
      { key: 'type', label: 'Type' },
      { key: 'severity', label: 'Severity', badge: true },
      /* What happened, what was done and how it ended, in the writer's own
         words — the three columns this replaces asked for the same three facts
         as three closed lists, and closed lists are where "we watched it and it
         settled" has nowhere to go. */
      { key: 'notes', label: 'Notes', clip: true },
      { key: 'by', label: 'By', align: 'right' },
    ],
    /*
     * THE FORM, WHICH IS THE TRACKER'S FORM WITHOUT ITS FIRST FIELD.
     *
     * screens/complications.html opens with a Procedure search because a
     * practice-wide register has to be told which case it is filing against.
     * Here the case IS the screen, so asking again would be asking somebody to
     * re-pick the encounter they are standing in — and to be able to get it
     * wrong. Everything below that line is the tracker's, in its order.
     */
    fields: [
      { key: 'type', type: 'select', label: 'Complication Type', options: COMPLICATION_TYPES, required: true, span: 2 },
      { key: 'severity', type: 'select', label: 'Severity', options: SEVERITY_LEVELS },
      /* Defaulted to today and still editable, because most complications are
         recognised on the day and the ones that are not are exactly the ones
         somebody has to change it for deliberately. */
      { key: 'date', type: 'date', label: 'Date of Occurrence', default: nowDate },
      {
        key: 'notes',
        type: 'textarea',
        label: 'Notes',
        placeholder: 'Describe the complication, treatment, and outcome…',
        span: 2,
      },
      INITIALS_FIELD,
    ],
    build: (v) => ({
      date: v.date,
      type: v.type,
      /* Both stored raw rather than dashed on the way in. Severity and Notes
         are optional here, and the table already prints '—' for an empty cell —
         writing the dash into the ROW would make an ungraded complication
         indistinguishable from one somebody graded "—", which is what the
         Highest severity card's "ungraded" count reads. */
      severity: v.severity,
      notes: v.notes,
      by: v.initials || MD_BY,
      /* The flagged left edge and the badge's warning tone, on the rows a
         reviewer must not be able to scroll past. Ungraded no longer flags:
         severity is optional now, and a register that shouted at every row
         somebody had not graded would be shouting at most of them. */
      high: v.severity === 'Severe',
    }),
    seed: [],
  },

  /*
   * Note — the letter that went out, and the register that it did.
   *
   * A late addition; the run used to stop at the report. It is a log rather
   * than a document because a visit sends several, on different days, and the
   * register is the record that each one went.
   *
   * THIS IS THE LETTER MODULE, FOLDED IN.
   * Staging carried a Letters screen of its own — a table of Date, Patient,
   * Type, Recipient and Subject, with View, Print, Send, Fax and Delete down
   * the right of every row, and behind View a composed letter on the practice
   * letterhead. It was a second place where correspondence about a case lived,
   * reachable from outside the encounter that produced it, and a clinician
   * finishing a colonoscopy had to go and find it.
   *
   * So the module is gone and the WORK it did is here, because a letter about
   * a procedure belongs on the run of that procedure — the step already named
   * "Note", already at the foot of Post-procedure, already the place the
   * pathology it is reporting was chased. What came across is everything the
   * screen actually collected: the recipient, the type, the subject and the
   * letter itself.
   *
   * WHAT DID NOT COME ACROSS IS SEND AND FAX AS BUTTONS.
   * On staging, recording a letter and sending it were two acts, and the row
   * sat in the table in whatever state the second of them had been left in —
   * which is how a register ends up full of letters that were written and
   * never went. Under the workflow this replaces it with, recording IS
   * sending: the note reaches the patient portal, the recipient's email and
   * the fax line on the press that files it, and where it went is a fact of
   * the row rather than four buttons waiting to be remembered. See `routes`
   * below for how the destinations are chosen, and `recorded` for what the
   * screen says when they have been used.
   *
   * WHAT IS LEFT ON THE ROW IS VIEW AND PRINT, which are the two things that
   * do not change anything: read the letter as it went, and put it on paper
   * for the file. There is no pencil — see `edit: false`. Once a letter has
   * been sent, the row is the evidence of what the recipient is holding, and
   * quietly rewriting it afterwards would make the register disagree with the
   * post. A letter that went out wrong is answered by another letter.
   *
   * TITLED "NOTE", KEYED `letters`. The key is in the run's substep list, in
   * testids and in whatever URLs a reviewer has bookmarked, and renaming a
   * heading is not a reason to churn all three — the same rule this codebase
   * already applies to the 'report' and 'pre' ids. The word on screen is the
   * one staging uses.
   */
  letters: {
    title: 'Note',
    /* Read off the case rather than fixed, because this is the one log whose
       signature leaves the building: the note goes to the referring clinician,
       the portal or the fax, over the name of whoever is running the list. A
       function, not an object, because `noteContext` is filled in by the
       screen once the encounter is known — see setNoteContext. */
    signer: () => {
      const name = noteContext.provider || MD_BY;
      return { name, stamp: name };
    },
    addLabel: 'Add note',
    commit: 'Record and send',
    empty: 'No notes sent',
    columns: [
      /* The four staging showed, less Patient. Its table spanned the whole
         practice, so it had to say whose letter each row was; this one is
         inside one patient's encounter and a column repeating their name on
         every row would be a column of one answer. */
      /* LEFT, like the three beside it. Right alignment in these tables means
         "this is a quantity, read the digits down the column" — a pot number,
         a volume, a score. A date is not one: it is read as a word, it is the
         first column, and setting it right pushed every row's date to the far
         side of a wide cell, away from the heading naming it and away from the
         Type pill it belongs beside. */
      { key: 'date', label: 'Date', narrow: true },
      /* Who it is written to, as a pill, because it is the one column read by
         shape rather than by reading — a clinician scanning the register for
         "did anything go to the referrer" is looking for the solid blue. */
      {
        key: 'kind',
        label: 'Type',
        badge: true,
        narrow: true,
        tone: (row) => NOTE_TYPE_TONES[row.kind] ?? 'neutral',
      },
      { key: 'recipient', label: 'Recipient', narrow: true },
      /* THE COLUMN THAT TAKES WHATEVER IS LEFT.
         Subjects run to the length of "Procedure and pathology report — Priya
         Raman", and this is the only column in the register whose text is
         worth the room: a date, a pill and a name are all fixed-size things
         and are marked `narrow` above so they stop hoarding it. One line with
         the whole thing on the title, because a register is read by scanning
         down it and a subject that wrapped would turn every row into two. */
      { key: 'subject', label: 'Subject', truncate: true },
    ],
    /* No pencil, and the two row actions that read rather than write. The
       sheets both dialogs draw are `letterSheet` — one letter, one rendering,
       so what is read on screen and what comes out of the printer cannot
       drift. */
    edit: false,
    view: { label: 'View', heading: 'Note details', sheet: (row) => letterSheet(row) },
    print: { label: 'Print', sheet: (row) => letterSheet(row) },
    fields: [
      /*
       * TYPE FIRST, BECAUSE EVERYTHING ELSE FOLLOWS FROM IT.
       * Staging's three: a letter to the referring clinician, a letter to the
       * patient, and a recall. Answering it fills in the recipient, the
       * subject and the whole body — see `prefill` — so the form is one pick
       * away from a letter that only needs reading over.
       */
      {
        key: 'kind',
        type: 'select',
        label: 'Type',
        options: NOTE_TYPES,
        required: true,
      },
      /*
       * TYPED, OVER THE TWO IT IS ALMOST ALWAYS ONE OF.
       * The referring clinician and the patient account for nearly every
       * letter a procedure generates, and occasionally it is neither — a
       * second opinion, a nursing home, the patient's daughter. A <select> can
       * only say the first half; a bare box only the second. Same control the
       * medication field uses, for the same reason.
       */
      {
        key: 'recipient',
        type: 'suggest',
        label: 'Recipient',
        placeholder: 'Who the note is addressed to',
        required: true,
      },
      { key: 'subject', type: 'text', label: 'Subject', placeholder: 'What the note is about', required: true, span: 2 },
      /*
       * THE LETTER, ON THE LETTERHEAD, ALREADY WRITTEN.
       *
       * Staging composed the body from the case — the practice's address, the
       * date, the salutation, the patient and MRN, the procedure and its
       * indication, the specimens and what came back — and dropped the
       * clinician into a finished draft. That is the half of the module worth
       * keeping: nobody types a letterhead, and a letter assembled by hand
       * from a chart is a letter with a wrong MRN in it eventually.
       *
       * So `prefill` writes it and this field holds it, EDITABLE. It is a
       * draft, not a rendering: the sentence that matters is usually one the
       * composer could not know, and a read-only preview would send every
       * clinician to a Word document to write the letter they actually meant.
       *
       * SIXTEEN ROWS. The composed body runs to about twenty lines, and a box
       * showing five of them is a box that has to be scrolled before it can be
       * read over — which is how a draft gets sent with the pathology
       * paragraph still saying what the template guessed.
       */
      {
        key: 'body',
        type: 'textarea',
        label: 'Content',
        rows: 16,
        mono: true,
        required: true,
        span: 2,
        placeholder: 'Choose a type and the letter is drafted here.',
      },
      /* Under the letter rather than over it, because the press is the last
         thing done here: recording this note SENDS it — see `recorded` below —
         and confirming an identity before the body has been read over is
         confirming a draft nobody has read. */
      INITIALS_FIELD,
    ],
    /*
     * ANSWERING TYPE DRAFTS THE WHOLE LETTER; CHANGING THE RECIPIENT REDRAFTS
     * THE SALUTATION.
     *
     * Both go through the one composer, from the values on the form as they
     * stand — see composeNote — so "Dear Dr Aberle" cannot be left at the top
     * of a letter whose recipient box now says somebody else.
     *
     * A BODY THE CLINICIAN HAS TOUCHED IS LEFT ALONE. Redrafting over typing
     * is the one thing a helpful pre-fill must not do, and the form's own rule
     * that a pre-fill fires only when an answer CHANGES is not enough on its
     * own here: changing the recipient after writing three paragraphs would
     * still have thrown them away. `values.body` is compared against what the
     * composer last produced, and anything else is somebody's own words.
     */
    prefill: (key, value, values = {}) => {
      if (key !== 'kind' && key !== 'recipient') return null;

      const next = { ...values, [key]: value };
      const composed = composeNote(next);

      /* Picking the type fills the recipient and the subject in as well —
         they are implied by it, and a letter to the referrer is going to the
         referrer. Changing the recipient by hand afterwards leaves both
         where they are and only re-heads the letter. */
      if (key === 'recipient') {
        return isComposedBody(values.body) ? { body: composed.body } : null;
      }

      return isComposedBody(values.body)
        ? composed
        : { recipient: composed.recipient, subject: composed.subject };
    },
    optionsFor: (key) => (key === 'recipient' ? recipientOptions() : null),
    /* The other half of `recorded`, said before the press rather than after.
       Filing this note posts it, and which of the three destinations it uses
       is decided by the Type three fields up — so the form says so under the
       fields that decide it, and the toast afterwards confirms the same list.
       Told once is a surprise; told twice is a system somebody can trust. */
    liveNote: (v) =>
      NOTE_ROUTES[v.kind]
        ? `Recording this sends it to ${listSentence(NOTE_ROUTES[v.kind])}.`
        : '',
    build: (v) => ({
      /* Stamped rather than asked for. Staging's table led with a Date column
         and its form had no date field either: the date a letter went is the
         day it was sent, and a box for it is a box to get wrong. */
      date: noteDateLabel(),
      kind: v.kind,
      recipient: v.recipient,
      subject: v.subject,
      body: v.body,
      by: v.initials || noteContext.provider || MD_BY,
      /* WHERE IT WENT, DECIDED BY WHO IT WENT TO.
         A letter to the referring clinician has no business appearing in the
         patient's portal, and faxing a recall to a patient is faxing it to a
         machine they do not have. So the destinations are read off the type
         rather than ticked on the form — three checkboxes here would be three
         chances to send a clinician's letter to the wrong place. */
      routes: NOTE_ROUTES[v.kind] ?? [],
    }),
    /* What the screen says once the row has landed, in place of the flat
       "entry recorded" every other log gets. Recording this one SENDS it, and
       a press that quietly posts a letter to three destinations has to say so
       — otherwise the only evidence is a row that looks exactly like a row
       that has not gone anywhere. */
    recorded: (row) =>
      row.routes.length
        ? `Note recorded and sent — ${listSentence(row.routes)}.`
        : 'Note recorded.',
    seed: [],
  },
};
