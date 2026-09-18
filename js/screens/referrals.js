/**
 * Referral management — the intake desk.
 *
 * Three panels: the queue on the left, the referral in the middle, and — for
 * outgoing referrals only — the context that decides whether it can be sent
 * on the right. The queue never moves, because the desk works down it.
 *
 * THE MECHANIC THIS SCREEN IS BUILT AROUND
 * Nobody retypes a fax. Process Document runs OCR over the pages, the
 * extraction fills the registration form, and the person at the desk corrects
 * rather than transcribes. Every extracted field carries a confidence, and
 * the low ones are marked, because "check everything" and "check nothing" are
 * the same instruction in practice.
 *
 * The other rule worth stating: an outgoing referral cannot be transmitted
 * until the patient has signed the Release of Information. The Send button
 * stays shut behind it rather than warning and proceeding — a rule that can
 * be clicked past is not a rule.
 */
import {
  REFERRALS_IN,
  REFERRALS_OUT,
  STATUS_IN,
  STATUS_OUT,
  STATUS_TONES,
  PRIORITIES,
  PRIORITY_TONES,
  REFERRAL_SOURCES,
  REFERRED_TO,
  DOCUMENT_TYPES,
  CONTACT_DIRECTORY,
  FACILITY_SUGGESTIONS,
  REFERRING_PROVIDERS,
  ROI_STEPS,
  OCR_EXTRACTS,
  ADDON_ACTIONS,
  REJECTION_REASONS,
} from '../../data/referrals.js';
import { ICD10 } from '../../data/encounter.js';
import { DIRECTORY } from '../../data/directory.js';
import { notify } from '../lib/toast.js';
import { admits, chosen } from '../lib/filter-set.js';

/* ===================== Helpers ===================== */

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TODAY = '2026-08-05';

