/**
 * THE SCOPE FEED — THE PICTURE FROM THE PROCESSOR, AND THE CONTROLS ON IT.
 *
 * A panel that behaves like the monitor on the endoscopy stack: a moving
 * lumen, a header that says which scope is producing it, a control bar under
 * it, and a foot pedal. It knows nothing about encounters, findings, jars or
 * photo stores — it draws a feed and reports what was pressed. Everything that
 * decides what a capture MEANS is in the screen that mounts this.
 *
 * WHY THE PICTURE IS DRAWN RATHER THAN PLAYED.
 *
 * There is no stream. This prototype has no server, no capture card and no
 * consented recording of a real colon, and a video file dropped in to stand in
 * for one would be somebody else's patient played back on every demonstration
 * of this screen. So the lumen is an SVG that drifts: folds, a wall, a specular
 * highlight off the wet mucosa and a lesion, moved a few pixels a frame by the
 * ticker below.
 *
 * It is a drawing, and the panel says so in as many words under the controls.
 * What it is NOT is a still image with a red dot on it: the endoscopist has to
 * be able to freeze it, see that it stopped, capture it and find that frame on
 * the report, because that four-step loop is the whole feature and a static
 * picture cannot be used to check that the loop works.
 *
 * WHY A CAPTURE IS THE SVG ITSELF.
 *
 * `capture()` serialises the <svg> exactly as it stands — drift, lesion and
 * all — into a data URL. So the still that lands on the report is the frame
 * that was on the glass, not a re-rendering of one, and freezing before
 * capturing gets you the frame you were looking at when you pressed. No canvas
 * and no rasterisation: an <img> renders an SVG data URL natively, and the
 * whole capture is a couple of kilobytes of text that survives being held on
 * the document's answers like every other prototype attachment.
 *
 * WHAT THE PANEL DOES NOT DO. It never drives the stack. Freeze freezes the
 * PANEL, which is the EHR's copy of the picture; the scope goes on doing
 * whatever the endoscopist's hands are doing with it. See the head of
 * data/procedure-feed.js for why that boundary is where it is.
 */

import { FEED_CLIP_MAX_SECONDS, feedClock } from '../../data/procedure-feed.js';
import { iconMarkup } from './icons.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* How often the scene is nudged, in milliseconds. Slow enough that the drift
   reads as a hand holding a scope rather than as an animation, fast enough
   that freezing feels like it caught something. */
const TICK_MS = 120;

/* ===================== The picture ===================== */

/**
 * The lumen, as one SVG.
 *
 * Authored here rather than loaded as a file for the reason the icon sprite is
 * a string: the prototype has to work from a double-clicked page, where a
 * fetch for an asset is a request the browser refuses. It is also why the
 * gradients are declared inside it — a capture is this element serialised on
 * its own, so anything it refers to from the page around it would arrive on
 * the report as a black rectangle.
 *
 * The ids are suffixed per mount so that two of these on one page — which
 * happens for a frame or two whenever the document repaints — cannot resolve
 * each other's gradients.
 */
