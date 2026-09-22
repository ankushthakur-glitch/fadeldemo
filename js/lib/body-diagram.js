/**
 * THE ANNOTATABLE IMAGE.
 *
 * A clinician presses a diagram where the finding is, says what it is, and the
 * marks become part of the signed note — a numbered figure with a numbered
 * legend, which is how a body map has been printed in a chart since long
 * before any of this was software.
 *
 * WHY A PIN AND A LEGEND, RATHER THAN DRAWING ON THE PICTURE.
 *
 * Freehand annotation is the obvious design and it is the wrong one here. Ink
 * scrawled on a diagram cannot be read back by anything: it does not print at
 * a different size, it does not survive being quoted into a referral letter,
 * and a reader cannot tell a circle meaning "here" from a circle meaning "this
 * whole region". A numbered pin with a typed label is structured — the note
 * can render it as a list, the letter can quote it as a sentence, and a
 * colleague reading it aloud has words to read.
 *
 * WHY THE SHAPES ARE INERT AND THE CANVAS TAKES THE CLICK.
 *
 * The figure in data/body-maps.js is drawn with `pointer-events: none`, and the
 * press is caught by a transparent rect over the whole viewBox. That means a
 * pin lands where the clinician pressed even when they press just outside the
 * outline — which happens constantly, because a finger indicating "the edge of
 * the mass" lands on the edge. A map that silently swallows those presses is a
 * map people stop trusting.
 *
 * COORDINATES ARE STORED IN THE viewBox'S OWN UNITS, as fractions of it, so a
 * mark dropped on a 520px-wide dialog is in the same place when the note prints
 * it at 180px. Nothing stores a pixel.
 *
 * Usage, from the screen that owns the note:
 *
 *   openBodyDiagram({
 *     modal,                       // a <ui-modal> already in the page
 *     mapId: 'abdomen',
 *     marks: [...],                // what is already on the note
 *     readOnly: note.signed,
 *     onCommit: ({ mapId, marks }) => { ... },
 *   });
 *
 * and, for the note itself:
 *
 *   bodyDiagramFigure({ mapId, marks })   // the figure, pins and all
 *   bodyDiagramLegend({ marks })          // the numbered list under it
 */
import { BODY_MAPS, bodyMapById, BODY_MARK_PRESETS } from '../../data/body-maps.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The figure, at whatever size the thing around it gives it.
 *
 * Shared by the dialog and by the note, deliberately: a clinician who places a
 * pin and then reads the note back is entitled to see the same picture, and
 * two renderers for one drawing is how the note and the dialog end up
 * disagreeing about where mark 3 was.
 *
 * `interactive` is the only difference between the two, and it adds exactly one
 * element — the hit rect. Everything else is identical.
 */
export function bodyDiagramFigure({ mapId, marks = [], interactive = false }) {
  const map = bodyMapById(mapId);
  const [minX, minY, width, height] = map.viewBox.split(/\s+/).map(Number);

  /*
   * A stored fraction, resolved against THIS map's box.
   *
   * The fraction is the storage format because the two maps have different
   * viewBoxes — 200×400 and 200×240 — and a mark has to be able to move
   * between them when the clinician switches diagram. It is resolved here,
   * rather than by nesting the pins in a 100×100 <svg> of their own: that
   * would need preserveAspectRatio="none" to line up, which stretches the
   * pins into ovals on any figure that is not square.
   */
  const pins = marks
    .map(
      (mark, index) => `<g class="bodymap__pin" data-mark="${index}"
        transform="translate(${(minX + mark.x * width).toFixed(2)} ${(
          minY +
          mark.y * height
        ).toFixed(2)})"
        aria-label="Mark ${index + 1}: ${esc(mark.label || 'unlabelled')}">
        <circle class="bodymap__pin-dot" r="9" />
        <text class="bodymap__pin-num" y="3.5" font-size="10">${index + 1}</text>
      </g>`
    )
    .join('');

  /*
   * ORDER IN THE DOCUMENT IS THE HIT ORDER.
   *
   * The catch-all rect comes before the pins, so a press on a pin reaches the
   * pin and a press anywhere else falls to the rect. The other way round, the
   * rect covers the pins and pressing an existing mark drops a second one on
   * top of it.
   */
  return `<svg class="bodymap__svg" viewBox="${map.viewBox}"
    role="img" aria-label="${esc(map.caption)}">
    <g class="bodymap__figure">${map.shapes}</g>
    ${map.guides ?? ''}
    ${
      interactive
        ? '<rect class="bodymap__hit" x="0" y="0" width="100%" height="100%" />'
        : ''
    }
    <g class="bodymap__pin-layer">${pins}</g>
  </svg>`;
}

/** The numbered legend. Returns '' when there is nothing to list. */
export function bodyDiagramLegend({ marks = [] }) {
  if (!marks.length) return '';
  return `<ol class="bodymap__legend">
    ${marks
      .map(
        (mark, index) => `<li class="bodymap__legend-item">
          <span class="bodymap__legend-num">${index + 1}</span>
          <span class="bodymap__legend-text">${esc(mark.label || 'Unlabelled mark')}</span>
        </li>`
      )
      .join('')}
  </ol>`;
}

