/**
 * <ui-tabs> — tab strip following the ARIA tabs pattern.
 *
 * <ui-tabs selected="patient">
 *   <ui-tab value="patient" label="Patient Info"></ui-tab>
 *   <ui-tab value="insurance" label="Insurance"></ui-tab>
 * </ui-tabs>
 *
 * Panels live outside the component and are matched by id:
 *   <div id="panel-patient" role="tabpanel">…</div>
 *
 * Add `vertical` for a strip that stacks down the side instead of across the
 * top. That is not only a layout change: the ARIA tabs pattern says a
 * vertical tablist announces aria-orientation="vertical" and is driven by
 * Up/Down rather than Left/Right, so the attribute changes both.
 *
 *   <ui-tabs selected="unsigned" vertical> … </ui-tabs>
 *
 * TWO LEVELS, AND ONLY TWO. Which one a strip uses is decided by where it
 * sits, never by taste:
 *
 *   `primary`   the screen's own sections, on the page header row. Segments
 *               with their own surface, so the strip needs no rule of its own
 *               and can be vertically centred beside a search field and a
 *               button. One per screen.
 *
 *   (default)   secondary — a switch between lists INSIDE one of those
 *               sections. An underline, which is quieter than a segment and
 *               reads as "same page, different rows".
 *
 * A secondary strip drawn INSIDE a panel's own edge — the Scheduler's
 * Unsigned / Signed, the portal's Current / Past — is still the secondary
 * level; it is only wearing another shape, a pill on a sunk track, given to it
 * by the screen that hosts it (see .sch__subtabs in css/screen-scheduler.css).
 * The level has not changed and neither has this file: what makes the pair
 * legible is that the two shapes are different, not that one is smaller. An
 * underline needs a rule running the width of what it labels to read as an
 * edge, and there is no such width inside a card.
 *
 *   <ui-tabs selected="in" primary>
 *     <ui-tab value="in" label="Document In"></ui-tab>
 *   </ui-tabs>
 *
 * Two strips of the same level on one screen have no hierarchy between them
 * and the eye cannot tell which one moves it further — that is the whole
 * reason the levels are named after their position rather than their shape.
 *
 * A TAB IS A PLACE, NOT A TALLY. The strip used to take a `count` and draw a
 * numeric chip after the label; it no longer does, and there is no setCount().
 * A number on a tab has to be read before the label it is attached to means
 * anything, and it was never the number anyone came for — the list under the
 * tab is already the answer, at full detail, the moment you press it.
 *
 * Keyboard: Left/Right (or Up/Down when vertical) move between tabs, Home/End
 * jump to the ends — the roving-tabindex pattern, so Tab enters and leaves the
 * strip once.
 *
 * Events: ui-change with detail { value }
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiTabs extends UiElement {
  static observedAttributes = ['selected', 'vertical', 'primary'];

  connectedCallback() {
    if (this._tabs === undefined) {
      this._tabs = [...this.querySelectorAll('ui-tab')].map((tab) => ({
        value: tab.getAttribute('value'),
        label: tab.getAttribute('label'),
        icon: tab.getAttribute('icon'),
      }));
    }
    super.connectedCallback();
  }

  /**
   * Selecting a tab only changes state — it must NOT rebuild the strip.
   * Re-rendering would replace the very button the user is arrowing through
   * and focus would be lost to the body mid-keystroke.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;
    if (name === 'selected') this.#update(newValue);
    else this.render();
  }

  #update(selected) {
    for (const button of this.querySelectorAll('[role="tab"]')) {
      const isSelected = button.dataset.value === selected;
      button.classList.toggle('ui-tabs__tab--selected', isSelected);
      button.setAttribute('aria-selected', String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
    }
    this.#syncPanels(selected);
  }

  render() {
    const selected = this.attr('selected', this._tabs[0]?.value);
    const vertical = this.hasAttribute('vertical');
    const modifiers = [
      vertical && 'ui-tabs--vertical',
      this.hasAttribute('primary') && 'ui-tabs--primary',
    ]
      .filter(Boolean)
      .join(' ');

    this.innerHTML = `<div class="ui-tabs${modifiers ? ` ${modifiers}` : ''}"
      role="tablist"${vertical ? ' aria-orientation="vertical"' : ''}>
      ${this._tabs
        .map((tab) => {
          const isSelected = tab.value === selected;
          return `<button type="button" role="tab"
            id="tab-${tab.value}"
            class="ui-tabs__tab${isSelected ? ' ui-tabs__tab--selected' : ''}"
            aria-selected="${isSelected}"
            aria-controls="panel-${tab.value}"
            tabindex="${isSelected ? '0' : '-1'}"
            data-value="${tab.value}">${
              tab.icon ? iconMarkup(tab.icon) : ''
            }<span class="ui-tabs__label">${tab.label}</span></button>`;
        })
        .join('')}
    </div>`;

    const buttons = [...this.querySelectorAll('[role="tab"]')];

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => this.#select(button.dataset.value));

      button.addEventListener('keydown', (event) => {
        // Only the axis the strip is laid out on moves between tabs. A
        // vertical strip that answered Left/Right would be stealing keys the
        // page around it may want.
        const moves = vertical
          ? { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: buttons.length - 1 }
          : { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 };
        const next = moves[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const target = buttons[(next + buttons.length) % buttons.length];
        target.focus();
        this.#select(target.dataset.value);
      });
    });

    this.#syncPanels(selected);
  }

  #select(value) {
    if (value === this.attr('selected')) return;
    this.setAttribute('selected', value);
    this.emit('ui-change', { value });
  }

  /** Show the matching panel, hide the rest. Panels live outside this tag. */
  #syncPanels(selected) {
    for (const tab of this._tabs) {
      const panel = document.getElementById(`panel-${tab.value}`);
      if (panel) panel.hidden = tab.value !== selected;
    }
  }

  get selected() { return this.attr('selected'); }
  set selected(value) { this.setAttribute('selected', value); }
}

reflectProps(UiTabs, { selected: 'string' });
define('ui-tabs', UiTabs);

/** Config-only element. Never renders anything itself. */
class UiTab extends HTMLElement {}
define('ui-tab', UiTab);

export { UiTabs, UiTab };