function sceneSvg(uid) {
  /* `width`/`height` as ATTRIBUTES as well as in the sheet. They are what an
     <svg> falls back to when no stylesheet has reached it — a component sheet
     that fails to load would otherwise leave this at the 300×150 an <svg> with
     no size defaults to, which is a postage stamp rather than a monitor. The
     viewBox is what actually governs the drawing; these two only say how big
     the box is, and the CSS overrides them the moment it arrives.

     `preserveAspectRatio` is left at the default (`xMidYMid meet`): the box is
     the viewBox's own ratio, so there is nothing to crop, and `slice` would
     quietly start cropping the lumen the day something constrains the box. */
  return `<svg class="feed__scene" id="feedScene-${uid}" viewBox="0 0 640 400"
    width="640" height="400" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label="Live view from the colonoscope">
    <defs>
      <radialGradient id="feedLumen-${uid}" cx="50%" cy="50%" r="62%">
        <stop offset="0%" stop-color="#0a0606" />
        <stop offset="26%" stop-color="#40201d" />
        <stop offset="54%" stop-color="#8d4c43" />
        <stop offset="78%" stop-color="#c2887e" />
        <stop offset="100%" stop-color="#d5a49a" />
      </radialGradient>
      <radialGradient id="feedLesion-${uid}" cx="36%" cy="30%" r="72%">
        <stop offset="0%" stop-color="#f0c4b9" />
        <stop offset="55%" stop-color="#dda394" />
        <stop offset="100%" stop-color="#c4837a" />
      </radialGradient>
      <radialGradient id="feedGlint-${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="feedVignette-${uid}" cx="50%" cy="50%" r="58%">
        <stop offset="60%" stop-color="#000000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.95" />
      </radialGradient>
    </defs>

    <rect width="640" height="400" fill="#000000" />

    ${/* Everything that moves is inside one group, so the drift is a single
         transform the ticker writes — and so the measurement box over the
         panel can be given the identical translate and stay on its lesion. */ ''}
    <g data-feed-scene>
      <ellipse cx="320" cy="200" rx="330" ry="215" fill="url(#feedLumen-${uid})" />

      ${/* Haustral folds. Three arcs at different radii, barely inked: on a
           real picture they are the only thing that gives the lumen depth, and
           at any more contrast than this they read as drawn rings. */ ''}
      <g fill="none" stroke="#5e2f2a" stroke-opacity="0.35" stroke-width="2">
        <ellipse cx="320" cy="200" rx="268" ry="172" />
        <ellipse cx="316" cy="204" rx="196" ry="126" transform="rotate(-6 316 204)" />
        <ellipse cx="324" cy="196" rx="126" ry="82" transform="rotate(5 324 196)" />
      </g>

      ${/* The radial creases of the wall, running out of the dark centre. */ ''}
      <g stroke="#572824" stroke-opacity="0.3" stroke-width="2" stroke-linecap="round">
        <path d="M320 200 L 96 74" /><path d="M320 200 L 556 92" />
        <path d="M320 200 L 120 318" /><path d="M320 200 L 542 322" />
        <path d="M320 200 L 320 36" /><path d="M320 200 L 330 372" />
      </g>

      ${/* The lesion the scope is on, and the light coming back off it. */ ''}
      <g data-feed-lesion>
        <ellipse cx="222" cy="272" rx="72" ry="52" fill="url(#feedLesion-${uid})" />
        <ellipse cx="200" cy="254" rx="26" ry="16" fill="#ffffff" fill-opacity="0.22" />
      </g>

      ${/* The specular highlight — the wet wall throwing the light source
           back. It is the one thing on the picture that says the mucosa is
           wet, and the ticker moves it on its own path so a frozen frame and
           a live one are never quite the same picture. */ ''}
      <circle data-feed-glint cx="176" cy="122" r="20" fill="url(#feedGlint-${uid})" />
    </g>

    <rect width="640" height="400" fill="url(#feedVignette-${uid})" />
  </svg>`;
}

/* ===================== The chrome ===================== */

/** The four presses, in the order a hand works them. */
/* `onLabel` is what the button says while the thing it started is running —
   the two controls that toggle rather than fire. */
const CONTROLS = [
  { act: 'freeze', label: 'Freeze', onLabel: 'Unfreeze' },
  { act: 'capture', label: 'Capture', tone: 'capture' },
  { act: 'clip', label: 'Record clip', onLabel: 'Stop clip' },
  { act: 'biopsy', label: '+ Biopsy', tone: 'biopsy' },
];

function chromeHtml(options, uid) {
  const { source, pedals, caseRef } = options;

  const pedalHint = pedals
    .map((pedal) => `${pedal.label} ${pedal.does}`)
    .join(' · ');

  const buttons = CONTROLS.map(
    (control) => `<button type="button" class="feed__btn${
      control.tone ? ` feed__btn--${control.tone}` : ''
    }" data-feed-act="${control.act}" data-testid="encv--feed-${control.act}">${esc(
      control.label
    )}</button>`
  ).join('');

  return `<div class="feed__stage" data-feed-stage>
    ${sceneSvg(uid)}

    ${/* THE HEADER IS THE TITLE BAR.

         The panel floats over the report and is moved by dragging it, and the
         thing you drag a window by is the strip along its top that says what
         the window is. This one already says it — which scope, which case,
         which processor — so it is the handle rather than a second bar added
         above it carrying the same words in smaller type.

         `tabindex` and the arrow keys with it: a panel that can only be moved
         with a pointer is a panel that cannot be moved at all by somebody
         working the screen from the keyboard, and where it sits is the whole
         point of it being a window. The screen wires both — see feedWindow in
         js/screens/encounter.js. */ ''}
    <div class="feed__bar feed__bar--top" data-feed-drag tabindex="0"
      role="button" aria-label="Move the live feed panel — drag, or use the arrow keys">
      <span class="feed__grip" aria-hidden="true">${iconMarkup('grip')}</span>
      <span class="feed__state" data-feed-state-chip>
        <span class="feed__dot" aria-hidden="true"></span>
        <span data-feed-state-word>LIVE</span>
      </span>
      <span class="feed__rec" data-feed-rec hidden>REC <span data-feed-rec-clock>00:00</span></span>
      <span class="feed__source">${esc(source.scope)}${
        caseRef ? ` · ${esc(caseRef)}` : ''
      }</span>
      <span class="feed__bar-spacer"></span>
      <span class="feed__stack">${esc(source.processor)} · ${source.latencyMs} ms</span>
    </div>

    ${/* THE MEASUREMENT BOX IS THE RECORD'S, NOT THE PROCESSOR'S.

         A box over a lesion labelled "11 mm" looks like something the stack
         measured, and nothing on this stack measures anything. What it
         actually shows is what the ENDOSCOPIST already wrote down about the
         finding they are capturing against — the type and, where they
         recorded one, the size — drawn over the thing on screen so that the
         person pressing capture can see at a glance which finding the still
         is about to be filed under.

         Which is why it is HTML over the picture rather than part of it: it
         is not in the captured frame, because it was never in the picture the
         scope produced. It carries the scene's own drift so it stays on its
         lesion while the wall moves. */ ''}
    <div class="feed__target" data-feed-target hidden>
      <span class="feed__target-label" data-feed-target-label></span>
      <span class="feed__target-box" aria-hidden="true"></span>
    </div>

    <div class="feed__bar feed__bar--bottom">
      <div class="feed__controls" role="group" aria-label="Feed controls">${buttons}</div>
      <p class="feed__pedal">
        <span class="feed__pedal-line">Foot pedal · freeze / capture</span>
        <span class="feed__pedal-keys">${esc(pedalHint)}</span>
      </p>
    </div>
  </div>`;
}

