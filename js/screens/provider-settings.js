/**
 * Settings ▸ Provider — the signed-in provider's OWN settings.
 *
 * Four tabs, and the distinction that decides what each one shows:
 *
 *   Profile        this provider's record. Rendered from the SAME definition
 *                  the Add Provider form is built from (PROVIDER_FIELDS and
 *                  PROVIDER_GROUPS in data/practice.js), so the profile can
 *                  never show a different set of facts than onboarding
 *                  collects. Editing reopens that same field set.
 *   Practice       the LOCATION this provider works at — the record the
 *                  practice administrator created in Practice ▸ Locations,
 *                  read-only here. A provider with two working locations gets
 *                  a picker rather than an arbitrary choice made for them.
 *   Notification   what this provider is told about, and down which channel.
 *   Patient Flag   the chips a chart can be marked with.
 *
 * Nothing here is the practice's own configuration — that is Practice
 * Settings, and duplicating it would give two screens the authority to change
 * one fact.
 */
import {
  LOCATIONS,
  LOCATION_ID_FIELDS,
  PROVIDER_FIELDS,
  PROVIDER_GROUPS,
  SPECIALTY_TYPES,
} from '../../data/practice.js';
import {
  PROVIDER,
  NOTIFICATION_GROUPS,
  NOTIFICATION_CHANNELS,
  PATIENT_FLAGS,
  FLAG_COLOURS,
  FLAG_TODAY,
} from '../../data/provider-settings.js';
import { registerSwatches, swatchClass, swatchMarkup } from '../lib/swatches.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { createPager } from '../lib/pagination.js';
import { notify } from '../lib/toast.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A blank reads as an em dash, never as a missing row. */
const shown = (value) => (value ? esc(value) : '<span class="prc__muted">—</span>');

/** "1982-04-17" → "17/04/1982", the format the rest of Settings writes. */
function displayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : iso;
}

/* Work on a copy: the data modules are the seed, not the store. */
let provider = structuredClone(PROVIDER);
let flags = PATIENT_FLAGS.map((flag) => ({ ...flag }));

/* ===================== BOOT ===================== */

customElements.whenDefined('ui-data-table').then(() => {
  // Location and flag colours are customer data, so they get generated
  // classes rather than inline styles — same as everywhere else.
  registerSwatches([...LOCATIONS.map((l) => l.colour), ...FLAG_COLOURS, ...flags.map((f) => f.colour)]);

  const tabs = document.querySelector('[data-testid="pvs--tabs"]');

  const ACTIONS = {
    profile: ['pvs--edit-profile'],
    practice: ['pvs--edit-practice'],
    notification: ['pvs--notify-default', 'pvs--notify-save'],
    flags: ['pvs--add-flag'],
  };

  function syncActions(tab) {
    Object.entries(ACTIONS).forEach(([key, ids]) =>
      ids.forEach((id) => {
        const button = document.querySelector(`[data-testid="${id}"]`);
        if (button) button.hidden = key !== tab;
      })
    );
  }

  // ?tab=flags lets the Settings hub link straight to a section rather than
  // dropping people on Profile and making them find it.
  const requested = new URLSearchParams(window.location.search).get('tab');
  const start = ['profile', 'practice', 'notification', 'flags'].includes(requested)
    ? requested
    : 'profile';
  if (start !== 'profile') tabs?.setAttribute('selected', start);
  syncActions(start);

  tabs?.addEventListener('ui-change', (event) => {
    syncActions(event.detail.value);
    closeFlagMenu?.();
  });

  paintProfile();
  initProfileEditor();
  initPractice();
  initNotifications();
  initFlags();
});

/** The toast, the same one Practice Settings raises. */
function flash(message) {
  notify(message);
}

/* ===================== PROFILE =====================
   Read-only. Every section below is generated from the onboarding definition
   rather than hand-listed, so a field added to Add Provider appears here on
   its own — the failure this avoids is a profile that quietly stops showing
   the DEA number six months after someone added it to the form.
   ================================================== */

