/**
 * PRACTICE SETTINGS → PRINT CONFIGURATION
 *
 * Letterheads for everything the practice prints: a table of the
 * configurations on file, a full-page preview behind the Preview button, and
 * an editor with a live preview beside the form.
 *
 * A TABLE, NOT A WALL OF CARDS
 * This list used to be one card per configuration, each roughly a third of a
 * screen tall and carrying a rendered thumbnail of its own letterhead. On a
 * practice with a header per document type, per site and per retired version
 * that is a page you scroll for half a minute to answer "which one is the
 * default" — a question a table answers in one glance, because the facts a
 * person is actually scanning for (which is default, when it last changed, how
 * many versions it has been through) are short and line up in columns.
 *
 * The thumbnails went with the cards, and that is the point of the dialog: a
 * postage-stamp rendering was never proof that a header prints correctly, and
 * it was competing with the real preview one button away. Preview now shows
 * the letterhead on every sample document, full size, which is the only
 * rendering worth judging it on.
 *
 * WHY THE PREVIEW IS THE POINT
 * A letterhead is judged entirely on how it looks on paper, so the editor is
 * split: controls on the left, an actual rendered header on the right that
 * redraws on every keystroke. The alternative — fill in a form, save, print,
 * discover the logo is too big — is how practices end up with six nearly
 * identical configurations and no idea which one is current.
 *
 * ONE DEFAULT, ENFORCED IN ONE PLACE
 * setDefault() clears the flag everywhere before setting it, so "only one can
 * be default" is a property of the code rather than a rule the UI hopes the
 * user follows.
 *
 * THE RICH TEXT EDITOR uses document.execCommand. It is formally deprecated,
 * but it is the only way to get bold/italic/underline on a contenteditable
 * with no dependencies, and every current browser still implements it. The
 * alternative would be hand-writing a selection-and-range editor, which is a
 * library, not a prototype.
 */
import {
  PRINT_CONFIGS,
  PRACTICE_FIELDS,
  PRACTICE_FIELD_INDEX,
  LAYOUT_MODES,
  ALIGNMENTS,
  FOOTER_OPTIONS,
  PAPER_SIZES,
  ORIENTATIONS,
  MARGIN_PRESETS,
  PREVIEW_DOCUMENTS,
  LOGO_FORMATS,
  LOGO_MAX_BYTES,
  MAX_HEADER_LINES,
  blankConfig,
} from '../../data/print-config.js';
import { openRowMenu } from '../lib/row-menu.js';
import { createPager } from '../lib/pagination.js';
import { notify } from '../lib/toast.js';

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const icon = (name, className = 'ui-icon') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

const CURRENT_USER = 'Amara Mensah';

/** dd-mm-yyyy → sortable. */
const isoOf = (value) => {
  const [d, m, y] = String(value || '').split('-');
  return y ? `${y}-${m}-${d}` : '';
};

/* ============================================================================
   STATE
   ========================================================================= */

const state = {
  configs: PRINT_CONFIGS.map((c) => ({ ...c, fields: [...c.fields], footer: [...c.footer], versions: [...c.versions] })),
  search: '',
  filter: 'All',
  sort: 'Newest',

  draft: null, // the configuration being edited
  editingId: null, // null while creating
  previewDoc: 'prescription',
  zoom: 100,
};

const els = {};

/* ============================================================================
   DERIVED
   ========================================================================= */

function visibleConfigs() {
  const query = state.search.trim().toLowerCase();
  let list = state.configs.filter(
    (config) =>
      !query ||
      config.name.toLowerCase().includes(query) ||
      config.description.toLowerCase().includes(query)
  );

  if (state.filter === 'Default') list = list.filter((c) => c.isDefault);
  else if (state.filter === 'Custom') list = list.filter((c) => !c.isDefault);
  else if (state.filter === 'Recently updated') {
    list = [...list].sort((a, b) => isoOf(b.updatedOn).localeCompare(isoOf(a.updatedOn))).slice(0, 3);
  }

  const sorters = {
    Newest: (a, b) => isoOf(b.createdOn).localeCompare(isoOf(a.createdOn)),
    Oldest: (a, b) => isoOf(a.createdOn).localeCompare(isoOf(b.createdOn)),
    'A → Z': (a, b) => a.name.localeCompare(b.name),
  };
  return [...list].sort(sorters[state.sort] || sorters.Newest);
}

const configById = (id) => state.configs.find((c) => c.id === id) || null;

/* ============================================================================
   THE HEADER ITSELF — one renderer, used by the card preview, the live
   preview in the editor and the full-page preview dialog. Three renderers
   would be three chances for the card to lie about what prints.
   ========================================================================= */

