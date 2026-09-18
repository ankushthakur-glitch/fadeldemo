/**
 * Forgot password — step 1 of the reset flow.
 *
 * Two states in one screen: ask for the address, then confirm it was sent.
 * They are two cards rather than two pages so the back-to-login link keeps
 * working and a refresh does not resend anything.
 *
 * SIMULATED — no email leaves the browser. See lib/auth-store.js.
 */
import * as auth from '../lib/auth-store.js';

/* Long enough that someone cannot sit on the button; short enough that a
   genuinely missing email is retryable while they are still looking for it. */
const RESEND_SECONDS = 30;

let cooldown = 0;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('requestForm');
  const emailField = document.getElementById('email');
  const submit = document.querySelector('[data-testid="forgot--submit"]');
  const requestCard = document.getElementById('requestCard');
  const sentCard = document.getElementById('sentCard');
  const resend = document.querySelector('[data-testid="forgot--resend"]');
  const toLogin = document.querySelector('[data-testid="forgot--to-login"]');
  const note = document.getElementById('resendNote');

  // Coming from the login screen with something already typed there.
  const prefill = new URLSearchParams(location.search).get('email');
  if (prefill) emailField.setAttribute('value', prefill);
  emailField.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailField.value.trim();

    emailField.removeAttribute('error');
    if (!email) {
      emailField.setAttribute('error', 'Enter your registered email address.');
      emailField.focus();
      return;
    }
    if (!auth.isEmailShaped(email)) {
      emailField.setAttribute('error', 'That does not look like an email address.');
      emailField.focus();
      return;
    }

    submit.setAttribute('loading', '');
    await new Promise((resolve) => setTimeout(resolve, 600));
    auth.requestReset(email);
    submit.removeAttribute('loading');

    requestCard.hidden = true;
    sentCard.hidden = false;
    // Focus moves to the new heading, or a screen reader is left on a button
    // that no longer exists.
    sentCard.querySelector('.auth__title').setAttribute('tabindex', '-1');
    sentCard.querySelector('.auth__title').focus();

    startResendCooldown();
  });

  toLogin?.addEventListener('ui-click', () => {
    location.href = 'login.html';
  });

  resend?.addEventListener('ui-click', () => {
    if (resend.hasAttribute('disabled')) return;
    auth.requestReset(emailField.value.trim());
    startResendCooldown();
  });

  /*
   * Rate limit on resending.
   *
   * The countdown is in the status line rather than in the button's own label:
   * a <ui-button> renders its text from the markup it was authored with, and
   * rewriting the tag's textContent would wipe the rendered <button> outright.
   * It also reads better — the button keeps saying what it does, and the line
   * underneath says why it is waiting.
   */
  function startResendCooldown() {
    clearInterval(cooldown);
    let left = RESEND_SECONDS;
    resend.setAttribute('disabled', '');
    note.textContent = `You can resend in ${left}s.`;

    cooldown = setInterval(() => {
      left -= 1;
      if (left > 0) {
        note.textContent = `You can resend in ${left}s.`;
        return;
      }
      clearInterval(cooldown);
      resend.removeAttribute('disabled');
      note.textContent = 'Did not arrive? Check your spam folder, or resend.';
    }, 1000);
  }
});
