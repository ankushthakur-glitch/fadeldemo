/**
 * THE DIAGRAMS A FINDING CAN BE MARKED ON.
 *
 * Two of them, drawn here as data rather than shipped as images, for the same
 * reason js/lib/icons.js keeps the icon sprite in a JS string: the prototype
 * has to work from a double-clicked file with no server behind it, and an
 * <img src> that 404s is a body map with nothing to mark.
 *
 * THEY ARE SCHEMATIC ON PURPOSE, NOT FOR WANT OF AN ILLUSTRATOR.
 *
 * A body map in a note is not an anatomy plate. Its whole job is to say WHERE,
 * accurately enough that the next clinician looks in the right place, and a
 * rendered torso with musculature invites the reader to believe the pin is
 * more precise than the hand that dropped it. Rounded blocks say "this region"
 * — which is exactly what a clinician means when they point at a diagram — and
 * they survive being printed at 60mm wide on a referral letter, which the plate
 * would not.
 *
 * EVERY SHAPE IS A PRIMITIVE. Circles and rounded rectangles, no path data. A
 * hand-written <path> is a string nobody can review: a reviewer can check that
 * a rect at x=62 is where the torso ought to be, and cannot check the twelfth
 * control point of a bezier. That constraint is what keeps this file honest.
 *
 * The abdomen map is second because it is the one this practice actually
 * reaches for. Nine regions is the vocabulary a GI clinician already writes in
 * — right iliac fossa, epigastrium — so the map is a faster way of saying a
 * thing they were going to say anyway, rather than a new thing to learn.
 */

/**
 * @typedef {object} BodyMap
 * @property {string} id
 * @property {string} label      what the picker calls it
 * @property {string} caption    one line under the diagram, in the note
 * @property {string} viewBox
 * @property {string} shapes     the figure itself — inert, never interactive
 * @property {string} [guides]   region divisions and their names
 */

/** The whole patient, front view. Regions are read off the pin, not drawn. */
const BODY = {
  id: 'body',
  label: 'Whole body',
  caption: 'Body map — anterior view',
  viewBox: '0 0 200 400',
  shapes: `
    <circle cx="100" cy="38" r="26" />
    <rect x="92" y="60" width="16" height="18" rx="7" />
    <rect x="62" y="74" width="76" height="126" rx="22" />
    <rect x="68" y="192" width="64" height="48" rx="18" />
    <rect x="36" y="82" width="22" height="120" rx="11" />
    <rect x="142" y="82" width="22" height="120" rx="11" />
    <circle cx="47" cy="212" r="11" />
    <circle cx="153" cy="212" r="11" />
    <rect x="72" y="234" width="24" height="146" rx="12" />
    <rect x="104" y="234" width="24" height="146" rx="12" />
    <rect x="68" y="376" width="30" height="14" rx="7" />
    <rect x="102" y="376" width="30" height="14" rx="7" />
  `,
};

/**
 * The abdomen in its nine regions.
 *
 * The grid lines are drawn because the regions have NAMES, and a pin that can
 * be reported as "right iliac fossa" rather than as a coordinate is a pin that
 * survives being read aloud down a telephone. The labels are set small and in
 * tertiary ink: they are there to be checked against, not read through.
 */
const ABDOMEN = {
  id: 'abdomen',
  label: 'Abdomen',
  caption: 'Abdominal map — nine regions',
  viewBox: '0 0 200 240',
  shapes: `
    <rect x="24" y="16" width="152" height="208" rx="46" />
  `,
  guides: `
    <g class="bodymap__guide">
      <line x1="75" y1="18" x2="75" y2="222" />
      <line x1="125" y1="18" x2="125" y2="222" />
      <line x1="26" y1="85" x2="174" y2="85" />
      <line x1="26" y1="155" x2="174" y2="155" />
      <circle cx="100" cy="120" r="5" class="bodymap__umbilicus" />
    </g>
    <g class="bodymap__region-label" font-size="9">
      <text x="50" y="55">RUQ</text>
      <text x="100" y="55">Epigastrium</text>
      <text x="150" y="55">LUQ</text>
      <text x="50" y="125">R flank</text>
      <text x="100" y="148">Umbilical</text>
      <text x="150" y="125">L flank</text>
      <text x="50" y="195">RIF</text>
      <text x="100" y="195">Suprapubic</text>
      <text x="150" y="195">LIF</text>
    </g>
  `,
};

export const BODY_MAPS = [BODY, ABDOMEN];

export const bodyMapById = (id) => BODY_MAPS.find((map) => map.id === id) ?? BODY_MAPS[0];

/**
 * The findings offered as one press each.
 *
 * A pin with no words on it says a clinician touched the diagram and nothing
 * else, so every pin has to carry a label — and typing fourteen characters per
 * pin during a consultation is how a feature stops being used in week two.
 * These are the labels a tender abdomen actually gets written up with; the text
 * field stays, for everything this list does not say.
 */
export const BODY_MARK_PRESETS = [
  'Tenderness',
  'Guarding',
  'Rebound',
  'Mass',
  'Scar',
  'Distension',
  'Stoma',
  'Rash',
  'Swelling',
  'Pain radiates',
];
