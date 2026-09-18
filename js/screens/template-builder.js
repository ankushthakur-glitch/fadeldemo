/**
 * Settings ▸ Templates ▸ the builder.
 *
 * A template is an ORDERED LIST OF SECTIONS. This screen is that list and the
 * palette it is assembled from: every section the practice has on the left,
 * the running order on the right, drag between them.
 *
 * WHY DRAG IS NOT THE ONLY WAY
 * The legacy builder is drag-only, which makes it unusable by keyboard and
 * awkward on a trackpad when the list is longer than the window. So there are
 * three ways to do the same thing, and they all write the same state:
 *
 *   click a palette row      appends to the end
 *   drag a palette row       inserts where it is dropped
 *   ↑ / ↓ on a canvas row    moves it one place
 *
 * WHY THE ORDER IS THE WHOLE MODEL
 * Nothing here edits what a section CONTAINS — that belongs to the section,
 * and is the same wherever it appears. A template only decides which sections
 * a note has and in what order, so that is all this screen stores.
 *
 * ?id=       open an existing template
 * ?kind=     start a new one of that kind
 * &mode=view read-only; the palette and the row controls stand down
 */
import {
  SECTION_GROUPS,
  SECTION_INDEX,
  sectionById,
  TEMPLATES,
  TEMPLATE_TYPES,
  kindById,
} from '../../data/templates.js';

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const icon = (name, className = 'ui-icon') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const params = new URLSearchParams(window.location.search);
const existing = TEMPLATES.find((row) => row.id === params.get('id')) ?? null;

const state = {
  readOnly: params.get('mode') === 'view',
  kind: existing?.kind ?? params.get('kind') ?? 'visit-notes',
  title: existing?.name ?? '',
  type: existing?.type ?? TEMPLATE_TYPES[0],
  /* Each entry is { uid, sectionId }. A uid rather than the section id alone
     because a spacer can legitimately appear five times, and reordering by
     value cannot tell those five apart. */
  sections: (existing?.sections ?? []).map((sectionId, index) => ({
    uid: `s${index}`,
    sectionId,
  })),
  query: '',
  dragging: null,
};

let nextUid = state.sections.length;

/** Sections marked `once` and already placed cannot be added again. */
const usedOnce = () =>
  new Set(
    state.sections
      .map((entry) => entry.sectionId)
      .filter((id) => sectionById(id)?.once)
  );

/* ===================== The palette ===================== */

function paintPalette() {
  const q = state.query.trim().toLowerCase();
  const placed = usedOnce();

  const groups = SECTION_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter(
      (section) => !q || section.label.toLowerCase().includes(q)
    ),
  })).filter((group) => group.sections.length);

  el('tbPaletteEmpty').hidden = groups.length > 0;

  el('tbPalette').innerHTML = groups
    .map(
      (group) => `<div class="tb__group">
        <h3 class="tb__group-title">${esc(group.label)}</h3>
        ${group.sections
          .map((section) => {
            // A "once" section already in the template stays visible but
            // inert: hiding it would leave the reader wondering where it
            // went, and the tick says the template already has it.
            const used = placed.has(section.id);
            return `<button type="button"
              class="tb__chip${used ? ' tb__chip--used' : ''}"
              ${used || state.readOnly ? 'disabled' : `draggable="true"`}
              data-section="${esc(section.id)}"
              data-testid="tb--chip-${esc(section.id)}">
              ${icon('plus', 'ui-icon tb__chip-add')}
              <span>${esc(section.label)}</span>
              ${used ? icon('check', 'ui-icon tb__chip-used') : ''}
            </button>`;
          })
          .join('')}
      </div>`
    )
    .join('');
}

/* ===================== The canvas ===================== */

