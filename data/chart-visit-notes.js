/**
 * DEMO DATA for the Visit Notes module (chart section "visit-notes").
 * Entirely invented — no real patient information.
 *
 * Keyed by MRN, same convention as chart-notes.js / chart-orders.js. Row
 * counts match each patient's patient-chart.js `counts.visitNotes` badge,
 * and the clinical detail (provider, reason) lines up with what is already
 * on record for that patient elsewhere in the chart (activity.lastVisitDate,
 * activity.lastEncounterType, profile-clinical.js's problem list) rather
 * than inventing an unrelated visit history.
 *
 * appointmentStatus: 'Completed' | 'No Show' | 'Pending'
 * billStatus: 'Paid' | 'Pending' | 'Overdue' | 'Cancelled' | null (— dash,
 *   nothing billable yet — e.g. a pending appointment)
 */

export const CHART_VISIT_NOTES = {
  // Henna West — 3 visits, matching counts.visitNotes: 3. Newest first.
  326486: [
    {
      id: 'vn-1',
      date: '23-10-2025',
      time: '12:00 PM',
      provider: 'Dr. Amara Mensah',
      type: 'Follow Up',
      reason: 'Surveillance colonoscopy',
      appointmentStatus: 'Completed',
      billStatus: 'Paid',
    },
    {
      id: 'vn-2',
      date: '04-09-2025',
      time: '09:30 AM',
      provider: 'Dr. Amara Mensah',
      type: 'Follow Up',
      reason: 'GERD and Type 2 diabetes review',
      appointmentStatus: 'Completed',
      billStatus: 'Pending',
    },
    {
      id: 'vn-3',
      date: '18-09-2025',
      time: '02:15 PM',
      provider: 'Dr. Amara Mensah',
      type: 'New',
      reason: 'Diverticulosis — new referral',
      appointmentStatus: 'No Show',
      billStatus: 'Cancelled',
    },
  ],

  // Natali Craig — 1 visit, matching counts.visitNotes: 1.
  326477: [
    {
      id: 'vn-1',
      date: '19-10-2025',
      time: '10:15 AM',
      provider: 'Dr. Luca Bianchi',
      type: 'New',
      reason: 'New patient consult — hepatology',
      appointmentStatus: 'Completed',
      billStatus: 'Overdue',
    },
  ],

  // Liam Rodriguez — 0 visits, matching counts.visitNotes: 0.
  326481: [],

  // Zoe Tran — 1 visit, matching counts.visitNotes: 1.
  326495: [
    {
      id: 'vn-1',
      date: '02-01-2026',
      time: '09:00 AM',
      provider: 'Dr. Sana Nakamura',
      type: 'Follow Up',
      reason: 'Celiac disease — EGD follow-up',
      appointmentStatus: 'Pending',
      billStatus: null,
    },
  ],
};

export const EMPTY_CHART_VISIT_NOTES = [];