/** "Yesterday" beats a date when the date is yesterday. */
function whenLabel(iso) {
  const [date] = iso.split('T');
  if (date === TODAY) return 'Today';
  const day = new Date(`${date}T00:00`);
  const today = new Date(`${TODAY}T00:00`);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 1) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function longWhen(iso) {
  const [date, time = ''] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    new Date(`${date}T00:00`).getDay()
  ];
  if (!time) return `${weekday}, ${d} ${MONTHS[m - 1]} ${y}`;
  const [hh, mm] = time.split(':').map(Number);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${weekday}, ${d} ${MONTHS[m - 1]} ${y} ${String(hour).padStart(2, '0')}:${String(
    mm
  ).padStart(2, '0')} ${suffix}`;
}

/** Write a value into a field component, attribute and live control both. */
function setValue(node, value) {
  if (!node) return;
  const next = value ?? '';
  node.setAttribute('value', next);
  const control = node.querySelector('input, select, textarea');
  if (control) control.value = next;
}

/** Fill a <ui-select> from plain strings. */
function options(id, list, value = '') {
  const node = el(id);
  if (!node) return;
  node.optionList = list.map((v) => ({ value: v, label: v }));
  setValue(node, value);
}

/** Runtime geometry, never an inline style. */
function writeGeometry(rules) {
  el('refGeometry').textContent = rules.join('\n');
}

/* ===================== State ===================== */

/*
 * The referrals are copied because this screen mutates them — statuses move,
 * unread clears, new ones are created. The imported arrays stay as the seed.
 */
const referrals = {
  in: REFERRALS_IN.map((r) => ({ ...r })),
  out: REFERRALS_OUT.map((r) => ({ ...r })),
};

let nextId = 100;

const state = {
  direction: 'in',
  channel: 'fax',
  selected: { in: '', out: '' },
  query: '',
  filters: { status: '', priority: '', source: '', stat: false, unread: false },

  /* Fax viewer */
  page: 0,
  zoom: 1,
  rotation: 0,

  /* Which documents in the strip are ticked. Indices into the referral's own
     page or attachment list, so it is cleared whenever the referral changes —
     "the second one" means nothing once a different fax is open. */
  picked: new Set(),

  /* Create drawer */
  createChannel: 'fax',
  createRecipient: 'directory',
  attachments: [],

  /* Process flow */
  processing: null, // { referral, patient, page }
  classifyFor: '',
  classify: new Set(),
};

const current = () => referrals[state.direction];
const selectedId = () => state.selected[state.direction];
const selected = () => current().find((r) => r.id === selectedId()) ?? null;

/* ===================== The queue ===================== */

function matchesQuery(referral) {
  if (state.query) {
    const target = state.direction === 'in' ? referral.from : referral.referredTo;
    const haystack = [
      referral.patient.name,
      referral.patient.mrn,
      referral.summary,
      referral.reason,
      target?.provider,
      target?.facility,
      referral.subject,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(state.query.toLowerCase())) return false;
  }

  /* Sets, not single answers: a referral queue is worked by state — everything
     Pending and everything Scheduled, the STAT and Urgent ones together — and
     three separate passes were the only way to see that before. The two
     checkboxes below stay booleans; they were already a set of one each. */
  const f = state.filters;
  if (!admits(f.status, referral.status)) return false;
  if (!admits(f.priority, referral.priority)) return false;
  if (!admits(f.source, referral.source)) return false;
  if (f.stat && !referral.stat) return false;
  if (f.unread && !referral.unread) return false;
  return true;
}

function visibleReferrals() {
  return current()
    .filter((r) => r.channel === state.channel && matchesQuery(r))
    .sort((a, b) => b.receivedAt?.localeCompare(a.receivedAt ?? '') ?? 0);
}

/**
 * What the two directions are called on screen.
 *
 * Named once because the phrase appears in six places — the tabs, the create
 * button, the create dialog's heading, the ROI note and the confirmation — and
 * a rename that reaches five of them leaves the sixth quietly disagreeing with
 * the rest of the screen. The ids stay `in` / `out`; only the wording moves.
 */
const DIRECTION_LABEL = { in: 'Document In', out: 'Document Out' };

const directionLabel = (id) => DIRECTION_LABEL[id] ?? DIRECTION_LABEL.in;

/**
 * Both strips are <ui-tabs> now, so painting them is only a matter of writing
 * the selection. The component owns the markup, the roving tabindex and the
 * arrow keys — which is also why neither of these repaints the strip: the
 * `selected` attribute patches in place, so the button under the pointer
 * survives and focus stays where the user put it.
 *
 * Neither strip carries a count any more. The queue under it is the count, and
 * it is the version you can act on.
 */
function paintDirTabs() {
  const tabs = el('dirTabs');
  tabs.setAttribute('selected', state.direction);

  // ui-button captures its label once at connect, so the visible span is the
  // thing to write. Setting textContent on the host would delete the button.
  const label = `Create ${directionLabel(state.direction)}`;
  const span = el('createBtn').querySelector('.ui-btn__label');
  if (span) span.textContent = label;
}

function paintChanTabs() {
  el('chanTabs').setAttribute('selected', state.channel);
}

/* --- Quick views -------------------------------------------------------------
   Five chips over the queue, each of them a filter the panel underneath can
   already set. They exist because these five are the ones the desk sets twenty
   times a day, and a panel that has to be opened to tick "Unread" is too much
   ceremony for a question asked that often.

   THE CHIPS HOLD NO STATE OF THEIR OWN. Which one looks lit is read back out
   of state.filters every repaint, and clicking one writes the filters and then
   the panel controls. A chip and the panel can therefore never disagree about
   what the queue is showing, which is the failure mode of every quick-filter
   row that keeps its own variable.
   -------------------------------------------------------------------------- */

const QUICK_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'stat', label: 'STAT' },
  { id: 'Primary', label: 'Primary' },
  { id: 'Secondary', label: 'Secondary' },
];

/** Which chip the current filter state amounts to, or none of them. */
function activeQuick() {
  const f = state.filters;
  const priority = chosen(f.priority);
  const narrowed =
    f.unread || f.stat || priority.length || chosen(f.status).length || chosen(f.source).length;

  if (!narrowed) return 'all';
  if (f.unread && !f.stat && !priority.length) return 'unread';
  if (f.stat && !f.unread && !priority.length) return 'stat';
  if (priority.length === 1 && !f.unread && !f.stat) return priority[0];
  return ''; // a combination the chips cannot say — none of them is lit
}

function paintChips() {
  const active = activeQuick();
  el('quickChips').innerHTML = QUICK_VIEWS.map(
    (view) => `<button type="button" class="ref__chip${
      view.id === active ? ' ref__chip--on' : ''
    }" data-quick="${esc(view.id)}" aria-pressed="${view.id === active}"
      data-testid="ref--chip-${esc(view.id.toLowerCase())}">${esc(view.label)}</button>`
  ).join('');

  el('quickChips').querySelectorAll('[data-quick]').forEach((chip) =>
    chip.addEventListener('click', () => applyQuick(chip.dataset.quick))
  );
}

/** A chip is exclusive: it says what the queue is showing, not what to add. */
function applyQuick(id) {
  state.filters.unread = id === 'unread';
  state.filters.stat = id === 'stat';
  state.filters.priority = PRIORITIES.includes(id) ? id : '';
  if (id === 'all') {
    state.filters.status = '';
    state.filters.source = '';
  }
  syncFilterControls();
  paintChips();
  paintQueue();
}

/**
 * Write the filter state back into the panel.
 *
 * A chip and the panel can never disagree about what the queue is showing,
 * which is the whole reason the chips paint from `state.filters` rather than
 * from a variable of their own. `stat` and `unread` are booleans on the state
 * and two answers to one question in the panel, so they are translated here.
 */
function syncFilterControls() {
  const flags = [];
  if (state.filters.stat) flags.push('STAT');
  if (state.filters.unread) flags.push('Unread');

  el('refFilter').value = {
    status: chosen(state.filters.status),
    priority: chosen(state.filters.priority),
    source: chosen(state.filters.source),
    flags,
  };
}

/** The badges a card carries. Priority and urgency are different axes. */
function cardBadges(referral) {
  const badges = [];
  if (referral.priority) {
    badges.push(
      `<ui-badge status="${PRIORITY_TONES[referral.priority]}" size="sm">${esc(
        referral.priority
      )}</ui-badge>`
    );
  }
  if (referral.stat) badges.push('<span class="ref__stat">STAT</span>');
  if (referral.status) {
    badges.push(
      `<ui-badge status="${STATUS_TONES[referral.status] ?? 'neutral'}" size="sm">${esc(
        referral.status
      )}</ui-badge>`
    );
  }
  return badges.join('');
}

function paintQueue() {
  const rows = visibleReferrals();
  el('queueEmpty').hidden = rows.length > 0;

  el('queueList').innerHTML = rows
    .map((referral) => {
      const contact =
        referral.channel === 'fax'
          ? state.direction === 'in'
            ? referral.from.fax
            : referral.referredTo.fax
          : state.direction === 'in'
            ? referral.from.email
            : referral.referredTo.email ?? referral.patient.email;

      const docs =
        (referral.pages?.length ?? 0) + (referral.attachments?.length ?? 0);

      return `<button type="button" class="ref__card${
        referral.id === selectedId() ? ' ref__card--on' : ''
      }" data-ref="${referral.id}" data-testid="ref--card-${referral.id}">
        <ui-avatar name="${esc(referral.patient.name)}" size="sm"></ui-avatar>
        <span class="ref__card-body">
          <span class="ref__card-top">
            <strong class="ref__card-name">${esc(referral.patient.name)}</strong>
            ${cardBadges(referral)}
            <span class="ref__card-when">${esc(whenLabel(referral.receivedAt ?? referral.createdAt))}</span>
          </span>
          ${
            state.direction === 'out'
              ? `<span class="ref__card-line">${esc(referral.referredTo.facility)}</span>
                 <span class="ref__card-line ref__card-line--dim">${esc(
                   referral.referredTo.specialty
                 )}</span>`
              : `<span class="ref__card-line">${esc(referral.summary)}</span>`
          }
          <span class="ref__card-foot">
            <svg class="ui-icon" aria-hidden="true">
              <use href="#i-${referral.channel === 'fax' ? 'printer' : 'mail'}"></use>
            </svg>
            ${esc(contact ?? '—')}
          </span>
          <span class="ref__card-docs">${docs} document${docs === 1 ? '' : 's'}</span>
        </span>
        ${referral.unread ? '<span class="ref__unread" aria-label="Unread"></span>' : ''}
      </button>`;
    })
    .join('');

  el('queueList').querySelectorAll('[data-ref]').forEach((card) =>
    card.addEventListener('click', () => select(card.dataset.ref))
  );
}

function select(id) {
  state.selected[state.direction] = id;
  const referral = selected();
  if (referral) referral.unread = false;
  state.page = 0;
  state.zoom = 1;
  state.rotation = 0;
  state.picked.clear();
  paintQueue();
  paintMain();
}

/* ===================== Centre: the referral ===================== */

function paintMain() {
  const referral = selected();
  el('emptyState').hidden = Boolean(referral);
  el('docPane').hidden = !referral;
  el('infoPane').hidden = !(referral && state.direction === 'out');

  if (!referral) return;

  el('docAvatar').setAttribute('name', referral.patient.name);

  const badges = [
    referral.priority
      ? `<ui-badge status="${PRIORITY_TONES[referral.priority]}" size="sm">${esc(
          referral.priority
        )}</ui-badge>`
      : '',
    referral.stat ? '<span class="ref__stat">STAT</span>' : '',
    `<ui-badge status="${STATUS_TONES[referral.status] ?? 'neutral'}" size="sm">${esc(
      referral.status
    )}</ui-badge>`,
  ].join('');

  /* The kind pill sits between the name and the badges: what this record IS
     comes before how urgent it is and where it has got to. */
  el('docName').innerHTML = `${esc(referral.patient.name)}
    <span class="ref__doc-kind">${esc(directionLabel(state.direction))}</span>${badges}`;

  const contact =
    referral.channel === 'email'
      ? state.direction === 'in'
        ? referral.from.email
        : referral.referredTo.email ?? referral.patient.email
      : state.direction === 'in'
        ? referral.from.fax
        : referral.referredTo.fax;

  el('docSub').innerHTML = `
    <div>
      <dt>${state.direction === 'in' ? 'From' : 'To'}</dt>
      <dd>${esc(contact ?? '—')}</dd>
    </div>
    <div>
      <dt>${state.direction === 'in' ? 'Received' : 'Created'}</dt>
      <dd>${esc(longWhen(referral.receivedAt ?? referral.createdAt))}</dd>
    </div>`;

  if (referral.channel === 'email') paintEmail(referral);
  else paintFax(referral);

  if (state.direction === 'out') paintInfo(referral);
  paintAddonMenu();
}

/* --- The document strip ------------------------------------------------------
   A referral is almost never one document. It is a cover sheet, a clinical
   summary, an insurance page and a lab report that happened to travel down the
   same phone line, and the desk works across the set rather than down a single
   page — which is why the set runs along the foot of the pane, wide enough to
   read the titles, rather than down a rail of numbered thumbnails at the side.
   The rail could say "page 3"; the strip can say "Insurance verification", and
   that is the difference between hunting and choosing.

   THE TICK IS NOT THE SELECTION. Opening a document and sending it on are two
   different questions, so they get two different controls on the same card:
   the card opens it, the checkbox includes it. One document is being read at a
   time; any number of them can be on their way to the chart.
   -------------------------------------------------------------------------- */

/** How many sheets of paper this document is, read off its own description. */
const docPageCount = (doc) => Number(/(\d+)\s*p\b/.exec(doc.meta ?? '')?.[1] ?? 1);

/**
 * "1p · 85 KB".
 *
 * Attachments carry their own line because it arrived with the message. A fax
 * page has only its text, so the size is derived from it — a real viewer would
 * read it off the file, and a made-up constant on every card would be a worse
 * lie than an honest estimate.
 */
function docMeta(doc) {
  if (doc.meta) return doc.meta;
  const kb = Math.max(12, Math.round((doc.text?.length ?? 0) / 12));
  return `1p · ${kb} KB`;
}

function pickNote(total) {
  return state.picked.size
    ? `${total} document${total === 1 ? '' : 's'} · ${state.picked.size} selected`
    : `${total} document${total === 1 ? '' : 's'}`;
}

function docStrip(docs, active) {
  return `<section class="ref__docs" data-testid="ref--docs">
    <p class="ref__docs-lead" id="pickNote">${esc(pickNote(docs.length))}</p>
    <div class="ref__docstrip">
      ${docs
        .map(
          (doc, index) => `<div class="ref__doccard${
            index === active ? ' ref__doccard--on' : ''
          }">
            <button type="button" class="ref__doccard-open" data-doc="${index}"
              data-testid="ref--doc-${index}">
              <span class="ref__doccard-thumb" aria-hidden="true">
                ${'<span></span>'.repeat(5)}
                <span class="ref__doccard-pages">${docPageCount(doc)}p</span>
              </span>
              <span class="ref__doccard-text">
                <strong>${esc(doc.title)}</strong>
                <span>${esc(docMeta(doc))}</span>
              </span>
            </button>
            <ui-checkbox class="ref__doccard-pick" data-pick="${index}" label-hidden
              ${state.picked.has(index) ? 'checked' : ''}
              data-testid="ref--pick-${index}">Include ${esc(doc.title)}</ui-checkbox>
          </div>`
        )
        .join('')}
    </div>
  </section>`;
}

/*
 * Ticking a card writes the note by hand rather than repainting the strip.
 * A repaint here would rebuild the checkbox that was just clicked and drop the
 * keyboard back to the body, which is exactly the fault the tab strips above
 * were fixed for.
 */
function wireDocStrip(root, total, open) {
  root.querySelectorAll('[data-doc]').forEach((card) =>
    card.addEventListener('click', () => open(Number(card.dataset.doc)))
  );

  root.querySelectorAll('[data-pick]').forEach((box) =>
    box.addEventListener('ui-change', (event) => {
      const index = Number(box.dataset.pick);
      if (event.detail.checked) state.picked.add(index);
      else state.picked.delete(index);
      const note = el('pickNote');
      if (note) note.textContent = pickNote(total);
    })
  );
}

/** What a download or a print is about to act on. */
function pickedPhrase(total) {
  return state.picked.size
    ? `${state.picked.size} of ${total} document${total === 1 ? '' : 's'}`
    : `all ${total} document${total === 1 ? '' : 's'}`;
}

/* --- Email ------------------------------------------------------------------- */

function paintEmail(referral) {
  const body = (referral.letter ?? [])
    .map((block) =>
      typeof block === 'string'
        ? `<p>${esc(block)}</p>`
        : `<ul>${block.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`
    )
    .join('');

  const attachments = referral.attachments ?? [];

  el('docBody').innerHTML = `
    <div class="ref__mail-bar">
      <span class="ref__mail-subject">${esc(referral.subject ?? 'Referral')}</span>
      <span class="ref__spacer"></span>
      <ui-button variant="outline" size="sm" icon="printer" id="mailPrint"
        data-testid="ref--mail-print">Print</ui-button>
      <ui-button variant="outline" size="sm" icon="upload" id="mailDownload"
        data-testid="ref--mail-download">Download</ui-button>
      <ui-button variant="outline" size="sm" icon="mail" id="mailForward"
        data-testid="ref--mail-forward">Forward</ui-button>
      <ui-button variant="outline" size="sm" icon-only icon="more-horizontal"
        label="More actions" id="mailMore" data-testid="ref--mail-more"></ui-button>
    </div>

    <article class="ref__letter" data-testid="ref--letter">${body}</article>

    ${attachments.length ? docStrip(attachments, -1) : ''}`;

  el('mailPrint').addEventListener('ui-click', () => window.print());
  el('mailDownload').addEventListener('ui-click', () =>
    notify(
      `Download started — the original message and ${pickedPhrase(attachments.length)}.`
    )
  );
  el('mailForward').addEventListener('ui-click', () => openCreate('out'));
  el('mailMore').addEventListener('ui-click', () => toggleAddon());

  // An attachment opens in the fax viewer: the same pages, the same tools, and
  // a way back to the message it came with.
  wireDocStrip(el('docBody'), attachments.length, (index) => {
    state.page = index;
    state.zoom = 1;
    state.rotation = 0;
    paintFax({ ...referral, pages: attachments }, () => {
      state.page = 0;
      paintEmail(referral);
    });
  });
}

/* --- Fax ---------------------------------------------------------------------
   THE PAGE IS THE SCREEN, THE TOOLS FLOAT OVER IT.

   The viewer used to spend a rail down one side on numbered thumbnails and a
   full-width bar across the bottom on eight buttons, and what was left in the
   middle was the fax. The tools have moved onto the stage itself — paging on
   the two edges, zoom in the corner, download and print in the header — so the
   document gets the room, and every control is beside the thing it acts on
   rather than filed in a bar somewhere below it.
   -------------------------------------------------------------------------- */

function paintFax(referral, onBack) {
  const pages = referral.pages ?? [];
  const index = Math.min(state.page, Math.max(0, pages.length - 1));
  const page = pages[index] ?? { title: '', text: '' };

  el('docBody').innerHTML = `
    <div class="ref__viewer">
      <div class="ref__viewer-head">
        ${
          onBack
            ? `<button type="button" class="ref__back-link" id="viewerBack"
                 data-testid="ref--viewer-back">
                 <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-left"></use></svg>
                 Back to message
               </button>`
            : ''
        }
        <span class="ref__viewer-count" data-testid="ref--page-count">
          Document ${Math.min(index + 1, pages.length)} of ${pages.length}
        </span>
        <span class="ref__viewer-title">${esc(page.title)}</span>
        <span class="ref__spacer"></span>
        <button type="button" class="ref__vtool" id="faxDownload"
          aria-label="Download" data-testid="ref--fax-download">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-download"></use></svg>
        </button>
        <button type="button" class="ref__vtool" id="faxPrint"
          aria-label="Print" data-testid="ref--fax-print">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-printer"></use></svg>
        </button>
      </div>

      <!-- The stage scrolls; the controls sit outside it so a zoomed page
           cannot carry them off the top of the pane. -->
      <div class="ref__viewer-stage">
        <div class="ref__stage" data-rot="${state.rotation}">
          <div class="ref__page" id="faxPage" data-testid="ref--page">
            <pre class="ref__page-text">${esc(page.text)}</pre>
          </div>
        </div>

        <button type="button" class="ref__pager ref__pager--prev" id="pagePrev"
          aria-label="Previous document" ${index === 0 ? 'disabled' : ''}
          data-testid="ref--page-prev">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-left"></use></svg>
        </button>
        <button type="button" class="ref__pager ref__pager--next" id="pageNext"
          aria-label="Next document" ${index >= pages.length - 1 ? 'disabled' : ''}
          data-testid="ref--page-next">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-right"></use></svg>
        </button>

        <div class="ref__zoom">
          <button type="button" class="ref__vtool" id="zoomOut"
            aria-label="Zoom out" data-testid="ref--zoom-out">
            <svg class="ui-icon" aria-hidden="true"><use href="#i-minus"></use></svg>
          </button>
          <span class="ref__vcount" data-testid="ref--zoom">${Math.round(state.zoom * 100)}%</span>
          <button type="button" class="ref__vtool" id="zoomIn"
            aria-label="Zoom in" data-testid="ref--zoom-in">
            <svg class="ui-icon" aria-hidden="true"><use href="#i-plus"></use></svg>
          </button>
          <span class="ref__vrule" aria-hidden="true"></span>
          <button type="button" class="ref__vtool" id="rotate"
            aria-label="Rotate 90 degrees" data-testid="ref--rotate">
            <svg class="ui-icon" aria-hidden="true"><use href="#i-rotate"></use></svg>
          </button>
        </div>
      </div>

      ${docStrip(pages, index)}
    </div>`;

  applyViewerGeometry();

  const repaint = () => paintFax(referral, onBack);

  wireDocStrip(el('docBody'), pages.length, (next) => {
    state.page = next;
    state.zoom = 1;
    state.rotation = 0;
    repaint();
  });

  el('viewerBack')?.addEventListener('click', onBack ?? (() => {}));

  el('pagePrev').addEventListener('click', () => {
    state.page = Math.max(0, index - 1);
    repaint();
  });
  el('pageNext').addEventListener('click', () => {
    state.page = Math.min(pages.length - 1, index + 1);
    repaint();
  });
  el('zoomIn').addEventListener('click', () => {
    state.zoom = Math.min(2, Math.round((state.zoom + 0.25) * 100) / 100);
    repaint();
  });
  el('zoomOut').addEventListener('click', () => {
    state.zoom = Math.max(0.5, Math.round((state.zoom - 0.25) * 100) / 100);
    repaint();
  });
  el('rotate').addEventListener('click', () => {
    state.rotation = (state.rotation + 90) % 360;
    repaint();
  });
  el('faxPrint').addEventListener('click', () => window.print());
  el('faxDownload').addEventListener('click', () =>
    notify(`Download started — ${pickedPhrase(pages.length)}, original quality.`)
  );
}

/** Zoom and rotation as custom properties on a generated sheet. */
function applyViewerGeometry() {
  writeGeometry([
    `.ref__page { --ref-zoom: ${state.zoom}; --ref-rot: ${state.rotation}deg; }`,
  ]);
}

/* ===================== Right panel: outgoing context ===================== */

/**
 * Where the release of information has got to.
 *
 * Expired is a state the stepper has to be able to show, not a step it passes
 * through, so the last node is only ever reached by failing.
 */
function roiIndex(roi) {
  if (roi === 'signed') return 1;
  if (roi === 'expired') return 2;
  if (roi === 'pending') return 0;
  return -1;
}

function paintInfo(referral) {
  const roi = referral.roi ?? 'none';
  const step = roiIndex(roi);
  const blocked = roi !== 'signed';

  el('infoPane').innerHTML = `
    ${
      blocked
        ? `<section class="ref__card-panel ref__card-panel--roi" data-testid="ref--roi">
             <h3>Release of Information (ROI) required</h3>
             <p>
               ${DIRECTION_LABEL.out} transmission is blocked until the patient signs the ROI
               consent. The system sends the consent to the patient's portal inbox.
               Transmission unlocks automatically on signing.
             </p>
             <ol class="ref__roi-steps">
               ${ROI_STEPS.map(
                 (label, index) => `<li class="ref__roi-step${
                   index === step ? ' ref__roi-step--on' : ''
                 }${index < step && roi !== 'expired' ? ' ref__roi-step--done' : ''}${
                   label === 'Expired' && roi === 'expired' ? ' ref__roi-step--bad' : ''
                 }">${esc(label)}</li>`
               ).join('')}
             </ol>
             <ui-button variant="outline" size="sm" id="roiSend"
               data-testid="ref--roi-send">
               ${roi === 'expired' ? 'Resend ROI to patient' : 'Send ROI to patient'}
             </ui-button>
           </section>`
        : `<section class="ref__card-panel ref__card-panel--ok" data-testid="ref--roi">
             <h3>Release of Information signed</h3>
             <p>Signed by the patient. Transmission is unlocked.</p>
           </section>`
    }

    <section class="ref__card-panel">
      <h3>
        <svg class="ui-icon" aria-hidden="true"><use href="#i-user-check"></use></svg>
        Referred to
      </h3>
      <div class="ref__to">
        <div>
          <strong>${esc(referral.referredTo.provider)}</strong>
          <span>${esc(referral.referredTo.facility)}</span>
          <a class="ref__link" href="#">${esc(referral.referredTo.specialty)}</a>
        </div>
        <dl class="ref__to-contact">
          <div><dt>Phone</dt><dd>${esc(referral.referredTo.phone)}</dd></div>
          <div><dt>Fax</dt><dd>${esc(referral.referredTo.fax)}</dd></div>
        </dl>
      </div>
    </section>

    <section class="ref__card-panel">
      <h3>
        <svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>
        Patient details
      </h3>
      <dl class="ref__facts">
        <div><dt>Name</dt><dd>${esc(referral.patient.name)}</dd></div>
        <div><dt>MRN</dt><dd>${esc(referral.patient.mrn)}</dd></div>
        <div><dt>DOB</dt><dd>${esc(referral.patient.dob)}</dd></div>
        <div><dt>Phone</dt><dd>${esc(referral.patient.phone)}</dd></div>
      </dl>
      <a class="ref__link ref__link--action" href="patient-directory.html"
        data-testid="ref--open-chart">
        Go to patient chart
        <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-right"></use></svg>
      </a>
    </section>

    <section class="ref__card-panel">
      <h3>
        <svg class="ui-icon" aria-hidden="true"><use href="#i-layers"></use></svg>
        Referral details
      </h3>
      <dl class="ref__facts">
        <div><dt>Referred by</dt><dd>${esc(referral.referringProvider)}</dd></div>
        <div><dt>Reason</dt><dd>${esc(referral.reason)}</dd></div>
        <div><dt>Source</dt><dd>${esc(referral.source)}</dd></div>
        <div><dt>Diagnosis</dt><dd>${esc(referral.diagnosis ?? '—')}</dd></div>
        <div><dt>Status</dt><dd>${esc(referral.status)}</dd></div>
        <div><dt>Created</dt><dd>${esc(longWhen(referral.createdAt))}</dd></div>
        ${referral.notes ? `<div><dt>Notes</dt><dd>${esc(referral.notes)}</dd></div>` : ''}
      </dl>
    </section>

    <div class="ref__send">
      <ui-button variant="primary" id="sendReferral" ${blocked ? 'disabled' : ''}
        data-testid="ref--send">
        ${referral.status === 'Sent' || referral.status === 'Delivered' || referral.status === 'Viewed'
          ? 'Resend referral'
          : 'Send referral'}
      </ui-button>
      ${
        blocked
          ? '<span class="ref__send-hint">Blocked until the ROI is signed.</span>'
          : ''
      }
    </div>`;

  el('roiSend')?.addEventListener('ui-click', () => {
    referral.roi = 'pending';
    referral.status = 'Pending ROI';
    paintQueue();
    paintInfo(referral);
    notify(`ROI consent sent to ${referral.patient.name}'s portal inbox.`);
  });

  el('sendReferral').addEventListener('ui-click', () => {
    referral.status = 'Sent';
    referral.sentAt = `${TODAY}T12:00`;
    paintQueue();
    paintMain();
    notify(`Referral sent to ${referral.referredTo.facility}.`);
  });
}

