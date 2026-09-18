/**
 * READING A FILTER THAT HOLDS MORE THAN ONE ANSWER.
 *
 * Every filter bar in this product used to ask a single question — one status,
 * one provider, one payer — and answer it with `row.status !== state.status`.
 * That is the wrong shape for the work: a biller chasing denials wants Denied
 * AND Rejected, a scheduler covering a colleague wants two locations, and the
 * only way to get either was to look at one, then look at the other, and hold
 * the difference in your head.
 *
 * <ui-select multiple> already knew how to ask for a set (see the "PICKING MORE
 * THAN ONE" chapter in js/lib/select-menu.js). What every screen needed was one
 * line of reading code to go with it, rather than fifty screens each inventing
 * their own way of splitting a comma-joined string.
 *
 * THE SHAPE ON THE WIRE IS A STRING, AND DELIBERATELY SO.
 * An attribute can only hold a string, and `select.value` still has to answer
 * for a field a screen has not been taught about yet — so a multiple select
 * carries its answers comma-joined, exactly as <ui-select> writes them. These
 * two functions are the only place that fact has to be known.
 *
 * NOTHING CHOSEN MEANS NOT NARROWING.
 * An empty filter admits every row. That is the same meaning the old empty
 * string had, which is why converting a screen is a one-line change per
 * predicate and why a filter bar with nothing set behaves exactly as it did.
 */

/** The answers a filter is holding, as a list. Accepts a string or an array. */
export function chosen(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Does this filter let the row through?
 *
 * True when nothing has been chosen — an empty filter is not a filter — and
 * otherwise true when `value` is one of the answers.
 *
 *   if (!admits(f.status, statusLabel(row))) return false;
 */
export function admits(filter, value) {
  const picked = chosen(filter);
  return picked.length === 0 || picked.includes(String(value ?? ''));
}

/**
 * The same question asked of several values at once, for a row that carries a
 * list rather than a single answer — a remittance holding four claims, each
 * with its own service type. True if ANY of them is admitted.
 */
export function admitsAny(filter, values) {
  const picked = chosen(filter);
  if (!picked.length) return true;
  return (values ?? []).some((value) => picked.includes(String(value ?? '')));
}
