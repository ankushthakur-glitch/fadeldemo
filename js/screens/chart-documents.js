/**
 * DOCUMENTS — everything filed against this patient that is a file: consents,
 * intake forms, outside reports, scans of insurance cards.
 *
 * The reference screens are a search + "Upload Document" row above a table of
 * Document Name / Document Type / Uploaded By / Uploaded Date, and a small
 * upload dialog. Both are built here as specified; two things were added
 * because the reference implies them without drawing them:
 *
 *   1. The row "⋮" menu, matching the one in Notes and Orders — the reference
 *      draws the trigger but never opens it.
 *   2. Sortable headers. A file list is read newest-first far more often than
 *      alphabetically, so Uploaded Date starts sorted descending.
 *
 * WHAT IS REPAINTED, AND WHAT IS NOT
 * The toolbar is built once and never rebuilt — that is what keeps the caret
 * in the search box between keystrokes. The table element is likewise kept
 * and only handed new rows: <ui-data-table> holds the current sort key and
 * direction privately, so replacing the element would reset them, and every
 * click on a header would read as the first one (always ascending, and no
 * aria-sort marker on the column actually sorted).
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import {
  CHART_DOCUMENTS,
  EMPTY_CHART_DOCUMENTS,
  DOCUMENT_TYPES,
  ACCEPTED_FORMATS,
} from '../../data/chart-documents.js';

/* ============================================================================
   SMALL HELPERS — local, matching how every other chart module keeps its own.
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

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

/** "23-10-2025" → "2025-10-23", so dates sort as dates rather than as text. */
function isoOf(value) {
  const [d, m, y] = String(value || '').split('-');
  return y ? `${y}-${m}-${d}` : '';
}

/** The signed-in user, per the avatar every screen in this app shows. */
const CURRENT_USER = 'Amara Mensah';

/** Extension → the format label stored on a document. */
function formatOf(fileName) {
  const ext = String(fileName || '').split('.').pop().toUpperCase();
  return ext === 'JPEG' ? 'JPG' : ext || 'PDF';
}

/** <ui-file-upload> reports size in bytes; the table shows "412 KB". */
function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ============================================================================
   OPENING THE UPLOAD DIALOG FROM OUTSIDE

   "Upload Document" is also one of the quick actions in the patient header,
   which is rendered by the shell and knows nothing about this module. The
   shell calls openUploadDocument(); if the module is already on screen the
   dialog opens now, and if the shell is still navigating to it the request
   is held until render() picks it up.
   ========================================================================= */

let openNow = null; // set while this module is mounted
let pendingOpen = false; // a request that arrived before it was

export function openUploadDocument() {
  if (openNow) openNow();
  else pendingOpen = true;
}

/* ============================================================================
   TABLE
   ========================================================================= */

/** The name is the way into the file, so it is the one link in the row. */
function nameCell(row) {
  return `<button type="button" class="doc__name" data-doc-open="${row.id}">
      ${esc(row.name)}
    </button>`;
}

const COLUMNS = [
  // No `wrap`: the reference keeps one document per line, and uniform row
  // height is what lets the eye scan a long file list. A long name widens the
  // column, and the table scrolls sideways rather than growing taller.
  { key: 'name', label: 'Document Name', sortable: true, render: nameCell },
  { key: 'type', label: 'Document Type', sortable: true },
  { key: 'uploadedBy', label: 'Uploaded By', sortable: true },
  { key: 'date', label: 'Uploaded Date', sortable: true },
  {
    key: 'menu',
    label: '<span class="u-sr-only">Actions</span>',
    actions: true,
    render: (row) => `<button type="button" class="ui-row-menu-btn" data-doc-menu="${row.id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(row.name)}">
      ${icon('more-vertical')}
    </button>`,
  },
];

/* ============================================================================
   UPLOAD DIALOG
   ========================================================================= */

