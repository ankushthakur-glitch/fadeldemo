/**
 * The findings diagram — a picture of the organ that records what was seen
 * where.
 *
 * WHY A PICTURE RATHER THAN A BOX TO TYPE IN
 * The Procedure report asked for findings as free text, one per line. It
 * worked in the sense that a sentence came out of it, but it asked the
 * endoscopist to translate a place into a word while their hands were busy,
 * it let the place be left out altogether, and it produced prose that no two
 * operators wrote the same way. A diagram asks for the place by pointing at
 * it, and the form that opens is specific to the KIND of thing found there —
 * so the record comes out structured, and the same finding reads the same
 * whoever charted it.
 *
 * WHAT THIS MODULE IS AND IS NOT
 * It is a renderer. It knows how to draw a field given a node from a schema,
 * how to read the answers back out, and how to run the drawer. It knows
 * nothing about colonoscopy: the segments, the finding types and every option
 * list are handed in, so the same code can drive an upper-GI diagram the day
 * one is drawn. See data/colon-findings.js for the schema it consumes and the
 * field language it speaks.
 *
 * THE STORE
 * One plain object, owned by the caller so it saves and signs with the rest of
 * the document — on the Procedure report it hangs off that document's own
 * answers, see diagramStoreFor in js/screens/encounter.js:
 *
 *   { findings: [{ id, segment, type, values }], showRegions: boolean }
 *
 * `values` is a flat map keyed by the field ids in the schema. A range field
 * stores { from, to }; a checks field stores an array of the ticked labels;
 * everything else stores a string.
 */

import { iconMarkup } from './icons.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

let nextFindingId = 1;

/* --- Walking the schema ------------------------------------------------------
   `row` and `panel` nodes carry other nodes, so anything that has to touch
   every field — filling in selects after render, reading answers back — goes
   through here rather than repeating the same two special cases. --- */
function walkFields(fields, visit) {
  fields.forEach((node) => {
    if (node.kind === 'row') return node.items.forEach((item) => walkFields([item], visit));
    if (node.kind === 'panel') {
      return node.groups.forEach((group) => walkFields(group.fields, visit));
    }
    visit(node);
  });
}

/** The type record for a saved finding, or undefined if the schema changed. */
function typeOf(types, id) {
  return types.find((t) => t.id === id);
}

/* --- The one-line summary ----------------------------------------------------
   What the left-hand column shows for a saved finding. It is assembled from
   whichever answers were actually given rather than from a per-type template,
   because a half-filled finding is the normal case mid-procedure and a
   template full of gaps reads worse than a short line. --- */
export function findingSummary(finding, types) {
  const type = typeOf(types, finding.type);
  if (!type) return finding.type;

  const parts = [];
  walkFields(type.fields, (node) => {
    /* The notes are shown in full under the summary, so repeating them here
       would be the same sentence twice on two lines. `summary: false` is for
       answers that only mean something beside another answer. */
    if (!node.id || node.id === 'notes' || node.summary === false) return;
    const value = finding.values[node.id];
    if (value === undefined || value === null || value === '') return;

    if (node.kind === 'range') {
      const { from, to } = value;
      if (!from && !to) return;
      parts.push(from && to ? `${from}–${to} mm` : `${from || to} mm`);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length) parts.push(value.join(', '));
      return;
    }
    if (node.kind === 'check') {
      if (value) parts.push(node.label);
      return;
    }
    if (node.kind === 'grid') {
      /* A score is only worth showing as a total; the four axes that make it
         up are in the form for whoever opens it. */
      const scored = node.rows.map((row) => Number(value[row.id])).filter((n) => !Number.isNaN(n));
      if (scored.length) parts.push(`SES-CD ${scored.reduce((a, b) => a + b, 0)}`);
      return;
    }
    /* A bare number says nothing on this line — "3" could be polyps,
       millimetres or millilitres — so a number field names its unit. Long
       select labels carry their explanation after an em dash ("0 — Normal or
       inactive disease"); the summary wants the code, not the sentence. */
    const text = String(value).split(' — ')[0];
    parts.push(node.unit ? `${text} ${node.unit}` : text);
  });

  return parts.length ? parts.join(' · ') : '';
}

/* ===================== Rendering a field ===================== */

function labelHtml(node) {
  if (!node.label) return '';
  const note = node.note ? ` <span class="segf__note">${esc(node.note)}</span>` : '';
  return `<p class="segf__label">${esc(node.label)}${note}</p>`;
}

