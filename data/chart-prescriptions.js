/**
 * DEMO DATA for prescriptions. Entirely invented — no real patient
 * information.
 *
 * Two screens read this file. The PRESCRIPTIONS module lists every row in it,
 * active and past together, and its Add Prescription dialog appends to
 * `active`. The MEDICATION module composes its Active and Past tabs from the
 * same two lists, so a script written on one screen is on the other the moment
 * it is sent, without a second copy to fall out of step.
 *
 * ONE PRESCRIPTION, SEVERAL ROWS. A row here is one medication. A prescription
 * — one prescriber, one pharmacy, sent at one time — can carry several, and the
 * rows it produced share an `rxNumber`. That is how a pharmacy receives them
 * too: each drug is its own line to fill, under one order. Keeping the row at
 * the level of the drug means Medication can go on reading it as a drug the
 * patient is on, which is what that list is for.
 *
 * Sent scripts live in memory for the session and are gone on reload; there is
 * no backend and no pharmacy on the other end of Send.
 *
 * Keyed by MRN, like every other per-patient data file in this chart.
 */

/* --- Prescribers. Same three physicians used everywhere else in the demo
   data (data/patients.js clinician field), so a name means the same person
   on every screen. -------------------------------------------------------- */
export const PRESCRIBING_PROVIDERS = ['Dr. A. Mensah', 'Dr. L. Bianchi', 'Dr. S. Nakamura'];

/* ============================================================================
   PER-PATIENT RECORDS
   ========================================================================= */

export const CHART_PRESCRIPTIONS = {
  326486: {
    active: [
      {
        id: 'rx-1',
        rxNumber: 'RX-10421',
        pharmacy: 'CVS Pharmacy #4471 — Fargo, ND',
        name: 'Lorazepam 1mg tablet',
        sig: '1 tablet orally twice daily',
        diagnosis: 'Dx1: F41.1 — Generalized anxiety disorder',
        dispenseQty: 30,
        dispenseUnit: 'Tablet',
        daysSupply: 16,
        dispensingCount: 4,
        startDate: '05-10-2025',
        endDate: '05-10-2026',
        provider: 'Dr. A. Mensah',
      },
      {
        id: 'rx-2',
        rxNumber: 'RX-10433',
        pharmacy: 'CVS Pharmacy #4471 — Fargo, ND',
        name: 'Sertraline 50mg tablet',
        sig: '1 tablet orally twice daily',
        diagnosis: 'Dx1: F41.1 — Generalized anxiety disorder',
        dispenseQty: 30,
        dispenseUnit: 'Tablet',
        daysSupply: 20,
        dispensingCount: 2,
        startDate: '07-10-2025',
        endDate: '07-10-2026',
        provider: 'Dr. A. Mensah',
      },
      {
        id: 'rx-3',
        rxNumber: 'RX-10427',
        pharmacy: 'CVS Pharmacy #4471 — Fargo, ND',
        name: 'Hydroxyzine 25mg Tablet',
        sig: '1 tablet orally twice daily',
        diagnosis: 'Dx1: F41.1 — Generalized anxiety disorder',
        dispenseQty: 30,
        dispenseUnit: 'Tablet',
        daysSupply: 30,
        dispensingCount: 1,
        startDate: '06-10-2025',
        endDate: '06-10-2026',
        provider: 'Dr. L. Bianchi',
      },
    ],
    past: [
      {
        id: 'rx-past-1',
        rxNumber: 'RX-10102',
        pharmacy: 'CVS Pharmacy #4471 — Fargo, ND',
        name: 'Omeprazole 20mg capsule',
        sig: '1 capsule orally once daily before breakfast',
        diagnosis: 'Dx1: K21.9 — GERD, without esophagitis',
        dispenseQty: 90,
        dispenseUnit: 'Capsule',
        daysSupply: 90,
        dispensingCount: 3,
        startDate: '01-01-2025',
        endDate: '01-04-2025',
        provider: 'Dr. S. Nakamura',
        status: 'Completed',
      },
      {
        id: 'rx-past-2',
        rxNumber: 'RX-10088',
        pharmacy: 'CVS Pharmacy #4471 — Fargo, ND',
        name: 'Metronidazole 400mg tablet',
        sig: '1 tablet orally three times daily',
        diagnosis: 'Dx1: K29.70 — Gastritis, unspecified',
        dispenseQty: 21,
        dispenseUnit: 'Tablet',
        daysSupply: 7,
        dispensingCount: 1,
        startDate: '10-11-2024',
        endDate: '17-11-2024',
        provider: 'Dr. A. Mensah',
        status: 'Discontinued',
      },
    ],
  },

  /* Natali Craig — a shorter history, so a second chart shows the Medication
     module's Active and Past tabs with something on both without repeating
     Henna's list. One course finished, one script running. */
  326477: {
    active: [
      {
        id: 'rx-nc-1',
        rxNumber: 'RX-10512',
        pharmacy: 'Walgreens #10392 — West Fargo, ND',
        name: 'Mesalamine 1.2g tablet',
        sig: '2 tablets orally once daily with food',
        diagnosis: 'Dx1: K51.90 — Ulcerative colitis, unspecified',
        dispenseQty: 60,
        dispenseUnit: 'Tablet',
        daysSupply: 30,
        dispensingCount: 5,
        startDate: '12-02-2026',
        endDate: '12-02-2027',
        provider: 'Dr. S. Nakamura',
      },
    ],
    past: [
      {
        id: 'rx-nc-past-1',
        rxNumber: 'RX-10467',
        pharmacy: 'Walgreens #10392 — West Fargo, ND',
        name: 'Prednisone 20mg tablet',
        sig: '1 tablet orally once daily, tapering',
        diagnosis: 'Dx1: K51.90 — Ulcerative colitis, unspecified',
        dispenseQty: 30,
        dispenseUnit: 'Tablet',
        daysSupply: 30,
        dispensingCount: 1,
        startDate: '05-01-2026',
        endDate: '04-02-2026',
        provider: 'Dr. S. Nakamura',
        status: 'Completed',
      },
    ],
  },
};

