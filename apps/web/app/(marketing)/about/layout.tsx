import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About TripGenie | AI-Powered Travel Planning',
  description:
    'Learn about TripGenie — the AI travel planner that creates personalized itineraries in seconds. Free, offline-ready, and trusted by 50,000+ travelers worldwide.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About TripGenie | AI-Powered Travel Planning',
    description:
      'Learn about TripGenie — the AI travel planner that creates personalized itineraries in seconds. Free, offline-ready, and trusted by 50,000+ travelers worldwide.',
    url: '/about',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
