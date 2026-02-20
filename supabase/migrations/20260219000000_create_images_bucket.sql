-- ============================================================================
-- MIGRATION: Create public images bucket in Supabase Storage
-- ============================================================================

-- Create the images bucket (public reads, service role writes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (no auth required)
CREATE POLICY "Public read access on images bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

-- Restrict uploads to service role only
CREATE POLICY "Service role upload access on images bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );

-- Restrict updates to service role only
CREATE POLICY "Service role update access on images bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );

-- Restrict deletes to service role only
CREATE POLICY "Service role delete access on images bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'images'
    AND auth.role() = 'service_role'
  );
