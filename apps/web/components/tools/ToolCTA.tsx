import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface ToolCTAProps {
  title?: string;
  description?: string;
}

export function ToolCTA({
  title = 'Ready to Plan Your Trip?',
  description = 'Faroway creates a personalized itinerary in 60 seconds — completely free and tailored to your style.',
}: ToolCTAProps) {
  return (
    <section className="bg-gradient-to-br from-primary-600 to-amber-500 py-16">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {title}
        </h2>
        <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
          {description}
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Plan My Trip — Free
        </Link>
      </div>
    </section>
  );
}
