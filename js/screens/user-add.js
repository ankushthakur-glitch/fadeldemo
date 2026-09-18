/**
 * Add / edit a user — the gGastro User Form, rebuilt.
 *
 * Left:  who they are, what signing a document requires of them, and when they
 *        are allowed to sign in.
 * Right: which groups they belong to.
 *
 * NOBODY SETS ANOTHER PERSON'S PASSWORD HERE. The Login Information block —
 * username, password, confirmation, strength meter — has gone: whoever fills
 * this form in is not the person who will sign in with it, and setting
 * somebody else's password means telling them what it is, which is how a
 * shared credential starts. An invited user chooses their own on the way in.
 *
 * ?id=<userId> edits an existing user; without it, a blank one.
 */
import {
  USERS,
  USER_ROLES,
  AUTH_MODES,
  USER_GROUPS,
  LOCATIONS,
} from '../../data/practice.js';

const BACK = 'practice-settings.html?tab=users';

/* No strengthOf() any more. It scored a password this form no longer takes —
   see the note at the top of this file. */

customElements.whenDefined('ui-data-table').then(() => {
  const form = document.getElementById('userForm');
  const title = document.querySelector('[data-testid="usr--title"]');
  const status = document.getElementById('formStatus');
  const save = document.querySelector('[data-testid="usr--save"]');
  const cancel = document.querySelector('[data-testid="usr--cancel"]');
  if (!form) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const user = id ? USERS.find((u) => u.id === id) : null;
  const [firstName = '', lastName = ''] = (user?.name || '').split(' ');

  if (user) {
    title.textContent = `Edit ${user.name}`;
    document.title = `MediNova EHR — ${user.name}`;
  }

  form.innerHTML = `
    <div class="prc__loc-cols">
      <!-- ============ LEFT ============ -->
      <div class="prc__loc-col">
        <section class="prc__mini">
          <div class="prc__mini-head"><span>User Form</span></div>
          <div class="prc__form-grid prc__mini-body">
            <ui-input label="First Name" value="${firstName}" required
                      data-testid="usr--first-name"></ui-input>
            <ui-input label="Middle Name"></ui-input>
            <ui-input label="Last Name" value="${lastName}" required
                      data-testid="usr--last-name"></ui-input>

            <ui-input label="Date of Birth" type="date"></ui-input>
            <ui-input class="prc__span-2" label="Email" type="email"
                      value="${user?.email || ''}" required
                      data-testid="usr--email"></ui-input>

            <ui-select class="prc__span-2" label="Role" placeholder="Select Role"
                       options="${USER_ROLES.join(',')}" value="${user?.role || ''}"
                       required data-testid="usr--role"></ui-select>
            <ui-select label="Status" options="Active,Inactive"
                       value="${user && user.status === 'active' ? 'Active' : 'Inactive'}"
                       data-testid="usr--status"></ui-select>
            <!-- WHERE THIS PERSON WORKS. The practice runs a clinic and a
                 surgery centre with different rosters, and until this field
                 existed the record could not tell a scheduler at one from a
                 scheduler at the other. Active sites only — nobody is
                 onboarded into a location that has closed. -->
            <ui-select label="Location" placeholder="Select Location"
                       options="${LOCATIONS.filter((l) => l.active).map((l) => l.name).join(',')}"
                       value="${user?.location || ''}"
                       data-testid="usr--location"></ui-select>
          </div>
        </section>

        <!-- NO LOGIN INFORMATION SECTION.
             A username, a password, a confirmation and a strength meter stood
             here, on a form that creates a user who has not accepted an
             invitation yet. Whoever fills this in is not the person who will
             sign in with it: setting somebody else's password means telling
             them what it is, which is how a shared credential starts. An
             invited user chooses their own on the way in, and the two things
             this block asked that were NOT credentials — the sign-in alert and
             the break-the-glass grant — belong with permissions, which is
             where they are already answered. -->

        <section class="prc__mini">
          <div class="prc__mini-head">
            <span>Authentication for signing and locking documents</span>
          </div>
          <div class="prc__mini-body">
            <ui-radio-group
              label="Sign-in requirement"
              label-hidden
              options="${AUTH_MODES.map((m) => m.label).join(',')}"
              value="Use Organization Preference"
              data-testid="usr--auth-mode"
            ></ui-radio-group>
          </div>
        </section>

        <section class="prc__mini">
          <div class="prc__mini-head">
            <span>Login Restrictions</span>
            <button type="button" class="set__add-block" data-mini-add="restrictions"
                    aria-label="Add a login restriction">
              <svg class="ui-icon"><use href="#i-plus"></use></svg>
            </button>
          </div>
          <div class="prc__mini-body">
            <table class="prc__mini-table" id="restrictionTable">
              <thead>
                <tr>
                  <th scope="col">Date from</th>
                  <th scope="col">Date to</th>
                  <th scope="col">Time from</th>
                  <th scope="col">Time to</th>
                  <th scope="col"><span class="u-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr><td class="prc__mini-empty" colspan="5">No restrictions — sign in any time.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="prc__mini">
          <div class="prc__mini-head"><span>Last Login / Logout</span></div>
          <div class="prc__mini-body">
            <dl class="prc__kv">
              <dt>Logged in</dt><dd>${user?.lastLogin || '<span class="prc__muted">Never</span>'}</dd>
              <dt>Logged out</dt><dd><span class="prc__muted">—</span></dd>
            </dl>
          </div>
        </section>
      </div>

      <!-- ============ RIGHT ============ -->
      <div class="prc__loc-col">
        <!-- The Locations picker that used to head this column is gone
             (RM-048). It made every user tick the sites they belonged to, and
             the practice is a single entity — everybody belonged to all of
             them, so the answer carried no information and the ticking was
             pure onboarding tax. Groups stays: a group really is a subset of
             the roster, and which ones somebody is in is a genuine question
             with different answers per person. -->
        <section class="prc__mini">
          <div class="prc__mini-head"><span>Groups</span></div>
          <div class="prc__mini-body prc__pick-list" data-testid="usr--groups">
            ${USER_GROUPS.map(
              (group) => `<div class="prc__pick">
                <span class="prc__pick-body">
                  <ui-checkbox data-group="${group.name}">${group.name}</ui-checkbox>
                  <small>${group.users} users</small>
                </span>
              </div>`
            ).join('')}
          </div>
        </section>
      </div>
    </div>`;

  /* --- Login restrictions -------------------------------------------------- */

  const restrictionBody = form.querySelector('#restrictionTable tbody');

  form.querySelector('[data-mini-add="restrictions"]')?.addEventListener('click', () => {
    if (restrictionBody.querySelector('.prc__mini-empty')) restrictionBody.innerHTML = '';
    restrictionBody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td><ui-input type="date" label="Date from" label-hidden></ui-input></td>
        <td><ui-input type="date" label="Date to" label-hidden></ui-input></td>
        <td><ui-input type="time" label="Time from" label-hidden></ui-input></td>
        <td><ui-input type="time" label="Time to" label-hidden></ui-input></td>
        <td class="prc__mini-actions">
          <button type="button" class="set__icon-danger" data-remove-restriction
                  aria-label="Remove this restriction">
            <svg class="ui-icon"><use href="#i-trash"></use></svg>
          </button>
        </td>
      </tr>`
    );
    wireRestrictionRemoval();
  });

  function wireRestrictionRemoval() {
    restrictionBody.querySelectorAll('[data-remove-restriction]').forEach((button) => {
      if (button.dataset.wired) return;
      button.dataset.wired = 'true';
      button.addEventListener('click', () => {
        button.closest('tr').remove();
        if (!restrictionBody.children.length) {
          restrictionBody.innerHTML =
            '<tr><td class="prc__mini-empty" colspan="5">No restrictions — sign in any time.</td></tr>';
        }
      });
    });
  }

  /* --- Save ---------------------------------------------------------------- */

  const REQUIRED = [
    ['usr--first-name', 'First name'],
    ['usr--last-name', 'Last name'],
    ['usr--email', 'Email'],
  ];

  save?.addEventListener('ui-click', () => {
    const missing = REQUIRED.filter(
      ([testid]) => !form.querySelector(`[data-testid="${testid}"]`)?.value.trim()
    );
    const role = form.querySelector('[data-testid="usr--role"]');
    const roleMissing = !role.value;

    form.querySelectorAll('[data-testid^="usr--"]').forEach((f) => f.removeAttribute?.('error'));

    if (missing.length || roleMissing) {
      const count = missing.length + (roleMissing ? 1 : 0);
      status.textContent = `${count} required field${count > 1 ? 's' : ''} still to complete.`;
      if (roleMissing) role.setAttribute('error', 'Pick a role');
      missing.forEach(([testid, name]) =>
        form.querySelector(`[data-testid="${testid}"]`).setAttribute('error', `${name} is required`)
      );
      form.querySelector(`[data-testid="${missing[0]?.[0] || 'usr--role'}"]`)?.focus();
      return;
    }

    status.textContent = '';
    window.location.href = BACK;
  });

  cancel?.addEventListener('ui-click', () => {
    window.location.href = BACK;
  });
});