/** The whole block as it appears in the note: caption, figure, legend. */
export function bodyDiagramBlock({ mapId, marks = [] }) {
  const map = bodyMapById(mapId);
  return `<figure class="bodymap bodymap--static">
    <div class="bodymap__canvas bodymap__canvas--static">
      ${bodyDiagramFigure({ mapId, marks })}
    </div>
    <figcaption class="bodymap__caption">${esc(map.caption)}</figcaption>
    ${
      marks.length
        ? bodyDiagramLegend({ marks })
        : '<p class="bodymap__empty">No marks were placed on this diagram.</p>'
    }
  </figure>`;
}

/**
 * Open the marking dialog.
 *
 * NOTHING IS COMMITTED UNTIL THE CLINICIAN SAYS SO. The dialog works on a copy,
 * and Cancel throws the copy away — so a clinician who opens the map to look at
 * what is already there, drops a pin by accident and closes it has not changed
 * the note. `onCommit` is called once, with the copy, and only from Save.
 *
 * @param {object} config
 * @param {HTMLElement} config.modal      a <ui-modal> with an open()/close()
 * @param {HTMLElement} [config.trigger]  what opened it, for focus return
 * @param {string} [config.mapId]
 * @param {Array} [config.marks]
 * @param {boolean} [config.readOnly]     a signed note can be read, not marked
 * @param {(result: {mapId: string, marks: Array}) => void} config.onCommit
 */
