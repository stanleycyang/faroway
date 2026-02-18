import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TripGenie - AI-Powered Travel Planning | Create Itineraries in 60 Seconds',
  description: 'Plan your dream trip with AI. Get personalized day-by-day itineraries, book hotels, flights, and activities all in one place. Free to use, no credit card required.',
  keywords: 'AI travel planner, trip planning app, travel itinerary generator, vacation planner, AI itinerary, book flights hotels, travel booking',
  openGraph: {
    title: 'TripGenie - AI-Powered Travel Planning',
    description: 'Create personalized travel itineraries in 60 seconds with AI. Hotels, flights, activities—all bookable in one tap.',
    type: 'website',
    locale: 'en_US',
    siteName: 'TripGenie',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'TripGenie - AI Travel Planning',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TripGenie - AI-Powered Travel Planning',
    description: 'Create personalized travel itineraries in 60 seconds with AI.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://tripgenie.ai',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
