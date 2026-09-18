/**
 * THE INSURANCE CARD SLOT — upload it, photograph it, or drop it in.
 *
 * One component, in two modes.
 *
 *   read-only  the slots on the Insurance tab. A card that has been attached
 *              is shown; one that has not says so. Nothing to press.
 *   editable   the slots inside the Add / Edit Insurance popup, which is
 *              where a card is attached, replaced or removed.
 *
 * WHY THE SCREEN IS READ-ONLY. It used to carry the upload controls too, so
 * one plan offered two ways to change its cover — Edit Insurance for the
 * numbers, and four buttons under the cards for the images — and the tab read
 * as a form rather than as the record it is. Everything about a policy is now
 * changed in the one dialog that is named for changing it, and the tab shows
 * what is on file. The modes share this file so the frame, the ID-1 aspect
 * ratio and the PDF treatment cannot drift apart.
 *
 * THREE WAYS IN, AND WHY EACH EXISTS (editable mode only)
 *
 *   The frame    the desktop case, and the primary one. The empty slot IS the
 *                button: pressing it opens the file picker. It used to have a
 *                second "Upload file" button under it opening the same picker,
 *                which is one control too many for one job — see emptySlot().
 *   Take photo   the phone case, and the "scan" path the brief asks for.
 *                It is a second <input> carrying `capture="environment"`,
 *                which opens the rear camera directly rather than the photo
 *                library. It cannot be the same input as the frame's:
 *                `capture` is an instruction, not an option, and an input
 *                carrying it will not offer the file system on a phone at
 *                all. Two inputs is what buys the patient both.
 *   Drag and drop the desktop case again, for a file already on screen.
 *
 * WHY "TAKE PHOTO" IS NOT ALWAYS DRAWN
 *
 * On a desktop, `capture` is ignored and the button opens the same file
 * picker the frame does — a button that does nothing new and lies about a
 * camera while doing it. So it is drawn only where the device plausibly has
 * one pointed at the world: a coarse pointer, which is the closest thing the
 * platform offers to "this is a phone or a tablet". See hasCamera().
 *
 * THE SLOT IS A BUTTON, NOT A DIV WITH A CLICK HANDLER. It is focusable, it
 * responds to Enter and Space, it announces itself, and it says which side of
 * which card it is for — "Upload" four times on one screen is four identical
 * announcements for four different slots.
 */

import { esc } from './format.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import {
  SIDES,
  scanFor,
  saveScan,
  removeScan,
  rejectionFor,
  readableSize,
} from '../../data/insurance-cards.js';

/**
 * Whether to offer "Take photo".
 *
 * A coarse pointer means a finger, which means a phone or a tablet, which
 * means a camera pointed at the world. It is a heuristic and it is the best
 * one available: there is no way to ask "do you have a rear camera" without
 * prompting for permission, and prompting on page load in order to decide
 * whether to draw a button is worse than occasionally drawing one button too
 * few.
 *
 * ⚠ IT DELIBERATELY DOES NOT FEATURE-DETECT `capture`.
 *
 * The obvious extra guard — `'capture' in HTMLInputElement.prototype` —
 * reports FALSE in headless Chrome, and quite possibly in other engines that
 * support the attribute perfectly well. Gating on it meant the button was
 * never drawn anywhere, which is the failure this check was supposed to
 * prevent. The attribute is inert where it is unsupported, so the worst case
 * of trusting the pointer alone is a second button that opens a file picker;
 * the worst case of the feature detect was no camera path at all on the
 * device that needs it most.
 */
export const hasCamera = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * The markup for one slot.
 *
 * @param {object}  options
 * @param {string}  options.planId
 * @param {string}  options.side       'front' or 'back'
 * @param {string}  options.label      'Front of card'
 * @param {boolean} [options.readonly] show the scan without the controls
 */
