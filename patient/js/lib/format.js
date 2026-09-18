/**
 * Small formatting helpers shared by the screens.
 *
 * Deliberately tiny and dependency-free. Anything that grows a second
 * behaviour or a locale argument belongs in its own module.
 */

/**
 * Escape text destined for innerHTML.
 *
 * Every screen renders its rows as HTML strings from the data/ modules, so
 * this runs on the way in. The data is ours and none of it is hostile today —
 * but "the data is ours" stops being true the first time this is wired to an
 * API, and an escaping habit that was never established is not one that gets
 * added later.
 */
export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Initials for the avatar discs.
 *
 * First and last word only: "Comprehensive Metabolic Panel" would otherwise
 * render three letters into a circle sized for two. Anything unparseable
 * falls back to a single dot rather than an empty circle, which reads as a
 * loading state that never finishes.
 */
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '·';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[words.length - 1][0];
}

/** "$ 526.00" — the spaced form the design uses in the billing tables. */
export function money(amount) {
  return `$ ${Number(amount).toFixed(2)}`;
}

/** Pluralise a countable noun without a library. */
export const plural = (count, one, many = `${one}s`) => (count === 1 ? one : many);
