/**
 * Appointment Settings — Availability, Appointment Types, Appointment Status.
 * Screen glue only; all behaviour lives in the components.
 */
import {
  PROVIDER_AVAILABILITY,
  APPOINTMENT_TYPES,
  STATUS_COLOURS,
  BASIC_COLOURS,
  DURATION_UNITS,
  AVAILABLE_FORMS,
} from '../../data/appointments.js';
import { PRACTICE, ACTIVE_PRACTICE_ID } from '../../data/practice.js';
import { registerSwatches, swatchClass, swatchMarkup } from '../lib/swatches.js';
import { createColourMixer } from '../lib/colour-mixer.js';
import { createPager } from '../lib/pagination.js';
import { admits } from '../lib/filter-set.js';
import { notify } from '../lib/toast.js';

/*
 * Rows per page.
 *
 * Fifteen, which is the shared default in js/lib/pagination.js rather than a
 * number this screen picked. Ten was set when a settings list was a dozen rows
 * long and paging was mostly hypothetical; now that every one of these lists
 * runs past fifty, ten meant a full-height table card showing ten rows and
 * four hundred pixels of nothing under them, and six pages of a list nobody
 * wanted to page through. Fifteen fills the card on a laptop and the rows-per-
 * page control is right there for anyone who wants more.
 */
const PAGE_SIZE = 15;

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/* "Minute" is what the unit select holds and what a form label wants; the
   word beside a number in a row of overrides is "minutes". Pluralised here
   rather than at the three call sites so the two never drift apart. */
const unitWord = (unit) => `${String(unit ?? '').toLowerCase()}s`;

/* Saving and deleting an appointment type both need to answer the click — a
   Save button that changes nothing visible reads as broken. The words used to
   go into a line above the rail, which moved the list of types down by its own
   height for five seconds; notify() from lib/toast.js is imported above and
   the call sites below already spell it that way. */

/*
 * EVERY COLOUR THE SCREEN IS CURRENTLY PAINTING.
 *
 * registerSwatches() rewrites the whole generated stylesheet rather than
 * adding to it, so any colour left out of a call stops having a background.
 * Two panels on this screen pick colours — appointment types and appointment
 * statuses — and each used to pass its own list, which meant a type recoloured
 * on one tab went blank the moment the status dialog registered its own. So
 * both publish their live rows here, as functions rather than arrays, because
 * both reassign the array when a row is added or deleted and a snapshot taken
 * at start-up would go stale on the first New.
 *
 * Passing a colour in `extra` is how a shade that exists nowhere yet — one
 * being dragged out on the mixer — gets a class for the length of the drag,
 * and how the next drag replaces it instead of leaving a dead rule behind.
 */
const LIVE = { types: () => [], statuses: () => [] };

function allColours(...extra) {
  return [
    ...APPOINTMENT_TYPES.map((t) => t.color),
    ...STATUS_COLOURS.map((s) => s.color),
    ...LIVE.types().map((t) => t.color),
    ...LIVE.statuses().map((s) => s.color),
    ...BASIC_COLOURS,
    ...extra,
  ];
}

customElements.whenDefined('ui-data-table').then(() => {
  // Every runtime colour gets a generated CSS class up front.
  registerSwatches(allColours());

  initAvailability();
  initTypes();
  initColours();
  initCancellationPolicy();

  // ?tab=types lets the Settings hub link straight to a section rather than
  // dropping people on Availability and making them find it.
  const requested = new URLSearchParams(window.location.search).get('tab');
  if (['availability', 'types', 'colors', 'cancellation'].includes(requested)) {
    document.querySelector('[data-testid="apt--tabs"]')?.setAttribute('selected', requested);
  }
});

/* ===================== CANCELLATION POLICY =====================
   One rule: how late a patient may cancel before a fee applies, and what that
   fee is. Held here rather than on a record because it is a practice setting —
   it is read when a cancellation is taken, not stored per appointment.
   ============================================================================ */

