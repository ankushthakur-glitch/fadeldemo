/**
 * DEMO DATA — the scheduler.
 * Patients, providers, dates and reasons are invented. No real records.
 *
 * WHY THIS IS SEPARATE FROM appointments.js
 * appointments.js holds what an administrator CONFIGURES in Settings →
 * Appointment: the types, their colours and durations, the status colours and
 * the availability preferences. This file holds what the front desk BOOKS
 * against that configuration.
 *
 * The scheduler reads both, and the join is the point of the screen:
 *   · an appointment's colour and default duration come from its configured
 *     TYPE, so recolouring a type in Settings recolours the calendar;
 *   · the availability shading behind the day and week grids comes from the
 *     provider's configured DAY SLOTS and BLOCK DAYS.
 */
import {
  WEEK_DAYS,
  LOCATIONS,
  APPOINTMENT_TYPES,
  STATUS_COLOURS,
  BLOCK_DAYS,
  activeAppointmentTypes,
  waitlistableAppointmentTypes,
} from './appointments.js';
import { USERS } from './practice.js';

// APPOINTMENT_TYPES is every type that exists — what a booked appointment is
// rendered from. activeAppointmentTypes() is the subset the practice profile
// you are working as offers — what a booking picker is filled from.
// waitlistableAppointmentTypes() is narrower still: the clinic's types, which
// are the only ones a standing request can name, because procedure work is
// deferred on its list rather than by joining a queue.
export {
  WEEK_DAYS,
  LOCATIONS,
  APPOINTMENT_TYPES,
  STATUS_COLOURS,
  activeAppointmentTypes,
  waitlistableAppointmentTypes,
};

/**
 * The prototype's "today".
 *
 * Fixed rather than read from the clock: demo data anchored to a real date
 * drifts out of the visible week within days, and every screenshot of this
 * screen would then show an empty calendar.
 */
export const TODAY = '2026-08-04';

/* --- Providers ------------------------------------------------------------
   Names are taken from the availability list in Settings → Appointment, so a
   provider picked here is the same record whose day slots are edited there.

   TWO FACTS, AND THEY ANSWER DIFFERENT QUESTIONS.
   `credential` is what the person is licensed as; `role` is what they do here.
   A picker needs the credential — it is part of the name a clinician is known
   and billed by, and it is what tells two similarly-named people apart on a
   claim. A calendar column needs the role, because "who covers motility on a
   Thursday" is a rota question, not a licensure one. Both are kept, and each
   is shown where it answers something. Credentials come from CREDENTIALS in
   data/master.js, which is the list Settings maintains.
   -------------------------------------------------------------------------- */

export const PROVIDERS = [
  { id: 'pr1', name: 'Olivia Rhye', credential: 'MD', role: 'Gastroenterology' },
  { id: 'pr2', name: 'Michael Johnson', credential: 'MD', role: 'Hepatology' },
  { id: 'pr3', name: 'Emily Chen', credential: 'DO', role: 'IBD clinic' },
  { id: 'pr4', name: 'David Smith', credential: 'MD', role: 'Endoscopy' },
  { id: 'pr5', name: 'Aisha Patel', credential: 'NP', role: 'Infusion suite' },
  { id: 'pr6', name: 'Kate Morrison', credential: 'PA', role: 'Motility' },
];

/**
 * A provider as a picker shows them — "Olivia Rhye — MD".
 *
 * One function rather than a template literal at each call site: four
 * dropdowns offer this list (booking, the procedure form, the wait list and
 * the appointment drawer), and four copies of the label is four places for the
 * same person to be written up differently in one screen.
 */
export const providerLabel = (provider) =>
  provider?.credential ? `${provider.name} — ${provider.credential}` : provider?.name ?? '';

/* --- The rest of the resources an appointment can hold ---------------------
   The gGastro Appointment form books more than a provider: staff, referring
   physicians, an area (room) and equipment all hang off the same booking.
   -------------------------------------------------------------------------- */

/**
 * Support staff, taken from the practice user list.
 *
 * Prescribing roles are excluded: they are booked in the Providers block of
 * the appointment form, and offering the same person in both would let one
 * clinician be booked twice against the same slot.
 */
const PROVIDER_ROLES = ['Provider', 'Physician-Superuser'];

export const STAFF = USERS.filter((u) => !PROVIDER_ROLES.includes(u.role)).map((u) => ({
  id: u.id,
  name: u.name,
  role: u.role,
}));

export const REFERRING_PHYSICIANS = [
  { id: 'rp1', name: 'Dr. Alan Whitcombe', practice: 'Red River Family Medicine' },
  { id: 'rp2', name: 'Dr. Sofia Marchetti', practice: 'Prairie Internal Medicine' },
  { id: 'rp3', name: 'Dr. Neil Ashworth', practice: 'Fargo Surgical Associates' },
  { id: 'rp4', name: 'Dr. Grace Ibarra', practice: 'Northside Community Health' },
  { id: 'rp5', name: 'Dr. Peter Lindgren', practice: 'Moorhead Family Practice' },
];

/** Areas are rooms inside a location — what the legacy form calls "Area". */
export const AREAS = [
  'Clinic Room 1',
  'Clinic Room 2',
  'Clinic Room 3',
  'Endoscopy Suite A',
  'Endoscopy Suite B',
  'Infusion Bay 1',
  'Infusion Bay 2',
  'Procedure Room',
  'Telehealth (virtual)',
];

/* --- Appointment kinds ------------------------------------------------------
   A booking is one of three things and each asks for different facts, so the
   form branches on this before anything else. Clinical is an office visit;
   Procedure is an endoscopy list entry with an indication and a referrer;
   Infusion is day-unit chair time.
   -------------------------------------------------------------------------- */

export const APPOINTMENT_KINDS = [
  { id: 'clinical', label: 'Clinical', hint: 'Office visit, follow-up or consultation' },
  { id: 'procedure', label: 'Procedure', hint: 'Endoscopy or minor surgical list entry' },
  { id: 'infusion', label: 'Infusion', hint: 'Biologic or iron infusion chair time' },
];

/**
 * The procedures the Procedure form offers.
 *
 * NOT the appointment types in Settings — a type says how long a slot is and
 * what colour it draws; a procedure says what is being done and how it codes.
 */
export const PROCEDURE_TYPES = [
  { id: 'pt1', title: 'Colonoscopy', duration: 45, code: '45378' },
  { id: 'pt2', title: 'EGD', duration: 30, code: '43235' },
  { id: 'pt3', title: 'Sigmoidoscopy', duration: 30, code: '45330' },
  { id: 'pt4', title: 'ERCP', duration: 60, code: '43260' },
  { id: 'pt5', title: 'EUS', duration: 45, code: '43237' },
];

export const procedureById = (id) => PROCEDURE_TYPES.find((p) => p.id === id);

/** Common indications, offered behind the ICD-10 search box. */
export const INDICATIONS = [
  'Z12.11 - Encounter for screening for malignant neoplasm of colon',
  'R11.0 - Nausea',
  'K21.9 - Gastro-oesophageal reflux disease without oesophagitis',
  'K50.90 - Crohn’s disease, unspecified, without complications',
  'K51.90 - Ulcerative colitis, unspecified, without complications',
  'D50.9 - Iron deficiency anaemia, unspecified',
  'R19.7 - Diarrhoea, unspecified',
  'K92.2 - Gastrointestinal haemorrhage, unspecified',
];

export const EQUIPMENT = [
  'Olympus gastroscope',
  'Olympus colonoscope',
  'CO₂ insufflator',
  'High-resolution manometry catheter',
  'Capsule endoscopy recorder',
  'Infusion pump',
  'Portable ultrasound',
];

/* --- Patient billing, recalls and eligibility ------------------------------
   The right-hand rail of the legacy form. Only a handful of patients carry a
   record; everyone else falls back to the self-pay default, which is what the
   front desk sees before insurance is entered.
   -------------------------------------------------------------------------- */

export const DEFAULT_COVERAGE = {
  insurance: 'Self pay — no coverage on file',
  memberId: '—',
  lastCheck: 'Never',
  auth: 'Not required',
  eligibility: 'Unverified',
  copay: 0,
  coinsurance: 0,
  discount: 0,
};

/** What the front desk collects at check-in, per plan. */
const MONEY = {
  326486: { copay: 30, coinsurance: 20, discount: 0 },
  326491: { copay: 25, coinsurance: 0, discount: 5 },
  326490: { copay: 0, coinsurance: 45, discount: 0 },
  326496: { copay: 40, coinsurance: 15, discount: 0 },
  326493: { copay: 0, coinsurance: 0, discount: 0 },
  326507: { copay: 50, coinsurance: 30, discount: 10 },
};

