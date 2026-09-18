/**
 * Settings ▸ Master — the practice's own reference lists.
 *
 * Eight lists (ICD-10, procedures, payers, instruments, clinicians, …) that behave
 * identically: search, add, edit, activate/deactivate, delete. So there is
 * ONE engine here and a DEFINITION per list — MASTERS below. A list is its
 * columns plus its form fields; nothing else about it is special.
 *
 * Adding the next master, or changing one when its design lands, is an edit to
 * MASTERS and a <ui-tab> + panel in master.html. No new behaviour to write.
 */
import {
  ICD_CODES,
  CPT_CODES,
  NDC_UNITS,
  currentFee,
  currentSchedule,
  medicationTotal,
  isMedicationCode,
  PAYERS,
  PAYER_TYPES,
  INSTRUMENTS,
  CLINICIANS,
  CREDENTIALS,
  PHARMACIES,
  PHARMACY_TYPES,
  RECALL_TYPES,
  RECALL_ACTIVITIES,
  RECALL_TIMEFRAME_UNITS,
  DATA_IMPORTS,
  IMPORT_STATUSES,
  IMPORT_ENTITIES,
} from '../../data/master.js';
import { createPager } from '../lib/pagination.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { notify } from '../lib/toast.js';

/*
 * Rows per page.
 *
 * Fifteen, which is the shared default in js/lib/pagination.js rather than a
 * number this screen picked. Ten was set when a settings list was a dozen rows
 * long and paging was mostly hypothetical; now that every one of these lists
 * runs past fifty, ten meant a full-height table card showing ten rows and
 * four hundred pixels of nothing under them, and six pages of a list nobody
 * wanted to page through. Fifteen fills the card on a laptop and the rows-per-
 * page control is right there for anyone who wants more.
 */
const PAGE_SIZE = 15;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ===================== THE LISTS =====================
   noun          what one row is called, in the Add button and dialog heading
   primary       the field that names a row — first column, and what the
                 delete confirmation quotes back
   primaryLabel  that column's header text
   unique        a value two rows may not share; blank means duplicates are fine
   search        fields the search box looks in
   columns       everything between the name and the status pill
   sections      the Add / Edit form: [{ heading?, fields: [...] }, ...] — the
                 fields in one entry sit side by side in a single row; repeat
                 the same heading string on the next entry to add another row
                 under it without repeating the heading itself
   derive        optional (values) => extra fields to merge in on save, for a
                 value computed from others rather than typed directly — a
                 clinician's composed "Last, First, Title" name, say
   modalSize     ui-modal size for this list's Add/Edit dialog (default 'md')
   bulk          optional { columns: [key…] } — the order a transfer file's
                 columns come in, when that should differ from the order the
                 Add form asks for them. Every list can be imported and
                 exported; see columnsFor().
   ==================================================== */

/**
 * A referring clinician has no single "name" field to type — it is composed
 * from the parts on save, the way a directory actually reads:
 *   Abbasi, Sadeea, MD          (no middle name)
 *   Adamson, Joseph ROLAND      (middle name, no title)
 */
function formatClinicianName({ lastName, firstName, middleName, credential, suffix }) {
  const middle = middleName ? ` ${middleName}` : '';
  const title = credential ? `, ${credential}` : '';
  const suf = suffix ? ` ${suffix}` : '';
  return `${lastName}, ${firstName}${middle}${title}${suf}`;
}

/** Clinic name plus its fax, stacked — "N/A" is what the source directory
 *  itself writes for a clinician with no clinic on file, not a placeholder
 *  invented here. */
function clinicCell(row) {
  const clinic = row.clinicName?.trim();
  const label = clinic ? esc(clinic) : '<span class="mst__muted">N/A</span>';
  return row.fax
    ? `${label}<br><span class="mst__muted">Fax: ${esc(row.fax)}</span>`
    : label;
}

function phoneCell(row) {
  return row.phone ? `Phone: ${esc(row.phone)}` : '';
}

/** Most of a referring directory arrives with no NPI, and a blank cell says
 *  that better than an empty one — it is a fact worth noticing, because a
 *  claim naming this clinician will need one. */
function npiCell(row) {
  return row.npi
    ? `<code class="mst__npi">${esc(row.npi)}</code>`
    : '<span class="mst__muted">Not on file</span>';
}

function faxCell(row) {
  return row.fax ? `Fax: ${esc(row.fax)}` : '';
}

/** "2022-12-01" with a calendar glyph, as the staging register shows it. */
function dateInServiceCell(row) {
  if (!row.dateInService) return '<span class="mst__muted">—</span>';
  return `<span class="mst__repair-when">
    <svg class="ui-icon" aria-hidden="true" style="width:var(--icon-size-sm);height:var(--icon-size-sm)"><use href="#i-calendar"></use></svg>
    ${esc(row.dateInService)}
  </span>`;
}

/**
 * The repair count, as the way in to the history.
 *
 * A scope with repairs behind it is tinted, because "has this one been in the
 * shop?" is the question the column exists to answer at a glance. A scope
 * currently away is said so in words — it is not on the shelf, and a register
 * that does not say that gets it booked.
 */
function repairsCell(row) {
  const repairs = row.repairs ?? [];
  const out = repairs.some((r) => !r.returnedOn);
  return `<button type="button"
    class="mst__repair-btn${repairs.length ? ' mst__repair-btn--some' : ''}"
    data-repairs="${row.id}"
    aria-label="Repair history for ${esc(row.name)} — ${repairs.length} recorded">
    <svg class="ui-icon" aria-hidden="true"><use href="#i-settings"></use></svg>
    ${repairs.length}
  </button>${out ? '<span class="mst__repair-open">Out for repair</span>' : ''}`;
}

/** Street, then suite, then city/state/zip — each part only if it's there. */
function addressCell(row) {
  const line1 = row.addressLine1?.trim();
  if (!line1) return '';
  const line2 = row.addressLine2?.trim();
  const cityLine = [row.city, row.state, row.zip].filter(Boolean).join(', ');
  return [esc(line1), line2 && esc(line2), cityLine && esc(cityLine)]
    .filter(Boolean)
    .join('<br>');
}

/* --- Medication codes ------------------------------------------------------
   Two columns that are blank for most of the list, because most procedure
   codes are not drugs. Blank rather than zero: a code with no NDC has no unit
   price, and "0.00" in a Fee column is a claim that it is free. --------------*/

/**
 * The NDC of the product this code bills, and under it the quantity and unit
 * of measure the claim has to state alongside it.
 *
 * All three travel together or none of them means anything: "57894-030-01" is
 * which product, and "1 UN" is how much of it — a payer rejects a drug line
 * carrying one without the other. Set in code type so a digit out of place is
 * visible. It hangs off the code and not off any modifier — see the note above
 * CPT_CODES in data/master.js.
 */
function ndcCell(row) {
  if (!row.ndc) return '<span class="mst__muted">—</span>';
  const measure = [row.ndcQty, row.ndcUnit].filter((part) => part !== '' && part != null);
  const under = measure.length
    ? `<br><span class="mst__muted">${esc(measure.join(' '))}</span>`
    : '';
  return `<code class="mst__npi">${esc(row.ndc)}</code>${under}`;
}

const unitsCell = (row) =>
  isMedicationCode(row) ? esc(row.units) : '<span class="mst__muted">—</span>';

/** The modifiers this code goes out with by default, in the order a claim
 *  line carries them — hyphenated the way a coder writes them, so "26" beside
 *  a two-digit fee or unit count cannot be mistaken for a number. */
const modifierCell = (row) =>
  row.modifiers?.length
    ? row.modifiers.map((mod) => `<code class="mst__mod">-${esc(mod)}</code>`).join(' ')
    : '<span class="mst__muted">—</span>';

/**
 * What the code charges today, and what that figure is doing.
 *
 * EVERY code has a fee — a charge master with a blank price is not one — so
 * this column is never the dash the medication columns beside it are. What
 * changes is the second line, because the professional figure means two
 * different things depending on what kind of code this is:
 *
 *   a drug        the price of ONE UNIT, so the line under it does the
 *                 multiplication that reaches the claim — "we charge fifty
 *                 cents a unit" only means something beside "and a dose of
 *                 this is fifty of them", and showing the product rather than
 *                 only its inputs is what makes a fee typed into the wrong
 *                 column visible from the table
 *   a procedure   the whole physician fee, so the line under it is the ASC's
 *                 facility fee instead — the other half of what the same
 *                 procedure bills, and the number nobody remembers is separate
 *
 * A code priced only from a future date shows no current fee rather than a
 * zero: it is on the schedule, it is just not being charged yet.
 */
function feeCell(row) {
  const priced = currentFee(row);
  if (priced === null) return '<span class="mst__muted">Not priced</span>';
  const fee = `$${money(priced)}`;

  if (isMedicationCode(row)) {
    const total = medicationTotal(row);
    if (total === null) return fee;
    return `${fee}<br><span class="mst__muted">× ${esc(row.units)} = $${money(total)}</span>`;
  }

  const facility = currentSchedule(row)?.facility;
  return facility == null
    ? fee
    : `${fee}<br><span class="mst__muted">Facility $${money(facility)}</span>`;
}

/** Thousands separated, cents always shown — a charge master is read down a
 *  column, and "1310" beside "985" is a comparison somebody has to do twice. */
const money = (value) =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "1 year", "3 months", "8 weeks" — singular only when the value is
 * literally 1, matching how the source recall list itself writes them.
 */
function formatRecallTimeframe({ timeframeValue, timeframeUnit }) {
  const n = Number(timeframeValue);
  const unit = timeframeUnit.toLowerCase();
  const label = n === 1 ? unit.replace(/s$/, '') : unit;
  return `${n} ${label}`;
}

/* ===================== DATA IMPORT =====================
   Not a master list — a log of what has been loaded into them. It sits first
   because an import is the one action on this screen that changes hundreds of
   rows at once, and when a list looks wrong the first question is "what did we
   last load, and did it pass?" ==================================== */

function importStatusCell(row) {
  const status = IMPORT_STATUSES[row.status] ?? IMPORT_STATUSES.processing;
  return `<span class="mst__import-status">
      <ui-badge status="${status.tone}" size="sm">${esc(status.label)}</ui-badge>
      ${row.note ? `<span class="mst__muted">${esc(row.note)}</span>` : ''}
    </span>`;
}

