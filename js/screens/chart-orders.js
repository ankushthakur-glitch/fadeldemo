/**
 * ORDERS — everything ordered against this chart that is not a prescription:
 * Lab Orders, Imaging/X-Ray, Procedures and Non-Visit Orders. Prescriptions
 * moved to its own module (chart-prescriptions.js) at the 2026-08 design
 * review — see that file's header for why.
 *
 * PROCEDURES IS THE NEWEST OF THE FOUR, and it is here because an EGD or a
 * colonoscopy decided in clinic had nowhere to be filed: the Plan of a visit
 * note could say "for colonoscopy" in prose and nothing anywhere became a
 * record of it. It wears the imaging section's shape exactly — a worklist, an
 * Add/Edit modal, the same four statuses — because it is the same kind of
 * thing: ordered here, done elsewhere, later. Why it is not FILED under
 * Imaging is argued over PROCEDURE_TYPES in data/chart-orders.js.
 *
 * ALL FOUR SECTIONS ARE WORKLISTS — <ui-data-table>, the same component the
 * directory and the scheduler use. Lab used to be the exception: a column of
 * cards you navigated THROUGH to a detail rather than a grid you read DOWN.
 * It is a table now, because a lab list is read the way the other three are —
 * down the Status column, down Received On, across every row at once — and a
 * stack of cards cannot be read that way; it also meant the one section a
 * clinician opens Orders for most often was the one that looked least like
 * the rest of the chart.
 *
 * What a row OPENS is what still separates Lab from the other three: the test
 * name is a link through to the report/requisition viewer, a page in its own
 * right with prev/next, zoom and print, because a result is read at length.
 * Imaging and Non-Visit open an Add/Edit modal instead.
 *
 * They stay four separate, small sections rather than one generic "order"
 * abstraction: an imaging order has no test panel, a non-visit order has no facility,
 * and forcing them into one shape would mean columns of em-dashes on every
 * row — the same reasoning chart-tasks.js's five worklists are kept apart
 * for. Each carries its own Add / Edit / status action / Delete, the same
 * CRUD shape Prescriptions uses.
 *
 * THE SECTION STRIP is `primary` and is drawn by the shell into the module
 * head, the slot chart-workspace.js reserves for a module's own view switch.
 * It used to be an underline strip inside the panel, which left Orders' switch
 * at a different height, in a different shape, from Profile's and
 * Appointments' — the two other modules whose tabs are their sections. The Add
 * button beside it changes with the section, so the head's action slot is
 * repainted from here on a switch.
 *
 * ctx only provides { patient, age, go, flash }. Every modal and every menu
 * is this module's own, same contract as every other chart module.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import {
  PRESCRIBING_PROVIDERS,
  LAB_VENDORS,
  LAB_TEST_CATALOG,
  ICD_CODES,
  LAB_STATUS,
  IMAGING_MODALITIES,
  IMAGING_FACILITIES,
  IMAGING_PRIORITIES,
  IMAGING_STATUS,
  PROCEDURE_TYPES,
  PROCEDURE_FACILITIES,
  PROCEDURE_PRIORITIES,
  PROCEDURE_STATUS,
  NON_VISIT_TYPES,
  NON_VISIT_STATUS,
} from '../../data/chart-orders.js';
/* The chart's own seed plus anything raised against this patient from outside
   it — today, that means the Plan of a signed visit note. See the note at the
   head of the store for why it is an overlay and not a second copy of the
   record. */
import { ordersFor } from '../../data/order-store.js';
import { admits } from '../lib/filter-set.js';

