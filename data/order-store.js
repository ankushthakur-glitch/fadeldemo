/**
 * Orders raised somewhere other than the chart's own Orders tab.
 *
 * WHY THIS EXISTS
 * The Plan section of a clinic visit note can now raise a lab, an EGD or a
 * colonoscopy without the clinician leaving the note. Those orders have to
 * turn up in the chart afterwards — that is the entire point of raising them
 * — and the chart is a different page load, where data/chart-orders.js is
 * re-imported and rebuilt from its seed. So an order written on the note has
 * to be put somewhere that survives the navigation.
 *
 * sessionStorage, keyed by MRN, for the same reasons as
 * data/appointment-store.js and data/recall-store.js: no backend, but "no
 * backend" should not mean "no memory", and a new tab should still open on
 * clean demo data.
 *
 * WHY IT IS AN OVERLAY RATHER THAN A COPY OF THE WHOLE RECORD
 * The obvious shape is the appointment store's: load the seed, keep the whole
 * list, write the whole list back. That would mean the chart's own Add Lab
 * Test, Edit and Delete all had to be rerouted through here to stay
 * consistent, which is a rewrite of a module this change has no business
 * rewriting. So this holds ONLY the orders raised from outside, the chart
 * merges them in front of its seed at render, and everything the chart already
 * does to its own rows keeps working exactly as it did — including not
 * persisting, which is how it has always behaved.
 *
 * The seam is honest rather than hidden: an order raised on the note is a new
 * row at the top of the list, and editing it in the chart lasts as long as
 * that visit to the chart. Nothing about that is worse than the module was
 * yesterday.
 */
import { CHART_ORDERS, EMPTY_CHART_ORDERS } from './chart-orders.js';

const KEY = 'medinova.raised-orders';

/** The four lists every record has, named once so a typo cannot invent a fifth. */
const GROUPS = ['labs', 'imaging', 'procedures', 'nonVisit'];

const emptyOverlay = () => ({ labs: [], imaging: [], procedures: [], nonVisit: [] });

/**
 * Storage can throw — private browsing, a full quota, a file:// page with no
 * origin to key on. Every failure falls back to "nothing was raised", which is
 * the behaviour this module had before it existed.
 */
function loadOverlay() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* fall through to empty */
  }
  return {};
}

function saveOverlay(all) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* nothing to do — the order is still on the note that raised it */
  }
}

/**
 * One patient's orders: everything raised from outside, then the seed.
 *
 * Raised rows come FIRST because the chart's worklists are newest-first and a
 * scope ordered ten minutes ago belongs above one ordered last October. The
 * arrays are fresh on every call, so a caller that mutates what it gets back
 * — which the chart module does, on purpose — cannot reach into the seed.
 */
export function ordersFor(mrn) {
  const record = CHART_ORDERS[mrn] ?? EMPTY_CHART_ORDERS;
  const raised = loadOverlay()[mrn] ?? emptyOverlay();

  return GROUPS.reduce((out, group) => {
    out[group] = [...(raised[group] ?? []), ...(record[group] ?? [])];
    return out;
  }, {});
}

/**
 * File orders against a chart.
 *
 * Takes a whole batch rather than one order at a time because that is how they
 * arrive: a note is signed and everything on its Plan is raised together, in
 * one commit, under one signature. Writing them one by one would mean a
 * half-filed plan if anything between the calls threw.
 *
 * Returns how many were filed, so the caller can say so honestly rather than
 * announcing a number it assumed.
 */
export function raiseOrders(mrn, batch) {
  if (!mrn) return 0;

  const all = loadOverlay();
  const raised = { ...emptyOverlay(), ...(all[mrn] ?? {}) };

  let filed = 0;
  GROUPS.forEach((group) => {
    const orders = batch?.[group] ?? [];
    if (!orders.length) return;
    raised[group] = [...orders, ...(raised[group] ?? [])];
    filed += orders.length;
  });

  if (!filed) return 0;

  all[mrn] = raised;
  saveOverlay(all);
  return filed;
}
