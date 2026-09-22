/**
 * DEMO DATA — every figure below is invented. No real practice, payer,
 * provider or patient is described here.
 *
 * THE REPORT CATALOGUE
 *
 * The twelve reports the practice runs, each declared rather than hand-built,
 * so a new report is an entry here and nothing else.
 *
 * THE COLUMNS ARE THE SYSTEM'S, NOT OURS. Every report below was rebuilt
 * against a screen of the live report it replaces, so the headings are the
 * headings a biller already knows — "Serv", "Chgs %", "Total WRVU", "Male
 * Denominator", "Pmt Code" — down to the ones that read oddly out of context.
 * Where a reference screen showed only its parameters and not its columns
 * (Patient by Carrier, ASC-09), the columns follow the parameters, and the
 * comment on that report says so.
 *
 * WHY DECLARE THEM
 * Twelve reports written as twelve screens would be twelve versions of the
 * same period navigator, the same tiles, the same export. They differ in what
 * a row IS and what is counted on it — nothing else. So a report says:
 *
 *   dimension   what one row of the table is (a location, a code, a provider)
 *   metrics     the raw numbers recorded against that row, per day
 *   columns     what the table shows — a metric, or something derived from
 *               metrics AFTER they are added up
 *   groups      spans across the header, for columns that come in families
 *   stats       the tiles above the table, from the same vocabulary
 *
 * OR, for the three whose rows are records rather than summaries:
 *
 *   kind        'detail'
 *   perDay      how many records a working day produces
 *   record()    one record, built from the pools below
 *   columns     marked `field`, naming what the record holds
 *
 * AND, ON EITHER KIND, WHAT IT IS RUN WITH
 *
 *   params      THE PARAMETER SHEET. What this report is run WITH, in the
 *               order the practice's own report asks for it: the providers,
 *               the sites, the codes, the bill type, the grouping, and the
 *               tick boxes it ends with. One entry per control; see the
 *               chapter on them below.
 *
 *   facets      What a summary report's figures can be attributed to besides
 *               the dimension they are grouped by — a performing provider, a
 *               code, a bill type. Every fact draws one of each, so those
 *               parameters narrow the report and Group By can regroup it.
 *
 * THE PARAMETERS ARE THE REPORT'S OWN, and they are not the same on any two
 * of them. Nothing here is a generic filter bar: End of year AR is run for
 * providers, sites, codes and a bill type; Patient by Carrier is run for a
 * carrier and a payer group and nothing else; ASC-09 is run for a site and a
 * provider. What each one asks is copied from the parameter panel of the
 * report it replaces — no more, and no fewer.
 *
 * and js/lib/report-screen.js renders every one of them. Time keeps its own
 * screen: it is a timesheet with corrections, an audit trail and a payroll
 * export, which is a different thing from a report over counts.
 *
 * WHY DERIVED COLUMNS ARE DERIVED
 * A rate is computed from the totals, never averaged from the days. Four days
 * at 50% and one day at 0% is not "40% for the week" unless every day had the
 * same denominator, and they never do — one Friday clinic is half a Tuesday.
 * Metrics add up; rates are worked out once, at the end, from what added up.
 *
 * NOTHING HERE IS RANDOM
 * Figures are generated, but from a hash of (report, row, date) — so the same
 * day always yields the same numbers, on every reload and on every machine. A
 * reviewer who refreshes must not watch a total move. See value().
 */

/* Two of the parameter vocabularies belong to the practice rather than to the
   reports, and are read from where the practice keeps them: a bill type is
   the one on the location form, and a billing group is the one a patient is
   assigned to on their billing tab. A report that offered its own list of
   either would be offering answers no other screen agrees with. */
import { BILLING_TYPES } from './practice.js';
import { BILLING_GROUPS } from './registration.js';

/* ============================================================================
   THE PARAMETER SHEET

   A report in the practice management system is not opened, it is RUN: you
   fill in a sheet of parameters and press Go. This is that sheet, declared.

   WHAT IS NOT ON IT. The period and the business are on neither — they are the
   same two questions on all twelve reports and they live in the header beside
   Export, where they are answered once and stay answered as the reader moves
   down the rail. What is left here is what differs report to report, which is
   the only thing worth putting behind a button.

   ONE ENTRY PER CONTROL

     name        where the answer is kept, and what a column or a fact names
                 to be narrowed by it
     label       the practice's own wording for the parameter, verbatim
     control     'select' (a dropdown, multi unless `single`), 'date', or
                 'check' (a tick box)
     options     the vocabulary, or the string 'rows' for "this report's own
                 rows" — the six locations, the nine carriers — which keeps
                 the catalogue from writing them out twice
     single      one answer, with `empty` naming the answer meaning "all"
     empty       the row a single-answer dropdown shows when nothing is
                 chosen. It is an ANSWER, not a question: "All bill types",
                 or the default a Group By already has

   WHAT AN ANSWER DOES

     on          the key it narrows: a field on a detail report's record, or a
                 facet on a summary report's facts. Without it the parameter
                 shapes the report rather than narrowing it
     bound       'from' or 'to', for the pair of controls that are one range
     attr        narrows a summary report's ROWS by an attribute they carry —
                 payer group, which is a property of the carrier and not a
                 thing that happens on a day
     groupBy     this parameter chooses what a row is
     reportBy    this parameter chooses which provider the work is attributed
                 to, which is what "Provider" then means to Group By
     details     this tick box is the one that opens a grouped table back up
                 into the lines under each group
     splitBy     { group, field } — a field the grouping key gains when this
                 box is ticked, and the one grouping where that means
                 anything: "Split CPT with modifiers" splits a table grouped
                 by code and does nothing to one grouped by site
     excludes    { field, value } records that are only included when this box
                 is ticked — "Show rescheduled"
     totals      totals declarations merged over the report's own when this
                 box is ticked, which is how "Include unsigned services"
                 widens a denominator without a second set of columns

   A COLUMN MAY ANSWER TO A PARAMETER TOO, and says so itself rather than
   being listed somewhere else:

     only        drawn only when that tick box is on (patient details)
     hidden      not drawn when that tick box is on (the secondary column,
                 under "primary insurance only")
     lens        drawn only while that parameter is unanswered or holds this
                 value — the male columns of the adenoma report, under a
                 Gender of Male or of nothing at all. Declared against an
                 empty value it reads the other way about: drawn only while
                 nothing has been answered, which is what a column comparing
                 both genders needs
   ========================================================================= */

/* ============================================================================
   DETERMINISTIC FIGURES

   FNV-1a over the fact's identity, then murmur3's finaliser to avalanche it.
   Cheap, stable, and — the point — a pure function of what the fact IS rather
   than of when the page happened to load.

   The finaliser is not decoration. FNV alone leaves neighbouring strings
   correlated in their high bits, and every seed here is a neighbour of every
   other: the same report, the same day, one word different. Without it, "was
   this complication severe?" came back yes for every event in a month, which
   is a hash artefact reading as a very bad month.
   ========================================================================= */

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A stable 0–1 for one (report, row, date, metric). */
function unit(seed) {
  return hash(seed) / 0x100000000;
}

/* ============================================================================
   DATES

   Whole dates throughout, never fixed millisecond steps: a report range that
   is out by an hour across a daylight-saving change quietly moves a Monday's
   clinic into the previous week.
   ========================================================================= */

export function dayId(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(value, days) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/* ============================================================================
   THE VOCABULARY

   Four ways to say what a metric is, and three ways to derive a column from
   metrics once they are added up. Everything in the catalogue below is one of
   these seven things.

   METRICS (recorded per row, per day — they add up)
     range: [lo, hi]        an independent count or amount
     of + share: [lo, hi]   a fraction of another metric on the same day, so a
                            subset can never exceed the set it came out of
     of + minus             the remainder of another metric, same reason
     of + chance            a rare whole event, rolled once per case rather
                            than taken as a fraction — see value()
     fixed                  a constant rather than a generated figure

   A ROW may narrow any of those for itself with `tune` — see buildFacts().
   Attributes it simply carries (a benchmark, a turnaround target) live in
   `attrs` and are shown by a column marked `attr`.

   COLUMNS (worked out from the totals)
     metric                 the total itself
     rate: [part, whole]    a percentage, computed once from both totals
     per: [part, whole]     an incidence, e.g. events per 1,000 procedures
     share                  this row's total as a percentage of the column's
   ========================================================================= */

/** One fact's value, in the order the report declares its metrics. */
function value(spec, seed, sofar) {
  if (spec.fixed !== undefined) return spec.fixed;

  /* A RARE WHOLE EVENT, not a fraction of one.
     Complications are the case for this. Taking 1.2% of eighteen procedures
     and rounding gives zero every single day, and a column of zeros that can
     never be anything else reads as a broken report rather than as a good
     week. So the trial is run per case: eighteen cases, each with its own
     stable roll against the rate, and the day sometimes has one. */
  if (spec.of && spec.chance !== undefined) {
    const trials = Math.min(Math.round(sofar[spec.of] ?? 0), 2000);
    let hits = 0;
    for (let i = 0; i < trials; i += 1) {
      if (unit(`${seed}|${spec.key}|${i}`) < spec.chance) hits += 1;
    }
    return hits;
  }

  if (spec.of && spec.share) {
    const [lo, hi] = spec.share;
    const fraction = lo + unit(`${seed}|${spec.key}`) * (hi - lo);
    return round(sofar[spec.of] * fraction, spec.decimals ?? 0);
  }

  if (spec.of && spec.minus) {
    return Math.max(0, round(sofar[spec.of] - sofar[spec.minus], spec.decimals ?? 0));
  }

  const [lo, hi] = spec.range;
  return round(lo + unit(`${seed}|${spec.key}`) * (hi - lo), spec.decimals ?? 0);
}

function round(n, decimals) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Every fact a report records between two dates, one per row per working day.
 *
 * Built on demand rather than held in memory: the catalogue covers sixteen
 * reports over any range a reader cares to step back to, and materialising all
 * of that up front would be several hundred thousand numbers nobody asked for.
 */
export function buildFacts(report, from, to) {
  const facts = [];

  for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
    const weekday = day.getDay();

    /* A closed clinic has no clinic day, and a zero row for a Sunday nobody
       worked reads as a bad day rather than as no day. Snapshot reports —
       A/R aging is the one — are recorded once a week instead, on the Friday
       the practice actually runs the report. */
    if (report.cadence === 'weekly' ? weekday !== 5 : weekday === 0 || weekday === 6) continue;

    const date = dayId(day);

    for (const row of report.rows) {
      const metrics = {};
      for (const spec of report.metrics) {
        /* A row may narrow the report's own range for itself. Cecal intubation
           and adenoma detection are both "met out of eligible", and a single
           range across every measure would put detection at 90% and intubation
           at 80% — the first impossible, the second a serious finding. What a
           measure is expected to run at belongs to the measure. */
        const tuned = row.tune?.[spec.key] ? { ...spec, ...row.tune[spec.key] } : spec;
        metrics[spec.key] = value(tuned, `${report.id}|${row.id}|${date}`, metrics);
      }
      facts.push({ date, row: row.id, metrics, facets: facetsFor(report, row, date) });
    }
  }

  return facts;
}

/**
 * WHAT ELSE A DAY'S FIGURES CAN BE ATTRIBUTED TO.
 *
 * A summary fact is "what happened at this location on this day". That is the
 * only thing it was, and it is why the year-end report could be narrowed by
 * location and by nothing else: a parameter sheet asking for four providers,
 * eighteen codes and a bill type had nothing on the fact to compare them
 * against.
 *
 * So a fact now also carries ONE DRAW OF EACH FACET the report declares — the
 * provider it is attributed to, the code it was mostly, the bill type it went
 * out under. Drawn from the same hash as everything else, so a Tuesday in
 * March is the same Tuesday on every machine and a reader who reruns the
 * report with the same parameters gets the same answer.
 *
 * ONE DRAW PER DAY, AND IT IS A SIMPLIFICATION WORTH NAMING. A real day at a
 * real site is worked by three providers under two bill types, and this
 * attributes it to one of each. What it buys is that every parameter on the
 * sheet genuinely narrows the report, and that narrowing it by a provider
 * takes the figures down by about what that provider's share of the days is.
 * What it costs is that combining four parameters at once cuts hard — which
 * is also true of the real report, and the empty state says so plainly.
 *
 * The dimension the report is grouped by is a facet like the rest, holding the
 * row's own id. That is what lets Group By regroup the same facts by provider
 * or by code without any of this knowing which one is "the" dimension.
 */
