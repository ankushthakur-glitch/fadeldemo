/**
 * <ui-main-nav> — the section tabs on the app bar.
 *
 * Attributes
 *   active   id of the current section: dashboard | leads | patient |
 *            schedule | tasks | complications | inventory | communications |
 *            referrals | billing | reports | settings
 *   label    accessible name for the landmark (default "Main")
 *
 * <ui-main-nav active="complications"></ui-main-nav>
 *
 * The list itself is js/lib/main-nav.js and nothing else knows it: a section
 * added, renamed or reordered there shows up on all thirty-odd screens at
 * once. That was the point of the shared renderer, but reaching it meant a
 * screen's module importing it and calling it on an empty <nav> — so most
 * screens never did, and kept a hand-written copy of twelve links instead.
 * Twelve copies of a list is a list that is wrong somewhere.
 *
 * A tag needs no module: js/main.js is on every page, so the markup asks for
 * the nav and the nav appears — the same deal every other ui-* element in
 * this product offers.
 *
 * It renders a real <nav> INSIDE itself rather than putting the role on the
 * host, so the navigation landmark and its label are what a screen reader
 * finds, exactly as they were when the markup was written out by hand. The
 * host is laid out away with `display: contents` (css/components/app-bar.css)
 * so the bar's flex row is unchanged.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { renderMainNav } from '../lib/main-nav.js';

class UiMainNav extends UiElement {
  static observedAttributes = ['active', 'label'];

  render() {
    // Reuse the <nav> across re-renders. Replacing it would throw away the
    // landmark mid-page — and, on a bar narrow enough to scroll, the sideways
    // offset that is holding the current section in view.
    if (!this._nav) {
      this._nav = document.createElement('nav');
      this.replaceChildren(this._nav);
    }
    this._nav.className = 'pt__nav';
    this._nav.setAttribute('aria-label', this.attr('label', 'Main'));
    renderMainNav(this._nav, this.attr('active'));
  }
}

reflectProps(UiMainNav, { active: 'string', label: 'string' });

define('ui-main-nav', UiMainNav);
export { UiMainNav };
