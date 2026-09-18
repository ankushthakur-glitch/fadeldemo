/**
 * LEADS — potential patients who submitted the practice website form.
 *
 * A LEAD IS NOT A PATIENT, AND THE DISTINCTION IS THE POINT
 * A website form is an unverified stranger typing five fields into a box. A
 * patient is a record the clinic is accountable for: an MRN, a chart, a claim
 * history. Creating the second from the first automatically would let anyone
 * with a browser mint records in a medical system — so nothing here becomes a
 * patient until a staff member has read it and completed the real onboarding
 * form. The two stay separate entities; conversion LINKS them, it does not
 * turn one into the other.
 *
 * The lead survives conversion. It is the evidence of where the patient came
 * from and who admitted them, which is the first thing anyone asks when a
 * record turns out to be wrong.
 *
 * LIFECYCLE
 *
 *   website submission → New → Converted   (a patient, new or already on file)
 *                          └──→ Rejected   (with a recorded reason)
 *
 * Rejected is not a dead end and it is not a delete: a rejected lead moves to
 * its own list, where it can be reopened and sent back to New. Converted is
 * the only terminal state, because a patient exists by then and unlinking it
 * here would not un-create them.
 *
 * All names, dates and contact details below are invented. No real people.
 */

/** The five fields the website form collects. Nothing else is captured. */
export const WEBSITE_FIELDS = ['firstName', 'lastName', 'dob', 'phone', 'email'];

export const LEAD_STATUSES = {
  new: { label: 'New', tone: 'info', open: true },
  converted: { label: 'Converted', tone: 'success', open: false },
  rejected: { label: 'Rejected', tone: 'critical', open: false },
};

/** Why a lead was rejected. A chosen reason rather than free text: "why" has
 *  to be answerable from a report later, and free text never is. */
export const REJECTION_REASONS = [
  'Duplicate submission',
  'Test or spam submission',
  'Outside our catchment area',
  'Service not offered by this practice',
  'Could not contact the patient',
  'Patient no longer wants an appointment',
];

export const LEAD_SOURCES = ['Website'];

/**
 * The seeded inbox.
 *
 * `submittedAt` is an ISO timestamp so sorting and the date filters work on
 * one comparable value rather than on a formatted string. Everything else is
 * stored exactly as the website sent it — including the messy cases, because
 * an inbox of clean records would never exercise the incomplete-lead path.
 */
const SEED = [
  { id: 'LD-10245', firstName: 'John', lastName: 'Doe', dob: '1985-05-12', phone: '(701) 555-1234', email: 'john.doe@email.com', submittedAt: '2026-08-11T10:32:00', status: 'new' },
  { id: 'LD-10244', firstName: 'Marisol', lastName: 'Ibarra', dob: '1979-11-03', phone: '(701) 555-0184', email: 'm.ibarra@email.com', submittedAt: '2026-08-11T09:07:00', status: 'new' },
  { id: 'LD-10243', firstName: 'Devon', lastName: 'Achebe', dob: '1992-02-27', phone: '(218) 555-7741', email: 'devon.achebe@email.com', submittedAt: '2026-08-10T16:48:00', status: 'new' },
  { id: 'LD-10242', firstName: 'Priya', lastName: 'Raman', dob: '1976-09-02', phone: '(408) 555-0163', email: 'priya.raman@email.com', submittedAt: '2026-08-10T14:20:00', status: 'new' },
  { id: 'LD-10241', firstName: 'Tobias', lastName: 'Lindqvist', dob: '1968-07-19', phone: '(701) 555-3390', email: 'tobias.l@email.com', submittedAt: '2026-08-10T11:05:00', status: 'new' },
  // Missing a phone number. The website allowed it through; the desk has to
  // deal with it, so the incomplete-lead guard has something real to catch.
  { id: 'LD-10240', firstName: 'Grace', lastName: 'Mbeki', dob: '1988-01-30', phone: '', email: 'grace.mbeki@email.com', submittedAt: '2026-08-09T18:12:00', status: 'new' },
  { id: 'LD-10239', firstName: 'Anton', lastName: 'Petrov', dob: '1955-04-08', phone: '(701) 555-6620', email: 'a.petrov@email.com', submittedAt: '2026-08-09T15:44:00', status: 'new' },
  { id: 'LD-10238', firstName: 'Yuki', lastName: 'Tanaka', dob: '1990-12-15', phone: '(612) 555-2288', email: 'yuki.tanaka@email.com', submittedAt: '2026-08-09T08:31:00', status: 'new' },
  { id: 'LD-10237', firstName: 'Rosa', lastName: 'Delgado', dob: '1983-06-21', phone: '(701) 555-9012', email: 'rosa.delgado@email.com', submittedAt: '2026-08-08T13:59:00', status: 'new' },
  { id: 'LD-10236', firstName: 'Callum', lastName: 'Fraser', dob: '1971-10-11', phone: '(701) 555-4455', email: 'callum.fraser@email.com', submittedAt: '2026-08-08T10:02:00', status: 'new' },
  { id: 'LD-10235', firstName: 'Amina', lastName: 'Haddad', dob: '1996-03-05', phone: '(218) 555-8833', email: 'amina.haddad@email.com', submittedAt: '2026-08-07T17:26:00', status: 'new' },
  { id: 'LD-10234', firstName: 'Peter', lastName: 'Nkemelu', dob: '1962-08-23', phone: '(701) 555-1177', email: 'p.nkemelu@email.com', submittedAt: '2026-08-07T09:14:00', status: 'new' },

  { id: 'LD-10233', firstName: 'Helena', lastName: 'Vos', dob: '1974-05-30', phone: '(701) 555-2210', email: 'helena.vos@email.com', submittedAt: '2026-08-06T14:41:00', status: 'new' },
  { id: 'LD-10232', firstName: 'Samuel', lastName: 'Otieno', dob: '1987-09-09', phone: '(612) 555-6104', email: 's.otieno@email.com', submittedAt: '2026-08-05T11:38:00', status: 'new' },
  { id: 'LD-10231', firstName: 'Nadia', lastName: 'Karimi', dob: '1993-01-17', phone: '(701) 555-7788', email: 'nadia.karimi@email.com', submittedAt: '2026-08-04T16:02:00', status: 'new' },

  {
    id: 'LD-10230', firstName: 'Henna', lastName: 'West', dob: '1961-02-20',
    phone: '(202) 555-0188', email: 'hennawest@outlook.com',
    submittedAt: '2026-07-28T09:20:00', status: 'converted',
    conversion: { mrn: '326486', patientName: 'Henna West', by: 'Amara Mensah', at: '2026-07-28T11:42:00' },
  },
  {
    id: 'LD-10229', firstName: 'Natali', lastName: 'Craig', dob: '1966-07-15',
    phone: '(949) 555-7564', email: 'natali.craig@email.com',
    submittedAt: '2026-07-24T13:11:00', status: 'converted',
    conversion: { mrn: '326477', patientName: 'Natali Craig', by: 'Amara Mensah', at: '2026-07-24T15:03:00' },
  },

  { id: 'LD-10228', firstName: 'Test', lastName: 'Submission', dob: '2000-01-01', phone: '(000) 000-0000', email: 'test@test.com', submittedAt: '2026-07-22T02:14:00', status: 'rejected', rejection: { reason: 'Test or spam submission', by: 'Amara Mensah', at: '2026-07-22T08:10:00' } },
];

