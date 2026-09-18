/**
 * BILLING → STATEMENTS
 *
 * A statement per provider, with the balance and a way to pay it. The date is
 * the link, not the provider's name: the date is what identifies one
 * statement from another when the same provider has issued several.
 *
 * PAGED, AND THE PAGER IS THE BOTTOM OF THE CARD. This screen ran without one
 * for a while — five statements are not a list anybody pages through, and the
 * ten-page control the design drew under them was a control with nothing to
 * do. What was wrong with that reasoning is that it was about the fixture and
 * not about the screen: billing only ever grows, so the real reader of this
 * table is somebody two years into the practice looking at a hundred rows.
 * data/billing.js now holds that reader's history, and lib/pagination.js
 * carries the page maths and the wording.
 *
 * The card fills the well rather than being sized by its rows, so the pager
 * sits at the same place on the screen whatever the page happens to hold; the
 * rows scroll inside it against a stuck header. See css/screen-billing.css.
 */

import { mountShell } from '../lib/shell.js';
import { billingTabs } from '../lib/billing-tabs.js';
import { createPager } from '../lib/pagination.js';
import { esc, money } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { STATEMENTS } from '../../data/billing.js';

document.addEventListener('DOMContentLoaded', () => {
  const mounted = mountShell({ active: 'billing' });
  if (!mounted) return;

  billingTabs(document.getElementById('tabs'), 'statements');

  const body = document.getElementById('rows');

  /* "1–10 of 23 statements", not "of 23 rows". The range label is the one
     sentence on the screen that tells a patient how much of their own billing
     history is behind the page they are looking at. */
  const pager = createPager(document.getElementById('foot'), {
    noun: 'statements',
    testidPrefix: 'statements',
    onChange: paint,
  });

  paint();

  /* The pager hands back this page's slice bounds rather than a page number,
     so the offset is never computed here — see lib/pagination.js. */
  function paint() {
    const { start, end } = pager.render(STATEMENTS.length);

    body.innerHTML = STATEMENTS.slice(start, end)
      .map(
        (statement) => `
    <tr>
      <td>${esc(statement.provider)}</td>
      <td><a href="#" data-open="${esc(statement.id)}">${esc(statement.generated)}</a></td>
      <td>${esc(money(statement.balance))}</td>
      <td class="pp-table__action">
        <button type="button" class="pp-btn pp-btn--primary pp-btn--sm"
          data-pay="${esc(statement.id)}">Make Payment</button>
      </td>
    </tr>`
      )
      .join('');
  }

  /* Bound once, on the <tbody> that survives every repaint — a listener per
     row would have to be rebuilt on every page change, and one of those
     rebuilds is where the leak gets in. */
  body.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open]');
    if (open) {
      event.preventDefault();
      const statement = STATEMENTS.find((entry) => entry.id === open.dataset.open);
      return void toast(`This would open the statement from ${statement.generated}.`);
    }

    const pay = event.target.closest('[data-pay]');
    if (pay) {
      const statement = STATEMENTS.find((entry) => entry.id === pay.dataset.pay);
      toast(
        `This would take a payment of ${money(statement.balance)} to ${statement.provider}.`
      );
    }
  });
});
