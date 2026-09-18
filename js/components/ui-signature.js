/**
 * <ui-signature> — capture a patient's electronic signature.
 *
 * <ui-signature heading="Patient Electronic Signature"
 *               signer="Marcus Osei"
 *               methods="draw,upload,type"></ui-signature>
 *
 * Three ways to sign, because a desk is not always a touchscreen: draw it with
 * a mouse, finger or stylus, upload a photograph or scan of a signed sheet, or
 * type the legal name. All three produce the same thing — a PNG data URL plus
 * the typed name — so whatever consumes it does not have to care which was
 * used.
 *
 * `methods` narrows that list for a host that only wants some of it. A form
 * signed at a bay with a stylus in the nurse's hand is the case for naming one
 * route: the choice between three costs a fieldset, a legend and a row of
 * radios above every signature, and nobody at the bedside is picking between
 * them. Give it a single method and the control drops the picker entirely and
 * draws as one pad — the routes not asked for are simply not offered, and
 * everything the pad emits is unchanged, so a host reading `detail.method`
 * still gets told which one was used.
 *
 * The upload is not a fallback for browsers that cannot draw. On a desk PC
 * with a mouse, a drawn signature looks nothing like anybody's handwriting and
 * takes four attempts; the patient's own scan, or a photograph of the sheet
 * they signed in the waiting room, is the better mark on half the devices.
 * This is the same pair the patient portal offers (patient/js/lib/
 * signature-pad.js), and the two must not drift: a patient who signs one form
 * at home and the next at the desk should meet the same control.
 *
 * WHO SIGNED IS NOT ASKED FOR ANY MORE — IT IS TOLD.
 *
 * The pad used to open with a required "Full Name" field above the mark, on
 * the argument that a squiggle does not say who made it. That argument is
 * sound and it is not an argument for a field: every host that puts one of
 * these on a screen already knows whose signature it is about to take — the
 * booking's patient, the section's named clinician, the anaesthetist on the
 * list — and every one of them was reaching in and pre-filling the field with
 * the answer before the person got to it. What was left on the screen was a
 * required question asking somebody to confirm their own name before they were
 * allowed to sign it, eight times across six documents on one procedure run.
 *
 * So the name arrives on `signer` and is never asked. It is what gets filed
 * with the mark, it is who the state line says the pad is about to sign as,
 * and a pad handed no signer cannot file a drawn or uploaded mark at all —
 * there would be nobody to file it under. See #signerName.
 *
 * Type Name still has a field, because in that route the typed name IS the
 * mark rather than a second answer about it. It opens holding `signer`, so for
 * anyone who does not want to draw the whole act is still one Enter.
 *
 * THERE IS NO CONFIRM BUTTON. A full-width primary button under every pad was
 * a second act asked for after the act: the person had already written their
 * name and made their mark, and the button only asked them to agree that they
 * had. On the procedure run that button appeared eight times in six documents,
 * under pads that were themselves inside a form with its own Sign at the foot,
 * so a single consent carried three separate things all called signing.
 *
 * So the pad files the mark itself, the moment it is finished, and what counts
 * as finished is per route rather than per keystroke — see #fileWhenSettled:
 *
 *   draw     a short settle after the pen comes up, so a signature made of
 *            three strokes files once, as one mark, rather than after the
 *            first of them
 *   upload   as soon as the image has been read, because choosing a file IS
 *            the deliberate act and there is nothing further to wait for
 *   type     when Sign is pressed, or Enter. Never while the name is being
 *            typed: in this route the name IS the mark, and a pad that filed
 *            on a pause would sign half of somebody's name.
 *
 * TYPE NAME HAS A SIGN BUTTON, AND IT IS NOT THAT BUTTON COMING BACK.
 * The one above was a confirmation: the mark existed, and the press only
 * agreed with it. This one is the act. A drawing ends when the pen comes up
 * and an upload ends when the file arrives, but a typed name never ends by
 * itself — it looks exactly as finished when it is half typed — so something
 * has to say so. That used to be Enter, or focus leaving the control, and
 * neither is visible: a clinician looking at a name already filled in for them
 * had a pad with no way of signing anywhere on it, and a pad that signs when
 * you click away signs when you go to check a spelling. The button says what
 * the act is and waits to be asked for it.
 *
 * Nothing files without a name behind it, in any route, exactly as before —
 * that name is now the host's business rather than the signer's. The line
 * under the pad says what is still missing, and once nothing is, what is about
 * to be filed and what will file it.
 *
 * Events
 *   ui-sign   detail { name, method: 'draw' | 'upload' | 'type', dataUrl,
 *                      fileName — the uploaded file's name, or null }
 *   ui-clear  the drawing was wiped
 *
 * NOTE: this component never re-renders. Its canvas holds the only copy of
 * whatever has been drawn, and a re-render would replace the element and take
 * the signature with it — mid-signing, which is exactly when someone reaches
 * for one of these. Attributes are read once, on upgrade.
 */
