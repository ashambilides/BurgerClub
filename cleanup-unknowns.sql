-- ============================================
-- CLEANUP OLD UNKNOWN PLACEHOLDERS
-- Delete all "Unknown" entries so they can be recreated with correct counts
-- ============================================

-- Delete all attendees with names starting with "Unknown "
DELETE FROM attendees WHERE name LIKE 'Unknown %';

-- Verify deletion
SELECT COUNT(*) as remaining_unknowns FROM attendees WHERE name LIKE 'Unknown %';
