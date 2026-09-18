/**
 * INVENTORY ▸ DAILY COUNT SHEET.
 *
 * One drawer, one day, one signed reconciliation. The row is a form rather
 * than a record: the figure in the drawer when the day started, what went into
 * it, what was given and by whom, what was destroyed and who watched, what is
 * in there now — and the difference between the arithmetic and the count.
 *
 * WHAT THIS REPLACED, AND WHY.
 *
 * This tab was Daily Usage: one row per administration, read across a date
 * range, drawn from the sedation records the day produced. It answered "what
 * came off the trolley" and it answered it well, but it is a REPORT — it tells
 * you what the system thinks happened. A controlled drawer is not audited by
 * asking the system what it thinks; it is audited by opening the drawer,
 * counting what is in it, and finding out where the two disagree. That is the
 * one thing a report cannot do, and it is the document a practice is actually
 * inspected on.
 *
 * So the day view is a count sheet now, and every figure on it is typed by the
 * person standing at the drawer. Nothing is pre-filled from the day's records
 * on purpose: a count that opens holding the answer is a count nobody makes.
 * The one exception is the start, which carries yesterday's close, because
 * that figure was counted — by the shift that handed the drawer over. See the
 * note over priorEndFor in js/lib/count-sheet-store.js.
 *
 * THE DATE IS NOT A FILTER. It is which sheet is on the desk: change it and
 * every row is fetched for that day, carry-forwards and all.
 *
 * The arithmetic itself is not here. expectedEnd and discrepancy live beside
 * the fixture in data/medication-tracked.js, because they are the definition
 * of the document rather than a detail of drawing it — two copies of that sum
 * would be two answers to the question the sheet exists to ask.
 */
import {
  TRACKED_UNITS,
  TRACKED_CATEGORIES,
  expectedEnd,
  discrepancy,
} from '../../data/medication-tracked.js';
/*
 * WHO CAN BE NAMED AGAINST A DOSE OR A WASTAGE.
 *
 * The practice's own people, from the same list the stock dialogs offer for
 * who booked a delivery in — one roster rather than two that drift, since it
 * is the same staff either way.
 *
 * These two fields were typed. Picking them is a real trade: a typed box can
 * name an agency nurse or a locum who is not on any list, and a dropdown
 * cannot. What a dropdown buys is worth more on THIS document — "K. Brandt",
 * "K Brandt RN" and "Brandt" typed on three lines are three people as far as
 * any later reading of the sheet is concerned, and a controlled-drug record
 * whose names do not join up is a record that cannot be followed up.
 */
import { STOCK_HANDLERS } from '../../data/medication-inventory.js';
import {
  sheetFor,
  saveLine,
  sheetStatus,
  addTracked,
  updateTracked,
  removeTracked,
  countedDates,
} from '../lib/count-sheet-store.js';
import { iconMarkup } from '../lib/icons.js';

const el = (id) => document.getElementById(id);
const field = (testid) => document.querySelector(`[data-testid="${testid}"]`);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "Tuesday, August 25, 2026" — the sheet's own title.
 *
 * The weekday is not decoration. A count sheet is filed against a LIST, and
 * whether the drawer should have moved at all on the day being counted is the
 * first thing the reader wants to know: an empty Saturday is a quiet weekend,
 * an empty Tuesday is a sheet nobody filled in.
 *
 * Built from the parts rather than parsed, because `new Date('2026-08-25')` is
 * read as UTC midnight and prints as the 24th anywhere west of Greenwich —
 * which on a dated legal document is not a formatting quibble.
 */
