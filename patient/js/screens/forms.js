/**
 * FORMS & CONSENTS — the paperwork the practice is waiting on, and the
 * paperwork itself.
 *
 * One page, seven views, all at addresses:
 *
 *     forms.html                          Forms, pending
 *     forms.html?view=completed           Forms, completed
 *     forms.html?tab=consents             Consents, pending
 *     forms.html?tab=consents&view=completed   Consents, given
 *     forms.html?form=<id>                fill it in, or read back the current version
 *     forms.html?form=<id>&version=<n>    read back one particular version
 *     forms.html?form=<id>&amend=1        correct it — a new version, prefilled
 *
 * The list is a strip and a strip inside it — the records across the top, and
 * Pending / Completed inside whichever is open — which is how Health Records
 * draws Medications and Allergies. The block above TABS says why.
 *
 * TWO TABS, BECAUSE THE TWO ARE ANSWERED AND ENDED DIFFERENTLY. A form is
 * answers: you complete it, and if you got something wrong you CORRECT it. A
 * consent is permission: you give it, and the only thing left to do with it is
 * WITHDRAW it. One list mixing them puts a Withdraw button next to a
 * questionnaire and a Correct button next to a permission, and neither means
 * anything. data/forms.js's `kind` field decides which tab a row lands on, and
 * the header there is where the rule is written down.
 *
 * WHY THEY ARE NOT SEPARATE PAGES. Everywhere else in the portal a view with
 * its own address is its own file, and that is still the better default. It
 * cannot work here: submitting changes data/forms.js in memory, and a
 * navigation to another document reloads the module and throws the answer
 * away — the screen would report "submitted" and then show the same form as
 * outstanding. So the views swap in place and the address is moved with
 * pushState. Back, Forward and a deep link all still work, which is what the
 * separate file was buying.
 *
 * WHAT SURVIVES A RELOAD. Drafts, submitted versions and withdrawals, in
 * data/form-store.js — see the header there for why those and nothing else in
 * the portal.
 *
 * WHAT IT ASKS. Nothing invented here — the field set is the practice's, and
 * lives in data/forms.js. Read the header there before adding a field: the
 * keys have to match the chart's or a patient's answer lands nowhere.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { todayStamp } from '../lib/dates.js';
import { signatureMarkup, wireSignature, signatureMethodLabel } from '../lib/signature-pad.js';
import { printFormVersion } from '../lib/form-print.js';
import { PATIENT } from '../../data/patient.js';
import { UPCOMING } from '../../data/appointments.js';
import {
  formsBy,
  formById,
  schemaFor,
  revokeConsent,
} from '../../data/forms.js';
import {
  rehydrateForms,
  versionsFor,
  currentVersion,
  versionAt,
  addVersion,
  addRevocation,
  draftFor,
  hasDraft,
  saveDraft,
  clearDraft,
} from '../../data/form-store.js';

let host;
let well;

/** The live signature block, while one is on screen. */
let signature = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell({ active: 'forms' })) return;

  host = document.getElementById('screen');
  well = document.getElementById('well');

  // Anything submitted in an earlier session is put back into the in-memory
  // list before the first paint, or a refresh would show completed forms as
  // outstanding again.
  rehydrateForms();
  // Once, on load: the dialog is markup in the page and survives every
  // repaint, so wiring it per-view would stack a listener per visit.
  wireRevoke();

  paint(route());

  // Back and Forward move between the views like any set of pages.
  window.addEventListener('popstate', () => paint(route()));
});

/* ============================================================================
   A STRIP, AND A STRIP INSIDE IT — the same nesting Health Records draws

   Two records on top (Forms, Consents), and inside whichever is open a
   smaller control for Pending and Completed. The nesting is the fact, and it
   is the same fact meds-tabs.js writes down at length: Pending and Completed
   are ONE list split by state — the same rows, the same columns, a form
   moving from one to the other the moment it is sent back — while a consent
   is a different record from a form, answered and ended differently.

   Four panels in a row would say those four are peers. They are not, and the
   two tables stacked down one screen (which is how this was drawn) said
   something else wrong: that a patient reading what they still owe should
   have to scroll past it to reach what they have already dealt with.

   NOT IN js/lib like the Billing, Profile and Medications strips: those link
   between separate FILES and are shared by them. These are panels of one
   file at `?tab=` and `?view=`, and a lib holding two short arrays for a
   single caller would be indirection for its own sake. The hrefs are still
   real addresses, so both strips work with JavaScript broken — the click is
   intercepted for the same reason every other view here is, not to make the
   links work.

   `forms` and `pending` deliberately have no query at all. Between them they
   are the question the screen is opened with — "what does the practice still
   need from me" — so a bare forms.html answers it.
   ========================================================================= */

const TABS = [
  { id: 'forms', kind: 'form', label: 'Forms' },
  { id: 'consents', kind: 'consent', label: 'Consents' },
];

/** The two views of whichever record is open. */
const VIEWS = [
  { id: 'pending', which: 'todo' },
  { id: 'completed', which: 'completed' },
];

/**
 * What each record calls its two views, and what it heads its first column.
 *
 * "Consents given" rather than "Completed consents": a consent is not
 * completed, it is given — the word the button that gives it uses, and the
 * word the row's own chip uses once it has been.
 */
const WORDS = {
  forms: { pending: 'Pending forms', completed: 'Completed forms', name: 'Form Name' },
  consents: { pending: 'Pending consents', completed: 'Consents given', name: 'Consent' },
};

const tabById = (id) => TABS.find((tab) => tab.id === id) ?? TABS[0];

/** The tab a row belongs on, from its kind. */
const tabForForm = (form) => (form?.kind === 'consent' ? 'consents' : 'forms');

/**
 * The view a row is sitting in.
 *
 * `status === 'completed'`, matching formsBy(): a WITHDRAWN consent is a
 * pending row, because the practice has no permission and that is the same
 * situation as never having been given it. See data/forms.js.
 */
const viewForForm = (form) => (form?.status === 'completed' ? 'completed' : 'pending');

/** What the address is asking for. */
function route() {
  const query = new URLSearchParams(location.search);
  const asked = query.get('tab');
  const view = query.get('view');
  return {
    id: query.get('form'),
    tab: TABS.some((tab) => tab.id === asked) ? asked : 'forms',
    view: VIEWS.some((entry) => entry.id === view) ? view : 'pending',
    version: query.get('version'),
    amend: query.get('amend') === '1',
    highlight: query.get('highlight'),
  };
}

/**
 * Draw whichever view the address asks for.
 *
 * An id the portal cannot open — unknown, or a form with no schema — falls
 * back to the list rather than to an error: the list says what the practice
 * is waiting on, which is the thing that was being asked for anyway.
 */
function paint({ id, tab, view, version, amend, highlight } = {}) {
  signature = null;
  const form = id ? formById(id) : null;

  if (form && schemaFor(form)) {
    const completed = form.status === 'completed';

    if (version) {
      const entry = versionAt(form.id, version);
      if (entry) {
        host.innerHTML = readBack(form, entry);
        wireReadBack(form, entry);
        well.scrollTop = 0;
        return;
      }
    }

    if (amend || !completed) {
      host.innerHTML = fillView(form, amend);
      wireFill(form, amend);
      well.scrollTop = 0;
      return;
    }

    const entry = currentVersion(form.id);
    host.innerHTML = readBack(form, entry);
    wireReadBack(form, entry);
    well.scrollTop = 0;
    return;
  }

  /*
   * A deep link names a row, not a panel. `forms.html?highlight=<id>` comes
   * from a notification written months before anyone split the list in four,
   * so BOTH strips are set from the row rather than demanded of the caller —
   * a link that scrolls to a row on a panel it is not showing would flash
   * nothing.
   */
  const marked = highlight ? formById(highlight) : null;
  const wanted = marked ? tabForForm(marked) : tab;
  const showing = marked ? viewForForm(marked) : view;

  host.innerHTML = list(wanted, showing);
  wireList(wanted, showing);
  well.scrollTop = 0;

  // Done after the paint, because the row has to exist before it can be
  // scrolled to.
  if (highlight) spotlight(highlight, wanted, showing);
}

