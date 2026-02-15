-- Add lat/lng columns to results table for map pins
-- Run this in Supabase SQL Editor

-- Step 1: Add columns (safe to run multiple times)
ALTER TABLE results ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE results ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Step 2: Backfill all existing entries with correct coordinates
-- These match the ADDRESS_COORDS from the original code

UPDATE results SET lat = 40.7020, lng = -73.9037
WHERE lower(trim(location)) LIKE '%onderdonk%';

UPDATE results SET lat = 40.6780, lng = -74.0120
WHERE lower(trim(location)) LIKE '%van brunt%';

UPDATE results SET lat = 40.7275, lng = -73.9853
WHERE lower(trim(location)) LIKE '%132 1st ave%';

UPDATE results SET lat = 40.7228, lng = -73.9834
WHERE lower(trim(location)) LIKE '%east 3rd st%';

UPDATE results SET lat = 40.7263, lng = -74.0021
WHERE lower(trim(location)) LIKE '%180 prince st%';

UPDATE results SET lat = 40.7179, lng = -74.0021
WHERE lower(trim(location)) LIKE '%cortlandt alley%';

UPDATE results SET lat = 40.7325, lng = -74.0037
WHERE lower(trim(location)) LIKE '%305 bleecker%';

UPDATE results SET lat = 40.7101, lng = -73.9631
WHERE lower(trim(location)) LIKE '%178 broadway%';

UPDATE results SET lat = 40.7169, lng = -73.9430
WHERE lower(trim(location)) LIKE '%humboldt%';

UPDATE results SET lat = 40.7300, lng = -74.0006
WHERE lower(trim(location)) LIKE '%113 macdougal%';

UPDATE results SET lat = 40.7279, lng = -74.0009
WHERE lower(trim(location)) LIKE '%155 w houston%';

UPDATE results SET lat = 40.7199, lng = -73.9876
WHERE lower(trim(location)) LIKE '%131 essex%';

UPDATE results SET lat = 40.7037, lng = -73.9226
WHERE lower(trim(location)) LIKE '%436 jefferson%';

UPDATE results SET lat = 40.7384, lng = -74.0040
WHERE lower(trim(location)) LIKE '%51-63 8th ave%';

UPDATE results SET lat = 40.7343, lng = -74.0031
WHERE lower(trim(location)) LIKE '%234 west 4th%';

UPDATE results SET lat = 40.7460, lng = -73.9531
WHERE lower(trim(location)) LIKE '%vernon blvd%';

UPDATE results SET lat = 40.7184, lng = -73.9944
WHERE lower(trim(location)) LIKE '%242 grand%';

UPDATE results SET lat = 40.7711, lng = -73.9595
WHERE lower(trim(location)) LIKE '%1291 3rd ave%';

UPDATE results SET lat = 40.7381, lng = -74.0038
WHERE lower(trim(location)) LIKE '%331 w 4th%';

-- Verify: show all entries and their lat/lng
SELECT ranking, restaurant, location, lat, lng FROM results ORDER BY ranking;
