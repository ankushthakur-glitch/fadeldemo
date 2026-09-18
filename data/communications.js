/**
 * DEMO DATA — Communications (Chats).
 *
 * One inbox for every conversation the practice has: with patients through the
 * portal, with colleagues inside the building, and with the standing groups
 * that carry a case between them.
 *
 * NOBODY IS RE-TYPED HERE
 * A chat is with a person who already exists. Patients are looked up in the
 * patient directory by MRN and staff in the practice's user list by id, so a
 * name changed in Settings ▸ Users changes here too, and a chat can never be
 * with somebody the practice has never heard of. The lookups below throw at
 * import time if an id has gone — a loud failure in a prototype beats a chat
 * thread quietly addressed to "undefined".
 *
 * WHO IS ALLOWED IN A GROUP
 * Only ONE group here has a patient in it, and it has exactly one patient:
 * their own care team. That is deliberate. A group is a shared thread — every
 * member reads every message — so a group holding two patients would show each
 * of them the other's symptoms. Internal groups (the endoscopy list, pathology,
 * recalls) are staff only for the same reason.
 *
 * WHY EVERY TIMESTAMP IS A LITERAL
 * No Date.now() and no new Date(): the clock the composer advances starts from
 * a fixed time (see js/screens/communications.js), so a screenshot taken today
 * looks the same next month — the rule the rest of the prototype's demo data
 * follows.
 *
 * Names, MRNs, numbers and every word of every message are invented. No real
 * PHI, and no real clinical advice.
 */
import { PROVIDER } from './provider-settings.js';
import { DIRECTORY } from './directory.js';
import { USERS } from './practice.js';

/* ===================== Who "I" am ===================== */

/**
 * The signed-in clinician. Read off the shared provider record rather than
 * spelled out, because the avatar in the page header, Settings ▸ Provider and
 * the right-hand side of every conversation have to be the same person.
 */
export const ME = {
  id: PROVIDER.id,
  kind: 'staff',
  name: `${PROVIDER.prefix} ${PROVIDER.firstName} ${PROVIDER.lastName}`,
  role: PROVIDER.title,
};

/* ===================== The people you can talk to ===================== */

/**
 * A patient, as the chat screen needs them.
 *
 * Email is composed rather than stored: the directory holds no address, and
 * inventing a second one per patient would be a second thing to keep in step
 * with the name. Built the same way as the staff addresses in practice.js.
 */
function patient(mrn) {
  const record = DIRECTORY.find((row) => row.mrn === String(mrn));
  if (!record) throw new Error(`communications.js: no patient with MRN ${mrn}`);

  const [first, ...rest] = record.name.split(' ');
  return {
    id: `pt-${record.mrn}`,
    kind: 'patient',
    name: record.name,
    mrn: record.mrn,
    phone: record.phone,
    email: `${first}.${rest.join('')}@example.com`.toLowerCase(),
    role: 'Patient',
  };
}

/** A colleague, as the chat screen needs them. */
function staff(id) {
  const record = USERS.find((row) => row.id === id);
  if (!record) throw new Error(`communications.js: no user with id ${id}`);

  return {
    id: record.id,
    kind: 'staff',
    name: record.name,
    role: record.role,
    phone: record.phone,
    email: record.email,
  };
}

/**
 * The roster the New Chat panel searches.
 *
 * "Recent" is a fixed order rather than a computed one: the prototype has no
 * message history to sort by, and a list that reshuffled on every reload could
 * not be screenshotted. u1–u8 are the practice's curated users; the four ids
 * after them are generated provider records from the same list, included so a
 * group can be a realistic size without inventing anybody.
 */
export const ROSTER = {
  patients: [
    patient(326486), // Henna West
    patient(326491), // Priya Raman
    patient(326490), // Marcus Adeyemi
    patient(326493), // Aisha Bello
    patient(326492), // Tomas Herrera
    patient(245638), // Naomi Samuelson
    patient(326474), // Andi Lane
    patient(326476), // Ethan Kim
  ],
  clinicians: [
    staff('u3'), // Arlene McCoy — Physician
    staff('u2'), // Esther Howard — RN
    staff('u4'), // Savannah Nguyen — Nurse Practitioner
    staff('u5'), // Eduardo Mcguire — Physician Assistant
    staff('u7'), // Adrienne Warner — Medical Assistant
    staff('u8'), // Ryan Weste — Front Desk
    staff('u6'), // Jacque Andrews — Billing Staff
    staff('u9'),
    staff('u12'),
    staff('u15'),
    staff('u18'),
  ],
};

