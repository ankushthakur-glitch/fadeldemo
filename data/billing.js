/**
 * DEMO DATA — entirely invented. No real patient, payer or financial data.
 *
 * Backs the top-level Billing section (screens/billing.html), which follows a
 * claim from the moment it leaves an encounter to the moment the money — or
 * the denial — comes back:
 *
 *   Unbilled Encounters  locked encounters, insured or self-pay
 *   Claims             New → scrubbed → clearing house → payer → appeal
 *   Payments & Denials payer overdue · ERAs · payer rejected · appeals
 *
 * Payers come from data/master.js and providers from the same three
 * clinicians every other screen uses, so a payer or provider picked here is
 * recognisably the one Settings ▸ Master or the chart shows — not a second,
 * divergent roster invented for billing alone. The CPT catalogue is the same
 * one the procedure encounter bills against, for the same reason.
 */
import { PAYERS, CPT_CODES, medicationTotal, currentFee } from './master.js';
import { LOCATIONS, APPOINTMENT_TYPES } from './appointments.js';

/** Exported because Settings ▸ Billing contracts rates against these same
 *  three — a fee schedule naming a fourth provider would price work nobody
 *  in this practice does. */
export const BILLING_PROVIDERS = ['Dr. Amara Mensah', 'Dr. Luca Bianchi', 'Dr. Sana Nakamura'];

/**
 * What each of them does, for the second line under a name in a worklist.
 *
 * The scheduler's Encounters list writes a provider as their name over their
 * service — "Michael Johnson / Hepatology" — and every billing worklist now
 * writes them the same way, because a biller ringing about a claim needs to
 * know which clinic it came out of before they know which coordinator to ask.
 * A map rather than a field on BILLING_PROVIDERS: that array is the option
 * list four filters are built from, and turning it into objects would mean
 * rewriting each of them to reach for `.name`.
 */
export const BILLING_PROVIDER_ROLES = {
  'Dr. Amara Mensah': 'Gastroenterology',
  'Dr. Luca Bianchi': 'Hepatology',
  'Dr. Sana Nakamura': 'Endoscopy',
};

/** CPT-style procedure catalogue for coding rows on billable work. */
export const BILLING_PROCEDURES = [
  { code: '99213', description: 'Established patient visit, expanded', price: 150 },
  { code: '99214', description: 'Established patient visit, detailed', price: 200 },
  { code: '90834', description: 'Psychotherapy, 45 minutes', price: 202 },
  { code: '99406', description: 'Smoking cessation counseling, intermediate', price: 300 },
  { code: '99407', description: 'Smoking cessation counseling, intensive', price: 200 },
  { code: '+99356', description: 'Prolonged E/M inpatient, first hour', price: 300 },
  { code: '+99357', description: 'Prolonged E/M inpatient, each addl 30 min', price: 200 },
  { code: '45378', description: 'Colonoscopy, diagnostic', price: 1850 },
  { code: '43235', description: 'Upper GI endoscopy, diagnostic', price: 1400 },
];

export const BILLING_ICD_CODES = [
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'K58.0', description: 'Irritable bowel syndrome with diarrhea' },
  { code: 'K92.2', description: 'Gastrointestinal hemorrhage, unspecified' },
  { code: 'D50.9', description: 'Iron deficiency anaemia, unspecified' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination' },
];

/**
 * name, mrn, dob, sex — the pool every billing worklist draws its patients
 * from. `sex` is carried here rather than left to the claim template because
 * the claim stage prints it on a patient card: one hardcoded value would put
 * the same sex on all sixteen, which is the kind of wrong detail that makes a
 * reviewer distrust everything else on the screen.
 */
export const BILLING_PATIENTS = [
  { name: 'Priya Raman', mrn: '884120', dob: '14 Mar 1968', sex: 'Female' },
  { name: 'Daniel Okafor', mrn: '773901', dob: '02 Nov 1955', sex: 'Male' },
  { name: 'Margaret Whitfield', mrn: '910233', dob: '27 Jun 1949', sex: 'Female' },
  { name: 'Tomás Herrera', mrn: '660418', dob: '19 Sep 1982', sex: 'Male' },
  { name: 'Aisha Bello', mrn: '552207', dob: '05 Jan 1991', sex: 'Female' },
  { name: 'Henryk Duszynski', mrn: '431885', dob: '30 Apr 1961', sex: 'Male' },
  { name: 'Fatima Al-Rashid', mrn: '328874', dob: '11 Dec 1974', sex: 'Female' },
  { name: 'Callum Fraser', mrn: '295116', dob: '23 Jul 1996', sex: 'Male' },
  { name: 'Ingrid Solberg', mrn: '204471', dob: '08 Feb 1958', sex: 'Female' },
  { name: 'Marcus Webb', mrn: '187629', dob: '30 May 1945', sex: 'Male' },
  { name: 'Yuki Tanaka', mrn: '156390', dob: '17 Aug 1988', sex: 'Female' },
  { name: 'Rosa Delgado', mrn: '142857', dob: '22 Oct 1971', sex: 'Female' },
  { name: 'Owen Fitzgerald', mrn: '119284', dob: '04 Jul 1963', sex: 'Male' },
  { name: 'Nadia Kowalski', mrn: '108562', dob: '13 Jan 1980', sex: 'Female' },
  { name: 'Elias Berhane', mrn: '097331', dob: '26 Sep 1954', sex: 'Male' },
  { name: 'Sofia Marchetti', mrn: '086214', dob: '09 Apr 1993', sex: 'Female' },
];

export const PLACES_OF_SERVICE = [
  '11 - Office',
  '02 - Telehealth',
  '19 - Off Campus Outpatient Hospital',
  '21 - Inpatient Hospital',
  '22 - On Campus Outpatient Hospital',
  '24 - Ambulatory Surgical Center',
];

export const VISIT_TYPES = ['Intake', 'Follow up', 'Assessment'];

/** How the charge reached Billing — a bulk file, or somebody keying it in. */
export const UPLOAD_TYPES = ['CSV', 'Manual'];

/** Which position in the coverage order this claim is being billed under. */
export const PROCESSED_AS = ['Primary', 'Secondary', 'Tertiary'];

/**
 * What kind of appointment the charge came off — the SCHEDULER's own types,
 * not a billing-only vocabulary.
 *
 * These are APPOINTMENT_TYPES from data/appointments.js, the same fifteen the
 * booking form offers and the calendar colours by. Billing used to invent its
 * own short codes, which meant the appointment a patient booked and the
 * appointment their claim was billed under had different names and could not
 * be reconciled — the one thing an "Appointment Type" column exists to let you
 * do. A claim now carries the type verbatim from the visit that produced it.
 *
 * Their `profiles` also decide the Location column: a type only the ASC offers
 * bills as ASC work, and one the clinic offers bills as clinic work. Deriving
 * it means the two columns cannot contradict each other.
 */
export const CLAIM_APP_TYPES = APPOINTMENT_TYPES;

/** Offered by the surgical centre and nowhere else — so it bills as ASC. A
 *  type both sites offer (infusion, records) is billed where it happened. */
const ascOnly = (type) => type.profiles.includes('asc') && !type.profiles.includes('clinic');

/** Who in the billing office is working the claim. Drawn from the same Billing
 *  Staff roster Settings ▸ Practice ▸ Users lists, plus the two names the ERA
 *  download history already credits. */
export const CLAIM_CODERS = ['Andres Hurley', 'Jacque Andrews', 'Ruth Delaney', 'Kofi Mensah'];

/** The running commentary a biller leaves on a claim. */
export const CLAIM_NOTES = [
  'Claim submitted electronically to the payer.',
  'Awaiting insurance adjudication.',
  'Missing modifier updated and resubmitted.',
  'Prior authorization attached to the claim.',
  'Eligibility verified before submission.',
  'Claim denied due to invalid diagnosis pointer.',
  'Appeal submitted with supporting documentation.',
  'Secondary insurance billed after primary EOB.',
  'Payment posted from insurance remittance.',
  'EOB received and under review.',
  'Follow-up completed with payer — no update yet.',
  'Corrected claim prepared, pending sign-off.',
];

export const RESUBMISSION_CODES = ['Original', 'Replacement', 'Void'];
export const PAPERWORK_SEND_MODES = ['NA - Not Applied', 'BM - By Mail', 'EL - Electronically Only'];

/* ============================================================================
   DETERMINISTIC FIXTURE BUILDING

   Every list below is generated by walking the pools above at a fixed stride.
   No Math.random(): a reviewer reloading the page has to see the same rows in
   the same order, or "the claim I was looking at moved" becomes a bug report.
   ========================================================================= */

const activePayers = PAYERS.filter((p) => p.active);
const at = (list, i) => list[i % list.length];

/** Rotate at a co-prime stride so patient, payer and provider do not lock into
 *  the same repeating triple every few rows. */
const patientAt = (i) => at(BILLING_PATIENTS, i * 3);
const payerAt = (i) => at(activePayers, i * 2);
const providerAt = (i) => at(BILLING_PROVIDERS, i);
const procedureAt = (i) => at(BILLING_PROCEDURES, i * 4);

