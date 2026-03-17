-- ============================================
-- MIGRATION: Stable result_id for attendees
-- ============================================
-- This fixes the data corruption bug where attendees.burger_id
-- stored the mutable ranking number, causing names to drift
-- to wrong burgers when rankings shifted.
--
-- Run this BEFORE deploying the updated app.js code.
-- ============================================

-- Step 1: Add stable result_id column to attendees
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS result_id INT;

-- Step 2: Backfill result_id from current data
-- (burger_id currently stores the ranking number)
UPDATE attendees a
SET result_id = r.id
FROM results r
WHERE r.ranking = a.burger_id;

-- Step 3: Check for orphaned attendees (should return 0 rows)
-- If any rows appear here, they need manual investigation
SELECT id, burger_id, name, created_at
FROM attendees
WHERE result_id IS NULL;

-- Step 4: Add stable result_id column to form_config
ALTER TABLE form_config ADD COLUMN IF NOT EXISTS active_burger_result_id INT;

-- Step 5: Backfill form_config if a burger is currently active
UPDATE form_config fc
SET active_burger_result_id = r.id
FROM results r
WHERE r.ranking = fc.active_burger_ranking
  AND fc.active_burger_ranking IS NOT NULL;

-- Step 6: Enable RLS policies for new columns (same as existing)
-- No additional RLS needed - existing table-level policies cover all columns

-- ============================================
-- VERIFICATION: Run this to confirm the migration worked
-- ============================================
-- SELECT a.id, a.name, a.burger_id, a.result_id, r.restaurant, r.ranking
-- FROM attendees a
-- LEFT JOIN results r ON r.id = a.result_id
-- ORDER BY r.ranking, a.name;
