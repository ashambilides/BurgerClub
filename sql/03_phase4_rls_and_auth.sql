-- ============================================================
-- BotMC Phase 4 — RLS lockdown + retire admin_hash (C1)
-- THE BREAKING CUTOVER. Apply ONLY after:
--   * Phases 2 & 3 SQL are applied, and
--   * a Supabase Auth admin user exists (see DASHBOARD STEPS below), and
--   * the Phase 4 app.js (GoTrue login + Bearer-token writes) is ready to deploy.
-- Voting keeps working because it goes through submit_rating() (SECURITY DEFINER,
-- which bypasses RLS). Admin writes work because the JWT maps to `authenticated`.
-- ============================================================

-- ---------- DASHBOARD STEPS (do these in the Supabase UI first) ----------
--  1. Authentication > Providers: ensure Email is enabled; disable "Confirm email"
--     (or pre-confirm the admin) so the password grant returns a token immediately.
--  2. Authentication > Users > Add user: create the single admin
--     (e.g. admin@botmc.local) with a strong password. This replaces the old
--     client-side SHA-256 gate entirely.
--  3. (Recommended) Authentication > Providers: turn OFF "Allow new users to sign up"
--     so anon cannot self-register.
-- -------------------------------------------------------------------------

-- 1) Retire the obsolete, publicly-readable password hash --------------
alter table public.form_config drop column if exists admin_hash;

-- 2) Enable RLS on every table ----------------------------------------
alter table public.results              enable row level security;
alter table public.ratings             enable row level security;
alter table public.attendees           enable row level security;
alter table public.members             enable row level security;
alter table public.form_config         enable row level security;
alter table public.gallery             enable row level security;
alter table public.suggestions         enable row level security;
alter table public.restaurant_requests enable row level security;

-- 3) Drop any pre-existing wide-open policies (USING true) -------------
--    Adjust names if your project used different ones; list them with:
--    select schemaname, tablename, policyname from pg_policies where schemaname='public';
do $$
declare p record;
begin
    for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
        execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
    end loop;
end $$;

-- 4) Public read of non-secret data -----------------------------------
create policy anon_read_results    on public.results              for select using (true);
create policy anon_read_ratings    on public.ratings             for select using (true);
create policy anon_read_attendees  on public.attendees           for select using (true);
create policy anon_read_members    on public.members             for select using (true);
create policy anon_read_gallery    on public.gallery             for select using (true);
create policy anon_read_config     on public.form_config         for select using (true);
create policy anon_read_suggest    on public.suggestions         for select using (true);
create policy anon_read_requests   on public.restaurant_requests for select using (true);

-- 5) Public INSERT only where the public legitimately writes ----------
--    (ratings & attendees are written ONLY via submit_rating(), so no anon
--     insert policy is needed or wanted on them.)
create policy anon_add_suggestion  on public.suggestions         for insert with check (true);
create policy anon_add_request     on public.restaurant_requests for insert with check (true);

-- 6) Admin (authenticated) gets full write on everything --------------
do $$
declare t text;
begin
    foreach t in array array[
        'results','ratings','attendees','members',
        'form_config','gallery','suggestions','restaurant_requests'
    ] loop
        execute format($f$
            create policy admin_all_%1$s on public.%1$s
                for all to authenticated using (true) with check (true)
        $f$, t);
    end loop;
end $$;

-- 7) Storage: photos bucket — public read, anon insert, no overwrite/delete
--    (bucket assumed public. Remove the old permissive policies first.)
do $$
declare p record;
begin
    for p in select policyname from pg_policies
             where schemaname = 'storage' and tablename = 'objects' loop
        execute format('drop policy if exists %I on storage.objects', p.policyname);
    end loop;
end $$;

create policy photos_public_read on storage.objects
    for select using (bucket_id = 'photos');
create policy photos_anon_insert on storage.objects
    for insert with check (bucket_id = 'photos');
create policy photos_admin_write on storage.objects
    for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');
create policy photos_admin_delete on storage.objects
    for delete to authenticated using (bucket_id = 'photos');

-- VERIFY after applying (all should be denied for anon):
--   PATCH /rest/v1/results?id=eq.1      -> 401/empty
--   DELETE /rest/v1/form_config?id=eq.1 -> 401/empty
--   GET  /rest/v1/form_config (admin_hash column no longer exists)
