/**
 * WHERE THE COMMENTS GO.
 *
 * The key below is Supabase's *anon* key. It is designed to sit in client
 * code where anyone can read it — it carries no privileges of its own,
 * and everything it is allowed to do is decided by the row-level security
 * policies in supabase/comments.sql. Those policies are wide open, so treat
 * this layer as a public noticeboard: see the warning in that file.
 *
 * There is no build step in this prototype and no server to read an
 * environment variable, so configuration is a committed module. That is the
 * only shape that works when a page can be opened straight off disk.
 *
 * Blank the URL or the key and the layer does not break — it falls back to
 * this browser's localStorage, which is what happens on a file:// copy too.
 * See js/lib/comments/store.js.
 */

export const SUPABASE_URL = 'https://aophytgcukrcfahknynv.supabase.co';
export const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvcGh5dGdjdWtyY2ZhaGtueW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTA2ODIsImV4cCI6MjEwMzIyNjY4Mn0._obn6b1PwHpopuRGTGHK9sd83QFa6KDSem33BzS7Fzk';

/** The table supabase/comments.sql creates. */
export const TABLE = 'dc_comments';

/** The storage bucket it creates alongside, for images attached to comments. */
export const BUCKET = 'comment-images';

/**
 * How often to re-read the table while the sidebar is open, in milliseconds.
 *
 * Polling rather than Supabase Realtime, deliberately. Realtime means a
 * websocket, a channel subscription and a reconnect policy — a few hundred
 * lines of protocol to make a design review feel live. Two reviewers on the
 * same screen see each other's comments within fifteen seconds, and the layer
 * also re-reads the moment a tab regains focus, which covers the case that
 * actually happens: you leave the tab, someone comments, you come back.
 */
export const POLL_MS = 15000;
