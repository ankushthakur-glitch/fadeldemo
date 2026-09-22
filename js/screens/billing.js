/**
 * BILLING — one worklist following a claim from the encounter to the money.
 *
 * PRIMARY tabs, and under each a row of status chips. The pair is the whole
 * navigation model: the tab says which leg of the journey, the chip says where
 * in that leg, and together they decide the columns, whether rows can be
 * ticked, and which bulk action the header offers.
 *
 *   Unbilled Encounters locked encounters — insured, or self-pay
 *   Claims              the whole life of a claim, in seventeen statuses
 *   Payments & Denials  payer overdue · ERAs · payer rejected · appeals
 *   AR Management       the same claims, aged rather than staged
 *
 * CLAIMS IS ONE TAB, AND ONE ARRAY.
 * It was two — Unbilled and Submitted — which meant the same object lived
 * either side of a postmark: sending a claim on was a delete from one array
 * and a rebuild in the other, the rebuild kept dropping fields, and a biller
 * chasing a rejection had to know which tab to look in before they could
 * search for it. Now the row never moves. Its status says where it has got
 * to, advance() is the only thing that changes it, and the chip row is those
 * statuses in the order a claim travels.
 *
 * Two full-screen stages replace the worklist the way Referrals' process view
 * replaces its queue:
 *
 *   the CLAIM stage, in five modes — a scrub error to fix, a clearing-house
 *   rejection to correct, a payer denial to appeal, an ordinary claim to edit,
 *   and any of them locked for reading. Same claim underneath; only the
 *   banner, the footer and the rail differ, so they are one screen rather than
 *   five that would drift apart.
 *
 *   the ERA stage, where an 835's lines are posted.
 *
 * One module and one large file: every worklist here shares the same chips,
 * pager, row menu and stage plumbing, and splitting that up would only mean
 * re-importing it five times. Sections run in the order the claim travels.
 */
import { createPager } from '../lib/pagination.js';
import { PAYERS } from '../../data/master.js';
import { APPOINTMENT_TYPES } from '../../data/appointments.js';
import {
  BILLING_PROCEDURES, MISSED_APPOINTMENT_FEE,
  INVOICES, INVOICE_TYPES, INVOICE_STATUSES, INVOICE_STATUS_TONE,
  INVOICE_PAYMENT_METHODS, INVOICE_NOTE, PAYMENT_REASONS, SAVED_CARDS, patientEmail,
  READY_INSURANCE, READY_SELF_PAY,
  CLAIMS, CLAIM_CHIP_STATUSES, CLAIM_STATUS_TONE, UNSENT_STATUSES,
  CLAIM_APP_TYPES, CLAIM_CODERS, AGE_WARNING_DAYS,
  /* ERA_TRANSFER_SUMMARY is the last of the ERA fixtures still read here, by
     the upload dialog Remits borrows. The rest — the ERA batches and lines,
     the EOB templates, the payer-overdue, denial and appeal worklists — went
     with Payments & Denials. They are still exported, because the data is
     sound and a tab that wants them back should not have to invent them. */
  ERA_TRANSFER_SUMMARY,
  REMITS, REMIT_SOURCES, REMIT_SERVICE_TYPES, REMIT_CLAIM_STATUSES,
  SCRUB_ERRORS, REJECTION_ERRORS, REJECTION_SUMMARY,
  CLAIM_DETAIL_TEMPLATE, CLAIM_RAIL_TEMPLATE, CLAIM_HISTORY_TEMPLATE,
  CMS1500_TEMPLATE, UB04_TEMPLATE,
  BILLING_PROVIDERS, BILLING_PROVIDER_ROLES, BILLING_PATIENTS, PLACES_OF_SERVICE,
  APPOINTMENT_TYPES_BILLING,
  AR_AS_OF, AR_BUCKET_WIDTHS, AR_DEFAULT_BUCKET_WIDTH, AR_PATIENT_ACCOUNTS,
  AR_INSURANCE_ACCOUNTS, arBuckets, arBucketKey,
  PATIENT_COLLECTIONS, COLLECTION_STATUSES, COLLECTION_STATUS_TONE,
  COLLECTION_BUCKETS, COLLECTION_ENTITIES, COLLECTION_ATTEMPT_BANDS,
  SMALL_BALANCE_THRESHOLD, collectionBucket,
} from '../../data/billing.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { admits, admitsAny, chosen } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

const PAGE_SIZE = 10;

/* ============================================================================
   SMALL HELPERS — the same shapes every other screen module here uses.
   ========================================================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/** Two decimals, grouped — the only money formatting in this screen. */
function money(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}
const dollars = (value) => `$${money(value)}`;

function badge(label, status, size = '') {
  return `<ui-badge status="${status}"${size ? ` size="${size}"` : ''}>${esc(label)}</ui-badge>`;
}

/** MM/DD/YYYY, the format every date column on this screen is stamped in.
 *  One helper so a claim raised today and a claim submitted today cannot end
 *  up written two different ways in two adjacent columns. */
function today() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
}

/** "1 Claim" / "12 Claims". A claim can now be submitted on its own from the
 *  stage, so every count that used to be a batch has to read for one too. */
function count(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function find(list, id) {
  return list.find((row) => String(row.id) === String(id));
}

/** dt/dd pair for the rail and the fact strips. `raw` opts out of escaping
 *  for the few values that are themselves markup (a badge, a link). */
function fact(label, value, raw = false) {
  return `<div class="bil__fact"><dt>${esc(label)}</dt><dd>${
    raw ? value : esc(value ?? '—')
  }</dd></div>`;
}

/** A label over a boxed value. The claim stage shows what was billed rather
 *  than a form to retype it, but the box is what the error state colours. */
function field(label, value, invalid = false) {
  return `<div class="bil__field${invalid ? ' bil__field--error' : ''}">
    <span class="bil__field-label">${esc(label)}</span>
    <span class="bil__field-box">${esc(value ?? '—')}${invalid ? icon('close') : ''}</span>
  </div>`;
}

function rowMenuBtn(kind, id, label = 'Actions') {
  return `<button type="button" class="ui-row-menu-btn" data-menu="${kind}" data-id="${esc(id)}"
    aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label)}">${icon('more-vertical')}</button>`;
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

const modal = (id) => document.getElementById(id);

/* --- Flash ---------------------------------------------------------------
   The screen already wanted a floating card rather than a banner, for the
   reason its stylesheet gave: the body swaps between the worklist and two
   stages, and a line pinned to one of them disappears when another takes
   over. That is what lib/toast.js is, so it is what this calls now. */

function flash(message, tone = 'info') {
  notify(message, tone);
}

/** Everything a prototype is asked to do but cannot really perform still has
 *  to answer the click, and say the same thing when it does. */
const notYet = (what) => flash(`${what} isn't available in this prototype.`);

/* --- Row ⋮ menu ----------------------------------------------------------
   Parented to <body>: every table here scrolls inside itself, so a panel in
   the cell would be clipped by that overflow. Coordinates arrive through a
   generated stylesheet rather than a style attribute, matching Master. */

/* The row menu is js/lib/row-menu.js now — fifty lines of panel building,
   positioning and teardown that eight other screens were also carrying. */
const closeMenu = closeRowMenu;
const openMenu = openRowMenu;

/* ============================================================================
   MUTABLE DATA — copies, never the seed modules. Claims move between lists as
   they are scrubbed, submitted and adjudicated, which is the point of the
   screen; the fixtures stay pristine so a reload starts over.
   ========================================================================= */

const data = {
  readyInsurance: READY_INSURANCE.map((row) => ({ ...row })),
  readySelfPay: READY_SELF_PAY.map((row) => ({ ...row })),
  /* ONE list for the whole life of a claim. It used to be two — unbilled and
     submitted — which meant sending a claim on was a delete from one array and
     a rebuild in the other, and the rebuild is where fields went missing. */
  claims: CLAIMS.map((row) => ({ ...row })),
  /* The item lines are copied too, not shared. An invoice can be edited here
     — that is the point of the form — and a shallow copy would let an edit
     reach through into the fixture and change every invoice built from the
     same procedure. */
  invoices: INVOICES.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })) })),
  /* Claims are copied too, not shared: posting a remit writes a status onto
     every claim inside it, and a shallow copy would let that reach through
     into the fixture and post the same claim on a reload. */
  remits: REMITS.map((row) => ({ ...row, claims: row.claims.map((claim) => ({ ...claim })) })),
  /* Charges copied too: sending a notice moves the account up the ladder and
     stamps a date on it, and the modal reads the charges back out — a shallow
     copy would let a chased account write through into the fixture and come
     back already chased on a reload. */
  collections: PATIENT_COLLECTIONS.map((row) => ({
    ...row, charges: row.charges.map((charge) => ({ ...charge })),
  })),
  /* Notes are per claim, keyed by its id. One shared list would show the same
     note on every denial and — worse — quote a denial code the rail beside it
     is not showing. Seeded on first read from the claim's own code. */
  notes: new Map(),
};

function notesFor(row) {
  if (!data.notes.has(row.id)) {
    data.notes.set(row.id, [{
      meta: `Denied ${row.denialDate}`,
      text: `Denial received — ${row.denialCode}. Reviewing next steps per workflow.`,
    }]);
  }
  return data.notes.get(row.id);
}

/* ============================================================================
   VIEW MODEL

   `state.tab` + `state.chip` name the view. Everything the worklist renders is
   derived from that pair by view(), so there is exactly one place where "which
   columns, which rows, which buttons" is decided.
   ========================================================================= */

/**
 * The status chips over Claims — the submission pipeline, and only it.
 *
 * A chip per status meant seventeen of them, a filter row three lines deep,
 * and most of it standing for states nobody works out of this tab: a denial is
 * worked in Payments & Denials, an ageing balance in AR Management. So the
 * chips stop at the clearing house's answer, which is where this tab's job
 * ends.
 *
 * The rest of the statuses have not gone anywhere. A claim still holds them,
 * the Status column still shows them, and All still lists them — the fixture
 * interleaves the statuses so All reads as a book of business at every stage
 * at once rather than twenty New in a row. They are reached by the act that
 * causes them, never by picking one off the row.
 */
const CLAIM_CHIPS = [
  { key: 'all', label: 'All' },
  ...CLAIM_CHIP_STATUSES.map((status) => ({ key: status, label: status })),
];

const TABS = [
  {
    value: 'ready',
    /* Insurance and Self Pay are not two states of one queue — they are two
       lists with different columns heading for two different documents. That
       used to decide which SHAPE the second level was drawn in; it no longer
       does, because there is only one shape (see paintChips). `level` is left
       on the tab because it still names what this second level IS, and
       because 'filters' and 'ar' are read from the same field. */
    level: 'tabs',
    chipLabel: 'Payment type',
    chips: [
      { key: 'insurance', label: 'Insurance' },
      { key: 'self', label: 'Self Pay' },
    ],
  },
  {
    value: 'claims',
    chipLabel: 'Status',
    /* `all` is a real chip here because Claims is one queue at seventeen
       stages of the same process — every row is the same object at a
       different point of it, so a count of all of them means something. */
    chips: CLAIM_CHIPS,
  },
  {
    /* No second level at all. Remits is ONE list of one kind of document —
       there is no stage of a remit's life to chip it by, and its Status is
       derived from the claims inside rather than being a queue you work.
       `level: 'filters'` is what paintChips() reads to leave the chip row out
       entirely and show this tab's filter bar in its place: an empty "Status"
       label over an empty row is furniture. */
    value: 'remits',
    level: 'filters',
    chipLabel: '',
    chips: [{ key: 'all', label: 'All' }],
  },
  {
    /* Five stages of getting paid, which is exactly what Claims' strip counts
       off. `all` is a real segment for the same reason it is one there — every
       row is the same object at a different point of the same process. */
    value: 'invoice',
    chipLabel: 'Status',
    chips: [
      { key: 'all', label: 'All' },
      ...INVOICE_STATUSES.map((status) => ({ key: status, label: status })),
    ],
  },
  {
    /* AR Management keeps the same (tab, chip) pair as everything else — its
       three sub-views ARE the chip — so switching tabs, landing on a tab from
       a result dialog and resetting selection all work unchanged. What it does
       not share is the worklist: `level: 'ar'` is what paint() reads to send
       the screen down its own path instead of the chip row and the table.

       No counts on them — the count of an ageing report is money, not rows,
       and a badge reading "16" beside a screen whose subject is $10,903 would
       be answering a question nobody asked. */
    value: 'ar',
    level: 'ar',
    chipLabel: 'View',
    chips: [
      { key: 'summary', label: 'Summary' },
      { key: 'patient', label: 'Patient' },
      { key: 'insurance', label: 'Insurance' },
    ],
  },
  {
    /*
     * No second level at all — everything narrows from the funnel.
     *
     * This tab used to carry a row of "Quick view" chips (All, New balance,
     * Statement due, …) AND a filter bar of five selects, which is two
     * controls over one table and the only tab on the screen with both. The
     * chips also owned status exclusively, so the bar had to leave it out and
     * say why.
     *
     * One panel now holds all six, status included. It costs a click to
     * reach — the chips were one — and buys a header that is a header rather
     * than two rows of controls above a table, and one place to look when the
     * list is shorter than expected instead of two that can disagree.
     */
    value: 'collection',
    level: 'filters',
  },
];

const state = {
  // Billing opens where a claim's life starts: encounters not yet billed.
  tab: 'ready',
  chip: 'insurance',
  search: '',
  /* The header funnel's own values on every tab that has no more specific
     set. `dos` was one exact date and is now a bracket, like every other date
     filter on the screen — a claims worklist is read by a period, not by a
     day. */
  filters: { from: '', to: '', insurance: [], provider: [], pos: [] },
  /* Claims filters from a bar of its own rather than the header's search box
     and funnel, so it keeps its own values: switching tabs must not carry a
     coder filter onto a list of ERAs that has no coder. */
  claimFilters: { patient: [], provider: [], appType: [], from: '', to: '', coder: [] },
  /* Remits filters from a bar of its own, for the same reason and kept apart
     for the same reason: a patient picked over a list of claims means
     something different over a list of payments. */
  remitFilters: { patient: [], provider: [], serviceType: [], from: '', to: '' },
  /* Patient Collection's own filters. Kept apart from the two above for the
     same reason they are kept apart from each other, and holding different
     things entirely: nothing on a claim has an attempt count or an entity.
     `status` joined them when the Quick view chips went — it is the same
     value the chips carried, in the one place the rest now live. */
  collectionFilters: { status: [], bucket: [], attempts: [], entity: [], patient: [], balance: [] },
  selected: [],
  /* Which column the worklist is ordered by, set by clicking a sortable
     header. It is NOT cleared when the view changes, and that is deliberate:
     <ui-data-table> draws the arrow from its own memory of the last header
     clicked, so clearing this half of the pair would leave a column marked as
     sorted over rows that no longer are. A key the next view has no column
     for sorts nothing and shows no arrow, which is the same outcome without
     the contradiction. */
  sort: { key: null, dir: 'ascending' },
  claim: null,   /* the row the claim stage is showing */
  claimMode: null,
  remit: null,   /* the remit the remit stage is showing */
  /* AR Management. `asOf` and `width` are the two dials that decide what every
     figure on that tab MEANS — the date the ageing is measured to, and how
     wide one ageing column is — so they live beside the sub-view rather than
     in the shared filter state, which the worklist resets on every tab change.
     An empty `asOf` means the fixture's own today. */
  ar: { asOf: '', width: AR_DEFAULT_BUCKET_WIDTH, search: '', kind: null, accountId: null },
};

const tabDef = () => TABS.find((t) => t.value === state.tab);

/** Which chips are active tells you which dataset is on screen. */
function sourceFor(tab, chip) {
  if (tab === 'ready') return chip === 'self' ? data.readySelfPay : data.readyInsurance;
  if (tab === 'invoice') return data.invoices;
  if (tab === 'remits') return data.remits;
  if (tab === 'collection') return data.collections;
  return data.claims;
}

/** Rows for one chip, before search and filters. The count on the chip is
 *  this length — a chip that says 20 and shows 14 rows is a bug report. */
function chipRows(tab, chip) {
  const source = sourceFor(tab, chip);
  /* Unbilled Encounters and Remits both pick a whole list rather than filter one
     by status, so the source IS the answer. Patient Collection joined them
     when its Quick view chips went: status is one of the six fields behind its
     funnel now, applied in matchesCollectionFilters. */
  if (tab === 'ready' || tab === 'remits' || tab === 'collection' || chip === 'all') return source;
  return source.filter((row) => row.status === chip);
}

/* --- Search + filters ------------------------------------------------------
   Both are text matches over whatever fields the row happens to have, because
   the datasets do not share a schema and a per-view matcher would be four
   near-identical functions. */

