/**
 * PROFILE → CARD DETAILS
 *
 * The cards on file, and the popup that adds one.
 *
 * IT WAS A BILLING TAB. Nothing about the table changed in moving it; only
 * where it is reached from. A saved card is a thing the patient keeps on file
 * about themselves, beside the insurance policy that pays with it — Billing is
 * the two views of money that actually moved. See lib/profile-tabs.js.
 *
 * ADD CARD RIDES THE TAB BAR, like Add Insurance one tab over. It sat in a row
 * of its own between the strip and the table, right-aligned against nothing,
 * which spent a band of height on one button.
 *
 * ⚠ THE MASKING IS DONE HERE, from a stored last-four, and the full number the
 * form takes never survives the submit that reads it — see cardFacts() below
 * and the note on addCard() in data/billing.js. Nothing in this prototype ever
 * holds a string shaped like a card number.
 */

import { mountShell } from '../lib/shell.js';
import { profileTabs } from '../lib/profile-tabs.js';
import { icon } from '../lib/icons.js';
import { esc } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { CARDS, addCard } from '../../data/billing.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!mountShell({ active: 'profile' })) return;

  // Solid, like Add Insurance and unlike Profile's two: adding a card is the
  // one thing this tab is for, which is what a filled button means. Full
  // height, to stand level with the tab group beside it.
  profileTabs(document.getElementById('tabs'), 'cards', {
    actions: `
      <button type="button" class="pp-btn pp-btn--primary" id="addCard"
        data-testid="cards--add">
        ${icon('plus', { size: 'sm' })}
        <span>Add Card</span>
      </button>
    `,
  });

  const body = document.getElementById('rows');
  paint(body);

  body.addEventListener('click', (event) => {
    const menu = event.target.closest('[data-menu]');
    if (!menu) return;
    const card = CARDS.find((entry) => entry.id === menu.dataset.menu);
    toast(
      `This would offer Set as default, Edit and Remove for the card ending ${card.last4}.`
    );
  });

  document.getElementById('addCard').addEventListener('click', openModal);
  wireModal(body);
});

/* ============================================================================
   THE TABLE
   ========================================================================= */

function paint(body) {
  body.innerHTML = CARDS.map(row).join('');
}

function row(card) {
  return `
    <tr>
      <td>
        <span class="pp-card-number">
          <span class="pp-brandmark" aria-hidden="true">${esc(card.brand)}</span>
          <span>
            <span aria-hidden="true">**** **** **** ${esc(card.last4)}</span>
            <span class="pp-sr-only">${esc(card.brand)} card ending ${esc(card.last4)}</span>
          </span>
        </span>
      </td>
      <td>${esc(card.expires)}</td>
      <td>
        <span class="pp-badge pp-badge--${card.active ? 'ok' : 'bad'}"
          >${card.active ? 'Active' : 'Inactive'}</span>
      </td>
      <td class="pp-table__action">
        <button type="button" class="pp-btn pp-btn--quiet pp-btn--icon pp-btn--sm"
          data-menu="${esc(card.id)}"
          aria-label="Actions for the card ending ${esc(card.last4)}">
          ${icon('kebab', { size: 'sm' })}
        </button>
      </td>
    </tr>`;
}

/* ============================================================================
   THE ADD POPUP

   Add Card raised a toast describing what it would do, back when this was a
   Billing tab. It opens the dialog in profile-cards.html now, and a card
   added there joins the table — in memory, like every other fixture.
   ========================================================================= */

function fields() {
  return {
    modal: document.getElementById('cardModal'),
    form: document.getElementById('cardForm'),
    name: document.getElementById('cardName'),
    number: document.getElementById('cardNumber'),
    expiry: document.getElementById('cardExpiry'),
    cvv: document.getElementById('cardCvv'),
    errors: {
      name: document.getElementById('cardNameError'),
      number: document.getElementById('cardNumberError'),
      expiry: document.getElementById('cardExpiryError'),
      cvv: document.getElementById('cardCvvError'),
    },
  };
}

