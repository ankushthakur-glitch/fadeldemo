/**
 * <ui-tooltip> — a short note attached to its trigger.
 *
 * Attributes
 *   content    the tooltip text
 *   placement  top | bottom | left | right   (default top)
 *
 * <ui-tooltip content="Signed 14 Aug by Dr Okafor" placement="right">
 *   <button type="button">Details</button>
 * </ui-tooltip>
 *
 * Shown on hover AND on focus, because a keyboard user has no hover. The
 * bubble is aria-describedby'd from the trigger rather than being its label: a
 * tooltip explains a control that already has a name, and must never be the
 * only place that name exists. Escape hides it while focus stays put, so a
 * bubble covering what you are reading is not a trap.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

let tooltipSeq = 0;

class UiTooltip extends UiElement {
  static observedAttributes = ['content', 'placement'];

  connectedCallback() {
    if (this._trigger === undefined) this._trigger = this.innerHTML.trim();
    super.connectedCallback();
  }

  render() {
    const content = this.attr('content');
    const placement = this.attr('placement', 'top');
    const id = (this._id ||= `ui-tooltip-${++tooltipSeq}`);

    this.innerHTML = `<span class="ui-tooltip ui-tooltip--${placement}">
      <span class="ui-tooltip__trigger" aria-describedby="${id}">${this._trigger}</span>
      <span class="ui-tooltip__bubble" role="tooltip" id="${id}">${content}
        <span class="ui-tooltip__arrow" aria-hidden="true"></span>
      </span>
    </span>`;

    const root = this.firstElementChild;

    // Escape only suppresses the bubble until the pointer or focus leaves and
    // comes back — otherwise the note would be gone for the rest of the page.
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') root.classList.add('ui-tooltip--dismissed');
    });
    const clear = () => root.classList.remove('ui-tooltip--dismissed');
    this.addEventListener('mouseleave', clear);
    this.addEventListener('focusout', clear);
  }
}

reflectProps(UiTooltip, { content: 'string', placement: 'string' });

define('ui-tooltip', UiTooltip);
export { UiTooltip };