function facetsFor(report, row, date) {
  const facets = { [report.dimensionKey ?? 'dimension']: row.id };

  for (const [name, list] of Object.entries(report.facets ?? {})) {
    if (name in facets) continue;
    const point = unit(`${report.id}|${row.id}|${date}|${name}`);
    facets[name] = list[Math.min(list.length - 1, Math.floor(point * list.length))];
  }

  return facets;
}

/* ============================================================================
   THE POOLS A DETAIL ROW IS DRAWN FROM

   Three of these reports are not summaries at all. Payment Analysis, Posted
   Procedures and the cancellation report each put ONE ROW PER RECORD on the
   page — a payment, a posted charge line, a cancelled appointment — carrying
   the patient, the code and the money. That is what the reference screens
   show, and it is a different shape from everything else here: there is no
   dimension to group by, because the row is the transaction.

   So those reports declare `record()` instead of `metrics`, and draw the
   words in it from the lists below. The lists are short on purpose — a
   hundred invented patient names would not make the prototype any more
   convincing than twenty, and every one of them is another name to check is
   nobody's.

   NOTHING HERE IS A REAL PERSON, PRACTICE OR PAYER. The reference screens
   carry the live practice's own providers, sites and patients; none of them
   are reproduced. What is kept from them is the SHAPE — two surgical sites,
   an infusion centre and three outreach clinics; a pathology-and-endoscopy
   code set; a payment file that arrives mostly as ERA — because the shape is
   what the columns have to fit.
   ========================================================================= */

const LOCATIONS = [
  'GastroEMR Gastroenterology ASC',
  'GastroEMR Gastroenterology Clinic',
  'DGI Infusion Center',
  'North Valley Hospital OP',
  'Prairie Health OP North',
  'Prairie Health OP West',
];

const PROVIDERS = [
  'Amara Mensah, MD',
  'Luca Bianchi, MD',
  'Sana Nakamura, MD',
  'Chidi Okafor, MD',
  'Elena Reyes, NP',
];

const REFERRERS = [
  'Priya Raman, MD',
  'Tom Aldridge, MD',
  'Bea Okonkwo, DO',
  'Frank Sowande, MD',
  'Ingrid Halvorsen, MD',
  'Self-referred',
];

const CARRIERS = [
  'Blue Cross Blue Shield of North Dakota',
  'Medicare Part B',
  'Sanction Health Plan',
  'UnitedHealthcare',
  'Aetna',
  'Humana Gold Plus (HMO)',
  'North Dakota Medicaid',
  'Self-pay',
];

/* Surname, forename — how a worklist sorts, and how every reference screen
   here prints a patient. */
const PATIENTS = [
  'Abbott, Marcia',
  'Bergstrom, Neil',
  'Castellano, Rosa',
  'Duarte, Philip',
  'Eriksen, Hannah',
  'Fontaine, Gregory',
  'Gallagher, Imelda',
  'Hoffmann, Werner',
  'Iyer, Divya',
  'Jankowski, Tomasz',
  'Keller, Marianne',
  'Lindqvist, Oskar',
  'Mbeki, Naledi',
  'Nakagawa, Kenji',
  'Ortega, Beatriz',
  'Pemberton, Alastair',
  'Quintero, Lucia',
  'Rasmussen, Erik',
  'Sandoval, Teresa',
  'Thibault, Camille',
];

/* Code, its wording and the work RVU CMS assigns it. The endoscopy and
   pathology families the reference screens list, trimmed to the ones a
   report actually shows more than once. */
const CPT = [
  { code: '43235', label: 'Upper GI endoscopy, diagnostic', rvu: 2.26 },
  { code: '43239', label: 'Upper GI endoscopy with biopsy', rvu: 2.59 },
  { code: '43249', label: 'Upper GI endoscopy with dilation', rvu: 3.05 },
  { code: '43270', label: 'Upper GI endoscopy with ablation', rvu: 4.51 },
  { code: '44388', label: 'Colonoscopy through stoma', rvu: 3.31 },
  { code: '45378', label: 'Colonoscopy, diagnostic', rvu: 3.36 },
  { code: '45380', label: 'Colonoscopy with biopsy', rvu: 3.98 },
  { code: '45385', label: 'Colonoscopy with snare polypectomy', rvu: 4.57 },
  { code: '45388', label: 'Colonoscopy with ablation', rvu: 5.3 },
  { code: '45390', label: 'Colonoscopy with mucosal resection', rvu: 6.05 },
  { code: '88305', label: 'Pathology, tissue exam, level IV', rvu: 0.75 },
  { code: '88312', label: 'Special stain, microorganism', rvu: 0.59 },
  { code: 'G0105', label: 'Colorectal screening, high risk', rvu: 3.36 },
  { code: 'G0121', label: 'Colorectal screening, not high risk', rvu: 3.36 },
  /* The clinic side, marked so the reports that are about PROCEDURES can
     leave it out — which is the difference between the two saved versions of
     the same code report. */
  { code: '99203', label: 'Office visit, new patient, level III', rvu: 1.6, office: true },
  { code: '99213', label: 'Office visit, established, level III', rvu: 1.3, office: true },
  { code: '99214', label: 'Office visit, established, level IV', rvu: 1.92, office: true },
  { code: '99204', label: 'Office visit, new patient, level IV', rvu: 2.6, office: true },
  { code: '96365', label: 'Infusion, initial hour', rvu: 0.21, office: true },
  /* The catch-all. It carries no RVU because CMS assigns none — the fee is
     agreed case by case — and it appears on the reference productivity screen
     with money against it and no work credited, which is exactly what an
     unlisted code looks like. */
  { code: '99199', label: 'Unlisted special service or report', rvu: 0, office: true },
];

const MODIFIERS = ['', '', '', '', '33', '59', 'PT', 'XU'];

/* ----------------------------------------------------------------------------
   THE PARAMETERS' OWN VOCABULARIES

   The lists a parameter offers that are not already one of the pools above.
   Two of them are borrowed rather than restated: a bill type and a billing
   group mean the same thing here as they do on the location form and on a
   patient's billing tab, and a second copy of either would be the place they
   drift apart.
   ------------------------------------------------------------------------- */

/* The department a charge is posted against. Endoscopy is the ASC's own; the
   others are the practice's. Same shape as the cost centres on the location
   form — see js/screens/location-form.js. */
const COST_CENTRES = [
  'Endoscopy',
  'Infusion',
  'Pathology',
  'Anaesthesia',
  'Clinic',
];

/* What a carrier IS, for the reports that are run by class of payer rather
   than by payer. Kept beside the carriers so the two cannot disagree — a
   report grouped by payer group and one filtered by carrier have to add up to
   the same money. */
const PAYER_GROUP_OF = {
  'Blue Cross Blue Shield of North Dakota': 'Commercial',
  'Medicare Part B': 'Medicare',
  'Sanction Health Plan': 'Commercial',
  UnitedHealthcare: 'Commercial',
  Aetna: 'Commercial',
  'Humana Gold Plus (HMO)': 'Medicare Advantage',
  'North Dakota Medicaid': 'Medicaid',
  'WSI North Dakota': 'Workers compensation',
  'Self-pay': 'Self-pay',
};

const PAYER_GROUPS = [...new Set(Object.values(PAYER_GROUP_OF))];

/* The posting batch a payment arrived in. An ERA file is one batch for the
   whole day; a desk takes its card payments in two. A biller who has to
   unpost something asks for the batch by name, which is why it is a
   parameter at all. */
const BATCHES = [
  'ERA 835 — morning file',
  'ERA 835 — afternoon file',
  'Front desk — AM',
  'Front desk — PM',
  'Lockbox — cheques',
  'Patient portal — overnight',
];

/* Every screening colonoscopy is one of four things, and the adenoma report
   is only ever run over some of them. */
const COLONOSCOPY_TYPES = [
  'Screening — average risk',
  'Screening — high risk',
  'Surveillance',
  'Diagnostic',
];

const GENDERS = ['Male', 'Female'];

/* ----------------------------------------------------------------------------
   WHICH COMPANY BILLED IT

   The practice is two businesses that share a waiting room: the ASC bills its
   facility fee as one company and everything else bills as the other. The
   header's Business picker is that question, and it is the same question on
   every report, so it is answered from the SITE rather than from a field of
   its own — a charge posted at the ASC is the ASC's business by definition,
   and a second field saying so would be a second thing to keep in step.
   ------------------------------------------------------------------------- */

const BUSINESS_OF = {
  'GastroEMR Gastroenterology ASC': 'GastroEMR Gastroenterology ASC',
  'GastroEMR Gastroenterology Clinic': 'GastroEMR Gastroenterology LTD',
  'DGI Infusion Center': 'GastroEMR Gastroenterology LTD',
  /* The two outreach hospitals and the second Prairie site are places the
     practice's clinicians work rather than places it owns, so the professional
     fee is billed by the LTD. */
  'North Valley Hospital OP': 'GastroEMR Gastroenterology LTD',
  'Prairie Health OP North': 'GastroEMR Gastroenterology LTD',
  'Prairie Health OP West': 'GastroEMR Gastroenterology LTD',
};

export const BUSINESSES = [...new Set(Object.values(BUSINESS_OF))];

/**
 * The company a site bills as, or null for a row that is not about a site at
 * all — a carrier, a survey composite. Nothing is narrowed by business unless
 * it can say which one it belongs to; guessing would be worse than not asking.
 */
export function businessOf(location) {
  return BUSINESS_OF[location] ?? null;
}

/* ICD-10 with the ICD-9 it replaced, because the reference screen prints both
   columns side by side — a practice that has claims older than 2015 on file
   still reconciles against the legacy code. */
const DIAGNOSES = [
  { icd10: 'K21.9', icd9: '530.81', label: 'GORD without oesophagitis' },
  { icd10: 'K57.30', icd9: '562.10', label: 'Diverticulosis of large intestine' },
  { icd10: 'K64.4', icd9: '455.6', label: 'Residual haemorrhoidal skin tags' },
  { icd10: 'D12.6', icd9: '211.3', label: 'Benign neoplasm of colon' },
  { icd10: 'Z12.11', icd9: 'V76.51', label: 'Screening for colon neoplasm' },
  { icd10: 'K50.90', icd9: '555.9', label: "Crohn's disease, unspecified" },
  { icd10: 'R19.7', icd9: '787.91', label: 'Diarrhoea, unspecified' },
  { icd10: 'K92.1', icd9: '578.1', label: 'Melaena' },
];

/* What a payment is, and where it came from. The code is the practice's own
   posting code — the thing that tells a cheque from an ERA on a ledger. */
const PAYMENT_CODES = [
  { code: 'IPP', label: 'Insurance payment — ERA', share: 0.46 },
  { code: 'ICK', label: 'Insurance payment — cheque', share: 0.1 },
  { code: 'PCD', label: 'Patient payment — card', share: 0.18 },
  { code: 'PPT', label: 'Patient payment — portal', share: 0.12 },
  { code: 'PCK', label: 'Patient payment — cheque', share: 0.08 },
  { code: 'PLN', label: 'Payment plan instalment', share: 0.06 },
];

const CANCEL_REASONS = [
  'Patient cancelled',
  'Patient rescheduled',
  'No-show',
  'Provider unavailable',
  'Room or equipment unavailable',
  'Prep incomplete',
  'Authorisation not in place',
  'Weather or transport',
];

const CANCELLED_BY = ['Patient', 'Front desk', 'Scheduler', 'Provider', 'Billing'];

const COMPLAINTS = [
  'Screening colonoscopy',
  'Surveillance colonoscopy',
  'Rectal bleeding',
  'Abdominal pain',
  'Dysphagia',
  'Reflux review',
  'IBD follow-up',
  'Iron infusion',
  'Anaemia workup',
  'Chronic diarrhoea',
];

const ACTIVITIES = [
  'Colonoscopy',
  'Upper endoscopy',
  'Office visit — new',
  'Office visit — established',
  'Infusion',
  'Telehealth',
];