function headerMarkup(config) {
  const showLogo = config.layout !== 'text-only' && config.logo;
  const showText = config.layout !== 'logo-only';

  const factLines = config.fields
    .map((id) => PRACTICE_FIELD_INDEX[id])
    .filter(Boolean)
    .map((field) => `${field.label}: ${field.value}`);

  return `<div class="prn__header prn__header--${esc(config.layout)}">
    ${
      showLogo
        ? `<div class="prn__header-logo prn__align--${esc(config.logoAlign)}">
             <img src="${esc(config.logo)}" alt="" />
           </div>`
        : ''
    }
    ${
      showText
        ? `<div class="prn__header-text prn__align--${esc(config.textAlign)}">
             ${config.headerHtml || '<div class="prn__muted">No header text yet.</div>'}
             ${factLines.length ? `<div class="prn__header-facts">${factLines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
           </div>`
        : ''
    }
  </div>`;
}

function footerMarkup(config) {
  const lines = config.footer
    .map((id) => FOOTER_OPTIONS.find((f) => f.id === id))
    .filter(Boolean);
  if (!lines.length) return '';
  return `<div class="prn__footer">${lines
    .map((line) => `<div>${esc(line.text)}</div>`)
    .join('')}</div>`;
}

/** A full sample page: letterhead, a document body, footer. */
function pageMarkup(config, documentId) {
  const sample = PREVIEW_DOCUMENTS.find((d) => d.id === documentId) || PREVIEW_DOCUMENTS[0];

  return `<article class="prn__page prn__page--${esc(config.orientation.toLowerCase())}"
      data-testid="prn--page">
      ${headerMarkup(config)}
      <hr class="prn__rule" />
      <h4 class="prn__doc-title">${esc(sample.label)}</h4>
      <dl class="prn__doc-body">
        ${sample.body
          .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
          .join('')}
      </dl>
      ${footerMarkup(config)}
    </article>`;
}

/* ============================================================================
   LIST
   ========================================================================= */

/*
 * TWO BUTTONS AND A MENU, NOT FIVE BUTTONS.
 *
 * Every row used to carry Set as Default, Preview, Edit, Duplicate and Delete
 * as five equally-weighted outline buttons. On a practice with fifty-odd
 * headers on file — one per document type, per site, per retired version —
 * that is more than two hundred and fifty buttons stacked down the page, all
 * the same shape and all shouting at the same volume.
 *
 * The two that a person actually reaches for while scanning a list of headers
 * stay: Preview, because what a letterhead looks like on paper is the whole
 * question, and Edit, because that is where the scan is heading. Set as
 * Default, Duplicate and Delete are deliberate, one-at-a-time decisions — they
 * go behind the "⋮" every other row on this system already uses
 * (js/lib/row-menu.js), which also gets Delete out of one careless click's
 * reach.
 *
 * `data-config` rides on the actions cell rather than on the row, because that
 * is what the click handlers close over — see onListUiClick().
 */
const LAYOUT_LABEL = (id) => LAYOUT_MODES.find((m) => m.id === id)?.label ?? id;
const ALIGN_LABEL = (id) => ALIGNMENTS.find((a) => a.id === id)?.label ?? id;

const PRINT_COLUMNS = [
  {
    key: 'name',
    label: 'Configuration',
    truncate: true,
    render: (config) => `<span class="prn__cell-name">${esc(config.name)}${
      config.isDefault
        ? ' <ui-badge status="success" size="sm" data-testid="prn--default-badge">Default</ui-badge>'
        : ''
    }</span>
      ${config.description ? `<span class="prn__cell-sub">${esc(config.description)}</span>` : ''}`,
  },
  {
    /* What the header is made of and which way it sits — the two answers that
       tell one "MediNova Practice Header" from the next one down without opening
       either of them. */
    key: 'layout',
    label: 'Layout',
    render: (config) => `<span>${esc(LAYOUT_LABEL(config.layout))}</span>
      <span class="prn__cell-sub">${esc(ALIGN_LABEL(config.textAlign))}-aligned</span>`,
  },
  {
    key: 'paper',
    label: 'Paper',
    truncate: true,
    render: (config) => `<span>${esc(config.paper)}</span>
      <span class="prn__cell-sub">${esc(config.orientation)} · ${esc(config.margins)}</span>`,
  },
  {
    /* The date, and who to ask about it. A letterhead that changed last week is
       the one somebody is currently arguing about. */
    key: 'updatedOn',
    label: 'Last updated',
    sortable: true,
    render: (config) => `<span>${esc(config.updatedOn)}</span>
      <span class="prn__cell-sub">${config.versions.length} version${
      config.versions.length === 1 ? '' : 's'
    } · created by ${esc(config.createdBy)}</span>`,
  },
  {
    key: 'actions',
    label: 'Actions',
    actions: true,
    render: (config) => `<span class="prn__row-actions" data-config="${esc(config.id)}">
      <ui-button size="xs" variant="outline" data-act="preview"
        data-testid="prn--preview-${esc(config.id)}">Preview</ui-button>
      <ui-button size="xs" variant="outline" icon="pencil" data-act="edit"
        data-testid="prn--edit-${esc(config.id)}">Edit</ui-button>
      <button type="button" class="ui-row-menu-btn" data-menu="${esc(config.id)}"
        aria-haspopup="menu" aria-expanded="false"
        aria-label="More actions for ${esc(config.name)}"
        data-testid="prn--card-menu">${icon('more-vertical')}</button>
    </span>`,
  },
];

/* The pager, rebuilt whenever paint() replaces the panel — its footer element
   goes with the markup, so the controller cannot outlive it. */
let pager = null;

/**
 * Fill the table from whatever the search, filter and sort currently admit.
 *
 * Paged, because this list is not short: a practice keeps a header per
 * document type, per site and per retired version, and the seeded set already
 * runs past fifty. Fifteen at a time is the house default (js/lib/pagination.js)
 * and it is what every other worklist on this system shows.
 */
function paintTable() {
  const table = document.getElementById('prnTable');
  if (!table) return;

  const configs = visibleConfigs();
  table.setAttribute('empty-text', 'No print configuration matches.');
  table.setAttribute('state', configs.length ? 'ready' : 'empty');
  table.columns = PRINT_COLUMNS;

  const { start, end } = pager?.render(configs.length) ?? { start: 0, end: configs.length };
  table.rows = configs.slice(start, end);
}

function paint() {
  if (!els.panel) return;

  els.panel.innerHTML = `<div class="prn__toolbar">
      <div class="prn__toolbar-controls">
        <ui-input class="prn__search" size="sm" icon="search" label="Search configurations"
          label-hidden placeholder="Search" value="${esc(state.search)}"
          data-testid="prn--search"></ui-input>
        <ui-select size="sm" label="Filter" label-hidden id="prnFilter"
          options="All,Default,Custom,Recently updated" value="${esc(state.filter)}"
          data-testid="prn--filter"></ui-select>
        <ui-select size="sm" label="Sort" label-hidden id="prnSort"
          options="Newest,Oldest,A → Z" value="${esc(state.sort)}"
          data-testid="prn--sort"></ui-select>
        <ui-button size="sm" variant="outline" icon="upload" data-testid="prn--import"
          >Import</ui-button>
        <ui-button size="sm" variant="outline" icon="download" data-testid="prn--export"
          >Export</ui-button>
      </div>
    </div>

    <div class="ui-table-card prn__table-card" data-testid="prn--list">
      <ui-data-table id="prnTable" data-testid="prn--table"></ui-data-table>
      <div id="prnFoot"></div>
    </div>`;

  /* Rebuilt with the markup it lives in. The footer node above is new on every
     paint, so a controller held from the last one would be writing into an
     element that is no longer in the document. */
  pager = createPager(document.getElementById('prnFoot'), {
    noun: 'configurations',
    testidPrefix: 'prn',
    onChange: paintTable,
  });

  paintTable();
}

// "Add New Print Configuration" lives in the page header and is shown and
// hidden by practice-settings.js's syncActions, with every other tab's action.

/* ============================================================================
   FLASH — the shared toast, same as every other tab under Practice Settings.
   ========================================================================= */

function flash(message, tone = 'info') {
  notify(message, tone);
}

/* ============================================================================
   EDITOR
   ========================================================================= */

function checkList(name, options, selected, testid) {
  return `<div class="prn__checks" data-testid="${testid}">
    ${options
      .map(
        (option) => `<label class="prn__check">
          <input type="checkbox" name="${name}" value="${option.id}"
            ${selected.includes(option.id) ? 'checked' : ''}>
          <span>${esc(option.label)}</span>
        </label>`
      )
      .join('')}
  </div>`;
}

function radioRow(name, options, value, testid) {
  return `<div class="prn__radios" role="radiogroup" data-testid="${testid}">
    ${options
      .map(
        (option) => `<label class="prn__radio">
          <input type="radio" name="${name}" value="${option.id}" ${
            option.id === value ? 'checked' : ''
          }>
          <span>${esc(option.label)}</span>
        </label>`
      )
      .join('')}
  </div>`;
}

function editorMarkup() {
  const d = state.draft;

  return `<div class="prn__editor">
    <div class="prn__editor-form">
      <section class="prn__section">
        <h3 class="prn__section-title">Basic information</h3>
        <ui-input label="Header Name" placeholder="e.g. MediNova Practice Header" required
          value="${esc(d.name)}" data-testid="prn--name"></ui-input>
        <ui-input label="Description" placeholder="What this header is for (optional)"
          value="${esc(d.description)}" data-testid="prn--description"></ui-input>
      </section>

      <section class="prn__section">
        <h3 class="prn__section-title">Header content</h3>

        <div class="ui-field">
          <label class="ui-field__label" for="prnEditor">Header text</label>
          <div class="prn__rte">
            <div class="prn__rte-bar" role="toolbar" aria-label="Text formatting">
              <button type="button" data-cmd="bold" aria-label="Bold"><strong>B</strong></button>
              <button type="button" data-cmd="italic" aria-label="Italic"><em>I</em></button>
              <button type="button" data-cmd="underline" aria-label="Underline"><u>U</u></button>
              <span class="prn__rte-divider" aria-hidden="true"></span>
              <button type="button" data-cmd="justifyLeft" aria-label="Align left">${icon('menu')}</button>
              <button type="button" data-cmd="justifyCenter" aria-label="Align centre">${icon('menu')}</button>
              <button type="button" data-cmd="justifyRight" aria-label="Align right">${icon('menu')}</button>
              <span class="prn__rte-divider" aria-hidden="true"></span>
              <span class="ui-select-shell">
                <select class="prn__rte-size" aria-label="Font size" data-testid="prn--font-size">
                  <option value="2">Small</option>
                  <option value="3" selected>Normal</option>
                  <option value="5">Large</option>
                </select>
                ${icon('caret-down')}
              </span>
            </div>
            <div class="prn__rte-area" id="prnEditor" contenteditable="true" role="textbox"
              aria-multiline="true" aria-label="Header text"
              data-placeholder="Type the header as you want it to print"
              data-testid="prn--rte">${d.headerHtml}</div>
          </div>
          <p class="ui-field__hint" data-testid="prn--line-count">
            <span id="prnLineCount">0</span> of ${MAX_HEADER_LINES} lines used.
          </p>
        </div>

        <div class="ui-field">
          <span class="ui-field__label">Layout</span>
          ${radioRow('prnLayout', LAYOUT_MODES, d.layout, 'prn--layout')}
        </div>

        <div class="prn__pair">
          <div class="ui-field">
            <span class="ui-field__label">Logo alignment</span>
            ${radioRow('prnLogoAlign', ALIGNMENTS, d.logoAlign, 'prn--logo-align')}
          </div>
          <div class="ui-field">
            <span class="ui-field__label">Text alignment</span>
            ${radioRow('prnTextAlign', ALIGNMENTS, d.textAlign, 'prn--text-align')}
          </div>
        </div>

        <div class="ui-field">
          <span class="ui-field__label">Practice logo</span>
          <div class="prn__logo-row">
            ${
              d.logo
                ? `<img class="prn__logo-thumb" src="${esc(d.logo)}" alt="Current logo" />`
                : '<span class="prn__logo-thumb prn__logo-thumb--empty">No logo</span>'
            }
            <div class="prn__logo-controls">
              <!-- u-sr-only clips rather than removes, so this stays in the
                   accessibility tree and still needs a name of its own. -->
              <input type="file" id="prnLogoInput" accept="${LOGO_FORMATS}" class="u-sr-only"
                aria-label="Choose a practice logo file" data-testid="prn--logo-input">
              <ui-button size="xs" variant="outline" icon="upload" data-testid="prn--logo-browse"
                >Upload logo</ui-button>
              ${d.logo ? '<ui-button size="xs" variant="tertiary" data-testid="prn--logo-remove">Remove</ui-button>' : ''}
              <p class="prn__error" id="prnLogoError" role="alert" hidden></p>
            </div>
          </div>
        </div>
      </section>

      <section class="prn__section">
        <h3 class="prn__section-title">Practice information</h3>
        ${checkList('prnFields', PRACTICE_FIELDS, d.fields, 'prn--fields')}
      </section>

      <section class="prn__section">
        <h3 class="prn__section-title">Footer</h3>
        ${checkList('prnFooter', FOOTER_OPTIONS, d.footer, 'prn--footer')}
      </section>

      <section class="prn__section">
        <h3 class="prn__section-title">Print settings</h3>
        <div class="prn__grid">
          <ui-select label="Paper size" id="prnPaper" options="${PAPER_SIZES.join(',')}"
            value="${esc(d.paper)}" data-testid="prn--paper"></ui-select>
          <ui-select label="Orientation" id="prnOrientation" options="${ORIENTATIONS.join(',')}"
            value="${esc(d.orientation)}" data-testid="prn--orientation"></ui-select>
          <ui-select label="Margins" id="prnMargins" options="${MARGIN_PRESETS.join(',')}"
            value="${esc(d.margins)}"></ui-select>
          <ui-input label="Header height" value="${esc(d.headerHeight)}" data-testid="prn--header-height"></ui-input>
          <ui-input label="Footer height" value="${esc(d.footerHeight)}"></ui-input>
        </div>
      </section>
    </div>

    <aside class="prn__editor-preview">
      <div class="prn__preview-head">
        <h3 class="prn__section-title">Live preview</h3>
        <ui-select size="sm" label="Sample document" label-hidden id="prnSample"
          options="${PREVIEW_DOCUMENTS.map((d2) => d2.label).join(',')}"
          value="${esc(PREVIEW_DOCUMENTS.find((x) => x.id === state.previewDoc)?.label ?? '')}"
          data-testid="prn--sample"></ui-select>
      </div>
      <div class="prn__preview-stage" id="prnLivePreview">${pageMarkup(state.draft, state.previewDoc)}</div>
    </aside>
  </div>`;
}

function openEditor(config, trigger) {
  state.draft = config
    ? { ...config, fields: [...config.fields], footer: [...config.footer], versions: [...config.versions] }
    : blankConfig();
  state.editingId = config?.id ?? null;

  const modal = document.getElementById('prnEditorModal');
  const body = document.getElementById('prnEditorBody');
  if (!modal || !body) return;

  modal.setAttribute('heading', config ? `Edit ${config.name}` : 'New Print Configuration');
  body.innerHTML = editorMarkup();
  updateLineCount();

  // "Save As New" only makes sense when there is something to branch from.
  const saveAsNew = document.querySelector('[data-testid="prn--save-as-new"]');
  if (saveAsNew) saveAsNew.hidden = !config;

  modal.open(trigger);
}

/** Redraw only the preview — never the form the user is typing into. */
function refreshPreview() {
  const stage = document.getElementById('prnLivePreview');
  if (stage && state.draft) stage.innerHTML = pageMarkup(state.draft, state.previewDoc);
}

/** Lines are block children of the contenteditable; an empty editor is 0. */
function headerLineCount() {
  const area = document.getElementById('prnEditor');
  if (!area) return 0;
  const text = area.innerText.replace(/\n+$/, '');
  return text.trim() === '' ? 0 : text.split('\n').length;
}

function updateLineCount() {
  const label = document.getElementById('prnLineCount');
  if (!label) return;
  const count = headerLineCount();
  label.textContent = String(count);
  label.parentElement?.classList.toggle('prn__over-limit', count > MAX_HEADER_LINES);
}

function readLogo(file) {
  const error = document.getElementById('prnLogoError');
  const fail = (message) => {
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  };

  if (!/\.(png|svg|jpe?g)$/i.test(file.name)) {
    fail('Logo must be a PNG, SVG or JPEG.');
    return;
  }
  if (file.size > LOGO_MAX_BYTES) {
    fail(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 3 MB.`);
    return;
  }
  if (error) error.hidden = true;

  const reader = new FileReader();
  reader.onload = () => {
    state.draft.logo = String(reader.result);
    state.draft.logoName = file.name;
    rerenderEditorKeepingScroll();
  };
  reader.readAsDataURL(file);
}

