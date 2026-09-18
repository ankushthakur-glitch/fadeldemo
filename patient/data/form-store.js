/**
 * FORM SUBMISSIONS AND DRAFTS — the only part of the portal that survives a
 * reload.
 *
 * WHY THIS ONE IS PERSISTED WHEN NOTHING ELSE IS
 *
 * Every other fixture in this directory is mutable in memory and gone on
 * refresh, and says so. Forms cannot be, for two reasons that are about the
 * feature rather than about the prototype:
 *
 *   1. A DRAFT THAT DOES NOT SURVIVE A RELOAD IS NOT A DRAFT. "Save & continue
 *      later" is a promise, and the whole point of the forty-field interview
 *      form is that you can stop halfway and come back to it.
 *   2. VERSION HISTORY IS A CLAIM ABOUT THE PAST. "Version 1 — superseded"
 *      means the original was kept. A history that empties itself on refresh
 *      demonstrates the opposite of what it is there to show.
 *
 * localStorage rather than sessionStorage: a patient who closes the tab and
 * comes back tomorrow is exactly the case being modelled.
 *
 * WHAT THIS IS NOT
 *
 * Not a backend, and not a record. In a real build every version below is a
 * row the practice holds, signed and timestamped server-side, and the browser
 * keeps nothing. This exists so the FLOW can be reviewed — fill, sign, submit,
 * find the mistake, correct it, and still be able to produce the original.
 */

import { FORMS, formById } from './forms.js';
import { PATIENT } from './patient.js';

const KEY = 'medinova.patient.forms.v1';

/*
 * Bumped to 2 when withdrawals arrived. A record written by version 1 has
 * submissions but no `revocations`, and read() throws it away rather than
 * half-reading it — the same call auth-store.js makes. The cost is that a
 * reviewer mid-session loses their drafts once; the alternative is a shape
 * that is sometimes missing the key that says whether a consent still stands.
 */
const VERSION = 2;

/* ============================================================================
   PERSISTENCE

   Read and write the whole record each time. It is a few kilobytes and this
   is a prototype; a partial-update path would be a second way for the two
   halves to disagree.
   ========================================================================= */

const empty = () => ({ version: VERSION, drafts: {}, submissions: {}, revocations: {} });

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    // Same schema check auth-store.js makes: a record written by an older
    // shape is thrown away rather than half-read.
    return parsed?.version === VERSION ? parsed : empty();
  } catch {
    return empty();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /*
     * Private browsing, or the quota is full — a signature is a data URL and
     * they are not small. The flow still works for this page view, which is
     * the same bargain auth-store.js makes. It is silent on purpose: a toast
     * saying "could not save" on every keystroke of an autosaved draft would
     * be worse than the thing it is reporting.
     */
  }
}

/** Wipe everything this module owns. Test hook; not reachable from the UI. */
export function resetFormStore() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/* ============================================================================
   DRAFTS
   ========================================================================= */

/** The saved-but-not-submitted answers for one form, or null. */
export const draftFor = (formId) => read().drafts[formId] ?? null;

/** Every form with a draft against it — what puts the "In progress" chip up. */
export const hasDraft = (formId) => Boolean(read().drafts[formId]);

export function saveDraft(formId, answers) {
  const state = read();
  state.drafts[formId] = { answers, savedAt: new Date().toISOString() };
  write(state);
  return state.drafts[formId];
}

/**
 * Drop a draft.
 *
 * Called on submit, and only there. A draft is the unsubmitted copy; once the
 * real thing exists the draft is not history, it is a stale duplicate, and
 * leaving it would put an "In progress" chip on a completed form.
 */
export function clearDraft(formId) {
  const state = read();
  delete state.drafts[formId];
  write(state);
}

/* ============================================================================
   SUBMITTED VERSIONS
   ========================================================================= */

/**
 * Every version of one form, oldest first.
 *
 * SEEDED COMPLETIONS ARE SYNTHESISED INTO VERSION 1. Four forms arrive
 * already completed in data/forms.js, from before this store existed. Without
 * this they would be completed forms with no version to view, print or
 * correct — the one state the whole feature has nothing to say about. So the
 * fixture's own `answers` and `completedOn` become version 1 the first time
 * anybody asks, and from then on they are versions like any other.
 */
export function versionsFor(formId) {
  const stored = read().submissions[formId];
  if (stored?.length) return stored;

  const form = formById(formId);
  // `status !== 'todo'` rather than `=== 'completed'`: a seeded consent that
  // has since been withdrawn still HAS a version — the one being withdrawn —
  // and it is the thing the card offers to show.
  if (!form || form.status === 'todo' || !form.answers) return [];

  return [seededVersion(form)];
}

/**
 * The version a patient is currently held to — the newest one.
 *
 * Everything else is superseded. Returning the last rather than searching for
 * `!superseded` means there is exactly one definition of "current" and it
 * cannot disagree with the flags.
 */