function uploadModal() {
  return `<ui-modal id="docUploadModal" heading="Upload Document" size="md">
    <div class="doc__form">
      <ui-input
        label="Document Name"
        placeholder="Enter Document Name"
        required
        data-testid="chart--doc-name"
      ></ui-input>

      <ui-select
        label="Document Type"
        placeholder="Select"
        required
        id="docUploadType"
        options="${DOCUMENT_TYPES.join(',')}"
        data-testid="chart--doc-type"
      ></ui-select>

      <ui-file-upload
        label="Upload Document"
        accept="${ACCEPTED_FORMATS}"
        max-size="10MB"
        required
        data-testid="chart--doc-file"
      ></ui-file-upload>

      <p class="doc__form-error" id="docUploadError" role="alert" hidden></p>
    </div>

    <div class="doc__modal-actions">
      <ui-button variant="outline" data-modal-dismiss data-testid="chart--doc-cancel"
        >Cancel</ui-button
      >
      <ui-button variant="primary" data-testid="chart--doc-add">Add</ui-button>
    </div>
  </ui-modal>`;
}

/** Preview stands in for a viewer this prototype has no file to feed. */
function previewModal() {
  return `<ui-modal id="docPreviewModal" heading="Document" size="md">
    <div class="doc__preview" data-testid="chart--doc-preview">
      <span class="doc__preview-mark" aria-hidden="true">${icon('document')}</span>
      <dl class="doc__preview-meta" id="docPreviewMeta"></dl>
      <p class="doc__preview-note">
        The prototype stores what a document is, not the document itself, so
        there is no page to render here yet.
      </p>
    </div>
    <div class="doc__modal-actions">
      <ui-button variant="outline" data-modal-dismiss>Close</ui-button>
      <ui-button variant="primary" icon="upload" data-testid="chart--doc-preview-download"
        >Download</ui-button
      >
    </div>
  </ui-modal>`;
}

/* ============================================================================
   MODULE
   ========================================================================= */