const IMPORT_MASTER = {
  id: 'import',
  noun: 'Import',
  rows: DATA_IMPORTS,
  primary: 'startedAt',
  primaryLabel: 'Import Initiated',
  primaryTruncate: false,
  unique: '',
  search: ['startedAt', 'entity', 'fileName', 'user'],
  empty: 'Nothing has been imported yet.',
  // No Add and no row menu: an import is created by uploading a file, and a
  // log you can edit is not a log.
  readOnly: true,
  columns: [
    { key: 'entity', label: 'Entity', sortable: true },
    {
      key: 'fileName',
      label: 'File Name',
      wrap: true,
      render: (row) =>
        `<button type="button" class="mst__file-link" data-import-file="${row.id}">${esc(
          row.fileName
        )}</button>`,
    },
    { key: 'user', label: 'User Name', sortable: true },
    { key: 'records', label: 'Total Records', numeric: true, sortable: true },
    { key: 'status', label: 'Status', sortable: true, narrow: true, render: importStatusCell },
  ],
  sections: [],
};

/*
 * `importOnly` — this list is LOADED, not typed.
 *
 * ICD-10 is not a list a practice authors. It arrives whole from the code set,
 * the practice already holds it in the system it is coming off, and once a
 * year a revision replaces the ones that changed. Typing it in one at a time
 * is thousands of rows of transcription to arrive at a copy of a file somebody
 * already has, and every keystroke is a chance to put a digit in the wrong
 * place on a code that decides what a claim pays. There is also nothing local
 * to add: K21.9 means reflux in every practice in the country.
 *
 * So that tab offers Upload Data where every other tab offers Add, and the
 * dialog opens with the entity already chosen — the tab you are standing on is
 * the answer to the first question it asks.
 *
 * CPT IS THE HALF-CASE, and carries `uploadable` instead. Its codes arrive as
 * a file the same way, but what the practice bills WITH them — the price, the
 * room, the vial — is local and is written here a code at a time. So it offers
 * both, Add first. See the note on the CPT entry itself.
 *
 * EDITING A ROW IS UNTOUCHED. "Only update codes that change annually" is
 * exactly what the row menu is for, and the upload path handles the bulk case
 * of the same thing: a row whose key already exists updates it rather than
 * adding a second copy.
 */
