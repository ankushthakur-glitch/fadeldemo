/**
 * READING AND WRITING COMMENTS.
 *
 * Supabase over plain fetch, not the supabase-js SDK. The prototype has no
 * build step and no node_modules at runtime, and PostgREST — which is all the
 * SDK is talking to — is a perfectly pleasant HTTP API: a GET with a filter in
 * the query string, a POST with a JSON body. Adding a bundler so the layer
 * could `import { createClient }` would be the largest change this feature
 * made to the repository, and it would buy four lines.
 *
 * WHEN THERE IS NO SUPABASE the whole thing falls back to localStorage and
 * keeps working. That is not a courtesy: this prototype is regularly opened
 * straight off disk, and it is demonstrated on conference wifi. A review tool
 * that throws away a typed comment because a request timed out is worse than
 * no review tool. Every write goes to the local mirror FIRST and to the
 * network second, so a failed request loses nothing — it only means the
 * comment is on this machine and not yet on anyone else's, which the sidebar
 * says out loud.
 */

import { SUPABASE_URL, SUPABASE_KEY, TABLE, BUCKET } from './config.js';

const LOCAL_ROWS = 'medinova.comments.rows';
const LOCAL_AUTHOR = 'medinova.comments.author';
const LOCAL_READ = 'medinova.comments.read';
const LOCAL_FILTERS = 'medinova.comments.filters';

/* Whether the remote is even worth trying. A blanked key in config.js, or a
   file:// page where every cross-origin request is refused before it leaves,
   both land here. */
const CONFIGURED =
  Boolean(SUPABASE_URL && SUPABASE_KEY) && location.protocol !== 'file:';

/**
 * What happened last time we tried the network. The sidebar reads this to
 * decide whether to admit that comments are only on this machine.
 * @type {'unknown'|'online'|'offline'}
 */
let health = CONFIGURED ? 'unknown' : 'offline';

export function connection() {
  return { configured: CONFIGURED, health };
}

/* ==========================================================================
   THE HTTP BIT
   ========================================================================== */

const host = SUPABASE_URL.replace(/\/+$/, '');
const endpoint = `${host}/rest/v1/${TABLE}`;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function request(url, options = {}) {
  if (!CONFIGURED) throw new Error('comments: no remote configured');

  const response = await fetch(url, { ...options, headers: headers(options.headers) });
  if (!response.ok) {
    /* PostgREST puts a genuinely useful message in the body — a missing table,
       a policy that refused the write. Worth carrying into the thrown error,
       because the alternative is a console full of bare 401s. */
    const detail = await response.text().catch(() => '');
    throw new Error(`comments: ${response.status} ${response.statusText} ${detail}`.trim());
  }
  if (response.status === 204) return null;
  return response.json();
}

/* ==========================================================================
   WRITES THE SERVER HAS NOT CONFIRMED YET

   This register is the fix for a bug that made saving a comment look broken:
   the pin and the thread would vanish for a second or two and come back on
   their own, and a reload always showed them fine.

   The cause was a race between the two halves of an optimistic write. Saving
   put the comment in the local mirror and POSTed it in the background — and
   then immediately refreshed the list, which GETs the table and writes what
   comes back over the mirror. If the GET was answered before the POST landed,
   the response was a table that did not have the new comment in it yet, and
   the freshly written row was overwritten with its own absence. The next poll,
   fifteen seconds later, brought it back.

   So a write stays on this register until the server has acknowledged it, and
   every read merges the register over whatever the table returned. The server
   is the truth about everything except what it has not been told yet.

   It earns something the fix did not set out to buy: a comment written while
   the connection is down stays on the register, and every successful read
   retries it. Write a comment on a train, and it posts itself when the signal
   comes back.
   ========================================================================== */

/** @type {Map<string, object>} inserts not yet acknowledged */
const pendingRows = new Map();
/** @type {Map<string, object>} field changes not yet acknowledged */
const pendingPatches = new Map();
/** @type {Set<string>} deletions not yet acknowledged */
const pendingDeletes = new Set();

