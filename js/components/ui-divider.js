/**
 * <ui-divider> — a rule between two things.
 *
 * Attributes
 *   orientation  horizontal | vertical   (default horizontal)
 *   label        centred text; horizontal only
 *   line         solid | dashed          (default solid)
 *   inset        pull the rule in from the container edges
 *
 * <ui-divider></ui-divider>
 * <ui-divider label="Yesterday"></ui-divider>
 * <ui-divider orientation="vertical"></ui-divider>
 *
 * The labelled variant is deliberately NOT role="separator": ARIA says a
 * separator carries no meaningful text, so a labelled rule is a plain
 * container and the two line segments either side do the visual work.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

class UiDivider extends UiElement {
  static observedAttributes = ['orientation', 'label', 'line', 'inset'];

  render() {
    const vertical = this.attr('orientation') === 'vertical';
    const label = this.attr('label');
    const modifiers = [
      this.attr('line') === 'dashed' && 'ui-divider--dashed',
      this.boolAttr('inset') && 'ui-divider--inset',
    ]
      .filter(Boolean)
      .join(' ');

    if (vertical) {
      this.innerHTML = `<span class="ui-divider ui-divider--vertical ${modifiers}"
        role="separator" aria-orientation="vertical"></span>`;
      return;
    }

    if (label) {
      this.innerHTML = `<div class="ui-divider ui-divider--labelled ${modifiers}">
        <span class="ui-divider__line"></span>
        <span class="ui-divider__label">${label}</span>
        <span class="ui-divider__line"></span>
      </div>`;
      return;
    }

    this.innerHTML = `<hr class="ui-divider ui-divider--horizontal ${modifiers}">`;
  }
}

reflectProps(UiDivider, {
  orientation: 'string',
  label: 'string',
  line: 'string',
  inset: 'boolean',
});

define('ui-divider', UiDivider);
export { UiDivider };