/** The logo thumbnail lives in the form, so that one change does need a
 *  re-render — the scroll position is put back so the page does not jump. */
function rerenderEditorKeepingScroll() {
  const body = document.getElementById('prnEditorBody');
  const form = body?.querySelector('.prn__editor-form');
  const top = form?.scrollTop ?? 0;
  if (!body) return;
  body.innerHTML = editorMarkup();
  updateLineCount();
  const restored = body.querySelector('.prn__editor-form');
  if (restored) restored.scrollTop = top;
}

/* ============================================================================
   SAVE
   ========================================================================= */

function collectDraft() {
  const body = document.getElementById('prnEditorBody');
  if (!body) return;
  const d = state.draft;

  d.name = (body.querySelector('[data-testid="prn--name"]')?.value || '').trim();
  d.description = (body.querySelector('[data-testid="prn--description"]')?.value || '').trim();
  d.headerHtml = document.getElementById('prnEditor')?.innerHTML.trim() || '';
  d.paper = body.querySelector('#prnPaper')?.value || d.paper;
  d.orientation = body.querySelector('#prnOrientation')?.value || d.orientation;
  d.margins = body.querySelector('#prnMargins')?.value || d.margins;

  const heights = body.querySelectorAll('.prn__grid ui-input');
  if (heights[0]) d.headerHeight = heights[0].value || d.headerHeight;
  if (heights[1]) d.footerHeight = heights[1].value || d.footerHeight;
}

