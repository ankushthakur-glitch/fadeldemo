/**
 * Inventory — two tabs over one shelf.
 *
 *   DAILY COUNT SHEET  one row per counted MEDICATION, on one date. What is
 *                      physically in the controlled drawer, what moved in and
 *                      out of it, and whether the two agree. The sheet itself
 *                      lives in medication-count.js; see the note at the head
 *                      of that file for what it replaced and why.
 *
 *   MEDICATION MANAGEMENT, which is itself two views:
 *
 *     LIST    one row per medication — "how much have we got, what needs
 *             reordering". The lot named in the row is the FIRST-EXPIRING one,
 *             because that is the box the nurse should open next; "+2 more"
 *             says there are others without repeating the medication.
 *
 *     DETAIL  one row per lot for a single medication — "which box, from whom,
 *             booked in by whom, expiring when". Reached by the medication name
 *             and deep-linkable as ?med=<id>.
 *
 * THE TWO TABS ARE NOT INDEPENDENT, AND THAT IS THE POINT OF PUTTING THEM
 * TOGETHER. A count is only worth anything RECONCILED — against the lots,
 * expiry dates and par levels the register beside it already holds. The sheet
 * was the encounter's for a while and reconciled against nothing there,
 * because the next case opened a fresh one over the same drawer.
 *
 * The shelf the register reports is still what the lists have left of it:
 * `entries` is STOCK_ENTRIES with every administered unit already subtracted,
 * so the chart and the shelf remain one system rather than two that happen to
 * be about the same drugs.
 *
 * The stock dialogs live in medication-stock-form.js. This file owns the two
 * register tables, their filters, and which view is showing.
 */
import {
  MEDICATIONS,
  STOCK_ENTRIES,
  MEDICATION_TYPES,
  STOCK_STATUSES,
  TODAY,
  medicationById,
  summarise,
  entryStatus,
  daysUntil,
  wastedTotal,
  wastedBy,
} from '../../data/medication-inventory.js';
/*
 * THE SHELF, LESS EVERYTHING THAT HAS COME OFF IT.
 *
 * The fixture in data/medication-usage.js is twelve days of list written out
 * in a file, which nothing running in the browser can add a row to. The
 * encounter can: a nurse pushing 2 mg of midazolam on the intra-procedure
 * step, or recording a dropped ampoule on the wastage register beside it,
 * posts a movement to the ledger. currentShelf() is booked in, less the lists
 * that have run, less what has just been recorded.
 *
 * It is the ledger's own definition rather than one composed here, because the
 * ledger has to ask the same question to decide which lot a new movement comes
 * out of — and a screen that drew from one shelf while the ledger drew from
 * another is the disagreement this whole join exists to prevent.
 */
import { currentShelf } from '../lib/medication-ledger.js';
import { createPager } from '../lib/pagination.js';
import { initStockForms } from './medication-stock-form.js';
import { initCountSheet, paintCount } from './medication-count.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { admits } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

/* The hand-built menu turned each item's `action` into a data-testid; the specs
   click those. The shared opener takes a `testid` per item, so the mapping that
   used to live in the markup lives here instead. */
const withTestids = (items) =>
  items.map((item) => (item.action ? { ...item, testid: `med--menu-${item.action}` } : item));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "28 Feb 2027" — unambiguous, unlike 06/08/2025 which is two dates. */
function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const el = (id) => document.getElementById(id);

/* ===================== State ===================== */

/* A working copy WITH procedure use already drawn out of it: adding stock,
   adjusting a count and removing a lot all change it, and the seed must stay
   the seed for a reload.

   currentShelf() rather than the raw lots, because the lots record what was
   booked IN and the trolley has been running off them all week — the fixture's
   twelve days and whatever this session has just charted. Reading the seed
   directly would show a shelf nobody has touched since delivery. */
let entries = currentShelf(STOCK_ENTRIES);
/* Thresholds are editable from the Add Stock dialog, so they are held here
   rather than read straight off the frozen catalogue. */
const thresholds = new Map(MEDICATIONS.map((m) => [m.id, m.threshold]));

const params = new URLSearchParams(window.location.search);

