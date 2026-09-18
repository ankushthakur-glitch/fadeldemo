/**
 * PROFILE — the registration record: everything collected on the Patient
 * Info tab of Add Patient (screens/patient-add.html#panel-patient), read
 * back out for a chart that already exists.
 *
 * Split from Clinical and Insurance at the 2026-08 design review: those two
 * are their own sidebar sections (module ids "profile-clinical" and
 * "profile-billing"), no longer nested under a "Profile" group — this
 * module is what "Profile" itself now shows, rather than redirecting to
 * Clinical.
 *
 * THREE TABS, ONE RECORD. Profile answers "who is this person, and how do we
 * bill them" — and until now it only answered the first half, which meant the
 * desk had to leave the screen and open the Insurance section to read a member
 * ID back to a payer on the phone. Insurance Info and Card Info are that
 * second half, brought onto the same screen the identity is on:
 *
 *   Profile Info    the registration record — identity, contact, demographics
 *   Insurance Info  the coverage on file, one section per policy
 *   Card Info       the card faces for those policies, front and back
 *
 * The last two READ data/profile-billing.js — the same array Profile ·
 * Insurance renders from, by reference and not by copy, so a policy promoted
 * in one place is promoted in the other. Nothing about coverage is stored
 * here; this module is a second reader of it, never a second source.
 *
 * Facts already on the chart header — name, preferred name, DOB, gender,
 * language, phone, email, address, record status — are read from
 * ctx.patient (data/patient-chart.js) and NOT repeated here; this module
 * only adds the registration detail the header has nowhere to put. See
 * data/profile.js's header for the full split.
 *
 * HIERARCHY. Every fact on this screen is a label/value pair, and the pair
 * follows the ladder css/tokens.css sets out for it rather than the flat
 * 11px grey both halves used to share: the label is the smaller, quieter
 * half because it is READ once to learn what the value means, and the value
 * is 14px, primary, one weight step heavier, because it is what somebody
 * came to the screen for. Pairs sit in a divided grid running the width of
 * the card — six to a row rather than one — so a section is a band to scan
 * across rather than a column to read down.
 *
 * Read-only, like the header it extends: this prototype does not re-open
 * registration for editing from inside the chart, the same honest-stub rule
 * every other "not wired up yet" action in this app follows.
 */
import { registerModule } from './chart-workspace.js';
import { openRowMenu, closeRowMenu } from '../lib/row-menu.js';
import { PROFILE, EMPTY_PROFILE } from '../../data/profile.js';
import { PROFILE_BILLING, EMPTY_PROFILE_BILLING } from '../../data/profile-billing.js';

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
}

