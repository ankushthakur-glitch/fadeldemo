/**
 * THE SPECIMEN TABLE, AND THE DIALOG THAT FILLS IT.
 *
 * Every jar the case produces, what is in it, and which finding it came off.
 * The argument for the shape of the record — a jar links to a finding rather
 * than carrying a site of its own — is written over data/procedure-specimens.js
 * and is the single rule this module is built to keep.
 *
 * WHY A JAR IS OPENED IN A DIALOG RATHER THAN AS A ROW YOU TYPE INTO.
 *
 * A jar is a commitment: a pot is filled, a label is printed and it goes in a
 * bag that leaves the room. A row that appears under the endoscopist's hands
 * and is then corrected in place has no moment where that commitment is made,
 * which is how a half-filled row ends up on a requisition — the fixative never
 * chosen, the finding never linked.
 *
 * The dialog gives it that moment. It asks the five questions in one place,
 * refuses to save without the one that matters (which finding), and hands back
 * a complete jar or nothing at all. The table is then a record to read rather
 * than a grid to fill in, which is also what makes it readable at a glance
 * across nine columns while somebody is scoping.
 *
 * The same dialog edits a jar, because editing one is the same commitment
 * again: what is on the label has to match what is in the pot.
 *
 * WHY THIS IS A LIB AND NOT PART OF THE SCREEN.
 *
 * The procedure report is one of two places a jar is created. The other is the
 * Pathology step days later, when a jar comes back and has to be matched to the
 * finding it was taken from, and the clinic visit will want to READ this table
 * when it writes the letter that tells the patient what the laboratory said.
 * Those are three screens and one record, so the record, the dialog and the way
 * they are drawn live where all three can reach them.
 */

import { iconMarkup } from './icons.js';
import { findingSummary } from './segment-findings.js';
import {
  SPECIMEN_TECHNIQUES,
  SPECIMEN_FIXATIVES,
  SPECIMEN_DEFAULT_FIXATIVE,
  SPECIMEN_STATUSES,
  INTERVENTION_TECHNIQUES,
  TISSUE_TAKING_INTERVENTIONS,
  PATHOLOGY_LAB,
  specimenTime,
} from '../../data/procedure-specimens.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* ===================== The record ===================== */

/**
 * The jars for one document, kept on the document's own answers.
 *
 * On `values` for the same reason the diagram's findings are: opening another
 * step and coming back repaints from `values`, and a jar that did not survive
 * that round trip is a jar that left the room unrecorded.
 *
 * UNDER `specimenJars` RATHER THAN `specimens`, WHICH IS NOT A DETAIL. The
 * document's field is keyed `specimens`, and every document field is seeded
 * with an empty string when its answers are first built — so a store kept under
 * the field's own name would find a string already sitting there, leave it
 * alone (`??=` only fills in null and undefined) and hand back something with
 * no `jars` on it. The structured record and the sentence read off it are two
 * different things and they get two different names.
 *
 * `nextJar` is kept rather than derived from the list's length, because a jar
 * that is deleted must not hand its number to the next one. Jar 2 is written on
 * a pot in somebody's hand; the number is spent the moment it is assigned.
 */
export function specimenStoreFor(values) {
  values.specimenJars ??= { jars: [], nextJar: 1 };
  return values.specimenJars;
}

/** The jar taken off a given finding, if there is one. */
export const jarForFinding = (store, findingId) =>
  store.jars.find((jar) => jar.findingId === findingId) ?? null;

/**
 * The interventions recorded on a finding, whatever shape the form kept them in.
 *
 * The finding forms in data/colon-findings.js ask this question three ways — a
 * polyp has an `intervention` select, several types carry a `biopsy` checklist,
 * and the cold-biopsy card is a single tick — because each reads naturally in
 * its own form. They all mean "tissue was taken like this", so they are read
 * back as one list.
 */
function interventionsOf(finding) {
  const values = finding.values ?? {};
  const found = [];

  const take = (value) => {
    if (!value) return;
    if (Array.isArray(value)) found.push(...value.filter(Boolean));
    else if (typeof value === 'string') found.push(value);
  };

  take(values.intervention);
  take(values.biopsy);
  if (values.coldBiopsyTaken) found.push('Cold biopsy forceps');

  return [...new Set(found)];
}