const state = {
  /*
   * WHICH VIEW, AND THE ONLY WAY OF ASKING FOR THE OTHER ONE.
   *
   * Inventory is the count sheet and has no button offering the register, so
   * the URL is what reaches it: ?med= for one medication's lots, ?status= for
   * "what needs reordering", and ?view=stock for the register with nothing
   * pre-filtered — the plain front door, which the first two did not provide.
   * A deep link that landed on the count sheet instead is a deep link that did
   * not work.
   */
  tab:
    params.get('med') || params.get('status') || params.get('view') === 'stock'
      ? 'stock'
      : 'count',
  medId: params.get('med') ?? '',
  query: '',
  /* ?status=low-stock opens straight on "what needs reordering" — what a
     bookmark or a link from a reorder task points at. The Settings hub used to
     carry a row for it too; that went, because it opened the same screen as
     the row above it with a filter the screen already offers. */
  status: STOCK_STATUSES[params.get('status')] ? params.get('status') : '',
  type: '',
};

const withThreshold = (medication) => ({
  ...medication,
  threshold: thresholds.get(medication.id) ?? medication.threshold,
});

const summaryFor = (medication) => summarise(withThreshold(medication), entries, TODAY);

/* ===================== Shared cells ===================== */

function statusCell(status) {
  const { label, tone } = STOCK_STATUSES[status];
  return `<ui-badge status="${tone}">${label}</ui-badge>`;
}

/**
 * The expiry, plus how close it is.
 *
 * A date on its own makes the reader do the arithmetic, and this is the column
 * where getting the arithmetic wrong means giving out a drug that has expired.
 */
function expiryCell(iso) {
  const days = daysUntil(iso, TODAY);
  if (days < 0) {
    return `<span class="med__expiry med__expiry--gone">${longDate(iso)}
      <small>expired ${Math.abs(days)} days ago</small></span>`;
  }
  if (days <= 90) {
    return `<span class="med__expiry med__expiry--soon">${longDate(iso)}
      <small>in ${days} days</small></span>`;
  }
  return `<span class="med__expiry">${longDate(iso)}</span>`;
}

const rowMenuButton = (id, label) =>
  `<button type="button" class="ui-row-menu-btn" data-menu="${esc(id)}"
     aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(label)}"
     data-testid="med--row-menu">
     <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
   </button>`;

/* ===================== The row ⋮ menu ===================== */

/* The panel, its placement and its teardown are js/lib/row-menu.js now; this
   screen already called it openRowMenu, so the import above IS the function
   and there is nothing left to declare here. */

/* ===================== Flash =====================
   Was a card pinned to the bottom-left corner of this screen alone. Stock
   moves are confirmed from dialogs that cover the middle of the window, so
   the confirmation was landing behind whatever the user was still reading.
   lib/toast.js puts it in the one corner the product reports from. */

export function flash(message, tone = 'success') {
  notify(message, tone);
}

/* ===================== The list ===================== */

const LIST_COLUMNS = [
  {
    key: 'name',
    label: 'Medication Name',
    truncate: true,
    render: (row) =>
      `<a class="med__name" href="?med=${esc(row.id)}" data-med="${esc(row.id)}">${esc(row.name)}</a>`,
  },
  { key: 'type', label: 'Medication Type' },
  /* Manufacturer, Lot Number and Expiry Date were columns here and are gone.
     All three are properties of a LOT, and a medication has several — so each
     column had to pick one lot to speak for the shelf and then say "+2 more".
     A number that is only true of one row out of three is worse than no
     column: the lot list on the medication's own page shows all of them, and
     that is the only place they are ever complete. */
  {
    key: 'available',
    label: 'Available Quantity',
    render: (row) =>
      `<span class="med__qty">${row.available}</span>` +
      (row.expiredCount
        ? `<small class="med__qty-note">${row.expiredCount} expired lot${
            row.expiredCount > 1 ? 's' : ''
          } excluded</small>`
        : ''),
  },
  /* The reorder point, beside the count it is compared against. It belongs to
     the medication rather than to any lot, which is exactly why it survives
     where the three above did not — and it is what turns Low Stock from a
     colour into a number you can check. */
  {
    key: 'threshold',
    label: 'Threshold',
    render: (row) => `<span class="med__qty med__qty--muted">${row.threshold}</span>`,
  },
  { key: 'status', label: 'Status', render: (row) => statusCell(row.status) },
  {
    key: 'action',
    label: 'Action',
    actions: true,
    render: (row) => rowMenuButton(row.id, row.name),
  },
];