function matchesSearch(row) {
  const needle = state.search.trim().toLowerCase();
  if (!needle) return true;
  return [row.id, row.patient, row.mrn, row.payer, row.cpt, row.claimId, row.chequeEft]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesFilters(row) {
  /* Payer and provider take a set. Denials are worked payer by payer, and the
     two Blues plans or the two hospital-employed physicians are one job, not
     two passes over the same worklist. */
  const { from, to, insurance, provider } = state.filters;
  if (!admits(insurance, row.payer)) return false;
  if (row.provider && !admits(provider, row.provider)) return false;
  /* Place of service is not carried on a worklist row — it lives on the claim
     detail. Filtering by it would silently empty the table, so it narrows
     nothing here and is honest about that in a flash instead. */
  if (from || to) {
    const iso = toIso(row.dos || row.submissionDate || row.receivedDate || '');
    if (from && iso && iso < from) return false;
    if (to && iso && iso > to) return false;
  }
  return true;
}

/** MM/DD/YYYY → YYYY-MM-DD, so a table date can be compared with a date input.
 *  Sortable as a string in that order, which is the only reason to convert. */
function toIso(value) {
  const parts = String(value || '').split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[0]}-${parts[1]}` : '';
}

/**
 * The Claims filter bar.
 *
 * From/To bracket the DATE OF SERVICE — the date a claims worklist is read by,
 * and the one every other date on the row is derived from. Every field matches
 * something the table shows: Service Type offers the scheduler's appointment
 * types, which is exactly what the App. Type column prints, so picking one
 * narrows to rows a reader can see match rather than to a hidden attribute.
 */
function matchesClaimFilters(row) {
  /* Provider, service type and coder take sets; patient names one person and
     stays a single answer. */
  const { patient, provider, appType, from, to, coder } = state.claimFilters;
  if (!admits(patient, row.patient)) return false;
  if (!admits(provider, row.provider)) return false;
  if (!admits(appType, row.appointmentType)) return false;
  if (!admits(coder, row.coder)) return false;
  if (from || to) {
    const dos = toIso(row.dos);
    if (from && dos < from) return false;
    if (to && dos > to) return false;
  }
  return true;
}

/**
 * Compare two cell values without being told which kind they are.
 *
 * A worklist column can hold money, a count, a MM/DD/YYYY date or a name, and
 * the columns that are sortable differ per view — so the comparator works out
 * what it has rather than each column declaring a type it would then have to
 * keep in step with its own renderer. Numbers before dates before text,
 * because "12.50" parses as a number and "07/12/2026" does not.
 */
function compareCells(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  if (a !== '' && b !== '' && a != null && b != null
    && Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;

  const isoA = toIso(a);
  const isoB = toIso(b);
  if (isoA && isoB) return isoA < isoB ? -1 : isoA > isoB ? 1 : 0;

  return String(a ?? '').localeCompare(String(b ?? ''));
}

/** The rows in the order a clicked header asked for. Untouched — the fixture's
 *  own order — until somebody clicks one. */
function sortRows(rows) {
  const { key, dir } = state.sort;
  if (!key) return rows;
  const sign = dir === 'descending' ? -1 : 1;
  return [...rows].sort((a, b) => sign * compareCells(a[key], b[key]));
}

/**
 * The Remits filter bar.
 *
 * Patient and Service Type are asked of the CLAIMS inside the remit, not of
 * the remit itself — a payment advice has no one patient, it has the several
 * whose claims it pays. So "Patient: Priya Raman" means "remits with money on
 * them for Priya Raman", which is the question a biller chasing one account
 * actually has. Provider is the remit's own billing provider, because that is
 * who the payment was made out to and what the detail screen names.
 *
 * From/To bracket the ERA date — the date the list is ordered and read by.
 */
function matchesRemitFilters(row) {
  /* A remit holds several claims, so service type is asked of the whole
     bundle: admitsAny keeps the remit if ANY claim on it is one of the types
     ticked, which is the same reasoning the single-value `some` already had. */
  const { patient, provider, serviceType, from, to } = state.remitFilters;
  if (!admits(provider, row.billingProvider)) return false;
  if (!admitsAny(patient, row.claims.map((claim) => claim.patient))) return false;
  if (!admitsAny(serviceType, row.claims.map((claim) => claim.serviceType))) return false;
  if (from || to) {
    const era = toIso(row.eraDate);
    if (from && era < from) return false;
    if (to && era > to) return false;
  }
  return true;
}

/** What a patient's account comes to across both entities. Derived, never
 *  stored — the Clinic and ASC columns are printed from the same charges, and
 *  a stored total is how a row comes to show three numbers that do not add
 *  up. */
const collectionTotal = (row) => Number((row.clinic + row.asc).toFixed(2));

/** A balance too small to be worth chasing. One predicate, read by the marker
 *  on the row and by the filter that puts them aside. */
const belowThreshold = (row) => collectionTotal(row) < SMALL_BALANCE_THRESHOLD;

/**
 * The Patient Collection bar.
 *
 * Every field narrows by something the table SHOWS — the ageing band, the
 * attempt count, an entity with money in it, a name, and whether the balance
 * is worth a stamp. A filter that narrowed by an invisible attribute would
 * empty the list for no reason the user could see.
 */
function matchesCollectionFilters(row) {
  const { status, bucket, attempts, entity, patient, balance } = state.collectionFilters;
  /* Status was the Quick view chips' job. Same value, one place to set it —
     and now a set, because chasing is done across rungs: everything at First
     notice AND everything at Second. Ageing buckets likewise, since 90+ and
     120+ are read together whenever a write-off list is being drawn up.
     Attempts, entity and balance stay single: each is a band or a side of a
     line, and ticking both halves is what leaving it blank already means. */
  if (!admits(status, row.status)) return false;
  if (!admits(bucket, collectionBucket(row.age))) return false;
  if (!admits(patient, row.patient)) return false;
  /* Attempts, entity and balance are each a band or a side of a line, and the
     panel asks them as `single` groups — ticking both halves is what leaving
     one blank already means. Each holds nothing or one thing. */
  const band = chosen(attempts)[0] ?? '';
  if (band) {
    const match = COLLECTION_ATTEMPT_BANDS.find((candidate) => candidate.value === band);
    if (match && !match.match(row.attempts)) return false;
  }
  /* Entity means "has money owing HERE", not "was seen here". A patient whose
     ASC balance is settled and whose clinic balance is not belongs to Clinic
     as far as anybody chasing it is concerned. */
  const side = chosen(entity)[0] ?? '';
  if (side === 'Clinic' && !(row.clinic > 0)) return false;
  if (side === 'ASC' && !(row.asc > 0)) return false;
  const worth = chosen(balance)[0] ?? '';
  if (worth === 'above' && belowThreshold(row)) return false;
  if (worth === 'below' && !belowThreshold(row)) return false;
  return true;
}

const visibleRows = () =>
  sortRows(
    chipRows(state.tab, state.chip).filter((row) =>
      state.tab === 'claims' ? matchesClaimFilters(row)
      : state.tab === 'remits' ? matchesRemitFilters(row)
      : state.tab === 'collection' ? matchesCollectionFilters(row)
      : matchesSearch(row) && matchesFilters(row)
    )
  );

/* An empty SET is falsy as a filter and truthy as a value, which is why these
   ask `chosen()` rather than `Boolean` — `[]` would otherwise report every
   worklist on the screen as filtered. */
const anyOn = (store) =>
  Object.values(store).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

const filtersActive = () => anyOn(state.filters);

const claimFiltersActive = () => anyOn(state.claimFilters);

/** Whether the funnel on Patient Collection is holding anything back — what
 *  Export says it exported. */
const collectionFiltersActive = () => anyOn(state.collectionFilters);

/* ============================================================================
   COLUMNS
   ========================================================================= */

const DENIAL_TONE = { 'Partially Denied': 'warning', 'Fully Denied': 'critical' };

/**
 * Which mode the claim stage opens a row in.
 *
 * The status decides it, not the caller: a claim is corrected where it broke,
 * and the same row opened from two different worklists must not read as two
 * different documents.
 */
function modeFor(row) {
  if (row.status === 'Scrub Error') return 'scrub';
  if (row.status === 'CH Rejected' || row.status === 'Rejected') return 'correct';
  if (row.denialCode) return 'denial';
  return 'edit';
}

/** Days since submission, marked once the timely-filing clock is worth
 *  watching. The mark is an icon as well as a colour. */
function ageCell(row) {
  if (row.age == null) return '—';
  const warn = row.age >= AGE_WARNING_DAYS;
  return `<span class="bil__age${warn ? ' bil__age--warn' : ''}">${row.age}d${
    warn ? icon('warning') : ''
  }</span>`;
}

/* --- Unbilled Encounters ----------------------------------------------------
   These rows are ENCOUNTERS, not claims: no CPT status, no payer response, no
   claim number, because none of that exists yet. What they carry is what a
   biller reads to decide whether the visit is billable at all. */

/* ============================================================================
   THE WORKLIST ROW, AS THE ENCOUNTERS LIST WRITES IT

   Billing's tables and the scheduler's Encounters worklist are the same visit
   at two moments of its life, and until now they were drawn as two different
   kinds of object: the scheduler gave a row an initials avatar, the name as a
   link, the patient's date of birth, age and sex under it, the visit's time
   under its date, the clinician's service under their name, the appointment
   in the colour the calendar draws it, and — at the end of the row — the ONE
   thing that row is for, as a button you can read rather than a menu you have
   to open. Billing gave it a grey outline of a person, a bare name, a bare
   date and a ⋮.

   So the cells are one vocabulary now, defined once here and used by every
   table on this screen. Five shapes:

     patientCell    avatar, name, and the facts that tell two people of the
                    same name apart
     stackCell      a fact over its qualifier — a date over the time of day
     providerCell   the clinician over what they do
     apptTypeCell   the appointment, in the colour the calendar draws it
     rowActions     the act this row exists for, beside the ⋮ holding the rest

   Nothing here invents a fact. Every second line is something the row already
   carried and the table was throwing away: the payer behind a coverage badge,
   the time behind a date, the service behind a provider's name.
   ========================================================================= */

/** Patients by MRN, for the identity line under a name. Built once: the
 *  worklists redraw on every keystroke in the search box, and a linear scan of
 *  the roster per cell would be a scan per row per keystroke. */
const PATIENT_BY_MRN = new Map(BILLING_PATIENTS.map((person) => [person.mrn, person]));

/** Whole years between a fixture date of birth ("14 Mar 1968") and today.
 *  Returns '' on anything it cannot read, so a row with no birth date shows
 *  one fewer fact rather than the word NaN. */
function yearsOld(dob) {
  const born = dob ? new Date(dob) : null;
  if (!born || Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) years -= 1;
  return years >= 0 && years < 130 ? `${years} yrs` : '';
}

/**
 * The patient: a face, a name, and what tells them apart.
 *
 * Date of birth, age and sex where the roster knows the person — the three
 * facts a biller checks a claim against before they ring a payer about it —
 * and the MRN where it does not. Patient Collection's accounts are the second
 * case: they are their own set of names, so their rows keep MRN under the name
 * exactly as they did.
 *
 * `link` is the attribute that makes the name a button — the row's own opener,
 * which differs per table. A name with nothing to open stays plain text rather
 * than becoming a link that goes nowhere.
 */
function patientCell(row, link = '') {
  const person = PATIENT_BY_MRN.get(row.mrn);
  const facts = person
    ? [person.dob, yearsOld(person.dob), person.sex?.[0]].filter(Boolean).join(' · ')
    : row.mrn ? `MRN ${row.mrn}` : '';

  const name = link
    ? `<button type="button" class="bil__who-name bil__link-btn" ${link}>${esc(row.patient)}</button>`
    : `<span class="bil__who-name">${esc(row.patient)}</span>`;

  return `<span class="bil__who">
    <ui-avatar name="${esc(row.patient)}" size="sm"></ui-avatar>
    <span class="bil__who-text">${name}${
      facts ? `<span class="bil__cell-sub">${esc(facts)}</span>` : ''
    }</span>
  </span>`;
}

/** A fact over the thing that qualifies it. The second line is dropped rather
 *  than drawn empty — a blank line under one date and not the next is a column
 *  that looks broken. */
function stackCell(main, sub) {
  return `<span class="bil__cell-main">${esc(main ?? '—')}</span>${
    sub ? `<span class="bil__cell-sub">${esc(sub)}</span>` : ''
  }`;
}

/** The clinician over their service. Which clinic a claim came out of decides
 *  who a biller asks about it, and the name alone does not say. */
function providerCell(name) {
  return name
    ? stackCell(name, BILLING_PROVIDER_ROLES[name] || '')
    : '<span class="bil__nil">—</span>';
}

/** The appointment, in the colour the calendar draws it — the same dot the
 *  scheduler's own lists carry, from the same APPOINTMENT_TYPES palette. A row
 *  whose type predates the id (nothing in the fixtures, but a hand-raised
 *  invoice could) falls back to the neutral dot rather than no dot, so the
 *  column keeps its left edge. */
function apptTypeCell(row) {
  return `<span class="bil__dot bil-t-${esc(row.apptTypeId || 'none')}"></span>${esc(
    row.appointmentType ?? '—'
  )}`;
}

/**
 * The end of the row: what it is FOR, then everything else.
 *
 * A ⋮ on its own is a row that will not say what it wants. Every worklist here
 * has one act that is the reason the row is in the queue — a ready encounter
 * is there to be billed, an account is there to be looked at — and that act is
 * now a button with its name on it, exactly as the Encounters worklist puts
 * Open Encounter and Review & Sign at the end of a note that is owed. The menu
 * stays beside it and keeps everything else, unchanged and in the same order.
 */
function rowActions(kind, id, action = ROW_ACTIONS[kind]) {
  return `<span class="bil__rowacts">
    <ui-button variant="outline" size="xs" icon="${action.icon}"
      data-row-action="${kind}" data-id="${esc(id)}"
      data-testid="bil--do-${esc(kind)}">${esc(action.label)}</ui-button>
    ${rowMenuBtn(kind, id)}
  </span>`;
}

/**
 * What that button says and does, per worklist.
 *
 * The LABEL is the one that matters twice: it is what the button reads, and it
 * is how the click handler finds the menu item to run. Naming the act once
 * here is what stops a button from doing something its twin in the ⋮ does not.
 */
const ROW_ACTIONS = {
  'ready-ins': { label: 'Generate Claim', icon: 'plus' },
  'ready-self': { label: 'Generate Invoice', icon: 'plus' },
  invoice: { label: 'View Invoice', icon: 'eye' },
  collection: { label: 'View Account', icon: 'eye' },
};

/**
 * Claims is the exception, because a claim's primary act changes with
 * where it broke: a scrub error is FIXED, a clearing-house rejection is
 * CORRECTED, a payer denial is APPEALED, and everything else is simply opened.
 * All four are one call — the claim stage in the mode modeFor() picks — so the
 * button cannot send a biller anywhere the menu's Edit would not.
 */
const CLAIM_PRIMARY = {
  scrub: { label: 'Fix Errors', icon: 'warning' },
  correct: { label: 'Correct', icon: 'pencil' },
  denial: { label: 'Appeal', icon: 'clipboard' },
  edit: { label: 'Open Claim', icon: 'eye' },
};

const READY_INSURANCE_COLUMNS = [
  /* The visit, and when in the day it happened. Two encounters for one patient
     on one date are otherwise the same row printed twice. */
  { key: 'dos', label: 'Date of Service', render: (r) => stackCell(r.dos, r.dosTime) },
  { key: 'patient', label: 'Patient Name', render: (r) => patientCell(r) },
  {
    key: 'coverage', label: 'Insurance Coverage',
    /* Out-of-network is the row you stop at, so it is coloured like one — and
       the payer whose network it is in or out of goes under it. The row has
       always carried the name; the column was throwing it away, which left
       "Out-of-Network" as a warning about nobody in particular. */
    render: (r) => `${badge(r.coverage, r.coverage === 'In-Network' ? 'success' : 'warning', 'sm')}
      ${r.payer ? `<span class="bil__cell-sub">${esc(r.payer)}</span>` : ''}`,
  },
  { key: 'provider', label: 'Rendering Provider', render: (r) => providerCell(r.provider) },
  { key: 'reason', label: 'Reason for Visit', truncate: true },
  { key: 'placeOfService', label: 'Place of Service' },
  { key: 'appointmentType', label: 'Appointment Type', render: apptTypeCell },
  {
    key: 'action', label: 'Actions', actions: true,
    render: (r) => rowActions('ready-ins', r.id),
  },
];

const READY_SELF_PAY_COLUMNS = [
  { key: 'id', label: 'Encounter ID' },
  { key: 'dos', label: 'Date of Service', render: (r) => stackCell(r.dos, r.dosTime) },
  { key: 'patient', label: 'Patient Name', render: (r) => patientCell(r) },
  { key: 'provider', label: 'Rendering Provider', render: (r) => providerCell(r.provider) },
  { key: 'reason', label: 'Reason for Visit', truncate: true },
  { key: 'appointmentType', label: 'Appointment Type', render: apptTypeCell },
  { key: 'billAmount', label: 'Bill Amount ($)', render: (r) => money(r.billAmount) },
  {
    key: 'status', label: 'Status', sortable: true,
    /* What the patient has already paid at the desk — not the state of a
       claim, because a self-pay visit never becomes one. */
    render: (r) => badge(r.status, r.status === 'Paid' ? 'success' : 'critical', 'sm'),
  },
  {
    key: 'action', label: 'Actions', actions: true,
    render: (r) => rowActions('ready-self', r.id),
  },
];

/* --- Claims -----------------------------------------------------------------
   The one worklist, and the widest table on the screen. Every column earns its
   width by answering a question a biller actually asks of a claim: whose, for
   what, from where, worth how much, how long has it been sitting, and where
   has it got to. */

/**
 * The status, reported and not editable.
 *
 * It was a dropdown. A claim's status is the one thing on this row that is a
 * CONSEQUENCE — of a scrub, a submission, a clearing-house answer, a payer's
 * adjudication — and letting it be set by hand meant the badge could say
 * Accepted while no submission had ever been stamped, and the ageing clock and
 * the submit date would disagree with it. Every status here is reached by the
 * act that causes it, so the cell reports and nothing more.
 */
function statusCell(row) {
  return badge(row.status, CLAIM_STATUS_TONE[row.status] || 'neutral', 'sm');
}

function claimsColumns() {
  return [
    { key: 'originalClaimDate', label: 'Original Claim Date' },
    /* The name is the claim's own opener — the row is read patient-first, and
       the thing a biller wants when they find theirs is the claim itself. */
    {
      key: 'patient', label: 'Patient Name', wrap: true,
      render: (r) => patientCell(r, `data-open-claim="${esc(r.id)}"`),
    },
    /* The scheduler's own type, spelled the way the booking form spelled it.
       Truncating rather than abbreviating: an invented short code would be a
       second name for the appointment, and matching a claim back to the visit
       that produced it is the entire job of this column. */
    { key: 'appointmentType', label: 'App. Type', truncate: true, render: apptTypeCell },
    { key: 'id', label: 'Claim ID' },
    { key: 'dos', label: 'DOS' },
    {
      key: 'location', label: 'Location',
      /* Clinic or ASC — the distinction that decides whether a facility fee is
         billed at all, and so which of the two paper forms the row menu should
         be reached for. The site's own name is the tooltip. */
      render: (r) => `<span title="${esc(r.site)}">${esc(r.location)}</span>`,
    },
    { key: 'payer', label: 'Payer', truncate: true },
    { key: 'charge', label: 'Total Charge ($)', numeric: true, render: (r) => money(r.charge) },
    {
      key: 'expectedCollection', label: 'Expected Collection ($)', numeric: true,
      render: (r) => money(r.expectedCollection),
    },
    { key: 'updatedDate', label: 'Updated Date' },
    { key: 'age', label: 'Claim Ageing', numeric: true, render: ageCell },
    { key: 'notes', label: 'Notes', truncate: true },
    { key: 'status', label: 'Status', sortable: true, render: statusCell },
    {
      key: 'action', label: 'Actions', actions: true,
      render: (r) => rowActions('claim', r.id, CLAIM_PRIMARY[modeFor(r)]),
    },
  ];
}

/* --- Invoice ----------------------------------------------------------------
   The patient's own bill. Narrower than a claim's worklist by half, because
   there is no clearing house, no payer response and no ageing to watch — an
   invoice is a document with three numbers on it, and the three are shown
   side by side precisely so that Total − Payment = Due can be checked at a
   glance rather than taken on trust. */

const INVOICE_TYPE_TONE = Object.fromEntries(
  INVOICE_TYPES.map((type) => [type.label, type.tone])
);

/** A dot and a word, rather than a badge. Six types on a table this wide
 *  would be six pills competing with the Status column beside them for the
 *  same attention — the dot carries the colour, the status keeps the pill. */
function invoiceTypeCell(row) {
  const tone = INVOICE_TYPE_TONE[row.type] || 'neutral';
  return `<span class="bil__inv-type">
    <span class="bil__inv-dot bil__inv-dot--${tone}"></span>${esc(row.type)}</span>`;
}

const INVOICE_COLUMNS = [
  {
    key: 'id', label: 'Invoice ID',
    /* Hashed, because that is what an invoice number is to whoever is holding
       the paper — and it is the one string on the row a patient will read out
       over the phone. */
    render: (r) => `<button type="button" class="ui-text-link ui-text-link--default"
      data-open-invoice="${esc(r.id)}">#${esc(r.id)}</button>`,
  },
  { key: 'invoiceDate', label: 'Invoice Date', sortable: true },
  { key: 'patient', label: 'Patient Name', render: (r) => patientCell(r) },
  { key: 'appointmentType', label: 'Appointment Type', render: apptTypeCell },
  { key: 'dos', label: 'Date of Service' },
  { key: 'provider', label: 'Rendering Provider', render: (r) => providerCell(r.provider) },
  { key: 'type', label: 'Invoice Type', sortable: true, render: invoiceTypeCell },
  { key: 'total', label: 'Total Amount ($)', numeric: true, render: (r) => money(r.total) },
  { key: 'payment', label: 'Payment ($)', numeric: true, render: (r) => money(r.payment) },
  {
    key: 'due', label: 'Due ($)', numeric: true, sortable: true,
    /* Nothing owed is shown as a plain zero rather than dashed out: on this
       column a 0.00 is the good news, and it has to read as an amount so the
       row above and below can be compared with it. */
    render: (r) => `<span class="${r.due > 0 ? 'bil__inv-due' : ''}">${money(r.due)}</span>`,
  },
  {
    key: 'status', label: 'Status', sortable: true,
    render: (r) => badge(r.status, INVOICE_STATUS_TONE[r.status] || 'neutral', 'sm'),
  },
  {
    key: 'action', label: 'Actions', actions: true,
    render: (r) => rowActions('invoice', r.id),
  },
];

/* --- Remits ------------------------------------------------------------------
   The payment advice as a worklist row. Where it came from and whether it has
   been posted are the two things that decide what you do with it, so they are
   the two coloured columns. */

const REMIT_SOURCE_TONE = {
  'EDI Upload': 'warning', 'Manual Entry': 'info', 'Clearing House': 'neutral',
};
const REMIT_STATUS_TONE = {
  'Not Posted': 'critical', 'Partially Posted': 'warning', Posted: 'success',
};
const REMIT_CLAIM_TONE = {
  'Submitted Outside': 'info', Processed: 'neutral', Denied: 'critical', Posted: 'success',
};

/**
 * A remit's status, worked out from the claims on it rather than stored.
 *
 * There is only one fact here — which claims have been posted — and storing a
 * second copy of it on the remit is how a list ends up saying Posted over a
 * detail screen showing three claims that are not. A remit with no claims yet
 * (one keyed in by hand) has nothing posted, which is exactly Not Posted.
 */
function remitStatus(remit) {
  const posted = remit.claims.filter((claim) => claim.status === 'Posted').length;
  if (!posted) return 'Not Posted';
  return posted === remit.claims.length ? 'Posted' : 'Partially Posted';
}

/* No action column. Everything a remit offers is either its control number,
   which opens it, or posting — and posting is a batch, which is what the tick
   boxes are for. A ⋮ holding one item that repeats the checkbox beside it is
   furniture, and it was the first thing asked to go. */
const REMIT_COLUMNS = [
  {
    key: 'controlNumber', label: 'ERA Control Number',
    render: (r) => `<button type="button" class="ui-text-link ui-text-link--default"
      data-open-remit="${esc(r.id)}">${esc(r.controlNumber)}</button>`,
  },
  { key: 'eraDate', label: 'ERA Date', sortable: true },
  { key: 'checkEft', label: 'Check/EFT No', numeric: true },
  /* Not every remit records how it was paid. A dash says the payer did not
     tell us; inventing an EFT would be worse than the gap. */
  { key: 'paymentMethod', label: 'Payment Method', render: (r) => esc(r.paymentMethod) || '—' },
  { key: 'paymentDate', label: 'Payment Date' },
  { key: 'payer', label: 'Payer Name', truncate: true },
  { key: 'amount', label: 'Amount', numeric: true, sortable: true, render: (r) => dollars(r.amount) },
  { key: 'source', label: 'Source', render: (r) => badge(r.source, REMIT_SOURCE_TONE[r.source], 'sm') },
  {
    /* Not sortable, unlike every other Status column here. sortRows() orders
       by the row's own field, and this one has none — it is computed from the
       claims. A header that sorted nothing would be worse than a plain one. */
    key: 'status', label: 'Status',
    render: (r) => badge(remitStatus(r), REMIT_STATUS_TONE[remitStatus(r)], 'sm'),
  },
];

/* --- Patient Collection ------------------------------------------------------
   One row per patient account, not per charge: the thing being worked is a
   PERSON who owes money, and splitting them across four rows would mean four
   notices in the same envelope.

   Clinic and ASC are separate columns rather than one Total with an entity
   label because they are separate conversations — the surgical centre's
   thousands and the clinic's tens are chased differently, and a patient who
   owes both needs to see both before anyone rings them. Total Outstanding is
   the sum, printed once, so the eye does not have to add up two columns to
   find out whether the row is worth a phone call. */

/** Money owed at one entity. Zero is a dash: a column of "$0.00" is a column
 *  of nothing to do, and it should not read as loudly as a column of debts. */
const entityCell = (value) =>
  (value > 0 ? dollars(value) : '<span class="bil__nil">—</span>');

/**
 * The total, marked when it is too small to chase.
 *
 * The mark is under the figure rather than in a column of its own: it is a
 * fact ABOUT this number — that pursuing it costs more than it recovers — and
 * a separate column would be a column that is empty on 204 of 212 rows.
 */
function collectionTotalCell(row) {
  const total = collectionTotal(row);
  return `<span class="bil__amount">
    <strong>${dollars(total)}</strong>
    ${belowThreshold(row) ? '<span class="bil__amount-note">below threshold</span>' : ''}
  </span>`;
}

const COLLECTION_COLUMNS = [
  {
    key: 'id', label: 'Account #',
    render: (r) => `<button type="button" class="ui-text-link ui-text-link--default"
      data-open-account="${esc(r.id)}">#${esc(r.id)}</button>`,
  },
  /* No link on the name — the ACCOUNT number opens the account here, and two
     links to one place in one row is a question about which of them does
     something different. */
  { key: 'patient', label: 'Patient Name', wrap: true, sortable: true, render: (r) => patientCell(r) },
  { key: 'clinic', label: 'Clinic', numeric: true, render: (r) => entityCell(r.clinic) },
  { key: 'asc', label: 'ASC', numeric: true, render: (r) => entityCell(r.asc) },
  {
    key: 'total', label: 'Total Outstanding', numeric: true, sortable: true,
    render: collectionTotalCell,
  },
  {
    /* Derived from the age of the oldest unpaid charge every time it is drawn,
       so it cannot contradict the ageing the chip counts and the filter use. */
    key: 'age', label: 'Ageing Bucket', sortable: true,
    render: (r) => badge(collectionBucket(r.age), collectionAgeTone(r.age), 'sm'),
  },
  { key: 'attempts', label: 'Attempts', numeric: true, sortable: true },
  {
    key: 'status', label: 'Status', sortable: true,
    render: (r) => badge(r.status, COLLECTION_STATUS_TONE[r.status] || 'neutral', 'sm'),
  },
  { key: 'lastNotice', label: 'Last Notice', render: (r) => esc(r.lastNotice) || '<span class="bil__nil">—</span>' },
  {
    key: 'planStatus', label: 'Payment Plan',
    render: (r) => (r.planStatus ? badge(r.planStatus, 'success', 'sm') : '<span class="bil__nil">—</span>'),
  },
  { key: 'lastPayment', label: 'Last Payment', render: (r) => esc(r.lastPayment) || '<span class="bil__nil">—</span>' },
  {
    key: 'action', label: 'Actions', actions: true,
    render: (r) => rowActions('collection', r.id),
  },
];

/** The ageing badge warms as the balance ages, so a scan down the column finds
 *  the old money without reading a single number. */
function collectionAgeTone(age) {
  if (age >= 90) return 'critical';
  if (age >= 60) return 'warning';
  if (age >= 30) return 'info';
  return 'neutral';
}

/* ============================================================================
   THE VIEW — columns, selectability, header actions and wording for the
   current (tab, chip). The single source of "what does this view do".
   ========================================================================= */

/**
 * Which chips of Claims can act on a batch, and what that act is.
 *
 * Three, out of seventeen. A batch action needs every ticked row to be waiting
 * for the SAME next step, which is only true inside one status — and only for
 * the three where the next step is a send. There is no batch answer to a
 * denial: each one is argued on its own facts.
 */
const CLAIM_BULK = {
  'New': { id: 'bulkScrub', label: 'Submit to Scrub' },
  'Ready to Submit': { id: 'bulkSubmitCh', label: 'Submit to Clearing House' },
  /* Not Submitted — that one is waiting on the clearing house to answer, and
     there is nothing a batch can do about somebody else's queue. CH Accepted
     is the batch: the clearing house has passed them, and they go on. */
  'CH Accepted': { id: 'bulkSubmitPayer', label: 'Submit to Payer' },
};

/**
 * The header carries a search box unless the view says otherwise.
 *
 * The funnel is no longer one of this object's concerns. It used to be — a
 * `filterModal` naming which of two dialogs a tab meant, and a `filterBar`
 * naming which of two bars — because a tab had to say which of four filter
 * controls was its own. There is one, and filterSpecFor() decides what it
 * asks; a tab with nothing to ask (AR) simply gets no spec and no button.
 */
const view = () => ({ search: true, ...viewFor() });

function viewFor() {
  const { tab, chip } = state;

  /* AR carries its own controls on its own card, so the page header keeps
     nothing at all: the worklist's search box narrows a list of claims, and
     there is no list of claims here to narrow. */
  if (tab === 'ar') {
    return { columns: [], selectable: false, noun: 'accounts', empty: '', bulk: null, extras: [], search: false };
  }

  if (tab === 'collection') {
    return {
      columns: COLLECTION_COLUMNS,
      /* Every rung can be ticked, unlike Claims where only three can. A notice
         is the same document whatever stage the balance is at — it is the act
         of telling a patient they owe money — so there is no rung where a
         batch of them means nothing. */
      selectable: true,
      noun: 'accounts',
      empty: 'No patient balances match this filter.',
      bulk: { id: 'bulkSendNotice', label: 'Send notice' },
      /* Export before the bulk button because it acts on what is ON SCREEN
         rather than on what is ticked — it is a different kind of verb, and
         putting it beside "Send notice (3)" would read as another thing that
         happens to those three. */
      extras: [{ id: 'collectionExport', variant: 'outline', icon: 'download', label: 'Export' }],
      /* Six filters behind the funnel, and nothing else over the table — no
         search box and no chip row. See the TABS entry. */
      search: false,
      filterModal: 'collection',
    };
  }

  if (tab === 'ready') {
    if (chip === 'self') {
      return {
        columns: READY_SELF_PAY_COLUMNS,
        /* No checkbox column. An invoice is raised for one patient at a time
           — it is addressed to them and carries their balance — so there is
           no batch of them to tick. */
        selectable: false,
        noun: 'encounters',
        empty: 'No self-pay encounters waiting to be billed.',
        bulk: null,
        extras: [],
      };
    }
    return {
      columns: READY_INSURANCE_COLUMNS,
      selectable: true,
      noun: 'encounters',
      empty: 'No insured encounters waiting to be billed.',
      bulk: { id: 'bulkGenerateClaim', label: 'Generate Claim' },
      extras: [],
    };
  }

  if (tab === 'claims') {
    return {
      columns: claimsColumns(),
      /* Only the three chips with a bulk action can be ticked. A checkbox
         column on a view with nothing to do to a batch is furniture — and on
         All, where the rows are at seventeen different stages, there is no one
         thing a batch of them could be asked to do. */
      selectable: Boolean(CLAIM_BULK[chip]),
      noun: 'claims',
      empty: 'No claims match this filter.',
      bulk: CLAIM_BULK[chip] || null,
      /* Nothing is created by hand here: a claim arrives from an encounter or
         a file, never from someone typing one in. */
      extras:
        chip === 'Ready to Submit'
          ? [{ id: 'paperClaim', variant: 'outline', label: 'Generate Paper Claim' }]
          : [],
      /* The bar above the table is this tab's filtering, so the header keeps
         neither the search box nor the funnel — two ways to filter by provider
         is one more than anybody needs, and they would disagree. */
      search: false,
    };
  }

  if (tab === 'invoice') {
    return {
      columns: INVOICE_COLUMNS,
      /* No checkbox column, for the reason Self Pay gives above: an invoice is
         addressed to one patient and carries their balance, so there is no
         batch of them to tick and nothing a batch could be asked to do. */
      selectable: false,
      noun: 'invoices',
      empty: 'No invoices match this filter.',
      bulk: null,
      /* One button, not a split control. It raises the ordinary self-pay
         invoice — what nearly every one of these is — and the kind that
         isn't is a Payment Method away inside the document itself, which is
         where the rest of the invoice is decided anyway. */
      extras: [
        { id: 'invoiceAdd', variant: 'primary', icon: 'plus', label: 'Add Invoice' },
      ],
    };
  }

  if (tab === 'remits') {
    return {
      columns: REMIT_COLUMNS,
      /* The tick boxes ARE this tab. Posting is the only thing a remit is
         waiting for, and remits are cleared a morning at a time — so unlike
         the claim queues, every row here can be ticked, whatever state it is
         in. Posting skips what is already posted rather than the checkbox
         column disappearing under half the list. */
      selectable: true,
      noun: 'remits',
      empty: 'No remits match these filters.',
      bulk: { id: 'bulkPostRemits', label: 'Post Remits' },
      extras: [
        { id: 'remitUploadPdf', variant: 'outline', label: 'Upload PDF' },
        { id: 'remitUploadEdi', variant: 'outline', label: 'Upload EDI' },
        { id: 'remitAdd', variant: 'outline', label: 'Add Remit' },
      ],
      /* Filtered from its own bar, so the header keeps neither the search box
         nor the funnel — the funnel's four fields are about claims. */
      search: false,
    };
  }

  /* Every tab in the strip is answered above. Reaching here means the strip
     is offering one this view model has never heard of — which happens for
     exactly as long as it takes to add the other half of a new tab. An empty
     worklist says so; returning nothing would blank the screen with a type
     error and give no clue which half is missing. */
  return {
    columns: [],
    selectable: false,
    noun: 'rows',
    empty: 'This section has not been built yet.',
    bulk: null,
    extras: [],
    search: false,
  };
}

