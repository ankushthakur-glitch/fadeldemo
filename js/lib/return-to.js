/**
 * WHERE TO GO BACK TO — the `?return=` hand-off between screens.
 *
 * The encounter screens (encounter.html, clinic-visit.html,
 * encounter-summary.html) are reached from more than one place: the
 * Scheduler's Encounters worklist, the Scheduler's day view, check-in, and a
 * patient chart's Visit Notes. They used to send everybody back to the
 * Scheduler whatever door they came in by, so a clinician who opened a note
 * from the chart, signed it, and pressed Cancel or Save landed on a worklist
 * they never asked for and had to find the patient again.
 *
 * So the opener says where it is: a link into an encounter screen carries
 * `return=<page>`, and every way out of that screen — the back arrow, Cancel,
 * Save, the navigation after Sign & Lock — goes there instead of to its own
 * default. A screen opened without one behaves exactly as it always did.
 *
 * ONLY A PAGE IN THIS FOLDER. The value comes from the address bar, and an
 * unchecked one is an open redirect: `return=https://elsewhere` would make a
 * GastroEMR link deliver a signed-in clinician to somebody else's site. A
 * return target here is always one of our own screens — `name.html`, an
 * optional query and an optional hash — and anything else is ignored in
 * favour of the screen's own default.
 */

const SAFE_TARGET = /^[a-z0-9-]+\.html(\?[^#\s]*)?(#[\w-]*)?$/i;

/** The page to go back to, or `fallback` when none was handed over. */
export function returnTo(fallback) {
  const target = new URLSearchParams(window.location.search).get('return');
  return target && SAFE_TARGET.test(target) ? target : fallback;
}

/**
 * `url` with a return address attached.
 *
 * With no `target`, the return address this page was itself given is passed
 * along — which is how encounter.html, redirecting a clinic visit on to
 * clinic-visit.html, keeps the chart that opened it as the place to go back to.
 */
export function withReturn(url, target = returnTo(null)) {
  if (!target || !SAFE_TARGET.test(target)) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}return=${encodeURIComponent(target)}`;
}

/** Point a page's own back link at the return address, when there is one. */
export function applyReturnLink(link) {
  const target = returnTo(null);
  if (!link || !target) return;
  link.setAttribute('href', target);
  /* The arrow's accessible name says where it goes — "Back to the scheduler"
     on an arrow that now goes to the chart would send a screen-reader user
     somewhere other than where they were told. */
  if (link.hasAttribute('aria-label')) {
    link.setAttribute(
      'aria-label',
      target.startsWith('patient-chart.html') ? 'Back to the patient chart' : 'Back'
    );
  }
}