/* ===================== The store =====================
   Held in memory and mirrored to sessionStorage, the same shape the
   appointment store uses: the prototype has to survive a navigation to the
   onboarding form and back without inventing a backend.
   ================================================== */

const KEY = 'medinova.leads.v1';
const AUDIT_KEY = 'medinova.leads.audit.v1';

const clone = (rows) =>
  rows.map((r) => ({
    ...r,
    conversion: r.conversion ? { ...r.conversion } : null,
    rejection: r.rejection ? { ...r.rejection } : null,
  }));

function read(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* A prototype that cannot persist still has to run. */
  }
}

let leads = read(KEY, null) ?? clone(SEED);

/**
 * The audit trail.
 *
 * Every state change is recorded, not just conversion — "who archived this
 * and when" is the question asked when a lead nobody meant to lose turns out
 * to have been archived on a Friday afternoon.
 */
let audit = read(AUDIT_KEY, null) ?? [];

const persist = () => {
  write(KEY, leads);
  write(AUDIT_KEY, audit);
};

/** Who is using the system. One acting user in a prototype with no auth. */
export const ACTING_USER = 'Amara Mensah';

export function logAudit(leadId, event, detail = '') {
  audit = [{ leadId, event, detail, by: ACTING_USER, at: new Date().toISOString() }, ...audit];
  persist();
}

export const auditFor = (leadId) => audit.filter((entry) => entry.leadId === leadId);

export const allLeads = () => clone(leads);

export const leadById = (id) => {
  const found = leads.find((l) => l.id === id);
  return found ? clone([found])[0] : null;
};

/** How many submissions nobody has looked at yet — the navigation badge. */
/** Leads nobody has dealt with yet. Still counted for the list's own footing;
 *  the navigation no longer carries a badge for it. */
export const openCount = () => leads.filter((l) => LEAD_STATUSES[l.status]?.open).length;

function mutate(id, changes) {
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;
  Object.assign(lead, changes);
  persist();
  return { ...lead };
}

/**
 * Link a lead to the patient it became.
 *
 * Called at the END of onboarding, by the patient form — never when the
 * Convert button is pressed. Pressing Convert only opens the form; a lead
 * marked converted against a patient that was never created would be a lie
 * the chart could not answer for.
 */
export function convertLead(id, { mrn, patientName, existing = false }) {
  const lead = leadById(id);
  if (!lead) return null;
  if (lead.status === 'converted') return lead; // someone got there first

  const at = new Date().toISOString();
  logAudit(
    id,
    'Lead Converted',
    `${existing ? 'Linked to existing patient' : 'New patient'} ${patientName} · MRN ${mrn}`
  );
  return mutate(id, {
    status: 'converted',
    conversion: { mrn, patientName, by: ACTING_USER, at, existing },
  });
}

