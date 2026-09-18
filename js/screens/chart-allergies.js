/**
 * ALLERGIES — the maintained allergy record, and the drawer that adds to it.
 *
 * A table of what the patient reacts to, and one action: add another. Editing
 * is a pencil per row, the same affordance the reference screen uses.
 *
 * WHY A DRAWER AND NOT A ROW YOU TYPE INTO
 * Seven fields, three of them pickers whose options depend on a fourth
 * (the allergen list follows the type). That does not fit an inline row
 * without either scrolling it sideways or dropping fields, and an allergy
 * recorded with its severity missing is the field most worth having.
 *
 * THE ALLERGEN LIST FOLLOWS THE TYPE
 * Picking Food and then being offered Penicillin is how a wrong allergen gets
 * filed against the right patient. Changing the type re-fills the name picker
 * and clears whatever was chosen under the old one.
 */
import { registerModule } from './chart-workspace.js';
import {
  CHART_ALLERGIES,
  EMPTY_CHART_ALLERGIES,
  ALLERGY_TYPES,
  ALLERGY_NAMES,
  ALLERGY_REACTIONS,
  ALLERGY_SEVERITIES,
  ALLERGY_RECORDERS,
} from '../../data/chart-allergies.js';

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

/* Severity is the column that decides what happens next, so it reads as a
   pill rather than as one more word in a row of words — the same convention
   every other status column in this chart uses. */
const SEVERITY_TONE = { Mild: 'neutral', Moderate: 'warning', Severe: 'critical' };

const COLUMNS = [
  { key: 'no', label: 'No.' },
  { key: 'type', label: 'Allergy Type' },
  { key: 'allergen', label: 'Allergies' },
  { key: 'reaction', label: 'Reaction', wrap: true },
  {
    key: 'severity',
    label: 'Severity',
    render: (row) =>
      `<ui-badge status="${SEVERITY_TONE[row.severity] || 'neutral'}" size="sm"
        >${esc(row.severity)}</ui-badge
      >`,
  },
  { key: 'onsetDate', label: 'Onset Date' },
  { key: 'recordedDate', label: 'Recorded date' },
  { key: 'recordedBy', label: 'Recorded By', truncate: true },
  {
    key: 'edit',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) =>
      `<button type="button" class="alg__row-edit" data-alg-edit="${esc(row.id)}"
        aria-label="Edit the ${esc(row.allergen)} allergy">${icon('pencil')}</button>`,
  },
];

const optionTags = (list) =>
  list.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');

