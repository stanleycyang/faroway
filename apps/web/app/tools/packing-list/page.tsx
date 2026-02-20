import type { Metadata } from 'next';
import { PackingListClient } from '@/components/tools/packing/PackingListClient';

export const metadata: Metadata = {
  title: 'Packing List Generator — Never Forget Essentials',
  description:
    'Generate a smart packing checklist for your trip. Customized by destination, trip type, and climate. Check items off and save your progress.',
  alternates: { canonical: '/tools/packing-list' },
  openGraph: {
    title: 'Smart Packing List Generator | TripGenie',
    description: 'Customized packing checklists for 14 destinations — free, no sign-up.',
    url: '/tools/packing-list',
  },
};

export default function PackingListPage() {
  return <PackingListClient />;
}
