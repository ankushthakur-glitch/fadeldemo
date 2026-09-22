/**
 * THE INSTRUMENTS THEMSELVES — NOT THE KIND OF INSTRUMENT.
 *
 * A booking says "Olympus colonoscope". The feed header said "CF-HQ190L".
 * Both are TYPES: they name what sort of thing went into the patient, the way
 * "saloon car" names a sort of car. Neither can answer the question an
 * endoscopy unit is actually asked, which is always about one object:
 *
 *   A patient has a post-procedure infection with an unusual organism. Which
 *   other patients had THAT scope, in what order, and was it reprocessed
 *   between them?
 *
 * That question is answered with a serial number or it is not answered. Every
 * duodenoscope-transmission outbreak in the last decade was traced — when it
 * was traced at all — by matching the physical instrument against the list of
 * patients it had been in. A record that stops at the model number turns a
 * morning's work into a list of everyone who had a colonoscopy that week.
 *
 * So the report records WHICH SCOPE, from the unit's own inventory, and files
 * the reprocessing cycle it came off with it.
 *
 * WHY THE REPROCESSING RECORD TRAVELS WITH THE CHOICE.
 *
 * Because it is only useful at this moment. The washer's own log knows every
 * cycle it ran; what it cannot know is which patient the instrument went into
 * afterwards, and the report is the only document standing at that junction.
 * Recording the cycle id here is what joins the two logs, and it costs one
 * field on a form somebody is already filling in.
 *
 * `hangTimeHours` is the other half of it: a reprocessed scope stored in a
 * drying cabinet is considered ready for a limited window, after which the
 * unit's policy is to reprocess it again. Which window is a local decision —
 * published practice ranges from hours to days depending on the cabinet — so
 * it is a number in this file rather than one written into a screen, and the
 * report flags a scope that is outside it rather than refusing to record one.
 * The scope in the patient is a fact; the screen's job is to say so loudly,
 * not to pretend it did not happen.
 *
 * PROTOTYPE FIXTURE DATA, like everything else in data/. A real deployment
 * reads this from the unit's asset register and its washer-disinfector logs.
 */

/**
 * What kind of instrument each one is, in the words the report uses.
 *
 * Kept separate from the model string because the model is a manufacturer's
 * part number and this is what the sentence in the narrative needs: "a
 * colonoscope was passed", not "a CF-HQ190L was passed".
 */
export const SCOPE_KINDS = ['Colonoscope', 'Gastroscope', 'Sigmoidoscope'];

/**
 * The unit's scopes.
 *
 * `serial` is the manufacturer's number engraved on the instrument and is the
 * identity that matters — it is what an outbreak investigation, a recall
 * notice and a repair record all key on. `asset` is the unit's own sticker,
 * which is what somebody standing at the cabinet reads, so both are kept: one
 * of them will be the only one written on whatever paperwork turns up.
 *
 * `reprocessedAt` is a clock reading on the day of the case, matching how
 * every other time on this run is held — see data/procedure-timings.js.
 */
export const SCOPES = [
  {
    id: 'cf-4471',
    kind: 'Colonoscope',
    model: 'CF-HQ190L',
    serial: '2417732',
    asset: 'RR-SCOPE-04',
    reprocessedAt: '07:05',
    aer: 'AER 2',
    cycle: 'C-20418',
  },
  {
    id: 'cf-4472',
    kind: 'Colonoscope',
    model: 'CF-HQ190L',
    serial: '2417815',
    asset: 'RR-SCOPE-05',
    reprocessedAt: '06:40',
    aer: 'AER 1',
    cycle: 'C-20416',
  },
  {
    id: 'pcf-2210',
    kind: 'Colonoscope',
    model: 'PCF-H190DL',
    serial: '2298104',
    asset: 'RR-SCOPE-07',
    /* Yesterday evening's cycle. Outside the hang-time window below, so a case
       recorded against it is flagged — the fixture exists so that state can be
       seen on the screen rather than only reasoned about. */
    reprocessedAt: '18:20',
    reprocessedYesterday: true,
    aer: 'AER 1',
    cycle: 'C-20390',
  },
  {
    id: 'gif-1180',
    kind: 'Gastroscope',
    model: 'GIF-HQ190',
    serial: '2611049',
    asset: 'RR-SCOPE-11',
    reprocessedAt: '07:20',
    aer: 'AER 2',
    cycle: 'C-20419',
  },
];

/**
 * How long a reprocessed scope is considered ready, in hours.
 *
 * Twelve is a middle-of-the-road drying-cabinet policy and is deliberately a
 * number in a file: units set this from their own cabinet validation and their
 * own risk assessment, and a screen with 12 baked into it would be a screen
 * that silently disagrees with half its deployments.
 */
export const SCOPE_HANG_TIME_HOURS = 12;

/** One instrument by id. */
export const scopeById = (id) => SCOPES.find((scope) => scope.id === id) ?? null;

/** How a scope names itself wherever there is only room for one line. */
export const scopeLabel = (scope) =>
  scope ? `${scope.model} · ${scope.asset} (serial ${scope.serial})` : '';

/**
 * The scopes a given procedure would reach for, most likely first.
 *
 * A colonoscopy list does not offer the gastroscope first. The whole
 * inventory is still offered, because the day a gastroscope is genuinely used
 * on a colonoscopy booking is the day the record has to be able to say so.
 */
export function scopesFor(procedureLabel = '') {
  const wants = /colonoscop|sigmoid/i.test(procedureLabel)
    ? 'Colonoscope'
    : /gastroscop|egd|upper/i.test(procedureLabel)
      ? 'Gastroscope'
      : null;
  if (!wants) return SCOPES;
  return [...SCOPES].sort(
    (a, b) => Number(b.kind === wants) - Number(a.kind === wants)
  );
}

/**
 * Is this scope's last reprocessing still inside the window?
 *
 * `now` is a clock reading on the day, like everything else here. A scope
 * reprocessed the previous evening is outside by construction — the fixture
 * says so directly rather than making this function pretend to know a date it
 * does not have.
 */
export function scopeReady(scope, now) {
  if (!scope) return { ready: false, hours: null };
  if (scope.reprocessedYesterday) return { ready: false, hours: null };

  const mins = (value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };

  const from = mins(scope.reprocessedAt);
  const to = mins(now);
  if (from === null || to === null) return { ready: true, hours: null };

  const hours = Math.max(0, (to - from) / 60);
  return { ready: hours <= SCOPE_HANG_TIME_HOURS, hours };
}