export const COVERAGE = {
  326486: { insurance: 'Blue Cross Blue Shield ND — PPO', memberId: 'ND8841200', lastCheck: '02-08-2026', auth: 'AUTH-4471 · valid to 30-09-2026', eligibility: 'Active' },
  326491: { insurance: 'Sanford Health Plan — HMO', memberId: 'SHP5520712', lastCheck: '31-07-2026', auth: 'Not required', eligibility: 'Active' },
  326490: { insurance: 'Medicare Part B', memberId: '1EG4-TE5-MK73', lastCheck: '28-07-2026', auth: 'AUTH-4390 · infusion, 8 cycles', eligibility: 'Active' },
  326496: { insurance: 'UnitedHealthcare — Choice Plus', memberId: 'UHC77410233', lastCheck: '15-07-2026', auth: 'Pending — submitted 29-07-2026', eligibility: 'Active' },
  326493: { insurance: 'Medicaid ND', memberId: 'ND-MA-338217', lastCheck: '03-08-2026', auth: 'AUTH-4468 · valid to 31-12-2026', eligibility: 'Active' },
  326507: { insurance: 'Aetna — Open Access', memberId: 'AET9920145', lastCheck: '19-06-2026', auth: 'Not required', eligibility: 'Term date 30-06-2026' },
};

export const coverageFor = (mrn) => ({
  ...DEFAULT_COVERAGE,
  ...(COVERAGE[mrn] ?? {}),
  ...(MONEY[mrn] ?? {}),
});

/** Surveillance and follow-up recalls that are due for a patient. */
export const RECALLS = {
  326490: [{ due: '12-2026', reason: 'Colonoscopy surveillance — 3 year' }],
  326491: [{ due: '09-2026', reason: 'Coeliac serology and bone density' }],
  326493: [{ due: '10-2026', reason: 'IBD annual review' }],
  326486: [{ due: '08-2026', reason: 'Annual wellness visit' }],
  326496: [
    { due: '11-2026', reason: 'Post-resection colonoscopy' },
    { due: '02-2027', reason: 'Iron studies' },
  ],
};

export const recallsFor = (mrn) => RECALLS[mrn] ?? [];

export const ELIGIBILITY_HISTORY = {
  326486: [
    { checked: '02-08-2026', payer: 'Blue Cross Blue Shield ND', result: 'Active coverage', by: 'Automated' },
    { checked: '04-05-2026', payer: 'Blue Cross Blue Shield ND', result: 'Active coverage', by: 'Ava Davis' },
  ],
  326490: [
    { checked: '28-07-2026', payer: 'Medicare Part B', result: 'Active coverage', by: 'Automated' },
  ],
  326507: [
    { checked: '19-06-2026', payer: 'Aetna', result: 'Coverage terminated 30-06-2026', by: 'Automated' },
  ],
};

export const eligibilityFor = (mrn) => ELIGIBILITY_HISTORY[mrn] ?? [];

/* --- Availability ----------------------------------------------------------
   Same shape as DAY_SLOTS in appointments.js — a date range plus the weekly
   pattern that applies inside it, each day carrying one or more time blocks
   with their own location. Written per provider here because the settings
   screen edits one provider at a time and the calendar has to draw all of them.
   -------------------------------------------------------------------------- */

/** `{ Monday: [{ start, end, location }] }` → the full seven-day pattern. */
function pattern(spec) {
  return WEEK_DAYS.map((day) => ({
    day,
    enabled: Boolean(spec[day]?.length),
    blocks: spec[day] ?? [],
  }));
}

const block = (start, end, location) => ({ start, end, location });

const CLINIC_YEAR = { from: '2026-01-01', to: '2026-12-31' };

export const PROVIDER_SCHEDULES = {
  pr1: {
    daySlots: [
      {
        id: 'pr1-ds1',
        ...CLINIC_YEAR,
        days: pattern({
          Monday: [block('08:00', '12:00', LOCATIONS[0]), block('13:00', '17:00', LOCATIONS[0])],
          Tuesday: [block('08:00', '12:00', LOCATIONS[0]), block('13:00', '17:00', LOCATIONS[0])],
          Wednesday: [block('08:00', '12:00', LOCATIONS[0]), block('13:00', '17:00', LOCATIONS[0])],
          Thursday: [block('08:00', '12:00', LOCATIONS[0]), block('13:00', '17:00', LOCATIONS[0])],
          Friday: [block('08:00', '12:00', LOCATIONS[0])],
        }),
      },
    ],
    // The three block days configured on the availability screen, plus one
    // inside the demo week so the calendar has something to draw.
    blockDays: [
      ...BLOCK_DAYS,
      { id: 'pr1-bd4', title: 'Departmental audit', start: '2026-08-06', end: '2026-08-06', startTime: '13:00', endTime: '17:00' },
    ],
  },

  /*
   * The every-other-Monday case, written as two slots rather than one.
   *
   * This clinician works Tuesday to Thursday every week and alternate
   * Mondays — the arrangement a practice describes as "he has every other
   * Monday off". The weekly days stay in the weekly slot; the Monday is a
   * slot of its own marked "Every other week" and counted from its own From
   * date. Monday 03 August 2026, the week the demo calendar opens on, is an
   * on week; the Monday after it is off, and the scheduler offers no slot
   * there.
   */
  pr2: {
    daySlots: [
      {
        id: 'pr2-ds1',
        ...CLINIC_YEAR,
        repeat: 'Every week',
        days: pattern({
          Tuesday: [block('09:00', '13:00', LOCATIONS[1])],
          Wednesday: [block('14:00', '18:00', LOCATIONS[1])],
          Thursday: [block('09:00', '13:00', LOCATIONS[1])],
        }),
      },
      {
        // From a Monday, and from THE Monday the arrangement started on: the
        // alternation is counted off this date, so it is the one field that
        // decides which Mondays are worked. 05 January 2026 makes Monday
        // 03 August 2026 — the week the demo calendar opens on, and the week
        // this clinician already has three patients booked in — an on week,
        // and the Monday after it an off one.
        id: 'pr2-ds2',
        from: '2026-01-05',
        to: '2026-12-31',
        repeat: 'Every other week',
        days: pattern({
          Monday: [block('09:00', '13:00', LOCATIONS[1])],
        }),
      },
    ],
    blockDays: [],
  },

  pr3: {
    daySlots: [
      {
        id: 'pr3-ds1',
        ...CLINIC_YEAR,
        days: pattern({
          Monday: [block('08:30', '12:30', LOCATIONS[0])],
          Tuesday: [block('08:30', '12:30', LOCATIONS[0])],
          Wednesday: [block('08:30', '12:30', LOCATIONS[0])],
          Thursday: [block('08:30', '12:30', LOCATIONS[0])],
          Friday: [block('08:30', '16:00', LOCATIONS[2])],
        }),
      },
    ],
    blockDays: [
      { id: 'pr3-bd1', title: 'Training / CME Program', start: '2026-08-05', end: '2026-08-05', startTime: '00:00', endTime: '20:00' },
    ],
  },

  pr4: {
    daySlots: [
      {
        id: 'pr4-ds1',
        ...CLINIC_YEAR,
        days: pattern({
          Tuesday: [block('07:30', '15:30', LOCATIONS[2])],
          Wednesday: [block('07:30', '15:30', LOCATIONS[2])],
          Friday: [block('07:30', '15:30', LOCATIONS[2])],
        }),
      },
    ],
    blockDays: [
      { id: 'pr4-bd1', title: 'Annual leave', start: '2026-08-12', end: '2026-08-13', startTime: '00:00', endTime: '20:00' },
    ],
  },

  pr5: {
    daySlots: [
      {
        id: 'pr5-ds1',
        ...CLINIC_YEAR,
        days: pattern({
          Monday: [block('10:00', '16:00', LOCATIONS[3])],
          Wednesday: [block('10:00', '16:00', LOCATIONS[3])],
          Friday: [block('10:00', '16:00', LOCATIONS[3])],
        }),
      },
    ],
    blockDays: [],
  },

  pr6: {
    daySlots: [
      {
        id: 'pr6-ds1',
        ...CLINIC_YEAR,
        days: pattern({
          Tuesday: [block('09:00', '17:00', LOCATIONS[0])],
          Thursday: [block('09:00', '17:00', LOCATIONS[0])],
          Saturday: [block('09:00', '12:00', LOCATIONS[0])],
        }),
      },
    ],
    blockDays: [],
  },
};

/* --- Booked appointments ---------------------------------------------------
   A tuple table rather than 70 object literals: the columns are fixed and the
   rows read like the list the front desk actually works from.

   Columns: date, start, patient MRN, provider, type, location index, status,
            reason for visit
   Duration is NOT stored — it comes from the configured appointment type, so
   changing a type's duration in Settings restretches every block on the
   calendar, which is what an administrator would expect.
   -------------------------------------------------------------------------- */

