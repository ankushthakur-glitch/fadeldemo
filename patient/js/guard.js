/*
 * SESSION GUARD — a CLASSIC script, deliberately not type="module".
 *
 * Loaded in the <head> of every signed-in page, ahead of the module scripts.
 * That position is the whole point: a classic script in the head runs while
 * the document is still being parsed, so a signed-out visitor is redirected
 * BEFORE the browser paints a single row of somebody's medical record.
 *
 * lib/auth-store.js runs the same check again once modules load, and it is
 * the authority on what a session is. This file is a paint-blocking fast path
 * and nothing more, which is why it re-states the storage key instead of
 * importing it — a module import here would defer it past first paint and
 * defeat the only reason it exists.
 *
 * Keep the key in step with auth-store.js. It is checked by
 * tests/specs/patient-portal.spec.js so a rename cannot pass silently.
 */
(function () {
  var KEY = 'medinova.patient.auth.v1';

  // On file:// nothing works anyway and open-me-properly.js is about to say
  // so. Redirecting on top of that message would hide it.
  if (window.location.protocol === 'file:') return;

  var session = null;
  try {
    var state = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    session = state && state.session;
  } catch (error) {
    session = null;
  }

  if (session && session.expiresAt > Date.now()) return;

  // replace(), not assign(): pressing Back from the login page should not
  // land on a protected page that will only bounce again.
  window.location.replace('login.html?reason=session-expired');
})();