/** Move between views without leaving the page. */
function go(params, { replace = false } = {}) {
  const url = new URL(location.href);
  ['form', 'tab', 'view', 'version', 'amend', 'highlight'].forEach((key) =>
    url.searchParams.delete(key)
  );
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  });

  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  paint(route());
}

/* ============================================================================
   DEEP-LINK HIGHLIGHT

   A notification about a form lands on forms.html?highlight=<id>. The row is
   scrolled to and flashed rather than opened: the patient asked to see the
   notification, not to start filling something in, and opening a
   forty-field form on their behalf is a decision that is not ours to make.
   ========================================================================= */

function spotlight(id, tabId, view) {
  /*
   * The address is corrected FIRST, and whether or not the row turns up.
   *
   * `highlight` is spent — it has done its one job — and the panel it
   * resolved to is written in its place, so a reload of what is now on screen
   * shows what is now on screen. Doing this after the early return would
   * leave a consent on the Consents tab at an address that reopens on Forms.
   */
  const url = new URL(location.href);
  ['highlight', 'tab', 'view'].forEach((key) => url.searchParams.delete(key));
  Object.entries(listParams(tabId, view) ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );
  history.replaceState(null, '', url);

  const row = host.querySelector(`[data-form="${CSS.escape(id)}"]`);
  if (!row) return;

  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('pp-form-row--spot');

  // Removed once it has been seen, so a reload or a Back does not re-flash a
  // row the patient has already dealt with.
  setTimeout(() => row.classList.remove('pp-form-row--spot'), 2600);
}

/**
 * The address of one panel of the list.
 *
 * Pending Forms is `forms.html` with no query at all — between them the two
 * defaults are the question the screen is opened with, so a bare address
 * answers it, the same call meds-tabs.js makes for Current Medications.
 */
const listParams = (tabId, view = 'pending') => {
  const params = {};
  if (tabId !== 'forms') params.tab = tabId;
  if (view !== 'pending') params.view = view;
  return Object.keys(params).length ? params : null;
};

/** The same address as a link, for the two strips. */
const listHref = (tabId, view) => {
  const query = new URLSearchParams(listParams(tabId, view) ?? {}).toString();
  return query ? `forms.html?${query}` : 'forms.html';
};

/**
 * Back to the panel this row is NOW in — not the one it was opened from.
 *
 * A form that has just been sent back belongs under Completed, and landing on
 * Pending after submitting it shows a table the row has just left. Same for a
 * consent that has just been withdrawn, in the other direction.
 */
const listParamsFor = (form) => listParams(tabForForm(form), viewForForm(form));

/* ============================================================================
   THE LIST — ONE TABLE, THE PANEL IT SITS IN, AND THE TWO STRIPS OVER IT

   The shape is Health Records': the records across the top, the sub-tabs
   INSIDE the panel's edge with the table under them, and one list on screen
   at a time. The sub-tabs are part of the table rather than a strip floating
   above it — Pending and Completed are two views of THIS list, and drawn
   outside the panel they would read as a second screen-level control
   competing with Forms / Consents.

   The table is the portal's own .pp-table inside .pp-table-wrap
   (components.css), the same one Medications, Billing and Reports draw, and
   it runs the full width of the well. Both halves are read DOWN a column —
   "what is due first", "which of these still needs signing", "when did I give
   that one" — and a stack of cards has no column to run an eye down.
   ========================================================================= */

/** The columns, per view. The two differ by one: what the date in it means. */
const COLUMNS = (tabId, view) => [
  WORDS[tabId].name,
  'Description',
  view === 'completed' ? (tabId === 'consents' ? 'Given' : 'Submitted') : 'Due Date',
  'Status',
  'Actions',
];

