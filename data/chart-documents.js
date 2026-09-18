/**
 * DEMO DATA for the Documents module (chart section "documents").
 * Entirely invented — no real patient information.
 *
 * Keyed by MRN, same convention as chart-notes.js and chart-orders.js: this
 * file is what THIS module needs, kept apart from patient-chart.js (the
 * shell) so the two can change without touching each other.
 *
 * THE COUNTS ARE NOT DECORATION. The sidebar badge reads
 * patient.counts.documents from data/patient-chart.js, so the number of rows
 * here has to match it — 11 / 4 / 2 / 1. A badge that says 11 above a table
 * of three is the kind of detail that makes a reviewer stop trusting every
 * other number on the screen.
 *
 * `size` and `format` are carried even though the reference table does not
 * show them: the row menu offers Preview and Download, and both need to say
 * what the file actually is.
 */

/**
 * The Document Type dropdown.
 *
 * The reference screens are from a behavioural-health product and offer
 * "Progress Note" and "Therapy Note". Those two are kept because the vocabulary
 * was asked for, but the list is a GI clinic's: pathology and endoscopy
 * reports are most of what actually gets filed against a gastroenterology
 * chart, and neither exists in the reference.
 */
export const DOCUMENT_TYPES = [
  'Progress Note',
  'Therapy Note',
  'Intake Form',
  'Consent Form',
  'Referral Letter',
  'Lab Report',
  'Pathology Report',
  'Endoscopy Report',
  'Imaging Report',
  'Discharge Summary',
  'Insurance Card',
  'Correspondence',
  'Other',
];

/** Accepted upload formats, stated once so the modal and the validator agree. */
export const ACCEPTED_FORMATS = '.pdf,.jpg,.jpeg,.png,.svg,.gif';

export const CHART_DOCUMENTS = {
  // Henna West — a long-standing patient with a surveillance history, so the
  // file is thick: two colonoscopies, their pathology, and the paperwork.
  326486: [
    {
      id: 'doc-1',
      name: 'Patient Intake Form',
      type: 'Intake Form',
      format: 'PDF',
      size: '412 KB',
      uploadedBy: 'Ruth Adeyemi',
      date: '06-08-2025',
    },
    {
      id: 'doc-2',
      name: 'Consent for Treatment',
      type: 'Consent Form',
      format: 'PDF',
      size: '188 KB',
      uploadedBy: 'Ruth Adeyemi',
      date: '10-07-2025',
    },
    {
      id: 'doc-3',
      name: 'Colonoscopy Report — 23 Oct 2025',
      type: 'Endoscopy Report',
      format: 'PDF',
      size: '1.2 MB',
      uploadedBy: 'Dr. Amara Mensah',
      date: '23-10-2025',
    },
    {
      id: 'doc-4',
      name: 'Polyp Histology — Sigmoid',
      type: 'Pathology Report',
      format: 'PDF',
      size: '644 KB',
      uploadedBy: 'Northline Pathology',
      date: '29-10-2025',
    },
    {
      id: 'doc-5',
      name: 'Sedation Consent — Colonoscopy',
      type: 'Consent Form',
      format: 'PDF',
      size: '204 KB',
      uploadedBy: 'Ruth Adeyemi',
      date: '22-10-2025',
    },
    {
      id: 'doc-6',
      name: 'Referral — Dr. Osei, Endocrinology',
      type: 'Referral Letter',
      format: 'PDF',
      size: '96 KB',
      uploadedBy: 'Dr. Amara Mensah',
      date: '14-11-2025',
    },
    {
      id: 'doc-7',
      name: 'HbA1c and Lipid Panel',
      type: 'Lab Report',
      format: 'PDF',
      size: '318 KB',
      uploadedBy: 'LabCorp',
      date: '02-12-2025',
    },
    {
      id: 'doc-8',
      name: 'Insurance Card — Front and Back',
      type: 'Insurance Card',
      format: 'JPG',
      size: '2.4 MB',
      uploadedBy: 'Ruth Adeyemi',
      date: '06-08-2025',
    },
    {
      id: 'doc-9',
      name: 'CT Abdomen and Pelvis — Report',
      type: 'Imaging Report',
      format: 'PDF',
      size: '890 KB',
      uploadedBy: 'Arvada Imaging',
      date: '18-01-2026',
    },
    {
      id: 'doc-10',
      name: 'Bowel Prep Instructions — Signed',
      type: 'Correspondence',
      format: 'PDF',
      size: '142 KB',
      uploadedBy: 'Ruth Adeyemi',
      date: '19-10-2025',
    },
    {
      id: 'doc-11',
      name: 'Post-Polypectomy Discharge Summary',
      type: 'Discharge Summary',
      format: 'PDF',
      size: '256 KB',
      uploadedBy: 'Dr. Amara Mensah',
      date: '23-10-2025',
    },
  ],

  326477: [
    {
      id: 'doc-1',
      name: 'Patient Intake Form',
      type: 'Intake Form',
      format: 'PDF',
      size: '398 KB',
      uploadedBy: 'Front Desk — Fargo',
      date: '19-10-2025',
    },
    {
      id: 'doc-2',
      name: 'Self-Pay Agreement — Out of Network',
      type: 'Consent Form',
      format: 'PDF',
      size: '176 KB',
      uploadedBy: 'Sam Okoro',
      date: '21-10-2025',
    },
    {
      id: 'doc-3',
      name: 'Liver Function Tests',
      type: 'Lab Report',
      format: 'PDF',
      size: '286 KB',
      uploadedBy: 'LabCorp',
      date: '24-10-2025',
    },
    {
      id: 'doc-4',
      name: 'Referral from Dr. Whitfield',
      type: 'Referral Letter',
      format: 'PDF',
      size: '112 KB',
      uploadedBy: 'Front Desk — Fargo',
      date: '11-10-2025',
    },
  ],

  326481: [
    {
      id: 'doc-1',
      name: 'Advance Directive — DNR',
      type: 'Consent Form',
      format: 'PDF',
      size: '224 KB',
      uploadedBy: 'Front Desk — Bismarck',
      date: '17-10-2025',
    },
    {
      id: 'doc-2',
      name: 'Interpreter Request — Spanish',
      type: 'Correspondence',
      format: 'PDF',
      size: '88 KB',
      uploadedBy: 'Front Desk — Bismarck',
      date: '17-10-2025',
    },
  ],

  326495: [
    {
      id: 'doc-1',
      name: 'Guardian Consent — Celiac Panel',
      type: 'Consent Form',
      format: 'PDF',
      size: '198 KB',
      uploadedBy: 'Front Desk — Bismarck',
      date: '02-01-2026',
    },
  ],
};

/** A patient with nothing on file still has to render a table. */
export const EMPTY_CHART_DOCUMENTS = [];
