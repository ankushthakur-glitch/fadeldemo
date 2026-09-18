/**
 * Support persons on the Add Patient form.
 *
 * A support person is one record carrying two INDEPENDENT permissions:
 *
 *     Emergency Contact  → may be RUNG in an emergency
 *     HIPAA Approved     → may be TOLD clinical information
 *
 * They are not the same thing and the difference matters. A neighbour who
 * drives the patient home is an emergency contact and nothing more; an adult
 * daughter who rings for results is a HIPAA contact. Recording them as one
 * undifferentiated "contact" is how the wrong person is told a diagnosis.
 *
 * The drawer used to ask this as a single required three-way radio group —
 * Emergency Contact / HIPAA Contact / Both. "Both" was not a third kind of
 * person, it was the word a radio group has to invent when the real answer is
 * "yes to each", and the fourth combination — neither, the relative who is on
 * the record so the chart knows he exists — could not be recorded at all. Two
 * checkboxes say all four without a synthetic option, and each one is answered
 * on its own.
 *
 * Neither box is pre-ticked. An access permission nobody granted must never
 * arrive granted, and a blank is a question that has not been answered rather
 * than an answer of "no" — which is why the table prints "None recorded"
 * rather than an empty cell.
 *
 * The table still shows the permissions as badges rather than ticks: whoever
 * opens this record in a hurry needs to see the answer, not infer it.
 */
import {
  SUPPORT_PERMISSIONS,
  SUPPORT_RELATIONSHIPS,
} from '../../data/patient-form.js';

const removeButton = (id) =>
  `<button type="button" class="ap__row-remove" data-remove="${id}" aria-label="Remove">
     <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
   </button>`;

export function initSupportPersons() {
  const table = document.getElementById('supportPersons');
  const modal = document.getElementById('supportModal');
  const addButton = document.querySelector('[data-testid="add--new-support"]');
  const saveButton = document.querySelector('[data-testid="support--save"]');

  const relationship = document.getElementById('supportRelationship');
  if (!table || !modal) return;

  const field = (testid) => document.querySelector(`[data-testid="${testid}"]`);

  /** The two permission boxes, in the order the drawer prints them. */
  const permissionBoxes = () =>
    SUPPORT_PERMISSIONS.map((permission) => ({
      permission,
      box: field(`support--${permission.key}`),
    }));

  /* Starts empty: a support person is asked for at the desk, not assumed. */
  let people = [];

  /* ===== The form ========================================================= */

  relationship.setAttribute('options', SUPPORT_RELATIONSHIPS.join(','));

  /* ===== The table ======================================================== */

  /**
   * What this person may do, as badges.
   *
   * Both permissions off is a real and common answer — it is how a relative
   * who is simply on the record is stored — so it is spelled out rather than
   * left as an empty cell, which reads as a value that failed to render.
   */
  function permissionBadges(row) {
    const granted = SUPPORT_PERMISSIONS.filter((permission) => row[permission.key]);
    if (!granted.length) return '<span class="ap__stacked"><small>None recorded</small></span>';
    return granted
      .map(
        (permission) =>
          `<ui-badge status="${permission.status}">${permission.short}</ui-badge>`
      )
      .join(' ');
  }

  const COLUMNS = [
    {
      key: 'name',
      label: 'Name',
      truncate: true,
      render: (row) =>
        `<span class="ap__stacked">${row.name}<small>${row.relationship}</small></span>`,
    },
    { key: 'phone', label: 'Contact number' },
    { key: 'email', label: 'E-mail', truncate: true },
    { key: 'permissions', label: 'Permissions', render: permissionBadges },
    { key: 'remove', label: '', actions: true, render: (row) => removeButton(row.id) },
  ];

  function paint() {
    table.columns = COLUMNS;
    table.rows = people;
    table.setAttribute('state', people.length ? 'ready' : 'empty');

    table.querySelectorAll('[data-remove]').forEach((button) =>
      button.addEventListener('click', () => {
        people = people.filter((p) => p.id !== button.dataset.remove);
        paint();
      })
    );
  }

  /* ===== Add ============================================================== */

  /** Wipe the form so the next support person does not inherit the last one. */
  function resetForm() {
    for (const testid of [
      'support--first-name',
      'support--last-name',
      'support--phone',
      'support--email',
    ]) {
      field(testid)?.setAttribute('value', '');
      field(testid)?.removeAttribute('error');
    }
    relationship.setAttribute('value', '');
    // Both permissions come back off. A drawer that opened with the last
    // person's access already ticked would grant it to the next one by
    // inheritance.
    permissionBoxes().forEach(({ box }) => {
      if (box) box.checked = false;
    });
  }

  addButton?.addEventListener('ui-click', () => {
    resetForm();
    modal.open(addButton);
  });

  saveButton?.addEventListener('ui-click', () => {
    const first = field('support--first-name');
    const last = field('support--last-name');
    const phone = field('support--phone');

    /* Each of the four is checked separately so the message names the field
       that is actually missing. "Please complete the form" makes the reader
       hunt for it. */
    let ok = true;
    const require = (el, message) => {
      if (el.value?.trim()) {
        el.removeAttribute('error');
        return;
      }
      el.setAttribute('error', message);
      ok = false;
    };

    require(first, 'First name is required');
    require(last, 'Last name is required');
    require(relationship, 'Choose how this person is related to the patient');
    require(phone, 'A contact number is required — this is who gets rung');

    if (!ok) return;

    /* NEITHER PERMISSION IS REQUIRED. Both unticked records a person the chart
       knows about and tells nothing, which is a legitimate entry — the old
       required designation forced the desk to grant one of them to get past
       Save, which is the opposite of what an access decision should do. */
    const permissions = Object.fromEntries(
      permissionBoxes().map(({ permission, box }) => [permission.key, Boolean(box?.checked)])
    );

    people = [
      ...people,
      {
        id: `sp${people.length + 1}`,
        name: `${first.value.trim()} ${last.value.trim()}`,
        relationship: relationship.value,
        phone: phone.value.trim(),
        email: field('support--email')?.value?.trim() || '—',
        ...permissions,
      },
    ];

    paint();
    modal.close();
  });

  modal.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) modal.close();
  });

  paint();
}
