/**
 * COLOUR MIXER — mixing a colour, rather than picking one off the shelf.
 *
 * The "Basic Colours" grid answers the common case: a clinic wants one of the
 * fifty-six colours the product ships with, and two clicks is the whole job.
 * It does not answer the other case, which is a practice that already has a
 * brand and wants THAT teal, the one halfway between two of the swatches. Up
 * to now the only way through was to pick the nearest tile and live with it.
 *
 * So this is the second half of the picker: the saturation/brightness field,
 * the hue ramp under it, an opacity ramp, and a hex box for anyone who arrives
 * already knowing the answer. It is the arrangement every design tool uses —
 * Figma, Photoshop, the browser's own colour input — because the mapping is
 * learned: hue on a line, everything else in a square.
 *
 * WHY HSV AND NOT HSL.
 * The square is saturation across and *value* down, which is what makes the
 * top-left corner white, the top-right corner the pure hue and the whole
 * bottom edge black. HSL's square has grey in two corners and pure colour in
 * the middle of an edge, which reads as broken to anyone who has used a colour
 * tool before. The stored value is still plain hex — HSV is the interaction
 * model, not the format.
 *
 * NO INLINE STYLES.
 * Everything here moves: the field's tint gradient follows the hue, the thumb
 * follows the pointer, the opacity ramp fades towards the current colour. All
 * of it would be a `style="..."` attribute in a normal codebase, and the house
 * rule forbids those. So each instance owns a handful of custom properties on
 * its root element, written into ONE generated stylesheet (the same trick as
 * js/lib/swatches.js), and every rule that uses them lives in real CSS where
 * it can be read and changed. The stylesheet is rewritten in place on every
 * move, so a long drag leaves no residue behind it.
 */

const STYLE_ID = 'ui-mixer-styles';

/** id → the one rule that instance owns, so a rewrite replaces rather than appends. */
const RULES = new Map();

let counter = 0;

function writeVars(id, declarations) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  RULES.set(id, `[data-mixer-id="${id}"]{${declarations}}`);
  style.textContent = [...RULES.values()].join('');
}

/* --- Colour maths ---------------------------------------------------------- */

/** h 0–360, s and v 0–1 → {r,g,b} 0–255. */
export function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** {r,g,b} 0–255 → {h 0–360, s 0–1, v 0–1}. */
export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max ? delta / max : 0, v: max / 255 };
}

/**
 * "#3f8", "#33ff88", "#33ff8880" → {r,g,b,a}; anything else → null.
 * Both short forms are accepted because people type them.
 */