const MASTERS = [
  IMPORT_MASTER,
  {
    id: 'icd',
    noun: 'ICD-10 Code',
    rows: ICD_CODES,
    primary: 'code',
    primaryLabel: 'ICD-10 Code',
    unique: 'code',
    search: ['code', 'description'],
    empty: 'No ICD-10 codes match.',
    columns: [{ key: 'description', label: 'Description', truncate: true }],
    bulk: { columns: ['code', 'description'] },
    // See importOnly's note above MASTERS.
    importOnly: true,
    sections: [
      { fields: [{ key: 'code', label: 'ICD-10 Code', placeholder: 'Add ICD-10 Code', required: true }] },
      {
        fields: [
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 5,
            placeholder: 'Enter Description...',
            required: true,
          },
        ],
      },
    ],
  },

  {
    id: 'cpt',
    /* THE TAB SAYS PROCEDURE, THE FIELD STILL SAYS CPT CODE.
       What the list holds is the practice's procedures; CPT is the code set
       they are identified BY, and the column asking for one is asking for a
       CPT code specifically. Naming the list after its coding system was
       naming it after its filing cabinet — and it stopped being true the
       moment the list started carrying prices, NDCs and modifiers, none of
       which the AMA publishes. */
    noun: 'Procedure',
    rows: CPT_CODES,
    primary: 'code',
    primaryLabel: 'CPT Code',
    unique: 'code',
    // An NDC is searched for the same way a code is — a pharmacy query arrives
    // as the number on the vial, not as the J-code somebody billed it under.
    // A modifier is searched the way a code is: "which of ours go out with
    // QZ on them" is a question somebody asks of the whole list at once.
    search: ['code', 'description', 'ndc', 'modifiers'],
    empty: 'No procedures match.',
    // Wider than the default: the fee schedule is four columns, and three of
    // them are money. Squeezed into a medium dialog they stop being readable
    // side by side, which is the whole point of showing them side by side.
    modalSize: 'lg',
    columns: [
      { key: 'modifiers', label: 'Modifier', narrow: true, render: modifierCell },
      { key: 'description', label: 'Description', truncate: true },
      { key: 'ndc', label: 'NDC', narrow: true, render: ndcCell },
      { key: 'units', label: 'Base Units', numeric: true, narrow: true, render: unitsCell },
      { key: 'fees', label: 'Fee', numeric: true, narrow: true, render: feeCell },
    ],
    /*
     * THIS LIST IS BOTH LOADED AND AUTHORED.
     *
     * ICD-10 next door is only ever loaded: a diagnosis code means the same
     * thing in every practice in the country, so there is nothing to author —
     * the file is the list. A CPT code is not like that. The code and its AMA
     * description arrive from the code set the same way, but everything the
     * practice bills WITH is local: what it charges, whose room it charges
     * for, which vial it dispenses. That part is written here, one code at a
     * time, by the person who priced it.
     *
     * So the tab carries both doors. Add is the primary one, because a new
     * J-code the infusion suite has just started giving is a Tuesday and does
     * not wait for an annual file. Upload Data sits beside it in the transfer
     * slot, still opening with CPT already chosen — see paintTransferButton().
     */
    uploadable: true,
    /* A transfer file carries what a file can carry. The fee SCHEDULE cannot
       go in a column — it is dated history, several rows deep per code, and
       flattening it to one number would import today's price over the record
       of what was charged last year. Codes and their identity move by file;
       prices are set on the screen that shows what they were. */
    bulk: {
      columns: ['code', 'modifiers', 'description', 'ndc', 'ndcQty', 'ndcUnit', 'units'],
    },
    /*
     * Numbers come back off the form as strings, and a string times a string
     * is not a price. Coerced here rather than at every point of use, so an
     * edited row is the same shape as a seeded one — see medicationTotal() in
     * data/master.js, which would otherwise be the only thing standing between
     * "50" and 50.
     *
     * A code saved with the medication fields left empty keeps them empty
     * rather than gaining a zero: it is not a drug, and it must not read as
     * one that costs nothing.
     *
     * Status is a word on the form and a boolean on the row. The form asks it
     * the way the rest of the screen shows it — a pill that says Active — and
     * `status` itself is dropped afterwards, because a second copy of that
     * fact is a second thing that can disagree with the first.
     */
    derive: ({ units, ndcQty, status, modifiers }) => ({
      units: units === '' ? '' : Number(units),
      ndcQty: ndcQty === '' ? '' : Number(ndcQty),
      /* The form hands back an array of four boxes already; a transfer file
         hands back whatever somebody typed in one cell — "26", "26 59",
         "26,59". Both end up as the same list, because everything downstream
         asks the row how many modifiers it has, not where it came from. */
      modifiers: typeof modifiers === 'string' ? splitModifiers(modifiers) : modifiers,
      /* Only when the form actually asked. A transfer file has no Status
         column, so `status` arrives undefined on the import path — and
         answering it anyway would reactivate every retired code in the list
         the next time a revision was loaded over it. */
      ...(status === undefined ? {} : { active: status !== 'Inactive', status: undefined }),
    }),
    sections: [
      { fields: [{ key: 'code', label: 'CPT Code', placeholder: 'Add CPT Code', required: true }] },
      /*
       * FOUR BOXES, DIRECTLY UNDER THE CODE, BECAUSE THAT IS ONE ANSWER.
       *
       * A modifier says something about how the service was delivered — which
       * side, whose component, whether it was repeated — and a claim line may
       * carry up to four of them, in order, because the order is what tells a
       * payer which qualifies which. So it is four boxes rather than one text
       * field somebody separates by hand, and it sits under the code because
       * "45385-33" is one thing a coder reads, not two.
       *
       * These are the code's DEFAULTS: what it goes out with unless a
       * particular claim says otherwise. The pathology and imaging reads carry
       * 26 because this practice bills the professional component and not the
       * equipment; the anesthesia codes carry QZ because sedation here is a
       * CRNA's job without medical direction.
       */
      { fields: [{ key: 'modifiers', label: 'Modifier', type: 'modifiers' }] },
      {
        fields: [
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 4,
            placeholder: 'Enter Description...',
            required: true,
          },
        ],
      },
      /* Whether the practice bills this code at all. The row menu has always
         been able to answer it; asking it on the form too is what lets a code
         be ADDED already retired — a revision that supersedes one the practice
         still has claims out on, which it needs on the list to look up and
         must not have on the list to pick. */
      {
        fields: [
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: ['Active', 'Inactive'],
            required: true,
            // A code being added is one the practice means to bill, so the
            // form opens on Active rather than on an empty box somebody must
            // answer before they are allowed to save something obvious.
            from: (row) => (row && !row.active ? 'Inactive' : 'Active'),
          },
        ],
      },
      /*
       * THE MEDICATION FIELDS.
       *
       * Optional, because most codes are not drugs, and grouped under a
       * heading so they read as one answer to one question rather than as
       * more boxes an ordinary code has to be dragged past.
       *
       * The three parts of the NDC sit on one row because a payer will not
       * take them apart: the number says which product, the quantity and unit
       * say how much of it was given out of that package, and a drug line
       * carrying one without the others is rejected. Base Units is the
       * separate question of how many units of the CODE a normal dose is —
       * what the claim multiplies the fee by.
       */
      {
        heading: 'Medication',
        fields: [
          { key: 'ndc', label: 'NDC Number', placeholder: 'e.g. 57894-030-01' },
          { key: 'ndcQty', label: 'Quantity', type: 'number', placeholder: 'e.g. 20' },
          {
            key: 'ndcUnit',
            label: 'Unit of Measure',
            type: 'select',
            optionRows: NDC_UNITS.map((unit) => ({
              value: unit.code,
              label: `${unit.code} — ${unit.name}`,
            })),
            placeholder: 'Select',
          },
        ],
      },
      {
        heading: 'Medication',
        fields: [
          {
            key: 'units',
            label: 'Base Units',
            type: 'number',
            placeholder: 'Enter Base Units',
            validate: (value) =>
              Number(value) > 0 ? '' : 'Base Units must be a number greater than zero',
          },
        ],
      },
      {
        heading: 'Fee Schedule',
        fields: [
          {
            key: 'fees',
            label: 'Fee Schedule',
            type: 'fees',
            hint: 'A new price is a new dated row. The one it replaces stays, because a claim is priced by the date of service.',
          },
        ],
      },
    ],
  },

  {
    id: 'payer',
    noun: 'Payer',
    rows: PAYERS,
    primary: 'name',
    primaryLabel: 'Payer Name',
    unique: 'payerId',
    search: ['name', 'payerId', 'payerType'],
    empty: 'No payers match.',
    columns: [
      { key: 'payerId', label: 'Payer ID' },
      { key: 'payerType', label: 'Payer Type' },
    ],
    sections: [
      { fields: [{ key: 'name', label: 'Payer Name', placeholder: 'Enter Payer Name', required: true }] },
      { fields: [{ key: 'payerId', label: 'Payer ID', placeholder: 'Enter Payer ID', required: true }] },
      {
        fields: [
          {
            key: 'payerType',
            label: 'Payer Type',
            type: 'select',
            options: PAYER_TYPES,
            placeholder: 'Select Payer Type',
            required: true,
          },
        ],
      },
    ],
  },

  {
    id: 'instrument',
    noun: 'Instrument',
    rows: INSTRUMENTS,
    primary: 'name',
    primaryLabel: 'Name',
    primaryTruncate: false,
    // Two scopes may share a model name; a serial number is the one thing a
    // reprocessing log can never have twice.
    unique: 'serial',
    search: ['name', 'model', 'manufacturer', 'serial'],
    empty: 'No instruments match.',
    /* The columns a download carries and an import reads back. This is the
       spreadsheet the unit already keeps, so it is also the one the Download
       button hands over and the one Import expects back — see the transfer
       buttons on this tab. */
    bulk: { columns: ['name', 'dateInService', 'serial', 'manufacturer', 'model'] },
    /* Both directions are offered on this tab rather than only from Data
       Import — see paintTransferButton() for why the scope register is the one
       list that earns its own pair of buttons. */
    transferable: true,
    // The staging register's columns, in its order: what it is, how long it
    // has been in service, its serial, who made it, and what has been done to
    // it.
    columns: [
      { key: 'dateInService', label: 'Date in Service', render: dateInServiceCell, sortable: true },
      { key: 'serial', label: 'Serial Number', render: (row) => `<code>${esc(row.serial)}</code>` },
      { key: 'manufacturer', label: 'Manufacturer', sortable: true },
      { key: 'repairs', label: 'Repairs', render: repairsCell },
    ],
    sections: [
      {
        /* NO SECTION HEADING. "Basic Information" sat over the first two
           fields and over nothing else — the serial, manufacturer and model
           rows below it carry no heading of their own, so the label was not
           dividing the form into parts, only announcing that a five-field
           dialog had started. The dialog title already says that. */
        fields: [
          { key: 'name', label: 'Name', placeholder: 'Instrument name', required: true },
          { key: 'dateInService', label: 'Date in Service', type: 'date' },
        ],
      },
      {
        fields: [
          { key: 'serial', label: 'Serial Number', placeholder: 'Serial number', required: true },
          { key: 'manufacturer', label: 'Manufacturer', placeholder: 'Manufacturer' },
        ],
      },
      { fields: [{ key: 'model', label: 'Model', placeholder: 'Model' }] },
      /* NO TYPE FIELD. A required dropdown of nine kinds stood here and every
         one of its answers was already written in the Name and the Model
         above it — see the note above INSTRUMENTS in data/master.js. */
    ],
  },

  {
    id: 'clinician',
    noun: 'Clinician',
    rows: CLINICIANS,
    primary: 'name',
    primaryLabel: 'Name',
    primaryTruncate: false,
    /*
     * The NPI is the business key when there is one.
     *
     * Two referring clinicians can legitimately share a name, so the name
     * cannot be unique — but an NPI is issued to exactly one clinician, so a
     * second record carrying the same one is a duplicate every time. Records
     * without an NPI are still allowed: most of a referring directory arrives
     * without one, and refusing them would mean refusing the directory.
     */
    unique: 'npi',
    search: ['name', 'npi', 'clinicName', 'phone', 'fax', 'city', 'state', 'zip'],
    empty: 'No clinicians match.',
    modalSize: 'lg',
    bulk: {
      columns: ['lastName', 'firstName', 'npi', 'clinicName', 'phone', 'fax', 'city', 'state', 'zip'],
    },
    columns: [
      { key: 'npi', label: 'NPI', render: npiCell },
      { key: 'clinicName', label: 'Clinic', wrap: true, render: clinicCell },
      { key: 'phone', label: 'Phone', render: phoneCell },
      { key: 'address', label: 'Address', wrap: true, render: addressCell },
    ],
    derive: (values) => ({ name: formatClinicianName(values) }),
    sections: [
      {
        heading: 'Identifier',
        fields: [
          {
            key: 'npi',
            label: 'NPI Number',
            placeholder: '10-digit NPI',
            // Ten digits, nothing else. An NPI with a typo in it is worse
            // than a blank one: a claim goes out and comes back denied.
            validate: (value) =>
              !value || /^\d{10}$/.test(value.trim())
                ? ''
                : 'An NPI is exactly 10 digits.',
            action: { label: 'Look up', testid: 'mst--npi-lookup' },
          },
        ],
      },
      {
        heading: 'Name Information',
        fields: [
          { key: 'lastName', label: 'Last Name', placeholder: 'Last name', required: true },
          { key: 'firstName', label: 'First Name', placeholder: 'First name', required: true },
          { key: 'middleName', label: 'Middle Name', placeholder: 'Middle name' },
          {
            key: 'credential',
            label: 'Title',
            type: 'select',
            options: CREDENTIALS,
            placeholder: 'Select...',
          },
          { key: 'suffix', label: 'Suffix', placeholder: 'Jr., Sr., III' },
        ],
      },
      {
        heading: 'Clinic Information',
        fields: [{ key: 'clinicName', label: 'Clinic Name', placeholder: 'Clinic or practice name' }],
      },
      {
        heading: 'Address Information',
        fields: [{ key: 'addressLine1', label: 'Address Line 1', placeholder: 'Street address' }],
      },
      { fields: [{ key: 'addressLine2', label: 'Address Line 2', placeholder: 'Suite, building, etc.' }] },
      {
        fields: [
          { key: 'city', label: 'City', placeholder: 'City' },
          { key: 'state', label: 'State', placeholder: 'State' },
          { key: 'zip', label: 'ZIP', placeholder: 'ZIP' },
        ],
      },
      {
        heading: 'Contact Information',
        fields: [
          { key: 'phone', label: 'Phone Number', placeholder: '(555) 555-5555' },
          { key: 'fax', label: 'Fax Number', placeholder: '(555) 555-5555' },
        ],
      },
    ],
  },

  {
    id: 'pharmacy',
    noun: 'Pharmacy',
    rows: PHARMACIES,
    primary: 'name',
    primaryLabel: 'Pharmacy Name',
    primaryTruncate: false,
    // A chain shares one name across many locations, so the name alone
    // cannot be the business key — same reasoning as the clinician directory.
    unique: '',
    search: ['name', 'contactPerson', 'type', 'phone', 'fax', 'city', 'state', 'zip'],
    empty: 'No pharmacies match.',
    modalSize: 'lg',
    columns: [
      { key: 'type', label: 'Type' },
      { key: 'phone', label: 'Phone', render: phoneCell },
      { key: 'fax', label: 'Fax', render: faxCell },
      { key: 'address', label: 'Address', wrap: true, render: addressCell },
    ],
    sections: [
      {
        heading: 'Pharmacy Information',
        fields: [
          { key: 'name', label: 'Pharmacy Name', placeholder: 'Enter Pharmacy Name', required: true },
          { key: 'contactPerson', label: 'Contact Person', placeholder: 'Contact person' },
          { key: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
          {
            key: 'open24h',
            label: 'Open 24 Hours',
            type: 'select',
            options: ['Yes', 'No'],
            placeholder: 'Select...',
          },
        ],
      },
      {
        heading: 'Address Information',
        fields: [{ key: 'addressLine1', label: 'Address Line 1', placeholder: 'Street address' }],
      },
      { fields: [{ key: 'addressLine2', label: 'Address Line 2', placeholder: 'Suite, building, etc.' }] },
      {
        fields: [
          { key: 'city', label: 'City', placeholder: 'City' },
          { key: 'state', label: 'State', placeholder: 'State' },
          { key: 'zip', label: 'ZIP', placeholder: 'ZIP' },
        ],
      },
      {
        heading: 'Contact Information',
        fields: [
          { key: 'phone', label: 'Phone Number', placeholder: '(555) 555-5555' },
          { key: 'fax', label: 'Fax Number', placeholder: '(555) 555-5555' },
        ],
      },
      {
        heading: 'Classification',
        fields: [
          {
            key: 'type',
            label: 'Pharmacy Type',
            type: 'select',
            options: PHARMACY_TYPES,
            placeholder: 'Select Type',
          },
        ],
      },
    ],
  },

  {
    id: 'recall',
    noun: 'Recall Type',
    rows: RECALL_TYPES,
    primary: 'name',
    primaryLabel: 'Recall Type',
    // Two entries both called "Colonoscopy 1 Year" would be indistinguishable
    // on every worklist that recall type feeds, so the name is the key here —
    // unlike the clinician and pharmacy directories, which have no equivalent.
    unique: 'name',
    search: ['name', 'description', 'activity', 'timeframe'],
    empty: 'No recall types match.',
    columns: [{ key: 'timeframe', label: 'Timeframe' }],
    derive: (values) => ({ timeframe: formatRecallTimeframe(values) }),
    sections: [
      { fields: [{ key: 'name', label: 'Name', placeholder: 'Enter Name', required: true }] },
      { fields: [{ key: 'description', label: 'Description', placeholder: 'Enter Description' }] },
      {
        fields: [
          {
            key: 'activity',
            label: 'Activity',
            type: 'select',
            options: RECALL_ACTIVITIES,
            placeholder: 'Select Activity',
            required: true,
          },
        ],
      },
      {
        fields: [
          {
            key: 'timeframeValue',
            label: 'Timeframe',
            type: 'number',
            placeholder: '1',
            required: true,
          },
          {
            key: 'timeframeUnit',
            label: 'Unit',
            type: 'select',
            options: RECALL_TIMEFRAME_UNITS,
            placeholder: 'Select...',
            required: true,
          },
        ],
      },
    ],
  },
];

const BY_ID = Object.fromEntries(MASTERS.map((master) => [master.id, master]));

let active = MASTERS[0];

/**
 * The columns a transfer file carries for a list, in order.
 *
 * Defaults to the Add form's own fields: anything that can be typed into the
 * form can be carried in a file, and deriving it means a field added to a list
 * is exported and imported without anyone remembering to update a second list
 * of column names. `bulk.columns` overrides the order where the file's own
 * convention differs — a clinician directory arrives surname-first.
 */
function columnsFor(master) {
  return (
    master.bulk?.columns ??
    master.sections.flatMap((section) => section.fields.map((field) => field.key))
  );
}

/** What the Data Import screen calls this list. */
function entityLabel(master) {
  return IMPORT_ENTITIES.find((entity) => entity.id === master.id)?.label ?? master.noun;
}

