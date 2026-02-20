import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ACCENT_COLORS, type ClusterDefinition } from '@/lib/blog/clusters';

interface ClusterCTAProps {
  cluster: ClusterDefinition;
}

export function ClusterCTA({ cluster }: ClusterCTAProps) {
  const accent = ACCENT_COLORS[cluster.accent];

  return (
    <section className={`bg-gradient-to-br ${accent.buttonGradient} py-16`}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {cluster.cta.title}
        </h2>
        <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
          {cluster.cta.description}
        </p>
        <Link
          href={cluster.cta.buttonHref}
          className="inline-flex items-center gap-2 bg-white text-slate-900 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          {cluster.cta.buttonText}
        </Link>
      </div>
    </section>
  );
}