/**
 * Did this finding produce tissue?
 *
 * The question the "+ Add biopsy" prompt turns on. A false negative here is the
 * expensive one — a polyp snared with nothing offering to account for the
 * tissue — so anything on the taking list counts, and a finding this returns
 * false for can always be given a jar through the dialog.
 */
export const tookTissue = (finding) =>
  interventionsOf(finding).some((intervention) =>
    TISSUE_TAKING_INTERVENTIONS.includes(intervention)
  );

/** The technique a finding implies, in the short form the table writes. */
function techniqueOf(finding) {
  const intervention = interventionsOf(finding).find((entry) => INTERVENTION_TECHNIQUES[entry]);
  return INTERVENTION_TECHNIQUES[intervention] ?? SPECIMEN_TECHNIQUES[0];
}

/** The size recorded on a finding, as the jar row would write it. */
function sizeOf(finding) {
  const size = finding.values?.size;
  if (size === undefined || size === null || size === '') return '';
  if (typeof size === 'object') {
    const { from, to } = size;
    if (!from && !to) return '';
    return from && to ? `${from}–${to} mm` : `${from || to} mm`;
  }
  /* The segmented forms answer Small / Medium / Large, which is a size without
     being a measurement. It goes through as it is — a requisition reading
     "Large" is honest, and one reading "Large mm" is not. */
  return /^\d/.test(String(size)) ? `${size} mm` : String(size);
}

/**
 * What the dialog opens holding, for a jar being taken off a finding.
 *
 * Everything it can inherit, it inherits: the technique from the intervention
 * already recorded, the size from the measurement already taken. A form that
 * asked for both again would be asking the endoscopist to retype what the
 * report already knows, with their hands in a patient. Nothing here is saved
 * until the dialog is — this is a draft, not a jar.
 */
export function draftForFinding(finding) {
  return {
    findingId: finding?.id ?? '',
    depth: '',
    technique: finding ? techniqueOf(finding) : SPECIMEN_TECHNIQUES[0],
    size: finding ? sizeOf(finding) : '',
    containers: 1,
    labelledAt: specimenTime(),
    fixative: SPECIMEN_DEFAULT_FIXATIVE,
  };
}

/**
 * Commit a draft: a new jar, or changes to one that exists.
 *
 * The jar number is handed out here and nowhere else, at the moment the dialog
 * is saved — which is the moment a pot is actually labelled.
 */
export function saveSpecimen(store, draft, existingId = '') {
  const existing = store.jars.find((jar) => jar.id === existingId);
  if (existing) {
    Object.assign(existing, draft);
    /* A jar with a time on it has been labelled. The status follows the fact
       rather than being a fourth thing to remember, which is the same reason
       the technique is inherited rather than asked for. A jar already gone with
       a requisition stays gone. */
    if (existing.status === 'labelling' && draft.labelledAt) existing.status = 'labelled';
    return existing;
  }

  const jar = {
    id: `jar-${store.nextJar}`,
    jar: store.nextJar,
    status: draft.labelledAt ? 'labelled' : 'labelling',
    ...draft,
  };
  store.nextJar += 1;
  store.jars.push(jar);
  return jar;
}

/**
 * The document's answer for the specimen field, as a sentence.
 *
 * The same bargain the diagram and the photo field strike: one structured
 * record, one readable form of it, and nothing writes the readable one by hand.
 * It is what a required check reads and what the foot counts.
 */
export function describeSpecimens(store) {
  if (!store.jars.length) return '';
  const jars = store.jars.length === 1 ? '1 jar' : `${store.jars.length} jars`;
  const containers = store.jars.reduce((sum, jar) => sum + (Number(jar.containers) || 1), 0);
  return containers === store.jars.length
    ? `${jars} taken`
    : `${jars} taken, ${containers} containers`;
}

/* ===================== Drawing it ===================== */

/** The finding a jar came off, and how its site and description read. */
function siteOf(jar, ctx) {
  const finding = ctx.findings.find((f) => f.id === jar.findingId);
  if (!finding) {
    /* A jar whose finding was deleted under it. The jar is still real — the pot
       exists — so it is kept and says so, rather than vanishing to keep the
       table tidy. Deleting the tissue's only record to preserve a clean join is
       exactly backwards. */
    return { site: 'Finding removed', detail: 'Re-link this jar, or remove it', finding: null };
  }
  const segment = ctx.segments.find((s) => s.id === finding.segment);
  const type = ctx.types.find((t) => t.id === finding.type);
  const site = segment?.label ?? finding.segment;
  return {
    site: jar.depth ? `${site}, ${jar.depth} cm` : site,
    detail: [type?.label ?? finding.type, findingSummary(finding, ctx.types)]
      .filter(Boolean)
      .join(', '),
    finding,
  };
}

