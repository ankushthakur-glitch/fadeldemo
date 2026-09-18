/**
 * PRACTICE SETTINGS → ROLES & RESPONSIBILITY
 *
 * Role Type → Role → a permission matrix of every feature in the product
 * against every action that can be taken on it.
 *
 * THE ONE DESIGN DECISION EVERYTHING ELSE FOLLOWS FROM: the matrix is
 * read-only until "Edit Permissions" is pressed. A grid of 28 × 8 live
 * checkboxes invites an accidental click that silently changes who can delete
 * a claim, and nothing on screen would say it had happened. Read mode shows
 * ticks and crosses — faster to scan and impossible to change by mistake.
 *
 * WHILE EDITING, nothing is written back until Save. `draft` is a working
 * copy; `saved` is what the role currently grants. Every difference between
 * them is counted into the banner and itemised in the change summary, so the
 * administrator sees the diff before committing rather than a success toast
 * afterwards.
 *
 * WHY THE TABLE IS HAND-BUILT
 * <ui-data-table> is a flat list of rows. This grid has group headers
 * ("Clinical", "Revenue Cycle") that span the row, a summary "All" column
 * computed from its neighbours, and cells that switch between glyph and
 * checkbox. It borrows the component's .ui-table classes so the density,
 * borders and sticky header stay identical to every other table in the app.
 */
import {
  ROLE_TYPES,
  ROLES,
  FEATURE_GROUPS,
  FEATURES,
  FEATURE_INDEX,
  PERMISSION_ACTIONS,
  ACTION_IDS,
  permissionsFor,
  blankPermissions,
  LOCKED_FOR_RESERVED,
  PERMISSION_AUDIT,
  jobRoles,
} from '../../data/practice-roles.js';
import { PROVIDER_ROLES, STAFF_ROLES } from '../../data/practice.js';
import { notify } from '../lib/toast.js';

/* The roles this screen configures are exactly the roles Add User offers. */
const ASSIGNABLE_ROLES = jobRoles([...PROVIDER_ROLES, ...STAFF_ROLES]);

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const icon = (name, className = 'ui-icon') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

function todayDdMmYyyy() {
  const now = new Date();
  return [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    now.getFullYear(),
  ].join('-');
}