/** Everyone, for the searches that do not care which list you came from. */
export const PEOPLE = [...ROSTER.patients, ...ROSTER.clinicians];

/** Resolve an id to a person. Throws, for the reason given at the top. */
function person(id) {
  const who = PEOPLE.find((entry) => entry.id === id);
  if (!who) throw new Error(`communications.js: nobody in the roster has id ${id}`);
  return who;
}

/* ===================== Vocabulary ===================== */

/**
 * The four filters across the top.
 *
 * `all` is first and selected on load, because the point of one inbox is that
 * you do not have to know which kind of conversation you are looking for
 * before you can look for it. `match` is the thread kind each one keeps.
 */
export const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'patients', label: 'Patients', match: 'patient' },
  { id: 'clinicians', label: 'Clinicians', match: 'clinician' },
  { id: 'groups', label: 'Groups', match: 'group' },
];

/**
 * Badge tone for the "who is this" chip on a row.
 *
 * A patient message is the one you must not miss — it carries portal
 * obligations and it is the only kind that comes from outside the building — so
 * it gets the tinted badge and colleagues get the quiet grey. The label still
 * says which is which; the colour only decides where your eye lands first.
 */
export const PARTY_TONES = { patient: 'info', staff: 'neutral' };

/** The two quick filters under the search box. */
export const QUICK_FILTERS = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'unread', label: 'Unread' },
];

/**
 * What a new conversation can be — the New Chat panel's first field.
 *
 * Patient and Clinician are one-to-one and Group is many, which is why the
 * panel changes shape when this changes rather than accepting any mixture.
 */
export const CHAT_TYPES = [
  { value: 'patient', label: 'Patient' },
  { value: 'clinician', label: 'Clinician' },
  { value: 'group', label: 'Group' },
];

/* ===================== The threads ===================== */

/*
 * MESSAGE SHAPE
 *   from     'me', or the id of a person in the roster. Absent when `ai`.
 *   ai       an assistant suggestion — drafted for the team, sent by nobody.
 *   day      the separator it sits under: 'Thursday', 'Today'.
 *   at       clock time as displayed. Never computed.
 *   lines    paragraphs. `*asterisks*` mean bold — one convention, applied
 *            after the text is escaped (see boldify in the screen script), so
 *            nothing here can reach the DOM as markup.
 *   items    an optional NUMBERED list (orders, instructions to follow in turn)
 *   bullets  an optional UNNUMBERED list (options to weigh, no order implied)
 *   after    a closing line printed under a list
 *   urgent   the sender marked it urgent
 *   seenBy   read receipt count. Groups only — in a one-to-one thread "seen by
 *            1" tells you nothing you did not already know.
 */