/* ============================================================================
   ROWS THAT ARE RECORDS, NOT SUMMARIES

   Everything above builds FACTS: a figure per dimension member per day, added
   up into one row per member. Three of these reports are not that shape at
   all. Payment Analysis, Posted Procedures and the cancellation report each
   put one row per RECORD on the page — a payment, a posted charge line, a
   cancelled appointment — carrying a patient, a code, a place and an amount.
   There is nothing to group by, because the row IS the transaction.

   So those reports declare `record()` instead of `metrics`, and the renderer
   pages through what comes back rather than aggregating it. A total is still
   drawn, but only under the columns that are money: summing a column of MRNs
   would be arithmetic on an identifier.

   The generator is the same one the facts use — a hash of what the record IS,
   so the fourth payment on a Tuesday in March is the same payment on every
   reload and on every machine.
   ========================================================================= */

/* ----------------------------------------------------------------------------
   WHAT BELONGS TO THE PATIENT, NOT TO THE ROW

   An MRN, a date of birth and a telephone number are facts about a person, and
   a person who appears on four payment lines has one of each. Generating them
   from the row's own seed gave the same patient a different MRN every time
   they appeared, which is not a cosmetic problem: "Patients" on a report of
   four hundred payments then counted four hundred, because every identifier
   was unique. Keyed off the name instead, the tile counts people.
   ------------------------------------------------------------------------- */

/** Six digits, always six — a five-character MRN ragged-lefts the column. */
function mrnFor(name) {
  return String(100000 + Math.floor(unit(`mrn|${name}`) * 899999));
}

/** Old enough to be having a colonoscopy, and the same age next time. */
function bornFor(name) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = 1938 + Math.floor(unit(`dob|y|${name}`) * 50);
  const month = 1 + Math.floor(unit(`dob|m|${name}`) * 12);
  const day = 1 + Math.floor(unit(`dob|d|${name}`) * 28);
  return `${pad(month)}/${pad(day)}/${year}`;
}

function phoneFor(name) {
  const exchange = 200 + Math.floor(unit(`tel|a|${name}`) * 799);
  const line = String(Math.floor(unit(`tel|b|${name}`) * 9999)).padStart(4, '0');
  return `701-${exchange}-${line}`;
}

/** A deterministic source of values for one record. */
function recorder(seed) {
  const at = (key) => unit(`${seed}|${key}`);

  const helpers = {
    unit: at,
    int: (key, lo, hi) => Math.round(lo + at(key) * (hi - lo)),
    money: (key, lo, hi) => round(lo + at(key) * (hi - lo), 2),
    pick: (key, list) => list[Math.min(list.length - 1, Math.floor(at(key) * list.length))],

    /* A pick that respects how often a thing actually happens. Half of a
       practice's payment lines are one ERA file being posted; an even pick
       across six payment codes would put as many cheques on the page as
       electronic remittances, which is not what a payment file looks like. */
    weighted: (key, list) => {
      const total = list.reduce((sum, item) => sum + item.share, 0);
      let point = at(key) * total;
      for (const item of list) {
        point -= item.share;
        if (point <= 0) return item;
      }
      return list[list.length - 1];
    },

    /** A date some days before the record's own — a service before its payment. */
    daysBefore: (key, day, lo, hi) =>
      dayId(addDays(day, -Math.round(lo + at(key) * (hi - lo)))),

    /** A clock time inside the working day, on the quarter hour. */
    clock: (key, fromHour, toHour) => {
      const slot = Math.round(at(key) * (toHour - fromHour) * 4);
      const hour = fromHour + Math.floor(slot / 4);
      const minute = (slot % 4) * 15;
      const suffix = hour < 12 ? 'am' : 'pm';
      const twelve = hour % 12 === 0 ? 12 : hour % 12;
      return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
    },

    /** A posting reference — what a biller quotes when they ring the payer. */
    reference: (key, prefix) => `${prefix}-${String(Math.floor(at(key) * 999999)).padStart(6, '0')}`,
  };

  return helpers;
}

/**
 * Every record a detail report holds between two dates.
 *
 * Weekends are skipped for the same reason the facts skip them: a closed
 * clinic posts no payments, and an empty Sunday between two busy Fridays
 * reads as a bad day rather than as no day.
 */
export function buildRecords(report, from, to) {
  const records = [];

  for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    const date = dayId(day);
    const [lo, hi] = report.perDay;
    const count = Math.round(lo + unit(`${report.id}|${date}|count`) * (hi - lo));

    for (let n = 0; n < count; n += 1) {
      records.push(report.record(recorder(`${report.id}|${date}|${n}`), day, date));
    }
  }

  return records;
}


/* ============================================================================
   ONE COLUMN SET, THREE SAVED REPORTS

   DPGI TB, RRM and RRM Procedures are the same report template in the practice
   management system, saved three times under three names. They offer the same
   seventeen columns — the code and what it is, the work it was worth, the
   money it raised and collected, and where and by whom it was billed — and
   what differs between them is the parameters each was saved with.

   So the columns are declared ONCE here and shared. Three hand-written copies
   of seventeen headings would drift the first time one of them was corrected,
   and the whole reason the reader recognises these reports is that "Chgs %"
   means the same thing on all three.

   WHY THE ROW IS A LINE, not a code. Seventeen columns include a service
   date, a billing provider and a location, and there is exactly one level at
   which all three of those are true at once: the posted line. A row that was
   a CPT code would have to answer "which date?" and "which provider?" with a
   shrug, and a column that shrugs is worse than a column that is not there.
   The real report reaches the same place from the other direction — its
   "Show Grouping Details" is this, the lines under a group.

   Chgs % and Pmnt % are each line's share of every line's, which is why they
   are the one thing on a detail row that needs the whole report to work out.
   See fieldCell() in js/lib/report-screen.js.
   ========================================================================= */

const PROCEDURE_COLUMNS = [
  { key: 'code', label: 'Code', field: true },
  { key: 'modifiers', label: 'Modifiers', field: true },
  /* WHO THE LINE WAS FOR, and only when the sheet asks. The reference screen's
     seventeen columns have no patient on them: this is a report about codes
     and money, run over a whole month, and a patient column would make every
     line unique and the table twice as long to read. "Show patient details"
     is the parameter that wants it — a biller who has found a group and now
     needs the names inside it — so the two columns arrive together with it
     and go away with it. */
  { key: 'patient', label: 'Patient', field: true, only: 'patientDetails' },
  { key: 'mrn', label: 'MRN', field: true, only: 'patientDetails' },
  { key: 'wrvu', label: 'WRVU', field: true, format: 'rvu' },
  { key: 'description', label: 'Description', field: true },
  { key: 'serv', label: 'Serv', field: true, total: 'sum' },
  { key: 'units', label: 'Units', field: true, total: 'sum' },
  { key: 'totalWrvu', label: 'Total WRVU', field: true, format: 'rvu', total: 'sum' },
  { key: 'serviceDate', label: 'Service of Date', field: true },
  { key: 'charges', label: 'Charges', field: true, format: 'money', total: 'sum' },
  { key: 'chgsPct', label: 'Chgs %', field: true, share: 'charges' },
  { key: 'payments', label: 'Payments', field: true, format: 'money', total: 'sum' },
  { key: 'pmntPct', label: 'Pmnt %', field: true, share: 'payments' },
  { key: 'adjustments', label: 'Adjustments', field: true, format: 'money', total: 'sum' },
  { key: 'refunds', label: 'Refunds', field: true, format: 'money', total: 'sum' },
  { key: 'netAr', label: 'NET A/R', field: true, format: 'money', total: 'sum' },
  { key: 'billingProvider', label: 'Billing Provider', field: true },
  { key: 'location', label: 'Location', field: true },
];

const PROCEDURE_STATS = [
  { label: 'Lines posted', count: true },
  { label: 'Units', field: 'units' },
  { label: 'Total WRVU', field: 'totalWrvu', format: 'rvu' },
  { label: 'Charges', field: 'charges', format: 'money' },
  { label: 'Payments', field: 'payments', format: 'money' },
  { label: 'NET A/R', field: 'netAr', format: 'money' },
];

/**
 * One posted line, from whichever slice of the code set the report covers.
 *
 * The money is worked out in order and never independently: what was paid is a
 * share of what was charged, what was written off is a share of the same, and
 * the net A/R is what those leave behind. Generated as four unrelated figures
 * they would not reconcile, and a revenue report whose columns do not add up
 * is worse than no revenue report.
 */
function procedureLine(codes) {
  return (r, day, date) => {
    const cpt = r.pick('cpt', codes);
    const patient = r.pick('patient', PATIENTS);
    const carrier = r.pick('carrier', CARRIERS);
    const location = r.pick('loc', LOCATIONS);
    /* One specimen jar is one service and several blocks are several units;
       everything else here is billed one to one. */
    const pathology = cpt.code.startsWith('88');
    const units = pathology ? r.int('units', 1, 4) : 1;

    const charges = round(units * (cpt.rvu * 168 + r.unit('fee') * 140), 2);
    const payments = round(charges * (0.44 + r.unit('pay') * 0.28), 2);
    const adjustments = round(charges * (0.22 + r.unit('adj') * 0.22), 2);
    /* A refund is a rare whole event — a credit balance somebody actually
       sent back — not a slice off every line. */
    const refunds = r.unit('refund') < 0.012 ? round(payments * (0.1 + r.unit('rf') * 0.4), 2) : 0;

    return {
      code: cpt.code,
      modifiers: r.pick('mod', MODIFIERS),
      wrvu: cpt.rvu,
      description: cpt.label,
      serv: 1,
      units,
      totalWrvu: round(units * cpt.rvu, 2),
      serviceDate: date,
      charges,
      payments,
      adjustments,
      refunds,
      netAr: round(charges + refunds - payments - adjustments, 2),
      performing: r.pick('perf', PROVIDERS),
      billingProvider: r.pick('bill', PROVIDERS),
      location,
      /* WHAT THE PARAMETER SHEET ASKS FOR, AND THE COLUMNS DO NOT SHOW.
         The template's seventeen columns are the ones the reference screen
         prints, and its parameter panel asks for six things that are not
         among them — the cost centre, the billing group, the payer group, the
         carrier, the bill type and the patient. They are on the line
         regardless, because a report you can run for a payer group but whose
         lines do not know their payer group is a report that cannot answer
         its own parameters. Two of them become columns when "Show patient
         details" is ticked; the rest narrow and stay unseen. */
      patient,
      mrn: mrnFor(patient),
      carrier,
      payerGroup: PAYER_GROUP_OF[carrier] ?? 'Commercial',
      /* Pathology is read wherever the specimen goes; anaesthesia is only ever
         the suite's. Everything else follows the site it was done at. */
      costCentre: cpt.code.startsWith('88')
        ? 'Pathology'
        : location === 'GastroEMR Gastroenterology ASC'
          ? 'Endoscopy'
          : location === 'DGI Infusion Center'
            ? 'Infusion'
            : 'Clinic',
      billingGroup: r.pick('grp', BILLING_GROUPS),
      /* The ASC bills the facility half of a case; a professional fee is
         billed wherever the clinician was standing. */
      billType: location === 'GastroEMR Gastroenterology ASC' ? 'Facility' : 'Professional',
    };
  };
}

/** The endoscopy and pathology codes — everything but an office visit. */
const PROCEDURE_CODES = CPT.filter((cpt) => !cpt.office);

/* ============================================================================
   THE PARAMETER SHEETS

   Built rather than written out, for the same reason the columns are: DPGI TB,
   RRM and RRM Procedures are one saved report three times, and their sheets
   are identical down to the order of the tick boxes. Three hand-written copies
   of thirteen parameters would drift the first time one of them was corrected.

   What differs between them is only which code set the CPT parameter offers —
   the whole book for the two practice-wide ones, the suite's own list for RRM
   Procedures — so that is the argument.
   ========================================================================= */

/** A code, shown as a biller reads it: the number first, the wording after. */
const cptOptions = (codes) =>
  codes.map((cpt) => ({ value: cpt.code, label: `${cpt.code} — ${cpt.label}` }));

/** Every whole year between two ages, for the pair of Age dropdowns. */
const ageOptions = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, n) => String(from + n));

/**
 * The sheet the three procedure-template reports are run from.
 *
 * Nine things to narrow by, a bill type, a grouping, and the three switches
 * that decide how much of the answer is shown — which is the panel the
 * reference screen puts up, in its order.
 */
