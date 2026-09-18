/**
 * THE REVIEW COMMENT LAYER.
 *
 * A floating button, bottom-left. Press it and a sidebar comes in from the
 * right listing every comment anyone has left. Press "New comment" and the
 * next click you make anywhere on the screen drops a pin there and opens a
 * composer; the comment stays stuck to whatever you clicked, on that screen
 * only, for everyone who opens the prototype afterwards.
 *
 * WHY IT IS ONE FLOATING LAYER AND NOT A COMPONENT SCREENS INCLUDE.
 * It has no relationship to the content of any screen. It must work on all
 * fifty-odd pages across both products, including ones nobody remembers to
 * update, and it must be removable in one line when the review is over. So it
 * appends itself to <body>, brings its own stylesheet, and touches nothing
 * else on the page. No screen's markup knows it exists.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 * It does not sign anyone in — see the note on identity in store.js. It does
 * not render in Playwright, so the visual-regression baselines are not all
 * invalidated by a green button in the corner; see mount() for how that is
 * decided and how to override it.
 *
 * The three files it leans on: anchor.js works out where a comment is stuck,
 * store.js reads and writes them, icons.js draws the eight glyphs.
 */

import { icon } from './icons.js';
import { attach, imagesIn, localPreview, ACCEPT, MAX_PER_COMMENT } from './images.js';
import * as store from './store.js';
import {
  screenIdentity,
  captureAnchor,
  resolveAnchor,
  anchorElement,
  anchorBox,
  anchorLabel,
  targetBox,
  isRegion,
  viewLabel,
  viewSignature,
  restoreView,
} from './anchor.js';
import { POLL_MS } from './config.js';

/**
 * The panel's default size, and the smallest it is still usable at. Below
 * roughly this width a comment wraps to five lines and the list stops being
 * scannable, which is the whole job of the list.
 */
const PANEL = { w: 360, h: 520, minW: 260, minH: 220 };

/* ==========================================================================
   THE KEY THAT TAKES THE PINS OFF THE SCREEN AND PUTS THEM BACK

   Alt+Shift+H. Two modifiers, because this one gesture has to survive being
   pressed by somebody who is not aiming for it: a reviewer who hides the pins
   by accident merely sees a tidy screen, but one who un-hides them by accident
   has just put a numbered list of everything wrong with the page on the wall
   in front of the client it was drawn for. Nothing in either product listens
   on Alt+Shift.

   Not Alt+C, which the patient chart already spends on its sidebar, and not
   plain C, which is a letter.

   Read from event.code rather than event.key. On a Mac, Option+Shift+H does
   not produce "H" — it produces "Ó", and a chord that only worked on Windows
   would be a chord that did not work on the machine this prototype is
   demonstrated from.
   ========================================================================== */

function isHideChord(event) {
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyH';
}

/** Written the way the keyboard it will be pressed on is labelled. */
const HIDE_KEY_LABEL = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
  ? '\u2325\u21e7H'
  : 'Alt+Shift+H';

export class CommentLayer {
  constructor() {
    this.screen = screenIdentity();
    /** Every comment in the table, both products. @type {object[]} */
    this.rows = [];
    this.read = store.readIds();

    const saved = store.filters();
    this.view = {
      open: false,
      placing: false,
      menuOpen: false,
      /** The root comment whose thread is showing, if any. */
      activeId: null,
      /** { at: {x,y}, anchor } while a new comment is being written. */
      composing: null,
      query: '',
      sort: saved.sort === 'unread' ? 'unread' : 'date',
      showResolved: Boolean(saved.showResolved),
      mine: Boolean(saved.mine),
      currentPage: Boolean(saved.currentPage),
      /* Pins off, button on. See the note above hidePins() for why the two
         halves of the layer are hidden separately. */
      hidePins: Boolean(saved.hidePins),
    };

    /* Bound once so add/removeEventListener see the same function. The
       placing-mode listeners in particular are added and removed on every
       use, and an unbound method would leave one behind each time. */
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.onPlaceClick = this.onPlaceClick.bind(this);
    this.swallow = this.swallow.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.schedule = this.schedule.bind(this);
    this.refresh = this.refresh.bind(this);
    this.onPanelDown = this.onPanelDown.bind(this);
    this.onPanelMove = this.onPanelMove.bind(this);
    this.onPanelUp = this.onPanelUp.bind(this);
    this.onPointerOver = this.onPointerOver.bind(this);
    this.onPlaceMove = this.onPlaceMove.bind(this);
    this.frame = 0;
    /* The tabs that were open the last time the sidebar was drawn. A tab
       press changes which comments have a pin, and the list has to say so —
       see syncView. */
    this.viewStamp = null;

    /* Where the panel is and how big, in viewport coordinates. Restored from
       the last session if there is one — see the note on setPanelBox. */
    this.box = null;
    /** In-flight drag or resize: { mode, startX, startY, box }. */
    this.drag = null;
    /** Images staged for the comment currently being written. */
    this.shots = [];
    /** What the popover is currently showing, so a redraw knows whether it is
        the same thing being redrawn or a different thing replacing it. */
    this.popMode = null;
    /** The box under the cursor while a comment is being placed, and the frame
        that is due to measure it. See onPlaceMove. */
    this.placingBox = null;
    this.placeFrame = 0;
    /** The comment being pointed at — a sidebar row under the cursor or a pin
        under it — whose element gets outlined without anything being opened.
        Not in `view`: it is where the mouse is, not a state of the review. */
    this.hoverId = null;
  }

  /* ======================================================================
     MOUNTING
     ====================================================================== */