import { UiElement, reflectProps, define } from '../lib/base-element.js';
import { iconMarkup } from '../lib/icons.js';

let uid = 0;

/* Ink is drawn at device resolution and shown at CSS resolution, or a signature
   captured on a retina screen is a blurred one in the record. */
const LINE_WIDTH = 2;

/* How long a drawn signature has to sit still before it counts as finished.
   Long enough to lift the pen between two letters of a name, short enough that
   the pad does not feel asleep — and the state line is saying what the wait is
   for the whole time it runs. */
const SETTLE_MS = 1200;

/* What an uploaded signature may be. Stated on the control, and enforced —
   a signature is a small PNG or JPG, so a PDF and a ten-megabyte photograph
   are both refused. The same limits the portal's pad applies. */
const ACCEPTED = ['image/png', 'image/jpeg'];
const MAX_BYTES = 5 * 1024 * 1024;

/* Every route this control knows, in the order they are offered, and the
   whitelist `methods` is filtered against, so the attribute can never name a
   pane that does not exist.

   ONE WORD EACH, AND NO PICTURES. These are segments of a switch now, not a
   list of radios with a legend over them (see the note over the markup), and a
   switch is read across in a glance — "Draw Signature / Upload Image / Type
   Name" put the same noun on two of the three segments and an icon on two of
   them, which is decoration in the place a switch needs its verbs. Type Name
   keeps both its words because "Type" alone names no object. */
const METHOD_OPTIONS = {
  draw: { label: 'Draw' },
  upload: { label: 'Upload' },
  type: { label: 'Type Name' },
};
const METHODS = Object.keys(METHOD_OPTIONS);

class UiSignature extends UiElement {
  /* Deliberately empty — see the note above. */
  static observedAttributes = [];

  connectedCallback() {
    if (!this._upgraded) {
      this._upgraded = true;
      this.render();
    }
  }