const procedureParams = (codes) => [
  { name: 'performing', label: 'Performing Provider', control: 'select', on: 'performing', options: PROVIDERS },
  { name: 'billingProvider', label: 'Billing Provider', control: 'select', on: 'billingProvider', options: PROVIDERS },
  { name: 'costCentre', label: 'Cost Center(s)', control: 'select', on: 'costCentre', options: COST_CENTRES },
  { name: 'location', label: 'Location', control: 'select', on: 'location', options: LOCATIONS },
  { name: 'billingGroup', label: 'Billing Group', control: 'select', on: 'billingGroup', options: BILLING_GROUPS },
  { name: 'payerGroup', label: 'Payer Group', control: 'select', on: 'payerGroup', options: PAYER_GROUPS },
  { name: 'code', label: 'CPT Code', control: 'select', on: 'code', options: cptOptions(codes) },
  { name: 'carrier', label: 'Carrier', control: 'select', on: 'carrier', options: CARRIERS },
  {
    name: 'billType',
    label: 'Bill Type',
    control: 'select',
    single: true,
    empty: 'All bill types',
    on: 'billType',
    options: BILLING_TYPES,
  },
  /* UNGROUPED IS THE DEFAULT, and it is what the seventeen columns were drawn
     for: one line per posted charge. Choosing a grouping collapses the table
     to one row per group with the money added up, which is the shape the
     report is read in when somebody wants the answer rather than the working
     — and "Show grouping details" opens it back up. */
  {
    name: 'groupBy',
    label: 'Grouping By',
    control: 'select',
    single: true,
    empty: 'Ungrouped — one row per line',
    groupBy: true,
    options: [
      { value: 'code', label: 'CPT Code' },
      { value: 'performing', label: 'Performing Provider' },
      { value: 'billingProvider', label: 'Billing Provider' },
      { value: 'location', label: 'Location' },
      { value: 'carrier', label: 'Carrier' },
      { value: 'payerGroup', label: 'Payer Group' },
      { value: 'costCentre', label: 'Cost Center' },
      { value: 'billingGroup', label: 'Billing Group' },
    ],
  },
  {
    name: 'groupingDetails',
    label: 'Show Grouping Details',
    control: 'check',
    details: true,
  },
  { name: 'patientDetails', label: 'Show Patient Details', control: 'check' },
  /* 45385 and 45385-33 are the same procedure done for two different reasons,
     and a practice reconciling a screening contract needs them apart. Only
     means anything while the table is grouped BY code — which is why it is the
     grouping key it changes rather than a filter. */
  {
    name: 'splitModifiers',
    label: 'Split CPT with Modifiers',
    control: 'check',
    splitBy: { group: 'code', field: 'modifiers' },
  },
];

/**
 * The sheet the two consolidated reports are run from — End of year AR and
 * Productivity Analysis, which are one report pointed at two dimensions.
 *
 * `native` is the dimension the report already groups by, so it is the answer
 * Group By shows when nothing else has been chosen and it is left out of the
 * list of things to change it to.
 */
const consolidatedParams = ({ native, cpt, groups }) => [
  { name: 'performing', label: 'Performing Providers', control: 'select', on: 'performing', options: PROVIDERS },
  { name: 'billing', label: 'Billing Providers', control: 'select', on: 'billing', options: PROVIDERS },
  {
    name: 'location',
    label: 'Location',
    control: 'select',
    on: 'location',
    options: native === 'location' ? 'rows' : LOCATIONS,
  },
  { name: 'cpt', label: 'CPT Code(s)', control: 'select', on: 'cpt', options: cptOptions(cpt) },
  /* WHOSE WORK IS IT. The performing provider did the case; the billing
     provider's number went on the claim, and for a case done under supervision
     they are two different people. The report has to be told which one it is
     about before "by provider" means anything, which is what this is and why
     it sits next to Group By rather than among the filters. */
  {
    name: 'reportBy',
    label: 'Report By',
    control: 'select',
    single: true,
    empty: 'Performing Provider',
    reportBy: true,
    options: [{ value: 'billing', label: 'Billing Provider' }],
  },
  {
    name: 'billType',
    label: 'Bill Type',
    control: 'select',
    single: true,
    empty: 'All bill types',
    on: 'billType',
    options: BILLING_TYPES,
  },
  {
    name: 'groupBy',
    label: 'Group By',
    control: 'select',
    single: true,
    empty: groups.native,
    groupBy: true,
    options: groups.options,
  },
];
/* ============================================================================
   THE REPORTS

   The twelve the practice asks for BY NAME, and their columns are the columns
   of the reference screens rather than columns we thought suited the name.

   THE NAMES DO NOT DESCRIBE THE REPORTS, and several actively mislead. "End
   of year AR" prints a Consolidated Productivity Analysis: month-to-date and
   year-to-date money by location, with the A/R balance at each end of the
   period. "DPGI TB" and "RRM Procedures" both print a Procedure Code
   Frequency Report. Renaming any of them to what it contains would mean the
   person who asked for "the TB" cannot find it, so the title is theirs, the
   columns are the system's, and `blurb` — carried here, not drawn on screen —
   is where the file says what the thing actually is.

   THREE OF THEM ARE DETAIL REPORTS, not summaries: Payment Analysis, Posted
   Procedures and the cancellation report put one row per record on the page,
   with the patient, the code and the money on it. They declare `record()`;
   see the note above buildRecords().

   CAHPS IS STILL BEING CONFIGURED and says so on its own face. It is the one
   report here with no reference screen to copy, because there is nothing yet
   to take a picture of.

   THE ORDER BELOW IS THE ORDER OF THE RAIL, and it is the order the pack was
   asked for.
   ========================================================================= */

