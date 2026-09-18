/**
 * FORMS — the questionnaire this chart collects from the patient.
 * Reference: the attached CustomEMR "Forms" screen and "Assign Form" dialog.
 *
 * The chart carries exactly ONE form: the Patient Interview Form, whose
 * FORM_SCHEMA in data/forms.js is transcribed from MediNova
 * Gastroenterology's real questionnaire, so it can genuinely be filled out
 * and read back here rather than merely listed. The assessment scores and
 * consents that used to share this table are gone — see the header of
 * data/forms.js for why. The catalog is still keyed by category and the
 * renderer still copes with a form that has no schema, because both are
 * cheap to keep and are what a second form would need on the day one is
 * added back.
 *
 * Uses <ui-data-table>, the same component as the patient directory and
 * Notes, and the same owns-its-own-modal / own-row-menu pattern chart-notes
 * established — see that file for the fuller rationale.
 *
 * "Assign", "Fill out" and "Remove" are real, in-memory actions — the same
 * honesty rule every other stub in this chart follows: what this prototype
 * cannot actually do (send a portal notification, open a form with no known
 * fields) says so via ctx.flash() instead of pretending to.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import {
  FORM_CATALOG,
  FORM_SCHEMAS,
  STATUS,
  PATIENT_FORMS,
  EMPTY_PATIENT_FORMS,
} from '../../data/forms.js';

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return { d, m, y };
}

function formatDate(value) {
  const parts = parseDate(value);
  if (!parts) return '—';
  return `${String(parts.d).padStart(2, '0')} ${MONTHS[parts.m - 1]} ${parts.y}`;
}

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

let uid = 0;

/* ============================================================================
   COLUMNS
   ========================================================================= */

function nameCell(row) {
  return `<button type="button" class="frm__name" data-form-open="${row.id}"
      data-testid="chart--form-name">${esc(row.name)}</button>`;
}

function statusCell(row) {
  const status = STATUS[row.status] || STATUS.pending;
  return `<ui-badge status="${status.tone}" size="sm">${status.label}</ui-badge>`;
}

function rowActionCell(row) {
  return `<button type="button" class="ui-row-menu-btn" data-form-menu="${row.id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${esc(row.name)} actions">
      ${icon('more-vertical')}
    </button>`;
}

const COLUMNS = [
  { key: 'name', label: 'Form Name', render: nameCell },
  { key: 'category', label: 'Category' },
  { key: 'sentOn', label: 'Sent On', render: (row) => formatDate(row.sentOn) },
  { key: 'status', label: 'Status', render: statusCell },
  {
    key: 'completedOn',
    label: 'Completed On',
    render: (row) => (row.completedOn ? formatDate(row.completedOn) : '—'),
  },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: rowActionCell,
  },
];

/* ============================================================================
   SCHEMA-DRIVEN FIELDS — fill mode (interactive) and view mode (read-only).

   A field's answer lives under its own `key`; a checkboxGroup's answer is
   the array of options currently checked. Collecting a filled form is just
   walking [data-field] a second time, in the same order they were drawn.
   ========================================================================= */

/** What a field shows before the patient has answered it. */
function fieldStartingValue(field, patient, existing) {
  if (existing && Object.prototype.hasOwnProperty.call(existing, field.key)) {
    return existing[field.key];
  }
  if (field.prefillToday) return todayDdMmYyyy();
  if (field.prefill) return field.prefill(patient);
  return field.type === 'checkboxGroup' ? [] : '';
}

function fillField(field, value) {
  const checked = Array.isArray(value) ? value : [];

  switch (field.type) {
    case 'textarea':
      return `<ui-textarea label="${esc(field.label)}" data-field="${field.key}"
          value="${esc(value)}" rows="3"></ui-textarea>`;

    case 'radio':
      return `<ui-radio-group label="${esc(field.label)}" data-field="${field.key}"
          options="${esc(field.options.join(','))}" value="${esc(value)}"></ui-radio-group>`;

    case 'select':
      return `<ui-select label="${esc(field.label)}" data-field="${field.key}"
          options="${esc(field.options.join(','))}" value="${esc(value)}"
          placeholder="Select"></ui-select>`;

    case 'checkbox':
      return `<ui-checkbox data-field="${field.key}" ${value ? 'checked' : ''}
          >${esc(field.label)}</ui-checkbox>`;

    case 'checkboxGroup':
      return `<div class="ui-field">
          <span class="ui-field__label">${esc(field.label)}</span>
          <div class="frm__check-grid">
            ${field.options
              .map(
                (option) =>
                  `<ui-checkbox data-field="${field.key}" data-option="${esc(option)}"
                     ${checked.includes(option) ? 'checked' : ''}>${esc(option)}</ui-checkbox>`
              )
              .join('')}
          </div>
        </div>`;

    default: {
      const displayValue = field.format === 'date' ? formatDate(value) : value;
      return `<ui-input label="${esc(field.label)}" type="${field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}"
          data-field="${field.key}" value="${esc(displayValue)}"
          ${field.readonly ? 'readonly' : ''}></ui-input>`;
    }
  }
}

