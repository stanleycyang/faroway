-- Add content and metadata columns to blog_posts for full database-driven blog
-- Previously blog_posts was a metadata-only mirror; now it becomes the source of truth.

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cluster TEXT;

-- Listing index: covers all metadata queries without hitting the heap (skips large content column)
CREATE INDEX IF NOT EXISTS idx_blog_posts_listing
  ON blog_posts (status, published_at DESC)
  INCLUDE (slug, title, description, author_slug, category, cover_image, cover_image_alt, reading_time, featured, tags, cluster, last_updated, view_count);

-- Category filter
CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts (category)
  WHERE status = 'published';

-- Featured post lookup
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON blog_posts (featured)
  WHERE featured = true AND status = 'published';

-- Tags GIN index for related-posts and cluster matching
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags
  ON blog_posts USING GIN (tags)
  WHERE status = 'published';

-- Cluster filter
CREATE INDEX IF NOT EXISTS idx_blog_posts_cluster
  ON blog_posts (cluster)
  WHERE status = 'published' AND cluster IS NOT NULL;
