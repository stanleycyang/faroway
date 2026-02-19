import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center | TripGenie',
  description:
    'Get help with TripGenie. Browse help topics, FAQs, quick start guides, and contact our support team. We\'re here to help you travel smarter.',
  alternates: {
    canonical: '/support',
  },
  openGraph: {
    title: 'Help Center | TripGenie',
    description:
      'Get help with TripGenie. Browse help topics, FAQs, quick start guides, and contact our support team.',
    url: '/support',
    type: 'website',
  },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