function sheetTitle(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

/* ===================== State =====================

   ONE DRAFT PER DATE, HELD IN MEMORY.

   Every keystroke is written to the row rather than left inside the control,
   for the reason the encounter's sheet gave: a repaint rebuilds each
   <ui-input> in the table, so a figure that lived only in the box would be
   wiped by adding a drug or coming back to the tab. The table is a view of the
   count, not the place it is kept.

   Drafts are kept per date so flipping to yesterday to check a figure and back
   does not throw away half a typed sheet. Only Save commits a line to the
   store — an unfiled sheet is a sheet nobody has signed. */
const drafts = new Map();

const state = {
  date: '',
  /* Which medication the dialog is editing, or null while it is adding. */
  editing: null,
  /* Which medication the remove confirm is standing over. */
  removing: null,
};

let notify = () => {};

/** The rows on screen, fetched for the open date the first time it is asked
 *  for and held as a draft afterwards. */
function rows() {
  if (!drafts.has(state.date)) drafts.set(state.date, sheetFor(state.date));
  return drafts.get(state.date);
}

/* ===================== Cells ===================== */

/**
 * One field in a row.
 *
 * Every one carries a hidden label naming BOTH the figure and the drug it
 * belongs to. On a grid of identical boxes "Given" alone tells a screen-reader
 * user which column they are in and nothing about which of eight rows — and
 * this is a table where putting a number on the wrong line is the whole
 * failure mode.
 */
function countField(row, key, label, { type = 'number', placeholder = '' } = {}) {
  return `<ui-input class="med__count-field" size="sm" type="${type}"
    label="${esc(label)} for ${esc(row.name)}" label-hidden
    ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}
    value="${esc(row[key] ?? '')}"
    data-count-row="${esc(row.id)}" data-count-field="${key}"
    data-testid="cnt--${key}"></ui-input>`;
}

/**
 * Who a figure is accounted for by, off the practice's roster.
 *
 * Same size and same shell as the count beside it, so the pair reads as one
 * answer on one line rather than as a box and a differently-shaped box. The
 * placeholder is the question — "given by", "witness" — and it stays out of
 * the list that opens, because it is not one of the answers.
 */
function personField(row, key, label, placeholder) {
  /*
   * THE CHOICE IS DECLARED WITH `value`, NOT WITH `selected` ON AN OPTION.
   *
   * <ui-select> reads its <option> children once and then draws the list
   * itself, marking selected whichever option matches its `value` attribute —
   * and writing `selected` into an option by hand loses to that every time.
   * It cost a repaint: a witness picked, a line filed, and the field came back
   * showing "witness" again while the row underneath still held the name. The
   * sheet said nobody watched and the record said somebody did, which on this
   * document is the disagreement that matters most.
   *
   * The names are <option> children rather than the comma-separated `options`
   * attribute for a duller reason: "K. Brandt, RN" has a comma in it, and that
   * attribute would split her into two people.
   */
  return `<ui-select class="med__count-field med__count-person" size="sm"
    label="${esc(label)} for ${esc(row.name)}" label-hidden
    placeholder="${esc(placeholder)}" value="${esc(row[key] ?? '')}"
    data-count-row="${esc(row.id)}" data-count-field="${key}"
    data-testid="cnt--${key}">
    ${STOCK_HANDLERS.map(
      (person) => `<option value="${esc(person)}">${esc(person)}</option>`
    ).join('')}
  </ui-select>`;
}

/** The figure, and beside it the person it is accounted for by. One cell,
 *  because they are one answer: a witness in a column of its own would float
 *  free of the number it belongs to. */
function countPair(row, key, label, withKey, withLabel, placeholder) {
  return `<div class="med__count-stack">
    ${countField(row, key, label)}
    ${personField(row, withKey, withLabel, placeholder)}
  </div>`;
}

/**
 * A sum, as it reads right now.
 *
 * The em dash is the important half: a discrepancy of zero against a drawer
 * nobody has counted would report the untouched line as reconciled, which is
 * the one lie a controlled-drug sheet must not tell.
 */
function sumInner(row, which) {
  if (which !== 'difference') return String(expectedEnd(row));

  const diff = discrepancy(row);
  if (diff === null) return '<span class="med__count-none">—</span>';
  /* Signed, because +1 in the drawer and −1 out of it are different problems,
     and only one of them is a drug that has gone missing. */
  const sign = diff > 0 ? '+' : '';
  return `<span class="med__count-diff med__count-diff--${
    diff === 0 ? 'level' : 'off'
  }">${sign}${diff}</span>`;
}

/** Wrapped in a span carrying the row and the sum it is, so a keystroke can
 *  redraw this one cell rather than the table it sits in — repainting would
 *  replace the box being typed into and take the caret with it. */
const sumCell = (row, which) =>
  `<span class="med__count-sum" data-count-cell="${which}" data-count-row="${esc(row.id)}"
    data-testid="cnt--${which}">${sumInner(row, which)}</span>`;

/** The drug, what the vial says, what yesterday left — and the two buttons
 *  that act on the LINE rather than on the count typed into it. */
function identityCell(row) {
  return `<div class="med__count-name" data-count-name="${esc(row.id)}">${identityInner(row)}</div>`;
}

/** The inside of that cell, split out so a keystroke in Start count can redraw
 *  it without redrawing the row around it. */
function identityInner(row) {
  const facts = [row.strength, row.unit].filter(Boolean).join(' · ');
  return `<div class="med__count-name-text">
      <span class="med__count-drug">${esc(row.name)}</span>
      ${facts ? `<small class="med__count-facts">${esc(facts)}</small>` : ''}
      ${
        /*
         * ONLY WHEN IT DISAGREES WITH THE BOX BESIDE IT.
         *
         * Two conditions, and the second is the interesting one. A line that
         * has never been counted here has nothing to carry forward, and
         * "Prior end: 0" would be a figure nobody wrote.
         *
         * And a line whose start count is still exactly what it was handed is
         * saying the same number twice, three inches apart — on a full sheet
         * that is a third row of text under every drug, stating what the Start
         * count box already states. The note earns its place at the moment
         * somebody counts the drawer and finds something OTHER than what the
         * last shift left: then it is the figure they are disagreeing with,
         * and it has to be legible without opening yesterday's sheet.
         */
        row.priorEnd == null || String(row.priorEnd) === String(row.start)
          ? ''
          : `<small class="med__count-prior">Prior end: ${esc(row.priorEnd)}</small>`
      }
    </div>
    <div class="med__count-actions">
      <button type="button" class="med__count-edit" data-edit-row="${esc(row.id)}"
        aria-label="Edit ${esc(row.name)}" data-testid="cnt--edit">
        ${iconMarkup('pencil')}
      </button>
      <button type="button" class="med__count-remove" data-remove-row="${esc(row.id)}"
        aria-label="Remove ${esc(row.name)} from the count sheet" data-testid="cnt--remove">
        ${iconMarkup('trash')}
      </button>
    </div>`;
}

/*
 * THE COLUMNS, IN THE ORDER THE COUNT IS MADE IN.
 *
 * Left to right is the arithmetic itself — what was there, what went in, what
 * went out twice over, what that comes to, what is actually there, and the gap.
 * Reading the row IS checking the sum, which is why nothing is reordered to
 * suit the widths.
 */
const COLUMNS = [
  { key: 'name', label: 'Medication', wrap: true, render: identityCell },
  { key: 'start', label: 'Start count', render: (row) => countField(row, 'start', 'Start count') },
  { key: 'added', label: 'Added', render: (row) => countField(row, 'added', 'Added') },
  {
    key: 'given',
    label: 'Given',
    render: (row) => countPair(row, 'given', 'Given', 'givenBy', 'Given by', 'given by'),
  },
  {
    key: 'wasted',
    label: 'Wasted',
    render: (row) => countPair(row, 'wasted', 'Wasted', 'witness', 'Witness', 'witness'),
  },
  { key: 'expected', label: 'Expected end', render: (row) => sumCell(row, 'expected') },
  { key: 'end', label: 'End count', render: (row) => countField(row, 'end', 'End count') },
  { key: 'difference', label: 'Discrepancy', render: (row) => sumCell(row, 'difference') },
  {
    key: 'save',
    label: 'Actions',
    actions: true,
    render: (row) =>
      `<ui-button variant="secondary" size="sm" data-save-row="${esc(row.id)}"
        data-testid="cnt--save">Save</ui-button>`,
  },
];

/* ===================== Painting ===================== */

/**
 * Redraw the two sums on one line, in place — and the carried-forward note
 * beside them, which appears and disappears with the start count.
 *
 * In place rather than by repainting: rebuilding the table would replace the
 * box being typed into and take the caret with it. The name cell holds no
 * control, so it is safe to rewrite mid-keystroke; the two sums and it are the
 * only things on a line that are not typed.
 */
function refreshSums(row) {
  const table = el('countTable');
  const id = CSS.escape(row.id);

  table.querySelectorAll(`[data-count-row="${id}"][data-count-cell]`).forEach((cell) => {
    cell.innerHTML = sumInner(row, cell.dataset.countCell);
  });

  const name = table.querySelector(`[data-count-name="${id}"]`);
  if (name) name.innerHTML = identityInner(row);
}

/**
 * How the day stands, said beside the date.
 *
 * A sheet is worked by exception: the number that matters is how many filed
 * lines do NOT reconcile, and it is said in words rather than left to be
 * counted down a column of small figures. A day with nothing filed says so
 * too — an empty sheet and a reconciled one look identical from a distance,
 * and only one of them is finished.
 *
 * SPOKEN, NOT SHOWN. It is the sheet's live region and nothing else — see the
 * note over #countSheetLine in screens/medication-inventory.html. A sighted
 * reader gets every one of these states from the sheet itself: the tint on a
 * line that does not add up, and the signed figure in its Discrepancy cell.
 * Somebody working the table by ear gets neither, and this is what tells them.
 *
 * Which is why it is a full sentence again. It had been clipped to a clause to
 * share a line with the date; nothing is competing with it now, and a sentence
 * is what a screen reader should be handed.
 */
function paintStatus(list) {
  const { total, filed, off } = sheetStatus(list);
  const note = el('countStatus');

  if (!filed) {
    note.textContent = `Nothing counted yet, ${total} line${total === 1 ? '' : 's'} to work through.`;
    return;
  }

  if (off) {
    note.textContent =
      `${off} of ${filed} counted line${filed === 1 ? '' : 's'} ` +
      `${off === 1 ? 'does' : 'do'} not reconcile.`;
    return;
  }

  note.textContent = `${filed} of ${total} counted, and every one agrees.`;
}

export function paintCount() {
  const list = rows();

  el('countDateLabel').textContent = sheetTitle(state.date);
  paintStatus(list);

  const table = el('countTable');
  table.columns = COLUMNS;
  /* A filed line that does not reconcile is the one row on the sheet worth
     stopping the eye on, and it stays flagged until it does. */
  table.rowClass = (row) =>
    row.filed && discrepancy(row) !== null && discrepancy(row) !== 0
      ? 'med__count-row--off'
      : '';
  table.rows = list;
  table.setAttribute('state', list.length ? 'ready' : 'empty');
}

/* ===================== Filing a line ===================== */

/**
 * What has to be answered before a line can be filed.
 *
 * Nothing is blocked with an inline error: the field is focused and the
 * message said once, because an error rendered inside a cell grows the row and
 * shifts the eight fields beside it while somebody is typing in one of them.
 *
 * The two witness rules are the reason this document exists. A controlled drug
 * given with nobody named against it, or destroyed with nobody watching, is
 * precisely the entry that hides an ampoule that never reached a patient.
 */
function checkLine(row) {
  if (row.start === '') {
    return { field: 'start', message: `Count what was in the drawer before you file ${row.name}.` };
  }
  if (['start', 'added', 'given', 'wasted', 'end'].some((key) => Number(row[key]) < 0)) {
    return { field: 'start', message: 'A count cannot be negative.' };
  }
  if (Number(row.given) > 0 && !row.givenBy.trim()) {
    return { field: 'givenBy', message: `Name who gave the ${row.name}.` };
  }
  if (Number(row.wasted) > 0 && !row.witness.trim()) {
    return { field: 'witness', message: `Wastage needs a witness — name who watched the ${row.name} go.` };
  }
  if (row.end === '') {
    return { field: 'end', message: `Count what is in the drawer now to close ${row.name}.` };
  }
  return null;
}

function fileLine(id) {
  const row = rows().find((r) => r.id === id);
  if (!row) return;

  const problem = checkLine(row);
  if (problem) {
    /* input OR select: the counts are boxes and the two names are dropdowns,
       and the field that owes an answer is the one that should take focus
       whichever of the two it happens to be. */
    el('countTable')
      .querySelector(`[data-count-row="${CSS.escape(id)}"][data-count-field="${problem.field}"]`)
      ?.querySelector('input, select')
      ?.focus();
    notify(problem.message, 'warning');
    return;
  }

  saveLine(state.date, id, row);
  row.filed = true;

  /* Every OTHER day's draft is thrown away, because a filed count changes what
     the days after it are handed. A draft built against the old carry-forward
     would be a start count that quietly disagrees with the sheet it came
     from — which is the one error this screen exists to catch. */
  [...drafts.keys()].forEach((date) => date !== state.date && drafts.delete(date));

  const diff = discrepancy(row);
  if (diff === 0) notify(`${row.name} counted and reconciled.`);
  else {
    notify(
      `${row.name} filed ${Math.abs(diff)} ${diff > 0 ? 'over' : 'under'} the expected count.`,
      'warning'
    );
  }

  paintCount();
}

/* ===================== The medication dialog ===================== */

function openMedicationDialog(id, trigger) {
  const row = id ? rows().find((r) => r.id === id) : null;
  state.editing = row ?? null;

  field('cnt--m-name')?.removeAttribute('error');
  el('countMedName').setAttribute('value', row?.name ?? '');
  el('countMedStrength').setAttribute('value', row?.strength ?? '');
  el('countMedUnit').setAttribute('value', row?.unit ?? '');
  el('countMedCategory').setAttribute('value', row?.category ?? '');

  const modal = el('countMedModal');
  modal.setAttribute('heading', row ? 'Edit medication' : 'Add medication to the sheet');
  const label = el('countMedSave').querySelector('.ui-btn__label');
  if (label) label.textContent = row ? 'Save' : 'Add';

  modal.open(trigger);
}

function commitMedication() {
  const name = el('countMedName').value.trim();
  const strength = el('countMedStrength').value.trim();
  const unit = el('countMedUnit').value;
  const category = el('countMedCategory').value || 'other';

  if (!name) {
    field('cnt--m-name').setAttribute('error', 'Give the medication a name');
    notify('Check the fields marked above.', 'warning');
    return;
  }
  if (!unit) {
    field('cnt--m-unit').setAttribute('error', 'Choose a unit');
    notify('Check the fields marked above.', 'warning');
    return;
  }
  field('cnt--m-name').removeAttribute('error');
  field('cnt--m-unit').removeAttribute('error');

  /*
   * A NAME ON ITS OWN IS NOT WHAT MAKES A LINE. The strength is.
   *
   * Two vials of Versed are two lines by design — see the note in
   * data/medication-tracked.js — so the clash that matters is the same drug at
   * the same strength, which would be one drawer counted twice and a
   * discrepancy split across two rows that each look fine.
   */
  const clash = rows().some(
    (row) =>
      row.id !== state.editing?.id &&
      row.name.toLowerCase() === name.toLowerCase() &&
      row.strength.toLowerCase() === strength.toLowerCase()
  );
  if (clash) {
    field('cnt--m-name').setAttribute('error', 'That medication and strength is already counted');
    notify('Check the fields marked above.', 'warning');
    return;
  }

  if (state.editing) {
    updateTracked(state.editing.id, { name, strength, unit, category });
    /* The draft holds the row being renamed, so it is corrected in place
       rather than rebuilt — a repaint from the store would throw away every
       figure typed into the sheet so far. */
    Object.assign(state.editing, { name, strength, unit, category });
    notify(`${name} updated.`);
  } else {
    /* The typed sheet is taken FIRST and put back over the refetched one. The
       store knows the new line and its order; only the draft knows the figures
       somebody has been entering all morning, and rebuilding from the store
       alone would wipe them to add a row. */
    const typed = rows();
    const created = addTracked({ name, strength, unit, category });
    drafts.set(
      state.date,
      sheetFor(state.date).map((row) => typed.find((d) => d.id === row.id) ?? row)
    );
    notify(`${created.name} added to the count sheet.`);
  }

  el('countMedModal').close();
  state.editing = null;
  paintCount();
}

/* ===================== Taking a line off ===================== */

function openRemove(id, trigger) {
  const row = rows().find((r) => r.id === id);
  if (!row) return;

  const counted = countedDates(row.id);
  const modal = el('countRemoveModal');

  if (counted.length) {
    /*
     * Refused rather than asked, and the same rule the lot list keeps for a box
     * with a waste log: a filed count is a signed reconciliation of a
     * controlled drawer, and removing the line it was filed against would
     * delete the record with nothing left saying it existed. A drug that is no
     * longer stocked stops being counted by being counted to zero.
     */
    notify(
      `${row.name} has been counted on ${counted.length} day${counted.length === 1 ? '' : 's'} ` +
        'and cannot be taken off the sheet. Count it to zero instead.',
      'warning'
    );
    return;
  }

  state.removing = row;
  el('countRemoveLead').textContent =
    `${row.name}${row.strength ? ` ${row.strength}` : ''} comes off the count sheet. ` +
    'Nothing has been filed against it, so there is no record to lose.';
  modal.open(trigger);
}

function commitRemove() {
  const row = state.removing;
  if (!row) return;

  if (removeTracked(row.id)) {
    const draft = rows().filter((r) => r.id !== row.id);
    drafts.set(state.date, draft);
    notify(`${row.name} removed from the count sheet.`);
  }

  el('countRemoveModal').close();
  state.removing = null;
  paintCount();
}

/* ===================== Print and export ===================== */

/**
 * Hand the sheet to the browser's print path.
 *
 * A counted drawer is signed on paper — two names against a document, which is
 * what makes it a controlled-drug record rather than a spreadsheet. The
 * prototype has no build step and no PDF library, so what it has to work with
 * is the print dialog and a stylesheet that makes the page worth sending to
 * it: see @media print in css/screen-medication.css, where the shell, the tabs
 * and the row buttons go and the count is left on the paper.
 *
 * The message goes out BEFORE the dialog, because window.print() blocks the
 * page for as long as that dialog is up and a toast fired afterwards would
 * arrive as a report on something already done.
 */
function printSheet() {
  notify('Printing the count sheet for signature.', 'info');
  window.print();
}

/** The sheet as it stands, in the columns it is read in. Filed and unfiled
 *  lines both go, because a sheet exported half-worked is a sheet somebody is
 *  taking to the drawer to finish. */
function exportSheet() {
  const header = [
    'Date', 'Medication', 'Strength', 'Unit', 'Prior end', 'Start count', 'Added',
    'Given', 'Given by', 'Wasted', 'Witness', 'Expected end', 'End count',
    'Discrepancy', 'Status',
  ];

  const lines = rows().map((row) => {
    const diff = discrepancy(row);
    return [
      state.date, row.name, row.strength, row.unit, row.priorEnd ?? '',
      row.start, row.added, row.given, row.givenBy, row.wasted, row.witness,
      expectedEnd(row), row.end, diff === null ? '' : diff,
      row.filed ? (diff === 0 ? 'Counted' : 'Counted — does not reconcile') : 'Not counted',
    ];
  });

  const csv = [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `medication-count-${state.date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  notify(`Exported the count sheet for ${sheetTitle(state.date)}.`);
}

/* ===================== Wiring ===================== */

/**
 * @param {object} options
 * @param {string} options.date   the day the sheet opens on
 * @param {function} options.flash  how this screen reports
 */
export function initCountSheet({ date, flash }) {
  notify = flash;
  state.date = date;

  el('countMedUnit').optionList = TRACKED_UNITS.map((unit) => ({ value: unit, label: unit }));
  el('countMedCategory').optionList = TRACKED_CATEGORIES.map((value) => ({
    value,
    /* Stored lower case, because it is a tag rather than a title; shown with a
       capital, because it is the start of a line in a dropdown. */
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));

  const dateField = el('countDate');
  dateField.setAttribute('value', state.date);

  dateField.addEventListener('ui-change', () => {
    const next = dateField.value;
    /* An emptied date field is not a request for a sheet with no day on it.
       The control snaps back to the day it was showing, which is feedback
       rather than a silent refusal. */
    if (!next) {
      dateField.setAttribute('value', state.date);
      const control = dateField.querySelector('input');
      if (control) control.value = state.date;
      return;
    }
    state.date = next;
    paintCount();
  });

  const table = el('countTable');

  /*
   * Every answer is written back to the row, and only the two sums on that
   * line are redrawn — repainting the table would replace the box being typed
   * into and take the caret with it.
   *
   * TWO EVENTS, ONE HANDLER. The counts are <ui-input> and report every
   * keystroke as `ui-input`; the two name fields are <ui-select> and report a
   * choice as `ui-change`. Listening for only the first is how a witness
   * picked from the list is not on the row when Save reads it — the field
   * shows a name and the sheet refuses to file, which is the worst kind of
   * bug to be looking at with a drawer open.
   */
  const writeBack = (event) => {
    const box = event.target.closest('[data-count-row][data-count-field]');
    if (!box) return;
    const row = rows().find((r) => r.id === box.dataset.countRow);
    if (!row) return;
    row[box.dataset.countField] = event.detail.value;
    refreshSums(row);
  };

  table.addEventListener('ui-input', writeBack);
  table.addEventListener('ui-change', writeBack);

  table.addEventListener('ui-click', (event) => {
    const save = event.target.closest('[data-save-row]');
    if (save) fileLine(save.dataset.saveRow);
  });

  table.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-row]');
    if (edit) {
      openMedicationDialog(edit.dataset.editRow, edit);
      return;
    }
    const remove = event.target.closest('[data-remove-row]');
    if (remove) openRemove(remove.dataset.removeRow, remove);
  });

  el('countAdd').addEventListener('ui-click', (event) =>
    openMedicationDialog('', event.target)
  );
  el('countPrint').addEventListener('ui-click', printSheet);
  el('countExport').addEventListener('ui-click', exportSheet);

  el('countMedSave').addEventListener('ui-click', commitMedication);
  el('countMedCancel').addEventListener('ui-click', () => {
    state.editing = null;
    el('countMedModal').close();
  });

  el('countRemoveConfirm').addEventListener('ui-click', commitRemove);
  el('countRemoveCancel').addEventListener('ui-click', () => {
    state.removing = null;
    el('countRemoveModal').close();
  });

  paintCount();
}