function filteredMedications() {
  const query = state.query.trim().toLowerCase();

  return MEDICATIONS.map(summaryFor).filter((row) => {
    /* Both take a set. Stock is worked by exception — everything Low AND
       everything Expiring, the two drug types that share a fridge — and one
       answer at a time meant running the same list twice. */
    if (!admits(state.status, row.status)) return false;
    if (!admits(state.type, row.type)) return false;
    if (!query) return true;
    // Lot numbers are searched too: the desk holds a box and reads the label.
    return (
      row.name.toLowerCase().includes(query) ||
      row.type.toLowerCase().includes(query) ||
      row.lots.some(
        (lot) =>
          lot.lot.toLowerCase().includes(query) ||
          lot.manufacturer.toLowerCase().includes(query)
      )
    );
  });
}

let listPager;

function paintList() {
  const rows = filteredMedications();
  const { start, end } = listPager.render(rows.length);
  const table = el('medTable');

  table.columns = LIST_COLUMNS;
  table.rows = rows.slice(start, end);
  table.setAttribute('state', rows.length ? 'ready' : 'empty');

  table.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', () => {
      const row = rows.find((r) => r.id === button.dataset.menu);
      openRowMenu(button, withTestids([
        { action: 'view', icon: 'eye', label: 'View lots', run: () => showDetail(row.id) },
        {
          action: 'edit',
          icon: 'pencil',
          label: 'Edit medication',
          run: () => forms.openMedication(row.id, button),
        },
        {
          action: 'add',
          icon: 'plus',
          label: 'Add stock',
          run: () => forms.openStock(row.id, button),
        },
      ]));
    })
  );

  table.querySelectorAll('[data-med]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showDetail(link.dataset.med);
    })
  );
}

/* ===================== The detail ===================== */

const LOT_COLUMNS = [
  {
    key: 'lot',
    /* The way into the lot's own record. Everything about a box that does not
       fit a column — the vendor, and every write-off with its date — is behind
       this, and the lot number is what someone holding the box reads first. */
    label: 'Lot Number',
    render: (row) =>
      `<button type="button" class="med__lot-link" data-lot="${esc(row.id)}"
        data-testid="med--lot-link">${esc(row.lot)}</button>`,
  },
  { key: 'manufacturer', label: 'Manufacturer', truncate: true },
  { key: 'addedOn', label: 'Added On', render: (row) => longDate(row.addedOn) },
  { key: 'addedBy', label: 'Added by', truncate: true },
  {
    key: 'quantity',
    label: 'Available Quantity',
    /* "12" alone cannot say whether the box is nearly full or nearly gone,
       which is exactly what the Low Stock badge beside it is claiming. */
    render: (row) =>
      `<span class="med__qty">${row.quantity}</span>` +
      (row.received && row.received !== row.quantity
        ? `<small class="med__qty-note">of ${row.received} received</small>`
        : ''),
  },
  {
    key: 'wasted',
    label: 'Wasted',
    /* The count, and whose name is against it. A wastage figure with nobody
       attached is a number nobody can follow up. */
    render: (row) => {
      const total = wastedTotal(row);
      if (!total) return '<span class="med__muted">—</span>';
      const people = wastedBy(row);
      const who = people.length === 1 ? people[0] : `${people.length} people`;
      return `<span class="med__wasted">${total}<small>by ${esc(who)}</small></span>`;
    },
  },
  { key: 'expiry', label: 'Expiry Date', render: (row) => expiryCell(row.expiry) },
  { key: 'status', label: 'Status', render: (row) => statusCell(row.status) },
  {
    key: 'action',
    label: 'Action',
    actions: true,
    render: (row) => rowMenuButton(row.id, `lot ${row.lot}`),
  },
];

let lotPager;

