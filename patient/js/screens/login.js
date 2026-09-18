/**
 * Patient sign-in.
 *
 * The screen's whole job is to get someone to their Home page, or to tell
 * them plainly why it cannot. Every failure below names the thing that went
 * wrong and what to do next — "contact the practice" is an instruction,
 * "authentication failed" is not.
 *
 * The authentication itself is SIMULATED. See lib/auth-store.js.
 */

import { installIconSprite } from '../lib/icons.js';
import * as auth from '../lib/auth-store.js';
import { toast, toastError } from '../lib/toast.js';

/** Where a successful sign-in goes. */
const HOME = 'home.html';

/*
 * One entry per failure the screen can show.
 *
 * tone     which toast the message arrives in — see lib/toast.js
 * heading  what happened
 * body     what to do about it — never blank
 *
 * These used to be painted into a slab above the form. They are now toasts in
 * the top-right corner like every other reply in the portal: a rejected
 * sign-in is the same class of event as a rejected card number, and it was
 * odd that the two looked nothing alike.
 */
const MESSAGES = {
  [auth.REASONS.BAD_CREDENTIALS]: (detail) => ({
    tone: 'error',
    heading: 'Your email or password is incorrect.',
    body:
      detail.remaining <= 2
        ? `Check both and try again. ${detail.remaining} attempt${
            detail.remaining === 1 ? '' : 's'
          } remaining before this account is locked.`
        : 'Check both and try again.',
  }),

  [auth.REASONS.LOCKED]: (detail) => ({
    tone: 'error',
    heading: 'Your account has been locked after several unsuccessful attempts.',
    body: `For security, sign-in is paused for ${detail.minutes} minute${
      detail.minutes === 1 ? '' : 's'
    }. Call the practice on (808) 555-0100 if you need access sooner.`,
  }),

  [auth.REASONS.INACTIVE]: () => ({
    tone: 'warn',
    heading: 'Portal access for this account has been turned off.',
    body:
      'Your records are unaffected. Call the practice on (808) 555-0100 to have online access restored.',
  }),

  [auth.REASONS.SESSION_EXPIRED]: () => ({
    tone: 'info',
    heading: 'You were signed out after a period of inactivity.',
    body: 'Sign in again to return to your portal. Nothing you saved was lost.',
  }),

  [auth.REASONS.NETWORK]: () => ({
    tone: 'warn',
    heading: "We can't reach the server.",
    body: 'Check your internet connection and try again.',
  }),

  [auth.REASONS.SERVER]: () => ({
    tone: 'error',
    heading: 'Something went wrong at our end.',
    body: 'This is not a problem with your account. Try again in a few minutes.',
  }),
};

/* ============================================================================
   THE PROMO CAROUSEL

   Four captions. The panel itself is decorative and aria-hidden (see
   login.html) — this only drives what is painted.
   ========================================================================= */

const SLIDES = [
  {
    title: 'Connected Care. Anywhere.',
    body:
      'Secure access to patient records and real-time collaboration across ' +
      'hospitals, ICUs, and outreach programs.',
  },
  {
    title: 'Your Health, One Place.',
    body:
      'Appointments, medications, results and messages from your care team, ' +
      'together in a single secure portal.',
  },
  {
    title: 'Never Miss a Visit.',
    body:
      'Book, reschedule or join a virtual appointment in a few taps, and ' +
      'complete your intake form before you arrive.',
  },
  {
    title: 'Clear, Simple Billing.',
    body:
      'See what you owe, pay a statement online, and keep your insurance ' +
      'details up to date.',
  },
];

const SLIDE_MS = 6000;

