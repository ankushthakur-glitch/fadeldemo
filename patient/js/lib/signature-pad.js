/**
 * THE SIGNATURE BLOCK — draw it, or upload one.
 *
 * TWO WAYS TO SIGN, AND NEITHER IS THE FALLBACK
 *
 * Drawing is what a signature is on paper, and on a phone or a tablet it is
 * genuinely the easier of the two — a finger is right there. On a desktop
 * with a mouse it is close to useless: a mouse-drawn signature looks nothing
 * like anybody's handwriting and takes four attempts. So the uploaded image
 * is not a degraded mode for browsers that cannot cope; it is the better
 * option on half the devices — a photograph of a signed sheet, or the scan
 * the patient already keeps — and it is offered as an equal.
 *
 * Both produce the same thing — a PNG or JPG and a name — so nothing
 * downstream has to care which was used. `method` records which, because a
 * reader of the signed form is entitled to know.
 *
 * WHAT MAKES IT BINDING IS NOT THE PICTURE
 *
 * It is the confirmation tick and the record of who signed, when, and by what
 * route. A drawn squiggle proves nothing on its own; the statement beside it
 * — that this is the patient's electronic signature and has the same effect
 * as a handwritten one — is the part that matters, which is why Submit waits
 * for the checkbox and not only for the ink.
 *
 * POINTER EVENTS, NOT MOUSE + TOUCH
 *
 * One set of handlers covers mouse, finger and stylus, including pressure-
 * sensitive pens, and setPointerCapture keeps the stroke alive when the
 * pointer leaves the canvas mid-signature — the commonest way a hand-rolled
 * pad drops the tail off someone's name.
 *
 * THE UPLOAD IS THE SAME CONTROL THE INSURANCE CARDS USE
 *
 * A .pp-drop that is a real <button> — focusable, openable with Enter, and a
 * drop target as well as a picker. See lib/card-scans.js for why the frame
 * itself is the button rather than a div with a second "Upload" beside it.
 * The limits are stricter here: a signature is a PNG or a JPG and it is
 * small, so a PDF and a ten-megabyte photograph are both refused.
 */

import { icon } from './icons.js';

/** Backing-store resolution, so the stroke is not a blurry upscale on print. */
const SCALE = 2;