function icon(name, className = 'ui-icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/* Coverage dates arrive as DD-MM-YYYY, the same shape every other date in
   data/ uses. Rendered long, because "01-03-2026" is ambiguous to half the
   people who read it and "01 Mar 2026" is ambiguous to nobody. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  if (!d || !m || !y) return '';
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** The same date the other way round, because <input type="date"> reads
 *  YYYY-MM-DD and nothing else — a form prefilled with "01 Jan 2025" comes up
 *  blank, which reads as "we have no date" rather than "this box cannot
 *  parse ours". */
function isoDate(value) {
  const [d, m, y] = String(value || '').split('-').map(Number);
  if (!d || !m || !y) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ============================================================================
   THE THREE SHAPES THIS MODULE DRAWS

   A section, a field, and a list item. Everything on all three tabs is built
   out of these, which is the whole reason the tabs read as one screen rather
   than as three that happen to share a heading.
   ========================================================================= */

/**
 * A full-width section: a title, an optional badge beside it, optional
 * actions on the right, a body. The badge is a SIBLING of the heading rather
 * than content inside it — a coverage order read out as part of the heading
 * text turns "Summit Bridge PPO" into "Summit Bridge PPO Primary" for anyone
 * listening rather than looking.
 *
 * TWO HEADS, AND THE DIFFERENCE IS THE POINT. A section that occurs ONCE on
 * the tab — Demographics, Registration Details — carries its title on the
 * card's own white, with nothing ruled under it: there is only one of it, so
 * nothing has to be told apart from anything. A section that REPEATS — one
 * per policy, one per card — takes a tinted band with a rule under it, which
 * is what says "here is another one of these" as the eye comes down the page.
 * Banding every head would say nothing at all.
 */
function section({ title, testid, bodyHtml, badgeHtml = '', actionsHtml = '', band = false }) {
  return `<section class="fs__card fs__section" data-testid="chart--pr-${testid}">
      <header class="fs__card-head ${band ? 'fs__card-head--band' : 'fs__card-head--plain'}">
        <h3 class="fs__card-title">${title}</h3>
        ${badgeHtml}
        ${actionsHtml ? `<div class="fs__card-actions">${actionsHtml}</div>` : ''}
      </header>
      <div class="fs__card-body">${bodyHtml}</div>
    </section>`;
}

/**
 * The divided field grid. `fields` is [label, value, wide?] triples; a blank
 * value renders as "—" in the quieter tertiary, so "nothing on file" and "a
 * value that happens to be short" cannot be mistaken for each other.
 *
 * Wide fields are emitted LAST rather than in the order they were written.
 * A wide field spans the whole row, so it forces a row break wherever it
 * lands — and the CSS drops the divider from the first field of each row by
 * counting children, arithmetic a mid-grid row break silently invalidates.
 * Sorting them to the end keeps the count honest for everything above.
 */
function fields(pairs) {
  const one = ([label, value, , html], wide) => `<div class="fs__field${
    wide ? ' fs__field--wide' : ''
  }">
      <dt class="fs__field-label">${esc(label)}</dt>
      <dd class="fs__field-value${value || html ? '' : ' fs__field-value--empty'}">${
        html || (value ? esc(value) : '—')
      }</dd>
    </div>`;

  return `<dl class="fs__fields">
    ${pairs.filter((pair) => !pair[2]).map((pair) => one(pair, false)).join('')}
    ${pairs.filter((pair) => pair[2]).map((pair) => one(pair, true)).join('')}
  </dl>`;
}

/** A field whose value is a state rather than a string — Active, Verified,
 *  Enabled. A badge is how this product says a state everywhere else; a
 *  fact list is not a reason to say it differently. */
function badgeValue(status, label) {
  return `<ui-badge status="${status}" size="sm">${esc(label)}</ui-badge>`;
}

/** The "⋮" at the end of a table row. Same markup Notes and Billing use, so
 *  openRowMenu() finds the trigger it expects and the panel opens in the same
 *  place on every table in this chart. */
function rowActionButton(attr, id, label) {
  return `<button type="button" class="ui-row-menu-btn" data-${attr}="${id}"
      aria-haspopup="menu" aria-expanded="false" aria-label="${label}">
      ${icon('more-vertical')}
    </button>`;
}

function list(rows, emptyText) {
  if (!rows.length) return `<ul class="fs__list"><li class="fs__empty">${esc(emptyText)}</li></ul>`;
  return `<ul class="fs__list">${rows.join('')}</ul>`;
}

const YES_NO = (value) => (value ? 'Yes' : 'No');

/* ============================================================================
   MODULE
   ========================================================================= */

/** Tab value → the action button that belongs to it. */
const TAB_ACTIONS = {
  'pr-profile': 'chart--pr-edit',
  'pr-insurance': 'chart--pr-add-insurance',
  'pr-card': 'chart--pr-upload-card',
};

registerModule('profile', {
  /* The sidebar's open row already says Profile, and so does the tab that is
     lit under it; a third "Profile" on the same row is a word the eye has to
     step over to reach the switch. hideTitle takes it off the screen without
     taking it out of the document — the h2 is still there for a screen
     reader, and because .u-sr-only is absolutely positioned the strip starts
     at the panel's own left edge rather than one gap in from it. */
  hideTitle: true,

  /* The switch sits in the module head, between the title and the actions —
     the slot the shell reserves for exactly this, so a module's own view
     switch is in the same place in every module that has one. */
  tabs: () =>
    `<ui-tabs primary selected="pr-profile" data-testid="chart--pr-tabs">
      <ui-tab value="pr-profile" label="Profile Info"></ui-tab>
      <ui-tab value="pr-insurance" label="Insurance Info"></ui-tab>
      <ui-tab value="pr-card" label="Card Info"></ui-tab>
    </ui-tabs>`,

  /* Edit belongs in the module head beside the title, which is where every
     other module's whole-module action sits — Allergies' "Add Allergies", the
     buttons on the right of every toolbar. It used to be a row of its own
     under the head with nothing on its left, which pushed the cards 40px
     lower than the same cards in Clinical and made the two screens look like
     they were built to different rules.

     All three are rendered once and hidden by tab rather than re-rendered on
     every switch: the shell calls actions() when the MODULE mounts, not when
     a tab changes, and a button that is replaced under the pointer that just
     moved onto it is a button that loses focus mid-keystroke. */
  actions: () =>
    `<ui-button variant="primary" size="sm" icon="pencil" data-testid="chart--pr-edit"
      >Edit Info</ui-button
    ><ui-button variant="primary" size="sm" icon="plus" data-testid="chart--pr-add-insurance" hidden
      >Add Insurance</ui-button
    ><ui-button variant="primary" size="sm" icon="upload" data-testid="chart--pr-upload-card" hidden
      >Upload Card</ui-button
    >`,

  render(host, ctx) {
    const p = PROFILE[ctx.patient.mrn] || EMPTY_PROFILE;
    // By reference, not by copy — see the header. Profile · Insurance pushes
    // to this same array, and a policy added there must show up here.
    const payers = (PROFILE_BILLING[ctx.patient.mrn] || EMPTY_PROFILE_BILLING).payers;

    const head = host.parentElement;
    let activeTab = 'pr-profile';

    /* --- Tab 1: the registration record ------------------------------------ */

    function identitySection() {
      const fullName = [p.identity.prefix, p.identity.firstName, p.identity.middleName, p.identity.lastName, p.identity.suffix]
        .filter(Boolean)
        .join(' ');

      return section({
        title: 'Patient Basic Details',
        testid: 'identity',
        /* Every fact here appears on this screen exactly once. Language,
           patient type and the record number each belong to a section
           further down — repeating them because a "basic details" block
           looks thin without them is how two copies of one fact end up
           disagreeing after somebody edits the near one. */
        bodyHtml: fields([
          ['Full name', fullName || ctx.patient.name],
          ['Preferred name', ctx.patient.preferredName],
          ['Previous name', p.identity.previousName],
          ['Maiden name', p.identity.maidenName],
          ['Date of birth', `${formatDate(ctx.patient.dob)} (${ctx.age} yrs)`],
          [
            'Birth sex',
            p.identity.birthSexDeclined ? 'Declined to state' : p.identity.birthSex,
          ],
          ['Gender', ctx.patient.gender],
          ['Social Security Number', p.identity.ssnLast4 ? `•••-••-${p.identity.ssnLast4}` : ''],
        ]),
      });
    }

    function contactSection() {
      return section({
        title: 'Contact & Address Details',
        testid: 'contact',
        bodyHtml: fields([
          ['Mobile phone', ctx.patient.phoneType === 'Mobile' ? ctx.patient.phone : ''],
          ['Home phone', p.contact.homePhone],
          ['Work phone', p.contact.workPhone],
          ['Email', ctx.patient.email],
          ['Contact preference', p.contact.contactPreference],
          ['Preferred language', ctx.patient.language],
          ['Address', ctx.patient.address, true],
        ]),
      });
    }

    function demographicsSection() {
      return section({
        title: 'Demographics',
        testid: 'demographics',
        bodyHtml: fields([
          ['Patient type', p.demographics.patientType],
          ['Nationality', p.demographics.nationality],
          ['Race', [p.demographics.race, p.demographics.raceDetails].filter(Boolean).join(' — ')],
          ['Ethnicity', [p.demographics.ethnicity, p.demographics.ethnicityDetails].filter(Boolean).join(' — ')],
          ['Tribal affiliation', p.demographics.tribalAffiliation],
          ['Marital status', p.demographics.maritalStatus],
        ]),
      });
    }

    function registrationSection() {
      return section({
        title: 'Registration Details',
        testid: 'registration',
        bodyHtml: fields([
          ['Record number', ctx.patient.mrn],
          [
            'Record status',
            '',
            false,
            ctx.patient.status === 'active'
              ? badgeValue('success', 'Active')
              : badgeValue('neutral', 'Inactive'),
          ],
          ['Preferred clinical lab', p.registration.preferredLab],
          ['Opted out of Text to Pay', YES_NO(p.registration.optOutTextToPay)],
          ['Opted out of portal reminders', YES_NO(p.registration.optOutPortalReminders)],
          ['Notes', p.registration.notes, true],
        ]),
      });
    }

    function sharingSection() {
      return section({
        title: 'Information Sharing',
        testid: 'sharing',
        bodyHtml: fields([
          ['Privacy policy acknowledged', YES_NO(p.sharing.privacyPolicyAcknowledged)],
          ['Protect data', p.sharing.protectData],
          ['Medication history import', p.sharing.medicationHistoryImport],
          ['CAHPS state restriction', YES_NO(p.sharing.cahpsRestricted)],
          ['Declines care reminders', YES_NO(p.sharing.declineCareReminders)],
          ['Excluded from financial reports', YES_NO(p.sharing.excludeFromReports)],
        ]),
      });
    }

    function chartAccessSection() {
      return section({
        title: 'Chart accessible only by',
        testid: 'access',
        bodyHtml: fields([
          ['Restricted to', p.chartAccess.length ? p.chartAccess.join(', ') : 'Everyone', true],
        ]),
      });
    }

    /* One list of the people who look after this patient elsewhere, with the
       role saying which of them is which. It was a "Referring Physicians"
       card, standing on its own the way the referring physician stood on its
       own in registration — and a PCP who had also sent the referral was then
       two records that could drift apart, with nothing to say which one the
       letter should go to. Registration settled that already; this is the
       chart reading back what registration now holds. */
    function providersSection() {
      return section({
        title: 'Providers',
        testid: 'providers',
        bodyHtml: list(
          p.providers.map(
            (r) => `<li class="fs__item">
              <p class="fs__item-line">
                <strong>${esc(r.name)}</strong>
                <ui-badge status="brand" variant="outline" size="sm">${esc(r.role)}</ui-badge>
              </p>
              <p class="fs__item-meta">${esc(r.specialty)} · ${esc(r.practice)}</p>
              <p class="fs__item-meta">${esc(r.phone)}</p>
            </li>`
          ),
          'No providers on file.'
        ),
      });
    }

    function pharmaciesSection() {
      return section({
        title: 'Pharmacies',
        testid: 'pharmacies',
        bodyHtml: list(
          p.pharmacies.map(
            (ph) => `<li class="fs__item">
              <p class="fs__item-line">
                <strong>${esc(ph.name)}</strong>
                ${ph.primary ? '<ui-badge status="brand" size="sm">Primary</ui-badge>' : ''}
              </p>
              <p class="fs__item-meta">${esc(ph.address)}</p>
              <p class="fs__item-meta">${esc(ph.phone)}</p>
            </li>`
          ),
          'No pharmacies on file.'
        ),
      });
    }

    /* --- Tab 2: the coverage on file --------------------------------------- */

    /** "Primary Insurance", "Secondary Insurance" — the coverage order IS the
        heading, because it is the first thing anyone needs to know about a
        policy and a payer name in a heading buries it. */
    function insuranceSection(payer, index) {
      const subscriber = [payer.subscriberFirst, payer.subscriberLast].filter(Boolean).join(' ');
      const start = formatDate(payer.effective);
      const end = formatDate(payer.expires);
      const term = start ? `${start} – ${end || 'Open'}` : '';

      return section({
        title: `${esc(payer.type)} Insurance`,
        testid: `insurance-${index}`,
        band: true,
        /* Both are buttons rather than the text links the other profile
           modules use for a card action. A policy is a record you act ON —
           promote it, correct it — and a link says "somewhere else to read",
           which is the one thing neither of these does. */
        actionsHtml: `${
          payers.length > 1 && payer.type !== 'Primary'
            ? `<ui-button variant="outline" size="sm" data-pr-make-primary="${index}"
                data-testid="chart--pr-make-primary">Set as Primary</ui-button>`
            : ''
        }<ui-button variant="secondary" size="sm" icon="pencil" data-pr-edit-insurance="${index}"
            data-testid="chart--pr-edit-insurance">Edit</ui-button>`,
        bodyHtml: `${fields([
          ['Insurance name', payer.name],
          ['Insurance plan', payer.insuranceType],
          ['Member ID', payer.policy],
          ['Group number', payer.group],
          ['Start & end date', term],
          ['Payer phone', payer.phone],
          ['Relationship to insured', payer.relationship],
          ['Subscriber name', subscriber],
          ['Subscriber date of birth', formatDate(payer.subscriberDob)],
          ['Subscriber sex', payer.subscriberSex],
          ['Subscriber address', payer.subscriberSameAddress ? 'Same as patient' : ''],
          ['Office / specialist copay', [payer.offCopay, payer.specCopay].some((v) => v != null)
            ? `$${payer.offCopay ?? 0} / $${payer.specCopay ?? 0}`
            : ''],
        ])}
        <div class="fs__scans">
          ${cardScan(payer, 'front')}
          ${cardScan(payer, 'back')}
        </div>
        <p class="fs__scan-note">Drawn from the policy record — no card scan has been uploaded.</p>`,
      });
    }

    /* --- Tab 3: the card faces ----------------------------------------------
       No scan has been uploaded for any of these policies, and this prototype
       has no upload to make one — so rather than three empty dashed boxes,
       each face is DRAWN from the policy record: the same member ID, group
       and subscriber name a real card carries, laid out the way a real card
       lays them out. The caption says which it is, and says plainly that it
       is a rendering rather than a photograph, because a card face that
       claims to be a scan is the one thing on this screen somebody might act
       on without checking. */

    function cardScan(payer, side, { caption = true } = {}) {
      const subscriber = [payer.subscriberFirst, payer.subscriberLast].filter(Boolean).join(' ');

      const front = `<div class="fs__face">
          <p class="fs__face-brand">${esc(payer.name)}</p>
          <p class="fs__face-holder">${esc(subscriber || '—')}</p>
          <dl class="fs__face-pairs">
            <div><dt>Member ID</dt><dd>${esc(payer.policy) || '—'}</dd></div>
            <div><dt>Group</dt><dd>${esc(payer.group) || '—'}</dd></div>
            <div><dt>Plan</dt><dd>${esc(payer.insuranceType) || '—'}</dd></div>
            <div><dt>Effective</dt><dd>${formatDate(payer.effective) || '—'}</dd></div>
          </dl>
        </div>`;

      const back = `<div class="fs__face fs__face--back">
          <div class="fs__face-stripe" aria-hidden="true"></div>
          <p class="fs__face-note">
            For member services call ${esc(payer.phone) || 'the number on your card'}.
            In a medical emergency call 911. Present this card at every visit.
          </p>
          <dl class="fs__face-pairs">
            <div><dt>Coverage order</dt><dd>${esc(payer.type)}</dd></div>
            <div><dt>Relationship</dt><dd>${esc(payer.relationship) || '—'}</dd></div>
          </dl>
        </div>`;

      /* The label sits ABOVE the face, not under it. A caption under an
         image is read after the image, which is the right order for a
         photograph and the wrong one for a slot in a record: "insurance card
         front side" is the name of the thing, and a name comes first — the
         same order every field on the two tabs beside this one uses. */
      return `<figure class="fs__scan" data-testid="chart--pr-card-${side}">
          ${
            caption
              ? `<figcaption class="fs__scan-caption">Insurance Card ${
                  side === 'front' ? 'Front' : 'Back'
                } Side</figcaption>`
              : ''
          }
          ${side === 'front' ? front : back}
        </figure>`;
    }

    /* --- Tab 3, as a table ---------------------------------------------------
       A card is a FILING question, not a reading one: which sides of whose
       card do we hold, are any of them still missing, and when does this one
       stop being good. Those are columns. Laid out as a wall of card faces
       the answer to "what have we not got" had to be counted rather than
       read, and it got longer with every policy — two faces a policy, so a
       patient with three plans was six blocks deep before the desk could see
       that one back side had never been scanned.

       So the tab is one table over every side of every card, and the faces
       are still here — one press away, in View, at full size, where looking
       at a card is what you actually came to do. */

    const CARD_COLUMNS = [
      {
        key: 'preview',
        label: 'Preview',
        render: (row) =>
          row.side === 'front'
            ? `<span class="fs__thumb" aria-hidden="true">${icon('card')}</span>`
            : `<span class="fs__thumb fs__thumb--back" aria-hidden="true"
                 ><span class="fs__thumb-stripe"></span></span>`,
      },
      { key: 'issuer', label: 'Issuer' },
      { key: 'type', label: 'Card type' },
      { key: 'side', label: 'Side', render: (row) => (row.side === 'front' ? 'Front' : 'Back') },
      { key: 'number', label: 'Number on card' },
      { key: 'effective', label: 'Effective' },
      {
        key: 'scan',
        label: 'Scan',
        /* The preview and the scan are two different things and the columns
           are named so they cannot be read as one: the preview is drawn from
           the policy record, the scan is a photograph of the real card that
           in this prototype nobody has ever taken. */
        render: (row) =>
          row.scanned
            ? `<ui-badge status="success" size="sm">On file</ui-badge>`
            : `<ui-badge status="neutral" size="sm">Not uploaded</ui-badge>`,
      },
      {
        key: 'menu',
        label: '<span class="u-sr-only">Actions</span>',
        actions: true,
        render: (row) => rowActionButton('pr-card-menu', row.id, 'Card actions'),
      },
    ];

    /** Two rows a policy, because a card has two sides and the desk holds
     *  them one at a time — a single row per policy cannot say that the front
     *  is scanned and the back is not, which is the commonest state there is. */
    function cardRows() {
      return payers.flatMap((payer, index) =>
        ['front', 'back'].map((side) => ({
          id: `${index}-${side}`,
          payerIndex: index,
          side,
          issuer: payer.name,
          type: 'Insurance',
          number: payer.policy || '—',
          effective: formatDate(payer.effective) || '—',
          effectiveIso: isoDate(payer.effective),
          scanned: false,
        }))
      );
    }

    /* --- Paint --------------------------------------------------------------- */

    function paint() {
      host.innerHTML = `<div id="panel-pr-profile" role="tabpanel" aria-labelledby="tab-pr-profile"
          class="fs__stack" data-testid="chart--pr-grid">
          ${identitySection()}
          ${contactSection()}
          ${demographicsSection()}
          ${registrationSection()}
          ${sharingSection()}
          ${chartAccessSection()}
          <div class="fs__grid fs__grid--2">
            <div class="fs__col">${providersSection()}</div>
            <div class="fs__col">${pharmaciesSection()}</div>
          </div>
        </div>

        <div id="panel-pr-insurance" role="tabpanel" aria-labelledby="tab-pr-insurance"
          class="fs__stack" data-testid="chart--pr-insurance" hidden>
          ${
            payers.length
              ? payers.map(insuranceSection).join('')
              : section({
                  title: 'Insurance',
                  testid: 'insurance-empty',
                  bodyHtml: `<p class="fs__empty" style="padding-left:0">No insurance on file — self-pay.</p>`,
                })
          }
        </div>

        <div id="panel-pr-card" role="tabpanel" aria-labelledby="tab-pr-card"
          class="fs__stack" data-testid="chart--pr-cards" hidden>
          ${section({
            title: 'Cards on File',
            testid: 'cards',
            bodyHtml: `<ui-data-table
                empty-text="No cards on file — self-pay, so there is no card to hold."
                data-testid="chart--pr-cards-table"></ui-data-table>
              <p class="fs__scan-note" data-pr-cards-note>Every preview is drawn from the policy
                record. A scan is a photograph of the real card, and none has been uploaded.</p>`,
          })}
        </div>

        <!-- THE CARD FORM. One dialog for both ways in: Upload Card, which
             opens it blank, and a row's Replace, which opens it filled from
             that row. The fields ARE the table's columns — a form that asks
             for something the list cannot show is a form that files something
             nobody can find again. -->
        <ui-modal id="prCardModal" heading="Add Card" size="md">
          <div class="fs__grid fs__grid--2">
            <ui-select label="Card type" options="Insurance,Photo ID,Other"
              value="Insurance" data-testid="chart--pr-card-type"></ui-select>
            <ui-select label="Side" options="Front,Back" value="Front"
              data-testid="chart--pr-card-side"></ui-select>

            <ui-select class="fs__field--wide" label="Issuer" placeholder="Select"
              options="${esc([...new Set(payers.map((payer) => payer.name)), 'Other'].join(','))}"
              data-testid="chart--pr-card-issuer"></ui-select>

            <ui-input label="Number on card" data-testid="chart--pr-card-number"></ui-input>
            <ui-input label="Effective" type="date" data-testid="chart--pr-card-effective"></ui-input>

            <div class="fs__field--wide">
              <ui-file-upload label="Card image" accept=".png,.jpg" max-size="5MB"
                data-testid="chart--pr-card-image"></ui-file-upload>
            </div>
          </div>

          <div slot="footer">
            <ui-button variant="tertiary" data-modal-dismiss data-testid="chart--pr-card-cancel"
              >Cancel</ui-button
            >
            <ui-button variant="primary" data-testid="chart--pr-card-save">Add Card</ui-button>
          </div>
        </ui-modal>

        <!-- The faces did not go anywhere; they are one press away, at the
             size a card is actually looked at. -->
        <ui-modal id="prCardViewModal" heading="Card" size="md">
          <div id="prCardViewBody" data-testid="chart--pr-card-view"></div>
        </ui-modal>`;

      /* A table's rows are data, not markup — configured through JS
         properties, the same contract every other ui-data-table in this
         chart follows. */
      const table = host.querySelector('[data-testid="chart--pr-cards-table"]');
      const rows = cardRows();
      table.columns = CARD_COLUMNS;
      table.rows = rows;
      table.setAttribute('state', rows.length ? 'ready' : 'empty');
      // The footnote explains the Preview column. With no rows there is no
      // column to explain, and it reads as a caption to the empty state.
      host.querySelector('[data-pr-cards-note]').hidden = !rows.length;

      // <ui-tabs> hides and shows panels from its own click handler, which has
      // not run on a fresh paint — the first render has to set the state that
      // matches the tab the strip is already showing.
      syncPanels();
    }

    /* --- The card form ------------------------------------------------------
       Opened blank by Upload Card and filled by a row's Replace. Filling it
       is the whole reason Replace is not just a flash: the desk is replacing
       ONE side of ONE card, and a dialog that made them say which again would
       be asking a question the row it was opened from already answered. */

    function openCardForm(row, trigger) {
      const modal = host.querySelector('#prCardModal');
      const set = (testid, value) => {
        const field = host.querySelector(`[data-testid="${testid}"]`);
        if (field) field.value = value ?? '';
      };

      modal.setAttribute('heading', row ? 'Replace Card Image' : 'Add Card');
      set('chart--pr-card-type', row ? row.type : 'Insurance');
      set('chart--pr-card-side', row ? (row.side === 'front' ? 'Front' : 'Back') : 'Front');
      set('chart--pr-card-issuer', row ? row.issuer : '');
      set('chart--pr-card-number', row && row.number !== '—' ? row.number : '');
      set('chart--pr-card-effective', row ? row.effectiveIso : '');
      /* `text`, not .textContent — setting textContent on a <ui-button> wipes
         the <button> the component rendered into itself, and the control
         stops being clickable. The component owns this swap; see the note by
         `visible` in js/components/ui-button.js. */
      host
        .querySelector('[data-testid="chart--pr-card-save"]')
        .setAttribute('text', row ? 'Replace Card' : 'Add Card');
      modal.open(trigger);
    }

    function openCardView(row, trigger) {
      const payer = payers[row.payerIndex];
      const modal = host.querySelector('#prCardViewModal');
      modal.setAttribute(
        'heading',
        `${payer.name} — ${row.side === 'front' ? 'Front' : 'Back'} Side`
      );
      host.querySelector('#prCardViewBody').innerHTML =
        `<div class="fs__scans">${cardScan(payer, row.side, { caption: false })}</div>
         <p class="fs__scan-note">Drawn from the policy record — no card scan has been uploaded.</p>`;
      modal.open(trigger);
    }

    function syncPanels() {
      for (const value of Object.keys(TAB_ACTIONS)) {
        const panel = host.querySelector(`#panel-${value}`);
        if (panel) panel.hidden = value !== activeTab;
        const button = head?.querySelector(`[data-testid="${TAB_ACTIONS[value]}"]`);
        if (button) button.hidden = value !== activeTab;
      }
    }

    function onTabChange(event) {
      if (!event.target.closest('[data-testid="chart--pr-tabs"]')) return;
      activeTab = event.detail.value;
      syncPanels();
    }

    /* Every action on this screen is a stub, and each says what it WOULD have
       done rather than what it cannot do — a button that answers "not
       supported" tells the person nothing about the record in front of them. */
    const STUBS = [
      ['[data-testid="chart--pr-edit"]', 'Editing registration details from the chart is not wired up in this prototype yet.'],
      ['[data-testid="chart--pr-add-insurance"]', 'Adding a policy from Profile is not wired up in this prototype yet.'],
    ];

    function onUiClick(event) {
      const match = STUBS.find(([selector]) => event.target.closest(selector));
      if (match) ctx.flash(match[1]);
    }

    /* Upload Card is the only head action that does something rather than
       saying it cannot: it opens the form. The other two still stub. */
    function onHeadUiClick(event) {
      if (event.target.closest('[data-testid="chart--pr-upload-card"]')) {
        openCardForm(null, event.target.closest('ui-button'));
        return;
      }
      onUiClick(event);
    }

    /** The "⋮" at the end of a card row. */
    function onCardMenu(event) {
      const trigger = event.target.closest('[data-pr-card-menu]');
      if (!trigger) return;
      const row = cardRows().find((r) => r.id === trigger.dataset.prCardMenu);
      if (!row) return;

      openRowMenu(trigger, [
        { label: 'View card', icon: 'eye', run: () => openCardView(row, trigger) },
        { label: 'Replace image', icon: 'upload', run: () => openCardForm(row, trigger) },
        { divider: true },
        {
          label: 'Remove',
          icon: 'trash',
          danger: true,
          /* Not a real delete. The row is a SIDE of a policy on file, not a
             record of its own — removing it would have to remove the policy,
             which is not what the desk means when they say the back of this
             card is the wrong one. */
          run: () =>
            ctx.flash('Removing a card image is not wired up in this prototype yet.'),
        },
      ]);
    }

    function onCardSave() {
      ctx.flash('Filing a card image is not wired up in this prototype yet.');
      host.querySelector('#prCardModal').close();
    }

    function onClick(event) {
      if (event.target.closest('[data-pr-card-menu]')) {
        onCardMenu(event);
      } else if (event.target.closest('[data-testid="chart--pr-card-save"]')) {
        onCardSave();
      } else if (event.target.closest('[data-pr-make-primary]')) {
        ctx.flash('Changing the coverage order from Profile is not wired up in this prototype yet.');
      } else if (event.target.closest('[data-pr-edit-insurance]')) {
        ctx.flash('Editing a policy from Profile is not wired up in this prototype yet.');
      }
    }

    // The tab strip and the buttons are rendered by the shell into the module
    // head, a sibling of this host — same arrangement as Allergies' action.
    head?.addEventListener('ui-change', onTabChange);
    head?.addEventListener('ui-click', onHeadUiClick);
    host.addEventListener('click', onClick);
    paint();

    return () => {
      head?.removeEventListener('ui-change', onTabChange);
      head?.removeEventListener('ui-click', onHeadUiClick);
      host.removeEventListener('click', onClick);
      // A panel anchored to a row that is about to be torn out of the
      // document has to go with it.
      closeRowMenu();
    };
  },
});
