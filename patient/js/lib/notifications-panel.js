/**
 * THE NOTIFICATIONS PANEL — what opens under the bell.
 *
 * A DROPDOWN ANCHORED TO THE BELL, not a right-hand drawer. The portal
 * already has one thing that opens off the top bar — the account menu — and
 * it is a dropdown anchored to its trigger. A drawer would be a second
 * overlay pattern for a list of five short rows, and the account menu's
 * behaviour (outside click closes, Escape closes and returns focus,
 * aria-expanded on a real button) is exactly the behaviour this needs. So it
 * is built the same way, deliberately.
 *
 * EACH ROW IS A LINK, NOT A BUTTON. Pressing one navigates, and a thing that
 * navigates should be a link: middle-click and ⌘-click open it in a tab,
 * which is a reasonable thing to want from a notification. The read-marking
 * happens on the way out.
 */

import { esc } from './format.js';
import { icon } from './icons.js';
import { notifications, unreadCount, markRead, markAllRead } from '../../data/notifications.js';

/**
 * Build the panel and wire it to the bell.
 *
 * @param {HTMLElement} bell   the [data-notifications] button in the top bar
 * @param {HTMLElement} host   the element the panel is rendered into
 */
export function mountNotifications(bell, host) {
  if (!bell || !host) return;

  paint(host);

  const close = ({ restoreFocus = false } = {}) => {
    if (host.hidden) return;
    host.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    if (restoreFocus) bell.focus();
  };

  const open = () => {
    // Repainted on open rather than only on mount: another tab, or the
    // notifications page, may have marked things read since this one loaded.
    paint(host);
    host.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    host.querySelector('a, button')?.focus();
  };

  bell.setAttribute('aria-expanded', 'false');
  bell.setAttribute('aria-haspopup', 'true');

  bell.addEventListener('click', (event) => {
    // Stopped so the document listener below does not immediately close what
    // this click just opened — the same guard the account menu uses.
    event.stopPropagation();
    if (host.hidden) open();
    else close();
  });

  // Clicks inside the panel are the panel's business.
  host.addEventListener('click', (event) => event.stopPropagation());

  document.addEventListener('click', () => close());
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || host.hidden) return;
    close({ restoreFocus: true });
  });

  host.addEventListener('click', (event) => {
    const all = event.target.closest('[data-mark-all]');
    if (all) {
      markAllRead();
      paintBadge(bell);
      paint(host);
      host.querySelector('[data-notification]')?.focus();
      return;
    }

    const row = event.target.closest('[data-notification]');
    if (!row) return;

    /*
     * Marked read on the way out, and the navigation is NOT intercepted.
     *
     * The href does the travelling. Marking read first means the badge is
     * already correct when the target page paints its own top bar, so the
     * count does not flicker down a beat after arrival.
     */
    markRead(row.dataset.notification);
    paintBadge(bell);
  });

  paintBadge(bell);
}

/**
 * Redraw the bell's unread mark.
 *
 * It was a two-digit badge until the portal stopped stating counts on its
 * chrome; it is a dot now, and the only thing that changes is whether it is
 * there. At zero it is REMOVED rather than dimmed — a mark left on the bell
 * with nothing behind it reads as unread mail from across the room, which is
 * the exact signal the mark exists to give.
 *
 * The number has not been lost, only moved off the glyph: the button's
 * aria-label still says how many, so a screen reader hears the count while
 * the dot carries it visually.
 */
export function paintBadge(bell) {
  const count = unreadCount();
  const dot = bell.querySelector('.pp-topbar__dot');

  bell.setAttribute(
    'aria-label',
    count ? `Notifications, ${count} unread` : 'Notifications, none unread'
  );

  if (!count) {
    dot?.remove();
    return;
  }

  if (dot) return;

  const made = document.createElement('span');
  made.className = 'pp-topbar__dot';
  made.setAttribute('aria-hidden', 'true');
  bell.append(made);
}

/* ============================================================================
   THE PANEL
   ========================================================================= */

function paint(host) {
  const list = notifications();
  const unread = list.filter((entry) => entry.unread).length;

  host.innerHTML = `
    <div class="pp-notes__head">
      <h2 class="pp-notes__title">Notifications</h2>
      ${
        unread
          ? `<button type="button" class="pp-link pp-link--button" data-mark-all
               data-testid="notifications--mark-all">Mark all as read</button>`
          : '<span class="pp-notes__clear">All caught up</span>'
      }
    </div>

    <ul class="pp-notes__list" role="list">
      ${list.map(row).join('')}
    </ul>

    <div class="pp-notes__foot">
      <a class="pp-link" href="notifications.html" data-testid="notifications--view-all">
        View all notifications
      </a>
    </div>
  `;
}

function row(entry) {
  return `
    <li>
      <a class="pp-note${entry.unread ? ' pp-note--unread' : ''}"
        href="${esc(entry.href)}" data-notification="${esc(entry.id)}"
        data-testid="notifications--item">
        <span class="pp-note__mark" aria-hidden="true">${icon(entry.icon, { size: 'sm' })}</span>

        <span class="pp-note__body">
          <span class="pp-note__title">${esc(entry.title)}</span>
          <span class="pp-note__text">${esc(entry.body)}</span>
          <span class="pp-note__when">${esc(entry.when)}</span>
        </span>

        ${
          entry.unread
            ? `<span class="pp-note__dot" aria-hidden="true"></span>
               <span class="pp-sr-only">Unread</span>`
            : ''
        }
      </a>
    </li>`;
}
