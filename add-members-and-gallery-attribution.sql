-- ============================================
-- ADD MEMBERS TABLE + GALLERY PHOTO ATTRIBUTION
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create members table (canonical list of club members)
CREATE TABLE IF NOT EXISTS members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read" ON members FOR SELECT USING (true);
CREATE POLICY "Members insert" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Members update" ON members FOR UPDATE USING (true);
CREATE POLICY "Members delete" ON members FOR DELETE USING (true);

-- 2. Seed members from existing attendees (non-Unknown names)
INSERT INTO members (name)
SELECT DISTINCT name FROM attendees
WHERE name NOT LIKE 'Unknown %'
ON CONFLICT (name) DO NOTHING;

-- 3. Also seed from ratings table (in case there are names not in attendees)
INSERT INTO members (name)
SELECT DISTINCT name FROM ratings
WHERE name IS NOT NULL AND name != ''
ON CONFLICT (name) DO NOTHING;

-- 4. Add uploaded_by column to gallery table
ALTER TABLE gallery ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

-- 5. Backfill uploaded_by from existing captions that say "Rated by [name]"
UPDATE gallery
SET uploaded_by = SUBSTRING(caption FROM 'Rated by (.+)')
WHERE caption LIKE 'Rated by %' AND uploaded_by IS NULL;

-- Verify
SELECT * FROM members ORDER BY name;
SELECT id, restaurant, caption, uploaded_by FROM gallery ORDER BY created_at DESC LIMIT 10;