/** "Dr. Amara Kwarteng Mensah, MD" — the record's own parts, composed. */
function providerName(record) {
  const parts = [record.prefix, record.firstName, record.middleName, record.lastName]
    .filter(Boolean)
    .join(' ');
  return record.suffix ? `${parts}, ${record.suffix}` : parts;
}

/** A grey-headed card with a label/value grid under it. */
function section(title, body, extraClass = '') {
  return `<section class="pvs__card ${extraClass}">
    <div class="pvs__card-head"><h2 class="pvs__card-title">${esc(title)}</h2></div>
    <div class="pvs__card-body">${body}</div>
  </section>`;
}

/** Label above value, wrapped in a grid — the shape the design reference uses. */
function pairs(entries) {
  return `<div class="pvs__grid">${entries
    .map(
      ([label, value]) => `<div class="pvs__pair">
        <span class="pvs__label">${esc(label)}</span>
        <span class="pvs__value">${value}</span>
      </div>`
    )
    .join('')}</div>`;
}

/**
 * One repeatable group as a list of typed rows. The TYPE is what makes the
 * row readable — "Mobile (701) 555-0177" answers a question that a bare
 * number does not — so it leads, except for locations, which have no type
 * and take the location's schedule colour instead.
 */
function groupList(group) {
  const rows = (provider.groups[group.id] ?? []).filter((row) => row.value?.trim());
  if (!rows.length) return '<p class="pvs__empty">None recorded.</p>';

  /* Everything the group asks for beyond the answer itself — the taxonomy and
     the two dates of a licence. They read UNDER the number rather than beside
     it, because "valid until 30/06/2026" is the part somebody scans this card
     for and a fourth column squeezed into half a card is not scannable. */
  const extras = group.fields.filter((field) => field.key !== 'value');

  return `<ul class="pvs__list">${rows
    .map((row) => {
      const location = group.id === 'locations' && LOCATIONS.find((l) => l.name === row.value);
      const lead = location
        ? swatchMarkup(location.colour)
        : group.types.length
        ? `<span class="pvs__tag">${esc(row.type)}</span>`
        : '';

      const meta = extras
        .map((field) => {
          const value = field.type === 'date' ? displayDate(row[field.key]) : row[field.key];
          return value ? `${field.label} ${value}` : '';
        })
        .filter(Boolean)
        .join(' · ');

      return `<li class="pvs__list-row">${lead}<span>${esc(row.value)}${
        meta ? `<span class="pvs__list-meta">${esc(meta)}</span>` : ''
      }</span></li>`;
    })
    .join('')}</ul>`;
}

function paintProfile() {
  const host = document.getElementById('providerProfile');
  if (!host) return;

  const byKey = Object.fromEntries(PROVIDER_FIELDS.map((f) => [f.key, f]));
  const value = (key) => {
    const field = byKey[key];
    return shown(field?.type === 'date' ? displayDate(provider[key]) : provider[key]);
  };

  // Everything about the person, in the order onboarding asks for it. NPI and
  // DEA are NOT here and are not looked for: they left PROVIDER_FIELDS when
  // identifiers became a repeatable list, and reading them off this map is
  // what used to throw and leave every tab on the screen blank. The
  // Identifications card below renders that list instead. Status is a badge
  // but still carries its LABEL: a pill floating beside the name says
  // "Active" without saying active what.
  const basics = PROVIDER_FIELDS.map((field) => [
    field.label,
    field.key === 'status'
      ? `<ui-badge status="${provider.status === 'Active' ? 'success' : 'neutral'}"
           >${esc(provider.status)}</ui-badge>`
      : value(field.key),
  ]);

  const group = (id) => PROVIDER_GROUPS.find((g) => g.id === id);

  host.innerHTML = `
    ${section(
      'Basic Details',
      `<div class="pvs__identity">
        <ui-avatar name="${esc(`${provider.firstName} ${provider.lastName}`)}" size="lg"></ui-avatar>
        <div class="pvs__identity-text">
          <p class="pvs__identity-name" data-testid="pvs--name">${esc(providerName(provider))}</p>
          <div class="pvs__identity-meta">
            <span class="pvs__identity-role">${esc(
              [provider.title, provider.specialty].filter(Boolean).join(' · ')
            )}</span>
            ${
              // The one fact with no grid cell of its own — `certified` is a
              // flag on the record, not a field of PROVIDER_FIELDS.
              provider.certified
                ? '<ui-badge status="info">Certified healthcare professional</ui-badge>'
                : ''
            }
          </div>
        </div>
      </div>
      ${pairs(basics)}`
    )}

    <div class="pvs__row">
      ${
        // Licences beside the identifiers, because they answer the same
        // question from two sides: which numbers this clinician is known by,
        // and which of them come with an expiry the practice has to watch.
        section('Identifications', groupList(group('identifications')))
      }
      ${section('Licenses', groupList(group('licenses')))}
    </div>

    <div class="pvs__row">
      ${section('Emails', groupList(group('emails')))}
      ${section('Contact Numbers', groupList(group('phones')))}
    </div>

    <div class="pvs__row">
      ${section('Addresses', groupList(group('addresses')))}
      ${section('Working Locations', groupList(group('locations')))}
    </div>

    ${section(
      'Signature',
      provider.signature
        ? `<p class="pvs__signature" data-testid="pvs--signature">
             <svg class="ui-icon" aria-hidden="true"><use href="#i-image"></use></svg>
             ${esc(provider.signature)}
           </p>`
        : '<p class="pvs__empty">No signature on file.</p>'
    )}

    ${section(
      'Notes',
      provider.notes
        ? `<p class="pvs__notes">${esc(provider.notes)}</p>`
        : '<p class="pvs__empty">Nothing recorded.</p>'
    )}`;
}

