/**
 * DEMO DATA — every entry below is invented. No real access ever happened.
 *
 * THE AUDIT LOG
 * Who did what, to whose record, from where, and whether the system let them.
 * An EHR is required to keep this and a practice is required to be able to
 * produce it — for a records request, a breach investigation, or the question
 * a patient is entitled to ask: who has read my chart?
 *
 * TWO RULES SHAPE EVERYTHING HERE
 *
 * 1. APPEND-ONLY. Entries are written, never edited or deleted. There is no
 *    row action that changes one, and there is no status a person can set. A
 *    log somebody can tidy is not evidence of anything.
 *
 * 2. AN ENTRY MUST BE READABLE ON ITS OWN. Six months later the account may be
 *    deactivated, renamed, or have a different role. So the actor's name and
 *    their role AT THE TIME are copied onto the entry rather than looked up
 *    from the user directory when the log is read.
 *
 * The roster is taken from Settings ▸ Practice ▸ Users and the patients from
 * the directory, so a name in the log is a name in the system rather than a
 * second cast invented for this screen.
 *
 * Nothing is random: a reviewer who reloads has to see the same history, or
 * "the entry I was reading moved" becomes a bug report.
 */
import { USERS } from './practice.js';
import { DIRECTORY } from './directory.js';

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** How far back the demo history runs. */
const DAYS_OF_HISTORY = 14;

/* ============================================================================
   VOCABULARY

   Category is the coarse cut a compliance officer filters by first — "show me
   everything anyone read" — and event is the specific thing that happened.
   Tones come from the shared status palette: PHI Write and Security are the
   two that must never be scanned past.
   ========================================================================= */

export const AUDIT_CATEGORIES = {
  auth: { label: 'Auth', tone: 'info' },
  phiRead: { label: 'PHI Read', tone: 'warning' },
  phiWrite: { label: 'PHI Write', tone: 'brand' },
  admin: { label: 'Admin', tone: 'neutral' },
  export: { label: 'Export', tone: 'warning' },
  security: { label: 'Security', tone: 'critical' },
};

export const AUDIT_OUTCOMES = {
  success: { label: 'Success', tone: 'success' },
  failure: { label: 'Failure', tone: 'critical' },
  denied: { label: 'Denied', tone: 'warning' },
};

/**
 * `phi` marks the events that touch a patient's record — those carry a patient
 * and an MRN, and the rest do not. A sign-in is not an access to anybody's
 * chart, and filing one against a patient would put a name in front of a
 * reader that the event never actually involved.
 */
export const AUDIT_EVENTS = [
  { id: 'login-success', label: 'Login Success', category: 'auth' },
  { id: 'login-failed', label: 'Login Failed', category: 'auth', outcome: 'failure' },
  { id: 'logout', label: 'Logout', category: 'auth' },
  { id: 'password-changed', label: 'Password Changed', category: 'auth' },
  { id: 'patient-searched', label: 'Patient Searched', category: 'phiRead', phi: true },
  { id: 'patient-viewed', label: 'Patient Viewed', category: 'phiRead', phi: true },
  { id: 'chart-section-viewed', label: 'Chart Section Viewed', category: 'phiRead', phi: true },
  { id: 'document-opened', label: 'Document Opened', category: 'phiRead', phi: true },
  { id: 'note-signed', label: 'Note Signed', category: 'phiWrite', phi: true },
  { id: 'order-placed', label: 'Order Placed', category: 'phiWrite', phi: true },
  { id: 'medication-prescribed', label: 'Medication Prescribed', category: 'phiWrite', phi: true },
  { id: 'demographics-updated', label: 'Demographics Updated', category: 'phiWrite', phi: true },
  { id: 'claim-submitted', label: 'Claim Submitted', category: 'phiWrite', phi: true },
  { id: 'record-exported', label: 'Record Exported', category: 'export', phi: true },
  { id: 'report-exported', label: 'Report Exported', category: 'export' },
  { id: 'audit-log-exported', label: 'Audit Log Exported', category: 'export' },
  { id: 'permission-changed', label: 'Permission Changed', category: 'admin' },
  { id: 'user-deactivated', label: 'User Deactivated', category: 'admin' },
  { id: 'settings-changed', label: 'Settings Changed', category: 'admin' },
  { id: 'access-denied', label: 'Access Denied', category: 'security', outcome: 'denied', phi: true },
  { id: 'break-glass', label: 'Break-the-Glass Access', category: 'security', phi: true },
];

