/**
 * TASKS — what is owed on THIS patient, and what they are due back for.
 *
 * Two tabs, because they answer two different questions:
 *
 *   Tasks     work someone owes now — a result to review, an authorisation to
 *             chase, a form that has not come back. Every one has an owner and
 *             a due date, and it is done or it is not.
 *   Recalls   work the PATIENT is due back for, months or years out. Nobody
 *             owes anything today; the question is whether they have been
 *             contacted and whether it is booked.
 *
 * Counting a recall as a task would put a number on the sidebar badge that
 * means "things to do" and include a colonoscopy due in 2029.
 *
 * WHY THIS IS NOT TASK MANAGEMENT
 * screens/tasks.html is the clinic's whole queue, filtered by who owns it.
 * This is the same work cut by patient instead, which is the cut you want
 * while you are looking at one. The vocabularies come from data/tasks.js so a
 * priority means the same thing on both; only the framing differs — no Patient
 * column here, and the New dialogs do not ask which patient, because the chart
 * has already answered that.
 *
 * SECONDARY TABS. The chart's left rail is the primary navigation, so these
 * are the underline strip — same level as Orders' and Prescriptions' own tabs.
 *
 * ctx provides { patient, age, go, flash }. The dialogs and the row menu are
 * this module's own, same contract as every other chart module.
 */
import { registerModule } from './chart-workspace.js';
import {
  CHART_TASKS,
  EMPTY_CHART_TASKS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  STAFF,
  CURRENT_USER,
  RECALL_STATUSES,
  RECALL_TYPES,
  RECALL_INTERVALS,
  RECALL_PROVIDERS,
  RECALL_LOCATIONS,
} from '../../data/chart-tasks.js';

/* ============================================================================
   SMALL HELPERS — kept local, matching how every other chart module keeps its
   own tiny date/escape helpers rather than reaching for a shared bag.
   ========================================================================= */

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