function nowHhMm() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const CURRENT_USER = 'Amara Mensah';
const slug = (value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* ============================================================================
   STATE

   `roleTypes` and `roles` are working copies. Creating a role in the prototype
   has to survive a tab switch but must not write back into the data file.
   ========================================================================= */

const state = {
  roleTypes: ROLE_TYPES.map((t) => ({ ...t })),
  roles: ASSIGNABLE_ROLES.map((r) => ({ ...r })),
  audit: PERMISSION_AUDIT.map((a) => ({ ...a })),

  typeId: 'job',
  roleId: ASSIGNABLE_ROLES[0].id,

  editing: false,
  saved: null, // the role's committed matrix
  draft: null, // the working copy while editing
  showChanges: false,
  featureSearch: '',
};

const els = {};

/* ============================================================================
   DERIVED
   ========================================================================= */

const typeById = (id) => state.roleTypes.find((t) => t.id === id) || null;
const roleById = (id) => state.roles.find((r) => r.id === id) || null;

/** Every assignable role, in the order the practice agreed. */
function rolesForType() {
  return state.roles;
}

function currentRole() {
  return roleById(state.roleId);
}

/** What the matrix should display: the draft while editing, else the saved set. */
function activeMatrix() {
  return state.editing ? state.draft : state.saved;
}

/** Features narrowed by the feature search, keeping their group order. */
function visibleGroups() {
  const query = state.featureSearch.trim().toLowerCase();
  if (!query) return FEATURE_GROUPS;
  return FEATURE_GROUPS.map((group) => ({
    ...group,
    features: group.features.filter(
      (f) =>
        f.label.toLowerCase().includes(query) || group.label.toLowerCase().includes(query)
    ),
  })).filter((group) => group.features.length);
}

/** Every draft/saved disagreement, as one entry per feature+action. */
function changeList() {
  if (!state.editing || !state.draft || !state.saved) return [];
  const out = [];
  for (const feature of FEATURES) {
    for (const action of ACTION_IDS) {
      const before = state.saved[feature.id][action];
      const after = state.draft[feature.id][action];
      if (before !== after) out.push({ feature, action, granted: after });
    }
  }
  return out;
}

/** The same changes folded by feature — how the summary table reads. */
function changesByFeature() {
  const map = new Map();
  for (const change of changeList()) {
    if (!map.has(change.feature.id)) {
      map.set(change.feature.id, { feature: change.feature, granted: [], removed: [] });
    }
    const entry = map.get(change.feature.id);
    const label = PERMISSION_ACTIONS.find((a) => a.id === change.action).label;
    (change.granted ? entry.granted : entry.removed).push(label);
  }
  return [...map.values()];
}

/** A row is "All" when every action on it is granted. */
const rowIsAll = (matrix, featureId) => ACTION_IDS.every((a) => matrix[featureId][a]);
const rowIsNone = (matrix, featureId) => ACTION_IDS.every((a) => !matrix[featureId][a]);

/**
 * Reserved roles keep the three screens that would otherwise lock everyone
 * out. The cell is still drawn — it is disabled and explains itself, rather
 * than silently ignoring the click.
 */
const isLocked = (role, featureId) =>
  Boolean(role?.reserved) && LOCKED_FOR_RESERVED.includes(featureId);

/* ============================================================================
   RENDER — matrix
   ========================================================================= */

/**
 * role="img" + aria-label rather than a visually-hidden text node.
 *
 * Hidden text still counts as text: u-sr-only clips the span rather than
 * removing it, so the word "Granted" inherited the tick's green and failed
 * contrast against white — a real reported violation for a string nobody can
 * see. Naming the image says the same thing to a screen reader with nothing
 * to render.
 */
function glyph(granted) {
  const label = granted ? 'Granted' : 'Not granted';
  const tone = granted ? 'yes' : 'no';
  return `<span class="rol__glyph rol__glyph--${tone}" role="img" aria-label="${label}">${icon(
    granted ? 'check' : 'close'
  )}</span>`;
}

function cell(role, matrix, featureId, action, label) {
  const granted = matrix[featureId][action];
  if (!state.editing) return `<td class="rol__cell">${glyph(granted)}</td>`;

  const locked = isLocked(role, featureId);
  return `<td class="rol__cell">
    <input type="checkbox" class="rol__check" data-feature="${featureId}" data-action="${action}"
      ${granted ? 'checked' : ''} ${locked ? 'disabled' : ''}
      ${locked ? `title="${esc(role.name)} must keep this to administer the system"` : ''}
      aria-label="${esc(label)} on ${esc(FEATURE_INDEX[featureId].label)}">
  </td>`;
}

function allCell(role, matrix, featureId) {
  const granted = rowIsAll(matrix, featureId);
  if (!state.editing) return `<td class="rol__cell">${glyph(granted)}</td>`;

  const partial = !granted && !rowIsNone(matrix, featureId);
  return `<td class="rol__cell">
    <input type="checkbox" class="rol__check rol__check--all" data-feature="${featureId}" data-action="all"
      ${granted ? 'checked' : ''}
      aria-label="All permissions on ${esc(FEATURE_INDEX[featureId].label)}"
      data-partial="${partial}">
  </td>`;
}

function matrixMarkup() {
  const role = currentRole();
  const matrix = activeMatrix();
  const groups = visibleGroups();

  if (!role || !matrix) {
    return `<p class="rol__empty">Choose a role type and a role to see its permissions.</p>`;
  }
  if (!groups.length) {
    return `<p class="rol__empty" data-testid="rol--no-features">No feature matches “${esc(
      state.featureSearch
    )}”.</p>`;
  }

  const columns = PERMISSION_ACTIONS.length + 2; // Feature + All + actions

  return `<table class="ui-table rol__table" data-testid="rol--matrix">
    <thead>
      <tr>
        <th scope="col" class="rol__feature-col">Features</th>
        <th scope="col" class="rol__all-col">All</th>
        ${PERMISSION_ACTIONS.map((a) => `<th scope="col">${a.label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${groups
        .map(
          (group) => `
        <tr class="rol__group-row">
          <th scope="colgroup" colspan="${columns}">
            ${esc(group.label)}
          </th>
        </tr>
        ${group.features
          .map(
            (feature) => `
          <tr data-row="${feature.id}">
            <th scope="row" class="rol__feature">${esc(feature.label)}</th>
            ${allCell(role, matrix, feature.id)}
            ${PERMISSION_ACTIONS.map((a) => cell(role, matrix, feature.id, a.id, a.label)).join('')}
          </tr>`
          )
          .join('')}`
        )
        .join('')}
    </tbody>
  </table>`;
}

/* ============================================================================
   RENDER — banner and change summary
   ========================================================================= */

function bannerMarkup() {
  const count = changeList().length;
  if (!state.editing || count === 0) return '';

  return `<div class="rol__banner" role="status" data-testid="rol--banner">
    <div class="rol__banner-head">
      <span class="rol__banner-title">
        ${icon('warning')}
        ${count} Permission Change${count === 1 ? '' : 's'} Pending
      </span>
      <div class="rol__banner-actions">
        <button type="button" class="rol__banner-link" data-toggle-changes
          aria-expanded="${state.showChanges}" data-testid="rol--view-changes">
          ${state.showChanges ? 'Hide' : 'View'} All Changes ${icon(
            state.showChanges ? 'caret-up' : 'caret-down'
          )}
        </button>
        <ui-button size="xs" variant="outline" data-testid="rol--discard">Discard Changes</ui-button>
      </div>
    </div>
    ${state.showChanges ? changeTableMarkup() : ''}
  </div>`;
}

function changeTableMarkup() {
  const role = currentRole();
  const rows = changesByFeature();

  return `<table class="rol__changes" data-testid="rol--change-summary">
    <thead>
      <tr>
        <th scope="col">Role</th>
        <th scope="col">Feature</th>
        <th scope="col"><span class="rol__removed-mark">${icon('close')}</span> Access Removed</th>
        <th scope="col"><span class="rol__granted-mark">${icon('check')}</span> Access Granted</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row, index) => `
        <tr>
          ${
            index === 0
              ? `<td rowspan="${rows.length}" class="rol__changes-role">
                   <span class="rol__role-pill">${esc(role.name)}</span>
                 </td>`
              : ''
          }
          <td>${esc(row.feature.label)}</td>
          <td>${row.removed.length ? row.removed.map((l) => `<span>${l}</span>`).join('') : '<span class="rol__muted">—</span>'}</td>
          <td>${row.granted.length ? row.granted.map((l) => `<span>${l}</span>`).join('') : '<span class="rol__muted">—</span>'}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

/* ============================================================================
   RENDER — toolbar, statistics, history
   ========================================================================= */

/**
 * The role picker.
 *
 * One dropdown rather than a wall of chips. Fifteen roles laid out as chips
 * took two rows above the matrix and pushed the thing you came to read below
 * the fold; the matrix is what this tab is for, so the picker gets one line.
 * The role's own detail — who holds it, when it changed — is in the stats
 * card under the matrix, which is where the chip counts went.
 */
function roleSelectMarkup() {
  return `<div class="rol__picker">
      <ui-select class="rol__role-select" size="sm" label="Role Type" id="rolRoleSelect"
        data-testid="rol--role-select"></ui-select>
    </div>`;
}

function toolbarMarkup() {
  const role = currentRole();

  return `<div class="rol__filters">
      ${roleSelectMarkup()}

      <div class="rol__filters-end">
        ${
          state.editing
            ? `<ui-button size="sm" variant="outline" data-testid="rol--select-all">Select all</ui-button>
               <ui-button size="sm" variant="outline" data-testid="rol--clear-all">Clear all</ui-button>
               <ui-button size="sm" variant="outline" icon="copy" data-testid="rol--copy">Copy Permissions</ui-button>
               <ui-button size="sm" variant="outline" icon="upload" data-testid="rol--import">Import</ui-button>
               <ui-button size="sm" variant="outline" icon="upload" data-testid="rol--export">Export</ui-button>
               <ui-button size="sm" variant="tertiary" data-testid="rol--cancel">Cancel</ui-button>
               <ui-button size="sm" variant="primary" data-testid="rol--save">Save Changes</ui-button>`
            : `<ui-button size="sm" variant="outline" icon="upload" data-testid="rol--export">Export</ui-button>
               <ui-button size="sm" variant="outline" icon="pencil" data-testid="rol--edit"
                 ${role ? '' : 'disabled'}>Edit Permissions</ui-button>`
        }
      </div>
    </div>`;
}

function statsMarkup() {
  const role = currentRole();
  if (!role) return '';

  const granted = FEATURES.reduce(
    (total, f) => total + ACTION_IDS.filter((a) => state.saved[f.id][a]).length,
    0
  );
  const possible = FEATURES.length * ACTION_IDS.length;

  const facts = [
    ['Users assigned', `${role.users}`],
    ['Permissions granted', `${granted} of ${possible}`],
    ['Last updated', role.updatedOn],
    ['Updated by', role.updatedBy],
    ['Status', role.status === 'active' ? 'Active' : 'Inactive'],
  ];

  return `<section class="rol__stats" data-testid="rol--stats">
      <header class="rol__stats-head">
        <div>
          <h3 class="rol__stats-title">${esc(role.name)}</h3>
          <p class="rol__stats-sub">${esc(role.description)}</p>
        </div>
        <div class="rol__stats-actions">
          <!-- No delete. These are the roles Add User assigns, not records
               somebody created here — removing one would leave the people
               holding it with no role at all. Permissions are what this tab
               changes. -->
          <ui-badge status="info" size="sm">${role.users} assigned</ui-badge>
        </div>
      </header>
      <dl class="rol__facts">
        ${facts
          .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
          .join('')}
      </dl>
    </section>`;
}

function historyMarkup() {
  const entries = state.audit.filter((entry) => entry.roleId === state.roleId);

  return `<section class="rol__history" data-testid="rol--history">
      <h3 class="rol__stats-title">Permission history</h3>
      ${
        entries.length
          ? `<ol class="rol__history-list">
              ${entries
                .map(
                  (entry) => `<li class="rol__history-item">
                    <span class="rol__history-when">${esc(entry.date)} · ${esc(entry.time)}</span>
                    <p class="rol__history-what">${esc(entry.summary)}</p>
                    <span class="rol__history-who">${esc(entry.by)} · ${entry.changes} change${
                      entry.changes === 1 ? '' : 's'
                    }</span>
                  </li>`
                )
                .join('')}
            </ol>`
          : `<p class="rol__muted">No permission changes recorded against this role yet.</p>`
      }
    </section>`;
}

/* ============================================================================
   PAINT
   ========================================================================= */

function paint() {
  if (!els.panel) return;

  // The matrix scrolls in both directions, so it is a focusable region: a
  // keyboard user with no pointer has no other way to reach the columns off
  // the right-hand edge.
  /*
   * The role summary sits ABOVE the matrix.
   *
   * "Which role is this, how many people hold it, what changed last" are the
   * questions asked before reading a 28 × 8 grid, not after scrolling past
   * one. The pending banner stays against the matrix, because it describes
   * the edits in it.
   */
  els.panel.innerHTML = `${toolbarMarkup()}
    <div class="rol__meta">${statsMarkup()}${historyMarkup()}</div>
    ${bannerMarkup()}
    <div class="rol__matrix" density="compact" tabindex="0" role="region"
         aria-label="Permission matrix">
      ${matrixMarkup()}
    </div>`;

  // The option list is a property, so it is set after the markup lands rather
  // than written into it.
  const picker = els.panel.querySelector('#rolRoleSelect');
  if (picker) {
    picker.optionList = rolesForType().map((r) => ({ value: r.id, label: r.name }));
    picker.setAttribute('value', state.roleId ?? '');
  }

  // indeterminate is a property, not an attribute — it cannot be set in markup.
  for (const box of els.panel.querySelectorAll('.rol__check--all[data-partial="true"]')) {
    box.indeterminate = true;
  }

  els.panel.classList.toggle('rol--editing', state.editing);
}

// New Role Type / New Role live in the page header and are shown and hidden by
// practice-settings.js's syncActions, along with every other tab's action.
// This module only listens to them.

/* ============================================================================
   SELECTION LOGIC
   ========================================================================= */

function setAction(featureId, action, granted) {
  const role = currentRole();
  if (isLocked(role, featureId)) return;

  if (action === 'all') {
    for (const id of ACTION_IDS) state.draft[featureId][id] = granted;
  } else {
    state.draft[featureId][action] = granted;
  }
  paint();
}

function setEveryFeature(granted) {
  const role = currentRole();
  for (const feature of FEATURES) {
    if (isLocked(role, feature.id)) continue;
    for (const action of ACTION_IDS) state.draft[feature.id][action] = granted;
  }
  paint();
}

/* ============================================================================
   MODE
   ========================================================================= */

function loadRole(roleId) {
  state.roleId = roleId;
  const role = currentRole();
  state.saved = role ? permissionsFor(role) : null;
  state.draft = null;
  state.editing = false;
  state.showChanges = false;
}

function startEditing() {
  if (!state.saved) return;
  state.draft = structuredClone(state.saved);
  state.editing = true;
  state.showChanges = false;
  paint();
}

function stopEditing() {
  state.editing = false;
  state.draft = null;
  state.showChanges = false;
  paint();
}

function discardChanges() {
  state.draft = structuredClone(state.saved);
  state.showChanges = false;
  paint();
}

function saveChanges() {
  const changes = changeList();
  const role = currentRole();

  if (!changes.length) {
    stopEditing();
    flash('No changes to save.');
    return;
  }

  // Read the diff BEFORE the baseline moves. changesByFeature() compares
  // draft against saved, so overwriting saved first makes every summary empty.
  const summary = changesByFeature()
    .map((row) => {
      const parts = [];
      if (row.granted.length) parts.push(`granted ${row.granted.join(', ')}`);
      if (row.removed.length) parts.push(`removed ${row.removed.join(', ')}`);
      return `${row.feature.label}: ${parts.join('; ')}`;
    })
    .join(' · ');

  state.saved = structuredClone(state.draft);

  // The policy is what permissionsFor() reads, so it has to be rewritten or
  // the next visit to this role would show the old matrix again.
  role.policy = {
    baseline: [],
    overrides: Object.fromEntries(
      FEATURES.map((f) => [f.id, ACTION_IDS.filter((a) => state.saved[f.id][a])])
    ),
  };
  role.updatedOn = todayDdMmYyyy();
  role.updatedBy = CURRENT_USER;

  state.audit.unshift({
    id: `aud-${Date.now()}`,
    roleId: role.id,
    roleLabel: role.name,
    date: todayDdMmYyyy(),
    time: nowHhMm(),
    by: CURRENT_USER,
    summary,
    changes: changes.length,
  });

  stopEditing();
  flash('Permissions Updated Successfully', 'success');
}

/* ============================================================================
   FLASH — every "saved", "imported", "copied" in the product now leaves by the
   same door: lib/toast.js. The line this tab shared with Print Config sat
   between the tab strip and the permission matrix, and a matrix twenty-eight
   rows deep does not want to be nudged down the moment a tick is saved.
   ========================================================================= */

function flash(message, tone = 'info') {
  notify(message, tone);
}

/* ============================================================================
   IMPORT / EXPORT / COPY
   ========================================================================= */

function exportPermissions() {
  const role = currentRole();
  if (!role) return;

  const payload = {
    exportedOn: todayDdMmYyyy(),
    role: role.name,
    permissions: Object.fromEntries(
      FEATURES.map((f) => [f.id, ACTION_IDS.filter((a) => activeMatrix()[f.id][a])])
    ),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `permissions-${slug(role.name)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  flash(`Exported ${role.name} permissions.`, 'success');
}

function importPermissions(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const incoming = parsed?.permissions;
      if (!incoming || typeof incoming !== 'object') throw new Error('no permissions block');

      const role = currentRole();
      let applied = 0;
      for (const feature of FEATURES) {
        if (isLocked(role, feature.id)) continue;
        const granted = Array.isArray(incoming[feature.id]) ? incoming[feature.id] : null;
        if (!granted) continue;
        for (const action of ACTION_IDS) state.draft[feature.id][action] = granted.includes(action);
        applied += 1;
      }
      paint();
      flash(`Imported permissions for ${applied} feature${applied === 1 ? '' : 's'}.`, 'success');
    } catch {
      // An unreadable file is the user's mistake to correct, not an error to
      // swallow — say what was expected.
      flash('That file is not a permission export. Expected JSON with a "permissions" block.', 'warning');
    }
  };
  reader.readAsText(file);
}