  mount() {
    if (document.querySelector('.dcc')) return;

    const root = document.createElement('div');
    root.className = 'dcc';
    root.innerHTML = TEMPLATE;
    document.body.append(root);

    this.el = {
      root,
      halo: root.querySelector('.dcc__halo'),
      pins: root.querySelector('.dcc__pins'),
      fab: root.querySelector('.dcc__fab'),
      count: root.querySelector('.dcc__fab-count'),
      panel: root.querySelector('.dcc__panel'),
      search: root.querySelector('.dcc__search-input'),
      list: root.querySelector('.dcc__list'),
      status: root.querySelector('.dcc__status'),
      menu: root.querySelector('.dcc__menu'),
      pop: root.querySelector('.dcc__pop'),
      hint: root.querySelector('.dcc__hint'),
      toast: root.querySelector('.dcc__toast'),
      lightbox: root.querySelector('.dcc__lightbox'),
    };

    /* One delegated click for the whole layer. Everything that does something
       carries data-act, so adding a control is a branch in one switch rather
       than another listener to remember to tear down. */
    root.addEventListener('click', (event) => {
      const hit = event.target.closest('[data-act]');
      if (hit && root.contains(hit)) this.act(hit.dataset.act, hit, event);
    });

    root.addEventListener('submit', (event) => {
      event.preventDefault();
      if (event.target.matches('.dcc__pop-form')) this.saveNew(event.target);
      else if (event.target.matches('.dcc__reply')) this.saveReply(event.target);
    });

    /* Three ways an image gets in. The picker is the one people look for;
       paste is the one they actually use, because every screenshot shortcut
       on every platform puts the picture on the clipboard and nowhere else. */
    root.addEventListener('change', (event) => {
      if (!event.target.matches('.dcc__file')) return;
      this.addShots(event.target.files);
      /* Cleared so choosing the same file twice in a row still fires. */
      event.target.value = '';
    });

    this.el.pop.addEventListener('paste', (event) => {
      const files = imagesIn(event.clipboardData);
      if (!files.length) return;
      /* Only when there is an image. A paste of text is a paste of text. */
      event.preventDefault();
      this.addShots(files);
    });

    this.el.pop.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      this.el.pop.classList.add('dcc__pop--drop');
    });
    this.el.pop.addEventListener('dragleave', (event) => {
      if (event.target === this.el.pop) this.el.pop.classList.remove('dcc__pop--drop');
    });
    this.el.pop.addEventListener('drop', (event) => {
      const files = imagesIn(event.dataTransfer);
      this.el.pop.classList.remove('dcc__pop--drop');
      if (!files.length) return;
      event.preventDefault();
      this.addShots(files);
    });

    this.el.search.addEventListener('input', () => {
      this.view.query = this.el.search.value.trim().toLowerCase();
      this.renderList();
    });

    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onKeydown);

    /* Pointing at a comment outlines what it is about, without opening
       anything. On the document rather than on the panel and the pins
       separately, because the interesting transition is the one OFF a row and
       onto the screen underneath — and that event is never delivered to the
       layer at all, so a listener on the layer would leave the last outline
       stuck on. Keyboard reaches the same thing through focusin, which is the
       only way a row under a caret ever gets pointed at. */
    document.addEventListener('pointerover', this.onPointerOver);
    document.addEventListener('focusin', this.onPointerOver);

    /* Moving and sizing the panel. Pointer events rather than mouse events, so
       the same code works from a trackpad, a touchscreen and a stylus; the
       move and up listeners go on the window because a fast drag outruns the
       element it started on. */
    this.el.panel.addEventListener('pointerdown', this.onPanelDown);
    window.addEventListener('pointermove', this.onPanelMove);
    window.addEventListener('pointerup', this.onPanelUp);
    window.addEventListener('pointercancel', this.onPanelUp);

    /* Pins are positioned from getBoundingClientRect, so anything that can
       move an element has to trigger a recount. Scroll is captured, because
       the events that matter come from inner scrolling regions — the portal's
       content well, a table body — and those do not bubble. */
    window.addEventListener('scroll', this.schedule, true);
    window.addEventListener('resize', () => {
      /* A window that has just been made smaller can leave the panel hanging
         off the edge of it, where the drag bar is no longer reachable and it
         can never be brought back. */
      if (this.box) {
        this.box = this.clampBox(this.box);
        this.applyBox();
      }
      this.schedule();
    });
    window.addEventListener('focus', this.refresh);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh();
    });

    /* A re-render of a screen's list moves everything under it. Mutations
       caused by the layer itself are ignored, or positioning a pin would
       schedule another positioning of that pin, for ever. */
    this.observer = new MutationObserver((records) => {
      if (records.some((r) => !this.el.root.contains(r.target))) this.schedule();
    });
    this.observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    this.refresh();
    /* Polling only while the sidebar is open. A prototype left on a second
       monitor for a week should not spend the week talking to Supabase. */
    window.setInterval(() => {
      if (this.view.open) this.refresh();
    }, POLL_MS);
  }

  /** Re-read the table and redraw everything from it. */
  async refresh() {
    this.rows = await store.list();
    this.read = store.readIds();
    this.render();
    this.openFromHash();
  }

  /**
   * A link to a comment on another screen lands here.
   *
   * The sidebar lists comments from every screen, so a row for somewhere else
   * has to be able to take you there. It navigates to that page with
   * #dc-<id> on the end, and this is the other half: on arrival, open the
   * panel and the thread.
   */
  openFromHash() {
    const match = /^#dc-(.+)$/.exec(location.hash);
    if (!match) return;
    const row = this.rows.find((r) => r.id === match[1]);
    if (!row) return;

    history.replaceState(null, '', location.pathname + location.search);
    this.setOpen(true);
    const id = row.parent_id || row.id;
    /* A link from the sidebar lands on the page's default view, which is not
       necessarily the one the comment was written in. Press the tabs first, or
       the frame below finds nothing to scroll to. */
    restoreView(this.byId(id)?.anchor);
    /* The screen has only just painted, and the element this comment is
       pinned to may be below the fold or inside a region that has not laid
       itself out yet. One frame is enough for the former; the flash is what
       covers the latter, since the pin appears wherever it ends up. */
    requestAnimationFrame(() => {
      this.reveal(this.byId(id));
      this.openThread(id);
      this.flashPin(id);
    });
  }

  /* ======================================================================
     STATE
     ====================================================================== */

  byId(id) {
    return this.rows.find((r) => r.id === id) || null;
  }

  repliesOf(id) {
    return this.rows
      .filter((r) => r.parent_id === id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  /** Root comments pinned to the screen you are looking at, oldest first. */
  screenRoots() {
    return this.rows
      .filter((r) => !r.parent_id && r.screen_key === this.screen.key)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  /**
   * Has anything in this thread arrived that this browser has not seen?
   *
   * Your own comments never count. You know what you wrote.
   */
  isUnread(root) {
    const me = store.author().trim().toLowerCase();
    return [root, ...this.repliesOf(root.id)].some(
      (c) => !this.read.has(c.id) && String(c.author).trim().toLowerCase() !== me
    );
  }

  /** What the sidebar should list, after the search box and the filter menu. */
  listRoots() {
    const { query, mine, currentPage, showResolved, sort } = this.view;
    const me = store.author().trim().toLowerCase();

    const rows = this.rows.filter((root) => {
      if (root.parent_id) return false;
      if (!showResolved && root.resolved) return false;
      if (currentPage && root.screen_key !== this.screen.key) return false;
      if (mine && String(root.author).trim().toLowerCase() !== me) return false;
      if (query) {
        /* Search the whole thread, not just the root. Looking for a word
           somebody used in a reply and being told there are no results is the
           kind of thing that makes people stop using the search box. */
        const hay = [root, ...this.repliesOf(root.id)]
          .map((c) => `${c.author} ${c.body}`)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
    if (sort === 'unread') {
      /* Unread first, each group still newest-first inside itself — an
         "unread" sort that scrambled the dates within the group would make
         the list harder to read, not easier. */
      return rows.sort((a, b) => {
        const diff = Number(this.isUnread(b)) - Number(this.isUnread(a));
        return diff || newest(a, b);
      });
    }
    return rows.sort(newest);
  }

  /* ======================================================================
     ACTIONS
     ====================================================================== */

  act(name, el, event) {
    switch (name) {
      case 'toggle-panel':
        this.setOpen(!this.view.open);
        break;
      case 'close-panel':
        this.setOpen(false);
        break;
      case 'filter-menu':
        this.setMenu(!this.view.menuOpen);
        break;
      case 'new-comment':
        this.startPlacing();
        break;
      case 'cancel-placing':
        this.stopPlacing();
        break;
      case 'open-thread':
        this.openThread(el.dataset.id);
        break;
      case 'focus-thread':
        this.focusThread(el.dataset.id);
        break;
      case 'close-pop':
        this.closePop();
        break;
      case 'pick-image':
        this.el.pop.querySelector('.dcc__file')?.click();
        break;
      case 'drop-shot':
        this.shots.splice(Number(el.dataset.index), 1);
        this.renderShots();
        break;
      case 'lightbox':
        this.openLightbox(el.dataset.src);
        break;
      case 'close-lightbox':
        this.closeLightbox();
        break;
      case 'toggle-resolve':
        this.toggleResolved(el.dataset.id);
        break;
      case 'delete':
        this.destroy(el.dataset.id);
        break;
      case 'sort':
        this.view.sort = el.dataset.value;
        this.persistFilters();
        break;
      case 'filter':
        this.view[el.dataset.value] = !this.view[el.dataset.value];
        this.persistFilters();
        break;
      case 'hide-pins':
        this.hidePins(!this.view.hidePins);
        break;
      default:
        break;
    }
    if (event && name !== 'toggle-panel') event.stopPropagation();
  }

  persistFilters() {
    const { sort, showResolved, mine, currentPage, hidePins } = this.view;
    store.setFilters({ sort, showResolved, mine, currentPage, hidePins });
    this.renderMenu();
    this.renderList();
    this.renderPins();
  }

  setOpen(open) {
    this.view.open = open;
    this.el.panel.hidden = !open;
    this.el.fab.setAttribute('aria-expanded', String(open));
    this.el.root.classList.toggle('dcc--open', open);

    if (!open) this.setMenu(false);
    if (open) {
      /* ALWAYS the default, never where it was last left.
         It used to be remembered, and that was wrong. The panel gets dragged
         out of the way of one particular thing on one particular screen — a
         row being read, a chart being compared — and that position is about
         that moment, not a preference. Carrying it forward means opening the
         panel on the next screen and finding it parked over the middle of it
         for a reason that no longer exists. Closing it is what discards the
         arrangement; opening it always gives the same known corner. */
      this.box = this.clampBox(this.defaultBox());
      this.applyBox();
      this.refresh();
      this.el.search.focus();
    }
  }

  /* ----------------------------------------------------------------------
     MOVING AND SIZING THE PANEL

     It floats above the button rather than being docked to the edge, and it
     can be dragged anywhere and resized. That is not decoration: a comment
     sits on top of the thing it is about, so wherever a fixed panel went it
     would sooner or later be sitting on the very thing somebody wanted to
     look at. A panel that docks has to choose which screens it obstructs; one
     that moves lets the reviewer decide, per screen, per comment.
     ---------------------------------------------------------------------- */

  /** Stacked over the button, which is where it comes from. */
  defaultBox() {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = Math.min(PANEL.w, vw - 32);
    const h = Math.min(PANEL.h, vh - 140);
    /* 78px clears the 46px button and its 20px inset, plus a gap. */
    return { x: 20, y: vh - h - 78, w, h };
  }

  /** Fully on screen, never smaller than it is usable at. */
  clampBox(box) {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = Math.min(Math.max(box.w, PANEL.minW), vw - 16);
    const h = Math.min(Math.max(box.h, PANEL.minH), vh - 16);
    return {
      w,
      h,
      x: Math.min(Math.max(box.x, 8), Math.max(8, vw - w - 8)),
      y: Math.min(Math.max(box.y, 8), Math.max(8, vh - h - 8)),
    };
  }

  applyBox() {
    const { x, y, w, h } = this.box;
    Object.assign(this.el.panel.style, {
      left: `${Math.round(x)}px`,
      top: `${Math.round(y)}px`,
      width: `${Math.round(w)}px`,
      height: `${Math.round(h)}px`,
    });
  }

  onPanelDown(event) {
    if (event.button !== 0) return;
    const resizing = Boolean(event.target.closest('.dcc__grip'));
    const onBar = Boolean(event.target.closest('.dcc__drag'));
    if (!resizing && !onBar) return;
    /* The bar carries the close and filter buttons. They are buttons first. */
    if (!resizing && event.target.closest('button, input, a')) return;

    event.preventDefault();
    const rect = this.el.panel.getBoundingClientRect();
    this.drag = {
      mode: resizing ? 'resize' : 'move',
      startX: event.clientX,
      startY: event.clientY,
      box: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    };
    this.el.root.classList.add('dcc--dragging');
    /* Capture so the drag survives the pointer crossing an <iframe>, a
       scrollbar, or anything else that would otherwise steal the events. */
    event.target.setPointerCapture?.(event.pointerId);
  }

  onPanelMove(event) {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    const from = this.drag.box;

    this.box = this.clampBox(
      this.drag.mode === 'move'
        ? { ...from, x: from.x + dx, y: from.y + dy }
        : { ...from, w: from.w + dx, h: from.h + dy }
    );
    this.applyBox();
    /* An open thread should not be left behind by a panel moving out from
       under it — the popover dodges the panel, so the dodge has to keep up. */
    this.placePop();
  }

  onPanelUp() {
    if (!this.drag) return;
    this.drag = null;
    this.el.root.classList.remove('dcc--dragging');
  }

  setMenu(open) {
    const button = this.el.root.querySelector('[data-act="filter-menu"]');
    this.view.menuOpen = open;
    this.el.menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (!open) return;

    this.renderMenu();
    /* Positioned against its button rather than against a corner of the
       window, because the panel it lives on can now be anywhere. Measured
       after the content is in, since an empty menu has no height to flip on. */
    const from = button.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const { offsetWidth: w, offsetHeight: h } = this.el.menu;

    const x = Math.max(8, Math.min(from.right - w, vw - w - 8));
    /* Below the button by default, above it when there is no room below. */
    const y = from.bottom + 6 + h > vh - 8 ? Math.max(8, from.top - h - 6) : from.bottom + 6;
    this.el.menu.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /* ----------------------------------------------------------------------
     TAKING THE PINS OFF THE SCREEN

     A prototype gets shown to the client it was drawn for, and when it does,
     the pins are not part of the work: they are a numbered list of everything
     still wrong with the screen, drawn on top of the screen, in front of the
     person who is paying for it. ?comments=off has always suppressed the lot,
     but it is a URL flag — reachable only by somebody who knows it exists and
     is willing to retype the address at the moment they are already sharing
     their window.

     WHAT GOES AND WHAT STAYS. The pins go and the button stays. They are two
     different things wearing one name: a pin is an annotation drawn over the
     product, and the button is the way into the tool. Hiding the tool as well
     would mean the reviewer sitting through the demo has no way to read the
     thread somebody just mentioned, no way to add the comment the call just
     produced, and no way back except a shortcut they have to have remembered.
     Hiding only the annotations leaves the screen clean and the reviewer
     working — and leaves the way back in plain sight, which is the menu item
     they used on the way out.

     It is remembered, like the rest of the sidebar's settings, because a demo
     is a dozen clicks across a dozen pages and a hide that lasted until the
     first navigation would put the pins back over exactly the audience they
     were taken away from.
     ---------------------------------------------------------------------- */

  hidePins(on) {
    this.view.hidePins = on;
    /* A popover is an annotation too — it is the pin, opened. Leaving one
       floating over the screen after the pins went would be the one comment
       the client does read. */
    if (on) {
      this.stopPlacing();
      this.closePop();
      this.closeLightbox();
      this.toast(`Pins hidden. ${HIDE_KEY_LABEL}, or the filter menu, puts them back.`);
    } else {
      this.clearToast();
    }
    this.el.root.classList.toggle('dcc--nopins', on);
    /* persistFilters redraws the menu, the list and the pins — which is all
       three of the places the answer to this changes. */
    this.persistFilters();
  }

  /**
   * A line of text at the bottom of the screen that says what just happened.
   *
   * On a timer, and short: the pins disappearing is a big enough change to
   * want a word of confirmation, and the client arriving a few seconds later
   * should find no trace of the tool that made it happen.
   */
  toast(message, ms = 7000) {
    window.clearTimeout(this.toastTimer);
    this.el.toast.textContent = message;
    this.el.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => this.clearToast(), ms);
  }

  clearToast() {
    window.clearTimeout(this.toastTimer);
    this.el.toast.hidden = true;
    this.el.toast.textContent = '';
  }

  /* ----------------------------------------------------------------------
     PLACING A NEW COMMENT

     The next click belongs to us, and to nothing else on the page. That
     matters more than it sounds: on these screens a stray click submits a
     form, opens a drawer or navigates away, and losing the screen you were
     trying to comment on is the one failure this mode cannot have.

     So the listeners go on in the CAPTURE phase and stop the event dead —
     mousedown and mouseup as well as click, because a button that reacts on
     mousedown would otherwise fire before the click ever happened.
     ---------------------------------------------------------------------- */

  startPlacing() {
    if (this.view.placing) return;
    this.view.placing = true;
    this.closePop();
    this.setMenu(false);

    document.documentElement.classList.add('dcc-placing');
    this.el.hint.hidden = false;

    document.addEventListener('click', this.onPlaceClick, true);
    document.addEventListener('mousedown', this.swallow, true);
    document.addEventListener('mouseup', this.swallow, true);
    /* Not captured and not swallowed: moving the cursor is the one thing in
       this mode that the page underneath is still welcome to see. */
    document.addEventListener('pointermove', this.onPlaceMove);
  }

  stopPlacing() {
    if (!this.view.placing) return;
    this.view.placing = false;

    document.documentElement.classList.remove('dcc-placing');
    this.el.hint.hidden = true;

    document.removeEventListener('click', this.onPlaceClick, true);
    document.removeEventListener('mousedown', this.swallow, true);
    document.removeEventListener('mouseup', this.swallow, true);
    document.removeEventListener('pointermove', this.onPlaceMove);

    window.cancelAnimationFrame(this.placeFrame);
    this.placeFrame = 0;
    this.placingBox = null;
    this.positionHalo();
  }

  /**
   * While placing: outline the element the click would land on.
   *
   * This is the half of "pin it to the right thing" that happens BEFORE the
   * comment exists. A click is snapped up to the nearest thing worth naming
   * (see snapTarget), and that snap is invisible — a reviewer aiming at a
   * chip and hitting the row it sits in has no way of knowing until somebody
   * else opens their comment and finds it pointing at the row. Drawing the
   * snapped element under the cursor makes the choice visible while it is
   * still a choice.
   *
   * Measured once per frame rather than once per move: elementFromPoint plus
   * a walk up the ancestors for every pointermove on a dense screen is real
   * work, and the answer cannot change more often than the screen redraws.
   */
  onPlaceMove(event) {
    const { clientX, clientY } = event;
    if (this.placeFrame) return;
    this.placeFrame = requestAnimationFrame(() => {
      this.placeFrame = 0;
      if (!this.view.placing) return;
      this.placingBox = targetBox(clientX, clientY);
      this.positionHalo();
    });
  }

  /** Our own controls stay live while placing — Cancel has to be clickable. */
  swallow(event) {
    if (this.el.root.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  onPlaceClick(event) {
    if (this.el.root.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();

    const anchor = captureAnchor(event.clientX, event.clientY);
    this.stopPlacing();
    if (!anchor) return;

    this.view.composing = { anchor, at: { x: event.clientX, y: event.clientY } };
    this.view.activeId = null;
    this.shots = [];
    this.renderPop();
    /* renderPop draws the popover and nothing else; the outline around the
       element being commented on is drawn with the pins. */
    this.positionHalo();
  }

  /* ----------------------------------------------------------------------
     IMAGES ON THE WAY IN
     ---------------------------------------------------------------------- */

  /**
   * Stage some files against the comment being written.
   *
   * Each gets a slot in the strip immediately, showing that it is on its way,
   * and the slot fills in when the upload finishes. Doing it the other way
   * round — nothing on screen until the round trip completes — reads as a
   * picker that ignored you, and people click it again.
   */
  async addShots(list) {
    const room = MAX_PER_COMMENT - this.shots.length;
    const files = [...list].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
    if (!files.length) return;

    for (const file of files) {
      const slot = { name: file.name || 'image', busy: true };
      this.shots.push(slot);
      this.renderShots();

      try {
        Object.assign(slot, await attach(file), { busy: false });
      } catch (error) {
        Object.assign(slot, { busy: false, error: error.message });
      }
      this.renderShots();
    }
  }

  /**
   * Redraw only the thumbnail strip.
   *
   * Only the strip, because an upload finishing must not disturb the sentence
   * being typed next to it — which redrawing the whole popover would do.
   */
  renderShots() {
    const strip = this.el.pop.querySelector('[data-shots]:not(.dcc__shots--sent)');
    if (!strip) return;

    strip.innerHTML = this.shots
      .map((shot, index) => {
        if (shot.busy) {
          return `<span class="dcc__shot dcc__shot--busy" aria-label="Adding ${esc(shot.name)}">
            ${icon('spinner')}</span>`;
        }
        if (shot.error) {
          return `<span class="dcc__shot dcc__shot--bad" title="${esc(shot.error)}">
            ${icon('warning')}
            <button type="button" class="dcc__shot-x" data-act="drop-shot" data-index="${index}"
              aria-label="Remove ${esc(shot.name)}">${icon('close')}</button></span>`;
        }
        return `<span class="dcc__shot">
          <img src="${esc(shot.url)}" alt="${esc(shot.name)}" />
          <button type="button" class="dcc__shot-x" data-act="drop-shot" data-index="${index}"
            aria-label="Remove ${esc(shot.name)}">${icon('close')}</button></span>`;
      })
      .join('');
  }

  /** What is actually ready to be saved with the comment. */
  takeShots() {
    const ready = this.shots
      .filter((s) => s.url)
      .map(({ url, name, w, h, inline }) => ({ url, name, w, h, ...(inline ? { inline } : {}) }));
    this.shots = [];
    return ready.length ? ready : null;
  }

  openLightbox(src) {
    if (!src) return;
    this.el.lightbox.querySelector('img').src = src;
    this.el.lightbox.hidden = false;
  }

  closeLightbox() {
    this.el.lightbox.hidden = true;
    this.el.lightbox.querySelector('img').removeAttribute('src');
  }

  /* ----------------------------------------------------------------------
     WRITING
     ---------------------------------------------------------------------- */

  saveNew(form) {
    const author = form.elements.author.value.trim();
    const body = form.elements.body.value.trim();
    if (!author || !body) return;

    store.setAuthor(author);
    const { anchor } = this.view.composing || {};

    const { row, saved } = store.add({
      screen_key: this.screen.key,
      screen_label: this.screen.label,
      page_url: here(),
      parent_id: null,
      author,
      body,
      anchor,
      /* Spread rather than always present. PostgREST rejects a write naming a
         column the table does not have, so a prototype whose database has not
         been given the images column yet must not send the key at all — or
         every comment, picture or no picture, would fail to save. */
      ...withImages(this.takeShots()),
    });
    /* The pin is drawn from the line above; this only decides whether the
       sidebar has to admit the comment never left this machine. */
    saved.then(() => this.renderStatus());

    /* Your own comment is read the moment you write it, or the badge would
       count it against you. */
    store.markRead([row.id]);
    this.rows.push(row);
    this.read = store.readIds();

    this.view.composing = null;
    /* Only if it is not already open. setOpen re-reads the table and puts the
       caret in the search box, and doing either to somebody who has just
       pressed Comment is wrong: the list they are looking at jumps, and the
       focus lands somewhere they did not ask for. */
    if (!this.view.open) this.setOpen(true);
    this.openThread(row.id);
    this.render();
  }

  saveReply(form) {
    const root = this.byId(this.view.activeId);
    if (!root) return;

    const nameField = form.elements.author;
    const author = (nameField ? nameField.value : store.author()).trim();
    const body = form.elements.body.value.trim();
    if (!author || !body) return;

    store.setAuthor(author);
    const { row, saved } = store.add({
      screen_key: root.screen_key,
      screen_label: root.screen_label,
      page_url: root.page_url,
      parent_id: root.id,
      author,
      body,
      anchor: null,
      ...withImages(this.takeShots()),
    });
    saved.then(() => this.renderStatus());

    store.markRead([row.id]);
    this.rows.push(row);
    this.read = store.readIds();
    this.render();
  }

  async toggleResolved(id) {
    const row = this.byId(id);
    if (!row) return;

    const resolved = !row.resolved;
    Object.assign(row, {
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? store.author() || null : null,
    });
    this.render();

    await store.patch(id, {
      resolved,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
    });
  }

  async destroy(id) {
    const row = this.byId(id);
    if (!row) return;
    const isRoot = !row.parent_id;
    const replies = isRoot ? this.repliesOf(id).length : 0;
    const what = isRoot && replies ? `this comment and its ${replies} repl${replies === 1 ? 'y' : 'ies'}` : 'this comment';
    if (!window.confirm(`Delete ${what}?`)) return;

    /* Everything about to disappear, gathered before it does — deleting a root
       cascades to its replies, and their images are as much part of what is
       being deleted as the root's own. */
    const going = isRoot ? [row, ...this.repliesOf(id)] : [row];
    const files = going.flatMap((c) => c.images || []).map((im) => im.url);

    this.rows = this.rows.filter((r) => r.id !== id && r.parent_id !== id);
    if (this.view.activeId === id) this.closePop();
    this.render();

    await store.remove(id);
    await Promise.all(files.map((url) => store.deleteImage(url)));
  }

  /* ----------------------------------------------------------------------
     OPENING A THREAD
     ---------------------------------------------------------------------- */

  openThread(id) {
    const root = this.byId(id);
    if (!root) return;

    /* A pin parked on the edge of a scroller is not sitting on the thing it is
       about, so opening its thread has to go and fetch that thing first —
       otherwise the reader gets a comment about a row they cannot see, which
       is the same dead end as the pin having vanished. Harmless for a pin that
       is already in view: scrollIntoView on something centred does nothing. */
    if (resolveAnchor(root.anchor)?.offscreen) this.reveal(root);

    this.view.composing = null;
    this.view.activeId = id;
    /* Images staged against a comment that was never sent do not follow the
       reviewer into the next thread they open. */
    if (this.popMode !== `thread:${id}`) this.shots = [];

    store.markRead([root.id, ...this.repliesOf(root.id).map((r) => r.id)]);
    this.read = store.readIds();

    this.renderPop();
    this.renderList();
    this.renderPins();
    this.renderCount();
  }

  /**
   * A row in the list was chosen: go to that comment.
   *
   * "Go to" is meant literally, and it is the reason the list is worth having
   * at all. A comment is about a place on a screen, and that place is very
   * often somewhere you cannot currently see — three thousand pixels down a
   * chart, inside a table that scrolls on its own, on a screen you are not
   * even on. Picking it out of a list and being shown its text tells you
   * nothing you could act on; being taken to it is the whole point.
   *
   * So four cases, in order of how far away the thing is:
   *   - another screen  → navigate there, and pick it up again on arrival
   *   - another view    → press the tabs it was left under, then carry on as
   *                       below once the screen has redrawn itself
   *   - off-screen here → scroll its element into view, through however many
   *                       nested scrolling regions it sits in
   *   - already visible → just open it, and flash the pin so the eye lands on
   *                       the right one of the eleven on this screen
   */
  focusThread(id) {
    const root = this.byId(id);
    if (!root) return;

    if (root.screen_key !== this.screen.key && root.page_url) {
      location.href = `${root.page_url}#dc-${root.id}`;
      return;
    }

    /* On this screen but behind another tab. Pressing it is a real navigation
       as far as the screen is concerned — a module swaps, a table refetches —
       so the element this comment is pinned to does not exist yet on this
       line. One frame, and then the rest of the trip happens as usual. */
    if (restoreView(root.anchor)) {
      requestAnimationFrame(() => {
        this.reveal(root);
        this.openThread(id);
        this.flashPin(id);
      });
      return;
    }

    this.reveal(root);
    this.openThread(id);
    this.flashPin(id);
  }

  /**
   * Bring a comment's element into view.
   *
   * scrollIntoView rather than any arithmetic of our own: it is the only thing
   * that knows how to scroll an element that is inside a scrolling table
   * inside a scrolling panel inside the window, which on these screens is a
   * routine amount of nesting. Smooth, because a page that teleports leaves
   * the reader with no idea whether they moved or the content did.
   */
  reveal(root) {
    const el = anchorElement(root?.anchor);
    if (!el) return false;
    /* Smooth unless the reader has asked the system for less motion, in which
       case a long smooth scroll across a dense screen is exactly what they
       asked not to have. */
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    return true;
  }

  /**
   * A pulse on the pin that was just chosen.
   *
   * The active pin is already drawn differently, but that is a state you have
   * to go looking for. On a screen carrying a dozen pins, arriving from a list
   * and having to find which one you asked for is the small failure that makes
   * people stop using the list.
   */
  flashPin(id) {
    const pin = this.el.pins.querySelector(`[data-id="${cssId(id)}"]`);
    if (!pin) return;

    window.clearTimeout(this.flashTimer);
    /* Removing and forcing a reflow before re-adding restarts the animation.
       Without it, choosing the same comment twice in a row does nothing the
       second time. */
    pin.classList.remove('dcc__pin--flash');
    void pin.offsetWidth;
    pin.classList.add('dcc__pin--flash');
    this.flashTimer = window.setTimeout(() => pin.classList.remove('dcc__pin--flash'), 1500);
  }

  closePop() {
    this.view.activeId = null;
    this.view.composing = null;
    this.shots = [];
    this.popMode = null;
    this.el.pop.hidden = true;
    this.el.pop.innerHTML = '';
    this.renderPins();
  }

  /* ======================================================================
     DRAWING
     ====================================================================== */

  render() {
    this.renderCount();
    this.renderPins();
    this.renderList();
    this.renderStatus();
    if (!this.el.pop.hidden) this.renderPop();
  }

  renderCount() {
    const unread = this.rows.filter((r) => !r.parent_id && !r.resolved && this.isUnread(r)).length;
    this.el.count.textContent = unread > 99 ? '99+' : String(unread);
    this.el.count.hidden = unread === 0;
  }

  renderStatus() {
    const { configured, health } = store.connection();
    const offline = !configured || health === 'offline';
    this.el.status.hidden = !offline;
    this.el.status.textContent = configured
      ? 'Offline — comments are saved on this machine and will not reach anyone else.'
      : 'No Supabase configured — comments are saved in this browser only.';
  }

  /* ----------------------------------------------------------------------
     PINS

     Numbered in the order they were written, so "see pin 3" means the same
     thing to two people looking at the same screen. Resolved pins leave the
     numbering intact rather than closing the gap, for the same reason.
     ---------------------------------------------------------------------- */

  renderPins() {
    if (this.view.hidePins) {
      this.el.pins.innerHTML = '';
      return;
    }
    const roots = this.screenRoots();
    this.el.pins.innerHTML = roots
      .map((root, index) => {
        if (root.resolved && !this.view.showResolved) return '';
        const classes = [
          'dcc__pin',
          root.resolved ? 'dcc__pin--resolved' : '',
          this.view.activeId === root.id ? 'dcc__pin--active' : '',
          this.isUnread(root) ? 'dcc__pin--unread' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const replies = this.repliesOf(root.id).length;
        const label = `Comment ${index + 1} by ${root.author}${replies ? `, ${replies} replies` : ''}`;
        return `<button type="button" class="${classes}" data-act="open-thread" data-id="${esc(root.id)}"
          aria-label="${esc(label)}" hidden>
          <span class="dcc__pin-n">${root.resolved ? icon('check') : index + 1}</span>
        </button>`;
      })
      .join('');
    this.positionPins();
  }

  positionPins() {
    for (const pin of this.el.pins.children) {
      const row = this.byId(pin.dataset.id);
      const at = row && resolveAnchor(row.anchor);
      if (!at) {
        pin.hidden = true;
        continue;
      }
      pin.hidden = false;
      pin.classList.toggle('dcc__pin--detached', at.detached);
      /* Parked on the edge of a region its element has scrolled out of. Drawn
         quieter than a live pin, because it is pointing off the screen rather
         than at anything under it — and clicking it scrolls the element back
         (see openThread). */
      pin.classList.toggle('dcc__pin--offscreen', !!at.offscreen);
      /* Bottom-left of the pin sits on the point that was clicked, the way a
         speech bubble's tail does. */
      pin.style.transform = `translate(${Math.round(at.x)}px, calc(${Math.round(at.y)}px - 100%))`;
    }
    this.positionHalo();
    this.placePop();
  }

  /* ----------------------------------------------------------------------
     THE HALO

     WHICH THING THE COMMENT IS ABOUT.

     A pin marks the pixel that was clicked, and on these screens a pixel is
     not an answer. A dot between two table rows belongs to one of them; a dot
     an inch inside a card with a heading, four fields and three buttons on it
     belongs to one of those eight things. The reviewer knew which — they were
     pointing at it — and by the time the note reaches whoever has to act on
     it, that knowledge is gone and "make this bigger" is a guess.

     The anchor has always recorded the ELEMENT rather than the point (see
     anchor.js), so the element was known all along; it simply was not drawn.
     Now it is: opening a thread, or merely pointing at its row in the list,
     boxes the exact element the comment was left on, and the box rides that
     element through scroll, reflow and re-render the same way the pin does.
     ---------------------------------------------------------------------- */

  /**
   * Outline the element behind the row being pointed at, or behind the open
   * thread.
   *
   * The pointer wins over the open thread, and only while it is on a row: a
   * reader with one thread open who runs the cursor down the list is asking
   * where each of those OTHER comments points, and answering with the thread
   * they already have open would be answering a question nobody asked. The
   * moment the cursor leaves the list the outline goes back to the thread
   * being read.
   */
  positionHalo() {
    const id = this.hoverId || this.view.activeId;
    const row = id ? this.byId(id) : null;
    /* While a comment is being written, the outline is around the thing it is
       being written ABOUT — which is the moment it is worth the most, because
       it is the reviewer's own confirmation that the click landed on the
       control they meant and not on the eight hundred pixels of card around
       it. If it grabbed the wrong thing they can cancel and click again,
       which is a great deal cheaper than finding out a week later. */
    const anchor = this.view.composing ? this.view.composing.anchor : row?.anchor;
    const box = this.view.placing ? this.placingBox : anchor && anchorBox(anchor);

    /* Pins off, halo off with them: "hide pins" means the screen underneath is
       wanted clean, for a screenshot or a demo, and a box drawn round a button
       is no less of an annotation than the pin was. Placing is the exception,
       because there the outline is not an annotation but the aim — turning it
       off would be hiding the sights on the gun. */
    if (this.view.hidePins && !this.view.placing) {
      this.el.halo.hidden = true;
      return;
    }

    /* Nothing to box: no comment in hand, or its element is gone, hidden,
       behind another tab, or scrolled out of its own well. anchorBox says so
       in every one of those cases, and the honest drawing is none. */
    if (!box) {
      this.el.halo.hidden = true;
      return;
    }

    this.el.halo.hidden = false;

    /* A whole card rather than a control in it. Nothing has gone wrong — some
       comments really are about a region — but a solid box round half the
       screen reads as a mistake, and a reviewer placing one can see from the
       dashes that moving the cursor onto the control itself would pin
       something smaller. */
    this.el.halo.classList.toggle('dcc__halo--region', isRegion(box));

    /* Quieter when the element is only being GLANCED at: a hover is a glance,
       and a full-strength box on every row the cursor crosses on its way down
       the list would strobe. Not for the row of the thread that is open,
       though — the cursor resting there points at the element the thread is
       already about, and dimming the box for that is dimming it for agreeing
       with itself. */
    this.el.halo.classList.toggle(
      'dcc__halo--hover',
      Boolean(this.hoverId) && this.hoverId !== this.view.activeId
        && !this.view.composing && !this.view.placing,
    );
    this.el.halo.style.transform = `translate(${Math.round(box.left)}px, ${Math.round(box.top)}px)`;
    this.el.halo.style.width = `${Math.round(box.width)}px`;
    this.el.halo.style.height = `${Math.round(box.height)}px`;
  }

  /**
   * The cursor moved onto something, or focus did.
   *
   * Anything that is not a comment row or a pin clears the outline, which is
   * what makes moving off the sidebar and back onto the screen put it away.
   */
  onPointerOver(event) {
    const target = event.target instanceof Element ? event.target : null;
    const hit = target?.closest('.dcc__row, .dcc__pin');
    this.setHover(hit?.dataset.id || null);
  }

  setHover(id) {
    if (this.hoverId === id) return;
    this.hoverId = id;
    /* Only the halo changes, so only the halo is redrawn — rebuilding the
       list on a hover would drop the hover that caused it. */
    this.positionHalo();
  }

  schedule() {
    if (this.frame) return;
    /* Nothing to keep up with when the pins are off and no thread is open,
       and a demo is the worst moment to spend a frame per scroll event on it. */
    if (this.view.hidePins && this.el.pop.hidden) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.positionPins();
      this.syncView();
    });
  }

  /**
   * A tab was pressed: say so in the sidebar.
   *
   * positionPins already does the visible half — a pin whose view has closed
   * stops being drawn, on the same frame, because the mutation the switch made
   * scheduled this. The list is the other half and cannot be redrawn as
   * freely: it is rebuilt whole, which loses a hover and any scroll position
   * in it, so it is only rebuilt when the answer it gives would actually
   * differ. One string compare decides that.
   */
  syncView() {
    const stamp = viewSignature();
    if (stamp === this.viewStamp) return;
    this.viewStamp = stamp;
    this.renderList();
  }

  /* ----------------------------------------------------------------------
     THE LIST
     ---------------------------------------------------------------------- */

  renderList() {
    const roots = this.listRoots();
    this.viewStamp = viewSignature();

    if (!roots.length) {
      this.el.list.innerHTML = `<p class="dcc__empty">${
        this.rows.length ? 'Nothing matches those filters.' : 'No comments yet. Press New comment, then click anywhere on the screen.'
      }</p>`;
      return;
    }

    /* The pin number is per screen, so it comes from that screen's own
       ordering rather than from this list's — which is sorted differently and
       filtered besides. */
    const numbers = new Map(this.screenRoots().map((r, i) => [r.id, i + 1]));

    this.el.list.innerHTML = roots
      .map((root) => {
        const replies = this.repliesOf(root.id);
        const shots = [root, ...replies].reduce((n, c) => n + (c.images?.length || 0), 0);
        const unread = this.isUnread(root);
        const here = root.screen_key === this.screen.key;
        const number = numbers.get(root.id);
        /* On this screen, but behind a tab that is not the open one. There is
           no pin to point at, so the row says which view instead — and
           pressing the row presses that tab (see focusThread). */
        const elsewhere = here ? viewLabel(root.anchor) : '';

        /* WHAT IT IS ABOUT, in words, for the rows that cannot show it any
           other way. On this screen and in this view there is a pin to look
           at and a halo under the cursor, and naming the element in the row as
           well would be a third telling of the same thing. On another screen,
           or behind another tab, there is neither — so the row is all the
           reader has, and "Save note — button" is the difference between a
           list of remarks and a list of remarks about something. */
        const about = here && !elsewhere ? '' : anchorLabel(root.anchor);

        const chips = [
          !here ? `<span class="dcc__chip">${esc(root.screen_label || root.screen_key)}</span>` : '',
          about
            ? `<span class="dcc__chip dcc__chip--about"
                 title="Left on ${esc(about)}">${esc(about)}</span>`
            : '',
          elsewhere
            ? `<span class="dcc__chip dcc__chip--view"
                 title="Left on ${esc(elsewhere)}. Open this comment to go back there.">${esc(elsewhere)}</span>`
            : '',
          replies.length
            ? `<span class="dcc__chip">${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}</span>`
            : '',
          shots
            ? `<span class="dcc__chip" title="${shots} image${shots === 1 ? '' : 's'} in this thread">${icon('image')}${shots}</span>`
            : '',
          root.resolved ? `<span class="dcc__chip dcc__chip--ok">Resolved</span>` : '',
        ]
          .filter(Boolean)
          .join('');

        /* The number is only worth showing while the pin wearing it is on
           screen. A row numbered 4 beside a screen with no pin 4 on it sends
           the reader looking for something that is not there — which is true
           of a comment behind another tab, and just as true of every comment
           on the screen once the pins have been hidden. */
        const numbered = here && number && !elsewhere && !this.view.hidePins;

        return `<article class="dcc__row${this.view.activeId === root.id ? ' dcc__row--active' : ''}${
          root.resolved ? ' dcc__row--resolved' : ''
        }" data-act="focus-thread" data-id="${esc(root.id)}" role="button" tabindex="0">
          <span class="dcc__avatar${numbered ? ' dcc__avatar--pin' : ''}" aria-hidden="true">${
            numbered ? number : esc(initials(root.author))
          }</span>
          <div class="dcc__row-main">
            <div class="dcc__row-head">
              <span class="dcc__row-author">${esc(root.author)}</span>
              <span class="dcc__row-time">${esc(ago(root.created_at))}</span>
              ${unread ? '<span class="dcc__dot" aria-label="Unread"></span>' : ''}
            </div>
            <p class="dcc__row-body">${esc(root.body)}</p>
            ${chips ? `<div class="dcc__row-meta">${chips}</div>` : ''}
          </div>
        </article>`;
      })
      .join('');
  }

  renderMenu() {
    const { sort, showResolved, mine, currentPage, hidePins } = this.view;
    const item = (act, value, label, on) =>
      `<button type="button" role="menuitemcheckbox" aria-checked="${on}"
         class="dcc__menu-item${on ? ' dcc__menu-item--on' : ''}"
         data-act="${act}" data-value="${value}">
         <span class="dcc__menu-tick">${on ? icon('check') : ''}</span>${esc(label)}
       </button>`;

    this.el.menu.innerHTML = `
      ${item('sort', 'date', 'Sort by date', sort === 'date')}
      ${item('sort', 'unread', 'Sort by unread', sort === 'unread')}
      <div class="dcc__menu-rule" role="separator"></div>
      ${item('filter', 'showResolved', 'Show resolved comments', showResolved)}
      ${item('filter', 'mine', 'Only your threads', mine)}
      ${item('filter', 'currentPage', 'Only current page', currentPage)}
      <div class="dcc__menu-rule" role="separator"></div>
      <button type="button" role="menuitemcheckbox" aria-checked="${hidePins}"
        class="dcc__menu-item${hidePins ? ' dcc__menu-item--on' : ''}" data-act="hide-pins">
        <span class="dcc__menu-tick">${icon(hidePins ? 'eye-off' : 'eye')}</span>Hide pins on the screen
        <span class="dcc__menu-key">${esc(HIDE_KEY_LABEL)}</span>
      </button>`;
  }

  /* ----------------------------------------------------------------------
     THE POPOVER — one element, two jobs
     ---------------------------------------------------------------------- */

  /**
   * Draw the popover, WITHOUT throwing away what is being typed into it.
   *
   * The preservation is not a nicety. Every poll redraws this, and a reviewer
   * writing a careful paragraph about why a screen is wrong takes considerably
   * longer than fifteen seconds — so the old version of this method quietly
   * deleted their comment out from under them, mid-sentence, on a timer. The
   * same redraw also pulled focus back to the first field, which moved the
   * caret to the top of a half-written note.
   *
   * So: if the popover is showing the same thing it was showing a moment ago,
   * every field value and the caret position are carried across, and focus is
   * left where the reviewer put it. Focus is only taken when the popover is
   * showing something NEW, which is the one time it is wanted.
   */
  renderPop() {
    const mode = this.view.composing
      ? 'compose'
      : this.view.activeId
        ? `thread:${this.view.activeId}`
        : null;

    if (!mode) {
      this.el.pop.hidden = true;
      this.popMode = null;
      return;
    }

    const carry = mode === this.popMode ? this.popState() : null;
    this.el.pop.innerHTML = this.view.composing ? this.composerMarkup() : this.threadMarkup();
    this.popMode = mode;
    this.el.pop.hidden = false;
    this.renderShots();
    this.placePop();

    if (carry) this.restorePop(carry);
    else this.el.pop.querySelector('textarea, input')?.focus();
  }

  /** Field values, and where the caret is, before a redraw. */
  popState() {
    const active = document.activeElement;
    const values = {};
    for (const field of this.el.pop.querySelectorAll('input[name], textarea[name]')) {
      values[field.name] = field.value;
    }
    return {
      values,
      focused: this.el.pop.contains(active) ? active.name : null,
      start: active?.selectionStart,
      end: active?.selectionEnd,
    };
  }

  restorePop({ values, focused, start, end }) {
    for (const field of this.el.pop.querySelectorAll('input[name], textarea[name]')) {
      if (values[field.name] !== undefined) field.value = values[field.name];
    }
    if (!focused) return;
    const field = this.el.pop.querySelector(`[name="${focused}"]`);
    if (!field) return;
    field.focus();
    try {
      field.setSelectionRange(start, end);
    } catch {
      /* A field with no text selection API — nothing to put back. */
    }
  }

  composerMarkup() {
    const name = store.author();
    return `<form class="dcc__pop-form">
      <label class="dcc__field">
        <span class="dcc__field-label">Your name</span>
        <input class="dcc__input" name="author" value="${esc(name)}" autocomplete="name" required />
      </label>
      <label class="dcc__field">
        <span class="dcc__field-label">Comment</span>
        <textarea class="dcc__textarea" name="body" rows="3"
          placeholder="What should change here?" required></textarea>
      </label>
      <div class="dcc__shots" data-shots></div>
      <div class="dcc__pop-actions">
        ${attachButton()}
        <span class="dcc__spacer"></span>
        <button type="button" class="dcc__btn" data-act="close-pop">Cancel</button>
        <button type="submit" class="dcc__btn dcc__btn--primary">Comment</button>
      </div>
    </form>`;
  }

  threadMarkup() {
    const root = this.byId(this.view.activeId);
    if (!root) return '';

    const number = this.screenRoots().findIndex((r) => r.id === root.id) + 1;
    const messages = [root, ...this.repliesOf(root.id)];
    const name = store.author();

    const message = (c) => `<li class="dcc__msg">
      <span class="dcc__avatar dcc__avatar--sm" aria-hidden="true">${esc(initials(c.author))}</span>
      <div class="dcc__msg-main">
        <div class="dcc__row-head">
          <span class="dcc__row-author">${esc(c.author)}</span>
          <span class="dcc__row-time">${esc(ago(c.created_at))}</span>
          <button type="button" class="dcc__icon-btn dcc__icon-btn--sm dcc__msg-delete"
            data-act="delete" data-id="${esc(c.id)}"
            aria-label="Delete ${c.parent_id ? 'reply' : 'comment'}">${icon('trash')}</button>
        </div>
        <p class="dcc__msg-body">${esc(c.body)}</p>
        ${shotStrip(c.images)}
      </div>
    </li>`;

    return `<div class="dcc__thread">
      <header class="dcc__thread-head">
        <span class="dcc__thread-n">${root.resolved ? icon('check') : number}</span>
        <span class="dcc__thread-title">${root.resolved ? 'Resolved' : 'Comment'}</span>
        ${
          root.resolved
            ? ''
            : `<button type="button" class="dcc__icon-btn dcc__icon-btn--sm"
                 data-act="toggle-resolve" data-id="${esc(root.id)}"
                 title="Mark resolved" aria-label="Mark resolved">${icon('check-circle')}</button>`
        }
        <button type="button" class="dcc__icon-btn dcc__icon-btn--sm" data-act="close-pop"
          aria-label="Close">${icon('close')}</button>
      </header>
      ${detachedNote(root.anchor)}
      ${
        /* Resolving is not deleting, and the way back has to be visible from
           the thread itself. An icon that silently changes meaning once
           pressed does not read as "this can be undone" — a word does. */
        root.resolved
          ? `<p class="dcc__thread-note">
               <span>Resolved${root.resolved_by ? ` by ${esc(root.resolved_by)}` : ''}.</span>
               <button type="button" class="dcc__link" data-act="toggle-resolve"
                 data-id="${esc(root.id)}">Reopen</button>
             </p>`
          : ''
      }
      <ul class="dcc__msgs">${messages.map(message).join('')}</ul>
      <form class="dcc__reply">
        ${
          name
            ? ''
            : `<input class="dcc__input" name="author" placeholder="Your name" autocomplete="name" required />`
        }
        <textarea class="dcc__textarea" name="body" rows="2" placeholder="Reply…" required></textarea>
        <div class="dcc__shots" data-shots></div>
        <div class="dcc__pop-actions">
          ${attachButton()}
          <span class="dcc__spacer"></span>
          <button type="submit" class="dcc__btn dcc__btn--primary">Comment</button>
        </div>
      </form>
    </div>`;
  }

  /**
   * Keep the popover beside the thing it is about, inside the window, and out
   * from under the panel. Recomputed on every reposition, so it rides its pin.
   *
   * Four placements are tried — below-right of the pin first, then the three
   * other corners — and the first one that does not collide with the panel
   * wins. Corners rather than arithmetic because the panel now moves: there is
   * no fixed edge to subtract any more, and "somewhere else near the pin" is
   * both simpler and better than a computed near-miss.
   */
  placePop() {
    const pop = this.el.pop;
    if (pop.hidden) return;

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const { offsetWidth: w, offsetHeight: h } = pop;

    const at = this.view.composing
      ? this.view.composing.at
      : resolveAnchor(this.byId(this.view.activeId)?.anchor);

    /* No anchor to sit beside: the element is hidden behind a closed tab, or
       the comment was left on a part of the screen that is not currently
       drawn. The thread is still worth reading and replying to, so it goes in
       the middle of the window rather than being left at the top-left corner
       the transform started at — which is what happened before, and read as a
       bug every time. */
    if (!at) {
      pop.style.transform =
        `translate(${Math.round((vw - w) / 2)}px, ${Math.round((vh - h) / 2)}px)`;
      return;
    }

    const inside = (c) => ({
      x: Math.max(12, Math.min(c.x, vw - w - 12)),
      y: Math.max(12, Math.min(c.y, vh - h - 12)),
    });
    const corners = [
      { x: at.x + 16, y: at.y + 16 },
      { x: at.x - w - 16, y: at.y + 16 },
      { x: at.x + 16, y: at.y - h - 16 },
      { x: at.x - w - 16, y: at.y - h - 16 },
    ].map(inside);

    const panel = this.view.open ? this.el.panel.getBoundingClientRect() : null;
    const spot = corners.find((c) => !panel || !overlaps(c, w, h, panel)) || corners[0];

    pop.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
  }

  /* ======================================================================
     GLOBAL KEYS AND CLICKS
     ====================================================================== */

  onDocumentClick(event) {
    if (this.el.root.contains(event.target)) return;
    /* A click on the page dismisses the transient surfaces but leaves the
       sidebar alone — it is a workspace, not a menu, and closing it because
       somebody scrolled a table would be maddening. */
    if (this.view.menuOpen) this.setMenu(false);
    if (!this.el.pop.hidden) this.closePop();
  }

  onKeydown(event) {
    if (isHideChord(event)) {
      /* Refused in one place only: a field of our own with the caret in it.
         Hiding closes an open composer, and losing what somebody wrote is the
         one failure this layer must never have.

         Not refused merely because focus is somewhere on the layer, which it
         usually is — the last thing anybody pressed before reaching for this
         is the button or the menu item next to it, and a shortcut that stopped
         working after you touched the panel would be a shortcut nobody trusts.
         Nor refused over the product's own fields: the chord takes nothing
         away from them, and several screens put focus in a search box the
         moment they load. */
      const typing =
        this.el.root.contains(event.target) &&
        event.target.closest?.('input, textarea, [contenteditable="true"]');
      if (!typing) {
        event.preventDefault();
        this.hidePins(!this.view.hidePins);
        return;
      }
    }
    if (event.key !== 'Escape') return;
    if (!this.el.lightbox.hidden) {
      this.closeLightbox();
      event.stopPropagation();
    } else if (this.view.placing) {
      this.stopPlacing();
      event.stopPropagation();
    } else if (this.view.menuOpen) {
      this.setMenu(false);
      event.stopPropagation();
    } else if (!this.el.pop.hidden) {
      this.closePop();
      event.stopPropagation();
    }
  }
}

/* ==========================================================================
   MARKUP AND SMALL HELPERS
   ========================================================================== */

const TEMPLATE = `
  <!-- The outline around the element a comment is about. Before the pins in
       source order so a pin always draws over its own halo. -->
  <div class="dcc__halo" aria-hidden="true" hidden></div>

  <div class="dcc__pins"></div>

  <button type="button" class="dcc__fab" data-act="toggle-panel" aria-expanded="false"
    aria-label="Review comments">
    ${icon('chat')}
    <span class="dcc__fab-count" hidden></span>
  </button>

  <aside class="dcc__panel" aria-label="Review comments" hidden>
    <!-- The drag bar. The controls moved up out of the search row and onto it,
         so the bar has something to be besides a grab handle, and the search
         row is only search. -->
    <div class="dcc__drag">
      <span class="dcc__grab" aria-hidden="true">${icon('grip')}</span>
      <span class="dcc__title">Comments</span>
      <button type="button" class="dcc__icon-btn" data-act="filter-menu"
        aria-expanded="false" aria-label="Sort and filter">${icon('filter')}</button>
      <button type="button" class="dcc__icon-btn" data-act="close-panel"
        aria-label="Close comments">${icon('close')}</button>
    </div>
    <div class="dcc__panel-head">
      <div class="dcc__search">
        ${icon('search')}
        <input type="search" class="dcc__search-input" placeholder="Search"
          aria-label="Search comments" />
      </div>
    </div>
    <div class="dcc__panel-body">
      <button type="button" class="dcc__new" data-act="new-comment">
        ${icon('plus')}New comment
      </button>
      <p class="dcc__status" hidden></p>
      <div class="dcc__list"></div>
    </div>
    <span class="dcc__grip" aria-hidden="true" title="Drag to resize">${icon('expand')}</span>
  </aside>

  <div class="dcc__menu" role="menu" hidden></div>
  <div class="dcc__pop" hidden></div>

  <!-- A picture attached to a comment is nearly always a screenshot, and a
       screenshot shrunk to 250px in a thread is a grey smear. Clicking one
       opens it at the size it was actually taken at. -->
  <div class="dcc__lightbox" data-act="close-lightbox" hidden>
    <button type="button" class="dcc__icon-btn dcc__lightbox-close" data-act="close-lightbox"
      aria-label="Close image">${icon('close')}</button>
    <img alt="" />
  </div>

  <!-- Said once, on the way out, and then gone. See toast(). -->
  <div class="dcc__toast" role="status" hidden></div>

  <div class="dcc__hint" role="status" hidden>
    <span>Click anywhere on the screen to place your comment.</span>
    <button type="button" class="dcc__btn dcc__btn--ghost" data-act="cancel-placing">Cancel</button>
  </div>
`;

/**
 * The address to store against a comment, so a row in the sidebar can take you
 * back to the screen it was left on.
 *
 * The query string is kept — on these screens it is often the difference
 * between two views of the same page, and a comment about the "mine" tab of
 * the task list should reopen that tab. Everything except the layer's own
 * on/off flag, which is furniture and would follow the reviewer around.
 */
function here() {
  const params = new URLSearchParams(location.search);
  params.delete('comments');
  const query = params.toString();
  return location.pathname + (query ? `?${query}` : '');
}

/** Do two rectangles share any pixels? */
function overlaps(at, w, h, rect) {
  return (
    at.x < rect.right && at.x + w > rect.left && at.y < rect.bottom && at.y + h > rect.top
  );
}

/** A uuid is selector-safe already, but not every browser agrees about the
    leading digit, and CSS.escape is the only thing that knows the rules. */
function cssId(id) {
  return window.CSS?.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&');
}

/**
 * "This is not pointing at what it was pointing at."
 *
 * The pin already draws itself dashed when its element has gone, but dashed
 * is a hint and this is the one case where the reader genuinely cannot see
 * what the comment is about — there is no element left to outline, and the
 * pin is parked at raw coordinates over whatever happens to be there now.
 * Reading "make this green" off a dot sitting on an unrelated row is how a
 * comment gets carried out on the wrong thing, so the note says both that the
 * anchor is stale and what it used to be attached to.
 *
 * Nothing is said in the ordinary case. The thread pops up beside its own
 * halo, and naming an element that is outlined two inches away is the
 * duplication the header label was cut for.
 */
function detachedNote(anchor) {
  if (!resolveAnchor(anchor)?.detached) return '';
  const was = anchor?.label ? `“${esc(anchor.label)}”` : 'the element it was left on';
  return `<p class="dcc__thread-note dcc__thread-note--warn">
    ${icon('warning')}
    <span>${was} is no longer on this screen, so this pin is sitting where it
      used to be. The comment may be about something that has since changed.</span>
  </p>`;
}

/** `{ images }` when there are some, and nothing at all when there are not. */
function withImages(images) {
  return images ? { images } : {};
}

/** The attach control, identical on the composer and the reply form. */
function attachButton() {
  return `<button type="button" class="dcc__icon-btn dcc__icon-btn--sm dcc__attach" data-act="pick-image"
      title="Attach an image — or just paste one" aria-label="Attach an image">${icon('paperclip')}</button>
    <input type="file" class="dcc__file" accept="${ACCEPT}" multiple hidden />`;
}

/** The images already on a saved comment. */
function shotStrip(images) {
  if (!images?.length) return '';
  return `<div class="dcc__shots dcc__shots--sent">${images
    .map((im) => {
      /* The local copy for whoever uploaded it, the address for everyone
         else. Same picture either way. */
      const src = localPreview(im.url) || im.url;
      return `<button type="button" class="dcc__shot" data-act="lightbox" data-src="${esc(src)}"
        aria-label="Open ${esc(im.name || 'image')} full size">
        <img src="${esc(src)}" alt="${esc(im.name || 'Attached image')}" loading="lazy" />
      </button>`;
    })
    .join('')}</div>`;
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Everything in a comment is typed by a person, so nothing goes in unescaped. */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/**
 * "3h ago", and a date once it stops being useful to say how long.
 *
 * A week is the cut-off because a design review lasts about that long: inside
 * it, "2d ago" tells you where a comment sits relative to the change you made
 * yesterday, and outside it, only the date means anything.
 */
function ago(iso) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';

  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;

  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
