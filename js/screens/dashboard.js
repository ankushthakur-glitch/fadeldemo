/**
 * DASHBOARD — the landing screen.
 *
 * Built from the 2026-08-04 design review with Dr. Nemore (MediNova ASC) and
 * reworked on 2026-08-19 against the three-column reference. The three things
 * that came out of the original call are unchanged requirements:
 *
 *   1. The clinic and the ASC are shown as two different dashboards, reached
 *      by switching a location control rather than by two separate screens
 *      ("when I click on the ASC I will get this dashboard" / "you can
 *      filter based on the location as well").
 *   2. The time clock has to stay one of the first things a staff member
 *      sees. It already lives in the header on every screen — see
 *      components/ui-time-clock.js, which is deliberately the ONLY place it
 *      lives — so this screen surfaces a read-only "hours today" summary
 *      rather than a second interactive clock competing with that one.
 *   3. The schedule is where the day actually happens ("if you go under
 *      schedule that's where everything is going to happen"), so it leads.
 *
 * WHOSE DASHBOARD THIS IS
 * Mine. Every panel is scoped to the signed-in provider rather than to the
 * practice: my appointments, my patients, my open tasks, my inbox. A landing
 * screen showing all six diaries and everybody's worklists is the Scheduler
 * and Task Management screens with the filters off — those screens exist, they
 * are better at it, and the nav bar is two clicks away.
 *
 * "Mine" needs a join that did not exist. data/schedule.js keeps its own
 * PROVIDERS list because a calendar column is a bookable diary, not a user
 * account, so no booking belonged to the person signed in. PROVIDER.scheduleId
 * in data/provider-settings.js is that join, and the reasoning for which diary
 * is on the field.
 *
 * WHAT THE REWORK CHANGED
 * Today's Schedule was a list of rows sorted by time. A list answers "who is
 * next"; it cannot answer "what does the day look like" — where the gaps are,
 * which hour is double-booked, how long until the next patient. It is now the
 * same data on a TIME AXIS: an hour gutter, blocks positioned and sized by
 * their real start and duration, lanes for overlaps, and a live now-line. The
 * arrows in its sub-bar walk the same appointment store the scheduler writes
 * to, so the card is a one-day window onto the real calendar rather than a
 * frozen "today".
 *
 * THE DAY IS MORE THAN ITS BOOKINGS
 * An empty stretch of grid is ambiguous — free, or not working? — and the
 * first draft of this card could not tell you which, so a Tuesday afternoon I
 * do not work looked identical to a Tuesday afternoon nobody had booked. The
 * grid now draws the day underneath the appointments as well:
 *
 *   BOOKABLE       the hours I work at this site, from PROVIDER_SCHEDULES —
 *                  plain surface, the part of the column that is mine to fill
 *   UNAVAILABLE    everything else inside the drawn window, hatched. The
 *                  complement is computed rather than stored, so a lunch gap
 *                  between two day slots hatches itself
 *   BLOCKED        annual leave, CME, a departmental audit — a named band
 *                  over the top, because "why" is the whole content of it
 *
 * All three come from availabilityOn() in data/schedule.js, which is what
 * Settings ▸ Provider ▸ Availability edits and what the scheduler books
 * against. Nothing here is a second copy of the working week.
 *
 * The windows carry a location, so they are filtered by the clinic/ASC scope
 * exactly as the bookings are. A Tuesday in the ASC scope is a fully hatched
 * day, which is the true answer: I am at the Fargo clinic on Tuesdays.
 *
 * The Needs Attention rail and the Pending Items column that briefly replaced
 * it are both gone. Neither was mine: they listed the practice's refills,
 * recalls and lab orders, which is Task Management's screen. What survives of
 * them is the one number that IS mine — the tasks assigned to me — as a stat
 * tile, and as one of the five destinations in Quick Actions.
 *
 * QUICK ACTIONS came back on 2026-08-20, under the inbox in the rail. It had
 * been cut because a whole column for five links the top bar already carries
 * was the wrong trade on the screen with the least width to spare — but the
 * rail is not a column of its own any more, it is the bottom two fifths of the
 * one Messages was already given, so the objection is paid off and staff keep
 * the two things they actually start from here: a registration and their
 * worklist. It is static markup in the page — five hrefs, nothing to derive,
 * which is why no function below paints it.
 *
 * MESSAGES is the chat inbox from data/communications.js. It needs no filter:
 * every thread in that file has me on one side of it, because groups list
 * their OTHER members and a one-to-one thread is with me by construction.
 *
 * Everything on this screen is still DERIVED from data other screens already
 * own (the appointment store, the task worklists, the chat threads) rather
 * than invented for this screen. Where the reference showed something this
 * prototype has no model for yet (fax counts, claim receipts, unsigned
 * encounters), it is left off rather than shown as a made-up number — the same
 * "not in this prototype yet" rule the Settings and Reports hubs follow.
 */
