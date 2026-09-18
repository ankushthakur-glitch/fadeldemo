/**
 * The four dialogs on Medication Inventory.
 *
 *   ADD NEW STOCK   a delivery arrives and becomes a lot
 *   RECORD WASTE    stock was destroyed rather than given
 *   ADJUST QUANTITY the count moved for any other reason
 *   REMOVE LOT      the box is gone entirely
 *
 * Adjust exists because without it the only number that can ever change is the
 * one going up, and a list that only counts arrivals is a delivery log rather
 * than an inventory. It asks for a reason for the same admission: a count that
 * moved with nothing recorded against it is exactly what an audit cannot
 * answer six months later.
 *
 * WASTE IS NOT AN ADJUSTMENT, which is why it has its own dialog. A dispensed
 * unit reached a patient; a wasted one did not, and somebody has to account
 * for it. It is a cost line, a quality signal and — for biologics — reportable,
 * so it accumulates as a named log rather than disappearing into a count that
 * silently went down.
 *
 * "Damaged" and "Expired — withdrawn" used to sit in the Adjust reason list
 * and are gone from it: both are waste, and leaving two routes to one outcome
 * is how half the wastage ends up in a figure nobody is looking at.
 */
import {
  MANUFACTURERS,
  MEDICATION_TYPES,
  TODAY,
  WASTE_REASONS,
  STOCK_HANDLERS,
} from '../../data/medication-inventory.js';
import { notify } from '../lib/toast.js';

/** Why a count moved, when it is NOT waste. */
const ADJUST_REASONS = [
  'Dispensed to patient',
  'Administered in clinic',
  'Returned to supplier',
  'Stock count correction',
  'Transferred to another site',
];

/*
 * A save the form would not take.
 *
 * Each of these dialogs used to carry a red band across the top of itself
 * saying this. The band is gone: the words go to the toast every other report
 * in the EHR uses, and the fields keep their own rings and messages, which are
 * the half of the answer a floating card cannot give.
 */
const refused = () => notify('Check the fields marked above.', 'warning');

const el = (id) => document.getElementById(id);
const field = (testid) => document.querySelector(`[data-testid="${testid}"]`);

const escapeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Same wording the tables use — a raw 2026-06-02 beside "9 May 2026" reads
    as data that leaked out of the database. */
function longDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Attach a native <datalist> to a typed field.
 *
 * These three used to be dropdowns and are now free text, because none of them
 * has a closed set of answers: a delivery arrives from whoever packed it, the
 * person who wasted a vial is often not a system user, and the useful reason is
 * always the one nobody added to the list. But the common answers are still
 * common — a datalist keeps them one keystroke away without making them the
 * only ones allowed.
 */
function suggest(inputId, listId, values) {
  const host = el(inputId);
  const control = host?.querySelector('input');
  if (!control) return;

  const list = document.createElement('datalist');
  list.id = listId;
  list.innerHTML = values
    .map((value) => `<option value="${escapeText(value)}"></option>`)
    .join('');
  host.appendChild(list);
  control.setAttribute('list', listId);
}

/**
 * Write a ui-button's visible label.
 *
 * Never assign textContent to the host: ui-button captures its label at upgrade
 * time and rebuilds its own innards, so writing to the host wipes the rendered
 * button. The span it renders is the thing to write.
 */
function setButtonLabel(button, label) {
  const span = button?.querySelector('.ui-btn__label') ?? button?.querySelector('span:not([class])');
  if (span) span.textContent = label;
}

/** Lock a ui-input / ui-select the way the rest of the system greys a field. */
function setLocked(node, locked) {
  const control = node?.querySelector('input, select');
  if (!control) return;
  control.disabled = locked;
  node.querySelector('.ui-input')?.classList.toggle('ui-input--disabled', locked);
}

/**
 * @param medications  the catalogue
 * @param thresholds   Map medicationId → reorder point, edited in place
 * @param getEntries / setEntries  the lot list the screen is holding
 * @param onChange     repaint whichever view is showing
 * @param flash        the screen's own status line
 */