/* ===================== Add-on menu ===================== */

function paintAddonMenu() {
  const scope = state.direction;
  const actions = ADDON_ACTIONS.filter((a) => a.scope === 'both' || a.scope === scope);

  el('addonMenu').innerHTML = actions
    .map(
      (action) => `<button type="button" role="menuitem" class="ref__addon-item${
        action.destructive ? ' ref__addon-item--bad' : ''
      }" data-action="${action.id}" data-testid="ref--action-${action.id}">
        ${esc(action.label)}
      </button>`
    )
    .join('');

  el('addonMenu').querySelectorAll('[data-action]').forEach((item) =>
    item.addEventListener('click', () => {
      toggleAddon(false);
      runAction(item.dataset.action);
    })
  );
}

function toggleAddon(open) {
  const menu = el('addonMenu');
  const next = open ?? menu.hidden;
  menu.hidden = !next;
  /* Both halves of the split button carry the state: a caret that never
     changes while the menu under it opens and shuts is the half that looks
     broken. */
  el('addonBtn').setAttribute('aria-expanded', String(next));
  el('addonCaret').setAttribute('aria-expanded', String(next));
}

function runAction(id) {
  const referral = selected();
  if (!referral) return;

  if (id === 'process') return openProcess(referral);
  if (id === 'reject') return openReject(referral);
  if (id === 'forward') return openCreate('out');
  if (id === 'print') return window.print();
  if (id === 'download') return notify('Download started — the original document.');
}