function paintDetail() {
  const medication = medicationById(state.medId);
  if (!medication) {
    showList();
    return;
  }

  const summary = summaryFor(medication);
  const threshold = thresholds.get(medication.id);

  el('detailTitle').textContent = medication.name;
  el('factName').textContent = medication.name;
  el('factType').textContent = medication.type;
  el('factTotal').textContent = String(summary.available);
  el('factThreshold').textContent = String(threshold);

  /* Wastage across every lot, expired ones included — waste that happened
     before a box went out of date still happened, and a figure that resets
     when the lot expires is one nobody can act on. */
  el('factWastedWrap').hidden = summary.wasted === 0;
  el('factWasted').textContent = String(summary.wasted);
  document.title = `GastroEMR — ${medication.name}`;

  /* Why the total can be lower than the numbers below it. Without this the
     screen looks like it cannot add up. */
  const note = el('detailNote');
  note.hidden = summary.expiredCount === 0;
  if (summary.expiredCount) {
    note.textContent =
      `Total Quantity counts usable stock only. ${summary.expiredCount} expired lot` +
      `${summary.expiredCount > 1 ? 's are' : ' is'} listed below and excluded from the total.`;
  }

  /* Soonest expiry first — the order the shelf should be worked through. */
  const rows = summary.lots
    .map((lot) => ({ ...lot, status: entryStatus(lot, TODAY) }))
    .sort((a, b) => a.expiry.localeCompare(b.expiry));

  const { start, end } = lotPager.render(rows.length);
  const table = el('lotTable');
  table.columns = LOT_COLUMNS;
  table.rows = rows.slice(start, end);
  table.setAttribute('state', rows.length ? 'ready' : 'empty');

  table.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', () => {
      const lot = rows.find((r) => r.id === button.dataset.menu);
      openRowMenu(button, withTestids([
        {
          action: 'details',
          icon: 'eye',
          label: 'Lot details',
          run: () => forms.openLot(lot, button),
        },
        {
          action: 'adjust',
          icon: 'pencil',
          label: 'Adjust quantity',
          run: () => forms.openAdjust(lot, button),
        },
        {
          action: 'waste',
          icon: 'trash',
          label: 'Record waste',
          run: () => forms.openWaste(lot, button),
        },
        /* "Remove lot" was here and is gone. Deleting a booked-in lot erases
           the count AND its waste log, which is the one record an audit reads
           — and a lot that should not be used is Expired or adjusted to zero,
           both of which leave the history intact. */
      ]));
    })
  );

  table.querySelectorAll('[data-lot]').forEach((link) =>
    link.addEventListener('click', () =>
      forms.openLot(
        rows.find((r) => r.id === link.dataset.lot),
        link
      )
    )
  );
}

/* ===================== Which view ===================== */

/*
 * The header's action slot holds one group per view and shows the open one's.
 *
 * They live up there rather than inside their panels because that is where a
 * list screen's controls belong — see .ui-page-head__actions in base.css —
 * but a group left visible for a hidden view would be a date acting on a
 * sheet nobody can see, and a search box that filters somewhere else.
 *
 * The sheet's date line goes with them, for the same reason: it names the day
 * the COUNT is on, and left standing over the lot register it would be a date
 * qualifying a table it has nothing to do with.
 */
function showActions(view) {
  el('countActions').hidden = view !== 'count';
  el('stockActions').hidden = view !== 'stock';
  el('countSheetLine').hidden = view !== 'count';
}

function showCount() {
  state.medId = '';
  state.tab = 'count';
  el('panel-count').hidden = false;
  el('panel-stock').hidden = true;
  el('detailView').hidden = true;
  el('medHead').hidden = false;
  showActions('count');
  document.title = 'GastroEMR — Daily Medication Count';
  window.history.replaceState({}, '', window.location.pathname);
  paintCount();
}

/*
 * THE REGISTER, WHICH NO LONGER HAS A BUTTON.
 *
 * It was the second tab. The strip is gone — Inventory is the count sheet —
 * and this is reached by ?med= or ?status= alone: a link from a reorder task,
 * or a bookmark somebody kept. Nothing on this screen offers it.
 *
 * Left whole rather than deleted, because it is where lots, expiry dates,
 * thresholds and the wastage register are maintained, and a count is only
 * worth anything reconciled against those. If it is to go, it should go with
 * its dialogs, its tests and its fixture, not by having its way in removed.
 */
function showList() {
  state.medId = '';
  state.tab = 'stock';
  el('panel-count').hidden = true;
  el('panel-stock').hidden = false;
  el('detailView').hidden = true;
  el('medHead').hidden = false;
  showActions('stock');
  document.title = 'GastroEMR — Medication Inventory';
  /* ?view=stock rather than the bare path, which now means the count sheet.
     Backing out of one medication's lots has to leave the address bar saying
     "the register" — otherwise a reload, a bookmark or a shared link drops the
     reader onto a different document from the one they were looking at. */
  window.history.replaceState({}, '', `${window.location.pathname}?view=stock`);
  paintList();
}

function showDetail(medId) {
  state.medId = medId;
  state.tab = 'stock';
  el('panel-count').hidden = true;
  el('panel-stock').hidden = true;
  el('detailView').hidden = false;
  /* The whole band goes with it. One medication's lots is a page you came to
     from a row, and it carries its own head with the medication's name and a
     way back — two heads stacked, one of them naming a screen you are no
     longer looking at, is chrome arguing with itself. */
  el('medHead').hidden = true;
  window.history.replaceState({}, '', `?med=${encodeURIComponent(medId)}`);
  paintDetail();
}

