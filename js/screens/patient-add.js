/**
 * Add Patient — the gGastro Patient Form, rebuilt in MediNova's UI.
 *
 * FORM STRUCTURE is one continuous form, top to bottom: Patient Basic Details,
 * Additional Details, Information Sharing, Insurance, Guarantor, and the
 * Support Persons / Providers / Pharmacies lists. It was three tabs and two
 * columns; registration is one act taken at a desk with the patient in front
 * of you, and splitting it meant the Save button could report required fields
 * on a tab nobody was looking at.
 *
 * Billing and Portal were tabs four and five and are gone. Billing group, fee
 * schedule and statement delivery belong to the practice, not to each new
 * patient; the Portal tab was a readout of an account that does not exist
 * until the patient redeems their registration pin.
 *
 * FORM RULES come from the registration workflow, and the one that matters is
 * the guarantor:
 *
 *     Patient 18 or over? ── Yes ──▶ Guarantor = patient
 *                          └─ No  ──▶ Guarantor = parent or legal guardian
 *                                        │
 *                                        ▼
 *              Guarantor address — required, guarantor receives the bills
 *
 * On the Yes branch there is nothing to ask, so the section is not shown at
 * all: it used to be a form that mirrored the patient record into itself and
 * locked every field, which is twenty boxes restating what was just typed
 * above them. Date of birth alone reveals it, and correcting that date hides
 * it again along with the fields it made required.
 *
 * Two fields are deliberately disabled until the field they qualify has a
 * value — Race Details and Ethnicity Details. That is how the legacy form
 * greys them, and it stops meaningless orphan data.
 */

import { initCareNetwork } from './patient-care-network.js';
import { initSupportPersons } from './patient-support-persons.js';
import { PREFERRED_LABS, ACCEPTED_PLANS } from '../../data/registration.js';
import {
  PREFIXES, SUFFIXES, TITLES, BIRTH_SEXES, GENDER_IDENTITIES,
  SEXUAL_ORIENTATIONS, PRONOUNS, PATIENT_TYPES, RACES, RACE_DETAILS,
  ETHNICITIES, ETHNICITY_DETAILS, TRIBAL_AFFILIATIONS, LANGUAGES,
  NATIONALITIES, MARITAL_STATUSES, CONTACT_PREFERENCES,
  PATIENT_STATUSES, COUNTRIES, STATES,
  PROTECT_DATA_OPTIONS, MEDICATION_HISTORY_OPTIONS, CAHPS_OPTIONS,
  GUARANTOR_RELATIONSHIPS, GUARANTOR_GENDERS, SEX_FOR_CLINICAL_USE,
} from '../../data/patient-form.js';

/** Fixed so screenshots and tests stay stable. */
const TODAY = new Date('2026-08-04');

/**
 * Every field carrying an asterisk. This list and the `required` attributes
 * in the markup have to agree — an asterisk the Save button does not enforce
 * is a lie, and a block on a field with no asterisk is worse.
 *
 * Birth Sex is NOT here: it is required only while "Birth Sex Declined" is
 * unticked, so requiredIds() adds it conditionally.
 */
const REQUIRED_TESTIDS = [
  'add--first-name',
  'add--last-name',
  'add--dob',
  'add--mobile',
  'add--country',
  'add--address1',
  'add--city',
  'add--state',
  'add--zip',
];

/**
 * Required only while the guarantor section is on screen, which is to say only
 * for a minor. An adult is their own guarantor and is never asked any of this.
 */
const GUARANTOR_REQUIRED_TESTIDS = [
  'add--guarantor-relationship',
  'add--guarantor-first',
  'add--guarantor-last',
  'add--guarantor-address1',
  'add--guarantor-city',
  'add--guarantor-zip',
];

/**
 * The address the copy button copies: the patient's, in the system's order.
 * Each entry is [guarantor testid, patient testid].
 */
