/**
 * The one copy of the booked appointments.
 *
 * WHY THIS EXISTS
 * Each screen used to take its own private copy of APPOINTMENTS, so a booking
 * made on the scheduler did not exist anywhere else: opening check-in for it
 * found nothing, and a reload threw it away. The prototype has no backend, but
 * "no backend" should not mean "no memory" — the desk books a procedure and
 * walks the patient through check-in seconds later, and that has to work.
 *
 * sessionStorage rather than localStorage on purpose: the demo data should
 * come back fresh in a new tab, not carry one reviewer's edits into the next
 * person's session.
 */
import { APPOINTMENTS } from './schedule.js';

const KEY = 'medinova.appointments';

/** A fresh copy of the seed data, so the module-level array is never mutated. */
const seed = () => APPOINTMENTS.map((a) => ({ ...a }));

/**
 * Storage can throw — private browsing, a full quota, or a file:// page with
 * no origin to key on. None of those should stop the screen loading, so every
 * failure falls back to the seed and the prototype behaves as it always did.
 */
export function loadAppointments() {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* fall through to the seed */
  }
  return seed();
}

export function saveAppointments(list) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* nothing to do — the screen keeps working from memory */
  }
}

/** Used by the check-in screen, which only ever reads one booking. */
export function findAppointment(id) {
  return loadAppointments().find((a) => a.id === id) ?? null;
}

/**
 * Change one booking in place.
 *
 * Check-in and the encounter both need to move a single appointment on —
 * checked in, checked out — without holding the whole list.
 */
export function updateAppointment(id, patch) {
  const list = loadAppointments();
  const appointment = list.find((a) => a.id === id);
  if (!appointment) return null;
  Object.assign(appointment, patch);
  saveAppointments(list);
  return appointment;
}
