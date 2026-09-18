/**
 * Sign in.
 *
 * The screen's whole job is to get someone to the Scheduling workspace, or to
 * tell them plainly why it cannot. Every failure below names the thing that
 * went wrong and what to do next — "contact your practice administrator" is an
 * instruction, "authentication failed" is not.
 *
 * The authentication itself is SIMULATED. See lib/auth-store.js.
 */
import * as auth from '../lib/auth-store.js';
import { notify } from '../lib/toast.js';

/** Where a successful sign-in goes. Scheduling is where the day starts. */
const HOME = 'scheduler.html';

/*
 * One entry per failure the screen can show.
 *
 * severity  drives the toast's colour, and whether it interrupts the reader
 *           or waits for a gap — see lib/toast.js
 * heading   what happened
 * body      what to do about it — never blank
 */
const MESSAGES = {
  [auth.REASONS.BAD_CREDENTIALS]: (detail) => ({
    severity: 'critical',
    heading: 'Your email or password is incorrect.',
    body:
      detail.remaining <= 2
        ? `Check both and try again. ${detail.remaining} attempt${
            detail.remaining === 1 ? '' : 's'
          } remaining before this account is locked.`
        : 'Check both and try again.',
  }),

  [auth.REASONS.LOCKED]: (detail) => ({
    severity: 'critical',
    heading: 'Your account has been locked after multiple unsuccessful login attempts.',
    body: `For security, sign-in is paused for ${detail.minutes} minute${
      detail.minutes === 1 ? '' : 's'
    }. Your practice administrator can unlock it sooner.`,
  }),

  [auth.REASONS.INACTIVE]: () => ({
    severity: 'warning',
    heading: 'This account is no longer active.',
    body:
      'Your access has been deactivated. Contact your practice administrator to have it restored.',
  }),

  [auth.REASONS.PASSWORD_EXPIRED]: () => ({
    severity: 'warning',
    heading: 'Your password has expired.',
    body: 'Passwords are changed every 90 days. Set a new one to continue.',
  }),

  [auth.REASONS.SESSION_EXPIRED]: () => ({
    severity: 'info',
    heading: 'You were signed out after a period of inactivity.',
    body: 'Sign in again to return to your workspace. Nothing you saved was lost.',
  }),

  [auth.REASONS.NETWORK]: () => ({
    severity: 'warning',
    heading: "We can't reach the server.",
    body: 'Check your connection and try again. If you are on clinic Wi-Fi, reconnect and retry.',
  }),

  [auth.REASONS.SERVER]: () => ({
    severity: 'critical',
    heading: 'Something went wrong at our end.',
    body: 'This is not a problem with your account. Try again in a moment, or contact IT support.',
  }),
};

/* ============================================================================
   THE PROMO CAROUSEL

   Four captions. The panel itself is decorative and aria-hidden (see
   login.html) — this only drives what is painted. The same control ships on
   the patient portal; the copy is the only thing that differs, because what a
   clinician is being sold on and what a patient is being sold on are not the
   same thing.
   ========================================================================= */

const SLIDES = [
  {
    title: 'MediNova Gastroenterology EHR',
    body:
      'Secure Electronic Health Record platform designed to streamline ' +
      'scheduling, clinical documentation, referrals, billing, and patient care.',
  },
  {
    title: 'The Whole Day, One Screen.',
    body:
      'Scheduling, check-in and the room board stay in step, so the front desk ' +
      'and the floor are never working from two different lists.',
  },
  {
    title: 'Notes That Keep Up.',
    body:
      'Templates, orders and results land in the encounter as you work, and the ' +
      'summary is ready before the patient is out of the room.',
  },
  {
    title: 'Billing That Closes.',
    body:
      'Charges follow the note, claims go out clean, and what is still owed is ' +
      'visible without running a report.',
  },
];

const SLIDE_MS = 6000;

