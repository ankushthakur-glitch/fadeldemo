/**
 * THE ONE LINE THAT TURNS COMMENTING ON.
 *
 *   import '../lib/comments/index.js';
 *
 * That is the whole integration. The layer appends itself to <body>, brings
 * its own stylesheet, and adds nothing to any screen's markup — so removing
 * the feature when the review closes is deleting the two imports listed at
 * the bottom of this comment, not unpicking fifty HTML files.
 *
 * WHERE IT IS WIRED IN
 *   js/main.js                 — every screen in screens/, and gallery.html
 *   patient/js/comments.js     — every page in the patient portal
 *
 * WHEN IT DOES NOT MOUNT, and why each case matters:
 *
 *   Under Playwright. navigator.webdriver is true in an automated browser,
 *   and every visual-regression baseline in tests/screenshots/ was taken
 *   without a green button in the corner of the screen. Mounting under test
 *   would invalidate all of them at once, for a layer no test is about. A
 *   spec that wants to exercise commenting can ask for it explicitly with
 *   ?comments=on.
 *
 *   With ?comments=off in the address. The escape hatch for showing the
 *   prototype to someone who should not see the review furniture — a
 *   stakeholder demo, a screenshot for a deck. Sticky, because a demo is
 *   several clicks long and the flag would be lost on the first navigation.
 *
 *   On the print stylesheet's terms. Handled in CSS rather than here, so a
 *   printed encounter note carries no pins.
 */

import { CommentLayer } from './layer.js';

const STICKY_OFF = 'medinova.comments.off';

/** Turn the layer on or off for good, from the address bar. */
function preference() {
  const flag = new URLSearchParams(location.search).get('comments');
  if (flag === 'off' || flag === 'on') {
    try {
      if (flag === 'off') localStorage.setItem(STICKY_OFF, '1');
      else localStorage.removeItem(STICKY_OFF);
    } catch {
      /* A locked-down browser still honours the flag for this page, which is
         the case that matters — the demo about to be given. */
    }
    return flag;
  }
  try {
    return localStorage.getItem(STICKY_OFF) === '1' ? 'off' : 'auto';
  } catch {
    return 'auto';
  }
}

export function mountComments() {
  const choice = preference();
  if (choice === 'off') return null;
  if (choice !== 'on' && navigator.webdriver) return null;

  installStylesheet();

  const layer = new CommentLayer();
  const start = () => layer.mount();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return layer;
}

/**
 * The layer's CSS, fetched by the layer rather than linked by each page.
 *
 * Every other stylesheet in this prototype is a <link> in the page that needs
 * it, and that is right for a stylesheet a screen's markup depends on. This
 * one is different in kind: no page's markup uses these classes, and a
 * <link> in fifty-six files would be fifty-six chances to miss one — with the
 * failure showing up as an unstyled review tool on exactly the screen nobody
 * checked. Resolved against import.meta.url so it works from either product's
 * directory depth without either of them knowing the path.
 */
function installStylesheet() {
  const href = new URL('../../../css/components/comments.css', import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

mountComments();
