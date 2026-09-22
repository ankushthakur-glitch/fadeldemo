/**
 * THE APP SHELL — top bar and side navigation.
 *
 * Every signed-in screen calls mountShell() once and then renders its own
 * content into <div class="pp-content">. The nav is derived from the single
 * SECTIONS list below, so moving Billing above Documents, or renaming
 * "Education Material", is a one-line change rather than an edit to eleven
 * HTML files that will inevitably miss one.
 *
 * The frame markup lives in each page's HTML rather than being generated
 * here. That keeps the document structure readable in the file you open, and
 * means the page still has a sensible outline — header, nav, main — if the
 * modules fail to load.
 *
 * NO BREADCRUMBS. There was a grey trail strip under the top bar on every
 * screen but Home. It went, everywhere: the nav is two levels deep at most
 * and it already highlights where you are, so the trail restated the sidebar
 * in smaller type and cost 40px off the top of every content well.
 */

import { installIconSprite, icon } from './icons.js';
import { esc, initials } from './format.js';
import * as auth from './auth-store.js';
import { mountNotifications } from './notifications-panel.js';
import { unreadCount } from '../../data/notifications.js';

/* ============================================================================
   THE NAVIGATION

   Order and grouping are exactly as drawn in the supplied design.

   `href: null` marks a section the design names but does not specify. Those
   route to placeholder.html rather than nowhere — see the note there.

   Medications sits at the top level rather than under a Health Record group.
   The group had exactly one item worth naming, and a chevron you must open to
   reach a single child is a click that buys nothing. Reports is off the nav
   entirely; Home's "Latest Reports — More" link still opens it.

   NOTHING IS A GROUP ANY MORE. Every section that had children turned out to
   have one child worth naming: Billing's four screens became tabs, Settings
   held Profile plus a Notification Setting that was never drawn, and
   Education Material only ever led to placeholder.html. Each of those is a
   chevron you must open to reach a single destination, or a row advertising a
   section the portal does not have.

   renderGroup() below is kept even so. The nav is a data structure, and a
   sub-list is one line of data away — deleting the renderer would make
   re-adding a group a rewrite instead of an edit.
   ========================================================================= */