/** A blank/empty answer reads as "—", the same convention every other
 *  module in this chart uses for "nothing on file". Stored dates are always
 *  the raw dd-mm-yyyy form — format: 'date' is a display concern only, so a
 *  field renders the same way whether it just came off the chart or was
 *  read back out of a previously-saved answer. */
function viewValue(field, value) {
  if (field.type === 'checkboxGroup') {
    const checked = Array.isArray(value) ? value : [];
    return checked.length ? esc(checked.join(', ')) : '—';
  }
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (!value) return '—';
  return esc(field.format === 'date' ? formatDate(value) : value);
}

function renderSchema(schema, patient, existing, mode) {
  return schema
    .map(
      (section) => `<fieldset class="frm__form-section">
        <legend class="frm__form-section-title">${esc(section.title)}</legend>
        <div class="frm__form-grid">
          ${section.fields
            .map((field) => {
              const value = fieldStartingValue(field, patient, existing);
              return mode === 'view'
                ? `<div class="frm__view-field">
                     <p class="frm__view-label">${esc(field.label)}</p>
                     <p class="frm__view-value">${viewValue(field, value)}</p>
                   </div>`
                : `<div class="frm__form-field${
                    field.type === 'textarea' || field.type === 'checkboxGroup'
                      ? ' frm__form-field--wide'
                      : ''
                  }">${fillField(field, value)}</div>`;
            })
            .join('')}
        </div>
      </fieldset>`
    )
    .join('');
}

/** Walks a just-filled form and reads every [data-field] back into an
 *  answers object, keyed the same way the schema defines them.
 *
 *  A readonly field never asks the DOM — its display value may be
 *  formatted for reading (a raw "20-02-1961" shown as "20 Feb 1961"), and
 *  that formatted string is not what should be stored as the answer. Its
 *  canonical value is recomputed the same way it was first shown. */
function collectAnswers(schema, container, patient, existing) {
  const answers = {};
  for (const section of schema) {
    for (const field of section.fields) {
      if (field.readonly) {
        answers[field.key] = fieldStartingValue(field, patient, existing);
        continue;
      }
      if (field.type === 'checkboxGroup') {
        answers[field.key] = [
          ...container.querySelectorAll(`[data-field="${field.key}"][data-option]`),
        ]
          .filter((el) => el.checked)
          .map((el) => el.dataset.option);
      } else {
        const el = container.querySelector(`[data-field="${field.key}"]`);
        answers[field.key] = field.type === 'checkbox' ? Boolean(el?.checked) : el?.value ?? '';
      }
    }
  }
  return answers;
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('forms', {
  /* Search and Assign New Form both sit in the module head, on the same row
     as the "Forms" heading — the slot the shell reserves for exactly this.
     They used to be a band of their own directly under the head, which put
     two rows of furniture between the section name and the first form and
     left the heading row with nothing on its right at all.

     Because the shell renders this once, when the MODULE mounts rather than
     on every repaint, the search box also stops being torn down and rebuilt
     under the cursor between keystrokes — its value simply stays in the DOM
     where the reader typed it. */
  actions: () =>
    `<ui-input class="ord__search" size="sm" icon="search" placeholder="Search forms"
      label="Search forms" label-hidden data-testid="chart--forms-search"></ui-input
    ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--forms-assign"
      >Assign New Form</ui-button
    >`,

  render(host, ctx) {
    const seed = PATIENT_FORMS[ctx.patient.mrn] || EMPTY_PATIENT_FORMS;
    // Copied rather than mutated in place — PATIENT_FORMS is the seed data,
    // so switching charts and back does not carry over a previous visit's
    // assignments, removals or filled-in answers.
    let forms = seed.map((form) => ({ ...form }));
    let query = '';

    /* The search box and Assign New Form are the shell's markup, in the head
       above this host — so their events are listened for on the head instead
       (it is a sibling container, and both events bubble to it). */
    const head = host.parentElement;

    function visibleRows() {
      if (!query) return forms;
      const q = query.toLowerCase();
      return forms.filter(
        (form) => form.name.toLowerCase().includes(q) || form.category.toLowerCase().includes(q)
      );
    }

    function categoryOptions() {
      return Object.keys(FORM_CATALOG).map((category) => ({ value: category, label: category }));
    }

    function formOptionsFor(category) {
      return (FORM_CATALOG[category] || []).map((name) => ({ value: name, label: name }));
    }

    function paint() {
      host.innerHTML = `
        <!-- Everything the on-screen view needs, in one wrapper so print CSS
             can hide the whole thing in one rule rather than one selector
             per element — see .frm--printing in screen-chart.css. -->
        <div class="frm__list-view">
          <ui-data-table
            empty-text="${query ? 'No forms match your search.' : 'No forms sent to this patient yet.'}"
            data-testid="chart--forms-table"
          ></ui-data-table>
        </div>

        <!-- Populated on demand by printForm() and shown only for the
             duration of the print — see .frm--printing. There is no screen
             view of this content; Print and Download as PDF both build it
             fresh from whichever row was chosen. -->
        <div class="frm__print-sheet" id="frmPrintSheet" data-testid="chart--forms-print-sheet"></div>

        <ui-modal id="frmAssignModal" heading="Assign Form" size="md">
          <ui-select id="frmCategory" label="Category" placeholder="Select"
            data-testid="chart--forms-category"></ui-select>
          <ui-select id="frmForm" label="Form" placeholder="Select Form" disabled
            data-testid="chart--forms-form"></ui-select>
          <div class="frm__modal-actions">
            <ui-button variant="outline" data-modal-dismiss data-testid="chart--forms-cancel"
              >Cancel</ui-button
            >
            <ui-button variant="primary" data-testid="chart--forms-save">Assign</ui-button>
          </div>
        </ui-modal>

        <!-- One dialog, reused for both filling out a form and viewing a
             completed one — see openForm() for how the two modes differ. -->
        <ui-modal id="frmFillModal" heading="Form" size="xl" data-testid="chart--forms-fill-modal">
          <div id="frmFillBody"></div>
          <div class="frm__modal-actions" id="frmFillActions"></div>
        </ui-modal>`;

      const table = host.querySelector('[data-testid="chart--forms-table"]');
      const rows = visibleRows();
      table.columns = COLUMNS;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');

      const categorySelect = host.querySelector('#frmCategory');
      categorySelect.optionList = categoryOptions();
    }

    /* --- Per-row "⋮" menu — this module's own copy of the pattern
       chart-notes.js established, matching how every screen in this app
       keeps it local rather than shared. */

    function openAssignModal(trigger) {
      const modal = host.querySelector('#frmAssignModal');
      const categorySelect = host.querySelector('#frmCategory');
      const formSelect = host.querySelector('#frmForm');
      categorySelect.value = '';
      formSelect.optionList = [];
      formSelect.value = '';
      formSelect.setAttribute('disabled', '');
      modal?.open(trigger);
    }

    function assignForm() {
      const categorySelect = host.querySelector('#frmCategory');
      const formSelect = host.querySelector('#frmForm');
      const category = categorySelect.value;
      const name = formSelect.value;

      if (!category) {
        categorySelect.setAttribute('error', 'Choose a category');
        return;
      }
      categorySelect.removeAttribute('error');

      if (!name) {
        formSelect.setAttribute('error', 'Choose a form');
        return;
      }
      formSelect.removeAttribute('error');

      forms.unshift({
        id: `f-new-${Date.now()}-${++uid}`,
        name,
        category,
        sentOn: todayDdMmYyyy(),
        status: 'pending',
        completedOn: null,
        answers: null,
      });

      host.querySelector('#frmAssignModal')?.close();
      paint();
      ctx.flash(`${name} assigned to the patient.`, 'success');
    }

    /**
     * A form's name (or its row menu's View / Fill out) all land here.
     * Three outcomes, in order:
     *   1. no schema           → honest stub, this prototype does not know
     *                             what is on the form.
     *   2. schema, not started → the fill-out dialog, editable.
     *   3. schema, completed   → the same dialog, read-only.
     */
    function openForm(row, trigger) {
      const schema = FORM_SCHEMAS[row.name];
      if (!schema) {
        ctx.flash("A form's captured answers aren't viewable in this prototype yet.");
        return;
      }

      const mode = row.status === 'completed' ? 'view' : 'fill';
      const modal = host.querySelector('#frmFillModal');
      const body = host.querySelector('#frmFillBody');
      const actions = host.querySelector('#frmFillActions');

      modal.setAttribute('heading', row.name);
      body.innerHTML = renderSchema(schema, ctx.patient, row.answers, mode);
      body.className = mode === 'view' ? 'frm__view' : '';

      actions.innerHTML =
        mode === 'view'
          ? `<ui-button variant="primary" data-modal-dismiss
               data-testid="chart--forms-fill-close">Close</ui-button>`
          : `<ui-button variant="outline" data-modal-dismiss
               data-testid="chart--forms-fill-cancel">Cancel</ui-button>
             <ui-button variant="primary" data-testid="chart--forms-fill-save"
               data-form-id="${row.id}">Save &amp; Complete</ui-button>`;

      modal.open(trigger);
    }

    /**
     * What Print and Download as PDF both render — the same header either
     * way (who this is, what form, when it was sent/completed), then the
     * form's captured answers if this prototype knows its schema.
     *
     * A schema-less form gets the honest version of that same rule
     * openForm() already follows: this prototype does not know what is
     * actually on the form, so the printed page says so rather than
     * fabricating content — but the record itself (name, category, status,
     * dates) is real and still worth a printed page.
     */
    function printSheetMarkup(row) {
      const schema = FORM_SCHEMAS[row.name];
      const status = STATUS[row.status] || STATUS.pending;

      const head = `<header class="frm__print-head">
        <h1>${esc(row.name)}</h1>
        <dl class="frm__print-meta">
          <div><dt>Patient</dt><dd>${esc(ctx.patient.name)}</dd></div>
          <div><dt>MRN</dt><dd>${esc(ctx.patient.mrn)}</dd></div>
          <div><dt>Date of birth</dt><dd>${esc(ctx.patient.dob)}</dd></div>
          <div><dt>Category</dt><dd>${esc(row.category)}</dd></div>
          <div><dt>Status</dt><dd>${esc(status.label)}</dd></div>
          <div><dt>Sent on</dt><dd>${formatDate(row.sentOn)}</dd></div>
          <div><dt>Completed on</dt><dd>${row.completedOn ? formatDate(row.completedOn) : '—'}</dd></div>
        </dl>
      </header>`;

      if (!schema) {
        return `${head}
          <p class="frm__print-note">${icon('info')}<span>This prototype does not know what is
            captured on this form, so only the record above — not the form's contents — can be
            printed or downloaded.</span></p>`;
      }

      return `${head}<div class="frm__view">${renderSchema(schema, ctx.patient, row.answers, 'view')}</div>`;
    }

    /** The title restored once the print dialog closes — set by printForm()
     *  only for Download as PDF, so "Save as PDF" suggests a sensible
     *  filename instead of the browser tab's usual "MediNova EHR — …". */
    let restoreTitle = null;

    /**
     * Print and Download as PDF are the same mechanism: this prototype has
     * no server and adds no PDF library (the whole point of the build is
     * that it opens from a double-clicked file with nothing installed), so
     * "download a PDF" is the browser's own print-to-PDF, not a fabricated
     * one-click export. Download only changes the document title beforehand
     * so the browser's Save dialog suggests a real filename.
     */
    function printForm(row, { download = false } = {}) {
      const sheet = host.querySelector('#frmPrintSheet');
      if (!sheet) return;
      sheet.innerHTML = printSheetMarkup(row);

      if (download) {
        restoreTitle = document.title;
        document.title = `${row.name} — ${ctx.patient.name}`;
      }

      document.body.classList.add('frm--printing');
      window.print();
    }

    function saveFilledForm(formId) {
      const row = forms.find((form) => form.id === formId);
      const schema = FORM_SCHEMAS[row?.name];
      if (!row || !schema) return;

      const body = host.querySelector('#frmFillBody');
      row.answers = collectAnswers(schema, body, ctx.patient, row.answers);
      row.status = 'completed';
      row.completedOn = todayDdMmYyyy();

      host.querySelector('#frmFillModal')?.close();
      paint();
      ctx.flash(`${row.name} saved and marked complete.`, 'success');
    }

    function onClick(event) {
      const openTrigger = event.target.closest('[data-form-open]');
      if (openTrigger) {
        const row = forms.find((form) => form.id === openTrigger.dataset.formOpen);
        if (row) openForm(row, openTrigger);
        return;
      }

      const menuBtn = event.target.closest('[data-form-menu]');
      if (menuBtn) {
        const id = menuBtn.dataset.formMenu;
        const current = forms.find((form) => form.id === id);
        if (!current) return;

        const hasSchema = Boolean(FORM_SCHEMAS[current.name]);
        const items = [
          {
            label: current.status === 'completed' ? 'View' : hasSchema ? 'Fill out' : 'View',
            icon: current.status === 'completed' || !hasSchema ? 'eye' : 'pencil',
            run: () => openForm(current, menuBtn),
          },
          { label: 'Print', icon: 'printer', run: () => printForm(current) },
          {
            label: 'Download as PDF',
            icon: 'download',
            run: () => printForm(current, { download: true }),
          },
        ];
        if (current.status === 'pending') {
          items.push({
            label: 'Resend',
            icon: 'send',
            run: () => ctx.flash(`${current.name} resent to the patient portal.`, 'success'),
          });
          // A schema'd form is completed BY filling it out — "Mark complete"
          // with no answers behind it would be a lie the status line tells.
          if (!hasSchema) {
            items.push({
              label: 'Mark complete',
              icon: 'check',
              run: () => {
                current.status = 'completed';
                current.completedOn = todayDdMmYyyy();
                paint();
                ctx.flash(`${current.name} marked complete.`, 'success');
              },
            });
          }
        }
        items.push({
          label: 'Remove',
          icon: 'trash',
          danger: true,
          run: () => {
            forms = forms.filter((form) => form.id !== id);
            paint();
          },
        });

        openRowMenu(menuBtn, items);
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--forms-save"]')) {
        assignForm();
        return;
      }
      if (event.target.closest('[data-testid="chart--forms-fill-save"]')) {
        saveFilledForm(event.target.closest('[data-form-id]').dataset.formId);
        return;
      }
      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onSearch(event) {
      if (!event.target.closest('[data-testid="chart--forms-search"]')) return;
      query = event.detail.value;
      paint();
    }

    /** Category picked → populate and enable the Form dropdown. Guarded to
     *  the category select specifically — ui-change also fires for every
     *  field inside the fill-out dialog, and re-running this on every one
     *  of those would blank the Assign modal's Form list mid-fill. */
    function onCategoryChange(event) {
      if (!event.target.closest('#frmCategory')) return;
      const category = event.detail.value;
      const formSelect = host.querySelector('#frmForm');
      formSelect.optionList = formOptionsFor(category);
      formSelect.value = '';
      if (category) formSelect.removeAttribute('disabled');
      else formSelect.setAttribute('disabled', '');
    }

    /** The print-only class (and, for Download as PDF, the document title)
     *  come off again the moment the print dialog closes, however it
     *  closed — printed or cancelled. */
    function onAfterPrint() {
      document.body.classList.remove('frm--printing');
      if (restoreTitle !== null) {
        document.title = restoreTitle;
        restoreTitle = null;
      }
    }

    /* --- The module head ------------------------------------------------------
       The search box and Assign New Form live in the shell's head, outside
       this host, so their events are listened for there instead.
       ----------------------------------------------------------------------- */

    function onHeadClick(event) {
      if (event.target.closest('[data-testid="chart--forms-assign"]')) {
        openAssignModal(event.target.closest('ui-button'));
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onCategoryChange);
    head?.addEventListener('click', onHeadClick);
    head?.addEventListener('ui-input', onSearch);
    window.addEventListener('afterprint', onAfterPrint);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onCategoryChange);
      head?.removeEventListener('click', onHeadClick);
      head?.removeEventListener('ui-input', onSearch);
      window.removeEventListener('afterprint', onAfterPrint);
      closeRowMenu();
      document.body.classList.remove('frm--printing');
    };
  },
});
