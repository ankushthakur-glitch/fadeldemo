/**
 * DEMO DATA for prescriptions. Entirely invented — no real patient
 * information.
 *
 * NO PRESCRIPTION ROW BELOW IS DRAWN ON THE PRESCRIPTIONS SCREEN. Prescribing
 * is not this product's job: that section is the frame the vendor's own
 * e-prescribing UI loads into, and all it takes from this file is
 * SCRIPTSURE_SESSION, which names the vendor. The
 * per-patient records exist for the MEDICATION module, which composes its
 * Active and Past tabs from `active` and `past` — so the chart's own reading
 * of a patient's drugs can be built and reviewed before there is a vendor
 * connected to anything.
 *
 * In production these rows arrive from the prescribing vendor rather than
 * being typed here, which is why the shape stays as it is even though nothing
 * writes to it any more. There is no `pending` list: a queue of scripts
 * composed and not yet signed belongs to the vendor's window alone, this
 * prototype never had one to show, and a script nobody has signed is not a
 * drug the patient is on.
 *
 * Keyed by MRN, like every other per-patient data file in this chart.
 */

/* --- Prescribers. Same three physicians used everywhere else in the demo
   data (data/patients.js clinician field), so a name means the same person
   on every screen. -------------------------------------------------------- */
export const PRESCRIBING_PROVIDERS = ['Dr. A. Mensah', 'Dr. L. Bianchi', 'Dr. S. Nakamura'];

/**
 * How the practice's e-prescribing vendor is named on the Prescriptions
 * screen: in the sentence explaining what the empty frame is waiting for, and
 * as the accessible name of the frame itself.
 *
 * It used to carry the whole tenant identity as well — practice, site, live or
 * sandbox — for a title bar drawn above the frame. That title bar is gone: it
 * was a second heading over a section the module title already names, sitting
 * on top of a window with nothing in it to be titled. Only the two names the
 * screen still says are kept, so nothing here describes markup that no longer
 * exists.
 */
export const SCRIPTSURE_SESSION = {
  vendor: 'ScriptSure',
  product: 'ScriptSure Cloud ePrescribing',
};

/* ============================================================================
   PER-PATIENT RECORDS
   ========================================================================= */

export const CHART_PRESCRIPTIONS = {
  326486: {
    active: [
      {
        id: 'rx-1',
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