const SECTIONS = [
  //
  // Dashboard FIRST — Home until recently, in the label if not the address.
  //
  // "Home" names a position in the nav; "Dashboard" names what the screen is,
  // which is four cards summarising the sections under it. The file stays
  // home.html so no bookmark, link or test address breaks — see the redirect
  // at dashboard.html for the other half of that.
  //
  // It opens the nav because it is the landing screen: sign-in goes here, the
  // logo goes here, and every card on it is a way into a row further down the
  // column. The first row in the sidebar should be the one the portal already
  // put you on, so the highlight starts where you are rather than somewhere
  // you have not been.
  { id: 'home', label: 'Dashboard', icon: 'home', href: 'home.html' },
  //
  // Profile SECOND.
  //
  // It was last — under the reading that the record about you matters less
  // than the work waiting on you — and then briefly first. Second is the
  // honest place: a patient signing in to check what the practice holds — the
  // address it will post to, the policy it will bill, the number it will ring
  // — should not scroll past eight rows of errands to find it, but neither
  // does it belong above the screen they were just dropped on. Everything
  // below this line is something to DO; this is who you are, so it sits above
  // the doing and below the summary of it.
  { id: 'profile', label: 'Profile', icon: 'user', href: 'profile.html' },
  { id: 'appointment', label: 'Appointment', icon: 'calendar', href: 'appointment.html' },
  //
  // HEALTH RECORDS — one row for medications and allergies, where there were
  // two rows and, before the rename, two names on one screen.
  //
  // "Medications & Allergies" listed the screen's contents in the nav, which
  // is a label that has to grow every time the screen does — and it is
  // already two records with a third (immunisations, results) an obvious next
  // one. "Health Records" names what the section IS: the clinical record the
  // practice holds about the patient, as against Documents (things filed),
  // Forms (things owed) and Billing (money). The tabs inside still say
  // Medications and Allergies, so nothing is hidden by the shorter name.
  //
  // They were already adjacent on the reasoning that the two are read
  // together — what you take, and what you cannot be given. Adjacent was the
  // weaker version of that argument: they are not two subjects that belong
  // near each other, they are one subject, and every clinical form that asks
  // for either asks for both on the same page. They are two tabs of one
  // screen now, so moving between them costs a tab rather than a trip back to
  // the sidebar.
  //
  // 'pill' over 'clipboard-heart': the row leads with medications, and the
  // sprite already carries the glyph Home's Current Medication card uses, so
  // the same subject is drawn the same way in both places.
  {
    id: 'health-medications',
    label: 'Health Records',
    icon: 'pill',
    href: 'health-medications.html',
  },
  //
  // Forms above Documents, because the two are not the same errand.
  //
  // Forms and consents are work the practice is waiting on: an intake
  // questionnaire before a procedure, an authorisation to release records.
  // Documents are things already filed — a signed copy, a referral letter, a
  // result. Actionable first, so that is the order they sit in.
  //
  // ONE ROW, NOT TWO. Forms and consents are two tabs of one screen and not
  // two nav entries: they arrive together, they are chased together, and the
  // question a patient opens either one with — "what does the practice still
  // need from me" — has a single answer that spans them.
  //
  // NO COUNT ON IT. The row read "Forms  3 Pending". The nav is a list of
  // places, and a number on one has to be read before the word beside it
  // means anything; what is outstanding is the Pending view itself, which
  // names the forms, their due dates and the button that starts them.
  //
  // ONE WORD, TOO. The row read "Forms & Consents" — the only label in the
  // nav joining two nouns with an ampersand, the widest row in the column,
  // and the one that had to wrap first when the bar narrowed. The nav is a
  // column of short labels and "Forms" is the word a patient meets on the
  // appointment card and in the notification; the consents are a tab inside
  // the screen that this row does not have to spell out. The screen's own
  // title and Home's card still name both, because each of those has the
  // width for it and both list consents among what they show.
  {
    id: 'forms',
    label: 'Forms',
    icon: 'clipboard',
    href: 'forms.html',
  },
  { id: 'documents', label: 'Documents', icon: 'file', href: 'documents.html' },
  // Messages — Chat until now, in the nav, the title and the address alike.
  // The threads in it are days apart and carry lab figures and prep
  // instructions; nothing about that is a chat, and Home's card was already
  // headed Messages, so the portal was using two names for one screen.
  //
  // It sits at the top level. It was drawn inside a Communications group
  // alongside Emails, but Emails was never a screen — only a placeholder — so
  // the group wrapped a single real destination behind a chevron. Same reason
  // Medications is not under a Health Record group: a disclosure you must open
  // to reach one item costs a click and buys nothing.
  //
  // It carries no count either. The tag read "6 New" — itself a fix for an
  // earlier hard-coded "1 New" that disagreed with the fixtures — and Home's
  // Messages card said six as well: two statements of one fact on one screen,
  // neither of which could be acted on. The unread threads in the list are
  // the version you can.
  {
    id: 'messages',
    label: 'Messages',
    icon: 'chat',
    href: 'messages.html',
  },
  //
  // Billing is ONE nav entry, not a group.
  //
  // Its screens are siblings a patient moves between — pay a statement, check
  // it cleared in Payment History, fix the card that declined — and a dropdown
  // made every one of those moves a trip back to the sidebar: open the
  // chevron, find the item, click. They are tabs across the top of the Billing
  // screen now (see lib/billing-tabs.js), one click apart instead of three.
  //
  // Insurance used to be the fourth of them and is now a Profile tab: a policy
  // is a fact about the patient, not a way of paying a bill.
  //
  // Profile used to close the list. It sits second now, under Dashboard —
  // see the top of this array. It was Settings until recently, and a group of
  // two: the second
  // child, Notification Setting, was named in the design but never drawn, so
  // it only ever led to placeholder.html. That left a chevron over one real
  // screen. The row is named for what it holds instead, and Profile and
  // Insurance are its tabs (see lib/profile-tabs.js).
  //
  // placeholder.html still answers its old address — an old link should
  // explain itself rather than 404 — it is simply no longer advertised.
  { id: 'billing', label: 'Billing', icon: 'dollar', href: 'billing-statements.html' },
];

