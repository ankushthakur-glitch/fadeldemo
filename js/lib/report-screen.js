/**
 * THE REPORT SCREEN
 *
 * The whole of Reports is one screen: a shell (header, filter, an empty rail
 * and an empty table) plus one line of script, filled in from the twelve
 * reports declared in data/reports.js.
 *
 * WHY ONE RENDERER AND NOT TWELVE SCREENS
 * The reports differ in what a row IS and what is counted on it. They do NOT
 * differ in how a period is chosen, how a total is worked out, how a table is
 * drawn or what Export writes — and twelve copies of that would drift within
 * a fortnight. A thirteenth report is an entry in the catalogue and nothing
 * else. Time keeps a screen of its own because it genuinely is different: a
 * timesheet has corrections, an audit trail and a payroll export, and it is
 * reached from the clock in the header rather than from here.
 *
 * WHAT THE READER GETS
 *   the twelve reports down a rail, one click each
 *   a period navigator — week, month, quarter, year, or a custom range
 *   summary tiles for the range
 *   the table, one row per dimension member, with a totals line
 *   Export CSV and Print, both of which produce exactly what is on screen
 *
 * NOTHING RUNS PAST TODAY. Every period is clipped at today's date: a report
 * that offered next week's cancellations would be inventing them, and a total
 * that includes days which have not happened cannot be reconciled against
 * anything.
 */
import {
  BUSINESSES,
  REPORTS,
  buildFacts,
  buildRecords,
  businessOf,
  dayId,
  reportById,
} from '../../data/reports.js';
import { createPager } from './pagination.js';
import { chosen } from './filter-set.js';
import { iconMarkup } from './icons.js';

/* --- Dates -------------------------------------------------------------------
   Whole dates, never fixed millisecond steps — see the note in data/reports.js.
   ---------------------------------------------------------------------------- */