function openCopyFrom(trigger) {
  const modal = document.getElementById('rolCopyModal');
  const select = document.getElementById('rolCopySource');
  if (!modal || !select) return;

  // Every role except the one being edited — copying a role onto itself is a
  // no-op that looks like a bug.
  select.innerHTML = state.roles
    .filter((r) => r.id !== state.roleId)
    .map(
      (r) =>
        `<option value="${r.id}">${esc(r.name)} (${r.users} user${
          r.users === 1 ? '' : 's'
        })</option>`
    )
    .join('');

  modal.open(trigger);
}

function applyCopyFrom() {
  const select = document.getElementById('rolCopySource');
  const source = roleById(select?.value);
  if (!source) return;

  const incoming = permissionsFor(source);
  const role = currentRole();
  for (const feature of FEATURES) {
    if (isLocked(role, feature.id)) continue;
    for (const action of ACTION_IDS) state.draft[feature.id][action] = incoming[feature.id][action];
  }

  document.getElementById('rolCopyModal')?.close();
  paint();
  flash(`Copied permissions from ${source.name}. Nothing is saved until you press Save Changes.`);
}

/* ============================================================================
   CREATE ROLE TYPE / ROLE
   ========================================================================= */

function fieldError(field, message) {
  if (message) field?.setAttribute('error', message);
  else field?.removeAttribute('error');
  return !message;
}