function validateDraft() {
  const body = document.getElementById('prnEditorBody');
  const nameField = body?.querySelector('[data-testid="prn--name"]');
  const d = state.draft;

  if (!d.name) {
    nameField?.setAttribute('error', 'Enter a header name.');
    nameField?.focus();
    return false;
  }
  if (
    state.configs.some(
      (c) => c.id !== state.editingId && c.name.toLowerCase() === d.name.toLowerCase()
    )
  ) {
    nameField?.setAttribute('error', `“${d.name}” already exists.`);
    return false;
  }
  nameField?.removeAttribute('error');

  if (headerLineCount() > MAX_HEADER_LINES) {
    flash(`The header is ${headerLineCount()} lines. The maximum is ${MAX_HEADER_LINES}.`, 'warning');
    return false;
  }
  if (d.layout !== 'text-only' && !d.logo) {
    flash('That layout prints a logo, so upload one or switch to Text Only.', 'warning');
    return false;
  }
  if (d.layout !== 'logo-only' && !d.headerHtml) {
    flash('That layout prints text, so add header text or switch to Logo Only.', 'warning');
    return false;
  }
  return true;
}

function saveConfig({ asNew = false } = {}) {
  collectDraft();
  if (!validateDraft()) return;

  const d = state.draft;
  const existing = asNew ? null : configById(state.editingId);

  if (existing) {
    Object.assign(existing, d, {
      updatedOn: todayDdMmYyyy(),
      versions: [
        { on: todayDdMmYyyy(), by: CURRENT_USER, note: 'Updated.' },
        ...existing.versions,
      ],
    });
  } else {
    state.configs.unshift({
      ...d,
      id: `cfg-${Date.now()}`,
      isDefault: false,
      createdOn: todayDdMmYyyy(),
      createdBy: CURRENT_USER,
      updatedOn: todayDdMmYyyy(),
      versions: [{ on: todayDdMmYyyy(), by: CURRENT_USER, note: asNew ? 'Created from an existing header.' : 'Created.' }],
    });
  }

  document.getElementById('prnEditorModal')?.close();
  paint();
  flash(`“${d.name}” saved.`, 'success');
}

