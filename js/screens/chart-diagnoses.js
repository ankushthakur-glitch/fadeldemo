/**
 * DIAGNOSES — the maintained problem list, and the window that writes to it.
 *
 * A table of what this patient is carrying, and three things you can do with
 * it: read it, add to it, and correct a row that is already there. That is
 * the whole section.
 *
 * WHY A CENTRED WINDOW AND NOT A DRAWER
 * Allergies next door opens a drawer, because it asks for seven fields and
 * two of them depend on a third. This asks for five, none of them dependent,
 * and the reference screen puts them in a small window over the list. A
 * dialog the width of the screen for five short fields would leave two thirds
 * of it empty and push the list it is editing off the side for no gain.
 *
 * THE PENCIL REALLY EDITS
 * Every other list in this chart treats the row pencil as a stub. Here it is
 * the point: a problem list is corrected far more often than it is added to —
 * a diagnosis is closed off, a type is changed from acute to chronic once it
 * has stopped resolving — so the same window opens on the row, filled in, and
 * saves back over it. Add and Edit are one form because they are one shape;
 * only the heading, the button and where the answers land differ.
 *
 * THE RESOLVE DATE ONLY EXISTS WHEN THERE IS SOMETHING TO RESOLVE
 * A date field asking when an Active condition ended is a question with no
 * true answer, and one that gets filled in anyway. So the field appears when
 * Historical is chosen and is dropped — along with whatever was in it — when
 * the row goes back to Active. The column stays in the table either way; a
 * column that appears and disappears with the contents of the list is harder
 * to read than one that is sometimes empty.
 */
import { registerModule } from './chart-workspace.js';
import {
  CHART_DIAGNOSES,
  EMPTY_CHART_DIAGNOSES,
  DIAGNOSIS_STATUSES,
  DIAGNOSIS_TYPES,
  DIAGNOSIS_STATUS_TONE,
} from '../../data/chart-diagnoses.js';
import { icd10Label } from '../../data/icd10.js';

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/** How a stored code reads in the table. Unknown codes still show as the code. */
const diagnosisText = (code) => icd10Label(code) || code;

