/**
 * <ui-filter> — the one filter control every list in this product uses.
 *
 * Before this existed, "filters" meant nine different things depending on
 * which screen you were standing on. The directory had a 30rem popover of
 * paired dropdowns. Referrals had a stack of multi-selects in the queue rail.
 * Practice settings had a permanent control bar. Complications had a panel
 * with Reset and Apply; tasks had one with Clear and nothing else. Each of
 * them was a reasonable answer to "how do I narrow this list", and together
 * they meant that learning to filter one screen taught you nothing about the
 * next one.
 *
 * This is that answer, once: a button that opens a panel of tickable answers,
 * grouped under the question they answer, with Clear and Done at the foot.
 *
 *   <ui-filter label="Filters" data-testid="lead--filter">
 *     <ui-filter-group name="source" label="Source"
 *       options="Email,Phone Call,Regional Centre,Walk In,Website"></ui-filter-group>
 *     <ui-filter-group name="status" label="Status">
 *       <option value="invite-sent">Invite Sent</option>
 *       <option value="no-response">No Response</option>
 *     </ui-filter-group>
 *   </ui-filter>
 *
 * WHY TICK BOXES RATHER THAN DROPDOWNS.
 * A dropdown asks a question and then hides its own answers, so a filter panel
 * built from six of them shows you six words you have already read and none of
 * the answers you are choosing between. The reference format shows the answers
 * — every one of them, under the question they belong to — because a filter
 * panel's whole job is to tell you what this list can be narrowed by. It costs
 * vertical space, and the panel scrolls, and that is the right trade: you open
 * it, you see the vocabulary of the list, you tick, you leave.
 *
 * A GROUP HOLDS A SET, NOT AN ANSWER.
 * Every group is multi-select by default, because the work is: a biller wants
 * Denied AND Rejected, a scheduler wants two locations. `single` turns a group
 * into radios for the rare filter that genuinely admits one answer. Either way
 * the value read back is an array, so js/lib/filter-set.js reads all of them
 * the same way:
 *
 *   if (!admits(f.source, row.source)) return false;
 *
 * NOTHING TICKED MEANS NOT NARROWING. There is deliberately no "All" row: a
 * tickable All beside five answers it cancels is a sixth thing to tick and a
 * second way to say what an empty set already says.
 *
 * AND THEN THERE IS THE PARAMETER PANEL, WHICH IS THE OTHER SHAPE.
 * Everything above is right for a list with five or six answers per question.
 * Reports is not that: a report is run from a sheet of NINE parameters —
 * performing providers, billing providers, locations, CPT codes, carriers,
 * cost centres, bill type, grouping, and three or four tick boxes — and the
 * vocabularies behind them are twenty providers and forty codes rather than
 * five statuses. Drawn as tick lists that panel is several hundred rows long,
 * and the reader scrolls past nine questions to find the one they came for.
 *
 * So a group may declare how it wants to be ASKED, and a long-vocabulary
 * question asks itself as a dropdown:
 *
 *   { name: 'performing', label: 'Performing Providers',
 *     control: 'select', options: PROVIDERS }        multi, a closed field
 *   { name: 'billType', label: 'Bill Type',
 *     control: 'select', single: true, empty: 'All' } one answer, or none
 *   { name: 'dosFrom', label: 'Charge DOS From', control: 'date' }
 *
 * A dropdown group answers exactly as a tick group does — `value` is still
 * `{ performing: ['Amara Mensah, MD'] }`, the badge still counts it, Clear
 * still empties it — so a screen reading one is reading the same shape it
 * always was. What changes is only how many pixels the question costs.
 *
 * `control: 'check'` is the third: a group of tick boxes with no question
 * above them, for the "Show patient details" / "Split CPT with modifiers"
 * switches a report sheet ends with. They are ordinary options under the
 * covers — one group, one box per option — and they are drawn last because
 * that is where a parameter sheet puts them.
 *
 * FIELDS THAT ARE NOT TICKABLE STILL LIVE HERE.
 * A date range and a free-text MRN cannot be a list of boxes, and the audit
 * log needs both. <ui-filter-fields> takes any markup — inputs, date pickers,
 * a select — and puts it in the panel under its own heading, in the same
 * rhythm as the groups. Those nodes are the author's own: they are moved into
 * the panel when it opens and returned to their place when it closes, so an
 * `el('auditFrom')` reference a screen took at startup keeps working.
 *
 *   <ui-filter-fields label="Date range">
 *     <ui-input id="auditFrom" type="date" label="From" size="sm"></ui-input>
 *     <ui-input id="auditTo" type="date" label="To" size="sm"></ui-input>
 *   </ui-filter-fields>
 *
 * THE PANEL HANGS OFF <body>.
 * The same reason the dropdown list and the row menu do (see js/lib/overlay.js):
 * a panel rendered inside a table cell, a card with `overflow: hidden`, or a
 * narrow queue rail gets clipped by whichever of those it is inside. It is
 * registered as an overlay so anything tearing down a surface closes it.
 *
 * Events
 *   ui-filter-change  { name, values, value }  one box ticked — for live lists
 *   ui-filter-apply   { values }               Done pressed
 *   ui-filter-clear   { values }               Clear pressed (a change too)
 *
 * `values` is the whole state, `{ source: ['Email'], status: [] }`. Screens
 * that repaint on every tick listen to ui-filter-change; screens whose filter
 * costs something (a fetch, a big regroup) listen to ui-filter-apply only.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';
import { registerOverlay } from '../lib/overlay.js';

const PANEL_ID = 'ui-filter-panel';
const SHEET_ID = 'ui-filter-geometry';

/**
 * The ways a group may ask its question. `options` is the tick list this
 * component started as and is what a group that names nothing gets; `check` is
 * the same list with its heading suppressed; `select` and `date` are the
 * parameter-sheet shapes. `fields` is the escape hatch — the screen's own
 * markup, borrowed into the panel.
 */