export function cardSlotMarkup({ planId, side, label, readonly = false }) {
  const scan = scanFor(planId, side);
  const id = `card-${planId}-${side}`;

  // No data-slot in read-only mode. That attribute is what wireCardSlots
  // hooks — a slot without it cannot be clicked open or dropped on, however
  // it is wired, so the read-only mode cannot leak an upload by accident.
  if (readonly) {
    return `
      <div class="pp-card-slot pp-card-slot--static"
        data-plan="${esc(planId)}" data-side="${esc(side)}"
        data-testid="insurance--slot-${esc(side)}">

        <p class="pp-card-slot__label" id="${id}-label">${esc(label)}</p>
        ${scan ? filled(scan, label, true) : missing(label)}
      </div>`;
  }

  return `
    <div class="pp-card-slot" data-slot="${esc(planId)}:${esc(side)}"
      data-plan="${esc(planId)}" data-side="${esc(side)}"
      data-testid="insurance--slot-${esc(side)}">

      <p class="pp-card-slot__label" id="${id}-label">${esc(label)}</p>

      <!--
        The frame is the drop target AND the picker trigger. Rendered as a
        <button> when empty and as a plain figure once filled — a filled slot
        should not re-open the picker on a stray click, because Replace is
        right there and says so.
      -->
      ${scan ? filled(scan, label) : emptySlot(id, label)}

      <p class="pp-field__error" data-slot-error hidden></p>

      <!--
        Two real inputs, visually hidden rather than display:none so they keep
        their labels and stay reachable. accept covers both photographs and a
        PDF scan; capture on the second is what opens the camera.
      -->
      <input class="pp-sr-only" type="file" accept="image/*,application/pdf"
        data-slot-file aria-labelledby="${id}-label"
        data-testid="insurance--file-${esc(side)}" />
      <input class="pp-sr-only" type="file" accept="image/*" capture="environment"
        data-slot-camera aria-labelledby="${id}-label"
        data-testid="insurance--camera-${esc(side)}" />
    </div>`;
}

/**
 * Nothing attached, and nowhere here to attach it.
 *
 * The same frame at the same size as a filled one, so a plan with one side on
 * file does not sit lopsided, and it names the dialog rather than saying only
 * "no image" — a dead end that describes itself is still a dead end.
 */
function missing(label) {
  return `
    <div class="pp-card-slot__frame pp-card-slot__frame--missing"
      data-testid="insurance--slot-empty">
      ${icon('image')}
      <span class="pp-card-slot__hint">No ${esc(label.toLowerCase())} on file</span>
      <span class="pp-card-slot__meta">Add one from Edit Insurance</span>
    </div>`;
}

/**
 * An empty slot: the ID-1 card frame, and how to fill it.
 *
 * THERE IS NO "UPLOAD FILE" BUTTON UNDER THE FRAME. There was, and it opened
 * exactly the file picker the frame opens — the frame IS a <button>, it is the
 * biggest target on the screen, and it already says "Upload or take a photo"
 * and what it accepts. A second control doing the same thing, directly beneath
 * the first, only makes a reader stop to work out how the two differ.
 *
 * Take photo stays where a camera exists, because that one does something the
 * frame does not: it opens the camera rather than the file picker. On a device
 * with no camera the actions row has nothing left to hold, so it is not drawn
 * at all rather than left as an empty gap under every slot.
 */
function emptySlot(id, label) {
  return `
    <button type="button" class="pp-card-slot__frame pp-card-slot__frame--empty"
      data-slot-open aria-describedby="${id}-label"
      aria-label="Upload or take a photo of the ${esc(label.toLowerCase())}">
      ${icon('image')}
      <span class="pp-card-slot__hint">Upload or take a photo</span>
      <span class="pp-card-slot__meta">JPG, PNG or PDF · up to 10MB</span>
    </button>

    ${
      hasCamera()
        ? `<div class="pp-card-slot__actions">
             <button type="button" class="pp-btn pp-btn--outline pp-btn--sm"
               data-slot-camera-open data-testid="insurance--take-photo">
               ${icon('image', { size: 'sm' })}<span>Take photo</span>
               <span class="pp-sr-only"> — ${esc(label)}</span>
             </button>
           </div>`
        : ''
    }`;
}

/** A filled slot: the preview, what it is, and the ways to change it. */
function filled(scan, label, readonly = false) {
  const isPdf = scan.type === 'application/pdf';

  return `
    <figure class="pp-card-slot__frame pp-card-slot__frame--filled">
      ${
        isPdf
          ? `<div class="pp-card-slot__pdf">
               ${icon('file')}
               <span>PDF</span>
             </div>`
          : `<img class="pp-card-slot__image" src="${esc(scan.dataUrl)}"
               alt="${esc(label)}" />`
      }
      <figcaption class="pp-sr-only">${esc(label)} — ${esc(scan.name)}</figcaption>
    </figure>

    <p class="pp-card-slot__file">
      <span class="pp-card-slot__filename" title="${esc(scan.name)}">${esc(scan.name)}</span>
      <span class="pp-card-slot__size">${esc(readableSize(scan.size))}</span>
    </p>

    ${readonly ? '' : changeActions(label)}`;
}

/**
 * The row under a filled slot: swap the image, or take it off the record.
 *
 * Drawn in the dialog only. The Insurance tab renders the same slot with
 * readonly and gets the card without this row — see the head of this file.
 */