/** What an uploaded signature may be. Stated on the control, and enforced. */
const ACCEPTED = ['image/png', 'image/jpeg'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Build the signature block's markup.
 *
 * Takes nothing: the signer's name belongs to the RECORD, not to the control,
 * and the only place it is shown is the live "Signed by …" line that
 * wireSignature() writes.
 */
export function signatureMarkup() {
  /*
   * A <section>, not a <fieldset> — for the reason written at length above
   * fillSection() in js/screens/forms.js. A <legend> is lifted into the
   * fieldset's top border by the browser, and every way of getting it back
   * into the flow breaks the layout of whatever follows it.
   */
  return `
    <section class="pp-sign" aria-labelledby="sign-heading" data-testid="form--signature">
      <h2 class="pp-sign__title" id="sign-heading">Signature</h2>

      <!--
        The switch and the clear on ONE line above the pad, which is where the
        reference puts them: what you are about to do on the left, undoing it
        on the right, and the thing they act on filling the width underneath.
      -->
      <div class="pp-sign__bar">
        <!--
          The two modes are radios wearing a segmented control, not two
          buttons. A toggle implies one is the real one; these are
          alternatives, and native radios keep the arrow keys, the grouping
          and the announcement that a pair of styled buttons would throw away.
        -->
        <div class="pp-sign__modes" role="radiogroup" aria-label="How to sign">
          <label class="pp-sign__mode">
            <input type="radio" name="signMode" value="draw" checked
              data-sign-mode data-testid="form--sign-mode-draw" />
            <span>Draw</span>
          </label>
          <label class="pp-sign__mode">
            <input type="radio" name="signMode" value="upload"
              data-sign-mode data-testid="form--sign-mode-upload" />
            <span>Upload</span>
          </label>
        </div>

        <button type="button" class="pp-sign__clear"
          data-sign-clear data-testid="form--sign-clear">Clear Signature</button>
      </div>

      <div class="pp-sign__pad" data-sign-pane="draw">
        <!--
          width/height are set in script from the element's own box, so the
          backing store matches the CSS size and the stroke is not stretched.
          The label is on the canvas itself: it is an interactive control, and
          a keyboard user tabbing here needs to be told what it is and that
          the upload alternative exists.
        -->
        <canvas class="pp-sign__canvas" data-sign-canvas tabindex="0"
          role="img"
          aria-label="Signature pad. Draw your signature with a mouse, finger or stylus, or choose Upload to attach an image of it."
          data-testid="form--sign-canvas"></canvas>
        <p class="pp-sign__baseline" aria-hidden="true">Sign here</p>
      </div>

      <div data-sign-pane="upload" hidden>
        <!--
          The zone IS the button — pressing it opens the picker, dropping on
          it does the same job. Deliberately the markup Documents already uses
          for its upload: a .pp-drop button, an .pp-sr-only file input beside
          it, and the chosen file named inside the zone.
        -->
        <button type="button" class="pp-drop pp-sign__drop"
          data-sign-drop data-dragging="false" data-testid="form--sign-drop">
          ${icon('image')}
          <span>
            Drop your signature here, or <span class="pp-link">click to browse</span>
          </span>
          <span class="pp-sign__drop-note">.png, .jpg, up to 5MB.</span>
          <span class="pp-drop__files" data-sign-file-name></span>
        </button>

        <input class="pp-sr-only" type="file" accept="image/png,image/jpeg"
          data-sign-file data-testid="form--sign-file"
          aria-label="Upload an image of your signature" />

        <!--
          Empty until there is something to show, and emptied again by Clear.
          An <img> left in the markup with no src is a broken-image glyph
          waiting for one stylesheet to stop hiding it.
        -->
        <div class="pp-sign__upload" data-sign-preview hidden></div>
      </div>

      <div class="pp-sign__row">
        <p class="pp-sign__state" data-sign-state aria-live="polite">Not signed yet.</p>
      </div>

      <label class="pp-check pp-sign__confirm">
        <input type="checkbox" data-sign-confirm data-testid="form--sign-confirm" />
        <span>
          I confirm this is my electronic signature and it has the same effect as a
          handwritten signature.
        </span>
      </label>

      <p class="pp-field__error" data-sign-error hidden></p>
    </section>
  `;
}

/**
 * How a stored signature was given, in words.
 *
 * Lives here rather than in the two places that show it — the read-back view
 * and the printed sheet — because it has to say the same thing on both, and
 * because it is the one piece of knowledge about the record's shape that
 * outlives a change to the block. Older records carry `typed` and no
 * `method`: they were signed when typing a name was the alternative to
 * drawing, and the seeded completions stand for paperwork the practice holds
 * on paper. Neither can be re-labelled after the fact, so both are read as
 * what they were.
 */
export function signatureMethodLabel(sig) {
  if (sig?.method === 'upload') return 'Uploaded image';
  if (sig?.method === 'draw') return 'Drawn signature';
  return sig?.typed ? 'Typed name' : 'Drawn signature';
}

/**
 * Wire the block up.
 *
 * @param {HTMLElement} root      the container the markup was rendered into
 * @param {object}      options
 * @param {string}      options.name      signer's name, kept with the image
 * @param {Function}    [options.onChange] called whenever signed-ness changes
 * @returns {object} { isSigned, complain, read }
 */
export function wireSignature(root, { name, onChange = () => {} }) {
  const block = root.querySelector('.pp-sign');
  if (!block) return null;

  const canvas = block.querySelector('[data-sign-canvas]');
  const drop = block.querySelector('[data-sign-drop]');
  const file = block.querySelector('[data-sign-file]');
  const preview = block.querySelector('[data-sign-preview]');
  const fileName = block.querySelector('[data-sign-file-name]');
  const confirm = block.querySelector('[data-sign-confirm]');
  const state = block.querySelector('[data-sign-state]');
  const error = block.querySelector('[data-sign-error]');
  const panes = block.querySelectorAll('[data-sign-pane]');

  const context = canvas.getContext('2d');
  let drawn = false;
  let uploaded = null;
  let mode = 'draw';

  /* --- The canvas ----------------------------------------------------------- */

  /**
   * Size the backing store to the element's real box.
   *
   * Done on mount and on resize. A canvas with no width/height attributes is
   * 300×150 regardless of its CSS size, so the stroke is drawn into a small
   * bitmap and stretched — which is exactly the blur that makes a signature
   * look like a fax of a fax once it prints.
   */
  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;

    // Re-sizing a canvas CLEARS it, so anything already drawn is preserved
    // across the resize rather than lost when a phone is rotated.
    const previous = drawn ? canvas.toDataURL() : null;

    canvas.width = Math.round(box.width * SCALE);
    canvas.height = Math.round(box.height * SCALE);

    context.scale(SCALE, SCALE);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    // Explicit black rather than currentColor: this image is printed and
    // emailed, and it must not inherit a theme it will not be read in.
    context.strokeStyle = '#111111';

    if (previous) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, box.width, box.height);
      image.src = previous;
    }
  }

  let drawing = false;

  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (mode !== 'draw') return;
    event.preventDefault();
    drawing = true;
    // Keeps the stroke alive if the pointer leaves the canvas mid-signature.
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    event.preventDefault();
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    if (!drawn) {
      drawn = true;
      report();
    }
  });

  const stopStroke = (event) => {
    if (!drawing) return;
    drawing = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    // A tap with no movement is still a mark on paper.
    if (!drawn) {
      drawn = true;
      report();
    }
  };

  canvas.addEventListener('pointerup', stopStroke);
  canvas.addEventListener('pointercancel', stopStroke);

  /* --- The upload ------------------------------------------------------------
     Everything drag-and-drop does is also reachable from the picker, so a
     browser without it loses nothing. */

  drop.addEventListener('click', () => file.click());

  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.dataset.dragging = 'true';
  });

  ['dragleave', 'drop'].forEach((kind) =>
    drop.addEventListener(kind, () => {
      drop.dataset.dragging = 'false';
    })
  );

  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    accept(event.dataTransfer?.files?.[0]);
  });

  file.addEventListener('change', () => {
    accept(file.files?.[0]);
    // Cleared so choosing the SAME file twice still fires a change event —
    // otherwise re-picking after a Clear silently does nothing.
    file.value = '';
  });

  /**
   * Validate one file, read it, and show it.
   *
   * The size check happens BEFORE the read rather than after: an oversized
   * photograph should be refused in a millisecond, not after the browser has
   * base64-encoded it.
   */
  function accept(chosen) {
    // Whatever the last attempt was refused for, this one is a fresh try —
    // and a stale complaint sitting under a signature that has just been
    // attached reads as a complaint about that one.
    hush();

    const rejection = rejectionFor(chosen);
    if (rejection) return void say(rejection);

    const reader = new FileReader();
    reader.onerror = () => say('That file could not be read. Try choosing it again.');
    reader.onload = () => {
      uploaded = { dataUrl: String(reader.result), fileName: chosen.name };
      preview.innerHTML = `<img class="pp-sign__upload-image" alt="Your uploaded signature"
        src="${uploaded.dataUrl}" data-testid="form--sign-preview" />`;
      preview.hidden = false;
      // The zone stays put and keeps its wording; the file it took is named
      // inside it, which is how Documents reports the same thing.
      fileName.textContent = chosen.name;
      report();
    };
    reader.readAsDataURL(chosen);
  }

  /** Whether this file is allowed, and if not, the sentence saying why. */
  function rejectionFor(chosen) {
    if (!chosen) return 'No file was chosen.';
    if (!ACCEPTED.includes(chosen.type)) {
      return 'That is not a PNG or a JPG. Choose a .png or .jpg image of your signature.';
    }
    if (chosen.size > MAX_BYTES) {
      return `That file is ${(chosen.size / 1024 / 1024).toFixed(1)}MB. A signature image has to be under 5MB.`;
    }
    return null;
  }

  function clearUpload() {
    uploaded = null;
    preview.innerHTML = '';
    preview.hidden = true;
    fileName.textContent = '';
  }

  /* --- Mode, clearing and state -------------------------------------------- */

  block.querySelectorAll('[data-sign-mode]').forEach((radio) =>
    radio.addEventListener('change', () => {
      mode = radio.value;
      panes.forEach((pane) => {
        pane.hidden = pane.dataset.signPane !== mode;
      });
      // "Attach an image of your signature" is about the pane being left, and
      // it stops being true the moment the other one is on screen.
      hush();
      if (mode === 'draw') resize();
      report();
    })
  );

  /*
   * ONE CLEAR, AND IT CLEARS BOTH.
   *
   * It is labelled "Clear Signature", not "clear this pad": somebody who drew
   * one, switched to Upload and attached another has two marks on file and
   * one of them is about to be signed. Wiping only the visible one leaves the
   * other waiting to be submitted by a mode switch.
   */
  block.querySelector('[data-sign-clear]').addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawn = false;
    clearUpload();
    report();
    (mode === 'draw' ? canvas : drop).focus();
  });

  confirm.addEventListener('change', report);

  function hasMark() {
    return mode === 'draw' ? drawn : Boolean(uploaded);
  }

  function isSigned() {
    return hasMark() && confirm.checked;
  }

  function report() {
    state.textContent = !hasMark()
      ? 'Not signed yet.'
      : confirm.checked
        ? `Signed by ${name}.`
        : 'Tick the confirmation below to finish signing.';

    if (isSigned()) {
      error.hidden = true;
      error.textContent = '';
    }
    onChange(isSigned());
  }

  /**
   * Put a message in the block's own error slot rather than in a toast — it
   * is about this control, and it has to still be there when the patient
   * looks back at it. Named `say` because the block already exports a
   * `complain()` for the caller, and one name for both would read as
   * recursion.
   */
  function say(message) {
    error.textContent = message;
    error.hidden = false;
  }

  /** Take a message back down. */
  function hush() {
    error.textContent = '';
    error.hidden = true;
  }

  /* --- Mount ---------------------------------------------------------------- */

  resize();
  window.addEventListener('resize', () => {
    if (mode === 'draw') resize();
  });

  return {
    isSigned,

    /** Say what is missing, and hand back the control to focus. */
    complain() {
      say(
        !hasMark()
          ? mode === 'draw'
            ? 'Draw your signature above, or choose Upload to attach an image of it.'
            : 'Attach an image of your signature, or choose Draw to sign here.'
          : 'Tick the box to confirm this is your signature.'
      );
      return !hasMark() ? (mode === 'draw' ? canvas : drop) : confirm;
    },

    /** The record to store alongside the answers. */
    read() {
      if (!isSigned()) return null;

      const now = new Date();
      return {
        dataUrl: mode === 'upload' ? uploaded.dataUrl : canvas.toDataURL('image/png'),
        name,
        method: mode,
        fileName: mode === 'upload' ? uploaded.fileName : null,
        signedAt: now.toISOString(),
        signedOn: `${String(now.getMonth() + 1).padStart(2, '0')}/${String(
          now.getDate()
        ).padStart(2, '0')}/${now.getFullYear()}`,
      };
    },
  };
}