export function currentVersion(formId) {
  const all = versionsFor(formId);
  return all.length ? all[all.length - 1] : null;
}

export function versionAt(formId, number) {
  return versionsFor(formId).find((entry) => entry.version === Number(number)) ?? null;
}

/**
 * File a new version.
 *
 * The previous one is marked superseded rather than replaced — that is the
 * entire requirement, and it is enforced here rather than in the screen so no
 * future caller can file a correction that quietly overwrites.
 *
 * @param {string} formId
 * @param {object} entry
 * @param {object} entry.answers
 * @param {object} [entry.signature] {dataUrl|null, name, typed, signedAt}
 * @param {string} [entry.reason]    why this correction was made
 */
export function addVersion(formId, { answers, signature = null, reason = '' }) {
  const state = read();
  const existing = state.submissions[formId] ?? versionsFor(formId);
  const now = new Date();

  const previous = existing[existing.length - 1];
  if (previous) {
    previous.superseded = true;
    previous.supersededOn = stamp(now);
  }

  const entry = {
    version: existing.length + 1,
    answers,
    signature,
    reason,
    completedOn: stamp(now),
    completedAt: now.toISOString(),
    superseded: false,
    supersededOn: null,
  };

  state.submissions[formId] = [...existing, entry];
  // Giving a consent again ends the withdrawal. Deleted rather than
  // superseded: the withdrawal was about the version before this one, and a
  // stale flag beside a fresh signature is the one disagreement this store
  // must not be able to produce.
  delete state.revocations[formId];
  write(state);
  return entry;
}

/* ============================================================================
   WITHDRAWN CONSENTS

   A withdrawal is stored beside the versions, never instead of them. It names
   the version it took back, so a reader can always answer both halves of the
   question: what was agreed to, and when it stopped applying.
   ========================================================================= */

/**
 * Withdraw the consent currently in force.
 *
 * The seeded version is written into `submissions` on the way past. Four of
 * the consents exist only as a fixture completion until somebody asks for
 * their history (see versionsFor); withdrawing one is exactly when that
 * history starts to matter, and a withdrawal pointing at a version that is
 * re-derived on every load is a record with nothing underneath it.
 *
 * @param {string} formId
 * @param {string} [reason]  what the patient said, in their words. Optional —
 *                           nobody has to justify taking back a permission.
 */
export function addRevocation(formId, reason = '') {
  const entry = currentVersion(formId);
  if (!entry) return null;

  const state = read();
  state.submissions[formId] ??= versionsFor(formId);

  const now = new Date();
  state.revocations[formId] = {
    version: entry.version,
    reason,
    revokedOn: stamp(now),
    revokedAt: now.toISOString(),
  };

  write(state);
  return state.revocations[formId];
}

/* ============================================================================
   SHARED
   ========================================================================= */

/**
 * Turn a fixture's completion into a version 1 record.
 *
 * The signature is synthesised as a TYPED one for the forms that require it.
 * That is the honest reading of the fixture: those were signed before this
 * portal could draw a signature, the practice holds the paper, and claiming a
 * drawn image the prototype does not have would be inventing evidence.
 */
function seededVersion(form) {
  return {
    version: 1,
    answers: form.answers,
    signature: form.signatureRequired
      ? {
          dataUrl: null,
          name: PATIENT.name,
          typed: true,
          signedAt: null,
          signedOn: form.completedOn,
        }
      : null,
    reason: '',
    completedOn: form.completedOn,
    completedAt: null,
    superseded: false,
    supersededOn: null,
  };
}

/** `MM/DD/YYYY`, built from the parts — see lib/dates.js for why not Date. */
function stamp(when) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(when.getMonth() + 1)}/${pad(when.getDate())}/${when.getFullYear()}`;
}

/**
 * Bring the in-memory FORMS list up to date with what is stored.
 *
 * Called once when the Forms & Consents screen loads. Without it a page
 * refresh would show every form the patient submitted last session back as
 * outstanding — the fixture is rebuilt from source on every load, and the
 * store is the only thing that remembers.
 *
 * SUBMISSIONS FIRST, THEN WITHDRAWALS, in that order and not the other way
 * round. A withdrawal is the later fact about a consent that was submitted;
 * replaying it second is what makes the last thing the patient did the thing
 * the screen shows.
 */
export function rehydrateForms() {
  const state = read();

  FORMS.forEach((form) => {
    const versions = state.submissions[form.id];
    if (versions?.length) {
      const latest = versions[versions.length - 1];
      form.status = 'completed';
      form.completedOn = latest.completedOn;
      form.answers = latest.answers;
      form.revokedOn = null;
      form.revokeReason = '';
    }

    const revoked = state.revocations[form.id];
    if (!revoked) return;

    form.status = 'revoked';
    form.revokedOn = revoked.revokedOn;
    form.revokeReason = revoked.reason;
  });
}
