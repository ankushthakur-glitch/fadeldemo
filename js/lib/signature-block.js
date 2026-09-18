/**
 * A SIGNATURE, IN THE TWO STATES IT HAS.
 *
 * Unsigned it is a pad — draw, upload a scan, or type the name — signing as
 * whoever this block was told is signing. Signed it is a filed MARK: the
 * image, who made it and when, with a way to take it back off. Nothing
 * between the two: the pad files its own mark the moment it is finished (see
 * js/components/ui-signature.js), so there is no third state in which a
 * signature has been made and is waiting to be confirmed.
 *
 * THERE WAS A THIRD SHAPE HERE — the PRESS, a block that offered a clinician a
 * Confirm electronic signature button instead of a pad, on the argument that
 * an authenticated clinician does not need to draw anything. It cost
 * consistency: six documents on the run carry eight signatures, and with two
 * of them pressing rather than signing, one encounter held two ideas of what a
 * signature is. All eight became the pad, the pad's Type Name route became the
 * press for anyone who does not want to draw, and the branch sat unreferenced
 * until it was removed with the button it existed to draw.
 *
 * WHY THE MARK MATTERS AS MUCH AS THE PAD
 * "Signed electronically" is a claim about something that happened; the image is
 * the evidence, and a consent that cannot show its own signature is not much of
 * a record. And Sign again has to exist because the commonest mistake at a busy
 * desk is the wrong person signing — a mark that could not be taken back would
 * have to be undone by starting the document over.
 *
 * WHY THIS IS A MODULE
 * screens/check-in.html worked this pattern out first and had it inline. The
 * encounter needs the same thing in eight places across six documents, and a
 * second implementation of it would be a second answer to "what counts as
 * signed" — on the two documents where that question is a consent form. So the
 * markup, the wiring and the words are here, and a host supplies only what is
 * particular to it: which block, who is signing, and what to do when they do.
 *
 * Check-in still carries its own copy of this and should adopt this module;
 * changing a working consent flow is a deliberate act, not a side effect of
 * building somewhere else.
 *
 * THE PAD IS <ui-signature>, THE EHR'S OWN. It was briefly the patient
 * portal's — the argument being that a patient who signs one form at home and
 * the next at the desk should meet the same control — and that pad turned out
 * to be the wrong one for a bay: it offers two routes rather than three, and
 * it has no way to be told who is signing. Neither pad ASKS for a name any
 * more; this one is told, on `signer`. See padMarkup below.
 */
import { iconMarkup } from './icons.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* THE ROUTE IS NO LONGER PART OF THE CAPTION.
   A map from method to words — "Drawn signature", "Uploaded image", "Typed
   name" — used to close the line under every filed mark. It answered a
   question nobody reading a consent asks: the evidence is right above the
   caption, and whether the patient drew it with a stylus or attached a scan of
   the sheet says nothing about who signed or when. It was also the third of
   three things on one line, which is what pushed the two that matter down into
   an undifferentiated grey run-on. `mark.method` is still recorded on every
   filed mark for anyone who has to audit one. */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** When the mark was made, in words — the caption under a filed signature. */
