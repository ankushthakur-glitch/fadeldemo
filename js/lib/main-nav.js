/**
 * The main navigation, in one place.
 *
 * The nav was copied into all thirty-odd screen files, which is survivable
 * while it is a static list of links but not once anything about it is
 * derived — and it stopped being survivable the day a section was added and
 * eleven screens got it. This list is the only one now: every screen reaches
 * it through <ui-main-nav> (js/components/ui-main-nav.js), which is the tag
 * the markup asks for. Nothing renders the bar's tabs from anywhere else.
 */

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
  // Leads comes second, right after the day's overview: an inbox belongs where
  // it is seen on the way in rather than three sections along where it has to
  // be remembered.
  { id: 'leads', label: 'Leads', href: 'leads.html' },
  // Then the two sections a front desk lives in, people before their
  // appointments: you look somebody up and then look at their day, far more
  // often than you open a day and go hunting for a name in it.
  { id: 'patient', label: 'Patients', href: 'patient-directory.html' },
  { id: 'schedule', label: 'Schedule', href: 'scheduler.html' },
  // "Tasks", not "Task Management" — the longer label bought nothing and cost
  // the width of two other sections in a bar that already overflows at 1280.
  { id: 'tasks', label: 'Tasks', href: 'tasks.html' },
  // Complications is a top-level section rather than a tab inside Reports
  // because it is WRITTEN to — somebody records a perforation the afternoon it
  // happens — and a section you only ever write to from three clicks inside a
  // reporting screen is a section that gets written to late or not at all.
  { id: 'complications', label: 'Complications', href: 'complications.html' },
  // What is on the shelf. It sat under Settings, which is where you go to
  // configure the practice — but stock is not configuration, it is work: a
  // nurse checks it before a clinic list and a coordinator reorders from it.
  // Burying that two clicks inside Settings made a daily job feel like an
  // administrative one. Medication is the only kind of stock today; a second
  // (equipment, consumables) turns this into a hub, not a second tab.
  { id: 'inventory', label: 'Inventory', href: 'medication-inventory.html' },
  // Communications and Referrals sit together because they are the same act
  // seen from two sides — a message out to a patient, a case in from another
  // practice — and whoever works one usually works the other in the same hour.
  { id: 'communications', label: 'Communications', href: 'communications.html' },
  { id: 'referrals', label: 'Referrals', href: 'referrals.html' },
  { id: 'billing', label: 'Billing', href: 'billing.html' },
  { id: 'reports', label: 'Reports', href: 'reports.html' },
  // The audit log is NOT here. It lives under Settings, reached from the hub:
  // it is opened when something is being investigated, not as part of the
  // day's work, and a top-level tab put it in front of everyone all day for
  // the sake of the few times a year anyone reads it.
  { id: 'settings', label: 'Settings', href: 'settings.html' },
];

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Paint the nav into `host`, marking `activeId` as the current section. */
export function renderMainNav(host, activeId) {
  if (!host) return;

  host.innerHTML = ITEMS.map((item) => {
    const active = item.id === activeId;
    return `<a href="${esc(item.href)}"
      class="pt__nav-item${active ? ' pt__nav-item--active' : ''}"
      ${active ? 'aria-current="page"' : ''}
      data-testid="nav--${esc(item.id)}">${esc(item.label)}</a>`;
  }).join('');

  /*
   * Bring the current section into view.
   *
   * The bar holds twelve sections now and scrolls sideways once they stop
   * fitting — which hides whichever ones are last. Landing on a screen whose
   * own tab is off the right edge reads as "this page is not in the nav at
   * all". `inline: 'nearest'` scrolls the strip and nothing else; `block:
   * 'nearest'` keeps it from scrolling the page underneath.
   *
   * TWICE, and the second time is the one that works. Inter arrives over the
   * network; on first paint the bar is measured in the fallback face, which
   * is narrower, so it often does not overflow yet and there is nothing to
   * scroll. The swap then widens every label at once and pushes the last
   * sections out — after the only scroll we had made. Re-running once the
   * fonts have settled is what actually reveals the active tab at 1280.
   *
   * This is still a mitigation, not a fix. The real answer is fewer top-level
   * sections or shorter labels.
   */
  const reveal = () =>
    host.querySelector('.pt__nav-item--active')?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
    });

  reveal();
  document.fonts?.ready.then(reveal);
}