function list(tabId, view) {
  const { kind } = tabById(tabId);
  const { which } = VIEWS.find((entry) => entry.id === view) ?? VIEWS[0];
  const rows = formsBy(which, kind);
  const columns = COLUMNS(tabId, view);

  return `
    <div class="pp-forms" data-testid="forms--list">
      ${strip(tabId, view)}

      <div class="pp-forms__panel">
        ${views(tabId, view)}

        <div class="pp-table-wrap">
          <table class="pp-table pp-forms__table" data-testid="forms--table">
            <caption class="pp-sr-only">${esc(WORDS[tabId][view])}</caption>
            <thead>
              <tr>
                ${columns
                  .map(
                    (column, index) =>
                      `<th scope="col"${
                        index === columns.length - 1 ? ' class="pp-table__action"' : ''
                      }>${esc(column)}</th>`
                  )
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map((form) => (view === 'completed' ? doneRow(form) : todoRow(form)))
                      .join('')
                  : empty(columns.length, tabId, view)
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * The top strip — the two records.
 *
 * `aria-current`, not `aria-selected`: these are links, and a plain <div> of
 * them rather than role="tablist", for the reason billing-tabs.js sets out at
 * length — the ARIA tab pattern promises arrow-key movement these do not have.
 *
 * NO COUNT ON EITHER RECORD. Forms carried how many the practice was still
 * waiting on — "Forms (3)" — on the argument that a count earns its place on
 * a tab when it is the reason to open it. It does not survive contact with
 * the strip: a tab is a place, and the number riding one has to be read and
 * sorted from the word beside it before either means anything. What is
 * outstanding is said where it can be acted on — the side nav's Forms row
 * carries it for the whole screen, and the Pending view under the tab lists
 * the actual forms, by name and by date, the moment you press it.
 *
 * Each record links to the view you are already on, so crossing from Forms to
 * Consents while reading what is settled does not drop you back into what is
 * pending.
 */
function strip(tabId, view) {
  return `
    <div class="pp-forms__bar">
      <div class="pp-tabs">
        ${TABS.map(
          (tab) => `
          <a class="pp-tab" href="${esc(listHref(tab.id, view))}" data-tab="${esc(tab.id)}"
            ${tab.id === tabId ? 'aria-current="page"' : ''}
            data-testid="forms--tab-${esc(tab.id)}"
            >${esc(tab.label)}</a>`
        ).join('')}
      </div>
    </div>
  `;
}

/**
 * The sub-tabs — Pending and Completed, inside whichever record is open.
 *
 * A sunk track with a raised white pill rather than a second copy of the
 * strip above it: two identical strips stacked is two strips nobody can tell
 * apart. Both are drawn by the TABS block in css/components.css.
 *
 * The labels name the record as well as the state — "Pending forms", not
 * "Pending" — so the pill still says what it is switching when the eye
 * arrives at it without having read the strip above.
 */
function views(tabId, view) {
  return `
    <div class="pp-seg">
      ${VIEWS.map(
        (entry) => `
        <a class="pp-seg__item" href="${esc(listHref(tabId, entry.id))}"
          data-view-tab="${esc(entry.id)}"
          ${entry.id === view ? 'aria-current="page"' : ''}
          data-testid="forms--panel-${esc(entry.id)}"
          >${esc(WORDS[tabId][entry.id])}</a>`
      ).join('')}
    </div>
  `;
}

/**
 * An answer where the rows would be, inside the table rather than instead of
 * it: the head still says what the columns would have been, which is the
 * difference between "empty" and "broken".
 *
 * The empty Completed table is reachable in normal use on Consents — withdraw
 * the last one you had given and this is where you land — so it is answered
 * rather than left blank.
 */
function empty(columns, tabId, view) {
  const consent = tabId === 'consents';
  const message =
    view === 'completed'
      ? consent
        ? 'No consent is in force. Anything you give will be listed here.'
        : 'Nothing completed yet. Forms you send back are kept here.'
      : consent
        ? 'Nothing waiting on you. Every consent the practice has asked for has been given.'
        : 'Nothing outstanding. Your care team will let you know when there is.';

  return `
    <tr>
      <td class="pp-table__empty" colspan="${columns}">${esc(message)}</td>
    </tr>`;
}

/**
 * The first cell of any row — the name, and the one line under it.
 *
 * The name is a LINK, as the reference draws it, and it opens the same view
 * the button at the end of the row does. Under it go the facts that have no
 * column of their own: which pile of paperwork this came from, whether it
 * will want a signature, the visit it was sent for, and — on a consent that
 * was given and later withdrawn — the two dates that story needs. None of
 * them is worth a column; most are blank on most rows.
 */
function nameCell(form, { revoked, sent = false }) {
  const appointment = form.appointmentId
    ? UPCOMING.find((appt) => appt.id === form.appointmentId)
    : null;

  const meta = [
    form.category,
    form.signatureRequired ? 'Signature required' : '',
    appointment ? `For your visit on ${appointment.dateTime.split(' (')[0]}` : '',
    // Only on a row that is waiting: how long the practice has been waiting
    // is what makes a due date mean something. On a settled row the Submitted
    // column has said everything the date can say.
    sent ? `Sent ${form.sentOn}` : '',
    revoked && form.completedOn ? `Given ${form.completedOn}` : '',
    revoked && form.revokedOn ? `Withdrawn ${form.revokedOn}` : '',
  ].filter(Boolean);

  return `
    <th scope="row" class="pp-forms__name-cell">
      <a class="pp-forms__name" href="#" data-open="${esc(form.id)}"
        data-testid="forms--name">${esc(form.name)}</a>
      ${meta.length ? `<span class="pp-forms__meta">${esc(meta.join(' · '))}</span>` : ''}
    </th>`;
}

/**
 * A row in the pending table.
 *
 * A WITHDRAWN CONSENT IS A PENDING ROW, not a settled one — the practice has
 * no permission, which is the same situation as never having been given it
 * (see formsBy() in data/forms.js). So this row carries the withdrawn case
 * too: the status chip, the two dates under the name, and the way back to the
 * consent that was withdrawn, which is the whole reason withdrawing it deleted
 * nothing.
 */
function todoRow(form) {
  const consent = form.kind === 'consent';
  const revoked = form.status === 'revoked';
  const fillable = Boolean(schemaFor(form));
  const drafted = hasDraft(form.id);
  // `status === 'todo'`, not `!== 'completed'`: a withdrawn consent HAS
  // versions — the one it withdrew — and a form nobody has opened has none.
  const versions = form.status === 'todo' ? [] : versionsFor(form.id);

  return `
    <tr class="pp-form-row" data-form="${esc(form.id)}">
      ${nameCell(form, { revoked, sent: !revoked })}
      <td class="pp-forms__about">${esc(form.about)}</td>
      <td>
        ${
          form.status === 'todo' && form.dueOn
            ? esc(form.dueOn)
            : '<span class="pp-table__none">—</span>'
        }
      </td>
      <td>${statusChip(form, { consent, revoked, outstanding: true, drafted })}</td>
      <td class="pp-table__action">
        <div class="pp-forms__actions">
          ${action(form, { consent, revoked, outstanding: true, fillable, drafted, versions })}
        </div>
      </td>
    </tr>`;
}

/**
 * A row in the settled table — a form sent back, or a consent in force.
 *
 * The same five columns as a pending row, so the two views of the list line
 * up under one another as the pill switches between them. Only the third
 * changes what it holds: when it is due, and then when it was sent.
 */
function doneRow(form) {
  const consent = form.kind === 'consent';
  const fillable = Boolean(schemaFor(form));
  const versions = versionsFor(form.id);

  return `
    <tr class="pp-form-row" data-form="${esc(form.id)}">
      ${nameCell(form, { revoked: false })}
      <td class="pp-forms__about">${esc(form.about)}</td>
      <td>${
        form.completedOn ? esc(form.completedOn) : '<span class="pp-table__none">—</span>'
      }</td>
      <td>${statusChip(form, { consent, revoked: false, outstanding: false, drafted: false })}</td>
      <td class="pp-table__action">
        <div class="pp-forms__actions">
          ${action(form, {
            consent,
            revoked: false,
            outstanding: false,
            fillable,
            drafted: false,
            versions,
          })}
        </div>
      </td>
    </tr>`;
}

/**
 * The one chip that says where this row stands.
 *
 * A withdrawn consent is drawn OUTLINE, not red. The patient withdrew it on
 * purpose and were entitled to; red is the portal's colour for something
 * wrong — a declined card, an overdue balance — and spending it here would
 * tell someone exercising a right that they had made a mistake.
 */
function statusChip(form, { consent, revoked, outstanding, drafted }) {
  // No date on the chip — the Submitted column beside it carries the date
  // already, and a row that prints the same date twice in two sizes reads as
  // two different dates until you check.
  if (revoked) {
    return '<span class="pp-badge pp-badge--outline" data-testid="forms--withdrawn">Withdrawn</span>';
  }

  if (!outstanding) {
    return `<span class="pp-badge pp-badge--ok">${icon('check', { size: 'sm' })}${
      consent ? 'Consent given' : 'Completed'
    }</span>`;
  }

  if (drafted) {
    return `<span class="pp-badge pp-badge--info" data-testid="forms--in-progress">
      In Progress
    </span>`;
  }

  /*
   * "Pending", on a consent as much as on a form.
   *
   * The chip used to read "Not given" on a consent, which is accurate and
   * says the wrong thing in a Status column: beside a row headed Consent it
   * is the only chip that names the thing rather than its state, and it reads
   * as a refusal — as though the patient had declined it — rather than as
   * paperwork nobody has got to yet.
   */
  return '<span class="pp-badge pp-badge--warn">Pending</span>';
}

/**
 * What this row can do.
 *
 * A completed form used to offer "Request a copy", which asked the practice
 * to post back a document the portal is holding. It offers the document
 * instead: View reads it, Print / Download produces it on paper or as a PDF.
 *
 * THE LAST BUTTON IS THE ONE THAT DIFFERS BETWEEN THE TABS, and it is the
 * reason there are two tabs. A completed form offers **Correct this form** —
 * the answers were wrong and a new version fixes them. A given consent offers
 * **Withdraw consent** — the answers were not wrong, the permission has ended.
 * Neither button makes sense on the other kind: there is nothing to correct
 * about a permission, and withdrawing a questionnaire is not a thing a person
 * can do.
 */
function action(form, { consent, revoked, outstanding, fillable, drafted, versions }) {
  const name = `<span class="pp-sr-only"> — ${esc(form.name)}</span>`;

  if (!fillable) {
    return `<button type="button" class="pp-btn pp-btn--neutral pp-btn--sm" data-copy="${esc(
      form.id
    )}" data-testid="forms--copy">
      Request a copy${name}
    </button>`;
  }

  /*
   * A withdrawn consent leads with giving it again, and keeps a way back to
   * what was withdrawn. Without the second control the record would exist and
   * be unreachable, which is the same as not keeping it.
   */
  if (revoked) {
    const last = versions[versions.length - 1];
    return `
      <button type="button" class="pp-btn pp-btn--outline pp-btn--sm" data-open="${esc(form.id)}"
        data-testid="forms--regrant">
        Give consent again${name}
      </button>
      ${
        last
          ? glyphAction('eye', {
              form,
              tip: 'View what you withdrew',
              attrs: `data-view="${esc(form.id)}" data-version="${last.version}"
                data-testid="forms--view-withdrawn"`,
            })
          : ''
      }
    `;
  }

  /*
   * OUTLINED, not solid — the reference draws the one control on a pending
   * row as a bordered blue button, and a table of eight solid primaries is a
   * screen with eight things shouting at once. The outline is still the only
   * bordered thing in the row, so it is still obvious what to press.
   */
  if (outstanding) {
    return `<button type="button" class="pp-btn pp-btn--outline pp-btn--sm" data-open="${esc(
      form.id
    )}" data-testid="forms--start">
      ${drafted ? 'Continue' : consent ? 'Review &amp; Consent' : 'Start Form'}${name}
    </button>`;
  }

  /*
   * THE LABELLED CONTROL IS THE ONE THAT CHANGES SOMETHING, and it is the one
   * that differs between the two records — which is the whole reason there
   * are two tabs. A settled form offers EDIT: the answers were wrong and a
   * new version fixes them. A consent in force offers WITHDRAW: the answers
   * were not wrong, the permission has ended. Neither means anything on the
   * other kind, so neither can be a glyph the reader has to guess at.
   *
   * Reading the form and taking a copy of it are the same two errands on both,
   * they do nothing to the record, and they are the two the portal has glyphs
   * for — so they are drawn as glyphs, in the same order on both tabs. The
   * column has to hold still as the sub-tab switches under it.
   */
  const read = `
    ${glyphAction('eye', {
      form,
      tip: 'View',
      attrs: `data-open="${esc(form.id)}" data-testid="forms--view"`,
    })}
    ${glyphAction('download', {
      form,
      tip: 'Print or download',
      attrs: `data-print="${esc(form.id)}" data-testid="forms--print"`,
    })}`;

  if (consent) {
    return `
      <button type="button" class="pp-btn pp-btn--outline pp-btn--sm pp-forms__undo"
        data-revoke="${esc(form.id)}" data-testid="forms--revoke">
        Withdraw${name}
      </button>
      ${read}
    `;
  }

  return `
    <button type="button" class="pp-btn pp-btn--outline pp-btn--sm" data-amend="${esc(form.id)}"
      data-testid="forms--amend">
      ${icon('edit', { size: 'sm' })}Edit${name}
    </button>
    ${read}
  `;
}

/**
 * A row action drawn as its glyph alone.
 *
 * WHY THE LABELS CAME OFF. A settled row offers three things — read it, take
 * a copy away, and either correct it or withdraw it — and spelled out they
 * came to "View", "Print / Download" and "Correct this form" side by side in
 * the last column of a table. Three phrases do not fit across a column, so
 * they stacked, and every settled row became three lines tall: a table whose
 * Actions column was twice the height of the record it was acting on.
 *
 * So the row keeps ONE labelled control — the one that CHANGES something, see
 * action() — and the two that only read the record are their glyphs: the same
 * quiet icon button Cards already ends its own table row with, named the same
 * way. An eye for reading it and a tray-and-arrow for taking a copy away are
 * not glyphs anyone has to learn; the label survives as a tooltip and, for
 * anyone not using a pointer, as the button's accessible name.
 *
 * `title` is short and `aria-label` carries the form's name as well: a
 * tooltip repeating the name of the row it is sitting on is noise, while a
 * screen reader hearing "Print or download" out of the list needs to be told
 * which form it would be printing.
 */
function glyphAction(glyph, { form, tip, attrs, className = '' }) {
  return `
    <button type="button" class="pp-btn pp-btn--quiet pp-btn--sm pp-btn--icon ${esc(className)}"
      ${attrs} title="${esc(tip)}" aria-label="${esc(`${tip} — ${form.name}`)}">
      ${icon(glyph, { size: 'sm' })}
    </button>`;
}

/*
 * onclick, ASSIGNED rather than addEventListener'd.
 *
 * #screen survives every repaint, so a listener added here would be added
 * again on every return to the list — three trips back and one click opens
 * three forms. Assigning replaces whatever the other view left behind.
 */
function wireList(tabId, view) {
  host.onclick = (event) => {
    // The two strips. Intercepted so the module stays alive — see the header —
    // and preventDefault only after the link is known to be one of ours.
    const tab = event.target.closest('[data-tab]');
    if (tab) {
      event.preventDefault();
      // The record you are already on, on the view you are already on. The
      // link is real and would reload the page for nothing.
      if (tab.dataset.tab === tabId) return;
      return void go(listParams(tab.dataset.tab, view));
    }

    const subtab = event.target.closest('[data-view-tab]');
    if (subtab) {
      event.preventDefault();
      if (subtab.dataset.viewTab === view) return;
      /*
       * replaceState, unlike the record strip above: flipping between Pending
       * and Completed four times should not cost four presses of Back to
       * leave the screen. The address still changes, so a reload and a copied
       * link both land where the person is — the same call Health Records
       * makes for Current / Past.
       */
      return void go(listParams(tabId, subtab.dataset.viewTab), { replace: true });
    }

    // The name cell is a link and the button at the end of the row is a
    // button; both carry data-open, so the default is only prevented for the
    // one that has a default to prevent.
    const open = event.target.closest('[data-open]');
    if (open) {
      if (open.tagName === 'A') event.preventDefault();
      return void go({ form: open.dataset.open });
    }

    // `oneVersion`, not `view` — the strip above binds `view` as this
    // handler's argument, and a const of the same name here would put every
    // earlier reference to it in the temporal dead zone.
    const oneVersion = event.target.closest('[data-view]');
    if (oneVersion) {
      return void go({ form: oneVersion.dataset.view, version: oneVersion.dataset.version });
    }

    const amend = event.target.closest('[data-amend]');
    if (amend) return void go({ form: amend.dataset.amend, amend: '1' });

    const revoke = event.target.closest('[data-revoke]');
    if (revoke) return void openRevoke(revoke.dataset.revoke);

    const print = event.target.closest('[data-print]');
    if (print) {
      const form = formById(print.dataset.print);
      const entry = print.dataset.version
        ? versionAt(form.id, print.dataset.version)
        : currentVersion(form.id);
      return void printFormVersion(document.getElementById('printDoc'), form, entry);
    }

    const copy = event.target.closest('[data-copy]');
    if (!copy) return;
    const form = formById(copy.dataset.copy);
    toast(`This would ask the practice to send you a copy of the signed ${form.name}.`);
  };
}

/* ============================================================================
   ONE FORM — THE HEADER SHARED BY EVERY VIEW OF IT
   ========================================================================= */

/*
 * THE ARROW AND THE NAME, ON ONE LINE, AND NOTHING ELSE.
 *
 * The reference heads an open form with exactly that. What used to be here
 * as well — the category, a "Signature required" badge, a due-by chip, the
 * description, and a line naming the appointment it is wanted for — was the
 * LIST's job done twice: every one of those facts is on the row this form was
 * opened from, and repeating them on the document pushed the first question
 * of a long form below the fold.
 *
 * ONE BADGE SURVIVES, and only when reading back a completed version: which
 * version this is. That is not a fact from the list — it is what tells a
 * patient whether they are looking at what they sent last week or the
 * correction they filed yesterday, and the page has no other way to say it.
 */
function documentHead(form, { completed, entry }) {
  const tab = tabById(tabForForm(form));

  /*
   * A REAL ADDRESS ON THE ARROW, not just a click handler.
   *
   * It read `tab.href`, which TABS has never carried — the anchor came out
   * with href="", which is not a link at all: it cannot be tabbed to, it
   * cannot be opened in a new tab, and had the handler above it ever failed
   * to run it would have reloaded the form the patient was trying to leave.
   * Nobody met it while the only way into a form was clicking a row on this
   * screen, where Back and the browser's own back button agreed. The
   * dashboard's Forms & Consents card links straight to `?form=<id>`, so
   * arriving here with no history behind you is now the ordinary case.
   *
   * The destination is the panel the row is in NOW, which is what the click
   * handler navigates to as well — see listParamsFor().
   */
  const back = listHref(tabForForm(form), viewForForm(form));

  return `
    <header class="pp-form-doc__head">
      <a class="pp-form-doc__back" href="${esc(back)}" data-back
        aria-label="Back to ${esc(tab.label)}" data-testid="forms--back">
        ${icon('arrow-left')}
      </a>

      <h1 class="pp-section-title pp-form-doc__title">${esc(form.name)}</h1>

      ${
        completed && entry
          ? `<span class="pp-badge pp-badge--ok">Version ${entry.version} — ${
              form.kind === 'consent' ? 'given' : 'completed'
            } ${esc(entry.completedOn)}</span>`
          : ''
      }
    </header>
  `;
}

/* ============================================================================
   FILL MODE — and correction, which is the same form with a starting point
   ========================================================================= */

function fillView(form, amending) {
  const schema = schemaFor(form);
  const consent = form.kind === 'consent';
  const regranting = !amending && form.status === 'revoked';
  const draft = amending ? null : draftFor(form.id);
  const previous = amending ? currentVersion(form.id) : null;
  const withdrawn = regranting ? currentVersion(form.id) : null;
  /*
   * A saved draft outranks the "starts blank" notice, because it is no longer
   * true: the patient began giving this consent again, stopped, and their own
   * answers are what the fields carry. Two notices would contradict each
   * other, and the one to keep is the one describing what is on screen.
   */
  const blankStart = regranting && !draft;

  // Where each field's starting value comes from, in order of authority: the
  // version being corrected, then a saved draft, then the patient's record.
  const starting = previous?.answers ?? draft?.answers ?? null;

  return `
    ${documentHead(form, { completed: false, entry: null })}

    ${
      amending
        ? `<div class="pp-alert pp-alert--info pp-form-doc__notice">
             ${icon('info')}
             <span>
               <strong>You are correcting version ${previous.version}</strong>, completed
               ${esc(previous.completedOn)}. Your previous answers are filled in below —
               change only what was wrong. The old version is kept and stays viewable.
             </span>
           </div>`
        : /*
           * GIVING IT AGAIN STARTS BLANK, and says so.
           *
           * A correction prefills, because it is the same answers with a
           * mistake in them. This is not that: the patient withdrew this
           * permission, and filling the form back in with the answers they
           * took back would be the portal assuming they meant to give the
           * same thing again. The version they withdrew is one link away.
           */
          blankStart
          ? `<div class="pp-alert pp-alert--info pp-form-doc__notice"
               data-testid="forms--regrant-notice">
               ${icon('info')}
               <span>
                 <strong>You withdrew this consent on ${esc(form.revokedOn ?? '')}.</strong>
                 Giving it again starts from a blank form, so nothing you took back is
                 assumed.${
                   withdrawn
                     ? ` <button type="button" class="pp-link pp-link--button"
                          data-view="${esc(form.id)}" data-version="${withdrawn.version}"
                          data-testid="forms--regrant-view">Read what you withdrew</button>.`
                     : ''
                 }
               </span>
             </div>`
          : draft
            ? `<div class="pp-alert pp-alert--info pp-form-doc__notice">
                 ${icon('info')}
                 <span>Your saved answers are filled in below. Nothing has been sent yet.</span>
               </div>`
            : ''
    }

    <form class="pp-form-doc" id="fillForm" novalidate data-testid="forms--form">
      ${schema.map((section) => fillSection(section, starting)).join('')}

      ${
        amending
          ? `<section class="pp-form-doc__section" aria-labelledby="sec-amend">
               <h2 class="pp-form-doc__section-title" id="sec-amend">Why you are correcting it</h2>
               <div class="pp-form-doc__grid">
                 <div class="pp-field pp-form-doc__field pp-form-doc__field--wide">
                   <label class="pp-label" for="amendReason">
                     Reason for correction <span class="pp-form-doc__optional">(optional)</span>
                   </label>
                   <input class="pp-input" id="amendReason" type="text"
                     placeholder="e.g. I gave the wrong member ID"
                     data-testid="forms--amend-reason" />
                   <p class="pp-form-doc__hint">
                     Kept with this version so your care team can see what changed and why.
                   </p>
                 </div>
               </div>
             </section>`
          : ''
      }

      ${form.signatureRequired ? signatureMarkup() : ''}

      <footer class="pp-form-doc__foot">
        <div class="pp-form-doc__actions">
          <button type="button" class="pp-btn pp-btn--quiet" data-back>Cancel</button>
          ${
            amending
              ? ''
              : `<button type="button" class="pp-btn pp-btn--outline" data-save
                   data-testid="forms--save-draft">Save &amp; continue later</button>`
          }
          <button type="submit" class="pp-btn pp-btn--primary" data-testid="forms--submit">
            ${
              amending
                ? 'Submit correction'
                : consent
                  ? regranting
                    ? 'Give consent again'
                    : 'Give consent'
                  : 'Submit form'
            }
          </button>
        </div>
      </footer>
    </form>
  `;
}

/*
 * A <section> WITH A HEADING, NOT A <fieldset> WITH A LEGEND.
 *
 * A legend is the one element in HTML that is not laid out where it is
 * written: the browser lifts it into the fieldset's top border, and the only
 * ways to bring it back down — float it, or take it out of flow — both stop
 * being layout instructions and start being tricks. Floating it at full width
 * put the field grid BESIDE the heading rather than under it, in a 16rem
 * column hanging off the right of the card, because a grid establishes its
 * own formatting context and is laid out around a float rather than below it.
 *
 * So the group is a <section> named by its own <h2>, which is what read-back
 * has always drawn and which lays out where it is written. What is lost is
 * the fieldset's grouping semantics, and it is not much: the groups that
 * genuinely need one — a radio's options, a set of tick boxes — are still
 * fieldsets around the CONTROLS they group, which is the case the element is
 * for. A section of a long form is a heading, and aria-labelledby gives it a
 * name a screen reader can navigate by.
 */
function fillSection(section, starting) {
  const id = sectionId(section.title);
  return `
    <section class="pp-form-doc__section" aria-labelledby="${id}">
      <h2 class="pp-form-doc__section-title" id="${id}">${esc(section.title)}</h2>
      <div class="pp-form-doc__grid">
        ${section.fields.map((field) => fillField(field, starting)).join('')}
      </div>
    </section>
  `;
}

/** A section's heading id, the same one in fill mode and in read-back. */
const sectionId = (title) =>
  `sec-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

