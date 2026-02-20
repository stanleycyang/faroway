import type { Metadata } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai';

export const metadata: Metadata = {
  title: 'About TripGenie — Our Mission & Story',
  description:
    'Learn how TripGenie uses AI to make world-class travel planning instant, personal, and free for everyone. Our story, values, and mission.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About TripGenie — Our Mission & Story',
    description:
      'Learn how TripGenie uses AI to make world-class travel planning instant, personal, and free for everyone.',
    type: 'website',
    url: `${baseUrl}/about`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About TripGenie — Our Mission & Story',
    description:
      'Learn how TripGenie uses AI to make world-class travel planning instant, personal, and free for everyone.',
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
