/**
 * PROFILE → INSURANCE
 *
 * Primary and secondary cover, each with its plan identifiers and its card
 * scans, plus the Add / Edit Insurance popup.
 *
 * It was a fourth Billing tab. Nothing about the screen changed in moving it;
 * only where it is reached from — a policy is a fact about the patient, not a
 * way of paying a bill. See lib/profile-tabs.js.
 *
 * EACH PLAN IS ITS OWN PANEL, with a named head strip carrying its buttons.
 * The two used to be bands inside one card, divided by a rule, which left the
 * rank heading ("Primary") floating over a block of pairs with no boundary of
 * its own — on a screen whose entire job is telling two near-identical
 * policies apart. A head and a body per plan is what the reference draws.
 *
 * THE IDENTIFIERS RUN ACROSS, NOT DOWN. Six label-over-value columns divided
 * by hairlines, on one line. They were a two-up <dl> — label beside value,
 * three rows deep — which put six short facts in a column half the width of
 * the panel and left the other half empty, twice over. Across, the whole
 * policy is one glance and the panel is three rows shorter.
 *
 * ADD INSURANCE MOVED INTO THE TAB BAR, with the tabs and the section name,
 * for the same reason Profile's two buttons did: a row of its own for one
 * button is a band of height spent on nothing.
 *
 * THE CARD SLOTS ARE REAL, AND THEY ARE READ-ONLY HERE. They take a
 * photograph, a scan or a PDF — but in the popup, which is where the rest of
 * the policy is edited too. This screen shows what is on file. It carried the
 * upload buttons as well until now, which gave one plan two places to change
 * it and made the tab read as a form; a record and the form that edits it are
 * not the same screen. The slot itself is lib/card-scans.js and the images
 * live in data/insurance-cards.js — read that header before touching either,
 * because what is being stored is a member ID and a name.
 */

import { mountShell } from '../lib/shell.js';
import { profileTabs } from '../lib/profile-tabs.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { cardSlotsMarkup, wireCardSlots } from '../lib/card-scans.js';
import { reassignScans } from '../../data/insurance-cards.js';
import { INSURANCE } from '../../data/billing.js';

/** The plan the dialog is editing, or null when it is adding. */
let editing = null;

/**
 * The id a brand-new plan's card images are attached to before it is saved.
 *
 * The images are chosen before the plan exists, so they need somewhere to go
 * in the meantime. On save they are moved to the real id — see
 * reassignScans().
 */
const DRAFT_PLAN_ID = 'ins-draft';

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell({ active: 'profile' })) return;

  // Add Insurance rides in the tab bar, on the line with the tabs and the
  // section name — the row it used to have to itself held one button. Full
  // height, to stand level with the tab group beside it. It stays SOLID: adding a
  // policy is the one thing this tab is for, which is what a filled button
  // means and is why Profile's two are not.
  profileTabs(document.getElementById('tabs'), 'insurance', {
    actions: `
      <button type="button" class="pp-btn pp-btn--primary" id="addInsurance"
        data-testid="insurance--add">
        ${icon('plus', { size: 'sm' })}
        <span>Add Insurance</span>
      </button>
    `,
  });

  const host = document.getElementById('plans');
  paint(host);

  host.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    if (edit) {
      openModal(INSURANCE.find((entry) => entry.id === edit.dataset.edit));
      return;
    }

    const promote = event.target.closest('[data-primary]');
    if (!promote) return;

    /*
     * Making one plan primary demotes the other.
     *
     * A BUTTON, and only on the plan that is not primary — it was a "Make
     * Primary" radio on both. A radio pair is for choosing between options
     * that are both still on offer; this is one plan being promoted, the
     * other plan's demotion follows from it, and the plan that already holds
     * the rank has nothing to offer. The reference draws the same: Set as
     * Primary appears once, on the secondary panel.
     *
     * Done in the data rather than by moving a dot, because the heading on
     * each panel ("Primary Insurance" / "Secondary Insurance") has to move
     * with it. A screen where the control says one thing and the heading
     * above it says another is the exact confusion this control prevents.
     */
    INSURANCE.forEach((plan) => {
      plan.primary = plan.id === promote.dataset.primary;
      plan.rank = plan.primary ? 'Primary' : 'Secondary';
    });

    paint(host);
    const chosen = INSURANCE.find((plan) => plan.primary);
    toast(`${chosen.insurer} is now your primary cover.`, 'ok');

    /*
     * Focus went with the redrawn markup, and the button that was pressed no
     * longer exists — the plan it promoted does not offer it any more. So it
     * lands on that plan's Edit button: the same panel, the nearest control,
     * rather than dropping a keyboard user at the top of the page.
     */
    host.querySelector(`[data-edit="${CSS.escape(chosen.id)}"]`)?.focus();
  });

  document.getElementById('addInsurance').addEventListener('click', () => openModal(null));
  wireModal(host);
});

