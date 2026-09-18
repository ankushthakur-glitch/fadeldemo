/**
 * DOWNLOAD AS PDF, IN ONE PLACE.
 *
 * WHAT A DOWNLOAD USED TO PRODUCE
 * Three of this product's Download buttons handed over a .txt file: the two on
 * a consent form at check-in, the one on the check-in record, and the one on a
 * gEstimator estimate. A patient estimate or a signed consent is a DOCUMENT —
 * it gets filed, forwarded, printed and read by somebody who was not in the
 * room — and a text file is not a document. It carries no letterhead, no
 * layout, no signature block, and it looks like a note somebody typed. Every
 * download that hands over a document now hands over a PDF.
 *
 * WHY THE BROWSER'S OWN PRINT-TO-PDF AND NOT A LIBRARY
 * The same bargain the rest of this prototype already struck — see printForm()
 * in js/screens/chart-forms.js and lib/med-print.js in the patient portal.
 * There is no server here and no build step; the whole point is that the thing
 * opens from a double-clicked file with nothing installed. Every desktop
 * browser's print dialog offers "Save as PDF" and both mobile ones offer
 * Share → Save, so window.print() covers paper AND the file with no renderer
 * to bundle. A one-click export that fabricated a PDF would need a library
 * this build will not carry; a button that promised one and produced nothing
 * would be worse than the text file it replaced.
 *
 * So a download here differs from a print in exactly one way: the DOCUMENT
 * TITLE is set first, because that is what the browser's Save dialog offers as
 * the filename. Without it every saved estimate on a biller's desktop is
 * called "MediNova EHR — Patient Chart".
 *
 * TWO SHAPES, ONE CALL
 * Some of these documents are already on screen when the button is pressed —
 * the open consent pane IS the consent, and the estimate view IS the estimate
 * — and the screen's own @media print rules already strip the furniture off
 * them. Those need nothing but the title.
 *
 * Others are not: Download sits on every row of the estimates LIST, where what
 * is on screen is the list and not any one document. Those pass `markup`, and
 * it is rendered into a sheet that is the only thing on the page for the
 * duration of the print.
 *
 * Either way the practice letterhead prints above it — see
 * js/lib/print-letterhead.js — which is the other half of what makes the
 * result a document rather than a screenshot.
 */

const SHEET_ID = 'printDocumentSheet';
const SHEET_CLASS = 'print-doc';
const BODY_CLASS = 'print-doc--printing';

/** The title to put back afterwards. Null when no download is in flight. */
let restoreTitle = null;

/**
 * The sheet, built on first use.
 *
 * One per page, reused: a container appended per download would leave the
 * previous document in the DOM behind the next one, and two estimates on one
 * sheet is a document that is wrong about itself.
 */
function sheet() {
  let host = document.getElementById(SHEET_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = SHEET_ID;
    host.className = SHEET_CLASS;
    /* It is a copy of something the screen is already showing, or of something
       a row on screen already describes. Either way it is not a second thing
       for a screen reader to find. */
    host.setAttribute('aria-hidden', 'true');
    document.body.append(host);
  }
  return host;
}

/**
 * Put the page back, however the dialog closed — printed or cancelled.
 *
 * Registered once, at module load, rather than per call. A listener added
 * before each print and removed inside itself would leak on any browser that
 * does not fire afterprint at all, and would leave that browser's tab titled
 * after a document the reader has finished with.
 */
window.addEventListener('afterprint', () => {
  document.body.classList.remove(BODY_CLASS);
  const host = document.getElementById(SHEET_ID);
  if (host) host.innerHTML = '';
  if (restoreTitle !== null) {
    document.title = restoreTitle;
    restoreTitle = null;
  }
});

/**
 * Hand a document over as a PDF.
 *
 * @param {object} options
 * @param {string} options.title   what the browser's Save dialog should call
 *                                 the file — no extension, the browser adds
 *                                 `.pdf` itself
 * @param {string} [options.markup] the document, when it is not already the
 *                                 thing on screen. Omit to print the screen.
 */
export function downloadAsPdf({ title, markup = null }) {
  if (markup !== null) {
    sheet().innerHTML = markup;
    document.body.classList.add(BODY_CLASS);
  }

  if (title) {
    // Guarded: a second press before afterprint has fired would otherwise
    // record the DOCUMENT's title as the one to restore, and the tab would
    // keep it for the rest of the session.
    if (restoreTitle === null) restoreTitle = document.title;
    document.title = title;
  }

  window.print();
}

/**
 * Print the document a download would hand over.
 *
 * The same call without a title: Print is not saving a file, so renaming the
 * tab would be renaming it for nothing. This exists so that a Print button
 * sitting beside a Download button produces the SAME sheet — two controls on
 * one bar that disagreed about what the document looks like would be worse
 * than either of them being wrong on its own.
 */
export function printAsPdf({ markup = null } = {}) {
  downloadAsPdf({ title: null, markup });
}
