/**
 * HISTORY — the background a patient arrives with, in three lists.
 *
 * Past Medical, Surgical and Social, behind one primary tab strip, because
 * they are asked for together and read together: "what have you had, what
 * have you had done, and how do you live". Splitting them into three sidebar
 * rows would put three clicks between questions a clinician asks in one
 * breath.
 *
 * THIS SECTION MAINTAINS THE RECORD; CLINICAL SUMMARISES IT.
 * Profile · Clinical draws the same three lists as cards in its grid, reading
 * data/chart-history.js exactly as this module does, and each card's "View
 * All" lands here. That is the same relationship Clinical has with Diagnoses:
 * the card is a glance, the section is the record, and there is one copy of
 * the facts underneath both.
 *
 * WHY SOCIAL HISTORY IS A DIFFERENT KIND OF TABLE.
 * The other two are open lists — a patient has as many conditions and
 * operations as they have, so Add appends and Delete removes. Social history
 * is a fixed questionnaire of nine, so its table has nine rows for everybody:
 * the answers that have been given, and the questions that have not. Nothing
 * is added to it or removed from it. An answer is RECORDED, CORRECTED or
 * CLEARED, and a cleared answer leaves its question sitting there unanswered,
 * which is the state it was in before anybody wrote in it. A social history
 * is read to find out what nobody has asked, and a table that only listed the
 * answers could not show that.
 *
 * WHY THE ROW MENU AND NOT A PENCIL.
 * Allergies and Diagnoses next door put a pencil at the end of a row because
 * editing is the only thing they offer there. All three lists here offer two
 * things — correct it, or take it off the record — and the "⋮" is what the
 * rest of the chart uses when a row has more than one answer to "what now".
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu } from '../lib/row-menu.js';
import {
  historyFor,
  PAST_MEDICAL_STATUSES,
  PAST_MEDICAL_STATUS_TONE,
  SOCIAL_HISTORY_CATEGORIES,
  socialCategory,
  SURGICAL_PROCEDURES,
  SURGICAL_FACILITIES,
  SURGICAL_OTHER,
} from '../../data/chart-history.js';

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

/* Who a row written today is filed under. The same stand-in Allergies next
   door uses (see chart-allergies.js) — this prototype has a session but no
   notion of which clinician is at the keyboard, and inventing one per module
   would put three different names on three lists written in one sitting. */
const RECORDER = 'Amara Mensah';

