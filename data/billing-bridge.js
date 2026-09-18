/**
 * The hand-off from a locked procedure encounter to Billing.
 *
 * WHY THIS EXISTS
 * encounter.html and billing.html are separate page loads with no shared
 * module state, the same problem data/appointment-store.js solves for
 * check-in and pre-check. When an encounter locks, it has an ASC superbill
 * ready to go; Billing needs to see it without the two screens knowing
 * anything else about each other. sessionStorage is the established bridge
 * for that, so this follows the same shape rather than inventing a second one.
 *
 * Billing is empty for now, so nothing reads the queue yet — locking still
 * fills it, and loadPendingSuperbills() is the read half waiting for the
 * section to come back. Deleting either half would only mean writing the
 * same bridge again later.
 *
 * sessionStorage rather than localStorage for the same reason: a reviewer's
 * run should not leak into the next person's tab.
 */

const KEY = 'medinova.pendingSuperbills';

export function loadPendingSuperbills() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through — Billing just shows none of these yet */
  }
  return [];
}

/** Idempotent — re-locking the same encounter must not duplicate its bill. */
export function enqueueSuperbill(record) {
  try {
    const list = loadPendingSuperbills().filter((r) => r.id !== record.id);
    list.unshift(record);
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* nothing to do — the encounter still locks, it just has nothing to hand off */
  }
}
