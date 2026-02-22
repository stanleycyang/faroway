import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plan Your Trip in 60 Seconds — AI Trip Planner',
  description: 'Create a personalized day-by-day travel itinerary instantly. Choose your destination, dates, and vibes — get a complete plan with activities, restaurants, and local tips. Free, no signup required.',
  alternates: { canonical: '/create' },
  openGraph: {
    title: 'Plan Your Trip in 60 Seconds | TripGenie',
    description: 'AI-powered trip planner that creates personalized itineraries in seconds. Free to use, no signup required.',
    type: 'website',
    url: '/create',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plan Your Trip in 60 Seconds | TripGenie',
    description: 'AI-powered trip planner that creates personalized itineraries in seconds.',
  },
}

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