/* ===================== PROFILE — EDIT =====================
   The onboarding field set again, this time as controls. Built from the same
   two definitions, so "edit" and "add" cannot fall out of step.
   ========================================================= */

let draft = null;

function fieldControl(field, current) {
  const shared = `data-pv-field="${field.key}" label="${esc(field.label)}"${
    field.required ? ' required' : ''
  }`;

  const options = field.optionsFrom === 'specialty' ? SPECIALTY_TYPES : field.options;
  if (options) {
    return `<ui-select ${shared} placeholder="Select ${esc(field.label)}"
      options="${esc(options.join(','))}" value="${esc(current)}"></ui-select>`;
  }
  return `<ui-input ${shared} type="${field.type ?? 'text'}"
    ${field.hint ? `hint="${esc(field.hint)}"` : ''} value="${esc(current)}"></ui-input>`;
}

/* A row of the shape its group asks for — see the same helper in
   practice-settings.js. Licenses hold four answers to a row, so a fixed
   {type, value} pair would leave the taxonomy and the dates undefined. */
function blankRow(group) {
  const row = { type: group.types[0] ?? '' };
  group.fields.forEach((field) => {
    row[field.key] = '';
  });
  return row;
}

/**
 * One answer inside a repeatable row. A contact group asks for a single thing
 * and lets the placeholder carry what it is; a licence row asks for four, and
 * a `type="date"` box shows no placeholder at all — so a multi-field group
 * prints the label above each box.
 */