/* ===================== BOOT ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  MASTERS.forEach(initMaster);

  const tabs = document.querySelector('[data-testid="mst--tabs"]');
  const search = document.getElementById('masterSearch');
  const addSlot = document.getElementById('masterAddSlot');
  const transferSlot = document.getElementById('masterTransferSlot');

  // ?tab=payer lets the Settings hub link straight to one list rather than
  // dropping people on ICD-10 and making them find the rest.
  const requested = new URLSearchParams(window.location.search).get('tab');
  if (BY_ID[requested]) tabs?.setAttribute('selected', requested);
  active = BY_ID[tabs?.getAttribute('selected')] ?? MASTERS[0];

  tabs?.addEventListener('ui-change', (event) => {
    active = BY_ID[event.detail.value] ?? active;
    closeRowMenu();
    // Each list keeps its own search term, so switching away and back does not
    // silently drop a filter the user is still reading results through.
    search?.setAttribute('value', active.query);
    paintAddButton();
    paintTransferButton();
  });

  search?.addEventListener('ui-input', (event) => {
    active.query = event.detail.value;
    active.page = 1;
    paint(active);
  });

  // The button is rebuilt rather than relabelled — <ui-button> reads its label
  // from its own text once, at upgrade. One delegated listener on the slot
  // survives every rebuild.
  addSlot?.addEventListener('ui-click', () => {
    if (active.readOnly || active.importOnly) {
      // From a code tab the entity is not a question: it is the tab.
      openUploadData(addSlot.querySelector('ui-button'), active.importOnly ? active : null);
      return;
    }
    openForm(active, null, addSlot.querySelector('ui-button'));
  });
  paintAddButton();

  transferSlot?.addEventListener('ui-click', (event) => {
    /* Two buttons share this slot on the instrument register, so the handler
       asks which one was pressed rather than assuming the only one there. */
    if (event.target.closest('[data-testid="mst--import"]')) {
      openUploadData(transferSlot.querySelector('[data-testid="mst--import"]'), active);
      return;
    }
    // CPT's Upload Data, which shares this slot with Add — see
    // paintTransferButton(). The entity is the tab, not a question.
    if (event.target.closest('[data-testid="mst--upload-data"]')) {
      openUploadData(transferSlot.querySelector('[data-testid="mst--upload-data"]'), active);
      return;
    }
    openExportData(
      transferSlot.querySelector('[data-testid="mst--export"]'),
      active.transferable ? active : null
    );
  });
  paintTransferButton();

  initDeleteDialog();
  initRepairDialog();
  initUploadDialog();
  initExportDialog();
});

function paintAddButton() {
  const slot = document.getElementById('masterAddSlot');
  if (!slot) return;

  /* The import log's primary action is loading a file, not adding a row by
     hand — so the same slot carries Upload Data there instead of Add. ICD-10
     gets the same button for the same reason: a code set is loaded, not
     authored one row at a time. CPT is loaded AND authored, so it keeps Add
     here and takes its Upload Data from the transfer slot beside it. See
     importOnly above MASTERS. */
  slot.innerHTML =
    active.readOnly || active.importOnly
      ? `<ui-button variant="primary" icon="upload" data-testid="mst--upload-data"
          >Upload Data</ui-button>`
      : `<ui-button variant="primary" icon="plus"
          data-testid="mst--add">Add ${esc(active.noun)}</ui-button>`;
}

/**
 * Export lives on Data Import, and only there.
 *
 * Moving data in or out is one job with two directions, and it used to be
 * seven pairs of buttons — one per list, each only appearing on the lists that
 * happened to declare a CSV shape. A person exporting the payer list and
 * loading a new clinician directory had to visit two tabs to do one task, and
 * the lists that offered neither looked like lists that could not be
 * transferred at all. Both directions now name their own entity, so the tab
 * you are standing on stops being the thing that decides what you can move.
 */
function paintTransferButton() {
  const slot = document.getElementById('masterTransferSlot');
  if (!slot) return;

  /* THE INSTRUMENT REGISTER CARRIES BOTH DIRECTIONS ON ITS OWN TAB.
     Everything else moves data from Data Import, which is the right home for a
     job that names its own entity — but the scope register is the one list a
     unit already keeps in a spreadsheet. The biomed engineer's copy IS the
     source: it comes back from the vendor with new serials on it, and it goes
     out to the infection-control audit. Sending that person to another tab to
     name a list they are already standing on is a step for the product's
     benefit, not theirs.

     Downloads and reads back CSV, which is what a spreadsheet opens and what
     Save As offers — this prototype has no .xlsx writer, and a file Excel can
     both open and produce is what the round trip actually needs. */
  if (active.transferable) {
    slot.innerHTML = `
      <ui-button variant="outline" icon="download" data-testid="mst--export">Download</ui-button>
      <ui-button variant="outline" icon="upload" data-testid="mst--import">Import</ui-button>`;
    return;
  }

  /* A LIST THAT IS BOTH LOADED AND AUTHORED KEEPS BOTH DOORS.
     CPT is the one: its codes arrive as a file the way ICD-10's do, but what
     the practice bills with them is written here a code at a time. So Add
     takes the primary slot and Upload Data stands beside it as the secondary
     action — still opening with CPT already chosen, because the tab you are
     standing on is still the answer to the dialog's first question. */
  if (active.uploadable) {
    slot.innerHTML = `<ui-button variant="outline" icon="upload"
      data-testid="mst--upload-data">Upload Data</ui-button>`;
    return;
  }

  slot.innerHTML = active.readOnly
    ? `<ui-button variant="outline" icon="download" data-testid="mst--export">Export</ui-button>`
    : '';
}

/**
 * Export a whole list as the same CSV shape Upload Data reads back.
 *
 * The whole list, not a filtered view: this runs from Data Import, which has
 * no search box and therefore no narrowing for an export to silently inherit.
 * The count is stated in the confirmation either way.
 */
function exportMaster(master) {
  const columns = columnsFor(master);
  const rows = master.data;
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const lines = [
    columns.map((key) => cell(fieldByKey(master, key)?.label ?? key)).join(','),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${master.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  notifyMaster(
    `Exported ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} from ${entityLabel(master)}.`
  );
}

/** One report for the screen — the same job the other screens' flash does,
    and now through the same lib/toast.js they all use. The bar it replaces
    sat above the list and pushed every row down while it was showing. */
function notifyMaster(message, tone = 'success') {
  notify(message, tone);
}

/* ===================== ONE LIST ===================== */

function initMaster(master) {
  master.table = document.getElementById(`table-${master.id}`);
  if (!master.table) return;

  // The shared footer — same control set, wording and behaviour as every
  // other paged table. See lib/pagination.js.
  master.pager = createPager(document.querySelector(`[data-foot="${master.id}"]`), {
    rowsPerPage: PAGE_SIZE,
    // 'rows' everywhere — one wording, so two tables never describe the same
    // thing differently.
    noun: 'rows',
    testidPrefix: `mst-${master.id}`,
    onChange: () => paint(master),
  });

  // Work on a copy: the data module is the seed, not the store.
  master.data = master.rows.map((row) => ({ ...row }));
  master.query = '';
  master.sort = null;
  master.created = 0;
  master.table.setAttribute('empty-text', master.empty);
  master.columnDefs = tableColumns(master);

  master.table.addEventListener('ui-sort', (event) => {
    master.sort = event.detail;
    master.pager.reset();
    paint(master);
  });

  paint(master);
}

function tableColumns(master) {
  /*
   * A read-only list has no Status pill, no row menu and no clickable
   * primary. The import log is the only one: a record of what was loaded is
   * not something to edit, and offering Edit on it would invite someone to
   * rewrite history rather than re-run the import.
   */
  if (master.readOnly) {
    return [
      { key: master.primary, label: master.primaryLabel, sortable: true, truncate: false },
      ...master.columns,
    ];
  }

  return [
    {
      key: master.primary,
      label: master.primaryLabel,
      sortable: true,
      // A short code truncates fine; a person's full composed name is the
      // one thing a directory is scanned BY, so it opts out and takes
      // whatever width it needs instead of ceding it to the columns beside it.
      truncate: master.primaryTruncate !== false,
      render: (row) => `<button type="button" class="mst__code" data-edit="${row.id}">${esc(
        row[master.primary]
      )}</button>`,
    },
    ...master.columns,
    {
      key: 'active',
      label: 'Status',
      sortable: true,
      narrow: true,
      render: (row) =>
        `<ui-badge status="${row.active ? 'success' : 'critical'}">${
          row.active ? 'Active' : 'Inactive'
        }</ui-badge>`,
    },
    {
      key: 'menu',
      label: '<span class="u-sr-only">Actions</span>',
      actions: true,
      render: (row) => `<button type="button" class="ui-row-menu-btn" data-menu="${row.id}"
          aria-haspopup="menu" aria-expanded="false"
          aria-label="Actions for ${esc(row[master.primary])}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
        </button>`,
    },
  ];
}

/** Rows surviving the search box, sorted, before paging. */
function filtered(master) {
  const query = master.query.trim().toLowerCase();
  const rows = query
    ? master.data.filter((row) =>
        master.search.some((key) => String(row[key] ?? '').toLowerCase().includes(query))
      )
    : master.data;

  if (!master.sort) return rows;

  const { key, direction } = master.sort;
  const factor = direction === 'ascending' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * factor
  );
}

function paint(master) {
  const all = filtered(master);
  const { start, end } = master.pager.render(all.length);
  const slice = all.slice(start, end);

  master.table.columns = master.columnDefs;
  master.table.rows = slice;
  master.table.setAttribute('state', slice.length ? 'ready' : 'empty');

  wireRows(master);
}

function wireRows(master) {
  master.table.querySelectorAll('[data-edit]').forEach((button) =>
    button.addEventListener('click', () =>
      openForm(master, find(master, button.dataset.edit), button)
    )
  );

  master.table.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', () =>
      rowMenu(master, find(master, button.dataset.menu), button)
    )
  );

  master.table.querySelectorAll('[data-repairs]').forEach((button) =>
    button.addEventListener('click', () =>
      openRepairs(master, find(master, button.dataset.repairs), button)
    )
  );
}

const find = (master, id) => master.data.find((row) => row.id === id);

/* ===================== UPLOAD DATA =====================
   One dialog for every list: what the file is, the file, and a blank template
   for anyone who has not got one.

   The file is CHECKED before anything is written, and the check needs to know
   which list it is checking against — so the entity and the file are read
   together, and either one changing re-runs it. What the load would do is on
   screen before the button that does it is reachable: a file that silently
   dropped a third of its codes would only surface months later, in a denied
   claim. ============================================================== */

/** { name, size, text } — the text is kept so re-picking the entity can
 *  re-check the same file without asking for it again. */
let uploadFile = null;
let uploadTarget = null;
let uploadChecked = null;

/**
 * @param preset  The list to load into, when the press came from a tab that
 *                already names one — the two code tabs, where Upload Data
 *                stands in for Add. Null from Data Import, which is a log of
 *                every entity and cannot guess which one is meant.
 */
