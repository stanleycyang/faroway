import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { ClusterDefinition } from '@/lib/blog/clusters';

interface ClusterCardProps {
  cluster: ClusterDefinition;
  postCount: number;
}

export function ClusterCard({ cluster, postCount }: ClusterCardProps) {
  return (
    <Link
      href={`/blog/guides/${cluster.slug}`}
      className="group relative block overflow-hidden rounded-2xl aspect-[16/10]"
    >
      <Image
        src={cluster.heroImage}
        alt={cluster.heroImageAlt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-white/70 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
            {postCount} {postCount === 1 ? 'article' : 'articles'}
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mb-1">{cluster.title}</h3>
        <p className="text-white/70 text-sm line-clamp-2 mb-3">
          {cluster.tagline}
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 group-hover:gap-2.5 transition-all">
          Explore guide
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}
