/**
 * Transient messages — the portal's ONLY channel for them.
 *
 * WHY A PROTOTYPE NEEDS THIS
 *
 * A good third of the buttons in the supplied design end in a system that
 * does not exist here — a payment processor, a video bridge, a pharmacy
 * queue. The three ways to handle that are all worse than this one:
 *
 *   - Wire the button to nothing. It then reads as broken, and a reviewer
 *     spends their attention on a bug that is not there.
 *   - Disable it. That removes the button from the design under review.
 *   - alert(). Blocks the page, looks nothing like the product, and cannot
 *     be screenshotted in a test run.
 *
 * So the button stays live, does the visible part of its job, and says what
 * the real one would do next. Messages are phrased as OUTCOMES ("Refill
 * requested") where the prototype can honestly claim one, and as
 * DESCRIPTIONS ("This would open…") where it cannot.
 *
 * WHY EVERY MESSAGE COMES THROUGH HERE
 *
 * The portal used to answer in two voices. A save confirmed in a toast at the
 * bottom of the window; a rejected sign-in or a mistyped card printed a
 * coloured slab into the page itself, and a failed field printed a third
 * message under the input. Three treatments for one idea — "the system is
 * replying to what you just did" — means a patient has to learn where to look
 * three times, and on a long form the reply could land off-screen entirely.
 *
 * So all of it now arrives in one place: a floating stack pinned to the TOP
 * RIGHT of the window, over whatever is beneath it, in every screen of the
 * portal. Nothing about a reply is laid into the document any more.
 *
 * The one thing a toast cannot do is point. "Enter a valid email address" is
 * useless if three fields could be the one meant, so callers still mark the
 * offending control `aria-invalid` (which paints the red ring) and focus it.
 * The toast says WHAT is wrong; the ring says WHERE.
 *
 * Standing explanatory panels — the cancellation-fee notice, "this is a
 * summary, not your full medical record", "only the last four digits are
 * kept" — are NOT messages in this sense. They are page content that happens
 * to be in a coloured box, they must stay readable while the patient decides,
 * and they are not answering an action. Those keep using `.pp-alert`.
 */

const STACK_ID = 'pp-toasts';

/*
 * How long a message stays.
 *
 * A failure is read twice — once to learn there was one, once to work out
 * what to do — and it is usually read while the eye is somewhere else, on the
 * field that caused it. So the bad news gets half again as long as the good.
 */
const LIFETIME_MS = { info: 4000, ok: 4000, warn: 6000, error: 6000 };

/*
 * Politeness per tone.
 *
 * 'polite' for confirmations: they report something the person did on
 * purpose, and cutting into their current sentence to say so is ruder than
 * waiting for a gap. 'assertive' for failures: the form did NOT do what was
 * asked, and hearing that at the end of the paragraph is too late.
 */
const LIVE = { info: 'polite', ok: 'polite', warn: 'assertive', error: 'assertive' };

/** The glyph each tone carries, from the Phosphor sprite in lib/icons.js. */
const ICON = {
  info: 'info',
  ok: 'check',
  warn: 'alert-triangle',
  error: 'alert-triangle',
};

/**
 * The stack, and the two live regions inside it.
 *
 * Two, because politeness is a property of the REGION, not of the message —
 * a single region would have to be either polite (and swallow the urgency of
 * a failure) or assertive (and interrupt for every "Card added"). Both are
 * `display: contents`, so the pair lays out as one column.
 */
function stack(tone) {
  let host = document.getElementById(STACK_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = STACK_ID;
    host.className = 'pp-toasts';
    host.innerHTML = `
      <div class="pp-toasts__region" data-live="polite" role="status" aria-live="polite"></div>
      <div class="pp-toasts__region" data-live="assertive" role="alert" aria-live="assertive"></div>`;
    document.body.append(host);
  }
  return host.querySelector(`[data-live="${LIVE[tone] ?? 'polite'}"]`);
}

function icon(name) {
  return `<svg class="pp-toast__icon" aria-hidden="true"><use href="#pi-${name}"></use></svg>`;
}

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );
}

/**
 * Show a message.
 *
 * `message` is either a string, or `{ heading, body }` where the reply needs
 * a headline and an explanation — a rejected sign-in says what happened and
 * then what to do about it, and running the two together loses the second.
 *
 * `tone` is 'info' (default), 'ok', 'warn' or 'error'.
 *
 * Returns the element, mostly so a test can assert on it.
 */
export function toast(message, tone = 'info') {
  const kind = ICON[tone] ? tone : 'info';
  const { heading, body } = typeof message === 'string' ? { body: message } : message;

  const item = document.createElement('div');
  item.className = `pp-toast pp-toast--${kind}`;
  item.dataset.testid = 'toast';
  item.dataset.tone = kind;
  item.innerHTML = `
    ${icon(ICON[kind])}
    <div class="pp-toast__text">
      ${heading ? `<p class="pp-toast__heading">${esc(heading)}</p>` : ''}
      ${body ? `<p class="pp-toast__body">${esc(body)}</p>` : ''}
    </div>
    <button type="button" class="pp-toast__close" aria-label="Dismiss">
      <svg aria-hidden="true"><use href="#pi-close"></use></svg>
    </button>`;

  // Dismissable because a failure lingers for six seconds, and six seconds is
  // a long time to sit under a message you have already read and acted on.
  item.querySelector('.pp-toast__close').addEventListener('click', () => item.remove());

  stack(kind).append(item);

  // Removed on a timer rather than on transitionend: a page hidden in a
  // background tab may never fire the transition, and the toasts would then
  // pile up until the tab is looked at again.
  setTimeout(() => item.remove(), LIFETIME_MS[kind]);
  return item;
}

/** Shorthand for the failure path, which is most of what calls this now. */
export function toastError(message) {
  return toast(message, 'error');
}