function openUploadData(trigger, preset = null) {
  const modal = document.getElementById('uploadModal');
  if (!modal) return;

  uploadFile = null;
  uploadTarget = preset;
  uploadChecked = null;

  const entity = document.getElementById('uploadEntity');
  entity?.setOptions(IMPORT_ENTITIES.map((e) => ({ value: e.id, label: e.label })));
  entity?.setAttribute('value', preset?.id ?? '');
  entity?.removeAttribute('error');

  const error = document.getElementById('uploadError');
  if (error) error.hidden = true;

  const report = document.getElementById('uploadReport');
  if (report) report.innerHTML = '';
  document.querySelector('[data-testid="mst--upload-confirm"]')?.setAttribute('disabled', '');

  modal.open(trigger);
}

/** Re-check whenever either half of the answer changes. */
function revalidateUpload() {
  const report = document.getElementById('uploadReport');
  const confirm = document.querySelector('[data-testid="mst--upload-confirm"]');
  uploadChecked = null;

  if (!uploadTarget || !uploadFile) {
    if (report) report.innerHTML = '';
    confirm?.setAttribute('disabled', '');
    return;
  }

  uploadChecked = checkBulk(uploadTarget, uploadFile.text);
  const ready = renderCheckReport(report, uploadTarget, uploadChecked);
  if (ready) confirm?.removeAttribute('disabled');
  else confirm?.setAttribute('disabled', '');
}

function initUploadDialog() {
  const modal = document.getElementById('uploadModal');
  if (!modal) return;

  modal.addEventListener('ui-change', async (event) => {
    if (event.target.closest('[data-testid="mst--upload-entity"]')) {
      uploadTarget = BY_ID[event.detail.value] ?? null;
      document.getElementById('uploadEntity')?.removeAttribute('error');
      revalidateUpload();
      return;
    }

    if (event.target.closest('[data-testid="mst--upload-file"]')) {
      const file = event.detail.file;
      if (!file) return;
      uploadFile = { name: event.detail.name, size: event.detail.size, text: await file.text() };
      const error = document.getElementById('uploadError');
      if (error) error.hidden = true;
      revalidateUpload();
    }
  });

  document
    .querySelector('[data-testid="mst--upload-template"]')
    ?.addEventListener('ui-click', () => {
      if (!uploadTarget) {
        document.getElementById('uploadEntity')?.setAttribute('error', 'Choose an entity first.');
        return;
      }
      document.getElementById('uploadEntity')?.removeAttribute('error');
      downloadTemplate(uploadTarget);
    });

  document
    .querySelector('[data-testid="mst--upload-confirm"]')
    ?.addEventListener('ui-click', () => {
      const entityField = document.getElementById('uploadEntity');
      const error = document.getElementById('uploadError');

      if (uploadTarget) entityField?.removeAttribute('error');
      else entityField?.setAttribute('error', 'Choose an entity.');

      if (error) {
        error.textContent = 'Attach a CSV file to upload.';
        error.hidden = Boolean(uploadFile);
      }
      if (!uploadTarget || !uploadFile) return;

      applyUpload(modal);
    });

  for (const button of document.querySelectorAll('[data-upload-dismiss]')) {
    button.addEventListener('ui-click', () => modal.close());
  }
}

/**
 * Write the lines that passed, and record what happened.
 *
 * The log entry is the outcome, not an intention: it names how many rows the
 * load actually put in and how many lines it would not take. A log that only
 * ever said "Processing" would be a log of clicks.
 */
function applyUpload(modal) {
  const master = uploadTarget;
  const checked = uploadChecked ?? [];
  const ready = checked.filter((entry) => !entry.problems.length);
  if (!master || !ready.length) return;

  // Reversed, so unshifting leaves the file's own order at the top of the list
  // rather than mirroring it.
  let added = 0;
  let updated = 0;

  [...ready].reverse().forEach((entry) => {
    const derived = master.derive ? master.derive(entry.values) : {};

    // A row already on the list is rewritten in place, keeping its id and its
    // Active/Inactive state — the update is to the code's wording, not to
    // whether the practice uses it.
    if (entry.existing) {
      writeRow(entry.existing, entry.values, derived);
      updated += 1;
      return;
    }

    master.data.unshift(
      writeRow(
        { id: `${master.id}-new-${++master.created}`, active: true },
        entry.values,
        derived
      )
    );
    added += 1;
  });

  const skipped = checked.length - ready.length;

  IMPORT_MASTER.data.unshift({
    id: `imp-${Date.now()}`,
    startedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    entity: entityLabel(master),
    fileName: uploadFile.name,
    user: 'Amara Mensah',
    records: added + updated,
    status: 'pass',
    note: skipped ? `${skipped} ${skipped === 1 ? 'line' : 'lines'} skipped` : '',
  });

  master.pager?.reset();
  paint(master);
  IMPORT_MASTER.pager?.reset();
  paint(IMPORT_MASTER);

  modal.close();
  notifyMaster(
    `${[added && `${added} added`, updated && `${updated} updated`]
      .filter(Boolean)
      .join(' · ')} in ${entityLabel(master)}.`
  );
  document.querySelector('#masterAddSlot ui-button')?.focus();

  uploadFile = null;
  uploadChecked = null;
}

/* ===================== EXPORT =====================
   The other direction, from the same screen and the same entity list. What
   comes out is what Upload Data takes back — an export you cannot re-import is
   a report, not a round trip, and the yearly code update IS that round trip.
   ================================================ */

function openExportData(trigger, preset = null) {
  const modal = document.getElementById('exportModal');
  if (!modal) return;

  const entity = document.getElementById('exportEntity');
  // Row counts in the labels: "which list, and is it the one with 900 codes in
  // it" is the same question, asked once.
  entity?.setOptions(
    IMPORT_ENTITIES.map((e) => ({
      value: e.id,
      label: `${e.label} (${BY_ID[e.id]?.data.length ?? 0})`,
    }))
  );
  /* Pre-set when the button that opened this belongs to one list — see
     paintTransferButton(). Opened from Data Import there is nothing to guess,
     so the field stays blank and asks. */
  entity?.setAttribute('value', preset?.id ?? '');
  entity?.removeAttribute('error');

  modal.open(trigger);
}

function initExportDialog() {
  const modal = document.getElementById('exportModal');
  if (!modal) return;

  document
    .querySelector('[data-testid="mst--export-confirm"]')
    ?.addEventListener('ui-click', () => {
      const field = document.getElementById('exportEntity');
      const target = BY_ID[field?.value];

      if (!target) {
        field?.setAttribute('error', 'Choose a list to export.');
        return;
      }

      field?.removeAttribute('error');
      exportMaster(target);
      modal.close();
    });

  for (const button of document.querySelectorAll('[data-export-dismiss]')) {
    button.addEventListener('ui-click', () => modal.close());
  }
}

/* ===================== REPAIR REGISTER =====================
   An instrument's repair history is what an infection-control audit asks for,
   so it is a record rather than a note: when it went, when it was worked on,
   when it came back, what was done, and the paperwork that came with it.

   An open repair — one with no return date — is the state that matters
   operationally, because the scope is not on the shelf. ================== */

let repairInstrument = null;

/**
 * The document waiting to be filed with the repair being typed.
 *
 * Held here rather than read back off the dropzone at Add time because the
 * bytes are what matters: <ui-file-upload> shows a name, but the File behind
 * it is what the viewer renders, and the object URL made from it is what the
 * record carries once the repair exists.
 */
let repairDocDraft = null;

/** The repair whose document the viewer is currently showing. */
let repairDocShowing = null;

/**
 * A PDF, and nothing else.
 *
 * The dropzone's accept attribute is a filter in the file picker, not a
 * promise: a drag-and-drop bypasses it entirely, and so does a picker set back
 * to "All files". So the type is checked here, where the answer decides
 * whether the viewer downstream has something it can actually render.
 */
function isPdf(file, name) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(name ?? '');
}

/** Put the dropzone back to its untouched state after a reset or a rejection. */
function clearRepairDropzone() {
  const zone = document.getElementById('repairDoc');
  const prompt = zone?.querySelector('.ui-upload__prompt');
  const input = zone?.querySelector('input[type="file"]');
  if (prompt) {
    prompt.innerHTML =
      'Drop your document here, or <span class="ui-upload__browse">click to browse</span>';
  }
  zone?.querySelector('.ui-upload')?.classList.remove('ui-upload--filled');
  if (input) input.value = '';
  repairDocDraft = null;
}

/** The date a repair sorts by: when it went, or failing that when it was
 *  worked on, or failing that when it came back. */
function repairWhen(repair) {
  return String(repair.sentOn || repair.repairedOn || repair.returnedOn || '');
}

function repairCardMarkup(repair) {
  const open = !repair.returnedOn;
  return `<article class="mst__repair-card" data-repair="${repair.id}">
    <header class="mst__repair-head">
      <span class="mst__repair-when">${esc(repair.repairedOn || repair.sentOn || '—')}</span>
      ${open ? '<span class="mst__repair-open">Not yet returned</span>' : ''}
      <span class="mst__spacer"></span>
      <button type="button" class="ui-row-menu-btn" data-repair-delete="${repair.id}"
        aria-label="Delete this repair record">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
      </button>
    </header>
    <p class="mst__repair-detail">${esc(repair.detail)}</p>
    <p class="mst__repair-when">
      Sent ${esc(repair.sentOn || '—')} · Returned ${esc(repair.returnedOn || 'not yet')}
    </p>
    ${
      /* The paperwork is the reason the record exists, so it opens. A name
         printed as static text is a claim that the certificate is on file;
         a button is the certificate. */
      repair.file
        ? `<button type="button" class="mst__repair-file" data-repair-view="${repair.id}"
             aria-label="View ${esc(repair.file)}">
             <svg class="ui-icon" aria-hidden="true"><use href="#i-document"></use></svg>
             <span class="mst__repair-file-name">${esc(repair.file)}</span>
             <svg class="ui-icon" aria-hidden="true"><use href="#i-eye"></use></svg>
           </button>`
        : ''
    }
  </article>`;
}

