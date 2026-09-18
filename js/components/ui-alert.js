/**
 * <ui-alert> — inline banner for allergies, result notifications, warnings.
 *
 * Attributes
 *   severity     critical | warning | success | info | neutral   (default info)
 *   heading      bold first line
 *   actions      comma-separated action labels, rendered under the text
 *   dismissible  shows a close button
 *
 * Events
 *   ui-close   fires when dismissed; call preventDefault() to keep it open
 *   ui-action  { action }  one of the action labels was clicked
 *
 * <ui-alert severity="critical" heading="Allergy — Penicillin" dismissible>
 *   Documented anaphylaxis. Verify before prescribing.
 * </ui-alert>
 *
 * Critical and warning alerts get role="alert" so screen readers announce
 * them immediately; the quieter ones use role="status".
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

/* Neutral is deliberately absent: it is the tone for a message that is
   neither good nor bad news — a maintenance note, a "this record is
   read-only" — and giving it a status glyph would have it claim a severity it
   does not have. */
const ICON_FOR = {
  critical: 'critical',
  warning: 'warning',
  success: 'check',
  info: 'info',
};

class UiAlert extends UiElement {
  static observedAttributes = ['severity', 'heading', 'actions', 'dismissible'];

  connectedCallback() {
    if (this._message === undefined) this._message = this.innerHTML.trim();
    super.connectedCallback();
  }

  render() {
    const severity = this.attr('severity', 'info');
    const heading = this.attr('heading');
    const urgent = severity === 'critical' || severity === 'warning';
    const icon = ICON_FOR[severity];
    // The actions row sits UNDER the text, not beside it: the buttons are a
    // response to what the alert says, and a reader who has not finished the
    // sentence cannot yet choose between them.
    const actions = this.attr('actions')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);

    this.innerHTML = `<div class="ui-alert ui-alert--${severity}"
      role="${urgent ? 'alert' : 'status'}">
      ${icon ? `<span class="ui-alert__icon">${iconMarkup(icon)}</span>` : ''}
      <div class="ui-alert__body">
        ${heading ? `<span class="ui-alert__title">${heading}</span>` : ''}
        ${this._message ? `<span class="ui-alert__message">${this._message}</span>` : ''}
        ${
          actions.length
            ? `<div class="ui-alert__actions">${actions
                .map(
                  (label, index) =>
                    `<ui-text-link size="sm" variant="${
                      index === 0 && severity === 'critical' ? 'critical' : 'default'
                    }" data-action="${label}">${label}</ui-text-link>`
                )
                .join('')}</div>`
            : ''
        }
      </div>
      ${
        this.boolAttr('dismissible')
          ? `<button type="button" class="ui-alert__close" aria-label="Dismiss">${iconMarkup(
              'close'
            )}</button>`
          : ''
      }
    </div>`;

    this.querySelectorAll('[data-action]').forEach((link) => {
      link.addEventListener('ui-click', () =>
        this.emit('ui-action', { action: link.dataset.action })
      );
    });

    this.querySelector('.ui-alert__close')?.addEventListener('click', () => {
      const event = this.emit('ui-close', { severity });
      if (!event.defaultPrevented) this.remove();
    });
  }
}

reflectProps(UiAlert, {
  severity: 'string',
  heading: 'string',
  actions: 'string',
  dismissible: 'boolean',
});

define('ui-alert', UiAlert);
export { UiAlert };