export function initStockForms({
  medications,
  thresholds,
  getEntries,
  setEntries,
  onChange,
  flash,
}) {
  const stockModal = el('stockModal');
  const adjustModal = el('adjustModal');
  const wasteModal = el('wasteModal');
  const medicationModal = el('medicationModal');
  const lotModal = el('lotModal');

  const medicationSelect = el('stockMedication');
  const typeField = el('stockType');
  const manufacturerField = el('stockManufacturer');

  medicationSelect.optionList = medications.map((m) => ({ value: m.id, label: m.name }));
  el('adjustReason').optionList = ADJUST_REASONS.map((r) => ({ value: r, label: r }));
  el('medicationType').optionList = MEDICATION_TYPES.map((t) => ({ value: t, label: t }));

  /* Manufacturer, Wasted by and Reason are typed now, not picked. MANUFACTURERS,
     STOCK_HANDLERS and WASTE_REASONS survive as the suggestion lists behind
     them — the common answers stay one keystroke away without being the only
     answers allowed. */
  suggest('stockManufacturer', 'manufacturerList', MANUFACTURERS);
  suggest('wasteBy', 'wasteByList', STOCK_HANDLERS);
  suggest('wasteReason', 'wasteReasonList', WASTE_REASONS);

  let nextId = 1;
  const newId = (stem) => `${stem}-new-${nextId++}`;

  /* ===================== Add new stock ===================== */

  /** The type belongs to the medication, so it follows the choice above it. */
  function applyMedication(medId) {
    const medication = medications.find((m) => m.id === medId);
    typeField.setAttribute('value', medication?.type ?? '');
  }

  medicationSelect.addEventListener('ui-change', (event) => {
    medicationSelect.removeAttribute('error');
    applyMedication(event.detail.value);
  });

  /*
   * An error clears as soon as the field it is about changes.
   *
   * Without this a message sits under a field that has already been corrected
   * until the next save attempt — so the dialog is telling you off for
   * something you have just fixed, and the only way to find out whether it is
   * still true is to press the button and see. Validation earns its keep by
   * being current.
   */
  for (const id of [
    'stockLot', 'stockExpiry', 'stockQuantity', 'stockManufacturer',
    'wasteQuantity', 'wasteReason', 'wasteBy',
    'adjustQuantity', 'adjustReason',
  ]) {
    const node = el(id);
    for (const type of ['ui-input', 'ui-change']) {
      node?.addEventListener(type, () => node.removeAttribute('error'));
    }
  }

  function openStock(medId, trigger) {
    for (const id of ['med--f-medication', 'med--f-manufacturer', 'med--f-lot',
      'med--f-expiry', 'med--f-quantity']) {
      field(id)?.removeAttribute('error');
    }

    el('stockLot').setAttribute('value', '');
    el('stockExpiry').setAttribute('value', '');
    el('stockQuantity').setAttribute('value', '');
    manufacturerField.setAttribute('value', '');
    el('stockVendor').setAttribute('value', '');

    medicationSelect.setAttribute('value', medId || '');
    applyMedication(medId);

    /* Opened from a medication, the choice is already made — so it is shown
       filled and locked rather than removed. Someone booking in a box needs to
       see WHICH medication it is going against before they type a lot number. */
    setLocked(medicationSelect, Boolean(medId));

    stockModal.open(trigger);
  }

  function saveStock() {
    const values = {
      medId: medicationSelect.value,
      manufacturer: manufacturerField.value.trim(),
      vendor: el('stockVendor').value.trim(),
      lot: el('stockLot').value.trim(),
      expiry: el('stockExpiry').value,
      quantity: el('stockQuantity').value,
    };

    let valid = true;
    const require = (testid, ok, message) => {
      const node = field(testid);
      if (ok) node.removeAttribute('error');
      else {
        node.setAttribute('error', message);
        valid = false;
      }
    };

    require('med--f-medication', values.medId, 'Choose a medication');
    require('med--f-manufacturer', values.manufacturer, 'Enter who made it');
    require('med--f-lot', values.lot, 'Enter the lot number from the box');
    require('med--f-expiry', values.expiry, 'Enter the expiry printed on the box');
    require(
      'med--f-quantity',
      values.quantity !== '' && Number(values.quantity) > 0,
      'Enter how many arrived'
    );

    /* A lot number is the identity of a physical box. Two rows sharing one is
       two counts of the same stock, and no way to tell which is right. */
    if (valid && getEntries().some((e) => e.lot.toLowerCase() === values.lot.toLowerCase())) {
      field('med--f-lot').setAttribute('error', 'That lot number is already booked in');
      valid = false;
    }

    /* Refused, not warned. Booking in stock that cannot be given is how a
       shelf ends up holding something nobody may use. */
    if (valid && values.expiry <= TODAY) {
      field('med--f-expiry').setAttribute('error', 'That date has already passed');
      valid = false;
    }

    if (!valid) {
      /* The ring and the message under each field say WHICH; the toast says
         that the save did not happen at all — the one part of the answer the
         field markers cannot give, and the part that is easy to miss on a form
         this long. */
      refused();
      return;
    }

    const medication = medications.find((m) => m.id === values.medId);

    setEntries([
      ...getEntries(),
      {
        id: newId('stk'),
        medicationId: medication.id,
        lot: values.lot,
        manufacturer: values.manufacturer,
        // Optional: a box collected from the manufacturer direct has no
        // wholesaler in between, and an empty string would claim it did.
        vendor: values.vendor || null,
        addedOn: TODAY,
        // Whoever is signed in. Provenance for a physical count.
        addedBy: 'Amara Mensah',
        quantity: Number(values.quantity),
        // What arrived, so later adjustments can say how much of the box is left.
        received: Number(values.quantity),
        expiry: values.expiry,
      },
    ]);

    stockModal.close();
    onChange();
    flash(`${values.quantity} of ${medication.name} booked in as ${values.lot}.`);
  }

  el('stockSave').addEventListener('ui-click', saveStock);
  el('stockCancel').addEventListener('ui-click', () => stockModal.close());

  /* ===================== Adjust ===================== */

  let adjusting = null;

  function openAdjust(lot, trigger) {
    adjusting = lot;
    el('adjustLead').textContent =
      `${lot.lot} · ${lot.manufacturer} · currently ${lot.quantity} in stock.`;
    el('adjustQuantity').setAttribute('value', String(lot.quantity));
    el('adjustQuantity').removeAttribute('error');
    el('adjustReason').setAttribute('value', '');
    el('adjustReason').removeAttribute('error');
    adjustModal.open(trigger);
  }

  el('adjustSave').addEventListener('ui-click', () => {
    const next = el('adjustQuantity').value;
    const reason = el('adjustReason').value;

    let valid = true;
    if (next === '' || Number(next) < 0) {
      el('adjustQuantity').setAttribute('error', 'Enter the new count — zero or more');
      valid = false;
    } else el('adjustQuantity').removeAttribute('error');

    if (!reason) {
      el('adjustReason').setAttribute('error', 'Say why the count changed');
      valid = false;
    } else el('adjustReason').removeAttribute('error');

    if (!valid) return;

    const quantity = Number(next);
    const delta = quantity - adjusting.quantity;

    setEntries(
      getEntries().map((entry) =>
        entry.id === adjusting.id ? { ...entry, quantity } : entry
      )
    );

    adjustModal.close();
    onChange();
    flash(
      `${adjusting.lot} set to ${quantity}` +
        (delta ? ` (${delta > 0 ? '+' : ''}${delta})` : '') +
        ` — ${reason}.`
    );
    adjusting = null;
  });

  el('adjustCancel').addEventListener('ui-click', () => adjustModal.close());

  /* ===================== Waste ===================== */

  let wasting = null;

  function openWaste(lot, trigger) {
    wasting = lot;
    el('wasteLead').textContent =
      `${lot.lot} · ${lot.manufacturer} · ${lot.quantity} in stock.`;

    el('wasteQuantity').setAttribute('value', '');
    el('wasteQuantity').removeAttribute('error');
    el('wasteReason').setAttribute('value', '');
    el('wasteReason').removeAttribute('error');
    // Whoever is at the machine, changeable — the person who wasted it is
    // often not the person recording it.
    el('wasteBy').setAttribute('value', 'Amara Mensah');
    el('wasteBy').removeAttribute('error');

    paintWasteHistory(lot);
    wasteModal.open(trigger);
  }

  /** What has already been written off this lot, so it is not recorded twice. */
  function paintWasteHistory(lot) {
    const host = el('wasteHistory');
    const records = lot.waste ?? [];
    host.hidden = records.length === 0;
    if (!records.length) return;

    host.innerHTML =
      `<h3 class="med__history-title">Already written off</h3>` +
      records
        .map(
          (record) => `<div class="med__history-row">
            <span class="med__history-qty">${record.quantity}</span>
            <span class="med__history-body">
              ${escapeText(record.reason)}
              <small>${escapeText(record.by)} · ${longDate(record.on)}</small>
            </span>
          </div>`
        )
        .join('');
  }

  el('wasteSave').addEventListener('ui-click', () => {
    const quantity = el('wasteQuantity').value;
    const reason = el('wasteReason').value;
    const by = el('wasteBy').value;

    let valid = true;
    const count = Number(quantity);

    if (quantity === '' || count <= 0) {
      el('wasteQuantity').setAttribute('error', 'Enter how many units were wasted');
      valid = false;
    } else if (count > wasting.quantity) {
      /* Refused. More wasted than the shelf holds is either a typo or a count
         that was already wrong, and writing it off would leave the lot at a
         negative quantity — a number that can never be reconciled. */
      el('wasteQuantity').setAttribute(
        'error',
        `Only ${wasting.quantity} in stock — check the count first`
      );
      valid = false;
    } else el('wasteQuantity').removeAttribute('error');

    if (!reason) {
      el('wasteReason').setAttribute('error', 'Say what happened to it');
      valid = false;
    } else el('wasteReason').removeAttribute('error');

    if (!by) {
      el('wasteBy').setAttribute('error', 'Name who wasted it');
      valid = false;
    } else el('wasteBy').removeAttribute('error');

    if (!valid) return;

    setEntries(
      getEntries().map((entry) =>
        entry.id === wasting.id
          ? {
              ...entry,
              quantity: entry.quantity - count,
              waste: [...(entry.waste ?? []), { quantity: count, reason, by, on: TODAY }],
            }
          : entry
      )
    );

    wasteModal.close();
    onChange();
    flash(`${count} of ${wasting.lot} written off — ${reason}, recorded by ${by}.`, 'warning');
    wasting = null;
  });

  el('wasteCancel').addEventListener('ui-click', () => wasteModal.close());

  /* ===================== Edit medication =====================
     The medication itself, not a box of it: name, type, reorder point. All
     three are true of every lot on the shelf, which is why they are set once
     here rather than re-answered on each delivery — Threshold used to live in
     Add Stock, where every booking-in was a chance to reset it by accident. */

  let editing = null;

  /**
   * One dialog, two modes.
   *
   * Called with an id it edits that medication; called with none it adds one to
   * the catalogue — which is what "Add Medication" on the list has to mean now
   * it is not called "Add Stock". The two ask for exactly the same three
   * things, so a second dialog would be the same form twice, drifting.
   *
   * Adding a medication does NOT book in stock. A drug the practice has agreed
   * to hold and a box of it physically on the shelf are different facts, and
   * the new medication reads Out of Stock until a lot arrives — which is true.
   */
  function openMedication(medId, trigger) {
    editing = medId ? medications.find((m) => m.id === medId) : null;

    for (const id of ['med--m-name', 'med--m-type']) field(id)?.removeAttribute('error');

    el('medicationName').setAttribute('value', editing?.name ?? '');
    el('medicationType').setAttribute('value', editing?.type ?? '');
    el('medicationThreshold').setAttribute(
      'value',
      editing ? String(thresholds.get(editing.id) ?? editing.threshold) : ''
    );

    medicationModal.setAttribute('heading', editing ? 'Edit medication' : 'Add medication');
    setButtonLabel(el('medicationSave'), editing ? 'Save' : 'Add medication');

    medicationModal.open(trigger);
  }

  el('medicationSave').addEventListener('ui-click', () => {
    const name = el('medicationName').value.trim();
    const type = el('medicationType').value;
    const threshold = el('medicationThreshold').value;

    let valid = true;
    if (!name) {
      field('med--m-name').setAttribute('error', 'Give the medication a name');
      valid = false;
    } else field('med--m-name').removeAttribute('error');

    if (!type) {
      field('med--m-type').setAttribute('error', 'Choose a type');
      valid = false;
    } else field('med--m-type').removeAttribute('error');

    if (!valid) {
      refused();
      return;
    }

    /* Two names for one drug is two shelves for one drug, and a count split
       across both. Checked on add, and on rename against everything else. */
    const clash = medications.some(
      (m) => m !== editing && m.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) {
      field('med--m-name').setAttribute('error', 'That medication is already in the catalogue');
      refused();
      return;
    }

    const reorder = threshold !== '' && Number(threshold) >= 0 ? Number(threshold) : 0;

    if (editing) {
      // Edited in place: the catalogue is the same array the list paints from,
      // so there is one copy of a medication's name rather than two that drift.
      editing.name = name;
      editing.type = type;
      thresholds.set(editing.id, reorder);
    } else {
      const created = { id: newId('med'), name, type, threshold: reorder };
      medications.push(created);
      thresholds.set(created.id, reorder);
      // The medication dropdown in Add Stock is built once at init, so it has
      // to learn about the new one or it could never have stock booked in.
      medicationSelect.optionList = medications.map((m) => ({ value: m.id, label: m.name }));
    }

    medicationModal.close();
    onChange();
    flash(editing ? `${name} updated.` : `${name} added to the catalogue.`);
    editing = null;
  });

  el('medicationCancel').addEventListener('ui-click', () => medicationModal.close());

  /* ===================== Lot details =====================
     Everything recorded against one box, and the whole waste log rather than a
     total. Six wasted in one go is a dropped tray; six across four occasions is
     a process problem — and the single figure in the lot table cannot tell
     those apart. */

  let viewingLot = null;

  function openLot(lot, trigger) {
    viewingLot = lot;

    const facts = [
      ['Lot Number', lot.lot],
      ['Manufacturer', lot.manufacturer],
      ['Vendor', lot.vendor || '—'],
      ['Added On', longDate(lot.addedOn)],
      ['Added by', lot.addedBy],
      ['Received', String(lot.received ?? lot.quantity)],
      ['Available', String(lot.quantity)],
      ['Expiry Date', longDate(lot.expiry)],
    ];

    el('lotFacts').innerHTML = facts
      .map(
        ([label, value]) =>
          `<div class="med__lot-fact"><dt>${escapeText(label)}</dt><dd>${escapeText(
            value
          )}</dd></div>`
      )
      .join('');

    paintLotWaste(lot);
    lotModal.open(trigger);
  }

  /** Every write-off against this lot, newest first, each with its own date. */
  function paintLotWaste(lot) {
    const records = lot.waste ?? [];
    const host = el('lotWaste');

    if (!records.length) {
      host.innerHTML = `<p class="med__lot-empty">Nothing has been written off this lot.</p>`;
      return;
    }

    const total = records.reduce((sum, r) => sum + r.quantity, 0);

    host.innerHTML =
      `<p class="med__lot-total">${total} unit${total === 1 ? '' : 's'} written off across ${
        records.length
      } ${records.length === 1 ? 'entry' : 'entries'}.</p>` +
      [...records]
        .reverse()
        .map(
          (record) => `<div class="med__history-row">
            <span class="med__history-qty">${record.quantity}</span>
            <span class="med__history-body">
              ${escapeText(record.reason)}
              <small>${escapeText(record.by)} · ${longDate(record.on)}</small>
            </span>
          </div>`
        )
        .join('');
  }

  el('lotClose').addEventListener('ui-click', () => lotModal.close());

  /* Straight from the log into recording another — the reason someone opens
     this is usually that they are about to add to it. */
  el('lotWasteAdd').addEventListener('ui-click', () => {
    const lot = viewingLot;
    lotModal.close();
    if (lot) openWaste(lot, el('lotWasteAdd'));
  });

  return { openStock, openAdjust, openWaste, openMedication, openLot };
}
