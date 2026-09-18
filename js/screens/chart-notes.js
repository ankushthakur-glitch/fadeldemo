/**
 * NOTES — free-text notes and alert notes, matching the reference screens
 * supplied for this module.
 *
 * Uses <ui-data-table>, the same component as the patient directory and the
 * scheduler, rather than a hand-rolled <table> — one row grammar, one look,
 * everywhere a worklist appears. The Note column opts into `wrap: true` (the
 * table's escape hatch for a genuinely multi-line value) so a long note
 * reads in full instead of clipping to one line.
 *
 * Two tabs, two different kinds of thing:
 *   Notes        a running log. Text, author, date. Nothing else to say
 *                about one once it exists.
 *   Alert Notes  where it surfaces (Visible At) and an Active/Inactive
 *                status — closer to a flag than a note, hence the extra
 *                columns and the reason shown when one is inactive.
 *
 * ctx only provides { patient, age, go, flash } — nothing here reaches for a
 * shell modal that does not exist. The module owns its own <ui-modal>, the
 * same way patient-add.js owns the address-verification dialog it needs.
 *
 * "Add Notes" / "Add Alert Notes" both work — this prototype has no backend,
 * so a save appends to the in-memory list and repaints, the same honesty
 * rule the face sheet uses for its "+" buttons (ctx.flash for what a real
 * save would additionally do, e.g. editing an existing note).
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { CHART_NOTES, EMPTY_CHART_NOTES, VISIBLE_AT } from '../../data/chart-notes.js';

/** The signed-in user, per the avatar every screen in this app shows. */
const CURRENT_USER = 'Amara Mensah';

/**
 * ui-data-table escapes plain column values itself (no render()) — this is
 * only needed for the one spot here that injects a value into markup by
 * hand: the inactive-reason tooltip, via a custom render().
 */
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

let uid = 0;

/* ============================================================================
   ROW ACTION BUTTON — same shape as master.js / scheduler.js: a "⋮" that
   opens a floating menu, not a table-specific thing.
   ========================================================================= */

function rowActionButton(attr, id, label) {
  return `<button type="button" class="ui-row-menu-btn" data-${attr}="${id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${label}">
      ${icon('more-vertical')}
    </button>`;
}

/* ============================================================================
   COLUMNS
   ========================================================================= */

const NOTES_COLUMNS = [
  { key: 'text', label: 'Note', wrap: true },
  { key: 'author', label: 'Created By' },
  { key: 'date', label: 'Created On' },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('note-menu', row.id, 'Note actions'),
  },
];

function alertStatusCell(row) {
  const badge = `<ui-badge status="${row.active ? 'success' : 'neutral'}" size="sm"
      >${row.active ? 'Active' : 'Inactive'}</ui-badge
    >`;
  // An inactive alert still carries WHY — it explains a decision someone
  // already made rather than a thing currently in force, and losing that
  // reason is how the same concern gets re-raised from scratch.
  const info = !row.active && row.inactiveReason
    ? `<button type="button" class="cn__info" data-alert-reason="${esc(row.id)}"
         aria-label="Why this is inactive" title="${esc(row.inactiveReason)}">
         ${icon('info')}
       </button>`
    : '';
  return `<span class="cn__status-cell">${badge}${info}</span>`;
}

