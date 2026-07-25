-- Repair any remaining published cover image that points at a missing object.
-- This intentionally reads Storage metadata rather than assuming a fixed
-- article list, so older long-tail posts are repaired as well.

WITH broken AS (
  SELECT p.id, p.category
  FROM public.blog_posts AS p
  WHERE p.status = 'published'
    AND p.cover_image LIKE
      'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/%'
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS object
      WHERE object.bucket_id = 'images'
        AND object.name = replace(
          p.cover_image,
          'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/',
          ''
        )
    )
)
UPDATE public.blog_posts AS post
SET cover_image = CASE
  WHEN broken.category = 'Money' THEN
    'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/blog/best-travel-credit-cards-2026-photo-1556742049-0cfed4f6a45d.jpg'
  ELSE
    'https://jcnephijkxgtprsutgsf.supabase.co/storage/v1/object/public/images/blog/default-photo-1507525428034-b723cf961d3e.jpg'
END
FROM broken
WHERE post.id = broken.id;