/* ============================================================================
   PAINT
   ========================================================================= */

const table = () => document.getElementById('worklist');
let pager;

/**
 * The second-level switch — ONE shape, whatever the tab.
 *
 * It used to be drawn two ways: a pill-on-a-track strip where the second level
 * picked between different LISTS (Insurance / Self Pay, and AR's three views),
 * and a row of outlined chips behind the word "Status" where it filtered ONE
 * list (a claim's stages, an invoice's). The argument was that a chip reads as
 * "narrow this" and a tab reads as "different rows" — true of the words, and
 * not true of what a reader saw: two shapes, at the same level, in the same
 * slot, one of them dragging a label with it, and the eye had to work out
 * which kind of control it was looking at before it could use it.
 *
 * They are all the same switch now, in the same track, in the same place on
 * every tab — the shape the scheduler's Encounters queue uses over Unsigned /
 * Signed. The label went with the chips: "Status" over a strip whose segments
 * are named New, Scrub Error and Ready to Submit was naming what they
 * obviously are, and it survives as the strip's aria-label, where it is read
 * by the people who cannot see the segments.
 *
 * NO COUNTS ON THEM. Seven numbers riding seven segments turned the switch
 * into a small report — the eye read the badges before the words, and the
 * widest word in the strip was a figure that changes as claims move. Where a
 * count matters it is already said, once, in a sentence, under the rows the
 * segment opened: "1-10 of 205 claims". That is the whole set, not the page,
 * which is exactly what the badge was claiming to count. Encounters carries
 * its two numbers the same way and its strip is bare.
 *
 * Every segment answers [data-chip], as both shapes always did.
 */
function paintChips() {
  const def = tabDef();
  const host = document.getElementById('statusChips');

  /* A tab with no second level at all — Remits, Patient Collection — takes the
     whole band out rather than drawing an empty one. An empty track reads as a
     control that failed to load. */
  const bar = document.getElementById('statusBar');
  bar.hidden = def.level === 'filters';
  if (bar.hidden) {
    host.innerHTML = '';
    return;
  }

  host.setAttribute('aria-label', def.chipLabel);

  host.innerHTML = def.chips
    .map((chip) => {
      const active = chip.key === state.chip;
      return `<button type="button" class="bil__subtab${active ? ' bil__subtab--active' : ''}"
        role="tab" aria-selected="${active}" data-chip="${esc(chip.key)}"
        data-testid="bil--chip-${esc(chip.key)}">${esc(chip.label)}</button>`;
    })
    .join('');
}

/**
 * The header's right-hand half.
 *
 * Rebuilt only when the VIEW changes, never on a repaint: the search field
 * lives in here, and rebuilding it on every keystroke would take the caret
 * with it. The bulk button's enabled state is patched separately, below.
 */
function paintHeaderActions() {
  const config = view();
  const host = document.getElementById('toolbarActions');

  const extras = config.extras.map((extra) =>
    `<ui-button variant="${extra.variant}"${extra.icon ? ` icon="${extra.icon}"` : ''}${
      /* icon-only still needs the words: the label becomes the accessible
         name rather than disappearing with the text. */
      extra.iconOnly ? ` icon-only label="${esc(extra.label)}"` : ''
    } id="${extra.id}" data-testid="bil--${extra.id}">${esc(extra.label)}</ui-button>`
  ).join('');

  /* Narrowing first, then acting: the search box and the funnel are about the
     list below, and the button that adds to it ends the row — the order the
     Patients directory and every other worklist header already uses. */
  host.innerHTML = `
    ${config.search ? `
      <ui-input id="wlSearch" icon="search" label="Search" label-hidden placeholder="Search"
        value="${esc(state.search)}" data-testid="bil--search"></ui-input>` : ''}
    ${extras}
    ${config.bulk ? '<span id="bulkHost"></span>' : ''}`;

  syncBulkButton();
}

/**
 * THE HEADER'S FILTER, PER TAB.
 *
 * This screen used to carry four filters that were four different controls:
 * a modal for most tabs, a second modal for Patient Collection, and a bar of
 * six named fields over the table on each of Claims and Remits. Each was a
 * reasonable answer to "narrow this list", and together they meant that
 * learning to filter Claims taught you nothing about filtering Remits — on the
 * same screen, one tab apart.
 *
 * They are one control now (js/components/ui-filter.js), restocked per tab.
 * `store` names the slice of `state` this tab's answers live in — kept apart
 * per tab exactly as before, because a coder ticked over a list of claims
 * means nothing over a list of ERAs — and every group is named after its key
 * in that slice, which is what lets one listener write any of them back.
 *
 * `range` says this tab brackets a date, and which two keys hold the ends. The
 * pair of inputs is declared once in billing.html and lent to the panel; see
 * the note there.
 */
function filterSpecFor() {
  const { tab } = state;

  if (tab === 'ar') return null;

  if (tab === 'claims') {
    return {
      store: 'claimFilters',
      noun: 'claims',
      range: true,
      groups: [
        { name: 'patient', label: 'Patient', single: true,
          options: [...new Set(data.claims.map((row) => row.patient))].sort() },
        { name: 'provider', label: 'Provider', options: BILLING_PROVIDERS },
        /* The scheduler's fifteen types, by title — the same string the App.
           Type column prints, so a tick narrows to rows a reader can see match
           rather than to a hidden attribute. */
        { name: 'appType', label: 'Service type',
          options: CLAIM_APP_TYPES.map((type) => type.title) },
        { name: 'coder', label: 'Coder', options: CLAIM_CODERS },
      ],
    };
  }

  if (tab === 'remits') {
    return {
      store: 'remitFilters',
      noun: 'remits',
      range: true,
      groups: [
        { name: 'patient', label: 'Patient', single: true,
          options: [...new Set(
            data.remits.flatMap((remit) => remit.claims.map((claim) => claim.patient))
          )].sort() },
        { name: 'provider', label: 'Provider', options: BILLING_PROVIDERS },
        { name: 'serviceType', label: 'Service type', options: REMIT_SERVICE_TYPES },
      ],
    };
  }

  if (tab === 'collection') {
    return {
      store: 'collectionFilters',
      noun: 'accounts',
      groups: [
        /* Status was the Quick view chips' job. Same value, one place to set
           it — and a set, because chasing is done across rungs: everything at
           First notice AND everything at Second. */
        { name: 'status', label: 'Status', options: COLLECTION_STATUSES },
        { name: 'bucket', label: 'Ageing bucket', options: COLLECTION_BUCKETS },
        { name: 'attempts', label: 'Attempts', single: true,
          options: COLLECTION_ATTEMPT_BANDS.map((band) => ({ value: band.value, label: band.label })) },
        { name: 'entity', label: 'Entity', single: true, options: COLLECTION_ENTITIES },
        { name: 'patient', label: 'Patient', single: true,
          options: [...new Set(data.collections.map((row) => row.patient))].sort() },
        /* Named for the money rather than for the rule, so the answer still
           reads when the threshold moves: "Below $25" would be a second place
           the number lives and a second place to forget to change it. */
        { name: 'balance', label: 'Balance', single: true, options: [
          { value: 'above', label: 'Worth chasing' },
          { value: 'below', label: 'Below threshold' },
        ] },
      ],
    };
  }

  return {
    store: 'filters',
    noun: view().noun ?? 'list',
    range: true,
    groups: [
      { name: 'insurance', label: 'Payer', options: PAYERS.map((p) => p.name) },
      { name: 'provider', label: 'Provider', options: BILLING_PROVIDERS },
      { name: 'pos', label: 'Place of service', options: PLACES_OF_SERVICE },
    ],
  };
}

/** The one control, stocked for whichever tab is open and filled from state. */
function syncFilterControl() {
  const filter = document.getElementById('wlFilter');
  if (!filter) return;

  const spec = filterSpecFor();
  filter.hidden = !spec;
  if (!spec) return;

  filter.setAttribute('panel-label', `Filter ${spec.noun}`);

  const range = document.getElementById('wlRange');
  filter.setGroups([
    ...spec.groups,
    ...(spec.range ? [{ kind: 'fields', name: 'range', label: 'Date range', node: range }] : []),
  ]);

  /* setGroups first, then the values: an answer filtered against the previous
     tab's vocabulary would be quietly dropped. */
  const store = state[spec.store];
  filter.value = Object.fromEntries(spec.groups.map((g) => [g.name, chosen(store[g.name])]));

  if (spec.range) writeRange(store.from, store.to);
}

/** Push the two ends of the range into the fields the panel borrows. */
function writeRange(from, to) {
  for (const [id, value] of [['wlFrom', from ?? ''], ['wlTo', to ?? '']]) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.setAttribute('value', value);
    const control = node.querySelector('input');
    if (control && control.value !== value) control.value = value;
  }
}

/** A tick, or a date. Same route for both: write it down, repaint the list. */
function applyFilterChange() {
  pager.reset();
  clearSelection();
  /* Not `headerToo` — the header rebuild would tear the open panel out from
     under the reader's hand mid-tick. */
  paint();
}

function onWorklistFilterChange(values) {
  const spec = filterSpecFor();
  if (!spec) return;
  Object.assign(state[spec.store], values);

  if (spec.store === 'filters' && chosen(values.pos).length) {
    flash('Place of service lives on the claim, not the worklist — it does not narrow this list.');
  }
  applyFilterChange();
}

function onWorklistRangeChange() {
  const spec = filterSpecFor();
  if (!spec?.range) return;
  const store = state[spec.store];
  store.from = document.getElementById('wlFrom')?.value || '';
  store.to = document.getElementById('wlTo')?.value || '';
  applyFilterChange();
}

/** Everything on this tab back to the whole list. */
function clearWorklistFilters() {
  const spec = filterSpecFor();
  if (!spec) return;
  for (const group of spec.groups) state[spec.store][group.name] = [];
  if (spec.range) {
    state[spec.store].from = '';
    state[spec.store].to = '';
    writeRange('', '');
  }
  applyFilterChange();
}

/**
 * A bulk action is meaningless with nothing ticked, and the button says so
 * rather than opening a dialog that reports "0 claims".
 *
 * The whole button is rebuilt rather than relabelled: <ui-button> reads its
 * text once at upgrade and renders its own innards from it, so assigning
 * textContent would throw those innards away and leave an empty button.
 */
function syncBulkButton() {
  const config = view();
  const host = document.getElementById('bulkHost');
  if (!config.bulk || !host) return;

  const count = state.selected.length;
  host.innerHTML = `<ui-button variant="primary" id="${config.bulk.id}"
    ${count ? '' : 'disabled'} data-testid="bil--bulk">${esc(config.bulk.label)}${
      count ? ` (${count})` : ''
    }</ui-button>`;
}

function paintTable() {
  const config = view();
  const rows = visibleRows();
  const host = table();

  host.toggleAttribute('selectable', Boolean(config.selectable));
  host.setAttribute('empty-text', config.empty);

  // One pager serves every view here, and they are not all lists of claims —
  // Unbilled Encounters holds encounters and the ERA tab holds ERAs.
  pager.setNoun(config.noun);

  const { start, end } = pager.render(rows.length);
  const slice = rows.slice(start, end);

  /* Emptied before the columns change, because <ui-data-table> repaints on
     EVERY assignment: setting columns alone renders the new columns against
     the rows still in the table, i.e. one view's renderers over another view's
     data. Most columns survive that — they read row[key] and get undefined —
     but any renderer reaching INTO a row (a remit's claims, an invoice's
     lines) throws on the row shape it was never meant to see, and the paint
     dies half done. Three renders of a ten-row table costs nothing; the
     mismatch cost the whole tab. */
  host.rows = [];
  host.columns = config.columns;
  host.rows = slice;
  host.setAttribute('state', slice.length ? 'ready' : 'empty');
}

/** Everything below the tabs, after a change of tab, chip, search or filter.
 *
 *  AR forks here rather than inside each painter: it has no chip row, no
 *  worklist and no filter bar, so calling those three to have them each decide
 *  they have nothing to do would be three chances to paint a stale table into
 *  a panel the user is not looking at. */
function paint({ headerToo = false } = {}) {
  if (headerToo) paintHeaderActions();
  if (state.tab === 'ar') { paintAr(); return; }
  syncFilterControl();
  paintChips();
  paintTable();
}

function selectChip(key) {
  if (state.chip === key) return;
  state.chip = key;
  // Ticks refer to rows that are about to leave the screen, and a bulk action
  // carrying them over would act on claims nobody can see.
  state.selected = [];
  table().clearSelection();
  pager.reset();
  // AR's two tables are different lists of different lengths, so page three of
  // the payers must not become page three of a shorter list of patients.
  arPager?.reset();
  paint({ headerToo: true });
}

function selectTab(value) {
  state.tab = value;
  /* A tab with no second level has no chip to land on. Patient Collection is
     one now, and Remits always was — `all` is the value every downstream
     reader already treats as "no chip is narrowing this". */
  state.chip = tabDef().chips?.[0]?.key ?? 'all';
  state.search = '';
  /* AR's search too, for the reason the worklist clears its own: a payer name
     left in the box would come back over a list of patients and empty it, with
     the term that did it sitting in a control the user had forgotten. The two
     dials are NOT cleared — an as-of date is a question the user asked about
     the report, and it should still be the question when they come back. */
  state.ar.search = '';
  state.selected = [];
  table().clearSelection();
  pager.reset();
  /* One worklist, three panels: it moves into whichever the strip just opened.
     ui-tabs has already hidden the others by the time this runs.

     AR is the fourth panel and does NOT take the worklist — it has a card of
     its own. Moving the worklist in would park a table of claims under a bar
     chart, so it is left in the panel it was last shown in and comes back with
     that tab. */
  if (value !== 'ar') {
    document.getElementById(`panel-${value}`).appendChild(document.getElementById('billingHome'));
  }
  paint({ headerToo: true });
}

/** Drive the strip from code — used when a finished flow lands the user on a
 *  different tab. Setting the attribute patches the strip and its panels but
 *  deliberately fires no ui-change, so the move is made here instead. */
function goToTab(value) {
  document.querySelector('ui-tabs').setAttribute('selected', value);
  selectTab(value);
}

/* ============================================================================
   BULK FLOWS — confirm, run, report.

   Scrubbing a batch, sending it to the clearing house and sending it on to the
   payer are the same three beats, so they share the three dialogs and differ
   only in their wording and in what they do to the rows at the end.
   ========================================================================= */

let progressTimer = null;

/**
 * Run the progress dialog for `total` units of work, then hand over.
 *
 * `label` makes the counter a sentence ("16/48 Claims Scrubbed"); leaving it
 * out gives a spinner with no count, which is right when the work is one
 * indivisible request rather than a queue.
 */
function runProgress({ heading, note, total, label, onDone }) {
  const dialog = modal('modalProgress');
  dialog.setAttribute('heading', heading);
  document.getElementById('progressNote').textContent = note;

  const title = document.getElementById('progressTitle');
  let done = 0;
  const tick = () => {
    done += Math.max(1, Math.ceil(total / 12));
    if (done >= total) {
      done = total;
      stopProgress();
      dialog.close();
      onDone?.();
    }
    title.textContent = label ? `${done}/${total} ${label}` : heading;
  };

  title.textContent = label ? `0/${total} ${label}` : heading;
  dialog.open();
  progressTimer = setInterval(tick, 160);
}

function stopProgress() {
  clearInterval(progressTimer);
  progressTimer = null;
}

/** Open the confirm dialog. `tone` picks the commit button's weight — orange
 *  for a batch that changes state, brand for an ordinary confirmation. */
function confirmThen({ heading, body, commit, tone = 'warning', onConfirm }) {
  const dialog = modal('modalConfirm');
  dialog.setAttribute('heading', heading);
  document.getElementById('confirmBody').innerHTML = body;

  // Rebuilt, not relabelled — see syncBulkButton(). Only the commit button is
  // replaced; Cancel keeps the data-close listener ui-modal bound to it.
  document.getElementById('confirmGoHost').innerHTML =
    `<ui-button variant="${tone}" id="confirmGo" data-testid="bil--confirm-go">${esc(commit)}</ui-button>`;

  pendingConfirm = onConfirm;
  dialog.open();
}

let pendingConfirm = null;

/** The result dialog. `actions` are rendered as its footer buttons. */
function showDone({ heading, body, actions }) {
  const dialog = modal('modalDone');
  dialog.setAttribute('heading', heading);
  document.getElementById('doneBody').innerHTML = body;
  document.getElementById('doneActions').innerHTML =
    `<span class="ui-modal__actions-spacer"></span>${actions}`;
  dialog.hoistFooter();
  dialog.open();
}

/** The rows a bulk action applies to: what is ticked, in the current view. */
function selectedRows() {
  const rows = visibleRows();
  return state.selected.map((id) => rows.find((row) => String(row.id) === String(id))).filter(Boolean);
}

function clearSelection() {
  state.selected = [];
  table().clearSelection();
  syncBulkButton();
}

/* --- Scrub a batch -------------------------------------------------------- */

/* --- Unbilled Encounters → a claim, or an invoice --------------------------
   Both are the same act: an encounter stops being unbilled and becomes a
   document. So both take the encounter OUT of this tab — "unbilled"
   that still lists something already billed is a queue nobody can trust. */

/**
 * The claim an encounter becomes.
 *
 * One function because an encounter can be raised two ways — opened to review,
 * or run through in a batch — and the same visit must not turn into two
 * differently-shaped claims depending on which button was pressed. Everything
 * here is already on the encounter; nothing is invented on the way across.
 *
 * The id carries the encounter's own number (ENC-2401 → CLM-2401) so a claim
 * can be traced back to the visit it came from. Seeded claims number from
 * CLM-1001 and encounters from ENC-2401, so the two cannot collide.
 *
 * Every field the worklist has a column for is filled in here. A claim raised
 * today with a blank Location would render as a row of dashes beside 205
 * complete ones — the columns are the contract, and a new claim has to meet
 * it.
 */
function claimFromEncounter(row) {
  const number = row.id.replace(/\D/g, '');
  const asc = row.placeOfService.includes('Ambulatory Surgical');
  const appointmentType = CLAIM_APP_TYPES.find((type) => type.title === row.appointmentType);

  return {
    id: `CLM-${number}`,
    dos: row.dos,
    /* Raised today, and never sent — so the ageing clock starts at zero and
       there is no submit date on it. */
    originalClaimDate: today(),
    submissionDate: '',
    updatedDate: today(),
    age: 0,
    patient: row.patient,
    mrn: row.mrn,
    /* Straight across. The encounter and the claim now speak the scheduler's
       vocabulary, so there is nothing to translate — and nothing to get wrong
       in translating it. */
    appointmentType: row.appointmentType,
    apptTypeId: row.apptTypeId,
    provider: row.provider,
    coder: CLAIM_CODERS[0],
    visitType: appointmentType?.title.includes('New') ? 'Intake' : 'Follow up',
    uploadType: 'Manual',
    cpt: row.cpt,
    processedAs: 'Primary',
    payer: row.payer,
    location: asc ? 'ASC' : 'Clinic',
    site: row.placeOfService,
    charge: 0,
    expectedCollection: 0,
    notes: `Raised from encounter ${row.id}.`,
    status: 'New',
  };
}

/** Raise the claim, and take the encounter off Unbilled Encounters — a queue
 *  that still lists something already billed is one nobody can trust. The
 *  claim lands at the front of Claims as New: it has never been scrubbed. */
function raiseClaim(row) {
  data.readyInsurance = data.readyInsurance.filter((r) => r.id !== row.id);
  const claim = claimFromEncounter(row);
  data.claims.unshift(claim);
  return claim;
}

/**
 * ONE encounter is raised and opened: "Generate Claim" produced a document,
 * and reading it before it goes to the scrubber is the point of the step. The
 * claim is real from this moment — closing the stage leaves it waiting under
 * Claims ▸ New rather than throwing it away.
 */
function generateOneClaim(row) {
  const claim = raiseClaim(row);
  clearSelection();
  paint({ headerToo: true });
  openClaimStage(claim, 'edit');
  flash(`Claim raised for ${row.patient} — review it, then submit it to scrub.`, 'success');
}

function startGenerateClaim(rows = selectedRows()) {
  if (!rows.length) return;

  // A batch has no single document to open, so it keeps the confirm-and-run
  // and reports where the claims went at the end.
  if (rows.length === 1) { generateOneClaim(rows[0]); return; }

  confirmThen({
    heading: 'Generate Claim',
    body: `<p class="bil__confirm-lede">You are about to raise a claim for
        <strong>${count(rows.length, 'encounter')}</strong>.</p>
      <p>Each becomes a new unbilled claim, ready to scrub. Do you want to continue?</p>`,
    commit: 'Generate Claim',
    onConfirm: () => runProgress({
      heading: 'Generating claims',
      note: `Please wait — the system is raising ${count(rows.length, 'claim')}.`,
      total: rows.length,
      label: 'Claims Generated',
      onDone: () => finishGenerateClaim(rows),
    }),
  });
}

function finishGenerateClaim(rows) {
  rows.forEach(raiseClaim);

  clearSelection();
  paint({ headerToo: true });
  showDone({
    heading: 'Claims Generated',
    body: `<div class="bil__done bil__done--centred">
        <span class="bil__done-mark">${icon('check')}</span>
        <p class="bil__done-title">${count(rows.length, 'Claim')} generated</p>
        <p class="bil__muted">They are waiting in Claims under New.</p>
      </div>`,
    actions: `<ui-button variant="primary" full data-done-go="claims:New"
      data-testid="bil--done-okay">View Claims</ui-button>`,
  });
}

/**
 * The invoice a self-pay encounter becomes.
 *
 * The mirror of claimFromEncounter() above, and written for the same reason:
 * an encounter can be invoiced from the row menu or from Collect Payment, and
 * the same visit must not turn into two differently-shaped invoices depending
 * on which was used. Everything here is already on the encounter.
 *
 * The single line carries the ENCOUNTER's own id as its code, so an invoice
 * can be traced back to the visit it came from the way CLM-2401 traces back
 * to ENC-2401 — there is no CPT on a self-pay row to put there instead.
 */
function invoiceFromEncounter(row) {
  const patient = BILLING_PATIENTS.find((p) => p.name === row.patient);
  const paid = row.status === 'Paid';
  const total = cents(row.billAmount);

  return {
    id: nextInvoiceId(),
    invoiceDate: today(),
    dueDate: today(),
    dos: row.dos,
    patient: row.patient,
    mrn: row.mrn,
    dob: patient?.dob || '—',
    phone: CLAIM_RAIL_TEMPLATE.patient.phone,
    email: patientEmail(row.patient),
    appointmentType: row.appointmentType,
    /* Carried over so the invoice's own Appointment Type column can draw the
       same coloured dot the encounter it came from drew. */
    apptTypeId: row.apptTypeId,
    appointmentAt: `${row.dos} at ${row.dosTime || '09:00 AM'}`,
    provider: row.provider,
    type: 'Self Pay',
    payer: '',
    paymentMethod: 'Self Pay',
    lines: [{ code: row.id, description: row.reason, qty: 1, price: total }],
    subtotal: total,
    /* Self pay means exactly that: no payer, so nothing is deducted before
       the patient's own responsibility. */
    insurance: 0,
    total,
    /* What the desk already took. A visit marked Paid on the worklist has
       been settled in person, and raising its invoice as outstanding would
       ask the patient for money they have handed over. */
    payment: paid ? total : 0,
    due: paid ? 0 : total,
    status: paid ? 'Paid' : 'Pending',
    receiptId: paid ? `REC-${new Date().getFullYear()}-${row.id.replace(/\D/g, '')}` : '',
    receiptDate: paid ? nowStamp() : '',
    receiptMethod: paid ? 'Card' : '',
    note: INVOICE_NOTE,
  };
}

/** Raise it, and take the encounter off Unbilled Encounters — the same rule
 *  raiseClaim() follows: a queue that still lists something already billed is
 *  one nobody can trust. */
function raiseInvoice(row) {
  data.readySelfPay = data.readySelfPay.filter((r) => r.id !== row.id);
  const invoice = invoiceFromEncounter(row);
  data.invoices.unshift(invoice);
  return invoice;
}