/** Today as the fixtures write dates — dd-mm-yyyy. */
function today() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** A native date input's yyyy-mm-dd → the dd-mm-yyyy a row stores. */
function fromDateInput(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

/** dd-mm-yyyy back into what a native date input will accept. */
function toDateInput(value) {
  const parts = String(value || '').split('-');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

/**
 * What a field actually answers.
 *
 * A <ui-select> in free-text mode has no <select> left to read: `.value` is
 * the option that stepped out of the list ("Other") and the answer is in
 * `free-text-value`. Every read of the form goes through here so the save and
 * the validation cannot disagree about which of the two is the answer.
 */
function answerOf(el) {
  if (!el) return '';
  const free = el.getAttribute('free-text');
  const value = String(el.value ?? '').trim();
  if (free && value === free) return (el.getAttribute('free-text-value') || '').trim();
  return value;
}

/* A cell with nothing in it reads as a column that failed to render, and
   several of these are legitimately empty on most rows — a tonsillectomy from
   1975 has no surgeon on file and never will. */
const orDash = (value) => (String(value ?? '').trim() ? value : '—');

/** The shared "⋮" — one convention across the chart, one definition. */
function rowMenuButton(id, label) {
  return `<button type="button" class="ui-row-menu-btn" data-hst-menu="${esc(id)}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label)}"
      data-testid="chart--history-menu-${esc(id)}">${icon('more-vertical')}</button>`;
}

/* ============================================================================
   THE THREE SECTIONS

   Each one declares its tab, its table, its empty state, the form that writes
   it and how a row is turned into a table row. The module below is written
   once against this shape rather than three times against three lists — the
   only thing that genuinely differs between them is the questions the form
   asks, and that is data.
   ========================================================================= */

const SECTIONS = {
  'past-medical': {
    label: 'Past Medical History',
    noun: 'Condition',
    addLabel: 'Add Condition',
    listKey: 'pastMedical',
    idPrefix: 'pmh',
    empty: 'No past medical history recorded for this patient.',
    nameOf: (row) => row.condition,
    columns: [
      { key: 'no', label: 'No.' },
      { key: 'condition', label: 'Condition', wrap: true },
      {
        key: 'status',
        label: 'Status',
        render: (row) =>
          `<ui-badge status="${PAST_MEDICAL_STATUS_TONE[row.status] || 'neutral'}" size="sm"
            >${esc(row.status)}</ui-badge
          >`,
      },
      { key: 'onsetDate', label: 'Onset Date' },
      { key: 'recordedDate', label: 'Recorded Date' },
      { key: 'recordedBy', label: 'Recorded By', truncate: true },
      { key: 'note', label: 'Note', wrap: true },
      {
        key: 'menu',
        label: '<span class="u-sr-only">Actions</span>',
        actions: true,
        render: (row) => rowMenuButton(row.id, `Actions for ${row.condition}`),
      },
    ],
    fields: [
      { id: 'hstCondition', key: 'condition', label: 'Condition', type: 'text', wide: true, required: true },
      { id: 'hstStatus', key: 'status', label: 'Status', type: 'select', options: PAST_MEDICAL_STATUSES },
      { id: 'hstOnset', key: 'onsetDate', label: 'Onset Date', type: 'date' },
      { id: 'hstPmhNote', key: 'note', label: 'Note', type: 'textarea', wide: true },
    ],
  },

  surgical: {
    label: 'Surgical History',
    noun: 'Procedure',
    addLabel: 'Add Procedure',
    listKey: 'surgical',
    idPrefix: 'sx',
    empty: 'No past surgical history recorded for this patient.',
    nameOf: (row) => row.procedure,
    columns: [
      { key: 'no', label: 'No.' },
      { key: 'procedure', label: 'Procedure', wrap: true },
      { key: 'date', label: 'Date' },
      { key: 'surgeon', label: 'Surgeon', truncate: true },
      { key: 'facility', label: 'Facility', truncate: true },
      { key: 'recordedBy', label: 'Recorded By', truncate: true },
      { key: 'note', label: 'Note', wrap: true },
      {
        key: 'menu',
        label: '<span class="u-sr-only">Actions</span>',
        actions: true,
        render: (row) => rowMenuButton(row.id, `Actions for ${row.procedure}`),
      },
    ],
    fields: [
      /* Both of these are lists rather than boxes — see the note on
         SURGICAL_PROCEDURES in data/chart-history.js for why a typed surgical
         history is a surgical history nobody can count. `freeText` is the
         escape: picking Other turns the same field into a text box, so the
         list never refuses to record an operation it has not heard of. */
      {
        id: 'hstProcedure',
        key: 'procedure',
        label: 'Procedure',
        type: 'select',
        options: SURGICAL_PROCEDURES,
        freeText: SURGICAL_OTHER,
        freeTextPlaceholder: 'Name the operation',
        wide: true,
        required: true,
      },
      { id: 'hstDate', key: 'date', label: 'Date', type: 'date' },
      /* The surgeon stays typed. It is a person's name, not a term — there is
         no list of every surgeon in the region to be right about, and a
         dropdown that only knew this practice's would be wrong for nearly
         every row on this table. */
      { id: 'hstSurgeon', key: 'surgeon', label: 'Surgeon', type: 'text' },
      {
        id: 'hstFacility',
        key: 'facility',
        label: 'Facility',
        type: 'select',
        options: SURGICAL_FACILITIES,
        freeText: SURGICAL_OTHER,
        freeTextPlaceholder: 'Name the hospital or centre',
      },
      { id: 'hstSxNote', key: 'note', label: 'Note', type: 'textarea', wide: true },
    ],
  },

  /* Social is declared here alongside the other two so the tab strip and the
     head are written once, but almost none of the shared machinery applies to
     it: it has no list to append to and no id to generate. The module
     branches on `fixed` where the two genuinely differ, which is four places
     rather than a second copy of the section. */
  social: {
    label: 'Social History',
    noun: 'Answer',
    addLabel: 'Record Answer',
    fixed: true,
    empty: '', // never empty — nine questions are drawn for every patient
    columns: [
      { key: 'question', label: 'Problem Type' },
      { key: 'response', label: 'Response', wrap: true },
      { key: 'detail', label: 'Detail', wrap: true },
      { key: 'recordedDate', label: 'Recorded Date' },
      { key: 'recordedBy', label: 'Recorded By', truncate: true },
      {
        key: 'menu',
        label: '<span class="u-sr-only">Actions</span>',
        actions: true,
        render: (row) => rowMenuButton(row.id, `Actions for ${row.question}`),
      },
    ],
    fields: [
      {
        id: 'hstCategory',
        key: 'category',
        label: 'Problem Type',
        type: 'select',
        options: SOCIAL_HISTORY_CATEGORIES.map((c) => c.label),
        required: true,
        /* Which question is being answered is settled by the row the menu was
           opened on. Leaving it changeable during an edit would let "correct
           the tobacco answer" quietly overwrite the alcohol one. */
        lockOnEdit: true,
      },
      { id: 'hstResponse', key: 'response', label: 'Response', type: 'select', options: [], required: true },
      { id: 'hstDetail', key: 'detail', label: 'Detail', type: 'text', wide: true },
    ],
  },
};

const SECTION_IDS = Object.keys(SECTIONS);

/* ============================================================================
   MARKUP
   ========================================================================= */

function tabsMarkup(selected) {
  return `<ui-tabs primary selected="${selected}" data-testid="chart--history-tabs">
      ${SECTION_IDS.map(
        (id) => `<ui-tab value="${id}" label="${esc(SECTIONS[id].label)}"></ui-tab>`
      ).join('')}
    </ui-tabs>`;
}

function fieldMarkup(field) {
  const wide = field.wide ? ' hst__field--wide' : '';
  const testid = `chart--history-field-${field.key}`;

  if (field.type === 'select') {
    /* A field that can step out of its own list carries the option that does
       it and the prompt for what to type instead. <ui-select> owns the rest:
       picking that option swaps the control for a text box in place, with a
       caret back to the list. */
    const free = field.freeText
      ? ` free-text="${esc(field.freeText)}"
          free-text-placeholder="${esc(field.freeTextPlaceholder || 'Type here')}"`
      : '';
    /* REAL <option> CHILDREN, NOT THE `options` ATTRIBUTE. That attribute
       splits on commas, and half this catalogue has a comma in it —
       "Cholecystectomy, laparoscopic" and "Altru Hospital, Grand Forks" would
       each arrive as two options naming nothing. <ui-select> reads author
       children once at upgrade; see its own note on setOptions(). */
    const options = (field.options || [])
      .map((option) => `<option value="${esc(option)}">${esc(option)}</option>`)
      .join('');
    return `<ui-select class="${wide.trim()}" id="${field.id}" label="${esc(field.label)}"
        placeholder="Select ${esc(field.label.toLowerCase())}"${free}
        data-testid="${testid}">${options}</ui-select>`;
  }
  if (field.type === 'textarea') {
    return `<ui-textarea class="${wide.trim()}" id="${field.id}" label="${esc(field.label)}"
        rows="3" placeholder="Type here" data-testid="${testid}"></ui-textarea>`;
  }
  if (field.type === 'date') {
    return `<ui-input class="${wide.trim()}" id="${field.id}" type="date"
        label="${esc(field.label)}" placeholder="Choose Date" data-testid="${testid}"></ui-input>`;
  }
  return `<ui-input class="${wide.trim()}" id="${field.id}" label="${esc(field.label)}"
      placeholder="Type here" data-testid="${testid}"></ui-input>`;
}

/* One dialog, three field sets. All three are drawn into it up front and the
   set that does not belong to the open section is hidden, rather than the body
   being rebuilt per section: a field rebuilt under an open dialog is a field
   that loses whatever was in it and, if the caret was there, the caret too. */
function modalMarkup() {
  return `<ui-modal id="hstModal" heading="Add" size="md" data-testid="chart--history-modal">
      ${SECTION_IDS.map(
        (id) => `<div class="hst__form" data-hst-form="${id}" hidden>
            ${SECTIONS[id].fields.map(fieldMarkup).join('')}
          </div>`
      ).join('')}

      <div class="ui-modal__actions">
        <ui-button variant="tertiary" data-hst-dismiss data-testid="chart--history-cancel"
          >Cancel</ui-button
        >
        <span class="ui-modal__actions-spacer"></span>
        <ui-button variant="primary" id="hstSave" data-testid="chart--history-save"
          >Add</ui-button
        >
      </div>
    </ui-modal>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('history', {
  /* The sidebar's lit row already says History and so does the tab under it;
     a third "History" on the same line is a word the eye steps over on the way
     to the switch. Same arrangement as Profile, Appointments and Orders. */
  hideTitle: true,

  tabs: () => tabsMarkup(SECTION_IDS[0]),

  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--history-open"
      >${esc(SECTIONS[SECTION_IDS[0]].addLabel)}</ui-button
    >`,

  render(host, ctx) {
    // Its own copy of the fixtures — switching patients and coming back must
    // not carry rows added or edits made during the previous visit.
    const data = historyFor(ctx.patient.mrn);

    let section = SECTION_IDS[0];
    /** The row the dialog is open on, or null when it is recording a new one. */
    let editing = null;
    const nextId = {};

    /* THE PANELS ARE REAL, EVEN THOUGH THERE IS ONLY ONE TABLE.
       <ui-tabs> points each tab at `panel-<value>` with aria-controls, which
       is a promise to a screen reader that an element with that id exists —
       an aria-controls naming nothing is a WCAG 4.1.2 failure, and axe fails
       the page for it. So all three panels are drawn and the one table is
       moved into whichever is showing, rather than three tables being built
       to satisfy the markup. */
    host.innerHTML = `${SECTION_IDS.map(
      (id) => `<div id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}"
          class="hst__panel"${id === section ? '' : ' hidden'}></div>`
    ).join('')}
      <ui-data-table data-testid="chart--history-table"></ui-data-table>
      ${modalMarkup()}`;

    const table = host.querySelector('[data-testid="chart--history-table"]');
    const modal = host.querySelector('#hstModal');
    const field = (id) => host.querySelector(`#${id}`);
    const head = () => host.parentElement?.querySelector('.ch__module-head');

    /* --- Rows ------------------------------------------------------------- */

    /** The nine questions, answered or not — social history's whole table. */
    function socialRows() {
      return SOCIAL_HISTORY_CATEGORIES.map((category) => {
        const answer = data.social[category.id];
        return {
          id: category.id,
          question: category.label,
          response: answer?.response || 'Not recorded',
          detail: orDash(answer?.detail),
          recordedDate: orDash(answer?.recordedDate),
          recordedBy: orDash(answer?.recordedBy),
          // The class is what greys the whole row; see .hst__row--unanswered.
          unanswered: !answer,
        };
      });
    }

    function rowsFor(id) {
      if (SECTIONS[id].fixed) return socialRows();
      return data[SECTIONS[id].listKey].map((row, index) => ({
        ...row,
        /* The number is the row's place in the RECORD, not on screen — it is
           what somebody reads a row out by, so it must not move when the list
           is drawn a second time. */
        no: String(index + 1).padStart(3, '0'),
        surgeon: orDash(row.surgeon),
        facility: orDash(row.facility),
        note: orDash(row.note),
        onsetDate: orDash(row.onsetDate),
        date: orDash(row.date),
      }));
    }

    function paint() {
      const spec = SECTIONS[section];
      const rows = rowsFor(section);

      // The table lives in whichever panel is showing — see the note above.
      for (const panel of host.querySelectorAll('[role="tabpanel"]')) {
        panel.hidden = panel.id !== `panel-${section}`;
      }
      host.querySelector(`#panel-${section}`)?.append(table);

      table.columns = spec.columns;
      table.rows = rows;
      table.setAttribute('empty-text', spec.empty);
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
      /* A question nobody has answered is a row of dashes, and a row of dashes
         at full contrast reads as loudly as the answers beside it. */
      table.rowClass = (row) => (row.unanswered ? 'hst__row--unanswered' : '');
    }

    /** The tab strip and the Add button live in the shell's head, not in
     *  `host`, so they are reached through the workspace root. */
    function syncHead() {
      head()
        ?.querySelector('[data-testid="chart--history-tabs"]')
        ?.setAttribute('selected', section);

      /* Rewritten only when the section actually changed. The dialog remembers
         the button that opened it so it can hand focus back on close, and
         rebuilding that button on every repaint would leave the dialog holding
         a node that is no longer in the document. */
      const actions = head()?.querySelector('.ch__module-actions');
      if (actions && actions.dataset.section !== section) {
        actions.dataset.section = section;
        actions.innerHTML = `<ui-button variant="primary" size="sm" icon="plus"
            data-testid="chart--history-open">${esc(SECTIONS[section].addLabel)}</ui-button>`;
      }
    }

    /* --- The dialog -------------------------------------------------------- */

    /** Only the open section's questions are on the form. */
    function showFormFor(id) {
      for (const form of host.querySelectorAll('[data-hst-form]')) {
        form.hidden = form.dataset.hstForm !== id;
      }
    }

    /** Write a value into a component AND into the control it rendered — the
     *  attribute alone paints the shell but leaves a native input holding
     *  whatever was typed into it last. */
    function setField(id, value) {
      const el = field(id);
      if (!el) return;
      el.setAttribute('value', value ?? '');
      const control = el.querySelector('input, select, textarea');
      if (control) control.value = value ?? '';
      el.removeAttribute('error');
    }

    /**
     * Put a saved answer back into a field that can step out of its own list.
     *
     * Which mode it opens in is decided by the answer, not by how it was
     * given: an operation on the list comes back as that option, and one that
     * is not — "Total knee replacement, right", recorded before anybody
     * thought to offer laterality — comes back in the text box with the words
     * still in it. Anything else and correcting the date on an old row would
     * silently blank the operation it belongs to.
     *
     * `free-text-value` is set FIRST: both attributes are observed, and the
     * render triggered by `value` is the one that reads the text back out.
     */
    function setFreeTextField(fieldSpec, value) {
      const el = field(fieldSpec.id);
      if (!el) return;
      const text = String(value ?? '').trim();
      const onList = fieldSpec.options.includes(text);
      el.setAttribute('free-text-value', onList || !text ? '' : text);
      el.setAttribute('value', text ? (onList ? text : fieldSpec.freeText) : '');
      el.removeAttribute('error');
    }

    /** Social's Response follows its Question, the same way the allergy
     *  drawer's allergen list follows the allergy type: being offered
     *  "Gluten-free" under Tobacco Use is how a wrong answer gets filed
     *  against the right question. Changing the question re-fills the answers
     *  and drops whatever was chosen under the old one. */
    function fillResponses(keepValue) {
      const label = answerOf(field('hstCategory'));
      const category = SOCIAL_HISTORY_CATEGORIES.find((c) => c.label === label);
      const response = field('hstResponse');
      response.optionList = (category?.options || []).map((option) => ({
        value: option,
        label: option,
      }));
      setField('hstResponse', keepValue || '');
    }

    function openModal(trigger, row) {
      const spec = SECTIONS[section];
      editing = row || null;

      showFormFor(section);
      modal.setAttribute('heading', `${row ? 'Edit' : 'Add'} ${spec.label}`);
      /* `text`, not textContent — setting textContent on a <ui-button> wipes
         the <button> it rendered and leaves the label as bare text. */
      field('hstSave').setAttribute('text', row ? 'Save' : 'Add');

      if (spec.fixed) {
        const category = row ? socialCategory(row.id) : null;
        const answer = category ? data.social[category.id] : null;
        setField('hstCategory', category?.label || '');
        // Locked while correcting one answer, open while recording a new one.
        field('hstCategory').toggleAttribute('readonly', Boolean(category));
        fillResponses(answer?.response || '');
        setField('hstDetail', answer?.detail || '');
      } else {
        for (const f of spec.fields) {
          const value = row?.[f.key] ?? '';
          if (f.freeText) setFreeTextField(f, value);
          else setField(f.id, f.type === 'date' ? toDateInput(value) : value);
        }
        if (!row) setField('hstStatus', PAST_MEDICAL_STATUSES[0]);
      }

      modal.open(trigger);
    }

    /** The first required field with nothing in it, marked. Returns true when
     *  the form is answered well enough to save. */
    function validate(fields) {
      let ok = true;
      for (const f of fields) {
        if (!f.required) continue;
        const el = field(f.id);
        if (answerOf(el)) el.removeAttribute('error');
        else {
          el.setAttribute('error', `Enter ${f.label.toLowerCase()}`);
          ok = false;
        }
      }
      return ok;
    }

    function save() {
      const spec = SECTIONS[section];
      if (!validate(spec.fields)) return;

      const wasEditing = Boolean(editing);
      let what;

      if (spec.fixed) {
        const category = SOCIAL_HISTORY_CATEGORIES.find(
          (c) => c.label === answerOf(field('hstCategory'))
        );
        if (!category) return;
        data.social[category.id] = {
          response: field('hstResponse').value,
          detail: field('hstDetail').value.trim(),
          recordedDate: today(),
          recordedBy: RECORDER,
        };
        what = category.label;
      } else {
        const values = {};
        for (const f of spec.fields) {
          const raw = answerOf(field(f.id));
          values[f.key] = f.type === 'date' ? fromDateInput(raw) : raw;
        }
        what = spec.nameOf(values);

        if (editing) {
          // The recorded date is when the practice first wrote this down, so
          // a correction does not move it.
          Object.assign(editing, values);
        } else {
          const list = data[spec.listKey];
          nextId[spec.idPrefix] ??= list.length + 1;
          list.push({
            id: `${spec.idPrefix}${nextId[spec.idPrefix]++}`,
            recordedDate: today(),
            recordedBy: RECORDER,
            ...values,
          });
        }
      }

      editing = null;
      paint();
      modal.close();
      ctx.flash(
        wasEditing || spec.fixed
          ? `${what} saved to this patient's history.`
          : `${what} added to this patient's history.`,
        'success'
      );
    }

    /* --- Removing ---------------------------------------------------------- */

    /**
     * On the two open lists this is a deletion. On social history it is a
     * CLEARING: the answer goes and the question stays on the table,
     * unanswered — which is the state the record was in before anybody wrote
     * in it, and the state a social history is read to find.
     */
    function remove(id) {
      const spec = SECTIONS[section];

      if (spec.fixed) {
        const category = socialCategory(id);
        if (!category || !data.social[id]) return;
        delete data.social[id];
        paint();
        ctx.flash(`${category.label} cleared — the question is still on the record.`, 'success');
        return;
      }

      const list = data[spec.listKey];
      const index = list.findIndex((row) => row.id === id);
      if (index < 0) return;
      const [removed] = list.splice(index, 1);
      paint();
      ctx.flash(`${spec.nameOf(removed)} removed from this patient's history.`, 'success');
    }

    /* --- Events ------------------------------------------------------------ */

    function onClick(event) {
      if (event.target.closest('[data-hst-dismiss]')) {
        modal.close();
        return;
      }

      const menu = event.target.closest('[data-hst-menu]');
      if (!menu) return;

      const spec = SECTIONS[section];
      const id = menu.dataset.hstMenu;

      /* A question nobody has answered has nothing to correct and nothing to
         clear, so its menu offers the only thing that makes sense there —
         answering it — rather than a greyed-out Edit beside a Delete that
         would delete nothing. */
      const answered = spec.fixed ? Boolean(data.social[id]) : true;
      const row = spec.fixed
        ? { id, ...data.social[id] }
        : data[spec.listKey].find((r) => r.id === id);
      if (!row) return;

      openRowMenu(
        menu,
        answered
          ? [
              {
                label: 'Edit',
                icon: 'pencil',
                testid: `chart--history-edit-${section}`,
                run: () => openModal(menu, row),
              },
              { divider: true },
              {
                label: spec.fixed ? 'Clear' : 'Delete',
                icon: 'trash',
                danger: true,
                testid: `chart--history-delete-${section}`,
                run: () => remove(id),
              },
            ]
          : [
              {
                label: 'Record',
                icon: 'plus-circle',
                testid: `chart--history-record-${section}`,
                run: () => openModal(menu, row),
              },
            ]
      );
    }

    /* <ui-tabs> and <ui-select> both fire ui-change, and the dialog is full of
       selects — reacting to one of those as if it were a tab switch would tear
       the open form down around the answer being given. */
    function onChange(event) {
      if (event.target.closest('[data-testid="chart--history-tabs"]')) {
        section = event.detail.value;
        syncHead();
        paint();
        return;
      }
      if (event.target.closest('#hstCategory')) fillResponses();
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--history-save"]')) save();
      if (event.target.closest('[data-testid="chart--history-open"]')) {
        openModal(event.target.closest('ui-button'), null);
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-change', onChange);
    host.addEventListener('ui-click', onUiClick);
    /* The tab strip and the Add button are drawn by the shell, outside `host`.
       The head is torn down with the module on the next switch; the teardown
       below removes these in the meantime. */
    head()?.addEventListener('ui-change', onChange);
    head()?.addEventListener('ui-click', onUiClick);

    syncHead();
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-change', onChange);
      host.removeEventListener('ui-click', onUiClick);
      head()?.removeEventListener('ui-change', onChange);
      head()?.removeEventListener('ui-click', onUiClick);
    };
  },
});
