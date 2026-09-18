/**
 * THE PATIENT'S PAST APPOINTMENTS, AS SOMETHING YOU CAN READ AND PULL FROM.
 *
 * WHAT THIS IS
 * The list behind the Encounter tab of the clinical rail — every appointment
 * this patient has already had, newest first — and, for any one of them, what
 * was recorded against it: the note if somebody wrote one, and the booking's
 * own facts if nobody did. Either way it comes back as sections that can be
 * imported into whatever is being charted today.
 *
 * WHY IT IS DERIVED AND NOT STORED
 * Same reason data/visit-notes.js derives its worklist: a visit note is not a
 * record of its own in this prototype, it belongs to the appointment it
 * documents. Keeping a hand-written history per patient would mean a second
 * list that drifts out of step with the bookings — a "previous encounter" the
 * scheduler has never heard of, naming a provider the appointment does not.
 *
 * So the list comes from the one copy of the bookings
 * (data/appointment-store.js), the rule for which of them is a visit at all is
 * data/visit-notes.js's `hasVisitNote`, the note's TYPE is its `noteTypeFor`,
 * and the note's BODY is data/encounter-summary.js's `summarySections` — the
 * very same function the read-only Encounter Summary screen renders from. Open
 * an old visit from the rail and open it from Scheduler → Encounters and you
 * are reading one note, not two accounts of it.
 *
 * WHAT THIS MODULE ADDS ON TOP OF THOSE
 * One thing: flattening a summary section — which is a heading over a mix of
 * labelled lines and paragraphs — into the block of plain text that an import
 * actually pastes. A clinician importing "Objective" wants the words, not the
 * row objects the summary screen lays out.
 *
 * All names, findings and dates are invented. No real patient information.
 */
import { loadAppointments } from './appointment-store.js';
import {
  providerById,
  typeById,
  procedureById,
  referrerById,
  staffById,
} from './schedule.js';
import { hasVisitNote, noteTypeFor } from './visit-notes.js';
import { summarySections, DEFAULT_REASON } from './encounter-summary.js';

/** The activity that means an infusion — same id the scheduler keys off. */
const INFUSION_TYPE = 'at12';

/**
 * What kind of visit a booking is.
 *
 * The same three-line rule the scheduler, the encounter summary and the chart's
 * Appointments tab each apply, so a visit is the same kind wherever it is read.
 * It is repeated here rather than imported from one of those because they are
 * SCREEN modules and a data module importing a screen would invert the
 * dependency the whole `data/` directory is built on.
 */
