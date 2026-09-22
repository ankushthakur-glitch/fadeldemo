/**
 * DEMO DATA for the Triage drawer — Scheduler's "Start Triage" action on a
 * checked-in Clinical appointment. Entirely invented — no real patient
 * information.
 *
 * Field shape and units match the reference "Triage" screens supplied for
 * this build, including Body Mass Index's unit ("%") — the reference's own
 * choice, not the clinical unit (kg/m²), but this prototype follows what was
 * handed to it rather than correcting it.
 *
 * No Assessments/Screening field here on purpose — the brief this shipped
 * against explicitly left it out.
 */

/** This prototype has no per-visit note-template selection before the
 *  encounter opens — every Clinical triage uses the same default the
 *  encounter's own template picker defaults to. */
export const TRIAGE_NOTE_TYPE = 'SOAP Note';

/*
 * THE STAND-IN HANDOVER IS GONE, AND SO IS THE BAND THAT READ IT.
 *
 * There was a TRIAGE_HANDOVER here: the wording of an unremarkable pass, which
 * the procedure encounter drew in a tinted band at the top of the work column
 * whenever the booking carried no pass of its own — which the fixture bookings
 * never do, they being a day's diary rather than a day's work.
 *
 * That band is gone. It said the obs were unremarkable and the medication list
 * had been checked, on nearly every case it appeared on, and a band that is
 * almost always skipped trains the eye to skip the place a real warning lands
 * in. A real pass saved from the scheduler is still written onto the
 * appointment (`appt.triage`, see saveTriage in js/screens/scheduler.js) and is
 * still read by everything that reads the booking; what went was the invented
 * one and the banner that existed to show it off.
 */

/**
 * The vitals a nurse takes, in the order the grid prints them.
 *
 * Three things beyond the label and the unit, all of them there so the grid
 * can be read and filled without anyone explaining it first:
 *
 *   `short`        how the value is named in the one-line summary the section
 *                  shows while it is collapsed ("BP 120/80 · HR 72"). The full
 *                  label is far too long to put seven of on one line.
 *   `placeholder`  a specimen reading. "120/80" in the box answers the
 *                  question an empty box asks — one number or two, and with
 *                  what between them — before the nurse has to guess it.
 *   `computed`     the field is derived from other fields rather than typed.
 *                  Only BMI is: height and weight already say what it is, and
 *                  a number a person can arrive at two ways is a number two
 *                  people will disagree about.
 */
export const TRIAGE_VITALS_FIELDS = [
  { key: 'bp', label: 'Blood Pressure', short: 'BP', unit: 'mmHg', placeholder: '120/80' },
  { key: 'heartRate', label: 'Heart Rate', short: 'HR', unit: 'bpm', placeholder: '72' },
  { key: 'temperature', label: 'Temperature', short: 'Temp', unit: '°F', placeholder: '98.6' },
  { key: 'respRate', label: 'Respiratory Rate', short: 'Resp', unit: 'bpm', placeholder: '16' },
  /* Pain is the one reading here the patient supplies rather than the nurse
     measures, and the only one whose unit is a scale rather than a quantity.
     It is no longer drawn as one of these boxes — the drawer lays its eleven
     values out as a ramp under the grid (see triagePainScale in
     js/screens/scheduler.js) — but it stays on this list because the list is
     what a saved triage is read and written through, and a vital that left it
     would stop being collected at all. `unit` and `placeholder` are what the
     grid would print if it ever drew this field again.
     Not `computed`: nothing else on this list implies it. */
  { key: 'painScore', label: 'Pain Score', short: 'Pain', unit: '0-10', placeholder: '0' },
  { key: 'weight', label: 'Weight', short: 'Wt', unit: 'Kg', placeholder: '70' },
  { key: 'height', label: 'Height', short: 'Ht', unit: 'Cm', placeholder: '170' },
  { key: 'bmi', label: 'Body Mass Index', short: 'BMI', unit: '%', placeholder: '—', computed: true },
];
