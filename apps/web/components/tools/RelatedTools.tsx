import Link from "next/link";
import {
  ArrowLeftRight,
  Calculator,
  Compass,
  Globe2,
  Luggage,
  Shield,
  Sun,
} from "lucide-react";

const ALL_TOOLS = [
  {
    slug: "world-map",
    title: "World Map Tracker",
    description: "Pin countries lived, visited & on your wishlist",
    icon: Globe2,
    color: "text-primary-800",
    bg: "bg-primary-50",
  },
  {
    slug: "travel-quiz",
    title: "Destination Quiz",
    description: "Find your perfect destination match in minutes",
    icon: Compass,
    color: "text-primary-700",
    bg: "bg-primary-50",
  },
  {
    slug: "packing-list",
    title: "Packing List",
    description: "Never forget essentials with a smart checklist",
    icon: Luggage,
    color: "text-teal-700",
    bg: "bg-teal-50",
  },
  {
    slug: "trip-cost",
    title: "Cost Estimator",
    description: "Budget your trip with real cost breakdowns",
    icon: Calculator,
    color: "text-amber-800",
    bg: "bg-amber-50",
  },
  {
    slug: "best-time-to-visit",
    title: "Best Time to Visit",
    description: "Climate data and crowd levels month by month",
    icon: Sun,
    color: "text-sky-700",
    bg: "bg-sky-50",
  },
  {
    slug: "visa-checker",
    title: "Visa Checker",
    description: "Check visa requirements for your passport",
    icon: Shield,
    color: "text-violet-700",
    bg: "bg-violet-50",
  },
  {
    slug: "currency-converter",
    title: "Currency Converter",
    description: "Convert between travel currencies instantly",
    icon: ArrowLeftRight,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
];

interface RelatedToolsProps {
  currentSlug: string;
}

export function RelatedTools({ currentSlug }: RelatedToolsProps) {
  const tools = ALL_TOOLS.filter((t) => t.slug !== currentSlug).slice(0, 6);

  return (
    <section className="bg-[#FAF8F3] border-t border-[#DCE5E3] py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-8 text-center">
          Explore More Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group p-6 rounded-2xl bg-white border border-[#DCE5E3] shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
            >
              <div
                className={`w-12 h-12 rounded-xl ${tool.bg} ${tool.color} flex items-center justify-center mb-4`}
              >
                <tool.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary-700 transition-colors">
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
