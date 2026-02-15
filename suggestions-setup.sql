-- ============================================
-- SUGGESTIONS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE suggestions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    addressed BOOLEAN DEFAULT FALSE,
    addressed_at TIMESTAMPTZ
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggestions read" ON suggestions FOR SELECT USING (true);
CREATE POLICY "Suggestions insert" ON suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Suggestions update" ON suggestions FOR UPDATE USING (true);
CREATE POLICY "Suggestions delete" ON suggestions FOR DELETE USING (true);