/* ===================== The controller ===================== */

let nextFeedId = 1;

/**
 * Mount the panel into `host` and start it running.
 *
 * `options`:
 *   host            where the panel is drawn
 *   source, pedals  see data/procedure-feed.js
 *   caseRef         the case number printed beside the scope
 *   startedAt       epoch ms the feed opened — the header clock counts from it
 *   frozen          whether it opens frozen (a feed left frozen and returned to)
 *   target()        what the measurement box should say, or null for no box
 *
 * NOTE ON WHAT IS NOT DRAWN HERE. The panel carried two lines of prose under
 * the picture — that it is a read-only mirror, and what the run was still
 * waiting for. Both were true and both were permanent furniture under a
 * picture somebody is watching, on a window that is now resized to taste and
 * dragged around the screen. The first is a property of the whole feature and
 * belongs in its documentation; the second is said once, in a toast, when the
 * feed opens on a case that is not ready. Neither earns four lines under every
 * frame.
 *   onCapture(frame)          a still was taken; `frame` is a data URL
 *   onClip({ seconds, frame}) a clip finished
 *   onBiopsy()                the endoscopist asked for a jar
 *   onFreeze(frozen)          the panel froze or thawed
 *   onElapsed(seconds)        every tick, for whatever is showing the clock
 *
 * Returns a controller: `destroy()` when the document is repainted out from
 * under it, `paintTarget()` when the finding being captured against changes.
 */
