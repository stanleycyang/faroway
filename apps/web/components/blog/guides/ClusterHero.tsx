import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { ACCENT_COLORS, type ClusterDefinition } from '@/lib/blog/clusters';

interface ClusterHeroProps {
  cluster: ClusterDefinition;
  postCount: number;
}

export function ClusterHero({ cluster, postCount }: ClusterHeroProps) {
  const accent = ACCENT_COLORS[cluster.accent];
  const titleParts = cluster.title.split(cluster.gradientWord);

  return (
    <section className="relative min-h-[80vh] flex items-end overflow-hidden">
      {/* Background image */}
      <Image
        src={cluster.heroImage}
        alt={cluster.heroImageAlt}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className={`absolute inset-0 ${accent.overlay}`} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-16 pt-32">
        {/* Post count pill */}
        <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-white/90 text-sm font-medium mb-6">
          {postCount} {postCount === 1 ? 'article' : 'articles'}
        </span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-4xl">
          {titleParts[0]}
          <span className="text-gradient-hero">{cluster.gradientWord}</span>
          {titleParts[1] || ''}
        </h1>

        <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed mb-8">
          {cluster.tagline}
        </p>

        {/* Scroll indicator */}
        <div className="flex items-center gap-2 text-white/50 text-sm animate-bounce">
          <ChevronDown className="w-4 h-4" />
          <span>Scroll to explore</span>
        </div>
      </div>
    </section>
  );
}