function checksHtml(node, values, prefix) {
  const chosen = new Set(values[node.id] ?? []);
  const alert = new Set(node.alert ?? []);
  return `${labelHtml(node)}
    <div class="segf__checks${node.boxed ? ' segf__checks--boxed' : ''}">
      ${node.options
        .map(
          (option) => `<ui-checkbox data-check="${esc(prefix + node.id)}"
            data-value="${esc(option)}"${chosen.has(option) ? ' checked' : ''}
            class="${alert.has(option) ? 'segf__check--alert' : ''}">${esc(option)}</ui-checkbox>`
        )
        .join('')}
    </div>`;
}

function segmentedHtml(node, values, prefix) {
  const current = values[node.id] ?? '';
  return `${labelHtml(node)}
    <div class="segf__seg" role="group"${node.label ? ` aria-label="${esc(node.label)}"` : ''}>
      ${node.options
        .map(
          (option) => `<button type="button"
            class="segf__seg-btn${current === option ? ' segf__seg-btn--on' : ''}"
            data-seg="${esc(prefix + node.id)}" data-value="${esc(option)}"
            aria-pressed="${current === option}">${esc(option)}</button>`
        )
        .join('')}
    </div>`;
}

/* The scoring table. Each axis is a row of four buttons showing the score
   above the wording it stands for, because the number is what gets summed and
   the wording is what gets matched against the bowel in front of you. */
function gridHtml(node, values, prefix) {
  const scores = values[node.id] ?? {};
  return `${labelHtml(node)}
    <div class="segf__grid">
      ${node.rows
        .map(
          (row) => `<div class="segf__grid-row">
            <p class="segf__grid-label">${esc(row.label)}</p>
            <div class="segf__grid-opts">
              ${row.options
                .map(
                  (option) => `<button type="button"
                    class="segf__score${scores[row.id] === option.value ? ' segf__score--on' : ''}"
                    data-score="${esc(prefix + node.id)}" data-row="${esc(row.id)}"
                    data-value="${esc(option.value)}"
                    aria-pressed="${scores[row.id] === option.value}">
                    <span class="segf__score-value">${esc(option.value)}</span>
                    <span class="segf__score-caption">${esc(option.caption)}</span>
                  </button>`
                )
                .join('')}
            </div>
          </div>`
        )
        .join('')}
    </div>
    ${node.hint ? `<p class="segf__hint">${esc(node.hint)}</p>` : ''}`;
}

function panelHtml(node, values, prefix) {
  return `<section class="segf__panel">
    <p class="segf__panel-eyebrow">${iconMarkup(node.icon ?? 'stethoscope')}${esc(node.label)}</p>
    ${node.groups
      .map(
        (group) => `<div class="segf__group">
          ${
            group.label
              ? `<p class="segf__group-head${group.tone ? ` segf__group-head--${group.tone}` : ''}">
                   ${group.icon ? iconMarkup(group.icon) : ''}${esc(group.label)}
                 </p>`
              : ''
          }
          ${group.fields.map((field) => fieldHtml(field, values, prefix)).join('')}
        </div>`
      )
      .join('')}
  </section>`;
}

/**
 * One node of a schema, as markup.
 *
 * `prefix` keeps two forms on the page from sharing element ids — the drawer
 * shows saved findings above the add form, and both are built from the same
 * schema.
 */
