-- ===========================================================================
-- THE REVIEW COMMENT LAYER — one table.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). It is written to be re-runnable: every statement
-- either guards itself with IF NOT EXISTS or drops what it is about to make,
-- so pasting it a second time after an edit is safe.
--
-- A THREAD IS NOT A SEPARATE TABLE. A root comment is a row with parent_id
-- NULL; a reply is a row whose parent_id points at that root. One table means
-- one fetch, one policy set, and no join to keep in step — and the prototype
-- never needs a thread that is deeper than one reply level, which is what the
-- reviewed design does too.
--
-- ANCHORING lives in the `anchor` JSON column rather than in columns of its
-- own, because it is read and written only by the client that understands it
-- (js/lib/comments/anchor.js) and its shape will change as that file learns
-- new tricks. Postgres should not have to be migrated because a fallback
-- coordinate got a better name.
-- ===========================================================================

create extension if not exists "pgcrypto";

create table if not exists public.dc_comments (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- WHICH SCREEN. The whole point of the feature: a comment left on the
  -- scheduler must not appear over the chart. Written by the client as
  -- "ehr:scheduler" / "patient:home" — the product, then the page.
  screen_key   text        not null,
  -- What to call that screen in the sidebar when the reader is somewhere
  -- else. Denormalised on purpose: there is no screens table to join to.
  screen_label text,
  page_url     text,

  -- NULL for a root comment, the root's id for a reply.
  parent_id    uuid        references public.dc_comments (id) on delete cascade,

  author       text        not null,
  body         text        not null,

  -- { selector, view, rx, ry, corner, ox, oy, x, y, docW, label } — see
  -- js/lib/comments/anchor.js. `view` is which tabs were open when the
  -- comment was written, and is why a comment left on one module of the
  -- patient chart does not appear over another: they share a screen_key,
  -- because they share an .html file.
  anchor       jsonb,

  resolved     boolean     not null default false,
  resolved_at  timestamptz,
  resolved_by  text
);

-- The two reads the client actually makes: "everything on this screen, oldest
-- first" and "the replies under this root".
create index if not exists dc_comments_screen_idx on public.dc_comments (screen_key, created_at);
create index if not exists dc_comments_parent_idx on public.dc_comments (parent_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- READ THIS BEFORE YOU PUT ANYTHING REAL IN HERE.
--
-- These policies are deliberately wide open: anyone holding the publishable
-- key — which ships in js/lib/comments/config.js and is therefore visible to
-- anyone who opens the prototype — can read, write, edit and delete every
-- comment. That is the correct trade for a design-review tool where the
-- reviewers do not have accounts and the "identity" is a name typed into a
-- box. It is the wrong trade for anything else.
--
-- So: no patient data, no credentials, no anything you would mind a stranger
-- reading, in a comment. If this layer ever outlives the review, put Supabase
-- Auth in front of it and narrow these policies to auth.uid().
-- ---------------------------------------------------------------------------
alter table public.dc_comments enable row level security;

drop policy if exists "dc_comments read"   on public.dc_comments;
drop policy if exists "dc_comments insert" on public.dc_comments;
drop policy if exists "dc_comments update" on public.dc_comments;
drop policy if exists "dc_comments delete" on public.dc_comments;

create policy "dc_comments read"
  on public.dc_comments for select
  to anon, authenticated
  using (true);

create policy "dc_comments insert"
  on public.dc_comments for insert
  to anon, authenticated
  with check (true);

create policy "dc_comments update"
  on public.dc_comments for update
  to anon, authenticated
  using (true) with check (true);

create policy "dc_comments delete"
  on public.dc_comments for delete
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- IMAGES
--
-- A reviewer's most useful comment is often a picture: the misaligned thing,
-- circled. Two parts to that.
--
-- The column holds an ARRAY OF REFERENCES, not the pictures themselves —
-- [{ url, name, w, h }, …]. Every read of this table fetches every column of
-- every row, so an image inlined here would be downloaded again on every poll
-- by every reviewer, whether or not anyone opened the thread it belongs to.
-- A URL is forty bytes and the browser caches what it points at.
--
-- The bucket is where the pictures actually go. Public read, because the
-- comments themselves are already readable by anyone with the link — a bucket
-- that was stricter than the table it serves would only mean broken images.
-- Same warning as above applies twice over: nothing confidential in a
-- screenshot.
-- ---------------------------------------------------------------------------

alter table public.dc_comments add column if not exists images jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('comment-images', 'comment-images', true, 10485760)
on conflict (id) do update
  set public = true, file_size_limit = 10485760;

drop policy if exists "dc images read"   on storage.objects;
drop policy if exists "dc images insert" on storage.objects;
drop policy if exists "dc images delete" on storage.objects;

create policy "dc images read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'comment-images');

create policy "dc images insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'comment-images');

create policy "dc images delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'comment-images');
