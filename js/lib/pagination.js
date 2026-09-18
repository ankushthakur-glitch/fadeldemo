/**
 * PAGINATION
 *
 * One pager for every paged table in the system. Screens own their data and
 * their filtering; this owns the page maths, the footer markup and the
 * wording, so those cannot drift apart again.
 *
 *   const pager = createPager(document.getElementById('foot'), {
 *     onChange: () => paint(),
 *   });
 *
 *   function paint() {
 *     const rows = filtered();
 *     const { start, end } = pager.render(rows.length);
 *     table.rows = rows.slice(start, end);
 *   }
 *
 * render() returns the slice bounds for the current page, so a screen never
 * computes an offset itself — the commonest place for two lists to disagree
 * about what "page 2" means.
 */
import { iconMarkup } from './icons.js';

/** MediNova's directory offers these four. Every table now offers the same. */
export const ROWS_PER_PAGE = [10, 15, 25, 50];

export const DEFAULT_ROWS_PER_PAGE = 15;

/*
 * How many numbered buttons before the run is windowed to first … current … last.
 *
 * The directory has three pages and always showed all of them. Master has
 * forty-two codes, and at ten a page that is five — still fine. Seven is the
 * point where the row starts to push the rows-per-page control off a laptop
 * screen, and it keeps first/last/current visible in every case.
 */
const MAX_PAGE_BUTTONS = 7;

/**
 * Build the footer inside `host` and return a controller.
 *
 * options:
 *   rowsPerPage   starting page size (default 15)
 *   rowSizes      the page-size dropdown's own options (default ROWS_PER_PAGE) —
 *                 an enterprise list running to the hundreds wants 50/100/250,
 *                 not the same four values a fifteen-row directory offers
 *   noun          what a row is, for the range label (default 'rows')
 *   testidPrefix  data-testid stem, e.g. 'directory' → 'directory--range'
 *   onChange      called after the page or page size changes
 */
export function createPager(host, options = {}) {
  const {
    rowsPerPage = DEFAULT_ROWS_PER_PAGE,
    rowSizes = ROWS_PER_PAGE,
    noun: initialNoun = 'rows',
    testidPrefix = '',
    onChange = () => {},
  } = options;

  const testid = (name) => (testidPrefix ? ` data-testid="${testidPrefix}--${name}"` : '');
  const selectId = `${testidPrefix || 'ui'}-rows-per-page`;

  let page = 1;
  let size = rowsPerPage;
  let suffix = '';
  let noun = initialNoun;

  host.classList.add('ui-pager');
  host.innerHTML = `
    <span class="ui-pager__range"${testid('range')}></span>
    <label class="ui-pager__rows-label" for="${selectId}">Rows per page:</label>
    <span class="ui-select-shell">
      <select id="${selectId}" class="ui-pager__rows"${testid('rows-per-page')}>
        ${rowSizes.map(
          (n) => `<option${n === size ? ' selected' : ''}>${n}</option>`
        ).join('')}
      </select>
      ${iconMarkup('caret-down')}
    </span>
    <nav class="ui-pager__pages" aria-label="Pagination"${testid('pages')}></nav>`;

  const rangeEl = host.querySelector('.ui-pager__range');
  const sizeEl = host.querySelector('.ui-pager__rows');
  const pagesEl = host.querySelector('.ui-pager__pages');

  sizeEl.addEventListener('change', () => {
    size = Number(sizeEl.value);
    // Changing the page size while deep in a list would otherwise land on a
    // page that no longer exists and render an empty table.
    page = 1;
    onChange();
  });

  // Delegated, so the buttons can be rebuilt on every render without
  // re-binding — and without leaking a listener per page change.
  pagesEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    onChange();
    // The pressed button is replaced by the repaint; keep the keyboard on the
    // page that is now current rather than dropping focus to <body>.
    pagesEl.querySelector('.ui-pager__page--current')?.focus();
  });

  function pageButton(label, target, opts = {}) {
    return `<button type="button" class="ui-pager__page${
      opts.current ? ' ui-pager__page--current' : ''
    }" data-page="${target}"${opts.disabled ? ' disabled' : ''}${
      opts.label ? ` aria-label="${opts.label}"` : ''
    }${opts.current ? ' aria-current="page"' : ''}>${label}</button>`;
  }

  return {
    get page() {
      return page;
    },
    get rowsPerPage() {
      return size;
    },

    /** Back to page one — call whenever a filter or a sort changes the set. */
    reset() {
      page = 1;
    },

    /**
     * Extra text after the count, e.g. "· 3 selected". Set before render().
     * Kept out of the range string itself so the "N of M rows" half stays
     * identical everywhere, whatever a screen wants to add after it.
     */
    setSuffix(text) {
      suffix = text ? ` · ${text}` : '';
    },

    /**
     * Rename what a row is. Set before render().
     *
     * One footer can serve several lists — a screen whose tab swaps claims for
     * encounters for ERAs keeps the same pager instance, and a noun fixed at
     * construction then reports "24 claims" over a table of encounters. The
     * count is the one thing a footer exists to say; it has to say it about
     * the right thing.
     */
    setNoun(text) {
      noun = text || initialNoun;
    },

    /**
     * Draw the footer for a set of `total` rows and return this page's bounds.
     * Clamps the page, so a filter that shrinks the list cannot strand the
     * table on a page past the end.
     */
    render(total) {
      const totalPages = Math.max(1, Math.ceil(total / size));
      page = Math.min(Math.max(1, page), totalPages);

      const start = (page - 1) * size;
      const end = Math.min(start + size, total);

      rangeEl.textContent = total
        ? `${start + 1}-${end} of ${total} ${noun}${suffix}`
        : `No ${noun}`;

      pagesEl.innerHTML =
        pageButton(iconMarkup('caret-left'), page - 1, {
          disabled: page === 1,
          label: 'Previous page',
        }) +
        pageNumbers(totalPages).join('') +
        pageButton(iconMarkup('caret-right'), page + 1, {
          disabled: page === totalPages,
          label: 'Next page',
        });

      return { start, end, page, totalPages };
    },
  };

  /**
   * The numbered run, windowed once it would exceed MAX_PAGE_BUTTONS.
   * First and last are always reachable in one click; the gap is inert text,
   * never a button that looks pressable but is not.
   */
  function pageNumbers(totalPages) {
    const numbered = (n) => pageButton(String(n), n, { current: n === page });
    const gap = '<span class="ui-pager__gap" aria-hidden="true">…</span>';

    if (totalPages <= MAX_PAGE_BUTTONS) {
      return Array.from({ length: totalPages }, (_, i) => numbered(i + 1));
    }

    // Two neighbours each side of the current page, plus first and last, plus
    // up to two gaps — MAX_PAGE_BUTTONS wide at its widest.
    const window = new Set([1, totalPages, page]);
    for (let offset = 1; offset <= 2; offset += 1) {
      if (page - offset > 1) window.add(page - offset);
      if (page + offset < totalPages) window.add(page + offset);
    }

    const shown = [...window].sort((a, b) => a - b);
    const out = [];
    shown.forEach((n, i) => {
      if (i > 0 && n - shown[i - 1] > 1) out.push(gap);
      out.push(numbered(n));
    });
    return out;
  }
}
