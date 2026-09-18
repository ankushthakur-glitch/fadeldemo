/**
 * PAGINATION — the footer under a paged table in the portal.
 *
 * The billing tables carried no pager for a while, and the reasoning at the
 * time was sound for the data that was there: five statements are not a list
 * anybody pages through, and a ten-page control under five rows is a control
 * with nothing to do. What changed is the data. Billing is the one place in
 * the portal where the record only ever grows — every visit adds a statement
 * and, sooner or later, a payment — so a patient who has been with the clinic
 * two years arrives at a table hundreds of rows long. That is the case the
 * screen has to be built for, not the case a fixture happened to hold.
 *
 * This owns the page arithmetic, the footer markup and the wording, so two
 * paged tables cannot drift into disagreeing about what "page 2" means or
 * spelling the range label two different ways. A screen owns its data and
 * hands over a total:
 *
 *   const pager = createPager(document.getElementById('foot'), {
 *     noun: 'statements',
 *     onChange: paint,
 *   });
 *
 *   function paint() {
 *     const { start, end } = pager.render(STATEMENTS.length);
 *     body.innerHTML = STATEMENTS.slice(start, end).map(row).join('');
 *   }
 *
 * render() returns this page's slice bounds, so a screen never computes an
 * offset itself — the commonest place for the footer and the rows underneath
 * it to stop describing the same thing.
 *
 * This is a portal-side twin of the EHR's js/lib/pagination.js, not a shared
 * module: the two products keep separate token sets and separate class
 * prefixes, and `patient/` is deployed on its own. The arithmetic is the same
 * on purpose — if the windowing rule changes in one, change it in both.
 */

import { icon } from './icons.js';

/** What the rows-per-page dropdown offers. Ten is a screenful in the portal. */
export const ROWS_PER_PAGE = [10, 25, 50];

export const DEFAULT_ROWS_PER_PAGE = 10;

/*
 * How many numbered buttons before the run is windowed to first … current … last.
 *
 * Seven keeps first, last and the current page's neighbours reachable in one
 * click in every case, and is the point past which the row starts pushing the
 * rows-per-page control off a laptop screen.
 */
const MAX_PAGE_BUTTONS = 7;

/**
 * Build the footer inside `host` and return a controller.
 *
 * options:
 *   rowsPerPage   starting page size (default 10)
 *   rowSizes      the dropdown's own options (default ROWS_PER_PAGE)
 *   noun          what a row is, for the range label (default 'rows'). Say it
 *                 in the patient's words — "statements", "payments" — because
 *                 the range label is the one sentence on the screen that
 *                 tells them how much of their own history they are looking at
 *   testidPrefix  data-testid stem, e.g. 'statements' → 'statements--range'
 *   onChange      called after the page or the page size changes
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
  const selectId = `${testidPrefix || 'pp'}-rows-per-page`;

  let page = 1;
  let size = rowsPerPage;
  let noun = initialNoun;

  host.classList.add('pp-pager');
  host.innerHTML = `
    <span class="pp-pager__range"${testid('range')}></span>
    <label class="pp-pager__rows-label" for="${selectId}">Rows per page</label>
    <span class="pp-control pp-control--icon pp-pager__rows">
      <select class="pp-select" id="${selectId}"${testid('rows-per-page')}>
        ${rowSizes
          .map((n) => `<option${n === size ? ' selected' : ''}>${n}</option>`)
          .join('')}
      </select>
      <span class="pp-control__icon">${icon('chevron-down')}</span>
    </span>
    <nav class="pp-pager__pages" aria-label="Pagination"${testid('pages')}></nav>`;

  const rangeEl = host.querySelector('.pp-pager__range');
  const sizeEl = host.querySelector('.pp-select');
  const pagesEl = host.querySelector('.pp-pager__pages');

  sizeEl.addEventListener('change', () => {
    size = Number(sizeEl.value);
    // Changing the page size while deep in a list would otherwise land on a
    // page that no longer exists, and the table would draw empty.
    page = 1;
    onChange();
  });

  /*
   * Delegated, so the buttons can be rebuilt on every render without
   * re-binding — and without leaking a listener per page change.
   */
  pagesEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    onChange();
    // The pressed button is replaced by the repaint. Put the keyboard on the
    // page that is now current rather than dropping focus to <body>, which
    // would send the next Tab back to the top of the document.
    pagesEl.querySelector('.pp-pager__page--current')?.focus();
  });

  function pageButton(label, target, opts = {}) {
    return `<button type="button" class="pp-pager__page${
      opts.current ? ' pp-pager__page--current' : ''
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

    /** Rename what a row is. Set before render(). */
    setNoun(text) {
      noun = text || initialNoun;
    },

    /**
     * Draw the footer for a set of `total` rows and return this page's bounds.
     *
     * The page is clamped here rather than at the click, so a set that shrinks
     * underneath the table — a filter, a payment that settles — cannot strand
     * the reader on a page past the end with nothing on it and no way back.
     */
    render(total) {
      const totalPages = Math.max(1, Math.ceil(total / size));
      page = Math.min(Math.max(1, page), totalPages);

      const start = (page - 1) * size;
      const end = Math.min(start + size, total);

      rangeEl.textContent = total
        ? `${start + 1}–${end} of ${total} ${noun}`
        : `No ${noun}`;

      /*
       * One page is not a choice. A single disabled button flanked by two
       * disabled arrows is a control that exists only to be greyed out, so
       * the whole run goes and the range label carries the footer on its own.
       */
      pagesEl.innerHTML =
        totalPages === 1
          ? ''
          : pageButton(icon('chevron-left'), page - 1, {
              disabled: page === 1,
              label: 'Previous page',
            }) +
            pageNumbers(totalPages).join('') +
            pageButton(icon('chevron-right'), page + 1, {
              disabled: page === totalPages,
              label: 'Next page',
            });

      return { start, end, page, totalPages };
    },
  };

  /**
   * The numbered run, windowed once it would exceed MAX_PAGE_BUTTONS.
   *
   * First and last stay reachable in one click; the gap is inert text, never
   * a button that looks pressable and is not.
   */
  function pageNumbers(totalPages) {
    const numbered = (n) => pageButton(String(n), n, { current: n === page });
    const gap = '<span class="pp-pager__gap" aria-hidden="true">…</span>';

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