/** Repaint whichever view is showing — every stock dialog ends here.

    The count sheet is not one of the three: nothing those dialogs do changes
    a figure somebody has typed onto it, and repainting it would rebuild every
    box on the sheet — including the one being typed into. It repaints itself,
    from its own module. */
function repaint() {
  if (state.medId) paintDetail();
  else paintList();
}

/* ===================== Wiring ===================== */

let forms;

customElements.whenDefined('ui-data-table').then(() => {
  /* The medication list's filters, in the standard panel. */
  const medFilter = el('medFilter');
  medFilter.setGroupOptions(
    'status',
    Object.entries(STOCK_STATUSES).map(([value, s]) => ({ value, label: s.label }))
  );
  medFilter.setGroupOptions('type', MEDICATION_TYPES);
  // Reflect a ?status= arrival, so the panel agrees with the list it filtered.
  if (state.status) medFilter.value = { status: state.status };

  listPager = createPager(el('medFoot'), {
    rowsPerPage: 10,
    noun: 'medications',
    testidPrefix: 'med',
    onChange: paintList,
  });

  lotPager = createPager(el('lotFoot'), {
    rowsPerPage: 10,
    noun: 'lots',
    testidPrefix: 'med-lot',
    onChange: paintDetail,
  });

  /*
   * THE COUNT SHEET WIRES ITSELF.
   *
   * It owns a date, a table of forms, two dialogs and the arithmetic between
   * them, and none of that has anything to say to the register beside it — so
   * it is initialised once here with the day it opens on and the way this
   * screen reports, and never spoken to again.
   *
   * There is no pager under it, and deliberately. Every other table on this
   * screen is a list you read a page of; a count sheet is a document you work
   * top to bottom, and a drawer split across two pages is a drawer where the
   * second half is the half nobody counts.
   */
  initCountSheet({ date: TODAY, flash });

  forms = initStockForms({
    medications: MEDICATIONS,
    thresholds,
    getEntries: () => entries,
    setEntries: (next) => {
      entries = next;
    },
    onChange: repaint,
    flash,
  });

  el('medSearch').addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    listPager.reset();
    paintList();
  });

  medFilter.addEventListener('ui-filter-change', (event) => {
    state.status = event.detail.values.status;
    state.type = event.detail.values.type;
    listPager.reset();
    paintList();
  });

  /* "Add Medication" adds one to the CATALOGUE. Booking in a box of an
     existing medication is "Add stock", from the row menu or the medication's
     own page — the button says which of the two it does. */
  el('medAdd').addEventListener('ui-click', (event) => forms.openMedication('', event.target));
  el('detailAdd').addEventListener('ui-click', (event) =>
    forms.openStock(state.medId, event.target)
  );

  /*
   * RECORDING WASTE WITHOUT FIRST NAMING A BOX.
   *
   * The dialog needs a lot, because waste comes off one — but the person
   * opening it is holding a broken ampoule and knows the DRUG. Asking them
   * which of its four boxes it came out of is asking a question whose answer
   * is on the vial in the bin, and the two clicks through the row menu were
   * asking it twice.
   *
   * So it opens on the first-expiring usable lot: the box the medication list
   * already names as the one to open next, the box the ledger already draws
   * from, and therefore the box a broken ampoule almost certainly came out of. The lot is named in the dialog's own lead line, so a nurse for
   * whom it is the wrong box can close it and use the row menu — which is
   * still there for exactly that.
   *
   * Nothing usable at all and the button says so rather than opening a dialog
   * over a shelf with no box to take anything off.
   */
  el('detailWaste').addEventListener('ui-click', (event) => {
    const medication = medicationById(state.medId);
    if (!medication) return;
    const lot = summaryFor(medication).next;
    if (!lot) {
      flash(`No usable lot of ${medication.name} to record wastage against.`, 'warning');
      return;
    }
    forms.openWaste(lot, event.target);
  });

  document
    .querySelector('[data-testid="med--detail-back"]')
    .addEventListener('click', (event) => {
      event.preventDefault();
      showList();
    });

  /* A ?med= or ?status= link asked for the register, so it opens there — see
     showList() for why that link is the only way in now. Everything else, and
     that is every arrival from the nav, opens on the day's count. */
  if (state.tab === 'stock') {
    if (state.medId && medicationById(state.medId)) showDetail(state.medId);
    else showList();
  } else {
    showCount();
  }
});
