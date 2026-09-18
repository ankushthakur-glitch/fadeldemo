/**
 * BILLING → PAYMENT HISTORY
 *
 * Read-only. Every row is something that already happened, so there is
 * nothing here to press — which is why this is the one billing table with no
 * action column.
 *
 * ⚠ The five designed rows include two that pair a success note with a Failed
 * status, and the history behind them repeats those notes. That is reproduced
 * from the design rather than corrected; the reasoning is in data/billing.js
 * above PAYMENTS.
 *
 * PAGED, for the same reason Statements is — and more so. A statement is
 * settled and gone; a payment is on the record for good, so this is the
 * longest-running list in the portal. See that screen, and lib/pagination.js.
 */

import { mountShell } from '../lib/shell.js';
import { billingTabs } from '../lib/billing-tabs.js';
import { createPager } from '../lib/pagination.js';
import { esc, money } from '../lib/format.js';
import { PAYMENTS } from '../../data/billing.js';

document.addEventListener('DOMContentLoaded', () => {
  const mounted = mountShell({ active: 'billing' });
  if (!mounted) return;

  billingTabs(document.getElementById('tabs'), 'payments');

  const body = document.getElementById('rows');

  const pager = createPager(document.getElementById('foot'), {
    noun: 'payments',
    testidPrefix: 'payments',
    onChange: paint,
  });

  paint();

  function paint() {
    const { start, end } = pager.render(PAYMENTS.length);

    body.innerHTML = PAYMENTS.slice(start, end)
      .map(
        (payment) => `
    <tr>
      <td>${esc(payment.processed)}</td>
      <td>${esc(payment.note)}</td>
      <td>${esc(money(payment.amount))}</td>
      <td>
        <span class="pp-badge pp-badge--${payment.status === 'Paid' ? 'ok' : 'bad'}"
          >${esc(payment.status)}</span>
      </td>
    </tr>`
      )
      .join('');
  }
});