/* ===================== Reject ===================== */

function openReject(referral) {
  options('rReason', REJECTION_REASONS);
  setValue(el('rNote'), '');
  el('rejectModal').open(el('addonBtn'));

  const confirm = el('rConfirm');
  const fresh = confirm.cloneNode(true);
  confirm.replaceWith(fresh);
  fresh.addEventListener('ui-click', () => {
    const reason = el('rReason').value;
    if (!reason) {
      el('rReason').setAttribute('error', 'Choose a reason');
      return;
    }
    referral.status = 'Rejected';
    referral.rejection = `${reason}${el('rNote').value ? ` — ${el('rNote').value}` : ''}`;
    el('rejectModal').close();
    paintQueue();
    paintMain();
    notify(`Referral rejected — ${reason}. The sender has been notified.`, 'warning');
  });
}

/* ===================== Create referral (drawer) ===================== */

function openCreate(direction = state.direction) {
  state.createChannel = 'fax';
  state.createRecipient = 'directory';
  state.attachments = [];
  state.createDirection = direction;

  el('createModal').setAttribute('heading', `Create ${directionLabel(direction)}`);
  el('cChannel').value = 'Fax';
  paintCreateBody();
  el('createModal').open(el('createBtn'));
}

function paintCreateBody() {
  const direction = state.createDirection ?? state.direction;
  el('createBody').innerHTML =
    direction === 'in'
      ? state.createChannel === 'fax'
        ? createInFax()
        : createInEmail()
      : state.createChannel === 'fax'
        ? createOutFax()
        : createOutEmail();

  wireCreateBody(direction);
}

