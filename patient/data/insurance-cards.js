/**
 * INSURANCE CARD SCANS — the images behind the four card slots.
 *
 * WHY THIS IS PERSISTED WHEN MOST OF THE PORTAL IS NOT
 *
 * Same reason as data/form-store.js: the feature is not demonstrable without
 * it. "Photograph your card" is a thing a patient does once, from their
 * phone, and the whole value of it is that the practice has the image
 * afterwards. A scan that vanishes on refresh demonstrates the opposite of
 * what the feature claims.
 *
 * WHAT IS STORED, AND WHAT THAT COSTS
 *
 * A data: URL per side, which is the file base64-encoded — about a third
 * larger than the file itself. localStorage gives roughly 5MB per origin, so
 * four ten-megabyte photographs will not fit and are not meant to: see
 * MAX_BYTES below, and note that write() reports a quota failure rather than
 * swallowing it. This is a prototype's answer to "where does the image go",
 * not a real one — in a real build the file is uploaded and this holds an id.
 *
 * ⚠ AND NOTE WHAT IT MEANS. An insurance card carries a member ID and a name.
 * Putting one in localStorage leaves it readable by any script on this origin
 * and sitting on the device after sign-out. That is acceptable for a
 * prototype with invented data and would not be acceptable with a real card.
 */

const KEY = 'medinova.patient.cards.v1';
const VERSION = 1;

/** 10MB, as the brief specifies. Checked before anything is read. */
export const MAX_BYTES = 10 * 1024 * 1024;

/** What a card slot will take. Images to photograph, PDF to attach a scan. */
export const ACCEPTED = ['image/', 'application/pdf'];

/** The two sides every plan has, in the order they are drawn. */
export const SIDES = [
  { id: 'front', label: 'Front of card' },
  { id: 'back', label: 'Back of card' },
];

const empty = () => ({ version: VERSION, scans: {} });

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return parsed?.version === VERSION ? parsed : empty();
  } catch {
    return empty();
  }
}

/**
 * Write, and say whether it worked.
 *
 * Unlike the form store this one does NOT swallow a failure. A quota error
 * here means the patient's photograph was not kept, and the screen has to be
 * able to tell them so — silently dropping an image somebody just took is
 * the worst available behaviour.
 */
function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** The key one slot is stored under. */
const slotKey = (planId, side) => `${planId}:${side}`;

/** The scan in one slot, or null. */
export const scanFor = (planId, side) => read().scans[slotKey(planId, side)] ?? null;

/** Every scan a plan holds, keyed by side — for the printed or read-back view. */
export function scansForPlan(planId) {
  const { scans } = read();
  return SIDES.reduce((all, side) => {
    const found = scans[slotKey(planId, side.id)];
    if (found) all[side.id] = found;
    return all;
  }, {});
}

/**
 * Put an image in a slot.
 *
 * @param {string} planId
 * @param {string} side       'front' or 'back'
 * @param {object} scan       {dataUrl, name, size, type}
 * @returns {boolean} false when storage refused it
 */
export function saveScan(planId, side, scan) {
  const state = read();
  state.scans[slotKey(planId, side)] = { ...scan, savedAt: new Date().toISOString() };
  return write(state);
}

export function removeScan(planId, side) {
  const state = read();
  delete state.scans[slotKey(planId, side)];
  write(state);
}

/**
 * Move every scan from one plan id to another.
 *
 * Needed because a plan added through the drawer is given a temporary id
 * while its images are being attached, and a real one when it is saved.
 * Without this the images would be stranded under an id nothing refers to.
 */
export function reassignScans(fromPlanId, toPlanId) {
  const state = read();
  SIDES.forEach(({ id }) => {
    const found = state.scans[slotKey(fromPlanId, id)];
    if (!found) return;
    state.scans[slotKey(toPlanId, id)] = found;
    delete state.scans[slotKey(fromPlanId, id)];
  });
  write(state);
}

/** Test hook — clears every stored scan. Not reachable from the UI. */
export function resetScans() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/* ============================================================================
   VALIDATION
   ========================================================================= */

/**
 * Is this file allowed, and if not, why not.
 *
 * Returns a MESSAGE rather than a boolean, because every caller needs the
 * wording and there is one right wording per reason. Phrased at the patient:
 * "Choose a photo or a PDF" tells them what to do next, where "Invalid MIME
 * type" tells them they did something wrong.
 */
export function rejectionFor(file) {
  if (!file) return 'No file was chosen.';

  const typed = ACCEPTED.some((prefix) => file.type.startsWith(prefix));
  if (!typed) {
    return 'That is not a photo or a PDF. Choose a JPG, PNG, HEIC or PDF of your card.';
  }

  if (file.size > MAX_BYTES) {
    return `That file is ${megabytes(file.size)}MB. Cards have to be under ${
      MAX_BYTES / 1024 / 1024
    }MB — try photographing it again at a lower resolution.`;
  }

  return null;
}

/** "1.4" — one decimal place, which is all anyone reads off a file size. */
export const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** "842 KB" / "1.4 MB" — the size as it is shown beside a filename. */
export function readableSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${megabytes(bytes)} MB`;
}
