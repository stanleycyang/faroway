-- Seed blog_posts with existing MDX post metadata
INSERT INTO blog_posts (slug, title, description, content_source, author_slug, category, cover_image, reading_time, featured, status, published_at)
VALUES
  (
    'ultimate-guide-planning-trip-with-ai',
    'The Ultimate Guide to Planning a Trip with AI',
    'Discover how artificial intelligence is revolutionizing travel planning. Learn step-by-step how to use AI tools like TripGenie to create perfect itineraries, find deals, and travel smarter in 2026.',
    'mdx',
    'james-miller',
    'Travel Planning',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80',
    12,
    true,
    'published',
    '2026-02-10T00:00:00Z'
  ),
  (
    'hidden-gems-southeast-asia-2026',
    'Top 10 Hidden Gems in Southeast Asia for 2026',
    'Skip the tourist traps and discover Southeast Asia''s best-kept secrets. From untouched islands in the Philippines to ancient temples in Myanmar, these 10 destinations will blow your mind.',
    'mdx',
    'sarah-chen',
    'Destinations',
    'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&q=80',
    10,
    false,
    'published',
    '2026-02-05T00:00:00Z'
  ),
  (
    'how-to-save-money-on-flights',
    'How to Save Money on Flights: 15 Expert Tips',
    'Stop overpaying for flights. These 15 proven strategies will save you hundreds on your next booking — from timing hacks to hidden city ticketing and mistake fares.',
    'mdx',
    'sarah-chen',
    'Budget Travel',
    'https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=1200&q=80',
    9,
    false,
    'published',
    '2026-01-28T00:00:00Z'
  ),
  (
    'best-time-to-visit-japan',
    'Best Time to Visit Japan: A Month-by-Month Guide',
    'Find the perfect time for your Japan trip with our complete month-by-month guide. Cherry blossoms, autumn foliage, ski season, festivals — discover when to go for exactly what you want.',
    'mdx',
    'sarah-chen',
    'Destinations',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
    11,
    false,
    'published',
    '2026-01-20T00:00:00Z'
  )
ON CONFLICT (slug) DO NOTHING;
