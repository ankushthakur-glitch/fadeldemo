/**
 * STICKING A COMMENT TO A PLACE ON A SCREEN.
 *
 * Three problems, and they are different problems.
 *
 * WHICH SCREEN. Every page in both products is a real .html file, so the
 * pathname already is the screen's identity — there is no router state to
 * recover and no id to invent. screenIdentity() turns /screens/scheduler.html
 * into "ehr:scheduler" and /patient/home.html into "patient:home". The product
 * prefix matters: both trees have a dashboard, and they are not the same page.
 *
 * WHICH VIEW OF IT. A screen is not one screen. The patient chart is sixteen
 * modules behind one rail on one .html file; Billing repaints its whole table
 * when a status chip is pressed; a paginated list is a different twenty rows
 * per page. The pathname is identical throughout, so a comment left on a
 * Diagnoses row would otherwise be drawn over whatever Vitals happens to put
 * in the same place — a pin pointing confidently at the wrong thing, which is
 * worse than no pin. So the anchor also records WHICH TAB WAS OPEN when the
 * comment was written (captureView), and the pin is drawn only when those
 * tabs are open again. The sidebar row for a comment in another view says
 * which one, and pressing it presses the tabs back (restoreView).
 *
 * WHERE ON THE SCREEN. A raw x/y pair is the obvious answer and the wrong one.
 * These are data-dense screens that reflow: a comment pinned at (840, 1200) on
 * a 1440px window lands in the middle of nothing on a 1280px one, and lands on
 * a different row entirely once a table above it gains an entry. So the anchor
 * is recorded against the ELEMENT that was clicked — a CSS path to it, plus
 * where inside its box the click fell as a 0..1 fraction. The pin then rides
 * that element wherever the layout puts it, at whatever width, after whatever
 * re-render.
 *
 * That was the design from the start, and on its own it was not enough. Three
 * things were letting a pin move or vanish between one window width and
 * another, and each is dealt with here:
 *
 *   1. WHAT GETS ANCHORED TO. elementFromPoint() returns whatever is topmost,
 *      which on these screens is usually a layout div the width of the column.
 *      A fraction across an 1100px box is a pixel offset by another name — it
 *      lands somewhere different every time the box reflows. Clicks are now
 *      snapped up to the nearest element a person would name (snapTarget), so
 *      the fraction is a fraction of a button rather than of a region.
 *
 *   2. WHERE IN A BOX THAT IS STILL BIG. Sometimes there is nothing smaller —
 *      the empty half of a header really is the header. For an axis that is
 *      oversized the anchor also records how far the click was from the
 *      nearest edge, and resolves from that edge instead. A comment left in
 *      the top-right corner stays in the top-right corner at any width.
 *
 *   3. WHETHER THE POINT CAN BE SEEN. A rect is reported for an element
 *      scrolled out of its own well, and it points at whatever is drawn there
 *      instead. Every scrolling ancestor is intersected down to the window
 *      (withinClip) and a pin outside that rectangle is not drawn at all.
 *
 * The raw coordinates are stored anyway, as the fallback for when the element
 * is genuinely gone — a row that no longer exists, a panel that was rebuilt
 * with different markup. A pin that resolves that way is marked as detached
 * rather than silently drawn somewhere plausible, because "this comment is
 * about something that has changed" is information the reviewer wants. A
 * positional path that now matches something unrecognisable counts as gone for
 * this purpose too, which is what stillTheSameThing() decides.
 */

/* Anything inside the comment layer itself is never a legitimate anchor —
   you cannot pin a comment to a comment pin. */
const LAYER_ROOT = '.dcc';

/*
 * WHAT IS WORTH PINNING TO.
 *
 * document.elementFromPoint() hands back whatever happens to be topmost under
 * the cursor, and on these screens that is very often a layout div a thousand
 * pixels wide — click the empty half of a card header and the "element" you
 * hit is the header. Recording that as the anchor is pixel-pinning wearing a
 * selector: the fraction across a 1090px box is a different place at every
 * window width, which is exactly the drift this module set out to avoid.
 *
 * So a click is snapped upward to the nearest thing a person would name if
 * asked what they had clicked — a control, a field, a cell, a heading. The
 * list is deliberately about roles rather than tags, because half the things
 * on these screens are custom elements.
 */
