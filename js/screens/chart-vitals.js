/**
 * VITALS — a table of recorded vitals over time, matching the reference
 * screens supplied for this module.
 *
 * The row grid reuses the shared `.ui-table` / `.ui-table-wrap` CSS classes —
 * the same visual language <ui-data-table> renders with — rather than the
 * custom element itself. The reason is structural, not stylistic: each row
 * can expand into a per-metric note section directly beneath it (a genuine
 * spanning detail row, via a plain <tr><td colspan>), and <ui-data-table>'s
 * row model has no way to express that. Hand-rolling the two rows that need
 * it, on top of the exact same classes every other worklist in this app
 * uses, keeps the LOOK consistent without forcing a shape the component
 * cannot hold. Reference for the expand pattern itself: chart-profile-
 * clinical.js's problemsCard, which does the same thing for a simpler case.
 *
 * ctx only provides { patient, age, go, flash }. The module owns its own
 * Add Vitals modal, same contract as every other chart module.
 */
import { registerModule } from './chart-workspace.js';
import { CHART_VITALS, EMPTY_CHART_VITALS } from '../../data/chart-vitals.js';

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** "20-07-2025" (this file's format) → "2025-07-20" (native date input). */
function toIso(ddmmyyyy) {
  const parts = String(ddmmyyyy || '').split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
}

/** "2025-07-20" (native date input) → "20-07-2025" (this file's format). */
function fromIso(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

let uid = 0;

const NOTE_FIELDS = [
  ['height', 'Height'],
  ['weight', 'Weight'],
  ['bmi', 'BMI'],
  ['bloodPressure', 'Blood Pressure'],
  ['pulse', 'Pulse'],
  ['painScore', 'Pain Score'],
];

function hasAnyNote(vital) {
  return NOTE_FIELDS.some(([key]) => vital.notes?.[key]);
}

/* ============================================================================
   ROW MARKUP
   ========================================================================= */

function vitalRow(vital, open) {
  const showToggle = hasAnyNote(vital);
  return `<tr class="vt__row" data-vt-id="${vital.id}">
    <td>${esc(vital.date)}</td>
    <td>${esc(vital.time)}</td>
    <td>${vital.height != null ? `${esc(vital.height)}" in` : '—'}</td>
    <td>${vital.weight != null ? `${esc(vital.weight)} lb` : '—'}</td>
    <td>${vital.bmi ?? '—'}</td>
    <td>${esc(vital.bloodPressure) || '—'}</td>
    <td>${vital.pulse ?? '—'}</td>
    <!-- ?? rather than ||: nought is a real answer here, and the commonest
         one — a patient who is not in pain says 0, and the table has to show
         that rather than an em dash, which on this row means "not asked". -->
    <td>${vital.painScore ?? '—'}</td>
    <td class="vt__row-actions">
      <button type="button" class="vt__row-action" data-vt-edit="${vital.id}"
        data-testid="chart--vitals-edit" aria-label="Edit vitals recorded ${esc(vital.date)}">
        ${icon('pencil')}
        Edit
      </button>
      ${
        showToggle
          ? `<button type="button" class="vt__row-action" data-vt-toggle="${vital.id}"
               aria-expanded="${open}">
               ${open ? 'Hide Note' : 'View Note'}
               ${icon(open ? 'caret-up' : 'caret-down')}
             </button>`
          : ''
      }
    </td>
  </tr>`;
}

function noteSection(label, text) {
  return `<div class="vt__note-item">
    <h4>${esc(label)}</h4>
    <p>${text ? esc(text) : '<span class="vt__note-empty">No note added.</span>'}</p>
  </div>`;
}

function vitalNoteRow(vital) {
  return `<tr class="vt__note-row" data-vt-note-for="${vital.id}">
    <td colspan="9">
      <div class="vt__note-grid">
        ${NOTE_FIELDS.map(([key, label]) => noteSection(label, vital.notes?.[key])).join('')}
      </div>
    </td>
  </tr>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('vitals', {
  /* The date filter and the two buttons that act on the whole module sit in
     the module head, on the "Vitals" row itself. They used to be a band of
     their own directly under it — a second row of furniture that pushed the
     first reading a control-height further down the panel than the section
     name it belongs to.

     Rendered once, when the module mounts: the shell does not call actions()
     again on a repaint, so the filter's value stays in the DOM where the
     reader left it and the buttons are never replaced under the pointer. */
  actions: () =>
    `<ui-input class="vt__date-filter" type="date" size="sm" label="Filter by date"
      label-hidden data-testid="chart--vitals-date-filter"></ui-input
    ><ui-button variant="outline" size="sm" icon="document" data-testid="chart--vitals-print"
      >Print</ui-button
    ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-vitals"
      >Add Vitals</ui-button
    >`,

  render(host, ctx) {
    const record = CHART_VITALS[ctx.patient.mrn] || EMPTY_CHART_VITALS;
    // Copied rather than mutated in place — same reasoning as every other
    // chart module: re-rendering must not carry state from a previous visit.
    const data = [...record];

    const state = {
      dateFilter: '', // yyyy-mm-dd, native <input type="date"> format; '' = all
      openNotes: new Set(),
      /* The reading currently open in the modal, or null for a new one. The
         modal is BUILT from this rather than being filled in after it opens:
         paint() replaces the whole panel, so anything written into the fields
         by hand would be thrown away by the next repaint. Holding the row in
         state means the markup carries the values and the dialog is correct
         the moment it exists. */
      editing: null,
    };

    /* The filter and both buttons are the shell's markup, in the head above
       this host — a sibling container the events they fire bubble through. */
    const head = host.parentElement;

    function visibleVitals() {
      if (!state.dateFilter) return data;
      return data.filter((v) => toIso(v.date) === state.dateFilter);
    }

    function tableMarkup() {
      const rows = visibleVitals();
      if (!rows.length) {
        return `<div class="vt__empty">
          ${icon('vitals')}
          <p>No vitals recorded${state.dateFilter ? ' for that date' : ' yet'}.</p>
        </div>`;
      }

      return `<div class="ui-table-wrap vt__table-wrap" id="vtTableWrap">
        <table class="ui-table vt__table">
          <thead><tr>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Height</th>
            <th scope="col">Weight</th>
            <th scope="col">BMI</th>
            <th scope="col">Blood Pressure</th>
            <th scope="col">Pulse</th>
            <th scope="col">Pain</th>
            <th scope="col"><span class="u-sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            ${rows
              .map((v) => {
                const open = state.openNotes.has(v.id);
                return vitalRow(v, open) + (open ? vitalNoteRow(v) : '');
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
    }

    /* --- The Add / Edit dialog ----------------------------------------------
       One dialog, two jobs. Recording a reading and correcting one ask for
       exactly the same eleven fields, and a second modal carrying the same
       grid would be the same markup twice — with only one of the two copies
       getting fixed the next time a field is added. What changes between the
       two is the heading, the button, and whether the fields start blank; all
       three are read off state.editing here.

       Correcting a reading matters more than it sounds: vitals are typed at
       speed, at the bedside, and a weight entered a digit out is a number the
       chart will keep asserting — and, through BMI, keep reasoning from. Until
       now the only way back was to add a second, contradictory row.
       ---------------------------------------------------------------------- */

    function vitalsModal() {
      const editing = state.editing;
      const value = (raw) => (raw == null || raw === '' ? '' : esc(raw));
      const note = (key) => value(editing?.notes?.[key]);

      return `<ui-modal id="vtAddModal" heading="${editing ? 'Edit Vitals' : 'Add Vitals'}" size="md">
          <div class="vt__field-grid">
            <ui-input label="Date" type="date" value="${editing ? toIso(editing.date) : ''}" data-testid="chart--vitals-add-date"></ui-input>
            <ui-input label="Time" type="time" value="${editing && editing.time !== '—' ? value(editing.time) : ''}" data-testid="chart--vitals-add-time"></ui-input>

            <ui-input label="Height" type="number" placeholder="Inches" value="${value(editing?.height)}" data-testid="chart--vitals-add-height"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('height')}" data-testid="chart--vitals-add-height-note"></ui-input>

            <ui-input label="Weight" type="number" placeholder="0" value="${value(editing?.weight)}" data-testid="chart--vitals-add-weight"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('weight')}" data-testid="chart--vitals-add-weight-note"></ui-input>

            <ui-input label="BMI" type="number" placeholder="0" value="${value(editing?.bmi)}" data-testid="chart--vitals-add-bmi"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('bmi')}" data-testid="chart--vitals-add-bmi-note"></ui-input>

            <ui-input label="Blood Pressure" placeholder="0" value="${value(editing?.bloodPressure)}" data-testid="chart--vitals-add-bp"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('bloodPressure')}" data-testid="chart--vitals-add-bp-note"></ui-input>

            <ui-input label="Pulse" type="number" placeholder="0" value="${value(editing?.pulse)}" data-testid="chart--vitals-add-pulse"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('pulse')}" data-testid="chart--vitals-add-pulse-note"></ui-input>

            <!-- The 0-10 range is stated in the label rather than as min/max,
                 because <ui-input> passes neither through to the control it
                 renders — putting them here would look like a constraint and
                 enforce nothing. The wording matches the procedure nursing
                 note's "Pain Level (0-10)" as closely as the field name here
                 allows, so a nurse meets the same question in both places. -->
            <ui-input label="Pain Score (0-10)" type="number" placeholder="0" value="${value(editing?.painScore)}" data-testid="chart--vitals-add-pain"></ui-input>
            <ui-input label="Note" placeholder="Enter Note" value="${note('painScore')}" data-testid="chart--vitals-add-pain-note"></ui-input>
          </div>

          <div class="vt__modal-actions">
            <ui-button variant="outline" data-modal-dismiss data-testid="chart--vitals-cancel">Cancel</ui-button>
            <ui-button variant="primary" data-testid="chart--vitals-save"
              >${editing ? 'Save Changes' : 'Add Vital'}</ui-button
            >
          </div>
        </ui-modal>`;
    }

    /** Rebuild the panel around the dialog's new job, then open it. The order
     *  is not negotiable: paint() replaces the modal element, so opening
     *  first would open the one about to be thrown away. */
    function openVitalsModal(vital, trigger) {
      state.editing = vital;
      paint();
      host.querySelector('#vtAddModal')?.open(trigger);
    }

    function paint() {
      // The filter and the buttons are the shell's, in the module head above
      // this panel — everything below is only the record itself.
      host.innerHTML = `${tableMarkup()}

        ${vitalsModal()}`;
    }

    /* --- Saving ---------------------------------------------------------------
       A correction is written back into the row that is already there rather
       than being unshifted as a new one: an edited reading is the same
       observation, at the same moment, written down properly the second time.
       Adding a row would leave the wrong number on the chart beside the right
       one, with nothing to say which of the two the clinician meant — which is
       precisely the problem an Edit exists to fix.
       ------------------------------------------------------------------------ */

    function saveVital() {
      const modal = host.querySelector('#vtAddModal');
      const dateField = modal.querySelector('[data-testid="chart--vitals-add-date"]');
      const dateIso = dateField?.value;

      if (!dateIso) {
        dateField?.setAttribute('error', 'Enter a date.');
        return;
      }

      const field = (testid) => modal.querySelector(`[data-testid="${testid}"]`)?.value;

      const height = field('chart--vitals-add-height');
      const weight = field('chart--vitals-add-weight');
      const bmi = field('chart--vitals-add-bmi');
      const bp = field('chart--vitals-add-bp');
      const pulse = field('chart--vitals-add-pulse');
      const painScore = field('chart--vitals-add-pain');
      const time = field('chart--vitals-add-time');

      const heightNote = field('chart--vitals-add-height-note')?.trim();
      const weightNote = field('chart--vitals-add-weight-note')?.trim();
      const bmiNote = field('chart--vitals-add-bmi-note')?.trim();
      const bpNote = field('chart--vitals-add-bp-note')?.trim();
      const pulseNote = field('chart--vitals-add-pulse-note')?.trim();
      const painNote = field('chart--vitals-add-pain-note')?.trim();

      const editing = state.editing;
      const record = {
        id: editing ? editing.id : `vt-${Date.now()}-${++uid}`,
        date: fromIso(dateIso),
        time: time || '—',
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        bmi: bmi ? Number(bmi) : null,
        bloodPressure: bp || '',
        pulse: pulse ? Number(pulse) : null,
        /* Tested against empty rather than for truthiness, which every field
           above can afford to do and this one cannot: 0 is a score a patient
           deliberately gives, and `painScore ? … : null` would file "no pain"
           as "never asked". Those are different facts on a chart. */
        painScore: painScore == null || painScore === '' ? null : Number(painScore),
        notes: {
          height: heightNote || '',
          weight: weightNote || '',
          bmi: bmiNote || '',
          bloodPressure: bpNote || '',
          pulse: pulseNote || '',
          painScore: painNote || '',
        },
      };

      if (editing) {
        const index = data.findIndex((v) => v.id === editing.id);
        if (index !== -1) data[index] = record;
      } else {
        data.unshift(record);
      }

      modal.close();
      /* Cleared BEFORE the repaint, so the dialog the panel is rebuilt with is
         a blank Add Vitals again — the next press of the header button must
         not find the row that was just corrected still sitting in the fields. */
      state.editing = null;
      paint();
      head?.querySelector('[data-testid="chart--add-vitals"]')?.focus();
      ctx.flash(editing ? 'Vitals updated.' : 'Vitals recorded.', 'success');
    }

    /* --- Wiring --------------------------------------------------------------- */

    function onClick(event) {
      const edit = event.target.closest('[data-vt-edit]');
      if (edit) {
        const vital = data.find((v) => v.id === edit.dataset.vtEdit);
        if (vital) openVitalsModal(vital, edit);
        return;
      }

      const toggle = event.target.closest('[data-vt-toggle]');
      if (toggle) {
        const id = toggle.dataset.vtToggle;
        if (state.openNotes.has(id)) state.openNotes.delete(id);
        else state.openNotes.add(id);
        paint();
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
        /* Abandoning an edit puts the dialog back to Add. The panel is NOT
           repainted here — the modal is mid-close and rebuilding it would cut
           the animation and drop the focus it is handing back to the trigger.
           The next open() repaints anyway, which is where the blank fields
           come from. */
        state.editing = null;
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--vitals-save"]')) saveVital();
    }

    /* --- The module head ------------------------------------------------------
       The filter and both buttons are the shell's markup, outside this host,
       so their events are listened for on the head instead.
       ----------------------------------------------------------------------- */

    function onHeadChange(event) {
      if (!event.target.closest('[data-testid="chart--vitals-date-filter"]')) return;
      state.dateFilter = event.detail.value;
      paint();
    }

    function onHeadClick(event) {
      if (event.target.closest('[data-testid="chart--add-vitals"]')) {
        /* Through openVitalsModal, not open() directly, so the dialog is
           rebuilt blank first. Pressing Add straight after abandoning an Edit
           would otherwise reopen the fields still holding that row. */
        openVitalsModal(null, event.target.closest('ui-button'));
        return;
      }

      if (event.target.closest('[data-testid="chart--vitals-print"]')) {
        document.body.classList.add('vt--printing');
        window.print();
      }
    }

    function onAfterPrint() {
      document.body.classList.remove('vt--printing');
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    head?.addEventListener('click', onHeadClick);
    head?.addEventListener('ui-change', onHeadChange);
    window.addEventListener('afterprint', onAfterPrint);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      head?.removeEventListener('click', onHeadClick);
      head?.removeEventListener('ui-change', onHeadChange);
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('vt--printing');
    };
  },
});
