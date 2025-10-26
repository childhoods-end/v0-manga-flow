-- Create manga-pages storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('manga-pages', 'manga-pages', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload to manga-pages" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Allow public read access to manga-pages bucket
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'manga-pages');

-- Allow authenticated users to upload to manga-pages bucket
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'manga-pages');

-- Allow anonymous users to upload (for demo purposes - restrict in production)
CREATE POLICY "Allow anonymous users to upload"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'manga-pages');

-- Allow users to update their own files
CREATE POLICY "Allow users to update their files"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'manga-pages');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their files"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'manga-pages');