const KINDS = new Set(['options', 'check', 'select', 'date', 'fields']);
const GAP = 6;
const EDGE = 8;

let uid = 0;

/** The one open panel. Only ever one — a second open closes the first. */
let live = null;
/** Removes the open panel from the overlay register — see js/lib/overlay.js. */
let release = null;

function sheet() {
  let style = document.getElementById(SHEET_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = SHEET_ID;
    document.head.append(style);
  }
  return style;
}

/**
 * Put the panel under the button — or over it, when the button is low in the
 * window. Geometry goes into a generated stylesheet keyed to the panel's id
 * rather than a style attribute, the same way the row menu and the dropdown
 * list place theirs.
 */
function place() {
  if (!live) return;
  const { trigger, panel, align } = live;

  const box = trigger.getBoundingClientRect();
  if (!box.width && !box.height) return closeFilterPanel();

  /* Scrolled clean out of the window — there is nothing left to hang on. */
  if (box.bottom < 0 || box.top > window.innerHeight) return closeFilterPanel();

  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const below = viewportH - box.bottom - GAP - EDGE;
  const above = box.top - GAP - EDGE;

  /* Three passes, and all three are needed.

     One: uncap the height and measure what the panel WANTS. Two: knowing that,
     decide which side of the button it goes on, cap it to that side and
     measure what it actually got — a panel capped from 600px to 400px is a
     different panel, and a top computed from the 600 would hang it off the
     top of the window with a gap underneath. Three: place the height we ended
     up with. */
  write({ maxHeight: Math.max(below, above) });
  const wanted = panel.offsetHeight;
  const dropsBelow = wanted <= below || below >= above;
  const room = dropsBelow ? below : above;

  write({ maxHeight: room });
  const height = panel.offsetHeight;
  const width = panel.offsetWidth;

  /* Aligned to whichever end of the button the panel opens from, then pulled
     back inside the window when a wide panel would run off it. */
  const edge = align === 'start' ? box.left : box.right - width;
  const left = Math.max(EDGE, Math.min(edge, viewportW - EDGE - width));
  const top = dropsBelow
    ? Math.min(box.bottom + GAP, viewportH - EDGE - height)
    : Math.max(EDGE, box.top - GAP - height);

  write({ maxHeight: room, top, left, origin: dropsBelow ? 'top' : 'bottom' });
}

