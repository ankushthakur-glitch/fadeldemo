/**
 * THE NARRATIVE NOTE — THE REPORT AS PROSE, WRITTEN FROM THE STRUCTURE.
 *
 * Everything on the procedure report is collected as structure: segments
 * pressed on a diagram, types chosen from a list, jars linked to findings,
 * clock readings filed against named marks. That is the right way to COLLECT
 * it — a polyp recorded as `{segment: 'ascending', size: 11, paris: '0-IIa'}`
 * can be counted, audited, recalled on and matched to a pathology result.
 *
 * It is not the way anybody READS it. The referrer opening the letter, the
 * endoscopist going back in eighteen months, the coroner: all three read
 * sentences. Until now the report's answer to that was a textarea called
 * Impression, which meant the prose was typed a second time from the
 * structured answers on the same page — two accounts of one case, free to
 * disagree, with nothing to say which was right.
 *
 * So the narrative is GENERATED and read-only, and the argument is the one the
 * findings diagram already made: record the anatomy, and the prose writes
 * itself. The endoscopist's own words still have a place — the Impression is
 * their judgement, which is the one thing no structure implies — but the
 * account of what was done and what was seen is assembled from the record
 * rather than retyped beside it.
 *
 * WHAT IT WILL NOT DO IS SMOOTH OVER A GAP.
 *
 * Every sentence here is conditional on the facts it needs. A case with no
 * caecal time does not get a sentence about the withdrawal; a case with no
 * findings says the examination was normal only if a normal finding was
 * actually recorded, and otherwise says nothing had been recorded yet. A
 * generator that wrote round its missing inputs would produce a report that
 * reads complete and is not, which is the specific failure that makes people
 * distrust generated notes and retype them — and then we are back to two
 * accounts of one case.
 */

import { findingSummary } from './segment-findings.js';
import { durationLabel, WITHDRAWAL_TARGET_MINUTES } from '../../data/procedure-timings.js';
import { scopeLabel } from '../../data/procedure-scopes.js';

/* ===================== One finding, as a sentence ===================== */

/**
 * The sentence for a single finding.
 *
 * THE ONE NARRATOR. It used to live in the encounter screen, where it produced
 * the string held on the report's `findings` field; the narrative note then
 * wanted the same sentences and there is no version of this worth having
 * twice. Both read it from here, so a finding cannot be described one way in
 * the field the impression seeds from and another in the note that prints.
 */
export function narrateFinding(finding, config) {
  const segment = config.segments.find((s) => s.id === finding.segment)?.label ?? finding.segment;
  const type = config.types.find((t) => t.id === finding.type)?.label ?? finding.type;
  const summary = findingSummary(finding, config.types);
  const note = String(finding.values?.notes ?? '').trim();
  const notes = note ? ` ${note.replace(/\.?$/, '.')}` : '';

  /* "Normal" is the one type whose sentence is not "<thing> in the <place>" —
     a normal segment is a statement ABOUT the segment, not a finding sitting
     inside it. */
  if (finding.type === 'normal') return `The ${segment.toLowerCase()} appeared normal.${notes}`;

  return `${type}${summary ? ` — ${summary}` : ''} in the ${segment.toLowerCase()}.${notes}`;
}

/** Every finding, one sentence each, in the order they were recorded. */
export const narrateFindings = (list, config) =>
  (list ?? []).map((finding) => narrateFinding(finding, config)).join('\n');

/* ===================== The note ===================== */

const sentence = (text) => `${String(text).trim().replace(/\.?$/, '.')}`;