/** Fixed so the demo reads the same every run — same date the rest of the app uses. */
const TODAY = '2026-08-07';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Whole days from TODAY to an ISO date. Negative is in the past. */
function daysFromToday(iso) {
  const day = 86_400_000;
  return Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${TODAY}T00:00:00`)) / day);
}

/**
 * "Today", "Overdue 2 d", "14 Aug 26".
 *
 * Derived rather than stored: a saved "Overdue 2 d" is wrong the day after it
 * is written, and this data outlives a session. Near dates read as a distance
 * because that is the question — a date more than a week out is just a date.
 */
function dueLabel(iso) {
  if (!iso) return '—';
  const days = daysFromToday(iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `Overdue ${Math.abs(days)} d`;
  if (days <= 7) return `In ${days} d`;
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function badge(vocab, key, testid) {
  const entry = vocab[key];
  if (!entry) return esc(key ?? '—');
  return `<ui-badge status="${entry.tone}" size="sm"${
    testid ? ` data-testid="${testid}"` : ''
  }>${esc(entry.label)}</ui-badge>`;
}

/** Status recomputed from the due date, so a row cannot claim "Open" while overdue. */
function taskStatusFor(task) {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'in-progress') return 'in-progress';
  return daysFromToday(task.due) < 0 ? 'overdue' : 'open';
}

function recallStatusFor(recall) {
  if (recall.status === 'booked' || recall.status === 'letter-sent') return recall.status;
  const days = daysFromToday(recall.due);
  if (days < 0) return 'overdue';
  return days <= 30 ? 'due' : 'upcoming';
}

const todayIso = () => TODAY;

/* ============================================================================
   COLUMNS

   No Patient column on either table. You are inside one patient's chart; a
   column repeating the name in the header on every row is a column of noise
   where the due date could be.
   ========================================================================= */

/**
 * SEVEN COLUMNS, NOT NINE.
 *
 * The chart panel is the window minus a 23rem sidebar, and the practice-wide
 * worklist's nine columns do not fit in it — Status and the action button were
 * the two pushed off the right-hand edge, which are the two the list exists
 * for. Scrollbars are hidden app-wide, so they were not merely awkward to
 * reach, they were invisible.
 *
 * So the metadata that is READ ONCE ON OPENING a task rides in the row's
 * second line instead of taking a column of its own: Type belongs to the
 * subject, and Interval and Location belong to the recall they describe. The
 * columns that remain are the ones you SCAN — what, how urgent, who owes it,
 * when, where it is up to.
 */
const TASK_COLUMNS = [
  {
    key: 'id',
    label: 'Task',
    sortable: true,
    render: (row) => `<span class="ctk__id">${esc(row.id)}</span>`,
  },
  {
    key: 'subject',
    label: 'Subject',
    wrap: true,
    sortable: true,
    render: (row) => {
      const sub = [row.type, row.detail].filter(Boolean).join(' · ');
      return `<div class="ctk__stack">
        <strong>${esc(row.subject)}</strong>
        ${sub ? `<span class="ctk__detail" title="${esc(sub)}">${esc(sub)}</span>` : ''}
      </div>`;
    },
  },
  {
    key: 'priority',
    label: 'Priority',
    render: (row) => badge(TASK_PRIORITIES, row.priority),
  },
  {
    key: 'assignedTo',
    label: 'Assigned to',
    sortable: true,
    wrap: true,
    render: (row) => `<div class="ctk__stack">
      <span>${esc(row.assignedTo)}</span>
      ${row.from ? `<span class="ctk__detail">from ${esc(row.from)}</span>` : ''}
    </div>`,
  },
  {
    key: 'due',
    label: 'Due',
    sortable: true,
    render: (row) => `<span class="ctk__due">${esc(dueLabel(row.due))}</span>`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => badge(TASK_STATUSES, taskStatusFor(row)),
  },
  {
    key: 'actions',
    label: '',
    render: (row) =>
      taskStatusFor(row) === 'completed'
        ? `<span class="ctk__done">${icon('check')}Done</span>`
        : `<div class="ctk__row-buttons">
             <ui-button variant="outline" size="sm" data-complete="${esc(row.id)}"
               >Complete</ui-button>
           </div>`,
  },
];

const RECALL_COLUMNS = [
  {
    key: 'id',
    label: 'Recall',
    sortable: true,
    render: (row) => `<span class="ctk__id">${esc(row.id)}</span>`,
  },
  {
    key: 'dueFor',
    label: 'Due for',
    wrap: true,
    sortable: true,
    render: (row) => `<div class="ctk__stack">
      <strong>${esc(row.dueFor)}</strong>
      <span class="ctk__detail">every ${esc(row.interval)}</span>
    </div>`,
  },
  {
    key: 'provider',
    label: 'Provider',
    sortable: true,
    wrap: true,
    render: (row) => `<div class="ctk__stack">
      <span>${esc(row.provider)}</span>
      <span class="ctk__detail">${esc(row.location)}</span>
    </div>`,
  },
  {
    key: 'due',
    label: 'Due',
    sortable: true,
    render: (row) => `<span class="ctk__due">${esc(dueLabel(row.due))}</span>`,
  },
  {
    key: 'lastContacted',
    label: 'Last contacted',
    render: (row) =>
      row.lastContacted
        ? esc(row.lastContacted)
        : '<span class="ctk__never">Never</span>',
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => badge(RECALL_STATUSES, recallStatusFor(row)),
  },
  {
    key: 'actions',
    label: '',
    render: (row) =>
      recallStatusFor(row) === 'booked'
        ? `<span class="ctk__done">${icon('check')}Booked</span>`
        : `<div class="ctk__row-buttons">
             <ui-button variant="outline" size="sm" data-booked="${esc(row.id)}"
               >Mark booked</ui-button>
           </div>`,
  },
];

/* ============================================================================
   DIALOGS

   Neither asks which patient. The chart has already answered that, and a
   patient picker here is a field whose only possible wrong answer is filing
   work against somebody else.
   ========================================================================= */

function options(list) {
  return list.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
}

function newTaskModal(patientName) {
  return `<ui-modal id="ctkTaskModal" heading="New task" size="md" variant="drawer">
    <p class="ctk__for">For <strong>${esc(patientName)}</strong></p>

    <div class="ctk__form">
      <ui-input class="ctk__field--wide" label="Subject" required
        data-testid="chart--task-subject"></ui-input>

      <ui-select label="Type" id="ctkTaskType" data-testid="chart--task-type">
        ${options(TASK_TYPES)}
      </ui-select>
      <ui-select label="Priority" id="ctkTaskPriority" data-testid="chart--task-priority">
        ${Object.values(TASK_PRIORITIES)
          .map((p) => `<option value="${esc(p.label)}">${esc(p.label)}</option>`)
          .join('')}
      </ui-select>

      <ui-select label="Assign to" id="ctkTaskAssignee" data-testid="chart--task-assignee">
        ${options(STAFF)}
      </ui-select>
      <ui-input label="Due date" type="date" id="ctkTaskDue" required
        data-testid="chart--task-due"></ui-input>

      <ui-textarea class="ctk__field--wide" label="Note" rows="3"
        data-testid="chart--task-note"></ui-textarea>
    </div>

    <div class="ui-modal__actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--task-cancel"
        >Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-testid="chart--task-save">Create task</ui-button>
    </div>
  </ui-modal>`;
}

function newRecallModal(patientName) {
  return `<ui-modal id="ctkRecallModal" heading="New recall" size="md" variant="drawer">
    <p class="ctk__for">For <strong>${esc(patientName)}</strong></p>

    <div class="ctk__form">
      <ui-select class="ctk__field--wide" label="Due for" id="ctkRecallType" required
        placeholder="Select" data-testid="chart--recall-type">
        ${options(RECALL_TYPES)}
      </ui-select>

      <ui-select label="Interval" id="ctkRecallInterval" data-testid="chart--recall-interval">
        ${options(RECALL_INTERVALS)}
      </ui-select>
      <ui-input label="Due date" type="date" id="ctkRecallDue" required
        data-testid="chart--recall-due"></ui-input>

      <ui-select label="Provider" id="ctkRecallProvider" data-testid="chart--recall-provider">
        ${options(RECALL_PROVIDERS)}
      </ui-select>
      <ui-select label="Location" id="ctkRecallLocation" data-testid="chart--recall-location">
        ${options(RECALL_LOCATIONS)}
      </ui-select>

      <ui-textarea class="ctk__field--wide" label="Note" rows="3"
        data-testid="chart--recall-note"></ui-textarea>
    </div>

    <div class="ui-modal__actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--recall-cancel"
        >Cancel</ui-button>
      <span class="ui-modal__actions-spacer"></span>
      <ui-button variant="primary" data-testid="chart--recall-save">Create recall</ui-button>
    </div>
  </ui-modal>`;
}

/* ========================================================================= */

/**
 * The head's action slot for one list. It lives out here rather than in
 * render() because the shell asks for it once, at mount, before the module's
 * own state exists — syncActions() replaces it whenever the list changes.
 *
 * The completed toggle is drawn only for Tasks. A recall is never completed,
 * it is booked, so on Recalls the control is not hidden but absent: a switch
 * that cannot change anything about what is on screen is furniture, and a
 * screen reader would still find it and read it out.
 *
 * The state the search box carries is passed in because this slot is rebuilt
 * from scratch on a switch. Defaults cover the mount call, which happens
 * before the module's state object exists.
 */
function tabActions(tab, { search = '', showDone = false } = {}) {
  const tasksOn = tab === 'tasks';
  return `<ui-input class="ord__search" size="sm" icon="search"
      label="Search ${tasksOn ? 'tasks' : 'recalls'}" label-hidden placeholder="Search"
      value="${esc(search)}" data-testid="chart--tasks-search"></ui-input
    >${
      tasksOn
        ? `<ui-checkbox ${showDone ? 'checked' : ''}
             data-testid="chart--tasks-show-done">Show completed</ui-checkbox>`
        : ''
    }<ui-button variant="primary" size="sm" icon="plus" data-testid="chart--tasks-new"
      >New ${tasksOn ? 'task' : 'recall'}</ui-button
    >`;
}

registerModule('tasks', {
  /* The strip below already reads "Tasks" and "Recalls", and the sidebar row
     lit beside it says Tasks too; a bare "Tasks" heading between them was a
     third copy of the same word to step over on the way to the switch — and
     on a laptop it was the width that pushed the search box, the completed
     toggle and New onto a second row of the head. hideTitle takes the name
     off the screen without taking it out of the document: the h2 is still
     there for a screen reader and for the outline, and because .u-sr-only is
     absolutely positioned it is not a flex item, so the strip starts at the
     panel's own left edge rather than one gap in from it. Same arrangement as
     Appointments and Profile. */
  hideTitle: true,

  /* The Tasks / Recalls switch sits in the module head, between the heading
     and the actions — the slot the shell reserves for exactly this, so a
     module's own view switch is at the same height in every module. */
  tabs: () =>
    `<ui-tabs primary selected="tasks" data-testid="chart--tasks-tabs">
      <ui-tab value="tasks" label="Tasks"></ui-tab>
      <ui-tab value="recalls" label="Recalls"></ui-tab>
    </ui-tabs>`,

  /* The search box, the completed toggle and New follow the strip up onto the
     heading row, where every other module's whole-module controls now sit.
     Which of them are drawn depends on the open list, so this is only the
     opening set — see syncActions() and tabActions() above. */
  actions: () => tabActions('tasks'),

  render(host, ctx) {
    const seed = CHART_TASKS[ctx.patient.mrn] || EMPTY_CHART_TASKS;
    // Copied rather than mutated in place — switching patients and coming back
    // must not carry rows added during the previous visit.
    const data = {
      tasks: seed.tasks.map((row) => ({ ...row })),
      recalls: seed.recalls.map((row) => ({ ...row })),
    };

    const state = { tab: 'tasks', search: '', showDone: false };

    /* The strip and the three controls beside it are the shell's markup,
       rendered into the head — a sibling of this host, not a descendant. */
    const head = host.parentElement;

    /** Next id in the same series the seed data uses, so ids stay readable. */
    let nextTask = 4500;
    let nextRecall = 2400;

    function visibleTasks() {
      let rows = data.tasks;
      if (!state.showDone) rows = rows.filter((t) => taskStatusFor(t) !== 'completed');
      if (state.search) {
        const q = state.search.toLowerCase();
        rows = rows.filter(
          (t) =>
            t.subject.toLowerCase().includes(q) ||
            (t.detail ?? '').toLowerCase().includes(q) ||
            t.assignedTo.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        );
      }
      // Soonest first: a worklist is read top-down and the thing most overdue
      // is the thing to do next.
      return [...rows].sort((a, b) => a.due.localeCompare(b.due));
    }

    function visibleRecalls() {
      let rows = data.recalls;
      if (state.search) {
        const q = state.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.dueFor.toLowerCase().includes(q) ||
            r.provider.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q)
        );
      }
      return [...rows].sort((a, b) => a.due.localeCompare(b.due));
    }

    /** How many tasks are outstanding — what the sidebar badge counts. */
    const openCount = () =>
      data.tasks.filter((t) => taskStatusFor(t) !== 'completed').length;

    /* --- Paint ------------------------------------------------------------- */

    /** The head's controls, on every paint.
     *
     *  They are only rewritten when the list actually changed. A dialog
     *  remembers the button that opened it so it can hand focus back on
     *  close, and rebuilding that button on every repaint — the search runs
     *  one per keystroke — would leave the dialog holding a node that is no
     *  longer in the document. */
    function syncActions() {
      const actions = head?.querySelector('.ch__module-actions');
      if (!actions || actions.dataset.tab === state.tab) return;
      actions.dataset.tab = state.tab;
      actions.innerHTML = tabActions(state.tab, state);
    }

    function paint() {
      const tasksOn = state.tab === 'tasks';
      syncActions();

      host.innerHTML = `<div id="panel-tasks" role="tabpanel" class="ord__panel" ${tasksOn ? '' : 'hidden'}>
          <ui-data-table empty-text="Nothing owed on this patient."
            data-testid="chart--tasks-table"></ui-data-table>
        </div>
        <div id="panel-recalls" role="tabpanel" class="ord__panel" ${tasksOn ? 'hidden' : ''}>
          <ui-data-table empty-text="No recall scheduled for this patient."
            data-testid="chart--recalls-table"></ui-data-table>
        </div>

        ${newTaskModal(ctx.patient.name)}
        ${newRecallModal(ctx.patient.name)}`;

      const taskTable = host.querySelector('[data-testid="chart--tasks-table"]');
      taskTable.columns = TASK_COLUMNS;
      taskTable.rows = tasksOn ? visibleTasks() : [];
      taskTable.setAttribute('state', taskTable.rows.length ? 'ready' : 'empty');

      const recallTable = host.querySelector('[data-testid="chart--recalls-table"]');
      recallTable.columns = RECALL_COLUMNS;
      recallTable.rows = tasksOn ? [] : visibleRecalls();
      recallTable.setAttribute('state', recallTable.rows.length ? 'ready' : 'empty');
    }

    /* --- Creating ---------------------------------------------------------- */

    /**
     * Every dropdown is opened on a real answer, never on a blank.
     *
     * ui-select shows an empty first option while its value is unset, so a
     * dialog that does not seed them opens with two blank boxes the user has
     * to fill in to say the most ordinary thing — a routine general task. The
     * defaults here are the commonest answer, so the fast path is Subject,
     * date, Create.
     */
    function openTaskDialog(trigger) {
      const modal = host.querySelector('#ctkTaskModal');
      const subject = host.querySelector('[data-testid="chart--task-subject"]');
      subject?.removeAttribute('error');
      subject?.setAttribute('value', '');

      host.querySelector('#ctkTaskType')?.setAttribute('value', TASK_TYPES[0]);
      host.querySelector('#ctkTaskPriority')?.setAttribute('value', TASK_PRIORITIES.low.label);
      host.querySelector('#ctkTaskAssignee')?.setAttribute('value', CURRENT_USER);

      const due = host.querySelector('#ctkTaskDue');
      due?.removeAttribute('error');
      due?.setAttribute('value', todayIso());

      const note = host.querySelector('[data-testid="chart--task-note"] textarea');
      if (note) note.value = '';

      modal.open(trigger);
    }

    function saveTask() {
      const subjectField = host.querySelector('[data-testid="chart--task-subject"]');
      const dueField = host.querySelector('#ctkTaskDue');
      const subject = (subjectField?.value || '').trim();
      const due = dueField?.value || '';

      // Both problems reported at once — validating one field at a time makes
      // the user press Create twice to find two mistakes.
      let ok = true;
      if (!subject) {
        subjectField?.setAttribute('error', 'Give the task a subject.');
        ok = false;
      } else subjectField?.removeAttribute('error');

      if (!due) {
        dueField?.setAttribute('error', 'Set a due date.');
        ok = false;
      } else dueField?.removeAttribute('error');

      if (!ok) {
        (subject ? dueField : subjectField)?.focus();
        return;
      }

      const priorityLabel = host.querySelector('#ctkTaskPriority')?.value;
      nextTask += 1;

      data.tasks.unshift({
        id: `TK-${nextTask}`,
        subject,
        detail: (host.querySelector('[data-testid="chart--task-note"]')?.value || '').trim(),
        type: host.querySelector('#ctkTaskType')?.value || TASK_TYPES[0],
        priority:
          Object.keys(TASK_PRIORITIES).find(
            (key) => TASK_PRIORITIES[key].label === priorityLabel
          ) ?? 'low',
        assignedTo: host.querySelector('#ctkTaskAssignee')?.value || CURRENT_USER,
        from: 'Self',
        due,
        status: 'open',
      });

      host.querySelector('#ctkTaskModal').close();
      paint();
      ctx.flash?.(`Task created for ${ctx.patient.name}.`, 'success');
    }

    function openRecallDialog(trigger) {
      const modal = host.querySelector('#ctkRecallModal');
      for (const id of ['#ctkRecallType', '#ctkRecallDue']) {
        host.querySelector(id)?.removeAttribute('error');
      }

      // "Due for" alone opens blank: it is the one answer nobody can guess,
      // and a pre-picked procedure is how the wrong recall gets filed.
      host.querySelector('#ctkRecallType')?.setAttribute('value', '');
      host.querySelector('#ctkRecallDue')?.setAttribute('value', '');
      host.querySelector('#ctkRecallInterval')?.setAttribute('value', RECALL_INTERVALS[2]);
      host.querySelector('#ctkRecallProvider')?.setAttribute('value', RECALL_PROVIDERS[0]);
      host.querySelector('#ctkRecallLocation')?.setAttribute('value', RECALL_LOCATIONS[0]);

      const note = host.querySelector('[data-testid="chart--recall-note"] textarea');
      if (note) note.value = '';

      modal.open(trigger);
    }

    function saveRecall() {
      const typeField = host.querySelector('#ctkRecallType');
      const dueField = host.querySelector('#ctkRecallDue');
      const type = typeField?.value || '';
      const due = dueField?.value || '';

      let ok = true;
      if (!type) {
        typeField?.setAttribute('error', 'Choose what the patient is due for.');
        ok = false;
      } else typeField?.removeAttribute('error');

      if (!due) {
        dueField?.setAttribute('error', 'Set a due date.');
        ok = false;
      } else dueField?.removeAttribute('error');

      if (!ok) return;

      nextRecall += 1;
      data.recalls.unshift({
        id: `RC-${nextRecall}`,
        dueFor: type,
        interval: host.querySelector('#ctkRecallInterval')?.value || RECALL_INTERVALS[2],
        provider: host.querySelector('#ctkRecallProvider')?.value || RECALL_PROVIDERS[0],
        location: host.querySelector('#ctkRecallLocation')?.value || RECALL_LOCATIONS[0],
        due,
        lastContacted: null,
        status: 'upcoming',
      });

      host.querySelector('#ctkRecallModal').close();
      paint();
      ctx.flash?.(`Recall created for ${ctx.patient.name}.`, 'success');
    }

    /* --- Wiring -------------------------------------------------------------
       One delegated listener on the host rather than a set rebound on every
       paint: paint() replaces the whole panel, so per-element listeners would
       have to be re-attached each time and any that were missed would leave a
       dead button behind. */

    /* The strip, the search box, the completed toggle and New are the shell's
       markup in the head above this host, so their events are heard there. */

    function onHeadChange(event) {
      const target = event.target;

      if (target.matches('[data-testid="chart--tasks-tabs"]')) {
        state.tab = event.detail.value;
        state.search = '';
        paint();
        return;
      }

      if (target.matches('[data-testid="chart--tasks-show-done"]')) {
        state.showDone = event.detail.checked;
        paint();
      }
    }

    function onHeadInput(event) {
      if (!event.target.matches('[data-testid="chart--tasks-search"]')) return;
      state.search = event.detail.value;

      // Only the table is redrawn — the panel below the head is all that the
      // search changes, and repainting more than that is work for nothing.
      const which = state.tab === 'tasks' ? 'chart--tasks-table' : 'chart--recalls-table';
      const table = host.querySelector(`[data-testid="${which}"]`);
      table.rows = state.tab === 'tasks' ? visibleTasks() : visibleRecalls();
      table.setAttribute('state', table.rows.length ? 'ready' : 'empty');
    }

    function onHeadUiClick(event) {
      if (!event.target.matches('[data-testid="chart--tasks-new"]')) return;
      if (state.tab === 'tasks') openTaskDialog(event.target);
      else openRecallDialog(event.target);
    }

    head?.addEventListener('ui-change', onHeadChange);
    head?.addEventListener('ui-input', onHeadInput);
    head?.addEventListener('ui-click', onHeadUiClick);

    host.addEventListener('ui-click', (event) => {
      const target = event.target;

      if (target.matches('[data-testid="chart--task-save"]')) return saveTask();
      if (target.matches('[data-testid="chart--recall-save"]')) return saveRecall();

      const complete = target.closest('[data-complete]');
      if (complete) {
        const task = data.tasks.find((t) => t.id === complete.dataset.complete);
        if (task) {
          task.status = 'completed';
          paint();
          ctx.flash?.(`${task.id} marked complete.`, 'success');
        }
        return;
      }

      const booked = target.closest('[data-booked]');
      if (booked) {
        const recall = data.recalls.find((r) => r.id === booked.dataset.booked);
        if (recall) {
          recall.status = 'booked';
          recall.lastContacted = dueLabel(todayIso()) === 'Today' ? 'Today' : recall.lastContacted;
          paint();
          ctx.flash?.(`${recall.id} marked booked.`, 'success');
        }
      }
    });

    // Both dialogs use the shared dismiss marker, which needs one listener per
    // screen — see the same line in patient-add.js and chart-documents.js.
    host.addEventListener('click', (event) => {
      if (!event.target.closest('[data-modal-dismiss]')) return;
      host.querySelector('#ctkTaskModal')?.close();
      host.querySelector('#ctkRecallModal')?.close();
    });

    paint();

    /* The head outlives this module — the shell reuses the same workspace
       element for whatever is opened next — so the three listeners left on it
       have to come off again, unlike the ones on the panel, which go with the
       markup they are attached to. */
    return () => {
      head?.removeEventListener('ui-change', onHeadChange);
      head?.removeEventListener('ui-input', onHeadInput);
      head?.removeEventListener('ui-click', onHeadUiClick);
    };
  },
});