export const EVENT_INDEX = Object.fromEntries(AUDIT_EVENTS.map((e) => [e.id, e]));

/* ============================================================================
   WHO IS IN THE LOG

   Active accounts only: an account that has never signed in has never done
   anything to record. The username is what the system authenticated; the
   person's name is what a reader recognises. Both are kept because a
   deactivated account keeps its username long after the name stops appearing
   in any directory.
   ========================================================================= */

export const AUDIT_ACTORS = [
  { id: 'u0', username: 'amensah', name: 'Amara Mensah', role: 'Practice Admin' },
  ...USERS.filter((u) => u.status === 'active')
    .slice(0, 7)
    .map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role })),
];

/** A service account, because integrations act too — and an audit log that
 *  only records humans cannot answer "what posted these remits at 2am?". */
const INTEGRATION = { id: 'svc-ch', username: 'svc.clearinghouse', name: 'Clearing house integration', role: 'Integration' };

const ACTORS = [...AUDIT_ACTORS, INTEGRATION];

/**
 * Everyone the filter offers — which has to be everyone who can appear.
 *
 * AUDIT_ACTORS is the employee roster, and it is what "show me this person's
 * activity" is asked of. But the integration acts too, and offering only the
 * humans left roughly a ninth of the log unreachable: no tick would show
 * those entries on their own, and no combination of ticks would hide them to
 * leave only the people. A filter that cannot name something the list
 * contains is a filter that quietly lies about what it is filtering.
 *
 * The people come first so the roster reads as a roster, with the one
 * non-human at the end where it is obviously not a colleague.
 */
export const AUDIT_FILTER_ACTORS = ACTORS;

const PATIENTS = DIRECTORY.slice(0, 24).map((p) => ({ name: p.name, mrn: String(p.mrn) }));

/* ============================================================================
   THE HISTORY

   Built at load from today's date, so the log is never showing a stale
   fortnight. Everything varies by fixed arithmetic rather than Math.random().
   ========================================================================= */

/** Which resource an event touched — the thing, not the category. */
const RESOURCES = {
  'patient-searched': () => 'Patient directory',
  'patient-viewed': () => 'Patient chart',
  'chart-section-viewed': (i) => ['Chart · Vitals', 'Chart · Medications', 'Chart · Documents', 'Chart · Orders'][i % 4],
  'document-opened': (i) => `Document DOC-${2200 + (i % 40)}`,
  'note-signed': (i) => `Encounter ENC-${1400 + (i % 60)}`,
  'order-placed': (i) => `Order ORD-${800 + (i % 50)}`,
  'medication-prescribed': (i) => `Prescription RX-${5100 + (i % 70)}`,
  'demographics-updated': () => 'Patient record',
  'claim-submitted': (i) => `Claim CLM-${2100 + (i % 80)}`,
  'record-exported': () => 'Chart summary (PDF)',
  'report-exported': (i) => ['Report · Time', 'Report · Billing', 'Report · Schedule'][i % 3],
  'audit-log-exported': () => 'Audit log (CSV)',
  'permission-changed': (i) => `Role: ${['Front Desk Coordinator', 'Billing Executive', 'Nurse'][i % 3]}`,
  'user-deactivated': (i) => `User: ${ACTORS[(i + 3) % ACTORS.length].username}`,
  'settings-changed': (i) => ['Settings · Billing', 'Settings · Appointment', 'Settings · Practice'][i % 3],
  'login-success': () => 'Session',
  'login-failed': () => 'Session',
  'logout': () => 'Session',
  'password-changed': () => 'Account',
  'access-denied': () => 'Patient chart',
  'break-glass': () => 'Patient chart',
};

/** Why the system refused, said in the words the reader needs. */
const DENIAL_REASONS = [
  'Role has no access to this patient’s chart',
  'Record is restricted — employee of the practice',
  'Session expired before the request completed',
];