/* ============================================================================
   SMALL HELPERS — duplicated rather than shared, matching how every other
   chart module keeps its own tiny date/escape helpers local.
   ========================================================================= */

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

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** yyyy-mm-dd (native date input) → dd-mm-yyyy (this file's format). */
function isoToDdMmYyyy(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

let uid = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${++uid}`;

/** The shared .ui-row-menu-btn — one "⋮" convention, one definition. */
function rowActionButton(attr, id, label) {
  return `<button type="button" class="ui-row-menu-btn" data-${attr}="${id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${label}">
      ${icon('more-vertical')}
    </button>`;
}

/** A status map's entry as a badge, or an em-dash if the status is unknown. */
function badgeFor(map, key) {
  const entry = map[key];
  if (!entry) return '—';
  return `<ui-badge status="${entry.tone}" size="sm">${esc(entry.label)}</ui-badge>`;
}

/* ============================================================================
   LAB — the worklist, and the report/requisition viewer a row opens
   ========================================================================= */

/**
 * The Test cell. The name is the way through to the result, so it is a link
 * — the same two-line cell Imaging gives a study, and the same link the
 * Documents and Forms worklists put on a row's name. The lab that ran it sits
 * under the name rather than in a column of its own: it is what you check
 * after you have found the test, never what you scan the list by.
 */
function labTestCell(lab) {
  return `<span class="ord__med">
    <button type="button" class="ui-text-link ui-text-link--default ord__lab-name"
      data-lab-open="${lab.id}">${esc(lab.name)}</button>
    <span class="ord__med-meta">${esc(lab.vendor)}</span>
  </span>`;
}

const LAB_COLUMNS = [
  { key: 'name', label: 'Test', wrap: true, render: labTestCell },
  { key: 'orderedOn', label: 'Ordered On' },
  { key: 'orderedBy', label: 'Ordered By' },
  {
    key: 'receivedOn',
    label: 'Received On',
    render: (row) => (row.receivedOn ? esc(row.receivedOn) : '—'),
  },
  { key: 'status', label: 'Status', render: (row) => badgeFor(LAB_STATUS, row.status) },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('lab-menu', row.id, 'Lab order actions'),
  },
];

/** Label/value pairs, two to a row — the meta grid on the report and the
 *  requisition both use this. */
function metaGrid(pairs) {
  return `<dl class="ord__meta-grid">
    ${pairs
      .map(([label, value]) => `<div class="ord__meta-item"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
      .join('')}
  </dl>`;
}

function reportView(lab, patientName) {
  if (!lab.report) {
    return `<div class="ord__report-empty">
      ${icon('clock')}
      <p>No report yet — this result has not been received.</p>
    </div>`;
  }

  const r = lab.report;
  return `
    ${metaGrid([
      ['Patient', patientName],
      ['Requesting doctor', lab.orderedBy],
      ['Number', r.number],
      ['Clinic', r.clinic],
      ['Age', `${r.age} years`],
      ['Collection date', r.collectionDate],
      ['Gender', r.gender],
      ['Received date', r.receivedDate],
      ['Existing conditions', r.existingConditions],
      ['Report date', r.reportDate],
    ])}
    <h3 class="ord__report-title">Laboratory Results</h3>
    <p class="ord__report-sample">Sample: ${esc(r.sampleId)}</p>
    <h4 class="ord__report-panel">${esc(r.panelTitle)}</h4>
    <ui-data-table id="ordResultsTable" data-testid="chart--lab-results-table"></ui-data-table>
  `;
}

function requisitionView(lab, patientName) {
  return `
    ${metaGrid([
      ['Patient', patientName],
      ['Ordering provider', lab.orderedBy],
      ['Test', lab.name],
      ['Lab', lab.vendor],
      ['ICD code', lab.icdCode],
      ['Ordered on', lab.orderedOn],
    ])}
    <h3 class="ord__report-title">Patient Instructions</h3>
    <p class="ord__report-prose">${esc(lab.patientInstruction || 'None recorded.')}</p>
  `;
}

const RESULTS_COLUMNS = [
  { key: 'category', label: 'Category' },
  {
    key: 'result',
    label: 'Result',
    render: (row) =>
      row.outOfRange
        ? `<span class="ord__out-of-range">${esc(row.result)}</span>`
        : esc(row.result),
  },
  { key: 'range', label: 'Normal Range' },
];

function addLabTestModal(testRows) {
  return `<ui-modal id="ordAddLabModal" heading="Add Lab Test" size="lg">
    <div class="ord__field-grid">
      <ui-select label="Lab" placeholder="Select Lab" id="ordLabVendor"
        options="${LAB_VENDORS.join(',')}" data-testid="chart--lab-vendor"></ui-select>
      <ui-input label="Collection Date" type="date" data-testid="chart--lab-collection-date"></ui-input>
      <ui-input label="Collection Time" type="time"></ui-input>
      <ui-select label="Provider" placeholder="Select Provider" id="ordLabProvider"
        options="${PRESCRIBING_PROVIDERS.join(',')}" data-testid="chart--lab-provider"></ui-select>
    </div>

    <div class="ord__test-group">
      <div class="ord__test-group-head">
        <span class="ui-field__label">Test</span>
        <button type="button" class="ord__add-row" data-test-add-row data-testid="chart--lab-add-test-row">
          ${icon('plus')} Add New
        </button>
      </div>
      <div id="ordTestRows">${testRows.map(testRowMarkup).join('')}</div>
    </div>

    <ui-input class="ord__field-wide" style="margin-top: var(--space-6)"
      label="Patient Instruction" placeholder="Enter Patient Instruction"
      data-testid="chart--lab-instruction"></ui-input>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-testid="chart--lab-print-close">Print &amp; close</ui-button>
      <ui-button variant="primary" data-testid="chart--lab-order">Order</ui-button>
    </div>
  </ui-modal>`;
}

/** One repeatable Test row: search-select a test, pick its ICD code, remove. */
function testRowMarkup(row) {
  return `<div class="ord__test-row" data-test-row="${row.rowId}">
    <span class="ord__test-row-index">${row.index}</span>
    <ui-select label-hidden label="Test" placeholder="Search & Select Test"
      class="ord__test-select" options="${LAB_TEST_CATALOG.join(',')}"
      data-test-name="${row.rowId}" data-testid="chart--lab-test-${row.index}"></ui-select>
    <ui-select label-hidden label="ICD Code" placeholder="ICD Code"
      class="ord__test-icd" options="${ICD_CODES.join(',')}" data-test-icd="${row.rowId}"></ui-select>
    <button type="button" class="ord__test-remove" data-test-remove="${row.rowId}"
      aria-label="Remove test row" ${row.removable ? '' : 'disabled'}>
      ${icon('trash')}
    </button>
  </div>`;
}

function uploadLabResultsModal(pendingLabs) {
  return `<ui-modal id="ordUploadModal" heading="Upload Lab Results" size="md">
    <ui-radio-group
      id="ordUploadOption"
      options="Associate result with existing lab order,Upload result without lab order"
      value="Associate result with existing lab order"
      data-testid="chart--upload-option"
    ></ui-radio-group>

    <div class="ord__field-grid" style="margin-top: var(--space-6)">
      <ui-select label="Reviewer" placeholder="Select" id="ordUploadReviewer"
        options="${PRESCRIBING_PROVIDERS.join(',')}" data-testid="chart--upload-reviewer"></ui-select>
      <span></span>
      <ui-input label="Recorded Date" type="date" data-testid="chart--upload-date"></ui-input>
      <ui-input label="Recorded Time" type="time" data-testid="chart--upload-time"></ui-input>

      <ui-select label="Lab Name" placeholder="Select" id="ordUploadLabName"
        options="${LAB_VENDORS.join(',')}" data-testid="chart--upload-lab-name"></ui-select>

      <!-- Whichever of these two is relevant to the chosen Upload Option. -->
      <ui-select label="Existing Lab Order" placeholder="Select" id="ordUploadExisting"
        options="${pendingLabs.map((l) => esc(l.name)).join(',')}"
        data-testid="chart--upload-existing"></ui-select>
      <ui-input label="Test Name" placeholder="Enter Test Name" id="ordUploadTestNameInput"
        data-testid="chart--upload-test-name" hidden></ui-input>
    </div>

    <ui-file-upload
      class="ord__field-wide"
      label="Result file"
      accept=".pdf,.csv,.jpg,.png"
      max-size="10MB"
      data-testid="chart--upload-file"
    ></ui-file-upload>

    <ui-textarea class="ord__field-wide" label="Note" rows="3" placeholder="Enter note…"
      style="margin-top: var(--space-6)"></ui-textarea>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-testid="chart--upload-print-close">Print &amp; close</ui-button>
      <ui-button variant="primary" data-testid="chart--upload-save">Save Lab Result</ui-button>
    </div>
  </ui-modal>`;
}

/* ============================================================================
   IMAGING / X-RAY
   ========================================================================= */

function imagingStudyCell(row) {
  return `<span class="ord__med">
    <strong class="ord__med-name">${esc(row.modality)}</strong>
    <span class="ord__med-meta">${esc(row.bodyPart)}</span>
  </span>`;
}

const IMAGING_COLUMNS = [
  { key: 'study', label: 'Study', wrap: true, render: imagingStudyCell },
  {
    key: 'priority',
    label: 'Priority',
    render: (row) =>
      `<ui-badge status="${row.priority === 'STAT' ? 'critical' : 'neutral'}" size="sm"
        >${esc(row.priority)}</ui-badge
      >`,
  },
  { key: 'facility', label: 'Facility', wrap: true },
  { key: 'orderedOn', label: 'Ordered On' },
  { key: 'orderedBy', label: 'Ordered By' },
  { key: 'status', label: 'Status', render: (row) => badgeFor(IMAGING_STATUS, row.status) },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('img-menu', row.id, 'Imaging order actions'),
  },
];

function addImagingModal(draft) {
  return `<ui-modal id="ordAddImagingModal" heading="${draft ? 'Edit Imaging Order' : 'Add Imaging Order'}" size="md">
    <div class="ord__field-grid">
      <ui-select label="Modality" placeholder="Select" id="ordImgModality" required
        options="${IMAGING_MODALITIES.join(',')}" value="${esc(draft?.modality ?? '')}"
        data-testid="chart--img-modality"></ui-select>
      <ui-input label="Body Part / Region" placeholder="e.g. Abdomen and Pelvis" required
        value="${esc(draft?.bodyPart ?? '')}" data-testid="chart--img-bodypart"></ui-input>

      <ui-radio-group label="Priority" inline id="ordImgPriority" options="${IMAGING_PRIORITIES.join(',')}"
        value="${esc(draft?.priority ?? 'Routine')}" data-testid="chart--img-priority"></ui-radio-group>
      <ui-select label="Facility" placeholder="Select" id="ordImgFacility"
        options="${IMAGING_FACILITIES.join(',')}" value="${esc(draft?.facility ?? '')}"
        data-testid="chart--img-facility"></ui-select>

      <ui-select label="Indication" placeholder="Select ICD code" id="ordImgIndication"
        options="${ICD_CODES.join(',')}" value="${esc(draft?.indication ?? '')}"
        data-testid="chart--img-indication"></ui-select>
      <ui-select label="Ordering Provider" placeholder="Select" id="ordImgProvider"
        options="${PRESCRIBING_PROVIDERS.join(',')}" value="${esc(draft?.orderedBy ?? '')}"
        data-testid="chart--img-provider"></ui-select>

      <ui-textarea class="ord__field-wide" label="Notes" rows="3" placeholder="Enter note…"
        value="${esc(draft?.notes ?? '')}" data-testid="chart--img-notes"></ui-textarea>
    </div>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--img-cancel">Cancel</ui-button>
      <ui-button variant="primary" data-testid="chart--img-save">${draft ? 'Save Changes' : 'Order'}</ui-button>
    </div>
  </ui-modal>`;
}

/* ============================================================================
   PROCEDURES

   An endoscopy ordered against the chart. Same worklist shape as Imaging, and
   deliberately so — see the module header.
   ========================================================================= */

/**
 * The procedure and what it is being done for, in one cell.
 *
 * The indication is under the name rather than in a column of its own because
 * it is the longest string on the row and the thing the reader wants WITH the
 * procedure, not six columns away from it — the same two-line treatment
 * Imaging gives a study and its body part.
 */
function procedureCell(row) {
  return `<span class="ord__med">
    <strong class="ord__med-name">${esc(row.procedure)}</strong>
    <span class="ord__med-meta">${esc(row.indication || 'No indication recorded')}</span>
  </span>`;
}

/**
 * Where the order came from, when it came from a note.
 *
 * Blank for anything typed on this screen, which is most of them. A row that
 * says nothing here was raised here; a row that names a note was raised on the
 * Plan of that note and filed when it was signed, and that is worth being able
 * to see from the worklist — it is the difference between an order somebody
 * entered and an order a signed clinical document is standing behind.
 */
function procedureSourceCell(row) {
  return row.raisedFrom
    ? `<span class="ord__med-meta">${esc(row.raisedFrom)}</span>`
    : '<span class="ord__med-meta">—</span>';
}

const PROCEDURE_COLUMNS = [
  { key: 'procedure', label: 'Procedure', wrap: true, render: procedureCell },
  {
    key: 'priority',
    label: 'Priority',
    render: (row) =>
      `<ui-badge status="${row.priority === 'Routine' ? 'neutral' : row.priority === 'STAT' ? 'critical' : 'warning'}" size="sm"
        >${esc(row.priority)}</ui-badge
      >`,
  },
  { key: 'facility', label: 'Facility', wrap: true },
  { key: 'orderedOn', label: 'Ordered On' },
  { key: 'orderedBy', label: 'Ordered By' },
  { key: 'raisedFrom', label: 'Raised From', wrap: true, render: procedureSourceCell },
  { key: 'status', label: 'Status', render: (row) => badgeFor(PROCEDURE_STATUS, row.status) },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('prc-menu', row.id, 'Procedure order actions'),
  },
];

function addProcedureModal(draft) {
  return `<ui-modal id="ordAddProcedureModal" heading="${draft ? 'Edit Procedure Order' : 'Add Procedure Order'}" size="md">
    <div class="ord__field-grid">
      <ui-select label="Procedure" placeholder="Select" id="ordPrcType" required
        options="${PROCEDURE_TYPES.join(',')}" value="${esc(draft?.procedure ?? '')}"
        data-testid="chart--prc-type"></ui-select>
      <ui-select label="Indication" placeholder="Select ICD code" id="ordPrcIndication"
        options="${ICD_CODES.join(',')}" value="${esc(draft?.indication ?? '')}"
        data-testid="chart--prc-indication"></ui-select>

      <ui-radio-group label="Priority" inline id="ordPrcPriority" options="${PROCEDURE_PRIORITIES.join(',')}"
        value="${esc(draft?.priority ?? 'Routine')}" data-testid="chart--prc-priority"></ui-radio-group>
      <ui-select label="Facility" placeholder="Select" id="ordPrcFacility"
        options="${PROCEDURE_FACILITIES.join(',')}" value="${esc(draft?.facility ?? '')}"
        data-testid="chart--prc-facility"></ui-select>

      <ui-select class="ord__field-wide" label="Ordering Provider" placeholder="Select" id="ordPrcProvider"
        options="${PRESCRIBING_PROVIDERS.join(',')}" value="${esc(draft?.orderedBy ?? '')}"
        data-testid="chart--prc-provider"></ui-select>

      <ui-textarea class="ord__field-wide" label="Notes" rows="3"
        placeholder="Prep, sedation plan, anything the endoscopist should know…"
        value="${esc(draft?.notes ?? '')}" data-testid="chart--prc-notes"></ui-textarea>
    </div>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--prc-cancel">Cancel</ui-button>
      <ui-button variant="primary" data-testid="chart--prc-save">${draft ? 'Save Changes' : 'Order'}</ui-button>
    </div>
  </ui-modal>`;
}

/* NO REFERRALS SECTION IN THE CHART.
   A Referrals tab stood here with its own table, its own Add Referral form and
   its own status vocabulary — a second, thinner referral record living beside
   the real one. Referrals are raised, packeted, faxed, chased and replied to
   on the Referrals screen, which is where the cover sheet, the attachments and
   the incoming reply all are; a referral typed into the chart never reached
   any of that, and the two records had no way to meet. What the chart shows
   about a referral belongs in the chart's Documents and Notes, which is where
   the letter and the reply land. */

/* ============================================================================
   NON-VISIT ORDERS
   ========================================================================= */

function nonVisitCell(row) {
  return `<span class="ord__med">
    <strong class="ord__med-name">${esc(row.type)}</strong>
    <span class="ord__med-meta">${esc(row.description)}</span>
  </span>`;
}

const NON_VISIT_COLUMNS = [
  { key: 'order', label: 'Order', wrap: true, render: nonVisitCell },
  { key: 'orderedOn', label: 'Ordered On' },
  { key: 'orderedBy', label: 'Ordered By' },
  { key: 'status', label: 'Status', render: (row) => badgeFor(NON_VISIT_STATUS, row.status) },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('nv-menu', row.id, 'Order actions'),
  },
];

