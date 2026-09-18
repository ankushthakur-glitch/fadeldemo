/**
 * ALLERGIES — what the patient reacts to, and how badly.
 *
 * READ-ONLY. This is the practice's record of what the patient reacts to, and
 * the portal shows it rather than editing it. The add / edit dialog and the
 * vocabulary lists that fed it (allergen names per type, the reaction list,
 * the roster of clinicians who could be named as having recorded a row) went
 * with it — see the note at the top of js/lib/allergy-panel.js. An allergy is
 * amended by telling the practice; a patient quietly downgrading "Severe" to
 * "Mild" in their own copy is exactly the edit a chart must not accept.
 *
 * Two things about the shape, because both are easy to "improve" later and
 * both would be wrong:
 *
 *   - Reaction is ONE field, not a list. Two of the three rows read "Nausea,
 *     dizziness" and "Tremors, confusion" — a compound answer recorded as one
 *     value, not two values recorded.
 *   - Onset date and recorded date are two different dates and both are kept.
 *     Onset is when the patient first reacted; recorded is when it was
 *     written down. A card that showed only one would be answering a question
 *     nobody asked.
 *
 * `type` is one of Drug, Food or Environment. "Food (linked to behaviour)" is
 * that type plus a qualifier, held separately in `typeNote` so the two can be
 * printed together without the type itself becoming a free-text string.
 */

/* ============================================================================
   THE RECORD

   Dates are MM/DD/YYYY, the format every other portal fixture uses. The
   supplied table draws them DD-MM-YYYY; these are the same three dates, in
   the portal's own format rather than a ninth one.
   ========================================================================= */

export const ALLERGIES = [
  {
    id: 'alg-sertraline',
    type: 'Drug',
    typeNote: '',
    name: 'Sertraline',
    reaction: 'Nausea, dizziness',
    severity: 'Moderate',
    onsetDate: '10/04/2025',
    recordedOn: '10/04/2025',
    recordedBy: 'Phyllis Nguyen',
    note: '',
  },
  {
    id: 'alg-lithium',
    type: 'Drug',
    typeNote: '',
    name: 'Lithium',
    reaction: 'Tremors, confusion',
    severity: 'Severe',
    onsetDate: '10/10/2025',
    recordedOn: '10/10/2025',
    recordedBy: 'Richard Walker',
    note: '',
  },
  {
    id: 'alg-caffeine',
    type: 'Food',
    typeNote: 'linked to behaviour',
    name: 'Caffeine',
    reaction: 'Insomnia, increased anxiety',
    severity: 'Mild',
    onsetDate: '11/15/2025',
    recordedOn: '11/15/2025',
    recordedBy: 'Shelia Stevenson',
    note: '',
  },
];

/* ============================================================================
   READING
   ========================================================================= */

/** "Food (linked to behaviour)" — the type as a card or a printed row says it. */
export const typeLabel = (allergy) =>
  allergy.typeNote ? `${allergy.type} (${allergy.typeNote})` : allergy.type;

/**
 * Which badge a severity gets.
 *
 * Here rather than in the panel that draws it, so the screen and anything
 * else that ever shows a severity cannot disagree about which one is red.
 * Mild is green and not grey: a mild allergy is still a recorded allergy, and
 * a grey chip beside a red one reads as "no finding".
 */
const SEVERITY_TONES = { Mild: 'ok', Moderate: 'warn', Severe: 'bad' };

export const severityTone = (severity) => SEVERITY_TONES[severity] ?? 'info';