const GUARANTOR_ADDRESS_MIRROR = [
  ['add--guarantor-country', 'add--country'],
  ['add--guarantor-address1', 'add--address1'],
  ['add--guarantor-address2', 'add--address2'],
  ['add--guarantor-city', 'add--city'],
  ['add--guarantor-state', 'add--state'],
  ['add--guarantor-zip', 'add--zip'],
];

function ageFrom(value) {
  if (!value) return null;
  const born = new Date(value);
  if (Number.isNaN(born.getTime())) return null;
  let age = TODAY.getFullYear() - born.getFullYear();
  const beforeBirthday =
    TODAY.getMonth() < born.getMonth() ||
    (TODAY.getMonth() === born.getMonth() && TODAY.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/* Contact Numbers, Addresses and Emails were three collapsible panels down the
   right of this screen, each with its own add button. They asked for a mobile
   number, an address and an e-mail — the three things the form above already
   takes, in fields that are required. Two places to put the same fact is one
   too many: whichever the registrar filled, the other looked empty. */

/* --- Sections open and shut -------------------------------------------------
   Twelve cards, read top to bottom, and the one being worked on is rarely the
   one at the top. So every card folds: its title stays as a marker of what is
   there, and the fields underneath it get out of the way.

   The head is not turned INTO a button — several of them carry their own
   controls (Insurance's Yes/No, Add support person, the lead chip) and a button
   cannot contain a button. The title and a caret become the button; whatever
   else the head holds stays beside it as its own tab stop.

   EACH ONE ON ITS OWN. Every section starts open and folds independently:
   registration is worked top to bottom in one pass, and a form that shut the
   section behind you as you opened the next one would hide the work already
   done every time you moved. Folding is for getting a finished section out of
   the way, which is a decision per section rather than a rule about how many
   may be open.

   The cost of shutting a section is that the fields inside it are gone, and
   Save has to be able to reach a required one. openSection() is what the
   validation calls before it focuses: see validate().
   -------------------------------------------------------------------------- */

/** Open the section a node sits in, shutting whichever was open. */
function openSection(node) {
  const card = node?.closest?.('.ap__card');
  card?.querySelector('.ap__card-toggle[aria-expanded="false"]')?.click();
}

function initAccordions() {
  document.querySelectorAll('.ap__card').forEach((card, index) => {
    const head = card.querySelector('.ap__card-head');
    const body = card.querySelector('.ap__card-body');
    if (!head || !body || head.querySelector('.ap__card-toggle')) return;

    if (!body.id) body.id = `apSection${index + 1}`;

    /* The title is taken from the markup rather than restated here, so a
       section renamed in the HTML renames its control with it. Two shapes to
       read it out of: a head that carries controls keeps its words in a
       <span>, and a head that carries nothing else IS the <h2>. */
    const titleEl = head.querySelector(':scope > span:not(.ap__head-slot), :scope > h2');
    let label;
    if (titleEl) {
      label = titleEl.textContent.trim();
      titleEl.remove();
    } else {
      label = head.textContent.trim();
      head.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
      });
    }

    /* The mark. Eight bands of grey type down a long form gives the eye
       nothing to navigate by; a tinted square per section does, and it is the
       same object the dashboard's cards already carry. The tone says what kind
       of question the section asks — who the patient is, what they consent to,
       who pays — rather than being decoration eight times over. */
    const icon = card.dataset.icon;
    const tone = card.dataset.tone ?? 'brand';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ap__card-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', body.id);
    toggle.dataset.testid = `add--section-toggle-${index + 1}`;
    toggle.innerHTML = `${
      icon
        ? `<span class="ap__card-icon ap__card-icon--${tone}" aria-hidden="true">
             <svg class="ui-icon"><use href="#i-${icon}"></use></svg>
           </span>`
        : ''
    }<span class="ap__card-name">${label}</span>`;

    head.prepend(toggle);

    /* The caret goes LAST, past whatever else the head carries — the Yes/No on
       Insurance, Add support person — so the folding mark is at the end of
       every head rather than halfway along the ones that carry a control.

       It is a second way to press the same thing, so it is hidden from
       assistive tech and off the tab ring: the title beside it is the control,
       already labelled and already carrying aria-expanded. What this adds is
       the pointer target people go for, which is the chevron. */
    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'ap__card-caret-btn';
    caret.tabIndex = -1;
    caret.setAttribute('aria-hidden', 'true');
    caret.innerHTML = `<svg class="ui-icon ap__card-caret" aria-hidden="true">
        <use href="#i-caret-down"></use>
      </svg>`;
    caret.addEventListener('click', () => toggle.click());
    head.append(caret);

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
      card.classList.toggle('ap__card--shut', !open);
    };


    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Everything open on load: the form shows its own length, which is what
    // the three tabs it replaced could not.
    setOpen(true);
  });
}

