import type { Metadata } from 'next';
import { TravelQuizClient } from '@/components/tools/quiz/TravelQuizClient';

export const metadata: Metadata = {
  title: 'Where Should I Travel? — Destination Quiz',
  description:
    'Take our 60-second travel quiz to discover your perfect destination. Answer 6 questions about your style, budget, and interests to get personalized recommendations.',
  alternates: { canonical: '/tools/travel-quiz' },
  openGraph: {
    title: 'Destination Quiz — Where Should You Travel? | TripGenie',
    description: 'Find your dream destination in 60 seconds with our free travel quiz.',
    url: '/tools/travel-quiz',
  },
};

export default function TravelQuizPage() {
  return <TravelQuizClient />;
}
