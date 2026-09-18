/**
 * The Location Form — shared by "Add New Location" and editing an existing
 * one. Built from the gGastro Location Form: the location's own attributes on
 * the left, its related lists and identifiers on the right.
 *
 * Exported as markup + a wiring function so the same form can be dropped into
 * any page. It deliberately knows nothing about where it is used.
 */
import {
  BUSINESS_UNITS,
  LOCATION_COLOURS,
  LOCATION_ID_FIELDS,
  PLACES_OF_SERVICE,
  STATES,
} from '../../data/practice.js';

/** Class name generated for a runtime colour — mirrors lib/swatches.js. */
export function swatchClassFor(hex) {
  return `ui-swatch--${String(hex).replace('#', '').toLowerCase()}`;
}

/**
 * A small editable table. Contact Numbers, Billing type, Cost Centers, Users,
 * Connection Mappings and DFT Billing Type all take this shape in the legacy
 * form: a header, an add control, and rows that can be removed.
 */
function miniTable({ id, title, columns, rows = [] }) {
  const head = columns.map((c) => `<th scope="col">${c.label}</th>`).join('');
  const body = rows.length
    ? rows
        .map(
          (row, index) => `<tr>
            ${columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}
            <td class="prc__mini-actions">
              <button type="button" class="set__icon-danger" data-mini-remove="${index}"
                      aria-label="Remove row ${index + 1} from ${title}">
                <svg class="ui-icon"><use href="#i-trash"></use></svg>
              </button>
            </td>
          </tr>`
        )
        .join('')
    : `<tr><td class="prc__mini-empty" colspan="${columns.length + 1}">Nothing added yet.</td></tr>`;

  return `<section class="prc__mini" data-mini="${id}">
    <div class="prc__mini-head">
      <span>${title}</span>
      <button type="button" class="set__add-block" data-mini-add="${id}"
              aria-label="Add to ${title}">
        <svg class="ui-icon"><use href="#i-plus"></use></svg>
      </button>
    </div>
    <table class="prc__mini-table">
      <thead><tr>${head}<th scope="col"><span class="u-sr-only">Actions</span></th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

function locationIdBlock(ids) {
  return `<section class="prc__mini">
    <div class="prc__mini-head"><span>Location ID's</span></div>
    <div class="prc__id-grid">
      ${LOCATION_ID_FIELDS.map(
        ([key, label]) =>
          `<ui-input label="${label}" value="${ids[key] || ''}"
                     data-id-field="${key}"></ui-input>`
      ).join('')}
    </div>
  </section>`;
}

/** An empty location, shaped like the records in the data file. */
export function blankLocation() {
  return {
    name: '',
    businessUnit: '',
    colour: '',
    description: '',
    active: true,
    placeOfService: '',
    directAddress: '',
    outsideLab: false,
    taxRate: '',
    contactPerson: { first: '', middle: '', last: '' },
    address: { line1: '', line2: '', city: '', state: '', zip: '' },
    facilityName: '',
    contactNumbers: [],
    billingTypes: [],
    costCentres: [],
    ids: Object.fromEntries(LOCATION_ID_FIELDS.map(([key]) => [key, ''])),
  };
}

export function locationFormMarkup(location = blankLocation()) {
  const c = location.contactPerson;
  const a = location.address;

  return `<div class="prc__loc-cols">
    <!-- ============ LEFT ============ -->
    <div class="prc__loc-col">
      <section class="prc__mini">
        <div class="prc__mini-head"><span>Location Form</span></div>
        <div class="prc__loc-fields">
          <ui-select label="Business Unit" placeholder="Select Business Unit"
                     options="${BUSINESS_UNITS.join(',')}" value="${location.businessUnit}"
                     data-testid="loc--business-unit"></ui-select>
          <ui-input label="Name" placeholder="Enter Location Name" required
                    value="${location.name}" data-testid="loc--name"></ui-input>

          <div class="prc__colour-field">
            <ui-select label="Color" placeholder="Select Colour"
                       options="${LOCATION_COLOURS.join(',')}" value="${location.colour}"
                       data-testid="loc--colour"></ui-select>
            <span class="ui-swatch ui-swatch--lg ${
              location.colour ? swatchClassFor(location.colour) : ''
            }" id="locationSwatch" data-testid="loc--colour-preview"></span>
          </div>

          <ui-textarea label="Description" rows="3" placeholder="Enter Description"
                       value="${location.description}"></ui-textarea>

          <ui-select label="Status" options="Active,Inactive"
                     value="${location.active ? 'Active' : 'Inactive'}"
                     data-testid="loc--status"></ui-select>
          <ui-select label="Place of service" placeholder="Select Place of Service"
                     options="${PLACES_OF_SERVICE.join(',')}"
                     value="${location.placeOfService}"></ui-select>
          <ui-input label="Direct Address" placeholder="Enter Direct Address"
                    value="${location.directAddress}"></ui-input>

          <ui-checkbox ${location.outsideLab ? 'checked' : ''}
                       data-testid="loc--outside-lab">Outside Lab</ui-checkbox>
          <ui-input label="Tax Rate" placeholder="0.00" hint="Percent"
                    value="${location.taxRate}" data-testid="loc--tax-rate"></ui-input>
        </div>
      </section>

      <section class="prc__mini">
        <div class="prc__mini-head"><span>Contact Person</span></div>
        <div class="prc__form-grid">
          <ui-input label="First Name" placeholder="First" value="${c.first}"></ui-input>
          <ui-input label="Middle" placeholder="Middle" value="${c.middle}"></ui-input>
          <ui-input label="Last Name" placeholder="Last" value="${c.last}"></ui-input>
        </div>
      </section>

      <section class="prc__mini">
        <div class="prc__mini-head"><span>Located at</span></div>
        <div class="prc__form-grid">
          <!-- Address Line 1 · Address Line 2 · City · State · ZIP — the one
               order every address block on this system uses. -->
          <ui-input class="prc__span-all" label="Address Line 1" placeholder="Street address"
                    value="${a.line1}"></ui-input>
          <ui-input class="prc__span-all" label="Address Line 2" placeholder="Suite, building, etc."
                    value="${a.line2}"></ui-input>
          <ui-input label="City" placeholder="Enter City" value="${a.city}"></ui-input>
          <ui-select label="State" placeholder="Select State" options="${STATES.join(',')}"
                     value="${a.state}"></ui-select>
          <ui-input label="ZIP" placeholder="Enter ZIP" value="${a.zip}"></ui-input>
        </div>
      </section>

      <!-- NO PATIENT PORTAL SECTION.
           Three controls stood here — Show on Portal, Set as portal default,
           and a second display name to show patients — and the portal reads
           none of them. It has its own site list, its own copy, and its own
           idea of which clinic a patient belongs to; nothing it renders has
           ever come from this panel. What the three fields actually did was
           offer the practice a second name for a place that already has one,
           on a screen where getting them out of step is invisible until a
           patient rings up asking about a clinic nobody here has heard of. A
           location has one name, and it is the field at the top of this
           form. -->
    </div>

    <!-- ============ RIGHT ============ -->
    <div class="prc__loc-col">
      ${miniTable({
        id: 'contactNumbers',
        title: 'Contact Numbers',
        columns: [{ key: 'type', label: 'Type' }, { key: 'number', label: 'Contact Number' }],
        rows: location.contactNumbers,
      })}

      <ui-input label="Facility Name (for Billing)" placeholder="Enter Facility Name"
                value="${location.facilityName}" data-testid="loc--facility-name"></ui-input>

      ${miniTable({
        id: 'billingTypes',
        title: 'Billing type per business unit',
        columns: [{ key: 'unit', label: 'Business Unit' }, { key: 'type', label: 'Billing Type' }],
        rows: location.billingTypes,
      })}

      ${miniTable({
        id: 'costCentres',
        title: 'Cost Centers',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'effective', label: 'Effective Date' },
          { key: 'expiration', label: 'Expiration Date' },
        ],
        rows: location.costCentres,
      })}

      ${locationIdBlock(location.ids)}

      ${miniTable({
        id: 'users',
        title: 'Users',
        columns: [
          { key: 'first', label: 'First Name' },
          { key: 'last', label: 'Last Name' },
          { key: 'middle', label: 'Middle Name' },
        ],
      })}

      ${miniTable({
        id: 'connections',
        title: 'Connection Mappings',
        columns: [{ key: 'interface', label: 'Interface' }, { key: 'vendor', label: 'Vendor Item' }],
      })}

      ${miniTable({
        id: 'dft',
        title: 'DFT Billing Type',
        columns: [{ key: 'source', label: 'Source' }, { key: 'type', label: 'Billing Type' }],
      })}
    </div>
  </div>`;
}

/** Colour preview + the mini-table repeaters. */
export function wireLocationForm(root) {
  const colourSelect = root.querySelector('[data-testid="loc--colour"]');
  const swatch = root.querySelector('#locationSwatch');

  colourSelect?.addEventListener('ui-change', (event) => {
    const hex = event.detail.value;
    swatch.className = `ui-swatch ui-swatch--lg ${hex ? swatchClassFor(hex) : ''}`;
    swatch.title = hex || '';
  });

  root.querySelectorAll('[data-mini-add]').forEach((button) =>
    button.addEventListener('click', () => {
      const section = button.closest('.prc__mini');
      const tbody = section.querySelector('tbody');
      const columnCount = section.querySelectorAll('thead th').length - 1;

      // Clear the "nothing added yet" placeholder on first use.
      if (tbody.querySelector('.prc__mini-empty')) tbody.innerHTML = '';

      const cells = Array.from(
        { length: columnCount },
        () => '<td><ui-input label="Value" label-hidden placeholder="—"></ui-input></td>'
      ).join('');

      tbody.insertAdjacentHTML(
        'beforeend',
        `<tr>${cells}<td class="prc__mini-actions">
           <button type="button" class="set__icon-danger" data-mini-remove
                   aria-label="Remove this row">
             <svg class="ui-icon"><use href="#i-trash"></use></svg>
           </button>
         </td></tr>`
      );
      wireMiniRemoval(tbody);
    })
  );

  root.querySelectorAll('.prc__mini-table tbody').forEach(wireMiniRemoval);
}

function wireMiniRemoval(tbody) {
  tbody.querySelectorAll('[data-mini-remove]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = 'true';
    button.addEventListener('click', () => {
      const columnCount = tbody.closest('table').querySelectorAll('thead th').length;
      button.closest('tr').remove();
      if (!tbody.children.length) {
        tbody.innerHTML = `<tr><td class="prc__mini-empty" colspan="${columnCount}">Nothing added yet.</td></tr>`;
      }
    });
  });
}
