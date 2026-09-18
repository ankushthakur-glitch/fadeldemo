/**
 * PATIENT AUTHENTICATION — SIMULATED
 *
 * ⚠ READ THIS BEFORE REUSING ANY OF IT.
 *
 * This is a clickable prototype with no server. Everything below runs in the
 * browser and the "accounts" are a literal array a few lines down. It exists
 * so the portal's sign-in, lockout and expiry SCREENS can be designed and
 * reviewed against real behaviour — not to authenticate anyone.
 *
 *   - Credentials are readable by anyone who opens devtools. They are fake.
 *   - Lockout, attempt counting and session expiry live in localStorage, so
 *     they are trivially cleared. In the real system every one of these is a
 *     server decision; the client may only render the outcome.
 *   - Nothing here hashes, salts, or transmits anything.
 *
 * ── WHY THIS FILE EXISTS AT ALL, GIVEN js/lib/auth-store.js ──────────────────
 *
 * The EHR has its own store and the two look similar. They are NOT one module
 * with a role flag, and that is the point of the whole portal split:
 *
 *   1. SEPARATE SESSIONS. This writes to `medinova.patient.auth.v1`; the EHR
 *      writes to `medinova.auth.v1`. A clinician signed into the EHR in one tab
 *      has no session here, and a patient signed in here cannot reach a
 *      single EHR screen. Sharing a key would make "signed in" mean one thing
 *      across two products with completely different data rights — which is
 *      the exact failure a patient portal must not have.
 *   2. SEPARATE DIRECTORIES. Staff accounts and patient accounts are
 *      different populations. Merging them puts every clinician's address in
 *      the same probe space as every patient's.
 *   3. SEPARATE POLICY. See POLICY below — a portal on a shared home computer
 *      wants a shorter idle timeout than a workstation inside a clinic.
 *
 * The real build replaces this file with calls to the patient identity
 * provider. The screens should not need to change: they only ever see the
 * result shapes below ({ ok } or { ok: false, reason }).
 */

const KEY = 'medinova.patient.auth.v1';
const VERSION = 1;

/* --- Policy -----------------------------------------------------------------
   The knobs an administrator would set for the patient-facing side. */
export const POLICY = {
  maxAttempts: 5, // failures before the account locks
  lockoutMinutes: 15, // how long a lock lasts
  captchaAfter: 3, // failures before a challenge is required
  /*
   * 20 minutes, against the EHR's 30.
   *
   * A clinician's workstation is inside a locked building and is theirs for
   * the shift. A patient reads their results on a laptop in a kitchen, or on
   * a library machine, and walks away from it. The shorter idle window is the
   * cheapest protection available for a device nobody controls.
   */
  sessionMinutes: 20,
  minPasswordLength: 8,
};

/* --- The fake directory -------------------------------------------------------
   Each account demonstrates one state the sign-in screen has to handle. The
   passwords are deliberately obvious: this is a demo, and a reviewer needs to
   be able to get in without being told a secret. */
const ACCOUNTS = [
  {
    email: 'henna.west@example.com',
    password: 'Portal!2026',
    name: 'Henna West',
    mrn: 'DG-104882',
    status: 'active',
  },
  {
    email: 'inactive@example.com',
    password: 'Portal!2026',
    name: 'Marcus Reed',
    mrn: 'DG-100341',
    status: 'inactive', // portal access withdrawn at the practice's end
  },
];

/**
 * The account a reviewer lands on when they press Log In without typing.
 *
 * Named here rather than written into the login screen, so the credential
 * exists once and a printed hint cannot drift away from what actually works.
 */
export const DEMO_ACCOUNT = { email: ACCOUNTS[0].email, password: ACCOUNTS[0].password };

/** Every reason the screens know how to explain. */
export const REASONS = {
  BAD_CREDENTIALS: 'bad-credentials',
  LOCKED: 'locked',
  INACTIVE: 'inactive',
  SESSION_EXPIRED: 'session-expired',
  NETWORK: 'network',
  SERVER: 'server',
  CAPTCHA_REQUIRED: 'captcha-required',
};

/* --- Persistence ------------------------------------------------------------- */

function emptyState() {
  return { version: VERSION, attempts: {}, lockedUntil: {}, session: null, device: null };
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return parsed?.version === VERSION ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Private browsing. The flow still works for this page view. */
  }
}

