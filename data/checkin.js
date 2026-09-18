/**
 * DEMO DATA — procedure check-in.
 *
 * The consent wording below is representative prose for a prototype. It is
 * NOT legal text and must be replaced with the practice's own approved
 * documents before this screen goes near a real patient.
 */

export const ESIGN_NOTICE =
  'By checking the box below, you agree to use electronic signatures, which ' +
  'have the same legal validity as handwritten signatures under the Electronic ' +
  'Signatures in Global and National Commerce Act (ESIGN Act).';

/**
 * The documents a procedure patient signs at the desk.
 *
 * `step` is the label this document lights up in the rail, so the rail and the
 * documents can never drift apart. `id` matches the CHECKIN_SECTIONS entry the
 * document is shown in.
 */
export const CONSENT_DOCUMENTS = [
  {
    id: 'procedure',
    title: 'Procedure Consent Form',
    step: 'Procedure Consent',
    version: 'v2.0',
    paragraphs: [
      'I acknowledge that I have been informed of the nature of the endoscopic procedure to be performed, including the benefits, risks and alternatives. I understand that no guarantee has been made regarding the outcome of this procedure.',
      'I have had the opportunity to ask questions, and all my questions have been answered to my satisfaction. I understand the risks include but are not limited to bleeding, perforation, adverse reactions to sedation and incomplete examination.',
      'I consent to the administration of conscious sedation and understand the associated risks. I have been instructed on pre and post-procedure care and agree to follow all instructions.',
      'By signing below, I voluntarily consent to the endoscopic procedure and acknowledge that I have read and understand this consent form.',
    ],
  },
  {
    id: 'insurance',
    title: 'Insurance Authorization Form',
    step: 'Insurance Disclosure',
    version: 'v2.0',
    paragraphs: [
      'I authorize the healthcare provider to submit claims to my insurance company for the services rendered. I understand that I am financially responsible for any charges not covered by insurance.',
      'I assign benefits payable for this service to the healthcare provider. I understand that I am responsible for any deductible, co-payment or co-insurance amounts.',
      'I certify that the information I have provided regarding my insurance coverage is accurate and complete. I will notify the provider immediately of any changes to my insurance coverage.',
      'By signing below, I acknowledge that I have read and understand this authorization and assignment of benefits.',
    ],
  },
  /*
   * THE PRIVACY NOTICE IS ACKNOWLEDGED, NOT SIGNED.
   *
   * The other two documents on this run are agreements: the patient consents
   * to a procedure, and assigns their insurance benefits. A signature is the
   * right instrument for both, because both are things the patient is
   * AGREEING TO.
   *
   * This one is not an agreement at all. It is a notice the practice is
   * required to give, and what the record has to be able to show is that it
   * was given — a yes-or-no fact about an event at the desk. Collecting a
   * drawn signature for it turned a tick-box duty into the longest step on the
   * screen, and made "the patient declined to acknowledge" — which is a real
   * and lawful answer — unrecordable, because the only way to answer was to
   * sign. So the pane asks the question and takes either answer.
   *
   * `acknowledge` is what makes the difference: a document that carries it
   * renders a Yes/No group where the others render a pad. See
   * buildDocumentPanes in js/screens/check-in.js.
   */
  {
    id: 'privacy',
    title: 'Notice of Privacy Practices',
    step: 'Privacy Notice',
    version: 'v2.0',
    /*
     * NO PROSE HERE, DELIBERATELY.
     *
     * The notice itself is a printed handout the patient leaves with; the
     * desk does not read it off the screen, and a copy of it sitting above
     * the question was scrolled past every time. What this pane is for is
     * the one fact the record needs — was the notice given — so the pane is
     * the question and nothing else. A document with no `paragraphs` renders
     * without the prose region at all; see buildDocumentPanes in
     * js/screens/check-in.js.
     */
    acknowledge: {
      id: 'privacyAck',
      question: 'Notice of Privacy Practices received',
      options: 'Yes,No',
    },
  },
];

export const ARRIVAL_MODES = [
  'Self-drove',
  'Family member',
  'Friend',
  'Taxi / rideshare',
  'Public transportation',
  'Medical transport',
  'Ambulance',
];

export const DISCHARGE_ARRANGEMENTS = [
  'Designated driver',
  'Family member pickup',
  'Taxi / rideshare',
  'Public transportation',
  'Extended recovery stay',
];

/**
 * Arrangements that need a named driver on file.
 *
 * Sedation means the patient cannot drive or travel unaccompanied, so these
 * are the arrangements where the desk has to record who is taking them home.
 * Taxi and public transport deliberately do NOT qualify — an unaccompanied
 * patient in a cab is the case the escort rule exists to prevent.
 */
export const DRIVER_REQUIRED = ['Designated driver', 'Family member pickup'];

/**
 * THE RAIL — every step of check-in, in the order it is worked.
 *
 * One entry per pane down the left-hand side, and the ONLY list of them: the
 * rail, the "what is outstanding" line at the foot and Previous/Next all read
 * it, so nothing on this screen can disagree with anything else about what is
 * left to do.
 *
 * WHAT A SIGNATURE IS FOR, AND WHERE IT STOPPED BEING ONE
 *
 * `sign: true` means the patient puts their own mark on that pane before it
 * counts as done. Two panes carry it, and they are the two the patient is
 * AGREEING TO something on: the procedure consent and the insurance
 * authorisation. Three panes used to carry it and no longer do.
 *
 *   Privacy Notice      is a notice the practice gives, not a bargain the
 *                       patient strikes. What the record needs is that it was
 *                       received; it is asked as Yes/No — see `acknowledge` on
 *                       the document above.
 *   Advance Directives  is four questions ABOUT the patient, answered by the
 *                       desk from what the patient says. A patient signature
 *                       under it claimed they had attested to the desk's
 *                       transcription of their own answers, which is not what
 *                       happened and not what anyone would defend later.
 *   Arrival & Discharge is logistics: how they got here and who is taking them
 *                       home. Recording an escort is not a promise the patient
 *                       makes; it is a fact the desk checks, and the check that
 *                       matters — a named driver for a sedated patient — is
 *                       enforced in arrivalAnswered() rather than by a mark
 *                       underneath it.
 *
 * Notes are the desk's own words about the arrival, so nobody signs them and
 * the step is `optional`: it can be left empty and check-in still completes.
 *
 * "Patient selected" is deliberately NOT a step any more. Check-in is opened
 * from a booking that already names the patient, and asking the desk to pick
 * them out of a directory of everyone was an invitation to check in the wrong
 * person. The patient is a fact shown at the top, not a question.
 */
export const CHECKIN_SECTIONS = [
  { id: 'procedure', kind: 'consent', title: 'Procedure Consent Form', sign: true },
  { id: 'insurance', kind: 'consent', title: 'Insurance Authorization Form', sign: true },
  { id: 'privacy', kind: 'consent', title: 'Notice of Privacy Practices', sign: false },
  { id: 'directives', kind: 'section', title: 'Advance Directives', sign: false },
  { id: 'arrival', kind: 'section', title: 'Arrival & Discharge', sign: false },
  { id: 'notes', kind: 'section', title: 'Additional Notes', sign: false, optional: true },
];