  render() {
    const id = this._id || (this._id = `ui-sign-${++uid}`);
    const heading = this.attr('heading', 'Patient Electronic Signature');

    /* Whose mark this will be. Supplied by whoever put the pad on the screen
       and never asked for here — see the note at the head of this file. Read
       once, like every other attribute on this control. */
    this._signer = this.attr('signer', '').trim();

    /* Anything unrecognised is dropped rather than rendered as an empty radio,
       and a list that names nothing usable falls back to all three — a typo in
       an attribute should cost the picker nothing, not leave a form with no way
       to sign it at all. */
    const asked = this.attr('methods', METHODS.join(','))
      .split(',')
      .map((name) => name.trim())
      .filter((name) => METHODS.includes(name));
    const methods = asked.length ? asked : [...METHODS];

    /* One route is not a choice, so it is not drawn as one. The picker goes,
       and with it the second label over the mark — the heading already says
       what this is and the hint under the pad says how to use it, so in this
       shape they were three lines saying one thing. */
    const solo = methods.length === 1;

    this._method = methods[0];
    this._hasInk = false;

    /* One Clear, wherever it ends up: beside the heading when the pad is the
       whole control, and in the switch bar when there are panes to move
       between. It reads as a link rather than a button because it undoes
       rather than does — a third bordered control beside the segments would
       compete with the two that choose how to sign. */
    const clearButton = `<button type="button" class="ui-sign__clear" data-clear>
          Clear Signature
        </button>`;

    /* Written out from `methods` rather than hard-coded, so a host asking for
       two of the three gets two segments with the first of them checked — a
       fixed `checked` on Draw would leave a pad that says one thing and
       behaves as another the moment Draw is not among them. */
    const methodRow = methods
      .map((name, index) => {
        const { label } = METHOD_OPTIONS[name];
        return `<label class="ui-sign__mode" for="${id}-${name}">
            <input id="${id}-${name}" type="radio"
              name="${id}-method" value="${name}"${index === 0 ? ' checked' : ''} data-method>
            <span>${label}</span>
          </label>`;
      })
      .join('');

    this.innerHTML = `<section class="ui-sign${solo ? ' ui-sign--solo' : ''}">
      <div class="ui-sign__head">
        <h3 class="ui-sign__heading"><span>${heading}</span></h3>
        ${solo && this._method !== 'type' ? clearButton : ''}
      </div>

      <!--
        HOW TO SIGN, AND UNDOING IT, ON ONE LINE ABOVE THE THING THEY ACT ON.

        This was a fieldset — a "Signature Method" legend over a row of radios,
        then a second label naming the mark with a Clear button beside it —
        which is four lines of chrome above a pad, and two of them said
        "signature" again to someone who is looking at one. The bay's pad and
        the portal's are the same act and now read the same way: the routes on
        the left as a segmented switch, Clear Signature on the right, and the
        pad filling the width underneath.

        Still radios wearing a switch, not buttons. Buttons would imply one
        route is the real one and the others are fallbacks; these are
        alternatives, and native radios keep the arrow keys, the grouping and
        the announcement a pair of styled buttons throws away.

        Not drawn at all when there is only one route: nothing is being told
        apart, and the Clear sits up in the heading row instead.
      -->
      ${solo ? '' : `<div class="ui-sign__bar">
        <div class="ui-sign__modes" role="radiogroup" aria-label="How to sign">
          ${methodRow}
        </div>
        <span class="ui-sign__bar-end" data-mark-head
          ${this._method === 'type' ? 'hidden' : ''}>${clearButton}</span>
      </div>`}

      <div class="ui-sign__field" data-pad ${this._method === 'draw' ? '' : 'hidden'}>
        <!-- The line people sign on sits INSIDE the frame, behind the canvas
             in stacking order and inert, so it can never eat a pointer event
             meant for the pad. It replaces a hint set below the box, which is
             a line of text explaining a box that explains itself. -->
        <div class="ui-sign__pad">
          <canvas class="ui-sign__canvas" data-canvas
            aria-label="Signature pad. Draw your signature with a mouse, finger or stylus, or choose Upload to attach an image of it."></canvas>
          <p class="ui-sign__baseline" aria-hidden="true">Sign here</p>
        </div>
      </div>

      <div class="ui-sign__field" data-upload ${this._method === 'upload' ? '' : 'hidden'}>
        <!-- The zone IS the button: pressing it opens the picker, dropping on
             it does the same job. A div with a separate "Browse" beside it
             gives a keyboard user two targets for one action, and only one of
             them is reachable. -->
        <button type="button" class="ui-sign__drop" data-drop data-dragging="false">
          ${iconMarkup('image')}
          <span>Drop your signature here, or <span class="ui-sign__drop-link">click to browse</span></span>
          <span class="ui-sign__drop-note">.png, .jpg, up to 5MB.</span>
          <span class="ui-sign__drop-file" data-drop-file></span>
        </button>
        <input class="u-sr-only" type="file" accept="image/png,image/jpeg"
          data-file aria-label="Upload an image of your signature">
        <!-- Empty until there is something to show. An <img> left in the
             markup with no src is a broken-image glyph waiting for one
             stylesheet to stop hiding it. -->
        <div class="ui-sign__upload" data-upload-preview hidden></div>
        <p class="ui-field__hint ui-field__hint--error" data-upload-error hidden></p>
      </div>

      <!-- The only field left on this control, and it is not a question about
           who is signing: in this route the typed name IS the mark, the way
           the ink is in the pane above. It opens holding the signer the host
           named, so the usual act here is to read it and press Sign.

           AND THE ONE BUTTON ON THE CONTROL, WHICH IS NOT THE CONFIRM BUTTON
           COMING BACK. That one sat under a finished mark and asked the person
           to agree they had made it — see the header. This one is in the route
           where nothing else can say the mark is finished: a drawing has a pen
           that comes up and an upload has a file that arrives, but a name is a
           string that looks exactly as half-typed as it is complete, so the
           only honest end to it is the person saying so. It was said by
           pressing Enter or by walking away, which are a keyboard convention
           and an accident respectively, and neither is visible to somebody
           looking at the pad wondering how to finish. So the act has an
           affordance, and it is the only thing on this control that does. -->
      <div class="ui-sign__field" data-typed ${this._method === 'type' ? '' : 'hidden'}>
        <div class="ui-input ui-input--md">
          <input id="${id}-typed" class="ui-input__control" type="text"
            placeholder="Type your full legal name" autocomplete="name"
            aria-label="Type the signature" data-typed-input>
        </div>
        <!-- Disabled until there is a name to file, which is the rule the
             state line states in words underneath. Nothing is ever filed
             incomplete — #file guards it again — but a button that looks
             pressable and then does nothing is the pad refusing without
             saying so. -->
        <button type="button" class="ui-btn ui-btn--primary ui-btn--sm ui-sign__file"
          data-typed-file disabled>Sign</button>
      </div>

      <!-- What is still missing, said in words — and once nothing is, what is
           about to be filed and what will file it. With no button beneath it
           this line is the whole of the control's reply, so it carries the
           instruction as well as the complaint. "Not signed yet." is where it
           starts, which is the sentence the portal's pad closes with: the same
           act should read the same at the desk. -->
      <p class="ui-sign__state" data-state aria-live="polite">Not signed yet.</p>
    </section>`;

    this._canvas = this.querySelector('[data-canvas]');
    this._typedInput = this.querySelector('[data-typed-input]');
    /* Set as a property rather than written into the markup: the signer is a
       host's string, and a name with a quote in it would otherwise close the
       attribute it was being put into. */
    this._typedInput.value = this._signer;
    this._state = this.querySelector('[data-state]');
    /* The uploaded mark, once one has been read: { dataUrl, fileName }. */
    this._upload = null;
    /* A mark is filed once. Enter and the blur that follows it are two events
       about one intention, and a host that files on the first and re-paints on
       the second would be handed the same signature twice. */
    this._filed = false;
    this._settle = null;
    /* Whether a stroke is being drawn right now — read by the focusout above,
       which must not read the pen going down as the pad being finished with. */
    this._drawing = false;

    this.#wireMethod();
    this.#wireTyped();
    this.#wireDrawing();
    this.#wireUpload();

    /* Optional: a control asked for Type Name alone has no mark to wipe, so
       nothing draws a Clear for it. */
    this.querySelector('[data-clear]')?.addEventListener('click', () => this.clear());

    /*
     * DONE WITH THE PAD ALTOGETHER.
     *
     * A finished drawing files itself off the settle, and an upload files as
     * it is read, but either can be left sitting there marked and unfiled —
     * the drawing whose name arrived after the pen came up is the case. Focus
     * leaving the control for something else on the screen is that person
     * being done with it, so it is taken as the close.
     *
     * IT NO LONGER FILES A TYPED NAME. Walking away used to be how the typed
     * route ended, for want of anything better: the name is a string, and a
     * string has no moment of its own that means "finished". Now it has a
     * button that means exactly that (see the typed pane above), and leaving
     * the field to press something else on the page is not an instruction to
     * sign — it is what somebody does when they have thought better of it, or
     * gone to check the spelling of a name on the chart. A signature filed by
     * a click on the way past is one nobody chose to give.
     *
     * Focus landing anywhere INSIDE is focus that has not left: a plain blur
     * fires on the way to this control's own radios, so reaching for Draw from
     * the name field would file a mark a moment before the person went to make
     * a different one.
     *
     * A stroke in progress is the third case: the pen going down on the canvas
     * blurs the name field, and that is somebody starting to sign rather than
     * finishing.
     */
    this.addEventListener('focusout', (event) => {
      if (this._drawing) return;
      if (this._method === 'type') return;
      if (event.relatedTarget && this.contains(event.relatedTarget)) return;
      this.#file();
    });

    /* The line under the pad used to arrive at its opening sentence by
       accident: the host filled the name field a tick after upgrade, the input
       event that followed ran the state line, and it said "draw the signature
       above". With no field to fill, nothing fires, so the pad says what it is
       waiting for itself. */
    this.#syncState();

    /* The canvas has no intrinsic size, and a canvas sized by CSS alone draws
       into a 300×150 bitmap stretched to fit. Size it from its own box once it
       has one, and again whenever that box changes. */
    this.#resize();
    if (typeof ResizeObserver !== 'undefined') {
      this._observer = new ResizeObserver(() => this.#resize());
      this._observer.observe(this._canvas);
    }
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    /* A pad taken off the page mid-settle must not file a signature into a
       host that has already moved on — the commonest way there is being signed
       by somebody else while the timer was still counting. */
    this.#unschedule();
  }

  /* --- Mode ---------------------------------------------------------------- */

  #wireMethod() {
    this.querySelectorAll('[data-method]').forEach((input) =>
      input.addEventListener('change', () => {
        if (!input.checked) return;
        this._method = input.value;
        this.querySelector('[data-pad]').hidden = this._method !== 'draw';
        this.querySelector('[data-upload]').hidden = this._method !== 'upload';
        this.querySelector('[data-typed]').hidden = this._method !== 'type';

        /* Nothing for Clear to do in Type Name — the mark there is text in a
           field, and wiping text is what the field already does. Hidden rather
           than removed, so the switch does not shift along the bar when it
           goes. */
        const clear = this.querySelector('[data-mark-head]');
        if (clear) clear.hidden = this._method === 'type';

        /* A complaint about a file is about the pane being left, and it stops
           being true the moment another one is on screen. */
        this.#hushUpload();
        /* A settle running for the drawing is about a route nobody is on any
           more. Switching away from a mark is not filing it. */
        this.#unschedule();
        if (this._method === 'draw') this.#resize();
        this.#syncState();
      })
    );
  }