const normalise = (email) => String(email || '').trim().toLowerCase();

/* --- Queries ------------------------------------------------------------------- */

export function failedAttempts(email) {
  return read().attempts[normalise(email)] ?? 0;
}

/** Remaining lock in whole minutes, or 0 if the account is not locked. */
export function lockRemainingMinutes(email) {
  const until = read().lockedUntil[normalise(email)];
  if (!until) return 0;
  const left = until - Date.now();
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

export function captchaRequired(email) {
  return failedAttempts(email) >= POLICY.captchaAfter;
}

/** "Remember me" was ticked on a previous successful sign-in. */
export function rememberedEmail() {
  return read().device?.email ?? '';
}

/*
 * Deliberately permissive: anything with an @ and a dot after it.
 *
 * A stricter regex rejects addresses that are perfectly valid (plus
 * addressing, new TLDs, apostrophes in the local part). A patient locked out
 * of their own results by a typo-checker is a worse outcome than a typo
 * reaching the server.
 */
export function isEmailShaped(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/* --- Sign in --------------------------------------------------------------------- */

/**
 * Attempt a sign-in. Returns { ok: true, user } or { ok: false, reason, ... }.
 *
 * `simulate` forces an outcome so the network and server states are reachable
 * for review — the real client gets these from a failed fetch.
 */
export function signIn({ email, password, remember = false, simulate = '' }) {
  const id = normalise(email);
  const state = read();

  if (simulate === REASONS.NETWORK || simulate === REASONS.SERVER) {
    return { ok: false, reason: simulate };
  }

  const locked = lockRemainingMinutes(id);
  if (locked) return { ok: false, reason: REASONS.LOCKED, minutes: locked };

  const account = ACCOUNTS.find((a) => a.email === id);

  /*
   * A wrong address and a wrong password give the SAME answer.
   *
   * "No account with that email" turns the form into a checker for whether a
   * given person is a patient of this practice — which for a
   * gastroenterology clinic is a disclosure in itself, before any record is
   * ever opened. The count still increments either way, so probing is not
   * free.
   */
  if (!account || account.password !== password) {
    const attempts = (state.attempts[id] ?? 0) + 1;
    state.attempts[id] = attempts;

    if (attempts >= POLICY.maxAttempts) {
      state.lockedUntil[id] = Date.now() + POLICY.lockoutMinutes * 60_000;
      state.attempts[id] = 0;
      write(state);
      return { ok: false, reason: REASONS.LOCKED, minutes: POLICY.lockoutMinutes };
    }

    write(state);
    return {
      ok: false,
      reason: REASONS.BAD_CREDENTIALS,
      remaining: POLICY.maxAttempts - attempts,
    };
  }

  if (account.status === 'inactive') {
    return { ok: false, reason: REASONS.INACTIVE };
  }

  delete state.attempts[id];
  delete state.lockedUntil[id];
  state.session = {
    email: account.email,
    name: account.name,
    mrn: account.mrn,
    startedAt: Date.now(),
    expiresAt: Date.now() + POLICY.sessionMinutes * 60_000,
  };
  // Device recognition, in the only sense a prototype can mean it: the address
  // comes back pre-filled. It is NOT a second factor and never skips a password.
  state.device = remember ? { email: account.email } : null;
  write(state);

  return { ok: true, user: state.session };
}

export function currentSession() {
  const { session } = read();
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

/**
 * Push the idle timeout out by a full window.
 *
 * Called by the shell on every page load. The session is an IDLE timer, not a
 * hard cap: someone reading a long results page and then paying a statement
 * has been present the whole time and should not be thrown out mid-payment.
 */
export function touchSession() {
  const state = read();
  if (!state.session) return null;
  if (state.session.expiresAt <= Date.now()) return null;
  state.session.expiresAt = Date.now() + POLICY.sessionMinutes * 60_000;
  write(state);
  return state.session;
}

export function signOut() {
  const state = read();
  state.session = null;
  write(state);
}

/** "Send" a reset link. Always reports success, whether or not the address is
    on file — a form that says "no such account" is an address checker. */
export function requestReset(email) {
  return { ok: isEmailShaped(email) };
}

/** Test hook — clears attempts, locks and session. Not reachable from the UI. */
export function resetAll() {
  write(emptyState());
}
