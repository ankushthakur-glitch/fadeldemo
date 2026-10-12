/**
 * PRESCRIPTIONS — every script written for this patient, and the dialog that
 * writes a new one.
 *
 * WHAT THE SECTION IS. A table, one row per medication, newest first, active
 * and past together with a status on each. It used to be an empty frame held
 * open for the e-prescribing vendor's own window, and a frame with nothing in
 * it could not be demonstrated: the one thing somebody opens this section to
 * see — what has this patient been prescribed, by whom, sent where — was not
 * on it. The Medication module still carries the reconciled list (drugs
 * started elsewhere, drugs given under sedation); this is the narrower record
 * of scripts this practice wrote.
 *
 * ONE PRESCRIPTION, SEVERAL MEDICATIONS. A prescription is one prescriber and
 * one pharmacy, sent once, and it can carry as many drugs as the visit needs —
 * a PPI, an antiemetic and a bowel prep are routinely written together. The
 * dialog is built that way: the prescriber, pharmacy and pharmacist note are
 * asked once, one medication is written at a time in the form, and each is
 * added to a side panel listing what the prescription holds. Sending files
 * one row per medication under a shared Rx number, which is the column that
 * lets the table show which rows went out together.
 *
 * WHERE A SENT SCRIPT GOES. Into data/chart-prescriptions.js for the session,
 * which both this table and Medication's Active tab read — so the script is on
 * both screens at once, and gone on reload. Nothing is sent anywhere.
 *
 * ctx provides { patient, age, go, flash }.
 */
import { registerModule } from './chart-workspace.js';
import {
  CHART_PRESCRIPTIONS,
  PRESCRIBING_PROVIDERS,
  RX_DRUG_CATALOG,
  RX_SIG_PRESETS,
  RX_DISPENSE_UNITS,
  RX_REFILLS,
  RX_PHARMACIES,
} from '../../data/chart-prescriptions.js';
/* The same diagnosis list Orders offers, so an indication reads the same on a
   script as on the lab or scope it sits beside. */
import { ICD_CODES } from '../../data/chart-orders.js';
/* The demo's fixed "today", so a script written in a walkthrough is dated the
   same day the schedule says it is. */
import { TODAY } from '../../data/schedule.js';

