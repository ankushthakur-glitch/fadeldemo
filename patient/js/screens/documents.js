/**
 * DOCUMENTS — the table, and the upload dialog.
 *
 * The dialog genuinely adds a row. That is the difference between reviewing a
 * FORM and reviewing an OUTCOME: a modal that validates, closes and changes
 * nothing tells you whether the fields are right but not whether the result
 * lands anywhere a patient would look for it. The row is in memory only and
 * is gone on reload — see data/documents.js.
 */

import { mountShell } from '../lib/shell.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { DOCUMENTS, CATEGORIES, addDocument } from '../../data/documents.js';
import { PATIENT } from '../../data/patient.js';

document.addEventListener('DOMContentLoaded', () => {
  // The design's breadcrumb here read "Documents / Not Completed", naming a
  // filter no control on the screen offers. Breadcrumbs are gone portal-wide
  // (see lib/shell.js), and that filter went with the trail that implied it.
  const mounted = mountShell({ active: 'documents' });
  if (!mounted) return;

  paintRows();
  wireUpload();
});

/* ============================================================================
   THE TABLE
   ========================================================================= */

function paintRows() {
  const body = document.getElementById('documentRows');

  body.innerHTML = DOCUMENTS.map(
    (doc) => `
    <tr data-document="${esc(doc.id)}">
      <td><a href="#" data-open="${esc(doc.id)}">${esc(doc.name)}</a></td>
      <td>${esc(doc.category)}</td>
      <td>${esc(doc.provider)}</td>
      <td>${esc(doc.received)}</td>
      <td>${esc(doc.ends)}</td>
    </tr>`
  ).join('');

  // One delegated listener, rebound-free across re-renders.
  body.onclick = (event) => {
    const link = event.target.closest('[data-open]');
    if (!link) return;
    event.preventDefault();
    const doc = DOCUMENTS.find((entry) => entry.id === link.dataset.open);
    toast(`This would open “${doc.name}” for you to read, sign or download.`);
  };
}

/* ============================================================================
   THE UPLOAD DIALOG
   ========================================================================= */

function wireUpload() {
  const modal = document.getElementById('uploadModal');
  const form = document.getElementById('uploadForm');
  const open = document.getElementById('openUpload');
  const close = document.getElementById('closeUpload');
  const cancel = document.getElementById('cancelUpload');

  const type = document.getElementById('docType');
  const date = document.getElementById('docDate');
  const description = document.getElementById('docDescription');
  const drop = document.getElementById('dropZone');
  const file = document.getElementById('docFile');
  const chosen = document.getElementById('chosenFiles');

  const errors = {
    type: document.getElementById('docTypeError'),
    date: document.getElementById('docDateError'),
    file: document.getElementById('docFileError'),
  };

  type.innerHTML =
    /* disabled hidden: the placeholder is the question, not an answer, so
       it shows in the closed field and stays out of the open list. */
    '<option value="" disabled hidden selected>Select Document Type</option>' +
    CATEGORIES.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');

  // Keeps the placeholder option grey while nothing is chosen. See the
  // [data-empty] rule in components.css.
  type.addEventListener('change', () => {
    type.dataset.empty = String(!type.value);
  });

  /* --- Opening and closing ------------------------------------------------- */

  open.addEventListener('click', () => {
    reset();
    modal.showModal();
    type.focus();
  });

  const dismiss = () => modal.close();
  close.addEventListener('click', dismiss);
  cancel.addEventListener('click', dismiss);

  // Clicking the backdrop closes it. The <dialog> element itself IS the
  // backdrop's hit target — a click that lands on the dialog box bubbles from
  // a child, so comparing the target is what separates the two.
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.close();
  });

  /* --- The drop zone -------------------------------------------------------- */

  drop.addEventListener('click', () => file.click());

  ['dragenter', 'dragover'].forEach((name) =>
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.dataset.dragging = 'true';
    })
  );

  ['dragleave', 'drop'].forEach((name) =>
    drop.addEventListener(name, () => {
      drop.dataset.dragging = 'false';
    })
  );

  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    // DataTransfer.files is the same FileList shape the input carries, so
    // assigning it means the rest of the flow cannot tell the two apart.
    file.files = event.dataTransfer.files;
    paintChosen();
  });

  file.addEventListener('change', paintChosen);

  function paintChosen() {
    const names = [...file.files].map((entry) => entry.name);
    chosen.textContent = names.length
      ? `${names.length} selected: ${names.join(', ')}`
      : '';
  }

  /* --- Submit ---------------------------------------------------------------- */

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    clearErrors();
    let firstBad = null;

    if (!type.value) firstBad = fail(type, errors.type, 'Choose a document type.');
    if (!date.value) firstBad ??= fail(date, errors.date, 'Choose a date.');
    if (!file.files.length) {
      firstBad ??= fail(drop, errors.file, 'Add at least one file.');
    }

    if (firstBad) {
      firstBad.focus();
      return;
    }

    const name = file.files[0].name.replace(/\.[^.]+$/, '');
    const stamp = formatDate(date.value);

    addDocument({
      id: `doc-${Date.now()}`,
      name,
      category: type.value,
      // Nobody on the practice's side has touched it yet, and putting a
      // clinician's name against a file the patient just uploaded would be a
      // lie the table has no way to correct later.
      provider: PATIENT.name,
      received: stamp,
      ends: '—',
      description: description.value.trim(),
    });

    paintRows();
    modal.close();
    toast(`“${name}” uploaded.`, 'ok');
  });

  /* --- Helpers ---------------------------------------------------------------- */

  function fail(field, slot, message) {
    field.setAttribute('aria-invalid', 'true');
    slot.textContent = message;
    slot.hidden = false;
    return field;
  }

  function clearErrors() {
    [type, date, drop].forEach((field) => field.removeAttribute('aria-invalid'));
    Object.values(errors).forEach((slot) => {
      slot.hidden = true;
      slot.textContent = '';
    });
  }

  function reset() {
    form.reset();
    type.dataset.empty = 'true';
    chosen.textContent = '';
    clearErrors();
  }
}

/**
 * "2026-08-14" → "8/14/2026", matching the format already in the table.
 *
 * Split on the string rather than parsed with `new Date`: an ISO date with no
 * time is read as UTC midnight, so in any timezone behind UTC it renders as
 * the day before. That bug is invisible to whoever writes it and obvious to
 * whoever uploads a document at 9pm.
 */
function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}
