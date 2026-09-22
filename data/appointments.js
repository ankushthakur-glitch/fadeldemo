/**
 * DEMO DATA — appointment settings.
 * Names, dates and codes are invented. No real records.
 *
 * NOTE ON COLOURS
 * The hex values below are DATA, not design tokens. A clinic administrator
 * picks them at runtime, so they cannot live in tokens.css — that file holds
 * decisions the design system makes, and these are decisions the customer
 * makes. They are rendered through a generated <style> block rather than
 * inline style attributes, so the no-inline-styles rule still holds.
 */
import { ACTIVE_PRACTICE_ID, USERS } from './practice.js';

/* --- Availability: one row per provider ---------------------------------- */

export const PROVIDER_AVAILABILITY = [
  { id: 'av1', name: 'Olivia Rhye', slots: 2, blockDays: 2, updated: '15-03-2025', updatedBy: 'Ava Davis' },
  { id: 'av2', name: 'Phoenix Baker', slots: 1, blockDays: 4, updated: '03-11-2025', updatedBy: 'Charlotte Harris' },
  { id: 'av3', name: 'Lana Steiner', slots: 2, blockDays: 8, updated: '09-10-2025', updatedBy: 'Aiden White' },
  { id: 'av4', name: 'Demi Wilkinson', slots: 2, blockDays: 4, updated: '22-01-2026', updatedBy: 'Mia Jackson' },
  { id: 'av5', name: 'Candice Wu', slots: 2, blockDays: 8, updated: '14-09-2025', updatedBy: 'Lucas Thomas' },
  { id: 'av6', name: 'Natali Craig', slots: 1, blockDays: 9, updated: '16-02-2026', updatedBy: 'Liam Johnson' },
  { id: 'av7', name: 'Drew Cano', slots: 1, blockDays: 4, updated: '28-12-2025', updatedBy: 'Sophia Wilson' },
  { id: 'av8', name: 'Orlando Diggs', slots: 2, blockDays: 4, updated: '10-04-2025', updatedBy: 'Elijah Miller' },
  { id: 'av9', name: 'Andi Lane', slots: 1, blockDays: 0, updated: '01-06-2025', updatedBy: 'Emma Smith' },
  { id: 'av10', name: 'Kate Morrison', slots: 1, blockDays: 11, updated: '20-08-2025', updatedBy: 'Isabella Anderson' },
  { id: 'av11', name: 'Michael Johnson', slots: 2, blockDays: 10, updated: '05-05-2025', updatedBy: 'Olivia Rhye' },
  { id: 'av12', name: 'Emily Chen', slots: 1, blockDays: 7, updated: '18-02-2025', updatedBy: 'Mason Taylor' },
  { id: 'av13', name: 'David Smith', slots: 2, blockDays: 3, updated: '24-01-2025', updatedBy: 'James Martin' },
  { id: 'av14', name: 'Aisha Patel', slots: 2, blockDays: 7, updated: '25-07-2025', updatedBy: 'Noah Brown' },
  { id: 'av15', name: 'Marcus Adeyemi', slots: 1, blockDays: 5, updated: '11-06-2025', updatedBy: 'Ava Davis' },
  ...availabilityFromDirectory(),
];

/**
 * Every other provider in the practice, with an availability row of their own.
 *
 * The fifteen above are the diaries the prototype's own screens book into, so
 * they stay written out: a name here has to match the calendar column it
 * opens. The rest of the practice is not invented a second time — it is read
 * out of the provider directory in data/practice.js, which is where "who works
 * here" is already answered. Inventing forty more names beside it would have
 * given Settings a staff list the Users tab has never heard of, and the first
 * person to search one of them would find nothing.
 *
 * Deterministic throughout — the slot and block-day counts and the audit stamp
 * are functions of the row's position, not of Math.random() — so a screenshot
 * taken today looks the same next month.
 */
function availabilityFromDirectory() {
  const seen = new Set([
    'Olivia Rhye', 'Phoenix Baker', 'Lana Steiner', 'Demi Wilkinson', 'Candice Wu',
    'Natali Craig', 'Drew Cano', 'Orlando Diggs', 'Andi Lane', 'Kate Morrison',
    'Michael Johnson', 'Emily Chen', 'David Smith', 'Aisha Patel', 'Marcus Adeyemi',
  ]);

  const stamps = [
    ['04-02-2026', 'Amara Mensah'], ['22-01-2026', 'Ruth Adeyemi'], ['09-01-2026', 'Lucas Thomas'],
    ['18-12-2025', 'Sana Nakamura'], ['30-11-2025', 'Mia Jackson'], ['12-11-2025', 'Sam Okoro'],
    ['27-10-2025', 'Amara Mensah'], ['06-10-2025', 'Sophia Wilson'], ['15-09-2025', 'Liam Johnson'],
    ['02-09-2025', 'Elijah Miller'],
  ];

  return USERS.filter((user) => user.type === 'Provider' && !seen.has(user.name))
    .slice(0, 41)
    .map((user, index) => {
      const [updated, updatedBy] = stamps[index % stamps.length];
      return {
        id: `av${16 + index}`,
        name: user.name,
        slots: (index % 3) + 1,
        // A provider with nothing blocked is ordinary — a new starter, or
        // someone who takes leave a year at a time rather than a day at a time.
        blockDays: index % 7 === 0 ? 0 : (index * 3) % 13,
        updated,
        updatedBy,
      };
    });
}