function startCarousel() {
  const promo = document.getElementById('promo');
  const title = document.getElementById('promoTitle');
  const body = document.getElementById('promoBody');
  const dots = document.getElementById('promoDots');
  const panels = [...promo.querySelectorAll('.pp-auth__slide')];
  if (!panels.length) return;

  dots.innerHTML = SLIDES.map(
    (slide, index) =>
      `<button type="button" class="pp-auth__dot" data-slide="${index}"
        tabindex="-1" aria-current="${index === 0}"></button>`
  ).join('');

  let current = 0;
  let timer = 0;

  function show(index) {
    current = (index + SLIDES.length) % SLIDES.length;
    panels.forEach((panel, i) => {
      panel.dataset.current = String(i === current);
    });
    dots.querySelectorAll('.pp-auth__dot').forEach((dot, i) => {
      dot.setAttribute('aria-current', String(i === current));
    });
    title.textContent = SLIDES[current].title;
    body.textContent = SLIDES[current].body;
  }

  /*
   * Advancing on a timer is a motion preference, not a decoration one.
   *
   * Someone who has asked their OS to reduce motion has asked not to have
   * things move on their own — so the carousel stops advancing entirely
   * rather than cross-fading faster. The dots still work, so all four slides
   * stay reachable by choice.
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

/* ============================================================================
   THE FORM
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  installIconSprite();
  startCarousel();

  const form = document.getElementById('loginForm');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const remember = document.getElementById('remember');
  const submit = form.querySelector('[data-testid="login--submit"]');
  const reveal = document.getElementById('revealPassword');
  const caps = document.getElementById('capsWarning');
  const captchaSlot = document.getElementById('captchaSlot');

  const params = new URLSearchParams(location.search);

  /* A device that ticked "Remember me" gets its address back, never its
     password. It saves a typed line; it is not a credential. */
  const known = auth.rememberedEmail();
  if (known) {
    emailField.value = known;
    remember.checked = true;
  }

  if (params.get('reason') === auth.REASONS.SESSION_EXPIRED) {
    showMessage(auth.REASONS.SESSION_EXPIRED, {});
  }

  (known ? passwordField : emailField).focus();
  paintCaptcha();

  /* --- Reveal --------------------------------------------------------------- */
  reveal.addEventListener('click', () => {
    const shown = passwordField.type === 'text';
    passwordField.type = shown ? 'password' : 'text';
    reveal.setAttribute('aria-pressed', String(!shown));
    reveal.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    reveal.querySelector('use').setAttribute('href', shown ? '#pi-eye' : '#pi-eye-off');
    // Keep the caret where it was; toggling `type` sends it to the end in
    // some browsers, which loses someone's place mid-correction.
    const end = passwordField.value.length;
    passwordField.focus();
    passwordField.setSelectionRange(end, end);
  });

  /* --- Caps Lock -------------------------------------------------------------
     Read from the key event rather than tracked as state: the key can be
     toggled while the window is in the background, and any state we kept
     would then be wrong at exactly the wrong moment. */
  const probeCaps = (event) => {
    if (typeof event.getModifierState !== 'function') return;
    caps.hidden = !event.getModifierState('CapsLock');
  };
  passwordField.addEventListener('keydown', probeCaps, true);
  passwordField.addEventListener('keyup', probeCaps, true);
  passwordField.addEventListener('focusout', () => {
    caps.hidden = true;
  });

  /* --- Submit -----------------------------------------------------------------
   *
   * One attempt at a time.
   *
   * The button is disabled while signing in, but "disabled" is a paint, and
   * an Enter-key repeat or a fast double click can still deliver a second
   * submit in the window before it lands. Two handlers in flight both call
   * signIn(), so a single mistyped password gets counted TWICE against the
   * account — and five attempts is a lockout. This guard is what makes the
   * count trustworthy; the disabled attribute only makes it look that way.
   */
  let inFlight = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (inFlight) return;

    let email = emailField.value.trim();
    let password = passwordField.value;

    clearFieldErrors();

    /*
     * An empty form signs the reviewer straight in.
     *
     * This is a prototype whose point is the eleven screens behind this one,
     * and a sign-in nobody can get past is a door with no handle. Pressing
     * Log In with nothing typed enters as the demo patient.
     *
     * Scoped to a COMPLETELY empty form. Type anything and the real
     * behaviour applies in full — which is what keeps the states this screen
     * has to handle (withdrawn access, wrong password, lockout, captcha)
     * reachable and worth reviewing.
     */
    if (!email && !password) {
      ({ email, password } = auth.DEMO_ACCOUNT);
    }

    if (!email) return failField(emailField, 'Enter your email address.');
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
       design under review — so the prototype waits too. Long enough to read,
       short enough not to be annoying. */
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = auth.signIn({
      email,
      password,
      remember: remember.checked,
      // ?simulate=network / ?simulate=server reach the two states no amount
      // of typing can produce.
      simulate: params.get('simulate') || '',
    });

    setBusy(false);
    inFlight = false;

    if (result.ok) {
      // replace(), not assign(): Back from Home should not land on a login
      // screen that appears to have failed.
      location.replace(HOME);
      return;
    }

    showMessage(result.reason, result);
    paintCaptcha();

    // Put the caret where the correction happens, and clear the password —
    // retyping it is faster than editing a wrong one.
    passwordField.value = '';
    passwordField.focus();
  });

  /* --- Helpers ------------------------------------------------------------- */

  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? 'Signing you in…' : 'Log In';
  }

  /*
   * A field the form will not accept.
   *
   * The words go to a toast; the red ring and the caret stay on the control.
   * A toast on its own could not say WHICH of the two fields it meant, and a
   * ring on its own could not say why — the pair does the job the line of
   * text under the input used to do alone.
   */
  function failField(field, message) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    toastError(message);
  }

  function clearFieldErrors() {
    [emailField, passwordField].forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function showMessage(reason, detail) {
    if (reason === auth.REASONS.CAPTCHA_REQUIRED) {
      return say({
        tone: 'warn',
        heading: 'Confirm you are not a robot.',
        body: 'Tick the confirmation below, then sign in again.',
      });
    }
    say((MESSAGES[reason] ?? MESSAGES[auth.REASONS.SERVER])(detail));
  }

  function say({ tone, heading, body }) {
    const item = toast({ heading, body }, tone);
    // The specs reached for the old banner by name. Keep the hook on the
    // toast that replaced it, so they still have something to assert on.
    item.dataset.testid = 'login--error';
    return item;
  }

  /*
   * The challenge after repeated failures.
   *
   * A tickbox stands in for a real provider widget, which cannot run in a
   * prototype with no server to verify against. What is being designed here
   * is WHEN it appears and what it does to the form — not the challenge.
   */
  function paintCaptcha() {
    const email = emailField.value.trim();
    const needed = Boolean(email) && auth.captchaRequired(email);
    captchaSlot.hidden = !needed;
    if (!needed) {
      captchaSlot.innerHTML = '';
      return;
    }
    if (captchaSlot.querySelector('[data-testid="login--captcha"]')) return;
    captchaSlot.innerHTML = `<label class="pp-check">
      <input type="checkbox" data-testid="login--captcha" />
      <span>I am not a robot</span>
    </label>`;
  }

  function captchaSolved() {
    const box = captchaSlot.querySelector('[data-testid="login--captcha"]');
    return !box || box.checked;
  }
});