/* ============================================================================
   CARD ACTIONS
   ========================================================================= */

function setDefault(config) {
  // Cleared everywhere first — that is what makes "only one default" true
  // rather than merely intended.
  for (const other of state.configs) other.isDefault = false;
  config.isDefault = true;
  config.updatedOn = todayDdMmYyyy();
  paint();
  flash(`“${config.name}” is now the default header.`, 'success');
}

function duplicateConfig(config) {
  let name = `${config.name} (copy)`;
  let n = 2;
  while (state.configs.some((c) => c.name === name)) name = `${config.name} (copy ${n++})`;

  state.configs.unshift({
    ...config,
    id: `cfg-${Date.now()}`,
    name,
    isDefault: false,
    fields: [...config.fields],
    footer: [...config.footer],
    createdOn: todayDdMmYyyy(),
    createdBy: CURRENT_USER,
    updatedOn: todayDdMmYyyy(),
    versions: [{ on: todayDdMmYyyy(), by: CURRENT_USER, note: `Duplicated from ${config.name}.` }],
  });
  paint();
  flash(`“${name}” created.`, 'success');
}

let pendingDelete = null;

function askDelete(config, trigger) {
  if (config.isDefault) {
    flash('This is the default header. Make another one the default before deleting it.', 'warning');
    return;
  }
  pendingDelete = config;
  const body = document.getElementById('prnDeleteBody');
  if (body) {
    body.innerHTML = `<p>“${esc(config.name)}” will no longer be available when printing.</p>
      <p class="prn__muted">Documents already printed with it are unaffected.</p>`;
  }
  document.getElementById('prnDeleteModal')?.open(trigger);
}

