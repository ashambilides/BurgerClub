-- ============================================
-- FINAL FIX: Run this ONCE in Supabase SQL Editor
-- Fixes: Gallery upload 403, lat/lng columns, rankings
-- ============================================

-- ============================
-- FIX 1: Storage upload policies
-- The 403 error is because storage.objects has RLS
-- and needs policies to allow uploads
-- ============================

-- Remove any existing storage policies for photos bucket
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
DROP POLICY IF EXISTS "photos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "photos_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "photos_public_update" ON storage.objects;
DROP POLICY IF EXISTS "photos_public_delete" ON storage.objects;

-- Create policies that allow anyone to upload/read/delete from photos bucket
CREATE POLICY "photos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "photos_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "photos_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'photos');

CREATE POLICY "photos_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');

-- ============================
-- FIX 2: Add lat/lng columns to results
-- ============================

ALTER TABLE results ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE results ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Backfill existing entries with coordinates
UPDATE results SET lat = 40.7020, lng = -73.9037 WHERE lower(trim(location)) LIKE '%onderdonk%';
UPDATE results SET lat = 40.6780, lng = -74.0120 WHERE lower(trim(location)) LIKE '%van brunt%';
UPDATE results SET lat = 40.7275, lng = -73.9853 WHERE lower(trim(location)) LIKE '%132 1st ave%';
UPDATE results SET lat = 40.7228, lng = -73.9834 WHERE lower(trim(location)) LIKE '%east 3rd st%';
UPDATE results SET lat = 40.7263, lng = -74.0021 WHERE lower(trim(location)) LIKE '%180 prince st%';
UPDATE results SET lat = 40.7179, lng = -74.0021 WHERE lower(trim(location)) LIKE '%cortlandt alley%';
UPDATE results SET lat = 40.7325, lng = -74.0037 WHERE lower(trim(location)) LIKE '%305 bleecker%';
UPDATE results SET lat = 40.7101, lng = -73.9631 WHERE lower(trim(location)) LIKE '%178 broadway%';
UPDATE results SET lat = 40.7169, lng = -73.9430 WHERE lower(trim(location)) LIKE '%humboldt%';
UPDATE results SET lat = 40.7300, lng = -74.0006 WHERE lower(trim(location)) LIKE '%113 macdougal%';
UPDATE results SET lat = 40.7279, lng = -74.0009 WHERE lower(trim(location)) LIKE '%155 w houston%';
UPDATE results SET lat = 40.7199, lng = -73.9876 WHERE lower(trim(location)) LIKE '%131 essex%';
UPDATE results SET lat = 40.7037, lng = -73.9226 WHERE lower(trim(location)) LIKE '%436 jefferson%';
UPDATE results SET lat = 40.7384, lng = -74.0040 WHERE lower(trim(location)) LIKE '%51-63 8th ave%';
UPDATE results SET lat = 40.7343, lng = -74.0031 WHERE lower(trim(location)) LIKE '%234 west 4th%';
UPDATE results SET lat = 40.7460, lng = -73.9531 WHERE lower(trim(location)) LIKE '%vernon blvd%';
UPDATE results SET lat = 40.7184, lng = -73.9944 WHERE lower(trim(location)) LIKE '%242 grand%';
UPDATE results SET lat = 40.7711, lng = -73.9595 WHERE lower(trim(location)) LIKE '%1291 3rd ave%';
UPDATE results SET lat = 40.7381, lng = -74.0038 WHERE lower(trim(location)) LIKE '%331 w 4th%';

-- ============================
-- FIX 3: Ensure all table RLS policies exist
-- ============================

-- Gallery
DROP POLICY IF EXISTS "Gallery read" ON gallery;
DROP POLICY IF EXISTS "Gallery insert" ON gallery;
DROP POLICY IF EXISTS "Gallery update" ON gallery;
DROP POLICY IF EXISTS "Gallery delete" ON gallery;
CREATE POLICY "Gallery read" ON gallery FOR SELECT USING (true);
CREATE POLICY "Gallery insert" ON gallery FOR INSERT WITH CHECK (true);
CREATE POLICY "Gallery update" ON gallery FOR UPDATE USING (true);
CREATE POLICY "Gallery delete" ON gallery FOR DELETE USING (true);