function write({ maxHeight, top = 0, left = 0, origin = 'top' }) {
  sheet().textContent =
    `#${PANEL_ID}{` +
    `--filter-panel-left:${Math.round(left)}px;` +
    `--filter-panel-top:${Math.round(top)}px;` +
    `--filter-panel-max-height:${Math.round(Math.max(maxHeight, 160))}px;` +
    `--filter-panel-origin:${origin};` +
    `}`;
}

function onKey(event) {
  if (event.key !== 'Escape') return;

  /*
   * ESCAPE BELONGS TO WHATEVER IS ON TOP.
   *
   * The panel's own listener is registered in the capture phase and it was
   * registered first, so it used to win Escape from every dropdown and
   * calendar opened INSIDE the panel — a reader who opened the provider list,
   * thought better of it and pressed Escape lost the whole sheet along with
   * the list, and with it the four parameters they had already answered.
   *
   * A panel parented to <body> cannot be found by `contains`, which is why
   * this asks the same question the outside-click test asks: is one of the
   * kit's own floating surfaces open over us? If so, it is the one being
   * dismissed, and this stays out of the way.
   */
  if (document.querySelector('.ui-select-menu, .ui-date-menu, .ui-row-menu-panel')) return;

  closeFilterPanel({ refocus: true });
}

function onOutside(event) {
  if (!live) return;
  if (live.panel.contains(event.target)) return;
  if (live.trigger.contains(event.target)) return;
  /* The dropdown list and the calendar a <ui-filter-fields> opens are parented
     to <body> too, so a click in one of them is not a click outside this. */
  if (event.target.closest?.('.ui-select-menu, .ui-date-menu, .ui-row-menu-panel')) return;
  closeFilterPanel();
}

/* The panel chases its button rather than closing when the page moves: ticking
   five boxes is a long interaction, and a list that scrolls under an open panel
   is normal rather than a reason to throw the panel away. */
function onReflow() {
  place();
}

/** Shut whichever filter panel is open. */
export function closeFilterPanel({ refocus = false } = {}) {
  if (!live) return;
  const { host, trigger, panel } = live;
  /* Before `live` is dropped: returnFields() finds the borrowed nodes through
     the open panel, and after this line there is no open panel to find. */
  host.returnFields();
  live = null;
  release?.();
  release = null;

  panel.remove();
  sheet().textContent = '';
  trigger.setAttribute('aria-expanded', 'false');

  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', onReflow, true);
  window.removeEventListener('scroll', onReflow, true);

  host.classList.remove('ui-filter--open');
  if (refocus && trigger.isConnected) trigger.focus();
}