/** Wide fields take the whole row: prose and long option lists need it. */
const isWide = (field) =>
  field.type === 'textarea' ||
  field.type === 'checkboxGroup' ||
  field.type === 'radio' ||
  field.type === 'statement';

function fillField(field, starting) {
  // A statement is read, not answered. No control, no label, no error slot —
  // and collect() and validate() both skip it.
  if (field.type === 'statement') return statementBlock(field);

  const id = `fld-${field.key}`;
  const value = startingValue(field, starting);
  const required = field.required ? ' required' : '';
  const mark = field.required ? ' <span class="pp-label__req" aria-hidden="true">*</span>' : '';
  const error = `<p class="pp-field__error" id="${id}-error" hidden></p>`;

  // Groups carry their question in a <legend>, so they are fieldsets rather
  // than a label pointing at one of several inputs. `required` goes on the
  // inputs, not on the fieldset — a <fieldset> has no such attribute, and one
  // written there is a promise to a screen reader that nothing keeps.
  if (field.type === 'radio' || field.type === 'checkboxGroup') {
    const group = field.type === 'radio' ? radioGroup(field, value) : checkGroup(field, value);
    return `
      <fieldset class="pp-field pp-form-doc__field pp-form-doc__field--wide"
        data-field-wrap="${esc(field.key)}" aria-describedby="${id}-error">
        <legend class="pp-label">${esc(field.label)}${mark}</legend>
        ${group}
        ${error}
      </fieldset>`;
  }

  const control = (() => {
    switch (field.type) {
      case 'textarea':
        return `<textarea class="pp-textarea" id="${id}" rows="3"
          data-field="${esc(field.key)}"${required}
          aria-describedby="${id}-error">${esc(value)}</textarea>`;

      /* The chevron is OURS, not the platform's.
         A bare .pp-select keeps the browser's arrow, which was right while the
         list it opened was the browser's too. It is not any more — every
         dropdown in the portal now drops the panel in css/select-menu.css — so
         a field wearing a Chrome arrow over a MediNova list is the one place the
         seam shows. .pp-control--icon draws ours and turns the native one off. */
      case 'select':
        return `<div class="pp-control pp-control--icon">
          <select class="pp-select" id="${id}" data-field="${esc(field.key)}"
            data-empty="${!value}"${required} aria-describedby="${id}-error">
            <option value="" disabled hidden${value ? '' : ' selected'}>Select</option>
            ${field.options
              .map(
                (option) =>
                  `<option value="${esc(option)}"${
                    option === value ? ' selected' : ''
                  }>${esc(option)}</option>`
              )
              .join('')}
          </select>
          <span class="pp-control__icon">${icon('chevron-down')}</span>
        </div>`;

      case 'checkbox':
        return `<label class="pp-check">
          <input type="checkbox" id="${id}" data-field="${esc(field.key)}"${
            value ? ' checked' : ''
          } aria-describedby="${id}-error" />
          <span>${esc(field.label)}${mark}</span>
        </label>`;

      default:
        return `<input class="pp-input" id="${id}"
          type="${inputType(field.type)}" value="${esc(value)}"
          data-field="${esc(field.key)}"${required}
          ${field.readonly ? 'readonly' : ''} aria-describedby="${id}-error" />`;
    }
  })();

  // A single checkbox's label IS the question, so it must not get a second
  // one above it.
  if (field.type === 'checkbox') {
    return `<div class="pp-field pp-form-doc__field pp-form-doc__field--wide"
      data-field-wrap="${esc(field.key)}">
      ${control}
      ${error}
    </div>`;
  }

  return `
    <div class="pp-field pp-form-doc__field${isWide(field) ? ' pp-form-doc__field--wide' : ''}"
      data-field-wrap="${esc(field.key)}">
      <label class="pp-label" for="${id}">${esc(field.label)}${mark}</label>
      ${control}
      ${error}
    </div>
  `;
}

