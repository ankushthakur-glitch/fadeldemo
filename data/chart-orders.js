/**
 * DEMO DATA for the Orders module (chart section "orders").
 * Entirely invented — no real patient information.
 *
 * Prescriptions moved out to data/chart-prescriptions.js — see that file's
 * header for why. What is left here is everything else a provider orders
 * against a chart that is not a prescription, in the four groups asked for
 * in the 2026-08 design review:
 *
 *   labs        master/detail: a card list on the left (this is a list you
 *               navigate THROUGH to a detail, not a worklist grid, so it
 *               stays plain markup rather than a data table), a
 *               report/requisition viewer on the right with its own
 *               prev/next and a small results table.
 *   imaging     X-Ray, CT, MRI, ultrasound and mammography orders — a
 *               worklist grid with Add / Edit / Mark Completed / Cancel /
 *               Delete, same CRUD shape as Prescriptions.
 *   nonVisit    telephone orders, verbal orders, standing orders and
 *               portal/remote orders — anything ordered outside a booked
 *               visit. Simplest of the four: a description and an
 *               open/completed/cancelled status, no scheduling of its own.
 *
 * Keyed by MRN, same convention as chart-notes.js and chart-documents.js.
 */

/* --- Ordering providers. Same three physicians used everywhere else in the
   demo data, so a name means the same person on every screen. ------------ */
export const PRESCRIBING_PROVIDERS = ['Dr. A. Mensah', 'Dr. L. Bianchi', 'Dr. S. Nakamura'];

/* --- Labs -------------------------------------------------------------- */

export const LAB_VENDORS = [
  'MediNova GI in-house lab',
  'LabCorp — Fargo',
  'Quest Diagnostics — Moorhead',
  'Sanford Reference Lab',
];

export const LAB_TEST_CATALOG = [
  'Full Body Blood Test',
  'Basic Metabolic Panel',
  'Complete Blood Count',
  'Liver Function Panel',
  'Lipid Panel',
  'H. pylori Antibody Test',
  'Online NCT',
  'In-Person NCT',
];

export const ICD_CODES = [
  'K21.9 — GERD, without esophagitis',
  'K58.0 — IBS with diarrhoea',
  'K29.70 — Gastritis, unspecified',
  'E66.9 — Obesity, unspecified',
  'Z12.11 — Screening for colon cancer',
];

export const LAB_STATUS = {
  ordered: { label: 'Ordered', tone: 'warning' },
  received: { label: 'Received', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'critical' },
};

/* --- Imaging / X-Ray ----------------------------------------------------- */

export const IMAGING_MODALITIES = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography'];

export const IMAGING_FACILITIES = [
  'MediNova Imaging Center',
  'Sanford Radiology — Fargo',
  'Essentia Health Imaging',
];

export const IMAGING_PRIORITIES = ['Routine', 'STAT'];

export const IMAGING_STATUS = {
  ordered: { label: 'Ordered', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'critical' },
};

/* --- Referrals ------------------------------------------------------------ */

/* NO REFERRAL VOCABULARIES. The chart's Referrals tab has gone (see
   js/screens/chart-orders.js): a referral is raised, packeted, faxed, chased
   and answered on the Referrals screen, which owns its own specialty list,
   urgency and status set. Two vocabularies for one thing is how the chart came
   to call a referral "declined" while the Referrals screen called the same
   record "rejected". */


/* --- Non-Visit Orders -------------------------------------------------------
   Telephone orders, verbal orders taken at the desk, standing orders, and
   orders placed remotely through the portal — anything ordered outside a
   booked, in-person visit. ---------------------------------------------- */

export const NON_VISIT_TYPES = [
  'Telephone Order',
  'Verbal Order',
  'Standing Order',
  'Remote / Portal Order',
];

export const NON_VISIT_STATUS = {
  open: { label: 'Open', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'critical' },
};

/* ============================================================================
   PER-PATIENT RECORDS
   ========================================================================= */

