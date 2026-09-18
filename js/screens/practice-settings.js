/**
 * Practice Settings — Profile, Locations, Users.
 *
 * The Edit Practice Profile and Add New Location dialogs share the same long
 * form shape (identity → addresses → office hours), so they are built by one
 * renderer with a different field set at the top.
 */
import {
  PRACTICE,
  PRACTICE_PROFILES,
  PRACTICE_PROFILE_IDS,
  ACTIVE_PRACTICE_ID,
  setActivePracticeProfile,
  LOCATIONS,
  USERS,
  USER_STATUS,
  USER_ROLE_TONE,
  USER_TYPES,
  PROVIDER_TYPES,
  PROVIDER_TITLES,
  PROVIDER_ROLES,
  STAFF_ROLES,
  USER_PERMISSIONS,
  permissionsForRole,
  WEEK_DAYS,
  PLACES_OF_SERVICE,
  SPECIALTY_TYPES,
  ID_QUALIFIERS,
  STATES,
  LOCATION_COLOURS,
  LOCATION_ID_FIELDS,
  PROVIDER_GROUPS,
} from '../../data/practice.js';
import { appointmentTypesFor } from '../../data/appointments.js';
import { registerSwatches, swatchMarkup } from '../lib/swatches.js';
import { createPager } from '../lib/pagination.js';
// Two tabs large enough to own their own files. Each exports one init and
// otherwise keeps to itself — this file only decides when to call it.
import { initRoles } from './practice-roles.js';
import { initPrintConfig } from './practice-print-config.js';
import { admits, chosen } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "09:00" → "09.00 AM" — the format the profile card reads in. */
function displayTime(value) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}.${String(m).padStart(2, '0')} ${suffix}`;
}

const addressLine = (a) =>
  [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(', ');

const initials = (name) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

customElements.whenDefined('ui-data-table').then(() => {
  const tabs = document.querySelector('[data-testid="prc--tabs"]');
  const editProfile = document.querySelector('[data-testid="prc--edit-profile"]');
  const addLocation = document.querySelector('[data-testid="prc--add-location"]');
  const addProvider = document.querySelector('[data-testid="prc--add-provider"]');
  const addUser = document.querySelector('[data-testid="prc--add-user"]');
  const filters = document.querySelector('[data-testid="prc--filters"]');
  const userSearch = document.querySelector('[data-testid="usr--search"]');

  const addPrintConfig = document.querySelector('[data-testid="prc--add-print-config"]');

  // Each tab owns a different primary action, so the header swaps with it.
  function syncActions(tab) {
    editProfile.hidden = tab !== 'profile';
    addLocation.hidden = tab !== 'locations';
    addProvider.hidden = tab !== 'users';
    addUser.hidden = tab !== 'users';
    if (filters) filters.hidden = tab !== 'users';
    if (userSearch) userSearch.hidden = tab !== 'users';
    if (addPrintConfig) addPrintConfig.hidden = tab !== 'print';
  }
  tabs?.addEventListener('ui-change', (event) => syncActions(event.detail.value));

  // ?tab=locations lets the location page send you back where you came from.
  const requested = new URLSearchParams(window.location.search).get('tab');
  const startTab = ['profile', 'locations', 'users', 'roles', 'print'].includes(requested)
    ? requested
    : 'profile';
  if (startTab !== 'profile') tabs?.setAttribute('selected', startTab);
  syncActions(startTab);

  // Location colours are customer data, so they get generated classes rather
  // than inline styles — same approach as the appointment status colours.
  registerSwatches([...LOCATIONS.map((l) => l.colour), ...LOCATION_COLOURS]);

  paintProfile();
  paintLocations();
  initProfileModal(editProfile);
  initLocationPage(addLocation);
  initUsers(addUser, addProvider);
  initRoles();
  initPrintConfig();

  // initRoles/initPrintConfig each decide their own header button from the
  // panel's hidden state, which is only correct after the start tab is set.
  syncActions(startTab);
});

/* ===================== PROFILE =====================

   MediNova is two billing entities, not one: the clinic and the ASC. They have
   different group NPIs, different opening hours, different claim forms and
   different appointment types, so the Profile tab shows ONE at a time and the
   switcher above it decides which — see PRACTICE_PROFILES in
   data/practice.js. The choice is app-wide and persists, because a screen
   that quietly went back to the clinic on the next page load would put ASC
   work on the wrong claim.
   ================================================================= */

function profileSwitcher() {
  return `<div class="prc__profile-switch" role="group" aria-label="Practice profile"
      data-testid="prc--profile-switch">
    ${PRACTICE_PROFILE_IDS.map((id) => {
      const profile = PRACTICE_PROFILES[id];
      const active = id === ACTIVE_PRACTICE_ID;
      return `<button type="button" class="prc__profile-switch-btn" data-profile="${id}"
        aria-pressed="${active}" data-testid="prc--profile-${id}">
        <span class="prc__profile-switch-label">${esc(profile.label)}</span>
        <span class="prc__profile-switch-sub">${esc(profile.kind)}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function identityCard(compact = false) {
  const p = PRACTICE;
  return `<section class="prc__identity${compact ? ' prc__identity--compact' : ''}">
    <div class="prc__photo" aria-hidden="true">
      <svg class="ui-icon"><use href="#i-document"></use></svg>
    </div>
    <div>
      <p class="prc__name" data-testid="prc--profile-name">${esc(p.name)}</p>
      <ui-badge status="info">${esc(p.type)}</ui-badge>
    </div>
    <dl class="prc__kv">
      <dt>Group NPI Number</dt><dd data-testid="prc--profile-npi">${p.npi}</dd>
      <dt>Website</dt><dd>${p.website}</dd>
      <dt>Contact Number</dt><dd>${p.phone}</dd>
      <dt>Email</dt><dd>${p.email}</dd>
      <dt>Physical Address</dt><dd>${addressLine(p.physicalAddress)}</dd>
    </dl>
  </section>`;
}

/**
 * What has to be true on this entity's claims.
 *
 * The clinic raises a professional fee on a CMS-1500 at place of service 11;
 * the ASC raises a facility fee on a UB-04 at 24, under a CCN the clinic does
 * not have. The same colonoscopy generates one of each. Keeping these next to
 * the NPI they belong to is the point of splitting the profile at all.
 */
function billingPanel() {
  const b = PRACTICE.billing;
  const rows = [
    ['Billing Type', b.billingType],
    ['Claim Form', b.claimForm],
    ['Place of Service', b.placeOfService],
    ['Fee Schedule', b.feeSchedule],
    ['Taxonomy Code', b.taxonomy],
    ['Tax ID (EIN)', b.taxId],
    ['CMS Certification Number', b.ccn],
    ['CLIA Number', b.clia],
    ['Accepts Assignment', b.acceptsAssignment ? 'Yes' : 'No'],
  ];

  return `<section class="prc__panel" data-testid="prc--billing-info">
    <h2 class="prc__panel-title">Billing</h2>
    <div class="prc__two-col">
      <dl class="prc__kv">
        ${rows
          .slice(0, 5)
          .map(([label, val]) => `<dt>${label}</dt><dd>${value(val)}</dd>`)
          .join('')}
      </dl>
      <dl class="prc__kv">
        ${rows
          .slice(5)
          .map(([label, val]) => `<dt>${label}</dt><dd>${value(val)}</dd>`)
          .join('')}
      </dl>
    </div>
  </section>`;
}

function paintProfile() {
  const panel = document.getElementById('profilePanel');
  if (!panel) return;
  const p = PRACTICE;

  const hours = p.officeHours
    .map(
      (h) => `<div class="prc__hours-row">
        <span class="prc__hours-day">${h.day}</span>
        <span class="${h.open ? '' : 'prc__hours-closed'}">${
          h.open ? `${displayTime(h.from)} - ${displayTime(h.to)}` : 'Closed'
        }</span>
      </div>`
    )
    .join('');

  const typeCount = appointmentTypesFor(ACTIVE_PRACTICE_ID).length;

  // The switcher spans the whole grid; the two panels are wrapped so both land
  // in the right-hand column beside the identity card rather than the second
  // one wrapping back under it.
  panel.innerHTML = `
    ${profileSwitcher()}
    ${identityCard()}
    <div class="prc__profile-col">
    <section class="prc__panel" data-testid="prc--basic-info">
      <h2 class="prc__panel-title">Basic Information</h2>
      <div class="prc__two-col">
        <dl class="prc__kv">
          <dt>Practice Fax Number</dt><dd>${p.fax}</dd>
          <dt>EHR System</dt><dd>${p.ehrSystem}</dd>
          <dt>Billing Address</dt><dd>${addressLine(p.billingAddress)}</dd>
          <dt>Appointment Types</dt>
          <dd><a href="appointment-settings.html?tab=types" data-testid="prc--profile-type-count"
            >${typeCount} offered here</a></dd>
        </dl>
        <div>
          <p class="prc__kv-label">Practice Office Hours</p>
          <div class="prc__hours" data-testid="prc--profile-hours">${hours}</div>
        </div>
      </div>
      <dl class="prc__kv prc__kv--wide">
        <dt>Practice Information</dt>
        <dd class="prc__info">${esc(p.information)}</dd>
      </dl>
    </section>
    ${billingPanel()}
    </div>`;

  panel.querySelectorAll('[data-profile]').forEach((button) =>
    button.addEventListener('click', () => {
      if (button.dataset.profile === ACTIVE_PRACTICE_ID) return;
      setActivePracticeProfile(button.dataset.profile);
      paintProfile();
      // The Edit dialog is built once from the profile it opened against, so
      // it has to be rebuilt against the new one.
      rebuildProfileModal();
    })
  );
}

/* ===================== LOCATIONS ===================== */

function paintLocations() {
  const table = document.getElementById('locationTable');
  const foot = document.querySelector('[data-foot="locations"]');
  if (!table || !foot) return;

  const pager = createPager(foot, {
    noun: 'locations',
    testidPrefix: 'prc-locations',
    onChange: () => paint(),
  });

  let locations = LOCATIONS.map((l) => ({ ...l }));
  let query = '';
  let pendingDelete = null;

  /** Everything a site is findable by: what it is called, and where it is. */
  const haystack = (l) =>
    [l.name, l.businessUnit, l.address.line1, l.address.line2, l.address.city,
      l.address.state, l.address.zip]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  /*
   * The colour that identifies the location on the schedule, its name, where
   * it is, whether it is in use, and the two things you can do to it.
   *
   * Everything else — business unit, place of service, NPIs, CLIA, tax rate,
   * billing types — lives in the detail dialog. Thirteen columns meant every
   * one of them truncated, which is worse than not showing them at all.
   */
  const COLUMNS = [
    {
      key: 'colour',
      label: 'Color',
      narrow: true,
      render: (row) => swatchMarkup(row.colour),
    },
    {
      key: 'name',
      label: 'Name',
      truncate: true,
      sortable: true,
      render: (row) =>
        `<a class="pt__name-link" href="#" data-open-location="${row.id}">${row.name}</a>`,
    },
    {
      key: 'located',
      label: 'Located at',
      truncate: true,
      render: (row) => {
        const a = row.address;
        const line = [a.line1, a.line2].filter(Boolean).join(', ');
        return line ? `${line}, ${a.city}, ${a.state} ${a.zip}` : '<span class="prc__muted">—</span>';
      },
    },
    {
      // The switch IS the status: it reads Active or Inactive and flipping it
      // is the change. A badge beside it would say the same thing twice.
      key: 'active',
      label: 'Status',
      narrow: true,
      render: (row) => `<ui-toggle data-location-status="${row.id}" ${
        row.active ? 'checked' : ''
      }>${row.active ? 'Active' : 'Inactive'}</ui-toggle>`,
    },
    {
      key: 'action',
      label: 'Action',
      actions: true,
      render: (row) => `<button type="button" class="ui-row-menu-btn"
          data-edit-location="${row.id}" aria-label="Edit ${esc(row.name)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-pencil"></use></svg>
        </button>
        <button type="button" class="set__icon-action prc__icon-action--danger"
          data-delete-location="${row.id}" aria-label="Delete ${esc(row.name)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
        </button>`,
    },
  ];

  const visible = () =>
    query ? locations.filter((l) => haystack(l).includes(query)) : locations;

  document.getElementById('locationSearch')?.addEventListener('ui-input', (event) => {
    query = event.detail.value.trim().toLowerCase();
    pager.reset();
    paint();
  });

  /** Flip a location's active flag — from the row switch or the detail dialog. */
  function setActive(id, active) {
    locations = locations.map((l) => (l.id === id ? { ...l, active } : l));
    paint();
  }

  /* --- Delete ---------------------------------------------------------------
     A site is pointed at by appointments, claims, users and print configs, so
     removing one is confirmed and named, the same as deleting a user or role. */

  const deleteModal = document.getElementById('locationDeleteModal');

  deleteModal?.querySelectorAll('[data-modal-dismiss]').forEach((button) =>
    button.addEventListener('ui-click', () => deleteModal.close())
  );

  deleteModal
    ?.querySelector('[data-testid="prc--location-delete-confirm"]')
    ?.addEventListener('ui-click', () => {
      if (!pendingDelete) return;
      locations = locations.filter((l) => l.id !== pendingDelete);
      pendingDelete = null;
      paint();
      deleteModal.close();
      // The row that opened this dialog is gone, so focus cannot return to it.
      document.querySelector('[data-testid="prc--add-location"]')?.focus();
    });

  function confirmDelete(location, trigger) {
    if (!deleteModal) return;
    pendingDelete = location.id;
    document.getElementById('locationDeleteBody').innerHTML =
      `<p>Remove <strong>${esc(location.name)}</strong> from this practice?
       Appointments and claims already recorded against it keep what they
       recorded — it just stops being offered from now on.</p>`;
    deleteModal.open(trigger);
  }

  function paint() {
    const rows = visible();
    const { start, end } = pager.render(rows.length);
    const slice = rows.slice(start, end);
    table.columns = COLUMNS;
    table.rows = slice;
    table.setAttribute('state', slice.length ? 'ready' : 'empty');

    document.querySelector('[data-testid="prc--location-count"]').textContent =
      `${rows.length} of ${locations.length} location${locations.length === 1 ? '' : 's'}`;

    // The name opens the full record.
    table.querySelectorAll('[data-open-location]').forEach((link) =>
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openLocationDetail(
          locations.find((l) => l.id === link.dataset.openLocation),
          link,
          setActive
        );
      })
    );

    table.querySelectorAll('[data-location-status]').forEach((toggle) => {
      const location = locations.find((l) => l.id === toggle.dataset.locationStatus);
      // <ui-toggle> names itself from its own text, which is "Active" on every
      // row. Naming the site as well is what stops a screen reader reading the
      // column as four identical switches; the visible word stays inside the
      // name, so "Label in Name" still holds.
      const input = toggle.querySelector('input');
      if (input) input.setAttribute('aria-label', `${location.name} — ${input.checked ? 'Active' : 'Inactive'}`);

      toggle.addEventListener('ui-change', (event) =>
        setActive(location.id, event.detail.checked)
      );
    });

    table.querySelectorAll('[data-edit-location]').forEach((button) =>
      button.addEventListener('click', () => {
        window.location.href = `location-add.html?id=${encodeURIComponent(
          button.dataset.editLocation
        )}`;
      })
    );

    table.querySelectorAll('[data-delete-location]').forEach((button) =>
      button.addEventListener('click', () =>
        confirmDelete(
          locations.find((l) => l.id === button.dataset.deleteLocation),
          button
        )
      )
    );
  }

  paint();
}

/* ===================== LOCATION DETAIL ===================== */

const value = (v) => v || '<span class="prc__muted">—</span>';

/** A definition list, skipping nothing — blanks show an em dash. */
function detailList(pairs) {
  return `<dl class="prc__kv">${pairs
    .map(([label, v]) => `<dt>${label}</dt><dd>${value(v)}</dd>`)
    .join('')}</dl>`;
}

function detailTable(title, columns, rows) {
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${columns.map((c) => `<td>${value(row[c.key])}</td>`).join('')}</tr>`
        )
        .join('')
    : `<tr><td class="prc__mini-empty" colspan="${columns.length}">None recorded.</td></tr>`;

  return `<section class="prc__mini">
    <div class="prc__mini-head"><span>${title}</span></div>
    <table class="prc__mini-table">
      <thead><tr>${columns.map((c) => `<th scope="col">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

function openLocationDetail(location, opener, onActiveChange) {
  const modal = document.getElementById('locationDetail');
  const body = document.getElementById('locationDetailBody');
  if (!modal || !location) return;

  modal.setAttribute('heading', location.name);

  const a = location.address;
  const c = location.contactPerson;

  // Only identifiers that are actually set — a wall of em dashes helps nobody.
  const setIds = LOCATION_ID_FIELDS.filter(([key]) => location.ids[key]);

  body.innerHTML = `
    <div class="prc__detail-head">
      ${swatchMarkup(location.colour, 'ui-swatch--dot')}
      <span class="prc__detail-id">${location.id}</span>
      <!-- Activating a location lives here rather than in the list: the list
           is a scan surface, and the status filter already governs it. -->
      <ui-toggle ${location.active ? 'checked' : ''}
                 data-testid="prc--detail-status">${
                   location.active ? 'Active' : 'Inactive'
                 }</ui-toggle>
      <span class="prc__spacer"></span>
      <ui-button variant="outline" size="sm" icon="pencil"
                 data-detail-edit="${location.id}"
                 data-testid="prc--detail-edit">Edit</ui-button>
    </div>

    ${location.description ? `<p class="prc__detail-note">${location.description}</p>` : ''}

    <div class="prc__detail-cols">
      <div class="prc__detail-col">
        <section class="prc__mini">
          <div class="prc__mini-head"><span>Location</span></div>
          <div class="prc__detail-body">
            ${detailList([
              ['Business Unit', location.businessUnit],
              ['Place of service', location.placeOfService],
              ['Direct Address', location.directAddress],
              ['Outside Lab', location.outsideLab ? 'Yes' : 'No'],
              ['Tax Rate', `${location.taxRate || '0.00'} %`],
            ])}
          </div>
        </section>

        <section class="prc__mini">
          <div class="prc__mini-head"><span>Located at</span></div>
          <div class="prc__detail-body">
            ${detailList([
              ['Address', [a.line1, a.line2].filter(Boolean).join(', ')],
              ['City', a.city],
              ['State', a.state],
              ['ZIP', a.zip],
            ])}
          </div>
        </section>

        <section class="prc__mini">
          <div class="prc__mini-head"><span>Contact Person</span></div>
          <div class="prc__detail-body">
            ${detailList([
              ['Name', [c.first, c.middle, c.last].filter(Boolean).join(' ')],
            ])}
          </div>
        </section>

        <!-- No Patient Portal block. The three settings it read have gone
             from the location form — the portal has never taken its site list
             or its wording from here. See locationFormMarkup(). -->
      </div>

      <div class="prc__detail-col">
        ${detailTable(
          'Contact Numbers',
          [{ key: 'type', label: 'Type' }, { key: 'number', label: 'Contact Number' }],
          location.contactNumbers
        )}

        <section class="prc__mini">
          <div class="prc__mini-head"><span>Billing</span></div>
          <div class="prc__detail-body">
            ${detailList([['Facility Name', location.facilityName]])}
          </div>
        </section>

        ${detailTable(
          'Billing type per business unit',
          [{ key: 'unit', label: 'Business Unit' }, { key: 'type', label: 'Billing Type' }],
          location.billingTypes
        )}

        ${detailTable(
          'Cost Centers',
          [
            { key: 'name', label: 'Name' },
            { key: 'effective', label: 'Effective' },
            { key: 'expiration', label: 'Expiration' },
          ],
          location.costCentres
        )}

        <section class="prc__mini">
          <div class="prc__mini-head"><span>Location ID's</span></div>
          <div class="prc__detail-body">
            ${
              setIds.length
                ? detailList(setIds.map(([key, label]) => [label, location.ids[key]]))
                : '<p class="prc__mini-empty">No identifiers recorded.</p>'
            }
          </div>
        </section>
      </div>
    </div>`;

  body.querySelector('[data-detail-edit]')?.addEventListener('ui-click', () => {
    window.location.href = `location-add.html?id=${encodeURIComponent(location.id)}`;
  });

  body
    .querySelector('[data-testid="prc--detail-status"]')
    ?.addEventListener('ui-change', (event) => {
      onActiveChange?.(location.id, event.detail.checked);
      modal.close();
    });

  modal.open(opener);
}

/* ===================== USERS =====================
   An enterprise directory: search, six filters, seven quick chips, sortable
   columns, multi-select bulk actions, CSV export, and two separate
   onboarding entry points — Provider (clinical, placeholder for now) and
   User (everyone else, the drawer built out below).
   ==================================================== */

/** Every role the table's Role filter and both onboarding forms draw from —
 *  distinct from the legacy USER_ROLES the old single-page form still uses. */
const ALL_JOB_ROLES = [...PROVIDER_ROLES, ...STAFF_ROLES];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20 Dec 2025 at 02:25 PM" → a comparable number, for real chronological
 *  sort rather than alphabetising the words. null (never logged in) sorts
 *  as the oldest possible moment. */
function parseLoginTime(value) {
  if (!value) return -Infinity;
  const m = value.match(/^(\d{2}) (\w{3}) (\d{4}) at (\d{2}):(\d{2}) (AM|PM)$/);
  if (!m) return -Infinity;
  const [, dd, mon, yyyy, hh, mm, ampm] = m;
  let hour = Number(hh) % 12;
  if (ampm === 'PM') hour += 12;
  return new Date(Number(yyyy), MONTH_ABBR.indexOf(mon), Number(dd), hour, Number(mm)).getTime();
}

/** The role, as a tinted pill rather than a line of grey text. */
function rolePill(role) {
  const tone = USER_ROLE_TONE[role] ?? 'neutral';
  return `<span class="prc__role prc__role--${tone}">${esc(role)}</span>`;
}

function statusBadge(status) {
  const meta = USER_STATUS[status] ?? USER_STATUS.inactive;
  return `<ui-badge status="${meta.tone}">${meta.label}</ui-badge>`;
}

function lastLoginCell(row) {
  return row.lastLogin
    ? esc(row.lastLogin)
    : '<span class="prc__muted">Never Logged In</span>';
}

function userColumns() {
  return [
    {
      key: 'avatar',
      label: '<span class="u-sr-only">Avatar</span>',
      render: (row) => `<span class="prc__user-avatar usr__avatar" aria-hidden="true">${initials(row.name)}</span>`,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => `<button type="button" class="usr__name-link" data-open-profile="${row.id}">${esc(row.name)}</button>`,
    },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => `<ui-badge status="${row.type === 'Provider' ? 'brand' : 'neutral'}">${row.type}</ui-badge>`,
    },
    { key: 'role', label: 'Role', sortable: true, render: (row) => rolePill(row.role) },
    { key: 'status', label: 'Status', sortable: true, render: (row) => statusBadge(row.status) },
    { key: 'lastLogin', label: 'Last Login', sortable: true, render: lastLoginCell },
    { key: 'createdBy', label: 'Created By' },
    {
      key: 'actions',
      label: '<span class="u-sr-only">Actions</span>',
      actions: true,
      render: (row) => `<button type="button" class="ui-row-menu-btn" data-menu="${row.id}"
          aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(row.name)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
        </button>`,
    },
  ];
}

/** Rows surviving search, the active chip and every filter, sorted. */
function usersFiltered(state) {
  const q = state.query.trim().toLowerCase();
  let rows = state.data;

  if (q) {
    rows = rows.filter((u) =>
      [u.name, u.email, u.phone, u.username].some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }

  /* Five of the six take a SET now — a directory is searched for "the two
     nurses at Fargo", not for one role at one site — so each one asks admits()
     rather than comparing to a single answer. Last login is the exception and
     stays a single choice: "Logged in" and "Never logged in" are the two
     halves of the same fact, and ticking both is what "Any time" already
     means. See js/lib/filter-set.js. */
  const f = state.filters;
  rows = rows.filter(
    (u) =>
      admits(f.type, u.type) &&
      admits(f.role, u.role) &&
      admits(f.status, USER_STATUS[u.status]?.label)
  );
  /* One answer or none — the group is `single`, so this reads the one thing
     in the set rather than testing the set for each answer in turn. */
  const login = chosen(f.lastLogin)[0] ?? '';
  if (login === 'Logged in') rows = rows.filter((u) => u.lastLogin !== null);
  if (login === 'Never logged in') rows = rows.filter((u) => u.lastLogin === null);

  if (state.sort) {
    const { key, direction } = state.sort;
    const factor = direction === 'ascending' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (key === 'lastLogin') return (parseLoginTime(a.lastLogin) - parseLoginTime(b.lastLogin)) * factor;
      return String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * factor;
    });
  }

  return rows;
}

