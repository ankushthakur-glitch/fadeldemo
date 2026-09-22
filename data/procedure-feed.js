/**
 * THE LIVE FEED — WHAT THE PROCESSOR IS, AND WHAT THE ROOM MAY DO WITH IT.
 *
 * The endoscopy stack in the procedure room is somebody else's equipment. The
 * scope, the light source, the processor and the pedal under the endoscopist's
 * foot are a closed system that produces a picture and, on a press, a still.
 * Everything in this module is a fact about that system, kept apart from the
 * screen that mirrors it for the reason every other data module is kept apart:
 * a practice that changes its stack changes it here, and no screen is edited.
 *
 * THE FEED IS READ-ONLY AND THIS FILE IS WHERE THAT IS SAID FIRST.
 *
 * Nothing on this screen drives the scope. The processor is not asked to
 * freeze, the light is not turned up, the pedal is not remapped. What the EHR
 * does is WATCH — and, when the endoscopist presses capture, keep a copy of
 * the frame that was on the glass at that moment and file it against the
 * finding being looked at. A prototype that offered to drive the stack would
 * be promising an integration nobody has built and a class of failure —
 * software freezing a scope mid-withdrawal — that no endoscopy unit would
 * accept from a record system.
 *
 * WHAT IS NOT HERE. No video. There is no stream in a prototype with no server
 * and no capture card, and a file dropped in to stand in for one would be a
 * recording of somebody else's patient. What the panel draws instead is a
 * SYNTHETIC lumen — see js/lib/scope-feed.js — which is honest about being a
 * drawing while still behaving like the thing it stands for: it drifts, it
 * freezes, and the frame that is on it when capture is pressed is the frame
 * that lands on the report.
 */

/**
 * The stack this room runs, as the feed's own header names it.
 *
 * Written into the record on every capture rather than shown and forgotten: a
 * still that cannot say which scope took it is a still nobody can match to the
 * decontamination log if that scope is later recalled.
 *
 * `latencyMs` is the delay between the glass and the panel. It is on the header
 * because it is the number that says whether what is on the screen may be acted
 * on — a mirror three seconds behind the scope is a mirror you do not steer by,
 * and an endoscopist who cannot see the lag cannot know that.
 */
export const FEED_SOURCE = {
  scope: 'CF-HQ190L',
  processor: 'Olympus CV-1500',
  latencyMs: 38,
};

/**
 * THE PEDAL, AS TWO KEYS.
 *
 * Both hands are on the scope. The endoscopist is holding the control body in
 * one hand and the insertion tube in the other, and neither is coming off to
 * reach a mouse — which is why the pedal exists on the stack in the first
 * place, and why a capture control that can ONLY be clicked is a capture
 * control that does not get used during the part of the case worth capturing.
 *
 * A browser cannot read a foot pedal directly. What every endoscopy pedal on
 * the market can do is present itself as a keyboard, which is how the units
 * that already run software alongside the stack drive it, so the two pedals
 * are two keys here and the panel says which.
 *
 * Space and Enter rather than letters: a pedal sends whatever it is programmed
 * to send, and these two are what a pedal ships programmed to send. They are
 * also the two the hand reaches for when there is no pedal at all — which
 * matters for the demonstration, and for the single-handed moment at the end
 * of a case when there is one.
 *
 * `label` is what the panel prints. The hint and the handler read the same
 * list, so a pedal remapped here cannot leave the caption naming the old key.
 */
export const FEED_PEDALS = [
  { key: ' ', label: 'Space', action: 'freeze', does: 'freezes' },
  { key: 'Enter', label: 'Enter', action: 'capture', does: 'captures' },
];

/**
 * How long one clip may run before the panel stops it.
 *
 * Not a technical limit — there is nothing behind this prototype that a clip
 * is being written to. It is a limit on the RECORD: a clip is kept so a later
 * reader can watch the twenty seconds either side of something that happened,
 * and a nine-minute recording of an uneventful withdrawal is not that. The
 * panel stops at the cap and says so rather than letting a pedal pressed once
 * and forgotten run for the length of the case.
 */
export const FEED_CLIP_MAX_SECONDS = 90;

/**
 * THE STEP THE FEED WAITS FOR.
 *
 * The scope does not go in until the patient is asleep, and the patient is not
 * put to sleep until the anaesthesia professional has assessed them and signed
 * to say so. A feed that could be opened before that signature would be a
 * screen inviting the room to start the case a step early — and the one thing
 * a record system must never do is make the wrong order of events the
 * convenient one.
 *
 * So the control refuses until step 3 is signed, and says which step it is
 * waiting for. Named here rather than in the screen so that a run reordered in
 * data/procedure-encounter-run.js cannot leave the gate pointing at a step
 * that no longer exists in that position.
 */
export const FEED_GATE_STEP = 'pre-anaesthesia';

/** The clock the header pill and the capture captions are written with. */
export const feedClock = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  const hh = Math.floor(safe / 3600);
  return hh ? `${String(hh).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
};