function openRoleTypeModal(trigger) {
  const modal = document.getElementById('rolTypeModal');
  if (!modal) return;
  const name = document.getElementById('rolTypeName');
  const description = document.getElementById('rolTypeDescription');
  if (name) {
    name.value = '';
    name.removeAttribute('error');
  }
  const descControl = description?.querySelector('textarea');
  if (descControl) descControl.value = '';
  document.getElementById('rolTypeStatus')?.setAttribute('value', 'Active');
  modal.open(trigger);
}

function saveRoleType() {
  const nameField = document.getElementById('rolTypeName');
  const name = (nameField?.value || '').trim();

  if (!fieldError(nameField, name ? '' : 'Enter a role type name.')) return;
  if (state.roleTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    fieldError(nameField, `“${name}” already exists.`);
    return;
  }

  const description =
    document.getElementById('rolTypeDescription')?.querySelector('textarea')?.value.trim() || '';
  const status = document.getElementById('rolTypeStatus')?.value === 'Inactive' ? 'inactive' : 'active';

  const type = { id: `${slug(name)}-${Date.now()}`, name, description, status };
  state.roleTypes.push(type);

  document.getElementById('rolTypeModal')?.close();
  state.typeId = type.id;
  state.roleId = null;
  state.saved = null;
  state.editing = false;
  paint();
  flash(`Role type “${name}” created. Add a role to it to set permissions.`, 'success');
}