function confirmDelete() {
  if (!pendingDelete) return;
  const name = pendingDelete.name;
  state.configs = state.configs.filter((c) => c.id !== pendingDelete.id);
  pendingDelete = null;
  document.getElementById('prnDeleteModal')?.close();
  paint();
  flash(`“${name}” deleted.`, 'success');
}

/* ============================================================================
   PREVIEW DIALOG
   ========================================================================= */

let previewConfig = null;

function openPreview(config, trigger) {
  previewConfig = config;
  state.zoom = 100;
  const modal = document.getElementById('prnPreviewModal');
  if (!modal) return;
  modal.setAttribute('heading', `${config.name} — print preview`);
  renderPreviewDialog();
  modal.open(trigger);
}

function renderPreviewDialog() {
  const stage = document.getElementById('prnPreviewStage');
  const label = document.querySelector('[data-testid="prn--zoom-level"]');
  if (!stage || !previewConfig) return;

  stage.innerHTML = PREVIEW_DOCUMENTS.map((doc) => pageMarkup(previewConfig, doc.id)).join('');
  stage.style.zoom = `${state.zoom}%`;
  if (label) label.textContent = `${state.zoom}%`;
}

/* ============================================================================
   IMPORT / EXPORT
   ========================================================================= */

function exportConfigs() {
  const blob = new Blob([JSON.stringify({ printConfigurations: state.configs }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'print-configurations.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  flash(`Exported ${state.configs.length} configurations.`, 'success');
}

function importConfigs(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = parsed?.printConfigurations;
      if (!Array.isArray(incoming)) throw new Error('not a configuration export');

      let added = 0;
      for (const raw of incoming) {
        if (!raw?.name) continue;
        let name = raw.name;
        let n = 2;
        while (state.configs.some((c) => c.name === name)) name = `${raw.name} (${n++})`;
        state.configs.unshift({
          ...blankConfig(),
          ...raw,
          id: `cfg-${Date.now()}-${added}`,
          name,
          isDefault: false, // an import must never silently reassign the default
          createdOn: todayDdMmYyyy(),
          createdBy: CURRENT_USER,
          updatedOn: todayDdMmYyyy(),
          versions: [{ on: todayDdMmYyyy(), by: CURRENT_USER, note: 'Imported.' }],
        });
        added += 1;
      }
      paint();
      flash(`Imported ${added} configuration${added === 1 ? '' : 's'}.`, 'success');
    } catch {
      flash('That file is not a print-configuration export.', 'warning');
    }
  };
  reader.readAsText(file);
}

/* ============================================================================
   WIRING
   ========================================================================= */

function onListUiClick(event) {
  if (event.target.closest('[data-testid="prn--export"]')) return exportConfigs();
  if (event.target.closest('[data-testid="prn--import"]')) return els.importInput?.click();

  const button = event.target.closest('[data-act]');
  const card = event.target.closest('[data-config]');
  if (!button || !card) return undefined;

  const config = configById(card.dataset.config);
  if (!config) return undefined;

  switch (button.dataset.act) {
    case 'preview':
      return openPreview(config, button);
    case 'edit':
      return openEditor(config, button);
    default:
      return undefined;
  }
}

/* The row's "⋮". A native <button>, so this rides the plain click event
   rather than the ui-click the <ui-button>s beside it emit. */
function onListClick(event) {
  const trigger = event.target.closest('[data-menu]');
  if (!trigger) return;
  const config = configById(trigger.dataset.menu);
  if (!config) return;

  openRowMenu(trigger, [
    ...(config.isDefault
      ? []
      : [
          {
            label: 'Set as Default',
            icon: 'check-circle',
            testid: 'prn--set-default',
            run: () => setDefault(config),
          },
        ]),
    { label: 'Duplicate', icon: 'copy', run: () => duplicateConfig(config) },
    { divider: true },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      testid: 'prn--delete',
      run: (from) => askDelete(config, from),
    },
  ]);
}