/**
 * Unread notifications behind the bell.
 *
 * The bell used to wear the number itself — "02", as the design draws it.
 * Nothing on this portal states a count on its chrome any more, and the bell
 * is the one place where the count was never the point: what it has to say
 * from across the room is "there is something here", which a dot says without
 * asking anybody to read a figure they cannot act on. The number is still
 * spoken, in the button's aria-label, and the panel behind the bell lists the
 * notifications themselves.
 */
const notificationCount = () => unreadCount();

/* ============================================================================
   MOUNT
   ========================================================================= */

/**
 * Paint the frame.
 *
 * @param {object}  options
 * @param {string}  options.active  id of the current section or sub-section
 * @returns {object} the signed-in session
 */
export function mountShell({ active } = {}) {
  installIconSprite();

  /*
   * The guard, for the second time.
   *
   * js/guard.js already did this synchronously in the head, which is what
   * stops a signed-out visitor seeing anything. This repeat covers the case
   * that one cannot: a session that expires while the tab sits open, where
   * the head script ran an hour ago against a session that was valid then.
   */
  const session = auth.touchSession();
  if (!session) {
    location.replace('login.html?reason=session-expired');
    return null;
  }

  renderTopbar(session);
  renderSideNav(active);

  return session;
}

/* ============================================================================
   TOP BAR
   ========================================================================= */

function renderTopbar(session) {
  const host = document.getElementById('topbar');
  if (!host) return;

  host.innerHTML = `
    <button type="button" class="pp-topbar__button pp-topbar__menu"
      data-menu-toggle aria-label="Show navigation" aria-expanded="false">
      ${icon('menu')}
    </button>

    <!--
      The practice's own mark, not a wordmark set in Inter. width/height are
      the file's intrinsic 335 × 68 so the browser reserves the right box
      before the SVG arrives — without them the whole tool cluster shifts
      sideways on first paint.

      The alt text IS the link's accessible name: "GastroEMR Clinic" reads
      better than "Home" for a logo that returns you to it, and a screen
      reader announces it as a link either way.
    -->
    <a class="pp-topbar__logo" href="home.html">
      <img src="assets/gastroemr-logo.svg" alt="GastroEMR Clinic" width="335" height="68" />
    </a>

    <div class="pp-topbar__tools">
      <!--
        THE BELL, and the panel that opens under it.
        Both live in .pp-notes__anchor so the panel can be positioned against
        the button rather than against the top bar — the tool cluster moves
        with the viewport width, and a panel pinned to the bar drifts away
        from the control that opened it.
      -->
      <div class="pp-notes__anchor">
        <button type="button" class="pp-topbar__button" data-notifications
          aria-label="Notifications, ${notificationCount()} unread"
          data-testid="topbar--notifications">
          ${icon('bell')}
          ${
            notificationCount()
              ? '<span class="pp-topbar__dot" aria-hidden="true"></span>'
              : ''
          }
        </button>

        <div class="pp-notes" data-notifications-panel hidden
          data-testid="notifications--panel"></div>
      </div>

      <div class="pp-account">
        <button type="button" class="pp-account__trigger" data-account-toggle
          aria-expanded="false" aria-haspopup="menu"
          aria-label="Account menu for ${esc(session.name)}"
          data-testid="topbar--account">
          <span class="pp-avatar" aria-hidden="true">${esc(initials(session.name))}</span>
        </button>

        <div class="pp-account__menu" role="menu" hidden data-account-menu>
          <div class="pp-account__who">
            <div class="pp-account__name">${esc(session.name)}</div>
            <div class="pp-account__email">${esc(session.email)}</div>
          </div>
          <a class="pp-account__item" role="menuitem" href="profile.html">
            ${icon('user', { size: 'sm' })}<span>Profile</span>
          </a>
          <button type="button" class="pp-account__item" role="menuitem"
            data-sign-out data-testid="topbar--sign-out">
            ${icon('log-out', { size: 'sm' })}<span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  `;

  wireTopbar(host);
}