function openRoleModal(trigger) {
  const modal = document.getElementById('rolRoleModal');
  if (!modal) return;

  const name = document.getElementById('rolRoleName');
  if (name) {
    name.value = '';
    name.removeAttribute('error');
  }
  const descControl = document.getElementById('rolRoleDescription')?.querySelector('textarea');
  if (descControl) descControl.value = '';

  const typeSelect = document.getElementById('rolRoleType');
  if (typeSelect) {
    typeSelect.innerHTML = state.roleTypes
      .map(
        (t) =>
          `<option value="${t.id}" ${t.id === state.typeId ? 'selected' : ''}>${esc(t.name)}</option>`
      )
      .join('');
  }

  const cloneSelect = document.getElementById('rolRoleClone');
  if (cloneSelect) {
    cloneSelect.innerHTML = `<option value="">Start from no permissions</option>${state.roles
      .map(
        (r) => `<option value="${r.id}">${esc(typeById(r.typeId)?.name)} › ${esc(r.name)}</option>`
      )
      .join('')}`;
  }

  document.getElementById('rolRoleStatus')?.setAttribute('value', 'Active');
  modal.open(trigger);
}

function saveRole() {
  const nameField = document.getElementById('rolRoleName');
  const name = (nameField?.value || '').trim();
  const typeId = document.getElementById('rolRoleType')?.value;

  if (!fieldError(nameField, name ? '' : 'Enter a role name.')) return;
  if (state.roles.some((r) => r.typeId === typeId && r.name.toLowerCase() === name.toLowerCase())) {
    // Scoped to the type on purpose: "Medical Assistant" legitimately exists
    // under both Clinical and Medical Assistant.
    fieldError(nameField, `${typeById(typeId)?.name} already has a role called “${name}”.`);
    return;
  }

  const cloneId = document.getElementById('rolRoleClone')?.value;
  const source = roleById(cloneId);
  const matrix = source ? permissionsFor(source) : blankPermissions();

  const role = {
    id: `${slug(name)}-${Date.now()}`,
    typeId,
    name,
    description:
      document.getElementById('rolRoleDescription')?.querySelector('textarea')?.value.trim() || '',
    status: document.getElementById('rolRoleStatus')?.value === 'Inactive' ? 'inactive' : 'active',
    users: 0,
    updatedOn: todayDdMmYyyy(),
    updatedBy: CURRENT_USER,
    policy: {
      baseline: [],
      overrides: Object.fromEntries(
        FEATURES.map((f) => [f.id, ACTION_IDS.filter((a) => matrix[f.id][a])])
      ),
    },
  };

  state.roles.push(role);
  document.getElementById('rolRoleModal')?.close();

  state.typeId = typeId;
  loadRole(role.id);
  paint();
  flash(
    source ? `“${name}” created from ${source.name}.` : `“${name}” created with no permissions yet.`,
    'success'
  );
}

