/**
 * Reset password — step 2 of the reset flow, and the forced change when a
 * password has expired.
 *
 * The requirements are shown as a live checklist rather than as an error after
 * submitting. Someone typing a password is composing it; telling them the rules
 * afterwards makes them start again.
 *
 * SIMULATED — see lib/auth-store.js.
 */
import * as auth from '../lib/auth-store.js';
import { iconMarkup } from '../lib/icons.js';

const STRENGTH = [
  { min: 0, label: 'Enter a password', tone: '' },
  { min: 1, label: 'Weak password', tone: 'weak' },
  { min: 3, label: 'Fair password', tone: 'fair' },
  { min: 5, label: 'Strong password', tone: 'strong' },
];

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetForm');
  const passwordField = document.getElementById('password');
  const confirmField = document.getElementById('confirm');
  const submit = document.querySelector('[data-testid="reset--submit"]');
  const meter = document.getElementById('meter');
  const label = document.getElementById('strengthLabel');
  const rules = document.getElementById('rules');
  const resetCard = document.getElementById('resetCard');
  const doneCard = document.getElementById('doneCard');
  const notice = document.getElementById('resetNotice');
  const subtitle = document.getElementById('resetSubtitle');

  const params = new URLSearchParams(location.search);
  const email = params.get('email') || '';

  /* Arriving because the password expired, rather than from a reset email —
     same form, different reason, so the screen says which. */
  if (params.get('reason') === 'expired') {
    subtitle.textContent = 'Your password has expired. Choose a new one to continue.';
    notice.hidden = false;
    notice.innerHTML = `<ui-alert severity="warning"
      heading="Passwords are changed every 90 days.">Your new password cannot repeat
      your previous one.</ui-alert>`;
  }

  paintStrength('');
  passwordField.focus();

  // Live on every keystroke — that is the point of a strength meter.
  passwordField.addEventListener('ui-input', (event) => paintStrength(event.detail.value));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = passwordField.value;
    const confirmation = confirmField.value;

    passwordField.removeAttribute('error');
    confirmField.removeAttribute('error');

    if (auth.passwordScore(password) < auth.PASSWORD_RULES.length) {
      passwordField.setAttribute('error', 'Your password does not meet all the requirements yet.');
      passwordField.focus();
      // The attribute change re-rendered the field, so the live checklist has
      // to be redrawn against the value it still holds.
      paintStrength(password);
      return;
    }

    if (password !== confirmation) {
      confirmField.setAttribute('error', 'Both passwords must match.');
      confirmField.focus();
      return;
    }

    submit.setAttribute('loading', '');
    submit.textContent = 'Updating…';
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = auth.completeReset({ email, password });

    submit.removeAttribute('loading');
    submit.textContent = 'Reset Password';

    if (!result.ok) {
      passwordField.setAttribute('error', 'That password cannot be used. Choose another.');
      paintStrength(password);
      return;
    }

    resetCard.hidden = true;
    doneCard.hidden = false;
    doneCard.querySelector('.auth__title').setAttribute('tabindex', '-1');
    doneCard.querySelector('.auth__title').focus();
  });

  document
    .querySelector('[data-testid="reset--to-login"]')
    ?.addEventListener('ui-click', () => {
      location.href = 'login.html';
    });

  /* --- The meter ---------------------------------------------------------------
     Three signals for one fact: how many segments are filled, what the label
     says, and which rules are ticked. Colour is never on its own. */
  function paintStrength(value) {
    const checks = auth.passwordChecks(value);
    const score = checks.filter((check) => check.met).length;

    const band = [...STRENGTH].reverse().find((entry) => score >= entry.min) ?? STRENGTH[0];

    meter.querySelectorAll('.auth__meter-seg').forEach((seg, index) => {
      seg.className = `auth__meter-seg${
        index < score && band.tone ? ` auth__meter-seg--${band.tone}` : ''
      }`;
    });

    label.textContent = value ? band.label : '';

    rules.innerHTML = checks
      .map(
        (check) =>
          `<li class="auth__rule${check.met ? ' auth__rule--met' : ''}">
            ${iconMarkup(check.met ? 'check' : 'minus')}
            <span>${check.label}</span>
          </li>`
      )
      .join('');
  }
});