/** The paragraph a consent is actually about. */
function statementBlock(field) {
  return `
    <div class="pp-form-doc__field pp-form-doc__field--wide">
      <p class="pp-form-doc__statement">${esc(field.label)}</p>
    </div>`;
}

function radioGroup(field, value) {
  return `<div class="pp-choices">
    ${field.options
      .map(
        (option, index) => `
      <label class="pp-check">
        <input type="radio" name="${esc(field.key)}" value="${esc(option)}"
          data-field="${esc(field.key)}" data-option="${esc(option)}"
          ${option === value ? 'checked' : ''}${field.required ? ' required' : ''}
          ${index === 0 ? `id="fld-${esc(field.key)}"` : ''} />
        <span>${esc(option)}</span>
      </label>`
      )
      .join('')}
  </div>`;
}

function checkGroup(field, value) {
  const checked = Array.isArray(value) ? value : [];
  return `<div class="pp-choices pp-choices--grid">
    ${field.options
      .map(
        (option) => `
      <label class="pp-check">
        <input type="checkbox" value="${esc(option)}"
          data-field="${esc(field.key)}" data-option="${esc(option)}"
          ${checked.includes(option) ? 'checked' : ''} />
        <span>${esc(option)}</span>
      </label>`
      )
      .join('')}
  </div>`;
}

