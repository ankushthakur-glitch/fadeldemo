/**
 * <ui-richtext> — a prose field the clinician can format.
 *
 * <ui-richtext label="History of present illness" label-hidden rows="6"
 *   placeholder="Onset, character, course, what has been tried…"></ui-richtext>
 *
 * It wears the same field shell as <ui-input>, <ui-select> and <ui-textarea> —
 * the same label contract, the same `label-hidden`, the same hint and error
 * lines, the same focus ring — because a clinician who has filled in one field
 * on this screen has filled in all of them, and a bordered box that focuses
 * differently from the box above it reads as a different kind of thing.
 *
 * WHY THIS EXISTS AT ALL, GIVEN <ui-textarea> ALREADY DOES PROSE.
 *
 * Most of the note does not want formatting. An Assessment is a paragraph, a
 * Plan is a paragraph, and a toolbar over either of them is chrome over a
 * field nobody was going to embolden. The history of present illness is the
 * exception and it is the exception for a structural reason: it is the one
 * section that is genuinely LONG — five lines minimum, often fifteen — and the
 * one that is read back under time pressure by somebody who did not write it.
 * A bulleted course of illness, a bolded date, an underlined red flag are what
 * make that section skimmable, and a clinician who cannot mark them up writes
 * a wall of text instead. So the toolbar goes exactly where the length is, and
 * nowhere else.
 *
 * THE VALUE IS HTML, AND IT ACCEPTS PLAIN TEXT.
 *
 * `field.value` reads back the markup, which is what gets signed into the
 * record. But three things on the visit note write into this field without
 * knowing what it is — the template seed, the clinical rail's Import, and the
 * AI scribe's Copy to note — and all three hand over plain text with newlines
 * in it. Rather than teach each of them about markup, the setter sniffs: a
 * string with no tag in it is escaped and paragraphed here. That keeps the
 * contract `node.value = someString` true for every caller, which is the only
 * contract those three were ever written against.
 *
 * EMPTY MEANS EMPTY. A contenteditable that has been focused and left holds
 * `<p><br></p>`, which is three tags and no words. The getter returns '' for
 * anything whose text content is blank, because everything upstream decides
 * whether a section has been written by trimming the value and checking the
 * length — see visitNoteOutstanding() in js/screens/clinic-visit.js.
 *
 * ON execCommand. It is deprecated and it is also the only thing every browser
 * implements for this. The alternative is a Range-walking implementation of
 * bold, which is a library, and this prototype has no build step and no
 * dependencies on purpose. When a replacement lands that is not a library, it
 * replaces the six lines in `run()` and nothing else.
 *
 * Events: ui-input on every keystroke, ui-change on blur — the same pair the
 * note's delegated listener already binds, both carrying { value }.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';

let uid = 0;

/*
 * The toolbar, in the order the hand reaches for it.
 *
 * NONE OF THESE COME FROM THE PHOSPHOR SPRITE, and that is deliberate rather
 * than an oversight. js/lib/icons.js ships one weight of one library and holds
 * no text-formatting glyphs; inventing path data to sit beside real Phosphor
 * outlines would put four drawings in the sprite that no upstream correction
 * would ever reach. B, I and U are letterforms — which is how every word
 * processor has drawn them for forty years, and they survive a translation the
 * icons would not — and the two list marks are four rects each, geometry
 * simple enough to be written correctly by hand and obviously not Phosphor.
 */
