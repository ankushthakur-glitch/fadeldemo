/**
 * <ui-time-clock> — the shift clock, living in the top bar.
 *
 *   <ui-time-clock></ui-time-clock>
 *
 * Drop the tag into `.pt__bar-actions` on any screen and it works: the trigger
 * shows the running shift, and clicking it opens a popover with every action —
 * clock in and out, breaks, shift notes, and the day's entries so far.
 *
 * There is no Time Clock page. Putting the whole feature in the header is the
 * point: clocking in is a ten-second job done from wherever you already are,
 * and a dedicated tab makes people navigate away from their work to do it.
 *
 * State lives in lib/time-clock-store.js and is shared across screens and tabs,
 * so this element is pure presentation — it renders whatever the store says and
 * re-renders when the store changes underneath it.
 */
import { UiElement, define, trapFocus } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';
import * as clock from '../lib/time-clock-store.js';

/* The trigger counts up while a shift runs. A second is the coarsest tick that
   still makes a live "0h 0m → 0h 1m" flip look immediate rather than stuck. */
const TICK_MS = 1000;

const STATUS_TEXT = {
  out: 'Clocked Out',
  in: 'Clocked In',
  break: 'On Break',
};

class UiTimeClock extends UiElement {
  render() {
    this.innerHTML = `
      <div class="tc">
        <button type="button" class="tc__trigger" aria-haspopup="dialog"
                aria-expanded="false" data-testid="timeclock--trigger">
          <span class="tc__dot" aria-hidden="true"></span>
          ${iconMarkup('clock')}
          <span class="tc__trigger-label" data-trigger-label>Clock in</span>
        </button>

        <div class="tc__panel" role="dialog" aria-label="Time clock" hidden
             data-panel data-testid="timeclock--panel">
          <header class="tc__head">
            <div>
              <p class="tc__now" data-now></p>
              <p class="tc__date" data-date></p>
            </div>
            <button type="button" class="tc__close" data-close aria-label="Close time clock">
              ${iconMarkup('close')}
            </button>
          </header>

          <div class="tc__status">
            <span class="tc__pill" data-pill data-testid="timeclock--status"></span>
            <!-- The popover shows today only. Anything historical — a week, a
                 month, another employee — is a report, so it lives in the
                 Reports section rather than growing this panel. -->
            <a class="tc__report" href="time-reports.html" data-testid="timeclock--report-link">
              View report
            </a>
          </div>
          <dl class="tc__meters" data-meters></dl>

          <div class="tc__notes-field">
            <label class="tc__label" for="tc-notes">Notes (optional)</label>
            <textarea id="tc-notes" class="tc__notes" rows="2"
                      placeholder="Add any notes about your shift…"
                      data-notes data-testid="timeclock--notes"></textarea>
          </div>

          <div class="tc__actions" data-actions></div>
          <p class="tc__hint" data-hint hidden></p>

          <section class="tc__entries">
            <header class="tc__entries-head">
              <h3 class="tc__entries-title">Today’s entries</h3>
            </header>
            <div data-list></div>
          </section>

          <footer class="tc__summary" data-summary></footer>
        </div>
      </div>`;

    this.panel = this.querySelector('[data-panel]');
    this.trigger = this.querySelector('.tc__trigger');

    this.trigger.addEventListener('click', () => this.toggle());
    this.querySelector('[data-close]').addEventListener('click', () => this.close());

    // Shift notes belong to the running entry, so they persist across a
    // navigation the same way the clock does.
    this.querySelector('[data-notes]').addEventListener('change', (event) => {
      const active = clock.activeEntry();
      if (active) clock.setNotes(active.id, event.target.value);
    });

    this.panel.addEventListener('click', (event) => this.onPanelClick(event));

    /*
     * Click-away, the way the filter panel does it — but tested against
     * composedPath() rather than event.target.closest().
     *
     * Every button in this panel repaints the panel, which destroys the very
     * node that was clicked. By the time the click reaches document, that node
     * is detached, so .closest() walks a parentless tree and finds no
     * <ui-time-clock> — and the panel dismissed itself on every single action.
     * composedPath() is captured when the event is dispatched, so it still
     * holds the element the click really came from.
     */
    this._onDocClick = (event) => {
      if (this.panel.hidden) return;
      if (!event.composedPath().includes(this)) this.close();
    };
    document.addEventListener('click', this._onDocClick);

    // Escape lives on document, not on the panel: a repaint can leave focus on
    // <body>, and a keydown listener bound to the panel would never hear it.
    this._onDocKeydown = (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) this.close();
    };
    document.addEventListener('keydown', this._onDocKeydown);