const inputType = (type) =>
  type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';

/* ============================================================================
   READ-BACK MODE

   Not a disabled copy of the form — a page of greyed controls is a form that
   looks broken. It is the answers, plainly, plus the signature that was given
   and when.
   ========================================================================= */

function readBack(form, entry) {
  const schema = schemaFor(form);
  const consent = form.kind === 'consent';
  const revoked = form.status === 'revoked';
  const versions = versionsFor(form.id);
  const current = versions[versions.length - 1];

  return `
    ${documentHead(form, { completed: true, entry })}

    ${
      /*
       * WITHDRAWN IS SAID BEFORE THE ANSWERS, not after them, and for the same
       * reason a superseded version is: this page can be read, printed and
       * filed by someone deciding whether the practice may act. They have to
       * learn that it no longer applies before they read what it says.
       */
      revoked && !entry?.superseded
        ? `<div class="pp-alert pp-alert--warning pp-form-doc__notice"
             data-testid="forms--withdrawn-banner">
             ${icon('alert-triangle')}
             <span>
               <strong>You withdrew this consent on ${esc(form.revokedOn ?? '')}.</strong>
               It applied from ${esc(entry?.completedOn ?? form.completedOn ?? '')} until then,
               and does not apply now.${
                 form.revokeReason
                   ? ` You gave the reason: “${esc(form.revokeReason)}”.`
                   : ''
               }
             </span>
           </div>`
        : ''
    }

    ${
      entry?.superseded
        ? `<div class="pp-alert pp-alert--warning pp-form-doc__notice"
             data-testid="forms--superseded-banner">
             ${icon('alert-triangle')}
             <span>
               This version was corrected on ${esc(entry.supersededOn)}.
               <button type="button" class="pp-link pp-link--button"
                 data-view="${esc(form.id)}" data-version="${current.version}"
                 data-testid="forms--view-current">View the current version</button>.
             </span>
           </div>`
        : ''
    }

    ${
      entry?.reason
        ? `<p class="pp-form-doc__reason">
             <strong>Reason for correction:</strong> ${esc(entry.reason)}
           </p>`
        : ''
    }

    <article class="pp-form-doc" data-testid="forms--answers">
      ${schema.map((section) => answerSection(section, entry?.answers)).join('')}
      ${signatureBlock(form, entry)}
    </article>

    <footer class="pp-form-doc__foot">
      <div class="pp-form-doc__actions">
        <button type="button" class="pp-btn pp-btn--quiet" data-back>
          Back to ${consent ? 'consents' : 'forms'}
        </button>
        <button type="button" class="pp-btn pp-btn--outline"
          data-print="${esc(form.id)}" data-version="${entry?.version ?? ''}"
          data-testid="forms--doc-print">Print / Download</button>
        ${lastAction(form, entry, { consent, revoked })}
      </div>
    </footer>
  `;
}

/**
 * The signature, as it was given.
 *
 * A form that required one and does not have one is stated rather than left
 * blank — an empty space where a signature should be reads as a rendering
 * fault, and the difference between "unsigned" and "we lost the image" is
 * exactly the thing a reader needs to know.
 */
function signatureBlock(form, entry) {
  if (!form.signatureRequired) return '';

  const sig = entry?.signature;
  if (!sig) {
    return `
      <section class="pp-form-doc__section">
        <h2 class="pp-form-doc__section-title">Signature</h2>
        <p class="pp-form-doc__hint">No signature was recorded against this version.</p>
      </section>`;
  }

  return `
    <section class="pp-form-doc__section pp-signed" data-testid="forms--signature-shown">
      <h2 class="pp-form-doc__section-title">Signature</h2>

      ${
        sig.dataUrl
          ? `<img class="pp-signed__image" src="${esc(sig.dataUrl)}"
               alt="Signature of ${esc(sig.name)}" />`
          : `<p class="pp-signed__name">${esc(sig.name)}</p>`
      }

      <dl class="pp-defs pp-signed__facts">
        <dt>Signed by</dt><dd>${esc(sig.name)}</dd>
        <dt>Date</dt><dd>${esc(sig.signedOn ?? entry.completedOn)}</dd>
        <dt>Method</dt>
        <dd>${signatureMethodLabel(sig)}, signed electronically
          through the patient portal</dd>
      </dl>
    </section>
  `;
}