/** Which group definitions a <ui-filter-group> / <ui-filter-fields> child is. */
function readGroups(host) {
  return [...host.children]
    .filter((child) => /^UI-FILTER-(GROUP|FIELDS)$/.test(child.tagName))
    .map((child, index) => {
      const label = child.getAttribute('label') ?? '';
      const name = child.getAttribute('name') || slug(label) || `group-${index}`;
      if (child.tagName === 'UI-FILTER-FIELDS') {
        return { kind: 'fields', name, label, node: child };
      }
      const attr = child.getAttribute('options');
      const children = [...child.querySelectorAll('option')].map((option) => ({
        value: option.value,
        label: option.textContent.trim(),
      }));
      return {
        kind: 'options',
        name,
        /* The authored element is kept for an options group exactly as it is
           for a fields group. Only fields groups need it to borrow their
           children back, but BOTH need it for the one thing paintPanel asks of
           it: whether the screen has hidden this question. Leads hides Status
           on its rejected tab, where every row is rejected and the question is
           already answered; without the node here that `hidden` was set on an
           element the panel never consulted. */
        node: child,
        label,
        single: child.hasAttribute('single'),
        options: children.length
          ? children
          : String(attr ?? '')
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
              .map((part) => ({ value: part, label: part })),
      };
    });
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalise(options) {
  return (options ?? []).map((option) =>
    typeof option === 'string'
      ? { value: option, label: option }
      : { value: String(option.value), label: option.label ?? String(option.value) }
  );
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
}

class UiFilter extends UiElement {
  static observedAttributes = ['label', 'align', 'disabled', 'panel-label', 'width'];

  /* Initialised here rather than in connectedCallback: a screen may set its
     groups or read its value before the element has been connected, and an
     undefined `_values` would throw rather than answering "nothing ticked". */
  _values = {};
  _groups = [];

  connectedCallback() {
    /* Read the authored groups once, before anything else runs. render() no
       longer empties the element (see the note on it), but the groups are
       still read once so a screen's setGroups() is not undone by a re-render. */
    if (!this._read) {
      this._read = true;
      this._groups = readGroups(this);
    }
    super.connectedCallback();
  }

  disconnectedCallback() {
    if (live?.host === this) closeFilterPanel();
  }

  /**
   * Set the questions from JavaScript, for a screen whose answers come out of
   * data/ rather than out of the markup.
   *
   *   filter.setGroups([
   *     { name: 'status', label: 'Status', options: ['Open', 'Closed'] },
   *     { name: 'owner',  label: 'Owner',  options: staff.map((s) => s.name) },
   *   ]);
   *
   * Ticks already made survive it where the answer is still on offer, so a
   * screen may refresh its option lists under an open panel without silently
   * widening what the reader asked for.
   */
  setGroups(groups) {
    this._groups = (groups ?? []).map((group, index) => ({
      /* `kind` is how the group is DRAWN; four of them, and a group that says
         nothing is the tick list this component started as. */
      kind: KINDS.has(group.control) ? group.control : group.kind === 'fields' ? 'fields' : 'options',
      name: group.name || slug(group.label) || `group-${index}`,
      label: group.label ?? '',
      single: Boolean(group.single),
      /* The row a single-answer dropdown lands on when nothing is chosen. It
         is an ANSWER — "All bill types" — rather than the question, so it is
         pickable and gets you back out of a choice. See <ui-select>. */
      empty: group.empty ?? 'Any',
      /* A group may ask to be left out of the count on the button. Only one
         thing ever does: a switch that does not narrow the list — "add to my
         favourites" — and a badge reading 1 over a panel that is showing
         everything is precisely what the badge exists to prevent. */
      badge: group.badge !== false,
      options: normalise(group.options),
      node: group.node,
    }));

    for (const [name, picked] of Object.entries(this._values)) {
      const group = this._groups.find((g) => g.name === name);
      /* A date holds whatever was typed into it; there is no list of offered
         answers to check it against. */
      if (!group || group.kind === 'date') continue;
      const offered = new Set(group.options.map((o) => o.value));
      this._values[name] = picked.filter((value) => offered.has(value));
    }

    /*
     * REPAINT ONLY WHEN THE QUESTIONS THEMSELVES CHANGED.
     *
     * A screen that repaints on every tick calls this on every tick, and the
     * groups it hands back are usually identical to the ones already drawn.
     * Redrawing the panel anyway was survivable while every answer was a tick
     * box — the boxes came back checked and nobody noticed. It is not
     * survivable now: a dropdown that is rebuilt underneath the reader loses
     * the focus they were about to use, and a panel of nine of them flickers
     * on every answer.
     *
     * So the drawn questions are compared with the new ones, and the panel is
     * left exactly as it is when they match. The ANSWERS are not part of that
     * signature — they are painted onto the controls that already exist.
     */
    const signature = JSON.stringify(
      this._groups.map((g) => [g.kind, g.name, g.label, g.single, g.options])
    );
    const changed = signature !== this._signature;
    this._signature = signature;

    if (changed && live?.host === this) this.paintPanel();
    this.paintCount();
  }

  /**
   * Fill in ONE group's answers, leaving every other group as the markup
   * declared it. This is the usual call: a screen knows its questions at
   * authoring time and only the answers come out of data/.
   *
   *   filter.setGroupOptions('status', Object.values(LEAD_STATUSES));
   *
   * setGroups() would work too, and would also throw away the
   * <ui-filter-fields> nodes the markup contributed — which is exactly the
   * mistake this method exists to make impossible.
   */
  setGroupOptions(name, options) {
    const group = this._groups?.find((g) => g.name === name);
    if (!group) return;
    group.options = normalise(options);

    const offered = new Set(group.options.map((o) => o.value));
    if (this._values[name]) {
      this._values[name] = this._values[name].filter((value) => offered.has(value));
    }

    if (live?.host === this) this.paintPanel();
    this.paintCount();
  }

  /**
   * Redraw the open panel. Needed only by a screen that shows or hides one of
   * its own <ui-filter-fields> — a custom date range that appears once Custom
   * is chosen — because the panel cannot know that node changed.
   */
  refresh() {
    if (live?.host === this) this.paintPanel();
  }

  /**
   * What has been answered, as `{ groupName: [value, …] }`.
   *
   * Every group the component owns is in here whatever shape it was asked in —
   * a tick list, a dropdown and a date all answer with a list, which is what
   * lets js/lib/filter-set.js read all three with one function. Only `fields`
   * is left out: those controls belong to the screen, which reads them itself.
   */
  get value() {
    const out = {};
    for (const group of this._groups ?? []) {
      if (group.kind === 'fields') continue;
      out[group.name] = [...(this._values[group.name] ?? [])];
    }
    return out;
  }

  set value(next) {
    this._values = {};
    for (const [name, picked] of Object.entries(next ?? {})) {
      this._values[name] = Array.isArray(picked)
        ? picked.map(String)
        : String(picked ?? '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
    }
    if (live?.host === this) this.paintPanel();
    this.paintCount();
  }

  /**
   * How many answers are on — ticks, plus any field the screen contributed
   * that has something typed in it.
   *
   * The fields count because they narrow the list exactly as the ticks do. A
   * badge reading 2 over a panel holding two ticks and a date range is telling
   * the reader that three of the rows' worth of narrowing is only two, which
   * is the one thing this badge exists to prevent.
   */
  get count() {
    const ticks = (this._groups ?? []).reduce(
      (total, group) =>
        group.badge === false ? total : total + (this._values[group.name]?.length ?? 0),
      0
    );
    return ticks + this.countFields();
  }

  /** Where a fields group's nodes are right now: in the panel, or back home. */
  fieldsHost(group) {
    if (!group.node) return null;
    return (
      live?.panel?.querySelector(
        `[data-filter-group="${CSS.escape(group.name)}"] .ui-filter-group__fields`
      ) ?? group.node
    );
  }

  countFields() {
    let filled = 0;
    for (const group of this._groups ?? []) {
      if (group.kind !== 'fields' || group.node?.hidden) continue;
      const host = this.fieldsHost(group);
      if (!host) continue;
      for (const field of host.querySelectorAll('ui-input, ui-select, input, select, textarea')) {
        /* The <input> inside a <ui-input> is the same answer twice. */
        const wrapper = field.closest('ui-input, ui-select');
        if (wrapper && wrapper !== field) continue;
        if (String(field.value ?? '').trim()) filled += 1;
      }
    }
    return filled;
  }

  /**
   * Untick everything.
   *
   * Only the ticks: a <ui-filter-fields> holds the screen's own controls, and
   * emptying somebody else's input is not this component's call. The screen
   * listens for ui-filter-clear and empties them, which is one line and keeps
   * the ownership honest.
   */
  clear({ emit = false } = {}) {
    this._values = {};
    if (live?.host === this) this.paintPanel();
    this.paintCount();
    if (emit) {
      this.emit('ui-filter-clear', { values: this.value });
      this.emit('ui-filter-change', { name: null, values: this.value });
    }
  }

  open() {
    if (live?.host === this) return closeFilterPanel();
    openPanel(this);
  }

  close() {
    if (live?.host === this) closeFilterPanel();
  }

  /**
   * THE CONFIGURATION CHILDREN ARE NOT REDRAWN, AND MUST NOT BE.
   *
   * Every other component in this kit renders by writing over its own
   * innerHTML. This one cannot: a <ui-filter-fields> holds the screen's own
   * inputs, with the screen's own ids on them, and a screen that took
   * `el('auditFrom')` at startup would be holding a node that no longer exists
   * anywhere. So the trigger and its badge are inserted BEFORE the declared
   * groups and replaced in place on a re-render, and the groups are left where
   * the author put them — hidden by CSS, present in the document, findable by
   * id for as long as the page lives.
   */
  render() {
    const label = this.attr('label', 'Filters');
    const disabled = this.boolAttr('disabled');
    const id = this._id || (this._id = `ui-filter-${++uid}`);

    this.querySelector(':scope > .ui-filter__trigger')?.remove();
    this.querySelector(':scope > .ui-filter__count')?.remove();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    /* No word means a square icon button — the shape a narrow rail beside a
       search box has room for. It still has an accessible name, from
       `panel-label`; see below. */
    trigger.className = `ui-filter__trigger${label ? '' : ' ui-filter__trigger--icon'}`;
    trigger.id = `${id}-trigger`;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.disabled = disabled;
    if (!label) trigger.setAttribute('aria-label', this.attr('panel-label', 'Filters'));
    trigger.innerHTML =
      iconMarkup('filter', 'ui-icon ui-filter__icon') +
      (label ? `<span class="ui-filter__label">${escapeHtml(label)}</span>` : '');
    trigger.addEventListener('click', () => this.open());

    const badge = document.createElement('span');
    badge.className = 'ui-filter__count';
    badge.hidden = true;

    this.prepend(trigger, badge);
    this.paintCount();
  }

  /** The badge on the button. A filtered list otherwise just looks short. */
  paintCount() {
    const badge = this.querySelector('.ui-filter__count');
    if (!badge) return;
    const count = this.count;
    badge.textContent = String(count);
    badge.hidden = count === 0;
    this.classList.toggle('ui-filter--active', count > 0);
  }

  /* --- The panel ---------------------------------------------------------- */

  buildPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'ui-filter-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', this.attr('panel-label', this.attr('label', 'Filters')));
    if (this.dataset.testid) panel.dataset.testid = `${this.dataset.testid}-panel`;
    if (this.attr('width')) panel.style.setProperty('--filter-panel-width', this.attr('width'));

    panel.innerHTML =
      `<div class="ui-filter-panel__body"></div>` +
      `<div class="ui-filter-panel__foot">
         <button type="button" class="ui-filter-panel__clear" data-testid="filter--clear">Clear</button>
         <ui-button variant="primary" size="sm" class="ui-filter-panel__done"
           data-testid="filter--done">Done</ui-button>
       </div>`;

    panel.querySelector('.ui-filter-panel__clear').addEventListener('click', () => {
      this.clear({ emit: true });
    });
    panel.querySelector('.ui-filter-panel__done').addEventListener('click', () => {
      this.emit('ui-filter-apply', { values: this.value });
      closeFilterPanel({ refocus: true });
    });

    /* One delegated listener rather than one per box: the body is repainted
       whenever the groups change, and per-row listeners would have to be rewired
       every time — which is how a panel ends up with two of them on a row. */
    panel.addEventListener('ui-change', (event) => {
      const row = event.target.closest('[data-filter-name]');
      if (!row) {
        /* A field the screen contributed. Not ours to interpret — the screen is
           listening to its own control — but it changes the badge, so the count
           is re-asked and the event left to carry on to the screen. */
        this.paintCount();
        return;
      }
      event.stopPropagation();

      /* A dropdown or a date answers with its whole answer; a tick box answers
         with one value and whether it went on or off. */
      const kind = row.dataset.filterKind;
      if (kind === 'select' || kind === 'date') {
        const detail = event.detail ?? {};
        const values =
          detail.values ?? String(detail.value ?? '').split(',').map((part) => part.trim());
        this.setPicked(row.dataset.filterName, values);
        return;
      }

      this.toggle(row.dataset.filterName, row.dataset.filterValue, event.detail.checked);
    });

    /* Typing into a contributed field fires ui-input rather than ui-change. */
    panel.addEventListener('ui-input', () => this.paintCount());

    return panel;
  }

  toggle(name, value, on) {
    const group = this._groups.find((g) => g.name === name);
    const picked = new Set(this._values[name] ?? []);

    if (group?.single) {
      picked.clear();
      if (on) picked.add(value);
    } else if (on) {
      picked.add(value);
    } else {
      picked.delete(value);
    }

    this._values[name] = [...picked];
    if (group?.single) this.paintPanel();
    this.paintCount();
    this.emit('ui-filter-change', { name, values: this.value });
  }

  /** Draw the groups into the open panel. */
  paintPanel() {
    const body = live?.panel?.querySelector('.ui-filter-panel__body');
    if (!body) return;

    this.returnFields();
    body.textContent = '';

    for (const group of this._groups) {
      /* A group the screen has hidden takes its heading with it — the custom
         date range that only exists once Custom is chosen, or a question the
         screen has already answered for you, as Leads does with Status on its
         rejected tab. A heading over nothing is worse than the gap it hid. */
      if (group.node?.hidden) continue;

      const section = document.createElement('section');
      section.className = `ui-filter-group${
        group.kind === 'check' ? ' ui-filter-group--check' : ''
      }`;
      section.dataset.filterGroup = group.name;

      /* A tick-box group has no question above it: "Show patient details" is
         already a sentence, and a heading reading OPTIONS over three of them
         is a word that tells the reader nothing they cannot see. */
      if (group.label && group.kind !== 'check') {
        const heading = document.createElement('h3');
        heading.className = 'ui-filter-group__label';
        heading.textContent = group.label;
        section.append(heading);
      }

      /* Appended before it is filled, so a <ui-select> inside it is CONNECTED
         by the time its options and value are written — a custom element that
         is not in the document has not rendered yet, and setOptions() on one
         would draw into nothing. */
      body.append(section);

      if (group.kind === 'select' || group.kind === 'date') {
        section.append(this.buildField(group));
        continue;
      }

      if (group.kind === 'fields') {
        const slot = document.createElement('div');
        slot.className = 'ui-filter-group__fields';
        /* The author's own nodes, borrowed rather than copied — see the note at
           the top of this file about references a screen already holds. */
        slot.append(...group.node.childNodes);
        section.append(slot);
      } else {
        const list = document.createElement('div');
        list.className = 'ui-filter-group__options';
        const picked = new Set(this._values[group.name] ?? []);
        for (const option of group.options) {
          const row = document.createElement(group.single ? 'ui-radio' : 'ui-checkbox');
          row.dataset.filterName = group.name;
          row.dataset.filterValue = option.value;
          row.textContent = option.label;
          if (picked.has(option.value)) row.setAttribute('checked', '');
          if (group.single) row.setAttribute('name', `${this._id}-${group.name}`);
          list.append(row);
        }
        section.append(list);
      }
    }
  }

  /**
   * A dropdown or a date, for a group that asks its question as a field.
   *
   * The control is the kit's own — the same shell, the same drawn menu, the
   * same keyboard — so a parameter panel is made of the fields the rest of the
   * product is made of. What the panel adds is the two data attributes the one
   * delegated listener reads: which group this is, and how to interpret what
   * comes back off it.
   */
  buildField(group) {
    const picked = this._values[group.name] ?? [];

    const field = document.createElement(group.kind === 'date' ? 'ui-input' : 'ui-select');
    field.dataset.filterName = group.name;
    field.dataset.filterKind = group.kind;
    /* The question is already the heading above the field, so the field's own
       label is for screen readers alone — printed twice it reads as two. */
    field.setAttribute('label', group.label || group.name);
    field.setAttribute('label-hidden', '');
    field.setAttribute('size', 'sm');

    if (group.kind === 'date') {
      field.setAttribute('type', 'date');
      field.setAttribute('value', picked[0] ?? '');
      return field;
    }

    /* Multi by default, for the same reason a tick group is: a report is run
       for two providers at three sites far more often than for one of each.

       The two say "nothing chosen" differently, and both are deliberate. A
       single-answer field needs a ROW to land on — picking "All bill types"
       is how you get back out of having picked one — so it takes an empty
       option. A multiple field does not: its answers are unticked one at a
       time, and an All row among them would be a sixth thing to tick that
       cancels the other five. So it says "All" only when closed and empty,
       which is what `placeholder` is. */
    if (group.single) field.setAttribute('empty-option', group.empty);
    else {
      field.setAttribute('multiple', '');
      field.setAttribute('placeholder', group.empty === 'Any' ? 'All' : group.empty);
    }
    field.setAttribute('value', picked.join(','));
    field.setOptions(group.options);
    return field;
  }

  /**
   * Replace one group's whole answer, for the controls that hand back a set
   * rather than a box at a time.
   *
   * It deliberately does NOT repaint: the reader is standing on the control
   * that produced this, and rebuilding it under them would take the focus with
   * it. Nothing else on the panel depends on what this group holds.
   */
  setPicked(name, values) {
    this._values[name] = values.filter(Boolean).map(String);
    this.paintCount();
    this.emit('ui-filter-change', { name, values: this.value });
  }

  /** Give a <ui-filter-fields> its children back, so the next open finds them. */
  returnFields() {
    for (const group of this._groups ?? []) {
      if (group.kind !== 'fields' || !group.node) continue;
      const slot = live?.panel?.querySelector(
        `[data-filter-group="${CSS.escape(group.name)}"] .ui-filter-group__fields`
      );
      if (slot) group.node.append(...slot.childNodes);
    }
  }
}

function openPanel(host) {
  closeFilterPanel();
  if (host.boolAttr('disabled')) return;

  const trigger = host.querySelector('.ui-filter__trigger');
  const panel = host.buildPanel();
  document.body.append(panel);

  live = { host, trigger, panel, align: host.attr('align', 'end') };
  host.paintPanel();
  host.classList.add('ui-filter--open');
  trigger.setAttribute('aria-expanded', 'true');

  place();
  panel.querySelector('input, button')?.focus();

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onReflow, true);
  window.addEventListener('scroll', onReflow, true);
  release = registerOverlay(() => closeFilterPanel());
}

reflectProps(UiFilter, {
  label: 'string',
  align: 'string',
  width: 'string',
  disabled: 'boolean',
  'panel-label': 'string',
});

define('ui-filter', UiFilter);

/* The two children are configuration rather than components: they carry the
   questions into <ui-filter> and are read once, at upgrade. They are defined
   so the parser keeps them as elements and CSS can hide them, nothing more. */
class UiFilterGroup extends HTMLElement {}
class UiFilterFields extends HTMLElement {}
define('ui-filter-group', UiFilterGroup);
define('ui-filter-fields', UiFilterFields);

export { UiFilter };