/* --- Wiring ---------------------------------------------------------------- */

customElements.whenDefined('ui-data-table').then(() => {
  initAccordions();
  initCareNetwork();
  initSupportPersons();
});

customElements.whenDefined('ui-input').then(() => {
  /* ===== Option lists =====================================================
     Set through the `options` attribute, which is how every other screen
     fills a ui-select. Values equal labels for all of these. */
  const fill = (id, list, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('options', list.join(','));
    if (value) el.setAttribute('value', value);
  };

  /**
   * For lists whose labels contain commas — "Lesbian, gay or homosexual",
   * "Genderqueer, neither exclusively male nor female". The `options`
   * attribute is a comma-joined string and would split those mid-label, so
   * they go in as data instead.
   */
  const fillList = (id, list) => {
    const el = document.getElementById(id);
    if (el) el.optionList = list.map((label) => ({ value: label, label }));
  };

  fill('prefix', PREFIXES);
  fill('suffix', SUFFIXES);
  fill('title', TITLES);
  fill('birthSex', BIRTH_SEXES);
  fill('country', COUNTRIES, 'United States');
  fill('state', STATES);
  fill('guarantorState', STATES);
  fill('subscriberState', STATES);
  fill('guarantorSuffix', SUFFIXES);
  fill('guarantorGender', GUARANTOR_GENDERS);
  fill('guarantorCountry', COUNTRIES, 'United States');
  fill('contactPreference', CONTACT_PREFERENCES);
  fill('preferredLab', PREFERRED_LABS);
  fill('patientStatus', PATIENT_STATUSES, 'Active');
  fill('patientType', PATIENT_TYPES, 'Outpatient');
  fill('race', RACES);
  fill('tribalAffiliation', TRIBAL_AFFILIATIONS);
  fill('ethnicity', ETHNICITIES);
  fill('language', LANGUAGES, 'English (en)');
  fill('nationality', NATIONALITIES);
  fill('maritalStatus', MARITAL_STATUSES);
  /* No default on Protect Data. Yes and No are both real answers with real
     consequences, and pre-selecting either records a decision the patient did
     not make. */
  fill('protectData', PROTECT_DATA_OPTIONS);
  /* Medication History Import does default, and to consent: it is the answer
     for almost every patient, and a blank here reads as a question nobody
     asked rather than as the ordinary case. */
  fill('medicationHistoryImport', MEDICATION_HISTORY_OPTIONS, 'Patient consents');
  fill('cahps', CAHPS_OPTIONS, 'No');

  // Comma-bearing labels — see fillList above.
  fillList('genderIdentity', GENDER_IDENTITIES);
  fillList('sexualOrientation', SEXUAL_ORIENTATIONS);
  fillList('pronouns', PRONOUNS);
  fillList('sexForClinicalUse', SEX_FOR_CLINICAL_USE);

  /* ===== Age, and the guarantor section it reveals ========================
     One rule, read off the date of birth: an adult is their own guarantor and
     is asked nothing, a minor has one named. So the section is not a tab to
     visit and not a Yes/No to answer — it appears when the date makes it true
     and takes its required fields with it. */

  const dob = document.querySelector('[data-testid="add--dob"]');
  const ageBadge = document.querySelector('[data-testid="add--age"]');
  const guarantorSection = document.getElementById('guarantorSection');
  const guarantorLane = document.getElementById('guarantorLane');
  const relationship = document.getElementById('guarantorRelationship');

  const field = (testid) => document.querySelector(`[data-testid="${testid}"]`);

  let currentAge = null;

  /** Only a minor ever has a guarantor form, so only a minor sees one. */
  const isMinor = () => currentAge !== null && currentAge < 18;

  /* "Self" is not on the menu: the section exists only for patients who cannot
     be their own guarantor. */
  relationship?.setAttribute(
    'options',
    GUARANTOR_RELATIONSHIPS.filter((r) => r !== 'Self').join(',')
  );
  relationship?.setAttribute('value', 'Parent');

  function applyAge(value) {
    currentAge = ageFrom(value);
    ageBadge.textContent = currentAge === null ? '—' : `${currentAge} yr`;
    /* With no date typed there is no age, and a bordered box holding an
       em-dash reads as a second field that refuses input. The class drops the
       frame until there is a number to put in it. */
    ageBadge.classList.toggle('ap__age--empty', currentAge === null);

    const minor = isMinor();
    if (guarantorSection) guarantorSection.hidden = !minor;
    if (guarantorLane && minor) {
      guarantorLane.textContent = `Patient is ${currentAge} — under 18`;
    }
  }

  dob?.addEventListener('ui-input', (event) => applyAge(event.detail.value));
  dob?.addEventListener('ui-change', (event) => applyAge(event.detail.value));
  applyAge(dob?.value ?? '');

  /* ===== Qualifier fields, disabled until they mean something ============= */

  /**
   * Enable a dependent select and load the option list that belongs to the
   * parent's value. An empty parent, or one with no sub-list, leaves the
   * dependent disabled and cleared — never showing stale options.
   */
  function bindDetail(parentId, detailId, table) {
    const parent = document.getElementById(parentId);
    const detail = document.getElementById(detailId);
    if (!parent || !detail) return;

    parent.addEventListener('ui-change', (event) => {
      const options = table[event.detail.value];
      detail.setAttribute('value', '');
      if (options?.length) {
        detail.setAttribute('options', options.join(','));
        detail.removeAttribute('disabled');
      } else {
        detail.setAttribute('options', '');
        detail.setAttribute('disabled', '');
      }
    });
  }

  bindDetail('race', 'raceDetails', RACE_DETAILS);
  bindDetail('ethnicity', 'ethnicityDetails', ETHNICITY_DETAILS);

  /* ===== Information Sharing consequences ================================ */

  /** A CAHPS restriction is the one answer in this card with a consequence
   *  elsewhere on the same row, so the read-only summary mirrors it rather
   *  than being a second thing to keep in step by hand. */
  const restrictions = document.querySelector('[data-testid="add--data-restrictions"]');
  document.getElementById('cahps')?.addEventListener('ui-change', (event) => {
    restrictions?.setAttribute('value', event.detail.value === 'Yes' ? 'Yes' : 'No');
  });

  /* ===== Social security number ==========================================
     One field. It was three boxes with a script that moved focus between
     them, which is a lot of machinery to type nine digits: paste arrived in
     the first box and stopped, a screen reader announced three unrelated
     groups, and correcting a middle digit meant clicking into the right box
     first. Digits only, dashes written as you type. */

  for (const host of document.querySelectorAll('ui-input[data-ssn]')) {
    const control = host.querySelector('input');
    if (!control) continue;

    control.addEventListener('input', () => {
      const digits = control.value.replace(/\D/g, '').slice(0, 9);
      const parts = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5)];
      // Trailing empties are dropped so the dash appears only once there is
      // something after it to separate.
      control.value = parts.filter((part) => part !== '').join('-');
    });
  }

  /* ===== Copy the patient's address into the guarantor form =============== */

  document.querySelector('[data-testid="add--guarantor-copy-address"]')
    ?.addEventListener('ui-click', () => {
      for (const [target, source] of GUARANTOR_ADDRESS_MIRROR) {
        field(target)?.setAttribute('value', field(source)?.value ?? '');
      }
    });

  /* ===== Insurance and eligibility ========================================
     Eligibility is checked from the Insurance tab, not from the footer:
     there is nothing to ask a payer until a policy is on file. The button
     stays disabled until one is, and self-pay skips the check entirely. */

  const insuranceFields = document.getElementById('insuranceFields');
  const hasInsurance = document.querySelector('[data-testid="add--has-insurance"]');
  const eligibilityBody = document.getElementById('eligibilityBody');
  const checkButton = document.querySelector('[data-testid="add--check-eligibility"]');

  const insuranceName = document.querySelector('[data-testid="add--insurance-name"]');
  const memberId = document.querySelector('[data-testid="add--member-id"]');

  /* --- The subscriber's own address ---------------------------------------
     Ticked is the common case and asks nothing. Unticked is a claim that the
     two addresses differ, and a claim with nowhere to record the difference
     is a tick-box that changes nothing — so the five fields appear directly
     under it, in the system's address order.

     Cleared on re-ticking rather than kept hidden: a hidden address that
     still holds last week's typing is a claim the form cannot see and the
     payer would receive. */
  const sameAddress = document.querySelector('[data-testid="add--same-address"]');
  const subscriberAddress = document.getElementById('subscriberAddress');

  const SUBSCRIBER_ADDRESS_FIELDS = [
    'add--sub-address1',
    'add--sub-address2',
    'add--sub-city',
    'add--sub-state',
    'add--sub-zip',
  ];

  function applySameAddress(same) {
    subscriberAddress.hidden = same;
    if (!same) return;
    for (const testid of SUBSCRIBER_ADDRESS_FIELDS) {
      document.querySelector(`[data-testid="${testid}"]`)?.setAttribute('value', '');
    }
  }

  sameAddress?.addEventListener('ui-change', (event) => applySameAddress(event.detail.checked));
  applySameAddress(sameAddress?.checked ?? true);

  /** not-ready → ready → checking → a result, or 'self-pay'. */
  let eligibility = 'not-ready';
  let result = null;

  const hasPolicy = () =>
    Boolean(insuranceName?.value?.trim() && memberId?.value?.trim());

  const selfPay = () => hasInsurance?.value === 'No';

  /*
   * WHAT THE CHECK CAME BACK WITH — one line, and only when there is one.
   *
   * This used to be a titled block with an icon and three lines of prose in
   * every state, including the two states that are not answers at all: "waiting
   * on a policy" and "ready to check". Neither is news. The button beside it is
   * shut until a policy exists and open once one does, which says both without
   * spending a section on it. So those two render nothing, and what is left is
   * the answer: checking, the result, or the fact that self-pay has no payer to
   * ask.
   */
  function eligibilityMarkup() {
    if (selfPay()) {
      return line('info', 'info', 'Not applicable — self-pay');
    }

    if (eligibility === 'checking') {
      return line('info', 'spinner', 'Checking with the payer…', 'ap__spin');
    }

    if (eligibility !== 'checked') return '';

    // Coverage is active either way; what differs is whether the practice
    // contracts with the plan, which is what stops a booking.
    return result.accepted
      ? line('pass', 'check', `Active coverage — ${result.carrier}`)
      : line('stop', 'critical', `Not contracted — ${result.carrier}`);
  }

  /* The answer keeps the class the gate's answer line had: it is the same fact,
     said in one line rather than three. */
  function line(tone, icon, answer, iconClass = '') {
    eligibilityBody.dataset.tone = tone;
    return `<svg class="ui-icon ${iconClass}" aria-hidden="true"><use href="#i-${icon}"></use></svg>
      <span class="ap__gate-a">${answer}</span>`;
  }

  function refreshEligibility() {
    // Adding or editing a policy invalidates any earlier answer.
    if (eligibility !== 'checking' && eligibility !== 'checked') {
      eligibility = hasPolicy() ? 'ready' : 'not-ready';
    }

    eligibilityBody.innerHTML = eligibilityMarkup();
    // Note: never assign textContent to a ui-button — it takes its label from
    // textContent at upgrade time and rebuilds its own innards, so writing to
    // it wipes the rendered button. The label stays fixed instead.
    checkButton.disabled = selfPay() || !hasPolicy() || eligibility === 'checking';
  }

  function runCheck() {
    eligibility = 'checking';
    refreshEligibility();

    window.setTimeout(() => {
      const typed = insuranceName.value.trim().toLowerCase();
      const plan = ACCEPTED_PLANS.find((p) => p.carrier.toLowerCase() === typed);

      // An unrecognised carrier is treated as not contracted — the safe
      // answer, since a booking made on a wrong assumption is unbillable.
      result = plan ?? { carrier: insuranceName.value.trim(), accepted: false, network: 'Not contracted' };
      eligibility = 'checked';
      refreshEligibility();
    }, 700);
  }

  hasInsurance?.addEventListener('ui-change', (event) => {
    insuranceFields.hidden = event.detail.value === 'No';
    refreshEligibility();
  });

  // Any edit to the policy drops the previous answer rather than leaving a
  // stale "Active coverage" beside a carrier that has since been retyped.
  for (const field of [insuranceName, memberId]) {
    field?.addEventListener('ui-input', () => {
      eligibility = hasPolicy() ? 'ready' : 'not-ready';
      result = null;
      refreshEligibility();
    });
  }

  checkButton?.addEventListener('ui-click', () => {
    if (!checkButton.disabled) runCheck();
  });

  refreshEligibility();

  /* ===== Validation ======================================================= */

  const status = document.getElementById('formStatus');
  /* The standing "what the asterisks mean" line in the footer. It steps aside
     while a validation message is up: two notes competing for the same corner
     is how the one that matters gets skimmed past. */
  const requiredNote = document.getElementById('formRequiredNote');
  const showStatus = (message) => {
    status.textContent = message;
    if (requiredNote) requiredNote.hidden = Boolean(message);
  };

  /**
   * The required set is conditional, so it is rebuilt on each save rather
   * than fixed: a minor adds the guarantor name, and a guarantor at a
   * different address adds that address.
   */
  function requiredIds() {
    const ids = [...REQUIRED_TESTIDS];
    // Declining IS an answer, so it satisfies the field rather than leaving
    // it outstanding — the four detail fields carry the record instead.
    ids.push('add--birth-sex');
    // An adult is their own guarantor and the section is not on screen, so
    // asking for a name and address would be asking about a form nobody can
    // see. A minor's guarantor is required in full.
    if (isMinor()) ids.push(...GUARANTOR_REQUIRED_TESTIDS);
    return ids;
  }

  function outstanding() {
    return requiredIds()
      .map((id) => ({ id, field: document.querySelector(`[data-testid="${id}"]`) }))
      .filter(({ field }) => {
        const control = field?.querySelector('input, select');
        return control && !control.disabled && !control.value;
      });
  }

  function validate() {
    const missing = outstanding();

    if (!missing.length) {
      showStatus('');
      return true;
    }

    showStatus(`${missing.length} required field${
      missing.length > 1 ? 's' : ''
    } still to complete.`);

    /* One form means the first outstanding field is always somewhere on this
       page — open the section holding it, scroll it into view and focus it,
       rather than reporting a count and leaving the reader to hunt for which
       box it meant. A section the registrar has folded away is still a section
       Save has to be able to point into. */
    const first = missing[0];
    openSection(first.field);
    first.field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    first.field.focus();
    return false;
  }

  /* ===== Save ============================================================= */

  document.querySelector('[data-testid="add--save"]')
    ?.addEventListener('ui-click', () => {
      if (validate()) window.location.href = 'patient-directory.html';
    });

  // A draft is saved as-is. Required fields are what a COMPLETE record needs,
  // and holding a half-taken phone call hostage to them loses the call.
  document.querySelector('[data-testid="add--save-draft"]')
    ?.addEventListener('ui-click', () => {
      window.location.href = 'patient-directory.html';
    });

  document.querySelector('[data-testid="add--cancel"]')
    ?.addEventListener('ui-click', () => {
      window.location.href = 'patient-directory.html';
    });
});
