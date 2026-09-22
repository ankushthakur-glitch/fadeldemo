/**
 * THE REVIEW OF SYSTEMS.
 *
 * The fourteen systems CMS recognises for a complete ROS, in the order they
 * are conventionally asked and taught. The order is not cosmetic: a clinician
 * running a full review works head-downwards and then outwards, and a list
 * shuffled into alphabetical order is a list that has to be read rather than
 * recited.
 *
 * WHY THIS IS NOT IN data/visit-note-templates.js.
 *
 * Because a ROS is not a section of one template — it is a block that can be
 * added to any of them, at the clinician's discretion, and it has a shape
 * nothing else on the note has: fourteen rows of the same three-way answer.
 * The templates file describes sections made of labelled FIELDS, and bending
 * it to express a fourteen-by-three matrix would have made every other section
 * in it read like a special case of this one.
 *
 * THREE ANSWERS, AND THE THIRD ONE MATTERS MOST.
 *
 * Normal and Abnormal are the two a form designer thinks of. "Not examined" is
 * the one that keeps the record honest: a system left blank is ambiguous
 * between "I asked and it was fine" and "I never got to it", and under a
 * signature that ambiguity is the clinician's problem. Saying it explicitly is
 * also what makes "All systems negative" safe to offer — see ROS_NEGATIVE
 * below and its use in js/screens/clinic-visit.js.
 */

export const ROS_ANSWERS = ['Normal', 'Abnormal', 'Not examined'];

/** The answer "All systems negative" writes into every unanswered row. */
export const ROS_NEGATIVE = 'Normal';

/**
 * Each system carries the prompt a clinician would actually say out loud.
 *
 * It is shown as the row's hint rather than as help text behind an icon: the
 * prompt IS the question, and a reviewer reading the signed note wants to know
 * what "Constitutional — Normal" was an answer to.
 */
export const ROS_SYSTEMS = [
  { id: 'constitutional', label: 'Constitutional', prompt: 'Fever, weight change, fatigue, night sweats' },
  { id: 'eyes', label: 'Eyes', prompt: 'Vision change, pain, redness, discharge' },
  { id: 'ent', label: 'ENT and mouth', prompt: 'Hearing, sore throat, sinus pain, mouth ulcers' },
  { id: 'cardiovascular', label: 'Cardiovascular', prompt: 'Chest pain, palpitations, oedema, claudication' },
  { id: 'respiratory', label: 'Respiratory', prompt: 'Cough, breathlessness, wheeze, haemoptysis' },
  { id: 'gastrointestinal', label: 'Gastrointestinal', prompt: 'Abdominal pain, bowel habit, blood, reflux' },
  { id: 'genitourinary', label: 'Genitourinary', prompt: 'Dysuria, frequency, haematuria, discharge' },
  { id: 'musculoskeletal', label: 'Musculoskeletal', prompt: 'Joint pain, swelling, stiffness, back pain' },
  { id: 'integumentary', label: 'Skin and breast', prompt: 'Rash, lesions, itch, breast lump' },
  { id: 'neurological', label: 'Neurological', prompt: 'Headache, weakness, numbness, dizziness' },
  { id: 'psychiatric', label: 'Psychiatric', prompt: 'Mood, sleep, anxiety, appetite' },
  { id: 'endocrine', label: 'Endocrine', prompt: 'Thirst, polyuria, heat or cold intolerance' },
  { id: 'haematologic', label: 'Haematologic and lymphatic', prompt: 'Bruising, bleeding, lymph nodes' },
  { id: 'immunologic', label: 'Allergic and immunologic', prompt: 'Hay fever, urticaria, recurrent infection' },
];

/**
 * Where a ROS block belongs in a note that did not come with one.
 *
 * A review of systems is asked after the history is taken and before anyone
 * lays a hand on the patient, so it is inserted immediately before the note's
 * examination section rather than wherever the button that added it happens to
 * sit. See insertPointForExtra() in js/screens/clinic-visit.js, which anchors
 * on the examination for exactly that reason.
 */
export const ROS_SECTION_ID = 'ros';
export const ROS_SECTION_TITLE = 'Review of systems';