function addNonVisitModal(draft) {
  return `<ui-modal id="ordAddNonVisitModal" heading="${draft ? 'Edit Non-Visit Order' : 'Add Non-Visit Order'}" size="md">
    <div class="ord__field-grid">
      <ui-select label="Order Type" placeholder="Select" id="ordNvType" required
        options="${NON_VISIT_TYPES.join(',')}" value="${esc(draft?.type ?? '')}"
        data-testid="chart--nv-type"></ui-select>
      <ui-select label="Ordering Provider" placeholder="Select" id="ordNvProvider"
        options="${PRESCRIBING_PROVIDERS.join(',')}" value="${esc(draft?.orderedBy ?? '')}"
        data-testid="chart--nv-provider"></ui-select>

      <ui-textarea class="ord__field-wide" label="Description" rows="3" required
        placeholder="What was ordered and why" value="${esc(draft?.description ?? '')}"
        data-testid="chart--nv-description"></ui-textarea>
    </div>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--nv-cancel">Cancel</ui-button>
      <ui-button variant="primary" data-testid="chart--nv-save">${draft ? 'Save Changes' : 'Add'}</ui-button>
    </div>
  </ui-modal>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

/**
 * The head's action slot for one section. It lives out here rather than in
 * render() because the shell asks for it once, at mount, before the module's
 * own state exists — paint() then replaces it whenever the section changes.
 *
 * Lab's search and status filter are part of this slot rather than a strip
 * drawn inside the panel. Every other module that narrows a list does it from
 * the head — Documents, Forms, Tasks, Medication, Prescriptions — and the lab
 * worklist was the last place in the chart with a second band of furniture
 * sitting under the first, pushing the table a row further down the page than
 * the same table in any other module. They are only drawn for the WORKLIST:
 * in the report viewer they would narrow a list that is not on screen.
 *
 * The state the fields carry is passed in because this slot is rebuilt from
 * scratch on a section switch — coming back to Lab has to redraw the search
 * the user typed, not an empty one. Defaults cover the mount call, which
 * happens before the module's state object exists.
 */
function sectionActions(section, { labSearch = '', labStatusFilter = '', labView = 'list' } = {}) {
  if (section === 'lab') {
    const filters =
      labView === 'list'
        ? `<ui-input class="ord__search" size="sm" icon="search" label="Search lab orders"
            label-hidden placeholder="Search" value="${esc(labSearch)}"
            data-testid="chart--lab-search"></ui-input
          ><ui-select class="ord__status-filter" size="sm" id="ordLabStatusFilter"
            label="Filter by status" label-hidden multiple empty-option="All Status"
            value="${esc(labStatusFilter)}" data-testid="chart--lab-status-filter"></ui-select>`
        : '';
    return `${filters}
      <ui-button variant="outline" size="sm" icon="upload" data-testid="chart--upload-results"
        >Upload Results</ui-button
      >
      <ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-lab-test"
        >Add Lab Test</ui-button
      >`;
  }
  if (section === 'imaging') {
    return `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-imaging"
      >Add Imaging Order</ui-button>`;
  }
  if (section === 'procedures') {
    return `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-procedure"
      >Add Procedure Order</ui-button>`;
  }
  return `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-nonvisit"
    >Add Non-Visit Order</ui-button>`;
}

registerModule('orders', {
  /* The sidebar's open row already says Orders, and so does the tab lit under
     it; a third "Orders" on the same row is a word the eye steps over on the
     way to the switch. Same arrangement as Profile and Appointments. */
  hideTitle: true,

  /* The section switch, in the slot the shell reserves for a module's own view
     switch — and `primary`, because these four ARE this section's views, not a
     choice between two lists inside one of them. */
  tabs: () => `<ui-tabs primary selected="lab" data-testid="chart--orders-tabs">
      <ui-tab value="lab" label="Lab Orders"></ui-tab>
      <ui-tab value="imaging" label="Imaging/X-Ray"></ui-tab>
      <ui-tab value="procedures" label="Procedures"></ui-tab>
      <ui-tab value="nonVisit" label="Non-Visit Orders"></ui-tab>
    </ui-tabs>`,

  /* Add follows the strip up onto the head row, where every other module keeps
     its whole-module action — and, for Lab, the search and status filter that
     narrow the worklist. What sits here depends on the open section and, on
     Lab, on whether the worklist or the report viewer is up, so this is only
     the opening set — see syncHead(). */
  actions: () => sectionActions('lab'),

  render(host, ctx) {
    // Already a fresh copy per call, seed behind anything raised from outside
    // the chart — see data/order-store.js. Held in a `data` of its own for the
    // same reason as chart-notes.js: re-rendering the module must not carry
    // state from a previous visit.
    const data = ordersFor(ctx.patient.mrn);

    const state = {
      section: 'lab', // 'lab' | 'imaging' | 'procedures' | 'nonVisit'
      labSearch: '',
      labStatusFilter: '', // a set, empty; see js/lib/filter-set.js
      selectedLabId: data.labs[0]?.id ?? null,
      // 'list' is the worklist; 'detail' is the report/requisition viewer for
      // selectedLabId. Lab is the only section with two views of its own.
      labView: 'list',
      labDetailTab: 'report',
      testRows: [{ rowId: nextId('row'), index: 1, removable: false }],
      // The record being edited in each section's Add/Edit modal, or null
      // when the modal is in "Add" mode. Cleared explicitly by the toolbar's
      // Add trigger so a stale edit never leaks into the next Add.
      editImaging: null,
      editProcedure: null,
      editNonVisit: null,
    };

    /* The strip, the section's buttons and Lab's two filters are the shell's
       markup in the module head — a band that is a SIBLING of this host,
       not a child of it,
       so nothing they fire ever reaches host. The nearest element that holds
       both is the workspace itself; head events are therefore listened for
       there, and every head handler checks the event really came from the
       band before answering, because that same listener also sees everything
       bubbling out of the panel. */
    const workspace = host.parentElement;
    const head = () => workspace?.querySelector('.ch__module-head');

    /* --- Derived lists ----------------------------------------------------- */

    function visibleLabs() {
      /* A set. A lab list is read as "everything Pending and everything
         Resulted-but-unreviewed" far more often than one status at a time. */
      let list = data.labs.filter((l) => admits(state.labStatusFilter, LAB_STATUS[l.status]?.label));
      if (state.labSearch) {
        const q = state.labSearch.toLowerCase();
        list = list.filter((l) => l.name.toLowerCase().includes(q));
      }
      return list;
    }

    function selectedLab() {
      return data.labs.find((l) => l.id === state.selectedLabId) ?? null;
    }

    /* --- Paint --------------------------------------------------------------- */

    /**
     * The module head, on every paint.
     *
     * <ui-tabs> deliberately refuses to rebuild its own buttons — replacing
     * the button a pointer just landed on loses focus mid-keystroke — so the
     * selection is set through the attribute it watches rather than by
     * re-rendering the strip.
     *
     * The actions are only rewritten when the section — or, on Lab, the view —
     * actually changed. A modal remembers the button that opened it so it can
     * hand focus back on close, and rebuilding that button on every repaint
     * would leave the modal holding a node that is no longer in the document;
     * the search box in that same slot would lose the caret with it.
     */
    function syncHead() {
      head()?.querySelector('[data-testid="chart--orders-tabs"]')?.setAttribute('selected', state.section);

      /* Lab's slot depends on the view as well as the section, because the
         filters are in it and the report viewer has no list to filter — hence
         a key rather than the section name alone. Anything that leaves the key
         unchanged (a keystroke in the search box, a row opening a menu) must
         not reach this branch: rebuilding the slot would replace the field the
         caret is in. */
      const actions = head()?.querySelector('.ch__module-actions');
      const key = state.section === 'lab' ? `lab:${state.labView}` : state.section;
      if (actions && actions.dataset.section !== key) {
        actions.dataset.section = key;
        actions.innerHTML = sectionActions(state.section, state);
        fillLabStatusFilter();
      }
    }

    /* "All Status" is the field's `empty-option` — the row that empties the set
       instead of a fourth answer sitting beside the three it cancels — so this
       only has to supply the statuses themselves. Called from syncHead() alone:
       assigning optionList re-renders the select, and doing that on every paint
       would shut a dropdown the user has open. */
    function fillLabStatusFilter() {
      const statusFilter = head()?.querySelector('#ordLabStatusFilter');
      if (!statusFilter) return;
      statusFilter.optionList = Object.values(LAB_STATUS).map((s) => ({
        value: s.label,
        label: s.label,
      }));
    }

    /** The worklist. The same shape as the other three sections — the table and
     *  nothing above it. What narrows this one list is in the module head with
     *  the section's own buttons; see sectionActions(). */
    function labListMarkup() {
      return `<ui-data-table empty-text="No lab orders on this record."
        data-testid="chart--lab-table"></ui-data-table>`;
    }

    /** The one lab a row opened, at full width: the report or the requisition,
     *  with prev/next stepping through the whole list without going back. */
    function labDetailMarkup(lab) {
      const allLabs = data.labs;
      const currentIndex = allLabs.findIndex((l) => l.id === lab.id);

      return `<div class="ord__lab-detail">
        <button type="button" class="ord__lab-back" data-lab-back
          data-testid="chart--lab-back">${icon('caret-left')} All Lab Orders</button>
        <div class="ord__lab-detail-head">
          <div class="ord__lab-detail-nav">
            <button type="button" data-lab-prev aria-label="Previous lab order"
              ${currentIndex <= 0 ? 'disabled' : ''}>${icon('caret-left')}</button>
            <strong>${esc(lab.name)}</strong>
            <button type="button" data-lab-next aria-label="Next lab order"
              ${currentIndex === -1 || currentIndex >= allLabs.length - 1 ? 'disabled' : ''}
              >${icon('caret-right')}</button>
          </div>
          <ui-tabs selected="${state.labDetailTab}" data-testid="chart--lab-detail-tabs">
            <ui-tab value="report" label="Report"></ui-tab>
            <ui-tab value="requisition" label="Requisition"></ui-tab>
          </ui-tabs>
        </div>
        <div class="ord__report-card" id="ordReportCard">
          <div id="panel-${state.labDetailTab}" role="tabpanel">
            ${
              state.labDetailTab === 'report'
                ? reportView(lab, ctx.patient.name)
                : requisitionView(lab, ctx.patient.name)
            }
          </div>
        </div>
        <div class="ord__report-toolbar">
          <div class="ord__zoom">
            <button type="button" data-zoom-out aria-label="Zoom out">${icon('minus')}</button>
            <span data-testid="chart--lab-zoom">${state.zoom ?? 100}%</span>
            <button type="button" data-zoom-in aria-label="Zoom in">${icon('plus')}</button>
          </div>
          <button type="button" class="ord__toolbar-btn" data-lab-print aria-label="Print"
            data-testid="chart--lab-print">${icon('document')} Print</button>
          <button type="button" class="ord__toolbar-btn" data-lab-download aria-label="Download"
            data-testid="chart--lab-download">${icon('upload')} Download</button>
        </div>
      </div>`;
    }

    function labMarkup() {
      const lab = selectedLab();
      // A detail with nothing behind it — the lab was deleted, or none was
      // ever chosen — falls back to the list rather than drawing an empty page.
      return state.labView === 'detail' && lab ? labDetailMarkup(lab) : labListMarkup();
    }

    /**
     * Fill the lab table from state. Separate from paint() because the search
     * box filters as you type: repainting the panel would rebuild the very
     * <ui-input> being typed into and take the caret with it. Only the rows
     * change, so only the rows are rewritten — the same split Documents makes.
     */
    function applyLabRows() {
      const table = host.querySelector('[data-testid="chart--lab-table"]');
      if (!table) return;

      const rows = visibleLabs();
      table.columns = LAB_COLUMNS;
      table.rows = rows;
      // Nothing to show has two meanings, and they need different words.
      table.setAttribute(
        'empty-text',
        state.labSearch || state.labStatusFilter
          ? 'No lab orders match this search.'
          : 'No lab orders on this record.'
      );
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    function imagingMarkup() {
      return `<ui-data-table empty-text="No imaging orders on this record."
        data-testid="chart--imaging-table"></ui-data-table>`;
    }

    function proceduresMarkup() {
      return `<ui-data-table empty-text="No procedures ordered on this record."
        data-testid="chart--procedures-table"></ui-data-table>`;
    }

    function nonVisitMarkup() {
      return `<ui-data-table empty-text="No non-visit orders on this record."
        data-testid="chart--nonvisit-table"></ui-data-table>`;
    }

    function paint() {
      syncHead();

      host.innerHTML = `<div id="panel-lab" class="ord__section">${state.section === 'lab' ? labMarkup() : ''}</div>
        <div id="panel-imaging" class="ord__section">${state.section === 'imaging' ? imagingMarkup() : ''}</div>
        <div id="panel-procedures" class="ord__section">${state.section === 'procedures' ? proceduresMarkup() : ''}</div>
        <div id="panel-nonVisit" class="ord__section">${state.section === 'nonVisit' ? nonVisitMarkup() : ''}</div>

        ${addLabTestModal(state.testRows)}
        ${uploadLabResultsModal(data.labs.filter((l) => l.status === 'ordered'))}
        ${addImagingModal(state.editImaging)}
        ${addProcedureModal(state.editProcedure)}
        ${addNonVisitModal(state.editNonVisit)}`;

      if (state.section === 'lab') {
        applyLabRows();

        const lab = selectedLab();
        if (state.labView === 'detail' && lab?.report && state.labDetailTab === 'report') {
          const resultsTable = host.querySelector('[data-testid="chart--lab-results-table"]');
          if (resultsTable) {
            resultsTable.columns = RESULTS_COLUMNS;
            resultsTable.rows = lab.report.rows;
            resultsTable.setAttribute('state', 'ready');
          }
        }
        applyZoom();
      }

      if (state.section === 'imaging') {
        const table = host.querySelector('[data-testid="chart--imaging-table"]');
        table.columns = IMAGING_COLUMNS;
        table.rows = data.imaging;
        table.setAttribute('state', data.imaging.length ? 'ready' : 'empty');
      }

      if (state.section === 'procedures') {
        const table = host.querySelector('[data-testid="chart--procedures-table"]');
        table.columns = PROCEDURE_COLUMNS;
        table.rows = data.procedures;
        table.setAttribute('state', data.procedures.length ? 'ready' : 'empty');
      }

      if (state.section === 'nonVisit') {
        const table = host.querySelector('[data-testid="chart--nonvisit-table"]');
        table.columns = NON_VISIT_COLUMNS;
        table.rows = data.nonVisit;
        table.setAttribute('state', data.nonVisit.length ? 'ready' : 'empty');
      }
    }

    /* --- Zoom (Lab report) --------------------------------------------------- */

    function applyZoom() {
      const card = host.querySelector('#ordReportCard');
      if (card) card.style.zoom = `${state.zoom ?? 100}%`;
    }

    /* --- Lab: opening a result ------------------------------------------------ */

    function openLabDetail(id, tab) {
      state.selectedLabId = id;
      state.labDetailTab = tab;
      state.labView = 'detail';
      paint();
    }

    /** Both views are offered whatever the status: a test that has not come
     *  back still HAS a requisition, and asking for the report of one that has
     *  not been received is answered honestly by the viewer — with the empty
     *  state — rather than by a menu item quietly going missing. */
    function labMenu(id) {
      const lab = data.labs.find((l) => l.id === id);
      if (!lab) return;

      const items = [
        { label: 'View Report', icon: 'document', action: 'report' },
        { label: 'View Requisition', icon: 'clipboard', action: 'requisition' },
      ];

      const anchor = host.querySelector(`[data-lab-menu="${id}"]`);

      openRowMenu(
        anchor,
        items.map((item) => ({ ...item, run: () => openLabDetail(id, item.action) }))
      );
    }

    /* --- Row menus ------------------------------------------------------------ */


    /* --- Imaging: CRUD ---------------------------------------------------------- */

    function openImagingModal(trigger, editRow) {
      state.editImaging = editRow ?? null;
      paint();
      host.querySelector('#ordAddImagingModal')?.open(trigger);
    }

    function imagingMenu(id) {
      const order = data.imaging.find((o) => o.id === id);
      if (!order) return;

      const items = [];
      if (order.status === 'ordered') {
        items.push({ label: 'Mark Scheduled', icon: 'calendar', action: 'schedule' });
      }
      if (order.status === 'ordered' || order.status === 'scheduled') {
        items.push({ label: 'Mark Completed', icon: 'check', action: 'complete' });
      }
      items.push({ label: 'Edit', icon: 'pencil', action: 'edit' });
      if (order.status !== 'completed' && order.status !== 'cancelled') {
        items.push({ label: 'Cancel Order', icon: 'close', action: 'cancel', danger: true });
      }
      items.push({ label: 'Delete', icon: 'trash', action: 'delete', danger: true });

      const anchor = host.querySelector(`[data-img-menu="${id}"]`);

      function apply(action) {
        if (action === 'edit') return openImagingModal(anchor, order);
        if (action === 'delete') {
          data.imaging = data.imaging.filter((o) => o.id !== id);
          return paint();
        }
        if (action === 'schedule') order.status = 'scheduled';
        else if (action === 'complete') order.status = 'completed';
        else if (action === 'cancel') order.status = 'cancelled';
        else return;

        ctx.flash(`${order.modality} order updated.`, 'success');
        paint();
      }

      openRowMenu(anchor, items.map((item) => ({ ...item, run: () => apply(item.action) })));
    }

    function saveImaging() {
      const modal = host.querySelector('#ordAddImagingModal');
      const modality = modal.querySelector('#ordImgModality')?.value;
      const bodyPartField = modal.querySelector('[data-testid="chart--img-bodypart"]');
      const bodyPart = bodyPartField?.value.trim();

      if (!modality) {
        modal.querySelector('#ordImgModality')?.setAttribute('error', 'Select a modality.');
        return;
      }
      if (!bodyPart) {
        bodyPartField?.setAttribute('error', 'Enter the body part or region.');
        return;
      }

      const priority = modal.querySelector('#ordImgPriority')?.value || 'Routine';
      const facility = modal.querySelector('#ordImgFacility')?.value || IMAGING_FACILITIES[0];
      const indication = modal.querySelector('#ordImgIndication')?.value || '';
      const provider = modal.querySelector('#ordImgProvider')?.value || PRESCRIBING_PROVIDERS[0];
      const notes = modal.querySelector('[data-testid="chart--img-notes"]')?.value.trim() || '';

      if (state.editImaging) {
        Object.assign(state.editImaging, {
          modality,
          bodyPart,
          priority,
          facility,
          indication,
          orderedBy: provider,
          notes,
        });
        ctx.flash(`${modality} order updated.`, 'success');
      } else {
        data.imaging.unshift({
          id: nextId('img'),
          modality,
          bodyPart,
          priority,
          facility,
          indication,
          notes,
          status: 'ordered',
          orderedOn: todayDdMmYyyy(),
          orderedBy: provider,
          scheduledOn: null,
          findings: '',
        });
        ctx.flash(`${modality} ordered.`, 'success');
      }

      state.editImaging = null;
      state.section = 'imaging';
      modal.close();
      paint();
    }

    /* --- Procedures: CRUD --------------------------------------------------------- */

    function openProcedureModal(trigger, editRow) {
      state.editProcedure = editRow ?? null;
      paint();
      host.querySelector('#ordAddProcedureModal')?.open(trigger);
    }

    function procedureMenu(id) {
      const order = data.procedures.find((o) => o.id === id);
      if (!order) return;

      /* The same ladder Imaging offers, because a scope moves through the same
         four states. "Mark Scheduled" is the one that carries real weight
         here: it is what says a slot exists, and until it is pressed the order
         is a decision nobody has acted on. */
      const items = [];
      if (order.status === 'ordered') {
        items.push({ label: 'Mark Scheduled', icon: 'calendar', action: 'schedule' });
      }
      if (order.status === 'ordered' || order.status === 'scheduled') {
        items.push({ label: 'Mark Completed', icon: 'check', action: 'complete' });
      }
      items.push({ label: 'Edit', icon: 'pencil', action: 'edit' });
      if (order.status !== 'completed' && order.status !== 'cancelled') {
        items.push({ label: 'Cancel Order', icon: 'close', action: 'cancel', danger: true });
      }
      items.push({ label: 'Delete', icon: 'trash', action: 'delete', danger: true });

      const anchorEl = host.querySelector(`[data-prc-menu="${id}"]`);

      function apply(action) {
        if (action === 'edit') return openProcedureModal(anchorEl, order);
        if (action === 'delete') {
          data.procedures = data.procedures.filter((o) => o.id !== id);
          return paint();
        }
        if (action === 'schedule') order.status = 'scheduled';
        else if (action === 'complete') order.status = 'completed';
        else if (action === 'cancel') order.status = 'cancelled';
        else return;

        ctx.flash(`${order.procedure} order updated.`, 'success');
        paint();
      }

      openRowMenu(anchorEl, items.map((item) => ({ ...item, run: () => apply(item.action) })));
    }

    function saveProcedure() {
      const modal = host.querySelector('#ordAddProcedureModal');
      const procedure = modal.querySelector('#ordPrcType')?.value;

      if (!procedure) {
        modal.querySelector('#ordPrcType')?.setAttribute('error', 'Select a procedure.');
        return;
      }

      const priority = modal.querySelector('#ordPrcPriority')?.value || 'Routine';
      const facility = modal.querySelector('#ordPrcFacility')?.value || PROCEDURE_FACILITIES[0];
      const indication = modal.querySelector('#ordPrcIndication')?.value || '';
      const provider = modal.querySelector('#ordPrcProvider')?.value || PRESCRIBING_PROVIDERS[0];
      const notes = modal.querySelector('[data-testid="chart--prc-notes"]')?.value.trim() || '';

      if (state.editProcedure) {
        Object.assign(state.editProcedure, {
          procedure,
          priority,
          facility,
          indication,
          orderedBy: provider,
          notes,
        });
        ctx.flash(`${procedure} order updated.`, 'success');
      } else {
        data.procedures.unshift({
          id: nextId('prc'),
          procedure,
          priority,
          facility,
          indication,
          notes,
          status: 'ordered',
          orderedOn: todayDdMmYyyy(),
          orderedBy: provider,
          scheduledOn: null,
          /* Blank: this one was typed here. Only the note fills it. */
          raisedFrom: '',
        });
        ctx.flash(`${procedure} ordered.`, 'success');
      }

      state.editProcedure = null;
      state.section = 'procedures';
      modal.close();
      paint();
    }

    /* --- Non-Visit Orders: CRUD --------------------------------------------------- */

    function openNonVisitModal(trigger, editRow) {
      state.editNonVisit = editRow ?? null;
      paint();
      host.querySelector('#ordAddNonVisitModal')?.open(trigger);
    }

    function nonVisitMenu(id) {
      const order = data.nonVisit.find((o) => o.id === id);
      if (!order) return;

      const items = [];
      if (order.status === 'open') {
        items.push({ label: 'Mark Completed', icon: 'check', action: 'complete' });
      }
      items.push({ label: 'Edit', icon: 'pencil', action: 'edit' });
      if (order.status === 'open') {
        items.push({ label: 'Cancel', icon: 'close', action: 'cancel', danger: true });
      }
      items.push({ label: 'Delete', icon: 'trash', action: 'delete', danger: true });

      const anchor = host.querySelector(`[data-nv-menu="${id}"]`);

      function apply(action) {
        if (action === 'edit') return openNonVisitModal(anchor, order);
        if (action === 'delete') {
          data.nonVisit = data.nonVisit.filter((o) => o.id !== id);
          return paint();
        }
        if (action === 'complete') order.status = 'completed';
        else if (action === 'cancel') order.status = 'cancelled';
        else return;

        ctx.flash(`${order.type} updated.`, 'success');
        paint();
      }

      openRowMenu(anchor, items.map((item) => ({ ...item, run: () => apply(item.action) })));
    }

    function saveNonVisit() {
      const modal = host.querySelector('#ordAddNonVisitModal');
      const type = modal.querySelector('#ordNvType')?.value;
      const descriptionField = modal.querySelector('[data-testid="chart--nv-description"]');
      const description = descriptionField?.value.trim();

      if (!type) {
        modal.querySelector('#ordNvType')?.setAttribute('error', 'Select an order type.');
        return;
      }
      if (!description) {
        descriptionField?.setAttribute('error', 'Describe what was ordered.');
        return;
      }

      const provider = modal.querySelector('#ordNvProvider')?.value || PRESCRIBING_PROVIDERS[0];

      if (state.editNonVisit) {
        Object.assign(state.editNonVisit, { type, description, orderedBy: provider });
        ctx.flash(`${type} updated.`, 'success');
      } else {
        data.nonVisit.unshift({
          id: nextId('nv'),
          type,
          description,
          orderedOn: todayDdMmYyyy(),
          orderedBy: provider,
          status: 'open',
        });
        ctx.flash(`${type} added.`, 'success');
      }

      state.editNonVisit = null;
      state.section = 'nonVisit';
      modal.close();
      paint();
    }

    /* --- Add Lab Test ---------------------------------------------------------- */

    function saveLabTest() {
      const modal = host.querySelector('#ordAddLabModal');
      const vendor = modal.querySelector('#ordLabVendor')?.value;
      const provider = modal.querySelector('#ordLabProvider')?.value;
      const instruction = modal.querySelector('[data-testid="chart--lab-instruction"]')?.value.trim();

      const rows = state.testRows
        .map((row) => ({
          name: modal.querySelector(`[data-test-name="${row.rowId}"]`)?.value,
          icd: modal.querySelector(`[data-test-icd="${row.rowId}"]`)?.value,
        }))
        .filter((row) => row.name);

      if (!vendor) {
        modal.querySelector('#ordLabVendor')?.setAttribute('error', 'Select a lab.');
        return;
      }
      if (!rows.length) {
        ctx.flash('Select at least one test before ordering.', 'warning');
        return;
      }

      for (const row of rows) {
        data.labs.unshift({
          id: nextId('lab'),
          name: row.name,
          status: 'ordered',
          orderedOn: todayDdMmYyyy(),
          orderedBy: provider || PRESCRIBING_PROVIDERS[0],
          receivedOn: null,
          icdCode: row.icd || ICD_CODES[0],
          vendor,
          patientInstruction: instruction || '',
          report: null,
        });
      }

      state.section = 'lab';
      state.labView = 'list'; // the new rows are at the top of it
      state.selectedLabId = data.labs[0].id;
      state.labDetailTab = 'requisition'; // nothing to report on yet
      state.testRows = [{ rowId: nextId('row'), index: 1, removable: false }];
      modal.close();
      ctx.flash(`${rows.length} lab test${rows.length > 1 ? 's' : ''} ordered.`, 'success');
      paint();
    }

    /**
     * Both functions patch the DOM directly rather than re-rendering the row
     * group from state.testRows — that array only ever held structural
     * metadata (rowId / index / removable), never what the user actually
     * picked. An innerHTML rebuild from it would recreate every <ui-select>
     * from scratch with no value, silently blanking whatever had already
     * been selected in the OTHER rows. Adding row 2 must not cost row 1 its
     * answer.
     */
    function addTestRow() {
      const container = host.querySelector('#ordTestRows');
      if (!container) return;

      const wasOnlyRow = state.testRows.length === 1;
      const newRow = { rowId: nextId('row'), index: state.testRows.length + 1, removable: true };
      state.testRows.push(newRow);
      container.insertAdjacentHTML('beforeend', testRowMarkup(newRow));

      // The first row's remove button is disabled while it's the only one;
      // enable it now that a second row exists, without touching its select.
      if (wasOnlyRow) {
        state.testRows[0].removable = true;
        container.querySelector(`[data-test-remove="${state.testRows[0].rowId}"]`)?.removeAttribute('disabled');
      }
    }

    function removeTestRow(rowId) {
      if (state.testRows.length <= 1) return;
      const container = host.querySelector('#ordTestRows');
      container?.querySelector(`[data-test-row="${rowId}"]`)?.remove();
      state.testRows = state.testRows.filter((r) => r.rowId !== rowId);

      // Renumber what remains — the badge and the test-select's testid only.
      // Never touch the selects' own markup here; that is what would erase
      // a value someone already chose.
      state.testRows.forEach((row, i) => {
        row.index = i + 1;
        row.removable = i > 0;
        const rowNode = container?.querySelector(`[data-test-row="${row.rowId}"]`);
        if (!rowNode) return;
        const badge = rowNode.querySelector('.ord__test-row-index');
        if (badge) badge.textContent = String(row.index);
        const removeBtn = rowNode.querySelector('[data-test-remove]');
        if (removeBtn) removeBtn.disabled = !row.removable;
        rowNode.querySelector('[data-test-name]')?.setAttribute('data-testid', `chart--lab-test-${row.index}`);
      });
    }

    /* --- Upload Lab Results ----------------------------------------------------- */

    function syncUploadOptionFields() {
      const modal = host.querySelector('#ordUploadModal');
      const associating =
        modal?.querySelector('#ordUploadOption')?.value === 'Associate result with existing lab order';
      const existingField = modal?.querySelector('[data-testid="chart--upload-existing"]');
      const testNameField = modal?.querySelector('[data-testid="chart--upload-test-name"]');
      if (existingField) existingField.hidden = !associating;
      if (testNameField) testNameField.hidden = associating;
    }

    function saveUploadedResult() {
      const modal = host.querySelector('#ordUploadModal');
      const associating =
        modal.querySelector('#ordUploadOption')?.value === 'Associate result with existing lab order';
      const recordedDate = modal.querySelector('[data-testid="chart--upload-date"]')?.value;
      const reviewer = modal.querySelector('#ordUploadReviewer')?.value || PRESCRIBING_PROVIDERS[0];
      const labName = modal.querySelector('#ordUploadLabName')?.value || LAB_VENDORS[0];

      const receivedOn = recordedDate ? isoToDdMmYyyy(recordedDate) : todayDdMmYyyy();
      const minimalReport = {
        number: `MAN-${Date.now().toString().slice(-6)}`,
        clinic: 'GastroEMR Gastroenterology Clinic',
        age: ctx.age ?? '—',
        gender: ctx.patient.gender || '—',
        existingConditions: '—',
        collectionDate: receivedOn,
        receivedDate: receivedOn,
        reportDate: receivedOn,
        sampleId: '—',
        panelTitle: 'Uploaded result',
        rows: [{ category: 'Result file', result: 'Uploaded — see attachment', range: '—' }],
      };

      if (associating) {
        const existingName = modal.querySelector('[data-testid="chart--upload-existing"]')?.value;
        const lab = data.labs.find((l) => l.name === existingName && l.status === 'ordered');
        if (!lab) {
          ctx.flash('Select which ordered test this result belongs to.', 'warning');
          return;
        }
        lab.status = 'received';
        lab.receivedOn = receivedOn;
        lab.report = minimalReport;
        state.selectedLabId = lab.id;
      } else {
        const testName = modal.querySelector('[data-testid="chart--upload-test-name"]')?.value.trim();
        if (!testName) {
          modal.querySelector('[data-testid="chart--upload-test-name"]')?.setAttribute(
            'error',
            'Name the test this result is for.'
          );
          return;
        }
        const newLab = {
          id: nextId('lab'),
          name: testName,
          status: 'received',
          orderedOn: receivedOn,
          orderedBy: reviewer,
          receivedOn,
          icdCode: ICD_CODES[0],
          vendor: labName,
          patientInstruction: '',
          report: minimalReport,
        };
        data.labs.unshift(newLab);
        state.selectedLabId = newLab.id;
      }

      state.section = 'lab';
      state.labView = 'list'; // the row it landed on now reads Received
      state.labDetailTab = 'report';
      modal.close();
      ctx.flash('Lab result saved.', 'success');
      paint();
    }

    /* --- Wiring --------------------------------------------------------------- */

    function onClick(event) {
      // --- Lab: navigation ---
      const labOpenBtn = event.target.closest('[data-lab-open]');
      if (labOpenBtn) {
        openLabDetail(labOpenBtn.dataset.labOpen, 'report');
        return;
      }

      if (event.target.closest('[data-lab-back]')) {
        state.labView = 'list';
        paint();
        return;
      }

      const prevBtn = event.target.closest('[data-lab-prev]');
      const nextBtn = event.target.closest('[data-lab-next]');
      if (prevBtn || nextBtn) {
        const idx = data.labs.findIndex((l) => l.id === state.selectedLabId);
        const delta = prevBtn ? -1 : 1;
        const next = data.labs[idx + delta];
        if (next) {
          state.selectedLabId = next.id;
          paint();
        }
        return;
      }

      if (event.target.closest('[data-zoom-in]')) {
        state.zoom = Math.min(200, (state.zoom ?? 100) + 10);
        paint();
        return;
      }
      if (event.target.closest('[data-zoom-out]')) {
        state.zoom = Math.max(50, (state.zoom ?? 100) - 10);
        paint();
        return;
      }
      if (event.target.closest('[data-lab-print]')) {
        document.body.classList.add('ord--printing');
        window.print();
        return;
      }
      if (event.target.closest('[data-lab-download]')) {
        ctx.flash('Downloading this report is not wired up in this prototype yet.');
        return;
      }

      // --- Add / Upload triggers ---
      if (event.target.closest('[data-testid="chart--add-lab-test"]')) {
        host.querySelector('#ordAddLabModal')?.open(event.target.closest('ui-button'));
        return;
      }
      if (event.target.closest('[data-testid="chart--upload-results"]')) {
        const modal = host.querySelector('#ordUploadModal');
        modal?.open(event.target.closest('ui-button'));
        syncUploadOptionFields();
        return;
      }
      if (event.target.closest('[data-testid="chart--add-imaging"]')) {
        openImagingModal(event.target.closest('ui-button'), null);
        return;
      }
      if (event.target.closest('[data-testid="chart--add-procedure"]')) {
        openProcedureModal(event.target.closest('ui-button'), null);
        return;
      }
      if (event.target.closest('[data-testid="chart--add-nonvisit"]')) {
        openNonVisitModal(event.target.closest('ui-button'), null);
        return;
      }

      // --- Test row add / remove ---
      if (event.target.closest('[data-test-add-row]')) {
        addTestRow();
        return;
      }
      const removeRow = event.target.closest('[data-test-remove]');
      if (removeRow) {
        removeTestRow(removeRow.dataset.testRemove);
        return;
      }

      // --- Row menus ---
      const labMenuBtn = event.target.closest('[data-lab-menu]');
      if (labMenuBtn) {
        labMenu(labMenuBtn.dataset.labMenu);
        return;
      }
      const imgMenuBtn = event.target.closest('[data-img-menu]');
      if (imgMenuBtn) {
        imagingMenu(imgMenuBtn.dataset.imgMenu);
        return;
      }
      const prcMenuBtn = event.target.closest('[data-prc-menu]');
      if (prcMenuBtn) {
        procedureMenu(prcMenuBtn.dataset.prcMenu);
        return;
      }
      const nvMenuBtn = event.target.closest('[data-nv-menu]');
      if (nvMenuBtn) {
        nonVisitMenu(nvMenuBtn.dataset.nvMenu);
        return;
      }

      // --- Modal dismiss (author-supplied Cancel buttons) ---
      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--lab-order"]')) {
        saveLabTest();
        return;
      }
      if (event.target.closest('[data-testid="chart--lab-print-close"]')) {
        ctx.flash('Would print the requisition.');
        host.querySelector('#ordAddLabModal')?.close();
        return;
      }
      if (event.target.closest('[data-testid="chart--upload-save"]')) {
        saveUploadedResult();
        return;
      }
      if (event.target.closest('[data-testid="chart--upload-print-close"]')) {
        ctx.flash('Would print a copy for the file.');
        host.querySelector('#ordUploadModal')?.close();
        return;
      }
      if (event.target.closest('[data-testid="chart--prc-save"]')) {
        saveProcedure();
        return;
      }
      if (event.target.closest('[data-testid="chart--img-save"]')) {
        saveImaging();
        return;
      }
      if (event.target.closest('[data-testid="chart--nv-save"]')) {
        saveNonVisit();
      }
    }

    /** Known tabs groups only — see the note in chart-notes.js's onTabChange
     *  for why this guard exists: 'ui-change' also fires from <ui-select> and
     *  <ui-textarea> inside these same modals, and reacting to those as if
     *  they were a tab switch would wipe the panel mid-interaction. */
    const TAB_GROUPS = new Set(['chart--orders-tabs', 'chart--lab-detail-tabs']);

    function onChange(event) {
      const tabsHost = event.target.closest('[data-testid]');
      const testid = tabsHost?.dataset.testid;

      if (testid && TAB_GROUPS.has(testid)) {
        if (testid === 'chart--orders-tabs') state.section = event.detail.value;
        else if (testid === 'chart--lab-detail-tabs') state.labDetailTab = event.detail.value;
        paint();
        return;
      }

      if (event.target.closest('[data-testid="chart--lab-search"]')) {
        state.labSearch = event.detail.value;
        applyLabRows();
        return;
      }
      if (event.target.closest('[data-testid="chart--lab-status-filter"]')) {
        state.labStatusFilter = event.detail.value;
        applyLabRows();
        return;
      }
      if (event.target.closest('#ordUploadOption')) {
        syncUploadOptionFields();
      }
    }

    /** The print-only class comes off again the moment the print dialog
     *  closes, however it closed — printed or cancelled. */
    function onAfterPrint() {
      document.body.classList.remove('ord--printing');
    }

    /* The head's own controls, on the workspace. They hand straight back to the
       panel's handlers — a click on Add Imaging Order means the same thing
       wherever the button is drawn — but only for events that started in the head band.
       Without that guard the workspace listener would hear every panel event a
       second time on its way out, and every click would count twice. */
    function fromHead(event) {
      return Boolean(event.target.closest?.('.ch__module-head'));
    }

    function onHeadClick(event) {
      if (fromHead(event)) onClick(event);
    }

    function onHeadUiClick(event) {
      if (fromHead(event)) onUiClick(event);
    }

    function onHeadChange(event) {
      if (fromHead(event)) onChange(event);
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onChange);
    // <ui-input>'s search fields fire ui-input as the user types, ui-change
    // only on blur — search has to follow every keystroke, not wait for one.
    host.addEventListener('ui-input', onChange);
    workspace?.addEventListener('click', onHeadClick);
    workspace?.addEventListener('ui-click', onHeadUiClick);
    workspace?.addEventListener('ui-change', onHeadChange);
    // The lab search is drawn in the head now, so the head needs the keystroke
    // event too — without it the field only filters when it loses focus.
    workspace?.addEventListener('ui-input', onHeadChange);
    window.addEventListener('afterprint', onAfterPrint);

    /* NO "new-referral" INTENT ANY MORE. The chart's banner used to carry a
       Refer Out button that landed here with the Add Referral form open; both
       that button and this section have gone. See the note above where the
       Referrals block used to be. */
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onChange);
      host.removeEventListener('ui-input', onChange);
      workspace?.removeEventListener('click', onHeadClick);
      workspace?.removeEventListener('ui-click', onHeadUiClick);
      workspace?.removeEventListener('ui-change', onHeadChange);
      workspace?.removeEventListener('ui-input', onHeadChange);
      window.removeEventListener('afterprint', onAfterPrint);
      closeRowMenu();
      document.body.classList.remove('ord--printing');
    };
  },
});
