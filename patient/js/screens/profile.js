/**
 * PROFILE — the record, and the two things you can do to it.
 *
 * Called Settings until now, with Notification Setting beside it under a
 * chevron. Notification Setting was never drawn, so the group held one real
 * destination behind a disclosure — the same trade Medications and Messages
 * already refused. What is left is one nav row named for what it holds, and
 * the second tab, Insurance, arrives from Billing (see lib/profile-tabs.js).
 *
 * PASSWORD IS A BUTTON, NOT A TAB.
 *
 * It was a tab, and the panel behind it read "Password ·········" — the mask
 * and nothing else, because a password is the one field a portal must never
 * show back. So the tab cost a page load to display no information, and the
 * only thing to do once you arrived was press Change Password in the corner.
 * The button is the tab's entire purpose, so it sits beside Edit Profile where
 * the record it changes is, and the detour is gone. Neither is solid: nothing
 * on this screen is a primary action, and a filled button would claim one of
 * them is.
 *
 * BOTH BUTTONS ARE HANDED TO THE TAB BAR rather than drawn on a row of their
 * own. They used to sit in a .pp-actions strip under the tabs, which spent a
 * whole band of height on two buttons; the reference draws the section name,
 * the tabs and the buttons on one line. See lib/profile-tabs.js.
 *
 * The remaining tab is a LINK to profile-insurance.html, not a button that
 * swaps a panel. Each view is a page: Back works between them, and a reviewer
 * can send a colleague straight to the one they mean.
 */

import { mountShell } from '../lib/shell.js';
import { profileTabs } from '../lib/profile-tabs.js';
import { icon } from '../lib/icons.js';
import { esc, initials } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { PATIENT, EMERGENCY_CONTACT } from '../../data/patient.js';

document.addEventListener('DOMContentLoaded', () => {
  const session = mountShell({ active: 'profile' });
  if (!session) return;

  const host = document.getElementById('screen');
  host.innerHTML = `<div id="tabs"></div>${profile()}`;

  /*
   * The buttons go INTO the tab bar, not on a row of their own beneath it.
   *
   * Change Password comes first because Edit Profile is the one that acts on
   * the panel directly below, and the button nearest a thing should be the one
   * that changes it. Full height, not --sm: they share the line with the tab
   * group, which stands a button's height itself, and a short button beside it
   * makes the row look like it is holding two sizes of the same control.
   *
   * Neither is solid. Nothing on this screen is a primary action, and a filled
   * button would claim one of them is.
   */
  profileTabs(host.querySelector('#tabs'), 'profile', {
    actions: `
      <button type="button" class="pp-btn pp-btn--neutral" data-password
        data-testid="profile--password">
        ${icon('lock', { size: 'sm' })}
        <span>Change Password</span>
      </button>

      <button type="button" class="pp-btn pp-btn--outline" data-edit
        data-testid="profile--edit">
        ${icon('edit', { size: 'sm' })}
        <span>Edit Profile</span>
      </button>
    `,
  });

  host.querySelector('[data-edit]').addEventListener('click', () => {
    toast('This would make the fields below editable and add Save and Cancel.');
  });

  host.querySelector('[data-password]').addEventListener('click', () => {
    toast('This would ask for your current password, then a new one twice.');
  });
});

/* ============================================================================
   PROFILE

   One panel, two bands, a rule between them — as drawn.

   The portrait sits BESIDE the record's own fields and the emergency contact
   runs the full width beneath it. That is the reference's layout and it is
   the right one: the photograph belongs to the patient, so the block it is
   level with should be the patient's, and the contact block gets the whole
   width to put its four short pairs on one line instead of two.
   ========================================================================= */

function profile() {
  return `
    <section class="pp-card pp-profile" data-testid="profile--details">
      <h2 class="pp-profile__title">Profile Details</h2>

      <div class="pp-profile__identity">
        <span class="pp-profile__portrait" aria-hidden="true"
          >${esc(initials(PATIENT.name))}</span>

        <dl class="pp-profile__grid">
          <dt>Name</dt><dd>${esc(PATIENT.name)}</dd>
          <dt>Email ID</dt><dd>${esc(PATIENT.email)}</dd>

          <dt>Contact Number</dt><dd>${esc(PATIENT.phone)}</dd>
          <dt>Gender</dt><dd>${esc(PATIENT.gender)}</dd>

          <dt>DOB</dt><dd>${esc(PATIENT.dob)}</dd>
          <dt>Languages</dt><dd>${esc(PATIENT.languages)}</dd>

          <dt>Race</dt><dd>${esc(PATIENT.race)}</dd>
          <dt>Ethnicity</dt><dd>${esc(PATIENT.ethnicity)}</dd>

          <dt>Address</dt><dd>${esc(PATIENT.address)}</dd>
          <dt>SSN</dt><dd>${esc(PATIENT.ssn)}</dd>
        </dl>
      </div>

      <div class="pp-profile__section">
        <h2 class="pp-profile__title">Emergency Contact Details</h2>

        <dl class="pp-profile__grid pp-profile__grid--three">
          <dt>Name</dt><dd>${esc(EMERGENCY_CONTACT.name)}</dd>
          <dt>Contact Number</dt><dd>${esc(EMERGENCY_CONTACT.phone)}</dd>
          <dt>Email ID</dt><dd>${esc(EMERGENCY_CONTACT.email)}</dd>

          <dt>Relationship</dt><dd>${esc(EMERGENCY_CONTACT.relationship)}</dd>
        </dl>
      </div>
    </section>
  `;
}