  #wireTyped() {
    this._typedInput.addEventListener('input', () => this.#syncState());

    /* Enter, because a single-field route is one the keyboard expects to be
       able to finish. It survives the Sign button beside it: a name typed and
       finished with Enter is one hand and no reach for the mouse, which is the
       whole reason this route exists for a clinician signing six of these on a
       list. Prevented, or a pad inside a <form> submits the page out from
       under the signature it was about to file. */
    this._typedInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#file();
    });

    this.querySelector('[data-typed-file]').addEventListener('click', () => this.#file());
  }

  /* --- Drawing -------------------------------------------------------------- */

  #resize() {
    const canvas = this._canvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width === width && canvas.height === height) return;

    /* Resizing a canvas clears it, so whatever is on it is carried across. */
    const previous = this._hasInk ? canvas.toDataURL() : null;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(this).getPropertyValue('color') || '#111827';

    if (previous) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = previous;
    }
  }

  #wireDrawing() {
    const canvas = this._canvas;
    const ctx = () => canvas.getContext('2d');

    const pointOf = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener('pointerdown', (event) => {
      this._drawing = true;
      /* A stroke begun is a signature not finished, whatever the last one
         looked like — so the settle from the previous stroke is called off and
         will be started again when this one ends. */
      this.#unschedule();
      /* Capture so a stroke that leaves the box still ends cleanly, and stop
         the browser treating the drag as a scroll or a text selection. */
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      const { x, y } = pointOf(event);
      ctx().beginPath();
      ctx().moveTo(x, y);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this._drawing) return;
      event.preventDefault();
      const { x, y } = pointOf(event);
      ctx().lineTo(x, y);
      ctx().stroke();
      if (!this._hasInk) {
        this._hasInk = true;
        this.#syncState();
      }
    });

    const stop = (event) => {
      if (!this._drawing) return;
      this._drawing = false;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      /* The pen is up, which may mean the signature is done or may mean the
         middle of it. Waiting is what tells the two apart. */
      this.#fileWhenSettled();
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  /* --- Upload ---------------------------------------------------------------
     Everything drag-and-drop does is also reachable from the picker, so a
     browser without it loses nothing. */

  #wireUpload() {
    const drop = this.querySelector('[data-drop]');
    const file = this.querySelector('[data-file]');

    drop.addEventListener('click', () => file.click());

    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.dataset.dragging = 'true';
    });

    ['dragleave', 'drop'].forEach((kind) =>
      drop.addEventListener(kind, () => {
        drop.dataset.dragging = 'false';
      })
    );

    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      this.#acceptFile(event.dataTransfer?.files?.[0]);
    });

    file.addEventListener('change', () => {
      this.#acceptFile(file.files?.[0]);
      /* Cleared so choosing the SAME file twice still fires a change event —
         otherwise re-picking after a Clear silently does nothing. */
      file.value = '';
    });
  }

  /**
   * Validate one file, read it, and show it.
   *
   * The size check happens BEFORE the read rather than after: an oversized
   * photograph should be refused in a millisecond, not once the browser has
   * base64-encoded it.
   */
  #acceptFile(chosen) {
    // Whatever the last attempt was refused for, this one is a fresh try, and
    // a stale complaint under a signature that has just been attached reads as
    // a complaint about that one.
    this.#hushUpload();

    const rejection = this.#rejectionFor(chosen);
    if (rejection) {
      this.#sayUpload(rejection);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => this.#sayUpload('That file could not be read. Try choosing it again.');
    reader.onload = () => {
      this._upload = { dataUrl: String(reader.result), fileName: chosen.name };
      const preview = this.querySelector('[data-upload-preview]');
      preview.innerHTML = `<img class="ui-sign__upload-image" alt="The uploaded signature"
        src="${this._upload.dataUrl}" data-upload-image>`;
      preview.hidden = false;
      // The zone stays put and keeps its wording; the file it took is named
      // inside it.
      this.querySelector('[data-drop-file]').textContent = chosen.name;
      this.#syncState();
      /* Nothing to wait for: choosing the file WAS the deliberate act, and the
         image is not going to get any more finished than it already is. */
      this.#file();
    };
    reader.readAsDataURL(chosen);
  }

  /** Whether this file is allowed, and if not, the sentence saying why. */
  #rejectionFor(chosen) {
    if (!chosen) return 'No file was chosen.';
    if (!ACCEPTED.includes(chosen.type)) {
      return 'That is not a PNG or a JPG. Choose a .png or .jpg image of the signature.';
    }
    if (chosen.size > MAX_BYTES) {
      return `That file is ${(chosen.size / 1024 / 1024).toFixed(
        1
      )}MB. A signature image has to be under 5MB.`;
    }
    return null;
  }

  #sayUpload(message) {
    const error = this.querySelector('[data-upload-error]');
    error.textContent = message;
    error.hidden = false;
  }

  #hushUpload() {
    const error = this.querySelector('[data-upload-error]');
    error.textContent = '';
    error.hidden = true;
  }

  #clearUpload() {
    this._upload = null;
    const preview = this.querySelector('[data-upload-preview]');
    preview.innerHTML = '';
    preview.hidden = true;
    this.querySelector('[data-drop-file]').textContent = '';
    this.#hushUpload();
  }

  /* --- State ---------------------------------------------------------------- */

  /** Whatever the chosen route calls a mark. */
  #hasMark() {
    if (this._method === 'type') return this._typedInput.value.trim().length > 0;
    if (this._method === 'upload') return Boolean(this._upload);
    return this._hasInk;
  }

  /**
   * Whose signature this is about to be.
   *
   * Two sources, because Type Name is the one route where the mark and the
   * name are the same string: there, what was typed is what gets filed, so a
   * host's `signer` is a suggestion the person can type over. Everywhere else
   * the host's answer is the only one — there is nowhere on the pad to
   * disagree with it, which is the point of taking the field away.
   */
  #signerName() {
    return this._method === 'type' ? this._typedInput.value.trim() : this._signer;
  }

  #valid() {
    return this.#signerName().length > 0 && this.#hasMark();
  }

  /*
   * File the mark — what Sign presses, and what the other two routes reach
   * on their own.
   *
   * Guarded twice over. Nothing incomplete is ever filed, which is the rule
   * the disabled button used to state in the affordance itself; and nothing is
   * filed twice, because the triggers overlap by design — pressing Enter in
   * the name field is followed by the blur that fires `change`, and both mean
   * the one intention.
   */
  #file() {
    this.#unschedule();
    if (this._filed || !this.#valid()) return;
    this._filed = true;
    this.emit('ui-sign', {
      name: this.#signerName(),
      method: this._method,
      dataUrl: this.toDataUrl(),
      fileName: this._upload?.fileName ?? null,
    });
  }

  /*
   * File it once the drawing has stopped moving.
   *
   * A signature is rarely one stroke. Filing on the first pen-up would take
   * the H of a name and file it as the whole of it, so the pad waits to see
   * whether another stroke arrives — each one calls this off and starts it
   * again (see #wireDrawing), and only a pen that stays up files anything.
   *
   * The wait is long enough to cross a t and dot an i and short enough that
   * nobody wonders whether the pad heard them; the state line says what is
   * about to happen while it runs, so the pause is never unexplained.
   */
  #fileWhenSettled() {
    this.#unschedule();
    if (!this.#valid()) return;
    this._settle = setTimeout(() => {
      this._settle = null;
      this.#file();
    }, SETTLE_MS);
  }

  #unschedule() {
    if (this._settle === null) return;
    clearTimeout(this._settle);
    this._settle = null;
  }

  /*
   * The line under the pad, which says what is still outstanding.
   *
   * On two of the three routes it is the only thing the control says about
   * itself — there is no button under a drawing or an upload to infer a rule
   * from — so the sentence names what is missing, and once nothing is, it
   * names what is about to be filed, under whose name, and what will file it,
   * because a pad that signs on its own has to say when. In Type Name the
   * button says the last of those and the line still says the rest, which is
   * why the two are decided together below. The name is half of what it says:
   * with the field gone, this line is the only place the pad tells the person
   * signing whose signature it thinks it is taking.
   *
   * The three routes end differently and the sentence says so route by route
   * rather than in one form of words covering all of them — a person waiting
   * to be told what to do next is not helped by a sentence describing three
   * things they might have been doing. "Not signed yet." is where it starts,
   * which is the sentence the portal's pad and the check-in desk both close
   * with.
   */
  #syncState() {
    if (!this._state) return;
    const name = this.#signerName();
    const marked = this.#hasMark();

    /* The Sign button and the sentence under it answer the same question, so
       they are decided in the same place: nothing to file, nothing to press. */
    const signButton = this.querySelector('[data-typed-file]');
    if (signButton) signButton.disabled = !this._typedInput.value.trim();

    if (name && marked) {
      /*
       * WHICH CLOSE IS PROMISED DEPENDS ON WHETHER ANYTHING IS COMING.
       *
       * A drawn mark files itself off the pen going up, so the pen being DOWN
       * is what makes "lift the pen and it files itself" a true thing to say.
       * It is false the other way round. Draw first and type the name second —
       * which is the order anybody signing at a bay works in, because the
       * stylus is already in their hand — and the pen was lifted a minute ago,
       * the settle that would have filed it never started because the name was
       * missing at the time, and the line sits there promising a signature
       * that nothing is going to make. That was this control's one dead end:
       * a mark made, a name given, and the pad asking for the one thing that
       * has already been done.
       *
       * So a finished drawing closes the way a typed name does, which is the
       * truth for it — Enter files it, and so does going anywhere else.
       */
      this._state.textContent =
        this._method === 'upload'
          ? `Signing as ${name}…`
          : this._method === 'type'
            ? `Ready to sign as ${name} — press Sign, or Enter, to file it.`
            : this._method === 'draw' && this._drawing
              ? `Ready to sign as ${name} — lift the pen and it files itself.`
              : `Ready to sign as ${name} — press Enter, or click away, to file it.`;
      return;
    }
    /*
     * A pad nobody was named for cannot file a drawn or uploaded mark: there
     * is no name to file it under, and a mark that cannot say who made it is
     * not a signature. It is not a dead end either — Type Name is a field, and
     * in that route the field is the name as well as the mark — so the line
     * points at the route that can still finish rather than at a field this
     * control no longer has.
     */
    if (!name) {
      this._state.textContent =
        this._method === 'type'
          ? 'Not signed yet — type the full legal name.'
          : "Not signed yet — choose Type Name and enter the signer's name.";
      return;
    }
    this._state.textContent =
      this._method === 'upload'
        ? 'Not signed yet — attach an image of the signature.'
        : 'Not signed yet — draw the signature above.';
  }

  /**
   * Wipe the mark — BOTH marks, whichever mode is showing.
   *
   * Somebody who drew one, switched to Upload and attached another has two
   * marks in hand and only one of them is about to be filed. Clearing the
   * visible one alone leaves the other waiting to be signed by a mode switch.
   * The typed name is left as it is: Clear is not offered in that route at all
   * (see #wireMethod), because emptying a text field is what the field does.
   */
  clear() {
    const canvas = this._canvas;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    this._hasInk = false;
    this.#clearUpload();
    /* Wiping the mark takes back the intention with it: a settle counting down
       towards a signature nobody wants any more must not reach the end of
       itself, and the pad has to be signable again afterwards. */
    this._filed = false;
    this.#syncState();
    // Back to the thing that is now empty, so the next attempt starts where
    // the last one was rather than at the top of the block.
    (this._method === 'upload' ? this.querySelector('[data-drop]') : canvas).focus?.();
    this.emit('ui-clear', {});
  }

  /**
   * The signature as a PNG data URL.
   *
   * A typed name is rendered onto the same canvas rather than returned as
   * text, so both modes hand back one kind of thing and whatever files it does
   * not need a branch.
   */
  toDataUrl() {
    if (this._method === 'draw') return this._canvas.toDataURL('image/png');
    /* An uploaded image is handed back as it arrived rather than redrawn onto
       the canvas: re-encoding a photograph through a 600×160 pad is how a
       legible scan becomes an unreadable smear in the record. */
    if (this._method === 'upload') return this._upload?.dataUrl ?? '';

    const canvas = this._canvas;

    /* Measured from the BITMAP, not from getBoundingClientRect().
       Choosing Type Name hides the pad, and a hidden canvas has a zero-sized
       bounding rect — so sizing the text from it produced a 0px font and filed
       a correctly-sized, entirely blank PNG. The bitmap dimensions survive
       being hidden; the layout box does not. */
    if (!canvas.width || !canvas.height) {
      canvas.width = 600;
      canvas.height = 160;
    }

    const ctx = canvas.getContext('2d');
    /* Drawn in device pixels. #resize() leaves a ratio scale on the context
       for freehand drawing, and it must not apply twice here. */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* The same token the on-screen preview is set in, so the mark that gets
       filed looks like the one the patient was shown. */
    const family =
      getComputedStyle(this).getPropertyValue('--font-family-signature').trim() ||
      "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.font = `italic ${Math.round(canvas.height / 3)}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(this._typedInput.value.trim(), Math.round(canvas.width * 0.03), canvas.height / 2);

    const url = canvas.toDataURL('image/png');

    // Hand the drawing context back the way freehand mode expects to find it.
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return url;
  }

  get value() {
    return this.#valid()
      ? {
          name: this.#signerName(),
          method: this._method,
          dataUrl: this.toDataUrl(),
          fileName: this._upload?.fileName ?? null,
        }
      : null;
  }
}

reflectProps(UiSignature, {
  heading: 'string',
  methods: 'string',
  signer: 'string',
});

define('ui-signature', UiSignature);
export { UiSignature };