function deleteRole(trigger) {
  const role = currentRole();
  if (!role) return;

  if (role.reserved) {
    flash(`${role.name} is a reserved role and cannot be deleted.`, 'warning');
    return;
  }
  if (role.users > 0) {
    flash(
      `${role.name} is assigned to ${role.users} active user${
        role.users === 1 ? '' : 's'
      }. Reassign them before deleting the role.`,
      'warning'
    );
    return;
  }

  const modal = document.getElementById('rolDeleteModal');
  const body = document.getElementById('rolDeleteBody');
  if (body) {
    body.innerHTML = `<p>“${esc(role.name)}” will no longer be available when assigning users.</p>
      <p class="rol__muted">This is recorded in the Audit Log.</p>`;
  }
  modal?.open(trigger);
}

function confirmDeleteRole() {
  const role = currentRole();
  if (!role) return;

  state.roles = state.roles.filter((r) => r.id !== role.id);
  document.getElementById('rolDeleteModal')?.close();

  const next = rolesForType()[0];
  if (next) loadRole(next.id);
  else {
    state.roleId = null;
    state.saved = null;
    state.editing = false;
  }
  paint();
  flash(`Role “${role.name}” deleted.`, 'success');
}

/* ============================================================================
   WIRING
   ========================================================================= */