/** How one finding reads in the dialog's list and on a chip. */
export function findingLabel(finding, ctx) {
  const segment = ctx.segments.find((s) => s.id === finding.segment);
  const type = ctx.types.find((t) => t.id === finding.type);
  const summary = findingSummary(finding, ctx.types);
  return `${segment?.label ?? finding.segment} — ${type?.label ?? finding.type}${
    summary ? `, ${summary}` : ''
  }`;
}

const statusChip = (status) => {
  const state = SPECIMEN_STATUSES[status] ?? SPECIMEN_STATUSES.labelling;
  return `<span class="spec__status spec__status--${esc(status)}">${esc(state.label)}</span>`;
};

/**
 * The table, or the line that says why there is not one yet.
 *
 * Rows are READ, not typed into. Every answer on them was committed in the
 * dialog, so what is drawn here is text at a glance — which is the only way
 * nine columns stay legible to somebody who is holding a scope — with the two
 * things you can do to a jar on the end of the row.
 */
/**
 * The count and the three controls, drawn into the section's own heading.
 *
 * Separated from the table because it belongs to the CARD, not to the rows:
 * "Specimens · 0 jars" is one statement and reads as one line, and the three
 * controls beside it are things you do to the card whether or not it has any
 * rows yet. The screen paints this into a slot in the heading — see
 * docSectionMarkup in js/screens/encounter.js.
 */
export function specimensHeadHtml(store) {
  return `<span class="spec__count" data-testid="encv--spec-count">${store.jars.length} ${
    store.jars.length === 1 ? 'jar' : 'jars'
  }</span>
    <span class="spec__head-actions">
      <ui-button variant="outline" size="sm" icon="plus" data-spec-add
        data-testid="encv--spec-add">Add biopsy</ui-button>
      <ui-button variant="outline" size="sm" icon="printer" data-spec-labels
        data-testid="encv--spec-labels">Print jar labels</ui-button>
      <ui-button variant="primary" size="sm" icon="document" data-spec-requisition
        data-testid="encv--spec-requisition">Requisition</ui-button>
    </span>`;
}

/**
 * The table. Always the table, including before there is anything in it.
 *
 * An empty card used to say "No specimens yet" in prose. The columns say it
 * better: a head with nothing under it is unmistakably a list with nothing in
 * it, and it also shows what a jar WILL be asked for — which is the one useful
 * thing an empty state can do. It means the card does not change shape when the
 * first jar is labelled, either; a row simply appears where the rows go.
 *
 * Rows are READ, not typed into. Every answer on them was committed in the
 * dialog, so what is drawn here is text at a glance — which is the only way
 * nine columns stay legible to somebody who is holding a scope — with the two
 * things you can do to a jar on the end of the row.
 */
export function specimensHtml(store, ctx) {
  const rows = store.jars
    .map((jar) => {
      const { site, detail } = siteOf(jar, ctx);
      return `<tr class="spec__row" data-jar="${esc(jar.id)}" data-testid="encv--spec-row-${esc(
        jar.id
      )}">
        <td class="spec__cell"><span class="spec__jar">${jar.jar}</span></td>
        <td class="spec__cell spec__cell--site">${esc(site)}</td>
        <td class="spec__cell spec__cell--finding">${esc(detail)}</td>
        <td class="spec__cell">${esc(jar.technique)}</td>
        <td class="spec__cell">${esc(jar.size || '—')}</td>
        <td class="spec__cell">${esc(jar.containers)}</td>
        <td class="spec__cell">${esc(jar.labelledAt || '—')}</td>
        <td class="spec__cell">${esc(jar.fixative.split(' (')[0])}</td>
        <td class="spec__cell">${statusChip(jar.status)}</td>
        <td class="spec__cell spec__cell--actions">
          <button type="button" class="spec__icon-btn" data-jar-edit
            aria-label="Edit jar ${jar.jar}"
            data-testid="encv--spec-edit-${esc(jar.id)}">${iconMarkup('pencil')}</button>
          <button type="button" class="spec__icon-btn spec__icon-btn--drop" data-jar-drop
            aria-label="Remove jar ${jar.jar}"
            data-testid="encv--spec-drop-${esc(jar.id)}">${iconMarkup('trash')}</button>
        </td>
      </tr>`;
    })
    .join('');

  /* An empty list gets a row of its own rather than an empty <tbody>. A table
     that stops at its header collapses to two rules a few pixels apart, which
     reads as a row that failed to draw rather than as a list with nothing in
     it — so the space where rows go is held open and says which it is. */
  const empty = `<tr class="spec__row spec__row--empty" data-testid="encv--spec-empty">
      <td class="spec__cell spec__cell--empty" colspan="10">No jars yet</td>
    </tr>`;

  return `<div class="spec__scroll">
      <table class="spec__table" data-testid="encv--spec-table">
        <thead>
          <tr>
            <th scope="col">Jar</th><th scope="col">Site</th><th scope="col">Linked finding</th>
            <th scope="col">Technique</th><th scope="col">Size</th><th scope="col">Containers</th>
            <th scope="col">Labelled</th><th scope="col">Fixative</th><th scope="col">Status</th>
            <th scope="col"><span class="u-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>${rows || empty}</tbody>
      </table>
    </div>`;
}