const section = (title, body) => `
  <section class="ref__section">
    <h3 class="ref__section-title">${esc(title)}</h3>
    <div class="ref__section-body">${body}</div>
  </section>`;

/* The "Add attachments" label used to be written out beside every call to
   this, as a bare sibling of the drop zone. It sat the same distance from the
   zone as the zone sat from the field above, so it read as a heading for the
   rest of the section rather than as the label of the thing directly under
   it. It belongs to the block, so it now comes with it — bound at the same
   4px a field label binds to its control, and written once instead of four
   times. */
const attachBlock = () => `
  <div class="ref__field">
    <span class="ref__label">Add attachments</span>
    <div class="ref__upload" id="uploadZone" data-testid="ref--upload">
      <svg class="ui-icon" aria-hidden="true"><use href="#i-upload"></use></svg>
      <span class="ref__upload-text">
        <strong>Drag files here, or click to upload</strong>
        <span>PDF, TIFF, PNG or JPG — up to 20 MB each</span>
      </span>
    </div>
    <div class="ref__files" id="uploadList"></div>
  </div>`;

function createInFax() {
  return `
    ${section(
      'Referral information',
      `<div class="ref__grid">
        <ui-input id="nFirst" label="First name" placeholder="Enter first name"
          data-testid="ref--n-first"></ui-input>
        <ui-input id="nLast" label="Last name" placeholder="Enter last name"
          data-testid="ref--n-last"></ui-input>
        <ui-input id="nDob" type="date" label="Date of birth"
          data-testid="ref--n-dob"></ui-input>
        <ui-input id="nPhone" label="Phone" placeholder="(000) 000-0000"
          data-testid="ref--n-phone"></ui-input>
        <ui-select id="nProvider" label="Referring provider"
          placeholder="Select provider" data-testid="ref--n-provider"></ui-select>
        <ui-input id="nFacility" label="Facility name" placeholder="Enter facility name"
          hint="Suggestions appear as you type" data-testid="ref--n-facility"></ui-input>
        <ui-select id="nTo" label="Referred to" placeholder="Select referred to"
          data-testid="ref--n-to"></ui-select>
        <ui-select id="nSource" label="Referral source" placeholder="Select referral source"
          data-testid="ref--n-source"></ui-select>
      </div>
      <datalist id="facilityList"></datalist>`
    )}

    ${section(
      'Clinical details',
      `<ui-input id="nReason" label="Referral reason" placeholder="Brief reason for referral…"
        data-testid="ref--n-reason"></ui-input>
      <ui-textarea id="nNote" label="Referral note" rows="3"
        placeholder="Additional clinical notes, history, or context…"
        data-testid="ref--n-note"></ui-textarea>
      <ui-select id="nDx" label="Diagnosis code"
        placeholder="Search ICD-10 code or description…" data-testid="ref--n-dx"></ui-select>
      ${attachBlock()}`
    )}`;
}

function createInEmail() {
  return `
    ${section(
      'Message',
      `<ui-select id="nPatient" label="Patient name"
        placeholder="Search and select patient" data-testid="ref--n-patient"></ui-select>
      <ui-input id="nFrom" label="From" placeholder="Enter sender's address"
        data-testid="ref--n-from"></ui-input>
      <ui-input id="nToEmail" label="To" placeholder="Enter recipient's address"
        data-testid="ref--n-to-email"></ui-input>
      <ui-input id="nCc" label="Cc" placeholder="Enter recipient's address"
        data-testid="ref--n-cc"></ui-input>
      <ui-input id="nSubject" label="Subject" placeholder="Enter subject"
        data-testid="ref--n-subject"></ui-input>
      <ui-textarea id="nContent" label="Content" rows="6"
        placeholder="Add referral note information" data-testid="ref--n-content"></ui-textarea>
      ${attachBlock()}`
    )}`;
}

function createOutFax() {
  return `
    ${section(
      'Referral information',
      `<ui-select id="nPatient" label="Patient"
        placeholder="Search and select patient" data-testid="ref--n-patient"></ui-select>

      <div class="ref__recipient">
        <ui-radio-group inline id="nRecipientMode" label="Recipient" label-hidden
          options="Contact directory,Manual entry" value="Contact directory"
          data-testid="ref--n-recipient-mode"></ui-radio-group>

        <div id="recipientDirectory">
          <ui-select id="nRecipient" label="Select recipient"
            placeholder="Search &amp; select" data-testid="ref--n-recipient"></ui-select>
        </div>

        <div class="ref__grid" id="recipientManual" hidden>
          <ui-input id="nRecipientName" label="Referred to" placeholder="Enter name"
            data-testid="ref--n-recipient-name"></ui-input>
          <ui-input id="nRecipientFax" label="Fax number" placeholder="(000) 000-0000"
            data-testid="ref--n-recipient-fax"></ui-input>
        </div>
      </div>

      <div class="ref__grid">
        <ui-select id="nProvider" label="Referred by" placeholder="Provider name"
          data-testid="ref--n-provider"></ui-select>
        <ui-select id="nSource" label="Referral source" placeholder="Select referral source"
          data-testid="ref--n-source"></ui-select>
      </div>`
    )}

    ${section(
      'Clinical details',
      `<ui-input id="nReason" label="Referral reason" placeholder="Brief reason for referral…"
        data-testid="ref--n-reason"></ui-input>
      <ui-textarea id="nNote" label="Referral note" rows="3"
        placeholder="Additional clinical notes, history, or context…"
        data-testid="ref--n-note"></ui-textarea>
      <ui-select id="nDx" label="Diagnosis code"
        placeholder="Search ICD-10 code or description…" data-testid="ref--n-dx"></ui-select>
      ${attachBlock()}`
    )}`;
}

function createOutEmail() {
  return `
    ${section(
      'Message',
      `<ui-select id="nPatient" label="Patient"
        placeholder="Search and select patient" data-testid="ref--n-patient"></ui-select>
      <ui-input id="nToEmail" label="Recipient email" placeholder="Enter recipient's address"
        data-testid="ref--n-to-email"></ui-input>
      <ui-input id="nCc" label="Cc" placeholder="Enter recipient's address"
        data-testid="ref--n-cc"></ui-input>
      <ui-input id="nSubject" label="Subject" placeholder="Enter subject"
        data-testid="ref--n-subject"></ui-input>
      <ui-textarea id="nContent" label="Referral letter" rows="6"
        placeholder="Write the referral letter…" data-testid="ref--n-content"></ui-textarea>
      ${attachBlock()}`
    )}`;
}