/* --- One provider's day slots and block days ------------------------------ */

export const WEEK_DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

export const LOCATIONS = [
  'GastroEMR Gastroenterology — Fargo',
  'GastroEMR Gastroenterology — West Fargo',
  'Red River ASC',
  'Prairie Infusion Centre',
];

/**
 * A day slot is a date range plus the weekly pattern that applies inside it.
 * Each day can carry several time blocks — a morning clinic and an afternoon
 * list, for example — and each block has its own location.
 *
 * `blocks` is optional and defaults to the pair the first two seeded periods
 * were written with, so the two rows the screen has always opened on look
 * exactly as they did. The rolling history below passes its own.
 */
function weekPattern(activeDays, blocks) {
  const dayBlocks = blocks ?? [
    { start: '11:00', end: '13:00', location: LOCATIONS[0] },
    { start: '14:00', end: '20:00', location: '' },
  ];
  return WEEK_DAYS.map((day) => ({
    day,
    enabled: activeDays.includes(day),
    blocks: activeDays.includes(day)
      ? dayBlocks.map((block) => ({ ...block }))
      : [{ start: '', end: '', location: '' }],
  }));
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * The working patterns a period can be set to, cycled through by
 * rollingDaySlots() below.
 *
 * Five patterns rather than one repeated: a diary that reads the same in every
 * period is a diary nobody has actually maintained, and the point of keeping
 * the history is being able to see when the pattern CHANGED. Clinic weeks,
 * procedure weeks, a four-day week, an outreach week and a half week of leave
 * cover the shapes a GI consultant's fortnight actually takes.
 */
const SLOT_PATTERNS = [
  {
    days: WEEKDAYS,
    blocks: [
      { start: '08:00', end: '12:00', location: LOCATIONS[0] },
      { start: '13:00', end: '17:00', location: LOCATIONS[0] },
    ],
  },
  {
    days: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    blocks: [
      { start: '07:00', end: '12:30', location: LOCATIONS[2] },
      { start: '13:30', end: '16:00', location: LOCATIONS[0] },
    ],
  },
  {
    days: ['Tuesday', 'Wednesday', 'Thursday'],
    blocks: [{ start: '09:00', end: '15:00', location: LOCATIONS[1] }],
  },
  {
    days: ['Monday', 'Wednesday', 'Friday'],
    blocks: [
      { start: '08:30', end: '12:00', location: LOCATIONS[3] },
      { start: '13:00', end: '18:00', location: LOCATIONS[0] },
    ],
  },
  {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    blocks: [{ start: '11:00', end: '19:00', location: LOCATIONS[0] }],
  },
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Two years of half-month periods, newest first.
 *
 * A provider's availability is not one record that gets edited — it is a
 * SERIES, one period per pattern, and the old ones stay so that "what was I
 * booked to do last March" has an answer. Two seeded rows made that look like
 * a screen with two settings on it; fifty make it look like the register it
 * is, and give the list something to scroll, sort and page through.
 *
 * Deterministic — dates are computed from the calendar, the pattern from the
 * row's position — so a screenshot taken today looks the same next month.
 */
function rollingDaySlots() {
  const slots = [];
  let index = 0;

  for (let year = 2027; year >= 2025; year -= 1) {
    // The diary is set ahead, not indefinitely: 2027 is seeded only to the end
    // of the first quarter, which is as far as a real one is ever filled in.
    const lastMonth = year === 2027 ? 3 : 12;
    for (let month = lastMonth; month >= 1; month -= 1) {
      const mm = String(month).padStart(2, '0');
      const last = DAYS_IN_MONTH[month - 1];
      // Second half first: the list runs newest to oldest, the way the
      // availability screen orders it.
      for (const [from, to] of [[16, last], [1, 15]]) {
        const pattern = SLOT_PATTERNS[index % SLOT_PATTERNS.length];
        slots.push({
          id: `ds${index + 3}`,
          from: `${year}-${mm}-${String(from).padStart(2, '0')}`,
          to: `${year}-${mm}-${String(to).padStart(2, '0')}`,
          expanded: false,
          repeat: 'Every week',
          days: weekPattern(pattern.days, pattern.blocks),
        });
        index += 1;
      }
    }
  }

  return slots;
}

/**
 * How often a day slot's weekly pattern actually runs.
 *
 * Almost every pattern runs every week, which is why that is the default and
 * why the field was not here at all until somebody asked for the other case:
 * the staff who work alternate Mondays, and the ones who have every other
 * Monday off, which is the same arrangement described from the other end. A
 * practice keeps a handful of those and no more, so this is a two-answer
 * question rather than a recurrence rule with an interval box, a count and an
 * until-date — none of which anybody here has asked to be able to write.
 *
 * The alternation is counted from the slot's own From date, Monday to Monday
 * — see slotRunsOn() in data/schedule.js — so which week is the "on" one is
 * decided by when the arrangement started rather than by a week number nobody
 * could check against a calendar.
 *
 * Putting the alternating day in a slot of its own is what makes this work
 * without a second layer of structure: Tuesday to Friday stays weekly in one
 * slot, and the Monday that only comes round every second week is a slot
 * beside it carrying the other answer. That is why the screen asks the
 * question once per slot and not once per day.
 */
export const SLOT_REPEATS = ['Every week', 'Every other week'];

export const DAY_SLOTS = [
  { id: 'ds1', from: '2025-11-03', to: '2025-11-05', expanded: true, repeat: 'Every week', days: weekPattern(WEEKDAYS) },
  // One of each on the seeded list, so the control opens showing a value it
  // actually takes rather than a field the demo data never exercises.
  { id: 'ds2', from: '2025-10-08', to: '2025-12-12', expanded: false, repeat: 'Every other week', days: weekPattern(WEEKDAYS) },
  ...rollingDaySlots(),
];

export { weekPattern };

/* --- Block days ---------------------------------------------------------------
   A day, or part of one, the diary is closed for: leave, cover elsewhere, CME,
   the meetings a consultant cannot book around. Written out rather than
   generated because the REASON is the whole content of the row — a generated
   list of "Blocked day 27" would fill the table without telling anyone
   anything.

   Spread across two and a half years on purpose. data/schedule.js folds this
   list into one provider's calendar, so a year's worth of blocks all landing
   in 2026 would have read as a provider who is out of the office one day a
   week, and drawn the scheduler mostly grey.
   -------------------------------------------------------------------------- */

export const BLOCK_DAYS = [
  { id: 'bd1', title: 'Out of City — Medical Conference', start: '2026-01-05', end: '2026-01-05', startTime: '00:00', endTime: '20:00' },
  { id: 'bd2', title: 'Board or Committee Meeting', start: '2026-02-10', end: '2026-02-10', startTime: '00:00', endTime: '20:00' },
  { id: 'bd3', title: 'Training / CME Program', start: '2026-02-25', end: '2026-02-25', startTime: '00:00', endTime: '20:00' },
  { id: 'bd4', title: 'Annual Leave', start: '2025-09-08', end: '2025-09-12', startTime: '00:00', endTime: '23:59' },
  { id: 'bd5', title: 'ACG Annual Scientific Meeting', start: '2025-10-24', end: '2025-10-28', startTime: '00:00', endTime: '23:59' },
  { id: 'bd6', title: 'Quality and Safety Committee', start: '2025-11-06', end: '2025-11-06', startTime: '13:00', endTime: '17:00' },
  { id: 'bd7', title: 'Infection Control Audit — ASC', start: '2025-11-19', end: '2025-11-19', startTime: '08:00', endTime: '12:00' },
  { id: 'bd8', title: 'Thanksgiving — Clinic Closed', start: '2025-11-27', end: '2025-11-28', startTime: '00:00', endTime: '23:59' },
  { id: 'bd9', title: 'Peer Review Session', start: '2025-12-04', end: '2025-12-04', startTime: '15:00', endTime: '18:00' },
  { id: 'bd10', title: 'Winter Holiday — Clinic Closed', start: '2025-12-24', end: '2025-12-26', startTime: '00:00', endTime: '23:59' },
  { id: 'bd11', title: 'Year End Coding Review', start: '2025-12-30', end: '2025-12-30', startTime: '09:00', endTime: '12:00' },
  { id: 'bd12', title: 'New Year — Clinic Closed', start: '2026-01-01', end: '2026-01-01', startTime: '00:00', endTime: '23:59' },
  { id: 'bd13', title: 'Endoscopy Unit Deep Clean', start: '2026-01-12', end: '2026-01-13', startTime: '00:00', endTime: '23:59' },
  { id: 'bd14', title: 'IBD Multidisciplinary Meeting', start: '2026-01-20', end: '2026-01-20', startTime: '12:00', endTime: '14:00' },
  { id: 'bd15', title: 'Annual Leave', start: '2026-01-26', end: '2026-01-30', startTime: '00:00', endTime: '23:59' },
  { id: 'bd16', title: 'Credentialling Interviews', start: '2026-02-03', end: '2026-02-03', startTime: '09:00', endTime: '13:00' },
  { id: 'bd17', title: 'Hepatology Outreach — Moorhead', start: '2026-02-17', end: '2026-02-17', startTime: '00:00', endTime: '20:00' },
  { id: 'bd18', title: 'Scope Reprocessing Training', start: '2026-03-03', end: '2026-03-03', startTime: '08:00', endTime: '11:00' },
  { id: 'bd19', title: 'Out of City — Medical Conference', start: '2026-03-11', end: '2026-03-13', startTime: '00:00', endTime: '23:59' },
  { id: 'bd20', title: 'Practice Away Day', start: '2026-03-20', end: '2026-03-20', startTime: '00:00', endTime: '23:59' },
  { id: 'bd21', title: 'Annual Leave', start: '2026-03-30', end: '2026-04-03', startTime: '00:00', endTime: '23:59' },
  { id: 'bd22', title: 'Board or Committee Meeting', start: '2026-04-14', end: '2026-04-14', startTime: '13:00', endTime: '17:00' },
  { id: 'bd23', title: 'Digestive Disease Week — Travel', start: '2026-04-22', end: '2026-04-22', startTime: '00:00', endTime: '23:59' },
  { id: 'bd24', title: 'Digestive Disease Week', start: '2026-04-23', end: '2026-04-26', startTime: '00:00', endTime: '23:59' },
  { id: 'bd25', title: 'Research Protocol Review', start: '2026-05-05', end: '2026-05-05', startTime: '15:00', endTime: '18:00' },
  { id: 'bd26', title: 'Fellow Teaching Clinic', start: '2026-05-13', end: '2026-05-13', startTime: '08:00', endTime: '12:00' },
  { id: 'bd27', title: 'Memorial Day — Clinic Closed', start: '2026-05-25', end: '2026-05-25', startTime: '00:00', endTime: '23:59' },
  { id: 'bd28', title: 'Annual Leave', start: '2026-06-08', end: '2026-06-19', startTime: '00:00', endTime: '23:59' },
  { id: 'bd29', title: 'Quality and Safety Committee', start: '2026-06-24', end: '2026-06-24', startTime: '13:00', endTime: '17:00' },
  { id: 'bd30', title: 'Independence Day — Clinic Closed', start: '2026-07-03', end: '2026-07-03', startTime: '00:00', endTime: '23:59' },
  { id: 'bd31', title: 'EHR Upgrade — Read Only', start: '2026-07-11', end: '2026-07-12', startTime: '00:00', endTime: '23:59' },
  { id: 'bd32', title: 'Training / CME Program', start: '2026-07-21', end: '2026-07-22', startTime: '09:00', endTime: '16:00' },
  { id: 'bd33', title: 'Motility Clinic Cover — Grand Forks', start: '2026-07-29', end: '2026-07-29', startTime: '00:00', endTime: '20:00' },
  { id: 'bd34', title: 'Annual Leave', start: '2026-08-10', end: '2026-08-14', startTime: '00:00', endTime: '23:59' },
  { id: 'bd35', title: 'Board or Committee Meeting', start: '2026-08-25', end: '2026-08-25', startTime: '13:00', endTime: '17:00' },
  { id: 'bd36', title: 'Labor Day — Clinic Closed', start: '2026-09-07', end: '2026-09-07', startTime: '00:00', endTime: '23:59' },
  { id: 'bd37', title: 'Endoscopy Equipment Servicing', start: '2026-09-15', end: '2026-09-16', startTime: '00:00', endTime: '23:59' },
  { id: 'bd38', title: 'IBD Multidisciplinary Meeting', start: '2026-09-22', end: '2026-09-22', startTime: '12:00', endTime: '14:00' },
  { id: 'bd39', title: 'ACG Annual Scientific Meeting', start: '2026-10-23', end: '2026-10-27', startTime: '00:00', endTime: '23:59' },
  { id: 'bd40', title: 'Peer Review Session', start: '2026-11-05', end: '2026-11-05', startTime: '15:00', endTime: '18:00' },
  { id: 'bd41', title: 'Infection Control Audit — ASC', start: '2026-11-18', end: '2026-11-18', startTime: '08:00', endTime: '12:00' },
  { id: 'bd42', title: 'Thanksgiving — Clinic Closed', start: '2026-11-26', end: '2026-11-27', startTime: '00:00', endTime: '23:59' },
  { id: 'bd43', title: 'Annual Leave', start: '2026-12-07', end: '2026-12-11', startTime: '00:00', endTime: '23:59' },
  { id: 'bd44', title: 'Winter Holiday — Clinic Closed', start: '2026-12-24', end: '2026-12-28', startTime: '00:00', endTime: '23:59' },
  { id: 'bd45', title: 'Year End Coding Review', start: '2026-12-30', end: '2026-12-30', startTime: '09:00', endTime: '12:00' },
  { id: 'bd46', title: 'New Year — Clinic Closed', start: '2027-01-01', end: '2027-01-01', startTime: '00:00', endTime: '23:59' },
  { id: 'bd47', title: 'Strategic Planning Retreat', start: '2027-01-14', end: '2027-01-15', startTime: '00:00', endTime: '23:59' },
  { id: 'bd48', title: 'Credentialling Interviews', start: '2027-01-26', end: '2027-01-26', startTime: '09:00', endTime: '13:00' },
  { id: 'bd49', title: 'Hepatology Outreach — Moorhead', start: '2027-02-09', end: '2027-02-09', startTime: '00:00', endTime: '20:00' },
  { id: 'bd50', title: 'Training / CME Program', start: '2027-02-23', end: '2027-02-24', startTime: '09:00', endTime: '16:00' },
  { id: 'bd51', title: 'Annual Leave', start: '2027-03-15', end: '2027-03-19', startTime: '00:00', endTime: '23:59' },
  { id: 'bd52', title: 'Quality and Safety Committee', start: '2027-03-24', end: '2027-03-24', startTime: '13:00', endTime: '17:00' },
];

/* --- Appointment types ----------------------------------------------------- */

/**
 * An appointment type is a colour, a name, how long it takes, and what the
 * patient has to fill in first.
 *
 * NO DESCRIPTION, AND NO PROCEDURE CODE.
 * The description was marketing copy nobody reads on a settings screen, and
 * the billing code does not belong here: what gets billed is decided by what
 * was actually done, on the encounter — pinning a CPT to the appointment type
 * would mean a booking that pre-decides the claim.
 *
 * TWO DURATIONS: THE TYPE'S, AND ANY PROVIDER WHO DIFFERS.
 * `duration` is what the visit takes in the ordinary case, and it is what
 * every booking starts from. `providerDurations` is the exception list: a new
 * patient seen by a nurse practitioner genuinely runs forty-five minutes where
 * the same visit with a consultant runs thirty, and a practice that cannot say
 * so ends up either over-running every clinic or padding the default for
 * everybody. Naming a provider here overrides the default for that provider
 * alone; everyone left off the list keeps `duration`.
 *
 * It is deliberately a short list and not a matrix. Most types have none, and
 * the ones that do have one or two — the point is to record the handful of
 * genuine exceptions, not to make the practice fill in a grid of every type
 * against every clinician.
 *
 * PROFILES
 * `profiles` names the practice entities that offer the type — see
 * PRACTICE_PROFILES in data/practice.js. The clinic and the ASC do not offer
 * the same list: nobody books an annual wellness visit into an endoscopy
 * suite, and a procedure list cannot be scheduled into a consulting room. A
 * type available at both (infusion, records requests) simply names both.
 */
export const APPOINTMENT_TYPES = [
  {
    id: 'at1',
    title: 'In-person New Patient',
    color: '#a99cf5',
    duration: 30,
    unit: 'Minute',
    profiles: ['clinic'],
    providerDurations: [
      { provider: 'Aisha Patel', duration: 45 },
      { provider: 'David Smith', duration: 30 },
    ],
    forms: ['Patient Intake Form', 'Pain Assessment Form', 'Depression/Anxiety Screening (PHQ-9 / GAD-7)'],
  },
  { id: 'at2', title: 'In-person New Follow', color: '#7ec8a9', duration: 20, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at3', title: 'Virtual New Patient', color: '#6fd3f7', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at4', title: 'Virtual Follow Patient', color: '#8ab6f0', duration: 15, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at5', title: 'Annual Wellness Visit', color: '#f5d33d', duration: 45, unit: 'Minute', profiles: ['clinic'], forms: [] },
  {
    id: 'at6',
    title: 'Procedure Visit',
    color: '#f8776b',
    duration: 60,
    unit: 'Minute',
    profiles: ['asc'],
   
    forms: [],
  },
  { id: 'at7', title: 'Therapy', color: '#e07ce8', duration: 50, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at8', title: 'Consultation', color: '#4a6fb5', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at9', title: 'Wellness Check', color: '#5fb98f', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at10', title: 'Laboratory Work / Blood Draw', color: '#c0a36e', duration: 15, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at11', title: 'Wound Care Session', color: '#d98f6a', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at12', title: 'Infusion Therapy', color: '#009999', duration: 120, unit: 'Minute', profiles: ['clinic', 'asc'], forms: [] },
  { id: 'at13', title: 'Post-Operative Follow-Up', color: '#8a7cf0', duration: 20, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at14', title: 'Medical Records Request', color: '#8e8e8e', duration: 10, unit: 'Minute', profiles: ['clinic', 'asc'], forms: [] },
  { id: 'at15', title: 'Minor Surgical Procedure', color: '#b5544e', duration: 45, unit: 'Minute', profiles: ['asc'], forms: [] },
  { id: 'at16', title: 'Screening Colonoscopy', color: '#3f7f52', duration: 60, unit: 'Minute', profiles: ['asc'], providerDurations: [{ provider: 'Marcus Adeyemi', duration: 75 }], forms: ['Consent to Treat', 'Bowel Preparation Instructions'] },
  { id: 'at17', title: 'Surveillance Colonoscopy', color: '#4f8f62', duration: 60, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat', 'Bowel Preparation Instructions'] },
  { id: 'at18', title: 'Diagnostic Colonoscopy', color: '#5f9f72', duration: 60, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at19', title: 'Colonoscopy with Polypectomy', color: '#2f6f42', duration: 75, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at20', title: 'Upper Endoscopy (EGD)', color: '#c96a3c', duration: 45, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at21', title: 'EGD with Dilation', color: '#b95a2c', duration: 60, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at22', title: 'EGD with Variceal Banding', color: '#a94a1c', duration: 75, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at23', title: 'Combined EGD and Colonoscopy', color: '#8c4a2c', duration: 90, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat', 'Bowel Preparation Instructions'] },
  { id: 'at24', title: 'Flexible Sigmoidoscopy', color: '#7aa05f', duration: 30, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at25', title: 'ERCP', color: '#7a3b8f', duration: 120, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat', 'Anesthesia Questionnaire'] },
  { id: 'at26', title: 'Endoscopic Ultrasound (EUS)', color: '#6a2b7f', duration: 90, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat', 'Anesthesia Questionnaire'] },
  { id: 'at27', title: 'PEG Tube Placement', color: '#5a1b6f', duration: 60, unit: 'Minute', profiles: ['asc'], forms: ['Consent to Treat'] },
  { id: 'at28', title: 'Capsule Endoscopy Fitting', color: '#4a6fb5', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: ['Consent to Treat'] },
  { id: 'at29', title: 'Capsule Endoscopy Return', color: '#5a7fc5', duration: 15, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at30', title: 'Esophageal Manometry', color: '#2f7d8f', duration: 60, unit: 'Minute', profiles: ['clinic'], forms: ['Consent to Treat'] },
  { id: 'at31', title: 'Anorectal Manometry', color: '#1f6d7f', duration: 60, unit: 'Minute', profiles: ['clinic'], forms: ['Consent to Treat'] },
  { id: 'at32', title: 'pH / Impedance Study — Placement', color: '#0f5d6f', duration: 45, unit: 'Minute', profiles: ['clinic'], forms: ['Consent to Treat'] },
  { id: 'at33', title: 'pH / Impedance Study — Removal', color: '#0f7d8f', duration: 20, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at34', title: 'Hydrogen Breath Test', color: '#9fae4a', duration: 180, unit: 'Minute', profiles: ['clinic'], forms: ['Pre-Test Dietary Instructions'] },
  { id: 'at35', title: 'IBD Clinic — New Patient', color: '#a3557f', duration: 45, unit: 'Minute', profiles: ['clinic'], providerDurations: [{ provider: 'Emily Chen', duration: 60 }], forms: ['Patient Intake Form', 'IBD Symptom Diary'] },
  { id: 'at36', title: 'IBD Clinic — Follow-Up', color: '#b3658f', duration: 25, unit: 'Minute', profiles: ['clinic'], forms: ['IBD Symptom Diary'] },
  { id: 'at37', title: 'Hepatology — New Patient', color: '#8f6b3a', duration: 45, unit: 'Minute', profiles: ['clinic'], forms: ['Patient Intake Form', 'Alcohol Use Screening (AUDIT-C)'] },
  { id: 'at38', title: 'Hepatology — Follow-Up', color: '#9f7b4a', duration: 25, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at39', title: 'Fibroscan', color: '#af8b5a', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at40', title: 'Motility Clinic', color: '#3f8f9f', duration: 40, unit: 'Minute', profiles: ['clinic'], forms: ['Pain Assessment Form'] },
  { id: 'at41', title: 'Nutrition Consultation', color: '#6fae5f', duration: 45, unit: 'Minute', profiles: ['clinic'], forms: ['Nutrition Intake Questionnaire'] },
  { id: 'at42', title: 'Dietitian Follow-Up', color: '#7fbe6f', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at43', title: 'Behavioral Health Session', color: '#c07ce8', duration: 50, unit: 'Minute', profiles: ['clinic'], forms: ['Depression/Anxiety Screening (PHQ-9 / GAD-7)'] },
  { id: 'at44', title: 'Pre-Procedure Assessment', color: '#e0a04a', duration: 30, unit: 'Minute', profiles: ['clinic', 'asc'], forms: ['Anesthesia Questionnaire', 'Consent to Treat'] },
  { id: 'at45', title: 'Anesthesia Pre-Assessment', color: '#f0b05a', duration: 20, unit: 'Minute', profiles: ['asc'], forms: ['Anesthesia Questionnaire'] },
  { id: 'at46', title: 'Post-Procedure Telephone Review', color: '#8ab6f0', duration: 10, unit: 'Minute', profiles: ['clinic', 'asc'], forms: [] },
  { id: 'at47', title: 'Infusion — Loading Dose', color: '#00a3a3', duration: 180, unit: 'Minute', profiles: ['clinic'], forms: ['Infusion Consent', 'Financial Responsibility'] },
  { id: 'at48', title: 'Infusion — Maintenance', color: '#00b3b3', duration: 120, unit: 'Minute', profiles: ['clinic'], forms: ['Infusion Consent'] },
  { id: 'at49', title: 'Iron Infusion', color: '#00c3c3', duration: 90, unit: 'Minute', profiles: ['clinic'], forms: ['Infusion Consent'] },
  { id: 'at50', title: 'Injection Teaching Visit', color: '#5fd1c1', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at51', title: 'Telehealth — New Patient', color: '#6fd3f7', duration: 30, unit: 'Minute', profiles: ['clinic'], forms: ['Patient Intake Form', 'Telehealth Consent'] },
  { id: 'at52', title: 'Telehealth — Results Review', color: '#7fe3ff', duration: 15, unit: 'Minute', profiles: ['clinic'], forms: ['Telehealth Consent'] },
  { id: 'at53', title: 'Nurse Visit — Results Review', color: '#a0b8d0', duration: 15, unit: 'Minute', profiles: ['clinic'], forms: [] },
  { id: 'at54', title: 'Nurse Visit — Medication Review', color: '#90a8c0', duration: 20, unit: 'Minute', profiles: ['clinic'], forms: ['Medication Reconciliation'] },
  { id: 'at55', title: 'Second Opinion Consultation', color: '#5a6fb5', duration: 45, unit: 'Minute', profiles: ['clinic'], forms: ['Medical Records Release'] },
  { id: 'at56', title: 'Genetic Counseling — Lynch Syndrome', color: '#8f5ab5', duration: 60, unit: 'Minute', profiles: ['clinic'], forms: ['Family History Questionnaire'] },
  { id: 'at57', title: 'Research Study Visit', color: '#7e8e8e', duration: 60, unit: 'Minute', profiles: ['clinic'], forms: ['Research Participation Consent'] },
  { id: 'at58', title: 'Wound Check — Post ASC', color: '#d98f6a', duration: 15, unit: 'Minute', profiles: ['asc'], forms: [] },
];

/**
 * The types one practice profile offers.
 *
 * Booking dropdowns use this; anything that RENDERS an existing appointment
 * must keep using APPOINTMENT_TYPES in full. A case booked last month under
 * the other entity still has to draw with its own colour and name — filtering
 * the render as well as the picker is how a booked appointment goes blank
 * the day someone flips the switch.
 *
 * @param {string} profileId
 */
export function appointmentTypesFor(profileId) {
  return APPOINTMENT_TYPES.filter((type) => type.profiles.includes(profileId));
}

/**
 * The types the profile you are currently working as offers — what every
 * booking picker should show. Read at call time, so a switch in Practice
 * Settings is reflected on the next paint without anything subscribing.
 */
export function activeAppointmentTypes() {
  return appointmentTypesFor(ACTIVE_PRACTICE_ID);
}

/**
 * The types a wait-list request may name.
 *
 * A wait list is a queue for clinic time — a room, a chair, a slot in a
 * session — and joining it is how a patient says "sooner, if anything opens
 * up". A scope list is not that. Procedure work is put off and brought forward
 * by its Status and by the list it sits on, with a prep instruction, an
 * anaesthetist and a suite behind it; nobody fills a cancelled 10:15
 * colonoscopy by ringing the next name on a queue. That is why the procedure
 * field set in the booking form has no "Add to wait list" checkbox, and this
 * is the same rule said once more where the wait-list drawer asks for an
 * activity: anything the ASC alone books is not on offer.
 *
 * Read as "the clinic offers it", not as "the ASC does not", so a type both
 * entities run — infusion, a pre-procedure assessment — stays waitlistable,
 * which is right: those genuinely do queue for a chair or a room.
 */
export function waitlistableAppointmentTypes() {
  return appointmentTypesFor('clinic');
}

export const DURATION_UNITS = ['Minute', 'Hour'];

export const AVAILABLE_FORMS = [
  'Patient Intake Form',
  'Pain Assessment Form',
  'Depression/Anxiety Screening (PHQ-9 / GAD-7)',
  'Medical Records Release',
  'Consent to Treat',
  'Financial Responsibility',
  'Bowel Preparation Instructions',
  'Anesthesia Questionnaire',
  'IBD Symptom Diary',
  'Alcohol Use Screening (AUDIT-C)',
  'Nutrition Intake Questionnaire',
  'Pre-Test Dietary Instructions',
  'Infusion Consent',
  'Telehealth Consent',
  'Medication Reconciliation',
  'Family History Questionnaire',
  'Research Participation Consent',
  'Advance Directive',
  'Release of Information',
  'Insurance Card Upload',
];

/* --- Appointment status colours -------------------------------------------- */

export const STATUS_COLOURS = [
  { id: 'sc1', name: 'Triage', color: '#009999', updated: '17-05-2025', created: '17-05-2025' },
  { id: 'sc2', name: 'Scheduled', color: '#4a6fb5', updated: '28-09-2025', created: '28-09-2025' },
  { id: 'sc3', name: 'Checked In', color: '#e07ce8', updated: '28-08-2025', created: '28-08-2025' },
  { id: 'sc4', name: 'Rescheduled', color: '#8a7cf0', updated: '22-06-2025', created: '22-06-2025' },
  { id: 'sc5', name: 'Cancelled', color: '#f8776b', updated: '28-09-2025', created: '28-09-2025' },
  { id: 'sc6', name: 'Pending Confirmation', color: '#f5d33d', updated: '17-05-2025', created: '17-05-2025' },
  { id: 'sc7', name: 'No Show', color: '#8e8e8e', updated: '08-11-2025', created: '08-11-2025' },
  { id: 'sc8', name: 'Declined', color: '#6fd3f7', updated: '26-08-2025', created: '26-08-2025' },
  { id: 'sc9', name: 'Check Out', color: '#008000', updated: '26-08-2025', created: '26-08-2025' },
  { id: 'sc10', name: 'Confirmed', color: '#00cc00', updated: '26-08-2025', created: '26-08-2025' },
  { id: 'sc11', name: 'Requested', color: '#b0bec5', updated: '14-01-2026', created: '02-06-2025' },
  { id: 'sc12', name: 'Waitlisted', color: '#9e9e9e', updated: '14-01-2026', created: '02-06-2025' },
  { id: 'sc13', name: 'Pending Referral', color: '#c0a36e', updated: '19-01-2026', created: '02-06-2025' },
  { id: 'sc14', name: 'Pending Authorization', color: '#e0a04a', updated: '19-01-2026', created: '02-06-2025' },
  { id: 'sc15', name: 'Authorization Denied', color: '#b5544e', updated: '19-01-2026', created: '02-06-2025' },
  { id: 'sc16', name: 'Pending Insurance Verification', color: '#f0b05a', updated: '23-01-2026', created: '11-06-2025' },
  { id: 'sc17', name: 'Insurance Verified', color: '#7ec8a9', updated: '23-01-2026', created: '11-06-2025' },
  { id: 'sc18', name: 'Eligibility Failed', color: '#f8776b', updated: '23-01-2026', created: '11-06-2025' },
  { id: 'sc19', name: 'Reminder Sent', color: '#8ab6f0', updated: '04-02-2026', created: '11-06-2025' },
  { id: 'sc20', name: 'Reminder Failed', color: '#d98f6a', updated: '04-02-2026', created: '11-06-2025' },
  { id: 'sc21', name: 'Pre-Check Sent', color: '#a99cf5', updated: '12-02-2026', created: '20-06-2025' },
  { id: 'sc22', name: 'Pre-Check Started', color: '#8a7cf0', updated: '12-02-2026', created: '20-06-2025' },
  { id: 'sc23', name: 'Pre-Check Complete', color: '#5fb98f', updated: '12-02-2026', created: '20-06-2025' },
  { id: 'sc24', name: 'Forms Outstanding', color: '#f5d33d', updated: '12-02-2026', created: '20-06-2025' },
  { id: 'sc25', name: 'Consent Signed', color: '#3f7f52', updated: '18-02-2026', created: '20-06-2025' },
  { id: 'sc26', name: 'Arrived', color: '#6fd3f7', updated: '25-02-2026', created: '04-07-2025' },
  { id: 'sc27', name: 'In Waiting Room', color: '#5fc3e7', updated: '25-02-2026', created: '04-07-2025' },
  { id: 'sc28', name: 'Roomed', color: '#4fb3d7', updated: '25-02-2026', created: '04-07-2025' },
  { id: 'sc29', name: 'Vitals Taken', color: '#3fa3c7', updated: '25-02-2026', created: '04-07-2025' },
  { id: 'sc30', name: 'Ready for Provider', color: '#2f93b7', updated: '03-03-2026', created: '04-07-2025' },
  { id: 'sc31', name: 'With Provider', color: '#1f83a7', updated: '03-03-2026', created: '04-07-2025' },
  { id: 'sc32', name: 'Awaiting Sedation', color: '#7a3b8f', updated: '10-03-2026', created: '18-07-2025' },
  { id: 'sc33', name: 'In Procedure', color: '#6a2b7f', updated: '10-03-2026', created: '18-07-2025' },
  { id: 'sc34', name: 'In Recovery', color: '#5a1b6f', updated: '10-03-2026', created: '18-07-2025' },
  { id: 'sc35', name: 'Recovery Complete', color: '#4a0b5f', updated: '10-03-2026', created: '18-07-2025' },
  { id: 'sc36', name: 'Awaiting Discharge', color: '#8f5ab5', updated: '17-03-2026', created: '18-07-2025' },
  { id: 'sc37', name: 'Discharged', color: '#3f8f52', updated: '17-03-2026', created: '18-07-2025' },
  { id: 'sc38', name: 'Awaiting Pathology', color: '#c0a36e', updated: '24-03-2026', created: '01-08-2025' },
  { id: 'sc39', name: 'Pathology Received', color: '#9fae4a', updated: '24-03-2026', created: '01-08-2025' },
  { id: 'sc40', name: 'Results Communicated', color: '#5fb98f', updated: '24-03-2026', created: '01-08-2025' },
  { id: 'sc41', name: 'Note Pending', color: '#f5d33d', updated: '02-04-2026', created: '01-08-2025' },
  { id: 'sc42', name: 'Note Signed', color: '#008000', updated: '02-04-2026', created: '01-08-2025' },
  { id: 'sc43', name: 'Charge Entered', color: '#4a6fb5', updated: '09-04-2026', created: '15-08-2025' },
  { id: 'sc44', name: 'Claim Submitted', color: '#3a5fa5', updated: '09-04-2026', created: '15-08-2025' },
  { id: 'sc45', name: 'Billed', color: '#2a4f95', updated: '09-04-2026', created: '15-08-2025' },
  { id: 'sc46', name: 'Cancelled by Patient', color: '#f8776b', updated: '16-04-2026', created: '15-08-2025' },
  { id: 'sc47', name: 'Cancelled by Practice', color: '#e8675b', updated: '16-04-2026', created: '15-08-2025' },
  { id: 'sc48', name: 'Cancelled — Weather', color: '#d8574b', updated: '16-04-2026', created: '29-08-2025' },
  { id: 'sc49', name: 'Cancelled — Equipment', color: '#c8473b', updated: '16-04-2026', created: '29-08-2025' },
  { id: 'sc50', name: 'Cancelled — Prep Inadequate', color: '#b8372b', updated: '23-04-2026', created: '29-08-2025' },
  { id: 'sc51', name: 'Late Arrival', color: '#e07b39', updated: '23-04-2026', created: '29-08-2025' },
  { id: 'sc52', name: 'Left Without Being Seen', color: '#8e8e8e', updated: '23-04-2026', created: '12-09-2025' },
  { id: 'sc53', name: 'Bumped — Provider Unavailable', color: '#6e655e', updated: '30-04-2026', created: '12-09-2025' },
  { id: 'sc54', name: 'Moved to Waitlist', color: '#a0b8d0', updated: '30-04-2026', created: '12-09-2025' },
  { id: 'sc55', name: 'Rebooked', color: '#8a7cf0', updated: '30-04-2026', created: '12-09-2025' },
  { id: 'sc56', name: 'No Show — Fee Applied', color: '#7e6e6e', updated: '07-05-2026', created: '26-09-2025' },
  { id: 'sc57', name: 'No Show — Fee Waived', color: '#9e9e8e', updated: '07-05-2026', created: '26-09-2025' },
  { id: 'sc58', name: 'Transferred to Hospital', color: '#b3261e', updated: '07-05-2026', created: '26-09-2025' },
  { id: 'sc59', name: 'Complication Recorded', color: '#a3160e', updated: '14-05-2026', created: '26-09-2025' },
  { id: 'sc60', name: 'Closed', color: '#00cc00', updated: '14-05-2026', created: '10-10-2025' },
];

/** The "Basic Colours" grid offered by the picker. */
export const BASIC_COLOURS = [
  '#f28b82', '#fdd663', '#a8e6a3', '#5fd18c', '#7fe3d4', '#8ab4f8', '#f48fb1', '#e69ff5',
  '#f6685e', '#fbc02d', '#cddc39', '#4caf50', '#26a69a', '#42a5f5', '#ec407a', '#e040fb',
  '#8d6e63', '#ff9800', '#8bc34a', '#2e9e6b', '#00897b', '#1e88e5', '#ad1457', '#aa00ff',
  '#6d4c41', '#f57c00', '#689f38', '#1b7a4b', '#00695c', '#1565c0', '#880e4f', '#7b1fa2',
  '#4e342e', '#e65100', '#33691e', '#0f5132', '#004d40', '#0d47a1', '#4a148c', '#6a1b9a',
  '#9e9e9e', '#827717', '#1b5e20', '#003d33', '#002171', '#01579b', '#311b92', '#4527a0',
  '#000000', '#5d4037', '#827717', '#616161', '#00838f', '#b0bec5', '#4a148c', '#ffffff',
];
