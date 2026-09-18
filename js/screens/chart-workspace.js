/**
 * CHART WORKSPACE — the seam between the frame and the modules.
 *
 * The patient chart is one shell (top bar, sidebar, patient header) and one
 * changing panel. This file owns the panel, and nothing else on the screen
 * knows what is inside it.
 *
 * ADDING A MODULE — this is the whole contract:
 *
 *   // js/screens/chart-vitals.js
 *   import { registerModule } from './chart-workspace.js';
 *
 *   registerModule('vitals', {
 *     tabs: () => `<ui-tabs primary selected="table"> … </ui-tabs>`,
 *     actions: () => `<ui-button size="sm" variant="outline">Print</ui-button>`,
 *     render(host, ctx) {
 *       host.innerHTML = `…`;          // ctx.patient, ctx.age, ctx.go(id)
 *       return () => { …optional teardown… };
 *     },
 *   });
 *
 * `ctx.intent` is how a chart-wide action tells the module it has just landed
 * in what to open — `{ action, trigger }`, or null, which is what it is on
 * every ordinary navigation. Orders reads it for `new-referral`: the Refer Out
 * button lives in the chart header, but the referral form belongs here, so the
 * header navigates and says what it wanted rather than growing a copy of the
 * form. A module reads it during render() and nowhere else; the shell clears
 * it the moment renderWorkspace() returns, so a later repaint never reopens
 * the same dialog.
 *
 * `hideTitle: true` is optional and hides the shell-drawn section name from
 * the screen while leaving it in the document for assistive tech — for the
 * modules whose view switch already names the section. It may also be a
 * function of ctx, for a module whose switch is itself conditional: the name
 * is only redundant while something else on the row is saying it, and a head
 * with neither a title nor a strip on it says nothing at all.
 *
 * `tabs` is optional and is the module's own top-level switch — a strip that
 * changes WHICH VIEW of this section is on screen, not which section. It is
 * drawn by the shell, on the module's head row between the heading and the
 * actions, so every module that has one puts it in the same place; a strip
 * each module drew for itself inside its own body would sit at a different
 * height in each. The module wires its own listener in render(): the strip is
 * rebuilt with the head on every switch, so a listener on it dies with it.
 *
 * …then add one import line to patient-chart.js. The module never touches the
 * header, the sidebar or the routing, and it cannot break them: a module that
 * throws is caught here and reported inside its own panel.
 *
 * WHY A REGISTRY AND NOT A BIG SWITCH
 * Modules land one at a time over weeks. A registry means each arrives as a
 * new file plus one import — no shared file grows a branch per module, and
 * two modules being built in parallel never touch the same lines.
 *
 * WHY EVERY MODULE GETS A TEARDOWN
 * Modules will own timers, drawers and document-level listeners. Returning a
 * cleanup function from render() is the only reliable way to stop those when
 * the user switches away; without it the chart accumulates listeners for as
 * long as the tab is open.
 */
import { CHART_NAV } from '../../data/patient-chart.js';

/** id → module definition. Populated by registerModule at import time. */
const REGISTRY = new Map();

/** The teardown returned by the module currently on screen, if any. */
let disposeCurrent = null;

/**
 * Label and icon come from the nav definition rather than being repeated in
 * the module — the sidebar and the panel title are then the same string by
 * construction, and a rename happens in one place.
 */
const NAV_INDEX = new Map();
for (const item of CHART_NAV) {
  NAV_INDEX.set(item.id, item);
  for (const child of item.children || []) {
    NAV_INDEX.set(child.id, { ...child, parent: item });
  }
}

/** Every id the router will accept, in sidebar order. */
export const MODULE_IDS = [...NAV_INDEX.keys()];

export function navItem(id) {
  return NAV_INDEX.get(id) || null;
}

/** Sidebar label, with the parent prefixed for a sub-item ("Profile · Clinical"). */
export function moduleTitle(id) {
  const item = NAV_INDEX.get(id);
  if (!item) return 'Unknown section';
  return item.parent ? `${item.parent.label} · ${item.label}` : item.label;
}

export function registerModule(id, definition) {
  if (!NAV_INDEX.has(id)) {
    // A module for a section that is not in the nav would render into a panel
    // nothing can reach. Better to say so at import time than to ship a
    // dead file.
    console.warn(`[chart] "${id}" is not in CHART_NAV — it will never be shown.`);
  }
  REGISTRY.set(id, definition);
}

export function isRegistered(id) {
  return REGISTRY.has(id);
}

/* ============================================================================
   THE PLACEHOLDER

   Every section in the sidebar is reachable from the day the shell ships,
   whether or not its module exists yet. An unbuilt section says so plainly
   and names what will live there — a nav item that silently does nothing
   reads as a bug, and gets reported as one.
   ========================================================================= */