function wireCreateBody(direction) {
  const patients = DIRECTORY.filter((p) => p.active).map(
    (p) => `${p.name} · MRN ${p.mrn}`
  );

  if (el('nPatient')) options('nPatient', patients);
  if (el('nProvider')) {
    options('nProvider', direction === 'in' ? REFERRING_PROVIDERS : REFERRING_PROVIDERS);
  }
  if (el('nTo')) options('nTo', REFERRED_TO);
  if (el('nSource')) options('nSource', REFERRAL_SOURCES);
  if (el('nDx')) {
    el('nDx').optionList = ICD10.map((c) => ({
      value: c.code,
      label: `${c.code} — ${c.text}`,
    }));
  }
  if (el('nRecipient')) {
    el('nRecipient').optionList = CONTACT_DIRECTORY.map((c) => ({
      value: c.id,
      label: `${c.provider} · ${c.facility} · ${c.specialty}`,
    }));
  }

  // Facility suggestions, offered rather than enforced — a referral can come
  // from a practice the directory has never seen.
  const facility = el('nFacility');
  if (facility) {
    const list = el('facilityList');
    list.innerHTML = FACILITY_SUGGESTIONS.map((f) => `<option value="${esc(f)}"></option>`).join('');
    facility.querySelector('input')?.setAttribute('list', 'facilityList');
  }

  el('nRecipientMode')?.addEventListener('ui-change', (event) => {
    state.createRecipient = event.detail.value === 'Manual entry' ? 'manual' : 'directory';
    el('recipientDirectory').hidden = state.createRecipient === 'manual';
    el('recipientManual').hidden = state.createRecipient !== 'manual';
  });

  wireUpload();
}

/* --- Attachments -------------------------------------------------------------- */

/**
 * Upload, with progress.
 *
 * The prototype has no server, so progress is simulated — but it is simulated
 * rather than skipped because a file that appears instantly teaches the desk
 * that uploads are instant, and then a real slow one reads as broken.
 */
function wireUpload() {
  const zone = el('uploadZone');
  if (!zone) return;

  const add = (name, size) => {
    const file = { id: `f${nextId++}`, name, size, progress: 0 };
    state.attachments.push(file);
    paintFiles();

    const tick = window.setInterval(() => {
      file.progress = Math.min(100, file.progress + 20);
      paintFiles();
      if (file.progress >= 100) window.clearInterval(tick);
    }, 180);
  };

  zone.addEventListener('click', () =>
    add(`Referral page ${state.attachments.length + 1}.pdf`, '84 KB')
  );

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('ref__upload--over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('ref__upload--over'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('ref__upload--over');
    [...(event.dataTransfer?.files ?? [])].forEach((file) =>
      add(file.name, `${Math.round(file.size / 1024)} KB`)
    );
    if (!event.dataTransfer?.files.length) add('Dropped document.pdf', '84 KB');
  });
}

function paintFiles() {
  const host = el('uploadList');
  if (!host) return;

  host.innerHTML = state.attachments
    .map(
      (file) => `<div class="ref__file" data-testid="ref--file-${file.id}">
        <svg class="ui-icon" aria-hidden="true"><use href="#i-document"></use></svg>
        <div class="ref__file-body">
          <strong>${esc(file.name)}</strong>
          <span>${esc(file.size)}${file.progress < 100 ? ` · ${file.progress}%` : ''}</span>
          ${
            file.progress < 100
              ? `<ui-progress-bar value="${file.progress}" size="sm"
                   aria-label="Uploading ${esc(file.name)}"></ui-progress-bar>`
              : ''
          }
        </div>
        ${
          file.progress >= 100
            ? `<button type="button" class="ref__file-act" data-preview="${file.id}"
                 aria-label="Preview ${esc(file.name)}">
                 <svg class="ui-icon" aria-hidden="true"><use href="#i-grid"></use></svg>
               </button>`
            : ''
        }
        <button type="button" class="ref__file-act" data-remove="${file.id}"
          aria-label="Remove ${esc(file.name)}">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg>
        </button>
      </div>`
    )
    .join('');

  /* Only the viewer geometry goes through the generated sheet now. The upload
     bars used to be here too — one rule per file, keyed on the percentage —
     because a hand-drawn track needs its width from somewhere and an inline
     style was ruled out. <ui-progress-bar> owns its own fill, so the rules and
     the reason for them are both gone. */
  writeGeometry([`.ref__page { --ref-zoom: ${state.zoom}; --ref-rot: ${state.rotation}deg; }`]);

  host.querySelectorAll('[data-remove]').forEach((button) =>
    button.addEventListener('click', () => {
      state.attachments = state.attachments.filter((f) => f.id !== button.dataset.remove);
      paintFiles();
    })
  );
  host.querySelectorAll('[data-preview]').forEach((button) =>
    button.addEventListener('click', () =>
      notify('Preview opens the page in the viewer once the file has been stored.', 'info')
    )
  );
}

/* ===================== Process document ===================== */

/**
 * The processing screen.
 *
 * One patient, one form. The screen used to stack an accordion per person the
 * fax described, on the grounds that a referral occasionally carries two — but
 * the collapsed second panel bought a row of chrome above every single-patient
 * fax, which is nearly all of them, and buried the one form that mattered
 * inside a control the clerk had to open before they could read anything.
 */
function openProcess(referral) {
  const [first] = OCR_EXTRACTS[referral.id]?.patients ?? [];
  state.processing = {
    referral,
    patient: { ...(first ?? { key: 'p1', label: 'Patient 1', match: 'none' }), done: false },
    page: 0,
  };

  el('processView').hidden = false;
  el('processName').textContent = `Process referral — ${referral.patient.name}`;

  // Run the OCR pass, visibly. It is the reason the form is already filled in
  // when it appears, and hiding it would make the extraction look like magic
  // nobody should check.
  el('ocrBanner').hidden = false;
  el('processBody').innerHTML = '';
  referral.status = 'OCR Processing';
  paintQueue();

  const steps = [
    'Extracting demographics, insurance and diagnosis codes.',
    'Matching against the patient directory.',
    'Classifying the attached documents.',
  ];
  let index = 0;
  const tick = window.setInterval(() => {
    index += 1;
    if (index < steps.length) {
      el('ocrStep').textContent = steps[index];
      return;
    }
    window.clearInterval(tick);
    el('ocrBanner').hidden = true;
    referral.status = 'Needs Review';
    paintQueue();
    paintProcess();
  }, 700);
}

function closeProcess() {
  el('processView').hidden = true;
  state.processing = null;
  paintMain();
}

/** A field the OCR was unsure about is worth a second look, and says so. */
function extractedField(id, label, field, type = 'text') {
  const low = field && field.confidence < 0.75;
  return `<div class="ref__field${low ? ' ref__field--low' : ''}">
    <ui-input id="${id}" type="${type}" label="${esc(label)}"
      data-testid="ref--x-${id}"></ui-input>
    ${
      low
        ? `<span class="ref__confidence">Low confidence — ${Math.round(
            field.confidence * 100
          )}%</span>`
        : ''
    }
  </div>`;
}

/**
 * Date of birth, with the age it implies sitting next to it.
 *
 * The age is not an editable field — it is read back out of the date, so there
 * is nothing to key in and nothing to keep in step. It exists because the
 * referral letter states an age in prose and the fax states a date, and the
 * clerk is the only thing reconciling the two.
 */
function dobField(field) {
  return `<div class="ref__dob">
    ${extractedField('xDob', 'Date of birth *', field, 'date')}
    <span class="ref__age" id="xAge" data-testid="ref--x-age">—</span>
  </div>`;
}

