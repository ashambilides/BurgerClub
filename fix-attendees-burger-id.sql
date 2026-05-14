-- ============================================
-- FIX ATTENDEES TABLE
-- Run this in Supabase SQL Editor
-- ============================================
--
-- Problem: the attendees.burger_id column is NOT NULL, but the codebase
-- migrated to result_id and stopped sending burger_id. Every auto-attendee
-- insert from the rating form has been silently rejected since that change,
-- so attendee rows stopped being created (last successful insert: 2026-03-18).
-- The display still works because loadAttendeesData also derives names from
-- the ratings table, but the attendees table itself is stale.
--
-- Fix: drop the NOT NULL on burger_id (it's now legacy), then backfill rows
-- for every rating that should have produced an attendee.

-- 1. Allow burger_id to be NULL (column kept for legacy data; new inserts
--    use result_id only).
ALTER TABLE attendees ALTER COLUMN burger_id DROP NOT NULL;

-- 2. Backfill attendees from existing ratings. Match on the full label first;
--    fall back to truncated-label match (rating.burger ends in "..." and the
--    full label starts with the same prefix).
INSERT INTO attendees (result_id, name)
SELECT DISTINCT r.id, ra.name
FROM ratings ra
JOIN results r ON (
    ra.burger = r.restaurant || ' — ' || r.description
    OR (
        ra.burger LIKE '%...'
        AND (r.restaurant || ' — ' || r.description) LIKE REPLACE(ra.burger, '...', '%')
    )
)
WHERE NOT EXISTS (
    SELECT 1 FROM attendees a
    WHERE a.result_id = r.id AND a.name = ra.name
);

-- 3. Sanity check: how many attendees per recent burger after backfill.
SELECT r.id, r.restaurant, COUNT(a.id) AS attendee_count
FROM results r
LEFT JOIN attendees a ON a.result_id = r.id
WHERE r.id >= 33
GROUP BY r.id, r.restaurant
ORDER BY r.id DESC;
