import type { Metadata } from 'next';
import { CostEstimatorClient } from '@/components/tools/cost/CostEstimatorClient';

export const metadata: Metadata = {
  title: 'Trip Cost Estimator — Budget Your Travel',
  description:
    'Estimate your trip cost with detailed breakdowns for accommodation, food, transport, and activities. Covers 14 popular destinations with local pricing.',
  alternates: { canonical: '/tools/trip-cost' },
  openGraph: {
    title: 'Trip Cost Estimator | TripGenie',
    description: 'Free travel budget calculator for 14 destinations — see cost breakdowns instantly.',
    url: '/tools/trip-cost',
  },
};

export default function TripCostPage() {
  return <CostEstimatorClient />;
}