/* ===================== The dialog ===================== */

const selectOptions = (options, chosen) =>
  options
    .map(
      (option) =>
        `<option value="${esc(option)}"${option === chosen ? ' selected' : ''}>${esc(
          option
        )}</option>`
    )
    .join('');

/**
 * The dialog's markup, built once and filled on every open.
 *
 * `<ui-modal>` brings the focus trap, Esc, and focus return to whatever opened
 * it — see js/components/ui-modal.js. The finding is asked FIRST because it is
 * the answer the jar cannot be saved without, and the one that fills in three
 * of the answers under it.
 */
export function specimenDialogHtml() {
  return `<ui-modal id="specimenModal" heading="Add biopsy" size="md"
    data-testid="encv--spec-modal">
    <div class="specform">
      <ui-select class="specform__wide" label="Which finding did this come off?"
        placeholder="Select a finding" data-spec-finding
        data-testid="encv--spec-f-finding"></ui-select>
      ${/* Shown ONLY when there is nothing to pick. The dialog opens either
           way — a control that does nothing when pressed reads as broken,
           whatever good reason it has — and this is the line that says why the
           list above is empty and what to do about it. */ ''}
      <p class="specform__none" data-spec-none hidden>No findings recorded yet. Click a segment on
        the diagram to record what was seen, then label its jar here.</p>

      <ui-input label="Depth from anus (cm)" type="number" placeholder="e.g. 25"
        data-spec-depth data-testid="encv--spec-f-depth"></ui-input>
      <ui-select label="Technique" data-spec-technique data-testid="encv--spec-f-technique">
        ${selectOptions(SPECIMEN_TECHNIQUES)}
      </ui-select>

      <ui-input label="Size" placeholder="e.g. 11 mm" data-spec-size
        data-testid="encv--spec-f-size"></ui-input>
      <ui-input label="Containers" type="number" value="1" data-spec-containers
        data-testid="encv--spec-f-containers"></ui-input>

      <ui-input label="Time labelled" type="time" data-spec-time
        data-testid="encv--spec-f-time"></ui-input>
      <ui-select label="Fixative" data-spec-fixative data-testid="encv--spec-f-fixative">
        ${selectOptions(SPECIMEN_FIXATIVES, SPECIMEN_DEFAULT_FIXATIVE)}
      </ui-select>
    </div>

    <div slot="footer">
      <ui-button variant="tertiary" data-modal-dismiss
        data-testid="encv--spec-cancel">Cancel</ui-button>
      <ui-button variant="primary" data-spec-save
        data-testid="encv--spec-save">Label jar</ui-button>
    </div>
  </ui-modal>`;
}

const fieldValue = (modal, name) => modal.querySelector(`[data-spec-${name}]`)?.value ?? '';

function setFieldValue(modal, name, value) {
  const field = modal.querySelector(`[data-spec-${name}]`);
  if (field) field.value = value ?? '';
}

/**
 * Open the dialog on a draft, and call back with what was saved.
 *
 * `jar` edits an existing one; `finding` opens a new jar already linked to it —
 * which is the path the "+ Add biopsy" prompt on a finding takes, and why that
 * prompt lands on a form with four of its answers already filled in rather than
 * on an empty one.
 *
 * The finding list is rebuilt on every open because findings are recorded while
 * the report is open; a list built once would stop offering the polyp taken two
 * minutes ago.
 */