function generateInvoice(row) {
  confirmThen({
    heading: 'Generate Invoice',
    body: `<p class="bil__confirm-lede">Raise an invoice to
        <strong>${esc(row.patient)}</strong> for ${dollars(row.billAmount)}?</p>
      ${row.status === 'Paid'
        ? '<p>This visit is already marked paid at the desk, so the invoice is raised settled and carries a receipt.</p>'
        : '<p>The balance is outstanding and will be billed to the patient.</p>'}`,
    commit: 'Generate Invoice',
    tone: 'primary',
    onConfirm: () => {
      const invoice = raiseInvoice(row);
      paint({ headerToo: true });
      showDone({
        heading: 'Invoice Generated',
        body: `<div class="bil__done bil__done--centred">
            <span class="bil__done-mark">${icon('check')}</span>
            <p class="bil__done-title">Invoice #${esc(invoice.id)} raised</p>
            <p class="bil__muted">${esc(invoice.patient)} · ${dollars(invoice.total)} ·
              ${esc(invoice.status)}</p>
          </div>`,
        actions: `<ui-button variant="primary" full data-done-go="invoice:${esc(invoice.status)}"
          data-testid="bil--done-okay">View Invoice</ui-button>`,
      });
    },
  });
}

function startBatchScrub() {
  const rows = selectedRows();
  if (!rows.length) return;

  confirmThen({
    heading: 'Confirm Batch Scrub',
    body: `<p class="bil__confirm-lede">You are about to scrub <strong>${count(rows.length, 'Claim')}</strong></p>
      <p>Do you want to continue?</p>`,
    commit: 'Start Scrub',
    onConfirm: () => runProgress({
      heading: 'Scrubbing claims',
      note: `Please wait — the system is scrubbing ${count(rows.length, 'record')}.`,
      total: rows.length,
      label: 'Claims Scrubbed',
      onDone: () => finishBatchScrub(rows),
    }),
  });
}

function finishBatchScrub(rows) {
  /* A scrubber that passed everything would make the Scrub Error queue
     unreachable, so a fixed slice of a BATCH fails — enough to be worth
     reviewing, few enough that the batch still looks like it worked.
     A claim submitted on its own always passes: "at least one" applied to a
     batch of one meant every single claim sent from the stage bounced. */
  const failing = rows.length === 1 ? 0 : Math.max(1, Math.round(rows.length * 0.125));
  rows.forEach((row, i) => {
    row.status = i < failing ? 'Scrub Error' : 'Ready to Submit';
  });

  clearSelection();
  paint({ headerToo: true });

  showDone({
    heading: 'Batch Scrub Complete',
    body: `<p>The scrub process has finished successfully.</p>
      <h3 class="bil__section-title">Results Summary</h3>
      <dl class="bil__result-tiles">
        <div class="bil__result-tile"><dt>Processed</dt><dd>${count(rows.length, 'Claim')}</dd></div>
        <div class="bil__result-tile"><dt>Ready to Submit</dt><dd>${count(rows.length - failing, 'Claim')}</dd></div>
        <div class="bil__result-tile"><dt>Require Review</dt><dd>${count(failing, 'Claim')}</dd></div>
      </dl>
      <p class="bil__muted">Claims with errors must be corrected before submission.</p>`,
    actions: `<ui-button variant="outline" data-done-go="Ready to Submit"
        data-testid="bil--done-ready">View Ready Claims</ui-button>
      <ui-button variant="primary" data-done-go="Scrub Error"
        data-testid="bil--done-errors">Review Errors</ui-button>`,
  });
}

/* --- Send a batch to the clearing house ----------------------------------- */

function startClearingHouseSubmit() {
  const rows = selectedRows();
  if (!rows.length) return;

  /* Grouped by payer because that is how the batch actually leaves — one
     envelope per payer — and the totals are what gets reconciled later. */
  const byPayer = new Map();
  rows.forEach((row) => byPayer.set(row.payer, (byPayer.get(row.payer) || 0) + Number(row.charge || 0)));
  const total = [...byPayer.values()].reduce((sum, value) => sum + value, 0);

  confirmThen({
    heading: 'Confirm Batch Submission',
    body: `<dl class="bil__confirm-rows">
        <div class="bil__confirm-row"><dt>Claims Selected</dt><dd>${count(rows.length, 'Claim')}</dd></div>
        <div class="bil__confirm-row"><dt>Total Billed Amount</dt><dd>${dollars(total)}</dd></div>
      </dl>
      <table class="bil__code-table">
        <thead><tr><th class="bil__num">#</th><th>Payer</th><th>Amount ($)</th></tr></thead>
        <tbody>${[...byPayer.entries()].map(([payer, amount], i) =>
          `<tr><td class="bil__num">${i + 1}</td><td>${esc(payer)}</td><td>${money(amount)}</td></tr>`
        ).join('')}</tbody>
      </table>
      <p>Do you want to continue?</p>`,
    commit: 'Continue',
    onConfirm: () => runProgress({
      heading: 'Submitting to Clearing House',
      note: `Please wait — the system is submitting ${count(rows.length, 'record')}.`,
      total: rows.length,
      label: 'Claims Submitted',
      onDone: () => finishClearingHouseSubmit(rows),
    }),
  });
}

/**
 * The one place a claim's status moves, and the only place its dates are
 * stamped.
 *
 * Every flow ends here rather than assigning `row.status` itself. When the two
 * lists were separate, sending a claim on meant rebuilding it in the other
 * array and the rebuild kept dropping fields; now the row never moves, and the
 * columns that record the move — submit date, updated date, ageing — cannot be
 * updated by one caller and forgotten by the next.
 */
function advance(row, status, { sent = false } = {}) {
  row.status = status;
  row.updatedDate = today();
  if (sent) {
    row.submissionDate = today();
    // The clock a biller chases restarts the moment the claim goes out again.
    row.age = 0;
  }
}

function finishClearingHouseSubmit(rows) {
  rows.forEach((row) => advance(row, 'Submitted', { sent: true }));

  clearSelection();
  paint({ headerToo: true });
  showDone({
    heading: 'Claims Submitted',
    body: `<div class="bil__done bil__done--centred">
        <span class="bil__done-mark">${icon('check')}</span>
        <p class="bil__done-title">Claims Submitted</p>
        <p class="bil__muted">${rows.length} claims are with the clearing house.</p>
      </div>`,
    actions: `<ui-button variant="primary" full data-done-go="claims:Submitted"
      data-testid="bil--done-okay">Okay</ui-button>`,
  });
}

/* --- Send a batch on to the payer ----------------------------------------- */

function startPayerSubmit() {
  const rows = selectedRows();
  if (!rows.length) return;

  confirmThen({
    heading: 'Submit Claims to Payer?',
    body: `<div class="bil__confirm-icon">${icon('warning')}</div>
      <p>You're about to submit <strong>${count(rows.length, 'selected claim')}</strong> to the payer.
        Once submitted, the claims will be processed for adjudication.</p>
      <div class="bil__confirm-lede"><strong>Summary</strong><br>${count(rows.length, 'claim')} selected</div>`,
    commit: 'Yes, Confirm',
    tone: 'primary',
    onConfirm: () => runProgress({
      heading: 'Submitting Claims to Payer',
      note: 'Sending the selected claims to the payer for adjudication. This may take a few moments.',
      total: rows.length,
      label: 'Claims Submitted',
      onDone: () => {
        rows.forEach((row) => advance(row, 'Accepted', { sent: true }));
        clearSelection();
        paint({ headerToo: true });
        showDone({
          heading: 'Claims Submitted Successfully',
          body: `<div class="bil__done bil__done--centred">
              <span class="bil__done-mark">${icon('check')}</span>
              <p class="bil__done-title">Claims Submitted Successfully</p>
              <p class="bil__muted">${count(rows.length, 'claim')} accepted by the payer.
                They are past the pipeline the chips cover, so All is where they
                are now — or Payments &amp; Denials, once the payer answers.</p>
            </div>`,
          /* All, not "Accepted": the chips stop at the clearing house, and
             landing on a chip that does not exist would leave the row of them
             with nothing selected and the table showing something else. */
          actions: `<ui-button variant="primary" full data-done-go="claims:all"
            data-testid="bil--done-okay">Okay</ui-button>`,
        });
      },
    }),
  });
}

/* --- Send a refused claim again --------------------------------------------
   The end of the journey loops back to the middle of it. A claim that has been
   denied, rejected or paid short is not finished — it is corrected and sent
   again, and the worklist has to be able to say so rather than leaving the row
   stuck at its last bad news. */

function startResubmit() {
  const rows = selectedRows();
  if (!rows.length) return;

  confirmThen({
    heading: 'Resubmit Claims?',
    body: `<div class="bil__confirm-icon">${icon('warning')}</div>
      <p>You're about to resubmit <strong>${count(rows.length, 'claim')}</strong> to the payer.
        The corrected claim replaces the original, and the timely-filing clock
        starts again from today.</p>`,
    commit: 'Resubmit',
    onConfirm: () => runProgress({
      heading: 'Resubmitting Claims',
      note: `Please wait — the system is resubmitting ${count(rows.length, 'claim')}.`,
      total: rows.length,
      label: 'Claims Resubmitted',
      onDone: () => {
        rows.forEach((row) => advance(row, 'Resubmitted', { sent: true }));
        clearSelection();
        paint({ headerToo: true });
        flash(`${count(rows.length, 'claim')} resubmitted.`, 'success');
      },
    }),
  });
}

/* ============================================================================
   CLAIM STAGE — scrub error / clearing-house rejection / payer denial.
   ========================================================================= */

const STAGES = ['stageClaim', 'stageAr', 'stageRemit'];

function showStage(id) {
  document.querySelectorAll('.bil__panel-host').forEach((panel) => { panel.hidden = true; });
  document.querySelector('.bil__head').hidden = true;
  STAGES.forEach((stage) => { document.getElementById(stage).hidden = stage !== id; });
}