export function mountScopeFeed(options) {
  const uid = nextFeedId++;
  const { host } = options;

  host.innerHTML = chromeHtml(options, uid);

  const stage = host.querySelector('[data-feed-stage]');
  const svg = host.querySelector(`#feedScene-${uid}`);
  const scene = host.querySelector('[data-feed-scene]');
  const glint = host.querySelector('[data-feed-glint]');
  const stateWord = host.querySelector('[data-feed-state-word]');
  const rec = host.querySelector('[data-feed-rec]');
  const recClock = host.querySelector('[data-feed-rec-clock]');
  const targetBox = host.querySelector('[data-feed-target]');
  const targetLabel = host.querySelector('[data-feed-target-label]');

  let frozen = Boolean(options.frozen);
  let recordingFrom = null;
  /* The drift is a walk rather than a loop: two sines at unrelated periods, so
     the picture never arrives back at a frame it has already shown and a
     reviewer cannot mistake it for a two-second video on repeat. */
  let phase = 0;
  let timer = null;

  const startedAt = options.startedAt ?? Date.now();
  const secondsSince = (from) => Math.floor((Date.now() - from) / 1000);

  /* The two controls whose label is their own state. Read off CONTROLS rather
     than written here, so a button's two words live in one place. */
  function relabel(act, on) {
    const control = CONTROLS.find((entry) => entry.act === act);
    const button = host.querySelector(`[data-feed-act="${act}"]`);
    if (button) button.textContent = (on && control.onLabel) || control.label;
    return button;
  }

  function paintState() {
    stage.dataset.state = frozen ? 'frozen' : 'live';
    stateWord.textContent = frozen ? 'FROZEN' : 'LIVE';
    relabel('freeze', frozen);
    relabel('clip', Boolean(recordingFrom))?.classList.toggle(
      'feed__btn--recording',
      Boolean(recordingFrom)
    );
    rec.hidden = !recordingFrom;
  }

  /** Where the scene has drifted to, as a transform both it and the box wear. */
  function drift() {
    const x = Math.sin(phase * 0.37) * 9 + Math.sin(phase * 0.11) * 5;
    const y = Math.cos(phase * 0.29) * 7 + Math.sin(phase * 0.07) * 4;
    return { x, y };
  }

  function tick() {
    if (!host.isConnected) {
      /* The document was repainted out from under the panel. Stop rather than
         go on nudging nodes nobody can see — see destroy() for the ordinary
         path, this is the safety net for the one that was not taken. */
      stop();
      return;
    }

    if (!frozen) {
      phase += 1;
      const { x, y } = drift();
      scene.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      targetBox.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      /* The wet highlight travels its own way, so the picture is never the
         same twice even where the wall has drifted back to where it was. */
      glint.setAttribute('cx', String(176 + Math.sin(phase * 0.19) * 46));
      glint.setAttribute('cy', String(122 + Math.cos(phase * 0.23) * 28));
    }

    if (recordingFrom) {
      const seconds = secondsSince(recordingFrom);
      recClock.textContent = feedClock(seconds);
      if (seconds >= (options.clipMaxSeconds ?? FEED_CLIP_MAX_SECONDS)) stopClip(true);
    }

    options.onElapsed?.(secondsSince(startedAt));
  }

  /** The frame as it stands, as something an <img> can show. */
  function frame() {
    const markup = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

  function capture() {
    options.onCapture?.(frame());
  }

  function startClip() {
    recordingFrom = Date.now();
    recClock.textContent = feedClock(0);
    paintState();
  }

  function stopClip(atCap = false) {
    if (!recordingFrom) return;
    const seconds = Math.max(1, secondsSince(recordingFrom));
    recordingFrom = null;
    paintState();
    options.onClip?.({ seconds, frame: frame(), atCap });
  }

  function setFrozen(next) {
    frozen = next;
    paintState();
    options.onFreeze?.(frozen);
  }

  const ACTIONS = {
    freeze: () => setFrozen(!frozen),
    capture,
    clip: () => (recordingFrom ? stopClip() : startClip()),
    biopsy: () => options.onBiopsy?.(),
  };

  host.addEventListener('click', (event) => {
    const button = event.target.closest('[data-feed-act]');
    if (!button) return;
    ACTIONS[button.dataset.feedAct]?.();
  });

  /*
   * THE PEDAL.
   *
   * Bound to the document rather than to the panel, because a foot pedal is
   * pressed by a foot: there is nothing to focus and nobody is going to tab
   * into the video first. That makes it a global key handler, which is only
   * acceptable if it is scrupulous about when it declines — so it declines
   * whenever anything is being typed into, whenever a dialog is open over the
   * page, and whenever a modifier is held, and it is taken off the document
   * the moment the feed ends.
   */
  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const pedal = options.pedals.find((entry) => entry.key === event.key);
    if (!pedal) return;

    const node = event.target;
    const typing =
      node instanceof HTMLElement &&
      (node.isContentEditable ||
        node.closest('input, textarea, select, [contenteditable="true"]'));
    if (typing) return;

    /*
     * A dialog over the page owns the keyboard while it is up — the jar form
     * is the one this matters for, since it is opened FROM the pedal's own
     * + Biopsy button and has a Save button that Enter would otherwise race.
     *
     * Asked of the BODY rather than of the dialogs. <ui-modal> keeps its open
     * state on a child's `hidden` flag, so there is no attribute on the tag to
     * look for; what it does put on the page is this class, for as long as any
     * dialog anywhere is up. Reading that is how the pedal asks "is anything
     * over the page" without knowing what a modal is made of.
     */
    if (document.body.classList.contains('ui-scroll-locked')) return;

    event.preventDefault();
    ACTIONS[pedal.action]?.();
  }

  document.addEventListener('keydown', onKey);

  /** What the box over the lesion says, or nothing where there is nothing. */
  function paintTarget() {
    const target = options.target?.();
    targetBox.hidden = !target;
    if (!target) return;
    targetLabel.textContent = target.label;
  }


  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function destroy() {
    stop();
    document.removeEventListener('keydown', onKey);
  }

  paintState();
  paintTarget();
  tick();
  timer = setInterval(tick, TICK_MS);

  return {
    destroy,
    paintTarget,
    /* The screen ends a clip itself when the endoscopist presses End feed
       mid-recording, so the clip is filed rather than lost with the panel. */
    stopClip: () => stopClip(),
    get recording() {
      return Boolean(recordingFrom);
    },
    get frozen() {
      return frozen;
    },
  };
}
