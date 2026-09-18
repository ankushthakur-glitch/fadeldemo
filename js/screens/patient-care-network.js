/**
 * Providers and pharmacies on the Add Patient form.
 *
 * Both are PICKED from a directory now. Pharmacies always were; providers
 * were typed, one first name and one last name at a time, which is how the
 * same referring clinician came to sit on three patients as "Dr Helena Ward",
 * "Helena Ward MD" and "H. Ward" — three strings that join to nothing and
 * search as none of each other. The clinicians this practice works with are a
 * catalogue like the pharmacies are, so the drawer offers the catalogue, fills
 * the specialty and contact details from the record chosen, and keeps a
 * free-text way out for the PCP three states away who genuinely is not on it.
 *
 * PROVIDERS used to be two sections: a collapsible "Providers" panel holding
 * the PCP, and a full "Referring Physicians" table below it. They held the
 * same kind of person, so a PCP who had also sent the referral was entered
 * twice — two records that could drift apart, with nothing saying which one
 * the letter should go to. They are one list now, and `role` is what tells a
 * referrer from a PCP.
 */
import {
  PHARMACIES,
  PHARMACY_TYPES,
  PATIENT_PROVIDERS,
  PROVIDER_ROLES,
  PROVIDER_DIRECTORY,
  providerFromDirectory,
  SPECIALTIES,
} from '../../data/pharmacies.js';

/** The value the Provider picker uses for "not on this list" — see the
 *  `free-text` attribute on #providerName in patient-add.html. */
const PROVIDER_OTHER = '__other';

const removeButton = (id) =>
  `<button type="button" class="ap__row-remove" data-remove="${id}" aria-label="Remove">
     <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
   </button>`;