/** Native `change` — the matrix checkboxes are plain inputs. */
function onPanelChange(event) {
  const box = event.target.closest('.rol__check');
  if (box) setAction(box.dataset.feature, box.dataset.action, box.checked);
}

/** The role picker is a <ui-select>, so selection arrives as ui-change. */
function onPanelSelect(event) {
  if (!event.target.closest('[data-testid="rol--role-select"]')) return;
  loadRole(event.detail.value);
  paint();
}

function onPanelClick(event) {
  if (event.target.closest('[data-toggle-changes]')) {
    state.showChanges = !state.showChanges;
    paint();
  }
}

function onPanelUiClick(event) {
  const hit = (testid) => event.target.closest(`[data-testid="${testid}"]`);

  if (hit('rol--edit')) return startEditing();
  if (hit('rol--cancel')) return stopEditing();
  if (hit('rol--discard')) return discardChanges();
  if (hit('rol--save')) return saveChanges();
  if (hit('rol--select-all')) return setEveryFeature(true);
  if (hit('rol--clear-all')) return setEveryFeature(false);
  if (hit('rol--export')) return exportPermissions();
  if (hit('rol--import')) return els.importInput?.click();
  if (hit('rol--copy')) return openCopyFrom(event.target.closest('ui-button'));
  if (hit('rol--delete-role')) return deleteRole(event.target.closest('ui-button'));
  return undefined;
}