export function signedAtLabel(date = new Date()) {
  const hours = date.getHours();
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} at ${hour}:${String(
    date.getMinutes()
  ).padStart(2, '0')} ${suffix}`;
}

/*
 * A FILED MARK, AND THE TWO REASONS A BLOCK MAY BE HOLDING ONE.
 *
 * Either it was just signed here — the pad filed it a moment ago, and Sign
 * again has to be under it because the commonest mistake at a busy desk is the
 * wrong person signing — or it was taken somewhere else and this block is
 * QUOTING it. The procedure consent at the bay is the second case: the patient
 * signed at the front desk on the way in, and step 4 shows that mark rather
 * than asking a pre-medicated patient on a trolley to make a second one.
 *
 * `retake` is what separates them, and it separates them by one control: a
 * quoted mark has no Sign again, because this screen did not take it and
 * cannot take it back. `source` is the line that says where it came from,
 * which a quoted mark needs and a locally-signed one does not — it sits under
 * the name and the timestamp, in the same quiet register, because "signed at
 * check-in, 45 minutes ago" is part of the same fact as who and when.
 */
function markMarkup(mark, id, { retake = true, source = '' } = {}) {
  /* An e-signature has no image to show — it was never drawn. The name is
     rendered as the mark instead, in the same italic face the clinic-visit
     screen and the encounter summary sign with, so one person's signature
     looks the same wherever it is filed. */
  const evidence = mark.dataUrl
    ? `<img src="${mark.dataUrl}" alt="Signature of ${esc(mark.name)}"
        data-testid="sig--image-${id}">`
    : `<span class="ui-sign-mark__ink" data-testid="sig--ink-${id}">${esc(
        mark.name.replace(/,.*$/, '')
      )}</span>`;

  return `<p class="ui-sign-mark__line">
      ${iconMarkup('check')}
      Signed electronically by ${esc(mark.name)}.
    </p>
    <figure class="ui-sign-mark">
      ${evidence}
      <!-- WHO AND WHEN, AS TWO THINGS RATHER THAN A RUN-ON.
           This was one grey caption-sized line with the name, the time and the
           route strung on middots, which read as a filename. The name is the
           attribution and is set as such; the time sits under it, quieter but
           still legible, because a signature's caption is the part of a record
           that gets read back months later in a dispute. -->
      <!-- THE CAPTION CARRIES THE NAME UNDER EVERY MARK, TYPED ONES INCLUDED.
           It was briefly dropped for the typed route on the argument that the
           mark there IS the name, so printing it again was the same word twice
           down one block. The argument holds for the words and not for what
           they are doing: the ink above is the SIGNATURE, set in the signature
           face at signature size, and the line below it is the ATTRIBUTION,
           set as plain text — the pair a filed signature is read as, and the
           pair a drawn mark gets. A typed attestation that showed only ink and
           a timestamp was the one signature on the run whose caption named
           nobody. -->
      <figcaption class="ui-sign-mark__by">
        <span class="ui-sign-mark__signer">${esc(mark.name)}</span>
        <span class="ui-sign-mark__at">${esc(mark.at)}</span>
        ${
          source
            ? `<span class="ui-sign-mark__source" data-testid="sig--source-${id}">${esc(
                source
              )}</span>`
            : ''
        }
      </figcaption>
    </figure>
    ${
      retake
        ? `<div class="ui-sign-mark__actions">
      <ui-button variant="ghost" size="sm" data-resign="${id}"
        data-testid="sig--resign-${id}">Sign again</ui-button>
    </div>`
        : ''
    }`;
}

/*
 * THE PATIENT'S PAD IS <ui-signature>, AND WHY IT IS NOT THE PORTAL'S.
 *
 * The portal's pad offers two routes — draw it, or upload a scan — and has no
 * way of being told whose signature it is taking, because the portal already
 * knows whose account is open. At a bay that has to be said out loud: the
 * person holding the stylus is the patient, the relative who came with them,
 * or the clinician the section names, and the mark has to carry whichever. So
 * the clinician-side control is the EHR's own <ui-signature>, which is handed
 * the signer on `signer` and offers a third route with it — Type Name, for the
 * desk with a mouse, where a drawn squiggle looks nothing like anybody's
 * handwriting and takes four attempts.
 *
 * It is also the control the clinic-visit screen already puts under this exact
 * consent (see anaesthesiaConsentBody). One anaesthesia consent collecting a
 * name on one screen and not on the other was one document with two ideas of
 * what a patient's signature is.
 *
 * `methods` is spelled out rather than left to default, so the routes offered
 * here are visible at the place that offers them — and it is the host's to
 * narrow. A block asked for `methods: 'type'` gets the pad with the picker
 * dropped and the typed name as the only route, which is what the anaesthesia
 * professional's three signatures on the procedure run now are: a name and a
 * timestamp, attested by somebody already logged in, rather than a squiggle
 * drawn with a mouse at the head of the bed. See ANAESTHESIA_SIGNATURE in
 * js/lib/encounter-docs.js.
 *
 * `signer` is the name the mark will be filed under. It goes in as an
 * attribute in the markup rather than being typed into a field after the
 * upgrade, which is what this module used to do — wait for whenDefined, find
 * the pad's name input, fill it and fire an input event at it, three steps
 * standing in for one string.
 *
 * `heading` is the block's own — the words the section above the pad uses, so
 * "Clinician signature" and "Anesthesia provider signature" head their own
 * pads. It used to be the literal string "Patient signature" for all eight
 * signatures on the run, which was invisible while every pad also carried a
 * visible section title saying the right thing, and stops being invisible the
 * moment the duplicate is hidden from the eye and the pad's heading is the
 * only name assistive tech has for the group.
 */
function padMarkup(id, heading, signer, methods) {
  return `<div class="ui-sign-pad" data-pad-wrap="${id}">
    <ui-signature methods="${esc(methods)}"
      heading="${esc(heading)}" signer="${esc(signer ?? '')}"
      data-pad="${id}" data-testid="sig--pad-${id}"></ui-signature>
  </div>`;
}

/**
 * Paint one signature block into `host`, in whichever state it is in.
 *
 * `mark` null means unsigned. `onSign` is called with the filed mark; `onClear`
 * when Sign again takes it back off. Both re-paint through the host, so a host
 * only has to store the mark and call this again.
 *
 * A host QUOTING a mark taken elsewhere passes it with `retake: false` and a
 * `source` line, and neither callback is ever reached: there is no pad to sign
 * on and no Sign again to press. See markMarkup.
 *
 * `signer` is who the mark will be filed under — the patient's name from the
 * booking on a patient block, the named clinician on a clinician one. It is
 * the answer rather than a question: the pad has no name field any more, and
 * nothing on the screen asks the person signing to type out a name the record
 * already holds.
 *
 * The relative who signs for a patient is the case that costs something here,
 * and the way through it is Type Name — that route's field IS the mark, it
 * opens holding the signer, and typing over it files the mark under whoever
 * actually made it.
 */
export function paintSignatureBlock(
  host,
  {
    id,
    heading = 'Signature',
    signer,
    role,
    /* Every route, unless the host says otherwise. The default is the one a
       consent needs — a patient at a bay may draw, photograph or type — and
       narrowing it is a decision about WHOSE signature this is rather than
       about how the control looks. */
    methods = 'draw,upload,type',
    mark,
    /* A mark this block TOOK may be taken back off; a mark it is quoting from
       somewhere else may not. See markMarkup — the whole difference is whether
       Sign again is drawn. */
    retake = true,
    /* Where a quoted mark was made, said under it. Empty for a mark signed
       here, which needs no provenance: the screen it is on is the provenance. */
    source = '',
    onSign,
    onClear,
  }
) {
  if (!host) return;

  host.innerHTML = mark
    ? markMarkup(mark, id, { retake, source })
    : padMarkup(id, heading, signer, methods);

  if (mark) {
    host.querySelector(`[data-resign="${id}"]`)?.addEventListener('ui-click', () => onClear?.());
    return;
  }

  const pad = host.querySelector(`[data-pad="${id}"]`);
  if (!pad) return;

  /* The signer went in with the markup (see padMarkup), so there is nothing to
     wait for the upgrade to fill any more. */
  /*
   * A TYPED-ONLY BLOCK FILES NO IMAGE, AND THAT IS THE WHOLE POINT OF IT.
   *
   * <ui-signature> renders a typed name onto its canvas and hands back a PNG
   * like every other route, so its consumers need no branch (see toDataUrl
   * there). Here the branch is wanted: a block narrowed to `type` is an
   * ATTESTATION — a named clinician, already logged in, saying they signed and
   * when — and filing a cursive picture of their name under it would dress the
   * press back up as the drawn mark it was chosen instead of. Dropping the
   * data URL is what makes markMarkup render the name and the timestamp
   * themselves, which is the record being asked for.
   *
   * Drawn and uploaded marks are untouched: on those the image IS the
   * evidence.
   */
  const typedOnly = methods === 'type';

  pad.addEventListener('ui-sign', (event) =>
    onSign?.({
      name: event.detail.name,
      method: event.detail.method,
      fileName: typedOnly ? null : event.detail.fileName,
      dataUrl: typedOnly ? null : event.detail.dataUrl,
      at: signedAtLabel(),
    })
  );
}
