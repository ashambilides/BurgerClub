-- Fix Storage Bucket Policies for Gallery Uploads
-- This fixes the 403 error when uploading photos

-- First, make sure the photos bucket exists and is public
-- Run this in Supabase SQL Editor:

-- Create the bucket if it doesn't exist (this will fail silently if it exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Delete all existing policies for the photos bucket
DELETE FROM storage.policies WHERE bucket_id = 'photos';

-- Create new policies that allow public uploads
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES
  ('photos', 'Public Access', 'true'),
  ('photos', 'Allow public uploads', 'true'),
  ('photos', 'Allow public reads', 'true'),
  ('photos', 'Allow public updates', 'true'),
  ('photos', 'Allow public deletes', 'true');

-- Also fix the gallery table RLS policies
DROP POLICY IF EXISTS "Gallery read" ON gallery;
DROP POLICY IF EXISTS "Gallery insert" ON gallery;
DROP POLICY IF EXISTS "Gallery update" ON gallery;
DROP POLICY IF EXISTS "Gallery delete" ON gallery;

CREATE POLICY "Gallery read" ON gallery FOR SELECT USING (true);
CREATE POLICY "Gallery insert" ON gallery FOR INSERT WITH CHECK (true);
CREATE POLICY "Gallery update" ON gallery FOR UPDATE USING (true);
CREATE POLICY "Gallery delete" ON gallery FOR DELETE USING (true);