function groupFieldControl(group, field, row, index) {
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
           value="${esc(row[field.key])}" placeholder="${esc(field.label)}"
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
function groupFieldControlRow(group, row, index) {
  const controls = group.fields
    .map((field) => groupFieldControl(group, field, row, index))
    .join('');
  return group.fields.length > 1 ? `<div class="prv__fields">${controls}</div>` : controls;
}

function paintProfileGroups() {
  const host = document.getElementById('providerProfileGroups');
  if (!host) return;

  host.innerHTML = PROVIDER_GROUPS.map((group) => {
    const rows = draft.groups[group.id];
    return `<section class="prv__card" data-testid="pvs--group-${group.id}">
      <header class="prv__card-head">
        <h3 class="prv__card-title">${esc(group.title)}</h3>
        <button type="button" class="prv__add" data-add-row="${group.id}"
          aria-label="Add another ${esc(group.title.toLowerCase())} row">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-plus"></use></svg>
        </button>
      </header>
      ${rows
        .map(
          (row, index) => `<div class="prv__row${
            group.fields.length > 1 ? ' prv__row--fields' : ''
          }">
            ${
              group.types.length
                ? `<span class="ui-select-shell prv__type">
                     <select data-field="type" data-group="${group.id}"
                     data-index="${index}" aria-label="${esc(group.title)} type">
                     ${group.types
                       .map(
                         (t) =>
                           `<option value="${esc(t)}"${t === row.type ? ' selected' : ''}>${esc(
                             t
                           )}</option>`
                       )
                       .join('')}
                     </select>
                     <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-down"></use></svg>
                   </span>`
                : ''
            }
            ${groupFieldControlRow(group, row, index)}
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
      draft.groups[group.id].push(blankRow(group));
      paintProfileGroups();
    })
  );

  host.querySelectorAll('[data-drop-row]').forEach((button) =>
    button.addEventListener('click', () => {
      draft.groups[button.dataset.dropRow].splice(Number(button.dataset.index), 1);
      paintProfileGroups();
    })
  );

  host.querySelectorAll('[data-field]').forEach((control) =>
    control.addEventListener('input', () => {
      const { group, index, field } = control.dataset;
      draft.groups[group][Number(index)][field] = control.value;
    })
  );
}

function openProfileEditor(trigger) {
  const modal = document.getElementById('providerProfileModal');
  const fields = document.getElementById('providerProfileFields');
  if (!modal || !fields) return;

  // A draft, not the record: Cancel has to leave the profile untouched.
  draft = structuredClone(provider);
  // Every group needs at least one row, or its panel reads as broken.
  PROVIDER_GROUPS.forEach((group) => {
    if (!draft.groups[group.id]?.length) {
      draft.groups[group.id] = [blankRow(group)];
    }
  });

  fields.innerHTML = `
    <section class="prv__card">
      <h3 class="prv__card-title">Staff member</h3>
      <div class="prv__grid">
        ${PROVIDER_FIELDS.slice(0, 5)
          .map((field) => fieldControl(field, draft[field.key]))
          .join('')}
      </div>
    </section>

    <section class="prv__card">
      <h3 class="prv__card-title">Additional info</h3>
      <div class="prv__grid">
        ${PROVIDER_FIELDS.slice(5)
          .map((field) => fieldControl(field, draft[field.key]))
          .join('')}
      </div>

      <ui-textarea data-pv-field="notes" label="Notes" rows="3"
        placeholder="Anything the practice should know"
        value="${esc(draft.notes)}"></ui-textarea>

      <ui-checkbox id="pvsCertified" ${draft.certified ? 'checked' : ''}
        >Certified healthcare professional</ui-checkbox>

      <div class="prv__sign">
        <span class="prv__sign-label">Signature</span>
        <button type="button" class="prv__sign-drop" id="pvsSignature"
          data-testid="pvs--signature-drop">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-image"></use></svg>
          <span id="pvsSignatureText">${
            draft.signature ? `${esc(draft.signature)} — click to replace` : 'Upload a signature image'
          }</span>
        </button>
      </div>
    </section>`;

  // No file picker in the prototype; the affordance and its filled state are
  // the parts that matter for the form to read correctly.
  fields.querySelector('#pvsSignature').addEventListener('click', () => {
    draft.signature = 'a-mensah-signature.png';
    fields.querySelector('#pvsSignatureText').textContent =
      'a-mensah-signature.png — click to replace';
  });

  paintProfileGroups();
  modal.open(trigger);
}