-- Results
DROP POLICY IF EXISTS "Results read" ON results;
DROP POLICY IF EXISTS "Results insert" ON results;
DROP POLICY IF EXISTS "Results update" ON results;
DROP POLICY IF EXISTS "Results delete" ON results;
CREATE POLICY "Results read" ON results FOR SELECT USING (true);
CREATE POLICY "Results insert" ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "Results update" ON results FOR UPDATE USING (true);
CREATE POLICY "Results delete" ON results FOR DELETE USING (true);

-- Ratings
DROP POLICY IF EXISTS "Ratings read" ON ratings;
DROP POLICY IF EXISTS "Ratings insert" ON ratings;
DROP POLICY IF EXISTS "Ratings update" ON ratings;
DROP POLICY IF EXISTS "Ratings delete" ON ratings;
CREATE POLICY "Ratings read" ON ratings FOR SELECT USING (true);
CREATE POLICY "Ratings insert" ON ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Ratings update" ON ratings FOR UPDATE USING (true);
CREATE POLICY "Ratings delete" ON ratings FOR DELETE USING (true);

-- Burgers
DROP POLICY IF EXISTS "Burgers read" ON burgers;
DROP POLICY IF EXISTS "Burgers insert" ON burgers;
DROP POLICY IF EXISTS "Burgers update" ON burgers;
DROP POLICY IF EXISTS "Burgers delete" ON burgers;
CREATE POLICY "Burgers read" ON burgers FOR SELECT USING (true);
CREATE POLICY "Burgers insert" ON burgers FOR INSERT WITH CHECK (true);
CREATE POLICY "Burgers update" ON burgers FOR UPDATE USING (true);
CREATE POLICY "Burgers delete" ON burgers FOR DELETE USING (true);

-- Form config
DROP POLICY IF EXISTS "Config read" ON form_config;
DROP POLICY IF EXISTS "Config insert" ON form_config;
DROP POLICY IF EXISTS "Config update" ON form_config;
DROP POLICY IF EXISTS "Config delete" ON form_config;
CREATE POLICY "Config read" ON form_config FOR SELECT USING (true);
CREATE POLICY "Config insert" ON form_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Config update" ON form_config FOR UPDATE USING (true);
CREATE POLICY "Config delete" ON form_config FOR DELETE USING (true);

-- Suggestions
DROP POLICY IF EXISTS "Suggestions read" ON suggestions;
DROP POLICY IF EXISTS "Suggestions insert" ON suggestions;
DROP POLICY IF EXISTS "Suggestions update" ON suggestions;
DROP POLICY IF EXISTS "Suggestions delete" ON suggestions;
CREATE POLICY "Suggestions read" ON suggestions FOR SELECT USING (true);
CREATE POLICY "Suggestions insert" ON suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Suggestions update" ON suggestions FOR UPDATE USING (true);
CREATE POLICY "Suggestions delete" ON suggestions FOR DELETE USING (true);

-- Restaurant requests
DROP POLICY IF EXISTS "Requests read" ON restaurant_requests;
DROP POLICY IF EXISTS "Requests insert" ON restaurant_requests;
DROP POLICY IF EXISTS "Requests update" ON restaurant_requests;
DROP POLICY IF EXISTS "Requests delete" ON restaurant_requests;
CREATE POLICY "Requests read" ON restaurant_requests FOR SELECT USING (true);
CREATE POLICY "Requests insert" ON restaurant_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Requests update" ON restaurant_requests FOR UPDATE USING (true);
CREATE POLICY "Requests delete" ON restaurant_requests FOR DELETE USING (true);

-- ============================
-- VERIFY: Show results with lat/lng
-- ============================
SELECT ranking, restaurant, burger_rating, location, lat, lng FROM results ORDER BY ranking;
