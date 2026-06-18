-- ============================================================
-- ZERO-RESIDUE VOTE SELF-TEST
-- Proves a real vote works end-to-end: every insert (ratings, attendees,
-- gallery, members), every ON CONFLICT arbiter, the SECURITY DEFINER write
-- path, and the rating+ranking recompute — all exercised, then ROLLED BACK.
-- Nothing is left in the database. Run the whole thing in the Supabase SQL editor.
-- ============================================================

begin;

-- Run the voting function AS THE PUBLIC ROLE (the real path a member hits).
-- If "set local role anon" errors in your editor, delete that line + the reset
-- and it still tests every table write (just not the RLS-bypass aspect).
set local role anon;

select public.submit_rating(
    p_result_id     => (select id from public.results order by id limit 1),
    p_name          => '__selftest_delete_me__',
    p_toppings      => 6, p_bun => 6, p_doneness => 6, p_flavor => 6,
    p_burger        => 'SELF TEST',
    p_photo_url     => 'https://yezihsgtccwitfwgwudv.supabase.co/storage/v1/object/public/photos/selftest.jpg',
    p_gallery_label => 'SELF TEST'
) as rpc_result;   -- EXPECT: {"status": "ok", "result_id": ...}

reset role;

-- Confirm every side-write landed (these SELECTs see the not-yet-committed rows).
-- EXPECT every count = 1.
select 'ratings'   as tbl, count(*) as n from public.ratings   where name    = '__selftest_delete_me__'
union all
select 'attendees', count(*)         from public.attendees where name    = '__selftest_delete_me__'
union all
select 'members',   count(*)         from public.members   where name    = '__selftest_delete_me__'
union all
select 'gallery',   count(*)         from public.gallery   where caption  = 'Rated by __selftest_delete_me__';

rollback;   -- undo EVERYTHING — database is left exactly as it was

-- If the SELECT submit_rating(...) line errored instead of returning {"status":"ok"},
-- the error text names the exact problem (missing unique index for an ON CONFLICT,
-- a NOT NULL column, or a denied write). Send it over and it's a one-line fix.
