/**
 * DEMO DATA for the Tasks module (chart section "tasks").
 * Entirely invented — no real patient information.
 *
 * THIS IS ONE PATIENT'S WORK, NOT THE PRACTICE'S
 * Task Management (screens/tasks.html) is the whole clinic's queue: every
 * task for every patient, filtered by who owns it. This module is the other
 * cut of the same idea — everything owed on the ONE patient whose chart is
 * open, which is the question asked while you are looking at them.
 *
 * So the vocabularies are imported from data/tasks.js rather than restated:
 * a priority, a status and a recall interval must mean the same thing on both
 * screens, and two lists that agree today drift apart the first time one of
 * them is edited.
 *
 * The rows themselves live here, keyed by MRN, following the same convention
 * as chart-prescriptions.js and chart-documents.js — a module owns its data
 * file so adding one never edits another's.
 *
 * Counts agree with `counts.tasks` in data/patient-chart.js, which is what the
 * sidebar badge reads. Tasks only: a recall is scheduled work the patient does
 * not owe anyone yet, and counting it as an open task would put a 6 on a badge
 * that means "things to do".
 */
export {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  STAFF,
  CURRENT_USER,
  RECALL_STATUSES,
  RECALL_TYPES,
  RECALL_INTERVALS,
  RECALL_PROVIDERS,
  RECALL_LOCATIONS,
} from './tasks.js';

/**
 * Keyed by MRN → { tasks: [...], recalls: [...] }.
 *
 * `due` is the sortable ISO date; the module derives the label from it at
 * render time rather than storing one. A stored "Overdue 2 d" is wrong the
 * day after it is written, and this data outlives any single session.
 */
export const CHART_TASKS = {
  /* Henna West — 4 open tasks, counts.tasks: 4 */
  326486: {
    tasks: [
      {
        id: 'TK-4419',
        subject: 'Pathology result — review with patient',
        detail: '3 specimens, Informed Diagnostics',
        type: 'Result review',
        priority: 'medium',
        assignedTo: 'Dr. A. Mensah',
        from: 'System',
        due: '2026-08-11',
        status: 'open',
      },
      {
        id: 'TK-4407',
        subject: 'Prior authorisation — infliximab',
        detail: 'Northern Plains Health Plan, expires Apr 2027',
        type: 'Prior authorisation',
        priority: 'medium',
        assignedTo: 'K. Brandt, RN',
        from: 'Dr. A. Mensah',
        due: '2026-08-09',
        status: 'in-progress',
      },
      {
        id: 'TK-4396',
        subject: 'Chase outstanding consent form',
        detail: 'Colonoscopy consent not returned',
        type: 'General',
        priority: 'low',
        assignedTo: 'Front desk',
        from: 'S. Okoro',
        due: '2026-08-05',
        status: 'overdue',
      },
      {
        id: 'TK-4388',
        subject: 'Confirm text-reminder preference',
        detail: 'Patient prefers text over calls — update contact record',
        type: 'General',
        priority: 'low',
        assignedTo: 'Front desk',
        from: 'Self',
        due: '2026-08-14',
        status: 'open',
      },
    ],
    recalls: [
      {
        id: 'RC-2288',
        dueFor: 'Colonoscopy — surveillance',
        interval: '3 years',
        provider: 'Dr. A. Mensah',
        location: 'ASC',
        due: '2026-10-23',
        lastContacted: '23 Oct 25',
        status: 'upcoming',
      },
      {
        id: 'RC-2301',
        dueFor: 'Annual wellness visit',
        interval: '1 year',
        provider: 'Dr. A. Mensah',
        location: 'Clinic',
        due: '2026-08-04',
        lastContacted: null,
        status: 'due',
      },
    ],
  },

  /* Natali Craig — counts.tasks: 1 */
  326477: {
    tasks: [
      {
        id: 'TK-4404',
        subject: 'Insurance inactive — verify before next visit',
        detail: 'Eligibility check returned inactive on 04 Aug',
        type: 'Billing',
        priority: 'high',
        assignedTo: 'Billing team',
        from: 'System',
        due: '2026-08-08',
        status: 'open',
      },
    ],
    recalls: [
      {
        id: 'RC-2312',
        dueFor: "EGD — Barrett's surveillance",
        interval: '2 years',
        provider: 'Dr. L. Bianchi',
        location: 'ASC',
        due: '2027-03-02',
        lastContacted: '02 Mar 25',
        status: 'upcoming',
      },
    ],
  },

  /* Liam Rodriguez — counts.tasks: 2 */
  326481: {
    tasks: [
      {
        id: 'TK-4401',
        subject: 'Unsigned note — 3 days',
        detail: 'Clinic visit 02 Aug',
        type: 'Clinical',
        priority: 'medium',
        assignedTo: 'Dr. S. Nakamura',
        from: 'System',
        due: '2026-08-06',
        status: 'overdue',
      },
      {
        id: 'TK-4393',
        subject: 'Records request — release of information',
        detail: 'Sent 22 Jul, no response',
        type: 'Medical records',
        priority: 'low',
        assignedTo: 'S. Schochenmaier',
        from: 'Self',
        due: '2026-08-12',
        status: 'open',
      },
    ],
    recalls: [],
  },

  /* Zoe Tran — counts.tasks: 0. The empty state is a real state, so one
     patient in the demo data has to be in it. */
  326495: { tasks: [], recalls: [] },
};

/** A patient with no row of either kind — also what an unknown MRN gets. */
export const EMPTY_CHART_TASKS = { tasks: [], recalls: [] };
