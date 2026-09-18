/**
 * <ui-modal> — dialog with a focus trap and focus return.
 *
 * <ui-modal id="addressCheck" heading="Address Confirmation">
 *   …content…
 *   <div slot="footer">…buttons…</div>
 * </ui-modal>
 *
 *   modal.open(triggerElement)   // focus moves in, page behind is inert
 *   modal.close()                // focus returns to the trigger
 *
 * Esc closes. Tab and Shift+Tab wrap inside the dialog and cannot escape.
 * Events: ui-close
 */
import { UiElement, define, trapFocus } from '../lib/base-element.js';
import { closeOverlays } from '../lib/overlay.js';
import { iconMarkup } from '../lib/icons.js';

/**
 * Every dialog currently on screen.
 *
 * A dialog can now be opened from inside another one — the triage drawer's
 * Check Vitals and Add Medication both open a centred window over it — and the
 * page behind them is held still by one class on <body>. Counted rather than
 * set and cleared, because the inner window closing would otherwise take the
 * lock off while the drawer underneath is still open, and the list behind it
 * would start scrolling under a dialog that is still being filled in.
 */
const openModals = new Set();

function lockScroll(modal) {
  openModals.add(modal);
  document.body.classList.add('ui-scroll-locked');
}

function releaseScroll(modal) {
  openModals.delete(modal);
  if (openModals.size === 0) document.body.classList.remove('ui-scroll-locked');
}

const ICON_FOR = {
  critical: 'critical',
  warning: 'warning',
  success: 'check',
  info: 'info',
  brand: 'info',
};

class UiModal extends UiElement {
  static observedAttributes = ['heading', 'size', 'variant', 'tone', 'icon'];

  connectedCallback() {
    // Move the author's nodes into a fragment rather than copying innerHTML.
    // Re-serialising would hand already-upgraded components their own
    // rendered output as fresh input, and they would nest inside themselves.
    if (this._content === undefined) {
      this._content = document.createDocumentFragment();
      while (this.firstChild) this._content.appendChild(this.firstChild);
    }
    super.connectedCallback();
  }

  /**
   * Attributes are patched in place. This component NEVER re-renders once it
   * has upgraded, and both branches below have to stay that way.
   *
   * render() moves the author's nodes out of a DocumentFragment and into the
   * dialog — and a fragment is emptied by that move. A second render would
   * therefore reinsert nothing and silently blank the dialog. Worse, it
   * rebuilds `.ui-modal` with `hidden` set, so a modal that was open would
   * disappear mid-use and read as "it closed by itself".
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;

    if (name === 'heading') {
      const title = this.querySelector('.ui-modal__title');
      if (title) title.textContent = newValue;
      return;
    }

    if (name === 'size') {
      const dialog = this.querySelector('.ui-modal__dialog');
      if (dialog) {
        dialog.className = `ui-modal__dialog ui-modal__dialog--${newValue || 'md'}`;
      }
      return;
    }

    if (name === 'variant') {
      const shell = this.querySelector('.ui-modal');
      if (shell) {
        shell.classList.toggle('ui-modal--drawer', newValue === 'drawer');
      }
      return;
    }
  }

  render() {
    const heading = this.attr('heading');
    const headingId = `${this.id || 'ui-modal'}-title`;
    const drawer = this.attr('variant') === 'drawer';
    /* A confirmation carries a tinted glyph beside its title. It is the one
       dialog shape where the reader has to grasp the severity before reading
       the sentence — "Delete this note?" and "Note saved" are the same
       eighteen pixels of text otherwise. Plain dialogs set no tone and get no
       badge, because a glyph on every window makes the glyph mean nothing. */
    const tone = this.attr('tone');

    this.innerHTML = `<div class="ui-modal${drawer ? ' ui-modal--drawer' : ''}" hidden>
      <div class="ui-modal__scrim" data-close></div>
      <div class="ui-modal__dialog ui-modal__dialog--${this.attr('size', 'md')}"
           role="dialog" aria-modal="true" aria-labelledby="${headingId}">
        <div class="ui-modal__head">
          ${
            tone
              ? `<span class="ui-modal__icon ui-modal__icon--${tone}" aria-hidden="true">${iconMarkup(
                  this.attr('icon', ICON_FOR[tone] || 'info')
                )}</span>`
              : ''
          }
          <h2 class="ui-modal__title" id="${headingId}">${heading}</h2>
          <button type="button" class="ui-modal__close" data-close aria-label="Close">
            ${iconMarkup('close')}
          </button>
        </div>
        <div class="ui-modal__body"></div>
        <footer class="ui-modal__foot" hidden></footer>
      </div>
    </div>`;

