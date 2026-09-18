/**
 * ICD-10 — THE ONE PLACE A DIAGNOSIS CODE IS LOOKED UP.
 *
 * Before this file the app had four separate ideas of what an ICD-10 code is,
 * and every screen that needed one rolled its own control on top of whichever
 * list happened to be nearest:
 *
 *   data/encounter.js    ICD10        { code, text }          → encounter, referrals
 *   data/master.js       ICD_CODES    { code, description, active }  → the code master
 *   data/chart-orders.js ICD_CODES    'K21.9 — GERD, ...'     → lab orders
 *   data/schedule.js     INDICATIONS  'Z12.11 - Screening...' → the procedure booking
 *
 * The two string lists had already drifted: one joins on an em dash, the other
 * on a hyphen, and the same code carries a different description in each. A
 * clinician searching "reflux" found it on one screen and not on the next.
 *
 * WHAT THIS FILE DOES NOT DO IS REWRITE THOSE FIXTURES. They stay exactly as
 * they are, and are merged here into one catalogue keyed by code. Nothing that
 * is currently on screen changes wording; what changes is that every SEARCH now
 * runs against the union of all four, so a code known anywhere is findable
 * everywhere. First list to define a code wins its description, and the order
 * below is deliberate — the encounter renders diagnosis text in more places
 * than anything else, so its wording is the one that stays put.
 *
 * ONE SEARCH FUNCTION, AND IT IS ASYNC ON PURPOSE.
 * searchIcd10 returns a promise it does not need to. A real ICD-10 lookup is a
 * network call against a ~70,000-row table — nobody ships the whole code set to
 * the browser — so the component that consumes this is built around latency,
 * loading state and out-of-order responses from day one. Swapping the body of
 * PROVIDERS.local for a fetch is then the whole migration.
 */

import { ICD10 as ENCOUNTER_ICD10 } from './encounter.js';
import { ICD_CODES as MASTER_ICD_CODES } from './master.js';
import { ICD_CODES as ORDER_ICD_STRINGS } from './chart-orders.js';
import { INDICATIONS } from './schedule.js';

/* ===================== Building the catalogue ===================== */

/**
 * Split 'K21.9 — GERD, without esophagitis' into its two halves.
 * Both separators are in use in the fixtures — an em dash on the order list,
 * a hyphen on the booking list — and a code is never itself hyphenated, so
 * splitting on the first run of dash-ish characters is safe.
 */
function splitCodedString(value) {
  const match = String(value).match(/^\s*([A-Z]\d[A-Z0-9.]*)\s*[—–-]\s*(.+)$/);
  if (!match) return null;
  return { code: match[1], description: match[2].trim() };
}

/**
 * `active` is only meaningful on the master list — it is what the code
 * maintenance screen toggles. Codes reaching us from anywhere else are in use
 * by definition, so they default to active.
 */