/* ============================================================================
   THE PLANS
   ========================================================================= */

function paint(host) {
  // Primary first, whichever it is. The order carries meaning here.
  const ordered = [...INSURANCE].sort((a, b) => Number(b.primary) - Number(a.primary));
  host.innerHTML = ordered.map(plan).join('');
}

/**
 * Redraw one plan's two slots, leaving the rest of the screen alone.
 *
 * Called while the dialog is open, so the cards behind it are already right
 * when it closes. A full paint() would rebuild the head strips and the fact
 * rows as well and would take focus off the control the patient is using.
 */
function repaintSlots(host, planId) {
  const wrap = host.querySelector(`[data-card-slots="${CSS.escape(planId)}"]`);
  if (!wrap) return;
  wrap.outerHTML = cardSlotsMarkup(planId, { readonly: true });
}

/**
 * One policy: a head strip that names its rank and carries its buttons, a row
 * of identifiers, and the two card scans.
 *
 * THE IDENTIFIERS ARE A <dl> OF PAIRS WRAPPED IN <div>s, not a bare run of
 * dt/dd. The row is a grid of six columns with a hairline between each, so
 * each pair has to be one grid item — and <div> inside <dl> is the one
 * grouping HTML allows there, which keeps it a description list to a screen
 * reader rather than a table of divs pretending to be one.
 */
function plan(entry) {
  return `
    <section class="pp-card pp-plan" data-testid="insurance--plan">
      <header class="pp-card__head pp-plan__head">
        <h2 class="pp-card__title">${esc(entry.rank)} Insurance</h2>

        <div class="pp-plan__controls">
          ${entry.primary ? '' : setPrimary(entry)}

          <!-- Edit was a bare text link, which made it the one edit control in
               the portal that did not look like the others — and it opens a
               dialog rather than going anywhere, so a link with href="#" was
               the wrong element for it as well. -->
          <button type="button" class="pp-btn pp-btn--outline pp-btn--sm"
            data-edit="${esc(entry.id)}"
            aria-label="Edit ${esc(entry.insurer)}"
            data-testid="insurance--edit">
            ${icon('edit', { size: 'sm' })}<span>Edit</span>
          </button>
        </div>
      </header>

      <div class="pp-card__body">
        <dl class="pp-facts" data-testid="insurance--plan-facts">
          ${fact('Insurance Name', entry.insurer)}
          ${fact('Insurance Plan', entry.planId)}
          ${fact('Member ID', entry.memberId)}
          ${fact('Group Number', entry.groupId)}
          ${fact('Insured Group Name', entry.groupName)}
          ${fact('Expiry Date', entry.expires)}
        </dl>

        <!--
          The two scans, and nothing above them but their own labels.

          A heading ("Insurance Card") and a paragraph explaining that a
          photograph saves the front desk copying the card out used to sit
          here, on both panels — two blocks of prose repeated per policy, on a
          screen that cannot accept an upload anyway. The place that needs the
          explanation is the popup, where the slots are live, and it is
          already there. See profile-insurance.html.
        -->
        <div class="pp-plan__scans">
          ${cardSlotsMarkup(entry.id, { readonly: true })}
        </div>
      </div>
    </section>
  `;
}

/**
 * Promote a policy — drawn only on the ones that are not already primary.
 *
 * Neutral rather than outlined, so the two buttons in a head strip are not
 * both asking for the same weight of attention: Edit is the one you came for.
 */
function setPrimary(entry) {
  return `
    <button type="button" class="pp-btn pp-btn--neutral pp-btn--sm"
      data-primary="${esc(entry.id)}"
      aria-label="Set ${esc(entry.insurer)} as primary"
      data-testid="insurance--set-primary">Set as Primary</button>
  `;
}

/** One label-over-value column in the identifier row. */
function fact(label, value) {
  return `
    <div class="pp-facts__item">
      <dt>${esc(label)}</dt>
      <dd>${esc(value || '—')}</dd>
    </div>`;
}

/* ============================================================================
   THE ADD / EDIT POPUP

   The markup has been in profile-insurance.html all along and nothing opened
   it — Add Insurance raised a toast describing what it would do. It opens now,
   for both jobs, with the card slots inside it so a plan and its images are
   added in one pass rather than in two.
   ========================================================================= */