const findUser = (state, id) => state.data.find((u) => u.id === id);

function initUsers(addUserButton, addProviderButton) {
  const table = document.getElementById('usrTable');
  if (!table) return;

  const state = {
    data: USERS.map((u) => ({ ...u, permissions: [...u.permissions] })),
    query: '',
    filters: DEFAULT_FILTERS(),

    sort: null,
    created: 0,
  };

  state.pager = createPager(document.querySelector('[data-foot="users"]'), {
    rowsPerPage: 50,
    rowSizes: [50, 100, 250],
    noun: 'users',
    testidPrefix: 'usr',
    onChange: () => paintUsers(state),
  });

  table.columns = userColumns();

  const usrFilter = document.getElementById('usrFilter');
  usrFilter.setGroupOptions('role', ALL_JOB_ROLES);


  wireUserToolbar(state);
  wireUserFilters(state);
  wireUserBulkBar(state, table);

  table.addEventListener('ui-sort', (event) => {
    state.sort = event.detail;
    state.pager.reset();
    paintUsers(state);
  });

  table.addEventListener('ui-select', (event) => updateBulkBar(event.detail.selected.length));

  addUserButton?.addEventListener('ui-click', () => openUserOnboard(state, null, addUserButton));
  addProviderButton?.addEventListener('ui-click', () => openProviderOnboard(state, addProviderButton));
  document.querySelector('[data-testid="usr--empty-add-user"]')
    ?.addEventListener('ui-click', () => openUserOnboard(state, null, addUserButton));
  document.querySelector('[data-testid="usr--empty-add-provider"]')
    ?.addEventListener('ui-click', () => openProviderOnboard(state, addProviderButton));

  initAssignRoleModal(state);
  initPermissionsModal(state);
  initDeleteModal(state);
  initProviderOnboard(state);

  paintUsers(state);
}

