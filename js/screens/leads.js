/**
 * LEADS — the website inbox, and the one door from it into the patient system.
 *
 * The whole module exists to put a person between a web form and a patient
 * record. Everything here is in service of that: the list is a worklist to
 * work through, the drawer is enough to decide on, and Convert to Patient does
 * exactly one thing — it opens the EXISTING onboarding form with the five
 * submitted fields filled in. It does not create anything.
 *
 * The lead is only marked converted by patient-add.js, at the end, once the
 * patient actually exists. Marking it here would leave leads pointing at
 * patients nobody finished creating.
 */
import { DIRECTORY } from '../../data/directory.js';
import {
  LEAD_STATUSES,
  LEAD_SOURCES,
  allLeads,
  leadById,
  openCount,
  linkExistingPatient,
  logAudit,
  missingFields,
  findDuplicates,
  shortDob,
  stamp,
  stampText,
  daysAgo,
} from '../../data/leads.js';
import { notify as toast } from '../lib/toast.js';
import { openRowMenu as openRowMenu_ } from '../lib/row-menu.js';
import { admits } from '../lib/filter-set.js';
import { createPager } from '../lib/pagination.js';

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const state = {
  query: '',
  status: '',
  date: '',
  source: '',
  from: '',
  to: '',
  sort: { key: 'submittedAt', dir: 'desc' },
  openId: null,
};

const fullName = (lead) => `${lead.firstName} ${lead.lastName}`.trim();

/*
 * Reports float; conditions stay put.
 *
 * This used to write a <ui-alert> into a strip at the top of the screen —
 * a banner that pushed the work down the page to say something that had
 * already finished, and then sat there until the next one replaced it.
 * <ui-toast> in the shared top-right region is the component for that
 * (js/lib/toast.js): it reports, it stacks, and it goes.
 *
 * `severity` is kept as the argument name at every call site; the toast
 * library takes the same words.
 */
function notify(message, severity = 'success') {
  toast(message, severity);
}

/* ===================== Filtering and sorting ===================== */

const DATE_FILTERS = {
  '': () => true,
  today: (lead) => daysAgo(lead.submittedAt) === 0,
  '7': (lead) => daysAgo(lead.submittedAt) <= 7,
  '30': (lead) => daysAgo(lead.submittedAt) <= 30,
  custom: (lead) => {
    const day = String(lead.submittedAt).split('T')[0];
    if (state.from && day < state.from) return false;
    if (state.to && day > state.to) return false;
    return true;
  },
};