function initProfileEditor() {
  const modal = document.getElementById('providerProfileModal');
  if (!modal) return;

  document
    .querySelector('[data-testid="pvs--edit-profile"]')
    ?.addEventListener('ui-click', (event) => openProfileEditor(event.target));

  modal.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) return modal.close();
    if (!event.target.closest('[data-testid="pvs--profile-save"]')) return;

    const fields = document.getElementById('providerProfileFields');
    const read = (key) => fields.querySelector(`[data-pv-field="${key}"]`);

    // Only the name is required — the same rule onboarding applies. A record
    // that cannot be saved until every identifier is to hand is a record that
    // gets kept in a spreadsheet instead.
    let valid = true;
    PROVIDER_FIELDS.filter((field) => field.required).forEach((field) => {
      const control = read(field.key);
      const text = String(control.value ?? '').trim();
      control.setAttribute('value', text);
      if (text) control.removeAttribute('error');
      else {
        control.setAttribute('error', `${field.label} is required`);
        valid = false;
      }
    });
    if (!valid) return;

    PROVIDER_FIELDS.forEach((field) => {
      draft[field.key] = String(read(field.key).value ?? '').trim();
    });
    draft.notes = String(read('notes').value ?? '').trim();
    draft.certified = fields.querySelector('#pvsCertified').checked;

    // Blank rows are how a repeater is left, not a record to keep.
    PROVIDER_GROUPS.forEach((group) => {
      draft.groups[group.id] = draft.groups[group.id].filter((row) => row.value?.trim());
    });

    provider = draft;
    draft = null;
    paintProfile();
    paintPractice();
    modal.close();
    flash(`${provider.firstName} ${provider.lastName}'s profile saved.`);
  });
}

/* ===================== PRACTICE =====================
   The location record, read-only. Everything below comes from the Location
   Form the practice administrator filled in (Practice ▸ Locations ▸ Add New
   Location) — this screen shows a provider WHICH practice they are attached
   to and what it is configured as; it does not give them a second place to
   change it.
   =================================================== */

/** The locations this provider actually works at, as full records. */
function providerLocations() {
  return provider.groups.locations
    .map((row) => LOCATIONS.find((l) => l.name === row.value))
    .filter(Boolean);
}

let selectedLocationId = null;

function initPractice() {
  const sites = providerLocations();
  selectedLocationId = sites[0]?.id ?? null;

  const bar = document.getElementById('providerLocationBar');
  if (bar && sites.length > 1) {
    bar.innerHTML = `<ui-select id="providerLocationPicker" label="Location"
      label-hidden options="${esc(sites.map((l) => l.name).join(','))}"
      value="${esc(sites[0].name)}" data-testid="pvs--location-picker"></ui-select>
      <span class="pvs__loc-note">${sites.length} working locations on this provider's record</span>`;

    bar.querySelector('#providerLocationPicker').addEventListener('ui-change', (event) => {
      selectedLocationId = sites.find((l) => l.name === event.detail.value)?.id ?? selectedLocationId;
      paintPractice();
    });
  } else if (bar) {
    bar.innerHTML = '';
  }

  document.querySelector('[data-testid="pvs--edit-practice"]')?.addEventListener('ui-click', () =>
    flash(
      'A location is configured by the practice administrator, in Practice Settings ▸ Locations.'
    )
  );

  paintPractice();
}

