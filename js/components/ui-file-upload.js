/**
 * <ui-file-upload> — the MediNova "Fileuploader with label" component.
 *
 * <ui-file-upload
 *   label="Front Side"
 *   accept=".png,.jpg"
 *   hint="Nulla in urna elementum."
 *   hint-position="bottom">
 * </ui-file-upload>
 *
 * A dashed dropzone with an icon, a browse link and a format caption.
 * Drag-and-drop and click-to-browse both work; the chosen file replaces the
 * prompt so the user can see what is attached.
 *
 * Events: ui-change with detail { name, size, file }
 *
 * `file` is the File itself, for the screens that have to read what was
 * dropped rather than just acknowledge it — the Master CSV import, say.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

class UiFileUpload extends UiElement {
  static observedAttributes = [
    'label', 'accept', 'max-size', 'hint', 'hint-position', 'required', 'disabled',
  ];

  render() {
    const id = this._id || (this._id = `ui-upload-${++uid}`);
    const label = this.attr('label');
    const hint = this.attr('hint');
    const hintOnTop = this.attr('hint-position') === 'top';
    const accept = this.attr('accept', '.png,.jpg');
    const maxSize = this.attr('max-size', '5MB');

    const hintMarkup = hint ? `<p class="ui-field__hint">${hint}</p>` : '';

    this.innerHTML = `<div class="ui-field">
      ${label ? `<div class="ui-field__label-row">
        <label class="ui-field__label" for="${id}">${label}${
          this.boolAttr('required')
            ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
            : ''
        }</label>
      </div>` : ''}
      ${hintOnTop ? hintMarkup : ''}
      <div class="ui-upload${this.boolAttr('disabled') ? ' ui-upload--disabled' : ''}">
        <input id="${id}" class="ui-upload__input" type="file" accept="${accept}"
          ${this.boolAttr('disabled') ? 'disabled' : ''}>
        <span class="ui-upload__icon">${iconMarkup('document')}</span>
        <p class="ui-upload__prompt">
          Drop your document here, or <span class="ui-upload__browse">click to browse</span>
        </p>
        <p class="ui-upload__meta">${accept.split(',').join(', ')}, up to ${maxSize}.</p>
      </div>
      ${hintOnTop ? '' : hintMarkup}
    </div>`;

    const zone = this.querySelector('.ui-upload');
    const input = this.querySelector('input');

    input.addEventListener('change', () => this.#accept(input.files[0]));

    // Drag and drop. preventDefault on dragover is what allows a drop at all.
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('ui-upload--over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('ui-upload--over'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('ui-upload--over');
      this.#accept(event.dataTransfer?.files?.[0]);
    });
  }

  #accept(file) {
    if (!file) return;
    const prompt = this.querySelector('.ui-upload__prompt');
    prompt.textContent = file.name;
    this.querySelector('.ui-upload').classList.add('ui-upload--filled');
    this.emit('ui-change', { name: file.name, size: file.size, file });
  }
}

reflectProps(UiFileUpload, {
  label: 'string', accept: 'string', 'max-size': 'string',
  hint: 'string', 'hint-position': 'string',
  required: 'boolean', disabled: 'boolean',
});

define('ui-file-upload', UiFileUpload);
export { UiFileUpload };