function visibleLeads() {
  const q = state.query.trim().toLowerCase();

  const rows = allLeads().filter((lead) => {
    /* Status takes a set — an inbox is worked as "New and Contacted", not one
       state at a time. Source is a set too, though there is only one source to
       pick today; what changed there is that it now asks the LEAD where it came
       from rather than comparing the filter to the literal 'Website', which
       would have emptied the table the day a second source was added. */
    if (!admits(state.status, lead.status)) return false;
    if (!admits(state.source, lead.source ?? LEAD_SOURCES[0])) return false;
    if (!DATE_FILTERS[state.date]?.(lead)) return false;
    if (q) {
      const hay = `${fullName(lead)} ${lead.phone} ${lead.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const { key, dir } = state.sort;
  const sign = dir === 'asc' ? 1 : -1;
  return rows.sort((a, b) => {
    if (key === 'name') return sign * fullName(a).localeCompare(fullName(b));
    if (key === 'status') return sign * LEAD_STATUSES[a.status].label.localeCompare(LEAD_STATUSES[b.status].label);
    return sign * String(a.submittedAt).localeCompare(String(b.submittedAt));
  });
}

/* ===================== The table ===================== */

/**
 * Convert is offered on New rows only.
 *
 * A converted lead already has its patient — the row offers that instead.
 */
function actionsCell(lead) {
  if (lead.status === 'converted') {
    return `<div class="lead__row-actions">
      <ui-button variant="outline" size="xs" icon="user"
        data-view-patient="${esc(lead.id)}"
        data-testid="lead--view-patient-${esc(lead.id)}">View Patient</ui-button>
      ${menuButton(lead)}
    </div>`;
  }
  return `<div class="lead__row-actions">
    <ui-button variant="primary" size="xs" icon="user-plus"
      data-convert="${esc(lead.id)}"
      data-testid="lead--convert-${esc(lead.id)}">Convert to Patient</ui-button>
    ${menuButton(lead)}
  </div>`;
}

/* The shared row-menu classes, not a set of this screen's own. Every other
   table in the product opens .ui-row-menu; leads had grown a private copy that
   drifted — same panel, same items, its own padding and its own hover. */
const menuButton = (lead) => `<button type="button" class="ui-row-menu-btn"
  data-menu="${esc(lead.id)}" aria-label="More actions for ${esc(fullName(lead))}"
  data-testid="lead--menu-${esc(lead.id)}">
  <svg class="ui-icon" aria-hidden="true"><use href="#i-more-vertical"></use></svg>
</button>`;

/*
 * NO SELECT COLUMN.
 *
 * Every row carried a checkbox whose only destination was a bulk Export —
 * which the toolbar's own Export already does, for exactly the list on
 * screen. So the column cost a column of width on every row to offer a second
 * route to the same file, and the bulk bar that went with it has gone too.
 * Work on a lead is per-lead: converting and reviewing are both
 * one-at-a-time by nature.
 */
const COLUMNS = [
  {
    key: 'name',
    label: 'Lead',
    render: (lead) => `<span class="lead__name">${esc(fullName(lead))}</span>`,
  },
  { key: 'dob', label: 'DOB', render: (lead) => esc(shortDob(lead.dob)) },
  {
    key: 'phone',
    label: 'Phone',
    render: (lead) =>
      lead.phone
        ? esc(lead.phone)
        : '<span class="lead__missing" title="Not submitted">Not provided</span>',
  },
  { key: 'email', label: 'Email', truncate: true },
  {
    key: 'submittedAt',
    label: 'Submitted On',
    render: (lead) => {
      const s = stamp(lead.submittedAt);
      return `<span class="lead__cell-time">${esc(s.date)}</span>
        <span class="lead__cell-sub">${esc(s.time)}</span>`;
    },
  },
  /*
   * NO SOURCE COLUMN either. Every lead in this module arrives from the
   * website form — the column printed the same word on every row, which is a
   * column of width spent on nothing. It stays in the CSV export, where a
   * constant costs nothing and a downstream reader may need it, and it comes
   * back the day a second source (a phone enquiry, a referral portal) makes
   * it a real distinction.
   */
  {
    key: 'status',
    label: 'Status',
    render: (lead) => {
      const spec = LEAD_STATUSES[lead.status];
      return `<ui-badge status="${spec.tone}">${esc(spec.label)}</ui-badge>`;
    },
  },
  { key: 'actions', label: 'Actions', actions: true, render: actionsCell },
];

/*
 * The shared pager, built on first paint. It is the same footer the patient
 * directory carries — see lib/pagination.js — so an inbox that has run to
 * three screens of rows is read the same way a directory of thirty-six is.
 *
 * The count of what is still open rides along as the pager's suffix rather
 * than as a line of its own: it was the one thing the old summary strip said
 * that the range does not, and it is a fact about the whole inbox, not the
 * page in front of you.
 */
let pager;

function paintTable() {
  const rows = visibleLeads();
  /* What the inbox holds before this screen's filters are applied — the
     number the empty states are about. "Nothing matches" and "nothing here"
     are different sentences and only one of them is the reader's own doing. */
  const inTab = allLeads().length;
  const table = el('leadTable');

  if (!pager) {
    pager = createPager(el('foot'), {
      noun: 'leads',
      testidPrefix: 'lead',
      onChange: paintTable,
    });
  }

  // Two empties, one per thing that can be true. "No leads yet" is an inbox
  // with nothing in it, and "nothing matches" is a filter the reader set and
  // can undo. Showing the first when a filter is on would say the inbox is
  // empty when it is not.
  el('empty').hidden = inTab > 0;
  el('noMatch').hidden = inTab === 0 || rows.length > 0;
  table.hidden = rows.length === 0;

  pager.setSuffix(inTab === 0 ? '' : `${openCount()} open`);
  const { start, end } = pager.render(rows.length);
  const pageRows = rows.slice(start, end);

  table.columns = COLUMNS;
  table.rows = pageRows.map((lead) => ({ ...lead, id: lead.id }));

  el('leadTable').querySelectorAll('[data-convert]').forEach((b) =>
    b.addEventListener('ui-click', (e) => {
      e.stopPropagation();
      startConversion(b.dataset.convert);
    })
  );
  el('leadTable').querySelectorAll('[data-view-patient]').forEach((b) =>
    b.addEventListener('ui-click', (e) => {
      e.stopPropagation();
      openPatientChart(b.dataset.viewPatient);
    })
  );
  el('leadTable').querySelectorAll('[data-menu]').forEach((b) =>
    b.addEventListener('click', (event) => {
      event.stopPropagation();
      openRowMenu(b.dataset.menu, b);
    })
  );

  // The row itself opens the drawer — the whole row, because a five-field
  // record is read by opening it, and hunting for a link in one cell is work
  // the row can do for you.
  el('leadTable').querySelectorAll('tbody tr').forEach((tr, i) => {
    tr.classList.add('lead__row');
    tr.addEventListener('click', (event) => {
      if (event.target.closest('ui-button, button')) return;
      openDrawer(pageRows[i].id);
    });
  });
}

/* ===================== Row menu ===================== */

function openRowMenu(id, trigger) {
  const lead = leadById(id);
  if (!lead) return;

  /* The actions a lead offers depend on where it has got to: a converted lead
     can be opened in the chart, a new one can only be read until it is. */
  const ACTIONS = {
    view: { label: lead.status === 'converted' ? 'View Lead' : 'View Details',
            icon: 'eye', testid: 'lead--menu-view', run: () => openDrawer(id) },
    chart: { label: 'View Patient Chart', icon: 'user',
             testid: 'lead--menu-chart', run: () => openPatientChart(id) },
  };

  const order = lead.status === 'converted' ? ['view', 'chart'] : ['view'];

  openRowMenu_(trigger, order.map((key) => ACTIONS[key]));
}

/* ===================== The details dialog ===================== */

/**
 * Age today, from the submitted date of birth.
 *
 * The form collects a date because a date is what can be checked against a
 * chart later; the person reading the lead thinks in years. Printing both
 * saves them the subtraction, and the subtraction is the part that decides
 * whether a screening enquiry is routine or early.
 */
function ageFrom(iso) {
  const [y, m, d] = String(iso ?? '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const before =
    now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  return now.getFullYear() - y - (before ? 1 : 0);
}

/**
 * "3 days ago" beside the timestamp.
 *
 * An inbox is worked by age, not by date: "Aug 10, 2026 4:48 PM" is a fact
 * you have to do arithmetic on before it tells you whether this enquiry has
 * been sitting unanswered for a week. Past a month the exact stamp is the
 * only useful thing left, so the phrase stops.
 */
function ageOfLead(iso) {
  const days = daysAgo(iso);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days <= 30) return `${days} days ago`;
  return '';
}

/**
 * A contact fact you can act on.
 *
 * Phone and email are the only two fields on a lead that are instructions
 * rather than description — the whole point of the record is that somebody
 * rings or writes back. So they are rendered as tel:/mailto: targets rather
 * than as text to be copied out by hand, and a missing one keeps its box and
 * says so, because "no phone number" is itself something the desk has to see
 * before it promises to call.
 */
function contactRow(icon, label, value, href, testid) {
  const inner = `<svg class="ui-icon" aria-hidden="true"><use href="#i-${icon}"></use></svg>
    <span class="lead__d-contact-text">
      <span class="lead__d-contact-label">${esc(label)}</span>
      <span class="lead__d-contact-value">${
        value ? esc(value) : '<span class="lead__missing">Not provided</span>'
      }</span>
    </span>`;

  return value
    ? `<a class="lead__d-contact" href="${esc(href)}" data-testid="${testid}">${inner}</a>`
    : `<div class="lead__d-contact lead__d-contact--empty" data-testid="${testid}">${inner}</div>`;
}

function openDrawer(id) {
  const lead = leadById(id);
  if (!lead) return;
  state.openId = id;
  logAudit(id, 'Lead Viewed');

  const spec = LEAD_STATUSES[lead.status];
  const gaps = missingFields(lead);
  const age = ageFrom(lead.dob);
  const since = ageOfLead(lead.submittedAt);

  /* The two fields that are acted on, first and on their own. Everything
     below them is description; these are the enquiry itself. */
  const contact = `
    <section class="lead__d-section">
      <h3 class="lead__d-title">Contact</h3>
      <div class="lead__d-contacts">
        ${contactRow(
          'phone',
          'Phone',
          lead.phone,
          `tel:${String(lead.phone ?? '').replace(/[^\d+]/g, '')}`,
          'lead--d-phone'
        )}
        ${contactRow('mail', 'Email', lead.email, `mailto:${lead.email}`, 'lead--d-email')}
      </div>
    </section>`;

  /*
   * Lead Information is what the website form submitted, minus the two
   * fields the Contact block already carries and minus the name, which the
   * identity row above prints once at full size. What is left is the
   * identifying detail the desk checks against a chart — so date of birth
   * leads it, with the age it works out to.
   */
  const submission = `
    <section class="lead__d-section">
      <h3 class="lead__d-title">Lead Information</h3>
      <dl class="lead__d-facts">
        <div><dt>Full Name</dt><dd>${esc(fullName(lead))}</dd></div>
        <div><dt>Date of Birth</dt><dd>${esc(shortDob(lead.dob))}${
          age === null ? '' : ` <span class="lead__d-aside">(${age} yrs)</span>`
        }</dd></div>
        <div><dt>Submitted</dt><dd>${esc(stampText(lead.submittedAt))}</dd></div>
        <div><dt>Source</dt><dd>${esc(lead.source ?? LEAD_SOURCES[0])}</dd></div>
      </dl>
    </section>`;

  const conversion = lead.conversion
    ? `<section class="lead__d-section">
        <h3 class="lead__d-title">Conversion</h3>
        <dl class="lead__d-facts">
          <div><dt>Patient</dt><dd>${esc(lead.conversion.patientName)}</dd></div>
          <div><dt>MRN</dt><dd><code>${esc(lead.conversion.mrn)}</code></dd></div>
          <div><dt>Converted by</dt><dd>${esc(lead.conversion.by)}</dd></div>
          <div><dt>Converted on</dt><dd>${esc(stampText(lead.conversion.at))}</dd></div>
        </dl>
      </section>`
    : '';

  el('drawerBody').innerHTML = `
    <div class="lead__d-head">
      <ui-avatar name="${esc(fullName(lead))}" size="lg"></ui-avatar>
      <div class="lead__d-head-text">
        <h2 class="lead__d-name">${esc(fullName(lead))}</h2>
        <p class="lead__d-since">Submitted ${esc(stamp(lead.submittedAt).date)}${
          since ? ` · ${esc(since)}` : ''
        } · ${esc(lead.source ?? LEAD_SOURCES[0])}</p>
      </div>
      <ui-badge status="${spec.tone}" data-testid="lead--d-status">${esc(spec.label)}</ui-badge>
    </div>

    ${
      gaps.length && lead.status !== 'converted'
        ? `<ui-alert severity="warning" heading="Incomplete Lead Information"
             data-testid="lead--d-incomplete">
             Some information is missing (${esc(gaps.join(', '))}). Review the
             Lead before converting it to a patient.
           </ui-alert>`
        : ''
    }
    ${
      lead.conversion
        ? `<ui-alert severity="success" heading="Converted" data-testid="lead--d-converted">
             ${esc(lead.conversion.patientName)} · MRN ${esc(lead.conversion.mrn)}
           </ui-alert>`
        : ''
    }

    ${contact}
    ${submission}
    ${conversion}`;

  el('drawerActions').innerHTML =
    lead.status === 'converted'
      ? `<ui-button variant="primary" id="dChart" data-testid="lead--d-chart">
           View Patient Chart</ui-button>`
      : `<ui-button variant="primary" icon="user-plus" id="dConvert"
           data-testid="lead--d-convert">Convert to Patient</ui-button>`;

  el('dChart')?.addEventListener('ui-click', () => openPatientChart(id));
  el('dConvert')?.addEventListener('ui-click', () => startConversion(id));

  el('leadDrawer').open();
}

/* ===================== Conversion ===================== */

function openPatientChart(id) {
  const lead = leadById(id);
  if (!lead?.conversion) return;
  window.location.href = `patient-chart.html?mrn=${encodeURIComponent(lead.conversion.mrn)}`;
}

/**
 * Convert to Patient.
 *
 * This creates NOTHING. It hands the five submitted fields to the existing
 * onboarding form and gets out of the way — the patient is created there, by
 * a person, after the rest of the record is filled in. The lead id travels in
 * the URL so the form can show the conversion banner and link the two records
 * back together when the patient is actually created.
 */
function startConversion(id) {
  const lead = leadById(id);
  if (!lead) return;

  // Someone else may have converted it in another tab while this list sat open.
  if (lead.status === 'converted') {
    notify(
      `Lead Already Converted — ${fullName(lead)} is already a patient (MRN ${lead.conversion.mrn}).`,
      'warning'
    );
    paint();
    return;
  }

  const gaps = missingFields(lead);
  if (gaps.length) {
    // A warning, not a block: the desk can fill the gap in on the onboarding
    // form, which is the form that asks for it properly anyway.
    notify(
      `Incomplete Lead Information — ${gaps.join(', ')} missing. Complete it on the onboarding form.`,
      'warning'
    );
  }

  /*
   * Is this somebody we already have?
   *
   * A returning patient filling in the website form is the ordinary case, and
   * onboarding them again would mint a second chart for one person — the worst
   * outcome this module can produce. So the match is offered HERE, before the
   * form, rather than as a duplicate warning at the end of it.
   */
  const matches = findDuplicates(lead, DIRECTORY);
  if (matches.length) {
    offerExistingPatient(lead, matches);
    return;
  }

  logAudit(id, 'Lead Status Changed', 'Conversion started');
  window.location.href = `patient-add.html?lead=${encodeURIComponent(id)}`;
}

/** The lead the existing-patient dialog is about. */
let matchingId = null;

function offerExistingPatient(lead, matches) {
  matchingId = lead.id;

  el('existingLead').textContent =
    `${fullName(lead)} looks like somebody already on file. Link the enquiry to their chart, or onboard them as a new patient.`;

  el('existingMatches').innerHTML = matches
    .slice(0, 3)
    .map(
      (m) => `<div class="lead__match" data-testid="lead--match">
        <dl>
          <div><dt>Patient</dt><dd>${esc(m.patient.name)}</dd></div>
          <div><dt>DOB</dt><dd>${esc(m.patient.dob)}</dd></div>
          <div><dt>MRN</dt><dd><code>${esc(m.patient.mrn)}</code></dd></div>
          <div><dt>Phone</dt><dd>${esc(m.patient.phone ?? '—')}</dd></div>
        </dl>
        <div class="lead__match-actions">
          <ui-button variant="outline" size="sm" data-match-view="${esc(m.patient.mrn)}"
            data-testid="lead--match-view">View Chart</ui-button>
          <ui-button variant="primary" size="sm" data-match-link="${esc(m.patient.mrn)}"
            data-testid="lead--match-link-${esc(m.patient.mrn)}">This is them</ui-button>
        </div>
      </div>`
    )
    .join('');

  el('existingMatches')
    .querySelectorAll('[data-match-view]')
    .forEach((b) =>
      b.addEventListener('ui-click', () => {
        window.location.href = `patient-chart.html?mrn=${encodeURIComponent(b.dataset.matchView)}`;
      })
    );

  el('existingMatches')
    .querySelectorAll('[data-match-link]')
    .forEach((b) =>
      b.addEventListener('ui-click', () => {
        const mrn = b.dataset.matchLink;
        const patient = DIRECTORY.find((x) => x.mrn === mrn);
        linkExistingPatient(matchingId, { mrn, patientName: patient?.name ?? '' });
        el('existingModal').close();
        el('leadDrawer').close();
        notify(
          `${fullName(lead)} linked to the existing chart for ${patient?.name} (MRN ${mrn}). No new patient was created.`
        );
        paint();
      })
    );

  el('existingModal').open();
}

/** A CSV of what is on screen. Export means "what I am looking at". */
function exportCsv(rows) {
  const head = ['First Name', 'Last Name', 'DOB', 'Phone', 'Email', 'Submitted', 'Source', 'Status'];
  const body = rows.map((l) => [
    l.firstName, l.lastName, shortDob(l.dob), l.phone, l.email,
    stampText(l.submittedAt), 'Website', LEAD_STATUSES[l.status].label,
  ]);
  const csv = [head, ...body]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'leads.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  notify(`${rows.length} lead${rows.length === 1 ? '' : 's'} exported.`);
}

/* ===================== Paint ===================== */

/*
 * The filter chrome paints itself.
 *
 * <ui-filter> carries its own count badge — how many answers are ticked,
 * across every group — so the screen no longer counts its own filters or
 * writes a label onto a button. What is left here is the one thing the
 * component cannot know: that the custom range belongs to the Date question
 * and only exists once Custom is the answer to it.
 */
function paintFilterChrome() {
  el('leadRange').hidden = state.date !== 'custom';
  el('leadFilter').refresh?.();
}

/*
 * Every filter, search and status change comes through here, and every one of
 * them changes WHICH leads are listed — so the page goes back to one. Paging
 * itself does not: the pager repaints the table directly, or clicking "3"
 * would send you to page 1 by way of page 3.
 */
function paint() {
  pager?.reset();
  paintTable();
  paintFilterChrome();
}

/* ===================== Boot ===================== */

customElements.whenDefined('ui-filter').then(() => {
  const filter = el('leadFilter');

  filter.setGroupOptions(
    'status',
    Object.entries(LEAD_STATUSES).map(([value, s]) => ({ value, label: s.label }))
  );
  filter.setGroupOptions('source', LEAD_SOURCES);
  filter.setGroupOptions('date', [
    { value: 'today', label: 'Today' },
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom range' },
  ]);

  /* Live: the table narrows on the tick rather than on Done. Nothing here
     costs more than a re-filter of forty rows, and seeing the list move under
     an open panel is what tells you the box you just ticked was the right one.
     Done is still there, and still closes the panel — see ui-filter.js. */
  filter.addEventListener('ui-filter-change', (event) => {
    const values = event.detail.values;
    state.status = values.status;
    state.source = values.source;
    /* Date is a `single` group, so its set holds nothing or one thing, and
       DATE_FILTERS is keyed by that one thing. */
    state.date = values.date[0] ?? '';
    if (state.date !== 'custom') Object.assign(state, { from: '', to: '' });
    paint();
  });

  el('fFrom').addEventListener('ui-change', (e) => {
    state.from = e.detail.value;
    paint();
  });
  el('fTo').addEventListener('ui-change', (e) => {
    state.to = e.detail.value;
    paint();
  });

  document
    .querySelector('[data-testid="lead--search"]')
    .addEventListener('ui-input', (e) => {
      state.query = e.detail.value;
      paint();
    });

  /* Clear empties the search box too. The panel's own Clear only knows about
     the boxes it drew, and a "cleared" list still hiding half its rows behind
     a forgotten search term is the reason this listener exists. */
  filter.addEventListener('ui-filter-clear', () => {
    Object.assign(state, { query: '', status: [], date: '', source: [], from: '', to: '' });
    const search = document.querySelector('[data-testid="lead--search"]');
    search.setAttribute('value', '');
    const input = search.querySelector('input');
    if (input) input.value = '';
    paint();
  });
});

customElements.whenDefined('ui-data-table').then(() => {
  el('leadTable').addEventListener('ui-sort', (event) => {
    const key = event.detail.key;
    if (!['name', 'submittedAt', 'status'].includes(key)) return;
    state.sort =
      state.sort.key === key
        ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' };
    paint();
  });

  el('export').addEventListener('ui-click', () => exportCsv(visibleLeads()));

  el('dClose').addEventListener('ui-click', () => el('leadDrawer').close());

  el('existingCancel').addEventListener('ui-click', () => el('existingModal').close());
  // "Not them" is the escape hatch: onboard as a genuinely new patient.
  el('existingNew').addEventListener('ui-click', () => {
    el('existingModal').close();
    logAudit(matchingId, 'Lead Status Changed', 'Conversion started — no existing match taken');
    window.location.href = `patient-add.html?lead=${encodeURIComponent(matchingId)}`;
  });

  /* Arriving back from a completed conversion — patient-add.js sets this. */
  const params = new URLSearchParams(window.location.search);
  if (params.get('converted')) {
    const lead = leadById(params.get('converted'));
    if (lead?.conversion) {
      notify(
        `Patient Created Successfully — ${lead.conversion.patientName} has been added to the patient system. MRN ${lead.conversion.mrn}.`
      );
    }
  }

  paint();
});

export { findDuplicates, DIRECTORY };