export function initCareNetwork() {
  /* ===================== PHARMACIES ===================== */

  const pharmacyTable = document.getElementById('pharmacies');
  const pharmacyModal = document.getElementById('pharmacyModal');
  const results = document.getElementById('pharmacyResults');
  const countLabel = document.querySelector('[data-testid="pharmacy--count"]');
  const nameFilter = document.querySelector('[data-testid="pharmacy--filter-name"]');
  const typeSelect = document.getElementById('pharmacyType');
  const addPharmacy = document.querySelector('[data-testid="add--new-pharmacy"]');

  // Selected pharmacies for THIS patient — starts empty.
  let selected = [];

  typeSelect.setAttribute('options', PHARMACY_TYPES.join(','));
  typeSelect.setAttribute('value', 'All types');

  const SELECTED_COLUMNS = [
    { key: 'name', label: 'Pharmacy', truncate: true,
      render: (row) => `<span class="ap__stacked">${row.name}<small>${row.address}, ${row.city}</small></span>` },
    { key: 'type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'rcopia', label: 'RCopia ID' },
    { key: 'remove', label: '', actions: true, render: (row) => removeButton(row.id) },
  ];

  function paintSelected() {
    pharmacyTable.columns = SELECTED_COLUMNS;
    pharmacyTable.rows = selected;
    pharmacyTable.setAttribute('state', selected.length ? 'ready' : 'empty');

    pharmacyTable.querySelectorAll('[data-remove]').forEach((button) =>
      button.addEventListener('click', () => {
        selected = selected.filter((p) => p.id !== button.dataset.remove);
        paintSelected();
      })
    );
  }

  const RESULT_COLUMNS = [
    { key: 'flags', label: 'E-Rx',
      render: (row) =>
        `<span class="ap__rx-flags">${row.flags
          .map((f) => `<span class="ap__rx-flag">${f}</span>`)
          .join('')}</span>` },
    { key: 'name', label: 'Name', truncate: true,
      render: (row) => `<span class="ap__stacked">${row.name}<small>${row.address}, ${row.city}</small></span>` },
    { key: 'phone', label: 'Phone' },
    { key: 'fax', label: 'Fax' },
    { key: 'rcopia', label: 'RCopia ID' },
    { key: 'select', label: '', actions: true,
      render: (row) =>
        `<button type="button" class="ui-btn ui-btn--outline ui-btn--xs" data-select="${row.id}">Select</button>` },
  ];

  function paintResults() {
    const name = (nameFilter.value || '').toLowerCase();
    const type = typeSelect.value;

    const rows = PHARMACIES.filter((p) => {
      const matchesName = !name || p.name.toLowerCase().includes(name);
      const matchesType = !type || type === 'All types' || p.type === type;
      const notAlreadyAdded = !selected.some((s) => s.id === p.id);
      return matchesName && matchesType && notAlreadyAdded;
    });

    results.columns = RESULT_COLUMNS;
    results.rows = rows;
    results.setAttribute('state', rows.length ? 'ready' : 'empty');
    countLabel.textContent = `${rows.length} of ${PHARMACIES.length} pharmacies`;

    results.querySelectorAll('[data-select]').forEach((button) =>
      button.addEventListener('click', () => {
        const pharmacy = PHARMACIES.find((p) => p.id === button.dataset.select);
        selected = [...selected, pharmacy];
        paintSelected();
        paintResults();
      })
    );
  }

  addPharmacy?.addEventListener('ui-click', () => {
    paintResults();
    pharmacyModal.open(addPharmacy);
  });

  nameFilter?.addEventListener('ui-input', paintResults);
  typeSelect?.addEventListener('ui-change', paintResults);

  pharmacyModal?.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) pharmacyModal.close();
  });

  /* ===================== PROVIDERS ===================== */

  const providerTable = document.getElementById('providers');
  const providerModal = document.getElementById('providerModal');
  const addProvider = document.querySelector('[data-testid="add--new-provider"]');
  const saveProvider = document.querySelector('[data-testid="provider--save"]');
  const specialty = document.getElementById('providerSpecialty');
  const role = document.getElementById('providerRole');
  const providerName = document.getElementById('providerName');
  const institution = document.getElementById('providerInstitution');
  const providerPhone = document.getElementById('providerPhone');
  const providerEmail = document.getElementById('providerEmail');

  specialty.setAttribute('options', SPECIALTIES.join(','));
  role.setAttribute('options', PROVIDER_ROLES.join(','));
  role.setAttribute('value', 'Referring');

  /* The catalogue, plus the way out of it. Set as data rather than through the
     `options` attribute: that attribute splits on commas, and half these names
     carry one ("Olivia Rhye, MD"). "Someone else" is last because it is the
     exception, and it is spelled as a sentence rather than "Other" so that
     choosing it reads as a decision rather than a category. */
  if (providerName) {
    providerName.optionList = [
      ...PROVIDER_DIRECTORY.map((p) => ({
        value: p.id,
        label: `${p.name} — ${p.specialty}`,
      })),
      { value: PROVIDER_OTHER, label: 'Someone else — type the name' },
    ];
  }

  /**
   * Choosing a clinician fills in what the record already knows about them.
   *
   * Filled, not locked. A referrer who has moved practice is corrected here
   * and the correction stays on this patient — the catalogue is a starting
   * point, not an authority the registrar has to fight. Stepping out to
   * free text clears the four fields rather than leaving the last clinician's
   * practice and phone number attached to a name that is not theirs.
   */
  function applyProviderChoice(value) {
    const chosen = providerFromDirectory(value);
    specialty.setAttribute('value', chosen?.specialty ?? '');
    if (institution) institution.setAttribute('value', chosen?.institution ?? '');
    if (providerPhone) providerPhone.setAttribute('value', chosen?.phone ?? '');
    if (providerEmail) providerEmail.setAttribute('value', chosen?.email ?? '');
  }

  providerName?.addEventListener('ui-change', (event) => {
    providerName.removeAttribute('error');
    applyProviderChoice(event.detail.value);
  });

  let providers = [...PATIENT_PROVIDERS];

  /** Primary care is the one a clinician looks for first, so it is marked. */
  const ROLE_STATUS = { 'Primary care': 'info' };

  const PROVIDER_COLUMNS = [
    { key: 'role', label: 'Role',
      render: (row) =>
        `<ui-badge status="${ROLE_STATUS[row.role] ?? 'neutral'}">${row.role}</ui-badge>` },
    { key: 'name', label: 'Name', truncate: true,
      render: (row) => `<span class="ap__stacked">${row.name}<small>${row.institution || '—'}</small></span>` },
    { key: 'specialty', label: 'Specialty' },
    { key: 'phone', label: 'Contact' },
    { key: 'email', label: 'Email', truncate: true },
    { key: 'status', label: 'Status',
      render: (row) =>
        `<ui-badge status="${row.status === 'Active' ? 'success' : 'neutral'}">${row.status}</ui-badge>` },
    { key: 'remove', label: '', actions: true, render: (row) => removeButton(row.id) },
  ];

  function paintProviders() {
    providerTable.columns = PROVIDER_COLUMNS;
    providerTable.rows = providers;
    providerTable.setAttribute('state', providers.length ? 'ready' : 'empty');

    providerTable.querySelectorAll('[data-remove]').forEach((button) =>
      button.addEventListener('click', () => {
        providers = providers.filter((p) => p.id !== button.dataset.remove);
        paintProviders();
      })
    );
  }

  addProvider?.addEventListener('ui-click', () => {
    /* Blank every time. A drawer that reopened on the last clinician added
       would attach them to the next patient by inheritance. */
    providerName?.setAttribute('free-text-value', '');
    providerName?.setAttribute('value', '');
    providerName?.removeAttribute('error');
    applyProviderChoice('');
    providerModal.open(addProvider);
  });

  saveProvider?.addEventListener('ui-click', () => {
    /* Whichever way the picker is standing, the answer is a name. Chosen off
       the list it is the catalogue entry's own name; stepped out of the list
       the control is a text box, `value` reads back the sentinel, and what was
       typed lives on `free-text-value` — see wireFreeText() in ui-select. */
    const picked = providerFromDirectory(providerName?.value);
    const typed =
      providerName?.value === PROVIDER_OTHER
        ? providerName.getAttribute('free-text-value') ?? ''
        : '';
    const name = picked ? picked.name : typed.trim();

    if (!name) {
      providerName?.setAttribute('error', 'Choose a provider, or type a name');
      return;
    }
    providerName?.removeAttribute('error');

    providers = [
      ...providers,
      {
        id: `pv${providers.length + 1}`,
        role: role.value || 'Referring',
        name,
        institution: institution?.value?.trim() || '',
        specialty: specialty.value || '—',
        phone: providerPhone?.value?.trim() || '—',
        email: providerEmail?.value?.trim() || '—',
        status: 'Active',
      },
    ];
    paintProviders();
    providerModal.close();
  });

  providerModal?.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) providerModal.close();
  });

  paintSelected();
  paintProviders();
}
