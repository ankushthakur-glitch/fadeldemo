/**
 * THE SCRIBE'S TRANSCRIPT, AND THE DRAFT IT PRODUCES.
 *
 * One consultation, written out as it was spoken, and the note somebody would
 * write from it. Both are authored here rather than generated, because there is
 * no microphone and no model behind this prototype — what is being designed is
 * the SHAPE of the interaction: what a clinician sees while the room is being
 * listened to, what comes back, and what it takes to get any of it into the
 * note.
 *
 * WHY THE CONSULTATION IS A GASTROENTEROLOGY ONE.
 *
 * The draft has to land in THIS note. Every `field` below names a key on the
 * visit note's own templates (data/visit-note-templates.js), so a draft section
 * has somewhere real to go and a clinician reviewing it is reading the same
 * vocabulary as the form underneath. A transcript about another specialty would
 * demo the animation and prove nothing about the product.
 *
 * WHAT THE DRAFT IS NOT. It is not in the note. Nothing here reaches a field
 * until somebody presses Copy to note on the section they have read — see
 * js/lib/ai-scribe.js for why that is the whole point of the feature rather
 * than a step on the way to auto-filling.
 */

/** Who is speaking, and how each is drawn. */
export const SCRIBE_SPEAKERS = {
  clinician: { label: 'Dr F. Nammour', tone: 'brand' },
  patient: { label: 'Priya Raman', tone: 'neutral' },
};

/**
 * The consultation, in order, with the clock reading each line was said at.
 *
 * `at` is seconds from the start of the recording. The panel reveals the lines
 * in time with its own timer, which is what makes the thing feel like it is
 * listening rather than replaying — and it is also why the gaps are uneven:
 * real consultations have pauses, and a transcript that arrives at a metronome
 * reads as a script being typed out.
 */
export const SCRIBE_TRANSCRIPT = [
  { at: 2, who: 'clinician', text: 'Come in, take a seat. Dr Rhye referred you for the reflux — how long has that been going on now?' },
  { at: 8, who: 'patient', text: 'About eight months, on and off. It got much worse maybe six weeks ago.' },
  { at: 15, who: 'clinician', text: 'And when it is bad, what does it feel like, and when in the day?' },
  { at: 21, who: 'patient', text: 'Burning, up behind the breastbone, mostly at night. I have been sleeping propped up on two pillows.' },
  { at: 29, who: 'clinician', text: 'Any trouble with food sticking, or pain when you swallow?' },
  { at: 34, who: 'patient', text: 'Bread sticks sometimes. Not every day. No pain, just the feeling it stops.' },
  { at: 41, who: 'clinician', text: 'Has your weight changed at all? Any vomiting, any blood, or black stools?' },
  { at: 47, who: 'patient', text: 'No blood. I have lost about four kilos since the spring, but I have been off my food.' },
  { at: 55, who: 'clinician', text: 'What have you taken for it so far?' },
  { at: 59, who: 'patient', text: 'Omeprazole 20 once a day from my GP. It helped at first. The last month it barely touches it.' },
  { at: 68, who: 'clinician', text: 'Anything in the family — stomach or oesophageal cancer, Barrett’s?' },
  { at: 74, who: 'patient', text: 'My father had stomach cancer. He was sixty-one.' },
  { at: 80, who: 'clinician', text: 'Right. Given the dysphagia, the weight loss and your father’s history, I want to look rather than keep adjusting tablets. I will arrange a gastroscopy, and we will double the omeprazole to twice a day until then.' },
  { at: 94, who: 'patient', text: 'Is that something I need to be put to sleep for?' },
  { at: 99, who: 'clinician', text: 'Sedation, not a general anaesthetic — you will be drowsy and it takes about fifteen minutes. My team will ring you with a date, and we will check H. pylori on the bloods today.' },
];

/** How long the recording runs, in seconds. */
export const SCRIBE_DURATION = 108;

/**
 * The draft, section by section, each aimed at a field on the note.
 *
 * `field` is the key it would be copied into; `title` is what the section is
 * called in the draft, which deliberately matches the note's own headings so
 * that a clinician reading the draft already knows where each piece lands.
 *
 * `cites` is which transcript lines the text came from — the timestamps, not a
 * paraphrase of them. It is what makes the draft checkable: a clinician who
 * doubts a sentence can see the words it was drawn from instead of taking the
 * summary's word for it, and a summary nobody can check is a summary nobody
 * should sign.
 */
export const SCRIBE_DRAFT = [
  {
    id: 'hpi',
    title: 'History of present illness',
    field: 'hpi',
    cites: [8, 21, 34, 47, 59],
    text:
      'Eight months of retrosternal burning, markedly worse over the past six weeks and predominantly ' +
      'nocturnal; sleeping on two pillows. Intermittent solid-food dysphagia to bread, without ' +
      'odynophagia. Unintentional 4 kg weight loss since spring with reduced appetite. No haematemesis ' +
      'and no melaena. Omeprazole 20 mg once daily via GP gave initial relief but has been ineffective ' +
      'for the last month.',
  },
  {
    id: 'history',
    title: 'Family history',
    field: 'familyHistory',
    cites: [74],
    text: 'Father: gastric carcinoma, diagnosed aged 61.',
  },
  {
    id: 'assessment',
    title: 'Assessment',
    field: 'assessment',
    cites: [34, 47, 74, 80],
    text:
      'PPI-refractory reflux with alarm features — solid-food dysphagia, 4 kg unintentional weight loss ' +
      'and a first-degree relative with gastric cancer. Endoscopic assessment is indicated rather than ' +
      'further empirical dose escalation alone.',
  },
  {
    id: 'plan',
    title: 'Plan',
    field: 'plan',
    cites: [80, 99],
    text:
      '1. Gastroscopy with biopsies — expedite given alarm features.\n' +
      '2. Omeprazole increased to 20 mg twice daily until the procedure.\n' +
      '3. H. pylori serology today.\n' +
      '4. Patient counselled that the gastroscopy is under sedation, approximately 15 minutes; the team ' +
      'will telephone with a date.',
  },
];