const ANCHORABLE = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'label', 'summary',
  'th', 'td', 'li', 'dt', 'dd', 'legend', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  '[role]', '[data-testid]', '[aria-label]',
  'ui-button', 'ui-input', 'ui-select', 'ui-checkbox', 'ui-radio', 'ui-toggle',
  'ui-badge', 'ui-chip', 'ui-tab', 'ui-card', 'ui-avatar', 'ui-icon-button',
].join(',');

/*
 * Past this, a box is a region rather than a thing.
 *
 * Two numbers rather than one because these screens are full of bands: a title
 * strip is 1090 wide and 49 tall, and only its width is a problem. The axis
 * that is oversized gets measured from the nearest edge instead of by
 * fraction (see resolveAnchor); the axis that is not keeps the fraction, which
 * on a 49px band is accurate to a couple of pixels at any width.
 */
const BIG_W = 320;
const BIG_H = 240;

function oversized(rect) {
  return rect.width > BIG_W || rect.height > BIG_H;
}

/* ==========================================================================
   WHICH SCREEN
   ========================================================================== */

/**
 * The current page's stable key and its human name.
 * @returns {{ key: string, label: string }}
 */
export function screenIdentity() {
  const path = location.pathname.replace(/\/+$/, '/index.html');
  const file = path.slice(path.lastIndexOf('/') + 1) || 'index.html';
  const slug = file.replace(/\.html?$/i, '') || 'index';
  const product = /\/patient\//i.test(path) ? 'patient' : 'ehr';

  return { key: `${product}:${slug}`, label: screenLabel(slug) };
}

/**
 * What to call this screen in a list.
 *
 * Both products title their pages with the product name attached — "MediNova
 * EHR — Dashboard" one way round, "Dashboard — MediNova Clinic Patient Portal"
 * the other — so the useful half is whichever segment is not the branding.
 * Falls back to the filename, which is always something.
 */