export const REPORTS = [
  {
    id: 'eoy-ar',
    title: 'End of year AR',
    blurb: 'Consolidated productivity by location: month and year to date, with A/R at each end.',
    /* NOT AN AGED-BUCKET REPORT, whatever the name suggests. The reference
       screen prints charges, payments, adjustments and refunds twice — once
       for the month, once for the year — and puts the A/R balance at the
       start of the period beside the balance at the end. What makes it an
       end-of-year report is that it is run with Month 12: the year-to-date
       column is then the whole year, and the two A/R columns are the opening
       and closing balance of it. */
    dimension: 'Location',
    dimensionKey: 'location',
    /* The parameter sheet asks for providers, codes and a bill type, so the
       facts have to know theirs. See facetsFor(). */
    facets: {
      performing: PROVIDERS,
      billing: PROVIDERS,
      cpt: CPT.map((cpt) => cpt.code),
      billType: BILLING_TYPES,
    },
    params: [
      ...consolidatedParams({
        native: 'location',
        cpt: CPT,
        groups: {
          native: 'Location',
          options: [
            { value: 'provider', label: 'Provider' },
            { value: 'cpt', label: 'Procedure Code' },
            { value: 'billType', label: 'Bill Type' },
          ],
        },
      }),
    ],
    rows: [
      {
        id: 'asc',
        label: 'GastroEMR Gastroenterology ASC',
        tune: {
          serv: { range: [4, 12] },
          charges: { share: [900, 1900] },
          settled: { range: [2, 9] },
          closing: { range: [1200, 9000] },
        },
      },
      {
        id: 'clinic',
        label: 'GastroEMR Gastroenterology Clinic',
        tune: {
          serv: { range: [14, 32] },
          charges: { share: [420, 980] },
          settled: { range: [4, 14] },
          closing: { range: [1800, 12000] },
        },
      },
      {
        id: 'infusion',
        label: 'DGI Infusion Center',
        /* Almost no A/R of its own: an infusion is authorised before it is
           given, so it is paid or it does not happen. */
        tune: {
          serv: { range: [0, 4] },
          charges: { share: [600, 1600] },
          settled: { range: [0, 3] },
          closing: { range: [0, 700] },
        },
      },
      {
        id: 'northvalley',
        label: 'North Valley Hospital OP',
        tune: {
          serv: { range: [0, 3] },
          charges: { share: [500, 1200] },
          settled: { range: [0, 3] },
          closing: { range: [0, 1400] },
        },
      },
      {
        id: 'prairie-n',
        label: 'Prairie Health OP North',
        tune: {
          serv: { range: [0, 3] },
          charges: { share: [500, 1200] },
          settled: { range: [0, 3] },
          closing: { range: [0, 1400] },
        },
      },
      {
        id: 'prairie-w',
        label: 'Prairie Health OP West',
        tune: {
          serv: { range: [0, 2] },
          charges: { share: [500, 1200] },
          settled: { range: [0, 2] },
          closing: { range: [0, 1100] },
        },
      },
    ],
    metrics: [
      { key: 'serv', range: [0, 20] },
      { key: 'charges', of: 'serv', share: [420, 1900], decimals: 2 },
      /* Receipts are recorded against their own event, not taken as a slice of
         the day's charges: money posted in August settles work done in May,
         and a site that saw nobody this month still banks last month's
         remittances. Productivity Analysis is the same report by code and
         carries the identical note — the reference screen for it shows codes
         with no services and four figures of collections beside them. */
      { key: 'settled', range: [0, 12] },
      { key: 'payments', of: 'settled', share: [180, 1100], decimals: 2 },
      { key: 'adjustments', of: 'settled', share: [140, 820], decimals: 2 },
      /* A refund is rare and whole — a credit balance somebody actually sent
         back — rather than a fraction of every day's charges. */
      { key: 'refundEvent', of: 'settled', chance: 0.012 },
      { key: 'refunds', of: 'refundEvent', share: [60, 340], decimals: 2 },
      /* The balance carried at the close of business, and a standing position
         rather than a flow. Read at both ends of the period: `first` for the
         opening column, `last` for the closing one — see the A/R columns
         below. */
      { key: 'closing', range: [0, 9000], decimals: 2 },
    ],
    /* TWO SPANS ACROSS THE HEADER, because eight money columns in a row give
       the reader no way to tell which four are the month and which four the
       year. The reference screen draws exactly these two. */
    groups: [
      { span: 2 },
      { label: 'Month To Date', span: 4 },
      { label: 'Year To Date', span: 4 },
      { span: 2 },
    ],
    columns: [
      { key: 'row', label: 'Location' },
      { key: 'serv', label: 'Serv', metric: true },
      { key: 'charges', label: 'Charges', metric: true, format: 'money' },
      { key: 'payments', label: 'Payments', metric: true, format: 'money' },
      { key: 'adjustments', label: 'Adjustments', metric: true, format: 'money' },
      { key: 'refunds', label: 'Refunds', metric: true, format: 'money' },
      /* The same four figures over the year so far. `scope: 'ytd'` re-runs the
         aggregation from 1 January to the end of the period on screen, which
         is the only honest way to put a month and a year in one row: taking
         the month and multiplying would be inventing eleven months. */
      { key: 'charges', label: 'Charges', metric: true, format: 'money', scope: 'ytd' },
      { key: 'payments', label: 'Payments', metric: true, format: 'money', scope: 'ytd' },
      { key: 'adjustments', label: 'Adjustments', metric: true, format: 'money', scope: 'ytd' },
      { key: 'refunds', label: 'Refunds', metric: true, format: 'money', scope: 'ytd' },
      /* Opening and closing. The heading carries the date it was read on,
         because "A/R as of" with no date is not a statement about anything. */
      {
        key: 'closing',
        label: 'A/R as of',
        dateLabel: 'from',
        metric: true,
        agg: 'first',
        format: 'money',
      },
      {
        key: 'closing',
        label: 'A/R as of',
        dateLabel: 'to',
        metric: true,
        agg: 'last',
        format: 'money',
      },
    ],
    stats: [
      { label: 'Serv', metric: 'serv' },
      { label: 'Charges', metric: 'charges', format: 'money' },
      { label: 'Payments', metric: 'payments', format: 'money' },
      { label: 'Charges YTD', metric: 'charges', format: 'money', scope: 'ytd' },
      { label: 'A/R at close', metric: 'closing', agg: 'last', format: 'money' },
    ],
  },
  {
    id: 'dpgi-tb',
    params: procedureParams(CPT),
    title: 'DPGI TB',
    blurb: 'Every line posted across the practice — the code, the RVUs, and the money it raised.',
    /* THE WIDEST OF THE THREE. Saved with no code filter at all, so it carries
       the clinic as well as the suite: office visits and infusions sit in the
       same table as the endoscopies. That is the difference between this and
       RRM Procedures, which is the same seventeen columns over the procedure
       codes alone. See PROCEDURE_COLUMNS. */
    kind: 'detail',
    noun: 'lines',
    perDay: [18, 46],
    record: procedureLine(CPT),
    columns: PROCEDURE_COLUMNS,
    stats: PROCEDURE_STATS,
  },
  {
    id: 'patient-by-carrier',
    title: 'Patient by Carrier',
    blurb: 'Who the panel is insured with — the carrier, where claims go, and how many hold it.',
    /* FIVE COLUMNS, AND TWO OF THEM ARE THE CARRIER'S POSTAL DETAILS. The
       reference prints Carrier, Address, Phone, Patients and % — a directory
       as much as a count, because the reader running it is usually about to
       ring or write to somebody. Payer Group is a PARAMETER on that screen,
       not a column: you narrow by it, you do not read it.

       The addresses and numbers below are invented, like everything else in
       this file. The telephone numbers are all in the 555-01xx range that is
       reserved for fiction precisely so that nobody dials one.

       Self-pay has neither, and shows neither: there is no carrier to write
       to, which is what self-pay means. */
    cadence: 'weekly',
    dimension: 'Carrier',
    dimensionKey: 'carrier',
    /* FOUR PARAMETERS, AND THE SHEET STOPS THERE. The reference screen asks
       for a carrier, a payer group and two switches, and this is a panel of a
       carrier, a payer group and two switches. It is not narrowed by provider
       or by site because the panel it counts is the practice's, not a day's
       work at one of them. */
    params: [
      { name: 'carrier', label: 'Carrier', control: 'select', on: 'carrier', options: 'rows' },
      /* A property of the carrier rather than of anything that happened, so it
         narrows the ROWS: Medicare Advantage is what Humana IS. */
      {
        name: 'payerGroup',
        label: 'Payer Group',
        control: 'select',
        attr: 'group',
        options: PAYER_GROUPS,
      },
      /* PRIMARY ONLY CHANGES WHAT IS COUNTED, not what is shown. A patient
         who holds Medicaid behind Medicare is one of Medicare's and one of
         Medicaid's; run for primary cover, they are Medicare's alone. So the
         switch swaps the metric under the Patients column — and the % column
         follows it, because a share of a different count is a different
         share. See `totals` below and the note on the parameter sheet. */
      {
        name: 'primaryOnly',
        label: 'Primary Insurance Only',
        control: 'check',
        totals: { counted: ['primary'] },
      },
      /* The reference prints five columns and this is the switch that asks for
         the sixth, seventh and eighth: how each carrier is actually held.
         Off — which is how the report is run — they are not drawn at all. */
      { name: 'patientDetails', label: 'Show Patient Details', control: 'check' },
    ],
    rows: [
      {
        id: 'bcbsnd',
        label: 'Blue Cross Blue Shield of North Dakota',
        attrs: {
          group: 'Commercial',
          address: 'PO BOX 6001\nFargo, ND 58108',
          phone: '701-555-0142',
        },
        tune: { patients: { range: [620, 1150] } },
      },
      {
        id: 'medicare',
        label: 'Medicare Part B',
        attrs: {
          group: 'Medicare',
          address: 'PO BOX 6704\nFargo, ND 58108',
          phone: '800-555-0187',
        },
        tune: { patients: { range: [520, 980] }, primary: { share: [0.86, 0.97] } },
      },
      {
        id: 'sanction',
        label: 'Sanction Health Plan',
        attrs: {
          group: 'Commercial',
          address: 'PO BOX 91240\nSioux Falls, SD 57109',
          phone: '605-555-0119',
        },
        tune: { patients: { range: [180, 460] } },
      },
      {
        id: 'united',
        label: 'UnitedHealthcare',
        attrs: {
          group: 'Commercial',
          address: 'PO BOX 21740\nSalt Lake City, UT 84121',
          /* No number on file, and the cell says so by being empty rather than
             by inventing one — which is the state the reference screen shows
             for its own first carrier. */
          phone: '',
        },
        tune: { patients: { range: [150, 420] } },
      },
      {
        id: 'aetna',
        label: 'Aetna',
        attrs: {
          group: 'Commercial',
          address: 'PO BOX 19883\nLexington, KY 40515',
          phone: '860-555-0164',
        },
        tune: { patients: { range: [110, 330] } },
      },
      {
        id: 'humana',
        label: 'Humana Gold Plus (HMO)',
        attrs: {
          group: 'Medicare Advantage',
          address: 'PO BOX 30402\nLouisville, KY 40233',
          phone: '',
        },
        tune: { patients: { range: [90, 280] } },
      },
      {
        id: 'medicaid',
        label: 'North Dakota Medicaid',
        attrs: {
          group: 'Medicaid',
          address: 'PO BOX 5510\nBismarck, ND 58506',
          phone: '701-555-0175',
        },
        /* The group most often held as secondary cover behind Medicare, which
           is why the primary and secondary counts are still recorded even
           though the reference prints neither. */
        tune: { patients: { range: [130, 380] }, primary: { share: [0.42, 0.68] } },
      },
      {
        id: 'wsi',
        label: 'WSI North Dakota',
        attrs: {
          group: 'Workers compensation',
          address: 'PO BOX 5585\nBismarck, ND 58506',
          phone: '701-555-0198',
        },
        tune: { patients: { range: [20, 90] }, primary: { share: [0.95, 1] } },
      },
      {
        id: 'self',
        label: 'Self-pay',
        /* Nowhere to send a claim and nobody to ring. Both cells are empty,
           and that emptiness is the fact. */
        attrs: { group: 'Self-pay', address: '', phone: '' },
        tune: { patients: { range: [60, 210] }, primary: { share: [1, 1] } },
      },
    ],
    metrics: [
      /* A HEADCOUNT IS A BALANCE, and says so here rather than relying on a
         column to say it. Every other metric on this report is read off the
         last Friday in range because a panel is a position, not a flow, and
         `patients` used to inherit that from the column that showed it. It is
         not shown by a column any more — `counted` is — so the metric carries
         its own aggregation and a fortnight of Fridays cannot be added
         together into twice the panel. */
      { key: 'patients', range: [60, 900], agg: 'last' },
      { key: 'primary', of: 'patients', share: [0.72, 0.95] },
      { key: 'secondary', of: 'patients', minus: 'primary' },
      { key: 'active', of: 'patients', share: [0.4, 0.85] },
    ],
    columns: [
      { key: 'row', label: 'Carrier' },
      /* Two lines in one cell, the way an address is written and the way the
         reference prints it — see `wrap` and .rep__cell--stack. */
      { key: 'address', label: 'Address', attr: true, wrap: true },
      { key: 'phone', label: 'Phone', attr: true },
      /* `counted` rather than `patients`: every patient who holds the carrier,
         or only the ones who hold it as primary cover, depending on the
         parameter. The two are declared in `totals` so the column, the
         percentage and the tile can never be counting different people. */
      /* No `agg` on the column, unlike the three behind the switch below. A
         column's agg reads the metric off one end of the range; `counted` is
         not a metric but a total derived from one, and the metric it is
         derived from is the thing declared as a balance. Asking for the last
         day's `counted` is asking for a figure nothing ever folded. */
      { key: 'counted', label: 'Patients', metric: true },
      /* Headed "%" and nothing else, and quoted to two places: the reference
         prints 100.00%, and on a column whose whole job is to add up to a
         hundred the second decimal is where a rounding error shows. */
      { key: 'pct', label: '%', share: 'counted', format: 'percent2' },
      /* Behind "Show patient details". Not on the reference screen's five
         columns, because the reference screen was photographed with the box
         unticked. */
      { key: 'primary', label: 'Primary Insurance', metric: true, agg: 'last', only: 'patientDetails' },
      {
        key: 'secondary',
        label: 'Secondary Insurance',
        metric: true,
        agg: 'last',
        only: 'patientDetails',
        /* A secondary column under a run that excluded secondary cover would
           be a column of noughts pretending to be a finding. */
        hidden: 'primaryOnly',
      },
      { key: 'active', label: 'Seen in 12 Months', metric: true, agg: 'last', only: 'patientDetails' },
    ],
    /* WHAT "PATIENTS" MEANS, ONCE. Everything on the row that counts people
       reads `counted`, and the Primary Insurance Only switch is the only
       thing that changes what that is. */
    totals: { counted: ['patients'] },
    stats: [
      /* The tile counts whatever the column counts — see `totals`. A headline
         of every patient over a table of primary cover only would be the two
         halves of the page disagreeing about the answer. */
      { label: 'Patients', metric: 'counted' },
      { label: 'Primary insurance', metric: 'primary', agg: 'last' },
      { label: 'Secondary insurance', metric: 'secondary', agg: 'last' },
      { label: 'Seen in 12 months', metric: 'active', agg: 'last' },
      { label: 'Primary rate', rate: ['primary', 'patients'] },
    ],
  },
  {
    id: 'payment-analysis',
    /* THE SHEET OPENS WITH A DATE RANGE THAT IS NOT THE PERIOD. The period in
       the header is when the money was POSTED; this is when the service being
       paid for was DONE. They are weeks apart on an insurance payment and
       that gap is most of what this report is read for, so both are asked
       and neither stands in for the other. */
    params: [
      { name: 'dosFrom', label: 'Charge DOS From', control: 'date', on: 'serviceDate', bound: 'from' },
      { name: 'dosTo', label: 'Charge DOS To', control: 'date', on: 'serviceDate', bound: 'to' },
      { name: 'costCentre', label: 'Cost Center(s)', control: 'select', on: 'costCentre', options: COST_CENTRES },
      { name: 'performing', label: 'Performing Providers', control: 'select', on: 'performing', options: PROVIDERS },
      { name: 'billing', label: 'Billing Providers', control: 'select', on: 'billing', options: PROVIDERS },
      { name: 'location', label: 'Locations', control: 'select', on: 'location', options: LOCATIONS },
      { name: 'cpt', label: 'CPT Codes', control: 'select', on: 'cpt', options: cptOptions(CPT) },
      {
        name: 'pmtCode',
        label: 'Payment Codes',
        control: 'select',
        on: 'pmtCode',
        options: PAYMENT_CODES.map((code) => ({ value: code.code, label: `${code.code} — ${code.label}` })),
      },
      { name: 'carrier', label: 'Carrier', control: 'select', on: 'carrier', options: CARRIERS },
      { name: 'batch', label: 'Batch Name', control: 'select', on: 'batch', options: BATCHES },
      {
        name: 'billType',
        label: 'Bill Type',
        control: 'select',
        single: true,
        empty: 'All bill types',
        on: 'billType',
        options: BILLING_TYPES,
      },
      {
        name: 'groupBy',
        label: 'Group',
        control: 'select',
        single: true,
        empty: 'Ungrouped — one row per payment',
        groupBy: true,
        options: [
          { value: 'pmtCode', label: 'Payment Code' },
          { value: 'carrier', label: 'Carrier' },
          { value: 'performing', label: 'Performing Provider' },
          { value: 'billing', label: 'Billing Provider' },
          { value: 'location', label: 'Location' },
          { value: 'costCentre', label: 'Cost Center' },
          { value: 'batch', label: 'Batch' },
        ],
      },
      { name: 'details', label: 'Show Details', control: 'check', details: true },
      { name: 'unapplied', label: 'Show Unapplied moved to Refunds', control: 'check' },
    ],
    title: 'Payment Analysis',
    blurb: 'Every payment posted, one row each, with the charge and the carrier it landed against.',
    /* ONE ROW PER PAYMENT. The reference screen's column list is thirteen
       fields long and every one of them belongs to a single transaction — the
       patient, their MRN, the date of the service being paid for, the code,
       who performed it, who billed it, the carrier, the site, the referrer,
       the posting reference, the payment code and the amount. There is
       nothing to aggregate; the report IS the ledger. */
    kind: 'detail',
    noun: 'payments',
    perDay: [14, 38],
    record: (r, day, date) => {
      const payment = r.weighted('code', PAYMENT_CODES);
      const insurance = payment.code.startsWith('I');
      const cpt = r.pick('cpt', CPT);
      const patient = r.pick('patient', PATIENTS);
      const location = r.pick('loc', LOCATIONS);
      const carrier = insurance ? r.pick('carrier', CARRIERS.slice(0, 7)) : 'Self-pay';
      return {
        date,
        patient,
        mrn: mrnFor(patient),
        /* A payment lands weeks after the service it settles — sooner for a
           card handed over at the desk, much later for a claim that had to be
           worked. */
        serviceDate: insurance ? r.daysBefore('svc', day, 18, 96) : r.daysBefore('svc', day, 0, 62),
        cpt: cpt.code,
        performing: r.pick('perf', PROVIDERS),
        billing: r.pick('bill', PROVIDERS),
        carrier,
        payerGroup: PAYER_GROUP_OF[carrier] ?? 'Commercial',
        location,
        costCentre: location === 'GastroEMR Gastroenterology ASC' ? 'Endoscopy' : 'Clinic',
        billType: location === 'GastroEMR Gastroenterology ASC' ? 'Facility' : 'Professional',
        /* The file it was posted in. An electronic remittance arrives as one
           of two daily files; a card taken at the desk is in whichever half of
           the day it was taken. */
        batch: insurance
          ? r.pick('batch', BATCHES.slice(0, 2))
          : r.pick('batch', BATCHES.slice(2)),
        referrer: r.pick('ref', REFERRERS),
        reference: r.reference('num', insurance ? 'ERA' : 'RCT'),
        pmtCode: payment.code,
        /* A credit the practice could not apply to anything and sent back.
           Rare, and its own column only when the parameter sheet asks for it —
           on most runs it is a column of zeros. */
        unapplied: r.unit('unapplied') < 0.04 ? r.money('unap', 12, 210) : 0,
        /* An insurance remittance settles a whole claim; a patient pays a
           balance. They are not the same size and a report that made them so
           would hide where the money actually comes from. */
        amount: insurance ? r.money('amt', 48, 1420) : r.money('amt', 15, 340),
      };
    },
    columns: [
      { key: 'date', label: 'Date', field: true },
      { key: 'patient', label: 'Patient', field: true },
      { key: 'mrn', label: 'MRN', field: true },
      { key: 'serviceDate', label: 'Service Date', field: true },
      { key: 'cpt', label: 'CPT Code', field: true },
      { key: 'performing', label: 'Performing Provider', field: true },
      { key: 'billing', label: 'Billing Provider', field: true },
      { key: 'carrier', label: 'Carrier', field: true },
      { key: 'location', label: 'Location', field: true },
      { key: 'referrer', label: 'Referring Physician', field: true },
      { key: 'reference', label: 'Reference', field: true },
      { key: 'pmtCode', label: 'Pmt Code', field: true },
      { key: 'amount', label: 'Amount', field: true, format: 'money', total: 'sum' },
      /* Only when the sheet asks for it. A credit the practice could not apply
         and sent back is a rare line, and a column of noughts beside the one
         column anybody reads is a column earning nothing. */
      {
        key: 'unapplied',
        label: 'Unapplied → Refunds',
        field: true,
        format: 'money',
        total: 'sum',
        only: 'unapplied',
      },
    ],
    stats: [
      { label: 'Payments', count: true },
      { label: 'Amount posted', field: 'amount', format: 'money' },
      { label: 'Average payment', field: 'amount', agg: 'avg', format: 'money' },
      { label: 'Largest payment', field: 'amount', agg: 'max', format: 'money' },
      { label: 'Patients', field: 'mrn', agg: 'distinct' },
    ],
  },
  {
    id: 'posted-procedures',
    /* FIVE PARAMETERS AND NOT ONE MORE. The reference sheet asks for a site,
       two providers, a code list and a grouping — no carrier, no bill type,
       no responsible party — because this report is run to reconcile what was
       POSTED, and posting is a thing done by a person at a place to a code. */
    params: [
      { name: 'location', label: 'Location', control: 'select', on: 'location', options: LOCATIONS },
      { name: 'performing', label: 'Performing Provider', control: 'select', on: 'performing', options: PROVIDERS },
      { name: 'billing', label: 'Billing Provider', control: 'select', on: 'billing', options: PROVIDERS },
      { name: 'code', label: 'CPT Code(s)', control: 'select', on: 'code', options: cptOptions(CPT) },
      {
        name: 'groupBy',
        label: 'Group By',
        control: 'select',
        single: true,
        empty: 'Ungrouped — one row per line',
        groupBy: true,
        options: [
          { value: 'code', label: 'CPT Code' },
          { value: 'performing', label: 'Performing Provider' },
          { value: 'billing', label: 'Billing Provider' },
          { value: 'location', label: 'Location' },
        ],
      },
    ],
    title: 'Posted Procedures',
    blurb: 'Every charge line posted, one row each, with its diagnosis and what is still owed on it.',
    /* ONE ROW PER CHARGE LINE, and sixteen columns of it. The reference screen
       prints the service date and the accounting date separately — a
       procedure done in December and posted in January belongs to two
       different months, and reconciling one against the other is most of what
       this report is for. ICD-9 sits beside ICD-10 for the same reason: a
       practice with claims older than 2015 on file still gets asked about the
       legacy code. */
    kind: 'detail',
    noun: 'charge lines',
    perDay: [16, 44],
    record: (r, day, date) => {
      const cpt = r.pick('cpt', CPT);
      const dx = r.pick('dx', DIAGNOSES);
      const patient = r.pick('patient', PATIENTS);
      const pathology = cpt.code.startsWith('88');
      const unit = pathology ? r.int('unit', 1, 4) : 1;
      const amount = round(unit * (cpt.rvu * 168 + r.unit('fee') * 140), 2);
      /* Most lines are settled by the time anybody runs the report; the ones
         that are not are why it is run. */
      const settled = r.unit('settled') < 0.62;
      return {
        servDate: date,
        /* Posted the same day, or a day or two later when the note was signed
           after the list finished. */
        acctDate: dayId(addDays(day, r.int('acct', 0, 3))),
        mrn: mrnFor(patient),
        patient,
        dob: bornFor(patient),
        /* Almost everybody is their own guarantor; a few are on somebody
           else's account. */
        responsible: r.unit('resp') < 0.88 ? patient : r.pick('resp2', PATIENTS),
        code: cpt.code,
        modifier: r.pick('mod', MODIFIERS),
        performing: r.pick('perf', PROVIDERS),
        billing: r.pick('bill', PROVIDERS),
        location: r.pick('loc', LOCATIONS),
        icd9: dx.icd9,
        icd10: dx.icd10,
        unit,
        amount,
        balance: settled ? 0 : round(amount * (0.08 + r.unit('bal') * 0.62), 2),
      };
    },
    columns: [
      { key: 'servDate', label: 'Serv Date', field: true },
      { key: 'acctDate', label: 'Acct Date', field: true },
      { key: 'mrn', label: 'MRN', field: true },
      { key: 'patient', label: 'Patient', field: true },
      { key: 'dob', label: 'DOB', field: true },
      { key: 'responsible', label: 'Responsible', field: true },
      { key: 'code', label: 'Code', field: true },
      { key: 'modifier', label: 'Modifier', field: true },
      { key: 'performing', label: 'Perf', field: true },
      { key: 'billing', label: 'Bill', field: true },
      { key: 'location', label: 'Location', field: true },
      { key: 'icd9', label: 'ICD-9', field: true },
      { key: 'icd10', label: 'ICD-10', field: true },
      { key: 'unit', label: 'Unit', field: true, total: 'sum' },
      { key: 'amount', label: 'Amount', field: true, format: 'money', total: 'sum' },
      { key: 'balance', label: 'Balance', field: true, format: 'money', total: 'sum' },
    ],
    stats: [
      { label: 'Charge lines', count: true },
      { label: 'Units', field: 'unit' },
      { label: 'Amount', field: 'amount', format: 'money' },
      { label: 'Balance', field: 'balance', format: 'money' },
      { label: 'Patients', field: 'mrn', agg: 'distinct' },
    ],
  },
  {
    id: 'productivity',
    title: 'Productivity Analysis',
    blurb: 'The same consolidated view as the year-end report, reported by procedure code.',
    /* THE SAME REPORT AS End of year AR, pointed at a different dimension.
       Its parameters carry a "Report By" that chooses what a row is, and
       Procedure Code is what it opens on — so this is the money by code where
       the year-end report is the money by site. Both print the same eleven
       columns because they are the same report; only the row changes. */
    dimension: 'Procedure code',
    dimensionKey: 'cpt',
    facets: {
      performing: PROVIDERS,
      billing: PROVIDERS,
      location: LOCATIONS,
      billType: BILLING_TYPES,
    },
    /* The same sheet as the year-end report. Group By opens on Procedure Code
       because that is what a row already is here — the same control, a
       different starting answer. */
    params: consolidatedParams({
      native: 'cpt',
      cpt: CPT,
      groups: {
        native: 'Procedure Code',
        options: [
          { value: 'location', label: 'Location' },
          { value: 'provider', label: 'Provider' },
          { value: 'billType', label: 'Bill Type' },
        ],
      },
    }),
    rows: [],
    metrics: [
      { key: 'serv', range: [0, 9] },
      { key: 'charges', of: 'serv', share: [180, 1600], decimals: 2 },
      /* MONEY POSTED TODAY SETTLES WORK DONE WEEKS AGO, so payments and
         adjustments are counted against their own event and not taken as a
         slice of the day's charges. The reference screen is unambiguous about
         it: a code with 0 services this month still shows $116.92 collected
         and $483.08 written off, because those are August's remittances
         landing on May's colonoscopies. Tying them to same-day charges made a
         quiet month look like a month with no receipts, which is the opposite
         of what a quiet month looks like on a real ledger. */
      { key: 'settled', range: [0, 5] },
      { key: 'payments', of: 'settled', share: [90, 520], decimals: 2 },
      { key: 'adjustments', of: 'settled', share: [70, 400], decimals: 2 },
      /* Rare and whole, and rolled against its own trials rather than against
         the day's services — a refund on a code nobody billed this month is
         exactly the case that happens. */
      { key: 'refundTrials', range: [0, 3] },
      { key: 'refundEvent', of: 'refundTrials', chance: 0.05 },
      { key: 'refunds', of: 'refundEvent', share: [40, 260], decimals: 2 },
      /* A standing balance, not a flow: read on the first and last day in
         range and never added across them. It does not depend on today's
         charges either, for the same reason as the receipts above. */
      { key: 'closing', range: [0, 2600], decimals: 2 },
    ],
    groups: [
      { span: 2 },
      { label: 'Month To Date', span: 4 },
      { label: 'Year To Date', span: 4 },
      { span: 2 },
    ],
    columns: [
      { key: 'row', label: 'Procedure Code' },
      { key: 'serv', label: 'Serv', metric: true },
      { key: 'charges', label: 'Charges', metric: true, format: 'money' },
      { key: 'payments', label: 'Payments', metric: true, format: 'money' },
      { key: 'adjustments', label: 'Adjustments', metric: true, format: 'money' },
      { key: 'refunds', label: 'Refunds', metric: true, format: 'money' },
      { key: 'charges', label: 'Charges', metric: true, format: 'money', scope: 'ytd' },
      { key: 'payments', label: 'Payments', metric: true, format: 'money', scope: 'ytd' },
      { key: 'adjustments', label: 'Adjustments', metric: true, format: 'money', scope: 'ytd' },
      { key: 'refunds', label: 'Refunds', metric: true, format: 'money', scope: 'ytd' },
      {
        key: 'closing',
        label: 'A/R as of',
        dateLabel: 'from',
        metric: true,
        agg: 'first',
        format: 'money',
      },
      {
        key: 'closing',
        label: 'A/R as of',
        dateLabel: 'to',
        metric: true,
        agg: 'last',
        format: 'money',
      },
    ],
    stats: [
      { label: 'Serv', metric: 'serv' },
      { label: 'Charges', metric: 'charges', format: 'money' },
      { label: 'Payments', metric: 'payments', format: 'money' },
      { label: 'Charges YTD', metric: 'charges', format: 'money', scope: 'ytd' },
      { label: 'A/R at close', metric: 'closing', agg: 'last', format: 'money' },
    ],
  },
  {
    id: 'rrm',
    params: procedureParams(CPT),
    title: 'RRM',
    blurb: 'The same seventeen columns, read as the revenue view: what every line raised and collected.',
    /* THE SAME TEMPLATE AS DPGI TB, saved under a different name and read for
       a different reason — the money columns rather than the RVU ones. In the
       live system the two differ only in which of the seventeen are ticked
       and what is typed into the parameters; the columns themselves are one
       list, declared once as PROCEDURE_COLUMNS.

       It is not narrowed to procedures the way RRM Procedures is: this is the
       whole practice's revenue, clinic included, which is what makes the
       Chgs % and Pmnt % columns worth reading — a share is only a share of
       everything. */
    kind: 'detail',
    noun: 'lines',
    perDay: [18, 46],
    record: procedureLine(CPT),
    columns: PROCEDURE_COLUMNS,
    stats: PROCEDURE_STATS,
  },
  {
    id: 'rrm-procedures',
    /* The one sheet of the three whose CPT parameter is short: this report is
       the suite's, so the codes it offers are the suite's. */
    params: procedureParams(PROCEDURE_CODES),
    title: 'RRM Procedures',
    blurb: 'The same columns over the procedure codes alone — no office visits, no infusions.',
    /* THE NARROW ONE. Its reference screen carries an explicit list of forty-
       odd CPT codes in its parameters — every endoscopy and pathology code the
       practice bills and nothing else — which is exactly what separates it
       from DPGI TB and RRM. Same seventeen columns; a shorter list of codes
       under them, so the RVU and money totals are the suite's rather than the
       practice's. */
    kind: 'detail',
    noun: 'lines',
    perDay: [12, 32],
    record: procedureLine(PROCEDURE_CODES),
    columns: PROCEDURE_COLUMNS,
    stats: PROCEDURE_STATS,
  },
  {
    id: 'cancellations',
    /* THREE THINGS TO NARROW BY, A GROUPING, AND ONE SWITCH. The prototype
       used to offer the activity and the cancellation reason as well, because
       the records carry both and it was easy. The reference sheet does not
       ask for them — a scheduler runs this for a provider or a site — and a
       parameter panel that offers more than the report it copies is a panel
       nobody can be taught from. They are still columns; they are no longer
       questions. */
    params: [
      { name: 'provider', label: 'Provider', control: 'select', on: 'provider', options: PROVIDERS },
      { name: 'location', label: 'Location', control: 'select', on: 'location', options: LOCATIONS },
      { name: 'cancelledBy', label: 'Cancelled By', control: 'select', on: 'cancelledBy', options: CANCELLED_BY },
      {
        name: 'groupBy',
        label: 'Group By',
        control: 'select',
        single: true,
        empty: 'Ungrouped — one row per cancellation',
        groupBy: true,
        options: [
          { value: 'provider', label: 'Provider' },
          { value: 'location', label: 'Location' },
          { value: 'reason', label: 'Cancellation Reason' },
          { value: 'cancelledBy', label: 'Cancelled By' },
          { value: 'activity', label: 'Activity' },
        ],
      },
      /* A SLOT GIVEN BACK AND TAKEN AGAIN IS NOT A LOST SLOT. A rescheduled
         appointment is a cancellation in the diary and not in the accounts,
         and a report of what the practice lost this month should not open
         with them in it. So they are out unless the box asks for them — which
         is what "Show rescheduled" means, and why it is the only parameter
         here whose default state changes the total. */
      {
        name: 'rescheduled',
        label: 'Show Rescheduled',
        control: 'check',
        excludes: { field: 'reason', value: 'Patient rescheduled' },
      },
    ],
    title: 'Appointment Cancellation Report',
    blurb: 'Every cancelled appointment, one row each, with when it was given back and by whom.',
    /* ONE ROW PER CANCELLED APPOINTMENT. The two timestamps are the report:
       the slot's own time and the moment it was given back, side by side, so
       the notice is readable without anybody computing it. A no-show has the
       same value in both, which is exactly what a no-show is. */
    kind: 'detail',
    noun: 'cancellations',
    perDay: [3, 11],
    record: (r, day, date) => {
      const reason = r.pick('reason', CANCEL_REASONS);
      const noShow = reason === 'No-show';
      const apptTime = r.clock('appt', 7, 16);
      const patient = r.pick('patient', PATIENTS);
      return {
        apptAt: `${date} ${apptTime}`,
        /* Nobody cancels a no-show: the record is written when the slot
           passes, which is the appointment's own time. */
        cancelAt: noShow
          ? `${date} ${apptTime}`
          : `${r.daysBefore('cx', day, 0, 9)} ${r.clock('cxt', 8, 17)}`,
        patient: `${patient} · ${phoneFor(patient)}`,
        mrn: mrnFor(patient),
        complaint: r.pick('cc', COMPLAINTS),
        provider: r.pick('prov', PROVIDERS),
        location: r.pick('loc', LOCATIONS),
        activity: r.pick('act', ACTIVITIES),
        reason,
        /* Somebody has to have done it, and for a no-show nobody did. A name
           in that cell would be a false accusation. */
        cancelledBy: noShow ? '—' : r.pick('by', CANCELLED_BY),
      };
    },
    columns: [
      { key: 'apptAt', label: 'Appt Date/Time', field: true },
      { key: 'cancelAt', label: 'Cancel Date/Time', field: true },
      { key: 'patient', label: 'Patient / Phone', field: true },
      { key: 'mrn', label: 'MRN', field: true },
      { key: 'complaint', label: 'Chief Complaint', field: true },
      { key: 'provider', label: 'Provider', field: true },
      { key: 'location', label: 'Location', field: true },
      { key: 'activity', label: 'Activity', field: true },
      { key: 'reason', label: 'Cancellation Reason', field: true },
      { key: 'cancelledBy', label: 'Cancelled By', field: true },
    ],
    stats: [
      { label: 'Cancellations', count: true },
      { label: 'No-shows', field: 'reason', agg: 'countOf', match: 'No-show' },
      { label: 'Patient cancelled', field: 'reason', agg: 'countOf', match: 'Patient cancelled' },
      { label: 'Practice cancelled', field: 'reason', agg: 'countOf', match: 'Provider unavailable' },
      { label: 'Patients', field: 'mrn', agg: 'distinct' },
    ],
  },
  {
    id: 'adr',
    title: 'Adenoma Detection Rate',
    blurb: 'Screening colonoscopies with an adenoma found, split by patient gender, by provider.',
    /* SPLIT BY GENDER, BECAUSE THE BENCHMARK IS. The society sets adenoma
       detection at 30% for men and 20% for women, and a single blended rate
       measured against a single blended benchmark can hide an endoscopist who
       is under on one and over on the other. The reference screen prints a
       denominator, a numerator and a percentage for each, and one more
       percentage across both — and that last one is worked out from the two
       denominators added together, never by averaging the two percentages. */
    dimension: 'Provider',
    dimensionKey: 'provider',
    /* A screening colonoscopy happens somewhere, to somebody of an age, and
       for one of four reasons. The sheet asks about all four, so the facts
       carry all four. */
    facets: {
      location: LOCATIONS,
      colonoscopy: COLONOSCOPY_TYPES,
      /* An age band rather than a birthday: what the parameter asks is "aged
         between", and the two dropdowns are read as numbers against this.
         Screening starts at 45 and the practice's oldest average-risk patient
         on a list is in their mid-eighties. */
      age: ageOptions(45, 85),
    },
    params: [
      { name: 'provider', label: 'Provider(s)', control: 'select', on: 'provider', options: 'rows' },
      /* GENDER IS NOT A FILTER HERE, IT IS A LENS. The report is already split
         male and female across six columns; answering Male does not remove
         rows, it puts away the three columns that are not about men. See
         `lens` on the columns below. */
      {
        name: 'gender',
        label: 'Gender',
        control: 'select',
        single: true,
        empty: 'All genders',
        options: GENDERS,
      },
      { name: 'location', label: 'Location(s)', control: 'select', on: 'location', options: LOCATIONS },
      {
        name: 'ageFrom',
        label: 'Age From',
        control: 'select',
        single: true,
        empty: 'No lower limit',
        on: 'age',
        bound: 'from',
        options: ageOptions(40, 90),
      },
      {
        name: 'ageTo',
        label: 'Age To',
        control: 'select',
        single: true,
        empty: 'No upper limit',
        on: 'age',
        bound: 'to',
        options: ageOptions(40, 90),
      },
      {
        name: 'colonoscopy',
        label: 'Colonoscopy Type(s)',
        control: 'select',
        on: 'colonoscopy',
        options: COLONOSCOPY_TYPES,
      },
      {
        name: 'groupBy',
        label: 'Group By',
        control: 'select',
        single: true,
        empty: 'Provider',
        groupBy: true,
        options: [
          { value: 'location', label: 'Location' },
          { value: 'colonoscopy', label: 'Colonoscopy Type' },
        ],
      },
      /* A CASE WITHOUT A SIGNED NOTE IS STILL A CASE THE PATIENT HAD. It is
         left out of the measure by default, because a rate reported to a
         registry has to be made of documented findings — and it is put back by
         this box, which is how an endoscopist checks whether a poor month is a
         detection problem or a dictation one. Both denominators and both
         numerators widen together; nothing else on the report moves. */
      {
        name: 'unsigned',
        label: 'Include Unsigned Services',
        control: 'check',
        totals: {
          maleDen: ['maleDenominator', 'unsignedMaleDenominator'],
          maleNum: ['maleNumerator', 'unsignedMaleNumerator'],
          femaleDen: ['femaleDenominator', 'unsignedFemaleDenominator'],
          femaleNum: ['femaleNumerator', 'unsignedFemaleNumerator'],
        },
      },
    ],
    rows: [
      {
        id: 'mensah',
        label: 'Amara Mensah, MD',
        tune: {
          maleDenominator: { range: [4, 11] },
          maleNumerator: { share: [0.32, 0.48] },
          femaleNumerator: { share: [0.22, 0.36] },
        },
      },
      {
        id: 'bianchi',
        label: 'Luca Bianchi, MD',
        tune: {
          maleDenominator: { range: [5, 12] },
          maleNumerator: { share: [0.3, 0.45] },
          femaleNumerator: { share: [0.2, 0.34] },
        },
      },
      {
        id: 'nakamura',
        label: 'Sana Nakamura, MD',
        /* Just over the line on men and just under it on women — the case the
           split exists to make visible, and one a blended rate would bury. */
        tune: {
          maleDenominator: { range: [3, 9] },
          maleNumerator: { share: [0.29, 0.38] },
          femaleNumerator: { share: [0.15, 0.24] },
        },
      },
      {
        id: 'okafor',
        label: 'Chidi Okafor, MD',
        tune: {
          maleDenominator: { range: [4, 10] },
          maleNumerator: { share: [0.31, 0.43] },
          femaleNumerator: { share: [0.21, 0.33] },
        },
      },
    ],
    metrics: [
      { key: 'maleDenominator', range: [3, 12] },
      { key: 'maleNumerator', of: 'maleDenominator', share: [0.24, 0.46] },
      /* Slightly more women are screened than men, in every practice that has
         ever counted. */
      { key: 'femaleDenominator', of: 'maleDenominator', share: [0.95, 1.35] },
      { key: 'femaleNumerator', of: 'femaleDenominator', share: [0.16, 0.34] },
      /* The cases whose note is not signed yet. A handful a week, and they
         only ever reach the table through "Include unsigned services" — see
         the parameter. Detection runs slightly lower in them, which is what
         makes the comparison worth offering: an unsigned note is usually the
         one nobody got back to. */
      { key: 'unsignedMaleDenominator', of: 'maleDenominator', share: [0.03, 0.12] },
      { key: 'unsignedMaleNumerator', of: 'unsignedMaleDenominator', share: [0.18, 0.4] },
      { key: 'unsignedFemaleDenominator', of: 'femaleDenominator', share: [0.03, 0.12] },
      { key: 'unsignedFemaleNumerator', of: 'unsignedFemaleDenominator', share: [0.12, 0.3] },
    ],
    /* EVERY FIGURE ON THE ROW IS A TOTAL, not a metric, and the columns read
       the totals rather than the metrics they are made of. That is what lets
       one tick box widen four denominators at once: "Include unsigned
       services" declares its own version of the first four lines below and
       nothing else on the report has to know. */
    totals: {
      maleDen: ['maleDenominator'],
      maleNum: ['maleNumerator'],
      femaleDen: ['femaleDenominator'],
      femaleNum: ['femaleNumerator'],
      denominator: ['maleDen', 'femaleDen'],
      numerator: ['maleNum', 'femaleNum'],
    },
    columns: [
      { key: 'row', label: 'Provider' },
      /* `lens` — drawn while the run is for men or for everybody, and put
         away when it is for women. See the Gender parameter. */
      { key: 'maleDen', label: 'Male Denominator', metric: true, lens: { gender: 'Male' } },
      { key: 'maleNum', label: 'Male Numerator', metric: true, lens: { gender: 'Male' } },
      {
        key: 'maleAdr',
        label: 'Male ADR Percentage',
        rate: ['maleNum', 'maleDen'],
        lens: { gender: 'Male' },
      },
      { key: 'femaleDen', label: 'Female Denominator', metric: true, lens: { gender: 'Female' } },
      { key: 'femaleNum', label: 'Female Numerator', metric: true, lens: { gender: 'Female' } },
      {
        key: 'femaleAdr',
        label: 'Female ADR Percentage',
        rate: ['femaleNum', 'femaleDen'],
        lens: { gender: 'Female' },
      },
      /* The one column a single-gender run has no use for: across both
         genders, when one of them has been put away, is the column beside it
         again under a heading that says otherwise. */
      {
        key: 'allAdr',
        label: 'All Genders ADR Percentage',
        rate: ['numerator', 'denominator'],
        lens: { gender: '' },
      },
    ],
    stats: [
      { label: 'Screening exams', metric: 'denominator' },
      { label: 'With adenoma', metric: 'numerator' },
      { label: 'Male ADR', rate: ['maleNum', 'maleDen'] },
      { label: 'Female ADR', rate: ['femaleNum', 'femaleDen'] },
      { label: 'All genders ADR', rate: ['numerator', 'denominator'] },
    ],
  },
  {
    id: 'asc-09',
    title: 'ASC-09 Follow-up Interval for Average Risk Patients',
    blurb: 'The CMS measure: average-risk patients with a normal colonoscopy given a 10-year recall.',
    /* FIVE COLUMNS AND NOT ONE MORE. The reference prints Provider,
       Denominator, Numerator, Percentage and Number of exclusions, which is
       the shape every ASCQR measure is reported in — the same shape as the
       adenoma report beside it, because they go to the same registry.

       The denominator is patients aged 45 to 75 whose screening colonoscopy
       had no biopsy or polypectomy; the numerator is those with a ten-year
       recall documented in the report. An exclusion is a documented medical
       reason for a shorter interval — inadequate prep, a family history, a
       life expectancy under ten years — and it is its own column rather than
       a deduction, because a measure that quietly removed cases would be one
       nobody could reconcile against their own chart count.

       Columns we had invented and the reference does not print — a target, a
       "shorter than 10 years" split, a "not documented" split — have gone.
       They were reasonable things to want and they are not this report. */
    dimension: 'Provider',
    dimensionKey: 'provider',
    facets: { location: LOCATIONS },
    /* TWO PARAMETERS, WHICH IS THE WHOLE SHEET. A CMS measure is reported for
       a site and for the clinicians working it, and the reference screen asks
       for nothing else — no date basis, no procedure list, no grouping. A
       measure with parameters is a measure somebody can talk their way out
       of. */
    params: [
      { name: 'location', label: 'Location', control: 'select', on: 'location', options: LOCATIONS },
      { name: 'provider', label: 'Providers', control: 'select', on: 'provider', options: 'rows' },
    ],
    rows: [
      /* THE MEASURE RUNS LOW, AND IT SHOULD. It is satisfied by a recall
         interval written into the colonoscopy report as structured data, and
         most practices document the interval in prose that the measure engine
         cannot read — so the reference screen shows 2.33%, 0.00% and a
         practice total under one per cent. Generating it in the eighties
         would make the one report whose whole job is to say "this is not
         being captured" say the opposite. */
      {
        id: 'mensah',
        label: 'Amara Mensah, MD',
        tune: { denominator: { range: [4, 12] }, numerator: { share: [0.02, 0.14] } },
      },
      {
        id: 'bianchi',
        label: 'Luca Bianchi, MD',
        tune: { denominator: { range: [5, 14] }, numerator: { share: [0, 0.06] } },
      },
      {
        id: 'nakamura',
        label: 'Sana Nakamura, MD',
        /* The one who does write it into the recall field. On a report of
           near-zeros the outlier is the finding: it is not that the practice
           cannot hit the measure, it is that one endoscopist's template
           captures it and the others' do not. */
        tune: { denominator: { range: [3, 10] }, numerator: { share: [0.55, 0.85] } },
      },
      {
        id: 'okafor',
        label: 'Chidi Okafor, MD',
        tune: { denominator: { range: [4, 11] }, numerator: { share: [0, 0.08] } },
      },
    ],
    metrics: [
      { key: 'denominator', range: [2, 12] },
      { key: 'numerator', of: 'denominator', share: [0, 0.12] },
      /* Rare and whole. An exclusion is a sentence somebody wrote about one
         patient, so it is rolled per case rather than taken as a percentage
         of the day — which is what keeps a column of zeros honestly zero
         instead of rounding a fraction away. */
      { key: 'exclusions', of: 'denominator', chance: 0.02 },
    ],
    columns: [
      { key: 'row', label: 'Provider' },
      { key: 'denominator', label: 'Denominator', metric: true },
      { key: 'numerator', label: 'Numerator', metric: true },
      /* Two decimals, as the registry quotes it: at these levels one place
         would round 2.33% and 0.00% to the same figure. */
      {
        key: 'percentage',
        label: 'Percentage',
        rate: ['numerator', 'denominator'],
        format: 'percent2',
      },
      { key: 'exclusions', label: 'Number of exclusions', metric: true },
    ],
    stats: [
      { label: 'Denominator', metric: 'denominator' },
      { label: 'Numerator', metric: 'numerator' },
      { label: 'Percentage', rate: ['numerator', 'denominator'], format: 'percent2' },
      { label: 'Exclusions', metric: 'exclusions' },
    ],
  },
  {
    id: 'cahps',
    title: 'CAHPS Report',
    blurb: 'Survey composites, response rate and top-box score.',
    /* THE ONE REPORT WITH NO REFERENCE SCREEN, because there is nothing yet to
       photograph: the survey vendor's return file is still being configured.
       Its columns are therefore ours rather than the system's, and the notice
       above the table says so. A table of invented satisfaction scores with
       nothing on it to say so is the one thing in this pack a reader could
       quote in a meeting and be wrong about. */
    pending:
      'Under configuration in ModMed. The columns below are the agreed layout; the figures are a preview, not survey results.',
    /* Fielded once a week and summed across the range: unlike a balance, a
       fortnight of surveys really is two weeks of surveys added together. So
       the cadence is weekly and the report is NOT a snapshot — the two used
       to be the same test, and stamping "as of" the last Friday over a month
       of responses would have been the header contradicting the total under
       it. See isSnapshot() in js/lib/report-screen.js. */
    cadence: 'weekly',
    snapshot: false,
    dimension: 'Composite',
    dimensionKey: 'composite',
    /* ONE PARAMETER, AND IT IS THE COMPOSITE ITSELF. There is no reference
       sheet to copy — the survey feed is still being configured — so this
       report asks the only question its own rows can answer, and will be
       given the vendor's real parameters when there are any. */
    params: [
      { name: 'composite', label: 'Composite', control: 'select', on: 'composite', options: 'rows' },
    ],
    rows: [
      {
        id: 'access',
        label: 'Getting timely appointments, care and information',
        /* The composite that scores lowest in every practice that has ever
           run this survey. */
        tune: { topBox: { share: [0.52, 0.78] } },
      },
      { id: 'communication', label: 'How well providers communicate' },
      { id: 'coordination', label: 'Use of information to coordinate care' },
      { id: 'staff', label: 'Courteous and helpful office staff' },
      { id: 'rating', label: 'Rating of the provider (9–10)' },
      { id: 'recommend', label: 'Willingness to recommend the practice' },
    ],
    metrics: [
      { key: 'sent', range: [40, 260] },
      { key: 'responses', of: 'sent', share: [0.16, 0.4] },
      { key: 'topBox', of: 'responses', share: [0.6, 0.94] },
      { key: 'detractors', of: 'responses', share: [0.02, 0.14] },
    ],
    columns: [
      { key: 'row', label: 'Composite' },
      { key: 'sent', label: 'Surveys Sent', metric: true },
      { key: 'responses', label: 'Responses', metric: true },
      { key: 'responseRate', label: 'Response Rate', rate: ['responses', 'sent'] },
      { key: 'topBox', label: 'Top-box Responses', metric: true },
      { key: 'score', label: 'Top-box Score', rate: ['topBox', 'responses'] },
      { key: 'detractors', label: 'Detractors', metric: true },
      { key: 'share', label: 'Share of Responses', share: 'responses' },
    ],
    stats: [
      { label: 'Surveys sent', metric: 'sent' },
      { label: 'Responses', metric: 'responses' },
      { label: 'Response rate', rate: ['responses', 'sent'] },
      { label: 'Top-box score', rate: ['topBox', 'responses'] },
      { label: 'Detractors', metric: 'detractors' },
    ],
  },
];

