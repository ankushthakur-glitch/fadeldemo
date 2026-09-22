/**
 * THE PATIENT CARD — who this is, on every screen that writes a note.
 *
 * WHY THIS IS A COMPONENT AND NOT FOUR PAINTERS
 * It was four. The procedure encounter, the clinic visit, the clinic visit's
 * fork and the encounter summary each drew their own version of one card, and
 * they had drifted in every way four copies drift: three different wordings of
 * the identity line, two different sets of facts under it, a name that was a
 * link to the chart on one screen and dead text on the others, and — the one
 * that actually matters — an insurance plan READ FROM THE COVERAGE RECORD on
 * two screens and TYPED INTO THE MARKUP on the other two. A clinician moving
 * from the visit note to the summary could watch the patient's payer change.
 *
 * So it is one card now, drawn here, mounted by each screen into whatever
 * element it keeps for the purpose. The same bargain js/lib/clinical-rail.js
 * strikes for the record on the right: one patient's identity is one thing,
 * drawn one way, wherever a note is being written about them.
 *
 * WHAT IS ON IT, AND IN WHAT ORDER
 * Two registers, and the card is laid out to say which is which.
 *
 * The top is IDENTITY — the photograph, the name and the allergy count on one
 * line, and every identifier on the line under it: MRN, date of birth, age,
 * sex. It is read at a glance by somebody checking they have the right patient
 * in front of them, which is why it is one block with no rules through it.
 *
 * The MRN sits with the date of birth rather than beside the name, and that is
 * a decision about WIDTH. These rails are between 250 and 340 pixels wide, and
 * the heading column inside them is 60 less again; a name, a number and a pill
 * on one line fits "Andi Lane" and wraps "Margaret Whitfield", so the card
 * changed shape depending on who was in it. Name and pill always fit, every
 * identifier is meta at the same size, and the block is two lines tall for
 * every patient in the practice.
 *
 * The bottom is the three facts somebody LEAVES THE NOTE TO GO AND FIND: ring
 * the escort, check the plan before a corrected claim, name the provider on a
 * call. Labelled, one per row, because they are looked up one at a time rather
 * than read top to bottom.
 *
 * THE NAME IS A LINK, AND IT IS BLUE
 * It was deliberately not, on one of the four screens, on the argument that
 * blue promises a navigation the card could not honour. The card can honour
 * it: the patient chart is a screen in this product and takes an MRN in its
 * query string. The summary already linked it; the rest now do too, so the
 * blue means what blue means everywhere else in the product.
 */
import { coverageFor, providerById } from '../../data/schedule.js';
import { PATIENTS } from '../../data/patient-chart.js';
import { CLINICAL_SECTIONS } from '../../data/encounter.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const initials = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

const SEX_WORDS = { M: 'Male', F: 'Female' };

/**
 * Draw the card into `host`.
 *
 * Only two things are asked of the caller: WHERE to draw, and WHO. Everything
 * else the card needs it fetches itself — the photograph from the chart, the
 * plan from the coverage record, the allergy list from the clinical sections.
 * That is the whole point of the component: a screen cannot hand it a payer,
 * so no screen can hand it the wrong one.
 *
 *   host      the element to render into
 *   patient   a directory row (see data/directory.js)
 *   provider  who owns this patient — the booking's provider where there is a
 *             booking. Passed in rather than derived because which provider
 *             that is is a fact about the ENCOUNTER, which is the one thing
 *             here the card cannot know on its own.
 *   testid    prefix for the card's data-testid attributes — `<prefix>-name`,
 *             `<prefix>-allergies`, `<prefix>-facts` — so each screen keeps the
 *             ids its own tests already reach for
 */
export function paintPatientCard({ host, patient, provider = '', appointment = null, testid = 'pcard' }) {
  if (!host || !patient) return;

  const chart = PATIENTS[patient.mrn];
  const coverage = coverageFor(patient.mrn);
  const allergies = CLINICAL_SECTIONS.find((section) => section.id === 'allergies')?.items ?? [];
  const providerName =
    provider || providerById(appointment?.providerId)?.name || '—';

  /* The photograph where the chart has one, the patient's initials in the same
     disc where it has not. One footprint for both, so a column of these does
     not go ragged down its left edge depending on who has been photographed. */
  const avatar = chart?.photo
    ? `<img class="pcard__avatar pcard__avatar--photo" src="${esc(chart.photo)}"
         alt="" width="40" height="40" />`
    : `<span class="pcard__avatar" aria-hidden="true">${esc(initials(patient.name))}</span>`;

  const sex = SEX_WORDS[patient.sex] ?? patient.sex ?? '';

  /* Three labels of one word each. They were Mobile Number, Payer and Primary
     Provider for a while, which is how they read on a form; on a card in a
     rail the extra words buy nothing and cost the value column the room it
     needs to hold "Blue Cross Blue Shield ND — PPO" on one line. */
  const facts = [
    ['Mobile', esc(patient.phone)],
    ['Insurance', esc(coverage?.insurance ?? '—')],
    ['Provider', esc(providerName)],
  ];

  /* The card's own class on the host the screen gave it. It carries nothing
     visual — the screen still owns the border and the padding — only the
     container the rules below query, because what decides whether this card
     can afford a label column beside its values is the width of THE CARD, and
     nothing in the markup below is in a position to ask. */
  host.classList.add('pcard');

  host.innerHTML = `
    <div class="pcard__top">
      ${avatar}
      <div class="pcard__line">
        <a class="pcard__name" data-testid="${esc(testid)}-name"
          href="patient-chart.html?mrn=${encodeURIComponent(patient.mrn)}"
          title="${esc(patient.name)}">${esc(patient.name)}</a>
        ${
          /* The one warning on the card, and the only reason it is a pill
             rather than a fourth row below. Everything else here is looked up
             when somebody goes looking; this has to be met WITHOUT looking, by
             a person about to give a drug. The count answers "how bad is this"
             before it is opened and the substances are in the title for
             whoever hovers; the list with its reactions is in the clinical
             rail, because a pill is a flag, not a record. */
          allergies.length
            ? `<ui-badge status="critical" title="${esc(
                allergies.map((entry) => entry.text).join(', ')
              )}" data-testid="${esc(testid)}-allergies">${
                allergies.length
              } allergies</ui-badge>`
            : ''
        }
      </div>
    </div>

    <!--
      "WHO IS THIS", IN ONE LINE AND TWO GROUPS.

      The identifiers first, the demographics after them, with a wider space
      between the two than inside either — so the line reads as two things
      rather than four, and a reader looking for the MRN is not scanning past
      an age to find it.

      Each group holds together whatever happens: an MRN parted from its label
      or a date of birth parted from its age is a fact somebody misreads. If
      the card is ever too narrow for both, the break falls between the groups,
      which is where a reader would have put it.
    -->
    <div class="pcard__idline">
      <span class="pcard__id">MRN ${esc(patient.mrn)} · DOB ${esc(patient.dob)}</span>
      <span class="pcard__id">${[
        patient.age != null ? `${esc(patient.age)} yrs` : '',
        sex,
      ]
        .filter(Boolean)
        .join(' · ')}</span>
    </div>

    <dl class="pcard__facts" data-testid="${esc(testid)}-facts">
      ${facts
        .map(
          ([term, value]) =>
            `<div class="pcard__fact"><dt>${esc(term)}</dt><dd>${value}</dd></div>`
        )
        .join('')}
    </dl>`;
}
