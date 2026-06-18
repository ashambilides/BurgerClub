-- ============================================================
-- BotMC — Hardened submit_rating (reliability)
-- Drop-in replacement for the function in 02_phase3_submit_rating_rpc.sql.
-- Same behaviour, but BULLETPROOFED so a real rating can never be lost:
--   * The rating insert no longer depends on a unique constraint existing
--     (the duplicate pre-check handles dupes), so a missing index can't break votes.
--   * Attendance, photo (gallery) and new-member writes are each wrapped so a
--     failure in any of them is ignored instead of rolling back the whole vote.
--   * The rating + score/ranking recompute remain strict (that's the contract).
-- Run the whole file in the Supabase SQL editor.
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
    v_name text := btrim(p_name);
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

    -- Duplicate guard (case-insensitive). One rating per person per burger.
    if exists (
        select 1 from ratings
        where result_id = p_result_id and lower(name) = lower(v_name)
    ) then
        return jsonb_build_object('status', 'duplicate');
    end if;

    -- CORE: insert the rating. Plain insert (the pre-check above handles dupes),
    -- so this does not depend on any unique constraint being present.
    insert into ratings (result_id, burger, name, toppings, bun, doneness, flavor, photo_url, created_at)
    values (p_result_id, p_burger, v_name, p_toppings, p_bun, p_doneness, p_flavor, p_photo_url, now());

    -- BEST-EFFORT: attendance. A failure here must not lose the rating.
    begin
        insert into attendees (result_id, name) values (p_result_id, v_name)
        on conflict (result_id, name) do nothing;
    exception when others then null;
    end;

    -- BEST-EFFORT: gallery photo (only when one was uploaded).
    if p_photo_url is not null and length(p_photo_url) > 0 then
        begin
            insert into gallery (url, restaurant, caption, uploaded_by, created_at)
            values (p_photo_url, coalesce(p_gallery_label, p_burger),
                    'Rated by ' || v_name, v_name, now());
        exception when others then null;
        end;
    end if;

    -- BEST-EFFORT: keep the member dropdown populated.
    begin
        insert into members (name) values (v_name)
        on conflict (lower(name)) do nothing;
    exception when others then null;
    end;

    -- CORE: recompute this burger's weighted rating (20/20/20/40).
    update results r
    set burger_rating = sub.avg
    from (
        select round((avg(toppings) * 0.20 + avg(bun) * 0.20
                    + avg(doneness) * 0.20 + avg(flavor) * 0.40)::numeric, 2) as avg
        from ratings where result_id = p_result_id
    ) sub
    where r.id = p_result_id;

    -- CORE: recompute ALL rankings (rated desc, then unrated, stable by id).
    with ordered as (
        select id, row_number() over (
            order by (burger_rating is null), burger_rating desc nulls last, id asc
        ) as rn
        from results
    )
    update results res set ranking = ordered.rn
    from ordered
    where res.id = ordered.id and res.ranking is distinct from ordered.rn;

    return jsonb_build_object('status', 'ok', 'result_id', p_result_id);
end;
$$;

grant execute on function public.submit_rating(integer, text, numeric, numeric, numeric, numeric, text, text, text)
    to anon, authenticated;
