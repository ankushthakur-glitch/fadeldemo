/**
 * <ui-toast> and <ui-notification-toast> — cards that float over the window.
 *
 * Two shapes from one family, kept in one file because neither is more than a
 * few lines. ui-toast leads with a status icon and REPORTS ("Note signed").
 * ui-notification-toast has no icon and ends in text-link actions, because it
 * ASKS ("Dr Okafor shared a chart — View / Dismiss").
 *
 * <ui-toast variant="success" heading="Note signed" dismissible>
 *   Encounter 4412 is now part of the record.
 * </ui-toast>
 *
 * <ui-notification-toast heading="Chart shared" actions="View,Dismiss" dismissible>
 *   Dr Okafor shared Priya Raman's chart with you.
 * </ui-notification-toast>
 *
 * Both are role="status" / aria-live="polite": a toast reports on something
 * already finished, so it must not interrupt whatever is being read out.
 * Anything urgent enough to interrupt belongs in <ui-alert>, not here.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

const ICON_FOR = {
  brand: 'info',
  success: 'check',
  warning: 'warning',
  critical: 'critical',
  neutral: 'info',
};

class UiToast extends UiElement {
  static observedAttributes = ['variant', 'heading', 'icon', 'dismissible'];

  connectedCallback() {
    if (this._message === undefined) this._message = this.innerHTML.trim();
    super.connectedCallback();
  }

  render() {
    const variant = this.attr('variant', 'brand');
    const heading = this.attr('heading');
    const icon = this.attr('icon', ICON_FOR[variant] || 'info');
    const showIcon = icon !== 'none';

    this.innerHTML = `<div class="ui-toast ui-toast--${variant}"
      role="status" aria-live="polite" aria-atomic="true">
      ${showIcon ? `<span class="ui-toast__icon" aria-hidden="true">${iconMarkup(icon)}</span>` : ''}
      <div class="ui-toast__body">
        ${heading ? `<p class="ui-toast__title">${heading}</p>` : ''}
        ${this._message ? `<div class="ui-toast__desc">${this._message}</div>` : ''}
      </div>
      ${
        this.boolAttr('dismissible')
          ? `<button type="button" class="ui-toast__close" aria-label="Dismiss">${iconMarkup(
              'close'
            )}</button>`
          : ''
      }
    </div>`;

    this.querySelector('.ui-toast__close')?.addEventListener('click', () => {
      const event = this.emit('ui-close', { variant });
      if (!event.defaultPrevented) this.remove();
    });
  }
}

reflectProps(UiToast, {
  variant: 'string',
  heading: 'string',
  icon: 'string',
  dismissible: 'boolean',
});

define('ui-toast', UiToast);

/* --- ui-notification-toast ------------------------------------------------ */

class UiNotificationToast extends UiElement {
  static observedAttributes = ['heading', 'actions', 'dismissible'];

  connectedCallback() {
    if (this._message === undefined) this._message = this.innerHTML.trim();
    super.connectedCallback();
  }

  render() {
    const heading = this.attr('heading');
    // Comma-separated so a notification can be authored in plain HTML. The
    // rightmost action is the one the reader is most likely to want.
    const actions = this.attr('actions')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);

    this.innerHTML = `<div class="ui-notif-toast"
      role="status" aria-live="polite" aria-atomic="true">
      <div class="ui-notif-toast__body">
        ${heading ? `<p class="ui-notif-toast__title">${heading}</p>` : ''}
        ${this._message ? `<div class="ui-notif-toast__desc">${this._message}</div>` : ''}
      </div>
      ${
        actions.length
          ? `<div class="ui-notif-toast__actions">${actions
              .map(
                (label, index) =>
                  `<ui-text-link size="sm" variant="${
                    index === actions.length - 1 ? 'default' : 'muted'
                  }" data-action="${label}">${label}</ui-text-link>`
              )
              .join('')}</div>`
          : ''
      }
      ${
        this.boolAttr('dismissible')
          ? `<button type="button" class="ui-notif-toast__close" aria-label="Dismiss">${iconMarkup(
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

    this.querySelector('.ui-notif-toast__close')?.addEventListener('click', () => {
      const event = this.emit('ui-close', {});
      if (!event.defaultPrevented) this.remove();
    });
  }
}

reflectProps(UiNotificationToast, {
  heading: 'string',
  actions: 'string',
  dismissible: 'boolean',
});

define('ui-notification-toast', UiNotificationToast);
export { UiToast, UiNotificationToast };