/** Whole years between a date of birth and today, or null if unreadable. */
function ageFrom(value) {
  const born = new Date(value);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

function paintProcess() {
  const { referral, patient } = state.processing;
  const extract = OCR_EXTRACTS[referral.id]?.fields ?? {};
  const pages = referral.pages ?? referral.attachments ?? [];
  const page = pages[state.processing.page] ?? { title: '', text: '' };

  /* How the fax matched the directory decides which fork Continue takes, so it
     is stated on the header line rather than left for the modal to reveal. */
  el('processMatch').innerHTML =
    patient.match === 'exact'
      ? '<ui-badge status="info" size="sm">Directory match</ui-badge>'
      : '<ui-badge status="warning" size="sm">No match</ui-badge>';

  el('processBody').innerHTML = `<div class="ref__pat-body"
        data-testid="ref--pat-${patient.key}">
                 <form class="ref__pat-form">
                   <div class="ref__pat-fields">
                   <section class="ref__section">
                     <h4 class="ref__section-title">Basic Details</h4>
                     <div class="ref__section-body">
                       <div class="ref__group">
                         <h5 class="ref__group-title">Identity</h5>
                         <div class="ref__grid ref__grid--3">
                           ${extractedField('xMrn', 'MRN', extract.mrn)}
                           ${extractedField('xPrefix', 'Prefix', null)}
                           ${extractedField('xFirst', 'First name *', extract.firstName)}
                           ${extractedField('xLast', 'Last name *', extract.lastName)}
                           ${extractedField('xMiddle', 'Middle name', extract.middleName)}
                           ${extractedField('xPreferred', 'Preferred name', null)}
                         </div>
                       </div>

                       <div class="ref__group">
                         <h5 class="ref__group-title">Demographics</h5>
                         <div class="ref__grid ref__grid--3">
                           ${dobField(extract.dob)}
                           ${extractedField('xGender', 'Sex at birth *', extract.gender)}
                         </div>
                       </div>

                       <div class="ref__group">
                         <h5 class="ref__group-title">Contact</h5>
                         <div class="ref__grid ref__grid--3">
                           ${extractedField('xPhone', 'Mobile number', extract.phone)}
                           ${extractedField('xEmail', 'Email', extract.email)}
                         </div>
                       </div>

                       <div class="ref__group">
                         <h5 class="ref__group-title">Address</h5>
                         <div class="ref__grid ref__grid--3">
                           ${extractedField('xAddress1', 'Address line 1', extract.address1)}
                           ${extractedField('xAddress2', 'Address line 2', null)}
                         </div>
                         <div class="ref__grid ref__grid--4">
                           ${extractedField('xCountry', 'Country', null)}
                           ${extractedField('xState', 'State', extract.state)}
                           ${extractedField('xCity', 'City', extract.city)}
                           ${extractedField('xZip', 'Zip code', extract.zip)}
                         </div>
                       </div>
                     </div>
                   </section>

                   <section class="ref__section">
                     <h4 class="ref__section-title">Medical Details</h4>
                     <div class="ref__section-body">
                       <div class="ref__group">
                         <h5 class="ref__group-title">Referral</h5>
                         ${extractedField('xReason', 'Reason for referral', extract.reason)}
                         ${extractedField('xDx', 'Diagnosis codes', extract.diagnosis)}
                       </div>

                       <div class="ref__group">
                         <h5 class="ref__group-title">Coverage</h5>
                         <div class="ref__grid">
                           ${extractedField('xInsurer', 'Insurance carrier', extract.insurer)}
                           ${extractedField('xMember', 'Member ID', extract.memberId)}
                         </div>
                       </div>
                     </div>
                   </section>
                   </div>

                   <div class="ref__pat-foot">
                     <ui-button variant="tertiary" id="patCancel"
                       data-testid="ref--pat-cancel">Cancel</ui-button>
                     <ui-button variant="primary" id="patContinue"
                       data-testid="ref--pat-continue">Continue</ui-button>
                   </div>
                 </form>

                 <div class="ref__pat-doc">
                   <div class="ref__pat-doc-bar">
                     <button type="button" class="ref__vtool" id="docPrev"
                       aria-label="Previous document">
                       <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-left"></use></svg>
                     </button>
                     <span class="ref__vcount">Document ${state.processing.page + 1} of ${
                       pages.length
                     }</span>
                     <button type="button" class="ref__vtool" id="docNext"
                       aria-label="Next document">
                       <svg class="ui-icon" aria-hidden="true"><use href="#i-caret-right"></use></svg>
                     </button>
                     <span class="ref__spacer"></span>
                     <span class="ref__vcount">${esc(page.title)}</span>
                   </div>
                   <pre class="ref__pat-doc-text">${esc(page.text)}</pre>
                 </div>
      </div>`;

  /* Fill the extracted values in. */
  const fill = (id, value) => setValue(el(id), value);
  fill('xMrn', extract.mrn?.value);
  fill('xFirst', extract.firstName?.value);
  fill('xLast', extract.lastName?.value);
  fill('xMiddle', extract.middleName?.value);
  fill('xPreferred', extract.firstName?.value);
  fill('xDob', extract.dob?.value);
  fill('xGender', extract.gender?.value);
  fill('xZip', extract.zip?.value);
  fill('xAddress1', extract.address1?.value);
  fill('xCity', extract.city?.value);
  fill('xState', extract.state?.value);
  fill('xPhone', extract.phone?.value);
  fill('xEmail', extract.email?.value);
  fill('xReason', extract.reason?.value);
  fill('xInsurer', extract.insurer?.value);
  fill('xMember', extract.memberId?.value);
  fill('xDx', extract.diagnosis?.value);

  const paintAge = () => {
    const years = ageFrom(el('xDob')?.querySelector('input')?.value ?? '');
    const chip = el('xAge');
    if (chip) chip.textContent = years === null ? '—' : `${years} yr`;
  };
  paintAge();
  el('xDob')?.addEventListener('ui-change', paintAge);

  el('docPrev')?.addEventListener('click', () => {
    state.processing.page = Math.max(0, state.processing.page - 1);
    paintProcess();
  });
  el('docNext')?.addEventListener('click', () => {
    state.processing.page = Math.min(pages.length - 1, state.processing.page + 1);
    paintProcess();
  });

  el('patCancel')?.addEventListener('ui-click', closeProcess);
  el('patContinue')?.addEventListener('ui-click', () => continuePatient(patient));
}

/**
 * Continue from the extracted form.
 *
 * The fork is the whole point of the step: a patient the directory already
 * knows must not be duplicated, and one it does not must not be silently
 * invented. So the answer is asked either way, and neither path is the
 * default.
 */
function continuePatient(patient) {
  if (patient.match === 'exact') return openMatch(patient);
  return openNewPatient(patient);
}

function openMatch(patient) {
  const first = el('xFirst').value;
  const last = el('xLast').value;
  const dob = el('xDob').value;

  const candidates = DIRECTORY.filter(
    (p) => p.name.toLowerCase().includes(last.toLowerCase()) && last
  ).slice(0, 3);

  el('matchLede').textContent =
    candidates.length === 1
      ? `One record in the directory looks like ${first} ${last}. Use it, or create a new profile.`
      : `${candidates.length} records in the directory look like ${first} ${last}. Choose the right one, or create a new profile.`;

  el('matchList').innerHTML = candidates
    .map(
      (p, index) => `<label class="ref__match-row">
        <input type="radio" name="matchPick" value="${esc(p.mrn)}"
          ${index === 0 ? 'checked' : ''} data-testid="ref--match-${p.mrn}" />
        <span>
          <strong>${esc(p.name)}</strong>
          <span>MRN ${esc(p.mrn)} · DOB ${esc(p.dob)} · ${esc(p.phone)}</span>
        </span>
        <ui-badge status="${p.dob === dob ? 'success' : 'warning'}" size="sm">
          ${p.dob === dob ? 'DOB matches' : 'DOB differs'}
        </ui-badge>
      </label>`
    )
    .join('');

  el('matchModal').open(el('patContinue'));

  const use = el('matchUse');
  const freshUse = use.cloneNode(true);
  use.replaceWith(freshUse);
  freshUse.addEventListener('ui-click', () => {
    const mrn = el('matchList').querySelector('input:checked')?.value ?? '';
    el('matchModal').close();
    setValue(el('xMrn'), mrn);
    openClassify(patient, `Merged into MRN ${mrn}.`);
  });

  const makeNew = el('matchNew');
  const freshNew = makeNew.cloneNode(true);
  makeNew.replaceWith(freshNew);
  freshNew.addEventListener('ui-click', () => {
    el('matchModal').close();
    openNewPatient(patient);
  });
}

function openNewPatient(patient) {
  const name = `${el('xFirst').value} ${el('xLast').value}`.trim();
  const dob = el('xDob').value;
  const phone = el('xPhone').value;

  el('newPatientFacts').innerHTML = `
    <div><dt>Patient name</dt><dd>${esc(name || '—')}</dd></div>
    <div><dt>DOB</dt><dd>${esc(dob || '—')}</dd></div>
    <div><dt>Phone</dt><dd>${esc(phone || '—')}</dd></div>`;

  el('newPatientModal').open(el('patContinue'));

  const go = el('newPatContinue');
  const fresh = go.cloneNode(true);
  go.replaceWith(fresh);
  fresh.addEventListener('ui-click', () => {
    el('newPatientModal').close();
    openClassify(patient, `New profile created for ${name}.`);
  });
}

function openClassify(patient, lede) {
  state.classifyFor = patient.key;
  state.classifyLede = lede;
  const detected = new Set(OCR_EXTRACTS[state.processing.referral.id]?.documents ?? []);
  state.classify = new Set(detected);

  el('classifyList').innerHTML = DOCUMENT_TYPES.map(
    (type) => `<label class="ref__classify-row">
      <input type="checkbox" value="${type.id}" ${detected.has(type.id) ? 'checked' : ''}
        data-testid="ref--doctype-${type.id}" />
      <span>${esc(type.label)}</span>
      ${detected.has(type.id) ? '<ui-badge status="info" size="sm">Detected</ui-badge>' : ''}
    </label>`
  ).join('');

  el('classifyList').querySelectorAll('input').forEach((box) =>
    box.addEventListener('change', () => {
      if (box.checked) state.classify.add(box.value);
      else state.classify.delete(box.value);
    })
  );

  el('classifyModal').open();

  const add = el('classifyAdd');
  const fresh = add.cloneNode(true);
  add.replaceWith(fresh);
  fresh.addEventListener('ui-click', () => {
    if (!state.classify.size) {
      notify('Choose at least one document type before filing to the chart.', 'warning');
      return;
    }
    el('classifyModal').close();
    finishPatient(patient, lede);
  });
}

function finishPatient(patient, lede) {
  patient.done = true;
  const types = [...state.classify]
    .map((id) => DOCUMENT_TYPES.find((t) => t.id === id)?.label)
    .join(', ');

  notify(`${lede} ${state.classify.size} document type${
    state.classify.size === 1 ? '' : 's'
  } filed to the chart — ${types}.`);

  state.processing.referral.status = 'Processed';
  paintQueue();
  closeProcess();
}

/* ===================== Notices ===================== */

/* notify() now lives in js/lib/toast.js — see the import above. */

/* ===================== Wiring ===================== */

function paintAll() {
  paintDirTabs();
  paintChanTabs();
  paintChips();
  paintQueue();
  paintMain();
}

customElements.whenDefined('ui-select').then(() => {
  const refFilter = el('refFilter');
  refFilter.setGroupOptions('status', [...new Set([...STATUS_IN, ...STATUS_OUT, 'Not Sent'])]);
  refFilter.setGroupOptions('priority', PRIORITIES);
  refFilter.setGroupOptions('source', REFERRAL_SOURCES);

  paintAll();

  /* --- The two tab strips ---
     Changing direction resets the channel: Email is a channel of the queue you
     just left, and carrying the choice over lands you on a tab that was chosen
     for a different queue.

     EITHER STRIP EMPTIES THE READING PANE. A tab change is a change of queue,
     and a referral read out of one queue while the list beside it shows another
     is the screen saying two different things about where you are — with the
     record on the right, the loud half, the wrong one. Both strips therefore
     drop the selection for the queue you are entering rather than restoring
     whatever was last open in it; the reading pane waits to be asked, and what
     you were reading is one row away in the queue that owns it. */
  el('dirTabs').addEventListener('ui-change', (event) => {
    state.direction = event.detail.value;
    state.channel = 'fax';
    state.selected[state.direction] = '';
    paintAll();
  });

  el('chanTabs').addEventListener('ui-change', (event) => {
    state.channel = event.detail.value;
    state.selected[state.direction] = '';
    paintQueue();
    paintMain();
    paintChanTabs();
  });

  /* --- Search and filters --- */
  el('qSearch').addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    paintQueue();
  });

  el('refFilter').addEventListener('ui-filter-change', (event) => {
    const values = event.detail.values;
    state.filters = {
      status: values.status,
      priority: values.priority,
      source: values.source,
      stat: values.flags.includes('STAT'),
      unread: values.flags.includes('Unread'),
    };
    paintChips();
    paintQueue();
  });

  /* --- Add-on menu --- */
  el('addonBtn').addEventListener('ui-click', () => toggleAddon());
  el('addonCaret').addEventListener('click', () => toggleAddon());
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.ref__addon')) toggleAddon(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') toggleAddon(false);
  });

  /* --- Create drawer --- */
  el('createBtn').addEventListener('ui-click', () => openCreate());
  el('cChannel').addEventListener('ui-change', (event) => {
    state.createChannel = event.detail.value.toLowerCase();
    paintCreateBody();
  });
  el('cCancel').addEventListener('ui-click', () => el('createModal').close());
  el('cSave').addEventListener('ui-click', saveCreated);

  /* --- Process --- */
  el('processBack').addEventListener('click', closeProcess);
});