function initCancellationPolicy() {
  const save = document.getElementById('cancelPolicySave');
  if (!save) return;

  const field = (id) => document.getElementById(id);

  save.addEventListener('ui-click', () => {
    const window_ = field('cancelWindow').value.trim();
    const windowUnit = field('cancelWindowUnit').value;
    const fee = field('cancelFee').value.trim();
    const feeUnit = field('cancelFeeUnit').value;

    /* Both numbers are required and neither may be negative: a policy with a
       blank in it is not a policy, and the flash is the only thing that tells
       the practice the press took. */
    if (window_ === '' || fee === '' || Number(window_) < 0 || Number(fee) < 0) {
      notify('Enter a cancellation window and a fee before saving.', 'warning');
      return;
    }

    const amount = feeUnit === '%' ? `${fee}%` : `$${fee}`;
    notify(
      `Cancellation policy saved — within ${window_} ${windowUnit.toLowerCase()}, charge ${amount}.`,
      'success'
    );
  });
}

/* ===================== AVAILABILITY ===================== */

function initAvailability() {
  const table = document.getElementById('availabilityTable');
  const search = document.querySelector('[data-testid="apt--availability-search"]');
  const filter = document.getElementById('providerFilter');
  const pager = createPager(document.getElementById('availabilityFoot'), {
    rowsPerPage: PAGE_SIZE,
    testidPrefix: 'apt-availability',
    onChange: () => paint(),
  });
  if (!table) return;

  /* Just the providers. Nothing ticked is what "all providers" means, so
     there is no row here that stands for it. */
  filter.setGroupOptions('provider', PROVIDER_AVAILABILITY.map((p) => p.name));

  let query = '';
  let provider = [];

  const COLUMNS = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      truncate: true,
      render: (row) =>
        `<a class="pt__name-link" href="provider-availability.html?provider=${encodeURIComponent(
          row.name
        )}">${row.name}</a>`,
    },
    {
      key: 'slots',
      label: 'Availability Slots',
      render: (row) => String(row.slots).padStart(2, '0'),
    },
    {
      key: 'blockDays',
      label: 'Block Days',
      render: (row) => String(row.blockDays).padStart(2, '0'),
    },
    { key: 'updated', label: 'Last Updated On', sortable: true, narrow: true },
    { key: 'updatedBy', label: 'Updated By', truncate: true },
  ];

  function rows() {
    return PROVIDER_AVAILABILITY.filter((p) => {
      const matchesProvider = admits(provider, p.name);
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.updatedBy.toLowerCase().includes(query.toLowerCase());
      return matchesProvider && matchesQuery;
    });
  }

  function paint() {
    const all = rows();
    const { start, end } = pager.render(all.length);

    table.columns = COLUMNS;
    table.rows = all.slice(start, end);
    table.setAttribute('state', end > start ? 'ready' : 'empty');
  }

  search?.addEventListener('ui-input', (event) => {
    query = event.detail.value;
    pager.reset();
    paint();
  });
  /* The tab bar's controls belong to one tab each and swap with it: a search
     box left over a table two tabs away is a control that appears to do
     nothing. Same shape Inventory uses for its two views. */
  const tabActions = { availability: 'availabilityActions', colors: 'statusActions' };
  document.querySelector('[data-testid="apt--tabs"]')?.addEventListener('ui-change', (event) => {
    Object.entries(tabActions).forEach(([tab, id]) => {
      const group = document.getElementById(id);
      if (group) group.hidden = tab !== event.detail.value;
    });
  });

  filter?.addEventListener('ui-filter-change', (event) => {
    provider = event.detail.values.provider;
    pager.reset();
    paint();
  });

  paint();
}

/* ===================== APPOINTMENT TYPES ===================== */

/**
 * APPOINTMENT TYPES
 *
 * A rail of types on the left, one editable type on the right.
 *
 * WHAT IS NOT HERE, AND WHY
 * There is no Description and no Procedure Code. The description was prose
 * nobody reads on a settings screen, and a billing code pinned to the
 * appointment type would pre-decide the claim before anyone has seen the
 * patient — what gets billed is decided on the encounter, from what was
 * actually done.
 *
 * PROVIDER DURATIONS
 * The default duration is what the type takes. Any provider who differs gets
 * a row of their own, because the same visit genuinely takes different people
 * different lengths of time. A practice that does not care never adds a row
 * and never sees the mechanism.
 *
 * EDITING
 * The detail pane IS the editor, and Save writes every field back — title,
 * colour, duration, provider overrides and forms. Before, only the title
 * survived: a changed duration was silently discarded on the next click,
 * which is worse than not offering the field.
 *
 * ONE PRACTICE PROFILE AT A TIME
 * The rail lists what the entity you are working as offers, not every type
 * in the database — the ASC's list is four items and the clinic's is
 * thirteen, and showing both together is how someone books an endoscopy into
 * a consulting room. Which profile that is comes from Practice Settings; the
 * banner above the rail names it so the shorter list never reads as data
 * gone missing.
 */