registerModule('documents', {
  /* Search and Upload Document belong on the same row as the "Documents"
     heading — the head is the slot the shell reserves for a module's filters
     and its whole-module actions, and putting them there costs the panel one
     row of furniture rather than two. The search box also survives a repaint
     now that the shell owns it: it is rendered when the module mounts, not
     rebuilt under the cursor on every keystroke. */
  actions: () =>
    `<ui-input class="ord__search" size="sm" icon="search" label="Search documents"
      label-hidden placeholder="Search" data-testid="chart--doc-search"></ui-input
    ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--doc-upload"
      >Upload Document</ui-button
    >`,

  render(host, ctx) {
    // Copied rather than mutated in place, same as chart-notes.js: leaving and
    // returning to the section must not compound edits from the last visit.
    const documents = [...(CHART_DOCUMENTS[ctx.patient.mrn] || EMPTY_CHART_DOCUMENTS)];

    /* The search box and Upload Document are the shell's markup, in the head
       above this host, so their events are listened for on the head. */
    const head = host.parentElement;

    const state = {
      search: '',
      sort: { key: 'date', direction: 'descending' },
      file: null, // { name, size } from <ui-file-upload>
    };

    /* --- Derived list -------------------------------------------------------- */

    function visible() {
      const query = state.search.trim().toLowerCase();
      const rows = query
        ? documents.filter((doc) =>
            [doc.name, doc.type, doc.uploadedBy].some((field) =>
              String(field).toLowerCase().includes(query)
            )
          )
        : [...documents];

      const { key, direction } = state.sort;
      const sign = direction === 'descending' ? -1 : 1;
      return rows.sort((a, b) => {
        const [left, right] =
          key === 'date' ? [isoOf(a.date), isoOf(b.date)] : [String(a[key]), String(b[key])];
        return sign * left.localeCompare(right, undefined, { numeric: true });
      });
    }

    /* --- Paint --------------------------------------------------------------- */

    function paint() {
      host.innerHTML = `<ui-data-table data-testid="chart--doc-table"></ui-data-table>

        ${uploadModal()}
        ${previewModal()}`;

      host.querySelector('ui-data-table').columns = COLUMNS;
      applyRows();
    }

    /** Hand the table the current rows. The element itself is never replaced. */
    function applyRows() {
      const table = host.querySelector('[data-testid="chart--doc-table"]');
      if (!table) return;

      const rows = visible();
      table.setAttribute(
        'empty-text',
        state.search
          ? 'No documents match your search.'
          : 'No documents on this patient yet.'
      );
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
    }

    /**
     * `patient.counts.documents` is what this panel's fixture is built from
     * (see data/chart-documents.js), so adding or deleting here has to move
     * it — otherwise a second visit to the chart rebuilds the old list and
     * silently undoes the upload.
     *
     * It used to repaint the sidebar as well, because the section carried a
     * badge showing this number. The rail names places now and counts none of
     * them, so there is nothing up there left to contradict, and the table
     * has already been repainted by the caller.
     */
    function syncCount() {
      if (ctx.patient.counts) ctx.patient.counts.documents = documents.length;
    }

    /* --- Row menu ------------------------------------------------------------ */

    function documentMenu(id) {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;

      const anchor = host.querySelector(`[data-doc-menu="${id}"]`);
      openRowMenu(anchor, [
        { label: 'Preview', icon: 'eye', run: () => openPreview(doc, anchor) },
        {
          label: 'Download',
          icon: 'download',
          run: () => ctx.flash(`Would download ${doc.name} (${doc.format}, ${doc.size}).`),
        },
        { label: 'Delete', icon: 'trash', danger: true, run: () => deleteDocuments([doc.id]) },
      ]);
    }

    function deleteDocuments(ids) {
      const removed = documents.filter((doc) => ids.includes(doc.id));
      if (!removed.length) return;

      for (const doc of removed) documents.splice(documents.indexOf(doc), 1);
      applyRows();
      syncCount();
      ctx.flash(
        removed.length === 1
          ? `${removed[0].name} deleted.`
          : `${removed.length} documents deleted.`,
        'success'
      );
    }

    /* --- Preview -------------------------------------------------------------- */

    function openPreview(doc, opener) {
      const modal = host.querySelector('#docPreviewModal');
      const meta = host.querySelector('#docPreviewMeta');
      if (!modal || !meta) return;

      meta.innerHTML = [
        ['Document Name', doc.name],
        ['Document Type', doc.type],
        ['Uploaded By', doc.uploadedBy],
        ['Uploaded Date', doc.date],
        ['File', `${doc.format} · ${doc.size}`],
      ]
        .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
        .join('');

      // Set the heading before opening: ui-modal patches its title in place,
      // so the dialog's contents survive the change.
      modal.setAttribute('heading', doc.name);
      modal.open(opener);
    }

    /* --- Upload --------------------------------------------------------------- */

    function openUpload(opener) {
      const modal = host.querySelector('#docUploadModal');
      if (!modal) return;

      state.file = null;
      const nameField = host.querySelector('[data-testid="chart--doc-name"]');
      if (nameField) {
        nameField.value = '';
        nameField.removeAttribute('error');
      }
      host.querySelector('#docUploadType')?.removeAttribute('error');
      const error = host.querySelector('#docUploadError');
      if (error) error.hidden = true;

      modal.open(opener);
    }

    function saveDocument() {
      const nameField = host.querySelector('[data-testid="chart--doc-name"]');
      const typeField = host.querySelector('#docUploadType');
      const error = host.querySelector('#docUploadError');

      const name = (nameField?.value || '').trim();
      const type = typeField?.value || '';

      // Every problem is reported at once. Validating one field at a time
      // makes the user press Add three times to discover three mistakes.
      if (name) nameField?.removeAttribute('error');
      else nameField?.setAttribute('error', 'Enter a document name.');

      if (type) typeField?.removeAttribute('error');
      else typeField?.setAttribute('error', 'Choose a document type.');

      // The dropzone has no error slot of its own, so its message goes in the
      // shared line beneath the form.
      if (error) {
        error.textContent = 'Choose a file to upload.';
        error.hidden = Boolean(state.file);
      }

      if (!name || !type || !state.file) {
        if (!name) nameField?.focus();
        return;
      }

      documents.unshift({
        id: `doc-${Date.now()}`,
        name,
        type,
        format: formatOf(state.file.name),
        size: formatBytes(state.file.size),
        uploadedBy: CURRENT_USER,
        date: todayDdMmYyyy(),
      });

      // A new row must be visible, and a stale search or sort can hide it.
      state.search = '';
      state.sort = { key: 'date', direction: 'descending' };
      const search = host.querySelector('[data-testid="chart--doc-search"]');
      if (search) search.value = '';

      host.querySelector('#docUploadModal')?.close();
      applyRows();
      syncCount();
      ctx.flash(`${name} uploaded.`, 'success');
    }

    /* --- Wiring --------------------------------------------------------------- */

    function onClick(event) {
      const menuBtn = event.target.closest('[data-doc-menu]');
      if (menuBtn) {
        documentMenu(menuBtn.dataset.docMenu);
        return;
      }

      const openBtn = event.target.closest('[data-doc-open]');
      if (openBtn) {
        const doc = documents.find((d) => d.id === openBtn.dataset.docOpen);
        if (doc) openPreview(doc, openBtn);
        return;
      }

      if (event.target.closest('[data-modal-dismiss]')) {
        event.target.closest('ui-modal')?.close();
      }
    }

    function onUiClick(event) {
      if (event.target.closest('[data-testid="chart--doc-add"]')) {
        saveDocument();
        return;
      }
      if (event.target.closest('[data-testid="chart--doc-preview-download"]')) {
        ctx.flash('Would download this document.');
      }
    }

    function onSearch(event) {
      if (!event.target.closest('[data-testid="chart--doc-search"]')) return;
      state.search = event.detail.value;
      applyRows();
    }

    /** ui-change inside the panel now only ever means the upload modal's
     *  dropzone — the search box that used to share this listener moved up
     *  into the module head and is heard there instead. */
    function onChange(event) {
      if (!event.target.closest('[data-testid="chart--doc-file"]')) return;
      state.file = { name: event.detail.name, size: event.detail.size };
      const error = host.querySelector('#docUploadError');
      if (error) error.hidden = true;
    }

    /** The table owns the ascending → descending cycle; this only records
     *  where it landed so the next repaint reorders the same way. */
    function onSort(event) {
      state.sort = { key: event.detail.key, direction: event.detail.direction };
      applyRows();
    }

    /* --- The module head ------------------------------------------------------
       Search and Upload Document are drawn by the shell, outside this host,
       so the two events they fire are listened for there.
       ----------------------------------------------------------------------- */

    function onHeadUiClick(event) {
      if (event.target.closest('[data-testid="chart--doc-upload"]')) {
        openUpload(event.target.closest('ui-button'));
      }
    }

    host.addEventListener('click', onClick);
    host.addEventListener('ui-click', onUiClick);
    host.addEventListener('ui-change', onChange);
    host.addEventListener('ui-sort', onSort);
    head?.addEventListener('ui-click', onHeadUiClick);
    // <ui-input> fires ui-input per keystroke and ui-change only on blur —
    // search has to follow the typing.
    head?.addEventListener('ui-input', onSearch);
    head?.addEventListener('ui-change', onSearch);

    paint();

    // Answer any "Upload Document" click that arrived while the shell was
    // still navigating here.
    openNow = () => openUpload(head?.querySelector('[data-testid="chart--doc-upload"]'));
    if (pendingOpen) {
      pendingOpen = false;
      openNow();
    }

    return () => {
      host.removeEventListener('click', onClick);
      host.removeEventListener('ui-click', onUiClick);
      host.removeEventListener('ui-change', onChange);
      host.removeEventListener('ui-sort', onSort);
      head?.removeEventListener('ui-click', onHeadUiClick);
      head?.removeEventListener('ui-input', onSearch);
      head?.removeEventListener('ui-change', onSearch);
      closeRowMenu();
      openNow = null;
    };
  },
});
