/**
 * Forgot password.
 *
 * One rule governs this whole screen: the answer is the same whether or not
 * the address is on file. A form that says "no account with that email" is an
 * address checker, and for a clinic the list it checks is a list of patients.
 * So a well-formed address always gets the confirmation below, and only a
 * malformed one is rejected — because that is a typo, not a disclosure.
 */

import { installIconSprite } from '../lib/icons.js';
import * as auth from '../lib/auth-store.js';
import { esc } from '../lib/format.js';

document.addEventListener('DOMContentLoaded', () => {
  installIconSprite();

  const form = document.getElementById('resetForm');
  const field = document.getElementById('email');
  const fieldError = document.getElementById('emailError');
  const slot = document.getElementById('authError');
  const submit = form.querySelector('[data-testid="forgot--submit"]');

  field.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = field.value.trim();
    field.removeAttribute('aria-invalid');
    fieldError.hidden = true;

    if (!auth.isEmailShaped(email)) {
      field.setAttribute('aria-invalid', 'true');
      fieldError.textContent = 'Enter a valid email address.';
      fieldError.hidden = false;
      field.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    await new Promise((resolve) => setTimeout(resolve, 600));
    auth.requestReset(email);
    submit.disabled = false;
    submit.textContent = 'Send reset link';

    slot.hidden = false;
    slot.className = 'pp-auth__error pp-alert pp-alert--info';
    slot.setAttribute('role', 'status');
    slot.dataset.testid = 'forgot--sent';
    slot.innerHTML = `<div>
      <p class="pp-alert__heading">Check your email.</p>
      <p class="pp-alert__body">If <strong>${esc(email)}</strong> is on an account,
      a reset link is on its way. It expires in 30 minutes.</p>
    </div>`;

    form.reset();
  });
});