export function parseHex(text) {
  const raw = String(text ?? '')
    .trim()
    .replace(/^#/, '');
  const hex =
    raw.length === 3 || raw.length === 4
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return null;

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

/** {r,g,b,a} → "#rrggbb", or "#rrggbbaa" once it is see-through. */
export function toHex({ r, g, b, a = 1 }) {
  const pair = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  const solid = `#${pair(r)}${pair(g)}${pair(b)}`;
  return a >= 1 ? solid : `${solid}${pair(a * 255)}`;
}

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/* --- The control ----------------------------------------------------------- */

/**
 * Render a mixer into `host` and drive it.
 *
 * @param {HTMLElement} host      - emptied and filled with the control
 * @param {object}      options
 * @param {string}      [options.value] - starting colour, any hex form
 * @param {string}      [options.label] - heading above the field
 * @param {string}      [options.testid] - data-testid stem for the parts
 * @param {boolean}     [options.alpha] - offer the opacity ramp. Off for a
 *        colour that has to stay solid: an appointment type's colour is
 *        painted as a calendar block and a rail chip, and a half-transparent
 *        one reads as a rendering fault rather than as a choice somebody made.
 * @param {(hex: string) => void} [options.onInput] - fired on every change the
 *        USER makes; never fired by setValue(), so a caller can push a colour
 *        in without hearing its own echo.
 * @returns {{ setValue(hex: string): void, getValue(): string }}
 */
export function createColourMixer(
  host,
  { value = '#000000', label = 'Custom Colour', testid = 'mixer', alpha: withAlpha = true, onInput } = {}
) {
  const id = `m${++counter}`;

  // Hue is kept separately from the RGB value on purpose. Drag the field into
  // the black corner and the hue is mathematically lost — every black is hue
  // zero — so a picker that re-derives it from the colour snaps the ramp back
  // to red the moment you reach a corner, and the drag back out is a different
  // colour than the one you came in on. Holding it here keeps the ramp still.
  let hue = 0;
  let sat = 0;
  let val = 0;
  let alpha = 1;

  host.innerHTML = `
    <div class="set__mixer" data-mixer-id="${id}" data-testid="${testid}">
      <span class="set__palette-label">${label}</span>

      <div class="set__mixer-field" data-mixer-field tabindex="0" role="slider"
           aria-label="Saturation and brightness"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
           aria-valuetext="Saturation 0%, brightness 0%"
           data-testid="${testid}-field">
        <span class="set__mixer-thumb"></span>
      </div>

      <div class="set__mixer-ramps">
        <span class="set__mixer-ramp set__mixer-ramp--hue">
          <input type="range" class="set__mixer-range" data-mixer-hue
                 min="0" max="359" step="1" value="0"
                 aria-label="Hue" data-testid="${testid}-hue">
        </span>
        ${
          withAlpha
            ? `<span class="set__mixer-ramp set__mixer-ramp--alpha">
          <span class="set__mixer-fade"></span>
          <input type="range" class="set__mixer-range" data-mixer-alpha
                 min="0" max="100" step="1" value="100"
                 aria-label="Opacity" data-testid="${testid}-alpha">
        </span>`
            : ''
        }
      </div>

      <div class="set__mixer-out">
        <span class="set__mixer-result" data-testid="${testid}-result"></span>
        <span class="ui-input ui-input--sm set__mixer-hex">
          <input class="ui-input__control" data-mixer-hex spellcheck="false"
                 maxlength="9" aria-label="Hex colour" data-testid="${testid}-hex">
        </span>
      </div>
    </div>`;

  const field = host.querySelector('[data-mixer-field]');
  const thumb = host.querySelector('.set__mixer-thumb');
  const hueInput = host.querySelector('[data-mixer-hue]');
  const alphaInput = host.querySelector('[data-mixer-alpha]');
  const hexInput = host.querySelector('[data-mixer-hex]');

  // maxlength follows the ramp: nine characters is "#rrggbbaa", and leaving
  // room for an alpha pair the control cannot show is how a solid-only picker
  // accepts a colour it then silently drops.
  hexInput.setAttribute('maxlength', withAlpha ? '9' : '7');

  function currentHex() {
    return toHex({ ...hsvToRgb(hue, sat, val), a: alpha });
  }

  /** Repaint every moving part from the four numbers above. */
  function render({ skipHex = false } = {}) {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    const percent = (n) => `${Math.round(n * 1000) / 10}%`;

    writeVars(
      id,
      [
        `--mixer-hue:hsl(${Math.round(hue)},100%,50%)`,
        `--mixer-x:${percent(sat)}`,
        `--mixer-y:${percent(1 - val)}`,
        `--mixer-solid:rgb(${r},${g},${b})`,
        `--mixer-ink:rgba(${r},${g},${b},${Math.round(alpha * 100) / 100})`,
      ].join(';')
    );

    const satPct = Math.round(sat * 100);
    const valPct = Math.round(val * 100);
    field.setAttribute('aria-valuenow', String(satPct));
    field.setAttribute('aria-valuetext', `Saturation ${satPct}%, brightness ${valPct}%`);

    hueInput.value = String(Math.round(hue));
    if (alphaInput) alphaInput.value = String(Math.round(alpha * 100));
    // Not while it is being typed in: rewriting the box under the caret is how
    // "#33f" becomes un-typeable.
    if (!skipHex) hexInput.value = currentHex();
  }

  function commit() {
    render();
    onInput?.(currentHex());
  }

  /** Point the field at a client x/y, clamped to its own box. */
  function pointAt(event) {
    const box = field.getBoundingClientRect();
    sat = clamp((event.clientX - box.left) / box.width, 0, 1);
    val = 1 - clamp((event.clientY - box.top) / box.height, 0, 1);
    commit();
  }

  field.addEventListener('pointerdown', (event) => {
    field.setPointerCapture(event.pointerId);
    field.focus();
    pointAt(event);
  });
  field.addEventListener('pointermove', (event) => {
    if (field.hasPointerCapture(event.pointerId)) pointAt(event);
  });
  field.addEventListener('pointerup', (event) => field.releasePointerCapture(event.pointerId));
  // A drag that runs off the square must not select the label text under it.
  field.addEventListener('dragstart', (event) => event.preventDefault());

  field.addEventListener('keydown', (event) => {
    // Shift moves in tens, so crossing the square is four presses rather than
    // a hundred; the plain arrow keeps the 1% precision the mouse cannot hit.
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves = {
      ArrowLeft: () => (sat = clamp(sat - step, 0, 1)),
      ArrowRight: () => (sat = clamp(sat + step, 0, 1)),
      ArrowUp: () => (val = clamp(val + step, 0, 1)),
      ArrowDown: () => (val = clamp(val - step, 0, 1)),
      Home: () => (sat = 0),
      End: () => (sat = 1),
      PageUp: () => (val = 1),
      PageDown: () => (val = 0),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
    commit();
  });

  hueInput.addEventListener('input', () => {
    hue = Number(hueInput.value);
    commit();
  });

  alphaInput?.addEventListener('input', () => {
    alpha = Number(alphaInput.value) / 100;
    commit();
  });

  hexInput.addEventListener('input', () => {
    const parsed = parseHex(hexInput.value);
    if (!parsed) return; // half-typed, so say nothing until it reads as a colour
    apply(parsed);
    render({ skipHex: true });
    onInput?.(currentHex());
  });

  // Leaving the box tidies whatever was left in it back to the real value,
  // which is also how a typo gets undone.
  hexInput.addEventListener('blur', () => render());

  /** Adopt an {r,g,b,a}, keeping the hue where a greyscale colour cannot say. */
  function apply({ r, g, b, a }) {
    const hsv = rgbToHsv(r, g, b);
    if (hsv.s > 0) hue = hsv.h;
    sat = hsv.s;
    val = hsv.v;
    alpha = withAlpha ? a : 1;
  }

  function setValue(hex) {
    const parsed = parseHex(hex);
    if (!parsed) return;
    apply(parsed);
    render();
  }

  setValue(value);

  return { setValue, getValue: currentHex };
}
