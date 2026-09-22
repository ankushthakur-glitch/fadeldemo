/**
 * One provider's availability — Day Slots and Block Days.
 *
 * Day Slots are simple date ranges the provider is bookable in.
 * Block Days are named periods carved out of those ranges, grouped by month
 * with an always-present inline "add" row at the top of the table.
 */
import {
  DAY_SLOTS,
  BLOCK_DAYS,
  WEEK_DAYS,
  LOCATIONS,
  SLOT_REPEATS,
} from '../../data/appointments.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-01-05" → "January 2026" */
function monthLabel(iso) {
  const [year, month] = iso.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** "2026-01-05" → "05/01/2026" */
function displayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "20:00" → "08:00 PM" */
function displayTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

customElements.whenDefined('ui-data-table').then(() => {
  // The provider name arrives on the query string from the availability list.
  const provider =
    new URLSearchParams(window.location.search).get('provider') || 'Provider';
  document.querySelector('[data-testid="pa--title"]').textContent =
    `${provider} Availability Preferences`;
  document.title = `GastroEMR — ${provider} Availability`;

  initSlots();
  initBlockDays();
});

/* ===================== DAY SLOTS ===================== */

function initSlots() {
  const list = document.getElementById('slotList');
  const addButton = document.querySelector('[data-testid="pa--add-slot"]');
  if (!list) return;

  // Deep copy — each slot owns its own week pattern.
  let slots = DAY_SLOTS.map((s) => ({
    ...s,
    // A slot written before the repeat existed is a weekly one, and reading
    // the default here rather than at every point of use means the select
    // below always has a value to show.
    repeat: s.repeat ?? SLOT_REPEATS[0],
    days: s.days.map((d) => ({ ...d, blocks: d.blocks.map((b) => ({ ...b })) })),
  }));
  let nextId = slots.length + 1;

  const emptyWeek = () =>
    WEEK_DAYS.map((day) => ({
      day,
      enabled: false,
      blocks: [{ start: '', end: '', location: '' }],
    }));

  /** One time block — a row under a day. */
  function blockRow(slot, dayIndex, blockIndex) {
    const day = slot.days[dayIndex];
    const block = day.blocks[blockIndex];
    const isFirst = blockIndex === 0;
    const isLast = blockIndex === day.blocks.length - 1;

    const rowClasses = [
      isFirst && 'set__day-first',
      isLast && 'set__day-last',
      !day.enabled && 'set__day-off',
    ].filter(Boolean).join(' ');

    // Only the first row of a day carries the day name and copy control.
    const dayCell = isFirst
      ? `<td class="set__day-cell">
           <span class="set__day-name">
             <ui-checkbox ${day.enabled ? 'checked' : ''}
               data-day-toggle="${dayIndex}"
               data-testid="pa--day-${day.day.toLowerCase()}">${day.day}</ui-checkbox>
             <button type="button" class="set__copy" data-copy="${dayIndex}"
                     aria-label="Copy ${day.day} to the other days">
               <svg class="ui-icon"><use href="#i-document"></use></svg>
             </button>
           </span>
         </td>`
      : '<td class="set__day-cell"></td>';

    return `<tr class="${rowClasses}" data-day="${dayIndex}" data-block="${blockIndex}">
      ${dayCell}
      <td class="set__time-cell">
        <ui-input type="time" label="Start time ${day.day}" label-hidden
                  value="${block.start}" data-field="start"
                  ${day.enabled ? '' : 'disabled'}></ui-input>
      </td>
      <td class="set__time-cell">
        <ui-input type="time" label="End time ${day.day}" label-hidden
                  value="${block.end}" data-field="end"
                  ${day.enabled ? '' : 'disabled'}></ui-input>
      </td>
      <td class="set__location-cell">
        <ui-select label="Location ${day.day}" label-hidden placeholder="Location"
                   options="${LOCATIONS.join(',')}" value="${block.location}"
                   data-field="location" ${day.enabled ? '' : 'disabled'}></ui-select>
      </td>
      <td class="set__row-actions">
        <button type="button" class="set__icon-danger" data-remove-block="${blockIndex}"
                aria-label="Remove this time block from ${day.day}">
          <svg class="ui-icon"><use href="#i-trash"></use></svg>
        </button>
        ${
          isLast
            ? `<button type="button" class="set__add-block" data-add-block="${dayIndex}"
                 aria-label="Add another time block to ${day.day}">
                 <svg class="ui-icon"><use href="#i-plus"></use></svg>
               </button>`
            : ''
        }
      </td>
    </tr>`;
  }

  function slotMarkup(slot) {
    const rows = slot.days
      .map((day, dayIndex) =>
        day.blocks.map((_, blockIndex) => blockRow(slot, dayIndex, blockIndex)).join('')
      )
      .join('');

    return `<section class="set__slot" data-slot="${slot.id}">
      <div class="set__slot-head">
        <span class="set__slot-label">Date Range</span>
        <ui-input type="date" label="From" label-hidden value="${slot.from}"
                  data-range="from"></ui-input>
        <ui-input type="date" label="To" label-hidden value="${slot.to}"
                  data-range="to"></ui-input>
        <!-- HOW OFTEN THE PATTERN BELOW COMES ROUND.
             It sits beside the dates because it is the third part of the same
             sentence: from this date, to that one, this often. A clinician who
             works alternate Mondays keeps the weekly days in one slot and puts
             the Monday in a slot of its own set to "Every other week"; the
             alternation is counted from that slot's own From date, so which
             week is the on one is decided by when the arrangement started. -->
        <ui-select label="Repeat" label-hidden options="${SLOT_REPEATS.join(',')}"
                   value="${slot.repeat}" data-repeat="${slot.id}"
                   data-testid="pa--slot-repeat"></ui-select>
        <span class="set__spacer"></span>
        <button type="button" class="set__icon-danger" data-remove-slot="${slot.id}"
                aria-label="Remove this date range">
          <svg class="ui-icon"><use href="#i-trash"></use></svg>
        </button>
        <button type="button" class="set__slot-toggle" data-toggle="${slot.id}"
                aria-expanded="${slot.expanded}"
                aria-controls="slot-body-${slot.id}"
                aria-label="${slot.expanded ? 'Collapse' : 'Expand'} weekly hours">
          <svg class="ui-icon"><use href="#i-caret-up"></use></svg>
        </button>
      </div>
      <div class="set__slot-body" id="slot-body-${slot.id}" ${slot.expanded ? '' : 'hidden'}>
        <table class="set__week">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Start Time</th>
              <th scope="col">End Time</th>
              <th scope="col">Location</th>
              <th scope="col"><span class="u-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }

  function paint() {
    list.innerHTML = slots.map(slotMarkup).join('');
    wire();
  }

  function slotOf(el) {
    return slots.find((s) => s.id === el.closest('[data-slot]').dataset.slot);
  }

  function wire() {
    list.querySelectorAll('[data-repeat]').forEach((select) =>
      select.addEventListener('ui-change', (event) => {
        const slot = slots.find((s) => s.id === select.dataset.repeat);
        if (slot) slot.repeat = event.detail.value;
      })
    );

    // Expand / collapse the weekly pattern.
    list.querySelectorAll('[data-toggle]').forEach((button) =>
      button.addEventListener('click', () => {
        const slot = slots.find((s) => s.id === button.dataset.toggle);
        slot.expanded = !slot.expanded;
        paint();
      })
    );

    list.querySelectorAll('[data-remove-slot]').forEach((button) =>
      button.addEventListener('click', () => {
        slots = slots.filter((s) => s.id !== button.dataset.removeSlot);
        paint();
      })
    );

    // Turning a day on or off enables its whole row set.
    list.querySelectorAll('[data-day-toggle]').forEach((box) =>
      box.addEventListener('ui-change', (event) => {
        const slot = slotOf(box);
        slot.days[Number(box.dataset.dayToggle)].enabled = event.detail.checked;
        paint();
      })
    );

    // Copy this day's blocks to every other enabled day.
    list.querySelectorAll('[data-copy]').forEach((button) =>
      button.addEventListener('click', () => {
        const slot = slotOf(button);
        const source = slot.days[Number(button.dataset.copy)];
        slot.days = slot.days.map((day) =>
          day.day === source.day
            ? day
            : { ...day, enabled: true, blocks: source.blocks.map((b) => ({ ...b })) }
        );
        paint();
      })
    );

    list.querySelectorAll('[data-add-block]').forEach((button) =>
      button.addEventListener('click', () => {
        const slot = slotOf(button);
        const day = slot.days[Number(button.dataset.addBlock)];
        day.blocks = [...day.blocks, { start: '', end: '', location: '' }];
        paint();
      })
    );

    list.querySelectorAll('[data-remove-block]').forEach((button) =>
      button.addEventListener('click', () => {
        const slot = slotOf(button);
        const row = button.closest('tr');
        const day = slot.days[Number(row.dataset.day)];
        const index = Number(button.dataset.removeBlock);
        // A day always keeps at least one row so the pattern stays editable.
        day.blocks =
          day.blocks.length > 1
            ? day.blocks.filter((_, i) => i !== index)
            : [{ start: '', end: '', location: '' }];
        paint();
      })
    );
  }

  addButton?.addEventListener('ui-click', () => {
    slots = [
      ...slots,
      { id: `ds${nextId++}`, from: '', to: '', expanded: true, repeat: SLOT_REPEATS[0], days: emptyWeek() },
    ];
    paint();
  });

  paint();
}

/* ===================== BLOCK DAYS ===================== */

function initBlockDays() {
  const table = document.getElementById('blockTable');
  if (!table) return;

  let blocks = BLOCK_DAYS.map((b) => ({ ...b }));
  let nextId = blocks.length + 1;

  const COLUMNS = [
    { key: 'title', label: 'Title', truncate: true },
    { key: 'start', label: 'Start Date', render: (r) => displayDate(r.start) },
    { key: 'end', label: 'End Date', render: (r) => displayDate(r.end) },
    { key: 'startTime', label: 'Start Time', render: (r) => displayTime(r.startTime) },
    { key: 'endTime', label: 'End Time', render: (r) => displayTime(r.endTime) },
    {
      key: 'actions',
      label: 'Actions',
      actions: true,
      render: (r) =>
        r.isGroup
          ? ''
          : `<span class="set__row-actions">
               <button type="button" class="set__icon-danger" data-remove="${r.id}"
                       aria-label="Remove ${r.title}">
                 <svg class="ui-icon"><use href="#i-trash"></use></svg>
               </button>
               <button type="button" class="ui-row-menu-btn" data-edit="${r.id}"
                       aria-label="Edit ${r.title}">
                 <svg class="ui-icon"><use href="#i-pencil"></use></svg>
               </button>
             </span>`,
    },
  ];

  /**
   * Rows, with a month heading inserted before each new month — the grouping
   * the legacy screen uses so a long list stays readable.
   */
  function groupedRows() {
    const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
    const out = [];
    let currentMonth = null;

    for (const block of sorted) {
      const label = monthLabel(block.start);
      if (label !== currentMonth) {
        currentMonth = label;
        out.push({ id: `group-${label}`, title: label, isGroup: true });
      }
      out.push(block);
    }
    return out;
  }

  function paint() {
    table.columns = COLUMNS;
    table.rows = groupedRows();
    table.setAttribute('state', blocks.length ? 'ready' : 'empty');

    // Tag the month headings so CSS can style the whole row.
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const id = tr.dataset.rowId || '';
      if (id.startsWith('group-')) tr.classList.add('set__group-row');
    });

    table.querySelectorAll('[data-remove]').forEach((button) =>
      button.addEventListener('click', () => {
        blocks = blocks.filter((b) => b.id !== button.dataset.remove);
        paint();
      })
    );
  }

  paint();

  /* --- Inline add row ---------------------------------------------------- */

  const form = document.getElementById('blockForm');
  const titleField = document.querySelector('[data-testid="pa--block-title"]');
  const startField = document.querySelector('[data-testid="pa--block-start"]');
  const endField = document.querySelector('[data-testid="pa--block-end"]');
  const addButton = document.querySelector('[data-testid="pa--block-add"]');

  addButton?.addEventListener('ui-click', () => {
    const title = titleField.value.trim();
    const start = startField.value;

    // Title and a start date are the minimum that makes a block meaningful.
    if (!title || !start) {
      titleField.setAttribute(
        'error',
        !title ? 'Give the block a title' : 'Pick a start date'
      );
      return;
    }
    titleField.removeAttribute('error');

    const times = form.querySelectorAll('ui-input[type="time"]');
    blocks = [
      ...blocks,
      {
        id: `bd${nextId++}`,
        title,
        start,
        end: endField.value || start,
        startTime: times[0]?.value || '00:00',
        endTime: times[1]?.value || '20:00',
      },
    ];

    titleField.value = '';
    startField.value = '';
    endField.value = '';
    paint();
  });
}
