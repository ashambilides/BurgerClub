-- ============================================================
-- BotMC Phase 2 — Stable result_id join (H1) + unique constraints (M2)
-- Run this in the Supabase SQL editor. Idempotent where practical.
-- Safe to run while the current (label-matching) app.js is live.
-- ============================================================

-- 1) Add a stable result_id foreign key to ratings (H1) -------------
alter table public.ratings
    add column if not exists result_id integer references public.results(id);

-- 2) Backfill result_id from the existing fuzzy-label logic ----------
--    Mirrors matchesBurgerLabel(): exact OR prefix (truncated labels).
--    The em dash here is U+2014 — matches the labels app.js builds.
update public.ratings r
set result_id = res.id
from public.results res
where r.result_id is null
  and (
        r.burger = res.restaurant || ' — ' || res.description
     or (length(regexp_replace(r.burger, '\.+$', '')) >= 5
         and starts_with(res.restaurant || ' — ' || res.description,
                         regexp_replace(r.burger, '\.+$', '')))
     or (length(regexp_replace(res.restaurant || ' — ' || res.description, '\.+$', '')) >= 5
         and starts_with(r.burger,
                         regexp_replace(res.restaurant || ' — ' || res.description, '\.+$', '')))
      );

-- VERIFY: rows that did not match any burger (investigate before relying on joins).
-- select id, burger, name from public.ratings where result_id is null;

-- 3) De-duplicate BEFORE adding unique constraints (M2) -------------
-- ratings: keep the earliest row per (result_id, name)
delete from public.ratings a
using public.ratings b
where a.result_id is not null
  and a.result_id = b.result_id
  and a.name = b.name
  and a.id > b.id;

-- members: keep the earliest row per case-insensitive name
delete from public.members a
using public.members b
where lower(a.name) = lower(b.name)
  and a.id > b.id;

-- attendees: keep the earliest row per (result_id, name)
delete from public.attendees a
using public.attendees b
where a.result_id = b.result_id
  and a.name = b.name
  and a.id > b.id;

-- 4) Add the unique constraints / indexes (M2) ----------------------
do $$ begin
    alter table public.ratings add constraint ratings_result_name_uniq unique (result_id, name);
exception when duplicate_table or duplicate_object then null; end $$;

do $$ begin
    alter table public.attendees add constraint attendees_result_name_uniq unique (result_id, name);
exception when duplicate_table or duplicate_object then null; end $$;

create unique index if not exists members_name_lower_uniq on public.members (lower(name));
