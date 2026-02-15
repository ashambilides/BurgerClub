-- ============================================
-- ADD ATTENDEES TRACKING
-- Run this in Supabase SQL Editor
-- ============================================

-- Create attendees table to link raters to burgers
CREATE TABLE IF NOT EXISTS attendees (
    id BIGSERIAL PRIMARY KEY,
    burger_id INT NOT NULL,           -- ranking number from results table
    name TEXT NOT NULL,
    rating_id BIGINT,                 -- optional: link to specific rating
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Attendees read" ON attendees;
DROP POLICY IF EXISTS "Attendees insert" ON attendees;
DROP POLICY IF EXISTS "Attendees update" ON attendees;
DROP POLICY IF EXISTS "Attendees delete" ON attendees;

CREATE POLICY "Attendees read" ON attendees FOR SELECT USING (true);
CREATE POLICY "Attendees insert" ON attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "Attendees update" ON attendees FOR UPDATE USING (true);
CREATE POLICY "Attendees delete" ON attendees FOR DELETE USING (true);

-- Verify
SELECT * FROM attendees;
