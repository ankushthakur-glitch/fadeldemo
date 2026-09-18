/**
 * Communications — one inbox for every conversation.
 *
 * Two panels: the conversations on the left, the open one on the right. The
 * left panel never moves, because you work down it the same way the referral
 * desk works down its queue.
 *
 * THE RULES THIS SCREEN IS BUILT AROUND
 *
 * 1. A CHAT IS WITH SOMEBODY WHO ALREADY EXISTS. The New Chat panel searches
 *    the patient directory and the practice's user list (data/communications.js
 *    resolves both). There is no free-text recipient, because a message sent to
 *    a name nobody recognises cannot be filed to a chart.
 *
 * 2. ONE-TO-ONE MEANS ONE. Choosing Patient or Clinician takes exactly one
 *    person, and starting a chat with somebody you already have a thread with
 *    OPENS that thread instead of making a second one. Two threads with the
 *    same nurse is how half a conversation gets lost.
 *
 * 3. OPENING A THREAD READS IT. The unread count clears on open and the tab
 *    counts follow, so the strip above can never claim unread mail that is
 *    sitting open on screen.
 *
 * 4. THE CLOCK IS FIXED. Sent messages are stamped from a counter that starts
 *    at a literal time, not from Date.now(), so the screen screenshots the same
 *    way every run — the same rule the demo data follows.
 */
import {
  ME,
  KINDS,
  THREADS,
  ROSTER,
  PEOPLE,
  PARTY_TONES,
  QUICK_FILTERS,
  CHAT_TYPES,
} from '../../data/communications.js';
import { notify } from '../lib/toast.js';

/* ===================== Helpers ===================== */

const el = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * `*asterisks*` become bold.
 *
 * Applied AFTER escaping, never before: the text is inert HTML by the time
 * this runs, so the only tags that can reach the DOM are the two this function
 * writes itself.
 */
const boldify = (text) => esc(text).replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

/** Write a value into a field component, attribute and live control both. */
function setValue(node, value) {
  if (!node) return;
  const next = value ?? '';
  node.setAttribute('value', next);
  const control = node.querySelector('input, select, textarea');
  if (control) control.value = next;
}

/**
 * Read what is IN a field right now.
 *
 * Not node.value: that reflects the attribute, and a ui-input only writes its
 * attribute back on `change`. A group name typed and then submitted with the
 * keyboard has not fired one yet, so the attribute would still be empty and
 * the group would silently take its fallback name.
 */
const fieldValue = (node) =>
  node?.querySelector('input, select, textarea')?.value ?? node?.value ?? '';

/** An icon plus the words a screen reader needs for it. */
const marker = (icon, label, className = '') =>
  `<svg class="ui-icon ${className}" aria-hidden="true"><use href="#i-${icon}"></use></svg>
   <span class="u-sr-only">${esc(label)}</span>`;

/* ===================== State ===================== */

/*
 * The threads are copied because this screen mutates them — messages are sent,
 * unread counts clear, new conversations are created. The imported array stays
 * as the seed. `messages` is copied too: pushing onto the imported array would
 * outlive a reload in a bundler that caches modules.
 */
const threads = THREADS.map((entry) => ({ ...entry, messages: [...entry.messages] }));

let nextId = 100;

const state = {
  kind: 'all',
  selected: '',
  query: '',
  quick: { urgent: false, unread: false },

  /* New Chat panel */
  newType: 'patient',
  picked: [],
  pickQuery: '',
};

const thread = (id) => threads.find((entry) => entry.id === id);
const selected = () => thread(state.selected) ?? null;

/** A thread's own name: a group has one, a one-to-one is named by the person. */
const threadName = (entry) => entry.name ?? entry.party.name;

/** The last message, which is what the list row previews. */
const lastMessage = (entry) => entry.messages[entry.messages.length - 1];

/**
 * Fixed clock.
 *
 * Sending advances it by three minutes so a run of replies reads as a
 * conversation rather than as five messages sent in the same instant.
 */