function closeStage() {
  STAGES.forEach((stage) => { document.getElementById(stage).hidden = true; });
  document.querySelector('.bil__head').hidden = false;
  // Restore exactly the panel the strip still has selected, rather than
  // unhiding all three and leaving two empty regions in the layout.
  document.querySelectorAll('.bil__panel-host').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${state.tab}`;
  });
  state.claim = null;
  state.claimMode = null;
  state.remit = null;
  state.ar.kind = null;
  state.ar.accountId = null;
}

/**
 * What "Submit" means for one claim — and so what its button says.
 *
 * The row's status decides, not the caller. Every route into a submission goes
 * through here: the stage's footer button, the row menu's Submit, and the bulk
 * button at the top of a status. A claim opened to be read and then sent must
 * not travel by a different road from one sent straight off the worklist, and
 * with seventeen statuses that is only guaranteed by having one table of what
 * each one is waiting for.
 *
 * Anything past the payer falls through to a resubmission — a denied claim's
 * next send is the corrected one.
 */
const SUBMIT_STEPS = {
  'New': { label: 'Submit to Scrub', run: startBatchScrub },
  'Scrub Error': { label: 'Submit to Scrub', run: startBatchScrub },
  'Ready to Submit': { label: 'Submit to Clearing House', run: startClearingHouseSubmit },
  'CH Accepted': { label: 'Submit to Payer', run: startPayerSubmit },
  /* A corrected claim goes back the way it came — through the clearing house,
     not straight to the payer. Skipping the scrub is how a claim gets rejected
     twice for the same reason. */
  'Corrected Claim': { label: 'Submit to Clearing House', run: startClearingHouseSubmit },
  'CH Rejected': { label: 'Submit to Clearing House', run: startClearingHouseSubmit },
};

function submitStep(row) {
  return SUBMIT_STEPS[row?.status] || { label: 'Resubmit Claim', run: startResubmit };
}

const MODES = {
  /* A claim with nothing wrong with it: no banner, no marked fields, and a
     footer that offers the one step it is actually waiting for. */
  edit: {
    title: (row) => `Edit Claim (${row.patient})`,
    footer: (row) => `<ui-button variant="outline" id="claimSave" data-testid="bil--claim-save">Save Bill</ui-button>
      <ui-button variant="primary" id="claimSubmit" data-testid="bil--claim-submit">${esc(submitStep(row).label)}</ui-button>`,
  },
  scrub: {
    title: (row) => `View Encounter (${row.patient})`,
    /* Force Submit lives here rather than on the worklist row it used to sit
       on. Sending a claim out with the scrubber's objections still on it is a
       decision that needs the objections in front of you, and this is the only
       screen that shows them — a button on the row let it be taken from a
       list that never said what was wrong. */
    footer: (row) => `<ui-button variant="outline" id="claimSave" data-testid="bil--claim-save">Save Bill</ui-button>
      <ui-button variant="outline" data-force="${esc(row.id)}"
        data-testid="bil--claim-force">Force Submit</ui-button>
      <ui-button variant="primary" id="claimRescrub" data-testid="bil--claim-rescrub">Re-Scrub</ui-button>`,
  },
  correct: {
    title: (row) => `Correct Claim (${row.patient})`,
    footer: () => `<ui-button variant="outline" id="claimSave" data-testid="bil--claim-save">Save</ui-button>
      <ui-button variant="primary" id="claimRescrub" data-testid="bil--claim-rescrub">Re-Scrub</ui-button>`,
  },
  denial: {
    title: (row) => `Claim Details (${row.invoice || row.id})`,
    footer: () => `<ui-button variant="tertiary" data-back data-testid="bil--claim-close">Close</ui-button>
      <ui-button variant="outline" id="claimAppeal" data-testid="bil--claim-appeal">Appeal</ui-button>
      <ui-button variant="primary" id="claimRescrub" data-testid="bil--claim-resubmit">Rescrub &amp; Resubmit</ui-button>`,
  },
  /* The row menu's View. It shows whatever the claim's own mode would have
     shown — a scrub error still lists its errors, a denial still names its
     code — and then offers nothing to do about it. That is the difference
     between View and Edit: the same document, and no way to change it. */
  view: {
    title: (row) => `View Claim (${row.patient})`,
    footer: () => `<ui-button variant="tertiary" data-back
      data-testid="bil--claim-close">Close</ui-button>`,
  },
};

/**
 * Open the claim stage.
 *
 * `mode` decides the chrome — the title, the footer, whether anything can be
 * changed. What the body SHOWS is decided by the claim's status, which is why
 * View resolves through modeFor(): a scrub error opened read-only is still a
 * scrub error, and hiding its errors because nobody can tick them off would
 * make View a different, emptier document rather than the same one locked.
 */
function openClaimStage(row, mode) {
  state.claim = row;
  state.claimMode = mode;

  const readOnly = mode === 'view';
  const bodyMode = readOnly ? modeFor(row) : mode;

  document.getElementById('claimStageTitle').textContent = MODES[mode].title(row);
  document.getElementById('claimStageTags').innerHTML =
    bodyMode === 'denial'
      ? badge(row.status, CLAIM_STATUS_TONE[row.status] || DENIAL_TONE[row.status] || 'critical', 'sm')
        + badge(row.category, 'neutral', 'sm')
      : '';
  document.getElementById('claimFoot').innerHTML = MODES[mode].footer(row);
  document.getElementById('claimMain').innerHTML = claimMainHtml(row, bodyMode, readOnly);
  document.getElementById('claimRail').innerHTML = claimRailHtml(row, bodyMode, readOnly);

  showStage('stageClaim');
  document.getElementById('claimMain').scrollTop = 0;
}

/* --- The banner each mode opens with -------------------------------------- */

function bannerHtml(row, mode, readOnly = false) {
  const ticks = (list) => list
    /* The box is unlabelled on screen because the error text beside it is the
       label; label-hidden keeps that wording for anyone not reading it. It is
       dropped entirely when the claim is only being read: a tick that marks an
       error corrected is an edit, and View does not make edits. */
    .map((text, i) => `<li class="bil__errors-item"><span>${esc(text)}</span>${
      readOnly ? '' : `<ui-checkbox label-hidden data-testid="bil--error-${i}">Mark corrected: ${esc(text)}</ui-checkbox>`
    }</li>`)
    .join('');

  // Nothing is wrong with this one, so it opens with no banner at all rather
  // than an empty red box announcing zero problems.
  if (mode === 'edit') return '';

  if (mode === 'scrub') {
    return `<div class="bil__errors" data-testid="bil--scrub-errors">
      <span class="bil__errors-pill">Scrub Error Details</span>
      <ul class="bil__errors-list">${ticks(SCRUB_ERRORS)}</ul>
    </div>`;
  }

  if (mode === 'correct') {
    return `<div class="bil__errors" data-testid="bil--reject-errors">
      <p class="bil__errors-lede">This claim was rejected by ${esc(REJECTION_SUMMARY.clearingHouse)}
        on ${esc(REJECTION_SUMMARY.rejectedAt)}. It was NOT forwarded to the payer. The original
        claim has been locked. To resubmit, update the claim details below.</p>
      <ul class="bil__errors-list">${ticks(SCRUB_ERRORS)}</ul>
    </div>`;
  }

  return `<div class="bil__errors" data-testid="bil--denial-errors">
    <span class="bil__errors-pill">Claim denied by the payer</span>
    <div class="bil__errors-meta">
      <span>ERA Date: <strong>${esc(row.denialDate)}</strong></span>
      <span>Total Denied Amount: <strong>${dollars(row.denied)}</strong></span>
    </div>
    <ul class="bil__errors-list">
      <li class="bil__errors-item"><span>${esc(row.denialCode)} ${esc(row.denialComment)}</span></li>
      <li class="bil__errors-item"><span>M51 Missing referring provider information</span></li>
    </ul>
  </div>`;
}

/* --- The claim itself, identical in all four modes ------------------------- */

function claimMainHtml(row, mode, readOnly = false) {
  const claim = CLAIM_DETAIL_TEMPLATE;
  /* Only a claim that actually failed something carries marked fields. Red
     boxes on a clean claim would send someone hunting for a problem that the
     scrubber has not reported. */
  const bad = (name) => mode !== 'edit' && claim.invalidFields.includes(name);
  const other = claim.otherDetails;

  // There is a rejection to summarise only where something was rejected.
  const summaryBar = mode === 'correct' || mode === 'denial'
    ? `<div class="bil__summary-bar">
        <span>Rejected Claim Summary</span>
        <span class="u-spacer"></span>
        <button type="button" class="ui-text-link ui-text-link--default" id="claimViewSummary">View Summary</button>
        <ui-button variant="outline" size="sm" id="claimViewErrors"
          data-testid="bil--view-errors">View Error Details</ui-button>
      </div>`
    : '';

  /* Collapsed where the resubmission codes are not what failed, open for the
     two modes where they are part of the fix. */
  const otherOpen = mode === 'correct' || mode === 'denial';

  return `
    ${bannerHtml(row, mode, readOnly)}
    ${summaryBar}

    <section class="bil__panel">
      <button type="button" class="bil__panel-toggle" data-panel="claimOther"
        aria-expanded="${otherOpen}" aria-controls="claimOther">
        Claim - Other Details ${icon('caret-down')}
      </button>
      <div class="bil__panel-body" id="claimOther"${otherOpen ? '' : ' hidden'}>
        <div class="bil__fields">
          ${field('Pri Resubmission Code', other.priResubmissionCode)}
          ${field('DCN ICN Pri', other.dcnIcnPri)}
          ${field('Paper Work Send Mode', other.paperWorkSendMode)}
          ${field('Delay Reason Code', other.delayReasonCode)}
          ${field('Resubmission Reason', other.resubmissionReason)}
        </div>
      </div>
    </section>

    <section class="bil__panel">
      <button type="button" class="bil__panel-toggle" data-panel="claimBilling"
        aria-expanded="true" aria-controls="claimBilling">
        Billing Details ${icon('caret-down')}
      </button>
      <div class="bil__panel-body" id="claimBilling">
        <div class="bil__group">
          <h3 class="bil__group-title">Service Details</h3>
          <div class="bil__fields">
            ${field('Service Location', claim.service.location)}
            ${field('Place of Service', claim.service.placeOfService, bad('placeOfService'))}
            ${field('Date of Service', claim.service.dateOfService)}
            ${field('Prior Authorization', claim.service.priorAuthorization)}
          </div>
        </div>

        <div class="bil__group">
          <h3 class="bil__group-title">Provider Details</h3>
          <div class="bil__fields bil__fields--pairs">
            ${claim.providers.map((provider, i) => `
              ${field(provider.role, provider.name)}
              ${field('NPI Number', provider.npi, i === 0 && bad('billingNpi'))}
            `).join('')}
          </div>
        </div>

        <div class="bil__group">
          <h3 class="bil__group-title">Payment Details</h3>
          <div class="bil__fields">
            ${field('Payment method', claim.payment.method)}
            ${field('Insurance Name', row.payer || claim.payment.insuranceName)}
          </div>
        </div>
      </div>
    </section>

    <section class="bil__panel">
      <div class="bil__code-head">
        <h3>ICD Code</h3>
        <ui-input icon="search" label="Search ICD Code" label-hidden size="sm"
          placeholder="Search ICD Code" data-testid="bil--icd-search"></ui-input>
      </div>
      <table class="bil__code-table" data-testid="bil--icd-table">
        <thead><tr>
          <th class="bil__num">#</th><th>ICD Code</th><th>Description</th>
          <th class="bil__code-act"><span class="u-sr-only">Remove</span></th>
        </tr></thead>
        <tbody>${claim.icd.map((code, i) => `
          <tr class="${mode !== 'edit' && code.code === claim.invalidIcd ? 'bil__code-row--error' : ''}">
            <td class="bil__num">${i + 1}</td>
            <td>${esc(code.code)}</td>
            <td class="bil__code-desc" title="${esc(code.description)}">${esc(code.description)}</td>
            <td class="bil__code-act">
              <button type="button" class="bil__del-btn" data-remove-code
                aria-label="Remove ${esc(code.code)}">${icon('trash')}</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="bil__panel">
      <div class="bil__code-head">
        <h3>CPT Code</h3>
        <ui-input icon="search" label="Search CPT Code" label-hidden size="sm"
          placeholder="Search CPT Code" data-testid="bil--cpt-search"></ui-input>
      </div>
      <table class="bil__code-table" data-testid="bil--cpt-table">
        <thead><tr>
          <th class="bil__num">#</th><th>CPT Code</th><th>Description</th><th>Modifier</th>
          <th>Billed Amount</th><th>Allowed Amount</th><th>Qty/ Min</th><th>Diagnosis Pointer</th>
          <th class="bil__code-act"><span class="u-sr-only">Remove</span></th>
        </tr></thead>
        <tbody>${claim.cpt.map((line, i) => `
          <tr>
            <td class="bil__num">${i + 1}</td>
            <td>${esc(line.code)}</td>
            <td class="bil__code-desc${line.ndc ? ' bil__code-desc--drug' : ''}"
              title="${esc(line.description)}">${esc(line.description)}
              ${
                /* THE NDC SITS UNDER THE DRUG IT NAMES.
                   A payer will not adjudicate a medication line without it,
                   and it is a fact about the product rather than about this
                   line — the same NDC whatever modifiers the line carries,
                   which is why it is read off the code in the charge master
                   and not stored per line. This is where a CMS-1500 puts it
                   too: in the shaded strip above the service line, not in a
                   column of its own that is empty on every other row. */
                line.ndc
                  ? `<br><span class="bil__code-ndc">NDC ${esc(line.ndc)}</span>`
                  : ''
              }</td>
            <td><span class="bil__mods">${'<span class="bil__mod"></span>'.repeat(4)}</span></td>
            <td><span class="bil__cell-box">${money(line.billed)}</span></td>
            <td>${dollars(line.allowed)}</td>
            <td><span class="bil__cell-box">${esc(line.qty)}</span>
              ${
                /* A DRUG LINE SHOWS ITS ARITHMETIC.
                   The amount billed for a medication is the per-unit fee
                   times the units given — $0.50 × 50 units = $25.00 — and
                   the two numbers that produce it are on this row already.
                   Printing the multiplication under the quantity is what
                   lets a coder check the amount in the Billed column
                   without opening the charge master in another tab. */
                line.unitFee
                  ? `<span class="bil__code-calc">× ${money(line.unitFee)} / unit</span>`
                  : ''
              }</td>
            <td><span class="bil__cell-box">${esc(line.pointer)}</span></td>
            <td class="bil__code-act">
              <button type="button" class="bil__del-btn" data-remove-code
                aria-label="Remove ${esc(line.code)}">${icon('trash')}</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </section>

    <dl class="bil__collected">${claim.collected.map((item) => `
      <div>
        <dt>${esc(item.label)}</dt>
        <dd>${dollars(item.amount)}${badge(item.state, item.state === 'Paid' ? 'success' : 'warning', 'sm')}</dd>
      </div>`).join('')}
    </dl>

    <section class="bil__panel">
      <dl class="bil__total">
        <dt>Total Charges — Procedural Charges ($)</dt>
        <dd>${money(claim.cpt.reduce((sum, line) => sum + line.billed, 0))}</dd>
      </dl>
    </section>

    <section class="bil__panel">
      <h3 class="bil__panel-title">Internal Billing Note</h3>
      <div class="bil__panel-body">
        <p class="bil__note-box">${esc(claim.note)}</p>
      </div>
    </section>`;
}

/* --- The rail ------------------------------------------------------------- */

function railCard(title, iconName, body, action = '') {
  return `<section class="bil__card">
    <h3 class="bil__card-head">${icon(iconName)}${esc(title)}${action}</h3>
    <div class="bil__card-body">${body}</div>
  </section>`;
}

function claimRailHtml(row, mode, readOnly = false) {
  if (mode === 'denial') return denialRailHtml(row, readOnly);

  const rail = CLAIM_RAIL_TEMPLATE;
  const patient = BILLING_PATIENTS.find((p) => p.name === row.patient);
  // No Edit links on a claim that is only being read — a card headed "Edit"
  // that opens nothing is the read-only mode leaking its own chrome.
  const editLink = (what) => readOnly ? ''
    : `<button type="button" class="ui-text-link ui-text-link--default" data-rail-edit="${what}">${icon('pencil')}Edit</button>`;

  return `
    ${railCard('Patient Details', 'user', `<dl class="bil__facts">
      ${fact('Patient MRN', row.mrn || patient?.mrn)}
      ${fact('Name', row.patient)}
      ${fact('Gender', patient?.sex || rail.patient.gender)}
      ${fact('DOB', patient?.dob || rail.patient.dob)}
      ${fact('Phone Number', rail.patient.phone)}
      ${fact('Address', rail.patient.address)}
    </dl>`, editLink('patient'))}

    ${railCard('Insurance Details', 'shield', `<dl class="bil__facts">
      ${fact('Insurance Type', rail.insurance.type)}
      ${fact('Insurance Number', rail.insurance.number)}
      ${fact('Insurance Name', row.payer || rail.insurance.name)}
      ${fact('Member ID', rail.insurance.memberId)}
      ${fact('Group ID', rail.insurance.groupId)}
      ${fact('Effective Date', rail.insurance.effective)}
    </dl>
    <div class="bil__eligibility">
      <span>Last Checked: ${esc(rail.insurance.lastChecked)}</span>
      <button type="button" class="ui-text-link ui-text-link--default" data-eligibility>View Report</button>
    </div>`, editLink('insurance'))}

    ${railCard('Appointment Details', 'calendar', `<dl class="bil__facts">
      ${fact('Provider', row.provider || rail.appointment.provider)}
      ${fact('Appointment Type', rail.appointment.type)}
      ${fact('Service', rail.appointment.service)}
      ${fact('Date & Time', rail.appointment.dateTime)}
      ${fact('Location', rail.appointment.location)}
      ${fact('Reason for Visit', rail.appointment.reason)}
    </dl>`, editLink('appointment'))}`;
}

function denialRailHtml(row, readOnly = false) {
  return `
    ${railCard('Claim Denials', 'critical', `<dl class="bil__facts">
      ${fact('CPT', `${row.cpt} — ${row.cptDescription}`)}
      ${fact('Denied Date', row.denialDate)}
      ${fact('Denial Code', `<span class="u-text-critical">${esc(row.denialCode)}</span>`, true)}
      ${fact('Denial Comments', row.denialComment)}
      ${fact('Denial Category', row.category)}
      ${fact('ERA Date', row.denialDate)}
    </dl>`)}

    ${railCard('Notes', 'document', `
      <div id="claimNotes">${notesFor(row).map((note) => `
        <div class="bil__note">
          <p class="bil__note-meta">${esc(note.meta)}</p>
          <p class="bil__note-text">${esc(note.text)}</p>
        </div>`).join('')}</div>
      ${readOnly ? '' : `
        <ui-textarea id="newNote" label="Add a note…" rows="3" data-testid="bil--new-note"></ui-textarea>
        <ui-button variant="outline" size="sm" id="addNote" data-testid="bil--add-note">Add Note</ui-button>`}`)}

    ${readOnly ? '' : railCard('Attachments', 'paperclip',
      '<ui-file-upload accept=".png,.jpg" max-size="5MB" data-testid="bil--claim-attach"></ui-file-upload>')}

    ${railCard('Claim History', 'clock', `<div class="bil__timeline">${CLAIM_HISTORY_TEMPLATE.map((item) => `
      <div class="bil__timeline-item">
        <p class="bil__timeline-title">${esc(item.title)}</p>
        <p class="bil__timeline-meta">${icon('calendar')}${esc(item.date)} · ${esc(item.meta)}</p>
      </div>`).join('')}</div>`)}`;
}

/**
 * Send the open claim on its way.
 *
 * The stage closes first and the claim is handed to the same batch flow the
 * worklist uses, as a batch of one: the confirm, the progress and the result
 * are then identical whether one claim was sent from here or forty from the
 * list, and there is only one place that moves a claim between queues.
 */
function submitClaimFromStage() {
  const row = state.claim;
  if (!row) return;

  const step = submitStep(row);
  closeStage();

  /* The row has to be on screen for the flow to find it — a claim opened from
     one chip and submitted while another is showing would otherwise resolve to
     nothing and report a batch of zero. A claim just generated from Ready for
     Billing is being read from a different TAB, so the tab moves too: the
     claim itself is in Claims now, whatever the user was looking at.

     The chip is the claim's own status, which is the whole benefit of one
     list: there is no second array to guess which queue it landed in. */
  if (state.tab !== 'claims') goToTab('claims');
  if (state.chip !== 'all' && state.chip !== row.status) {
    state.chip = row.status;
    paint({ headerToo: true });
  }

  /* Filters set for a different question would hide the very claim just
     opened, and the flow would then act on an empty selection. */
  if (claimFiltersActive() && !matchesClaimFilters(row)) {
    state.claimFilters = { patient: [], provider: [], appType: [], from: '', to: '', coder: [] };
    syncFilterControl();
  }

  state.selected = [row.id];
  step.run();
}

/** Re-Scrub / Rescrub & Resubmit — the one action the error modes share. */
function rescrubClaim() {
  const row = state.claim;
  const mode = state.claimMode;

  runProgress({
    heading: 'Rescrubbing Claim',
    note: 'Validating the updated claim against billing rules and payer requirements. This usually takes a few seconds.',
    total: 8,
    onDone: () => {
      if (mode === 'scrub') {
        advance(row, 'Ready to Submit');
        flash('Claim passed the scrubber and is ready to submit.', 'success');
      } else if (mode === 'correct') {
        /* Corrected, not yet sent — so it rejoins the queue at Ready to
           Submit rather than jumping back to Submitted. Ready to Submit and
           not Corrected Claim because the chips cover the pipeline: a claim
           parked on a status with no chip is one a biller has to go looking
           for under All, and a fixed claim should be waiting where the next
           batch will pick it up. Corrected Claim stays available from the
           Status cell for anyone who wants to mark it explicitly. */
        advance(row, 'Ready to Submit');
        flash('Claim corrected — it is back under Ready to Submit.', 'success');
      } else {
        advance(row, 'Resubmitted', { sent: true });
        flash('Claim rescrubbed and resubmitted to the payer.', 'success');
      }
      closeStage();
      paint({ headerToo: true });
    },
  });
}

/* ============================================================================
   REMIT STAGE — one payment advice, and the claims it says it is paying.

   The header is the envelope: who paid, how, from which account, into which.
   Under it the claims, each of which expands into the two tables that explain
   its figures — the service lines the payer priced, and the adjustments that
   account for the gap between what was billed and what was paid.
   ========================================================================= */

const expandedRemitClaims = new Set();

function openRemitStage(remit) {
  if (!remit) return;
  state.remit = remit;
  // Every remit opens closed. Carrying the last one's open rows over would
  // expand whichever claims happened to share an id.
  expandedRemitClaims.clear();

  document.getElementById('remitBand').textContent = remit.controlNumber;
  paintRemitStage();
  showStage('stageRemit');
}

/** The head, the facts and the claims — everything that changes when a remit
 *  is posted from the stage it is open in. */
function paintRemitStage() {
  const remit = state.remit;
  if (!remit) return;
  const status = remitStatus(remit);

  document.getElementById('remitStageTags').innerHTML =
    badge(status, REMIT_STATUS_TONE[status], 'sm') +
    badge(remit.source, REMIT_SOURCE_TONE[remit.source], 'sm');

  /* Read in the order the screen is scanned: who and when down the left, the
     money in the middle, the account numbers on the right — the ones nobody
     reads until a payment has to be traced. */
  document.getElementById('remitFacts').innerHTML = [
    fact('Billing Provider', remit.billingProvider),
    fact('Post Date', remit.postDate),
    fact('ERA Control Number', remit.controlNumber),
    fact('Receiver Bank Routing Number', remit.receiverRouting),
    fact('Payer', `${remit.payer} (${remit.payerId})`),
    fact('Check/EFT number', remit.checkEft),
    fact('Payment Method', remit.paymentMethod || '—'),
    fact('Payer Account Number', remit.payerAccount),
    fact('ERA Date', remit.eraDate),
    fact('Payment Date', remit.paymentDate),
    fact('Amount', dollars(remit.amount)),
    fact('Receiver Account Number', remit.receiverAccount),
    fact('Payer Bank Routing Number', remit.payerRouting),
  ].join('');

  paintRemitClaims();
}

function paintRemitClaims() {
  const remit = state.remit;
  if (!remit) return;

  const body = remit.claims.length
    ? remit.claims.map(remitClaimHtml).join('')
    : `<tr><td colspan="8">
        <p class="ui-table__state">${icon('info')}No claims are matched to this remit yet.</p>
      </td></tr>`;

  document.getElementById('remitClaimsTable').innerHTML = `<div class="ui-table-wrap">
    <table class="ui-table"><thead><tr>
      <th scope="col"><span class="u-sr-only">Expand</span></th>
      <th scope="col">Claim ID</th>
      <th scope="col">Payers Claim ID</th>
      <th scope="col" class="ui-table__cell--numeric">Charge Amount ($)</th>
      <th scope="col" class="ui-table__cell--numeric">Ins Paid ($)</th>
      <th scope="col" class="ui-table__cell--numeric">Patient Responsibility ($)</th>
      <th scope="col">Claim Received Date</th>
      <th scope="col">Status</th>
    </tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

/* Blue, but a span rather than a button. The claim a remit is paying is the
   PAYER'S copy, named by their control number — it is not a row in this
   practice's own claims list, so there is nothing here to open. The same
   treatment Payer Overdue and the AR stage give a claim id. */
function remitClaimHtml(claim) {
  const open = expandedRemitClaims.has(claim.id);

  const row = `<tr class="${open ? 'bil__row--expanded' : ''}">
    <td><button type="button" class="bil__expand-btn" data-remit-toggle="${esc(claim.id)}"
      aria-expanded="${open}"
      aria-label="Service lines for claim ${esc(claim.id)}">${icon('caret-right')}</button></td>
    <td><span class="ui-text-link ui-text-link--default">${esc(claim.id)}</span></td>
    <td>${esc(claim.payersClaimId)}</td>
    <td class="ui-table__cell--numeric">${money(claim.charge)}</td>
    <td class="ui-table__cell--numeric">${money(claim.insPaid)}</td>
    <td class="ui-table__cell--numeric">${money(claim.patientResponsibility)}</td>
    <td>${esc(claim.receivedDate)}</td>
    <td><button type="button" class="bil__status-btn" data-remit-status="${esc(claim.id)}"
      aria-haspopup="menu" aria-expanded="false"
      aria-label="Status: ${esc(claim.status)}. Change status.">${
        badge(claim.status, REMIT_CLAIM_TONE[claim.status] || 'neutral', 'sm')
      }${icon('caret-down', 'ui-icon bil__status-caret')}</button></td>
  </tr>`;

  if (!open) return row;

  const lines = `<table>
    <caption class="bil__subtable-band">Service Lines</caption>
    <thead><tr>
      <th scope="col">CPT Code</th><th scope="col">Unit</th>
      <th scope="col">Line Control Number</th><th scope="col">Service Date</th>
      <th scope="col">Charge Amount ($)</th><th scope="col">Payment Amount ($)</th>
      <th scope="col">Allowed Amount ($)</th>
    </tr></thead>
    <tbody>${claim.serviceLines.map((line) => `<tr>
      <td>${esc(line.cpt)}</td><td>${esc(line.unit)}</td>
      <td>${esc(line.lineControl) || '—'}</td><td>${esc(line.serviceDate)}</td>
      <td>${money(line.charge)}</td><td>${money(line.payment)}</td><td>${money(line.allowed)}</td>
    </tr>`).join('')}</tbody></table>`;

  const adjustments = `<table>
    <caption class="bil__subtable-band">ERA Adjustment</caption>
    <thead><tr>
      <th scope="col">Group Code</th><th scope="col">Reason Code</th><th scope="col">Amount ($)</th>
    </tr></thead>
    <tbody>${claim.adjustments.map((adj) => `<tr>
      <td>${esc(adj.groupCode)}</td><td>${esc(adj.reasonCode)}</td><td>${money(adj.amount)}</td>
    </tr>`).join('')}</tbody></table>`;

  return `${row}<tr class="bil__row--expanded"><td colspan="8">
    <div class="bil__subtables">${lines}${adjustments}</div>
  </td></tr>`;
}

/**
 * A claim's status on a remit, changed by hand.
 *
 * Same affordance and the same reasoning as the Claims worklist: what a payer
 * did with a claim is often learnt over the phone, and making somebody walk a
 * flow to record something that has already happened is how a list goes stale.
 * Posting the remit is still the proper road for the one transition the system
 * can actually perform.
 */
function openRemitStatusMenu(trigger, id) {
  const claim = state.remit?.claims.find((candidate) => candidate.id === id);
  if (!claim) return;

  openMenu(trigger, REMIT_CLAIM_STATUSES.filter((status) => status !== claim.status).map((status) => ({
    label: status,
    icon: 'caret-right',
    onSelect: () => {
      const from = claim.status;
      claim.status = status;
      // The stage's own tags and the worklist behind it both read the remit's
      // status off these claims, so both have to be repainted.
      paintRemitStage();
      paintTable();
      flash(`Claim ${claim.id} moved from ${from} to ${status}.`, 'success');
    },
  })));
}

/* --- Posting ----------------------------------------------------------------
   The one thing a remit is for. Bulk from the worklist, one from the stage —
   the same function either way, so a remit posted after being read cannot
   land differently from one posted off the list. */

function startPostRemits(rows = selectedRows()) {
  if (!rows.length) return;

  const pending = rows.filter((remit) => remitStatus(remit) !== 'Posted');
  if (!pending.length) {
    flash(`${count(rows.length, 'remit')} already posted — there is nothing left to apply.`);
    return;
  }

  const skipped = rows.length - pending.length;
  const claims = pending.reduce((sum, remit) => sum + remit.claims.length, 0);
  const total = pending.reduce((sum, remit) => sum + remit.amount, 0);

  if (!claims) {
    flash('These remits have no claims matched to them yet, so there is nothing to post.', 'warning');
    return;
  }

  /* Grouped by payer because that is how the money arrived and how it will be
     reconciled — one line per cheque run, not one per remit. */
  const byPayer = new Map();
  pending.forEach((remit) => byPayer.set(remit.payer, (byPayer.get(remit.payer) || 0) + remit.amount));

  confirmThen({
    heading: 'Post Remits',
    body: `<dl class="bil__confirm-rows">
        <div class="bil__confirm-row"><dt>Remits Selected</dt><dd>${count(pending.length, 'Remit')}</dd></div>
        <div class="bil__confirm-row"><dt>Claims Affected</dt><dd>${count(claims, 'Claim')}</dd></div>
        <div class="bil__confirm-row"><dt>Total Payment</dt><dd>${dollars(total)}</dd></div>
      </dl>
      <table class="bil__code-table">
        <thead><tr><th class="bil__num">#</th><th>Payer</th><th>Amount ($)</th></tr></thead>
        <tbody>${[...byPayer.entries()].map(([payer, amount], i) =>
          `<tr><td class="bil__num">${i + 1}</td><td>${esc(payer)}</td><td>${money(amount)}</td></tr>`
        ).join('')}</tbody>
      </table>
      ${skipped
        ? `<p class="bil__muted">${count(skipped, 'remit')} in the selection ${
            skipped === 1 ? 'is' : 'are'} already posted and will be left alone.</p>`
        : ''}
      <p>Posting applies each payment to the claims on its remit. Do you want to continue?</p>`,
    commit: 'Post Payments',
    onConfirm: () => runProgress({
      heading: 'Posting Payments',
      note: `Please wait — the system is applying ${count(pending.length, 'remit')} to ${count(claims, 'claim')}.`,
      total: pending.length,
      label: 'Remits Posted',
      onDone: () => finishPostRemits(pending),
    }),
  });
}

function finishPostRemits(rows) {
  const claims = rows.reduce((sum, remit) => sum + remit.claims.length, 0);
  const total = rows.reduce((sum, remit) => sum + remit.amount, 0);

  // Posting is a fact about the claims; the remit's own status follows from
  // them, so there is nothing else to write.
  rows.forEach((remit) => remit.claims.forEach((claim) => { claim.status = 'Posted'; }));

  // Posted from the stage: the document is done with, so it hands back to the
  // list the same way a rescrubbed claim does.
  if (state.remit) closeStage();

  clearSelection();
  paint({ headerToo: true });

  showDone({
    heading: 'Payments Posted',
    body: `<div class="bil__done bil__done--centred">
        <span class="bil__done-mark">${icon('check')}</span>
        <p class="bil__done-title">${dollars(total)} posted</p>
        <p class="bil__muted">${count(rows.length, 'remit')} applied across ${count(claims, 'claim')}.</p>
      </div>`,
    actions: `<ui-button variant="primary" full data-done-go="remits:all"
      data-testid="bil--done-okay">Okay</ui-button>`,
  });
}

/* ============================================================================
   MODALS
   ========================================================================= */

/* --- Remits ---------------------------------------------------------------- */

/** Add Remit — the header of a payment advice, keyed in by hand. */
function openRemitAdd() {
  document.getElementById('raPayer').setOptions(PAYERS.map((p) => p.name));
  document.getElementById('raProvider').setOptions(BILLING_PROVIDERS);
  modal('modalRemitAdd').open();
}

function saveRemit() {
  const value = (id) => (document.getElementById(id)?.value || '').trim();

  const controlNumber = value('raControl');
  const amount = Number(value('raAmount'));

  /* The two that make a remit a remit: what the payer called it and how much
     it was for. Everything else can be filled in later; without these there is
     nothing to reconcile against and nothing to post. */
  if (!controlNumber) { flash('A remit needs its ERA control number.', 'warning'); return; }
  if (!Number.isFinite(amount) || amount <= 0) {
    flash('Enter the amount the payer paid.', 'warning');
    return;
  }
  if (find(data.remits, controlNumber)) {
    flash(`Remit ${controlNumber} is already on the list.`, 'warning');
    return;
  }

  data.remits.unshift({
    id: controlNumber,
    controlNumber,
    eraDate: fromIso(value('raEraDate')) || today(),
    postDate: fromIso(value('raPostDate')) || today(),
    paymentDate: fromIso(value('raPaymentDate')) || today(),
    checkEft: value('raCheck'),
    paymentMethod: value('raMethod'),
    payer: value('raPayer'),
    payerId: '',
    billingProvider: value('raProvider'),
    /* Keyed in by hand, and the Source column says so — that is the whole
       point of the column, and it is not the operator's to choose. */
    source: 'Manual Entry',
    amount,
    payerRouting: value('raPayerRouting'),
    payerAccount: value('raPayerAccount'),
    receiverRouting: value('raReceiverRouting'),
    receiverAccount: value('raReceiverAccount'),
    /* No claims yet. It arrives Not Posted with nothing to post, which is
       honest: matching the claims is a separate act. */
    claims: [],
  });

  modal('modalRemitAdd').close();
  pager.reset();
  paint({ headerToo: true });
  flash(`Remit ${controlNumber} added for ${dollars(amount)}.`, 'success');
}

/* --- Filter ---------------------------------------------------------------- */



/* ============================================================================
   PATIENT COLLECTION — chasing the balance.

   One verb that matters: send a notice. It is the same act on one account or
   forty, so the row menu and the bulk button meet in the same function and
   the same confirm-and-run the batch flows above use.
   ========================================================================= */

/** Where a notice puts an account. A balance that has been told about is
 *  "Notice sent", whatever rung it was on before — except one already with an
 *  agency, which is past anything this practice sends. */
function applyNotice(row) {
  row.attempts += 1;
  row.lastNotice = today();
  if (row.status !== 'With agency') row.status = 'Notice sent';
}

/**
 * Send a notice to one account or a ticked batch.
 *
 * Sub-threshold balances are counted separately in the confirmation rather
 * than quietly dropped. Whether to spend a stamp on $18.40 is the user's call,
 * not this function's — but they should be told they are about to.
 */
function startSendNotice(rows = selectedRows()) {
  if (!rows.length) return;

  const tiny = rows.filter(belowThreshold).length;
  const owed = rows.reduce((total, row) => total + collectionTotal(row), 0);

  confirmThen({
    heading: 'Send Notice',
    body: `<p class="bil__confirm-lede">You are about to send a balance notice to
        <strong>${count(rows.length, 'patient')}</strong>, covering
        <strong>${dollars(owed)}</strong>.</p>
      ${tiny
        ? `<p>${count(tiny, 'account')} ${tiny === 1 ? 'is' : 'are'} below the
           ${dollars(SMALL_BALANCE_THRESHOLD)} threshold — chasing ${tiny === 1 ? 'it' : 'them'}
           may cost more than ${tiny === 1 ? 'it recovers' : 'they recover'}.</p>`
        : ''}
      <p>Each account moves to <strong>Notice sent</strong> and its attempt count goes up by one.
        Do you want to continue?</p>`,
    commit: 'Send Notice',
    onConfirm: () => runProgress({
      heading: 'Sending notices',
      note: `Please wait — the system is preparing ${count(rows.length, 'notice')}.`,
      total: rows.length,
      label: 'Notices Sent',
      onDone: () => finishSendNotice(rows),
    }),
  });
}

function finishSendNotice(rows) {
  rows.forEach(applyNotice);
  clearSelection();
  paint({ headerToo: true });
  showDone({
    heading: 'Notices Sent',
    body: `<div class="bil__done bil__done--centred">
        <span class="bil__done-mark">${icon('check')}</span>
        <p class="bil__done-title">${count(rows.length, 'Notice')} sent</p>
        <p class="bil__muted">Those accounts are now under Notice sent.</p>
      </div>`,
    actions: `<ui-button variant="primary" full data-done-go="Notice sent"
      data-testid="bil--done-okay">View Notice Sent</ui-button>`,
  });
}

/**
 * What the Total Outstanding on a row is made of.
 *
 * The charges are what a patient rings up about — "what is this $8,920 for" —
 * so they are listed with the date, the entity that billed and what was done,
 * and they add to the same total the row shows because they are what the row
 * added up in the first place.
 */
function openCollectionAccount(row) {
  if (!row) return;
  const dialog = modal('modalCollection');
  dialog.setAttribute('heading', `Account #${row.id} — ${row.patient}`);

  document.getElementById('collectionFacts').innerHTML = [
    fact('MRN', row.mrn),
    fact('Status', badge(row.status, COLLECTION_STATUS_TONE[row.status] || 'neutral', 'sm'), true),
    fact('Ageing', `${collectionBucket(row.age)} days`),
    fact('Attempts', row.attempts),
    fact('Last Notice', row.lastNotice || '—'),
    fact('Last Payment', row.lastPayment || '—'),
    fact('Payment Plan', row.planStatus || 'None'),
    fact('Total Outstanding', dollars(collectionTotal(row))),
  ].join('');

  /* Oldest first: the top line is the charge that put the account on its rung,
     and it is the one the ageing badge in the worklist is reporting. */
  const charges = [...row.charges].sort((a, b) => b.age - a.age);

  document.getElementById('collectionCharges').innerHTML = `<div class="ui-table-wrap">
    <table class="ui-table bil__coll-charges">
      <thead><tr>
        <th scope="col">Charge</th><th scope="col">Date</th><th scope="col">Entity</th>
        <th scope="col">Service</th>
        <th scope="col" class="ui-table__cell--numeric">Age</th>
        <th scope="col" class="ui-table__cell--numeric">Amount</th>
      </tr></thead>
      <tbody>${charges.map((charge) => `<tr>
        <td>${esc(charge.id)}</td>
        <td>${esc(charge.date)}</td>
        <td>${badge(charge.entity, charge.entity === 'ASC' ? 'info' : 'neutral', 'sm')}</td>
        <td>${esc(charge.description)}</td>
        <td class="ui-table__cell--numeric">${charge.age}d</td>
        <td class="ui-table__cell--numeric">${dollars(charge.amount)}</td>
      </tr>`).join('')}
      <tr class="bil__coll-total">
        <td colspan="5">Total Outstanding</td>
        <td class="ui-table__cell--numeric">${dollars(collectionTotal(row))}</td>
      </tr></tbody>
    </table></div>`;

  openAccount = row;
  dialog.open();
}

/** The account the modal is showing, so its Send Notice button knows who it
 *  is about without re-reading the row out of the DOM. */
let openAccount = null;

/**
 * Export what is on screen.
 *
 * The filtered list, not the whole 212 and not the ticked rows: an export is
 * "give me this view as a file", and a user who has spent four dropdowns
 * narrowing to eleven accounts means those eleven.
 */
function exportCollections() {
  const rows = visibleRows();
  flash(`${count(rows.length, 'account')} exported${
    filtersNarrowing() ? ' — the current view, not the whole worklist' : ''
  }.`, 'success');
}

/* Patient Collection narrows from one panel now — the Quick view chips that
   were the other half of this test are gone. */
const filtersNarrowing = () => collectionFiltersActive();

/* --- Paper claims ------------------------------------------------------------
   CMS-1500 for the clinician's work, UB-04 for the facility's. Two documents,
   one renderer: they are the same grid of numbered boxes, and giving them two
   would mean a change to the form chrome had to be made twice. */

function paintForm(hostId, template) {
  document.getElementById(hostId).innerHTML = template.map((box) => `
    <div class="bil__cms-row"><div class="bil__cms-cell">
      <p class="bil__cms-label">${box.num}. ${esc(box.label)}</p>
      <p class="bil__cms-value">${esc(box.value)}</p>
      ${box.checks ? `<div class="bil__cms-checks">${box.checks.map((check) => `
        <span class="bil__cms-check">
          <span class="bil__cms-box${check === box.checked ? ' bil__cms-box--on' : ''}"></span>${esc(check)}
        </span>`).join('')}</div>` : ''}
    </div></div>`).join('');
}

function openPaperClaim() {
  paintForm('cmsFormBody', CMS1500_TEMPLATE);
  modal('modalPaperClaim').open();
}

/**
 * The institutional claim.
 *
 * Offered on every claim rather than only the ASC ones, because which form a
 * charge belongs on is a decision a biller makes — sometimes against what the
 * Location column says — and a menu item that disappears cannot be argued
 * with. A clinic row opening it says so instead.
 */
function openUb04(row) {
  paintForm('ubFormBody', UB04_TEMPLATE);
  modal('modalUb04').open();
  if (row && row.location !== 'ASC') {
    flash(`${row.id} was billed from a clinic — a UB-04 is normally the ASC's form.`);
  }
}

/* --- Clearing-house rejection detail --------------------------------------- */

function openRejectionDetail() {
  document.getElementById('rejectionBody').innerHTML = `
    <h3 class="bil__section-title">Rejection Summary</h3>
    <dl class="bil__reject-summary">
      <div><dt>Claim ID</dt><dd>${esc(REJECTION_SUMMARY.claimId)}</dd></div>
      <div><dt>Status Code</dt><dd>${esc(REJECTION_SUMMARY.statusCode)}</dd></div>
      <div><dt>Rejection Date &amp; Time</dt><dd>${esc(REJECTION_SUMMARY.rejectedAt)}</dd></div>
    </dl>
    <h3 class="bil__section-title">Errors</h3>
    <table class="bil__code-table">
      <thead><tr><th>Loop-segment</th><th>Error Category</th><th>Error Description</th><th>Action</th></tr></thead>
      <tbody>${REJECTION_ERRORS.map((error) => `<tr>
        <td>${esc(error.loop)}</td><td>${esc(error.category)}</td><td>${esc(error.description)}</td>
        <td><button type="button" class="ui-text-link ui-text-link--default" data-reject-fix="${esc(error.action)}">${esc(error.action)}</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
  modal('modalRejection').open();
}

/* --- ERA transfer dialogs -------------------------------------------------- */

const statList = (pairs) => pairs
  .map(([label, value]) => `<div class="bil__stat-row"><dt>${esc(label)}</dt><dd>: ${esc(value)}</dd></div>`)
  .join('');

/**
 * Upload an 835.
 *
 * Remits' "Upload EDI" is this same dialog under its own name, not a second
 * one: an EDI file of remittances IS an ANSI 835, and two dialogs accepting
 * the same extensions and reporting the same summary would be two things to
 * keep in step for no gain. Only the heading changes, because the button that
 * opened it did.
 */
function openEraUpload(heading = 'Upload ERA (ANSI 835 Files)') {
  modal('modalEraUpload').setAttribute('heading', heading);
  document.getElementById('eraUploadSummary').innerHTML = statList(ERA_TRANSFER_SUMMARY);
  modal('modalEraUpload').open();
}

/* --- Create appeal ---------------------------------------------------------- */

function openAppeal(row) {
  const claim = CLAIM_DETAIL_TEMPLATE;
  document.getElementById('appealFacts').innerHTML = [
    fact('Patient Name', row?.patient),
    fact('Service Location', claim.service.location),
    fact('Place of Service', claim.service.placeOfService),
    fact('Date of Service', row?.dos || claim.service.dateOfService),
  ].join('');
  modal('modalAppeal').open();
}

/* ============================================================================
   INVOICES — the document, the receipt, and the money.

   Three dialogs over one row, and they are three stages of the same thing:
   the invoice says what is owed, the payment dialog takes some of it, and the
   receipt records what was taken. So every one of them recomputes from the
   row rather than carrying its own copy of the numbers — a receipt that
   disagreed with the invoice it was printed from is the only unforgivable
   bug on this screen.
   ========================================================================= */

/** Round to cents. Every figure here is a sum of other figures on the same
 *  invoice, so they all go through this and cannot drift a penny apart. */
const cents = (value) => Number(Number(value || 0).toFixed(2));

/** YYYY-MM-DD → MM/DD/YYYY. The inverse of toIso(), for reading a date input
 *  back into the format every column on this screen is stamped in. */
function fromIso(value) {
  const parts = String(value || '').split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : '';
}

/** What can go on an invoice line. The procedure catalogue plus the one
 *  charge that is not a procedure — see MISSED_APPOINTMENT_FEE. */
const INVOICE_ITEMS = [...BILLING_PROCEDURES, MISSED_APPOINTMENT_FEE];

const itemByCode = (code) => INVOICE_ITEMS.find((item) => item.code === code);

/** The next number in the sequence, taken from the highest already issued
 *  rather than from the length of the list — cancelling an invoice must not
 *  make the next one reuse a number that has already been sent out. */
function nextInvoiceId() {
  const highest = data.invoices.reduce(
    (max, row) => Math.max(max, Number.parseInt(row.id, 16) || 0),
    0x339f
  );
  return (highest + 1).toString(16).toUpperCase();
}

/**
 * What the numbers now say the invoice is.
 *
 * Only ever called after money has moved. A write-off and a cancellation are
 * DECISIONS rather than sums — nothing about the arithmetic distinguishes a
 * balance somebody chose to stop chasing from one still being chased — so
 * they are never inferred here, only cleared by a payment that settles the
 * invoice outright.
 */
function invoiceStatusAfterPayment(row) {
  if (row.due <= 0.005) return 'Paid';
  return row.payment > 0 ? 'Partially Paid' : 'Pending';
}

/** Subtotal, insurance and what is left for the patient — the three lines at
 *  the foot of the document, from one place so the form and the saved row
 *  cannot compute them differently. */
function invoiceTotals(source) {
  const subtotal = cents(
    (source.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0)
  );
  /* Insurance cannot exceed the charge: a payer covering more than was billed
     would make the patient's responsibility negative, and a negative invoice
     is a refund — a different document with a different journey. */
  const insurance = cents(Math.min(Math.max(0, Number(source.insurance) || 0), subtotal));
  return { subtotal, insurance, total: cents(subtotal - insurance) };
}

/* --- The invoice document ---------------------------------------------------
   One dialog in three modes. Add and Edit are the same form; View is that
   form with every control locked, which is deliberately NOT a second layout:
   a patient reading their invoice and a biller amending it have to be looking
   at the same document in the same order, or "the total moved" becomes
   impossible to argue about. */

let invoiceDraft = null;

const INVOICE_MODE_HEADING = {
  add: (draft) => `Add Invoice (${draft.type})`,
  edit: (draft) => `Edit Invoice #${draft.id}`,
  view: (draft) => `Invoice #${draft.id}`,
};

/** A blank invoice of the kind asked for. Insurance-backed invoices start
 *  with an insurance line to fill in; a self-pay one never has one. */
function blankInvoice(kind) {
  const patient = BILLING_PATIENTS[0];
  const insured = kind === 'insurance';
  return {
    mode: 'add',
    id: null,
    type: insured ? 'Outstanding Balance' : 'Self Pay',
    patient: patient.name,
    email: patientEmail(patient.name),
    dueDate: '',
    provider: BILLING_PROVIDERS[0],
    paymentMethod: insured ? 'Insurance' : 'Self Pay',
    insurance: 0,
    lines: [{ ...BILLING_PROCEDURES[0], qty: 1 }],
    note: INVOICE_NOTE,
  };
}

function openInvoice(row, mode, kind = 'self') {
  /* An invoice with money against it is a document somebody has already been
     sent and has already paid part of; changing its lines from under them is
     how a balance stops tying to what was received. It can still be read. */
  if (mode === 'edit' && row && (row.payment > 0 || row.status === 'Cancelled')) {
    flash(
      row.status === 'Cancelled'
        ? `#${row.id} was cancelled — it can be read but not changed.`
        : `#${row.id} has already been paid against — it can be read but not changed.`
    );
    mode = 'view';
  }

  invoiceDraft = row
    ? { ...row, mode, dueDate: toIso(row.dueDate), lines: row.lines.map((line) => ({ ...line })) }
    : blankInvoice(kind);
  invoiceDraft.mode = mode;

  const dialog = modal('modalInvoice');
  dialog.setAttribute('heading', INVOICE_MODE_HEADING[mode](invoiceDraft));
  paintInvoiceForm();

  /* Rebuilt rather than relabelled, for the reason confirmThen() gives — and
     dropped entirely in View, where a footer's worth of buttons that change
     nothing is the read-only mode leaking its own chrome. */
  document.getElementById('invoiceGoHost').innerHTML =
    mode === 'view'
      ? ''
      : `<ui-button variant="primary" id="invoiceSave" data-testid="bil--inv-save">${
          mode === 'add' ? 'Save' : 'Save Changes'
        }</ui-button>`;

  dialog.open();
}

/** One line of the item table. Quantity and price are fields rather than
 *  text because both are argued over — a second unit of the same code, or a
 *  price agreed at the desk — and the line total is derived from them. */
function invoiceLineHtml(line, index, readOnly) {
  const lock = readOnly ? ' readonly' : '';
  return `<div class="bil__inv-row" data-inv-row="${index}">
    <ui-select id="invItem-${index}" label="Item" label-hidden
      data-inv-line="${index}" data-inv-field="code"${readOnly ? ' disabled' : ''}
      data-testid="bil--inv-item-${index}"></ui-select>
    <ui-input id="invQty-${index}" label="Quantity" label-hidden type="number"
      value="${esc(line.qty)}" data-inv-line="${index}" data-inv-field="qty"${lock}
      data-testid="bil--inv-qty-${index}"></ui-input>
    <ui-input id="invPrice-${index}" label="Price" label-hidden
      value="${money(line.price)}" data-inv-line="${index}" data-inv-field="price"${lock}
      data-testid="bil--inv-price-${index}"></ui-input>
    <span class="bil__inv-line-total" id="invLineTotal-${index}">${
      money(Number(line.qty || 0) * Number(line.price || 0))
    }</span>
    ${readOnly ? '' : `<button type="button" class="bil__del-btn" data-inv-remove="${index}"
      aria-label="Remove ${esc(line.description)}">${icon('trash')}</button>`}
  </div>`;
}

function invoiceItemsHtml(draft, readOnly) {
  return `<div class="bil__inv-items-head">
      <span>Item</span><span>Quantity</span><span>Price</span><span>Total</span>
      ${readOnly ? '' : '<span></span>'}
    </div>
    ${draft.lines.map((line, index) => invoiceLineHtml(line, index, readOnly)).join('')}
    ${readOnly ? '' : `<button type="button" class="bil__inv-add-item" data-inv-add-item
      data-testid="bil--inv-add-item">${icon('plus')}Add Item</button>`}`;
}

function paintInvoiceForm() {
  const draft = invoiceDraft;
  const readOnly = draft.mode === 'view';
  const lock = readOnly ? ' readonly' : '';

  document.getElementById('invoiceBody').innerHTML = `
    <div class="bil__inv-head">
      <ui-select id="invPatient" label="Patient Name" data-inv-field="patient"${
        readOnly ? ' disabled' : ''
      } data-testid="bil--inv-patient"></ui-select>
      <ui-input id="invEmail" label="Patient Email" value="${esc(draft.email)}"
        data-inv-field="email"${lock} data-testid="bil--inv-email"></ui-input>
      <ui-input id="invDue" type="date" label="Due Date" value="${esc(draft.dueDate)}"
        data-inv-field="dueDate"${lock} data-testid="bil--inv-due"></ui-input>
      <ui-select id="invProvider" label="Provider Name" data-inv-field="provider"${
        readOnly ? ' disabled' : ''
      } data-testid="bil--inv-provider"></ui-select>
      <ui-select id="invMethod" label="Payment Method" data-inv-field="paymentMethod"${
        readOnly ? ' disabled' : ''
      } data-testid="bil--inv-method"></ui-select>
    </div>

    <div class="bil__inv-items" id="invoiceItems">${invoiceItemsHtml(draft, readOnly)}</div>

    <div class="bil__inv-foot">
      <dl class="bil__inv-totals">
        <div><dt>Subtotal</dt><dd id="invSubtotal" data-testid="bil--inv-subtotal"></dd></div>
        <div>
          <dt>Insurance</dt>
          <dd><ui-input id="invInsurance" label="Insurance" label-hidden
            value="${money(draft.insurance)}" data-inv-field="insurance"${lock}
            data-testid="bil--inv-insurance"></ui-input></dd>
        </div>
        <div><dt>Balance Due</dt><dd id="invBalance" data-testid="bil--inv-balance"></dd></div>
      </dl>
    </div>

    <p class="bil__inv-responsibility" id="invResponsibility"
      data-testid="bil--inv-responsibility"></p>

    ${/* disabled rather than readonly: <ui-textarea> has no readonly state,
         and a note that could still be typed into on a locked document would
         promise an edit nothing is going to save. */ ''}
    <ui-textarea id="invNote" label="Invoice Note" rows="3" value="${esc(draft.note)}"
      data-inv-field="note"${readOnly ? ' disabled' : ''}
      data-testid="bil--inv-note"></ui-textarea>`;

  document.getElementById('invPatient').setOptions(BILLING_PATIENTS.map((p) => p.name));
  document.getElementById('invPatient').setAttribute('value', draft.patient);
  document.getElementById('invProvider').setOptions(BILLING_PROVIDERS);
  document.getElementById('invProvider').setAttribute('value', draft.provider);
  document.getElementById('invMethod').setOptions(INVOICE_PAYMENT_METHODS);
  document.getElementById('invMethod').setAttribute('value', draft.paymentMethod);

  paintInvoiceItemOptions();
  paintInvoiceTotals();
}

/** The item dropdowns, set after the markup lands because a <ui-select>'s
 *  options are data rather than an attribute — see its setOptions note. */
function paintInvoiceItemOptions() {
  invoiceDraft.lines.forEach((line, index) => {
    const select = document.getElementById(`invItem-${index}`);
    if (!select) return;
    select.setOptions(
      INVOICE_ITEMS.map((item) => ({ value: item.code, label: `${item.code}  ${item.description}` }))
    );
    select.setAttribute('value', line.code);
  });
}

/**
 * The four figures that move when a line does.
 *
 * Written into the nodes rather than rebuilt as markup: the insurance amount
 * is a field sitting inside this block, and replacing the block on every edit
 * would take the control being typed into with it.
 */
function paintInvoiceTotals() {
  const { subtotal, insurance, total } = invoiceTotals(invoiceDraft);

  invoiceDraft.lines.forEach((line, index) => {
    const cell = document.getElementById(`invLineTotal-${index}`);
    if (cell) cell.textContent = money(Number(line.qty || 0) * Number(line.price || 0));
  });

  document.getElementById('invSubtotal').textContent = money(subtotal);
  document.getElementById('invBalance').textContent = money(total);
  /* Named the same thing the row's Total Amount column is, because it is the
     same number: what this patient is being asked for once their cover has
     paid whatever it is going to pay. */
  document.getElementById('invResponsibility').textContent =
    `Total Patient Responsibility: ${dollars(total)}${
      insurance > 0 ? ` — ${dollars(insurance)} billed to insurance` : ''
    }`;
}

/** A field on the invoice form changed. `line` is set for the item rows. */
function setInvoiceField(field, value, line) {
  if (!invoiceDraft) return;

  if (line != null) {
    const row = invoiceDraft.lines[Number(line)];
    if (!row) return;
    if (field === 'code') {
      const item = itemByCode(value);
      if (!item) return;
      Object.assign(row, { code: item.code, description: item.description, price: item.price });
      // The price follows the item picked; the field is patched rather than
      // the row rebuilt, so the select keeps focus.
      document.getElementById(`invPrice-${line}`)?.setAttribute('value', money(item.price));
    } else if (field === 'qty') {
      row.qty = Math.max(1, Math.round(Number(value) || 1));
      document.getElementById(`invQty-${line}`)?.setAttribute('value', String(row.qty));
    } else if (field === 'price') {
      row.price = Math.max(0, cents(value));
      document.getElementById(`invPrice-${line}`)?.setAttribute('value', money(row.price));
    }
    paintInvoiceTotals();
    return;
  }

  if (field === 'patient') {
    invoiceDraft.patient = value;
    // The address follows the patient, so a new invoice is not sent to
    // whoever happened to be first in the list.
    invoiceDraft.email = patientEmail(value);
    document.getElementById('invEmail')?.setAttribute('value', invoiceDraft.email);
    return;
  }

  if (field === 'insurance') {
    invoiceDraft.insurance = Math.max(0, cents(value));
    document.getElementById('invInsurance')?.setAttribute('value', money(invoiceDraft.insurance));
    paintInvoiceTotals();
    return;
  }

  invoiceDraft[field] = value;
}

function addInvoiceLine() {
  invoiceDraft.lines.push({ ...BILLING_PROCEDURES[0], qty: 1 });
  document.getElementById('invoiceItems').innerHTML = invoiceItemsHtml(invoiceDraft, false);
  paintInvoiceItemOptions();
  paintInvoiceTotals();
}

function removeInvoiceLine(index) {
  // An invoice with no lines has no charge on it, so the last one stays.
  if (invoiceDraft.lines.length === 1) {
    flash('An invoice needs at least one item.');
    return;
  }
  invoiceDraft.lines.splice(Number(index), 1);
  document.getElementById('invoiceItems').innerHTML = invoiceItemsHtml(invoiceDraft, false);
  paintInvoiceItemOptions();
  paintInvoiceTotals();
}

/**
 * Commit the form.
 *
 * An amendment writes back into the row the worklist is already showing, so
 * the invoice keeps its number and its history; only a new one is issued a
 * number. Either way the three money columns are recomputed from the lines
 * rather than carried over, which is what keeps Due = Total − Payment true
 * after an edit as well as after a payment.
 */
function saveInvoice() {
  const draft = invoiceDraft;
  const { subtotal, insurance, total } = invoiceTotals(draft);
  const patient = BILLING_PATIENTS.find((p) => p.name === draft.patient);

  if (draft.mode === 'edit') {
    const row = find(data.invoices, draft.id);
    if (!row) return;
    Object.assign(row, {
      patient: draft.patient,
      email: draft.email,
      provider: draft.provider,
      paymentMethod: draft.paymentMethod,
      dueDate: fromIso(draft.dueDate) || row.dueDate,
      note: draft.note,
      lines: draft.lines.map((line) => ({ ...line })),
      subtotal,
      insurance,
      total,
      /* Editing is only offered while nothing has been paid — see openInvoice
         — so the whole total is what is still due. */
      due: total,
    });
    modal('modalInvoice').close();
    paint({ headerToo: true });
    flash(`Invoice #${row.id} updated — ${dollars(total)} due.`, 'success');
    return;
  }

  const invoice = {
    id: nextInvoiceId(),
    invoiceDate: today(),
    dueDate: fromIso(draft.dueDate) || today(),
    dos: today(),
    patient: draft.patient,
    mrn: patient?.mrn || '—',
    dob: patient?.dob || '—',
    phone: CLAIM_RAIL_TEMPLATE.patient.phone,
    email: draft.email,
    /* The scheduler's own type, and its id, for the same reason every other
       row here carries them: one vocabulary and one colour across Billing. */
    appointmentType: APPOINTMENT_TYPES_BILLING[1].title,
    apptTypeId: APPOINTMENT_TYPES_BILLING[1].id,
    appointmentAt: `${today()} at 09:00 AM`,
    provider: draft.provider,
    type: draft.type,
    payer: insurance > 0 ? PAYERS[0].name : '',
    paymentMethod: draft.paymentMethod,
    lines: draft.lines.map((line) => ({ ...line })),
    subtotal,
    insurance,
    total,
    payment: 0,
    due: total,
    status: 'Pending',
    receiptId: '',
    receiptDate: '',
    receiptMethod: '',
    note: draft.note,
  };

  data.invoices.unshift(invoice);
  modal('modalInvoice').close();

  // Raised on whichever chip was open, so land on one that shows it.
  if (state.chip !== 'all' && state.chip !== 'Pending') state.chip = 'Pending';
  pager.reset();
  paint({ headerToo: true });
  flash(`Invoice #${invoice.id} raised for ${invoice.patient} — ${dollars(total)}.`, 'success');
}

/* --- The receipt -------------------------------------------------------------
   What the patient is handed. Every figure is read off the invoice at the
   moment it is opened, so a receipt reopened after another payment shows the
   new balance rather than a stale one. */

function receiptRow(label, value, strong = false) {
  return `<div class="bil__receipt-row${strong ? ' bil__receipt-row--total' : ''}">
    <dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function openReceipt(row) {
  if (!row) return;
  if (!row.receiptId) {
    /* No money, no receipt. Opening a document with nothing on it would be a
       worse answer than saying why there isn't one. */
    flash(`Nothing has been paid on #${row.id} yet, so there is no receipt.`);
    return;
  }

  document.getElementById('receiptBody').innerHTML = `
    ${/* A <dl>, not a <div> of pairs: a dt/dd with no list around it is a
         description list item with nowhere to belong, and assistive
         technology reads the pair as loose text. */ ''}
    <dl class="bil__receipt-meta">
      <div><dt>Receipt ID</dt><dd>${esc(row.receiptId)}</dd></div>
      <div><dt>Date</dt><dd>${esc(row.receiptDate)}</dd></div>
      <div><dt>Invoice</dt><dd>#${esc(row.id)}</dd></div>
    </dl>

    <section class="bil__receipt-block">
      <h3 class="bil__receipt-title">Patient Information</h3>
      <dl class="bil__receipt-rows">
        ${receiptRow('Name', row.patient)}
        ${receiptRow('Patient ID', row.mrn)}
        ${receiptRow('DOB', row.dob)}
        ${receiptRow('Contact', row.phone)}
      </dl>
    </section>

    <section class="bil__receipt-block">
      <h3 class="bil__receipt-title">Appointment Details</h3>
      <dl class="bil__receipt-rows">
        ${receiptRow('Date & Time', row.appointmentAt)}
        ${receiptRow('Provider', row.provider)}
        ${receiptRow('Service', row.appointmentType)}
      </dl>
    </section>

    <section class="bil__receipt-block">
      <h3 class="bil__receipt-title">Payment Summary</h3>
      <dl class="bil__receipt-rows">
        ${receiptRow('New Charges', dollars(row.subtotal))}
        ${receiptRow('All Adjustment', dollars(row.insurance))}
        ${receiptRow('Total', dollars(row.total))}
        ${/* The two lines the reference receipt leaves out, and the two a
             receipt is actually for: what arrived, and what is still owed.
             Without them a part-payment prints a receipt for the whole
             invoice. */ ''}
        ${receiptRow('Amount Paid', dollars(row.payment), true)}
        ${row.due > 0 ? receiptRow('Balance Due', dollars(row.due)) : ''}
      </dl>
    </section>

    <section class="bil__receipt-block">
      <h3 class="bil__receipt-title">Payment Method</h3>
      <p class="bil__receipt-method">${esc(row.receiptMethod || row.paymentMethod)}</p>
    </section>`;

  modal('modalReceipt').open();
}

/* --- Collecting the money ----------------------------------------------------
   Cash and card are one form with two instruments, so the amount, the reason
   and the notes are painted once and only the panel underneath is swapped.
   What is collected here writes straight back to the row: the worklist behind
   the dialog has to show the new balance the moment it closes, or the screen
   is asking to be reconciled by hand.

   BANK PAYMENT was a third instrument here and is gone. It was the only one
   that did not settle at the desk — it recorded a payment against an invoice
   and then waited days to be reconciled, so the balance the worklist showed
   was a transfer someone had said they would make. Money that arrives by
   transfer lands in the ledger when it clears, not when it is promised. */

const COLLECT_METHODS = [
  { key: 'cash', label: 'Cash Payment', icon: 'dollar' },
  { key: 'card', label: 'Card Payment', icon: 'card' },
];

let collect = null;

function openCollect(row) {
  if (!row) return;
  if (row.status === 'Cancelled') {
    flash(`#${row.id} was cancelled — there is nothing to collect against it.`);
    return;
  }
  if (row.due <= 0) {
    flash(`#${row.id} is settled in full — there is nothing left to collect.`);
    return;
  }

  collect = {
    invoiceId: row.id,
    method: 'card',
    amount: row.due,
    reason: PAYMENT_REASONS[0],
    card: SAVED_CARDS[0].id,
    notes: { internal: false, patient: false },
  };

  modal('modalCollect').setAttribute('heading', `Payment — #${row.id} · ${row.patient}`);
  paintCollectMethods();
  paintCollect();
  modal('modalCollect').open();
}

function paintCollectMethods() {
  document.getElementById('collectMethods').innerHTML = COLLECT_METHODS.map((method) => {
    const active = method.key === collect.method;
    return `<button type="button" role="tab" aria-selected="${active}"
      class="bil__collect-method${active ? ' bil__collect-method--active' : ''}"
      data-collect-method="${method.key}"
      data-testid="bil--collect-${method.key}">${icon(method.icon)}${esc(method.label)}</button>`;
  }).join('');
}

/**
 * The form under the rail.
 *
 * Repainted whole when the method changes and never on a keystroke — the
 * amount box is in here, and the values live on `collect` rather than in the
 * DOM, so a method picked halfway through typing an amount keeps the amount.
 */
function paintCollect() {
  const row = find(data.invoices, collect.invoiceId);
  if (!row) return;

  const instrument = {
    card: `<div class="bil__cards">
        ${SAVED_CARDS.map((card) => `<button type="button"
          class="bil__card-tile${card.id === collect.card ? ' bil__card-tile--active' : ''}"
          aria-pressed="${card.id === collect.card}" data-collect-card="${esc(card.id)}"
          data-testid="bil--collect-card-${esc(card.id)}">
          <span class="bil__card-brand">${esc(card.brand)}</span>
          <span class="bil__card-number">**** **** **** ${esc(card.last4)}</span>
          <span class="bil__card-kind">${esc(card.kind)}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="ui-text-link ui-text-link--default bil__collect-add-card" id="collectAddCard"
        data-testid="bil--collect-add-card">${icon('plus')}Add New Card</button>`,

    /* Cash is the one instrument with nothing to choose — the money is in the
       room, and the amount above is the whole of it. Deliberately no "change
       due" line: overpayment is refused rather than taken, so it could only
       ever read $0.00, and a figure that is always zero is a question with no
       answer sitting in the middle of a payment screen. */
    cash: '<p class="bil__muted">Cash is recorded against the invoice as soon as it is collected.</p>',
  }[collect.method];

  document.getElementById('collectBody').innerHTML = `
    <div class="bil__grid-2">
      <ui-input id="collectAmount" label="Amount" value="${money(collect.amount)}"
        data-collect-field="amount" data-testid="bil--collect-amount"></ui-input>
      <ui-select id="collectReason" label="Payment Reason"
        data-collect-field="reason" data-testid="bil--collect-reason"></ui-select>
    </div>

    <div class="bil__collect-notes">
      <button type="button" class="ui-text-link ui-text-link--default" data-collect-note="internal"
        data-testid="bil--collect-note-internal">${
          collect.notes.internal ? 'Hide' : 'Add'
        } Internal Note</button>
      <button type="button" class="ui-text-link ui-text-link--default" data-collect-note="patient"
        data-testid="bil--collect-note-patient">${
          collect.notes.patient ? 'Hide' : 'Add'
        } Patient Payment Note</button>
    </div>
    ${collect.notes.internal
      ? '<ui-textarea label="Internal note" rows="2" data-testid="bil--collect-internal"></ui-textarea>'
      : ''}
    ${collect.notes.patient
      ? '<ui-textarea label="Patient payment note" rows="2" data-testid="bil--collect-patient"></ui-textarea>'
      : ''}

    <dl class="bil__collect-facts">
      <div><dt>Invoice Total</dt><dd>${dollars(row.total)}</dd></div>
      <div><dt>Balance Due</dt><dd>${dollars(row.due)}</dd></div>
    </dl>

    ${instrument}`;

  document.getElementById('collectReason').setOptions(PAYMENT_REASONS);
  document.getElementById('collectReason').setAttribute('value', collect.reason);
}

/** The amount, checked against what is actually owed. */
function collectAmount(row) {
  const amount = cents(collect.amount);
  if (!(amount > 0)) {
    flash('Enter an amount to collect.');
    return null;
  }
  /* Overpayment is refused rather than absorbed: money beyond the balance is
     a credit on the account, which is a different document with a different
     journey, and quietly swallowing it here would leave the patient's balance
     reading zero while they are owed the difference. */
  if (amount > row.due + 0.005) {
    flash(`Only ${dollars(row.due)} is outstanding on #${row.id}.`, 'warning');
    return null;
  }
  return amount;
}

function collectPayment() {
  const row = find(data.invoices, collect?.invoiceId);
  if (!row) return;

  const amount = collectAmount(row);
  if (amount == null) return;

  row.payment = cents(row.payment + amount);
  row.due = cents(row.total - row.payment);
  row.status = invoiceStatusAfterPayment(row);

  /* The receipt is stamped by the payment, not by opening the dialog — an
     invoice that has been paid against always has one to show, and one that
     has been paid twice keeps the number it was first given. */
  const method = COLLECT_METHODS.find((m) => m.key === collect.method);
  row.receiptMethod = method.label.replace(' Payment', '');
  row.receiptDate = nowStamp();
  if (!row.receiptId) row.receiptId = `REC-${new Date().getFullYear()}-${row.id}`;

  modal('modalCollect').close();
  paint({ headerToo: true });
  flash(
    row.due > 0
      ? `${dollars(amount)} collected against #${row.id} — ${dollars(row.due)} still due.`
      : `${dollars(amount)} collected — #${row.id} is paid in full.`,
    'success'
  );
}

/** Ask the patient to pay it themselves. Nothing moves on the invoice: the
 *  balance changes when money arrives, not when it is requested. */
function sendPaymentRequest() {
  const row = find(data.invoices, collect?.invoiceId);
  if (!row) return;
  const amount = collectAmount(row);
  if (amount == null) return;

  modal('modalCollect').close();
  flash(`Payment request for ${dollars(amount)} sent to ${row.email}.`, 'success');
}

/** MM/DD/YYYY and the time, for the one document where the hour matters. */
function nowStamp() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  return `${today()}, ${String(hours).padStart(2, '0')}:${
    String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;
}

/**
 * Cancel an invoice.
 *
 * The row stays. An invoice that was sent to a patient and then withdrawn is
 * part of what happened to their account, and deleting it would leave a gap
 * in a numbered sequence that somebody will one day have to explain. What
 * changes is the balance: nothing is owed on a cancelled invoice, so the Due
 * column goes to zero and the status carries the reason.
 */
function cancelInvoice(row) {
  if (!row) return;
  if (row.status === 'Cancelled') {
    flash(`#${row.id} has already been cancelled.`);
    return;
  }

  confirmThen({
    heading: 'Cancel Invoice?',
    body: `<div class="bil__confirm-icon">${icon('warning')}</div>
      <p>Invoice <strong>#${esc(row.id)}</strong> for ${esc(row.patient)} will be cancelled and
      the ${dollars(row.due)} outstanding on it will no longer be chased.</p>
      ${row.payment > 0
        ? `<p class="bil__muted">${dollars(row.payment)} has already been paid against this
           invoice. Cancelling does not refund it — raise a credit for that.</p>`
        : ''}`,
    commit: 'Cancel Invoice',
    onConfirm: () => {
      row.status = 'Cancelled';
      row.due = 0;
      paint({ headerToo: true });
      flash(`Invoice #${row.id} cancelled.`, 'warning');
    },
  });
}

