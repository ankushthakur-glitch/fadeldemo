/**
 * AUTHENTICATION — SIMULATED
 *
 * ⚠ READ THIS BEFORE REUSING ANY OF IT.
 *
 * This is a clickable prototype with no server. Everything below runs in the
 * browser, and the "accounts" are a literal array a few lines down. It exists
 * so the login, lockout, expiry and reset SCREENS can be designed and reviewed
 * against real behaviour — not to authenticate anyone.
 *
 * What that means concretely:
 *   - Credentials are readable by anyone who opens devtools. They are fake.
 *   - Lockout, attempt counting and session expiry live in localStorage, so
 *     they are trivially cleared. In the real system every one of these is a
 *     server decision; the client may only render the outcome.
 *   - Nothing here hashes, salts, or transmits anything.
 *
 * The real build replaces this file with calls to the identity provider. The
 * SCREENS should not need to change: they only ever see the result shapes
 * below ({ ok } or { ok: false, reason }), which are what a real endpoint
 * would return anyway.
 *
 * Server-side items from the security brief that a front-end prototype cannot
 * implement, and which are therefore NOT simulated here — they are listed so
 * nobody mistakes their absence for an oversight: IP logging, audit logging,
 * HTTPS/HSTS, real rate limiting, real CAPTCHA verification, and the actual
 * sending of reset emails.
 */

const KEY = 'medinova.auth.v1';
const VERSION = 1;

/* --- Policy -----------------------------------------------------------------
   The knobs a practice administrator would set. Named and gathered here so a
   reviewer can see the whole policy at a glance rather than hunting for
   numbers buried in the flow. */
export const POLICY = {
  maxAttempts: 5, // failures before the account locks
  lockoutMinutes: 15, // how long a lock lasts
  captchaAfter: 3, // failures before a challenge is required
  sessionMinutes: 30, // idle time before the session expires
  passwordDays: 90, // password age before a change is forced
  minPasswordLength: 8,
};

/* --- The fake directory -----------------------------------------------------
   Each account demonstrates one state the login screen has to handle. The
   passwords are deliberately obvious: this is a demo, and a reviewer needs to
   be able to sign in without being told a secret. */
const ACCOUNTS = [
  {
    email: 'amara.mensah@medinovagi.example',
    password: 'MediNova!2026',
    name: 'Amara Mensah',
    role: 'Physician',
    status: 'active',
    passwordAgeDays: 12,
  },
  {
    email: 'inactive@medinovagi.example',
    password: 'MediNova!2026',
    name: 'Jordan Vale',
    role: 'Scheduler',
    status: 'inactive', // deactivated by an administrator
    passwordAgeDays: 30,
  },
  {
    email: 'expired@medinovagi.example',
    password: 'MediNova!2026',
    name: 'Priya Raman',
    role: 'Nurse',
    status: 'active',
    passwordAgeDays: 104, // past POLICY.passwordDays
  },
];

/**
 * The account a reviewer lands on when they press Sign In without typing.
 *
 * Named here rather than written into the login screen, so the credential
 * exists once: the screen prints it, the empty-form shortcut uses it, and the
 * two cannot drift apart into a hint that no longer works.
 */
export const DEMO_ACCOUNT = { email: ACCOUNTS[0].email, password: ACCOUNTS[0].password };

/** Every reason the screens know how to explain. */
export const REASONS = {
  BAD_CREDENTIALS: 'bad-credentials',
  LOCKED: 'locked',
  INACTIVE: 'inactive',
  PASSWORD_EXPIRED: 'password-expired',
  SESSION_EXPIRED: 'session-expired',
  NETWORK: 'network',
  SERVER: 'server',
  CAPTCHA_REQUIRED: 'captcha-required',
};

/* --- Persistence ------------------------------------------------------------ */

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

/* --- Queries ----------------------------------------------------------------- */

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

/** A challenge is required once failures pass the threshold. */
export function captchaRequired(email) {
  return failedAttempts(email) >= POLICY.captchaAfter;
}

/** "Remember this device" was ticked on a previous successful sign-in. */
export function rememberedEmail() {
  return read().device?.email ?? '';
}

/* --- Validation -------------------------------------------------------------
   Shared with the reset screen, so the rule that decides whether a password is
   acceptable is written once. */

export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${POLICY.minPasswordLength} characters`, test: (v) => v.length >= POLICY.minPasswordLength },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordChecks(value) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value || '') }));
}

/** 0–5, the count of rules met. The screen turns that into a label and a bar. */
export function passwordScore(value) {
  return passwordChecks(value).filter((check) => check.met).length;
}

/*
 * Deliberately permissive: anything with an @ and a dot after it.
 *
 * A stricter regex rejects addresses that are perfectly valid (plus-addressing,
 * new TLDs, apostrophes in the local part) and a clinician locked out of the
 * EHR by a typo-checker is a worse outcome than a typo reaching the server.
 */
export function isEmailShaped(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/* --- Sign in ------------------------------------------------------------------ */

/**
 * Attempt a sign-in. Returns { ok: true, user } or { ok: false, reason, ... }.
 *
 * `simulate` forces an outcome so the network and server error states are
 * reachable for review — the real client gets these from a failed fetch.
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
   * Saying "no account with that email" tells an attacker which addresses are
   * real, which for a clinic is also a roster of who works there. The count
   * still increments either way, so probing addresses is not free.
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

  // Credentials are right; the account itself may still not be usable.
  if (account.status === 'inactive') {
    return { ok: false, reason: REASONS.INACTIVE };
  }

  if (account.passwordAgeDays > POLICY.passwordDays) {
    // Not a failed attempt — the person proved who they are. Clear the count
    // and send them to set a new password.
    delete state.attempts[id];
    write(state);
    return { ok: false, reason: REASONS.PASSWORD_EXPIRED, email: account.email };
  }

  delete state.attempts[id];
  delete state.lockedUntil[id];
  state.session = {
    email: account.email,
    name: account.name,
    role: account.role,
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

export function signOut() {
  const state = read();
  state.session = null;
  write(state);
}

/** Test hook — clears attempts, locks and session. Not reachable from the UI. */
export function resetAll() {
  write(emptyState());
}

/* --- Password reset ------------------------------------------------------------ */

/**
 * "Send" a reset link. Always reports success, whether or not the address is
 * on file — a form that says "no such account" is an address checker.
 */
export function requestReset(email) {
  return { ok: isEmailShaped(email) };
}

/** Apply a new password to the fake directory, so a demo can sign in with it. */
export function completeReset({ email, password }) {
  if (passwordScore(password) < PASSWORD_RULES.length) {
    return { ok: false, reason: 'weak' };
  }
  const account = ACCOUNTS.find((a) => a.email === normalise(email));
  if (account) {
    account.password = password;
    account.passwordAgeDays = 0;
  }
  const state = read();
  delete state.attempts[normalise(email)];
  delete state.lockedUntil[normalise(email)];
  write(state);
  return { ok: true };
}