function buildCatalog() {
  const byCode = new Map();

  const add = (code, description, active = true) => {
    if (!code || byCode.has(code)) return;
    byCode.set(code, { code, description, active });
  };

  for (const entry of ENCOUNTER_ICD10) add(entry.code, entry.text);
  for (const entry of MASTER_ICD_CODES) add(entry.code, entry.description, entry.active);
  for (const value of ORDER_ICD_STRINGS) {
    const parsed = splitCodedString(value);
    if (parsed) add(parsed.code, parsed.description);
  }
  for (const value of INDICATIONS) {
    const parsed = splitCodedString(value);
    if (parsed) add(parsed.code, parsed.description);
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Every ICD-10 code this prototype knows about, deduped and sorted. */
export const ICD10_CATALOG = buildCatalog();

const BY_CODE = new Map(ICD10_CATALOG.map((entry) => [entry.code, entry]));

/** The one entry for a code, or null. */
export const icd10ByCode = (code) => BY_CODE.get(String(code ?? '').trim()) ?? null;

/** The description alone — for a screen that already shows the code itself. */
export const icd10Description = (code) => icd10ByCode(code)?.description ?? '';

/** How a code reads everywhere it is shown to a human: CODE — Description. */
export const formatIcd10 = (entry) =>
  entry ? `${entry.code} — ${entry.description}` : '';

/**
 * The code out of whatever shape a field happens to hold.
 *
 * Some records store the bare code ('K21.9'); the bookings store the whole
 * display string ('Z12.11 - Encounter for screening...') because that is what
 * the old free-text-with-datalist field put there, and billing renders it as
 * the visit reason. Both have to be able to reopen in the picker, so this
 * takes either and returns the code.
 */
export function icd10CodeFrom(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (BY_CODE.has(text)) return text;
  return splitCodedString(text)?.code ?? '';
}

/** The display string for a code, ready to store on a record that wants one. */
export const icd10Label = (code) => formatIcd10(icd10ByCode(code));

/* ===================== The short list ===================== */

/**
 * The handful of codes a desk books against all day.
 *
 * Search is right for seventy thousand codes and wrong for the eight that
 * account for most of a gastro list: somebody booking a screening colonoscopy
 * should not have to remember that it is filed under "neoplasm" to find
 * Z12.11. So the picker can also open as a plain dropdown, and this is what it
 * opens onto — the booking fixture's own indications, resolved through the
 * catalogue so the wording matches what the same code shows everywhere else.
 *
 * Order is the fixture's, not alphabetical: it is already sorted by how often
 * the list is booked, which is the only ordering that helps here.
 */
export const ICD10_COMMON = INDICATIONS
  .map((value) => splitCodedString(value)?.code)
  .map((code) => (code ? BY_CODE.get(code) : null))
  .filter(Boolean);

/**
 * Resolve a `suggest` attribute into entries to offer with nothing typed.
 *
 * Either the keyword `common` — the short list above — or an explicit
 * comma-separated set of codes, for a screen whose usual answers are its own.
 * Anything the catalogue does not know is dropped rather than shown as a bare
 * code with no description beside it.
 */
export function icd10Suggestions(spec) {
  const text = String(spec ?? '').trim();
  if (!text) return [];
  if (text.toLowerCase() === 'common') return [...ICD10_COMMON];
  return text
    .split(',')
    .map((code) => BY_CODE.get(code.trim()))
    .filter(Boolean);
}

/* ===================== Search ===================== */

/**
 * Codes are searched with the dot taken out.
 *
 * "K219" is how somebody who reads codes all day types K21.9 — the dot is
 * punctuation the keyboard makes them reach for. Normalising both sides means
 * the dotted and undotted forms find the same row.
 */
const bare = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Rank matters more than it looks.
 *
 * Typing "K21" must put K21.9 itself at the top, not a description that
 * happens to mention it. So: code prefix, then code anywhere, then description
 * word-start, then description anywhere. Within a band, shorter code first —
 * the less specific code is the one being narrowed down from.
 */
function rank(entry, query) {
  const code = bare(entry.code);
  const needle = bare(query);
  const words = entry.description.toLowerCase();
  const text = query.trim().toLowerCase();

  if (needle && code.startsWith(needle)) return 0;
  if (needle && code.includes(needle)) return 1;
  if (text && new RegExp(`\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(words)) return 2;
  if (text && words.includes(text)) return 3;
  return -1;
}

/**
 * The local provider — the whole catalogue, in memory.
 *
 * TODO(client-confirm): point this at the practice's real ICD-10 service. The
 * shape it must return is this function's: an array of { code, description },
 * already ranked, already capped at `limit`. Everything above and the
 * <ui-icd10> component consume that and nothing else, so a swap here is the
 * entire integration.
 */
const PROVIDERS = {
  local(query, limit) {
    const hits = [];
    for (const entry of ICD10_CATALOG) {
      if (!entry.active) continue;
      const score = rank(entry, query);
      if (score < 0) continue;
      hits.push({ entry, score });
    }
    hits.sort(
      (a, b) => a.score - b.score
        || a.entry.code.length - b.entry.code.length
        || a.entry.code.localeCompare(b.entry.code)
    );
    return hits.slice(0, limit).map((hit) => hit.entry);
  },
};

/** Which provider searchIcd10 runs against. See the TODO above. */
export const ICD10_PROVIDER = 'local';

/**
 * Fewer than this many characters is not a search, it is a keystroke on the
 * way to one. Two is enough to be a code prefix ("K2") and short enough that
 * "ib" still finds IBS.
 */
export const ICD10_MIN_QUERY = 2;

/**
 * Search by code OR description.
 *
 *   searchIcd10('K21')    → K21.9
 *   searchIcd10('reflux') → K21.9
 *   searchIcd10('K219')   → K21.9
 *
 * Resolves to [] for a query below ICD10_MIN_QUERY rather than throwing, so a
 * caller can hand it every keystroke without guarding first.
 */
export function searchIcd10(query, { limit = 20 } = {}) {
  const text = String(query ?? '').trim();
  if (text.length < ICD10_MIN_QUERY) return Promise.resolve([]);
  return Promise.resolve(PROVIDERS[ICD10_PROVIDER](text, limit));
}