/** Lay everything unacknowledged over a set of rows from the server. */
function applyPending(rows) {
  const out = rows
    .filter((r) => !pendingDeletes.has(r.id) && !pendingDeletes.has(r.parent_id))
    .map((r) => (pendingPatches.has(r.id) ? { ...r, ...pendingPatches.get(r.id) } : r));

  const known = new Set(out.map((r) => r.id));
  for (const [id, row] of pendingRows) if (!known.has(id)) out.push(row);

  return out.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/**
 * Have another go at everything still outstanding.
 *
 * Called after a successful read, because a read succeeding is the best
 * evidence available that the network is back. Every write is idempotent —
 * inserts upsert on the primary key, patches and deletes address one id — so a
 * retry of something that did in fact land the first time is harmless.
 */
function retryPending() {
  for (const row of [...pendingRows.values()]) push(row);
  for (const [id, fields] of [...pendingPatches]) sendPatch(id, fields);
  for (const id of [...pendingDeletes]) sendDelete(id);
}

/* ==========================================================================
   THE LOCAL MIRROR
   ========================================================================== */

function localRows() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_ROWS) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocalRows(rows) {
  try {
    localStorage.setItem(LOCAL_ROWS, JSON.stringify(rows));
  } catch {
    /* A full or disabled localStorage is survivable — the session still works,
       it just will not remember. Not worth an error the reviewer cannot act
       on. */
  }
}

function mergeLocal(row) {
  const rows = localRows();
  const at = rows.findIndex((r) => r.id === row.id);
  if (at === -1) rows.push(row);
  else rows[at] = { ...rows[at], ...row };
  writeLocalRows(rows);
  return row;
}

/* ==========================================================================
   THE FOUR OPERATIONS
   ========================================================================== */

/**
 * Every comment, both products, oldest first.
 *
 * The whole table, not just this screen's rows. A design review runs to
 * dozens of comments, not thousands, and holding all of them means the
 * sidebar's "only current page" filter is a filter rather than a refetch, and
 * the badge can count what is waiting on screens you have not opened yet.
 */