export function fieldHtml(node, values, prefix) {
  const id = node.id ? prefix + node.id : '';

  switch (node.kind) {
    case 'row':
      return `<div class="segf__row segf__row--${node.items.length}">
        ${node.items.map((item) => `<div>${fieldHtml(item, values, prefix)}</div>`).join('')}
      </div>`;

    case 'panel':
      return panelHtml(node, values, prefix);

    case 'checks':
      return checksHtml(node, values, prefix);

    case 'segmented':
      return segmentedHtml(node, values, prefix);

    case 'grid':
      return gridHtml(node, values, prefix);

    case 'check':
      return `<div class="segf__checks${node.boxed ? ' segf__checks--boxed' : ''}">
        <ui-checkbox data-single-check="${esc(id)}"${values[node.id] ? ' checked' : ''}
          >${esc(node.label)}</ui-checkbox>
      </div>`;

    case 'range': {
      const value = values[node.id] ?? {};
      return `${labelHtml(node)}
        <div class="segf__range">
          <ui-input id="${esc(id)}-from" label="${esc(node.label)} from" label-hidden
            type="number" placeholder="${esc(node.fromPlaceholder ?? 'From')}"
            value="${esc(value.from ?? '')}"></ui-input>
          <span class="segf__range-to">to</span>
          <ui-input id="${esc(id)}-to" label="${esc(node.label)} to" label-hidden
            type="number" placeholder="${esc(node.toPlaceholder ?? 'To')}"
            value="${esc(value.to ?? '')}"></ui-input>
        </div>`;
    }

    /* A field whose label carries a rider — "Total vol (mL) auto", "Rutgeerts
       Score (post-surgical Crohn's recurrence)". The ui- components escape
       their label, and rightly: a label is text, not markup. So a riderless
       field keeps the component's own label and a ridered one draws the label
       here and hides the component's, which keeps the words in the accessible
       name either way. */
    case 'auto':
      return `${labelHtml(node)}
        <ui-input id="${esc(id)}" type="number" readonly label="${esc(node.label)}" label-hidden
          placeholder="${esc(node.placeholder ?? 'auto')}"
          value="${esc(values[node.id] ?? '')}"></ui-input>`;

    case 'select':
      return `${node.note ? labelHtml(node) : ''}
        <ui-select id="${esc(id)}" label="${esc(node.label)}"${node.note ? ' label-hidden' : ''}
          placeholder="${esc(node.placeholder ?? 'Select...')}"
          ${node.hint ? `hint="${esc(node.hint)}"` : ''}></ui-select>`;

    case 'textarea':
      return `<ui-textarea id="${esc(id)}" label="${esc(node.label)}"
        rows="${node.rows ?? 3}" placeholder="${esc(node.placeholder ?? '')}"
        >${esc(values[node.id] ?? '')}</ui-textarea>`;

    case 'number':
    case 'text':
    default:
      return `<ui-input id="${esc(id)}" label="${esc(node.label)}"
        type="${node.kind === 'number' ? 'number' : 'text'}"
        placeholder="${esc(node.placeholder ?? '')}"
        value="${esc(values[node.id] ?? '')}"></ui-input>`;
  }
}

/**
 * Fill in what markup alone cannot carry.
 *
 * <ui-select> splits its `options` attribute on commas, and half these lists
 * have commas inside a label — "Single, passable" would silently become two
 * choices. So every select is populated through setOptions() after it is in
 * the DOM, and its current value written back on the same pass.
 */
export function hydrateFields(root, fields, values, prefix) {
  walkFields(fields, (node) => {
    if (node.kind !== 'select') return;
    const select = root.querySelector(`#${CSS.escape(prefix + node.id)}`);
    if (!select) return;
    select.setOptions(node.options ?? []);
    const value = values[node.id];
    if (value) select.setAttribute('value', value);
  });
}

/** Read every answer in a rendered form back into a plain object. */
export function readFields(root, fields, prefix) {
  const values = {};

  walkFields(fields, (node) => {
    if (!node.id) return;
    const id = prefix + node.id;

    if (node.kind === 'checks') {
      values[node.id] = [
        ...root.querySelectorAll(`[data-check="${CSS.escape(id)}"]`),
      ]
        .filter((box) => box.checked)
        .map((box) => box.dataset.value);
      return;
    }
    if (node.kind === 'check') {
      values[node.id] = Boolean(root.querySelector(`[data-single-check="${CSS.escape(id)}"]`)?.checked);
      return;
    }
    if (node.kind === 'segmented') {
      values[node.id] =
        root.querySelector(`[data-seg="${CSS.escape(id)}"].segf__seg-btn--on`)?.dataset.value ?? '';
      return;
    }
    if (node.kind === 'grid') {
      const scores = {};
      root
        .querySelectorAll(`[data-score="${CSS.escape(id)}"].segf__score--on`)
        .forEach((button) => {
          scores[button.dataset.row] = button.dataset.value;
        });
      values[node.id] = scores;
      return;
    }
    if (node.kind === 'range') {
      values[node.id] = {
        from: root.querySelector(`#${CSS.escape(id)}-from`)?.value ?? '',
        to: root.querySelector(`#${CSS.escape(id)}-to`)?.value ?? '',
      };
      return;
    }
    values[node.id] = root.querySelector(`#${CSS.escape(id)}`)?.value ?? '';
  });

  return values;
}

/* ===================== The section on the report ===================== */

/**
 * The Findings block: the recorded list on the left, the diagram on the right.
 *
 * `config` is { segments, types, image, alt }. The image is a plain <img> with
 * percentage-positioned buttons over it rather than an inline SVG, because the
 * illustration is a rendered anatomical drawing that no hand-authored path is
 * going to match, and because a box over a picture is something anyone can
 * nudge into place with the regions shown.
 */