/** Join a list the way a sentence does: "a, b and c". */
function listOf(items) {
  const parts = items.filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The whole note, as titled blocks.
 *
 * Blocks rather than one string, because the reader's eye needs the same four
 * or five landmarks in every report on the pile — and because a block with
 * nothing to say is then simply absent instead of leaving a heading over a
 * blank. Each is `{ id, title, text }` and the caller renders them.
 *
 * `report` is everything the note reads, gathered by the screen:
 *   procedure, endoscopist, sedation, indication, icd
 *   scope            the instrument record, or null
 *   timings          from procedureTimings()
 *   prepType, prepQuality, extent
 *   findings, config the diagram's store and its anatomy
 *   jars             the specimen record
 *   photos           how many images the report carries
 *   bloodLoss, bloodLossAmount, complications
 */
export function narrativeBlocks(report) {
  const blocks = [];
  const add = (id, title, lines) => {
    const text = lines.filter(Boolean).join(' ');
    if (text) blocks.push({ id, title, text });
  };

  /* --- What was done, to whom, with what ------------------------------- */
  const procedure = report.procedure || 'The procedure';
  const by = report.endoscopist ? ` by ${report.endoscopist}` : '';
  const under = report.sedation ? ` under ${report.sedation.toLowerCase()}` : '';

  add('procedure', 'Procedure', [
    sentence(`${procedure} was performed${by}${under}`),
    /* THE INSTRUMENT, BY ITS SERIAL. The whole reason the report asks which
       physical scope was used — see data/procedure-scopes.js — is so that
       this sentence can be written, and so that it can be searched for. */
    report.scope
      ? sentence(
          `A ${report.scope.kind.toLowerCase()} was used: ${scopeLabel(report.scope)}`
        )
      : 'The instrument used has not been recorded.',
    report.scope?.cycle
      ? sentence(
          `It was last reprocessed at ${report.scope.reprocessedAt} on ${report.scope.aer}, cycle ${report.scope.cycle}`
        )
      : '',
  ]);

  /* --- Why ------------------------------------------------------------- */
  const codes = (report.icd ?? []).join(', ');
  add('indication', 'Indication', [
    report.indication ? sentence(report.indication) : '',
    codes ? sentence(`Coded as ${codes}`) : '',
  ]);

  /* --- Preparation and extent ------------------------------------------ */
  add('preparation', 'Preparation and extent', [
    report.prepQuality
      ? sentence(
          `Bowel preparation was ${report.prepQuality.toLowerCase()}${
            report.prepType ? ` (${report.prepType})` : ''
          }`
        )
      : '',
    report.extent ? sentence(`The extent reached was ${report.extent.toLowerCase()}`) : '',
    report.outcome ? sentence(`The examination was ${report.outcome.toLowerCase()}`) : '',
  ]);

  /* --- The clock ------------------------------------------------------- */
  const t = report.timings ?? {};
  const timingLines = [];
  if (t.scopeIn && t.scopeOut) {
    timingLines.push(sentence(`The scope was passed at ${t.scopeIn} and withdrawn at ${t.scopeOut}`));
  }
  if (t.insertion !== null && t.insertion !== undefined) {
    timingLines.push(sentence(`Insertion to the caecum took ${durationLabel(t.insertion)}`));
  }
  if (t.withdrawal !== null && t.withdrawal !== undefined) {
    /* Stated with the standard it is read against, because the number on its
       own means nothing to a reader who does not already know the six. */
    timingLines.push(
      sentence(
        `Withdrawal time was ${durationLabel(t.withdrawal)}${
          t.withdrawalShort
            ? `, below the ${WITHDRAWAL_TARGET_MINUTES}-minute standard for a screening examination`
            : ''
        }`
      )
    );
  } else if (t.scopeOut) {
    /* The gap is NAMED rather than left out. A report that simply omits the
       withdrawal time reads as one where nobody thought to measure it; this
       reads as one where the caecal time is missing, which is the actual
       state and is fixable. */
    timingLines.push('Withdrawal time cannot be stated — no caecal time was recorded.');
  }
  add('timings', 'Timings', timingLines);

  /* --- What was seen --------------------------------------------------- */
  const findings = report.findings ?? [];
  add('findings', 'Findings', [
    findings.length
      ? findings.map((finding) => narrateFinding(finding, report.config)).join(' ')
      : 'No findings have been recorded on the diagram yet.',
  ]);

  /* --- What was taken -------------------------------------------------- */
  const jars = report.jars ?? [];
  if (jars.length) {
    const described = jars.map((jar) => {
      const site = jar.site || 'unstated site';
      const technique = jar.technique ? `, ${jar.technique.toLowerCase()}` : '';
      return `jar ${jar.jar} (${site}${technique})`;
    });
    add('specimens', 'Specimens', [
      sentence(
        `${jars.length} specimen${jars.length === 1 ? '' : 's'} ${
          jars.length === 1 ? 'was' : 'were'
        } taken and sent for histology: ${listOf(described)}`
      ),
    ]);
  }

  /* --- What happened to the patient ------------------------------------ */
  const loss = report.bloodLoss;
  add('course', 'Course', [
    loss
      ? sentence(
          /^none$/i.test(loss)
            ? 'There was no significant blood loss'
            : `Blood loss was ${loss.toLowerCase()}${
                report.bloodLossAmount ? `, estimated at ${report.bloodLossAmount} mL` : ''
              }`
        )
      : '',
    report.complications ? sentence(report.complications) : '',
  ]);

  /* --- The pictures ---------------------------------------------------- */
  if (report.photos) {
    add('images', 'Images', [
      sentence(
        `${report.photos} image${report.photos === 1 ? '' : 's'} ${
          report.photos === 1 ? 'was' : 'were'
        } captured and filed with this report`
      ),
    ]);
  }

  return blocks;
}

/** The note as one block of text — what Copy puts on the clipboard. */
export const narrativeText = (report) =>
  narrativeBlocks(report)
    .map((block) => `${block.title.toUpperCase()}\n${block.text}`)
    .join('\n\n');