/** Today as the fixtures write dates — dd-mm-yyyy. */
function today() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** A native date input's yyyy-mm-dd → the dd-mm-yyyy a row stores. */
function fromDateInput(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

/** dd-mm-yyyy back into what a native date input will accept. */
function toDateInput(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

/* ============================================================================
   THE TABLE
   ========================================================================= */

const COLUMNS = [
  { key: 'no', label: 'No.' },
  /* THE TWO LONG COLUMNS ARE CAPPED RATHER THAN TRUNCATED.
     Nine columns is more than fits, and seven of them are short. The table's
     own `truncate` is max-width: 0, which does not mean "take a share" — it
     means "take nothing you are not forced to", so whichever of these two
     wore it collapsed to about fifty pixels while the other took five
     hundred. Capping the CONTENT instead lets each ask for a width it can
     actually use and leaves the rest to its neighbour: the diagnosis wraps
     onto a second line past its cap, the note ellipses at its own and keeps
     the full text in a title. Below about 1200px the row is genuinely wider
     than the panel and the table scrolls, which is what it is built to do. */
  {
    key: 'diagnosis',
    label: 'Diagnoses',
    /* No `wrap: true`. It would be the right flag and it does nothing:
       `.ui-table tbody td` sets white-space: nowrap and outweighs
       `.ui-table__cell--wrap` on specificity, so the opt-in has never taken
       effect anywhere in the app. Fixing that belongs in
       css/components/data-table.css and would change the row height of every
       table that asks for it, so this column wraps itself instead — see
       .dx__name in css/screen-chart.css. */
    render: (row) => `<span class="dx__name">${esc(row.diagnosis)}</span>`,
  },
  { key: 'type', label: 'Type' },
  { key: 'onsetDate', label: 'Onset Date' },
  { key: 'recordedDate', label: 'Recorded Date' },
  { key: 'resolveDate', label: 'Resolve Date' },
  {
    /* Status is the column the rest of the row is read in the light of — an
       onset date means something different on a condition that ended — so it
       is a pill rather than one more word in a row of words, the same way
       every other status column in this chart is drawn. */
    key: 'status',
    label: 'Status',
    render: (row) =>
      `<ui-badge status="${DIAGNOSIS_STATUS_TONE[row.status] || 'neutral'}" size="sm"
        >${esc(row.status)}</ui-badge
      >`,
  },
  {
    key: 'note',
    label: 'Note',
    render: (row) =>
      `<span class="dx__note" title="${esc(row.note)}">${esc(row.note)}</span>`,
  },
  {
    key: 'edit',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) =>
      `<button type="button" class="dx__row-edit" data-dx-edit="${esc(row.id)}"
        aria-label="Edit ${esc(row.diagnosis)}">${icon('pencil')}</button>`,
  },
];

/* ============================================================================
   THE WINDOW

   Status and Type are two-way switches, and a two-way switch reads better as
   a pair of segments than as two radio dots — there is no third answer coming
   and the chosen one should be visible without reading. They are still real
   radios underneath (see .dx__seg in css/screen-chart.css): the inputs are
   moved off-screen rather than hidden, because a display:none input is not
   focusable and the arrow keys that move between them are the reason these
   are radios at all.
   ========================================================================= */

let segUid = 0;

function segmented(name, legend, options, testid) {
  const group = `dx-seg-${++segUid}`;
  return `<fieldset class="dx__seg-field" data-dx-seg="${esc(name)}" data-testid="${esc(testid)}">
    <legend class="ui-field__label">${esc(legend)}</legend>
    <div class="dx__seg">
      ${options
        .map(
          (option, index) => `<label class="dx__seg-option">
            <input type="radio" name="${group}" value="${esc(option)}"
              ${index === 0 ? 'checked' : ''}>
            <span>${esc(option)}</span>
          </label>`
        )
        .join('')}
    </div>
  </fieldset>`;
}

/* No "For <patient>" line above the fields. The chart banner two inches up
   is already saying whose record this is, on every module, and a dialog
   opened from inside it cannot be about anybody else. */
function modalMarkup() {
  return `<ui-modal id="dxModal" heading="Add Diagnoses" size="md"
    data-testid="chart--diagnosis-modal">
    <div class="dx__form">
      <!-- No suggest attribute on this one. <ui-icd10> can open onto a short list of
           common codes, and the booking screen wants that — eight indications
           really are most of what a desk books against. A problem list is not
           eight codes, and this field is the first thing in the window, so the
           list would drop over Status, Type and Onset the moment the window
           opened. The reference screen asks for a search; this searches. -->
      <ui-icd10 class="dx__field--wide" id="dxCode" label="Diagnoses Name" required
        placeholder="Search ICD Code" data-testid="chart--diagnosis-code"></ui-icd10>

      ${segmented('status', 'Status', DIAGNOSIS_STATUSES, 'chart--diagnosis-status')}
      ${segmented('type', 'Type', DIAGNOSIS_TYPES, 'chart--diagnosis-type')}

      <ui-input id="dxOnset" type="date" label="Onset Date" placeholder="Choose Date"
        data-testid="chart--diagnosis-onset"></ui-input>
      <ui-input id="dxResolve" type="date" label="Resolve Date" placeholder="Choose Date"
        class="dx__resolve" hidden data-testid="chart--diagnosis-resolve"></ui-input>

      <ui-textarea class="dx__field--wide" id="dxNote" label="Note" rows="3"
        placeholder="Type here" data-testid="chart--diagnosis-note"></ui-textarea>
    </div>

    <div class="ui-modal__actions">
      <ui-button variant="tertiary" data-dx-dismiss data-testid="chart--diagnosis-cancel"
        >Cancel</ui-button
      >
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" id="dxSave" data-testid="chart--diagnosis-save"
        >Add</ui-button
      >
    </div>
  </ui-modal>`;
}

registerModule('diagnoses', {
  actions: () =>
    `<ui-select class="dx__status-filter" size="sm" id="dxStatusFilter" label="Filter by status"
      label-hidden empty-option="All Status" options="${esc(DIAGNOSIS_STATUSES.join(','))}"
      data-testid="chart--diagnosis-filter"></ui-select
    ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--diagnosis-open"
      >Add Diagnoses</ui-button
    >`,

  render(host, ctx) {
    // Copied, not mutated in place: switching patients and coming back must
    // not carry rows added or edits made during the previous visit.
    const data = (CHART_DIAGNOSES[ctx.patient.mrn] || EMPTY_CHART_DIAGNOSES).map((row) => ({
      ...row,
    }));

    let nextId = data.length + 1;
    let statusFilter = '';
    /** The row the window is open on, or null when it is adding a new one. */
    let editing = null;

    host.innerHTML = `<ui-data-table empty-text="No diagnoses recorded for this patient."
        data-testid="chart--diagnoses-table"></ui-data-table>
      ${modalMarkup()}`;

    const table = host.querySelector('[data-testid="chart--diagnoses-table"]');
    const modal = host.querySelector('#dxModal');
    const field = (id) => host.querySelector(`#${id}`);

    /* The two segmented switches are plain radios, so they are read and
       written through the checked input rather than through a component. */
    const seg = (name) => host.querySelector(`[data-dx-seg="${name}"]`);
    const segValue = (name) => seg(name).querySelector('input:checked')?.value ?? '';
    function setSeg(name, value) {
      const inputs = [...seg(name).querySelectorAll('input')];
      const match = inputs.find((input) => input.value === value) || inputs[0];
      match.checked = true;
    }

    function paint() {
      /* The number is the row's place in the RECORD, not in what is currently
         on screen. Renumbering a filtered list from 001 would mean the same
         diagnosis is 002 today and 001 the moment somebody narrows to Active
         — and the number is the thing people read a row out by. */
      const rows = data
        .map((row, index) => ({
          ...row,
          no: String(index + 1).padStart(3, '0'),
          diagnosis: diagnosisText(row.code),
          // An em dash rather than a blank: a cell with nothing in it reads as
          // a column that failed to render, and three of these are legitimately
          // empty on most rows.
          resolveDate: row.resolveDate || '—',
          note: row.note || '—',
        }))
        .filter((row) => !statusFilter || row.status === statusFilter);

      table.columns = COLUMNS;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
      table.setAttribute(
        'empty-text',
        statusFilter
          ? `No ${statusFilter.toLowerCase()} diagnoses on this record.`
          : 'No diagnoses recorded for this patient.'
      );
    }

    /** Show or hide the resolve date to match the status that is chosen. */
    function syncResolve() {
      const historical = segValue('status') === 'Historical';
      field('dxResolve').hidden = !historical;
      if (!historical) {
        // Dropped rather than merely hidden — a resolve date left behind on a
        // row that has been reopened is a date nobody can see and everybody
        // would inherit on the next save.
        field('dxResolve').setAttribute('value', '');
        const control = field('dxResolve').querySelector('input');
        if (control) control.value = '';
      }
    }

    /** Put the window into "adding" or "correcting `row`", then open it. */
    function openModal(trigger, row) {
      editing = row || null;

      modal.setAttribute('heading', row ? 'Edit Diagnoses' : 'Add Diagnoses');
      /* `text`, not textContent — setting textContent on a <ui-button> wipes
         the <button> it rendered and leaves the label as bare text. The
         attribute is there for exactly this: one button that both adds and
         saves. */
      field('dxSave').setAttribute('text', row ? 'Save' : 'Add');

      const code = field('dxCode');
      code.setAttribute('value', row?.code || '');
      code.removeAttribute('error');
      /* <ui-icd10> paints its chips from the attribute but leaves the text
         box alone, so the previous diagnosis would still be sitting in it on
         the next open. Written directly for the same reason the drawer next
         door writes its own controls. */
      const codeInput = code.querySelector('input');
      if (codeInput) codeInput.value = row ? diagnosisText(row.code) : '';

      setSeg('status', row?.status || DIAGNOSIS_STATUSES[0]);
      setSeg('type', row?.type || DIAGNOSIS_TYPES[0]);

      const setDate = (id, value) => {
        field(id).setAttribute('value', value);
        const control = field(id).querySelector('input');
        if (control) control.value = value;
      };
      setDate('dxOnset', toDateInput(row?.onsetDate));
      syncResolve();
      if (row?.resolveDate) setDate('dxResolve', toDateInput(row.resolveDate));

      field('dxNote').setAttribute('value', row?.note || '');
      const note = field('dxNote').querySelector('textarea');
      if (note) note.value = row?.note || '';

      modal.open(trigger);
    }

    function save() {
      /* The code is the one field the row cannot do without. Everything else
         describes a diagnosis; without this there isn't one. */
      const code = field('dxCode').value;
      if (!code) {
        field('dxCode').setAttribute('error', 'Choose a diagnosis');
        return;
      }
      field('dxCode').removeAttribute('error');

      const status = segValue('status');
      const onset = fromDateInput(field('dxOnset').value);
      const resolve = status === 'Historical' ? fromDateInput(field('dxResolve').value) : '';

      const values = {
        code,
        type: segValue('type'),
        status,
        // An onset nobody gave is recorded as today rather than left blank:
        // the date columns are only meaningful read against each other.
        onsetDate: onset || editing?.onsetDate || today(),
        // Somebody marking a condition Historical has said it ended; if they
        // did not say when, the day they said so is the closest true answer
        // the record can hold, and it beats an end date that is missing.
        resolveDate: status === 'Historical' ? resolve || editing?.resolveDate || today() : null,
        note: field('dxNote').value.trim(),
      };

      if (editing) {
        // The recorded date is when the practice first wrote the diagnosis
        // down, so a correction does not move it.
        Object.assign(editing, values);
      } else {
        data.push({ id: `dx${nextId++}`, recordedDate: today(), ...values });
      }

      const what = diagnosisText(code);
      const wasEditing = Boolean(editing);
      editing = null;

      paint();
      modal.close();
      ctx.flash(
        wasEditing
          ? `Changes to ${what} saved.`
          : `${what} added to this patient's diagnoses.`
      );
    }

    function onClick(event) {
      if (event.target.closest('[data-dx-dismiss]')) modal.close();

      const edit = event.target.closest('[data-dx-edit]');
      if (edit) {
        const row = data.find((r) => r.id === edit.dataset.dxEdit);
        if (row) openModal(edit, row);
      }
    }

    /* The filter and the button are the shell's markup, in the head — a
       sibling of this host rather than a descendant — so they are reached
       through the workspace root. */
    const head = host.parentElement;
    const openButton = head?.querySelector('[data-testid="chart--diagnosis-open"]');
    const filter = head?.querySelector('#dxStatusFilter');

    const onOpen = (event) => openModal(event.target, null);
    const onFilter = (event) => {
      statusFilter = event.detail?.value ?? '';
      paint();
    };
    const onStatus = () => syncResolve();

    openButton?.addEventListener('ui-click', onOpen);
    filter?.addEventListener('ui-change', onFilter);
    seg('status').addEventListener('change', onStatus);
    field('dxSave').addEventListener('ui-click', save);
    host.addEventListener('click', onClick);

    paint();

    return () => {
      openButton?.removeEventListener('ui-click', onOpen);
      filter?.removeEventListener('ui-change', onFilter);
      host.removeEventListener('click', onClick);
    };
  },
});