export function findingsHtml(store, config) {
  const { segments, types } = config;
  const byId = new Map(segments.map((s) => [s.id, s]));
  const counts = new Map();
  store.findings.forEach((f) => counts.set(f.segment, (counts.get(f.segment) ?? 0) + 1));

  /* Both columns open with a head of the same height — a title on the left, the
     regions toggle on the right — so the first recorded row starts level with
     the top of the picture rather than floating half a line above it. The left
     head is also the only thing naming that column; the right one carries no
     caption, because what the section is for is said once by whatever is
     hosting it (the document spec's `note` on the Procedure report) and a
     module that also announced itself would say the same sentence twice. */
  return `<div class="segf">
    <div class="segf__col">
      <div class="segf__head">
        <p class="segf__head-title">Recorded findings</p>
        ${
          store.findings.length
            ? `<span class="segf__count">${store.findings.length}</span>`
            : ''
        }
      </div>

      <div class="segf__list" id="segfList">
        ${
          store.findings.length
            ? store.findings
                .map((finding) => {
                  const summary = findingSummary(finding, types);
                  return `<article class="segf__item" data-finding="${esc(finding.id)}">
                    <span class="segf__item-tag">${esc(byId.get(finding.segment)?.label ?? finding.segment)}</span>
                    <div class="segf__item-body">
                      <p class="segf__item-type">${esc(typeOf(types, finding.type)?.label ?? finding.type)}</p>
                      ${summary ? `<p class="segf__item-summary">${esc(summary)}</p>` : ''}
                      ${
                        finding.values.notes
                          ? `<p class="segf__item-notes">${esc(finding.values.notes)}</p>`
                          : ''
                      }
                    </div>
                    <div class="segf__item-actions">
                      <button type="button" class="segf__icon-btn" data-open-segment="${esc(finding.segment)}"
                        aria-label="Edit findings in the ${esc(byId.get(finding.segment)?.label ?? finding.segment)}">
                        ${iconMarkup('pencil')}
                      </button>
                      <button type="button" class="segf__icon-btn" data-drop-finding="${esc(finding.id)}"
                        aria-label="Remove this finding">${iconMarkup('trash')}</button>
                    </div>
                  </article>`;
                })
                .join('')
            : '<p class="enc__empty segf__empty">No findings recorded yet</p>'
        }
      </div>
    </div>

    <div class="segf__col segf__diagram">
      <div class="segf__head segf__head--end">
        <button type="button" class="segf__regions-toggle${store.showRegions ? ' segf__regions-toggle--on' : ''}"
          id="segfShowRegions" aria-pressed="${Boolean(store.showRegions)}">
          ${iconMarkup(store.showRegions ? 'eye-off' : 'eye')}Show regions
        </button>
      </div>

      <div class="segf__canvas${store.showRegions ? ' segf__canvas--regions' : ''}" id="segfCanvas">
        <img class="segf__image" src="${esc(config.image)}" alt="${esc(config.alt)}" />
        ${segments
          .map((segment) => {
            const count = counts.get(segment.id) ?? 0;
            const { left, top, width, height } = segment.hotspot;
            return `<button type="button"
              class="segf__hotspot${count ? ' segf__hotspot--on' : ''}"
              data-open-segment="${esc(segment.id)}"
              style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"
              title="${esc(segment.label)}"
              aria-label="${esc(segment.label)}${count ? ` — ${count} finding${count === 1 ? '' : 's'}` : ''}">
              <span class="segf__hotspot-name">${esc(segment.label)}</span>
              ${count ? `<span class="segf__pin">${count}</span>` : ''}
            </button>`;
          })
          .join('')}
      </div>

      <p class="segf__legend">
        <span><span class="segf__swatch segf__swatch--on"></span> Findings recorded</span>
        <span><span class="segf__swatch"></span> Hover / click to add</span>
      </p>
    </div>
  </div>`;
}

/* ===================== The drawer ===================== */

/** The add form for one finding type, or nothing until a type is chosen. */
function formHtml(store, config) {
  const draft = config.types.find((t) => t.id === store.draftType);
  return draft ? draft.fields.map((node) => fieldHtml(node, store.draftValues, 'segf-')).join('') : '';
}