function wireTopbar(host) {
  const trigger = host.querySelector('[data-account-toggle]');
  const menu = host.querySelector('[data-account-menu]');

  const closeAccount = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });

  // Clicking anywhere else, or pressing Escape, closes it. Both are listed
  // because a menu that only closes one way is a menu people learn to
  // navigate away from.
  document.addEventListener('click', closeAccount);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menu.hidden) return;
    closeAccount();
    trigger.focus();
  });
  menu.addEventListener('click', (event) => event.stopPropagation());

  host.querySelector('[data-sign-out]').addEventListener('click', () => {
    auth.signOut();
    location.replace('login.html');
  });

  /*
   * The bell used to raise a toast saying the feature was not in the design
   * cut. It is real now — see lib/notifications-panel.js. Mounted here rather
   * than per screen because the top bar is the shell's, and every signed-in
   * page gets it.
   */
  mountNotifications(
    host.querySelector('[data-notifications]'),
    host.querySelector('[data-notifications-panel]')
  );

  const menuToggle = host.querySelector('[data-menu-toggle]');
  menuToggle.addEventListener('click', () => {
    const side = document.getElementById('sidenav');
    const open = side.dataset.open !== 'true';
    side.dataset.open = String(open);
    menuToggle.setAttribute('aria-expanded', String(open));
  });
}

/* ============================================================================
   SIDE NAVIGATION
   ========================================================================= */

function renderSideNav(active) {
  const host = document.getElementById('sidenav');
  if (!host) return;

  host.innerHTML = `<ul class="pp-side__list">${SECTIONS.map((section) =>
    section.children ? renderGroup(section, active) : renderLeaf(section, active)
  ).join('')}</ul>`;

  wireSideNav(host);
}

function renderLeaf(section, active) {
  const isActive = section.id === active;
  return `
    <li>
      <a href="${esc(section.href)}"
        class="pp-side__item${isActive ? ' pp-side__item--active' : ''}"
        ${isActive ? 'aria-current="page"' : ''}
        data-testid="nav--${esc(section.id)}">
        ${icon(section.icon)}
        <span class="pp-side__label">${esc(section.label)}</span>
      </a>
    </li>
  `;
}

function renderGroup(section, active) {
  // A group counts as active when the current screen is one of its children.
  // It is then also expanded — arriving on Statements with Billing collapsed
  // would hide the very item that says where you are.
  const childActive = section.children.some((child) => child.id === active);
  const listId = `nav-group-${section.id}`;

  return `
    <li>
      <button type="button"
        class="pp-side__item${childActive ? ' pp-side__item--active' : ''}"
        aria-expanded="${childActive}" aria-controls="${listId}"
        data-group="${esc(section.id)}"
        data-testid="nav--${esc(section.id)}">
        ${icon(section.icon)}
        <span class="pp-side__label">${esc(section.label)}</span>
        ${icon('chevron-down', { size: 'sm', className: 'pp-side__chevron' })}
      </button>

      <ul class="pp-side__sub" id="${listId}" ${childActive ? '' : 'hidden'}>
        ${section.children
          .map((child) => {
            const isActive = child.id === active;
            return `<li>
              <a href="${esc(child.href)}"
                class="pp-side__subitem${isActive ? ' pp-side__subitem--active' : ''}"
                ${isActive ? 'aria-current="page"' : ''}
                data-testid="nav--${esc(child.id)}">
                <span>${esc(child.label)}</span>
              </a>
            </li>`;
          })
          .join('')}
      </ul>
    </li>
  `;
}

function wireSideNav(host) {
  host.querySelectorAll('[data-group]').forEach((button) => {
    button.addEventListener('click', () => {
      const list = document.getElementById(button.getAttribute('aria-controls'));
      const open = list.hidden;
      list.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    });
  });
}

