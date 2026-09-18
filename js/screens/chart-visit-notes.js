/**
 * VISIT NOTES — a worklist of past and pending appointments, matching the
 * reference screen's "Past Appointments" table.
 *
 * Uses <ui-data-table>, the same component every other worklist in this app
 * uses. Appointment Status and Bill Status render as <ui-badge> pills
 * rather than the reference's plain coloured text, matching how every other
 * status column in this chart already reads (Orders' medication Status,
 * Notes' alert Status) — one convention for "status", not two.
 *
 * ctx only provides { patient, age, go, flash }. There is nothing to add
 * here yet — no reference screen shows an "Add Visit Note" action — so this
 * module is read-only, the same judgement chart-documents.js makes about
 * which actions actually have a reference to build from.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { CHART_VISIT_NOTES, EMPTY_CHART_VISIT_NOTES } from '../../data/chart-visit-notes.js';

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

const APPT_STATUS_TONE = { Completed: 'success', 'No Show': 'critical', Pending: 'warning' };
const BILL_STATUS_TONE = { Paid: 'success', Pending: 'warning', Overdue: 'critical', Cancelled: 'neutral' };

function rowActionButton(id) {
  return `<button type="button" class="ui-row-menu-btn" data-vn-menu="${id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="Visit actions">
      ${icon('more-vertical')}
    </button>`;
}

const COLUMNS = [
  { key: 'no', label: 'No.' },
  { key: 'visit', label: 'Visit Date & Time', render: (row) => `${esc(row.date)}, ${esc(row.time)}` },
  { key: 'provider', label: 'Provider' },
  { key: 'type', label: 'Type' },
  { key: 'reason', label: 'Reason', wrap: true },
  {
    key: 'appointmentStatus',
    label: 'Appointment Status',
    render: (row) =>
      `<ui-badge status="${APPT_STATUS_TONE[row.appointmentStatus] || 'neutral'}" size="sm"
        >${esc(row.appointmentStatus)}</ui-badge
      >`,
  },
  {
    key: 'billStatus',
    label: 'Bill Status',
    render: (row) =>
      row.billStatus
        ? `<ui-badge status="${BILL_STATUS_TONE[row.billStatus] || 'neutral'}" size="sm"
            >${esc(row.billStatus)}</ui-badge
          >`
        : '—',
  },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton(row.id),
  },
];

registerModule('visit-notes', {
  render(host, ctx) {
    const data = [...(CHART_VISIT_NOTES[ctx.patient.mrn] || EMPTY_CHART_VISIT_NOTES)];

    function paint() {
      host.innerHTML = `<ui-data-table
        empty-text="No appointments on file."
        data-testid="chart--visit-notes-table"
      ></ui-data-table>`;

      const table = host.querySelector('[data-testid="chart--visit-notes-table"]');
      table.columns = COLUMNS;
      table.rows = data.map((row, index) => ({ ...row, no: String(index + 1).padStart(3, '0') }));
      table.setAttribute('state', data.length ? 'ready' : 'empty');
    }

    /* --- Per-row "⋮" menu — same build-on-demand pattern every other
       module's row menu uses (chart-notes.js, chart-orders.js). A row here
       has nothing to edit or delete (this module is read-only), so its one
       action is an honest stub rather than a dead link. */

    function onClick(event) {
      const trigger = event.target.closest('[data-vn-menu]');
      if (!trigger) return;
      openRowMenu(trigger, [
        {
          label: 'View Encounter',
          icon: 'eye',
          run: () =>
            ctx.flash(
              "This encounter's detail isn't viewable from Visit Notes in this prototype yet."
            ),
        },
      ]);
    }

    host.addEventListener('click', onClick);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      closeRowMenu();
    };
  },
});