/**
 * What the drawer shows: the segment's saved findings, then the add form.
 *
 * A segment with nothing on it yet shows the add form alone — no "nothing
 * here" line and no rule above it, because both only say what the empty space
 * already says, and the drawer opens most often on a segment that is empty.
 * The form carries no heading of its own either: the drawer is titled with the
 * segment, and the button at the foot says what pressing it does, so a third
 * "Add Finding" between them was only repeating one of the two.
 */
function drawerBodyHtml(store, config, segmentId) {
  const { types } = config;
  const rows = store.findings.filter((f) => f.segment === segmentId);

  return `${
    rows.length
      ? `<div class="segf__drawer-list">
          ${rows
            .map((finding) => {
              const summary = findingSummary(finding, types);
              return `<article class="segf__saved" data-finding="${esc(finding.id)}">
                <div>
                  <p class="segf__item-type">${esc(typeOf(types, finding.type)?.label ?? finding.type)}</p>
                  ${summary ? `<p class="segf__item-summary">${esc(summary)}</p>` : ''}
                  ${
                    finding.values.notes
                      ? `<p class="segf__item-notes">${esc(finding.values.notes)}</p>`
                      : ''
                  }
                </div>
                <button type="button" class="segf__icon-btn" data-drop-finding="${esc(finding.id)}"
                  aria-label="Remove this finding">${iconMarkup('trash')}</button>
              </article>`;
            })
            .join('')}
        </div>`
      : ''
  }

  ${rows.length ? '<hr class="segf__rule" />' : ''}

  <ui-select id="segfType" label="Finding type" placeholder="Select type..."></ui-select>

  <div id="segfForm" class="segf__form">${formHtml(store, config)}</div>

  <ui-button variant="primary" icon="plus" full id="segfAdd"
    ${store.draftType ? '' : 'disabled'}>Add Finding</ui-button>`;
}

/**
 * Mount the diagram onto a painted report.
 *
 * `repaint` is the screen's own repaint of the Findings section, called
 * whenever the list of findings changes; `commit` marks the document dirty.
 * Both are optional, so the gallery can mount the thing with neither.
 */