const ROWS = [
  /* --- Monday 03 August 2026 --- */
  ['2026-08-03', '08:00', '326491', 'pr1', 'at1', 0, 'Confirmed', 'Coeliac — first assessment'],
  ['2026-08-03', '08:30', '326492', 'pr1', 'at2', 0, 'Confirmed', 'GORD, poor PPI response'],
  ['2026-08-03', '09:00', '326494', 'pr1', 'at8', 0, 'Scheduled', 'IBS — dietitian referral discussion'],
  ['2026-08-03', '13:00', '326496', 'pr1', 'at13', 0, 'Confirmed', 'Post-op review, ileocaecal resection'],
  ['2026-08-03', '14:00', '326505', 'pr1', 'at1', 0, 'Pending Confirmation', 'Iron deficiency anaemia'],
  ['2026-08-03', '09:00', '326502', 'pr2', 'at3', 1, 'Confirmed', 'Fatty liver — results review'],
  ['2026-08-03', '09:30', '326507', 'pr2', 'at4', 1, 'No Show', 'Hepatology follow-up'],
  ['2026-08-03', '11:00', '326486', 'pr2', 'at5', 1, 'Scheduled', 'Annual wellness visit'],
  ['2026-08-03', '08:30', '326493', 'pr3', 'at8', 0, 'Confirmed', 'Ulcerative colitis — flare review'],
  ['2026-08-03', '09:30', '326503', 'pr3', 'at2', 0, 'Rescheduled', "Crohn's — biologic response"],
  ['2026-08-03', '11:00', '326509', 'pr3', 'at10', 0, 'Confirmed', 'Pre-infusion bloods'],
  ['2026-08-03', '10:00', '326490', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab infusion, cycle 6'],
  ['2026-08-03', '13:00', '326499', 'pr5', 'at12', 3, 'Scheduled', 'Vedolizumab infusion, cycle 2'],

  /* --- Tuesday 04 August 2026 — the demo "today" --- */
  ['2026-08-04', '08:00', '326497', 'pr1', 'at1', 0, 'Confirmed', 'Coeliac serology positive'],
  ['2026-08-04', '08:30', '326498', 'pr1', 'at2', 0, 'Confirmed', 'Colitis — symptom review'],
  ['2026-08-04', '09:00', '326501', 'pr1', 'at2', 0, 'Confirmed', 'Coeliac follow-up'],
  ['2026-08-04', '09:30', '326506', 'pr1', 'at9', 0, 'Scheduled', 'Wellness check'],
  ['2026-08-04', '11:00', '326482', 'pr1', 'at8', 0, 'Cancelled', 'Second opinion — chronic nausea'],
  ['2026-08-04', '13:00', '326476', 'pr1', 'at1', 0, 'Confirmed', 'Referral — altered bowel habit'],
  ['2026-08-04', '13:30', '326484', 'pr1', 'at13', 0, 'Scheduled', 'Post-op review, polypectomy'],
  ['2026-08-04', '15:00', '245638', 'pr1', 'at2', 0, 'Pending Confirmation', 'Anaemia — repeat bloods'],
  ['2026-08-04', '09:00', '326473', 'pr2', 'at3', 1, 'Confirmed', 'Hyperlipidemia and LFTs'],
  ['2026-08-04', '10:00', '326474', 'pr2', 'at4', 1, 'Declined', 'Virtual follow-up'],
  ['2026-08-04', '11:30', '326477', 'pr2', 'at8', 1, 'Scheduled', 'Abnormal liver screen'],
  ['2026-08-04', '08:30', '326503', 'pr3', 'at1', 0, 'Confirmed', "Crohn's — new to service"],
  ['2026-08-04', '09:30', '326494', 'pr3', 'at2', 0, 'Confirmed', 'IBS — symptom diary review'],
  ['2026-08-04', '10:30', '326505', 'pr3', 'at14', 0, 'Triage', 'Records request for insurer'],
  ['2026-08-04', '07:30', '326490', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-04', '09:00', '326491', 'pr4', 'at6', 2, 'Confirmed', 'K21.9 - Gastro-oesophageal reflux disease without oesophagitis'],
  ['2026-08-04', '10:30', '326496', 'pr4', 'at15', 2, 'Scheduled', 'K92.2 - Gastrointestinal haemorrhage, unspecified'],
  ['2026-08-04', '13:00', '326507', 'pr4', 'at6', 2, 'Pending Confirmation', 'K92.2 - Gastrointestinal haemorrhage, unspecified'],
  ['2026-08-04', '09:00', '326486', 'pr6', 'at8', 0, 'Confirmed', 'Dysphagia — motility workup'],
  ['2026-08-04', '10:00', '326499', 'pr6', 'at7', 0, 'Scheduled', 'Gut-directed hypnotherapy'],
  ['2026-08-04', '13:00', '326502', 'pr6', 'at11', 0, 'Confirmed', 'Stoma site wound care'],
  ['2026-08-04', '15:00', '326509', 'pr6', 'at2', 0, 'Scheduled', 'Reflux — post-manometry review'],

  /* --- Wednesday 05 August 2026 — Emily Chen is on a CME block day --- */
  ['2026-08-05', '08:00', '326493', 'pr1', 'at1', 0, 'Confirmed', 'Colitis — transfer of care'],
  ['2026-08-05', '10:00', '326498', 'pr1', 'at5', 0, 'Scheduled', 'Annual wellness visit'],
  ['2026-08-05', '14:00', '326506', 'pr1', 'at8', 0, 'Confirmed', "Crohn's — treatment options"],
  ['2026-08-05', '14:00', '326497', 'pr2', 'at3', 1, 'Confirmed', 'Raised ferritin — virtual'],
  ['2026-08-05', '15:00', '326501', 'pr2', 'at4', 1, 'Scheduled', 'LFT recheck'],
  ['2026-08-05', '07:30', '326503', 'pr4', 'at6', 2, 'Confirmed', 'K50.90 - Crohn’s disease, unspecified, without complications'],
  ['2026-08-05', '09:00', '326476', 'pr4', 'at6', 2, 'Confirmed', 'K21.9 - Gastro-oesophageal reflux disease without oesophagitis'],
  ['2026-08-05', '10:00', '326494', 'pr5', 'at12', 3, 'Confirmed', 'Iron infusion'],
  ['2026-08-05', '13:00', '326484', 'pr5', 'at10', 3, 'Scheduled', 'Pre-infusion bloods'],

  /* --- Thursday 06 August 2026 — Olivia Rhye is blocked 13:00–17:00 --- */
  ['2026-08-06', '08:00', '326507', 'pr1', 'at1', 0, 'Confirmed', 'Reflux — new referral'],
  ['2026-08-06', '09:00', '326502', 'pr1', 'at2', 0, 'Confirmed', 'Diabetes and gastroparesis'],
  ['2026-08-06', '10:00', '326490', 'pr1', 'at8', 0, 'Scheduled', "Crohn's — surgical opinion"],
  ['2026-08-06', '09:00', '326505', 'pr2', 'at3', 1, 'Confirmed', 'Anaemia — hepatology input'],
  ['2026-08-06', '10:30', '326482', 'pr2', 'at4', 1, 'Scheduled', 'Virtual follow-up'],
  ['2026-08-06', '08:30', '326486', 'pr3', 'at1', 0, 'Confirmed', 'Diarrhoea — new patient'],
  ['2026-08-06', '10:00', '326473', 'pr3', 'at2', 0, 'Scheduled', 'IBD annual review'],
  ['2026-08-06', '09:00', '326474', 'pr6', 'at7', 0, 'Confirmed', 'Gut-directed therapy, session 3'],
  ['2026-08-06', '11:00', '326477', 'pr6', 'at8', 0, 'Rescheduled', 'Chronic constipation'],
  ['2026-08-06', '14:00', '245638', 'pr6', 'at9', 0, 'Scheduled', 'Wellness check'],

  /* --- Friday 07 August 2026 --- */
  ['2026-08-07', '08:00', '326499', 'pr1', 'at5', 0, 'Confirmed', 'Annual wellness visit'],
  ['2026-08-07', '09:00', '326509', 'pr1', 'at2', 0, 'Scheduled', 'Coeliac — dietitian outcome'],
  ['2026-08-07', '09:00', '326496', 'pr3', 'at6', 2, 'Confirmed', 'K51.90 - Ulcerative colitis, unspecified, without complications'],
  ['2026-08-07', '11:00', '326492', 'pr3', 'at15', 2, 'Scheduled', 'K21.9 - Gastro-oesophageal reflux disease without oesophagitis'],
  ['2026-08-07', '07:30', '326493', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-07', '10:00', '326506', 'pr4', 'at6', 2, 'Confirmed', 'D50.9 - Iron deficiency anaemia, unspecified'],
  ['2026-08-07', '10:00', '326491', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab infusion, cycle 7'],
  ['2026-08-07', '14:00', '326498', 'pr5', 'at11', 3, 'Scheduled', 'Line site review'],

  /* --- The following week, so the week and month views have somewhere to go --- */
  ['2026-08-10', '09:00', '326503', 'pr1', 'at1', 0, 'Scheduled', 'New referral — weight loss'],
  ['2026-08-10', '10:00', '326490', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab infusion, cycle 7'],
  ['2026-08-11', '07:30', '326476', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-11', '09:00', '326497', 'pr6', 'at8', 0, 'Scheduled', 'Reflux — manometry planning'],
  ['2026-08-12', '13:00', '326501', 'pr1', 'at2', 0, 'Scheduled', 'Coeliac annual review'],
  ['2026-08-13', '09:00', '326484', 'pr2', 'at3', 1, 'Pending Confirmation', 'Virtual liver clinic'],
  ['2026-08-14', '09:00', '326494', 'pr3', 'at6', 2, 'Scheduled', 'R19.7 - Diarrhoea, unspecified'],
  ['2026-08-18', '10:00', '326486', 'pr1', 'at5', 0, 'Scheduled', 'Annual wellness visit'],
  ['2026-08-20', '09:00', '326499', 'pr6', 'at7', 0, 'Scheduled', 'Gut-directed therapy, session 4'],
  ['2026-08-25', '07:30', '326507', 'pr4', 'at6', 2, 'Scheduled', 'K92.2 - Gastrointestinal haemorrhage, unspecified'],
  ['2026-08-27', '08:00', '326482', 'pr1', 'at1', 0, 'Pending Confirmation', 'New referral — bloating'],

  /* --- End of July, so paging back a month is not empty --- */
  ['2026-07-30', '09:00', '326502', 'pr1', 'at2', 0, 'Confirmed', 'Follow-up — gastroparesis'],
  ['2026-07-31', '08:30', '326505', 'pr3', 'at8', 0, 'Confirmed', 'Anaemia — IBD screen'],

  /* ==========================================================================
     A CLINIC THAT LOOKS LIKE A CLINIC

     The rows above were written to exercise the screens — one of each status,
     one of each care type, a block day to draw. What they were not is a WEEK:
     the afternoons were nearly empty, Saturday had nothing on it at all, and
     paging forward found two bookings and a lot of white. A schedule with
     four appointments on it does not test a schedule.

     These fill it in. Every one sits inside its provider's configured hours
     (see AVAILABILITY above) and at their configured location, so the grid
     still reads as a day somebody could actually work:

       pr1  Mon–Thu 08:00–12:00 and 13:00–17:00, Fri mornings, Fargo
       pr2  Mon/Tue/Thu mornings, Wednesday AFTERNOONS, West Fargo
       pr3  Mon–Thu mornings at Fargo, all Friday at the ASC
       pr4  Tue/Wed/Fri 07:30–15:30, ASC — the procedure list
       pr5  Mon/Wed/Fri 10:00–16:00, infusion suite
       pr6  Tue/Thu 09:00–17:00 and SATURDAY mornings

     A few deliberately land on a colleague's hour, because a clash is a thing
     that happens and the grid has to show both of them.
     ========================================================================= */

  /* --- Monday 03 August 2026, the rest of the day --- */
  ['2026-08-03', '10:00', '326495', 'pr1', 'at8', 0, 'Confirmed', 'Reflux — 24h pH results'],
  ['2026-08-03', '10:30', '326500', 'pr1', 'at13', 0, 'Confirmed', 'Banding follow-up'],
  ['2026-08-03', '14:30', '326504', 'pr1', 'at2', 0, 'Confirmed', 'Diverticular disease review'],
  ['2026-08-03', '15:00', '326508', 'pr1', 'at9', 0, 'No Show', 'Wellness check'],
  ['2026-08-03', '15:30', '326510', 'pr1', 'at1', 0, 'Confirmed', 'New referral — dysphagia'],
  ['2026-08-03', '16:00', '326474', 'pr1', 'at13', 0, 'Confirmed', 'Post-op review, hernia repair'],
  ['2026-08-03', '10:00', '326479', 'pr2', 'at4', 1, 'Confirmed', 'Cirrhosis surveillance'],
  ['2026-08-03', '11:30', '326481', 'pr2', 'at3', 1, 'Confirmed', 'Raised ferritin — first visit'],
  ['2026-08-03', '12:00', '326475', 'pr2', 'at10', 1, 'Confirmed', 'LFT recheck'],
  ['2026-08-03', '10:00', '326477', 'pr3', 'at2', 0, 'Confirmed', 'IBD — steroid taper'],
  ['2026-08-03', '11:30', '326478', 'pr3', 'at8', 0, 'Confirmed', 'Coeliac — dietitian handover'],
  ['2026-08-03', '13:00', '326480', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab, cycle 3'],

  /* --- Tuesday 04 August 2026, the demo "today" --- */
  ['2026-08-04', '10:30', '326495', 'pr1', 'at10', 0, 'Confirmed', 'Pre-biologic bloods'],
  ['2026-08-04', '14:00', '326479', 'pr1', 'at8', 0, 'Confirmed', 'Chronic constipation — plan review'],
  ['2026-08-04', '14:30', '326500', 'pr1', 'at13', 0, 'Scheduled', 'Post-polypectomy review'],
  ['2026-08-04', '16:00', '326510', 'pr1', 'at2', 0, 'Scheduled', 'Reflux — PPI step-down'],
  ['2026-08-04', '16:30', '326483', 'pr1', 'at14', 0, 'Pending Confirmation', 'Records request — insurer'],
  ['2026-08-04', '11:00', '326478', 'pr2', 'at4', 1, 'Confirmed', 'Hepatitis B surveillance'],
  ['2026-08-04', '12:00', '326485', 'pr2', 'at10', 1, 'Scheduled', 'Fibroscan bloods'],
  ['2026-08-04', '11:00', '326477', 'pr6', 'at7', 0, 'Confirmed', 'Motility — biofeedback session'],
  ['2026-08-04', '14:00', '326481', 'pr6', 'at8', 0, 'Confirmed', 'Rumination syndrome — first visit'],
  ['2026-08-04', '15:00', '326475', 'pr6', 'at2', 0, 'Scheduled', 'Manometry results'],
  ['2026-08-04', '16:00', '326484', 'pr6', 'at4', 0, 'Scheduled', 'Follow-up, virtual'],
  ['2026-08-04', '13:00', '326473', 'pr4', 'at6', 2, 'Confirmed', 'Diagnostic gastroscopy'],
  ['2026-08-04', '14:30', '326490', 'pr4', 'at15', 2, 'Scheduled', 'Haemorrhoid banding'],

  /* --- Wednesday 05 August 2026 — pr2's afternoon list --- */
  ['2026-08-05', '14:00', '326486', 'pr2', 'at3', 1, 'Confirmed', 'NAFLD — first assessment'],
  ['2026-08-05', '14:30', '326473', 'pr2', 'at4', 1, 'Confirmed', 'Autoimmune hepatitis review'],
  ['2026-08-05', '15:00', '326502', 'pr2', 'at8', 1, 'Scheduled', 'Abnormal LFTs — second opinion'],
  ['2026-08-05', '16:00', '326507', 'pr2', 'at2', 1, 'Scheduled', 'Iron studies review'],
  ['2026-08-05', '17:00', '326504', 'pr2', 'at4', 1, 'Pending Confirmation', 'Virtual — results only'],
  ['2026-08-05', '13:30', '326476', 'pr1', 'at1', 0, 'Confirmed', 'Referral — weight loss, anaemia'],
  ['2026-08-05', '15:00', '326494', 'pr1', 'at2', 0, 'Scheduled', 'Coeliac — annual review'],
  ['2026-08-05', '16:00', '326498', 'pr1', 'at9', 0, 'Scheduled', 'Wellness check'],
  ['2026-08-05', '12:30', '326505', 'pr4', 'at6', 2, 'Confirmed', 'Colonoscopy — surveillance'],
  ['2026-08-05', '14:00', '326492', 'pr4', 'at15', 2, 'Scheduled', 'Polypectomy, sigmoid'],
  ['2026-08-05', '13:00', '326496', 'pr5', 'at12', 3, 'Scheduled', 'Vedolizumab, cycle 4'],

  /* --- Thursday 06 August 2026 — pr1's afternoon is a block day --- */
  ['2026-08-06', '09:30', '326500', 'pr1', 'at2', 0, 'Confirmed', 'Barrett surveillance discussion'],
  ['2026-08-06', '10:30', '326508', 'pr1', 'at8', 0, 'Scheduled', 'Bloating — first visit'],
  ['2026-08-06', '11:30', '326483', 'pr1', 'at10', 0, 'Scheduled', 'Pre-procedure bloods'],
  ['2026-08-06', '10:00', '326479', 'pr2', 'at3', 1, 'Confirmed', 'Alcohol-related liver disease'],
  ['2026-08-06', '12:00', '326481', 'pr2', 'at10', 1, 'Scheduled', 'INR and LFTs'],
  ['2026-08-06', '13:00', '326485', 'pr6', 'at7', 0, 'Confirmed', 'Pelvic floor therapy'],
  ['2026-08-06', '15:00', '326474', 'pr6', 'at8', 0, 'Scheduled', 'Slow-transit constipation'],
  ['2026-08-06', '16:00', '326478', 'pr6', 'at2', 0, 'Pending Confirmation', 'Motility follow-up'],
  ['2026-08-06', '11:00', '326495', 'pr3', 'at2', 0, 'Confirmed', 'UC — mesalazine review'],

  /* --- Friday 07 August 2026 — pr3 runs the ASC list all day --- */
  ['2026-08-07', '13:00', '326491', 'pr3', 'at6', 2, 'Confirmed', 'Gastroscopy — iron deficiency'],
  ['2026-08-07', '14:00', '326497', 'pr3', 'at15', 2, 'Scheduled', 'Oesophageal dilatation'],
  ['2026-08-07', '15:00', '326503', 'pr3', 'at13', 2, 'Scheduled', 'Post-procedure review'],
  ['2026-08-07', '09:30', '326506', 'pr1', 'at8', 0, 'Confirmed', 'Chronic diarrhoea — plan'],
  ['2026-08-07', '11:00', '326509', 'pr1', 'at2', 0, 'Scheduled', 'Follow-up, coeliac'],
  ['2026-08-07', '13:00', '326502', 'pr4', 'at6', 2, 'Confirmed', 'Colonoscopy — FIT positive'],
  ['2026-08-07', '11:00', '326499', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab, cycle 7'],
  ['2026-08-07', '14:00', '326490', 'pr5', 'at12', 3, 'Scheduled', 'Iron infusion'],

  /* --- Saturday 08 August 2026 — pr6's weekend clinic --- */
  ['2026-08-08', '09:00', '326484', 'pr6', 'at1', 0, 'Confirmed', 'Saturday clinic — new referral'],
  ['2026-08-08', '09:30', '326486', 'pr6', 'at2', 0, 'Confirmed', 'Follow-up, reflux'],
  ['2026-08-08', '10:00', '326493', 'pr6', 'at8', 0, 'Scheduled', 'Functional dyspepsia'],
  ['2026-08-08', '11:00', '326501', 'pr6', 'at4', 0, 'Scheduled', 'Virtual review'],
  ['2026-08-08', '11:30', '326475', 'pr6', 'at13', 0, 'Pending Confirmation', 'Post-op check'],

  /* --- Monday 10 to Saturday 15 August 2026 --- */
  ['2026-08-10', '08:30', '326492', 'pr1', 'at1', 0, 'Confirmed', 'New referral — rectal bleeding'],
  ['2026-08-10', '10:00', '326497', 'pr1', 'at8', 0, 'Scheduled', 'IBS — follow-up'],
  ['2026-08-10', '14:00', '326505', 'pr1', 'at2', 0, 'Scheduled', 'Anaemia — repeat bloods'],
  ['2026-08-10', '15:30', '326510', 'pr1', 'at13', 0, 'Pending Confirmation', 'Post-procedure review'],
  ['2026-08-10', '09:30', '326473', 'pr2', 'at3', 1, 'Confirmed', 'Liver clinic — new patient'],
  ['2026-08-10', '11:00', '326479', 'pr2', 'at4', 1, 'Scheduled', 'Virtual follow-up'],
  ['2026-08-10', '09:00', '326498', 'pr3', 'at2', 0, 'Confirmed', 'Crohn disease — symptom review'],
  ['2026-08-10', '11:00', '326504', 'pr3', 'at8', 0, 'Scheduled', 'Coeliac — first visit'],
  ['2026-08-10', '10:30', '326480', 'pr5', 'at12', 3, 'Confirmed', 'Infliximab, cycle 4'],
  ['2026-08-11', '08:00', '326496', 'pr1', 'at1', 0, 'Confirmed', 'Referral — chronic nausea'],
  ['2026-08-11', '13:30', '326483', 'pr1', 'at9', 0, 'Scheduled', 'Wellness check'],
  ['2026-08-11', '09:00', '326485', 'pr6', 'at7', 0, 'Confirmed', 'Biofeedback, session 2'],
  ['2026-08-11', '14:00', '326477', 'pr6', 'at8', 0, 'Scheduled', 'Motility — results'],
  ['2026-08-11', '08:00', '326506', 'pr4', 'at6', 2, 'Confirmed', 'Gastroscopy — dyspepsia'],
  ['2026-08-11', '13:00', '326509', 'pr4', 'at15', 2, 'Scheduled', 'Banding, second session'],
  ['2026-08-12', '09:00', '326502', 'pr2', 'at4', 1, 'Scheduled', 'Hepatology follow-up'],
  ['2026-08-12', '15:00', '326507', 'pr2', 'at3', 1, 'Pending Confirmation', 'New patient — raised ALT'],
  ['2026-08-12', '10:00', '326490', 'pr5', 'at12', 3, 'Confirmed', 'Vedolizumab, cycle 5'],
  ['2026-08-12', '14:00', '326491', 'pr1', 'at8', 0, 'Scheduled', 'Coeliac — dietitian review'],
  ['2026-08-13', '09:00', '326494', 'pr1', 'at2', 0, 'Confirmed', 'IBS — plan review'],
  ['2026-08-13', '10:30', '326500', 'pr3', 'at8', 0, 'Scheduled', 'Reflux — first visit'],
  ['2026-08-13', '13:00', '326476', 'pr6', 'at2', 0, 'Scheduled', 'Follow-up, motility'],
  ['2026-08-14', '09:00', '326508', 'pr3', 'at6', 2, 'Confirmed', 'Colonoscopy — surveillance'],
  ['2026-08-14', '11:00', '326484', 'pr3', 'at13', 2, 'Scheduled', 'Post-procedure review'],
  ['2026-08-14', '10:00', '326481', 'pr1', 'at1', 0, 'Scheduled', 'New referral — weight loss'],
  ['2026-08-14', '11:00', '326499', 'pr5', 'at12', 3, 'Confirmed', 'Infusion, cycle 8'],
  ['2026-08-15', '09:30', '326503', 'pr6', 'at1', 0, 'Scheduled', 'Saturday clinic — new referral'],
  ['2026-08-15', '10:30', '326495', 'pr6', 'at2', 0, 'Scheduled', 'Follow-up, dyspepsia'],

  /* --- Monday 17 to Friday 21 August 2026 --- */
  ['2026-08-17', '08:30', '326473', 'pr1', 'at1', 0, 'Scheduled', 'Referral — altered bowel habit'],
  ['2026-08-17', '13:00', '326486', 'pr1', 'at5', 0, 'Scheduled', 'Annual wellness visit'],
  ['2026-08-17', '10:00', '326478', 'pr2', 'at3', 1, 'Scheduled', 'Liver clinic — new patient'],
  ['2026-08-17', '11:00', '326493', 'pr3', 'at2', 0, 'Scheduled', 'UC — flare review'],
  ['2026-08-18', '09:00', '326505', 'pr6', 'at8', 0, 'Scheduled', 'Functional bloating'],
  ['2026-08-18', '14:00', '326474', 'pr1', 'at13', 0, 'Scheduled', 'Post-op review'],
  ['2026-08-18', '08:00', '326497', 'pr4', 'at6', 2, 'Scheduled', 'Gastroscopy — anaemia'],
  ['2026-08-19', '10:00', '326501', 'pr1', 'at8', 0, 'Scheduled', 'Chronic pain — plan'],
  ['2026-08-19', '15:00', '326482', 'pr2', 'at4', 1, 'Scheduled', 'Virtual follow-up'],
  ['2026-08-19', '11:00', '326492', 'pr5', 'at12', 3, 'Scheduled', 'Infliximab, cycle 5'],
  ['2026-08-20', '09:30', '326479', 'pr3', 'at8', 0, 'Scheduled', 'Coeliac — first visit'],
  ['2026-08-20', '14:00', '326504', 'pr6', 'at7', 0, 'Scheduled', 'Biofeedback, session 3'],
  ['2026-08-21', '09:00', '326510', 'pr3', 'at6', 2, 'Scheduled', 'Colonoscopy — FIT positive'],
  ['2026-08-21', '13:00', '326475', 'pr3', 'at13', 2, 'Scheduled', 'Post-procedure review'],
  ['2026-08-21', '10:00', '326496', 'pr5', 'at12', 3, 'Scheduled', 'Iron infusion'],

  /* --- The thin bands: late afternoons, and the Saturday clinic ------------
     A clinic does not stop at three. These fill the 15:00–17:00 hour that had
     one booking in it across the whole week, and put a second chair in the
     Saturday morning list, which is the one session the desk is asked about
     most and the one the grid had least to show for. */
  ['2026-08-03', '16:30', '326493', 'pr1', 'at14', 0, 'Confirmed', 'Records request'],
  ['2026-08-04', '15:30', '326479', 'pr1', 'at13', 0, 'Scheduled', 'Post-op review, banding'],
  ['2026-08-05', '16:30', '326510', 'pr1', 'at2', 0, 'Scheduled', 'Reflux — follow-up'],
  ['2026-08-05', '15:30', '326486', 'pr5', 'at10', 3, 'Scheduled', 'Pre-infusion bloods'],
  ['2026-08-06', '15:30', '326500', 'pr6', 'at13', 0, 'Scheduled', 'Post-op review'],
  ['2026-08-06', '16:30', '326493', 'pr6', 'at4', 0, 'Pending Confirmation', 'Virtual — results'],
  ['2026-08-07', '15:00', '326474', 'pr3', 'at2', 2, 'Scheduled', 'Post-scope follow-up'],
  ['2026-08-07', '15:30', '326485', 'pr3', 'at13', 2, 'Scheduled', 'Discharge review'],
  ['2026-08-07', '15:00', '326481', 'pr5', 'at10', 3, 'Scheduled', 'Post-infusion observation'],
  ['2026-08-08', '09:00', '326479', 'pr6', 'at8', 0, 'Confirmed', 'Saturday clinic — bloating'],
  ['2026-08-08', '10:00', '326504', 'pr6', 'at2', 0, 'Confirmed', 'Follow-up, coeliac'],
  ['2026-08-08', '10:30', '326508', 'pr6', 'at13', 0, 'Scheduled', 'Post-op check'],
  ['2026-08-08', '11:00', '326482', 'pr6', 'at1', 0, 'Scheduled', 'New referral — reflux'],
  ['2026-08-10', '16:00', '326493', 'pr1', 'at2', 0, 'Scheduled', 'Follow-up, IBS'],
  ['2026-08-11', '15:30', '326479', 'pr6', 'at2', 0, 'Scheduled', 'Motility — review'],
  ['2026-08-12', '16:00', '326498', 'pr2', 'at4', 1, 'Scheduled', 'Virtual — LFT results'],
  ['2026-08-13', '15:00', '326485', 'pr6', 'at8', 0, 'Scheduled', 'Functional dyspepsia'],
  ['2026-08-14', '15:00', '326494', 'pr3', 'at13', 2, 'Scheduled', 'Post-procedure review'],
  ['2026-08-15', '11:00', '326474', 'pr6', 'at8', 0, 'Scheduled', 'Saturday clinic — follow-up'],

  /* --- MORE ENDOSCOPY, AND WHY IT IS DOWN HERE RATHER THAN IN ITS DAY ------
     Procedure lists across the weekdays that had none. Half the demo month
     showed an endoscopy suite with nothing in it, which is not what a GI
     practice looks like and left the procedure flows — check-in, the
     pre-procedure run, the encounter — with barely a booking to open them on.

     APPENDED RATHER THAN FILED INTO THEIR DATES. An appointment's id is its
     position in this array (`ap${index + 1}`), so inserting a row part-way
     down renumbers every booking after it: deep links break, `?appt=ap28`
     lands on a different patient, and any spec that names an id starts
     testing something else. The scheduler sorts by date and time when it
     renders, so nothing here is out of order on screen — only in the file.
     New rows go at the bottom, always.

     The two people who do procedures are David Smith (pr4, Endoscopy) and
     Emily Chen (pr3, IBD clinic), and neither is booked through their own
     time off: pr3 has a CME day on the 5th and pr4 is on annual leave on the
     12th and 13th, so those days are covered by whichever of the two is in.
     Location 2 is the endoscopy suite. Lists run mornings first, because a
     patient nil by mouth since midnight should not be waiting until three. */

  /* Monday 03 August — full list, and it has already been worked. */
  ['2026-08-03', '07:30', '326474', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-03', '09:00', '326481', 'pr4', 'at6', 2, 'Confirmed', 'K29.70 - Gastritis, unspecified, without bleeding'],
  ['2026-08-03', '10:30', '326478', 'pr4', 'at15', 2, 'Confirmed', 'K64.8 - Other haemorrhoids'],
  ['2026-08-03', '13:00', '326495', 'pr4', 'at6', 2, 'Confirmed', 'Z86.010 - Personal history of colonic polyps'],
  ['2026-08-03', '14:30', '326500', 'pr3', 'at6', 2, 'Confirmed', 'K51.90 - Ulcerative colitis, unspecified, without complications'],

  /* Thursday 06 August — the suite runs while Olivia Rhye is in audit. */
  ['2026-08-06', '07:30', '326483', 'pr4', 'at6', 2, 'Confirmed', 'D50.9 - Iron deficiency anaemia, unspecified'],
  ['2026-08-06', '09:00', '326475', 'pr4', 'at6', 2, 'Confirmed', 'R13.10 - Dysphagia, unspecified'],
  ['2026-08-06', '10:30', '326478', 'pr4', 'at15', 2, 'Scheduled', 'K64.8 - Other haemorrhoids'],
  ['2026-08-06', '13:00', '326484', 'pr4', 'at6', 2, 'Pending Confirmation', 'K57.30 - Diverticulosis of large intestine without perforation or abscess, without bleeding'],
  ['2026-08-06', '13:30', '326477', 'pr3', 'at6', 2, 'Confirmed', 'K50.90 - Crohn’s disease, unspecified, without complications'],

  /* Monday 10 August */
  ['2026-08-10', '07:30', '326482', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-10', '09:00', '326481', 'pr4', 'at6', 2, 'Confirmed', 'R10.13 - Epigastric pain'],
  ['2026-08-10', '10:30', '245638', 'pr4', 'at6', 2, 'Scheduled', 'K21.9 - Gastro-oesophageal reflux disease without oesophagitis'],
  ['2026-08-10', '13:30', '326476', 'pr4', 'at15', 2, 'Scheduled', 'K62.5 - Haemorrhage of anus and rectum'],

  /* Wednesday 12 and Thursday 13 August — David Smith is on leave, so these
     are Emily Chen's lists and they are shorter for it. */
  ['2026-08-12', '08:00', '326491', 'pr3', 'at6', 2, 'Confirmed', 'K51.90 - Ulcerative colitis, unspecified, without complications'],
  ['2026-08-12', '10:00', '326503', 'pr3', 'at6', 2, 'Scheduled', 'K50.90 - Crohn’s disease, unspecified, without complications'],
  ['2026-08-13', '08:00', '326508', 'pr3', 'at6', 2, 'Confirmed', 'R19.7 - Diarrhoea, unspecified'],
  ['2026-08-13', '09:15', '326486', 'pr3', 'at15', 2, 'Scheduled', 'K64.8 - Other haemorrhoids'],

  /* Monday 17, Wednesday 19 and Thursday 20 August */
  ['2026-08-17', '07:30', '326480', 'pr4', 'at6', 2, 'Confirmed', 'Z12.11 - Encounter for screening for malignant neoplasm of colon'],
  ['2026-08-17', '09:00', '326499', 'pr4', 'at6', 2, 'Scheduled', 'K59.00 - Constipation, unspecified'],
  ['2026-08-17', '10:30', '326473', 'pr4', 'at15', 2, 'Pending Confirmation', 'K62.5 - Haemorrhage of anus and rectum'],
  ['2026-08-19', '07:30', '326501', 'pr4', 'at6', 2, 'Confirmed', 'Z86.010 - Personal history of colonic polyps'],
  ['2026-08-19', '09:00', '326504', 'pr4', 'at6', 2, 'Scheduled', 'K92.2 - Gastrointestinal haemorrhage, unspecified'],
  ['2026-08-19', '13:00', '326479', 'pr4', 'at6', 2, 'Scheduled', 'R13.10 - Dysphagia, unspecified'],
  ['2026-08-20', '07:30', '326505', 'pr4', 'at6', 2, 'Confirmed', 'D50.9 - Iron deficiency anaemia, unspecified'],
  ['2026-08-20', '09:30', '326485', 'pr4', 'at15', 2, 'Scheduled', 'K64.8 - Other haemorrhoids'],
  ['2026-08-20', '11:00', '326510', 'pr3', 'at6', 2, 'Confirmed', 'K51.90 - Ulcerative colitis, unspecified, without complications'],

  /* --- A FULL DIARY FOR THE PERSON SIGNED IN --------------------------------
     The Dashboard's schedule card draws ONE diary — the account's own, which is
     Emily Chen (pr3) by way of PROVIDER.scheduleId in
     data/provider-settings.js. Everything above it was written for the
     Scheduler, where six diaries side by side make a busy screen out of three
     or four bookings each. Read one column at a time it was a different
     picture: the demo Tuesday held three appointments, the last of them over
     by 10:40, against a window that runs to 12:30. Two thirds of my own
     morning was white, "3 booked" read like a cancelled clinic rather than a
     working one, and the lane arithmetic that splits overlapping blocks had
     nothing to split.

     These rows fill that diary in — the clinic mornings Monday to Thursday,
     the Friday list at the ASC, and the same again the following week so that
     paging forward with the card's arrows lands on a day somebody works
     instead of on an empty grid. Every one sits inside pr3's configured hours
     (08:30–12:30 at Fargo on a weekday, 08:30–16:00 at the ASC on a Friday)
     and at the matching location, so the card's clinic/ASC switch still
     partitions them cleanly and nothing draws over the hatching.

     ON THE HALF HOUR, AND WHY THAT IS NOT JUST TIDINESS. A block on this card
     has a minimum drawn height — a ten-minute records request would otherwise
     be ten pixels of unreadable text — so a block occupies rather more of the
     column than its duration claims. Two starts less than about half an hour
     apart therefore collide on screen even though the clinic has no clash at
     all. Booking this diary on the half hour keeps the drawn day honest; the
     one exception is deliberate.

     That exception is the 11:00 pair on Tuesday the 4th: a virtual consent
     squeezed alongside a consultation, because a schedule that never clashes
     never exercises the lanes.

     Wednesday the 5th stays empty on purpose — it is the CME block day, and a
     named block with bookings underneath it is the one thing the availability
     drawing exists to rule out.

     Statuses run with the clock: Monday the 3rd is behind us and reads Check
     Out and No Show, Tuesday morning is part worked, and everything from
     Thursday onwards is still Confirmed or Scheduled.

     Appended rather than filed into their dates — see the note above about
     appointment ids being array positions.
     ------------------------------------------------------------------------- */

  /* Monday 03 August — a morning that has already been worked. */
  ['2026-08-03', '09:00', '326483', 'pr3', 'at13', 0, 'Check Out', 'Post-op review, ileocaecal resection'],
  ['2026-08-03', '10:30', '326485', 'pr3', 'at14', 0, 'Check Out', 'Records request — disability claim'],
  ['2026-08-03', '12:00', '326473', 'pr3', 'at2', 0, 'No Show', 'UC — surveillance planning'],

  /* Tuesday 04 August — the demo "today", and the day this card opens on. */
  ['2026-08-04', '09:00', '326480', 'pr3', 'at13', 0, 'Check Out', 'Post-polypectomy review'],
  ['2026-08-04', '10:00', '326492', 'pr3', 'at2', 0, 'Checked In', 'UC — mesalazine dose check'],
  ['2026-08-04', '11:00', '326493', 'pr3', 'at8', 0, 'Confirmed', 'Coeliac — new referral'],
  ['2026-08-04', '11:00', '326504', 'pr3', 'at4', 0, 'Pending Confirmation', 'Biologic consent — virtual add-on'],
  ['2026-08-04', '11:30', '326508', 'pr3', 'at10', 0, 'Scheduled', 'Pre-biologic bloods'],
  ['2026-08-04', '12:00', '326486', 'pr3', 'at13', 0, 'Scheduled', 'Post-procedure review'],

  /* Thursday 06 August. */
  ['2026-08-06', '09:00', '326480', 'pr3', 'at8', 0, 'Confirmed', 'Chronic diarrhoea — second opinion'],
  ['2026-08-06', '09:30', '326476', 'pr3', 'at10', 0, 'Scheduled', 'Thiopurine monitoring bloods'],
  ['2026-08-06', '10:30', '326491', 'pr3', 'at13', 0, 'Confirmed', 'Post-op review, seton insertion'],
  ['2026-08-06', '11:30', '326492', 'pr3', 'at8', 0, 'Confirmed', 'IBD — pregnancy planning'],
  ['2026-08-06', '12:00', '326494', 'pr3', 'at14', 0, 'Scheduled', 'Records request for insurer'],

  /* Monday 10 August. */
  ['2026-08-10', '08:30', '326486', 'pr3', 'at1', 0, 'Confirmed', 'New referral — rectal bleeding'],
  ['2026-08-10', '09:30', '326478', 'pr3', 'at10', 0, 'Scheduled', 'Pre-infusion bloods'],
  ['2026-08-10', '10:00', '326483', 'pr3', 'at8', 0, 'Confirmed', 'Coeliac — persistent symptoms'],
  ['2026-08-10', '10:30', '326477', 'pr3', 'at13', 0, 'Scheduled', 'Post-procedure review'],
  ['2026-08-10', '11:30', '326475', 'pr3', 'at2', 0, 'Pending Confirmation', "Crohn's — biologic switch"],
  ['2026-08-10', '12:00', '326485', 'pr3', 'at14', 0, 'Scheduled', 'Records request — solicitor'],

  /* Tuesday 11 August — a full clinic, so paging forward a week lands on one. */
  ['2026-08-11', '08:30', '326486', 'pr3', 'at1', 0, 'Confirmed', 'New referral — chronic diarrhoea'],
  ['2026-08-11', '09:00', '326480', 'pr3', 'at2', 0, 'Confirmed', 'IBS — dietary review'],
  ['2026-08-11', '09:30', '326478', 'pr3', 'at2', 0, 'Confirmed', 'UC — flare follow-up'],
  ['2026-08-11', '10:00', '326475', 'pr3', 'at10', 0, 'Scheduled', 'Biologic monitoring bloods'],
  ['2026-08-11', '10:30', '326474', 'pr3', 'at8', 0, 'Confirmed', 'Microscopic colitis — treatment options'],
  ['2026-08-11', '11:00', '326473', 'pr3', 'at13', 0, 'Scheduled', 'Post-op review, ileostomy'],
  ['2026-08-11', '11:30', '326481', 'pr3', 'at4', 0, 'Scheduled', 'Virtual follow-up — stoma care'],
  ['2026-08-11', '12:00', '326482', 'pr3', 'at2', 0, 'Scheduled', 'Coeliac — annual review'],

  /* Thursday 13 August — the clinic that follows the morning's scope list. */
  ['2026-08-13', '11:00', '326480', 'pr3', 'at2', 0, 'Scheduled', 'UC — post-flare review'],
  ['2026-08-13', '11:30', '326478', 'pr3', 'at13', 0, 'Scheduled', 'Post-procedure review'],
  ['2026-08-13', '12:00', '326483', 'pr3', 'at14', 0, 'Scheduled', 'Records request for insurer'],

  /* Friday 14 August — the ASC list, which runs the whole day. */
  ['2026-08-14', '10:15', '326486', 'pr3', 'at15', 2, 'Scheduled', 'Sigmoidoscopy — rectal bleeding'],
  ['2026-08-14', '13:00', '326480', 'pr3', 'at6', 2, 'Confirmed', 'Colonoscopy — surveillance'],
  ['2026-08-14', '14:15', '326478', 'pr3', 'at13', 2, 'Scheduled', 'Post-procedure review'],

  /* Monday 17 August. */
  ['2026-08-17', '08:30', '326483', 'pr3', 'at1', 0, 'Confirmed', 'New referral — weight loss'],
  ['2026-08-17', '09:00', '326479', 'pr3', 'at8', 0, 'Confirmed', 'IBD — vaccination review'],
  ['2026-08-17', '09:30', '326477', 'pr3', 'at10', 0, 'Scheduled', 'Thiopurine monitoring bloods'],
  ['2026-08-17', '10:00', '326475', 'pr3', 'at2', 0, 'Confirmed', 'Coeliac — dietitian outcome'],
  ['2026-08-17', '10:30', '326485', 'pr3', 'at13', 0, 'Scheduled', 'Post-op review, haemorrhoidectomy'],
  ['2026-08-17', '11:30', '326474', 'pr3', 'at4', 0, 'Scheduled', 'Virtual follow-up — biologic tolerance'],
  ['2026-08-17', '12:00', '326481', 'pr3', 'at2', 0, 'Scheduled', 'IBS — symptom diary review'],

  /* Tuesday 18 August. */
  ['2026-08-18', '08:30', '326480', 'pr3', 'at1', 0, 'Confirmed', 'New referral — altered bowel habit'],
  ['2026-08-18', '09:00', '326478', 'pr3', 'at2', 0, 'Confirmed', "Crohn's — post-infusion review"],
  ['2026-08-18', '09:30', '326483', 'pr3', 'at8', 0, 'Confirmed', 'Coeliac — new diagnosis counselling'],
  ['2026-08-18', '10:00', '326479', 'pr3', 'at10', 0, 'Scheduled', 'Pre-biologic bloods'],
  ['2026-08-18', '10:30', '326477', 'pr3', 'at2', 0, 'Scheduled', 'UC — mesalazine review'],
  ['2026-08-18', '11:00', '326475', 'pr3', 'at13', 0, 'Scheduled', 'Post-procedure review'],
  ['2026-08-18', '11:30', '326485', 'pr3', 'at1', 0, 'Pending Confirmation', 'New referral — chronic bloating'],
  ['2026-08-18', '12:00', '326473', 'pr3', 'at14', 0, 'Scheduled', 'Records request for insurer'],

  /* Thursday 20 August — a short clinic before the late scope list. */
  ['2026-08-20', '08:30', '326486', 'pr3', 'at2', 0, 'Confirmed', 'UC — maintenance review'],
  ['2026-08-20', '09:00', '326480', 'pr3', 'at10', 0, 'Scheduled', 'Monitoring bloods'],
  ['2026-08-20', '10:00', '326478', 'pr3', 'at2', 0, 'Confirmed', "Crohn's — symptom review"],
  ['2026-08-20', '10:30', '326483', 'pr3', 'at13', 0, 'Scheduled', 'Post-op review, fistula repair'],

  /* Friday 21 August — the ASC list. */
  ['2026-08-21', '10:15', '326486', 'pr3', 'at6', 2, 'Confirmed', 'Gastroscopy — coeliac biopsies'],
  ['2026-08-21', '11:30', '326480', 'pr3', 'at15', 2, 'Scheduled', 'Banding — internal haemorrhoids'],
  ['2026-08-21', '13:30', '326478', 'pr3', 'at6', 2, 'Scheduled', 'Colonoscopy — FIT positive'],
  ['2026-08-21', '14:45', '326483', 'pr3', 'at13', 2, 'Scheduled', 'Discharge review'],
];

/**
 * The scope-list entries among the seed bookings.
 *
 * "Procedure Visit" and "Minor Surgical Procedure" are appointment types — how
 * long a slot is and what colour it draws. What is actually being done is the
 * procedure, and the check-in flow, the care-type column and the clinical note
 * template all key off that. Tagging them here is what makes those bookings
 * Procedure care type rather than plain clinic visits.
 *
 * Declared above APPOINTMENTS on purpose: the mapper below runs at module load
 * and reads this, and a `const` is not hoisted.
 */
const SCOPE_LISTS = {
  at6: ['pt1', 'pt2', 'pt4', 'pt5'], // Procedure Visit → colonoscopy, EGD, ERCP, EUS
  at15: ['pt3'], // Minor Surgical Procedure → sigmoidoscopy
};

/**
 * Booked appointments, with the patient record and the configured type joined
 * in. `mrn` is the join key so the scheduler and the patient directory can
 * never disagree about a name.
 */
export const APPOINTMENTS = ROWS.map(
  ([date, start, mrn, providerId, typeId, locationIndex, status, reason], index) => ({
    id: `ap${index + 1}`,
    date,
    start,
    mrn,
    providerId,
    typeId,
    location: LOCATIONS[locationIndex],
    status,
    reason,
    waitList: false,
    notes: '',
    // Resources. A room and a scope are implied by the procedure itself, so
    // they are filled in here rather than left for the front desk to retype;
    // everything else starts empty and is added on the appointment form.
    ...defaultResources(typeId, index),
    ...procedureIdentity(typeId, index),
  })
);

function procedureIdentity(typeId, index) {
  const options = SCOPE_LISTS[typeId];
  if (!options) return {};
  return { kind: 'procedure', procedureId: options[index % options.length] };
}

/**
 * The room, kit and referrer a booking arrives with.
 *
 * A procedure implies its room and scope, and anything a GP sent in — a new
 * patient, a consultation, a scope list — arrives with a referring physician.
 * Follow-ups and infusions are internal, so they have none.
 */
function defaultResources(typeId, index) {
  const REFERRED = ['at1', 'at3', 'at6', 'at8', 'at15'];
  const referrers = REFERRED.includes(typeId)
    ? [REFERRING_PHYSICIANS[index % REFERRING_PHYSICIANS.length].id]
    : [];

  if (typeId === 'at6' || typeId === 'at15') {
    return {
      area: 'Endoscopy Suite A',
      equipment: ['Olympus colonoscope', 'CO₂ insufflator'],
      staff: ['u2'],
      referrers,
      coProviders: [],
    };
  }
  if (typeId === 'at12') {
    return {
      area: 'Infusion Bay 1',
      equipment: ['Infusion pump'],
      staff: ['u8'],
      referrers,
      coProviders: [],
    };
  }
  return { area: '', equipment: [], staff: [], referrers, coProviders: [] };
}

export const referrerById = (id) => REFERRING_PHYSICIANS.find((r) => r.id === id);
export const staffById = (id) => STAFF.find((s) => s.id === id);

/* --- Lookups --------------------------------------------------------------- */

export const providerById = (id) => PROVIDERS.find((p) => p.id === id);
export const typeById = (id) => APPOINTMENT_TYPES.find((t) => t.id === id);
export const statusByName = (name) => STATUS_COLOURS.find((s) => s.name === name);

/** A type's length in minutes, whichever unit it was configured in. */
/**
 * How long an appointment of this type takes, in minutes.
 *
 * The type's own duration is any number the practice types into Settings —
 * ten minutes for a records request, three hours for a hydrogen breath test —
 * measured in whichever unit the type was written in. There is no menu of
 * standard lengths anywhere in the system, and nothing here rounds an odd one
 * to the nearest half hour.
 *
 * A PROVIDER WHO DIFFERS OVERRIDES IT.
 * Settings ▸ Appointment lets a type carry a row per provider who takes
 * longer or shorter over the same visit — a new patient who is 45 minutes for
 * one clinician and 30 for another. Those rows were being written and then
 * read by nobody: every caller asked for the type's default, so the calendar
 * drew the standard block and the booking form offered standard slots no
 * matter whose diary it was. Passing the provider is optional, because plenty
 * of callers genuinely have no one in mind — a catalogue listing, a type
 * picker — and those keep getting the default.
 *
 * The override is stored in the type's own unit, which is how the settings
 * screen labels it ("45 minutes" under a type measured in minutes), so the
 * conversion to minutes happens once, after the choice, rather than twice.
 */
export function durationOf(typeId, providerId) {
  const type = typeById(typeId);
  if (!type) return 30;

  const name = PROVIDERS.find((p) => p.id === providerId)?.name;
  const override = name
    ? (type.providerDurations ?? []).find((row) => row.provider === name)
    : null;

  const length = override ? override.duration : type.duration;
  return type.unit === 'Hour' ? length * 60 : length;
}

/* --- Time helpers ---------------------------------------------------------- */

/** "08:30" → 510 */
export function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 510 → "08:30" */
export function toTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The minute an appointment starts and the minute it ends. The provider goes
 *  in because a booking IS in somebody's diary, and the one thing a block on a
 *  calendar must be is the length that clinician actually takes over it. */
export function span(appt) {
  const start = toMinutes(appt.start);
  return { start, end: start + durationOf(appt.typeId, appt.providerId) };
}

/* --- Availability ---------------------------------------------------------- */

/** "2026-08-04" → "Tuesday", matching the WEEK_DAYS names. */
export function weekdayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  // getDay() is Sunday-first; WEEK_DAYS is Monday-first.
  const index = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return WEEK_DAYS[index];
}

/** The Monday on or before an ISO date, as a Date. Every question about
 *  fortnightly work is a question about a whole week, so both ends are pulled
 *  back to the week's start before anything is counted — otherwise a Sunday
 *  and the Monday before it would give different answers about the same seven
 *  days. */
function weekStart(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

/**
 * Does this day slot's pattern run in the week the given date falls in?
 *
 * Every week unless the slot says otherwise — the field is optional, and a
 * slot written before it existed is a weekly one. An every-other-week slot
 * runs in the week its From date falls in and in every second week after
 * that, so a provider who works alternate Mondays is on in the week the
 * arrangement started and off in the one after it. See SLOT_REPEATS in
 * data/appointments.js for why the answer is per slot rather than per day.
 *
 * Rounded rather than truncated: the difference is taken in milliseconds, and
 * a week that crosses a daylight-saving change is an hour short of seven
 * whole days — which floor() would quietly count as the week before.
 */
export function slotRunsOn(slot, iso) {
  if (slot.repeat !== 'Every other week') return true;
  const weeks = Math.round((weekStart(iso) - weekStart(slot.from)) / (7 * 86_400_000));
  return weeks % 2 === 0;
}

/**
 * What a provider's configured availability says about one date.
 *
 *   { blocks: [{ start, end, location }], blocked: [{ title, start, end }] }
 *
 * `blocks` are the bookable windows from the day slots whose date range covers
 * the date; `blocked` are the block days that cut into it. A date with no
 * blocks is a non-working day for that provider.
 */
export function availabilityOn(providerId, iso) {
  const schedule = PROVIDER_SCHEDULES[providerId];
  if (!schedule) return { blocks: [], blocked: [] };

  const day = weekdayName(iso);
  const blocks = [];
  for (const slot of schedule.daySlots) {
    if (iso < slot.from || iso > slot.to) continue;
    // A fortnightly slot says nothing in its off weeks — see slotRunsOn().
    // The date range is how long the arrangement lasts; the repeat is how
    // often it comes round inside that range.
    if (!slotRunsOn(slot, iso)) continue;
    const entry = slot.days.find((d) => d.day === day);
    if (!entry?.enabled) continue;
    for (const b of entry.blocks) {
      if (b.start && b.end) blocks.push({ ...b });
    }
  }

  const blocked = schedule.blockDays
    .filter((b) => iso >= b.start && iso <= (b.end || b.start))
    .map((b) => ({ title: b.title, start: b.startTime, end: b.endTime }));

  return { blocks, blocked };
}

/** True when the whole appointment sits inside a bookable window. */
export function isWithinAvailability(providerId, iso, startMinute, endMinute) {
  const { blocks } = availabilityOn(providerId, iso);
  return blocks.some(
    (b) => toMinutes(b.start) <= startMinute && toMinutes(b.end) >= endMinute
  );
}

/** Block days that overlap the given window, if any. */
export function blockedDuring(providerId, iso, startMinute, endMinute) {
  return availabilityOn(providerId, iso).blocked.filter(
    (b) => toMinutes(b.start) < endMinute && toMinutes(b.end) > startMinute
  );
}