function onListUiChange(event) {
  if (event.target.closest('[data-testid="prn--filter"]')) {
    state.filter = event.detail.value;
    paint();
    return;
  }
  if (event.target.closest('[data-testid="prn--sort"]')) {
    state.sort = event.detail.value;
    paint();
  }
}

function onListInput(event) {
  if (!event.target.closest('[data-testid="prn--search"]')) return;
  state.search = event.detail.value;
  // Only the table's rows are replaced, so the caret stays in the search box.
  paintTable();
}

/* --- Editor events ---------------------------------------------------------- */

function onEditorClick(event) {
  const command = event.target.closest('[data-cmd]');
  if (command) {
    event.preventDefault();
    document.getElementById('prnEditor')?.focus();
    document.execCommand(command.dataset.cmd, false, null);
    state.draft.headerHtml = document.getElementById('prnEditor')?.innerHTML || '';
    refreshPreview();
    return;
  }

  if (event.target.closest('[data-testid="prn--logo-browse"]')) {
    document.getElementById('prnLogoInput')?.click();
  }
}

function onEditorUiClick(event) {
  if (event.target.closest('[data-testid="prn--logo-remove"]')) {
    state.draft.logo = null;
    state.draft.logoName = null;
    rerenderEditorKeepingScroll();
  }
}

function onEditorInput(event) {
  if (event.target.id === 'prnEditor') {
    state.draft.headerHtml = event.target.innerHTML;
    updateLineCount();
    refreshPreview();
  }
}

function onEditorChange(event) {
  const target = event.target;

  if (target.name === 'prnLayout') {
    state.draft.layout = target.value;
    refreshPreview();
    return;
  }
  if (target.name === 'prnLogoAlign') {
    state.draft.logoAlign = target.value;
    refreshPreview();
    return;
  }
  if (target.name === 'prnTextAlign') {
    state.draft.textAlign = target.value;
    refreshPreview();
    return;
  }
  if (target.name === 'prnFields' || target.name === 'prnFooter') {
    const key = target.name === 'prnFields' ? 'fields' : 'footer';
    const set = new Set(state.draft[key]);
    if (target.checked) set.add(target.value);
    else set.delete(target.value);
    // Kept in the declared order so the header prints the same way twice.
    const order = target.name === 'prnFields' ? PRACTICE_FIELDS : FOOTER_OPTIONS;
    state.draft[key] = order.map((o) => o.id).filter((id) => set.has(id));
    refreshPreview();
    return;
  }
  if (target.classList.contains('prn__rte-size')) {
    document.getElementById('prnEditor')?.focus();
    document.execCommand('fontSize', false, target.value);
    state.draft.headerHtml = document.getElementById('prnEditor')?.innerHTML || '';
    refreshPreview();
  }
}