    this._unsubscribe = clock.subscribe(() => this.paint());
    this._timer = setInterval(() => this.tick(), TICK_MS);

    this.paint();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._unsubscribe?.();
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onDocKeydown);
    this._releaseTrap?.();
  }

  /* --- Open / close --------------------------------------------------------- */

  toggle() {
    if (this.panel.hidden) this.open();
    else this.close();
  }

  open() {
    this.panel.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.paint();
    // Esc anywhere in the panel closes it; Tab stays inside while it is open.
    this._releaseTrap = trapFocus(this.panel, () => this.close());
    this.panel.querySelector('button:not([data-close]), textarea')?.focus();
  }

  close() {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this._releaseTrap?.();
    this._releaseTrap = null;
    this.trigger.focus();
  }

  /* --- Events ---------------------------------------------------------------- */

  onPanelClick(event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;

    switch (action.dataset.action) {
      case 'clock-in': {
        const notes = this.querySelector('[data-notes]').value;
        clock.clockIn(notes);
        break;
      }
      case 'clock-out':
        clock.clockOut();
        break;
      case 'start-break':
        clock.startBreak();
        break;
      case 'end-break':
        clock.endBreak();
        break;
      default:
        break;
    }

    /* Repainting destroyed the button that was just pressed, dropping focus to
       <body> and stranding a keyboard user outside the popover. Put them on the
       action row that replaced it. */
    if (document.activeElement === document.body) {
      this.querySelector('[data-actions] button')?.focus();
    }
  }

  /* --- Painting -------------------------------------------------------------- */

  /** Cheap per-second update: only the numbers that actually move. */
  tick() {
    const now = Date.now();
    this.paintTrigger(now);
    if (this.panel.hidden) return;
    this.querySelector('[data-now]').textContent = clock.formatTime(now);
    this.paintMeters(now);
    this.paintSummary(now);
  }

  paintTrigger(now = Date.now()) {
    const state = clock.status();
    const active = clock.activeEntry();
    const label = this.querySelector('[data-trigger-label]');

    this.trigger.dataset.state = state;
    if (state === 'out') {
      label.textContent = 'Clock in';
    } else if (state === 'break') {
      label.textContent = `Break ${clock.formatDuration(
        clock.breakMs(active, now) - this.settledBreakMs(active)
      )}`;
    } else {
      label.textContent = clock.formatDuration(clock.workedMs(active, now));
    }

    // Screen readers get the state in words; the dot alone is colour-only.
    this.trigger.setAttribute(
      'aria-label',
      `Time clock — ${STATUS_TEXT[state]}${state === 'out' ? '' : `, ${label.textContent}`}`
    );
  }

  /** Break time already banked in earlier breaks, so the trigger counts only
      the break that is running rather than jumping on the second one. */
  settledBreakMs(entry) {
    return entry.breaks
      .filter((b) => b.end !== null)
      .reduce((total, b) => total + (b.end - b.start), 0);
  }

  paintMeters(now = Date.now()) {
    const active = clock.activeEntry();
    const meters = this.querySelector('[data-meters]');
    if (!active) {
      meters.innerHTML = '';
      return;
    }
    meters.innerHTML = `
      <div class="tc__meter">
        <dt>Shift</dt>
        <dd data-testid="timeclock--shift">${clock.formatDuration(clock.workedMs(active, now))}</dd>
      </div>
      <div class="tc__meter">
        <dt>Break</dt>
        <dd data-testid="timeclock--break">${clock.formatDuration(clock.breakMs(active, now))}</dd>
      </div>`;
  }

  paintSummary(now = Date.now()) {
    const count = clock.entriesForDay().length;
    this.querySelector('[data-summary]').innerHTML = `
      <span>Total <strong data-testid="timeclock--total">${clock.formatDuration(
        clock.totalWorkedMs(clock.dayKey(), now)
      )}</strong></span>
      <span>${count} shift${count === 1 ? '' : 's'}</span>`;
  }

  paint() {
    if (!this.panel) return;
    const now = Date.now();
    const state = clock.status();
    const active = clock.activeEntry();

    this.paintTrigger(now);
    if (this.panel.hidden) return;

    this.querySelector('[data-now]').textContent = clock.formatTime(now);
    this.querySelector('[data-date]').textContent = clock.formatLongDate(now);

    const pill = this.querySelector('[data-pill]');
    pill.textContent = STATUS_TEXT[state];
    pill.dataset.state = state;

    this.paintMeters(now);

    // The notes box edits the running shift. With nothing running it collects
    // a note for the shift about to start, so it stays enabled either way.
    const notes = this.querySelector('[data-notes]');
    if (document.activeElement !== notes) notes.value = active?.notes ?? '';

    this.querySelector('[data-actions]').innerHTML = this.actionsMarkup(state);

    const hint = this.querySelector('[data-hint]');
    hint.hidden = state !== 'break';
    hint.textContent = state === 'break' ? 'End your break before clocking out.' : '';

    this.querySelector('[data-list]').innerHTML = this.listMarkup();
    this.paintSummary(now);
  }

  actionsMarkup(state) {
    if (state === 'out') {
      return `<button type="button" class="tc__btn tc__btn--primary"
                data-action="clock-in" data-testid="timeclock--clock-in">
                ${iconMarkup('play')}<span>Clock In</span>
              </button>`;
    }
    const breakBtn =
      state === 'break'
        ? `<button type="button" class="tc__btn" data-action="end-break"
             data-testid="timeclock--end-break">${iconMarkup('play')}<span>End Break</span></button>`
        : `<button type="button" class="tc__btn" data-action="start-break"
             data-testid="timeclock--start-break">${iconMarkup('coffee')}<span>Start Break</span></button>`;

    /* Clocking out mid-break is blocked rather than hidden: the button staying
       in place, disabled, with the reason underneath, is what tells someone
       the break is still running. */
    return `${breakBtn}
      <button type="button" class="tc__btn tc__btn--danger" data-action="clock-out"
              data-testid="timeclock--clock-out" ${state === 'break' ? 'disabled' : ''}>
        ${iconMarkup('log-out')}<span>Clock Out</span>
      </button>`;
  }

  listMarkup() {
    const entries = clock.entriesForDay();
    if (!entries.length) {
      return `<p class="tc__empty" data-testid="timeclock--empty">No entries for today.</p>`;
    }

    /* Read-only, deliberately. The log is a record of what the clock saw, so
       there is nothing here to edit or remove — a wrong entry is a
       conversation with whoever runs payroll, not a delete button. */
    const now = Date.now();
    return entries
      .map((entry) => {
        const running = entry.out === null;
        const span = running
          ? `${clock.formatTime(entry.in)} — now`
          : `${clock.formatTime(entry.in)} — ${clock.formatTime(entry.out)}`;
        const breaks = clock.breakMs(entry, now);

        return `<div class="tc__entry" data-testid="timeclock--entry">
          <div class="tc__entry-main">
            <span class="tc__entry-span">${span}</span>
            <span class="tc__entry-meta">${clock.formatDuration(clock.workedMs(entry, now))}${
              breaks > 0 ? ` · break ${clock.formatDuration(breaks)}` : ''
            }</span>
            ${entry.notes ? `<span class="tc__entry-note">${escapeHtml(entry.notes)}</span>` : ''}
          </div>
          ${running ? '<span class="tc__active">Active</span>' : ''}
        </div>`;
      })
      .join('');
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

define('ui-time-clock', UiTimeClock);
export { UiTimeClock };