function paintUsers(state) {
  const table = document.getElementById('usrTable');
  const wrap = document.getElementById('usrTableWrap');
  const foot = document.querySelector('[data-foot="users"]');
  const empty = document.getElementById('usrEmpty');
  if (!table) return;

  const all = usersFiltered(state);
  const { start, end } = state.pager.render(all.length);
  const slice = all.slice(start, end);
  const isEmpty = all.length === 0;

  wrap.hidden = isEmpty;
  foot.hidden = isEmpty;
  empty.hidden = !isEmpty;
  if (isEmpty) {
    // Empty the table as well as hiding it. Leaving the previous page's rows
    // in the DOM means a filter that matches nothing still has a row behind
    // the empty state — invisible, but there.
    table.rows = [];
    table.clearSelection();
    updateBulkBar(0);
    return;
  }

  table.rows = slice;
  wireUserRows(state, table);
}

function wireUserRows(state, table) {
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const id = tr.dataset.rowId;
    // Guarded, not stopped at the source: the checkbox, the name link and
    // the ⋮ trigger each already do their own thing on click, so the row's
    // own single-click (view) / double-click (edit) only fires when the
    // click landed on plain row background.
    //
    // The single click opens a drawer, which renders a scrim over the row.
    // If that happened immediately, the second click of a genuine double
    // click would land on the scrim instead of the row — closing the
    // drawer rather than ever reaching the row's dblclick listener. The
    // single click is held for the browser's own double-click window so a
    // following dblclick can cancel it before the drawer ever opens.
    let pendingView = null;
    tr.addEventListener('click', (event) => {
      if (event.target.closest('.ui-table__select, [data-menu], [data-open-profile]')) return;
      clearTimeout(pendingView);
      pendingView = setTimeout(() => {
        const user = findUser(state, id);
        if (user) openUserDetail(state, user, tr);
      }, 300);
    });
    tr.addEventListener('dblclick', (event) => {
      if (event.target.closest('.ui-table__select, [data-menu], [data-open-profile]')) return;
      clearTimeout(pendingView);
      const user = findUser(state, id);
      if (user) openUserOnboard(state, user, tr);
    });
  });

  table.querySelectorAll('[data-open-profile]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openUserDetail(state, findUser(state, button.dataset.openProfile), button);
    })
  );

  table.querySelectorAll('[data-menu]').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openUserRowMenu(state, findUser(state, button.dataset.menu), button);
    })
  );
}

