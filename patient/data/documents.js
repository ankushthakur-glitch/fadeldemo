/**
 * Documents.
 *
 * A mutable array, unlike the other fixtures: the Upload Document modal
 * actually adds a row. A dialog that validates, closes and changes nothing
 * cannot be reviewed — you learn whether the FORM is right but not whether
 * the outcome lands anywhere legible.
 *
 * The addition lasts for the page view and no longer. Persisting it to
 * localStorage would leave a reviewer's third upload sitting in the table a
 * week later with no way to tell where it came from.
 */

export const CATEGORIES = [
  'Intake Form',
  'Consent Form',
  'Uploaded Document',
  'Insurance Card',
  'Referral Letter',
];

export const DOCUMENTS = [
  {
    id: 'doc-intake',
    name: 'Intake Form',
    category: 'Intake Form',
    provider: 'Arlene McCoy',
    received: '2/11/2026',
    ends: '2/21/2026',
  },
  {
    id: 'doc-consent',
    name: 'Patient Consent Form',
    category: 'Consent Form',
    provider: 'Cameron Williamson',
    received: '8/21/2026',
    ends: '9/21/2026',
  },
  {
    id: 'doc-questionnaire',
    name: 'Intake Form (Questionnaire)',
    category: 'Intake Form',
    provider: 'Leslie Alexander',
    received: '4/4/2026',
    ends: '5/4/2026',
  },
  {
    id: 'doc-exam-3',
    name: 'Physical Exam Form 3',
    category: 'Uploaded Document',
    provider: 'Jenny Wilson',
    received: '8/30/2026',
    ends: '9/30/2026',
  },
  {
    id: 'doc-exam-2',
    name: 'Physical Exam Form 2',
    category: 'Uploaded Document',
    provider: 'Devon Lane',
    received: '1/15/2026',
    ends: '3/15/2026',
  },
];

/** Newest at the top, which is where someone looks for what they just added. */
export function addDocument(entry) {
  DOCUMENTS.unshift(entry);
  return entry;
}