const DEVICES = [
  'Chrome 128 · Windows',
  'Safari 17 · macOS',
  'Edge 128 · Windows',
  'Chrome 128 · iPad',
];

/**
 * WHICH DOOR THE ACTION CAME THROUGH.
 *
 * The reference screen put a second person's name beside the user's, which an
 * audit entry cannot have: one act, one actor. What that column IS worth
 * carrying is where the act arrived from — the same login doing the same thing
 * from the front-desk kiosk and from an integration are two different facts,
 * and "everything that came in through the portal last week" is a question
 * somebody asks after a breach notice.
 */
export const AUDIT_SOURCES = ['MediNova Web', 'Front desk kiosk', 'Patient portal'];

/* How often each event turns up, roughly. Reading a chart is the commonest
   thing anybody does in an EHR; a break-the-glass access is the rarest and the
   one somebody eventually comes looking for. */
const MIX = [
  'patient-viewed', 'patient-viewed', 'patient-viewed', 'chart-section-viewed',
  'chart-section-viewed', 'patient-searched', 'patient-searched', 'login-success',
  'note-signed', 'document-opened', 'order-placed', 'claim-submitted',
  'medication-prescribed', 'login-success', 'demographics-updated', 'logout',
  'patient-viewed', 'chart-section-viewed', 'login-failed', 'report-exported',
  'patient-searched', 'settings-changed', 'access-denied', 'patient-viewed',
  'record-exported', 'permission-changed', 'chart-section-viewed', 'password-changed',
  'note-signed', 'break-glass', 'patient-viewed', 'user-deactivated',
];

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(value, days) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Build the log, newest first.
 *
 * Entries land during working hours on working days — an audit log where a
 * third of the activity happens at 3am teaches a reviewer to ignore the one
 * entry that really did.
 */
export function buildAuditLog(now = Date.now()) {
  const entries = [];
  let seed = 0;

  for (let back = 0; back < DAYS_OF_HISTORY; back += 1) {
    const day = addDays(startOfDay(now), -back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const perDay = weekend ? 4 : 22;

    for (let i = 0; i < perDay; i += 1, seed += 1) {
      const eventId = MIX[seed % MIX.length];
      const event = EVENT_INDEX[eventId];

      /* Spread across 07:00–19:00, latest first within the day. */
      const at =
        day.getTime() + 7 * HOUR + Math.round((i * 12 * 60) / perDay) * MINUTE + (seed % 7) * MINUTE;
      if (at > now) continue;

      // The integration only ever posts claims; everything else is a person.
      const actor =
        eventId === 'claim-submitted' && seed % 3 === 0
          ? INTEGRATION
          : AUDIT_ACTORS[seed % AUDIT_ACTORS.length];

      const patient = event.phi ? PATIENTS[(seed * 5) % PATIENTS.length] : null;
      const outcome = event.outcome ?? (seed % 29 === 0 ? 'failure' : 'success');

      entries.push({
        id: `aud-${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(
          day.getDate()
        ).padStart(2, '0')}-${String(i).padStart(3, '0')}`,
        at,
        event: eventId,
        category: event.category,
        actorId: actor.id,
        username: actor.username,
        actor: actor.name,
        /* Copied onto the entry, not looked up later — see the note at the top
           of this file about an entry having to be readable on its own. */
        role: actor.role,
        patient,
        resource: RESOURCES[eventId]?.(seed) ?? '—',
        outcome,
        reason:
          outcome === 'denied'
            ? DENIAL_REASONS[seed % DENIAL_REASONS.length]
            : outcome === 'failure' && eventId === 'login-failed'
              ? 'Password did not match'
              : '',
        ip: `10.4.${(seed % 6) + 1}.${(seed * 7) % 200}`,
        session: `ses-${(seed * 977).toString(36).slice(-6)}`,
        device: actor.id === 'svc-ch' ? 'Server-to-server' : DEVICES[seed % DEVICES.length],
        source:
          actor.id === 'svc-ch'
            ? 'Clearing house integration'
            : seed % 17 === 0
              ? AUDIT_SOURCES[1]
              : seed % 23 === 0
                ? AUDIT_SOURCES[2]
                : AUDIT_SOURCES[0],
      });
    }
  }

  return entries.sort((a, b) => b.at - a.at);
}
