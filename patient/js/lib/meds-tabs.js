/**
 * THE HEALTH RECORDS TABS — a strip, and a strip inside it.
 *
 * WHY THE TWO ARE ONE SCREEN
 *
 * Medications and Allergies were two sidebar rows. They are one subject —
 * every clinical form that asks for either asks for both, and the question a
 * gastroenterologist asks before a procedure ("what is this person on, and
 * what can they not be given") has one answer that spans them.
 *
 * WHY IT IS TABS AND SUB-TABS AND NOT FOUR TABS IN A ROW
 *
 * The four used to sit in a row: Current Medications, Past Medications,
 * Allergies, Pharmacy. Read left to right, that strip says the four are
 * peers, and they are not. Current and Past are one list split by time — the
 * same fields, the same medication moving between them — while Allergies is a
 * different record entirely. Flattening them cost the reader the one
 * relationship worth drawing.
 *
 * So: RECORDS on top (Medications, Allergies), and inside Medications a
 * second, smaller control for Current and Past. The nesting is the fact. A
 * sunk track with a white pill on it rather than a second copy of the strip
 * above, because two identical strips stacked is two strips nobody can tell
 * apart — see the TABS block in css/components.css, which draws both.
 *
 * Pharmacy is gone from here altogether. It was the patient's list of
 * pharmacies, answering "where do you collect prescriptions" — a question
 * nobody opens this screen asking. The one they do ask is "this medication,
 * where do I pick it up", and that is now a line on the medication itself.
 *
 * HOW THIS DIFFERS FROM billing-tabs.js AND profile-tabs.js
 *
 * Those link to separate FILES. These are panels of one file at `?tab=`,
 * because they share a header, a download action and one set of data. The
 * hrefs are still real addresses that work with JavaScript broken; the screen
 * intercepts the click to repaint in place rather than reload, which is an
 * optimisation and not the mechanism.
 *
 * `current` deliberately has no query at all. It is the question the screen
 * is opened with, so it is what a bare health-medications.html answers.
 */

import { esc } from './format.js';

/** Every reachable panel, and which record each belongs to. */
export const MEDS_TABS = [
  { id: 'current', section: 'medications', label: 'Current', href: 'health-medications.html' },
  { id: 'past', section: 'medications', label: 'Past', href: 'health-medications.html?tab=past' },
  {
    id: 'allergies',
    section: 'allergies',
    label: 'Allergies',
    href: 'health-medications.html?tab=allergies',
  },
];

/** The top strip: the two records, and the panel each one opens on. */
export const MEDS_SECTIONS = [
  { id: 'medications', label: 'Medications', opensOn: 'current' },
  { id: 'allergies', label: 'Allergies', opensOn: 'allergies' },
];

/** The panels inside Medications, in the order the pill draws them. */
export const MED_VIEWS = MEDS_TABS.filter((tab) => tab.section === 'medications');

/** The panel a `?tab=` value means, falling back to Current for anything else. */
export function tabFrom(search) {
  const asked = new URLSearchParams(search).get('tab');
  return MEDS_TABS.some((tab) => tab.id === asked) ? asked : 'current';
}

/** Which of the two records a panel belongs to. */
export function sectionOf(tab) {
  return MEDS_TABS.find((entry) => entry.id === tab)?.section ?? 'medications';
}

/**
 * Draw the top strip — the two records.
 *
 * A plain <div> of links, not role="tablist" — the same call billing-tabs.js
 * explains at length. The ARIA tab pattern promises arrow-key movement
 * between tabs; these are links, and aria-current already says which one you
 * are on.
 *
 * The Medications link points at whichever medication panel is open, so
 * leaving for Allergies and coming back returns you to Past if that is where
 * you were. Losing your place is the cost of nesting one strip inside
 * another, and it is avoidable in one line.
 *
 * NO COUNT BESIDE THE LABEL. Both tabs carried one — "Medications 6",
 * "Allergies 3". A count earns its place on a tab when it is the reason to
 * open it: Forms carries how many are outstanding because that is a number a
 * patient owes somebody. How many medications are on a list is not; it is
 * answered by the list itself the moment the tab opens, and until then it is
 * a digit the eye has to sort from the name beside it.
 *
 * @param {HTMLElement} host     the <div id="tabs"> in the page
 * @param {string}      active   id of the open panel — see MEDS_TABS
 */
export function medsTabs(host, active) {
  if (!host) return;

  const openSection = sectionOf(active);

  host.className = 'pp-tabs';
  host.innerHTML = MEDS_SECTIONS.map((section) => {
    const lands = section.id === openSection ? active : section.opensOn;
    const href = MEDS_TABS.find((tab) => tab.id === lands).href;

    return `
    <a class="pp-tab" href="${esc(href)}" data-tab="${esc(lands)}"
      ${section.id === openSection ? 'aria-current="page"' : ''}
      data-testid="meds--tab-${esc(section.id)}"
      >${esc(section.label)}</a>`;
  }).join('');
}

/**
 * Draw the sub-tabs — Current and Past, inside Medications.
 *
 * Hidden outright on Allergies rather than drawn disabled: a control that
 * cannot act on what is in front of you is noise, and "Current / Past" over a
 * list of allergies invites the reader to wonder what a past allergy is.
 *
 * The host is emptied as well as hidden, so a screen reader in a browser that
 * treats `hidden` loosely still cannot reach two links to medication panels
 * from a screen showing allergies.
 *
 * No count here either, and for the same reason as the strip above — see
 * medsTabs().
 *
 * @param {HTMLElement} host    the <div id="views"> in the page
 * @param {string}      active  id of the open panel
 */
export function medViews(host, active) {
  if (!host) return;

  host.hidden = sectionOf(active) !== 'medications';
  if (host.hidden) {
    host.innerHTML = '';
    return;
  }

  host.className = 'pp-seg';
  host.innerHTML = MED_VIEWS.map(
    (view) => `
    <a class="pp-seg__item" href="${esc(view.href)}" data-tab="${esc(view.id)}"
      ${view.id === active ? 'aria-current="page"' : ''}
      data-testid="meds--view-${esc(view.id)}"
      >${esc(view.label)} medications</a>`
  ).join('');
}