/** Today as the data file writes dates — dd-mm-yyyy. */
function today() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** A native date input's yyyy-mm-dd → the dd-mm-yyyy the record stores. */
function fromDateInput(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

function drawerMarkup(patientName) {
  return `<ui-modal id="algModal" heading="Add Allergies" size="md" variant="drawer"
    data-testid="chart--allergy-drawer">
    <p class="alg__for">For <strong>${esc(patientName)}</strong></p>

    <div class="alg__form">
      <ui-radio-group
        class="alg__field--wide"
        id="algType"
        label="Allergy Type"
        inline
        value="Drug"
        options="${esc(ALLERGY_TYPES.join(','))}"
        data-testid="chart--allergy-type"
      ></ui-radio-group>

      <ui-select class="alg__field--wide" id="algName" label="Allergy Name" required
        placeholder="Select or Search Allergy" data-testid="chart--allergy-name"></ui-select>

      <ui-select id="algReaction" label="Reaction" placeholder="Select Reaction"
        data-testid="chart--allergy-reaction">
        ${optionTags(ALLERGY_REACTIONS)}
      </ui-select>
      <ui-select id="algSeverity" label="Severity" placeholder="Select Severity"
        data-testid="chart--allergy-severity">
        ${optionTags(ALLERGY_SEVERITIES)}
      </ui-select>

      <ui-input id="algOnset" type="date" label="Onset Date"
        data-testid="chart--allergy-onset"></ui-input>
      <ui-select id="algRecordedBy" label="Recorded By" placeholder="Select"
        data-testid="chart--allergy-recorded-by">
        ${optionTags(ALLERGY_RECORDERS)}
      </ui-select>

      <ui-textarea class="alg__field--wide" id="algNote" label="Note" rows="3"
        placeholder="Type here" data-testid="chart--allergy-note"></ui-textarea>
    </div>

    <div class="ui-modal__actions">
      <ui-button variant="tertiary" data-alg-dismiss data-testid="chart--allergy-cancel"
        >Cancel</ui-button
      >
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" id="algAdd" data-testid="chart--allergy-add">Add</ui-button>
    </div>
  </ui-modal>`;
}

registerModule('allergies', {
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--allergy-open"
      >Add Allergies</ui-button
    >`,

  render(host, ctx) {
    // Copied, not mutated in place: switching patients and coming back must
    // not carry rows added during the previous visit.
    const data = (CHART_ALLERGIES[ctx.patient.mrn] || EMPTY_CHART_ALLERGIES).map((row) => ({
      ...row,
    }));

    let nextId = data.length + 1;

    host.innerHTML = `<ui-data-table empty-text="No allergies recorded for this patient."
        data-testid="chart--allergies-table"></ui-data-table>
      ${drawerMarkup(ctx.patient.name)}`;

    const table = host.querySelector('[data-testid="chart--allergies-table"]');
    const modal = host.querySelector('#algModal');
    const field = (id) => host.querySelector(`#${id}`);

    function paint() {
      table.columns = COLUMNS;
      table.rows = data.map((row, index) => ({
        ...row,
        no: String(index + 1).padStart(3, '0'),
      }));
      table.setAttribute('state', data.length ? 'ready' : 'empty');
    }

    /** Re-fill the allergen picker for the chosen type, and drop the old pick. */
    function fillNames() {
      const type = field('algType').value || ALLERGY_TYPES[0];
      const names = ALLERGY_NAMES[type] || [];
      field('algName').optionList = names.map((name) => ({ value: name, label: name }));
      field('algName').setAttribute('value', '');
      field('algName').removeAttribute('error');
    }

    function openDrawer(trigger) {
      field('algType').value = ALLERGY_TYPES[0];
      fillNames();
      ['algReaction', 'algSeverity', 'algRecordedBy', 'algOnset', 'algNote'].forEach((id) => {
        const el = field(id);
        el.setAttribute('value', '');
        const control = el.querySelector('input, select, textarea');
        if (control) control.value = '';
        el.removeAttribute('error');
      });
      modal.open(trigger);
    }

    function add() {
      /* The allergen is the one field the record cannot do without — a row
         that names a reaction but not what caused it is not an allergy. */
      const allergen = field('algName').value;
      if (!allergen) {
        field('algName').setAttribute('error', 'Choose an allergy');
        return;
      }
      field('algName').removeAttribute('error');

      const onset = fromDateInput(field('algOnset').value);
      data.push({
        id: `al${nextId++}`,
        type: field('algType').value || ALLERGY_TYPES[0],
        allergen,
        reaction: field('algReaction').value || '—',
        severity: field('algSeverity').value || 'Mild',
        // An onset nobody gave is recorded as today rather than left blank:
        // the table's two date columns are only meaningful side by side.
        onsetDate: onset || today(),
        recordedDate: today(),
        recordedBy: field('algRecordedBy').value || 'Amara Mensah',
        note: field('algNote').value.trim(),
      });

      paint();
      modal.close();
      ctx.flash(`${allergen} added to this patient's allergies.`);
    }

    function onClick(event) {
      if (event.target.closest('[data-alg-dismiss]')) modal.close();

      const edit = event.target.closest('[data-alg-edit]');
      if (edit) {
        const row = data.find((r) => r.id === edit.dataset.algEdit);
        ctx.flash(`Editing ${row?.allergen ?? 'an allergy'} is not wired up in this prototype yet.`);
      }
    }

    /* The action lives in the module head, which is the shell's markup rather
       than this module's — so it is reached through the workspace root. */
    const openButton = host.parentElement?.querySelector('[data-testid="chart--allergy-open"]');
    const onOpen = (event) => openDrawer(event.target);

    openButton?.addEventListener('ui-click', onOpen);
    field('algType').addEventListener('ui-change', fillNames);
    field('algAdd').addEventListener('ui-click', add);
    host.addEventListener('click', onClick);

    fillNames();
    paint();

    return () => {
      openButton?.removeEventListener('ui-click', onOpen);
      host.removeEventListener('click', onClick);
    };
  },
});