/**
 * What the panel says while it is drafting, in the order it says it.
 *
 * Three lines rather than a spinner alone, because the wait is long enough to
 * wonder whether anything is happening, and because each line is true of a
 * different part of the work. They are NOT progress: nothing here knows how far
 * along anything is, and a bar that pretended to would be inventing a number.
 */
export const SCRIBE_STAGES = [
  'Reading the transcript…',
  'Matching what was said to this patient’s record…',
  'Drafting the note for your review…',
];


/* ===========================================================================
   THE SAME SCRIBE, IN THE PROCEDURE ROOM

   A second set, because the room is a different room. An endoscopist does not
   hold a consultation — they call findings out over a scope while a nurse
   writes them down, and the note that comes of it is a procedure report, not a
   letter. A scribe that offered the clinic's four sections here would be
   drafting into fields this document does not have.

   The shape is identical, which is the point: one component, two sources, and
   whichever screen mounts it hands over the material its own document is made
   of. See mountAiScribe in js/lib/ai-scribe.js.
   ======================================================================== */

export const PROCEDURE_SPEAKERS = {
  clinician: { label: 'Dr F. Nammour', tone: 'brand' },
  patient: { label: 'M. Osei, RN', tone: 'neutral' },
};

export const PROCEDURE_TRANSCRIPT = [
  { at: 3, who: 'clinician', text: 'Scope in. Prep is good — Boston 8 overall, nothing pooled.' },
  { at: 11, who: 'patient', text: 'Insertion time 07:04.' },
  { at: 16, who: 'clinician', text: 'Caecum reached, appendiceal orifice and ileocaecal valve both seen. Photo for the record.' },
  { at: 25, who: 'patient', text: 'Caecum 07:11.' },
  { at: 30, who: 'clinician', text: 'Starting withdrawal. Ascending colon — sessile polyp, about 11 millimetres, Paris 0-IIa. Taking it with a hot snare.' },
  { at: 44, who: 'clinician', text: 'Resected en bloc, base looks clean, no bleeding. That is jar two.' },
  { at: 53, who: 'patient', text: 'Jar two, ascending colon, hot snare.' },
  { at: 58, who: 'clinician', text: 'Sigmoid — second polyp, 6 millimetres, sessile. Cold snare, that one goes in jar one.' },
  { at: 70, who: 'clinician', text: 'Rectum on retroflexion — grade one internal haemorrhoids, no bleeding.' },
  { at: 78, who: 'clinician', text: 'Scope out. Withdrawal nine minutes twelve. No complications, blood loss none.' },
  { at: 88, who: 'clinician', text: 'Impression: two adenomatous-looking polyps removed, otherwise normal. Repeat in three years if the pathology is what it looks like — I will confirm once the jars come back.' },
];

export const PROCEDURE_DURATION = 100;

/**
 * The draft, aimed at the procedure report's own fields.
 *
 * `indication`, `impression` and `complications` are keys on the report in
 * js/lib/encounter-docs.js. FINDINGS ARE NOT HERE, and that is deliberate: on
 * this report a finding is recorded on the diagram, as a structure, and the
 * prose is generated from it (see the Findings card). A scribe that pasted a
 * paragraph of findings into the narrative would be writing the one thing on
 * this document that nobody is allowed to write by hand.
 */
export const PROCEDURE_DRAFT = [
  {
    id: 'indication',
    title: 'Indication and preparation',
    field: 'indication',
    cites: [3],
    text:
      'Surveillance colonoscopy. Bowel preparation adequate throughout — Boston Bowel Preparation ' +
      'Scale 8, no residual pooling.',
  },
  {
    id: 'impression',
    title: 'Impression',
    field: 'impression',
    cites: [30, 58, 70, 88],
    text:
      'Two polyps removed: an 11 mm sessile polyp (Paris 0-IIa) in the ascending colon by hot snare, ' +
      'resected en bloc with a clean base, and a 6 mm sessile polyp in the sigmoid by cold snare. ' +
      'Grade I internal haemorrhoids on retroflexion. Colon otherwise normal to the caecum.',
  },
  {
    id: 'course',
    title: 'Blood loss and complications',
    field: 'complications',
    cites: [44, 78],
    text: 'No immediate complications. Estimated blood loss none. Withdrawal time 9 minutes 12 seconds.',
  },
];

export const PROCEDURE_STAGES = [
  'Reading the dictation…',
  'Matching it to the findings recorded on the diagram…',
  'Drafting the report for your review…',
];
