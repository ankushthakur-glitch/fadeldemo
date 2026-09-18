/**
 * DEMO DATA for the Notes module (chart section "notes").
 * Entirely invented — no real patient information.
 *
 * Keyed by MRN, same convention as chart-orders.js: this file is what THIS
 * module needs, kept separate from patient-chart.js (the shell) so the two
 * can change without touching each other.
 *
 * Two kinds of note, matching the reference screens:
 *   notes        free-text notes — a running log, no lifecycle beyond "added".
 *   alertNotes   notes with a place they surface (Visible At) and a
 *                Active/Inactive status — closer to a flag than a note, which
 *                is why they get their own tab and their own columns.
 */

export const VISIBLE_AT = ['Scheduling', 'Check-In', 'Encounter', 'Billing'];

export const CHART_NOTES = {
  326486: {
    notes: [
      {
        id: 'n-1',
        text: 'Patient reports improved sleep patterns over the past week; medication adherence confirmed with no reported side effects.',
        author: 'Floyd Miles',
        date: '06-08-2025',
      },
      {
        id: 'n-2',
        text: 'Patient appeared anxious during the session but was cooperative and responsive to cognitive behavioral prompts.',
        author: 'Jerome Bell',
        date: '04-08-2025',
      },
      {
        id: 'n-3',
        text: 'Dosage of Sertraline increased from 50mg to 75mg daily as per provider recommendation; follow-up scheduled in 2 weeks.',
        author: 'Courtney Henry',
        date: '04-08-2025',
      },
      {
        id: 'n-4',
        text: 'Patient advised to complete lab work before next visit and continue journaling mood patterns daily.',
        author: 'Savannah Nguyen',
        date: '04-08-2025',
      },
    ],
    alertNotes: [
      {
        id: 'an-1',
        text: 'Patient has a documented allergy to Penicillin, avoid prescribing related antibiotics.',
        visibleAt: 'Scheduling',
        author: 'Esther Howard',
        date: '06-08-2025',
        active: true,
      },
      {
        id: 'an-2',
        text: 'History of suicidal ideation noted; requires close monitoring and safety planning.',
        visibleAt: 'Encounter',
        author: 'Leslie Alexander',
        date: '04-08-2025',
        active: false,
        // Why an inactive alert still shows: it explains a decision someone
        // made, not a thing currently in force. Deleting it would erase the
        // record that the concern was raised and stood down.
        inactiveReason: 'Resolved — safety plan completed, reviewed by Dr. Bianchi on 20-07-2025.',
      },
      {
        id: 'an-3',
        text: 'Patient has missed 3 consecutive appointments, follow-up call recommended.',
        visibleAt: 'Check-In',
        author: 'Theresa Webb',
        date: '04-08-2025',
        active: true,
      },
      {
        id: 'an-4',
        text: 'Insurance coverage expired on last visit; verify updated policy before next appointment.',
        visibleAt: 'Scheduling',
        author: 'Devon Lane',
        date: '04-08-2025',
        active: false,
        inactiveReason: 'Resolved — updated policy on file as of 28-07-2025.',
      },
    ],
  },
};

export const EMPTY_CHART_NOTES = { notes: [], alertNotes: [] };