/* --- Search, the filter drawer, bulk bar ------------------------------------ */

function wireUserToolbar(state) {
  document.getElementById('usrSearch')?.addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    state.pager.reset();
    paintUsers(state);
  });
}

/**
 * Everything at rest.
 *
 * `lastLogin` used to idle at the string "Any time" — an option meaning "do
 * not narrow by this", which is what an empty set already means. It is a set
 * like the rest of them now, and the row that cancelled the other two is gone
 * from the panel with it.
 */
const DEFAULT_FILTERS = () => ({
  type: [],
  role: [],
  status: [],
  lastLogin: [],
});

/**
 * The filter panel, wired the way every list in the product wires it: each
 * tick applies as it is made, and one Clear puts them all back.
 */
function wireUserFilters(state) {
  const filter = document.getElementById('usrFilter');
  if (!filter) return;

  filter.addEventListener('ui-filter-change', (event) => {
    Object.assign(state.filters, event.detail.values);
    state.pager.reset();
    paintUsers(state);
  });

  filter.addEventListener('ui-filter-clear', () => {
    state.filters = DEFAULT_FILTERS();
    state.pager.reset();
    paintUsers(state);
  });
}

function updateBulkBar(count) {
  const bar = document.getElementById('usrBulkBar');
  const label = document.getElementById('usrBulkCount');
  if (!bar) return;
  bar.hidden = count === 0;
  if (label) label.textContent = `${count} selected`;
}

function wireUserBulkBar(state, table) {
  const bar = document.getElementById('usrBulkBar');
  if (!bar) return;

  const selectedUsers = () => table.selected.map((id) => findUser(state, id)).filter(Boolean);

  bar.querySelectorAll('[data-bulk]').forEach((button) =>
    button.addEventListener('ui-click', () => {
      const users = selectedUsers();
      if (!users.length) return;
      const action = button.dataset.bulk;

      if (action === 'activate') users.forEach((u) => (u.status = 'active'));
      else if (action === 'deactivate') users.forEach((u) => (u.status = 'inactive'));
      else if (action === 'send-invite') { /* prototype: acknowledged — no mail server to actually send from */ }
      else if (action === 'reset-password') { /* prototype: acknowledged, nothing to reset */ }
      else if (action === 'export') exportUsersCsv(users, 'selected-users');
      else if (action === 'assign-role') return openAssignRole(state, users.map((u) => u.id), table, button);
      else if (action === 'delete') return openDeleteConfirm(state, users.map((u) => u.id), table, button);

      table.clearSelection();
      paintUsers(state);
    })
  );
}

/* --- CSV export -------------------------------------------------------------
   A client-side download, not a server round trip — this is a prototype, and
   the point is proving the affordance exists and produces a real file. */

function exportUsersCsv(rows, filenameStem) {
  const columns = ['name', 'email', 'phone', 'type', 'role', 'status', 'lastLogin', 'createdBy'];
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    columns.join(','),
    ...rows.map((row) =>
      columns
        .map((key) => csvCell(key === 'status' ? USER_STATUS[row.status]?.label : row[key] ?? (key === 'lastLogin' ? 'Never Logged In' : '')))
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameStem}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* --- Row ⋮ menu ---------------------------------------------------------
   Body-parented and positioned through a generated stylesheet — same
   pattern as the scheduler's row menu and Master's, so the table's own
   overflow: auto never clips it. */

let closeUserMenu = null;

function openUserRowMenu(state, user, trigger) {
  closeUserMenu?.();
  if (!user) return;

  const item = (action, icon, label, extraClass = '') =>
    `<button type="button" role="menuitem" class="mst__menu-item ${extraClass}" data-action="${action}">
       <svg class="ui-icon" aria-hidden="true"><use href="#i-${icon}"></use></svg>${label}
     </button>`;

  const statusItem =
    user.status === 'active'
      ? item('deactivate', 'eye-off', 'Deactivate')
      : user.status === 'locked'
      ? item('unlock', 'check', 'Unlock Account')
      : item('activate', 'check', 'Activate');

  const panel = document.createElement('div');
  panel.id = 'usrRowMenu';
  panel.className = 'mst__menu';
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-label', `Actions for ${user.name}`);
  panel.innerHTML = `
    ${item('view', 'user', 'View Profile')}
    ${item('edit', 'pencil', 'Edit')}
    ${item('reset-password', 'shield', 'Reset Password')}
    ${user.status === 'pending' ? item('resend', 'mail', 'Resend Invitation') : ''}
    ${statusItem}
    ${item('assign-role', 'user-cog', 'Assign Role')}
    ${item('permissions', 'settings', 'Manage Permissions')}
    <span class="mst__menu-rule" role="separator"></span>
    ${item('delete', 'trash', 'Delete', 'mst__menu-item--danger')}`;

  document.body.appendChild(panel);

  const box = trigger.getBoundingClientRect();
  const height = panel.offsetHeight;
  const below = window.innerHeight - box.bottom;
  const left = Math.max(8, box.right - panel.offsetWidth);
  const top = below < height + 16 ? Math.max(8, box.top - height - 4) : box.bottom + 4;
  sheet('usrMenu').textContent =
    `#usrRowMenu{--mst-menu-left:${Math.round(left)}px;--mst-menu-top:${Math.round(top)}px;}`;

  trigger.setAttribute('aria-expanded', 'true');
  panel.querySelector('.mst__menu-item')?.focus();

  const dismiss = () => {
    panel.remove();
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', dismiss);
    closeUserMenu = null;
  };
  closeUserMenu = dismiss;

  function onKey(event) {
    if (event.key !== 'Escape') return;
    dismiss();
    trigger.focus();
  }
  function onOutside(event) {
    if (!panel.contains(event.target) && event.target !== trigger) dismiss();
  }
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', dismiss);

  panel.querySelectorAll('[data-action]').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      dismiss();
      runUserAction(state, user, action, trigger);
    })
  );
}

function runUserAction(state, user, action, trigger) {
  const table = document.getElementById('usrTable');
  const refocus = () => table?.querySelector(`[data-menu="${user.id}"]`)?.focus();

  if (action === 'view') return openUserDetail(state, user, trigger);
  if (action === 'edit') return openUserOnboard(state, user, trigger);
  if (action === 'assign-role') return openAssignRole(state, [user.id], table, trigger);
  if (action === 'permissions') return openManagePermissions(state, user, trigger);
  if (action === 'delete') return openDeleteConfirm(state, [user.id], table, trigger);

  if (action === 'deactivate') user.status = 'inactive';
  if (action === 'activate' || action === 'unlock') user.status = 'active';
  if (action === 'resend') { /* prototype: acknowledged — the invitation stays pending */ }
  if (action === 'reset-password') { /* prototype: acknowledged — nothing to actually reset */ }

  paintUsers(state);
  refocus();
}

/** One <style> element per id, created on first use — shared naming with
 *  Master and the scheduler's own row menus. */
