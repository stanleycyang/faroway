import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, Luggage, Calculator, Sun, Shield, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { ToolHero } from '@/components/tools/ToolHero';
import { ToolCTA } from '@/components/tools/ToolCTA';

export const metadata: Metadata = {
  title: 'Free Travel Tools — Quiz, Packing, Cost, Visa & More',
  description:
    'Plan smarter with free travel tools: destination quiz, packing list, cost estimator, visa checker, currency converter, and best time to visit guides.',
  alternates: { canonical: '/tools' },
  openGraph: {
    title: 'Free Travel Planning Tools | Faroway',
    description: 'Destination quiz, packing lists, cost estimator, visa checker, currency converter & climate data — all free.',
    url: '/tools',
  },
};

const TOOLS = [
  {
    slug: 'travel-quiz',
    title: 'Where Should I Go?',
    subtitle: 'Destination Quiz',
    description:
      'Answer 6 quick questions about your travel style and get matched to your perfect destination with a personalized match score.',
    icon: Compass,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'hover:border-primary/30',
  },
  {
    slug: 'packing-list',
    title: 'Smart Packing List',
    subtitle: 'Packing Generator',
    description:
      'Generate a customized packing checklist based on your destination, trip type, and climate. Save progress and print it out.',
    icon: Luggage,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'hover:border-teal-300',
  },
  {
    slug: 'trip-cost',
    title: 'Trip Cost Estimator',
    subtitle: 'Budget Calculator',
    description:
      'Estimate your total trip cost with detailed breakdowns for accommodation, food, transport, activities, and more.',
    icon: Calculator,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'hover:border-amber-300',
  },
  {
    slug: 'best-time-to-visit',
    title: 'Best Time to Visit',
    subtitle: 'Climate & Crowd Data',
    description:
      'Monthly temperature, rainfall, crowd levels, and events for 14 destinations. Find the perfect month for your trip.',
    icon: Sun,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'hover:border-sky-300',
  },
  {
    slug: 'visa-checker',
    title: 'Do I Need a Visa?',
    subtitle: 'Visa Checker',
    description:
      'Check visa requirements based on your passport country. Get instant results with stay duration, visa type, and travel tips.',
    icon: Shield,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'hover:border-violet-300',
  },
  {
    slug: 'currency-converter',
    title: 'Currency Converter',
    subtitle: 'Travel Money Calculator',
    description:
      'Convert between 11 travel currencies with real-time-style rates. Includes destination-specific tips for handling money abroad.',
    icon: ArrowLeftRight,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'hover:border-emerald-300',
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen">
      <ToolHero
        badge="Free Tools"
        title="Travel Planning Tools"
        gradientWord="Tools"
        description="Everything you need to plan smarter — from finding your destination to packing your bags. All free, no sign-up required."
      />

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className={`group p-8 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-lg ${tool.border} transition-all`}
            >
              <div className={`w-14 h-14 rounded-2xl ${tool.bg} ${tool.color} flex items-center justify-center mb-5`}>
                <tool.icon className="w-7 h-7" />
              </div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${tool.color} mb-1`}>
                {tool.subtitle}
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-primary transition-colors">
                {tool.title}
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                {tool.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                Try it now <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ToolCTA />
    </main>
  );
}
