/**
 * THE ALLERGIES PANEL — a table, and nothing that writes.
 *
 * This was js/screens/allergies.js, a screen of its own at allergies.html,
 * and then a table with an Add dialog and a pencil on every row. It is the
 * read-only half of the Health Records screen now.
 *
 * WHY THE DIALOG WENT
 *
 * An allergy list is the practice's record of what a patient must not be
 * given, and it is read in the one situation where being wrong is expensive:
 * by whoever is about to prescribe or anaesthetise. A portal that lets the
 * patient edit it directly accepts one edit it must never accept — a severity
 * quietly moved from Severe to Mild, with nobody the wiser and the change
 * carrying the same authority as the clinician's original entry. Telling the
 * practice is slower and is the correct channel.
 *
 * WHY IT IS A TABLE AGAIN
 *
 * It was cards for a while, on the argument that an allergy is one heading
 * and four facts. But an allergy list is read DOWN — "is anything here
 * severe", "what did the practice record and when" — and the severity column
 * is the whole point of the screen. A grid of cards has no column to run an
 * eye down. Same shape as the medications beside it, so a reader who has
 * learnt one has learnt the other.
 */

import { esc } from './format.js';
import { ALLERGIES, typeLabel, severityTone } from '../../data/allergies.js';

/** The columns, in the order a reader needs them. */
const COLUMNS = [
  'Allergen',
  'Type',
  'Reaction',
  'Severity',
  'First Reacted',
  'Recorded Date',
  'Recorded By',
];

/**
 * Draw the table into `host`. Safe to call as often as the tab is opened.
 *
 * There is no wiring counterpart to this function any more — nothing in this
 * table is clickable, so there is nothing to bind and nothing to unbind on a
 * repaint.
 */
export function paintAllergies(host) {
  if (!host) return;

  host.innerHTML = `
    <div class="pp-table-wrap">
      <table class="pp-table" data-testid="allergies--list">
        <caption class="pp-sr-only">Allergies</caption>
        <thead>
          <tr>${COLUMNS.map((column) => `<th scope="col">${esc(column)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${ALLERGIES.length ? ALLERGIES.map(row).join('') : empty()}
        </tbody>
      </table>
    </div>`;
}

function row(allergy) {
  return `
    <tr data-allergy="${esc(allergy.id)}">
      <td>
        <span class="pp-meds__name">${esc(allergy.name)}</span>
        ${allergy.note ? `<span class="pp-meds__note">${esc(allergy.note)}</span>` : ''}
      </td>
      ${cell(typeLabel(allergy))}
      ${cell(allergy.reaction)}
      <td>${
        allergy.severity
          ? `<span class="pp-badge pp-badge--${esc(severityTone(allergy.severity))}"
               data-testid="allergies--severity">${esc(allergy.severity)}</span>`
          : '<span class="pp-table__none">—</span>'
      }</td>
      ${cell(allergy.onsetDate)}
      ${cell(allergy.recordedOn)}
      ${cell(allergy.recordedBy)}
    </tr>`;
}

/**
 * A value, or an em dash — never a blank cell.
 *
 * An empty box in a grid reads as a rendering fault, and on this table the
 * reader has to be able to tell "nobody recorded this" from "the page failed
 * to draw it".
 */
function cell(text) {
  return `<td>${text ? esc(text) : '<span class="pp-table__none">—</span>'}</td>`;
}

/** Nothing recorded is not the same as no allergies, and the row says so. */
function empty() {
  return `
    <tr>
      <td class="pp-table__empty" colspan="${COLUMNS.length}" data-testid="allergies--empty">
        Nothing is recorded. If you react to a medicine, a food or something
        around you, tell your care team and they will add it here.
      </td>
    </tr>`;
}
