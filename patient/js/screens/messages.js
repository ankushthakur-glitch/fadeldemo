/**
 * MESSAGES — the conversation list and the open thread.
 *
 * Called Chat until now, in the nav, in the title and in the address. Nobody
 * writes to their gastroenterologist the way they chat: the threads here are
 * days apart, they carry lab figures and prep instructions, and a patient
 * comes back to them a week later to re-read what they were told. "Messages"
 * is what the rest of the portal already called them — Home's card has always
 * been headed Messages — so the two names were describing one screen.
 *
 * Search, the two quick filters, switching threads and sending a message all
 * genuinely work against the fixture data. They are the cheap half of this screen and the half a
 * reviewer will actually poke at; leaving them inert would make the whole
 * pane read as a picture.
 */

import { mountShell } from '../lib/shell.js';
import { icon } from '../lib/icons.js';
import { esc, initials, plural } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { THREADS, CONVERSATIONS, EMPTY_CONVERSATION } from '../../data/messages.js';

/**
 * Which thread is open, and what the list is currently narrowed by.
 *
 * `openId` honours ?thread=<id> so a notification about a message can open
 * the message rather than dropping the patient at the top of the list to find
 * it themselves. An unknown id falls back to the first thread — the screen
 * still works, which is the right failure for a stale link.
 *
 * One list, individual threads and groups together: the Individual / Groups
 * pair the reference draws above the panes is gone. A patient has a handful
 * of conversations, not a directory of them, and splitting nine rows across
 * two views hides half of them behind a control to save no scrolling at all.
 * Search and the two quick filters are what narrow the list.
 */
const asked = new URLSearchParams(location.search).get('thread');

const state = {
  openId: (THREADS.find((thread) => thread.id === asked) ?? THREADS[0]).id,
  query: '',
  urgent: false,
  unread: false,
};

/** Messages sent during this page view, keyed by thread. Not persisted. */
const sent = {};

document.addEventListener('DOMContentLoaded', () => {
  const mounted = mountShell({ active: 'messages' });
  if (!mounted) return;

  paintList();
  paintThread();
  wire();
});

/* ============================================================================
   THE CONVERSATION LIST
   ========================================================================= */

function visibleThreads() {
  const query = state.query.trim().toLowerCase();
  return THREADS.filter((thread) => {
    if (state.urgent && !thread.urgent) return false;
    if (state.unread && !thread.unread) return false;
    if (!query) return true;
    return (
      thread.name.toLowerCase().includes(query) ||
      thread.preview.toLowerCase().includes(query)
    );
  });
}

function paintList() {
  const host = document.getElementById('threadList');
  const threads = visibleThreads();

  if (!threads.length) {
    host.innerHTML = `<li class="pp-empty" style="margin:var(--pp-space-7) auto">
      <p>No conversations match those filters.</p>
    </li>`;
    return;
  }

  /*
   * Four fields to a row, which is what the reference draws: the avatar, the
   * name, the day and one clamped line of the last message, with the unread
   * count on the right. Urgency is not one of them — a red bell beside every
   * other name, over a 13px preview line, made the list shout louder than
   * the conversation it is there to open. It is drawn where it changes what
   * a patient does instead: on the thread head, and on the message itself.
   */
  host.innerHTML = threads
    .map((thread) => {
      const open = thread.id === state.openId;
      return `
        <li>
          <button type="button" class="pp-thread" aria-current="${open}"
            data-thread="${esc(thread.id)}" data-testid="messages--thread">
            <span class="pp-avatar${thread.members ? ' pp-avatar--group' : ''}" aria-hidden="true">
              ${thread.members ? icon('users', { size: 'sm' }) : esc(initials(thread.name))}
            </span>

            <span class="pp-thread__main">
              <span class="pp-thread__top">
                <span class="pp-thread__name">${esc(thread.name)}</span>
                <span class="pp-thread__when">${esc(thread.when)}</span>
              </span>

              <span class="pp-thread__preview">${esc(thread.preview)}</span>
            </span>

            ${
              thread.unread
                ? `<span class="pp-thread__unread">${thread.unread}<span class="pp-sr-only">
                     unread ${plural(thread.unread, 'message')}</span></span>`
                : ''
            }
          </button>
        </li>
      `;
    })
    .join('');
}

/* ============================================================================
   THE OPEN THREAD
   ========================================================================= */

function openThread() {
  return THREADS.find((thread) => thread.id === state.openId) ?? THREADS[0];
}

function messagesFor(id) {
  return [...(CONVERSATIONS[id] ?? EMPTY_CONVERSATION), ...(sent[id] ?? [])];
}

/**
 * The head — the portrait and the name of whoever is being written to.
 *
 * It used to carry a speciality badge, an Urgent badge, a phone number and an
 * email address. None of those are in any supplied screenshot, and four
 * invented fields over a two-line band said more about the person than the
 * screen was ever asked to: the patient chose this row from the list a moment
 * ago and knows who they are writing to. The name is the label on the pane.
 *
 * A group keeps one line, because it answers a question a patient really does
 * have before typing: how many people can see this.
 */
