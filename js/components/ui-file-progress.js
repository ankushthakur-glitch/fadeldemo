/**
 * <ui-file-progress> — one file, and what is happening to it.
 *
 * Attributes
 *   name       the file name
 *   thumbnail  preview image URL
 *   size       file size label, shown when idle or complete
 *   status     uploaded | uploading | complete | error   (default uploaded)
 *   progress   0–100, while uploading
 *   meta       trailing detail, e.g. "60% · 12s left"
 *   error      the message shown in the error state
 *
 * Events
 *   ui-menu  the kebab was clicked
 *
 * <ui-file-progress name="colonoscopy-report.pdf" status="uploading"
 *   progress="60" meta="12s left"></ui-file-progress>
 *
 * Four states share one row so nothing jumps as an upload runs: the bar
 * replaces the size while uploading, the message replaces it on failure.
 * Composes <ui-progress-bar> rather than drawing a second track.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

class UiFileProgress extends UiElement {
  static observedAttributes = [
    'name',
    'thumbnail',
    'size',
    'status',
    'progress',
    'meta',
    'error',
  ];

  render() {
    const name = this.attr('name');
    const thumbnail = this.attr('thumbnail');
    const size = this.attr('size');
    const status = this.attr('status', 'uploaded');
    const progress = this.attr('progress', '0');
    const meta = this.attr('meta');
    const error = this.attr('error');

    const thumb =
      status === 'error'
        ? iconMarkup('critical')
        : status === 'complete'
          ? iconMarkup('check')
          : thumbnail
            ? `<img class="ui-file-progress__img" src="${thumbnail}" alt="">`
            : iconMarkup('image');

    const detail =
      status === 'uploading'
        ? `<div class="ui-file-progress__track">
             <ui-progress-bar value="${progress}" size="sm"
               aria-label="Uploading ${name}"></ui-progress-bar>
             ${meta ? `<span class="ui-file-progress__meta">${meta}</span>` : ''}
           </div>`
        : status === 'error'
          ? `<p class="ui-file-progress__error">${error}</p>`
          : size
            ? `<p class="ui-file-progress__size">${size}</p>`
            : '';

    this.innerHTML = `<div class="ui-file-progress ui-file-progress--${status}">
      <span class="ui-file-progress__thumb" aria-hidden="true">${thumb}</span>
      <div class="ui-file-progress__body">
        <p class="ui-file-progress__name" title="${name}">${name}</p>
        ${detail}
      </div>
      <button type="button" class="ui-file-progress__menu"
        aria-haspopup="menu" aria-label="Options for ${name}">
        ${iconMarkup('more-vertical')}
      </button>
    </div>`;

    this.querySelector('.ui-file-progress__menu').addEventListener('click', () =>
      this.emit('ui-menu', { name })
    );
  }
}

reflectProps(UiFileProgress, {
  name: 'string',
  thumbnail: 'string',
  size: 'string',
  status: 'string',
  progress: 'string',
  meta: 'string',
  error: 'string',
});

define('ui-file-progress', UiFileProgress);
export { UiFileProgress };