export const THREADS = [
  {
    id: 'th-henna',
    kind: 'patient',
    party: person('pt-326486'),
    when: 'Today',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'me',
        day: 'Thursday',
        at: '12:16 PM',
        lines: [
          "We'll review your symptom diary and decide.",
          'Are you free for a *follow-up tomorrow at 10:30 AM*?',
        ],
      },
      {
        id: 'm2',
        from: 'pt-326486',
        day: 'Thursday',
        at: '12:41 PM',
        lines: ['That works. Morning is easier for me than the afternoon.'],
      },
      {
        id: 'm3',
        from: 'me',
        day: 'Today',
        at: '12:56 PM',
        lines: ['Appointment confirmed.', "I'm ordering the following tests before your visit:"],
        items: [
          'Complete blood count',
          'Comprehensive metabolic panel',
          'H. pylori breath test',
        ],
        after: 'Please complete them by tomorrow morning.',
      },
      {
        id: 'm4',
        from: 'pt-326486',
        day: 'Today',
        at: '01:05 PM',
        urgent: true,
        lines: ["Got it. I'll complete the tests today. Thank you."],
      },
      {
        id: 'm5',
        from: 'me',
        day: 'Today',
        at: '01:07 PM',
        lines: ["Great. I'll send you a summary via email.", 'See you tomorrow.'],
      },
    ],
  },

  {
    id: 'th-care-coordination',
    kind: 'group',
    name: 'Patient Care Coordination',
    when: 'Today',
    unread: 0,
    urgent: true,
    /* One patient, and her care team. See the note at the top of this file
       about why no group here holds two patients. */
    members: [
      person('pt-326486'),
      person('u2'),
      person('u3'),
      person('u4'),
      person('u7'),
      person('u8'),
      person('u5'),
      person('u6'),
      person('u9'),
      person('u12'),
    ],
    messages: [
      {
        id: 'm1',
        from: 'pt-326486',
        day: 'Thursday',
        at: '12:27 PM',
        urgent: true,
        seenBy: 6,
        lines: [
          'Hello team, just wanted to update my symptom diary for today.',
          'Morning: two loose stools, mild cramping.',
          'Afternoon: settled after the second dose.',
          'Still tired, but better than yesterday.',
        ],
      },
      {
        id: 'm2',
        from: 'u2',
        day: 'Today',
        at: '12:16 PM',
        seenBy: 6,
        lines: [
          "Thanks, Henna. That's helpful.",
          'Did you take the medication after breakfast today?',
        ],
      },
      {
        id: 'm3',
        from: 'pt-326486',
        day: 'Today',
        at: '12:27 PM',
        seenBy: 6,
        lines: ['Yes, I took it after eating. The cramping was lighter.'],
      },
      {
        id: 'm4',
        ai: true,
        day: 'Today',
        at: '02:16 PM',
        lines: [
          'Based on the diary and the lighter cramping after the change in dose timing, consider:',
        ],
        bullets: [
          'Continue the current dose for another 2–3 days',
          'Keep logging stool frequency and cramping twice daily',
          'If symptoms settle for a week, consider stepping the dose down',
          'Encourage hydration and a low-residue day before the next visit',
        ],
      },
    ],
  },

  {
    id: 'th-endoscopy',
    kind: 'group',
    name: 'Endoscopy Follow-Ups',
    when: 'Thursday',
    unread: 0,
    urgent: false,
    members: [
      person('u3'),
      person('u5'),
      person('u2'),
      person('u7'),
      person('u4'),
      person('u12'),
      person('u15'),
      person('u18'),
      person('u9'),
    ],
    messages: [
      {
        id: 'm1',
        from: 'u5',
        day: 'Thursday',
        at: '09:12 AM',
        seenBy: 8,
        lines: [
          "Thursday's list is confirmed — six colonoscopies and two upper endoscopies.",
          'Two patients still need their prep call.',
        ],
      },
      {
        id: 'm2',
        from: 'u7',
        day: 'Thursday',
        at: '09:40 AM',
        seenBy: 7,
        lines: ["I'll take both prep calls before noon and log them on the worklist."],
      },
      {
        id: 'm3',
        from: 'me',
        day: 'Thursday',
        at: '09:44 AM',
        lines: ['Thank you. Leave the 7 AM slot open — I may pull a case forward.'],
      },
    ],
  },

  {
    id: 'th-ibd-huddle',
    kind: 'group',
    name: 'IBD Clinic Huddle',
    when: 'Thursday',
    unread: 3,
    urgent: false,
    members: [
      person('u3'),
      person('u9'),
      person('u15'),
      person('u18'),
      person('u2'),
      person('u4'),
      person('u5'),
    ],
    messages: [
      {
        id: 'm1',
        from: 'u15',
        day: 'Thursday',
        at: '10:05 AM',
        seenBy: 6,
        lines: [
          'Monday clinic has four new starts on biologics.',
          'All four need a dietetics slot in the same week — I can take three.',
        ],
      },
      {
        id: 'm2',
        from: 'u9',
        day: 'Thursday',
        at: '10:22 AM',
        seenBy: 5,
        lines: ['I can see the fourth on Tuesday if somebody covers my 2 PM.'],
      },
      {
        id: 'm3',
        from: 'u4',
        day: 'Thursday',
        at: '10:31 AM',
        seenBy: 4,
        lines: ["I'll cover the 2 PM. Put it on the board so the front desk sees it."],
      },
    ],
  },

  {
    id: 'th-pathology',
    kind: 'group',
    name: 'Pathology Results',
    when: 'Thursday',
    unread: 0,
    urgent: true,
    members: [
      person('u3'),
      person('u5'),
      person('u2'),
      person('u9'),
      person('u18'),
      person('u12'),
    ],
    messages: [
      {
        id: 'm1',
        from: 'u3',
        day: 'Thursday',
        at: '01:30 PM',
        urgent: true,
        seenBy: 5,
        lines: [
          'Three specimens back from Tuesday. One needs a same-week call to the patient.',
          'I have flagged it on the worklist rather than naming anybody here.',
        ],
      },
      {
        id: 'm2',
        from: 'me',
        day: 'Thursday',
        at: '01:38 PM',
        lines: ['Seen. I will make that call myself this afternoon.'],
      },
    ],
  },

  {
    id: 'th-recalls',
    kind: 'group',
    name: 'Screening Recalls',
    when: 'Thursday',
    unread: 0,
    urgent: false,
    members: [
      person('u8'),
      person('u7'),
      person('u6'),
      person('u2'),
      person('u4'),
      person('u15'),
      person('u9'),
    ],
    messages: [
      {
        id: 'm1',
        from: 'u8',
        day: 'Thursday',
        at: '08:55 AM',
        seenBy: 6,
        lines: [
          'Fifteen ten-year recalls came due this month.',
          'Letters go out today, calls start next week.',
        ],
      },
    ],
  },

  {
    id: 'th-mccoy',
    kind: 'clinician',
    party: person('u3'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'u3',
        day: 'Thursday',
        at: '08:15 AM',
        lines: [
          'Can you look at the pathology on the sigmoid biopsies from Tuesday?',
          'I would rather not sign the note until you have read it.',
        ],
      },
      {
        id: 'm2',
        from: 'me',
        day: 'Thursday',
        at: '08:31 AM',
        lines: ['Reading it now. Hold the note and I will add a line under Assessment.'],
      },
    ],
  },

  {
    id: 'th-howard',
    kind: 'clinician',
    party: person('u2'),
    when: 'Thursday',
    unread: 2,
    urgent: true,
    messages: [
      {
        id: 'm1',
        from: 'u2',
        day: 'Thursday',
        at: '07:48 AM',
        urgent: true,
        lines: [
          'Room 3 patient is hypotensive after sedation — *88/54*, recovering.',
          'Anaesthesia is with her now. Do you want to see her before discharge?',
        ],
      },
      {
        id: 'm2',
        from: 'u2',
        day: 'Thursday',
        at: '07:52 AM',
        lines: ['Pressure back up to 104/68 after fluids. Still holding her in recovery.'],
      },
    ],
  },

  {
    id: 'th-warner',
    kind: 'clinician',
    party: person('u7'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'u7',
        day: 'Thursday',
        at: '11:20 AM',
        lines: ['Two prep calls done. Ms Bello wants the 7 AM slot if it opens up.'],
      },
      {
        id: 'm2',
        from: 'me',
        day: 'Thursday',
        at: '11:26 AM',
        lines: ['Give her the 7 AM — I will start the list early.'],
      },
    ],
  },

  {
    id: 'th-raman',
    kind: 'patient',
    party: person('pt-326491'),
    when: 'Thursday',
    unread: 1,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'pt-326491',
        day: 'Thursday',
        at: '02:44 PM',
        lines: [
          'The reflux is much better on the new dose, thank you.',
          'Do I still need the *repeat endoscopy in October*?',
        ],
      },
    ],
  },

  {
    id: 'th-adeyemi',
    kind: 'patient',
    party: person('pt-326490'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'me',
        day: 'Thursday',
        at: '03:10 PM',
        lines: [
          'Your iron studies are back and the level has come up.',
          'No infusion needed this month.',
        ],
      },
      {
        id: 'm2',
        from: 'pt-326490',
        day: 'Thursday',
        at: '03:22 PM',
        lines: ['That is a relief. I will keep taking the tablets with orange juice.'],
      },
    ],
  },

  {
    id: 'th-bello',
    kind: 'patient',
    party: person('pt-326493'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'pt-326493',
        day: 'Thursday',
        at: '04:05 PM',
        lines: ['Confirming my colonoscopy on the 18th. I have the prep from the pharmacy.'],
      },
      {
        id: 'm2',
        from: 'me',
        day: 'Thursday',
        at: '04:11 PM',
        lines: ['Confirmed. Stop the iron tablets five days before; everything else as normal.'],
      },
    ],
  },

  {
    id: 'th-herrera',
    kind: 'patient',
    party: person('pt-326492'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'pt-326492',
        day: 'Thursday',
        at: '09:02 AM',
        lines: ['Sent the photographs of the rash you asked about. Did they come through?'],
      },
    ],
  },

  {
    id: 'th-samuelson',
    kind: 'patient',
    party: person('pt-245638'),
    when: 'Thursday',
    unread: 0,
    urgent: false,
    messages: [
      {
        id: 'm1',
        from: 'pt-245638',
        day: 'Thursday',
        at: '08:40 AM',
        lines: ['Could you send the visit summary to my new address? I moved last month.'],
      },
      {
        id: 'm2',
        from: 'me',
        day: 'Thursday',
        at: '08:52 AM',
        lines: [
          'Yes — the front desk will update the record first so the letter goes to the right place.',
        ],
      },
    ],
  },
];