function wireModal(body) {
  const el = fields();
  if (!el.modal) return;

  document.getElementById('closeCard').addEventListener('click', () => el.modal.close());
  document.getElementById('cancelCard').addEventListener('click', () => el.modal.close());

  // The <dialog> itself is the backdrop's hit target; a click on the panel
  // arrives from a child, which is what separates the two.
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) el.modal.close();
  });

  // A message clears when the field it is about is being fixed, not on the
  // next submit. Being told what is wrong while you correct it is noise.
  Object.entries(el.errors).forEach(([key, slot]) => {
    el[key].addEventListener('input', () => {
      if (!el[key].hasAttribute('aria-invalid')) return;
      el[key].removeAttribute('aria-invalid');
      slot.hidden = true;
      slot.textContent = '';
    });
  });

  /*
   * The number is spaced into groups of four as it is typed.
   *
   * Sixteen unbroken digits cannot be checked by eye against the card in the
   * patient's hand, and this is the one field where a single wrong digit is
   * silent until a payment fails. The value is regrouped, not validated —
   * anything that is not a digit is simply dropped.
   */
  el.number.addEventListener('input', () => {
    const digits = el.number.value.replace(/\D/g, '').slice(0, 19);
    el.number.value = digits.replace(/(.{4})/g, '$1 ').trim();
  });

  el.cvv.addEventListener('input', () => {
    el.cvv.value = el.cvv.value.replace(/\D/g, '').slice(0, 4);
  });

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(body, el);
  });
}

function openModal() {
  const el = fields();

  el.form.reset();
  Object.entries(el.errors).forEach(([key, slot]) => {
    el[key].removeAttribute('aria-invalid');
    slot.hidden = true;
  });

  el.modal.showModal();
  el.name.focus();
}

function submit(body, el) {
  const digits = el.number.value.replace(/\D/g, '');
  const problems = [];

  if (!el.name.value.trim()) problems.push(['name', 'Give the name printed on the card.']);

  // Thirteen to nineteen digits covers every network in use; the shortest
  // real numbers are 13 and the longest are 19. A stricter check belongs to
  // the payment provider, which is the only party that can say whether a
  // number is a card rather than merely the right length.
  if (digits.length < 13 || digits.length > 19) {
    problems.push(['number', 'A card number is 13 to 19 digits.']);
  }

  if (!el.expiry.value) problems.push(['expiry', 'Give the month the card expires.']);
  if (el.cvv.value.length < 3) problems.push(['cvv', 'The CVV is 3 digits, or 4 on Amex.']);

  if (problems.length) {
    problems.forEach(([key, message]) => {
      el[key].setAttribute('aria-invalid', 'true');
      el.errors[key].textContent = message;
      el.errors[key].hidden = false;
    });
    el[problems[0][0]].focus();
    return;
  }

  /*
   * ⚠ THE ONLY PLACE A WHOLE CARD NUMBER EXISTS, and it ends here.
   *
   * Two facts are taken off it and the rest is dropped: what is passed on is
   * a brand and four digits, and addCard() has no parameter that would accept
   * anything more. The CVV is read to check its length and never leaves this
   * function.
   */
  const card = addCard({
    ...cardFacts(digits),
    expires: monthLabel(el.expiry.value),
  });

  paint(body);
  el.modal.close();
  toast(`Card ending ${card.last4} added.`, 'ok');
}

/* ============================================================================
   READING A CARD NUMBER — and keeping almost none of it
   ========================================================================= */

/**
 * The brand and the last four, which is everything the portal stores.
 *
 * The brand comes from the leading digits, the way every checkout does it:
 * the first digit is the issuer's industry and 4/5/3/6 are the four networks
 * this practice sees. It is a LABEL, not a verification — .pp-brandmark is a
 * neutral plate with the name set in it, and the provider is the one that
 * decides whether a number is really a card.
 */
function cardFacts(digits) {
  return { brand: brandOf(digits), last4: digits.slice(-4) };
}

function brandOf(digits) {
  if (digits.startsWith('4')) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (digits.startsWith('6')) return 'DISCOVER';
  return 'CARD';
}

/** '2027-09' from the month input → 'Sep-27', as the table prints it. */
function monthLabel(value) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = value.split('-');
  return `${MONTHS[Number(month) - 1]}-${year.slice(2)}`;
}