function paintCanvas() {
  const list = el('tbList');

  list.innerHTML = state.sections
    .map((entry, index) => {
      const section = sectionById(entry.sectionId);
      const label = section?.label ?? entry.sectionId;
      const group = section?.group ?? '';
      const last = index === state.sections.length - 1;

      return `<li class="tb__row" data-uid="${esc(entry.uid)}"
        ${state.readOnly ? '' : 'draggable="true"'} data-testid="tb--row">
        <span class="tb__handle" aria-hidden="true">${icon('menu')}</span>
        <span class="tb__row-index">${index + 1}</span>
        <span class="tb__row-body">
          <span class="tb__row-label">${esc(label)}</span>
          ${group ? `<span class="tb__row-group">${esc(group)}</span>` : ''}
        </span>
        ${
          state.readOnly
            ? ''
            : `<span class="tb__row-actions">
                 <button type="button" class="tb__row-btn" data-move="up" ${index === 0 ? 'disabled' : ''}
                   aria-label="Move ${esc(label)} up">${icon('caret-up')}</button>
                 <button type="button" class="tb__row-btn" data-move="down" ${last ? 'disabled' : ''}
                   aria-label="Move ${esc(label)} down">${icon('caret-down')}</button>
                 <button type="button" class="tb__row-btn tb__row-btn--danger" data-remove
                   aria-label="Remove ${esc(label)}" data-testid="tb--remove">${icon('close')}</button>
               </span>`
        }
      </li>`;
    })
    .join('');

  const count = state.sections.length;
  el('tbCount').textContent = count ? `${count} section${count === 1 ? '' : 's'}` : 'Empty';
  el('tbDrop').hidden = state.readOnly && count > 0;
}

function paint() {
  paintPalette();
  paintCanvas();
}

/* ===================== Mutating the order ===================== */

function addSection(sectionId, at = state.sections.length) {
  if (state.readOnly) return;
  if (sectionById(sectionId)?.once && usedOnce().has(sectionId)) return;

  nextUid += 1;
  state.sections.splice(at, 0, { uid: `s${nextUid}`, sectionId });
  markDirty();
  paint();
}

function removeAt(uid) {
  const at = state.sections.findIndex((entry) => entry.uid === uid);
  if (at < 0) return;
  state.sections.splice(at, 1);
  markDirty();
  paint();
}

function move(uid, delta) {
  const at = state.sections.findIndex((entry) => entry.uid === uid);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= state.sections.length) return;
  const [entry] = state.sections.splice(at, 1);
  state.sections.splice(to, 0, entry);
  markDirty();
  paint();

  // Keep the moved row under the pointer AND under focus — a reorder that
  // sends focus to the body means the next arrow press does nothing.
  el('tbList')
    .querySelector(`[data-uid="${entry.uid}"] [data-move="${delta < 0 ? 'up' : 'down'}"]`)
    ?.focus();
}

function markDirty() {
  el('tbSaved').textContent = '';
}

/* ===================== Drag and drop =====================
   Two sources, one target. A drag from the palette carries a section id and
   inserts a new row; a drag within the canvas carries a uid and moves the row
   that is already there. The dataTransfer type says which. */

function indexFromPoint(clientY) {
  const rows = [...el('tbList').querySelectorAll('.tb__row')];
  for (let i = 0; i < rows.length; i += 1) {
    const box = rows[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return i;
  }
  return rows.length;
}

function clearDropMarks() {
  el('tbList').querySelectorAll('.tb__row--over').forEach((row) => row.classList.remove('tb__row--over'));
  el('tbDrop').classList.remove('tb__drop--over');
}

function wireDragAndDrop() {
  el('tbPalette').addEventListener('dragstart', (event) => {
    const chip = event.target.closest('[data-section]');
    if (!chip || chip.disabled) return;
    state.dragging = { kind: 'new', sectionId: chip.dataset.section };
    event.dataTransfer.effectAllowed = 'copy';
    // Firefox refuses to start a drag without payload on the transfer.
    event.dataTransfer.setData('text/plain', chip.dataset.section);
  });

  el('tbList').addEventListener('dragstart', (event) => {
    const row = event.target.closest('.tb__row');
    if (!row) return;
    state.dragging = { kind: 'move', uid: row.dataset.uid };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.uid);
    row.classList.add('tb__row--dragging');
  });

  el('tbList').addEventListener('dragend', () => {
    el('tbList').querySelectorAll('.tb__row--dragging').forEach((r) => r.classList.remove('tb__row--dragging'));
    clearDropMarks();
    state.dragging = null;
  });

  for (const zone of [el('tbList'), el('tbDrop')]) {
    zone.addEventListener('dragover', (event) => {
      if (!state.dragging || state.readOnly) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = state.dragging.kind === 'move' ? 'move' : 'copy';

      clearDropMarks();
      if (zone === el('tbDrop')) {
        zone.classList.add('tb__drop--over');
        return;
      }
      const rows = [...el('tbList').querySelectorAll('.tb__row')];
      rows[indexFromPoint(event.clientY)]?.classList.add('tb__row--over');
    });

    zone.addEventListener('dragleave', clearDropMarks);

    zone.addEventListener('drop', (event) => {
      if (!state.dragging || state.readOnly) return;
      event.preventDefault();
      clearDropMarks();

      const at = zone === el('tbDrop') ? state.sections.length : indexFromPoint(event.clientY);

      if (state.dragging.kind === 'new') {
        addSection(state.dragging.sectionId, at);
      } else {
        const from = state.sections.findIndex((entry) => entry.uid === state.dragging.uid);
        if (from > -1) {
          const [entry] = state.sections.splice(from, 1);
          // Removing the row first shifts every index after it back by one.
          state.sections.splice(at > from ? at - 1 : at, 0, entry);
          markDirty();
          paint();
        }
      }
      state.dragging = null;
    });
  }
}

