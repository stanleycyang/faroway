-- Blog Tables Migration
-- Newsletter subscribers, view tracking, and post metadata

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'blog' CHECK (source IN ('blog', 'footer', 'popup', 'landing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Blog post views (privacy-safe with IP hashing)
CREATE TABLE IF NOT EXISTS blog_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug TEXT NOT NULL,
  viewer_ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog posts metadata mirror (for view counts + future CMS)
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  content_source TEXT NOT NULL DEFAULT 'mdx' CHECK (content_source IN ('mdx', 'database')),
  author_slug TEXT,
  category TEXT,
  cover_image TEXT,
  reading_time INTEGER,
  featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_post_views_slug ON blog_post_views (post_slug);
CREATE INDEX IF NOT EXISTS idx_blog_post_views_viewed_at ON blog_post_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers (status);

-- RLS Policies
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Newsletter: anyone can INSERT (subscribe), service role can SELECT/UPDATE
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read subscribers" ON newsletter_subscribers
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update subscribers" ON newsletter_subscribers
  FOR UPDATE USING (auth.role() = 'service_role');

-- Blog post views: anyone can INSERT, service role can SELECT
CREATE POLICY "Anyone can log a view" ON blog_post_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read views" ON blog_post_views
  FOR SELECT USING (auth.role() = 'service_role');

-- Blog posts: public SELECT where published, service role full access
CREATE POLICY "Public can read published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Service role full access to posts" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Helper function: atomically increment view count
CREATE OR REPLACE FUNCTION increment_blog_view_count(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;
