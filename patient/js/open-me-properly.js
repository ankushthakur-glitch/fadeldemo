/*
 * A CLASSIC script — deliberately not type="module".
 *
 * Module scripts are blocked when a page is opened straight off the disk
 * (file://), which is exactly the situation this file exists to explain.
 * A classic script still runs there, so this is the one piece of JavaScript
 * that survives to put a message on screen.
 *
 * Over http:// it does nothing at all.
 *
 * The portal's own copy — its instructions name the portal's address, and it
 * is blue rather than the EHR's green so a reviewer can tell at a glance
 * which of the two products they have opened wrongly.
 */
(function () {
  if (window.location.protocol !== 'file:') return;

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.className = 'file-warning';
    panel.innerHTML =
      '<div class="file-warning__card">' +
      '<h1 class="file-warning__title">This page needs the local server</h1>' +
      '<p>You have opened the file directly from disk. Browsers refuse to load' +
      ' ES modules from a <code>file://</code> page, so the navigation, the' +
      ' sign-in and every screen behind it cannot start. Everything you can' +
      ' see right now is plain HTML.</p>' +
      '<p class="file-warning__do"><strong>Double-click <code>Open Prototype.cmd</code></strong>' +
      ' in the project folder, then add <code>/patient/</code> to the address.</p>' +
      '<p class="file-warning__urls">The address bar should read' +
      ' <code>http://127.0.0.1:4173/patient/</code> — not <code>file:///C:/…</code></p>' +
      '</div>';
    document.body.appendChild(panel);

    var style = document.createElement('style');
    // Self-contained: tokens.css may not have loaded either, so these are
    // the ramp's literal values rather than var() references. They are the
    // CURRENT ones — the panel was still drawn in the pre-rebrand blue and
    // in #6b7683, the secondary grey tokens.css rejected for failing AA.
    // If the ramp moves again, move these with it.
    style.textContent =
      '.file-warning{position:fixed;inset:0;z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:24px;' +
      'background:rgba(16,24,40,.55);font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif}' +
      '.file-warning__card{max-width:34rem;background:#fff;border-radius:8px;' +
      'padding:28px 32px;box-shadow:0 12px 24px rgba(16,24,40,.18);' +
      'font-size:14px;line-height:1.5;color:#455260}' +
      '.file-warning__title{font-size:20px;margin:0 0 12px;color:#273444}' +
      '.file-warning p{margin:0 0 12px}' +
      '.file-warning__do{padding:12px;background:#eaf0f9;border-radius:4px}' +
      '.file-warning__urls{font-size:12px;color:#606c78;margin-bottom:0}' +
      '.file-warning code{background:#f4f5f6;padding:1px 5px;border-radius:3px;' +
      'font-family:inherit;font-size:.9em}';
    document.head.appendChild(style);
  });
})();
