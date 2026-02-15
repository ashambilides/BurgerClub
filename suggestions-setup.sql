-- ============================================
-- SUGGESTIONS + RESTAURANT REQUESTS TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- If suggestions table already exists, just create restaurant_requests:
-- (Comment out the suggestions section if you already ran it)

CREATE TABLE IF NOT EXISTS suggestions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    addressed BOOLEAN DEFAULT FALSE,
    addressed_at TIMESTAMPTZ
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Suggestions read" ON suggestions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "Suggestions insert" ON suggestions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "Suggestions update" ON suggestions FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "Suggestions delete" ON suggestions FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Restaurant Requests table
CREATE TABLE IF NOT EXISTS restaurant_requests (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    request TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    addressed BOOLEAN DEFAULT FALSE,
    addressed_at TIMESTAMPTZ
);

ALTER TABLE restaurant_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requests read" ON restaurant_requests FOR SELECT USING (true);
CREATE POLICY "Requests insert" ON restaurant_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Requests update" ON restaurant_requests FOR UPDATE USING (true);
CREATE POLICY "Requests delete" ON restaurant_requests FOR DELETE USING (true);