function screenLabel(slug) {
  const parts = (document.title || '')
    .split(/[—–|]/)
    .map((part) => part.trim())
    .filter((part) => part && !/medinova|portal|ehr/i.test(part));

  if (parts.length) return parts[0];
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ==========================================================================
   WHICH VIEW OF THE SCREEN
   ========================================================================== */

/*
 * WHAT COUNTS AS A VIEW SWITCH.
 *
 * There is no one tab component to ask. Half these strips are <ui-tabs>, the
 * rest are hand-built in the screen that needs them, and the patient chart's
 * sixteen modules are a rail of plain buttons down the left. What they do
 * share is the accessibility markup, because every one of them had to: a
 * selected tab says aria-selected="true", and a rail or a pager marks the page
 * you are on with aria-current="page". Those two attributes are the only
 * reliable common ground, so they are what is read.
 *
 * Deliberately not read: aria-current on a LINK. A link strip — the portal's
 * Profile / Insurance / Cards — moves you to another .html file, so the screen
 * key changes and the comment was never going to be shown anyway. And
 * aria-current="date", which <ui-date-picker> puts on the selected day: that
 * is a value, not a view.
 */
const VIEW_MARKER = '[role="tab"][aria-selected="true"], button[aria-current="page"]';

/*
 * The strip a marked tab belongs to, which is what identifies the switch
 * itself. It has to be the strip and not the tab, because the tab that is
 * marked is a different element in every view — that is the whole point of it.
 */
const VIEW_GROUP = '[role="tablist"], nav, ul, ol';

/*
 * What names one tab within its strip, best first.
 *
 * A tab is re-rendered on every switch in most of these screens, so the name
 * has to be something the screen puts back — an id it chose, not a position.
 * The data-* attributes are the ones the screens actually use to route their
 * own clicks, which makes them exactly as stable as the switching is. Text is
 * the last resort and is usually right too: a tab whose label changed is a
 * different tab to the reader as well.
 */
const VIEW_TOKENS = ['data-value', 'data-tab', 'data-nav', 'data-chip', 'data-testid', 'aria-controls', 'id'];

function tabToken(el) {
  for (const attr of VIEW_TOKENS) {
    const value = el.getAttribute?.(attr);
    if (value) return value;
  }
  return describe(el);
}

/** Every switch on the page right now, one entry per strip. */
function switchers() {
  const found = [];
  const seen = new Set();

  for (const marker of document.querySelectorAll(VIEW_MARKER)) {
    if (marker.closest(LAYER_ROOT)) continue;
    const group = marker.closest(VIEW_GROUP) || marker.parentElement;
    /* Two markers in one strip means a strip that marks something other than
       its open tab; the first is the one to trust either way. */
    if (!group || seen.has(group)) continue;
    seen.add(group);
    found.push({ group, marker });
  }

  return found;
}

/**
 * Which tabs were open when this element was clicked.
 *
 * Every switch on the page is recorded, EXCEPT one whose own strip contains
 * the element. That exception is not a detail: a comment left on the "Claims"
 * tab button itself is about that button, which is drawn in every view, and
 * tying it to the view it happened to be pressed in would hide it everywhere
 * but there.
 *
 * The other way round has no such escape, and it is a real cost: a comment on
 * the chart's patient banner — which every module draws — is tied to the
 * module that was open under it, and hides when you leave. That is the honest
 * trade. Nothing on the page says which parts of it a tab redraws, so the
 * choice is between hiding a pin that could have stayed and drawing one over
 * content it was never about; the second is the failure a reviewer acts on.
 * The sidebar covers the cost: the row is still listed, it says which view it
 * belongs to, and pressing it goes back there.
 */
export function captureView(el) {
  return switchers()
    .filter(({ group }) => !group.contains(el))
    .map(({ group, marker }) => ({
      group: selectorFor(group),
      value: tabToken(marker),
      label: describe(marker),
    }));
}

/**
 * The recorded tabs that are NOT the ones open now.
 *
 * A switch that is no longer on the page at all is not a disagreement — the
 * screen has been rebuilt since, and a comment should not vanish because a
 * strip was renamed. Only a strip that is present AND showing something else
 * counts.
 */
function mismatched(anchor) {
  const view = anchor?.view;
  /* Every comment written before this file learned about tabs has no view on
     it, and behaves exactly as it did: shown on its screen, always. */
  if (!Array.isArray(view)) return [];

  return view.filter((entry) => {
    const group = find(entry.group);
    if (!group) return false;
    const marker = group.querySelector(VIEW_MARKER);
    if (!marker) return false;
    return tabToken(marker) !== entry.value;
  });
}

function find(selector) {
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * A short string that changes when any tab on the page does.
 *
 * The layer redraws pins on every animation frame it is asked for — a scroll,
 * a resize, any mutation — and asking each comment whether its view still
 * matches on every one of those would be a document query per comment per
 * frame. This is one query for the whole page, and the answer only has to be
 * compared with the last one: same string, nothing about views has changed and
 * the sidebar can be left alone.
 */
export function viewSignature() {
  return switchers()
    .map(({ marker }) => tabToken(marker))
    .join('|');
}

/** Is the screen showing the view this comment was left in? */
function viewMatches(anchor) {
  return mismatched(anchor).length === 0;
}

/**
 * What to call the view a comment is waiting in, for the sidebar to show on
 * its row. Only the parts that disagree, because the parts that agree are
 * where the reader already is and naming them would be noise.
 */
export function viewLabel(anchor) {
  return mismatched(anchor)
    .map((entry) => entry.label)
    .filter(Boolean)
    .join(' · ');
}

/**
 * Press the tabs a comment was left under.
 *
 * Clicking rather than setting an attribute, because only the strip knows what
 * else has to happen — <ui-tabs> shows a panel, Billing refetches and repaints
 * a table, the chart rail swaps the whole workspace. A click is the one
 * instruction all of them answer.
 *
 * One switch at a time, re-reading the page between: opening a module very
 * often replaces the strips inside it, so the selector for a nested strip is
 * only worth resolving once the strip above it has been dealt with. The pass
 * limit is there because a page whose tabs fight each other would otherwise
 * loop for ever, and four is deeper than anything here nests.
 *
 * @returns {boolean} whether anything was actually pressed
 */
export function restoreView(anchor) {
  let pressed = false;

  for (let pass = 0; pass < 4; pass += 1) {
    const [entry] = mismatched(anchor);
    if (!entry) break;

    const group = find(entry.group);
    const tab = group && [...group.querySelectorAll('[role="tab"], button')]
      .find((el) => tabToken(el) === entry.value);
    /* The tab is gone — a chip for a filter nobody offers any more. Nothing to
       press, and pressing the others would leave the reviewer half way to a
       view that no longer exists. */
    if (!tab) break;

    tab.click();
    pressed = true;
  }

  return pressed;
}

/* ==========================================================================
   WHERE ON THE SCREEN
   ========================================================================== */

function esc(value) {
  return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
}

/** Does this selector match exactly one thing? A path is only worth keeping if so. */
function unique(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * The one step in a path that is worth more than a position: a test id or an
 * id. Both survive a re-render that renumbers siblings, which is exactly the
 * change that breaks a positional path.
 */
function stableToken(el) {
  const testid = el.getAttribute?.('data-testid');
  if (testid) return `[data-testid="${esc(testid)}"]`;
  /* A generated id — the ones ending in a random suffix — is worse than
     useless: it looks stable and is not. Ids in this codebase are authored, so
     the only ones rejected here are the numeric-leading ones that are not
     valid selectors anyway. */
  if (el.id && !/^\d/.test(el.id)) return `#${esc(el.id)}`;
  return null;
}

/**
 * A CSS path from <body> down to `el`, stopping early at the first ancestor
 * that can identify itself.
 */
export function selectorFor(el) {
  if (!el || el.nodeType !== 1) return 'body';

  const steps = [];
  let node = el;

  while (node && node.nodeType === 1 && node !== document.body) {
    const token = stableToken(node);
    if (token && unique(token)) {
      steps.unshift(token);
      return steps.join(' > ');
    }

    const parent = node.parentElement;
    if (!parent) break;

    const tag = node.tagName.toLowerCase();
    const twins = [...parent.children].filter((c) => c.tagName === node.tagName);
    steps.unshift(twins.length > 1 ? `${tag}:nth-of-type(${twins.indexOf(node) + 1})` : tag);
    node = parent;
  }

  steps.unshift('body');
  return steps.join(' > ');
}

/**
 * A few words describing what was clicked, for the sidebar to show when the
 * reader is looking at the list rather than at the pin. Trimmed hard: this is
 * a caption, not a quote.
 */
function describe(el) {
  const text =
    el.getAttribute?.('aria-label') ||
    el.getAttribute?.('title') ||
    (el.textContent || '').replace(/\s+/g, ' ').trim() ||
    /* A control with no words in it — an icon button, an empty field, an
       image. Every one of these carries its name somewhere else, and the name
       is the whole point: a comment reading "this is wrong" against a pin with
       no label tells the person fixing it nothing at all. */
    el.getAttribute?.('alt') ||
    el.getAttribute?.('placeholder') ||
    el.getAttribute?.('value') ||
    '';
  if (!text) return '';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/*
 * What to CALL the thing a comment sits on, when it has nothing to say for
 * itself.
 *
 * describe() is deliberately about the words in an element, because those
 * words are what stillTheSameThing() checks identity against — and they must
 * keep meaning exactly that. This is the other question: not "is this still
 * the same element" but "what do I tell the person who has to go and fix it".
 * A test id names the thing its author meant it to name and beats everything
 * else; failing that, the role or the tag at least says what kind of thing it
 * was, which is the difference between "somewhere in this card" and "the
 * status select in this card".
 */
function elementName(el) {
  if (!el) return '';
  const words = describe(el);
  /* A test id is worth saying even beside the words, because it is the one
     thing on the element that the person fixing it can grep for. A tag name
     is not — "Confirmed — td" tells a reviewer nothing they could not see —
     so that one is only reached for when there is nothing else at all. */
  const id = el.getAttribute?.('data-testid') || el.getAttribute?.('role') || '';
  if (words && id && words.toLowerCase() !== id.toLowerCase()) return `${words} — ${id}`;
  return words || id || el.tagName.toLowerCase().replace(/^ui-/, '');
}

/**
 * The name to show beside a comment for the element it was left on.
 *
 * Read live from the element when it is still there, because the words on it
 * are the ones the reader will see when they go and look; the label recorded
 * at the time is the fallback, and for a detached comment it is all there is
 * — which is exactly when it matters most, since it says what the thing used
 * to be before it changed.
 *
 * @returns {string} '' when there is nothing worth saying
 */
export function anchorLabel(anchor) {
  if (!anchor) return '';
  const el = anchorElement(anchor);
  return (el && elementName(el)) || anchor.label || '';
}

/**
 * The part of the anchored element that can actually be seen, right now, in
 * viewport coordinates — the box to draw around it.
 *
 * The pin says where the comment was left; this says WHAT it was left on, and
 * on these screens those are different questions. A pin sitting between two
 * table rows, or an inch inside a card with six controls on it, is a comment
 * whose subject the reader has to guess at — and the guess is the bug being
 * fixed here. Outlining the element removes the guess.
 *
 * Intersected with every scrolling ancestor for the same reason resolveAnchor
 * is: a row scrolled out of its own well still reports a rect, and an outline
 * drawn there would frame whatever unrelated content is showing instead.
 * Nothing visible left means nothing drawn.
 *
 * @returns {{ left: number, top: number, width: number, height: number }|null}
 */
export function anchorBox(anchor) {
  if (!anchor || !viewMatches(anchor)) return null;

  const el = anchorElement(anchor);
  /* A detached comment is deliberately not boxed. Its selector may well still
     match something — that is what stillTheSameThing() is there to catch —
     and framing the wrong element is a more confident lie than framing
     nothing. */
  if (!el || !stillTheSameThing(el, anchor)) return null;

  return visibleBox(el);
}

/**
 * The box that WOULD be anchored to, for a point that has not been committed
 * to yet — the outline drawn under the cursor while a comment is being placed.
 *
 * Same snapping as captureAnchor, deliberately: what is shown while choosing
 * has to be the same element that is recorded on the click, or the preview is
 * a lie and the reviewer learns to distrust it.
 *
 * @returns {{ left: number, top: number, width: number, height: number }|null}
 */
export function targetBox(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit || hit.closest(LAYER_ROOT)) return null;
  return visibleBox(snapTarget(hit));
}

/**
 * Is this box a region rather than a thing?
 *
 * The same question snapTarget stops climbing on, asked of a box that has
 * already been resolved — so the outline can say which of the two it is
 * drawing. A comment on a button is about the button; a comment on eight
 * hundred pixels of card is about the card, and the reader is owed the
 * difference rather than being left to judge it by eye.
 */
export function isRegion(box) {
  return Boolean(box) && oversized(box);
}

/** An element's rectangle, cut down to the part of it that can be seen. */
function visibleBox(el) {
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;

  const clip = clipRect(el);
  const left = Math.max(rect.left, clip.left);
  const top = Math.max(rect.top, clip.top);
  const right = Math.min(rect.right, clip.right);
  const bottom = Math.min(rect.bottom, clip.bottom);
  if (right <= left || bottom <= top) return null;

  return { left, top, width: right - left, height: bottom - top };
}

/**
 * The element a click should actually be recorded against.
 *
 * Walks up from whatever was under the cursor to the nearest thing worth
 * naming, and stops climbing the moment a box grows into a region. The order
 * matters: an ancestor that can identify itself with a test id beats one that
 * merely looks anchorable, because the id is what survives a re-render.
 *
 * Clicking the empty part of a wide header therefore still anchors to the
 * header — there is nothing better underneath — but clicking its button now
 * anchors to the button rather than to the eight hundred pixels of nothing
 * around it. That single step is most of the difference between a pin that
 * holds its place across widths and one that slides.
 */
function snapTarget(el) {
  let node = el;
  let loose = null;

  while (node && node.nodeType === 1 && node !== document.body) {
    const rect = node.getBoundingClientRect();
    const big = oversized(rect);

    const token = stableToken(node);
    if (token && unique(token) && !big) return node;
    if (!loose && !big && node.matches?.(ANCHORABLE)) loose = node;

    /* Past this point every ancestor is larger again, so there is nothing
       better up there — take the best thing seen on the way. */
    if (big) break;
    node = node.parentElement;
  }

  return loose || el;
}

/**
 * Turn a click into something storable.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @returns {object|null} the anchor, or null if the point is inside our own UI
 */
export function captureAnchor(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit || hit.closest(LAYER_ROOT)) return null;

  const target = snapTarget(hit);
  const rect = target.getBoundingClientRect();
  const doc = document.documentElement;

  /* WHICH CORNER THE CLICK WAS NEAREST, and how far off it.
     For a box that is a region rather than a thing — a full-width band, a
     tall column — the fraction across it is the drift all over again, so the
     offset from the nearest edge is recorded beside it. A click 40px in from
     the right-hand end of a title bar is 40px in from that end at every
     window width, which is what "I commented on the corner" means. The
     fraction stays for the axis that is small enough to be trusted. */
  const right = clientX - rect.left > rect.width / 2;
  const below = clientY - rect.top > rect.height / 2;

  return {
    selector: selectorFor(target),
    /* Which tabs were open. Read before anything else is measured, because
       everything measured below is only true inside this view. */
    view: captureView(target),
    /* Where in the element's own box the click fell. Guarded against a
       zero-size box — an inline element mid-reflow — where the division would
       be an Infinity that JSON.stringify turns into null. */
    rx: rect.width ? clamp01((clientX - rect.left) / rect.width) : 0.5,
    ry: rect.height ? clamp01((clientY - rect.top) / rect.height) : 0.5,
    corner: `${below ? 'b' : 't'}${right ? 'r' : 'l'}`,
    ox: Math.round(right ? rect.right - clientX : clientX - rect.left),
    oy: Math.round(below ? rect.bottom - clientY : clientY - rect.top),
    /* Document coordinates, for when the element is gone. */
    x: Math.round(clientX + window.scrollX),
    y: Math.round(clientY + window.scrollY),
    docW: doc.clientWidth,
    label: describe(target),
  };
}

function clamp01(n) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}

/**
 * Where a stored anchor points, right now, in viewport coordinates.
 *
 * Viewport rather than document coordinates because these screens are full of
 * their own scrolling regions — the portal's .pp-scroll, a table body, an open
 * drawer. Document coordinates only track the window's scroll, so a pin on a
 * row inside an inner scroller would drift the moment that scroller moved.
 * getBoundingClientRect() knows about all of them.
 *
 * @returns {{ x: number, y: number, detached: boolean }|null}
 */
export function resolveAnchor(anchor) {
  if (!anchor) return null;

  /* Another view of this screen is open. Not detached and not missing — the
     comment is fine, you are simply not looking at the place it is about, and
     the only honest thing to draw is nothing. The sidebar still lists it and
     will bring you back (see viewLabel and restoreView). */
  if (!viewMatches(anchor)) return null;

  const el = anchorElement(anchor);
  if (el && stillTheSameThing(el, anchor)) {
    const rect = el.getBoundingClientRect();
    /* A found element with no box is a hidden one — a closed tab panel, a
       collapsed section. Not detached: it is still there and the pin should
       simply not be drawn until it comes back. */
    if (!rect.width && !rect.height) return null;

    /* Per axis, because a band is oversized across and exact down. Where the
       axis is a region, measure in from the edge the click was nearest;
       where it is a thing, the fraction is right and stays. */
    const corner = anchor.corner || 'tl';
    const x =
      rect.width > BIG_W && typeof anchor.ox === 'number'
        ? corner.includes('r')
          ? rect.right - Math.min(anchor.ox, rect.width)
          : rect.left + Math.min(anchor.ox, rect.width)
        : rect.left + (anchor.rx ?? 0.5) * rect.width;
    const y =
      rect.height > BIG_H && typeof anchor.oy === 'number'
        ? corner.startsWith('b')
          ? rect.bottom - Math.min(anchor.oy, rect.height)
          : rect.top + Math.min(anchor.oy, rect.height)
        : rect.top + (anchor.ry ?? 0.5) * rect.height;

    /* Scrolled out of the region it lives in, or off the window entirely.
       Drawing it where it says would put the pin over unrelated content, and
       that reads as a comment about that content. Hiding it is no better: a
       pin that vanishes at one window width is the complaint this whole pass
       started from. So it is parked on the edge of the region it went out of,
       facing the way it went — visible, countable, and something to click,
       which scrolls its element back. */
    const clip = clipRect(el);
    if (x < clip.left || x > clip.right || y < clip.top || y > clip.bottom) {
      const park = parkable(clip);
      return {
        x: Math.min(Math.max(x, park.left + EDGE), park.right - EDGE),
        y: Math.min(Math.max(y, park.top + EDGE), park.bottom - EDGE),
        detached: false,
        offscreen: true,
      };
    }

    return { x, y, detached: false, offscreen: false };
  }

  if (typeof anchor.x !== 'number' || typeof anchor.y !== 'number') return null;

  /* The element is gone. Fall back to where the click was, clamped into the
     window so a pin recorded on a wider monitor is still reachable. */
  return {
    x: Math.min(anchor.x - window.scrollX, document.documentElement.clientWidth - 8),
    y: anchor.y - window.scrollY,
    detached: true,
  };
}

/**
 * Is the element this selector found still the one the comment was left on?
 *
 * Only asked of positional paths. A selector carrying a test id or an id names
 * one thing and keeps naming it, and the label under it is expected to change
 * — half the comments on this board are requests to change exactly that text,
 * and a pin that detached itself the moment its request was carried out would
 * be useless. A path made of nth-of-type steps has no such promise: it points
 * at a position, and after a re-render that position can hold something else
 * entirely. Checking the recorded label against what is there now is the only
 * evidence available that it is still the right element, so a mismatch is
 * reported as detached rather than drawn as though nothing had happened.
 */
function stillTheSameThing(el, anchor) {
  /* The LAST step is the one that names the target. A path can carry an id
     high up — `#cols > main > div:nth-of-type(1)` starts at one — and still
     end in a position that any re-render is free to fill with something else.
     That path is exactly as positional as one with no id in it at all, so
     only the final step counts as a promise. */
  const steps = String(anchor.selector || '').split('>');
  const last = steps[steps.length - 1] || '';
  if (/\[data-testid=|#/.test(last)) return true;
  if (!anchor.label) return true;
  const now = describe(el);
  if (!now) return false;
  return now === anchor.label || now.startsWith(anchor.label) || anchor.label.startsWith(now);
}

/* How far inside the edge a parked pin sits, so the whole badge is on screen
   rather than half off it. */
const EDGE = 16;

/**
 * The rectangle this element can actually be seen in.
 *
 * getBoundingClientRect() reports where an element would be, not whether
 * anything is showing there. On these screens the body does not scroll — the
 * columns and the table bodies inside it do — so a row scrolled out of its own
 * well still reports a viewport position, one that lands squarely on whatever
 * is drawn above or below the well. Every scrolling ancestor is intersected
 * down to the window; a point outside the result is a point with nothing to
 * point at, however confidently the rect was reported.
 */
function clipRect(el) {
  let left = 0;
  let top = 0;
  let right = document.documentElement.clientWidth;
  let bottom = document.documentElement.clientHeight;

  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (!/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) continue;
    const box = node.getBoundingClientRect();
    left = Math.max(left, box.left);
    top = Math.max(top, box.top);
    right = Math.min(right, box.right);
    bottom = Math.min(bottom, box.bottom);
  }

  return { left, top, right, bottom };
}

/**
 * The same rectangle, made safe to clamp a parked pin into.
 *
 * A region narrower than the badge would otherwise clamp the pin to the far
 * side of its own edge; collapsing to the middle is the honest answer. Kept
 * apart from clipRect because only the parking arithmetic wants it — an
 * outline drawn around an element inside a 20px-wide scroller should be that
 * sliver of element, not a line down the middle of it.
 */
function parkable({ left, top, right, bottom }) {
  if (right - left < EDGE * 2) left = right = (left + right) / 2;
  if (bottom - top < EDGE * 2) top = bottom = (top + bottom) / 2;
  return { left, top, right, bottom };
}

/**
 * The element a comment was pinned to, if it is still on the page.
 *
 * Separate from resolveAnchor because two callers want different things from
 * it: one wants a point to draw at, the other wants the element itself, to
 * scroll it into view when somebody picks the comment out of the list. Going
 * through the point to get back to the element would lose exactly the thing
 * that makes scrolling work — a browser can scroll an element into view
 * through however many nested scrolling regions it sits in, and it cannot do
 * that for a pair of coordinates.
 */
export function anchorElement(anchor) {
  const selector = anchor?.selector;
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