const ALERT_NOTES_COLUMNS = [
  { key: 'text', label: 'Note', wrap: true },
  { key: 'visibleAt', label: 'Visible At' },
  { key: 'author', label: 'Created By' },
  { key: 'date', label: 'Created On' },
  { key: 'status', label: 'Status', render: alertStatusCell },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => rowActionButton('alert-menu', row.id, 'Alert note actions'),
  },
];

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('notes', {
  /* The section name comes off the screen and stays in the document — the
     first tab of the strip below is the word "Notes", so drawing the heading
     as well said it twice and pushed the strip half a title's width to the
     right of where every other tabbed module starts one. Notes was the last
     module still keeping its visible title beside a strip; without it the
     switch sits at the same x, on the same line, in every module that has
     one. See the hideTitle note in js/screens/chart-workspace.js. */
  hideTitle: true,

  /* The Notes / Alert Notes switch sits in the module head, between the
     heading and the actions — the slot the shell reserves for exactly this,
     so a module's own view switch is at the same height in every module that
     has one. */
  tabs: () =>
    `<ui-tabs primary selected="notes" data-testid="chart--notes-tabs">
      <ui-tab value="notes" label="Notes"></ui-tab>
      <ui-tab value="alertNotes" label="Alert Notes"></ui-tab>
    </ui-tabs>`,

  /* Add follows the strip up: a module's one whole-module action belongs on
     the same row as its switch and its heading, which is where Appointments,
     Prescriptions and Profile all put theirs.

     One button, not one per tab. Its wording still follows the tab, through
     the `text` attribute <ui-button> keeps for exactly this — the shell calls
     actions() when the MODULE mounts, not when a tab changes, and re-rendering
     the button on every switch would replace it under the pointer that just
     landed on it. */
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--add-note"
      >Add Notes</ui-button
    >`,

  render(host, ctx) {
    const record = CHART_NOTES[ctx.patient.mrn] || EMPTY_CHART_NOTES;
    // Copied rather than mutated in place — CHART_NOTES is the seed data, and
    // re-rendering the module (switching charts and back) should not carry
    // over notes added in a previous visit to this screen.
    const data = {
      notes: [...record.notes],
      alertNotes: [...record.alertNotes],
    };

    let activeTab = 'notes';

    /* The strip and both Add buttons are the shell's markup, rendered into the
       module head — a sibling of this host, not a descendant. Both the events
       they fire and the focus this module hands back after saving are
       addressed there. */
    const head = host.parentElement;

    /** The Add button's wording follows the tab, set through the attribute
     *  the component owns rather than by re-rendering it — see actions(). */
    function syncActions(addLabel) {
      head?.querySelector('[data-testid="chart--add-note"]')?.setAttribute('text', addLabel);
    }

    function paint() {
      const addLabel = activeTab === 'alertNotes' ? 'Add Alert Notes' : 'Add Notes';

      host.innerHTML = `<div id="panel-notes" role="tabpanel" class="cn__panel">
          <ui-data-table
            empty-text="No notes recorded yet."
            data-testid="chart--notes-table"
          ></ui-data-table>
        </div>
        <div id="panel-alertNotes" role="tabpanel" class="cn__panel" hidden>
          <ui-data-table
            empty-text="No alert notes recorded yet."
            data-testid="chart--alert-notes-table"
          ></ui-data-table>
        </div>

        <!-- One dialog, reused for both tabs — Alert Notes asks two more
             questions (Visible At, starting status) than a plain note. -->
        <ui-modal id="cnAddModal" heading="${addLabel}" size="md">
          <ui-textarea
            id="cnModalText"
            label-hidden
            label="${activeTab === 'alertNotes' ? 'Alert note' : 'Note'}"
            placeholder="Enter a description…"
            rows="6"
            data-testid="chart--note-text"
          ></ui-textarea>
          ${
            activeTab === 'alertNotes'
              ? `<div class="cn__field-grid">
                  <ui-select
                    label="Visible At"
                    id="cnModalVisibleAt"
                    options="${VISIBLE_AT.join(',')}"
                    value="${VISIBLE_AT[0]}"
                    data-testid="chart--note-visible-at"
                  ></ui-select>
                  <ui-select
                    label="Status"
                    id="cnModalStatus"
                    options="Active,Inactive"
                    value="Active"
                    data-testid="chart--note-status"
                  ></ui-select>
                </div>`
              : ''
          }
          <div class="cn__modal-actions">
            <ui-button variant="outline" data-modal-dismiss data-testid="chart--note-cancel"
              >Cancel</ui-button
            >
            <ui-button variant="primary" data-testid="chart--note-save">Add</ui-button>
          </div>
        </ui-modal>`;

      // ui-tabs owns hiding/showing panels once ITS OWN click handler runs;
      // that happens on the next attribute change, not on this fresh paint.
      // First paint (and every repaint, since host.innerHTML rebuilds
      // everything) has to set the hidden state explicitly.
      host.querySelector('#panel-notes').hidden = activeTab !== 'notes';
      host.querySelector('#panel-alertNotes').hidden = activeTab !== 'alertNotes';

      // Data is configured through JS properties, not markup — a table's
      // rows are data, not HTML, the same contract every other screen with
      // a ui-data-table follows.
      const notesTable = host.querySelector('[data-testid="chart--notes-table"]');
      notesTable.columns = NOTES_COLUMNS;
      notesTable.rows = data.notes;
      notesTable.setAttribute('state', data.notes.length ? 'ready' : 'empty');

      const alertTable = host.querySelector('[data-testid="chart--alert-notes-table"]');
      alertTable.columns = ALERT_NOTES_COLUMNS;
      alertTable.rows = data.alertNotes;
      alertTable.setAttribute('state', data.alertNotes.length ? 'ready' : 'empty');

      syncActions(addLabel);
    }

    /* --- Per-row "⋮" menu ---------------------------------------------------
       A tiny floating menu, built and torn down on demand rather than kept
       as a component — it never needs to exist except while open. */

    function openAddModal(trigger) {
      const modal = host.querySelector('#cnAddModal');
      modal?.open(trigger);
      modal?.querySelector('#cnModalText')?.focus();
    }

    function saveNote() {
      const modal = host.querySelector('#cnAddModal');
      const textField = modal?.querySelector('#cnModalText');
      const text = textField?.value.trim();

      if (!text) {
        textField?.setAttribute('error', 'Enter a note.');
        return;
      }

      if (activeTab === 'alertNotes') {
        const visibleAt = modal.querySelector('#cnModalVisibleAt')?.value || VISIBLE_AT[0];
        const status = modal.querySelector('#cnModalStatus')?.value || 'Active';
        data.alertNotes.unshift({
          id: `an-${Date.now()}-${++uid}`,
          text,
          visibleAt,
          author: CURRENT_USER,
          date: todayDdMmYyyy(),
          active: status === 'Active',
        });
      } else {
        data.notes.unshift({
          id: `n-${Date.now()}-${++uid}`,
          text,
          author: CURRENT_USER,
          date: todayDdMmYyyy(),
        });
      }

      modal.close();
      paint();
      // paint() just tore down and rebuilt the whole panel — including the
      // trigger ui-modal.close() tried to refocus a moment ago, which was
      // still the OLD (now-detached) button. Land focus on the new one.
      head?.querySelector('[data-testid="chart--add-note"]')?.focus();
    }

    function onClick(event) {
      const reasonBtn = event.target.closest('[data-alert-reason]');
      if (reasonBtn) {
        ctx.flash(reasonBtn.title, 'info');
        return;
      }

      const noteMenuBtn = event.target.closest('[data-note-menu]');
      if (noteMenuBtn) {
        const id = noteMenuBtn.dataset.noteMenu;
        openRowMenu(noteMenuBtn, [
          {
            label: 'Edit',
            icon: 'pencil',
            run: () => ctx.flash('Editing a note is not wired up in this prototype yet.'),
          },
          {
            label: 'Delete',
            icon: 'trash',
            danger: true,
            run: () => {
              data.notes = data.notes.filter((n) => n.id !== id);
              paint();
            },
          },
        ]);
        return;
      }

      const alertMenuBtn = event.target.closest('[data-alert-menu]');
      if (alertMenuBtn) {
        const id = alertMenuBtn.dataset.alertMenu;
        const current = data.alertNotes.find((n) => n.id === id);
        openRowMenu(alertMenuBtn, [
          {
            label: current?.active ? 'Mark inactive' : 'Mark active',
            icon: current?.active ? 'eye-off' : 'check',
            run: () => {
              if (!current) return;
              current.active = !current.active;
              paint();
            },
          },
          {
            label: 'Delete',
            icon: 'trash',
            danger: true,
            run: () => {
              data.alertNotes = data.alertNotes.filter((n) => n.id !== id);
              paint();
            },
          },
        ]);
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--note-save"]')) {
        saveNote();
        return;
      }
      // ui-modal itself only reacts to its own close button ([data-close]);
      // author-supplied Cancel buttons wire their own dismissal, the same
      // convention every other modal on this app follows.
      if (event.target.closest('[data-modal-dismiss]')) {
        host.querySelector('#cnAddModal')?.close();
      }
    }

    function onTabChange(event) {
      // 'ui-change' is not exclusive to <ui-tabs> — <ui-textarea> and
      // <ui-select> emit the same event (on blur / on change), and both live
      // inside the Add-note modal. Without this guard, moving focus off the
      // textarea — which is exactly what happens a beat before a real click
      // lands on the Save button — gets misread as "switch to the tab named
      // after whatever the user just typed," which wipes the whole panel
      // (including the button mid-click) on every save.
      if (!event.target.closest('[data-testid="chart--notes-tabs"]')) return;
      activeTab = event.detail.value;
      paint();
    }

    /* --- The module head ------------------------------------------------------
       The strip and the two Add buttons are drawn by the shell, outside this
       host, so their events are listened for there instead.
       ----------------------------------------------------------------------- */

    function onHeadClick(event) {
      if (event.target.closest('[data-testid="chart--add-note"]')) {
        openAddModal(event.target.closest('ui-button'));
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    head?.addEventListener('click', onHeadClick);
    head?.addEventListener('ui-change', onTabChange);
    paint();

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      head?.removeEventListener('click', onHeadClick);
      head?.removeEventListener('ui-change', onTabChange);
      closeRowMenu();
    };
  },
});