/**
 * The lead was somebody already on file.
 *
 * A returning patient filling in the website form is the ordinary case, not an
 * error — and the wrong answer is to create a second chart for them. This
 * closes the lead against the record that already exists: no onboarding, no
 * new MRN, and the enquiry still recorded against the right person.
 */
export function linkExistingPatient(id, { mrn, patientName }) {
  return convertLead(id, { mrn, patientName, existing: true });
}

/**
 * Reject a lead, with a reason.
 *
 * Not a delete. A rejected enquiry is still evidence that somebody asked and
 * that the practice decided not to take them — which is the record anybody
 * asks for when the patient rings back.
 */
export function rejectLead(id, reason) {
  const lead = leadById(id);
  if (!lead || lead.status === 'converted') return null;

  logAudit(id, 'Lead Rejected', reason);
  return mutate(id, {
    status: 'rejected',
    rejection: { reason, by: ACTING_USER, at: new Date().toISOString() },
  });
}

/**
 * Reopen a rejected lead.
 *
 * Rejecting is a judgement, and judgements are made from incomplete
 * information: the number that would not answer rings back, the address that
 * looked out of area turns out to be the summer one, the "spam" was a real
 * person with an unfortunate email address. Without this the only way back was
 * to ask the patient to fill the website form in again — which loses the
 * original submission, its timestamp and the audit trail attached to it.
 *
 * The lead returns to New, because that is the truth of it: an enquiry nobody
 * has decided on yet. That also takes it out of the rejected list and back
 * into the inbox, which is where an enquiry somebody still has to answer
 * belongs. The rejection is cleared from the record but stays in the audit
 * trail, so the round trip is still answerable later.
 */
export function reopenLead(id) {
  const lead = leads.find((l) => l.id === id);
  if (!lead || lead.status !== 'rejected') return null;

  logAudit(id, 'Lead Reopened', lead.rejection?.reason
    ? `Was rejected — ${lead.rejection.reason}`
    : 'Was rejected');

  delete lead.rejection;
  lead.status = 'new';
  persist();
  return { ...lead };
}

/** A lead the website let through with a gap in it. */
export const missingFields = (lead) =>
  WEBSITE_FIELDS.filter((f) => !String(lead?.[f] ?? '').trim());

/* ===================== Duplicate patient check =====================
   Run before a patient is created, not after. A duplicate found afterwards is
   a merge; found before, it is a question.
   ================================================================ */

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Score a directory record against the lead on the five website fields.
 *
 * Name + DOB together is the strong signal — two people share a name, and two
 * people share a birthday, but rarely both. Phone and e-mail each corroborate.
 * Anything at or above the threshold is offered to the user as a QUESTION;
 * nothing here decides on its own, because a false match that silently blocks
 * a real new patient is worse than a duplicate the desk can merge.
 */
export function findDuplicates(lead, directory) {
  const dobOf = (p) => {
    // The directory stores dd-mm-yyyy; leads store ISO.
    const [d, m, y] = String(p.dob ?? '').split('-');
    return y && m && d ? `${y}-${m}-${d}` : '';
  };

  return directory
    .map((p) => {
      const [first = '', ...rest] = String(p.name ?? '').split(' ');
      const last = rest.join(' ');
      let score = 0;
      const nameMatch =
        norm(first) === norm(lead.firstName) && norm(last) === norm(lead.lastName);
      if (nameMatch) score += 2;
      if (dobOf(p) && dobOf(p) === lead.dob) score += 2;
      if (lead.phone && norm(p.phone) === norm(lead.phone)) score += 1;
      if (lead.email && norm(p.email) === norm(lead.email)) score += 1;
      return { patient: p, score, nameMatch };
    })
    .filter((m) => m.score >= 3)
    .sort((a, b) => b.score - a.score);
}

/* ===================== Formatting shared by the module ===================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '1985-05-12' → '05/12/1985'. Parsed by hand — `new Date(iso)` is UTC
 *  midnight, which reads as the previous day in any western timezone. */
export function shortDob(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

/** '2026-08-11T10:32:00' → { date: 'Aug 11, 2026', time: '10:32 AM' } */
export function stamp(iso) {
  if (!iso) return { date: '—', time: '' };
  const [datePart, timePart = ''] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0] = timePart.split(':').map(Number);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return {
    date: `${MONTHS[m - 1]} ${d}, ${y}`,
    time: `${hour}:${String(mm).padStart(2, '0')} ${suffix}`,
  };
}

export const stampText = (iso) => {
  const s = stamp(iso);
  return s.time ? `${s.date} ${s.time}` : s.date;
};

/** Days between an ISO timestamp and today, for the date filters. */
export function daysAgo(iso, today = new Date()) {
  const [datePart] = String(iso).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - then) / 86400000);
}