function answerSection(section, answers) {
  // A section that is nothing but a statement has no answers to read back, so
  // it would print as a heading over an empty list.
  const asked = section.fields.filter((field) => field.type !== 'statement');
  if (!asked.length) return '';

  const id = sectionId(section.title);
  return `
    <section class="pp-form-doc__section" aria-labelledby="${id}">
      <h2 class="pp-form-doc__section-title" id="${id}">${esc(section.title)}</h2>
      <dl class="pp-defs pp-form-doc__answers">
        ${asked
          .map(
            (field) => `
          <dt>${esc(field.label)}</dt>
          <dd>${esc(answerText(field, answers?.[field.key]))}</dd>`
          )
          .join('')}
      </dl>
    </section>
  `;
}

/** An em dash for "left blank", the convention the rest of the portal uses. */
function answerText(field, value) {
  if (field.type === 'checkboxGroup') {
    return Array.isArray(value) && value.length ? value.join(', ') : '—';
  }
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  return value ? String(value) : '—';
}

/**
 * The last button on a document being read back.
 *
 * Only ever offered against the version in force. A superseded version can be
 * read and printed but not acted on: correcting an old version would file a
 * correction to something already corrected, and withdrawing one would take
 * back a permission that a later version has already replaced.
 */
function lastAction(form, entry, { consent, revoked }) {
  if (!entry || entry.superseded) return '';

  if (revoked) {
    return `<button type="button" class="pp-btn pp-btn--primary"
      data-open="${esc(form.id)}" data-testid="forms--doc-regrant">
      Give consent again
    </button>`;
  }

  if (consent) {
    return `<button type="button" class="pp-btn pp-btn--outline"
      data-revoke="${esc(form.id)}" data-testid="forms--doc-revoke">
      Withdraw consent
    </button>`;
  }

  return `<button type="button" class="pp-btn pp-btn--primary"
    data-amend="${esc(form.id)}" data-testid="forms--doc-amend">
    Correct this form
  </button>`;
}

function wireReadBack(form, entry) {
  host.onclick = (event) => {
    if (event.target.closest('[data-back]')) {
      event.preventDefault();
      return void go(listParamsFor(form));
    }

    // `oneVersion`, not `view` — the strip above binds `view` as this
    // handler's argument, and a const of the same name here would put every
    // earlier reference to it in the temporal dead zone.
    const oneVersion = event.target.closest('[data-view]');
    if (oneVersion) {
      return void go({ form: oneVersion.dataset.view, version: oneVersion.dataset.version });
    }

    const open = event.target.closest('[data-open]');
    if (open) return void go({ form: open.dataset.open });

    const amend = event.target.closest('[data-amend]');
    if (amend) return void go({ form: amend.dataset.amend, amend: '1' });

    const revoke = event.target.closest('[data-revoke]');
    if (revoke) return void openRevoke(revoke.dataset.revoke);

    const print = event.target.closest('[data-print]');
    if (print) printFormVersion(document.getElementById('printDoc'), form, entry);
  };
}

/* ============================================================================
   STARTING VALUES

   What a field shows before it is answered: the version being corrected or
   the saved draft where there is one, then the patient's own record where the
   practice already knows the answer, then today's date on a signing date, and
   otherwise nothing.
   ========================================================================= */

function startingValue(field, starting) {
  if (starting && Object.prototype.hasOwnProperty.call(starting, field.key)) {
    return starting[field.key];
  }
  if (field.prefillToday) return todayStamp();
  if (field.prefill) return field.prefill(PATIENT) ?? '';
  return field.type === 'checkboxGroup' ? [] : '';
}

/* ============================================================================
   SUBMIT, SAVE AND SIGN
   ========================================================================= */