export const CHART_ORDERS = {
  326486: {
    labs: [
      {
        id: 'lab-1',
        name: 'Full Body Blood Test',
        status: 'received',
        orderedOn: '24-10-2025',
        orderedBy: 'Dr. A. Mensah',
        receivedOn: '27-10-2025',
        icdCode: 'K21.9 — GERD, without esophagitis',
        vendor: 'MediNova GI in-house lab',
        patientInstruction: 'Fast for 8 hours before the draw. Water is fine.',
        report: {
          number: 'VS789012',
          clinic: 'MediNova Gastroenterology Clinic',
          age: 65,
          gender: 'Female',
          existingConditions: 'Hypertension, Type 2 diabetes',
          collectionDate: '25 Oct 2025',
          receivedDate: '25 Oct 2025',
          reportDate: '27 Oct 2025',
          sampleId: 'VS-2025-789012',
          panelTitle: 'Blood Chemistry Panel',
          rows: [
            { category: 'Glucose', result: '95 mg/dL', range: '70 – 100 mg/dL' },
            { category: 'Sodium', result: '142 mEq/L', range: '136 – 145 mEq/L' },
            { category: 'Potassium', result: '4.1 mEq/L', range: '3.5 – 5.0 mEq/L' },
            { category: 'Chloride', result: '101 mEq/L', range: '98 – 107 mEq/L' },
            { category: 'ALT', result: '22 U/L', range: '10 – 40 U/L', outOfRange: false },
            { category: 'Creatinine', result: '1.4 mg/dL', range: '0.6 – 1.3 mg/dL', outOfRange: true },
          ],
        },
      },
      {
        id: 'lab-2',
        name: 'Online NCT',
        status: 'ordered',
        orderedOn: '24-10-2025',
        orderedBy: 'Dr. A. Mensah',
        receivedOn: null,
        icdCode: 'Z12.11 — Screening for colon cancer',
        vendor: 'LabCorp — Fargo',
        patientInstruction: 'Complete the at-home collection kit and return within 48 hours.',
        report: null,
      },
      {
        id: 'lab-3',
        name: 'In-Person NCT',
        status: 'received',
        orderedOn: '24-10-2025',
        orderedBy: 'Dr. L. Bianchi',
        receivedOn: '26-10-2025',
        icdCode: 'Z12.11 — Screening for colon cancer',
        vendor: 'MediNova GI in-house lab',
        patientInstruction: 'No special preparation needed.',
        report: {
          number: 'VS789015',
          clinic: 'MediNova Gastroenterology Clinic',
          age: 65,
          gender: 'Female',
          existingConditions: 'Hypertension, Type 2 diabetes',
          collectionDate: '26 Oct 2025',
          receivedDate: '26 Oct 2025',
          reportDate: '26 Oct 2025',
          sampleId: 'VS-2025-789015',
          panelTitle: 'Faecal Immunochemical Test',
          rows: [{ category: 'Occult blood', result: 'Negative', range: 'Negative' }],
        },
      },
      {
        id: 'lab-4',
        name: 'Full Body Blood Test',
        status: 'ordered',
        orderedOn: '24-10-2025',
        orderedBy: 'Dr. A. Mensah',
        receivedOn: null,
        icdCode: 'E66.9 — Obesity, unspecified',
        vendor: 'MediNova GI in-house lab',
        patientInstruction: 'Fast for 8 hours before the draw. Water is fine.',
        report: null,
      },
    ],

    imaging: [
      {
        id: 'img-1',
        modality: 'CT Scan',
        bodyPart: 'Abdomen and Pelvis, with contrast',
        priority: 'Routine',
        status: 'scheduled',
        orderedOn: '20-10-2025',
        orderedBy: 'Dr. A. Mensah',
        facility: 'MediNova Imaging Center',
        scheduledOn: '11-11-2025',
        indication: 'K21.9 — GERD, without esophagitis',
        findings: '',
      },
      {
        id: 'img-2',
        modality: 'X-Ray',
        bodyPart: 'Chest, 2 views',
        priority: 'STAT',
        status: 'completed',
        orderedOn: '12-10-2025',
        orderedBy: 'Dr. S. Nakamura',
        facility: 'Sanford Radiology — Fargo',
        scheduledOn: '12-10-2025',
        indication: 'Pre-procedure clearance',
        findings: 'No acute cardiopulmonary process. Lungs clear.',
      },
    ],

    nonVisit: [
      {
        id: 'nv-1',
        type: 'Telephone Order',
        description: 'Patient called reporting nausea after Sertraline dose increase — hold at current dose.',
        orderedOn: '26-10-2025',
        orderedBy: 'Dr. A. Mensah',
        status: 'completed',
      },
      {
        id: 'nv-2',
        type: 'Remote / Portal Order',
        description: 'Portal message: refill request for Lorazepam ahead of travel — approved for 30 days.',
        orderedOn: '24-10-2025',
        orderedBy: 'Dr. A. Mensah',
        status: 'open',
      },
    ],
  },
};

export const EMPTY_CHART_ORDERS = { labs: [], imaging: [], nonVisit: [] };
