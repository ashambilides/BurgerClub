-- ============================================
-- FIX ATTENDEE ROUTING BUG
-- Add active_burger_ranking column to form_config
-- ============================================

-- Add the new column to store ranking ID
ALTER TABLE form_config ADD COLUMN IF NOT EXISTS active_burger_ranking INT;

-- Verify the change
SELECT id, is_open, active_burger, active_burger_ranking FROM form_config;