export function wireFindings({ root, drawer, store, config, repaint, commit }) {
  store.findings ??= [];
  store.draftValues ??= {};

  const notify = () => {
    repaint?.();
    commit?.();
  };

  root.querySelectorAll('[data-open-segment]').forEach((button) =>
    button.addEventListener('click', () => openDrawer(button.dataset.openSegment))
  );

  root.querySelectorAll('[data-drop-finding]').forEach((button) =>
    button.addEventListener('click', () => {
      store.findings = store.findings.filter((f) => f.id !== button.dataset.dropFinding);
      notify();
    })
  );

  root.querySelector('#segfShowRegions')?.addEventListener('click', () => {
    store.showRegions = !store.showRegions;
    repaint?.();
  });

  /* --- The drawer ---------------------------------------------------------
     One <ui-modal variant="drawer"> lives in the page and is re-filled per
     segment, rather than one per segment built up front: eight copies of an
     eleven-type form is a great deal of DOM for a window that shows one of
     them at a time. --- */
  function openDrawer(segmentId) {
    const segment = config.segments.find((s) => s.id === segmentId);
    if (!segment || !drawer) return;

    store.openSegment = segmentId;
    store.draftType = '';
    store.draftValues = {};

    drawer.setAttribute('heading', `${segment.label} — Findings`);
    paintDrawer();
    drawer.open();
  }

  function drawerBody() {
    return drawer.querySelector('[data-segf-body]');
  }

  /** The whole panel — used on open, and whenever the saved list changes. */
  function paintDrawer() {
    const body = drawerBody();
    if (!body) return;

    body.innerHTML = drawerBodyHtml(store, config, store.openSegment);

    const typeSelect = body.querySelector('#segfType');
    typeSelect.setOptions(config.types.map((t) => ({ value: t.id, label: t.label })));
    if (store.draftType) typeSelect.setAttribute('value', store.draftType);

    typeSelect.addEventListener('ui-change', (event) => {
      /* Switching type throws the half-filled answers away on purpose: the
         fields do not correspond, and silently carrying "Large" from an
         ulcer's Size across to a hemorrhoid's is worse than starting again.

         Only the form below is redrawn, not the whole panel — repainting the
         select from inside its own change event is how a native <select>
         loses the click that opened it. */
      store.draftType = event.detail?.value ?? '';
      store.draftValues = {};
      paintForm();
    });

    body.querySelectorAll('[data-drop-finding]').forEach((button) =>
      button.addEventListener('click', () => {
        /* Removing a saved finding repaints the whole panel, which rebuilds the
           add form underneath it. Whatever was half-typed there has nothing to
           do with the row being deleted, so it is read out first and put back
           on the other side. */
        keepDraft();
        store.findings = store.findings.filter((f) => f.id !== button.dataset.dropFinding);
        paintDrawer();
        notify();
      })
    );

    body.querySelector('#segfAdd').addEventListener('ui-click', () => {
      const draft = config.types.find((t) => t.id === store.draftType);
      if (!draft) return;

      store.findings.push({
        id: `f${nextFindingId++}`,
        segment: store.openSegment,
        type: draft.id,
        values: readFields(body, draft.fields, 'segf-'),
      });

      /* Cleared rather than closed. A segment routinely carries more than one
         finding — three polyps in the sigmoid is a Tuesday — and closing the
         window after each would mean re-opening it for the next. */
      store.draftType = '';
      store.draftValues = {};
      paintDrawer();
      notify();
    });

    paintForm({ keepSelect: true });
  }

  /**
   * Take a copy of the in-progress form, so a repaint can put it back.
   *
   * `draftValues` is what fieldHtml renders from, so writing to it is all that
   * is needed — the next paintForm reads it. Choosing a type deliberately
   * clears it: see the note on the type picker above.
   */
  function keepDraft() {
    const draft = config.types.find((t) => t.id === store.draftType);
    const form = drawerBody()?.querySelector('#segfForm');
    if (draft && form) store.draftValues = readFields(form, draft.fields, 'segf-');
  }

  /** Just the fields under the type picker, and the Add button's state. */
  function paintForm({ keepSelect = false } = {}) {
    const body = drawerBody();
    const form = body?.querySelector('#segfForm');
    if (!form) return;

    form.innerHTML = formHtml(store, config);

    const draft = config.types.find((t) => t.id === store.draftType);
    if (draft) {
      hydrateFields(form, draft.fields, store.draftValues, 'segf-');
      wireForm(form, draft);
    }

    const add = body.querySelector('#segfAdd');
    if (draft) add.removeAttribute('disabled');
    else add.setAttribute('disabled', '');

    if (!keepSelect && draft) {
      /* Bring the first field of the newly chosen type into view — on a long
         form like Mucosal inflammation the type picker is otherwise the only
         thing the reader can see change. */
      form.querySelector('ui-input, ui-select, ui-textarea, button')?.focus?.();
    }
  }

  function wireForm(form, draft) {
    /* Segmented buttons and score buttons are both "one of these, or none of
       them" — a second press on the chosen one clears it, which is the only
       way back to unanswered once something has been pressed. */
    const exclusive = (button, selector, onClass) => {
      const on = button.classList.contains(onClass);
      form.querySelectorAll(selector).forEach((sibling) => {
        sibling.classList.remove(onClass);
        sibling.setAttribute('aria-pressed', 'false');
      });
      if (!on) {
        button.classList.add(onClass);
        button.setAttribute('aria-pressed', 'true');
      }
    };

    form.querySelectorAll('[data-seg]').forEach((button) =>
      button.addEventListener('click', () =>
        exclusive(button, `[data-seg="${CSS.escape(button.dataset.seg)}"]`, 'segf__seg-btn--on')
      )
    );

    form.querySelectorAll('[data-score]').forEach((button) =>
      button.addEventListener('click', () =>
        exclusive(
          button,
          `[data-score="${CSS.escape(button.dataset.score)}"][data-row="${CSS.escape(button.dataset.row)}"]`,
          'segf__score--on'
        )
      )
    );

    /* The computed total. Bound per auto field, so a form carrying two of
       them would still work. */
    walkFields(draft.fields, (node) => {
      if (node.kind !== 'auto' || !node.product) return;

      const target = form.querySelector(`#${CSS.escape(`segf-${node.id}`)}`);
      const sources = node.product.map((id) => form.querySelector(`#${CSS.escape(`segf-${id}`)}`));
      if (!target || sources.some((source) => !source)) return;

      const recompute = () => {
        const numbers = sources.map((source) => Number(source.value));
        const usable = numbers.every((n) => Number.isFinite(n) && n > 0);
        target.setAttribute('value', usable ? String(round2(numbers[0] * numbers[1])) : '');
      };

      sources.forEach((source) => {
        source.addEventListener('ui-input', recompute);
        source.addEventListener('ui-change', recompute);
      });
      recompute();
    });
  }
}

const round2 = (n) => Math.round(n * 100) / 100;