/* ============================================================================
   ROW MENUS — what each worklist offers on a row, keyed by the menu name the
   ⋮ button carries.
   ========================================================================= */

const MENUS = {
  /* Patient Collection. The menu changes with the rung, because what is left
     to try changes with it: an account already at an agency cannot be sent
     there again, and one on a plan that is being kept to should not be
     escalated by somebody who did not look at the Last Payment column. */
  collection: (id) => {
    const row = find(data.collections, id);
    if (!row) return [];

    const items = [
      { label: 'View Account', icon: 'eye', onSelect: () => openCollectionAccount(row) },
      { label: 'Send Notice', icon: 'mail', onSelect: () => startSendNotice([row]) },
    ];

    if (!row.planStatus) {
      items.push({
        label: 'Start Payment Plan', icon: 'card',
        onSelect: () => {
          row.status = 'Payment plan';
          row.planStatus = 'Active';
          paint({ headerToo: true });
          flash(`${row.patient} moved onto a payment plan.`, 'success');
        },
      });
    }

    items.push({ label: 'Record Payment', icon: 'card', onSelect: () => notYet('Taking a payment here') });

    /* An agency referral is the end of the ladder and cannot be undone from
       this screen, so it is marked as the destructive one. Sub-threshold
       balances are not offered it at all: paying an agency a percentage of
       $18.40 is a loss dressed up as a collection. */
    if (row.status !== 'With agency' && !belowThreshold(row)) {
      items.push({
        label: 'Send to Agency', icon: 'send', danger: true,
        onSelect: () => confirmThen({
          heading: 'Send to Agency?',
          body: `<div class="bil__confirm-icon">${icon('warning')}</div>
            <p><strong>${esc(row.patient)}</strong> owes ${dollars(collectionTotal(row))},
            ${row.age} days old, after ${count(row.attempts, 'attempt')} to make contact.
            Referring the balance hands it to a third party and ends this practice's
            own collection of it.</p>`,
          commit: 'Send to Agency',
          onConfirm: () => {
            row.status = 'With agency';
            row.planStatus = '';
            paint({ headerToo: true });
            flash(`${row.patient}'s balance referred to the agency.`, 'warning');
          },
        }),
      });
    }

    return items;
  },

  'ready-ins': (id) => {
    const row = find(data.readyInsurance, id);
    return [
      { label: 'Generate Claim', icon: 'plus', onSelect: () => startGenerateClaim([row]) },
      { label: 'View Encounter', icon: 'eye', onSelect: () => notYet('Opening the encounter from Billing') },
    ];
  },

  'ready-self': (id) => {
    const row = find(data.readySelfPay, id);
    return [
      { label: 'Generate Invoice', icon: 'plus', onSelect: () => generateInvoice(row) },
      /* No Collect Payment here. There is nothing to collect against yet —
         an encounter is not a document, and money taken on this row would
         have nothing to be recorded on. Generate Invoice first; the invoice
         row carries Collect Payment. */
      { label: 'View Encounter', icon: 'eye', onSelect: () => notYet('Opening the encounter from Billing') },
    ];
  },

  /**
   * ONE menu for every invoice, at every status — the same argument the claim
   * menu makes above. Seven items, always in this order, whatever state the
   * row is in: a biller working the list learns one menu, and the item they
   * want does not move as the invoice is paid.
   *
   * The items that cannot apply say so when they are picked rather than
   * disappearing. "There is no receipt because nothing has been paid" is an
   * answer; a menu that is a different length on every row is a puzzle.
   */
  invoice: (id) => {
    const row = find(data.invoices, id);
    return [
      { label: 'View Invoice', icon: 'eye', onSelect: () => openInvoice(row, 'view') },
      { label: 'Edit Invoice', icon: 'pencil', onSelect: () => openInvoice(row, 'edit') },
      { label: 'Print Invoice', icon: 'printer', onSelect: () => notYet('Printing an invoice') },
      {
        label: 'Send Invoice', icon: 'mail',
        onSelect: () => flash(`Invoice #${row.id} sent to ${row.email}.`, 'success'),
      },
      { label: 'View Receipt', icon: 'document', onSelect: () => openReceipt(row) },
      { label: 'Collect Payment', icon: 'card', onSelect: () => openCollect(row) },
      { label: 'Cancel Invoice', icon: 'close', danger: true, onSelect: () => cancelInvoice(row) },
    ];
  },

  /**
   * ONE menu for every claim, at every one of the seventeen statuses.
   *
   * It used to be four menus keyed by status, holding between three and five
   * items each, and no two of them agreed on what to call the same act — one
   * said "Generate Paper Claim", another "Print Claim Data on CMS 1500 Form".
   * A biller working a queue learned four menus instead of one, and the item
   * they wanted moved as the claim aged.
   *
   * So: six items, same order, always present. Only Submit changes what it
   * does, and it changes to whatever the claim is actually waiting for — the
   * same routing the bulk button and the claim stage use.
   */
  claim: (id) => {
    const row = find(data.claims, id);
    return [
      { label: 'View', icon: 'eye', onSelect: () => openClaimStage(row, 'view') },
      { label: 'Edit', icon: 'pencil', onSelect: () => openClaimStage(row, modeFor(row)) },
      {
        label: 'Submit', icon: 'send',
        onSelect: () => { state.selected = [id]; submitStep(row).run(); },
      },
      { label: 'CMS 1500', icon: 'document', onSelect: () => openPaperClaim(row) },
      { label: 'UB 04', icon: 'document', onSelect: () => openUb04(row) },
      { label: 'Appeal', icon: 'clipboard', onSelect: () => openAppeal(row) },
    ];
  },
};

