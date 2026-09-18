/**
 * notify() — one floating notification, bottom-right.
 *
 * Two screens had grown their own copy of this: the same six lines, the same
 * six-second timeout, the same fixed-position host, differing only in the class
 * name on the wrapper (.comm__toast, .ref__toast). Neither knew about the
 * other, so a change to how the product reports "that worked" had to be made
 * twice and was made once.
 *
 * It now builds a <ui-toast>, which is the component for this: a card that
 * REPORTS on something already finished. <ui-alert> — what the copies used —
 * is the inline banner for a condition that persists, and it was being made to
 * float by a wrapper that positioned it. An alert about an allergy belongs in
 * the page next to the prescription; "Download started" belongs over the corner
 * of the window and then gone.
 *
 * Every toast lands in one shared region rather than a fresh fixed-position
 * div each time, so two notifications in quick succession stack instead of
 * printing on top of each other.
 *
 *   import { notify } from '../lib/toast.js';
 *   notify('Referral sent to Mercy General.');
 *   notify('Choose a document type first.', 'warning');
 *
 * @param {string} message
 * @param {'success'|'warning'|'critical'|'info'|'brand'|'neutral'} [variant='success']
 * @param {{ heading?: string, duration?: number }} [options]
 * @returns {HTMLElement} the toast, so a caller can dismiss it early
 */

const REGION_ID = 'ui-toast-region';

/*
 * Politeness per variant.
 *
 * A confirmation reports something the reader did on purpose, and cutting
 * into the sentence they are hearing to say "saved" is ruder than waiting for
 * a gap. A warning or a failure is the opposite: the thing they asked for did
 * NOT happen, and learning that at the end of the paragraph is too late.
 *
 * Politeness is a property of the REGION, not of the message, which is why
 * there are two of them below rather than an attribute on the toast.
 */
const LIVE = { warning: 'assertive', critical: 'assertive' };

/* `info` is what the two copies passed for "nothing went wrong, this is just
   worth saying". ui-toast calls that tone `brand`. Mapped here rather than at
   fourteen call sites. */
const VARIANT_ALIAS = { info: 'brand' };

function region(variant) {
  let host = document.getElementById(REGION_ID);

  if (!host) {
    host = document.createElement('div');
    host.id = REGION_ID;
    host.className = 'ui-toast-region';
    /* The regions are the live regions, not each toast: announcing the
       CONTAINER means a second toast is read as an addition rather than as a
       whole new region appearing, which is what screen readers do with a fresh
       role=status node per message.

       Both are display:contents, so the pair still lays out as the one column
       the stylesheet draws. */
    host.innerHTML = `
      <div class="ui-toast-region__live" data-live="polite" role="status" aria-live="polite"></div>
      <div class="ui-toast-region__live" data-live="assertive" role="alert" aria-live="assertive"></div>`;
    document.body.append(host);
  }

  return host.querySelector(`[data-live="${LIVE[variant] ?? 'polite'}"]`);
}

export function notify(message, variant = 'success', options = {}) {
  const { heading, duration = 6000 } = options;
  const kind = VARIANT_ALIAS[variant] ?? variant;

  const toast = document.createElement('ui-toast');
  toast.setAttribute('variant', kind);
  toast.setAttribute('dismissible', '');
  if (heading) toast.setAttribute('heading', heading);
  toast.textContent = message;

  region(kind).append(toast);

  /* A toast that is dismissed by hand must not also be removed by the timer —
     the element is already gone, and remove() on a detached node is harmless,
     but the timer is not worth keeping alive either. */
  const timer = window.setTimeout(() => toast.remove(), duration);
  toast.addEventListener('ui-close', () => window.clearTimeout(timer));

  return toast;
}