/* ============================================================================
   INIT
   ========================================================================= */

export function initRoles() {
  els.panel = document.getElementById('rolesPanel');
  els.importInput = document.getElementById('rolImportInput');
  if (!els.panel) return;

  loadRole(state.roleId);

  els.panel.addEventListener('change', onPanelChange);
  els.panel.addEventListener('click', onPanelClick);
  els.panel.addEventListener('ui-click', onPanelUiClick);
  els.panel.addEventListener('ui-change', onPanelSelect);

  document
    .querySelector('[data-testid="rol--type-save"]')
    ?.addEventListener('ui-click', saveRoleType);
  document.querySelector('[data-testid="rol--role-save"]')?.addEventListener('ui-click', saveRole);
  document
    .querySelector('[data-testid="rol--copy-apply"]')
    ?.addEventListener('ui-click', applyCopyFrom);
  document
    .querySelector('[data-testid="rol--delete-confirm"]')
    ?.addEventListener('ui-click', confirmDeleteRole);

  for (const button of document.querySelectorAll('[data-rol-dismiss]')) {
    button.addEventListener('ui-click', () => button.closest('ui-modal')?.close());
  }

  els.importInput?.addEventListener('change', () => {
    const file = els.importInput.files?.[0];
    if (file) importPermissions(file);
    // Cleared so choosing the same file twice still fires a change event.
    els.importInput.value = '';
  });

  paint();
}
