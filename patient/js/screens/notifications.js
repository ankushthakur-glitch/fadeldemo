/**
 * NOTIFICATIONS — the full list.
 *
 * The bell's panel (lib/notifications-panel.js) is the summary; this is the
 * same data with room to breathe. Two differences, both because a page is not
 * a dropdown:
 *
 *   - The rows are GROUPED into Unread and Earlier. In a five-row panel that
 *     would be two headings over two rows; on a page it is the difference
 *     between a list you scan and a list you read.
 *   - Read state is visible per row rather than only as a dot, because on a
 *     page there is room to say it.
 *
 * The panel's own read-marking and badge repainting are reused rather than
 * reimplemented — paintBadge() is imported, so pressing a row here updates the
 * bell above it exactly as it does everywhere else.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { paintBadge } from '../lib/notifications-panel.js';
import { notifications, markRead, markAllRead } from '../../data/notifications.js';

let host;

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell()) return;

  host = document.getElementById('screen');
  paint();

  host.addEventListener('click', (event) => {
    if (event.target.closest('[data-mark-all]')) {
      markAllRead();
      refresh();
      toast('All notifications marked as read.', 'ok');
      return;
    }

    // Marked on the way out; the href does the travelling. See the note in
    // lib/notifications-panel.js.
    const row = event.target.closest('[data-notification]');
    if (row) {
      markRead(row.dataset.notification);
      refreshBadge();
    }
  });
});

/** Redraw the list and the bell together. */
function refresh() {
  paint();
  refreshBadge();
}

function refreshBadge() {
  const bell = document.querySelector('[data-notifications]');
  if (bell) paintBadge(bell);
}

/* ============================================================================
   RENDERING
   ========================================================================= */

function paint() {
  const all = notifications();
  const unread = all.filter((entry) => entry.unread);
  const earlier = all.filter((entry) => !entry.unread);

  host.innerHTML = `
    <div class="pp-actions pp-actions--split">
      <p class="pp-notifications__lead">
        ${
          unread.length
            ? `You have ${unread.length} unread ${
                unread.length === 1 ? 'notification' : 'notifications'
              }.`
            : 'Nothing unread. Everything below has been seen.'
        }
      </p>
      ${
        unread.length
          ? `<button type="button" class="pp-btn pp-btn--outline" data-mark-all
               data-testid="notifications--page-mark-all">Mark all as read</button>`
          : ''
      }
    </div>

    ${section('Unread', unread, 'Nothing unread.')}
    ${section('Earlier', earlier, 'Nothing yet.')}
  `;
}

function section(title, rows, emptyText) {
  return `
    <section class="pp-notifications__section">
      <div class="pp-section-head">
        <!-- The heading names the group and counts nothing. It carried the
             number in brackets — "Unread (2)" — which the list under it says
             again, in rows you can actually open. -->
        <h2 class="pp-section-title">${esc(title)}</h2>
      </div>
      ${
        rows.length
          ? `<ul class="pp-notifications__list" role="list">${rows.map(row).join('')}</ul>`
          : `<p class="pp-forms__clear">${icon('check', { size: 'sm' })}${esc(emptyText)}</p>`
      }
    </section>`;
}

function row(entry) {
  return `
    <li>
      <a class="pp-note pp-note--wide${entry.unread ? ' pp-note--unread' : ''}"
        href="${esc(entry.href)}" data-notification="${esc(entry.id)}"
        data-testid="notifications--page-item">
        <span class="pp-note__mark" aria-hidden="true">${icon(entry.icon, { size: 'sm' })}</span>

        <span class="pp-note__body">
          <span class="pp-note__title">${esc(entry.title)}</span>
          <span class="pp-note__text">${esc(entry.body)}</span>
          <span class="pp-note__when">${esc(entry.when)}</span>
        </span>

        ${
          entry.unread
            ? `<span class="pp-note__dot" aria-hidden="true"></span><span class="pp-sr-only">Unread</span>`
            : '<span class="pp-note__read">Read</span>'
        }
      </a>
    </li>`;
}