const stamp = (date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;

/** Dates walk backwards from a fixed point, so the age columns stay stable. */
function dateAt(i, spread = 5) {
  const base = new Date(2026, 6, 12); /* 12 Jul 2026 */
  base.setDate(base.getDate() - i * spread);
  return stamp(base);
}

/** The fixture's "today". Every date on a claim is derived from its ageing
 *  against this one point, so a row that says 90 days old really does carry a
 *  claim date ninety days back — the two columns cannot drift apart. */
const CLAIM_TODAY = new Date(2026, 7, 13); /* 13 Aug 2026 */

function daysAgo(days) {
  const date = new Date(CLAIM_TODAY);
  date.setDate(date.getDate() - Math.max(0, Math.round(days)));
  return stamp(date);
}

/** Clinic hours, for the time a visit actually happened. A worklist row that
 *  is an ENCOUNTER carries the time under its date the way the scheduler's
 *  own encounter list does — two visits for the same patient on one day are
 *  otherwise the same row printed twice. */
const APPOINTMENT_TIMES = ['08:00 AM', '09:30 AM', '11:15 AM', '01:45 PM', '03:00 PM'];

function money(i, base, step) {
  return Number((base + ((i * step) % 900)).toFixed(2));
}

/* ============================================================================
   READY FOR BILLING — locked encounters that have not been billed at all yet.

   The step BEFORE a claim exists. A clinician has finished and signed the
   encounter; nobody has yet decided what it becomes. Which is why the tab is
   split in two rather than filtered by status: an insured visit becomes a
   CLAIM sent to a payer, a self-pay visit becomes an INVOICE sent to the
   patient, and those are different documents with different fields. One list
   with a "payment type" column would imply the two share a next step.
   ========================================================================= */

/**
 * Self-pay visits and invoices name their appointment the way an INSURED one
 * does — with the scheduler's own type.
 *
 * This used to be a two-item list of its own, 'New Appointment' and 'Follow Up
 * Appointment', which meant the Appointment Type column said one thing on the
 * Insurance tab and something else on the Self Pay tab beside it, and an
 * invoice raised off a self-pay encounter could not be matched back to the
 * visit that produced it. It is also what lets every one of these columns
 * carry the SAME coloured dot the calendar draws the appointment in: a colour
 * needs a type to belong to, and 'Follow Up Appointment' was not one.
 *
 * The types the clinic (rather than the surgical centre) offers — a self-pay
 * row is a consultation somebody is paying for out of pocket, not an ASC case.
 */
export const APPOINTMENT_TYPES_BILLING = APPOINTMENT_TYPES.filter((type) =>
  type.profiles.includes('clinic')
);

/** A gastroenterology clinic's reasons, not a generic set — these are the
 *  same complaints the scheduler and the chart use. */
export const REASONS_FOR_VISIT = [
  'GORD, poor PPI response',
  'Chronic diarrhoea, ?IBD',
  'Surveillance colonoscopy',
  'Iron deficiency anaemia',
  'Coeliac follow-up',
  'Hepatic steatosis',
  'Rectal bleeding, first episode',
  'Post-op review, cholecystectomy',
  'Irritable bowel syndrome',
  'Barrett’s surveillance',
];

export const INSURANCE_COVERAGE = ['In-Network', 'Out-of-Network'];

/** Insured visits waiting to be turned into a claim. */
export const READY_INSURANCE = Array.from({ length: 24 }, (_, n) => {
  const patient = patientAt(n + 1);
  const payer = payerAt(n);
  return {
    id: `ENC-${String(2401 + n)}`,
    dos: dateAt(n, 6),
    dosTime: at(APPOINTMENT_TIMES, n),
    patient: patient.name,
    mrn: patient.mrn,
    /* Out-of-network is not a footnote — it changes what the patient owes and
       whether the claim is worth sending at all, so it is a column. Roughly
       one visit in four, which is what makes it worth spotting; an even
       alternation would read as a stripe pattern rather than an exception.
       (`n * 3 + n % 2` was always even, so every row said In-Network.) */
    coverage: n % 4 === 3 ? 'Out-of-Network' : 'In-Network',
    provider: providerAt(n),
    reason: at(REASONS_FOR_VISIT, n),
    placeOfService: at(PLACES_OF_SERVICE, n),
    /* The scheduler's own type, because this encounter is about to become a
       claim and the claim shows the same column. Two vocabularies either side
       of "Generate Claim" meant the visit a patient booked and the visit their
       claim was billed under could not be matched up by eye. */
    appointmentType: at(APPOINTMENT_TYPES, n * 2).title,
    apptTypeId: at(APPOINTMENT_TYPES, n * 2).id,
    payer: payer.name,
    cpt: procedureAt(n).code,
  };
});

/** Self-pay visits waiting to be turned into an invoice. `status` is what the
 *  patient has already paid at the desk, not the state of a claim. */
export const READY_SELF_PAY = Array.from({ length: 18 }, (_, n) => {
  const patient = patientAt(n + 6);
  return {
    id: `ID${String(1234 + n)}`,
    dos: dateAt(n + 2, 7),
    patient: patient.name,
    mrn: patient.mrn,
    provider: providerAt(n + 1),
    reason: at(REASONS_FOR_VISIT, n + 3),
    appointmentType: at(APPOINTMENT_TYPES_BILLING, n + 1).title,
    apptTypeId: at(APPOINTMENT_TYPES_BILLING, n + 1).id,
    dosTime: at(APPOINTMENT_TIMES, n + 1),
    billAmount: money(n, 111.11, 63.7),
    status: n % 2 === 0 ? 'Unpaid' : 'Paid',
  };
});

/* ============================================================================
   INVOICES — the document the patient is sent, and the money against it.

   The other half of the pair Unbilled Encounters splits on. An insured visit
   becomes a CLAIM chased through seventeen statuses, because a payer has that
   many ways of not paying; a patient bill becomes an INVOICE with four,
   because a patient has either paid it, paid part of it, not paid it yet, or
   had the remainder written off.

   ONE arithmetic rule holds on every live row, and the worklist shows all
   three columns so anyone can check it:

       Due = Total Amount − Payment

   Total Amount is what the PATIENT is billed — the line items less whatever
   insurance covered — not the gross charge. That is why the invoice document
   subtotals its items, subtracts an insurance line and calls what is left the
   patient's responsibility: the number at the foot of the document and the
   number in the Total Amount column are the same number, arrived at the same
   way. A receipt then reads charges − adjustment = total for the same reason.

   A cancelled invoice is the one exception: nothing is owed on it any more,
   so its Due is zero however much was billed, and the status says why.
   ========================================================================= */

/**
 * Why the invoice exists.
 *
 * Not decoration: the reason decides whether the patient owes the whole
 * charge or only the part their cover left behind, which is `insured` below.
 * An out-of-network visit is still adjudicated — the payer just pays less of
 * it — while a cancellation fee was never a covered service at all.
 */
export const INVOICE_TYPES = [
  { label: 'Self Pay', tone: 'neutral', insured: false },
  { label: 'Out of Network', tone: 'warning', insured: true },
  { label: 'Outstanding Balance', tone: 'warning', insured: true },
  { label: 'Non-Covered Service', tone: 'info', insured: false },
  { label: 'Add-on Service', tone: 'info', insured: false },
  { label: 'Cancellation Fee', tone: 'critical', insured: false },
];

/** In the order an invoice travels, which is the order the chips sit in.
 *  Cancelled is last because it is where an invoice stops rather than a stage
 *  on the way through. */
export const INVOICE_STATUSES = [
  'Pending', 'Partially Paid', 'Paid', 'Written Off', 'Cancelled',
];

export const INVOICE_STATUS_TONE = {
  Pending: 'warning',
  'Partially Paid': 'info',
  Paid: 'success',
  /* Critical, not neutral: a written-off balance is money the practice has
     decided to stop collecting, and it should read as a loss on the row. */
  'Written Off': 'critical',
  Cancelled: 'neutral',
};

/** How the invoice was raised to be settled. The payment dialog can still
 *  take the money another way — this is the expectation, not the record. */
export const INVOICE_PAYMENT_METHODS = ['Self Pay', 'Insurance', 'Card', 'Cash', 'Bank Transfer'];

/** What a payment is being taken FOR. Copay leads because it is what the desk
 *  collects all day; the rest are what a biller chases afterwards. */
export const PAYMENT_REASONS = [
  'Copay', 'Co-insurance', 'Deductible', 'Outstanding Balance', 'Self Pay', 'Cancellation Fee',
];

/** Cards already on file. Numbers are masked here rather than at render time:
 *  a fixture that held sixteen digits would be a fixture someone could paste
 *  somewhere real. */
export const SAVED_CARDS = [
  { id: 'card-visa', brand: 'VISA', kind: 'Current', last4: '4242' },
  { id: 'card-mc', brand: 'MasterCard', kind: 'Saving', last4: '8319' },
  { id: 'card-citi', brand: 'Citi', kind: 'Current', last4: '6027' },
];

/** Not a CPT code — nothing clinical happened. Practices bill a missed
 *  appointment against an internal code, and the invoice form offers it
 *  alongside the procedure catalogue for exactly that reason. */
export const MISSED_APPOINTMENT_FEE = {
  code: 'NOSHOW',
  description: 'Missed appointment fee',
  price: 75,
};

/** The wording every invoice carries unless somebody changes it. */
export const INVOICE_NOTE =
  'Please review the invoice carefully. If you have any questions or concerns regarding the '
  + 'charges, or if you need assistance with payment options, do not hesitate to contact our '
  + 'billing department.';

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Monday, 27 May 2026" — the long form a receipt is read in, as against the
 *  MM/DD/YYYY every worklist column is stamped in. */
const longDate = (date) =>
  `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;

/** Round to cents. Every figure on an invoice is a sum of other figures on
 *  the same invoice, so they all go through here and cannot drift a penny. */
const cents = (value) => Number(Number(value).toFixed(2));

/** Deterministic contact details. The receipt prints both, and one hardcoded
 *  number on twenty-two invoices reads as a placeholder rather than a record. */
const phoneAt = (i) => `(701) 555-0${String(100 + ((i * 17) % 90))}`;
/**
 * Where a patient's invoice is sent.
 *
 * Decomposed first, then filtered to plain letters: NFD splits "á" into an a
 * and a combining accent, and keeping only ASCII letters drops the accent
 * rather than the letter under it. Tomás Herrera → tomas.herrera.
 *
 * Exported because the invoice form fills the address in when the patient is
 * picked, and an invoice raised by hand has to reach the same inbox as the
 * twenty-two below.
 */
export function patientEmail(name) {
  return `${[...String(name).normalize('NFD')]
    .filter((char) => /[A-Za-z ]/.test(char))
    .join('')
    .trim()
    .toLowerCase()
    .replace(/ +/g, '.')}@example.com`;
}

/**
 * How much of the bill has arrived, per status.
 *
 * Written Off pays nearly all of it and leaves a stub — that is what a
 * write-off usually is, the last few dollars nobody will chase — and the Due
 * column still shows that stub, because a balance written off invisibly is a
 * balance nobody can audit.
 */
const INVOICE_STATUS_CYCLE = [
  'Paid', 'Partially Paid', 'Written Off', 'Pending', 'Partially Paid',
  'Paid', 'Pending', 'Cancelled', 'Partially Paid', 'Written Off',
];

function invoicePaid(status, total, n) {
  if (status === 'Paid') return total;
  if (status === 'Pending' || status === 'Cancelled') return 0;
  if (status === 'Written Off') return cents(total * at([0.99, 0.97, 0.95], n));
  return cents(total * at([0.5, 0.75, 0.92, 0.62], n));
}

/**
 * The invoices themselves.
 *
 * Ids are hexadecimal and four characters wide because that is how the
 * reference numbers them, and because a patient reading "#33B0" down the
 * phone cannot confuse it with the claim number, the MRN or the encounter id
 * they are also being asked for.
 */
export const INVOICES = Array.from({ length: 22 }, (_, n) => {
  const patient = patientAt(n + 4);
  const type = at(INVOICE_TYPES, n * 5);
  const provider = providerAt(n + 2);
  const appointmentType = at(APPOINTMENT_TYPES_BILLING, n);


  const dos = new Date(CLAIM_TODAY);
  dos.setDate(dos.getDate() - (6 + n * 4));
  const raised = new Date(dos);
  raised.setDate(raised.getDate() + 2);
  const dueDate = new Date(raised);
  dueDate.setDate(dueDate.getDate() + 30);

  /* Two lines on most invoices, three where the visit carried an extra —
     enough for the document's item table to look like a document rather than
     a single row with a total under it.

     A cancellation fee is the exception and gets ONE line, because that is
     what it is: the visit never happened, so there are no procedures to bill.
     A no-show invoice itemising a colonoscopy would be the sort of detail
     that makes a reviewer stop trusting the rest of the screen. */
  const lines = type.label === 'Cancellation Fee'
    ? [{ ...MISSED_APPOINTMENT_FEE, qty: 1 }]
    : [procedureAt(n), procedureAt(n + 3), procedureAt(n + 6)]
      .slice(0, n % 4 === 1 ? 3 : 2)
      .map((procedure, k) => ({
        code: procedure.code,
        description: procedure.description,
        qty: k === 0 && n % 5 === 0 ? 2 : 1,
        price: procedure.price,
      }));

  const subtotal = cents(lines.reduce((sum, line) => sum + line.qty * line.price, 0));
  const insurance = type.insured ? cents(subtotal * at([0.6, 0.75, 0.8], n)) : 0;
  const total = cents(subtotal - insurance);

  const status = at(INVOICE_STATUS_CYCLE, n);
  const payment = invoicePaid(status, total, n);
  const due = status === 'Cancelled' ? 0 : cents(total - payment);

  const paidOn = new Date(raised);
  paidOn.setDate(paidOn.getDate() + at([1, 3, 6, 9], n));

  return {
    id: (0x33a0 + n).toString(16).toUpperCase(),
    invoiceDate: stamp(raised),
    dueDate: stamp(dueDate),
    dos: stamp(dos),
    patient: patient.name,
    mrn: patient.mrn,
    dob: patient.dob,
    phone: phoneAt(n),
    email: patientEmail(patient.name),
    appointmentType: appointmentType.title,
    apptTypeId: appointmentType.id,
    appointmentAt: `${longDate(dos)} at ${at(APPOINTMENT_TIMES, n)}`,
    provider,
    type: type.label,
    /* Blank where nothing was billed to a payer. The funnel filters on it, so
       filtering by an insurer correctly leaves the self-pay rows out rather
       than matching them on an invented name. */
    payer: type.insured ? at(activePayers, n * 2).name : '',
    paymentMethod: type.insured ? 'Insurance' : 'Self Pay',
    lines,
    subtotal,
    insurance,
    total,
    payment,
    due,
    status,
    /* A receipt exists only where money actually arrived. The row menu still
       offers View Receipt on every invoice — see the menu's own note — and
       says so rather than opening a document with nothing on it. */
    receiptId: payment > 0 ? `REC-${raised.getFullYear()}-${String(52700 + n)}` : '',
    /* MM/DD/YYYY like every other date the screen stamps, plus the time the
       desk took the money — a receipt is the one document where the hour
       matters. The appointment above keeps the long form because that is how
       an appointment is read back to a patient. */
    receiptDate: payment > 0 ? `${stamp(paidOn)}, ${at(APPOINTMENT_TIMES, n + 2)}` : '',
    receiptMethod: payment > 0 ? at(['Card', 'Cash', 'Bank Transfer'], n) : '',
    note: INVOICE_NOTE,
  };
});

/* ============================================================================
   DENIAL VOCABULARY — declared here rather than beside the denial worklist
   below, because the claims list is built above it and a refused claim carries
   its reason code on the row. One vocabulary: a denial reached from Claims and
   the same denial reached from Payments & Denials must not be able to quote
   two different codes for the same refusal.
   ========================================================================= */

export const DENIAL_CATEGORIES = [
  'Eligibility/ Coverage',
  'Coding/ Billing',
  'Authorization',
  'Timely Filling',
  'Duplicate',
  'Non-Covered',
  'Others',
];

const DENIAL_CODES = [
  { code: 'CO-16', comment: 'Claim/service lacks information which is needed for adjudication.' },
  { code: 'PR-119', comment: 'Benefit maximum for this time period or occurrence has been reached.' },
  { code: 'CO-197', comment: 'Precertification/authorization/notification absent.' },
  { code: 'CO-29', comment: 'The time limit for filing this claim has expired.' },
  { code: 'CO-18', comment: 'Exact duplicate claim/service.' },
  { code: 'PR-204', comment: 'This service is not covered under the patient’s current benefit plan.' },
  { code: 'CO-45', comment: 'Charge exceeds fee schedule/maximum allowable.' },
];

/* ============================================================================
   CLAIMS — ONE worklist for the whole life of a claim.

   Unbilled and Submitted used to be two tabs over two lists, which meant a
   claim that was scrubbed here and rejected there existed twice and had to be
   moved between them by hand. It is one object with one status, so it is one
   list: the status says where the claim has got to, and nothing has to be
   deleted from one array and rebuilt in another to send it on.

   The statuses run in the order the claim travels:

     New · Scrub Error · Ready to Submit    inside the practice
     Submitted · CH Rejected                at the clearing house
     Accepted · Processed · No Response     with the payer
     Denied · Rejected                      refused
     Corrected Claim · Resubmitted          sent again
     Appeal 1/2/3                           being argued
     INS. Underpayment · INS. Overpayment   paid, but not the contracted amount
   ========================================================================= */

export const CLAIM_STATUSES = [
  'New', 'Scrub Error', 'Ready to Submit',
  'Submitted', 'CH Accepted', 'CH Rejected',
  'Accepted', 'Processed', 'No Response',
  'Denied', 'Rejected',
  'Corrected Claim', 'Resubmitted',
  'Appeal 1', 'Appeal 2', 'Appeal 3',
  'INS. Underpayment', 'INS. Overpayment',
];

/**
 * The statuses the chip row filters by — the SUBMISSION PIPELINE, and only it.
 *
 * Seventeen chips was a filter row three lines deep, most of it standing for
 * states this tab does not drive: an ageing balance is worked in AR
 * Management, and the money coming back on a claim in Remits. What is left is
 * the pipeline this tab does drive — a claim from the charge nobody has
 * scrubbed to the clearing house's answer.
 *
 * Everything past that is still a status a claim can HOLD, still shown on the
 * row, still reachable under All, and still settable from the Status cell's
 * dropdown. It just is not a chip.
 *
 * OPEN QUESTION, now that Payments & Denials has gone. Denied, Rejected and
 * the three appeal levels were left off this row on the grounds that they
 * were worked from that tab, and there is no longer such a tab. A denial is
 * worked out of a LIST — you take them in a batch and argue them one at a
 * time — and the only list of them left is All with its Status column sorted.
 * Two more chips would fix that; they were not added here because trimming
 * this row to the pipeline was a deliberate decision, and undoing half of it
 * as a side effect of a navigation change is not the way to revisit it.
 */
export const CLAIM_CHIP_STATUSES = [
  'New', 'Scrub Error', 'Ready to Submit',
  'Submitted', 'CH Accepted', 'CH Rejected',
];

/** Which badge each status wears. `brand` is reserved for the appeal levels —
 *  an appeal is neither a failure nor a settlement, and colouring it as either
 *  would tell the wrong story at a glance. */
export const CLAIM_STATUS_TONE = {
  'New': 'info',
  'Scrub Error': 'critical',
  'Ready to Submit': 'success',
  'Submitted': 'info',
  'CH Accepted': 'success',
  'CH Rejected': 'warning',
  'Accepted': 'success',
  'Processed': 'success',
  'No Response': 'neutral',
  'Denied': 'critical',
  'Rejected': 'warning',
  'Corrected Claim': 'info',
  'Resubmitted': 'warning',
  'Appeal 1': 'brand',
  'Appeal 2': 'brand',
  'Appeal 3': 'brand',
  'INS. Underpayment': 'warning',
  'INS. Overpayment': 'info',
};

/** Statuses a claim has not been sent under yet. They have no submit date, and
 *  their ageing is counted off the claim date rather than the postmark. */
export const UNSENT_STATUSES = ['New', 'Scrub Error', 'Ready to Submit'];

const CLAIM_SHAPE = [
  { status: 'New', count: 20 },
  { status: 'Scrub Error', count: 18 },
  { status: 'Ready to Submit', count: 22 },
  { status: 'Submitted', count: 20 },
  { status: 'CH Accepted', count: 16 },
  { status: 'CH Rejected', count: 12 },
  { status: 'Accepted', count: 14 },
  { status: 'Processed', count: 12 },
  { status: 'No Response', count: 8 },
  { status: 'Denied', count: 12 },
  { status: 'Rejected', count: 9 },
  { status: 'Corrected Claim', count: 7 },
  { status: 'Resubmitted', count: 10 },
  { status: 'Appeal 1', count: 6 },
  { status: 'Appeal 2', count: 4 },
  { status: 'Appeal 3', count: 3 },
  { status: 'INS. Underpayment', count: 7 },
  { status: 'INS. Overpayment', count: 5 },
];

/** Days a claim has been open. Read off this cycle rather than computed from a
 *  date, then the dates are derived back out of it — so "90d" always sits
 *  beside a claim date ninety days ago. */
const AGE_CYCLE = [2, 5, 4, 3, 15, 17, 90, 18, 6, 9, 28, 45, 12, 7, 33, 61];

/**
 * Appointment type → site → procedure, in that order, rather than three
 * independent rotations.
 *
 * Rotating them separately produced rows like "telehealth colonoscopy at an
 * ASC", and one row that cannot have happened is enough to make a reviewer
 * stop trusting the other 204. The booked appointment is what actually
 * happened, so it leads: a Procedure Visit is an ASC case billing an
 * endoscopy code, an infusion is at the infusion centre, and everything else
 * is a clinic room billing an office code.
 */
const ASC_SITE = 'Red River ASC';
const INFUSION_SITE = 'Prairie Infusion Centre';
const CLINIC_SITES = LOCATIONS.filter((site) => site !== ASC_SITE && site !== INFUSION_SITE);

const ASC_PROCEDURES = BILLING_PROCEDURES.filter((p) => ['45378', '43235'].includes(p.code));
const OFFICE_PROCEDURES = BILLING_PROCEDURES.filter((p) => !['45378', '43235'].includes(p.code));

const DENIED_STATUSES = ['Denied', 'Rejected', 'Appeal 1', 'Appeal 2', 'Appeal 3'];

/**
 * The statuses, INTERLEAVED — one flat list in the order the rows are built.
 *
 * Walking CLAIM_SHAPE straight through put every claim of a status together,
 * so the first page of All was twenty identical New badges and the Status
 * column looked like a column of one value. A real book of business is at
 * every stage at once, and All is the view that is supposed to show that.
 *
 * Each status is spread evenly across the whole list rather than shuffled:
 * position (i + ½) / count places the i-th of a status at its own fraction of
 * the way down, so twenty New land every tenth row and three Appeal 3 land at
 * a sixth, a half and five sixths. No Math.random() — a reviewer reloading has
 * to see the same rows in the same order — and the per-status counts are
 * untouched, so every chip still counts what it says it counts.
 */
function interleavedStatuses() {
  return CLAIM_SHAPE
    .flatMap(({ status, count }, rank) =>
      Array.from({ length: count }, (_, i) => ({ status, rank, at: (i + 0.5) / count }))
    )
    /* Ties broken by CLAIM_SHAPE order, so a row's neighbours run along the
       claim's journey rather than jumping about. */
    .sort((a, b) => a.at - b.at || a.rank - b.rank)
    .map(({ status }) => status);
}

function buildClaims() {
  const rows = [];

  interleavedStatuses().forEach((status, n) => {
    {
      const patient = patientAt(n);
      const payer = payerAt(n);
      const unsent = UNSENT_STATUSES.includes(status);
      const age = at(AGE_CYCLE, n);
      const charge = money(n, 104.61, 37.4);

      /* Stride 2 over fifteen types — co-prime, so every type is reached
         rather than the list settling into a short repeating run. */
      const appointmentType = at(CLAIM_APP_TYPES, n * 2);
      const asc = ascOnly(appointmentType);
      const procedure = asc ? at(ASC_PROCEDURES, n) : at(OFFICE_PROCEDURES, n);
      const site = asc ? ASC_SITE
        : appointmentType.title.includes('Infusion') ? INFUSION_SITE
        : at(CLINIC_SITES, n);

      /* What the practice actually expects to bank. A denial collects nothing;
         an underpayment collects less than the contracted rate. Anything else
         is the contracted 80% of the charge. A column that just repeated the
         charge would be a second copy of it, not a second fact. */
      const expected =
        status === 'Denied' || status === 'Rejected' ? 0
        : status === 'INS. Underpayment' ? Number((charge * 0.55).toFixed(2))
        : Number((charge * 0.8).toFixed(2));

      const denial = at(DENIAL_CODES, n);

      rows.push({
        id: `CLM-${String(1001 + n)}`,
        dos: daysAgo(age + 9),
        originalClaimDate: daysAgo(age),
        /* Not a column any more, but still the day the claim went out: the
           flows stamp it, and the ageing clock and the claim's own history
           are read off it. Empty until it has actually been sent. */
        submissionDate: unsent ? '' : daysAgo(Math.max(1, age - 3)),
        updatedDate: daysAgo(Math.floor(age / 3)),
        patient: patient.name,
        mrn: patient.mrn,
        /* Verbatim from the scheduler's type list — the same string the
           booking form offered and the calendar drew. */
        appointmentType: appointmentType.title,
        apptTypeId: appointmentType.id,
        provider: providerAt(n),
        coder: at(CLAIM_CODERS, n),
        visitType: at(VISIT_TYPES, n),
        uploadType: at(UPLOAD_TYPES, n),
        cpt: procedure.code,
        processedAs: at(PROCESSED_AS, n),
        payer: payer.name,
        payerId: payer.payerId,
        /* Clinic or ASC — the distinction that decides whether a facility fee
           is billed at all. `site` keeps the name of the room it happened in
           for the tooltip and the claim detail. */
        location: asc ? 'ASC' : 'Clinic',
        site,
        charge,
        expectedCollection: expected,
        age,
        notes: at(CLAIM_NOTES, n),
        status,
        /* Only a claim the payer actually refused carries denial detail. The
           claim stage opens those in its denial mode and reads these; putting
           them on every row would mean a clean claim could open a screen
           quoting a denial code nobody had received. */
        ...(DENIED_STATUSES.includes(status)
          ? {
              denialDate: daysAgo(Math.max(1, Math.floor(age / 2))),
              denialCode: denial.code,
              denialComment: denial.comment,
              category: at(DENIAL_CATEGORIES, n),
              cptDescription: procedure.description,
              denied: charge,
            }
          : {}),
      });
    }
  });

  /* Newest first, the way a worklist is read. The interleave decided which
     status each row holds; the claim date decides where it sits. */
  return rows;
}

export const CLAIMS = buildClaims();

/** Past this many days a claim is old enough to chase. */
export const AGE_WARNING_DAYS = 15;

/* ============================================================================
   PAYMENTS & DENIALS
   ========================================================================= */

/** Accepted by the payer, adjudicated by nobody — nothing has come back. */
export const PAYER_OVERDUE = Array.from({ length: 20 }, (_, n) => {
  const patient = patientAt(n + 9);
  const payer = payerAt(n + 3);
  const procedure = procedureAt(n + 1);
  const billedAs = at(PROCESSED_AS, n);
  return {
    id: `CLM-${String(1301 + n)}`,
    dos: dateAt(n + 8, 4),
    patient: patient.name,
    mrn: patient.mrn,
    submissionDate: dateAt(n + 3, 4),
    cpt: procedure.code,
    billedAs,
    processedAs: billedAs,
    charge: money(n, 110.21, 29.3),
    practice: at(LOCATIONS, n),
    payer: payer.name,
    age: at([32, 45, 61, 38, 52, 74, 41, 66], n),
    status: 'Payer Overdue',
  };
});

/** Adjudicated and refused, in whole or in part. Feeds the denial worklist
 *  and the Claim Details stage the row opens into. */
export const PAYER_REJECTED = Array.from({ length: 10 }, (_, n) => {
  const patient = patientAt(n + 2);
  const payer = payerAt(n + 5);
  const procedure = procedureAt(n + 3);
  const denial = at(DENIAL_CODES, n);
  return {
    id: `CLM-${String(1401 + n)}`,
    invoice: `INV-${String(1990 + n)}`,
    dos: dateAt(n + 6, 6),
    patient: patient.name,
    mrn: patient.mrn,
    denialDate: dateAt(n + 1, 6),
    payer: payer.name,
    category: at(DENIAL_CATEGORIES, n),
    cpt: procedure.code,
    cptDescription: procedure.description,
    denialCode: denial.code,
    denialComment: denial.comment,
    denied: money(n, 104.61, 33.9),
    /* Partial means the payer paid some of the lines. It changes what the
       stage offers: a partial denial can be appealed on the refused lines
       while the paid ones stay posted. */
    status: n % 3 === 0 ? 'Partially Denied' : 'Fully Denied',
  };
});

export const APPEAL_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Overturned', 'Upheld'];

export const APPEALS = Array.from({ length: 10 }, (_, n) => {
  const patient = patientAt(n + 7);
  const payer = payerAt(n + 4);
  return {
    id: `APL-${String(701 + n)}`,
    claimId: `CLM-${String(1401 + n)}`,
    dos: dateAt(n + 6, 6),
    patient: patient.name,
    mrn: patient.mrn,
    payer: payer.name,
    filedDate: dateAt(n, 6),
    level: at(['Level 1 — Reconsideration', 'Level 2 — Formal appeal'], n),
    category: at(DENIAL_CATEGORIES, n),
    amount: money(n, 118.4, 41.2),
    status: at(APPEAL_STATUSES, n + 1),
  };
});

/* ============================================================================
   ERAs — the 835 files a payer sends back, and what came inside them.
   ========================================================================= */

export const ERA_BATCHES = Array.from({ length: 20 }, (_, n) => {
  const payer = payerAt(n);
  return {
    id: `ERA-${String(9001 + n)}`,
    receivedDate: dateAt(n, 5),
    payer: payer.name,
    payerId: payer.payerId,
    chequeEft: String(6025 - n * 37),
    chequeEftDate: dateAt(n + 2, 5),
    eobCount: at([4, 1, 2, 5, 2, 3, 6, 1], n),
    noMappingClaim: at([0, 0, 1, 0, 0, 2, 0, 0], n),
    noPaymentPosting: at([0, 1, 0, 2, 0, 0, 1, 0], n),
    unreviewed: at([1, 2, 0, 2, 0, 1, 0, 3], n),
    paymentAmount: money(n, 119.13, 47.6),
  };
});

export const ERA_DOWNLOAD_HISTORY = Array.from({ length: 9 }, (_, n) => ({
  id: `ERD-${String(41 + n)}`,
  downloadedOn: dateAt(n, 7),
  period: '11/02/2025 - 11/02/2025',
  pulled: at([18, 11, 10, 16, 14, 15, 20, 5, 1], n),
  alreadyDownloaded: 0,
  duplicates: 0,
  newEras: 1,
  eobsInNew: at([4, 3, 2, 5, 4, 1, 4, 5, 0], n),
  noMappingClaims: at([0, 1, 0, 2, 0, 0, 1, 2, 0], n),
  noPaymentFailure: at([1, 2, 0, 2, 0, 0, 0, 0, 0], n),
  downloadedBy: at(['Amara Mensah', 'Ruth Delaney', 'Kofi Mensah', 'Ruth Delaney'], n),
}));

/** The banner every ERA upload / download dialog reports back. One object so
 *  the two dialogs cannot drift into quoting different numbers. */
export const ERA_TRANSFER_SUMMARY = [
  ['ERAs Download Period', 'Oct 21, 2024 To Sep 31, 2025'],
  ['Number of ERAs available', '22'],
  ['Number of old ERAs', '0 (these ERAs were already uploaded to the system)'],
  ['Number of duplicate ERAs', '0 (there ERAs were available more than once in the file(s))'],
  ['Total ignored ERAs', '0 (these ERAs are ignored from uploading to the system)'],
  ['Number of downloaded ERAs', '17'],
  ['Number of EOBs available in the new ERAs', '198'],
  ['Number of EOBs matched with claims', '198'],
  ['Number of EOBs without a matching claim', '0'],
  ['Number of successful payments', '196'],
  ['Number of payment failures', '2'],
];

export const ERA_LAST_DOWNLOAD = [
  ['Downloaded From', 'Oct 21, 2024'],
  ['Downloaded Till', 'Sept 21, 2025'],
  ['Downloaded By', 'Amara Mensah'],
  ['Downloaded On', 'Nov 10, 2025 09:12PM'],
];

/** Header facts for the ERA Details stage. */
export const ERA_SUMMARY = {
  chequeNumber: '987654',
  generatedDate: '10/08/2026',
  payerName: 'Aetna',
  billedAmount: 12510.0,
  eobsProcessed: 6,
  provider: 'Dr. Amara Mensah',
  npi: '1801559968',
  taxId: '872280761',
  /* Contact details only — the NAME is read off whichever ERA was opened, so
     nothing here may name a payer or the two halves of the screen would
     contradict each other on the same document. */
  payer: {
    address: '2436 Naples Avenue, Panama City FL 32405',
    email: 'edi.remittance@payer-demo.net',
  },
  payee: {
    name: 'MediNova Gastroenterology Clinic',
    address: '5331 Rexford Court, Fargo ND 58104',
    taxId: '123456789',
  },
};

/**
 * The claim lines inside one ERA.
 *
 * `posting` is the whole point of the screen: Not Posted and Unmapped need a
 * human, Mapped is ready for one click, Auto Posted is done. Auto Post walks
 * the first two and leaves anything it cannot match alone.
 */
export const ERA_LINES = [
  {
    id: 'era-line-1', pcn: '465', dos: '08/24/2025', patient: 'Priya Raman',
    billed: 200.0, adjustment: 60.0, allowed: 300.0, payment: 230.0,
    responsibility: 20.0, remaining: 30.0, variance: 'Underpaid',
    processedAs: 'Secondary', posting: 'Not Posted',
    adjustments: [
      { payment: 'Insurance Payment', code: 'PR 1', amount: 230, postedBy: 'Ruth Delaney', postedOn: '12/24/2026' },
      { payment: 'Patient Responsibility', code: 'PR 2', amount: 230, postedBy: '', postedOn: '' },
      { payment: 'Patient Responsibility', code: '', amount: 230, postedBy: '', postedOn: '' },
    ],
  },
  {
    id: 'era-line-2', pcn: '458', dos: '10/30/2025', patient: 'Daniel Okafor',
    billed: 460.0, adjustment: 60.0, allowed: 0.0, payment: 0.0,
    responsibility: 20.0, remaining: 460.0, variance: '',
    processedAs: 'Secondary', posting: 'Unmapped',
    adjustments: [
      { payment: 'Insurance Payment', code: 'PR 1', amount: 0, postedBy: '', postedOn: '' },
      { payment: 'Patient Responsibility', code: 'PR 2', amount: 20, postedBy: '', postedOn: '' },
    ],
  },
  {
    id: 'era-line-3', pcn: '425', dos: '09/15/2025', patient: 'Margaret Whitfield',
    billed: 240.0, adjustment: 60.0, allowed: 300.0, payment: 230.0,
    responsibility: 20.0, remaining: 30.0, variance: 'Overpaid',
    processedAs: 'Primary', posting: 'Mapped',
    adjustments: [
      { payment: 'Insurance Payment', code: 'PR 1', amount: 230, postedBy: 'Ruth Delaney', postedOn: '12/24/2026' },
    ],
  },
  {
    id: 'era-line-4', pcn: '221', dos: '10/30/2025', patient: 'Tomás Herrera',
    billed: 300.0, adjustment: 60.0, allowed: 300.0, payment: 230.0,
    responsibility: 20.0, remaining: 30.0, variance: 'Underpaid',
    processedAs: 'Primary', posting: 'Auto Posted',
    adjustments: [
      { payment: 'Insurance Payment', code: 'PR 1', amount: 230, postedBy: 'Kofi Mensah', postedOn: '12/20/2026' },
    ],
  },
];

/* ============================================================================
   REMITS — the payment advice, before any of it has reached the ledger.

   A remit is the envelope: a cheque or an EFT with a control number, an
   amount, and the claims the payer says that money is for. Nothing has moved
   until it is POSTED, which is the one thing this list exists to do — and a
   biller clears a morning's remits together, not one dialog at a time. Hence
   tick boxes and a batch Post rather than a row menu.

   `source` is how the remit reached the practice — pulled off the clearing
   house, uploaded as an EDI or PDF file, or keyed in by hand — because that is
   what decides how much of it you check before posting it.
   ========================================================================= */

export const REMIT_SOURCES = ['EDI Upload', 'Manual Entry', 'Clearing House'];
export const REMIT_PAYMENT_METHODS = ['EFT', 'Check'];
export const REMIT_SERVICE_TYPES = [
  'Office Visit', 'Colonoscopy', 'Upper GI Endoscopy', 'Telehealth',
];

/**
 * Where a claim on a remit has got to.
 *
 * `Posted` is the end state and the only one the practice controls; the other
 * three are what the payer reported. A remit's own status is DERIVED from
 * these rather than stored beside them — see remitStatus() in the screen —
 * so a remit can never claim to be posted while a claim on it is not.
 */
export const REMIT_CLAIM_STATUSES = ['Submitted Outside', 'Processed', 'Denied', 'Posted'];

/** Control numbers are the payer's, not ours: they vary wildly in length and
 *  carry no pattern, which is exactly why they are listed rather than
 *  generated from an index. */
const REMIT_CONTROL_NUMBERS = [
  '979797', '878994165', '6251498856', '62352645126', '2514545', '265253265',
  '4451236', '78945612', '3365412', '915473820', '5548123', '62145398',
  '7781204', '48120365',
];

const round2 = (value) => Number(value.toFixed(2));

/**
 * One service line, and the two numbers that explain the gap under it.
 *
 * `allowed` is what the payer's fee schedule says the work is worth;
 * `payment` is that less the member's share. Both differences become ERA
 * adjustments on the claim below, so the sub-tables under an expanded claim
 * add up to the claim's own figures rather than merely sitting near them.
 */
function remitServiceLine(seed, index) {
  const procedure = procedureAt(seed + index * 3);
  const charge = procedure.price;
  const allowed = round2(charge * at([0.84, 0.78, 0.9, 0.72], seed + index));
  const coinsurance = round2(allowed * at([0.2, 0, 0.1, 0], seed + index));
  return {
    cpt: procedure.code,
    unit: at([1, 1, 2, 1], seed + index),
    /* A line the payer did not number. Real 835s leave this out more often
       than not, and the column has to read as blank rather than as a zero. */
    lineControl: index === 0 ? '' : String(70412 + seed * 17 + index),
    serviceDate: dateAt(seed + index + 4, 3),
    charge,
    payment: round2(allowed - coinsurance),
    allowed,
  };
}

function remitClaim(seed, index) {
  const lines = Array.from(
    { length: at([1, 2, 1, 3], seed + index) },
    (_, i) => remitServiceLine(seed + index, i)
  );
  const charge = round2(lines.reduce((sum, line) => sum + line.charge, 0));
  const allowed = round2(lines.reduce((sum, line) => sum + line.allowed, 0));
  const insPaid = round2(lines.reduce((sum, line) => sum + line.payment, 0));

  return {
    id: String(8749841 + seed * 613 + index * 7),
    payersClaimId: String(56456545 + seed * 11),
    patient: patientAt(seed + index).name,
    provider: providerAt(seed + index),
    serviceType: at(REMIT_SERVICE_TYPES, seed + index),
    charge,
    insPaid,
    patientResponsibility: round2(charge - insPaid),
    receivedDate: dateAt(seed + index, 4),
    status: at(REMIT_CLAIM_STATUSES, seed + index),
    serviceLines: lines,
    /* The billed-to-paid gap, split the way an 835 splits it: the fee-schedule
       write-off the practice absorbs, and the share that moves to the patient.
       PR is only listed where there is one — a zero-dollar adjustment is a row
       to read for nothing. */
    adjustments: [
      { groupCode: 'CO', reasonCode: '45', amount: round2(charge - allowed) },
      ...(allowed > insPaid
        ? [{ groupCode: 'PR', reasonCode: '2', amount: round2(allowed - insPaid) }]
        : []),
    ],
  };
}

export const REMITS = REMIT_CONTROL_NUMBERS.map((controlNumber, n) => {
  const payer = payerAt(n);
  const claims = Array.from({ length: at([4, 2, 3, 1, 5, 2, 1, 3], n) }, (_, c) => remitClaim(n, c));
  return {
    id: controlNumber,
    controlNumber,
    eraDate: dateAt(n, 2),
    postDate: dateAt(n + 1, 4),
    paymentDate: dateAt(n + 3, 6),
    checkEft: String(4451236 + n * 30341),
    /* Not every remit says how it was paid, and the column shows that as a
       dash rather than inventing an EFT nobody recorded. */
    paymentMethod: at(['EFT', 'Check', '', 'EFT'], n),
    payer: payer.name,
    payerId: payer.payerId,
    billingProvider: at(BILLING_PROVIDERS, n),
    source: at(REMIT_SOURCES, n),
    /* The header total IS the claims underneath added up. A remit whose
       banner and table disagreed would be the first thing a biller stopped
       trusting, so there is only one number and the other reads it. */
    amount: round2(claims.reduce((sum, claim) => sum + claim.insPaid, 0)),
    payerRouting: String(236512 + n * 7),
    payerAccount: String(32568452 + n * 131),
    receiverRouting: String(625412365 + n * 11),
    receiverAccount: String(156425875 + n * 17),
    claims,
  };
});

/* ============================================================================
   CLAIM DETAIL — the shape the Scrub Error / Correct Claim / Denial stages
   all render. One template: the three stages differ in their banner, their
   footer and their rail, never in the claim itself.
   ========================================================================= */

/** Every scrub rule this prototype knows how to fail. */
export const SCRUB_ERRORS = [
  'The diagnosis must be properly linked to the procedure code, ensuring that the diagnosis supports the CPT.',
  'The appropriateness of any applied modifiers should be validated.',
  'The place of service must be compatible with the selected CPT code.',
  'NPI validation should be performed for rendering, billing, and referring providers.',
];

/** The 837 loop/segment errors a clearing house rejection comes back with. */
export const REJECTION_ERRORS = [
  { loop: '2000B SBR', category: 'Eligibility', description: 'Subscriber not eligible for benefits on DOS', action: 'Edit Insurance' },
  { loop: '2010 NM1', category: 'Provider Information', description: 'Invalid Rendering Provider NPI', action: 'Edit Provider' },
  { loop: '2010 NM1', category: 'Provider Information', description: 'Missing Billing Provider NPI', action: 'Edit Provider' },
  { loop: '2300 CLM', category: 'Claim-Level', description: 'Invalid Claim Frequency Code', action: 'Edit Claim Details' },
];

export const REJECTION_SUMMARY = {
  claimId: 'CLM-1023',
  statusCode: 'A2:109:IL',
  rejectedAt: 'April 9, 2026, 03:45 PM',
  clearingHouse: 'Availity',
};

/**
 * A drug on a claim, priced out of the charge master.
 *
 * A medication code is defined as a quantity of drug — "propofol, 10 mg" —
 * so the line carries how many units were given and what one unit costs, and
 * the amount billed is the two multiplied. Nothing here writes that product
 * down as a third number: medicationTotal() in data/master.js does the
 * multiplication, and the line keeps the fee and the units it came from so
 * the claim can show its working.
 *
 * The NDC rides along because a payer will not adjudicate a drug line without
 * it. It comes off the code, which is the only place it is recorded — one
 * product, one NDC, whatever modifier this particular line ends up carrying.
 *
 * The unit price is read out of the code's dated schedule rather than off a
 * field, so a line keeps being worth what it was worth the day it was given.
 *
 * Allowed is the blended share the rest of this fixture uses; a payer's real
 * answer on a drug line is its own contract's business.
 */
function medicationLine(code, pointer) {
  const drug = CPT_CODES.find((c) => c.code === code);
  const billed = medicationTotal(drug);
  return {
    code: drug.code,
    description: drug.description,
    ndc: drug.ndc,
    unitFee: currentFee(drug),
    billed,
    allowed: Math.round(billed * 0.8 * 100) / 100,
    qty: Number(drug.units).toFixed(2),
    pointer,
  };
}

export const CLAIM_DETAIL_TEMPLATE = {
  otherDetails: {
    priResubmissionCode: 'Replacement',
    dcnIcnPri: '456376546',
    paperWorkSendMode: 'NA - Not Applied',
    delayReasonCode: '-',
    resubmissionReason: '-',
  },
  service: {
    location: 'MediNova Gastroenterology — Fargo',
    placeOfService: '11 - Office',
    dateOfService: '10/24/2025',
    priorAuthorization: '-',
  },
  providers: [
    { role: 'Billing Provider', name: 'Dr. Amara Mensah', npi: '456376546' },
    { role: 'Referring Provider', name: 'Dr. John Reyes', npi: '213456461' },
    { role: 'Rendering provider', name: 'Dr. Amara Mensah', npi: '456376546' },
    { role: 'Ordering Provider', name: 'Dr. John Reyes', npi: '213456461' },
  ],
  payment: { method: 'Insurance', insuranceName: 'Aetna' },
  icd: [
    { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
    { code: 'K58.0', description: 'Irritable bowel syndrome with diarrhea' },
    { code: 'D50.9', description: 'Iron deficiency anaemia, unspecified' },
    { code: 'Z00.00', description: 'Encounter for general adult medical examination' },
  ],
  cpt: [
    { code: '45378', description: 'Colonoscopy, diagnostic', billed: 1850, allowed: 1480, qty: '1.00', pointer: '1:2:0:0' },
    { code: '43235', description: 'Upper GI endoscopy, diagnostic', billed: 1400, allowed: 1120, qty: '1.00', pointer: '1:2:0:0' },
    { code: '99214', description: 'Established patient visit, detailed', billed: 200, allowed: 160, qty: '1.00', pointer: '1:0:0:0' },
    { code: '99213', description: 'Established patient visit, expanded', billed: 150, allowed: 120, qty: '1.00', pointer: '3:0:0:0' },
    // The sedation the endoscopy above ran under, billed the way a drug is:
    // fifty units of a code defined as 10 mg, at fifty cents a unit. See
    // medicationLine() — the amount is not typed here, it is the master's fee
    // times the master's units, so a price changed in Settings changes what
    // this claim bills.
    medicationLine('J2704', '2:0:0:0'),
  ],
  collected: [
    { label: 'Co-pay Collected', amount: 20, state: 'Paid' },
    { label: 'Co-insurance Collected', amount: 20, state: 'Paid' },
    { label: 'Deductible Collected', amount: 20, state: 'Unpaid' },
  ],
  note: 'Patient called — insurance updated per conversation.',
  /* The two fields that fail scrubbing in this fixture. The stage marks them
     so "four errors" up top has somewhere to point to down here. */
  invalidFields: ['placeOfService', 'billingNpi'],
  invalidIcd: 'K58.0',
};

/**
 * Right-rail facts. The stage reads the claim row for name, MRN, payer and
 * provider, and the patient pool for sex and date of birth; what is left here
 * is only the contact and policy detail no worklist row carries. The two
 * patient fields below are the fallback for a name that is not in the pool.
 */
export const CLAIM_RAIL_TEMPLATE = {
  patient: {
    gender: '—',
    dob: '—',
    phone: '(701) 555-0157',
    address: '919 Fairbanks Ave, Fargo ND 58103',
  },
  insurance: {
    type: 'Primary',
    number: 'AET-563728104',
    name: 'Aetna',
    memberId: 'MBR90217456',
    groupId: 'AET-GRP-88912',
    effective: '04/13/2025 - 04/13/2026',
    lastChecked: '04/13/2026',
  },
  appointment: {
    provider: 'Dr. Amara Mensah',
    type: 'Follow up (30 min)',
    service: 'Gastroenterology consultation',
    dateTime: '08/24/2025, 10:00 AM',
    location: 'MediNova Gastroenterology — Fargo',
    reason: 'GORD, poor PPI response',
  },
};

/** Timeline for a denied claim, newest first. */
export const CLAIM_HISTORY_TEMPLATE = [
  { title: 'Partially Denied by Payer', date: '5/12/2026', meta: 'ERA #161 · Aetna · PR-119' },
  { title: 'Payment Posted — $15.00', date: '5/12/2026', meta: 'ERA #161 · Aetna · PR-119' },
  { title: 'Claim Submitted', date: '5/12/2026', meta: 'Aetna · Dr. Amara Mensah' },
  { title: 'Claim Created', date: '5/12/2026', meta: 'DOS: 05/12/2026' },
];

/* ============================================================================
   EOB — what came back for one claim, as a document and as line detail.
   ========================================================================= */

/** The payer's plain-text remittance advice, shown as-is. It is a fixed-width
 *  document, so it is stored as text rather than rebuilt out of markup. */
export const EOB_REMITTANCE_TEXT = `Aetna Health Insurance                                         REMITTANCE
2436 Naples Avenue                                                ADVICE
Panama City FL 32405
(888) 888-8888

MediNova Gastroenterology Clinic          NPI #:        1801559968
5331 Rexford Court                      PAGE #:       1 of 1
Fargo ND 58104                          DATE:         2026-03-17
                                        EFT #:        782325984-1773735012
                                        TAX ID #:     999999999

REND PROV  SERV DATE   POS NOS  PROC   MODS   BILLED  ALLOWED  DEDUCT  COINS   GRP/RC-AMT   PROV PD
NAME RAMAN, PRIYA      HIC XYZ12345678  ACNT 312       ICN TST782325984   ASG Y   MOA
1111111112 0307 030726    1  45378              333.00  266.40    0.00   10.00  CO-45  66.60   251.40
                                                                                PR-3    5.00
1111111112 0307 030726    1  99214               30.00   24.00    0.00   10.00  CO-45   6.00    14.00
1111111112 0307 030726    1  99213              120.00   96.00    0.00   10.00  CO-45  24.00    81.00
                                                                                PR-3    5.00
PT RESP      40.00        CLAIM TOTALS   483.00  386.40    0.00   30.00  106.60  NET   346.40
ADJ TO TOTAL: PREV PD          INTEREST    0.00   LATE FILING CHARGE     0.00

TOTALS:   # OF     BILLED   ALLOWED  DEDUCT   COINS    TOTAL    PROV PD   PROV      CHECK
          CLAIMS   AMT      AMT      AMT      AMT      RC-AMT   AMT       ADJ AMT   AMT
            1      483.00   386.40    0.00    30.00    106.60   346.40      0.00    346.40

GLOSSARY : GROUP, REASON, MOA, REMARK AND REASON CODES
CO-45  Charge exceeds fee schedule/maximum allowable or contracted arrangement.
PR-3   Co-payment amount.`;

export const EOB_DETAIL_TEMPLATE = {
  checkEftDate: 'Aug 10, 2025',
  checkEftNumber: 'A2834823082803',
  encounterDate: 'Sept 21, 2025',
  invoice: 'INV - 1397',
  checkEftAmount: 200.0,
  generatedDate: 'Oct 15, 2025',
  paymentMethod: 'EFT',
  altCheckEft: 'A873494299996',
  patientControl: 'Oct17654',
  memberId: 'W09786756545',
  claimStatus: 'Processed As Primary',
  claimCharge: 210.57,
  claimPayment: 0.0,
  payerClaimControl: '23729134293829010',
  lines: [
    {
      dos: '11/02/2025', procedure: '99215 (1.0)', billed: 87.7, allowed: 800.0, paid: 600.0,
      respAmount: 87.7, respReason: 'PR 1 - Deductible', adjAmount: 43.9, adjReason: 'CO 45',
      payerAmount: '-', payerReason: '-', processed: '99215', remark: '-',
    },
    {
      dos: '10/27/2025', procedure: '99215 (1.0)', billed: 36.9, allowed: 36.9, paid: 0.0,
      respAmount: 10.0, respReason: 'PR 1 - Deductible', adjAmount: 49.7, adjReason: 'CO 45',
      payerAmount: '-', payerReason: '-', processed: '90833', remark: '-',
    },
  ],
  totals: { billed: 124.6, allowed: 124.6, paid: 0.0, resp: 124.6, adj: 93.6, payer: 0 },
};

/** Codes the EOB footer explains, so a reader is never left decoding CO-45. */
export const EOB_LEGEND = [
  ['PR', 'Patient Responsibility — PR 1 is the deductible amount.'],
  ['CO', 'Contractual Obligations — CO 45 is the amount over the fee schedule.'],
];

/* ============================================================================
   POST PAYMENT + SECONDARY CLAIM
   ========================================================================= */

export const POST_PAYMENT_SUMMARY = {
  totalCharges: 390.0,
  allowable: 312.0,
  insuranceAdjustment: 78.0,
  insurancePayment: 282.0,
  secondaryInsurancePayment: null,
  deductible: 0.0,
  coInsurance: 20.0,
  coPay: 10.0,
  writeOff: 0.0,
  patientPayment: 0.0,
  checkInPayment: 0.0,
  remainingBalance: 390.0,
};

export const SECONDARY_CLAIM_TEMPLATE = {
  primary: {
    name: 'Blue Cross Blue Shield of North Dakota', memberId: 'ZYX1234567',
    plan: 'BCBSND Choice', group: 'TechWorks Inc.', groupNumber: '452198',
  },
  secondary: {
    name: 'Medica', memberId: 'ZYX1234899',
    plan: 'Medica Prime', group: 'Veridian Dynamics', groupNumber: '546853',
  },
  eligibility: 'Coverage',
  provider: { name: 'Dr. Luca Bianchi', npi: '137254836683', department: 'Gastroenterology' },
  services: [
    { dos: '11/28/2025', cpt: '45378', description: 'Colonoscopy, diagnostic', modifier: '-', charge: 0.0, allowed: 0.0, adjustment: 230, responsibility: 0.0 },
    { dos: '03/27/2026', cpt: '43235', description: 'Upper GI endoscopy, diagnostic', modifier: '56', charge: 230, allowed: 230, adjustment: 230, responsibility: 0.0 },
    { dos: '04/01/2026', cpt: '99214', description: 'Established patient visit, detailed', modifier: '-', charge: 230, allowed: 160, adjustment: 230, responsibility: 100.0 },
    { dos: '09/17/2025', cpt: '99213', description: 'Established patient visit, expanded', modifier: '-', charge: 0.0, allowed: 230, adjustment: 230, responsibility: 0.0 },
  ],
};

/* ============================================================================
   CMS-1500 — the paper claim facsimile. Field boxes are numbered the way the
   real form numbers them, so the modal can be read against a printed one.
   ========================================================================= */

export const CMS1500_TEMPLATE = [
  { num: '1', label: 'MEDICARE / MEDICAID / TRICARE / CHAMPVA / GROUP HEALTH PLAN / FECA / OTHER', value: '', checks: ['Medicare', 'Medicaid', 'Tricare', 'Champva', 'Group', 'FECA', 'Other'], checked: 'Group' },
  { num: '1a', label: "INSURED'S I.D. NUMBER (For Program in Item 1)", value: 'AET-563728104' },
  { num: '2', label: "PATIENT'S NAME (Last Name, First Name, Middle Initial)", value: 'Raman, Priya' },
  { num: '3', label: "PATIENT'S BIRTH DATE / SEX", value: '03 | 14 - 1968   F' },
  { num: '4', label: "INSURED'S NAME (Last Name, First Name, Middle Initial)", value: 'Raman, Priya' },
  { num: '5', label: "PATIENT'S ADDRESS (No., Street)", value: '919 Fairbanks Ave' },
  { num: '6', label: 'PATIENT RELATIONSHIP TO INSURED', value: 'Self' },
  { num: '7', label: "INSURED'S ADDRESS (No., Street)", value: '919 Fairbanks Ave' },
  { num: '8', label: 'CITY / STATE / ZIP CODE', value: 'Fargo, ND 58103' },
  { num: '9', label: 'OTHER INSURED’S POLICY OR GROUP NUMBER', value: '-' },
  { num: '10', label: "IS PATIENT'S CONDITION RELATED TO — EMPLOYMENT / AUTO / OTHER", value: 'No' },
  { num: '11', label: "INSURED'S POLICY / GROUP NUMBER", value: 'AET-GRP-88912' },
  { num: '21', label: 'DIAGNOSIS OR NATURE OF ILLNESS OR INJURY', value: 'A. K21.9   B. K58.0   C. D50.9   D. Z00.00' },
  { num: '24', label: 'PROCEDURES, SERVICES OR SUPPLIES', value: '45378 · 43235 · 99214 · 99213' },
  { num: '25', label: 'FEDERAL TAX I.D. NUMBER', value: '872280761' },
  { num: '28', label: 'TOTAL CHARGE', value: '$3,600.00' },
  { num: '33', label: 'BILLING PROVIDER INFO & PH #', value: 'MediNova Gastroenterology Clinic · (701) 555-0100' },
];

/* ============================================================================
   UB-04 (CMS-1450) — the INSTITUTIONAL claim form.

   The other half of the pair the worklist offers. A CMS-1500 bills the
   clinician's professional work; a UB-04 bills the facility that housed it —
   the room, the scope, the recovery bay. An endoscopy done at Red River ASC
   generates both, to two different payer addresses, which is why the row menu
   offers them as two separate documents rather than one "print claim".

   Field boxes carry the form's own locator numbers so the modal can be read
   against a printed one, same as CMS1500_TEMPLATE above.
   ========================================================================= */

export const UB04_TEMPLATE = [
  { num: '1', label: 'BILLING PROVIDER NAME, ADDRESS & TELEPHONE', value: 'Red River ASC · 5331 Rexford Court, Fargo ND 58104 · (701) 555-0100' },
  { num: '3a', label: 'PATIENT CONTROL NUMBER', value: 'PCN-312' },
  { num: '3b', label: 'MEDICAL RECORD NUMBER', value: '884120' },
  { num: '4', label: 'TYPE OF BILL', value: '831 — Ambulatory surgery centre, admit through discharge' },
  { num: '5', label: 'FEDERAL TAX NUMBER', value: '872280761' },
  { num: '6', label: 'STATEMENT COVERS PERIOD (FROM / THROUGH)', value: '10/24/2025 — 10/24/2025' },
  { num: '8', label: 'PATIENT NAME', value: 'Raman, Priya' },
  { num: '9', label: 'PATIENT ADDRESS', value: '919 Fairbanks Ave, Fargo ND 58103' },
  { num: '10', label: 'PATIENT BIRTHDATE', value: '03/14/1968' },
  { num: '11', label: 'PATIENT SEX', value: 'F' },
  { num: '12', label: 'ADMISSION DATE', value: '10/24/2025' },
  { num: '14', label: 'PRIORITY (TYPE) OF VISIT', value: '3 — Elective' },
  { num: '15', label: 'POINT OF ORIGIN FOR ADMISSION', value: '1 — Physician referral' },
  { num: '17', label: 'PATIENT DISCHARGE STATUS', value: '01 — Discharged to home or self care' },
  { num: '42', label: 'REVENUE CODE', value: '0360 · 0370 · 0250' },
  { num: '43', label: 'REVENUE DESCRIPTION', value: 'Operating room services · Anaesthesia · Pharmacy' },
  { num: '44', label: 'HCPCS / RATE / HIPPS CODE', value: '45378 · 43235' },
  { num: '45', label: 'SERVICE DATE', value: '10/24/2025' },
  { num: '46', label: 'SERVICE UNITS', value: '1 · 1 · 1' },
  { num: '47', label: 'TOTAL CHARGES', value: '$3,600.00' },
  { num: '48', label: 'NON-COVERED CHARGES', value: '$0.00' },
  { num: '50', label: 'PAYER NAME', value: 'Blue Cross Blue Shield of North Dakota' },
  { num: '51', label: 'HEALTH PLAN IDENTIFICATION NUMBER', value: 'BCBSND-88912' },
  { num: '56', label: 'BILLING PROVIDER NPI', value: '1801559968' },
  { num: '58', label: "INSURED'S NAME", value: 'Raman, Priya' },
  { num: '59', label: 'PATIENT RELATIONSHIP TO INSURED', value: '18 — Self' },
  { num: '60', label: "INSURED'S UNIQUE IDENTIFIER", value: 'AET-563728104' },
  { num: '66', label: 'DIAGNOSIS VERSION QUALIFIER', value: '0 — ICD-10-CM' },
  { num: '67', label: 'PRINCIPAL DIAGNOSIS CODE', value: 'K21.9' },
  { num: '67A', label: 'OTHER DIAGNOSIS CODES', value: 'K58.0 · D50.9 · Z00.00' },
  { num: '74', label: 'PRINCIPAL PROCEDURE CODE & DATE', value: '45378 — 10/24/2025' },
  { num: '76', label: 'ATTENDING PROVIDER NAME & NPI', value: 'Mensah, Amara · NPI 456376546' },
  { num: '77', label: 'OPERATING PROVIDER NAME & NPI', value: 'Mensah, Amara · NPI 456376546' },
];

/* ============================================================================
   AR MANAGEMENT — what is still owed, and how long it has been owed for.

   Ageing is DERIVED, never stored. Every receivable here is a document with a
   billing date; its age is that date measured against an as-of date, and a
   bucket is a range of ages. Nothing carries a "0-30 Days" field of its own.

   That matters because the AR screens let both ends move: the as-of date is a
   control on the screen, and so is the width of a bucket. A row that stored
   which column it belonged in would keep claiming the same column after the
   user changed either one — the classic AR report bug, where the buckets no
   longer add up to the total beside them.

   So the shape is: patient accounts hold SUPERBILLS, payer accounts hold
   CLAIMS, and both the aged columns and the chart above them are sums over
   those documents computed at read time. The Total column is the account's
   own outstanding balance, and it agrees with the buckets because it is the
   same set of documents added up without being split.
   ========================================================================= */

/** The point every age on the AR screens is measured from unless the user
 *  picks another. Same day the claim fixtures call today, so a claim 40 days
 *  old in Claims is 40 days old in AR. */
export const AR_AS_OF = stamp(CLAIM_TODAY);

/** How wide one ageing column is. Thirty is the industry's default and the
 *  screen's; fifteen splits the near end for a practice chasing early, sixty
 *  collapses it for one that only cares about the far end. Four columns of
 *  the chosen width, then everything older in a fifth — so the last column is
 *  always the one that hurts. */
export const AR_BUCKET_WIDTHS = [15, 30, 60];
export const AR_DEFAULT_BUCKET_WIDTH = 30;

/**
 * The ageing columns for a bucket width: four finite, then the overflow.
 *
 * Exported rather than rebuilt per screen because three things read it — the
 * chart's groups, the patient table's columns and the insurance table's — and
 * a chart bucketed differently from the table under it is a report that
 * contradicts itself.
 */
export function arBuckets(width = AR_DEFAULT_BUCKET_WIDTH) {
  const finite = Array.from({ length: 4 }, (_, i) => {
    const from = i * width + (i === 0 ? 0 : 1);
    const to = (i + 1) * width;
    return { key: `b${i}`, label: `${from}-${to} Days`, from, to };
  });
  return [
    ...finite,
    { key: 'b4', label: `${4 * width}+ Days`, from: 4 * width + 1, to: Infinity },
  ];
}

/** Which column an age falls in. Ages below zero belong to nothing: the
 *  document had not been billed yet on the as-of date being asked about. */
export function arBucketKey(age, width = AR_DEFAULT_BUCKET_WIDTH) {
  if (!Number.isFinite(age) || age < 0) return null;
  return arBuckets(width).find((bucket) => age <= bucket.to)?.key ?? 'b4';
}

/* --- The documents ----------------------------------------------------------
   Ages walk a fixed ladder from a fortnight to nearly a year so that every
   column has something in it at all three bucket widths — a report whose
   right-hand columns are empty at every setting cannot be read for the thing
   it exists to show. */

const AR_AGES = [12, 26, 41, 54, 68, 83, 97, 112, 128, 147, 166, 189, 214, 241, 268, 295, 19, 33, 47, 61];

/** Round to cents, and never hand a negative balance to a receivable — a
 *  credit is a different document and does not belong on an ageing report. */
const arMoney = (value) => Math.max(0, Number(value.toFixed(2)));

/**
 * PATIENT AR — what the patient still owes after the payer has done whatever
 * it was going to do.
 *
 *   Balance = Bill Amount − Claim Paid − Co-Pay Paid
 *
 * One formula, applied to every superbill, so the Balance column can be
 * checked against the four columns beside it by anyone who doubts it. A
 * superbill the payer has not paid at all leaves nearly the whole charge
 * sitting on the patient, which is exactly the row a biller is hunting for.
 */
export const AR_PATIENT_ACCOUNTS = BILLING_PATIENTS.map((patient, n) => ({
  id: patient.mrn,
  patient: patient.name,
  superbills: Array.from({ length: 5 }, (_, k) => {
    const seq = n * 5 + k;
    const age = at(AR_AGES, seq);
    const billAmount = arMoney(80 + ((seq * 37) % 21) * 20);
    const claimAmount = arMoney(billAmount * 0.75);
    /* Every fourth superbill is one the payer never paid — that is where a
       patient balance the size of the whole charge comes from. */
    const claimPaid = seq % 4 === 0 ? 0 : arMoney(claimAmount * at([1, 0.6, 0.85], seq));
    const coPay = arMoney(20 + (seq % 5) * 10);
    const coPayPaid = seq % 3 === 0 ? 0 : arMoney(coPay / 2);
    return {
      id: `SB-${String(34500 + seq)}`,
      /* Billed a few days after the visit, and it is the BILLING date the
         clock runs from — a claim is not outstanding before it is raised. */
      dos: daysAgo(age + at([3, 5, 6], seq)),
      billedOn: daysAgo(age),
      age,
      billAmount,
      claimAmount,
      claimPaid,
      coPay,
      coPayPaid,
      balance: arMoney(billAmount - claimPaid - coPayPaid),
    };
  }),
}));

/**
 * INSURANCE AR — what the payer still owes on claims it has been sent.
 *
 *   Balance = Claim Amount − Paid Amount
 *
 * The allowed amount less what actually arrived. Billed is shown too because
 * the gap between billed and allowed is the contractual write-off, which is
 * not a receivable and must not be chased as one.
 *
 * All eight payers, not just the active six: a payer can be switched off in
 * Master while claims sent before that are still unpaid, and dropping them
 * from the ageing report is how money goes missing.
 */
export const AR_INSURANCE_ACCOUNTS = PAYERS.map((payer, n) => ({
  id: payer.payerId,
  payer: payer.name,
  claims: Array.from({ length: 5 }, (_, k) => {
    const seq = n * 5 + k;
    const age = at(AR_AGES, seq * 3 + 1);
    const patient = patientAt(seq + 2);
    const billAmount = arMoney(140 + ((seq * 53) % 24) * 25);
    const claimAmount = arMoney(billAmount * 0.8);
    const paidAmount = seq % 3 === 0 ? 0 : arMoney(claimAmount * at([0.5, 0.7, 0.35], seq));
    return {
      id: `CLM-${String(27400 + seq)}`,
      patient: patient.name,
      dos: daysAgo(age + at([4, 7, 9], seq)),
      billedOn: daysAgo(age + 2),
      submittedOn: daysAgo(age),
      age,
      billAmount,
      claimAmount,
      paidAmount,
      balance: arMoney(claimAmount - paidAmount),
    };
  }),
}));

/* ============================================================================
   PATIENT COLLECTION — what the PATIENT still owes once insurance has
   finished, and how far up the chasing ladder it has got.

   The other half of AR. AR Management ▸ Patient REPORTS this money: how much,
   how old. This is the WORKLIST over it — one row per patient account, ordered
   by what has to happen to it next, and ticked in batches when a notice goes
   out.

   Totals and ageing are derived from the CHARGES and never stored on the
   account, for the reason the AR fixtures give: the ageing bucket and the
   Total Outstanding sit in adjacent columns, and the moment either becomes a
   field of its own they can disagree.
   ========================================================================= */

/**
 * The chasing ladder, in the order a balance climbs it.
 *
 * These six words are BOTH the quick-view chips and the Status column. The
 * design spells them twice — a chip reading "Statement due" over a status
 * reading "Statements", "Ready to escalate" over "For review" — which leaves
 * the reader to work out that the two are the same thing. One vocabulary in
 * both places, so the chip that says 64 selects exactly the 64 rows whose
 * Status column says the same word back.
 */
export const COLLECTION_STATUSES = [
  'New balance',
  'Statement due',
  'Ready to escalate',
  'Notice sent',
  'Payment plan',
  'With agency',
];

export const COLLECTION_STATUS_TONE = {
  'New balance': 'info',
  'Statement due': 'neutral',
  'Ready to escalate': 'info',
  'Notice sent': 'warning',
  'Payment plan': 'success',
  'With agency': 'critical',
};

/** Where the charge was incurred. The clinic bills the visit, the surgical
 *  centre bills the procedure, and one patient can owe both at once — which is
 *  why they are two columns rather than one column with an entity label. */
export const COLLECTION_ENTITIES = ['Clinic', 'ASC'];

/**
 * Under this, chasing costs more than collecting.
 *
 * The balance is still shown and still counted — it is genuinely owed — but
 * the row is marked, so nobody spends a certified letter on $18.40. Exported
 * because the worklist marks the row with it AND the filter bar offers it, and
 * two copies of the number would eventually be two different numbers.
 */
export const SMALL_BALANCE_THRESHOLD = 25;

/** The ageing bands this worklist works by. Narrower at the near end than the
 *  AR report's flat thirty-day steps, because that is where the decisions are:
 *  the difference between a balance 30 days old and one 50 days old is the
 *  difference between a statement and a phone call, and one "30-59" column
 *  would hide it. */
export const COLLECTION_BUCKETS = ['0–29', '30–44', '45–59', '60–89', '90+'];

const COLLECTION_BUCKET_MAX = [29, 44, 59, 89, Infinity];

/** Which band an age in days falls in. One function, read by the row, the chip
 *  count and the filter — the three things that have to agree. */
export function collectionBucket(age) {
  const index = COLLECTION_BUCKET_MAX.findIndex((max) => age <= max);
  return COLLECTION_BUCKETS[index === -1 ? COLLECTION_BUCKETS.length - 1 : index];
}

/** Attempts to reach the patient, offered as a band rather than an exact
 *  count: "three or more" is the question a collections clerk actually asks,
 *  and six options for six counts is not. */
export const COLLECTION_ATTEMPT_BANDS = [
  { value: '0', label: 'None', match: (n) => n === 0 },
  { value: '1-2', label: '1–2', match: (n) => n >= 1 && n <= 2 },
  { value: '3+', label: '3 or more', match: (n) => n >= 3 },
];

/* --- What a patient is being chased for ----------------------------------- */

const COLLECTION_CLINIC_SERVICES = [
  'Office visit — established patient',
  'Office visit — new patient',
  'Nurse visit, injection',
  'Telehealth consultation',
  'Laboratory — iron studies',
  'Dietitian consultation',
];

const COLLECTION_ASC_SERVICES = [
  'Colonoscopy, diagnostic',
  'Upper GI endoscopy',
  'Polypectomy with snare',
  'Capsule endoscopy',
  'Oesophageal manometry',
  'Anaesthesia — monitored',
];

/* --- Building the list -------------------------------------------------------
   212 accounts split across the ladder exactly as the design shows: 88 new, 64
   due a statement, 31 ready to escalate, 22 noticed, 5 on a plan, 2 gone to an
   agency. They add to 212 because every account is on exactly one rung, which
   is what makes the "All" chip a real total rather than a coincidence. */

const COLLECTION_MIX = [88, 64, 31, 22, 5, 2];

/**
 * How old the oldest unpaid charge is, per rung.
 *
 * The ladder and the clock are one story: a balance is new because nobody has
 * chased it yet, and it is with an agency because everything else was tried
 * over four months. Bands rather than one age per rung, so the ageing column
 * still has spread inside a single chip.
 */
const COLLECTION_AGE_BANDS = {
  'New balance': [2, 28],
  'Statement due': [18, 52],
  'Ready to escalate': [44, 76],
  'Notice sent': [68, 124],
  'Payment plan': [38, 112],
  'With agency': [126, 205],
};

/** Attempts made, per rung. A new balance has had none by definition; an
 *  account at an agency has had everything. */
const COLLECTION_ATTEMPTS = {
  'New balance': [0, 0],
  'Statement due': [1, 2],
  'Ready to escalate': [2, 3],
  'Notice sent': [3, 4],
  'Payment plan': [2, 3],
  'With agency': [4, 5],
};

/* Two pools crossed into a 256-name grid and walked at an odd stride, so no
   two of the 212 accounts land on the same person. The pools are the FIRST and
   LAST names of the sixteen patients the rest of Billing uses, so the grid
   reproduces those sixteen exactly somewhere inside it: the Marcus Webb chased
   here is recognisably the Marcus Webb whose claim is in the worklist, not a
   second roster invented for collections. */
const COLLECTION_FIRST = BILLING_PATIENTS.map((patient) => patient.name.split(' ')[0]);
const COLLECTION_LAST = BILLING_PATIENTS.map((patient) => patient.name.split(' ').slice(1).join(' '));

/** Spread within a band, deterministically and without clustering. */
const spread = (i, [min, max]) => min + ((i * 37) % (max - min + 1));

/**
 * One patient's outstanding charges.
 *
 * The oldest is `age` days old — that is what put the account on its rung —
 * and any others are younger, because a patient who owes for one visit tends
 * to come back before they pay. Which entity billed decides the size: a clinic
 * visit is tens to hundreds, a procedure at the surgical centre is thousands,
 * and that gap is the reason the two are separate columns rather than one.
 */
function collectionCharges(i, age) {
  const mix = i % 3;
  const ascOnly = mix === 1;
  const clinicOnly = mix === 2;

  /* Every twenty-ninth account is a sub-threshold one — a single small clinic
     balance nobody should be spending a stamp on. They exist so the marker on
     the row, and the filter that puts them aside, have something to act on. */
  const tiny = i % 29 === 5;

  const charges = [];
  const push = (entity, amount, chargeAge, description) =>
    charges.push({
      id: `CHG-${String(50000 + i * 4 + charges.length)}`,
      date: daysAgo(chargeAge),
      age: chargeAge,
      entity,
      description,
      amount: Number(amount.toFixed(2)),
    });

  if (tiny) {
    push('Clinic', 8.4 + ((i * 3) % 14), age, at(COLLECTION_CLINIC_SERVICES, i));
    return charges;
  }

  if (!ascOnly) {
    push('Clinic', 42 + ((i * 53) % 600), age, at(COLLECTION_CLINIC_SERVICES, i));
    if (i % 4 === 0) {
      push('Clinic', 38 + ((i * 29) % 260), Math.max(1, age - 21), at(COLLECTION_CLINIC_SERVICES, i + 3));
    }
  }
  if (!clinicOnly) {
    push('ASC', 890 + ((i * 617) % 19000), ascOnly ? age : Math.max(1, age - 9), at(COLLECTION_ASC_SERVICES, i));
  }
  return charges;
}

/** Which rung each of the 212 accounts sits on, in mix order. */
const COLLECTION_LADDER = COLLECTION_STATUSES.flatMap((status, s) =>
  Array.from({ length: COLLECTION_MIX[s] }, () => status)
);

export const PATIENT_COLLECTIONS = COLLECTION_LADDER.map((_, n) => {
  /* Position n of the worklist holds account i, and the RUNG is read at i too
     — so the ladder is scrambled in the output rather than merely relabelled.
     Reading the status straight off n instead would put all 88 new balances
     on the first nine pages, which is not what a queue looks like and would
     make the first page of every filter identical. 97 is coprime with 212, so
     every account is still visited exactly once. */
  const i = (n * 97) % COLLECTION_LADDER.length;
  const status = COLLECTION_LADDER[i];
  const grid = (i * 77) % 256;

  const age = spread(i, COLLECTION_AGE_BANDS[status]);
  const charges = collectionCharges(i, age);

  const sumOf = (entity) => Number(charges
    .filter((charge) => charge.entity === entity)
    .reduce((total, charge) => total + charge.amount, 0)
    .toFixed(2));

  /* A notice is a document that was actually posted, so only the rungs past it
     carry a date; a plan is Active only on the rung that IS a plan. A row
     reading "Payment plan · Active" beside a status of New balance would be
     two different accounts printed on one line. */
  const noticed = status === 'Notice sent' || status === 'With agency' || status === 'Payment plan';
  const paying = status === 'Payment plan';

  return {
    /* Offset before the stride so account zero is not #10000 with an MRN of
       all noughts — the one row a reader would take for a placeholder. Both
       multipliers stay coprime with their modulus, so both stay unique. */
    id: String(10000 + (((i + 7) * 27361) % 89999)),
    patient: `${COLLECTION_FIRST[grid % 16]} ${COLLECTION_LAST[Math.floor(grid / 16)]}`,
    mrn: `2026${String(1000000 + (((i + 13) * 7919) % 8999999))}`,
    clinic: sumOf('Clinic'),
    asc: sumOf('ASC'),
    /* Days since the OLDEST unpaid charge — the one the ageing band is read
       from. A newer charge on the same account does not make the old one any
       less overdue. */
    age: Math.max(...charges.map((charge) => charge.age)),
    attempts: spread(i, COLLECTION_ATTEMPTS[status]),
    status,
    lastNotice: noticed ? daysAgo(Math.max(3, Math.round(age / 3))) : '',
    planStatus: paying ? 'Active' : '',
    /* Anybody on a plan has by definition paid something. Elsewhere a part
       payment is the exception, which is the point of the column: a balance
       that has had money against it recently is chased differently from one
       that has had none at all.

       Capped at the age of the account, because a payment cannot land before
       the charge it was against — on a balance four days old, "last payment
       six weeks ago" is money paid towards nothing. */
    lastPayment: paying
      ? daysAgo(Math.min(spread(i, [2, 26]), age))
      : i % 5 === 0 ? daysAgo(Math.min(spread(i, [8, 60]), age)) : '',
    charges,
  };
});
