import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View and manage your TripGenie travel itineraries. See upcoming trips, past adventures, and create new travel plans.',
  robots: {
    index: false, // Private user content
    follow: false,
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