/* ============================================================================
   SMALL HELPERS — kept local, the way every other chart module keeps its own.
   ========================================================================= */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name) {
  return `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "20-02-1961" → "20 Feb 1961". Numeric dates get read the wrong way round. */
function formatDate(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  if (!d || !m || !y) return '—';
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** "20-02-1961" → a number that sorts, for newest-first. */
function sortKey(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  return (y || 0) * 10000 + (m || 0) * 100 + (d || 0);
}

/** ISO "2026-08-04" → the DD-MM-YYYY this record keeps its dates in. */
function fromIso(iso) {
  const [y, m, d] = String(iso || '').split('-');
  return `${d}-${m}-${y}`;
}

/** A script's end date: start plus its days supply for every fill, refills
 *  included, since that is how long the patient is on it if each is collected. */
function endDateFor(daysSupply, refills) {
  const end = new Date(`${TODAY}T00:00:00`);
  end.setDate(end.getDate() + daysSupply * (refills + 1));
  return fromIso(end.toISOString().slice(0, 10));
}

const dash = (value) => (value == null || value === '' ? '—' : esc(value));

/* ============================================================================
   THE TABLE
   ========================================================================= */

/* Completed is the ordinary end of a course and stays quiet; only a script
   somebody stopped is coloured, because that is the one a reader needs to
   ask about. */
const STATUS_TONE = { Active: 'success', Completed: 'neutral', Discontinued: 'critical' };

/** Active and past in one list, newest first, each row carrying its status. */
function prescriptionsFor(mrn) {
  const record = CHART_PRESCRIPTIONS[mrn] || { active: [], past: [] };
  return [
    ...record.active.map((rx) => ({ ...rx, status: 'Active' })),
    ...record.past.map((rx) => ({ ...rx, status: rx.status || 'Completed' })),
  ].sort((a, b) => sortKey(b.startDate) - sortKey(a.startDate));
}

/** The drug, and underneath it what it is for — the same two-line cell
 *  Medication and Orders draw, so a drug looks the same on every list. */
function medicationCell(row) {
  return `<span class="ord__med">
    <strong class="ord__med-name">${esc(row.name)}</strong>
    ${
      row.diagnosis
        ? `<span class="ord__med-meta ord__med-meta--muted">${esc(row.diagnosis)}</span>`
        : ''
    }
  </span>`;
}

const PRESCRIPTION_COLUMNS = [
  { key: 'rxNumber', label: 'Rx #', render: (row) => dash(row.rxNumber) },
  { key: 'name', label: 'Medication', wrap: true, render: medicationCell },
  { key: 'sig', label: 'Directions', wrap: true, render: (row) => `<span class="rx__measure">${dash(row.sig)}</span>` },
  /* What the pharmacy hands over, in one cell: the quantity on top, how long
     it lasts and how many more times it can be filled underneath. Three
     narrow columns of their own pushed the status off the right edge of a
     laptop screen, and they are read together anyway.

     Refills are stored as fills: the first fill is not a refill, and
     "3 refills" is what a prescriber wrote and a pharmacist reads. */
  {
    key: 'dispenseQty',
    label: 'Dispense',
    render: (row) => {
      const refills = row.dispensingCount ? row.dispensingCount - 1 : null;
      const supply = [
        row.daysSupply ? `${esc(row.daysSupply)} days` : '',
        refills == null ? '' : `${refills} ${refills === 1 ? 'refill' : 'refills'}`,
      ].filter(Boolean).join(' · ');
      return `<span class="ord__med">
        <span>${row.dispenseQty == null ? '—' : `${esc(row.dispenseQty)} ${esc(row.dispenseUnit || '')}`}</span>
        ${supply ? `<span class="ord__med-meta">${supply}</span>` : ''}
      </span>`;
    },
  },
  { key: 'startDate', label: 'Prescribed On', render: (row) => formatDate(row.startDate) },
  /* Who wrote it and where it went, in one cell. They are read together —
     "Mensah, to the CVS on 13th" — and a pharmacy column of its own pushed the
     status off the right edge of a laptop screen. */
  {
    key: 'provider',
    label: 'Prescriber / Pharmacy',
    wrap: true,
    render: (row) => `<span class="ord__med rx__measure">
      <span>${dash(row.provider)}</span>
      <span class="ord__med-meta">${dash(row.pharmacy)}</span>
    </span>`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) =>
      `<ui-badge status="${STATUS_TONE[row.status] || 'neutral'}" size="sm">${esc(row.status)}</ui-badge>`,
  },
];

/* ============================================================================
   THE DIALOG

   Two halves, side by side. On the left, ONE medication being written — the
   form. On the right, the prescription it is going into — the list of
   medications already added. "Add to Prescription" moves what is in the form
   across into the list and clears the form for the next drug; Send sends the
   list.

   It used to be a stack of identical cards, one per drug, all open at once.
   With two or three drugs that was a long scroll of repeated labels in which
   the reader could not see, at a glance, what the prescription actually held.
   The list on the right is that glance: each drug as one compact entry, the
   way it will read on the table once sent, and the form only ever holds the
   one being worked on.
   ========================================================================= */

const EMPTY_MED = { drug: '', sig: '', qty: '30', unit: RX_DISPENSE_UNITS[0], days: '30', refills: '0', diagnosis: '', daw: false };

/**
 * The medication form, drawn with `values` already in it.
 *
 * Re-drawn rather than cleared field by field: after an add it is drawn
 * empty, and on Edit it is drawn with that entry's values — one path for
 * both, and no field left holding the last drug's directions because a reset
 * missed it.
 */
function medFormMarkup(values, editing) {
  return `<div class="ord__field-grid">
    <ui-suggest class="ord__field-wide" id="rxDrug" label="Medication" required
      placeholder="Search drug, strength and form" value="${esc(values.drug)}"
      empty-note="No match — the name will be used as typed"
      data-testid="chart--rx-drug"></ui-suggest>

    <ui-suggest class="ord__field-wide" id="rxSig" label="Directions (Sig)" required
      placeholder="e.g. 1 tablet orally twice daily" value="${esc(values.sig)}"
      data-testid="chart--rx-sig"></ui-suggest>

    <ui-input id="rxQty" label="Dispense Quantity" type="number" required value="${esc(values.qty)}"
      data-testid="chart--rx-qty"></ui-input>
    <ui-select id="rxUnit" label="Dispense Unit" options="${RX_DISPENSE_UNITS.join(',')}"
      value="${esc(values.unit)}" data-testid="chart--rx-unit"></ui-select>

    <ui-input id="rxDays" label="Days Supply" type="number" required value="${esc(values.days)}"
      data-testid="chart--rx-days"></ui-input>
    <ui-select id="rxRefills" label="Refills" options="${RX_REFILLS.join(',')}"
      value="${esc(values.refills)}" data-testid="chart--rx-refills"></ui-select>

    <ui-select class="ord__field-wide" id="rxDiagnosis" label="Diagnosis" placeholder="Select ICD code"
      value="${esc(values.diagnosis)}" data-testid="chart--rx-diagnosis"></ui-select>

    <ui-checkbox class="ord__field-wide" id="rxDaw" ${values.daw ? 'checked' : ''}
      data-testid="chart--rx-daw">Dispense as written — no generic substitution</ui-checkbox>
  </div>

  <div class="rx__form-actions">
    ${
      editing
        ? `<ui-button variant="outline" size="sm" data-rx-cancel-edit
            data-testid="chart--rx-cancel-edit">Cancel Edit</ui-button>`
        : ''
    }
    <ui-button variant="outline" size="sm" icon="${editing ? 'check' : 'plus'}" data-rx-add-med
      data-testid="chart--rx-add-med">${editing ? 'Update Medication' : 'Add to Prescription'}</ui-button>
  </div>`;
}

/** The dispense line every entry carries — the same words the table uses. */
function dispenseLine(med) {
  const refills = Number(med.refills) || 0;
  return `${esc(med.qty)} ${esc(med.unit)} · ${esc(med.days)} days · ${refills} ${
    refills === 1 ? 'refill' : 'refills'
  }`;
}

/**
 * The side panel: what the prescription holds so far.
 *
 * The entry being edited is marked rather than hidden, so the reader can see
 * which one the form on the left is changing.
 */
function medListMarkup(items, editingIndex) {
  if (!items.length) {
    return `<div class="rx__list-empty" data-testid="chart--rx-list-empty">
      <span class="rx__list-empty-mark">${icon('pill')}</span>
      <p>No medications yet. Fill in the form and choose <strong>Add to Prescription</strong>.</p>
    </div>`;
  }
  return `<ol class="rx__list">${items
    .map(
      (med, i) => `<li class="rx__item${i === editingIndex ? ' rx__item--editing' : ''}"
          data-rx-item="${i}" data-testid="chart--rx-item-${i + 1}">
        <div class="rx__item-body">
          <strong class="rx__item-name">${esc(med.drug)}</strong>
          <span class="rx__item-sig">${esc(med.sig)}</span>
          <span class="rx__item-meta">${dispenseLine(med)}${med.daw ? ' · DAW' : ''}</span>
          ${med.diagnosis ? `<span class="rx__item-meta">${esc(med.diagnosis)}</span>` : ''}
        </div>
        <div class="rx__item-actions">
          <button type="button" class="rx__icon-btn" data-rx-edit="${i}"
            aria-label="Edit ${esc(med.drug)}">${icon('pencil')}</button>
          <button type="button" class="rx__icon-btn rx__icon-btn--danger" data-rx-remove="${i}"
            aria-label="Remove ${esc(med.drug)}">${icon('trash')}</button>
        </div>
      </li>`
    )
    .join('')}</ol>`;
}

/**
 * The compose dialog. Built fresh every time it opens, so a half-written
 * prescription from the last attempt is never waiting in it.
 *
 * Prescriber and pharmacy sit across the top, above both halves: they belong
 * to the prescription as a whole, not to any one drug.
 */
function composeModal(ctx) {
  return `<ui-modal id="rxAddModal" heading="Add Prescription" size="xl"
      data-testid="chart--rx-add-modal">
    <div class="rx__patient">
      <strong>${esc(ctx.patient.name)}</strong>
      <span>MRN ${esc(ctx.patient.mrn)}</span>
      <span>${formatDate(ctx.patient.dob)}${ctx.age == null ? '' : ` · ${esc(ctx.age)} yrs`}</span>
      <span>${esc(ctx.patient.gender || '—')}</span>
    </div>

    <div class="ord__field-grid">
      <ui-select id="rxProvider" label="Prescriber" placeholder="Select" required
        data-testid="chart--rx-provider"></ui-select>
      <ui-select id="rxPharmacy" label="Pharmacy" placeholder="Select" required
        data-testid="chart--rx-pharmacy"></ui-select>
    </div>

    <div class="rx__compose">
      <section class="rx__form" aria-labelledby="rxFormTitle">
        <h3 class="rx__pane-title" id="rxFormTitle" data-rx-form-title>New Medication</h3>
        <div data-rx-form>${medFormMarkup(EMPTY_MED, false)}</div>
      </section>

      <aside class="rx__panel" aria-labelledby="rxPanelTitle" data-testid="chart--rx-panel">
        <h3 class="rx__pane-title" id="rxPanelTitle">
          Prescription <span class="rx__count" data-rx-count>0</span>
        </h3>
        <div data-rx-list>${medListMarkup([], -1)}</div>
        <p class="rx__panel-error" data-rx-list-error role="alert" hidden></p>
        <ui-textarea class="rx__note" id="rxNote" label="Note to Pharmacist" rows="2"
          placeholder="Optional" data-testid="chart--rx-note"></ui-textarea>
      </aside>
    </div>

    <div class="ord__modal-actions">
      <ui-button variant="outline" data-rx-dismiss data-testid="chart--rx-add-cancel">Cancel</ui-button>
      <ui-button variant="primary" icon="send" data-rx-send data-testid="chart--rx-send"
        >Send to Pharmacy</ui-button
      >
    </div>
  </ui-modal>`;
}

/** The next Rx number: one past the highest on any chart in the demo. */
function nextRxNumber() {
  const all = Object.values(CHART_PRESCRIPTIONS).flatMap((r) => [...r.active, ...r.past]);
  const max = Math.max(10000, ...all.map((rx) => Number(String(rx.rxNumber || '').replace(/\D/g, '')) || 0));
  return `RX-${max + 1}`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('prescriptions', {
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--rx-add"
      >Add Prescription</ui-button
    >`,

  render(host, ctx) {
    /* The button is the shell's markup, rendered into the head — a sibling of
       this host, not a descendant — so its event is listened for up there. */
    const head = host.parentElement;

    host.innerHTML = `<div class="ord__panel" data-testid="chart--rx-list">
        <ui-data-table empty-text="No prescriptions written for this patient."
          data-testid="chart--rx-table"></ui-data-table>
      </div>
      <div data-rx-modal-slot></div>`;

    const table = host.querySelector('[data-testid="chart--rx-table"]');
    const slot = host.querySelector('[data-rx-modal-slot]');
    let modal = null;

    /* The prescription being composed: the medications added so far, and
       which of them (if any) the form is currently editing. */
    let items = [];
    let editingIndex = -1;

    function paintTable() {
      const rows = prescriptionsFor(ctx.patient.mrn);
      table.columns = PRESCRIPTION_COLUMNS;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    function openCompose(trigger) {
      items = [];
      editingIndex = -1;
      slot.innerHTML = composeModal(ctx);
      modal = slot.querySelector('#rxAddModal');
      modal.querySelector('#rxProvider').setOptions(PRESCRIBING_PROVIDERS);
      modal.querySelector('#rxPharmacy').setOptions(RX_PHARMACIES);
      fillFormOptions();
      modal.open(trigger);
    }

    /* Lists set from data rather than an options attribute: diagnoses carry
       commas, which a comma-joined attribute would split into nonsense. */
    function fillFormOptions() {
      modal.querySelector('#rxDrug').setOptions(RX_DRUG_CATALOG);
      modal.querySelector('#rxSig').setOptions(RX_SIG_PRESETS);
      modal.querySelector('#rxDiagnosis').setOptions(ICD_CODES);
    }

    function paintForm(values) {
      modal.querySelector('[data-rx-form]').innerHTML = medFormMarkup(values, editingIndex >= 0);
      modal.querySelector('[data-rx-form-title]').textContent =
        editingIndex >= 0 ? `Editing Medication ${editingIndex + 1}` : 'New Medication';
      fillFormOptions();
    }

    function paintList() {
      modal.querySelector('[data-rx-list]').innerHTML = medListMarkup(items, editingIndex);
      modal.querySelector('[data-rx-count]').textContent = items.length;
      if (items.length) modal.querySelector('[data-rx-list-error]').hidden = true;
    }

    /* --- The form ------------------------------------------------------------ */

    function readForm() {
      const field = (id) => modal.querySelector(`#${id}`);
      const values = {
        drug: field('rxDrug').value?.trim() || '',
        sig: field('rxSig').value?.trim() || '',
        qty: String(field('rxQty').value ?? '').trim(),
        unit: field('rxUnit').value || RX_DISPENSE_UNITS[0],
        days: String(field('rxDays').value ?? '').trim(),
        refills: field('rxRefills').value || '0',
        diagnosis: field('rxDiagnosis').value || '',
        daw: field('rxDaw').checked,
      };

      ['rxDrug', 'rxSig', 'rxQty', 'rxDays'].forEach((id) => field(id).removeAttribute('error'));
      const errors = [];
      if (!values.drug) errors.push(['rxDrug', 'Choose or type a medication.']);
      if (!values.sig) errors.push(['rxSig', 'Enter the directions.']);
      if (!(Number(values.qty) > 0)) errors.push(['rxQty', 'Enter a quantity above zero.']);
      if (!(Number(values.days) > 0)) errors.push(['rxDays', 'Enter the days supply.']);
      errors.forEach(([id, message]) => field(id).setAttribute('error', message));

      return errors.length ? null : values;
    }

    /** Add the form to the list — or, while editing, put it back in its place. */
    function addFromForm() {
      const values = readForm();
      if (!values) return;
      if (editingIndex >= 0) items[editingIndex] = values;
      else items.push(values);
      editingIndex = -1;
      paintList();
      paintForm(EMPTY_MED);
      modal.querySelector('#rxDrug input')?.focus();
    }

    function editItem(index) {
      editingIndex = index;
      paintList();
      paintForm(items[index]);
      modal.querySelector('#rxDrug input')?.focus();
    }

    function removeItem(index) {
      items.splice(index, 1);
      /* Removing the entry being edited drops the edit; removing one above it
         shifts the edited entry up a place. */
      if (index === editingIndex) {
        editingIndex = -1;
        paintForm(EMPTY_MED);
      } else if (index < editingIndex) {
        editingIndex -= 1;
        modal.querySelector('[data-rx-form-title]').textContent = `Editing Medication ${editingIndex + 1}`;
      }
      paintList();
    }

    function cancelEdit() {
      editingIndex = -1;
      paintList();
      paintForm(EMPTY_MED);
    }

    /* --- Sending --------------------------------------------------------------
       Only the list is sent. Something typed in the form and never added is not
       on the prescription, and saying so is better than quietly including it:
       a half-filled form is as likely to be a drug somebody changed their mind
       about as one they forgot to add. */

    function send() {
      const provider = modal.querySelector('#rxProvider');
      const pharmacy = modal.querySelector('#rxPharmacy');
      const listError = modal.querySelector('[data-rx-list-error]');
      provider.removeAttribute('error');
      pharmacy.removeAttribute('error');
      listError.hidden = true;

      let ok = true;
      if (!provider.value) { provider.setAttribute('error', 'Choose the prescriber.'); ok = false; }
      if (!pharmacy.value) { pharmacy.setAttribute('error', 'Choose a pharmacy.'); ok = false; }
      if (!items.length) {
        listError.textContent = 'Add at least one medication to the prescription.';
        listError.hidden = false;
        ok = false;
      }
      if (!ok) return;

      const rxNumber = nextRxNumber();
      const note = modal.querySelector('#rxNote').value?.trim() || '';
      const record = (CHART_PRESCRIPTIONS[ctx.patient.mrn] ??= { active: [], past: [] });

      /* Unshifted in reverse so the prescription reads top to bottom in the
         order it was written, at the head of the list. */
      [...items].reverse().forEach((med, i) => {
        const refills = Number(med.refills) || 0;
        const days = Number(med.days);
        record.active.unshift({
          id: `${rxNumber}-${items.length - i}`,
          rxNumber,
          name: med.drug,
          sig: med.sig,
          diagnosis: med.diagnosis ? `Dx1: ${med.diagnosis}` : '',
          dispenseQty: Number(med.qty),
          dispenseUnit: med.unit,
          daysSupply: days,
          dispensingCount: refills + 1,
          startDate: fromIso(TODAY),
          endDate: endDateFor(days, refills),
          provider: provider.value,
          pharmacy: pharmacy.value,
          dispenseAsWritten: med.daw,
          note,
        });
      });

      const count = items.length;
      modal.close();
      paintTable();
      ctx.flash(
        `${rxNumber} sent to ${pharmacy.value.split(' — ')[0]} — ${count} ${
          count === 1 ? 'medication' : 'medications'
        }.`,
        'success'
      );
    }

    /* --- Events ---------------------------------------------------------------
       Plain buttons (edit, remove) fire click; <ui-button>s fire ui-click. */

    function onHostClick(event) {
      if (!modal) return;
      const edit = event.target.closest('[data-rx-edit]');
      if (edit) editItem(Number(edit.dataset.rxEdit));
      const remove = event.target.closest('[data-rx-remove]');
      if (remove) removeItem(Number(remove.dataset.rxRemove));
    }

    function onHostUiClick(event) {
      if (event.target.closest('[data-rx-dismiss]')) modal?.close();
      else if (event.target.closest('[data-rx-send]')) send();
      else if (event.target.closest('[data-rx-add-med]')) addFromForm();
      else if (event.target.closest('[data-rx-cancel-edit]')) cancelEdit();
    }

    function onHeadUiClick(event) {
      const trigger = event.target.closest('[data-testid="chart--rx-add"]');
      if (trigger) openCompose(trigger);
    }

    host.addEventListener('click', onHostClick);
    host.addEventListener('ui-click', onHostUiClick);
    head?.addEventListener('ui-click', onHeadUiClick);

    paintTable();

    return () => {
      host.removeEventListener('click', onHostClick);
      host.removeEventListener('ui-click', onHostUiClick);
      head?.removeEventListener('ui-click', onHeadUiClick);
    };
  },
});
