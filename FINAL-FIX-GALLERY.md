# Final Fix for Gallery Upload 403 Error

If you're still getting the 403 error after the code update, you need to make the `photos` storage bucket public in Supabase.

## Steps to Fix in Supabase Dashboard:

### Option 1: Using the Supabase UI (EASIEST)

1. Go to **Supabase Dashboard** → **Storage**
2. Find the `photos` bucket in the left sidebar
3. Click on the `photos` bucket
4. Click **Settings** (gear icon)
5. Toggle **Public bucket** to **ON**
6. Click **Save**

### Option 2: Using SQL

If Option 1 doesn't work, run this SQL in **SQL Editor**:

```sql
-- Make the photos bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'photos';
```

## How to Test:

1. **Hard refresh** your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Go to Admin → Gallery tab
3. Select a burger from the dropdown
4. Upload a photo
5. It should work now!

## Why This Fixes It:

The storage bucket needs to be marked as "public" so that:
- The REST API can upload files without special permissions
- The uploaded photos can be viewed by anyone visiting your site
- No additional authentication is needed for public photo access

The previous error was because the bucket was private, and the RLS policies were blocking anonymous uploads even though we added the Authorization header.
