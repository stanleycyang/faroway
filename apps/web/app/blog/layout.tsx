import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: {
    template: '%s | TripGenie Blog',
    default: 'TripGenie Blog',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