import { loadAppointments } from '../../data/appointment-store.js';
import {
  TODAY,
  durationOf,
  toMinutes,
  availabilityOn,
} from '../../data/schedule.js';
import { DIRECTORY } from '../../data/directory.js';
import { TASKS, CURRENT_USER } from '../../data/tasks.js';
import { THREADS } from '../../data/communications.js';
import { PROVIDER } from '../../data/provider-settings.js';
import * as clock from '../lib/time-clock-store.js';

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const icon = (name) => `<svg class="ui-icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const PATIENTS_BY_MRN = new Map(DIRECTORY.map((p) => [p.mrn, p]));

/* The diary this account books into. See PROVIDER.scheduleId in
   data/provider-settings.js for why it is a stored join rather than a name
   match — the two lists of people in this prototype were written by different
   parts of it and agree on nobody. */
const MY_DIARY = PROVIDER.scheduleId;

/* --- Location scope -----------------------------------------------------------
   Appointments carry a free-text location string from data/appointments.js
   (e.g. "Red River ASC", "MediNova Gastroenterology — Fargo"). The design
   review's clinic/ASC split is reconstructed from that string rather than
   from data/practice.js's Locations records, because that is what booked
   appointments actually key on. */
const isAsc = (location) => /ASC/i.test(location || '');

const LOCATION_LABEL = {
  clinic: 'Outpatient Clinic',
  asc: 'ASC',
};

/* Two scopes, not three. A combined "All Locations" day is not a day anybody
   works — the two sites have separate staff, rooms and lists — so the merged
   count was a number nobody could act on. The clinic opens by default because
   it is the busier list. */
let currentLoc = 'clinic';

/* Whether the next paint should move the scroll to the interesting part of the
   day. True when the day or the site changes; false on the once-a-minute
   now-line repaint, which must leave the reader where they were — a column
   that jumps back to the clinic every sixty seconds cannot be read. */
let recentre = true;

/* Which day the schedule card is showing. Starts on TODAY and moves with the
   arrows; the stat tiles deliberately do NOT follow it — a tile labelled
   "Today's Appointments" that changes when you look at Thursday is a lie. */
let currentDay = TODAY;

/* --- Status → badge tone -------------------------------------------------------
   Local to this screen: the scheduler draws status as a coloured swatch from
   the admin-configured palette (Settings → Appointment → Colour
   Configuration), which is the right call for a calendar you work in all day.
   A dashboard card needs the smaller semantic vocabulary the status tokens
   already speak instead — six tones the whole product shares, not fourteen
   customer-chosen hues. */
const STATUS_TONE = {
  Confirmed: 'success',
  'Check Out': 'success',
  'Checked In': 'brand',
  Scheduled: 'info',
  Triage: 'info',
  'Pending Confirmation': 'warning',
  Rescheduled: 'warning',
  Cancelled: 'critical',
  'No Show': 'critical',
  Declined: 'neutral',
};

/* A slot that is not work you will do. Drawn so the hour does not look free,
   struck through so it is never mistaken for a patient who is coming. */
const VOID_STATUSES = new Set(['Cancelled', 'No Show', 'Declined']);

/* What a status is called INSIDE A BLOCK, where three overlapping bookings
   leave about a dozen characters. "Pending Confirmation" is twenty of them: it
   was taking the whole lane and pushing the patient's name out of its own
   block, which inverts what the block is for. Only the one status needs
   shortening; the full wording stays on the block's title and everywhere else
   in the product. */
const SHORT_STATUS = { 'Pending Confirmation': 'Pending' };

/* ============================================================================
   GENERATED STYLESHEET

   Block geometry is per-appointment arithmetic: it cannot be a token, and the
   house rule forbids style attributes. So it goes into one <style> element
   rewritten on every paint, exactly as the scheduler does it (see
   writeGeometry in js/screens/scheduler.js).

     --dsh-top     minutes from the top of the grid
     --dsh-len     length in minutes
     --dsh-lane    which lane of a set of overlapping blocks this one takes
     --dsh-lanes   how many lanes that set needs
   ========================================================================= */

function writeGeometry(rules) {
  let el = document.getElementById('dashGeometry');
  if (!el) {
    el = document.createElement('style');
    el.id = 'dashGeometry';
    document.head.appendChild(el);
  }
  el.textContent = rules.join('\n');
}

/* ============================================================================
   TIME AND DATE HELPERS
   ========================================================================= */

/** "2026-08-04" → a Date at local midnight, never one day out from UTC. */
const dateOf = (iso) => new Date(`${iso}T00:00:00`);

/** "2026-08-04" + 1 → "2026-08-05". */
function shiftDay(iso, days) {
  const d = dateOf(iso);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 570 → "9:30 AM". The gutter and the blocks both read in the clinic's own
    12-hour idiom rather than the 24-hour strings the data stores. */
function clockLabel(minutes) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/* ============================================================================
   THE DAY'S APPOINTMENTS
   ========================================================================= */

/**
 * My bookings on one day at one site.
 *
 * The provider filter comes FIRST and is not optional — there is no "everyone"
 * setting on this screen. Six diaries interleaved on one axis is the
 * scheduler's job and it has the width for it; here it would be six columns of
 * slivers, five of them somebody else's problem.
 */
function appointmentsForDay(iso, loc) {
  const day = loadAppointments().filter((a) => a.date === iso && a.providerId === MY_DIARY);
  // Every booking is one or the other, so this is a partition rather than a
  // filter with a fallthrough — there is no third list to fall back to.
  return loc === 'asc' ? day.filter((a) => isAsc(a.location)) : day.filter((a) => !isAsc(a.location));
}

/** The minute an appointment starts and the minute it ends. */
function span(appt) {
  const start = toMinutes(appt.start);
  return { start, end: start + durationOf(appt.typeId) };
}

/**
 * The hours I work on this day AT THIS SITE, merged.
 *
 * Merged because a provider can hold several day slots covering one date, and
 * two windows that touch are one window — left unmerged they draw as two bands
 * with a seam down the middle at the join, and the "gap" between 12:00 and
 * 12:00 becomes a hairline of hatching.
 *
 * Filtered by scope for the same reason the bookings are: a window carries the
 * location it is worked at, and my Friday ASC list is not an answer to "what
 * does my Tuesday clinic look like".
 */
function workingWindows(iso, loc) {
  const wanted = loc === 'asc';
  const spans = availabilityOn(MY_DIARY, iso)
    .blocks.filter((b) => isAsc(b.location) === wanted)
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * The gaps between the working windows, inside the drawn day.
 *
 * Computed rather than stored, which is the only way it stays true: the
 * unavailable part of a day is whatever the availability editor did NOT say,
 * and every lunch break, half-day and non-working afternoon in the product is
 * a gap someone left rather than a record they created.
 */
function unavailableSpans(windows, dayStart, dayEnd) {
  const gaps = [];
  let cursor = dayStart;
  for (const span of windows) {
    if (span.start > cursor) gaps.push({ start: cursor, end: Math.min(span.start, dayEnd) });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps.filter((gap) => gap.end > gap.start);
}

/**
 * Leave, CME, an audit — the named reasons a day is not available.
 *
 * Clamped to the drawn window, which now only ever bites on a record running
 * past midnight — the grid covers the whole day, so a whole-day block finally
 * has somewhere to be drawn in full.
 */
function blockedSpans(iso, dayStart, dayEnd) {
  return availabilityOn(MY_DIARY, iso)
    .blocked.map((b) => ({
      title: b.title,
      start: Math.max(toMinutes(b.start), dayStart),
      end: Math.min(toMinutes(b.end), dayEnd),
    }))
    .filter((span) => span.end > span.start);
}

/**
 * Lanes for overlapping blocks.
 *
 * Two passes, and the second is the one that matters. A single greedy pass
 * over the whole day gives every block a lane, but nothing to divide the width
 * by: using the day's lane count would make every block one sixth wide because
 * one hour somewhere was six deep. So the day is first cut into CLUSTERS —
 * runs of appointments that touch, directly or through a chain — and the lane
 * count is taken per cluster. A quiet afternoon then draws full width even
 * though the morning was stacked four high.
 */
function laneLayout(appointments) {
  const sorted = appointments
    .map((appt) => ({ appt, ...span(appt) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    // Greedy: the first lane whose last block has already finished.
    const laneEnds = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.end;
      item.lane = lane;
    }
    for (const item of cluster) item.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return out;
}

/* ============================================================================
   THE DRAWN WINDOW — the whole day, every day.

   The grid used to size itself to whatever was on it, floored to the hour, with
   a clinic day as the floor. That was tidy and it was wrong twice over: a
   booking at 07:15 or a late list quietly changed the scale, so the same hour
   sat at a different height from one day to the next and the eye had to re-learn
   the column each time; and an early-morning or out-of-hours slot could only be
   shown by redrawing the whole day around it.

   Midnight to midnight, always. The hour is a fixed height on every day and at
   every location, the card scrolls to the part of the day that matters, and
   there is nowhere a booking can be made that the grid cannot draw. Twenty-four
   hours of hatching either side of a clinic is not clutter — it is the reason
   the four hours in the middle read as short.
   ========================================================================= */

const DAY_START = 0;
const DAY_END = 24 * 60;

/* NO GLYPH ON A BLOCK.
   A block used to open with a pin, or a chat bubble where the visit was
   virtual. It was the wrong thing to spend the first characters of the line
   on: every booking on this grid is at the site the sub-bar already names, so
   the pin repeated a fact the card states once, and it did it in the column
   where the eye lands first. With a full clinic on the grid a twenty-minute
   sliver has room for the time, the patient and the reason and nothing else —
   so the glyph goes and the reason gets its width back. Where the visit is
   virtual, the appointment TYPE says so, and the type is on the block's
   title. */

function apptBlock({ appt, start, end }) {
  const patient = PATIENTS_BY_MRN.get(appt.mrn);
  const tone = STATUS_TONE[appt.status] ?? 'neutral';
  const length = end - start;

  const name = patient?.name ?? `MRN ${appt.mrn}`;
  /* No provider name on the block. Every booking on this grid is mine, so it
     would be the same name on every row of my own diary — and the reason for
     the visit, which is the thing worth reading, is what gets the space it
     was taking. */
  const why = appt.reason;

  /* No per-appointment deep link exists — the scheduler opens on a day, not on
     a booking, and the patient chart only carries records for four MRNs. So a
     block goes where the appointment is actually worked, and the full detail
     that does not fit in a 20-minute block lives on the title. */
  /* ONE line, whatever the block's height.
     Two lines was the earlier shape and it fought the grid at both ends: a
     30-minute block is 30 pixels tall and could not hold them, while a wide
     single-lane block with two lines left the first one reading "8:30 AM
     Elena Petrova" against six hundred pixels of nothing. One line takes the
     width it is given — the reason for the visit is the part that grows and
     the part that truncates — and it renders the same in a 20-minute sliver as
     in an hour-long block, which is what a row of a schedule should do. */
  return `
    <a class="dash__appt dash__appt--${tone}${
      VOID_STATUSES.has(appt.status) ? ' dash__appt--void' : ''
    }" href="scheduler.html" data-appt="${esc(appt.id)}"
      data-testid="dash--sched-row"
      title="${esc(`${clockLabel(start)}–${clockLabel(end)} (${length} min) · ${name} · ${appt.status}${why ? ` · ${why}` : ''} · ${appt.location}`)}">
      <span class="dash__appt-time">${esc(clockLabel(start))} · ${length}m</span>
      <span class="dash__appt-name">${esc(name)}</span>
      <span class="dash__appt-why">${esc(why)}</span>
      <span class="dash__appt-status">${esc(SHORT_STATUS[appt.status] ?? appt.status)}</span>
    </a>`;
}

/** "MediNova Gastroenterology — Fargo" → "Fargo". */
function siteName(location) {
  const parts = String(location || '').split('—');
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
}

/**
 * One band. Only a block day carries a label: the hatching means "unavailable,
 * no reason given" everywhere in this product, so writing the word across it
 * is captioning a mark that already says it — the scheduler hatches a closed
 * column and says nothing over it either. The label a block day DOES carry is
 * dropped under three quarters of an hour: a 20-minute band is 20 pixels tall
 * and a word in it collides with the edge of the next thing down.
 */
function bandMarkup(id, kind, span, label) {
  const slim = span.end - span.start < 45;
  return `<span class="dash__band dash__band--${kind}${slim ? ' dash__band--slim' : ''}"
    data-band="${esc(id)}" data-testid="dash--band-${kind}"
    aria-hidden="true">${label ? `<span class="dash__band-label">${esc(label)}</span>` : ''}</span>`;
}

/**
 * Put the scroll where the day happens.
 *
 * A twenty-four hour column opens on midnight, which is nobody's morning. The
 * target is the first thing that matters — the current hour on today, the
 * start of the clinic otherwise, the first booking on a day with no windows —
 * set back an hour so it has some grid above it rather than sitting flush
 * against the top edge.
 *
 * Measured off a rendered hour row rather than computed from the token,
 * because --dash-hour is a rem value and the reader may have changed the root
 * font size; the row knows how tall it actually came out.
 */
function centreOn(minute) {
  const scroller = $('#schedScroll');
  const hourHeight = $('#dayHours .dash__hour')?.offsetHeight;
  if (!hourHeight) return;
  scroller.scrollTop = Math.max(0, ((minute - 60) * hourHeight) / 60);
}

function paintDay() {
  const items = laneLayout(appointmentsForDay(currentDay, currentLoc));
  const windows = workingWindows(currentDay, currentLoc);
  const held = $('#schedScroll').scrollTop;


  $('#schedCount').textContent = `${items.length} booked`;
  $('#dayLabel').textContent = dateOf(currentDay).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  $('#dayToday').hidden = currentDay === TODAY;

  /* The now-line reads the wall clock, not the demo data, and is drawn only
     when the day on screen is the demo's "today" — a red line across next
     Tuesday would be pointing at nothing. */
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const isToday = currentDay === TODAY;

  const blocked = blockedSpans(currentDay, DAY_START, DAY_END);

  /* What the day IS, in the sub-bar. A named block day outranks the hours,
     because "Annual leave" is the answer to every question the hours would
     have answered. */
  const site = availabilityOn(MY_DIARY, currentDay).blocks.find(
    (b) => isAsc(b.location) === (currentLoc === 'asc')
  )?.location;
  const summary = blocked.length
    ? blocked.map((b) => b.title).join(' · ')
    : windows.length
      ? `${clockLabel(windows[0].start)} – ${clockLabel(windows[windows.length - 1].end)}${
          site ? ` · ${siteName(site)}` : ''
        }`
      : `Not working at the ${LOCATION_LABEL[currentLoc]}`;
  $('#daySummary').textContent = summary;

  const hours = [];
  for (let minute = DAY_START; minute < DAY_END; minute += 60) {
    hours.push(
      `<div class="dash__hour"><span class="dash__hour-label">${esc(clockLabel(minute))}</span></div>`
    );
  }
  $('#dayHours').innerHTML = hours.join('');
  $('#dayBlocks').innerHTML = items.map(apptBlock).join('');

  /* Bands first, bookings second — the stylesheet is one list, but the order
     the geometry is written in does not matter and the order the markup is
     written in does. See the layer note in the markup. */
  const offSpans = unavailableSpans(windows, DAY_START, DAY_END);
  $('#dayBands').innerHTML = [
    ...offSpans.map((span, index) => bandMarkup(`off${index}`, 'off', span)),
    ...blocked.map((span, index) => bandMarkup(`bd${index}`, 'blocked', span, span.title)),
  ].join('');

  const rules = [
    ...offSpans.map(
      (span, index) =>
        `[data-band="off${index}"]{--dsh-top:${span.start - DAY_START};` +
        `--dsh-len:${span.end - span.start};}`
    ),
    ...blocked.map(
      (span, index) =>
        `[data-band="bd${index}"]{--dsh-top:${span.start - DAY_START};` +
        `--dsh-len:${span.end - span.start};}`
    ),
    ...items.map(
      (item) =>
        `[data-appt="${item.appt.id}"]{--dsh-top:${item.start - DAY_START};` +
        `--dsh-len:${item.end - item.start};--dsh-lane:${item.lane};--dsh-lanes:${item.lanes};}`
    ),
  ];

  const nowLine = $('#dayNow');
  const showNow = isToday && nowMinute >= DAY_START && nowMinute <= DAY_END;
  nowLine.hidden = !showNow;
  if (showNow) {
    $('#dayNowTime').textContent = clockLabel(nowMinute);
    rules.push(`[data-now]{--dsh-top:${nowMinute - DAY_START};}`);
  }

  writeGeometry(rules);

  /* Where the column opens. A new day gets the hour that matters; a repaint of
     the day already on screen — the minute tick — gets exactly where the
     reader left it. */
  if (recentre) {
    /* Where the column opens: the start of the day, every time.

       This followed the wall clock first, and the clock walked off with the
       day. Read at 11 in the morning it opened on 10:00 and both of the
       morning's appointments were above the viewport — the card had scrolled
       past the very thing it exists to show, and looked empty. Read at
       midnight it opened on midnight, eight screens above the clinic. Clamping
       the clock so it could only ever scroll UP fixed the first case and left
       the second.

       So the clock does not get a vote. The column opens where the day's
       content starts — the working window, or a block day, or the first
       booking on a day with neither — and what falls off the bottom of a long
       list is the end of it, which is the half a scroll is for. The now-line
       is drawn wherever it truly is; finding it is a gesture, and losing the
       morning was not worth saving that gesture.
     */
    const content = windows[0]?.start ?? blocked[0]?.start ?? items[0]?.start ?? 8 * 60;
    centreOn(content);
    recentre = false;
  } else {
    $('#schedScroll').scrollTop = held;
  }
}

/* ============================================================================
   STAT TILES
   ========================================================================= */

function paintStats() {
  const today = appointmentsForDay(TODAY, currentLoc);
  const uniquePatients = new Set(today.map((a) => a.mrn)).size;

  /* Assigned to me, not open across the practice. The practice-wide number
     belongs on the screen that can work it down; here it would be a figure I
     am not responsible for sitting on a screen that says it is mine. */
  const myTasks = TASKS.filter(
    (t) => t.assignedTo === CURRENT_USER && ['open', 'in-progress', 'overdue'].includes(t.status)
  ).length;

  const hoursToday = clock.formatDuration(clock.totalWorkedMs(clock.dayKey()));

  /*
   * TWO LINES, AND THEY ARE NOT THE SAME SIZE.
   *
   * Each tile is a label and a figure, drawn the way the Complications screen
   * draws its three: the words name the measurement in caption grey, the
   * number answers it twice that size, and the mark sits out on the right
   * where it tells the four cards apart once they are known rather than
   * competing with the figure for the first look.
   *
   * The third line each of these used to carry has gone. "Outpatient Clinic"
   * repeated the site switch two rows above it, "Assigned to me" repeated the
   * label directly over it, and the shift state repeated the clock in the
   * header — three lines of small grey type saying what the screen already
   * said, and between the figure and them the eye had no idea which of the
   * three sizes to read first.
   */
  const tiles = [
    {
      icon: 'calendar',
      label: "Today's Appointments",
      value: today.length,
    },
    {
      icon: 'users',
      label: "Today's Patients",
      value: uniquePatients,
      tone: 'info',
    },
    {
      icon: 'clipboard',
      label: 'My Open Tasks',
      value: myTasks,
      tone: 'warning',
      /* The only tile that goes anywhere, because it is the only one that is a
         queue rather than a measurement. Today's appointments are already the
         card below; hours worked are a fact, not a worklist. */
      href: 'tasks.html?tab=mine',
    },
    {
      icon: 'clock',
      label: 'Hours Today',
      value: hoursToday,
      tone: 'neutral',
    },
  ];

  $('#statTiles').innerHTML = tiles
    .map(
      (tile) => `
      <${tile.href ? 'a' : 'div'} class="dash__stat${tile.href ? ' dash__stat--link' : ''}"${
        tile.href ? ` href="${tile.href}"` : ''
      } data-testid="dash--stat-${tile.label.toLowerCase().replace(/[^a-z]+/g, '-')}">
        <span class="dash__stat-body">
          <span class="dash__stat-label">${esc(tile.label)}</span>
          <span class="dash__stat-figure">
            <span class="dash__stat-value">${esc(tile.value)}</span>
            ${
              /* The caret rides with the number rather than at the far edge of
                 the card: "4, and here is the way to them" is one thought, and
                 an arrow parked in the corner reads as a second one. */
              tile.href
                ? '<svg class="ui-icon dash__stat-go" aria-hidden="true"><use href="#i-caret-right"></use></svg>'
                : ''
            }
          </span>
        </span>
        <span class="dash__stat-icon${tile.tone ? ` dash__stat-icon--${tile.tone}` : ''}" aria-hidden="true">
          ${icon(tile.icon)}
        </span>
      </${tile.href ? 'a' : 'div'}>`
    )
    .join('');
}

/* ============================================================================
   MESSAGES

   The chat inbox, read-only. Unread threads first and everything else in the
   order data/communications.js declares — that file's order is the inbox's
   order on the Communications screen, and a dashboard that sorted differently
   would show a different "top of the inbox" from the screen it links to.
   ========================================================================= */

function messageRow(thread) {
  const last = thread.messages[thread.messages.length - 1];
  const name = thread.name ?? thread.party?.name ?? 'Conversation';
  const preview = last?.lines?.[0] ?? '';

  return `
    <a class="dash__msg" href="communications.html" data-testid="dash--msg-row">
      <span class="dash__msg-dot"${thread.unread ? '' : ' data-read="true"'} aria-hidden="true"></span>
      <span class="dash__msg-who">
        <span class="dash__msg-name">${esc(name)}</span>
        ${thread.urgent ? '<ui-badge status="critical" size="sm">Urgent</ui-badge>' : ''}
      </span>
      <span class="dash__msg-when">${esc(last?.at ?? thread.when)}</span>
      <span class="dash__msg-text">${esc(preview)}</span>
      ${
        thread.unread
          ? `<span class="dash__msg-count" title="${thread.unread} unread">${thread.unread}</span>`
          : ''
      }
    </a>`;
}

function paintMessages() {
  const threads = THREADS.slice().sort((a, b) => Number(!!b.unread) - Number(!!a.unread));
  const unread = threads.reduce((total, thread) => total + (thread.unread || 0), 0);

  $('#msgCount').textContent = unread ? `${unread} unread` : 'All read';
  $('#msgList').innerHTML = threads.map(messageRow).join('');
  $('#msgEmpty').hidden = threads.length > 0;
}

/* ============================================================================
   HEAD
   ========================================================================= */

function paintLede() {
  const date = dateOf(TODAY).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  $('[data-testid="dash--lede"]').textContent = `Welcome back, Amara Mensah · ${date}`;
}

/* ============================================================================
   LOCATION SWITCH
   ========================================================================= */

function setLocation(loc) {
  currentLoc = loc;
  /* The strip is the shared primary one (components/overlay.css), so it says
     which site is showing the way every other tab strip in the EHR does: the
     selected class and aria-selected, not a pressed toggle. The roving
     tabindex goes with it — Tab enters the strip once, and the arrows move
     inside it. */
  for (const tab of document.querySelectorAll('#locTabs [role="tab"]')) {
    const isOn = tab.dataset.loc === loc;
    tab.classList.toggle('ui-tabs__tab--selected', isOn);
    tab.setAttribute('aria-selected', String(isOn));
    tab.tabIndex = isOn ? 0 : -1;
  }
  paintStats();
  recentre = true;
  paintDay();
}

$('#locTabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[role="tab"]');
  if (!tab) return;
  setLocation(tab.dataset.loc);
});

/* Left/Right move between the two sites, Home/End jump to the ends — the ARIA
   tabs pattern <ui-tabs> follows, matched here because this strip is built by
   hand rather than by the component. */
$('#locTabs').addEventListener('keydown', (event) => {
  const tabs = [...document.querySelectorAll('#locTabs [role="tab"]')];
  const index = tabs.indexOf(event.target.closest('[role="tab"]'));
  if (index < 0) return;

  const next = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    Home: 0,
    End: tabs.length - 1,
  }[event.key];
  if (next === undefined) return;

  event.preventDefault();
  const target = tabs[(next + tabs.length) % tabs.length];
  setLocation(target.dataset.loc);
  target.focus();
});

/* ============================================================================
   DAY NAVIGATION
   ========================================================================= */

function goToDay(iso) {
  currentDay = iso;
  recentre = true;
  paintDay();
}

$('#dayPrev').addEventListener('click', () => goToDay(shiftDay(currentDay, -1)));
$('#dayNext').addEventListener('click', () => goToDay(shiftDay(currentDay, 1)));
$('#dayToday').addEventListener('click', () => goToDay(TODAY));

/* ============================================================================
   BOOT
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  paintLede();
  paintStats();
  paintDay();
  paintMessages();

  // The header clock is shared across every screen (see ui-time-clock.js);
  // this screen only reads from the same store, so a shift clocked in from
  // Settings or the Scheduler is reflected here without any wiring.
  clock.subscribe(() => paintStats());

  /* The now-line has to move, or it is a decoration that lies within the
     hour. Once a minute is as often as a line whose smallest unit is a minute
     can usefully be redrawn, and repainting the day is cheap — it is at most
     a few dozen blocks and one stylesheet. */
  setInterval(() => {
    if (currentDay === TODAY) paintDay();
  }, 60_000);
});