const PERIODS = ['Week', 'Month', 'Quarter', 'Year', 'Custom range'];

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(value, days) {
  const d = startOfDay(value);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(value, months) {
  const d = startOfDay(value);
  d.setMonth(d.getMonth() + months, 1);
  return d;
}

/** Monday-first, matching the scheduler's week and the Time report's. */
function startOfWeek(value) {
  const d = startOfDay(value);
  return addDays(d, -((d.getDay() + 6) % 7));
}

function startOfMonth(value) {
  const d = startOfDay(value);
  d.setDate(1);
  return d;
}

function startOfQuarter(value) {
  const d = startOfMonth(value);
  d.setMonth(d.getMonth() - (d.getMonth() % 3), 1);
  return d;
}

function startOfYear(value) {
  const d = startOfDay(value);
  d.setMonth(0, 1);
  return d;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDay(value) {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The range a period covers, always ending no later than today.
 *
 * `to` is INCLUSIVE — a report is read as "Monday to Sunday", and an exclusive
 * end date printed in the range label is the sort of off-by-one nobody spots
 * until they reconcile a month against an invoice.
 */
function rangeFor(state) {
  const today = startOfDay(Date.now());
  const anchor = startOfDay(state.anchor);

  let from;
  let end;

  switch (state.period) {
    case 'Month':
      from = startOfMonth(anchor);
      end = addDays(addMonths(from, 1), -1);
      break;
    case 'Quarter':
      from = startOfQuarter(anchor);
      end = addDays(addMonths(from, 3), -1);
      break;
    case 'Year':
      from = startOfYear(anchor);
      end = addDays(addMonths(from, 12), -1);
      break;
    case 'Custom range':
      from = startOfDay(state.custom.from);
      end = startOfDay(state.custom.to);
      break;
    default:
      from = startOfWeek(anchor);
      end = addDays(from, 6);
  }

  /* Clipped, not rejected: "this month" in the second week of the month is a
     perfectly good question, and the answer is the fortnight that has
     happened. The label says so rather than claiming a whole month. */
  const to = end > today ? today : end;
  return { from, to, end };
}

/* --- Numbers ------------------------------------------------------------------
   One place that decides what a figure looks like, so a rate on a tile and the
   same rate in the table below it cannot be rounded two different ways.
   ---------------------------------------------------------------------------- */

function formatValue(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  switch (format) {
    case 'money':
      return `$${Math.round(value).toLocaleString('en-US')}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    /* Two places, for the columns where one would hide the answer: a measure
       reported at 2.33% and one at 0.00% both round to "0%", and a share
       column whose job is to add up to a hundred shows its rounding error in
       the second decimal or not at all. */
    case 'percent2':
      return `${value.toFixed(2)}%`;
    case 'days':
      return `${value.toFixed(1)} days`;
    case 'minutes':
      return `${Math.round(value)} min`;
    case 'hoursDecimal':
      return `${value.toFixed(1)} h`;
    /* Work RVUs are quoted to two places, always — 2.26 for a diagnostic
       upper endoscopy, not 2.3. The default one place turns a column of
       fourteen distinct codes into one where several look identical, and it
       makes "units × WRVU" fail to reconcile against the two columns beside
       it by a rounding the reader cannot see. */
    case 'rvu':
      return value.toFixed(2);
    case 'hours': {
      // Room time is recorded in minutes and read in hours — 7h 20m, not 440.
      const total = Math.round(value);
      return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
    }
    default:
      return Number.isInteger(value)
        ? value.toLocaleString('en-US')
        : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
}

/** The same figure for a spreadsheet: no symbols, no separators, no units. */
function csvValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/* --- Adding it up --------------------------------------------------------------

   How a metric is added up is a property of the METRIC, not of the column that
   happens to show it: a median wait is averaged wherever it appears, and the
   longest wait is a maximum wherever it appears. The report declares that on
   whichever column or tile mentions it first; this reads it back off both so a
   tile and its column can never disagree.
   ------------------------------------------------------------------------------ */

function metricAggs(report) {
  const aggs = {};
  const note = (spec) => {
    const key = typeof spec.metric === 'string' ? spec.metric : spec.key;
    if (spec.metric && !aggs[key]) aggs[key] = spec.agg ?? 'sum';
  };
  report.columns.forEach(note);
  report.stats.forEach(note);
  /* A metric may say for itself how it adds up, and that is the honest place
     for it: a headcount is a balance whether or not a column happens to be
     showing it this run. Only used when nothing else has spoken, so a column
     asking for the same metric two ways — the two A/R balances on the
     year-end report — still wins. */
  report.metrics.forEach((m) => {
    if (!aggs[m.key]) aggs[m.key] = m.agg ?? 'sum';
  });
  return aggs;
}

/**
 * Facts → one bucket per row of the table, plus a grand total bucket.
 *
 * The grand bucket is aggregated from the FACTS, not from the row buckets. It
 * matters for averages and maxima: the median wait across the practice is the
 * average of every clinic day, not the average of six per-type averages, which
 * would weight a type with two requests the same as one with two hundred.
 */
function aggregate(report, facts, group, totals) {
  const aggs = metricAggs(report);
  const latest = facts.reduce((max, fact) => (fact.date > max ? fact.date : max), '');
  const earliest = facts.reduce((min, fact) => (min && fact.date > min ? min : fact.date), '');

  /*
   * `first` and `last` are kept for EVERY metric, whatever its declared
   * aggregation, and not only for the ones a report happens to read that way.
   *
   * The year-end report is why. It puts the A/R balance at the start of the
   * period beside the balance at the end — the same metric, twice, aggregated
   * two different ways in adjacent columns. Aggregation as a property of the
   * metric alone cannot express that: whichever column was declared first
   * would win and the other would silently repeat it. So the balance on the
   * earliest day in range and the balance on the latest are always available,
   * and a column says which one it means.
   */
  const empty = () => ({ values: {}, counts: {}, first: {}, last: {} });
  /* One bucket per row the table is going to have — which is the report's own
     rows when it is grouped the way it was declared, and the vocabulary of a
     facet when Group By has been answered. Seeded from the row list rather
     than discovered from the facts, so the order down the table is the order
     the catalogue declares rather than the order the first Tuesday happened
     to produce. */
  const buckets = new Map(group.rows.map((row) => [row.id, empty()]));
  const grand = empty();

  const fold = (bucket, key, value, date) => {
    if (date === earliest) bucket.first[key] = (bucket.first[key] ?? 0) + value;
    if (date === latest) bucket.last[key] = (bucket.last[key] ?? 0) + value;

    const agg = aggs[key];
    if (agg === 'max') {
      bucket.values[key] = Math.max(bucket.values[key] ?? -Infinity, value);
    } else if (agg === 'last') {
      // Only the newest snapshot in range counts — a balance is not a flow.
      if (date === latest) bucket.values[key] = (bucket.values[key] ?? 0) + value;
    } else if (agg === 'first') {
      if (date === earliest) bucket.values[key] = (bucket.values[key] ?? 0) + value;
    } else {
      bucket.values[key] = (bucket.values[key] ?? 0) + value;
      bucket.counts[key] = (bucket.counts[key] ?? 0) + 1;
    }
  };

  for (const fact of facts) {
    /* Which row this day's figures land on: the report's own dimension, or
       whatever Group By chose. Both are facets on the fact — see facetsFor()
       in data/reports.js — so regrouping a report is a different key here and
       nothing else anywhere. */
    const bucket = buckets.get(fact.facets?.[group.key] ?? fact.row);
    for (const [key, value] of Object.entries(fact.metrics)) {
      if (bucket) fold(bucket, key, value, fact.date);
      fold(grand, key, value, fact.date);
    }
  }

  const finish = (bucket) => {
    for (const [key, agg] of Object.entries(aggs)) {
      if (agg === 'avg' && bucket.counts[key]) bucket.values[key] /= bucket.counts[key];
      if (bucket.values[key] === -Infinity) bucket.values[key] = null;
    }
    /* A part written "-payments" is subtracted. RRM's net A/R is charges plus
       refunds less payments less adjustments — a figure nobody records, worked
       out once here so the column and its total cannot drift apart. */
    for (const [key, parts] of Object.entries(totals ?? {})) {
      bucket.values[key] = parts.reduce((sum, part) => {
        const negative = part.startsWith('-');
        const value = bucket.values[negative ? part.slice(1) : part] ?? 0;
        return negative ? sum - value : sum + value;
      }, 0);
    }
    return bucket;
  };

  buckets.forEach(finish);
  finish(grand);

  return { buckets, grand, latest };
}

/**
 * WHAT KIND OF THING A COLUMN HOLDS — the four ranks the table is coloured by.
 *
 * A report is nine or ten columns wide and every one of them used to be drawn
 * in the same ink, which made the table a wall: the row's name carried no more
 * weight than the third of five aged buckets, and the rate the whole row exists
 * to produce carried no more weight than the counts it was worked out from.
 *
 *   label     what the row IS — a payer, a provider, a CPT code
 *   derived   the answer: a rate, an incidence, a share. Worked out from the
 *             totals, and the figure a reader came to the row for
 *   metric    the working: the raw counts and amounts that were added up
 *   attr      reference the row simply carries — a benchmark, a GL code, an
 *             FTE. Never measured, never added up
 *
 * The ranking is read off the column's own declaration rather than listed
 * anywhere, so a column added to data/reports.js is coloured correctly by
 * saying what it is, which it has to say regardless.
 */
function columnKind(column, index) {
  if (column.key === 'row') return 'label';
  if (column.attr) return 'attr';
  if (column.rate || column.per || column.share) return 'derived';
  /* On a detail report the row is a record, so the ranks fall differently:
     the money on the line is the figure, everything else on it — a name, an
     MRN, a code, a site — is what identifies it. Only the columns declared
     with a format or a total are treated as figures.

     The first column is the anchor whatever it holds, the way the dimension
     is on a summary: it is what a reader runs their eye down to find the row
     they came for. */
  if (column.field) {
    if (index === 0) return 'label';
    return column.format || column.total ? 'metric' : 'attr';
  }
  return 'metric';
}

/**
 * One cell: what a column says about one bucket.
 *
 * Rates and shares are worked out HERE, from totals that have already been
 * added up — never averaged across days. See the note at the head of
 * data/reports.js for why that distinction is the whole point.
 */
function cell(column, bucket, grand, row) {
  if (column.attr) return { text: row?.attrs?.[column.key] ?? '—', numeric: false };
  if (column.key === 'row') return { text: row?.label ?? 'Total', numeric: false };

  if (column.rate) {
    const [part, whole] = column.rate;
    const divisor = bucket.values[whole];
    const value = divisor ? (bucket.values[part] / divisor) * 100 : null;
    return { value, text: formatValue(value, column.format ?? 'percent'), numeric: true };
  }

  if (column.per) {
    const [part, whole] = column.per;
    const divisor = bucket.values[whole];
    const value = divisor ? (bucket.values[part] / divisor) * (column.scale ?? 1) : null;
    return { value, text: formatValue(value, column.format ?? 'number'), numeric: true };
  }

  if (column.share) {
    const divisor = grand.values[column.share];
    const value = divisor ? (bucket.values[column.share] / divisor) * 100 : null;
    return { value, text: formatValue(value, column.format ?? 'percent'), numeric: true };
  }

  const key = typeof column.metric === 'string' ? column.metric : column.key;

  /* A column may ask for the metric on the first or the last day in range
     rather than for the range's own total — the two A/R balances on the
     year-end report are the same metric read both ways. See aggregate(). */
  const value =
    column.agg === 'first'
      ? bucket.first[key] ?? 0
      : column.agg === 'last'
        ? bucket.last[key] ?? 0
        : bucket.values[key] ?? 0;

  return { value, text: formatValue(value, column.format ?? 'number'), numeric: true };
}

/**
 * ONE CELL OF A DETAIL REPORT, where the row is a record rather than a bucket.
 *
 * There is nothing to work out: the record already holds the value under the
 * column's own key. All this decides is how it is drawn and whether it counts
 * as a figure, which is what puts it in the right rank of ink and the right
 * side of its column.
 */
function fieldCell(column, record, sums) {
  /* A share is the one thing on a detail row that is not on the row: this
     line's charges as a percentage of every line's, which needs the whole
     report to work out. `sums` is the totals line, computed once and handed
     down — so the percentage column and the total under it are the same
     arithmetic, and the totals row itself lands on 100% by construction
     rather than by being told to say so. */
  if (column.share) {
    const divisor = sums?.[column.share];
    const value = divisor ? ((record[column.share] ?? 0) / divisor) * 100 : null;
    return { value, text: formatValue(value, column.format ?? 'percent'), numeric: true };
  }

  const value = record[column.key];
  const numeric = Boolean(column.format || column.total);
  if (!numeric) return { text: value ?? '—', numeric: false };
  return { value, text: formatValue(value, column.format ?? 'number'), numeric: true };
}

/**
 * The totals line of a detail report: only the columns that declare one.
 *
 * A report of payments has thirteen columns and exactly one of them can be
 * added up. Summing a column of MRNs would be arithmetic on an identifier,
 * and averaging a column of dates is not a date.
 */
function recordTotals(columns, records) {
  const totals = {};
  for (const column of columns) {
    if (column.total !== 'sum') continue;
    totals[column.key] = records.reduce((sum, record) => sum + (record[column.key] ?? 0), 0);
  }
  return totals;
}

/** One summary tile of a detail report, from the records themselves. */
function recordStat(stat, records) {
  if (stat.count) return { value: records.length, text: formatValue(records.length) };

  const values = records.map((record) => record[stat.field]);

  if (stat.agg === 'distinct') {
    const count = new Set(values).size;
    return { value: count, text: formatValue(count) };
  }
  if (stat.agg === 'countOf') {
    const count = values.filter((value) => value === stat.match).length;
    return { value: count, text: formatValue(count) };
  }
  if (stat.agg === 'max') {
    const max = values.length ? Math.max(...values) : null;
    return { value: max, text: formatValue(max, stat.format) };
  }

  const sum = values.reduce((total, value) => total + (value ?? 0), 0);
  const value = stat.agg === 'avg' ? (records.length ? sum / records.length : null) : sum;
  return { value, text: formatValue(value, stat.format) };
}

/* ============================================================================
   THE SCREEN
   ========================================================================= */

/* --- The parameter sheet ------------------------------------------------------
   WHICH, as against the period navigator's WHEN.

   A report is not opened, it is RUN — with a sheet of parameters that is
   different on every one of them, because it is copied from the sheet of the
   report it replaces. The year-end report is run for providers, sites, codes
   and a bill type; Patient by Carrier for a carrier and a payer group; ASC-09
   for a site and a provider and nothing else. The catalogue declares each
   sheet in `params`; everything below reads them.

   THE PERIOD AND THE BUSINESS ARE NOT HERE. They are the same two questions on
   all twelve reports, so they live in the header beside Export where they stay
   answered as the reader moves down the rail. What is behind the button is
   what changes report to report.

   FOUR KINDS OF ANSWER, AND ONLY ONE OF THEM IS A FILTER

     it narrows      `on` names a field on a record or a facet on a fact, and
                     the answers are compared against it
     it regroups     `groupBy` chooses what a row IS: the same figures, added
                     up a different way
     it attributes   `reportBy` chooses whether "provider" means the one who
                     did the work or the one who billed it
     it reshapes     a tick box, which may reveal a column, put one away,
                     widen a total, or collapse a table of lines into a table
                     of groups

   THE ANSWERS ARE THE VOCABULARY, NOT WHAT TURNED UP. They are declared with
   the parameter rather than read off the period on screen, and that is a
   deliberate reversal of how this screen used to build its filter: a list
   derived from the records showed a reader only the providers who happened to
   work in March, which quietly told them the other two had left. A provider
   who did no work in the period is a perfectly good thing to run a report for.
   The answer is an empty table, and the empty table says so.
   --------------------------------------------------------------------------- */

/** The parameter sheet of this report, ready for <ui-filter>. */
function paramGroups(report) {
  return (report.params ?? []).map((param) => ({
    name: param.name,
    label: param.label,
    control: param.control ?? 'select',
    single: Boolean(param.single),
    empty: param.empty,
    /* The favourite switch narrows nothing, so it is not one of the answers
       the button counts. Everything else on the sheet is. */
    badge: !param.favourite,
    /* `options: 'rows'` means the report's own rows — the six locations, the
       nine carriers, the eighteen codes. Written out it would be the same list
       twice in one file, and the second copy is where a renamed carrier stops
       being pickable. The VALUE is the row's id and the label is what the
       table shows, so an answer survives a report whose wording is edited. */
    options:
      param.options === 'rows'
        ? (report.rows ?? []).map((row) => ({ value: row.id, label: row.label }))
        : param.control === 'check'
          ? [{ value: 'yes', label: param.label }]
          : param.options ?? [],
  }));
}

/** Every parameter that narrows: it names a field or a facet to compare. */
const narrowingParams = (report) => (report.params ?? []).filter((param) => param.on);

/** The one parameter that says what a row is, if the report has one. */
const findParam = (report, flag) => (report.params ?? []).find((param) => param[flag]);

/**
 * Does this row, record or fact get through the sheet?
 *
 * One rule for all three, because by the time this is asked they are all just
 * a thing with values on it: a record has its fields, a fact has its facets,
 * and both answer to the same `on` key. Nothing answered means nothing
 * narrowed — see js/lib/filter-set.js.
 */
function admitsAll(params, filters, valueOf) {
  return params.every((param) => {
    const picked = chosen(filters[param.name]);
    if (!picked.length) return true;
    const value = valueOf(param.on);

    /* A pair of controls that are one range: a service date somewhere between
       two days, an age somewhere between two years. Compared as text for a
       date (an ISO day sorts as a string) and as a number for an age. */
    if (param.bound) {
      const limit = picked[0];
      const [a, b] = Number.isNaN(Number(limit))
        ? [String(value ?? ''), limit]
        : [Number(value), Number(limit)];
      return param.bound === 'from' ? a >= b : a <= b;
    }

    return picked.includes(String(value ?? ''));
  });
}

/**
 * WHAT A ROW IS, THIS RUN.
 *
 * Every summary fact carries the dimension it was declared with AND a draw of
 * each facet the report offers, so grouping by provider is a different key
 * into the same facts rather than a different report. `rows` is what the table
 * is seeded with: the catalogue's own rows when nothing has been regrouped —
 * they carry labels, attributes and an order somebody chose — and the facet's
 * vocabulary when it has.
 */
function grouping(report, filters) {
  const native = report.dimensionKey ?? 'dimension';
  const param = findParam(report, 'groupBy');
  const answer = param ? chosen(filters[param.name])[0] : null;

  if (!answer) {
    return { key: native, label: report.dimension ?? 'Rows', rows: report.rows ?? [] };
  }

  /* "Provider" is not a facet: it is whichever of the two provider facets the
     Report By parameter names. A case done under supervision has two of them
     and the report has to be told which one it is about. */
  const attribution = findParam(report, 'reportBy');
  const key =
    answer === 'provider'
      ? chosen(filters[attribution?.name])[0] ?? 'performing'
      : answer;

  const label = param.options.find((option) => option.value === answer)?.label ?? answer;
  const vocabulary = report.facets?.[key] ?? [];
  return { key, label, rows: vocabulary.map((value) => ({ id: value, label: value })) };
}

/**
 * The columns this run draws, out of the ones the report declares.
 *
 * A column may answer to a tick box — patient details, unapplied credits — or
 * to the lens a Gender parameter puts over the report. Deciding it here rather
 * than in the table means the export writes exactly the columns that were on
 * screen, which is the one thing an exported report has to promise.
 */
function visibleColumns(report, filters) {
  const on = (name) => chosen(filters[name]).length > 0;

  return report.columns.filter((column) => {
    if (column.only && !on(column.only)) return false;
    if (column.hidden && on(column.hidden)) return false;

    if (column.lens) {
      const [[name, wanted]] = Object.entries(column.lens);
      const answer = chosen(filters[name])[0] ?? '';
      /* A column declared for no answer at all — the both-genders percentage —
         goes as soon as the report is run for one of them. */
      return wanted === '' ? answer === '' : answer === '' || answer === wanted;
    }

    return true;
  });
}

/**
 * The report's totals, plus whatever a ticked box has to say about them.
 *
 * "Include unsigned services" is the case: it widens four denominators at
 * once, and doing that by declaring the wider version of them is a great deal
 * safer than a second set of columns that has to be kept in step with the
 * first.
 */
function totalsFor(report, filters) {
  let totals = report.totals ?? {};
  for (const param of report.params ?? []) {
    if (!param.totals || !chosen(filters[param.name]).length) continue;
    totals = { ...totals, ...param.totals };
  }
  return totals;
}

/**
 * IS THIS DETAIL REPORT SHOWING LINES, OR GROUPS?
 *
 * A grouping parameter on a detail report is not a filter and not a sort: it
 * collapses four hundred posted lines into eleven rows of totals, which is the
 * shape the report is read in when somebody wants the answer rather than the
 * working. "Show grouping details" is the way back — tick it and the lines
 * come back with the grouping still chosen, which is what the reference
 * report's own switch does.
 *
 * Null means lines, which is where every one of them opens.
 */
function detailGrouping(report, columns, filters) {
  const param = findParam(report, 'groupBy');
  const key = param ? chosen(filters[param.name])[0] : null;
  if (!key) return null;

  const details = findParam(report, 'details');
  if (details && chosen(filters[details.name]).length) return null;

  const label = param.options.find((option) => option.value === key)?.label ?? key;

  /* 45385 and 45385-33 are one code billed for two reasons. Split only where
     the split means something — under a grouping by code — because a location
     with a modifier stuck on the end of its name is not a group anybody asked
     for. */
  const splitter = (report.params ?? []).find(
    (p) => p.splitBy?.group === key && chosen(filters[p.name]).length
  );

  return {
    key,
    label,
    split: splitter?.splitBy.field ?? null,
    /* THE COLUMNS OF A GROUPED TABLE ARE NOT THE COLUMNS OF THE LINES. A group
       of forty lines has forty service dates, forty patients and one set of
       money: what can be added up is the money, and everything else would be
       a column of dashes as wide as the table. So the grouped table is the
       group, how many lines were in it, and the figures — including the share
       columns, which are the group's share of every line's and read the same
       way they always did. */
    columns: [
      { key: '__group', label, field: true },
      { key: '__count', label: 'Lines', field: true, total: 'sum' },
      ...columns.filter((column) => column.total === 'sum' || column.share),
    ],
  };
}

/** Records → one row per group, with the money added up and the lines counted. */
function groupRecords(records, group) {
  const rows = new Map();

  for (const record of records) {
    const base = String(record[group.key] ?? '—');
    const key = group.split ? `${base} ${record[group.split] ?? ''}`.trim() : base;

    let row = rows.get(key);
    if (!row) {
      row = { __group: key, __count: 0 };
      rows.set(key, row);
    }
    row.__count += 1;

    for (const column of group.columns) {
      if (column.total !== 'sum' || column.key === '__count') continue;
      row[column.key] = (row[column.key] ?? 0) + (record[column.key] ?? 0);
    }
  }

  /* Alphabetical, and deliberately not by size: a reader looking for one code
     or one carrier is looking it up, not reading a league table. */
  return [...rows.values()].sort((a, b) => a.__group.localeCompare(b.__group));
}

export function mountReportScreen() {
  document.addEventListener('DOMContentLoaded', () => {
    const el = (id) => document.getElementById(id);
    const test = (name) => document.querySelector(`[data-testid="report--${name}"]`);

    const params = new URLSearchParams(location.search);

    const state = {
      report: reportById(params.get('report')),
      period: { week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' }[
        params.get('range')
      ] ?? 'Month',
      anchor: Date.now(),
      custom: { from: addDays(Date.now(), -29).getTime(), to: startOfDay(Date.now()).getTime() },
      /* What the parameter sheet is holding, as { name: [values] }. Emptied
         whenever a different report is opened — see choose(). */
      filters: {},
      /* WHICH COMPANY, and it survives the report changing. The practice is
         two businesses and a reader working through the ASC's month wants the
         next report to be the ASC's too — which is the whole argument for
         this being in the header rather than on each report's sheet. */
      business: '',
      /* WHICH REPORTS THE READER HAS STARRED. Not a filter and not part of the
         answers: it belongs to the person rather than to the run, so it lives
         beside them here and the rail draws it. Held for the visit only — a
         prototype with no account to keep it on — which is honest enough for
         a switch whose whole job is to be seen working. */
      favourites: new Set(),
    };

    const pager = createPager(el('repFoot'), {
      noun: 'rows',
      rowsPerPage: 25,
      testidPrefix: 'report-rows',
      onChange: () => paint(),
    });

    /** Open a report, remember it in the address bar, redraw. */
    function choose(id) {
      state.report = reportById(id);
      pager.reset();
      /* THE ANSWERS GO WITH THE REPORT THEY ANSWERED.
         "Location: ASC" carried across to Patient by Carrier would be a tick
         against a question that report does not ask — invisible in the panel,
         and still narrowing the table. <ui-filter> keeps ticks whose answer is
         still on offer, which is right when a list refreshes under a reader
         and wrong here, because this is a different list. */
      state.filters = {};
      filterEl?.clear();
      /* The new report's own sheet, which is a different sheet: eleven
         reports and no two of them are run with the same parameters. */
      syncFilter(state.report);
      /* The address bar keeps up, so a report a reader wants to come back to —
         or send to a colleague — is a link rather than a set of directions. */
      const next = new URLSearchParams(location.search);
      next.set('report', state.report.id);
      history.replaceState(null, '', `?${next}`);
      paint();
    }

    /* --- The rail ---------------------------------------------------------
       Built here rather than written into the shell: the screen would
       otherwise hold its own copy of the catalogue's titles, and a report
       renamed in data/reports.js would keep its old name on the button that
       opens it.

       A COLUMN, NOT A STRIP. Twelve titles do not fit a row — several of
       these run to a full phrase, "Appointment cancellation report", "ASC-09
       Follow-up interval" — and they are picked from BY NAME rather than
       stepped through: somebody has come to this screen for the TB and
       nothing else. A tab strip would have scrolled, which hides half the
       pack behind a gesture nobody knows is available. Down the left, all
       twelve are in view at once and the report fills the rest of the width.
    */
    const rail = el('repRail');

    rail.innerHTML = REPORTS.map(
      (report) => `
        <li>
          <button type="button" class="rep__rail-item" data-report="${report.id}"
            data-testid="report--rail-${report.id}">
            <span class="rep__rail-label">${report.title}</span>
            <!-- Drawn for a report the reader has favourited, and hidden
                 otherwise: the star is on every button so that turning one on
                 does not reflow the rail under the cursor. -->
            <span class="rep__rail-star" data-star hidden>
              ${iconMarkup('star-filled', 'ui-icon')}
              <span class="u-sr-only">Favourite</span>
            </span>
            ${report.pending ? '<span class="rep__rail-tag">Setup</span>' : ''}
          </button>
        </li>`
    ).join('');

    /* One listener on the list rather than twelve on the buttons: the rail is
       rebuilt only here, but a delegated handler is the one that cannot be
       forgotten if it ever is rebuilt somewhere else. */
    rail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-report]');
      if (button) choose(button.dataset.report);
    });

    /* --- The parameter sheet ------------------------------------------------
       The parameters come from the open report, so the panel is rebuilt when
       one is chosen: eleven reports, eleven sheets, and a Location answered on
       one of them means nothing on the next.

       They no longer change with the PERIOD. The sheet is the report's own
       vocabulary rather than a reading of what the month produced — see the
       note on paramGroups() — so a reader who has answered four parameters
       can step from March to April and find their four answers still there.
       ---------------------------------------------------------------------- */

    const filterEl = el('repFilter');

    /** Put this report's sheet in the panel. */
    function syncFilter(report) {
      if (!filterEl) return;

      const groups = paramGroups(report);
      filterEl.setGroups(groups);
      /* A report with nothing to ask — nothing does today — gets a disabled
         button rather than a button that opens an empty panel. */
      filterEl.disabled = groups.length === 0;

      /* The star comes back on when a favourited report is opened again. The
         rest of the sheet does not: those answers were about a run, this one
         is about the report. */
      const favourite = findParam(report, 'favourite');
      if (favourite && state.favourites.has(report.id)) {
        filterEl.value = { ...filterEl.value, [favourite.name]: ['yes'] };
      }

      state.filters = filterEl.value;
    }

    filterEl?.addEventListener('ui-filter-change', () => {
      state.filters = filterEl.value;

      const favourite = findParam(state.report, 'favourite');
      if (favourite) {
        const on = chosen(state.filters[favourite.name]).length > 0;
        state.favourites[on ? 'add' : 'delete'](state.report.id);
      }

      /* Back to page one: the reader is on page three of a list that no
         longer has three pages. */
      pager.reset();
      paint();
    });

    /* --- The business -------------------------------------------------------
       The same question on every report, so it is asked once in the header and
       kept as the reader moves down the rail.

       It is answered from the SITE rather than from a field of its own: a
       charge posted at the ASC is the ASC's business by definition. A report
       whose rows are not about a site at all — the panel by carrier, the
       survey composites — is not narrowed by it, because it has nothing
       honest to compare. See businessOf() in data/reports.js.
       ---------------------------------------------------------------------- */

    const businessEl = el('repBusiness');
    businessEl?.setOptions(BUSINESSES);

    businessEl?.addEventListener('ui-change', () => {
      state.business = businessEl.value;
      pager.reset();
      paint();
    });

    /* --- The period navigator --------------------------------------------- */

    el('repPeriod').setAttribute('value', state.period);

    function syncNavigators() {
      document.querySelectorAll('[data-nav]').forEach((nav) => {
        nav.hidden = nav.dataset.nav !== state.period;
      });

      const anchor = startOfDay(state.anchor);
      el('navWeek').setAttribute('value', dayId(startOfWeek(anchor)));
      el('navMonth').setAttribute('value', dayId(anchor).slice(0, 7));
      el('navQuarter').setAttribute('value', quarterId(startOfQuarter(anchor)));
      el('navYear').setAttribute('value', String(anchor.getFullYear()));
      el('navFrom').setAttribute('value', dayId(state.custom.from));
      el('navTo').setAttribute('value', dayId(state.custom.to));
    }

    function quarterId(date) {
      return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    }

    /* Eight quarters and five years back — as far as anyone steps by hand
       before they reach for a custom range instead. */
    el('navQuarter').setOptions(
      Array.from({ length: 8 }, (_, n) => {
        const start = addMonths(startOfQuarter(Date.now()), -n * 3);
        return { value: quarterId(start), label: `${quarterId(start).replace('-', ' ')}` };
      })
    );
    el('navYear').setOptions(
      Array.from({ length: 5 }, (_, n) => {
        const year = new Date().getFullYear() - n;
        return { value: String(year), label: String(year) };
      })
    );

    el('repPeriod').addEventListener('ui-change', () => {
      state.period = PERIODS.includes(el('repPeriod').value) ? el('repPeriod').value : 'Month';
      pager.reset();
      syncNavigators();
      paint();
    });

    el('navWeek').addEventListener('ui-change', () => {
      const ms = Date.parse(`${el('navWeek').value}T00:00:00`);
      if (Number.isFinite(ms)) state.anchor = ms;
      paint();
    });

    el('navMonth').addEventListener('ui-change', () => {
      const ms = Date.parse(`${el('navMonth').value}-01T00:00:00`);
      if (Number.isFinite(ms)) state.anchor = ms;
      paint();
    });

    el('navQuarter').addEventListener('ui-change', () => {
      const [year, quarter] = el('navQuarter').value.split('-Q');
      state.anchor = new Date(Number(year), (Number(quarter) - 1) * 3, 1).getTime();
      paint();
    });

    el('navYear').addEventListener('ui-change', () => {
      state.anchor = new Date(Number(el('navYear').value), 0, 1).getTime();
      paint();
    });

    for (const id of ['navFrom', 'navTo']) {
      el(id).addEventListener('ui-change', () => {
        const from = Date.parse(`${el('navFrom').value}T00:00:00`);
        const to = Date.parse(`${el('navTo').value}T00:00:00`);
        if (Number.isFinite(from)) state.custom.from = from;
        if (Number.isFinite(to)) state.custom.to = to;
        // A range that runs backwards returns nothing and explains nothing.
        if (state.custom.to < state.custom.from) state.custom.to = state.custom.from;
        pager.reset();
        /* The fields have to show the range actually being reported. With the
           bar's read-back line gone they are the ONLY statement of it on
           screen, so a correction made behind an unchanged To date would be a
           report of a range nothing on the page admits to. */
        syncNavigators();
        paint();
      });
    }

    /* --- Painting ----------------------------------------------------------- */

    /** Everything on screen, for the report and range currently chosen. */
    function view() {
      const report = state.report;
      const { from, to, end } = rangeFor(state);
      const empty = to < from;

      const filters = state.filters;
      /* The sheet's answers, read once for this paint: which columns survive
         it, which totals it puts in force, and what a row is. */
      const columns = visibleColumns(report, filters);
      const totals = totalsFor(report, filters);
      const narrowing = narrowingParams(report);

      /* A DETAIL REPORT HAS NOTHING TO AGGREGATE. Its rows are the records
         themselves — a payment, a charge line, a cancelled appointment — so
         it skips the fact/bucket machinery entirely and the pager does the
         work that grouping does elsewhere. */
      if (report.kind === 'detail') {
        const allRecords = empty ? [] : buildRecords(report, from, to);

        const records = allRecords.filter((record) => {
          if (!admitsBusiness(record.location)) return false;
          /* A switch that lets a class of record back in rather than one that
             narrows: a rescheduled appointment is out of the cancellation
             report unless "Show rescheduled" asks for it. */
          for (const param of report.params ?? []) {
            if (!param.excludes || chosen(filters[param.name]).length) continue;
            if (record[param.excludes.field] === param.excludes.value) return false;
          }
          return admitsAll(narrowing, filters, (key) => record[key]);
        });

        /* GROUPED, THE TABLE IS A DIFFERENT TABLE. One row per group, and only
           the columns that can be added up under it — see groupRecords(). */
        const group = detailGrouping(report, columns, filters);
        const rows = group ? groupRecords(records, group) : records;

        return {
          report, from, to, end,
          empty: rows.length === 0,
          records, allRecords, rows, group,
          columns: group ? group.columns : columns,
          narrowed: records.length !== allRecords.length,
        };
      }

      /* Every fact that answers the sheet. Narrowing here rather than after
         the aggregation is the whole point of the facets: the totals line, the
         tiles and every derived rate are then worked out from the days the
         parameters actually asked for. */
      const admitsFact = (fact) =>
        admitsBusiness(locationOf(report, fact)) &&
        admitsAll(narrowing, filters, (key) => fact.facets?.[key]);

      const facts = empty ? [] : buildFacts(report, from, to).filter(admitsFact);

      /* What a row is, this run: the report's own dimension, or whatever Group
         By was answered with. */
      const group = grouping(report, filters);
      const regrouped = group.key !== (report.dimensionKey ?? 'dimension');
      const { buckets, grand, latest } = aggregate(report, facts, group, totals);

      /* YEAR TO DATE IS A SECOND AGGREGATION, not the first one scaled up.
         The year-end report puts a month beside the year it sits in, and
         there is no honest way to get from one to the other by arithmetic —
         a January of a hundred cases says nothing about February. So the
         facts are built again from the first of the period's year, and a
         column marked `scope: 'ytd'` reads that set instead. Built only when
         a column actually asks for it: on the other nine reports it would be
         a year of figures nobody looks at. */
      const wantsYtd = [...report.columns, ...report.stats].some((spec) => spec.scope === 'ytd');
      const ytd =
        wantsYtd && !empty
          ? aggregate(
              report,
              buildFacts(report, startOfYear(to), to).filter(admitsFact),
              group,
              totals
            )
          : { buckets, grand };

      const allRows = group.rows
        .map((row) => ({ row, bucket: buckets.get(row.id), ytd: ytd.buckets.get(row.id) }))
        .filter(({ bucket }) => facts.length > 0 && bucket);

      /* A ROW WITH NOTHING ON IT IS NOT A ROW. Once the sheet has been
         answered, most of a facet's vocabulary has no facts left — a report
         grouped by provider and run for one of them has four empty rows and
         one real one, and four rows of dashes is not a finding. The report's
         own rows survive an empty period the way they always did, because
         `facts.length` is what decides whether the table is empty at all. */
      const rows = allRows.filter(({ bucket }) => Object.keys(bucket.values).length > 0);

      /* THE TOTALS LINE IS THE ANSWER TO THE SHEET, not to the rows on screen.
         It is the aggregate of every fact that survived the parameters —
         which is what it should be, because the parameters are what the
         report was run with. Every derived column is a rate over it. */
      return {
        report, from, to, end,
        empty: facts.length === 0,
        facts, rows, allRows, grand, ytd, latest, group,
        /* THE FIRST HEADING IS WHAT A ROW IS, and a regrouped report's rows
           are not what the catalogue called them. Rewritten here rather than
           in the catalogue because it is a property of the run: the same
           report is "Location" one minute and "Provider" the next.

           An ATTRIBUTE column goes with them. A code's description and its
           work RVU belong to the code; regrouped by site, there is no code on
           the row to have them, and a column of dashes under a heading that
           promises otherwise is worse than the column not being there. */
        columns: columns
          .filter((column) => !(regrouped && column.attr))
          .map((column, index) =>
            index === 0 && group.label ? { ...column, label: group.label } : column
          ),
        narrowed: rows.length !== allRows.length,
      };
    }

    /** Does this row belong to the business the header is asking about? */
    function admitsBusiness(location) {
      if (!state.business) return true;
      const business = businessOf(location);
      /* A row that cannot say which business it belongs to is not narrowed by
         one. The carrier panel is the case: it is the practice's, not a
         site's. */
      return business === null || business === state.business;
    }

    /**
     * The site a summary fact happened at, for the business question.
     *
     * A report whose rows ARE locations carries it as the row; one that does
     * not carries it as a facet; one that is about neither — the carrier
     * panel, the survey — has no site at all and says so with a null.
     */
    function locationOf(report, fact) {
      const value = fact.facets?.location;
      if (value === undefined) return null;
      if (report.dimensionKey !== 'location') return value;
      return (report.rows ?? []).find((row) => row.id === value)?.label ?? null;
    }

    /** The bucket a column reads: the period's own, or the year's. */
    const scopeOf = (column, row, data) =>
      column.scope === 'ytd' ? row.ytd ?? row.bucket : row.bucket;

    function paint() {
      const data = view();
      const { report } = data;

      /* The title alone. `report.blurb` is still declared on every report and
         is still the place the catalogue explains itself — it is simply not
         drawn here any more; see the note in screens/reports.html. */
      el('repHeading').textContent = report.title;

      /* The rail's own selected state. aria-current rather than a class alone
         because the rail is a list of links to twelve things and a reader on
         a screen reader gets nothing at all from a background colour. */
      rail.querySelectorAll('[data-report]').forEach((button) => {
        const on = button.dataset.report === report.id;
        button.classList.toggle('rep__rail-item--current', on);
        if (on) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');

        const star = button.querySelector('[data-star]');
        if (star) star.hidden = !state.favourites.has(button.dataset.report);
      });

      /* A report whose figures are not yet real says so ABOVE its own table,
         not in a footnote under it. CAHPS is the case: the survey feed is
         still being configured, and the numbers below are a preview of the
         layout. Anything that could be read out in a meeting and be wrong has
         to carry its warning where the reading starts. */
      const pending = el('repPending');
      if (pending) {
        pending.hidden = !report.pending;
        if (report.pending) pending.textContent = report.pending;
      }

      /* The range in words is for the printout alone — see .rep__print-head.
         "(to date)" is the part worth keeping: a month report read on the
         12th covers eleven days of clinic, and paper has nothing else to say
         so.

         A SNAPSHOT NAMES ITS DAY HERE, and only here. It used to say so on
         screen too, in a line beside the period picker, and that line was on
         for two of the twelve reports and off for the other ten — a control
         row that changed shape as you moved down the rail, for a caveat the
         reader could not act on. On paper it earns its place: a printout has
         no picker to look at, and "End of year AR, 1–31 Dec" would otherwise
         suggest a month of debt added together rather than a balance read on
         one day. */
      const span = `${shortDay(data.from)} — ${shortDay(data.to)}`;
      const asOf = isSnapshot(report) && data.latest ? `As of ${shortDay(data.latest)}` : null;
      const rangeText =
        asOf ?? (!data.empty && data.end > data.to ? `${span} (to date)` : span);

      /* WHAT IT WAS RUN WITH, ON THE PAPER. A printout has no header band to
         look at: the business it was run for and the fact that parameters
         were answered at all are invisible once the page leaves the tray, and
         a narrowed report read as the whole practice's is the one mistake
         this pack can actually cause. The parameters themselves are not
         listed — nine of them would be a paragraph above a table — but their
         presence is, which is what tells a reader to go and look. */
      const answered = filterEl?.count ?? 0;
      document.querySelector('[data-print-meta]').textContent = [
        report.title,
        state.business || null,
        rangeText,
        answered ? `${answered} parameter${answered === 1 ? '' : 's'} applied` : null,
        `Printed ${shortDay(Date.now())}`,
      ]
        .filter(Boolean)
        .join(' · ');

      paintStats(data);
      paintTable(data);
    }

    /*
     * Does this report name the day it was read, rather than the range?
     *
     * Recorded-once-a-week and read-as-of-a-date used to be the same test,
     * because the only weekly reports were balances: A/R aging and the
     * patient panel are both positions, and both are stated "as of" the
     * Friday they were taken.
     *
     * CAHPS broke that. The survey is fielded weekly and its figures are
     * flows — a fortnight of responses really is two weeks of responses added
     * together — so "As of 4 Sep" over a month's totals would have been the
     * page contradicting its own numbers. The cadence says how often a fact is
     * recorded; whether it is a balance is now said separately, and only the
     * reports that inherit the old assumption go on relying on it.
     */
    function isSnapshot(report) {
      return report.snapshot ?? report.cadence === 'weekly';
    }

    function paintStats(data) {
      el('repStats').innerHTML = data.report.stats
        .map((stat) => {
          let text = '—';
          if (!data.empty) {
            text =
              data.report.kind === 'detail'
                ? recordStat(stat, data.records).text
                : cell(
                    { ...stat, key: stat.key ?? metricKey(stat) },
                    stat.scope === 'ytd' ? data.ytd.grand : data.grand,
                    data.grand
                  ).text;
          }
          return `
            <div class="rep__stat">
              <p class="rep__stat-label">${stat.label}</p>
              <p class="rep__stat-value">${text}</p>
            </div>`;
        })
        .join('');
    }

    function metricKey(stat) {
      if (typeof stat.metric === 'string') return stat.metric;
      if (stat.rate) return stat.rate[0];
      if (stat.per) return stat.per[0];
      return stat.share ?? '';
    }

    function paintTable(data) {
      const { report } = data;
      const detail = report.kind === 'detail';

      /* A SECOND HEADER ROW, when the columns come in families. Eight money
         columns in a row give a reader no way to tell which four are the
         month and which four the year; the span above them says so once
         rather than every heading having to repeat it. */
      const groups = el('repGroups');
      /* The spans belong to the columns they were drawn over. A report
         regrouped, or one whose columns a parameter has put away, no longer
         has those columns in those places — so the second header row goes
         with them rather than spanning the wrong four. */
      const spanned = report.groups && data.columns.length === report.columns.length;
      groups.hidden = !spanned;
      groups.innerHTML = spanned
        ? report.groups
            .map(
              (group) =>
                `<th scope="colgroup" colspan="${group.span}" class="rep__group${
                  group.label ? '' : ' rep__group--blank'
                }">${group.label ?? ''}</th>`
            )
            .join('')
        : '';

      /* THE COLUMNS ARE THE RUN'S, NOT THE REPORT'S. A tick box may have
         revealed one or put one away, and a grouped detail report has a
         different set again — see visibleColumns() and detailGrouping(). The
         heading, the rows, the totals line and the export all read this same
         list, so none of the four can disagree about what is on the page. */
      const columns = data.columns;

      el('repHead').innerHTML = columns
        .map(
          (column, index) =>
            `<th scope="col"${cellClass(column, null, index)}>${headerLabel(column, data)}</th>`
        )
        .join('');

      /* The footer counts the thing on the page. "1–25 of 412 payments" on a
         detail report, "1–11 of 11 groups" once it has been grouped, and
         "1–6 of 6 rows" on a summary: the count is the one thing a footer
         exists to say, and it has to say it about the right thing as the
         reader moves down the rail. */
      const source = data.rows;
      pager.setNoun(detail ? (data.group ? 'groups' : report.noun ?? 'lines') : 'rows');
      const { start, end } = pager.render(source.length);

      /* Worked out once for the whole report, not once per page: a line's
         share of the charges is its share of every line's, and paging to the
         second page must not change what the first page said. */
      const sums = detail ? recordTotals(columns, source) : null;

      el('repRows').innerHTML = source
        .slice(start, end)
        .map((entry) => {
          const cells = columns
            .map((column, index) => {
              const out = detail
                ? fieldCell(column, entry, sums)
                : cell(column, scopeOf(column, entry, data), data.grand, entry.row);
              return `<td${cellClass(column, out, index)}>${out.text}</td>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');

      /* The totals line is the report's answer; the rows above it are the
         working. It stays put while the rows page, because a page of six rows
         out of twenty-four is not a total of anything.

         On a detail report only the columns that declare a total carry one:
         a column of MRNs has no sum, and a column of dates has no average. */
      el('repTotalsRow').innerHTML = data.empty
        ? ''
        : columns
            .map((column, index) => {
              if (index === 0) return `<th scope="row">Total</th>`;
              if (column.attr) return '<td></td>';
              if (detail) {
                if (column.total !== 'sum' && !column.share) return '<td></td>';
                const out = fieldCell(column, sums, sums);
                return `<td${cellClass(column, out, index)}>${out.text}</td>`;
              }
              const bucket = column.scope === 'ytd' ? data.ytd.grand : data.grand;
              const out = cell(column, bucket, data.grand, null);
              return `<td${cellClass(column, out, index)}>${out.text}</td>`;
            })
            .join('');

      el('repTotalsRow').hidden = data.empty;
      el('repEmpty').hidden = !data.empty;
      el('repTableWrap').hidden = data.empty;
    }

    /**
     * A column heading, and the two that carry a date.
     *
     * "A/R as of" is not a statement about anything until it says which day it
     * was read on, and the day is the period's own — so the heading is built
     * here rather than written into the catalogue, where it would go stale the
     * moment the reader changed the month.
     */
    function headerLabel(column, data) {
      if (!column.dateLabel) return column.label;
      return `${column.label} ${shortDay(column.dateLabel === 'from' ? data.from : data.to)}`;
    }

    /**
     * The classes one cell carries: how it is aligned, and what rank it holds.
     *
     * `out` is the drawn cell, and is absent for a header — a column heading
     * takes its column's rank and alignment but never the emphasis a value
     * gets, because "0" being quiet is a fact about that figure and not about
     * the column it sits in.
     */
    function cellClass(column, out, index) {
      const kind = columnKind(column, index);
      const classes = [`rep__cell--${kind}`];

      // Everything but the row's name and the reference it carries is a figure.
      if (kind === 'metric' || kind === 'derived') classes.push('ui-table__cell--numeric');

      /* A cell that is allowed more than one line. Every other cell in this
         product is one line tall on purpose — a wrapped cell breaks the row
         rhythm that makes a long list scannable — but a postal address is two
         lines in the world and printing it on one would be the table
         reformatting a fact to suit itself. */
      if (column.wrap) classes.push('rep__cell--stack');

      /* A NOTHING IS DRAWN AS A NOTHING. A column of counts with three zeros
         in it reads as four numbers unless the zeros step back, and on these
         reports the zeros are the majority: no ERCP on a Tuesday, no denials
         under "timely filing" all month. Quieting them is what lets the eye
         find the days something actually happened. */
      if (out && out.numeric && !out.value) classes.push('rep__cell--nil');

      return ` class="${classes.join(' ')}"`;
    }

    /* --- Export ---------------------------------------------------------------
       The same report, in the same order, with the same totals — but as
       numbers a spreadsheet can add up, so no currency symbols, no thousands
       separators and no "days" after the figure. */
    function exportCsv() {
      const data = view();
      const detail = data.report.kind === 'detail';
      /* WHAT WAS ON SCREEN, PARAMETERS AND ALL. The export is the report as it
         was run — the columns the sheet left showing, the rows it left, and
         the grouping it was read in — because a spreadsheet that quietly held
         more than the page it came from is one nobody can reconcile against
         the page it came from. */
      const columns = data.columns;
      const header = columns.map((column) => headerLabel(column, data));

      const cells = (out) => (out.numeric ? csvValue(out.value) : out.text);

      let rows;
      if (detail) {
        const sums = recordTotals(columns, data.rows);
        rows = data.rows.map((record) =>
          columns.map((column) => cells(fieldCell(column, record, sums)))
        );
        if (!data.empty) {
          rows.push(
            columns.map((column, index) =>
              index === 0
                ? 'Total'
                : column.total === 'sum' || column.share
                  ? cells(fieldCell(column, sums, sums))
                  : ''
            )
          );
        }
      } else {
        const line = (entry, bucketFor) =>
          columns.map((column) => cells(cell(column, bucketFor(column), data.grand, entry)));

        rows = data.rows.map((entry) => line(entry.row, (column) => scopeOf(column, entry, data)));
        if (!data.empty) {
          rows.push(
            line({ label: 'Total' }, (column) =>
              column.scope === 'ytd' ? data.ytd.grand : data.grand
            )
          );
        }
      }

      const csv = [header, ...rows]
        // Quote every field and double any inner quote: a payer with a comma
        // in its name would otherwise shift every column after it by one.
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${data.report.id}-${dayId(data.from)}-to-${dayId(data.to)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    test('export').addEventListener('ui-click', exportCsv);
    test('print').addEventListener('ui-click', () => window.print());

    /* The sheet of whichever report the address bar opened on, before the
       first paint: view() reads the answers off it, and a panel that has
       never been given its parameters has none to give back. */
    syncFilter(state.report);
    syncNavigators();
    paint();
  });
}