function startCarousel() {
  const promo = document.getElementById('promo');
  if (!promo) return; // forgot-password and reset-password carry a still panel
  const title = document.getElementById('promoTitle');
  const body = document.getElementById('promoBody');
  const dots = document.getElementById('promoDots');
  const panels = [...promo.querySelectorAll('.auth__slide')];
  if (!panels.length) return;

  dots.innerHTML = SLIDES.map(
    (slide, index) =>
      `<button type="button" class="auth__dot" data-slide="${index}"
        tabindex="-1" aria-current="${index === 0}"></button>`
  ).join('');

  let current = 0;
  let timer = 0;

  function show(index) {
    current = (index + SLIDES.length) % SLIDES.length;
    panels.forEach((panel, i) => {
      panel.dataset.current = String(i === current);
    });
    dots.querySelectorAll('.auth__dot').forEach((dot, i) => {
      dot.setAttribute('aria-current', String(i === current));
    });
    title.textContent = SLIDES[current].title;
    body.textContent = SLIDES[current].body;
  }

  /*
   * Advancing on a timer is a motion preference, not a decoration one.
   *
   * Someone who has asked their OS to reduce motion has asked not to have
   * things move on their own — so the carousel stops advancing entirely rather
   * than cross-fading faster. The dots still work, so all four slides stay
   * reachable by choice.
   */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function play() {
    stop();
    if (reduced.matches) return;
    timer = setInterval(() => show(current + 1), SLIDE_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = 0;
  }

  dots.addEventListener('click', (event) => {
    const dot = event.target.closest('[data-slide]');
    if (!dot) return;
    show(Number(dot.dataset.slide));
    play(); // restart the clock so a chosen slide gets its full turn
  });

  // Pause while the pointer is over the panel, and while the tab is in the
  // background — a carousel that spent ten minutes cycling to an empty room
  // resumes on whatever slide it happened to land on.
  promo.addEventListener('mouseenter', stop);
  promo.addEventListener('mouseleave', play);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stop() : play()
  );
  reduced.addEventListener('change', play);

  show(0);
  play();
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const remember = document.getElementById('remember');
  const submit = document.querySelector('[data-testid="login--submit"]');
  const caps = document.getElementById('capsWarning');
  const captchaSlot = document.getElementById('captchaSlot');

  /* The reply currently on screen, so the next one can take its place. Declared
     up here rather than beside banner(): a sign-in that has timed out is
     reported during set-up, before the helpers further down have been reached. */
  let standing = null;

  const params = new URLSearchParams(location.search);

  startCarousel();

  /* A device that ticked "remember" gets its address back, never its password.
     It saves a typed line; it is not a credential. */
  const known = auth.rememberedEmail();
  if (known) {
    emailField.setAttribute('value', known);
    remember.setAttribute('checked', '');
  }

  // Arriving from a timed-out session, or from a screen that required sign-in.
  if (params.get('reason') === auth.REASONS.SESSION_EXPIRED) {
    showMessage(auth.REASONS.SESSION_EXPIRED, {});
  }

  // Focus the first thing that still needs filling in.
  (known ? passwordField : emailField).focus();

  paintCaptcha();

  /* --- Caps Lock -------------------------------------------------------------
     Read from the key event rather than tracked as state: the key can be
     toggled while the window is in the background, and any state we kept would
     then be wrong at exactly the wrong moment. */
  passwordField.addEventListener('keydown', onCapsProbe, true);
  passwordField.addEventListener('keyup', onCapsProbe, true);
  passwordField.addEventListener(
    'focusout',
    () => {
      caps.hidden = true;
    },
    true
  );

  function onCapsProbe(event) {
    if (typeof event.getModifierState !== 'function') return;
    caps.hidden = !event.getModifierState('CapsLock');
  }

  /* --- Submit ----------------------------------------------------------------- */

  /*
   * One attempt at a time.
   *
   * The button is disabled while signing in, but "disabled" is a paint and
   * Enter-key repeats or a fast double-click can still deliver a second submit
   * in the window before it lands. Two handlers in flight both call signIn(),
   * so a single mistyped password gets counted TWICE against the account — and
   * five attempts is a lockout. The guard is the thing that makes the count
   * trustworthy; the disabled attribute only makes it look that way.
   */
  let inFlight = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;

    let email = emailField.value.trim();
    let password = passwordField.value;

    clearFieldErrors();
    hideMessage();

    /*
     * An empty form signs the reviewer straight in.
     *
     * This is a prototype whose point is the twenty screens behind this one,
     * and a sign-in nobody can get past is a door with no handle. Pressing
     * Sign In with nothing typed enters as the demo physician.
     *
     * It is deliberately scoped to a COMPLETELY empty form. Type anything and
     * the real behaviour applies in full — which is what keeps the states the
     * card below advertises (inactive, expired, wrong password, lockout,
     * captcha) reachable and worth reviewing.
     */
    if (!email && !password) {
      ({ email, password } = auth.DEMO_ACCOUNT);
    }

    // Client-side checks first: no point asking the server about a half-filled
    // form. A blank one never reaches here — it was filled in above.
    if (!email) return failField(emailField, 'Enter your work email address.');
    if (!auth.isEmailShaped(email)) {
      return failField(emailField, 'That does not look like an email address.');
    }
    if (!password) return failField(passwordField, 'Enter your password.');

    if (auth.captchaRequired(email) && !captchaSolved()) {
      return showMessage(auth.REASONS.CAPTCHA_REQUIRED, {});
    }

    inFlight = true;
    setBusy(true);

    /* A real request takes a moment, and the loading state is part of the
       design under review — so the prototype waits too. Long enough to read
       "Signing you in…", short enough not to be annoying. */
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = auth.signIn({
      email,
      password,
      remember: remember.hasAttribute('checked'),
      // ?simulate=network / ?simulate=server reach the two states no amount of
      // typing can produce.
      simulate: params.get('simulate') || '',
    });

    setBusy(false);
    inFlight = false;

    if (result.ok) {
      // replace(), not assign(): Back from the workspace should not land on a
      // login screen that appears to have failed.
      location.replace(HOME);
      return;
    }

    if (result.reason === auth.REASONS.PASSWORD_EXPIRED) {
      location.href = `reset-password.html?email=${encodeURIComponent(result.email)}&reason=expired`;
      return;
    }

    showMessage(result.reason, result);
    paintCaptcha();

    // Put the caret where the correction happens, and clear the password —
    // retyping it is faster than editing a wrong one.
    passwordField.value = '';
    passwordField.focus();
  });

  /* --- SSO ---------------------------------------------------------------------
     No provider is wired up in a prototype. Saying so is better than a button
     that silently does nothing. */
  document.querySelectorAll('[data-sso]').forEach((button) =>
    button.addEventListener('click', () => {
      banner({
        severity: 'info',
        heading: `${button.dataset.sso} sign-in is not connected in this prototype.`,
        body: 'Use the email and password form above to continue.',
      });
    })
  );

  /* --- Helpers ------------------------------------------------------------------ */

  function setBusy(busy) {
    submit.toggleAttribute('loading', busy);
  }

  function failField(field, message) {
    field.setAttribute('error', message);
    field.focus();
  }

  function clearFieldErrors() {
    emailField.removeAttribute('error');
    passwordField.removeAttribute('error');
  }

  function showMessage(reason, detail) {
    if (reason === auth.REASONS.CAPTCHA_REQUIRED) {
      return banner({
        severity: 'warning',
        heading: 'Confirm you are not a robot.',
        body: 'Tick the confirmation below, then sign in again.',
      });
    }
    banner((MESSAGES[reason] ?? MESSAGES[auth.REASONS.SERVER])(detail));
  }

  /*
   * A failure — or the one "we cannot do that here" — as a toast.
   *
   * It used to be a coloured slab laid into the card above the form. Two
   * things were wrong with that. It pushed the email field, the password
   * field and the button down the card by its own height, so the control
   * someone had just aimed at moved as they were told why their attempt
   * failed; and it was the last place in the EHR still answering an action in
   * the page rather than over it. The words and their severity are unchanged.
   */
  function banner({ severity, heading, body }) {
    hideMessage();
    standing = notify(body, severity, { heading });
    // The specs reached for the old banner by name. The hook moves to the
    // toast that replaced it rather than the assertions being rewritten.
    standing.dataset.testid = 'login--error';
  }

  /* One message per attempt: the previous answer goes before the next one is
     raised, so a second wrong password does not leave two slabs of near-identical
     text stacked in the corner. */
  function hideMessage() {
    standing?.remove();
    standing = null;
  }

  /*
   * The challenge after repeated failures.
   *
   * A tickbox is a stand-in for a real provider widget, which cannot run in a
   * prototype with no server to verify against. What is being designed here is
   * WHEN it appears and what it does to the form — not the challenge itself.
   */
  function paintCaptcha() {
    const email = emailField.value.trim();
    const needed = email && auth.captchaRequired(email);
    captchaSlot.hidden = !needed;
    if (!needed) {
      captchaSlot.innerHTML = '';
      return;
    }
    if (captchaSlot.querySelector('[data-testid="login--captcha"]')) return;
    captchaSlot.innerHTML = `<ui-checkbox data-testid="login--captcha">
      I am not a robot
    </ui-checkbox>`;
  }

  function captchaSolved() {
    const box = captchaSlot.querySelector('[data-testid="login--captcha"]');
    return !box || box.hasAttribute('checked');
  }
});