export function openSpecimenDialog({ modal, store, ctx, jar = null, finding = null, trigger, onSave, announce }) {
  if (!modal) return;

  const draft = jar ? { ...jar } : draftForFinding(finding);
  const select = modal.querySelector('[data-spec-finding]');

  /* `optionList` — the component's own data API — rather than <option>
     children written into it. Two reasons, and both are about the fact that
     this dialog is filled again on every open: a <ui-select> that has already
     upgraded keeps the options it captured when it connected, so markup pushed
     in afterwards is drawn over and lost (which is exactly what happened the
     first time this was written). And the comma-separated `options` attribute
     cannot carry these labels at all — a finding reads "Sigmoid colon — Polyp,
     6 mm", and a list split on commas would tear that into three.
     See js/components/ui-select.js. */
  select.optionList = ctx.findings.map((entry) => {
    const taken = jarForFinding(store, entry.id);
    const mine = entry.id === draft.findingId;
    return {
      value: entry.id,
      /* A finding that already has a jar is still offered — a lesion can be
         sampled twice — but it says which jar it is already on, so a second one
         is a decision rather than an accident. */
      label: `${findingLabel(entry, ctx)}${taken && !mine ? ` (already on jar ${taken.jar})` : ''}`,
    };
  });

  setFieldValue(modal, 'finding', draft.findingId);
  setFieldValue(modal, 'depth', draft.depth);
  setFieldValue(modal, 'technique', draft.technique);
  setFieldValue(modal, 'size', draft.size);
  setFieldValue(modal, 'containers', draft.containers);
  setFieldValue(modal, 'time', draft.labelledAt);
  setFieldValue(modal, 'fixative', draft.fixative);

  modal.setAttribute('heading', jar ? `Jar ${jar.jar}` : 'Add biopsy');

  /* `text`, NOT textContent. <ui-button> reads its label once and renders its
     own markup inside itself, so assigning textContent on the host wipes that
     markup and leaves a bare word where the button was — the attribute exists
     for buttons whose wording changes. See js/components/ui-button.js. */
  const save = modal.querySelector('[data-spec-save]');
  save?.setAttribute('text', jar ? 'Save jar' : 'Label jar');

  /*
   * A DIALOG THAT OPENS ON AN EMPTY LIST STILL OPENS.
   *
   * On a report where nothing has been recorded yet there is no finding to
   * link a jar to, and the shared menu refuses to open a list with no rows —
   * see visibleOptions in js/lib/select-menu.js. Pressing the dropdown then
   * does nothing at all, which reads as a broken control rather than as an
   * empty one.
   *
   * So the dialog says it, in place, where the list would have been, and the
   * commit is turned off while it stands: the form is legible, its one
   * outstanding requirement is named, and nothing about it is silently inert.
   */
  const none = modal.querySelector('[data-spec-none]');
  const nothingToLink = !ctx.findings.length;
  /* Optional chaining, not decoration: a dialog built by an EARLIER version of
     this file can still be sitting in the page — the element is created once
     and kept — and reaching through a null would throw here, before
     modal.open() is ever called. The dialog would then fail to open at all,
     which is the one failure this whole passage exists to avoid. */
  if (none) none.hidden = !nothingToLink;
  save?.toggleAttribute('disabled', nothingToLink);

  /* Bound per open and dropped on close: the handler closes over THIS draft and
     this callback, and a listener left behind would save the previous jar's
     answers the next time the dialog was used. */
  const commit = () => {
    const findingId = fieldValue(modal, 'finding');
    if (!findingId) {
      announce?.('A jar has to name the finding it came off — that is what its label says.');
      return;
    }

    const saved = saveSpecimen(
      store,
      {
        findingId,
        depth: fieldValue(modal, 'depth'),
        technique: fieldValue(modal, 'technique'),
        size: fieldValue(modal, 'size'),
        containers: Math.max(1, Number(fieldValue(modal, 'containers')) || 1),
        labelledAt: fieldValue(modal, 'time'),
        fixative: fieldValue(modal, 'fixative'),
      },
      jar?.id ?? ''
    );

    close();
    modal.close();
    onSave?.(saved, Boolean(jar));
  };

  function close() {
    save?.removeEventListener('click', commit);
    modal.removeEventListener('ui-close', close);
  }

  save?.addEventListener('click', commit);
  modal.addEventListener('ui-close', close);
  modal.open(trigger);
}