let clock = 14 * 60 + 22; // 02:22 PM

function stamp() {
  const hours = Math.floor(clock / 60) % 24;
  const minutes = clock % 60;
  clock += 3;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/* ===================== The type strip ===================== */

const kindOf = (entry) => KINDS.find((kind) => kind.match === entry.kind);

/**
 * The strip names four kinds of conversation and counts none of them.
 *
 * It used to carry the number of threads with unread mail on each tab. The
 * unread rows in the list say the same thing, one row at a time and with the
 * name of the person waiting attached — which is the version you can act on.
 * A tab is a place; the list under it is the tally.
 */
function paintKinds() {
  el('kindTabs').innerHTML = KINDS.map((kind) => {
    const isOn = kind.id === state.kind;
    return `<button type="button" role="tab" id="kind-${kind.id}"
      class="ui-tabs__tab${isOn ? ' ui-tabs__tab--selected' : ''}"
      aria-selected="${isOn}" aria-controls="threadList" tabindex="${isOn ? '0' : '-1'}"
      data-kind="${kind.id}" data-testid="comm--kind-${kind.id}">
      ${esc(kind.label)}
    </button>`;
  }).join('');

  el('threadList').setAttribute('aria-labelledby', `kind-${state.kind}`);

  const tabs = [...el('kindTabs').querySelectorAll('[data-kind]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectKind(tab.dataset.kind));

    tab.addEventListener('keydown', (event) => {
      const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
      const next = moves[event.key];
      if (next === undefined) return;
      event.preventDefault();
      selectKind(tabs[(next + tabs.length) % tabs.length].dataset.kind);
    });
  });
}

function selectKind(id) {
  state.kind = id;

  /*
   * CHANGING TAB CLOSES THE CONVERSATION.
   *
   * The pane used to keep whatever was open. Press Groups while reading a
   * patient's messages and the list underneath became eight group chats while
   * the right-hand side still showed the patient — a screen making two claims
   * about where you are, with the loud half wrong. Worse, the thread it was
   * showing was usually no longer in the list beside it, so nothing on screen
   * was lit to say where the words on the right had come from.
   *
   * So a tab lands you at the top of a section rather than half in the last
   * one: the list is the four kinds' answer, and the reading pane waits to be
   * asked. What was open is not lost — it is one row away, in whichever tab it
   * belongs to.
   */
  state.selected = '';

  /*
   * The strip repaints itself, not only the list below it. aria-selected — and
   * the underline that hangs off it — is written from state.kind, so repainting
   * just the list would leave the strip claiming the tab you left.
   */
  paintKinds();
  paintThreads();
  paintConversation();
  // The clicked button has just been replaced; put the keyboard on its
  // successor rather than dropping focus to <body>.
  el('kindTabs').querySelector('[aria-selected="true"]')?.focus();
}

/* ===================== Quick filters ===================== */

/**
 * Urgent and Unread, standing under the search box rather than folded into a
 * filter panel.
 *
 * They are two independent switches — either, neither or both — and
 * `state.quick` keeps a boolean per id, which is what matches() reads. The
 * chips carry their own state in aria-pressed, so the strip is written once
 * here and afterwards each chip flips itself; there is nothing else on the
 * row that a repaint would have to keep in step.
 */
function paintQuick() {
  el('quickFilters').innerHTML = QUICK_FILTERS.map(
    (filter) => `<button type="button" class="comm__quick-chip"
      aria-pressed="${state.quick[filter.id]}" data-quick="${filter.id}"
      data-testid="comm--quick-${filter.id}">${esc(filter.label)}</button>`
  ).join('');

  el('quickFilters').querySelectorAll('[data-quick]').forEach((chip) =>
    chip.addEventListener('click', () => {
      const key = chip.dataset.quick;
      state.quick[key] = !state.quick[key];
      chip.setAttribute('aria-pressed', String(state.quick[key]));
      paintThreads();
    })
  );
}

/* ===================== The conversation list ===================== */

function matches(entry) {
  const kind = KINDS.find((k) => k.id === state.kind);
  if (kind?.match && entry.kind !== kind.match) return false;

  if (state.quick.urgent && !entry.urgent) return false;
  if (state.quick.unread && !entry.unread) return false;

  if (state.query) {
    const haystack = [
      threadName(entry),
      entry.party?.mrn,
      entry.party?.role,
      ...entry.messages.flatMap((message) => message.lines),
      ...(entry.members ?? []).map((member) => member.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(state.query.toLowerCase())) return false;
  }

  return true;
}

/** A group's avatar is the group mark; a person's is their initials. */
function avatarFor(entry, size = 'md') {
  if (entry.kind === 'group') {
    return `<span class="comm__group-avatar comm__group-avatar--${size}" aria-hidden="true">
      <svg class="ui-icon"><use href="#i-users"></use></svg>
    </span>`;
  }
  return `<ui-avatar name="${esc(entry.party.name)}" size="${size}"></ui-avatar>`;
}

/** The chip that says what kind of correspondent this is. */
function partyBadge(party) {
  const tone = PARTY_TONES[party.kind] ?? 'neutral';
  const label = party.kind === 'patient' ? 'Patient' : party.role;
  return `<ui-badge status="${tone}" size="sm">${esc(label)}</ui-badge>`;
}

/**
 * One line of preview. Bold markers are stripped — a row is not the message.
 *
 * A conversation you have just started has nothing to preview yet, and that is
 * worth saying: an empty row reads as a row that failed to load.
 */
const preview = (message) => {
  if (!message) return 'No messages yet — say something.';
  const text = [...message.lines, ...(message.bullets ?? []), ...(message.items ?? [])]
    .join(' ')
    .replace(/\*/g, '');
  return message.ai ? `Assistant suggestion — ${text}` : text;
};

/**
 * Today's conversations first, everything else in the order it was seeded.
 *
 * The demo data carries a day, not a timestamp, so this is the only ordering it
 * can honestly support — and it is the one that matters: a thread you replied to
 * a minute ago belongs above one nobody has touched since Thursday. Array sort
 * is stable, so threads within a day keep their order rather than shuffling on
 * every repaint.
 */
const dayRank = (entry) => (entry.when === 'Today' ? 0 : 1);

function paintThreads() {
  const visible = threads.filter(matches).sort((a, b) => dayRank(a) - dayRank(b));

  el('threadList').innerHTML = visible
    .map((entry) => {
      const message = lastMessage(entry);
      return `<button type="button" class="comm__row${
        entry.id === state.selected ? ' comm__row--on' : ''
      }" data-thread="${entry.id}" data-testid="comm--row-${entry.id}"
        aria-current="${entry.id === state.selected}">
        ${avatarFor(entry, 'md')}
        <span class="comm__row-body">
          <span class="comm__row-top">
            <span class="comm__row-name">${esc(threadName(entry))}</span>
            ${entry.kind === 'group' ? '' : partyBadge(entry.party)}
            <span class="comm__row-marks">
              ${entry.urgent ? marker('bell', 'Urgent', 'comm__urgent') : ''}
              <span class="comm__row-when">${esc(entry.when)}</span>
            </span>
          </span>
          ${
            entry.kind === 'group'
              ? `<span class="comm__row-members">
                  <svg class="ui-icon" aria-hidden="true"><use href="#i-users"></use></svg>
                  ${entry.members.length}
                </span>`
              : ''
          }
          <span class="comm__row-bottom">
            <span class="comm__row-preview">${esc(preview(message))}</span>
            ${
              /* The count belongs to the preview line, at the end of it: "this
                 was the last thing said, and n of these are still new" is one
                 sentence, so it is drawn as one line. */
              entry.unread
                ? `<span class="comm__row-unread">${entry.unread}<span class="u-sr-only"> unread ${
                    entry.unread === 1 ? 'message' : 'messages'
                  }</span></span>`
                : ''
            }
          </span>
        </span>
      </button>`;
    })
    .join('');

  el('threadEmpty').hidden = visible.length > 0;

  el('threadList').querySelectorAll('[data-thread]').forEach((row) =>
    row.addEventListener('click', () => openThread(row.dataset.thread))
  );
}

/* ===================== The open conversation ===================== */

/**
 * Open a conversation.
 *
 * `focus` is false for the one opened on arrival: moving the keyboard into the
 * composer before the reader has read anything means the first thing that
 * happens on the page is a caret blinking at the bottom of it.
 */
function openThread(id, { focus = true } = {}) {
  const entry = thread(id);
  if (!entry) return;

  state.selected = id;
  // Opening a thread reads it. See rule 3 at the top of this file.
  entry.unread = 0;

  paintKinds();
  paintThreads();
  paintConversation();
  if (focus) el('draft').focus();
}

/** Up to five faces, then a count — a group of ten cannot show ten. */
function memberStrip(entry) {
  /* <ui-avatar-group> does the slicing and the +N itself, so the whole list
     goes in and `max` decides what shows. The overlap and the surface-coloured
     ring come with it — this row used to sit them side by side with a gap,
     which is a row of faces rather than a group of them. */
  const people = entry.members.map((member) => ({ name: member.name }));

  return `<ui-avatar-group size="sm" max="5"
    people="${esc(JSON.stringify(people))}"></ui-avatar-group>`;
}

function paintConversation() {
  const entry = selected();

  el('blankState').hidden = Boolean(entry);
  el('convPane').hidden = !entry;
  if (!entry) return;

  /* The head's face is the LARGE one — the list's is medium. The size is the
     difference between "one of these" and "the one you are talking to", and it
     is the only thing on this screen saying so twice. */
  el('convHead').innerHTML =
    entry.kind === 'group'
      ? `${avatarFor(entry, 'lg')}
        <div class="comm__conv-who">
          <h2 class="comm__conv-name">${esc(entry.name)}</h2>
          ${memberStrip(entry)}
        </div>`
      : `${avatarFor(entry, 'lg')}
        <div class="comm__conv-who">
          <h2 class="comm__conv-name">
            ${esc(entry.party.name)}
            ${entry.party.mrn ? `<span class="comm__conv-mrn">(${esc(entry.party.mrn)})</span>` : ''}
            ${partyBadge(entry.party)}
          </h2>
          <p class="comm__conv-contact">
            <span>Phone <b>${esc(entry.party.phone)}</b></span>
            <span>Email <b>${esc(entry.party.email)}</b></span>
          </p>
        </div>
        <span class="comm__spacer"></span>
        ${
          /* A patient's chart is one click away, because "who is this again"
             is the question a portal message raises most often. Colleagues
             have no chart, so they get no button. */
          entry.party.kind === 'patient'
            ? `<a class="ui-btn ui-btn--outline ui-btn--sm comm__profile"
                href="patient-chart.html?mrn=${encodeURIComponent(entry.party.mrn)}"
                data-testid="comm--profile">
                <svg class="ui-icon" aria-hidden="true"><use href="#i-user"></use></svg>
                Patient Profile
              </a>`
            : ''
        }`;

  paintStream(entry);
}

function paintStream(entry) {
  let day = '';

  el('stream').innerHTML = entry.messages
    .map((message) => {
      const separator = message.day === day ? '' : `<p class="comm__day">${esc(message.day)}</p>`;
      day = message.day;

      const mine = message.from === 'me';
      const author = mine ? ME : PEOPLE.find((who) => who.id === message.from);
      const side = mine || message.ai ? 'out' : 'in';

      const body = [
        ...message.lines.map((line) => `<p>${boldify(line)}</p>`),
        message.items?.length
          ? `<ol class="comm__list">${message.items
              .map((item) => `<li>${boldify(item)}</li>`)
              .join('')}</ol>`
          : '',
        message.bullets?.length
          ? `<ul class="comm__list">${message.bullets
              .map((item) => `<li>${boldify(item)}</li>`)
              .join('')}</ul>`
          : '',
        message.after ? `<p>${boldify(message.after)}</p>` : '',
      ].join('');

      /*
       * EVERY INCOMING BUBBLE IS SIGNED, in a group and in a one-to-one both —
       * and never on my own messages, where the name would be mine.
       *
       * It used to be groups only, on the argument that in a one-to-one the
       * sender is whichever side of the screen the bubble is on. That holds
       * while you are reading; it does not hold when you glance at a screen you
       * left an hour ago, or at a screenshot of one, and it is exactly the
       * moment a message gets attributed to the wrong person. The name is one
       * caption line INSIDE the bubble, so it costs the conversation nothing —
       * the old row above the bubble is what pushed the thread off screen.
       */
      const showAuthor = !mine && !message.ai;

      return `${separator}
        <div class="comm__msg comm__msg--${side}${message.ai ? ' comm__msg--ai' : ''}">
          <div class="comm__bubble">
            ${
              message.ai
                ? `<span class="comm__bubble-ai">${marker('sparkle', 'Assistant suggestion')}</span>`
                : ''
            }
            ${
              /* The name is the bubble's first line, and it has no face beside
                 it: the bubble already sits under a head that shows one, and in
                 a group the row of members does. A second avatar per message is
                 a column of faces down the left of the transcript, which is a
                 contact list, not a conversation. The badge stays in groups,
                 where "who is this" is a real question. */
              showAuthor
                ? `<div class="comm__msg-author">
                    <span class="comm__msg-author-name">${esc(author.name)}</span>
                    ${entry.kind === 'group' ? partyBadge(author) : ''}
                  </div>`
                : ''
            }
            <div class="comm__bubble-body">${body}</div>
            <p class="comm__meta">
              ${message.urgent ? marker('bell', 'Marked urgent', 'comm__urgent') : ''}
              ${
                message.seenBy
                  ? `<span class="comm__seen"><svg class="ui-icon" aria-hidden="true"><use href="#i-eye"></use></svg>
                      ${message.seenBy}<span class="u-sr-only"> people have read this</span></span>`
                  : ''
              }
              <span class="comm__at">${esc(message.at)}</span>
            </p>
          </div>
        </div>`;
    })
    .join('');

  // A conversation opens at its newest message, the way every chat does.
  el('stream').scrollTop = el('stream').scrollHeight;
}

/* ===================== Sending ===================== */

function send() {
  const entry = selected();
  const input = el('draft');
  const text = input.value.trim();
  if (!entry || !text) return;

  entry.messages.push({
    id: `m${nextId++}`,
    from: 'me',
    day: 'Today',
    at: stamp(),
    lines: [text],
  });
  entry.when = 'Today';

  input.value = '';
  paintThreads();
  paintStream(entry);
  input.focus();
}

/* ===================== New chat and new group ===================== */

const isGroup = () => state.newType === 'group';

/** Which roster the chosen type draws from. A group may mix both. */
function pool() {
  if (state.newType === 'patient') return ROSTER.patients;
  if (state.newType === 'clinician') return ROSTER.clinicians;
  return PEOPLE;
}

function openNew(open) {
  const panel = el('newPanel');
  const next = open ?? panel.hidden;
  panel.hidden = !next;

  /*
   * The state is written to BOTH the <ui-button> host and the real <button>
   * inside it. The host is where the markup declares it, but the host is not
   * what takes focus — a screen reader announces the inner control, and an
   * aria-expanded it cannot see is an aria-expanded that does nothing.
   */
  el('newBtn').setAttribute('aria-expanded', String(next));
  el('newBtn').querySelector('button')?.setAttribute('aria-expanded', String(next));

  if (!next) return;

  // A fresh panel every time: a half-built group left over from last time is
  // a group you did not mean to send to.
  state.picked = [];
  state.pickQuery = '';
  setValue(el('nSearch'), '');
  setValue(el('nName'), '');
  paintNew();
  el('nType').querySelector('select')?.focus();
}

function paintNew() {
  el('nNameRow').hidden = !isGroup();

  /* --- who has been chosen --- */
  el('nPicked').hidden = state.picked.length === 0;
  el('nPicked').innerHTML = state.picked
    .map(
      (who) => `<ui-chip removable data-picked="${who.id}"
        data-testid="comm--n-picked-${who.id}">${esc(who.name)}</ui-chip>`
    )
    .join('');

  el('nPicked').querySelectorAll('[data-picked]').forEach((chip) =>
    chip.addEventListener('ui-close', (event) => {
      // The chip list is rebuilt below; let paintNew remove it, not the chip
      // itself, or the DOM and state.picked disagree for one frame.
      event.preventDefault();
      state.picked = state.picked.filter((who) => who.id !== chip.dataset.picked);
      paintNew();
    })
  );

  /* --- who can be chosen --- */
  const query = state.pickQuery.toLowerCase();
  const candidates = pool().filter(
    (who) =>
      !state.picked.some((picked) => picked.id === who.id) &&
      (!query ||
        who.name.toLowerCase().includes(query) ||
        (who.mrn ?? '').includes(query) ||
        who.role.toLowerCase().includes(query))
  );

  const sections = isGroup()
    ? [
        { label: 'Recent Patients', list: candidates.filter((who) => who.kind === 'patient') },
        { label: 'Recent Clinicians', list: candidates.filter((who) => who.kind === 'staff') },
      ]
    : [
        {
          label: state.newType === 'patient' ? 'Recent Patients' : 'Recent Clinicians',
          list: candidates,
        },
      ];

  el('nBody').innerHTML =
    sections
      .filter((section) => section.list.length)
      .map(
        (section) => `<p class="comm__new-label">${esc(section.label)}</p>
        ${section.list
          .map(
            (who) => `<button type="button" class="comm__pick" data-pick="${who.id}"
              data-testid="comm--n-pick-${who.id}">
              <ui-avatar name="${esc(who.name)}" size="sm"></ui-avatar>
              <span class="comm__pick-name">${esc(who.name)}</span>
              <span class="comm__pick-role">${esc(who.kind === 'patient' ? `MRN ${who.mrn}` : who.role)}</span>
            </button>`
          )
          .join('')}`
      )
      .join('') || `<p class="comm__new-none">Nobody matches that search.</p>`;

  el('nBody').querySelectorAll('[data-pick]').forEach((option) =>
    option.addEventListener('click', () => {
      const who = PEOPLE.find((entry) => entry.id === option.dataset.pick);
      // One-to-one means one: a second choice REPLACES the first rather than
      // silently doing nothing, because a click that does nothing reads as
      // broken. See rule 2 at the top of this file.
      state.picked = isGroup() ? [...state.picked, who] : [who];
      paintNew();
    })
  );

  /* --- what is still needed --- */
  const needed = isGroup()
    ? 'A group needs at least two people.'
    : `Choose the ${state.newType === 'patient' ? 'patient' : 'colleague'} to message.`;
  el('nHint').textContent = ready() ? '' : needed;
  el('nStart').toggleAttribute('disabled', !ready());
}

const ready = () => (isGroup() ? state.picked.length >= 2 : state.picked.length === 1);

/**
 * Name a group that was not given one.
 *
 * First names, up to three, then "+n". A group called "Group 4" tells you
 * nothing about it a week later; a group called "Henna, Esther, Arlene +7"
 * tells you who is in it, which is all a group chat's name has to do.
 */
function composedName() {
  const first = state.picked.map((who) => who.name.split(' ')[0]);
  const shown = first.slice(0, 3).join(', ');
  const rest = first.length - 3;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

function startChat() {
  if (!ready()) return;

  /* An existing one-to-one thread is opened, not duplicated. */
  if (!isGroup()) {
    const [who] = state.picked;
    const existing = threads.find((entry) => entry.party?.id === who.id);
    if (existing) {
      openNew(false);
      openThread(existing.id);
      notify(`You already have a chat with ${who.name} — opened it.`, 'info');
      return;
    }
  }

  const entry = isGroup()
    ? {
        id: `th-${nextId++}`,
        kind: 'group',
        name: fieldValue(el('nName')).trim() || composedName(),
        members: [...state.picked],
        when: 'Today',
        unread: 0,
        urgent: false,
        messages: [],
      }
    : {
        id: `th-${nextId++}`,
        kind: state.picked[0].kind === 'patient' ? 'patient' : 'clinician',
        party: state.picked[0],
        when: 'Today',
        unread: 0,
        urgent: false,
        messages: [],
      };

  threads.unshift(entry);

  // Land on the tab the new conversation is actually in, so it is on screen
  // rather than filtered out by whichever tab happened to be selected.
  state.kind = kindOf(entry)?.id ?? 'all';

  openNew(false);
  paintKinds();
  openThread(entry.id);
  notify(
    isGroup()
      ? `Group "${entry.name}" created with ${entry.members.length} people.`
      : `Chat started with ${entry.party.name}.`
  );
}

/* ===================== Notices ===================== */

/* notify() now lives in js/lib/toast.js — see the import above. */

/* ===================== Wiring ===================== */

customElements.whenDefined('ui-select').then(() => {
  el('nType').setOptions(CHAT_TYPES);
  setValue(el('nType'), state.newType);

  paintKinds();
  paintQuick();
  paintThreads();
  // The newest conversation is open on arrival: an empty right-hand panel is
  // a screen that asks you to click before it tells you anything.
  openThread(threads[0].id, { focus: false });

  /* --- Search and filters --- */
  el('qSearch').addEventListener('ui-input', (event) => {
    state.query = event.detail.value;
    paintThreads();
  });


  /* --- New chat --- */
  // The popover's wiring lives on the real control as well as the host, for
  // the reason given in openNew.
  const newButton = el('newBtn').querySelector('button');
  newButton?.setAttribute('aria-expanded', 'false');
  newButton?.setAttribute('aria-haspopup', 'dialog');
  newButton?.setAttribute('aria-controls', 'newPanel');

  el('newBtn').addEventListener('ui-click', () => openNew());
  el('nCancel').addEventListener('ui-click', () => openNew(false));
  el('nStart').addEventListener('ui-click', startChat);

  el('nType').addEventListener('ui-change', (event) => {
    state.newType = event.detail.value;
    // Changing the type empties the choices: the people who were valid for a
    // patient chat are not the people valid for a clinician one.
    state.picked = [];
    paintNew();
  });

  el('nSearch').addEventListener('ui-input', (event) => {
    state.pickQuery = event.detail.value;
    paintNew();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.comm__new')) openNew(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (el('newPanel').hidden) return;
    openNew(false);
    el('newBtn').querySelector('button')?.focus();
  });

  /* --- Composer --- */
  el('composer').addEventListener('submit', (event) => {
    event.preventDefault();
    send();
  });

  /* The three trims down the side of the composer are not built in a
     prototype — they are named so a reviewer can see what the real screen
     offers, and each says so rather than doing nothing when clicked. */
  el('attachBtn').addEventListener('click', () =>
    notify('Attachments are not wired up in this prototype.', 'info')
  );
  el('dictateBtn').addEventListener('click', () =>
    notify('Dictation is not wired up in this prototype.', 'info')
  );
  el('assistBtn').addEventListener('click', () => {
    const entry = selected();
    if (!entry) return;
    const draft = el('draft');
    draft.value =
      entry.kind === 'group'
        ? 'Summarising the thread so far for the team — please review before sending.'
        : 'Thank you for the update. I have read it and will come back to you today.';
    draft.focus();
    notify('The assistant drafted a reply. Read it before you send it.', 'info');
  });
});