export function openBodyDiagram({
  modal,
  trigger,
  mapId = BODY_MAPS[0].id,
  marks = [],
  readOnly = false,
  onCommit,
}) {
  if (!modal) return;

  /* Deep enough: a mark is three flat strings and a pair of numbers, and a
     structuredClone would only be a heavier way of saying the same thing. */
  const draft = {
    mapId,
    marks: marks.map((mark) => ({ ...mark })),
    selected: -1,
  };

  const body = modal.querySelector('[data-bodymap-body]');
  const footer = modal.querySelector('[data-bodymap-footer]');
  if (!body) return;

  function paint() {
    const map = bodyMapById(draft.mapId);

    body.innerHTML = `
      <div class="bodymap">
        <div class="bodymap__side">
          ${
            readOnly
              ? ''
              : `<div class="bodymap__maps" role="group" aria-label="Diagram">
                  ${BODY_MAPS.map(
                    (entry) => `<button type="button" class="bodymap__map-btn"
                      data-map="${entry.id}"
                      aria-pressed="${entry.id === draft.mapId}">${esc(entry.label)}</button>`
                  ).join('')}
                </div>`
          }
          <div class="bodymap__canvas${readOnly ? ' bodymap__canvas--static' : ''}"
            data-bodymap-canvas data-testid="enc--bodymap-canvas">
            ${bodyDiagramFigure({
              mapId: draft.mapId,
              marks: draft.marks,
              interactive: !readOnly,
            })}
          </div>
          <p class="bodymap__caption">${esc(map.caption)}</p>
          ${
            readOnly
              ? ''
              : `<p class="bodymap__hint">Press the diagram where the finding is.
                  Each press adds a numbered mark.</p>`
          }
        </div>

        <div class="bodymap__marks">
          <h4 class="bodymap__marks-title">Marks</h4>
          ${
            draft.marks.length
              ? `<ol class="bodymap__list" data-bodymap-list>${draft.marks
                  .map((mark, index) => markRowHtml(mark, index, readOnly))
                  .join('')}</ol>`
              : `<p class="bodymap__empty">Nothing marked yet.</p>`
          }
        </div>
      </div>`;

    if (footer) {
      footer.innerHTML = readOnly
        ? `<ui-button variant="secondary" data-bodymap-cancel>Close</ui-button>`
        : `<ui-button variant="tertiary" data-bodymap-clear
             ${draft.marks.length ? '' : 'disabled'}>Clear all</ui-button>
           <ui-button variant="secondary" data-bodymap-cancel>Cancel</ui-button>
           <ui-button variant="primary" data-bodymap-save
             data-testid="enc--bodymap-save">Add to note</ui-button>`;
    }
  }

  function markRowHtml(mark, index, locked) {
    return `<li class="bodymap__row${
      index === draft.selected ? ' is-selected' : ''
    }" data-row="${index}">
      <span class="bodymap__row-num">${index + 1}</span>
      ${
        locked
          ? `<span class="bodymap__row-static">${esc(mark.label || 'Unlabelled mark')}</span>`
          : `<input class="bodymap__row-input" type="text" value="${esc(mark.label)}"
               list="bodymap-presets" data-label="${index}"
               placeholder="What is here…"
               aria-label="Label for mark ${index + 1}"
               data-testid="enc--bodymap-label-${index}">
             <button type="button" class="bodymap__row-drop" data-drop="${index}"
               aria-label="Remove mark ${index + 1}">&times;</button>`
      }
    </li>`;
  }

  /*
   * A press on the canvas, as a fraction of the viewBox.
   *
   * THROUGH getScreenCTM(), NOT THROUGH getBoundingClientRect().
   *
   * The bounding rect is the box the SVG ELEMENT occupies; the drawing inside
   * it is fitted to that box by preserveAspectRatio, which defaults to
   * "meet" — scale to fit, centre, and leave bars down the sides. So the two
   * are the same rectangle only when the box and the viewBox happen to share
   * an aspect ratio, and dividing by the rect is right exactly when that is
   * true and wrong the rest of the time.
   *
   * It bit here. The canvas is one size for both maps, the abdomen is 200×240
   * and the whole body is 200×400, so the body map is letterboxed with about
   * 80px of empty canvas down each side — and a naive proportion put every
   * pin on that map a long way from the finger that placed it, while the
   * abdomen (whose aspect is within half a percent of its box) looked perfect
   * and hid the bug.
   *
   * getScreenCTM() is the matrix the browser actually drew with, so its
   * inverse maps a client point back into user units whatever the fit,
   * whatever the zoom, and whatever the page has been scrolled to. Normalising
   * by the viewBox afterwards is what lets a mark move between two maps of
   * different heights — see bodyDiagramFigure() for the other half of that.
   */
  function pointFromEvent(event, svg) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const [minX, minY, width, height] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    if (!width || !height) return null;

    const screen = new DOMPoint(event.clientX, event.clientY);
    const user = screen.matrixTransform(ctm.inverse());

    const x = (user.x - minX) / width;
    const y = (user.y - minY) / height;
    /* A press on the letterboxed canvas beside the drawing is a press on
       nothing, and is dropped rather than clamped onto the nearest edge: a pin
       that appears somewhere the clinician did not press is worse than a press
       that did nothing. */
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }

  function onBodyClick(event) {
    const mapBtn = event.target.closest('[data-map]');
    if (mapBtn) {
      /* Switching diagram takes the marks with it rather than dropping them.
         A clinician who marked the abdomen and then realises the whole-body
         map was the right one has not stopped meaning what they marked — and
         a switch that silently binned four pins is a switch nobody presses
         twice. The fractions carry over, which is the point of storing them
         that way. */
      draft.mapId = mapBtn.dataset.map;
      paint();
      return;
    }

    const drop = event.target.closest('[data-drop]');
    if (drop) {
      draft.marks.splice(Number(drop.dataset.drop), 1);
      draft.selected = -1;
      paint();
      return;
    }

    const pin = event.target.closest('.bodymap__pin');
    if (pin) {
      /* Pressing a pin selects its row rather than adding a mark on top of the
         one already there — which is what a press on a pin means every time. */
      draft.selected = Number(pin.dataset.mark);
      paint();
      body.querySelector(`[data-label="${draft.selected}"]`)?.focus();
      return;
    }

    if (readOnly) return;
    const hit = event.target.closest('.bodymap__hit');
    if (!hit) return;

    const svg = hit.closest('svg');
    const point = pointFromEvent(event, svg);
    if (!point) return;

    draft.marks.push({ ...point, label: '' });
    draft.selected = draft.marks.length - 1;
    paint();
    /* Straight into the label field. The pin without words is not yet a
       finding, and asking the clinician to find the new row themselves is
       asking them to do the one thing this is meant to save. */
    body.querySelector(`[data-label="${draft.selected}"]`)?.focus();
  }

  function onBodyInput(event) {
    const field = event.target.closest('[data-label]');
    if (!field) return;
    draft.marks[Number(field.dataset.label)].label = field.value;
  }

  function onFooterClick(event) {
    if (event.target.closest('[data-bodymap-cancel]')) {
      close();
      return;
    }
    if (event.target.closest('[data-bodymap-clear]')) {
      draft.marks = [];
      draft.selected = -1;
      paint();
      return;
    }
    if (event.target.closest('[data-bodymap-save]')) {
      /* A pin nobody labelled is a press, not a finding. Dropped on the way
         out rather than refused on the way in: refusing would mean a clinician
         who pressed the wrong spot has to find and delete the pin before they
         are allowed to save anything. */
      const kept = draft.marks.filter((mark) => mark.label.trim());
      onCommit?.({ mapId: draft.mapId, marks: kept });
      close();
    }
  }

  function close() {
    body.removeEventListener('click', onBodyClick);
    body.removeEventListener('input', onBodyInput);
    footer?.removeEventListener('click', onFooterClick);
    modal.close();
  }

  body.addEventListener('click', onBodyClick);
  body.addEventListener('input', onBodyInput);
  footer?.addEventListener('click', onFooterClick);

  modal.setAttribute('heading', readOnly ? 'Body map' : 'Mark on a diagram');
  paint();
  modal.open(trigger);
}

/**
 * The preset labels, as options for the page's #bodymap-presets datalist.
 *
 * Options rather than the whole <datalist>, because the element itself lives
 * in the page: <ui-modal> lifts its children into a fragment when it connects,
 * so a datalist authored inside the dialog is out of the document by the time
 * an input tries to reach it by id, and the suggestions silently never appear.
 * The screen fills this one once, at start-up.
 */
export function bodyDiagramPresetOptions() {
  return BODY_MARK_PRESETS.map((preset) => `<option value="${esc(preset)}"></option>`).join('');
}