/* ===================== What prints ===================== */

/**
 * The jar labels, one per container.
 *
 * Per CONTAINER rather than per jar: a jar holding three pots needs three
 * labels, and a nurse who has to photocopy the third one is a nurse writing it
 * by hand on the side of a pot.
 *
 * Every label carries the patient, the jar number, the site and the time,
 * because a label's whole job is to survive being separated from this report.
 */
export function jarLabelsMarkup(store, ctx, header) {
  const labels = store.jars.flatMap((jar) => {
    const { site } = siteOf(jar, ctx);
    const count = Math.max(1, Number(jar.containers) || 1);
    return Array.from({ length: count }, (_, index) => `<div class="speclabel">
        <p class="speclabel__jar">Jar ${jar.jar}${
          count > 1 ? ` <span>(${index + 1} of ${count})</span>` : ''
        }</p>
        <p class="speclabel__name">${esc(header.patient)}</p>
        <p class="speclabel__meta">MRN ${esc(header.mrn)} · DOB ${esc(header.dob)}</p>
        <p class="speclabel__site">${esc(site)}</p>
        <p class="speclabel__meta">${esc(jar.technique)} · ${esc(jar.fixative)}</p>
        <p class="speclabel__meta">${esc(header.date)} ${esc(jar.labelledAt)} · ${esc(
          header.endoscopist
        )}</p>
      </div>`);
  });

  return `<section class="speclabels">
      <h1 class="speclabels__title">Specimen labels — ${esc(header.patient)}</h1>
      <div class="speclabels__sheet">${labels.join('')}</div>
    </section>`;
}

/**
 * The pathology requisition, built from the same rows.
 *
 * Built rather than filled in: every fact on it is already on the report, and a
 * requisition typed a second time is a requisition that can disagree with the
 * report it came from. What the form adds is the laboratory's heading and the
 * clinical detail they need to read the tissue.
 */
export function requisitionMarkup(store, ctx, header) {
  const rows = store.jars
    .map((jar) => {
      const { site, detail } = siteOf(jar, ctx);
      return `<tr>
        <td>${jar.jar}</td>
        <td>${esc(site)}</td>
        <td>${esc(detail)}</td>
        <td>${esc(jar.technique)}</td>
        <td>${esc(jar.size || '—')}</td>
        <td>${esc(jar.containers)}</td>
        <td>${esc(jar.fixative)}</td>
        <td>${esc(jar.labelledAt)}</td>
      </tr>`;
    })
    .join('');

  return `<section class="specreq">
      <header class="specreq__head">
        <div>
          <h1 class="specreq__title">Histopathology requisition</h1>
          <p class="specreq__lab">${esc(PATHOLOGY_LAB.name)} · ${esc(PATHOLOGY_LAB.address)}</p>
          <p class="specreq__lab">${esc(PATHOLOGY_LAB.phone)} · Account ${esc(
            PATHOLOGY_LAB.account
          )}</p>
        </div>
        <dl class="specreq__facts">
          <div><dt>Patient</dt><dd>${esc(header.patient)}</dd></div>
          <div><dt>MRN</dt><dd>${esc(header.mrn)}</dd></div>
          <div><dt>DOB</dt><dd>${esc(header.dob)}</dd></div>
          <div><dt>Collected</dt><dd>${esc(header.date)}</dd></div>
          <div><dt>Endoscopist</dt><dd>${esc(header.endoscopist)}</dd></div>
          <div><dt>Procedure</dt><dd>${esc(header.procedure)}</dd></div>
        </dl>
      </header>

      <h2 class="specreq__sub">Specimens — ${store.jars.length} ${
        store.jars.length === 1 ? 'jar' : 'jars'
      }</h2>
      <table class="specreq__table">
        <thead><tr>
          <th>Jar</th><th>Site</th><th>Finding</th><th>Technique</th>
          <th>Size</th><th>Containers</th><th>Fixative</th><th>Labelled</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2 class="specreq__sub">Clinical detail</h2>
      <p class="specreq__prose">${esc(header.indication || 'Not recorded on the report.')}</p>

      <p class="specreq__sign">Requested by ${esc(header.endoscopist)} · ${esc(header.date)}</p>
    </section>`;
}