export function encounterKind(appt) {
  if (!appt) return 'clinical';
  if (appt.kind) return appt.kind;
  if (appt.procedureId) return 'procedure';
  if (appt.typeId === INFUSION_TYPE) return 'infusion';
  return 'clinical';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * '2025-12-16' → 'Tue, 16 Dec 2025'.
 *
 * Parsed by hand and built as a LOCAL date, because `new Date('2025-12-16')` is
 * UTC midnight — which is the previous day, and so the previous weekday, in
 * every western timezone. A list of past visits that names the wrong day of the
 * week is a list a clinician stops trusting.
 *
 * The weekday earns its place here in a way it does not on the summary screen:
 * this is a list somebody scans for the visit they remember, and "the Friday
 * one" is how that visit is remembered.
 */
export function encounterDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${DAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

function displayTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

/** What the booking was for, in the words the practice uses for it. */
const typeLabel = (appt) =>
  appt.procedureId
    ? procedureById(appt.procedureId)?.title ?? 'Procedure'
    : typeById(appt.typeId)?.title ?? 'Visit';

const providerLabel = (appt) => {
  const provider = providerById(appt.providerId)?.name;
  return provider ? `${provider}, MD` : 'MediNova Gastroenterology';
};

/**
 * One earlier visit, as the rail's list row needs it.
 *
 * `id` is the appointment's, deliberately: the row opens the note that belongs
 * to that booking, and nothing here needs an identity of its own.
 */
function toEncounter(appt) {
  const kind = encounterKind(appt);
  return {
    id: appt.id,
    iso: appt.date,
    date: encounterDate(appt.date),
    time: displayTime(appt.start),
    /* The unformatted start, kept only so two bookings on one day can be put in
       order. '9:00 AM' sorts before '8:30 AM' as a string; '09:00' does not. */
    rawStart: appt.start ?? '',
    kind,
    noteType: noteTypeFor(kind, typeLabel(appt)),
    apptType: typeLabel(appt),
    provider: providerLabel(appt),
    reason: appt.reason?.trim() || DEFAULT_REASON,
  };
}

/**
 * THE PATIENT'S PAST APPOINTMENTS — all of them, newest first.
 *
 * PAST, because the tab is called Encounter and an encounter is something that
 * happened. A follow-up in three weeks is a fact about the diary, not about
 * this patient's history, and a panel that led with eight of them buried the
 * one thing a clinician opens it for: what we did last time.
 *
 * ALL OF THEM, and not only the ones that were written up. The list used to be
 * the notes, and on a patient whose last two visits nobody charted it was
 * shorter than their history — which is the worst way for a history panel to be
 * wrong, because a gap looks like an absence of events rather than an absence
 * of notes. A cancelled appointment is why there is nothing that week. A
 * no-show is why the surveillance is overdue. They belong in the record of what
 * happened, and each row carries `hasNote` so the panel can say which of them
 * has something written behind it.
 *
 * `before`  the visit being charted right now, as an ISO date. Anything on or
 *           after it is not history: a booking later today has not happened,
 *           and offering to import from it would let a clinician paste a note
 *           nobody has written.
 * `exclude` the appointment being charted, kept off its own history.
 */
export function pastAppointments(mrn, { before, exclude } = {}) {
  if (!mrn) return [];
  const cutoff = before || '9999-12-31';

  return loadAppointments()
    .filter((appt) => String(appt.mrn) === String(mrn))
    .filter((appt) => appt.id !== exclude)
    .filter((appt) => appt.date < cutoff)
    .map((appt) => ({
      ...toEncounter(appt),
      status: appt.status ?? '',
      /* `hasVisitNote` is data/visit-notes.js's rule, not a second one — the
         Encounters worklist and this rail agree on what counts as a visit, or a
         note would be openable in one place and missing from the other. */
      hasNote: hasVisitNote(appt, cutoff),
    }))
    .sort((a, b) =>
      a.iso === b.iso ? b.rawStart.localeCompare(a.rawStart) : b.iso.localeCompare(a.iso)
    );
}

/**
 * Rows, flattened to the text an import pastes.
 *
 * A SECTION IS CARRIED TWO WAYS AND THIS IS THE SECOND ONE. `rows` is the
 * structure — a run of labelled facts and paragraphs — and it is what gets
 * DRAWN, because "Medical History" is a label and "Gallstones, asymptomatic" is
 * the answer, and a panel that renders them as one grey sentence has thrown
 * away the shape of the thing it is showing. `text` is the same content as a
 * block of plain prose, and it is what gets IMPORTED, because a note field
 * takes characters and not a data structure.
 *
 * A labelled row keeps its label in the flattened form — "Vitals: BP 128/78 ·
 * HR 74" is the useful unit, and a clinician pasting it into a note wants to
 * know what the numbers were. Rows are joined with newlines rather than spaces
 * so a section of six facts arrives as six lines.
 */
const rowsText = (rows) =>
  rows
    .map((row) => (row.label ? `${row.label}: ${row.value}` : row.text))
    .filter(Boolean)
    .join('\n');

/**
 * A heading, as an id the note can be matched against.
 *
 * 'History Of Present Illness (HPI)' → 'history-of-present-illness-hpi'. The
 * ids matter because the importing screen looks for a section of its own with
 * the same name before it falls back to a lookup table — see
 * js/screens/clinic-visit.js. A heading that happens to match is a mapping
 * nobody has to maintain.
 */
const slug = (heading) =>
  String(heading)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * A BOOKING THAT HAS NO NOTE, AS THE SAME KIND OF READABLE, IMPORTABLE THING.
 *
 * The Encounter tab opens every row, not only the ones that were written up.
 * Pressing an appointment still to come, or one that was cancelled, used to do
 * nothing — but the booking itself holds facts a clinician charting today wants
 * and currently retypes: why the patient is coming, who they are seeing, where,
 * on what, and what the desk wrote on it. So a booking opens into its own
 * record, in the same cards, with the same Import.
 *
 * REASON FIRST, because it is the section that gets imported: the words the
 * desk took down when the appointment was made are the words the note's
 * presenting complaint wants, and copying them by eye out of a header is how
 * they end up subtly different from what the patient actually said.
 *
 * A section with nothing in it is dropped rather than printed empty — a booking
 * with no room, no kit and no referrer should not show three headings under
 * three dashes.
 *
 * THE IDS ARE PREFIXED `appt-` ON PURPOSE. The importing screen matches a
 * section against a section of its own by id before it consults its lookup
 * table (see js/screens/clinic-visit.js), and unprefixed these would collide:
 * a booking's "Referral" is who sent the patient, while a GI Consultation's
 * `referral` section is the question the referrer is asking. Same word, two
 * different things, and the automatic match would have filed the referrer's
 * name in the box asking what they wanted decided.
 */
export function appointmentSections(id) {
  const appt = loadAppointments().find((a) => a.id === id);
  if (!appt) return [];

  const encounter = toEncounter(appt);

  /* `[label, value]` pairs in, rows out, the empty ones dropped — so a section
     can be written as the list of everything it MIGHT say and a booking with no
     room and no kit simply produces fewer rows. */
  const facts = (pairs) =>
    pairs.filter(([, value]) => value).map(([label, value]) => ({ label, value }));

  const names = (ids, resolve) =>
    (ids ?? [])
      .map((each) => resolve(each)?.name)
      .filter(Boolean)
      .join(', ');

  return [
    /* The reason is a paragraph, not a labelled fact. It is the one section
       here made of the patient's own words rather than of the booking's
       fields, and a "Reason for visit:" label under a heading that already
       says Reason for visit is the label twice. */
    {
      id: 'appt-reason',
      label: 'Reason for visit',
      rows: appt.reason?.trim() ? [{ text: appt.reason.trim() }] : [],
    },
    /* NOT the date, the time, the provider or the status. All four are in the
       header three lines above this card — the date is the heading, the time
       and the provider are the line under it, and the status is the badge
       beside it — and an Import carries the date in its own provenance line
       anyway. A card that restates the header is a card the eye reads twice to
       find the two facts the header did not already give it. */
    {
      id: 'appt-appointment',
      label: 'Appointment',
      rows: facts([
        ['Activity', encounter.apptType],
        ['Location', appt.location],
      ]),
    },
    {
      id: 'appt-resources',
      label: 'Room and resources',
      rows: facts([
        ['Room', appt.area],
        ['Equipment', (appt.equipment ?? []).join(', ')],
        ['Staff', names(appt.staff, staffById)],
      ]),
    },
    {
      id: 'appt-referral',
      label: 'Referral',
      rows: facts([['Referred by', names(appt.referrers, referrerById)]]),
    },
    {
      id: 'appt-notes',
      label: 'Booking notes',
      rows: appt.notes?.trim() ? [{ text: appt.notes.trim() }] : [],
    },
  ]
    .filter((section) => section.rows.length)
    .map((section) => ({ ...section, text: rowsText(section.rows) }));
}

/**
 * The note written at one earlier encounter, section by section.
 *
 * Each section is `{ id, label, rows, text }` — a heading, the structured facts
 * and paragraphs under it, and those same facts flattened for an import. See
 * the note over `rowsText` for why a section is carried both ways.
 *
 * THE SUMMARY'S SUBHEADINGS ARE DROPPED. A SOAP note's Subjective section
 * carries "History Of Present Illness (HPI)" under its title on the full-page
 * summary, where there is room for it and a reader is being oriented in a
 * document. In a 21rem rail it is a second line of heading on a card whose
 * title has already said what the section is, and four of them down the panel
 * push the text they introduce off the fold. The heading alone is the heading.
 *
 * Returns [] for an id that is not a booking, so a stale link paints an empty
 * detail view rather than throwing inside a repaint.
 */
export function priorEncounterNote(id) {
  const appt = loadAppointments().find((a) => a.id === id);
  if (!appt) return [];

  const encounter = toEncounter(appt);

  return summarySections(encounter.kind, {
    reason: encounter.reason,
    provider: encounter.provider,
    apptType: encounter.apptType,
    /* The patient, so the sections that restate the chart can read it. Without
       this the note falls back to the booking's own facts alone — see the note
       over the section builders in data/encounter-summary.js. */
    mrn: String(appt.mrn ?? ''),
  })
    .map((section) => ({
      id: slug(section.heading),
      label: section.heading,
      rows: section.rows,
      text: rowsText(section.rows),
    }))
    .filter((section) => section.text);
}
