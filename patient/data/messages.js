/**
 * Messages — the Messages screen.
 *
 * ⚠ WHICH SIDE IS WHICH
 *
 * `mine: true` marks the PATIENT's own messages. They are drawn on the RIGHT
 * in the filled bubble; the care team's are on the left in a white one under
 * the sender's name — the convention, and what the supplied chat reference
 * draws. An earlier cut had the two inverted, from a design that put the care
 * team on the right; the side lives in css/screen-messages.css, not here.
 *
 * The threads carried a role, a phone number and an email address for a head
 * band that printed all three. None of them were in a supplied screenshot,
 * and the band is now the portrait and the name; the fields went with it
 * rather than sitting here as three invented values nothing draws.
 */

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod ' +
  'tempor incididunt ut labore';

/**
 * The conversation list down the left of the Messages screen.
 *
 * `members` turns a row into a group thread: a shared avatar instead of one
 * person's initials, and a head that says "N people can see what you write
 * here" under the name. The count is not printed on the list row — the
 * reference's row has no line for it, and the name of a group already reads
 * as one.
 */
export const THREADS = [
  {
    id: 'th-livia',
    name: 'Livia James',
    when: 'Thursday',
    preview: "Great. I'll send you a summary via email. See you tomorrow.",
    urgent: true,
    unread: 1,
  },
  {
    id: 'th-surgical',
    name: 'Surgical Follow-Ups',
    when: 'Thursday',
    preview: LOREM,
    members: 14,
  },
  {
    id: 'th-ricardo',
    name: 'Ricardo Jones',
    when: 'Thursday',
    preview: LOREM,
  },
  {
    id: 'th-wellness',
    name: 'Managing Patient Wellness',
    when: 'Thursday',
    preview: LOREM,
    members: 10,
    urgent: true,
    unread: 3,
  },
  {
    id: 'th-coordination',
    name: 'Patient Care Coordination',
    when: 'Thursday',
    preview: LOREM,
    members: 12,
  },
  {
    id: 'th-jonathan',
    name: 'Jonathan Smith',
    when: 'Thursday',
    preview: LOREM,
    urgent: true,
    unread: 2,
  },
  {
    id: 'th-livia-2',
    name: 'Livia James',
    when: 'Thursday',
    preview: LOREM,
  },
  {
    id: 'th-jaxon',
    name: 'Jaxon Lee',
    when: 'Thursday',
    preview: LOREM,
  },
  {
    id: 'th-user',
    name: 'User Name',
    when: 'Thursday',
    preview: LOREM,
  },
];

/**
 * The open conversation.
 *
 * Keyed by thread id so selecting another row in the list can swap the pane.
 * Only the first thread is written out; the rest fall back to a short
 * placeholder exchange rather than pretending to a history they do not have.
 *
 * `html: true` marks a body that carries its own markup — the lab figures and
 * the numbered test list are formatted in the design, and flattening them to
 * one paragraph would lose the thing those messages are showing. Those
 * strings are authored here and nowhere else; nothing typed by a user ever
 * takes this path (see the composer in js/screens/messages.js).
 */
export const CONVERSATIONS = {
  'th-livia': [
    {
      html: true,
      body:
        'I reviewed your labs:<br>' +
        '• <strong>HbA1c: 7.4%</strong> (slightly elevated)<br>' +
        '• <strong>LDL: 152 mg/dL</strong> (borderline high)<br>' +
        '• Other values are stable.<br>' +
        'Nothing emergent, but we should adjust the plan.',
      at: '11:30 AM',
    },
    { mine: true, body: 'Okay. Do I need to change medication or diet?', at: '11:49 AM' },
    {
      html: true,
      body:
        "We'll review your glucose logs and decide.<br>" +
        'Are you free for a <strong>follow-up tomorrow at 10:30 AM?</strong>',
      at: '12:16 PM',
    },
    { mine: true, body: 'Yes, 10:30 AM works.', at: '12:20 PM' },
    {
      html: true,
      body:
        'Appointment confirmed.<br>' +
        "I'm ordering the following tests before your visit:<br>" +
        '1. <strong>Fasting Lipid Panel</strong><br>' +
        '2. <strong>Urine Micro albumin</strong><br>' +
        '3. <strong>CMP (Comprehensive Metabolic Panel)</strong><br>' +
        'Please complete them by tomorrow morning.',
      at: '12:56 PM',
    },
    {
      mine: true,
      body: "Got it. I'll complete the tests today. Thank you.",
      at: '01:05 PM',
      urgent: true,
    },
    {
      body: "Great. I'll send you a summary via email. See you tomorrow.",
      at: '01:07 PM',
    },
  ],
};

/** Every other thread opens on this rather than on an empty pane. */
export const EMPTY_CONVERSATION = [
  { body: 'Hello — how can the team help today?', at: '09:00 AM' },
];