function wireFill(form, amending) {
  host.onclick = (event) => {
    // "Read what you withdrew", from the notice at the top of a consent being
    // given again.
    // `oneVersion`, not `view` — the strip above binds `view` as this
    // handler's argument, and a const of the same name here would put every
    // earlier reference to it in the temporal dead zone.
    const oneVersion = event.target.closest('[data-view]');
    if (oneVersion) {
      return void go({ form: oneVersion.dataset.view, version: oneVersion.dataset.version });
    }

    if (!event.target.closest('[data-back]')) return;
    event.preventDefault();
    go(listParamsFor(form));
  };

  const fill = host.querySelector('#fillForm');
  if (!fill) return;

  const schema = schemaFor(form);
  const submit = fill.querySelector('[data-testid="forms--submit"]');

  /*
   * Submit is disabled until the form is signed, on the forms that need it.
   *
   * Disabled rather than "enabled and then refused": the requirement is that
   * it cannot be submitted unsigned, and a button that looks live and then
   * complains has already wasted the press. aria-disabled goes with it so the
   * state is announced rather than only drawn — and the signature block's own
   * live region says WHAT is missing, which is the half a disabled button
   * cannot communicate on its own.
   */
  if (form.signatureRequired) {
    signature = wireSignature(fill, {
      name: PATIENT.name,
      onChange: (signed) => {
        submit.disabled = !signed;
        submit.setAttribute('aria-disabled', String(!signed));
      },
    });
    submit.disabled = true;
    submit.setAttribute('aria-disabled', 'true');
  }

  // A field stops complaining as soon as it is touched. This is not
  // re-validation — it only withdraws a message that has stopped being true.
  fill.addEventListener('input', (event) => clearError(event.target));
  fill.addEventListener('change', (event) => {
    clearError(event.target);
    // Keeps a <select>'s placeholder grey until something is chosen — see the
    // [data-empty] rule in components.css.
    if (event.target.matches('select')) {
      event.target.dataset.empty = String(!event.target.value);
    }
  });

  const draftButton = fill.querySelector('[data-save]');
  if (draftButton) {
    draftButton.addEventListener('click', () => {
      /*
       * A draft is saved WITHOUT validation, on purpose.
       *
       * "Save & continue later" is for the form you cannot finish yet —
       * usually because you have to go and find a member ID. Refusing to save
       * it until it is complete would deny the exact case the button exists
       * for.
       */
      saveDraft(form.id, collect(schema, fill));
      go(listParamsFor(form));
      toast(`${form.name} saved. Pick it up whenever you like.`, 'ok');
    });
  }

  fill.addEventListener('submit', (event) => {
    event.preventDefault();

    const firstBad = validate(schema, fill);
    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    if (form.signatureRequired && !signature?.isSigned()) {
      const control = signature.complain();
      control.focus();
      control.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const reason = amending ? (fill.querySelector('#amendReason')?.value ?? '').trim() : '';

    const entry = addVersion(form.id, {
      answers: collect(schema, fill),
      signature: form.signatureRequired ? signature.read() : null,
      reason,
    });

    // The in-memory list is what the list view reads; the store is what
    // survives a reload. Both are updated, from the version just filed —
    // addVersion() has already dropped any withdrawal standing against it.
    const wasRevoked = form.status === 'revoked';
    form.status = 'completed';
    form.completedOn = entry.completedOn;
    form.answers = entry.answers;
    form.revokedOn = null;
    form.revokeReason = '';
    clearDraft(form.id);

    // Back to the list, REPLACING the form's address rather than adding to
    // it: Back from here should leave the screen, not return to a form that
    // has just been submitted and can no longer be filled in.
    go(listParamsFor(form), { replace: true });

    toast(message(form, entry, { amending, wasRevoked }), 'ok');
  });
}

/** What the toast says, which is not the same sentence for all four cases. */
function message(form, entry, { amending, wasRevoked }) {
  if (amending) {
    return `${form.name} corrected. Version ${entry.version} is now the current one, and version ${
      entry.version - 1
    } is kept.`;
  }
  if (wasRevoked) return `${form.name} given again. It applies from today.`;
  if (form.kind === 'consent') return `${form.name} given. You can withdraw it at any time.`;
  return `${form.name} submitted. Your care team will see it before your visit.`;
}

/* ============================================================================
   WITHDRAWING A CONSENT

   A CONFIRMATION, NOT AN UNDO TOAST. Withdrawing is the one thing on this
   screen that takes something away from the practice — records stop being
   released, reminders stop being sent — and the patient may not know what
   stops until they are told. So the dialog names the consent, says what
   ending it means, and asks for a reason it does not require: nobody has to
   justify taking back a permission, but a practice that is told why can often
   fix the thing that prompted it.

   The whole flow lives here rather than in a lib for the same reason the tab
   strip does — one caller, one screen.
   ========================================================================= */

/** The consent the open dialog is about. */
let withdrawing = null;

function revokeParts() {
  return {
    modal: document.getElementById('revokeModal'),
    body: document.getElementById('revokeBody'),
    reason: document.getElementById('revokeReason'),
    keep: document.getElementById('keepConsent'),
    confirm: document.getElementById('confirmRevoke'),
    close: document.getElementById('closeRevoke'),
  };
}

function openRevoke(id) {
  const form = formById(id);
  if (!form || form.kind !== 'consent' || form.status !== 'completed') return;

  const el = revokeParts();
  if (!el.modal) return;

  withdrawing = form;
  const entry = currentVersion(form.id);

  el.body.innerHTML = `
    <div class="pp-alert pp-alert--warning" data-testid="forms--revoke-warning">
      ${icon('info')}
      <div>
        <p class="pp-alert__heading">The practice stops acting on this from today.</p>
        <p class="pp-alert__body">${esc(stops(form))}</p>
      </div>
    </div>

    <dl class="pp-defs pp-revoke__facts">
      <dt>Consent</dt><dd>${esc(form.name)}</dd>
      <dt>Given</dt><dd>${esc(entry?.completedOn ?? form.completedOn ?? '—')}</dd>
      <dt>Signed</dt>
      <dd>${
        form.signatureRequired ? esc(entry?.signature?.name ?? PATIENT.name) : 'No signature'
      }</dd>
    </dl>

    <p class="pp-revoke__note">
      <strong>Nothing is deleted.</strong> The signed copy stays on your record, so there is
      always an answer to what you agreed to and when it applied. You can give this consent
      again at any time.
    </p>
  `;

  el.reason.value = '';
  el.modal.showModal();
  // Keep, not Withdraw. The dialog opens on the harmless answer, so a
  // reflexive Enter costs nothing.
  el.keep.focus();
}

/**
 * What actually stops, in this consent's own terms.
 *
 * "You are withdrawing your consent" tells a patient what they already
 * pressed. The thing they cannot know without being told is which behaviour
 * of the practice ends — and for two of these it is the one they rely on.
 * Anything without a line of its own gets the general answer rather than a
 * guess.
 */
function stops(form) {
  switch (form.id) {
    case 'form-roi':
      return 'Your records stop being released to the people and organisations this authorises. Anything already sent cannot be recalled.';
    case 'form-insurance-disclosure':
      return 'The practice stops billing your insurer directly for this care. Balances come to you instead, and you stay responsible for them.';
    case 'form-telehealth':
      return 'Video visits stop being offered. Appointments already booked as video will need to be moved to the clinic.';
    case 'form-text-policy':
      return 'Appointment reminders and results notifications stop being texted to you. The portal and the phone still reach you.';
    case 'form-consent-treatment':
      return 'The practice cannot examine, test or treat you under this consent. Care already given is unaffected, and urgent care is never withheld.';
    default:
      return 'The practice stops relying on this permission. Anything done while it applied is unaffected.';
  }
}

function wireRevoke() {
  const el = revokeParts();
  if (!el.modal) return;

  const dismiss = () => el.modal.close();

  el.close.addEventListener('click', dismiss);
  el.keep.addEventListener('click', dismiss);

  // The <dialog> itself is the backdrop's hit target; a click on the box
  // arrives from a child, which is what separates the two.
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) dismiss();
  });

  // Escape, the close button and the backdrop all land here. Forgetting the
  // consent on the way out is what stops a stale one being withdrawn by the
  // next press of Withdraw.
  el.modal.addEventListener('close', () => {
    withdrawing = null;
  });

  el.confirm.addEventListener('click', () => {
    // Read before dismiss(): closing fires the handler above, which forgets it.
    const form = withdrawing;
    if (!form) return;
    const reason = el.reason.value.trim();

    // The store first, because it is the thing that survives; the in-memory
    // row is brought into line with what was written, not the other way round.
    // Nothing filed means no version to withdraw, which openRevoke's guard
    // makes unreachable — but it is checked rather than assumed, because the
    // alternative is a row marked withdrawn against a record that says
    // nothing of the kind.
    const filed = addRevocation(form.id, reason);
    if (!filed) return void dismiss();
    revokeConsent(form.id, filed.revokedOn, reason);

    dismiss();
    go(listParamsFor(form), { replace: true });

    toast(`${form.name} withdrawn. The signed copy is kept on your record.`, 'ok');
  });
}

/**
 * The required fields, in the order they are drawn.
 *
 * Returns the first control that failed, so the caller can focus it — a form
 * this long is one where "something is wrong" without saying where means
 * scrolling through forty fields to find out.
 */
function validate(schema, container) {
  let firstBad = null;

  for (const section of schema) {
    for (const field of section.fields) {
      if (!field.required || field.type === 'statement') continue;

      const answered =
        field.type === 'radio' || field.type === 'checkboxGroup'
          ? [...container.querySelectorAll(`[data-field="${field.key}"]`)].some((el) => el.checked)
          : field.type === 'checkbox'
            ? Boolean(container.querySelector(`[data-field="${field.key}"]`)?.checked)
            : Boolean(container.querySelector(`[data-field="${field.key}"]`)?.value.trim());

      if (answered) continue;

      const control = container.querySelector(`[data-field="${field.key}"]`);
      const wrap = container.querySelector(`[data-field-wrap="${field.key}"]`);
      const slot = wrap?.querySelector('.pp-field__error');

      if (slot) {
        // A field may carry its own wording — "Type your full name to sign"
        // says more than "this one is needed" on the one field people stop at.
        slot.textContent =
          field.requiredMessage ??
          (field.type === 'radio' || field.type === 'select'
            ? 'Choose an answer.'
            : 'This one is needed.');
        slot.hidden = false;
      }
      control?.setAttribute('aria-invalid', 'true');
      firstBad ??= control;
    }
  }

  return firstBad;
}

function clearError(control) {
  const wrap = control.closest('[data-field-wrap]');
  if (!wrap) return;
  wrap.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const slot = wrap.querySelector('.pp-field__error');
  if (!slot) return;
  slot.hidden = true;
  slot.textContent = '';
}

/**
 * Read every answer back out, keyed the way data/forms.js defines them.
 *
 * A readonly field is never asked of the DOM. Its value came from the
 * patient's record, and recomputing it is what stops a typed-over field —
 * or a browser that restored an old value — entering the record as an answer.
 */
function collect(schema, container) {
  const answers = {};

  for (const section of schema) {
    for (const field of section.fields) {
      if (field.type === 'statement') continue;

      if (field.readonly) {
        answers[field.key] = startingValue(field, null);
        continue;
      }

      if (field.type === 'checkboxGroup') {
        answers[field.key] = [...container.querySelectorAll(`[data-field="${field.key}"]`)]
          .filter((el) => el.checked)
          .map((el) => el.dataset.option);
        continue;
      }

      if (field.type === 'radio') {
        answers[field.key] =
          [...container.querySelectorAll(`[data-field="${field.key}"]`)].find((el) => el.checked)
            ?.value ?? '';
        continue;
      }

      const control = container.querySelector(`[data-field="${field.key}"]`);
      answers[field.key] =
        field.type === 'checkbox' ? Boolean(control?.checked) : (control?.value ?? '').trim();
    }
  }

  return answers;
}