/* ----------------------------------------------------------------------------
   THE CODE-LEVEL REPORTS SHARE ONE ROW LIST

   DPGI TB, Productivity Analysis and RRM Procedures are all "one row per CPT
   code", and three hand-written copies of the same fourteen codes would drift
   the first time a code was retired. The list is CPT above; what each report
   adds is the tuning its own figures need.

   Total WRVU is `units × the code's own WRVU`, and the vocabulary already
   expresses that: `of: 'units'` with a share whose low and high are both the
   RVU multiplies rather than picks a range. So the multiplication is declared
   in the same place as everything else rather than special-cased in the
   renderer.
   ------------------------------------------------------------------------- */
for (const report of REPORTS) {
  if (report.dimension !== 'Procedure code') continue;

  report.rows = CPT.map((cpt) => ({
    id: cpt.code,
    label: cpt.code,
    attrs: {
      description: cpt.label,
      wrvu: cpt.rvu.toFixed(2),
      /* A code carries the modifier it is usually billed with — the screening
         codes take 33, the diagnostic ones take nothing. */
      modifiers: cpt.code.startsWith('G') ? '33' : '',
    },
    tune: {
      /* Pathology is billed several blocks to one specimen; everything else is
         one unit per service. */
      units: cpt.code.startsWith('88') ? { share: [1, 2.6] } : { share: [1, 1] },
      totalWrvu: { share: [cpt.rvu, cpt.rvu] },
      /* A screening colonoscopy is the commonest thing this practice does; an
         ablation is the rarest. */
      serv: { range: [0, cpt.rvu > 5 ? 3 : 9] },
      /* Receipts and the balance behind them scale with how often the code is
         billed, but are recorded separately from today's services — see the
         note on Productivity Analysis. A rare code still settles the odd claim
         and still carries the odd balance; it just does so less often. */
      settled: { range: [0, cpt.rvu > 5 ? 2 : 5] },
      closing: { range: [0, cpt.rvu > 5 ? 900 : 2600] },
    },
  }));
}

