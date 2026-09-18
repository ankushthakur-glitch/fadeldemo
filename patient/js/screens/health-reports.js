/**
 * REPORTS
 *
 * Not in the supplied design — see the note in health-reports.html. Off the
 * side nav, and off the dashboard as well since the fourth card became Forms
 * & Consents: the top bar's search, the results notification and the link at
 * the foot of a visit summary are the ways in, so no nav item highlights
 * while you are here.
 *
 * The report name is a link because a result is a document a patient opens,
 * not a row they read. "Abnormal" on its own is the beginning of a question,
 * and the answer is in the report.
 *
 * TWO THINGS ARRIVE FROM ELSEWHERE
 *
 *   ?report=<id>  a deep link from the top-bar search or from a notification.
 *                 The row is scrolled to and flashed rather than opened — the
 *                 patient asked to find it, and deciding they also meant to
 *                 open it is a decision that is not ours.
 *   The filter bar the same search runs, exposed here as well. It is the same
 *   matcher (lib/report-search.js), so a query that finds a report in the
 *   overlay finds it in the table.
 */

import { mountShell } from '../lib/shell.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { matches, withinRange } from '../lib/report-search.js';
import { REPORTS } from '../../data/health.js';

/** What the filter bar currently asks for. */
const state = { query: '', from: '', to: '' };

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell()) return;

  paintFilters();
  paintRows();
  wire();

  const asked = new URLSearchParams(location.search).get('report');
  if (asked) spotlight(asked);
});

/* ============================================================================
   THE FILTER BAR
   ========================================================================= */

function paintFilters() {
  document.getElementById('filters').innerHTML = `
    <div class="pp-reports__filters">
      <div class="pp-field pp-reports__search">
        <label class="pp-label" for="reportFilter">Search reports</label>
        <div class="pp-control pp-control--icon">
          <input class="pp-input" id="reportFilter" type="text"
            placeholder="Search reports by name or date" autocomplete="off"
            data-filter-query data-testid="reports--search" />
          <span class="pp-control__icon">
            <svg class="pp-icon" aria-hidden="true"><use href="#pi-search"></use></svg>
          </span>
        </div>
      </div>

      <div class="pp-field">
        <label class="pp-label" for="reportFrom">From</label>
        <div class="pp-control pp-control--icon">
          <input class="pp-input" id="reportFrom" type="date"
            data-filter-from data-testid="reports--from" />
          <span class="pp-control__icon">
            <svg class="pp-icon" aria-hidden="true"><use href="#pi-calendar"></use></svg>
          </span>
        </div>
      </div>

      <div class="pp-field">
        <label class="pp-label" for="reportTo">To</label>
        <div class="pp-control pp-control--icon">
          <input class="pp-input" id="reportTo" type="date"
            data-filter-to data-testid="reports--to" />
          <span class="pp-control__icon">
            <svg class="pp-icon" aria-hidden="true"><use href="#pi-calendar"></use></svg>
          </span>
        </div>
      </div>

      <button type="button" class="pp-btn pp-btn--quiet pp-reports__clear" data-filter-reset
        data-testid="reports--clear">Clear</button>
    </div>

    <!-- Announced, because the table below it changes without anything moving
         focus — a filter that silently removes three rows is a filter a screen
         reader user has no way of noticing. -->
    <p class="pp-reports__count" aria-live="polite" data-filter-count></p>
  `;
}

/* ============================================================================
   THE TABLE
   ========================================================================= */

function visible() {
  return REPORTS.filter(
    (report) => matches(report, state.query) && withinRange(report, state.from, state.to)
  );
}

function paintRows() {
  const found = visible();
  const body = document.getElementById('rows');

  body.innerHTML = found.length
    ? found
        .map(
          (report) => `
    <tr data-report="${esc(report.id)}">
      <td><a href="#" data-open="${esc(report.id)}">${esc(report.name)}</a></td>
      <td>${esc(report.date)}</td>
      <td>${esc(report.orderedBy)}</td>
      <td>
        <span class="pp-badge pp-badge--${report.abnormal ? 'bad' : 'ok'}"
          >${report.abnormal ? 'Abnormal' : 'Normal'}</span>
      </td>
    </tr>`
        )
        .join('')
    : `<tr><td class="pp-table__empty" colspan="4" data-testid="reports--empty">${
        state.query.trim()
          ? `No reports match “${esc(state.query.trim())}”.`
          : 'No reports fall in those dates.'
      }</td></tr>`;

  const count = document.querySelector('[data-filter-count]');
  if (count) {
    count.textContent =
      found.length === REPORTS.length
        ? `${REPORTS.length} reports`
        : `${found.length} of ${REPORTS.length} reports`;
  }
}

/* ============================================================================
   WIRING
   ========================================================================= */

function wire() {
  const filters = document.getElementById('filters');

  filters.addEventListener('input', (event) => {
    if (!event.target.matches('[data-filter-query]')) return;
    state.query = event.target.value;
    paintRows();
  });

  filters.addEventListener('change', (event) => {
    if (event.target.matches('[data-filter-from]')) state.from = event.target.value;
    else if (event.target.matches('[data-filter-to]')) state.to = event.target.value;
    else return;
    paintRows();
  });

  filters.addEventListener('click', (event) => {
    if (!event.target.closest('[data-filter-reset]')) return;
    state.query = '';
    state.from = '';
    state.to = '';
    filters.querySelector('[data-filter-query]').value = '';
    filters.querySelector('[data-filter-from]').value = '';
    filters.querySelector('[data-filter-to]').value = '';
    paintRows();
    filters.querySelector('[data-filter-query]').focus();
  });

  document.getElementById('rows').addEventListener('click', (event) => {
    const link = event.target.closest('[data-open]');
    if (!link) return;
    event.preventDefault();
    const report = REPORTS.find((entry) => entry.id === link.dataset.open);
    toast(`This would open the ${report.name} result from ${report.date}.`);
  });
}

/* ============================================================================
   THE DEEP-LINK FLASH
   ========================================================================= */

function spotlight(id) {
  const row = document.querySelector(`[data-report="${CSS.escape(id)}"]`);
  if (!row) return;

  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('pp-row--spot');
  setTimeout(() => row.classList.remove('pp-row--spot'), 2600);

  // Dropped from the address once it has been acted on, so a reload or a Back
  // does not re-flash a row the patient has already found.
  const url = new URL(location.href);
  url.searchParams.delete('report');
  history.replaceState(null, '', url);
}
