-- ============================================================
-- BotMC Phase 3 — Atomic vote RPC (M1, finalizes M2/H3/H1)
-- Requires Phase 2 (ratings.result_id + unique constraints) to be applied first.
-- Run in the Supabase SQL editor.
-- ============================================================

create or replace function public.submit_rating(
    p_result_id     integer,
    p_name          text,
    p_toppings      numeric,
    p_bun           numeric,
    p_doneness      numeric,
    p_flavor        numeric,
    p_burger        text default null,
    p_photo_url     text default null,
    p_gallery_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name      text := btrim(p_name);
    v_rating_id bigint;
begin
    -- Validate the burger exists
    if not exists (select 1 from results where id = p_result_id) then
        return jsonb_build_object('status', 'error', 'message', 'unknown burger');
    end if;

    -- Validate name
    if v_name is null or length(v_name) = 0 then
        return jsonb_build_object('status', 'error', 'message', 'name required');
    end if;

    -- Validate score ranges (1..10)
    if p_toppings is null or p_bun is null or p_doneness is null or p_flavor is null
       or p_toppings < 1 or p_toppings > 10
       or p_bun      < 1 or p_bun      > 10
       or p_doneness < 1 or p_doneness > 10
       or p_flavor   < 1 or p_flavor   > 10 then
        return jsonb_build_object('status', 'error', 'message', 'scores must be between 1 and 10');
    end if;

    -- Duplicate guard (case-insensitive UX; constraint below is the hard guarantee)
    if exists (
        select 1 from ratings
        where result_id = p_result_id and lower(name) = lower(v_name)
    ) then
        return jsonb_build_object('status', 'duplicate');
    end if;

    -- Insert the rating atomically; race-loser hits the unique constraint
    insert into ratings (result_id, burger, name, toppings, bun, doneness, flavor, photo_url, created_at)
    values (p_result_id, p_burger, v_name, p_toppings, p_bun, p_doneness, p_flavor, p_photo_url, now())
    on conflict (result_id, name) do nothing
    returning id into v_rating_id;

    if v_rating_id is null then
        return jsonb_build_object('status', 'duplicate');
    end if;

    -- Record attendance (idempotent)
    insert into attendees (result_id, name)
    values (p_result_id, v_name)
    on conflict (result_id, name) do nothing;

    -- Record the gallery photo here (server-side) so anon needs no direct
    -- gallery insert once RLS is locked down in Phase 4.
    if p_photo_url is not null and length(p_photo_url) > 0 then
        insert into gallery (url, restaurant, caption, uploaded_by, created_at)
        values (p_photo_url, coalesce(p_gallery_label, p_burger),
                'Rated by ' || v_name, v_name, now());
    end if;

    -- Ensure the rater exists as a member (idempotent) so the dropdown stays
    -- populated even after Phase 4 RLS forbids direct anon writes to members.
    insert into members (name) values (v_name)
    on conflict (lower(name)) do nothing;

    -- Recompute this burger's weighted rating: 20% toppings/bun/doneness, 40% flavor
    update results r
    set burger_rating = sub.avg
    from (
        select round((avg(toppings) * 0.20 + avg(bun) * 0.20
                    + avg(doneness) * 0.20 + avg(flavor) * 0.40)::numeric, 2) as avg
        from ratings where result_id = p_result_id
    ) sub
    where r.id = p_result_id;

    -- Recompute ALL rankings in one shot: rated by rating desc, then unrated, stable by id
    with ordered as (
        select id,
               row_number() over (
                   order by (burger_rating is null), burger_rating desc nulls last, id asc
               ) as rn
        from results
    )
    update results res
    set ranking = ordered.rn
    from ordered
    where res.id = ordered.id
      and res.ranking is distinct from ordered.rn;

    return jsonb_build_object('status', 'ok', 'result_id', p_result_id);
end;
$$;

-- anon is the public voter; authenticated is the admin. Both may submit.
grant execute on function public.submit_rating(integer, text, numeric, numeric, numeric, numeric, text, text, text)
    to anon, authenticated;