const TOOLS = [
  {
    cmd: 'bold',
    label: 'Bold',
    key: 'B',
    glyph: '<span class="ui-richtext__glyph ui-richtext__glyph--bold">B</span>',
  },
  {
    cmd: 'italic',
    label: 'Italic',
    key: 'I',
    glyph: '<span class="ui-richtext__glyph ui-richtext__glyph--italic">I</span>',
  },
  {
    cmd: 'underline',
    label: 'Underline',
    key: 'U',
    glyph: '<span class="ui-richtext__glyph ui-richtext__glyph--underline">U</span>',
  },
  {
    cmd: 'insertUnorderedList',
    label: 'Bulleted list',
    glyph:
      '<svg class="ui-richtext__mark" viewBox="0 0 20 20" aria-hidden="true">' +
      '<circle cx="3" cy="3.9" r="2"/><rect x="8" y="2.9" width="12" height="2" rx="1"/>' +
      '<circle cx="3" cy="10.4" r="2"/><rect x="8" y="9.4" width="12" height="2" rx="1"/>' +
      '<circle cx="3" cy="16.9" r="2"/><rect x="8" y="15.9" width="12" height="2" rx="1"/>' +
      '</svg>',
  },
  {
    cmd: 'insertOrderedList',
    label: 'Numbered list',
    /* The digits are set on a 20-unit grid rather than the bullet mark's 16,
       so a numeral drawn at this size is a numeral and not three grey pixels.
       The bars keep the bullet icon's proportions, so the pair reads as two
       versions of one mark. */
    glyph:
      '<svg class="ui-richtext__mark" viewBox="0 0 20 20" aria-hidden="true">' +
      '<text x="0" y="6" font-size="8" class="ui-richtext__num">1</text>' +
      '<rect x="8" y="2.9" width="12" height="2" rx="1"/>' +
      '<text x="0" y="12.5" font-size="8" class="ui-richtext__num">2</text>' +
      '<rect x="8" y="9.4" width="12" height="2" rx="1"/>' +
      '<text x="0" y="19" font-size="8" class="ui-richtext__num">3</text>' +
      '<rect x="8" y="15.9" width="12" height="2" rx="1"/>' +
      '</svg>',
  },
  {
    cmd: 'removeFormat',
    label: 'Clear formatting',
    /* The way back. A clinician who has pasted a paragraph out of a referral
       letter has pasted its fonts and its colours too, and without this the
       only way to get rid of them is to retype the paragraph. */
    glyph: '<span class="ui-richtext__glyph ui-richtext__glyph--clear">T<sub>x</sub></span>',
  },
];

function escapeText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Plain text as paragraphs, the way the writer of that text meant it.
 *
 * A blank line starts a paragraph and a single newline is a line break inside
 * one, which is the convention every plain-text field on this screen is
 * already written against — the rail's Import builds its provenance line and
 * its block with exactly that shape, and the scribe separates its sections
 * with a blank line.
 */