function sheet(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/* --- View profile (read-only) ---------------------------------------------- */

function openUserDetail(state, user, trigger) {
  const modal = document.getElementById('userDetail');
  const body = document.getElementById('userDetailBody');
  if (!modal || !user) return;

  body.innerHTML = `
    <div class="prc__profile-head">
      <span class="prc__user-avatar prc__user-avatar--lg" aria-hidden="true">${initials(user.name)}</span>
      <span class="prc__user-ident">
        <span class="prc__profile-name">${esc(user.name)}</span>
        ${rolePill(user.role)}
      </span>
      ${statusBadge(user.status)}
    </div>

    <dl class="prc__profile-facts">
      <div><dt>Type</dt><dd>${esc(user.type)}</dd></div>
      <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
      <div><dt>Phone</dt><dd>${esc(user.phone)}</dd></div>
      <div><dt>Username</dt><dd>${esc(user.username)}</dd></div>
      <div><dt>Location</dt><dd>${esc(userLocationList(user).join(', ') || '—')}</dd></div>
      <div><dt>Last login</dt><dd>${user.lastLogin ? esc(user.lastLogin) : 'Never Logged In'}</dd></div>
      <div><dt>Created by</dt><dd>${esc(user.createdBy)}</dd></div>
      <div><dt>User ID</dt><dd>${esc(user.id)}</dd></div>
    </dl>

    <div>
      <span class="ui-field__label">Permissions</span>
      <p class="prc__info">${user.permissions.length ? esc(user.permissions.join(', ')) : 'None granted.'}</p>
    </div>

    <div class="ui-modal__actions">
      <ui-button variant="tertiary" data-profile-close>Close</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-profile-edit data-testid="prc--profile-edit">Edit</ui-button>
    </div>`;

  body.querySelector('[data-profile-close]').addEventListener('ui-click', () => modal.close());
  body.querySelector('[data-profile-edit]').addEventListener('ui-click', () => {
    modal.close();
    openUserOnboard(state, user, trigger);
  });

  modal.setAttribute('heading', 'User Profile');
  modal.open(trigger);
}

/* --- User Onboarding drawer (Add + Edit) -----------------------------------
   User-related information only — no NPI, DEA, specialty or anything that
   belongs to the separate, not-yet-built Provider onboarding workflow. */

const STATUS_LABEL_TO_KEY = Object.fromEntries(
  Object.entries(USER_STATUS).map(([key, meta]) => [meta.label, key])
);

/**
 * The sites already on this user's record, as a list.
 *
 * A person can work at more than one — the field that asks is a multiple
 * select — and the answer is kept in `locations`. Records that predate that,
 * and the standalone user form, carry a single `location` string instead. Both
 * shapes are read back here so neither has to be migrated to see the other's
 * data, and so a user who was only ever given one site still opens the form
 * with that site ticked.
 */
function userLocationList(user) {
  if (user?.locations?.length) return user.locations.filter(Boolean);
  return user?.location ? [user.location] : [];
}

/**
 * The sites this user may be assigned to.
 *
 * Active locations, plus — for an existing user — whichever ones they are
 * already on even if those have since been closed. A picker that quietly omits
 * a value on the record does not leave it alone: the field renders without it
 * and the next Save writes that absence back.
 */
function userLocationOptions(user) {
  const names = LOCATIONS.filter((l) => l.active).map((l) => l.name);
  userLocationList(user)
    .filter((name) => !names.includes(name))
    .forEach((name) => names.unshift(name));
  return names;
}

function userOnboardFields(user) {
  return `
    <section class="prc__mini">
      <div class="prc__mini-head"><span>Basic Information</span></div>
      <div class="prc__form-grid prc__mini-body">
        <ui-input label="First Name" value="${esc(user?.firstName ?? '')}" required
                   data-testid="usr--onb-first"></ui-input>
        <ui-input label="Last Name" value="${esc(user?.lastName ?? '')}" required
                   data-testid="usr--onb-last"></ui-input>
      </div>
    </section>

    <section class="prc__mini">
      <div class="prc__mini-head"><span>Contact Information</span></div>
      <div class="prc__form-grid prc__mini-body">
        <ui-input label="Email" type="email" value="${esc(user?.email ?? '')}" required
                   data-testid="usr--onb-email"></ui-input>
        <ui-input label="Phone" value="${esc(user?.phone ?? '')}" placeholder="(555) 555-5555"
                   data-testid="usr--onb-phone"></ui-input>
      </div>
    </section>

    <section class="prc__mini">
      <div class="prc__mini-head"><span>Role &amp; Location</span></div>
      <div class="prc__form-grid prc__mini-body">
        <ui-select label="Role" placeholder="Select Role"
                   options="${(user ? ALL_JOB_ROLES : STAFF_ROLES).join(',')}"
                   value="${esc(user?.role ?? '')}" required data-testid="usr--onb-role"></ui-select>
        <!-- WHERE THIS PERSON WORKS.
             It sits beside Role because the two are one answer to one
             question — what this person does and where they do it — and
             because the practice now runs a clinic and a surgery centre with
             different rosters. A scheduler at the ASC and a scheduler at the
             clinic are not interchangeable, and until this field existed the
             record could not tell them apart.

             Active sites only: a user cannot be onboarded into a location that
             has been closed. An existing user whose site was later
             deactivated keeps it — the option is added back for them
             specifically, because a form that silently drops the answer on
             file rewrites it the next time anybody presses Save.

             MORE THAN ONE SITE, because that is the true answer for most of
             the roster. A single dropdown forced a scheduler who covers both
             the clinic and the surgery centre to be recorded at one of them,
             and whichever was picked was wrong half the week. Multiple
             selection is the same control with tick boxes in its panel and
             the ticked sites read back on the closed field, so the common
             case — one site — is still one press, and the two-site case stops
             being a lie. The set
             travels as one comma-joined string, which is also why a location
             whose NAME contains a comma cannot be offered here. -->
        <ui-select multiple label="Location" placeholder="Select Locations"
                   options="${userLocationOptions(user).join(',')}"
                   value="${esc(userLocationList(user).join(','))}"
                   data-testid="usr--onb-location"></ui-select>
      </div>
    </section>

    <!-- NO LOGIN CREDENTIALS SECTION.
         It asked for a username, on a form whose next question is whether to
         send an invitation. A person who is invited chooses their own sign-in
         when they accept — that is what the invitation is for — so a username
         typed here was either overwritten by the one they picked or left as a
         second, stale handle nothing authenticated against. Their email is
         already on the form above and is what the invitation goes to. -->

    <!--
      No Permissions block on ADD.

      A new user's permissions come from their ROLE — permissionsForRole()
      in data/practice.js takes the job title to its home department and the
      department to its grant. That is why "who can touch billing" is
      answerable without opening every profile. Asking for the permissions
      again on the way in offered a second, emptier answer to the same
      question: whoever added the user would tick eight boxes from memory, and
      the grant they were meant to inherit would be silently overwritten with
      whatever was remembered.

      Permissions still have a home. The row's Manage Permissions dialog is
      where they are changed, deliberately, against a user who already exists
      and already has a role. The Edit form keeps its block so an existing
      grant stays visible where it is being edited.
    -->
    ${
      user
        ? `<section class="prc__mini">
      <div class="prc__mini-head"><span>Permissions</span></div>
      <div class="prc__mini-body prc__checks" data-testid="usr--onb-permissions">
        ${USER_PERMISSIONS.map(
          (p) => `<ui-checkbox data-permission="${esc(p)}" ${
            user?.permissions?.includes(p) ? 'checked' : ''
          }>${esc(p)}</ui-checkbox>`
        ).join('')}
      </div>
    </section>`
        : ''
    }

    <!-- ONE FIELD, TWO ANSWERS.
         This was an "Invitation & Status" block: a five-option status
         dropdown — Active, Inactive, Pending Invitation, Locked, Suspended —
         plus a tick box asking whether to send the invitation email now.

         Three of those five are not decisions anybody makes on a form. Pending
         Invitation is what the system does when an invitation is sent and
         nobody has accepted it; Locked is what it does after failed sign-ins;
         Suspended came from the same family and meant, in practice, Inactive
         with a harsher word. Offering them as choices let an administrator set
         a user to Locked by hand, which locks nothing, or to Pending
         Invitation without an invitation existing.

         What is left is the one thing a person genuinely decides: may this
         account be used or not. The system's own states still exist on the
         record and still show in the users list — they are simply not
         something this form pretends to set. -->
    <section class="prc__mini">
      <div class="prc__mini-head"><span>Status</span></div>
      <div class="prc__form-grid prc__mini-body">
        <ui-select label="Status" options="Active,Inactive"
                   value="${esc(user ? USER_STATUS[user.status]?.label ?? 'Active' : 'Active')}"
                   data-testid="usr--onb-status"></ui-select>
      </div>
    </section>

    <div class="ui-modal__actions">
      <ui-button variant="outline" data-form-cancel data-testid="usr--onboard-cancel">Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-form-save data-testid="usr--onboard-save">${
        user ? 'Save' : 'Add User'
      }</ui-button>
    </div>`;
}

function openUserOnboard(state, user, trigger) {
  const modal = document.getElementById('userOnboardModal');
  const body = document.getElementById('userOnboardBody');
  if (!modal || !body) return;

  modal.setAttribute('heading', user ? `Edit ${user.name}` : 'Add User');
  body.innerHTML = userOnboardFields(user);

  body.querySelector('[data-form-cancel]').addEventListener('ui-click', () => modal.close());
  body
    .querySelector('[data-form-save]')
    .addEventListener('ui-click', () => submitUserOnboard(state, user, modal, body));

  modal.open(trigger);
}

function submitUserOnboard(state, existingUser, modal, body) {
  const REQUIRED = [
    ['usr--onb-first', 'First name'],
    ['usr--onb-last', 'Last name'],
    ['usr--onb-email', 'Email'],
  ];

  let firstBad = null;
  REQUIRED.forEach(([testid, label]) => {
    const field = body.querySelector(`[data-testid="${testid}"]`);
    const value = String(field.value ?? '').trim();
    field.setAttribute('value', value);
    if (!value) {
      field.setAttribute('error', `${label} is required`);
      if (!firstBad) firstBad = field;
    } else {
      field.removeAttribute('error');
    }
  });

  const roleField = body.querySelector('[data-testid="usr--onb-role"]');
  if (!roleField.value) {
    roleField.setAttribute('error', 'Pick a role');
    if (!firstBad) firstBad = roleField;
  } else {
    roleField.removeAttribute('error');
  }

  if (firstBad) {
    firstBad.focus();
    return;
  }

  /* THE SITES, AS A SET. <ui-select multiple> hands its answer back as one
     comma-joined string. The record keeps the whole list in `locations`, and
     its first entry in `location` — the single-site field the seeded rows, the
     standalone user form and anything else reading a user still expect. Saving
     both means widening this question did not quietly empty that field. */
  const locations = String(body.querySelector('[data-testid="usr--onb-location"]').value)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  const values = {
    firstName: body.querySelector('[data-testid="usr--onb-first"]').value.trim(),
    lastName: body.querySelector('[data-testid="usr--onb-last"]').value.trim(),
    email: body.querySelector('[data-testid="usr--onb-email"]').value.trim(),
    phone: body.querySelector('[data-testid="usr--onb-phone"]').value.trim(),
    role: roleField.value,
    location: locations[0] ?? '',
    locations,
    /* Only Active and Inactive are offered, so only those two can come back.
       An EXISTING user sitting on a system-set state — pending, locked — keeps
       it unless the administrator actually moved the field: the dropdown opens
       on Active for those, and writing that back on every Save would quietly
       unlock an account nobody chose to unlock. So the answer is taken only
       when it differs from where the user already is. */
    status:
      STATUS_LABEL_TO_KEY[body.querySelector('[data-testid="usr--onb-status"]').value] ?? 'active',
  };
  if (existingUser && !['active', 'inactive'].includes(existingUser.status)) {
    values.status = existingUser.status;
  }
  values.name = `${values.firstName} ${values.lastName}`;

  /* The handle, derived rather than asked for. The Login Credentials block has
     gone from this form — an invited user picks their own sign-in when they
     accept — but the users list searches on `username` and the profile drawer
     prints it, so a record still carries one. First initial plus surname is
     the shape every seeded user already has. An existing user keeps theirs:
     a handle that changes because somebody corrected a typo in a surname is a
     handle that stops matching whatever was logged under it. */
  values.username =
    existingUser?.username ??
    `${values.firstName.charAt(0)}${values.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');

  /* Where permissions come from.

     On EDIT, from the tick boxes — the form is showing the user's real grant
     and the administrator is changing it in front of them.

     On ADD there are no tick boxes, so the ROLE decides. It used to be the
     Department, which the form asked for alongside the role; Department has
     gone (RM-047), because the practice is a single entity and a job title
     already implies the department a person sits in. permissionsForRole()
     makes that implication explicit — role to department to grant — so the
     grant a new user receives is exactly what it was before, reached from the
     one question the form still asks instead of two.

     Deriving it matters more than it looks. Dropping the Department field
     without replacing this lookup would have created every new user with an
     empty grant: they would be able to open nothing, and the reason would be
     invisible — no box was unticked, the question was simply never asked. */
  values.permissions = existingUser
    ? [...body.querySelectorAll('[data-permission]')]
        .filter((el) => el.checked)
        .map((el) => el.dataset.permission)
    : permissionsForRole(values.role);

  if (existingUser) {
    Object.assign(existingUser, values);
  } else {
    state.data.unshift({
      id: `u-new-${++state.created}`,
      type: 'User',
      lastLogin: null,
      createdBy: 'Amara Mensah',
      ...values,
    });
    state.pager.reset();
  }

  paintUsers(state);
  modal.close();
}

/* ===================== PROVIDER ONBOARDING =====================
   The staff member record. Name and additional info on the left; the
   repeatable contact groups down the right — PROVIDER_GROUPS in
   data/practice.js, which Provider Settings ▸ Profile reads back out of.
   ========================================================================= */

/** The toast the Roles and Print tabs already share. */
function flash(message) {
  notify(message);
}

/* A row of the shape its group asks for. Most groups hold one answer under
   `value`, but Licenses holds four — a row built as a fixed {type, value}
   pair left the taxonomy and the two dates as undefined keys, which read back
   as the string "undefined" the first time one was rendered. */
function blankRow(group) {
  const row = { type: group.types[0] ?? '' };
  group.fields.forEach((field) => {
    row[field.key] = '';
  });
  return row;
}

/** Every group starts with one empty row — an empty panel reads as broken. */
function emptyProviderDraft() {
  return {
    signature: '',
    groups: Object.fromEntries(PROVIDER_GROUPS.map((g) => [g.id, [blankRow(g)]])),
  };
}

let providerDraft = emptyProviderDraft();

/**
 * One answer inside a repeatable row.
 *
 * A contact group asks for a single thing — an address, a number, an email —
 * and the placeholder carries what it is, because the row is one control wide
 * and the card title already said. A licence row asks for four, and four bare
 * boxes side by side say nothing about which date is the start and which the
 * end; a `type="date"` box does not even show its placeholder. So a
 * multi-field group prints the label above each box.
 */
function providerFieldControl(group, field, row, index) {
  const shared = `data-field="${field.key}" data-group="${group.id}" data-index="${index}"`;

  const control =
    field.kind === 'location'
      ? `<span class="ui-select-shell prv__value">
           <select ${shared} aria-label="${esc(field.label)}">
           <option value="" disabled hidden${row[field.key] ? '' : ' selected'}>Select a location</option>
           ${LOCATIONS.map(
             (l) =>
               `<option value="${esc(l.name)}"${
                 l.name === row[field.key] ? ' selected' : ''
               }>${esc(l.name)}</option>`
           ).join('')}
           </select>
           <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-down"></use></svg>
         </span>`
      : `<input class="prv__value" type="${field.type ?? 'text'}" ${shared}
           value="${esc(row[field.key])}"
           placeholder="${esc(field.label)}"
           aria-label="${esc(field.label)}" />`;

  if (group.fields.length < 2) return control;

  return `<label class="prv__field">
    <span class="prv__field-label">${esc(field.label)}</span>
    ${control}
  </label>`;
}

/**
 * Every answer in one row. A single-field group is the control on its own, so
 * the row stays the flex line the contact groups have always been; a
 * multi-field group nests its boxes in a grid of their own, which leaves the
 * remove button beside the whole block rather than inside the grid competing
 * for a cell with the End date.
 */
function providerFieldControlRow(group, row, index) {
  const controls = group.fields
    .map((field) => providerFieldControl(group, field, row, index))
    .join('');
  return group.fields.length > 1 ? `<div class="prv__fields">${controls}</div>` : controls;
}

function paintProviderGroups() {
  const host = document.getElementById('providerGroups');
  if (!host) return;

  host.innerHTML = PROVIDER_GROUPS.map((group) => {
    const rows = providerDraft.groups[group.id];

    /* ONE CONTROL, NOT A GROWING LIST OF THEM.
       A `multiple` group asks a single question with a set of answers —
       "which sites does this person work at?" — and the product already has a
       control for that shape: <ui-select multiple>, a panel of tick boxes
       whose closed field reads back everything ticked. It replaces three
       stacked single pickers that could each be left blank or set to a site
       already chosen two rows above, with nothing stopping either. No "+" in
       the header, because there is nothing to add: every site is already
       listed once. */
    if (group.multiple) {
      return `<section class="prv__card" data-group="${group.id}"
        data-testid="usr--pv-group-${group.id}">
        <header class="prv__card-head">
          <h3 class="prv__card-title">${esc(group.title)}</h3>
        </header>
        <ui-select multiple id="pvLocations" label="${esc(group.fields[0].label)}" label-hidden
          placeholder="Select the sites this person works at"
          value="${esc(rows[0]?.value ?? '')}"
          data-multi-group="${group.id}"
          data-testid="usr--pv-locations"></ui-select>
      </section>`;
    }

    return `<section class="prv__card" data-group="${group.id}"
      data-testid="usr--pv-group-${group.id}">
      <header class="prv__card-head">
        <h3 class="prv__card-title">${esc(group.title)}</h3>
        <button type="button" class="prv__add" data-add-row="${group.id}"
          aria-label="Add another ${esc(group.title.toLowerCase())} row"
          data-testid="usr--pv-add-${group.id}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-plus"></use></svg>
        </button>
      </header>

      ${rows
        .map(
          (row, index) => `<div class="prv__row${
            /* Four fields to a licence, so that row lays its answers out as a
               small labelled block instead of the single typed line the
               contact groups use. */
            group.fields.length > 1 ? ' prv__row--fields' : ''
          }" data-row="${index}">
            ${
              group.types.length
                ? `<span class="ui-select-shell prv__type">
                     <select data-field="type" data-group="${group.id}"
                     data-index="${index}" aria-label="${esc(group.title)} type">
                     ${group.types
                       .map(
                         (t) =>
                           `<option value="${esc(t)}"${
                             t === row.type ? ' selected' : ''
                           }>${esc(t)}</option>`
                       )
                       .join('')}
                     </select>
                     <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-down"></use></svg>
                   </span>`
                : group.fields[0].kind === 'location'
                ? `<span class="prv__swatch" aria-hidden="true">${swatchMarkup(
                    LOCATION_COLOURS[index % LOCATION_COLOURS.length]
                  )}</span>`
                : ''
            }

            ${providerFieldControlRow(group, row, index)}

            ${
              rows.length > 1
                ? `<button type="button" class="prv__drop" data-drop-row="${group.id}"
                     data-index="${index}"
                     aria-label="Remove this ${esc(group.title.toLowerCase())} row">
                     <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
                   </button>`
                : ''
            }
          </div>`
        )
        .join('')}
    </section>`;
  }).join('');

  host.querySelectorAll('[data-add-row]').forEach((button) =>
    button.addEventListener('click', () => {
      const group = PROVIDER_GROUPS.find((g) => g.id === button.dataset.addRow);
      providerDraft.groups[group.id].push(blankRow(group));
      paintProviderGroups();
    })
  );

  host.querySelectorAll('[data-drop-row]').forEach((button) =>
    button.addEventListener('click', () => {
      const id = button.dataset.dropRow;
      providerDraft.groups[id].splice(Number(button.dataset.index), 1);
      paintProviderGroups();
    })
  );

  host.querySelectorAll('[data-field]').forEach((control) =>
    control.addEventListener('input', () => {
      const { group, index, field } = control.dataset;
      providerDraft.groups[group][Number(index)][field] = control.value;
    })
  );

  /* The multi-select's answers, held as the one comma-joined string the rest
     of this draft already speaks — every other group stores a row's answer in
     `value`, and a set that arrived as an array would be the one shape
     commit() had to special-case. Options are set as data because a location
     name may carry a comma. */
  host.querySelectorAll('[data-multi-group]').forEach((control) => {
    control.optionList = LOCATIONS.filter((l) => l.active).map((l) => ({
      value: l.name,
      label: l.name,
    }));
    control.addEventListener('ui-change', () => {
      providerDraft.groups[control.dataset.multiGroup][0].value = control.values.join(',');
    });
  });
}

function openProviderOnboard(state, trigger) {
  const modal = document.getElementById('providerOnboardModal');
  if (!modal) return;

  providerDraft = emptyProviderDraft();

  const set = (id, value) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.setAttribute('value', value ?? '');
    const control = node.querySelector('input, select, textarea');
    if (control) control.value = value ?? '';
  };

  /* PROVIDER_TYPES, not USER_TYPES. The users table's Type column filters on
     the Provider/User split; this form asks what KIND of staff member is
     joining, which is a longer and different list. See data/practice.js. */
  document.getElementById('pvType').optionList = PROVIDER_TYPES.map((t) => ({
    value: t,
    label: t,
  }));
  /* As data, not through the `options` attribute: "APRN, CNP" is one
     credential and that attribute splits on commas. */
  document.getElementById('pvTitle').optionList = PROVIDER_TITLES.map((t) => ({
    value: t,
    label: t,
  }));
  document.getElementById('pvSpecialty').optionList = SPECIALTY_TYPES.map((s) => ({
    value: s,
    label: s,
  }));

  ['pvFirst', 'pvMiddle', 'pvLast', 'pvTitle', 'pvDob', 'pvNotes'].forEach((id) => set(id, ''));
  set('pvPrefix', 'Dr.');
  set('pvSuffix', 'MD');
  set('pvType', 'Provider');
  set('pvStatus', 'Active');
  document.getElementById('pvCertified').checked = false;
  document.getElementById('pvSignatureText').textContent = 'Upload a signature image';

  paintProviderGroups();
  modal.open(trigger);
}

function initProviderOnboard(state, trigger) {
  const modal = document.getElementById('providerOnboardModal');
  if (!modal) return;

  modal.querySelectorAll('[data-modal-dismiss]').forEach((cancel) =>
    cancel.addEventListener('ui-click', () => modal.close())
  );

  // No file picker in the prototype; the affordance and its filled state are
  // the parts that matter for the form to read correctly.
  document.getElementById('pvSignature')?.addEventListener('click', () => {
    providerDraft.signature = 'signature-sample.png';
    document.getElementById('pvSignatureText').textContent =
      'signature-sample.png — click to replace';
  });

  const commit = (invite) => {
    const first = document.getElementById('pvFirst').value.trim();
    const last = document.getElementById('pvLast').value.trim();

    // Only the name is required. A provider record that cannot be created
    // until every identifier is to hand is a record that gets created in a
    // spreadsheet instead.
    let valid = true;
    [['pvFirst', first, 'A first name is required'], ['pvLast', last, 'A last name is required']].forEach(
      ([id, value, message]) => {
        const node = document.getElementById(id);
        if (value) node.removeAttribute('error');
        else {
          node.setAttribute('error', message);
          valid = false;
        }
      }
    );
    if (!valid) return;

    const filled = (id) => providerDraft.groups[id].filter((r) => r.value.trim());
    const email = filled('emails')[0]?.value ?? '';
    const phone = filled('phones')[0]?.value ?? '';
    /* Locations arrive as one comma-joined answer from the multi-select. The
       users table shows a single Location, so the first ticked site is what it
       gets — the whole set is what was actually recorded. */
    const locations = (filled('locations')[0]?.value ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const location = locations[0] ?? LOCATIONS[0]?.name ?? '';

    state.created += 1;
    state.data.unshift({
      id: `pv${state.created}`,
      name: [document.getElementById('pvPrefix').value, first, last, document.getElementById('pvSuffix').value]
        .filter(Boolean)
        .join(' ')
        .replace(/ (MD|DO|NP|PA-C|RN|LCSW|RD|PhD)$/, ', $1'),
      email,
      phone,
      username: `${first}.${last}`.toLowerCase(),
      type: document.getElementById('pvType').value || 'Provider',
      role: document.getElementById('pvSpecialty').value || 'Physician',
      location,
      locations,
      status: invite ? 'pending' : document.getElementById('pvStatus').value === 'Active' ? 'active' : 'inactive',
      lastLogin: null,
      createdBy: 'Amara Mensah',
      permissions: [],
    });

    state.pager.reset();
    modal.close();
    paintUsers(state);

    const counts = PROVIDER_GROUPS.map((g) => filled(g.id).length).reduce((a, b) => a + b, 0);
    flash(
      `${first} ${last} added${invite ? ' and invited' : ''} — ${counts} contact record${
        counts === 1 ? '' : 's'
      } saved.`
    );
  };

  /* One save, and it invites. The silent "Save provider" button has gone —
     see the note above the actions in practice-settings.html. */
  document.querySelector('[data-testid="usr--pv-invite"]')?.addEventListener('ui-click', () =>
    commit(true)
  );
}

/* --- Assign Role — the row menu's single-user action and the bulk bar's
   multi-user action share this one dialog. --------------------------------- */

function initAssignRoleModal(state) {
  const modal = document.getElementById('assignRoleModal');
  const select = document.getElementById('assignRoleSelect');
  const save = document.querySelector('[data-testid="usr--assign-role-save"]');
  if (!modal) return;

  modal.querySelectorAll('[data-modal-dismiss]').forEach((button) =>
    button.addEventListener('ui-click', () => modal.close())
  );

  select.optionList = ALL_JOB_ROLES.map((r) => ({ value: r, label: r }));

  save?.addEventListener('ui-click', () => {
    const role = select.value;
    if (!role) {
      select.setAttribute('error', 'Pick a role');
      return;
    }
    select.removeAttribute('error');

    modal._targetIds.forEach((id) => {
      const user = findUser(state, id);
      if (user) user.role = role;
    });

    modal._table?.clearSelection();
    paintUsers(state);
    modal.close();
  });
}

function openAssignRole(state, ids, table, trigger) {
  const modal = document.getElementById('assignRoleModal');
  const context = document.getElementById('assignRoleContext');
  const select = document.getElementById('assignRoleSelect');
  if (!modal) return;

  modal._targetIds = ids;
  modal._table = table;

  const users = ids.map((id) => findUser(state, id)).filter(Boolean);
  context.textContent =
    users.length === 1
      ? `Assign a role to ${users[0].name}.`
      : `Assign a role to ${users.length} selected users.`;
  select.setAttribute('value', users.length === 1 ? users[0].role : '');
  select.removeAttribute('error');

  modal.open(trigger ?? table);
}

/* --- Manage Permissions ------------------------------------------------- */

function initPermissionsModal(state) {
  const modal = document.getElementById('permissionsModal');
  const save = document.querySelector('[data-testid="usr--permissions-save"]');
  if (!modal) return;

  modal.querySelectorAll('[data-modal-dismiss]').forEach((button) =>
    button.addEventListener('ui-click', () => modal.close())
  );

  save?.addEventListener('ui-click', () => {
    const checks = document.getElementById('permissionsChecks');
    const permissions = [...checks.querySelectorAll('[data-permission]')]
      .filter((el) => el.checked)
      .map((el) => el.dataset.permission);

    if (modal._targetUser) modal._targetUser.permissions = permissions;
    paintUsers(state);
    modal.close();
  });
}

function openManagePermissions(state, user, trigger) {
  const modal = document.getElementById('permissionsModal');
  const context = document.getElementById('permissionsContext');
  const checks = document.getElementById('permissionsChecks');
  if (!modal || !user) return;

  modal._targetUser = user;
  context.textContent = `Permissions for ${user.name}.`;
  checks.innerHTML = USER_PERMISSIONS.map(
    (p) => `<ui-checkbox data-permission="${esc(p)}" ${
      user.permissions.includes(p) ? 'checked' : ''
    }>${esc(p)}</ui-checkbox>`
  ).join('');

  modal.open(trigger);
}

/* --- Delete --------------------------------------------------------------- */

function initDeleteModal(state) {
  const modal = document.getElementById('userDeleteModal');
  const confirmButton = document.querySelector('[data-testid="usr--delete-confirm"]');
  if (!modal) return;

  modal.querySelectorAll('[data-modal-dismiss]').forEach((button) =>
    button.addEventListener('ui-click', () => modal.close())
  );

  confirmButton?.addEventListener('ui-click', () => {
    const ids = modal._targetIds ?? [];
    state.data = state.data.filter((u) => !ids.includes(u.id));
    modal._table?.clearSelection();
    paintUsers(state);
    modal.close();
  });
}

function openDeleteConfirm(state, ids, table, trigger) {
  const modal = document.getElementById('userDeleteModal');
  const text = document.getElementById('userDeleteText');
  if (!modal) return;

  modal._targetIds = ids;
  modal._table = table;

  const users = ids.map((id) => findUser(state, id)).filter(Boolean);
  text.innerHTML =
    users.length === 1
      ? `Remove <strong>${esc(users[0].name)}</strong>? Records already tied to this
         user keep what they recorded — this only stops them from signing in.`
      : `Remove <strong>${users.length} selected users</strong>? Records already tied
         to them keep what they recorded — this only stops them from signing in.`;

  modal.open(trigger ?? table);
}

/* ===================== SHARED FORM PIECES ===================== */

function addressBlock(title, values = {}, withSameAs = false) {
  return `<fieldset class="prc__section">
    <legend class="prc__section-title">
      ${title}
      ${
        withSameAs
          ? '<ui-checkbox data-testid="prc--same-as-physical">Same as Physical Address</ui-checkbox>'
          : ''
      }
    </legend>
    <div class="prc__form-grid">
      <!-- Address Line 1 · Address Line 2 · City · State · ZIP — the one
           order every address block on this system uses. -->
      <ui-input class="prc__span-2" label="Address Line 1" value="${values.line1 || ''}"
                placeholder="Street address"></ui-input>
      <ui-input label="Address Line 2" value="${values.line2 || ''}"
                placeholder="Suite, building, etc."></ui-input>
      <ui-input label="City" value="${values.city || ''}" placeholder="Enter City"></ui-input>
      <ui-select label="State" placeholder="Select State" options="${STATES.join(',')}"
                 value="${values.state || ''}"></ui-select>
      <ui-input label="ZIP" value="${values.zip || ''}" placeholder="Enter ZIP"></ui-input>
    </div>
  </fieldset>`;
}

function officeHoursBlock(hours) {
  return `<div>
    <p class="prc__legend">Practice Office Hours</p>
    <div class="prc__section">
      <div class="prc__hours-edit" data-testid="prc--hours-edit">
        ${hours
          .map(
            (h) => `<div class="prc__hours-edit-row">
              <ui-toggle ${h.open ? 'checked' : ''}
                data-testid="prc--hours-${h.day.toLowerCase()}">${h.day}</ui-toggle>
              <ui-input type="time" label="${h.day} from" label-hidden
                        value="${h.from}" ${h.open ? '' : 'disabled'}></ui-input>
              <ui-input type="time" label="${h.day} to" label-hidden
                        value="${h.to}" ${h.open ? '' : 'disabled'}></ui-input>
            </div>`
          )
          .join('')}
      </div>
    </div>
  </div>`;
}

/**
 * Both dialogs live in the DOM at once, so every id here is namespaced.
 * Two elements sharing an id is not just untidy — it is an accessibility
 * failure and it makes getElementById pick the wrong one.
 */
function idQualifierBlock(prefix) {
  return `<div>
    <div class="prc__repeater-head">
      <span class="ui-field__label">ID Qualifier</span>
      <ui-button variant="tertiary" size="xs" icon="plus" data-testid="prc--add-qualifier"
        >Add</ui-button
      >
    </div>
    <div id="${prefix}-qualifierRows">
      <div class="prc__repeater-row">
        <ui-select label="Qualifier" label-hidden placeholder="Select"
                   options="${ID_QUALIFIERS.join(',')}"></ui-select>
        <ui-input label="Number" label-hidden placeholder="Enter Number"></ui-input>
        <button type="button" class="set__icon-danger" data-remove-qualifier
                aria-label="Remove this qualifier">
          <svg class="ui-icon"><use href="#i-trash"></use></svg>
        </button>
      </div>
    </div>
  </div>`;
}

/** Wire the pieces every long form shares. */
function wireSharedForm(root, modal) {
  // "Same as Physical Address" copies the physical block into billing.
  root.querySelector('[data-testid="prc--same-as-physical"]')
    ?.addEventListener('ui-change', (event) => {
      const blocks = root.querySelectorAll('.prc__section');
      const [physical, billing] = blocks;
      if (!event.detail.checked || !physical || !billing) return;
      const from = physical.querySelectorAll('ui-input, ui-select');
      const to = billing.querySelectorAll('ui-input, ui-select');
      to.forEach((field, i) => {
        if (from[i]) field.setAttribute('value', from[i].value ?? '');
      });
    });

  // A day toggle enables or disables that day's two time fields.
  root.querySelectorAll('[data-testid^="prc--hours-"]').forEach((toggle) =>
    toggle.addEventListener('ui-change', (event) => {
      const row = toggle.closest('.prc__hours-edit-row');
      row.querySelectorAll('ui-input').forEach((field) => {
        if (event.detail.checked) field.removeAttribute('disabled');
        else field.setAttribute('disabled', '');
      });
    })
  );

  // ID Qualifier repeater — scoped to this form, never document-wide.
  const rows = root.querySelector('[id$="-qualifierRows"]');
  root.querySelector('[data-testid="prc--add-qualifier"]')
    ?.addEventListener('ui-click', () => {
      const clone = rows.firstElementChild.cloneNode(true);
      clone.querySelectorAll('ui-input, ui-select').forEach((f) => f.setAttribute('value', ''));
      // cloneNode copies data-wired too, which would make the new row's
      // delete button look already-wired and silently do nothing.
      clone.querySelectorAll('[data-wired]').forEach((el) => delete el.dataset.wired);
      rows.appendChild(clone);
      wireQualifierRemoval(rows);
    });
  wireQualifierRemoval(rows);

  root.querySelectorAll('[data-modal-dismiss]').forEach((button) =>
    button.addEventListener('ui-click', () => modal.close())
  );
}

function wireQualifierRemoval(rows) {
  rows?.querySelectorAll('[data-remove-qualifier]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = 'true';
    button.addEventListener('click', () => {
      // Always keep one row so the field set stays usable.
      if (rows.children.length > 1) button.closest('.prc__repeater-row').remove();
    });
  });
}

/* ===================== MODALS ===================== */

/**
 * Build the Edit Details form against whichever profile is active.
 *
 * Split out of initProfileModal so the switcher can call it again: the dialog
 * is built from a profile's values, and after a switch those values are a
 * different entity's. Rebuilding is cheaper — and much harder to get subtly
 * wrong — than walking every field to update it in place.
 */
function rebuildProfileModal() {
  const modal = document.getElementById('profileModal');
  const form = document.getElementById('profileForm');
  if (!form || !modal) return;
  const p = PRACTICE;

  form.innerHTML = `
    <div class="prc__form-grid">
      <div>
        <span class="ui-field__label">Add Practice Logo</span>
        <div class="prc__logo" data-testid="prc--profile-logo">
          <svg class="ui-icon"><use href="#i-plus"></use></svg>
        </div>
      </div>
      <ui-input class="prc__span-2" label="${esc(p.label)} Practice Name" value="${esc(p.name)}"
                placeholder="Enter Practice Name" required
                data-testid="prc--practice-name"></ui-input>

      <ui-input label="Contact Number" value="${p.phone}" placeholder="Enter Contact Number"></ui-input>
      <ui-input label="Contact Person" value="${p.contactPerson}" placeholder="Enter Contact Person Name"></ui-input>
      <ui-select label="Place of Service" placeholder="Select Place of Service"
                 options="${PLACES_OF_SERVICE.join(',')}" value="${p.placeOfService}"></ui-select>

      <ui-select label="Specialty Type" placeholder="Select Specialty Type"
                 options="${SPECIALTY_TYPES.join(',')}" value="${p.type}"></ui-select>
      <ui-input label="Email Id" type="email" value="${p.email}" placeholder="Enter Email Id"></ui-input>
      <ui-input label="Website" value="${p.website}" placeholder="Enter Website"></ui-input>

      <!-- NO TIME ZONE FIELD. The practice has a zone and one screen reads
           it — the pre-check form stamps its timestamps in the facility's
           zone — but it is not a thing an office manager sets on a form. It is
           where the building is, it changes when the practice opens a site in
           another state and not before, and a dropdown offering to change it
           put the stamp on every pre-check within one mis-click of a time
           nobody in the building would recognise. It stays on the practice
           record in data/practice.js, where the one reader finds it. -->
      <ui-input label="Group NPI Number" value="${p.npi}" placeholder="Enter Group NPI Number"></ui-input>
      <ui-input label="Fax Id" value="${p.fax}" placeholder="Enter Fax Id"></ui-input>

      <ui-input class="prc__span-all" label="Information" value="${p.information}"
                placeholder="Enter Information"></ui-input>
    </div>

    ${idQualifierBlock('profile')}

    <div>
      <p class="prc__legend">Address</p>
      ${addressBlock('Physical Address', p.physicalAddress)}
      ${addressBlock('Billing Address', p.billingAddress, true)}
    </div>

    ${officeHoursBlock(p.officeHours)}

    <div class="ui-modal__actions">
      <ui-button variant="outline" data-modal-dismiss>Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-testid="prc--save-profile">Save</ui-button>
    </div>`;

  wireSharedForm(form, modal);

  form.querySelector('[data-testid="prc--save-profile"]')
    ?.addEventListener('ui-click', () => modal.close());
}

function initProfileModal(trigger) {
  const modal = document.getElementById('profileModal');
  rebuildProfileModal();
  trigger?.addEventListener('ui-click', () => modal.open(trigger));
}

/* ===================== LOCATION PAGE ===================== */

/**
 * Adding a location opens its own page rather than a dialog. The Location
 * Form has eleven panels; in a dialog that produced a scrollbar inside a
 * scrollbar, and the sticky Save sat on top of the fields it applied to.
 */
function initLocationPage(trigger) {
  trigger?.addEventListener('ui-click', () => {
    window.location.href = 'location-add.html';
  });
}
