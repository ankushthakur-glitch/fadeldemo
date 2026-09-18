/**
 * DEMO DATA for the Vitals module (chart section "vitals").
 * Entirely invented — no real patient information.
 *
 * Keyed by MRN, same convention as chart-notes.js / chart-orders.js.
 *
 * Newest first, by construction — the array order IS the display order, the
 * same rule Notes and Alerts use, so there is nothing to re-sort at render
 * time.
 *
 * Each entry's `notes` describes THAT row's own numbers. The reference
 * screens this module was built from had note text that quoted different
 * figures than the row it sat under — a copy/paste artefact in their mock,
 * not a real behaviour to reproduce. Every value below is self-consistent.
 */
export const CHART_VITALS = {
  326486: [
    {
      id: 'vt-1',
      date: '20-07-2025',
      time: '02:34 am',
      height: 68,
      weight: 175,
      bmi: 26.6,
      bloodPressure: '118/76',
      pulse: 76,
      notes: {
        height: 'Height recorded at 68 in (173 cm). No significant change from previous visit.',
        weight: 'Weight measured at 175 lb (79.4 kg). Stable since last assessment.',
        bmi: 'BMI calculated at 26.6 kg/m², indicating the patient is in the overweight category. Lifestyle modifications discussed.',
        bloodPressure: 'Blood pressure recorded at 118/76 mmHg while seated. Reading within normal limits. Patient denied dizziness, headaches, or visual disturbances.',
        pulse: 'Pulse measured at 76 bpm, regular rhythm, normal rate and intensity. No palpitations reported.',
      },
    },
    {
      id: 'vt-2',
      date: '15-04-2025',
      time: '04:15 am',
      height: 68,
      weight: 175,
      bmi: 27.1,
      bloodPressure: '122/80',
      pulse: 72,
      notes: {
        height: 'Height recorded at 68 in (173 cm). Unchanged.',
        weight: 'Weight measured at 175 lb (79.4 kg).',
        bmi: 'BMI calculated at 27.1 kg/m² — overweight category.',
        bloodPressure: 'Blood pressure recorded at 122/80 mmHg while seated. Within normal limits.',
        pulse: 'Pulse measured at 72 bpm, regular rhythm.',
      },
    },
  ],
};

export const EMPTY_CHART_VITALS = [];