/* ============================================================================
   AR MANAGEMENT — the money that has not arrived, and how long it has been
   not arriving.

   Three views of ONE set of documents. Summary charts them, Patient groups
   them by who owes, Insurance by which payer owes — and all three are sums
   over the same superbills and claims, computed at read time against two
   dials the user holds:

     as-of date   what "today" is when the age is worked out
     bucket width how many days wide one ageing column is

   Nothing is precomputed into a column. That is the whole reason the numbers
   can be trusted: the Total column is the same documents added up WITHOUT
   being split into buckets, so if the buckets ever failed to sum to it the
   report would be visibly wrong rather than quietly wrong.

   Drilling into a row opens the AR stage, which shows that account's own
   documents — the receivables the total is made of.
   ========================================================================= */

/**
 * The two aggregate views, and everything that differs between them.
 *
 * One table renderer serves both because an ageing table is an ageing table:
 * an id, a name, five aged columns and a total. What changes is whose money it
 * is — and, on the stage underneath, which columns a single document has,
 * because a patient's superbill and a payer's claim are not the same paper.
 */
const AR_VIEWS = {
  patient: {
    accounts: () => AR_PATIENT_ACCOUNTS,
    docs: (account) => account.superbills,
    name: (account) => account.patient,
    idLabel: 'Patient ID',
    nameLabel: 'Patient Name',
    noun: 'patients',
    /* An avatar beside the name, as everywhere else a patient is listed —
       payers get none, because a logo we do not have is not a face. */
    avatar: true,
    search: 'Search by Patient Name, ID',
    empty: 'No patient owes anything as of this date.',
    stageTitle: 'Patient Listing',
    docColumns: [
      { label: 'Superbill Id', get: (d) => esc(d.id) },
      { label: 'Date of Service', get: (d) => esc(d.dos) },
      { label: 'Date of Billing', get: (d) => esc(d.billedOn) },
      { label: 'Bill Amount', get: (d) => dollars(d.billAmount), numeric: true },
      { label: 'Claim Amount', get: (d) => dollars(d.claimAmount), numeric: true },
      { label: 'Claim Paid', get: (d) => dollars(d.claimPaid), numeric: true },
      { label: 'Co-Pay', get: (d) => dollars(d.coPay), numeric: true },
      { label: 'Co-Pay Paid', get: (d) => dollars(d.coPayPaid), numeric: true },
      { label: 'Balance Amount', get: (d) => dollars(d.balance), numeric: true, strong: true },
    ],
  },

  insurance: {
    accounts: () => AR_INSURANCE_ACCOUNTS,
    docs: (account) => account.claims,
    name: (account) => account.payer,
    /* "Payer ID", not "Patient ID". These rows are payers — a column headed
       for the patient over a list of insurance companies would be read as a
       patient's id and reconciled against the wrong thing. */
    idLabel: 'Payer ID',
    nameLabel: 'Payer Name',
    noun: 'payers',
    avatar: false,
    search: 'Search by Payer Name, ID',
    empty: 'No payer owes anything as of this date.',
    stageTitle: 'Insurance Listing',
    docColumns: [
      { label: 'Claim Number', get: (d) => esc(d.id) },
      { label: 'Patient Name', get: (d) => esc(d.patient) },
      { label: 'Date of Service', get: (d) => esc(d.dos) },
      { label: 'Date of Billing', get: (d) => esc(d.billedOn) },
      { label: 'Date of Claim Submission', get: (d) => esc(d.submittedOn) },
      { label: 'Bill Amount', get: (d) => dollars(d.billAmount), numeric: true },
      { label: 'Claim Amount', get: (d) => dollars(d.claimAmount), numeric: true },
      { label: 'Paid Amount', get: (d) => dollars(d.paidAmount), numeric: true },
      { label: 'Balance Amount', get: (d) => dollars(d.balance), numeric: true, strong: true },
    ],
  },
};

let arPager;
/** Which sub-view the controls were built for. They hold a search box the user
 *  may be mid-word in, so they are rebuilt when the view changes and never on
 *  an ordinary repaint — the same reason the Claims filter bar is built once. */
let arControlsFor = null;

/* --- Ageing ----------------------------------------------------------------- */

/** Days between the as-of date the user picked and the fixture's own today.
 *  Negative when they have looked back: everything is younger then, and some
 *  of it had not been billed at all. */
function arShift() {
  if (!state.ar.asOf) return 0;
  const picked = Date.parse(state.ar.asOf);
  const base = Date.parse(toIso(AR_AS_OF));
  if (!Number.isFinite(picked) || !Number.isFinite(base)) return 0;
  return Math.round((picked - base) / 86_400_000);
}

const arAge = (doc) => doc.age + arShift();

/** The documents on an account that existed on the as-of date. A negative age
 *  is a bill raised after the date being asked about, and it cannot be part of
 *  what was owed then. */
function arDocs(account, view) {
  return view.docs(account).filter((doc) => arAge(doc) >= 0);
}

/**
 * One row of an ageing table: the aged columns and the total, for one account.
 *
 * `total` is accumulated in the same pass as the buckets rather than summed
 * from them afterwards — same numbers either way, but written this way a
 * document that somehow fell into no bucket would be missing from BOTH sides
 * rather than making the row fail to add up.
 */
function arRow(account, view) {
  const buckets = Object.fromEntries(arBuckets(state.ar.width).map((b) => [b.key, 0]));
  let total = 0;

  arDocs(account, view).forEach((doc) => {
    const key = arBucketKey(arAge(doc), state.ar.width);
    if (!key) return;
    buckets[key] += doc.balance;
    total += doc.balance;
  });

  return { id: account.id, name: view.name(account), buckets, total };
}

function arMatchesSearch(row) {
  const needle = state.ar.search.trim().toLowerCase();
  if (!needle) return true;
  return `${row.name} ${row.id}`.toLowerCase().includes(needle);
}

/**
 * Every account with something outstanding, largest debt first.
 *
 * Accounts at zero are dropped rather than listed as zeroes: an ageing report
 * exists to name who owes, and sixteen rows of dashes would bury the four that
 * matter. It is also what makes the as-of dial visibly do something — wind the
 * date back far enough and the list genuinely empties.
 */
function arRows(kind) {
  const view = AR_VIEWS[kind];
  return view.accounts()
    .map((account) => arRow(account, view))
    .filter((row) => row.total > 0 && arMatchesSearch(row))
    .sort((a, b) => b.total - a.total);
}

/** The Total band over a set of rows — the whole filtered set, not the page.
 *  A total that changed when you turned to page two would be a different
 *  number every time anyone looked at it. */
function arTotalsRow(rows) {
  const buckets = Object.fromEntries(arBuckets(state.ar.width).map((b) => [b.key, 0]));
  let total = 0;
  rows.forEach((row) => {
    Object.entries(row.buckets).forEach(([key, value]) => { buckets[key] += value; });
    total += row.total;
  });
  return { buckets, total };
}

/* --- The chart --------------------------------------------------------------
   Hand-drawn SVG rather than a library: it is one grouped bar chart on one
   screen, and a charting dependency would arrive with its own colour scale,
   its own fonts and its own idea of a tooltip, none of which are GastroEMR's. */

/* The plot draws at its own size rather than at whatever size the panel has
   spare. It used to take the full height of the card, which on a desktop meant
   a bar chart of six figures blown up to most of a 900px screen: a third of a
   metre of empty plot above the buckets, tick labels the size of body copy,
   and the eye travelling half the screen from a bar to the name under it. The
   card hugs this box now (see `bil__ar-card--chart`), and the box is a wide,
   shallow banner — the shape a six-column chart with one row of labels wants.

   The margins are the smallest that hold what is actually printed in them: the
   money labels up the left, one row of period names along the bottom. There is
   no x-axis title — "Aging Period" sat under labels that already read
   "0-30 Days", and the band it took came out of the plot. */
const AR_CHART = { width: 1000, height: 268, left: 70, right: 16, top: 26, bottom: 46 };

/**
 * A tick step that lands on round money, and a top of the axis that is the
 * FIRST whole number of them above the tallest bar rather than a fixed count
 * of them. The old scale always drew eight intervals, so a peak of 10.9k was
 * plotted against a 16k axis and a third of the card was empty sky — the bars
 * differed from one another by less, on screen, than the numbers differ. Seven
 * is the ceiling on intervals: enough that a small step still fits under it
 * (and so that the axis stops just over the tallest bar rather than a whole
 * round step above it), few enough that the labels do not collide.
 */
function arScale(peak) {
  const MAX_TICKS = 7;
  if (!(peak > 0)) return { max: MAX_TICKS, step: 1, ticks: MAX_TICKS };
  const power = 10 ** Math.floor(Math.log10(peak / MAX_TICKS));
  const step = ([1, 2, 2.5, 5, 10].find((s) => peak / (s * power) <= MAX_TICKS) ?? 10) * power;
  const ticks = Math.ceil(peak / step);
  return { max: step * ticks, step, ticks };
}

/* Money short enough to sit over a bar. The dollar sign rides every figure,
   including the thousands: an axis that read "$0, 2k, 4k" left the reader to
   work out that the top of it was money too. */
const arTick = (value) =>
  (value >= 1000 ? `$${Number((value / 1000).toFixed(1))}k` : `$${Math.round(value)}`);

/* A bar with its top two corners eased off. A plain rect with `rx` would round
   the bottom pair as well and lift the bar off the baseline it stands on. */
function arBarPath(x, top, w, h) {
  const base = top + h;
  const r = Math.min(3, w / 2, h);
  if (!(h > 0)) return `M${x} ${base}h${w}`;
  return `M${x} ${base}V${top + r}q0 ${-r} ${r} ${-r}h${w - r * 2}q${r} 0 ${r} ${r}V${base}Z`;
}

/** Patient dues and insurance dues per ageing column, plus the pair of totals
 *  the chart ends on. Same buckets and the same as-of date as the two tables,
 *  because they are the same documents — a chart that disagreed with the table
 *  behind the next sub-tab would make both unusable. */
function arChartGroups() {
  const buckets = arBuckets(state.ar.width);

  const totalsFor = (kind) => {
    const view = AR_VIEWS[kind];
    const totals = Object.fromEntries(buckets.map((b) => [b.key, 0]));
    view.accounts().forEach((account) =>
      arDocs(account, view).forEach((doc) => {
        const key = arBucketKey(arAge(doc), state.ar.width);
        if (key) totals[key] += doc.balance;
      })
    );
    return totals;
  };

  const patient = totalsFor('patient');
  const insurance = totalsFor('insurance');
  const sum = (totals) => Object.values(totals).reduce((a, b) => a + b, 0);

  return [
    ...buckets.map((bucket) => ({
      label: bucket.label,
      patient: patient[bucket.key],
      insurance: insurance[bucket.key],
    })),
    { label: 'Total Dues', patient: sum(patient), insurance: sum(insurance), total: true },
  ];
}

function arChartHtml(groups) {
  const { width, height, left, right, top, bottom } = AR_CHART;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const baseline = top + plotH;

  const peak = Math.max(...groups.flatMap((g) => [g.patient, g.insurance]), 0);
  const { max, step, ticks } = arScale(peak);

  const groupW = plotW / groups.length;
  /* Wider than they were, and by a fraction of the group rather than a fixed
     ceiling, so the pair fills its column instead of leaving a hand's width of
     white either side of two pencil lines. The ceiling is what stops a pair in
     a half-empty chart growing into two slabs. */
  const barW = Math.min(34, groupW * 0.27);
  const pairGap = barW * 0.28;
  const y = (value) => baseline - (value / max) * plotH;

  /* A rule across the plot at every step, not a nick on the axis. A bar in the
     middle of the chart was previously read by carrying its top back to a tick
     an arm's length to the left; the rule brings the tick to the bar. It is
     drawn UNDER the bars, so a bar crossing one hides it rather than being
     striped by it. */
  const axis = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = i * step;
    const at = y(value).toFixed(1);
    const rule = i === 0
      ? ''
      : `<line class="bil__chart-grid" x1="${left}" y1="${at}" x2="${width - right}" y2="${at}" />`;
    return `${rule}
      <text class="bil__chart-axis-label bil__chart-axis-label--tick" x="${left - 12}" y="${at}"
        text-anchor="end" dominant-baseline="middle">${arTick(value)}</text>`;
  }).join('');

  const bars = groups.map((group, i) => {
    const centre = left + groupW * (i + 0.5);
    const bar = (value, offset, series) => {
      const barH = Math.max(0, y(0) - y(value));
      const x = centre + offset;
      /* The figure over the bar. The chart is read to answer "how much is
         sitting in 120+?", and every reading of it used to end in an estimate
         between two tick marks. Nothing over an empty bucket: "$0" printed
         five times is five things to rule out before finding the column that
         has anything in it. */
      const label = value > 0
        ? `<text class="bil__chart-value" x="${(x + barW / 2).toFixed(1)}"
            y="${(baseline - barH - 7).toFixed(1)}" text-anchor="middle">${arTick(value)}</text>`
        : '';
      return `<path class="bil__chart-bar bil__chart-bar--${series}"
        d="${arBarPath(Number(x.toFixed(1)), Number((baseline - barH).toFixed(1)), Number(barW.toFixed(1)), Number(barH.toFixed(1)))}"
        ><title>${esc(group.label)} · ${series === 'patient' ? 'Patient' : 'Insurance'} ${dollars(value)}</title></path>${label}`;
    };
    /* Total Dues is the five columns added up, not a sixth column, and on a
       shared axis it towers over them. A hairline in front of it says where
       the buckets stop — cheaper than a second axis, and it keeps the pair of
       totals readable against the same scale as the parts. */
    const divider = group.total
      ? `<line class="bil__chart-divider" x1="${(centre - groupW / 2).toFixed(1)}" y1="${top}"
          x2="${(centre - groupW / 2).toFixed(1)}" y2="${baseline}" />`
      : '';
    return `${divider}
      ${bar(group.patient, -pairGap / 2 - barW, 'patient')}
      ${bar(group.insurance, pairGap / 2, 'insurance')}
      <text class="bil__chart-axis-label${group.total ? ' bil__chart-axis-label--total' : ''}"
        x="${centre.toFixed(1)}" y="${baseline + 20}" text-anchor="middle">${esc(group.label)}</text>`;
  }).join('');

  /* The SVG is hidden from assistive technology and the same numbers are
     offered as a table underneath. A bar chart read out as a list of rect
     elements is noise; a table of the figures it was drawn from is the chart. */
  return `<figure class="bil__chart">
    <figcaption class="bil__chart-head">
      <span class="bil__chart-title">Due Payments</span>
      <span class="bil__chart-legend">
        <span class="bil__chart-key"><span class="bil__chart-swatch bil__chart-swatch--patient"></span>Patient</span>
        <span class="bil__chart-key"><span class="bil__chart-swatch bil__chart-swatch--insurance"></span>Insurance</span>
      </span>
    </figcaption>

    <svg class="bil__chart-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      ${axis}
      <line class="bil__chart-axis" x1="${left}" y1="${baseline}" x2="${width - right}" y2="${baseline}" />
      ${bars}
      <text class="bil__chart-axis-title" x="14" y="${top + plotH / 2}" text-anchor="middle"
        transform="rotate(-90 14 ${top + plotH / 2})">Amount Due</text>
    </svg>

    <table class="u-sr-only">
      <caption>Due payments by ageing period, as of ${esc(arAsOfLabel())}</caption>
      <thead><tr><th scope="col">Aging Period</th><th scope="col">Patient</th><th scope="col">Insurance</th></tr></thead>
      <tbody>${groups.map((group) => `<tr>
        <th scope="row">${esc(group.label)}</th>
        <td>${dollars(group.patient)}</td><td>${dollars(group.insurance)}</td>
      </tr>`).join('')}</tbody>
    </table>
  </figure>`;
}

