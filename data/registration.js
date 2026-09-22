/**
 * DEMO DATA for patient registration. Entirely invented — no real PHI, and
 * the payer names are fictional.
 *
 * Three lists, all driven by the registration workflow:
 *   BILLING_GROUPS  → "Assign billing group"
 *   PREFERRED_LABS  → "Pharmacy and preferred lab"
 *   ACCEPTED_PLANS  → "Plan accepted by practice?", the decision the
 *                     eligibility check on the Insurance tab answers
 */

export const BILLING_GROUPS = [
  'GastroEMR GI — Professional',
  'GastroEMR GI — Facility / ASC',
  'GastroEMR GI — Pathology',
  'GastroEMR GI — Anesthesia',
  'Self-pay / Time of service',
];

export const PREFERRED_LABS = [
  'GastroEMR GI in-house lab',
  'LabCorp — Fargo',
  'Quest Diagnostics — Moorhead',
  'Sanford Reference Lab',
  'Mayo Clinic Laboratories',
];

/**
 * Plans the practice contracts with. A carrier that is absent — or one the
 * registrar typed that matches nothing here — is NOT contracted, which is the
 * branch of the workflow where no booking can be taken.
 */
export const ACCEPTED_PLANS = [
  { carrier: 'Northern Plains Health Plan', accepted: true, network: 'In network' },
  { carrier: 'Prairie Mutual', accepted: true, network: 'In network' },
  { carrier: 'Great Lakes Choice', accepted: true, network: 'Out of network' },
  { carrier: 'Medicare Part B', accepted: true, network: 'In network' },
  { carrier: 'ND Medicaid Expansion', accepted: true, network: 'In network' },
  { carrier: 'Summit Bridge PPO', accepted: false, network: 'Not contracted' },
  { carrier: 'Cascade Value HMO', accepted: false, network: 'Not contracted' },
];