function textToHtml(text) {
  const blocks = String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return '';
  return blocks
    .map((block) => `<p>${escapeText(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Whether a stored value is already markup, or plain text that needs wrapping. */
const looksLikeHtml = (value) => /<[a-z][\s\S]*>/i.test(String(value));

class UiRichtext extends UiElement {
  static observedAttributes = [
    'label', 'label-hidden', 'value', 'placeholder', 'rows', 'hint', 'error',
    'required', 'disabled',
  ];

  render() {
    const id = this._id || (this._id = `ui-richtext-${++uid}`);
    const error = this.attr('error');
    const hint = error || this.attr('hint');
    const label = this.attr('label');
    const disabled = this.boolAttr('disabled');
    const labelClass = this.boolAttr('label-hidden') ? 'u-sr-only' : 'ui-field__label';

    const stored = this.attr('value');
    const html = stored && !looksLikeHtml(stored) ? textToHtml(stored) : stored;

    /*
     * `rows` is honoured as a MINIMUM, not a fixed height. The field grows with
     * what is typed into it, because the one section that earns a toolbar is
     * also the one nobody can predict the length of, and a fifteen-line history
     * scrolling inside six lines of box is a history nobody proof-reads.
     */
    const minLines = Number(this.attr('rows', '6')) || 6;

    this.innerHTML = `<div class="ui-field">
      ${
        label
          ? `<span class="${labelClass}" id="${id}-label">${label}${
              this.boolAttr('required')
                ? '<span class="ui-field__required" aria-hidden="true"> *</span>'
                : ''
            }</span>`
          : ''
      }
      <div class="ui-richtext${error ? ' ui-richtext--error' : ''}${
        disabled ? ' ui-richtext--disabled' : ''
      }">
        <div class="ui-richtext__bar" role="toolbar" aria-label="Formatting"
          aria-controls="${id}">
          ${TOOLS.map(
            (tool) => `<button type="button" class="ui-richtext__tool"
              data-cmd="${tool.cmd}" aria-pressed="false"
              title="${tool.label}${tool.key ? ` (⌘${tool.key})` : ''}"
              ${disabled ? 'disabled' : ''}>
              ${tool.glyph}<span class="u-sr-only">${tool.label}</span>
            </button>`
          ).join('')}
        </div>
        <div id="${id}" class="ui-richtext__body"
          ${disabled ? '' : 'contenteditable="true"'}
          role="textbox" aria-multiline="true"
          ${label ? `aria-labelledby="${id}-label"` : ''}
          ${error ? 'aria-invalid="true"' : ''}
          data-placeholder="${this.attr('placeholder')}"
          style="min-height:calc(${minLines} * var(--line-height-normal) * 1em)"
        >${html}</div>
      </div>
      ${hint ? `<p class="ui-field__hint${error ? ' ui-field__hint--error' : ''}">${hint}</p>` : ''}
    </div>`;

    this._wire();
    this._syncEmpty();
  }

  _wire() {
    const body = this.querySelector('.ui-richtext__body');
    const bar = this.querySelector('.ui-richtext__bar');
    if (!body || !bar) return;

    /* mousedown, not click: the pointer going down inside the toolbar would
       otherwise take the caret out of the body, and a bold with no selection
       left behind it bolds nothing. */
    bar.addEventListener('mousedown', (event) => {
      const tool = event.target.closest('.ui-richtext__tool');
      if (!tool) return;
      event.preventDefault();
      body.focus();
      this._run(tool.dataset.cmd);
    });

    body.addEventListener('input', () => {
      this._syncEmpty();
      this.emit('ui-input', { value: this.value });
    });

    /* Blur carries the change, the same moment <ui-textarea> does, so the
       note's delegated commit handler treats the two identically. */
    body.addEventListener('blur', () => {
      this._reflect();
      this.emit('ui-change', { value: this.value });
    });

    /* A pasted referral letter arrives wearing its source's fonts, colours and
       sometimes its tables. Only the words are wanted: what goes into a signed
       record should look like the record, not like the thing it was copied
       out of. */
    body.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text);
    });

    /*
     * Keep the toolbar's pressed state honest about where the caret is.
     *
     * Moving the caret is the common case and ⌘B is the interesting one: the
     * browser applies ⌘B, ⌘I and ⌘U itself, so without this the button for the
     * formatting the clinician just switched on stays unlit. Both arrive as a
     * keyup, so one listener covers both, and it is not worth filtering down
     * to the three shortcut keys — reading three command states is cheaper
     * than the keystroke that triggered it.
     */
    body.addEventListener('keyup', () => this._reflect());
    body.addEventListener('mouseup', () => this._reflect());
  }

  _run(cmd) {
    if (this.boolAttr('disabled')) return;
    document.execCommand(cmd, false, null);
    this._syncEmpty();
    this._reflect();
    this.emit('ui-input', { value: this.value });
  }

  /** Light the toolbar buttons whose formatting the caret is inside. */
  _reflect() {
    this.querySelectorAll('.ui-richtext__tool').forEach((tool) => {
      let on = false;
      try {
        on = document.queryCommandState(tool.dataset.cmd);
      } catch {
        /* removeFormat has no state and some browsers throw rather than
           returning false. Not being able to light a button is not a reason
           to stop the editor working. */
      }
      tool.setAttribute('aria-pressed', String(on));
    });
  }

  /** The placeholder shows only while there are genuinely no words in the box. */
  _syncEmpty() {
    const body = this.querySelector('.ui-richtext__body');
    if (body) body.classList.toggle('is-empty', !body.textContent.trim());
  }

  /**
   * The markup, or '' when the box holds no words.
   *
   * See the note at the top: a focused-and-left contenteditable is full of
   * tags and empty of content, and every emptiness check upstream trims a
   * string and measures it.
   */
  get value() {
    const body = this.querySelector('.ui-richtext__body');
    if (!body) return this.attr('value');
    return body.textContent.trim() ? body.innerHTML : '';
  }

  /** Symmetrical with the other fields: the attribute is the store. */
  set value(next) {
    this.setAttribute('value', next ?? '');
  }

  /** The words without the markup, for anything that wants a plain-text copy. */
  get textValue() {
    return this.querySelector('.ui-richtext__body')?.innerText.trim() ?? '';
  }

  focus(options) {
    this.querySelector('.ui-richtext__body')?.focus(options);
  }
}

reflectProps(UiRichtext, {
  label: 'string', 'label-hidden': 'boolean', placeholder: 'string', rows: 'string',
  hint: 'string', error: 'string', required: 'boolean', disabled: 'boolean',
});
define('ui-richtext', UiRichtext);

export { UiRichtext, textToHtml, looksLikeHtml };