function fields() {
  return {
    modal: document.getElementById('insuranceModal'),
    form: document.getElementById('insuranceForm'),
    title: document.getElementById('insuranceModalTitle'),
    submit: document.querySelector('[data-testid="insurance--submit"]'),
    order: document.getElementById('insOrder'),
    name: document.getElementById('insName'),
    memberId: document.getElementById('insMemberId'),
    planId: document.getElementById('insPlan'),
    groupName: document.getElementById('insGroupName'),
    groupNumber: document.getElementById('insGroupNumber'),
    end: document.getElementById('insEnd'),
    slots: document.getElementById('insCardSlots'),
    errors: {
      name: document.getElementById('insNameError'),
    },
  };
}

function wireModal(host) {
  const el = fields();
  if (!el.modal) return;

  document.getElementById('closeInsurance').addEventListener('click', () => el.modal.close());
  document.getElementById('cancelInsurance').addEventListener('click', () => el.modal.close());

  // The <dialog> element itself is the backdrop's hit target; a click on the
  // panel arrives from a child, which is what separates the two.
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) el.modal.close();
  });

  el.name.addEventListener('input', () => {
    if (!el.name.hasAttribute('aria-invalid')) return;
    el.name.removeAttribute('aria-invalid');
    el.errors.name.hidden = true;
    el.errors.name.textContent = '';
  });

  wireCardSlots(el.slots, {
    onChange: (planId) => {
      el.slots.innerHTML = cardSlotsMarkup(planId);
      // And the read-only pair on the screen behind the dialog, for a plan
      // that already has one. An image is stored the moment it is chosen, so
      // closing it with Cancel must not leave the tab showing a card
      // that is no longer there.
      repaintSlots(host, planId);
    },
  });

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(host, el);
  });
}

function openModal(entry) {
  const el = fields();
  editing = entry;

  el.title.textContent = entry ? 'Edit Insurance' : 'Add Insurance';
  el.submit.textContent = entry ? 'Save Insurance' : 'Add Insurance';

  el.name.value = entry?.insurer ?? '';
  el.memberId.value = entry?.memberId ?? '';
  el.planId.value = entry?.planId ?? '';
  el.groupName.value = entry?.groupName ?? '';
  el.groupNumber.value = entry?.groupId ?? '';
  el.order.value = entry?.rank ?? 'Primary';

  el.name.removeAttribute('aria-invalid');
  el.errors.name.hidden = true;

  // A plan being edited attaches images straight to itself; a new one uses
  // the draft id until it has one of its own.
  el.slots.innerHTML = cardSlotsMarkup(entry ? entry.id : DRAFT_PLAN_ID);

  el.modal.showModal();
  el.name.focus();
}

function submit(host, el) {
  const insurer = el.name.value.trim();

  if (!insurer) {
    el.name.setAttribute('aria-invalid', 'true');
    el.errors.name.textContent = 'Name the insurance company.';
    el.errors.name.hidden = false;
    el.name.focus();
    return;
  }

  const answers = {
    insurer,
    memberId: el.memberId.value.trim(),
    planId: el.planId.value.trim(),
    groupName: el.groupName.value.trim(),
    groupId: el.groupNumber.value.trim(),
  };

  if (editing) {
    Object.assign(editing, answers);
  } else {
    const id = `ins-${Date.now()}`;
    INSURANCE.push({
      id,
      rank: 'Secondary',
      primary: false,
      expires: el.end.value || '—',
      ...answers,
    });

    // The images were attached before the plan had an id. Move them onto it,
    // or they are stranded under 'ins-draft' and the new plan shows two empty
    // slots the patient has already filled.
    reassignScans(DRAFT_PLAN_ID, id);

    /*
     * Coverage order is re-derived rather than taken from the dialog's
     * select. The select offers Primary/Secondary/Tertiary; honouring
     * "Primary" here would need to demote whichever plan holds it, and the
     * screen already has one control for that — the radio on each card. Two
     * ways to set one thing is how they end up disagreeing.
     */
    if (el.order.value === 'Primary') {
      INSURANCE.forEach((entry) => {
        entry.primary = entry.id === id;
        entry.rank = entry.primary ? 'Primary' : 'Secondary';
      });
    }
  }

  paint(host);
  el.modal.close();
  toast(editing ? `${insurer} updated.` : `${insurer} added to your cover.`, 'ok');
  editing = null;
}