    // Put the author's original nodes back, untouched.
    this.querySelector('.ui-modal__body').appendChild(this._content);
    this.hoistFooter();

    const scrim = this.querySelector('.ui-modal__scrim');

    // Anything explicitly marked closes on a plain click — the × button, and
    // whatever else an author tagged. The scrim is handled separately below.
    this.querySelectorAll('[data-close]').forEach((el) => {
      if (el === scrim) return;
      el.addEventListener('click', () => this.close());
    });

    /*
     * The scrim only dismisses when the press BEGAN on it.
     *
     * A plain click listener here tears the dialog down whenever a click
     * merely ENDS on the scrim — and that happens constantly during ordinary
     * use: releasing a native <select> or date picker whose popup overlaps the
     * backdrop, dragging to select text in a field and letting go past the
     * edge, or any mouseup that drifts off the dialog. To the person filling
     * the form it looks like touching a field closed the window.
     */
    let pressedOnScrim = false;
    scrim.addEventListener('mousedown', (event) => {
      pressedOnScrim = event.target === scrim;
    });
    scrim.addEventListener('click', (event) => {
      const dismiss = pressedOnScrim && event.target === scrim;
      pressedOnScrim = false;
      if (dismiss) this.close();
    });
    // A press that starts anywhere inside the dialog disarms the scrim.
    this.querySelector('.ui-modal__dialog').addEventListener('mousedown', () => {
      pressedOnScrim = false;
    });
  }

  /**
   * Move the action row out of the scrolling body and into the pinned footer.
   *
   * Authors write the row where it reads naturally — at the end of their form —
   * and it lands here, so the commit stays on screen however long the content
   * gets. Anything marked `.ui-modal__actions` or `slot="footer"` qualifies.
   *
   * Called on every open as well as at render, because a dialog whose body is
   * rebuilt each time (a detail panel, say) creates its row after first paint.
   */
  hoistFooter() {
    const body = this.querySelector('.ui-modal__body');
    const foot = this.querySelector('.ui-modal__foot');
    if (!body || !foot) return;

    // Only a row still sitting in the body needs moving. A row already hoisted
    // stays where it is — re-running this must not empty the footer it filled
    // on the previous open.
    const actions = body.querySelector('.ui-modal__actions, [slot="footer"]');
    if (actions) foot.replaceChildren(actions);
    foot.hidden = !foot.firstElementChild;
  }

  open(trigger) {
    /* Also on the way in: a panel left open on the page underneath would
       otherwise sit on top of the scrim, above the dialog. */
    closeOverlays();

    this.hoistFooter();
    // Remember where focus came from so it can go back on close.
    this._returnFocusTo = trigger || document.activeElement;
    this.querySelector('.ui-modal').hidden = false;
    lockScroll(this);

    const dialog = this.querySelector('.ui-modal__dialog');
    this._releaseTrap = trapFocus(dialog, () => this.close());

    // Focus the first thing a user would actually want, not the close button.
    const first = dialog.querySelector(
      'input:not([disabled]),select:not([disabled]),textarea,button:not([data-close])'
    );
    (first || dialog.querySelector('.ui-modal__close')).focus();
  }

  close() {
    /* Any dropdown, calendar or row menu opened from inside this dialog is
       parented to <body>, not to the dialog — so it does not go when the
       dialog goes. Nothing else is watching for that, which is how a calendar
       ends up hovering over an empty page. */
    closeOverlays();

    if (this.querySelector('.ui-modal').hidden) return;
    this.querySelector('.ui-modal').hidden = true;
    releaseScroll(this);
    this._releaseTrap?.();
    this._returnFocusTo?.focus();
    this.emit('ui-close', {});
  }

  get isOpen() {
    return this.querySelector('.ui-modal')?.hidden === false;
  }
}

define('ui-modal', UiModal);
export { UiModal };