/* ===================== Preview ===================== */

function openPreview() {
  el('previewLead').textContent = state.sections.length
    ? `${state.title.trim() || 'Untitled template'} — ${state.sections.length} section${
        state.sections.length === 1 ? '' : 's'
      }, in this order.`
    : 'Nothing to preview yet. Add a section from the left.';

  el('previewBody').innerHTML = state.sections
    .map((entry) => {
      const section = sectionById(entry.sectionId);
      const label = section?.label ?? entry.sectionId;
      // Layout sections are not headings — they are the space between them,
      // so the preview draws them as what they do rather than as a title.
      if (entry.sectionId === 'layout-space') return `<div class="tb__preview-space"></div>`;
      if (entry.sectionId === 'layout-rule') return `<hr class="tb__preview-rule" />`;
      if (section?.group === 'Layout') {
        return `<p class="tb__preview-layout">${esc(label)}</p>`;
      }
      return `<div class="tb__preview-section">
        <h3>${esc(label)}</h3>
        <span class="tb__preview-blank"></span>
      </div>`;
    })
    .join('');

  el('previewModal').open(el('tbPreview'));
}

/* ===================== Save ===================== */

function save() {
  const titleField = el('tbTitle');
  const title = (titleField.value || '').trim();

  if (!title) {
    titleField.setAttribute('error', 'Give the template a name.');
    titleField.querySelector('input')?.focus();
    return;
  }
  titleField.removeAttribute('error');
  state.title = title;

  // Session-only, like every other list in this prototype. Writing back into
  // the imported array is enough for the list screen to show it on return.
  if (existing) {
    existing.name = title;
    existing.sections = state.sections.map((entry) => entry.sectionId);
  } else {
    TEMPLATES.push({
      id: `TPL-${900 + TEMPLATES.length}`,
      kind: state.kind,
      name: title,
      type: state.type,
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: 'Dr. A. Mensah',
      sections: state.sections.map((entry) => entry.sectionId),
    });
  }

  el('tbSaved').textContent = 'Saved';
}

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-input').then(() => {
  el('tbKind').textContent = kindById(state.kind).label;
  el('tbTitle').setAttribute('value', state.title);

  if (state.readOnly) {
    el('tbTitle').querySelector('input').disabled = true;
    el('tbSave').hidden = true;
    document.body.classList.add('tb--read-only');
  }

  el('tbTitle').addEventListener('ui-input', (event) => {
    state.title = event.detail.value;
    markDirty();
  });

  el('tbSearch').addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    paintPalette();
  });

  // Click to append — the fast path, and the only one that works by keyboard.
  el('tbPalette').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-section]');
    if (chip && !chip.disabled) addSection(chip.dataset.section);
  });

  el('tbList').addEventListener('click', (event) => {
    const row = event.target.closest('.tb__row');
    if (!row) return;
    if (event.target.closest('[data-remove]')) return removeAt(row.dataset.uid);
    const dir = event.target.closest('[data-move]')?.dataset.move;
    if (dir) move(row.dataset.uid, dir === 'up' ? -1 : 1);
  });

  el('tbPreview').addEventListener('ui-click', openPreview);
  el('tbSave').addEventListener('ui-click', save);

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) el('previewModal').close();
  });

  wireDragAndDrop();
  paint();
});

export { SECTION_INDEX };
