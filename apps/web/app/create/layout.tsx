import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Your Trip',
  description: 'Start planning your perfect trip with TripGenie AI. Enter your destination, dates, and preferences to get a personalized itinerary in seconds.',
  openGraph: {
    title: 'Plan Your Trip | TripGenie',
    description: 'Create a personalized AI-powered travel itinerary in 60 seconds. Free to use, no signup required.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plan Your Trip | TripGenie',
    description: 'Create a personalized AI-powered travel itinerary in 60 seconds.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