export const EMPTY_CHART_PRESCRIPTIONS = { active: [], past: [] };

/* ============================================================================
   WHAT ADD PRESCRIPTION OFFERS

   A plausible handful for a gastroenterology practice, not a drug database.
   The medication and directions boxes take anything typed as well, so a drug
   that is not on this list can still be written.
   ========================================================================= */

/* Drug, strength and form in one string, the way a script names it and the
   way the Medication list reads it back. */
export const RX_DRUG_CATALOG = [
  'Omeprazole 20mg capsule',
  'Pantoprazole 40mg tablet',
  'Famotidine 20mg tablet',
  'Ondansetron 4mg tablet',
  'Dicyclomine 20mg tablet',
  'Mesalamine 1.2g tablet',
  'Budesonide 9mg tablet',
  'Rifaximin 550mg tablet',
  'Ursodiol 300mg capsule',
  'Polyethylene glycol 3350 17g powder',
  'Sucralfate 1g tablet',
  'Metronidazole 400mg tablet',
];

/* Common directions, offered rather than enforced: a sig is free text on
   every real script, and a closed list would make the unusual one unsayable. */
export const RX_SIG_PRESETS = [
  '1 tablet orally once daily',
  '1 tablet orally twice daily',
  '1 capsule orally once daily before breakfast',
  '1 tablet orally three times daily',
  '1 tablet orally every 8 hours as needed for nausea',
  '17g in 8oz water orally once daily',
];

export const RX_DISPENSE_UNITS = ['Tablet', 'Capsule', 'Packet', 'Bottle', 'mL'];

export const RX_REFILLS = ['0', '1', '2', '3', '5', '11'];

export const RX_PHARMACIES = [
  'CVS Pharmacy #4471 — Fargo, ND',
  'Walgreens #10392 — West Fargo, ND',
  'Thrifty White Pharmacy — Moorhead, MN',
  'Express Scripts Mail Order',
];