function initTypes() {
  const rail = document.getElementById('typeRail');
  const detail = document.getElementById('typeDetail');
  const newButton = document.querySelector('[data-testid="apt--new-type"]');
  const deleteModal = document.getElementById('typeDeleteModal');
  const scope = document.getElementById('typeScope');
  if (!rail) return;

  let types = APPOINTMENT_TYPES.filter((t) => t.profiles.includes(ACTIVE_PRACTICE_ID)).map((t) => ({
    ...t,
    profiles: [...t.profiles],
    forms: [...t.forms],
    // Deep-copied, not shared: editing 45 down to 40 here must not reach back
    // into the seed data and change what every other screen reads.
    providerDurations: (t.providerDurations ?? []).map((row) => ({ ...row })),
  }));
  let selectedId = types[0]?.id ?? '';
  let pendingDelete = null;
  // The mixer is rebuilt with the pane, so the handle has to be re-pointed on
  // every paint rather than captured once.
  let mixer = null;

  // Published for allColours() — a function, because `types` is reassigned by
  // New and by Delete and a snapshot would go stale on the first click.
  LIVE.types = () => types;

  if (scope) {
    scope.innerHTML = `Showing the ${esc(types.length ? String(types.length) : 'no')} appointment
      type${types.length === 1 ? '' : 's'} offered by
      <strong>${esc(PRACTICE.name)}</strong>.
      <a href="practice-settings.html?tab=profile" data-testid="apt--type-scope-link"
        >Switch practice profile</a>`;
  }

  const selectedType = () => types.find((t) => t.id === selectedId) ?? null;

  function paintRail() {
    rail.innerHTML = types
      .map(
        (t) =>
          `<button type="button" class="set__rail-item" data-type-id="${t.id}"
             aria-current="${t.id === selectedId}">
             ${swatchMarkup(t.color, 'ui-swatch--sm')}
             <span class="set__rail-label">${esc(t.title)}</span>
           </button>`
      )
      .join('');

    rail.querySelectorAll('[data-type-id]').forEach((button) =>
      button.addEventListener('click', () => {
        selectedId = button.dataset.typeId;
        paintRail();
        paintDetail();
      })
    );
  }

  /** Read every control back into the type. One place, so Save and the
   *  provider-row buttons cannot disagree about what is on screen. */
  function collect(type) {
    const title = detail.querySelector('[data-testid="apt--type-title"]')?.value?.trim();
    if (title) type.title = title;

    const duration = Number(detail.querySelector('[data-testid="apt--type-duration"]')?.value);
    if (Number.isFinite(duration) && duration > 0) type.duration = duration;

    const unit = detail.querySelector('[data-testid="apt--type-unit"]')?.value;
    if (unit) type.unit = unit;

    /* The override rows are read back positionally — the index in the markup
       is the index in the array, which is also why removing one repaints
       rather than splicing the DOM. A row left blank or zeroed is not an
       override of anything, so it keeps whatever it had. */
    detail.querySelectorAll('[data-override-duration]').forEach((field) => {
      const row = type.providerDurations[Number(field.dataset.overrideDuration)];
      const minutes = Number(field.value);
      if (row && Number.isFinite(minutes) && minutes > 0) row.duration = minutes;
    });
  }

  /**
   * Repaint everything that shows the type's colour, without repainting the
   * pane. The mixer fires on every pointer move, and a full paintDetail() there
   * would tear the control out from under the finger holding it.
   */
  function setColour(type, hex, { fromMixer = false } = {}) {
    type.color = hex;
    // The dragged colour has never been seen before, so it is passed as an
    // extra rather than found in the lists.
    registerSwatches(allColours(hex));

    const railSwatch = rail.querySelector(`[data-type-id="${type.id}"] .ui-swatch`);
    if (railSwatch) {
      railSwatch.className = `ui-swatch ${swatchClass(hex)} ui-swatch--sm`;
      railSwatch.title = hex;
    }

    detail
      .querySelectorAll('[data-pick-colour]')
      .forEach((swatch) =>
        swatch.setAttribute('aria-pressed', String(swatch.dataset.pickColour === hex))
      );

    // Pushing the value back into the mixer mid-drag would fight the pointer.
    if (!fromMixer) mixer?.setValue(hex);
  }

  function paintDetail() {
    const type = selectedType();
    if (!type) {
      detail.innerHTML = `<p class="set__field-note" data-testid="apt--no-types">
        No appointment types yet. Use New to add one.
      </p>`;
      return;
    }

    detail.innerHTML = `
      <div class="set__detail-head">
        <h2 class="set__detail-title">${esc(type.title)}</h2>
        <span class="set__spacer"></span>
        <ui-button variant="outline" size="sm" icon="trash" data-testid="apt--type-delete"
          >Delete</ui-button
        >
      </div>

      <div class="set__stack">
        <ui-input label="Appointment Type Title" required value="${esc(type.title)}"
                  data-testid="apt--type-title"></ui-input>

        <!-- The palette stands open on the card rather than hanging off a
             swatch. A colour is what a type IS on the calendar — the thing
             everybody recognises it by before they have read the name — so on
             the one screen where it is set it is worth the room, and burying
             the fifty-six agreed colours behind a click made choosing between
             them a memory exercise. -->
        <div class="set__colour-field">
          <span class="ui-field__label">Color Code</span>
          <div class="set__palette set__palette--wide" data-testid="apt--type-palette">
            <span class="set__palette-label">Basic Colours</span>
            <div class="set__palette-grid" role="group" aria-label="Basic colours">
              ${BASIC_COLOURS.map(
                (colour) => `<button type="button" class="set__palette-swatch ${swatchClass(
                  colour
                )}" data-pick-colour="${colour}"
                  aria-pressed="${colour === type.color}" aria-label="${colour}"></button>`
              ).join('')}
            </div>
            <!-- Built by js/lib/colour-mixer.js; this is only where it lands.
                 No opacity ramp: a type's colour is painted as a solid calendar
                 block, and a half-transparent one reads as a rendering fault. -->
            <div data-colour-mixer></div>
          </div>
        </div>

        <div>
          <span class="ui-field__label">Default Appointment Duration<span
            class="ui-field__required" aria-hidden="true"> *</span></span>
          <div class="set__duration">
            <ui-input type="number" min="1" value="${type.duration}" label="Duration" label-hidden
              data-testid="apt--type-duration"></ui-input>
            <ui-select options="${DURATION_UNITS.join(',')}" value="${type.unit}"
              label="Unit" label-hidden data-testid="apt--type-unit"></ui-select>
          </div>
        </div>

        <!-- PROVIDER-SPECIFIC DURATION.
             The exception list, and deliberately sized like one: most types
             have no rows here at all. A new patient seen by a nurse
             practitioner genuinely runs forty-five minutes where the same
             visit with a consultant runs thirty, and a practice with no way to
             say so either over-runs every clinic or pads the default for
             everybody. Naming somebody overrides the default for them alone. -->
        <div class="set__overrides">
          <span class="ui-field__label">Provider-specific duration</span>
          <p class="set__field-note">
            The same visit can take different providers different lengths of time.
            Anyone listed here overrides the default; everyone else uses it.
          </p>

          <div class="set__override-list" data-testid="apt--type-overrides">
            ${type.providerDurations
              .map(
                (row, index) =>
                  `<div class="set__override">
                     <span class="set__override-name">${esc(row.provider)}</span>
                     <ui-input type="number" min="1" value="${row.duration}"
                       label="Duration for ${esc(row.provider)}" label-hidden
                       class="set__override-num" data-override-duration="${index}"></ui-input>
                     <span class="set__override-unit">${esc(unitWord(type.unit))}</span>
                     <button type="button" class="ui-row-menu-btn" data-remove-override="${index}"
                             aria-label="Remove ${esc(row.provider)}">
                       <svg class="ui-icon" aria-hidden="true"><use href="#i-close"></use></svg>
                     </button>
                   </div>`
              )
              .join('')}
          </div>

          <!-- Providers already listed are not offered again: two rows for one
               person is a contradiction the panel would have no way to settle. -->
          <div class="set__attach">
            <ui-select placeholder="Select provider" options="${esc(
              PROVIDER_AVAILABILITY.filter(
                (p) => !type.providerDurations.some((row) => row.provider === p.name)
              )
                .map((p) => p.name)
                .join(',')
            )}" id="providerPicker" label="Provider" label-hidden
              data-testid="apt--override-picker"></ui-select>
            <ui-button variant="outline" data-testid="apt--add-override">Add</ui-button>
          </div>
        </div>

        <div>
          <span class="ui-field__label">Attach Forms</span>
          <div class="set__attach">
            <ui-select placeholder="Select Forms" options="${AVAILABLE_FORMS.join(',')}"
                       id="formPicker" label="Form" label-hidden></ui-select>
            <ui-button variant="outline" data-testid="apt--attach-form">Add</ui-button>
          </div>
        </div>

        <div class="set__form-list" data-testid="apt--attached-forms">
          ${
            type.forms.length
              ? type.forms
                  .map(
                    (form, index) =>
                      `<div class="set__form-item">
                         <span>${index + 1}. ${esc(form)}</span>
                         <button type="button" class="ui-row-menu-btn" data-remove-form="${index}"
                                 aria-label="Remove ${esc(form)}">
                           <svg class="ui-icon" aria-hidden="true"><use href="#i-close"></use></svg>
                         </button>
                       </div>`
                  )
                  .join('')
              : '<p class="set__field-note">No forms attached.</p>'
          }
        </div>
      </div>

      <div class="set__detail-actions">
        <ui-button variant="primary" data-testid="apt--type-save">Save</ui-button>
      </div>`;

    wireDetail(type);
  }

  function wireDetail(type) {
    /*
     * The grid answers "one of ours"; the mixer answers "ours, but a shade
     * lighter". Picking a tile seeds the mixer with it, so a swatch is a
     * starting point to nudge rather than a dead end — which is why the two sit
     * in one panel rather than behind a tab each. Same arrangement the
     * Appointment Status dialog uses.
     */
    const mixerHost = detail.querySelector('[data-colour-mixer]');
    mixer = mixerHost
      ? createColourMixer(mixerHost, {
          value: type.color,
          alpha: false,
          testid: 'apt--type-mixer',
          onInput: (hex) => setColour(type, hex, { fromMixer: true }),
        })
      : null;

    // Neither the tiles nor the mixer repaints the pane: the rail chip, the
    // pressed tile and the mixer's own result swatch are the whole answer to
    // the click, and a repaint mid-drag would tear the mixer out from under
    // the pointer holding it.
    detail.querySelectorAll('[data-pick-colour]').forEach((button) =>
      button.addEventListener('click', () => setColour(type, button.dataset.pickColour))
    );

    /* Adding an override needs a name and nothing else: the duration opens at
       the type's default, which is the honest starting point — an override is
       a number somebody CHANGES, and a row that opens blank is a row that
       silently means nothing until it is filled in. */
    detail.querySelector('[data-testid="apt--add-override"]')?.addEventListener('ui-click', () => {
      const provider = detail.querySelector('#providerPicker')?.value;
      if (!provider || type.providerDurations.some((row) => row.provider === provider)) return;
      collect(type);
      type.providerDurations = [...type.providerDurations, { provider, duration: type.duration }];
      paintDetail();
    });

    detail.querySelectorAll('[data-remove-override]').forEach((button) =>
      button.addEventListener('click', () => {
        collect(type);
        type.providerDurations = type.providerDurations.filter(
          (_, i) => i !== Number(button.dataset.removeOverride)
        );
        paintDetail();
      })
    );

    // Minute or Hour is the word beside every override row as well as the unit
    // of the default, so switching it repaints rather than leaving two rows
    // saying "45 minutes" under a duration measured in hours.
    detail.querySelector('[data-testid="apt--type-unit"]')?.addEventListener('ui-change', () => {
      collect(type);
      paintDetail();
    });

    detail
      .querySelector('[data-testid="apt--attach-form"]')
      ?.addEventListener('ui-click', () => {
        const value = detail.querySelector('#formPicker')?.value;
        if (!value || type.forms.includes(value)) return;
        collect(type);
        type.forms = [...type.forms, value];
        paintDetail();
      });

    detail.querySelectorAll('[data-remove-form]').forEach((button) =>
      button.addEventListener('click', () => {
        collect(type);
        type.forms = type.forms.filter((_, i) => i !== Number(button.dataset.removeForm));
        paintDetail();
      })
    );

    // Renaming updates the rail as you type, so the two never disagree.
    detail
      .querySelector('[data-testid="apt--type-title"]')
      ?.addEventListener('ui-input', (event) => {
        type.title = event.detail.value;
        paintRail();
        const heading = detail.querySelector('.set__detail-title');
        if (heading) heading.textContent = type.title;
      });

    detail.querySelector('[data-testid="apt--type-save"]')?.addEventListener('ui-click', () => {
      collect(type);
      if (!type.title.trim()) {
        notify('An appointment type needs a name.', 'warning');
        return;
      }
      /* Both required fields are checked, not just the name. A duration box
         cleared to nothing keeps its old value through collect(), so without
         this the Save would report success on a figure the practice thinks it
         just changed. */
      const duration = Number(detail.querySelector('[data-testid="apt--type-duration"]')?.value);
      if (!Number.isFinite(duration) || duration <= 0) {
        notify('Give the appointment type a duration of at least one.', 'warning');
        return;
      }
      paintRail();
      paintDetail();
      notify(`“${type.title}” saved.`, 'success');
    });

    detail.querySelector('[data-testid="apt--type-delete"]')?.addEventListener('ui-click', (event) => {
      pendingDelete = type.id;
      const body = document.getElementById('typeDeleteBody');
      if (body) {
        body.innerHTML = `<p>“${esc(type.title)}” will no longer be offered when booking.</p>`;
      }
      deleteModal?.open(event.target.closest('ui-button'));
    });
  }

  document
    .querySelector('[data-testid="apt--type-delete-confirm"]')
    ?.addEventListener('ui-click', () => {
      const type = types.find((t) => t.id === pendingDelete);
      if (!type) return;

      types = types.filter((t) => t.id !== pendingDelete);
      if (selectedId === pendingDelete) selectedId = types[0]?.id ?? '';
      pendingDelete = null;

      deleteModal?.close();
      paintRail();
      paintDetail();
      notify(`“${type.title}” deleted.`, 'success');
    });

  for (const button of document.querySelectorAll('[data-apt-dismiss]')) {
    button.addEventListener('ui-click', () => button.closest('ui-modal')?.close());
  }

  newButton?.addEventListener('ui-click', () => {
    const created = {
      id: `at-new-${Date.now()}`,
      title: 'Untitled appointment type',
      color: BASIC_COLOURS[0],
      duration: 30,
      unit: 'Minute',
      // Created against the profile you are working as. Offering it to the
      // other entity as well is a decision, not a default.
      profiles: [ACTIVE_PRACTICE_ID],
      providerDurations: [],
      forms: [],
    };
    types = [created, ...types];
    selectedId = created.id;
    registerSwatches(allColours());
    paintRail();
    paintDetail();
    detail.querySelector('[data-testid="apt--type-title"]')?.focus();
  });

  /* NO OUTSIDE-CLICK OR ESCAPE HANDLER. Both used to close the palette
     popover; the palette is part of the card now, so there is nothing left for
     a click on the rest of the screen to dismiss. */

  paintRail();
  paintDetail();
}

