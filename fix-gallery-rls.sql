-- Fix Gallery RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Gallery read" ON gallery;
DROP POLICY IF EXISTS "Gallery insert" ON gallery;
DROP POLICY IF EXISTS "Gallery update" ON gallery;
DROP POLICY IF EXISTS "Gallery delete" ON gallery;

-- Recreate policies with proper permissions
CREATE POLICY "Gallery read" ON gallery FOR SELECT USING (true);
CREATE POLICY "Gallery insert" ON gallery FOR INSERT WITH CHECK (true);
CREATE POLICY "Gallery update" ON gallery FOR UPDATE USING (true);
CREATE POLICY "Gallery delete" ON gallery FOR DELETE USING (true);
