/*
 * A CLASSIC script — deliberately not type="module".
 *
 * Module scripts are blocked when a page is opened straight off the disk
 * (file://), which is exactly the situation this file exists to explain.
 * A classic script still runs there, so this is the one piece of JavaScript
 * that survives to put a message on screen.
 *
 * Over http:// it does nothing at all.
 */
(function () {
  if (window.location.protocol !== 'file:') return;

  /*
   * WHICH LAUNCHER TO NAME.
   *
   * There are two, because a double-clickable file is per-platform: a .cmd
   * batch file on Windows, a .command shell script on macOS and Linux. Naming
   * the wrong one turns this warning into a dead end — the reader goes to the
   * folder, finds a file their machine will not run, and is no better off than
   * before the warning appeared. Windows is the odd one out in `platform`, so
   * it is the one tested for.
   */
  function launcher() {
    var p = (navigator.platform || navigator.userAgent || '').toLowerCase();
    return p.indexOf('win') === 0 || p.indexOf('windows') !== -1
      ? 'Open Prototype.cmd'
      : 'Open Prototype.command';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.className = 'file-warning';
    panel.innerHTML =
      '<div class="file-warning__card">' +
      '<h1 class="file-warning__title">This page needs the local server</h1>' +
      '<p>You have opened the file directly from disk. Browsers refuse to load' +
      ' ES modules from a <code>file://</code> page, so none of the components' +
      ' — tables, tabs, search — can start. Everything you can see right now is' +
      ' plain HTML.</p>' +
      '<p class="file-warning__do"><strong>Double-click <code>' + launcher() + '</code></strong>' +
      ' in the project folder, then use the link it opens.</p>' +
      '<p class="file-warning__urls">The address bar should read' +
      ' <code>http://127.0.0.1:4173/…</code> — not <code>file:///…</code></p>' +
      '</div>';
    document.body.appendChild(panel);

    var style = document.createElement('style');
    // Self-contained: tokens.css may not have loaded either.
    style.textContent =
      '.file-warning{position:fixed;inset:0;z-index:99999;display:flex;' +
      'align-items:center;justify-content:center;padding:24px;' +
      'background:rgba(19,18,16,.55);font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif}' +
      '.file-warning__card{max-width:34rem;background:#fff;border-radius:8px;' +
      'padding:28px 32px;box-shadow:0 12px 24px rgba(16,24,40,.18);' +
      'font-size:14px;line-height:1.5;color:#37332f}' +
      '.file-warning__title{font-size:20px;margin:0 0 12px;color:#1e3a6e}' +
      '.file-warning p{margin:0 0 12px}' +
      '.file-warning__do{padding:12px;background:#e8eef8;border-radius:4px}' +
      '.file-warning__urls{font-size:12px;color:#6e655e;margin-bottom:0}' +
      '.file-warning code{background:#f3f2f1;padding:1px 5px;border-radius:3px;' +
      'font-family:inherit;font-size:.9em}';
    document.head.appendChild(style);
  });
})();
