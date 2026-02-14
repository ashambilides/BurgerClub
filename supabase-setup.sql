-- ============================================
-- BOTMC SUPABASE SETUP
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. Gallery table (stores photo metadata)
CREATE TABLE gallery (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    restaurant TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ratings table (stores member ratings)
CREATE TABLE ratings (
    id BIGSERIAL PRIMARY KEY,
    burger TEXT NOT NULL,
    name TEXT NOT NULL,
    toppings NUMERIC,
    bun NUMERIC,
    doneness NUMERIC,
    flavor NUMERIC,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Burgers table (admin-added burgers)
CREATE TABLE burgers (
    id BIGSERIAL PRIMARY KEY,
    restaurant TEXT NOT NULL,
    description TEXT,
    price TEXT,
    location TEXT,
    date_of_visit TEXT,
    lat NUMERIC,
    lng NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Form config table (controls form open/close state)
CREATE TABLE form_config (
    id INT PRIMARY KEY DEFAULT 1,
    is_open BOOLEAN DEFAULT FALSE,
    active_burger TEXT,
    admin_hash TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config row
INSERT INTO form_config (id, is_open, active_burger, admin_hash)
VALUES (1, false, null, null);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE burgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_config ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Gallery: anyone can read, authenticated can insert
CREATE POLICY "Gallery read" ON gallery FOR SELECT USING (true);
CREATE POLICY "Gallery insert" ON gallery FOR INSERT WITH CHECK (true);
CREATE POLICY "Gallery delete" ON gallery FOR DELETE USING (true);

-- Ratings: anyone can read and insert (public form)
CREATE POLICY "Ratings read" ON ratings FOR SELECT USING (true);
CREATE POLICY "Ratings insert" ON ratings FOR INSERT WITH CHECK (true);

-- Burgers: anyone can read, insert for admin
CREATE POLICY "Burgers read" ON burgers FOR SELECT USING (true);
CREATE POLICY "Burgers insert" ON burgers FOR INSERT WITH CHECK (true);

-- Form config: anyone can read, update for admin
CREATE POLICY "Config read" ON form_config FOR SELECT USING (true);
CREATE POLICY "Config update" ON form_config FOR UPDATE USING (true);

-- ============================================
-- STORAGE SETUP
-- ============================================
-- After running this SQL, also do these steps in the Supabase dashboard:
--
-- 1. Go to Storage in the left sidebar
-- 2. Click "New Bucket"
-- 3. Name it: photos
-- 4. Toggle "Public bucket" ON
-- 5. Click "Create bucket"
--
-- That's it! The app will upload photos to this bucket.