/* --- The ageing tables ------------------------------------------------------ */

/** The as-of date in the same MM/DD/YYYY every other date on this screen is
 *  written in, whether it came from the fixture or from the date input. */
function arAsOfLabel() {
  if (!state.ar.asOf) return AR_AS_OF;
  const [year, month, day] = state.ar.asOf.split('-');
  return year ? `${month}/${day}/${year}` : AR_AS_OF;
}

/** Money in an aged cell. A grid this wide reads better when the empty cells
 *  are empty: `$0.00` sixty times over is sixty things to check before finding
 *  the one column that has anything in it. */
const arCell = (value) =>
  (value > 0 ? dollars(value) : '<span class="bil__ar-nil" aria-label="nothing outstanding">—</span>');

/**
 * An ageing table.
 *
 * ONE header row, not the two the mock stacks. The mock draws a totals band
 * with its own header above the detail table because they were two separate
 * tables that had to be labelled twice; as one table the header serves both,
 * the columns cannot drift out of alignment, and a screen reader is not read
 * the same six column names twice before reaching a row.
 *
 * The Total row leads the body rather than closing it, which is where the
 * design puts it and where it belongs: the number everyone came for, before
 * the rows that explain it.
 */
function arTableHtml(view, rows, { linkNames = true, totalOver = null } = {}) {
  const buckets = arBuckets(state.ar.width);

  const head = `<tr>
    <th scope="col">${esc(view.idLabel)}</th>
    <th scope="col">${esc(view.nameLabel)}</th>
    ${buckets.map((b) => `<th scope="col" class="ui-table__cell--numeric">${esc(b.label)}</th>`).join('')}
    <th scope="col" class="ui-table__cell--numeric">Total</th>
  </tr>`;

  /* Totalled over `totalOver` — every row the filter left — and NOT over the
     page being drawn. A Total that only added up the ten rows in front of you
     would change every time you turned the page, which is the one thing the
     figure everybody reads first must never do. */
  const total = totalOver ? arTotalsRow(totalOver) : null;
  const totalRow = total ? `<tr class="bil__ar-total" data-testid="bil--ar-total">
    <td></td><th scope="row">Total</th>
    ${buckets.map((b) => `<td class="ui-table__cell--numeric">${arCell(total.buckets[b.key])}</td>`).join('')}
    <td class="ui-table__cell--numeric">${dollars(total.total)}</td>
  </tr>` : '';

  const body = rows.map((row) => {
    const name = linkNames
      ? `<button type="button" class="ui-text-link ui-text-link--default"
          data-ar-open="${esc(row.id)}">${esc(row.name)}</button>`
      : esc(row.name);

    return `<tr>
      <td>${esc(row.id)}</td>
      <td class="ui-table__cell--wrap">${
        view.avatar
          ? `<span class="pt__name"><span class="pt__avatar">${icon('user')}</span>${name}</span>`
          : name
      }</td>
      ${buckets.map((b) => `<td class="ui-table__cell--numeric">${arCell(row.buckets[b.key])}</td>`).join('')}
      <td class="ui-table__cell--numeric bil__ar-rowtotal">${dollars(row.total)}</td>
    </tr>`;
  }).join('');

  if (!rows.length) {
    // id + name + every bucket + total — the whole header, or the empty
    // message stops short of the last columns and the table looks broken
    // rather than empty.
    return `<div class="ui-table-wrap"><table class="ui-table bil__ar-grid">
      <thead>${head}</thead>
      <tbody><tr><td colspan="${buckets.length + 3}">
        <p class="ui-table__state">${icon('info')}${esc(view.empty)}</p>
      </td></tr></tbody></table></div>`;
  }

  return `<div class="ui-table-wrap"><table class="ui-table bil__ar-grid">
    <thead>${head}</thead>
    <tbody>${totalRow}${body}</tbody>
  </table></div>`;
}

/* --- Paint ------------------------------------------------------------------ */

/* `bil--ar-tab-*`, not the worklist's `bil--chip-*`: Unbilled Encounters already
   has a sub-tab called Insurance, and the worklist stays parked in its own
   panel while AR is open, so two live elements would answer to one test id. */
function paintArTabs() {
  document.getElementById('arTabs').innerHTML = tabDef().chips
    .map((chip) => {
      const active = chip.key === state.chip;
      return `<button type="button" class="bil__subtab${active ? ' bil__subtab--active' : ''}"
        role="tab" aria-selected="${active}" data-chip="${esc(chip.key)}"
        data-testid="bil--ar-tab-${esc(chip.key)}">${esc(chip.label)}</button>`;
    })
    .join('');
}

/** The as-of date, the bucket width, and — on the two tables — a search box.
 *  Rebuilt only when the sub-view changes; see arControlsFor. */
function paintArControls() {
  if (arControlsFor === state.chip) return;
  arControlsFor = state.chip;

  const host = document.getElementById('arControls');
  host.innerHTML = `
    ${state.chip === 'summary' ? '' : `
      <ui-input id="arSearch" icon="search" label="Search accounts" label-hidden
        placeholder="${esc(AR_VIEWS[state.chip].search)}" value="${esc(state.ar.search)}"
        data-testid="bil--ar-search"></ui-input>`}
    <ui-input id="arAsOf" type="date" label="As of date" label-hidden
      value="${esc(state.ar.asOf)}" data-testid="bil--ar-asof"></ui-input>
    <ui-select id="arWidth" label="Ageing column width" label-hidden
      data-testid="bil--ar-width"></ui-select>`;

  /* "30 Days" is the width of ONE column, which is why the option reads as a
     span rather than a date range — picking 60 does not hide anything, it
     re-cuts every column and every bar to sixty-day steps. */
  document.getElementById('arWidth').setOptions(
    AR_BUCKET_WIDTHS.map((days) => ({ value: String(days), label: `${days} Days` }))
  );
  document.getElementById('arWidth').setAttribute('value', String(state.ar.width));
}

function paintArBody() {
  const body = document.getElementById('arBody');
  const foot = document.querySelector('[data-foot="ar"]');
  /* Summary and the two tables want opposite things from the card. A table
     should take every pixel of height going — the more rows on screen the
     fewer pages to turn — while the chart has a size of its own and stretching
     it to the same height only inflates it. The class says which of the two is
     in the body; the card reads it and either fills the panel or hugs. */
  const isChart = state.chip === 'summary';
  document.querySelector('.bil__ar-card').classList.toggle('bil__ar-card--chart', isChart);

  if (isChart) {
    // No rows, so no pager — a footer reading "No accounts" under a chart of
    // six figures would be answering about something that is not on screen.
    foot.hidden = true;
    body.innerHTML = arChartHtml(arChartGroups());
    return;
  }

  const view = AR_VIEWS[state.chip];
  const rows = arRows(state.chip);

  foot.hidden = false;
  arPager.setNoun(view.noun);
  const { start, end } = arPager.render(rows.length);

  body.innerHTML = `<div class="bil__ar-table">${
    arTableHtml(view, rows.slice(start, end), { totalOver: rows })
  }</div>`;
}

function paintAr() {
  if (!arPager) {
    arPager = createPager(document.querySelector('[data-foot="ar"]'), {
      rowsPerPage: PAGE_SIZE,
      noun: 'accounts',
      testidPrefix: 'bil-ar',
      onChange: paintArBody,
    });
  }
  paintArTabs();
  paintArControls();
  paintArBody();
}

/* --- The stage: one account's documents ------------------------------------- */

function openArStage(kind, id) {
  const view = AR_VIEWS[kind];
  const account = view?.accounts().find((candidate) => String(candidate.id) === String(id));
  if (!account) return;

  state.ar.kind = kind;
  state.ar.accountId = id;

  document.getElementById('arStageTitle').textContent = view.stageTitle;

  /* The account's own ageing line, drawn by the same renderer as the table it
     was opened from — with the name no longer a link, because it is already
     open. Repeating it here is not decoration: it is the total the documents
     below have to add up to, and it has to be legible without going back. */
  document.getElementById('arStageAccount').innerHTML =
    arTableHtml(view, [arRow(account, view)], { linkNames: false });

  const docs = arDocs(account, view).sort((a, b) => arAge(a) - arAge(b));
  const columns = view.docColumns;

  document.getElementById('arStageDocs').innerHTML = `<div class="ui-table-wrap">
    <table class="ui-table bil__ar-docs">
      <thead><tr>${columns
        .map((column) => `<th scope="col"${column.numeric ? ' class="ui-table__cell--numeric"' : ''}>${esc(column.label)}</th>`)
        .join('')}</tr></thead>
      <tbody>${docs.length
        ? docs.map((doc) => `<tr>${columns
            .map((column) => `<td class="${column.numeric ? 'ui-table__cell--numeric' : ''}${
              column.strong ? ' bil__ar-rowtotal' : ''
            }">${column.get(doc)}</td>`)
            .join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}">
            <p class="ui-table__state">${icon('info')}Nothing was outstanding on this date.</p>
          </td></tr>`}</tbody>
    </table></div>`;

  showStage('stageAr');
}

/* ============================================================================
   BOOT
   ========================================================================= */

customElements.whenDefined('ui-data-table').then(boot);

function boot() {
  writeTypePalette();

  pager = createPager(document.querySelector('[data-foot="worklist"]'), {
    rowsPerPage: PAGE_SIZE,
    noun: 'claims',
    testidPrefix: 'bil',
    onChange: paintTable,
  });

  paint({ headerToo: true });
  wireEvents();
}

/**
 * The appointment-type colours, written once into a stylesheet of their own.
 *
 * The clinic sets these, not the design system, so they cannot be tokens —
 * they arrive on --bil-colour from a class per type, which is the same trick
 * the scheduler plays with .sch-t-* and the same APPOINTMENT_TYPES palette.
 * Both screens colour the same appointment the same way, which is the entire
 * point of showing the dot at all.
 */
function writeTypePalette() {
  sheet('bilPalette').textContent = APPOINTMENT_TYPES
    .map((type) => `.bil-t-${type.id}{--bil-colour:${type.color};}`)
    .join('\n');
}

function wireEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('ui-change', onUiChange);
  document.addEventListener('ui-input', onUiInput);
  document.addEventListener('ui-select', onUiSelect);
  document.addEventListener('ui-sort', onUiSort);

  /* The one filter, for every tab. It opens, closes, counts and clears itself;
     what arrives here is only what was ticked and which list it belongs to. */
  const filter = document.getElementById('wlFilter');
  filter?.addEventListener('ui-filter-change', (event) =>
    onWorklistFilterChange(event.detail.values)
  );
  filter?.addEventListener('ui-filter-clear', clearWorklistFilters);
}

/**
 * A sortable header was clicked.
 *
 * The table draws the arrow; the order is ours, because the rows are ours —
 * the component is only ever handed the page it is to show, so sorting inside
 * it would sort ten rows out of two hundred. Back to page one afterwards: the
 * row that was at the top of page two is somewhere else entirely now.
 */
function onUiSort(event) {
  if (event.target.id !== 'worklist') return;
  state.sort = { key: event.detail.key, dir: event.detail.direction };
  pager.reset();
  paintTable();
}

function onUiSelect(event) {
  if (event.target.id !== 'worklist') return;
  state.selected = event.detail.selected;
  syncBulkButton();
}

function onUiInput(event) {
  if (event.target.id === 'arSearch') { arSearch(event.detail.value); return; }
  if (event.target.id !== 'wlSearch') return;
  state.search = event.detail.value;
  pager.reset();
  // Chips too: their counts are of the chip's own rows, but the range line
  // under the table has to agree with what the search left on screen.
  paintChips();
  paintTable();
}

/** Only the AR body repaints: the controls hold the box being typed into, and
 *  rebuilding them on a keystroke would take the caret with them. */
function arSearch(value) {
  state.ar.search = value;
  arPager.reset();
  paintArBody();
}

function onUiChange(event) {
  const target = event.target;

  if (target.matches('ui-tabs')) { selectTab(event.detail.value); return; }

  /* Both AR dials change what every figure MEANS rather than which rows are
     shown, so both go back to page one: the account at the top of page two
     under thirty-day columns is somewhere else entirely under sixty. */
  if (target.id === 'arAsOf') {
    state.ar.asOf = event.detail.value;
    arPager.reset();
    paintArBody();
    return;
  }
  if (target.id === 'arWidth') {
    state.ar.width = Number(event.detail.value) || AR_DEFAULT_BUCKET_WIDTH;
    arPager.reset();
    paintArBody();
    return;
  }
  if (target.id === 'arSearch') { arSearch(event.detail.value); return; }

  /* The invoice form and the payment dialog name their own fields on the
     control rather than being matched by id, because the item rows are
     repeated: `data-inv-line` says which line the field belongs to, and one
     handler serves however many lines the invoice has. */
  const invField = target.dataset?.invField;
  if (invField) { setInvoiceField(invField, event.detail.value, target.dataset.invLine); return; }

  const collectField = target.dataset?.collectField;
  if (collectField && collect) {
    collect[collectField] = collectField === 'amount'
      ? Math.max(0, cents(event.detail.value))
      : event.detail.value;
    return;
  }

  /* The two ends of the date range the filter panel borrows from the header. */
  if (target.id === 'wlFrom' || target.id === 'wlTo') { onWorklistRangeChange(); return; }



  if (target.id === 'wlSearch') {
    state.search = event.detail.value;
    pager.reset();
    paintChips();
    paintTable();
  }
}

function onClick(event) {
  const hit = (selector) => event.target.closest(selector);

  /* --- navigation ------------------------------------------------------- */
  const chip = hit('[data-chip]');
  if (chip) { selectChip(chip.dataset.chip); return; }

  if (hit('[data-back]')) { closeStage(); return; }

  const openClaim = hit('[data-open-claim]');
  if (openClaim) {
    const row = find(data.claims, openClaim.dataset.openClaim);
    if (!row) return;
    openClaimStage(row, modeFor(row));
    return;
  }


  const openRemit = hit('[data-open-remit]');
  if (openRemit) { openRemitStage(find(data.remits, openRemit.dataset.openRemit)); return; }

  const openAccountLink = hit('[data-open-account]');
  if (openAccountLink) {
    openCollectionAccount(find(data.collections, openAccountLink.dataset.openAccount));
    return;
  }

  const remitToggle = hit('[data-remit-toggle]');
  if (remitToggle) {
    const id = remitToggle.dataset.remitToggle;
    if (expandedRemitClaims.has(id)) expandedRemitClaims.delete(id);
    else expandedRemitClaims.add(id);
    paintRemitClaims();
    return;
  }

  const remitStatusTrigger = hit('[data-remit-status]');
  if (remitStatusTrigger) {
    openRemitStatusMenu(remitStatusTrigger, remitStatusTrigger.dataset.remitStatus);
    return;
  }

  /* The invoice number opens the document itself, read-only. Editing it is a
     separate decision and lives on the row menu — clicking a reference to
     look at it should never be the way into changing it. */
  const openInvoiceRow = hit('[data-open-invoice]');
  if (openInvoiceRow) {
    openInvoice(find(data.invoices, openInvoiceRow.dataset.openInvoice), 'view');
    return;
  }

  /* The AR row's kind is the sub-tab it was clicked on — the two tables are
     never on screen at once, so the id alone identifies the account. */
  const openAr = hit('[data-ar-open]');
  if (openAr) { openArStage(state.chip, openAr.dataset.arOpen); return; }

  /* --- the row's own act -------------------------------------------------
     The button at the end of a row and the first item of its ⋮ are the same
     act under the same name, so they are routed through the same list: the
     button looks its twin up in MENUS by label and runs it. Nothing here can
     drift from the menu, because there is nothing here to drift — except
     Claims, whose button opens the stage in whichever mode the claim's status
     calls for, which is exactly what its menu's Edit does. */
  const rowAction = hit('[data-row-action]');
  if (rowAction) {
    const { rowAction: kind, id } = rowAction.dataset;
    if (kind === 'claim') {
      const row = find(data.claims, id);
      if (row) openClaimStage(row, modeFor(row));
      return;
    }
    const label = ROW_ACTIONS[kind]?.label;
    MENUS[kind]?.(id).find((item) => item.label === label)?.onSelect?.();
    return;
  }

  /* --- row menus --------------------------------------------------------- */
  const menuTrigger = hit('[data-menu]');
  if (menuTrigger) {
    const build = MENUS[menuTrigger.dataset.menu];
    if (build) openMenu(menuTrigger, build(menuTrigger.dataset.id));
    return;
  }

  /* --- per-row actions --------------------------------------------------- */
  const forceOne = hit('[data-force]');
  if (forceOne) {
    const row = find(data.claims, forceOne.dataset.force);
    if (!row) return;
    /* Forcing past the scrubber is a real decision, not a shortcut — the
       claim goes out with the errors the scrubber found still on it. */
    confirmThen({
      heading: 'Force Submit?',
      body: `<div class="bil__confirm-icon">${icon('warning')}</div>
        <p>${esc(row.patient)}'s claim still has scrub errors. Forcing it moves the claim
        to <strong>Ready to Submit</strong> with those errors unresolved, and the payer is
        likely to reject it.</p>`,
      commit: 'Force Submit',
      onConfirm: () => {
        advance(row, 'Ready to Submit');
        closeStage();
        paint({ headerToo: true });
        flash(`${row.patient}'s claim forced past the scrubber.`, 'warning');
      },
    });
    return;
  }

  /* --- header actions ---------------------------------------------------- */
  /* The funnel is <ui-filter> now — it opens, closes and clears itself, and
     there is nothing left here to route. */
  if (hit('#bulkSendNotice')) { startSendNotice(); return; }
  if (hit('#collectionExport')) { exportCollections(); return; }
  /* The modal's own Send Notice acts on the account it is showing, then closes
     — leaving it open over a row whose status it had just changed would show a
     document contradicting the worklist behind it. */
  if (hit('#collectionNotice')) {
    const row = openAccount;
    modal('modalCollection').close();
    startSendNotice(row ? [row] : []);
    return;
  }
  if (hit('#bulkPostRemits')) { startPostRemits(); return; }
  if (hit('#remitPost')) { startPostRemits(state.remit ? [state.remit] : []); return; }
  if (hit('#remitUploadPdf')) { modal('modalRemitPdf').open(); return; }
  if (hit('#remitUploadEdi')) { openEraUpload('Upload EDI (ANSI 835 Files)'); return; }
  if (hit('#remitAdd')) { openRemitAdd(); return; }
  if (hit('#bulkGenerateClaim')) { startGenerateClaim(); return; }
  if (hit('#bulkScrub')) { startBatchScrub(); return; }
  if (hit('#bulkSubmitCh')) { startClearingHouseSubmit(); return; }
  if (hit('#bulkSubmitPayer')) { startPayerSubmit(); return; }
  if (hit('#paperClaim')) { openPaperClaim(); return; }

  if (hit('#invoiceAdd')) { openInvoice(null, 'add', 'self'); return; }

  /* --- the invoice document ------------------------------------------------ */
  if (hit('[data-inv-add-item]')) { addInvoiceLine(); return; }
  const removeLine = hit('[data-inv-remove]');
  if (removeLine) { removeInvoiceLine(removeLine.dataset.invRemove); return; }
  if (hit('#invoiceSave')) { saveInvoice(); return; }

  /* --- receipt and payment -------------------------------------------------- */
  if (hit('#receiptDownload') || hit('#receiptPrint')) { notYet('Taking the receipt off screen'); return; }

  const collectMethod = hit('[data-collect-method]');
  if (collectMethod) {
    collect.method = collectMethod.dataset.collectMethod;
    paintCollectMethods();
    paintCollect();
    return;
  }
  const collectCard = hit('[data-collect-card]');
  if (collectCard) {
    collect.card = collectCard.dataset.collectCard;
    paintCollect();
    return;
  }
  const collectNote = hit('[data-collect-note]');
  if (collectNote) {
    const which = collectNote.dataset.collectNote;
    collect.notes[which] = !collect.notes[which];
    paintCollect();
    return;
  }
  if (hit('#collectAddCard')) { notYet('Adding a card'); return; }
  if (hit('#collectGo')) { collectPayment(); return; }
  if (hit('#collectRequest')) { sendPaymentRequest(); return; }

  /* --- dialogs ----------------------------------------------------------- */
  if (hit('#confirmGo')) {
    modal('modalConfirm').close();
    const run = pendingConfirm;
    pendingConfirm = null;
    run?.();
    return;
  }

  if (hit('#progressCancel')) {
    stopProgress();
    modal('modalProgress').close();
    flash('Process cancelled. Nothing was changed.', 'warning');
    return;
  }

  const doneGo = hit('[data-done-go]');
  if (doneGo) {
    modal('modalDone').close();
    const [tab, chipKey] = doneGo.dataset.doneGo.includes(':')
      ? doneGo.dataset.doneGo.split(':')
      : [state.tab, doneGo.dataset.doneGo];
    // Land on the tab first — it resets the chip — then open the queue the
    // result dialog actually offered.
    if (tab !== state.tab) goToTab(tab);
    /* Patient Collection has no chips: the same word is its status FILTER, so
       "View Notice sent" has to set the field rather than a chip nothing
       reads. Setting the chip there would silently narrow the list a second
       time, on top of whatever the funnel already holds. */
    if (state.tab === 'collection') state.collectionFilters.status = chipKey;
    else state.chip = chipKey;
    state.selected = [];
    table().clearSelection();
    pager.reset();
    paint({ headerToo: true });
    return;
  }

  if (hit('#remitAddSave')) { saveRemit(); return; }
  if (hit('#remitPdfGo')) {
    modal('modalRemitPdf').close();
    flash('Remit PDF filed. Key its figures in with Add Remit to post them.', 'success');
    return;
  }
  if (hit('#remitViewPdf')) { notYet('Viewing the remittance as a PDF'); return; }
  if (hit('#eraUploadGo')) { modal('modalEraUpload').close(); flash('ERA file uploaded and queued for posting.', 'success'); return; }
  if (hit('#appealDownload')) { modal('modalAppeal').close(); flash('Appeal letter downloaded.', 'success'); return; }
  if (hit('#cmsSave')) { modal('modalPaperClaim').close(); flash('Paper claim saved.', 'success'); return; }
  if (hit('#ubSave')) { modal('modalUb04').close(); flash('UB-04 saved.', 'success'); return; }
  if (hit('#cmsExport') || hit('#eobExport') || hit('#ubExport')) { notYet('Exporting a PDF'); return; }
  if (hit('#cmsEmail') || hit('#ubEmail')) { notYet('Sending by email'); return; }
  const rejectFix = hit('[data-reject-fix]');
  if (rejectFix) {
    modal('modalRejection').close();
    notYet(rejectFix.dataset.rejectFix);
    return;
  }

  /* --- claim stage -------------------------------------------------------- */
  const panelToggle = hit('[data-panel]');
  if (panelToggle) {
    const body = document.getElementById(panelToggle.dataset.panel);
    const open = panelToggle.getAttribute('aria-expanded') === 'true';
    panelToggle.setAttribute('aria-expanded', String(!open));
    body.hidden = open;
    return;
  }

  if (hit('#claimRescrub')) { rescrubClaim(); return; }
  if (hit('#claimSubmit')) { submitClaimFromStage(); return; }
  if (hit('#claimSave')) { flash('Claim saved.', 'success'); return; }
  if (hit('#claimAppeal')) { openAppeal(state.claim); return; }
  if (hit('#claimViewErrors')) { openRejectionDetail(); return; }
  if (hit('#claimViewSummary')) { notYet('The original claim summary'); return; }
  if (hit('[data-remove-code]')) { notYet('Editing codes on a locked claim'); return; }
  if (hit('[data-eligibility]')) { notYet('A live eligibility check'); return; }

  const railEdit = hit('[data-rail-edit]');
  if (railEdit) { notYet(`Editing ${railEdit.dataset.railEdit} details`); return; }

  if (hit('#addNote')) {
    const box = document.getElementById('newNote');
    const text = (box?.value || '').trim();
    if (!text) { flash('Write the note first.'); return; }
    notesFor(state.claim).unshift({ meta: 'Just now', text });
    // Same mode resolution openClaimStage used, or a note added to a denial
    // would repaint the rail as the ordinary one and lose the denial card.
    const railMode = state.claimMode === 'view' ? modeFor(state.claim) : state.claimMode;
    document.getElementById('claimRail').innerHTML =
      claimRailHtml(state.claim, railMode, state.claimMode === 'view');
    flash('Note added.', 'success');
    return;
  }

}
