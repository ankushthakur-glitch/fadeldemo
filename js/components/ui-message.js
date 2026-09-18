/**
 * <ui-message> — the chat composer.
 *
 * Attributes
 *   placeholder
 *   value
 *   maxlength  when set, shows a live character count
 *   error      message shown under the box; also marks the field invalid
 *   disabled
 *
 * Events
 *   ui-input   on every keystroke, { value }
 *   ui-send    the send button or ⌘/Ctrl+Enter, { value }
 *   ui-attach  the paperclip was clicked
 *
 * <ui-message placeholder="Message Dr Okafor…" maxlength="500"></ui-message>
 *
 * The textarea and its toolbar share one bordered box, and the box takes the
 * focus ring through :focus-within so the whole composer lights up rather than
 * just the field inside it. Send stays disabled while the box is empty —
 * sending nothing is never what anyone meant.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

let composerSeq = 0;

class UiMessage extends UiElement {
  static observedAttributes = [
    'placeholder',
    'value',
    'maxlength',
    'error',
    'disabled',
  ];

  render() {
    const placeholder = this.attr('placeholder', 'Your message…');
    const value = this.attr('value');
    const maxlength = this.attr('maxlength');
    const error = this.attr('error');
    const disabled = this.boolAttr('disabled');
    const id = (this._id ||= `ui-message-${++composerSeq}`);

    const describedBy = [error && `${id}-error`, maxlength && `${id}-count`]
      .filter(Boolean)
      .join(' ');

    const boxClasses = [
      'ui-message__box',
      error && 'ui-message__box--error',
      disabled && 'ui-message__box--disabled',
    ]
      .filter(Boolean)
      .join(' ');

    this.innerHTML = `<div class="ui-message">
      <div class="${boxClasses}">
        <textarea id="${id}" class="ui-message__input" rows="2"
          placeholder="${placeholder}" ${maxlength ? `maxlength="${maxlength}"` : ''}
          ${disabled ? 'disabled' : ''} ${error ? 'aria-invalid="true"' : ''}
          ${describedBy ? `aria-describedby="${describedBy}"` : ''}>${value}</textarea>
        <div class="ui-message__toolbar">
          <div class="ui-message__actions">
            <ui-button variant="tertiary" size="xs" icon="plus" icon-only
              label="Add" ${disabled ? 'disabled' : ''}></ui-button>
            <ui-button variant="tertiary" size="xs" icon="paperclip" icon-only
              label="Attach file" data-attach ${disabled ? 'disabled' : ''}></ui-button>
          </div>
          <ui-button variant="primary" size="xs" icon="send" icon-only
            label="Send message" data-send disabled></ui-button>
        </div>
      </div>
      ${
        error || maxlength
          ? `<div class="ui-message__footer">
               ${error ? `<p id="${id}-error" class="ui-message__error" role="alert">${error}</p>` : ''}
               ${
                 maxlength
                   ? `<span id="${id}-count" class="ui-message__counter">${value.length}/${maxlength}</span>`
                   : ''
               }
             </div>`
          : ''
      }
    </div>`;

    const field = this.querySelector('textarea');
    const send = this.querySelector('[data-send]');
    const counter = this.querySelector('.ui-message__counter');

    const sync = () => {
      const text = field.value;
      // Repaint in place: a full render would replace the textarea and the
      // caret would jump back to the start on every keystroke.
      send.toggleAttribute('disabled', disabled || !text.trim());
      if (counter) counter.textContent = `${text.length}/${maxlength}`;
    };
    sync();

    field.addEventListener('input', () => {
      sync();
      this.emit('ui-input', { value: field.value });
    });

    const fire = () => {
      if (!field.value.trim()) return;
      this.emit('ui-send', { value: field.value });
    };

    send.addEventListener('ui-click', fire);

    // ⌘/Ctrl+Enter sends. Plain Enter must stay a newline: a clinical message
    // is usually more than one line, and sending half of one is unrecoverable.
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        fire();
      }
    });

    this.querySelector('[data-attach]').addEventListener('ui-click', () =>
      this.emit('ui-attach', {})
    );
  }
}

reflectProps(UiMessage, {
  placeholder: 'string',
  value: 'string',
  maxlength: 'string',
  error: 'string',
  disabled: 'boolean',
});

define('ui-message', UiMessage);
export { UiMessage };