function onEditorUiChange(event) {
  const d = state.draft;
  if (!d) return;

  if (event.target.closest('#prnSample')) {
    state.previewDoc =
      PREVIEW_DOCUMENTS.find((doc) => doc.label === event.detail.value)?.id ?? state.previewDoc;
    refreshPreview();
    return;
  }
  if (event.target.closest('#prnPaper')) d.paper = event.detail.value;
  if (event.target.closest('#prnOrientation')) d.orientation = event.detail.value;
  if (event.target.closest('#prnMargins')) d.margins = event.detail.value;
  refreshPreview();
}

/* ============================================================================
   INIT
   ========================================================================= */

export function initPrintConfig() {
  els.panel = document.getElementById('printPanel');
  els.addButton = document.querySelector('[data-testid="prc--add-print-config"]');
  els.importInput = document.getElementById('prnImportInput');
  if (!els.panel) return;

  els.panel.addEventListener('click', onListClick);
  els.panel.addEventListener('ui-click', onListUiClick);
  els.panel.addEventListener('ui-change', onListUiChange);
  els.panel.addEventListener('ui-input', onListInput);

  els.addButton?.addEventListener('ui-click', () => openEditor(null, els.addButton));

  const editorBody = document.getElementById('prnEditorBody');
  editorBody?.addEventListener('click', onEditorClick);
  editorBody?.addEventListener('ui-click', onEditorUiClick);
  editorBody?.addEventListener('input', onEditorInput);
  editorBody?.addEventListener('change', onEditorChange);
  editorBody?.addEventListener('ui-change', onEditorUiChange);

  // The file input is recreated with the editor markup, so the listener is
  // delegated from the body rather than bound to the element.
  editorBody?.addEventListener('change', (event) => {
    if (event.target.id !== 'prnLogoInput') return;
    const file = event.target.files?.[0];
    if (file) readLogo(file);
  });

  document
    .querySelector('[data-testid="prn--save"]')
    ?.addEventListener('ui-click', () => saveConfig());
  document
    .querySelector('[data-testid="prn--save-as-new"]')
    ?.addEventListener('ui-click', () => saveConfig({ asNew: true }));
  document.querySelector('[data-testid="prn--editor-preview"]')?.addEventListener('ui-click', () => {
    collectDraft();
    openPreview(state.draft, null);
  });
  document
    .querySelector('[data-testid="prn--delete-confirm"]')
    ?.addEventListener('ui-click', confirmDelete);

  for (const button of document.querySelectorAll('[data-prn-dismiss]')) {
    button.addEventListener('ui-click', () => button.closest('ui-modal')?.close());
  }

  document.querySelector('[data-testid="prn--zoom-in"]')?.addEventListener('click', () => {
    state.zoom = Math.min(200, state.zoom + 10);
    renderPreviewDialog();
  });
  document.querySelector('[data-testid="prn--zoom-out"]')?.addEventListener('click', () => {
    state.zoom = Math.max(50, state.zoom - 10);
    renderPreviewDialog();
  });
  document.querySelector('[data-testid="prn--zoom-fit"]')?.addEventListener('click', () => {
    state.zoom = 100;
    renderPreviewDialog();
  });
  document.querySelector('[data-testid="prn--preview-print"]')?.addEventListener('ui-click', () => {
    /*
     * The one screen that turns the global letterhead off.
     *
     * Everything else in this product prints under the practice letterhead —
     * see js/lib/print-letterhead.js. What prints from HERE is a sample page
     * that IS a letterhead, and the one being judged is the one on the page,
     * not the default. Stamping the default over the top of it would have the
     * screen contradicting itself at exactly the moment somebody is deciding
     * whether the letterhead is right.
     *
     * Set and cleared around the call rather than left on the body, because
     * this screen prints other things too — and window.print() is synchronous,
     * so the flag is already back off by the time anything else can read it.
     */
    document.body.dataset.printLetterhead = 'off';
    window.print();
    delete document.body.dataset.printLetterhead;
  });
  document.querySelector('[data-testid="prn--preview-pdf"]')?.addEventListener('ui-click', () => {
    // A real PDF needs a renderer this prototype does not carry; the browser's
    // own print-to-PDF is the honest stand-in rather than a dead button.
    flash('Use “Print” and choose Save as PDF — the prototype has no PDF renderer.');
  });

  els.importInput?.addEventListener('change', () => {
    const file = els.importInput.files?.[0];
    if (file) importConfigs(file);
    els.importInput.value = '';
  });

  paint();
}