/**
 * File the new referral.
 *
 * It lands in the queue it was created from and is selected immediately, so
 * the desk sees the thing it just made rather than having to find it.
 */
function saveCreated() {
  const direction = state.createDirection ?? state.direction;
  const channel = state.createChannel;
  // A referral created here is never STAT: urgency is set by whoever triages
  // it against the clinical picture, not by the person keying it in.
  const stat = false;

  const name =
    el('nPatient')?.value?.split(' · ')[0] ||
    `${el('nFirst')?.value ?? ''} ${el('nLast')?.value ?? ''}`.trim();

  if (!name) {
    const target = el('nPatient') ?? el('nFirst');
    target?.setAttribute('error', 'A patient is required');
    return;
  }

  const contact = CONTACT_DIRECTORY.find((c) => c.id === el('nRecipient')?.value);
  const referral = {
    id: `r${nextId++}`,
    channel,
    unread: false,
    stat,
    priority: '',
    status: direction === 'in' ? 'Received' : 'Draft',
    receivedAt: `${TODAY}T12:00`,
    createdAt: `${TODAY}T12:00`,
    summary: el('nReason')?.value || el('nSubject')?.value || 'New referral',
    reason: el('nReason')?.value ?? '',
    source: el('nSource')?.value ?? '',
    referredTo:
      direction === 'in'
        ? el('nTo')?.value || 'Intake team — unassigned'
        : {
            provider: contact?.provider ?? el('nRecipientName')?.value ?? 'Manual recipient',
            facility: contact?.facility ?? '—',
            specialty: contact?.specialty ?? '—',
            phone: contact?.phone ?? '—',
            fax: contact?.fax ?? el('nRecipientFax')?.value ?? '—',
            email: contact?.email ?? el('nToEmail')?.value ?? '',
          },
    patient: {
      name,
      mrn: el('nPatient')?.value?.split('MRN ')[1] ?? '',
      dob: el('nDob')?.value ?? '',
      phone: el('nPhone')?.value ?? '',
      email: el('nToEmail')?.value ?? '',
    },
    from: {
      provider: el('nProvider')?.value ?? '',
      facility: el('nFacility')?.value ?? '',
      fax: el('nRecipientFax')?.value ?? '+1 701 639 4550',
      email: el('nFrom')?.value ?? '',
    },
    referringProvider: el('nProvider')?.value ?? '',
    diagnosis: el('nDx')?.value ?? '',
    notes: el('nNote')?.value ?? '',
    subject: el('nSubject')?.value ?? '',
    letter: el('nContent')?.value ? [el('nContent').value] : ['—'],
    attachments: state.attachments.map((f) => ({
      title: f.name,
      meta: `${f.size} · uploaded just now`,
      text: 'Uploaded document — preview not available in this prototype.',
    })),
    pages: state.attachments.length
      ? state.attachments.map((f) => ({
          title: f.name,
          text: 'Uploaded document — preview not available in this prototype.',
        }))
      : [{ title: 'Referral', text: 'Uploaded document — preview not available.' }],
    roi: direction === 'out' ? 'none' : undefined,
  };

  referrals[direction].unshift(referral);
  state.direction = direction;
  state.channel = channel;
  state.selected[direction] = referral.id;

  el('createModal').close();
  paintAll();
  notify(
    `${directionLabel(direction)} created for ${name}${
      stat ? ' — marked STAT' : ''
    }.`
  );
}