export async function list() {
  if (CONFIGURED) {
    try {
      const rows = await request(`${endpoint}?select=*&order=created_at.asc`);
      health = 'online';
      /* The remote is the truth when it answers — about everything it has been
         told. Anything still on the pending register goes back on top. */
      const merged = applyPending(rows);
      writeLocalRows(merged);
      retryPending();
      return merged;
    } catch (error) {
      health = 'offline';
      console.warn('[comments] falling back to local storage —', error.message);
    }
  }
  return localRows().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/**
 * Add a comment or a reply.
 *
 * The id is generated here rather than by the database default, so the row
 * that goes into the local mirror and the row that comes back from Postgres
 * are the same row. Without that, an offline comment would acquire a second
 * identity the moment the network returned, and the layer would draw two pins.
 *
 * IT RETURNS BEFORE THE NETWORK DOES, and that is the important part. The
 * comment is already written — to the local mirror, on the line above the
 * request — so making the reviewer watch a spinner until Supabase answers
 * buys nothing and costs everything: on a slow connection, pressing Comment
 * and seeing the screen sit there for four seconds reads as a lost comment,
 * and the reviewer presses it again. So the row comes back immediately and
 * the caller draws it; `saved` resolves later, for anything that wants to
 * know whether it made it out — which here is only the sidebar's offline
 * notice.
 *
 * @returns {{ row: object, saved: Promise<object> }}
 */
export function add(fields) {
  const row = {
    id: uuid(),
    created_at: new Date().toISOString(),
    resolved: false,
    ...fields,
  };

  mergeLocal(row);
  if (!CONFIGURED) return { row, saved: Promise.resolve(row) };

  pendingRows.set(row.id, row);
  return { row, saved: push(row) };
}

async function push(row) {
  try {
    /* merge-duplicates makes the POST an upsert on the primary key, so
       retrying a write that actually did land is a no-op rather than a
       duplicate-key error. */
    const [saved] = await request(endpoint, {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    health = 'online';
    pendingRows.delete(row.id);
    return mergeLocal(saved ?? row);
  } catch (error) {
    health = 'offline';
    console.warn('[comments] saved locally only, will retry —', error.message);
    return row;
  }
}

/** Change a comment in place — resolving it, or editing its text. */
export async function patch(id, fields) {
  mergeLocal({ id, ...fields });
  if (!CONFIGURED) return { id, ...fields };

  pendingPatches.set(id, { ...(pendingPatches.get(id) || {}), ...fields });
  await sendPatch(id, pendingPatches.get(id));
  return { id, ...fields };
}

async function sendPatch(id, fields) {
  try {
    const [saved] = await request(`${endpoint}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(fields),
    });
    health = 'online';
    pendingPatches.delete(id);
    if (saved) mergeLocal(saved);
  } catch (error) {
    health = 'offline';
    console.warn('[comments] change saved locally only, will retry —', error.message);
  }
}

/**
 * Delete a comment and, if it is a root, everything under it.
 *
 * Postgres does the cascade itself (the foreign key says so); the local mirror
 * has to be told, which is what the filter below is for.
 */
export async function remove(id) {
  writeLocalRows(localRows().filter((r) => r.id !== id && r.parent_id !== id));
  /* A row that was never acknowledged does not need deleting from a server
     that has never heard of it — dropping it from the register is the delete. */
  pendingRows.delete(id);
  pendingPatches.delete(id);
  if (!CONFIGURED) return;

  pendingDeletes.add(id);
  await sendDelete(id);
}

async function sendDelete(id) {
  try {
    await request(`${endpoint}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    health = 'online';
    pendingDeletes.delete(id);
  } catch (error) {
    health = 'offline';
    console.warn('[comments] delete saved locally only, will retry —', error.message);
  }
}

/* ==========================================================================
   IMAGES
   ========================================================================== */

/**
 * Put one image in the bucket and hand back the address it can be read from.
 *
 * Storage rather than a column: see the note in supabase/comments.sql. The
 * caller has already shrunk it — this only moves bytes.
 *
 * It throws rather than falling back, deliberately. The caller knows something
 * this does not, which is that an image that cannot be stored is better
 * carried inside the comment than lost; see attach() in images.js.
 */
export async function uploadImage(blob, name = 'image') {
  if (!CONFIGURED) throw new Error('comments: no remote configured');

  const extension = (blob.type.split('/')[1] || 'webp').replace('jpeg', 'jpg');
  const path = `${uuid()}.${extension}`;

  const response = await fetch(`${host}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': blob.type,
      /* The name is a fresh uuid, so there is nothing to overwrite — this is
         only here so a retry of a request that did land is not an error. */
      'x-upsert': 'true',
    },
    body: blob,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`comments: upload ${response.status} ${detail}`.trim());
  }

  health = 'online';
  return `${host}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Take an image back out of the bucket.
 *
 * Called when the comment carrying it is deleted. Without this the row goes
 * and the file stays, for ever, costing storage and belonging to nothing — and
 * still readable by anyone who kept the URL, which is the part that matters:
 * deleting a comment should delete the screenshot in it, not just the sentence
 * next to it.
 *
 * Quietly does nothing for an image that is not in the bucket — one carried
 * inside the comment as a data URL has already gone with the row.
 */
export async function deleteImage(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  if (!CONFIGURED || !url?.includes(marker)) return;

  const path = url.slice(url.indexOf(marker) + marker.length);
  try {
    await fetch(`${host}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  } catch (error) {
    /* A file left behind is untidy, not broken, and the comment it belonged to
       is already gone. Not worth failing the delete the reviewer asked for. */
    console.warn('[comments] image left in the bucket —', error.message);
  }
}

/* ==========================================================================
   WHO YOU ARE, AND WHAT YOU HAVE SEEN
   ========================================================================== */

/**
 * The name typed into the composer, remembered.
 *
 * There is no sign-in here and there should not be: the people who review a
 * prototype are the people you sent the link to. A name in localStorage is
 * exactly as much identity as "Only your threads" needs, and it is honest
 * about being that much and no more.
 */
export function author() {
  try {
    return localStorage.getItem(LOCAL_AUTHOR) || '';
  } catch {
    return '';
  }
}

export function setAuthor(name) {
  try {
    localStorage.setItem(LOCAL_AUTHOR, name);
  } catch {
    /* see writeLocalRows */
  }
}

/**
 * Which comments this browser has already seen.
 *
 * Per browser, not per row in the table — "unread" is a property of the
 * reader, and the table has no readers in it. It is also why the unread count
 * is right for you and meaningless to anyone else, which is the correct
 * behaviour.
 */
export function readIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOCAL_READ) || '[]'));
  } catch {
    return new Set();
  }
}

export function markRead(ids) {
  const seen = readIds();
  for (const id of ids) seen.add(id);
  try {
    localStorage.setItem(LOCAL_READ, JSON.stringify([...seen]));
  } catch {
    /* see writeLocalRows */
  }
}

/** The sidebar's own settings — sort order and which filters are on. */
export function filters() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FILTERS) || '{}');
  } catch {
    return {};
  }
}

export function setFilters(value) {
  try {
    localStorage.setItem(LOCAL_FILTERS, JSON.stringify(value));
  } catch {
    /* see writeLocalRows */
  }
}

/**
 * crypto.randomUUID() is not available on an insecure origin, which is what
 * http://localhost's siblings on a LAN are when the prototype is being shown
 * from one laptop to another. The fallback is a v4-shaped string from
 * getRandomValues, and failing that from Math.random — good enough for a key
 * that only has to be unique among a few hundred comments.
 */
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