/** A small read-only table — contact numbers, billing types, cost centres. */
function miniTable(title, columns, rows) {
  const body = rows.length
    ? rows
        .map((row) => `<tr>${columns.map((c) => `<td>${shown(row[c.key])}</td>`).join('')}</tr>`)
        .join('')
    : `<tr><td class="prc__mini-empty" colspan="${columns.length}">None recorded.</td></tr>`;

  return `<section class="prc__mini">
    <div class="prc__mini-head"><span>${esc(title)}</span></div>
    <table class="prc__mini-table">
      <thead><tr>${columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

function paintPractice() {
  const host = document.getElementById('providerPractice');
  if (!host) return;

  const sites = providerLocations();
  const site = sites.find((l) => l.id === selectedLocationId) ?? sites[0];

  if (!site) {
    host.innerHTML = `<p class="pvs__empty">
      No working location on this provider's record yet. Add one under
      Profile ▸ Edit Provider Profile ▸ Locations.</p>`;
    return;
  }

  const a = site.address;
  const c = site.contactPerson;
  const contactLine = [c.first, c.middle, c.last].filter(Boolean).join(' ');
  const addressLine = [a.line1, a.line2, [a.city, a.state, a.zip].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join('<br>');

  // Only the identifiers this location actually has — an empty CAHPS ID row
  // is noise on a screen someone is scanning for the NPI.
  const setIds = LOCATION_ID_FIELDS.filter(([key]) => site.ids[key]);

  host.innerHTML = `
    <aside class="pvs__site-card">
      <div class="prc__photo" aria-hidden="true">
        <svg class="ui-icon"><use href="#i-document"></use></svg>
      </div>
      <div class="pvs__site-head">
        ${swatchMarkup(site.colour, 'ui-swatch--lg')}
        <p class="prc__name" data-testid="pvs--site-name">${esc(site.name)}</p>
      </div>
      <div class="pvs__identity-meta">
        <ui-badge status="info">${esc(site.businessUnit)}</ui-badge>
        <ui-badge status="${site.active ? 'success' : 'critical'}"
          >${site.active ? 'Active' : 'Inactive'}</ui-badge>
      </div>
      <dl class="prc__kv">
        <dt>Location ID</dt><dd>${esc(site.id)}</dd>
        <dt>Location NPI</dt><dd>${shown(site.ids.locationNpi)}</dd>
        <dt>Contact Number</dt><dd>${shown(site.contactNumbers[0]?.number)}</dd>
        <dt>Direct Address</dt><dd>${shown(site.directAddress)}</dd>
        <dt>Located at</dt><dd>${addressLine || '<span class="prc__muted">—</span>'}</dd>
      </dl>
    </aside>

    <div class="pvs__site-main">
      <section class="prc__panel">
        <h2 class="prc__panel-title">Basic Information</h2>
        <div class="prc__two-col">
          <dl class="prc__kv">
            <dt>Business Unit</dt><dd>${shown(site.businessUnit)}</dd>
            <dt>Place of service</dt><dd>${shown(site.placeOfService)}</dd>
            <dt>Outside Lab</dt><dd>${site.outsideLab ? 'Yes' : 'No'}</dd>
            <dt>Tax Rate</dt><dd>${esc(site.taxRate || '0.00')} %</dd>
          </dl>
          <dl class="prc__kv">
            <dt>Contact Person</dt><dd>${shown(contactLine)}</dd>
            <dt>Facility Name</dt><dd>${shown(site.facilityName)}</dd>
            <!-- No portal rows. The three settings they read came off the
                 location record with the Patient Portal block on the Practice
                 ▸ Locations form — the portal never took its site list or its
                 wording from here. Reading them anyway is what threw and left
                 this whole screen blank. -->
          </dl>
        </div>
        <dl class="prc__kv prc__kv--wide">
          <dt>Description</dt>
          <dd class="prc__info">${shown(site.description)}</dd>
        </dl>
      </section>

      <div class="pvs__row">
        ${miniTable(
          'Contact Numbers',
          [{ key: 'type', label: 'Type' }, { key: 'number', label: 'Contact Number' }],
          site.contactNumbers
        )}
        ${miniTable(
          'Billing type per business unit',
          [{ key: 'unit', label: 'Business Unit' }, { key: 'type', label: 'Billing Type' }],
          site.billingTypes
        )}
      </div>

      <div class="pvs__row">
        ${miniTable(
          'Cost Centers',
          [
            { key: 'name', label: 'Name' },
            { key: 'effective', label: 'Effective' },
            { key: 'expiration', label: 'Expiration' },
          ],
          site.costCentres
        )}
        <section class="prc__mini">
          <div class="prc__mini-head"><span>Location ID's</span></div>
          <div class="pvs__card-body">
            ${
              setIds.length
                ? `<dl class="prc__kv">${setIds
                    .map(([key, label]) => `<dt>${esc(label)}</dt><dd>${esc(site.ids[key])}</dd>`)
                    .join('')}</dl>`
                : '<p class="pvs__empty">No identifiers recorded.</p>'
            }
          </div>
        </section>
      </div>
    </div>`;
}

/* ===================== NOTIFICATION =====================
   One row per event, one checkbox per channel. Grouped by the thing the event
   happens TO, because that is how the decision is actually made: "stop
   telling me about invoices" is one thought, not three.
   ======================================================= */

let notifications = null;

function initNotifications() {
  notifications = structuredClone(NOTIFICATION_GROUPS);
  paintNotifications();

  document.querySelector('[data-testid="pvs--notify-save"]')?.addEventListener('ui-click', () => {
    const on = notifications
      .flatMap((group) => group.rows)
      .reduce((total, row) => total + NOTIFICATION_CHANNELS.filter((c) => row[c.key]).length, 0);
    flash(`Notification preferences saved — ${on} alert${on === 1 ? '' : 's'} switched on.`);
  });

  document.querySelector('[data-testid="pvs--notify-default"]')?.addEventListener('ui-click', () => {
    notifications = structuredClone(NOTIFICATION_GROUPS);
    paintNotifications();
    flash('Notification preferences restored to the practice defaults.');
  });
}

function paintNotifications() {
  const host = document.getElementById('providerNotify');
  if (!host) return;

  host.innerHTML = notifications
    .map(
      (group) => `<section class="pvs__notify-group" data-testid="pvs--notify-${group.id}">
        <h2 class="pvs__notify-title">${esc(group.title)}</h2>
        <table class="pvs__notify-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              ${NOTIFICATION_CHANNELS.map(
                (channel) => `<th scope="col" class="pvs__notify-col">${esc(channel.label)}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${group.rows
              .map(
                (row) => `<tr>
                  <td>${esc(row.title)}</td>
                  ${NOTIFICATION_CHANNELS.map(
                    (channel) => `<td class="pvs__notify-col">
                      <input type="checkbox" class="pvs__check"
                        data-notify="${row.id}" data-channel="${channel.key}"
                        ${row[channel.key] ? 'checked' : ''}
                        aria-label="${esc(channel.label)} — ${esc(row.title)}" />
                    </td>`
                  ).join('')}
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>`
    )
    .join('');

  host.querySelectorAll('[data-notify]').forEach((box) =>
    box.addEventListener('change', () => {
      const row = notifications
        .flatMap((group) => group.rows)
        .find((r) => r.id === box.dataset.notify);
      if (row) row[box.dataset.channel] = box.checked;
    })
  );
}

/* ===================== PATIENT FLAG =====================
   The chips a chart can be marked with. No count column: how many charts
   carry a flag is a reporting question, and a number nobody can click
   through to is a number nobody trusts.
   ======================================================= */

let editingFlag = null;
let draftColour = FLAG_COLOURS[0];
let pendingFlagDelete = null;
let closeFlagMenu = null;
/* Module-level, because paintFlags() is called from the save and delete
   handlers as well as from initFlags — they all have to page the same list. */
let flagPager = null;

function initFlags() {
  const table = document.getElementById('flagTable');
  const foot = document.querySelector('[data-foot="flags"]');
  if (!table || !foot) return;

  flagPager = createPager(foot, {
    noun: 'flags',
    testidPrefix: 'pvs-flags',
    onChange: () => paintFlags(),
  });

  paintFlags();
  initFlagEditor();
  initFlagDelete();

  document
    .querySelector('[data-testid="pvs--add-flag"]')
    ?.addEventListener('ui-click', (event) => openFlagEditor(null, event.target));
}

function paintFlags() {
  const table = document.getElementById('flagTable');
  if (!table) return;

  table.columns = [
    { key: 'name', label: 'Flag Name', sortable: true, truncate: true },
    { key: 'colour', label: 'Color', narrow: true, render: (row) => swatchMarkup(row.colour, 'ui-swatch--lg') },
    { key: 'updated', label: 'Updated Date', narrow: true },
    { key: 'created', label: 'Created Date', narrow: true },
    {
      key: 'menu',
      label: 'Action',
      actions: true,
      render: (row) => `<button type="button" class="ui-row-menu-btn" data-flag-menu="${row.id}"
          aria-haspopup="menu" aria-expanded="false"
          aria-label="Actions for ${esc(row.name)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
        </button>`,
    },
  ];
  const { start, end } = flagPager.render(flags.length);
  const slice = flags.slice(start, end);
  table.rows = slice;
  table.setAttribute('state', slice.length ? 'ready' : 'empty');

  table.querySelectorAll('[data-flag-menu]').forEach((button) =>
    button.addEventListener('click', () =>
      flagMenu(flags.find((f) => f.id === button.dataset.flagMenu), button)
    )
  );
}

/**
 * Parented to <body>: the table scrolls inside itself, so a panel inside the
 * cell would be clipped by that overflow. Coordinates go through a generated
 * stylesheet rather than a style attribute, matching Master.
 */
function flagMenu(flag, trigger) {
  openRowMenu(trigger, [
    { label: 'Edit', icon: 'pencil', run: () => openFlagEditor(flag, trigger) },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      testid: 'pvs--flag-menu-delete',
      run: () => confirmFlagDelete(flag, trigger),
    },
  ]);
}

/** One <style> element per id, created on first use. */
function sheet(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function openFlagEditor(flag, trigger) {
  const modal = document.getElementById('flagModal');
  const name = document.getElementById('flagName');
  if (!modal || !name) return;

  editingFlag = flag;
  draftColour = flag?.colour ?? FLAG_COLOURS[0];

  modal.setAttribute('heading', flag ? 'Edit Patient Flag' : 'Add New Patient Flag');
  name.setAttribute('value', flag?.name ?? '');
  name.removeAttribute('error');
  paintPalette();
  modal.open(trigger);
}

function paintPalette() {
  const grid = document.getElementById('flagPalette');
  if (!grid) return;

  grid.innerHTML = FLAG_COLOURS.map(
    (hex) => `<button type="button" role="radio" class="pvs__swatch ${swatchClass(hex)}"
      data-colour="${hex}" aria-checked="${hex === draftColour}" aria-label="${hex}"></button>`
  ).join('');

  grid.querySelectorAll('[data-colour]').forEach((swatch) =>
    swatch.addEventListener('click', () => {
      draftColour = swatch.dataset.colour;
      paintPalette();
    })
  );
}

function initFlagEditor() {
  const modal = document.getElementById('flagModal');
  if (!modal) return;

  modal.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) return modal.close();
    if (!event.target.closest('[data-testid="pvs--flag-save"]')) return;

    const field = document.getElementById('flagName');
    const name = String(field.value ?? '').trim();
    field.setAttribute('value', name);
    if (!name) return field.setAttribute('error', 'Flag Name is required');

    // Two flags with the same name are indistinguishable on every chart that
    // carries one, so the name is the key here.
    const clash = flags.some(
      (f) => f !== editingFlag && f.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) return field.setAttribute('error', `${name} is already a flag`);
    field.removeAttribute('error');

    if (editingFlag) {
      Object.assign(editingFlag, { name, colour: draftColour, updated: FLAG_TODAY });
    } else {
      flags = [
        { id: `pf-new-${flags.length + 1}`, name, colour: draftColour, updated: FLAG_TODAY, created: FLAG_TODAY },
        ...flags,
      ];
      // The new flag is at the top of the list; page one is where that is.
      // Saving from page four would otherwise read as "nothing happened".
      flagPager?.reset();
    }

    registerSwatches([...LOCATIONS.map((l) => l.colour), ...FLAG_COLOURS, ...flags.map((f) => f.colour)]);
    paintFlags();
    modal.close();
    flash(`${name} saved.`);
    editingFlag = null;
  });
}

function confirmFlagDelete(flag, trigger) {
  const modal = document.getElementById('flagDeleteModal');
  const body = document.getElementById('flagDeleteBody');
  if (!modal || !body) return;

  pendingFlagDelete = flag.id;
  body.innerHTML = `<p>Remove <strong>${esc(flag.name)}</strong> from this practice?
    Charts already carrying it keep the flag on their record — it just stops
    being offered from now on.</p>`;
  modal.open(trigger);
}

function initFlagDelete() {
  const modal = document.getElementById('flagDeleteModal');
  if (!modal) return;

  modal.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) return modal.close();
    if (!event.target.closest('[data-testid="pvs--flag-delete-confirm"]')) return;

    const gone = flags.find((f) => f.id === pendingFlagDelete);
    flags = flags.filter((f) => f.id !== pendingFlagDelete);
    pendingFlagDelete = null;
    paintFlags();
    modal.close();
    // The row that opened this dialog is gone, so focus cannot return to it.
    document.querySelector('[data-testid="pvs--add-flag"]')?.focus();
    if (gone) flash(`${gone.name} deleted.`);
  });
}
