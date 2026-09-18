/**
 * <ui-date-picker> — a month grid for choosing one date.
 *
 * Attributes
 *   value       selected date, ISO yyyy-mm-dd
 *   min, max    selectable range, inclusive, ISO yyyy-mm-dd
 *   month       month to show first, ISO yyyy-mm-dd; defaults to value or today
 *   hide-today  drop the "Today" shortcut
 *
 * Events
 *   ui-change  { value, date }
 *
 * <ui-date-picker value="2026-08-19" min="2026-01-01"></ui-date-picker>
 *
 * Roving tabindex, not one tab stop per day: 42 cells would otherwise cost 42
 * presses to get past. One day is reachable with Tab, the arrows move inside
 * the grid, PageUp/PageDown change month, Home/End go to the ends of the week,
 * and stepping past the edge of a month pulls the next one into view.
 *
 * Monday-start, because that is what a clinic week is.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** yyyy-mm-dd → Date at local midnight. Returns null for anything unparsable. */
function parseISO(text) {
  if (!text) return null;
  const [year, month, day] = text.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Date → yyyy-mm-dd, built by hand so a timezone never shifts the day. */
function toISO(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function sameDay(a, b) {
  return a && b && toISO(a) === toISO(b);
}

class UiDatePicker extends UiElement {
  static observedAttributes = ['value', 'min', 'max', 'month', 'hide-today'];

  render() {
    const selected = parseISO(this.attr('value'));
    const min = parseISO(this.attr('min'));
    const max = parseISO(this.attr('max'));
    const today = new Date();

    const anchor =
      this._view || selected || parseISO(this.attr('month')) || today;
    const year = anchor.getFullYear();
    const month = anchor.getMonth();

    this._focus ||= selected || new Date(year, month, 1);

    // A 6×7 grid always, so the picker never changes height between months.
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const cells = Array.from(
      { length: 42 },
      (_, i) => new Date(year, month, 1 - lead + i)
    );

    const disabled = (date) =>
      (min && date < min) || (max && date > max);

    const weeks = Array.from({ length: 6 }, (_, w) =>
      cells.slice(w * 7, w * 7 + 7)
    );

    this.innerHTML = `<div class="ui-datepicker">
      <div class="ui-datepicker__header">
        <button type="button" class="ui-datepicker__nav ui-datepicker__nav--year"
          data-shift="-12" aria-label="Previous year">
          ${iconMarkup('caret-left')}${iconMarkup('caret-left')}
        </button>
        <button type="button" class="ui-datepicker__nav" data-shift="-1"
          aria-label="Previous month">${iconMarkup('caret-left')}</button>
        <span class="ui-datepicker__title" aria-live="polite">${MONTHS[month]} ${year}</span>
        <button type="button" class="ui-datepicker__nav" data-shift="1"
          aria-label="Next month">${iconMarkup('caret-right')}</button>
        <button type="button" class="ui-datepicker__nav ui-datepicker__nav--year"
          data-shift="12" aria-label="Next year">
          ${iconMarkup('caret-right')}${iconMarkup('caret-right')}
        </button>
      </div>

      <div class="ui-datepicker__grid" role="grid">
        <div class="ui-datepicker__weekdays" role="row">
          ${WEEKDAYS.map(
            (day) => `<span class="ui-datepicker__weekday" role="columnheader">${day}</span>`
          ).join('')}
        </div>
        ${weeks
          .map(
            (week) => `<div class="ui-datepicker__week" role="row">
            ${week
              .map((date) => {
                const iso = toISO(date);
                const isSelected = sameDay(date, selected);
                const classes = [
                  'ui-datepicker__day',
                  date.getMonth() !== month && 'ui-datepicker__day--outside',
                  sameDay(date, today) && !isSelected && 'ui-datepicker__day--today',
                  isSelected && 'ui-datepicker__day--selected',
                ]
                  .filter(Boolean)
                  .join(' ');

                return `<div role="gridcell" aria-selected="${isSelected}">
                  <button type="button" class="${classes}" data-date="${iso}"
                    tabindex="${sameDay(date, this._focus) ? 0 : -1}"
                    ${disabled(date) ? 'disabled' : ''}
                    ${isSelected ? 'aria-current="date"' : ''}>${date.getDate()}</button>
                </div>`;
              })
              .join('')}
          </div>`
          )
          .join('')}
      </div>

      ${
        this.boolAttr('hide-today')
          ? ''
          : `<div class="ui-datepicker__footer">
               <button type="button" class="ui-datepicker__today">Today</button>
             </div>`
      }
    </div>`;

    /* Move the roving focus, pulling the view along if it crosses a month. */
    const moveTo = (date) => {
      this._focus = date;
      this._view = new Date(date.getFullYear(), date.getMonth(), 1);
      this._refocus = true;
      this.render();
    };

    this.querySelectorAll('[data-shift]').forEach((button) => {
      button.addEventListener('click', () => {
        const shift = Number(button.dataset.shift);
        this._view = new Date(year, month + shift, 1);
        this.render();
      });
    });

    this.querySelector('.ui-datepicker__today')?.addEventListener('click', () =>
      moveTo(new Date())
    );

    this.querySelectorAll('.ui-datepicker__day').forEach((button) => {
      const date = parseISO(button.dataset.date);

      button.addEventListener('click', () => {
        this.setAttribute('value', button.dataset.date);
        this.emit('ui-change', { value: button.dataset.date, date });
      });

      button.addEventListener('keydown', (event) => {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        const day = date.getDate();

        if (event.key in step) {
          event.preventDefault();
          moveTo(new Date(date.getFullYear(), date.getMonth(), day + step[event.key]));
        } else if (event.key === 'PageUp') {
          event.preventDefault();
          moveTo(new Date(date.getFullYear(), date.getMonth() - 1, day));
        } else if (event.key === 'PageDown') {
          event.preventDefault();
          moveTo(new Date(date.getFullYear(), date.getMonth() + 1, day));
        } else if (event.key === 'Home') {
          event.preventDefault();
          moveTo(new Date(date.getFullYear(), date.getMonth(), day - ((date.getDay() + 6) % 7)));
        } else if (event.key === 'End') {
          event.preventDefault();
          moveTo(new Date(date.getFullYear(), date.getMonth(), day + (6 - ((date.getDay() + 6) % 7))));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          button.click();
        }
      });
    });

    // Only chase focus after a keyboard move, never after the first paint —
    // otherwise merely putting a picker on the page would steal focus.
    if (this._refocus) {
      this._refocus = false;
      this.querySelector('.ui-datepicker__day[tabindex="0"]')?.focus();
    }
  }
}

reflectProps(UiDatePicker, {
  value: 'string',
  min: 'string',
  max: 'string',
  month: 'string',
  'hide-today': 'boolean',
});

define('ui-date-picker', UiDatePicker);
export { UiDatePicker };
