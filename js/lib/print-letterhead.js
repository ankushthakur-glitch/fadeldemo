/**
 * THE PRACTICE LETTERHEAD, ON EVERYTHING THAT PRINTS.
 *
 * WHAT WAS WRONG
 * The consent forms printed with the practice mark on them and nothing else
 * did. Everything else this product puts on paper — a filled-in patient form,
 * a check-in record, a controlled-drug count sheet, a referral, a complication
 * report, a schedule, any of the reporting screens — came out as anonymous
 * sheets with clinical facts on them. A document about a patient that cannot
 * say which practice produced it is a document nobody downstream can rely on,
 * and the fix is not "add a logo to the consent's neighbour" but "there is one
 * letterhead and everything wears it".
 *
 * WHY IT IS ONE ELEMENT AND NOT THIRTY EDITS
 * Every screen here prints by calling window.print() on itself and letting its
 * own @media print rules decide what survives onto the page. None of them
 * build a document; they restyle the one already on screen. So a single band
 * inserted at the top of <body> — hidden on screen, shown only on paper — is
 * above whatever any of them chose to print, on every screen at once, with no
 * screen having to know it exists. js/main.js is on all thirty-seven of them,
 * which is the whole of the wiring.
 *
 * WHERE THE CONTENT COMES FROM
 * Practice Settings → Print Configuration already answers "what is this
 * practice's letterhead": a logo, an alignment, and which facts off the
 * practice profile go under the name. This reads the configuration marked
 * default and renders that. Inventing a second answer here would mean an
 * administrator could change the letterhead in the one screen built for it and
 * watch every printed page ignore them.
 *
 * The facts are read from the profile rather than stored on the letterhead —
 * see the note at the top of data/print-config.js for why that matters.
 *
 * THE MARK IS AN <img>. Browsers suppress background images when printing by
 * default and print <img> regardless; a letterhead whose logo silently drops
 * out on paper is worse than one that was never added.
 */

import { PRINT_CONFIGS, PRACTICE_FIELD_INDEX } from '../../data/print-config.js';

const HOST_CLASS = 'print-letterhead';

/**
 * The configuration a document gets when nobody chose one — which, outside the
 * Print Configuration screen itself, is every document. Exactly one record is
 * flagged, but the fallback is there because a data file that lost its flag
 * should cost a practice its letterhead, not throw on every screen.
 */
function defaultConfig() {
  return PRINT_CONFIGS.find((config) => config.isDefault) || PRINT_CONFIGS[0] || null;
}

/**
 * Configurations store the logo the way the editor writes it — a path relative
 * to screens/, or a data: URL from an upload. This module is loaded from
 * js/lib/, and the pages that load it sit at two different depths, so a
 * relative path is re-resolved against this file rather than against whichever
 * page happens to be printing.
 */
function logoSrc(config) {
  const raw = config.logo;
  if (!raw) return null;
  if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
  return new URL(String(raw).replace(/^(?:\.{1,2}\/)+/, ''), new URL('../../', import.meta.url)).href;
}

/**
 * The line under the practice name.
 *
 * The address leads it whether or not the configuration asked for it: a
 * letterhead exists so that whoever holds the sheet can get back to the
 * practice, and the fields a configuration names — phone, fax, NPI — are the
 * ones added to that, not a replacement for it. Everything the configuration
 * does name is labelled, because "1962748503" on its own is not a fact anybody
 * can use.
 */
function factLine(config) {
  const parts = [];
  const asked = new Set(config.fields || []);

  if (!asked.has('address')) parts.push(PRACTICE_FIELD_INDEX.address?.value);

  for (const id of config.fields || []) {
    const field = PRACTICE_FIELD_INDEX[id];
    // The name is already the line above; repeating it reads as a mistake.
    if (!field || id === 'name') continue;
    parts.push(id === 'address' ? field.value : `${field.label}: ${field.value}`);
  }

  return parts.filter(Boolean).join(' · ');
}

/** Build the band. Text goes in through textContent — nothing here is markup. */
function buildLetterhead(config) {
  const host = document.createElement('div');
  host.className = `${HOST_CLASS} ${HOST_CLASS}--${config.layout}`;
  /* The band repeats what the screen already says on screen, where it is not
     shown at all — so it is furniture to a screen reader, not content. */
  host.setAttribute('aria-hidden', 'true');

  const src = config.layout === 'text-only' ? null : logoSrc(config);
  if (src) {
    const logo = document.createElement('img');
    logo.className = `${HOST_CLASS}__logo`;
    logo.src = src;
    // The practice name is written next to it in words; an alt would be the
    // same sentence twice for anyone who did hear this element.
    logo.alt = '';
    host.append(logo);
  }

  if (config.layout !== 'logo-only') {
    const text = document.createElement('div');
    text.className = `${HOST_CLASS}__text`;

    const name = document.createElement('div');
    name.className = `${HOST_CLASS}__name`;
    name.textContent = PRACTICE_FIELD_INDEX.name?.value || '';
    text.append(name);

    const facts = factLine(config);
    if (facts) {
      const line = document.createElement('div');
      line.className = `${HOST_CLASS}__facts`;
      line.textContent = facts;
      text.append(line);
    }

    host.append(text);
  }

  /* Alignment is the configuration's, and it moves the mark as well as the
     text — a centred letterhead with a left-hung logo is neither. */
  const align = config.layout === 'text-only' ? config.textAlign : config.logoAlign;
  if (align === 'center' || align === 'right') host.classList.add(`${HOST_CLASS}--${align}`);

  return host;
}

/**
 * Put the letterhead at the top of the page.
 *
 * First child of <body>, so it prints above whatever the screen's own print
 * rules left standing — the screens do not agree on what that is, and this way
 * none of them has to. Built once at load rather than in a beforeprint
 * handler: window.print() is synchronous, and anything assembled inside that
 * handler is racing the browser's own snapshot of the page.
 */
export function installPrintLetterhead() {
  if (document.querySelector(`.${HOST_CLASS}`)) return;

  const config = defaultConfig();
  if (!config) return;

  document.body.prepend(buildLetterhead(config));
}