/** One line per section, so the placeholder is specific rather than generic. */
const PLANNED = {
  profile: 'Demographics, contacts, insurance and consents — the record of who this person is.',
  'profile-clinical': 'Problems, allergies, medications, family and social history.',
  appointments: 'Booked visits for this patient — upcoming and past.',
  'visit-notes': 'Signed and draft encounter notes, newest first.',
  prescriptions: 'Active and past medications.',
  medications: 'Every drug the patient is taking now, prescribed here or reported.',
  orders: 'Lab, imaging, referral and non-visit orders, with their status.',
  forms: 'Intake, consent and questionnaire forms — assigned, in progress and completed.',
  vitals: 'Recorded vitals over time, as a table and a trend.',
  tasks: 'Work owed on this patient: who owes it, when it is due.',
  notes: 'Free-text notes that are not part of an encounter.',
  documents: 'Uploaded and generated files — reports, referrals, scanned records.',
  billing: 'Charges, claims, payments and the outstanding balance.',
};

function placeholder(id) {
  return `<div class="ch__placeholder" data-testid="chart--placeholder">
      <span class="ch__placeholder-mark" aria-hidden="true">
        <svg class="ui-icon"><use href="#i-${navItem(id)?.icon || 'document'}"></use></svg>
      </span>
      <h3 class="ch__placeholder-title">${moduleTitle(id)} is not built yet</h3>
      <p class="ch__placeholder-body">${PLANNED[id] || ''}</p>
    </div>`;
}

/* ============================================================================
   THE SCROLLED STATE

   The module head is stuck to the top of the workspace (see .ch__module-head
   in css/screen-chart.css). A band that is stuck needs to say so — otherwise
   the first row scrolling under it looks like a row that has been clipped for
   no reason. It says so with a shadow, and only once there is something
   underneath it to cast onto: at the top of a module the head is simply the
   first thing on the page and a shadow there would be describing a depth that
   is not yet real.

   The workspace outlives the modules that render into it, so the listener is
   attached to it once and the flag is cleared on every swap — replacing the
   panel's markup returns it to scrollTop 0, and the attribute has to follow.
   ========================================================================= */

/** Workspace elements already carrying the scroll listener. */
const SCROLL_WATCHED = new WeakSet();

function watchScroll(root) {
  root.removeAttribute('data-scrolled');

  if (SCROLL_WATCHED.has(root)) return;
  SCROLL_WATCHED.add(root);

  root.addEventListener(
    'scroll',
    () => {
      root.toggleAttribute('data-scrolled', root.scrollTop > 0);
    },
    { passive: true },
  );
}

/* ============================================================================
   RENDER
   ========================================================================= */

/**
 * Swap the panel to `id`.
 *
 * @param {string} id      module id from CHART_NAV
 * @param {Element} root   the workspace element
 * @param {object} ctx     { patient, age, intent, go, flash } handed to the module
 */
export function renderWorkspace(id, root, ctx) {
  // Tear the outgoing module down BEFORE its markup is replaced, so its
  // cleanup still has the nodes it registered against.
  if (typeof disposeCurrent === 'function') {
    try {
      disposeCurrent();
    } catch (error) {
      console.error('[chart] module teardown failed', error);
    }
  }
  disposeCurrent = null;

  const module = REGISTRY.get(id);
  const title = moduleTitle(id);

  /* The head states the section and nothing else. It used to carry a line of
     explanation under the title as well, and a sentence describing a section
     is read exactly once: after that it is a band of grey text between the
     reader and the record, on every visit to every section, saying what the
     table below it has already said.

     `hideTitle` takes the name off the screen without taking it out of the
     document: the h2 is still there for a screen reader and for the document
     outline, it is only stopped from being drawn. A module asks for this when
     something else on the row already says where you are. Because .u-sr-only
     is absolutely positioned, the hidden h2 is not a flex item — it takes no
     width and no gap, so whatever follows it starts at the panel's left edge
     rather than one gap in from it.

     A module may answer with a function instead of `true` when the thing that
     makes the name redundant is not always there — Medication's strip appears
     only for a patient who has had a procedure, and on every other chart the
     title is the only word on the row. Asked per patient, the head is never
     left blank. */
  const hideTitle =
    typeof module?.hideTitle === 'function' ? module.hideTitle(ctx) : module?.hideTitle;

  root.innerHTML = `<header class="ch__module-head">
      <h2 class="ch__module-title${
        hideTitle ? ' u-sr-only' : ''
      }" data-testid="chart--module-title">${title}</h2>
      ${
        module?.tabs
          ? `<div class="ch__module-tabs" data-testid="chart--module-tabs">${module.tabs(ctx)}</div>`
          : ''
      }
      <div class="ch__module-actions" data-testid="chart--module-actions">
        ${module?.actions ? module.actions(ctx) : ''}
      </div>
    </header>
    <div class="ch__module-body" data-module="${id}"></div>`;

  watchScroll(root);

  const body = root.querySelector('.ch__module-body');

  if (!module) {
    body.innerHTML = placeholder(id);
    return;
  }

  // A module is other people's code running inside our frame. If it throws,
  // the chart keeps working and the failure stays inside the panel.
  try {
    disposeCurrent = module.render(body, ctx) || null;
  } catch (error) {
    console.error(`[chart] module "${id}" failed to render`, error);
    body.innerHTML = `<ui-alert severity="critical" heading="${title} could not be displayed">
        The rest of the chart is unaffected. Details are in the console.
      </ui-alert>`;
  }
}
