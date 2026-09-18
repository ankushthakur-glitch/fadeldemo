/** Wires the demo table on the gallery page. Gallery-only, not library code. */
import { PATIENTS } from '../data/patients.js';
import { SEDATION_FORMULARY } from '../data/procedure-encounter.js';

const COLUMNS = [
  { key: 'name', label: 'Patient', sortable: true, truncate: true },
  { key: 'mrn', label: 'MRN', numeric: true, sortable: true },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'reason', label: 'Reason for visit', truncate: true },
  { key: 'clinician', label: 'Clinician', truncate: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) =>
      `<ui-badge status="${row.status}">${row.statusLabel}</ui-badge>`,
  },
];

customElements.whenDefined('ui-data-table').then(() => {
  const table = document.getElementById('demoTable');
  if (!table) return;
  table.columns = COLUMNS;
  table.rows = PATIENTS.slice(0, 5);
});

/* <ui-suggest> takes its list as data rather than as an attribute — a
   comma-joined string cannot carry an option with a comma in it — so the
   gallery hands one over the same way a screen does. The sedation cart, because
   a list of six real drug names shows what the control is for better than
   "Option A, Option B" would. */
customElements.whenDefined('ui-suggest').then(() => {
  const drugs = SEDATION_FORMULARY.map((drug) => drug.name);
  document
    .querySelectorAll('[data-gallery-suggest="drugs"]')
    .forEach((node) => node.setOptions(drugs));
});

/* THE GROUPED SELECT, for the same reason: `group` is a field on an option and
   the `options` attribute is a comma-joined string of labels, so a list drawn
   in halves can only arrive as data. Two named halves and one ungrouped row
   under them — the row that belongs to neither heading, which is where an
   "Other" or "None of these" goes. */
customElements.whenDefined('ui-select').then(() => {
  const ON_FILE = 'On file for this patient';
  const SHELF = 'Practice catalogue';
  document.querySelectorAll('[data-gallery-groups="medications"]').forEach((node) => {
    node.optionList = [
      { value: 'mes-12', label: 'Mesalamine 1.2g tablet', group: ON_FILE },
      { value: 'omp-20', label: 'Omeprazole 20 mg Capsule', group: ON_FILE },
      { value: 'ada-40', label: 'Adalimumab 40 mg Pen', group: SHELF },
      { value: 'bud-3', label: 'Budesonide 3 mg Capsule', group: SHELF },
      { value: 'pan-40', label: 'Pantoprazole 40 mg Tablet', group: SHELF },
      { value: 'other', label: 'Other — not on file' },
    ];
  });
});