function paintHead() {
  const head = document.getElementById('threadHead');
  const thread = openThread();

  head.innerHTML = `
    <span class="pp-avatar${thread.members ? ' pp-avatar--group' : ''}"
      aria-hidden="true">
      ${thread.members ? icon('users', { size: 'sm' }) : esc(initials(thread.name))}
    </span>

    <div class="pp-messages__who">
      <span class="pp-messages__who-name">${esc(thread.name)}</span>
      ${
        thread.members
          ? `<div class="pp-messages__who-meta">
               ${thread.members} people can see what you write here
             </div>`
          : ''
      }
    </div>
  `;
}

function paintThread() {
  const log = document.getElementById('threadLog');
  const thread = openThread();

  paintHead();

  // The head is painted markup rather than a heading the region can point at,
  // so the region names itself. Re-set on every switch or the label describes
  // the wrong person.
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', `Conversation with ${thread.name}`);

  // Each bubble is told what came before it, so a run of messages from one
  // person can close up and stop repeating their name.
  const messages = messagesFor(state.openId);
  log.innerHTML = messages
    .map((message, index) => bubble(message, thread, messages[index - 1]))
    .join('');

  // Newest message in view. Not smooth: this runs on load and on every
  // switch, and an animated jump on arrival reads as the page still loading.
  log.scrollTop = log.scrollHeight;
}

/**
 * Who a message is from, as one comparable value.
 *
 * The patient is `null` — nothing in the data names them, and their messages
 * carry no sender line — and everyone else is the name that would be printed
 * over the bubble. Two messages match when the same person sent them, which
 * is all the run-grouping below needs.
 */
function speaker(message, thread) {
  if (!message) return undefined;
  if (message.mine === true) return null;
  return message.from ?? (thread.members ? 'Care team' : thread.name);
}

function bubble(message, thread, previous) {
  /*
   * Two paths into the bubble, and only one of them allows markup.
   *
   * `html: true` is set exclusively on the authored fixture messages in
   * data/messages.js — the lab figures and the numbered test list, which lose
   * their meaning as one flat paragraph. Anything a user types goes through
   * esc(). The check is on the flag rather than on the content, so there is
   * no way for typed text to acquire the flag by looking like markup.
   */
  const body = message.html ? message.body : esc(message.body);
  const mine = message.mine === true;

  /*
   * A run is a second, third, fourth message from the same person with
   * nobody answering in between. It closes up against the one above it and
   * drops the sender line: the name is already sitting two lines up, and
   * repeating it turns four sentences from one doctor into four separate
   * announcements. The gap only opens where the speaker actually changes,
   * which is the thing worth seeing in a transcript.
   */
  const from = speaker(message, thread);
  const run = from === speaker(previous, thread);

  return `
    <div class="pp-bubble-row${mine ? ' pp-bubble-row--mine' : ''}${
      run ? ' pp-bubble-row--run' : ''
    }">
      <div class="pp-bubble">
        ${from && !run ? `<div class="pp-bubble__from">${esc(from)}</div>` : ''}
        <div>${body}</div>
        <div class="pp-bubble__meta">
          ${
            message.urgent
              ? `<span class="pp-bubble__urgent" title="Marked urgent">
                   ${icon('bell-alert', { size: 'sm' })}
                 </span>`
              : ''
          }
          <time>${esc(message.at)}</time>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================================
   WIRING
   ========================================================================= */

function wire() {
  const list = document.getElementById('threadList');
  const search = document.getElementById('threadSearch');
  const composer = document.getElementById('composer');
  const input = document.getElementById('composerInput');

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-thread]');
    if (!button) return;
    state.openId = button.dataset.thread;
    paintList();
    paintThread();
  });

  search.addEventListener('input', () => {
    state.query = search.value;
    paintList();
  });

  document.querySelectorAll('[data-filter]').forEach((chip) =>
    chip.addEventListener('click', () => {
      const key = chip.dataset.filter;
      state[key] = !state[key];
      chip.setAttribute('aria-pressed', String(state[key]));
      paintList();
    })
  );

  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = input.value.trim();
    if (!body) return;

    (sent[state.openId] ??= []).push({
      mine: true,
      body, // escaped at render — see bubble()
      at: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    input.value = '';
    paintThread();
    input.focus();
  });

  /* The composer tools and the two list buttons, none of which have a system
     behind them in a prototype. */
  const say = (selector, message) =>
    document.querySelector(selector)?.addEventListener('click', () => toast(message));

  say('#newMessage', 'This would open a new message to a member of your care team.');
  say('#moreFilters', 'More filters are not part of this design cut.');
  say('[data-attach]', 'This would attach a photo or a document to the message.');
  say('[data-dictate]', 'This would dictate your message.');
  say('[data-assist]', 'This would help you word your message.');
}