/* ----------------------------------------------------------------------------
   EVERY SHEET ENDS WITH THE FAVOURITE, AND IT IS ADDED HERE RATHER THAN TWELVE
   TIMES

   THE ONE PARAMETER THAT IS NOT A PARAMETER. Every report in the practice
   management system ends its sheet with this, and it does not narrow anything:
   it puts the report at the top of the rail so the person who runs it every
   Monday morning stops hunting for it. It is kept out of the count on the
   Filters button for the same reason — a badge reading 1 over a panel that is
   narrowing nothing is the one thing that badge exists to prevent. See
   paramGroups() in js/lib/report-screen.js, which reads `favourite: true`
   rather than the name.

   Declared in a loop because "every report has it" is the whole claim. Written
   out twelve times it would be twelve chances to forget, and the thirteenth
   report would arrive without one — which is exactly how it went the first
   time: the year-end report had it and the other eleven did not, on a screen
   whose sheets are otherwise faithful to the reference.

   Last in the list, always: it is the last row of every parameter panel in the
   reference, under a rule, because it is the one control that acts on the
   report rather than on what the report contains.
   ------------------------------------------------------------------------- */
for (const report of REPORTS) {
  report.params = [
    ...(report.params ?? []),
    { name: 'favourite', label: 'Add To My Favorite', control: 'check', favourite: true },
  ];
}


/*
 * A report by id, falling back to the first.
 *
 * That fallback is what an address bar carrying nothing, or carrying a report
 * that has since been renamed, should open: a reader following a stale link
 * gets the pack rather than a blank screen with an error on it.
 */
export const reportById = (id) => REPORTS.find((report) => report.id === id) ?? REPORTS[0];
