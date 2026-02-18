import { MetadataRoute } from 'next'
import { getAllPostMetas, getAllCategories } from '@/lib/blog'
import { getSupabase } from '@/lib/supabase/server'

// Static destinations for sitemap
const popularDestinations = [
  'tokyo', 'paris', 'bali', 'santorini', 'new-york', 'barcelona',
  'london', 'rome', 'dubai', 'sydney', 'amsterdam', 'kyoto',
  'maldives', 'iceland', 'marrakech', 'singapore', 'bangkok', 'lisbon',
  'prague', 'vienna', 'berlin', 'copenhagen', 'oslo', 'stockholm'
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai'
  const currentDate = new Date().toISOString()
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/create`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/auth/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
  
  // Destination landing pages (for future implementation)
  const destinationPages: MetadataRoute.Sitemap = popularDestinations.map(dest => ({
    url: `${baseUrl}/destinations/${dest}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  
  // Blog pages
  const blogIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  const blogPosts: MetadataRoute.Sitemap = getAllPostMetas().map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.lastUpdated || post.date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const blogCategories: MetadataRoute.Sitemap = getAllCategories().map(cat => ({
    url: `${baseUrl}/blog/category/${cat.toLowerCase().replace(/\s+/g, '-')}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Shared trip pages
  let sharedTripPages: MetadataRoute.Sitemap = []
  try {
    const supabase = getSupabase()
    const { data: sharedTrips } = await supabase
      .from('trips')
      .select('share_token, updated_at')
      .eq('is_shared', true)
      .not('share_token', 'is', null)
      .order('shared_at', { ascending: false })
      .limit(200)

    if (sharedTrips) {
      sharedTripPages = sharedTrips.map(trip => ({
        url: `${baseUrl}/s/${trip.share_token}`,
        lastModified: trip.updated_at || currentDate,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch {
    // Continue without shared trips if DB is unavailable
  }

  return [...staticPages, ...destinationPages, ...blogIndex, ...blogPosts, ...blogCategories, ...sharedTripPages]
}