function paintRepairs(master) {
  const list = document.getElementById('repairList');
  if (!list || !repairInstrument) return;

  const repairs = repairInstrument.repairs ?? [];

  list.innerHTML = repairs.length
    ? repairs
        .slice()
        /* Newest first, by whichever date the record actually has. Sorting on
           sentOn alone dropped a repair entered with only a repair date — the
           one field the form insists on — to the bottom of the list, under
           jobs from years back. */
        .sort((a, b) => repairWhen(b).localeCompare(repairWhen(a)))
        .map(repairCardMarkup)
        .join('')
    : `<p class="mst__repair-empty" data-testid="mst--repair-empty">
         No repairs recorded for this instrument.
       </p>`;

  list.querySelectorAll('[data-repair-view]').forEach((button) =>
    button.addEventListener('click', () => {
      const repair = repairInstrument.repairs.find((r) => r.id === button.dataset.repairView);
      if (repair) openRepairDoc(repair, button);
    })
  );

  list.querySelectorAll('[data-repair-delete]').forEach((button) =>
    button.addEventListener('click', () => {
      const going = repairInstrument.repairs.find(
        (r) => r.id === button.dataset.repairDelete
      );
      /* The blob behind a document attached in this session is held by the
         page until it is let go of. The record is being thrown away, so the
         bytes go with it. */
      if (going?.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(going.fileUrl);

      repairInstrument.repairs = repairInstrument.repairs.filter(
        (r) => r.id !== button.dataset.repairDelete
      );
      paintRepairs(master);
      paint(master);
      notifyMaster('Repair record deleted.');
    })
  );
}

function openRepairs(master, row, trigger) {
  const modal = document.getElementById('repairModal');
  if (!modal || !row) return;

  repairInstrument = row;
  if (!Array.isArray(repairInstrument.repairs)) repairInstrument.repairs = [];

  modal.setAttribute('heading', `Repair history: ${row.name}`);
  for (const id of ['repairSent', 'repairDate', 'repairReturned']) {
    const field = document.getElementById(id);
    if (field) {
      field.setAttribute('value', '');
      field.removeAttribute('error');
    }
  }
  const detail = document.getElementById('repairDetail')?.querySelector('textarea');
  if (detail) detail.value = '';
  document.getElementById('repairDetail')?.removeAttribute('error');

  clearRepairDropzone();
  const fileError = document.getElementById('repairFileError');
  if (fileError) fileError.hidden = true;

  paintRepairs(master);
  modal.open(trigger);
}

/* ===================== THE DOCUMENT ITSELF =====================
   A repair's paperwork, opened rather than listed.

   The prototype has no server to fetch a file from, so what it can show
   depends on where the record came from. A document attached in this session
   is a real File, held as an object URL, and the browser's own PDF viewer
   renders it inside the dialog — scrolling, zoom, print and download included,
   none of it ours to build. A document on a seeded record is a name and
   nothing else, and the honest answer is to say so rather than to draw a
   convincing picture of a certificate that does not exist. ================= */

function openRepairDoc(repair, trigger) {
  const modal = document.getElementById('repairDocModal');
  const view = document.getElementById('repairDocView');
  const openButton = document.getElementById('repairDocOpen');
  if (!modal || !view || !repair) return;

  repairDocShowing = repair;
  const url = repair.fileUrl;

  view.innerHTML = url
    ? `<iframe class="mst__doc-frame" src="${esc(url)}" title="${esc(repair.file)}"></iframe>`
    : `<div class="mst__doc-empty" data-testid="mst--repair-doc-empty">
         <span class="mst__doc-mark" aria-hidden="true">
           <svg class="ui-icon" aria-hidden="true"><use href="#i-document"></use></svg>
         </span>
         <p class="mst__doc-name">${esc(repair.file)}</p>
         <p class="mst__doc-note">
           This repair was on the register before the prototype could hold a
           file, so the name is all there is to show. Attach a PDF to a repair
           and it opens here.
         </p>
       </div>`;

  // Nothing to open in a tab when there is nothing behind the name.
  if (openButton) openButton.hidden = !url;

  modal.setAttribute('heading', repair.file || 'Document');
  modal.open(trigger);
}

function initRepairDialog() {
  const modal = document.getElementById('repairModal');
  if (!modal) return;

  /* The dropped file waits with the form until Add commits it, so the document
     is filed against the repair it was typed with rather than against whatever
     happened to be newest. Rejecting a non-PDF here rather than at Add is the
     kinder half-second: the person is still looking at the dropzone. */
  document
    .querySelector('[data-testid="mst--repair-file"]')
    ?.addEventListener('ui-change', (event) => {
      const { name, size, file } = event.detail ?? {};
      const error = document.getElementById('repairFileError');
      if (!file) return;

      if (!isPdf(file, name)) {
        clearRepairDropzone();
        if (error) {
          error.textContent = `${name} is not a PDF. Attach the vendor's paperwork as a PDF.`;
          error.hidden = false;
        }
        return;
      }

      if (error) error.hidden = true;
      repairDocDraft = { name, size, url: URL.createObjectURL(file) };
    });

  document.getElementById('repairDocOpen')?.addEventListener('ui-click', () => {
    if (repairDocShowing?.fileUrl) window.open(repairDocShowing.fileUrl, '_blank', 'noopener');
  });

  for (const button of document.querySelectorAll('[data-repair-doc-dismiss]')) {
    button.addEventListener('ui-click', () =>
      document.getElementById('repairDocModal')?.close()
    );
  }

  document.querySelector('[data-testid="mst--repair-add"]')?.addEventListener('ui-click', () => {
    if (!repairInstrument) return;

    const dateField = document.getElementById('repairDate');
    const detailField = document.getElementById('repairDetail');
    const repairedOn = dateField?.value?.trim();
    const detail = detailField?.querySelector('textarea')?.value.trim();

    // Both problems at once: two presses of Add to find two blanks is two
    // presses too many.
    if (repairedOn) dateField?.removeAttribute('error');
    else dateField?.setAttribute('error', 'Enter the repair date.');

    if (detail) detailField?.removeAttribute('error');
    else detailField?.setAttribute('error', 'Describe the repair work performed.');

    if (!repairedOn || !detail) return;

    repairInstrument.repairs.unshift({
      id: `rep-${Date.now()}`,
      sentOn: document.getElementById('repairSent')?.value?.trim() ?? '',
      repairedOn,
      returnedOn: document.getElementById('repairReturned')?.value?.trim() ?? '',
      detail,
      /* Both halves of the attachment: the name the register prints, and the
         object URL the viewer renders. A repair filed without paperwork keeps
         them empty and shows no document row at all. */
      file: repairDocDraft?.name ?? '',
      fileUrl: repairDocDraft?.url ?? '',
    });

    const master = BY_ID.instrument;
    paintRepairs(master);
    paint(master);
    // The confirmation says whether the paperwork went with it, because that
    // is the half the person doing the filing is least sure of.
    notifyMaster(
      repairDocDraft ? `Repair added with ${repairDocDraft.name}.` : 'Repair added.'
    );

    dateField?.setAttribute('value', '');
    document.getElementById('repairSent')?.setAttribute('value', '');
    document.getElementById('repairReturned')?.setAttribute('value', '');
    const textarea = detailField?.querySelector('textarea');
    if (textarea) textarea.value = '';
    /* The draft's URL is not revoked — the repair above owns it now. */
    clearRepairDropzone();
    const fileError = document.getElementById('repairFileError');
    if (fileError) fileError.hidden = true;
  });

  for (const button of document.querySelectorAll('[data-repair-dismiss]')) {
    button.addEventListener('ui-click', () => modal.close());
  }
}

/* ===================== ADD / EDIT ===================== */

let editing = null;

function openForm(master, row, trigger) {
  const modal = document.getElementById('masterModal');
  const body = document.getElementById('masterModalBody');
  if (!modal || !body) return;

  closeRowMenu();
  editing = { master, row };

  modal.setAttribute('heading', `${row ? 'Edit' : 'Add'} ${master.noun}`);
  modal.setAttribute('size', master.modalSize || 'md');
  body.innerHTML = `
    ${sectionsMarkup(master.sections, row)}
    <div class="ui-modal__actions">
      <ui-button variant="outline" data-form-cancel data-testid="mst--cancel">Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-form-save data-testid="mst--save">${
        row ? 'Save' : 'Add'
      }</ui-button>
    </div>`;

  body.querySelector('[data-form-cancel]').addEventListener('ui-click', () => modal.close());
  body.querySelector('[data-form-save]').addEventListener('ui-click', () => submitForm());

  // Field-level actions — currently only the clinician's NPI lookup.
  body.querySelectorAll('[data-field-action]').forEach((button) =>
    button.addEventListener('ui-click', () => {
      if (button.dataset.fieldAction === 'npi') lookupNpi(body);
    })
  );

  initFeesField(body);

  modal.open(trigger);
}

/**
 * One row per section entry, fields in it laid out side by side. A heading
 * only actually prints once — the first entry that carries it — so a
 * section spanning several rows (an address is street, then suite, then
 * city/state/zip) reads as one group rather than three.
 */
function sectionsMarkup(sections, row) {
  let lastHeading = null;
  return sections
    .map((section) => {
      const showHeading = section.heading && section.heading !== lastHeading;
      if (section.heading) lastHeading = section.heading;
      return `${showHeading ? `<div class="mst__form-heading">${esc(section.heading)}</div>` : ''}
        <div class="mst__form-row">
          ${section.fields.map((field) => fieldMarkup(field, fieldValue(field, row))).join('')}
        </div>`;
    })
    .join('');
}

/**
 * What the form should show for a field, which is not always what the row
 * stores under that key.
 *
 * `from` is for the fields where the two differ — a status the row keeps as a
 * boolean and the form asks as a word. It is handed the row rather than the
 * value so it can also answer for a row that does not exist yet, which is how
 * an Add form opens on a sensible default instead of on an empty box.
 */
function fieldValue(field, row) {
  if (field.from) return field.from(row);
  return row?.[field.key] ?? '';
}

function fieldMarkup(field, value) {
  // A hint is helper text under the box, and no plain field on this screen
  // carries one any more: a label that needs a sentence under it to be
  // understood is a label that should have been better, and a column of them
  // turns a short form into a page of reading. The fee schedule keeps its own,
  // because that one explains a BEHAVIOUR — why an old price stays — which no
  // label could. Supported here regardless: <ui-input> already draws it, and
  // hands the slot over to the error message when there is one to show.
  const hint = field.hint ? ` hint="${esc(field.hint)}"` : '';
  const shared = `data-field="${field.key}" label="${esc(field.label)}"${hint}${
    field.required ? ' required' : ''
  }`;

  if (field.type === 'textarea') {
    return `<ui-textarea ${shared} rows="${field.rows ?? 3}"
      placeholder="${esc(field.placeholder ?? '')}" value="${esc(value)}"></ui-textarea>`;
  }

  if (field.type === 'fees') return feesMarkup(field, value);
  if (field.type === 'modifiers') return modifiersMarkup(field, value);

  if (field.type === 'select') {
    /* `optionRows` is for a list whose stored value is not what a person
       should be reading — an NDC unit of measure is "ML" on the claim and
       "ML — Milliliter" in the box, because nobody chooses between five
       two-letter codes correctly from memory. <ui-select> takes real <option>
       children for exactly this, and `options` stays the shorthand for the
       lists where the label IS the value. */
    const rows = field.optionRows
      ? field.optionRows
          .map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`)
          .join('')
      : '';
    const options = field.optionRows ? '' : ` options="${esc(field.options.join(','))}"`;
    return `<ui-select ${shared} placeholder="${esc(field.placeholder ?? 'Select')}"
      ${options} value="${esc(value)}">${rows}</ui-select>`;
  }

  const input = `<ui-input ${shared} type="${field.type ?? 'text'}"
    placeholder="${esc(field.placeholder ?? '')}" value="${esc(value)}"></ui-input>`;

  // A field can carry one action beside it — the NPI's registry lookup. It
  // sits in the row rather than in the dialog footer, because it acts on this
  // one field and a footer button would look like it acts on the form.
  if (!field.action) return input;
  return `<div class="mst__field-with-action">
    ${input}
    <ui-button variant="outline" data-field-action="${field.key}"
      data-testid="${field.action.testid}">${esc(field.action.label)}</ui-button>
  </div>`;
}

/* --- The modifier boxes ------------------------------------------------------

   FOUR SLOTS, AND THE ORDER IS PART OF THE ANSWER.

   A claim line carries up to four modifiers and their sequence is meaningful —
   a payer reads the first as the one that qualifies the code and the rest as
   qualifying that. So this is four positional boxes rather than one field with
   commas in it: a text box would let somebody type five, or separate two with
   a space and lose them both, and it would give the position no expression at
   all.

   Two characters each, uppercased on the way in. Every modifier in the code
   set is exactly two alphanumeric characters, so maxlength does the work a
   validator would otherwise do after the fact — there is nothing to get wrong
   and therefore no error message to design.
   ---------------------------------------------------------------------------*/

/** How many a claim line has room for. Four is the form's, not an opinion. */
const MODIFIER_SLOTS = 4;

function modifiersMarkup(field, value) {
  const held = Array.isArray(value) ? value : splitModifiers(value);
  const boxes = Array.from(
    { length: MODIFIER_SLOTS },
    (_, index) => `<input type="text" class="mst__mods-input" data-modifier maxlength="2"
      aria-label="${esc(field.label)} ${index + 1}" value="${esc(held[index] ?? '')}">`
  ).join('');

  return `<div class="mst__mods" data-field="${field.key}" data-modifiers>
    <span class="mst__mods-label">${esc(field.label)}</span>
    <div class="mst__mods-boxes" role="group" aria-label="${esc(field.label)}">${boxes}</div>
  </div>`;
}

/**
 * What a file, or a person, may have written in one cell: "26", "26 59",
 * "26,59", "-" for none. Anything that is not two characters of code is
 * separator, and an empty result is a code with no default modifiers rather
 * than one with an empty modifier.
 */
function splitModifiers(value) {
  return String(value ?? '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .slice(0, MODIFIER_SLOTS);
}

/**
 * The boxes as the row will store them: what was typed, uppercased, blanks
 * dropped.
 *
 * Dropping the blanks CLOSES THE GAPS, which is the one thing to notice here.
 * Somebody who clears the first of two modifiers means the remaining one is
 * now first — it is the only modifier on the line — not that the line leads
 * with an empty slot. A stored [' ', '59'] would put that empty slot on a
 * claim.
 */
function readModifiers(body) {
  return [...body.querySelectorAll('[data-modifier]')]
    .map((box) => box.value.trim().toUpperCase())
    .filter(Boolean);
}

/* --- The fee schedule editor -------------------------------------------------

   THE ONE FIELD ON THIS SCREEN THAT IS NOT A BOX.

   Every other field on every other list holds one answer, and the engine can
   treat them all alike: find the control, read `.value`, validate the string.
   A fee schedule is not one answer. It is a small table of dated ones, it
   grows a row at a time, and the rows it already has are a record — the price
   a claim from 2023 is still argued at — so the editor's job is to let a new
   price be ADDED without letting an old one be quietly overwritten.

   That is why the + adds a row rather than the form having a "Fee" box that
   gets retyped, and why removing a row is deliberate and per-row rather than
   the whole thing being a free-text area somebody can paste over.

   Dates are <input type="date"> and money is <input type="number"> because
   both bring their own keyboard, their own picker and their own validation on
   a phone as well as a laptop, which a text box imitating them does not.
   ---------------------------------------------------------------------------*/

/** A blank row, so an empty schedule still opens with somewhere to type. */
const EMPTY_FEE = { effective: '', professional: '', facility: '' };

function feesMarkup(field, value) {
  const rows = Array.isArray(value) && value.length ? value : [EMPTY_FEE];
  /* No visible label of its own: the section heading above it already says
     "Fee Schedule", and a field captioned the same as the group it is the only
     member of reads as two things where there is one. The group still names
     itself to a screen reader, which is where the label was doing work. */
  return `<div class="mst__fees" data-field="${field.key}" data-fees>
    <div class="mst__fees-table" role="group" aria-label="${esc(field.label)}">
      <div class="mst__fees-head" aria-hidden="true">
        <span>Effective Date</span>
        <span>Professional Fee</span>
        <span>Facility Fee</span>
        <span></span>
      </div>
      <div data-fees-rows>${rows.map(feeRowMarkup).join('')}</div>
    </div>
    <div class="mst__fees-foot">
      ${field.hint ? `<p class="mst__fees-hint">${esc(field.hint)}</p>` : ''}
      <ui-button variant="outline" icon="plus" data-fees-add
        data-testid="mst--fee-add">Add Fee</ui-button>
    </div>
  </div>`;
}

/**
 * One dated price.
 *
 * A facility fee left blank stays blank rather than becoming 0 — see the
 * charge master note in data/master.js. The remove button is disabled on the
 * only row, because a schedule with no rows at all is a code that cannot be
 * billed and nothing on this form says that is what you meant.
 */
function feeRowMarkup(entry) {
  return `<div class="mst__fees-row" data-fee-row>
    <input type="date" class="mst__fees-input" data-fee="effective"
      aria-label="Effective date" value="${esc(entry.effective ?? '')}">
    <input type="number" class="mst__fees-input" data-fee="professional" min="0" step="0.01"
      aria-label="Professional fee" placeholder="0.00" value="${esc(entry.professional ?? '')}">
    <input type="number" class="mst__fees-input" data-fee="facility" min="0" step="0.01"
      aria-label="Facility fee" placeholder="None" value="${esc(entry.facility ?? '')}">
    <button type="button" class="mst__fees-remove" data-fee-remove
      aria-label="Remove this fee">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
    </button>
  </div>`;
}

/** Wire the + and the per-row ✕. Delegated, so a row added after the dialog
 *  opened behaves like the ones that were there when it did. */
function initFeesField(body) {
  const field = body.querySelector('[data-fees]');
  if (!field) return;
  const rows = field.querySelector('[data-fees-rows]');

  field.querySelector('[data-fees-add]')?.addEventListener('ui-click', () => {
    rows.insertAdjacentHTML('beforeend', feeRowMarkup(EMPTY_FEE));
    paintFeeRemovals(rows);
    rows.lastElementChild?.querySelector('input')?.focus();
  });

  rows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-fee-remove]');
    if (!button) return;
    button.closest('[data-fee-row]')?.remove();
    paintFeeRemovals(rows);
  });

  paintFeeRemovals(rows);
}

/** The last row standing cannot be removed — see feeRowMarkup(). */
function paintFeeRemovals(rows) {
  const all = rows.querySelectorAll('[data-fee-row]');
  all.forEach((row) => {
    row.querySelector('[data-fee-remove]').disabled = all.length === 1;
  });
}

/**
 * The schedule as the row will store it: numbers as numbers, a blank facility
 * fee as null, and newest first.
 *
 * A row with no date on it is dropped rather than saved undated — a price with
 * no date is not a schedule entry, it is a note, and currentFee() would never
 * find it. Sorted here rather than trusted, because a person adding last
 * year's price they had forgotten types it at the bottom.
 */
function readFees(body) {
  return [...body.querySelectorAll('[data-fee-row]')]
    .map((row) => {
      const read = (name) => row.querySelector(`[data-fee="${name}"]`).value.trim();
      return {
        effective: read('effective'),
        professional: read('professional') === '' ? null : Number(read('professional')),
        facility: read('facility') === '' ? null : Number(read('facility')),
      };
    })
    .filter((entry) => entry.effective && entry.professional !== null)
    .sort((a, b) => b.effective.localeCompare(a.effective));
}

/**
 * A stand-in for the NPPES registry.
 *
 * The real lookup is an HTTP call this prototype cannot make, so a handful of
 * NPIs resolve and everything else reports "not found" — which is the answer
 * that actually needs designing for, since a mistyped NPI is the common case.
 */
const NPI_REGISTRY = {
  1043284971: { lastName: 'Abbasi', firstName: 'Sadeea', credential: 'MD', city: 'Santa Monica', state: 'CA' },
  1558392047: { lastName: 'Abdelfattah', firstName: 'Ramy', credential: '', city: 'Bemidji', state: 'MN' },
  1730118826: { lastName: 'Aberle', firstName: 'Carla', credential: 'MD', city: '', state: '' },
  1548271639: { lastName: 'Okonjo', firstName: 'Ngozi', credential: 'MD', city: 'Fargo', state: 'ND' },
  1215559377: { lastName: 'Whitfield', firstName: 'Grant', credential: 'DO', city: 'Bismarck', state: 'ND' },
};

/** Fill the name fields from the registry, leaving anything already typed. */
function lookupNpi(body) {
  const field = body.querySelector('[data-field="npi"]');
  const npi = (field?.value ?? '').trim();

  if (!/^\d{10}$/.test(npi)) {
    setError(field, npi, 'Enter a 10-digit NPI to look up.');
    return;
  }

  const match = NPI_REGISTRY[npi];
  if (!match) {
    setError(field, npi, 'No clinician found for that NPI.');
    return;
  }
  setError(field, npi, '');

  for (const [key, value] of Object.entries(match)) {
    if (!value) continue;
    const target = body.querySelector(`[data-field="${key}"]`);
    if (target && !target.value?.trim()) setValue(target, value);
  }
}

/** Write into a field component: attribute and live control both. */
function setValue(node, value) {
  if (!node) return;
  node.setAttribute('value', value ?? '');
  const control = node.querySelector('input, select, textarea');
  if (control) control.value = value ?? '';
}

function submitForm() {
  const { master, row } = editing;
  const body = document.getElementById('masterModalBody');
  const allFields = master.sections.flatMap((section) => section.fields);
  const values = {};
  let firstBad = null;

  for (const field of allFields) {
    // The fee schedule is a table, not a box: it reads its own rows and has
    // no single string for the per-field validation below to check. What it
    // needs enforcing — a dated row with a price on it — is enforced by
    // readFees() dropping the ones that are neither.
    if (field.type === 'fees') {
      values[field.key] = readFees(body);
      continue;
    }

    // Four boxes, likewise: nothing to validate that maxlength has not
    // already settled, and no single control to read a string off.
    if (field.type === 'modifiers') {
      values[field.key] = readModifiers(body);
      continue;
    }

    const control = body.querySelector(`[data-field="${field.key}"]`);
    const value = String(control.value ?? '').trim();
    values[field.key] = value;

    const message = fieldError(master, field, value, row);
    setError(control, value, message);
    if (message && !firstBad) firstBad = control;
  }

  if (firstBad) {
    firstBad.focus();
    return;
  }

  // A value nobody typed directly — a clinician's composed name, say.
  // Computed AFTER validation so it always reflects what was actually saved.
  const derived = master.derive ? master.derive(values) : {};

  if (row) {
    writeRow(row, values, derived);
  } else {
    // New entries land at the top of page one — otherwise the thing you just
    // added is on page four and reads as "nothing happened".
    const fresh = { id: `${master.id}-new-${++master.created}`, active: true };
    master.data.unshift(writeRow(fresh, values, derived));
    master.pager.reset();
  }

  paint(master);
  document.getElementById('masterModal').close();
}

function fieldError(master, field, value, row) {
  if (field.required && !value) return `${field.label} is required`;
  if (!value) return '';
  if (field.validate) {
    const message = field.validate(value);
    if (message) return message;
  }

  if (master.unique === field.key) {
    const clash = master.data.some(
      (other) =>
        other !== row &&
        String(other[field.key] ?? '').toLowerCase() === value.toLowerCase()
    );
    if (clash) return `${field.label} ${value} is already on this list`;
  }

  return '';
}

/**
 * Write what was typed, and what was worked out from it, onto a row.
 *
 * A `derive` may return a key as `undefined`, which means "this was a question
 * on the form, not a fact about the row" — the CPT form's Status is one, asked
 * as a word and stored as the `active` boolean beside it. Merging it would
 * leave a second copy of that fact on the row, free to disagree with the
 * first, so it is deleted rather than assigned.
 */
function writeRow(row, values, derived) {
  Object.assign(row, values, derived);
  for (const [key, value] of Object.entries(derived)) {
    if (value === undefined) delete row[key];
  }
  return row;
}

/**
 * Setting `error` re-renders the field, and the field draws its content from
 * the `value` ATTRIBUTE — which only updates when a control commits. Writing
 * the live value back first is what stops a failed save from wiping the two
 * fields the user got right.
 */
function setError(control, value, message) {
  control.setAttribute('value', value);
  if (message) control.setAttribute('error', message);
  else control.removeAttribute('error');
}

/* ===================== ROW ⋮ MENU =====================
   Parented to <body>: the table scrolls inside itself, so a panel inside the
   cell would be clipped by that overflow. Coordinates go through a generated
   stylesheet rather than a style attribute, matching the scheduler.
   ==================================================== */


function rowMenu(master, row, trigger) {
  openRowMenu(trigger, [
    {
      label: 'Edit',
      icon: 'pencil',
      run: () => openForm(master, row, trigger),
    },
    {
      label: `Mark ${row.active ? 'Inactive' : 'Active'}`,
      icon: row.active ? 'eye-off' : 'check',
      run: () => {
        row.active = !row.active;
        paint(master);
        /* Focus goes back to the ⋮ of the row that just changed — the table is
           repainted wholesale, so the button the press started on is gone. */
        master.table.querySelector(`[data-menu="${row.id}"]`)?.focus();
      },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      testid: 'mst--menu-delete',
      run: () => confirmDelete(master, row, trigger),
    },
  ]);
}

/** One <style> element per id, created on first use. */
function sheet(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/* ===================== DELETE ===================== */

let pendingDelete = null;

function initDeleteDialog() {
  const modal = document.getElementById('masterConfirm');
  if (!modal) return;

  modal.querySelector('[data-confirm-cancel]')?.addEventListener('ui-click', () => modal.close());

  modal.querySelector('[data-confirm-delete]')?.addEventListener('ui-click', () => {
    const { master, row } = pendingDelete ?? {};
    if (!master) return;
    master.data = master.data.filter((entry) => entry.id !== row.id);
    paint(master);
    modal.close();
    // The row that opened this dialog no longer exists, so focus cannot go
    // back to it. Add is the nearest stable anchor.
    document.querySelector('#masterAddSlot ui-button')?.focus();
    pendingDelete = null;
  });
}

function confirmDelete(master, row, trigger) {
  const modal = document.getElementById('masterConfirm');
  const text = document.getElementById('masterConfirmText');
  if (!modal || !text) return;

  pendingDelete = { master, row };
  modal.setAttribute('heading', `Delete ${master.noun}`);
  text.innerHTML = `Remove <strong>${esc(row[master.primary])}</strong> from this
    list? Records already using it keep what they recorded — it just stops being
    offered from now on.`;
  modal.open(trigger);
}

/* ===================== READING A TRANSFER FILE =====================
   Reference lists arrive by the thousand — from a payer's fee schedule, a
   clearing house, last year's system. Typing them one dialog at a time is not
   a workflow, so every list can be loaded from a CSV.

   The file is checked BEFORE anything is written: every line is run through
   the same validators the Add dialog uses, the result is shown line by line,
   and only then is Upload offered. A file that is half wrong imports its good
   half and says exactly which lines it left behind — a file that silently
   dropped 40 of 900 codes would be discovered months later, in a claim denial.

   Used by the Data Import screen, which is the one place either direction
   happens. ========================================================== */

/** How many checked lines the report lists before it stops naming them. */
const BULK_PREVIEW = 40;

const fieldByKey = (master, key) =>
  master.sections.flatMap((section) => section.fields).find((field) => field.key === key);

/**
 * A CSV split that survives quoted cells. Half the descriptions on these two
 * lists have a comma in them — "Colonoscopy, flexible; with biopsy" — so a
 * naive split on "," would shear every other row into the wrong columns.
 * Doubled quotes inside a quoted cell are one literal quote, per RFC 4180.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else if (char !== '\r') cell += char;
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  row.push(cell);
  rows.push(row);

  // A trailing newline leaves one empty row behind, and a blank line in the
  // middle is someone's spacing — neither is a line "missing every required
  // field", so both are dropped rather than reported.
  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some(Boolean));
}

/** A first line spelling out the columns is a header, not a code. Either the
 *  key or the label spelling counts, since both are what a template exports. */
function looksLikeHeader(master, cells) {
  const key = columnsFor(master)[0];
  const first = String(cells[0] ?? '').toLowerCase();
  return first === key.toLowerCase() || first === fieldByKey(master, key)?.label.toLowerCase();
}

/**
 * A select column only accepts what the list itself offers. The match is
 * case-insensitive and REWRITES the cell to the canonical spelling, so
 * "commercial" imports as the existing Commercial payer type rather than
 * quietly starting a second one beside it.
 */
function optionProblem(field, values) {
  if (field.type !== 'select' || !values[field.key]) return '';
  /* What a file may say is the STORED value, not the label the form shows —
     an NDC unit of measure arrives as "ML", which is what goes on a claim,
     not as "ML — Milliliter", which is only how the dropdown reads. */
  const allowed = field.optionRows
    ? field.optionRows.map((option) => option.value)
    : field.options;
  const match = allowed.find(
    (option) => option.toLowerCase() === values[field.key].toLowerCase()
  );
  if (!match) return `${field.label} must be one of: ${allowed.join(', ')}`;
  values[field.key] = match;
  return '';
}

/** Every line of the file, checked but not yet written. */
function checkBulk(master, text) {
  const keys = columnsFor(master);
  let lines = parseCsv(text);
  if (lines.length && looksLikeHeader(master, lines[0])) lines = lines.slice(1);

  const claimed = new Map(); // unique value → the line that got there first

  return lines.map((cells, index) => {
    const values = {};
    keys.forEach((key, column) => {
      values[key] = cells[column] ?? '';
    });

    /*
     * A code already on the list is an UPDATE, not a duplicate.
     *
     * This is what the yearly ICD-10 and CPT revisions actually are: a file of
     * a few thousand codes, most of which the practice already has, with
     * changed descriptions on some of them. Refusing those as duplicates would
     * mean the annual update could only ever be applied by hand.
     *
     * Passing the matched row to fieldError is what lets the uniqueness check
     * pass — it already excludes the row being edited.
     */
    const existing =
      master.unique && values[master.unique]
        ? master.data.find(
            (row) =>
              String(row[master.unique] ?? '').toLowerCase() ===
              String(values[master.unique]).toLowerCase()
          ) ?? null
        : null;

    const problems = [];
    for (const key of keys) {
      const field = fieldByKey(master, key);
      if (!field) continue;
      const problem =
        fieldError(master, field, values[key], existing) || optionProblem(field, values);
      if (problem) problems.push(problem);
    }

    // Two lines of one file claiming the same key is the FILE's problem, and
    // fieldError cannot see it — it only knows the list as it already stands.
    const key = master.unique && String(values[master.unique] ?? '').toLowerCase();
    if (key && claimed.has(key)) problems.push(`Same as line ${claimed.get(key)} above`);
    else if (key) claimed.set(key, index + 1);

    return { line: index + 1, values, problems, existing };
  });
}

/** The header row on its own, so nobody has to guess the column order. */
function downloadTemplate(master) {
  const labels = columnsFor(master).map((key) => fieldByKey(master, key)?.label ?? key);
  const csv = `${labels.map((label) => `"${label.replace(/"/g, '""')}"`).join(',')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${master.id}-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * What the file would do, before it does it.
 *
 * Returns how many lines are ready, so the caller can decide whether the
 * button that writes them is reachable — the report and that decision are the
 * same reading of the same check.
 */
function renderCheckReport(report, master, checked) {
  if (!report) return 0;

  const ready = checked.filter((entry) => !entry.problems.length);
  const shown = checked.slice(0, BULK_PREVIEW);

  if (!checked.length) {
    report.innerHTML = `<p class="mst__bulk-summary mst__bulk-summary--bad"
      data-testid="mst--upload-summary">There are no rows in that file.</p>`;
    return 0;
  }

  const skipped = checked.length - ready.length;
  report.innerHTML = `
    <p class="mst__bulk-summary${ready.length ? '' : ' mst__bulk-summary--bad'}"
       data-testid="mst--upload-summary">
      ${ready.length} of ${checked.length} ready to import${
        skipped ? ` · ${skipped} skipped` : ''
      }
    </p>
    <div class="mst__bulk-rows">
      <table class="mst__bulk-table" data-testid="mst--upload-preview">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">${esc(master.primaryLabel)}</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          ${shown
            .map(
              (entry) => `<tr>
                <td>${entry.line}</td>
                <td>${esc(entry.values[master.primary]) || '<span class="mst__muted">—</span>'}</td>
                <td>${
                  entry.problems.length
                    ? `<span class="mst__bulk-bad">${esc(entry.problems.join('; '))}</span>`
                    : entry.existing
                      ? '<span class="mst__bulk-ok">Updates existing</span>'
                      : '<span class="mst__bulk-ok">Ready</span>'
                }</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
      ${
        checked.length > shown.length
          ? `<p class="mst__bulk-more">…and ${checked.length - shown.length} more lines.</p>`
          : ''
      }
    </div>`;

  return ready.length;
}
