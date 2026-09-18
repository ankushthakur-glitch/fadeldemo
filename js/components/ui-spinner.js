/**
 * <ui-spinner> — "this is still happening".
 *
 * Attributes
 *   size   sm | md | lg   (default md — 16 / 24 / 40)
 *   label  what is happening; announced, and used as the accessible name
 *
 * <ui-spinner size="lg" label="Checking eligibility"></ui-spinner>
 *
 * There was one hand-rolled spinner in the product — a Phosphor glyph with a
 * private keyframe in the billing stylesheet — beside two other loading
 * treatments that were already components: the button's own busy state and the
 * data table's skeleton rows. Three ways to say the same thing, one of them
 * unavailable to any screen but the one that wrote it.
 *
 * WHICH LOADER TO REACH FOR
 *   ui-button[loading]    an action you just took is running
 *   ui-data-table         rows are coming; the skeleton keeps the layout still
 *   ui-progress-bar       you can say how far along it is
 *   ui-spinner            none of the above — a panel waiting on a response
 *
 * A spinner with no label is a spinner nobody can hear. `label` is not
 * optional in practice: role="status" with an empty name announces nothing,
 * which is worse than the silence it looks like it is fixing.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiSpinner extends UiElement {
  static observedAttributes = ['size', 'label'];

  render() {
    const size = this.attr('size', 'md');
    const label = this.attr('label');

    this.innerHTML = `<span class="ui-spinner ui-spinner--${size}"
      role="status"${label ? ` aria-label="${label}"` : ' aria-hidden="true"'}>
      ${iconMarkup('spinner', 'ui-icon ui-spinner__mark')}
    </span>`;
  }
}

reflectProps(UiSpinner, { size: 'string', label: 'string' });

define('ui-spinner', UiSpinner);
export { UiSpinner };
