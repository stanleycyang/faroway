import Link from 'next/link';
import { Compass, Luggage, Calculator, Sun } from 'lucide-react';

const ALL_TOOLS = [
  {
    slug: 'travel-quiz',
    title: 'Destination Quiz',
    description: 'Find your perfect destination in 60 seconds',
    icon: Compass,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    slug: 'packing-list',
    title: 'Packing List',
    description: 'Never forget essentials with a smart checklist',
    icon: Luggage,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    slug: 'trip-cost',
    title: 'Cost Estimator',
    description: 'Budget your trip with real cost breakdowns',
    icon: Calculator,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    slug: 'best-time-to-visit',
    title: 'Best Time to Visit',
    description: 'Climate data and crowd levels month by month',
    icon: Sun,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
];

interface RelatedToolsProps {
  currentSlug: string;
}

export function RelatedTools({ currentSlug }: RelatedToolsProps) {
  const tools = ALL_TOOLS.filter((t) => t.slug !== currentSlug);

  return (
    <section className="bg-slate-50 border-t border-slate-200/80 py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
          Explore More Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center mb-4`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">
                {tool.title}
              </h3>
              <p className="text-sm text-slate-600">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