/* ===================== APPOINTMENT STATUS ===================== */

function initColours() {
  const table = document.getElementById('colorTable');
  const foot = document.getElementById('colorFoot');
  const modal = document.getElementById('colorModal');
  const nameField = document.querySelector('[data-testid="apt--color-name"]');
  const trigger = document.getElementById('colorTrigger');
  const preview = document.getElementById('colorPreview');
  const palette = document.getElementById('palette');
  const grid = document.getElementById('paletteGrid');
  const mixerHost = document.getElementById('colorMixer');
  const saveButton = document.querySelector('[data-testid="apt--color-save"]');
  const newButton = document.querySelector('[data-testid="apt--new-status"]');
  if (!table) return;

  const pager = createPager(foot, {
    rowsPerPage: PAGE_SIZE,
    noun: 'statuses',
    testidPrefix: 'apt-colors',
    onChange: () => paint(),
  });

  let statuses = STATUS_COLOURS.map((s) => ({ ...s }));
  // Published for allColours(), as a function: `statuses` is reassigned by New
  // and by every Save, so a snapshot would go stale on the first click.
  LIVE.statuses = () => statuses;
  let editingId = null;
  let draftColour = null;
  let isNew = false;
  let nextId = statuses.length + 1;

  const COLUMNS = [
    { key: 'name', label: 'Appointment Status', truncate: true },
    { key: 'color', label: 'Color', narrow: true, render: (row) => swatchMarkup(row.color) },
    { key: 'updated', label: 'Updated Date', narrow: true },
    { key: 'created', label: 'Created Date', narrow: true },
    {
      key: 'action',
      label: 'Action',
      actions: true,
      render: (row) =>
        `<button type="button" class="ui-row-menu-btn" data-edit="${row.id}"
                 aria-label="Edit ${row.name} colour">
           <svg class="ui-icon"><use href="#i-pencil"></use></svg>
         </button>`,
    },
  ];

  function paint() {
    const { start, end } = pager.render(statuses.length);
    table.columns = COLUMNS;
    table.rows = statuses.slice(start, end);
    table.querySelectorAll('[data-edit]').forEach((button) =>
      button.addEventListener('click', () => openEditor(button.dataset.edit, button))
    );
  }

  function setPreview(hex, { fromMixer = false } = {}) {
    draftColour = hex;
    // A mixed colour is not in the sheet yet — it has never been seen before.
    registerSwatches(allColours(hex));
    preview.className = `ui-swatch ui-swatch--lg ${swatchClass(hex)}`;
    preview.title = hex;
    grid.querySelectorAll('[data-colour]').forEach((swatch) =>
      swatch.setAttribute('aria-pressed', String(swatch.dataset.colour === hex))
    );
    // Pushing the value back into the mixer mid-drag would fight the pointer.
    if (!fromMixer) mixer?.setValue(hex);
  }

  function openEditor(id, opener) {
    const status = statuses.find((s) => s.id === id);
    editingId = id;
    isNew = false;
    modal.setAttribute('heading', 'Edit Appointment Status');
    // Existing statuses are named by the system, so the name is read-only.
    nameField.setAttribute('readonly', '');
    nameField.setAttribute('value', status.name);
    palette.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    setPreview(status.color);
    modal.open(opener);
  }

  function openCreator(opener) {
    editingId = null;
    isNew = true;
    modal.setAttribute('heading', 'New Appointment Status');
    // A brand new status needs a name, so the field opens editable and empty.
    nameField.removeAttribute('readonly');
    nameField.setAttribute('value', '');
    nameField.removeAttribute('error');
    palette.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    setPreview(BASIC_COLOURS[0]);
    modal.open(opener);
  }

  grid.innerHTML = BASIC_COLOURS.map(
    (hex) =>
      `<button type="button" class="set__palette-swatch ${swatchClass(hex)}"
               data-colour="${hex}" aria-pressed="false" aria-label="${hex}"></button>`
  ).join('');

  grid.querySelectorAll('[data-colour]').forEach((swatch) =>
    swatch.addEventListener('click', () => setPreview(swatch.dataset.colour))
  );

  /*
   * The grid answers "one of ours"; the mixer answers "ours, but a shade
   * lighter". Picking a tile above seeds the mixer with it, so the swatch is a
   * starting point to nudge rather than a dead end — which is the whole reason
   * the two sit in one panel instead of behind a tab each.
   */
  const mixer = mixerHost
    ? createColourMixer(mixerHost, {
        value: BASIC_COLOURS[0],
        testid: 'apt--mixer',
        onInput: (hex) => setPreview(hex, { fromMixer: true }),
      })
    : null;

  trigger?.addEventListener('click', () => {
    const open = palette.hidden;
    palette.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });

  newButton?.addEventListener('ui-click', (event) => openCreator(event.target));

  saveButton?.addEventListener('ui-click', () => {
    if (isNew) {
      const name = nameField.value.trim();
      if (!name) {
        nameField.setAttribute('error', 'Give the status a name');
        return;
      }
      nameField.removeAttribute('error');
      statuses = [
        {
          id: `sc${nextId++}`,
          name,
          color: draftColour,
          updated: '03-08-2026',
          created: '03-08-2026',
        },
        ...statuses,
      ];
      // Now that the list is paged, appending would drop the new status onto
      // the last page, out of sight — so it goes to the top and the pager
      // goes back to page one, as in Master and the fee schedule.
      pager.reset();
    } else {
      statuses = statuses.map((s) =>
        s.id === editingId ? { ...s, color: draftColour, updated: '03-08-2026' } : s
      );
    }

    registerSwatches(allColours());
    paint();
    modal.close();
  });

  modal?.addEventListener('ui-click', (event) => {
    if (event.target.closest('[data-modal-dismiss]')) modal.close();
  });

  paint();
}