function changeActions(label) {
  return `
    <div class="pp-card-slot__actions">
      <button type="button" class="pp-btn pp-btn--outline pp-btn--sm" data-slot-upload
        data-testid="insurance--replace">
        <span>Replace</span><span class="pp-sr-only"> — ${esc(label)}</span>
      </button>
      ${
        hasCamera()
          ? `<button type="button" class="pp-btn pp-btn--outline pp-btn--sm"
               data-slot-camera-open>
               <span>Retake</span><span class="pp-sr-only"> — ${esc(label)}</span>
             </button>`
          : ''
      }
      <button type="button" class="pp-btn pp-btn--quiet pp-btn--sm pp-card-slot__remove"
        data-slot-remove data-testid="insurance--remove-scan">
        <span>Remove</span><span class="pp-sr-only"> — ${esc(label)}</span>
      </button>
    </div>`;
}

/**
 * Every slot for one plan, side by side.
 *
 * @param {string}  planId
 * @param {object}  [options]
 * @param {boolean} [options.readonly] see cardSlotMarkup
 */
export function cardSlotsMarkup(planId, { readonly = false } = {}) {
  return `
    <div class="pp-card-slots" data-card-slots="${esc(planId)}">
      ${SIDES.map((side) =>
        cardSlotMarkup({ planId, side: side.id, label: side.label, readonly })
      ).join('')}
    </div>`;
}

/* ============================================================================
   WIRING
   ========================================================================= */

/**
 * Wire every slot inside `root`, once.
 *
 * One delegated listener set on the container, so slots redrawn after a
 * change do not need rebinding — the same rule the tables follow.
 *
 * @param {HTMLElement} root
 * @param {object}   options
 * @param {Function} [options.onChange] called after a scan is added or removed
 */
export function wireCardSlots(root, { onChange = () => {} } = {}) {
  if (!root || root.dataset.slotsWired === 'true') return;
  root.dataset.slotsWired = 'true';

  const slotOf = (target) => target.closest('[data-slot]');

  root.addEventListener('click', (event) => {
    const slot = slotOf(event.target);
    if (!slot) return;

    if (event.target.closest('[data-slot-open], [data-slot-upload]')) {
      slot.querySelector('[data-slot-file]').click();
      return;
    }

    if (event.target.closest('[data-slot-camera-open]')) {
      slot.querySelector('[data-slot-camera]').click();
      return;
    }

    if (event.target.closest('[data-slot-remove]')) {
      removeScan(slot.dataset.plan, slot.dataset.side);
      onChange(slot.dataset.plan, slot.dataset.side, null);
      toast('Card image removed.');
    }
  });

  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-slot-file], [data-slot-camera]');
    if (!input) return;
    const slot = slotOf(input);
    accept(slot, input.files?.[0], onChange);
    // Cleared so choosing the SAME file twice still fires a change event —
    // otherwise "Replace" with the same photo silently does nothing.
    input.value = '';
  });

  /* --- Drag and drop -------------------------------------------------------
     Desktop only in practice, and additive: everything it does is also
     reachable from the two buttons, so a browser without it loses nothing. */

  root.addEventListener('dragover', (event) => {
    const slot = slotOf(event.target);
    if (!slot) return;
    event.preventDefault();
    slot.dataset.dragging = 'true';
  });

  ['dragleave', 'drop'].forEach((name) =>
    root.addEventListener(name, (event) => {
      const slot = slotOf(event.target);
      if (slot) slot.dataset.dragging = 'false';
    })
  );

  root.addEventListener('drop', (event) => {
    const slot = slotOf(event.target);
    if (!slot) return;
    event.preventDefault();
    accept(slot, event.dataTransfer?.files?.[0], onChange);
  });
}

/**
 * Validate one file, read it, and store it.
 *
 * The whole file is read into a data: URL. That is the expensive part and the
 * reason the size check happens BEFORE the read rather than after: a
 * forty-megabyte photograph should be refused in a millisecond, not after the
 * browser has base64-encoded it.
 */
function accept(slot, file, onChange) {
  const error = slot.querySelector('[data-slot-error]');
  const complain = (message) => {
    error.textContent = message;
    error.hidden = false;
    // Not a toast. The message belongs to this slot, and with four on screen
    // a floating message cannot say which one it is about.
  };

  error.hidden = true;
  error.textContent = '';

  const rejection = rejectionFor(file);
  if (rejection) return void complain(rejection);

  const reader = new FileReader();

  reader.onerror = () =>
    complain('That file could not be read. Try choosing it again.');

  reader.onload = () => {
    const stored = saveScan(slot.dataset.plan, slot.dataset.side, {
      dataUrl: reader.result,
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!stored) {
      // The quota case. Said plainly, because the alternative is a slot that
      // looks filled until the next reload proves it was not.
      complain(
        'There is no room left on this device to keep that image. Remove another card image and try again.'
      );
      return;
    }

    onChange(slot.dataset.plan, slot.dataset.side, file);
    toast(`${file.name} attached.`, 'ok');
  };

  reader.readAsDataURL(file);
}
